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

  /* ---------- 탭: 일반 설정 · LLM 설정 · MCP 설정 ([data-panel]). 주소가 #llm(탭을 눌러 둠) 또는 #fetch…(패널의 ⚙ #fetch=<id> · 자주 사용 등록 #fetch-new=… — 증빙 찾아오기는 LLM 설정 탭 안)면 LLM 설정 탭, #mcp 면 MCP 설정(확장 Plus) 탭 ---------- */
  const tabOfHash = () => (/^#(fetch|llm)/.test(location.hash) ? 'llm' : /^#mcp/.test(location.hash) ? 'mcp' : 'main');
  function showTab(name) {
    if (name !== 'llm' && name !== 'mcp') name = 'main';
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
    const pl = Object.assign({}, S.DEFAULTS.plus, s.plus || {});   // 확장 Plus (외부 MCP 연동)
    $('plusEnabled').checked = !!pl.enabled;
    $('plusMcpUrl').value = pl.onenoteMcpUrl || '';
    $('plusSectionName').value = pl.sectionName == null ? S.DEFAULTS.plus.sectionName : pl.sectionName;
    setPlusNotebook(pl.notebookId || '', pl.notebookLabel || '');
    $('plusPlanSync').checked = pl.planSync !== false;
    updatePlusSummary();
    const hp = Object.assign({}, S.DEFAULTS.help, s.help || {});   // Help Chat (로컬 Help 서버)
    $('helpEnabled').checked = hp.enabled !== false;
    $('helpUrl').value = hp.url || '';
    $('helpAutoPick').checked = hp.autoPick !== false;
    $('helpAutoPtcl').checked = hp.autoPtcl !== false;   // 비어 있는 청구내역을 Claude 가 씀 (연구내용 참조)
    $('helpPtclGuide').value = hp.ptclGuide || '';
    $('helpFetch').checked = hp.fetch !== false;   // 증빙 찾아오기 켜기 (LLM 설정 탭 — 가맹점 등록도 같은 탭)
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
      plus: {
        enabled: $('plusEnabled').checked,
        onenoteMcpUrl: $('plusMcpUrl').value.trim() || S.DEFAULTS.plus.onenoteMcpUrl,
        sectionName: $('plusSectionName').value.trim() || S.DEFAULTS.plus.sectionName,
        notebookId: $('plusNotebook').value,
        notebookLabel: $('plusNotebook').value ? ($('plusNotebook').selectedOptions[0] || {}).textContent || '' : '',
        planSync: $('plusPlanSync').checked
      },
      help: { enabled: $('helpEnabled').checked, url: $('helpUrl').value.trim().replace(/\/+$/, '') || S.DEFAULTS.help.url, autoPick: $('helpAutoPick').checked,
        autoPtcl: $('helpAutoPtcl').checked, ptclGuide: $('helpPtclGuide').value.trim().slice(0, 300), fetch: $('helpFetch').checked, fetchDocs: kindDocsNow() },
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
        <td class="tag">${r.n}차년도${r.rev ? ` ${F.esc(r.rev)}` : ''}${r.src ? '<span class="rs-src" title="원노트 페이지에서 받은 것 — 위 목록의 페이지를 끊으면 빠집니다">원노트</span>' : ''}</td>
        <td class="erp"><select data-rs-link="${F.esc(r.id)}" title="${F.esc(how)}">${opts(r)}</select></td>
        <td class="tag" title="${F.esc(`${r.src ? '원노트에서 받음 · ' : ''}${r.file ? `파일 ${r.file}` : '붙여 넣은 글'}`)}">${F.esc(F.fmtClock(r.at))}</td>
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
    await renderResearchPages();
  }

  /* 원노트 링크로 이어 둔 연구내용 페이지 (background.js researchBind · researchPull · researchUnbind, storage.local.researchPages) */
  async function renderResearchPages() {
    let pages = {};
    try { pages = (await chrome.storage.local.get('researchPages')).researchPages || {}; } catch (e) {}
    const list = Object.values(pages).sort((a, b) => String(a.name || a.title).localeCompare(String(b.name || b.title), 'ko'));
    const rows = list.map((p) => {
      const what = p.ok ? [`차년도 ${p.count || 0}개`, p.older ? `오래된 판 ${p.older} 건너뜀` : '', p.remoteAt ? `올림 ${F.fmtClock(p.remoteAt)}${p.by ? ` ${p.by}` : ''}` : ''].filter(Boolean).join(' · ') : (p.error || '아직 받지 않음');
      return `<tr><td class="nm">${p.webUrl ? `<a href="${F.esc(p.webUrl)}" target="_blank" rel="noopener">${F.esc(p.title || p.pageId)}</a>` : F.esc(p.title || p.pageId)}<span class="muted">${F.esc(p.code || '')}</span></td>
        <td class="${p.ok ? 'tag' : 'tag err'}">${F.esc(what)}</td><td class="tag">${p.at ? F.esc(F.fmtClock(p.at)) : ''}</td>
        <td class="tag"><button type="button" class="btn danger" data-rs-unbind="${F.esc(p.pageId)}" title="이 페이지를 더 받지 않고, 이 페이지에서 받은 차년도 기록도 뺍니다">끊기</button></td></tr>`;
    }).join('');
    $('researchPages').innerHTML = rows ? `<div class="prj-list rs-pages"><table class="prj-table rs-table"><thead><tr><th>이어 둔 원노트 페이지</th><th>받은 것</th><th>마지막 받기</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '';
    $('btnResearchPull').disabled = !list.length;
  }
  /* 링크(웹 링크 · onenote: 링크 · "[연구내용 페이지 ID] 1-…" 줄)를 백그라운드가 페이지로 풀어 기억하고 받는다 */
  const isNoteLink = (s) => /onenote|wd=target\(|page-id=|1-[0-9a-f]{32}![0-9]+-[0-9a-f-]{36}/i.test(String(s || ''));
  async function bindResearchLink(text) {
    const t = String(text || '').trim();
    if (!t) return;
    $('researchCard').open = true;
    $('btnResearchBind').disabled = true;
    rsStatus('원노트 페이지를 찾아 받는 중…');
    try {
      const r = await chrome.runtime.sendMessage({ type: 'researchBind', text: t });
      const pg = (r && r.page) || {};
      if (r && r.ok) { $('researchLink').value = ''; rsStatus(`${pg.title || '연구내용 페이지'} 받음 — 차년도 ${pg.count || 0}개${pg.older ? ` (더 오래된 판 ${pg.older}개는 건너뜀)` : ''} · 이 페이지를 기억해 다시 받습니다`); }
      else rsStatus(`받지 못했습니다: ${(r && (r.error || r.message)) || '응답 없음'}${r && r.kind === 'offline' ? ' — 이 PC 의 OneNote MCP 서버(KR_MS365_mcp onenote)를 띄우세요' : ''}`, true);
    } catch (e) { rsStatus(`받지 못했습니다: ${String((e && e.message) || e)}`, true); }
    finally { $('btnResearchBind').disabled = false; }
  }
  $('btnResearchBind').addEventListener('click', () => bindResearchLink($('researchLink').value));
  $('researchLink').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); bindResearchLink($('researchLink').value); } });
  $('btnResearchPull').addEventListener('click', async () => {
    setStatus('researchLinkStatus', '받는 중…');
    try {
      const r = await chrome.runtime.sendMessage({ type: 'researchPull', reason: 'manual' });
      if (r && r.ok) setStatus('researchLinkStatus', r.skipped === 'none' ? '이어 둔 페이지가 없습니다' : `다시 받았습니다 — 페이지 ${Object.keys(r.pages || {}).length}개`);
      else setStatus('researchLinkStatus', `일부 못 받음: ${(r && (r.error || r.message)) || '응답 없음'}`, true);
    } catch (e) { setStatus('researchLinkStatus', String((e && e.message) || e), true); }
  });
  $('researchPages').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-rs-unbind]');
    if (!b || !confirm('이 원노트 페이지를 끊을까요? 이 페이지에서 받은 차년도 기록도 빠집니다 (링크를 다시 붙여 넣으면 돌아옵니다)')) return;
    const r = await chrome.runtime.sendMessage({ type: 'researchUnbind', pageId: b.dataset.rsUnbind });
    rsStatus(r && r.ok ? `페이지를 끊었습니다 — 기록 ${r.removed}개 뺌` : '끊지 못했습니다', !(r && r.ok));
  });

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
  // 붙여 넣기: 입력 칸이 아닌 곳에서 Ctrl+V — 복사한 YAML 파일, meta: 로 시작하는 줄이 있는 글, 또는 원노트 페이지 링크(연구내용 공유가 복사해 준 글)
  document.addEventListener('paste', (e) => {
    const t = e.target;
    if (t && t !== $('researchDrop') && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const files = Array.from((e.clipboardData && e.clipboardData.files) || []).filter(isYaml);
    if (files.length) { e.preventDefault(); showTab('main'); intakeFiles(files); return; }
    const text = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
    if (/^meta\s*:/m.test(text)) { e.preventDefault(); showTab('main'); intakeResearch([{ name: '', text }]); }
    else if (isNoteLink(text)) { e.preventDefault(); showTab('main'); bindResearchLink(text); }
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
      if (!rec || !confirm(`${rec.name} ${rec.n}차년도 연구개발계획서를 뺄까요? (파일을 다시 넣으면 돌아옵니다${rec.src ? ' — 원노트에서 받은 것이라 페이지를 끊지 않으면 다음 받기 때 다시 옵니다' : ''})`)) return;
      delete map[rec.id];
      await RS.save(map);
      rsStatus(`${rec.name} ${rec.n}차년도 뺌`);
    }
  });
  try {
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area === 'local' && (ch[RS.KEY] || ch.projectList || (ch.cache && ch.cache.newValue))) loadResearch().catch(() => {});
      else if (area === 'local' && ch.researchPages) renderResearchPages().catch(() => {});
    });
  } catch (e) {}

  $('form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try { await saveFetchSites(); await S.save(read()); await saveRcmsCred(); setStatus('saveStatus', '저장했습니다. eClass 화면은 자동으로 다시 조회됩니다.'); }
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
   * 패널이 여는 주소: #fetch-new=<가맹점 이름>(새 등록 칸, eClass 패널의 자주 사용 등록) · #fetch=<id>(그 사이트 고치기) — LLM 설정 탭을 열고 그 칸으로. 찾아오기가 끝나 백그라운드가 last·howto 를 바꾸면 고치는 중이 아닐 때 다시 읽는다 ---------- */
  const SITES = KRX_SITES;
  let fetchList = [], fetchDirty = false, fetchNewIdx = -1;
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
      const last = s.last ? `마지막 ${F.fmtClock(s.last.ts)} · ${s.last.state === 'done' ? `${s.last.n}개 찾아옴` : s.last.state === 'empty' ? '찾지 못함' : s.last.state === 'canceled' ? '중지' : '실패'}${s.last.msg ? ` — ${s.last.msg}` : ''}` : '아직 찾아오지 않음';
      return `<div class="fetch-site${i === fetchNewIdx ? ' fetch-new' : ''}" data-fs="${i}" id="fs-${F.esc(s.id || 'new' + i)}">
        <div class="fetch-site-head"><div class="fetch-site-identity"><strong class="fetch-site-name">${F.esc(s.label || '새 가맹점')}</strong><span class="muted">${F.esc(last)}</span></div><div class="fetch-site-actions"><button type="button" class="btn" data-fs-guide="${i}" title="이 가맹점의 안내 글(등록 값 · 기억한 찾는 방법 · Help 서버의 사이트 안내 파일 site-fetch/sites/*.md 원문)을 복사합니다 — 다른 PC 의 등록이나 Claude 에 옮겨 줄 때">안내 복사</button><button type="button" class="btn" data-fs-prompt="${i}" title="이 가맹점 사이트를 찾아오기에 붙이는(fetch-site 스킬) Claude Code 프롬프트를 이 칸의 값으로 채워 복사합니다 — 이 확장 폴더에서 연 Claude Code 에 붙여 넣으세요. 위 사이트 만들기 채팅은 같은 글을 Help 서버로 보냅니다">만들기 프롬프트 복사</button><button type="button" class="btn danger" data-fs-del="${i}" aria-label="${F.esc(s.label || '새 가맹점')} 삭제">삭제</button></div></div>
        <div class="grid">
          <label>이름 <input type="text" data-ff="label" value="${F.esc(s.label || '')}" placeholder="예) 인프런"></label>
          <label>가맹점 글자 <input type="text" data-ff="match" value="${F.esc(s.match || '')}" placeholder="예) 인프랩"><span class="field-hint">카드 내역에 표시되는 이름 · 여러 개는 쉼표로 구분</span></label>
          <label class="wide">사이트 주소 <input type="url" data-ff="url" value="${F.esc(s.url || '')}" placeholder="https://www.inflearn.com/my/orders"><span class="field-hint">구매내역이나 청구 화면 주소를 넣으면 더 빠르게 찾습니다.</span></label>
          <label>종류 <select data-ff="kind">${kinds(s.kind)}</select></label>
          <div><span>필요 서류 (찾아오기가 찾고 청구 준비 줄에 ✓/✗ 로 보임)</span><div class="fetch-docs"><label class="fetch-own"><input type="checkbox" data-fown${own ? '' : ' checked'}>종류 기본 따름 — ${F.esc(SITES.kindLabel(s.kind))}: ${F.esc(SITES.docsFor(s.kind, map).join('·'))}</label>${docs.map((d) => `<label><input type="checkbox" data-fd="${F.esc(d)}"${need.includes(d) ? ' checked' : ''}${own ? '' : ' disabled'}><span>${F.esc(d)}</span></label>`).join('')}</div></div>
          <label>아이디 <input type="text" data-ff="loginId" value="${F.esc(s.loginId || '')}" autocomplete="off" spellcheck="false"></label>
          <label>비밀번호 <input type="password" data-ff="loginPw" value="${F.esc(s.loginPw || '')}" autocomplete="new-password"></label>
          <label class="wide">로그인해 둔 Chrome <span class="optional">선택</span><input type="text" data-ff="browser" value="${F.esc(s.browser || '')}" placeholder="예) SUB 전용 · 9444 · http://127.0.0.1:9444" spellcheck="false"><span class="field-hint">바로가기 이름, 디버그 포트 또는 주소를 입력하세요. 실행 중이 아니면 해당 바로가기로 엽니다. 비우면 서버 기본 설정을 사용합니다.</span></label>
          <label class="wide">찾는 곳 메모 <span class="optional">선택 · Claude에 전달</span><input type="text" data-ff="hint" value="${F.esc(s.hint || '')}" placeholder="예) 마이페이지 › 구매내역 › 거래명세서"></label>
          <label class="wide">기억한 찾는 방법 <textarea data-ff="howto" rows="2">${F.esc(s.howto || '')}</textarea><span class="field-hint">지난번에 찾은 경로를 다음 요청에 참고합니다. 사이트가 바뀌어 찾지 못하면 비워주세요.</span></label>
        </div></div>`;
    }).join('') || '<p class="muted">등록한 가맹점이 없습니다. 패널 청구 준비 줄의 <b>자주 사용 등록</b>이나 아래 <b>가맹점 추가</b>로 등록하세요.</p>';
    updateFetchSummary();
    if (self.KRX_FETCH_CHAT) KRX_FETCH_CHAT.refresh();   // 사이트 만들기 채팅의 가맹점 select
  }
  /* Help 서버 주소 (설정 칸의 지금 값, 이 PC 만) — 사이트 만들기 채팅·안내 복사·스킬 복사가 씀 */
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
    if (!r.ok || !r.text) { setStatus('fcCopyStatus', `${r.error || '스킬을 받지 못했습니다'} (원문은 이 폴더의 ${SITES.SKILL})`, true); return; }
    try { await navigator.clipboard.writeText(r.text); setStatus('fcCopyStatus', `fetch-site 스킬(${r.path || SITES.SKILL})을 복사했습니다 — 다른 저장소의 .claude/skills/fetch-site/SKILL.md 로 붙여 넣으면 거기서도 /fetch-site`); }
    catch (e) { setStatus('fcCopyStatus', `복사하지 못했습니다: ${e.message}`, true); }
  });
  /* 사이트 만들기 채팅이 끝나 howto: 줄을 받음 → 그 가맹점의 기억한 찾는 방법 칸에 (저장은 사용자). 채워졌으면 true */
  function applyHowto(siteId, label, howto) {
    const s = fetchList.find((x) => siteId ? x.id === siteId : label && (x.label || x.match) === label);
    if (!s) { setStatus('fetchStatus', `기억한 찾는 방법을 받았지만 "${label || '새 사이트'}" 등록이 없습니다 — 등록한 뒤 안내 복사로 옮기거나 직접 넣으세요: ${howto}`, true); return false; }
    s.howto = howto; fetchDirty = true; renderFetchSites();
    const box = $('fetchSites').querySelector(`[data-fs="${fetchList.indexOf(s)}"]`);
    if (box) box.classList.add('fetch-new');
    setStatus('fetchStatus', `${s.label || s.match}: 기억한 찾는 방법을 채웠습니다 — 아래 저장을 누르세요`);
    return true;
  }
  $('fetchSites').addEventListener('input', (ev) => {
    const el = ev.target, box = el.closest('[data-fs]'); if (!box) return;
    const s = fetchList[Number(box.dataset.fs)]; if (!s) return;
    if (el.dataset.ff) { s[el.dataset.ff] = el.value; if (el.dataset.ff === 'kind') renderFetchSites(); }   // 종류 기본이면 필요 서류 표시가 바뀜
    else if ('fown' in el.dataset) { s.docs = el.checked ? [] : SITES.docsFor(s.kind, kindDocsNow()); renderFetchSites(); }   // 끄면 지금 종류 기본에서 시작해 이 가맹점만 고름
    else if (el.dataset.fd) { const set = new Set(SITES.docsOf(s, kindDocsNow())); if (el.checked) set.add(el.dataset.fd); else set.delete(el.dataset.fd); s.docs = Array.from(set); }
    fetchDirty = true;
    if (el.dataset.ff === 'label') updateFetchSummary();
  });
  /* 새 사이트 만들기 프롬프트 (lib/fetch-sites.js buildPrompt — fetch-site 스킬을 가리키는 가맹점 블록) 복사 — 가맹점 칸이면 그 값으로, 아래 버튼이면 빈 칸 틀 */
  async function copyFetchPrompt(site) {
    const text = SITES.buildPrompt(site, kindDocsNow());
    try { await navigator.clipboard.writeText(text); setStatus('fetchStatus', `${site ? `${site.label || site.match || '새 가맹점'} ` : '새 사이트 '}만들기 프롬프트를 복사했습니다 — 이 확장 폴더(E:\\dev\\kr_ext_rerp)에서 연 Claude Code 에 붙여 넣으세요(fetch-site 스킬 절차)${site ? ' (시험할 거래의 사용일·금액 칸을 채우면 좋음)' : ' (＿＿ 칸을 채우세요)'}`); }
    catch (e) { setStatus('fetchStatus', `복사하지 못했습니다: ${e.message}`, true); }
  }
  $('btnFetchPrompt').addEventListener('click', () => copyFetchPrompt(null));
  $('fetchSites').addEventListener('click', (ev) => {
    const p = ev.target.closest('[data-fs-prompt]');
    if (p) { const s = fetchList[Number(p.dataset.fsPrompt)]; if (s) copyFetchPrompt(s); return; }
    const gd = ev.target.closest('[data-fs-guide]');
    if (gd) { const s = fetchList[Number(gd.dataset.fsGuide)]; if (s) copyFetchGuide(s); return; }
    const b = ev.target.closest('[data-fs-del]'); if (!b) return;
    const s = fetchList[Number(b.dataset.fsDel)];
    if (s && s.id && !confirm(`${s.label || s.match} 등록을 지울까요? (아이디·비밀번호도 지워집니다. 아래 저장을 눌러야 반영)`)) return;
    fetchList.splice(Number(b.dataset.fsDel), 1); fetchDirty = true; fetchNewIdx = -1; renderFetchSites();
  });
  function addFetchSite(shop) {
    const d = Object.assign(shop ? SITES.defaultsFor(shop) : { label: '', match: '', url: '', kind: 'other', hint: '', browser: '' }, { docs: [] });   // 필요 서류는 종류 기본
    fetchList.push(Object.assign(d, { id: '', loginId: '', loginPw: '', howto: '' }));
    fetchNewIdx = fetchList.length - 1; fetchDirty = true;
    showTab('llm');
    renderFetchSites();
    const box = $('fetchSites').querySelector(`[data-fs="${fetchNewIdx}"]`);
    if (box) { box.scrollIntoView({ block: 'center' }); const el = box.querySelector(d.url ? '[data-ff="loginId"]' : '[data-ff="url"]'); if (el) el.focus(); }
  }
  $('btnFetchAdd').addEventListener('click', () => addFetchSite(''));
  $('helpFetch').addEventListener('change', updateFetchSummary);
  /* 저장 버튼: 빈 새 칸은 버리고, 칸마다 검사(lib/fetch-sites.js sanitize) → fetchSites + fetchCred. last(마지막 결과)는 저장소의 지금 값을 살린다 */
  async function saveFetchSites() {
    if (!fetchDirty) return;
    const stored = await SITES.load();
    const sites = [], cred = {};
    for (const s of fetchList) {
      if (!s.id && !String(s.url || '').trim() && !String(s.match || '').trim()) continue;
      let c;
      try { c = SITES.sanitize(s); } catch (e) { showTab('llm'); throw new Error(`증빙 찾아오기 › ${s.label || s.match || '새 가맹점'}: ${e.message}`); }
      if (!c.id) c.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + sites.length;
      const old = stored.find((x) => x.id === c.id);
      if (old) c.last = old.last || null;
      s.id = c.id;
      sites.push(c);
      const id = String(s.loginId || '').trim(), pw = String(s.loginPw || '');
      if (id || pw) cred[c.id] = { id, pw };
    }
    await chrome.storage.local.set({ [SITES.KEY]: sites, [SITES.CRED]: cred });
    fetchDirty = false; fetchNewIdx = -1;
  }
  chrome.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch[SITES.KEY] && !fetchDirty) loadFetchSites().catch(() => {}); });
  /* 패널이 연 주소의 #fetch-new=… / #fetch=… (LLM 설정 탭의 증빙 찾아오기 구역) */
  async function fetchFromHash() {
    const h = decodeURIComponent(String(location.hash || '').slice(1));
    if (h.startsWith('fetch-new=')) {
      const shop = h.slice('fetch-new='.length);
      const hit = SITES.match(fetchList, shop);
      if (hit) { location.hash = 'fetch=' + hit.id; return fetchFromHash(); }
      addFetchSite(shop);
      setStatus('fetchStatus', `"${shop}" 가맹점을 등록합니다 — 사이트 주소·아이디·비밀번호를 넣고 아래 저장을 누르세요`);
    } else if (h.startsWith('fetch=')) {
      showTab('llm');
      const box = $(`fs-${h.slice('fetch='.length)}`);
      if (box) { box.classList.add('fetch-new'); box.scrollIntoView({ block: 'center' }); }
    }
  }
  window.addEventListener('hashchange', () => { showTab(tabOfHash()); fetchFromHash().catch(() => {}); });
  $('btnReset').addEventListener('click', () => { if (confirm('모든 설정을 기본값으로 되돌릴까요?')) fill(S.merge(S.DEFAULTS, {})); });

  /* ---------- LLM 설정 탭: 이 PC 의 Help 서버(help-server/server.js) 연결 상태. 백그라운드(lib/llm.js 'llmProbe' → storage.local.llmStatus, 패널의 찾아오기 버튼도 같은 상태를 봄)에 묻고,
   * 백그라운드가 응답하지 않으면(깨졌을 때) 설정 페이지도 확장 페이지라 localhost 호스트 권한으로 직접 부른다(popup/help.js 와 같은 방식).
   * 열 때 · 30초마다(보이는 동안) · 주소를 고친 뒤 · 연결 확인 버튼으로 확인하고, 연결돼 있을 때만 LLM 기능 구역(#llmFeatures — 자동 분류 · Help Chat · 증빙 찾아오기와 가맹점 등록)을 켠다 — 안 되면 .llm-off 로 흐리게 + 안내 ---------- */
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
      cli: ok ? j.cli || '' : '', version: ok ? j.version || '' : '', repo: ok ? j.repo || '' : '', busy: ok ? j.busy || '' : '', error: ok ? '' : (j && j.error ? `거절됨: ${j.error}` : err || `연결할 수 없습니다 (${url})`) };
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
  /* 기능마다 그 서버에서 되는지: [문구, 상태 클래스] */
  function llmFeature(what) {
    if (!llm) return ['확인 중…', ''];
    if (!llm.ok) return ['LLM 연결 안 됨', 'off'];
    if (what === 'classify') return llm.classify ? [`사용 가능 · ${llm.classify}${llm.classifyPtcl ? '' : ' (청구내역 작성은 이전 버전 서버라 안 됨 — 다시 실행)'}`, llm.classifyPtcl ? 'on' : 'warn'] : ['서버가 이전 버전이라 안 됨 — 서버를 끄고 다시 node help-server/server.js', 'warn'];
    if (what === 'fetch') return llm.fetch ? [`사용 가능 · ${llm.fetch}`, 'on'] : [llm.fetchNote || '서버가 이전 버전이라 안 됨 — 서버를 끄고 다시 node help-server/server.js', 'warn'];
    return llm.cli ? [`사용 가능 · claude CLI ${llm.cli}`, 'on'] : ['claude CLI 를 확인하지 못함 — claude --version · claude update', 'warn'];
  }
  function renderLlm() {
    const ok = !!(llm && llm.ok);
    const badge = $('llmBadge');
    badge.textContent = !llm ? '확인 중…' : ok ? '연결됨' : '연결 안 됨';
    badge.className = 'tab-badge ' + (!llm ? '' : ok ? 'on' : 'err');
    badge.title = !llm ? '' : ok ? `Help 서버 ${llm.url} · 모델 ${llm.model}` : llm.error || '';
    const st = $('llmState');
    st.textContent = !llm ? '확인 중…' : ok ? `연결됨 · ${F.fmtClock(llm.at)} 확인` : `연결 안 됨 · ${F.fmtClock(llm.at)} 확인`;
    st.className = 'llm-state ' + (!llm ? '' : ok ? 'on' : 'err');
    const detail = $('llmDetail');
    detail.innerHTML = !llm ? '' : ok
      ? [`주소 ${F.esc(llm.url)}`, `모델 ${F.esc(llm.model || '-')}`, `자동 분류 ${F.esc(llm.classify || '없음')}`, `청구내역 작성 ${llm.classifyPtcl ? '가능' : '안 됨'}`, `증빙 찾아오기 ${F.esc(llm.fetch || llm.fetchNote || '없음')}`, `claude CLI ${F.esc(llm.cli || '확인 안 됨')}`, llm.version ? `서버가 읽은 확장 ${F.esc(llm.version)}` : '', llm.repo ? `저장소 ${F.esc(llm.repo)}` : '', llm.busy ? '요청 처리 중' : ''].filter(Boolean).map((t) => `<span>${t}</span>`).join('')
      : `<span class="err">${F.esc(llm.error || '연결할 수 없습니다')}</span><span>서버가 안 떠 있으면 이 PC 의 터미널에서 <code>node help-server/server.js</code> — 뜨면 30초 안에 저절로 켜집니다 (또는 연결 확인)</span>`;
    document.querySelectorAll('.llm-chip[data-llm]').forEach((el) => { const [t, cls] = llmFeature(el.dataset.llm); el.textContent = t; el.className = 'llm-chip ' + cls; });
    // 연결돼 있을 때만 LLM 기능 구역(증빙 찾아오기·가맹점 등록 포함)을 켠다 (확인 전에는 켜 둠)
    const off = !!llm && !ok;
    $('llmFeatures').classList.toggle('llm-off', off);
    $('llmFeatures').querySelectorAll(':scope > .card, :scope > #fetchBody').forEach((el) => { el.inert = off; });
    $('llmNotice').hidden = !off;
    $('llmNotice').textContent = off ? 'LLM(Help 서버)이 연결돼 있지 않아 아래 기능(자동 분류 · Help Chat · 증빙 찾아오기)을 쓸 수 없습니다 — 서버를 띄우면 저절로 켜집니다. 설정 값과 가맹점 등록은 그대로 남아 있습니다. 처음 쓰는 PC 면 위 LLM 연결 칸의 "Claude Code 설정 프롬프트 복사" 를 저장소 폴더의 Claude Code 에 붙여 넣으세요.' : '';
    $('llmSetupRow').hidden = !off;   // 연결이 안 될 때만: Claude Code 에 붙여 넣을 설정 프롬프트 (lib/help-setup.js)
    const fn = $('fetchLlmNotice');   // 연결은 됐는데 찾아오기가 없는 서버(이전 버전 · Node 22 미만) — 연결 자체가 안 되면 위 #llmNotice 가 말한다
    fn.hidden = !(ok && !llm.fetch);
    fn.textContent = fn.hidden ? '' : `Help 서버는 연결됐지만 찾아오기가 안 되는 서버입니다 — ${llm.fetchNote || '이전 버전이라 서버를 끄고 다시 node help-server/server.js'}. 가맹점 등록은 해 둘 수 있습니다.`;
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
  let helpUrlTimer = 0;
  $('helpUrl').addEventListener('input', () => { clearTimeout(helpUrlTimer); helpUrlTimer = setTimeout(() => probeLlm(true).catch(() => {}), 700); });   // 주소를 고치면 그 주소로 다시 확인
  setInterval(() => { if (document.visibilityState === 'visible') probeLlm(false).catch(() => {}); }, LLM_POLL_MS);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') probeLlm(false).catch(() => {}); });
  try { chrome.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch.llmStatus && ch.llmStatus.newValue && ch.llmStatus.newValue.url === helpBase()) { llm = ch.llmStatus.newValue; renderLlm(); } }); } catch (e) {}   // 백그라운드·패널이 확인한 결과도 반영

  /* ---------- MCP 설정 탭 — 확장 Plus: 외부 MCP 연동 (background.js plusProbe / plusNotebooks / plusResolveSection / planSync, lib/plan-sync.js). localhost 호스트 권한은 manifest 에 고정 ---------- */
  function updatePlusSummary() {   // 제목 옆 요약 + MCP 설정 탭 이름 옆 칩(켜짐/꺼짐)
    const on = $('plusEnabled').checked, name = $('plusSectionName').value.trim() || S.DEFAULTS.plus.sectionName;
    $('plusSummary').textContent = !on ? '사용 안 함' : ($('plusPlanSync').checked ? `예상 비용 동기화 중 · ${name} 섹션` : '켜짐');
    const b = $('mcpBadge'); b.textContent = on ? '켜짐' : '꺼짐'; b.className = 'tab-badge ' + (on ? 'on' : 'off');
  }
  /* 노트북 select: 저장된 노트북은 목록을 불러오기 전에도 보이도록 option 하나를 만들어 둔다 */
  function setPlusNotebook(id, label) {
    const sel = $('plusNotebook');
    if (id && !Array.from(sel.options).some((o) => o.value === id)) { const o = document.createElement('option'); o.value = id; o.textContent = label || id; sel.appendChild(o); }
    sel.value = id || '';
  }
  $('plusEnabled').addEventListener('change', updatePlusSummary);
  $('plusSectionName').addEventListener('input', updatePlusSummary);
  $('plusPlanSync').addEventListener('change', updatePlusSummary);
  $('btnPlusNotebooks').addEventListener('click', async () => {
    setStatus('plusSectionStatus', '노트북 목록을 받는 중…');
    let r = null;
    try { r = await chrome.runtime.sendMessage({ type: 'plusNotebooks', url: $('plusMcpUrl').value.trim() }); } catch (e) { r = null; }
    if (r && r.ok) {
      const sel = $('plusNotebook'), cur = sel.value;
      sel.innerHTML = '<option value="">(자동: 그 이름의 섹션이 있는 노트북)</option>' + (r.notebooks || []).map((n) => `<option value="${F.esc(n.id)}">${F.esc(n.name || n.id)}</option>`).join('');
      if (cur) setPlusNotebook(cur, ((r.notebooks || []).find((n) => n.id === cur) || {}).name || cur);
      setStatus('plusSectionStatus', `노트북 ${(r.notebooks || []).length}개 (공유 노트북이 없으면 OneNote 에서 한 번 열어 둔 뒤 다시)`);
    } else setStatus('plusSectionStatus', r ? `실패 (${r.kind || 'error'}): ${r.error || r.message || ''}` : '응답 없음', true);
  });
  $('btnPlusSection').addEventListener('click', async () => {   // 저장한 뒤 섹션을 찾고 없으면 만든다
    try { await S.save(read()); } catch (e) { setStatus('plusSectionStatus', `설정 저장 실패: ${e.message || e}`, true); return; }
    setStatus('plusSectionStatus', '섹션을 찾는 중…');
    let r = null;
    try { r = await chrome.runtime.sendMessage({ type: 'plusResolveSection' }); } catch (e) { r = null; }
    if (r && r.ok) setStatus('plusSectionStatus', `${r.section.name} 섹션: ${r.section.label}${r.section.created ? ' (새로 만듦)' : ''}`);
    else if (r && r.kind === 'notebook') {
      const sel = $('plusNotebook');
      sel.innerHTML = '<option value="">(선택)</option>' + (r.notebooks || []).map((n) => `<option value="${F.esc(n.id)}">${F.esc(n.name || n.id)}</option>`).join('');
      setStatus('plusSectionStatus', `${r.error} — 노트북을 고르고 다시 누르세요`, true);
    } else setStatus('plusSectionStatus', r ? `실패 (${r.kind || 'error'}): ${r.error || r.message || ''}` : '응답 없음', true);
    showPlusState();
  });
  $('btnPlusProbe').addEventListener('click', async () => {
    setStatus('plusProbeStatus', 'MCP 서버에 연결하는 중…');
    let r = null;
    try { r = await chrome.runtime.sendMessage({ type: 'plusProbe', url: $('plusMcpUrl').value.trim() }); } catch (e) { r = null; }
    if (r && r.ok) {
      const c = r.check || {};
      const lack = [!c.hasRead && 'read_onenote 없음', !c.hasWrite && 'write_onenote 없음', c.hasWrite && !c.replace && 'write_onenote 에 replace 없음', c.hasRead && !c.includeIds && 'read_onenote 에 include_ids 없음'].filter(Boolean);
      setStatus('plusProbeStatus', `연결됨: ${r.server ? `${r.server.name} ${r.server.version || ''}` : '서버'} · 도구 ${(r.tools || []).length}개${lack.length ? ` · 동기화 불가: ${lack.join(', ')} (KR_MS365_mcp 를 최신으로)` : ' · 예상 비용 동기화 가능'}`, lack.length > 0);
    } else setStatus('plusProbeStatus', r ? `연결 실패 (${r.kind || 'error'}): ${r.error || r.message || ''}` : '응답 없음', true);
  });
  async function plusSyncNow(createAll) {
    try { await S.save(read()); } catch (e) { setStatus('plusSyncStatus', `설정 저장 실패: ${e.message || e}`, true); return; }   // 고른 섹션·주소로 동기화하도록 먼저 저장
    setStatus('plusSyncStatus', createAll ? '내가 책임자인 과제마다 페이지를 확인하고 없으면 만드는 중… (과제 수만큼 걸립니다)' : '동기화하는 중…');
    let r = null;
    try { r = await chrome.runtime.sendMessage({ type: 'planSync', reason: 'manual', createAll: !!createAll }); } catch (e) { r = null; }
    if (r && r.ok) {
      const pgs = Object.values(r.pages || {});
      setStatus('plusSyncStatus', `동기화했습니다 (${r.ms} ms): 과제 ${pgs.length}건 · 항목 ${r.count}건${pgs.some((p) => p.created) ? ` · 페이지 ${pgs.filter((p) => p.created).length}개 만듦` : ''}${pgs.some((p) => p.pulled) ? ' · 페이지 항목을 가져옴' : ''}${r.waiting ? ` · 책임자 생성 대기 ${r.waiting}건` : ''}`);
    }
    else if (r && r.skipped === 'off') setStatus('plusSyncStatus', `동기화하려면 먼저 이것을 해 주세요: ${(r.missing || []).join(' · ') || '설정 확인'}`, true);
    else if (r && r.kind === 'notebook') setStatus('plusSyncStatus', `${r.error} (노트북 불러오기 → 고르기 → 섹션 찾기 / 만들기)`, true);
    else setStatus('plusSyncStatus', r ? `동기화 실패 (${r.kind || 'error'}): ${r.error || ''}${r.errors > 1 ? ` 외 ${r.errors - 1}건` : ''}` : '응답 없음', true);
    showPlusState();
  }
  $('btnPlusSyncNow').addEventListener('click', () => plusSyncNow(false));
  $('btnPlusCreateAll').addEventListener('click', () => plusSyncNow(true));
  /* 마지막 동기화 결과 + 과제별 페이지 목록(열기 링크는 OneNote 웹) */
  async function showPlusState() {
    let st = null, pages = {}, pl = projectList, sec = null;
    try { const l = await chrome.storage.local.get(['planSyncState', 'plusPlanPages', 'projectList', 'plusSection']); st = l.planSyncState || null; pages = l.plusPlanPages || {}; pl = pl || l.projectList || null; sec = l.plusSection || null; } catch (e) {}
    if (sec && sec.id && !$('plusSectionStatus').textContent) $('plusSectionStatus').textContent = `현재 섹션: ${sec.label}`;
    const names = {}; for (const p of (pl && pl.projects) || []) if (p && p.prjNo) names[p.prjNo] = p.prjNm || '';
    const el = $('plusSyncState');
    const items = Object.values((st && st.pages) || {}).reduce((x, p) => x + (F.num(p && p.count) || 0), 0);   // 과제별 마지막 결과의 항목 수 합 (과제 하나만 돌린 뒤에도 전체가 보이게)
    el.textContent = !st ? '' : st.ok
      ? `마지막 동기화 ${F.fmtClock(st.at)} (${st.reason || ''}): 과제 ${Object.keys(st.pages || {}).length}건 · 항목 ${items}건`
      : `마지막 시도 ${F.fmtClock(st.at)} (${st.reason || ''}) 실패: ${st.error || st.kind || ''}${st.errors > 1 ? ` 외 ${st.errors - 1}건` : ''}`;
    const rows = Object.entries(Object.assign({}, pages, (st && st.pages) || {})).map(([prjNo, p]) => {
      const c = Object.assign({}, pages[prjNo] || {}, p || {});
      const link = c.webUrl ? `<a href="${F.esc(c.webUrl)}" target="_blank" rel="noopener">열기</a>` : '';
      const flags = [c.created && '만듦', c.pulled && '가져옴', c.pushed && '씀', c.noPage && '페이지 없음 · 책임자 생성 대기', c.error && `<span class="err">실패: ${F.esc(c.error)}</span>`].filter(Boolean).join(' · ');
      return `<tr><td class="no">${F.esc(prjNo)}</td><td class="nm">${F.esc(names[prjNo] || '')}</td><td>${F.esc(c.title || '')}</td><td>${link}</td><td>${c.at ? F.fmtClock(c.at) : ''}</td><td>${flags}</td></tr>`;
    });
    $('plusPages').innerHTML = rows.length ? `<table class="list"><thead><tr><th>과제번호</th><th>과제명</th><th>페이지</th><th></th><th>동기화</th><th>상태</th></tr></thead><tbody>${rows.join('')}</tbody></table>` : '';
  }
  showPlusState();
  try { chrome.storage.onChanged.addListener((ch, area) => { if (area === 'local' && (ch.planSyncState || ch.plusPlanPages || ch.projectList || ch.plusSection)) showPlusState(); }); } catch (e) {}

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
  await loadRcmsCred();
  await loadFetchSites();
  if (self.KRX_FETCH_CHAT) await KRX_FETCH_CHAT.init({ base: helpBase, sites: () => fetchList, docsMap: kindDocsNow, onHowto: applyHowto });   // 사이트 만들기 채팅 (options/fetch-chat.js)
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
