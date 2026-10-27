/* 패널 렌더러 (eClass 콘텐츠스크립트 / 툴바 팝업·사이드 패널 공용) */
(function (g) {
  const F = g.KRX_FMT;
  const RND_MAIN = 'https://rnd.krs.co.kr/rderp_layoutMain.act';   // 딥링크(#krext) 바탕 — rnd-hook.js 가 SYS_LOGIN=Y POST 로 다시 연다
  const RND_OPEN = 'https://rnd.krs.co.kr/jsp/rderp/main/sso_login_krs_view.jsp?SSO_PAGE_GB=A';   // R&D ERP 열기 — eClass 홈 rERP 아이콘과 같은 SSO 진입 (설정 rndUrl 기본값, MIG-09)
  const ECLASS_HOME = 'https://eclass.krs.co.kr/eClassVer4/Home/Index';

  /* 로그인 안내: R&D ERP 주소를 바로 열면 세션이 만들어지지 않는다. 처음 한 번은 eClass 의 R&D ERP 메뉴로 들어가야 한다.
   * 자동 로그인(eClass SSO, background.js rndAutoLogin)이 켜져 있으면 조회 때마다 먼저 시도하므로, 여기까지 온 것은 eClass 도 풀렸거나(eclassLogin) SSO 가 실패한 경우 */
  function loginNotice(state) {
    const d = state.data || {};
    const where = state.mode === 'popup'
      ? `<a href="${ECLASS_HOME}" target="_blank" rel="noopener">eClass</a>를 열고 `
      : 'eClass 화면의 ';
    const eclass = state.mode === 'popup' ? `<a href="${ECLASS_HOME}" target="_blank" rel="noopener">eClass</a>` : 'eClass';
    const manual = `${where}<b>R&amp;D ERP</b> 메뉴를 클릭해서 로그인해주세요. (처음 로그인은 이 메뉴를 거쳐야 세션이 만들어집니다.) 로그인 후 ↻ 새로고침 하세요.`;
    let how;
    if (d.eclassLogin) how = `eClass 로그인이 풀려 자동 로그인(SSO)을 못 했습니다. ${eclass}에 다시 로그인하면 다음 조회 때 R&amp;D ERP 에 자동으로 로그인합니다 (또는 ↻).`;
    else if (d.autoLogin && !d.autoLogin.ok) how = `자동 로그인(SSO)에 실패했습니다: ${F.esc(d.autoLogin.error || d.autoLogin.kind || '')} — ${manual}`;
    else if (d.autoLogin && d.autoLogin.ok) how = `자동 로그인(SSO)을 했지만 R&amp;D ERP 가 여전히 로그인이 필요하다고 응답합니다. ${manual}`;
    else how = manual;
    return `<div class="krext-msg krext-warn">R&amp;D ERP 로그인이 필요합니다. ${how}</div>`;
  }

  /* 큰 숫자 칸. quiet 면 값이 있어도 강조(krext-hot)하지 않음 (건수가 아닌 금액용). toggle 을 주면 링크 대신 그 키의 목록을 펼치고 접는 칸(data-act=prj → state.expanded) */
  function stat(label, val, cls, href, title, quiet, toggle) {
    const v = (val == null || Number.isNaN(val)) ? '-' : F.money(val);
    const hot = !quiet && (val || 0) > 0 ? ' krext-hot' : '';
    const to = toggle ? `href="#" data-act="prj" data-prj="${F.esc(toggle.key)}" aria-expanded="${toggle.open ? 'true' : 'false'}"` : `href="${F.esc(href)}" target="_blank" rel="noopener"`;
    return `<a class="krext-stat${hot}${toggle && toggle.open ? ' krext-open' : ''}" ${to} title="${F.esc(title || 'R&D ERP에서 확인')}">
      <span class="krext-stat-label">${F.esc(label)}</span><span class="krext-stat-val ${cls || ''}">${v}</span></a>`;
  }

  /* 미승인내역 건수: 실시간 조회값 → 없으면 메인화면 방문 시 읽은 스냅샷 */
  function unapprovedCounts(d) {
    if (!d) return null;
    if (d.unapproved) return { supplement: d.unapproved.supplement, apply: d.unapproved.apply, source: 'live' };
    const it = d.unapprovedSnapshot && d.unapprovedSnapshot.items;
    if (it) return { supplement: it['보완요청'] ? it['보완요청'].count : null, apply: it['신청'] ? it['신청'].count : null, source: 'snapshot' };
    return null;
  }

  /* 설정의 카드 별명 { 카드번호 숫자(전체 또는 뒷자리): 별명 }. render() 가 현재 설정으로 채운다.
   * 전체 번호가 정확히 같은 항목 우선, 없으면 뒷자리가 맞는 항목 중 가장 긴 키 */
  let cardNames = {};
  function cardName(cardNo) {
    const d = F.digits(cardNo); if (!d) return '';
    if (cardNames[d]) return String(cardNames[d]);
    let best = '', bestLen = 0;
    for (const [k, v] of Object.entries(cardNames)) {
      const x = F.digits(k);
      if (x && v && x.length > bestLen && (d.endsWith(x) || x.endsWith(d))) { best = String(v); bestLen = x.length; }
    }
    return best;
  }

  /* 헤더 요약 칩. opts.href 면 링크 칩(새 탭), opts.section 이면 구역 전환 칩(data-act=section, 현재 구역이면 krext-on).
   * val 이 undefined 면 숫자 없이 라벨만, null 이면 '-'. 헤더 전체가 접기 버튼이지만 eclass.js 는 a 클릭·data-act 칩을 접기로 처리하지 않는다 */
  function chip(label, val, hotCls, title, opts) {
    const o = opts || {};
    const has = val != null && !Number.isNaN(val);
    const hot = has && val > 0;
    const cls = `krext-chip${hot && hotCls ? ' ' + hotCls : ''}${o.section ? ' krext-chip-sec' : ''}${o.on ? ' krext-on' : ''}`;
    const inner = `<span class="krext-chip-l">${F.esc(label)}</span>${val === undefined ? '' : `<span class="krext-chip-v">${has ? F.money(val) : '-'}</span>`}`;
    const t = ` title="${F.esc(title || label)}"`;
    if (o.href) return `<a class="${cls}" href="${F.esc(o.href)}" target="_blank" rel="noopener"${t}>${inner}</a>`;
    if (o.section) return `<a class="${cls}" href="#" data-act="section" data-section="${F.esc(o.section)}"${t}>${inner}</a>`;
    return `<span class="${cls}"${t}>${inner}</span>`;
  }

  function headerChips(d, state) {
    if (!d) return '';
    if (d.loginRequired) return d.eclassLogin
      ? `<span class="krext-chip krext-chip-warn" title="eClass 로그인이 풀려 R&amp;D ERP 자동 로그인(SSO)을 못 했습니다. eClass에 로그인하면 다음 조회 때 자동으로 로그인합니다"><span class="krext-chip-l">eClass 로그인 필요</span></span>`
      : `<span class="krext-chip krext-chip-warn" title="${d.autoLogin && !d.autoLogin.ok ? '자동 로그인(SSO) 실패: ' + F.esc(d.autoLogin.error || d.autoLogin.kind || '') + ' — ' : ''}eClass의 R&amp;D ERP 메뉴를 클릭해서 로그인해주세요"><span class="krext-chip-l">R&amp;D ERP 로그인 필요</span></span>`;
    const u = unapprovedCounts(d);
    const src = u ? (u.source === 'live' ? '실시간' : `R&D ERP 방문 ${F.fmtClock(d.unapprovedSnapshot.ts)} 기준`) : '아직 수집되지 않음';
    const sec = secOf(state && state.section);
    const sl = supplementLink(d);
    return chip('보완요청', u ? u.supplement : null, 'krext-chip-red', `보완요청 ${u ? F.money(u.supplement) + '건 ' : ''}(내가 올린 결의서 중 결재자가 보완을 요청한 건 · ${src}) · 클릭: ${sl.title}`, { href: sl.href })
         + chip('신청', u ? u.apply : null, 'krext-chip-blue', `신청 ${u ? F.money(u.apply) + '건 ' : ''}(내가 올려 결재 진행 중인 건 · ${src}) · 클릭: ${MY_APPLY_TITLE}`, { href: myApplyBoxLink() })
         // 받은 결재요청(내 결재대기): 다른 사람이 나를 결재자로 지정해 올린 건 — 개인결재함 결재대기함
         + chip('결재', d.inbox ? d.inbox.mine : null, 'krext-chip-red', d.inbox ? `받은 결재요청 ${F.money(d.inbox.mine)}건 (내 결재대기 · 실시간) · 클릭: ${APPR_BOX_TITLE} 결재대기함` : (d.inboxError ? `결재대기 조회 오류: ${d.inboxError}` : '결재대기 건수는 사번을 감지한 뒤 조회됩니다 (R&D ERP 를 한 번 열면 감지)'), { href: approvalBoxLink() })
         // 미청구(건수가 있어도 다른 칩과 같은 회색) / 집행비율: 본문 구역 전환. 접힌 패널이면 펼친다 (eclass.js)
         + chip('미청구', d.totalCount, '', `카드미청구 ${F.money(d.totalCount)}건 · ${F.money(d.totalAmount)}원 · 클릭: 과제별 카드 미청구 내역 보기`, { section: 'cards', on: sec === 'cards' })
         + chip('집행비율', undefined, '', '클릭: 과제집행비율 보기 (과제정보 › 자금현황의 비목별 잔액에 미청구 카드 사용액과 승인 전 신청금액을 더한 값)', { section: 'budget', on: sec === 'budget' });
  }

  /* 미승인내역: 임시저장 / 보완요청 / 신청 / 결재 네 칸을 한 줄에(ERP 대시보드와 같은 순서 + 받은 결재요청), 구역 제목 오른쪽에 구매요청 건수.
   * 임시저장 칸: 결의서가 1건이면 그 결의서 화면을 바로 열고, 여러 건이면 누를 때 목록(tempRows)을 펼쳐 하나씩 열게 한다 (tempLink).
   * 동기화 시각은 헤더의 "HH:MM 기준" 하나만 쓰고(조회 시각은 칸 툴팁), 실시간 조회가 실패해 메인화면 방문 스냅샷을 쓸 때만 그 방문 시각을 제목 옆에 표시 */
  function unapprovedSection(d, s, state) {
    const link = s.rndUrl || RND_OPEN;   // "아직 수집된 값이 없습니다" 안내의 메인화면 링크
    const sl = supplementLink(d);        // 보완요청 칸: 1건이면 그 결의서(청구서(일반) 등), 아니면 미신청내역조회
    const tl = tempLink(d, state);          // 임시저장 칸: 1건이면 그 결의서, 여러 건이면 목록 펼치기, 0건·조회 실패면 미신청내역조회
    // 받은 결재요청(내 결재대기) 칸: 다른 사람이 나를 결재자로 지정해 올린 건 (rmain_0002_01_r001 USER_APPR_CNT). 사번을 모르면 '-'
    const ib = d.inbox;
    const ibTitle = ib ? `받은 결재요청 ${F.money(ib.mine)}건 — 다른 사람이 나를 결재자로 지정해 올린 건 (내 결재대기, 실시간 ${F.fmtClock(ib.ts)})${ib.dept != null ? ` · 부서 결재대기 ${F.money(ib.dept)}건` : ''} · 클릭: ${APPR_BOX_TITLE} 결재대기함`
      : d.inboxError ? `결재대기 조회 오류: ${d.inboxError}` : '결재대기 건수는 사번(USER_ID)을 감지한 뒤 조회됩니다 — R&D ERP 를 한 번 열면 자동 감지';
    let note = '', body = '', src = '', c = null;
    if (d.unapproved) {
      const u = d.unapproved;
      src = `실시간 ${F.fmtClock(u.ts || d.ts)}`;
      c = { supplement: u.supplement, apply: u.apply, temp: u.temp, purchase: u.purchase };
    } else if (d.unapprovedSnapshot && d.unapprovedSnapshot.items) {
      const it = d.unapprovedSnapshot.items, cnt = (k) => it[k] ? it[k].count : null;
      src = note = `R&D ERP 방문 ${F.fmtClock(d.unapprovedSnapshot.ts)} 기준`;
      c = { supplement: cnt('보완요청'), apply: cnt('신청'), temp: cnt('임시저장'), purchase: cnt('구매요청') };
    }
    if (c) {
      body = stat('임시저장', c.temp, '', tl.href, `임시저장 ${F.money(c.temp)}건 — 작성만 하고 아직 신청하지 않은 내 결의서 (${src}) · 클릭: ${tl.title}`, true, tl.toggle)
           + stat('보완요청', c.supplement, '', sl.href, `보완요청 ${F.money(c.supplement)}건 — 내가 올린 결의서 중 결재자가 보완을 요청한 건 (${src}) · 클릭: ${sl.title}`, true)
           + stat('신청', c.apply, '', myApplyBoxLink(), `신청 ${F.money(c.apply)}건 — 내가 올려 결재 진행 중인 건 (${src}) · 클릭: ${MY_APPLY_TITLE}`, true)
           + stat('결재', ib ? ib.mine : null, '', approvalBoxLink(), ibTitle, true);   // 네 칸 모두 같은 색·강조 없음 (숫자 색과 신청 칸 강조를 빼 달라는 요청, 2026-09-25)
      if (!d.unapproved && !s.unapprovedConfigured) body += `<div class="krext-sub krext-dim">실시간 조회 서비스가 아직 설정되지 않아 마지막 방문 시점 값을 표시합니다.</div>`;
    } else {
      body = `<div class="krext-msg krext-dim">아직 수집된 값이 없습니다. <a href="${F.esc(link)}" target="_blank" rel="noopener">R&D ERP 메인화면</a>을 한 번 열면 자동으로 수집됩니다.</div>`;
    }
    if (d.unapprovedError) body += `<div class="krext-sub krext-err">미승인내역 조회 오류: ${F.esc(d.unapprovedError)}</div>`;
    if (d.supplementsError) body += `<div class="krext-sub krext-err">보완요청 목록 조회 오류: ${F.esc(d.supplementsError)}</div>`;
    if (d.tempsError) body += `<div class="krext-sub krext-err">임시저장 목록 조회 오류: ${F.esc(d.tempsError)}</div>`;
    if (d.inboxError) body += `<div class="krext-sub krext-err">결재대기 조회 오류: ${F.esc(d.inboxError)}</div>`;
    if (ib && ib.itemsError) body += `<div class="krext-sub krext-err">결재대기함 목록 조회 오류: ${F.esc(ib.itemsError)}</div>`;
    // 제목 줄 오른쪽: 구매요청 (값이 있을 때만, 0이면 회색 숫자). 임시저장은 칸으로 옮김
    const mini = (label, v) => `<span title="${F.esc(`${label} ${F.money(v)}건 (${src})`)}">${F.esc(label)} <b${(v || 0) > 0 ? '' : ' class="krext-dim"'}>${F.money(v)}</b></span>`;
    const side = [];
    if (c && c.purchase != null) side.push(mini('구매요청', c.purchase));
    const right = side.length ? `<span class="krext-sec-r">${side.join('<span class="krext-dim">·</span>')}</span>` : '';
    return `<section class="krext-sec krext-unappr"><div class="krext-sec-title">미승인내역${note ? `<span class="krext-note">${F.esc(note)}</span>` : ''}${right}</div><div class="krext-stats">${body}</div>${tempRows(d, state)}${supplementRows(d)}${inboxRows(d)}</section>`;
  }

  /* 임시저장 결의서 목록 (미승인내역 칸 바로 아래, 임시저장 칸을 눌러 펼쳤을 때만 — 여러 건일 때): 업무구분 · 과제명 · 금액, 둘째 줄에 결의번호·등록일·대표적요.
   * 클릭하면 그 결의서를 R&D ERP 레이아웃의 탭으로 연다 (청구서(카드)·청구서(일반) 등, slipLink — 저장된 결의서라 REQ_CNT·APPR_DIV_CD=40 을 붙임). 출처 rnd-api fetchTemps (미신청내역조회 rappr_0017_01_r001, 임시저장 40, 등록일자 최근 1개월) */
  function tempRows(d, state) {
    const items = (d.temps && d.temps.items) || [];
    if (items.length < 2 || !(state && state.expanded && state.expanded.has(TEMPS_KEY))) return '';
    const rows = items.slice(0, 8).map((it) => {
      const sc = slipScreen(it);
      const title = `임시저장 · ${it.procTypNm || ''} · ${it.prjNm || ''}${it.prjRspr ? ` (과제책임자 ${it.prjRspr})` : ''} · 결의번호 ${it.docNo || '-'} · 등록 ${it.applDt ? F.fmtDate(it.applDt) : '-'} · 클릭: R&D ERP ${sc ? sc.title : '미신청내역조회'} 열기${sc ? ' (저장된 결의서)' : ''}`;
      const cont = [it.docNo ? `결의번호 ${F.esc(it.docNo)}` : '', it.applDt ? F.esc(F.fmtDate(it.applDt)) : '', it.cont ? F.esc(it.cont) : ''].filter(Boolean).join(' · ');
      return `<a class="krext-inbox-row krext-temp" href="${F.esc(slipLink(it))}" target="_blank" rel="noopener" title="${F.esc(title)}"><b>임시저장</b><span class="krext-inbox-what">${F.esc([it.procTypNm, it.prjNm].filter(Boolean).join(' · '))}</span><span class="krext-inbox-amt">${it.amount != null ? F.money(it.amount) + '원' : ''}</span>${cont ? `<span class="krext-inbox-cont">${cont}</span>` : ''}</a>`;
    }).join('');
    const more = items.length > 8 ? `<div class="krext-sub krext-dim">외 ${F.money(items.length - 8)}건 — <a href="${F.esc(notAppliedLink())}" target="_blank" rel="noopener">미신청내역조회</a>에서 확인</div>` : '';
    return `<div class="krext-inbox">${rows}${more}</div>`;
  }

  /* 보완요청 결의서 목록 (미승인내역 구역 아래, 받은 결재요청 목록 위): 업무구분 · 과제명 · 금액, 둘째 줄에 결재의견(왜 돌아왔는지)과 대표적요.
   * 클릭하면 그 결의서를 R&D ERP 레이아웃의 탭으로 연다 (청구서(일반)·청구서(카드) 등, slipLink). 출처 rnd-api fetchSupplements (미신청내역조회 rappr_0017_01_r001, 보완요청 30, 등록일자 최근 3개월) */
  function supplementRows(d) {
    const items = (d.supplements && d.supplements.items) || [];
    if (!items.length) return '';
    const rows = items.slice(0, 8).map((it) => {
      const sc = slipScreen(it);
      const title = `보완요청 · ${it.procTypNm || ''} · ${it.prjNm || ''}${it.prjRspr ? ` (과제책임자 ${it.prjRspr})` : ''} · 결의번호 ${it.docNo || '-'} · 신청 ${it.applDt ? F.fmtDate(it.applDt) : '-'} · 신청자 ${it.draftUser || '-'}${it.opinion ? ` · 결재의견: ${it.opinion}` : ''} · 클릭: R&D ERP ${sc ? sc.title : '미신청내역조회'} 열기`;
      const cont = [it.opinion ? `<em class="krext-inbox-op">${F.esc(it.opinion)}</em>` : '', it.cont ? F.esc(it.cont) : ''].filter(Boolean).join(' · ');
      return `<a class="krext-inbox-row krext-suppl" href="${F.esc(slipLink(it))}" target="_blank" rel="noopener" title="${F.esc(title)}"><b>보완요청</b><span class="krext-inbox-what">${F.esc([it.procTypNm, it.prjNm].filter(Boolean).join(' · '))}</span><span class="krext-inbox-amt">${it.amount != null ? F.money(it.amount) + '원' : ''}</span>${cont ? `<span class="krext-inbox-cont">${cont}</span>` : ''}</a>`;
    }).join('');
    const more = items.length > 8 ? `<div class="krext-sub krext-dim">외 ${F.money(items.length - 8)}건 — 미신청내역조회에서 확인</div>` : '';
    return `<div class="krext-inbox">${rows}${more}</div>`;
  }

  /* 받은 결재요청 목록 (미승인내역 구역 아래): 개인결재함 결재대기함 행 — 신청자 · 업무구분 · 대표과제명 · 금액 · 대표적요. 클릭하면 개인결재함 */
  function inboxRows(d) {
    const ib = d.inbox;
    if (!ib || !(ib.items || []).length) return '';
    const href = approvalBoxLink();
    const rows = ib.items.slice(0, 8).map((it) => {
      const title = `${it.procTyp || ''} · ${it.prjNm || ''}${it.prjRspr ? ` (과제책임자 ${it.prjRspr})` : ''} · 문서번호 ${it.docNo || '-'} · 신청 ${it.draftDate || '-'} · 상태 ${it.status || '-'}${it.expStatus ? ' / ' + it.expStatus : ''} · 클릭: ${APPR_BOX_TITLE}`;
      return `<a class="krext-inbox-row" href="${F.esc(href)}" target="_blank" rel="noopener" title="${F.esc(title)}"><b>${F.esc(it.draftUser || '-')}</b><span class="krext-inbox-what">${F.esc([it.procTyp, it.prjNm].filter(Boolean).join(' · '))}</span><span class="krext-inbox-amt">${it.amount != null ? F.money(it.amount) + '원' : ''}</span>${it.cont ? `<span class="krext-inbox-cont">${F.esc(it.cont)}</span>` : ''}</a>`;
    }).join('');
    const more = ib.items.length > 8 ? `<div class="krext-sub krext-dim">외 ${F.money(ib.items.length - 8)}건 — 개인결재함에서 확인</div>` : '';
    return `<div class="krext-inbox">${rows}${more}</div>`;
  }

  function cardsTable(p, state) {
    if (p.error) return `<div class="krext-sub krext-err">조회 오류: ${F.esc(p.error)}</div>`;
    // 발급 카드 수·원본 건수 같은 일상 정보는 행 자체와 중복이라 표시하지 않고, 누락 이유(계좌 미확인/제외 건수)만 메모로 남김
    const info = [];
    if (p.acctKnown === false) info.push('과제 계좌 미확인 (발급 카드 전체를 이 과제 카드로 봄)');
    if (p.otherCards) info.push(`다른 계좌 카드 ${F.money(p.otherCards)}건 제외`);
    if (p.filteredByCard) info.push(`카드 필터로 ${F.money(p.filteredByCard)}건 제외`);
    if (p.matchNote) info.push(p.matchNote);
    const other = info.length ? `<div class="krext-sub krext-dim">${F.esc(info.join(' · '))}</div>` : '';
    if (!p.cards.length) return `<div class="krext-sub krext-dim">이 과제 카드의 미청구 내역 없음</div>${other}`;
    const rows = p.cards.map((c) => txRow(c, false, p.prjNo, state)).join('');
    return `<div class="krext-tx-wrap"><table class="krext-cards krext-tx-table"><thead><tr><th>카드(뒤8자리)</th><th>사용일시</th><th>가맹점</th><th>승인번호</th><th class="krext-num">사용액</th></tr></thead><tbody>${rows}</tbody></table></div>${other}`;
  }

  /* 연구내용 탭에서 과제를 펼친 본문 (0.8.5, lib/research.js 기록): 개발목표 · 개발내용 · 성능목표 · 주요결과물(개발내용과 같으면 생략) · 수행일정 · 연구활동비 세부사용계획(계) · 복사 */
  function researchBody(rec) {
    const RS = g.KRX_RESEARCH, esc = F.esc;
    const ul = (xs, f) => xs.length ? `<ul>${xs.map((x) => `<li>${f(x)}</li>`).join('')}</ul>` : '';
    const sec = (title, inner) => inner ? `<div class="krext-rs-sec"><div class="krext-rs-h">${title}</div>${inner}</div>` : '';
    const sch = rec.schedule || { months: 0, items: [] };
    const spend = rec.spend.length ? `<table class="krext-rs-spend"><tbody>${rec.spend.map((s) => `<tr><td>${esc(s.name)}${s.method ? ` <span class="krext-dim">${esc(s.method)}</span>` : ''}</td><td class="krext-num krext-dim">${s.qty != null ? `× ${F.money(s.qty)}` : ''}</td><td class="krext-num">${s.amount != null ? F.money(s.amount) : '-'}</td></tr>`).join('')}</tbody>`
      + `<tfoot><tr><td>계</td><td></td><td class="krext-num">${F.money(RS.spendTotal(rec))}</td></tr></tfoot></table>` : '';
    const info = [rec.code, rec.period ? `기간 ${rec.period}` : '', rec.role ? `KR ${rec.role}` : '', rec.src ? '공유 파일에서 받음' : ''].filter(Boolean).join(' · ');
    return `<div class="krext-rs-body">
      ${rec.goals.length ? sec('개발목표', `<ol>${rec.goals.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`) : ''}
      ${sec('개발내용', ul(rec.contents, (c) => `${esc(c.item)}${ul(c.details, esc)}`))}
      ${sec('성능목표', ul(rec.perf, (x) => `${esc(x.name)}: <b>${esc(RS.perfTarget(x))}</b>${x.method ? ` <span class="krext-dim">(${esc(x.method)})</span>` : ''}`))}
      ${RS.sameAsContents(rec) ? '' : sec('주요결과물', ul(rec.outputs, esc))}
      ${sec(`수행일정${sch.months ? ` <span class="krext-dim">${sch.months}개월</span>` : ''}`, ul(sch.items, (a) => `${esc(a.name)}<span class="krext-dim">${a.weeks ? ` · ${a.weeks}주` : ''}${RS.monthsOf(a) ? ` · ${RS.monthsOf(a)}` : ''}</span>`))}
      ${sec('연구활동비 세부사용계획 <span class="krext-dim">(원)</span>', spend)}
      <div class="krext-rs-foot"><span class="krext-dim">${esc(info)}</span><button type="button" class="krext-prep-btn" data-act="rs-copy" data-id="${esc(rec.id)}" title="이 계획서 내용(비목별 예산·참여연구자 포함)을 글로 복사">복사</button></div>
    </div>`;
  }

  /* R&D ERP 딥링크: rderp_layoutMain.act#krext=... (rnd-hook.js 가 레이아웃 안에서 해당 화면 탭을 연다) */
  function deepLink(req) { return RND_MAIN + '#krext=' + encodeURIComponent(JSON.stringify(req)); }
  /* 청구서(카드): 과제 + 승인번호 행 자동 선택. usedDate(카드 사용일)는 그 행이 화면의 기본 조회 기간(이번 달) 밖일 때 훅이 조회 시작일로 쓴다 (rnd-hook.js autoSelectRow) */
  function claimLink(prjNo, appr, cardNo, usedDate) {
    const req = { open: 'rexpe_0083_01.act', title: '청구서(카드)', menuId: 'menu_id_362', q: 'PRJ_NO=' + encodeURIComponent(prjNo || ''), appr: appr || '', card: F.digits(cardNo || '').slice(-4) };
    const used = F.digits(usedDate || '').slice(0, 8);
    if (used.length === 8) req.date = used;
    return deepLink(req);
  }
  /* 개인결재함 (전자결재 › 결재함, rappr_0002_01). 메뉴 ID는 사용자마다 다른 메뉴 트리에서 rnd-hook.js 가 화면 URL·메뉴 이름으로 찾고,
   * 못 찾으면 결재함 상단 메뉴(menu_id_7, 레이아웃이 SSO 로그인 시 클릭하는 메뉴)를 클릭한다. 화면이 URL 파라미터를 받지 않아 탭·조건은 넘기지 않음 */
  const APPR_BOX_TITLE = 'R&D ERP 개인결재함 열기 (전자결재 › 결재함)';
  function approvalBoxLink() {
    return deepLink({ open: 'rappr_0002_01.act', title: '개인결재함', menuName: '개인결재함', topMenuId: 'menu_id_7' });
  }
  /* MY신청함 (전자결재 › 결재함, rappr_0001_01 "내결재함"): 내가 올린 신청(결의서) 목록 — 미승인내역의 "신청" 건수(APPLY_CNT)는 여기의 결재진행 건. ERP 대시보드도 신청 칸을 이 화면으로 연결하도록 돼 있음(주석 처리됨).
   * 화면은 URL 파라미터를 받지 않고 열리면 기본 조건(신청일자 최근 1개월 · 상태 전체)으로 바로 조회한다 (2026-09-25 CDP 확인: 신청한 결의서가 첫 행에 "결재진행"으로 표시) */
  const MY_APPLY_TITLE = 'R&D ERP MY신청함 열기 (내가 올린 신청 목록, 전자결재 › 결재함)';
  function myApplyBoxLink() {
    return deepLink({ open: 'rappr_0001_01.act', title: 'MY신청함', menuName: 'MY신청함', topMenuId: 'menu_id_7' });
  }
  /* 미신청내역조회 (전자결재 › 결재함, rappr_0017_01): 임시저장(40)·보완요청(30) 상태의 내 결의서 목록 — 미승인내역의 임시저장·보완요청 건수가 여기 건. ERP 대시보드가 임시저장·보완요청 칸에 쓰는 주소와 같이
   * DASH_MNTH_RANGE=1(등록일자 최근 1개월)·AUTO_SEARCH=Y(열리면 바로 조회)를 붙인다 — 화면 스크립트 applyDashboardNotApplInqEntry 가 이 둘만 읽고 상태 라디오(APPR_DIV_CD)는 주소로 못 정한다 (2026-09-25 CDP 확인) */
  const NOT_APPLIED_TITLE = 'R&D ERP 미신청내역조회 열기 (임시저장·보완요청 상태의 내 결의서 목록, 최근 1개월 자동 조회)';
  function notAppliedLink() {
    return deepLink({ open: 'rappr_0017_01.act', title: '미신청내역조회', menuName: '미신청내역조회', topMenuId: 'menu_id_7', q: 'DASH_MNTH_RANGE=1&AUTO_SEARCH=Y' });
  }
  /* 과제정보 (TAB_ID 01 기본정보, 05 카드 등) */
  function projectLink(prjNo, tabId) {
    return deepLink({ open: 'rtask_0008_t00_01.act', title: '과제정보', menuId: 'menu_id_80', q: 'PRJ_NO=' + encodeURIComponent(prjNo || '') + '&TAB_ID=' + (tabId || '01') });
  }
  /* 저장된 결의서 화면 — 미신청내역조회 화면 스크립트(rappr_0017_01.js goProcTab, 2026-09-29 확인)가 상태 칸 클릭에 여는 화면을 업무구분(PROC_TYP_CD)별로 그대로 따른다.
   * 일반(P10·P20·P40)·카드(P11)는 메뉴 ID 가 기관마다 달라(ERP 도 req2Info 로 메뉴 트리에서 찾음) 화면 URL·메뉴 이름으로 찾게 하고(rnd-hook.js), 나머지는 ERP 가 고정한 메뉴 ID.
   * 주소에는 ERP 와 같이 PRJ_NO·REQ_CNT(결의서 차수)·APPR_DIV_CD 와 회의록 규칙(CFRC_*)·수익사업구분을 붙인다 — 저장된 결의서는 REQ_CNT 가 있어야 열린다(PRJ_NO 만 주면 새 폼) */
  const SLIP_SCREENS = {
    P10: { open: 'rexpe_0084_01.act', title: '청구서(일반)', menuName: '일반청구' }, P20: { open: 'rexpe_0084_01.act', title: '청구서(일반)', menuName: '일반청구' }, P40: { open: 'rexpe_0084_01.act', title: '청구서(일반)', menuName: '일반청구' },
    P11: { open: 'rexpe_0083_01.act', title: '청구서(카드)', menuName: '카드청구' },
    P12: { open: 'rexpe_0003_01.act', title: '청구서작성(대량)', menuId: 'menu_id_95', procTyp: true }, P13: { open: 'rexpe_0003_01.act', title: '청구서작성(대량)', menuId: 'menu_id_95', procTyp: true },
    P14: { open: 'rexpe_0003_01.act', title: '청구서작성(대량)', menuId: 'menu_id_95', procTyp: true }, P15: { open: 'rexpe_0003_01.act', title: '청구서작성(대량)', menuId: 'menu_id_95', procTyp: true },
    P21: { open: 'rexpe_0004_01.act', title: '반납요구서작성', menuId: 'menu_id_96' }, P22: { open: 'rexpe_0005_01.act', title: '징수결의서작성', menuId: 'menu_id_97' },
    P23: { open: 'rexpe_0006_01.act', title: '자금대체결의서작성', menuId: 'menu_id_98' }, P24: { open: 'rexpe_0007_03.act', title: '일반대체결의서작성', menuId: 'menu_id_99' },
    P31: { open: 'rexpe_0036_01.act', title: '현물결의', menuId: 'menu_id_390' }, P33: { open: 'rexpe_0131_01.act', title: '예산잔액조정내역', menuId: 'menu_id_894' }, P34: { open: 'rexpe_0180_01.act', title: '사비입금신청', menuId: 'menu_id_1386' }
  };
  function slipScreen(it) {
    const cd = String((it && it.procTypCd) || '').trim();
    if (cd === 'P10' && it.reqGbn) return { open: 'rexpe_0076_01.act', title: '지재권청구', menuId: 'menu_id_564' };
    if (cd === 'P11' && it.cardSent === false) return { open: 'rexpe_0002_02.act', title: '청구서작성(미전송건)', menuId: 'menu_id_365' };   // 과제카드 첨부 청구건수 0 (rcomm_0114_01_r001 NCNT)
    return SLIP_SCREENS[cd] || null;
  }
  function slipLink(it) {
    const sc = slipScreen(it);
    if (!sc) return notAppliedLink();   // 지출 결의서가 아닌 업무구분 — 미신청내역조회에서 직접 열기
    const pairs = [['PRJ_NO', it.prjNo], ['REQ_CNT', it.reqCnt], ['APPR_DIV_CD', it.apprDivCd || '30'], ['CFRC_OUT_ATTNTS_MARK_YN', it.cfrcOut], ['CFRC_LIMITED_YN', it.cfrcLimited], ['CFRC_LIMITED_AMT', it.cfrcLimitedAmt], ['PRJ_GAIN_BIZ_DIV_CD', it.gainBiz]];
    if (sc.procTyp) pairs.push(['PROC_TYP_CD', it.procTypCd]);
    const q = pairs.map(([k, v]) => k + '=' + encodeURIComponent(v == null ? '' : String(v))).join('&');
    const req = { open: sc.open, title: sc.title, q };
    if (sc.menuId) req.menuId = sc.menuId; else req.menuName = sc.menuName;
    return deepLink(req);
  }
  /* 임시저장 칸의 동작: 임시저장 결의서가 1건이면 그 결의서를 바로(href), 여러 건이면 목록 펼치기/접기(toggle — state.expanded 의 TEMPS_KEY), 0건·목록 조회 실패면 미신청내역조회 */
  const TEMPS_KEY = '__temps';
  function tempLink(d, state) {
    const items = (d && d.temps && d.temps.items) || [];
    if (items.length === 1) {
      const it = items[0], sc = slipScreen(it);
      return { href: slipLink(it), title: sc ? `R&D ERP ${sc.title} 열기 — 저장된 결의서 (${it.prjNm || it.prjNo}${it.docNo ? ` · 결의번호 ${it.docNo}` : ''})` : NOT_APPLIED_TITLE };
    }
    if (items.length > 1) {
      const open = !!(state && state.expanded && state.expanded.has(TEMPS_KEY));
      return { href: notAppliedLink(), toggle: { key: TEMPS_KEY, open }, title: open ? '임시저장 결의서 목록 접기' : `임시저장 결의서 ${F.money(items.length)}건 목록 펼치기 — 목록에서 고르면 그 저장된 결의서 화면을 엽니다` };
    }
    return { href: notAppliedLink(), title: NOT_APPLIED_TITLE };
  }
  /* 보완요청 칸·칩의 링크: 보완요청 결의서가 1건이면 그 결의서를 바로, 여러 건·0건·목록 조회 실패면 미신청내역조회(보완요청·임시저장 목록) */
  function supplementLink(d) {
    const items = (d && d.supplements && d.supplements.items) || [];
    if (items.length === 1) {
      const it = items[0], sc = slipScreen(it);
      return { href: slipLink(it), title: sc ? `R&D ERP ${sc.title} 열기 (${it.prjNm || it.prjNo}${it.opinion ? ` · 결재의견: ${it.opinion}` : ''})` : NOT_APPLIED_TITLE };
    }
    return { href: notAppliedLink(), title: NOT_APPLIED_TITLE + (items.length > 1 ? ` — 보완요청 ${F.money(items.length)}건은 아래 목록에서 하나씩 열 수 있음` : '') };
  }

  /* ---------- 과제 참여율 (과제정보 › 참여인력 › 계상률기준내역의 본인 계상률 합, rnd-api summarizeParticipation) ----------
   * 접힌 줄: 막대 + 합계 %. 클릭(data-act=prj, key __participation → state.expanded)하면 과제별 참여율·참여기간 표
   * 예비 참여율(참여 계획, lib/part.js): 과제 행의 ＋ 로 참여율·기간(달력)을 적어 두면 그 행 밑에 "↳ 계획 ✎ ×" 줄로 보이고,
   * 합계(ERP 계상률, 변경 전) 줄은 그대로 둔 채 그 밑에 오늘부터 계획이 든 기간별 "계획 반영" 합계 줄(계획 과제는 계획 참여율, 나머지는 그날의 계상률 행·과제 종료일 기준, P.periods)을 보여준다.
   * 표에 없는 과제(ERP 에 아직 없는 과제)의 계획은 표 끝 "다른 과제 참여 계획" ＋ 로 과제명과 함께 적는다 */
  const PART_KEY = '__participation';
  const rateTxt = (v) => (v == null || Number.isNaN(v)) ? '-' : `${Number.isInteger(Number(v)) ? Number(v) : (Math.round(Number(v) * 100) / 100)}%`;
  const shortD8 = (s) => { const d = F.digits(s).slice(0, 8); return d.length === 8 ? `${d.slice(2, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}` : ''; };
  // 과제명은 앞 6자만 (전체 이름은 툴팁)
  const shortNm = (nm) => { const s = String(nm || '').trim(); return s.length > 6 ? s.slice(0, 6) + '…' : s; };
  const overCls = (v) => v > 100 ? ' krext-red' : '';
  const spare = (v) => v > 100 ? '100% 초과' : `여유 ${rateTxt(Math.round((100 - v) * 100) / 100)}`;
  const sumTxt = (at) => at.parts.map((p) => `${shortNm(p.prjNm) || p.prjNo} ${p.ended ? '종료' : rateTxt(p.rate)}${p.planned ? '(계획)' : ''}`).join(' + ');
  /* 참여 계획 줄: 이름 칸에 "↳ 계획 ✎ ×" 를 한 줄로(표에 없는 과제면 뒤에 과제명), 참여율 · 기간 칸. 기간별 합계는 표 아래 계획 반영 줄에 */
  function partPlanRow(e, other, endDt) {
    const tip = [`참여 계획 ${rateTxt(e.rate)} · ${e.st || '?'} ~ ${e.end || '미정'}`, e.prjNm || '', `${F.fmtClock(e.ts)} 입력 · 이 브라우저에만 저장`].filter(Boolean).join(' · ');
    const ref = `data-id="${F.esc(e.id)}" data-end="${F.esc(endDt || '')}"${other ? ' data-free="1"' : ''}`;
    const acts = `<span class="krext-plan-acts"><button type="button" data-act="part-edit" ${ref} title="수정">✎</button><button type="button" data-act="part-del" ${ref} title="삭제">×</button></span>`;
    return `<tr class="krext-part-plan" title="${F.esc(tip)}"><td class="krext-part-nm"><span class="krext-plan-head"><span class="krext-plan-ind">↳</span><span class="krext-tag krext-tag-sub">계획</span>${acts}${other ? `<span class="krext-plan-nm">${F.esc(shortNm(e.prjNm))}</span>` : ''}</span></td>
      <td class="krext-num krext-plan-rate">${rateTxt(e.rate)}</td><td class="krext-part-term krext-dim krext-mono">${F.esc(`${shortD8(e.st) || '?'} ~ ${shortD8(e.end)}`)}</td></tr>`;
  }
  /* 참여기간 달력 (state.partCal): 시작일 → 종료일 순서로 클릭. 프리셋: 오늘부터 / 연말까지 / 과제 종료까지(과제 종료일이 있을 때) */
  function partCalendar(P, state) {
    const c = state.partCal; if (!c) return '';
    const d = state.partDraft || {}, st = P.d8(d.st), end = P.d8(d.end), today = F.ymd(new Date());
    const cells = P.monthGrid(c.ym).map((x) => {
      const cls = ['krext-cal-d', x.out ? 'krext-cal-out' : '', x.day === today ? 'krext-cal-today' : '', (x.day === st || x.day === end) ? 'krext-cal-sel' : '', st && end && x.day > st && x.day < end ? 'krext-cal-in' : ''].filter(Boolean).join(' ');
      return `<button type="button" class="${cls}" data-act="part-cal-day" data-day="${x.day}" title="${x.day.slice(0, 4)}-${x.day.slice(4, 6)}-${x.day.slice(6, 8)}">${x.d}</button>`;
    }).join('');
    const endDt = state.partEdit && state.partEdit.endDt;
    const hint = (c.pick === 'st' || !st) ? '시작일을 고르세요' : `종료일을 고르세요 (시작 ${shortD8(st)}${end ? ` ~ ${shortD8(end)}` : ''})`;
    return `<div class="krext-cal" role="dialog" aria-label="참여기간 선택">
      <div class="krext-cal-head"><button type="button" data-act="part-cal-nav" data-d="-1" title="이전 달">‹</button><b>${c.ym.slice(0, 4)}년 ${Number(c.ym.slice(4, 6))}월</b><button type="button" data-act="part-cal-nav" data-d="1" title="다음 달">›</button></div>
      <div class="krext-cal-hint">${F.esc(hint)}</div>
      <div class="krext-cal-grid">${['일', '월', '화', '수', '목', '금', '토'].map((w, i) => `<span class="krext-cal-wd${i === 0 ? ' krext-red' : ''}">${w}</span>`).join('')}${cells}</div>
      <div class="krext-cal-foot"><button type="button" data-act="part-cal-set" data-st="today" title="시작일 = 오늘">오늘부터</button><button type="button" data-act="part-cal-set" data-end="year" title="종료일 = 시작일이 속한 해의 12월 31일">연말까지</button>${endDt ? `<button type="button" data-act="part-cal-set" data-end="${F.esc(endDt)}" title="종료일 = 과제 종료일 ${F.esc(shortD8(endDt))}">과제 종료까지</button>` : ''}<button type="button" data-act="part-cal-clear" title="기간 지우기">지움</button><button type="button" data-act="part-cal-close" title="닫기 (Esc)">닫기</button></div></div>`;
  }
  /* 참여 계획 입력 폼 (한 번에 하나만: state.partEdit). 표 밖 과제 폼(free)에는 과제명 칸이 앞에 붙는다. 값은 state.partDraft 에 있어 다시 그려도 입력이 유지된다 */
  function partForm(P, state, names) {
    const pe = state.partEdit, d = state.partDraft || { name: '', rate: '', st: '', end: '' };
    const st = P.d8(d.st), end = P.d8(d.end);
    const period = st ? `${shortD8(st)} ~ ${end ? shortD8(end) : '미정'}` : '기간 선택';
    return `<tr class="krext-part-form"><td colspan="3"><div class="krext-plan-form krext-part-frm">
      <span class="krext-plan-ind">↳</span>
      ${pe.free ? `<input type="text" data-part="name" list="krext-part-names" placeholder="과제명 (ERP에 아직 없는 과제)" value="${F.esc(d.name)}" maxlength="80" autocomplete="off" title="과제명. 패널의 과제 목록에 있는 이름이면 그 과제로 연결됩니다">` : ''}
      <label>참여율 <input type="text" inputmode="decimal" data-part="rate" value="${F.esc(d.rate)}" placeholder="0" title="예비 참여율 (%)">%</label>
      <button type="button" class="krext-part-cal-btn${state.partCal ? ' krext-on' : ''}${st ? '' : ' krext-part-cal-empty'}" data-act="part-cal" title="참여기간 선택 — 달력에서 시작일, 종료일 순서로 클릭 (종료일을 비우면 미정)">${ICON_CAL}${F.esc(period)}</button>
      <button type="button" class="krext-plan-btn krext-plan-save" data-act="part-save">${pe.id ? '저장' : '추가'}</button>
      <button type="button" class="krext-plan-btn" data-act="part-cancel" title="취소 (Esc)">취소</button>
      ${state.partError ? `<span class="krext-err krext-plan-err">${F.esc(state.partError)}</span>` : ''}
      ${partCalendar(P, state)}
    </div>${pe.free ? `<datalist id="krext-part-names">${names.map((n) => `<option value="${F.esc(n)}"></option>`).join('')}</datalist>` : ''}</td></tr>`;
  }
  function participationSection(d, s, state) {
    if (d.loginRequired) return '';
    const pt = d.participation;
    const P = g.KRX_PART, plans = (P && Array.isArray(state.partPlans)) ? state.partPlans : [];
    const title = (note) => `<div class="krext-sec-title">과제 참여율 <span class="krext-note">${note}</span></div>`;
    if (!pt) {
      let why = '참여인력 정보 없음';
      if (d.participationError) why = '조회 오류';
      else if (d.memberFilter === 'no-id' || (!(d.myIds || []).length && !(d.myNames || []).length)) why = '본인 사번/이름 확인 전';
      else if (d.memberFilter === 'ambiguous') why = '동명이인 확인 필요 (설정에서 사번 선택)';
      return `<section class="krext-sec krext-part">${title(F.esc(why))}${d.participationError ? `<div class="krext-sub krext-err">${F.esc(d.participationError)}</div>` : ''}</section>`;
    }
    const open = state.expanded.has(PART_KEY);
    const total = pt.total || 0;
    const cls = total > 100 ? ' krext-bar-over' : '';   // 참여율은 100% 가까운 게 정상이라 90% 주의색 없이 파랑, 100% 초과만 빨강
    const tip = [`본인 계상률 합계 ${rateTxt(total)} / 100% (참여 과제 ${F.money(pt.items.length)}건, 오늘이 참여기간에 드는 계상률기준 행만)`,
      pt.totalExcluded ? `계상률 체크제외 ${rateTxt(pt.totalExcluded)} 는 합계에서 제외` : '',
      pt.unknownCount ? `계상률 미상 ${F.money(pt.unknownCount)}건 (인력기준내역에만 있음)` : '',
      pt.errorCount ? `참여인력 조회 실패 ${F.money(pt.errorCount)}건` : '',
      plans.length ? `참여 계획 ${F.money(plans.length)}건 (표의 ＋ 로 적은 예비 참여율)` : '',
      pt.useId ? '사번 기준' : '이름 기준',
      d.membershipCheckedAt ? `참여인력 ${F.fmtClock(d.membershipCheckedAt)} 조회 (2시간 캐시 · 제목 줄 ↻ 로 다시 조회)` : '',
      d.membershipFailed ? `참여인력 다시 조회 실패 ${F.money(d.membershipFailed)}건 — 이전 값 사용 (${d.membershipFailMsg || '오류'})` : '', '클릭: 과제별 참여율'].filter(Boolean).join(' · ');
    const head = `<a href="#" class="krext-part-head" data-act="prj" data-prj="${PART_KEY}" title="${F.esc(tip)}">
      <span class="krext-caret">${open ? '▾' : '▸'}</span>
      <span class="krext-bar krext-part-bar"><span class="krext-bar-fill${cls}" style="width:${Math.max(0, Math.min(100, total))}%"></span></span>
      <span class="krext-part-v${total > 100 ? ' krext-red' : ''}">${rateTxt(total)}</span><span class="krext-dim krext-part-max">/ 100%</span>
      <span class="krext-dim krext-part-cnt">${F.money(pt.items.length)}개 과제${plans.length ? ` · 계획 ${F.money(plans.length)}` : ''}</span></a>`;
    let body = '';
    if (open) {
      const shortTerm = (t) => String(t || '').replace(/\s+/g, '').replace(/(\d{4})[-./]?(\d{2})[-./]?(\d{2})/g, (m, y, mo, dd) => `${y.slice(2)}.${mo}.${dd}`).replace(/(\d{4})[-./](\d{2})(?![-./\d])/g, (m, y, mo) => `${y.slice(2)}.${mo}`);
      // 역할은 이름 앞에 한 글자 태그만: 책(책임) · 참(참여) · 보(보조). 원래 역할명은 툴팁
      // 역할: ERP 역할명에 "책임"이 있거나, 과제책임자 이름이 본인(참여인력 행의 이름 또는 설정·자동 감지 이름)과 같으면 책임
      const myNames = (d.myNames || []).map((n) => String(n || '').trim()).filter(Boolean);
      const isLead = (x) => /책임/.test(String(x.role || '')) || (!!x.rspr && (String(x.rspr).trim() === String(x.empNm || '').trim() || myNames.includes(String(x.rspr).trim())));
      const roleTag = (x) => {
        const full = String(x.role || '').trim(), lead = isLead(x);
        const kind = lead ? '책임' : (/보조/.test(full) ? '보조' : '참여');
        const tip = [kind, full && full !== kind ? full : '', lead && !/책임/.test(full) ? '과제책임자' : ''].filter(Boolean).join(' · ');
        return `<span class="krext-tag${lead ? '' : ' krext-tag-grey'}" title="${F.esc(tip)}">${kind[0]}</span>`;
      };
      // 참여 계획 (lib/part.js): 과제 행의 ＋ → 그 행 밑 입력 폼, 저장된 계획은 그 행 밑 "계획" 줄. 표 밖 과제 계획은 표 끝
      const pe = P && state.partEdit ? state.partEdit : null;
      const names = P ? Array.from(new Set((d.projects || []).map((p) => p.prjNm).filter(Boolean))) : [];
      const form = () => partForm(P, state, names);
      const plus = (x) => P ? `<button type="button" class="krext-plus-btn" data-act="part-open" data-prj="${F.esc(x.prjNo)}" data-nm="${F.esc(x.prjNm)}" data-end="${F.esc(x.endDt || '')}" title="예비 참여율(참여 계획) 추가 — 참여율과 기간을 적어 두면 이 줄 밑에 계획 줄로 보입니다">＋</button>` : '';
      const rows = pt.items.map((x) => {
        const t = [x.prjNo, x.prjNm, x.rspr ? `책임자 ${x.rspr}` : '', x.role, x.term ? `참여기간 ${x.term}` : '', (x.kinds || []).length ? `종류 ${x.kinds.join(', ')}` : '',
          x.excludedRate ? `계상률 체크제외 ${rateTxt(x.excludedRate)} (합계 제외)` : '',
          x.allowanceRate ? `연구수당 성격 행 ${rateTxt(x.allowanceRate)} (참여율 아님, 제외)` : '',
          x.overlapCount ? `같은 종류의 현재 계상률 행이 겹쳐 가장 최근 1개만 반영 (${F.money(x.overlapCount)}개 제외)` : '',
          x.futureRate ? `이후 기간 계상률 ${rateTxt(x.futureRate)}` : '', !x.hasInfo ? '계상률기준내역에 참여율 행 없음' : ''].filter(Boolean).join(' · ');
        let html = `<tr title="${F.esc(t)}">
          <td class="krext-part-nm"><div class="krext-part-nmw">${roleTag(x)}<a class="krext-part-link" href="${F.esc(projectLink(x.prjNo, '03'))}" target="_blank" rel="noopener" title="${F.esc(x.prjNm)} · R&amp;D ERP 과제정보 › 참여인력 탭 열기 (${F.esc(x.prjNo)})">${F.esc(x.prjNm || x.prjNo)}</a></div></td>
          <td class="krext-num">${x.hasInfo ? rateTxt(x.rate) : '<span class="krext-dim" title="계상률기준내역에 없음">-</span>'}${x.excludedRate ? ` <span class="krext-dim" title="계상률 체크제외 (합계 제외)">+${rateTxt(x.excludedRate)}</span>` : ''}</td>
          <td class="krext-part-term"><span class="krext-dim krext-mono">${F.esc(shortTerm(x.term))}</span>${plus(x)}</td></tr>`;
        if (P) {   // 이 과제의 계획 줄(수정 중이면 폼) + 새 계획 폼
          html += P.listOf(plans, x.prjNo).map((e) => (pe && pe.id === e.id) ? form() : partPlanRow(e, false, x.endDt)).join('');
          if (pe && !pe.id && !pe.free && pe.prjNo === x.prjNo) html += form();
        }
        return html;
      }).join('');
      let extra = '';
      if (P) {   // 표에 없는 과제의 계획(과제명 함께) + "다른 과제 참여 계획" ＋ (또는 그 폼)
        extra += P.others(plans, pt.items).map((e) => (pe && pe.id === e.id) ? form() : partPlanRow(e, true, '')).join('');
        extra += (pe && !pe.id && pe.free) ? form()
          : `<tr class="krext-part-add"><td colspan="3"><button type="button" class="krext-plus-btn" data-act="part-new" title="표에 없는 과제(ERP에 아직 없는 신규·예정 과제)의 참여 계획 추가 — 과제명 · 참여율 · 기간">＋</button> <span class="krext-dim">다른 과제 참여 계획</span></td></tr>`;
      }
      // 합계(ERP 계상률, 변경 전) 줄은 그대로 두고, 그 밑에 오늘부터 계획이 든 기간별 "계획 반영" 합계 줄 (lib/part.js periods: 계획·계상률 행·과제 종료일을 경계로 잘라 구간마다
      // 계획 과제는 계획 참여율, 나머지 과제는 그날 유효한 계상률 행, 종료된 과제는 0(툴팁에 "종료")). 기간 끝이 미정이면 "시작일 ~"
      const planFoot = (P ? P.periods(pt.items, plans) : []).map((s) => {
        const term = `${shortD8(s.st)} ~ ${s.end ? shortD8(s.end) : ''}`.trim();
        const tip = `${term} 계획 반영 합계 ${rateTxt(s.total)}${s.total > 100 ? ' (100% 초과)' : ''} = ${sumTxt(s)}`;
        return `<tr class="krext-part-planfoot" title="${F.esc(tip)}"><td>계획 반영 <span class="krext-dim krext-mono krext-part-per">${F.esc(term)}</span></td><td class="krext-num${overCls(s.total)}">${rateTxt(s.total)}</td><td class="${s.total > 100 ? 'krext-red' : 'krext-dim'}">${spare(s.total)}</td></tr>`;
      }).join('');
      body = `<table class="krext-cards krext-part-table"><thead><tr><th>과제</th><th class="krext-num">참여율</th><th>기간</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="3" class="krext-dim">본인이 참여인력(계상률기준)에 있는 과제가 없습니다.</td></tr>'}${extra}</tbody>
        <tfoot><tr><td>합계</td><td class="krext-num${overCls(total)}">${rateTxt(total)}</td><td class="krext-dim">${spare(total)}</td></tr>${planFoot}</tfoot></table>`;
    }
    const note = `계상률기준 · ${d.memberFilter === 'applied' ? '내 참여 과제' : '표시 과제'} ${F.money(pt.items.length)}건${pt.totalExcluded ? ` · 체크제외 ${rateTxt(pt.totalExcluded)}` : ''}${plans.length ? ` · 계획 ${F.money(plans.length)}건` : ''}${d.membershipFailed ? ` · 다시 조회 실패 ${F.money(d.membershipFailed)}건(이전 값)` : ''}`;
    return `<section class="krext-sec krext-part">${title(F.esc(note))}${head}${body}</section>`;
  }

  /* ---------- 급여·연구수당 (HR System 급여명세서 → HR 탭의 content/hr-pay.js 가 API(lib/hr-api.js)로 수집해 storage.local.hrPay 에 저장, 캐시 d.hrPay 로 전달) ----------
   * 기본연봉(월) = 가장 최근 달의 지급내역 항목, 연 기본연봉 = × 12
   * 올해 연구수당 = 올해 1월부터 각 달 지급내역의 연구수당지급 합계
   * 한도 = 연 기본연봉 × 직급 비율(P1 18% · P2 20% · P3 22% · P4 24%, 설정), 더 받을 수 있는 금액 = 한도 − 올해 지급 − 받기 예정(lib/pay.js) */
  const HR_HOME = 'https://eclass.krs.co.kr/eClassVer4/External/SSOMessage';   // HR System 열기 기본 주소 = eClass 의 SSO 중계 페이지 (hr.krs.co.kr 를 직접 열면 로그아웃 상태에서 403). 설정 hr.url 이 우선
  const RCMS_HOME = 'https://www.rcms.go.kr/index.do';   // RCMS 열기 기본 주소. 설정 rcms.url 이 우선
  const normNm = (x) => String(x || '').replace(/\s+/g, '').toLowerCase();
  /* 지급내역 항목 { 소득명: 금액 } 에서 이름으로 찾기: 공백 무시 완전 일치 → 포함 */
  function payItem(items, name) {
    if (!items) return null;
    const want = normNm(name); if (!want) return null;
    for (const [k, v] of Object.entries(items)) if (normNm(k) === want) return F.num(v);
    for (const [k, v] of Object.entries(items)) if (normNm(k).includes(want)) return F.num(v);
    return null;
  }
  /* 달 표시: "2026년 5월 급여" → "5월", 급여가 아닌 행("2026년 설 귀성비")은 연도만 뗀 내용 */
  const monthLabel = (m) => {
    const t = String((m && m.title) || '');
    const mt = /(\d{1,2})\s*월\s*급여/.exec(t); if (mt) return `${Number(mt[1])}월`;
    const mm = /^\d{4}-(\d{2})-/.exec(String((m && m.date) || ''));
    if (/급여/.test(t) && mm) return `${Number(mm[1])}월`;   // "20251224 급여 지급" 처럼 제목에 달이 없는 급여 행은 지급일자의 달
    const short = t.replace(/^\d{4}\s*년\s*/, '').trim(); if (short) return short;
    return mm ? `${Number(mm[1])}월` : t;
  };
  /* 올해 요약. 수집된 달이 없으면 months 가 빈 배열 */
  function paySummary(d, cfg, state) {
    const hr = d && d.hrPay; if (!hr) return null;
    const year = String(new Date().getFullYear());
    const y = (hr.years || {})[year] || {};
    const months = Object.values(y.months || {}).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const baseNm = cfg.baseItem || '기본연봉', resNm = cfg.researchItem || '연구수당지급';
    const latest = months.find((m) => payItem(m.items, baseNm) != null) || null;
    const base = latest ? payItem(latest.items, baseNm) : null;
    const paidMonths = months.filter((m) => { const v = payItem(m.items, resNm); return v != null && v !== 0; });
    const research = paidMonths.reduce((s, m) => s + payItem(m.items, resNm), 0);
    const list = y.list || null;
    const missing = list ? (list.rows || []).filter((r) => !(y.months || {})[r.key]) : [];
    // 올해 기준 수집 기간: 수집된 달의 지급일자 처음~끝. 급여 달(내용에 "급여")은 목록에 있는데 아직 못 읽은 달을 미수집으로,
    // 목록이 없으면 1월부터 지난달까지 중 빠진 달을 미수집으로 (이달 급여는 아직 지급 전일 수 있어 제외)
    const monthNo = (x) => { const m = /^\d{4}-(\d{2})-/.exec(String((x && x.date) || '')); return m ? Number(m[1]) : null; };
    const fmtD = (x) => { const m = /^\d{4}-(\d{2})-(\d{2})/.exec(String((x && x.date) || '')); return m ? `${Number(m[1])}월 ${Number(m[2])}일` : ''; };
    const isPay = (t) => /급여/.test(String(t || ''));
    const payMonths = months.filter((m) => isPay(m.title));
    const first = months[months.length - 1], last = months[0];   // months 는 지급일자 내림차순
    const period = months.length ? `${year}년 ${first.date === last.date ? fmtD(first) : `${fmtD(first)} ~ ${fmtD(last)}`} 지급분` : '';
    const payRows = list ? (list.rows || []).filter((r) => isPay(r.title)) : [];
    let missingNos;
    if (payRows.length) missingNos = payRows.filter((r) => !(y.months || {})[r.key]).map(monthNo).filter(Boolean);
    else { const have = new Set(payMonths.map(monthNo)); const lastNo = Math.max(new Date().getMonth(), ...have, 0); missingNos = []; for (let i = 1; i <= lastNo; i++) if (!have.has(i)) missingNos.push(i); }
    missingNos = Array.from(new Set(missingNos)).sort((a, b) => a - b);
    const grade = String(cfg.grade || hr.grade || '').toUpperCase();
    const rates = cfg.gradeRates || {};
    const rate = grade && rates[grade] != null && rates[grade] !== '' ? F.num(rates[grade]) : null;
    const annual = base != null ? base * 12 : null;
    const cap = annual != null && rate ? Math.round(annual * rate / 100) : null;
    const plans = (state && Array.isArray(state.payPlans)) ? state.payPlans : [];
    const planned = plans.reduce((s, e) => s + (F.num(e.amt) || 0), 0);
    const remain = cap != null ? cap - research : null;
    const remainAfter = remain != null ? remain - planned : null;
    return { year, hr, months, latest, base, annual, research, paidMonths, resNm, baseNm, list, missing, payMonths, period, missingNos,
      grade, gradeSource: cfg.grade ? '설정' : (hr.grade ? 'HR 직원 정보에서 자동 감지' : ''), rate, rates, cap, plans, planned, remain, remainAfter };
  }
  /* 마지막 수집 상태 (hrPay.status): 로그인이 풀렸거나 오류면 빨간 글씨 한 줄 */
  function hrStatusNote(hr, link) {
    const st = hr && hr.status; if (!st || st.ok) return '';
    if (st.loginRequired) {
      const a = `<a href="${F.esc(link)}" target="_blank" rel="noopener">HR System</a>`;
      const how = st.eclassLogin ? `eClass 로그인이 풀려 자동 로그인(SSO)을 못 했습니다. eClass 에 다시 로그인한 뒤`
        : st.tabOpened ? `HR System 탭을 열었지만 자동 로그인이 되지 않았습니다. ${a} 링크로 로그인한 뒤`   // 남은 탭은 오류 페이지일 수 있어 그 탭 대신 링크(eClass SSO)로 안내
        : `${a}에 로그인한 뒤`;
      return `<div class="krext-sub krext-err">HR System 로그인이 풀려 급여 정보를 읽지 못했습니다 — ${how} ↻ 를 누르세요${hr.ts ? ` (${F.esc(F.fmtClock(hr.ts))} 수집분 표시 중)` : ''}</div>`;
    }
    if (st.error) return `<div class="krext-sub krext-err">HR 급여 수집 오류: ${F.esc(st.error)}</div>`;
    return '';
  }
  /* 받기 예정 연구수당 (lib/pay.js, 이 브라우저에만 저장): 목록 + ＋ 입력 폼. 실제 지급되어 HR 에 잡히면 × 로 지운다 */
  function plannedBlock(ps, state) {
    if (!g.KRX_PAY || !state) return '';
    const pe = state.payEdit, dr = state.payDraft || { name: '', amt: '' };
    const form = () => `<div class="krext-pay-row krext-pay-form"><span class="krext-plan-ind">↳</span>
      <input type="text" data-pay="name" placeholder="메모 (과제·사유)" value="${F.esc(dr.name)}" maxlength="60" autocomplete="off" title="메모 (어느 과제·무슨 사유로 받을 예정인지)">
      <input type="text" inputmode="numeric" data-pay="amt" placeholder="금액" value="${F.esc(dr.amt)}" title="받기 예정 금액 (원)">
      <button type="button" class="krext-plan-btn krext-plan-save" data-act="pay-save">${pe && pe.id ? '저장' : '추가'}</button>
      <button type="button" class="krext-plan-btn" data-act="pay-cancel" title="취소 (Esc)">취소</button>
      ${state.payError ? `<span class="krext-err krext-plan-err">${F.esc(state.payError)}</span>` : ''}</div>`;
    const rows = ps.plans.map((e) => (pe && pe.id === e.id) ? form()
      : `<div class="krext-pay-row" title="${F.esc(`받기 예정 ${F.money(e.amt)}원${e.name ? ' · ' + e.name : ''} · ${F.fmtClock(e.ts)} 입력 · 실제 지급되어 급여명세서에 잡히면 × 로 지우세요`)}">
          <span class="krext-plan-ind">↳</span><span class="krext-pay-nm">${F.esc(e.name || '받기 예정')}</span><span class="krext-pay-amt">${F.money(e.amt)}</span>
          <span class="krext-plan-acts"><button type="button" data-act="pay-edit" data-id="${F.esc(e.id)}" title="수정">✎</button><button type="button" data-act="pay-del" data-id="${F.esc(e.id)}" title="삭제 (실제 지급되어 HR 급여명세서에 반영되면 지우세요)">×</button></span></div>`).join('');
    const head = `<div class="krext-pay-head"><span>받기 예정 연구수당 <span class="krext-dim">${ps.plans.length ? `${F.money(ps.plans.length)}건 · ${F.money(ps.planned)}원` : '없음'}</span></span>
      <button type="button" class="krext-plus-btn" data-act="pay-open" title="받기 예정 금액 추가 — 아직 급여에 반영되지 않았지만 받을 예정인 연구수당. 더 받을 수 있는 금액에서 빼서 보여주며, 실제 지급되면 × 로 지우세요">＋</button></div>`;
    return `<div class="krext-pay-plans">${head}${rows}${pe && !pe.id ? form() : ''}</div>`;
  }
  function paySection(d, s, state) {
    const cfg = s.hr || {};
    if (cfg.enabled === false) return '';
    const link = cfg.url || HR_HOME;
    // 급여 정보라 기본은 숨기고 버튼 하나만 둔다. 누르면 펼침 (state.payOpen — 저장하지 않으므로 화면을 새로 열면 다시 숨김)
    if (!(state && state.payOpen)) {
      return `<section class="krext-sec krext-pay"><button type="button" class="krext-pay-toggle" data-act="pay-toggle" title="HR 급여명세서 기준 연구수당 더 받을 수 있는 금액과 받기 예정 금액 보기">잔여연구수당 확인 ▸</button></section>`;
    }
    const ps = paySummary(d, cfg, state);
    const loading = !!state.payLoading;
    // 구역을 열 때 HR 을 읽어 오므로(lib/pay.js) 제목 옆에 읽는 중 표시, ↻ 는 모든 달 다시 읽기
    const btns = `<button type="button" class="krext-pay-toggle" data-act="pay-refresh" title="HR 급여명세서를 지금 다시 읽기 (모든 달)"${loading ? ' disabled' : ''}>↻</button><button type="button" class="krext-pay-toggle" data-act="pay-toggle" title="급여·연구수당 숨기기">숨기기</button>`;
    const title = (note) => `<div class="krext-sec-title">급여·연구수당 <span class="krext-note">${loading ? 'HR 급여명세서 읽는 중…' : note}</span>${btns}</div>`;
    if (!ps || !ps.months.length) {
      const hr = d.hrPay || {}, scan = hr.scan;
      const scanNote = scan && scan.note ? `<div class="krext-sub krext-err">${F.esc(scan.note)}</div>` : '';
      const msg = loading ? 'HR System 급여명세서를 읽는 중…'
        : `아직 수집된 급여 정보가 없습니다. 잔여연구수당 확인을 누르면 <a href="${F.esc(link)}" target="_blank" rel="noopener">HR System</a> 급여명세서에서 기본연봉·올해 ${F.esc(cfg.researchItem || '연구수당지급')} 합계와 직급을 읽어 옵니다 (HR 에 로그인되어 있어야 함).`;
      return `<section class="krext-sec krext-pay">${title('HR System')}<div class="krext-msg krext-dim">${msg}</div>${loading ? '' : hrStatusNote(hr, link)}${scanNote}</section>`;
    }
    // 화면에는 "더 받을 수 있는 금액"과 "받기 예정 연구수당"만. 계산 근거(월 기본연봉 × 12 × 직급 비율 − 올해 지급 − 받기 예정)는 금액 칸의 툴팁에
    const paidTip = ps.paidMonths.length ? ps.paidMonths.slice().reverse().map((m) => `${monthLabel(m)} ${F.money(payItem(m.items, ps.resNm))}`).join(' · ') : '올해 지급 없음';
    let body = '';
    if (ps.cap != null) {
      const tip = [`한도 ${F.money(ps.cap)} = 월 기본연봉 ${F.money(ps.base)} × 12 × ${ps.rate}% (직급 ${ps.grade}, ${ps.gradeSource})`,
        `− 올해 ${ps.resNm} ${F.money(ps.research)} (${paidTip})`,
        ps.planned ? `− 받기 예정 ${F.money(ps.planned)}` : '',
        ps.remainAfter < 0 ? '· 한도 초과' : ''].filter(Boolean).join(' ');
      body += stat('더 받을 수 있는 금액', ps.remainAfter, ps.remainAfter < 0 ? 'krext-red' : 'krext-blue', link, tip, true);
    } else {
      body += `<div class="krext-sub krext-dim">직급을 알 수 없어 더 받을 수 있는 금액(월 기본연봉 × 12 × 직급 비율 − 올해 지급)을 계산하지 못했습니다. HR System 탭을 열면 직원 정보에서 자동으로 읽어 오고, <a href="#" data-act="settings">설정</a>의 급여·연구수당에서 직접 고를 수도 있습니다.</div>`;
    }
    body += plannedBlock(ps, state);
    // 올해 급여 달 중 아직 읽지 못한 달이 있으면 합계가 덜 잡힌 것이라 빨간 글씨로만 알림
    if (ps.missingNos.length) body += `<div class="krext-sub krext-err">${F.esc(`${ps.year}년 ${ps.missingNos.map((n) => n + '월').join('·')} 급여 미수집 — ↻ 를 누르면 다시 읽습니다`)}</div>`;
    const scan = ps.hr.scan;
    if (scan && scan.note) body += `<div class="krext-sub krext-err">${F.esc(scan.note)}</div>`;
    if (!loading) body += hrStatusNote(ps.hr, link);
    // 제목 옆에는 수집된 기간만 (올해 지급일자 처음~끝, 급여 달 수)
    const note = `${ps.period} · 급여 ${F.money(ps.payMonths.length)}개월`;
    return `<section class="krext-sec krext-pay">${title(F.esc(note))}<div class="krext-stats">${body}</div></section>`;
  }

  /* ---------- 청구 준비 (lib/prep.js): 거래 행 밑 "↳ …" 둘째 줄(prepRow)의 "청구종류 · 청구내역(적요) · 첨부 · 청구서 작성" 조작 요소 ----------
   * 거래(지출) 정보 행과 한 줄에 섞지 않고 항상 그 밑 둘째 줄에 둔다 (eClass 삽입 패널·팝업·떠 있는 패널 공통).
   * 기본은 숨김: 거래 행을 클릭하면(data-act prep-row → lib/prep.js 가 state.prepRows 를 토글) 그 거래 밑에 나타난다 (0.8.5 — 전에는 행 클릭이 ERP 청구서를 열고 과제 줄 끝 ✎ 가 묶음 전체를 보였는데, 이제 ✎ 가 ERP 청구서를 연다: claimIcon).
   * 청구종류 = 청구서 세목 빠른 선택 항목(설정 quickPicks 표시이름). 청구내역 = 청구서 폼의 청구내역(적요, #REQ_PTCL — 화면이 필수로 요구) 글. 파일은 거래 행이나 이 줄에 끌어다 놓는다(팝업에서는 불가).
   * "청구서 작성"은 백그라운드 탭에서 R&D ERP 청구서를 열어 세목·청구종류·청구내역·첨부를 넣고 "내역 추가"(결의서에 임시저장)까지, "작성+신청"은 이어서 결의서 "신청"(결재요청)까지 누른다 (background.js prepRun).
   * 상태는 entry.run (running / saved 임시저장됨·신청 필요 / applied 신청됨 / failed). 내역 추가된 거래는 미청구 목록에서 빠져 행이 사라지므로 구역 맨 아래 "신청 대기" 목록(pendingBlock)에 남겨 "신청" 버튼을 준다 */
  let prepCtx = { on: false, picks: [], mode: '', kinds: [] };   // render() 가 현재 설정으로 채움
  const prepMeta = (c, prjNo) => ({ appr: String(c.apprNo || ''), card4: F.digits(c.cardNo || c.tail).slice(-4), prjNo: prjNo || (c.projects && c.projects[0] && c.projects[0].prjNo) || '', shop: String(c.shop || ''), amount: c.amount, usedDate: String(c.usedDate || ''), usedTime: String(c.usedTime || ''), abroad: c.abroad === '국외' });   // usedTime·abroad: 증빙 찾아오기가 사이트에서 주문을 맞출 때 (lib/prep-fetch.js)
  const prepAttrs = (key, meta) => ` data-prep-key="${F.esc(key)}" data-prep-meta="${F.esc(JSON.stringify(meta))}"`;
  const fmtSize = (n) => g.KRX_PREP ? g.KRX_PREP.fmtSize(n) : String(n);
  const prepHas = (key, state) => !!(key && (state.prep || {})[key]);
  const prepShown = (state, key) => prepCtx.on && !!(key && state && state.prepRows && state.prepRows.has(key));   // 이 거래(청구 준비 키) 밑에 청구 준비 줄을 보이는가 — 거래 행 클릭으로 토글
  /* 과제·카드 줄 끝 ✎: R&D ERP 청구서(카드) 화면을 그 과제로 연다(그 과제의 미청구 카드 사용 내역에서 청구). 한 거래를 고른 채 여는 것은 청구 준비 줄의 "ERP 청구서" 링크 */
  const claimIcon = (prjNo) => prjNo ? `<a class="krext-prj-link krext-prj-claim" href="${F.esc(claimLink(prjNo))}" target="_blank" rel="noopener" title="R&amp;D ERP 청구서(카드) 열기 — 이 과제(${F.esc(prjNo)})의 미청구 카드 사용 내역에서 청구합니다. 거래 하나를 고른 채 열려면 그 거래 행을 눌러 나온 줄의 “ERP 청구서”">${ICON_CLAIM}</a>` : '<span class="krext-prj-link krext-prj-link-off"></span>';
  const PREP_TIP = '청구 준비: 여기서 고른 청구종류·적은 청구내역과 끌어다 놓은 파일은 이 브라우저에만 저장됩니다. 거래를 클릭해 청구서를 열면 폼에 적용되고, 청구서 작성을 누르면 백그라운드에서 내역 추가(결의서 임시저장)까지, 작성+신청을 누르면 결의서 신청(결재요청)까지 합니다';
  /* 백그라운드 작성·신청 상태(entry.run) 정규화: 이전 버전(0.6.9)의 'done' 은 'saved'(내역 추가됨), 6분 넘게 running 이면 실패로 간주(백그라운드가 꺼져 상태가 안 바뀐 경우) */
  function normRun(r) {
    if (!r) return null;
    if (r.state === 'done') r = Object.assign({}, r, { state: 'saved', saved: true });
    if (r.state === 'running' && Date.now() - (r.ts || 0) > (r.meeting ? 30 : 6) * 60000) r = Object.assign({}, r, { state: 'failed', msg: '제한 시간 안에 결과가 없습니다 — 탭에서 확인하세요' });   // 회의록 팝업 대기(meeting)는 30분
    return r;
  }
  const isClaimed = (r) => !!(r && (r.saved || r.state === 'saved' || r.state === 'applied'));   // 내역 추가(임시저장)가 이미 된 거래 — 미청구 목록에서 빠짐
  /* 상태 문구와 이어지는 버튼(신청 · 탭 보기). claimed 면 이미 내역 추가된 거래라 "청구서 작성" 대신 "신청"만 */
  function runStatus(key, r) {
    if (!r) return { html: '', claimed: false };
    const k = F.esc(key);
    const tabBtn = (t) => `<button type="button" class="krext-prep-btn" data-act="prep-tab" data-key="${k}" title="${t}">탭 보기</button>`;
    const applyBtn = `<button type="button" class="krext-prep-btn krext-prep-run" data-act="prep-run" data-mode="apply" data-key="${k}" title="R&D ERP 청구서(카드)를 백그라운드 탭으로 열어 이 과제의 작성중 결의서를 신청(결재요청)합니다 — 결의서에 든 청구내역 전체가 신청됩니다">신청</button>`;
    const delBtn = `<button type="button" class="krext-prep-btn krext-prep-del" data-act="prep-run" data-mode="delete" data-key="${k}" title="R&D ERP 결의서에서 이 청구내역(임시저장)을 삭제합니다 — 결의서에 이 건만 있으면 결의서 자체가 삭제됩니다. 삭제되면 거래가 미청구 목록으로 돌아오고 청구 준비(청구종류·청구내역·파일)는 남습니다. 결의서가 이미 신청·승인된 상태면 삭제하지 않고 신청됨으로 표시합니다(삭제하려면 R&D ERP 에서 신청 취소 후)${r.reqNo ? '' : '. 청구번호가 기록되지 않은 항목은 행을 찾지 못해 탭에서 직접 삭제해야 합니다'}">임시저장 삭제</button>`;
    const when = F.esc(F.fmtClock(r.ts));
    const msg = F.esc(r.msg || '');
    const claimed = isClaimed(r);
    let html = '';
    if (r.state === 'running') html = `<span class="krext-prep-state krext-prep-running" title="${r.meeting ? '앞에 연 R&D ERP 탭에서 회의록 팝업 저장을 기다리는 중' : '백그라운드 탭에서 진행 중'} (${when} 시작)${msg ? ' — ' + msg : ''}">${r.stage === 'apply' ? '신청 중…' : r.stage === 'delete' ? '임시저장 삭제 중…' : r.meeting ? '회의록 대기 중…' : '작성 중…'}</span>${tabBtn(r.meeting ? '회의록 팝업을 기다리는 R&D ERP 탭 보기' : '진행 중인 R&D ERP 탭 보기')}`;
    else if (r.state === 'saved') html = `<span class="krext-prep-state krext-prep-saved" title="${msg}${msg ? ' — ' : ''}청구내역은 결의서에 임시저장(작성중) 상태로만 들어갔습니다. 신청(결재요청)까지 해야 결재로 넘어갑니다">임시저장됨 ${when} · <b>신청 필요</b></span>${applyBtn}${delBtn}`;
    else if (r.state === 'applied') html = `<a class="krext-prep-state krext-prep-applied" href="${myApplyBoxLink()}" target="_blank" rel="noopener" title="${msg}${msg ? ' · ' : ''}클릭: ${MY_APPLY_TITLE}">신청됨 ${when}${/이미 신청된 결의서|R&D ERP 에서 신청됨/.test(r.msg || '') ? ' <span class="krext-dim">· R&amp;D ERP 에서 이미 신청된 결의서</span>' : ''}</a>`;   // 클릭하면 MY신청함(내가 올린 신청 목록). 신청만·삭제 실행이나 새로고침 동기화가 ERP 에서 이미 신청된 것을 확인한 경우는 그 사실을 덧붙임
    else if (r.state === 'failed') html = claimed
      ? `<span class="krext-prep-state krext-err" title="${msg}">임시저장됨 · ${/삭제/.test(msg) ? '' : '신청 '}실패: ${msg}</span>${applyBtn}${delBtn}${tabBtn('남겨 둔 R&D ERP 탭에서 이어서 하기')}`
      : `<span class="krext-prep-state krext-err" title="${msg}">작성 실패: ${msg}</span>${tabBtn('남겨 둔 R&D ERP 탭에서 이어서 하기')}`;
    return { html, claimed };
  }
  /* 조작 요소 묶음: [청구종류 ▾] [청구내역(적요) 입력란] [파일 칩 …] [끌어다 놓기] 상태 [청구서 작성] [작성+신청] 지움 (이미 내역 추가된 거래면 [신청]).
   * 청구내역 입력란은 적는 중(state.prepDraft — lib/prep.js 가 input 마다 보관)이면 그 글을, 아니면 저장된 글(entry.ptcl)을 보인다 (다른 이유로 다시 그려져도 적던 글이 남게) */
  function prepControls(key, meta, state) {
    const e = (state.prep || {})[key] || null;
    const type = e ? String(e.type || '') : '';
    const draft = state.prepDraft && state.prepDraft.key === key ? state.prepDraft : null;
    const ptcl = draft ? String(draft.value || '') : (e ? String(e.ptcl || '') : '');
    const files = e ? (e.files || []) : [];
    const known = prepCtx.picks.some((p) => p.label === type);
    const pk = prepCtx.picks.find((p) => p.label === type) || null;
    const meeting = !!(g.KRX_PREP && g.KRX_PREP.isMeetingPick(pk));   // 회의록(부가증빙)이 필요한 청구종류: 작성은 탭을 앞에 열고 회의록 저장을 기다린다
    const kindTag = !pk || !meeting ? '' : `<span class="krext-prep-kind" title="${pk.kind === '식비' ? '회의록 팝업의 회의비(식비) 청구여부를 예로, 식비(A)에 청구액을, 아래 참석자 카드의 참석자를 자동으로 넣습니다. 회의시간·장소·목적·내용은 팝업에서 적습니다' : pk.kind === '다과' ? '회의록 팝업의 회의비(식비) 청구여부를 아니오로, 다과(B)에 청구액을 자동으로 넣습니다. 참석자·회의 내용은 팝업에서 적습니다' : '회의비는 부가증빙 회의록이 필요합니다 — 청구서 탭의 증빙 [신규등록]으로 등록'}">회의록${pk.kind ? ' · ' + F.esc(pk.kind) : ''}</span>`;
    const opts = [`<option value="">청구종류 선택</option>`]
      .concat(prepCtx.picks.map((p) => `<option value="${F.esc(p.label)}"${p.label === type ? ' selected' : ''}>${F.esc(p.label)}</option>`))
      .concat(type && !known ? [`<option value="${F.esc(type)}" selected>${F.esc(type)}</option>`] : []).join('');
    // 파일마다 "무슨 파일인지"(설정 attachKinds) — 고르면 저장소가 파일 이름을 "<종류>_…" 로 바꾼다(lib/prep-store.js setFileKind), 안 고르면 원래 이름
    // Claude 가 고른 종류(kindBy 'auto', lib/prep-ai.js)는 점선 테두리 + 이유를 툴팁 앞에
    // 칩에는 앞 2글자만(강의내용 → 강의, 같은 폭) — 투명한 select 를 그 위에 덮어 펼치면 전체 이름 (2026-10-22 사용자)
    const kindSel = (f) => !prepCtx.kinds.length ? '' : `<span class="krext-prep-fkind${f.kind ? ' krext-on' : ''}${f.kind && (f.kindBy === 'auto' || f.kindBy === 'fetch') ? ' krext-prep-auto' : ''}" title="${f.kind && f.kindBy === 'auto' ? `Claude 가 고른 종류${f.kindWhy ? ` — ${F.esc(f.kindWhy)}` : ''}&#10;` : f.kind && f.kindBy === 'fetch' ? `${F.esc(f.kindWhy || '찾아오기로 받은 서류')}&#10;` : ''}이 파일이 무엇인지 고르면 파일 이름 앞에 붙어(예: 거래명세서_…) 그 이름으로 R&amp;D ERP 에 첨부됩니다. 안 고르면 원래 이름 그대로 (목록은 설정의 청구서 입력 도우미)">${F.esc(f.kind ? String(f.kind).slice(0, 2) : '종류')}<select data-prep-fkind="${F.esc(key)}" data-id="${F.esc(f.id)}" aria-label="${F.esc(f.name)} 파일 종류"><option value="">종류</option>${prepCtx.kinds.concat(f.kind && !prepCtx.kinds.includes(f.kind) ? [f.kind] : []).map((k) => `<option value="${F.esc(k)}"${k === f.kind ? ' selected' : ''}>${F.esc(k)}</option>`).join('')}</select></span>`;
    // 칩: [종류 ▾] 이름(클릭 → 새 탭에서 보기, popup/file.html) [↗ 출처 — 캡처한 탭·찾아온 페이지(files[].url·title)] 크기 ×
    const chips = files.map((f) => `<span class="krext-prep-chip" title="${F.esc(`${f.name}${f.base && f.base !== f.name ? ` (원래 이름 ${f.base})` : ''} · ${fmtSize(f.size)} · ${F.fmtClock(f.ts)} 저장`)}">${kindSel(f)}<button type="button" class="krext-prep-chip-nm" data-act="prep-file-open" data-key="${F.esc(key)}" data-id="${F.esc(f.id)}" title="클릭: 이 파일을 새 탭에서 봅니다">${F.esc(f.name)}</button>${f.url ? `<a class="krext-prep-chip-src" href="${F.esc(f.url)}" target="_blank" rel="noopener" aria-label="${F.esc(f.name)} 출처 페이지" title="${F.esc(`출처: ${f.title || f.url}${f.title ? `\n${f.url}` : ''}\n이 서류를 ${f.kindBy === 'fetch' ? '찾아온' : '캡처한'} 페이지를 새 탭에서 엽니다`)}">${ICON_EXT}</a>` : ''}<span class="krext-dim">${fmtSize(f.size)}</span><button type="button" data-act="prep-file-del" data-key="${F.esc(key)}" data-id="${F.esc(f.id)}" aria-label="${F.esc(f.name)} 첨부에서 빼기" title="이 파일 빼기">×</button></span>`).join('');
    const capBusy = state.capBusy || null, capMine = !!(capBusy && capBusy.key === key);
    // 화면 캡처(사이드 패널만, popup/capture.js): 왼쪽 탭 웹페이지를 전체(스크롤해 이어 붙임) 또는 끌어서 고른 영역(여러 장 연달아)으로 찍어 첨부 파일로 저장 — 버튼은 아이콘만, 이름은 툴팁 (2026-10-22 사용자)
    const cap = !prepCtx.capture ? '' : capMine
      ? `<span class="krext-prep-state">${capBusy.mode === 'area' ? `영역 선택 중 — 왼쪽 페이지에서 끌어서 고르세요${capBusy.n ? ` · ${F.money(capBusy.n)}장 저장` : ''}` : `페이지 캡처 중${capBusy.steps ? ` ${capBusy.step}/${capBusy.steps}` : ''}…`}</span><button type="button" class="krext-prep-btn" data-act="prep-cap-stop" title="캡처 끝내기 (영역 선택은 페이지에서 Esc 도 됨)">끝내기</button>`
      : `<button type="button" class="krext-prep-cap krext-prep-cap-ico" data-act="prep-cap" data-mode="full" data-key="${F.esc(key)}"${capBusy ? ' disabled' : ''} aria-label="화면 전체 캡처" title="화면 전체 — 왼쪽 탭의 웹페이지 전체를 캡처해 첨부 파일로 저장합니다 — 위에서부터 한 화면씩 스크롤하며 찍어 한 장으로 이어 붙입니다(끝나면 원래 위치로). 처음 한 번은 사이트 접근 권한을 묻습니다">${ICON_CAMERA}</button><button type="button" class="krext-prep-cap krext-prep-cap-ico" data-act="prep-cap" data-mode="area" data-key="${F.esc(key)}"${capBusy ? ' disabled' : ''} aria-label="영역 선택 캡처" title="영역 선택 — 왼쪽 탭의 웹페이지에서 끌어서 고른 영역을 첨부 파일로 저장합니다 — 고를 때마다 한 장씩, 여러 영역을 이어서 고를 수 있습니다(Esc 또는 끝내기로 마침)">${ICON_CROP}</button>`;
    // 증빙 찾아오기(lib/prep-fetch.js → Help 서버 → site-fetch/): 가맹점이 "자주 사용" 으로 등록돼 있으면 [찾아오기], 아니면 [자주 사용 등록](확장 페이지는 이 카드에 등록 칸, eClass 패널은 설정 페이지)
    const fx = prepCtx.fetch || {};
    const fst = fx.on ? ((state.prepFetch || {})[key] || null) : null;
    const fsite = fx.on && g.KRX_SITES ? g.KRX_SITES.match(fx.sites, meta.shop) : null;
    const fRun = !!(fst && fst.state === 'running' && Date.now() - (fst.ts || 0) < 25 * 60000);
    // 필요 서류(그 가맹점이 따로 고른 서류, 아니면 종류별 필요 서류 — 설정): 첨부 파일 종류로 다 있는지 ✓/✗. 찾아오기는 없는 서류만 찾는다 (lib/prep-fetch.js)
    const need = fsite ? g.KRX_SITES.docsOf(fsite, fx.docs) : [];
    const haveKinds = new Set(files.map((f) => f.kind).filter(Boolean));
    const extra = fsite ? g.KRX_SITES.extraOf(fsite, fx.docs) : [];   // 있으면 받는 서류(강의 = 수료증 — lib/fetch-sites.js EXTRA): 없어도 ✗ 가 아니라 ○, 아직 없으면 찾아오기가 같이 찾는다 (2026-10-22 사용자 "수료증도 받아줘 … 있으면 받아줘")
    const lack = need.filter((d) => !haveKinds.has(d)), lackExtra = extra.filter((d) => !haveKinds.has(d));
    const fDocs = (lack.length || lackExtra.length ? lack.concat(lackExtra) : need.concat(extra)).join('·');
    // ✗ 서류의 툴팁에는 마지막 찾아오기가 못 찾은 이유(prepFetch[key].missing — 상태 줄은 30분 뒤 사라지지만 이유는 남김. 예: 인프런 "견적서 발급 메뉴 없음")
    const missWhy = new Map(((fst && fst.missing) || []).map((m) => [m.kind, m.reason]));
    const needHtml = !need.length && !extra.length ? '' : `<span class="krext-prep-need" title="${F.esc(fsite.label)}(${F.esc(g.KRX_SITES.kindLabel(fsite.kind))})에 필요한 서류 — 첨부 파일의 종류(파일 칩 앞 고르는 칸)로 맞춥니다. 목록은 설정 › LLM 설정 › 증빙 찾아오기의 종류별 필요 서류(가맹점마다 따로 고를 수도 있음)${lack.length ? `&#10;없는 서류: ${F.esc(lack.join('·'))} — [찾아오기]는 이것만 찾습니다` : '&#10;다 있습니다'}">${need.concat(extra).map((d) => { const ok = haveKinds.has(d), opt = extra.includes(d), why = !ok && missWhy.get(d) ? `찾아오기가 못 찾음: ${missWhy.get(d)}${fst.endTs ? ` (${F.fmtClock(fst.endTs)})` : ''}` : ''; const tip = opt && !ok ? `있으면 받는 서류 — ${why || '아직 없음'}` : why; return `<span class="krext-prep-need-doc ${ok ? 'krext-ok' : opt ? 'krext-opt' : 'krext-miss'}"${tip ? ` title="${F.esc(tip)}"` : ''}>${ok ? '✓' : opt ? '○' : '✗'} ${F.esc(d)}</span>`; }).join('')}</span>`;
    // 설정은 켜져 있는데 Help 서버가 연결돼 있지 않으면(또는 찾아오기가 없는 서버) 버튼 대신 흐린 "Help 서버 필요"(2026-10-21 — Claude API 로 LLM 이 연결돼 있어도 찾아오기는 서버 몫이라 "LLM 연결 안 됨" 이라 하면 설정 페이지와 어긋남) — 툴팁에 이유와 켜는 법 (설정 › LLM 설정)
    const llmOff = !fx.on && fx.want ? `<span class="krext-prep-llm-off" title="${F.esc(fx.llm && fx.llm.ok ? (fx.llm.fetchNote || 'Help 서버가 이전 버전이라 찾아오기를 할 수 없습니다 — 서버를 끄고 다시 node help-server/server.js') : '증빙 찾아오기·자주 사용 등록은 이 PC 의 Help 서버가 있어야 합니다(Claude API 키로는 안 됨) — node help-server/server.js 를 실행하면 켜집니다 (설정 › LLM 설정 › LLM 연결 › 연결 확인)')}">${ICON_SEARCH}${fx.llm && fx.llm.ok ? '서버에 찾아오기 없음' : 'Help 서버 필요'}</span>` : '';
    const chatOpen = !!(state.prepChat && state.prepChat.key === key && g.KRX_PREP_CHAT);   // 💬 채팅이 이 거래 밑에 열려 있음 (popup/prep-chat.js, 확장 페이지만)
    const fetchTool = !fx.on ? llmOff : fRun
      ? `<button type="button" class="krext-prep-cap" data-act="prep-fetch-stop" data-key="${F.esc(key)}" title="찾아오기 중지 — 작업용 Chrome 창은 그대로 둡니다">중지</button>`
      : fsite
      ? `<button type="button" class="krext-prep-cap krext-prep-fetch" data-act="prep-fetch" data-key="${F.esc(key)}" title="${F.esc(fsite.label)}(${F.esc(g.KRX_SITES.kindLabel(fsite.kind))})에서 이 거래(사용일·금액)의 ${F.esc(fDocs)}를 찾아 첨부 파일로 넣습니다${lack.length && lack.length < need.length ? ' (이미 있는 서류는 빼고)' : ''} — 이 PC 의 Help 서버가 작업용 Chrome 창을 화면 밖에서 열어 Claude 로 찾습니다(보통 2~5분, 하던 일을 계속해도 됨. 추가 인증·로그인이 필요하면 그때 창이 화면에 나타나니 그 창에서 직접). 등록: ${F.esc(fsite.url)}">${ICON_SEARCH}찾아오기</button><button type="button" class="krext-prep-x krext-prep-fetch-edit krext-prep-fetch-chat${chatOpen ? ' krext-on' : ''}" data-act="prep-fetch-chat" data-id="${F.esc(fsite.id)}" data-key="${F.esc(key)}" aria-label="${F.esc(fsite.label)} 사이트 안내 고치기 채팅"${g.KRX_PREP_CHAT ? ` aria-expanded="${chatOpen}"` : ''} title="${F.esc(fsite.label)} 사이트 안내 고치기 — ${g.KRX_PREP_CHAT ? '바로 아래에 찾는 방법 익히기 채팅을 열고 닫습니다' : '설정 페이지의 찾는 방법 익히기를 이 가맹점으로 엽니다'}(Help 서버의 Claude 가 fetch-site 스킬로 이 거래를 시험해 사이트 안내 · 기억한 찾는 방법을 고침). 마지막 찾아오기가 못 찾은 이유는 글에 미리 들어갑니다">${ICON_CHAT}</button><button type="button" class="krext-prep-x krext-prep-fetch-edit" data-act="prep-fetch-edit" data-id="${F.esc(fsite.id)}" data-key="${F.esc(key)}" aria-label="${F.esc(fsite.label)} 자주 사용 등록 고치기" title="${F.esc(fsite.label)} 자주 사용 등록 고치기 (설정 페이지 › LLM 설정 탭(증빙 찾아오기) — 주소·로그인 정보·가져올 서류)">${ICON_GEAR}</button>`
      : `<button type="button" class="krext-prep-cap" data-act="prep-fetch-reg" data-key="${F.esc(key)}" title="이 가맹점을 자주 사용으로 등록하면(사이트 주소·종류·로그인 정보) 다음부터 [찾아오기]로 거래명세서(강의면 수강증·강의내용)를 사이트에서 찾아 첨부합니다${fx.secure ? '' : ' — 비밀번호를 넣어야 해서 설정 페이지에서 등록합니다'}">${ICON_STAR}자주 사용 등록</button>`;
    const fAge = fst && fst.state !== 'running' ? Date.now() - (fst.endTs || fst.ts || 0) : 0;
    const fMiss = fst && (fst.missing || []).length ? ` · 없음: ${fst.missing.map((m) => m.kind).join('·')}` : '';
    const fTip = fst ? F.esc([fst.label ? `${fst.label} · ${F.fmtClock(fst.ts)} 시작` : '', fst.item ? `상품: ${fst.item}` : '', fst.matched ? `주문: ${fst.matched}` : '', ...(fst.missing || []).map((m) => `${m.kind} 없음: ${m.reason}`), fst.msg && fst.state !== 'done' ? fst.msg : '', ...(fst.lines || []).map((l) => '· ' + l)].filter(Boolean).join('\n')) : '';
    const fetchState = !fst ? '' : fRun ? `<span class="krext-prep-state krext-prep-running" title="${fTip}">찾아오는 중 · ${F.esc(fst.line || '')}</span>`
      : fAge > 30 * 60000 ? ''
      : fst.state === 'done' ? `<span class="krext-prep-state" title="${fTip}">찾아옴 ${F.money(fst.n)}개 ${F.esc(F.fmtClock(fst.endTs || fst.ts))}${F.esc(fMiss)}</span>`
      : fst.state === 'canceled' ? `<span class="krext-prep-state" title="${fTip}">찾아오기 중지됨</span>`
      : `<span class="krext-prep-state krext-err" title="${fTip}">${fst.state === 'empty' ? '찾지 못함' : '찾아오기 실패'}: ${F.esc((fst.state === 'empty' && (fst.missing || []).length ? fst.missing.map((m) => `${m.kind}(${m.reason})`).join(', ') : fst.msg) || '')}</span>`;
    const fetchForm = fx.secure && state.fetchForm && state.fetchForm.key === key ? fetchFormHtml(state.fetchForm) : '';
    const drop = !prepCtx.files
      ? `<span class="krext-prep-drop krext-prep-drop-off" title="툴바 팝업 창에는 파일을 끌어다 놓을 수 없습니다(창이 닫힘). eClass 홈 패널이나 사이드 패널(제목 줄 버튼)의 이 줄에 놓으세요">${ICON_CLIP}파일은 eClass 패널·사이드 패널에서</span>`
      : `<button type="button" class="krext-prep-drop" data-act="prep-pick" data-key="${F.esc(key)}" title="클릭하면 파일 선택 창이 열립니다. 이 줄이나 거래 행에 끌어다 놓아도 됩니다. 첨부할 파일(영수증·증빙)은 이 브라우저에 저장해 두었다가 청구서에 첨부합니다">${ICON_CLIP}<span>${files.length ? '파일 더 추가' : '파일 선택'}<span class="krext-prep-drop-hint"> 또는 끌어다 놓기</span></span></button>`;
    const busy = fetchState + (state.prepBusy && state.prepBusy.key === key ? `<span class="krext-prep-state">저장 중 ${state.prepBusy.done}/${state.prepBusy.total}…</span>` : '')
      + (state.prepAi && state.prepAi[key] ? `<span class="krext-prep-state krext-prep-running" title="이 PC 의 Help 서버를 거쳐 Claude 가 청구종류·첨부 파일 종류를 고르는 중 (설정 › LLM 설정 › 청구 준비 자동 분류에서 끔)">Claude 분류 중…</span>` : '');
    const note = state.prepNote && state.prepNote.key === key ? `<span class="krext-prep-state${state.prepNote.err ? ' krext-err' : ''}">${F.esc(state.prepNote.msg)}</span>` : '';
    const r = normRun(e && e.run);
    const rs = runStatus(key, r);   // 상태 문구 + 신청/탭 보기 버튼
    const canRun = !!(e && type) && !(r && r.state === 'running') && !(state.prepBusy && state.prepBusy.key === key);
    const dis = canRun ? '' : ' disabled';
    const minutesReady = !!(meeting && pk && pk.kind && e && e.minutes && e.minutes.content);   // 회의록 카드에 회의 내용이 있으면 팝업 없이 등록
    const addTip = !type ? '청구종류를 먼저 고르세요' : minutesReady
      ? 'R&D ERP 청구서(카드)를 백그라운드 탭으로 열어 이 거래를 고르고 세목·청구종류(17 회의비)·청구내역·첨부·RCMS 회의장소를 넣은 뒤, 회의록 카드의 참석자·회의 내용으로 회의록을 팝업 없이 등록하고(rcomm_0071_01_c001) 이어서 “내역 추가”(결의서 임시저장)까지 누릅니다. 회의록 규칙에 걸리면 사유를 보이고 멈춥니다'
      : meeting
      ? 'R&D ERP 청구서(카드) 탭을 앞에 열어 이 거래를 고르고 세목·청구종류(17 회의비)·청구내역·첨부·RCMS 회의장소를 넣은 뒤 증빙 [신규등록] 회의록 팝업을 엽니다(식비 여부·금액·참석자·적어 둔 회의 내용 자동 입력). 팝업을 저장하면 이어서 “내역 추가”(결의서 임시저장)까지 누릅니다. 30분 안에 회의록이 저장되지 않으면 실패로 표시됩니다. 회의록 카드에 회의내용까지 적어 두면 팝업 없이 등록합니다'
      : 'R&D ERP 청구서(카드)를 백그라운드 탭으로 열어 이 거래를 고르고 세목·청구종류·청구내역·첨부를 넣은 뒤 “내역 추가”까지 누릅니다 — 결의서에 임시저장만 되고 신청은 하지 않으므로, 끝나면 신청 대기 목록의 “신청” 버튼으로 이어서 하세요. 실패하면 그 탭을 남겨 둡니다';
    const applyTip = !type ? '청구종류를 먼저 고르세요' : (meeting ? '회의록 팝업을 저장하면 “내역 추가”에 이어 ' : '“청구서 작성”(내역 추가)에 이어 ') + '결의서 “신청”(결재요청)까지 누릅니다. 결재선은 화면의 기본결재선 팝업이 기본으로 고르는 항목(부서·본인·과제담당자 그룹·과제책임자)이며, 결의서에 이미 들어 있던 청구내역도 함께 신청됩니다';
    const runBtns = !rs.claimed ? `<button type="button" class="krext-prep-btn krext-prep-run" data-act="prep-run" data-mode="add" data-key="${F.esc(key)}"${dis} title="${addTip}">${r && r.state === 'failed' ? '다시 작성' : minutesReady ? '청구서 작성 (회의록 포함)' : meeting ? '청구서 작성 → 회의록' : '청구서 작성'}</button><button type="button" class="krext-prep-btn krext-prep-submit" data-act="prep-run" data-mode="add,apply" data-key="${F.esc(key)}"${dis} title="${applyTip}">작성+신청</button>` : '';
    const attached = e && e.attached && !(r && r.state) ? `<span class="krext-prep-state" title="R&D ERP 청구서의 첨부 목록에 올린 시각">첨부함 ${F.esc(F.fmtClock(e.attached.ts))}</span>` : '';
    const clear = e ? `<button type="button" class="krext-prep-x" data-act="prep-clear" data-key="${F.esc(key)}" title="이 거래의 청구 준비(청구종류·청구내역·파일·작성 상태)만 지웁니다. ERP에 저장한 청구서는 그대로 남습니다">준비 지우기</button>` : '';
    // Claude 가 쓴 청구내역(ptclBy 'auto', lib/prep-ai.js — 첨부 파일 내용 + 과제 연구개발계획서): 점선 테두리 + "AI" 표시. 고치면 그 글을 쓰고 그 뒤로는 Claude 가 바꾸지 않는다
    const aiPtcl = !!(e && e.ptcl && e.ptclBy === 'auto' && !draft);
    const aiPtclWhy = aiPtcl && e.ptclAuto && e.ptclAuto.why ? ` — ${F.esc(e.ptclAuto.why)}` : '';
    const ptclBox = `<input type="text" class="krext-prep-ptcl${ptcl ? ' krext-on' : ''}${aiPtcl ? ' krext-prep-auto' : ''}" data-prep-ptcl="${F.esc(key)}" value="${F.esc(ptcl)}" maxlength="500" placeholder="청구내역(적요)" spellcheck="false" autocomplete="off" title="${aiPtcl ? `Claude 가 씀${aiPtclWhy}&#10;고치면 그 글을 쓰고, 지우면 Claude 가 다시 씁니다&#10;` : ''}청구내역(적요) — R&amp;D ERP 청구서 폼의 청구내역 칸에 이 글을 넣습니다 (화면이 필수로 요구하는 값. 칸을 벗어나거나 Enter 면 저장, Esc 는 되돌림). 비워 두면 Claude 가 첨부 파일과 과제 연구내용을 보고 한 줄을 쓰고(LLM 이 연결돼 있을 때 — 설정 › LLM 설정), Claude 가 없으면 화면의 기본값(카드 메모)을 그대로 둡니다">`;
    // [AI] 단추(늘 보임): 클릭하면 지금 첨부 파일(찾아온 서류 포함)·과제 연구개발계획서로 Claude 가 청구내역을 다시 쓴다(prepAuto force — 직접 적은 글도 덮음). Claude 가 쓴 글이면 점선(krext-on)
    const aiPtclTag = `<button type="button" class="krext-prep-ai${aiPtcl ? ' krext-on' : ''}" data-act="prep-ptcl-ai" data-key="${F.esc(key)}" title="${aiPtcl ? `Claude 가 쓴 청구내역${aiPtclWhy}&#10;첨부 파일 내용과 과제 연구개발계획서(연구내용)를 참고합니다. 청구종류를 바꾸거나 서류가 새로 들어오면 다시 쓰고, 고치면 그 뒤로는 바꾸지 않습니다&#10;` : ''}클릭: 지금 첨부 파일(찾아온 서류 포함)과 과제 연구내용으로 Claude 가 청구내역을 ${aiPtcl ? '다시 ' : ''}씁니다 — 서류를 찾아온 뒤 누르면 그 내용으로 갱신(직접 적은 글도 바뀜, LLM 연결 필요)">AI</button>`;
    // Claude 가 고른 청구종류(typeBy 'auto', lib/prep-ai.js): select 점선 테두리 + "AI" 표시(툴팁에 이유). 직접 고르면 사라지고 그 뒤로는 Claude 가 바꾸지 않는다
    const aiType = !!(e && type && e.typeBy === 'auto');
    const aiWhy = aiType && e.typeAuto && e.typeAuto.why ? ` — ${F.esc(e.typeAuto.why)}` : '';
    const aiTag = aiType ? `<span class="krext-prep-ai" title="Claude 가 고른 청구종류${aiWhy}&#10;다른 것을 고르면 그 값을 쓰고, 그 뒤로는 바꾸지 않습니다. 청구내역을 고치면 다시 고릅니다">AI</span>` : '';
    const hint = !type ? '청구종류를 선택하면 작성할 수 있습니다.' : '작성은 임시저장 · 신청은 결재 요청';
    return `<div class="krext-prep-fields">
        <label class="krext-prep-field krext-prep-field-type"><span class="krext-prep-label">청구종류 ${aiTag}${kindTag}</span><select class="krext-prep-type${type ? ' krext-on' : ''}${aiType ? ' krext-prep-auto' : ''}" data-prep-type="${F.esc(key)}" title="${aiType ? `Claude 가 고름${aiWhy}&#10;` : ''}청구종류 — R&D ERP 청구서의 세목 빠른 선택 항목 (설정의 청구서 입력 도우미에서 변경). 식사비·다과비는 회의비 세목에 회의록 종류(식비/다과)를 더한 것">${opts}</select></label>
        <label class="krext-prep-field krext-prep-field-ptcl"><span class="krext-prep-label">청구내역 <span class="krext-prep-label-note">(적요)</span> ${aiPtclTag}</span>${ptclBox}</label>
      </div>
      <div class="krext-prep-attachments"><div class="krext-prep-label">증빙 첨부 <span class="krext-prep-file-count">${F.money(files.length)}개</span>${needHtml}</div>
        ${chips ? `<div class="krext-prep-files">${chips}</div>` : ''}<div class="krext-prep-attach-tools">${drop}${cap ? `<div class="krext-prep-capture">${cap}</div>` : ''}${fetchTool ? `<div class="krext-prep-capture">${fetchTool}</div>` : ''}</div>
      </div>${fetchForm}${chatOpen ? prepChatHtml(key, state) : ''}
      ${busy || note || attached || rs.html ? `<div class="krext-prep-feedback" role="status" aria-live="polite">${busy}${note}${attached}${rs.html}</div>` : ''}
      <div class="krext-prep-footer"><span class="krext-prep-help">${rs.claimed ? '준비 내용은 이 브라우저에 저장됩니다.' : hint}</span><div class="krext-prep-actions">${clear}${runBtns}</div></div>`;
  }
  /* 💬 찾는 방법 익히기 채팅 (popup/prep-chat.js — 사이드 패널·팝업만, 2026-10-22 사용자 "채팅 버튼 누르면 바로 아래 채팅창을 열어줘"): 첨부 구역 바로 아래.
   * state.prepChat = { key, siteId, draft(적는 글), log(로그 펼침) } · state.fetchChat = 마지막 요청(설정 페이지의 찾는 방법 익히기와 같은 storage.local.fetchChat) · state.fetchChatLog = { lines, detail, note }.
   * 로그는 column-reverse 상자라 다시 그려져도 맨 아래(새 줄)가 보인다 */
  function prepChatHtml(key, state) {
    const pc = state.prepChat, cur = state.fetchChat || null, lg = state.fetchChatLog || {}, k = F.esc(key);
    const site = (state.fetchSites || []).find((s) => s.id === pc.siteId) || null;
    const running = !!(cur && cur.state === 'running'), has = !!(cur && cur.id);
    const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
    const hms = (t) => { const d = new Date(t); return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':'); };
    const reload = (files) => (files || []).some((f) => !/^(help-server|tests|site-fetch|site-fetch-out|\.claude)\//.test(f) && !/\.md$/i.test(f));   // 확장이 읽는 파일이 바뀜 (options/fetch-chat.js needsReload 와 같음)
    const other = has && cur.siteId !== pc.siteId ? ` (${F.esc(cur.siteLabel || '다른 가맹점')})` : '';   // 설정 페이지 등에서 다른 가맹점으로 보낸 요청
    let text = '', cls = '';
    if (lg.note) { text = F.esc(lg.note.text); cls = lg.note.err ? ' krext-err' : ''; }
    else if (running) { const last = (lg.lines || []).filter((l) => l.k !== 'warn').pop(); text = `⏳ ${mmss(Date.now() - (cur.at || Date.now()))}${other} · ${F.esc((last && last.s) || '요청을 보냈습니다')}`; cls = ' krext-prep-running'; }
    else if (has && cur.state === 'done') { const n = (cur.files || []).length, bad = (cur.checks || [])[0]; text = `✔ 완료${other} — ${F.esc(cur.summary || '')}${n ? ` · 수정 ${n}개` : ''}${cur.howto ? ' · 기억한 찾는 방법 저장함' : ''}${bad ? ` · ⚠ 문법 오류 ${F.esc(bad.file)}` : reload(cur.files) ? ' · 확장 파일이 바뀜 — 확장을 다시 올려야 반영' : ''}`; cls = bad ? ' krext-err' : ' krext-ok'; }
    else if (has) { text = `${cur.state === 'canceled' ? '■ 중지됨' : '✖ 실패'}${other} — ${F.esc(cur.error || '')}`; cls = ' krext-err'; }
    const logOpen = has && pc.log !== false;
    const logHtml = !logOpen ? '' : `<div class="krext-prep-chat-log"><div>${cur.text ? `<div class="krext-prep-chat-me">${F.esc(cur.text)}</div>` : ''}`
      + (lg.lines || []).map((l) => `<div class="krext-prep-chat-line krext-k-${F.esc(l.k)}"><span class="krext-dim">${hms(l.t)}</span> ${F.esc(l.s)}</div>`).join('')
      + (!running && lg.detail && lg.detail.includes('\n') ? `<div class="krext-prep-chat-answer">${F.esc(lg.detail)}</div>` : '')
      + (!running && (cur.files || []).length ? `<div class="krext-prep-chat-line">바뀐 파일: ${F.esc(cur.files.join(', '))} — 커밋은 하지 않았습니다</div>` : '') + '</div></div>';
    const row = !text ? '' : `<div class="krext-prep-chat-row"><button type="button" class="krext-prep-chat-status${cls}" data-act="prep-chat-log" data-key="${k}" title="${has ? `요청: ${F.esc(cur.text || '')}&#10;` : ''}누르면 로그 펼치기/접기">${text}</button>`
      + (running && !lg.note ? `<button type="button" class="krext-prep-x" data-act="prep-chat-stop" data-key="${k}" title="Help 서버의 이 요청을 멈춥니다">중지</button>` : '')
      + (has && !running ? `<button type="button" class="krext-prep-x" data-act="prep-chat-new" data-key="${k}" title="이 결과를 지우고, 다음 요청을 이전 대화와 잇지 않습니다 (설정 페이지의 찾는 방법 익히기와 같은 대화)">새 대화</button>` : '') + '</div>';
    return `<div class="krext-prep-chat" data-prep-chat="${k}">
      <div class="krext-prep-chat-head"><span class="krext-prep-label">찾는 방법 익히기${site ? ` · ${F.esc(site.label || site.match || '')}` : ''} <span class="krext-prep-label-note">이 거래로 사이트를 시험해 안내·기억한 찾는 방법을 고칩니다 (Help 서버의 Claude, 보통 몇 분)</span></span><button type="button" class="krext-prep-x krext-prep-chat-close" data-act="prep-chat-close" data-key="${k}" aria-label="채팅 닫기" title="채팅 닫기 — 보낸 요청은 계속됩니다">×</button></div>
      ${logHtml}${row}
      <div class="krext-prep-chat-form"><input type="text" class="krext-prep-chat-in" data-prep-chat-in="${k}" value="${F.esc(pc.draft || '')}" maxlength="2000" autocomplete="off" spellcheck="false" aria-label="찾는 방법 익히기 요청"${running ? ' disabled' : ''} placeholder="${running ? '처리 중… (패널을 닫아도 계속됩니다)' : '예) 견적서는 구매 내역 상세 화면을 캡처해 줘 — 비우면 이 거래로 안내를 다시 만듦'}" title="Enter 로 보내기. 가맹점 등록 값과 이 거래(사용일·금액)가 같이 갑니다 — 아이디·비밀번호는 보내지 않음"><button type="button" class="krext-prep-btn krext-prep-run" data-act="prep-chat-send" data-key="${k}"${running ? ' disabled' : ''}>보내기</button></div>
    </div>`;
  }
  /* 자주 사용 등록 칸 (증빙 찾아오기, 사이드 패널·팝업만 — eClass 패널은 eClass 페이지 DOM 이라 비밀번호 칸을 두지 않고 설정 페이지로 연다).
   * 입력값은 state.fetchForm.f (lib/prep.js 가 input 마다 보관 — 다시 그려져도 남게). 저장은 백그라운드 fetchSiteSave(비밀번호는 storage.local.fetchCred) */
  function fetchFormHtml(ff) {
    const S = g.KRX_SITES, v = ff.f || {}, k = F.esc(ff.key);
    const inp = (name, ph, type) => `<input type="${type || 'text'}" class="krext-fetch-inp" data-fetch-f="${name}" value="${F.esc(v[name] || '')}" placeholder="${F.esc(ph || '')}" spellcheck="false" autocomplete="${type === 'password' ? 'new-password' : 'off'}">`;
    const docs = Array.from(new Set(S.DOC_CHOICES.concat(prepCtx.kinds, v.docs || [])));
    const chk = docs.map((d) => `<label class="krext-fetch-doc"><input type="checkbox" data-fetch-doc="${F.esc(d)}"${(v.docs || []).includes(d) ? ' checked' : ''}>${F.esc(d)}</label>`).join('');
    const kinds = S.KINDS.map(([id, nm]) => `<option value="${id}"${v.kind === id ? ' selected' : ''}>${nm}</option>`).join('');
    return `<div class="krext-fetch-form" data-fetch-form="${k}">
      <div class="krext-prep-label">자주 사용 등록 <span class="krext-prep-label-note">— 카드 가맹점 이름에 아래 글자가 든 거래는 이 사이트에서 서류를 찾아옵니다</span></div>
      <div class="krext-fetch-grid">
        <label class="krext-fetch-field"><span>이름</span>${inp('label', '예) 인프런')}</label>
        <label class="krext-fetch-field"><span>가맹점 글자</span>${inp('match', '예) 인프랩 (쉼표로 여럿)')}</label>
        <label class="krext-fetch-field krext-fetch-wide"><span>사이트 주소 <span class="krext-prep-label-note">(구매내역·청구 화면이면 빠름)</span></span>${inp('url', 'https://…', 'url')}</label>
        <label class="krext-fetch-field"><span>종류</span><select class="krext-fetch-inp" data-fetch-f="kind">${kinds}</select></label>
        <div class="krext-fetch-field krext-fetch-wide"><span>필요 서류 <span class="krext-prep-label-note">(${ff.docsTouched ? '이 가맹점만 따로 고름' : `종류 기본 — 설정 › LLM 설정 › 증빙 찾아오기의 종류별 필요 서류. 고르면 이 가맹점만 따로`})</span></span><div class="krext-fetch-docs">${chk}</div></div>
        <label class="krext-fetch-field"><span>아이디</span>${inp('id', '로그인 아이디(이메일)')}</label>
        <label class="krext-fetch-field"><span>비밀번호</span>${inp('pw', '비밀번호', 'password')}</label>
        <label class="krext-fetch-field krext-fetch-wide"><span>로그인해 둔 Chrome <span class="krext-prep-label-note">(선택 — 바탕화면 Chrome 바로가기 이름·디버그 포트. 작업용 창 대신 그 Chrome 에 붙어 찾음)</span></span>${inp('browser', '예) SUB 전용 · 9444')}</label>
        <label class="krext-fetch-field krext-fetch-wide"><span>찾는 곳 메모 <span class="krext-prep-label-note">(선택)</span></span>${inp('hint', `예) ${(S.knownOf(v) || {}).hint || '마이페이지 › 구매내역 › 거래명세서'}`)}</label>
      </div>
      <div class="krext-prep-footer"><span class="krext-prep-help">아이디·비밀번호는 이 브라우저(확장 저장소, 암호화 없음)에만 저장되고 찾아올 때 이 PC 의 Help 서버로만 갑니다 — Claude 에는 보이지 않고 브라우저 손잡이가 로그인 칸에 넣습니다. 고치기·지우기는 설정 › LLM 설정 › 증빙 찾아오기.${ff.err ? ` <b class="krext-err">${F.esc(ff.err)}</b>` : ''}</span>
        <div class="krext-prep-actions"><button type="button" class="krext-prep-x" data-act="prep-fetch-formclose" data-key="${k}">취소</button><button type="button" class="krext-prep-btn krext-prep-submit" data-act="prep-fetch-save" data-key="${k}"${ff.saving ? ' disabled' : ''}>등록</button><button type="button" class="krext-prep-btn krext-prep-run" data-act="prep-fetch-save" data-go="1" data-key="${k}"${ff.saving ? ' disabled' : ''}>등록하고 찾아오기</button></div></div>
    </div>`;
  }
  /* 참석자 카드: 종류가 '식비'인 청구종류(식사비)를 고른 거래 행 밑 셋째 줄. 참여인력(과제 참여인력 목록 체크) · 내부참석자(성명 검색 → 인적정보) · 외부참석자(성명·소속 직접 입력).
   * 저장은 lib/prep.js(prepSetAttendees → entry.attendees). 회의록 팝업(content/rnd-meeting.js)이 그대로 넣는다. 목록·규칙은 state.prepMeet[prjNo] (없으면 data-att-need 로 prep.js 가 불러옴).
   * 규칙 안내: 외부참석자 필수(CFRC_OUT_ATTNTS_MARK_YN), 1인당 한도(참여인력+내부+외부 × 한도 ≥ 식비+다과), 회의사전신청 사용+필수(식비는 승인된 사전신청 [불러오기] 필요) */
  function attRow(key, meta, state, colspan) {
    const e = (state.prep || {})[key] || {};
    const att = e.attendees || {}; const part = att.part || [], inner = att.inner || [], outer = att.outer || [];
    const mk = g.KRX_PREP.meetKey(meta.prjNo, meta.usedDate);
    const mi = (state.prepMeet || {})[mk] || null;
    const pk = e.type ? prepCtx.picks.find((p) => p.label === e.type) : null;
    const mealY = !!(pk && pk.kind === '식비');
    const m = e.minutes || {};
    const md = state.prepMinDraft && state.prepMinDraft.key === key ? state.prepMinDraft.fields : {};
    const mv = (f) => F.esc(md[f] != null ? md[f] : (m[f] == null ? '' : m[f]));
    const draft = state.prepAttDraft && state.prepAttDraft.key === key ? state.prepAttDraft : {};
    const search = state.prepSearch && state.prepSearch.key === key ? state.prepSearch : null;
    const k = F.esc(key);
    const sel = new Set(part.map((x) => x.empNo));
    let partHtml;
    if (!mi) partHtml = `<span class="krext-dim" data-att-need="${F.esc(mk)}">참여인력 불러오는 중…</span>`;
    else if (mi.loading) partHtml = `<span class="krext-dim">참여인력 불러오는 중…</span>`;
    else if (mi.err) partHtml = `<span class="krext-err">${F.esc(mi.err)}</span>`;
    else if (!(mi.members || []).length) partHtml = `<span class="krext-dim">과제 참여인력이 없습니다</span>`;
    else partHtml = mi.members.map((m) => `<label class="krext-att-chk${sel.has(m.empNo) ? ' krext-on' : ''}" title="${F.esc(`${m.empNo} · ${m.dept}${m.role ? ' · ' + m.role : ''}${m.from ? ' · 참여기간 ' + F.fmtDate(m.from) + '~' + F.fmtDate(m.to) : ''}`)}"><input type="checkbox" data-att-part="${k}" value="${F.esc(m.empNo)}"${sel.has(m.empNo) ? ' checked' : ''}>${F.esc(m.name)}</label>`).join('');
    const reload = `<button type="button" class="krext-prep-x" data-act="prep-att-reload" data-prj="${F.esc(meta.prjNo || '')}" data-date="${F.esc(meta.usedDate || '')}" title="참여인력·사전신청 목록 다시 불러오기">↻</button>`;
    const chip = (text, tip, group, i) => `<span class="krext-att-chip" title="${F.esc(tip)}">${F.esc(text)}<button type="button" data-act="prep-att-del" data-key="${k}" data-group="${group}" data-idx="${i}" title="빼기">×</button></span>`;
    const innerChips = inner.map((x, i) => chip(x.name, `${x.empNo} · ${x.dept}`, 'inner', i)).join('');
    const outerChips = outer.map((x, i) => chip(`${x.name} (${x.dept})`, `${x.name} · ${x.dept}`, 'outer', i)).join('');
    let results = '';
    if (search) {
      if (search.loading) results = `<span class="krext-dim">검색 중…</span>`;
      else if (search.err) results = `<span class="krext-err">${F.esc(search.err)}</span>`;
      else if (!(search.list || []).length) results = `<span class="krext-dim">"${F.esc(search.q)}" 검색 결과 없음</span>`;
      else results = `<span class="krext-att-res">${search.list.map((p) => `<button type="button" data-act="prep-att-add-inner" data-key="${k}" data-emp="${F.esc(p.empNo)}" data-name="${F.esc(p.name)}" data-dept="${F.esc(p.dept)}" title="${F.esc(`${p.empNo} · ${p.dept}${p.pos ? ' · ' + p.pos : ''}`)}">${F.esc(p.name)} <span class="krext-dim">${F.esc(p.dept)}</span></button>`).join('')}<button type="button" class="krext-prep-x" data-act="prep-att-close" data-key="${k}" title="검색 결과 닫기">닫기</button></span>`;
    }
    const total = part.length + inner.length + outer.length;
    const amt = Math.abs(Number(meta.amount) || 0);
    /* 회의 내용 칸 (사전신청을 고르면 일자·시간·장소·목적·내용은 사전신청에서 오므로 숨김) */
    const inp = (field, ph, cls, extra) => `<input type="text" class="krext-att-inp${cls ? ' ' + cls : ''}" data-min="${k}" data-field="${field}" value="${mv(field)}" placeholder="${F.esc(ph)}" spellcheck="false" autocomplete="off"${extra || ''}>`;
    const pre = md.preApplReqCnt != null ? md.preApplReqCnt : (m.preApplReqCnt || '');
    const preApps = (mi && mi.preApps) || [];
    const preSel = mealY && mi && mi.rules && mi.rules.preApplRequired
      ? `<div class="krext-att-grp"><span class="krext-att-lbl">사전신청</span><select class="krext-prep-type" data-min="${k}" data-field="preApplReqCnt" title="회의사전신청 사용+필수 과제: 식비 청구는 회의일자(카드 사용일) 전에 승인된 회의사전신청을 연결해야 저장됩니다. 고르면 회의일자·시간·장소·목적·내용·외부참석자는 사전신청 내용으로 등록됩니다"><option value="">${preApps.length ? '사전신청 선택' : '올해 사전신청 없음 — 식비 불가, 다과비로'}</option>${preApps.map((x) => `<option value="${F.esc(x.reqCnt)}"${x.reqCnt === pre ? ' selected' : ''}>${F.esc(`${F.fmtDate(x.cfrcDt)} ${x.st}~${x.end} ${x.purpose || x.place} · ${F.money(x.cost)}원 · 참석 ${x.partCnt + x.inCnt + x.outCnt}명${x.docNo ? ' · ' + x.docNo : ''}`)}</option>`).join('')}</select>${pre ? inp('preApplModReason', '사전신청 수정 사유 (참석자 수가 다를 때 필수)', 'krext-att-inp-w') : ''}</div>`
      : '';
    const dayNm = ['일', '월', '화', '수', '목', '금', '토'][(() => { const d8 = String(meta.usedDate || '').replace(/\D/g, ''); return d8.length === 8 ? new Date(Number(d8.slice(0, 4)), Number(d8.slice(4, 6)) - 1, Number(d8.slice(6, 8))).getDay() : 0; })()];
    const timeRow = pre ? '' : `<div class="krext-att-grp"><span class="krext-att-lbl">회의</span><span class="krext-dim" title="회의일자는 카드 사용일로 고정됩니다${mi && mi.holiday ? ' — 휴일이라 휴일 집행사유가 필수' : ''}">${F.esc(F.fmtDate(meta.usedDate))}(${dayNm})${mi && mi.holiday ? ' <b>휴일</b>' : ''}</span>${inp('stDtm', '시작 10:00', 'krext-att-inp-s')}~${inp('endDtm', '종료 11:00', 'krext-att-inp-s')}<span class="krext-att-lbl krext-att-lbl-s">장소</span>${inp('place', '실제 회의 장소 (집행 장소 아님)', 'krext-att-inp-w')}<span class="krext-att-lbl krext-att-lbl-s">진행자</span>${inp('mcUser', '(선택)', 'krext-att-inp-s')}</div>
      <div class="krext-att-grp"><span class="krext-att-lbl">목적</span>${inp('purpose', '회의목적', 'krext-att-inp-w')}<span class="krext-att-lbl krext-att-lbl-s">경비내역</span>${inp('costPtcl', '(선택)', 'krext-att-inp-w')}</div>
      <div class="krext-att-grp krext-att-grp-top"><span class="krext-att-lbl">내용</span><textarea class="krext-att-ta" data-min="${k}" data-field="content" rows="2" placeholder="회의내용 (${(mi && mi.rules && mi.rules.contentMin) || 20}자 이상)" spellcheck="false">${mv('content')}</textarea><span class="krext-dim" data-min-cnt="${k}">${String(md.content != null ? md.content : (m.content || '')).length}자</span></div>`;
    const rmkRow = `<div class="krext-att-grp"><span class="krext-att-lbl">${mi && mi.holiday ? '휴일사유*' : '비고'}</span>${inp('rmk', mi && mi.holiday ? '휴일 집행사유 (필수)' : '비고/휴일/심야사용사유 (선택)', 'krext-att-inp-w')}
      <span class="krext-att-lbl krext-att-lbl-s">금액</span>${mealY
        ? `<span title="식비(A) = 청구액 (회의비 식비 예)">식비(A) <b>${F.money(amt)}</b>원</span>`
        : `<span title="회의비 식비 아니오: 청구액을 다과(B)와 기타경비(C, 회의장 임차료·속기료 등 — 1인당 한도 제외)로 나눕니다. 합계가 청구액과 같아야 합니다">다과(B)</span>${inp('snack', F.money(amt), 'krext-att-inp-s krext-num', ` title="비우면 청구액 전체"`)}<span>기타(C)</span>${inp('etc', '0', 'krext-att-inp-s krext-num')}<span class="krext-dim">= ${F.money(amt)}원</span>`}</div>`;
    const chk = g.KRX_PREP.minutesCheck(e, pk, mi, amt);
    const hints = [];
    if (mi && mi.rules) {
      const r = mi.rules;
      if (r.limitYn && r.limitAmt > 0) { const need = Math.ceil((chk.meal + chk.snack) / r.limitAmt); hints.push(`1인당 한도 ${F.money(r.limitAmt)}원 → ${mealY ? '식비' : '다과'} ${F.money(chk.meal + chk.snack)}원이면 ${F.money(need)}명 이상 (지금 ${F.money(total)}명${total >= need ? ' ✓' : ''})`); }
      if (r.outRequired === 'Y' && outer.length) hints.push('외부참석자 필수 과제 ✓');
    } else if (mi && mi.rulesError) hints.push(`과제 규칙을 읽지 못함: ${mi.rulesError}`);
    const status = !mi || mi.loading ? '' : chk.ready
      ? `<span class="krext-att-ok" title="청구서 작성을 누르면 백그라운드 탭에서 회의록을 팝업 없이 등록하고(rcomm_0071_01_c001) 이어서 내역 추가합니다">회의록 준비됨 ✓</span>`
      : `<span class="krext-att-miss" title="회의록 팝업의 저장 규칙 기준. 빠진 채로 청구서 작성을 누르면 탭을 앞에 열어 팝업에서 마저 적게 합니다">빠짐: ${F.esc(chk.missing.join(' · '))}</span>`;
    const summary = `<span class="krext-att-ttl" title="회의록 — 여기 적은 참석자·회의 내용으로 청구서 작성 때 회의록을 등록합니다 (팝업 없이). 회의록 팝업을 직접 열어도 같은 내용이 미리 들어갑니다">회의록 · ${mealY ? '식비' : '다과'} · 참석자 ${F.money(total)}명</span>`;
    return `<tr class="krext-prep krext-att"${prepAttrs(key, meta)}><td colspan="${colspan}"><div class="krext-att-in">
      <div class="krext-att-grp"><span class="krext-plan-ind">↳</span>${summary}${status}</div>
      <div class="krext-att-grp"><span class="krext-att-lbl">참여인력</span>${partHtml}${reload}</div>
      <div class="krext-att-grp"><span class="krext-att-lbl">내부참석자</span>${innerChips}<input type="text" class="krext-att-inp" data-att-q="${k}" value="${F.esc(draft.q || '')}" placeholder="성명 검색 (Enter)" spellcheck="false" autocomplete="off" title="회사 사람(참여인력 아님): 성명으로 인적정보를 검색해 고릅니다"><button type="button" class="krext-prep-btn" data-act="prep-att-search" data-key="${k}">검색</button>${results}</div>
      <div class="krext-att-grp"><span class="krext-att-lbl">외부참석자</span>${outerChips}<input type="text" class="krext-att-inp" data-att-out-nm="${k}" value="${F.esc(draft.nm || '')}" placeholder="성명" spellcheck="false" autocomplete="off"><input type="text" class="krext-att-inp krext-att-inp-w" data-att-out-dept="${k}" value="${F.esc(draft.dept || '')}" placeholder="소속 (Enter)" spellcheck="false" autocomplete="off"><button type="button" class="krext-prep-btn" data-act="prep-att-add-outer" data-key="${k}">추가</button></div>
      ${preSel}${timeRow}${rmkRow}
      ${hints.length ? `<div class="krext-att-hint">${hints.map((h) => `<span>${F.esc(h)}</span>`).join('')}</div>` : ''}</div></td></tr>`;
  }
  /* 식사비·다과비(회의록 종류) 거래면 회의록 카드 줄 */
  function attRowIf(key, meta, state, colspan) {
    const e = (state.prep || {})[key];
    const pk = e && e.type ? prepCtx.picks.find((p) => p.label === e.type) : null;
    return g.KRX_PREP && g.KRX_PREP.wantsMinutes(pk) ? attRow(key, meta, state, colspan) : '';
  }
  /* 신청 대기 목록(카드미청구 구역 맨 아래): 내역 추가(임시저장)가 끝난 거래는 미청구 목록에서 빠져 행이 사라지므로, 신청이 끝나기 전까지(신청됨은 하루 동안) 여기 남겨 상태와 "신청"·"임시저장 삭제" 버튼을 준다.
   * "감추기"는 패널 항목만 지우고(ERP 임시저장은 그대로), "임시저장 삭제"는 ERP 결의서의 그 청구내역을 지워 거래를 미청구 목록으로 되돌린다. 지금 목록에 있는 거래(행에 상태가 보이는 것)는 뺀다. n 은 아직 신청되지 않은 건수 */
  function pendingBlock(d, state) {
    if (!prepCtx.on || !state.prep || !d) return { html: '', n: 0 };
    const cur = new Set();
    for (const p of d.projects || []) for (const c of p.cards || []) cur.add(F.prepKey(c.apprNo, c.cardNo || c.tail));
    for (const card of (d.cards || []).concat(d.unattributed || [])) for (const t of card.txs || []) cur.add(F.prepKey(t.apprNo, t.cardNo || t.tail));
    const list = Object.values(state.prep).map((e) => e ? { e, r: normRun(e.run) } : null).filter((x) => x && x.r && isClaimed(x.r) && !cur.has(x.e.key)).sort((a, b) => (b.r.ts || 0) - (a.r.ts || 0));
    if (!list.length) return { html: '', n: 0 };
    const prjs = new Map((d.projects || []).map((p) => [p.prjNo, p]));
    const rows = list.map(({ e, r }) => {
      const p = prjs.get(e.prjNo);
      const prj = p ? `${p.rspr || ''} ${p.prjNm || ''}`.trim() : (e.prjNo || '-');
      const shop = String(e.shop || '');
      const note = state.prepNote && state.prepNote.key === e.key ? `<span class="krext-prep-state${state.prepNote.err ? ' krext-err' : ''}">${F.esc(state.prepNote.msg)}</span>` : '';
      return `<div class="krext-pend-row">
        <span class="krext-pend-prj" title="${F.esc(e.prjNo || '')}">${F.esc(prj)}</span>
        <span class="krext-pend-shop" title="${F.esc(shop)}">${F.esc(shop)}</span>
        <span class="krext-dim">${F.esc(F.fmtDate(e.usedDate))}</span>
        <span class="krext-pend-amt">${F.money(e.amount)}</span>
        ${e.type ? `<span class="krext-dim">${F.esc(e.type)}</span>` : ''}${r.reqNo ? `<span class="krext-dim krext-mono" title="청구번호">${F.esc(r.reqNo)}</span>` : ''}
        ${note}${runStatus(e.key, r).html}<button type="button" class="krext-prep-x" data-act="prep-clear" data-key="${F.esc(e.key)}" title="이 목록에서만 감춥니다 — R&D ERP 의 임시저장(결의서)은 그대로 남습니다. 임시저장을 지우려면 “임시저장 삭제”">감추기</button></div>`;
    }).join('');
    const need = list.filter(({ r }) => r.state !== 'applied').length;   // 임시저장만 되어 아직 신청하지 않은 건
    const done = list.length - need;                                       // 신청되어 결재 진행 중인 건 (하루 동안 남음)
    /* 머리글: "신청 필요 N건"(임시저장만 된 건 → 미신청내역조회)과 "신청됨 M건"(→ MY신청함)을 따로 센다 — "신청 대기" 한 숫자로는 아직 신청 안 한 건인지 신청하고 결재를 기다리는 건인지 헷갈린다는 지적(2026-09-25) */
    const head = `<a href="${notAppliedLink()}" target="_blank" rel="noopener" title="내역 추가(임시저장)만 된 청구는 결의서를 신청해야 결재로 넘어갑니다. 신청은 결의서에 든 청구내역 전체를 보냅니다 · 클릭: ${NOT_APPLIED_TITLE}">청구서 작성됨 · 신청 필요 <span class="krext-badge${need ? ' krext-badge-soft' : ''}">${F.money(need)}건</span></a>`
      + (done ? `<span class="krext-dim">·</span><a href="${myApplyBoxLink()}" target="_blank" rel="noopener" title="신청(결재요청)되어 결재 진행 중인 건 — 하루 동안 이 목록에 남습니다 · 클릭: ${MY_APPLY_TITLE}">신청됨 <span class="krext-badge">${F.money(done)}건</span></a>` : '');
    return { n: need, html: `<div class="krext-pend"><div class="krext-pend-head">${head}</div>${rows}</div>` };
  }
  /* 거래 행 밑 "↳ …" 둘째 줄 (모든 배치 공통) */
  function prepRow(key, meta, state, colspan, href) {
    const erp = href ? `<a class="krext-prep-erp" href="${F.esc(href)}" target="_blank" rel="noopener" title="R&amp;D ERP 청구서(카드)에서 이 거래를 고른 채 열기 — 여기서 고른 청구종류·청구내역·첨부가 폼에 적용됩니다">${ICON_EXT}ERP 청구서</a>` : '';
    return `<tr class="krext-prep${prepHas(key, state) ? ' krext-prep-set' : ''}"${prepAttrs(key, meta)}><td colspan="${colspan}"><div class="krext-prep-in">
      <div class="krext-prep-head"><span class="krext-prep-title" title="${PREP_TIP}">${ICON_CLAIM}청구 준비</span>${erp}</div>${prepControls(key, meta, state)}</div></td></tr>`;
  }

  /* 거래 한 줄. withPrj=true 면 연결 과제(책임자) 열 추가 (카드별 보기).
   * 행 클릭 → 그 밑 청구 준비 ↳ 줄(prepRow) 열기/닫기 (state.prepRows, lib/prep.js prep-row). 청구 준비를 쓰지 않거나(청구서 입력 도우미 꺼짐) 취소/취소된 거래면 예전처럼 행 클릭 → 청구서(카드).
   * 청구 준비 키가 있는 행은 닫혀 있어도 파일을 끌어다 놓을 수 있다(놓으면 줄이 열림). 가맹점 이름은 넘치면 … (전체는 툴팁) */
  function txRow(c, withPrj, prjNo, state) {
    const target = prjNo || (c.projects && c.projects[0] && c.projects[0].prjNo) || '';
    const href = target ? claimLink(target, c.apprNo, c.cardNo, c.usedDate) : '';
    const pkey = prepCtx.on && state && !c.cancel && !c.cancelled ? F.prepKey(c.apprNo, c.cardNo || c.tail) : '';
    const showPrep = prepShown(state, pkey);
    const pmeta = pkey ? prepMeta(c, target) : null;
    const nm = cardName(c.cardNo || c.tail);   // 별명이 있으면 뒤 8자리 대신 표시 (뒷자리는 툴팁)
    const neg = c.amount < 0;
    const shared = c.shared ? ` <span class="krext-tag" title="같은 계좌를 쓰는 여러 과제에 귀속된 거래: ${F.esc((c.linked || []).join(', '))}">공용</span>` : '';
    const linked = (c.projects || []).map((x) => x.rspr || x.prjNo);
    let flag = '';
    if (c.cancel) flag = ` <span class="krext-tag krext-tag-grey" title="승인취소(마이너스) 건">취소</span>`;
    else if (c.cancelled) flag = ` <span class="krext-tag krext-tag-grey" title="같은 일시·금액의 취소 건이 있어 상쇄된 거래">취소됨</span>`;
    else if (c.dupSuspect) flag = ` <span class="krext-tag krext-tag-warn" title="같은 카드·가맹점·금액이 10분 안에 반복됨. 승인번호가 다르면 별개 승인(예: 인원별 결제)이거나 이중 승인일 수 있으니 카드매출전표로 확인">중복의심</span>`;
    const cls = ['krext-tx-row', neg ? 'krext-neg' : '', c.cancelled ? 'krext-cancelled' : '', href || pkey ? 'krext-clickable' : '', pkey && (state.prep || {})[pkey] ? 'krext-prep-has' : '', showPrep ? 'krext-prep-open' : ''].filter(Boolean).join(' ');
    const act = pkey
      ? ` data-act="prep-row" data-key="${F.esc(pkey)}" title="클릭: 청구 준비 ${showPrep ? '닫기' : '열기 — 청구종류 · 청구내역(적요) · 첨부 · 청구서 작성'} (파일을 이 행에 끌어다 놓아도 저장됩니다)"`
      : href ? ` data-act="claim" data-href="${F.esc(href)}" title="클릭: R&amp;D ERP 청구서(카드)에서 이 건 열기"` : '';
    const row = `<tr class="${cls}"${act}${pkey ? prepAttrs(pkey, pmeta) : ''}>
      <td class="krext-card${nm ? '' : ' krext-mono'}" title="${nm ? F.esc(c.tail) + ' · ' : ''}${F.esc(c.cardDiv)} ${F.esc(c.user)}"><span class="krext-tx-card-value">${F.esc(nm || c.tail)}</span>${withPrj ? '' : shared}</td>
      <td class="krext-mono krext-tx-date"><span>${F.esc(F.fmtDate(c.usedDate))}</span> <span>${F.esc(F.fmtTime(c.usedTime))}</span></td>
      <td class="krext-shop" title="${F.esc(c.shop)}"><span class="krext-shop-nm">${F.esc(c.shop)}</span>${flag}</td>
      <td class="krext-mono krext-dim krext-tx-appr" data-label="승인">${F.esc(c.apprNo)}</td>
      <td class="krext-num" title="${neg ? '승인취소(마이너스) 건' : ''}">${F.money(c.amount)}</td>
      ${withPrj ? `<td class="krext-linked" data-label="연결 과제" title="${F.esc(linked.join(', '))}">${F.esc(linked.join(', '))}${linked.length > 1 ? ' <span class="krext-tag">공용</span>' : ''}</td>` : ''}</tr>`;
    return row + (showPrep ? prepRow(pkey, pmeta, state, withPrj ? 6 : 5, href) + attRowIf(pkey, pmeta, state, withPrj ? 6 : 5) : '');
  }
  /* 과제(또는 카드 묶음)의 거래 중 청구 준비가 있는 수 */
  const prepCount = (txs, state) => prepCtx.on && state && state.prep ? (txs || []).filter((c) => !c.cancel && !c.cancelled && state.prep[F.prepKey(c.apprNo, c.cardNo || c.tail)]).length : 0;
  const prepTag = (n) => n ? ` <span class="krext-prj-prep" title="청구 준비(청구종류·첨부 파일)가 있는 거래 ${F.money(n)}건">준비 ${F.money(n)}</span>` : '';

  /* 카드 한 장 행 (카드별 보기 / 과제별 보기의 공용 카드 묶음 공용) */
  function cardRow(card, state) {
    const key = 'card:' + card.digits;
    const open = state.expanded.has(key);
    const nm = cardName(card.digits || card.tail);   // 별명이 있으면 별명을 앞에, 뒤 8자리는 옆에
    const prjs = card.projects.map((x) => `${x.rspr || ''}${x.prjNm ? '(' + x.prjNm.slice(0, 12) + (x.prjNm.length > 12 ? '…' : '') + ')' : ''}`).join(', ');
    const body = open ? `<div class="krext-prj-body"><div class="krext-tx-wrap"><table class="krext-cards krext-tx-table"><thead><tr><th>카드</th><th>사용일시</th><th>가맹점</th><th>승인번호</th><th class="krext-num">사용액</th><th>연결 과제</th></tr></thead><tbody>${card.txs.map((t) => txRow(t, true, '', state)).join('')}</tbody></table></div></div>` : '';
    return `<div class="krext-prj${open ? ' krext-open' : ''}"><div class="krext-prj-line">
      <a href="#" class="krext-prj-row" data-act="prj" data-prj="${F.esc(key)}" title="${F.esc(card.cardDiv)} · 연결 과제: ${F.esc(card.projects.map((x) => `${x.rspr || ''} ${x.prjNm || x.prjNo}`).join(' / '))}">
        <span class="krext-caret">${open ? '▾' : '▸'}</span>
        <span class="krext-prj-rspr${nm ? ' krext-card-nm' : ' krext-mono'}">${F.esc(nm || card.tail)}</span>
        <span class="krext-prj-nm">${nm ? `<span class="krext-mono">${F.esc(card.tail)}</span> · ` : ''}${F.esc(card.user)}${card.user ? ' · ' : ''}<span class="krext-dim">연결 과제: ${F.esc(prjs)}${card.projects.length > 1 ? ' <span class="krext-tag">공용</span>' : ''}</span></span>
        <span class="krext-prj-cnt krext-hot">${F.money(card.count)}건${prepTag(prepCount(card.txs, state))}</span>
        <span class="krext-prj-amt">${F.money(card.amount)}</span>
      </a>${claimIcon((card.projects[0] || {}).prjNo)}</div>${body}</div>`;
  }

  function cardView(d, state) {
    if (!d.cards || !d.cards.length) return `<div class="krext-msg krext-dim">미청구 카드 거래가 없습니다.</div>${sharedBlock(d, state)}`;
    return `<div class="krext-prj-list">${listHead('카드 · 사용자 · 연결 과제', '미청구 · 금액 (원)', 1)}${d.cards.map((card) => cardRow(card, state)).join('')}</div>${sharedBlock(d, state)}`;
  }

  /* 어느 과제에도 귀속되지 않은(계좌 불일치) 카드의 거래 묶음. 설정에서 표시를 켠 경우에만 */
  function sharedBlock(d, state) {
    const s = d.settings || {};
    if (!s.showShared) return '';   // 표시 꺼짐: 안내 문구 없이 생략 (미귀속 건수는 설정 페이지에서 확인)
    const list = d.unattributed || [];
    if (!list.length) return '';
    const cnt = list.reduce((x, c) => x + c.count, 0);
    const amt = list.reduce((x, c) => x + c.amount, 0);
    return `<div class="krext-shared">
      <div class="krext-sub"><span class="krext-tag">미귀속</span> 과제 계좌와 다른 카드 ${F.money(list.length)}장 · ${F.money(cnt)}건 · ${F.money(amt)}원
        <span class="krext-dim">— 연결된 과제에는 보이지만 계좌번호가 그 과제 계좌와 달라 어느 과제에도 넣지 않은 거래입니다. 설정에서 과제별로 포함시킬 수 있습니다.</span></div>
      <div class="krext-prj-list">${list.map((card) => cardRow(card, state)).join('')}</div>
    </div>`;
  }

  /* 구역: 카드미청구 · 과제집행비율 · 연구내용(0.8.5). 저장된 값(storage.local.panelSection)·버튼 값이 셋 밖이면 카드미청구 (eclass.js · popup.js 가 씀) */
  const SECTIONS = ['cards', 'budget', 'research'];   // 사업비 관리는 구역이 아니라 제목 줄 아이콘으로 여는 화면(state.page, lib/staff-ui.js — 2026-10-18 사용자 지정 "사업비 관리는 사업비 변경 부분에서 … 여기 메뉴는 필요 없어")
  const secOf = (v) => (SECTIONS.includes(v) ? v : 'cards');
  const staffPage = (state) => !!(g.KRX_STAFF_UI && state.page === g.KRX_STAFF_UI.PAGE);   // 제목 줄 "사업비 관리" 아이콘으로 연 화면 (lib/staff-ui.js bind openPage)
  const ICON_COINS = '<b class="krext-btn-m">M</b>';   // 사업비 관리 아이콘 — 그냥 굵은 글자 M(2026-10-19 사용자 "M아이콘 말고 그냥 M 넣어줘" — 그 전엔 동전 더미 SVG)
  /* 구역 전환 스위치: 카드미청구 ↔ 과제집행비율 ↔ 연구내용 (책임자/과제 목록은 공통, 펼친 내용만 달라짐) */
  function sectionSwitch(d, state) {
    const sec = secOf(state.section);
    return `<span class="krext-switch">
      <a href="#" data-act="section" data-section="cards" class="${sec === 'cards' ? 'krext-on' : ''}" title="과제별 카드 미청구 내역">카드미청구 <span class="krext-badge${d.totalCount ? ' krext-badge-hot' : ''}" title="고유 거래 기준">${F.money(d.totalCount)}건</span></a>
      <a href="#" data-act="section" data-section="budget" class="${sec === 'budget' ? 'krext-on' : ''}" title="과제정보 › 자금현황의 비목별 잔액 기준 (미청구 카드 사용액 + 승인 전 신청금액 포함)">과제집행비율</a>
      <a href="#" data-act="section" data-section="research" class="${sec === 'research' ? 'krext-on' : ''}" title="과제별 연구개발계획서 — 개발목표·개발내용·성능목표·수행일정·연구활동비 세부사용계획 (설정의 연구개발계획서에서 KR_&lt;과제&gt;.yaml 을 넣거나 공유 (Plus) 로 동료에게서 받음)">연구내용</a>
    </span>`;
  }

  /* ---------- 연구내용 보기 (0.8.5, lib/research.js — state.research): 설정 페이지에 넣은(또는 공유 (Plus) 로 동료에게서 받은) 연구개발계획서를 과제별로.
   * 과제 줄: 책임자 · 과제명 · 차년도·판 · 연구활동비 계획 합계. 누르면(data-act=prj, state.expanded 'rs:과제번호') 그 계획서(researchBody). ERP 연차와 같은 차년도가 없으면 앞선 차년도 것(`ERP n연차` 표시).
   * 계획서가 없는 과제는 흐리게 — 펼치면 넣는 곳을 짚어 준다. 패널 과제에 잇지 못한 계획서 수는 목록 아래 한 줄 ---------- */
  function researchSection(d, s, state) {
    const RS = g.KRX_RESEARCH, map = (RS && state.research) || {}, esc = F.esc;
    const recs = Object.values(map).filter(Boolean);
    const shown = new Set(d.projects.map((p) => p.prjNo));
    const loose = recs.filter((r) => !r.prjNo || !shown.has(r.prjNo)).length;
    const withPlan = RS ? d.projects.filter((p) => RS.forProject(map, p.prjNo, p.anl)).length : 0;
    const rsy = state.researchSync;   // 공유 (Plus) 의 마지막 결과 (storage.local.researchSyncState = shareState — lib/research.js bind)
    const syncNote = !rsy || !rsy.at ? '' : rsy.ok ? ` · 공유 ${F.fmtClock(rsy.at)} · 파일 ${F.money(Object.keys(rsy.pages || {}).length)}건` : ` · <span class="krext-err">공유 ${F.fmtClock(rsy.at)} 실패 — ${esc(rsy.error || rsy.kind || '')}</span>`;
    const head = `<div class="krext-sec-title">${sectionSwitch(d, state)}<span class="krext-note">${recs.length ? `계획서 ${F.money(recs.length)}개 · 과제 ${F.money(withPlan)}/${F.money(d.projects.length)}` : ''}${syncNote}</span></div>`;
    const where = '<a href="#" data-act="settings">설정</a>의 <b>연구개발계획서</b>에 KR_&lt;과제&gt;.yaml 을 넣으세요 (공유 (Plus) 를 켜 두면 같은 과제 동료의 기록도 공유 폴더에서 옵니다).';
    if (!d.projects.length) return `<section class="krext-sec">${head}<div class="krext-msg krext-dim">${whyEmpty(d, s, false)}</div></section>`;
    const list = d.projects.map((p) => {
      const rec = RS ? RS.forProject(map, p.prjNo, p.anl) : null;
      const key = 'rs:' + p.prjNo, open = state.expanded.has(key);
      const anl = Number(p.anl) || 0;
      const off = rec && anl && rec.n !== anl ? ` <span class="krext-tag" title="R&amp;D ERP 는 ${anl}연차 — 그 차년도 계획서가 없어 ${rec.n}차년도 것을 보입니다">ERP ${anl}연차</span>` : '';
      const others = rec ? RS.countFor(map, p.prjNo) - 1 : 0;
      const tip = rec ? `연구개발계획서 ${rec.n}차년도${rec.rev ? ` ${rec.rev}` : ''}${rec.file ? ` · ${rec.file}` : ''}${rec.src ? ' · 공유 파일에서 받음' : ''} · ${F.fmtClock(rec.at)} 넣음${others > 0 ? ` · 다른 차년도 ${others}개` : ''}${rec.goals.length ? ` · 목표 ${rec.goals.length}` : ''}${rec.spend.length ? ` · 연구활동비 계획 ${rec.spend.length}건` : ''}` : `${p.prjNo} — 연구개발계획서가 없습니다`;
      const body = !open ? '' : rec ? researchBody(rec) : `<div class="krext-sub krext-dim">이 과제의 연구개발계획서가 없습니다. ${where}</div>`;
      return `<div class="krext-prj${open ? ' krext-open' : ''}${rec ? '' : ' krext-zero'}">
        <div class="krext-prj-line">
          <a href="#" class="krext-prj-row" data-act="prj" data-prj="${esc(key)}" title="${esc(tip)}">
            <span class="krext-caret">${open ? '▾' : '▸'}</span>
            <span class="krext-prj-rspr">${esc(p.rspr || '-')}</span>
            <span class="krext-prj-nm">${esc(p.prjNm)}</span>
            <span class="krext-prj-cnt">${rec ? `${rec.n}차년도${rec.rev ? ` ${esc(rec.rev)}` : ''}${off}` : '<span class="krext-dim">없음</span>'}</span>
            <span class="krext-prj-amt">${rec && rec.spend.length ? F.money(RS.spendTotal(rec)) : '-'}</span>
          </a>
        </div>
        ${body ? `<div class="krext-prj-body">${body}</div>` : ''}
      </div>`;
    }).join('');
    const foot = !recs.length ? `<div class="krext-sub krext-dim">아직 넣은 연구개발계획서가 없습니다. ${where}</div>`
      : loose ? `<div class="krext-sub krext-dim">패널 과제에 잇지 못한 계획서 ${F.money(loose)}개 — <a href="#" data-act="settings">설정</a>의 연구개발계획서 표에서 R&amp;D ERP 과제를 고르세요.</div>` : '';
    return `<section class="krext-sec">${head}<div class="krext-prj-list">${listHead('책임자 · 과제', '차년도 · 연구활동비 계획 (원)', 0)}${list}</div>${foot}</section>`;
  }

  /* 과제가 하나도 없을 때 이유 */
  function whyEmpty(d, s, hiddenZero) {
    if (d.projectCount === 0) return '조회된 진행과제가 없습니다.';
    if (d.memberFilter === 'no-id') return `본인 사번/이름을 아직 확인하지 못해 과제를 표시하지 않습니다. <a href="${F.esc(s.rndUrl || RND_OPEN)}" target="_blank" rel="noopener">R&amp;D ERP</a>를 한 번 열거나 설정에 학번/사번(또는 이름)을 입력한 뒤 새로고침하세요.`;
    if (d.memberFilter === 'ambiguous') {
      const cands = (d.nameCandidates || []).map((c) => `${F.esc(c.empNm)} (사번 ${F.esc(c.empNo || '?')}${c.roles && c.roles.length ? ', ' + F.esc(c.roles.join('/')) : ''}, 과제 ${F.money(c.projects.length)}건)`).join(' · ');
      return `이름 "${F.esc((d.myNames || []).join(', '))}"의 참여인력이 ${F.money((d.nameCandidates || []).length)}명이라 과제를 표시하지 않습니다. <a href="#" data-act="settings">설정</a>에서 본인 사번을 고르세요. — ${cands}`;
    }
    if (d.excludedCount >= d.projectCount) return '모든 과제가 설정에서 제외되어 있습니다.';
    if (d.memberFilter === 'applied' && d.notMemberCount + (d.endedCount || 0) >= d.projectCount - d.excludedCount) return '참여인력에 본인이 포함된 과제가 없습니다. 설정에서 사번을 확인하세요.';
    return hiddenZero ? '미청구 내역이 있는 과제가 없습니다 (설정: 0건 과제 숨김).' : '표시할 과제가 없습니다.';
  }

  function cardsSection(d, s, state) {
    const picked = (s.selectedCards || []).map((x) => F.cardTail(x, 8)).concat(s.cardFilterList || []);
    const filterOn = s.cardFilterMode === 'specific' && picked.length;
    const fnote = filterOn ? `모니터링 카드: ${F.esc(picked.join(', '))}` : '전체 카드';
    let exnote = d.excludedCount ? ` · 제외 과제 ${F.money(d.excludedCount)}` : '';
    if (d.memberFilter === 'applied') {   // 미참여(본인 행 없음) · 참여 종료(본인 행은 있으나 참여기간이 끝남) 제외 수
      const ex = [d.notMemberCount ? `미참여 ${F.money(d.notMemberCount)}` : '', d.endedCount ? `참여 종료 ${F.money(d.endedCount)}` : ''].filter(Boolean).join(' · ');
      exnote += ` · 내 참여 과제만${ex ? ` (${ex} 제외)` : ''}`;
    }
    else if (d.memberFilter === 'no-id') exnote += ' · 본인 확인 전';
    else if (d.memberFilter === 'ambiguous') exnote += ' · 동명이인 확인 필요';
    if (d.truncatedCount) exnote += ` · 최대 ${F.money((d.projects || []).length)}개만 표시 (${F.money(d.truncatedCount)}개 더 있음 — 설정의 조회 과제 최대 수)`;
    let dup = (d.sumCount != null && d.sumCount !== d.totalCount) ? ` · 과제 합산 ${F.money(d.sumCount)}건 (같은 계좌를 쓰는 과제 간 중복 포함)` : '';
    if (d.cancelPairs) dup += ` · 취소쌍 ${F.money(d.cancelPairs)}건 포함`;
    if (d.dupSuspects) dup += ` · 중복의심 ${F.money(d.dupSuspects)}쌍`;
    const prepN = prepCtx.on && state.prep ? Object.values(state.prep).filter((e) => e && !e.missingSince && !isClaimed(normRun(e.run))).length : 0;   // 청구 준비(청구종류·첨부) 항목 수 (내역 추가된 것·미청구 목록에서 사라진 것 제외)
    if (prepN) dup += ` · 청구 준비 ${F.money(prepN)}건`;
    const pend = pendingBlock(d, state);   // 내역 추가(임시저장)만 되어 신청이 남은 거래
    if (pend.n) dup += ` · 신청 필요 ${F.money(pend.n)}건`;
    const view = state.view === 'card' ? 'card' : 'project';
    const toggle = `<span class="krext-toggle"><a href="#" data-act="view" data-view="project" class="${view === 'project' ? 'krext-on' : ''}">과제별</a><a href="#" data-act="view" data-view="card" class="${view === 'card' ? 'krext-on' : ''}">카드별</a></span>`;
    const head = `<div class="krext-sec-title">${sectionSwitch(d, state)}
      <span class="krext-note">${F.money(d.totalAmount)}원 · ${fnote}${exnote}${dup}</span>${toggle}</div>`;
    if (view === 'card' && d.projects.length) return `<section class="krext-sec">${head}${cardView(d, state)}${pend.html}</section>`;
    // 0건 과제 숨김은 카드미청구 보기에서만 적용 (과제집행비율 보기는 전체 과제)
    const projects = s.hideZeroProjects ? d.projects.filter((p) => p.count > 0 || p.error) : d.projects;
    if (!projects.length) {
      return `<section class="krext-sec">${head}<div class="krext-msg krext-dim">${whyEmpty(d, s, d.projects.length > 0)}</div>${pend.html}</section>`;
    }
    const list = projects.map((p) => {
      const open = state.expanded.has(p.prjNo);
      const period = (p.stDt || p.endDt) ? `${F.fmtDate(p.stDt)} ~ ${F.fmtDate(p.endDt)}` : '';
      const acct = (p.expenseAccts || []).map((a) => `${a.bank} ${a.acctNo}`).join(', ');
      return `<div class="krext-prj${open ? ' krext-open' : ''}${p.count ? '' : ' krext-zero'}">
        <div class="krext-prj-line">
          <a href="#" class="krext-prj-row" data-act="prj" data-prj="${F.esc(p.prjNo)}" title="${F.esc(p.prjNo)} ${F.esc(period)}${p.chrg ? ' / 담당 ' + F.esc(p.chrg) : ''}${acct ? ' / 과제 계좌 ' + F.esc(acct) : ''}">
            <span class="krext-caret">${open ? '▾' : '▸'}</span>
            <span class="krext-prj-rspr">${F.esc(p.rspr || '-')}</span>
            <span class="krext-prj-nm">${F.esc(p.prjNm)}</span>
            <span class="krext-prj-cnt${p.count ? ' krext-hot' : ''}">${F.money(p.count)}건${prepTag(prepCount(p.cards, state))}</span>
            <span class="krext-prj-amt">${F.money(p.amount)}</span>
          </a>
          <a class="krext-prj-link" href="${F.esc(projectLink(p.prjNo, '01'))}" target="_blank" rel="noopener" title="R&amp;D ERP 과제정보 열기 (${F.esc(p.prjNo)})">${ICON_EXT}</a>
          <a class="krext-prj-link" href="${F.esc(projectLink(p.prjNo, '05'))}" target="_blank" rel="noopener" title="R&amp;D ERP 과제정보 › 카드 탭 열기">${ICON_CARD}</a>${claimIcon(p.prjNo)}
        </div>
        ${open ? `<div class="krext-prj-body">${cardsTable(p, state)}</div>` : ''}
      </div>`;
    }).join('');
    return `<section class="krext-sec">${head}<div class="krext-prj-list">${listHead('책임자 · 과제', '미청구 · 금액 (원)', 3)}${list}</div>${sharedBlock(d, state)}${pend.html}</section>`;
  }

  /* ---------- 과제집행비율 보기 (과제정보 › 자금현황 › 비목별 잔액 + 이 과제 카드 미청구액 + 승인 전 신청금액) ---------- */
  const pct = (v) => (v == null || Number.isNaN(v)) ? '-' : `${(Math.trunc((Number(v) || 0) * 10) / 10).toFixed(1)}%`;
  /* 집행비율 셀: 막대 + 숫자. 100% 이상이면 막대·숫자 빨강 */
  function rateCell(rate, title) {
    if (rate == null || Number.isNaN(rate)) return `<span class="krext-rate krext-dim">-</span>`;
    const r = Number(rate) || 0;
    const cls = r >= 100 ? ' krext-bar-over' : '';   // 90% 주의색(주황) 없이 파랑, 100% 초과만 빨강
    return `<span class="krext-rate" title="${F.esc(title || '')}"><span class="krext-bar"><span class="krext-bar-fill${cls}" style="width:${Math.max(0, Math.min(100, r))}%"></span></span><span class="krext-rate-v${r >= 100 ? ' krext-red' : ''}">${pct(r)}</span></span>`;
  }

  /* 집행비율 계산 (rnd-api execRate 와 동일: 둘 다 양수일 때만, 소수 2자리 절사) */
  const rateOf = (v, bgt) => (bgt > 0 && v > 0) ? Math.trunc(v / bgt * 10000) / 100 : 0;

  /* ----- 예상 비용 (lib/plan.js 의 storage.local.plannedExpenses): 비목 행의 ＋ 버튼으로 세목·수량·단가를 적어 두면 잔액·집행비율에 반영한 예상값을 함께 표시.
   * 표에서는 기본으로 감춰져 있고(＋·항목 줄·예상 반영 행이 빠지고 과제 행의 예상 잔액만 남음) 머리글 "비목" 옆 눈 아이콘을 누른 동안만 보인다(state.planShown, 저장 안 함).
   * 항목은 바꿀 때마다 자동 저장되며 저장 아이콘은 지금 저장 + "저장됨" 표시 ----- */
  const svgIcon = (d) => `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICON_EYE = svgIcon('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>');
  const ICON_EYE_OFF = svgIcon('<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>');
  const ICON_REPEAT = svgIcon('<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>');
  const ICON_SAVE = svgIcon('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>');
  const ICON_EXPORT = svgIcon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>');   // 공유 (Plus): 공유 폴더 주소 복사 (비목 머리글, 저장 아이콘 옆)
  const ICON_CAL = svgIcon('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>');   // 참여 계획 기간 버튼 (participationSection)
  // 헤더 버튼(새로고침 · 설정 · 접기/펼치기), 과제 행 링크(과제정보 ↗ · 카드 탭 · 자금현황 탭), 푸터 링크 아이콘 (render, cardsSection, budgetSection)
  const ICON_REFRESH = svgIcon('<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>');
  const ICON_SLIDERS = svgIcon('<line x1="21" y1="4" x2="14" y2="4"/><line x1="10" y1="4" x2="3" y2="4"/><line x1="21" y1="12" x2="12" y2="12"/><line x1="8" y1="12" x2="3" y2="12"/><line x1="21" y1="20" x2="16" y2="20"/><line x1="12" y1="20" x2="3" y2="20"/><line x1="14" y1="2" x2="14" y2="6"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="16" y1="18" x2="16" y2="22"/>');
  const ICON_UP = svgIcon('<polyline points="18 15 12 9 6 15"/>');
  const ICON_DOWN = svgIcon('<polyline points="6 9 12 15 18 9"/>');
  const ICON_SIDEBAR = svgIcon('<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/>');
  const ICON_SPLIT = (x) => svgIcon(`<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M${x} 3v18"/><rect x="${x}" y="4" width="${20 - x}" height="16" fill="currentColor" fill-opacity=".4" stroke="none"/>`);   // 본문:도우미 폭 비율 단추(2:1 · 1:1 · 1:2 — 오른쪽 도우미 칸을 채움, 2026-10-21)   // 사이드 패널로 열기 (팝업 창 제목 줄)
  const ICON_EXT = svgIcon('<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>');
  const ICON_CARD = svgIcon('<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>');
  const ICON_CHART = svgIcon('<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>');
  const ICON_CLAIM = svgIcon('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>');   // 과제·카드 줄 끝 "R&D ERP 청구서(카드) 열기" 링크 (claimIcon, 0.8.5 전에는 "청구 준비 보기" 버튼). 원래 주석: "청구 준비 보기" 버튼 (prepToggle)
  const ICON_CAMERA = svgIcon('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>');   // 화면 전체 캡처 (청구 준비 줄, 사이드 패널)
  const ICON_SEARCH = svgIcon('<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>');   // 증빙 찾아오기 (청구 준비 줄)
  const ICON_STAR = svgIcon('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>');   // 자주 사용 등록
  const ICON_GEAR = svgIcon('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>');   // 자주 사용 등록 고치기
  const ICON_CHAT = svgIcon('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>');   // 사이트 안내 고치기 채팅 (찾아오기 줄, ⚙ 왼쪽 — 설정 페이지의 찾는 방법 익히기를 그 가맹점으로 염, 2026-10-21)
  const ICON_CROP = svgIcon('<path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"/><path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"/>');   // 영역 선택 캡처
  const ICON_CLIP = svgIcon('<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>');   // 청구 준비 파일 칩·드롭 구역 (prepRow)
  /* 과제(카드) 목록 머리글: 왼쪽 이름 열, 오른쪽 값 열 이름, 행 끝 아이콘 칸(.krext-prj-link 32px + 왼쪽 선 1px)만큼 빈 자리 (icons: 아이콘 칸 수) */
  const listHead = (left, right, icons) => `<div class="krext-prj-head"><span class="krext-prj-head-l">${left}</span><span class="krext-prj-head-r">${right}</span>${icons ? `<span class="krext-prj-head-sp" style="width:${icons * 33}px"></span>` : ''}</div>`;
  const planBtn = (prjNo, key) => `<button type="button" class="krext-plus-btn" data-act="plan-open" data-prj="${F.esc(prjNo)}" data-key="${F.esc(key)}" title="예상 비용 추가 (세목 · 수량 · 단가)">＋</button>`;
  /* 예상 비용 한 줄: 세목 · [−] 수량 [＋] × 단가 · −금액 · 예산 대비 비율. bgt 가 없으면(표에 없는 비목) 비율 생략.
   * 월간 구독(e.sub)은 수량이 "올해 남은 결제 횟수"로 자동 계산되므로 −/＋ 대신 "월간 N일" 표시 (툴팁에 남은 결제일 목록) */
  function planRow(prjNo, key, e, bgt) {
    const P = g.KRX_PLAN;
    const sub = P.isSub(e), qty = P.qtyOf(e), amt = P.amtOf(e), unit = F.num(e.unit);
    const ref = `data-prj="${F.esc(prjNo)}" data-key="${F.esc(key)}" data-id="${F.esc(e.id)}"`;
    const acts = `<span class="krext-plan-acts"><button type="button" data-act="plan-edit" ${ref} title="수정">✎</button><button type="button" data-act="plan-del" ${ref} title="삭제">×</button></span>`;
    let tip, qtyBox;
    if (sub) {
      const r = P.subRemaining(e.sub.date);
      const list = r.dates.map((d) => `${F.pad2(d.getMonth() + 1)}-${F.pad2(d.getDate())}`).join(', ');
      tip = `월간 구독: ${e.name} · 매월 ${r.day}일 결제 (첫 결제일 ${e.sub.date}) · 올해 남은 결제 ${F.money(qty)}회${list ? ` (${list})` : ''} × 월 ${F.money(unit)}원 = ${F.money(amt)}원 · 날짜가 지나면 횟수가 자동으로 줄어듭니다`;
      qtyBox = `<span class="krext-tag krext-tag-sub" title="매월 ${r.day}일 결제 (${e.sub.date}부터)">월간 ${r.day}일</span> <span class="krext-plan-qty-v" title="올해 남은 결제 횟수 (오늘 포함, 날짜가 지나면 줄어듦)">${F.money(qty)}</span>`;
    } else {
      tip = `예상 비용: ${e.name} · 수량 ${F.money(qty)} × 단가 ${F.money(unit)} = ${F.money(amt)}원${e.ts ? ` · ${F.fmtClock(e.ts)} 입력` : ''} · R&D ERP 에는 없고 이 브라우저에만 저장된 값`;
      qtyBox = `<span class="krext-plan-qty"><button type="button" data-act="plan-qty" data-d="-1" ${ref} title="수량 −1">−</button><span class="krext-plan-qty-v" title="수량">${F.money(qty)}</span><button type="button" data-act="plan-qty" data-d="1" ${ref} title="수량 +1">＋</button></span>`;
    }
    return `<tr class="krext-bgt-plan${sub ? ' krext-bgt-sub' : ''}" title="${F.esc(tip)}"><td class="krext-bgt-nm"><span class="krext-plan-ind">↳</span> <span class="krext-plan-nm">${F.esc(e.name)}</span> ${qtyBox}<span class="krext-dim"> × ${F.money(unit)}</span>${acts}</td><td class="krext-num krext-dim">-</td><td class="krext-num">−${F.money(amt)}</td><td class="krext-num">${bgt > 0 && amt > 0 ? `<span class="krext-rate-plus krext-plan-rate">+${pct(amt / bgt * 100)}</span>` : '<span class="krext-dim">-</span>'}</td></tr>`;
  }
  /* 예상 비용 입력 폼 (한 번에 하나만 열림: state.planEdit). 값은 state.planDraft 에 있어 다시 그려도 입력이 유지된다.
   * "월간" 토글을 켜면 수량 −/＋ 대신 결제일(date) 입력과 남은 횟수가 나온다 */
  function planForm(state, names) {
    const pe = state.planEdit, d = state.planDraft || { name: '', qty: '1', unit: '', amt: '', sub: false, date: '' };
    const opts = (names || []).map((n) => `<option value="${F.esc(n)}">`).join('');
    const subQty = d.sub ? g.KRX_PLAN.subRemaining(d.date).qty : 0;
    const qtyBox = d.sub
      ? `<span class="krext-plan-lbl">결제일</span><input type="date" data-plan="date" value="${F.esc(d.date)}" title="첫 결제일. 매월 같은 날 결제로 보고 오늘부터 올해 12월까지 남은 횟수를 수량으로 셉니다"><span class="krext-plan-lbl" title="올해 남은 결제 횟수 (오늘 포함)">남은 <b data-plan-out="subqty">${F.money(subQty)}</b>회</span>`
      : `<span class="krext-plan-lbl">수량</span><span class="krext-plan-step"><button type="button" data-act="plan-step" data-d="-1" title="수량 −1">−</button><input type="text" inputmode="decimal" data-plan="qty" value="${F.esc(d.qty)}" title="수량 (기본 1, ↑/↓ 키로도 증감)"><button type="button" data-act="plan-step" data-d="1" title="수량 +1">＋</button></span>`;
    return `<tr class="krext-bgt-form"><td colspan="4"><div class="krext-plan-form">
      <span class="krext-plan-ind">↳</span>
      <input type="text" data-plan="name" list="krext-plan-names" placeholder="세목 (예: 회의비, 소프트웨어 활용비)" value="${F.esc(d.name)}" maxlength="60" autocomplete="off" title="세목 (청구서 세목 빠른 선택 목록과 이전에 적은 세목이 자동완성에 나옵니다)">
      <button type="button" class="krext-plan-subtn${d.sub ? ' krext-on' : ''}" data-act="plan-sub" title="월간 구독: 결제일을 고르면 오늘부터 올해 12월까지 남은 결제 횟수가 수량이 되고, 날짜가 지나면 자동으로 줄어듭니다 (단가 = 월 결제액)">${ICON_REPEAT}월간</button>
      ${qtyBox}
      <label>${d.sub ? '월 결제액' : '단가'} <input type="text" inputmode="numeric" data-plan="unit" value="${F.esc(d.unit)}" placeholder="0" title="${d.sub ? '월 결제액 (원). 남은 횟수 × 월 결제액 = 금액' : '단가 (원). 수량 × 단가 = 금액'}"></label>
      <label>금액 <input type="text" inputmode="numeric" data-plan="amt" value="${F.esc(d.amt)}" placeholder="0" title="예상 금액 (원). 직접 적으면 단가를 수량으로 나눠 맞춥니다"></label>
      <button type="button" class="krext-plan-btn krext-plan-save" data-act="plan-save">${pe && pe.id ? '저장' : '추가'}</button>
      <button type="button" class="krext-plan-btn" data-act="plan-cancel" title="취소 (Esc)">취소</button>
      ${state.planError ? `<span class="krext-err krext-plan-err">${F.esc(state.planError)}</span>` : ''}
    </div><datalist id="krext-plan-names">${opts}</datalist></td></tr>`;
  }

  function budgetTable(p, s, state) {
    if (p.budgetError) return `<div class="krext-sub krext-err">자금현황 조회 오류: ${F.esc(p.budgetError)}</div>`;
    const b = p.budget;
    if (!b) return `<div class="krext-sub krext-dim">자금현황 정보를 아직 불러오지 못했습니다. ↻ 새로고침 하세요.</div>`;
    const unbilled = b.unbilled || 0, req = b.reqAmt || 0, pending = b.pending || (unbilled + req);   // 미청구 카드 사용액 · 승인 전 신청금액 · 둘의 합
    if (!b.items.length && !pending) return `<div class="krext-sub krext-dim">비목별 예산 정보가 없습니다 (예산 미등록 또는 조회 권한 없음). <a href="${F.esc(projectLink(p.prjNo, '06'))}" target="_blank" rel="noopener">R&amp;D ERP 자금현황에서 확인 →</a></div>`;
    const multiRes = (b.resCount || 0) > 1;
    // 설정에서 제외한 비목(인건비/연구수당/간접비)은 계산은 물론 표에서도 뺀다
    const shown = b.items.filter((x) => !x.excluded);
    if (!shown.length && !pending) return `<div class="krext-sub krext-dim">설정에서 제외한 비목을 빼면 남는 비목이 없습니다. <a href="${F.esc(projectLink(p.prjNo, '06'))}" target="_blank" rel="noopener">R&amp;D ERP 자금현황에서 확인 →</a></div>`;
    // 예상 비용: 이 과제에 열린 입력 폼(pe), 과제 합계(pt), 감춤 여부. 세목 자동완성은 청구서 세목 빠른 선택 표시이름 + 이미 적어 둔 세목
    const P = g.KRX_PLAN, plans = (P && state.plans) || {};
    const pe = P && state.planEdit && state.planEdit.prjNo === p.prjNo ? state.planEdit : null;
    const pt = P ? P.projectTotal(plans, p.prjNo) : { sum: 0, count: 0 };
    // 항목이 있는 과제는 기본으로 감춤(눈 아이콘으로 펼친 과제만 보임). 감춤이면 ＋·항목 줄·예상 반영 행을 모두 빼고 과제 행의 예상 잔액만 남긴다
    const hidden = !!(P && pt.count && !(state.planShown && state.planShown.has(p.prjNo)));
    const savedMark = state.planSaved && state.planSaved.prjNo === p.prjNo ? `<span class="krext-plan-saved${state.planSaved.error ? ' krext-err' : ''}${state.planSaved.busy ? ' krext-busy' : ''}">${F.esc(state.planSaved.text || (state.planSaved.error ? '저장 실패' : '저장됨'))}</span>` : '';
    const saveTip = `예상 비용 ${F.money(pt.count)}건 저장${state.planSavedAt ? ` · 마지막 저장 ${F.fmtClock(state.planSavedAt)}` : ''} (입력·수정·삭제 때마다 자동 저장되어 브라우저를 다시 시작해도 남습니다. 눌러서 지금 저장)`;
    // 공유 (Plus, 0.8.7 — SharePoint 공유 폴더의 과제별 폴더, 예상 비용은 그 안의 예상비용.json 한 파일): 저장 아이콘 옆에 과제 폴더 주소 복사(⬆ plan-export: 백그라운드 shareFolderCopy(prjNo) — 동료가 설정의 공유 폴더 칸에 붙여 넣으면 같은 파일을 씀)·열기(↗ = 예상비용.json planUrl, 아직 없으면 과제 폴더 folderUrl) 아이콘.
    // 눈 아이콘으로 예상 비용을 펼친 과제(hidden 아님)에만, 그리고 Plus 가 켜져 있을 때만 보인다 — 꺼져 있으면 공유 관련 아이콘·동작이 아예 없다 (2026-09-27 사용자). 항목이 없는 과제는 늘 펼쳐진 상태라 보임.
    // 툴팁에 이 과제의 마지막 공유 결과(storage.local.planSyncState.pages[과제번호] — background.js shareSync). 실패면 빨간색. 공유 자체는 켜져 있으면 자동(패널 열 때·편집 4초 뒤·자동 갱신)
    const syncOn = !!(s && s.planSync && (!Array.isArray(s.sharePick) || s.sharePick.includes(String(p.prjNo)))), ps = syncOn ? (state.planSync || null) : null, pg = ps && ps.pages ? ps.pages[p.prjNo] : null;
    const page = syncOn && g.KRX_PLAN && g.KRX_PLAN.pageOf ? g.KRX_PLAN.pageOf(state, p.prjNo) : null, link = page ? page.webUrl : '';
    const syncStatus = !syncOn ? '' : (pg && pg.error ? `${F.fmtClock(pg.at || ps.at)} 공유 실패: ${pg.error}`
      : pg ? `마지막 공유 ${F.fmtClock(pg.at || ps.at)}${pg.remoteBy && pg.remoteAt ? ` · 파일 마지막 갱신 ${pg.remoteBy} ${F.fmtClock(pg.remoteAt)}` : ''}${pg.owner ? ` · ${pg.owner} 의 폴더` : ''}`
      : ps && ps.error ? `${F.fmtClock(ps.at)} 공유 실패: ${ps.error}` : '아직 공유 전');
    const pageTxt = pg && pg.planUrl ? `과제 폴더 "${pg.folder || pg.title || pg.prjNo || ''}" 의 예상비용.json` : pg && pg.folder ? `과제 폴더 "${pg.folder}" (예상비용.json 은 항목을 적으면 생김)` : '이 과제의 공유 폴더는 아직 없음';   // planUrl 은 파일에 항목이 있을 때만 들어온다(background.js shareDecoratePages) — title 은 늘 있어 그것으로 가르면 없는 파일도 "있다" 고 했다
    const exportTip = `과제 폴더 주소 복사: 이 과제의 공유 폴더를 여는 주소를 클립보드에 복사합니다 — 동료가 설정 › 공유 (Plus) 의 공유 폴더 칸에 붙여 넣으면 같은 폴더의 같은 파일(예상비용.json · <n>차년도.json)을 쓰게 됩니다 (참여연구원에게는 폴더를 만들 때 자동 공유되므로 보통은 붙일 일이 없습니다) · ${pageTxt} · ${syncStatus}`;
    const syncErr = syncOn && ((pg && pg.error) || (ps && ps.ok === false && !pg));
    const ref = `data-prj="${F.esc(p.prjNo)}"`;
    const eyeBtn = pt.count ? `<button type="button" class="krext-ico-btn${hidden ? ' krext-ico-off' : ''}" data-act="plan-hide" data-prj="${F.esc(p.prjNo)}" title="${hidden ? F.esc(`예상 비용 보이기 (${F.money(pt.count)}건 · ${F.money(pt.sum)}원 저장되어 있음. 기본은 감춤이며 이 화면에서만 펼쳐집니다)`) : '예상 비용 감추기 (＋ 버튼·항목 줄·예상 반영 행을 숨기고 과제 행의 예상 잔액만 남김)'}">${hidden ? ICON_EYE_OFF : ICON_EYE}</button>` : '';
    const oneBtns = (hidden || !syncOn) ? '' : `<button type="button" class="krext-ico-btn${syncErr ? ' krext-ico-err' : ''}" data-act="plan-export" ${ref} title="${F.esc(exportTip)}">${ICON_EXPORT}</button>`
      + (link ? `<a class="krext-ico-btn" href="${F.esc(link)}" target="_blank" rel="noopener" title="${F.esc(`${page.isFile ? '예상비용.json 열기' : '과제 폴더 열기'}: ${pageTxt} (SharePoint 에서 그대로 열립니다)`)}">${ICON_EXT}</a>` : '');
    const icons = P && (pt.count || syncOn) ? `<span class="krext-plan-ico">${eyeBtn}<button type="button" class="krext-ico-btn" data-act="plan-persist" ${ref} title="${F.esc(saveTip)}">${ICON_SAVE}</button>${oneBtns}${savedMark}</span>` : '';
    const names = pe ? Array.from(new Set([].concat(
      (s.quickPicks || []).map((q) => String(q).split('=')[0].trim()),
      Object.values(plans).flatMap((byKey) => Object.values(byKey).flatMap((l) => l.map((e) => e.name)))).filter(Boolean))) : [];
    // 비목 밑의 예상 비용 행들 (수정 중인 항목은 폼으로 대체) + 새 항목 폼
    const planRows = (key, list, bgt) => list.map((e) => (pe && pe.key === key && pe.id === e.id) ? planForm(state, names) : planRow(p.prjNo, key, e, bgt)).join('')
      + (pe && pe.key === key && !pe.id ? planForm(state, names) : '');
    const seen = new Set();
    const rows = shown.map((x) => {
      const name = `${multiRes && x.res ? `<span class="krext-dim">${F.esc(x.res)}</span> ` : ''}${F.esc(x.exp || x.item || '-')}`;
      const tags = `${x.dir ? ' <span class="krext-tag krext-tag-grey" title="직접비 비목">직접비</span>' : ''}${x.psnl ? ' <span class="krext-tag krext-tag-grey" title="인건비 비목">인건비</span>' : ''}`;
      const tip = [x.item ? `예산항목 ${x.item}` : '', `예산액(A) ${F.money(x.bgt)}`, x.cary ? `이월 ${F.money(x.cary)}` : '', x.inter ? `이자 ${F.money(x.inter)}` : '',
        `승인액(B) ${F.money(x.appr)}`, x.req ? `신청 ${F.money(x.req)}` : '', x.purch ? `구매요청 ${F.money(x.purch)}` : '', x.adj ? `예산조정 ${F.money(x.adj)}` : '', `예산잔액(A-B) ${F.money(x.bal)}`].filter(Boolean).join(' · ');
      const key = P ? P.itemKey(x) : ''; seen.add(key);
      const list = (P && !hidden) ? P.listOf(plans, p.prjNo, key) : [];
      let html = `<tr title="${F.esc(tip)}"><td class="krext-bgt-nm">${name}${tags}${P && !hidden ? planBtn(p.prjNo, key) : ''}</td><td class="krext-num">${F.money(x.bgt)}</td><td class="krext-num${x.bal < 0 ? ' krext-red' : ''}">${F.money(x.bal)}</td><td class="krext-num">${rateCell(x.rate, `승인액 ${F.money(x.appr)} / 예산액 ${F.money(x.bgt)}`)}</td></tr>`;
      if (list.length) {   // 이 비목의 예상 비용을 뺀 잔액 / 더한 집행비율 — 항목 줄보다 먼저, 비목 행 바로 밑에 둔다 (총액은 합계의 예상 반영 행에 이미 있음. 2026-10-11 사용자)
        const psum = P.sumOf(list);
        const ptip = `예상 비용 ${F.money(list.length)}건 ${F.money(psum)}원 반영: 잔액 ${F.money(x.bal)} − ${F.money(psum)} · 집행비율 (승인액 ${F.money(x.appr)} + 예상 ${F.money(psum)}) / 예산액 ${F.money(x.bgt)}`;
        html += `<tr class="krext-bgt-proj" title="${F.esc(ptip)}"><td class="krext-bgt-nm"><span class="krext-plan-ind">↳</span> 예상 반영 <span class="krext-dim">${F.money(list.length)}건 · ${F.money(psum)}원</span></td><td class="krext-num krext-dim">-</td><td class="krext-num${x.bal - psum < 0 ? ' krext-red' : ''}">${F.money(x.bal - psum)}</td><td class="krext-num">${rateCell(rateOf(x.appr + psum, x.bgt), `(승인액 + 예상) / 예산액`)}</td></tr>`;
      }
      if (P && !hidden) html += planRows(key, list, x.bgt);   // 항목 줄(수정 중이면 폼) + 새 항목 폼은 예상 반영 행 밑에
      return html;
    }).join('');
    // 표에 없는 비목(설정에서 제외했거나 자금현황에서 사라진 비목)에 적어 둔 예상 비용도 보이게 (합계의 예상 반영에는 포함)
    const orphans = (P && !hidden) ? Object.keys(plans[p.prjNo] || {}).filter((k) => !seen.has(k)).map((k) => {
      const list = P.listOf(plans, p.prjNo, k);
      return `<tr class="krext-bgt-orphan" title="현재 표에 없는 비목에 적어 둔 예상 비용 (설정에서 제외했거나 자금현황에서 사라진 비목). 합계의 예상 반영에는 포함됩니다"><td class="krext-bgt-nm">${F.esc(P.keyName(k))} <span class="krext-tag krext-tag-grey">표에 없는 비목</span></td><td class="krext-num krext-dim">-</td><td class="krext-num krext-dim">-</td><td class="krext-num krext-dim">-</td></tr>` + planRows(k, list, 0);
    }).join('') : '';
    // 미청구 · 승인전 행: 아직 승인액에 잡히지 않은 집행 = 이 과제 카드로 사용했지만 청구 전인 금액(공용 거래 제외) + 청구했지만 승인 전인 신청금액(자금현황 REQ_AMT).
    // 미청구액은 비목 배정 전이라 예산잔액 합계에서 여기서 차감하고, 신청금액은 ERP 예산잔액에 이미 빠져 있어 잔액 열에는 미청구액만 보인다. 집행비율에는 둘 다 더한다
    const ubTip = `승인 전 집행 ${F.money(pending)}원 = 미청구 ${F.money(unbilled)} + 승인전 ${F.money(req)}. 미청구: 이 과제 카드의 미청구 거래 ${F.money(b.unbilledCount || 0)}건 (같은 계좌를 쓰는 다른 과제와 공용인 거래 ${F.money(p.unbilledShared || 0)}건 제외) — 청구 전이라 비목이 정해지지 않아 예산잔액 합계에서 차감. 승인전: 청구(신청)했지만 결재가 끝나지 않은 금액 (자금현황 신청금액) — R&D ERP 예산잔액에는 이미 빠져 있어 잔액 열에는 미청구액만 표시. 집행비율에는 둘 다 더합니다.`;
    const ubName = `미청구 · 승인전 <span class="krext-tag" title="과제카드 미청구 사용액 (거래 건수)">과제카드 ${F.money(b.unbilledCount || 0)}건</span>${req > 0 ? ` <span class="krext-tag krext-tag-grey" title="청구(신청)했지만 승인 전인 금액 — 자금현황 신청금액. R&amp;D ERP 예산잔액(위 비목 행)에 이미 빠져 있어 이 행의 잔액 칸에서는 다시 빼지 않고, 집행비율에만 더합니다">승인전 ${F.money(req)}</span>` : ''}`;
    const ubRow = `<tr class="krext-bgt-unbilled" title="${F.esc(ubTip)}"><td class="krext-bgt-nm">${ubName}</td><td class="krext-num krext-dim">-</td><td class="krext-num${unbilled > 0 ? ' krext-red' : ''}" title="미청구액만 차감 (승인전 신청금액은 위 비목 잔액에 이미 반영)">${unbilled ? '−' + F.money(Math.abs(unbilled)) : '0'}</td><td class="krext-num">${pending > 0 ? `<span class="krext-rate-plus" title="(미청구 ${F.money(unbilled)} + 승인전 ${F.money(req)}) / 예산액 ${F.money(b.bgtAmt)}">+${pct(b.pendingRate)}</span>` : '<span class="krext-dim">-</span>'}</td></tr>`;
    let foot = `<tr class="krext-bgt-total"><td>합계 <span class="krext-dim">(미청구 · 승인전 반영)</span></td><td class="krext-num">${F.money(b.bgtAmt)}</td><td class="krext-num${b.balAfter < 0 ? ' krext-red' : ''}">${F.money(b.balAfter)}</td><td class="krext-num">${rateCell(b.rateAll, `(승인액 ${F.money(b.apprAmt)} + 미청구 ${F.money(unbilled)} + 승인전 ${F.money(req)}) / 예산액 ${F.money(b.bgtAmt)}`)}</td></tr>`;
    if (pt.count && !hidden) {   // 예상 비용까지 뺀 잔액 / 더한 집행비율
      const ftip = `(승인액 ${F.money(b.apprAmt)} + 미청구 ${F.money(unbilled)} + 승인전 ${F.money(req)} + 예상 ${F.money(pt.sum)}) / 예산액 ${F.money(b.bgtAmt)}`;
      foot += `<tr class="krext-bgt-proj" title="${F.esc(ftip)}"><td>예상 반영 <span class="krext-dim">(예상 ${F.money(pt.count)}건 · ${F.money(pt.sum)}원)</span></td><td class="krext-num krext-dim">-</td><td class="krext-num${b.balAfter - pt.sum < 0 ? ' krext-red' : ''}">${F.money(b.balAfter - pt.sum)}</td><td class="krext-num">${rateCell(rateOf(b.execAmt + pt.sum, b.bgtAmt), `(승인액 + 미청구 + 승인전 + 예상) / 예산액`)}</td></tr>`;
    }
    return `<table class="krext-cards krext-bgt"><thead><tr><th>비목${icons}</th><th class="krext-num" title="예산액(A)">예산</th><th class="krext-num" title="예산잔액(A-B)">예산잔액</th><th class="krext-num" title="승인액(B) ÷ 예산액(A)">집행비율</th></tr></thead><tbody>${rows}${orphans}${ubRow}</tbody><tfoot>${foot}</tfoot></table>`;
  }

  function budgetSection(d, s, state) {
    const P = g.KRX_PLAN, plans = (P && state.plans) || {};   // 예상 비용(lib/plan.js)
    // 구역 제목 옆 요약(예산·집행 합계, 제외 비목, 내 참여 과제만 등)은 보이지 않는다 (2026-09-29 사용자 요청). 조회 오류만 알린다
    const errs = d.projects.filter((p) => p.budgetError).length;
    const head = `<div class="krext-sec-title">${sectionSwitch(d, state)}${errs ? `<span class="krext-note krext-err">조회 오류 ${F.money(errs)}건</span>` : ''}</div>`;
    if (!d.projects.length) return `<section class="krext-sec">${head}<div class="krext-msg krext-dim">${whyEmpty(d, s, false)}</div></section>`;
    const list = d.projects.map((p) => {
      const open = state.expanded.has(p.prjNo);
      const b = p.budget;
      const period = (p.stDt || p.endDt) ? `${F.fmtDate(p.stDt)} ~ ${F.fmtDate(p.endDt)}` : '';
      const pt = P ? P.projectTotal(plans, p.prjNo) : { sum: 0, count: 0 };
      const tip = `${p.prjNo} ${period}${b ? ` / 예산 ${F.money(b.bgtAmt)} · 승인 ${F.money(b.apprAmt)} · 미청구 ${F.money(b.unbilled || 0)} · 승인전 ${F.money(b.reqAmt || 0)} · 잔액 ${F.money(b.balAfter)}${pt.count ? ` · 예상 비용 ${F.money(pt.count)}건 ${F.money(pt.sum)} 반영 시 잔액 ${F.money(b.balAfter - pt.sum)}` : ''}` : ''}`;
      // 예상 비용이 있으면 잔액 밑에 예상 반영 잔액을 작게
      const proj = b && pt.count ? `<span class="krext-prj-proj" title="예상 비용 ${F.money(pt.count)}건 ${F.money(pt.sum)}원 반영 시 잔액">예상 ${F.money(b.balAfter - pt.sum)}</span>` : '';
      const rate = b ? rateCell(b.rateAll, `(승인액 ${F.money(b.apprAmt)} + 미청구 ${F.money(b.unbilled || 0)} + 승인전 ${F.money(b.reqAmt || 0)}) / 예산액 ${F.money(b.bgtAmt)}`) : `<span class="krext-rate ${p.budgetError ? 'krext-err' : 'krext-dim'}">${p.budgetError ? '오류' : '-'}</span>`;
      return `<div class="krext-prj${open ? ' krext-open' : ''}">
        <div class="krext-prj-line">
          <a href="#" class="krext-prj-row" data-act="prj" data-prj="${F.esc(p.prjNo)}" title="${F.esc(tip)}">
            <span class="krext-caret">${open ? '▾' : '▸'}</span>
            <span class="krext-prj-rspr">${F.esc(p.rspr || '-')}</span>
            <span class="krext-prj-nm">${F.esc(p.prjNm)}</span>
            <span class="krext-prj-rate">${rate}</span>
            <span class="krext-prj-amt${b && b.balAfter < 0 ? ' krext-red' : ''}" title="예산잔액 (R&amp;D ERP 예산잔액 − 미청구액. 승인전 신청금액은 ERP 잔액에 이미 반영)">${b ? F.money(b.balAfter) : '-'}${proj}</span>
          </a>
          <a class="krext-prj-link" href="${F.esc(projectLink(p.prjNo, '01'))}" target="_blank" rel="noopener" title="R&amp;D ERP 과제정보 열기 (${F.esc(p.prjNo)})">${ICON_EXT}</a>
          <a class="krext-prj-link" href="${F.esc(projectLink(p.prjNo, '06'))}" target="_blank" rel="noopener" title="R&amp;D ERP 과제정보 › 자금현황 탭 열기">${ICON_CHART}</a>
        </div>
        ${open ? `<div class="krext-prj-body">${budgetTable(p, s, state)}</div>` : ''}
      </div>`;
    }).join('');
    return `<section class="krext-sec">${head}<div class="krext-prj-list">${listHead('책임자 · 과제', '집행비율 · 예산잔액 (원)', 2)}${list}</div></section>`;
  }

  /* 제목 줄 B(브릿지) 아이콘 (2026-10-21): Help 서버(Claude CLI)가 연결돼 있으면 없음. 안 돼 있으면 "B" — Claude API 키가 확인돼 있으면 켜진 색(API 로는 되는 중), 아니면 흐린 색.
   * 누르면 연결 지침(Claude Code 설정 프롬프트 — lib/help-setup.js, 팝업 Help Chat·설정 페이지의 같은 단추와 같은 글: 준비물 확인부터 서버 실행까지 Claude Code 에 시키는 요청)을 클립보드에 복사한다
   * (data-act="llm-prompt" → copyLlmPrompt, 잠깐 ✓ 로 바뀜) — 2026-10-23 사용자 "B 브릿지가 연결되지 않으면 B를 클릭하면 연결 지침을 복사하게 해줘". 풍선 말에는 Win+R → <확장 폴더>\help-server\setup.cmd → Enter 길도 적는다.
   * 그 전(2026-10-21 "브릿지 의미의 B 아이콘을 주고 클릭하면 win+R 누르고 setup.cmd 를 클릭하라고 안내")에는 설정 › LLM 연결 카드(#llm-cli)를 열어 안내만 했고, 2026-10-23 아침에는 그 왼쪽에 따로 [설정 프롬프트 복사] 글자 단추를 뒀는데 둘을 B 하나로 합쳤다.
   * state.llm = storage.local.llmStatus, state.llmApi = { ok }(lib/prep.js — 키가 있고 llmApi 확인이 ok), s.apiUse = help.api.use */
  /* 제목 줄 구름 — 공유 (Plus) 켜기/끄기(팝업·사이드 패널·탭만: popup.js 가 state.plus = { on, err, title } 를 채우고 data-act="plus" 를 받음). 켜짐 krext-on, 꺼짐 빗금 구름, 마지막 동기화 실패면 귀퉁이 빨간 점.
   * 2026-10-26 사용자 "클릭으로 활성화/비활성화 … 구름 모양 아이콘으로" → "클라우드 아래 말고 M 이랑 갱신 버튼 있는데" */
  const CLOUD = '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>';
  function plusBtn(p) {
    return `<button type="button" class="krext-btn krext-btn-plus${p.on ? ' krext-on' : ''}${p.err ? ' krext-plus-err' : ''}" data-act="plus" aria-pressed="${p.on ? 'true' : 'false'}" title="${F.esc(p.title || '')}">${svgIcon(p.on ? CLOUD : `${CLOUD}<path d="m3 3 18 18"/>`)}</button>`;
  }
  function llmSetupBtn(state, s) {
    if (!state.llm || state.llm.ok) return '';
    const api = !!(state.llmApi && state.llmApi.ok && s.apiUse !== 'off');
    const how = '복사한 글을 저장소 폴더(확장을 로드한 폴더)에서 연 Claude Code 에 붙여 넣으면 준비물 확인(Node · git · Claude Code CLI · 로그인)부터 Help 서버 실행까지 안내합니다. 또는 Win+R → <확장 폴더>\\help-server\\setup.cmd → Enter (CLI 설치·최신화 · git pull · 서버 실행)';
    return `<button type="button" class="krext-btn krext-btn-ai${api ? ' krext-on' : ''}" data-act="llm-prompt" title="${api ? 'Claude API 키로는 되는 중 · 브릿지(Help 서버) 없음' : 'Claude 연결 안 됨 · 브릿지(Help 서버) 없음'} — 누르면 연결 지침(Claude Code 설정 프롬프트)을 복사합니다. ${how}">B</button>`;
  }
  /* [설정 프롬프트 복사] 의 글: lib/help-setup.js(KRX_HELP_SETUP.prompt — 팝업 Help Chat·설정 페이지와 같은 글)에 서버 주소(state.llm.url — 백그라운드 lib/llm.js 가 실제로 두드린 주소) · 확장 버전 · 그때 본 연결 상태(state.llm.error)를 넣는다.
   * help-setup.js 가 없으면(깨졌으면) popup/help.js 와 같은 짧은 글. from = 어디서 눌렀나(글 끝 "보낸 곳") */
  function llmPromptText(state, from) {
    const l = (state && state.llm) || {};
    const o = { url: l.url || '', from: from || '패널 제목 줄', reason: l.error || '' };
    try { o.version = chrome.runtime.getManifest().version; } catch (e) {}
    try { if (g.KRX_HELP_SETUP) return g.KRX_HELP_SETUP.prompt(o); } catch (e) {}
    const url = String(o.url || '').replace(/\/+$/, '') || 'http://127.0.0.1:8106';
    return `[KR eClass + R&D ERP 현황 확장 — Help 서버(LLM) 연결 설정]\n이 폴더(kr_ext_rerp 저장소)의 CLAUDE.md "Help Chat (help-server) 을 쓸 때 필요한 것" 절을 따라 준비물(Node 22 이상 · git · Claude Code CLI 2.1.280 이상과 로그인)을 확인하고, 별도 터미널에서 node help-server/server.js 를 띄운 뒤 ${url}/health 로 확인해 주세요. 확장 코드 수정·커밋은 하지 마세요.`;
  }
  /* 클립보드에 넣기 — navigator.clipboard 가 막히면(포커스 없음 등) 숨긴 textarea + execCommand('copy') 로 한 번 더 */
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
    try {
      const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.append(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return !!ok;
    } catch (e) { return false; }
  }
  /* 제목 줄 B(브릿지) 아이콘 클릭(content/eclass.js · popup/popup.js 의 data-act="llm-prompt"): 연결 지침을 복사하고 그 단추를 잠깐 ✓(실패면 ✗ — 글자 단추면 "복사했습니다 ✓" / "복사 실패")로 바꿨다가 되돌린다. 다시 그려져 단추가 바뀌었으면 그대로 둔다 */
  async function copyLlmPrompt(btn, state, from) {
    const ok = await copyText(llmPromptText(state, from));
    if (btn) {
      const html = btn.innerHTML, title = btn.title;
      const brief = btn.classList.contains('krext-btn-ai');   // B 아이콘은 한 글자 칸이라 ✓ / ✗ 만
      btn.textContent = ok ? (brief ? '✓' : '복사했습니다 ✓') : (brief ? '✗' : '복사 실패');
      btn.title = ok ? '저장소 폴더(확장을 로드한 폴더)에서 연 Claude Code 에 붙여 넣으세요' : '클립보드에 쓰지 못했습니다 — 설정 페이지 › LLM 설정의 "Claude Code 설정 프롬프트 복사" 를 쓰세요';
      btn.classList.toggle('krext-on', ok);
      setTimeout(() => { if (btn.isConnected) { btn.innerHTML = html; btn.title = title; btn.classList.remove('krext-on'); } }, ok ? 1800 : 4000);
    }
    return ok;
  }
  function render(host, state) {
    const d = state.data;
    const s = (d && d.settings) || {};
    cardNames = s.cardNames || {};
    // 청구 준비 줄: 청구서 입력 도우미가 켜져 있을 때만 (꺼져 있으면 청구서에서 적용되지 않음). 청구종류 목록은 세목 빠른 선택 표시이름
    prepCtx = { on: !!g.KRX_PREP && s.claimHelperOn !== false, picks: g.KRX_PREP ? g.KRX_PREP.parsePicks(s.quickPicks || []) : [], mode: state.mode,
      files: state.mode !== 'popup' || !!state.sidePanel,
      capture: !!state.sidePanel && !!g.KRX_CAP,
      fetch: { on: !!g.KRX_SITES && s.fetchOn !== false && !!(state.llm && state.llm.ok && state.llm.fetch), want: !!g.KRX_SITES && s.fetchOn !== false, llm: state.llm || null, sites: state.fetchSites || [], docs: s.fetchDocs || null, secure: typeof location !== 'undefined' && location.protocol === 'chrome-extension:' },   // 증빙 찾아오기: on = 설정이 켜져 있고 LLM(Help 서버, lib/llm.js → state.llm)이 연결돼 찾아오기가 되는 서버일 때만 버튼 표시 · want = 설정만 켜짐(연결 안 되면 "LLM 연결 안 됨" 표시) · 등록 사이트(비밀번호 없음) · docs = 종류별 필요 서류(설정) · secure = 확장 페이지(등록 칸에 비밀번호를 받아도 되는 곳)
      kinds: (Array.isArray(s.attachKinds) ? s.attachKinds : ((g.KRX_SETTINGS && g.KRX_SETTINGS.DEFAULTS.claimHelper.attachKinds) || [])).map((k) => String(k || '').trim()).filter(Boolean) };   // kinds: 첨부 파일 종류 목록 (설정 claimHelper.attachKinds)   // capture: 화면 캡처 버튼 (사이드 패널만 — 왼쪽 탭을 찍음, popup/capture.js)   // files: 파일을 받을 수 있는 곳(eClass 패널·사이드 패널). 팝업 창은 끌어다 놓거나 파일 선택 창을 열면 닫혀 버림 (popup/mode.js)
    const rnd = state.rndUrl || s.rndUrl || RND_OPEN;
    const hrUrl = state.hrUrl || (s.hr && s.hr.url) || HR_HOME;   // 하단 HR System 열기: eClass 화면의 HR 링크 → 설정의 HR System 링크 → 기본 주소
    const rcmsUrl = (s.rcms && s.rcms.url) || RCMS_HOME;          // 하단 RCMS 열기: 클릭은 백그라운드(openRcms)가 탭을 열어 자동 로그인을 걸고, href 는 가운데 클릭·대체용
    host.classList.toggle('krext-collapsed', !!state.collapsed);
    host.classList.toggle('krext-popup', state.mode === 'popup');
    const updated = d && d.ts ? `${F.fmtClock(d.ts)} 기준` : '';
    // 헤더 아무 곳(버튼 제외)을 클릭해도 접기/펼치기. 팝업에는 접기가 없음
    const headAct = state.mode === 'popup' ? '' : ` data-act="toggle" title="${state.collapsed ? '클릭: 펼치기' : '클릭: 접기'}"`;
    const ratio = g.KRX_STAFF_CHAT && typeof g.KRX_STAFF_CHAT.size === 'function' ? g.KRX_STAFF_CHAT.size() : '';   // 도우미 채팅 폭(popup/staff-chat.js size) — '2:1' · '1:1' · '1:2' 면 그 단추가 눌림, 끌어 정한 px 면 아무것도
    let html = `<div class="krext-head"${headAct}>
      <span class="krext-title">R&amp;D ERP 현황</span>
      ${state.staffOnly || state.mode === 'popup' ? '' : `<span class="krext-chips">${headerChips(d, state)}</span>`}
      <span class="krext-updated"><span class="krext-dot${state.loading ? ' krext-dot-busy' : ''}"></span>${state.loading ? '조회 중…' : F.esc(updated)}</span>
      ${g.KRX_STAFF_UI && !state.staffOnly ? `<button type="button" class="krext-btn${staffPage(state) ? ' krext-on' : ''}" data-act="st-page" data-page="${staffPage(state) ? '' : g.KRX_STAFF_UI.PAGE}" title="${staffPage(state) ? '사업비 관리 닫기 — 현황(카드미청구 · 과제집행비율 · 연구내용)으로' : '사업비 관리 — 과제마다 연차별로 예산(비목별 계획·집행·잔액)과 참여연구원의 참여율·지급액 계획을 세웁니다'}">${ICON_COINS}</button>` : ''}
      ${state.plus ? plusBtn(state.plus) : ''}
      ${state.staffOnly && state.staffChatOpen ? `<span class="krext-ratio" role="group" aria-label="본문과 도우미 폭 비율">${[['2:1', 15], ['1:1', 12], ['1:2', 9]].map(([r, x]) => `<button type="button" class="krext-btn${ratio === r ? ' krext-on' : ''}" data-act="sc-ratio" data-ratio="${r}" aria-pressed="${ratio === r}" title="본문 : 도우미 = ${r}${ratio === r ? ' — 다시 누르면 기본 폭' : ''}">${ICON_SPLIT(x)}</button>`).join('')}</span>` : ''}
      ${g.KRX_GIT ? g.KRX_GIT.button(state) : ''}
      ${llmSetupBtn(state, s)}
      <button type="button" class="krext-btn${state.loading ? ' krext-spin' : ''}" data-act="refresh" title="새로고침 (참여인력·계상률도 다시 조회)"${state.loading ? ' disabled' : ''}>${ICON_REFRESH}</button>
      <button type="button" class="krext-btn" data-act="settings" title="설정">${ICON_SLIDERS}</button>
      ${state.sideOpen ? `<button type="button" class="krext-btn" data-act="sidepanel" title="사이드 패널로 열기 — 다른 탭으로 옮기거나 화면을 눌러도 닫히지 않고, 첨부 파일을 끌어다 놓을 수 있습니다 (설정의 “팝업 창으로 열기”를 끄면 아이콘을 누를 때 바로 사이드 패널이 열림)">${ICON_SIDEBAR}</button>` : ''}
      ${state.mode === 'popup' ? '' : `<button type="button" class="krext-btn" data-act="toggle" title="${state.collapsed ? '펼치기' : '접기'}">${state.collapsed ? ICON_DOWN : ICON_UP}</button>`}
    </div>`;
    if (!state.collapsed) {
      html += `<div class="krext-body">`;
      if (state.fatal) html += `<div class="krext-msg krext-err">${F.esc(state.fatal)}</div>`;
      if (d) {
        if (d.loginRequired) {
          html += loginNotice(state);
        } else if (d.error) {
          html += `<div class="krext-msg krext-err">조회 오류: ${F.esc(d.error)}${d.staleSince ? ` · 아래는 ${F.esc(F.fmtClock(d.staleSince))} 에 조회한 결과입니다` : ''}</div>`;   // staleSince: 서버가 내려가 마지막 정상 결과를 남김 (lib/rnd-api.js keepOnDown)
        }
        const sec = secOf(state.section);
        if (staffPage(state) && !d.loginRequired) {
          // 사업비 관리 화면(제목 줄 아이콘, lib/staff-ui.js): 본문 전체 — 과제 칩 → 연차 칩 → 예산 카드 → 참여인력 카드. 돌아가기는 제목 줄 끝 단추 또는 머리의 같은 아이콘
          // 참여연구원 변경 탭(state.staffOnly = 'staff' — popup.js applyHash, 주소 #only=staff): 제목만(staff-ui 가 뒤에 과제 별칭 · 과제 정보 링크를 붙임) + 연차 칩 + 참여인력 카드, 돌아갈 현황이 없으므로 단추·칩·아이콘·설명 줄 없음(2026-10-19 사용자 "너무 공간을 많이 차지함")
          const only = state.staffOnly === 'staff' || state.staffOnly === 'allow';   // allow: 연구수당 계산 탭(lib/allowance.js, 2026-10-21) — 같은 꼴에 계산 카드
          const title = only
            ? `<span class="krext-page-title">${state.staffOnly === 'allow' ? '연구수당 계산' : '참여연구원 변경'}</span>`
            : `<span class="krext-page-title">사업비 관리</span><span class="krext-note krext-page-desc">연차별 예산과 참여인력 계획</span>`;
          const back = only ? '' : `<button type="button" class="krext-plan-btn krext-page-back" data-act="st-page" data-page="" title="카드미청구 · 과제집행비율 · 연구내용 현황으로">← 현황으로</button>`;
          html += g.KRX_STAFF_UI.section(d, s, state, title, { tail: back, only: only ? state.staffOnly : '' });
        } else {
          const main = d.loginRequired ? '' : sec === 'budget' ? budgetSection(d, s, state) : sec === 'research' ? researchSection(d, s, state)
            : cardsSection(d, s, state);
          // 왼쪽 칸: 미승인내역 + 급여·연구수당(HR), 오른쪽: 카드미청구 / 과제집행비율 / 연구내용
          html += `<div class="krext-cols"><div class="krext-side">${unapprovedSection(d, s, state)}${participationSection(d, s, state)}${paySection(d, s, state)}</div>${main}</div>`;
        }
      } else if (state.loading) {
        html += `<div class="krext-msg krext-dim">불러오는 중…</div>`;
      }
      const meta = [];
      if (d && s.monthsBack != null) meta.push(`사용일자 ${F.esc(s.monthsBack)}개월 전 ~ ${F.esc(s.monthsForward)}개월 후`);
      if (state.version) meta.push(`v${F.esc(state.version)}`);
      html += `</div><div class="krext-foot"><a href="${F.esc(rnd)}" target="_blank" rel="noopener">R&amp;D ERP 열기 ${ICON_EXT}</a><a href="${F.esc(hrUrl)}" target="_blank" rel="noopener">HR System 열기 ${ICON_EXT}</a><a href="${F.esc(rcmsUrl)}" target="_blank" rel="noopener" data-act="rcms" title="RCMS(www.rcms.go.kr)를 새 탭으로 엽니다. 설정에 RCMS ID·비밀번호를 넣어 두면 로그아웃 상태일 때 로그인 화면에서 자동으로 입력하고 로그인 버튼까지 누릅니다 (2차 인증은 직접)">RCMS 열기 ${ICON_EXT}</a><a href="#" data-act="settings">설정</a>${meta.length ? `<span class="krext-foot-r">${meta.join(' · ')}</span>` : ''}</div>`;
    }
    // 예상 비용 입력 중 다시 그려지면(자동 갱신, 다른 창의 변경 등) 같은 칸에 포커스와 커서를 되돌린다 (입력값은 state.planDraft 가 유지)
    // (받기 예정 연구수당 입력칸 data-pay, 참여 계획 입력칸 data-part, 청구 준비의 청구내역 입력칸 data-prep-ptcl(입력값은 state.prepDraft), 자주 사용 등록 칸 data-fetch-f, 💬 채팅 입력란 data-prep-chat-in(입력값은 state.prepChat.draft) 도 같음)
    const ae = typeof document !== 'undefined' ? document.activeElement : null;
    const attr = ae && ae.dataset ? (ae.dataset.plan ? 'plan' : (ae.dataset.pay ? 'pay' : (ae.dataset.part ? 'part' : (ae.dataset.prepPtcl ? 'prep-ptcl' : (ae.dataset.fetchF ? 'fetch-f' : (ae.dataset.prepChatIn ? 'prep-chat-in' : '')))))) : '';   // fetch-f: 자주 사용 등록 칸 (입력값은 state.fetchForm)
    const keep = attr && typeof host.contains === 'function' && host.contains(ae) ? { sel: `[data-${attr}="${ae.getAttribute('data-' + attr)}"]`, pos: ae.selectionStart } : null;
    // 사업비 카드·선택 버튼도 자동 조회 뒤 같은 곳에서 키보드 조작을 이어 간다.
    const keepStaff = ae && ae.dataset && ['st-fold', 'st-months', 'st-proj', 'st-year'].includes(ae.dataset.act) && host.contains(ae)
      ? { act: ae.dataset.act, card: ae.dataset.card, prj: ae.dataset.prj, year: ae.dataset.year } : null;
    host.innerHTML = html;
    if (keep) { const el = host.querySelector(keep.sel); if (el) { el.focus(); try { el.setSelectionRange(keep.pos, keep.pos); } catch (e) {} } }
    else if (keepStaff) {
      const el = Array.from(host.querySelectorAll('[data-act]')).find((x) => Object.entries(keepStaff).every(([k, v]) => x.dataset[k] === v));
      if (el) el.focus({ preventScroll: true });
    }
  }

  g.KRX_RENDER = { render, secOf, slipScreen, slipLink, supplementLink, tempLink, projectLink, paySummary, llmSetupBtn, llmPromptText, copyLlmPrompt };   // llmSetupBtn·llmPromptText: tests/llm-setup-btn.test.js · copyLlmPrompt: eclass.js·popup.js 의 제목 줄 B(브릿지) 아이콘(연결 지침 복사)   // paySummary: lib/staff-ui.js allowCard 가 내 남은 연구수당을 한도 기본값으로   // slip*: tests/supplement-link.test.js · secOf: eclass.js·popup.js 의 구역 값 · projectLink: lib/staff-ui.js 의 참여인력 탭 링크
})(typeof self !== 'undefined' ? self : this);
