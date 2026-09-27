/* 툴바 팝업: 패널 렌더러 재사용 */
(async () => {
  const host = document.getElementById('krext-panel');
  const state = { mode: 'popup', loading: true, data: null, fatal: null, collapsed: false, expanded: new Set(), prepOpen: new Set() /* 청구 준비 요소를 보이는 과제·카드 묶음 (줄 끝 청구 아이콘, lib/prep.js) */, rndUrl: null, view: 'project', section: 'cards', version: '',
    plans: {}, planEdit: null, planDraft: null, planError: '' };   // 예상 비용 (lib/plan.js)
  try { state.version = chrome.runtime.getManifest().version; } catch (e) {}
  try { const l = await chrome.storage.local.get(['cache', 'panelView', 'panelSection']); state.data = l.cache || null; state.view = l.panelView === 'card' ? 'card' : 'project'; state.section = l.panelSection === 'budget' ? 'budget' : 'cards'; } catch (e) {}
  try { state.plans = await KRX_PLAN.load(); } catch (e) {}
  try { state.payPlans = await KRX_PAY.load(); } catch (e) {}   // 받기 예정 연구수당 (lib/pay.js)
  try { state.partPlans = await KRX_PART.load(); } catch (e) {}   // 예비 참여율(참여 계획) (lib/part.js)
  try { state.prep = await KRX_PREP.load(); } catch (e) {}        // 청구 준비: 거래별 청구종류·첨부 파일 (lib/prep.js)
  const draw = () => KRX_RENDER.render(host, state);
  KRX_PLAN.bind(host, state, draw);   // 과제집행비율 표의 예상 비용 입력(＋/수정/삭제) 처리
  KRX_PAY.bind(host, state, draw);    // 급여·연구수당 구역의 받기 예정 연구수당 입력(＋/수정/삭제) 처리
  KRX_PART.bind(host, state, draw);   // 과제 참여율 표의 참여 계획 입력(＋/수정/삭제, 기간 달력) 처리
  KRX_PREP.bind(host, state, draw);   // 카드미청구 거래 행 밑 둘째 줄의 청구 준비(청구종류 select, 청구내역 입력란, 파일 지우기, 청구서 작성) 처리 — 팝업에는 파일을 끌어다 놓을 수 없음

  host.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'refresh') { ev.preventDefault(); load(true); }
    else if (act === 'settings') { ev.preventDefault(); chrome.runtime.openOptionsPage(); }
    else if (act === 'prj') { ev.preventDefault(); const k = btn.dataset.prj; if (state.expanded.has(k)) state.expanded.delete(k); else state.expanded.add(k); draw(); }
    else if (act === 'view') { ev.preventDefault(); state.view = btn.dataset.view === 'card' ? 'card' : 'project'; chrome.storage.local.set({ panelView: state.view }); draw(); }
    else if (act === 'section') { ev.preventDefault(); state.section = btn.dataset.section === 'budget' ? 'budget' : 'cards'; chrome.storage.local.set({ panelSection: state.section }); draw(); }
    else if (act === 'claim') { if (ev.target.closest('a')) return; ev.preventDefault(); if (btn.dataset.href) chrome.tabs.create({ url: btn.dataset.href }); }
  });
  document.getElementById('btnOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());

  /* ---------- 확장 Plus 켜기/끄기 (설정 KRX_SETTINGS plus.enabled, 설정 페이지의 같은 항목과 같은 값) ----------
   * 켜면 백그라운드가 설정의 섹션 이름(기본 RERP)으로 섹션을 찾고(plusResolveSection) 없으면 만든다. 그 이름의 섹션이 없는데 만들 노트북을 모르거나 여러 노트북에 있으면
   * 노트북 select 를 보여 고르게 하고(plus.notebookId 저장), 고르면 다시 찾아(만들어) 바로 동기화한다. MCP 서버가 안 떠 있으면 이유를 보인다 */
  const plusOn = document.getElementById('plusOn'), plusNb = document.getElementById('plusNotebook'), plusStatus = document.getElementById('plusStatus');
  const setPlusStatus = (t, err) => { plusStatus.textContent = t || ''; plusStatus.classList.toggle('err', !!err); plusStatus.title = t || ''; };
  let plusSettings = null;
  const sectionName = () => String(((plusSettings && plusSettings.plus) || {}).sectionName || '').trim() || KRX_SETTINGS.DEFAULTS.plus.sectionName;
  async function loadPlus() {
    try { plusSettings = await KRX_SETTINGS.load(); } catch (e) { return; }
    const p = plusSettings.plus || {};
    plusOn.checked = !!p.enabled;
    plusNb.hidden = true;
    if (!p.enabled) { setPlusStatus(''); return; }
    let sec = null; try { sec = (await chrome.storage.local.get('plusSection')).plusSection || null; } catch (e) {}
    if (sec && sec.id && sec.name === sectionName() && (!p.notebookId || sec.notebookId === p.notebookId)) setPlusStatus(`${sec.name} 섹션: ${sec.notebook || sec.label}`);
    else resolveSection();
  }
  async function savePlus(patch) {
    const s = plusSettings || await KRX_SETTINGS.load();
    s.plus = Object.assign({}, KRX_SETTINGS.DEFAULTS.plus, s.plus || {}, patch);
    plusSettings = s;
    await KRX_SETTINGS.save(s);
  }
  async function resolveSection() {
    setPlusStatus(`${sectionName()} 섹션을 찾는 중…`);
    let r = null;
    try { r = await chrome.runtime.sendMessage({ type: 'plusResolveSection' }); } catch (e) { r = null; }
    if (r && r.ok) {
      plusNb.hidden = true;
      setPlusStatus(`${r.section.name} 섹션: ${r.section.notebook || r.section.label}${r.section.created ? ' (새로 만듦)' : ''} · 동기화 중…`);
      let s = null;
      try { s = await chrome.runtime.sendMessage({ type: 'planSync', reason: 'manual' }); } catch (e) { s = null; }
      setPlusStatus(s && s.ok ? `${r.section.name} 섹션: ${r.section.notebook || r.section.label} · 동기화됨 과제 ${Object.keys(s.pages || {}).length}건 · 항목 ${s.count}건${s.waiting ? ` · 책임자 생성 대기 ${s.waiting}` : ''}` : s && s.error ? `동기화 실패: ${s.error}` : `${r.section.name} 섹션: ${r.section.notebook || r.section.label}`, !!(s && !s.ok && s.error));
    } else if (r && r.kind === 'notebook') {   // 만들(또는 고를) 노트북을 골라야 함
      plusNb.innerHTML = `<option value="">(${sectionName()} 섹션을 둘 노트북 선택)</option>` + (r.notebooks || []).map((n) => `<option value="${KRX_FMT.esc(n.id)}">${KRX_FMT.esc(n.name || n.id)}</option>`).join('');
      plusNb.hidden = false;
      setPlusStatus(`${r.error || '노트북을 고르세요'} — 내가 책임자인 과제의 페이지를 만들 때만 필요합니다. 동료가 보낸 링크로 가져오기는 그대로 됩니다`, true);
    } else setPlusStatus(r ? `MCP 서버 연결 실패 (${r.kind || 'error'}): ${r.error || r.message || ''}` : '응답 없음', true);
  }
  plusOn.addEventListener('change', async () => {
    await savePlus({ enabled: plusOn.checked });
    await loadPlus();
  });
  plusNb.addEventListener('change', async () => {
    if (!plusNb.value) return;
    await savePlus({ notebookId: plusNb.value, notebookLabel: (plusNb.selectedOptions[0] || {}).textContent || '' });
    resolveSection();
  });
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
