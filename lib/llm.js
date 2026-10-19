/* LLM 연결 상태 (백그라운드 전용 — background.js 가 importScripts) — 이 PC 의 Help 서버(help-server/server.js)가 떠 있는지 GET /health 로 확인해 storage.local.llmStatus 에 둔다.
 * LLM 으로 하는 기능(청구 준비 자동 분류 = 첨부 서류 읽기 · 청구내역 작성, 증빙 찾아오기, Help Chat)은 이 상태가 ok 일 때만 패널·설정 페이지에서 켜진다:
 *  패널(lib/prep.js 가 state.llm 에 읽음 → render.js prepCtx.fetch) 은 [찾아오기]·[자주 사용 등록] 을 ok && fetch 일 때만 보이고, 설정 페이지(options.js) 는 LLM 설정 탭의 기능 구역과 증빙 찾아오기 탭을 ok 일 때만 활성화한다.
 *  llmStatus = { url, at, ok, model, classify(자동 분류 모델 — 빈 값이면 그 기능이 없는 옛 서버), classifyPtcl(청구내역 작성 가능), fetch(찾아오기 모델 — 빈 값이면 불가), fetchNote(불가 이유, 예 Node 22 필요), cli(claude CLI 버전), version(서버가 읽은 확장 버전), repo, busy, error }
 *  staff(참여연구원 변경 도우미 모델 — 빈 값이면 그 기능이 없는 옛 서버; 참여연구원 변경 탭의 채팅 popup/staff-chat.js 는 ok 이고 이 값이 있을 때만 입력란을 켬)는 0.8.8 부터.
 * 언제 확인하나: 조회(refresh)마다 · 패널의 자동 분류(lib/prep-ai.js checkHealth)와 찾아오기 시작(lib/prep-fetch.js) · 설정 페이지의 연결 확인·주기 확인('llmProbe'). TTL 안의 재요청은 마지막 결과를 그대로 준다(force 면 다시) */
const KRX_LLM = (() => {
  const KEY = 'llmStatus';
  const TTL = 30000, HEALTH_MS = 2500;
  const DEFAULT_URL = 'http://127.0.0.1:8106';
  const baseUrl = (u) => { const s = String(u || '').trim().replace(/\/+$/, ''); return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(s) ? s : DEFAULT_URL; };   // 이 PC 만 (popup/help.js 와 같음)
  let last = null;        // 마지막 결과 (메모리 — 워커가 다시 뜨면 저장소에서)
  let inflight = null;    // 진행 중인 확인 (같은 주소의 동시 요청은 하나로)

  async function fetchJson(url, ms) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    try {
      const res = await fetch(url, { cache: 'no-store', signal: ac.signal });
      let j = null;
      try { j = await res.json(); } catch (e) {}
      return j && typeof j === 'object' ? j : { ok: false, error: `Help 서버 응답 ${res.status}` };
    } finally { clearTimeout(t); }
  }
  /* /health 응답 → 상태. 서버가 아니거나(name 이 krx-help 가 아님) 연결이 안 되면 ok: false 와 이유 */
  function shape(url, j, err) {
    const ok = !!(j && j.ok && j.name === 'krx-help');
    return {
      url, at: Date.now(), ok,
      model: ok ? String(j.model || '') : '', classify: ok ? String(j.classify || '') : '', classifyPtcl: !!(ok && j.classifyPtcl),
      fetch: ok ? String(j.fetch || '') : '', fetchNote: ok ? String(j.fetchNote || '') : '', cli: ok ? String(j.cli || '') : '',
      version: ok ? String(j.version || '') : '', repo: ok ? String(j.repo || '') : '', busy: ok ? String(j.busy || '') : '', staff: ok ? String(j.staff || '') : '',
      error: ok ? '' : (j && j.error ? `거절됨: ${j.error}` : err || `연결할 수 없습니다 (${url}) — 이 PC 에서 node help-server/server.js 를 실행하세요`),
    };
  }
  async function probe(url, force) {
    url = baseUrl(url);
    if (!last) { try { const s = (await chrome.storage.local.get(KEY))[KEY]; if (s && s.url) last = s; } catch (e) {} }
    if (!force && last && last.url === url && Date.now() - last.at < TTL) return last;
    if (inflight && inflight.url === url) return inflight.p;
    const p = (async () => {
      let j = null, err = '';
      try { j = await fetchJson(`${url}/health`, HEALTH_MS); } catch (e) { j = null; err = `연결할 수 없습니다 (${url}) — 이 PC 에서 node help-server/server.js 를 실행하세요`; }
      const st = shape(url, j, err);
      const changed = !last || last.url !== st.url || last.ok !== st.ok || last.classify !== st.classify || last.classifyPtcl !== st.classifyPtcl || last.fetch !== st.fetch || last.staff !== st.staff || last.cli !== st.cli || last.error !== st.error;
      last = st;
      try { if (changed || !(await chrome.storage.local.get(KEY))[KEY]) await chrome.storage.local.set({ [KEY]: st }); } catch (e) {}   // 같은 결과면 저장소를 건드리지 않음 (패널이 다시 그리지 않게)
      return st;
    })();
    inflight = { url, p };
    try { return await p; } finally { if (inflight && inflight.p === p) inflight = null; }
  }
  /* 마지막 상태 (확인하지 않음) */
  async function status() { if (last) return last; try { return (await chrome.storage.local.get(KEY))[KEY] || null; } catch (e) { return null; } }
  return { KEY, TTL, baseUrl, probe, status };
})();
