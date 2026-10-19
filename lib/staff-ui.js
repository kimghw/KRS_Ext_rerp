/* 사업비 관리 화면 (0.8.7, 2026-10-18) — 제목 줄(↻·설정 옆)의 사업비 관리 아이콘(render.js, data-act="st-page")으로 여는 본문 화면(state.page = 'staff'). eClass 콘텐츠스크립트 / 팝업 공용. kr_ext_workspace R&D 탭과 같은 꼴(2026-10-18 사용자 지정 "여기서는 과제 별로, 년차 별로 … workspace 같이 디자인").
 * 모양: 과제 칩(별칭 — 없으면 과제명 앞부분) → 과제 카드(이름 · 과제번호 · 책임자 · 과제 정보 링크, 연차 칩(현재 연차에 "현재", 계획이 있으면 인원 배지, 고치기 화면에는 ＋ 다음 연차), 기간 줄)
 *   → **예산** 카드(비목마다 계획 · 집행 · 잔액 — 집행은 R&D ERP 승인액(현재 연차)에 "집행에 더하기"의 미청구·사용계획(예상 비용)을 더한 것, 줄 아래 막대, 합계, ＋ 비목 · 기본값으로, rERP 자금현황 줄)
 *   → **참여인력** 카드(참여연구원 참여율·지급액 계획 — lib/staff.js) → **변경이력** 카드(접힘 — 그 연차의 변경 한 줄들, 날짜 역순. KRS WORKSPACE 가 연차 파일에 적은 것도 보임). 카드 머리를 누르면 접고 편다.
 * - 변경이력(0.8.7 v2, 2026-10-18 저녁 사용자 지정 "년차별로 1개 파일이고 1개 파일에서 변경사항이랑 다 관리"): 예산 줄(이름·계획 바꿈·더하기·빼기·기본값으로) · 참여인력(초기화·더하기·✎ 반영·칸 편집·×·연차 지우기) · 기간(첫 달·마지막 달) · 별칭을 고칠 때마다
 *   storage.local.shareChanges['과제번호@연차'] 에 { id, date(YYYY-MM-DD), kind, item, before, after, reason:'', by, at, auto:false } 를 덧붙인다(최대 500, id 합집합 — appendChanges). kind·item·before·after·reason·auto 는 kr_ext_workspace 변경이력(src/rnd.js CHANGE_KINDS = 예산·연구내용·연구기간·연구진·기타, budgetChanges·projectChanges)과 같은 이름 —
 *   공유 (Plus) 가 켜져 있으면 background.js shareSync 가 연차 파일(<n>차년도.json)의 changes 칸과 합집합으로 맞춘다(덧붙이기만). 사람 표의 칸 편집은 commit 에서 한 번만 남긴다.
 * - 과제 카드의 **공유** 줄(공유 (Plus) 가 켜져 있을 때만): 과제 폴더 이름 · [폴더 열기] · [참여연구원에게 공유](shareFolderPeople — 결과: 공유 n명 · 이름 겹침 n · 못 찾음 n) · [링크 복사](shareOrgLink — 조직 내 편집 링크) · [주소 복사](shareFolderCopy prjNo). 폴더를 아직 모르면 [지금 동기화].
 *   읽는 것은 storage.local.staffSyncState(= shareState).pages[prjNo] 의 folder · folderUrl · owner · share · webUrl(현재 연차 파일) · noFolder.
 * - 구역 스위치에는 없다. 2026-10-18 사용자 지정 차례: "사업비 변경은 여기(제목 줄 ↻·설정 옆) 메뉴로 넣어줘, 우선 각 과제별로 년차별로 수정할 수 있게" → "사업비 관리는 저기 사업비 변경 부분에서 관리하면 되서 (구역 스위치의 사업비) 메뉴는 필요 없어" → "사업비 변경을 사업비 관리 아이콘으로".
 * - 계획은 과제마다 **연차별**(키 "과제번호@연차", lib/staff.js planKey — 기간 from·to · 예산 줄 budget[{ name, plan }] · 사람들 people). 연차의 기본 기간은 R&D ERP 현재 연차에서 12달씩(yearSpan). 연차 없는 옛 계획은 adopt 가 현재 연차로.
 * - 예산 줄의 기본값(아직 안 적었을 때): 현재 연차는 R&D ERP 자금현황의 비목·예산액, 다른 연차는 그 차년도 연구개발계획서(lib/research.js 기록 budget)의 비목별 예산, 그것도 없으면 비목 이름만(현재 연차 비목 또는 여섯 비목). 인건비 줄의 계획이 참여인력 칸의 인건비 예산.
 * 계산(lib/staff.js KRX_STAFF — 월별 나누기 · 연간/월 최대 참여율 · 적용월부터 변경 · 이전 기간 비율로 초기화 · 100% 알림 · 인건비 예산 상한)은 KRS WORKSPACE 의 참여인력 칸이 하던 것을 옮긴 것이다 — WORKSPACE 는 rERP 등록값을 보이기만 한다.
 * rERP 조회(과제정보 › 참여인력 rtask_0008_t03_01_r001 · 다른 과제 월별 참여율 rtask_0013_12_r003)는 백그라운드 callService 로 — 과제 칩을 고를 때(화면을 열 때) 한 번, ↻ 로 다시. 세션 동안 state.staffRows 에 둔다.
 * 저장은 storage.local.staffPlans(lib/staff.js load/save) — R&D ERP 에는 쓰지 않는다. 팝업과 eClass 패널이 같은 목록을 쓴다. 저장 뒤 planSyncQueue 로 공유 (Plus) 요청(background.js shareSync — 과제별 공유 파일의 staff 칸, 병합은 lib/staff-sync.js merge).
 * 별칭: 과제 카드의 ✎ 로 정하는 이 브라우저의 별칭(storage.local.projectAliases = { prjNo: 별칭 } · projectAliasesAt = { prjNo: 고친 시각 }) — 공유 (Plus) 가 켜져 있으면 과제별 공유 파일의 alias 칸으로 같은 과제 사람들과 맞춘다(aliasAt 이 큰 쪽, lib/prjdoc.js merge).
 *   0.8.7 개발 중의 KRS WORKSPACE 잇기(원노트 「[R&D 과제 정보] KRS WORKSPACE」 페이지, lib/ws-info.js · wsLinks · wsInfo)는 2026-10-18 저장소가 SharePoint 폴더의 JSON 으로 바뀌면서 걷어 냈다.
 * state: page('staff' 면 사업비 변경 화면) · staffPlans · staffView({ prjNo(고른 과제), years{ prjNo: 연차 }, extra{ prjNo: ＋ 로 연 연차 }, inc{ unbilled, plan }, fold{ budget, staff, changes(기본 접힘 — false 면 펼침) } } — storage.local.staffView) · staffAliases({ prjNo: 별칭 } — storage.local.projectAliases) · staffAliasError
 *  · staffRows({ [prjNo]: { at, rows, others{seq: rows}, loading, error } }) · staffEdit({ prjNo, year, id | 'new' }) · staffDraft · staffMsg({ prjNo, year, text, error }) · staffArm({ key, until } — 두 번 누르기) · staffAliasEdit(prjNo) · staffSync(storage.local.staffSyncState = 공유 결과 shareState)
 *  · staffChanges(storage.local.shareChanges = { '과제번호@연차': [변경…] }) · staffShareMsg({ prjNo, text, error } — 공유 줄 단추의 결과) · staffShareBusy(prjNo — 공유 줄 단추 진행 중) */
