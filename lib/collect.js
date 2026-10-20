/* 참여연구원 자료 요청 (0.8.9, 2026-10-20 사용자 "참여연구원 변경에서 참여연구자들에게 sharepoint 로 자료 수집을 위한 웹링크를 팀즈로 보내고 거기에 응답하면 데이터를 취합하는 시스템 … 문창재, 김거화 이런게.. 팀즈랑 연동이 잘되어야").
 * 순수 함수 + storage(load/save)만 — 팝업(참여연구원 변경 탭) · 백그라운드 · Node 테스트 공용. 네트워크는 백그라운드(background.js collect*)가 lib/sp-store.js(KRX_SP) 로.
 *
 * 흐름(참여연구원 변경 탭의 **자료 요청** 구역 — lib/staff-ui.js collectSection):
 *   ① [자료 요청 만들기] → 백그라운드 collectCreate: 내 OneDrive(personal 사이트)에 **목록**(SharePoint List, 제목 listTitleFor — "KR 참여현황 <별칭> n차년도")을 만들고(KRX_SP writer.createList — 칸은 FIELDS: 항목(Title, 기본값 과제 제목 — titleFieldFor) · 시작 달 · 끝 달(연차 기간의 달을 고르는 선택 칸 — fieldsOf(ask, period)) · 비고 + 만들 때 **고른 것**(ASK: 참여율(%) · 월급여(천원) · 남은 연구수당(천원) — 탭의 체크 상자, req.ask, 기본 참여율·월급여),
 *      응답자는 자기 항목만 보고 고치게 ReadSecurity·WriteSecurity 2), 참여연구원 이름을 **이메일**로 풀어(eClass 직원검색 membersOf·pickMember — <아이디>@krs.co.kr; 동명이인은 후보 → 탭의 선택 상자; 없으면 캐시 storage.local.peopleEmails, 그래도 없으면 직접 적음 — SharePoint 사람 찾기는 쓰지 않음, 2026-10-20 사용자 "@krs.co.kr 이것만") 목록에 **편집** 공유(ShareObject — 폴더 공유와 같은 길).
 *      양식 주소(formUrl)는 목록의 새 항목 폼(NewForm.aspx — 공유받은 사람이 열면 모던 폼) — 브라우저에서 M365 에 로그인돼 있으면 누구나(조직 안) 열 수 있다.
 *   ② **팀즈로 보내기** — 사람마다(또는 모두에게 한 번에 — 그룹 채팅) Teams 딥 링크 teamsLink(emails, message): https://teams.microsoft.com/l/chat/0/0?users=<이메일,…>&message=<글> — Teams(웹·앱)가 그 사람과의 채팅을 열고 글을 입력란에 채워 둔다(보내기는 사용자가 누름 — API·토큰 없이 되는 유일한 길;
 *      Graph 채팅 API 는 Entra 로그인이 필요해 쓰지 않는다 — CLAUDE.md "다시 붙이지 않는다"). **팀즈 MCP**(0.8.9 — 2026-10-20 사용자 "창도 안 열리고 알아서 보내기까지 … 각기 보내는 건 mcp teams 로 하고 연결 안 되면 못 쓰는 거고 … 기존 단체 채팅방 … 채팅방 링크를 주면 되나"):
 *      이 PC 의 KR_MS365_mcp teams 서버(lib/teams-mcp.js · 설정 teams.mcpUrl)가 연결돼 있으면 탭의 [보내기](사람마다 1:1 채팅)·[채팅방에 보내기](req.chat 의 기존 채팅방 — chatIdOf 로 ID 를 꺼냄)가 백그라운드 collectSend 로 창 없이 보낸다; 아니면 딥 링크만(기존 채팅방은 chatLink 로 열기). 글은 defaultMessage(과제·연차·기간·양식 주소·보낸 사람)이고 탭에서 고칠 수 있다(req.message). 이메일을 못 찾은 사람(ambiguous·notFound)은 탭의 이메일 칸에 직접 적는다(peopleEmails 에 남아 다음 과제에서도 씀).
 *   ③ [응답 받기] → 백그라운드 collectFetch: 목록 항목(KRX_SP.listItems — Author 의 이메일·이름 포함)을 읽어 responsesOfItems 로 응답 줄(사람 이름은 이메일로 맞춤)을 만든다. 팀즈로 보낸 뒤 회신이 없는 동안은 백그라운드 **자동 갱신**(onAlarm — 설정의 갱신 주기)마다 needsPoll 인 요청을 background.js collectPoll 이 저절로 읽어 온다(2026-10-20 사용자 "이거 보내면 결과를 이 웹으로 갖어오게 해줘. 연봉, 참여율, 연구수당, 기간" — 탭은 storage.onChanged 로 다시 그리고, 사람 표의 응답 칸에 마지막 응답(lastResponse)의 항목·기간·참여율·월급여·남은 연구수당(responseBits)을 보인다). 탭의 응답 표에서 **반영**(이 과제 줄 — 줄의 체크 상자(기간 · 참여율 · 월급여 · 연구수당)대로 그 사람의 월급여·참여율(최대 — 예산 나머지 · 100% 규칙, KRX_STAFF.maxRate — 를 넘으면 최대로; 참여율 칸에 "최대 n%")·남은 연구수당(사람의 참고 값)을 적용일~종료일에 ✎ 폼과 같은 길로, 계획에 없는 사람은 더하기)
 *      · 다른 과제 줄(항목이 이 과제가 아닌 것)은 otherBook 으로 100% 검사(KRX_STAFF.checks 의 others)에 저절로 든다 — rERP 가 모르는 다른 과제 참여율을 연구원이 직접 알려 주는 길.
 * 저장(storage.local.staffCollect) = { ["과제번호@연차" | "과제번호@연차#no"]: req }(같은 과제·연차에 요청 여럿 — 첫 요청은 접미 없음, 추가 요청은 #2 … — 탭의 [요청 추가])  req = { prjNo, year, no, title(목록 제목 — 추가 요청은 " (no)" 꼬리), listId, site(사이트 주소), path(목록 서버 상대 경로), listUrl(목록 보기 주소), formUrl(새 항목 폼 주소), ask(고른 칸 이름들 — 'Rate' · 'Monthly' · 'Allowance'), createdAt, by, message(팀즈 글 — 비면 기본 글),
 *   people[{ name, email, title(디렉터리 표시 이름), status('shared' | 'failed' | 'ambiguous' | 'notFound' | ''), candidates[], sharedAt, sentAt, error }], responses[{ id, by, email, name, title, from, to('YYYY-MM'), rate, monthly(원), allowance(원 — 남은 연구수당, 연구수당 상자를 켜고 반영하면 사람의 참고 값 person.allowance 로), note, at(ms) }], fetchedAt, fetchError, applied:{ [항목 id]: 반영 시각 } }
 *   이 브라우저에만 남고(요청한 사람의 것) 공유 파일로는 가지 않는다. 월급여처럼 민감한 값은 응답자 본인과 목록 주인(요청한 사람)만 본다(목록 보안).
 * 필요한 전역(있으면): KRX_STAFF(nameKeyOf · sameName · ymOf · isYm · ymRange · money · thousand) — 없으면(테스트 단독) 아래 대체 */
