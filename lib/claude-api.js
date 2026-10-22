/* Claude API 직접 호출 (0.8.6 — 백그라운드는 importScripts, 설정 페이지는 script) — 설정 › LLM 설정 › Claude API 에 넣은 Anthropic API 키로 이 브라우저에서 api.anthropic.com 을 바로 부른다(Help 서버 없이).
 * 지금은 청구 준비 자동 분류·청구내역 작성(lib/prep-ai.js — 사용 방식이 "Help 서버가 안 될 때만"이면 서버가 없거나 실패할 때, "항상"이면 늘)만 이 길로 갔고, 0.8.9 부터 참여연구원 변경 도우미(popup/staff-chat.js — Help 서버(Claude CLI)가 없을 때 staff(), 첨부 PDF·이미지는 document·image 블록)도 간다.
 * Help Chat·증빙 찾아오기는 Claude Code 가 확장 파일·작업용 Chrome 을 다뤄야 해서 Help 서버로만 된다.
 *  API 키: storage.local.claudeApiKey — 동기화되는 settings 에는 넣지 않는다(rcmsCred·fetchCred 와 같음). 사용 방식·모델은 settings.help.api { use: 'auto'|'always'|'off', model }
 *  워크스페이스 ID: storage.local.claudeApiWorkspace — 워크스페이스에 묶이지 않은 키(sk-ant-usr-…)는 Anthropic 이 anthropic-workspace-id 헤더 없이는 400("This API key is not scoped to a workspace" — 2026-10-21 실측)으로 거절하므로
 *        설정 › LLM 설정 › Claude API 의 워크스페이스 ID(wrkspc_…)가 있으면 모든 호출(call)에 그 헤더를 붙인다. 보통의 키(sk-ant-api03-…)는 비워 둔다
 *  상태: storage.local.llmApi = { at, ok, model, name, keyTag(키 길이·끝 4자 — 어느 키로 확인했는지), error } — 설정 페이지의 [API 확인](GET /v1/models/{model}, 비용 없음)과
 *        자동 분류의 결과(성공 · 키·권한·모델 오류)가 바꾼다. 같은 상태면 다시 쓰지 않는다
 *  자동 분류: lib/classify-core.js(Help 서버와 같은 프롬프트·스키마)로 POST /v1/messages 한 번 — 구조화 출력(output_config.format json_schema, 후보 enum), effort low,
 *            Fable·Opus·Sonnet 은 거절(refusal) 때 서버 쪽 대체 모델(fallbacks "default"). Haiku 5.5 는 대체 모델이 없어 거절이면 오류로 알린다
 *  빌드 단계·의존 패키지가 없는 확장이라 공식 SDK 대신 fetch 로 부른다(헤더 anthropic-version · 확장 출처용 anthropic-dangerous-direct-browser-access). 429·5xx·연결 오류는 RETRIES 번까지 다시 */
