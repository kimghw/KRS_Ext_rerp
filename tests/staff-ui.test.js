/* lib/staff-ui.js (제목 줄 아이콘으로 여는 사업비 관리 화면 — kr_ext_workspace R&D 탭 꼴, 0.8.7) 그리기·보기 상태 테스트 — DOM 없이 section() HTML 과 bind 의 위임 이벤트를 확인한다. 실행: node tests/staff-ui.test.js
 * 과제 칩·별칭, 과제 카드(연차 칩 · 기간 줄), 예산 카드(기본값: 현재 연차 rERP 예산액 · 다른 연차 계획서 · 비목만, 집행 = 승인 + 사용계획 + 미청구, 미청구 보조 줄, 합계, 막대), 참여인력 카드(패널은 WORKSPACE 꼴 보기 + 참여연구원 변경 단추 · 행정지원 구역, 탭(only:'staff')은 칸·✎·기간 구간 줄 · 날짜 폼 · 초과금/부족금), 옛 계획 이동(adopt) */
const TAB = { edit: true, only: 'staff' };   // 참여연구원 변경 탭 — 계획 편집(단추 줄 · 칸 · ✎ · ×)은 여기서만
globalThis.self = globalThis;
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..');
for (const f of ['lib/format.js', 'lib/staff.js', 'lib/staff-ui.js']) require(path.join(root, f));
const S = KRX_STAFF, U = KRX_STAFF_UI;
let n = 0, failed = 0;
const test = (name, fn) => { try { fn(); n++; console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n   ', e.stack || e.message); process.exitCode = 1; } };

const REC = [
  { EMP_NM: '문창재', ROLE_NM: '참여연구원', PAY_LIMT_AMT: '5823000', PAY_AMT: '1165000', PART_RT: '20.01', PLAN_YM_FROM: '202604', PLAN_YM_TO: '202611', NCNT: '8', REQ_CNT: '9', SEQ_NO: '2' },
  { EMP_NM: '문창재', ROLE_NM: '참여연구원', PAY_LIMT_AMT: '5823000', PAY_AMT: '1159000', PART_RT: '19.91', PLAN_YM_FROM: '202612', PLAN_YM_TO: '202612', NCNT: '1', REQ_CNT: '9', SEQ_NO: '2' },
  { EMP_NM: '김거화', ROLE_NM: '과제책임자', PAY_LIMT_AMT: '8480000', PAY_AMT: '2328000', PART_RT: '27.46', PLAN_YM_FROM: '202604', PLAN_YM_TO: '202611', NCNT: '8', REQ_CNT: '9', SEQ_NO: '1' },
  { EMP_NM: '김거화', ROLE_NM: '과제책임자', PAY_LIMT_AMT: '8480000', PAY_AMT: '2322000', PART_RT: '27.39', PLAN_YM_FROM: '202612', PLAN_YM_TO: '202612', NCNT: '1', REQ_CNT: '9', SEQ_NO: '1' },
];
const ITEMS = [{ exp: '인건비', bgt: 31425000, appr: 10000000, req: 500000 }, { exp: '연구수당', bgt: 6000000, appr: 0, req: 0 }, { exp: '연구활동비', bgt: 50000000, appr: 19712839, req: 148500 }, { exp: '간접비', bgt: 20000000, appr: 0, req: 0 }];
const P = { prjNo: '2026-0063-01', prjNm: 'MW급 10kV 고전압 직류 시스템용 반도체 차단기 개발', rspr: '김거화', anl: '1', stDt: '20260401', endDt: '20261231', count: 3, amount: 1200000, budget: { items: ITEMS, bgtAmt: 107425000, apprAmt: 29712839, reqAmt: 648500, unbilled: 1200000 } };
const P2 = { prjNo: '2026-0064-01', prjNm: '선박용 수소 엔진-연료전지 하이브리드 추진 시스템 개발', rspr: '노길태', anl: '2', stDt: '20260101', endDt: '20261231', budget: { items: [{ exp: '인건비', bgt: 78000000, appr: 0 }], bgtAmt: 78000000, apprAmt: 0 } };
const d = { projects: [P, P2] };
const K1 = S.planKey(P.prjNo, 1), K2 = S.planKey(P.prjNo, 2);
const mk = (over = {}) => Object.assign({ staffPlans: {}, staffRows: {}, staffView: { years: {}, extra: {}, inc: { unbilled: true, plan: true }, fold: {} }, research: {}, plans: {} }, over);
const EDIT = { edit: true };
const rec2 = { id: 'mw#2', name: 'MW급', n: 2, rev: 'r2', prjNo: P.prjNo, budget: [{ item: '인건비', plan: 35900000 }, { item: '연구활동비', plan: 66300000 }, { item: '연구수당', plan: 7020000 }, { item: '간접비', plan: 26780000 }] };

test('기간·예산 — 현재 연차는 ERP 연차 기간·인건비 비목, 다른 연차는 12달씩 셈한 기간·예산 없음, 예산 줄이 있으면 그 인건비', () => {
  assert.deepStrictEqual(U.periodOf(P, null), { from: '2026-04', to: '2026-12' });
  assert.deepStrictEqual(U.periodOf(P, null, 2), { from: '2027-01', to: '2027-12' });
  assert.deepStrictEqual(U.periodOf(P, { from: '2027-01', to: '2027-12' }), { from: '2027-01', to: '2027-12' });
  assert.strictEqual(U.erpBudgetPay(P), 31425000, '연구수당은 인건비가 아니다');
  assert.strictEqual(U.budgetOf(P, { budgetPay: 35900000 }), 35900000);
  assert.deepStrictEqual([U.budgetOf(P, null, 1), U.budgetOf(P, null, 2), U.budgetOf(P, null, 2, [{ name: '인건비', plan: 1000 }])], [31425000, null, 1000]);
  assert.deepStrictEqual([U.yearState({ from: '2099-01', to: '2099-12' }), U.yearState({ from: '2000-01', to: '2000-12' }), U.yearState({ from: '2000-01', to: '2099-12' }), U.yearState(null)], ['예정', '지남', '진행 중', '기간 미정']);
  assert.deepStrictEqual([U.shortName('MW급 10kV 고전압 직류'), U.shortName('짧은 이름')], ['MW급 10kV 고전…', '짧은 이름']);
});
test('연차 · 고른 과제 · 옛 계획 이동', () => {
  const st = mk();
  assert.strictEqual(U.projOf(d.projects, st).prjNo, P.prjNo, '고른 과제가 없으면 첫 과제');
  st.staffView.prjNo = P2.prjNo;
  assert.strictEqual(U.projOf(d.projects, st).prjNo, P2.prjNo);
  assert.deepStrictEqual([U.yearOf(P, st), U.yearOf(P2, st)], [1, 2]);
  st.staffView.years[P.prjNo] = 3;
  assert.strictEqual(U.yearOf(P, st), 3);
  assert.deepStrictEqual(U.yearsOf(P, {}, mk()), [1, 2]);
  assert.deepStrictEqual(U.yearsOf(P, { [S.planKey(P.prjNo, 4)]: { prjNo: P.prjNo, year: 4, people: [] } }, mk()), [1, 2, 3, 4]);
  assert.deepStrictEqual(U.yearsOf(P, {}, mk({ staffView: { extra: { [P.prjNo]: 3 } } })), [1, 2, 3]);
  const plans = { [P.prjNo]: { prjNo: P.prjNo, prjNm: 'x', from: '2026-04', to: '2026-12', people: [{ id: 'a', name: '김거화', plan: [] }] } };
  U.adopt(plans, P);
  assert.deepStrictEqual([Object.keys(plans), plans[K1].year], [[K1], 1], '연차 없는 옛 계획은 현재 연차로');
});
test('예산 줄 — 현재 연차: rERP 예산액(같은 비목은 재원을 합침), 집행 = 승인 + 사용계획 + 미청구(연구활동비 줄), 승인전은 더하지 않음; 체크를 끄면 빠짐', () => {
  const st = mk({ plans: { [P.prjNo]: { '10|연구활동비': [{ id: 'a', name: 'x', qty: 1, unit: 300000, amt: 300000, ts: 1 }], '10|인건비': [{ id: 'b', name: 'y', qty: 2, unit: 100000, amt: 200000, ts: 1 }] } } });
  const items2 = ITEMS.concat([{ exp: '연구활동비', res: '20', bgt: 1000000, appr: 1000, req: 0 }]);
  const br = U.budgetRows(Object.assign({}, P, { budget: Object.assign({}, P.budget, { items: items2 }) }), null, 1, st);
  assert.deepStrictEqual([br.src, br.cur, br.rows.map((r) => r.name)], ['erp', true, ['인건비', '연구수당', '연구활동비', '간접비']]);
  const act = br.rows[2];
  assert.deepStrictEqual([act.plan, act.appr, act.req, act.pl, act.ub, act.used, act.left, act.erp], [51000000, 19713839, 148500, 300000, 1200000, 21213839, 29786161, true], '연구활동비: 재원 합침 · 사용계획 · 미청구');
  assert.deepStrictEqual([br.rows[0].pl, br.rows[0].used, br.rows[1].used, br.loose], [200000, 10200000, 0, null]);
  assert.deepStrictEqual([br.sums.plan, br.sums.used, br.sums.left], [108425000, 31413839, 77011161]);
  st.staffView.inc = { unbilled: false, plan: false };
  const br2 = U.budgetRows(P, null, 1, st);
  assert.deepStrictEqual([br2.rows[2].used, br2.rows[0].used, br2.sums.used], [19712839, 10000000, 29712839], '체크를 끄면 승인액만');
  // 연구활동비 줄이 없으면 미청구는 보조 줄로(합계에만)
  st.staffView.inc = { unbilled: true, plan: false };
  const br3 = U.budgetRows(P, { budget: [{ name: '인건비', plan: 1000000 }] }, 1, st);
  assert.deepStrictEqual([br3.src, br3.loose, br3.sums.used, br3.sums.left], ['plan', { amt: 1200000, count: 3 }, 11200000, -10200000]);
  assert.ok(U.budgetTsv(br3).includes('미청구 · 과제카드 3건\t\t1,200\t-1,200') && U.budgetTsv(br3).endsWith('합계\t1,000\t11,200\t-10,200'));
});
test('예산 줄 — 다른 연차: 계획서의 비목별 예산, 없으면 현재 연차 비목 이름만(집행 0); 직접 적은 줄이 있으면 그것', () => {
  const st = mk({ research: { [rec2.id]: rec2 } });
  const br = U.budgetRows(P, null, 2, st);
  assert.deepStrictEqual([br.src, br.cur, br.rec && br.rec.n, br.rows.map((r) => [r.name, r.plan, r.used, r.left])], ['yaml', false, 2, [['인건비', 35900000, 0, 35900000], ['연구활동비', 66300000, 0, 66300000], ['연구수당', 7020000, 0, 7020000], ['간접비', 26780000, 0, 26780000]]]);
  assert.deepStrictEqual([br.sums.plan, br.sums.used, U.budgetOf(P, null, 2, br.rows)], [136000000, 0, 35900000], '참여인력 칸의 인건비 예산은 계획서 인건비');
  const br2 = U.budgetRows(P, null, 3, st);
  assert.deepStrictEqual([br2.src, br2.rows.map((r) => r.name), br2.rows[0].plan, br2.sums.plan], ['default', ['인건비', '연구수당', '연구활동비', '간접비'], null, 0]);
  const br3 = U.budgetRows({ prjNo: 'X', anl: '1' }, null, 2, mk());
  assert.deepStrictEqual(br3.rows.map((r) => r.name), [...S.BUDGET_ITEMS], '비목 정보가 전혀 없으면 여섯 비목');
  const br4 = U.budgetRows(P, { budget: [{ name: '인건비', plan: 40000000 }, { name: '새 비목', plan: null }] }, 2, st);
  assert.deepStrictEqual([br4.src, br4.rows.map((r) => [r.name, r.plan])], ['plan', [['인건비', 40000000], ['새 비목', null]]]);
});
test('화면 — 과제 칩 · 과제 카드 · 연차 칩 · 예산 카드 · 참여인력 카드 (늘 고치기 — 구역 스위치의 사업비 탭은 없음)', () => {
  const st = mk({ staffAliases: { [P.prjNo]: 'SSCB' } });
  const html = U.section(d, {}, st, '<b>T</b>', { tail: '<i>BACK</i>' });
  assert.ok(html.includes('<b>T</b>') && html.includes('<i>BACK</i></div>') && html.includes('krext-ws') && html.includes('krext-st-edit'));
  assert.ok(html.includes('data-act="st-proj" data-prj="2026-0063-01"') && html.includes('krext-ws-proj krext-on" data-act="st-proj" data-prj="2026-0063-01"') && html.includes('>SSCB</button>') && html.includes('>선박용 수소 엔진-연…</button>'), '칩: 별칭 · 과제명 앞부분');
  assert.ok(html.includes('data-stprj="2026-0063-01" data-styr="1"') && html.includes('<b class="krext-ws-name" title="MW급 10kV 고전압 직류 시스템용 반도체 차단기 개발">SSCB</b>') && html.includes('과제 정보') && html.includes('data-act="st-alias"'));
  assert.ok(html.includes('data-act="st-year" data-year="1"') && html.includes('<small>현재</small>') && html.includes('data-year="2"') && html.includes('data-act="st-year-add" data-year="3"'), '연차 칩: 1(현재) · 2 · ＋ 3');
  assert.ok(html.includes('<b>1차년도</b> · <input type="month" data-stp="from" value="2026-04"') && html.includes('R&amp;D ERP 현재 연차'));
  assert.ok(html.includes('data-card="budget"') && html.includes('계획 107,425 · 집행 30,913 (29%)') && html.includes('data-stb="name" data-i="0" value="인건비"') && html.includes('data-stb="plan" data-i="0" value="31,425"'), '예산 카드 머리·칸');
  assert.ok(html.includes('data-stinc="unbilled" checked') && html.includes('data-act="st-bcopy"') && html.includes('rERP 자금현황(원) · 예산 107,425,000') && html.includes('data-act="st-bdel" data-i="3"') && html.includes('data-act="st-badd"'));
  assert.ok(html.includes('<div class="krext-ws-budget-scroll" tabindex="0" role="region" aria-label="비목별 예산 표"><div class="krext-ws-budget-grid"><div class="krext-ws-bhead">'), '예산 금액이 좁은 패널에서도 잘리지 않도록 키보드 스크롤 구역');
  assert.ok(html.includes('data-card="staff"') && html.includes('>계획 없음</span>') && html.includes('data-act="st-tab"') && !html.includes('data-act="st-init-erp"') && !html.includes('data-act="st-add"') && html.includes('<div class="krext-st-sup">') && html.includes('data-act="st-sup-add"') && !html.includes('data-page="staff"'), '참여인력 카드: 참여연구원 변경 단추만(편집 단추 없음) · 행정지원 구역 · 탭으로 가는 링크 없음');
  assert.ok(/표시할 과제가 없습니다/.test(U.section({ projects: [] }, {}, mk(), '')));
});

test('참여인력 변경 탭 — section({ only: "staff" }): 과제 칩·과제 카드 접기·예산·변경이력 없이 과제 머리(이름 · 연차 칩 · 기간 줄)와 접히지 않는 참여인력 카드만, [참여연구원 변경] 단추는 보통 화면의 펼친 카드에만; bind().focus 는 주소의 과제·연차를 보는 상태로 두고 화면을 연다(저장된 staffView 가 뒤늦게 읽혀도 덮지 않음) · openTab 은 백그라운드 openExtTab 에 #tab&page=staff&only=staff&prj&year 주소를 보낸다', () => {
  const st = mk({ staffView: { years: {}, extra: {}, inc: { unbilled: true, plan: true }, fold: { staff: true } } });
  const folded = U.section(d, {}, st, '', EDIT);
  assert.ok(!folded.includes('data-act="st-tab"') && folded.includes('data-act="st-fold" data-card="staff"'), '접힌 카드: 단추는 몸통에 있으므로 없음');
  st.staffView.fold = {};
  const opened = U.section(d, {}, st, '', EDIT);
  assert.ok(opened.includes('data-act="st-tab" title="참여연구원 변경 — 이 과제 1차년도 의 참여연구원 계획(') && opened.includes('>참여연구원 변경 <svg'), '펼친 카드의 단추 하나 — 참여연구원 변경');
  const only = U.section(d, {}, st, '<b>T</b>', { edit: true, only: 'staff', tail: '' });
  assert.ok(only.includes('krext-st-focus') && only.includes('krext-st-only" data-stprj="2026-0063-01" data-styr="1"') && only.includes('<b>T</b>'));
  assert.ok(!only.includes('data-act="st-proj"') && !only.includes('data-card="budget"') && !only.includes('data-card="changes"') && !only.includes('data-card="project"') && !only.includes('data-act="st-tab"') && !only.includes('data-act="st-fold"') && !only.includes('data-act="st-alias"'), '과제 칩 · 과제 카드 접기·별칭 · 예산 · 변경이력 · 단추 없음');
  assert.ok(only.includes('<div class="krext-ws-cardhead krext-ws-pinned">') && only.includes('data-act="st-init-erp"') && only.includes('data-act="st-year" data-year="1"') && only.includes('data-act="st-year-add" data-year="3"') && only.includes('data-stp="from" value="2026-04"') && only.includes('>과제 정보 '), '접히지 않는 참여인력 카드 · 연차 칩 · 기간 줄 · 과제 정보 링크');
  st.staffView.fold = { staff: true };
  assert.ok(U.section(d, {}, st, '', { edit: true, only: 'staff' }).includes('data-act="st-init-erp"'), '접어 둔 상태여도 펼쳐 보임');
  const priorChrome = globalThis.chrome, priorTimeout = globalThis.setTimeout;
  let loaded = null; const sent = [];
  globalThis.chrome = { storage: { local: { get: () => ({ then(ok) { loaded = ok; } }), set: () => {} }, onChanged: { addListener() {} } }, runtime: { getURL: (p) => `chrome-extension://abc/${p}`, sendMessage: (m) => { sent.push(m); return { then() {} }; } } };
  globalThis.setTimeout = () => 0;
  try {
    const st2 = mk({ staffView: { prjNo: P.prjNo, years: { [P.prjNo]: 1 }, extra: {}, inc: {}, fold: {} } });
    const api = U.bind({ addEventListener() {}, contains: () => true, querySelector: () => null }, st2, () => {});
    api.focus({ prjNo: P2.prjNo, year: 2 });
    assert.deepStrictEqual([st2.page, st2.staffView.prjNo, st2.staffView.years[P2.prjNo]], ['staff', P2.prjNo, 2], '주소의 과제·연차로 화면을 염');
    assert.ok(typeof loaded === 'function', 'bind 가 저장된 보기 상태를 읽는 중');
    loaded({ staffView: { prjNo: P.prjNo, years: { [P.prjNo]: 1 } } });
    assert.deepStrictEqual([st2.staffView.prjNo, st2.staffView.years[P2.prjNo], st2.staffView.years[P.prjNo]], [P2.prjNo, 2, 1], '저장된 보기 상태를 읽어도 주소의 과제·연차가 남음');
    api.openTab(P2.prjNo, 2);
    assert.deepStrictEqual(sent[sent.length - 1], { type: 'openExtTab', url: 'chrome-extension://abc/popup/popup.html#tab&page=staff&only=staff&prj=2026-0064-01&year=2' });
  } finally { globalThis.chrome = priorChrome; globalThis.setTimeout = priorTimeout; }
});
test('2차년도 기본 기간·계획서 예산, 직접 적은 줄, 접기, 별칭 폼, rERP 조회 상태, 더하기 폼', () => {
  const st = mk({ research: { [rec2.id]: rec2 } });
  let html = U.section(d, {}, st, '', EDIT);
  assert.ok(html.includes('data-act="st-alias"') && html.includes('data-stp="from" value="2026-04"') && html.includes('data-stp="to" value="2026-12"'));
  assert.ok(html.includes('data-act="st-year-add" data-year="3"') && html.includes('(2028-01 ~ 2028-12)'));
  assert.ok(html.includes('data-stb="name" data-i="0" value="인건비"') && html.includes('data-stb="plan" data-i="0" value="31,425"') && html.includes('data-act="st-bdel" data-i="3"') && html.includes('data-act="st-badd"') && !html.includes('data-act="st-breset"'), '예산 칸·×·＋ 비목 (기본값이라 되돌리기 없음)');
  assert.ok(html.includes('data-act="st-tab"') && !html.includes('data-act="st-add"') && html.includes('rERP 참여인력을 아직 조회하지 않았습니다') && html.includes('<b>참여연구원 변경</b>에서 rERP 현재로'), '패널 카드: 편집 단추 없이 참여연구원 변경 안내');
  assert.ok(U.section(d, {}, st, '', TAB).includes('data-act="st-init-erp"') && U.section(d, {}, st, '', TAB).includes('data-act="st-add"'), '탭: 편집 단추');
  st.staffView.years[P.prjNo] = 2;
  html = U.section(d, {}, st, '', EDIT);
  assert.ok(html.includes('data-styr="2"') && html.includes('data-stp="from" value="2027-01"') && html.includes('data-stb="plan" data-i="0" value="35,900"') && html.includes('계획: 연구개발계획서 2차년도 r2') && html.includes('rERP 자금현황은 현재 연차(1차년도)만'), '2차년도: 12달 뒤 기간, 계획서 예산');
  st.staffPlans[K2] = { prjNo: P.prjNo, year: 2, budget: [{ name: '인건비', plan: 40000000 }], people: [] };
  html = U.section(d, {}, st, '', EDIT);
  assert.ok(html.includes('data-act="st-breset"') && html.includes('계획: 직접 적은 계획') && !html.includes('2차년도 지우기') && U.section(d, {}, st, '', TAB).includes('2차년도 지우기'), '지우기는 탭에만');
  st.staffView.fold = { budget: true, staff: true };
  html = U.section(d, {}, st, '', EDIT);
  assert.ok(html.includes('krext-ws-chev krext-closed') && !html.includes('krext-ws-bhead') && !html.includes('krext-st-status'), '접힌 카드는 머리만');
  st.staffView.fold = {}; st.staffAliasEdit = P.prjNo; st.staffAliasDraft = 'SS';
  html = U.section(d, {}, st, '', EDIT);
  assert.ok(html.includes('data-stalias value="SS"') && html.includes('data-act="st-alias-set"'));
  st.staffAliasEdit = null; st.staffView.years[P.prjNo] = 1;
  st.staffRows[P.prjNo] = { loading: true };
  assert.ok(/조회 중…/.test(U.section(d, {}, st, '', EDIT)));
  st.staffRows[P.prjNo] = { at: 1, rows: S.rowsOfErp(REC), others: {} };
  html = U.section(d, {}, st, '', EDIT);
  assert.ok(/krext-st-status" title="R&amp;D ERP 과제정보 › 참여인력 2명 · 이 기간 지급 2명 · [^"]+ 조회">rERP 2026-0063-01 · /.test(html) && html.includes('krext-st-view') && !html.includes('<b>rERP 현재로</b>') && U.section(d, {}, st, '', TAB).includes('<b>rERP 현재로</b>'), '조회 뒤 패널은 rERP 등록 표(인원은 툴팁), 탭은 rERP 현재로 안내');
  st.staffEdit = { prjNo: P.prjNo, year: 1, id: 'new' }; st.staffDraft = { from: '2026-10', mode: 'rate', value: '20', name: '' };
  assert.ok(!U.section(d, {}, st, '', EDIT).includes('data-stf="name"'), '패널 카드에는 더하기 폼이 뜨지 않음(편집은 탭)');
  html = U.section(d, {}, st, '', TAB);
  assert.ok(html.includes('data-stf="name"') && html.includes('<input type="date" data-stf="from" value="2026-10-01" min="2026-04-01" max="2026-12-31"') && html.includes('type="date" data-stf="to" value=""') && html.includes('data-act="st-apply" data-id="new"') && !html.includes('value="exclude"'), '더하기 폼: 날짜 칸(달만 적은 초안은 1일), 제외가 없다');
});

test('Workspace 과제 머리 — 기본 접힘, 펼치면 메타·링크, 별칭 폼과 연차·기간은 접힌 상태에서도 사용', () => {
  const st = mk({ staffAliases: { [P.prjNo]: 'SSCB' } });
  let html = U.section(d, {}, st, '', EDIT);
  assert.ok(html.includes('data-card="project" aria-expanded="false"') && !html.includes('krext-ws-project-meta'));
  assert.ok(html.includes('data-act="st-proj" data-prj="2026-0063-01" aria-pressed="true"') && html.includes('data-act="st-proj" data-prj="2026-0064-01" aria-pressed="false"'));
  assert.ok(html.includes('data-act="st-year" data-year="1" aria-pressed="true"') && html.includes('data-act="st-year" data-year="2" aria-pressed="false"'));
  assert.ok(/<button type="button" class="krext-ws-cardhead[^>]*data-card="project"/.test(html));
  assert.ok(/<\/button><button type="button" class="krext-ws-edit"/.test(html), '별칭 단추는 접기 단추와 형제');
  st.staffAliasEdit = P.prjNo;
  html = U.section(d, {}, st, '', EDIT);
  assert.ok(html.includes('data-stalias') && html.includes('data-act="st-year"') && html.includes('data-stp="from"') && !html.includes('krext-ws-project-meta'));
  st.staffView.fold.project = false;
  html = U.section(d, {}, st, '', EDIT);
  assert.ok(html.includes('data-card="project" aria-expanded="true"') && html.includes('<dt>과제명</dt><dd>MW급 10kV 고전압 직류 시스템용 반도체 차단기 개발</dd><dt>과제번호</dt><dd>2026-0063-01</dd><dt>책임자</dt><dd>김거화</dd>'));
  assert.ok(html.includes('krext-ws-project-info') && html.includes('krext-ws-links'));
  for (const card of ['budget', 'staff', 'changes']) assert.ok(new RegExp(`<button type="button" class="krext-ws-cardhead" data-act="st-fold" data-card="${card}" aria-expanded="(?:true|false)"`).test(html), '기본 단추의 키보드 접기/펴기');
});
test('참여인력 계획이 있으면 — 카드 머리(연구자 n명 · 초과/부족), 패널 표는 보기만(성명 · 역할 책임/참여 · 월급여 · 참여 · 지급 합 · 참여율 · 월 최대 — WORKSPACE 와 같은 꼴), 탭 표는 칸·역할 선택·✎ ×, 달마다의 지급, rERP 등록(같음/다름), 알림, 예산 칸 인건비 줄의 참여연구원 합 메모', () => {
  const rows = S.rowsOfErp(REC);
  const staff = S.peopleOfErp(rows, { prjNo: P.prjNo, now: 1 });
  staff.people[0].erp.others = [{ ym: '2026-05', rate: 85, amt: 0 }];
  const plan = Object.assign({ prjNo: P.prjNo, year: 1, prjNm: P.prjNm, from: '2026-04', to: '2026-12', budgetPay: null, budget: null, at: 1, by: '김거화', note: 'rERP 등록 지급계획(4~12월) 그대로' }, staff);
  const st = mk({ staffPlans: { [K1]: plan }, staffRows: { [P.prjNo]: { at: 1, rows, others: {} } } });
  const html = U.section(d, {}, st, '', EDIT), tab = U.section(d, {}, st, '', TAB);
  assert.ok(html.includes('krext-ws-state" title="연구자 수 · 행정지원 수 · 인건비 계획 합 31,425 / 예산 31,425천원') && html.includes('>연구자 2명</span>') && html.includes('<span class="krext-badge">2</span>'), '참여인력 카드 머리(WORKSPACE 꼴 — 연구자 n명, 합·예산은 툴팁) · 연차 칩 배지');
  assert.ok(html.includes('참여연구원 계획 합 31,425천원 (계획의 100%)'), '예산 칸 인건비 줄 메모');
  assert.ok(/krext-st-status" title="R&amp;D ERP 과제정보 › 참여인력 2명 · 이 기간 지급 2명 · [^"]+ 조회">rERP 2026-0063-01 · \d\d\.\d\d \d\d:\d\d 조회</.test(html), 'rERP 상태 줄은 과제번호 · 시각 조회(WORKSPACE 와 같은 꼴), 인원은 툴팁');
  const table = html.match(/<table class="krext-cards krext-st-table krext-st-view">[\s\S]*?<\/table>/)[0];
  assert.ok(table.includes('<thead><tr><th class="krext-st-nm">성명</th><th class="krext-st-role-cell">역할</th><th class="krext-num" title="천원">월급여</th><th title="기간 구간 (참여개월 — 일부 달은 날 수 비율)">참여</th><th class="krext-num" title="천원 — 월별 지급의 합(계상인건비)">지급 합</th><th class="krext-num">참여율</th></tr></thead>'), '패널 표 머리글 — 성명 · 역할 · 월급여 · 참여 · 지급 합 · 참여율(✎ × 칸 없음)');
  assert.ok(table.includes('<td class="krext-st-role-cell krext-dim" rowspan="1" title="참여연구원">참여</td>') && table.includes('title="과제책임자">책임</td>'), '역할은 참여 · 책임으로 짧게(저장값은 그대로)');
  assert.ok(table.includes('>5,823</td>') && table.includes('>4~12월 (9개월)</td>') && table.includes('>10,479</td>') && table.includes('>20.00%<span class="krext-st-tag krext-st-maxtag"') && table.includes('월 최대 20.01%') && table.includes('월 최대 27.46%'), '보기 칸: 월급여 · 참여(개월) · 지급 합 · 참여율 · 월 최대');
  assert.ok(!table.includes('data-stc=') && !html.includes('data-act="st-edit"') && !html.includes('data-act="st-drop"') && !html.includes('data-act="st-clear"') && html.includes('data-act="st-copy"') && html.includes('data-act="st-tab"'), '패널 카드에는 칸·✎·×·지우기 없음 — 복사와 참여연구원 변경만');
  assert.ok(tab.includes('data-stc="monthly"') && tab.includes('data-stc="total"') && tab.includes('data-stc="rate"') && tab.includes('data-act="st-edit"') && tab.includes('data-act="st-drop"') && tab.includes('data-act="st-clear"') && !tab.includes('data-act="st-tab"'), '참여연구원 변경 탭: 칸 · ✎ × · 지우기');
  assert.ok(tab.includes('<option value="과제책임자">책임</option><option value="참여연구원" selected>참여</option><option value="행정지원">행정</option>'), '탭의 역할 선택은 책임 · 참여 · 행정');
  assert.ok(html.includes('krext-st-months') && html.includes('4월 <b>1,165</b>') && html.includes('12월 <b>1,159</b>'));
  assert.ok(html.includes('data-act="st-months" aria-pressed="false"') && !html.includes('krext-st-months-open'), '월별 지급은 기본 접힘, 데이터는 유지');
  assert.ok(html.includes('<div class="krext-ws-table-scroll" tabindex="0" role="region" aria-label="참여인력 표"><table class="krext-cards krext-st-table krext-st-view">') && tab.includes('aria-label="참여인력 계획 표"><table class="krext-cards krext-st-table krext-st-editable">'), '좁은 패널에서 사람 표만 키보드 가로 스크롤');
  const staffTools = html.slice(html.indexOf('<span class="krext-sub krext-dim krext-st-status"'), html.indexOf('<div class="krext-ws-table-scroll"'));
  assert.ok(staffTools.includes('class="krext-ico-btn" data-act="st-refresh" aria-label="rERP 참여인력 다시 조회"') && staffTools.includes('data-act="st-months"') && staffTools.includes('class="krext-ico-btn" data-act="st-copy" aria-label="참여인력 표 복사"'), '조회 상태와 새로고침·M·복사는 별도 도구 줄');
  st.staffView.months = true;
  const monthlyHtml = U.section(d, {}, st, '', EDIT);
  assert.ok(monthlyHtml.includes('krext-st-months-open') && monthlyHtml.includes('data-act="st-months" aria-pressed="true"'));
  assert.ok(html.includes('rERP 등록: 4~11월 1,165 · 12월 1,159 · 20.00% (월 최대 20.01%) · 같음'));
  assert.ok(html.includes('문창재 — 5월 참여율 합 105.01% (이 과제 20.01% · rERP 다른 과제 85.00%)'), '100% 초과 알림');
  assert.ok(!html.includes('krext-st-run') && !html.includes('krext-st-sum') && html.includes('4~12월 (9개월)'), 'rERP 그대로면 사람마다 한 줄(자료생성의 마지막 달 잔액 행은 같은 구간)');
  assert.ok(/인건비 합 31,425천원 — 예산과 같습니다/.test(html) && !html.includes('· 부족 ') && !html.includes('· 초과 '), '같으면 머리에 초과·부족 없음');
  plan.people[0] = S.applyChange(plan.people[0], 'rerp', { from: '2026-12', mode: 'exclude' }, S.ymRange('2026-04', '2026-12'));
  const html2 = U.section(d, {}, st, '', EDIT);
  assert.ok(html2.includes('krext-st-off') && html2.includes('12월 <b>—</b>') && html2.includes('· <b>다름</b>') && /부족금 1,159천원/.test(html2) && html2.includes('>연구자 2명 · 부족 1,159</span>') && html2.includes('krext-ws-state krext-st-short'));
  assert.ok(html2.includes('krext-st-run') && html2.includes('12월 (1개월)') && html2.includes('<span class="krext-st-tag">제외</span>') && html2.includes('rowspan="2"') && html2.includes('<small class="krext-st-sum"'), '제외한 12월은 따로 한 줄(구간 둘 — 성명 칸은 rowspan, 연간 합은 성명 밑) — 패널 보기 표에도');
  plan.budget = [{ name: '인건비', plan: 30000000 }]; plan.budgetPay = 30000000;
  const html3 = U.section(d, {}, st, '', EDIT);
  assert.ok(/krext-st-error">인건비 합 30,266천원이 예산 30,000천원을 넘습니다 — 초과금 266천원/.test(html3) && html3.includes('krext-ws-bnote krext-red">참여연구원 계획 합 30,266천원 (계획의 101% · 초과금 266천원)') && html3.includes('>연구자 2명 · 초과 266</span>') && html3.includes('krext-ws-state krext-red'));
});
test('계획이 없는 패널 카드 — rERP 등록 지급계획(이 기간)을 보기 표로 보이고(WORKSPACE 와 같음) 머리는 연구자 n명, 100% 초과 알림만, 복사는 그 표; 탭은 안내와 편집 단추', () => {
  const rows = S.rowsOfErp(REC);
  const st = mk({ data: d, staffRows: { [P.prjNo]: { at: 1, rows, others: {} } }, staffSupport: { [P.prjNo]: { people: [{ name: '조주희', role: '행정 담당', ref: true }], at: 5 } } });
  const html = U.section(d, {}, st, '', EDIT);
  assert.ok(html.includes('>연구자 2명 · 행정 1명</span>') && html.includes('계획이 아직 없어 rERP 등록 지급계획(이 기간)을 보입니다 — 계획은 <b>참여연구원 변경</b>에서 세웁니다') && html.includes('<table class="krext-cards krext-st-table krext-st-view">') && html.includes('title="과제책임자">책임</td>') && html.includes('>10,479</td>') && !html.includes('krext-st-erp'), '머리 · 안내 · 보기 표(rERP 등록 줄은 계획일 때만)');
  assert.ok(!html.includes('<span class="krext-badge">') && !html.includes('참여연구원 계획 합'), '계획은 아니므로 연차 칩 배지·예산 메모 없음');
  const tab = U.section(d, {}, st, '', TAB);
  assert.ok(tab.includes('>행정 1명</span>') && tab.includes('1차년도 인건비 계획이 아직 없습니다. <b>rERP 현재로</b> 를 누르면') && !tab.includes('krext-st-view') && tab.includes('data-act="st-init-erp"'), '탭: 안내와 편집 단추, rERP 표는 보이지 않음');
  withStaffActions(st, ({ click }) => {
    const prior = Object.getOwnPropertyDescriptor(globalThis, 'navigator'); let copied = '';   // Node 21+ 의 navigator 는 setter 없는 getter — defineProperty 로 바꾼다
    Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: (t) => { copied = t; return { then(ok) { ok(); } }; } } }, configurable: true, writable: true });
    try { click('st-copy'); } finally { if (prior) Object.defineProperty(globalThis, 'navigator', prior); else delete globalThis.navigator; }
    const lines = copied.split('\n');
    assert.ok(lines.length === 4 && lines[1].startsWith('문창재\t참여연구원\t5,823') && lines[3].startsWith('조주희\t행정지원\t\t과제 공통'), '복사는 보이는 rERP 등록 표 + 행정지원 줄');
  });
});
test('기간 구간 줄 — 12월부터 참여율을 바꾸면 구간마다 한 줄(4~11월 27.46% · 12월 20.00%), 구간 줄의 칸은 그 구간만 바꾸고, 예산을 넘어도 막지 않고 초과금·부족금을 메시지에', () => {
  const rows = S.rowsOfErp(REC);
  const staff = S.peopleOfErp(rows, { prjNo: P.prjNo, now: 1 });
  const months = S.ymRange('2026-04', '2026-12');
  staff.people[1] = S.applyChange(staff.people[1], 'rerp', { from: '2026-12', mode: 'rate', value: 20 }, months);
  const plan = Object.assign({ prjNo: P.prjNo, year: 1, prjNm: P.prjNm, from: '2026-04', to: '2026-12', budgetPay: null, budget: null, at: 1, by: '', note: '' }, staff);
  const st = mk({ data: d, staffPlans: { [K1]: plan }, staffRows: { [P.prjNo]: { at: 1, rows, others: {} } } });
  let html = U.section(d, {}, st, '', TAB);
  const kim = html.slice(html.indexOf('<b>김거화</b>'));
  assert.ok(html.includes('>연구자 2명 · 부족 626</span>') && U.section(d, {}, st, '', EDIT).includes('>연구자 2명 · 부족 626</span>'), '머리에 부족금 — 탭·패널 같음 (스크린샷의 30,799 / 31,425 는 툴팁)');
  assert.ok(kim.includes('<small class="krext-st-sum" title="연간 — 계상인건비 합 20,320천원 · 참여율 26.63% = 합 ÷ (월급여 × 9개월) · 월 최대 27.46%(2026-04)"><span>합 20,320</span><span>26.63%</span><span>월 최대 27.46%</span></small>'), '연간 합·참여율·월 최대는 성명 밑(조각마다 줄바꿈 없이)');
  assert.ok(kim.includes('4~11월 (8개월)') && kim.includes('data-stc="total" data-id="' + staff.people[1].id + '" data-r="0" value="18,624"') && kim.includes('data-stc="rate" data-id="' + staff.people[1].id + '" data-r="0" value="27.46"'), '첫 구간 줄');
  assert.ok(kim.includes('<tr class="krext-st-row krext-st-run"') && kim.includes('12월 (1개월)') && kim.includes('data-r="1" value="1,696"') && kim.includes('data-r="1" value="20.00"') && !kim.includes('data-r="1" value="20.00" placeholder="—" inputmode="decimal" title="이 구간의 참여율(%) = 계상인건비 ÷ (월급여 × 참여개월), rERP 올림 — 바꾸면 이 구간마다 round천원(월급여 × %)"><span class="krext-st-tag krext-st-maxtag"'), '둘째 구간 줄 — 월 최대 태그는 구간 줄에 없음');
  assert.ok(kim.includes('rERP 등록: 4~11월 2,328 · 12월 2,322 · 27.45% (월 최대 27.46%) · <b>다름</b>'));
  st.staffEdit = { prjNo: P.prjNo, year: 1, id: staff.people[1].id }; st.staffDraft = { from: '2026-12-15', to: '', mode: 'rate', value: '20' };
  html = U.section(d, {}, st, '', TAB);
  assert.ok(!U.section(d, {}, st, '', EDIT).includes('data-stf="from"'), '패널 카드에는 폼이 뜨지 않음');
  assert.ok(html.includes('<input type="date" data-stf="from" value="2026-12-15" min="2026-04-01" max="2026-12-31"') && html.includes('value="exclude"'), '✎ 폼은 적용일·종료일 날짜 칸');
  // bind 의 change — 구간 줄의 참여율 칸은 그 구간만, 예산을 넘어도 반영하고 초과금을 빨갛게
  const listeners = [], writes = [];
  const priorChrome = globalThis.chrome, priorTimeout = globalThis.setTimeout;
  globalThis.chrome = { storage: { local: { get: () => ({}), set: (v) => writes.push(v) }, onChanged: { addListener() {} } }, runtime: { sendMessage: () => ({ then() {} }) } };
  globalThis.setTimeout = () => 0;
  try {
    const host = { addEventListener: (name, fn) => listeners.push([name, fn]), contains: () => true, querySelector: () => null };
    U.bind(host, st, () => {});
    const change = listeners.find((l) => l[0] === 'change')[1];
    const fire = (dataset, value) => change({ target: { dataset, value, closest: () => ({ dataset: { stprj: P.prjNo, styr: '1' } }) } });
    const id = staff.people[1].id;
    fire({ stc: 'rate', id, r: '1' }, '25');
    let s = S.personStats(st.staffPlans[K1].people[1], 'rerp');
    assert.deepStrictEqual([s.runs.map((r) => [S.spanText(r.from, r.to), r.rate]), st.staffMsg.error], [[['4~11월', 27.46], ['12월', 25]], false], '12월 구간만 25%');
    assert.ok(/김거화 — 참여율 12월: .* → .* · 부족금 202천원/.test(st.staffMsg.text), st.staffMsg.text);
    fire({ stc: 'total', id, r: '0' }, '20,000');
    s = S.personStats(st.staffPlans[K1].people[1], 'rerp');
    assert.deepStrictEqual([s.runs.map((r) => r.amt), st.staffMsg.error], [[20000000, 2120000], true], '4~11월 구간만 20,000천원 — 예산을 넘어도 반영');
    assert.ok(/초과금 1,174천원/.test(st.staffMsg.text) && writes.some((w) => w.staffPlans), st.staffMsg.text);
    fire({ stc: 'rate', id }, '27.45');
    s = S.personStats(st.staffPlans[K1].people[1], 'rerp');
    assert.deepStrictEqual([s.runs.length, s.total, st.staffPlans[K1].people[1].cuts], [1, 20952000, []], '구간 번호 없이(사람 줄) 바꾸면 통째로 — 경계도 사라짐');
  } finally { globalThis.chrome = priorChrome; globalThis.setTimeout = priorTimeout; }
});

test('변경이력 — changeEntry(WORKSPACE CHANGE_KINDS 와 같은 칸) · appendChanges(id 합집합 · at 차례 · 최대 500) · newestFirst · changesOf', () => {
  assert.deepStrictEqual(U.CHANGE_KINDS, ['예산', '연구내용', '연구기간', '연구진', '기타']);
  const e = U.changeEntry({ kind: '예산', item: '인건비', before: '31,425천원', after: '35,900천원', by: '김거화', now: Date.UTC(2026, 9, 18, 3) + new Date().getTimezoneOffset() * 60000 });
  assert.ok(/^[a-z0-9]{8,}$/.test(e.id) && e.date === '2026-10-18' && e.kind === '예산' && e.item === '인건비' && e.before === '31,425천원' && e.after === '35,900천원' && e.reason === '' && e.by === '김거화' && e.auto === false && e.at > 0, JSON.stringify(e));
  assert.strictEqual(U.changeEntry({ kind: '엉뚱' }).kind, '기타', '모르는 구분은 기타');
  assert.strictEqual(U.changeEntry({ item: 'x'.repeat(200), before: 'y'.repeat(400) }).item.length, 100);
  const a = { id: 'a', at: 1, date: '2026-10-01' }, b = { id: 'b', at: 3, date: '2026-10-03' }, c = { id: 'c', at: 2, date: '2026-10-02' };
  assert.deepStrictEqual(U.appendChanges([b, a], c).map((x) => x.id), ['a', 'c', 'b'], 'at 차례');
  assert.deepStrictEqual(U.appendChanges([a, b], [{ id: 'b', at: 3, date: '2026-10-03', reason: '사유' }]).map((x) => [x.id, x.reason || '']), [['a', ''], ['b', '사유']], '같은 id 는 칸을 덧씀(합집합)');
  assert.deepStrictEqual(U.appendChanges(null, null), []);
  const many = []; for (let i = 0; i < 520; i++) many.push({ id: `m${i}`, at: i + 10 });
  const capped = U.appendChanges(many, { id: 'new', at: 1 });
  assert.deepStrictEqual([capped.length, capped[0].id, capped[capped.length - 1].id], [500, 'm20', 'm519'], '500 을 넘으면 오래된 것(at 작은 것)부터 버림');
  assert.deepStrictEqual(U.newestFirst([a, b, c, { id: 'd', at: 9, date: '2026-10-03' }]).map((x) => x.id), ['d', 'b', 'c', 'a'], '날짜 역순, 같은 날은 at 큰 것부터');
  assert.deepStrictEqual(U.changesOf({ staffChanges: { [K1]: [a] } }, P.prjNo, 1), [a]);
  assert.deepStrictEqual([U.changesOf({}, P.prjNo, 1), U.changesOf({ staffChanges: { [K1]: 'x' } }, P.prjNo, 1)], [[], []]);
});
test('변경이력 카드 — 기본 접힘, 펼치면 날짜 역순 이벤트와 사유(WORKSPACE 의 auto 줄도), 없으면 안내; openOf 토글 규칙', () => {
  const ch = [
    { id: 'a', date: '2026-10-01', kind: '예산', item: '인건비', before: '31,425천원', after: '35,900천원', reason: '', by: '김거화', at: 1, auto: false },
    { id: 'b', date: '2026-10-05', kind: '연구기간', item: '연구기간', before: '2026-04-01 ~ 2026-12-31', after: '2026-04-01 ~ 2027-03-31', reason: '연장', by: '', at: 2, auto: true },
  ];
  const st = mk({ staffChanges: { [K1]: ch } });
  let html = U.section(d, {}, st, '', EDIT);
  assert.ok(html.includes('data-card="changes"') && html.includes('변경이력') && html.includes('2건 · 마지막 2026-10-05') && !html.includes('krext-ws-changes'), '접힘: 머리만');
  st.staffView.fold.changes = false;
  html = U.section(d, {}, st, '', EDIT);
  const i1 = html.indexOf('2026-10-05'), i2 = html.indexOf('2026-10-01');
  assert.ok(html.includes('<ul class="krext-ws-changes krext-ws-change-list">') && i1 > 0 && i2 > i1, '펼침: 날짜 역순 이벤트');
  assert.ok(html.includes('<span class="krext-ws-change-date">2026-10-01</span><span class="krext-ws-kind">예산</span><strong class="krext-ws-change-title">인건비</strong>') && html.includes('<p class="krext-ws-diff"><s>31,425천원</s><span class="krext-ws-arrow">→</span><b>35,900천원</b></p>') && html.includes('연장') && html.includes('자동</small>'));
  assert.ok(html.includes('<details class="krext-ws-reason" data-streason="b">') && !html.includes('data-streason="a"'), '사유가 있는 변경만 펼침 제공');
  st.staffView.reasons.b = true;
  assert.ok(U.section(d, {}, st, '', EDIT).includes('<details class="krext-ws-reason" data-streason="b" open>'), '다시 그려도 펼친 사유를 유지');
  st.staffView.years[P.prjNo] = 2;
  assert.ok(/변경이력이 없습니다/.test(U.section(d, {}, st, '', EDIT)), '다른 연차는 없음 안내');
  const v = { fold: {} };
  assert.deepStrictEqual([U.openOf(v, 'budget'), U.openOf(v, 'staff'), U.openOf(v, 'changes'), U.openOf(v, 'project')], [true, true, false, false], '기본: 예산·참여인력 펴짐, 과제 정보·변경이력 접힘');
  assert.deepStrictEqual([U.openOf({ fold: { budget: true } }, 'budget'), U.openOf({ fold: { changes: false } }, 'changes'), U.openOf({ fold: { changes: true } }, 'changes')], [false, true, false]);
});
test('공유 줄 — 공유 (Plus) 가 켜져 있을 때만: 폴더 이름 · 폴더 열기 · 참여연구원에게 공유 · 링크 복사 · 주소 복사 · 공유 결과(n명 · 겹침 · 못 찾음); 남의 폴더면 공유 단추 없음; 폴더를 모르면 지금 동기화; 연차 파일 링크', () => {
  const pages = { [P.prjNo]: { prjNo: P.prjNo, title: P.prjNm, folder: 'SSCB', folderUrl: 'https://x.sharepoint.com/personal/u/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fu%2FDocuments%2F%EC%97%85%EB%AC%B4%2Fshared%2FSSCB', webUrl: 'https://x.sharepoint.com/personal/u/Documents/%EC%97%85%EB%AC%B4/shared/SSCB/1%EC%B0%A8%EB%85%84%EB%8F%84.json', years: [1], at: 5,
    share: { shared: [{ name: '문창재', email: 'a@krs.co.kr' }], ambiguous: [{ name: '김철수', candidates: ['김철수(A)', '김철수(B)'] }], notFound: ['홍길동'], role: 'edit', at: 6 } } };
  const st = mk({ staffSync: { at: 5, ok: true, count: 1, base: { path: '/personal/u/Documents/업무/shared' }, pages } });
  st.staffView.fold.project = false;
  const off = U.section(d, {}, st, '', EDIT);
  assert.ok(!off.includes('krext-ws-share') && !off.includes('data-act="st-share-people"') && off.includes('연차 파일'), '꺼짐: 공유 줄 없음(연차 파일 링크는 있음)');
  const on = U.section(d, { plus: { enabled: true } }, st, '', EDIT);
  assert.ok(on.includes('krext-ws-share') && on.includes('<b class="krext-ws-share-f"') && on.includes('>SSCB</b>') && on.includes('폴더 열기') && on.includes('onedrive.aspx?id=') , '폴더 이름 · 열기');
  assert.ok(on.includes('data-act="st-share-people"') && on.includes('data-act="st-share-link"') && on.includes('data-act="st-share-copy"') && !on.includes('data-act="st-share-sync"'));
  assert.ok(on.includes('공유 1명 · 이름 겹침 1 · 못 찾음 1') && on.includes('김철수(김철수(A)/김철수(B))') && on.includes('못 찾음: 홍길동') && !on.includes('a@krs.co.kr'), '공유 결과와 툴팁(이메일은 화면에 안 보임)');
  assert.ok(on.includes(`공유: ${KRX_FMT.fmtClock(5)} · 과제 1개 · /personal/u/Documents/업무/shared`), '바닥 공유 줄은 base 경로·과제 수');
  pages[P.prjNo].owner = '김거화';
  const theirs = U.section(d, { plus: { enabled: true } }, st, '', EDIT);
  assert.ok(theirs.includes('김거화 의 폴더') && !theirs.includes('data-act="st-share-people"') && theirs.includes('data-act="st-share-link"'), '남의 폴더: 참여연구원 공유 단추 없음');
  st.staffSync = { at: 5, ok: true, pages: { [P.prjNo]: { prjNo: P.prjNo, title: P.prjNm, noFolder: true } } };
  const none = U.section(d, { plus: { enabled: true } }, st, '', EDIT);
  assert.ok(none.includes('data-act="st-share-sync"') && none.includes('과제 폴더가 아직 없습니다') && !none.includes('data-act="st-share-people"'), '폴더 없음: 지금 동기화');
  st.staffShareBusy = P.prjNo; st.staffShareMsg = { prjNo: P.prjNo, text: '맞추는 중…', error: false };
  const busy = U.section(d, { plus: { enabled: true } }, st, '', EDIT);
  assert.ok(busy.includes('동기화 중…') && busy.includes('disabled') && busy.includes('krext-ws-share-r">맞추는 중…'));
  st.staffSync = null; st.staffShareBusy = null; st.staffShareMsg = null;
  assert.ok(U.section(d, { plus: { enabled: true } }, st, '', EDIT).includes('과제 폴더를 아직 모릅니다'), '공유 결과가 아직 없어도 줄은 보임');
});

// 통합 인력 표의 이벤트와 저장 결과를 함께 확인한다. 저장소는 매번 실제로 갱신해 다른 과제 보존도 검사한다.
function withStaffActions(st, run, localExtra = {}) {
  const listeners = {}, writes = [], sent = [];
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const local = Object.assign({ projectSupport: clone(st.staffSupport || {}) }, localExtra);
  const priorChrome = globalThis.chrome, priorTimeout = globalThis.setTimeout;
  const thenable = (v) => ({ then: (ok) => thenable(ok ? ok(v) : undefined) });
  let storageChange, draws = 0;
  globalThis.chrome = { storage: { local: { get: () => thenable(clone(local)), set: (v) => { const next = clone(v); writes.push(next); Object.assign(local, next); return thenable(); } }, onChanged: { addListener(fn) { storageChange = fn; } } }, runtime: { sendMessage: (m) => { sent.push(m); return { then() {} }; } } };
  globalThis.setTimeout = () => 0;
  try {
    const host = { addEventListener: (name, fn) => { listeners[name] = fn; }, contains: () => true, querySelector: () => ({ focus() {}, select() {} }) };
    const api = U.bind(host, st, () => { draws++; });
    const project = st.data.projects[0];
    const box = { dataset: { stprj: project.prjNo, styr: '1' } };
    const click = (act, extra) => listeners.click({ target: { closest: () => ({ dataset: Object.assign({ act }, extra || {}), closest: () => box }) }, preventDefault() {} });
    const change = (dataset, value, checked) => listeners.change({ target: { dataset, value, checked, type: checked == null ? 'text' : 'checkbox', closest: () => box } });
    const input = (key, value) => listeners.input({ target: { dataset: { stf: key }, value, closest: () => box } });
    const keydown = (dataset, key) => listeners.keydown({ target: { dataset, value: '', closest: () => box, blur() {} }, key, preventDefault() {} });
    run({ api, box, click, change, input, keydown, writes, sent, local, draws: () => draws, storageChange: (...args) => storageChange(...args) });
  } finally { globalThis.chrome = priorChrome; globalThis.setTimeout = priorTimeout; }
}

test('행정지원 구역 — 참여인력 표 아래 같은 꼴의 표(성명 · 맡은 일 · 공문 참조 · ×)와 사람 더하기 아이콘(WORKSPACE R&D 탭과 같음); 탭의 공통 추가 폼(역할 행정)으로도 등록 — 담당업무·공문 참조·다른 과제 보존, 변경이력·공유 요청, 마지막 삭제의 시각 유지', () => {
  const support = { [P.prjNo]: { people: [{ name: '홍길동', role: '행정 담당', ref: false }], at: 5 }, OTHER: { people: [{ name: '다른 과제 담당자', role: '정산', ref: true }], at: 1 } };
  const st = mk({ data: d, staffSupport: support });
  let html = U.section(d, {}, st, '', EDIT);
  const sup = html.match(/<div class="krext-st-sup">[\s\S]*?<\/table><\/div>/);
  assert.ok(sup && sup[0].includes('<strong title="과제 공통 — 모든 연차에서 함께 관리하며 KRS WORKSPACE 와 공유합니다">행정지원</strong>') && sup[0].includes('class="krext-ico-btn" data-act="st-sup-add"') && sup[0].includes('<table class="krext-cards krext-st-table krext-st-sup-table"><thead><tr><th class="krext-st-nm">성명</th><th>맡은 일</th><th>공문 참조</th><th></th></tr></thead>') && sup[0].includes('<tr class="krext-st-support-row" data-i="0">'), '연구원 계획이 없어도 행정지원 구역(머리 · 더하기 아이콘 · 표)');
  assert.ok(!html.includes('krext-st-support-role') && !html.includes('krext-st-view') && !html.includes('>행정 1명</span>') === false, '참여인력 표에 섞지 않음(계획·rERP 조회가 없으면 참여인력 표 없음) · 머리에 행정 1명');
  assert.ok(html.includes('>행정 1명</span>'));
  assert.ok(html.includes('data-sts="name" data-i="0" value="홍길동"') && html.includes('data-sts="role" data-i="0" value="행정 담당"') && !/data-sts="ref"[^>]*checked/.test(html) && html.includes('data-act="st-sup-del" data-i="0"'), '기존 자유로운 담당업무와 ref=false를 그대로 표시');
  assert.deepStrictEqual(U.supportOf(st, P2.prjNo), { people: [], at: 0 });
  withStaffActions(st, ({ click, change, input, writes, sent, local, draws }) => {
    click('st-add');
    assert.strictEqual(st.staffEdit.id, 'new');
    const beforeDraw = draws();
    change({ stf: 'role' }, '행정지원');
    assert.ok(draws() > beforeDraw && st.staffDraft.role === '행정지원', '역할을 고르면 행정지원 입력칸으로 바로 전환');
    html = U.section(d, {}, st, '', TAB);
    assert.ok(html.includes('data-stf="supportRole"') && html.includes('data-stf="ref"') && !html.includes('data-stf="manual"'), '행정지원은 담당업무·공문 참조로 입력');
    input('name', ' 이몽룡 '); input('supportRole', '연구지원'); change({ stf: 'ref' }, 'on', false);
    click('st-apply', { id: 'new' });
    assert.deepStrictEqual(st.staffSupport[P.prjNo].people, [{ name: '홍길동', role: '행정 담당', ref: false }, { name: '이몽룡', role: '연구지원', ref: false }]);
    assert.strictEqual(st.staffEdit, null);
    assert.deepStrictEqual(st.staffPlans, {}, '지원인력 추가로 빈 연차계획을 만들지 않는다');
    assert.ok(!writes.some((x) => x.staffPlans), '연구원 지급계획을 저장하지 않는다');
    assert.deepStrictEqual(local.projectSupport.OTHER, support.OTHER, '다른 과제의 지원인력도 보존');
    assert.ok(local.projectSupport[P.prjNo].at > 5 && sent.some((m) => m.type === 'planSyncQueue') && st.staffChanges[K1].some((c) => c.item === '행정지원' && /이몽룡 더함/.test(c.after)), '변경 시각 · 공유 요청 · 변경이력');
    change({ sts: 'role', i: '1' }, '구매·정산'); change({ sts: 'ref', i: '1' }, 'on', true);
    assert.deepStrictEqual(st.staffSupport[P.prjNo].people[1], { name: '이몽룡', role: '구매·정산', ref: true });
    change({ sts: 'name', i: '0' }, '   ');
    assert.deepStrictEqual(st.staffSupport[P.prjNo].people.map((p) => p.name), ['이몽룡'], '기존 이름 비우기 동작 유지');
    click('st-sup-del', { i: '0' });
    assert.deepStrictEqual(local.projectSupport[P.prjNo], { people: [], at: st.staffSupport[P.prjNo].at });
    assert.ok(local.projectSupport[P.prjNo].at > 0, '빈 목록도 시각을 남겨 다른 창/WORKSPACE로 삭제를 공유');
  });
});

test('행정지원 사람 더하기 아이콘 — 빈 줄(data-i="new")을 내고 이름을 적으면 저장(맡은 일·공문 참조는 그때까지 임시), 빈 이름은 저장하지 않음, ×·Esc 로 거둠, 중복 이름 거부, 열 명이면 아이콘 비활성', () => {
  const st = mk({ data: d, staffSupport: { [P.prjNo]: { people: [{ name: '홍길동', role: '행정 담당', ref: true }], at: 5 } } });
  withStaffActions(st, ({ click, change, keydown, local, sent }) => {
    click('st-sup-add');
    assert.deepStrictEqual(st.staffSupportNew, { prjNo: P.prjNo, name: '', role: '', ref: true });
    let html = U.section(d, {}, st, '', EDIT);
    assert.ok(html.includes('<tr class="krext-st-support-row" data-i="new">') && html.includes('data-sts="name" data-i="new" value=""') && html.includes('data-sts="ref" data-i="new" checked') && html.includes('data-act="st-sup-del" data-i="new"'), '빈 줄(공문 참조 기본 켜짐)');
    change({ sts: 'role', i: 'new' }, '구매 지원'); change({ sts: 'ref', i: 'new' }, 'on', false);
    assert.deepStrictEqual([st.staffSupportNew.role, st.staffSupportNew.ref, st.staffSupport[P.prjNo].people.length], ['구매 지원', false, 1], '이름 전에는 저장하지 않음');
    change({ sts: 'name', i: 'new' }, '  ');
    assert.strictEqual(st.staffSupport[P.prjNo].people.length, 1, '빈 이름은 그대로');
    change({ sts: 'name', i: 'new' }, '홍 길동');
    assert.ok(st.staffMsg.error && st.staffSupport[P.prjNo].people.length === 1 && st.staffSupportNew, '중복 이름 거부(빈 줄은 남음)');
    change({ sts: 'name', i: 'new' }, ' 이몽룡 ');
    assert.deepStrictEqual(st.staffSupport[P.prjNo].people, [{ name: '홍길동', role: '행정 담당', ref: true }, { name: '이몽룡', role: '구매 지원', ref: false }]);
    assert.strictEqual(st.staffSupportNew, null);
    assert.ok(local.projectSupport[P.prjNo].people.length === 2 && sent.some((m) => m.type === 'planSyncQueue') && st.staffChanges[K1].some((c) => c.item === '행정지원' && /이몽룡 더함/.test(c.after)), '저장 · 공유 요청 · 변경이력');
    click('st-sup-add'); click('st-sup-del', { i: 'new' });
    assert.strictEqual(st.staffSupportNew, null, '× 로 거둠');
    click('st-sup-add'); keydown({ sts: 'name', i: 'new' }, 'Escape');
    assert.strictEqual(st.staffSupportNew, null, 'Esc 로 거둠');
    assert.deepStrictEqual(st.staffSupport[P.prjNo].people.map((p) => p.name), ['홍길동', '이몽룡'], '거둬도 저장된 사람은 그대로');
    const ten = []; for (let i = 0; i < 10; i++) ten.push({ name: `사람${i}`, role: '', ref: true });
    st.staffSupport[P.prjNo] = { people: ten, at: 9 };
    html = U.section(d, {}, st, '', EDIT);
    assert.ok(/data-act="st-sup-add"[^>]*disabled/.test(html), '열 명이면 아이콘 비활성');
    click('st-sup-add');
    assert.ok(!st.staffSupportNew && st.staffMsg.error, '열 명이면 더하지 않음');
  });
});

test('공통 추가 폼 — 기간·지급계획 없는 과제에도 행정지원 등록, 기본 공문 참조 유지, 중복 이름 추가와 기존 이름 변경 차단', () => {
  const p = { prjNo: 'NO-PERIOD', prjNm: '기간 없는 과제', anl: '1' };
  const st = mk({ data: { projects: [p] } });
  withStaffActions(st, ({ click, change, input, local }) => {
    click('st-add');
    assert.ok(st.staffEdit && st.staffEdit.id === 'new', '기간이 없어도 역할을 선택할 수 있다');
    change({ stf: 'role' }, '행정지원'); input('name', '홍길동'); click('st-apply', { id: 'new' });
    assert.deepStrictEqual(st.staffSupport[p.prjNo].people, [{ name: '홍길동', role: '', ref: true }]);
    assert.deepStrictEqual(st.staffPlans, {});
    click('st-add'); change({ stf: 'role' }, '행정지원'); input('name', '홍 길동'); click('st-apply', { id: 'new' });
    assert.strictEqual(st.staffSupport[p.prjNo].people.length, 1);
    assert.ok(st.staffError, '공백을 무시한 같은 이름은 저장 전에 거부');
    input('name', '성춘향'); click('st-apply', { id: 'new' });
    const before = JSON.parse(JSON.stringify(local.projectSupport[p.prjNo]));
    change({ sts: 'name', i: '0' }, '성 춘향');
    assert.deepStrictEqual(st.staffSupport[p.prjNo], before, '기존 이름 중복 편집으로 다른 행을 버리지 않는다');
    assert.deepStrictEqual(local.projectSupport[p.prjNo], before);
    assert.ok(st.staffMsg.error);
  });
});

test('연구원과 행정지원의 총원은 합산하되 지급계획·인건비는 유지 — 과제 공통 지원인력은 다른 연차와 rERP 초기화에도 보존', () => {
  const rows = S.rowsOfErp(REC), staff = S.peopleOfErp(rows, { prjNo: P.prjNo, now: 1 });
  const plan = Object.assign({ prjNo: P.prjNo, year: 1, prjNm: P.prjNm, from: '2026-04', to: '2026-12', budgetPay: null, budget: null, at: 1 }, staff);
  const support = { [P.prjNo]: { people: [{ name: '홍길동', role: '구매지원', ref: false }], at: 5 } };
  const st = mk({ data: d, staffPlans: { [K1]: plan }, staffRows: { [P.prjNo]: { at: 1, rows, others: {} } }, staffSupport: support });
  const beforePeople = JSON.parse(JSON.stringify(plan.people)), beforeSupport = JSON.parse(JSON.stringify(support));
  const html = U.section(d, {}, st, '', { only: 'staff' });
  assert.ok(html.includes('>연구자 2명 · 행정 1명</span>') && html.includes('<strong>3<small>명</small></strong>') && html.includes('연구원 2명 · 행정지원 1명') && html.includes('<strong>31,425<small>천원</small></strong>'), '머리 연구자 2명 · 행정 1명, 요약 총원 3명, 계획 인건비는 연구원 2명의 기존 금액');
  assert.deepStrictEqual(plan.people, beforePeople);
  st.staffView.years[P.prjNo] = 2;
  assert.ok(U.section(d, {}, st, '', { only: 'staff' }).includes('data-sts="name" data-i="0" value="홍길동"'), '계획 없는 다른 연차에도 동일한 행정지원 표시');
  st.staffView.years[P.prjNo] = 1;
  withStaffActions(st, ({ api, click, change, input }) => {
    click('st-add'); change({ stf: 'role' }, '행정지원'); input('name', '문 창재'); click('st-apply', { id: 'new' });
    assert.ok(st.staffError && /이미/.test(st.staffError), '이미 있는 연구원을 행정지원 신규 행으로 중복 추가하지 않는다');
    assert.deepStrictEqual(st.staffPlans[K1].people, beforePeople);
    assert.deepStrictEqual(st.staffSupport, beforeSupport);
    api.initFrom(P.prjNo, 1, 'erp');
    assert.deepStrictEqual(st.staffSupport, beforeSupport, 'rERP 지급계획으로 초기화해도 지원인력 metadata를 보존');
    assert.strictEqual(S.staffTotal(st.staffPlans[K1], 'rerp'), 31425000);
  });
});

test('기존 연구원 역할만 행정지원으로 변경 — 지급계획·ERP 연결·사용자 역할 보존, projectSupport 이동 없음', () => {
  const staff = S.peopleOfErp(S.rowsOfErp(REC), { prjNo: P.prjNo, now: 1 });
  staff.people[0].role = '사용자 지정 역할';
  const plan = Object.assign({ prjNo: P.prjNo, year: 1, prjNm: P.prjNm, from: '2026-04', to: '2026-12', budgetPay: null, budget: null, at: 1 }, staff);
  const st = mk({ data: d, staffPlans: { [K1]: plan } });
  let html = U.section(d, {}, st, '', TAB);
  const id = plan.people[0].id;
  assert.ok(html.includes('data-stc="role" data-id="' + id + '"') && /<option value="사용자 지정 역할"[^>]*selected>사용자 지정 역할</.test(html), '알 수 없는 기존 역할도 선택값으로 보존');
  assert.ok(U.section(d, {}, st, '', EDIT).includes('title="사용자 지정 역할">사용자 지정 역할</td>'), '패널 보기 표는 모르는 역할을 그대로');
  const beforePeople = JSON.parse(JSON.stringify(plan.people));
  withStaffActions(st, ({ change, writes, local }) => {
    change({ stc: 'role', id }, '행정지원');
    assert.deepStrictEqual(st.staffPlans[K1].people[0], Object.assign({}, beforePeople[0], { role: '행정지원' }), '역할 외 person 데이터는 모두 동일');
    assert.deepStrictEqual(st.staffPlans[K1].people[1], beforePeople[1]);
    assert.deepStrictEqual(st.staffSupport, {});
    assert.ok(writes.some((x) => x.staffPlans) && !writes.some((x) => x.projectSupport), '기존 연차계획만 저장하고 과제 공통 지원인력으로 옮기지 않는다');
    assert.deepStrictEqual(local.projectSupport, {});
    assert.strictEqual(S.staffTotal(st.staffPlans[K1], 'rerp'), 31425000);
    html = U.section(d, {}, st, '', TAB);
    assert.ok(/<option value="행정지원"[^>]*selected>행정</.test(html) && !html.includes('krext-st-support-row'), '기존 연구원 행의 역할 표시만 변경');
    const panel = U.section(d, {}, st, '', EDIT);
    assert.ok(panel.includes('title="행정지원">행정</td>') && panel.includes('>연구자 1명 · 행정 1명</span>'), '패널 보기 표는 행정, 머리의 행정 수에 셈');
  });
});

test('통합 인력 표 복사 — 연구원 TSV 유지, 지원인력은 급여 없이 역할·과제 공통·담당업무·공문 참조를 추가하며 지원만 있어도 복사 가능', () => {
  const staff = S.peopleOfErp(S.rowsOfErp(REC), { prjNo: P.prjNo, now: 1 });
  const plan = Object.assign({ prjNo: P.prjNo, year: 1, prjNm: P.prjNm, from: '2026-04', to: '2026-12', at: 1 }, staff);
  const st = mk({ data: d, staffPlans: { [K1]: plan } });
  const original = S.staffTsv(staff, staff.basis);
  assert.strictEqual(U.rosterTsv(plan, st, P.prjNo), original, '지원인력이 없으면 기존 9열 TSV를 그대로 반환');
  assert.strictEqual(U.rosterTsv(null, st, P.prjNo), '');
  st.staffSupport = { [P.prjNo]: { people: [{ name: '홍길동', role: '구매\t지원\n정산', ref: false }, { name: '성춘향', role: '', ref: true }], at: 5 } };
  const exported = U.rosterTsv(plan, st, P.prjNo).split('\n').map((line) => line.split('\t'));
  assert.ok(exported.every((row) => row.length === 11), '탭/개행이 포함된 업무도 TSV 열·행을 깨뜨리지 않는다');
  assert.deepStrictEqual(exported[0].slice(9), ['담당업무', '공문 참조']);
  assert.deepStrictEqual(exported.slice(0, -2).map((row) => row.slice(0, 9).join('\t')), original.split('\n'), '기존 연구원 금액·참여기간·참여율·월별 지급은 그대로');
  assert.ok(exported.slice(1, -2).every((row) => row[9] === '' && row[10] === ''));
  assert.deepStrictEqual(exported.slice(-2), [
    ['홍길동', '행정지원', '', '과제 공통', '', '', '', '', '', '구매 지원 정산', '아니오'],
    ['성춘향', '행정지원', '', '과제 공통', '', '', '', '', '', '', '예'],
  ]);
  assert.deepStrictEqual(U.rosterTsv(null, st, P.prjNo).split('\n'), [exported[0], ...exported.slice(-2)].map((row) => row.join('\t')), '지급계획 없이 지원인력만 있어도 머리글과 지원 행을 복사');
  st.staffPlans = {};
  assert.ok(U.section(d, {}, st, '', { only: 'staff' }).includes('data-act="st-copy"'), '지원인력만 있는 표에도 복사 버튼 표시');
});

test('외부 공유에서 받은 행정지원도 같은 표에 표시 — 담당업무와 ref=false 및 기존 연구원 지급계획 보존', () => {
  const staff = S.peopleOfErp(S.rowsOfErp(REC), { prjNo: P.prjNo, now: 1 });
  const plan = Object.assign({ prjNo: P.prjNo, year: 1, prjNm: P.prjNm, from: '2026-04', to: '2026-12', at: 1 }, staff);
  const st = mk({ data: d, staffPlans: { [K1]: plan } });
  const beforePeople = JSON.parse(JSON.stringify(plan.people));
  withStaffActions(st, ({ storageChange, writes }) => {
    const next = { [P.prjNo]: { people: [{ name: '공유 담당자', role: '외부 사용자 업무', ref: false }], at: 777 } };
    storageChange({ projectSupport: { newValue: next } }, 'local');
    assert.deepStrictEqual(st.staffSupport, next);
    assert.deepStrictEqual(st.staffPlans[K1].people, beforePeople);
    const html = U.section(d, {}, st, '', EDIT);
    assert.ok(html.includes('krext-st-support-row') && html.includes('value="공유 담당자"') && html.includes('value="외부 사용자 업무"') && !/data-sts="ref"[^>]*checked/.test(html));
    assert.ok(!writes.some((x) => x.projectSupport || x.staffPlans), '받은 값을 UI 표시만으로 다시 쓰지 않는다');
  });
});

test('보기 상태 이벤트 — 과제·연차·접기·월별 지급 초점 유지와 저장, 사유는 DOM 유지하며 저장', () => {
  const listeners = {}, writes = [], focused = [];
  const st = mk({ data: d });
  let redraws = 0;
  const priorChrome = globalThis.chrome, priorTimeout = globalThis.setTimeout;
  globalThis.chrome = { storage: { local: { get: () => ({}), set: (value) => writes.push(JSON.parse(JSON.stringify(value))) }, onChanged: { addListener() {} } } };
  globalThis.setTimeout = () => 0;
  try {
    const host = { addEventListener: (name, fn, capture) => { listeners[name] = { fn, capture }; }, contains: (el) => el.connected !== false, querySelector: (selector) => ({ focus: (options) => focused.push({ selector, options, redraws }) }) };
    U.bind(host, st, () => { redraws++; });
    const click = (act, card, extra = {}) => {
      const btn = { dataset: { act, card, ...extra }, closest: () => ({ dataset: { stprj: P.prjNo, styr: '1' } }) };
      listeners.click.fn({ target: { closest: () => btn }, preventDefault() {} });
    };
    click('st-fold', 'project');
    assert.strictEqual(st.staffView.fold.project, false);
    click('st-fold', 'project');
    assert.strictEqual(st.staffView.fold.project, true);
    click('st-months');
    assert.strictEqual(st.staffView.months, true);
    assert.strictEqual(writes[writes.length - 1].staffView.months, true);
    click('st-months');
    assert.strictEqual(st.staffView.months, false);
    assert.strictEqual(redraws, 4);
    assert.deepStrictEqual(focused.map((f) => f.selector), ['[data-act="st-fold"][data-card="project"]', '[data-act="st-fold"][data-card="project"]', '[data-act="st-months"]', '[data-act="st-months"]']);
    assert.ok(focused.every((f, i) => f.redraws === i + 1 && f.options.preventScroll === true), '다시 그린 단추로 스크롤 없이 초점 복원');
    click('st-proj', undefined, { prj: P2.prjNo });
    click('st-year', undefined, { year: '2' });
    click('st-year-add', undefined, { year: '3' });
    assert.deepStrictEqual(focused.slice(4).map((f) => f.selector), ['[data-act="st-proj"][aria-pressed="true"]', '[data-act="st-year"][data-year="2"]', '[data-act="st-year"][data-year="3"]'], '더한 연차는 새로 생긴 연차 단추로 초점 이동');
    assert.strictEqual(st.staffView.prjNo, P2.prjNo);
    assert.strictEqual(st.staffView.extra[P.prjNo], 3);
    assert.strictEqual(listeners.toggle.capture, true, 'details toggle 는 버블링하지 않으므로 캡처');
    const reason = { dataset: { streason: 'change-1' }, open: true };
    listeners.toggle.fn({ target: reason });
    assert.strictEqual(writes[writes.length - 1].staffView.reasons['change-1'], true);
    assert.strictEqual(redraws, 7, '사유를 펴는 동안 초점·DOM 유지');
    const count = writes.length;
    listeners.toggle.fn({ target: reason });
    listeners.toggle.fn({ target: { dataset: { streason: 'change-1' }, open: false, connected: false } });
    assert.strictEqual(writes.length, count, '동일 상태·이전 렌더의 toggle 무시');
    reason.open = false;
    listeners.toggle.fn({ target: reason });
    assert.strictEqual(st.staffView.reasons['change-1'], undefined);
  } finally {
    globalThis.chrome = priorChrome;
    globalThis.setTimeout = priorTimeout;
  }
});

console.log(`\n${n} passed${failed ? `, ${failed} failed` : ''}`);
