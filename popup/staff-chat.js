/* 참여연구원 변경 탭(popup.html#tab&page=staff&only=staff — html.krext-only)의 오른쪽 **변경 도우미** 채팅 (0.8.8, 2026-10-19 사용자 "여기 우측에 LLM 에이전트 채팅창을 붙여주고, 참여연구원 변경 사항에 대한 작업요청을 대신 해 줄 수 있도록 해줘. 이건 LLM 이 연결된 경우에만 작업할 수 있도록").
 * 글로 적은 요청("문창재 11월부터 25%로", "김거화 12월 제외", "부족금을 문창재에게 다 줘", "홍길동 참여 추가, 7월부터 20%, 월급여 6,000")을 이 PC 의 Help 서버(help-server/server.js POST /staff → help-server/staff-chat.js, claude -p 한 번)에
 * 보고 있는 과제·연차 계획의 요약(lib/staff-ui.js bind().agent.snapshot — 이름·역할·월급여·월별 지급·참여율·예산·부족금·rERP 등록·알림)과 이전 대화 몇 줄을 붙여 보내면, Claude 가 답 한두 문장(reply)과 작업 목록(ops)을 돌려주고
 * 이 스크립트가 agent.apply(ops) 로 화면의 계획에 차례대로 반영한다(계산·저장·변경이력·공유 요청은 표의 칸·✎ 폼과 같은 길). 답과 반영 결과(작업마다 ✔/✖ 와 메시지 한 줄)를 말풍선으로 보인다. 프롬프트·스키마·검사는 lib/staff-chat-core.js.
 * 연결(0.8.9, 2026-10-21 사용자 "에이전트에는 Claude CLI 를 기본 연결할 수 있게 설정해주고 연결되지 않을 경우 연결 방법에 대한 프롬프트를 추가해주고. API 키를 넣는 설정칸도 넣어줘"):
 *   기본은 **Claude CLI** — storage.local.llmStatus(lib/llm.js — 백그라운드 'llmProbe')가 ok 이고 그 서버에 /staff 가 있을 때(/health 의 staff 모델). 열 때·[연결 확인]·서버 연결 실패 뒤에 확인하고 llmStatus 가 바뀌면 따라간다.
 *   안 붙으면 안내 카드에 서버 실행 방법 · [설정 프롬프트 복사](lib/help-setup.js — 저장소 폴더에서 연 Claude Code 에 붙여 넣는 글) · **Claude API 키** 칸(storage.local.claudeApiKey — 설정 페이지 › LLM 설정 › Claude API 와 같은 키)을 둔다.
 *   키가 있고 설정 help.api.use 가 off 가 아니면 서버 없이 lib/claude-api.js staff()(모델 API_MODEL — 서버 기본과 같음)로 보낸다(always 면 서버가 있어도 API 먼저). 상태 줄에 어느 길인지 보인다(연결됨 · Claude CLI / Claude API).
 * 첨부(0.8.9, 2026-10-21 사용자 "엑셀, 워드, PDF, HWP/X, 이미지를 첨부할 수 있게 해줘. HWP 인 경우 HWPX 로 변환해야 할거 같고.. 이미지는 OCR 를 하면 될거 같아"): 📎 단추·끌어다 놓기로 FILE_MAX 개까지 —
 *   xlsx·docx·hwpx·hwp·txt/csv 는 보내기 전에 lib/doc-text.js 로 글을 뽑고(HWP 는 변환 없이 바로 읽음), PDF·이미지(가로 IMG_W px JPEG 로 줄임)는 내용째 보내 Claude 가 본다(서버: 작업 폴더에 써 두고 Read 로 — 이미지는 글자를 읽는 OCR 구실, API: document·image 블록).
 *   첨부는 보내면 비워지고 말풍선에 이름만 남는다. 서버 길에서는 /health 의 staffFiles 가 있는(0.8.9 이후) 서버라야 📎 가 켜진다.
 * 예산 규칙(2026-10-20 사용자 "이 에이전트에 claude.md … 예산에 대해서만 참고할 만한 프롬프트를 넣고 관리할 수 있도록"): 머리의 [규칙]이 대화 자리에 편집란을 연다 — storage.local.staffRules(저장한 적 없으면 lib/staff-chat-core.js DEFAULT_RULES, 비우고 저장하면 안 보냄)를 요청마다 rules 로 보내 서버·API 가 시스템 프롬프트 뒤에 붙인다. 모든 과제 공통, 이 브라우저에만.
 * 대화는 storage.local.staffChat = { turns:[{ role:'user'|'assistant', text, at, files?[이름], results?[{ ok, text, msg }], dropped?, model?, via?, error? }] }(최대 60 줄, 쓰던 글은 staffChatDraft) — [새 대화]로 지움(계획은 그대로). 요청마다 계획 요약을 새로 보내므로 서버 쪽 대화 세션은 없다.
 * 열고 닫기(2026-10-19 사용자 "에이전트 버튼을 누르면 나오도록"): 탭 제목 줄의 [에이전트] 단추(lib/staff-ui.js focusTitle, data-act="st-agent" → popup.js → toggle())로 — 기본은 닫힘, 열림 여부는 staffChat.open 에 남겨 다음에 열 때 그대로. state.staffChatOpen 에 두어 단추의 눌림 표시(aria-pressed)가 따라간다.
 * popup.js 가 브라우저 탭일 때 KRX_STAFF_CHAT.init({ api(staffApi), state, draw }) 로 잇고 applyHash 가 show(only) 로 이 탭에서 쓸 수 있는지 정한다. 서버 주소는 설정 help.url(이 PC 만, popup/help.js 와 같은 규칙). 테스트: node tests/staff-chat-ui.test.js */
