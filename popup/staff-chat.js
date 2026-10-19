/* 참여연구원 변경 탭(popup.html#tab&page=staff&only=staff — html.krext-only)의 오른쪽 **변경 도우미** 채팅 (0.8.8, 2026-10-19 사용자 "여기 우측에 LLM 에이전트 채팅창을 붙여주고, 참여연구원 변경 사항에 대한 작업요청을 대신 해 줄 수 있도록 해줘. 이건 LLM 이 연결된 경우에만 작업할 수 있도록").
 * 글로 적은 요청("문창재 11월부터 25%로", "김거화 12월 제외", "부족금을 문창재에게 다 줘", "홍길동 참여 추가, 7월부터 20%, 월급여 6,000")을 이 PC 의 Help 서버(help-server/server.js POST /staff → help-server/staff-chat.js, claude -p 한 번)에
 * 보고 있는 과제·연차 계획의 요약(lib/staff-ui.js bind().agent.snapshot — 이름·역할·월급여·월별 지급·참여율·예산·부족금·rERP 등록·알림)과 이전 대화 몇 줄을 붙여 보내면, Claude 가 답 한두 문장(reply)과 작업 목록(ops)을 돌려주고
 * 이 스크립트가 agent.apply(ops) 로 화면의 계획에 차례대로 반영한다(계산·저장·변경이력·공유 요청은 표의 칸·✎ 폼과 같은 길). 답과 반영 결과(작업마다 ✔/✖ 와 메시지 한 줄)를 말풍선으로 보인다. 프롬프트·스키마·검사는 lib/staff-chat-core.js.
 * **LLM 이 연결돼 있을 때만**: storage.local.llmStatus(lib/llm.js — 백그라운드 'llmProbe')가 ok 이고 그 서버에 /staff 가 있을 때(/health 의 staff 모델). 아니면 입력란을 막고 까닭(서버 실행 안내 · 이전 버전 서버)을 보인다. 열 때·[연결 확인]·서버 연결 실패 뒤에 확인하고 llmStatus 가 바뀌면 따라간다.
 * 대화는 storage.local.staffChat = { turns:[{ role:'user'|'assistant', text, at, results?[{ ok, text, msg }], dropped?, model?, error? }] }(최대 60 줄, 쓰던 글은 staffChatDraft) — [새 대화]로 지움(계획은 그대로). 요청마다 계획 요약을 새로 보내므로 서버 쪽 대화 세션은 없다.
 * 열고 닫기(2026-10-19 사용자 "에이전트 버튼을 누르면 나오도록"): 탭 제목 줄의 [에이전트] 단추(lib/staff-ui.js focusTitle, data-act="st-agent" → popup.js → toggle())로 — 기본은 닫힘, 열림 여부는 staffChat.open 에 남겨 다음에 열 때 그대로. state.staffChatOpen 에 두어 단추의 눌림 표시(aria-pressed)가 따라간다.
 * popup.js 가 브라우저 탭일 때 KRX_STAFF_CHAT.init({ api(staffApi), state, draw }) 로 잇고 applyHash 가 show(only) 로 이 탭에서 쓸 수 있는지 정한다. 서버 주소는 설정 help.url(이 PC 만, popup/help.js 와 같은 규칙) */
