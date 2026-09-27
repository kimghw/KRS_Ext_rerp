/* rnd.krs.co.kr (isolated world, 모든 프레임): 과제책임자/과제명 칸의 "내 참여 과제" 드롭다운
 * 과제정보·과제예산신청·참여인력신청·회의사전신청·청구서 등 "과제책임자/과제명"(또는 "과제번호") 검색 칸(글 입력란 + 돋보기 버튼 .btn_s_search)이 있는 화면에서
 * 입력란 앞에 <select> 를 넣고, eClass 패널이 저장한 내 참여 과제 목록(storage.local.projectList — "내 참여 과제만 보기"로 참여인력에 본인이 있는 진행 과제)을 보여 준다.
 * 고르면 입력란에 과제명을 적고 돋보기 버튼을 눌러, MAIN world 훅(content/rnd-hook.js prjPick)이 과제 검색 팝업 대신 팝업의 조회 서비스(rcomm_0009_03_r003)로 그 과제 행을 받아
 * 화면 콜백(params.RTN_FUNC, 기본 uf_rcomm_0009_01Params)에 넘긴다 — 팝업에서 행을 고르고 확인한 것과 같은 결과가 바로 적용된다. 돋보기·Enter 로 여는 기존 팝업 조회는 그대로.
 * 화면이 다른 경로로 과제를 정하면(메인화면 과제현황에서 과제명 클릭 → 과제정보 PRJ_NO 딥링크, 패널 딥링크, 팝업 선택) hidden/readonly #PRJ_NO 를 1초마다 보고
 * 드롭다운을 그 과제로 맞추고 입력란에 과제명을 적어 둔다 (목록에 없는 과제는 "현재: …" 항목으로).
 * 화면 요소 ID 는 쓰지 않고 라벨 문구(th 에 "과제명"/"과제번호")와 돋보기 버튼 class 로 칸을 찾는다. 설정 prjPicker(기본 켜짐)로 끈다. */