const KRX_CLAUDE_API = (() => {
  const KEY = 'claudeApiKey', WS = 'claudeApiWorkspace', STATUS = 'llmApi';
  const BASE = 'https://api.anthropic.com/v1', VERSION = '2023-06-01';
  const MODELS = [['claude-opus-5-5', 'Claude Opus 5.5 — 가장 정확 (기본)'], ['claude-fable-5-1', 'Claude Fable 5.1 — 최고 성능 (Opus 의 2.5배 비용)'], ['claude-sonnet-5-5', 'Claude Sonnet 5.5'], ['claude-haiku-5-5', 'Claude Haiku 5.5 — 빠르고 저렴']];   // Fable 5.1: 2026-10-21 사용자 "페이블 도 추가" — 생각이 늘 켜져 있고(thinking 안 보냄, effort 만) 거절 대체(fallbacks default)도 됨, 30일 보존 계정만
  const DEFAULT_MODEL = 'claude-opus-5-5';   // 2026-10-21 사용자 "기본은 opus 5.5로" (그 전 Haiku 5.5)
  const FALLBACK = new Set(['claude-fable-5-1', 'claude-opus-5-5', 'claude-sonnet-5-5']);   // 거절 때 서버 쪽 대체 모델이 있는 모델 (fallbacks "default")
  const FALLBACK_BETA = 'server-side-fallback-2026-07-01';
  const CHECK_MS = 10000, CLASSIFY_MS = 120000, STAFF_MS = 180000, RETRIES = 2, MAX_TOKENS = 16000;
  const STAFF_MODEL = 'claude-opus-5-5';   // 참여연구원 변경 도우미 — 금액·기간을 따져야 해서 서버(KRX_HELP_STAFF_MODEL 기본)와 같은 모델

  const modelOf = (m) => { const s = String(m || '').trim(); return /^claude-[a-z0-9.-]{3,60}$/.test(s) ? s : DEFAULT_MODEL; };
  const keyTag = (k) => { const s = String(k || '').trim(); return s ? `${s.length}·${s.slice(-4)}` : ''; };
  const mask = (k) => { const s = String(k || '').trim(); return s.length > 14 ? `${s.slice(0, 7)}…${s.slice(-4)}` : s ? '…' + s.slice(-2) : ''; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function getKey() { try { return String((await chrome.storage.local.get(KEY))[KEY] || '').trim(); } catch (e) { return ''; } }
  async function getWs() { try { return String((await chrome.storage.local.get(WS))[WS] || '').trim(); } catch (e) { return ''; } }
  async function status() { try { return (await chrome.storage.local.get(STATUS))[STATUS] || null; } catch (e) { return null; } }
  /* 상태 저장 — force 가 아니면 같은 상태(1시간 안)는 다시 쓰지 않는다(설정 페이지가 다시 그리지 않게). 자동 분류가 쓴 상태는 이름(display_name)을 모르니 [API 확인] 때 받은 것을 살린다 */
  async function setStatus(st, force) {
    try {
      const cur = await status();
      if (cur && !st.name && cur.model === st.model && cur.keyTag === st.keyTag) st = Object.assign({}, st, { name: cur.name || '' });
      if (!force && cur && cur.ok === st.ok && cur.model === st.model && cur.keyTag === st.keyTag && cur.error === st.error && Date.now() - cur.at < 3600000) return;
      await chrome.storage.local.set({ [STATUS]: st });
    } catch (e) {}
  }

  function errText(status, j) {
    const m = j && j.error && j.error.message ? String(j.error.message).slice(0, 200) : '';
    if (status === 401) return 'API 키가 올바르지 않습니다 (401)';
    if (status === 403) return `이 API 키로는 쓸 수 없습니다 (403)${m ? ` — ${m}` : ''}`;
    if (status === 404) return `모델을 찾지 못했습니다 (404)${m ? ` — ${m}` : ''}`;
    if (status === 429) return '요청 한도를 넘었습니다 (429) — 잠시 뒤 다시 됩니다';
    if (status === 529) return 'Anthropic 서버가 붐빕니다 (529) — 잠시 뒤 다시 됩니다';
    if (status === 400 && /workspace/i.test(m)) return '이 키는 워크스페이스 ID 가 있어야 합니다 (400) — 설정 › LLM 설정 › Claude API 의 워크스페이스 ID(Claude Console › Settings › Workspaces 의 wrkspc_…)를 넣고 저장하세요';
    return `Claude API 응답 ${status}${m ? ` — ${m}` : ''}`;
  }
  /* 한 번 부르기 (429·5xx·연결 오류는 RETRIES 번까지 다시, 시간 초과는 다시 하지 않음) → { ok, status, j } | { ok: false, status, error } */
  async function call(path, o) {
    const headers = { 'content-type': 'application/json', 'x-api-key': o.key, 'anthropic-version': VERSION, 'anthropic-dangerous-direct-browser-access': 'true' };
    if (o.beta) headers['anthropic-beta'] = o.beta;
    const ws = o.ws != null ? String(o.ws).trim() : await getWs();   // 워크스페이스에 묶이지 않은 키(sk-ant-usr-…)용 — 설정의 워크스페이스 ID(check 는 입력란 값을 먼저)
    if (ws) headers['anthropic-workspace-id'] = ws;
    let last = null;
    for (let i = 0; i <= RETRIES; i++) {
      if (i) await sleep(Math.min(8000, (last && last.wait) || 1000 * 2 ** (i - 1)));
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), o.ms);
      try {
        const res = await fetch(BASE + path, { method: o.body ? 'POST' : 'GET', headers, body: o.body ? JSON.stringify(o.body) : undefined, cache: 'no-store', signal: ac.signal });
        let j = null;
        try { j = await res.json(); } catch (e) {}
        if (res.ok) return { ok: true, status: res.status, j };
        const ra = Number(res.headers && res.headers.get ? res.headers.get('retry-after') : 0);
        last = { ok: false, status: res.status, error: errText(res.status, j), wait: ra > 0 ? ra * 1000 : 0 };
        if (!(res.status === 429 || res.status >= 500)) break;
      } catch (e) {
        if (e && e.name === 'AbortError') return { ok: false, status: 0, error: `Claude API 응답이 너무 늦습니다 (${Math.round(o.ms / 1000)}초)` };
        last = { ok: false, status: 0, error: 'Claude API(api.anthropic.com)에 연결할 수 없습니다' };
      } finally { clearTimeout(t); }
    }
    return last;
  }

  /* [API 확인]: 키·모델이 되는지 GET /v1/models/{model} (토큰을 쓰지 않음). o = { key?(없으면 저장된 키), model?, ws?(워크스페이스 ID — 없으면 저장된 것) } → 상태 (storage.local.llmApi 에도) */
  async function check(o) {
    o = o || {};
    const key = o.key != null ? String(o.key).trim() : await getKey();
    const model = modelOf(o.model);
    if (!key) return { at: Date.now(), ok: false, model, name: '', keyTag: '', error: 'API 키가 없습니다' };
    const r = await call(`/models/${encodeURIComponent(model)}`, { key, ws: o.ws, ms: CHECK_MS });
    const st = { at: Date.now(), ok: !!r.ok, model, name: r.ok ? String((r.j && r.j.display_name) || model) : '', keyTag: keyTag(key), error: r.ok ? '' : r.error };
    await setStatus(st, true);
    return st;
  }

  /* 청구 준비 자동 분류 한 번: input = KRX_CLASSIFY.clean(본문) (할 일이 있는 것), o = { key?, model?, timeoutMs? } → { type, ptcl, files, model, ms, usage } (실패면 throw) */
  async function classify(input, o) {
    o = o || {};
    const C = self.KRX_CLASSIFY;
    if (!C) throw new Error('lib/classify-core.js 를 읽지 못했습니다');
    const key = o.key || await getKey();
    if (!key) throw new Error('Claude API 키가 없습니다 — 설정 › LLM 설정 › Claude API');
    const model = modelOf(o.model);
    const { content, schema } = C.build(input);
    const body = { model, max_tokens: MAX_TOKENS, system: C.SYSTEM, messages: [{ role: 'user', content }],
      output_config: { effort: 'low', format: { type: 'json_schema', schema } } };
    if (FALLBACK.has(model)) body.fallbacks = 'default';
    const t0 = Date.now();
    const r = await call('/messages', { key, body, beta: FALLBACK.has(model) ? FALLBACK_BETA : '', ms: o.timeoutMs || CLASSIFY_MS });
    if (!r.ok) {
      if (r.status === 401 || r.status === 403 || r.status === 404) await setStatus({ at: Date.now(), ok: false, model, name: '', keyTag: keyTag(key), error: r.error });
      throw new Error(`Claude API: ${r.error}`);
    }
    const m = r.j || {};
    if (m.stop_reason === 'refusal') throw new Error(`Claude API: Claude 가 이 요청을 거절했습니다${m.stop_details && m.stop_details.category ? ` (${m.stop_details.category})` : ''}`);
    if (m.stop_reason === 'max_tokens') throw new Error('Claude API: 답이 길이 제한에서 잘렸습니다');
    const text = (Array.isArray(m.content) ? m.content : []).filter((b) => b && b.type === 'text').map((b) => String(b.text || '')).join('');
    let out = null;
    try { out = JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch (e) { out = null; }
    if (!out || typeof out !== 'object') throw new Error('Claude API: 답을 읽지 못했습니다');
    await setStatus({ at: Date.now(), ok: true, model, name: '', keyTag: keyTag(key), error: '' });
    return Object.assign(C.parse(input, out), { model: String(m.model || model), ms: Date.now() - t0, usage: m.usage || null });
  }

  /* 참여연구원 변경 도우미 한 번(0.8.9 — Help 서버(Claude CLI)가 없을 때): input = KRX_STAFF_CHAT_CORE.clean(본문), o = { key?, model?(기본 STAFF_MODEL), timeoutMs?, blocks?(첨부 PDF document · 이미지 image 블록 — 글 블록 앞에), core?(프롬프트·스키마·검사 모듈 — 기본 lib/staff-chat-core.js, 연구수당 도우미는 lib/allow-chat-core.js) }
   * → { reply, ops, dropped, model, ms, usage } (실패면 throw). 프롬프트·스키마·검사는 서버와 같은 core — build().system 에 규칙(예산 규칙 · 연구수당 지침), text 에 요약·첨부의 글 */
  async function staff(input, o) {
    o = o || {};
    const C = o.core || self.KRX_STAFF_CHAT_CORE;
    if (!C) throw new Error('lib/staff-chat-core.js 를 읽지 못했습니다');
    const key = o.key || await getKey();
    if (!key) throw new Error('Claude API 키가 없습니다');
    const model = modelOf(o.model || STAFF_MODEL);
    const { text, schema, system } = C.build(input);
    const content = (Array.isArray(o.blocks) ? o.blocks : []).concat([{ type: 'text', text }]);
    const body = { model, max_tokens: MAX_TOKENS, system, messages: [{ role: 'user', content }], output_config: { effort: 'medium', format: { type: 'json_schema', schema } } };
    if (FALLBACK.has(model)) body.fallbacks = 'default';
    const t0 = Date.now();
    const r = await call('/messages', { key, body, beta: FALLBACK.has(model) ? FALLBACK_BETA : '', ms: o.timeoutMs || STAFF_MS });
    if (!r.ok) {
      if (r.status === 401 || r.status === 403 || r.status === 404) await setStatus({ at: Date.now(), ok: false, model, name: '', keyTag: keyTag(key), error: r.error });
      throw new Error(`Claude API: ${r.error}`);
    }
    const m = r.j || {};
    if (m.stop_reason === 'refusal') throw new Error(`Claude API: Claude 가 이 요청을 거절했습니다${m.stop_details && m.stop_details.category ? ` (${m.stop_details.category})` : ''}`);
    if (m.stop_reason === 'max_tokens') throw new Error('Claude API: 답이 길이 제한에서 잘렸습니다');
    const txt = (Array.isArray(m.content) ? m.content : []).filter((b) => b && b.type === 'text').map((b) => String(b.text || '')).join('');
    let out = null;
    try { out = JSON.parse(txt.trim().replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch (e) { out = null; }
    if (!out || typeof out !== 'object') throw new Error('Claude API: 답을 읽지 못했습니다');
    await setStatus({ at: Date.now(), ok: true, model, name: '', keyTag: keyTag(key), error: '' });
    return Object.assign(C.parse(input, out), { model: String(m.model || model), ms: Date.now() - t0, usage: m.usage || null });
  }

  return { KEY, WS, STATUS, MODELS, DEFAULT_MODEL, STAFF_MODEL, modelOf, keyTag, mask, getKey, getWs, status, check, classify, staff };
})();