(() => {
  const KEY = 'staffChat', DRAFT = 'staffChatDraft', DEFAULT_URL = 'http://127.0.0.1:8106', MAX_TURNS = 60, HISTORY = 8, ASK_MS = 180000;
  const $ = (id) => document.getElementById(id);
  const box = $('staffChat'), logEl = $('scLog'), form = $('scForm'), input = $('scText'), btnSend = $('scSend'), btnNew = $('scNew'), btnProbe = $('scProbe'), statusEl = $('scStatus'), hintEl = $('scHint');
  if (!box || !form || !input || !logEl) return;
  let H = null, base = DEFAULT_URL, llm = null, turns = [], busy = false, probing = false, avail = false /* 참여연구원 변경 탭(only=staff)인가 */, open = false /* [에이전트] 로 열었나 */;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hhmm = (t) => { const d = new Date(t || Date.now()); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const connected = () => !!(llm && llm.ok && llm.url === base && llm.staff);
  const opTextOf = (op) => { try { return self.KRX_STAFF_CHAT_CORE ? KRX_STAFF_CHAT_CORE.opText(op) : String(op && op.op || ''); } catch (e) { return String(op && op.op || ''); } };
  const save = () => { try { chrome.storage.local.set({ [KEY]: { turns: turns.slice(-MAX_TURNS), open } }); } catch (e) {} };
  /* 보이기 — 이 탭에서 쓸 수 있고(avail) [에이전트] 로 열었을 때(open)만. 단추의 눌림 표시는 state.staffChatOpen 으로(바뀌었을 때만 다시 그림) */
  function paint() {
    box.hidden = !(avail && open);
    if (H && H.state && !!H.state.staffChatOpen !== open) { H.state.staffChatOpen = open; if (typeof H.draw === 'function') H.draw(); }
  }

  async function api(path, body) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ASK_MS);
    let res;
    try { res = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ac.signal }); }
    catch (e) { clearTimeout(t); return e && e.name === 'AbortError' ? { ok: false, kind: 'timeout', error: `Help 서버의 답이 너무 늦습니다 (${Math.round(ASK_MS / 1000)}초)` } : { ok: false, kind: 'offline', error: `Help 서버에 연결할 수 없습니다 (${base}) — 이 PC 에서 node help-server/server.js 를 실행하세요` }; }
    clearTimeout(t);
    try { const j = await res.json(); return j && typeof j === 'object' ? j : { ok: false, kind: 'parse', error: '서버 응답을 읽지 못했습니다' }; }
    catch (e) { return { ok: false, kind: 'http', error: `Help 서버 오류 ${res.status} (${base})` }; }
  }

  /* 연결 상태 한 줄 · 안내 글 */
  function statusOf() {
    if (probing && !llm) return { text: '연결 확인 중…', cls: '' };
    if (!llm || !llm.ok) return { text: 'LLM 연결 안 됨', cls: 'err' };
    if (!llm.staff) return { text: 'Help 서버가 이전 버전', cls: 'err' };
    return { text: `연결됨 · ${llm.staff}`, cls: 'ok' };
  }
  function hintOf() {
    if (connected()) return '요청마다 이 과제·연차 계획의 요약(이름·월급여·월별 지급)과 최근 대화가 Help 서버를 거쳐 Claude 로 갑니다. 반영된 변경은 표와 변경이력에 바로 남고, 되돌리려면 표에서 고치거나 다시 요청하세요. R&D ERP 에는 쓰지 않습니다.';
    if (llm && llm.ok && !llm.staff) return 'Help 서버가 참여연구원 변경 도우미가 생기기 전 버전입니다 — 서버를 끄고 다시 node help-server/server.js 를 실행한 뒤 [연결 확인].';
    return `LLM(Help 서버)이 연결돼 있을 때만 쓸 수 있습니다 — 이 PC 에서 node help-server/server.js 를 실행한 뒤 [연결 확인] (${base}). 준비물은 CLAUDE.md.`;
  }
  function bubble(t) {
    if (t.role === 'user') return `<div class="sc-msg user">${esc(t.text)}<div class="sc-time">${hhmm(t.at)}</div></div>`;
    const ops = (t.results || []).map((r) => `<li class="${r.ok ? 'ok' : 'bad'}">${esc(r.text)}${r.msg ? `<small>${esc(r.msg)}</small>` : ''}</li>`).join('');
    const foot = [hhmm(t.at), t.model ? esc(t.model) : '', t.dropped ? `읽을 수 없는 작업 ${t.dropped}개는 버림` : ''].filter(Boolean).join(' · ');
    return `<div class="sc-msg bot${t.error ? ' err' : ''}">${esc(t.text)}${ops ? `<ul class="sc-ops">${ops}</ul>` : ''}<div class="sc-time">${foot}</div></div>`;
  }
  function render() {
    const st = statusOf();
    statusEl.textContent = st.text; statusEl.className = `sc-status ${st.cls}`;
    statusEl.title = llm ? (llm.ok ? `${llm.url}${llm.model ? ` · Help Chat ${llm.model}` : ''}${llm.cli ? ` · claude ${llm.cli}` : ''}` : llm.error || '') : '';
    const on = connected();
    input.disabled = !on || busy; btnSend.disabled = !on || busy; btnNew.disabled = busy || !turns.length; btnProbe.disabled = probing;
    input.placeholder = busy ? '처리 중…' : on ? '예) 문창재 11월부터 25%로 · 김거화 12월 제외 · 홍길동 참여 추가, 7월부터 20%, 월급여 6,000 — Enter 로 보내기, Shift+Enter 줄 바꿈' : 'LLM 연결 안 됨';
    hintEl.textContent = hintOf();
    const stick = logEl.scrollTop + logEl.clientHeight >= logEl.scrollHeight - 12;
    logEl.innerHTML = (turns.length ? turns.map(bubble).join('') : '<div class="sc-empty">보고 있는 과제·연차의 참여연구원 계획을 글로 바꿔 달라고 하세요. 예) "문창재 11월부터 25%로", "김거화 10~12월 제외하고 부족금은 문창재에게", "홍길동 참여연구원으로 추가, 7월부터 20%, 월급여 6,000", "rERP 현재로 초기화". 누구·언제·얼마가 빠지면 되묻습니다.</div>')
      + (busy ? '<div class="sc-msg bot sc-wait">⏳ 생각하는 중…</div>' : '');
    if (stick || busy) logEl.scrollTop = logEl.scrollHeight;
  }

  async function send() {
    const text = input.value.trim();
    if (!text || busy || !connected()) return;
    const snap = H && H.api && H.api.agent ? H.api.agent.snapshot() : null;
    if (!snap) { turns.push({ role: 'assistant', text: '보고 있는 과제가 없습니다 — 과제 목록이 조회된 뒤 다시 보내세요.', at: Date.now(), error: true }); save(); render(); return; }
    const history = turns.slice(-HISTORY).map((t) => ({ role: t.role, text: t.role === 'user' ? t.text : [t.text, (t.results || []).length ? `(반영: ${t.results.map((r) => `${r.ok ? '' : '실패 — '}${r.text}`).join(' · ')})` : ''].filter(Boolean).join(' ') }));
    turns.push({ role: 'user', text, at: Date.now() });
    input.value = ''; try { chrome.storage.local.remove(DRAFT); } catch (e) {}
    busy = true; save(); render();
    const r = await api('/staff', { text, history, snapshot: snap });
    let turn;
    if (r.ok) {
      let results = [];
      if (Array.isArray(r.ops) && r.ops.length) {
        try { results = await H.api.agent.apply(r.ops); }
        catch (e) { results = [{ ok: false, text: '반영', msg: String((e && e.message) || e) }]; }
      }
      turn = { role: 'assistant', text: r.reply || (results.length ? '반영했습니다.' : '(답이 없습니다)'), at: Date.now(), results, dropped: Number(r.dropped) || 0, model: r.model || '' };
    } else turn = { role: 'assistant', text: `실패 — ${r.error || '응답 없음'}`, at: Date.now(), error: true };
    turns.push(turn); busy = false; save(); render();
    if (!r.ok && r.kind === 'offline') probe(true);   // 서버가 내려갔으면 상태 줄도 바로
    if (connected()) input.focus();
  }
  /* 백그라운드에 연결 확인(lib/llm.js — storage.local.llmStatus 도 갱신) */
  async function probe(force) {
    probing = true; render();
    try { const r = await chrome.runtime.sendMessage({ type: 'llmProbe', url: base, force: !!force }); if (r && typeof r.ok === 'boolean') llm = r; } catch (e) {}
    probing = false; render();
  }
  const opsOf = (ops) => (Array.isArray(ops) ? ops : []).map((op) => Object.assign({ text: opTextOf(op) }, op));   // 테스트·디버깅용 (반영 결과의 글)

  form.addEventListener('submit', (ev) => { ev.preventDefault(); send(); });
  input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); send(); } });
  input.addEventListener('input', () => { try { chrome.storage.local.set({ [DRAFT]: input.value }); } catch (e) {} });
  btnNew.addEventListener('click', () => { if (busy) return; turns = []; save(); render(); if (connected()) input.focus(); });
  btnProbe.addEventListener('click', () => probe(true));
  try {
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area !== 'local') return;
      if (ch.llmStatus) { const v = ch.llmStatus.newValue; if (v && v.url === base) { llm = v; render(); } }   // 패널·설정 페이지·백그라운드가 확인한 결과도 반영
      if (ch[KEY] && !busy) { const v = ch[KEY].newValue; const next = v && Array.isArray(v.turns) ? v.turns : []; if (JSON.stringify(next) !== JSON.stringify(turns)) { turns = next; render(); } }   // 다른 탭의 같은 대화
    });
  } catch (e) {}

  async function init(hooks) {
    H = hooks || {};
    try {
      let s = null;
      try { s = (await chrome.storage.sync.get('settings')).settings; } catch (e) {}
      if (!s) { try { s = (await chrome.storage.local.get('settings')).settings; } catch (e) {} }
      const u = String(((s && s.help) || {}).url || '').trim().replace(/\/+$/, '');
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(u)) base = u;
    } catch (e) {}
    try {
      const l = await chrome.storage.local.get([KEY, DRAFT, 'llmStatus']);
      turns = l[KEY] && Array.isArray(l[KEY].turns) ? l[KEY].turns : [];
      open = !!(l[KEY] && l[KEY].open);
      if (l[DRAFT] && !input.value) input.value = String(l[DRAFT]);
      if (l.llmStatus && l.llmStatus.url === base) llm = l.llmStatus;
    } catch (e) {}
    render(); paint();
    if (open) probe(false);
  }
  function show(on) { avail = !!on; paint(); }
  /* [에이전트] 단추 — 열기/닫기(on 을 주면 그대로). 열 때 연결 상태를 다시 보고(30초 캐시) 입력란에 초점 */
  function toggle(on) {
    open = on == null ? !open : !!on;
    save(); paint();
    if (open) { probe(false).then(() => { if (connected()) input.focus(); }); }
  }
  self.KRX_STAFF_CHAT = { init, show, toggle, isOpen: () => open, send, probe, opsOf };
})();