(() => {
  const KEY = 'staffChat', DRAFT = 'staffChatDraft', RULES = 'staffRules', API_KEY = 'claudeApiKey', DEFAULT_URL = 'http://127.0.0.1:8106', MAX_TURNS = 60, HISTORY = 8, ASK_MS = 180000;
  const API_MODEL = 'claude-opus-5-5';   // Claude API 길의 모델 — 서버(KRX_HELP_STAFF_MODEL 기본)와 같음
  const FILE_MAX = 6, FILE_BYTES = 12 * 1024 * 1024, PDF_BYTES = 10 * 1024 * 1024, IMG_W = 1600;
  const $ = (id) => document.getElementById(id);
  const box = $('staffChat'), logEl = $('scLog'), form = $('scForm'), input = $('scText'), btnSend = $('scSend'), btnNew = $('scNew'), btnProbe = $('scProbe'), statusEl = $('scStatus'), hintEl = $('scHint');
  const connectionEl = $('scConnection'), helpEl = $('scHelpText'), helpLabel = $('scHelpLabel'), btnClose = $('scClose');
  const rulesBox = $('scRulesBox'), rulesText = $('scRulesText'), rulesStatus = $('scRulesStatus'), btnRules = $('scRules'), btnRulesSave = $('scRulesSave'), btnRulesDefault = $('scRulesDefault');
  const connCard = $('scConnCard'), connTitle = $('scConnTitle'), connText = $('scConnText'), connActs = $('scConnActs'), btnSetup = $('scSetup'), setupNoteEl = $('scSetupNote'), apiKeyEl = $('scApiKey'), btnApiSave = $('scApiSave'), apiNoteEl = $('scApiNote');
  const composeEl = $('scCompose'), filesEl = $('scFiles'), btnAttach = $('scAttach'), fileEl = $('scFile');
  if (!box || !form || !input || !logEl) return;
  let H = null, base = DEFAULT_URL, llm = null, turns = [], busy = false, probing = false, avail = false /* 참여연구원 변경 탭(only=staff)인가 */, open = false /* [에이전트] 로 열었나 */, rules /* storage.local.staffRules — undefined 면 기본 글 */, rulesOpen = false;
  let apiUse = 'auto' /* 설정 help.api.use: auto(서버가 없을 때만) · always · off */, apiKey = '' /* storage.local.claudeApiKey */, pending = [] /* 보낼 첨부 File[] */, note = '' /* 입력란 밑 한 줄(첨부 안내) */, setupNote = '', apiNote = '';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hhmm = (t) => { const d = new Date(t || Date.now()); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const fmtSize = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);
  const core = () => self.KRX_STAFF_CHAT_CORE || null;
  const docText = () => self.KRX_DOC_TEXT || null;
  const claudeApi = () => (typeof KRX_CLAUDE_API !== 'undefined' ? KRX_CLAUDE_API : null);   // lib/claude-api.js 는 최상위 const — self.KRX_CLAUDE_API 로는 안 보임(2026-10-21 실측)
  const serverOn = () => !!(llm && llm.ok && llm.url === base && llm.staff);
  const apiOn = () => !!(apiKey && apiUse !== 'off' && claudeApi());
  /* 어느 길로 보내나: 'server'(Claude CLI — 기본) · 'api'(Claude API 키 — 서버가 없거나 설정이 "항상") · ''(연결 없음) */
  const route = () => (apiUse === 'always' && apiOn() ? 'api' : serverOn() ? 'server' : apiOn() ? 'api' : '');
  const connected = () => !!route();
  const canAttach = () => { const r = route(); return !!r && !busy && (r !== 'server' || !!llm.staffFiles); };
  const opTextOf = (op) => { try { return core() ? KRX_STAFF_CHAT_CORE.opText(op) : String(op && op.op || ''); } catch (e) { return String(op && op.op || ''); } };
  const defaultRules = () => (core() && KRX_STAFF_CHAT_CORE.DEFAULT_RULES) || '';
  const rulesNow = () => (typeof rules === 'string' ? rules : defaultRules());   // 요청마다 붙는 예산 규칙
  const setRulesStatus = (t) => { if (rulesStatus) rulesStatus.textContent = t || ''; };
  const mask = (k) => { try { if (claudeApi() && claudeApi().mask) return claudeApi().mask(k); } catch (e) {} return k ? `…${String(k).slice(-4)}` : ''; };
  const save = () => { try { chrome.storage.local.set({ [KEY]: { turns: turns.slice(-MAX_TURNS), open } }); } catch (e) {} };
  const saveDraft = () => { try { chrome.storage.local.set({ [DRAFT]: input.value }); } catch (e) {} };
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
  /* Claude API 길 — 첨부의 PDF·이미지는 블록으로, 글은 요청에 (lib/claude-api.js staff → 같은 프롬프트·스키마·검사) */
  async function askApi(text, history, snap, files) {
    const C = core(), A = claudeApi();
    if (!C || !A || !A.staff) return { ok: false, kind: 'api', error: 'Claude API 모듈이 없습니다 — 확장을 다시 올리세요' };
    const blocks = [];
    const meta = files.map((f) => {
      if (!f.data) return f;
      blocks.push(f.kind === 'image' ? { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: f.data } } : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.data } });
      return Object.assign({}, f, { data: '', attached: true });
    });
    let inp;
    try { inp = C.clean({ text, history, snapshot: snap, rules: rulesNow(), files: meta }); } catch (e) { return { ok: false, kind: 'api', error: String((e && e.message) || e) }; }
    try { return Object.assign({ ok: true, via: 'api' }, await A.staff(inp, { key: apiKey, model: API_MODEL, timeoutMs: ASK_MS, blocks })); }
    catch (e) { return { ok: false, kind: 'api', error: String((e && e.message) || e) }; }
  }

  /* 연결 상태 한 줄 · 안내 글 */
  function statusOf() {
    if (probing) return { text: '연결 확인 중', cls: 'pending' };
    const r = route();
    if (r === 'server') return { text: '연결됨 · Claude CLI', cls: 'ok' };
    if (r === 'api') return { text: `연결됨 · Claude API${serverOn() ? '' : ' (CLI 미연결)'}`, cls: 'ok' };
    if (llm && llm.ok && llm.url === base && !llm.staff) return { text: '업데이트 필요', cls: 'err' };
    return { text: '연결 필요', cls: 'err' };
  }
  function helpOf() {
    const r = route();
    const common = '반영된 변경은 표와 변경이력에 바로 남고, 되돌리려면 표에서 고치거나 다시 요청하세요. R&D ERP 에는 쓰지 않습니다. 머리의 [규칙]에 적은 예산 규칙과 📎 첨부(엑셀·워드·HWP/HWPX 는 글로, PDF·이미지는 내용째)도 함께 갑니다.';
    if (r === 'server') return `요청마다 이 과제·연차 계획의 요약(이름·월급여·월별 지급)과 최근 대화가 Help 서버(Claude CLI)를 거쳐 Claude 로 갑니다. ${common}`;
    if (r === 'api') return `Help 서버(Claude CLI)가 없어 저장된 Claude API 키로 api.anthropic.com 에 직접 보냅니다(모델 ${API_MODEL}, 사용량은 그 키에 과금). ${common}`;
    if (llm && llm.ok && llm.url === base && !llm.staff) return 'Help 서버가 참여연구원 변경 도우미가 생기기 전 버전입니다 — 서버를 끄고 다시 node help-server/server.js 를 실행한 뒤 [연결 확인].';
    return `기본 연결은 이 PC 의 Claude Code CLI(Help 서버)입니다 — 저장소 폴더에서 node help-server/server.js 를 실행한 뒤 [연결 확인] (${base}). 준비물은 CLAUDE.md, 처음이면 [설정 프롬프트 복사]. 서버 없이 쓰려면 위 칸에 Claude API 키를 저장하세요.`;
  }
  /* Claude Code 에 붙여 넣는 설정 프롬프트 (popup/help.js 와 같은 글 — lib/help-setup.js 가 없으면 짧게) */
  function setupText() {
    const o = { url: base, from: '참여연구원 변경 도우미', reason: llm && !llm.ok ? llm.error || '' : '' };
    try { o.version = chrome.runtime.getManifest().version; } catch (e) {}
    try { if (self.KRX_HELP_SETUP) return KRX_HELP_SETUP.prompt(o); } catch (e) {}
    return `[KR eClass + R&D ERP 현황 확장 — Help 서버(LLM) 연결 설정]\n이 폴더(kr_ext_rerp 저장소)의 CLAUDE.md "Help Chat (help-server) 을 쓸 때 필요한 것" 절을 따라 준비물(Node 22 이상 · git · Claude Code CLI 2.1.280 이상과 로그인)을 확인하고, 별도 터미널에서 node help-server/server.js 를 띄운 뒤 ${base}/health 로 확인해 주세요. 확장 코드 수정·커밋은 하지 마세요.`;
  }
  /* 연결 안내 카드(popup.html 의 고정 틀 — 글만 바꿈): Claude CLI 가 안 붙었을 때 서버 실행 방법 · 설정 프롬프트 · Claude API 키 칸 */
  function renderConnection() {
    if (!connectionEl) return;
    connectionEl.hidden = connected() && !probing;
    const oldServer = llm && llm.ok && llm.url === base && !llm.staff;
    if (connCard) connCard.className = `sc-connect-card${probing ? ' checking' : ''}`;
    if (connTitle) connTitle.textContent = probing ? '도우미 연결을 확인하고 있어요' : oldServer ? 'Help 서버를 업데이트해 주세요' : 'Claude CLI(Help 서버)에 연결되지 않았어요';
    if (connText) connText.textContent = probing ? '잠시만 기다려 주세요.' : oldServer ? '서버를 끄고 저장소 폴더에서 다시 node help-server/server.js 를 실행한 뒤 위 [연결 확인]을 누르세요.'
      : `기본 연결은 이 PC 의 Claude Code CLI 예요. 저장소 폴더에서 터미널을 열고 node help-server/server.js 를 실행한 뒤 위 [연결 확인]을 누르세요 (${base}). 처음이면 [설정 프롬프트 복사]를 저장소 폴더에서 연 Claude Code 에 붙여 넣으면 준비물 확인부터 서버 실행까지 안내해요.`;
    if (connActs) connActs.hidden = probing;
    if (setupNoteEl) setupNoteEl.textContent = setupNote;
    if (apiNoteEl) apiNoteEl.textContent = apiNote || (apiUse === 'off' ? '설정 › LLM 설정 › Claude API 가 "사용 안 함"이라 키가 있어도 쓰지 않아요.' : !claudeApi() ? 'Claude API 모듈을 읽지 못했어요 — 확장을 다시 올리세요.' : apiKey ? `저장된 키 ${mask(apiKey)} — 서버가 없으면 이 키로 보내요 (모델 ${API_MODEL}, 그 키에 과금).` : '키를 넣고 저장하면 서버 없이 바로 쓸 수 있어요 — 이 브라우저에만 저장되고 설정 › LLM 설정의 Claude API 와 같은 키예요.');
  }
  function emptyState() {
    const examples = [
      ['참여율 조정', '문창재 11월부터 참여율을 25%로 바꿔줘'],
      ['참여 기간 변경', '김거화 10~12월 참여를 제외해줘'],
      ['연구원 추가', '홍길동을 참여연구원으로 추가해줘. 7월부터 20%, 월급여 6,000']
    ];
    const disabled = !connected() || busy;
    const cards = examples.map(([label, text]) => `<button type="button" class="sc-example" data-sc-example="${esc(text)}"${disabled ? ' disabled' : ''} title="${disabled ? '도우미 연결 후 사용할 수 있어요' : '입력란에 예시 넣기'}"><small>${label}</small><span>${esc(text)}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg></button>`).join('');
    return `<div class="sc-empty"><div class="sc-empty-icon" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m16 5 2.7 7.3L26 15l-7.3 2.7L16 25l-2.7-7.3L6 15l7.3-2.7L16 5Zm10-1v5m-2.5-2.5h5M7 23v5m-2.5-2.5h5"/></svg></div><h2>어떤 계획을 바꿀까요?</h2><p>이 과제의 참여연구원 계획을 글로 요청하세요.<br>누구를, 언제부터, 얼마나 바꿀지 알려 주세요. 공문·명세서(엑셀·워드·PDF·HWP·이미지)는 📎 로 붙이세요.</p><div class="sc-examples">${cards}</div><small class="sc-example-note">예시를 선택하고 내 계획에 맞게 수정하세요.</small></div>`;
  }
  function bubble(t) {
    const files = t.files && t.files.length ? `<div class="sc-msg-files">📎 ${t.files.map(esc).join(' · ')}</div>` : '';
    if (t.role === 'user') return `<div class="sc-msg user">${esc(t.text)}${files}<div class="sc-time">${hhmm(t.at)}</div></div>`;
    const ops = (t.results || []).map((r) => `<li class="${r.ok ? 'ok' : 'bad'}">${esc(r.text)}${r.msg ? `<small>${esc(r.msg)}</small>` : ''}</li>`).join('');
    const foot = [hhmm(t.at), t.model ? esc(t.model) : '', t.via === 'api' ? 'Claude API' : '', t.dropped ? `읽을 수 없는 작업 ${t.dropped}개는 버림` : ''].filter(Boolean).join(' · ');
    return `<div class="sc-msg bot${t.error ? ' err' : ''}">${esc(t.text)}${ops ? `<ul class="sc-ops">${ops}</ul>` : ''}<div class="sc-time">${foot}</div></div>`;
  }
  function renderFiles() {
    if (!filesEl) return;
    filesEl.hidden = !pending.length;
    filesEl.innerHTML = pending.map((f, i) => `<span class="sc-file"><span class="sc-file-name" title="${esc(f.name)}">${esc(f.name)}</span><small>${fmtSize(f.size)}</small><button type="button" class="sc-file-x" data-sc-file="${i}" aria-label="${esc(f.name)} 빼기" title="빼기"${busy ? ' disabled' : ''}>×</button></span>`).join('');
  }
  function render() {
    const st = statusOf();
    statusEl.textContent = st.text; statusEl.className = `sc-status ${st.cls}`;
    statusEl.title = llm ? (llm.ok ? `${llm.url}${llm.model ? ` · Help Chat ${llm.model}` : ''}${llm.cli ? ` · claude ${llm.cli}` : ''}` : llm.error || '') : '';
    const on = connected();
    input.disabled = !on || busy; btnSend.disabled = !on || busy; btnNew.disabled = busy || !turns.length; btnProbe.disabled = probing;
    input.placeholder = busy ? '계획을 변경하고 있어요…' : on ? '변경할 내용을 입력하세요' : '연결 후 요청할 수 있어요';
    hintEl.textContent = note || (busy ? '요청을 처리하고 있어요. 잠시만 기다려 주세요.' : on ? '요청한 변경은 현재 계획에 반영됩니다.' : '연결 후 예시를 선택해 시작할 수 있어요.');
    if (helpEl) helpEl.textContent = helpOf();
    if (helpLabel) helpLabel.textContent = on ? '반영 안내' : '연결 방법';
    renderConnection();
    if (rulesBox) rulesBox.hidden = !rulesOpen;
    if (btnRules) { btnRules.ariaPressed = String(rulesOpen); btnRules.title = rulesOpen ? '규칙 편집란 닫기' : `예산 규칙 — 요청마다 Claude 에 함께 보내는 참고 글${typeof rules !== 'string' ? ' (기본 글)' : rules.trim() ? ' (고친 글)' : ' (비움 — 보내지 않음)'}`; }
    if (btnAttach) { const ok = canAttach(); btnAttach.disabled = !ok; btnAttach.title = ok ? `파일 첨부 — 엑셀(xlsx) · 워드(docx) · PDF · HWP/HWPX · 이미지 · 글 파일, ${FILE_MAX}개까지 (끌어다 놓아도 됨)` : route() === 'server' && !llm.staffFiles ? 'Help 서버가 이전 버전이라 첨부를 받지 못해요 — 서버를 끄고 다시 node help-server/server.js' : '연결 후 첨부할 수 있어요'; }
    renderFiles();
    const stick = logEl.scrollTop + logEl.clientHeight >= logEl.scrollHeight - 12;
    logEl.innerHTML = (turns.length ? turns.map(bubble).join('') : emptyState())
      + (busy ? '<div class="sc-msg bot sc-wait"><span class="sc-wait-dots" aria-hidden="true"><i></i><i></i><i></i></span>계획을 확인하고 있어요…</div>' : '');
    if (!turns.length) logEl.scrollTop = 0;
    else if (stick || busy) logEl.scrollTop = logEl.scrollHeight;
  }

  /* 첨부 — 목록에 더하기(종류·크기·개수 검사) */
  function addFiles(list) {
    const D = docText();
    note = '';
    for (const f of Array.from(list || [])) {
      if (pending.length >= FILE_MAX) { note = `첨부는 ${FILE_MAX}개까지예요.`; break; }
      const kind = D ? D.kindOf(f.name, f.type) : '';
      if (!kind) { note = `${f.name}: 엑셀(xlsx)·워드(docx)·PDF·HWP/HWPX·이미지·글 파일만 붙일 수 있어요.`; continue; }
      if (f.size > FILE_BYTES) { note = `${f.name}: 파일이 ${fmtSize(FILE_BYTES)} 를 넘어요.`; continue; }
      if (pending.some((p) => p.name === f.name && p.size === f.size)) continue;
      pending.push(f);
    }
    render();
  }
  const b64Of = (buf) => { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
  /* 이미지 → 가로 IMG_W 까지 JPEG (글자 읽기는 Claude 가 — lib/prep-ai.js shrink 와 같은 길) */
  async function shrinkImage(f) {
    const bmp = await createImageBitmap(f);
    try {
      const k = Math.min(1, IMG_W / bmp.width), w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
      const cv = new OffscreenCanvas(w, h), ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(bmp, 0, 0, w, h);
      return b64Of(await (await cv.convertToBlob({ type: 'image/jpeg', quality: 0.85 })).arrayBuffer());
    } finally { try { bmp.close(); } catch (e) {} }
  }
  /* 보내기 전 첨부 준비: 글은 뽑고(lib/doc-text.js), PDF·이미지는 base64 — 못 읽는 것은 note 만 */
  async function prepFiles(list) {
    const D = docText(), C = core(), max = (C && C.LIMIT.fileText) || 12000, out = [];
    for (const f of list) {
      const kind = D ? D.kindOf(f.name, f.type) : '';
      const rec = { name: f.name, kind, type: f.type || '', size: f.size, text: '', data: '', truncated: false, note: '' };
      try {
        if (kind === 'image') { rec.data = await shrinkImage(f); rec.type = 'image/jpeg'; }
        else if (kind === 'pdf') { if (f.size > PDF_BYTES) rec.note = `PDF 는 ${fmtSize(PDF_BYTES)} 까지`; else rec.data = b64Of(await f.arrayBuffer()); }
        else if (!D) rec.note = '글 뽑기 모듈이 없음 — 확장을 다시 올리세요';
        else { const t = await D.textOf(f.name, await f.arrayBuffer(), f.type); if (t == null) rec.note = '읽을 수 없는 종류'; else { rec.text = t.slice(0, max); rec.truncated = t.length > rec.text.length; if (!rec.text) rec.note = '글이 없음'; } }
      } catch (e) { rec.note = String((e && e.message) || e).slice(0, 200); }
      out.push(rec);
    }
    return out;
  }

  async function send() {
    const text = input.value.trim();
    if ((!text && !pending.length) || busy || !connected()) return;
    const snap = H && H.api && H.api.agent ? H.api.agent.snapshot() : null;
    if (!snap) { turns.push({ role: 'assistant', text: '보고 있는 과제가 없습니다 — 과제 목록이 조회된 뒤 다시 보내세요.', at: Date.now(), error: true }); save(); render(); return; }
    const history = turns.slice(-HISTORY).map((t) => ({ role: t.role, text: t.role === 'user' ? t.text : [t.text, (t.results || []).length ? `(반영: ${t.results.map((r) => `${r.ok ? '' : '실패 — '}${r.text}`).join(' · ')})` : ''].filter(Boolean).join(' ') }));
    const files = pending.slice(); pending = []; note = '';
    const ask = text || '첨부 파일을 보고 이 계획에 반영할 것이 있으면 작업으로 옮겨줘.';
    turns.push({ role: 'user', text: ask, at: Date.now(), files: files.map((f) => f.name) });
    input.value = ''; try { chrome.storage.local.remove(DRAFT); } catch (e) {}
    busy = true; save(); render();
    const r0 = route();
    let r;
    try {
      const prepped = files.length ? await prepFiles(files) : [];
      r = r0 === 'api' ? await askApi(ask, history, snap, prepped) : await api('/staff', { text: ask, history, snapshot: snap, rules: rulesNow(), files: prepped });
    } catch (e) { r = { ok: false, error: String((e && e.message) || e) }; }
    let turn;
    if (r.ok) {
      let results = [];
      if (Array.isArray(r.ops) && r.ops.length) {
        try { results = await H.api.agent.apply(r.ops); }
        catch (e) { results = [{ ok: false, text: '반영', msg: String((e && e.message) || e) }]; }
      }
      turn = { role: 'assistant', text: r.reply || (results.length ? '반영했습니다.' : '(답이 없습니다)'), at: Date.now(), results, dropped: Number(r.dropped) || 0, model: r.model || '', via: r.via === 'api' ? 'api' : '' };
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
  const applySettings = (s) => { const u = String(((s && s.help) || {}).url || '').trim().replace(/\/+$/, ''); if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(u)) base = u; const use = (((s && s.help) || {}).api || {}).use; apiUse = use === 'always' || use === 'off' ? use : 'auto'; };

  form.addEventListener('submit', (ev) => { ev.preventDefault(); send(); });
  input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); send(); } });
  input.addEventListener('input', saveDraft);
  logEl.addEventListener('click', (ev) => {
    const button = ev.target.closest && ev.target.closest('[data-sc-example]');
    if (!button || !connected() || busy) return;
    input.value = button.getAttribute('data-sc-example') || '';
    saveDraft(); input.focus();
  });
  btnNew.addEventListener('click', () => { if (busy) return; turns = []; save(); render(); if (connected()) input.focus(); });
  btnProbe.addEventListener('click', () => probe(true));
  if (btnClose) btnClose.addEventListener('click', () => { saveDraft(); toggle(false); });
  /* 예산 규칙 편집란 — [규칙]으로 열고 닫음(열리면 CSS 가 대화를 가림), [저장]은 storage.local.staffRules(비우고 저장하면 규칙 없이 보냄), [기본값]은 입력란에 기본 글만 */
  if (btnRules) btnRules.addEventListener('click', () => { rulesOpen = !rulesOpen; if (rulesOpen && rulesText) rulesText.value = rulesNow(); setRulesStatus(''); render(); if (rulesOpen && rulesText) rulesText.focus(); });
  if (btnRulesSave) btnRulesSave.addEventListener('click', () => { rules = rulesText ? String(rulesText.value) : ''; try { chrome.storage.local.set({ [RULES]: rules }); } catch (e) {} setRulesStatus(rules.trim() ? '저장했어요 — 다음 요청부터 함께 보냅니다.' : '비워 저장했어요 — 규칙 없이 보냅니다.'); render(); });
  if (btnRulesDefault) btnRulesDefault.addEventListener('click', () => { if (rulesText) { rulesText.value = defaultRules(); rulesText.focus(); } setRulesStatus('기본 글을 넣었어요 — 저장을 누르면 반영됩니다.'); });
  /* 연결 카드 — [설정 프롬프트 복사] · Claude API 키 [저장](비우고 저장하면 지움 — 설정 페이지와 같은 storage.local.claudeApiKey) */
  if (btnSetup) btnSetup.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(setupText()); setupNote = '복사했어요 — 저장소 폴더에서 연 Claude Code 에 붙여 넣으세요.'; }
    catch (e) { setupNote = `복사하지 못했어요: ${String((e && e.message) || e)}`; }
    render();
  });
  if (btnApiSave) btnApiSave.addEventListener('click', async () => {
    const k = apiKeyEl ? String(apiKeyEl.value || '').trim() : '';
    try { if (k) await chrome.storage.local.set({ [API_KEY]: k }); else await chrome.storage.local.remove(API_KEY); } catch (e) {}
    apiKey = k; apiNote = k ? `저장했어요 ${mask(k)} — 서버가 없으면 이 키로 보내요 (모델 ${API_MODEL}).` : '키를 지웠어요.';
    render(); if (connected()) input.focus();
  });
  /* 첨부 — 📎 단추 · 파일 선택 · 끌어다 놓기(입력 구역) · 칩의 × */
  if (btnAttach && fileEl) {
    btnAttach.addEventListener('click', () => { if (canAttach()) fileEl.click(); });
    fileEl.addEventListener('change', () => { addFiles(fileEl.files); fileEl.value = ''; });
  }
  if (composeEl) {
    const hasFiles = (ev) => { try { return Array.from(ev.dataTransfer.types || []).includes('Files'); } catch (e) { return false; } };
    composeEl.addEventListener('dragover', (ev) => { if (!hasFiles(ev) || !canAttach()) return; ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; composeEl.classList.add('sc-drag'); });
    composeEl.addEventListener('dragleave', () => composeEl.classList.remove('sc-drag'));
    composeEl.addEventListener('drop', (ev) => { composeEl.classList.remove('sc-drag'); if (!hasFiles(ev)) return; ev.preventDefault(); if (canAttach()) addFiles(ev.dataTransfer.files); });
  }
  if (filesEl) filesEl.addEventListener('click', (ev) => { const b = ev.target.closest && ev.target.closest('[data-sc-file]'); if (!b || busy) return; pending.splice(Number(b.getAttribute('data-sc-file')), 1); note = ''; render(); });
  try {
    chrome.storage.onChanged.addListener((ch, area) => {
      if (ch.settings && (area === 'sync' || area === 'local')) { applySettings(ch.settings.newValue); render(); }   // 서버 주소 · Claude API 사용 방식
      if (area !== 'local') return;
      if (ch.llmStatus) { const v = ch.llmStatus.newValue; if (v && v.url === base) { llm = v; render(); } }   // 패널·설정 페이지·백그라운드가 확인한 결과도 반영
      if (ch[API_KEY]) { apiKey = String(ch[API_KEY].newValue || '').trim(); if (apiKeyEl && !apiKeyEl.value) apiKeyEl.value = apiKey; render(); }   // 설정 페이지에서 넣은 키
      if (ch[RULES]) { rules = typeof ch[RULES].newValue === 'string' ? ch[RULES].newValue : undefined; if (!rulesOpen) render(); }   // 다른 탭에서 고친 규칙
      if (ch[KEY] && !busy) { const v = ch[KEY].newValue; const next = v && Array.isArray(v.turns) ? v.turns : []; if (JSON.stringify(next) !== JSON.stringify(turns)) { turns = next; render(); } }   // 다른 탭의 같은 대화
    });
  } catch (e) {}

  async function init(hooks) {
    H = hooks || {};
    try {
      let s = null;
      try { s = (await chrome.storage.sync.get('settings')).settings; } catch (e) {}
      if (!s) { try { s = (await chrome.storage.local.get('settings')).settings; } catch (e) {} }
      applySettings(s);
    } catch (e) {}
    try {
      const l = await chrome.storage.local.get([KEY, DRAFT, RULES, API_KEY, 'llmStatus']);
      turns = l[KEY] && Array.isArray(l[KEY].turns) ? l[KEY].turns : [];
      open = !!(l[KEY] && l[KEY].open);
      if (typeof l[RULES] === 'string') rules = l[RULES];
      apiKey = String(l[API_KEY] || '').trim();
      if (apiKeyEl && !apiKeyEl.value) apiKeyEl.value = apiKey;
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
  self.KRX_STAFF_CHAT = { init, show, toggle, isOpen: () => open, send, probe, opsOf, attach: addFiles, route };
})();
