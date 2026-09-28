/* eclass.krs.co.kr 홈: R&D ERP 현황 패널 삽입
 * panelMode 'inline' : 본문(Popup Notice 카드 위)에 카드 형태로 삽입. 삽입 위치를 못 찾으면 float 로 대체
 * panelMode 'float'  : 우측 상단에 띄움
 * eclassPanel false  : 넣지 않음(툴바 팝업만 사용)
 * 설정을 저장하면(storage.onChanged) 열려 있는 화면에서 새로고침 없이 바로 반영: 끄면 숨기고 켜면 보이거나 만들고, 위치(본문 삽입 ↔ 우측 상단)를 바꾸면 패널을 그 자리로 옮긴다 */
(async () => {
  if (document.getElementById('krext-panel')) return;

  /* 표시를 꺼 둔 채 열린 화면: 설정에서 다시 켤 때까지 기다린다 (그때 저장된 설정으로 이어서 패널을 만듦) */
  function waitPanelOn() {
    return new Promise((resolve) => {
      try {
        const onChange = (ch) => {
          try {
            if (!ch.settings || !ch.settings.newValue || ch.settings.newValue.eclassPanel === false) return;
            chrome.storage.onChanged.removeListener(onChange);
            resolve(ch.settings.newValue);
          } catch (e) {}
        };
        chrome.storage.onChanged.addListener(onChange);
      } catch (e) {}   // 등록이 안 되면(확장 교체 등) 그대로 대기 — 새로고침하면 됨
    });
  }

  let settings = null;
  try { settings = await KRX_SETTINGS.load(); } catch (e) {}
  if (settings && settings.eclassPanel === false) {
    const saved = await waitPanelOn();
    if (document.getElementById('krext-panel')) return;
    try { settings = KRX_SETTINGS.merge(KRX_SETTINGS.DEFAULTS, saved); } catch (e) { settings = saved; }
  }
  let wantInline = !settings || settings.panelMode !== 'float';   // 현재 설정의 표시 위치 (설정이 바뀌면 갱신)

  const host = document.createElement('div');
  host.id = 'krext-panel';
  host.className = 'krext-panel';

  /* 본문 삽입 위치 찾기: "Popup Notice" 카드 → 그 카드(또는 그 카드가 속한 row)의 앞 */
  function findInlineAnchor() {
    const isRow = (el) => el && el.classList && el.classList.contains('row');
    const leaf = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,div,span,p,strong'))
      .find((el) => el.children.length === 0 && /^popup\s*notice$/i.test((el.textContent || '').trim()));
    if (leaf) {
      const card = leaf.closest('.card') || leaf.closest('.card-box') || leaf.closest('section') || leaf.parentElement;
      if (card && card !== document.body) {
        let node = card;
        while (node.parentElement && node.parentElement !== document.body && !isRow(node.parentElement)) node = node.parentElement;
        if (isRow(node.parentElement)) return { parent: node.parentElement, before: node, wrapCol: true };
        return { parent: card.parentElement, before: card, wrapCol: false };
      }
    }
    const main = document.querySelector('.content-page .container-fluid, .content-page .content, .content-page, .page-content, main, #content, .container-fluid');
    if (main) return { parent: main, before: main.firstElementChild, wrapCol: false };
    return null;
  }

  /* 본문이 늦게 그려지는 경우를 위해 최대 4초 대기 */
  async function waitInlineAnchor() {
    for (let i = 0; i < 14; i++) {
      const a = findInlineAnchor();
      if (a) return a;
      await new Promise((r) => setTimeout(r, 300));
    }
    return null;
  }

  /* 패널을 본문 위치(a)에 넣는다. 부모가 bootstrap row 면 col 로 감싼다 */
  function mountInline(a) {
    const col = host.closest('.krext-col');
    host.classList.add('krext-inline'); host.classList.remove('krext-float');
    if (a.wrapCol) {
      const wrap = document.createElement('div');
      wrap.className = 'col-12 krext-col';
      wrap.appendChild(host);
      a.parent.insertBefore(wrap, a.before);
    } else {
      a.parent.insertBefore(host, a.before);
    }
    if (col && col !== host.parentElement) col.remove();   // 이전 자리의 빈 col 정리
  }
  /* 패널을 우측 상단(body 끝, CSS position: fixed)으로 옮긴다 */
  function mountFloat() {
    const col = host.closest('.krext-col');
    host.classList.add('krext-float'); host.classList.remove('krext-inline');
    document.body.appendChild(host);
    if (col) col.remove();
  }
  let visible = true;   // 설정 eclassPanel. 숨김은 col 이 있으면 col 에(빈 col 이 여백을 남기지 않게), 아니면 host 에 건다
  function applyVisible() {
    host.style.display = visible ? '' : 'none';
    const col = host.closest('.krext-col');
    if (col) col.style.display = visible ? '' : 'none';
  }

  /* 설정의 표시 위치대로 패널을 놓는다(처음 한 번, 그리고 설정이 바뀔 때마다). 본문 삽입 위치를 못 찾으면 우측 상단으로 대체.
   * 위치를 찾는 동안(최대 4초) 설정이 또 바뀌면 나중 호출만 적용 */
  let placeSeq = 0;
  async function place() {
    const seq = ++placeSeq;
    const a = wantInline ? await waitInlineAnchor() : null;
    if (seq !== placeSeq) return;
    if (a) mountInline(a); else mountFloat();
    state.mode = a ? 'inline' : 'page';
    applyVisible();
  }
  /* 저장된 설정을 열려 있는 화면에 반영: eclassPanel 로 표시/숨김, panelMode 가 바뀌었으면 패널을 옮김 */
  function applySettings(s) {
    visible = s.eclassPanel !== false;
    applyVisible();
    const want = s.panelMode !== 'float';
    if (want !== wantInline) { wantInline = want; place(); }
  }

  const state = { mode: 'page', loading: true, data: null, fatal: null, collapsed: false, expanded: new Set(), prepOpen: new Set() /* 청구 준비 요소를 보이는 과제·카드 묶음 (줄 끝 청구 아이콘, lib/prep.js) */, rndUrl: null, view: 'project', section: 'cards', version: '',
    plans: {}, planEdit: null, planDraft: null, planError: '' };   // 예상 비용 (lib/plan.js)
  await place();
  try { state.version = chrome.runtime.getManifest().version; } catch (e) {}
  try {
    const local = await chrome.storage.local.get(['panelCollapsed', 'cache', 'panelView', 'panelSection']);
    state.collapsed = !!local.panelCollapsed;
    state.data = local.cache || null;
    state.view = local.panelView === 'card' ? 'card' : 'project';
    state.section = local.panelSection === 'budget' ? 'budget' : 'cards';
  } catch (e) {}
  try { state.plans = await KRX_PLAN.load(); } catch (e) {}
  try { state.payPlans = await KRX_PAY.load(); } catch (e) {}   // 받기 예정 연구수당 (lib/pay.js)
  try { state.partPlans = await KRX_PART.load(); } catch (e) {}   // 예비 참여율(참여 계획) (lib/part.js)
  try { state.prep = await KRX_PREP.load(); } catch (e) {}        // 청구 준비: 거래별 청구종류·첨부 파일 (lib/prep.js)
  const anchors = Array.from(document.querySelectorAll('a[href]'));
  const link = anchors.find((x) => /rnd\.krs\.co\.kr/i.test(x.href));
  state.rndUrl = link ? link.href : null;
  // 하단 HR System 열기 (없으면 설정의 HR System 링크): eClass 홈 메뉴 HR › Main Page 는 href 없이 onclick="openNewWindow('…/External/SSOMessage')" 로 SSO 중계 페이지를 연다 (PGMID 가 붙은 것은 HR 하위 화면)
  const hrLink = anchors.find((x) => /hr\.krs\.co\.kr|\/External\/SSOMessage/i.test(x.href));
  let hrUrl = hrLink ? hrLink.href : null;
  if (!hrUrl) {
    for (const el of document.querySelectorAll('[onclick*="SSOMessage"]')) {
      const m = (el.getAttribute('onclick') || '').match(/https?:\/\/[^'"\s)]*\/External\/SSOMessage(?:\?[^'"\s)]*)?/i);
      if (m && !/PGMID=/i.test(m[0])) { hrUrl = m[0]; break; }
    }
  }
  state.hrUrl = hrUrl;

  const draw = () => KRX_RENDER.render(host, state);
  KRX_PLAN.bind(host, state, draw);   // 과제집행비율 표의 예상 비용 입력(＋/수정/삭제) 처리
  KRX_PAY.bind(host, state, draw);    // 급여·연구수당 구역의 받기 예정 연구수당 입력(＋/수정/삭제) 처리
  KRX_PART.bind(host, state, draw);   // 과제 참여율 표의 참여 계획 입력(＋/수정/삭제, 기간 달력) 처리
  KRX_PREP.bind(host, state, draw);   // 카드미청구 거래 행 밑 둘째 줄의 청구 준비(청구종류 select, 청구내역 입력란, 파일 드래그 앤 드롭·지우기, 청구서 작성) 처리

  /* 확장이 새로고침/업데이트되면 이 스크립트는 확장과 연결이 끊긴다(Extension context invalidated). 예외 대신 안내 표시 */
  const alive = () => { try { return !!(chrome.runtime && chrome.runtime.id); } catch (e) { return false; } };
  const showStale = () => {
    if (host.querySelector('.krext-stale')) return;
    const n = document.createElement('div');
    n.className = 'krext-msg krext-warn krext-stale';
    n.innerHTML = '확장 프로그램이 업데이트되었습니다. <a href="#" onclick="location.reload();return false;">페이지를 새로고침</a>하면 다시 동작합니다.';
    const head = host.querySelector('.krext-head');
    if (head) head.insertAdjacentElement('afterend', n); else host.prepend(n);
  };

  /* chrome.* 호출은 확장이 교체된 뒤(context invalidated) 동기 예외를 던질 수 있어 모두 감싼다 */
  const safe = (fn) => { try { const r = fn(); if (r && typeof r.catch === 'function') r.catch(() => {}); } catch (e) { showStale(); } };

  host.addEventListener('click', (ev) => {
    try {
      const btn = ev.target.closest('[data-act]');
      if (!btn) return;
      if (!alive()) { ev.preventDefault(); showStale(); return; }
      const act = btn.dataset.act;
      if (act === 'refresh') { ev.preventDefault(); load(true); }
      else if (act === 'settings') { ev.preventDefault(); safe(() => chrome.runtime.sendMessage({ type: 'openOptions' })); }
      else if (act === 'toggle') { if (ev.target.closest('a')) return; ev.preventDefault(); state.collapsed = !state.collapsed; safe(() => chrome.storage.local.set({ panelCollapsed: state.collapsed })); draw(); }
      else if (act === 'prj') { ev.preventDefault(); const k = btn.dataset.prj; if (state.expanded.has(k)) state.expanded.delete(k); else state.expanded.add(k); draw(); }
      else if (act === 'view') { ev.preventDefault(); state.view = btn.dataset.view === 'card' ? 'card' : 'project'; safe(() => chrome.storage.local.set({ panelView: state.view })); draw(); }
      else if (act === 'section') {   // 본문 스위치 또는 헤더 칩(미청구/집행비율). 접힌 패널이면 펼친다
        ev.preventDefault(); state.section = btn.dataset.section === 'budget' ? 'budget' : 'cards';
        if (state.collapsed) { state.collapsed = false; safe(() => chrome.storage.local.set({ panelCollapsed: false })); }
        safe(() => chrome.storage.local.set({ panelSection: state.section })); draw();
      }
      else if (act === 'claim') { if (ev.target.closest('a')) return; ev.preventDefault(); if (btn.dataset.href) window.open(btn.dataset.href, '_blank', 'noopener'); }
    } catch (e) { showStale(); }
  });

  async function load(force) {
    if (!alive()) { state.loading = false; draw(); showStale(); return; }
    state.loading = true; state.fatal = null; draw();
    try {
      const res = await chrome.runtime.sendMessage({ type: 'getData', force: !!force, full: !!force });   // ↻: 참여인력(계상률) 캐시(2시간)도 건너뛰고 다시 조회
      if (res && !res.error) state.data = res; else state.fatal = (res && res.error) || '응답 없음';
    } catch (e) {
      const msg = String((e && e.message) || e);
      state.fatal = /context invalidated/i.test(msg) ? null : msg;
      if (!state.fatal) { state.loading = false; draw(); showStale(); return; }
    }
    state.loading = false; draw();
  }

  try {
    chrome.storage.onChanged.addListener((ch, area) => {
      try { if (area === 'local' && ch.cache && ch.cache.newValue) { state.data = ch.cache.newValue; if (!state.loading) draw(); } } catch (e) {}
      // 설정 저장(설정은 sync, 안 되면 local) → 새로고침 없이 바로 반영: "eClass 홈에 패널 표시"를 끄면 숨기고 켜면 보임, 표시 위치(본문 삽입/우측 상단)가 바뀌면 패널을 옮김
      try { if (ch.settings && ch.settings.newValue) applySettings(ch.settings.newValue); } catch (e) {}
    });
  } catch (e) {}
  /* 오래 가려져 Chrome 이 멈춰 둔 eClass 탭에는 storage.onChanged 가 탭이 다시 보일 때까지 전달되지 않는다(2026-09-28 CDP 로 확인: 보이는 순간 밀린 이벤트가 한꺼번에 옴. 막 가려진 탭에는 바로 옴).
   * 밀린 이벤트가 버려지는 경우(탭 절전 등)도 있을 수 있어, 탭이 다시 보이면 저장된 설정을 읽어 한 번 더 맞춘다 */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !alive()) return;
    try { KRX_SETTINGS.load().then(applySettings).catch(() => {}); } catch (e) {}
  });

  draw();
  try { load(false); } catch (e) { showStale(); }
})();
