/* 서비스워커: 데이터 수집/캐시, 배지, 캡처 로그 저장, 주기 갱신 */
importScripts('lib/format.js', 'lib/settings.js', 'lib/rnd-api.js', 'lib/hr-api.js', 'lib/llm.js', 'lib/prep-store.js', 'lib/classify-core.js', 'lib/claude-api.js', 'lib/prep-ai.js', 'lib/fetch-sites.js', 'lib/prep-fetch.js', 'lib/rcms.js',   // llm: Help 서버(LLM) 연결 상태 → storage.local.llmStatus · classify-core·claude-api: 자동 분류를 Claude API 로 직접 (0.8.6) · prep-fetch: 청구 준비의 증빙 찾아오기 (Help 서버 → site-fetch/)
  'lib/plan.js', 'lib/plan-sync.js',   // 공유 (Plus) 의 예상 비용 몫: plan.js 는 저장소 키·월간 구독 계산용, plan-sync.js 는 병합 규칙(merge)
  'lib/research.js', 'lib/research-sync.js',   // 연구개발계획서(연구내용) 참조 · 공유 (Plus) 의 연구내용 병합 규칙(merge)
  'lib/staff.js', 'lib/staff-sync.js',   // 사업비(참여연구원 참여율·지급액 계획, 0.8.7) · 공유 (Plus) 의 사업비 병합 규칙(merge)
  'lib/sp-store.js', 'lib/prjdoc.js', 'lib/prjdoc-sync.js');   // 공유 (Plus, 2026-10-18 부터 SharePoint 폴더의 과제별 JSON 파일): sp-store 저장소 접근(브라우저 로그인 쿠키 · 작업 탭) · prjdoc 문서 모양·병합 · prjdoc-sync 과제별 차례 — 배선은 아래 shareSync

const CACHE_KEY = 'cache';
const CAPTURE_KEY = 'captureLog';
const CAPTURE_MAX = 150;
const ALARM = 'krext-refresh';
let inflight = null, inflightFull = false;   // 진행 중인 조회, 그 조회가 참여인력 캐시까지 건너뛰는 전체 조회인지
let settingsGen = 0;   // 설정이 바뀔 때마다 증가. 조회 도중 바뀌면 그 결과(이전 설정 기준)는 버리고 새 설정으로 다시 조회

async function getCache() { return (await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY] || null; }

function updateBadge(data) {
  try {
    if (!data) return;
    if (data.loginRequired) {
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#8a8f98' });
      chrome.action.setTitle({ title: data.eclassLogin ? 'R&D ERP 현황 - eClass 로그인 필요 (eClass에 로그인하면 R&D ERP는 자동으로 다시 로그인합니다)'
        : (data.autoLogin && !data.autoLogin.ok) ? `R&D ERP 현황 - 로그인 필요 (자동 로그인 실패: ${data.autoLogin.error || data.autoLogin.kind}) — eClass의 R&D ERP 메뉴를 클릭해서 로그인해주세요`
        : 'R&D ERP 현황 - 로그인 필요 (eClass의 R&D ERP 메뉴를 클릭해서 로그인해주세요)' });
      return;
    }
    // 미승인내역(보완요청 + 신청)은 실시간값, 없으면 메인화면 방문 시 읽은 스냅샷
    const cards = KRX_FMT.num(data.totalCount) || 0;
    let supplement = 0, apply = 0;
    if (data.unapproved) {
      supplement = KRX_FMT.num(data.unapproved.supplement) || 0;
      apply = KRX_FMT.num(data.unapproved.apply) || 0;
    } else if (data.unapprovedSnapshot && data.unapprovedSnapshot.items) {
      const it = data.unapprovedSnapshot.items;
      supplement = KRX_FMT.num(it['보완요청'] && it['보완요청'].count) || 0;
      apply = KRX_FMT.num(it['신청'] && it['신청'].count) || 0;
    }
    // 내가 결재해야 하는 건수(받은 결재요청 = 내 결재대기)가 있으면 그 수를 빨간 배지로 우선 표시, 없으면 카드미청구 건수를 회색 배지로 표시.
    // 보완요청·신청(내가 올린 결의서의 상태)은 배지에 더하지 않는다 — 내가 올린 신청 1건이 결재할 일처럼 보였다는 요청(2026-09-25). 항목별 건수는 아이콘 툴팁에
    const inbox = KRX_FMT.num(data.inbox && data.inbox.mine) || 0;   // 받은 결재요청(내 결재대기, rmain_0002_01_r001 USER_APPR_CNT)
    const pending = inbox;
    if (pending > 0) {
      chrome.action.setBadgeText({ text: String(pending) });
      chrome.action.setBadgeBackgroundColor({ color: '#d7263d' });
    } else {
      chrome.action.setBadgeText({ text: cards > 0 ? String(cards) : '' });
      chrome.action.setBadgeBackgroundColor({ color: '#8a8f98' });
    }
    chrome.action.setTitle({ title: `R&D ERP 현황 - 보완요청 ${supplement}건 · 신청 ${apply}건 · 받은 결재요청 ${inbox}건 · 카드미청구 ${cards}건` });
  } catch (e) {}
}

/* R&D ERP 세션이 풀렸을 때(조회가 "로그인 필요"로 끝남) eClass SSO 로 다시 로그인 — KRX_API.ssoLogin (lib/rnd-api.js: eClass loginCheck 로 UID·SID → sso_login_krs.jct → rderp_layoutMain.act POST).
 * 탭을 열지 않고 백그라운드 fetch 만으로 끝나며(0.5초 안팎), 새 JSESSIONID 는 브라우저 쿠키 저장소에 들어가므로 열려 있는 ERP 탭도 같이 살아난다. 비밀번호·UID·SID 는 저장하지 않는다.
 * 동시 호출은 하나로 합친다. 반환 { ok:true, ts, ms, url } | { ok:false, ts, ms, kind, error } — kind 'eclass-login' 은 eClass 세션이 없어 사용자가 eClass 에 로그인해야 하는 경우 */
const RND_SSO_RETRY_MS = 60000;   // "로그인 필요"로 끝난 캐시를 다시 조회(→ SSO 재시도)하기까지의 최소 간격
let rndSsoInflight = null;
async function rndAutoLogin() {
  if (rndSsoInflight) return rndSsoInflight;
  rndSsoInflight = (async () => {
    const ts = Date.now();
    try { const r = await KRX_API.ssoLogin(); return { ok: true, ts, ms: Date.now() - ts, url: r.url }; }
    catch (e) { return { ok: false, ts, ms: Date.now() - ts, kind: (e && e.kind) || 'error', error: String((e && e.message) || e) }; }
  })().finally(() => { rndSsoInflight = null; });
  return rndSsoInflight;
}

/* force: 캐시 TTL 과 상관없이 다시 조회. opts.full: 참여인력(계상률) 캐시(2시간)도 건너뛰고 과제마다 다시 조회 — 패널·팝업의 ↻ 처럼 사용자가 직접 누른 새로고침만.
 * 알람·설정 변경·청구서 작성 뒤의 자동 조회는 참여인력 캐시를 그대로 쓴다 (과제마다 한 번씩 부르는 조회라 무거움).
 * 보통 조회가 진행 중일 때 전체 조회를 요청하면 그 조회가 끝난 뒤 이어서 전체 조회를 한다 */
async function refresh(force, opts) {
  let full = !!(opts && opts.full);
  if (inflight) return (full && !inflightFull) ? inflight.then(() => refresh(true, opts), () => refresh(true, opts)) : inflight;
  inflightFull = full;
  inflight = (async () => {
    for (;;) {
      const gen = settingsGen;
      const settings = await KRX_SETTINGS.load();
      const cache = await getCache();
      KRX_LLM.probe((settings.help || {}).url, false).catch(() => {});   // LLM(Help 서버) 연결 상태 → storage.local.llmStatus (패널의 찾아오기 버튼·설정 페이지가 봄). 30초 안이면 마지막 결과
      const ttl = Math.max(1, KRX_FMT.num(settings.refreshMinutes) || 10) * 60000;
      // 오류로 끝난 결과(예: 재로드 직후 일시적 네트워크 오류)는 TTL 과 상관없이 다시 조회.
      // "로그인 필요"로 끝난 결과도 자동 로그인이 켜져 있으면 RND_SSO_RETRY_MS 뒤부터 다시 조회 — eClass 에 로그인하고 돌아오면 다음 패널 열기/알람에서 SSO 로 이어진다 (실패해도 요청 2개라 가벼움)
      const retryLogin = !!(cache && cache.loginRequired && settings.rndAutoLogin !== false && Date.now() - cache.ts >= RND_SSO_RETRY_MS);
      if (!force && cache && cache.ts && !cache.error && !retryLogin && Date.now() - cache.ts < ttl) { updateBadge(cache); return cache; }
      let data = await KRX_API.collect(settings, { freshMembership: full });
      if (data.loginRequired && settings.rndAutoLogin !== false) {   // 세션이 풀림 → eClass SSO 로 다시 로그인한 뒤 한 번 더 조회 (rndAutoLogin). eClass 도 풀려 있으면 eclassLogin 으로 안내
        const sso = await rndAutoLogin();
        if (sso.ok) { data = await KRX_API.collect(settings, { freshMembership: full }); data.autoLogin = { ok: true, ts: sso.ts, ms: sso.ms }; }
        else { data.eclassLogin = sso.kind === 'eclass-login'; data.autoLogin = { ok: false, ts: sso.ts, kind: sso.kind, error: sso.error }; }
      }
      full = false;   // 참여인력은 방금 다시 조회했으므로 이 뒤의 재조회(설정 변경·사번 감지)는 캐시로
      if (gen !== settingsGen) { force = true; continue; }   // 조회 중 설정이 바뀜(예: 과제 제외) → 이 결과는 캐시하지 않고 다시 조회
      if (data.memberFilter === 'no-id' && !data.loginRequired) {
        // 사번/이름을 아직 모름 → 열려 있는 ERP 탭이 있으면 브리지를 넣어 직접 읽어 온 뒤 한 번 더 판정
        await injectBridgeIntoOpenErpTabs();
        const u = (await chrome.storage.local.get('rndUser')).rndUser;
        if (u && (u.userId || u.empNo || u.userNm)) { const al = data.autoLogin; data = await KRX_API.collect(settings); if (al) data.autoLogin = al; }
      }
      const issued = data.issued || [];
      const projectList = data.projectList || [];
      delete data.issued;
      delete data.projectList;
      try { data.hrPay = (await chrome.storage.local.get('hrPay')).hrPay || null; } catch (e) {}   // 조회 도중 HR 급여명세서가 수집됐을 수 있어 저장 직전 값으로
      await chrome.storage.local.set({ [CACHE_KEY]: data });
      if (!data.loginRequired && data.memberFilter !== 'no-id' && !data.error) {
        // 설정 페이지의 과제 선택 / 발급 카드 목록: 참여 과제만 저장 (다른 과제 정보는 저장하지 않음)
        await chrome.storage.local.set({
          projectList: { ts: data.ts, projects: projectList },
          issuedCards: { ts: data.ts, projects: issued }
        });
      }
      updateBadge(data);
      // 청구 준비(패널에서 고른 청구종류·첨부 파일): 임시저장·신청 상태를 ERP 결의서 목록과 맞춘 뒤, 미청구 목록에서 사라진 거래의 항목은 7일 뒤, 신청까지 끝난 항목은 하루 뒤 정리 (lib/prep-store.js)
      if (!data.loginRequired && !data.error && data.memberFilter !== 'no-id') {
        try { await syncSlipStatus(settings); } catch (e) {}
        try { await KRX_PREP_STORE.cleanup(prepKeysOf(data)); } catch (e) {}
      }
      return data;
    }
  })().finally(() => { inflight = null; inflightFull = false; });
  return inflight;
}

/* 지금 미청구 목록에 있는 거래의 청구 준비 키(승인번호|카드 뒤 4자리): 과제별 카드 + 카드별 묶음 + 미귀속 묶음 */
function prepKeysOf(data) {
  const keys = new Set();
  const add = (c) => { const k = KRX_FMT.prepKey(c && c.apprNo, c && (c.cardNo || c.tail)); if (k) keys.add(k); };
  for (const p of data.projects || []) for (const c of p.cards || []) add(c);
  for (const card of (data.cards || []).concat(data.unattributed || [])) for (const t of card.txs || []) add(t);
  return keys;
}

/* 청구 준비 항목의 결의서 상태를 R&D ERP 와 맞춘다 — 내역 추가(임시저장)만 된 것으로 기록된 항목이 ERP 에서 이미 신청·승인됐으면(화면에서 직접 신청했거나 확장이 신청 보고를 놓친 경우) "신청됨"(applied)으로,
 * 신청됨으로 기록된 항목이 ERP 에서 보완요청(30)·임시저장(40)으로 돌아왔으면 "임시저장됨"(saved)으로. 그래야 패널이 이미 신청된 결의서에 "신청"·"임시저장 삭제" 버튼을 보이지 않는다
 * (2026-09-25: 화면에서 신청한 결의서를 패널이 임시저장으로 알고 "임시저장 삭제"를 실행해 "[삭제] 링크가 없습니다" 로 실패 — 화면은 승인구분 10/20 이면 [삭제] 링크를 그리지 않음).
 * 과제정보 › 청구결의서 탭의 목록 rtask_0008_t04_01_r001 {USEFAC_SEQ_NO, PRJ_NO, SEARCH_GB1 '1'(신청일자), START_DATE, END_DATE, APPR_DIV_CD ''} → REC[{REQ_CNT, APPR_DIV_CD, APPR_DIV_NM, APPL_DT, DOC_NO, DRAFT_USER_NM, …}].
 * 신청일자 검색이라 신청된 결의서만 나오고 임시저장(신청일 없음)은 나오지 않으므로, 목록에 없는 항목은 그대로 둔다(삭제된 것으로 보지 않음). 과제마다 한 번, 항목이 있는 과제만 조회한다.
 * 승인구분(RD0039): 10 신청 · 20 승인 · 30 보완요청 · 40 임시저장(작성중) · 50/60 (화면이 신청·승인처럼 잠그는 상태) */
