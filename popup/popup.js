/* 툴바 팝업 · 사이드 패널(같은 문서 — 어디에 떴는지는 popup/mode.js 가 구분): 패널 렌더러 재사용 */
(async () => {
  const host = document.getElementById('krext-panel');
  const state = { mode: 'popup', loading: true, data: null, fatal: null, collapsed: false, expanded: new Set(), prepRows: new Set() /* 청구 준비 줄을 연 거래(준비 키) — 거래 행 클릭으로 토글 (lib/prep.js prep-row) */, rndUrl: null, view: 'project', section: 'cards', version: '',
    plans: {}, planEdit: null, planDraft: null, planError: '' };   // 예상 비용 (lib/plan.js)
  try { state.version = chrome.runtime.getManifest().version; } catch (e) {}
  // 사이드 패널·탭에 떴으면(popup/mode.js → KRX_SIDE) 창이 닫히지 않으므로 청구 준비 줄에 파일을 끌어다 놓을 수 있고(render.js prepCtx.files), 팝업 창(설정 actionPopup)이면 제목 줄에 "사이드 패널로 열기" 버튼(chrome.sidePanel.open, Chrome 116+)
  state.sidePanel = !!window.KRX_SIDE;
  state.tab = !!window.KRX_TAB;   // 브라우저 탭(주소 #tab — 사업비 관리 [참여인력 변경] 단추가 연 것, mode.js): 아래 applyHash 가 주소의 과제·연차·only 를 적용
  state.sideOpen = !state.sidePanel && !!(chrome.sidePanel && chrome.sidePanel.open);
  try { const l = await chrome.storage.local.get(['cache', 'panelView', 'panelSection']); state.data = l.cache || null; state.view = l.panelView === 'card' ? 'card' : 'project'; state.section = KRX_RENDER.secOf(l.panelSection); } catch (e) {}   // 카드미청구 · 과제집행비율 · 연구내용
  try { state.plans = await KRX_PLAN.load(); } catch (e) {}
  try { state.payPlans = await KRX_PAY.load(); } catch (e) {}   // 받기 예정 연구수당 (lib/pay.js)
  try { state.partPlans = await KRX_PART.load(); } catch (e) {}   // 예비 참여율(참여 계획) (lib/part.js)
  try { state.prep = await KRX_PREP.load(); } catch (e) {}        // 청구 준비: 거래별 청구종류·첨부 파일 (lib/prep.js)
  try { state.research = await KRX_RESEARCH.load(); } catch (e) {}   // 연구개발계획서(연구내용) 참조 — 패널의 연구내용 탭 (lib/research.js, render.js researchSection)
  try { state.staffPlans = await KRX_STAFF.load(); } catch (e) {}
  if (self.KRX_ALLOW) { try { state.allowCalc = await KRX_ALLOW.load(); } catch (e) {} }   // 연구수당 계산 탭의 기준·계수·한도·직접 지급액 (lib/allowance.js)   // 사업비 관리 화면(제목 줄 아이콘): 과제마다 연차별 예산·참여연구원 계획 (lib/staff.js, lib/staff-ui.js — 0.8.7)
  const draw = () => KRX_RENDER.render(host, state);
  KRX_PLAN.bind(host, state, draw);   // 과제집행비율 표의 예상 비용 입력(＋/수정/삭제) 처리
  KRX_PAY.bind(host, state, draw);    // 급여·연구수당 구역의 받기 예정 연구수당 입력(＋/수정/삭제) 처리
  KRX_PART.bind(host, state, draw);   // 과제 참여율 표의 참여 계획 입력(＋/수정/삭제, 기간 달력) 처리
  KRX_RESEARCH.bind(host, state, draw);   // 연구내용 줄: 설정 페이지에서 계획서를 넣고 빼면 다시 그림, 복사 버튼
  const allowApi = self.KRX_ALLOW ? KRX_ALLOW.bind(host, state, draw) : null;   // 연구수당 계산 탭의 기준 칸·계수·한도·지급액 입력, 복사·초기화 — agent 는 연구수당 도우미 채팅(2026-10-21)이 씀
  const staffApi = KRX_STAFF_UI.bind(host, state, draw);   // 제목 줄 사업비 관리 화면(state.page): 과제 칩·연차 칩·기간, 예산 줄, 사람 표의 칸·✎ 폼·더하기·빼기, 초기화, rERP 조회(백그라운드 callService), 복사
  if (state.tab && self.KRX_STAFF_CHAT) KRX_STAFF_CHAT.init({ api: staffApi, allow: allowApi, state, draw });   // 참여연구원 변경 탭의 변경 도우미 · 연구수당 계산 탭의 연구수당 도우미 채팅(popup/staff-chat.js, 0.8.8 · 2026-10-21) — 제목 줄 [에이전트] 단추(st-agent)로 열고 닫음, LLM(Help 서버)이 연결돼 있을 때만 입력
  const prepApi = KRX_PREP.bind(host, state, draw);   // 카드미청구 거래 행 밑 둘째 줄의 청구 준비(청구종류 select, 청구내역 입력란, 파일 지우기, 청구서 작성) 처리 — 팝업 창에는 파일을 끌어다 놓을 수 없고(창이 닫힘) 사이드 패널에서는 됨

  /* 브라우저 탭으로 열렸을 때(mode.js KRX_TAB — 주소 #tab&page=staff&only=staff&prj=과제번호&year=연차, lib/staff-ui.js openTab → background.js openExtTab):
   * 사업비 관리 화면을 그 과제·연차로 열고(staffApi.focus), only=staff 면 참여인력 부분만(state.staffOnly → render.js · lib/staff-ui.js section only, html.krext-only 가 Help Chat 줄·툴바를 숨김).
   * 이미 열린 탭의 주소만 바뀌어도(hashchange, 다시 읽지 않음) 같이 적용한다 */
  const applyHash = () => {
    if (!state.tab) return;
    const q = new URLSearchParams(location.hash.replace(/^#/, ''));
    const only = ['staff', 'allow'].includes(q.get('only')) ? q.get('only') : '';   // staff: 참여연구원 변경 · allow: 연구수당 계산(lib/allowance.js, 2026-10-21)
    state.staffOnly = only;
    document.documentElement.classList.toggle('krext-only', only);
    if (only) document.title = `${only === 'allow' ? '연구수당 계산' : '참여연구원 변경'} — R&D ERP 현황`;
    if (self.KRX_STAFF_CHAT) KRX_STAFF_CHAT.show(only);   // 도우미 채팅 — staff(변경 도우미) · allow(연구수당 도우미) 모드, 그 밖에는 없음
    if (q.get('page') === 'staff' && staffApi && staffApi.focus) staffApi.focus({ prjNo: q.get('prj') || '', year: Number(q.get('year')) || 0 });
    else if (only) draw();
  };
  applyHash();
  window.addEventListener('hashchange', applyHash);

  host.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'refresh') { ev.preventDefault(); load(true); }
    else if (act === 'settings') { ev.preventDefault(); chrome.runtime.openOptionsPage(); }
    else if (act === 'llm-setup') { ev.preventDefault(); chrome.runtime.sendMessage({ type: 'openOptions', hash: btn.dataset.hash || 'llm' }).catch(() => {}); }   // 제목 줄 B(브릿지) 아이콘 → 설정 › LLM 연결 카드(Win+R → setup.cmd 안내)
    else if (act === 'prj') { ev.preventDefault(); const k = btn.dataset.prj; if (state.expanded.has(k)) state.expanded.delete(k); else state.expanded.add(k); draw(); }
    else if (act === 'view') { ev.preventDefault(); state.view = btn.dataset.view === 'card' ? 'card' : 'project'; chrome.storage.local.set({ panelView: state.view }); draw(); }
    else if (act === 'section') { ev.preventDefault(); state.section = KRX_RENDER.secOf(btn.dataset.section); chrome.storage.local.set({ panelSection: state.section }); draw(); }
    else if (act === 'claim') { if (ev.target.closest('a')) return; ev.preventDefault(); if (btn.dataset.href) chrome.tabs.create({ url: btn.dataset.href }); }
    else if (act === 'rcms') { ev.preventDefault(); openRcms(btn.href); }
    else if (act === 'sidepanel') { ev.preventDefault(); openSidePanel(); }
    else if (act === 'sc-ratio') { ev.preventDefault(); if (self.KRX_STAFF_CHAT) KRX_STAFF_CHAT.size(btn.dataset.ratio === KRX_STAFF_CHAT.size() ? '' : btn.dataset.ratio); }   // 제목 줄 2:1 · 1:1 · 1:2 — 본문:도우미 폭 비율(같은 것을 다시 누르면 기본 폭; lib/render.js, popup/staff-chat.js size)
    else if (act === 'st-agent') { ev.preventDefault(); if (self.KRX_STAFF_CHAT) KRX_STAFF_CHAT.toggle(); }   // 참여연구원 변경 탭 제목 줄 [에이전트] — 변경 도우미 채팅 열기/닫기 (lib/staff-ui.js focusTitle)
  });
  // 제목 줄 "사이드 패널로 열기"(팝업 창에만): 같은 문서를 이 창의 사이드 패널로 열고 팝업은 닫는다. 사용자 클릭 안에서 불러야 하므로 여기서 바로 연다. 아이콘 클릭이 팝업을 열지 사이드 패널을 열지는 설정 actionPopup (background.js applySidePanel, 기본 사이드 패널)
  if (self.KRX_PREP_CHAT) KRX_PREP_CHAT.bind(host, state, draw);   // 청구 준비 줄 💬: 그 거래 밑에 찾는 방법 익히기 채팅 (popup/prep-chat.js — Help 서버 /ask, 설정 페이지와 같은 storage.local.fetchChat)
  if (state.sidePanel) KRX_CAP.bind(host, state, draw, prepApi);   // 청구 준비 줄의 화면 캡처(화면 전체·영역 선택): 왼쪽 탭을 찍어 첨부 파일로 (popup/capture.js, 사이드 패널만)
  async function openSidePanel() {
    try {
      const w = await chrome.windows.getCurrent();
      await chrome.sidePanel.open({ windowId: w.id });
      window.close();
    } catch (e) { state.fatal = `사이드 패널을 열지 못했습니다: ${String((e && e.message) || e)}`; draw(); }
  }
  document.getElementById('btnOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());
  // RCMS 열기(패널 아래 바 · 툴바): 백그라운드가 탭을 열고 그 탭에 자동 로그인을 건다 (background.js openRcms). 안 되면 링크 주소를 그대로 연다
  function openRcms(href) {
    const open = () => chrome.tabs.create({ url: href });
    chrome.runtime.sendMessage({ type: 'openRcms' }).then((r) => { if (!r || !r.ok) open(); }, open);
  }
  document.getElementById('rcmsLink').addEventListener('click', (ev) => { ev.preventDefault(); openRcms(ev.currentTarget.href); });

  /* ---------- 공유 (Plus) 켜기/끄기 (설정 KRX_SETTINGS plus.enabled — 설정 페이지 › 공유 (Plus) 탭의 같은 항목과 같은 값) ----------
   * 2026-10-18 사용자 지정("아니 mcp 없이 grph api 하지 않고 브라우저 토큰으로 하라고" → 저녁 "onedrive 에 업무/shared 안에 과제별로 .. 약칭으로 없으면 jobid 없으면 임시번호 … 년차별로 1개 파일이고 1개 파일에서 변경사항이랑 다 관리" · "참여연구원들에게 공유할 수 있게 설정까지"):
   * 과제마다 SharePoint(OneDrive) 폴더 하나(밑폴더 plus.folder, 비면 내 OneDrive 의 문서/업무/shared 아래 <약칭 → Job Id → 과제번호>/)에 연차별 <n>차년도.json 과 예상비용.json 을 두는 방식 — 켜면 백그라운드가 바로 맞춘다(background.js shareSync, 메시지 'planSync' manual).
   * 상태 줄은 storage.local.shareState 의 마지막 결과를 "공유: 과제 n개 · HH:MM" 한 줄로(씀/받음·공유받은 폴더 수는 title), 오류면 그 까닭, 로그인이 필요하면(kind 'auth') OneDrive 를 여는 링크. 밑폴더 주소·연결 확인·참여연구원 공유·과제별 표는 설정 페이지 */
  const plusOn = document.getElementById('plusOn'), plusStatus = document.getElementById('plusStatus');
  const SHARE_KIND = { auth: '로그인 필요 — 이 브라우저에서 SharePoint(OneDrive)에 로그인하세요', offline: '네트워크에 연결할 수 없음', badurl: '폴더 주소를 읽을 수 없음 — 설정 › 공유 (Plus)', nofolder: '폴더 없음 — 설정 › 공유 (Plus) 의 연결 확인', locked: '다른 사람이 파일을 편집 중 — 다음에 다시', parse: '읽을 수 없는 파일 — 건너뜀', http: 'SharePoint 오류', tab: 'SharePoint 작업 탭을 열지 못함' };
  const shareErr = (s) => (s && (s.error || s.message)) || (s && SHARE_KIND[s.kind]) || (s && s.kind) || '';
  const setPlusStatus = (t, err, link, title) => {   // link: 로그인 필요 때 "OneDrive 열기" · title: 마우스를 올리면 보이는 자세한 수
    plusStatus.textContent = t || ''; plusStatus.classList.toggle('err', !!err); plusStatus.title = title || t || '';
    if (link) { const a = document.createElement('a'); a.href = link; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'OneDrive 열기'; plusStatus.append(' · ', a); }
  };
  let plusSettings = null;
  const driveHost = () => String((KRX_SETTINGS.DEFAULTS.plus && KRX_SETTINGS.DEFAULTS.plus.driveHost) || 'https://krclass-my.sharepoint.com');
  const hhmm = (ts) => { const d = new Date(ts); return `${KRX_FMT.pad2(d.getHours())}:${KRX_FMT.pad2(d.getMinutes())}`; };
  /* shareState (v2) { at, ok, base|folder:{ path, viewUrl }, count(과제), files, written, pulled, errors, error?, kind?, pages:{ [prjNo]: { …, owner?, noFolder? } } } → "공유: 과제 n개 · HH:MM" / "공유 실패 HH:MM: 까닭" */
  function renderShareState(s) {
    if (!plusOn.checked) { setPlusStatus(''); return; }
    if (!s || !s.at) { setPlusStatus('공유: 아직 동기화 전 — 패널을 열면 시작됩니다'); return; }
    const pages = Object.values((s.pages && typeof s.pages === 'object') ? s.pages : {}).filter((p) => p && typeof p === 'object');
    const n = KRX_FMT.num(s.count) || pages.length;
    const base = s.base || s.folder || null;
    if (s.ok) {
      const owners = pages.filter((p) => p.owner).length, noFolder = pages.filter((p) => p.noFolder).length;
      const detail = `동기화 ${KRX_FMT.fmtClock(s.at)} · 과제 ${n}개${s.files != null && (Array.isArray(s.files) || Number.isFinite(Number(s.files))) ? ` · 파일 ${Array.isArray(s.files) ? s.files.length : KRX_FMT.num(s.files)}개` : ''} · 씀 ${KRX_FMT.num(s.written)} · 받음 ${KRX_FMT.num(s.pulled)}${owners ? ` · 공유받은 폴더 ${owners}개` : ''}${noFolder ? ` · 폴더 없음 ${noFolder}건` : ''}${s.errors ? ` · 오류 ${s.errors}건` : ''}${base && base.path ? ` · ${base.path}` : ''} — 자세히는 설정 › 공유 (Plus)`;
      setPlusStatus(`공유: 과제 ${n}개 · ${hhmm(s.at)}${s.errors ? ` · 오류 ${s.errors}건 (설정 › 공유 (Plus))` : ''}`, !!s.errors, '', detail);
    } else setPlusStatus(`공유 실패 ${hhmm(s.at)}: ${shareErr(s)}`, true, s.kind === 'auth' ? ((base && base.viewUrl) || driveHost()) : '', `동기화 실패 (${KRX_FMT.fmtClock(s.at)}): ${shareErr(s)}${s.errors > 1 ? ` 외 ${s.errors - 1}건` : ''} — 설정 › 공유 (Plus) 에서 자세히`);
  }
  async function loadPlus() {
    try { plusSettings = await KRX_SETTINGS.load(); } catch (e) { return; }
    plusOn.checked = !!(plusSettings.plus && plusSettings.plus.enabled);
    if (!plusOn.checked) { setPlusStatus(''); return; }
    let s = null; try { s = (await chrome.storage.local.get('shareState')).shareState || null; } catch (e) {}
    renderShareState(s);
  }
  async function savePlus(patch) {
    const s = plusSettings || await KRX_SETTINGS.load();
    s.plus = Object.assign({}, KRX_SETTINGS.DEFAULTS.plus, s.plus || {}, patch);
    plusSettings = s;
    await KRX_SETTINGS.save(s);
  }
  plusOn.addEventListener('change', async () => {
    await savePlus({ enabled: plusOn.checked });
    if (!plusOn.checked) { setPlusStatus(''); return; }
    setPlusStatus('공유 폴더의 과제 파일과 맞추는 중…');
    let s = null;
    try { s = await chrome.runtime.sendMessage({ type: 'planSync', reason: 'manual' }); } catch (e) { s = null; }
    if (!s) { setPlusStatus('응답 없음 — 확장을 다시 올린 뒤 다시 켜 보세요', true); return; }
    if (s.skipped) { loadPlus(); return; }   // 백그라운드가 건너뜀(설정이 아직 안 읽힘 등) — 저장된 상태로
    renderShareState(s.at ? s : Object.assign({ at: Date.now() }, s));
  });
  try { chrome.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch.shareState && plusOn.checked) renderShareState(ch.shareState.newValue || null); }); } catch (e) {}   // 백그라운드의 자동 동기화 결과도 반영
  loadPlus();

  async function load(force) {
    state.loading = true; state.fatal = null; draw();
    try {
      const res = await chrome.runtime.sendMessage({ type: 'getData', force: !!force, full: !!force });   // ↻: 참여인력(계상률) 캐시(2시간)도 건너뛰고 다시 조회
      if (res && !res.error) state.data = res; else state.fatal = (res && res.error) || '응답 없음';
    } catch (e) { state.fatal = String((e && e.message) || e); }
    state.loading = false; draw();
    if (state.data && state.data.settings && state.data.settings.rndUrl) document.getElementById('rndLink').href = state.data.settings.rndUrl;
    const hr = state.data && state.data.settings && state.data.settings.hr;
    if (hr && hr.url) document.getElementById('hrLink').href = hr.url;
    const rcms = state.data && state.data.settings && state.data.settings.rcms;
    if (rcms && rcms.url) document.getElementById('rcmsLink').href = rcms.url;
  }
  // 백그라운드가 캐시를 바꾸면(급여·연구수당 보기 클릭 → HR 수집 결과 등) 바로 반영 (content/eclass.js 와 같은 방식)
  try {
    chrome.storage.onChanged.addListener((ch, area) => {
      try { if (area === 'local' && ch.cache && ch.cache.newValue) { state.data = ch.cache.newValue; if (!state.loading) draw(); } } catch (e) {}
    });
  } catch (e) {}
  draw();
  load(false);
})();