(function (g) {
  const KEY = 'staffCollect';          // storage.local — { ["과제번호@연차"]: req }
  const EMAILS_KEY = 'peopleEmails';   // storage.local — { 이름(공백 없이): 이메일 } 이름 → 이메일 캐시(팀즈 보내기 · 목록 공유 — 찾은 것 · 사용자가 적은 것)
  const TITLE_PREFIX = 'KR 참여현황';   // 목록 제목 앞머리
  const THIS = '이 과제';               // 항목(Title)이 비었거나 이 값이면 이 과제(isThis) — 0.8.9 처음 목록의 기본값(이제 기본값은 과제 제목 — titleFieldFor)
  const TEAMS_CHAT = 'https://teams.microsoft.com/l/chat/0/0';
  const PEOPLE_MAX = 40, RESP_MAX = 500, MSG_MAX = 1500, TITLE_MAX = 80;
  /* 목록의 칸 — 내부 이름(name)은 영문으로 만들고 표시 이름(title)·설명(desc)은 한글(REST 가 한글 Title 로 칸을 만들면 내부 이름이 _x…_ 로 꼬여 읽을 때 맞추기 어렵다). kind: 2 한 줄 글 · 3 여러 줄 글 · 9 수 (SP.FieldType) */
  const FIELDS = Object.freeze([
    { name: 'PeriodFrom', title: '시작 달', kind: 2, desc: '참여 시작 달 — 예) 2026-11' },   // fieldsOf(ask, period) 에 연차 기간이 오면 그 달들을 고르는 선택 칸(kind 6)
    { name: 'PeriodTo', title: '끝 달', kind: 2, desc: '참여 마지막 달 — 예) 2027-03 (한 달이면 시작과 같게)' },
    { name: 'Rate', title: '참여율(%)', kind: 9, desc: '그 기간의 월 참여율(%) — 예) 20', ask: '참여율' },
    { name: 'Monthly', title: '월급여(천원)', kind: 9, desc: '인건비 지급한도액(월급여, 천원) — 모르면 비움. 요청한 사람과 본인만 봅니다', ask: '월급여' },
    { name: 'Allowance', title: '남은 연구수당(천원)', kind: 9, desc: '올해 남은 연구수당(천원) — HR 급여명세서의 연구수당 한도에서 받은 만큼을 뺀 값. 모르면 비움. 요청한 사람과 본인만 봅니다', ask: '남은 연구수당' },
    { name: 'Note', title: '비고', kind: 3, desc: '덧붙일 말' },
  ].map(Object.freeze));
  /* 제목(항목) 칸 — 기본값은 **과제 제목**(과제명 → 별칭 → 과제번호 → "이 과제"; 2026-10-20 사용자 "항목은 이 과제가 아니고 과제 제목을 넣고"). isThis 가 과제명 앞 12자·별칭·과제번호로 알아본다 */
  const titleFieldFor = (o) => { o = o || {}; const dv = str(o.prjNm, 120) || str(o.alias, 60) || str(o.prjNo, 20) || THIS; return { title: '항목', desc: `이 과제의 참여 계획이면 "${dv}" 그대로 두고, 다른 과제의 참여율을 알릴 때는 그 과제 이름으로 고치세요(한 줄에 한 기간)`, defaultValue: dv }; };
  /* 만들 때 고르는 칸(ask 가 있는 것 — 참여율 · 월급여 · 남은 연구수당; 2026-10-20 사용자 "참여율, 월급여, 남은 연구수당은 클릭하면 해당 내용만 lists 로"). 항목·시작·끝·비고는 늘 둔다 */
  const ASK = Object.freeze(FIELDS.filter((f) => f.ask));
  const ASK_DEFAULT = Object.freeze(['Rate', 'Monthly']);
  /* 고른 칸 이름들 — 모르는 이름은 버리고 비면 기본(참여율·월급여 — 0.8.9 처음 모양의 목록과 같게) */
  function askOf(raw) {
    const names = ASK.map((f) => f.name);
    const out = (Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : []).map((s) => String(s).trim()).filter((s, i, a) => names.includes(s) && a.indexOf(s) === i);
    return out.length ? out : ASK_DEFAULT.slice();
  }
  /* eClass 직원검색(2026-10-20 사용자 "eclass 에서 조회 해서 메일 갖어오면 되는데" — SharePoint 사람 찾기가 같은 한글 이름의 gmail 게스트 계정을 고른 일): GET ECLASS_MEMBERS + 이름 → 직원 카드 HTML(membersOf). 이메일은 페이지에 없고 <아이디>@MAIL_DOMAIN(실측 ejlee → ejlee@krs.co.kr = SharePoint WorkEmail) */
  const ECLASS_MEMBERS = 'https://eclass.krs.co.kr/eClassVer4/searchmember/MemberList?searchOption=NAME&searchText=';
  const MAIL_DOMAIN = 'krs.co.kr';
  const api = { KEY, EMAILS_KEY, TITLE_PREFIX, THIS, TEAMS_CHAT, FIELDS, ASK, titleFieldFor, PEOPLE_MAX, RESP_MAX, ECLASS_MEMBERS, MAIL_DOMAIN, askOf };

  const S = () => g.KRX_STAFF;
  const str = (v, max = 200) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : v == null ? '' : String(v).replace(/\s+/g, ' ').trim().slice(0, max));
  const keep = (v, max) => (v == null ? '' : String(v)).trim().slice(0, max);   // 경로·주소 — 빈칸을 합치지 않는다(실측 2026-10-20: 목록 경로 "Lists/KR  SSCB 2"(SharePoint 가 한글을 떼어 빈칸 둘)가 str 로 "KR SSCB 2" 가 되어 [공유]가 "파일을 찾을 수 없음")
  const nameKeyOf = (s) => (S() ? S().nameKeyOf(s) : String(s == null ? '' : s).replace(/\s/g, ''));
  const sameName = (a, b) => !!nameKeyOf(a) && nameKeyOf(a) === nameKeyOf(b);
  const isYm = (s) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
  /* 'YYYY-MM' · 'YYYY.MM' · 'YYYYMM' · 'YYYY-MM-DD' · '2026년 11월' → 'YYYY-MM'. 못 읽으면 '' */
  function ymOf(v) {
    const s = String(v == null ? '' : v).trim();
    if (!s) return '';
    const m = /^(\d{4})\s*[-./년]?\s*(\d{1,2})(?:\s*월)?(?:\s*[-./]?\s*\d{1,2}\s*일?)?\s*$/.exec(s);
    if (!m) { const d = s.replace(/\D/g, ''); return d.length >= 6 ? ymOf(`${d.slice(0, 4)}-${d.slice(4, 6)}`) : ''; }
    const ym = `${m[1]}-${String(Number(m[2])).padStart(2, '0')}`;
    return isYm(ym) ? ym : '';
  }
  const num = (v) => { if (v === '' || v == null) return null; const n = Number(typeof v === 'string' ? v.replace(/[,\s%원]/g, '') : v); return Number.isFinite(n) ? n : null; };
  const email = (v) => { const s = String(v == null ? '' : v).trim().toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : ''; };
  const ms = (v) => { if (typeof v === 'number') return Number.isFinite(v) ? v : 0; const t = Date.parse(String(v || '')); return Number.isFinite(t) ? t : 0; };
  const thousand = (n) => (S() ? S().thousand(n) : String(Math.round(n / 1000)));
  /* 저장 키 — "과제번호@연차", 같은 과제·연차의 두 번째 요청부터 "#2" … (2026-10-20 사용자 "추가 리스트 요청도 해야 하는데") */
  const planKey = (prjNo, year, no) => `${prjNo}@${Number(year) || 1}${Number(no) >= 2 ? `#${Math.floor(Number(no))}` : ''}`;
  api.planKey = planKey;
  /* 저장소(또는 state.staffCollect)에서 이 과제·연차의 요청들 — no 차례 */
  api.requestsOf = (all, prjNo, year) => Object.entries(all && typeof all === 'object' ? all : {}).map(([k, v]) => normalizeRequest(v, k)).filter((r) => r && r.prjNo === String(prjNo) && r.year === (Number(year) || 1)).sort((a, b) => a.no - b.no);
  api.ymOf = ymOf;
  api.email = email;

  /* ---------- eClass 직원검색 ---------- */
  /* 직원검색 응답 HTML → [{ id, name(한글), title(영문 이름), position(직급), dept(부서), email(<아이디>@krs.co.kr) }]. 직원검색 페이지가 아니면(search_option 도 person_main 도 없음 — 로그인 화면) null.
   *   카드 <div class="item person_main">: 아이디는 사진의 copyToClipboard('<아이디>')(없으면 member/pic/<아이디>.gif) · <h3 class="Korean"> 이름 · <h3 class="English"> 영문 이름 · <h4 class="search_info_position Korean"> 직급 · 부서 <p class="Korean clickable">. 서비스워커에는 DOMParser 가 없어 정규식으로 */
  function membersOf(html) {
    const s = String(html == null ? '' : html);
    if (!/search_option|person_main/.test(s)) return null;
    // 실측(2026-10-20): 한글이 &#xC774; 꼴 숫자 엔티티로 온다 — 태그를 뗀 뒤 엔티티를 푼다
    const decode = (t) => t.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&(amp|lt|gt|quot|nbsp|#39);/g, (_, k) => ({ amp: '&', lt: '<', gt: '>', quot: '"', nbsp: ' ', '#39': "'" })[k]);
    const text = (m) => (m ? decode(m[1].replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim() : '');
    const out = [];
    for (const chunk of s.split(/class="item person_main"/).slice(1)) {
      const idm = /copyToClipboard\('([^']+)'\)/.exec(chunk) || /member\/pic\/([^"./]+)\.gif/.exec(chunk);
      const id = idm ? idm[1].trim().toLowerCase() : '', name = text(/<h3[^>]*class="Korean"[^>]*>([\s\S]*?)<\/h3>/.exec(chunk));
      if (!id || !name) continue;
      out.push({ id, name, title: text(/<h3[^>]*class="English"[^>]*>([\s\S]*?)<\/h3>/.exec(chunk)), position: text(/<h4[^>]*search_info_position Korean[^>]*>([\s\S]*?)<\/h4>/.exec(chunk)), dept: text(/<p[^>]*class="Korean clickable"[^>]*>([\s\S]*?)<\/p>/.exec(chunk)), email: `${id}@${MAIL_DOMAIN}` });
    }
    return out;
  }
  /* 직원 카드들 가운데 그 이름(공백 무시)인 사람 → 1명이면 { email, title(영문 이름), dept }, 동명이인이면 { candidates:["이름 (부서 직급) <이메일>"] }(탭의 이메일 칸이 선택 상자가 된다 — candidateEmail · candidateLabel), 없으면 null */
  function pickMember(members, name) {
    const hits = (Array.isArray(members) ? members : []).filter((m) => m && sameName(m.name, name));
    if (hits.length === 1) return { email: hits[0].email, title: hits[0].title, dept: hits[0].dept };
    return hits.length ? { candidates: hits.map((m) => { const d = [m.dept, m.position].filter(Boolean).join(' '); return `${m.name}${d ? ` (${d})` : ''} <${m.email}>`; }) } : null;
  }
  /* 후보 글 "이름 (부서 직급) <이메일>" → 이메일(없으면 '') · 라벨(이메일 앞부분) */
  const candidateEmail = (s) => { const m = /<([^<>\s@]+@[^<>\s]+)>\s*$/.exec(String(s == null ? '' : s)); return m ? m[1].toLowerCase() : ''; };
  const candidateLabel = (s) => String(s == null ? '' : s).replace(/\s*<[^<>]*>\s*$/, '').trim();
  api.membersOf = membersOf; api.pickMember = pickMember; api.candidateEmail = candidateEmail; api.candidateLabel = candidateLabel;

  /* ---------- 모양 ---------- */
  const STATUS = ['shared', 'failed', 'ambiguous', 'notFound', ''];
  function normalizePerson(raw) {
    raw = raw || {};
    const name = str(raw.name, 40);
    return { name, email: email(raw.email), title: str(raw.title, 60), status: STATUS.includes(raw.status) ? raw.status : '', candidates: (Array.isArray(raw.candidates) ? raw.candidates : []).map((x) => str(x, 80)).filter(Boolean).slice(0, 10),
      sharedAt: ms(raw.sharedAt), sentAt: ms(raw.sentAt), error: str(raw.error, 200), sendError: str(raw.sendError, 200) };
  }
  /* 응답 한 줄 — id(목록 항목 Id) 가 없으면 null. monthly 는 원(천원 입력 × 1000 은 responsesOfItems 가 한다) */
  function normalizeResponse(raw) {
    raw = raw || {};
    const id = str(raw.id, 20);
    if (!id) return null;
    const rate = num(raw.rate), won = (v) => { const n = num(v); return n != null && n > 0 ? Math.round(n) : null; };
    return { id, by: str(raw.by, 60), email: email(raw.email), name: str(raw.name, 40), title: str(raw.title, 100), from: ymOf(raw.from), to: ymOf(raw.to) || ymOf(raw.from),
      rate: rate != null && rate >= 0 && rate <= 100 ? rate : null, monthly: won(raw.monthly), allowance: won(raw.allowance), note: str(raw.note, 500), at: ms(raw.at) };
  }
  /* 요청 하나 — prjNo 가 없으면 null. people 은 이름마다 하나(공백 무시), responses 는 id 마다 하나 */
  function normalizeRequest(raw, key = '') {
    if (!raw || typeof raw !== 'object') return null;
    const k = String(key || '').split('@'), yk = String(k[1] || '').split('#');
    const prjNo = str(raw.prjNo, 40) || str(k[0], 40);
    const year = Number(raw.year) >= 1 ? Math.floor(Number(raw.year)) : Number(yk[0]) >= 1 ? Number(yk[0]) : 1;
    const no = Number(raw.no) >= 1 ? Math.floor(Number(raw.no)) : Number(yk[1]) >= 1 ? Math.floor(Number(yk[1])) : 1;   // 같은 과제·연차의 몇 번째 요청인가(키의 #n, 첫 요청은 1)
    if (!prjNo) return null;
    const seen = new Set(), people = [];
    for (const p of Array.isArray(raw.people) ? raw.people : []) { const q = normalizePerson(p); const nk = nameKeyOf(q.name); if (!nk || seen.has(nk) || people.length >= PEOPLE_MAX) continue; seen.add(nk); people.push(q); }
    const ids = new Set(), responses = [];
    for (const r of Array.isArray(raw.responses) ? raw.responses : []) { const x = normalizeResponse(r); if (!x || ids.has(x.id) || responses.length >= RESP_MAX) continue; ids.add(x.id); responses.push(x); }
    responses.sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
    const applied = {};
    for (const [id, v] of Object.entries(raw.applied && typeof raw.applied === 'object' ? raw.applied : {})) { const t = ms(v); if (t) applied[str(id, 20)] = t; }
    return { prjNo, year, no, title: str(raw.title, TITLE_MAX), listId: str(raw.listId, 60), site: keep(raw.site, 300), path: keep(raw.path, 400), listUrl: keep(raw.listUrl, 600), formUrl: keep(raw.formUrl, 600), ask: askOf(raw.ask),
      chat: keep(raw.chat, 600), sentChatAt: ms(raw.sentChatAt), createdAt: ms(raw.createdAt), by: str(raw.by, 40), message: typeof raw.message === 'string' ? raw.message.trim().slice(0, MSG_MAX) : '', people, responses, fetchedAt: ms(raw.fetchedAt), fetchError: str(raw.fetchError, 300), applied };
  }
  function normalizeAll(raw) {
    const out = {};
    for (const [k, v] of Object.entries(raw && typeof raw === 'object' ? raw : {})) { const r = normalizeRequest(v, k); if (r) out[planKey(r.prjNo, r.year, r.no)] = r; }
    return out;
  }
  api.normalizePerson = normalizePerson; api.normalizeResponse = normalizeResponse; api.normalizeRequest = normalizeRequest; api.normalizeAll = normalizeAll;
  /* 이름 → 이메일 캐시 모양 { 이름키: 이메일 } */
  function normalizeEmails(raw) {
    const out = {};
    for (const [k, v] of Object.entries(raw && typeof raw === 'object' ? raw : {})) { const nk = nameKeyOf(k), e = email(v); if (nk && e) out[nk] = e; }
    return out;
  }
  api.normalizeEmails = normalizeEmails;

  /* ---------- 목록 ---------- */
  /* 목록 제목 — "KR 참여현황 <별칭 또는 과제명 앞부분 또는 과제번호> n차년도". SharePoint 목록 제목에 못 쓰는 글자(\ / : * ? " < > | # { } % ~ &)를 걷고 80자 */
  function listTitleFor(o) {
    o = o || {};
    const clean = (s) => str(s, 60).replace(/[\\/:*?"<>|#{}%~&]/g, '').replace(/\s+/g, ' ').trim();
    const label = clean(o.alias) || clean(String(o.prjNm || '').slice(0, 20)) || clean(o.prjNo) || '과제';
    return `${TITLE_PREFIX} ${label} ${Number(o.year) >= 1 ? Math.floor(Number(o.year)) : 1}차년도${Number(o.no) >= 2 ? ` (${Math.floor(Number(o.no))})` : ''}`.slice(0, TITLE_MAX);   // 추가 요청은 " (2)" …
  }
  api.listTitleFor = listTitleFor;
  /* 기간의 달들 'YYYY-MM'(최대 36) — 시작·끝 달 칸의 고르기 목록. 못 읽거나 거꾸로면 [] */
  function ymRange(from, to) {
    const a = ymOf(from), b = ymOf(to); if (!a || !b || a > b) return [];
    const out = []; let [y, m] = a.split('-').map(Number);
    while (out.length < 36) { const ym = `${y}-${String(m).padStart(2, '0')}`; out.push(ym); if (ym >= b) break; if (++m > 12) { m = 1; y++; } }
    return out;
  }
  api.ymRange = ymRange;
  /* 목록을 만들 때의 칸들(KRX_SP writer.createList 의 fields) — 고르는 칸은 ask(askOf)에 든 것만, 사본. period { from, to }('YYYY-MM' — 연차 기간)가 읽히면 시작·끝 달은 그 달들을 고르는 **선택 칸**(kind 6 + choices, 기간 밖은 직접 입력 — 2026-10-20 사용자 "달력으로 입력하도록이 아니라 해당 년도, 월 … 리스트에서 나오게") */
  api.fieldsOf = (ask, period) => {
    const on = askOf(ask), months = period ? ymRange(period.from, period.to) : [];
    return FIELDS.filter((f) => !f.ask || on.includes(f.name)).map(({ name, title, kind, desc }) => (months.length && (name === 'PeriodFrom' || name === 'PeriodTo')
      ? { name, title, kind: 6, desc: `${desc.replace(/ — 예\).*$/, '')} — 목록에서 고르세요(기간 밖이면 YYYY-MM 로 직접 입력)`, choices: months.slice() }
      : { name, title, kind, desc }));
  };
  /* 고른 칸의 짧은 이름들 — "참여율 · 월급여" */
  api.askLabels = (ask) => askOf(ask).map((n) => FIELDS.find((f) => f.name === n).ask);
  /* 목록 설명 */
  api.listDescription = (o) => { o = o || {}; return `${o.label || o.prjNo || '과제'} ${o.year || 1}차년도 참여연구원 참여 계획 응답 — KR eClass 확장(참여연구원 변경 › 자료 요청)이 만든 양식. 한 줄에 한 기간씩 적어 주세요.`; };

  /* ---------- 팀즈 ---------- */
  /* 기본 글 = 템플릿(설정 › LLM 설정 › 팀즈 MCP › 팀즈 글 템플릿 settings.teams.template — 비면 TEMPLATE)에 자리표를 채운 것(2026-10-20 사용자 "템플릿 작성하도록 하면 내가 수정할 수 있도록 … 플레이스 홀더로 과제 제목, 기간, 링크").
   * 자리표 PLACEHOLDERS: {과제}(별칭 — 과제명, 없으면 과제번호) · {별칭} · {과제명} · {과제번호} · {연차} · {기간}(시작 ~ 끝, 모르면 "n차년도") · {시작} · {끝} · {항목}(참여 기간 + 고른 칸) · {양식}(새 항목 폼 주소) · {보낸사람}. 모르는 자리표는 그대로 둔다.
   * 빈 줄은 문단 띄우기 — 팀즈 MCP 는 HTML(줄바꿈 <br> · 주소는 링크)로 보내고(lib/teams-mcp.js toHtml) 딥 링크는 글 그대로 */
  const TEMPLATE = '[{과제}] {연차}차년도 참여연구원 자료 요청\n\n기간 {기간}의 {항목}를 아래 양식에 적어 주세요.\n다른 과제에 참여 중이면 그 과제 이름으로 한 줄씩 더 적어 주시면 참여율 합(100%)을 같이 봅니다.\n\n양식: {양식}';
  const PLACEHOLDERS = ['과제', '별칭', '과제명', '과제번호', '연차', '기간', '시작', '끝', '항목', '양식', '보낸사람'];
  function fill(template, vars) {
    return String(template || '').replace(/\{([^{}]+)\}/g, (m, k) => (k in vars ? String(vars[k] == null ? '' : vars[k]) : m)).replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
  }
  function defaultMessage(o) {
    o = o || {};
    const year = o.year || 1;
    const vars = {
      '과제': [o.alias, o.prjNm].filter(Boolean).join(' — ') || o.prjNo || '과제', '별칭': o.alias || '', '과제명': o.prjNm || '', '과제번호': o.prjNo || '', '연차': year,
      '기간': o.from && o.to ? `${o.from} ~ ${o.to}` : `${year}차년도`, '시작': o.from || '', '끝': o.to || '',
      '항목': ['참여 기간(시작·끝 달)'].concat(askOf(o.ask).map((n) => FIELDS.find((f) => f.name === n).title)).join(' · '),
      '양식': o.formUrl || '', '보낸사람': o.who || ''
    };
    return fill(String(o.template || '').trim() || TEMPLATE, vars);
  }
  api.TEMPLATE = TEMPLATE; api.PLACEHOLDERS = PLACEHOLDERS; api.fill = fill; api.defaultMessage = defaultMessage;
  /* 요청의 팀즈 글 — 고친 글(req.message)이 있으면 그것, 없으면 기본 글(고른 칸대로 · o.template = 설정의 템플릿) */
  api.messageOf = (req, o) => (req && req.message ? req.message : defaultMessage(Object.assign({ formUrl: req && req.formUrl, year: req && req.year, ask: req && req.ask }, o || {})));
  /* Teams 채팅 딥 링크 — users 는 이메일(여럿이면 그룹 채팅), message 는 입력란에 미리 채울 글(Teams 가 보내지는 않는다 — 사용자가 보내기를 누름). 이메일이 없으면 '' */
  function teamsLink(emails, message, topic) {
    const list = (Array.isArray(emails) ? emails : [emails]).map(email).filter(Boolean);
    if (!list.length) return '';
    const q = [`users=${encodeURIComponent(list.join(','))}`];
    if (list.length > 1 && topic) q.push(`topicName=${encodeURIComponent(str(topic, 60))}`);
    if (message) q.push(`message=${encodeURIComponent(String(message).slice(0, MSG_MAX))}`);
    return `${TEAMS_CHAT}?${q.join('&')}`;
  }
  api.teamsLink = teamsLink;
  /* 기존 채팅방(단체·1:1) — 사용자가 적은 링크(Teams 에서 그 방의 메시지 › 기타 옵션 › 링크 복사: https://teams.microsoft.com/l/message/<chatId>/<messageId>?… · /l/chat/<chatId>/conversations)나 ID 그대로에서 채팅 ID(19:…@thread.v2 · @unq.gbl.spaces)를 꺼낸다. 없으면 '' */
  function chatIdOf(s) {
    let t = String(s == null ? '' : s).trim(); try { t = decodeURIComponent(t); } catch (e) {}
    const m = /19:[A-Za-z0-9._-]+@(?:thread\.v2|unq\.gbl\.spaces|thread\.skype|thread\.tacv2)/.exec(t);
    return m ? m[0] : '';
  }
  /* 기존 채팅방 딥 링크 — 그 채팅을 연다(https://teams.microsoft.com/l/chat/<chatId>/conversations). message 는 새 채팅 링크에만 문서화돼 있어 채워지지 않을 수 있다(그때는 팀즈 글을 붙여 넣기). ID 가 아니면 '' */
  const chatLink = (chatId, message) => { const id = chatIdOf(chatId); return id ? `https://teams.microsoft.com/l/chat/${encodeURIComponent(id)}/conversations${message ? `?message=${encodeURIComponent(String(message).slice(0, MSG_MAX))}` : ''}` : ''; };
  api.chatIdOf = chatIdOf; api.chatLink = chatLink;

  /* ---------- 응답 ---------- */
  /* 항목(Title)이 이 과제인가 — 비었거나 "이 과제" 거나 별칭·과제번호·과제명(앞 12자)을 품으면 */
  function isThis(title, ctx) {
    const t = nameKeyOf(title).toLowerCase();
    if (!t || t === nameKeyOf(THIS)) return true;
    ctx = ctx || {};
    // 항목이 별칭·과제번호·과제명 앞부분을 품으면(또는 넉 자 이상의 항목이 그 앞부분에 들어 있으면 — "MW" 같은 두세 글자는 다른 과제 이름의 조각일 수 있어 안 봄)
    for (const k of [ctx.alias, ctx.prjNo, String(ctx.prjNm || '').slice(0, 12)]) { const kk = nameKeyOf(k).toLowerCase(); if (kk && kk.length >= 2 && (t.includes(kk) || (t.length >= 4 && kk.includes(t)))) return true; }
    return false;
  }
  api.isThis = isThis;
  /* 목록 항목(KRX_SP.listItems — nometadata: Id · Title · PeriodFrom · PeriodTo · Rate · Monthly · Note · Modified · Author{ Title, EMail }) → 응답 줄들(최신 먼저). 사람 이름은 Author 이메일이 req.people 의 이메일과 같은 사람, 없으면 표시 이름이 이름과 같은 사람, 그것도 없으면 표시 이름 그대로.
   *   월급여는 천원으로 적게 했으므로 × 1000(원) — 100만 넘게 적었으면(원으로 적은 것) 그대로 */
  function responsesOfItems(items, req, names) {
    const people = (req && Array.isArray(req.people) ? req.people : []).map((p) => ({ name: p.name, email: email(p.email), title: p.title }));
    const known = Array.from(new Set(people.map((p) => p.name).concat(Array.isArray(names) ? names : [])));
    const out = [];
    for (const it of Array.isArray(items) ? items : []) {
      if (!it || typeof it !== 'object' || it.Id == null) continue;
      const a = it.Author && typeof it.Author === 'object' ? it.Author : {};
      const by = str(a.Title || a.title, 60), em = email(a.EMail || a.Email || a.email);
      let name = '';
      const byMail = em ? people.find((p) => p.email && p.email === em) : null;
      if (byMail) name = byMail.name;
      else { const hit = known.find((n) => sameName(n, by)) || (people.find((p) => p.title && sameName(p.title, by)) || {}).name; name = hit || by; }
      const won = (v) => { const n = num(v); return n == null ? null : n >= 1000000 ? n : n * 1000; };   // 천원으로 적게 했으므로 × 1000 — 100만 넘으면 원으로 적은 것
      const r = normalizeResponse({ id: String(it.Id), by, email: em, name, title: str(it.Title, 100), from: it.PeriodFrom, to: it.PeriodTo, rate: it.Rate, monthly: won(it.Monthly), allowance: won(it.Allowance), note: it.Note, at: it.Modified || it.Created });
      if (r && out.length < RESP_MAX) out.push(r);
    }
    return out.sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
  }
  api.responsesOfItems = responsesOfItems;
  /* 다른 과제 참여율 — 항목이 이 과제가 아닌 응답에서 { 이름키: [{ ym, rate, label }] }(KRX_STAFF.mergeOthers 의 book — checks 의 100% 검사). 같은 사람의 같은 달에 여러 과제면 모두 더한다(줄마다). 기간이 없는 줄은 뺀다 */
  function otherBook(req, ctx) {
    const out = {};
    const range = S() ? S().ymRange : (a, b) => { const o = []; let [y, m] = a.split('-').map(Number); for (let i = 0; i < 240; i++) { const ym = `${y}-${String(m).padStart(2, '0')}`; if (ym > b) break; o.push(ym); m++; if (m > 12) { m = 1; y++; } } return o; };
    for (const r of (req && Array.isArray(req.responses)) ? req.responses : []) {
      if (isThis(r.title, ctx) || !(r.rate > 0) || !r.from) continue;
      const k = nameKeyOf(r.name);
      if (!k) continue;
      for (const ym of range(r.from, r.to || r.from)) (out[k] = out[k] || []).push({ ym, rate: r.rate, label: `${r.title}(응답)` });
    }
    return out;
  }
  api.otherBook = otherBook;
  /* 이 과제 줄 가운데 아직 반영하지 않은 것(최신 먼저) */
  api.pending = (req, ctx) => ((req && req.responses) || []).filter((r) => isThis(r.title, ctx) && !(req.applied || {})[r.id]);
  /* 사람마다 응답 수·마지막 응답 시각 { 이름키: { n, at } } */
  function responseStats(req) {
    const out = {};
    for (const r of (req && req.responses) || []) { const k = nameKeyOf(r.name); if (!k) continue; const s = out[k] = out[k] || { n: 0, at: 0 }; s.n++; if (r.at > s.at) s.at = r.at; }
    return out;
  }
  api.responseStats = responseStats;
  /* 그 사람의 마지막 응답 줄(responses 는 최신 먼저) | null — 사람 표의 응답 칸 */
  api.lastResponse = (req, name) => ((req && req.responses) || []).find((r) => sameName(r.name, name)) || null;
  const POLL_DAYS = 14, POLL_ERR_MS = 3600000;
  /* 자동 갱신(background.js collectPoll — onAlarm)마다 응답을 다시 읽을 요청인가: 목록이 있고, 팀즈로 보낸 지 14일 안인데 아직 회신이 없는 사람이 있을 때(채팅방에 보낸 요청은 이메일 있는 사람 모두). 못 읽은 지 1시간 안이면 쉰다(로그인이 풀렸을 때 10분마다 실패를 쌓지 않게) */
  function needsPoll(req, now = Date.now()) {
    if (!req || !req.listId) return false;
    if (req.fetchError && now - (req.fetchedAt || 0) < POLL_ERR_MS) return false;
    const stats = responseStats(req), fresh = (t) => t > 0 && now - t < POLL_DAYS * 86400000;
    return (req.people || []).some((p) => !stats[nameKeyOf(p.name)] && (fresh(p.sentAt) || (!!p.email && fresh(req.sentChatAt))));
  }
  api.needsPoll = needsPoll;
  /* 요약 한 줄 — "공유 1/3명 · 응답 2명 (4건) · 미반영 1건". 사람이 없으면 "사람 없음" */
  function summary(req, ctx) {
    if (!req) return '';
    const people = req.people || [], stats = responseStats(req);
    const shared = people.filter((p) => p.status === 'shared').length;
    const responded = Object.keys(stats).length;   // 응답한 사람 수(대상 밖의 응답자도)
    const n = (req.responses || []).length;
    const pending = api.pending(req, ctx).length;
    return [people.length ? `공유 ${shared}/${people.length}명` : '사람 없음', `응답 ${responded}명${n ? ` (${n}건)` : ''}`, pending ? `미반영 ${pending}건` : ''].filter(Boolean).join(' · ');
  }
  api.summary = summary;
  /* 응답 한 줄 글(변경 도우미 요약 · 메시지) — "문창재 — 이 과제 2026-11~2027-03 25% · 월급여 5,823천원 · 반영됨" */
  /* 응답 한 줄의 조각들 [항목, 기간, 참여율, 월급여, 남은 연구수당, 비고](없는 값은 뺌 — 항목·기간·참여율은 "없음"으로) — responseText 와 사람 표의 응답 칸(lib/staff-ui.js) 공용 */
  function responseBits(r, ctx) {
    const span = r.from ? `${r.from}${r.to && r.to !== r.from ? `~${r.to}` : ''}` : '기간 없음';
    return [isThis(r.title, ctx) ? THIS : r.title || '(항목 없음)', span, r.rate != null ? `${r.rate}%` : '참여율 없음', r.monthly ? `월급여 ${thousand(r.monthly)}천원` : '', r.allowance ? `남은 연구수당 ${thousand(r.allowance)}천원` : '', r.note ? `"${r.note.slice(0, 40)}"` : ''].filter(Boolean);
  }
  api.responseBits = responseBits;
  function responseText(r, req, ctx) {
    return `${r.name || r.by || '?'} — ${responseBits(r, ctx).join(' · ')}${(req && req.applied && req.applied[r.id]) ? ' · 반영됨' : isThis(r.title, ctx) ? ' · 미반영' : ' · 100% 검사에 씀'}`;
  }
  api.responseText = responseText;
  api.summaryLines = (req, ctx) => ((req && req.responses) || []).slice(0, 30).map((r) => responseText(r, req, ctx));

  /* ---------- 저장 ---------- */
  async function load() { try { const r = await chrome.storage.local.get(KEY); return normalizeAll(r[KEY]); } catch (e) { return {}; } }
  async function save(all) { await chrome.storage.local.set({ [KEY]: normalizeAll(all) }); }
  /* 요청 하나만 갈아 넣는다(저장소를 읽어 다른 과제·연차는 그대로). req 가 null 이면 지움 */
  async function put(prjNo, year, req, no) {
    const all = await load();
    no = Number(no) >= 1 ? Math.floor(Number(no)) : req && Number(req.no) >= 1 ? Math.floor(Number(req.no)) : 1;
    const key = planKey(prjNo, year, no);
    if (req) all[key] = Object.assign({}, req, { prjNo, year, no }); else delete all[key];
    await save(all);
    return all;
  }
  async function loadEmails() { try { const r = await chrome.storage.local.get(EMAILS_KEY); return normalizeEmails(r[EMAILS_KEY]); } catch (e) { return {}; } }
  /* 이름 → 이메일을 캐시에 더한다(있는 것은 덮음). map = { 이름: 이메일 } */
  async function rememberEmails(map) {
    const cur = await loadEmails();
    for (const [k, v] of Object.entries(normalizeEmails(map))) cur[k] = v;
    await chrome.storage.local.set({ [EMAILS_KEY]: cur });
    return cur;
  }
  Object.assign(api, { load, save, put, loadEmails, rememberEmails, nameKeyOf });
  g.KRX_COLLECT = api;
})(typeof self !== 'undefined' ? self : this);
