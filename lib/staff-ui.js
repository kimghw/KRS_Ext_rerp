/* 사업비 변경 구역 (0.8.7, 2026-10-18) — 패널 본문 스위치의 넷째 구역(카드미청구 · 과제집행비율 · 연구내용 · 사업비 변경). eClass 콘텐츠스크립트 / 팝업 공용.
 * 과제마다 **참여연구원의 참여율·지급액 계획**(lib/staff.js KRX_STAFF — 월별 나누기 · 연간/월 최대 참여율 · 적용월부터 변경 · 이전 기간 비율로 초기화 · 100% 알림 · 인건비 예산 상한)을 다룬다.
 * KRS WORKSPACE 의 참여인력 칸이 하던 계산을 이쪽으로 옮긴 것이다(2026-10-18 사용자 지정) — WORKSPACE 는 rERP 에 등록된 값을 보이기만 한다.
 *
 * 그리기: 과제 줄(책임자 · 과제명 · 계획 합 / 인건비 예산) → 펼치면(state.expanded 'st:과제번호') 기간·예산·단추 줄, 사람마다 줄(월급여·계상인건비·참여율 칸은 표 안에서 바로 적는다 — 예상 비용 폼과 같은 꼴),
 *  그 아래 달마다의 지급(천원), rERP 에 등록된 지급(있으면 흐리게), ✎ 를 누르면 적용월부터 바꾸는 폼, 표 아래 알림(100% 초과·예산·월급여 없음).
 * rERP 조회(과제정보 › 참여인력 rtask_0008_t03_01_r001 · 다른 과제 월별 참여율 rtask_0013_12_r003)는 백그라운드 callService 로 — 과제를 펼칠 때 한 번, ↻ 로 다시. 세션 동안 state.staffRows 에 둔다.
 * 저장은 storage.local.staffPlans(lib/staff.js load/save) — R&D ERP 에는 쓰지 않는다(지급계획 입력은 사용자·러너 몫). 팝업과 eClass 패널이 같은 목록을 쓴다.
 * state: staffPlans(과제별 계획) · staffRows({ [prjNo]: { at, rows, others{seq: rows}, loading, error } }) · staffEdit({ prjNo, id | 'new' }) · staffDraft(폼 값) · staffMsg({ prjNo, text, error }) · staffArm({ key, until } — 두 번 누르기) */