(() => {
  if (window.__krextPrjPick) return;
  window.__krextPrjPick = true;

  /* 확장 재로드 후 다시 주입되면 이전 스크립트를 멈추고 넣은 요소를 걷어내게 한다 (DOM 이벤트는 world 를 넘어 전달됨) */
  const RESTART_EVT = 'krext-prjpick-restart';
  document.dispatchEvent(new Event(RESTART_EVT));
  let stopped = false;
  document.addEventListener(RESTART_EVT, () => { stopped = true; teardown(); });

  const S = self.KRX_SETTINGS;
  const SEL_CLASS = 'krext-prj-sel';
  const norm = (s) => String(s || '').replace(/[\s*＊:：/／()（）\[\]【】]/g, '');
  const log = (...a) => { try { console.debug('[krext prjpick]', ...a); } catch (e) {} };

  /* ---------- 상태 ---------- */
  let enabled = true;
  let projects = [];          // storage.local.projectList.projects: [{ prjNo, prjNm, rspr, anl, status, stDt, endDt }]
  let listTs = 0;
  let listRequested = false;
  const rows = [];            // { btn, input, sel, prjNoEl, lastPrjNo, extra, origWidth }
  let scanTimer = null, pollTimer = null, observer = null, observeUntil = 0;
  let seq = 0;
  const waiters = new Map();  // 선택 적용 요청 id → 결과 콜백

  /* ---------- 스타일 / 토스트 ---------- */
  const CSS = `
.krext-prj-sel{box-sizing:border-box;margin-right:4px;padding:0 2px;font:12px "Malgun Gothic","맑은 고딕",sans-serif;border:1px solid #9db3d6;border-radius:2px;background:#f3f7fd;color:#1f4e9c;cursor:pointer}
.krext-prj-sel:hover{background:#e2ecfa}
.krext-prj-sel.krext-busy{opacity:.55;cursor:progress}
.krext-prj-toast{position:fixed;right:16px;bottom:16px;z-index:2147483647;background:#222;color:#fff;padding:8px 12px;border-radius:6px;font:13px/1.4 "Malgun Gothic","맑은 고딕",sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.3);opacity:.95;max-width:60vw;white-space:pre-wrap}
`;
  function ensureStyle() {
    if (document.getElementById('krext-prjpick-style')) return;
    const st = document.createElement('style');
    st.id = 'krext-prjpick-style';
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }
  let toastTimer = null;
  function toast(msg, ms) {
    try {
      ensureStyle();
      let el = document.getElementById('krext-prjpick-toast');
      if (!el) { el = document.createElement('div'); el.id = 'krext-prjpick-toast'; el.className = 'krext-prj-toast'; document.body.appendChild(el); }
      el.textContent = msg;
      el.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { el.hidden = true; }, ms || 3200);
    } catch (e) {}
  }

  /* ---------- 설정 / 목록 ---------- */
  async function loadCfg() {
    try { const s = await S.load(); enabled = s.prjPicker !== false; } catch (e) { enabled = true; }   // 확장 컨텍스트가 사라진 경우 등
    if (stopped) return;
    if (!enabled) teardownUi(); else scheduleScan();
  }
  async function loadList() {
    try {
      const pl = (await chrome.storage.local.get('projectList')).projectList;
      projects = (pl && Array.isArray(pl.projects)) ? pl.projects.filter((p) => p && p.prjNo) : [];
      listTs = (pl && pl.ts) || 0;
    } catch (e) { projects = []; listTs = 0; }
    if (!projects.length && !listRequested) {
      // 패널이 아직 조회한 적이 없으면 백그라운드에 조회를 요청 (캐시가 유효하면 그대로, 아니면 새로 조회해 projectList 를 저장 → onChanged 로 채워짐)
      listRequested = true;
      try { const p = chrome.runtime.sendMessage({ type: 'getData' }); if (p && p.catch) p.catch(() => {}); } catch (e) {}
    }
    for (const r of rows) render(r);
  }
  try {
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area === 'local' && ch.projectList) loadList();
      if ((area === 'sync' || area === 'local') && ch.settings) loadCfg();
    });
  } catch (e) {}

  /* ---------- 칸 찾기 ---------- */
  /* 돋보기 버튼(.btn_s_search)에서 왼쪽으로 라벨(th)을 찾아 "과제명"/"과제번호" 칸만: [th 과제책임자/과제명][td 입력란][td 버튼] (과제정보) · [th][td 입력란+버튼] (참여인력신청·청구서) ·
   * [th 과제번호][td PRJ_NO(readonly)+PRJ_NM+버튼] (회의사전신청). 총괄과제·대표과제 칸은 다른 팝업을 쓰므로 제외 */
  function findCandidates() {
    const out = [];
    for (const btn of document.querySelectorAll('input[type=button][class*="btn_s_search"], button[class*="btn_s_search"], a[class*="btn_s_search"]')) {
      if (rows.some((r) => r.btn === btn)) continue;
      const td = btn.closest('td');
      if (!td) continue;
      let th = null;
      const cells = [td];
      let c = td.previousElementSibling;
      for (let i = 0; i < 3 && c; i++, c = c.previousElementSibling) { if (c.tagName === 'TH') { th = c; break; } cells.unshift(c); }
      if (!th) continue;
      const label = norm(th.textContent);
      if (!/과제명|과제번호/.test(label) || /총괄|대표|모과제|상위/.test(label)) continue;
      const inputs = [];
      for (const cell of cells) for (const el of cell.querySelectorAll('input[type=text]')) if (!el.readOnly && !el.disabled) inputs.push(el);
      const input = inputs.find((el) => /SEARCH_NM|PRJ_NM/i.test(el.id || el.name || '')) || inputs[0];
      if (!input) continue;
      out.push({ btn, input, label });
    }
    return out;
  }
  /* 화면이 정한 과제번호를 읽을 요소: 같은 행의 PRJ_NO(readonly), 없으면 화면의 hidden #PRJ_NO */
  function findPrjNoEl(c) {
    const cands = [];
    const tr = c.btn.closest('tr');
    if (tr) cands.push(...tr.querySelectorAll('input#PRJ_NO, input[name=PRJ_NO]'));
    cands.push(...document.querySelectorAll('input#PRJ_NO, input[name=PRJ_NO]'));
    return cands.find((el) => el.type === 'hidden' || el.readOnly) || null;
  }
  /* 목록에 없는 과제의 이름: 화면 hidden 값(과제정보 #P_PRJ_NM, 참여인력·청구서 hidden #PRJ_NM, 회의사전신청 #PRJ_NM_H) → 과제정보 상단 "(과제번호)과제명 / 1단계 / 1연차" */
  function hiddenName(prjNo) {
    const val = (s) => { const el = document.querySelector(s); return el ? String(el.tagName === 'INPUT' ? el.value : el.textContent || '').trim() : ''; };
    let nm = val('input#P_PRJ_NM') || val('input[type=hidden]#PRJ_NM') || val('input#PRJ_NM_H');
    if (!nm) {
      const info = val('#PRJ_INFO');
      if (info && info.startsWith('(' + prjNo + ')')) nm = info.slice(prjNo.length + 2).split(' / ')[0].trim();
    }
    return nm;
  }

  /* ---------- 드롭다운 ---------- */
  /* 붙이기. 입력란이 아직 보이지 않으면(숨은 탭의 프레임 등 폭 0) false — 다음 스캔에서 다시 시도 */
  function mount(c) {
    const inW = c.input.offsetWidth, h = c.input.offsetHeight;
    if (!inW || !h) return false;
    ensureStyle();
    const sel = document.createElement('select');
    sel.className = SEL_CLASS;
    sel.style.height = h + 'px';
    try { sel.style.verticalAlign = getComputedStyle(c.input).verticalAlign || 'baseline'; } catch (e) {}
    const r = { btn: c.btn, input: c.input, sel, prjNoEl: findPrjNoEl(c), lastPrjNo: null, extra: null, origWidth: c.input.style.width };
    const w = c.input.style.width;
    if (inW >= 420 && /^\d+(\.\d+)?%$/.test(w)) {
      // 넓은 칸(과제정보·참여인력신청·청구서: 입력란 90~98%): 입력란 폭의 45%(최대 300px)를 드롭다운에 주고 입력란을 그만큼 줄여 같은 줄에
      sel.style.width = `min(300px, ${w} * 0.45)`;
      c.input.style.width = `calc(${w} - min(300px, ${w} * 0.45) - 8px)`;
      c.input.parentNode.insertBefore(sel, c.input);
    } else {
      // 좁은 칸(회의사전신청의 과제번호+과제명 칸 등): 칸 맨 위에 한 줄로 두고 입력란 폭은 그대로
      sel.style.display = 'block';
      sel.style.width = '100%';
      sel.style.margin = '0 0 3px';
      const td = c.input.closest('td') || c.input.parentNode;
      td.insertBefore(sel, td.firstChild);
    }
    sel.addEventListener('change', () => { onPick(r); });
    sel.addEventListener('mousedown', () => { if (!projects.length) loadList(); });
    rows.push(r);
    render(r);
    syncRow(r);
    log('드롭다운 추가:', c.label, '→', c.input.id || c.input.name || 'input', inW >= 420 ? '(같은 줄)' : '(칸 위 한 줄)', r.prjNoEl ? '(PRJ_NO 동기화)' : '');
    return true;
  }
  function render(r) {
    const sel = r.sel;
    const cur = sel.value;
    sel.textContent = '';
    sel.appendChild(new Option(projects.length ? `내 참여 과제 (${projects.length})` : '내 참여 과제 목록 없음', ''));
    for (const p of projects) sel.appendChild(new Option(`${p.rspr ? p.rspr + ' · ' : ''}${p.prjNm} (${p.prjNo})`, p.prjNo));
    if (r.extra && !projects.some((p) => p.prjNo === r.extra.prjNo)) sel.appendChild(new Option(`현재: ${r.extra.prjNm || ''} (${r.extra.prjNo})`, r.extra.prjNo));
    sel.value = cur;
    if (sel.value !== cur) sel.value = '';
    sel.title = projects.length
      ? `내 참여 과제 ${projects.length}개 — eClass 패널 조회 ${listTs ? new Date(listTs).toLocaleString() : ''} 기준 (참여인력에 본인이 있는 진행 과제). 고르면 팝업 없이 바로 적용됩니다`
      : '목록은 eClass 패널(또는 툴바 팝업)이 조회하면 채워집니다';
  }
  /* 화면이 정한 과제(#PRJ_NO)가 바뀌면 드롭다운을 맞추고 입력란에 과제명을 적는다 (입력란에 커서가 있으면 건드리지 않음) */
  function syncRow(r) {
    const el = r.prjNoEl;
    if (!el || !el.isConnected) return;
    const v = String(el.value || '').trim();
    if (v === r.lastPrjNo) return;
    r.lastPrjNo = v;
    if (!v) { r.extra = null; render(r); r.sel.value = ''; return; }
    const p = projects.find((x) => x.prjNo === v);
    const nm = (p && p.prjNm) || hiddenName(v);
    r.extra = p ? null : { prjNo: v, prjNm: nm };
    render(r);
    r.sel.value = v;
    if (nm && document.activeElement !== r.input && r.input.value !== nm) { r.input.value = nm; log('과제명 적용:', v, nm); }
  }
  /* 드롭다운 선택 → 입력란에 과제명 → 돋보기 버튼에 krext-prj-pick (MAIN world 훅이 버튼을 눌러 화면 처리기의 params 를 받고 팝업 대신 서비스 조회로 콜백 호출) */
  async function onPick(r) {
    const prjNo = r.sel.value;
    if (!prjNo) return;
    const p = projects.find((x) => x.prjNo === prjNo) || (r.extra && r.extra.prjNo === prjNo ? r.extra : null);
    if (!p) return;
    if (p.prjNm) r.input.value = p.prjNm;   // 화면 처리기가 SEARCH_NM 으로 읽고, 가로채기가 안 되면 팝업의 검색어가 된다
    r.sel.disabled = true;
    r.sel.classList.add('krext-busy');
    const id = 'p' + (++seq) + '_' + Date.now().toString(36);
    const res = await new Promise((resolve) => {
      const timer = setTimeout(() => { waiters.delete(id); resolve({ ok: false, error: '응답 없음 (훅 미동작)' }); }, 25000);
      waiters.set(id, (v) => { clearTimeout(timer); resolve(v); });
      try { r.btn.dispatchEvent(new CustomEvent('krext-prj-pick', { bubbles: true, detail: JSON.stringify({ id, prjNo: p.prjNo, prjNm: p.prjNm || '' }) })); }
      catch (e) { clearTimeout(timer); waiters.delete(id); resolve({ ok: false, error: String((e && e.message) || e) }); }
    });
    r.sel.disabled = false;
    r.sel.classList.remove('krext-busy');
    if (res.ok) { r.lastPrjNo = p.prjNo; toast(`과제 적용: ${res.prjNm || p.prjNm || p.prjNo}`); log('적용', res); }
    else { toast('과제 드롭다운: ' + (res.error || '적용 실패'), 5000); log('실패', res); }
  }
  document.addEventListener('krext-prj-pick-result', (ev) => {
    let r = null;
    try { r = JSON.parse(String((ev && ev.detail) || '')); } catch (e) { return; }
    const w = r && waiters.get(r.id);
    if (w) { waiters.delete(r.id); w(r); }
  });

  /* ---------- 스캔 / 감시 ---------- */
  function tick() {
    if (stopped) return;
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i];
      if (!r.sel.isConnected || !r.input.isConnected) { rows.splice(i, 1); continue; }   // 화면이 다시 그려짐 → 다음 스캔에서 새로 붙임
      syncRow(r);
    }
  }
  let retryTimer = null;
  function scan() {
    if (stopped || !enabled) return;
    let deferred = 0;
    for (const c of findCandidates()) { try { if (!mount(c)) deferred++; } catch (e) { log('mount 실패', e); } }
    if (rows.length && !pollTimer) pollTimer = setInterval(tick, 1000);
    clearTimeout(retryTimer);
    if (deferred) retryTimer = setTimeout(scan, 2000);   // 아직 보이지 않는 칸은 2초 뒤 다시
  }
  function scheduleScan() { clearTimeout(scanTimer); scanTimer = setTimeout(scan, 300); }
  function startObserver() {
    if (observer || !document.body) return;
    observeUntil = Date.now() + 180000;   // 늦게 그려지는 칸은 3분까지만 지켜본다
    observer = new MutationObserver(() => {
      if (Date.now() > observeUntil) { observer.disconnect(); observer = null; return; }
      scheduleScan();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  function teardownUi() {
    for (const r of rows.splice(0)) { try { r.sel.remove(); r.input.style.width = r.origWidth || ''; } catch (e) {} }
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }
  function teardown() {
    teardownUi();
    clearTimeout(scanTimer);
    clearTimeout(retryTimer);
    if (observer) { observer.disconnect(); observer = null; }
    const t = document.getElementById('krext-prjpick-toast');
    if (t) t.remove();
  }

  const start = () => { if (stopped) return; loadCfg(); loadList(); startObserver(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