const SLIP_LOCKED = ['10', '20', '50', '60'];
async function syncSlipStatus(settings) {
  const m = await KRX_PREP_STORE.loadMeta();
  const byPrj = new Map();   // prjNo → [{ key, run }]
  for (const e of Object.values(m)) {
    const r = e && e.run;
    if (!r || r.state === 'running' || !wasSaved(r) || !String(r.reqCnt || '').trim() || !e.prjNo) continue;
    if (!byPrj.has(e.prjNo)) byPrj.set(e.prjNo, []);
    byPrj.get(e.prjNo).push({ key: e.key, run: r });
  }
  if (!byPrj.size) return;
  const adv = (settings && settings.adv) || {};
  const day = 86400000;
  const fmtYmd = (v) => { const d = String(v || '').replace(/\D/g, ''); return d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}` : String(v || ''); };
  for (const [prjNo, items] of byPrj) {
    const oldest = Math.min(...items.map((x) => Number(x.run.ts) || Date.now()));
    let recs = [];
    try {
      const d = await KRX_API.call('rtask_0008_t04_01_r001', { USEFAC_SEQ_NO: adv.usefacSeqNo || '10', PRJ_NO: prjNo, SEARCH_GB1: '1',
        START_DATE: KRX_FMT.ymd(new Date(oldest - 7 * day)), END_DATE: KRX_FMT.ymd(new Date(Date.now() + day)), APPR_DIV_CD: '', PARAM_LST1: '', RES_CD: '', EXP_CD: '', DETAIL_CONT: '', DOC_NO: '' });
      recs = Array.isArray(d && d.REC) ? d.REC : [];
    } catch (e) { continue; }   // 로그인·네트워크 오류면 이번엔 건너뜀
    for (const { key, run } of items) {
      const rec = recs.find((r) => String(r.REQ_CNT || '').trim() === String(run.reqCnt).trim());
      if (!rec) continue;
      const cd = String(rec.APPR_DIV_CD || '').trim(), nm = String(rec.APPR_DIV_NM || '').trim() || cd;
      const where = `승인구분 ${nm}${rec.APPL_DT ? ' · 신청일 ' + fmtYmd(rec.APPL_DT) : ''}${rec.DOC_NO ? ' · ' + rec.DOC_NO : ''}`;
      if (SLIP_LOCKED.includes(cd) && run.state !== 'applied') {
        await KRX_PREP_STORE.setRun(key, Object.assign({}, run, { state: 'applied', stage: '', ts: Date.now(), msg: `R&D ERP 에서 신청됨 (${where})`, saved: true }));
      } else if ((cd === '30' || cd === '40') && run.state === 'applied') {
        await KRX_PREP_STORE.setRun(key, Object.assign({}, run, { state: 'saved', stage: '', ts: Date.now(), msg: `R&D ERP 에서 신청이 취소되어 다시 작성중 (${where})`, saved: true }));
      }
    }
  }
}

/* 청구 준비 "청구서 작성" / "작성+신청" / "신청": R&D ERP 청구서(카드) 화면을 비활성 탭으로 열어(레이아웃 딥링크 #krext, rnd-hook.js) 그 거래 행을 자동 선택하고,
 * content/rnd-claim.js 가 세목·청구종류를 고르고 청구내역(적요)을 적고 파일을 올린 뒤 "내역 추가"를 누른다 (mode 'add' — 결의서에 임시저장 상태로 들어감. 여기서 끝나면 신청은 아직 안 된 것).
 * mode 'add,apply' 면 이어서 결의서 "신청"(결재요청)까지, mode 'apply' 면(이미 내역 추가된 항목 — 미청구 목록에서 빠져 패널의 신청 대기 목록에 있음) 저장된 결의서의 신청만,
 * mode 'delete' 면 내역 추가된 청구내역 행의 [삭제]를 눌러 임시저장을 지운다(거래가 미청구 목록으로 돌아오고 준비 항목은 작성 전 상태로).
 * 결과는 prepRunResult 로 보고: 내역 추가 성공은 진행 보고(final=false, saved) → 신청 결과가 끝 보고. 끝까지 성공하면 탭을 닫고 미청구 목록을 다시 조회(거래가 사라짐),
 * 실패하면 탭을 남겨 두어 패널의 "탭 보기"로 이어서 할 수 있게 한다. 제한 시간(5분) 안에 보고가 없으면 실패로 표시 */
const RND_MAIN = 'https://rnd.krs.co.kr/rderp_layoutMain.act';
const PREP_RUN_TIMEOUT = 5 * 60000;
const PREP_RUN_TIMEOUT_MEETING = 30 * 60000;   // 회의비(회의록 종류): 사용자가 회의록 팝업을 채우는 동안 기다림
/* 세목 빠른 선택 항목("표시이름=항목명=청구종류=종류") 중 준비 항목의 청구종류(표시이름)에 해당하는 것 (lib/prep.js parsePicks 와 같은 규칙) */
async function pickInfo(label) {
  const s = await KRX_SETTINGS.load();
  for (const line of (s.claimHelper && s.claimHelper.quickPicks) || []) {
    const parts = String(line || '').split('=').map((x) => x.trim());
    if (parts[0] && parts[0] === label) return { label: parts[0], kw: parts[1] || parts[0], type: parts[2] || '', kind: parts[3] || '' };
  }
  return null;
}
/* 회의록(부가증빙)이 필요한 청구종류: 코드 17 회의비, 또는 종류가 식비·다과. "청구서 작성"은 탭을 앞에 열어 사용자가 회의록 팝업을 채우게 하고(content/rnd-claim.js waitMinutes) 저장되면 내역 추가로 이어 간다 */
const isMeetingPick = (p) => !!p && (String(p.type) === '17' || p.kind === '식비' || p.kind === '다과');
/* 참석자 카드(패널)용 과제 참여인력·회의록 규칙 — 과제별 1시간 캐시 (서비스워커가 잠들면 비워짐) */
const meetingInfoCache = new Map();
async function meetingInfo(prjNo, date, force) {
  if (!prjNo) return { ok: false, error: '과제번호가 없습니다' };
  const ck = prjNo + '|' + String(date || '').replace(/\D/g, '').slice(0, 8);
  const c = meetingInfoCache.get(ck);
  if (c && !force && Date.now() - c.ts < 3600000) return { ok: true, info: c.info, cached: true };
  try {
    const info = await KRX_API.fetchMeetingInfo(prjNo, date, await KRX_SETTINGS.load());
    meetingInfoCache.set(ck, { ts: Date.now(), info });
    return { ok: true, info };
  } catch (e) { const d = KRX_API.describe(e); return { ok: false, error: d.kind === 'login' ? 'R&D ERP 로그인이 필요합니다 (eClass 의 R&D ERP 메뉴로 로그인)' : d.message }; }
}
const wasSaved = (run) => !!(run && (run.saved || run.state === 'done' || run.state === 'saved' || run.state === 'applied'));   // 'done' 은 이전 버전(0.6.9)의 "내역 추가됨" 상태 이름
async function prepRun(key, mode) {
  const m = await KRX_PREP_STORE.loadMeta();
  const e = m[key];
  if (!e) return { ok: false, error: '준비 항목이 없습니다' };
  const steps = new Set(String(mode || 'add').split(/[,+\s]+/).filter(Boolean));
  if (steps.has('delete')) { steps.clear(); steps.add('delete'); }
  if (!steps.has('add') && !steps.has('apply') && !steps.has('delete')) steps.add('add');
  const auto = ['add', 'apply', 'delete', 'dry'].filter((s) => steps.has(s)).join(',');   // dry: 회의록 등록 직전까지만(payload 검증, 서버에 보내지 않음 — 진단용)
  if (steps.has('add') && !e.type) return { ok: false, error: '청구종류를 먼저 고르세요' };
  if (steps.has('add')) KRX_PREP_AI.remember(e);   // 이 가맹점·적요에 쓴 청구종류를 Claude 자동 분류의 예로 (Claude 가 고른 것을 그대로 쓴 경우도)
  if (!steps.has('add') && !wasSaved(e.run)) return { ok: false, error: steps.has('delete') ? '내역 추가된 항목이 아닙니다' : '먼저 청구서를 작성(내역 추가)하세요' };
  if (steps.has('delete') && e.run && e.run.state === 'applied') return { ok: false, error: '이미 신청된 결의서는 삭제할 수 없습니다 (R&D ERP 에서 신청 취소 후)' };
  const pk = steps.has('add') ? await pickInfo(e.type) : null;
  // 회의록이 필요한 청구종류: 패널 회의록 카드에 회의내용이 있으면 청구서 도우미가 팝업 없이 회의록을 등록하므로 백그라운드 탭으로,
  // 없으면 탭을 앞에 열어 사용자가 회의록 팝업을 채우게 하고 제한 시간을 늘린다
  const meeting = isMeetingPick(pk) && !(pk && pk.kind && e.minutes && e.minutes.content);
  const timeout = meeting ? PREP_RUN_TIMEOUT_MEETING : PREP_RUN_TIMEOUT;
  if (e.run && e.run.state === 'running' && Date.now() - e.run.ts < (e.run.meeting ? PREP_RUN_TIMEOUT_MEETING : PREP_RUN_TIMEOUT)) return { ok: false, error: '이미 진행 중입니다' };
  if (e.run && e.run.tabId != null) { try { await chrome.tabs.remove(e.run.tabId); } catch (x) {} }   // 지난 실행이 남겨 둔 탭
  const req = { open: 'rexpe_0083_01.act', title: '청구서(카드)', menuId: 'menu_id_362', q: 'PRJ_NO=' + encodeURIComponent(e.prjNo || ''), card: e.card4, auto };
  if (steps.has('add')) {
    req.appr = e.appr;
    // 카드 사용일: 화면의 기본 조회 기간(이번 달 1일 ~ 오늘) 밖의 건이면 훅이 조회 시작일을 이 날로 당겨 다시 조회한다 (rnd-hook.js autoSelectRow)
    const used = String(e.usedDate || '').replace(/\D/g, '').slice(0, 8);
    if (used.length === 8) req.date = used;
  } else {
    /* 신청만·삭제: 미청구 행 자동 선택 없이(이미 청구된 거래) 준비 항목만 찾게 krext_prep. 저장된 결의서는 과제정보 › 청구결의서 탭(rtask_0008_t04_01.js)처럼 주소에
     * REQ_CNT(결의서 차수)·APPR_DIV_CD(40 임시저장)를 붙여야 열린다 — 화면(rexpe_0083_01)은 서버가 주소 파라미터로 렌더한 reqParam/hidden REQ_CNT 로 청구내역 목록(rexpe_0001_01_r018)을 읽고,
     * PRJ_NO 만 주면 새 결의서 폼(REQ_CNT 빈값, 목록 0건)이 열려 청구번호 행을 못 찾는다 (2026-09-25 CDP 확인). 회의비 관련 CFRC_* 파라미터는 없어도 같은 목록이 뜬다 */
    req.prep = e.appr;
    const reqCnt = String((e.run && e.run.reqCnt) || '').trim();
    if (!reqCnt) return { ok: false, error: '결의서 차수(REQ_CNT)가 기록돼 있지 않아 저장된 결의서를 열 수 없습니다 — R&D ERP 과제정보 › 청구결의서 탭에서 직접 처리하세요' };
    req.q += '&REQ_CNT=' + encodeURIComponent(reqCnt) + '&APPR_DIV_CD=40';
  }
  let tab = null;
  try { tab = await chrome.tabs.create({ url: RND_MAIN + '#krext=' + encodeURIComponent(JSON.stringify(req)), active: meeting }); }
  catch (x) { return { ok: false, error: '탭을 열지 못했습니다: ' + String((x && x.message) || x) }; }
  const prev = e.run || {};
  await KRX_PREP_STORE.setRun(key, { state: 'running', stage: steps.has('add') ? 'add' : steps.has('delete') ? 'delete' : 'apply', mode: auto, ts: Date.now(), tabId: tab.id, msg: meeting ? '회의록 팝업을 채우고 저장하면 이어서 내역 추가합니다' : '', saved: wasSaved(prev), reqNo: String(prev.reqNo || ''), reqCnt: String(prev.reqCnt || ''), meeting });
  setTimeout(async () => {
    try {
      const cur = (await KRX_PREP_STORE.loadMeta())[key];
      if (cur && cur.run && cur.run.state === 'running' && cur.run.tabId === tab.id) await KRX_PREP_STORE.setRun(key, Object.assign({}, cur.run, { state: 'failed', ts: Date.now(), msg: '제한 시간 안에 끝나지 않았습니다 — 탭에서 확인하세요' }));
    } catch (x) {}
  }, timeout);
  return { ok: true, tabId: tab.id, meeting };
}
/* rnd-claim.js 의 보고 { key, appr, state: saved|applied|deleted|failed, final, msg, alerts, saved, reqNo, reqCnt }. 이전 버전(0.6.9)의 { ok } 만 있는 보고도 받는다.
 * deleted(임시저장 삭제됨): run 을 지워 준비 항목을 작성 전 상태로 돌리고 미청구 목록을 다시 조회한다(거래가 돌아옴).
 * applied 는 신청 성공뿐 아니라 신청만·삭제 모드에서 결의서가 이미 신청·승인된 상태로 확인된 경우에도 온다(msg 에 승인구분·신청정보) — 패널은 "신청됨"으로 바꾸고 버튼을 감춘다.
 * run = { state: running|saved|applied|failed, stage(running 일 때 add|apply), mode, ts, tabId, msg, saved(내역 추가는 됨), reqNo(청구번호), reqCnt(결의서 차수) } */
async function prepRunResult(msg, sender) {
  const tabId = sender && sender.tab && /rnd\.krs\.co\.kr/.test(String(sender.tab.url || '')) ? sender.tab.id : null;   // 닫을 탭은 R&D ERP 탭일 때만 (다른 곳에서 온 보고로 그 탭을 닫지 않게)
  const key = String(msg.key || '') || await KRX_PREP_STORE.keyFor(msg.appr, '');
  const alerts = Array.isArray(msg.alerts) ? msg.alerts.filter(Boolean) : [];
  const state = ['saved', 'applied', 'deleted', 'failed'].includes(msg.state) ? msg.state : (msg.ok ? 'saved' : 'failed');
  const final = msg.final !== false;
  if (state === 'deleted') {
    if (key) await KRX_PREP_STORE.setRun(key, null);
    if (tabId != null) setTimeout(() => { try { chrome.tabs.remove(tabId).catch(() => {}); } catch (x) {} }, 2500);
    chrome.storage.local.remove(CACHE_KEY).then(() => refresh(true)).catch(() => {});
    return { ok: true, key };
  }
  const text = String(msg.msg || '') + (state === 'failed' && alerts.length && !String(msg.msg || '').includes(alerts[alerts.length - 1]) ? ` (${alerts[alerts.length - 1]})` : '');
  const cur = key ? (await KRX_PREP_STORE.loadMeta())[key] : null;
  const prev = (cur && cur.run) || {};
  const saved = !!msg.saved || state === 'saved' || state === 'applied' || wasSaved(prev);
  if (cur) {
    await KRX_PREP_STORE.setRun(key, { state: final ? state : 'running', stage: final ? '' : 'apply', mode: String(prev.mode || ''), ts: Date.now(), tabId, msg: text, saved,
      reqNo: String(msg.reqNo || prev.reqNo || ''), reqCnt: String(msg.reqCnt || prev.reqCnt || ''), meeting: !!prev.meeting });
  }
  if (final && state !== 'failed' && tabId != null) setTimeout(() => { try { chrome.tabs.remove(tabId).catch(() => {}); } catch (x) {} }, 2500);
  // 내역 추가된 거래는 미청구 목록에서 빠지므로 다시 조회 (신청 실패라도 임시저장은 됐음). 이미 저장된 상태에서 신청만 실패한 경우는 목록이 그대로라 건너뜀
  if (saved && (state !== 'failed' || !wasSaved(prev))) chrome.storage.local.remove(CACHE_KEY).then(() => refresh(true)).catch(() => {});
  return { ok: true, key };
}
async function prepFocusTab(key) {
  const e = (await KRX_PREP_STORE.loadMeta())[key];
  const tabId = e && e.run && e.run.tabId;
  if (tabId == null) return { ok: false, error: '열린 탭이 없습니다' };
  try {
    const t = await chrome.tabs.get(tabId);
    await chrome.tabs.update(tabId, { active: true });
    try { await chrome.windows.update(t.windowId, { focused: true }); } catch (x) {}
    return { ok: true };
  } catch (x) { return { ok: false, error: '그 탭은 이미 닫혔습니다' }; }
}

/* R&D ERP 화면에서 쓰기 서비스(결의서 신청·내역 추가·삭제·결재 등 — 서비스 ID 끝이 _c/_d/_u + 숫자)가 끝나면 패널 캐시(갱신 주기 기본 10분)가 그 순간 낡으므로, 잠깐 모았다가 바로 다시 조회한다.
 * 화면에서 임시저장 결의서를 신청했는데 패널에는 다음 갱신까지 임시저장으로 남아 있던 문제(2026-10-01). 캡처는 응답을 받은 뒤(loadend)에 오므로 서버 반영은 끝난 상태다.
 * 첨부 업로드·회의록 저장(rcomm_…)은 건수·목록을 바꾸지 않아 뺀다. 확장의 백그라운드 작성·신청 탭이 부른 것도 여기로 오지만 refresh 가 한 번에 하나만 돌아 겹치지 않는다 */
const WRITE_SVC = /^(rexpe|rappr|rtask)_\w+_[cdu]\d+$/;
let writeRefreshTimer = 0;
function refreshAfterWrite(entry) {
  if (!entry || !WRITE_SVC.test(String(entry.service || ''))) return;
  if (entry.status != null && Number(entry.status) !== 200) return;
  clearTimeout(writeRefreshTimer);
  writeRefreshTimer = setTimeout(() => {
    const run = () => { refresh(true).catch(() => {}); };
    if (inflight) inflight.then(run, run); else run();   // 쓰기 전에 시작한 조회가 돌고 있으면 그 결과는 낡았으므로 끝난 뒤 한 번 더
  }, 1500);
}

async function appendCapture(entry, sender) {
  if (!entry || !entry.service) return;
  const cur = (await chrome.storage.local.get(CAPTURE_KEY))[CAPTURE_KEY] || [];
  entry.tabUrl = (sender && sender.tab && sender.tab.url) || '';
  cur.push(entry);
  while (cur.length > CAPTURE_MAX) cur.shift();
  await chrome.storage.local.set({ [CAPTURE_KEY]: cur });
}

async function scheduleAlarm() {
  const settings = await KRX_SETTINGS.load();
  await chrome.alarms.clear(ALARM);
  if (settings.autoRefresh) {
    chrome.alarms.create(ALARM, { periodInMinutes: Math.max(1, KRX_FMT.num(settings.refreshMinutes) || 10) });   // 설정의 갱신 주기(분), 최소 1분
  }
}

/* 이미 열려 있는 R&D ERP 탭에 브리지를 다시 넣는다 (모든 프레임).
 * 확장을 설치/재로드해도 열린 탭의 콘텐츠 스크립트는 다시 실행되지 않으므로, 사용자 식별(rndUser)이 안 잡힌 채로 남는 것을 막는다.
 * 완료되면 refresh 가 새 rndUser 로 참여 과제를 판정한다 */
async function injectBridgeIntoOpenErpTabs() {
  let tabs = [];
  try { tabs = await chrome.tabs.query({ url: ['https://rnd.krs.co.kr/*'] }); } catch (e) { return; }
  await Promise.all((tabs || []).map((t) =>
    chrome.scripting.executeScript({ target: { tabId: t.id, allFrames: true }, files: ['content/rnd-bridge.js'] }).catch(() => {})));
  if (tabs.length) await new Promise((r) => setTimeout(r, 1500));   // 브리지의 rndUser 메시지가 저장될 시간
}

/* 이미 열려 있는 R&D ERP 탭에 청구서(카드) 입력 도우미를 넣는다 (모든 프레임). 설치/재로드 뒤 ERP 화면을 다시 열지 않아도 되게 함.
 * 스크립트는 다시 주입되면 이전 것을 스스로 멈추고 요소를 걷어낸 뒤 새로 붙인다 */
async function injectClaimHelperIntoOpenErpTabs() {
  let tabs = [];
  try { tabs = await chrome.tabs.query({ url: ['https://rnd.krs.co.kr/*'] }); } catch (e) { return; }
  await Promise.all((tabs || []).map((t) =>
    chrome.scripting.executeScript({ target: { tabId: t.id, allFrames: true }, files: ['lib/settings.js', 'content/rnd-claim.js'] }).catch(() => {})));
}

/* 이미 열려 있는 HR System 탭(최상위 프레임)에 급여명세서 수집 스크립트를 넣는다. 다시 주입된 스크립트는 이전 것을 멈추고 새로 시작한다 */
async function injectHrIntoOpenTabs() {
  let tabs = [];
  try { tabs = await chrome.tabs.query({ url: ['https://hr.krs.co.kr/*'] }); } catch (e) { return; }
  await Promise.all((tabs || []).map((t) =>
    chrome.scripting.executeScript({ target: { tabId: t.id }, files: ['lib/format.js', 'lib/settings.js', 'lib/hr-api.js', 'content/hr-pay.js'] }).catch(() => {})));
}
/* 열려 있는 HR System 탭에 급여명세서 수집(hrCollect)을 요청한다 (백그라운드 직접 호출이 안 될 때의 대체 경로).
 * 수집 결과는 탭이 hrPay 메시지로 따로 보내온다. 첫 탭이 성공하면 나머지는 건너뜀. 반환: { ok, via:'tab', tabs, … 탭의 응답 } */
async function requestHrCollect(force, all) {
  let tabs = [];
  try { tabs = await chrome.tabs.query({ url: ['https://hr.krs.co.kr/*'] }); } catch (e) { tabs = []; }
  let last = null;
  for (const t of tabs || []) {
    try {
      const r = await chrome.tabs.sendMessage(t.id, { type: 'hrCollect', force: !!force, all: !!all }, { frameId: 0 });
      last = r || { error: '응답 없음' };
      if (r && r.ok) break;
    } catch (e) { last = { error: String((e && e.message) || e) }; }
  }
  return Object.assign({ ok: false, via: 'tab', tabs: (tabs || []).length }, last || { error: (tabs || []).length ? '응답 없음' : 'HR System 탭 없음' });
}

/* HR API 를 백그라운드에서 직접 부르기 위한 DNR 규칙: 이 확장이 hr.krs.co.kr 에 보내는 XHR/fetch 의 Referer 를 HR 로 바꾼다.
 * HR 서버는 Referer 가 자기 사이트가 아니면(확장 출처·다른 사이트) 본문 없는 200 을 돌려준다 — Origin 은 보지 않음 (2026-09-23 확인).
 * initiatorDomains 로 이 확장이 보낸 요청에만 적용해 다른 사이트의 HR 요청에는 영향이 없게 한다. 동적 규칙이라 브라우저를 다시 켜도 남는다 */
const HR_RULE_ID = 9101;
let hrRulesReady = false;
async function ensureHrRules() {
  if (hrRulesReady) return true;
  try {
    const rule = { id: HR_RULE_ID, priority: 1,
      action: { type: 'modifyHeaders', requestHeaders: [{ header: 'referer', operation: 'set', value: KRX_HR_API.HOME + '/' }] },
      condition: { urlFilter: '||hr.krs.co.kr/', resourceTypes: ['xmlhttprequest'], initiatorDomains: [chrome.runtime.id] } };
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [HR_RULE_ID], addRules: [rule] });
    hrRulesReady = true;
  } catch (e) { hrRulesReady = false; }
  return hrRulesReady;
}

/* HR 급여명세서 수집 (백그라운드 직접 호출). HR 탭이 없어도 HR 로그인 세션(쿠키)이 살아 있으면 된다.
 * 주기적으로 돌지 않고, 패널의 급여·연구수당 보기/↻ 나 설정 페이지의 지금 수집(hrCollectNow)을 눌렀을 때만 읽는다 (급여는 한 달에 한 번 바뀌므로).
 * force 가 아니면 저장값이 갱신 주기 안일 때 건너뜀, all 이면 모든 달을 다시 읽음 (아니면 목록만 다시 받고 새로 생기거나 소득합계가 바뀐 달만 지급내역 조회).
 * 사번: 저장된 hrPay.empNo → R&D ERP 사용자(rndUser) → 설정 myEmpNo. 사번을 모르거나 직접 호출이 실패하면(빈 응답 등) 열려 있는 HR 탭에 맡긴다.
 * 로그인이 풀려 있으면(로그인 페이지로 리다이렉트) 탭도 같은 쿠키라 소용없으므로, 설정 hr.autoLogin 이 켜져 있으면 hrAutoLogin 으로 eClass SSO 를 거쳐 다시 로그인한 뒤 한 번 더 읽고,
 * 그래도 안 되면 status.loginRequired(+eclassLogin: eClass 세션이 없어 SSO 를 못 함, +tabOpened) 로 기록한다 */
/* HR 로그인이 풀렸을 때 자동 재로그인 (SSO).
 * hr.krs.co.kr/ 을 직접 열면 로그아웃 상태에서는 SSO 로 넘어가지 않고 본문 없는 403(Chrome 오류 페이지)만 오므로 (2026-09-25 확인) 그 주소로는 로그인이 안 된다.
 * 실제 SSO 진입은 eClass 홈 메뉴 HR › Main Page 가 여는 중계 페이지(hr.url 기본값 KRX_HR_API.SSO_URL, 제목 "SSO Redirect")로, 이 페이지의 인라인 JS 가
 * https://hr.krs.co.kr/sso-proc?UID=…&SID=… 로 이동하면 HR 세션이 만들어진다. eClass 세션(쿠키)이 필요하고 GET 이라 백그라운드에서도 받을 수 있다.
 *  1) hrUrl 이 eClass 중계 주소면 백그라운드에서 받아 sso-proc 주소를 뽑는다. 못 뽑으면(eClass 로그인 페이지 등) kind:'eclass-login' 으로 끝낸다 (탭을 열지 않음).
 *  2) sso-proc 를 백그라운드에서 fetch(쿠키 포함, 리다이렉트 따라감) 해 HR 세션을 만든 뒤 tryCollect 로 바로 읽어 본다 — 되면 탭 없이 끝 (autoLogin:'fetch').
 *  3) 안 되면 hrUrl 을 비활성 탭으로 열고(이미 HR 탭이 있으면 그 탭을 그 주소로 이동. 중계 페이지가 새 sso-proc 로 이동한다) hr.krs.co.kr 로 돌아와 다 뜰 때까지 기다린 뒤
 *     tryCollect 로 다시 읽는다. HR 은 SPA 라 주소만으로는 로그인 여부를 알 수 없어 API 응답으로 판단하고, 아직 로그인 리다이렉트면 2초 간격으로 제한 시간까지 재시도한다.
 *     성공하면 이 함수가 연 탭은 닫고, 안 되면 탭을 그대로 두어 사용자가 확인할 수 있게 한다(tabOpened).
 * 반환: 성공 시 tryCollect 의 결과(+autoLogin:'fetch'|'tab'), 실패 시 { ok:false, error, kind, tabOpened } */
const HR_AUTO_LOGIN_MS = 30000;
/* eClass SSO 중계 페이지를 받아 HR sso-proc 주소를 돌려준다. 없으면 kind:'eclass-login'(eClass 세션 없음), 못 받으면 'network' */
async function fetchHrSsoUrl(bridgeUrl) {
  let res, text = '';
  try { res = await fetch(bridgeUrl, { credentials: 'include', cache: 'no-store', redirect: 'follow' }); text = await res.text(); }
  catch (e) { const err = new Error('eClass SSO 중계 페이지를 받지 못했습니다: ' + String((e && e.message) || e)); err.kind = 'network'; throw err; }
  const m = text.match(KRX_HR_API.SSO_PROC_RE);
  if (m) return m[0].replace(/&amp;/g, '&');
  const err = new Error(`eClass 로그인이 풀려 HR 자동 로그인(SSO)을 못 했습니다 (중계 페이지 HTTP ${res.status}${res.redirected ? ' → ' + res.url : ''})`);
  err.kind = 'eclass-login'; throw err;
}
async function hrAutoLogin(hrUrl, tryCollect) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fail = (kind, error, extra) => Object.assign({ ok: false, kind, error }, extra || {});
  if (KRX_HR_API.isSsoBridge(hrUrl)) {   // 1) 2) 탭 없이 백그라운드에서
    let proc = null;
    try { proc = await fetchHrSsoUrl(hrUrl); }
    catch (e) { if (e && e.kind === 'eclass-login') return fail(e.kind, e.message); }   // 네트워크 오류 등은 탭으로 다시 시도
    if (proc) {
      try { await fetch(proc, { credentials: 'include', cache: 'no-store', redirect: 'follow' }); } catch (e) {}
      try { return Object.assign(await tryCollect(), { autoLogin: 'fetch' }); }
      catch (e) { if (!(e && e.kind === 'login')) return fail(e.kind || 'error', String((e && e.message) || e)); }
    }
  }
  let tab = null, created = false;   // 3) 탭으로
  try {
    const open = await chrome.tabs.query({ url: ['https://hr.krs.co.kr/*'] });
    if (open && open.length) { tab = open[0]; await chrome.tabs.update(tab.id, { url: hrUrl }); }
    else { tab = await chrome.tabs.create({ url: hrUrl, active: false }); created = true; }
  } catch (e) { return fail('login', 'HR System 탭을 열지 못했습니다: ' + String((e && e.message) || e)); }
  const deadline = Date.now() + HR_AUTO_LOGIN_MS;
  let landed = false, lastErr = null;
  while (Date.now() < deadline) {
    await sleep(landed ? 2000 : 500);
    let t = null;
    try { t = await chrome.tabs.get(tab.id); } catch (e) { return fail('login', 'HR System 탭이 닫혀 자동 로그인을 끝내지 못했습니다'); }
    if (!landed) {   // SSO 가 eClass 를 거치는 동안은 기다리고, HR 로 돌아와 로딩이 끝나면 잠시 뒤 읽기 시작
      if (t.status !== 'complete' || !/^https:\/\/hr\.krs\.co\.kr\//i.test(String(t.url || ''))) continue;
      landed = true; await sleep(1500);
    }
    try {
      const r = await tryCollect();
      if (created) { try { await chrome.tabs.remove(tab.id); } catch (e) {} }
      return Object.assign(r, { autoLogin: 'tab' });
    } catch (e) { lastErr = e; if (!(e && e.kind === 'login')) break; }
  }
  const kind = (lastErr && lastErr.kind) || 'login';
  return fail(kind, kind === 'login' ? `HR System 자동 로그인이 되지 않았습니다${landed ? '' : ' (SSO 중계 페이지에서 HR 로 넘어가지 못함)'}` : String((lastErr && lastErr.message) || lastErr), { tabOpened: true });
}

let hrInflight = null;
async function collectHr(force, all) {
  if (hrInflight) return hrInflight;
  hrInflight = (async () => {
    const settings = await KRX_SETTINGS.load();
    const hr = Object.assign({}, KRX_SETTINGS.DEFAULTS.hr || {}, settings.hr || {});
    if (hr.enabled === false) return { ok: false, skipped: 'disabled' };
    const store = await chrome.storage.local.get(['hrPay', 'rndUser']);
    const cur = store.hrPay || {};
    const ttl = Math.max(1, KRX_FMT.num(settings.refreshMinutes) || 10) * 60000;
    if (!force && cur.ts && cur.source === 'api' && !(cur.status && (cur.status.loginRequired || cur.status.error)) && Date.now() - cur.ts < ttl) return { ok: false, skipped: 'fresh' };
    const u = store.rndUser || {};
    const empNo = [cur.empNo, u.empNo, u.userId, settings.myEmpNo].map((v) => String(v || '').trim()).find((v) => KRX_HR_API.EMP_RE.test(v)) || '';
    if (!empNo) return await requestHrCollect(force, all);   // 사번을 모름 → HR 탭(프로필에서 읽음)에 맡김
    await ensureHrRules();
    const tryCollect = async () => {
      KRX_HR_API.setBase(KRX_HR_API.HOME);
      const patch = await KRX_HR_API.collect({ empNo, known: cur.years || {}, years: [new Date().getFullYear()], force: !!all, page: 'background' });
      patch.status = { ts: Date.now(), ok: true, via: 'background' };
      const merged = await mergeHrPay(patch); await patchCacheHrPay(merged);
      return { ok: true, via: 'background', scan: patch.scan, grade: patch.grade || '', empNo, months: patch.lists.reduce((s, l) => s + l.total, 0) };
    };
    try { return await tryCollect(); }
    catch (e) {
      let kind = e && e.kind, msg = String((e && e.message) || e), tabOpened = false;
      if (kind === 'login' && hr.autoLogin !== false) {   // 로그인이 풀림 → eClass SSO 중계 주소(hr.url)로 자동 로그인 뒤 다시 읽기 (hrAutoLogin)
        const re = await hrAutoLogin(hr.url || KRX_HR_API.SSO_URL, tryCollect);
        if (re.ok) return re;
        kind = re.kind || kind; msg = re.error || msg; tabOpened = !!re.tabOpened;
      }
      const loginKind = kind === 'login' || kind === 'eclass-login';
      if (!loginKind) {   // 빈 응답(규칙 미적용)·네트워크·HTTP 오류 → HR 탭이 있으면 그쪽에서 (탭은 프로필의 사번으로 다시 시도)
        const viaTab = await requestHrCollect(force, all);
        if (viaTab.ok) return viaTab;
      }
      const status = { ts: Date.now(), error: msg, loginRequired: loginKind, eclassLogin: kind === 'eclass-login', tabOpened, via: 'background' };
      const merged = await mergeHrPay({ status }); await patchCacheHrPay(merged);
      return { ok: false, via: 'background', error: msg, loginRequired: status.loginRequired, eclassLogin: status.eclassLogin, tabOpened };
    }
  })().finally(() => { hrInflight = null; });
  return hrInflight;
}

/* HR 급여명세서 수집(content/hr-pay.js → lib/hr-api.js) 병합 → storage.local.hrPay
 * { ts(마지막 성공 수집), source:'api', page, empNo, name, dept, grade(P1~P4, HR 직원 정보의 gradeCode), gradeTs,
 *   years: { [연도]: { months: { [지급일자|내용]: { date, title, seq, total, detailTotal, mismatch, items:{소득명: 금액}, order, codes, ts } }, list: { ts, total, rows } } },
 *   scan: { ts, years, tried, done, failed, note }, status: { ts, ok | error, loginRequired, eclassLogin, tabOpened } }
 * API 는 한 해의 목록 전체를 주므로 목록은 통째로 교체하고 목록에 없는 달(예전 화면 읽기 잔재)은 지운다. 달은 key 로 덮어쓴다. 3년 넘은 연도는 정리 */
async function mergeHrPay(patch) {
  const cur = (await chrome.storage.local.get('hrPay')).hrPay || { years: {} };
  cur.years = cur.years || {};
  if (patch.lists || patch.months || patch.grade || patch.empNo) { cur.ts = Date.now(); if (patch.source) cur.source = patch.source; }
  if (patch.page) cur.page = patch.page;
  for (const k of ['empNo', 'name', 'dept', 'payGroupCode']) if (patch[k]) cur[k] = patch[k];
  if (patch.grade) { cur.grade = String(patch.grade).toUpperCase(); cur.gradeTs = Date.now(); }
  for (const l of patch.lists || []) {
    if (!l || !l.year) continue;
    const y = cur.years[l.year] = cur.years[l.year] || { months: {} };
    y.months = y.months || {};
    const rows = (l.rows || []).filter((r) => r && r.key).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const keys = new Set(rows.map((r) => r.key));
    for (const k of Object.keys(y.months)) if (!keys.has(k)) delete y.months[k];
    y.list = { ts: Date.now(), total: rows.length, rows };
  }
  for (const m of patch.months || []) {
    if (!m || !m.key || !m.year) continue;
    const y = cur.years[m.year] = cur.years[m.year] || { months: {} };
    y.months = y.months || {};
    y.months[m.key] = m;
  }
  if (patch.scan) cur.scan = patch.scan;
  if (patch.status) cur.status = patch.status;
  const thisYear = new Date().getFullYear();
  for (const k of Object.keys(cur.years)) if (Number(k) < thisYear - 2) delete cur.years[k];
  await chrome.storage.local.set({ hrPay: cur });
  return cur;
}
/* 패널 캐시의 hrPay 만 바꿔 넣어 eClass 패널·팝업이 바로 다시 그리게 한다 (R&D ERP 는 다시 조회하지 않음) */
async function patchCacheHrPay(hrPay) {
  const cache = await getCache();
  if (!cache) return;
  cache.hrPay = hrPay;
  await chrome.storage.local.set({ [CACHE_KEY]: cache });
}

chrome.runtime.onInstalled.addListener(() => {   // 설치/업데이트/재로드 시 이전 캐시를 버리고 새로 조회
  chrome.storage.local.remove([CACHE_KEY, 'hrDiag'])
    .then(ensureHrRules)
    .then(injectBridgeIntoOpenErpTabs)
    .then(injectClaimHelperIntoOpenErpTabs)
    .then(injectHrIntoOpenTabs)
    .then(() => { scheduleAlarm(); refresh(true).catch(() => {}); });
  // 열려 있는 eClass 홈 탭은 옛 콘텐츠 스크립트가 남아 통신이 끊기므로 새로고침
  try {
    chrome.tabs.query({ url: ['https://eclass.krs.co.kr/eClassVer4/Home/Index*', 'https://eclass.krs.co.kr/eClassVer4/Home', 'https://eclass.krs.co.kr/eClassVer4/'] }, (tabs) => {
      if (chrome.runtime.lastError) return;
      for (const t of tabs || []) { try { chrome.tabs.reload(t.id); } catch (e) {} }
    });
  } catch (e) {}
});
chrome.runtime.onStartup.addListener(() => { ensureHrRules(); scheduleAlarm(); getCache().then(updateBadge); });

/* 툴바 아이콘 클릭 → 사이드 패널(기본, 0.8.5) 또는 팝업 창(설정 actionPopup). 둘 다 같은 popup/popup.html 이고 어디에 떴는지는 popup/mode.js 가 가린다.
 * manifest 에는 default_popup 을 두지 않는다(아이콘 클릭이 기본으로 팝업을 열지 않게). 워커가 뜰 때마다·설정이 바뀔 때마다 맞춘다:
 *   사이드 패널: action.setPopup('') + sidePanel.setPanelBehavior({ openPanelOnActionClick: true }) → 아이콘을 누르면 Chrome 이 사이드 패널을 열고 닫는다(토글)
 *   팝업 창: action.setPopup('popup/popup.html') + openPanelOnActionClick false. 팝업 제목 줄의 버튼(popup.js openSidePanel)·아이콘 우클릭 메뉴 "사이드 패널 열기"로는 여전히 사이드 패널을 연다
 * action.onClicked 는 팝업도 사이드 패널 동작도 걸려 있지 않을 때만 온다(이 설정을 맞추기 전 등) — 그때는 클릭(사용자 제스처) 안에서 바로 사이드 패널을 연다 */
async function applySidePanel() {
  let popup = false;
  try { popup = !!(await KRX_SETTINGS.load()).actionPopup; } catch (e) {}
  try { await chrome.action.setPopup({ popup: popup ? 'popup/popup.html' : '' }); } catch (e) {}
  try { if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: !popup }); } catch (e) {}
}
applySidePanel();
chrome.action.onClicked.addListener((tab) => {
  try { if (chrome.sidePanel && chrome.sidePanel.open && tab && tab.windowId != null) chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {}); } catch (e) {}   // await 없이 먼저 — 제스처가 살아 있을 때
  applySidePanel();
});
chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) { refresh(true).catch(() => {}); shareSync('alarm').catch(() => {}); } });   // 자동 갱신 때 공유 (Plus) 도 (켜져 있을 때만 실제 동작)

chrome.storage.onChanged.addListener((changes, area) => {
  if ((area === 'sync' || area === 'local') && changes.settings) {
    settingsGen++;   // 진행 중인 조회가 있으면 끝난 뒤 새 설정으로 한 번 더 돌게 함
    applySidePanel();   // 공유 (Plus) 의 폴더 캐시(shareFolder)는 설정 folder 와 견주어 쓰므로 여기서 지울 것이 없다 (shareCfg)
    chrome.storage.local.remove(CACHE_KEY).then(() => { scheduleAlarm(); refresh(true).catch(() => {}); });
  }
});

/* ----- 공유 (Plus) v2: 예상 비용(lib/plan.js) · 연구내용(lib/research.js) · 사업비(lib/staff.js — 예산 줄·참여인력) · 변경이력(lib/staff-ui.js shareChanges) · 과제 별칭(projectAliases) ↔ SharePoint(OneDrive) 공유 폴더의 **과제별 폴더**. 여기는 배선만 -----
 * 2026-10-18 사용자 결정으로 저장소가 원노트 페이지(KR_MS365_mcp MCP 서버 → Graph 직접 로그인)에서 폴더의 파일로 바뀌고("원노트 공유는 mcp 없어도 되긴하지? … mcp 없이 grph api 하지 않고 브라우저 토큰으로 하라고"), 같은 날 저녁 과제별 폴더·연차 파일로 다시 정해졌다:
 *   "onedrive 에 업무/shared 안에 과제별로 .. 약칭으로 없으면 jobid 없으면 임시번호. 이렇게 하고 여기에 넣자. 년차별로 1개 파일이고 1개 파일에서 변경사항이랑 다 관리했으면 좋겠어. 과제 정보랑 등등." → "참여연구원들에게 공유할 수 있게 설정까지 같이해줘 .. workspace 에도 경로주면 알아서 동기화"
 *   → "예상지출도 다 들어 가겠지? 이건 별도 파일에서 해도 되긴하는데 알아서 해줘"(연차에 걸치는 항목이 두 파일에 걸치지 않게 과제 폴더의 예상비용.json 하나).
 *   MCP 클라이언트(lib/mcp-client.js) · 원노트 페이지(lib/plus-onenote.js) · Microsoft 로그인(lib/ms-auth.js · lib/graph-onenote.js · lib/plus-connect.js) · KRS WORKSPACE 잇기(lib/ws-info.js)는 모두 걷어 냈다.
 * 폴더 트리: base(설정 plus.folder — 비면 내 OneDrive 문서/업무/shared: KRX_SP.resolveMyFolder(name) · 두 단 모두 없으면 만듦) / <과제 폴더 — 별칭 → Job Id(파일의 project.jobId, WORKSPACE 몫) → rERP 과제번호, KRX_PRJDOC.folderNameFor> / <n>차년도.json · 예상비용.json.
 *   폴더 이름은 표시용 — 과제는 파일 안의 project.prjNo 로 알아보고 storage.local.shareIndex = { [prjNo]: { base, folder, site, owner?, at } } 에 캐시한다(prjdoc-sync 가 돌려주는 state.index). 폴더 이름은 만들 때만 정하고 저절로 바꾸지 않는다(shareRename 으로 사용자가).
 *   받는 쪽(참여자)은 설정 없이도 "나와 공유"(discover) 의 폴더에서 내 참여 과제의 연차 파일을 찾아 대상에 넣는다 — 동료의 personal 사이트라 writer 는 사이트마다 따로(prjdoc-sync).
 * 역할 나눔: 저장소 접근 lib/sp-store.js(KRX_SP — 브라우저의 SharePoint 로그인 쿠키만. 읽기는 확장 출처 GET(credentials include), 쓰기·공유·링크는 작업 탭(최소화 창)에서 SharePoint REST — kr_ext_aip 방식. 2026-10-18 실측: 확장 출처 쓰기는 403) ·
 *   문서 모양·병합 lib/prjdoc.js(KRX_PRJDOC v2 — 연차 파일 { v:2, kind:'year', project, year, budget, staff, research, changes, updatedAt, updatedBy } · 예상 비용 파일 { v:2, kind:'plan', project, plan, … }, 칸마다 lib/plan-sync.js · research-sync.js · staff-sync.js 의 merge) ·
 *   과제별 차례 lib/prjdoc-sync.js(KRX_PRJDOC_SYNC.run — 대상 과제 = 내 참여 과제 ∪ 로컬 자료 ∪ base 폴더 ∪ 나와 공유 → 과제마다 폴더(없으면 책임자이거나 로컬 자료가 있을 때 만듦) → 연차마다 readFile → mergeYear → saveLocal 칸마다 → writer.modify, 예상비용.json 도 같은 식).
 * shareSync(reason, { prjNo? }): 한 번에 하나만. 진행 중이면 load/alarm 은 그 결과를 같이 받고, edit/manual(편집 큐·버튼·구름 아이콘)은 **끝난 뒤 한 번 더** 돈다(shareNext — 진행 중인 것은 loadLocal 을 이미 지나 그 편집을 모르므로; 기다리는 요청이 여럿이면 한 번으로 모으고 과제가 다르면 전체).
 *   load/alarm 은 마지막 성공 뒤 SHARE_SYNC_MIN_MS 안이면 건너뜀. prjNo 를 주면 그 과제만(구름/저장 아이콘 — prjdoc-sync 의 only).
 *   트리거: 패널·팝업을 열 때(load — lib/plan.js bind) · 편집 4초 뒤(planSyncQueue — plan.js · staff-ui.js · 설정의 연구개발계획서 칸) · 자동 갱신 알람(alarm) · 설정/팝업 버튼(manual) · 구름 아이콘(manual + prjNo). 메시지 이름은 옛 'planSync' · 'planSyncQueue' 그대로(패널·설정이 보냄).
 *   폴더를 **새로 만든** 과제가 있고 설정 shareWith 가 'participants' 면 그 과제의 참여인력(rtask_0008_t03_01_r001 의 EMP_NM — lib/staff.js rowsOfErp·byName, 내 이름 제외)에게 폴더를 편집 권한으로 공유하고 결과를 pages[prj].share 에 남긴다(shareFolderPeople 과 같은 길 —
 *   이름 겹침(ambiguous)·못 찾음(notFound)은 설정 페이지·사업비 관리의 [참여연구원에게 공유] 로 다시, 또는 OneDrive 에서 직접).
 *   결과 storage.local.shareState = { at, ok, reason, ms, base:{ path, viewUrl }, folder(= base, 호환), count(과제), files, written, pulled, errors, error?, kind?,
 *     pages:{ [prjNo]: { prjNo, title, folder(이름), folderUrl(보기 주소), planUrl(예상비용.json — 항목이 있을 때), webUrl(현재 연차 파일), owner?(남의 폴더면 주인), years, at, created, pulled, pushed, count, counts{ plan, research, staff, budget, changes }, remoteAt, remoteBy, share?{ shared, ambiguous, notFound, error? }, noFolder?, error?, kind? } } } —
 *   호환을 위해 planSyncState · researchSyncState · staffSyncState 에도 같은 것을 쓴다(lib/plan.js 아이콘 툴팁 · lib/staff-ui.js 공유 줄·변경이력 · lib/render.js · 설정 페이지가 읽는 키). 옛 캐시 plusPlanPages · plusResearchPages · plusStaffPages · plusSection 은 더 쓰지 않는다.
 *   kind 'auth'(이 브라우저에서 SharePoint 로그인 필요) · 'badurl'(폴더 주소 모양) · 'offline' · 'nofolder' · 'locked'(남이 체크아웃) · 'parse'(다른 판·깨진 파일 — 그 파일만 건너뜀) · 'http' · 'tab'(작업 탭) 은 KRX_SP.describe · prjdoc-sync 가 메시지와 함께 준다 — 팝업·설정이 그대로 보여 준다
 * shareProbe(msg): 설정 [연결 확인] — base 를 다시 풀고(msg.folder 가 있으면 저장 전 칸 값) 과제 폴더 목록(listFolders)과 "나와 공유" 의 폴더 수를 받아 본다. shareFolderCopy(msg): base(또는 prjNo 의 과제 폴더 · file 이면 예상비용.json)를 여는 주소를 클립보드에(오프스크린 문서).
 * shareFolderPeople(msg): 과제 폴더를 사람들(names — 없으면 참여인력 전부)에게 공유 → { share:{ shared, ambiguous, notFound } }. shareOrgLink(msg): 조직 내 편집 링크를 만들어 복사 → { ok, url, copied }. shareRename(msg): 과제 폴더 이름 바꾸기(선택 — shareIndex 도 고침).
 * 워커가 뜰 때 KRX_SP.sweepWorkers 로 지난 워커가 쓰기 도중 끝나 남긴 작업 창(최소화된 …/_api/web/currentuser?$select=Id)을 거둔다 — 아래 KRX_PREP_FETCH.resume 옆. 쿠키·다이제스트·피커 Key 값은 로그·상태에 찍지 않는다(이메일은 상태 표시에 쓴다) */
const SHARE_SYNC_MIN_MS = 60 * 1000;
const SHARE_BASE_NAME = '업무/shared';       // 설정 folder 가 비었을 때 내 OneDrive 문서 아래 밑폴더(두 단) — KRX_SP.resolveMyFolder 의 name (2026-10-18 저녁 사용자 "onedrive 에 업무/shared 안에 과제별로")
const SHARE_INDEX_KEY = 'shareIndex';         // { [prjNo]: { base, folder, site, owner?, at } } — 과제 → 폴더 캐시 (prjdoc-sync 가 돌려주는 state.index. 맞지 않으면 다시 훑는다)
const SHARE_CHANGES_KEY = 'shareChanges';     // { ['과제번호@연차']: [{ id, date, kind, item, before, after, reason, by, at, auto }] } — lib/staff-ui.js 가 적고 동기화가 연차 파일의 changes 칸과 합집합(id, at 차례, 최대 500)
const SHARE_PROJECTS_KEY = 'shareProjects';   // { [prjNo]: { jobId, io, start, end, note, … } } — 연차 파일 project 칸 가운데 rERP 가 모르는 것(KRS WORKSPACE 몫 — start·end 는 과제 **전체** 연구기간)을 보존·표시용으로 (rERP 가 아는 prjNm·rspr 는 R&D ERP 값이 늘 이김;
                                              //   rERP 과제 목록의 stDt/endDt 는 현재 **연차** 기간이라 project.start/end 로 보내지 않고 loadLocal 의 projects[].stDt/endDt 로만 — lib/prjdoc.js yearSpan 용)
const SHARE_CHANGES_MAX = 500;
const SHARE_PART_SVC = 'rtask_0008_t03_01_r001';   // 과제정보 › 참여인력 — 자동 공유할 사람 이름 (lib/staff.js rowsOfErp · byName, lib/staff-ui.js 와 같은 조회)
let shareInflight = null, shareNext = null, shareNextOpts = null, shareTimer = 0;
const spFetch = (u, o) => fetch(u, o);   // 서비스워커의 fetch 그대로 — credentials:'include' 는 저장소가 붙인다. 쿠키·다이제스트 값은 로그·결과 어디에도 찍지 않는다
const spIo = () => ({ fetch: spFetch, chrome });
/* 저장소 손잡이 — lib/prjdoc-sync.js 가 받는 store { listFiles, readFile, listFolders, sharedWithMe, openWriter, childCfg, … }. KRX_SP 함수에 fetch · chrome 을 여기서 넣어 prjdoc-sync 는 순수하게 둔다.
 *   그 밖의 KRX_SP 함수(childCfg · parseFolder · revive · fileUrl · folderUrl · describe …)는 그대로 넘긴다(순수 함수) */
const shareStore = Object.assign(Object.create(null), KRX_SP, {
  listFiles: (cfg, o) => KRX_SP.listFiles(cfg, Object.assign(spIo(), o || {})),
  readFile: (cfg, name, o) => KRX_SP.readFile(cfg, name, Object.assign(spIo(), o || {})),
  listFolders: (cfg, o) => KRX_SP.listFolders(cfg, Object.assign(spIo(), o || {})),
  sharedWithMe: (io, o) => KRX_SP.sharedWithMe(Object.assign(spIo(), io || {}), o || {}),
  openWriter: (cfg, o) => KRX_SP.openWriter(cfg, Object.assign(spIo(), o || {}))
});
const SHARE_MISSING = { off: '"공유 (Plus)" 체크(팝업 아래 줄 또는 설정 › 공유 (Plus))', items: '설정 › 공유 (Plus) 의 동기화 항목(예상 비용 · 연구내용 · 사업비 · 변경이력) 가운데 하나 이상 체크' };
/* 무엇을 맞출지 — 설정 공유 (Plus) 탭의 체크. budget(예산 줄)은 사업비 체크와 함께, alias 는 늘 (prjdoc-sync 의 want) */
const shareWant = (p) => ({ plan: p.planSync !== false, research: p.researchSync !== false, staff: p.staffSync !== false, budget: p.staffSync !== false, changes: p.changesSync !== false, alias: true });
const shareDriveHost = (p) => String((p && p.driveHost) || '').trim() || KRX_SETTINGS.DEFAULTS.plus.driveHost;
const shareObj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
/* 예상 비용 파일 이름 — KRX_PRJDOC.planName(함수 또는 문자열), 없으면 기본 */
const sharePlanName = () => { try { const v = KRX_PRJDOC.planName; return String((typeof v === 'function' ? v() : v) || '예상비용.json'); } catch (e) { return '예상비용.json'; } };
/* cfg 의 파일 주소 — 캐시에서 온 cfg 는 함수가 없을 수 있어 KRX_SP.fileUrl 로 */
const shareFileUrl = (cfg, name) => (typeof cfg.fileUrl === 'function' ? cfg.fileUrl(name) : KRX_SP.fileUrl(cfg, name));
/* 오류 → { kind, message } — KRX_SP.describe 가 못 받는 것(일반 Error)도 kind 'error' 로 */
function describeShare(e) {
  try { const d = KRX_SP.describe(e); if (d && d.message) return { kind: String(d.kind || 'error'), message: String(d.message) }; } catch (x) {}
  return { kind: String((e && e.kind) || 'error'), message: String((e && e.message) || e) };
}
const shareFail = (kind, message) => ({ ok: false, kind, message, error: message });
const SHARE_NOFOLDER_MSG = '이 과제의 공유 폴더가 아직 없습니다 — 공유 (Plus) 를 켜고 지금 동기화하면 만듭니다(과제책임자 또는 이 과제의 자료가 있을 때)';
/* 설정 plus → base cfg(KRX_SP.parseFolder 결과 — origin · sitePath · folderPath · viewUrl · mine 과 함수 fileApi · fileUrl). storage.local.shareFolder 에 cfg 를 JSON 으로 캐시(함수는 빠짐)하고 거기에 input(설정 folder) · driveHost · baseName · at 를 붙여 둔다 —
 *   설정 folder·driveHost 가 같고 기본 밑폴더 이름도 같으면(v1 의 문서/RERP 캐시는 baseName 이 없어 다시 푼다) 네트워크 없이 KRX_SP.revive 로 함수를 되살려 쓴다. force(연결 확인)이거나 캐시가 맞지 않으면 다시 푼다:
 *   KRX_SP.resolveFolder — folder 가 비면 내 OneDrive 의 문서/업무/shared(resolveMyFolder(name), mine:true), 공유 링크면 redirect 를 따라가, 아니면 parseFolder. 실패(auth · badurl · offline …)는 kind 가 붙은 Error 그대로 던진다 */
async function shareCfg(p, force) {
  const input = String((p && p.folder) || '').trim();
  const driveHost = shareDriveHost(p);
  if (!force) {
    const c = (await chrome.storage.local.get('shareFolder')).shareFolder || null;
    if (c && c.origin && c.folderPath && c.input === input && c.driveHost === driveHost && c.baseName === SHARE_BASE_NAME) { try { return typeof KRX_SP.revive === 'function' ? KRX_SP.revive(c) : KRX_SP.parseFolder(c.url || shareFolderUrl(c)); } catch (e) {} }   // 캐시가 안 풀리면(모양이 바뀜) 다시 푼다
  }
  const cfg = await KRX_SP.resolveFolder(input, { fetch: spFetch, driveHost, name: SHARE_BASE_NAME });
  const cached = JSON.parse(JSON.stringify(Object.assign({}, cfg)));   // 함수를 뺀 cfg
  await chrome.storage.local.set({ shareFolder: Object.assign(cached, { input, driveHost, baseName: SHARE_BASE_NAME, url: cached.url || shareFolderUrl(cfg), path: cfg.folderPath, at: Date.now() }) });
  return cfg;
}
/* 폴더 주소(브라우저·parseFolder 가 받는 모양 — 설정 [주소 복사] · 캐시 url). KRX_SP.folderUrl: 칸마다 encodeURIComponent — encodeURI 는 폴더 이름의 '#' 을 두어 동료가 붙여 넣으면 fragment 로 잘려 상위 폴더로 풀렸다 */
const shareFolderUrl = (cfg) => (typeof KRX_SP.folderUrl === 'function' ? KRX_SP.folderUrl(cfg) : cfg.origin + String(cfg.folderPath || '').split('/').map(encodeURIComponent).join('/'));
/* 과제 폴더 cfg — shareIndex 항목({ base, folder, site })으로. base 가 cfg 꼴(JSON)이면 revive, 폴더 주소면 parseFolder, 서버 상대 경로면 site 의 origin 과 합쳐 parseFolder, 그 밖엔 설정 base. 항목이 없으면 null(폴더를 아직 모름) */
async function shareProjectCfg(prjNo, p, index) {
  const idx = shareObj(index || (await chrome.storage.local.get(SHARE_INDEX_KEY))[SHARE_INDEX_KEY]);
  const e = idx[String(prjNo || '')];
  if (!e || !e.folder) return null;
  let base = null;
  try {
    if (e.base && typeof e.base === 'object' && e.base.origin && e.base.folderPath) base = KRX_SP.revive(e.base);
    else if (typeof e.base === 'string' && /^https:\/\//i.test(e.base)) base = KRX_SP.parseFolder(e.base);
    else if (typeof e.base === 'string' && e.base.startsWith('/') && e.site) base = KRX_SP.parseFolder(new URL(e.site).origin + e.base.split('/').map(encodeURIComponent).join('/'));
  } catch (x) { base = null; }
  if (!base) base = await shareCfg(p, false);
  return typeof KRX_SP.childCfg === 'function' ? KRX_SP.childCfg(base, String(e.folder)) : KRX_SP.parseFolder(`${shareFolderUrl(base)}/${encodeURIComponent(String(e.folder))}`);
}
/* 변경이력 합집합 — id 로(같은 id 는 뒤 것이 칸을 덧씀), at 차례(같으면 date), 최대 SHARE_CHANGES_MAX(오래된 것부터 버림). lib/staff-ui.js appendChanges 와 같은 규칙 */
function shareMergeChanges(a, b) {
  const map = new Map();
  for (const c of (Array.isArray(a) ? a : []).concat(Array.isArray(b) ? b : [])) {
    if (!c || typeof c !== 'object' || !c.id) continue;
    const id = String(c.id);
    map.set(id, map.has(id) ? Object.assign({}, map.get(id), c) : c);
  }
  const out = Array.from(map.values()).sort((x, y) => ((Number(x.at) || 0) - (Number(y.at) || 0)) || String(x.date || '').localeCompare(String(y.date || '')));
  return out.length > SHARE_CHANGES_MAX ? out.slice(out.length - SHARE_CHANGES_MAX) : out;
}
/* prjdoc-sync 의 loadLocal — 로컬 자료를 한 번에. plan 은 lib/plan.js 저장소 모양 그대로({ plans, del }), staff 는 lib/staff.js normalizePlans · gcTomb 를 거친 것, research 는 researchPlans 맵, aliases · aliasesAt 는 projectAliases · projectAliasesAt,
 *   changes 는 shareChanges 맵('과제번호@연차' → []), projects 는 { [prjNo]: { prjNm, rspr, anl, stDt, endDt, start?, end?, jobId?, io?, note?, at? } } — 참여 과제 목록 + 패널 캐시(R&D ERP 값이 이김) + shareProjects(WORKSPACE 몫).
 *   stDt/endDt(RCH_ST_DT/RCH_END_DT, YYYYMMDD)는 R&D ERP 가 주는 **현재 연차** 기간이라(lib/rnd-api.js 가 ANL 이 가장 큰 행을 고름) 과제 전체 연구기간인 project.start/end 에 넣지 않는다 — 넣으면 연차가 바뀔 때마다 모든 연차 파일의 연구기간이 바뀌고
 *   두 rerp 사용자의 캐시 연차가 다르면 서로 번갈아 고친다(2026-10-18 검토). prjdoc 의 yearSpan(연차 기본 기간)에만 쓴다 */
async function shareLoadLocal() {
  const l = await chrome.storage.local.get([KRX_PLAN.KEY, KRX_PLAN.DKEY, KRX_STAFF.KEY, KRX_STAFF.DKEY, 'projectAliases', 'projectAliasesAt', SHARE_CHANGES_KEY, SHARE_PROJECTS_KEY, 'projectList', CACHE_KEY]);
  const projects = {};
  for (const pr of ((l.projectList && l.projectList.projects) || []).concat(((l[CACHE_KEY] || {}).projects) || [])) {
    if (!pr || !pr.prjNo || projects[pr.prjNo]) continue;
    projects[pr.prjNo] = { prjNm: String(pr.prjNm || ''), rspr: String(pr.rspr || ''), anl: Number(pr.anl) || 0, stDt: String(pr.stDt || ''), endDt: String(pr.endDt || '') };
  }
  for (const [prj, x] of Object.entries(shareObj(l[SHARE_PROJECTS_KEY]))) {   // WORKSPACE 몫(jobId · io · note …)은 받은 그대로, rERP 가 아는 칸은 값이 있을 때만 rERP 것으로
    if (!x || typeof x !== 'object') continue;
    const merged = Object.assign({}, x);
    for (const [k, v] of Object.entries(projects[prj] || {})) if (v || merged[k] === undefined) merged[k] = v;
    projects[prj] = merged;
  }
  return {
    plan: { plans: shareObj(l[KRX_PLAN.KEY]), del: shareObj(l[KRX_PLAN.DKEY]) },
    research: await KRX_RESEARCH.load(),
    staff: { plans: KRX_STAFF.normalizePlans(l[KRX_STAFF.KEY]), del: KRX_STAFF.gcTomb(l[KRX_STAFF.DKEY]) },
    aliases: shareObj(l.projectAliases),
    aliasesAt: shareObj(l.projectAliasesAt),
    changes: shareObj(l[SHARE_CHANGES_KEY]),
    projects
  };
}
/* prjdoc-sync 의 saveLocal(part, prj, data) — 그 과제 몫만 저장한다(다른 창이 같은 키의 다른 과제를 고치는 중일 수 있고, 백그라운드의 오래된 메모리로 덮지 않게 — lib/plan.js save 와 같은 까닭). data 의 모양은 느슨하게 받는다:
 *   'plan'     { plans, del } — plans 는 전체 맵({ prj: { key: [항목] } }) · 이 과제 몫({ key: [항목] }) · 또는 평면 목록 items. del 은 전체 묘비 맵({ id: { ts, prj } }) 또는 이 과제 몫 숫자 맵({ id: ts } — lib/plan-sync.js merge 가 주는 것; 빈 것도 이 과제 몫으로 봄)
 *   'research' 기록 목록(이 과제의 기록 — prjNo 가 없으면 prj 와 과제명으로 채움 · linkBy 는 'auto') · { recs, others? } · 또는 researchPlans 전체 맵(그 가운데 이 과제 것만).
 *              others({ id: rec } — KRX_PRJDOC.toLocalYear 가 주는, 로컬에서 **다른 과제**에 이어 둔 기록인데 이 파일에서 새 글을 받은 것)는 지금 저장소의 연결 칸(prjNo·prjNm·linkBy·src)을 지키며 글만 갈아 넣는다 — 안 넣으면 매 동기화마다 다시 "받은 것" 이 돼 받음 표시가 반복된다
 *   'staff'    { plans, del } — plans 는 전체 맵({ "과제@연차": 계획 }) 또는 계획 목록(이 과제 것만 반영), del 은 전체 또는 이 과제 몫({ "과제@연차": ts }). 예산 줄이 있는 계획은 budgetPay 를 그 줄에서 다시 셈한다(병합이 비춘 줄과 어긋난 옛 값 방어 — lib/staff-ui.js syncPay 와 같은 식)
 *   'budget'   { year, budget|rows:[{ name, plan, at?, by? }] } · { [연차 또는 '과제@연차']: 줄들 } · 연차 계획 통째({ plans }) — 그 연차 staffPlans 항목의 budget(·budgetPay)만 갈아 넣음(없으면 빈 계획을 만듦)
 *   'changes'  { year, changes|list } · { [연차 또는 '과제@연차']: [...] } — shareChanges 의 그 연차와 **합집합**(id, at 차례, 최대 500 — 덧붙이기만)
 *   'project'  { jobId?, io?, start?, end?, note?, … } — shareProjects[prj] 에 겹쳐 둠(표시·보존용 WORKSPACE 몫 — start·end 는 과제 전체 연구기간. rERP 가 아는 칸(prjNm·rspr)은 loadLocal 이 R&D ERP 값으로 되돌림)
 *   'alias'    별칭 문자열 또는 { alias, aliasAt } — projectAliases[prj](비면 지움) · projectAliasesAt[prj] */
async function shareSaveLocal(part, prj, data, names) {
  prj = String(prj || '');
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  if (part === 'plan') {
    const d = isObj(data) ? data : {};
    let plans = isObj(d.plans) ? d.plans : (Array.isArray(d.items) ? KRX_PLAN_SYNC.unflatten(d.items.map((it) => Object.assign({ prj }, it))) : {});
    if (Object.values(plans).some(Array.isArray)) plans = { [prj]: plans };   // 이 과제 몫({ key: [항목] })이 왔다
    let del = isObj(d.del) ? d.del : {};
    if (!Object.values(del).some(isObj)) {   // 이 과제 몫 숫자 맵(빈 것 포함) → 전체 묘비 맵에 되돌려 넣기 (다른 과제의 묘비는 그대로)
      const cur = (await chrome.storage.local.get(KRX_PLAN.DKEY))[KRX_PLAN.DKEY] || {};
      del = KRX_PLAN_SYNC.putBack({ plans: {}, del: isObj(cur) ? cur : {} }, prj, [], del).del;
    }
    await KRX_PLAN.save(plans, del, prj);
    return;
  }
  if (part === 'research') {
    const map = await KRX_RESEARCH.load();
    let recs = Array.isArray(data) ? data : (isObj(data) && Array.isArray(data.recs)) ? data.recs : null;
    if (!recs && isObj(data)) recs = Object.values(data).filter((r) => r && r.prjNo === prj);   // 전체 맵 — 이 과제 것만
    for (const [id, rec] of Object.entries(map)) if (rec && rec.prjNo === prj) delete map[id];   // 이 과제 몫을 통째로 바꿈
    for (const rec of recs || []) if (rec && rec.id) map[rec.id] = Object.assign({}, rec, rec.prjNo ? {} : { prjNo: prj, prjNm: rec.prjNm || (names && names[prj]) || '', linkBy: rec.linkBy || 'auto' });
    // 다른 과제에 이어 둔 기록의 새 글 — 연결 칸은 지금 저장소 것을 지킨다(그 사이 사용자가 다른 과제로 옮겼을 수 있음)
    const others = isObj(data) && isObj(data.others) ? data.others : {};
    for (const [id, rec] of Object.entries(others)) {
      const cur = map[id];
      if (!rec || !rec.id || !cur || !cur.prjNo || cur.prjNo === prj) continue;
      const keep = {};
      for (const k of ['prjNo', 'prjNm', 'linkBy', 'src']) if (cur[k] !== undefined) keep[k] = cur[k];
      map[id] = Object.assign({}, rec, keep);
    }
    await KRX_RESEARCH.save(map);
    return;
  }
  if (part === 'staff') {
    const d = isObj(data) ? data : {};
    const slice = (k) => String(k).split('@')[0] === prj;
    const s = await chrome.storage.local.get([KRX_STAFF.KEY, KRX_STAFF.DKEY]);
    const cur = KRX_STAFF.normalizePlans(s[KRX_STAFF.KEY]), curDel = KRX_STAFF.gcTomb(s[KRX_STAFF.DKEY]);
    for (const k of Object.keys(cur)) if (slice(k)) delete cur[k];
    const list = Array.isArray(d.plans) ? d.plans : Object.values(isObj(d.plans) ? d.plans : {});
    for (const p of list) {
      const e = KRX_STAFF.normalizePlanEntry(p);
      if (!e || e.prjNo !== prj || !(e.year >= 1)) continue;
      if (Array.isArray(e.budget) && e.budget.length) e.budgetPay = KRX_STAFF.budgetPayOf(e.budget);   // 예산 줄이 있으면 인건비 예산은 늘 그 줄에서 — 병합이 비춘 줄과 어긋난 옛 budgetPay 가 'budget' 저장 뒤의 'staff' 저장으로 되살아나지 않게
      cur[KRX_STAFF.planKey(e.prjNo, e.year)] = e;
    }
    for (const k of Object.keys(curDel)) if (slice(k)) delete curDel[k];
    for (const [k, v] of Object.entries(isObj(d.del) ? d.del : {})) if (slice(k)) curDel[k] = Number(v) || 0;
    await chrome.storage.local.set({ [KRX_STAFF.KEY]: cur, [KRX_STAFF.DKEY]: curDel });
    return;
  }
  if (part === 'budget') {
    const d = isObj(data) ? data : {};
    if (Array.isArray(d.plans) || isObj(d.plans)) return shareSaveLocal('staff', prj, d, names);   // 연차 계획 통째로 왔으면 사업비와 같이
    const byYear = {};
    const put = (y, rows) => { const yy = Number(String(y).split('@').pop()); if (yy >= 1 && Array.isArray(rows)) byYear[yy] = rows; };
    if (d.year >= 1 && Array.isArray(d.budget || d.rows)) put(d.year, d.budget || d.rows);
    else for (const [k, rows] of Object.entries(d)) put(k, rows);
    if (!Object.keys(byYear).length) return;
    const s = await chrome.storage.local.get(KRX_STAFF.KEY);
    const cur = KRX_STAFF.normalizePlans(s[KRX_STAFF.KEY]);
    for (const [y, rows] of Object.entries(byYear)) {
      const key = KRX_STAFF.planKey(prj, Number(y));
      const plan = cur[key] || KRX_STAFF.normalizePlanEntry({ prjNo: prj, year: Number(y), prjNm: (names && names[prj]) || '' }, key);
      plan.budget = KRX_STAFF.normalizeBudget(rows.map((r) => ({ name: r && r.name, plan: r && r.plan })));
      plan.budgetPay = KRX_STAFF.budgetPayOf(plan.budget);
      cur[key] = plan;
    }
    await chrome.storage.local.set({ [KRX_STAFF.KEY]: cur });
    return;
  }
  if (part === 'changes') {
    const byKey = {};
    const put = (y, list) => { const yy = Number(String(y).split('@').pop()); if (yy >= 1 && Array.isArray(list)) byKey[`${prj}@${yy}`] = list; };
    if (isObj(data) && data.year >= 1 && Array.isArray(data.changes || data.list)) put(data.year, data.changes || data.list);
    else if (isObj(data)) for (const [k, list] of Object.entries(data)) put(k, list);
    if (!Object.keys(byKey).length) return;   // 연차를 모르는 목록은 넣을 자리가 없다
    const cur = (await chrome.storage.local.get(SHARE_CHANGES_KEY))[SHARE_CHANGES_KEY];
    const all = Object.assign({}, shareObj(cur));
    for (const [k, list] of Object.entries(byKey)) all[k] = shareMergeChanges(all[k], list);
    await chrome.storage.local.set({ [SHARE_CHANGES_KEY]: all });
    return;
  }
  if (part === 'project') {
    if (!isObj(data)) return;
    const cur = (await chrome.storage.local.get(SHARE_PROJECTS_KEY))[SHARE_PROJECTS_KEY];
    const all = Object.assign({}, shareObj(cur));
    const keep = {};
    for (const [k, v] of Object.entries(data)) if (v !== undefined && v !== null && typeof v !== 'function') keep[k] = v;
    all[prj] = Object.assign({}, shareObj(all[prj]), keep);
    await chrome.storage.local.set({ [SHARE_PROJECTS_KEY]: all });
    return;
  }
  if (part === 'alias') {
    const alias = String(isObj(data) ? (data.alias || '') : (data || '')).trim();
    const at = isObj(data) ? (Number(data.aliasAt) || 0) : Date.now();   // prjdoc 의 aliasAt 그대로(0 이면 시각 없음 — 지움), 문자열만 왔으면 지금
    const l = await chrome.storage.local.get(['projectAliases', 'projectAliasesAt']);
    const aliases = Object.assign({}, isObj(l.projectAliases) ? l.projectAliases : {}), ats = Object.assign({}, isObj(l.projectAliasesAt) ? l.projectAliasesAt : {});
    if (alias) aliases[prj] = alias; else delete aliases[prj];
    if (at) ats[prj] = at; else delete ats[prj];
    await chrome.storage.local.set({ projectAliases: aliases, projectAliasesAt: ats });
    return;
  }
  throw new Error(`모르는 저장 칸: ${part}`);
}
/* 내 이름들 — 패널 캐시 myNames + R&D ERP 로그인 이름 + 설정 myName (책임자 판정 · 자동 공유에서 나를 빼는 데) */
const shareMyNames = (cache, settings, who) => new Set(((cache && cache.myNames) || []).concat([who, settings && settings.myName]).map((x) => String(x || '').trim()).filter(Boolean));
/* 내가 책임자인 과제 — v1 planSync 와 같은 규칙(render.js isLead): 참여인력 역할에 "책임" 이 있거나 과제책임자 이름이 본인(참여인력 행 이름 · 설정/자동 감지 이름 · R&D ERP 로그인 이름)인 과제. 폴더를 새로 만들 수 있는 사람(prjdoc-sync 의 leadPrjNos) */
function shareLeadPrjNos(projects, cache, settings, who) {
  const myNames = shareMyNames(cache, settings, who);
  const lead = new Set();
  for (const x of (cache && cache.participation && cache.participation.items) || []) {
    if (/책임/.test(String(x.role || '')) || (x.rspr && (String(x.rspr).trim() === String(x.empNm || '').trim() || myNames.has(String(x.rspr).trim())))) lead.add(x.prjNo);
  }
  for (const pr of projects || []) if (pr && pr.prjNo && pr.rspr && myNames.has(String(pr.rspr).trim())) lead.add(pr.prjNo);
  return Array.from(lead).filter(Boolean);
}
/* 과제의 참여인력 이름(내 이름 제외) — R&D ERP 참여인력 조회(로그인이 풀려 있으면 kind 'login' Error) */
async function shareParticipantNames(prjNo, myNames) {
  const data = await KRX_API.call(SHARE_PART_SVC, { SEARCH_NM: '', SEARCH_GB: '1', PRJ_NO: String(prjNo) });
  const by = KRX_STAFF.byName(KRX_STAFF.rowsOfErp(data && data.INFO_REC));
  return Array.from(new Set(Object.values(by).map((h) => String(h.name || '').trim()).filter((n) => n && !myNames.has(n))));
}
/* writer.sharePeople 결과 → 상태에 남길 모양(피커 Key 같은 로그인 값은 싣지 않는다 — 이름·이메일·후보 표시 이름만) */
function shareResultOf(r, role) {
  const o = r && typeof r === 'object' ? r : {};
  const share = {
    shared: (Array.isArray(o.shared) ? o.shared : []).map((x) => ({ name: String((x && x.name) || ''), email: String((x && x.email) || '') })),
    ambiguous: (Array.isArray(o.ambiguous) ? o.ambiguous : []).map((x) => ({ name: String((x && x.name) || ''), candidates: (Array.isArray(x && x.candidates) ? x.candidates : []).slice(0, 10).map(String) })),
    notFound: (Array.isArray(o.notFound) ? o.notFound : []).map(String),
    role: role || 'edit', at: Date.now()
  };
  if (o.error) share.error = String(o.error);
  return share;
}
const shareResultText = (s) => `공유 ${s.shared.length}명${s.ambiguous.length ? ` · 이름 겹침 ${s.ambiguous.length}` : ''}${s.notFound.length ? ` · 못 찾음 ${s.notFound.length}` : ''}${s.error ? ` · 오류: ${s.error}` : ''}`;
/* 여러 과제 폴더를 사람들에게 공유 — jobs = [{ prjNo, cfg, names, pg(결과를 받을 pages 항목) }]. writer 는 **사이트마다** 하나(동료 폴더는 그 사람의 personal 사이트) */
async function sharePeopleJobs(jobs, role) {
  const bySite = new Map();
  for (const j of jobs) { const k = String((j.cfg && j.cfg.siteUrl) || ''); if (!bySite.has(k)) bySite.set(k, []); bySite.get(k).push(j); }
  for (const list of bySite.values()) {
    let w = null;
    try { w = await shareStore.openWriter(list[0].cfg); }
    catch (e) { const d = describeShare(e); for (const j of list) j.pg.share = Object.assign(shareResultOf(null, role), { error: d.message, kind: d.kind }); continue; }
    try {
      for (const j of list) {
        try { j.pg.share = shareResultOf(await w.sharePeople(j.cfg.folderPath, j.names, { role: role || 'edit' }), role); }
        catch (e) { const d = describeShare(e); j.pg.share = Object.assign(shareResultOf(null, role), { error: d.message, kind: d.kind }); }
      }
    } finally { try { await w.close(); } catch (e) {} }
  }
}
/* 동기화 결과의 pages 에 과제 폴더 주소(folderUrl) · 예상비용.json 주소(planUrl — 항목이 있을 때) · 주인(owner)을 shareIndex 로 채운다(prjdoc-sync 가 이미 넣었으면 그대로). 네트워크 없음 */
async function shareDecoratePages(state, p, index) {
  for (const [prj, pg] of Object.entries(state.pages || {})) {
    const e = index[prj];
    if (!pg || !e || !e.folder) continue;
    try {
      const cfg = await shareProjectCfg(prj, p, index);
      if (!cfg) continue;
      if (!pg.folder) pg.folder = String(e.folder);
      if (!pg.folderUrl) pg.folderUrl = cfg.viewUrl || shareFolderUrl(cfg);
      if (!pg.planUrl && (pg.planFile || (pg.counts && pg.counts.plan > 0))) pg.planUrl = shareFileUrl(cfg, sharePlanName());
      if (!pg.owner && e.owner) pg.owner = String(e.owner);
    } catch (x) {}
  }
}
/* 폴더를 **새로 만든** 과제(prjdoc-sync 의 state.created 목록 또는 pages[prj].folderCreated — pages[prj].created 는 "파일을 새로 만듦" 이라 쓰지 않는다: 있던 폴더에 다음 연차 파일이 생길 때마다 다시 공유하지 않게)의
 *   참여인력에게 자동 공유(편집) — 설정 shareWith 'participants'. 남의 폴더(owner)·오류 과제는 건너뛴다. 결과는 pages[prj].share */
async function shareAutoPeople(state, p, index, settings, who, cache) {
  const pages = Object.values(state.pages || {}).filter((pg) => pg && !pg.error && !pg.owner && index[pg.prjNo] && index[pg.prjNo].folder);
  const createdSet = new Set((Array.isArray(state.created) ? state.created : []).map(String));
  const made = pages.filter((pg) => pg.folderCreated === true || createdSet.has(String(pg.prjNo)));
  if (!made.length) return;
  const myNames = shareMyNames(cache, settings, who);
  const jobs = [];
  for (const pg of made) {
    try {
      const names = await shareParticipantNames(pg.prjNo, myNames);
      if (!names.length) { pg.share = Object.assign(shareResultOf(null, 'edit'), { note: '참여인력에 나 말고는 없음' }); continue; }
      const cfg = await shareProjectCfg(pg.prjNo, p, index);
      if (cfg) jobs.push({ prjNo: pg.prjNo, cfg, names, pg });
    } catch (e) { const d = describeShare(e); pg.share = Object.assign(shareResultOf(null, 'edit'), { error: d.message, kind: d.kind }); }
  }
  if (jobs.length) await sharePeopleJobs(jobs, 'edit');
}
/* shareState.pages[prjNo] 에 칸을 덧씀(공유 결과 · 폴더 이름) — 네 호환 키에 같이 */
async function sharePatchPage(prjNo, patch) {
  const st = (await chrome.storage.local.get('shareState')).shareState || { at: 0, ok: true, count: 0, written: 0, pulled: 0, errors: 0, pages: {} };
  st.pages = Object.assign({}, st.pages);
  st.pages[prjNo] = Object.assign({ prjNo, title: prjNo }, st.pages[prjNo] || {}, patch);
  await chrome.storage.local.set({ shareState: st, planSyncState: st, researchSyncState: st, staffSyncState: st });
  return st;
}
async function shareSync(reason, opts) {
  opts = opts || {};
  if (shareInflight) {
    if (reason === 'load' || reason === 'alarm') return shareInflight;   // 곧 끝날 결과로 충분
    // 편집 큐·버튼·구름 아이콘: 진행 중인 동기화는 loadLocal 을 이미 지나 이 편집을 모른다 → 끝난 뒤 한 번 더(기다리는 요청은 하나로 모음 — 과제가 다르면 전체, manual 이 하나라도 있으면 manual)
    if (shareNext) {
      if (shareNextOpts.prjNo && shareNextOpts.prjNo !== String(opts.prjNo || '')) shareNextOpts.prjNo = '';
      if (reason === 'manual') shareNextOpts.reason = 'manual';
      return shareNext;
    }
    shareNextOpts = { reason, prjNo: String(opts.prjNo || '') };
    const go = () => { const o = shareNextOpts; shareNext = null; shareNextOpts = null; return shareSync(o.reason, { prjNo: o.prjNo }); };
    shareNext = shareInflight.then(go, go);
    return shareNext;
  }
  shareInflight = (async () => {
    const settings = await KRX_SETTINGS.load();
    const p = settings.plus || {};
    const want = shareWant(p);
    if (!p.enabled || !(want.plan || want.research || want.staff || want.changes)) return { ok: false, skipped: 'off', missing: [!p.enabled && SHARE_MISSING.off, p.enabled && SHARE_MISSING.items].filter(Boolean) };
    const prev = (await chrome.storage.local.get('shareState')).shareState || null;
    if ((reason === 'load' || reason === 'alarm') && prev && prev.ok && Date.now() - prev.at < SHARE_SYNC_MIN_MS) return Object.assign({ skipped: 'recent' }, prev);
    const t0 = Date.now();
    let state;
    try {
      const l = await chrome.storage.local.get(['projectList', 'rndUser', 'projectAliases', SHARE_INDEX_KEY]);
      const cache = await getCache();
      const mine = (l.projectList && l.projectList.projects) || [];
      const projects = mine.concat((cache && cache.projects) || []);
      const names = {}, rsprs = {};   // 과제명 · 책임자: 참여 과제 목록 + 패널 캐시
      for (const pr of projects) if (pr && pr.prjNo) { if (pr.prjNm && !names[pr.prjNo]) names[pr.prjNo] = pr.prjNm; if (pr.rspr && !rsprs[pr.prjNo]) rsprs[pr.prjNo] = pr.rspr; }
      const myPrjNos = Array.from(new Set(mine.map((pr) => pr && pr.prjNo).filter(Boolean)));
      const who = String((l.rndUser || {}).userNm || settings.myName || '');
      const leadPrjNos = shareLeadPrjNos(projects, cache, settings, who);
      const index = shareObj(l[SHARE_INDEX_KEY]);
      const cfg = await shareCfg(p, false);   // 못 풀면(auth · badurl · offline) 아래 catch 가 kind 그대로 상태에 남겨 팝업·설정이 안내한다
      const r = await KRX_PRJDOC_SYNC.run({
        store: shareStore, io: spIo(), base: cfg, cfg, driveHost: shareDriveHost(p), names, rsprs, myPrjNos, leadPrjNos, aliases: shareObj(l.projectAliases), index, discover: p.discover !== false,
        only: opts.prjNo || '', want, who, loadLocal: shareLoadLocal, saveLocal: (part, prj, data) => shareSaveLocal(part, prj, data, names), now: t0
      });
      const rs = (r && r.state) || {};
      state = Object.assign({ at: t0, ok: true, base: { path: cfg.folderPath, viewUrl: cfg.viewUrl || '' }, count: 0, files: 0, written: 0, pulled: 0, errors: 0, pages: {} }, rs, { reason, ms: Date.now() - t0 });
      if (!state.base || !state.base.path) state.base = { path: cfg.folderPath, viewUrl: cfg.viewUrl || '' };
      state.folder = state.folder && state.folder.path ? state.folder : state.base;   // 호환(팝업·옛 설정 페이지가 folder 를 읽음)
      const newIndex = rs.index && typeof rs.index === 'object' && !Array.isArray(rs.index) ? rs.index : index;   // run 이 돌려준 새 캐시(비어 있어도 그것) — 없으면 지난 것
      if (newIndex !== index) await chrome.storage.local.set({ [SHARE_INDEX_KEY]: newIndex });
      delete state.index;   // 캐시는 shareIndex 에 — 상태에는 두지 않는다
      await shareDecoratePages(state, p, newIndex);
      if (p.shareWith !== 'none') await shareAutoPeople(state, p, newIndex, settings, who, cache);
      state.ms = Date.now() - t0;
    } catch (e) {
      const d = describeShare(e);
      state = { at: t0, ok: false, reason, error: d.message, kind: d.kind, ms: Date.now() - t0, base: (prev && prev.base) || null, folder: (prev && (prev.folder || prev.base)) || null, count: 0, written: 0, pulled: 0, errors: 1, pages: (prev && prev.pages) || {} };
      if (d.kind === 'badurl') { try { await chrome.storage.local.remove('shareFolder'); } catch (e2) {} }   // 캐시한 폴더 주소가 틀렸을 수 있다 — 다음에 다시 푼다
    }
    if ((opts.prjNo || !state.ok) && prev && prev.pages) state.pages = Object.assign({}, prev.pages, state.pages || {});   // 과제 하나만 돌렸거나 실패했으면(로그인 풀림 등 — run 이 ok:false 로 돌려줄 때도) 다른 과제·지난 결과는 남긴다 (툴팁이 과제별로 읽음, 오류는 error · kind 에)
    await chrome.storage.local.set({ shareState: state, planSyncState: state, researchSyncState: state, staffSyncState: state });
    return state;
  })().finally(() => { shareInflight = null; });
  return shareInflight;
}
function queueShareSync(reason) { clearTimeout(shareTimer); shareTimer = setTimeout(() => { shareSync(reason || 'edit').catch(() => {}); }, 4000); }   // 그때 동기화가 진행 중이면 shareSync 가 끝난 뒤 한 번 더 돌게 잡아 둔다
/* 설정 페이지 [연결 확인] — base 를 다시 풀고(msg.folder 가 있으면 저장 전 칸 값으로) 과제 폴더 목록과 "나와 공유" 의 폴더를 받아 본다
 *   → { ok, folder:{ path, viewUrl, url }, folders:[{ name, path, itemCount, modified }], count(과제 폴더 수), exists(밑폴더 있음), mine(내 OneDrive 인지), shared(나와 공유의 폴더 가운데 shared 밑 — 연차 파일은 여기서 읽지 않음), sharedFolders:[{ name, webUrl, ownerName }], sharedKnown(shareIndex 에 주인이 적힌 과제 수 — 지난 동기화가 찾은 것), message }
 *   실패 → { ok:false, kind, message, error } — 'auth' 면 이 브라우저에서 SharePoint(OneDrive) 로그인 필요(설정 페이지가 OneDrive 열기 링크로 안내), 'badurl' 이면 주소 모양(공유 링크 대신 폴더를 연 뒤 주소창의 주소) */
async function shareProbe(msg) {
  const p = Object.assign({}, (await KRX_SETTINGS.load()).plus || {});
  if (msg && msg.folder !== undefined && msg.folder !== null) p.folder = String(msg.folder);
  try {
    const cfg = await shareCfg(p, true);
    let folders = null;
    try { folders = await shareStore.listFolders(cfg); } catch (e) { if (!(e && e.kind === 'nofolder')) throw e; }
    let mine = !!cfg.mine || !String(p.folder || '').trim();   // 비워 두었으면 내 OneDrive(resolveMyFolder 가 mine:true). 붙여 넣은 주소면 내 OneDrive 와 사이트가 같은지 본다
    if (!mine) { try { const my = await KRX_SP.resolveMyFolder({ fetch: spFetch, driveHost: shareDriveHost(p), name: SHARE_BASE_NAME }); mine = my.origin === cfg.origin && String(my.sitePath || '').toLowerCase() === String(cfg.sitePath || '').toLowerCase(); } catch (e) {} }
    let shared = null;
    if (p.discover !== false) {
      try {
        const dec = (u) => { try { return decodeURIComponent(String(u || '')); } catch (e) { return String(u || ''); } };
        shared = ((await shareStore.sharedWithMe({}, { driveHost: shareDriveHost(p) })) || []).filter((f) => f && f.folder && /\/shared(\/[^/]*)?\/?$/i.test(dec(f.webUrl))).map((f) => ({ name: String(f.name || ''), webUrl: String(f.webUrl || ''), ownerName: String(f.ownerName || '') }));
      } catch (e) { shared = null; }
    }
    const index = shareObj((await chrome.storage.local.get(SHARE_INDEX_KEY))[SHARE_INDEX_KEY]);
    const sharedKnown = Object.values(index).filter((e) => e && e.owner).length;
    const list = (folders || []).map((f) => ({ name: String(f.name || ''), path: String(f.path || ''), itemCount: Number(f.itemCount) || 0, modified: String(f.modified || '') }));
    return { ok: true, folder: { path: cfg.folderPath, viewUrl: cfg.viewUrl || '', url: shareFolderUrl(cfg) }, folders: list, count: list.length, exists: folders !== null, mine, shared: shared ? shared.length : 0, sharedFolders: shared || [], sharedKnown,
      message: folders === null ? '밑폴더가 아직 없습니다 — 지금 동기화하면 만듭니다' : `연결됨 · 과제 폴더 ${list.length}개${shared !== null ? ` · 나와 공유 ${shared.length}개` : ''}${sharedKnown ? ` (그중 동기화 대상 ${sharedKnown}개)` : ''}` };
  } catch (e) { const d = describeShare(e); return shareFail(d.kind, d.message); }
}
/* 클립보드 쓰기: 서비스워커는 클립보드에 못 쓰므로 오프스크린 문서(offscreen/offscreen.html, reason CLIPBOARD)를 띄워 execCommand('copy') 로 쓴다.
 * 패널의 주소 복사가 폴더를 푸느라 몇 초 걸리면 콘텐츠스크립트의 클릭 권한(transient activation)이 끝나 직접 못 쓰기 때문 */
async function clipboardWrite(text) {
  try {
    const url = chrome.runtime.getURL('offscreen/offscreen.html');
    const has = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [url] });
    if (!has.length) await chrome.offscreen.createDocument({ url: 'offscreen/offscreen.html', reasons: ['CLIPBOARD'], justification: '공유 (Plus): 공유 폴더 주소·링크를 클립보드에 복사' });
    const r = await chrome.runtime.sendMessage({ type: 'offscreenCopy', text });
    try { await chrome.offscreen.closeDocument(); } catch (e) {}
    return !!(r && r.ok);
  } catch (e) { return false; }
}
/* 패널 ⬆(plan-export) · 사업비 관리 · 설정 [주소 복사]: 주소를 클립보드에 복사한다 — prjNo 가 있고 그 과제 폴더를 알면 과제 폴더 보기 주소(msg.file 이면 예상비용.json 주소), 아니면 base 를 여는 주소(viewUrl — 없으면 폴더 주소). 공유 (Plus) 가 꺼져 있어도 복사해 준다
 *   → { ok, copied, url, what('project' | 'base'), prjNo, folder:{ path, viewUrl } } | { ok:false, kind, message, error }. 옛 메시지 이름 'planExport' 도 여기로 */
async function shareFolderCopy(msg) {
  const p = (await KRX_SETTINGS.load()).plus || {};
  try {
    const prj = msg && msg.prjNo ? String(msg.prjNo) : '';
    let cfg = prj ? await shareProjectCfg(prj, p) : null, what = cfg ? 'project' : 'base';
    if (!cfg) cfg = await shareCfg(p, false);
    const url = (what === 'project' && msg.file) ? shareFileUrl(cfg, sharePlanName()) : (cfg.viewUrl || shareFolderUrl(cfg));
    const copied = await clipboardWrite(url);
    return { ok: true, copied, url, what, prjNo: prj, folder: { path: cfg.folderPath, viewUrl: cfg.viewUrl || '' } };
  } catch (e) { const d = describeShare(e); return shareFail(d.kind, d.message); }
}
/* 사업비 관리 [참여연구원에게 공유] · 설정 페이지: 과제 폴더를 사람들에게 공유 — msg = { prjNo, names?(없으면 참여인력 전부, 내 이름 제외), role?('edit' 기본 | 'read') }
 *   → { ok, prjNo, folder(이름), share:{ shared:[{ name, email }], ambiguous:[{ name, candidates }], notFound:[name], error? }, message } | { ok:false, kind, message, error }. 결과는 shareState.pages[prjNo].share 에도 남긴다 */
async function shareFolderPeople(msg) {
  const settings = await KRX_SETTINGS.load(), p = settings.plus || {};
  const prjNo = String((msg && msg.prjNo) || '').trim();
  if (!prjNo) return shareFail('error', '과제번호가 없습니다');
  try {
    const index = shareObj((await chrome.storage.local.get(SHARE_INDEX_KEY))[SHARE_INDEX_KEY]);
    const cfg = await shareProjectCfg(prjNo, p, index);
    if (!cfg) return shareFail('nofolder', SHARE_NOFOLDER_MSG);
    const role = msg && msg.role === 'read' ? 'read' : 'edit';
    const l = await chrome.storage.local.get('rndUser');
    const cache = await getCache();
    const myNames = shareMyNames(cache, settings, String((l.rndUser || {}).userNm || settings.myName || ''));
    const names = Array.isArray(msg.names) && msg.names.length
      ? Array.from(new Set(msg.names.map((s) => String(s || '').trim()).filter(Boolean)))
      : await shareParticipantNames(prjNo, myNames);
    const folder = String(index[prjNo].folder || '');
    if (!names.length) {
      const share = Object.assign(shareResultOf(null, role), { note: '참여인력에 나 말고는 없음' });
      await sharePatchPage(prjNo, { share });
      return { ok: true, prjNo, folder, share, message: '공유할 사람이 없습니다 — 참여인력에 나 말고는 없음' };
    }
    const pg = {};
    await sharePeopleJobs([{ prjNo, cfg, names, pg }], role);
    const share = pg.share || shareResultOf(null, role);
    await sharePatchPage(prjNo, { share, folder });
    return { ok: !share.error, prjNo, folder, share, message: shareResultText(share), error: share.error, kind: share.kind };
  } catch (e) { const d = describeShare(e); return shareFail(d.kind, d.message); }
}
/* 사업비 관리 [링크 복사] · 설정 [조직 내 링크 만들기·복사]: 조직 내 편집 링크(linkKind OrganizationEdit)를 만들어 클립보드에 — msg = { prjNo?(없으면 base), edit?(false 면 읽기) } → { ok, url, copied, prjNo, folder:{ path, viewUrl } } | { ok:false, kind, message, error } */
async function shareOrgLink(msg) {
  const p = (await KRX_SETTINGS.load()).plus || {};
  try {
    const prjNo = String((msg && msg.prjNo) || '').trim();
    const cfg = prjNo ? await shareProjectCfg(prjNo, p) : await shareCfg(p, false);
    if (!cfg) return shareFail('nofolder', SHARE_NOFOLDER_MSG);
    const w = await shareStore.openWriter(cfg);
    let r;
    try { r = await w.orgLink(cfg.folderPath, { edit: !(msg && msg.edit === false) }); } finally { try { await w.close(); } catch (e) {} }
    const url = String((r && r.url) || '');
    if (!url) throw Object.assign(new Error(`공유 링크를 받지 못했습니다${r && r.error ? ` — ${r.error}` : ''}`), { kind: 'http' });
    const copied = await clipboardWrite(url);
    return { ok: true, url, copied, prjNo, folder: { path: cfg.folderPath, viewUrl: cfg.viewUrl || '' } };
  } catch (e) { const d = describeShare(e); return shareFail(d.kind, d.message); }
}
/* 과제 폴더 이름 바꾸기(선택) — msg = { prjNo, name } → { ok, prjNo, name, unchanged? }. 이름은 KRX_PRJDOC.folderNameFor 규칙(파일 이름에 못 쓰는 글자 제거 · 60자)으로 다듬고, shareIndex 의 folder·path·url 을 rename 결과로 고친다
 *   (path·url 을 옛 경로로 두면 다음 동기화가 그 색인을 믿고 옛 경로를 nofolder 로 보아 — 동료 폴더면 색인을 버리고 다시 훑고, 내 base 면 매번 다시 훑는다; 2026-10-18 검토) */
async function shareRename(msg) {
  const p = (await KRX_SETTINGS.load()).plus || {};
  const prjNo = String((msg && msg.prjNo) || '').trim(), name = String((msg && msg.name) || '').trim();
  if (!prjNo || !name) return shareFail('error', '과제번호와 새 폴더 이름이 필요합니다');
  try {
    const index = shareObj((await chrome.storage.local.get(SHARE_INDEX_KEY))[SHARE_INDEX_KEY]);
    const cfg = await shareProjectCfg(prjNo, p, index);
    if (!cfg) return shareFail('nofolder', SHARE_NOFOLDER_MSG);
    const clean = typeof KRX_PRJDOC.folderNameFor === 'function' ? String(KRX_PRJDOC.folderNameFor({ alias: name, prjNo }) || '') : name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim().slice(0, 60);
    if (!clean) return shareFail('badurl', '폴더 이름에 쓸 수 있는 글자가 없습니다');
    if (clean === String(index[prjNo].folder || '')) return { ok: true, prjNo, name: clean, unchanged: true };
    const w = await shareStore.openWriter(cfg);
    let r;
    try { r = await w.rename(cfg.folderPath, clean); } finally { try { await w.close(); } catch (e) {} }
    const newPath = String((r && r.path) || `${String(cfg.folderPath).replace(/\/[^/]*$/, '')}/${clean}`);
    const newCfg = (() => { try { return KRX_SP.parseFolder(String((r && r.url) || `${cfg.origin}${newPath.split('/').map(encodeURIComponent).join('/')}`)); } catch (e) { return null; } })();
    index[prjNo] = Object.assign({}, index[prjNo], { folder: clean, path: newPath, url: String((r && r.url) || (newCfg ? shareFolderUrl(newCfg) : '')), at: Date.now() });
    await chrome.storage.local.set({ [SHARE_INDEX_KEY]: index });
    await sharePatchPage(prjNo, { folder: clean, folderUrl: newCfg ? (newCfg.viewUrl || shareFolderUrl(newCfg)) : '', planUrl: '', webUrl: '' });
    return { ok: true, prjNo, name: clean, path: newPath };
  } catch (e) { const d = describeShare(e); return shareFail(d.kind, d.message); }
}

/* 확장 페이지(사이드 패널·팝업·설정)에서 온 메시지인가 — eClass 패널(콘텐츠 스크립트)은 eClass 페이지 DOM 안이라 비밀번호를 받지 않는다 */
const fromExtPage = (sender) => !!sender && sender.id === chrome.runtime.id && String(sender.url || '').startsWith(chrome.runtime.getURL(''));
KRX_PREP_FETCH.resume().catch(() => {});   // 워커가 다시 떴을 때 진행 중이던 찾아오기를 이어서 지켜봄
try { KRX_SP.sweepWorkers({ chrome }).catch(() => {}); } catch (e) {}   // 지난 워커가 공유 (Plus) 쓰기 도중 끝나 남긴 SharePoint 작업 창(최소화된 XML 페이지)을 거둔다 — writer 가 살아 있을 수 없는 자리(워커 시작)라 안전

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg && msg.type) {
      case 'getData': return await refresh(!!msg.force, { full: !!msg.full });   // full: 참여인력 캐시도 건너뜀 (↻)
      case 'planSync': return await shareSync(String(msg.reason || 'manual'), { prjNo: msg.prjNo ? String(msg.prjNo) : '' });   // 공유 (Plus): 과제별 공유 파일과 맞춤 (구름/저장 아이콘 manual+prjNo · 패널 열 때 load · 설정/팝업 지금 동기화 manual). 이름은 옛 planSync 그대로 — 패널·설정이 보냄
      case 'planSyncQueue': queueShareSync(String(msg.reason || 'edit')); return { ok: true };   // 항목 편집 뒤 4초 모아서
      case 'shareProbe': return await shareProbe(msg);                                      // 설정 페이지 "연결 확인" — base 풀기(msg.folder 가 있으면 저장 전 칸 값) + 과제 폴더 목록 + 나와 공유 → { ok, folder, folders, count, shared, mine } / 로그인 필요(auth)
      case 'shareFolderCopy': case 'planExport': return await shareFolderCopy(msg);        // 패널 ⬆ · 사업비 관리 · 설정 [주소 복사]: base(또는 prjNo 의 과제 폴더 · file 이면 예상비용.json) 주소를 클립보드에 (planExport 는 옛 이름)
      case 'shareFolderPeople': return await shareFolderPeople(msg);                       // 사업비 관리·설정 [참여연구원에게 공유]: 과제 폴더를 사람들(names 또는 참여인력 전부)에게 편집 공유 → { ok, share:{ shared, ambiguous, notFound } }
      case 'shareOrgLink': return await shareOrgLink(msg);                                 // 사업비 관리·설정 [링크 복사]: 조직 내 편집 링크를 만들어 클립보드에 → { ok, url, copied }
      case 'shareRename': return await shareRename(msg);                                   // 과제 폴더 이름 바꾸기(선택) → { ok, name }
      case 'jctCaptured': refreshAfterWrite(msg.entry); await appendCapture(msg.entry, sender); return { ok: true };
      case 'unapprovedSnapshot': await chrome.storage.local.set({ unapprovedSnapshot: msg.snapshot }); return { ok: true };
      case 'hrPay': { const merged = await mergeHrPay(msg.patch || {}); await patchCacheHrPay(merged); return { ok: true }; }
      case 'rndSsoLogin': return await rndAutoLogin();   // 설정 페이지 "지금 시도": R&D ERP eClass SSO 자동 로그인만 (조회는 따로 getData force)
      case 'hrCollectNow': return await collectHr(true, !!msg.all);   // 패널 급여·연구수당 보기/↻, 설정 페이지 지금 수집 (백그라운드 직접, 안 되면 HR 탭)
      case 'clearHrPay': await chrome.storage.local.remove('hrPay'); await patchCacheHrPay(null); return { ok: true };
      case 'rndUser': {
        const u = msg.user || {};
        if (!u.userId && !u.empNo && !u.userNm) return { ok: false };
        const prev = (await chrome.storage.local.get('rndUser')).rndUser || {};
        const userId = u.userId || prev.userId || '';
        let empNo = u.empNo || prev.empNo || '';
        if (empNo && userId && empNo !== userId) empNo = '';   // 이 ERP 의 사번은 USER_ID 와 같다. 다른 값은 이전 버전 bridge 가 화면의 대상자 EMP_NO 를 잘못 읽은 것이라 버린다
        const next = { userId, empNo, userNm: u.userNm || prev.userNm || '', deptCd: u.deptCd || prev.deptCd || '', ts: Date.now() };   // deptCd: 대시보드 인라인 스크립트의 부서코드 (결재대기 수 조회 DEPT_CD)
        if (next.userId !== prev.userId || next.empNo !== prev.empNo || next.userNm !== prev.userNm) {
          await chrome.storage.local.set({ rndUser: next, membership: {} });   // 사용자가 바뀌면 참여 판정 캐시 초기화
        } else {
          await chrome.storage.local.set({ rndUser: next });
        }
        return { ok: true };
      }
      case 'openOptions':   // hash: 설정 페이지의 그 자리로 (예: fetch-new=가맹점 — 증빙 찾아오기 자주 사용 등록, fetch=<id> — 그 사이트 고치기)
        if (msg.hash) await chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') + '#' + String(msg.hash).replace(/^#/, '') }); else await chrome.runtime.openOptionsPage();
        return { ok: true };
      case 'openRcms': return await KRX_RCMS.open(sender);          // 패널·팝업 하단 "RCMS 열기": 탭을 열고 자동 로그인을 걸어 둠 (lib/rcms.js)
      case 'rcmsLogin': return await KRX_RCMS.login(msg, sender);   // RCMS 화면(content/rcms.js): 로그인 폼에 넣을 값, 버튼을 누를지
      case 'clearCapture': await chrome.storage.local.set({ [CAPTURE_KEY]: [] }); return { ok: true };
      case 'invalidate': await chrome.storage.local.remove(CACHE_KEY); return { ok: true };
      // 청구 준비 (lib/prep.js 패널 ↔ lib/prep-store.js ↔ content/rnd-claim.js 청구서)
      case 'prepSetType': { const entry = await KRX_PREP_STORE.setType(String(msg.key || ''), msg.meta || {}, msg.value); KRX_PREP_AI.remember(entry); return { ok: true, entry }; }   // 사용자가 고른 청구종류는 Claude 자동 분류의 예로도 남김
      case 'prepSetPtcl': return { ok: true, entry: await KRX_PREP_STORE.setPtcl(String(msg.key || ''), msg.meta || {}, msg.value) };   // 청구내역(적요) 글
      case 'prepSetAttendees': return { ok: true, entry: await KRX_PREP_STORE.setAttendees(String(msg.key || ''), msg.meta || {}, msg.attendees || {}) };   // 회의록 참석자 카드 (식사비)
      case 'prepSetMinutes': return { ok: true, entry: await KRX_PREP_STORE.setMinutes(String(msg.key || ''), msg.meta || {}, msg.minutes || {}) };   // 회의록 카드의 회의 내용
      case 'prepMeetingInfo': return await meetingInfo(String(msg.prjNo || '').trim(), String(msg.date || ''), !!msg.force);   // 회의록 카드: 과제 참여인력 목록 + 회의록 규칙 + 회의사전신청 목록 + 휴일 여부 (1시간 캐시)
      case 'prepPersonSearch': try { return { ok: true, list: await KRX_API.searchPerson(msg.name) }; } catch (e) { const d = KRX_API.describe(e); return { ok: false, error: d.kind === 'login' ? 'R&D ERP 로그인이 필요합니다' : d.message }; }   // 내부참석자 검색
      case 'prepAddFiles': return { ok: true, entry: await KRX_PREP_STORE.addFiles(String(msg.key || ''), msg.meta || {}, msg.files || []) };
      case 'prepAuto': return await KRX_PREP_AI.run(String(msg.key || ''), msg.meta || {});   // Claude 자동 분류 (Help 서버 연결 시): 청구종류 · 첨부 파일 종류 (lib/prep-ai.js)
      case 'llmProbe': return await KRX_LLM.probe(msg.url, !!msg.force);   // LLM(Help 서버) 연결 확인 — 설정 페이지 LLM 설정 탭(연결 확인 · 주기 확인). 결과는 storage.local.llmStatus 에도 (lib/llm.js)
      case 'prepSetFileKind': return { ok: true, entry: await KRX_PREP_STORE.setFileKind(String(msg.key || ''), String(msg.id || ''), String(msg.kind || '')) };   // 첨부 파일 종류 → 이름 바꾸기
      case 'prepRemoveFile': return { ok: true, entry: await KRX_PREP_STORE.removeFile(String(msg.key || ''), String(msg.id || '')) };
      case 'prepClear': await KRX_PREP_STORE.clear(String(msg.key || '')); await KRX_PREP_FETCH.clear(String(msg.key || '')); return { ok: true };
      case 'prepClearAll': await KRX_PREP_STORE.clearAll(); return { ok: true };
      case 'prepGet': return await KRX_PREP_STORE.getEntry(msg.appr, msg.card4, !!msg.withFiles);
      case 'prepAttached': return { ok: true, entry: await KRX_PREP_STORE.markAttached(String(msg.key || ''), msg.n) };
      case 'prepStats': return await KRX_PREP_STORE.stats();
      case 'prepRun': return await prepRun(String(msg.key || ''), String(msg.mode || 'add'));   // 패널 "청구서 작성"(add) · "작성+신청"(add,apply) · "신청"(apply) · "임시저장 삭제"(delete) → 백그라운드 탭
      case 'prepRunResult': return await prepRunResult(msg, sender);           // ERP 청구서(rnd-claim.js)의 결과 보고
      case 'prepFocusTab': return await prepFocusTab(String(msg.key || ''));   // 패널 "탭 보기"
      // 증빙 찾아오기 (lib/prep-fetch.js → Help 서버 /fetch → site-fetch/): 자주 사용 가맹점 사이트에서 거래명세서 등을 받아 첨부 파일로
      case 'prepFetch': return await KRX_PREP_FETCH.start(String(msg.key || ''), msg.meta || {});
      case 'prepFetchCancel': return await KRX_PREP_FETCH.cancel(String(msg.key || ''));
      case 'fetchSiteSave': try { return { ok: true, site: await KRX_PREP_FETCH.saveSite(msg.site || {}, msg.cred || null, fromExtPage(sender)) }; } catch (e) { return { ok: false, error: String(e.message || e) }; }   // 비밀번호는 확장 페이지에서 온 것만
      case 'fetchSiteRemove': return { ok: await KRX_PREP_FETCH.removeSite(String(msg.id || '')) };
      case 'callService': return await KRX_API.call(msg.service, msg.input || {});
      case 'diagnose': {   // 진단은 그 과제의 참여인력 캐시를 지금 값으로 바꾸므로, 끝나면 패널도 다시 조회해 반영 (캐시 TTL 무시, 다른 과제의 참여인력은 캐시)
        const r = await KRX_API.diagnose(String(msg.prjNo || '').trim(), await KRX_SETTINGS.load());
        if (r && r.member) refresh(true).catch(() => {});
        return r;
      }
      default: return { error: 'unknown message' };
    }
  })().then(sendResponse, (e) => sendResponse({ error: String((e && e.message) || e), kind: e && e.kind }));
  return true;
});
