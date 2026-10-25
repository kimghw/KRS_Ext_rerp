/* 설정 페이지 */
(async () => {
  const S = KRX_SETTINGS, F = KRX_FMT;
  const $ = (id) => document.getElementById(id);
  const setStatus = (id, text, isErr) => { const el = $(id); el.textContent = text || ''; el.classList.toggle('err', !!isErr); if (text) setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, 4000); };

  let selected = new Set();     // 모니터링 카드 선택(숫자만)
  let cardNames = {};           // settings.cardNames { [카드 숫자]: 별명 } (카드 별명 구역, 입력 시 바로 저장)
  let namesTimer = 0;
  let issued = null;            // storage.local.issuedCards: { ts, projects: [{prjNo, prjNm, rspr, cards[], accounts[], acctKnown}] }
  let excluded = new Set();     // 제외한 과제번호
  let projectList = null;       // storage.local.projectList
  let overrides = {};           // { prjNo: { include: Set, exclude: Set } }
  let bgtInclude = {};          // 과제집행비율 비목별 포함 여부 { [비목명]: true|false } (settings.budgetItemInclude)
  let bgtDefaultKeys = [];      // 명시적으로 고르지 않은 비목의 기본 제외 키워드 (settings.budgetExcludeDefault)
  let cacheData = null;         // storage.local.cache (패널 데이터) - 비목 목록 추출용

  const ovOf = (prjNo) => { if (!overrides[prjNo]) overrides[prjNo] = { include: new Set(), exclude: new Set() }; return overrides[prjNo]; };
  /* 카드의 이 과제 포함 여부 (계좌 일치 기본값 + 재정의) */
  function isIncluded(prjNo, c) {
    const ov = ovOf(prjNo);
    if (ov.exclude.has(c.digits)) return false;
    if (ov.include.has(c.digits)) return true;
    return c.acctMatch === null || c.acctMatch === undefined ? true : !!c.acctMatch;
  }

  /* ---------- 탭: 일반 설정 · LLM 설정 · 공유 (Plus) ([data-panel]). 주소가 #llm(탭을 눌러 둠) 또는 #fetch…(패널의 ⚙ #fetch=<id> · 자주 사용 등록 #fetch-new=… — 증빙 찾아오기는 LLM 설정 탭 안)면 LLM 설정 탭, #share 면 공유 (Plus) 탭 ---------- */
  const tabOfHash = () => (/^#(fetch|llm)/.test(location.hash) ? 'llm' : /^#share/.test(location.hash) ? 'share' : 'main');
  function showTab(name) {
    if (name !== 'llm' && name !== 'share') name = 'main';
    document.querySelectorAll('[data-panel]').forEach((el) => { el.hidden = el.dataset.panel !== name; });
    document.querySelectorAll('.tabs [data-tab]').forEach((b) => {
      const active = b.dataset.tab === name;
      b.setAttribute('aria-selected', String(active));
      b.tabIndex = active ? 0 : -1;
    });
  }
  document.querySelectorAll('.tabs [data-tab]').forEach((b) => b.addEventListener('click', () => {
    const name = b.dataset.tab;
    showTab(name);
    if (tabOfHash() !== name) history.replaceState(null, '', name === 'main' ? location.pathname : '#' + name);   // 새로고침해도 그 탭 (hashchange 는 안 일으킴)
    window.scrollTo(0, 0);
  }));
  document.querySelector('.tabs').addEventListener('keydown', (ev) => {
    const tabs = Array.from(document.querySelectorAll('.tabs [data-tab]'));
    const current = tabs.indexOf(ev.target);
    if (current < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(ev.key)) return;
    ev.preventDefault();
    const next = ev.key === 'Home' ? 0 : ev.key === 'End' ? tabs.length - 1 : (current + (ev.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].click();
    tabs[next].focus();
  });
  showTab(tabOfHash());

  /* ---------- 긴 설명 접기: 카드마다 설명 문단(p.help 중 조작 요소·id 가 없는 글, 80자 이상)은 기본으로 접어 두고 제목 옆 "ⓘ 설명" 배지를 누르면 펼친다. 펼친 카드는 storage.local.optHelp 에 기억 ---------- */
  const ICON_INFO = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
  async function initDescFold() {
    let saved = {};
    try { saved = (await chrome.storage.local.get('optHelp')).optHelp || {}; } catch (e) {}
    document.querySelectorAll('.card').forEach((card) => {
      const h2 = card.querySelector('h2');
      if (!h2) return;
      const ps = Array.from(card.querySelectorAll('p.help')).filter((p) => p.closest('.card') === card && !p.id && !p.hidden && !p.querySelector('input,button,select,textarea,[id]') && p.textContent.trim().length >= 80);
      if (!ps.length) return;
      const key = card.dataset.helpKey || card.dataset.collapse || card.id || Array.from(h2.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
      ps.forEach((p) => p.classList.add('desc'));
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'desc-toggle'; btn.innerHTML = `${ICON_INFO}<span>설명</span>`;
      const apply = (open) => { card.classList.toggle('desc-open', open); btn.classList.toggle('on', open); btn.setAttribute('aria-expanded', String(open)); btn.title = open ? '설명 접기' : `설명 보기 (${ps.length}개 문단)`; };
      apply(!!saved[key]);
      btn.addEventListener('click', (e) => {   // details.card 의 summary 안이면 접기/펼치기까지 일어나지 않게
        e.preventDefault(); e.stopPropagation();
        const open = !card.classList.contains('desc-open');
        apply(open); saved[key] = open;
        try { chrome.storage.local.set({ optHelp: saved }); } catch (x) {}
      });
      h2.appendChild(btn);
    });
  }

  /* ---------- 접기/펼치기 (details.card[data-collapse]): 마지막 상태를 storage.local.optCollapse 에 기억 (기본: 접힘) ---------- */
  async function initCollapse() {
    let saved = {};
    try { saved = (await chrome.storage.local.get('optCollapse')).optCollapse || {}; } catch (e) {}
    document.querySelectorAll('details.card[data-collapse]').forEach((el) => {
      const key = el.dataset.collapse;
      if (typeof saved[key] === 'boolean') el.open = saved[key];
      if (key === 'llm' && location.hash === '#llm-cli') { el.open = true; setTimeout(() => el.scrollIntoView({ block: 'start' }), 80); }   // 주소에 #llm-cli 가 있으면 LLM 연결 카드(Win+R → setup.cmd 안내)를 펼쳐 보임(2026-10-23 전에는 패널 B(브릿지) 아이콘이 이 주소로 왔음 — 지금 B 는 연결 지침 복사) — 기억된 접힘보다 우선, 기억은 안 바꿈(listener 전)
      el.addEventListener('toggle', () => { saved[key] = el.open; try { chrome.storage.local.set({ optCollapse: saved }); } catch (e) {} });
    });
  }
  /* 접힌 제목 옆 요약 문구 */
  function updateIssuedSummary() {
    const projects = ((issued && issued.projects) || []).filter((p) => !excluded.has(p.prjNo));
    let nCards = 0, nInc = 0;
    for (const p of projects) for (const c of p.cards || []) { nCards++; if (isIncluded(p.prjNo, c)) nInc++; }
    $('issuedSummary').textContent = issued && issued.ts ? `${projects.length}개 과제 · 카드 ${nCards}장 중 ${nInc}장 귀속` : '';
  }
  function updateMonitorSummary() {
    const mode = document.querySelector('input[name=cardFilterMode]:checked');
    const specific = mode && mode.value === 'specific';
    const extra = F.parseList($('cardFilterList').value).length;
    $('monitorSummary').textContent = specific ? `선택한 카드만 · ${selected.size + extra}장` : '전체 보기';
  }

  /* ---------- 과제 선택 ---------- */
  function renderProjects() {
    const box = $('prjList');
    const projects = (projectList && projectList.projects) || [];
    const known = new Set(projects.map((p) => p.prjNo));
    const row = (p, missing) => {
      const on = !excluded.has(p.prjNo);
      const period = (p.stDt || p.endDt) ? `${F.fmtDate(p.stDt)} ~ ${F.fmtDate(p.endDt)}` : '';
      return `<tr class="${on ? '' : 'off'}"><td><label><input type="checkbox" data-prj="${F.esc(p.prjNo)}" ${on ? 'checked' : ''}></label></td>
        <td>${F.esc(p.rspr || '-')}</td><td class="no">${F.esc(p.prjNo)}</td><td class="nm">${F.esc(p.prjNm || (missing ? '(목록에 없는 과제)' : ''))}</td>
        <td>${F.esc(period)}</td><td>${F.esc(p.status || '')}</td></tr>`;
    };
    let rows = projects.map((p) => row(p, false)).join('');
    rows += Array.from(excluded).filter((no) => !known.has(no)).map((no) => row({ prjNo: no }, true)).join('');
    box.innerHTML = rows
      ? `<table class="prj-table"><thead><tr><th></th><th>과제책임자</th><th>과제번호</th><th>과제명</th><th>과제기간</th><th>상태</th></tr></thead><tbody>${rows}</tbody></table>`
      : '<div class="issued-empty">조회된 과제가 없습니다. R&amp;D ERP에 로그인된 상태에서 <b>과제 목록 새로고침</b>을 누르세요.</div>';
    const info = () => { $('prjInfo').textContent = projectList && projectList.ts ? `${projects.length}개 과제 · ${F.fmtClock(projectList.ts)} 기준 · 제외 ${excluded.size}개` : ''; };
    info();
    box.querySelectorAll('input[type=checkbox][data-prj]').forEach((cb) => cb.addEventListener('change', () => {
      if (cb.checked) excluded.delete(cb.dataset.prj); else excluded.add(cb.dataset.prj);
      cb.closest('tr').classList.toggle('off', !cb.checked);
      info();
      onExcludedChanged();
    }));
  }
  /* 과제 체크를 바꾸면 "저장"을 누르지 않아도 바로 적용: 아래 카드 목록을 다시 그리고, 제외 목록만 설정에 저장(→ 백그라운드가 다시 조회) */
  let excludeTimer = null;
  function onExcludedChanged() {
    renderIssued();
    renderBgtItems();   // 제외한 과제의 비목은 목록에서도 빠짐
    clearTimeout(excludeTimer);
    excludeTimer = setTimeout(saveExcluded, 600);
  }
  async function saveExcluded() {
    try {
      const cur = await S.load();
      const prev = (cur.excludedProjects || []).map((x) => String(x).trim());
      if (prev.length === excluded.size && prev.every((x) => excluded.has(x))) return;
      cur.excludedProjects = Array.from(excluded);
      await S.save(cur);
      setStatus('prjStatus', '적용했습니다. 패널은 자동으로 다시 조회됩니다.');
    } catch (e) { setStatus('prjStatus', '적용 실패: ' + String((e && e.message) || e), true); }
  }
  async function loadProjects() {
    projectList = (await chrome.storage.local.get('projectList')).projectList || null;
    renderProjects();
    renderSharePrj();   // 공유 (Plus) › 과제별 공유 › 고른 과제만의 목록
    renderSitesPrj();   // 공유 (Plus) › 전체 공유 › 공유할 과제(가맹점)의 목록
    const sel = $('diagPrj');
    const projects = (projectList && projectList.projects) || [];
    sel.innerHTML = '<option value="">과제 선택</option>' + projects.map((p) => `<option value="${F.esc(p.prjNo)}">${F.esc(p.prjNo)} ${F.esc(p.rspr || '')} ${F.esc((p.prjNm || '').slice(0, 40))}</option>`).join('');
  }
  $('btnPrjRefresh').addEventListener('click', async () => {
    setStatus('prjStatus', 'R&D ERP에서 불러오는 중…');
    const res = await chrome.runtime.sendMessage({ type: 'getData', force: true, full: true });   // 참여인력 캐시(2시간)도 건너뛰어 참여 과제 목록을 다시 판정
    await loadProjects(); await loadIssued();
    if (res && res.error) setStatus('prjStatus', '오류: ' + res.error, true);
    else if (res && res.loginRequired) setStatus('prjStatus', 'R&D ERP 로그인이 필요합니다. eClass의 R&D ERP 메뉴를 클릭해서 로그인한 뒤 다시 누르세요.', true);
    else setStatus('prjStatus', '불러왔습니다.');
  });
  $('btnPrjAll').addEventListener('click', () => { $('prjList').querySelectorAll('input[type=checkbox][data-prj]').forEach((cb) => { cb.checked = true; cb.dispatchEvent(new Event('change')); }); });
  $('btnPrjNone').addEventListener('click', () => { $('prjList').querySelectorAll('input[type=checkbox][data-prj]').forEach((cb) => { cb.checked = false; cb.dispatchEvent(new Event('change')); }); });

  /* ---------- 과제집행비율 비목 선택 ---------- */
  const normNm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();
  /* 명시적 선택이 없을 때의 기본값: 이름에 기본 제외 키워드가 들어가면 제외 */
  const bgtDefaultOn = (name) => !bgtDefaultKeys.some((k) => k && normNm(name).includes(k));
  const bgtIsOn = (name) => (Object.prototype.hasOwnProperty.call(bgtInclude, name) ? bgtInclude[name] !== false : bgtDefaultOn(name));
  /* 캐시(패널 데이터)의 과제별 비목을 이름 기준으로 합침 (조회된 순서 유지) */
  function collectBgtItems() {
    const map = new Map();
    for (const p of (cacheData && cacheData.projects) || []) {
      if (excluded.has(p.prjNo)) continue;
      for (const x of (p.budget && p.budget.items) || []) {
        const name = String(x.exp || x.item || '').trim();
        if (!name) continue;
        let it = map.get(name);
        if (!it) { it = { name, prjs: 0, bgt: 0, appr: 0, dir: false, psnl: false }; map.set(name, it); }
        it.prjs++; it.bgt += Number(x.bgt) || 0; it.appr += Number(x.appr) || 0; it.dir = it.dir || !!x.dir; it.psnl = it.psnl || !!x.psnl;
      }
    }
    for (const name of Object.keys(bgtInclude)) if (!map.has(name)) map.set(name, { name, prjs: 0, bgt: 0, appr: 0, missing: true });   // 목록에 없지만 선택 기록이 있는 비목
    return Array.from(map.values());
  }
  function renderBgtItems() {
    const items = collectBgtItems();
    const box = $('bgtList');
    const rows = items.map((it) => {
      const on = bgtIsOn(it.name);
      const explicit = Object.prototype.hasOwnProperty.call(bgtInclude, it.name);
      const tags = [it.psnl ? '인건비' : '', it.dir ? '직접비' : ''].filter(Boolean).join(' · ');
      return `<tr class="${on ? '' : 'off'}"><td><label><input type="checkbox" data-bgt="${F.esc(it.name)}" ${on ? 'checked' : ''}></label></td>
        <td class="nm">${F.esc(it.name)}${it.missing ? ' <span class="muted">(현재 목록에 없음)</span>' : ''}</td><td class="tag">${F.esc(tags)}</td>
        <td class="num">${it.prjs ? `${it.prjs}개 과제` : '-'}</td><td class="num">${F.money(it.bgt)}</td><td class="num">${F.money(it.appr)}</td>
        <td class="tag">${explicit ? '' : '기본'}</td></tr>`;
    }).join('');
    box.innerHTML = rows
      ? `<table class="prj-table"><thead><tr><th></th><th>비목</th><th>구분</th><th>과제</th><th style="text-align:right">예산액 합계</th><th style="text-align:right">승인액 합계</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
      : '<div class="issued-empty">조회된 비목이 없습니다. R&amp;D ERP에 로그인된 상태에서 <b>목록 새로고침</b>을 누르세요.</div>';
    const onCnt = items.filter((it) => bgtIsOn(it.name)).length;
    $('bgtInfo').textContent = items.length ? `${items.length}개 비목 중 ${onCnt}개 포함${cacheData && cacheData.ts ? ` · ${F.fmtClock(cacheData.ts)} 기준` : ''}` : '';
    box.querySelectorAll('input[type=checkbox][data-bgt]').forEach((cb) => cb.addEventListener('change', () => {
      bgtInclude[cb.dataset.bgt] = cb.checked;
      cb.closest('tr').classList.toggle('off', !cb.checked);
      onBgtChanged();
    }));
  }
  let bgtTimer = null;
  function onBgtChanged() {
    const items = collectBgtItems();
    $('bgtInfo').textContent = `${items.length}개 비목 중 ${items.filter((it) => bgtIsOn(it.name)).length}개 포함`;
    clearTimeout(bgtTimer);
    bgtTimer = setTimeout(saveBgtInclude, 600);
  }
  async function saveBgtInclude() {
    try {
      const cur = await S.load();
      const prev = cur.budgetItemInclude || {};
      const next = Object.assign({}, bgtInclude);
      if (JSON.stringify(prev) === JSON.stringify(next)) return;
      cur.budgetItemInclude = next;
      await S.save(cur);
      setStatus('bgtStatus', '적용했습니다. 패널은 자동으로 다시 조회됩니다.');
    } catch (e) { setStatus('bgtStatus', '적용 실패: ' + String((e && e.message) || e), true); }
  }
  async function loadBgtItems() {
    cacheData = (await chrome.storage.local.get('cache')).cache || null;
    renderBgtItems();
  }
  const setAllBgt = (on) => { for (const it of collectBgtItems()) bgtInclude[it.name] = on; renderBgtItems(); onBgtChanged(); };
  $('btnBgtAll').addEventListener('click', () => setAllBgt(true));
  $('btnBgtNone').addEventListener('click', () => setAllBgt(false));
  $('btnBgtRefresh').addEventListener('click', async () => {
    setStatus('bgtStatus', 'R&D ERP에서 불러오는 중…');
    const res = await chrome.runtime.sendMessage({ type: 'getData', force: true });
    await loadBgtItems();
    if (res && res.error) setStatus('bgtStatus', '오류: ' + res.error, true);
    else if (res && res.loginRequired) setStatus('bgtStatus', 'R&D ERP 로그인이 필요합니다. eClass의 R&D ERP 메뉴를 클릭해서 로그인한 뒤 다시 누르세요.', true);
    else setStatus('bgtStatus', '불러왔습니다.');
  });

  /* ---------- 과제별 카드 귀속 (계좌번호 규칙) ---------- */
  function renderIssued() {
    const box = $('issuedList');
    const all = (issued && issued.projects) || [];
    const projects = all.filter((p) => !excluded.has(p.prjNo));   // 과제 선택에서 뺀 과제는 여기서도 숨김
    const hidden = all.length - projects.length;
    let html = '';
    for (const p of projects) {
      const accts = (p.accounts || []).map((a) => `${F.esc(a.bank)} ${F.esc(a.acctNo)}${a.divNm ? ' (' + F.esc(a.divNm) + ')' : ''}`).join(', ');
      const acctLine = p.acctKnown ? `과제 계좌: ${accts}` : (p.acctError ? `과제 계좌 조회 오류: ${F.esc(p.acctError)}` : '과제 계좌 정보 없음 → 발급 카드 전체를 이 과제 카드로 봄');
      const rows = (p.cards || []).map((c) => {
        const on = isIncluded(p.prjNo, c);
        const match = c.acctMatch === true ? '<span class="mem-y">일치</span>' : c.acctMatch === false ? '<span class="mem-n">불일치</span>' : '<span class="muted">-</span>';
        return `<tr class="${on ? 'on' : ''}"><td><label><input type="checkbox" data-prj="${F.esc(p.prjNo)}" data-card="${F.esc(c.digits)}" data-match="${c.acctMatch === true ? '1' : c.acctMatch === false ? '0' : ''}" ${on ? 'checked' : ''}></label></td>
          <td class="card">${F.esc(c.cardNo)}</td><td>${F.esc(c.user)}</td><td>${F.esc(c.div)}</td><td>${F.esc(c.bank)} ${F.esc(c.acctNoRaw || '')}</td><td>${match}</td>
          <td>${F.esc(c.setlDd)}</td><td>${F.esc(F.fmtDate(c.issuDt))}</td></tr>`;
      }).join('');
      html += `<div class="issued-prj"><div class="issued-prj-head"><b>${F.esc(p.rspr || '-')}</b><span class="nm" title="${F.esc(p.prjNm)}">${F.esc(p.prjNm)}</span><span class="no">${F.esc(p.prjNo)}</span></div>
        <div class="issued-acct">${acctLine}</div>`;
      html += rows
        ? `<table class="issued-table"><thead><tr><th>포함</th><th>카드번호</th><th>사용자</th><th>과제카드구분</th><th>카드 계좌</th><th>계좌 일치</th><th>결제일</th><th>발급일</th></tr></thead><tbody>${rows}</tbody></table>`
        : `<div class="issued-empty">${p.error ? '조회 오류: ' + F.esc(p.error) : '발급된 카드 없음'}</div>`;
      html += `</div>`;
    }
    box.innerHTML = html || `<div class="issued-empty">${hidden
      ? '선택한 과제가 없습니다. 위 <b>과제 선택</b>에서 과제를 체크하세요.'
      : '발급 카드 목록이 없습니다. R&amp;D ERP에 로그인된 상태에서 <b>목록 새로고침</b>을 누르세요.'}</div>`;
    $('issuedInfo').textContent = issued && issued.ts ? `${projects.length}개 과제${hidden ? ` (제외 ${hidden}개 숨김)` : ''} · ${F.fmtClock(issued.ts)} 기준` : '';
    updateIssuedSummary();
    box.querySelectorAll('input[type=checkbox][data-card]').forEach((cb) => cb.addEventListener('change', () => {
      const ov = ovOf(cb.dataset.prj); const d = cb.dataset.card; const match = cb.dataset.match;
      ov.include.delete(d); ov.exclude.delete(d);
      if (cb.checked && match !== '1') ov.include.add(d);        // 불일치(또는 판정불가)인데 포함
      if (!cb.checked && match !== '0') ov.exclude.add(d);       // 일치(또는 판정불가)인데 제외
      cb.closest('tr').classList.toggle('on', cb.checked);
      updateIssuedSummary();
    }));
    renderMonitor();
    renderCardNames();
  }
  async function loadIssued() {
    issued = (await chrome.storage.local.get('issuedCards')).issuedCards || null;
    renderIssued();
  }
  $('btnIssuedRefresh').addEventListener('click', async () => {
    setStatus('issuedStatus', 'R&D ERP에서 불러오는 중…');
    const res = await chrome.runtime.sendMessage({ type: 'getData', force: true });
    await loadIssued();
    if (res && res.error) setStatus('issuedStatus', '오류: ' + res.error, true);
    else if (res && res.loginRequired) setStatus('issuedStatus', 'R&D ERP 로그인이 필요합니다. eClass의 R&D ERP 메뉴를 클릭해서 로그인한 뒤 다시 누르세요.', true);
    else setStatus('issuedStatus', '불러왔습니다.');
  });
  $('btnIssuedReset').addEventListener('click', () => { overrides = {}; renderIssued(); });

  /* ---------- 모니터링 카드 선택 (전체 공통 필터) ---------- */
  function renderMonitor() {
    const box = $('monitorList');
    const seen = new Map();
    for (const p of (issued && issued.projects) || []) for (const c of p.cards || []) {
      if (excluded.has(p.prjNo) || !isIncluded(p.prjNo, c)) continue;   // 제외 과제의 카드는 모니터링 대상이 아님
      if (!seen.has(c.digits)) seen.set(c.digits, { digits: c.digits, cardNo: c.cardNo, user: c.user, prjs: [] });
      seen.get(c.digits).prjs.push(p.rspr || p.prjNo);
    }
    const cards = Array.from(seen.values());
    const orphans = Array.from(selected).filter((d) => !seen.has(d));
    let rows = cards.map((c) => `<tr class="${selected.has(c.digits) ? 'on' : ''}"><td><label><input type="checkbox" data-mon="${F.esc(c.digits)}" ${selected.has(c.digits) ? 'checked' : ''}></label></td>
      <td class="card">${F.esc(c.cardNo)}</td><td>${F.esc(c.user)}</td><td>${F.esc(c.prjs.join(', '))}</td></tr>`).join('');
    rows += orphans.map((d) => `<tr class="on"><td><label><input type="checkbox" data-mon="${F.esc(d)}" checked></label></td><td class="card">${F.esc(F.cardTail(d, 8))}</td><td colspan="2" class="muted">목록에 없는 카드 (체크 해제 시 제거)</td></tr>`).join('');
    box.innerHTML = rows ? `<table class="issued-table"><thead><tr><th></th><th>카드번호</th><th>사용자</th><th>귀속 과제</th></tr></thead><tbody>${rows}</tbody></table>`
      : '<div class="issued-empty">귀속된 카드가 없습니다.</div>';
    box.querySelectorAll('input[type=checkbox][data-mon]').forEach((cb) => cb.addEventListener('change', () => {
      if (cb.checked) selected.add(cb.dataset.mon); else selected.delete(cb.dataset.mon);
      cb.closest('tr').classList.toggle('on', cb.checked);
      updateMonitorSummary();
    }));
    updateMonitorSummary();
  }
  $('cardFilterList').addEventListener('input', updateMonitorSummary);
  $('btnMonAll').addEventListener('click', () => { $('monitorList').querySelectorAll('input[type=checkbox][data-mon]').forEach((cb) => { cb.checked = true; cb.dispatchEvent(new Event('change')); }); });
  $('btnMonNone').addEventListener('click', () => { $('monitorList').querySelectorAll('input[type=checkbox][data-mon]').forEach((cb) => { cb.checked = false; cb.dispatchEvent(new Event('change')); }); });

  /* ---------- 카드 별명 (발급 카드 목록의 카드마다 입력, 목록에 없는 카드는 "뒷자리=별명" 직접 입력) ---------- */
  function renderCardNames() {
    const box = $('cardNameList');
    const seen = new Map();
    for (const p of (issued && issued.projects) || []) for (const c of p.cards || []) {
      if (!c.digits) continue;
      if (!seen.has(c.digits)) seen.set(c.digits, { digits: c.digits, cardNo: c.cardNo, user: c.user, prjs: [] });
      const nm = p.rspr || p.prjNo; if (!seen.get(c.digits).prjs.includes(nm)) seen.get(c.digits).prjs.push(nm);
    }
    const rows = Array.from(seen.values()).map((c) => `<tr class="${cardNames[c.digits] ? 'on' : ''}"><td class="card">${F.esc(c.cardNo)}</td><td>${F.esc(c.user)}</td><td>${F.esc(c.prjs.join(', '))}</td>
      <td><input type="text" class="nick" data-nick="${F.esc(c.digits)}" value="${F.esc(cardNames[c.digits] || '')}" placeholder="별명" maxlength="30"></td></tr>`).join('');
    box.innerHTML = rows ? `<table class="issued-table"><thead><tr><th>카드번호</th><th>사용자</th><th>귀속 과제</th><th>별명</th></tr></thead><tbody>${rows}</tbody></table>`
      : '<div class="issued-empty">발급 카드 목록이 없습니다. 위 <b>과제별 카드 귀속</b>의 목록 새로고침을 누르거나 아래에 직접 입력하세요.</div>';
    const extra = Object.entries(cardNames).filter(([k]) => !seen.has(k));   // 목록에 없는 카드의 별명은 직접 입력 칸에
    if (document.activeElement !== $('cardNameExtra')) $('cardNameExtra').value = extra.map(([k, v]) => `${F.cardTail(k, 8)}=${v}`).join('\n');
    box.querySelectorAll('input[data-nick]').forEach((inp) => inp.addEventListener('input', () => {
      const v = inp.value.trim();
      if (v) cardNames[inp.dataset.nick] = v; else delete cardNames[inp.dataset.nick];
      inp.closest('tr').classList.toggle('on', !!v);
      updateNamesSummary(); scheduleSaveNames();
    }));
    updateNamesSummary();
  }
  function parseExtraNames(text) {
    const out = {};
    for (const line of String(text || '').split(/\r?\n/)) {
      const m = line.match(/^\s*([\d\-\s*]+?)\s*=\s*(.+?)\s*$/); if (!m) continue;
      const k = F.digits(m[1]); if (k.length >= 4) out[k] = m[2];
    }
    return out;
  }
  $('cardNameExtra').addEventListener('input', () => {
    const listed = new Set(Array.from($('cardNameList').querySelectorAll('input[data-nick]')).map((i) => i.dataset.nick));
    for (const k of Object.keys(cardNames)) if (!listed.has(k)) delete cardNames[k];
    Object.assign(cardNames, parseExtraNames($('cardNameExtra').value));
    updateNamesSummary(); scheduleSaveNames();
  });
  function updateNamesSummary() { const n = Object.keys(cardNames).length; $('namesSummary').textContent = n ? `${n}장` : ''; }
  function scheduleSaveNames() { clearTimeout(namesTimer); namesTimer = setTimeout(saveCardNames, 600); }
  async function saveCardNames() {
    try {
      const cur = await S.load();
      cur.cardNames = Object.assign({}, cardNames);
      await S.save(cur);
      setStatus('namesStatus', '적용했습니다. 패널은 자동으로 다시 조회됩니다.');
    } catch (e) { setStatus('namesStatus', '적용 실패: ' + String((e && e.message) || e), true); }
  }

  /* ---------- 폼 ---------- */
  async function showRndUser() {
    const u = (await chrome.storage.local.get('rndUser')).rndUser;
    $('rndUserInfo').textContent = u ? `${u.userNm || ''} (USER_ID ${u.userId || '-'}${u.empNo ? ', EMP_NO ' + u.empNo : ''}) · ${F.fmtClock(u.ts)} 기록` : 'R&D ERP를 열면 로그인 사용자 정보가 자동으로 기록됩니다.';
  }

  /* 동명이인 후보 (cache.nameCandidates): 이름으로만 대조했는데 같은 이름의 사번이 둘 이상이면 고르게 한다. 고르면 myEmpNo 저장 → 백그라운드가 다시 조회 */
  async function showNameCandidates() {
    const box = $('nameCandidates');
    const d = (await chrome.storage.local.get('cache')).cache || null;
    const cands = (d && d.nameCandidates) || [];
    if (!d || d.memberFilter !== 'ambiguous' || cands.length < 2) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = `<b>동명이인 ${cands.length}명</b> — 이름 "${F.esc((d.myNames || []).join(', '))}"이(가) 참여인력에 여러 사번으로 있어 과제를 표시하지 않고 있습니다. 본인을 고르세요.<br>` +
      cands.map((c) => `<label class="check"><input type="radio" name="nameCand" value="${F.esc(c.empNo || '')}"> ${F.esc(c.empNm)} · 사번 <b>${F.esc(c.empNo || '?')}</b>${c.roles && c.roles.length ? ' · ' + F.esc(c.roles.join('/')) : ''} · 과제 ${c.projects.length}건 <span class="muted">(${F.esc(c.projects.slice(0, 3).map((p) => (p.rspr ? p.rspr + ' ' : '') + p.prjNm).join(' / '))}${c.projects.length > 3 ? ' …' : ''})</span></label>`).join('');
    box.querySelectorAll('input[name=nameCand]').forEach((r) => r.addEventListener('change', async () => {
      if (!r.value) return;
      $('myEmpNo').value = r.value;
      try {
        const cur = await S.load();
        cur.myEmpNo = r.value;
        cur.myName = $('myName').value.trim() || cur.myName;
        await S.save(cur);
        setStatus('saveStatus', `사번 ${r.value}로 저장했습니다. 참여 과제를 다시 조회합니다.`);
      } catch (e) { setStatus('saveStatus', String(e.message || e), true); }
    }));
  }

  function fill(s) {
    $('eclassPanel').checked = s.eclassPanel !== false;
    togglePanelModeBox();
    document.querySelector(`input[name=panelMode][value="${s.panelMode === 'float' ? 'float' : 'inline'}"]`).checked = true;
    $('actionPopup').checked = !!s.actionPopup;
    $('onlyMyProjects').checked = !!s.onlyMyProjects;
    $('myEmpNo').value = s.myEmpNo || '';
    $('myName').value = s.myName || '';
    excluded = new Set((s.excludedProjects || []).map((x) => String(x).trim()).filter(Boolean));
    renderProjects();
    $('accountRule').checked = s.accountRule !== false;
    $('showShared').checked = !!s.showShared;
    overrides = {};
    for (const [prjNo, ov] of Object.entries(s.cardOverrides || {})) {
      overrides[prjNo] = { include: new Set((ov.include || []).map(F.digits)), exclude: new Set((ov.exclude || []).map(F.digits)) };
    }
    document.querySelector(`input[name=cardFilterMode][value="${s.cardFilterMode === 'specific' ? 'specific' : 'all'}"]`).checked = true;
    selected = new Set((s.selectedCards || []).map((x) => F.digits(x)).filter(Boolean));
    cardNames = Object.assign({}, s.cardNames || {});
    renderIssued();
    $('cardFilterList').value = (s.cardFilterList || []).join('\n');
    $('monthsBack').value = s.monthsBack;
    $('monthsForward').value = s.monthsForward;
    $('maxProjects').value = s.maxProjects;
    $('refreshMinutes').value = s.refreshMinutes;
    $('autoRefresh').checked = !!s.autoRefresh;
    $('hideZeroProjects').checked = !!s.hideZeroProjects;
    $('projectStatusKeyword').value = s.projectStatusKeyword == null ? '진행' : s.projectStatusKeyword;
    $('rndUrl').value = s.rndUrl || '';
    $('rndAutoLogin').checked = s.rndAutoLogin !== false;
    $('prjPicker').checked = s.prjPicker !== false;
    const pl = Object.assign({}, S.DEFAULTS.plus, s.plus || {});   // 공유 (Plus) — 과제별 공유 폴더 (SharePoint/OneDrive)
    $('plusEnabled').checked = !!pl.enabled;
    savedFolder = String(pl.folder || '').trim();   // 밑폴더 주소 — 비면 내 OneDrive 의 문서/업무/shared (백그라운드 KRX_SP.resolveMyFolder)
    $('plusFolder').value = savedFolder;
    $('plusPlanSync').checked = pl.planSync !== false;
    $('plusResearchSync').checked = pl.researchSync !== false;   // 연구내용 · 사업비 동기화 (0.8.7)
    $('plusStaffSync').checked = pl.staffSync !== false;
    $('plusChangesSync').checked = pl.changesSync !== false;     // 변경이력 (v2 연차 파일의 changes)
    $('plusSitesSync').checked = pl.sitesSync !== false;         // 전체 공유 › 자주 사용 가맹점 (밑폴더/common/가맹점.json, 2026-10-22)
    $('plusProjectSync').checked = pl.projectSync !== false;     // 과제별 공유 켜기 (2026-10-22)
    setShareScope(pl.scope === 'pick' ? 'pick' : 'all');         // 공유할 과제 — 전체 / 고른 과제만
    sharePrjSel = new Set((Array.isArray(pl.projects) ? pl.projects : []).map(String));
    renderSharePrj();
    setSitesScope(pl.sitesScope === 'pick' ? 'pick' : 'all');    // 전체 공유 › 가맹점을 공유할 과제 — 전체 / 고른 과제만 (2026-10-22)
    sitesPrjSel = new Set((Array.isArray(pl.sitesProjects) ? pl.sitesProjects : []).map(String));
    renderSitesPrj();
    $('plusDiscover').checked = pl.discover !== false;           // 나와 공유된 과제 폴더 자동 찾기 (기본 켬)
    $('plusShareWith').checked = String(pl.shareWith || 'participants') !== 'none';   // 폴더를 만들 때 참여연구원에게 자동 공유 ('participants' | 'none')
    updateShareSummary();
    renderFetchShare();   // 자주 사용 가맹점 아래 공유 줄 (공유 (Plus) 의 가맹점 파일)
    renderShareFolder();
    const hp = Object.assign({}, S.DEFAULTS.help, s.help || {});   // Help Chat (로컬 Help 서버)
    $('helpEnabled').checked = hp.enabled !== false;
    $('helpUrl').value = hp.url || '';
    $('teamsMcpUrl').value = ((s.teams || {}).mcpUrl) || S.DEFAULTS.teams.mcpUrl;   // 팀즈 MCP (lib/teams-mcp.js)
    $('teamsTemplate').value = (s.teams || {}).template || '';   // 팀즈 글 템플릿 — 비면 기본(placeholder 는 lib/collect.js TEMPLATE)
    if (typeof KRX_COLLECT !== 'undefined') $('teamsTemplate').placeholder = KRX_COLLECT.TEMPLATE;
    $('helpAutoPick').checked = hp.autoPick !== false;
    $('helpAutoPtcl').checked = hp.autoPtcl !== false;   // 비어 있는 청구내역을 Claude 가 씀 (연구내용 참조)
    $('helpPtclGuide').value = hp.ptclGuide || '';
    $('helpFetch').checked = hp.fetch !== false;   // 증빙 찾아오기 켜기 (LLM 설정 탭 — 가맹점 등록도 같은 탭)
    const ha = Object.assign({}, S.DEFAULTS.help.api, hp.api || {});   // Claude API 사용 방식·모델 (키는 storage.local — loadApiKey)
    const useV = ['auto', 'always', 'off'].includes(ha.use) ? ha.use : 'auto';   // 연결 방식 카드(#llmWayCard)의 라디오
    document.querySelectorAll('input[name=apiUse]').forEach((r) => { r.checked = r.value === useV; });
    setApiModel(ha.model);
    for (const [k] of KRX_SITES.KINDS) $('fetchDocs_' + k).value = KRX_SITES.docsFor(k, hp.fetchDocs).join(', ');   // 종류별 필요 서류
    const ch = Object.assign({}, S.DEFAULTS.claimHelper, s.claimHelper || {});
    $('chEnabled').checked = ch.enabled !== false;
    $('chDefaultBudget').value = ch.defaultBudget || '';
    $('chDefaultRcms').value = ch.defaultRcms || '';
    $('chMeetingPlace').value = ch.meetingPlace == null ? (S.DEFAULTS.claimHelper.meetingPlace || '') : ch.meetingPlace;
    $('chDragDrop').checked = ch.dragDrop !== false;
    $('chQuickPicks').value = (Array.isArray(ch.quickPicks) ? ch.quickPicks : []).join('\n');
    $('chAttachKinds').value = (Array.isArray(ch.attachKinds) ? ch.attachKinds : (S.DEFAULTS.claimHelper.attachKinds || [])).join('\n');
    toggleClaimBox();
    const h = Object.assign({}, S.DEFAULTS.hr, s.hr || {});
    $('hrEnabled').checked = h.enabled !== false;
    $('hrAutoLogin').checked = h.autoLogin !== false;
    $('hrGrade').value = String(h.grade || '').toUpperCase();
    $('hrRates').value = Object.entries(h.gradeRates || {}).map(([k, v]) => `${k}=${v}`).join('\n');
    $('hrBaseItem').value = h.baseItem || '';
    $('hrResearchItem').value = h.researchItem || '';
    $('hrUrl').value = h.url || '';
    const rc = Object.assign({}, S.DEFAULTS.rcms, s.rcms || {});   // RCMS 열기 · 자동 로그인 (ID·비밀번호는 settings 가 아니라 storage.local.rcmsCred — loadRcmsCred)
    $('rcmsAutoLogin').checked = rc.autoLogin !== false;
    $('rcmsUrl').value = rc.url || '';
    updateRcmsSummary();
    bgtInclude =Object.assign({}, s.budgetItemInclude || {});
    bgtDefaultKeys = (s.budgetExcludeDefault || []).map(normNm).filter(Boolean);
    renderBgtItems();
    const u = s.unapproved || {};
    $('unapServiceId').value = u.serviceId || '';
    $('unapInput').value = u.input || '{}';
    $('unapSupplement').value = (u.fields && u.fields.supplement) || '';
    $('unapApply').value = (u.fields && u.fields.apply) || '';
    $('unapTemp').value = (u.fields && u.fields.temp) || '';
    $('unapPurchase').value = (u.fields && u.fields.purchase) || '';
    $('unapSummary').textContent = u.serviceId ? `설정됨 · ${u.serviceId}` : '미설정 (메인화면 방문 시 화면값 사용)';
    const a = s.adv || {};
    const advChanged = Object.keys(S.DEFAULTS.adv).some((k) => a[k] != null && String(a[k]) !== String(S.DEFAULTS.adv[k]));
    $('advSummary').textContent = advChanged ? '기본값에서 변경됨' : '기본값';
    $('advUsefac').value = a.usefacSeqNo || '';
    $('advProjectsService').value = a.projectsService || '';
    $('advProjectsInput').value = a.projectsInput || '';
    $('advProjectsFallbackService').value = a.projectsFallbackService || '';
    $('advCardsService').value = a.cardsService || '';
    $('advCardsInput').value = a.cardsInput || '';
    $('advIssuedService').value = a.issuedService || '';
    $('advAccountsService').value = a.accountsService || '';
    $('advExpenseAcctDivCd').value = a.expenseAcctDivCd || '';
    $('advParticipantsService').value = a.participantsService || '';
    $('advParticipantsInput').value = a.participantsInput || '';
    $('advBudgetService').value = a.budgetService == null ? S.DEFAULTS.adv.budgetService : a.budgetService;
    $('advBudgetInput').value = a.budgetInput || S.DEFAULTS.adv.budgetInput;
    $('advBudgetBaseService').value = a.budgetBaseService == null ? S.DEFAULTS.adv.budgetBaseService : a.budgetBaseService;
    $('advProjectDetailService').value = a.projectDetailService == null ? S.DEFAULTS.adv.projectDetailService : a.projectDetailService;
    toggleCardList();
  }

  function read() {
    const mode = document.querySelector('input[name=cardFilterMode]:checked').value;
    const num = (id, def) => { const v = Number($(id).value); return Number.isFinite(v) && v >= 0 ? v : def; };
    const checkJson = (id) => { try { JSON.parse($(id).value || '{}'); } catch (e) { throw new Error(`${id}: JSON 형식이 올바르지 않습니다.`); } };
    checkJson('unapInput'); checkJson('advProjectsInput'); checkJson('advCardsInput'); checkJson('advParticipantsInput'); checkJson('advBudgetInput');
    const cardOverrides = {};
    for (const [prjNo, ov] of Object.entries(overrides)) {
      if (ov.include.size || ov.exclude.size) cardOverrides[prjNo] = { include: Array.from(ov.include), exclude: Array.from(ov.exclude) };
    }
    return S.merge(S.DEFAULTS, {
      eclassPanel: $('eclassPanel').checked,
      panelMode: document.querySelector('input[name=panelMode]:checked').value,
      actionPopup: $('actionPopup').checked,
      accountRule: $('accountRule').checked,
      showShared: $('showShared').checked,
      cardOverrides,
      cardFilterMode: mode,
      selectedCards: Array.from(selected),
      cardFilterList: F.parseList($('cardFilterList').value),
      cardNames: Object.assign({}, cardNames),
      monthsBack: num('monthsBack', 6),
      monthsForward: num('monthsForward', 1),
      maxProjects: num('maxProjects', 30) || 30,
      refreshMinutes: num('refreshMinutes', 10) || 10,
      autoRefresh: $('autoRefresh').checked,
      hideZeroProjects: $('hideZeroProjects').checked,
      projectStatusKeyword: $('projectStatusKeyword').value.trim(),
      budgetItemInclude: Object.assign({}, bgtInclude),   // 비목 선택 구역에서 고른 포함/제외 (체크 변경 시 즉시 저장되기도 함)
      excludedProjects: Array.from(excluded),
      onlyMyProjects: $('onlyMyProjects').checked,
      myEmpNo: $('myEmpNo').value.trim(),
      myName: $('myName').value.trim(),
      rndUrl: $('rndUrl').value.trim() || S.DEFAULTS.rndUrl,
      rndAutoLogin: $('rndAutoLogin').checked,
      prjPicker: $('prjPicker').checked,
      plus: {   // 공유 (Plus) — driveHost 는 칸이 없어 저장하지 않음 (lib/settings.js 가 기본값으로 채움)
        enabled: $('plusEnabled').checked,
        folder: $('plusFolder').value.trim(),   // '' = 내 OneDrive 의 문서/업무/shared (밑폴더)
        planSync: $('plusPlanSync').checked, researchSync: $('plusResearchSync').checked, staffSync: $('plusStaffSync').checked, changesSync: $('plusChangesSync').checked, sitesSync: $('plusSitesSync').checked,
        projectSync: $('plusProjectSync').checked, scope: shareScopeVal(), projects: Array.from(sharePrjSel),   // 과제별 공유 · 공유할 과제(전체 / 고른 과제만 — #plusPrjPick)
        sitesScope: sitesScopeVal(), sitesProjects: Array.from(sitesPrjSel),                                 // 전체 공유 › 가맹점을 공유할 과제(#plusSitesPrjPick)
        discover: $('plusDiscover').checked,                                        // 나와 공유된 과제 폴더 자동 찾기
        shareWith: $('plusShareWith').checked ? 'participants' : 'none'             // 과제 폴더를 만들 때 참여연구원에게 자동 공유(편집)
      },
      teams: { mcpUrl: teamsBase(), template: $('teamsTemplate').value.trim().slice(0, 600) },   // 팀즈 MCP 주소(이 PC 만) · 팀즈 글 템플릿(자리표 — lib/collect.js)
      help: { enabled: $('helpEnabled').checked, url: $('helpUrl').value.trim().replace(/\/+$/, '') || S.DEFAULTS.help.url, autoPick: $('helpAutoPick').checked,
        autoPtcl: $('helpAutoPtcl').checked, ptclGuide: $('helpPtclGuide').value.trim().slice(0, 300), fetch: $('helpFetch').checked, fetchDocs: kindDocsNow(),
        api: { use: apiUseVal(), model: $('apiModel').value || S.DEFAULTS.help.api.model } },
      claimHelper: {
        enabled: $('chEnabled').checked,
        defaultBudget: $('chDefaultBudget').value.trim(),
        defaultRcms: $('chDefaultRcms').value.trim(),
        meetingPlace: $('chMeetingPlace').value.trim(),
        dragDrop: $('chDragDrop').checked,
        quickPicks: $('chQuickPicks').value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean),
        attachKinds: $('chAttachKinds').value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
      },
      hr: {
        enabled: $('hrEnabled').checked,
        autoLogin: $('hrAutoLogin').checked,
        grade: $('hrGrade').value.trim().toUpperCase(),
        gradeRates: parseRates($('hrRates').value),
        baseItem: $('hrBaseItem').value.trim() || S.DEFAULTS.hr.baseItem,
        researchItem: $('hrResearchItem').value.trim() || S.DEFAULTS.hr.researchItem,
        url: $('hrUrl').value.trim() || S.DEFAULTS.hr.url
      },
      rcms: { autoLogin: $('rcmsAutoLogin').checked, url: $('rcmsUrl').value.trim() || S.DEFAULTS.rcms.url },
      unapproved: {
        serviceId: $('unapServiceId').value.trim(),
        input: $('unapInput').value.trim() || '{}',
        fields: { supplement: $('unapSupplement').value.trim(), apply: $('unapApply').value.trim(), temp: $('unapTemp').value.trim(), purchase: $('unapPurchase').value.trim() }
      },
      adv: {
        usefacSeqNo: $('advUsefac').value.trim() || '10',
        projectsService: $('advProjectsService').value.trim() || S.DEFAULTS.adv.projectsService,
        projectsInput: $('advProjectsInput').value.trim() || '{}',
        projectsFallbackService: $('advProjectsFallbackService').value.trim(),
        cardsService: $('advCardsService').value.trim() || S.DEFAULTS.adv.cardsService,
        cardsInput: $('advCardsInput').value.trim() || '{}',
        issuedService: $('advIssuedService').value.trim() || S.DEFAULTS.adv.issuedService,
        accountsService: $('advAccountsService').value.trim() || S.DEFAULTS.adv.accountsService,
        expenseAcctDivCd: $('advExpenseAcctDivCd').value.trim(),
        participantsService: $('advParticipantsService').value.trim() || S.DEFAULTS.adv.participantsService,
        participantsInput: $('advParticipantsInput').value.trim() || S.DEFAULTS.adv.participantsInput,
        budgetService: $('advBudgetService').value.trim(),            // 비우면 과제집행비율 조회 안 함
        budgetInput: $('advBudgetInput').value.trim() || S.DEFAULTS.adv.budgetInput,
        budgetBaseService: $('advBudgetBaseService').value.trim() || S.DEFAULTS.adv.budgetBaseService,
        projectDetailService: $('advProjectDetailService').value.trim()   // 비우면 본예산 대체 조회 안 함
      }
    });
  }

  /* cardOverrides 는 저장 시 { include: [...], exclude: [...] } 로 직렬화되며, merge()가 Set 을 건드리지 않도록 read() 안에서 배열로 변환 */

  function toggleCardList() {
    const specific = document.querySelector('input[name=cardFilterMode]:checked').value === 'specific';
    $('monitorBox').style.opacity = specific ? '1' : '.45';
    $('monitorBox').style.pointerEvents = specific ? '' : 'none';
    updateMonitorSummary();
  }
  document.querySelectorAll('input[name=cardFilterMode]').forEach((r) => r.addEventListener('change', toggleCardList));

  /* eClass 표시: 패널을 표시하지 않으면 위치 선택을 흐리게 */
  function togglePanelModeBox() {
    const on = $('eclassPanel').checked;
    $('panelModeBox').style.opacity = on ? '1' : '.45';
    $('panelModeBox').style.pointerEvents = on ? '' : 'none';
  }
  $('eclassPanel').addEventListener('change', togglePanelModeBox);

  /* 청구서(카드) 입력 도우미: 사용 안 함이면 세부 항목을 흐리게 */
  function toggleClaimBox() {
    const on = $('chEnabled').checked;
    $('chBox').style.opacity = on ? '1' : '.45';
    $('chBox').style.pointerEvents = on ? '' : 'none';
  }
  $('chEnabled').addEventListener('change', toggleClaimBox);
  /* 청구 준비(패널에서 고른 청구종류·첨부 파일, storage.local.claimPrep + 확장 IndexedDB) 저장 현황 · 모두 지우기 */
  async function loadPrepStats() {
    try {
      const st = await chrome.runtime.sendMessage({ type: 'prepStats' });
      const mb = st && st.bytes ? (st.bytes / 1048576).toFixed(1) : '0';
      $('prepStats').textContent = st && st.entries ? `저장된 청구 준비 ${st.entries}건 · 파일 ${st.files}개 (${mb}MB)` : '저장된 청구 준비 없음';
    } catch (e) { $('prepStats').textContent = ''; }
  }
  $('btnPrepClear').addEventListener('click', async () => {
    if (!confirm('패널에서 준비한 청구종류·첨부 파일을 모두 지울까요? (R&D ERP 에는 영향 없음)')) return;
    try { await chrome.runtime.sendMessage({ type: 'prepClearAll' }); setStatus('prepStatus', '지웠습니다'); }
    catch (e) { setStatus('prepStatus', '실패: ' + String((e && e.message) || e), true); }
    loadPrepStats();
  });
  loadPrepStats();
  try { chrome.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch.claimPrep) loadPrepStats(); }); } catch (e) {}

  /* ---------- 연구개발계획서 (연구내용 참조, 0.8.5 — lib/research.js): KR_<과제>.yaml 을 끌어다 놓기(페이지 어디든)·붙여 넣기(Ctrl+V, 파일이나 글)·눌러서 고르기로 넣어
   * storage.local.researchPlans 에 둔다. YAML 은 vendor/yaml(npm yaml 2.9.1 브라우저 빌드, ES 모듈)을 처음 넣을 때만 읽어 들인다.
   * 과제명으로 R&D ERP 과제(projectList + 패널 캐시)에 잇고(과제 목록이 바뀌면 다시), 표의 select 로 고르면 linkBy 'user' 로 고정 ---------- */
  const RS = KRX_RESEARCH;
  let research = {};
  const rsOpen = new Set();   // 글을 펼친 계획서 id
  let yamlLib = null;
  const loadYaml = async () => (yamlLib = yamlLib || await import(chrome.runtime.getURL('vendor/yaml/index.js')));
  const isYaml = (f) => /\.ya?ml$/i.test((f && f.name) || '') || /yaml/i.test((f && f.type) || '');
  async function rsProjects() {
    try { const l = await chrome.storage.local.get(['projectList', 'cache']); return RS.uniq(((l.projectList && l.projectList.projects) || []).concat((l.cache && l.cache.projects) || [])); } catch (e) { return []; }
  }
  function rsStatus(text, isErr) { const el = $('researchStatus'); el.textContent = text || ''; el.classList.toggle('err', !!isErr); }

  function renderResearch(ps) {
    const recs = Object.values(research).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, 'ko') || a.n - b.n);
    const opts = (r) => {
      const has = ps.some((p) => p.prjNo === r.prjNo);
      return '<option value="">(잇지 않음)</option>' + ps.map((p) => `<option value="${F.esc(p.prjNo)}"${p.prjNo === r.prjNo ? ' selected' : ''}>${F.esc(p.prjNo)} ${F.esc((p.prjNm || '').slice(0, 44))}</option>`).join('')
        + (r.prjNo && !has ? `<option value="${F.esc(r.prjNo)}" selected>${F.esc(r.prjNo)} ${F.esc(r.prjNm || '(과제 목록에 없음)')}</option>` : '');
    };
    const rows = recs.map((r) => {
      const meta = [r.code, r.goals.length ? `목표 ${r.goals.length}` : '', r.spend.length ? `연구활동비 계획 ${r.spend.length}건 · ${F.money(RS.spendTotal(r))}원` : ''].filter(Boolean).join(' · ');
      const how = r.linkBy === 'user' ? '직접 고른 과제' : r.linkBy === 'auto' ? '과제명으로 저절로 이은 과제' : 'R&D ERP 과제 목록에서 과제명을 찾지 못했습니다 — 고르세요';
      const open = rsOpen.has(r.id);
      return `<tr class="${r.prjNo ? '' : 'rs-unlinked'}"><td class="nm">${F.esc(r.name)}<span class="muted">${F.esc(meta)}</span></td>
        <td class="tag">${r.n}차년도${r.rev ? ` ${F.esc(r.rev)}` : ''}${r.src ? '<span class="rs-src" title="공유 (Plus) 의 과제 파일에서 받은 것 — 동료가 넣은 기록">공유</span>' : ''}</td>
        <td class="erp"><select data-rs-link="${F.esc(r.id)}" title="${F.esc(how)}">${opts(r)}</select></td>
        <td class="tag" title="${F.esc(`${r.src ? '공유 파일에서 받음 · ' : ''}${r.file ? `파일 ${r.file}` : '붙여 넣은 글'}`)}">${F.esc(F.fmtClock(r.at))}</td>
        <td class="tag"><button type="button" class="btn" data-rs-view="${F.esc(r.id)}">${open ? '접기' : '보기'}</button> <button type="button" class="btn danger" data-rs-del="${F.esc(r.id)}">빼기</button></td></tr>`
        + (open ? `<tr class="rs-text"><td colspan="5"><pre>${F.esc(RS.textOf(r))}</pre></td></tr>` : '');
    }).join('');
    $('researchList').innerHTML = rows ? `<div class="prj-list"><table class="prj-table rs-table"><thead><tr><th>과제 (계획서)</th><th>차년도</th><th>R&amp;D ERP 과제</th><th>넣은 때</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '';
    const unlinked = recs.filter((r) => !r.prjNo).length;
    $('researchSummary').textContent = recs.length ? `${recs.length}개${unlinked ? ` · 잇지 않음 ${unlinked}` : ''}` : '';
  }
  /* 저장된 계획서를 읽어 과제 목록에 다시 잇고(바뀌었으면 저장) 그린다 — 처음 · 과제 목록이 바뀔 때 · 다른 창에서 넣고 뺄 때 */
  async function loadResearch() {
    research = await RS.load();
    const ps = await rsProjects();
    if (RS.link(research, ps)) await RS.save(research);
    renderResearch(ps);
  }

  /* items: [{ name(파일 이름, 붙여 넣은 글이면 ''), text }] — 풀고, 스냅샷만 판 차례(r0 → rN)로 넣고, 잇고, 저장. 결과는 넣은 칸 밑에 한 줄씩 */
  async function intakeResearch(items) {
    if (!items.length) return;
    const drop = $('researchDrop');
    drop.classList.add('busy');
    $('researchCard').open = true;
    const lines = [], done = [];
    let bad = 0;
    try {
      const { parse } = await loadYaml();
      const docs = [];
      for (const it of items) {
        const what = it.name || '붙여 넣은 글';
        let o;
        try { o = parse(it.text); } catch (e) { lines.push(`${what}: YAML 을 읽지 못했습니다 — ${String((e && e.message) || e).split('\n')[0]}`); bad++; continue; }
        const kind = RS.kindOf(o);
        if (kind === 'history') { lines.push(`${what}: history 이력 파일은 쓰지 않습니다 — 같은 폴더의 KR_<과제>.yaml(재생성본이 있으면 마지막 _rN)을 넣으세요`); continue; }
        if (kind !== 'snapshot') { lines.push(`${what}: 연구개발계획서 스냅샷(meta.과제명)이 아닙니다`); bad++; continue; }
        try { docs.push({ what, rec: RS.readSnapshot(o, { text: it.text, file: it.name }) }); } catch (e) { lines.push(`${what}: ${e.message}`); bad++; }
      }
      docs.sort((a, b) => RS.revNo(a.rec.rev) - RS.revNo(b.rec.rev));   // 같은 과제·차년도의 판이 섞여 와도 최종본이 남게
      const map = await RS.load();   // 다른 창에서 바뀌었을 수 있어 넣기 직전에 다시 읽는다
      for (const d of docs) {
        const r = RS.put(map, d.rec);
        if (r.state === 'older') lines.push(`${d.what}: ${d.rec.name} ${d.rec.n}차년도에는 이미 ${r.prev.rev} 가 들어 있어 더 오래된 ${d.rec.rev || '판'} 는 넣지 않았습니다`);
        else done.push({ d, state: r.state });
      }
      if (done.length) {
        const ps = await rsProjects();
        RS.link(map, ps);
        await RS.save(map);
        research = map;
        try { const q = chrome.runtime.sendMessage({ type: 'planSyncQueue', reason: 'edit' }); if (q && q.catch) q.catch(() => {}); } catch (e) {}   // 공유 (Plus) 가 켜져 있으면 연구내용을 과제별 공유 파일에 (background.js shareSync — 꺼져 있으면 무시)
        for (const { d, state } of done) {
          const rec = map[d.rec.id];
          const where = rec.prjNo ? `${rec.prjNo} 에 이음` : 'R&D ERP 과제를 찾지 못함 — 아래 표에서 고르세요';
          const what = [rec.goals.length ? `목표 ${rec.goals.length}` : '', rec.spend.length ? `연구활동비 계획 ${rec.spend.length}건` : ''].filter(Boolean).join(' · ');
          lines.unshift(`${rec.name} ${rec.n}차년도${rec.rev ? ` ${rec.rev}` : ''} ${state === 'added' ? '넣음' : '바꿈'} → ${where}${what ? ` · ${what}` : ''}`);
        }
        renderResearch(ps);
      }
      rsStatus(lines.join('\n'), !done.length && bad > 0);
    } catch (e) {
      rsStatus(`${lines.length ? lines.join('\n') + '\n' : ''}넣지 못했습니다: ${String((e && e.message) || e)}`, true);
    } finally { drop.classList.remove('busy'); }
  }
  async function intakeFiles(files) {
    const list = Array.from(files || []);
    const yaml = list.filter(isYaml);
    if (!yaml.length) { $('researchCard').open = true; rsStatus('YAML 파일(.yaml · .yml)만 넣을 수 있습니다 — RND 폴더의 KR_<과제>.yaml', true); return; }
    const items = [];
    for (const f of yaml) { try { items.push({ name: f.name, text: await f.text() }); } catch (e) { rsStatus(`${f.name}: 파일을 읽지 못했습니다`, true); return; } }
    await intakeResearch(items);
  }

  $('researchFile').addEventListener('change', () => { const files = Array.from($('researchFile').files || []); $('researchFile').value = ''; intakeFiles(files); });
  $('researchDrop').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('researchFile').click(); } });
  // 끌어다 놓기는 페이지 어디에 놓아도 된다 — 파일을 놓으면 브라우저가 그 파일로 넘어가 버리므로 페이지 전체에서 받는다
  const hasFiles = (e) => Array.from((e.dataTransfer && e.dataTransfer.types) || []).includes('Files');
  document.addEventListener('dragover', (e) => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; $('researchDrop').classList.add('over'); });
  document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) $('researchDrop').classList.remove('over'); });
  document.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    $('researchDrop').classList.remove('over');
    intakeFiles(e.dataTransfer.files);
    showTab('main');   // LLM 설정 탭에 놓아도 결과는 일반 설정 탭의 연구개발계획서 구역에
    $('researchCard').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  // 붙여 넣기: 입력 칸이 아닌 곳에서 Ctrl+V — 복사한 YAML 파일, 또는 meta: 로 시작하는 줄이 있는 글
  document.addEventListener('paste', (e) => {
    const t = e.target;
    if (t && t !== $('researchDrop') && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const files = Array.from((e.clipboardData && e.clipboardData.files) || []).filter(isYaml);
    if (files.length) { e.preventDefault(); showTab('main'); intakeFiles(files); return; }
    const text = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
    if (/^meta\s*:/m.test(text)) { e.preventDefault(); showTab('main'); intakeResearch([{ name: '', text }]); }
  });
  $('researchList').addEventListener('change', async (e) => {
    const sel = e.target.closest('select[data-rs-link]');
    if (!sel) return;
    const map = await RS.load();
    const rec = map[sel.dataset.rsLink];
    if (!rec) return;
    const p = (await rsProjects()).find((x) => x.prjNo === sel.value);
    Object.assign(rec, { prjNo: sel.value, prjNm: p ? p.prjNm : '', linkBy: 'user' });   // 비워도 'user' — 다시 저절로 잇지 않게
    await RS.save(map);
    rsStatus(sel.value ? `${rec.name} ${rec.n}차년도 → ${sel.value} 에 이음` : `${rec.name} ${rec.n}차년도 — 잇지 않음`);
  });
  $('researchList').addEventListener('click', async (e) => {
    const view = e.target.closest('[data-rs-view]'), del = e.target.closest('[data-rs-del]');
    if (view) { const id = view.dataset.rsView; if (rsOpen.has(id)) rsOpen.delete(id); else rsOpen.add(id); renderResearch(await rsProjects()); }
    if (del) {
      const map = await RS.load();
      const rec = map[del.dataset.rsDel];
      if (!rec || !confirm(`${rec.name} ${rec.n}차년도 연구개발계획서를 뺄까요? (파일을 다시 넣으면 돌아옵니다${rec.src ? ' — 공유 파일에서 받은 것이라 공유 (Plus) 가 켜져 있으면 다음 동기화 때 다시 올 수 있습니다' : ''})`)) return;
      delete map[rec.id];
      await RS.save(map);
      rsStatus(`${rec.name} ${rec.n}차년도 뺌`);
    }
  });
  try {
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area === 'local' && (ch[RS.KEY] || ch.projectList || (ch.cache && ch.cache.newValue))) loadResearch().catch(() => {});
    });
  } catch (e) {}

  $('form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try { await saveFetchSites(); await S.save(read()); await saveRcmsCred(); await saveApiKey(); savedFolder = $('plusFolder').value.trim(); renderShareFolder(); setStatus('saveStatus', '저장했습니다. eClass 화면은 자동으로 다시 조회됩니다.'); }   // 공유 폴더 주소도 저장됐으니 "주소가 바뀌었습니다" 안내를 거둠 (공유 (Plus) 절)
    catch (e) { setStatus('saveStatus', String(e.message || e), true); }
  });

  /* ---------- RCMS 열기 · 자동 로그인: ID·비밀번호는 동기화되는 settings 대신 이 브라우저의 storage.local.rcmsCred {id, pw} 에만 둔다 (background.js rcmsLogin 이 RCMS 로그인 화면에만 넘김). 저장 버튼으로 함께 저장 ---------- */
  function updateRcmsSummary() {
    const id = $('rcmsId').value.trim(), pw = $('rcmsPw').value;
    $('rcmsSummary').textContent = !$('rcmsAutoLogin').checked ? '자동 로그인 꺼짐' : (id && pw ? `자동 로그인 · ${id}` : 'ID·비밀번호 미입력 (링크만 엶)');
  }
  async function loadRcmsCred() {
    let c = {};
    try { c = (await chrome.storage.local.get('rcmsCred')).rcmsCred || {}; } catch (e) {}
    $('rcmsId').value = c.id || ''; $('rcmsPw').value = c.pw || '';
    updateRcmsSummary();
  }
  async function saveRcmsCred() {
    const id = $('rcmsId').value.trim(), pw = $('rcmsPw').value;
    if (id || pw) await chrome.storage.local.set({ rcmsCred: { id, pw } });
    else await chrome.storage.local.remove('rcmsCred');
  }
  ['rcmsAutoLogin', 'rcmsId', 'rcmsPw'].forEach((id) => $(id).addEventListener('input', updateRcmsSummary));

  /* ---------- 증빙 찾아오기 · 자주 사용 가맹점 (LLM 설정 탭, lib/fetch-sites.js): storage.local.fetchSites(비밀번호 없음) + fetchCred { [id]: { id, pw } }. 저장 버튼으로 함께 저장.
   * 패널이 여는 주소: #fetch-new=<가맹점 이름>(새 등록 칸, eClass 패널의 자주 사용 등록) · #fetch=<id>(그 사이트 고치기) · #fetch-chat=<id>&why=…(💬 — 찾는 방법 익히기를 그 가맹점으로) — LLM 설정 탭을 열고 그 칸으로. 찾아오기가 끝나 백그라운드가 last·howto 를 바꾸면 고치는 중이 아닐 때 다시 읽는다 ---------- */
  const SITES = KRX_SITES;
  let fetchList = [], fetchDirty = false, fetchNewIdx = -1;
  const fetchOpen = new Set();   // 펼친 가맹점 칸(id, 저장 전 새 칸은 'new'+순번) — 다시 그려도 펼친 채로 (2026-10-22 칸을 접게)
  const fsKey = (s, i) => s.id || 'new' + i;
  const fetchRemoved = new Set();   // 이 페이지에서 [삭제]한 등록 id — 저장 때 이것만 지우고, 고치는 사이 공유 (Plus) 동기화가 받아 넣은 가맹점은 남긴다
  /* 종류별 필요 서류 칸의 지금 값 (비운 칸은 기본) — 저장(help.fetchDocs)과 가맹점 칸의 "종류 기본 (…)" 표시에 */
  function kindDocsNow() {
    const out = {};
    for (const [k] of SITES.KINDS) { const v = SITES.docList(($('fetchDocs_' + k) || {}).value || ''); out[k] = v.length ? v : SITES.DOCS[k].slice(); }
    return out;
  }
  for (const [k] of SITES.KINDS) $('fetchDocs_' + k).addEventListener('change', () => renderFetchSites());
  async function loadFetchSites() {
    const sites = await SITES.load();
    let cred = {};
    try { cred = (await chrome.storage.local.get(SITES.CRED))[SITES.CRED] || {}; } catch (e) {}
    fetchList = sites.map((s) => Object.assign({}, s, { loginId: (cred[s.id] || {}).id || '', loginPw: (cred[s.id] || {}).pw || '' }));
    fetchDirty = false;
    renderFetchSites();
  }
  function updateFetchSummary() {   // 증빙 찾아오기 제목 옆 요약: 꺼짐 · 등록한 가맹점 수 (툴팁에 이름)
    const el = $('fetchSummary'), on = $('helpFetch').checked;
    el.textContent = !on ? '버튼 꺼짐' : fetchList.length ? `${fetchList.length}곳 등록` : '등록 없음';
    el.title = !on ? '청구 준비 줄에 찾아오기 버튼을 표시하지 않음' : fetchList.map((s) => s.label || s.match || '새 가맹점').join(', ');
  }
  function renderFetchSites() {
    const kinds = (v) => SITES.KINDS.map(([id, nm]) => `<option value="${id}"${v === id ? ' selected' : ''}>${nm}</option>`).join('');
    const extra = String($('chAttachKinds').value || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    const map = kindDocsNow();
    $('fetchSites').innerHTML = fetchList.map((s, i) => {
      const own = SITES.docList(s.docs).length > 0;   // 이 가맹점만 따로 고른 서류 (아니면 종류 기본)
      const need = SITES.docsOf(s, map);
      const docs = Array.from(new Set(SITES.DOC_CHOICES.concat(extra, need)));
      const k = SITES.knownOf(s) || {};   // 알려진 가맹점이면 칸 예시도 그 업체 것으로
      const last = s.last ? `마지막 ${F.fmtClock(s.last.ts)} · ${s.last.state === 'done' ? `${s.last.n}개 찾아옴` : s.last.state === 'empty' ? '찾지 못함' : s.last.state === 'canceled' ? '중지' : '실패'}${s.last.msg ? ` — ${s.last.msg}` : ''}` : '아직 찾아오지 않음';
      const upd = s.at ? `수정 ${F.fmtClock(s.at)}${s.by && s.by !== fetchMe ? ` ${s.by}` : ''}` : '';   // 올리는 칸을 마지막으로 고친 때 (공유 (Plus) 가 이 날짜로 최신을 고름)
      const key = fsKey(s, i), head = [SITES.kindLabel(s.kind), upd, last].filter(Boolean).join(' · ');
      /* 접는 칸(2026-10-22 사용자 "접히게 … 여백이 너무 많고 필요 없는 설명은 빼줘"): 머리 줄 = 이름 · 종류 · 마지막 결과, 단추는 펼쳤을 때만. 칸 설명은 툴팁(title)으로 */
      return `<details class="fetch-site${i === fetchNewIdx ? ' fetch-new' : ''}" data-fs="${i}" data-fkey="${F.esc(key)}" id="fs-${F.esc(s.id || 'new' + i)}"${i === fetchNewIdx || fetchOpen.has(key) ? ' open' : ''}>
        <summary class="fetch-site-head"><span class="fetch-site-name">${F.esc(s.label || '새 가맹점')}</span><span class="fetch-site-last" title="${F.esc(head)}">${F.esc(head)}</span><span class="fetch-site-actions"><button type="button" class="btn" data-fs-guide="${i}" title="이 가맹점의 안내 글(등록 값 · 기억한 찾는 방법 · Help 서버의 사이트 안내 파일 site-fetch/sites/*.md 원문)을 복사합니다 — 다른 PC 의 등록이나 Claude 에 옮겨 줄 때">안내 복사</button><button type="button" class="btn" data-fs-export="${i}" title="이 가맹점의 등록 값(이름 · 가맹점 글자 · 주소 · 종류 · 필요 서류 · Chrome · 찾는 곳 메모 · 기억한 찾는 방법)을 YAML 파일로 내려받습니다 — 아이디·비밀번호는 넣지 않습니다. 아래 [가져오기]로 다시 넣습니다">내보내기</button><button type="button" class="btn" data-fs-prompt="${i}" title="이 가맹점 사이트를 찾아오기에 붙이는(fetch-site 스킬) Claude Code 프롬프트를 이 칸의 값으로 채워 복사합니다 — 이 확장 폴더에서 연 Claude Code 에 붙여 넣으세요. 위 찾는 방법 익히기는 같은 글을 Help 서버로 보냅니다">만들기 프롬프트 복사</button><button type="button" class="btn danger" data-fs-del="${i}" aria-label="${F.esc(s.label || '새 가맹점')} 삭제">삭제</button></span></summary>
        <div class="grid">
          <label>이름 <input type="text" data-ff="label" value="${F.esc(s.label || '')}" placeholder="예) ${F.esc(k.label || '인프런')}"></label>
          <label title="카드 내역에 표시되는 이름 · 여러 개는 쉼표로">가맹점 글자 <input type="text" data-ff="match" value="${F.esc(s.match || '')}" placeholder="예) ${F.esc(k.match || '인프랩')}"></label>
          <label>종류 <select data-ff="kind">${kinds(s.kind)}</select></label>
          <label class="wide" title="구매내역이나 청구 화면 주소면 더 빨리 찾습니다">사이트 주소 <input type="url" data-ff="url" value="${F.esc(s.url || '')}" placeholder="${F.esc(k.url || 'https://www.inflearn.com/my/orders')}"></label>
          <div class="wide fetch-docs-row" title="찾아오기가 찾고 청구 준비 줄에 ✓/✗ 로 보이는 서류"><span>필요 서류</span><div class="fetch-docs"><label class="fetch-own"><input type="checkbox" data-fown${own ? '' : ' checked'}>종류 기본 따름 — ${F.esc(SITES.kindLabel(s.kind))}: ${F.esc(SITES.docsFor(s.kind, map).join('·'))}</label>${docs.map((d) => `<label><input type="checkbox" data-fd="${F.esc(d)}"${need.includes(d) ? ' checked' : ''}${own ? '' : ' disabled'}><span>${F.esc(d)}</span></label>`).join('')}</div></div>
          <label>아이디 <input type="text" data-ff="loginId" value="${F.esc(s.loginId || '')}" autocomplete="off" spellcheck="false"></label>
          <label>비밀번호 <input type="password" data-ff="loginPw" value="${F.esc(s.loginPw || '')}" autocomplete="new-password"></label>
          <label title="바로가기 이름 · 디버그 포트(예 9444) · 주소 — 실행 중이 아니면 그 바로가기로 엽니다. 비우면 서버 기본">로그인해 둔 Chrome <span class="optional">선택</span><input type="text" data-ff="browser" value="${F.esc(s.browser || '')}" placeholder="예) SUB 전용 · 9444" spellcheck="false"></label>
          <label class="wide" title="Claude 에 전달 — 알려진 가맹점은 그 업체의 메뉴 경로가 미리 들어갑니다. 비우고 저장하면 비운 채로">찾는 곳 메모 <span class="optional">선택</span><input type="text" data-ff="hint" value="${F.esc(s.hint || '')}" placeholder="예) ${F.esc(k.hint || '마이페이지 › 구매내역 › 거래명세서')}"></label>
          <label class="wide" title="지난번에 찾은 경로 — 다음 요청에 참고합니다. 사이트가 바뀌어 못 찾으면 비우세요">기억한 찾는 방법 <textarea data-ff="howto" rows="2">${F.esc(s.howto || '')}</textarea></label>
          <div class="wide fetch-issue"><label title="안 되는 점·해야 할 것 — [Help 에 개선 요청]으로 보내면 Claude 가 사이트 안내와 찾아오기 손잡이를 고치고, 처리되면 비워집니다(저장을 누르세요)">개선점 <span class="optional">선택</span><textarea data-ff="issue" rows="2" placeholder="예) 견적서가 없으면 구매 내역 상세(강의명·가격) 화면을 견적서로 캡처해 줘. 수강증은 캡처 말고 수료증 pdf 를 내려받아 줘">${F.esc(s.issue || '')}</textarea></label><button type="button" class="btn" data-fs-issue="${i}" title="개선점을 위 찾는 방법 익히기로 바로 보냅니다 — Help 서버의 Claude 가 fetch-site 스킬대로 이 사이트의 안내(site-fetch/sites)와 찾는 손잡이·규칙(site-fetch/)을 고치고 node site-fetch/run.js 로 시험합니다">Help 에 개선 요청</button></div>
        </div></details>`;
    }).join('') || '<p class="muted">등록한 가맹점이 없습니다. 패널 청구 준비 줄의 <b>자주 사용 등록</b>이나 아래 <b>가맹점 추가</b>로 등록하세요.</p>';
    updateFetchSummary();
    if (self.KRX_FETCH_CHAT) KRX_FETCH_CHAT.refresh();   // 찾는 방법 익히기의 가맹점 select
  }
  /* Help 서버 주소 (설정 칸의 지금 값, 이 PC 만) — 찾는 방법 익히기·안내 복사·스킬 복사가 씀 */
  function helpBase() {
    const u = $('helpUrl').value.trim().replace(/\/+$/, '');
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(u) ? u : S.DEFAULTS.help.url;
  }
  async function helpGet(path) {   // GET → JSON (실패면 { ok: false, error }). 404 'not found' 는 이 경로가 없는 이전 버전 서버
    try {
      const r = await fetch(helpBase() + path, { cache: 'no-store' }); const j = await r.json();
      if (!j || typeof j !== 'object') return { ok: false, error: '서버 응답을 읽지 못했습니다' };
      if (!j.ok && r.status === 404 && !j.kind) return { ok: false, kind: 'old', error: 'Help 서버가 이전 버전입니다 — 서버를 끄고 다시 node help-server/server.js' };
      return j;
    } catch (e) { return { ok: false, kind: 'offline', error: `Help 서버에 연결할 수 없습니다 (${helpBase()}) — node help-server/server.js` }; }
  }
  /* [안내 복사]: 등록 값 + 기억한 찾는 방법 + 서버의 사이트 안내 파일(GET /fetch/guide — 이전 버전 서버면 파일 없이) */
  async function copyFetchGuide(site) {
    const r = site.url ? await helpGet(`/fetch/guide?url=${encodeURIComponent(site.url)}`) : { ok: false, error: '사이트 주소가 없음' };
    const files = r.ok && Array.isArray(r.files) ? r.files : [];
    const text = SITES.guideText(site, kindDocsNow(), files);
    try { await navigator.clipboard.writeText(text); } catch (e) { setStatus('fetchStatus', `복사하지 못했습니다: ${e.message}`, true); return; }
    const name = site.label || site.match || '가맹점';
    if (files.length) setStatus('fetchStatus', `${name} 안내를 복사했습니다 — 사이트 안내 파일 ${files.map((f) => f.name.replace(/^site-fetch\/sites\//, '')).join(', ')} 포함`);
    else setStatus('fetchStatus', `${name} 안내(등록 값 · 기억한 찾는 방법)를 복사했습니다 — 사이트 안내 파일은 ${r.ok ? '없음 (위 채팅으로 만들 수 있음)' : `못 받음: ${r.error}`}`, !r.ok);
  }
  /* [스킬 복사]: fetch-site 스킬 원문 (GET /fetch/skill) */
  $('btnFcSkill').addEventListener('click', async () => {
    const r = await helpGet('/fetch/skill');
    if (!r.ok || !r.text) { setStatus('fetchStatus', `${r.error || '스킬을 받지 못했습니다'} (원문은 이 폴더의 ${SITES.SKILL})`, true); return; }
    try { await navigator.clipboard.writeText(r.text); setStatus('fetchStatus', `fetch-site 스킬(${r.path || SITES.SKILL})을 복사했습니다 — 다른 저장소의 .claude/skills/fetch-site/SKILL.md 로 붙여 넣으면 거기서도 /fetch-site`); }
    catch (e) { setStatus('fetchStatus', `복사하지 못했습니다: ${e.message}`, true); }
  });
  /* 찾는 방법 익히기가 끝나 howto: 줄을 받음 → 그 가맹점의 기억한 찾는 방법 칸에 (저장은 사용자). 채워졌으면 true */
  function applyHowto(siteId, label, howto) {
    const s = fetchList.find((x) => siteId ? x.id === siteId : label && (x.label || x.match) === label);
    if (!s) { setStatus('fetchStatus', `기억한 찾는 방법을 받았지만 "${label || '새 사이트'}" 등록이 없습니다 — 등록한 뒤 안내 복사로 옮기거나 직접 넣으세요: ${howto}`, true); return false; }
    s.howto = howto; fetchDirty = true; fetchOpen.add(fsKey(s, fetchList.indexOf(s))); renderFetchSites();
    const box = $('fetchSites').querySelector(`[data-fs="${fetchList.indexOf(s)}"]`);
    if (box) box.classList.add('fetch-new');
    setStatus('fetchStatus', `${s.label || s.match}: 기억한 찾는 방법을 채웠습니다 — 아래 저장을 누르세요`);
    return true;
  }
  /* 찾는 방법 익히기의 내 요청이 끝남(ok) → 그 가맹점의 개선점 칸을 비움(처리됐으니 — 저장은 사용자). 실패·중지는 남겨 둔다 */
  function issueDone(siteId, label, ok) {
    const s = fetchList.find((x) => siteId ? x.id === siteId : label && (x.label || x.match) === label);
    if (!s || !ok || !String(s.issue || '').trim()) return;
    s.issue = ''; fetchDirty = true; renderFetchSites();
    setStatus('fetchStatus', `${s.label || s.match}: 개선점을 처리해 비웠습니다 — 아래 저장을 누르세요`);
  }
  $('fetchSites').addEventListener('input', (ev) => {
    const el = ev.target, box = el.closest('[data-fs]'); if (!box) return;
    const s = fetchList[Number(box.dataset.fs)]; if (!s) return;
    if (el.dataset.ff) { s[el.dataset.ff] = el.value; if (el.dataset.ff === 'kind') renderFetchSites(); }   // 종류 기본이면 필요 서류 표시가 바뀜
    else if ('fown' in el.dataset) { s.docs = el.checked ? [] : SITES.docsFor(s.kind, kindDocsNow()); renderFetchSites(); }   // 끄면 지금 종류 기본에서 시작해 이 가맹점만 고름
    else if (el.dataset.fd) { const set = new Set(SITES.docsOf(s, kindDocsNow())); if (el.checked) set.add(el.dataset.fd); else set.delete(el.dataset.fd); s.docs = Array.from(set); }
    fetchDirty = true;
    if (el.dataset.ff === 'label') { updateFetchSummary(); const nm = box.querySelector('.fetch-site-name'); if (nm) nm.textContent = s.label || '새 가맹점'; }
  });
  $('fetchSites').addEventListener('toggle', (ev) => {   // 접고 편 것을 기억 (toggle 은 거품이 없어 capture 로)
    const d = ev.target; if (!d.dataset || !d.dataset.fkey) return;
    if (d.open) fetchOpen.add(d.dataset.fkey); else fetchOpen.delete(d.dataset.fkey);
  }, true);
  /* 새 사이트 만들기 프롬프트 (lib/fetch-sites.js buildPrompt — fetch-site 스킬을 가리키는 가맹점 블록) 복사 — 가맹점 칸이면 그 값으로, 아래 버튼이면 빈 칸 틀 */
  async function copyFetchPrompt(site) {
    const text = SITES.buildPrompt(site, kindDocsNow());
    try { await navigator.clipboard.writeText(text); setStatus('fetchStatus', `${site ? `${site.label || site.match || '새 가맹점'} ` : '새 사이트 '}만들기 프롬프트를 복사했습니다 — 이 확장 폴더(E:\\dev\\kr_ext_rerp)에서 연 Claude Code 에 붙여 넣으세요(fetch-site 스킬 절차)${site ? ' (시험할 거래의 사용일·금액 칸을 채우면 좋음)' : ' (＿＿ 칸을 채우세요)'}`); }
    catch (e) { setStatus('fetchStatus', `복사하지 못했습니다: ${e.message}`, true); }
  }
  $('btnFetchPrompt').addEventListener('click', () => copyFetchPrompt(null));
  $('fetchSites').addEventListener('click', (ev) => {
    if (ev.target.closest('.fetch-site-actions')) ev.preventDefault();   // 머리 줄(summary) 안의 단추 — 칸을 접지 않게
    const p = ev.target.closest('[data-fs-prompt]');
    if (p) { const s = fetchList[Number(p.dataset.fsPrompt)]; if (s) copyFetchPrompt(s); return; }
    const gd = ev.target.closest('[data-fs-guide]');
    if (gd) { const s = fetchList[Number(gd.dataset.fsGuide)]; if (s) copyFetchGuide(s); return; }
    const ex = ev.target.closest('[data-fs-export]');
    if (ex) { const s = fetchList[Number(ex.dataset.fsExport)]; if (s) exportFetchSite(s); return; }
    const is = ev.target.closest('[data-fs-issue]');   // 개선점 → 찾는 방법 익히기로 바로 (options/fetch-chat.js request — 글은 buildPrompt 가 가맹점 블록에 넣음)
    if (is) { const i = Number(is.dataset.fsIssue), s = fetchList[i]; if (!s) return; if (!String(s.issue || '').trim()) { setStatus('fetchStatus', '개선점 칸에 안 되는 점과 해야 할 것을 먼저 적으세요', true); return; } if (self.KRX_FETCH_CHAT) KRX_FETCH_CHAT.request(i, '개선점대로 고쳐 줘'); return; }
    const b = ev.target.closest('[data-fs-del]'); if (!b) return;
    const s = fetchList[Number(b.dataset.fsDel)];
    if (s && s.id && !confirm(`${s.label || s.match} 등록을 지울까요? (아이디·비밀번호도 지워집니다. 아래 저장을 눌러야 반영)`)) return;
    if (s && s.id) fetchRemoved.add(s.id);
    fetchList.splice(Number(b.dataset.fsDel), 1); fetchDirty = true; fetchNewIdx = -1; renderFetchSites();
  });
  function addFetchSite(shop) {
    const d = Object.assign(shop ? SITES.defaultsFor(shop) : { label: '', match: '', url: '', kind: 'other', hint: '', browser: '' }, { docs: [] });   // 필요 서류는 종류 기본
    fetchList.push(Object.assign(d, { id: '', loginId: '', loginPw: '', howto: '', issue: '' }));
    fetchNewIdx = fetchList.length - 1; fetchDirty = true; fetchOpen.add('new' + fetchNewIdx);
    showTab('llm');
    renderFetchSites();
    const box = $('fetchSites').querySelector(`[data-fs="${fetchNewIdx}"]`);
    if (box) { box.scrollIntoView({ block: 'center' }); const el = box.querySelector(d.url ? '[data-ff="loginId"]' : '[data-ff="url"]'); if (el) el.focus(); }
  }
  $('btnFetchAdd').addEventListener('click', () => addFetchSite(''));
  /* 가맹점 파일 (lib/fetch-sites.js toFile · fromFile): [내보내기]는 그 가맹점 하나를 YAML 로, [가져오기]는 .yaml/.yml/.json(여럿 골라도 됨 — 파일 하나에 배열·{ sites } 도) →
   * 같은 가맹점(가맹점 글자·이름)이 있으면 그 칸의 값을 바꾸고(아이디·비밀번호·마지막 결과·개선점은 남김) 없으면 새 칸. 저장은 사용자 */
  async function exportFetchSite(s) {
    const name = s.label || s.match || '가맹점';
    let text;
    try { text = `# 증빙 찾아오기 가맹점 — 확장 설정 › LLM 설정 › 자주 사용 가맹점 › [가져오기]로 넣습니다 (아이디·비밀번호 없음)\n${(await loadYaml()).stringify(SITES.toFile(s), { lineWidth: 0 })}`; }
    catch (e) { setStatus('fetchStatus', `내보내지 못했습니다: ${e.message}`, true); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/yaml' }));
    a.download = `가맹점_${name.replace(/[\\/:*?"<>|\s]+/g, '_')}.yaml`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    setStatus('fetchStatus', `${name}: ${a.download} 로 내보냈습니다`);
  }
  $('btnFetchImport').addEventListener('click', () => $('fetchImportFile').click());
  $('fetchImportFile').addEventListener('change', async (ev) => {
    const files = Array.from(ev.target.files || []); ev.target.value = '';
    const done = [], bad = [];
    for (const f of files) {
      let list;
      try {
        const text = await f.text();
        list = SITES.fromFile(/\.json$/i.test(f.name) ? JSON.parse(text) : (await loadYaml()).parse(text));
      } catch (e) { bad.push(`${f.name}: ${e.message}`); continue; }
      for (const o of list) {
        const old = fetchList.find((x) => SITES.sameSite(x, o));
        if (old) { Object.assign(old, o); fetchOpen.add(fsKey(old, fetchList.indexOf(old))); done.push(`${o.label}(고침)`); }
        else { fetchList.push(Object.assign(o, { id: '', loginId: '', loginPw: '', issue: '' })); fetchOpen.add('new' + (fetchList.length - 1)); done.push(`${o.label}(새로)`); }
      }
    }
    if (done.length) { fetchDirty = true; renderFetchSites(); }
    setStatus('fetchStatus', [done.length ? `가져옴: ${done.join(', ')} — 아래 저장을 누르세요` : '', bad.length ? `못 읽음: ${bad.join(' · ')}` : ''].filter(Boolean).join(' / ') || '가져올 파일이 없습니다', !!bad.length);
  });
  $('helpFetch').addEventListener('change', updateFetchSummary);
  /* 고친 사람 — R&D ERP 로그인 이름, 없으면 설정의 내 이름 (가맹점 수정 시각과 같이 남김 · 머리 줄에서 남이 고친 것만 이름을 보임) */
  let fetchMe = '';
  async function fetchWho() {
    try { const u = (await chrome.storage.local.get('rndUser')).rndUser; if (u && u.userNm) return (fetchMe = String(u.userNm)); } catch (e) {}
    try { return (fetchMe = String((await S.load()).myName || '')); } catch (e) { return ''; }
  }
  fetchWho().then(() => { if (fetchList.length) renderFetchSites(); }).catch(() => {});
  /* 저장 버튼: 빈 새 칸은 버리고, 칸마다 검사(lib/fetch-sites.js sanitize) → fetchSites + fetchCred. last(마지막 결과)는 저장소의 지금 값을 살린다.
   * 저장소에는 있는데 이 페이지 목록에 없는 등록은 [삭제]한 것(fetchRemoved)만 지우고 나머지(고치는 사이 공유 (Plus) 가 받아 넣은 것)는 아이디·비밀번호와 함께 남긴다 */
  async function saveFetchSites() {
    if (!fetchDirty) return;
    const stored = await SITES.load();
    let oldCred = {};
    try { oldCred = (await chrome.storage.local.get(SITES.CRED))[SITES.CRED] || {}; } catch (e) {}
    const sites = [], cred = {}, now = Date.now(), who = await fetchWho();
    for (const s of fetchList) {
      if (!s.id && !String(s.url || '').trim() && !String(s.match || '').trim()) continue;
      let c;
      try { c = SITES.sanitize(s); } catch (e) { showTab('llm'); throw new Error(`증빙 찾아오기 › ${s.label || s.match || '새 가맹점'}: ${e.message}`); }
      if (!c.id) c.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + sites.length;
      const old = stored.find((x) => x.id === c.id);
      if (old) c.last = old.last || null;
      SITES.stamp(c, old, now, who);   // 올리는 칸이 바뀐 등록만 수정 시각·사람 (공유 (Plus) 가맹점 파일에서 날짜가 늦은 쪽이 이김)
      if (!s.id && fetchOpen.has('new' + fetchList.indexOf(s))) fetchOpen.add(c.id);   // 펼친 새 칸은 저장 뒤에도 펼친 채로
      s.id = c.id;
      sites.push(c);
      const id = String(s.loginId || '').trim(), pw = String(s.loginPw || '');
      if (id || pw) cred[c.id] = { id, pw };
    }
    for (const x of stored) if (x && x.id && !fetchRemoved.has(x.id) && !sites.some((c) => c.id === x.id)) { sites.push(x); if (oldCred[x.id]) cred[x.id] = oldCred[x.id]; }
    await SITES.bury(stored.filter((x) => x && fetchRemoved.has(x.id)), now);   // [삭제]한 등록은 지운 시각으로 묘비
    await chrome.storage.local.set({ [SITES.KEY]: sites, [SITES.CRED]: cred });
    fetchDirty = false; fetchNewIdx = -1; fetchRemoved.clear();
  }
  chrome.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch[SITES.KEY] && !fetchDirty) loadFetchSites().catch(() => {}); if (area === 'local' && (ch.shareState || ch.shareSitesPeople)) renderFetchShare(); if (area === 'local' && ch.shareSitesPeople) renderSitesPrj(); });
  /* 가맹점 목록 아래 공유 줄 — 공유 (Plus) 의 가맹점 파일(밑폴더/common/가맹점.json, background.js shareSync → shareState.sites · lib/sites-sync.js): 폴더 열기 · 동기화 시각 · 가맹점 수 · 합친 동료 파일 · 받은/올린 것 */
  async function renderFetchShare() {
    const el = $('fetchShare'), el2 = $('plusCommonState'); if (!el) return;   // el2: 공유 (Plus) 탭 › 전체 공유 카드의 같은 줄(꺼져 있을 때는 비움 — 그 탭에 켜는 상자가 있으므로)
    const set = (html, cls) => { for (const x of [el, el2]) if (x) { x.innerHTML = html; x.className = 'fetch-share' + (cls ? ' ' + cls : ''); } };
    if (!$('plusEnabled').checked || !$('plusSitesSync').checked) {
      if (el2) { el2.innerHTML = ''; el2.className = 'fetch-share'; }   // 꺼진 까닭(Plus 전체 · 가맹점 항목)을 말하고 그 체크 상자로 가는 단추 — 켜는 것은 그 탭에서(Plus 를 켜면 과제 폴더 동기화·자동 공유도 함께 켜지므로 여기서 대신 켜지 않음)
      const why = !$('plusEnabled').checked ? '<b>공유 (Plus) 사용</b>과 <b>자주 사용 가맹점</b>을' : '<b>자주 사용 가맹점</b>을';
      el.className = 'fetch-share';
      return void (el.innerHTML = `SharePoint 공유 꺼짐 — 공유 (Plus) 탭 › 전체 공유의 ${why} 켜면 OneDrive 의 <code>업무/shared/common/가맹점.json</code> 으로 내 PC 끼리, 동료와 맞춥니다(아이디·비밀번호는 올리지 않음) <button type="button" class="btn fetch-share-btn" data-sites-goplus>공유 (Plus) 에서 켜기</button>`);
    }
    let st = null, sp = null;
    try { const l = await chrome.storage.local.get(['shareState', 'shareSitesPeople']); st = (l.shareState || {}).sites || null; sp = (l.shareSitesPeople || {}).last || null; } catch (e) {}
    /* 동료 공유(common 폴더 읽기 — background.js shareSitesFolder · 자동 공유) 결과 + [동료에게 공유] 단추 */
    const noPrj = sitesScopeVal() === 'pick' && !sitesPrjSel.size;   // 고른 과제만인데 하나도 안 고름 — 동기화(내 파일·동료 파일)는 돌고 공유만 안 함
    const shareTxt = noPrj ? ' · 공유할 과제를 고르지 않아 동료에게 공유하지 않음' : sp ? ` · 읽기 공유 ${sp.shared}명${sp.at ? `(${F.esc(F.fmtClock(sp.at))})` : ''}${(sp.ambiguous || []).length ? ` · 이름 겹침 ${F.esc(sp.ambiguous.join(', '))}` : ''}${(sp.notFound || []).length ? ` · 못 찾음 ${F.esc(sp.notFound.join(', '))}` : ''}${sp.error ? ` · 공유 오류 ${F.esc(sp.error)}` : ''}` : ' · 아직 아무와도 공유하지 않음';
    const btn = ' <button type="button" class="btn fetch-share-btn" data-sites-share title="가맹점 폴더(shared/common)를 공유할 과제(공유 (Plus) › 전체 공유 — 참여 과제 전체 또는 고른 과제)의 참여연구원에게 읽기로 공유합니다 — 누를 때 과제별 이름을 먼저 보여 주고 확인을 받습니다. 동료는 나와 공유에서 이 폴더를 찾아 가맹점 파일을 읽어 합칩니다">동료에게 공유</button>';
    if (!st) return set(`공유: 다음 동기화 때 <code>shared/common/가맹점.json</code> 을 만들거나 받습니다${shareTxt}${btn}`);
    if (!st.ok) return set(`공유 실패 — ${F.esc(st.error || '')}${btn}`, 'err');
    const others = (st.others || []).filter((o) => !o.error).map((o) => `${F.esc(o.owner || '동료')} ${o.n}곳`);
    const bad = (st.others || []).filter((o) => o.error).map((o) => `${F.esc(o.owner || '동료')}(${F.esc(o.error)})`);
    const got = [st.added && `새로 받음 ${st.added}`, st.updated && `고쳐 받음 ${st.updated}`, st.removed && `지움 ${st.removed}`, st.pushed && '올림'].filter(Boolean).join(' · ');
    set(`공유: ${st.folderUrl ? `<a href="${F.esc(st.folderUrl)}" target="_blank" rel="noopener">shared/common</a>` : 'shared/common'}/가맹점.json · ${F.esc(F.fmtClock(st.at))} · ${st.count || 0}곳${others.length ? ` · 동료 파일 ${others.join(', ')}` : ''}${got ? ` · ${got}` : ''}${bad.length ? ` · 못 읽음 ${bad.join(', ')}` : ''}${shareTxt}${btn}`, bad.length || (sp && sp.error) ? 'warn' : '');
  }
  /* [동료에게 공유]: 이름을 먼저 받아(dry) 확인 → 공유 (common 폴더 읽기 권한) */
  async function onSitesShareClick(ev, statusId) {
    const go = ev.target.closest('[data-sites-goplus]');
    if (go) {   // [공유 (Plus) 에서 켜기]: 공유 탭으로 넘어가 꺼져 있는 체크 상자(Plus 사용 → 가맹점)를 보여 주고 잠깐 강조
      showTab('share'); history.replaceState(null, '', '#share');
      const box = $(!$('plusEnabled').checked ? 'plusEnabled' : 'plusSitesSync'), row = box.closest('label') || box;
      row.scrollIntoView({ block: 'center' }); box.focus({ preventScroll: true });
      row.classList.remove('goto-flash'); void row.offsetWidth; row.classList.add('goto-flash');
      return;
    }
    const b = ev.target.closest('[data-sites-share]'); if (!b) return;
    b.disabled = true;
    try {
      const scope = sitesScopeVal(), prjNos = Array.from(sitesPrjSel);   // 저장 전이어도 지금 고른 대로 (백그라운드가 설정 대신 이것을 씀)
      setStatus(statusId, `${scope === 'pick' ? '고른' : '참여'} 과제의 참여연구원을 찾는 중…`);
      let d = null;
      try { d = await chrome.runtime.sendMessage({ type: 'sitesShare', dry: true, scope, prjNos }); } catch (e) { d = { ok: false, message: String(e.message || e) }; }
      if (!d || !d.ok) { setStatus(statusId, (d && (d.message || d.error)) || '공유할 사람을 찾지 못했습니다', true); return; }
      let aliases = {};
      try { aliases = (await chrome.storage.local.get('projectAliases')).projectAliases || {}; } catch (e) {}
      const byPrj = d.byPrj && typeof d.byPrj === 'object' ? d.byPrj : {};
      const lines = (Array.isArray(d.prjNos) ? d.prjNos : Object.keys(byPrj)).filter((no) => Array.isArray(byPrj[no])).map((no) => `[${aliases[no] || no}] ${byPrj[no].length ? byPrj[no].join(', ') : '(나 말고 없음)'}`);
      if (!confirm(`가맹점 폴더(shared/common)를 ${d.names.length}명에게 읽기로 공유할까요?

${lines.length ? lines.join('\n') : d.names.join(', ')}`)) { setStatus(statusId, ''); return; }
      setStatus(statusId, '공유하는 중…');
      let r = null;
      try { r = await chrome.runtime.sendMessage({ type: 'sitesShare', names: d.names, byPrj, scope, prjNos: d.prjNos || prjNos }); } catch (e) { r = { ok: false, message: String(e.message || e) }; }
      setStatus(statusId, r && r.ok ? `가맹점 폴더 — ${r.message}` : `공유 실패: ${(r && (r.message || r.error)) || ''}`, !(r && r.ok));
      renderFetchShare(); renderSitesPrj();
    } finally { b.disabled = false; }
  }
  $('fetchShare').addEventListener('click', (ev) => onSitesShareClick(ev, 'fetchStatus'));
  $('plusCommonState').addEventListener('click', (ev) => onSitesShareClick(ev, 'plusSyncStatus'));   // 공유 (Plus) 탭 › 전체 공유 카드의 [동료에게 공유]
  for (const id of ['plusEnabled', 'plusSitesSync']) $(id).addEventListener('change', () => { renderFetchShare(); updateSitesSummary(); });
  /* 패널이 연 주소의 #fetch-new=… / #fetch=… / #fetch-chat=… (LLM 설정 탭의 증빙 찾아오기 구역) */
  async function fetchFromHash() {
    const h = decodeURIComponent(String(location.hash || '').slice(1));
    if (h.startsWith('fetch-new=')) {
      const shop = h.slice('fetch-new='.length);
      const hit = SITES.match(fetchList, shop);
      if (hit) { location.hash = 'fetch=' + hit.id; return fetchFromHash(); }
      addFetchSite(shop);
      setStatus('fetchStatus', `"${shop}" 가맹점을 등록합니다 — 사이트 주소·아이디·비밀번호를 넣고 아래 저장을 누르세요`);
    } else if (h.startsWith('fetch-chat=')) {   // 패널 찾아오기 줄의 💬 → 찾는 방법 익히기를 그 가맹점으로 (why = 마지막 찾아오기가 못 찾은 이유, 글에 미리)
      showTab('llm');
      const p = new URLSearchParams(String(location.hash || '').slice(1)), why = p.get('why') || '';
      if (self.KRX_FETCH_CHAT) KRX_FETCH_CHAT.pick(p.get('fetch-chat') || '', why ? `찾지 못함: ${why} — 이 사이트의 안내·기억한 찾는 방법을 고쳐 줘` : '');
    } else if (h.startsWith('fetch=')) {
      showTab('llm');
      const box = $(`fs-${h.slice('fetch='.length)}`);
      if (box) { box.classList.add('fetch-new'); box.open = true; box.scrollIntoView({ block: 'center' }); }
    }
  }
  window.addEventListener('hashchange', () => { showTab(tabOfHash()); fetchFromHash().catch(() => {}); });
  $('btnReset').addEventListener('click', () => { if (confirm('모든 설정을 기본값으로 되돌릴까요?')) fill(S.merge(S.DEFAULTS, {})); });

  /* ---------- LLM 설정 탭: 이 PC 의 Help 서버(help-server/server.js) 연결 상태. 백그라운드(lib/llm.js 'llmProbe' → storage.local.llmStatus, 패널의 찾아오기 버튼도 같은 상태를 봄)에 묻고,
   * 백그라운드가 응답하지 않으면(깨졌을 때) 설정 페이지도 확장 페이지라 localhost 호스트 권한으로 직접 부른다(popup/help.js 와 같은 방식).
   * 열 때 · 30초마다(보이는 동안) · 주소를 고친 뒤 · 연결 확인 버튼으로 확인하고, 서버나 Claude API 어느 길로든 연결돼 있으면 LLM 기능 구역(#llmFeatures — 자동 분류 · Help Chat · 증빙 찾아오기와 가맹점 등록)을 전부 켠다(2026-10-21) — 안 되면 .llm-off 로 흐리게 + 안내. 상태 표시는 #llmState · #llmBadge 하나뿐(기능마다 칩은 2026-10-21 뺌) ---------- */
  const LLM_POLL_MS = 30000;
  let llm = null;   // 마지막 상태 { url, at, ok, model, classify, classifyPtcl, fetch, fetchNote, cli, version, repo, busy, error } (lib/llm.js 와 같은 모양)
  let llmProbing = null;
  async function probeDirect(url) {
    let j = null, err = '';
    try {
      const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 2500);
      try { j = await (await fetch(url + '/health', { cache: 'no-store', signal: ac.signal })).json(); } finally { clearTimeout(t); }
    } catch (e) { j = null; err = `연결할 수 없습니다 (${url}) — 이 PC 에서 node help-server/server.js 를 실행하세요`; }
    const ok = !!(j && j.ok && j.name === 'krx-help');
    return { url, at: Date.now(), ok, model: ok ? j.model || '' : '', classify: ok ? j.classify || '' : '', classifyPtcl: !!(ok && j.classifyPtcl), fetch: ok ? j.fetch || '' : '', fetchNote: ok ? j.fetchNote || '' : '',
      cli: ok ? j.cli || '' : '', git: !!(ok && j.git), version: ok ? j.version || '' : '', repo: ok ? j.repo || '' : '', busy: ok ? j.busy || '' : '', error: ok ? '' : (j && j.error ? `거절됨: ${j.error}` : err || `연결할 수 없습니다 (${url})`) };
  }
  async function probeLlm(force) {
    if (llmProbing) return llmProbing;
    llmProbing = (async () => {
      const url = helpBase();
      let st = null;
      try { st = await chrome.runtime.sendMessage({ type: 'llmProbe', url, force: !!force }); } catch (e) { st = null; }
      if (!st || typeof st.ok !== 'boolean') st = await probeDirect(url);   // 백그라운드가 안 되면 직접 (이때는 llmStatus 저장소는 안 바뀜)
      llm = st; renderLlm();
      return st;
    })();
    try { return await llmProbing; } finally { llmProbing = null; }
  }
  function renderLlm() {
    const ok = !!(llm && llm.ok);
    const a = apiInfo();
    const badge = $('llmBadge');   // Help 서버가 연결 안 돼도 Claude API 키가 있으면 "Claude API" (자동 분류만 됨)
    badge.textContent = !llm ? '확인 중…' : ok ? '연결됨' : a.ready ? 'Claude API' : '연결 안 됨';
    badge.className = 'tab-badge ' + (!llm ? '' : ok || a.ready ? 'on' : 'err');   // 어느 길로든 연결되면 초록 (글이 어느 길인지 말함)
    badge.title = !llm ? '' : ok ? `Help 서버 ${llm.url} · 모델 ${llm.model}` : a.ready ? `Claude API(${a.model}) — Help Chat · 증빙 찾아오기는 쓸 때 Help 서버가 있어야 합니다` : llm.error || '';
    const st = $('llmState');
    st.textContent = !llm ? '확인 중…' : ok ? `연결됨 · ${F.fmtClock(llm.at)} 확인` : `연결 안 됨 · ${F.fmtClock(llm.at)} 확인`;
    st.className = 'llm-state ' + (!llm ? '' : ok ? 'on' : 'err');
    const detail = $('llmDetail');
    detail.innerHTML = !llm ? '' : ok
      ? [`주소 ${F.esc(llm.url)}`, `모델 ${F.esc(llm.model || '-')}`, `자동 분류 ${F.esc(llm.classify || '없음')}`, `청구내역 작성 ${llm.classifyPtcl ? '가능' : '안 됨'}`, `증빙 찾아오기 ${F.esc(llm.fetch || llm.fetchNote || '없음')}`, `claude CLI ${F.esc(llm.cli || '확인 안 됨')}`, `GitHub 새 커밋 확인·받기 ${llm.git ? '가능' : '없음 (이전 버전 서버 — 다시 실행하세요)'}`, llm.version ? `서버가 읽은 확장 ${F.esc(llm.version)}` : '', llm.repo ? `저장소 ${F.esc(llm.repo)}` : '', llm.busy ? '요청 처리 중' : ''].filter(Boolean).map((t) => `<span>${t}</span>`).join('')
      : `<span class="err">${F.esc(llm.error || '연결할 수 없습니다')}</span><span>서버가 안 떠 있으면 이 PC 의 터미널에서 <code>node help-server/server.js</code> — 뜨면 30초 안에 저절로 켜집니다 (또는 연결 확인)</span>`;
    // 연결돼 있을 때만 LLM 기능 구역(증빙 찾아오기·가맹점 등록 포함)을 켠다 (확인 전에는 켜 둠). 자동 분류 카드는 Claude API 키가 있어도 켠다
    // 2026-10-21 사용자 "다 가게 해줘. 동일하게 위 설정에 맞게": 서버든 Claude API 든 어느 길로든 연결되면 기능 카드를 전부 켠다(설정은 설정일 뿐 — Help Chat · 찾아오기의 실제 동작은 서버 몫이고 안내가 말함). 둘 다 안 될 때만 흐리게
    const noServer = !!llm && !ok, off = noServer && !a.ready;
    $('llmFeatures').querySelectorAll(':scope > .card, :scope > #fetchBody').forEach((el) => { el.classList.toggle('llm-off', off); el.inert = off; });
    $('llmNotice').hidden = !noServer;
    $('llmNotice').textContent = !noServer ? '' : a.ready
      ? `${a.use === 'always' ? '연결 방식이 Claude API 입니다' : 'Help 서버가 연결돼 있지 않습니다'} — 청구 준비 자동화(자동 분류 · 청구내역 작성) · 변경 도우미 · 연구수당 도우미는 위 Claude API 로 동작합니다. Help Chat · 증빙 찾아오기 · 찾는 방법 익히기는 설정은 할 수 있지만 쓸 때 Help 서버(node help-server/server.js)가 떠 있어야 합니다.`
      : `LLM(Help 서버)이 연결돼 있지 않아 아래 기능(자동 분류 · Help Chat · 증빙 찾아오기)을 쓸 수 없습니다 — 서버를 띄우면 저절로 켜집니다. ${a.key && a.use !== 'off' ? '위 Claude API 키가 확인되지 않았습니다 — 키를 고치면 청구 준비 자동화는 서버 없이도 됩니다.' : '위 Claude API 에 API 키를 넣으면 청구 준비 자동화는 서버 없이도 됩니다.'} 설정 값과 가맹점 등록은 그대로 남아 있습니다. 처음 쓰는 PC 면 위 LLM 연결 칸의 "Claude Code 설정 프롬프트 복사" 를 저장소 폴더의 Claude Code 에 붙여 넣으세요.`;
    renderApi(a);
    $('llmSetupRow').hidden = !noServer;   // 서버가 안 될 때만: Claude Code 에 붙여 넣을 설정 프롬프트 (lib/help-setup.js)
    const fn = $('fetchLlmNotice');   // 찾아오기는 서버 몫: 서버가 없거나(Claude API 만 연결 — 패널 칩 "Help 서버 필요" 와 같은 말, 2026-10-21) 찾아오기가 없는 서버(이전 버전 · Node 22 미만)면 카드 안에서 말한다
    fn.hidden = !(noServer || (ok && !llm.fetch));
    fn.textContent = fn.hidden ? '' : noServer ? '찾아오기는 이 PC 의 Help 서버가 있어야 합니다(Claude API 키로는 안 됨) — node help-server/server.js 를 띄우면 패널의 찾아오기 단추가 켜집니다. 가맹점 등록은 지금 해 둘 수 있습니다.' : `Help 서버는 연결됐지만 찾아오기가 안 되는 서버입니다 — ${llm.fetchNote || '이전 버전이라 서버를 끄고 다시 node help-server/server.js'}. 가맹점 등록은 해 둘 수 있습니다.`;
    updateFetchSummary();
  }
  $('btnHelpProbe').addEventListener('click', async () => {
    const u = $('helpUrl').value.trim().replace(/\/+$/, '');
    if (u && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(u)) { setStatus('helpProbeStatus', 'Help 서버 주소는 이 PC(localhost · 127.0.0.1)만 됩니다', true); return; }
    setStatus('helpProbeStatus', 'Help 서버에 연결하는 중…');
    const r = await probeLlm(true);
    if (r.ok) setStatus('helpProbeStatus', `연결됨: 모델 ${r.model} · 자동 분류 ${r.classify || '없음 (이전 버전 서버 — 다시 실행하세요)'} · 증빙 찾아오기 ${r.fetch || r.fetchNote || '없음 (이전 버전 서버 — 다시 실행하세요)'} · claude CLI ${r.cli || '(확인 안 됨)'}${r.busy ? ' · 요청 처리 중' : ''}`, !r.cli || !r.classify);
    else setStatus('helpProbeStatus', r.error || `연결할 수 없습니다 (${r.url})`, true);
  });
  /* [Claude Code 설정 프롬프트 복사]: 서버를 못 붙인 PC 에서 저장소 폴더의 Claude Code 에 붙여 넣을 글 (lib/help-setup.js — 팝업 Help Chat 의 설정 프롬프트 복사와 같음) */
  $('btnLlmSetup').addEventListener('click', async () => {
    if (!self.KRX_HELP_SETUP) { setStatus('llmSetupStatus', 'lib/help-setup.js 를 읽지 못했습니다 — 팝업 Help Chat 의 설정 프롬프트 복사를 쓰세요', true); return; }
    const o = { url: helpBase(), from: '설정 페이지 › LLM 설정', reason: llm && !llm.ok ? llm.error || '' : '' };
    try { o.version = chrome.runtime.getManifest().version; } catch (e) {}
    try { await navigator.clipboard.writeText(KRX_HELP_SETUP.prompt(o)); setStatus('llmSetupStatus', '복사했습니다 — 저장소 폴더(확장을 로드한 폴더)에서 연 Claude Code 에 붙여 넣으면 준비물 확인과 서버 실행을 안내합니다'); }
    catch (e) { setStatus('llmSetupStatus', `복사하지 못했습니다: ${e.message}`, true); }
  });
  /* 팀즈 MCP(lib/teams-mcp.js — 백그라운드 'teamsProbe' → storage.local.teamsStatus): 열 때 · 연결 확인 · 주소를 고친 뒤. 참여연구원 변경 탭의 [보내기]·[채팅방에 보내기]는 이 상태가 ok 일 때만 */
  const teamsBase = () => { const u = $('teamsMcpUrl').value.trim(); return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/\S*$/i.test(u) ? u : S.DEFAULTS.teams.mcpUrl; };
  async function probeTeams(force) {
    let st = null;
    try { st = await chrome.runtime.sendMessage({ type: 'teamsProbe', url: teamsBase(), force: !!force }); } catch (e) { st = null; }
    const el = $('teamsState');
    if (!st || typeof st.ok !== 'boolean') { el.textContent = '확인 못 함'; el.className = 'llm-state err'; el.title = '백그라운드가 응답하지 않습니다'; return null; }
    el.textContent = st.ok ? `연결됨 · ${F.fmtClock(st.at)} 확인` : `연결 안 됨 · ${F.fmtClock(st.at)} 확인`;
    el.className = 'llm-state ' + (st.ok ? 'on' : 'err'); el.title = st.ok ? `${st.server || ''} ${st.url}`.trim() : st.error || '';
    return st;
  }
  $('btnTeamsProbe').addEventListener('click', async () => {
    setStatus('teamsProbeStatus', '팀즈 MCP 서버에 연결하는 중…');
    const r = await probeTeams(true);
    if (r && r.ok) setStatus('teamsProbeStatus', `연결됨: ${r.server || r.url} — 참여연구원 변경 탭의 자료 요청에서 [보내기]·[채팅방에 보내기]가 창 없이 보냅니다 (주소를 고쳤으면 저장)`);
    else setStatus('teamsProbeStatus', (r && r.error) || '연결할 수 없습니다 — 이 PC 의 KR_MS365_mcp teams 서버를 띄우세요', true);
  });
  let teamsUrlTimer = 0;
  $('teamsMcpUrl').addEventListener('input', () => { clearTimeout(teamsUrlTimer); teamsUrlTimer = setTimeout(() => probeTeams(true).catch(() => {}), 700); });
  probeTeams(false).catch(() => {});
  let helpUrlTimer = 0;
  $('helpUrl').addEventListener('input', () => { clearTimeout(helpUrlTimer); helpUrlTimer = setTimeout(() => probeLlm(true).catch(() => {}), 700); });   // 주소를 고치면 그 주소로 다시 확인
  setInterval(() => { if (document.visibilityState === 'visible') probeLlm(false).catch(() => {}); }, LLM_POLL_MS);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') probeLlm(false).catch(() => {}); });
  try { chrome.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch.llmStatus && ch.llmStatus.newValue && ch.llmStatus.newValue.url === helpBase()) { llm = ch.llmStatus.newValue; renderLlm(); } }); } catch (e) {}   // 백그라운드·패널이 확인한 결과도 반영

  /* ---------- LLM 설정 탭 › Claude API (0.8.6, lib/claude-api.js): API 키는 storage.local.claudeApiKey(저장 버튼으로 함께, 동기화 안 함) · 사용 방식·모델은 settings.help.api.
   * [API 확인] = GET /v1/models/{model}(비용 없음) → storage.local.llmApi (자동 분류의 결과도 갱신 — onChanged 로 따라감). 열 때 저장된 키는 확인한 지 오래됐으면(API_RECHECK_MS) 조용히 다시 확인.
   * 키가 있고 사용 안 함이 아니면(그 키·모델로 확인에 실패했으면 빼고) Help 서버가 없어도 자동 분류 카드를 켠다 (renderLlm) ---------- */
  const API_RECHECK_MS = 6 * 3600000;
  let apiSt = null;          // storage.local.llmApi (마지막 확인 결과)
  let apiSavedKey = '';      // 저장소에 있는 키 (입력란과 다르면 "저장해야 반영")
  let apiSavedWs = '';       // 저장소에 있는 워크스페이스 ID (storage.local.claudeApiWorkspace — 워크스페이스에 묶이지 않은 sk-ant-usr-… 키용, 2026-10-21)
  const API_USE = { auto: 'Claude CLI (Help 서버) — 안 될 때 Claude API', always: 'Claude API', off: 'Claude CLI 만 (API 안 씀)' };
  const apiUseVal = () => { const r = document.querySelector('input[name=apiUse]:checked'); return r && API_USE[r.value] ? r.value : 'auto'; };   // 연결 방식 카드(#llmWayCard, 2026-10-21) — help.api.use
  function setApiModel(m) {   // 목록에 없는 모델(설정에 직접 넣은 것)도 고를 수 있게 한 줄 더함
    const sel = $('apiModel'), v = KRX_CLAUDE_API.modelOf(m);
    if (!sel.options.length) sel.innerHTML = KRX_CLAUDE_API.MODELS.map(([id, label]) => `<option value="${F.esc(id)}">${F.esc(label)}</option>`).join('');
    if (!Array.from(sel.options).some((o) => o.value === v)) sel.insertAdjacentHTML('beforeend', `<option value="${F.esc(v)}">${F.esc(v)}</option>`);
    sel.value = v;
  }
  /* 입력란 기준 상태: { key, use, model, st(이 키·모델로 확인한 결과 — 없으면 확인 전), saved(저장된 키와 같음), ready(자동 분류에 쓸 수 있음) } */
  function apiInfo() {
    const key = $('apiKey').value.trim(), ws = $('apiWs').value.trim(), use = apiUseVal(), model = $('apiModel').value || KRX_CLAUDE_API.DEFAULT_MODEL;
    const st = apiSt && key && apiSt.keyTag === KRX_CLAUDE_API.keyTag(key) && apiSt.model === model ? apiSt : null;
    return { key, ws, use, model, st, saved: key === apiSavedKey && ws === apiSavedWs, ready: !!key && use !== 'off' && !(st && !st.ok) };
  }
  function renderApi(a) {
    a = a || apiInfo();
    const el = $('apiState');
    const [t, cls] = !a.key ? ['키 없음', ''] : a.use === 'off' ? ['사용 안 함', ''] : !a.st ? ['확인 전', ''] : a.st.ok ? [`사용 가능 · ${F.fmtClock(a.st.at)} 확인`, 'on'] : [`오류 · ${F.fmtClock(a.st.at)} 확인`, 'err'];
    el.textContent = t + (a.key && !a.saved ? ' · 저장 안 됨' : ''); el.className = 'llm-state ' + cls;
    $('apiDetail').innerHTML = !a.key ? '' : [
      a.st && !a.st.ok ? `<span class="err">${F.esc(a.st.error || '확인하지 못했습니다')}</span>` : '',
      `키 ${F.esc(KRX_CLAUDE_API.mask(a.key))}${a.saved ? '' : ' (저장 안 됨)'}`, a.ws ? `워크스페이스 ${F.esc(a.ws)}` : '', `모델 ${F.esc(a.st && a.st.name ? `${a.st.name} (${a.model})` : a.model)}`,
      `사용 방식 ${F.esc(API_USE[a.use] || a.use)}`, a.st ? `마지막 확인 ${F.esc(F.fmtClock(a.st.at))}` : '확인 전 — API 확인을 누르세요',
      `쓰는 곳 청구 준비 자동 분류 · 청구내역 작성`].filter(Boolean).map((x) => x.startsWith('<span') ? x : `<span>${x}</span>`).join('');
  }
  async function loadApiKey() {
    apiSavedKey = await KRX_CLAUDE_API.getKey();
    $('apiKey').value = apiSavedKey;
    apiSavedWs = await KRX_CLAUDE_API.getWs();
    $('apiWs').value = apiSavedWs;
    apiSt = await KRX_CLAUDE_API.status();
    renderLlm();
    const a = apiInfo();   // 저장된 키를 확인한 지 오래됐으면(또는 다른 모델로 확인했으면) 조용히 다시 (비용 없음)
    if (a.key && a.use !== 'off' && (!a.st || Date.now() - a.st.at > API_RECHECK_MS)) apiProbe(false).catch(() => {});
  }
  async function saveApiKey() {
    const k = $('apiKey').value.trim();
    if (k) await chrome.storage.local.set({ [KRX_CLAUDE_API.KEY]: k });
    else await chrome.storage.local.remove(KRX_CLAUDE_API.KEY);
    const w = $('apiWs').value.trim();
    if (w) await chrome.storage.local.set({ [KRX_CLAUDE_API.WS]: w });
    else await chrome.storage.local.remove(KRX_CLAUDE_API.WS);
    apiSavedKey = k; apiSavedWs = w; renderLlm();
  }
  async function apiProbe(loud) {
    const a = apiInfo();
    if (!a.key) { if (loud) setStatus('apiProbeStatus', 'API 키를 넣으세요 (Claude Console › API Keys 에서 만듭니다)', true); return null; }
    if (loud) setStatus('apiProbeStatus', 'Claude API 를 확인하는 중…');
    const st = await KRX_CLAUDE_API.check({ key: a.key, model: a.model, ws: a.ws });
    apiSt = st; renderLlm();
    if (loud) setStatus('apiProbeStatus', st.ok ? `사용 가능: ${st.name || st.model}${a.saved ? '' : ' — 저장을 눌러야 자동 분류에 쓰입니다'}` : st.error || '확인하지 못했습니다', !st.ok);
    return st;
  }
  $('btnApiProbe').addEventListener('click', () => { apiProbe(true).catch((e) => setStatus('apiProbeStatus', String((e && e.message) || e), true)); });
  $('btnApiKeyShow').addEventListener('click', () => {
    const show = $('apiKey').type === 'password';
    $('apiKey').type = show ? 'text' : 'password';
    $('btnApiKeyShow').textContent = show ? '가리기' : '보기';
    $('btnApiKeyShow').setAttribute('aria-pressed', String(show));
  });
  ['apiKey', 'apiWs'].forEach((id) => $(id).addEventListener('input', () => { setStatus('apiProbeStatus', ''); renderLlm(); }));
  document.querySelectorAll('input[name=apiUse], #apiModel').forEach((el) => el.addEventListener('change', async () => {
    renderLlm();
    if (el.id === 'apiModel' && apiInfo().key && !apiInfo().st) apiProbe(false).catch(() => {});
    // 연결 방식·모델은 고르면 바로 저장 (2026-10-21 사용자 "왜 api 로 돌리면 cli 로 변경되냐" · "이전 사용 모델을 선택하고" — 저장 단추를 안 눌러 페이지가 다시 열릴 때 되돌아갔음)
    const sid = el.name === 'apiUse' ? 'wayStatus' : 'apiProbeStatus';
    try { await S.save(read()); savedFolder = $('plusFolder').value.trim(); setStatus(sid, `${el.name === 'apiUse' ? API_USE[el.value] : el.options[el.selectedIndex].text} — 저장했습니다`); }
    catch (e) { setStatus(sid, `저장 실패: ${e.message || e}`, true); }
  }));
  try { chrome.storage.onChanged.addListener((ch, area) => { if (area !== 'local') return; if (ch[KRX_CLAUDE_API.STATUS]) { apiSt = ch[KRX_CLAUDE_API.STATUS].newValue || null; renderLlm(); } if (ch[KRX_CLAUDE_API.KEY]) { apiSavedKey = String(ch[KRX_CLAUDE_API.KEY].newValue || ''); renderLlm(); } if (ch[KRX_CLAUDE_API.WS]) { apiSavedWs = String(ch[KRX_CLAUDE_API.WS].newValue || ''); renderLlm(); } }); } catch (e) {}   // 자동 분류의 결과(성공 · 키 오류)도 반영

  /* ---------- 공유 (Plus) 탭 — 과제별 공유 폴더 (background.js shareSync(메시지 'planSync' · 'planSyncQueue') · shareProbe · shareFolderCopy · shareOrgLink · shareFolderPeople · shareRename, lib/sp-store.js · lib/prjdoc.js · lib/prjdoc-sync.js).
   * 2026-10-18 사용자 지정: "아니 mcp 없이 grph api 하지 않고 브라우저 토큰으로 하라고" → (저녁) "onedrive 에 업무/shared 안에 과제별로 .. 약칭으로 없으면 jobid 없으면 임시번호. 이렇게 하고 여기에 넣자. 년차별로 1개 파일이고 1개 파일에서 변경사항이랑 다 관리했으면 좋겠어. 과제 정보랑 등등."
   *   → "그리고 참여연구원들에게 공유할 수 있게 설정까지 같이해줘. .. 그리고 workspace 에도 경로주면 알아서 동기화" → "예상지출도 다 들어 가겠지? 이건 별도 파일에서 해도 되긴하는데 알아서 해줘."
   *   밑폴더(base) = plus.folder, 비면 내 OneDrive 의 문서/업무/shared. 과제 폴더 = base/<약칭 → Job Id → 과제번호>/ 에 <n>차년도.json(과제 정보 · 예산 줄 · 참여연구원 계획 · 연구내용 · 변경이력) + 예상비용.json(모든 연차의 예상 비용 — 별도 파일).
   *   설정 plus = { enabled, folder, planSync, researchSync, staffSync, changesSync, sitesSync(자주 사용 가맹점 — common/가맹점.json, lib/sites-sync.js), discover(나와 공유 자동 찾기), shareWith('participants' | 'none' — 폴더를 만들 때 참여연구원에게 자동 공유) } (driveHost 는 기본값 — 칸 없음).
   * storage.local.shareState (v2) = { at, ok, reason, ms, base:{ path, viewUrl }(v1 은 folder), count(과제), files(쓴/읽은 파일 수), written, pulled, errors, error?, kind?,
   *   pages:{ [prjNo]: { prjNo, title, folder(폴더 이름), folderUrl(보기 주소), webUrl(현재 연차 파일), owner?(남의 폴더면 사이트 주인 — 나와 공유로 찾은 것), years:[n…], at, created, pulled, pushed, count, counts{ plan, research, staff, budget, changes }, remoteAt, remoteBy,
   *     noFolder?(폴더가 없고 내가 만들 자격(책임자·로컬 자료)도 없음), error?, kind?, share?{ shared:[{ name, email }], ambiguous:[{ name, candidates:[…] }], notFound:[name], error? }(자동 공유 결과) } }, index }
   * 메시지 응답(background.js — 모양이 조금 달라도 읽히게 느슨하게 받는다):
   *   shareProbe → { ok, folder:{ path, viewUrl, url }, folders:[{ name, path, itemCount, modified }], count, exists, mine, shared(나와 공유의 폴더 수 — 경로와 상관없이), sharedFolders:[{ name, webUrl, ownerName }], sharedKnown, message } | { ok:false, kind, message, error }
   *   shareFolderCopy { prjNo? } → { ok, copied, url, what:'project'|'base', folder:{ path, viewUrl } } · shareOrgLink { prjNo? } → { ok, url, copied, folder } · shareFolderPeople { prjNo, names? } → { ok, prjNo, folder(이름), share:{ shared:[{ name, email }], ambiguous:[{ name, candidates }], notFound:[name], error? }, message } · shareRename { prjNo, name } → { ok, prjNo, name(다듬은 이름), unchanged? }
   * 오류 kind(KRX_SP.describe): badurl · auth · offline · nofolder · notfound · locked · parse · http · tab — 문구가 없으면 SHARE_KIND 로 읽히게. auth 면 OneDrive 를 여는 링크를 붙인다(이 브라우저에서 로그인하면 끝) ---------- */
  const SHARE_KIND = { auth: '이 브라우저에서 SharePoint(OneDrive)에 로그인하세요', offline: '네트워크에 연결할 수 없습니다', badurl: '폴더 주소를 읽을 수 없습니다 — 공유 링크 대신 폴더를 연 뒤 주소창의 주소를 넣으세요', nofolder: '폴더가 없습니다 — 주소를 확인하세요 (내 OneDrive 의 업무/shared 는 동기화 때 만들어짐)', notfound: '파일이 없습니다', locked: '다른 사람이 파일을 편집 중(체크아웃)입니다 — 다음 동기화 때 다시', parse: '파일을 읽을 수 없습니다(다른 판이거나 깨진 JSON) — 그 파일은 건너뜀', http: 'SharePoint 가 오류를 돌려주었습니다', tab: 'SharePoint 작업 탭을 열지 못했습니다' };
  const BASE_LABEL = '내 OneDrive 의 문서/업무/shared';
  const shareErrText = (r) => (r && (r.error || r.message)) || (r && SHARE_KIND[r.kind]) || (r && r.kind) || '';
  const shareFail = (r, what) => (r ? `${what}${r.kind ? ` (${r.kind})` : ''}: ${shareErrText(r)}` : '응답 없음 — 확장을 다시 올린 뒤 다시 해 보세요');
  const driveHost = () => String((S.DEFAULTS.plus && S.DEFAULTS.plus.driveHost) || 'https://krclass-my.sharepoint.com').replace(/\/+$/, '');
  const countOf = (v) => (Array.isArray(v) ? v.length : (v == null || v === '' || typeof v === 'boolean' ? null : F.num(v)));   // 목록이든 수든 — 없으면 null
  const namesOf = (v) => (Array.isArray(v) ? v.map((x) => (x && typeof x === 'object' ? String(x.name || x.folder || x.title || '') : String(x || ''))).filter(Boolean) : []);
  const listOf = (v) => (Array.isArray(v) ? v : []);
  let savedFolder = '';            // 저장된 plus.folder (fill · 저장 · 연결 확인 뒤) — 칸의 값이 이것과 다르면 풀린 경로를 보이지 않는다
  let shareFolderInfo = null;      // 지금 풀린 밑폴더 { path, viewUrl } — 연결 확인 결과 · shareState.base · storage.local.shareFolder 캐시 중 가장 새것
  let shareFolderAt = 0;           // 그것을 얻은 시각 (shareState.at 과 비교)
  let sharePagesCache = {};        // 표에 그린 pages (단추의 prjNo → 폴더 이름 등)
  /* 백그라운드가 주는 폴더 모양 맞추기 — shareState.base(v1 folder)는 { path, viewUrl }, shareFolder 캐시(KRX_SP.parseFolder 결과)는 folderPath · viewUrl */
  const folderOf = (f) => (f && typeof f === 'object' ? { path: String(f.path || f.folderPath || ''), viewUrl: String(f.viewUrl || '') } : null);
  const takeFolder = (f, at) => { const o = folderOf(f); if (o && (o.path || o.viewUrl) && (at || 0) >= shareFolderAt) { shareFolderInfo = o; shareFolderAt = at || 0; } };
  const baseOf = (st) => (st && (st.base || st.folder)) || null;
  const loginUrl = () => (shareFolderInfo && shareFolderInfo.viewUrl) || driveHost();
  /* 사라지지 않는 상태 줄(.share-state — 연결 확인 결과 · 표 아래 단추 결과): setStatus 는 4초 뒤 지우므로 주소·이름 목록처럼 읽어야 하는 글은 이것으로. link 가 있으면 "OneDrive 열기" 를 붙인다(로그인 필요 때) */
  function setStay(id, text, cls, link) {
    const el = $(id);
    el.className = 'share-state' + (cls ? ` ${cls}` : '');
    el.innerHTML = text ? `${F.esc(text)}${link ? ` · <a href="${F.esc(link)}" target="_blank" rel="noopener">OneDrive 열기</a>` : ''}` : '';
    el.title = text || '';
  }
  const setShareProbe = (text, cls, link) => setStay('shareProbeState', text, cls, link);
  const setPagesStatus = (text, cls, link) => setStay('plusPagesStatus', text, cls, link);
  /* 클립보드: 사용자 클릭 안이라 이 페이지에서 바로 — 안 되면 false(백그라운드가 copied 를 줬으면 그걸로) */
  async function copyText(text) { try { await navigator.clipboard.writeText(String(text)); return true; } catch (e) { return false; } }
  /* 칸의 주소가 저장된 것과 다르면 먼저 저장(백그라운드는 설정 plus.folder 를 읽는다) → 실패하면 statusId 에 알리고 false */
  async function ensureSaved(statusId) {
    if ($('plusFolder').value.trim() === savedFolder) return true;
    try { await S.save(read()); savedFolder = $('plusFolder').value.trim(); return true; } catch (e) { setStatus(statusId, `설정 저장 실패: ${e.message || e}`, true); return false; }
  }
  /* 지금 쓰는 밑폴더 줄: 칸이 비면 "내 OneDrive 의 문서/업무/shared", 아니면 "붙여 넣은 폴더" — 풀린 경로가 있으면 함께, 폴더 열기 링크는 viewUrl 이 있을 때만 */
  function renderShareFolder() {
    const typed = $('plusFolder').value.trim(), fresh = typed === savedFolder, f = fresh ? shareFolderInfo : null;
    const el = $('shareFolderNow');
    el.textContent = !fresh ? '주소 변경됨 · 연결 확인 또는 저장이 필요합니다'
      : f && f.path ? f.path.split('/').filter(Boolean).slice(-3).join(' / ')
      : typed ? '입력한 폴더 · 연결 확인 전' : '내 OneDrive · 문서 / 업무 / shared';
    el.title = f && f.path ? f.path : '';
    el.classList.toggle('muted', !(f && f.path));
    const open = $('shareFolderOpen');
    open.hidden = !(f && f.viewUrl);
    if (f && f.viewUrl) open.href = f.viewUrl;
  }
  function updateShareSummary() {   // 과제별 공유 칩(꺼짐 · 과제 범위 · 선택 항목 수) + 공유 (Plus) 탭 이름 옆 칩(켜짐/꺼짐)
    const on = $('plusEnabled').checked, prjOn = $('plusProjectSync').checked, pick = shareScopeVal() === 'pick';
    const parts = [$('plusPlanSync').checked && '예상 비용', $('plusResearchSync').checked && '연구내용', $('plusStaffSync').checked && '사업비', $('plusChangesSync').checked && '변경이력'].filter(Boolean);
    $('plusSummary').textContent = !prjOn ? '꺼짐' : `${pick ? `${sharePrjSel.size}개 과제` : '전체 과제'} · ${parts.length} / 4 항목`;
    $('plusPrjPick').closest('.share-sync-settings').classList.toggle('share-off', !prjOn);
    $('plusSummary').title = parts.join(' · ') || '선택한 항목 없음';
    const b = $('shareBadge'); b.textContent = on ? '켜짐' : '꺼짐'; b.className = 'tab-badge ' + (on ? 'on' : 'off');
  }
  $('plusEnabled').addEventListener('change', () => { updateShareSummary(); showShareState(); });
  $('plusFolder').addEventListener('input', () => { updateShareSummary(); renderShareFolder(); });
  ['plusPlanSync', 'plusResearchSync', 'plusStaffSync', 'plusChangesSync', 'plusSitesSync', 'plusShareWith', 'plusDiscover', 'plusProjectSync'].forEach((id) => $(id).addEventListener('change', updateShareSummary));
  /* 과제별 공유 › 공유할 과제 (2026-10-22 사용자 "과제별로 공유할때는 공유설정에 전체/과제별"): 라디오 plusScope(all | pick) · 고른 과제만이면 #plusPrjPick 에 참여 과제(projectList — 별칭 projectAliases)의 체크.
   *   고른 것은 sharePrjSel → 저장 때 plus.projects. 목록에 없는 과제번호(참여가 끝난 과제 등)도 골라 둔 것이면 줄로 남겨 풀 수 있게 */
  let sharePrjSel = new Set();
  const shareScopeVal = () => { const r = document.querySelector('input[name=plusScope]:checked'); return r && r.value === 'pick' ? 'pick' : 'all'; };
  function setShareScope(v) { document.querySelectorAll('input[name=plusScope]').forEach((r) => { r.checked = r.value === v; }); }
  /* 참여 과제 체크 목록의 html — 과제별 공유(#plusPrjPick, data-share-prj) · 전체 공유의 가맹점(#plusSitesPrjPick, data-sites-prj)이 같이 쓴다. extra(prjNo) 는 줄 끝에 붙일 html(가맹점 공유 결과) */
  async function prjPickHtml(sel, attr, extra) {
    let aliases = {};
    try { aliases = (await chrome.storage.local.get('projectAliases')).projectAliases || {}; } catch (e) {}
    const projects = ((projectList && projectList.projects) || []).filter((p) => p && p.prjNo);
    const known = new Set(projects.map((p) => String(p.prjNo)));
    const rows = projects.map((p) => ({ prjNo: String(p.prjNo), prjNm: p.prjNm || '' })).concat(Array.from(sel).filter((no) => !known.has(no)).map((no) => ({ prjNo: no, prjNm: '(참여 과제 목록에 없음)' })));
    return rows.length
      ? rows.map((p) => `<label title="${F.esc(p.prjNm)}"><input type="checkbox" ${attr}="${F.esc(p.prjNo)}"${sel.has(p.prjNo) ? ' checked' : ''}> <b>${F.esc(aliases[p.prjNo] || p.prjNo)}</b>${aliases[p.prjNo] ? ` <span class="no">${F.esc(p.prjNo)}</span>` : ''} <span class="nm">${F.esc(p.prjNm)}</span>${extra ? extra(p.prjNo) : ''}</label>`).join('')
      : '<div class="share-prj-empty">참여 과제 목록이 아직 없습니다 — 일반 설정 › 과제 선택의 <b>과제 목록 새로고침</b>을 누르세요.</div>';
  }
  async function renderSharePrj() {
    const box = $('plusPrjPick'); if (!box) return;
    box.hidden = shareScopeVal() !== 'pick';
    box.innerHTML = await prjPickHtml(sharePrjSel, 'data-share-prj');
    updateShareSummary();
  }
  document.querySelectorAll('input[name=plusScope]').forEach((r) => r.addEventListener('change', () => { renderSharePrj(); }));
  /* 전체 공유 › 가맹점을 공유할 과제 (2026-10-22 사용자 "이거 과제별로 공유할 수 있게 해줘야지"): 라디오 plusSitesScope(all | pick) · 고른 과제만이면 #plusSitesPrjPick 에 참여 과제 체크 + 과제마다 공유 결과.
   *   고른 것은 sitesPrjSel → 저장 때 plus.sitesProjects. 백그라운드 자동 공유(shareSitesPeople)는 저장된 설정으로, [동료에게 공유]는 지금 라디오·체크로 그 과제들의 참여인력에게 common 폴더를 읽기로 */
  let sitesPrjSel = new Set();
  const sitesScopeVal = () => { const r = document.querySelector('input[name=plusSitesScope]:checked'); return r && r.value === 'pick' ? 'pick' : 'all'; };
  function setSitesScope(v) { document.querySelectorAll('input[name=plusSitesScope]').forEach((r) => { r.checked = r.value === v; }); }
  /* 과제 하나의 가맹점 폴더 공유 결과 — shareSitesPeople.byPrj[prjNo](그 과제에서 찾은 참여인력, 내 이름 제외) × res(이름마다 결과). 한 번도 찾지 않은 과제는 빈 칸 */
  function sitesPrjState(rec, no) {
    const names = rec && rec.byPrj && Array.isArray(rec.byPrj[no]) ? rec.byPrj[no] : null;
    if (!names) return '';
    if (!names.length) return '<span class="st">나 말고 참여인력 없음</span>';
    const res = (rec && rec.res) || {}, by = (k) => names.filter((n) => res[n] === k);
    const ok = by('shared'), amb = by('ambiguous'), nf = by('notFound'), fl = by('failed'), wait = names.filter((n) => !res[n]);
    const tip = [ok.length && `공유: ${ok.join(', ')}`, amb.length && `이름 겹침: ${amb.join(', ')}`, nf.length && `못 찾음: ${nf.join(', ')}`, fl.length && `실패: ${fl.join(', ')}`, wait.length && `아직: ${wait.join(', ')}`].filter(Boolean).join('\n');
    const txt = [`공유 ${ok.length}/${names.length}명`, amb.length && `이름 겹침 ${amb.length}`, nf.length && `못 찾음 ${nf.length}`, fl.length && `실패 ${fl.length}`].filter(Boolean).join(' · ');
    return `<span class="st${amb.length || nf.length || fl.length ? ' warn' : ok.length === names.length ? ' ok' : ''}" title="${F.esc(tip)}">${F.esc(txt)}</span>`;
  }
  async function renderSitesPrj() {
    const box = $('plusSitesPrjPick'); if (!box) return;
    box.hidden = sitesScopeVal() !== 'pick';
    let rec = {};
    try { rec = (await chrome.storage.local.get('shareSitesPeople')).shareSitesPeople || {}; } catch (e) {}
    box.innerHTML = await prjPickHtml(sitesPrjSel, 'data-sites-prj', (no) => sitesPrjState(rec, no));
    updateSitesSummary();
  }
  function updateSitesSummary() {   // 전체 공유 칩: common · 꺼짐 | 전체 과제 | n개 과제
    const on = $('plusSitesSync').checked, pick = sitesScopeVal() === 'pick';
    $('plusSitesSummary').textContent = `common · ${!on ? '꺼짐' : pick ? `${sitesPrjSel.size}개 과제` : '전체 과제'}`;
    $('plusSitesSummary').title = !on ? '자주 사용 가맹점 공유 꺼짐' : pick ? '고른 과제의 참여연구원에게 가맹점 폴더를 읽기로 공유' : '참여 과제 전체의 참여연구원에게 가맹점 폴더를 읽기로 공유';
    $('plusSitesPrjPick').closest('.share-common').classList.toggle('share-off', !on);
  }
  document.querySelectorAll('input[name=plusSitesScope]').forEach((r) => r.addEventListener('change', () => { renderSitesPrj(); renderFetchShare(); }));
  $('plusSitesPrjPick').addEventListener('change', (ev) => {
    const cb = ev.target.closest('input[data-sites-prj]'); if (!cb) return;
    if (cb.checked) sitesPrjSel.add(cb.dataset.sitesPrj); else sitesPrjSel.delete(cb.dataset.sitesPrj);
    updateSitesSummary(); renderFetchShare();
  });
  $('plusPrjPick').addEventListener('change', (ev) => {
    const cb = ev.target.closest('input[data-share-prj]'); if (!cb) return;
    if (cb.checked) sharePrjSel.add(cb.dataset.sharePrj); else sharePrjSel.delete(cb.dataset.sharePrj);
    updateShareSummary();
  });
  /* 동료에게 공유하는 법: 카드 설명 접기(initDescFold)와 같은 ⓘ 배지(.desc-toggle)로 #shareHowGuide 를 펼친다. 펼친 상태는 storage.local.optShareGuide (initDescFold 의 optHelp 와 따로 — 서로 덮어쓰지 않게) */
  (async () => {
    const btn = $('btnShareHow'), guide = $('shareHowGuide');
    btn.innerHTML = `${ICON_INFO}<span>동료에게 공유하는 법</span>`;
    let open = false; try { open = !!(await chrome.storage.local.get('optShareGuide')).optShareGuide; } catch (e) {}
    const apply = (o) => { guide.hidden = !o; btn.classList.toggle('on', o); btn.setAttribute('aria-expanded', String(o)); btn.title = o ? '안내 접기' : '동료에게 공유하는 법 보기'; };
    apply(open);
    btn.addEventListener('click', () => { open = !open; apply(open); try { chrome.storage.local.set({ optShareGuide: open }); } catch (e) {} });
  })();
  /* 연결 확인: 지금 칸의 주소로 — 백그라운드가 설정 plus.folder 를 읽으므로 먼저 저장. shareProbe → { ok, base|folder, folders(과제 폴더), shared|discovered(나와 공유에서 찾은 수), files, exists, mine, message } | { ok:false, kind, error } */
  $('btnShareProbe').addEventListener('click', async () => {
    try { await S.save(read()); savedFolder = $('plusFolder').value.trim(); } catch (e) { setShareProbe(`설정 저장 실패: ${e.message || e}`, 'err'); return; }
    setShareProbe('공유 폴더에 연결하는 중…', 'run');
    $('shareProbeState').title = '';
    let r = null;
    try { r = await chrome.runtime.sendMessage({ type: 'shareProbe', folder: savedFolder }); } catch (e) { r = null; }
    if (r && r.ok) {
      takeFolder(baseOf(r), Date.now());
      renderShareFolder();
      const folders = r.folders != null ? r.folders : r.projectFolders;
      const nf = countOf(folders), fnames = namesOf(folders).slice(0, 8);
      const ns = countOf(r.shared != null ? r.shared : (r.discovered != null ? r.discovered : r.sharedWithMe));
      const parts = [`연결됨${r.mine ? ' (내 OneDrive)' : ''}`];
      if (nf != null) parts.push(`과제 폴더 ${nf}개`);
      else if (countOf(r.files) != null) parts.push(`파일 ${countOf(r.files)}건`);
      if (ns != null) parts.push(`공유받은 폴더 ${ns}개`);
      if (nf == null && ns == null && r.message) parts.push(String(r.message));
      if (r.exists === false) parts.push('폴더가 아직 없습니다 — 지금 동기화하면 만듭니다');
      setShareProbe(parts.join(' · '), 'on');
      $('shareProbeState').title = [(shareFolderInfo && shareFolderInfo.path) || '', fnames.join(', ')].filter(Boolean).join('\n');
    } else {
      renderShareFolder();
      setShareProbe(shareFail(r, '연결 실패'), 'err', r && r.kind === 'auth' ? loginUrl() : '');
    }
  });
  /* 주소 복사: 풀린 밑폴더의 viewUrl 을 이 페이지에서 복사(사용자 클릭 안이라 바로 됨). 아직 모르면 백그라운드 shareFolderCopy(폴더를 풀어 복사) → { ok, copied, url|viewUrl|folder } */
  $('btnShareFolderCopy').addEventListener('click', async () => {
    try {
      let url = $('plusFolder').value.trim() === savedFolder && shareFolderInfo ? shareFolderInfo.viewUrl : '';
      if (!url) {
        if (!(await ensureSaved('shareFolderStatus'))) return;
        let r = null;
        try { r = await chrome.runtime.sendMessage({ type: 'shareFolderCopy' }); } catch (e) { r = null; }
        if (!r || !r.ok) { setStatus('shareFolderStatus', shareFail(r, '복사 실패'), true); return; }
        url = String(r.url || r.viewUrl || (r.folder && r.folder.viewUrl) || '');
        if (r.folder) { takeFolder(r.folder, Date.now()); renderShareFolder(); }
        if (!url) { setStatus('shareFolderStatus', '밑폴더 주소를 복사했습니다 — 동료의 공유 폴더 주소 칸에 붙여 넣으면 됩니다'); return; }   // 백그라운드가 복사까지 한 경우
      }
      await navigator.clipboard.writeText(url);
      setStatus('shareFolderStatus', `밑폴더 주소를 복사했습니다: ${url} — 동료의 공유 폴더 주소 칸에 붙여 넣으면 됩니다`);
    } catch (e) { setStatus('shareFolderStatus', `복사하지 못했습니다: ${String((e && e.message) || e)}`, true); }
  });
  /* 조직 내 편집 링크: shareOrgLink { prjNo? } → { ok, url, copied } — prjNo 가 없으면 밑폴더, 있으면 그 과제 폴더. 백그라운드가 복사까지 했으면(copied) 그대로, 아니면 이 페이지에서. 결과는 사라지지 않는 줄에(주소를 읽어 쓸 수 있게) */
  async function orgLink(prjNo, stayId, statusId) {
    if (!(await ensureSaved(statusId))) return;
    setStay(stayId, `${prjNo ? '과제 폴더' : '밑폴더'}의 조직 내 편집 링크를 만드는 중…`, 'run');
    let r = null;
    try { r = await chrome.runtime.sendMessage(Object.assign({ type: 'shareOrgLink' }, prjNo ? { prjNo } : {})); } catch (e) { r = null; }
    if (!r || !r.ok || !r.url) { setStay(stayId, shareFail(r, '링크 만들기 실패'), 'err', r && r.kind === 'auth' ? loginUrl() : ''); return; }
    const copied = !!r.copied || await copyText(r.url);
    const what = prjNo ? `과제 ${prjNo} 폴더` : '밑폴더';
    setStay(stayId, `${what}의 조직 내 편집 링크를 ${copied ? '복사했습니다' : '만들었습니다 (복사는 못 함 — 직접 복사하세요)'}: ${r.url} — 회사 계정으로 로그인한 사람은 누구나 열고 편집할 수 있고, 받은 사람이 한 번 열면 "나와 공유" 에 들어와 자동으로 찾아집니다`, copied ? 'on' : 'err');
  }
  $('btnShareOrgLink').addEventListener('click', () => orgLink('', 'shareProbeState', 'shareFolderStatus'));
  /* 참여연구원에게 공유 결과 → 글 (shareFolderPeople 응답 또는 pages[prj].share): "공유 n명(이름) · 이름 겹침 n(이름: 후보…) · 못 찾음 n(이름)" — 이메일은 title 에만 */
  function shareResultText(s) {
    s = (s && typeof s === 'object') ? (s.share && typeof s.share === 'object' && !Array.isArray(s.share) ? s.share : s) : null;
    if (!s) return '';
    const shared = listOf(s.shared), amb = listOf(s.ambiguous), nf = listOf(s.notFound);
    const nm = (x) => (x && typeof x === 'object' ? String(x.name || x.DisplayText || '') : String(x || ''));
    const parts = [];
    if (shared.length) parts.push(`공유 ${shared.length}명 (${shared.map(nm).filter(Boolean).join(', ')})`);
    if (amb.length) parts.push(`이름 겹침 ${amb.length} (${amb.map((a) => `${nm(a)}${listOf(a && a.candidates).length ? `: ${listOf(a.candidates).slice(0, 3).join('/')}` : ''}`).join(', ')})`);
    if (nf.length) parts.push(`못 찾음 ${nf.length} (${nf.map(nm).filter(Boolean).join(', ')})`);
    if (s.error) parts.push(`오류: ${String(s.error)}`);
    return parts.join(' · ') || (s.at || s.ok ? '공유할 사람 없음' : '');
  }
  function shareResultHtml(s) {
    s = (s && typeof s === 'object') ? (s.share && typeof s.share === 'object' && !Array.isArray(s.share) ? s.share : s) : null;
    if (!s) return '';
    const shared = listOf(s.shared), amb = listOf(s.ambiguous), nf = listOf(s.notFound);
    const nm = (x) => (x && typeof x === 'object' ? String(x.name || x.DisplayText || '') : String(x || ''));
    const parts = [];
    if (shared.length) parts.push(`<span class="ok" title="${F.esc(shared.map((x) => (x && x.email) ? `${nm(x)} <${x.email}>` : nm(x)).join(', '))}">공유 ${shared.length}명</span> (${F.esc(shared.map(nm).filter(Boolean).join(', '))})`);
    if (amb.length) parts.push(`<span class="warn" title="같은 이름이 여럿 — OneDrive 에서 직접 고르세요">이름 겹침 ${amb.length}</span> (${F.esc(amb.map((a) => `${nm(a)}${listOf(a && a.candidates).length ? `: ${listOf(a.candidates).slice(0, 3).join('/')}` : ''}`).join(', '))})`);
    if (nf.length) parts.push(`<span class="warn" title="SharePoint 사람 찾기에 없는 이름 — OneDrive 에서 직접 공유하세요">못 찾음 ${nf.length}</span> (${F.esc(nf.map(nm).filter(Boolean).join(', '))})`);
    if (s.error) parts.push(`<span class="err">오류: ${F.esc(s.error)}</span>`);
    return parts.join(' · ') || '<span class="muted">공유할 사람 없음</span>';
  }
  /* 참여연구원에게 공유: shareFolderPeople { prjNo, names?(없으면 rERP 참여인력 전부) } → { ok, shared, ambiguous, notFound, error? } — 결과는 표 아래 줄에, 표의 공유 칸은 shareState 가 갱신되면 따라온다 */
  async function sharePeople(prjNo) {
    if (!(await ensureSaved('plusSyncStatus'))) return;
    setPagesStatus(`과제 ${prjNo} 폴더를 R&D ERP 참여인력에게 공유하는 중… (SharePoint 에서 사람을 찾습니다)`, 'run');
    let r = null;
    try { r = await chrome.runtime.sendMessage({ type: 'shareFolderPeople', prjNo }); } catch (e) { r = null; }
    if (!r || !r.ok) { setPagesStatus(shareFail(r, `과제 ${prjNo} 공유 실패`), 'err', r && r.kind === 'auth' ? loginUrl() : ''); return; }
    const txt = shareResultText(r);
    const bad = listOf((r.share || r).ambiguous).length || listOf((r.share || r).notFound).length;
    setPagesStatus(`과제 ${prjNo} 폴더 공유 — ${txt || '결과 없음'}${bad ? ' · 겹침·못 찾음은 폴더 이름을 눌러 OneDrive 에서 직접 공유하세요' : ''}`, bad ? 'err' : 'on');
    showShareState();
  }
  /* 폴더 이름 바꾸기(선택): shareRename { prjNo, name } — 폴더 이름은 표시용이라 바꿔도 과제는 파일 안의 과제번호로 알아본다 */
  async function renameFolder(prjNo, cur) {
    const name = prompt(`과제 ${prjNo} 폴더의 새 이름 (파일 이름에 못 쓰는 글자는 빠짐 · 60자):`, cur || '');
    if (name == null) return;
    const nm = name.trim();
    if (!nm || nm === cur) return;
    if (!(await ensureSaved('plusSyncStatus'))) return;
    setPagesStatus(`과제 ${prjNo} 폴더 이름을 "${nm}" 으로 바꾸는 중…`, 'run');
    let r = null;
    try { r = await chrome.runtime.sendMessage({ type: 'shareRename', prjNo, name: nm }); } catch (e) { r = null; }
    if (!r || !r.ok) { setPagesStatus(shareFail(r, `이름 바꾸기 실패`), 'err', r && r.kind === 'auth' ? loginUrl() : ''); return; }
    const done = String(r.name || r.folder || nm);   // 백그라운드가 다듬은 이름(KRX_PRJDOC.folderNameFor — 못 쓰는 글자 제거 · 60자)
    if (r.unchanged) { setPagesStatus(`과제 ${prjNo} 폴더 이름이 이미 "${done}" 입니다`, 'on'); return; }
    setPagesStatus(`과제 ${prjNo} 폴더 이름을 "${done}" 으로 바꿨습니다 — 다음 동기화부터 새 이름으로 보입니다`, 'on');
    showShareState();
  }
  $('plusPages').addEventListener('click', (ev) => {   // 표의 단추: 참여연구원에게 공유 · 링크 복사 · 이름 바꾸기
    const b = ev.target.closest('[data-share-act]');
    if (!b) return;
    ev.preventDefault();
    const prjNo = String(b.dataset.prj || ''), act = b.dataset.shareAct;
    if (!prjNo) return;
    if (act === 'people') sharePeople(prjNo);
    else if (act === 'link') orgLink(prjNo, 'plusPagesStatus', 'plusSyncStatus');
    else if (act === 'rename') renameFolder(prjNo, String((sharePagesCache[prjNo] || {}).folder || b.dataset.name || ''));
  });
  /* 지금 동기화: 칸의 값(폴더 · 항목)으로 맞추도록 먼저 저장 → planSync manual → 결과 state { ok, count, files, written, pulled, errors, error?, kind?, pages, base } · 꺼져 있으면 { skipped:'off', missing:[…] } */
  async function plusSyncNow() {
    try { await S.save(read()); savedFolder = $('plusFolder').value.trim(); } catch (e) { setStatus('plusSyncStatus', `설정 저장 실패: ${e.message || e}`, true); return; }
    setStatus('plusSyncStatus', '공유 폴더의 과제 파일과 맞추는 중…');
    let r = null;
    try { r = await chrome.runtime.sendMessage({ type: 'planSync', reason: 'manual' }); } catch (e) { r = null; }
    if (r && r.ok) setStatus('plusSyncStatus', `동기화했습니다${r.ms ? ` (${r.ms} ms)` : ''}: 과제 ${F.num(r.count) || Object.keys(r.pages || {}).length}건${countOf(r.files) != null ? ` · 파일 ${countOf(r.files)}개` : ''} · 씀 ${F.num(r.written)}건 · 받음 ${F.num(r.pulled)}건${r.errors ? ` · 오류 ${r.errors}건 (아래 표)` : ''}`, !!r.errors);
    else if (r && r.skipped === 'off') setStatus('plusSyncStatus', `동기화하려면 먼저 이것을 해 주세요: ${(r.missing || []).join(' · ') || '공유 (Plus) 체크'}`, true);
    else if (r && r.skipped) setStatus('plusSyncStatus', `건너뜀 (${r.skipped})`, true);
    else setStatus('plusSyncStatus', r ? `${shareFail(r, '동기화 실패')}${r.errors > 1 ? ` 외 ${r.errors - 1}건` : ''}` : '응답 없음', true);
    showShareState();
  }
  $('btnPlusSyncNow').addEventListener('click', plusSyncNow);
  /* 마지막 동기화 결과(storage.local.shareState) + 과제별 표(과제번호 · 과제명 · 폴더(열기 · 주인) · 연차 파일 수(현재 연차 열기) · 동기화 시각 · 파일 수정(누가) · 공유 결과 + 단추 · 상태). 밑폴더는 shareState.base(v1 folder), 없으면 shareFolder 캐시로 */
  async function showShareState() {
    let st = null, sf = null, pl = projectList;
    try {
      const l = await chrome.storage.local.get(['shareState', 'shareFolder', 'projectList']);
      st = l.shareState || null; sf = l.shareFolder || null; pl = pl || l.projectList || null;
    } catch (e) {}
    if (baseOf(st)) takeFolder(baseOf(st), st.at || 1); else if (sf && !shareFolderInfo) takeFolder(sf, 1);
    const names = {}; for (const p of (pl && pl.projects) || []) if (p && p.prjNo) names[p.prjNo] = p.prjNm || '';
    const pages = (st && st.pages && typeof st.pages === 'object') ? st.pages : {};
    sharePagesCache = pages;
    const list = Object.values(pages).filter((c) => c && typeof c === 'object');
    const nOwner = list.filter((c) => c.owner).length, nNoFolder = list.filter((c) => c.noFolder).length;
    let line = '';
    if (st && st.at) {
      const when = F.fmtClock(st.at);
      line = st.ok
        ? `마지막 동기화 ${when} — 과제 ${F.num(st.count) || Object.keys(pages).length}건${countOf(st.files) != null ? ` · 파일 ${countOf(st.files)}개` : ''} · 씀 ${F.num(st.written)}건 · 받음 ${F.num(st.pulled)}건${nOwner ? ` · 공유받은 폴더 ${nOwner}개` : ''}${nNoFolder ? ` · <span class="warn">폴더 없음 ${nNoFolder}건</span>` : ''}${st.errors ? ` · <span class="err">오류 ${st.errors}건</span>` : ''}`
        : `<span class="err">마지막 동기화 ${when} 실패 — ${F.esc(shareErrText(st))}${st.errors > 1 ? ` 외 ${st.errors - 1}건` : ''}</span>${st.kind === 'auth' ? ` · <a href="${F.esc(loginUrl())}" target="_blank" rel="noopener">OneDrive 열기</a>` : ''}`;
    } else line = $('plusEnabled').checked ? '아직 동기화하지 않았습니다 — 패널·팝업을 열거나 지금 동기화를 누르면 시작됩니다' : '';
    $('plusSyncState').innerHTML = line;
    const COUNT_LABEL = { plan: '예상 비용', research: '연구내용', staff: '참여연구원 계획', budget: '예산 줄', changes: '변경이력' };
    const rows = Object.entries(pages).sort(([a], [b]) => a.localeCompare(b)).map(([key, c]) => {
      c = (c && typeof c === 'object') ? c : {};
      const prjNo = String(c.prjNo || key), folder = String(c.folder || '');
      // 폴더: 이름(보기 주소로 열기) + 남의 폴더면 주인 칩. 폴더가 없으면 까닭(noFolder — 책임자가 만들거나 공유받기를 기다림)
      const folderCell = folder
        ? `${c.folderUrl ? `<a href="${F.esc(c.folderUrl)}" target="_blank" rel="noopener" title="SharePoint 에서 이 과제 폴더를 엽니다 — 여기서 공유 › 사람을 넣을 수도 있습니다">${F.esc(folder)}</a>` : F.esc(folder)}${c.owner ? `<span class="share-owner" title="다른 사람의 OneDrive 에 있는 폴더 — 나와 공유에서 찾음">주인 ${F.esc(c.owner)}</span>` : ''}`
        : c.noFolder ? '<span class="warn" title="내가 과제 책임자가 아니고 이 과제의 자료도 아직 없어 폴더를 만들지 않았습니다 — 책임자가 만들어 공유하면 다음 동기화 때 나와 공유에서 찾습니다">폴더 없음 — 책임자가 만들거나 공유받으면 연결</span>'
        : (c.webUrl ? `<a href="${F.esc(c.webUrl)}" target="_blank" rel="noopener">파일</a>` : '<span class="muted">—</span>');
      const years = listOf(c.years).map((n) => F.num(n)).filter((n) => n > 0).sort((a, b) => a - b);
      const yearsCell = years.length
        ? `${years.length}개 <span class="muted">(${years.map((n) => `${n}차년도`).join(' · ')})</span>${c.webUrl ? ` · <a href="${F.esc(c.webUrl)}" target="_blank" rel="noopener" title="현재 연차 파일을 SharePoint 에서 엽니다">현재 연차 열기</a>` : ''}`
        : (c.webUrl ? `<a href="${F.esc(c.webUrl)}" target="_blank" rel="noopener" title="SharePoint 에서 파일을 엽니다">파일 열기</a>` : '');
      const who = c.remoteAt ? `${F.fmtClock(c.remoteAt)}${c.remoteBy ? ` · ${F.esc(c.remoteBy)}` : ''}` : '';
      const counts = (c.counts && typeof c.counts === 'object') ? Object.entries(c.counts).filter(([k, v]) => COUNT_LABEL[k] && F.num(v) > 0).map(([k, v]) => `${COUNT_LABEL[k]} ${F.num(v)}`) : [];
      const flags = [c.created && '폴더·파일 만듦', c.pushed && '씀', c.pulled && '받음',
        c.error && (c.kind === 'locked' ? `<span class="warn">건너뜀 — ${F.esc(c.error)}</span>` : c.kind === 'parse' ? `<span class="warn">파일 건너뜀 — ${F.esc(c.error)}</span>` : `<span class="err">실패${c.kind ? ` (${F.esc(c.kind)})` : ''}: ${F.esc(c.error)}</span>`)].filter(Boolean).join(' · ') || (c.noFolder ? '대기' : '변화 없음');
      const stateCell = `${flags}${counts.length ? `<div class="muted">${F.esc(counts.join(' · '))}</div>` : ''}`;
      // 공유: 자동 공유 결과(share) + 단추 — 내 폴더면 참여연구원에게 공유 · 링크 복사 · 이름 바꾸기, 남의 폴더면 링크 복사만
      const acts = folder && !c.noFolder
        ? (c.owner
          ? `<button type="button" class="btn" data-share-act="link" data-prj="${F.esc(prjNo)}" title="이 과제 폴더의 조직 내 편집 링크를 만들어 복사합니다">링크 복사</button>`
          : `<button type="button" class="btn" data-share-act="people" data-prj="${F.esc(prjNo)}" title="R&D ERP 참여인력(이 과제의 참여연구원)에게 이 폴더를 편집 권한으로 공유합니다 — 이미 공유된 사람은 그대로">참여연구원에게 공유</button><button type="button" class="btn" data-share-act="link" data-prj="${F.esc(prjNo)}" title="이 과제 폴더의 조직 내 편집 링크를 만들어 복사합니다 — 자동 공유가 안 된 사람에게 보내면 한 번 열기만 해도 나와 공유에 들어옵니다">링크 복사</button><button type="button" class="btn" data-share-act="rename" data-prj="${F.esc(prjNo)}" data-name="${F.esc(folder)}" title="폴더 이름을 바꿉니다 — 이름은 표시용이라 과제는 파일 안의 과제번호로 알아봅니다">이름 바꾸기</button>`)
        : '';
      const shareCell = `${c.share ? `<div class="share-res">${shareResultHtml(c.share)}</div>` : (c.owner ? '<div class="share-res muted">공유받은 폴더</div>' : '')}${acts ? `<div class="share-acts">${acts}</div>` : ''}`;
      return `<tr${c.noFolder ? ' class="share-nofolder"' : ''}><td class="share-project"><strong>${F.esc(c.title || names[prjNo] || '')}</strong><span>${F.esc(prjNo)}</span></td><td class="tag folder">${folderCell}<div class="share-file-years">${yearsCell}</div></td><td class="tag share-time">${c.at ? F.fmtClock(c.at) : ''}${who ? `<span>파일 수정 ${who}</span>` : ''}</td><td class="tag share">${shareCell}</td><td class="tag">${stateCell}</td></tr>`;
    });
    $('plusPages').innerHTML = rows.length ? `<div class="prj-list share-files" role="region" aria-label="과제별 동기화 결과" tabindex="0"><table class="prj-table"><thead><tr><th scope="col">과제</th><th scope="col">공유 폴더 · 파일</th><th scope="col">동기화</th><th scope="col">공유 관리</th><th scope="col">상태</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>` : `<div class="share-empty">${$('plusEnabled').checked ? '동기화된 과제가 없습니다. 지금 동기화하면 과제별 결과가 여기에 표시됩니다.' : '공유 사용을 켜면 과제별 자료를 동기화할 수 있습니다.'}</div>`;
    renderShareFolder();
  }
  showShareState();
  try { chrome.storage.onChanged.addListener((ch, area) => { if (area === 'local' && (ch.shareState || ch.shareFolder || ch.projectList)) showShareState(); }); } catch (e) {}

  /* ---------- 급여·연구수당 (HR System) ---------- */
  /* "P3=22" 줄 → { P3: 22 }. 비율이 숫자가 아니면 그 줄은 무시 (비운 직급은 기본값 유지) */
  function parseRates(text) {
    const out = {};
    for (const line of String(text || '').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z]{1,3}\d{1,2})\s*[=:]\s*([\d.]+)\s*%?\s*$/); if (!m) continue;
      out[m[1].toUpperCase()] = Number(m[2]);
    }
    return out;
  }
  async function showHr() {
    const hp = (await chrome.storage.local.get('hrPay')).hrPay || null;
    $('hrOut').textContent = hp ? JSON.stringify(hp, null, 2) : '없음 (HR System 급여명세서를 열면 수집됩니다)';
    const on = $('hrEnabled').checked;
    if (!hp) { $('hrInfo').textContent = ''; $('hrSummary').textContent = on ? '아직 수집 전' : '사용 안 함'; return; }
    const year = String(new Date().getFullYear());
    const y = (hp.years || {})[year] || {};
    const n = Object.keys(y.months || {}).length, total = y.list && y.list.total;
    const parts = [`${year}년 ${n}${total ? '/' + total : ''}개월 수집`];
    if (hp.grade) parts.push(`직급 ${hp.grade} (HR 직원 정보에서 자동 감지)`);
    if (hp.empNo) parts.push(`사번 ${hp.empNo}${hp.name ? ' ' + hp.name : ''}${hp.dept ? ' ' + hp.dept : ''}`);
    if (hp.ts) parts.push(`${F.fmtClock(hp.ts)} 수집`);
    if (hp.scan && hp.scan.note) parts.push(hp.scan.note);
    if (hp.status && hp.status.loginRequired) parts.push(hp.status.eclassLogin ? 'eClass 로그인이 풀려 HR 자동 로그인 못 함' : 'HR System 로그인이 풀려 갱신 못 함');
    else if (hp.status && hp.status.error) parts.push(`오류: ${hp.status.error}`);
    $('hrInfo').textContent = parts.join(' · ');
    $('hrSummary').textContent = on ? `${year}년 ${n}개월 수집${hp.grade ? ` · ${hp.grade}` : ''}` : '사용 안 함';
  }
  $('hrEnabled').addEventListener('change', showHr);
  // R&D ERP 자동 로그인(eClass SSO) 지금 시도 → 되면 캐시를 무시하고 다시 조회해 결과까지 보임
  $('btnRndSso').addEventListener('click', async () => {
    setStatus('rndSsoStatus', 'eClass SSO 로 R&D ERP 에 로그인하는 중…');
    let r = null;
    try { r = await chrome.runtime.sendMessage({ type: 'rndSsoLogin' }); } catch (e) { r = null; }
    if (r && r.ok) {
      setStatus('rndSsoStatus', `로그인했습니다 (${r.ms} ms). 다시 조회하는 중…`);
      let d = null;
      try { d = await chrome.runtime.sendMessage({ type: 'getData', force: true }); } catch (e) { d = null; }
      if (d && d.loginRequired) setStatus('rndSsoStatus', 'SSO 는 됐지만 R&D ERP 가 여전히 로그인 필요라고 응답합니다. eClass 의 R&D ERP 메뉴로 로그인해 보세요.', true);
      else if (d && d.error) setStatus('rndSsoStatus', `로그인했지만 조회 오류: ${d.error}`, true);
      else setStatus('rndSsoStatus', `로그인하고 다시 조회했습니다 (SSO ${r.ms} ms${d && d.projectCount != null ? `, 과제 ${d.projectCount}건` : ''})`);
    }
    else if (r && r.kind === 'eclass-login') setStatus('rndSsoStatus', 'eClass 로그인이 풀려 있어 SSO 를 못 했습니다. eClass 에 로그인한 뒤 다시 누르세요.', true);
    else setStatus('rndSsoStatus', (r && r.error) ? `자동 로그인 실패 (${r.kind}): ${r.error}` : '응답 없음', true);
  });

  // 지금 수집 (백그라운드 직접 호출, 안 되면 열려 있는 HR 탭). 모든 달을 다시 읽는다
  $('btnHrCollect').addEventListener('click', async () => {
    setStatus('hrStatus', 'HR System 급여명세서를 읽는 중…');
    let r = null;
    try { r = await chrome.runtime.sendMessage({ type: 'hrCollectNow', all: true }); } catch (e) { r = null; }
    if (r && r.ok) setStatus('hrStatus', `수집했습니다 (${r.via === 'tab' ? 'HR 탭에서' : '백그라운드 직접 호출'}${r.autoLogin ? `, 자동 로그인 ${r.autoLogin === 'fetch' ? '백그라운드 SSO' : 'SSO 탭'}` : ''}) — ${r.scan ? `급여 ${r.months || 0}건 중 지급내역 ${r.scan.done}건 읽음` : ''}${r.grade ? ` · 직급 ${r.grade}` : ' · 직급 없음'}`);
    else if (r && r.eclassLogin) setStatus('hrStatus', 'eClass 로그인이 풀려 있어 HR System 자동 로그인(SSO)을 못 했습니다. eClass 에 로그인한 뒤 다시 누르세요.', true);
    else if (r && r.loginRequired) setStatus('hrStatus', `HR System 로그인이 풀려 있습니다${r.tabOpened ? ' (자동 로그인 실패)' : ''}. 위 HR System 링크(eClass SSO)로 로그인한 뒤 다시 누르세요.`, true);
    else if (r && r.skipped) setStatus('hrStatus', `건너뜀: ${r.skipped}`, true);
    else setStatus('hrStatus', (r && r.error) ? `수집 실패: ${r.error}` : '응답 없음', true);
    showHr();
  });
  $('btnHrClear').addEventListener('click', async () => {
    if (!confirm('수집한 급여 정보(기본연봉·연구수당 등)를 지울까요? HR System 탭을 열면 다시 수집됩니다.')) return;
    await chrome.runtime.sendMessage({ type: 'clearHrPay' });
    setStatus('hrStatus', '지웠습니다.');
    showHr();
  });

  /* ---------- 미승인내역 테스트 ---------- */
  $('btnTestUnap').addEventListener('click', async () => {
    const svc = $('unapServiceId').value.trim();
    if (!svc) { setStatus('unapTestStatus', '서비스 ID를 입력하세요.', true); return; }
    let input; try { input = JSON.parse($('unapInput').value || '{}'); } catch (e) { setStatus('unapTestStatus', '입력 JSON 오류', true); return; }
    setStatus('unapTestStatus', '호출 중…');
    const res = await chrome.runtime.sendMessage({ type: 'callService', service: svc, input });
    const out = $('unapTestOut'); out.hidden = false;
    out.textContent = JSON.stringify(res, null, 2);
    setStatus('unapTestStatus', res && res.error ? '오류: ' + res.error : '응답 수신 (아래 JSON에서 필드명을 확인하세요)', !!(res && res.error));
  });
  async function showSnapshot() {
    const snap = (await chrome.storage.local.get('unapprovedSnapshot')).unapprovedSnapshot;
    $('snapshotOut').textContent = snap ? JSON.stringify(snap, null, 2) : '없음 (R&D ERP 메인화면을 열면 수집됩니다)';
  }

  /* ---------- 진단 ---------- */
  let diagResult = null;
  $('btnDiag').addEventListener('click', async () => {
    const prjNo = $('diagPrjNo').value.trim() || $('diagPrj').value;   // 과제번호 또는 과제명 일부 (rnd-api diagnose 가 찾음)
    setStatus('diagStatus', '호출 중…');
    const res = await chrome.runtime.sendMessage({ type: 'diagnose', prjNo });
    diagResult = res;
    const why = $('diagWhy');   // 보이지 않는(보이는) 이유 요약 — 원본 JSON 위에
    why.innerHTML = ((res && res.why) || []).map((w) => `<li>${F.esc(w)}</li>`).join('');
    why.hidden = !why.innerHTML;
    const out = $('diagOut'); out.hidden = false;
    out.textContent = JSON.stringify(res, null, 2);
    setStatus('diagStatus', res && res.error ? '오류: ' + res.error : '완료. 아래 결과를 확인하세요.', !!(res && res.error));
  });
  $('btnDiagCopy').addEventListener('click', async () => {
    if (!diagResult) { setStatus('diagStatus', '먼저 진단을 실행하세요.', true); return; }
    await navigator.clipboard.writeText(JSON.stringify(diagResult, null, 2));
    setStatus('diagStatus', '복사했습니다.');
  });

  /* ---------- 캡처 로그 ---------- */
  const HINT = /임시저장|보완요청|구매요청|TEMP|SUPP|APPL|PURCH|CNT|기본연봉|연구수당/i;
  let capCache = [];
  async function loadCapture() {
    capCache = (await chrome.storage.local.get('captureLog')).captureLog || [];
    renderCapture();
  }
  function renderCapture() {
    const q = $('capFilter').value.trim().toLowerCase();
    const list = capCache.slice().reverse().filter((e) => !q || JSON.stringify(e).toLowerCase().includes(q));
    $('captureCount').textContent = `(${list.length}/${capCache.length}건)`;
    if (!list.length) { $('captureList').innerHTML = '<p class="help">기록이 없습니다. R&amp;D ERP(rnd.krs.co.kr)를 열어 메인화면을 표시하면 기록됩니다.</p>'; return; }
    $('captureList').innerHTML = list.map((e, i) => {
      const hit = HINT.test(e.response || '') && !/GWM0001/.test(e.response || '');
      const t = new Date(e.ts);
      return `<div class="cap${hit ? ' hit' : ''}" data-i="${i}">
        <div class="cap-head">
          <span class="cap-svc">${F.esc(e.service)}</span>
          <span class="cap-frame" title="${F.esc(e.tabUrl || '')}">${F.esc(e.frame || '')}</span>
          <span class="cap-time">${F.pad2(t.getHours())}:${F.pad2(t.getMinutes())}:${F.pad2(t.getSeconds())} · ${e.status}</span>
          <button type="button" class="btn" data-act="use">이 서비스 사용</button>
          <button type="button" class="btn" data-act="copy">복사</button>
          <button type="button" class="btn" data-act="toggle">내용</button>
        </div>
        <div class="cap-body" hidden>
          <div class="muted">요청</div><pre>${F.esc(e.request || '')}</pre>
          <div class="muted">응답</div><pre>${F.esc(e.response || '')}</pre>
        </div></div>`;
    }).join('');
    $('captureList').querySelectorAll('.cap').forEach((el) => {
      const e = list[Number(el.dataset.i)];
      el.querySelector('[data-act=toggle]').addEventListener('click', () => { const b = el.querySelector('.cap-body'); b.hidden = !b.hidden; });
      el.querySelector('[data-act=copy]').addEventListener('click', async () => { await navigator.clipboard.writeText(JSON.stringify(e, null, 2)); setStatus('capStatus', '복사했습니다.'); });
      el.querySelector('[data-act=use]').addEventListener('click', () => {
        $('unapServiceId').value = e.service;
        $('unapInput').value = e.request && e.request.trim().startsWith('{') ? e.request : '{}';
        const sec = $('unapServiceId').closest('details'); if (sec) sec.open = true;   // 접혀 있으면 펼쳐서 보여줌
        window.scrollTo({ top: $('unapServiceId').getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
        setStatus('unapTestStatus', '서비스 ID를 채웠습니다. 테스트 호출 후 필드명을 입력하고 저장하세요.');
      });
    });
  }
  $('capFilter').addEventListener('input', renderCapture);
  $('btnCapRefresh').addEventListener('click', loadCapture);
  $('btnCapCopy').addEventListener('click', async () => {
    const snap = (await chrome.storage.local.get('unapprovedSnapshot')).unapprovedSnapshot || null;
    await navigator.clipboard.writeText(JSON.stringify({ exportedAt: new Date().toISOString(), unapprovedSnapshot: snap, captureLog: capCache }, null, 2));
    setStatus('capStatus', `전체 ${capCache.length}건을 복사했습니다.`);
  });
  $('btnCapDownload').addEventListener('click', async () => {
    const snap = (await chrome.storage.local.get('unapprovedSnapshot')).unapprovedSnapshot || null;
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), unapprovedSnapshot: snap, captureLog: capCache }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `krext-capture-${F.ymd(new Date())}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $('btnCapClear').addEventListener('click', async () => { if (!confirm('캡처 로그를 모두 지울까요?')) return; await chrome.runtime.sendMessage({ type: 'clearCapture' }); loadCapture(); });

  chrome.storage.onChanged.addListener((ch, area) => {
    if (area === 'local' && ch.captureLog) loadCapture();
    if (area === 'local' && ch.unapprovedSnapshot) showSnapshot();
    if (area === 'local' && ch.issuedCards) loadIssued();
    if (area === 'local' && ch.projectList) loadProjects();
    if (area === 'local' && ch.cache && ch.cache.newValue) { loadBgtItems(); showNameCandidates(); }
    if (area === 'local' && ch.rndUser) showRndUser();
    if (area === 'local' && ch.hrPay) showHr();
  });

  const local = await chrome.storage.local.get(['issuedCards', 'projectList', 'cache']);
  issued = local.issuedCards || null;
  projectList = local.projectList || null;
  cacheData = local.cache || null;
  await initCollapse();
  await initDescFold();
  fill(await S.load());
  probeLlm(true).catch(() => {});   // LLM(Help 서버) 연결 상태 → LLM 설정 탭 칩·기능 구역 켜기 (기다리지 않음)
  await loadApiKey();   // Claude API 키(storage.local) · 마지막 확인 결과 — 오래됐으면 조용히 다시 확인
  await loadRcmsCred();
  await loadFetchSites();
  if (self.KRX_FETCH_CHAT) await KRX_FETCH_CHAT.init({ base: helpBase, sites: () => fetchList, docsMap: kindDocsNow, onHowto: applyHowto, onDone: issueDone });   // 찾는 방법 익히기 (options/fetch-chat.js)
  await fetchFromHash();
  await loadProjects();
  await loadResearch();
  await showRndUser();
  await showNameCandidates();
  await showSnapshot();
  await showHr();
  await loadCapture();
  if (!issued || !projectList) {
    chrome.runtime.sendMessage({ type: 'getData', force: true }).then(() => { loadProjects(); loadIssued(); }).catch(() => {});
  }
})();
