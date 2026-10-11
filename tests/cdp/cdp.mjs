// 의존성 없는 최소 CDP(Chrome DevTools Protocol) 클라이언트 — kr_ext_workspace 의 test/cdp/cdp.mjs 와 같은 모양.
//
// Node 22+ 의 내장 WebSocket 만 쓴다(puppeteer 를 받지 않는다). 이 저장소는 빌드 도구도 node_modules 도 없고,
// 그대로 chrome://extensions 에 올리는 폴더라 꾸러미를 더하지 않는다.
//
// 디버그 포트는 기본 9333(CLAUDE.md 의 "CDP 용 Chrome, KRS 프로필"). 다른 포트면 CDP_PORT 로 알려 준다.
// 모든 호출에 시간 제한을 둔다 — 없으면 다이얼로그(alert)가 렌더러를 막았을 때 영영 기다린다.

export const PORT = +(process.env.CDP_PORT || 9333);
const base = () => `http://127.0.0.1:${PORT}`;

export async function version() {
  const r = await fetch(`${base()}/json/version`, { signal: AbortSignal.timeout(4000) });
  return r.json();
}

export async function targets() {
  const r = await fetch(`${base()}/json/list`, { signal: AbortSignal.timeout(4000) });
  return r.json();
}

export async function newTab(url = 'about:blank') {
  const r = await fetch(`${base()}/json/new?${encodeURIComponent(url)}`, {
    method: 'PUT', signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`탭을 열지 못했습니다: HTTP ${r.status}`);
  return r.json();
}

export async function closeTab(id) {
  try { await fetch(`${base()}/json/close/${id}`, { signal: AbortSignal.timeout(4000) }); } catch { /* 이미 닫힘 */ }
}

/**
 * 타깃(탭·서비스워커) 하나에 붙는다.
 * @returns {Promise<object>} send/on/evaluate/goto/close 를 가진 손잡이. dialogs/errors/logs 에 페이지가 말한 것이 모인다.
 */
export async function attach(target) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  const listeners = new Map();
  let seq = 0;

  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = () => rej(new Error('CDP 소켓을 열지 못했습니다.'));
    setTimeout(() => rej(new Error('CDP 소켓이 10초 안에 열리지 않았습니다.')), 10000);
  });

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) rej(new Error(`${msg.error.message}`));
      else res(msg.result);
      return;
    }
    if (msg.method) for (const fn of listeners.get(msg.method) || []) fn(msg.params);
  };

  const send = (method, params = {}, ms = 20000) => new Promise((res, rej) => {
    const id = ++seq;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { if (pending.delete(id)) rej(new Error(`${method} 가 ${ms / 1000}초 안에 응답하지 않았습니다.`)); }, ms);
  });

  const on = (method, fn) => listeners.set(method, [...(listeners.get(method) || []), fn]);

  const dialogs = [];
  const errors = [];
  const logs = [];

  // 서비스워커 타깃에는 Page 도메인이 없다 — 그때는 Runtime 만 켠다.
  const hasPage = target.type !== 'service_worker' && target.type !== 'worker';
  if (hasPage) await send('Page.enable').catch(() => {});
  await send('Runtime.enable');
  on('Page.javascriptDialogOpening', async (p) => {
    dialogs.push({ type: p.type, message: p.message });
    try { await send('Page.handleJavaScriptDialog', { accept: true }); } catch { /* 이미 닫힘 */ }
  });
  on('Runtime.exceptionThrown', (p) => {
    const d = p.exceptionDetails || {};
    errors.push({ text: d.exception?.description || d.text || '알 수 없는 예외', url: d.url || '', line: d.lineNumber });
  });
  on('Runtime.consoleAPICalled', (p) => {
    if (p.type === 'error' || p.type === 'warning') {
      logs.push({ type: p.type, text: (p.args || []).map((a) => a.value ?? a.description ?? '').join(' ') });
    }
  });

  /** 식을 평가해 값을 받는다. 예외는 던져서 올린다. */
  const evaluate = async (expression, ms = 20000) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, ms);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text || '평가 실패');
    return r.result.value;
  };

  /** 이동하고 load 를 기다린다. 안 오면 시간 제한으로 그냥 넘어간다(다이얼로그가 막을 수 있다). */
  const goto = async (url, ms = 20000) => {
    const loaded = new Promise((r) => on('Page.loadEventFired', r));
    await send('Page.navigate', { url }, ms);
    await Promise.race([loaded, new Promise((r) => setTimeout(r, ms))]);
    await new Promise((r) => setTimeout(r, 400));
  };

  return {
    send, on, evaluate, goto,
    dialogs, errors, logs,
    targetId: target.id,
    close: () => { try { ws.close(); } catch { /* 이미 닫힘 */ } },
  };
}
