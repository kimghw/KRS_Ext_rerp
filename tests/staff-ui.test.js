/* lib/staff-ui.js (사업비 변경 구역, 0.8.7) 그리기 테스트 — DOM 없이 section() 이 만드는 HTML 만 본다(bind 는 브라우저에서). 실행: node tests/staff-ui.test.js */
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
const P = { prjNo: '2026-0063-01', prjNm: 'MW급 10kV 반도체 차단기 개발', rspr: '김거화', anl: '1', stDt: '20260401', endDt: '20261231', budget: { items: [{ exp: '인건비', bgt: 31425000 }, { exp: '연구수당', bgt: 6000000 }, { exp: '연구활동비', bgt: 50000000 }] } };
const d = { projects: [P] };
const mk = (over = {}) => Object.assign({ expanded: new Set(), staffPlans: {}, staffRows: {} }, over);

test('기간·예산 — 저장된 것이 없으면 과제의 연차 기간과 인건비 비목 예산', () => {
  assert.deepStrictEqual(U.periodOf(P, null), { from: '2026-04', to: '2026-12' });
  assert.deepStrictEqual(U.periodOf(P, { from: '2027-01', to: '2027-12' }), { from: '2027-01', to: '2027-12' });
  assert.strictEqual(U.erpBudgetPay(P), 31425000, '연구수당은 인건비가 아니다');
  assert.strictEqual(U.budgetOf(P, { budgetPay: 35900000 }), 35900000);
  assert.strictEqual(U.erpBudgetPay({}), null);
});
test('접힌 줄 — 책임자·과제명·인원·계획 합 / 예산, 계획이 없으면 흐리게', () => {
  const html = U.section(d, {}, mk(), '<span class="krext-switch">SW</span>');
  assert.ok(html.includes('SW') && html.includes('krext-zero') && html.includes('김거화') && html.includes('- / 31,425'));
  assert.ok(html.includes('data-prj="st:2026-0063-01"'));
  assert.ok(!html.includes('krext-prj-body'));
  assert.ok(/표시할 과제가 없습니다/.test(U.section({ projects: [] }, {}, mk(), '')));
});
test('펼친 과제 — 조회 전·조회 중·조회 뒤의 안내와 단추, 폼', () => {
  const st = mk({ expanded: new Set(['st:2026-0063-01']) });
  let html = U.section(d, {}, st, '');
  assert.ok(html.includes('data-stprj="2026-0063-01"') && html.includes('rERP 참여인력을 아직 조회하지 않았습니다') && html.includes('data-act="st-init-erp"') && html.includes('data-act="st-add"'));
  assert.ok(html.includes('value="2026-04"') && html.includes('value="2026-12"') && html.includes('placeholder="31,425"'), '기간은 연차 기간, 예산 칸의 자리글은 인건비 비목');
  st.staffRows['2026-0063-01'] = { loading: true };
  assert.ok(/조회 중…/.test(U.section(d, {}, st, '')));
  st.staffRows['2026-0063-01'] = { at: 1, rows: S.rowsOfErp(REC), others: {} };
  html = U.section(d, {}, st, '');
  assert.ok(html.includes('rERP 참여인력 2명 · 이 기간 지급 2명') && html.includes('<b>rERP 현재로</b>'));
  st.staffEdit = { prjNo: '2026-0063-01', id: 'new' }; st.staffDraft = { from: '2026-10', mode: 'rate', value: '20', name: '' };
  html = U.section(d, {}, st, '');
  assert.ok(html.includes('data-stf="name"') && html.includes('<option value="2026-10" selected>10월</option>') && html.includes('data-act="st-apply" data-id="new"') && !html.includes('value="exclude"'), '더하기 폼에는 제외가 없다');
});
test('계획이 있으면 — 사람 표(칸·월 최대·✎ ×), 달마다의 지급 줄, rERP 등록 줄(같음/다름), 알림, 복사·지우기', () => {
  const rows = S.rowsOfErp(REC);
  const staff = S.peopleOfErp(rows, { prjNo: '2026-0063-01', now: 1 });
  staff.people[0].erp.others = [{ ym: '2026-05', rate: 85, amt: 0 }];
  const plan = Object.assign({ prjNo: '2026-0063-01', prjNm: P.prjNm, from: '2026-04', to: '2026-12', budgetPay: null, at: 1, note: '' }, staff);
  const st = mk({ expanded: new Set(['st:2026-0063-01']), staffPlans: { '2026-0063-01': plan }, staffRows: { '2026-0063-01': { at: 1, rows, others: {} } } });
  const html = U.section(d, {}, st, '');
  assert.ok(html.includes('31,425 / 31,425'), '계획 합 / 예산');
  assert.ok(html.includes('data-stc="monthly"') && html.includes('data-stc="total"') && html.includes('data-stc="rate"') && html.includes('월 최대 20.01%') && html.includes('월 최대 27.46%'));
  assert.ok(html.includes('data-act="st-edit"') && html.includes('data-act="st-drop"') && html.includes('data-act="st-copy"') && html.includes('data-act="st-clear"'));
  assert.ok(html.includes('krext-st-months') && html.includes('4월 <b>1,165</b>') && html.includes('12월 <b>1,159</b>'));
  assert.ok(html.includes('rERP 등록: 4~11월 1,165 · 12월 1,159 · 20.00% (월 최대 20.01%) · 같음'));
  assert.ok(html.includes('문창재 — 5월 참여율 합 105.01% (이 과제 20.01% · rERP 다른 과제 85.00%)'), '100% 초과 알림');
  assert.ok(!html.includes('krext-st-error'), '합 = 예산이라 예산 알림은 없다');
  plan.people[0] = S.applyChange(plan.people[0], 'rerp', { from: '2026-12', mode: 'exclude' }, S.ymRange('2026-04', '2026-12'));
  const html2 = U.section(d, {}, st, '');
  assert.ok(html2.includes('krext-st-off') && html2.includes('12월 <b>—</b>') && html2.includes('· <b>다름</b>') && /남음 1,159천원/.test(html2));
  st.staffEdit = { prjNo: '2026-0063-01', id: plan.people[0].id }; st.staffDraft = { from: '2026-12', mode: 'exclude' };
  assert.ok(U.section(d, {}, st, '').includes('<option value="exclude" selected>제외 (0%)</option>'));
  plan.budgetPay = 30000000;
  assert.ok(/krext-st-error">인건비 합 30,266천원이 예산 30,000천원을 넘습니다/.test(U.section(d, {}, st, '')) && U.section(d, {}, st, '').includes('krext-red" title="인건비 계획 합 / 예산'));
});

console.log(`\n${n} passed${failed ? `, ${failed} failed` : ''}`);
