/* 참여연구원 변경 탭(popup.html#tab&page=staff&only=staff — html.krext-only)의 오른쪽 **변경 도우미** 채팅 (0.8.8, 2026-10-19 사용자 "여기 우측에 LLM 에이전트 채팅창을 붙여주고, 참여연구원 변경 사항에 대한 작업요청을 대신 해 줄 수 있도록 해줘. 이건 LLM 이 연결된 경우에만 작업할 수 있도록").
 * 글로 적은 요청("문창재 11월부터 25%로", "김거화 12월 제외", "부족금을 문창재에게 다 줘", "홍길동 참여 추가, 7월부터 20%, 월급여 6,000")을 이 PC 의 Help 서버(help-server/server.js POST /staff → help-server/staff-chat.js, claude -p 한 번)에
 * 보고 있는 과제·연차 계획의 요약(lib/staff-ui.js bind().agent.snapshot — 이름·역할·월급여·월별 지급·참여율·예산·부족금·rERP 등록·알림)과 이전 대화 몇 줄을 붙여 보내면, Claude 가 답 한두 문장(reply)과 작업 목록(ops)을 돌려주고
 * 이 스크립트가 agent.apply(ops) 로 화면의 계획에 차례대로 반영한다(계산·저장·변경이력·공유 요청은 표의 칸·✎ 폼과 같은 길). 답과 반영 결과(작업마다 ✔/✖ 와 메시지 한 줄)를 말풍선으로 보인다. 프롬프트·스키마·검사는 lib/staff-chat-core.js.
 * 연결(0.8.9, 2026-10-21 사용자 "에이전트에는 Claude CLI 를 기본 연결할 수 있게 설정해주고 연결되지 않을 경우 연결 방법에 대한 프롬프트를 추가해주고. API 키를 넣는 설정칸도 넣어줘"):
 *   기본은 **Claude CLI** — storage.local.llmStatus(lib/llm.js — 백그라운드 'llmProbe')가 ok 이고 그 서버에 /staff 가 있을 때(/health 의 staff 모델). 열 때·[연결 확인]·서버 연결 실패 뒤에 확인하고 llmStatus 가 바뀌면 따라간다. 2026-10-21 사용자 "claude 연결이 안되어 있으면 입력이 안되게": Claude API 키는 lib/claude-api.js check()(GET /v1/models — storage.local.llmApi) 로 확인된 것만 연결로 본다(400 워크스페이스 ID 없음 · 401 이면 "Claude API 키 오류" — 입력란 잠김, 연결 카드에 까닭). 보내기가 API 오류로 실패해도 다시 확인한다.
 *   안 붙으면 안내 카드에 서버 실행 방법 · [설정 프롬프트 복사](lib/help-setup.js — 저장소 폴더에서 연 Claude Code 에 붙여 넣는 글) · **Claude API 키** 칸(storage.local.claudeApiKey — 설정 페이지 › LLM 설정 › Claude API 와 같은 키)을 둔다.
 *   키가 있고 설정 help.api.use 가 off 가 아니면 서버 없이 lib/claude-api.js staff()(모델 API_MODEL — 서버 기본과 같음)로 보낸다(always 면 서버가 있어도 API 먼저). 상태 줄에 어느 길인지 보인다(연결됨 · Claude CLI / Claude API).
 * 첨부(0.8.9, 2026-10-21 사용자 "엑셀, 워드, PDF, HWP/X, 이미지를 첨부할 수 있게 해줘. HWP 인 경우 HWPX 로 변환해야 할거 같고.. 이미지는 OCR 를 하면 될거 같아"): 📎 단추·끌어다 놓기로 FILE_MAX 개까지 —
 *   xlsx·docx·hwpx·hwp·txt/csv 는 보내기 전에 lib/doc-text.js 로 글을 뽑고(HWP 는 변환 없이 바로 읽음), PDF·이미지(가로 IMG_W px JPEG 로 줄임)는 내용째 보내 Claude 가 본다(서버: 작업 폴더에 써 두고 Read 로 — 이미지는 글자를 읽는 OCR 구실, API: document·image 블록).
 *   첨부는 보내면 비워지고 말풍선에 이름만 남는다. 서버 길에서는 /health 의 staffFiles 가 있는(0.8.9 이후) 서버라야 📎 가 켜진다.
 * 예산 규칙(2026-10-20 사용자 "이 에이전트에 claude.md … 예산에 대해서만 참고할 만한 프롬프트를 넣고 관리할 수 있도록"): 머리의 [규칙]이 대화 자리에 편집란을 연다 — storage.local.staffRules(저장한 적 없으면 lib/staff-chat-core.js DEFAULT_RULES, 비우고 저장하면 안 보냄)를 요청마다 rules 로 보내 서버·API 가 시스템 프롬프트 뒤에 붙인다. 모든 과제 공통, 이 브라우저에만.
 * 대화는 storage.local.staffChat = { turns:[{ role:'user'|'assistant', text, at, files?[이름], results?[{ ok, text, msg }], dropped?, model?, via?, error? }] }(최대 60 줄, 쓰던 글은 staffChatDraft) — [새 대화]로 지움(계획은 그대로). 요청마다 계획 요약을 새로 보내므로 서버 쪽 대화 세션은 없다.
 * 열고 닫기(2026-10-19 사용자 "에이전트 버튼을 누르면 나오도록"): 탭 제목 줄의 [에이전트] 단추(lib/staff-ui.js focusTitle, data-act="st-agent" → popup.js → toggle())로 — 기본은 닫힘, 열림 여부는 staffChat.open 에 남겨 다음에 열 때 그대로. state.staffChatOpen 에 두어 단추의 눌림 표시(aria-pressed)가 따라간다.
 * popup.js 가 브라우저 탭일 때 KRX_STAFF_CHAT.init({ api(staffApi), allow(allowApi), state, draw }) 로 잇고 applyHash 가 show(only) 로 이 탭의 모드를 정한다. 서버 주소는 설정 help.url(이 PC 만, popup/help.js 와 같은 규칙). 테스트: node tests/staff-chat-ui.test.js
 * 모드(2026-10-21 사용자 "연구수당도, 참여연구원 과 같은 동일한 에이전트를 넣어줘. 참고하는 프롬프트만 달리해서. 여기에는 연구수당 지침을 넣어줘라"): 같은 채팅 틀을 연구수당 계산 탭(only=allow)도 쓴다 — MODES 표가 모드마다 다른 것만 둔다:
 *   staff(변경 도우미) = storage.local.staffChat·staffChatDraft·staffRules · POST /staff · lib/staff-chat-core.js · staffApi.agent(lib/staff-ui.js) · 예산 규칙 / allow(연구수당 도우미) = allowChat·allowChatDraft·allowRules · POST /allow(서버 /health 의 allow) · lib/allow-chat-core.js · allowApi.agent(lib/allowance.js) · [지침] = 10-53 연구수당 지침(DEFAULT_RULES).
 *   연결·첨부·API 키·대화 저장·열고 닫기는 같다. 탭은 모드마다 따로 열리므로(background openExtTab 이 only 로 가름) 한 탭은 한 모드 — show(모드)가 바뀌면 그 모드의 대화·초안·규칙을 다시 읽는다. */