(function (g) {
  const F = g.KRX_FMT, S = g.KRX_STAFF;
  const api = {};
  const esc = (v) => F.esc(v);
  const PART_SVC = 'rtask_0008_t03_01_r001';
  const OTHERS_SVC = 'rtask_0013_12_r003';
  const ARM_MS = 3000;
  const PAGE = 'staff';   // state.page 값 — 사업비 변경 화면 (render.js 가 머리 단추·본문에 씀)
  const VIEW_KEY = 'staffView';        // storage.local — 보는 상태 { prjNo, years, extra, inc, fold }
  const ALIAS_KEY = 'projectAliases';  // storage.local — 과제 별칭 { [prjNo]: 'SSCB' } (과제 칩·카드 이름)
  const ALIAS_AT_KEY = 'projectAliasesAt';   // storage.local — 별칭을 고친 시각 { [prjNo]: ms } (공유 (Plus) 병합이 새 쪽을 알게 — lib/prjdoc.js aliasAt)
  const CHANGES_KEY = 'shareChanges';   // storage.local — 변경이력 { ['과제번호@연차']: [{ id, date, kind, item, before, after, reason, by, at, auto }] } (background.js shareSync 가 연차 파일 changes 칸과 합집합)
  const CHANGES_MAX = 500;              // 한 연차에 남기는 변경 수 — 넘으면 오래된 것부터 버림 (prjdoc 계약과 같음)
  const CHANGE_KINDS = ['예산', '연구내용', '연구기간', '연구진', '기타'];   // kr_ext_workspace src/rnd.js CHANGE_KINDS 와 같은 이름 — 두 확장이 같은 연차 파일의 changes 를 읽는다
  const srcLabel = { manual: '직접', rerp: 'rERP', plan: '계획서', none: '없음' };
  const nowMs = () => Date.now();
  const todayYm = () => S.ymOf(F.ymd(new Date()));
  const ymdDash = (t) => { const d = new Date(t); return `${d.getFullYear()}-${F.pad2(d.getMonth() + 1)}-${F.pad2(d.getDate())}`; };
  const cut = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

  /* ---------- 변경이력 (순수 — 테스트에서 직접 부름) ---------- */
  const newId = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
  /* 변경 한 줄 — WORKSPACE normalizeChange 와 같은 칸. kind 는 CHANGE_KINDS 가운데(아니면 기타), item 100자 · before/after 300자 · reason 은 비움(사유는 WORKSPACE 나 파일에서 적음), auto 는 사용자가 고친 것이라 false */
  function changeEntry(o) {
    const x = o || {}, t = Number(x.now) || nowMs();
    return { id: cut(x.id, 40) || newId(), date: ymdDash(t), kind: CHANGE_KINDS.includes(x.kind) ? x.kind : '기타', item: cut(x.item, 100), before: cut(x.before, 300), after: cut(x.after, 300), reason: cut(x.reason, 1000), by: cut(x.by, 40), at: t, auto: x.auto === true };
  }
  /* 목록에 덧붙임 — id 로 합집합(같은 id 는 뒤 것이 칸을 덧씀), at 차례(같으면 date), 최대 CHANGES_MAX(오래된 것부터 버림). background.js shareMergeChanges 와 같은 규칙. entry 는 하나 또는 배열 */
  function appendChanges(list, entry) {
    const map = new Map();
    for (const c of (Array.isArray(list) ? list : []).concat(Array.isArray(entry) ? entry : (entry ? [entry] : []))) {
      if (!c || typeof c !== 'object' || !c.id) continue;
      const id = String(c.id);
      map.set(id, map.has(id) ? Object.assign({}, map.get(id), c) : c);
    }
    const out = Array.from(map.values()).sort((a, b) => ((Number(a.at) || 0) - (Number(b.at) || 0)) || String(a.date || '').localeCompare(String(b.date || '')));
    return out.length > CHANGES_MAX ? out.slice(out.length - CHANGES_MAX) : out;
  }
  /* 그 연차의 변경이력(저장 차례 — state.staffChanges['과제번호@연차']) */
  const changesOf = (state, prjNo, year) => { const l = (state.staffChanges || {})[S.planKey(prjNo, year)]; return Array.isArray(l) ? l : []; };
  /* 날짜가 늦은 것부터(같은 날은 at 이 큰 것부터) — WORKSPACE newestFirst 와 같은 뜻 */
  const newestFirst = (list) => (list || []).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || ((Number(b.at) || 0) - (Number(a.at) || 0)));
  const thousandText = (v) => (v == null || v === '' ? '(비움)' : `${S.thousand(v)}천원`);

  /* ---------- 보는 상태 · 연차 · 기간 ---------- */
  const viewOf = (state) => {
    if (!state.staffView || typeof state.staffView !== 'object') state.staffView = {};
    const v = state.staffView;
    if (!v.years || typeof v.years !== 'object') v.years = {};
    if (!v.extra || typeof v.extra !== 'object') v.extra = {};
    if (!v.inc || typeof v.inc !== 'object') v.inc = { unbilled: true, plan: true };
    if (!v.fold || typeof v.fold !== 'object') v.fold = {};
    return v;
  };
  /* 고른 과제 — 없거나 목록에 없으면 첫 과제 */
  const projOf = (projects, state) => { const v = viewOf(state); return projects.find((p) => p.prjNo === v.prjNo) || projects[0] || null; };
  /* 과제에서 고른 연차 — 없으면 R&D ERP 의 현재 연차 */
  const yearOf = (p, state) => { const y = viewOf(state).years[p.prjNo]; return y >= 1 ? y : S.anlOf(p); };
  /* 과제 칩·카드에 보일 별칭 — 이 브라우저에서 정한 것(공유 (Plus) 가 켜져 있으면 백그라운드가 공유 파일과 맞춰 둔다) */
  const aliasOf = (state, prjNo) => String(((state.staffAliases || {})[prjNo]) || '').trim();
  const shortName = (nm) => { const s = String(nm || '').trim(); return s.length > 12 ? `${s.slice(0, 11)}…` : s; };
  /* 연차 없는 옛 계획(키가 과제번호만 — 연차를 두기 전 저장분)은 그 과제의 현재 연차 계획으로 옮긴다(메모리에서 — 다음 저장 때 그대로 남는다). 그 연차에 이미 계획이 있으면 옛것을 버린다 */
  function adopt(plans, p) {
    const old = plans[p.prjNo];
    if (!old || typeof old !== 'object' || old.year >= 1) return;
    const year = S.anlOf(p), key = S.planKey(p.prjNo, year);
    if (!plans[key]) { old.year = year; plans[key] = old; }
    delete plans[p.prjNo];
  }
  /* 과제에 보일 연차들 — 1 ~ max(현재 연차 + 1, 계획이 있는 연차, ＋ 로 연 연차) */
  function yearsOf(p, plans, state) {
    let max = S.anlOf(p) + 1;
    for (const y of Object.keys(S.plansOfProject(plans, p.prjNo))) max = Math.max(max, Number(y));
    const extra = viewOf(state).extra[p.prjNo];
    if (extra > max) max = extra;
    max = Math.min(max, S.YEAR_MAX);
    const out = [];
    for (let n = 1; n <= max; n++) out.push(n);
    return out;
  }
  /* 계획의 기간 — 저장된 것, 없으면 그 연차의 달 범위(현재 연차는 R&D ERP 의 연차 기간 RCH_ST_DT~END_DT, 다른 연차는 거기서 12달씩 — lib/staff.js yearSpan). { from, to } 'YYYY-MM' */
  function periodOf(p, plan, year) {
    if (plan && S.isYm(plan.from) && S.isYm(plan.to)) return { from: plan.from, to: plan.to };
    return S.yearSpan(p, year == null ? (plan && plan.year) || S.anlOf(p) : year);
  }
  const spanText = (per) => (per && per.from ? `${per.from} ~ ${per.to}` : '');
  /* 연차의 형편 — 오늘 달이 기간 앞이면 예정, 뒤면 지남 */
  function yearState(per) { if (!per || !per.from) return '기간 미정'; const t = todayYm(); return t < per.from ? '예정' : t > per.to ? '지남' : '진행 중'; }

  /* ---------- 예산 (비목별 계획 · 집행 · 잔액) ---------- */
  /* 과제집행비율의 인건비 비목 예산(원) — 비목명에 인건비가 들고 수당이 안 드는 줄의 예산액 합. 없으면 null */
  function erpBudgetPay(p) {
    const items = (p && p.budget && Array.isArray(p.budget.items)) ? p.budget.items : [];
    const hit = items.filter((x) => S.isPayItem(x.exp || x.item));
    return hit.length ? hit.reduce((s, x) => s + (F.num(x.bgt) || 0), 0) : null;
  }
  /* 인건비 예산 — 저장된 budgetPay(예산 칸의 인건비 줄을 고치면 거기서 받음) > 예산 줄(rows — budgetRows 의 기본값)의 인건비 > 현재 연차의 과제집행비율 인건비 비목 > null */
  const budgetOf = (p, plan, year, rows) => {
    if (plan && plan.budgetPay != null) return plan.budgetPay;
    if (rows) { const v = S.budgetPayOf(rows); if (v != null) return v; }
    return (year == null ? (plan && plan.year) || S.anlOf(p) : year) === S.anlOf(p) ? erpBudgetPay(p) : null;
  };
  const staffOf = (plan) => (plan && plan.people && plan.people.length ? { basis: plan.basis || 'rerp', src: plan.src || 'erp', people: plan.people } : null);
  const planShell = (p, year, plan) => Object.assign({ prjNo: p.prjNo, year, prjNm: p.prjNm || '', from: '', to: '', budgetPay: null, budget: null, basis: 'rerp', src: 'erp', people: [], at: 0, note: '' }, plan || {});
  const sumText = (staff) => `참여연구원 ${staff.people.length}명 · 인건비 합 ${S.thousand(S.staffTotal(staff, staff.basis))}천원`;
  /* 그 차년도의 연구개발계획서 기록(lib/research.js, state.research) */
  const researchRec = (state, prjNo, year) => Object.values(state.research || {}).find((r) => r && r.prjNo === prjNo && Number(r.n) === year) || null;
  /* 과제집행비율의 예상 비용(lib/plan.js plannedExpenses) 비목별 합(원) — { 비목 키: 합 } */
  function planSumsOf(state, prjNo) {
    const P = g.KRX_PLAN, out = {};   // P 가 없으면(테스트) 키의 비목 이름과 저장된 금액만으로
    const nameOf = (key) => (P ? P.keyName(key) : String(key).slice(String(key).indexOf('|') + 1));
    const amtOf = (e) => (P && typeof P.amtOf === 'function' ? P.amtOf(e) : (F.num(e && e.amt) || 0));
    for (const [key, list] of Object.entries(((state.plans || {})[prjNo]) || {})) {
      const k = S.itemKeyOf(nameOf(key));
      out[k] = (out[k] || 0) + (Array.isArray(list) ? list : []).reduce((s, e) => s + amtOf(e), 0);
    }
    return out;
  }
  /* 예산 칸의 줄들 — { rows[{ name, plan, appr, req, pl, ub, used, left, erp }], src('plan' 직접 | 'erp' R&D ERP 예산액 | 'yaml' 계획서 | 'default' 비목만), loose(연구활동비 줄이 없을 때의 미청구 보조 줄 | null), sums{ plan, used, left }, cur, rec }
   * 집행 = R&D ERP 승인액(현재 연차, 같은 비목은 재원을 합침) + 사용계획(예상 비용 — inc.plan) + 미청구(연구활동비 줄 — inc.unbilled). 승인전(청구했지만 결재 전)은 더하지 않고 툴팁에만 */
  function budgetRows(p, plan, year, state) {
    const cur = year === S.anlOf(p);
    const items = p && p.budget && Array.isArray(p.budget.items) ? p.budget.items : [];
    const erp = new Map();
    for (const x of items) {
      const nm = String(x.exp || x.item || '').trim();
      if (!nm) continue;
      const k = S.itemKeyOf(nm);
      const e = erp.get(k) || { name: nm, bgt: 0, appr: 0, req: 0 };
      e.bgt += F.num(x.bgt) || 0; e.appr += F.num(x.appr) || 0; e.req += F.num(x.req) || 0;
      erp.set(k, e);
    }
    const rec = researchRec(state, p.prjNo, year);
    let src, base;
    if (plan && Array.isArray(plan.budget)) { src = 'plan'; base = plan.budget.map((r) => ({ name: r.name, plan: r.plan })); }
    else if (cur && erp.size) { src = 'erp'; base = [...erp.values()].map((e) => ({ name: e.name, plan: e.bgt })); }
    else if (rec && Array.isArray(rec.budget) && rec.budget.length) { src = 'yaml'; base = rec.budget.map((b) => ({ name: String(b.item || '').trim(), plan: b.plan == null ? null : F.num(b.plan) })); }
    else { src = 'default'; base = (erp.size ? [...erp.values()].map((e) => e.name) : S.BUDGET_ITEMS).map((n) => ({ name: n, plan: null })); }
    const inc = viewOf(state).inc;
    const planSums = cur ? planSumsOf(state, p.prjNo) : {};
    const unbilled = cur && p.budget ? (F.num(p.budget.unbilled) || F.num(p.amount) || 0) : 0;
    const ubIdx = inc.unbilled && unbilled > 0 ? base.findIndex((r) => /연구활동비/.test(String(r.name || ''))) : -1;
    const rows = base.map((r, i) => {
      const e = cur ? erp.get(S.itemKeyOf(r.name)) : null;
      const appr = e ? e.appr : 0, req = e ? e.req : 0;
      const pl = inc.plan ? (planSums[S.itemKeyOf(r.name)] || 0) : 0;
      const ub = i === ubIdx ? unbilled : 0;
      const used = appr + pl + ub;
      return { name: r.name, plan: r.plan, appr, req, pl, ub, used, left: r.plan == null ? null : r.plan - used, erp: !!e };
    });
    const loose = inc.unbilled && unbilled > 0 && ubIdx < 0 ? { amt: unbilled, count: F.num(p.count) || 0 } : null;
    const sums = { plan: rows.reduce((s, r) => s + (r.plan || 0), 0), used: rows.reduce((s, r) => s + r.used, 0) + (loose ? loose.amt : 0) };
    sums.left = sums.plan - sums.used;
    return { rows, src, loose, sums, cur, rec };
  }
  /* 예산 표(탭으로 나눈 글, 천원) */
  function budgetTsv(br) {
    const lines = [['비목', '계획(천원)', '집행(천원)', '잔액(천원)'].join('\t')];
    for (const r of br.rows) lines.push([r.name, r.plan == null ? '' : S.thousand(r.plan), S.thousand(r.used), r.left == null ? '' : S.thousand(r.left)].join('\t'));
    if (br.loose) lines.push([`미청구 · 과제카드 ${br.loose.count}건`, '', S.thousand(br.loose.amt), S.thousand(-br.loose.amt)].join('\t'));
    lines.push(['합계', S.thousand(br.sums.plan), S.thousand(br.sums.used), S.thousand(br.sums.left)].join('\t'));
    return lines.join('\n');
  }

  /* ---------- 그리기 ---------- */
  const ICON_EXT = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>';
  const ICON_FOLDER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
  const ICON_BUDGET = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/></svg>';
  const ICON_PEOPLE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 19.5v-.5A5 5 0 0 1 7.5 14h3a5 5 0 0 1 5 5v.5M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14a5 5 0 0 1 3 4.6v.9"/></svg>';
  const ICON_COPY = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
  const ICON_LOG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/></svg>';
  /* 카드가 펴져 있나 — fold[card] 가 참이면 접힘. 변경이력 카드는 기본 접힘(false 를 적어야 펼침) */
  const openOf = (v, card) => (card === 'changes' ? v.fold[card] === false : !v.fold[card]);
  const partLink = (prjNo) => (g.KRX_RENDER && typeof g.KRX_RENDER.projectLink === 'function') ? g.KRX_RENDER.projectLink(prjNo, '03') : 'https://rnd.krs.co.kr/rderp_layoutMain.act';
  const fundLink = (prjNo) => (g.KRX_RENDER && typeof g.KRX_RENDER.projectLink === 'function') ? g.KRX_RENDER.projectLink(prjNo, '06') : 'https://rnd.krs.co.kr/rderp_layoutMain.act';

  /* headHtml: 화면 제목(render.js). opts.tail 은 제목 줄 끝(돌아가기 단추) */
  function section(d, s, state, headHtml, opts = {}) {
    const plans = state.staffPlans || {};
    const projects = (d && d.projects) || [];
    for (const p of projects) adopt(plans, p);
    const n = Object.values(plans).filter((x) => x && ((x.people && x.people.length) || (x.budget && x.budget.length))).length;
    const head = `<div class="krext-sec-title">${headHtml || ''}<span class="krext-note">${n ? `계획 ${F.money(n)}개` : ''}</span>${opts.tail || ''}</div>`;
    if (!projects.length) return `<section class="krext-sec krext-st-sec krext-ws">${head}<div class="krext-msg krext-dim">표시할 과제가 없습니다.</div></section>`;
    const p = projOf(projects, state);
    const year = yearOf(p, state);
    const plan = plans[S.planKey(p.prjNo, year)] || null;
    const sync = state.staffSync || null;
    const pg = sync && sync.pages && sync.pages[p.prjNo] ? sync.pages[p.prjNo] : null;   // 공유 결과의 이 과제 몫 — 폴더 이름·주소·공유 결과·현재 연차 파일(webUrl 은 파일이 있을 때만)
    const plus = !!(s && s.plus && s.plus.enabled);   // 공유 (Plus) 켜짐 — 과제 카드의 공유 줄은 이때만
    const br = budgetRows(p, plan, year, state);
    const body = `<div class="krext-ws-wrap" data-stprj="${esc(p.prjNo)}" data-styr="${year}">${projCard(p, plans, plan, year, state, pg, plus)}${budgetCard(p, plan, year, br, state)}${staffCard(p, plan, year, br, state)}${changesCard(p, year, state, plus)}</div>`;
    const foot = `<div class="krext-sub krext-dim">예산 칸의 계획은 비목마다 천원으로 적고(현재 연차는 R&D ERP 예산액, 다른 연차는 연구개발계획서가 기본), 참여인력 칸은 월별 지급금액이 관리 대상이고 참여율은 100% 가 찼는지 보는 값입니다. 연차 칩마다 따로 세우며, 여기서 세운 계획은 ${plus ? '공유 폴더의 연차 파일로 같은 과제 사람들과 맞춰지고' : '이 브라우저에만 남고'} R&D ERP 의 사업비 변경·참여인력신청·인건비지급계획에는 직접 넣어야 합니다.</div>`;
    return `<section class="krext-sec krext-st-sec krext-ws krext-st-edit">${head}${chips(projects, p, plans, state)}${body}${foot}${syncLine(sync)}</section>`;
  }
  /* 과제 카드의 공유 줄(공유 (Plus) 켜짐) — 과제 폴더 이름 · [폴더 열기] · [참여연구원에게 공유] · [링크 복사] · [주소 복사] · 공유 결과(n명 · 이름 겹침 · 못 찾음). 폴더를 아직 모르면 [지금 동기화]. pg = shareState.pages[prjNo] */
  function shareLine(p, pg, state) {
    const busy = state.staffShareBusy === p.prjNo;
    const m = state.staffShareMsg && state.staffShareMsg.prjNo === p.prjNo && state.staffShareMsg.text ? state.staffShareMsg : null;
    const msg = m ? `<span class="krext-ws-share-r${m.error ? ' krext-err' : ''}">${esc(m.text)}</span>` : '';
    const dis = busy ? ' disabled' : '';
    if (!pg || !pg.folder) {
      const why = pg && pg.error ? `공유 실패: ${pg.error}` : pg && pg.noFolder ? '과제 폴더가 아직 없습니다 — 과제책임자(또는 이 과제의 자료가 있는 사람)가 동기화하면 만들어지고 참여연구원에게 공유됩니다' : '과제 폴더를 아직 모릅니다 — 동기화하면 공유 폴더(또는 나와 공유된 폴더)에서 찾거나 만듭니다';
      return `<div class="krext-ws-share"><span class="krext-ws-share-k">공유</span><span class="krext-dim${pg && pg.error ? ' krext-err' : ''}">${esc(why)}</span><button type="button" class="krext-plan-btn" data-act="st-share-sync" title="공유 폴더와 지금 맞춥니다 (background.js shareSync — 이 과제만)"${dis}>${busy ? '동기화 중…' : '지금 동기화'}</button>${msg}</div>`;
    }
    const sh = pg.share || null;
    const n = (k) => (sh && Array.isArray(sh[k]) ? sh[k].length : 0);
    const resTxt = sh ? (sh.error ? `자동 공유 실패: ${sh.error}` : `공유 ${n('shared')}명${n('ambiguous') ? ` · 이름 겹침 ${n('ambiguous')}` : ''}${n('notFound') ? ` · 못 찾음 ${n('notFound')}` : ''}${sh.note ? ` · ${sh.note}` : ''}`) : '';
    const resTip = sh ? [n('shared') ? `공유: ${sh.shared.map((x) => x.name).join(', ')}` : '', n('ambiguous') ? `이름 겹침(OneDrive 에서 직접 공유): ${sh.ambiguous.map((x) => `${x.name}(${(x.candidates || []).join('/')})`).join(', ')}` : '', n('notFound') ? `못 찾음: ${sh.notFound.join(', ')}` : '', sh.at ? `${F.fmtClock(sh.at)}` : ''].filter(Boolean).join(' · ') : '';
    const owner = pg.owner ? `<span class="krext-dim" title="나와 공유된 다른 사람의 폴더 — 그 사람이 참여연구원 공유를 관리합니다">${esc(pg.owner)} 의 폴더</span>` : '';
    const open = pg.folderUrl ? `<a href="${esc(pg.folderUrl)}" target="_blank" rel="noopener" title="SharePoint(OneDrive) 에서 이 과제 폴더를 엽니다 — 연차 파일(<n>차년도.json) · 예상비용.json">폴더 열기 ${ICON_EXT}</a>` : '';
    const people = pg.owner ? '' : `<button type="button" class="krext-plan-btn" data-act="st-share-people" title="R&amp;D ERP 참여인력(나 제외)에게 이 폴더를 편집 권한으로 공유합니다 — 이름이 겹치거나 못 찾은 사람은 OneDrive 에서 직접"${dis}>참여연구원에게 공유</button>`;
    const link = `<button type="button" class="krext-plan-btn" data-act="st-share-link" title="조직 내 편집 링크를 만들어 클립보드에 복사합니다 — 참여연구원이 아닌 사람에게 줄 때"${dis}>링크 복사</button>`;
    const copy = `<button type="button" class="krext-ico-btn" data-act="st-share-copy" title="과제 폴더 주소 복사 — 동료가 설정 › 공유 (Plus) 의 공유 폴더 칸에 붙여 넣으면 같은 파일을 씁니다"${dis}>${ICON_COPY}</button>`;
    return `<div class="krext-ws-share"><span class="krext-ws-share-k">공유</span><b class="krext-ws-share-f" title="과제 폴더 이름(별칭 → Job Id → 과제번호) — 만들 때 정해지며 저절로 바뀌지 않습니다">${esc(pg.folder)}</b>${owner}${open}${people}${link}${copy}${resTxt ? `<span class="krext-ws-share-r${sh.error ? ' krext-err' : ''}" title="${esc(resTip)}">${esc(resTxt)}</span>` : ''}${msg}</div>`;
  }
  /* 변경이력 카드(기본 접힘) — 그 연차의 변경 한 줄들을 날짜 역순 표로(날짜 · 구분 · 항목 · 변경(전 → 후) · 사유 · 누가). WORKSPACE 가 연차 파일에 적은 것(auto 포함)도 같은 표에 */
  function changesCard(p, year, state, plus) {
    const v = viewOf(state), open = openOf(v, 'changes');
    const list = changesOf(state, p.prjNo, year), latest = newestFirst(list)[0] || null;
    const stateTxt = list.length ? `${F.money(list.length)}건${latest && latest.date ? ` · 마지막 ${latest.date}` : ''}` : '없음';
    const head = `<div class="krext-ws-cardhead" data-act="st-fold" data-card="changes" title="${open ? '접기' : '펴기'}">${ICON_LOG}<span>변경이력</span><span class="krext-ws-state" title="${esc(S.yearLabel(year))} 변경이력 — 예산 줄·참여인력·기간·별칭을 고칠 때 한 줄씩">${esc(stateTxt)}</span><i class="krext-ws-chev${open ? '' : ' krext-closed'}"></i></div>`;
    if (!open) return `<div class="krext-ws-card">${head}</div>`;
    const rows = newestFirst(list).map((c) => `<tr><td class="krext-mono krext-dim">${esc(c.date || '')}</td><td><span class="krext-ws-kind">${esc(c.kind || '기타')}</span></td><td>${esc(c.item || '')}</td><td class="krext-ws-diff">${esc(c.before || '—')} → <b>${esc(c.after || '—')}</b></td><td class="krext-dim">${esc(c.reason || '')}</td><td class="krext-dim krext-ws-by">${esc(c.by || '')}${c.auto ? ' <small title="계획서 들여오기 등 프로그램이 남긴 줄">자동</small>' : ''}</td></tr>`).join('');
    const body = list.length
      ? `<table class="krext-cards krext-ws-changes"><thead><tr><th>날짜</th><th>구분</th><th>항목</th><th>변경</th><th>사유</th><th>누가</th></tr></thead><tbody>${rows}</tbody></table>`
      : `<div class="krext-sub krext-dim">${esc(S.yearLabel(year))} 변경이력이 없습니다 — 예산 줄·참여인력·기간·별칭을 고치면 한 줄씩 남습니다${plus ? '. 공유 (Plus) 가 켜져 있어 연차 파일(changes)로 같은 과제 사람들·KRS WORKSPACE 와 맞춥니다' : ''}.</div>`;
    return `<div class="krext-ws-card">${head}<div class="krext-ws-body">${body}</div></div>`;
  }
  /* 과제 칩 줄 — 별칭(없으면 과제명 앞부분), 고른 과제는 파랑 */
  function chips(projects, cur, plans, state) {
    return `<div class="krext-ws-projs">${projects.map((x) => {
      const nPlans = Object.keys(S.plansOfProject(plans, x.prjNo)).length;
      const tip = [x.prjNm, x.prjNo, x.rspr ? `책임자 ${x.rspr}` : '', nPlans ? `계획 ${nPlans}개 연차` : ''].filter(Boolean).join(' · ');
      return `<button type="button" class="krext-ws-proj${x.prjNo === cur.prjNo ? ' krext-on' : ''}" data-act="st-proj" data-prj="${esc(x.prjNo)}" title="${esc(tip)}">${esc(aliasOf(state, x.prjNo) || shortName(x.prjNm))}</button>`;
    }).join('')}</div>`;
  }
  /* 과제 카드 — 이름(별칭 ✎) · 과제번호 · 책임자 · 과제 정보/연차 파일 링크, 연차 칩 줄, 기간 줄(달 칸), 공유 줄(plus) */
  function projCard(p, plans, plan, year, state, pg, plus) {
    const alias = aliasOf(state, p.prjNo);
    const per = periodOf(p, plan, year);
    const cur = year === S.anlOf(p);
    const editing = state.staffAliasEdit === p.prjNo;
    const fileLink = pg && pg.webUrl ? `<a href="${esc(pg.webUrl)}" target="_blank" rel="noopener" title="공유 폴더의 이 과제 연차 파일(${esc(S.yearLabel(Array.isArray(pg.years) && pg.years.length ? pg.years[pg.years.length - 1] : year))}) — ${esc(pg.title || '')}${pg.at ? ` · ${esc(F.fmtClock(pg.at))} 공유` : ''}">연차 파일 ${ICON_EXT}</a>` : '';
    const title = `<div class="krext-ws-title">${ICON_FOLDER}<b class="krext-ws-name" title="${esc(p.prjNm)}">${esc(alias || p.prjNm)}</b><button type="button" class="krext-ws-edit" data-act="st-alias" title="별칭 정하기 — 과제 칩과 여기에 보일 짧은 이름 (예: SSCB). 공유 (Plus) 가 켜져 있으면 같은 과제 사람들과 맞추고, 새로 만드는 과제 폴더의 이름이 됩니다">✎</button>`
      + `<span class="krext-ws-meta">${esc(p.prjNo)}${p.rspr ? ` · ${esc(p.rspr)}` : ''}${alias ? ` · ${esc(p.prjNm)}` : ''}</span>`
      + `<span class="krext-ws-links"><a href="${esc(partLink(p.prjNo))}" target="_blank" rel="noopener" title="R&amp;D ERP 과제정보 › 참여인력 탭 (${esc(p.prjNo)})">과제 정보 ${ICON_EXT}</a>${fileLink}</span></div>`;
    const aliasForm = editing ? `<div class="krext-plan-form krext-ws-alias"><input type="text" data-stalias value="${esc(state.staffAliasDraft == null ? alias : state.staffAliasDraft)}" placeholder="별칭 — 예) SSCB" maxlength="20" autocomplete="off" spellcheck="false"><button type="button" class="krext-plan-btn krext-plan-save" data-act="st-alias-set">정하기</button><button type="button" class="krext-plan-btn" data-act="st-alias-cancel" title="취소 (Esc)">취소</button><span class="krext-dim">비우면 과제명 앞부분</span>${state.staffAliasError ? `<span class="krext-err krext-plan-err">${esc(state.staffAliasError)}</span>` : ''}</div>` : '';
    const period = `<input type="month" data-stp="from" value="${esc(per.from)}" title="${esc(S.yearLabel(year))} 계획 기간의 첫 달 — 기본은 ${cur ? 'R&D ERP 의 연차 시작월' : '현재 연차 기간에서 12달씩 셈한 달'}. 바꾸면 기간 밖 달의 지급은 버립니다"> ~ <input type="month" data-stp="to" value="${esc(per.to)}" title="${esc(S.yearLabel(year))} 계획 기간의 마지막 달 — 기본은 ${cur ? 'R&D ERP 의 연차 종료월' : '현재 연차 기간에서 12달씩 셈한 달'}">`;
    const note = `<div class="krext-ws-note"><b>${esc(S.yearLabel(year))}</b> · ${period} · ${esc(yearState(per))}${cur ? ' · <span class="krext-ws-cur">R&amp;D ERP 현재 연차</span>' : ''}${plan && plan.at ? ` · <span class="krext-dim" title="이 연차 계획의 마지막 수정">${esc(F.fmtClock(plan.at))}${plan.by ? ` ${esc(plan.by)}` : ''}</span>` : ''}</div>`;
    return `<div class="krext-ws-card krext-ws-head">${title}${aliasForm}${yearTabs(p, plans, state, year)}${note}${plus ? shareLine(p, pg, state) : ''}</div>`;
  }
  /* 연차 칩 줄 — 1차년도 … (R&D ERP 의 현재 연차는 "현재", 계획이 있으면 인원 배지), ＋ 로 다음 연차 칸 */
  function yearTabs(p, plans, state, cur) {
    const a = S.anlOf(p);
    const years = yearsOf(p, plans, state);
    const tabs = years.map((n) => {
      const plan = plans[S.planKey(p.prjNo, n)] || null, staff = staffOf(plan);
      const per = periodOf(p, plan, n);
      const tip = [S.yearLabel(n), spanText(per) || '기간 미정', n === a ? 'R&D ERP 의 현재 연차' : '', staff ? sumText(staff) : (plan && plan.budget && plan.budget.length ? `예산 ${S.budgetText(plan.budget)}` : '계획 없음')].filter(Boolean).join(' · ');
      return `<button type="button" class="krext-ws-year${n === cur ? ' krext-on' : ''}" data-act="st-year" data-year="${n}" title="${esc(tip)}">${esc(S.yearLabel(n))}${n === a ? '<small>현재</small>' : ''}${staff ? `<span class="krext-badge">${F.money(staff.people.length)}</span>` : ''}</button>`;
    });
    const next = years[years.length - 1] + 1;
    const span = S.yearSpan(p, next);
    const add = next <= S.YEAR_MAX ? `<button type="button" class="krext-ws-year krext-ws-add" data-act="st-year-add" data-year="${next}" title="${esc(S.yearLabel(next))} 칸을 엽니다${span.from ? ` (${esc(spanText(span))})` : ''}">＋ ${esc(S.yearLabel(next))}</button>` : '';
    return `<div class="krext-ws-years">${tabs.join('')}${add}</div>`;
  }
  /* 줄 아래 막대 — 계획 대비 몫을 색으로 이어 붙인다: 승인액 파랑 → 사용계획 주황 → 미청구 보라, 계획을 넘는 몫은 빨강(100% 에서 잘림) */
  function bars(r) {
    const plan = r.plan;
    const pct = (v) => (plan > 0 ? Math.min(100, (v / plan) * 100) : 0);
    const fix = (n) => String(Math.round(n * 100) / 100);
    let at = 0;
    return [{ k: 'base', v: r.appr }, { k: 'plan', v: r.pl }, { k: 'unbilled', v: r.ub }].map(({ k, v }, i) => {
      if (!(v > 0) && i) return '';
      const from = pct(at); at += v > 0 ? v : 0; const to = pct(at);
      return `<i class="krext-ws-bar ${k}${plan > 0 && at > plan ? ' over' : ''}" style="left:${fix(from)}%;width:${fix(to - from)}%"></i>`;
    }).join('');
  }
  /* 예산 카드 — 집행에 더하기(미청구 · 사용계획) · 복사, 머리글, 비목 줄(계획 칸 · 집행 · 잔액 · × · 막대), 미청구 보조 줄, 합계, ＋ 비목 · 기본값으로, rERP 자금현황 줄 */
  function budgetCard(p, plan, year, br, state) {
    const v = viewOf(state), open = !v.fold.budget;
    const sums = br.sums;
    const pct = sums.plan > 0 ? Math.round((sums.used / sums.plan) * 100) : 0;
    const stateTxt = `계획 ${S.thousand(sums.plan)} · 집행 ${S.thousand(sums.used)} (${pct}%)${sums.left < 0 ? ' · 초과' : ''}`;
    const head = `<div class="krext-ws-cardhead" data-act="st-fold" data-card="budget" title="${open ? '접기' : '펴기'}">${ICON_BUDGET}<span>예산</span><span class="krext-ws-state${sums.left < 0 ? ' krext-red' : ''}" title="천원">${esc(stateTxt)}</span><i class="krext-ws-chev${open ? '' : ' krext-closed'}"></i></div>`;
    if (!open) return `<div class="krext-ws-card">${head}</div>`;
    const inc = v.inc;
    const arm = (key) => state.staffArm && state.staffArm.key === key && state.staffArm.until > nowMs();
    const tools = `<div class="krext-ws-tools"><span class="krext-ws-inc" title="비목별 집행은 R&amp;D ERP 승인액(현재 연차)입니다. 여기서 고른 것을 더합니다 — 미청구: 이 과제 카드로 썼지만 청구 전인 금액(연구활동비 줄에, 그 줄이 없으면 합계 위 한 줄) · 사용계획: 과제집행비율에 적어 둔 예상 비용. 승인전(청구했지만 결재 전)은 더하지 않습니다"><span>집행에 더하기</span><label><input type="checkbox" data-stinc="unbilled"${inc.unbilled ? ' checked' : ''}> 미청구</label><label><input type="checkbox" data-stinc="plan"${inc.plan ? ' checked' : ''}> 사용계획(예상 비용)</label></span><button type="button" class="krext-ico-btn" data-act="st-bcopy" title="예산 표 복사 — 비목별 계획·집행·잔액과 합계를 탭으로 나눈 표로(엑셀·한글 표에 그대로 붙습니다)">${ICON_COPY}</button></div>`;
    const bhead = '<div class="krext-ws-bhead"><span>비목</span><span>계획(천원)</span><span>집행(천원)</span><span>잔액</span><span></span></div>';
    const staff = staffOf(plan), staffTotal = staff ? S.staffTotal(staff, staff.basis) : null;
    const rows = br.rows.map((r, i) => {
      const usedTip = [`${r.name || '비목'} 집행(천원)`, r.erp ? `R&D ERP 승인액 ${S.thousand(r.appr)}` : (br.cur ? 'R&D ERP 에 없는 비목' : '다른 연차 — R&D ERP 집행 없음'), r.pl ? `+ 사용계획(예상 비용) ${S.thousand(r.pl)}` : '', r.ub ? `+ 미청구 ${S.thousand(r.ub)}` : '', r.req ? `(승인전 ${S.thousand(r.req)} 은 더하지 않음)` : ''].filter(Boolean).join(' · ');
      const over = r.left != null && r.left < 0;
      const name = `<input type="text" data-stb="name" data-i="${i}" value="${esc(r.name)}" placeholder="비목" maxlength="40" autocomplete="off" spellcheck="false">`;
      const planCell = `<input type="text" data-stb="plan" data-i="${i}" value="${r.plan == null ? '' : esc(S.thousand(r.plan))}" placeholder="0" inputmode="numeric" autocomplete="off" title="${esc(r.name || '비목')} 계획(천원)${br.src === 'erp' ? ' — R&D ERP 예산액' : br.src === 'yaml' ? ' — 연구개발계획서' : ''}">`;
      const payNote = S.isPayItem(r.name) && staffTotal != null ? `<div class="krext-ws-bnote${r.plan != null && staffTotal > r.plan ? ' krext-red' : ''}">참여연구원 계획 합 ${esc(S.thousand(staffTotal))}천원${r.plan != null && r.plan > 0 ? ` (계획의 ${Math.round((staffTotal / r.plan) * 100)}%)` : ''} — 아래 참여인력 칸</div>` : '';
      return `<div class="krext-ws-brow${r.erp ? ' krext-ws-erp' : ''}" data-i="${i}">${name}${planCell}<span class="krext-ws-cell krext-ws-num krext-ws-used" title="${esc(usedTip)}">${esc(S.thousand(r.used))}</span><span class="krext-ws-left${over ? ' krext-over' : ''}" title="잔액(천원) = 계획 − 집행">${r.left == null ? '' : esc(S.thousand(r.left))}</span><button type="button" class="krext-ws-bdel" data-act="st-bdel" data-i="${i}" title="이 비목 빼기">×</button><span class="krext-ws-bars" aria-hidden="true">${bars(r)}</span></div>${payNote}`;
    }).join('');
    const loose = br.loose ? `<div class="krext-ws-brow krext-ws-extra" title="이 과제 카드로 썼지만 아직 청구하지 않은 금액 — 연구활동비 줄이 없어 합계에서만 뺍니다"><span class="krext-ws-cell">미청구 · 과제카드 ${F.money(br.loose.count)}건</span><span></span><span class="krext-ws-cell krext-ws-num">${esc(S.thousand(br.loose.amt))}</span><span class="krext-ws-left krext-over">${esc(S.thousand(-br.loose.amt))}</span><span></span></div>` : '';
    const sum = `<div class="krext-ws-bsum"><span>합계</span><span>${esc(S.thousand(sums.plan))}</span><span>${esc(S.thousand(sums.used))}</span><span class="${sums.left < 0 ? 'krext-red' : ''}">${esc(S.thousand(sums.left))}</span><span></span></div>`;
    const srcTxt = { plan: '직접 적은 계획', erp: 'R&D ERP 예산액(자금현황)', yaml: `연구개발계획서 ${br.rec ? `${br.rec.n}차년도${br.rec.rev ? ` ${br.rec.rev}` : ''}` : ''}`, default: '비목만 (계획을 적으세요)' }[br.src] || '';
    const resetKey = `breset:${p.prjNo}@${year}`;
    const acts = `<div class="krext-ws-bact"><button type="button" class="krext-plan-btn" data-act="st-badd" title="비목 줄 더하기">＋ 비목</button>${br.src === 'plan' ? `<button type="button" class="krext-plan-btn${arm(resetKey) ? ' krext-red' : ''}" data-act="st-breset" title="직접 적은 계획을 지우고 기본값(현재 연차는 R&amp;D ERP 예산액, 다른 연차는 연구개발계획서의 비목별 예산)으로 — 두 번 누릅니다">${arm(resetKey) ? '정말 되돌리기' : '기본값으로'}</button>` : ''}<span class="krext-dim">계획: ${esc(srcTxt)}</span></div>`;
    const b = p.budget;
    const erpLine = br.cur && b
      ? `<div class="krext-ws-erpline"><span>rERP 자금현황(원) · 예산 ${F.money(b.bgtAmt)} · 승인 ${F.money(b.apprAmt)} · 미청구 ${F.money(b.unbilled || 0)} · 승인전 ${F.money(b.reqAmt || 0)}</span><a href="${esc(fundLink(p.prjNo))}" target="_blank" rel="noopener" title="R&amp;D ERP 과제정보 › 자금현황 탭">열기 ${ICON_EXT}</a></div>`
      : `<div class="krext-ws-erpline"><span class="krext-dim">${br.cur ? 'rERP 자금현황을 아직 받지 못했습니다 — 제목 줄 ↻' : `rERP 자금현황은 현재 연차(${S.anlOf(p)}차년도)만 — 이 연차의 집행은 0 입니다`}</span></div>`;
    return `<div class="krext-ws-card">${head}<div class="krext-ws-body">${tools}${bhead}${rows}${loose}${sum}${acts}${erpLine}</div></div>`;
  }
  /* 참여인력 카드 — 머리(인원 · 인건비 합 / 예산), 단추 줄, rERP 상태 한 줄, 사람 표(또는 안내), 알림, 메시지 */
  function staffCard(p, plan, year, br, state) {
    const v = viewOf(state), open = !v.fold.staff;
    const staff = staffOf(plan);
    const budget = budgetOf(p, plan, year, br.rows);
    const total = staff ? S.staffTotal(staff, staff.basis) : null;
    const over = staff && budget != null && total > budget;
    const stateTxt = staff ? `${staff.people.length}명 · 인건비 ${S.thousand(total)}${budget != null ? ` / ${S.thousand(budget)}` : ''}천원` : '계획 없음';
    const head = `<div class="krext-ws-cardhead" data-act="st-fold" data-card="staff" title="${open ? '접기' : '펴기'}">${ICON_PEOPLE}<span>참여인력</span><span class="krext-ws-state${over ? ' krext-red' : ''}" title="참여연구원 수 · 인건비 계획 합 / 인건비 예산(예산 칸의 인건비 줄)">${esc(stateTxt)}</span><i class="krext-ws-chev${open ? '' : ' krext-closed'}"></i></div>`;
    if (!open) return `<div class="krext-ws-card">${head}</div>`;
    return `<div class="krext-ws-card">${head}<div class="krext-ws-body">${staffBody(p, plan, year, budget, state)}</div></div>`;
  }
  function staffBody(p, plan, year, budget, state) {
    const prjNo = p.prjNo;
    const cache = (state.staffRows || {})[prjNo] || null;
    const per = periodOf(p, plan, year);
    const months = S.ymRange(per.from, per.to);
    const staff = staffOf(plan);
    const basis = staff ? staff.basis : 'rerp';
    const erpPeople = cache && cache.rows ? S.peopleOfErp(cache.rows, { prjNo, months: months.length ? months : null }) : null;
    const erpAll = cache && cache.rows ? S.peopleOfErp(cache.rows, { prjNo }) : null;
    const arm = (key) => state.staffArm && state.staffArm.key === key && state.staffArm.until > nowMs();
    const yl = S.yearLabel(year);
    const acts = `<div class="krext-st-acts">
        <button type="button" class="krext-plan-btn" data-act="st-init-erp" title="rERP 에 등록된 지급계획(이 기간의 달들)을 그대로 계획으로 — 사람마다 월급여(지급한도액)·월별 지급">rERP 현재로</button>
        <button type="button" class="krext-plan-btn" data-act="st-init-prev" title="이 기간 앞 12달의 rERP 지급 비율(없으면 앞 연차 계획의 비율)로 인건비 예산(예산 칸의 인건비 줄)을 나눠 초기화 — 다음 연차처럼 rERP 에 아직 없는 기간에">이전 기간 비율로</button>
        <button type="button" class="krext-plan-btn" data-act="st-add" title="연구자 더하기 — 성명·월급여와 적용월부터의 참여율(또는 월 지급금액)">＋ 연구자</button>
        <button type="button" class="krext-plan-btn" data-act="st-refresh" title="rERP 참여인력(월급여·지급계획)과 다른 과제 참여율을 다시 조회"${cache && cache.loading ? ' disabled' : ''}>↻ rERP</button>
        ${staff ? `<button type="button" class="krext-plan-btn" data-act="st-copy" title="이 연차의 참여인력 표(탭으로 나눈 글)를 복사">복사</button>` : ''}
        ${plan ? `<button type="button" class="krext-plan-btn${arm('clear:' + prjNo + '@' + year) ? ' krext-red' : ''}" data-act="st-clear" title="이 과제 ${esc(yl)} 계획(예산 줄·참여인력)을 지웁니다(두 번)">${arm('clear:' + prjNo + '@' + year) ? '정말 지우기' : `${esc(yl)} 지우기`}</button>` : ''}
      </div>`;
    let status;
    if (!cache) status = 'rERP 참여인력을 아직 조회하지 않았습니다.';
    else if (cache.loading) status = 'rERP 참여인력 조회 중…';
    else if (cache.error) status = `<span class="krext-err">rERP 조회 실패: ${esc(cache.error)}</span>`;
    else status = `rERP 참여인력 ${F.money(erpAll ? erpAll.people.length : 0)}명${erpPeople ? ` · 이 기간 지급 ${F.money(erpPeople.people.length)}명` : ' · 이 기간 지급 없음'} · ${F.fmtClock(cache.at)} 조회`;
    const editing = state.staffEdit && state.staffEdit.prjNo === prjNo && state.staffEdit.year === year ? state.staffEdit : null;
    let table;
    if (!staff) {
      let hint;
      if (cache && cache.rows && !cache.loading) hint = erpPeople ? '<b>rERP 현재로</b> 를 누르면 등록된 지급계획으로 계획을 세웁니다.' : 'rERP 에 이 기간의 지급계획이 없습니다 — <b>이전 기간 비율로</b>(인건비 예산을 앞 12달의 rERP 지급, 없으면 앞 연차 계획의 비율로 나눔) 또는 <b>＋ 연구자</b>.';
      else hint = '조회가 끝나면 <b>rERP 현재로</b> 또는 <b>이전 기간 비율로</b> 초기화하거나 <b>＋ 연구자</b> 로 적습니다.';
      table = `<div class="krext-sub krext-dim">${esc(yl)} 참여인력 계획이 아직 없습니다. ${hint}</div>${editing && editing.id === 'new' ? `<table class="krext-cards krext-st-table"><tbody>${formRow(null, months, state)}</tbody></table>` : ''}`;
    } else table = staffTable(prjNo, year, staff, months, erpPeople, state, editing);
    const warns = staff ? S.checks(staff, basis, { others: S.mergeOthers({}, staff), budgetPay: budget }) : [];
    const warnHtml = warns.length ? `<ul class="krext-st-warn">${warns.map((w) => `<li class="krext-st-${w.level}">${esc(w.text)}</li>`).join('')}</ul>` : '';
    const msg = state.staffMsg && state.staffMsg.prjNo === prjNo && state.staffMsg.year === year && state.staffMsg.text ? `<div class="krext-sub krext-st-msg${state.staffMsg.error ? ' krext-err' : ''}">${esc(state.staffMsg.text)}</div>` : '';
    return `${acts}<div class="krext-sub krext-dim krext-st-status">${status}</div>${table}${warnHtml}${msg}`;
  }
  /* 바닥글 밑 공유 (Plus) 한 줄 — 공유가 한 번이라도 돌았을 때 (storage.local.staffSyncState = shareState: at · ok · base{ path } · pages{ prjNo: 과제 폴더 } · error · kind) */
  function syncLine(sync) {
    if (!sync || !sync.at) return '';
    const n = Object.keys(sync.pages || {}).length;
    const base = (sync.base && sync.base.path) || (sync.folder && sync.folder.path) || '';
    return `<div class="krext-sub krext-dim krext-st-sync">공유: ${sync.ok ? `${esc(F.fmtClock(sync.at))} · 과제 ${F.money(sync.count || n)}개${base ? ` · ${esc(base)}` : ''}` : `<span class="krext-err">${esc(F.fmtClock(sync.at))} 실패 — ${esc(sync.error || sync.kind || '')}</span>`}</div>`;
  }

  /* 사람 표 — 성명 · 역할 · 월급여(칸) · 참여 · 계상인건비(칸) · 참여율(칸 · 월 최대) · ✎ × ; 달마다의 지급 줄 ; rERP 등록 줄 ; 폼 */
  function staffTable(prjNo, year, staff, months, erpPeople, state, editing) {
    const basis = staff.basis;
    const cols = 7;
    const arm = (key) => state.staffArm && state.staffArm.key === key && state.staffArm.until > nowMs();
    const rows = staff.people.map((q) => {
      const s = S.personStats(q, basis);
      let prev = '';
      const strip = s.planned ? `<tr class="krext-st-months"><td colspan="${cols}">${s.rates.map((r) => {
        const lab = S.monthLabel(r.ym, prev); prev = r.ym;
        const cls = r.amt > 0 ? (s.maxRate != null && r.ym === s.maxYm ? ' krext-st-max' : '') : ' krext-st-off';
        const tip = r.amt > 0 ? `${r.ym} · ${S.thousand(r.amt)}천원${r.rate != null ? ` · ${S.rateText(r.rate)}` : ''}` : `${r.ym} · 제외`;
        return `<span class="krext-st-mo${cls}" title="${esc(tip)}">${esc(lab)} <b>${r.amt > 0 ? S.thousand(r.amt) : '—'}</b></span>`;
      }).join('')}</td></tr>` : '';
      const ep = erpPeople ? erpPeople.people.find((x) => S.sameName(x.name, q.name)) : null;
      const es = ep ? S.personStats(ep, 'rerp') : null;
      const erpRow = ep ? `<tr class="krext-st-erp"><td colspan="${cols}"><span class="krext-dim" title="R&amp;D ERP 참여인력에 등록된 지급계획 — 이 기간의 달들">rERP 등록: ${esc(S.monthlyText(ep.plan))}${es && es.rate != null ? ` · ${esc(S.rateText(es.rate))}${es.maxRate != null ? ` (월 최대 ${esc(S.rateText(es.maxRate))})` : ''}` : ''}${JSON.stringify(ep.plan) === JSON.stringify(q.plan) ? ' · 같음' : ' · <b>다름</b>'}</span></td></tr>` : '';
      const dropKey = `drop:${prjNo}@${year}:${q.id}`;
      const maxTag = s.maxRate != null ? `<span class="krext-st-tag krext-st-maxtag" title="월 최대 참여율 — ${esc(s.maxYm)}. 100% 검사는 달마다 이 값으로">월 최대 ${esc(S.rateText(s.maxRate))}</span>` : '';
      const cells = `<td class="krext-num"><input type="text" class="krext-st-in" data-stc="monthly" data-id="${esc(q.id)}" value="${s.limit ? esc(S.thousand(s.limit)) : ''}" placeholder="천원" inputmode="numeric" title="월급여(천원) — rERP 지급한도액. 직접 적으면 그 값이 앞서고, 비우면 rERP 값으로"><span class="krext-st-tag">${esc(srcLabel[s.src] || '')}</span></td>
        <td class="krext-mono krext-dim">${s.from ? `${esc(S.ymText(s.from, s.to))} (${s.months})` : '—'}</td>
        <td class="krext-num"><input type="text" class="krext-st-in" data-stc="total" data-id="${esc(q.id)}" value="${esc(S.thousand(s.total))}" inputmode="numeric" title="계상인건비(천원) — 바꾸면 지급이 있는 달에 균등하게 다시 나눕니다(앞달 올림 · 마지막 달 잔액)"></td>
        <td class="krext-num"><input type="text" class="krext-st-in krext-st-rate" data-stc="rate" data-id="${esc(q.id)}" value="${s.rate == null ? '' : s.rate.toFixed(2)}" placeholder="—" inputmode="decimal" title="연간 참여율(%) = 계상인건비 ÷ (월급여 × 참여개월), rERP 올림 — 바꾸면 지급이 있는 달마다 round천원(월급여 × %)">${maxTag}</td>
        <td class="krext-st-act"><span class="krext-plan-acts"><button type="button" data-act="st-edit" data-id="${esc(q.id)}" title="적용월부터 바꾸기 — 참여율 · 월 지급금액 · 제외(0%). 그 앞 달은 그대로">✎</button><button type="button" data-act="st-drop" data-id="${esc(q.id)}" class="${arm(dropKey) ? 'krext-red' : ''}" title="이 사람 빼기(두 번)">${arm(dropKey) ? '정말?' : '×'}</button></span></td>`;
      return `<tr class="krext-st-row" data-id="${esc(q.id)}"><td class="krext-st-nm"><b>${esc(q.name)}</b></td><td class="krext-dim">${esc(q.role)}</td>${cells}</tr>`
        + strip + erpRow + (editing && editing.id === q.id ? formRow(q, months, state) : '');
    }).join('');
    return `<table class="krext-cards krext-st-table"><thead><tr><th>성명</th><th>역할</th><th class="krext-num" title="천원">월급여</th><th>참여</th><th class="krext-num" title="천원">계상인건비</th><th class="krext-num">참여율</th><th></th></tr></thead>
      <tbody>${rows}${editing && editing.id === 'new' ? formRow(null, months, state) : ''}</tbody></table>`;
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
    if (!state.staffAliases) state.staffAliases = {};
    if (!state.staffChanges || typeof state.staffChanges !== 'object') state.staffChanges = {};
    viewOf(state);
    const swallow = (r) => { if (r && r.catch) r.catch(() => {}); };
    const requestSync = () => { try { swallow(chrome.runtime.sendMessage({ type: 'planSyncQueue', reason: 'edit' })); } catch (e) {} };   // 공유 (Plus) 요청(4초 모아서 — 꺼져 있으면 백그라운드가 무시, background.js shareSync)
    const persist = () => { try { const r = S.save(state.staffPlans); if (r && r.then) r.then(requestSync, () => {}); } catch (e) {} };
    const saveView = () => { try { swallow(chrome.storage.local.set({ [VIEW_KEY]: state.staffView })); } catch (e) {} };
    let who = '';   // 계획의 by(누가 고쳤나) — R&D ERP 로그인 이름
    try {
      const r = chrome.storage.local.get(['rndUser', 'staffSyncState', VIEW_KEY, ALIAS_KEY, CHANGES_KEY]);
      if (r && r.then) r.then((l) => {
        who = String((l.rndUser || {}).userNm || '');
        if (l.staffSyncState) state.staffSync = l.staffSyncState;
        if (l[VIEW_KEY] && typeof l[VIEW_KEY] === 'object') { state.staffView = l[VIEW_KEY]; viewOf(state); }
        if (l[ALIAS_KEY] && typeof l[ALIAS_KEY] === 'object') state.staffAliases = l[ALIAS_KEY];
        if (l[CHANGES_KEY] && typeof l[CHANGES_KEY] === 'object') state.staffChanges = l[CHANGES_KEY];
        draw();
        setTimeout(ensureCurrent, 300);
      }, () => {});
    } catch (e) {}
    const touch = (plan) => { plan.at = nowMs(); if (who) plan.by = who; };
    /* 변경이력 한 줄 — 메모리(state.staffChanges)에 바로, 저장소(shareChanges)는 읽어서 합집합으로 덧붙여(다른 창·백그라운드가 같은 키에 쓰는 중일 수 있어 통째로 덮지 않음) 쓰고 공유 요청 */
    const logChange = (prjNo, year, kind, item, before, after) => {
      const e = changeEntry({ kind, item, before, after, by: who });
      const key = S.planKey(prjNo, year);
      state.staffChanges[key] = appendChanges(state.staffChanges[key], e);
      try {
        const r = chrome.storage.local.get(CHANGES_KEY);
        const write = (l) => { const all = Object.assign({}, (l && l[CHANGES_KEY] && typeof l[CHANGES_KEY] === 'object') ? l[CHANGES_KEY] : {}); all[key] = appendChanges(all[key], e); return chrome.storage.local.set({ [CHANGES_KEY]: all }); };
        if (r && r.then) r.then((l) => { const w = write(l); if (w && w.then) w.then(requestSync, () => {}); }, () => swallow(write(null)));
        else swallow(write(null));
      } catch (e2) {}
      return e;
    };
    /* 연차 계획 한 줄 요약(변경이력의 before — 지우기·초기화 때) */
    const planSummary = (plan) => { const st = staffOf(plan); const parts = [plan && Array.isArray(plan.budget) ? `예산 ${plan.budget.length}줄` : '', st ? sumText(st) : '']; return parts.filter(Boolean).join(' · ') || '(없음)'; };
    const setShareMsg = (prjNo, text, error) => { state.staffShareMsg = { prjNo, text, error: !!error }; };
    const projects = () => ((state.data || {}).projects) || [];
    const projectOf = (prjNo) => projects().find((p) => p.prjNo === prjNo) || { prjNo, prjNm: '' };
    const setMsg = (prjNo, year, text, error) => { state.staffMsg = { prjNo, year, text, error: !!error }; };
    const closeForm = () => { state.staffEdit = null; state.staffDraft = null; state.staffError = ''; state.staffAliasEdit = null; state.staffAliasDraft = null; state.staffAliasError = ''; };
    const yearSel = (prjNo) => yearOf(projectOf(prjNo), state);
    const planOf = (prjNo, year, make) => { const key = S.planKey(prjNo, year); let plan = state.staffPlans[key]; if (!plan && make) { plan = planShell(projectOf(prjNo), year, null); state.staffPlans[key] = plan; } return plan || null; };
    const monthsOf = (prjNo, year) => { const per = periodOf(projectOf(prjNo), planOf(prjNo, year), year); return S.ymRange(per.from, per.to); };
    const rowsOf = (prjNo, year) => budgetRows(projectOf(prjNo), planOf(prjNo, year), year, state);
    const payOf = (prjNo, year) => budgetOf(projectOf(prjNo), planOf(prjNo, year), year, rowsOf(prjNo, year).rows);
    const arm = (key) => { const a = state.staffArm; if (a && a.key === key && a.until > nowMs()) { state.staffArm = null; return true; } state.staffArm = { key, until: nowMs() + ARM_MS }; setTimeout(() => { if (state.staffArm && state.staffArm.key === key && state.staffArm.until <= nowMs()) { state.staffArm = null; draw(); } }, ARM_MS + 50); return false; };
    const call = (service, input) => new Promise((res, rej) => { try { chrome.runtime.sendMessage({ type: 'callService', service, input }).then((r) => (r && r.error ? rej(Object.assign(new Error(r.error), { kind: r.kind })) : res(r || {})), rej); } catch (e) { rej(e); } });
    const showing = () => state.page === PAGE;
    /* 보고 있는 과제의 rERP 참여인력을 아직 안 받았으면 받는다 — 화면을 열 때, 과제 칩을 고를 때 */
    const ensureCurrent = () => { if (!showing()) return; const p = projOf(projects(), state); if (p && needRows(p.prjNo)) fetchRows(p.prjNo); };
    /* 사업비 관리 화면 열기/닫기 — 접힌 패널(eClass)이면 펼친다 */
    const openPage = (on) => { state.page = on ? PAGE : ''; closeForm(); if (on && state.collapsed) { state.collapsed = false; try { swallow(chrome.storage.local.set({ panelCollapsed: false })); } catch (e) {} } draw(); if (on) setTimeout(ensureCurrent, 0); };
    setTimeout(ensureCurrent, 1500); setTimeout(ensureCurrent, 6000);   // 패널이 열리며 자료가 늦게 올 수 있어 두 번

    /* rERP 조회 — 참여인력 행 + 사람마다 다른 과제 월별 참여율. 끝나면 이 과제 모든 연차 계획 사람들의 rERP 값(월급여·신청 번호·다른 과제)을 잇는다 */
    async function fetchRows(prjNo, { manual = false } = {}) {
      const cache = state.staffRows[prjNo] = Object.assign({}, state.staffRows[prjNo] || {}, { loading: true, error: '' });
      draw();
      try {
        const data = await call(PART_SVC, { SEARCH_NM: '', SEARCH_GB: '1', PRJ_NO: prjNo });
        const rows = S.rowsOfErp(data.INFO_REC);
        cache.rows = rows; cache.at = nowMs(); cache.others = cache.others || {};
        const by = S.byName(rows);
        const want = new Map();
        for (const h of Object.values(by)) if (h.req && h.seq) want.set(h.seq, h);
        for (const [seq, h] of want) {
          try { cache.others[seq] = S.othersOfErp(await call(OTHERS_SVC, { PRJ_NO: prjNo, REQ_CNT: h.req, SEQ_NO: seq })).rows; } catch (e) { /* 한 사람의 다른 과제 조회 실패는 넘어간다 */ }
        }
        let linked = false;
        for (const plan of Object.values(S.plansOfProject(state.staffPlans, prjNo))) if (plan.people.length) { linkErp(plan, prjNo, by, cache); linked = true; }
        if (linked) { try { swallow(S.save(state.staffPlans)); } catch (e) {} }   // rERP 값만 이은 것 — 동기화 요청은 하지 않는다
        setMsg(prjNo, yearSel(prjNo), manual ? `rERP 참여인력 ${Object.keys(by).length}명을 다시 받았습니다.` : '', false);
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

    /* 바뀐 사람을 그 연차 계획에 — 합이 예산을 넘게 되면 막는다(줄이는 쪽은 둔다) */
    function commit(prjNo, year, before, after, what) {
      const plan = planOf(prjNo, year);
      if (!plan) return false;
      const staff = staffOf(plan);
      const people = plan.people.map((x) => (x.id === before.id ? after : x));
      const budget = payOf(prjNo, year);
      const was = S.overBudget(staff, plan.basis, budget);
      const ob = S.overBudget({ basis: plan.basis, src: plan.src, people }, plan.basis, budget);
      if (ob.over && ob.total > was.total) { setMsg(prjNo, year, `인건비 예산 ${S.thousand(ob.budget)}천원을 넘어 반영하지 않았습니다 — 합 ${S.thousand(ob.total)}천원 (+${S.thousand(ob.total - ob.budget)}천원).`, true); draw(); return false; }
      const sb = S.personStats(before, plan.basis), sa = S.personStats(after, plan.basis);
      plan.people = people; touch(plan);
      closeForm(); persist();
      const moved = JSON.stringify(before.plan) !== JSON.stringify(after.plan);
      logChange(prjNo, year, '연구진', before.name, S.statsText(sb), `${S.statsText(sa)} (${what})`);   // 사람 표의 칸 편집(월급여·계상인건비·참여율)과 ✎ 반영은 모두 여기서 한 번만
      setMsg(prjNo, year, moved ? `${before.name} — ${what}: ${S.statsText(sb)} → ${S.statsText(sa)}` : `${before.name} — ${what}을 바꿨습니다(지급은 그대로).`, false);
      draw();
      return true;
    }
    function applyForm(prjNo, year, id) {
      const plan = planOf(prjNo, year, true);
      const months = monthsOf(prjNo, year);
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
          const ob = S.overBudget({ basis: plan.basis, src: plan.src, people }, plan.basis, payOf(prjNo, year));
          if (ob.over) throw new Error(`인건비 예산 ${S.thousand(ob.budget)}천원을 넘습니다 — 합 ${S.thousand(ob.total)}천원 (+${S.thousand(ob.total - ob.budget)}천원).`);
          if (!plan.people.length) plan.src = 'manual';
          plan.people = people; touch(plan);
          closeForm(); persist();
          logChange(prjNo, year, '연구진', name, '(없음)', `${S.statsText(S.personStats(q, plan.basis))} (더함)`);
          setMsg(prjNo, year, `${name} 을(를) 더했습니다 — ${S.statsText(S.personStats(q, plan.basis))}.`, false); draw();
          return;
        }
        const q = plan.people.find((x) => x.id === id);
        if (!q) return;
        commit(prjNo, year, q, S.applyChange(q, plan.basis, change, months), { rate: '참여율 변경', amt: '월 지급금액 변경', exclude: '제외' }[change.mode] || '변경');
      } catch (e) { state.staffError = String((e && e.message) || e); draw(); }
    }
    /* 초기화 — how 'erp': 그 기간의 rERP 등록 지급계획 그대로 · 'prev': 기간 앞 12달의 rERP 지급 비율(없으면 앞 연차 계획의 비율)로 인건비 예산을 나눔 */
    function initFrom(prjNo, year, how) {
      const p = projectOf(prjNo);
      const plan = planOf(prjNo, year, true);
      const cache = cacheOf(prjNo);
      if (!cache || !cache.rows) { setMsg(prjNo, year, 'rERP 참여인력을 먼저 조회합니다…', false); fetchRows(prjNo).then(() => { if (cacheOf(prjNo) && cacheOf(prjNo).rows) initFrom(prjNo, year, how); }); return; }
      const per = periodOf(p, plan, year);
      const months = S.ymRange(per.from, per.to);
      if (!months.length) { setMsg(prjNo, year, '계획 기간(첫 달·마지막 달)을 먼저 정하세요.', true); draw(); return; }
      let staff = null, note = '';
      if (how === 'erp') {
        staff = S.peopleOfErp(cache.rows, { prjNo, now: cache.at, months });
        if (!staff) { setMsg(prjNo, year, `rERP 에 ${S.ymText(per.from, per.to)} 의 지급계획이 없습니다 — 이전 기간 비율로 초기화하거나 ＋ 연구자로 적으세요.`, true); draw(); return; }
        for (const q of staff.people) if (q.erp && cache.others) q.erp.others = cache.others[q.erp.seq] || [];
        note = `rERP 등록 지급계획(${S.ymText(per.from, per.to)}) 그대로`;
      } else {
        const budget = payOf(prjNo, year);
        if (!(budget > 0)) { setMsg(prjNo, year, '예산 칸의 인건비 줄에 계획(천원)을 먼저 적으세요 — 그 금액을 이전 기간 참여연구원의 지급 비율로 나눕니다.', true); draw(); return; }
        const prevMonths = S.ymRange(S.addMonths(per.from, -12), S.addMonths(per.from, -1));
        const prevText = S.ymText(prevMonths[0], prevMonths[prevMonths.length - 1]);
        let sources = S.sharesOfErp(cache.rows, { prjNo, now: cache.at, months: prevMonths });
        let basisText = `${prevText} 의 rERP 지급 비율`;
        const prevPlan = year > 1 ? staffOf(planOf(prjNo, year - 1)) : null;
        if (!sources.length && prevPlan) { sources = S.sharesOfStaff(prevPlan); basisText = `${S.yearLabel(year - 1)} 계획의 지급 비율`; }
        staff = S.initFromShares(sources, { budgetPay: budget, span: per });
        if (!staff) { setMsg(prjNo, year, `${prevText} 에 rERP 지급이 없고${year > 1 ? ` ${S.yearLabel(year - 1)} 계획도 없어` : ''} 비율을 셈할 수 없습니다 — ＋ 연구자로 적으세요.`, true); draw(); return; }
        for (const q of staff.people) if (q.erp && cache.others) q.erp.others = cache.others[q.erp.seq] || [];
        note = `${basisText}로 인건비 ${S.thousand(budget)}천원을 나눔`;
      }
      const wasStaff = staffOf(plan);
      Object.assign(plan, { from: per.from, to: per.to, basis: staff.basis, src: staff.src, people: staff.people, note }); touch(plan);
      closeForm(); persist();
      logChange(prjNo, year, '연구진', '참여인력 초기화', wasStaff ? sumText(wasStaff) : '(없음)', `${staff.people.length}명 — ${note}`);
      setMsg(prjNo, year, `${S.yearLabel(year)} 참여연구원 ${staff.people.length}명 — ${note}.`, false); draw();
    }
    function setPeriod(prjNo, year, k, v) {
      const plan = planOf(prjNo, year, true);
      const per = periodOf(projectOf(prjNo), plan, year);
      const ym = S.ymOf(v);
      if (!S.isYm(ym)) return;
      plan.from = k === 'from' ? ym : per.from; plan.to = k === 'to' ? ym : per.to;
      if (plan.to && plan.from && plan.to < plan.from) { if (k === 'from') plan.to = plan.from; else plan.from = plan.to; }
      const months = new Set(S.ymRange(plan.from, plan.to));
      for (const q of plan.people) q.plan = q.plan.filter((x) => months.has(x.ym));   // 기간 밖 달은 버린다
      if (plan.from !== per.from || plan.to !== per.to) logChange(prjNo, year, '연구기간', `${S.yearLabel(year)} 계획 기간`, spanText(per) || '(미정)', spanText(plan));
      touch(plan); persist(); draw();
    }
    /* 예산 줄을 처음 고칠 때 기본값(rERP 예산액 · 계획서)을 계획에 옮겨 적는다 — 그 뒤로는 저장된 줄이 기준 */
    function materialize(prjNo, year) {
      const plan = planOf(prjNo, year, true);
      if (!Array.isArray(plan.budget)) plan.budget = rowsOf(prjNo, year).rows.map((r) => ({ name: r.name, plan: r.plan }));
      return plan;
    }
    const syncPay = (plan) => { plan.budgetPay = S.budgetPayOf(plan.budget); };   // 참여인력 칸의 인건비 예산 = 예산 칸의 인건비 줄
    function setBudget(prjNo, year, i, k, v) {
      const plan = materialize(prjNo, year);
      const row = plan.budget[i];
      if (!row) return;
      if (k === 'name') {
        const name = String(v || '').trim().slice(0, 40);
        if (name !== String(row.name || '')) {
          if (!row.name && name) logChange(prjNo, year, '예산', name, '', '(비목 더함)');   // ＋ 비목으로 빈 줄을 만들고 이름을 적는 때
          else logChange(prjNo, year, '예산', `비목 이름`, row.name, name || '(비움)');
        }
        row.name = name;
      } else {
        const t = String(v || '').trim();
        if (t && S.thousandOf(t) == null) { setMsg(prjNo, year, '계획은 천원 단위의 수입니다.', true); draw(); return; }
        const next = t ? S.thousandOf(t) : null;
        if (next !== (row.plan == null ? null : row.plan)) logChange(prjNo, year, '예산', row.name || '비목', thousandText(row.plan), thousandText(next));
        row.plan = next;
      }
      syncPay(plan); touch(plan); persist(); draw();
    }

    host.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-act^="st-"]');
      if (!btn) return;
      ev.preventDefault();
      const act = btn.dataset.act, id = btn.dataset.id || '';
      if (act === 'st-page') { openPage(btn.dataset.page === PAGE); return; }   // 제목 줄 아이콘 · 화면의 돌아가기
      if (act === 'st-proj') {   // 과제 칩
        const prj = btn.dataset.prj; if (!prj) return;
        viewOf(state).prjNo = prj; closeForm(); saveView(); draw(); setTimeout(ensureCurrent, 0);
        return;
      }
      const box = btn.closest('[data-stprj]');
      const prjNo = box ? box.dataset.stprj : '';
      if (!prjNo) return;
      const v = viewOf(state);
      if (act === 'st-year' || act === 'st-year-add') {   // 연차 칩 · ＋ 다음 연차
        const n = Number(btn.dataset.year);
        if (!(n >= 1) || n > S.YEAR_MAX) return;
        if (act === 'st-year-add') v.extra[prjNo] = n;
        v.years[prjNo] = n; closeForm(); saveView(); draw();
        return;
      }
      if (act === 'st-fold') { const c = btn.dataset.card; v.fold[c] = openOf(v, c); saveView(); draw(); return; }   // 펴져 있으면 접음(true), 접혀 있으면 폄(false — 변경이력 카드는 기본 접힘이라 false 를 적어야 펼침)
      const year = Number(box.dataset.styr) || yearSel(prjNo);
      if (act === 'st-alias') { const was = state.staffAliasEdit === prjNo; closeForm(); if (!was) { state.staffAliasEdit = prjNo; state.staffAliasDraft = null; } draw(); const el = host.querySelector('[data-stalias]'); if (el) { el.focus(); el.select(); } }
      else if (act === 'st-alias-cancel') { closeForm(); draw(); }
      else if (act === 'st-alias-set') setAlias(prjNo, state.staffAliasDraft == null ? aliasOf(state, prjNo) : state.staffAliasDraft);
      else if (act === 'st-refresh') fetchRows(prjNo, { manual: true });
      else if (act === 'st-init-erp') initFrom(prjNo, year, 'erp');
      else if (act === 'st-init-prev') initFrom(prjNo, year, 'prev');
      else if (act === 'st-add' || act === 'st-edit') {
        const same = state.staffEdit && state.staffEdit.prjNo === prjNo && state.staffEdit.year === year && state.staffEdit.id === (act === 'st-add' ? 'new' : id);
        if (same) { closeForm(); draw(); return; }
        const months = monthsOf(prjNo, year);
        if (!months.length) { setMsg(prjNo, year, '계획 기간(첫 달·마지막 달)을 먼저 정하세요.', true); draw(); return; }
        const ty = todayYm();
        closeForm();
        state.staffEdit = { prjNo, year, id: act === 'st-add' ? 'new' : id };
        state.staffDraft = { name: '', role: '', manual: '', from: months.includes(ty) ? ty : months[0], to: '', mode: 'rate', value: '' };
        draw();
        const el = host.querySelector(`[data-stf="${act === 'st-add' ? 'name' : 'value'}"]`); if (el) el.focus();
      }
      else if (act === 'st-cancel') { closeForm(); draw(); }
      else if (act === 'st-apply') applyForm(prjNo, year, id);
      else if (act === 'st-drop') {
        if (!arm(`drop:${prjNo}@${year}:${id}`)) { draw(); return; }
        const plan = planOf(prjNo, year); if (!plan) return;
        const q = plan.people.find((x) => x.id === id);
        plan.people = plan.people.filter((x) => x.id !== id); touch(plan);
        if (state.staffEdit && state.staffEdit.id === id) closeForm();
        if (q) logChange(prjNo, year, '연구진', q.name, S.statsText(S.personStats(q, plan.basis)), '(뺌)');
        persist(); setMsg(prjNo, year, q ? `${q.name} 을(를) 뺐습니다.` : '', false); draw();
      }
      else if (act === 'st-clear') {
        if (!arm(`clear:${prjNo}@${year}`)) { draw(); return; }
        closeForm();
        const was = planSummary(planOf(prjNo, year));
        try { const r = S.remove(state.staffPlans, S.planKey(prjNo, year)); if (r && r.then) r.then(requestSync, () => {}); } catch (e) { delete state.staffPlans[S.planKey(prjNo, year)]; }   // 묘비를 남겨 공유 (Plus) 가 다른 사람의 사본도 지우게
        logChange(prjNo, year, '기타', `${S.yearLabel(year)} 계획`, was, '(지움)');
        setMsg(prjNo, year, `${S.yearLabel(year)} 계획을 지웠습니다.`, false); draw();
      }
      else if (act === 'st-share-sync' || act === 'st-share-people' || act === 'st-share-link' || act === 'st-share-copy') {   // 과제 카드 공유 줄 — 백그라운드에 맡기고 결과 한 줄
        if (state.staffShareBusy) return;
        const type = { 'st-share-sync': 'planSync', 'st-share-people': 'shareFolderPeople', 'st-share-link': 'shareOrgLink', 'st-share-copy': 'shareFolderCopy' }[act];
        state.staffShareBusy = prjNo; setShareMsg(prjNo, act === 'st-share-sync' ? '공유 폴더와 맞추는 중…' : act === 'st-share-people' ? '참여인력을 조회해 공유하는 중…' : act === 'st-share-link' ? '조직 내 링크를 만드는 중…' : '주소를 복사하는 중…', false); draw();
        (async () => {
          let r = null;
          try { r = await chrome.runtime.sendMessage(Object.assign({ type, prjNo }, act === 'st-share-sync' ? { reason: 'manual' } : {})); } catch (e) { r = { ok: false, error: String((e && e.message) || e) }; }
          state.staffShareBusy = null;
          if (!r) setShareMsg(prjNo, '응답이 없습니다', true);
          else if (r.skipped) setShareMsg(prjNo, `공유 꺼짐: ${(r.missing || []).join(' · ') || '설정을 확인하세요'}`, true);
          else if (act === 'st-share-sync') { const pg = r.pages && r.pages[prjNo]; setShareMsg(prjNo, pg && pg.error ? `공유 실패: ${pg.error}` : r.ok ? `${pg && pg.created ? '과제 폴더를 만들었습니다' : '맞췄습니다'}${pg && pg.pulled ? ' · 받음' : ''}${pg && pg.pushed ? ' · 씀' : ''}` : `공유 실패: ${r.error || r.message || ''}`, !!(pg && pg.error) || !r.ok); }
          else if (!r.ok) setShareMsg(prjNo, `실패: ${r.message || r.error || '응답 없음'}`, true);
          else if (act === 'st-share-people') setShareMsg(prjNo, r.message || '공유했습니다', false);
          else if (act === 'st-share-link') setShareMsg(prjNo, r.copied ? '조직 내 편집 링크를 복사했습니다' : `링크를 만들었지만 복사하지 못했습니다 · ${r.url || ''}`, !r.copied);
          else setShareMsg(prjNo, r.copied ? (r.what === 'project' ? '과제 폴더 주소를 복사했습니다 — 동료가 설정 › 공유 (Plus) 의 공유 폴더 칸에 붙여 넣으면 같은 파일을 씁니다' : '과제 폴더를 아직 몰라 공유 폴더(밑폴더) 주소를 복사했습니다') : `주소를 복사하지 못했습니다 · ${r.url || ''}`, !r.copied);
          draw();
        })();
      }
      else if (act === 'st-copy' || act === 'st-bcopy') {
        const text = act === 'st-copy' ? (staffOf(planOf(prjNo, year)) ? S.staffTsv(staffOf(planOf(prjNo, year)), planOf(prjNo, year).basis) : '') : budgetTsv(rowsOf(prjNo, year));
        const done = (ok) => { setMsg(prjNo, year, ok ? '표를 복사했습니다.' : '복사하지 못했습니다 — 패널을 한 번 누른 뒤 다시.', !ok); draw(); };
        try { navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); } catch (e) { done(false); }
      }
      else if (act === 'st-badd') {   // 비목 줄 더하기
        const plan = materialize(prjNo, year);
        if (plan.budget.length >= 30) { setMsg(prjNo, year, '비목은 30줄까지입니다.', true); draw(); return; }
        plan.budget.push({ name: '', plan: null }); touch(plan); persist(); draw();
        const el = host.querySelector(`[data-stb="name"][data-i="${plan.budget.length - 1}"]`); if (el) el.focus();
      }
      else if (act === 'st-bdel') {   // 비목 줄 빼기
        const plan = materialize(prjNo, year);
        const i = Number(btn.dataset.i);
        if (!(i >= 0) || i >= plan.budget.length) return;
        const row = plan.budget.splice(i, 1)[0];
        if (row.name || row.plan != null) logChange(prjNo, year, '예산', row.name || '비목', thousandText(row.plan), '(비목 뺌)');
        syncPay(plan); touch(plan); persist(); setMsg(prjNo, year, `${row.name || '비목'} 줄을 뺐습니다.`, false); draw();
      }
      else if (act === 'st-breset') {   // 직접 적은 예산 줄을 지우고 기본값으로
        if (!arm(`breset:${prjNo}@${year}`)) { draw(); return; }
        const plan = planOf(prjNo, year); if (!plan) return;
        const was = Array.isArray(plan.budget) ? S.budgetText(plan.budget) : '';
        plan.budget = null; plan.budgetPay = null; touch(plan); persist();
        logChange(prjNo, year, '예산', '예산 줄', was || '직접 적은 계획', '(기본값으로 — rERP 예산액·계획서)');
        setMsg(prjNo, year, '예산 줄을 기본값으로 되돌렸습니다.', false); draw();
      }
    });
    /* 별칭 정하기 — projectAliases[prjNo](비우면 지움)와 고친 시각 projectAliasesAt[prjNo] 을 저장(공유 (Plus) 병합이 새 쪽을 알게), 그리고 공유 요청 */
    function setAlias(prjNo, value) {
      const alias = String(value || '').trim().slice(0, 20);
      const was = aliasOf(state, prjNo);
      if (alias) state.staffAliases[prjNo] = alias; else delete state.staffAliases[prjNo];
      closeForm();
      if (alias !== was) logChange(prjNo, yearSel(prjNo), '기타', '별칭', was || '(없음)', alias || '(비움)');
      try {
        const r = chrome.storage.local.get(ALIAS_AT_KEY);
        const write = (l) => { const at = Object.assign({}, (l && l[ALIAS_AT_KEY]) || {}); at[prjNo] = nowMs(); return chrome.storage.local.set({ [ALIAS_KEY]: state.staffAliases, [ALIAS_AT_KEY]: at }); };
        if (r && r.then) r.then((l) => { const w = write(l); if (w && w.then) w.then(requestSync, () => {}); }, () => swallow(write(null)));
        else swallow(write(null));
      } catch (e) {}
      draw();
    }
    host.addEventListener('change', (ev) => {
      const el = ev.target;
      if (!el || !el.dataset) return;
      const box = el.closest('[data-stprj]');
      const prjNo = box ? box.dataset.stprj : '';
      if (!prjNo) return;
      const year = Number(box.dataset.styr) || yearSel(prjNo);
      if (el.dataset.stinc) { viewOf(state).inc[el.dataset.stinc] = !!el.checked; saveView(); draw(); return; }   // 집행에 더하기
      if (el.dataset.stp) { setPeriod(prjNo, year, el.dataset.stp, el.value); return; }
      if (el.dataset.stb) { setBudget(prjNo, year, Number(el.dataset.i), el.dataset.stb, el.value); return; }   // 예산 줄(비목 · 계획)
      const k = el.dataset.stc;
      if (!k) return;
      const plan = planOf(prjNo, year);
      const q = plan && plan.people.find((x) => x.id === el.dataset.id);
      if (!q) return;
      try {
        const months = monthsOf(prjNo, year);
        const next = k === 'monthly' ? S.setManual(q, plan.basis, el.value) : k === 'total' ? S.setTotal(q, S.thousandOf(el.value), months) : k === 'rate' ? S.setRate(q, plan.basis, el.value, months) : null;
        if (next) commit(prjNo, year, q, next, { monthly: '월급여', total: '계상인건비', rate: '참여율' }[k]);
      } catch (e) { setMsg(prjNo, year, String((e && e.message) || e), true); draw(); }
    });
    host.addEventListener('input', (ev) => {
      const el = ev.target; if (!el || !el.dataset) return;
      if (el.dataset.stf) (state.staffDraft || (state.staffDraft = {}))[el.dataset.stf] = el.value;
      else if ('stalias' in el.dataset) state.staffAliasDraft = el.value;
    });
    host.addEventListener('keydown', (ev) => {
      const el = ev.target; if (!el || !el.dataset) return;
      const box = el.closest('[data-stprj]'); if (!box) return;
      if ('stalias' in el.dataset) {
        if (ev.key === 'Enter') { ev.preventDefault(); setAlias(box.dataset.stprj, el.value); }
        else if (ev.key === 'Escape') { ev.preventDefault(); closeForm(); draw(); }
        return;
      }
      if (el.dataset.stb && ev.key === 'Enter') { ev.preventDefault(); el.blur(); return; }   // 예산 칸: Enter 로 반영(change)
      if (!el.dataset.stf) return;
      if (ev.key === 'Enter') { ev.preventDefault(); if (state.staffEdit) applyForm(box.dataset.stprj, Number(box.dataset.styr) || yearSel(box.dataset.stprj), state.staffEdit.id); }
      else if (ev.key === 'Escape') { ev.preventDefault(); closeForm(); draw(); }
    });
    // 다른 창(팝업 ↔ eClass)·백그라운드 공유가 바꾼 계획·별칭·공유 결과 반영
    try {
      chrome.storage.onChanged.addListener((ch, area) => {
        try {
          if (area !== 'local') return;
          if (ch[S.KEY]) { state.staffPlans = S.normalizePlans(ch[S.KEY].newValue); draw(); }
          if (ch[ALIAS_KEY]) { state.staffAliases = (ch[ALIAS_KEY].newValue && typeof ch[ALIAS_KEY].newValue === 'object') ? ch[ALIAS_KEY].newValue : {}; draw(); }   // 여기서 고친 것 · 공유 파일에서 받은 것 (background.js shareSync)
          if (ch.staffSyncState) { state.staffSync = ch.staffSyncState.newValue || null; draw(); }   // 공유 (Plus) 결과 (background.js shareSync — shareState 와 같은 내용)
          if (ch[CHANGES_KEY]) { const v = ch[CHANGES_KEY].newValue; state.staffChanges = v && typeof v === 'object' ? v : {}; draw(); }   // 여기서 남긴 것 · 연차 파일에서 받은 것(WORKSPACE 쪽 포함)
        } catch (e) {}
      });
    } catch (e) {}
    return { fetchRows, initFrom, commit, applyForm, openPage, setBudget, setAlias, logChange };
  }

  Object.assign(api, { PAGE, VIEW_KEY, ALIAS_KEY, ALIAS_AT_KEY, CHANGES_KEY, CHANGES_MAX, CHANGE_KINDS, section, bind, aliasOf, periodOf, erpBudgetPay, budgetOf, budgetRows, budgetTsv, yearOf, yearsOf, projOf, adopt, yearState, shortName,
    changeEntry, appendChanges, changesOf, newestFirst, openOf });
  g.KRX_STAFF_UI = api;
})(typeof self !== 'undefined' ? self : this);