(function (g) {
  const F = g.KRX_FMT, S = g.KRX_STAFF;
  const api = {};
  const PREFIX = 'st:';
  const keyOf = (prjNo) => PREFIX + prjNo;
  const esc = (v) => F.esc(v);
  const PART_SVC = 'rtask_0008_t03_01_r001';
  const OTHERS_SVC = 'rtask_0013_12_r003';
  const ARM_MS = 3000;
  const srcLabel = { manual: '직접', rerp: 'rERP', plan: '계획서', none: '없음' };
  const nowMs = () => Date.now();

  /* ---------- 과제의 기간·예산 ---------- */
  /* 계획의 기간 — 저장된 것, 없으면 과제의 연차 기간(RCH_ST_DT~END_DT). { from, to } 'YYYY-MM' */
  function periodOf(p, plan) {
    if (plan && S.isYm(plan.from) && S.isYm(plan.to)) return { from: plan.from, to: plan.to };
    const from = S.ymOf(p && p.stDt), to = S.ymOf(p && p.endDt);
    return S.isYm(from) && S.isYm(to) && to >= from ? { from, to } : { from, to };
  }
  /* 과제집행비율의 인건비 비목 예산(원) — 비목명에 인건비가 들고 수당이 안 드는 줄의 예산액 합. 없으면 null */
  function erpBudgetPay(p) {
    const items = (p && p.budget && Array.isArray(p.budget.items)) ? p.budget.items : [];
    const hit = items.filter((x) => /인건비/.test(String(x.exp || x.item || '')) && !/수당/.test(String(x.exp || x.item || '')));
    return hit.length ? hit.reduce((s, x) => s + (F.num(x.bgt) || 0), 0) : null;
  }
  const budgetOf = (p, plan) => (plan && plan.budgetPay != null ? plan.budgetPay : erpBudgetPay(p));
  const staffOf = (plan) => (plan && plan.people && plan.people.length ? { basis: plan.basis || 'rerp', src: plan.src || 'erp', people: plan.people } : null);
  const planShell = (p, plan) => Object.assign({ prjNo: p.prjNo, prjNm: p.prjNm || '', from: '', to: '', budgetPay: null, basis: 'rerp', src: 'erp', people: [], at: 0, note: '' }, plan || {});

  /* ---------- 그리기 ---------- */
  function section(d, s, state, switchHtml) {
    const plans = state.staffPlans || {};
    const n = Object.values(plans).filter((x) => x && x.people && x.people.length).length;
    const head = `<div class="krext-sec-title">${switchHtml || ''}<span class="krext-note">${n ? `계획 ${F.money(n)}개` : ''}</span></div>`;
    const projects = (d && d.projects) || [];
    if (!projects.length) return `<section class="krext-sec">${head}<div class="krext-msg krext-dim">표시할 과제가 없습니다.</div></section>`;
    const list = projects.map((p) => {
      const plan = plans[p.prjNo] || null;
      const staff = staffOf(plan);
      const key = keyOf(p.prjNo), open = state.expanded.has(key);
      const budget = budgetOf(p, plan);
      const total = staff ? S.staffTotal(staff, staff.basis) : null;
      const per = periodOf(p, plan);
      const tip = [`${p.prjNo}${p.anl ? ` ${p.anl}연차` : ''}`, per.from ? `계획 기간 ${S.ymText(per.from, per.to)}` : '', staff ? `참여연구원 ${staff.people.length}명 · 인건비 합 ${S.thousand(total)}천원` : '계획 없음', budget != null ? `인건비 예산 ${S.thousand(budget)}천원${plan && plan.budgetPay != null ? '' : ' (과제집행비율 비목)'}` : ''].filter(Boolean).join(' · ');
      const amt = staff ? `${S.thousand(total)}${budget != null ? ` / ${S.thousand(budget)}` : ''}` : (budget != null ? `- / ${S.thousand(budget)}` : '-');
      const over = staff && budget != null && total > budget;
      return `<div class="krext-prj${open ? ' krext-open' : ''}${staff ? '' : ' krext-zero'}">
        <div class="krext-prj-line">
          <a href="#" class="krext-prj-row" data-act="prj" data-prj="${esc(key)}" title="${esc(tip)}">
            <span class="krext-caret">${open ? '▾' : '▸'}</span>
            <span class="krext-prj-rspr">${esc(p.rspr || '-')}</span>
            <span class="krext-prj-nm">${esc(p.prjNm)}</span>
            <span class="krext-prj-cnt">${staff ? `${F.money(staff.people.length)}명` : '<span class="krext-dim">없음</span>'}</span>
            <span class="krext-prj-amt krext-st-amt${over ? ' krext-red' : ''}" title="인건비 계획 합 / 예산 (천원)">${esc(amt)}</span>
          </a>
          <a class="krext-prj-link" href="${esc(partLink(p.prjNo))}" target="_blank" rel="noopener" title="R&amp;D ERP 과제정보 › 참여인력 탭 열기 (${esc(p.prjNo)})">${ICON_PEOPLE}</a>
        </div>
        ${open ? `<div class="krext-prj-body">${body(p, plan, state)}</div>` : ''}
      </div>`;
    }).join('');
    const foot = `<div class="krext-sub krext-dim">참여연구원의 월별 지급금액이 관리 대상이고 참여율은 100% 가 찼는지 보는 값입니다. 여기서 세운 계획은 이 브라우저에만 남으며 R&D ERP 의 참여인력신청·인건비지급계획에는 직접 넣어야 합니다.</div>`;
    return `<section class="krext-sec">${head}<div class="krext-prj-list"><div class="krext-prj-head"><span class="krext-prj-head-l">책임자 · 과제</span><span class="krext-prj-head-r">인원 · 인건비 계획 합 / 예산 (천원)</span><span class="krext-prj-head-sp" style="width:33px"></span></div>${list}</div>${foot}</section>`;
  }
  const partLink = (prjNo) => (g.KRX_RENDER && typeof g.KRX_RENDER.projectLink === 'function') ? g.KRX_RENDER.projectLink(prjNo, '03') : 'https://rnd.krs.co.kr/rderp_layoutMain.act';
  const ICON_PEOPLE = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 19.5v-.5A5 5 0 0 1 7.5 14h3a5 5 0 0 1 5 5v.5M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14a5 5 0 0 1 3 4.6v.9"/></svg>';

  /* 펼친 과제의 몸통 — 기간·예산·단추 줄 · rERP 상태 한 줄 · 사람 표(또는 안내) · 알림 · 메시지 */
  function body(p, plan, state) {
    const prjNo = p.prjNo;
    const cache = (state.staffRows || {})[prjNo] || null;
    const per = periodOf(p, plan);
    const months = S.ymRange(per.from, per.to);
    const budget = budgetOf(p, plan);
    const staff = staffOf(plan);
    const basis = staff ? staff.basis : 'rerp';
    const erpPeople = cache && cache.rows ? S.peopleOfErp(cache.rows, { prjNo, months: months.length ? months : null }) : null;
    const erpAll = cache && cache.rows ? S.peopleOfErp(cache.rows, { prjNo }) : null;
    const arm = (key) => state.staffArm && state.staffArm.key === key && state.staffArm.until > nowMs();
    const bar = `<div class="krext-plan-form krext-st-bar">
      <label>기간 <input type="month" data-stp="from" value="${esc(per.from)}" title="계획 기간의 첫 달 — 기본은 과제의 연차 시작월"> ~ <input type="month" data-stp="to" value="${esc(per.to)}" title="계획 기간의 마지막 달 — 기본은 과제의 연차 종료월"></label>
      <label>인건비 예산 <input type="text" inputmode="numeric" data-stp="budget" value="${plan && plan.budgetPay != null ? esc(S.thousand(plan.budgetPay)) : ''}" placeholder="${budget != null ? esc(S.thousand(budget)) : '천원'}" title="이 기간 인건비 예산(천원) — 비우면 과제집행비율의 인건비 비목 예산액. 합이 이 금액을 넘는 편집은 막습니다">천원</label>
      <span class="krext-st-acts">
        <button type="button" class="krext-plan-btn" data-act="st-init-erp" title="rERP 에 등록된 지급계획(이 기간의 달들)을 그대로 계획으로 — 사람마다 월급여(지급한도액)·월별 지급">rERP 현재로</button>
        <button type="button" class="krext-plan-btn" data-act="st-init-prev" title="이 기간 앞 12달의 rERP 지급 비율로 인건비 예산을 나눠 초기화 — 다음 연차처럼 rERP 에 아직 없는 기간에">이전 기간 비율로</button>
        <button type="button" class="krext-plan-btn" data-act="st-add" title="연구자 더하기 — 성명·월급여와 적용월부터의 참여율(또는 월 지급금액)">＋ 연구자</button>
        <button type="button" class="krext-plan-btn" data-act="st-refresh" title="rERP 참여인력(월급여·지급계획)과 다른 과제 참여율을 다시 조회"${cache && cache.loading ? ' disabled' : ''}>↻ rERP</button>
        ${staff ? `<button type="button" class="krext-plan-btn" data-act="st-copy" title="표(탭으로 나눈 글)로 복사 — 엑셀·한글 표에 그대로 붙습니다">복사</button><button type="button" class="krext-plan-btn${arm('clear:' + prjNo) ? ' krext-red' : ''}" data-act="st-clear" title="이 과제의 계획을 지웁니다(두 번)">${arm('clear:' + prjNo) ? '정말 지우기' : '지우기'}</button>` : ''}
      </span></div>`;
    let status;
    if (!cache) status = 'rERP 참여인력을 아직 조회하지 않았습니다.';
    else if (cache.loading) status = 'rERP 참여인력 조회 중…';
    else if (cache.error) status = `<span class="krext-err">rERP 조회 실패: ${esc(cache.error)}</span>`;
    else status = `rERP 참여인력 ${F.money(erpAll ? erpAll.people.length : 0)}명${erpPeople ? ` · 이 기간 지급 ${F.money(erpPeople.people.length)}명` : ' · 이 기간 지급 없음'} · ${F.fmtClock(cache.at)} 조회`;
    let table;
    if (!staff) {
      const hint = cache && cache.rows && !cache.loading
        ? (erpPeople ? '<b>rERP 현재로</b> 를 누르면 등록된 지급계획으로 계획을 세웁니다.' : 'rERP 에 이 기간의 지급계획이 없습니다 — <b>이전 기간 비율로</b>(인건비 예산을 앞 12달의 지급 비율로 나눔) 또는 <b>＋ 연구자</b>.')
        : '조회가 끝나면 <b>rERP 현재로</b> 또는 <b>이전 기간 비율로</b> 초기화하거나 <b>＋ 연구자</b> 로 적습니다.';
      table = `<div class="krext-sub krext-dim">아직 계획이 없습니다. ${hint}</div>${state.staffEdit && state.staffEdit.prjNo === prjNo && state.staffEdit.id === 'new' ? `<table class="krext-cards krext-st-table"><tbody>${formRow(null, months, state)}</tbody></table>` : ''}`;
    } else table = staffTable(prjNo, staff, months, erpPeople, state);
    const warns = staff ? S.checks(staff, basis, { others: S.mergeOthers({}, staff), budgetPay: budget }) : [];
    const warnHtml = warns.length ? `<ul class="krext-st-warn">${warns.map((w) => `<li class="krext-st-${w.level}">${esc(w.text)}</li>`).join('')}</ul>` : '';
    const msg = state.staffMsg && state.staffMsg.prjNo === prjNo && state.staffMsg.text ? `<div class="krext-sub krext-st-msg${state.staffMsg.error ? ' krext-err' : ''}">${esc(state.staffMsg.text)}</div>` : '';
    return `<div class="krext-st" data-stprj="${esc(prjNo)}">${bar}<div class="krext-sub krext-dim krext-st-status">${status}</div>${table}${warnHtml}${msg}</div>`;
  }

  /* 사람 표 — 성명 · 역할 · 월급여(칸) · 참여 · 계상인건비(칸) · 참여율(칸 · 월 최대) · ✎ × ; 달마다의 지급 줄 ; rERP 등록 줄 ; 폼 */
  function staffTable(prjNo, staff, months, erpPeople, state) {
    const basis = staff.basis;
    const edit = state.staffEdit && state.staffEdit.prjNo === prjNo ? state.staffEdit : null;
    const arm = (key) => state.staffArm && state.staffArm.key === key && state.staffArm.until > nowMs();
    const rows = staff.people.map((q) => {
      const s = S.personStats(q, basis);
      let prev = '';
      const strip = s.planned ? `<tr class="krext-st-months"><td colspan="7">${s.rates.map((r) => {
        const lab = S.monthLabel(r.ym, prev); prev = r.ym;
        const cls = r.amt > 0 ? (s.maxRate != null && r.ym === s.maxYm ? ' krext-st-max' : '') : ' krext-st-off';
        const tip = r.amt > 0 ? `${r.ym} · ${S.thousand(r.amt)}천원${r.rate != null ? ` · ${S.rateText(r.rate)}` : ''}` : `${r.ym} · 제외`;
        return `<span class="krext-st-mo${cls}" title="${esc(tip)}">${esc(lab)} <b>${r.amt > 0 ? S.thousand(r.amt) : '—'}</b></span>`;
      }).join('')}</td></tr>` : '';
      const ep = erpPeople ? erpPeople.people.find((x) => S.sameName(x.name, q.name)) : null;
      const es = ep ? S.personStats(ep, 'rerp') : null;
      const erpRow = ep ? `<tr class="krext-st-erp"><td colspan="7"><span class="krext-dim" title="R&amp;D ERP 참여인력에 등록된 지급계획 — 이 기간의 달들">rERP 등록: ${esc(S.monthlyText(ep.plan))}${es && es.rate != null ? ` · ${esc(S.rateText(es.rate))}${es.maxRate != null ? ` (월 최대 ${esc(S.rateText(es.maxRate))})` : ''}` : ''}${JSON.stringify(ep.plan) === JSON.stringify(q.plan) ? ' · 같음' : ' · <b>다름</b>'}</span></td></tr>` : '';
      const dropKey = `drop:${prjNo}:${q.id}`;
      return `<tr class="krext-st-row" data-id="${esc(q.id)}">
        <td class="krext-st-nm"><b>${esc(q.name)}</b></td><td class="krext-dim">${esc(q.role)}</td>
        <td class="krext-num"><input type="text" class="krext-st-in" data-stc="monthly" data-id="${esc(q.id)}" value="${s.limit ? esc(S.thousand(s.limit)) : ''}" placeholder="천원" inputmode="numeric" title="월급여(천원) — rERP 지급한도액. 직접 적으면 그 값이 앞서고, 비우면 rERP 값으로"><span class="krext-st-tag">${esc(srcLabel[s.src] || '')}</span></td>
        <td class="krext-mono krext-dim">${s.from ? `${esc(S.ymText(s.from, s.to))} (${s.months})` : '—'}</td>
        <td class="krext-num"><input type="text" class="krext-st-in" data-stc="total" data-id="${esc(q.id)}" value="${esc(S.thousand(s.total))}" inputmode="numeric" title="계상인건비(천원) — 바꾸면 지급이 있는 달에 균등하게 다시 나눕니다(앞달 올림 · 마지막 달 잔액)"></td>
        <td class="krext-num"><input type="text" class="krext-st-in krext-st-rate" data-stc="rate" data-id="${esc(q.id)}" value="${s.rate == null ? '' : s.rate.toFixed(2)}" placeholder="—" inputmode="decimal" title="연간 참여율(%) = 계상인건비 ÷ (월급여 × 참여개월), rERP 올림 — 바꾸면 지급이 있는 달마다 round천원(월급여 × %)">${s.maxRate != null ? `<span class="krext-st-tag krext-st-maxtag" title="월 최대 참여율 — ${esc(s.maxYm)}. 100% 검사는 달마다 이 값으로">월 최대 ${esc(S.rateText(s.maxRate))}</span>` : ''}</td>
        <td class="krext-st-act"><span class="krext-plan-acts"><button type="button" data-act="st-edit" data-id="${esc(q.id)}" title="적용월부터 바꾸기 — 참여율 · 월 지급금액 · 제외(0%). 그 앞 달은 그대로">✎</button><button type="button" data-act="st-drop" data-id="${esc(q.id)}" class="${arm(dropKey) ? 'krext-red' : ''}" title="이 사람 빼기(두 번)">${arm(dropKey) ? '정말?' : '×'}</button></span></td></tr>`
        + strip + erpRow + (edit && edit.id === q.id ? formRow(q, months, state) : '');
    }).join('');
    return `<table class="krext-cards krext-st-table"><thead><tr><th>성명</th><th>역할</th><th class="krext-num" title="천원">월급여</th><th>참여</th><th class="krext-num" title="천원">계상인건비</th><th class="krext-num">참여율</th><th></th></tr></thead>
      <tbody>${rows}${edit && edit.id === 'new' ? formRow(null, months, state) : ''}</tbody></table>`;
  }
  /* 적용월부터 바꾸는 폼 — 적용월 · 종료월(끝까지) · 구분 · 값. 더하기(q 가 null)면 성명 · 역할 · 월급여도 */
  function formRow(q, months, state) {
    const d = state.staffDraft || {};
    const opts = (sel, blank) => (blank ? `<option value="">${blank}</option>` : '') + months.map((ym, i) => `<option value="${ym}"${ym === sel ? ' selected' : ''}>${esc(S.monthLabel(ym, i ? months[i - 1] : ''))}</option>`).join('');
    const head = q ? '' : `<input type="text" data-stf="name" value="${esc(d.name || '')}" placeholder="성명" maxlength="40" autocomplete="off" spellcheck="false"><input type="text" data-stf="role" value="${esc(d.role || '')}" placeholder="역할" maxlength="40" autocomplete="off"><label>월급여 <input type="text" data-stf="manual" value="${esc(d.manual || '')}" inputmode="numeric" placeholder="천원" title="참여율로 금액을 셈할 때 필요 — rERP 에 있는 사람이면 비워도 됨">천원</label>`;
    return `<tr class="krext-st-form"><td colspan="7"><div class="krext-plan-form"><span class="krext-plan-ind">↳</span>${head}
      <label>적용월 <select data-stf="from">${opts(d.from)}</select></label><label>종료월 <select data-stf="to">${opts(d.to, '끝까지')}</select></label>
      <label>구분 <select data-stf="mode"><option value="rate"${d.mode === 'rate' || !d.mode ? ' selected' : ''}>참여율 %</option><option value="amt"${d.mode === 'amt' ? ' selected' : ''}>월 지급금액(천원)</option>${q ? `<option value="exclude"${d.mode === 'exclude' ? ' selected' : ''}>제외 (0%)</option>` : ''}</select></label>
      <label>값 <input type="text" data-stf="value" value="${esc(d.value || '')}" inputmode="decimal" autocomplete="off"></label>
      <button type="button" class="krext-plan-btn krext-plan-save" data-act="st-apply" data-id="${q ? esc(q.id) : 'new'}">${q ? '반영' : '더하기'}</button>
      <button type="button" class="krext-plan-btn" data-act="st-cancel" title="취소 (Esc)">취소</button>
      ${state.staffError ? `<span class="krext-err krext-plan-err">${esc(state.staffError)}</span>` : ''}
    </div></td></tr>`;
  }

  /* ---------- 처리 ---------- */
  function bind(host, state, draw) {
    if (!state.staffPlans || typeof state.staffPlans !== 'object') state.staffPlans = {};
    if (!state.staffRows) state.staffRows = {};
    const persist = () => { try { const r = S.save(state.staffPlans); if (r && r.catch) r.catch(() => {}); } catch (e) {} };
    const projectOf = (prjNo) => (((state.data || {}).projects) || []).find((p) => p.prjNo === prjNo) || { prjNo, prjNm: '' };
    const setMsg = (prjNo, text, error) => { state.staffMsg = { prjNo, text, error: !!error }; };
    const closeForm = () => { state.staffEdit = null; state.staffDraft = null; state.staffError = ''; };
    const planOf = (prjNo, make) => { let plan = state.staffPlans[prjNo]; if (!plan && make) { plan = planShell(projectOf(prjNo), null); state.staffPlans[prjNo] = plan; } return plan || null; };
    const monthsOf = (prjNo) => { const per = periodOf(projectOf(prjNo), planOf(prjNo)); return S.ymRange(per.from, per.to); };
    const arm = (key) => { const a = state.staffArm; if (a && a.key === key && a.until > nowMs()) { state.staffArm = null; return true; } state.staffArm = { key, until: nowMs() + ARM_MS }; setTimeout(() => { if (state.staffArm && state.staffArm.key === key && state.staffArm.until <= nowMs()) { state.staffArm = null; draw(); } }, ARM_MS + 50); return false; };
    const call = (service, input) => new Promise((res, rej) => { try { chrome.runtime.sendMessage({ type: 'callService', service, input }).then((r) => (r && r.error ? rej(Object.assign(new Error(r.error), { kind: r.kind })) : res(r || {})), rej); } catch (e) { rej(e); } });

    /* rERP 조회 — 참여인력 행 + 계획(또는 rERP)의 사람마다 다른 과제 월별 참여율. 끝나면 계획 사람들의 rERP 값(월급여·신청 번호·다른 과제)을 잇는다 */
    async function fetchRows(prjNo, { manual = false } = {}) {
      const cache = state.staffRows[prjNo] = Object.assign({}, state.staffRows[prjNo] || {}, { loading: true, error: '' });
      draw();
      try {
        const data = await call(PART_SVC, { SEARCH_NM: '', SEARCH_GB: '1', PRJ_NO: prjNo });
        const rows = S.rowsOfErp(data.INFO_REC);
        cache.rows = rows; cache.at = nowMs(); cache.others = cache.others || {};
        const by = S.byName(rows);
        const plan = planOf(prjNo);
        const want = new Map();
        for (const h of Object.values(by)) if (h.req && h.seq) want.set(h.seq, h);
        for (const [seq, h] of want) {
          try { cache.others[seq] = S.othersOfErp(await call(OTHERS_SVC, { PRJ_NO: prjNo, REQ_CNT: h.req, SEQ_NO: seq })).rows; } catch (e) { /* 한 사람의 다른 과제 조회 실패는 넘어간다 */ }
        }
        if (plan && plan.people.length) { linkErp(plan, prjNo, by, cache); persist(); }
        setMsg(prjNo, manual ? `rERP 참여인력 ${Object.keys(by).length}명을 다시 받았습니다.` : '', false);
      } catch (e) {
        cache.error = (e && e.kind === 'login') ? 'R&D ERP 로그인이 필요합니다 — 제목 줄 ↻ 로 다시 조회한 뒤 다시 누르세요' : String((e && e.message) || e);
      } finally {
        cache.loading = false;
        draw();
      }
    }
    /* 계획 사람들에 rERP 값(월급여·신청 번호·다른 과제 월별 참여율)을 이름으로 잇는다 — 금액은 건드리지 않는다 */
    function linkErp(plan, prjNo, by, cache) {
      for (const q of plan.people) {
        const h = by[S.nameKeyOf(q.name)];
        if (!h || !(h.monthly > 0)) continue;
        q.erp = { monthly: h.monthly, prjNo, at: cache.at || nowMs(), req: h.req, seq: h.seq, others: (cache.others && cache.others[h.seq]) || [] };
      }
    }
    const cacheOf = (prjNo) => state.staffRows[prjNo] || null;
    const needRows = (prjNo) => { const c = cacheOf(prjNo); return !c || (!c.loading && !c.rows); };

    /* 바뀐 사람을 계획에 — 합이 예산을 넘게 되면 막는다(줄이는 쪽은 둔다) */
    function commit(prjNo, before, after, what) {
      const plan = planOf(prjNo);
      if (!plan) return false;
      const staff = staffOf(plan);
      const people = plan.people.map((x) => (x.id === before.id ? after : x));
      const budget = budgetOf(projectOf(prjNo), plan);
      const was = S.overBudget(staff, plan.basis, budget);
      const ob = S.overBudget({ basis: plan.basis, src: plan.src, people }, plan.basis, budget);
      if (ob.over && ob.total > was.total) { setMsg(prjNo, `인건비 예산 ${S.thousand(ob.budget)}천원을 넘어 반영하지 않았습니다 — 합 ${S.thousand(ob.total)}천원 (+${S.thousand(ob.total - ob.budget)}천원).`, true); draw(); return false; }
      const sb = S.personStats(before, plan.basis), sa = S.personStats(after, plan.basis);
      plan.people = people; plan.at = nowMs();
      closeForm(); persist();
      setMsg(prjNo, JSON.stringify(before.plan) !== JSON.stringify(after.plan) ? `${before.name} — ${what}: ${S.statsText(sb)} → ${S.statsText(sa)}` : `${before.name} — ${what}을 바꿨습니다(지급은 그대로).`, false);
      draw();
      return true;
    }
    function applyForm(prjNo, id) {
      const plan = planOf(prjNo, true);
      const months = monthsOf(prjNo);
      const d = state.staffDraft || {};
      const change = { from: d.from || months[0] || '', to: d.to || '', mode: d.mode || 'rate', value: (d.mode || 'rate') === 'amt' ? S.thousandOf(d.value) : d.value };
      try {
        if (id === 'new') {
          const name = String(d.name || '').trim();
          if (!name) throw new Error('성명을 적으세요.');
          if (plan.people.some((x) => S.sameName(x.name, name))) throw new Error(`${name} 은(는) 이미 있습니다.`);
          if (plan.people.length >= S.STAFF_MAX) throw new Error(`참여연구원은 ${S.STAFF_MAX}명까지입니다.`);
          const manual = String(d.manual || '').trim();
          if (manual && S.thousandOf(manual) == null) throw new Error('월급여는 천원 단위의 수입니다.');
          let q = S.normalizePerson({ name, role: String(d.role || '').trim(), manual: S.thousandOf(manual) });
          const cache = cacheOf(prjNo);
          if (cache && cache.rows) { const h = S.byName(cache.rows)[S.nameKeyOf(name)]; if (h && h.monthly > 0) q.erp = { monthly: h.monthly, prjNo, at: cache.at, req: h.req, seq: h.seq, others: (cache.others && cache.others[h.seq]) || [] }; }
          q = S.applyChange(q, plan.basis, change, months);
          const people = plan.people.concat([q]);
          const ob = S.overBudget({ basis: plan.basis, src: plan.src, people }, plan.basis, budgetOf(projectOf(prjNo), plan));
          if (ob.over) throw new Error(`인건비 예산 ${S.thousand(ob.budget)}천원을 넘습니다 — 합 ${S.thousand(ob.total)}천원 (+${S.thousand(ob.total - ob.budget)}천원).`);
          plan.people = people; plan.at = nowMs(); if (!plan.people.length) plan.src = 'manual';
          closeForm(); persist(); setMsg(prjNo, `${name} 을(를) 더했습니다 — ${S.statsText(S.personStats(q, plan.basis))}.`, false); draw();
          return;
        }
        const q = plan.people.find((x) => x.id === id);
        if (!q) return;
        commit(prjNo, q, S.applyChange(q, plan.basis, change, months), { rate: '참여율 변경', amt: '월 지급금액 변경', exclude: '제외' }[change.mode] || '변경');
      } catch (e) { state.staffError = String((e && e.message) || e); draw(); }
    }
    function initFrom(prjNo, how) {
      const p = projectOf(prjNo);
      const plan = planOf(prjNo, true);
      const cache = cacheOf(prjNo);
      if (!cache || !cache.rows) { setMsg(prjNo, 'rERP 참여인력을 먼저 조회합니다…', false); fetchRows(prjNo).then(() => { if (cacheOf(prjNo) && cacheOf(prjNo).rows) initFrom(prjNo, how); }); return; }
      const per = periodOf(p, plan);
      const months = S.ymRange(per.from, per.to);
      if (!months.length) { setMsg(prjNo, '계획 기간(첫 달·마지막 달)을 먼저 정하세요.', true); draw(); return; }
      let staff = null, note = '';
      if (how === 'erp') {
        staff = S.peopleOfErp(cache.rows, { prjNo, now: cache.at, months });
        if (!staff) { setMsg(prjNo, `rERP 에 ${S.ymText(per.from, per.to)} 의 지급계획이 없습니다 — 이전 기간 비율로 초기화하거나 ＋ 연구자로 적으세요.`, true); draw(); return; }
        for (const q of staff.people) if (q.erp && cache.others) q.erp.others = cache.others[q.erp.seq] || [];
        note = `rERP 등록 지급계획(${S.ymText(per.from, per.to)}) 그대로`;
      } else {
        const budget = budgetOf(p, plan);
        if (!(budget > 0)) { setMsg(prjNo, '인건비 예산(천원)을 먼저 적으세요 — 그 금액을 이전 기간 참여연구원의 지급 비율로 나눕니다.', true); draw(); return; }
        const prevMonths = S.ymRange(S.addMonths(per.from, -12), S.addMonths(per.from, -1));
        const sources = S.sharesOfErp(cache.rows, { prjNo, now: cache.at, months: prevMonths });
        staff = S.initFromShares(sources, { budgetPay: budget, span: per });
        if (!staff) { setMsg(prjNo, `${S.ymText(prevMonths[0], prevMonths[prevMonths.length - 1])} 에 rERP 지급이 없어 비율을 셈할 수 없습니다 — ＋ 연구자로 적으세요.`, true); draw(); return; }
        for (const q of staff.people) if (q.erp && cache.others) q.erp.others = cache.others[q.erp.seq] || [];
        note = `${S.ymText(prevMonths[0], prevMonths[prevMonths.length - 1])} 의 rERP 지급 비율로 인건비 ${S.thousand(budget)}천원을 나눔`;
      }
      Object.assign(plan, { from: per.from, to: per.to, basis: staff.basis, src: staff.src, people: staff.people, at: nowMs(), note });
      closeForm(); persist(); setMsg(prjNo, `참여연구원 ${staff.people.length}명 — ${note}.`, false); draw();
    }
    function setPeriod(prjNo, k, v) {
      const plan = planOf(prjNo, true);
      const p = projectOf(prjNo);
      const per = periodOf(p, plan);
      if (k === 'budget') { const t = String(v || '').trim(); if (t && S.thousandOf(t) == null) { setMsg(prjNo, '인건비 예산은 천원 단위의 수입니다.', true); draw(); return; } plan.budgetPay = t ? S.thousandOf(t) : null; }
      else {
        const ym = S.ymOf(v);
        if (!S.isYm(ym)) return;
        plan.from = k === 'from' ? ym : per.from; plan.to = k === 'to' ? ym : per.to;
        if (plan.to && plan.from && plan.to < plan.from) { if (k === 'from') plan.to = plan.from; else plan.from = plan.to; }
        const months = new Set(S.ymRange(plan.from, plan.to));
        for (const q of plan.people) q.plan = q.plan.filter((x) => months.has(x.ym));   // 기간 밖 달은 버린다
      }
      plan.at = nowMs(); persist(); draw();
    }

    host.addEventListener('click', (ev) => {
      const row = ev.target.closest('[data-act="prj"][data-prj^="' + PREFIX + '"]');
      if (row) {   // 과제를 펼칠 때 rERP 를 아직 안 받았으면 받는다(펼침 자체는 eclass.js·popup.js 의 prj 처리)
        const prjNo = row.dataset.prj.slice(PREFIX.length);
        if (!state.expanded.has(row.dataset.prj) && needRows(prjNo)) setTimeout(() => fetchRows(prjNo), 0);
        return;
      }
      const btn = ev.target.closest('[data-act^="st-"]');
      if (!btn) return;
      ev.preventDefault();
      const box = btn.closest('[data-stprj]');
      const prjNo = box ? box.dataset.stprj : '';
      if (!prjNo) return;
      const act = btn.dataset.act, id = btn.dataset.id || '';
      if (act === 'st-refresh') fetchRows(prjNo, { manual: true });
      else if (act === 'st-init-erp') initFrom(prjNo, 'erp');
      else if (act === 'st-init-prev') initFrom(prjNo, 'prev');
      else if (act === 'st-add' || act === 'st-edit') {
        const same = state.staffEdit && state.staffEdit.prjNo === prjNo && state.staffEdit.id === (act === 'st-add' ? 'new' : id);
        if (same) { closeForm(); draw(); return; }
        const months = monthsOf(prjNo);
        if (!months.length) { setMsg(prjNo, '계획 기간(첫 달·마지막 달)을 먼저 정하세요.', true); draw(); return; }
        const todayYm = S.ymOf(F.ymd(new Date()));
        state.staffEdit = { prjNo, id: act === 'st-add' ? 'new' : id };
        state.staffDraft = { name: '', role: '', manual: '', from: months.includes(todayYm) ? todayYm : months[0], to: '', mode: 'rate', value: '' };
        state.staffError = '';
        draw();
        const el = host.querySelector(`[data-stf="${act === 'st-add' ? 'name' : 'value'}"]`); if (el) el.focus();
      }
      else if (act === 'st-cancel') { closeForm(); draw(); }
      else if (act === 'st-apply') applyForm(prjNo, id);
      else if (act === 'st-drop') {
        if (!arm(`drop:${prjNo}:${id}`)) { draw(); return; }
        const plan = planOf(prjNo); if (!plan) return;
        const q = plan.people.find((x) => x.id === id);
        plan.people = plan.people.filter((x) => x.id !== id); plan.at = nowMs();
        if (state.staffEdit && state.staffEdit.id === id) closeForm();
        persist(); setMsg(prjNo, q ? `${q.name} 을(를) 뺐습니다.` : '', false); draw();
      }
      else if (act === 'st-clear') {
        if (!arm(`clear:${prjNo}`)) { draw(); return; }
        delete state.staffPlans[prjNo]; closeForm(); persist(); setMsg(prjNo, '계획을 지웠습니다.', false); draw();
      }
      else if (act === 'st-copy') {
        const staff = staffOf(planOf(prjNo));
        const text = staff ? S.staffTsv(staff, staff.basis) : '';
        const done = (ok) => { setMsg(prjNo, ok ? '표를 복사했습니다.' : '복사하지 못했습니다 — 패널을 한 번 누른 뒤 다시.', !ok); draw(); };
        try { navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); } catch (e) { done(false); }
      }
    });
    host.addEventListener('change', (ev) => {
      const el = ev.target;
      if (!el || !el.dataset) return;
      const box = el.closest('[data-stprj]');
      const prjNo = box ? box.dataset.stprj : '';
      if (!prjNo) return;
      if (el.dataset.stp) { setPeriod(prjNo, el.dataset.stp, el.value); return; }
      const k = el.dataset.stc;
      if (!k) return;
      const plan = planOf(prjNo);
      const q = plan && plan.people.find((x) => x.id === el.dataset.id);
      if (!q) return;
      try {
        const months = monthsOf(prjNo);
        const next = k === 'monthly' ? S.setManual(q, plan.basis, el.value) : k === 'total' ? S.setTotal(q, S.thousandOf(el.value), months) : k === 'rate' ? S.setRate(q, plan.basis, el.value, months) : null;
        if (next) commit(prjNo, q, next, { monthly: '월급여', total: '계상인건비', rate: '참여율' }[k]);
      } catch (e) { setMsg(prjNo, String((e && e.message) || e), true); draw(); }
    });
    host.addEventListener('input', (ev) => {
      const el = ev.target; const f = el && el.dataset ? el.dataset.stf : null; if (!f) return;
      (state.staffDraft || (state.staffDraft = {}))[f] = el.value;
    });
    host.addEventListener('keydown', (ev) => {
      const el = ev.target; if (!el || !el.dataset || !el.dataset.stf) return;
      const box = el.closest('[data-stprj]'); if (!box) return;
      if (ev.key === 'Enter') { ev.preventDefault(); if (state.staffEdit) applyForm(box.dataset.stprj, state.staffEdit.id); }
      else if (ev.key === 'Escape') { ev.preventDefault(); closeForm(); draw(); }
    });
    // 다른 창(팝업 ↔ eClass)에서 바꾼 계획 반영
    try {
      chrome.storage.onChanged.addListener((ch, area) => {
        try { if (area === 'local' && ch[S.KEY]) { state.staffPlans = S.normalizePlans(ch[S.KEY].newValue); draw(); } } catch (e) {}
      });
    } catch (e) {}
    return { fetchRows, initFrom, commit, applyForm };
  }

  Object.assign(api, { section, bind, keyOf, periodOf, erpBudgetPay, budgetOf });
  g.KRX_STAFF_UI = api;
})(typeof self !== 'undefined' ? self : this);