(() => {
  const API_KEY = 'claudeApiKey', DEFAULT_URL = 'http://127.0.0.1:8106', MAX_TURNS = 60, HISTORY = 8, ASK_MS = 180000;
  const FILE_NOTE = '📎 첨부(엑셀·워드·HWP/HWPX 는 글로, PDF·이미지는 내용째)도 함께 갑니다.';
  /* 모드마다 다른 것 — 저장 키 · 서버 경로(/health 의 어느 칸이 있어야 하는지) · 프롬프트 모듈 · 반영 손(agent) · 글. 그 밖의 UI·연결·첨부는 같다 */
  const MODES = {
    staff: { key: 'staffChat', draft: 'staffChatDraft', rules: 'staffRules', path: '/staff', health: 'staff', title: '변경 도우미', from: '참여연구원 변경 도우미',
      core: () => self.KRX_STAFF_CHAT_CORE || null, agent: () => (H && H.api && H.api.agent) || null,
      rulesBtn: '규칙', rulesTitle: '예산 규칙', rulesDesc: '요청마다 Claude 에 함께 보내는 참고 글이에요. 모든 과제에 같이 쓰이고 이 브라우저에만 저장돼요. 비우고 저장하면 보내지 않아요.', rulesHint: '예산 규칙 — 요청마다 Claude 에 함께 보내는 참고 글',
      placeholder: '변경할 내용을 입력하세요', busyPh: '계획을 변경하고 있어요…', waiting: '계획을 확인하고 있어요…', hint: '요청한 변경은 현재 계획에 반영됩니다.',
      sent: '이 과제·연차 계획의 요약(이름·월급여·월별 지급)', common: `반영된 변경은 표와 변경이력에 바로 남고, 되돌리려면 표에서 고치거나 다시 요청하세요. R&D ERP 에는 쓰지 않습니다. 머리의 [규칙]에 적은 예산 규칙과 ${FILE_NOTE}`,
      emptyTitle: '어떤 계획을 바꿀까요?', emptyText: '이 과제의 참여연구원 계획을 글로 요청하세요.<br>누구를, 언제부터, 얼마나 바꿀지 알려 주세요. 공문·명세서(엑셀·워드·PDF·HWP·이미지)는 📎 로 붙이세요.',
      examples: [['참여율 조정', '문창재 11월부터 참여율을 25%로 바꿔줘'], ['참여 기간 변경', '김거화 10~12월 참여를 제외해줘'], ['연구원 추가', '홍길동을 참여연구원으로 추가해줘. 7월부터 20%, 월급여 6,000']],
      fileAsk: '첨부 파일을 보고 이 계획에 반영할 것이 있으면 작업으로 옮겨줘.' },
    allow: { key: 'allowChat', draft: 'allowChatDraft', rules: 'allowRules', path: '/allow', health: 'allow', title: '연구수당 도우미', from: '연구수당 도우미',
      core: () => self.KRX_ALLOW_CHAT_CORE || null, agent: () => (H && H.allow && H.allow.agent) || null,
      rulesBtn: '지침', rulesTitle: '연구수당 지침', rulesDesc: '10-53 국가연구개발과제 연구수당 지급 기준(2024-03-05)을 옮겨 적은 글로, 요청마다 Claude 에 함께 보내요. 모든 과제에 같이 쓰이고 이 브라우저에만 저장돼요. 비우고 저장하면 보내지 않아요.', rulesHint: '연구수당 지침(10-53) — 요청마다 Claude 에 함께 보내는 근거 글',
      placeholder: '요청이나 지침 질문을 입력하세요', busyPh: '계산에 반영하고 있어요…', waiting: '계산을 확인하고 있어요…', hint: '요청한 변경은 현재 계산(별지 1·2)에 반영되고, 지침 질문에는 답만 합니다.',
      sent: '이 과제·연차 연구수당 계산의 요약(이름·부서·직급·참여율·성과 항목·등급·지급액)', common: `반영된 변경은 계산 표에 바로 남고(이 브라우저에만 저장), 되돌리려면 표에서 고치거나 다시 요청하세요. R&D ERP 에는 쓰지 않습니다. 머리의 [지침]에 적은 연구수당 지침과 ${FILE_NOTE}`,
      emptyTitle: '연구수당 계산을 도와 드릴까요?', emptyText: '성과 항목·기타 평가·등급·미지급·통합·조정을 글로 요청하거나, 10-53 지침에 대해 물어보세요.<br>실적 목록·논문 정보(엑셀·워드·PDF·HWP·이미지)는 📎 로 붙이세요.',
      examples: [['성과 항목', '문창재에게 논문(SCI(E)) 1건 가중치 0.8, 최종보고서 작성 가중치 0.6 넣어줘'], ['기타 평가', '김거화 기타 평가를 우수로 해줘'], ['지침 질문', 'P3 직급의 연구수당 지급상한은 얼마야?']],
      fileAsk: '첨부 파일을 보고 이 계산에 반영할 것(성과 항목·평가)이 있으면 작업으로 옮겨줘.' },
  };
  let mode = 'staff', inited = false;
  const M = () => MODES[mode] || MODES.staff;
  const API_MODEL = 'claude-opus-5-5';   // Claude API 길의 모델 — 서버(KRX_HELP_STAFF_MODEL 기본)와 같음
  const FILE_MAX = 6, FILE_BYTES = 12 * 1024 * 1024, PDF_BYTES = 10 * 1024 * 1024, IMG_W = 1600;
  const $ = (id) => document.getElementById(id);
  const box = $('staffChat'), logEl = $('scLog'), form = $('scForm'), input = $('scText'), btnSend = $('scSend'), btnNew = $('scNew'), btnProbe = $('scProbe'), statusEl = $('scStatus'), hintEl = $('scHint');
  const connectionEl = $('scConnection'), helpEl = $('scHelpText'), helpLabel = $('scHelpLabel'), btnClose = $('scClose');
  const rulesBox = $('scRulesBox'), rulesText = $('scRulesText'), rulesStatus = $('scRulesStatus'), btnRules = $('scRules'), btnRulesSave = $('scRulesSave'), btnRulesDefault = $('scRulesDefault');
  const titleEl = $('scTitle'), rulesTitleEl = $('scRulesTitle'), rulesDescEl = $('scRulesDesc');   // 모드마다 바뀌는 글
  const connCard = $('scConnCard'), connTitle = $('scConnTitle'), connText = $('scConnText'), connActs = $('scConnActs'), btnSetup = $('scSetup'), setupNoteEl = $('scSetupNote'), apiKeyEl = $('scApiKey'), btnApiSave = $('scApiSave'), apiNoteEl = $('scApiNote');
  const composeEl = $('scCompose'), filesEl = $('scFiles'), btnAttach = $('scAttach'), fileEl = $('scFile');
  const btnConn = $('scConn');   // [연결] — 연결된 뒤에도 연결 카드(Claude API 키 칸)를 열고 닫음(2026-10-21 사용자 "이거 다시 쓰려는데 바뀌는 곳이 없네... 에이전트에서")
  if (!box || !form || !input || !logEl) return;
  let H = null, base = DEFAULT_URL, llm = null, turns = [], busy = false, probing = false, avail = false /* 참여연구원 변경 탭(only=staff)인가 */, open = false /* [에이전트] 로 열었나 */, rules /* storage.local.staffRules — undefined 면 기본 글 */, rulesOpen = false;
  let width = '' /* 채팅 폭 — storage.local.staffChatSize: '2:1' · '1:1' · '1:2'(본문:채팅 — 제목 줄 단추, lib/render.js) 또는 끌어 정한 '420px'. '' 는 기본(400px · 1180px 아래 340px). html 의 --sc-w 로 CSS 가 flex-basis 에 씀 (2026-10-21 사용자 "에이전트 폭을 조절할 수 있으면 … 비율을 2:1 또는 1:1, 1:2로 아이콘으로") */;
  const RATIO = { '2:1': '33.3333%', '1:1': '50%', '1:2': '66.6667%' };
  let connOpen = false /* [연결]로 연 연결 카드 — 연결돼 있어도 보임 */, lastRoute = '' /* 마지막으로 그린 연결 길 — 바뀌면 탭(H.draw)도 다시(연구수당 계산 카드의 연구내용 항목·[연구내용 분류]가 연결 여부를 봄, 2026-10-21) */;
  let apiUse = 'auto' /* 설정 help.api.use: auto(서버가 없을 때만) · always · off */, apiKey = '' /* storage.local.claudeApiKey */, pending = [] /* 보낼 첨부 File[] */, note = '' /* 입력란 밑 한 줄(첨부 안내) */, setupNote = '', apiNote = '', apiStat = null /* storage.local.llmApi — lib/claude-api.js check() 결과(키·모델이 되는지, keyTag 로 어느 키인지). API 길은 이것이 ok 일 때만 연결로 본다(2026-10-21 사용자 "claude 연결이 안되어 있으면 입력이 안되게") */, apiModel = '' /* 설정 help.api.model — 확인에 쓸 모델 */, apiWs = '' /* storage.local.claudeApiWorkspace — sk-ant-usr-… 키는 이것이 있어야 /v1/messages 가 됨(GET /v1/models 는 없어도 통과하므로 check 만으로는 모름 — 2026-10-21 실측 400) */;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hhmm = (t) => { const d = new Date(t || Date.now()); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const fmtSize = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);
  const core = () => M().core();
  const docText = () => self.KRX_DOC_TEXT || null;
  const claudeApi = () => (typeof KRX_CLAUDE_API !== 'undefined' ? KRX_CLAUDE_API : null);   // lib/claude-api.js 는 최상위 const — self.KRX_CLAUDE_API 로는 안 보임(2026-10-21 실측)
  const serverOn = () => !!(llm && llm.ok && llm.url === base && llm[M().health]);
  const API_TTL = 600000;   // API 키 확인 결과를 다시 쓰는 시간(10분)
  const tagOf = (k) => { const C = claudeApi(); return C && C.keyTag ? C.keyTag(k) : String(k || '').slice(-4); };
  const apiOk = () => !!(apiStat && apiStat.ok && apiStat.keyTag === tagOf(apiKey));   // 확인된 키만 — 400(워크스페이스 ID 없음)·401 인 키로는 입력란을 열지 않는다
  const apiFail = () => (apiKey && apiUse !== 'off' && apiStat && !apiStat.ok && apiStat.keyTag === tagOf(apiKey) ? apiStat.error || 'Claude API 키를 확인하지 못했어요' : '');
  const apiOn = () => !!(apiKey && apiUse !== 'off' && claudeApi() && apiOk());
  /* API 키 확인 — lib/claude-api.js check(): GET /v1/models/{model}(토큰 안 씀), 결과는 storage.local.llmApi 에도(설정 페이지의 [API 확인]과 같음). TTL 안의 같은 키는 다시 묻지 않음 */
  async function probeApi(force) {
    const C = claudeApi();
    if (!C || !apiKey || apiUse === 'off' || typeof C.check !== 'function') return;
    const tag = tagOf(apiKey);
    if (/^sk-ant-usr-/i.test(apiKey) && !apiWs) { apiStat = { at: Date.now(), ok: false, keyTag: tag, error: '이 키(sk-ant-usr-…)는 워크스페이스에 묶이지 않아 워크스페이스 ID 가 있어야 합니다 — 설정 › LLM 설정 › Claude API 의 워크스페이스 ID(Claude Console › Settings › Workspaces 의 wrkspc_…)를 넣고 저장하세요' }; return; }
    if (!force && apiStat && apiStat.keyTag === tag && Date.now() - (apiStat.at || 0) < API_TTL) return;
    try { apiStat = Object.assign({ at: Date.now(), keyTag: tag }, await C.check({ key: apiKey, model: apiModel || API_MODEL })); }
    catch (e) { apiStat = { at: Date.now(), ok: false, keyTag: tag, error: String((e && e.message) || e) }; }
  }
  /* 어느 길로 보내나: 'server'(Claude CLI — 기본) · 'api'(Claude API 키 — 서버가 없거나 설정이 "항상") · ''(연결 없음) */
  const route = () => (apiUse === 'always' && apiOn() ? 'api' : serverOn() ? 'server' : apiOn() ? 'api' : '');
  const connected = () => !!route();
  const canAttach = () => { const r = route(); return !!r && !busy && (r !== 'server' || !!llm.staffFiles); };
  const opTextOf = (op) => { try { return core() ? core().opText(op) : String(op && op.op || ''); } catch (e) { return String(op && op.op || ''); } };
  const defaultRules = () => (core() && core().DEFAULT_RULES) || '';
  const rulesNow = () => (typeof rules === 'string' ? rules : defaultRules());   // 요청마다 붙는 규칙(예산 규칙 · 연구수당 지침)
  const setRulesStatus = (t) => { if (rulesStatus) rulesStatus.textContent = t || ''; };
  const mask = (k) => { try { if (claudeApi() && claudeApi().mask) return claudeApi().mask(k); } catch (e) {} return k ? `…${String(k).slice(-4)}` : ''; };
  const save = () => { try { chrome.storage.local.set({ [M().key]: { turns: turns.slice(-MAX_TURNS), open } }); } catch (e) {} };
  const saveDraft = () => { try { chrome.storage.local.set({ [M().draft]: input.value }); } catch (e) {} };
  /* 채팅 폭 — v 없이 부르면 지금 값. '2:1' 같은 비율이나 '420px'(끌기), 그 밖은 기본(''). keep 이면 저장하지 않음(끄는 동안·시작 때) */
  function size(v, keep) {
    if (v === undefined) return width;
    width = RATIO[v] ? v : /^\d+px$/.test(String(v)) ? String(v) : '';
    try { document.documentElement.style.setProperty('--sc-w', RATIO[width] || width || ''); } catch (e) {}
    try { document.querySelectorAll('[data-act="sc-ratio"]').forEach((b) => { const on = b.dataset.ratio === width; b.classList.toggle('krext-on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }); } catch (e) {}
    if (!keep) { try { chrome.storage.local.set({ staffChatSize: width }); } catch (e) {} }
    return width;
  }
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
    try { return Object.assign({ ok: true, via: 'api' }, await A.staff(inp, { key: apiKey, model: API_MODEL, timeoutMs: ASK_MS, blocks, core: C })); }
    catch (e) { return { ok: false, kind: 'api', error: String((e && e.message) || e) }; }
  }

  /* 연결 상태 한 줄 · 안내 글 */
  function statusOf() {
    if (probing) return { text: '연결 확인 중', cls: 'pending' };
    const r = route();
    if (r === 'server') return { text: '연결됨 · Claude CLI', cls: 'ok' };
    if (r === 'api') return { text: `연결됨 · Claude API${serverOn() ? '' : ' (CLI 미연결)'}`, cls: 'ok' };
    if (llm && llm.ok && llm.url === base && !llm[M().health]) return { text: '업데이트 필요', cls: 'err' };
    if (apiFail()) return { text: 'Claude API 키 오류', cls: 'err' };
    return { text: '연결 필요', cls: 'err' };
  }
  function helpOf() {
    const r = route(), m = M();
    if (r === 'server') return `요청마다 ${m.sent}과 최근 대화가 Help 서버(Claude CLI)를 거쳐 Claude 로 갑니다. ${m.common}`;
    if (r === 'api') return `Help 서버(Claude CLI)가 없어 저장된 Claude API 키로 api.anthropic.com 에 직접 보냅니다(모델 ${API_MODEL}, 사용량은 그 키에 과금). ${m.common}`;
    if (llm && llm.ok && llm.url === base && !llm[m.health]) return `Help 서버가 ${m.title}가 생기기 전 버전입니다 — 서버를 끄고 다시 node help-server/server.js 를 실행한 뒤 [연결 확인].`;
    if (apiFail()) return `저장된 Claude API 키로는 보낼 수 없습니다 — ${apiFail()} 키를 고치거나 Help 서버(Claude CLI)를 실행하세요.`;
    return `기본 연결은 이 PC 의 Claude Code CLI(Help 서버)입니다 — 저장소 폴더에서 node help-server/server.js 를 실행한 뒤 [연결 확인] (${base}). 준비물은 CLAUDE.md, 처음이면 [설정 프롬프트 복사]. 서버 없이 쓰려면 위 칸에 Claude API 키를 저장하세요.`;
  }
  /* Claude Code 에 붙여 넣는 설정 프롬프트 (popup/help.js 와 같은 글 — lib/help-setup.js 가 없으면 짧게) */
  function setupText() {
    const o = { url: base, from: M().from, reason: llm && !llm.ok ? llm.error || '' : '' };
    try { o.version = chrome.runtime.getManifest().version; } catch (e) {}
    try { if (self.KRX_HELP_SETUP) return KRX_HELP_SETUP.prompt(o); } catch (e) {}
    return `[KR eClass + R&D ERP 현황 확장 — Help 서버(LLM) 연결 설정]\n이 폴더(kr_ext_rerp 저장소)의 CLAUDE.md "Help Chat (help-server) 을 쓸 때 필요한 것" 절을 따라 준비물(Node 22 이상 · git · Claude Code CLI 2.1.280 이상과 로그인)을 확인하고, 별도 터미널에서 node help-server/server.js 를 띄운 뒤 ${base}/health 로 확인해 주세요. 확장 코드 수정·커밋은 하지 마세요.`;
  }
  /* 연결 안내 카드(popup.html 의 고정 틀 — 글만 바꿈): Claude CLI 가 안 붙었을 때 서버 실행 방법 · 설정 프롬프트 · Claude API 키 칸 */
  function renderConnection() {
    if (!connectionEl) return;
    connectionEl.hidden = connected() && !probing && !connOpen;
    const oldServer = llm && llm.ok && llm.url === base && !llm[M().health], on = connected() && !probing;   // on: 연결된 채 [연결]로 연 카드 — 키 바꾸기 안내
    if (btnConn && btnConn.setAttribute) btnConn.setAttribute('aria-pressed', connOpen && on ? 'true' : 'false');   // 테스트의 가짜 요소에는 setAttribute 가 없음
    if (connCard) connCard.className = `sc-connect-card${probing ? ' checking' : ''}`;
    if (connTitle) connTitle.textContent = probing ? '도우미 연결을 확인하고 있어요' : on ? (route() === 'api' ? 'Claude API 키로 연결돼 있어요' : 'Claude CLI(Help 서버)에 연결돼 있어요') : oldServer ? 'Help 서버를 업데이트해 주세요' : apiFail() ? 'Claude 에 연결되지 않았어요 — API 키 오류' : 'Claude CLI(Help 서버)에 연결되지 않았어요';
    if (connText) connText.textContent = probing ? '잠시만 기다려 주세요.' : on ? `API 키를 바꾸려면 아래에 새 키를 넣고 [저장], 지우려면 비우고 [저장]하세요 (설정 › LLM 설정 › Claude API 와 같은 키 — Anthropic 콘솔의 sk-ant-api03-… 키). 서버(Claude CLI)를 쓰려면 저장소 폴더에서 node help-server/server.js 를 실행한 뒤 [연결 확인] (${base}).` : oldServer ? '서버를 끄고 저장소 폴더에서 다시 node help-server/server.js 를 실행한 뒤 위 [연결 확인]을 누르세요.'
      : `${apiFail() ? `저장된 API 키로는 보낼 수 없어요 — ${apiFail()} ` : ''}기본 연결은 이 PC 의 Claude Code CLI 예요. 저장소 폴더에서 터미널을 열고 node help-server/server.js 를 실행한 뒤 위 [연결 확인]을 누르세요 (${base}). 처음이면 [설정 프롬프트 복사]를 저장소 폴더에서 연 Claude Code 에 붙여 넣으면 준비물 확인부터 서버 실행까지 안내해요.`;
    if (connActs) connActs.hidden = probing;
    if (setupNoteEl) setupNoteEl.textContent = setupNote;
    if (apiNoteEl) apiNoteEl.textContent = apiNote || (apiUse === 'off' ? '설정 › LLM 설정 › Claude 연결 방식이 "Claude CLI 만"이라 키가 있어도 쓰지 않아요.' : !claudeApi() ? 'Claude API 모듈을 읽지 못했어요 — 확장을 다시 올리세요.' : apiKey ? (apiFail() ? `저장된 키 ${mask(apiKey)} — ${apiFail()}` : `저장된 키 ${mask(apiKey)} — 서버가 없으면 이 키로 보내요 (모델 ${API_MODEL}, 그 키에 과금).`) : '키를 넣고 저장하면 서버 없이 바로 쓸 수 있어요 — 이 브라우저에만 저장되고 설정 › LLM 설정의 Claude API 와 같은 키예요.');
  }
  function emptyState() {
    const m = M();
    const disabled = !connected() || busy;
    const cards = m.examples.map(([label, text]) => `<button type="button" class="sc-example" data-sc-example="${esc(text)}"${disabled ? ' disabled' : ''} title="${disabled ? '도우미 연결 후 사용할 수 있어요' : '입력란에 예시 넣기'}"><small>${label}</small><span>${esc(text)}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg></button>`).join('');
    return `<div class="sc-empty"><div class="sc-empty-icon" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m16 5 2.7 7.3L26 15l-7.3 2.7L16 25l-2.7-7.3L6 15l7.3-2.7L16 5Zm10-1v5m-2.5-2.5h5M7 23v5m-2.5-2.5h5"/></svg></div><h2>${esc(m.emptyTitle)}</h2><p>${m.emptyText}</p><div class="sc-examples">${cards}</div><small class="sc-example-note">예시를 선택하고 내 계획에 맞게 수정하세요.</small></div>`;
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
    const st = statusOf(), m = M();
    const rt = route(); if (rt !== lastRoute) { lastRoute = rt; if (inited && H && typeof H.draw === 'function') H.draw(); }
    if (titleEl) titleEl.textContent = m.title;
    if (rulesTitleEl) rulesTitleEl.textContent = m.rulesTitle;
    if (rulesDescEl) rulesDescEl.textContent = m.rulesDesc;
    if (rulesText && core()) rulesText.maxLength = core().LIMIT.rules;
    statusEl.textContent = st.text; statusEl.className = `sc-status ${st.cls}`;
    statusEl.title = llm ? (llm.ok ? `${llm.url}${llm.model ? ` · Help Chat ${llm.model}` : ''}${llm.cli ? ` · claude ${llm.cli}` : ''}` : llm.error || '') : '';
    const on = connected();
    input.disabled = !on || busy; btnSend.disabled = !on || busy; btnNew.disabled = busy || !turns.length; btnProbe.disabled = probing;
    input.placeholder = busy ? m.busyPh : on ? m.placeholder : '연결 후 요청할 수 있어요';
    hintEl.textContent = note || (busy ? '요청을 처리하고 있어요. 잠시만 기다려 주세요.' : on ? m.hint : '연결 후 예시를 선택해 시작할 수 있어요.');
    if (helpEl) helpEl.textContent = helpOf();
    if (helpLabel) helpLabel.textContent = on ? '반영 안내' : '연결 방법';
    renderConnection();
    if (rulesBox) rulesBox.hidden = !rulesOpen;
    if (btnRules) { btnRules.textContent = m.rulesBtn; btnRules.ariaPressed = String(rulesOpen); btnRules.title = rulesOpen ? `${m.rulesTitle} 편집란 닫기` : `${m.rulesHint}${typeof rules !== 'string' ? ' (기본 글)' : rules.trim() ? ' (고친 글)' : ' (비움 — 보내지 않음)'}`; }
    if (btnAttach) { const ok = canAttach(); btnAttach.disabled = !ok; btnAttach.title = ok ? `파일 첨부 — 엑셀(xlsx) · 워드(docx) · PDF · HWP/HWPX · 이미지 · 글 파일, ${FILE_MAX}개까지 (끌어다 놓아도 됨)` : route() === 'server' && !llm.staffFiles ? 'Help 서버가 이전 버전이라 첨부를 받지 못해요 — 서버를 끄고 다시 node help-server/server.js' : '연결 후 첨부할 수 있어요'; }
    renderFiles();
    const stick = logEl.scrollTop + logEl.clientHeight >= logEl.scrollHeight - 12;
    logEl.innerHTML = (turns.length ? turns.map(bubble).join('') : emptyState())
      + (busy ? `<div class="sc-msg bot sc-wait"><span class="sc-wait-dots" aria-hidden="true"><i></i><i></i><i></i></span>${esc(m.waiting)}</div>` : '');
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

  /* 보내기 — preset(글)을 주면 입력란 대신 그 글을 보낸다(초안은 그대로 — lib/allowance.js [연구내용 분류] 가 씀) */
  async function send(preset) {
    const given = typeof preset === 'string', text = (given ? preset : input.value).trim();
    if ((!text && !pending.length) || busy || !connected()) return;
    const agent = M().agent(), snap = agent ? agent.snapshot() : null;
    if (!snap) { turns.push({ role: 'assistant', text: '보고 있는 과제가 없습니다 — 과제 목록이 조회된 뒤 다시 보내세요.', at: Date.now(), error: true }); save(); render(); return; }
    const history = turns.slice(-HISTORY).map((t) => ({ role: t.role, text: t.role === 'user' ? t.text : [t.text, (t.results || []).length ? `(반영: ${t.results.map((r) => `${r.ok ? '' : '실패 — '}${r.text}`).join(' · ')})` : ''].filter(Boolean).join(' ') }));
    const files = pending.slice(); pending = []; note = '';
    const ask = text || M().fileAsk;
    turns.push({ role: 'user', text: ask, at: Date.now(), files: files.map((f) => f.name) });
    if (!given) { input.value = ''; try { chrome.storage.local.remove(M().draft); } catch (e) {} }
    busy = true; save(); render();
    const r0 = route();
    let r;
    try {
      const prepped = files.length ? await prepFiles(files) : [];
      r = r0 === 'api' ? await askApi(ask, history, snap, prepped) : await api(M().path, { text: ask, history, snapshot: snap, rules: rulesNow(), files: prepped });
    } catch (e) { r = { ok: false, error: String((e && e.message) || e) }; }
    let turn;
    if (r.ok) {
      let results = [];
      if (Array.isArray(r.ops) && r.ops.length) {
        try { results = await agent.apply(r.ops); }
        catch (e) { results = [{ ok: false, text: '반영', msg: String((e && e.message) || e) }]; }
      }
      turn = { role: 'assistant', text: r.reply || (results.length ? '반영했습니다.' : '(답이 없습니다)'), at: Date.now(), results, dropped: Number(r.dropped) || 0, model: r.model || '', via: r.via === 'api' ? 'api' : '' };
    } else turn = { role: 'assistant', text: `실패 — ${r.error || '응답 없음'}`, at: Date.now(), error: true };
    turns.push(turn); busy = false; save(); render();
    if (!r.ok && r.kind === 'offline') probe(true);   // 서버가 내려갔으면 상태 줄도 바로
    else if (!r.ok && r0 === 'api') { if (/\(40[0134]\)|workspace|워크스페이스/i.test(r.error || '')) { apiStat = { at: Date.now(), ok: false, keyTag: tagOf(apiKey), error: String(r.error || '').replace(/^Claude API: /, '') }; render(); } else probe(true); }   // API 키·설정이 거절됐으면(400 워크스페이스 ID · 401 · 403 · 404) 입력란을 잠그고 까닭을 카드에, 그 밖(429·529·시간 초과)은 다시 확인만
    if (connected()) input.focus();
  }
  /* 백그라운드에 연결 확인(lib/llm.js — storage.local.llmStatus 도 갱신) */
  async function probe(force) {
    probing = true; render();
    try { const r = await chrome.runtime.sendMessage({ type: 'llmProbe', url: base, force: !!force }); if (r && typeof r.ok === 'boolean') llm = r; } catch (e) {}
    if (!serverOn() || apiUse === 'always') await probeApi(force);   // 서버가 없으면(또는 "항상" API) 저장된 키도 되는지 확인
    probing = false; render();
  }
  const opsOf = (ops) => (Array.isArray(ops) ? ops : []).map((op) => Object.assign({ text: opTextOf(op) }, op));   // 테스트·디버깅용 (반영 결과의 글)
  const applySettings = (s) => { const u = String(((s && s.help) || {}).url || '').trim().replace(/\/+$/, ''); if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(u)) base = u; const use = (((s && s.help) || {}).api || {}).use; apiUse = use === 'always' || use === 'off' ? use : 'auto'; apiModel = String((((s && s.help) || {}).api || {}).model || '').trim(); };

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
  if (btnConn) btnConn.addEventListener('click', () => { connOpen = !connOpen; render(); if (connOpen && !connectionEl.hidden && apiKeyEl) apiKeyEl.focus(); });   // [연결] — 카드 열기/닫기(열면 키 칸에 초점)
  if (btnClose) btnClose.addEventListener('click', () => { saveDraft(); toggle(false); });
  /* 왼쪽 가장자리(#scResize) 끌기 — 채팅 폭(px, 280px 부터 본문 360px 를 남기는 값까지). 포인터 캡처라 빠르게 끌어도 따라오고, 두 번 누르면 기본 폭 */
  const resizeEl = $('scResize');
  if (resizeEl && resizeEl.addEventListener) {
    let drag = null;
    resizeEl.addEventListener('pointerdown', (ev) => { if (ev.button) return; const row = box.parentElement; if (!row) return; drag = row.getBoundingClientRect(); try { resizeEl.setPointerCapture(ev.pointerId); } catch (e) {} document.body.classList.add('sc-resizing'); ev.preventDefault(); });
    resizeEl.addEventListener('pointermove', (ev) => { if (!drag) return; size(`${Math.round(Math.min(Math.max(drag.right - ev.clientX, 280), Math.max(280, drag.width - 360)))}px`, true); });
    const end = () => { if (!drag) return; drag = null; document.body.classList.remove('sc-resizing'); size(width); };
    resizeEl.addEventListener('pointerup', end); resizeEl.addEventListener('pointercancel', end);
    resizeEl.addEventListener('dblclick', () => size(''));
  }
  /* 예산 규칙 편집란 — [규칙]으로 열고 닫음(열리면 CSS 가 대화를 가림), [저장]은 storage.local.staffRules(비우고 저장하면 규칙 없이 보냄), [기본값]은 입력란에 기본 글만 */
  if (btnRules) btnRules.addEventListener('click', () => { rulesOpen = !rulesOpen; if (rulesOpen && rulesText) rulesText.value = rulesNow(); setRulesStatus(''); render(); if (rulesOpen && rulesText) rulesText.focus(); });
  if (btnRulesSave) btnRulesSave.addEventListener('click', () => { rules = rulesText ? String(rulesText.value) : ''; try { chrome.storage.local.set({ [M().rules]: rules }); } catch (e) {} setRulesStatus(rules.trim() ? '저장했어요 — 다음 요청부터 함께 보냅니다.' : '비워 저장했어요 — 규칙 없이 보냅니다.'); render(); });
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
    apiKey = k; apiStat = null; await probeApi(true);
    apiNote = k ? (apiOk() ? `저장했어요 ${mask(k)} — 서버가 없으면 이 키로 보내요 (모델 ${API_MODEL}).` : `저장했어요 ${mask(k)} — 그런데 ${apiFail() || '키를 확인하지 못했어요'}`) : '키를 지웠어요.';
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
      if (ch[API_KEY]) { apiKey = String(ch[API_KEY].newValue || '').trim(); if (apiKeyEl && !apiKeyEl.value) apiKeyEl.value = apiKey; render(); probeApi(false).then(render); }   // 설정 페이지에서 넣은 키
      if (ch.llmApi) { apiStat = ch.llmApi.newValue || null; render(); }   // 설정 페이지의 [API 확인] 결과
      if (ch.claudeApiWorkspace) { apiWs = String(ch.claudeApiWorkspace.newValue || '').trim(); apiStat = null; probeApi(true).then(render); }   // 설정 페이지에서 넣은 워크스페이스 ID
      const m = M();
      if (ch[m.rules]) { rules = typeof ch[m.rules].newValue === 'string' ? ch[m.rules].newValue : undefined; if (!rulesOpen) render(); }   // 다른 탭에서 고친 규칙
      if (ch[m.key] && !busy) { const v = ch[m.key].newValue; const next = v && Array.isArray(v.turns) ? v.turns : []; if (JSON.stringify(next) !== JSON.stringify(turns)) { turns = next; render(); } }   // 다른 탭의 같은 대화
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
      const l = await chrome.storage.local.get([API_KEY, 'llmStatus', 'llmApi', 'claudeApiWorkspace', 'staffChatSize']);
      size(String(l.staffChatSize || ''), true);
      apiKey = String(l[API_KEY] || '').trim();
      if (apiKeyEl && !apiKeyEl.value) apiKeyEl.value = apiKey;
      if (l.llmStatus && l.llmStatus.url === base) llm = l.llmStatus;
      apiStat = l.llmApi || null; apiWs = String(l.claudeApiWorkspace || '').trim();
    } catch (e) {}
    inited = true;
    await load();
  }
  /* 지금 모드의 대화·열림·초안·규칙을 저장소에서 읽어 그린다. 읽는 사이 모드가 바뀌었으면(show) 다시 */
  async function load() {
    const m = M();
    let l = {};
    try { l = await chrome.storage.local.get([m.key, m.draft, m.rules]); } catch (e) {}
    if (M() !== m) return load();
    turns = l[m.key] && Array.isArray(l[m.key].turns) ? l[m.key].turns : [];
    open = !!(l[m.key] && l[m.key].open);
    rules = typeof l[m.rules] === 'string' ? l[m.rules] : undefined;
    if (l[m.draft] && !input.value) input.value = String(l[m.draft]);
    rulesOpen = false;
    render(); paint();
    if (open) probe(false); else probeApi(false).then(render);   // 닫혀 있어도 키는 확인해 둔다(열 때 바로)
  }
  /* 이 탭의 모드 — 'staff'(참여연구원 변경 탭) · 'allow'(연구수당 계산 탭) · ''(그 밖 — 채팅 없음). true 는 'staff'(옛 호출) */
  function show(on) {
    const m = on === true ? 'staff' : MODES[on] ? String(on) : '';
    avail = !!m;
    if (m && m !== mode) { mode = m; if (inited) { input.value = ''; load(); return; } }
    paint();
  }
  /* [에이전트] 단추 — 열기/닫기(on 을 주면 그대로). 열 때 연결 상태를 다시 보고(30초 캐시) 입력란에 초점 */
  function toggle(on) {
    open = on == null ? !open : !!on;
    save(); paint();
    if (open) { probe(false).then(() => { if (connected()) input.focus(); }); }
  }
  self.KRX_STAFF_CHAT = { init, show, toggle, isOpen: () => open, send, probe, opsOf, attach: addFiles, route, mode: () => mode, size };
})();
