/* lib/staff.js (사업비 변경 — 참여연구원 참여율·지급액 계산, 0.8.7) 테스트. 실행: node tests/staff.test.js
 * rERP 식(월급여 절삭·계상률 올림·균등 분할 = 자료생성 저장 행), 참여인력 행 → 사람(월별 지급·월급여), 다른 과제 월별 참여율, 형편(연간·월 최대), 적용월부터 바꾸기(앞 달 그대로·제외·구간·더하기),
 * 총액·참여율 통째로·월급여 직접, 이전 기간 비율로 초기화(합 = 예산·잔차), 100% 알림(같은 달은 rERP 값만)·예산 상한, 요약 줄·탭 표, 저장 모양. 어디에도 보내지 않는다 */
globalThis.self = globalThis;
const path = require('path');
const assert = require('assert');
require(path.join(__dirname, '..', 'lib', 'staff.js'));
const S = KRX_STAFF;
let n = 0, failed = 0;
const test = (name, fn) => { try { fn(); n++; console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n   ', e.stack || e.message); process.exitCode = 1; } };

const SPAN = { from: '2026-04', to: '2026-12' };
const Y2 = { from: '2027-01', to: '2027-12' };
// SSCB 1차년도 실측(kr_ext_workspace rerp/reference.md §4) — 월급여 5,823,000 / 8,480,000 · 저장 행 1,165,000×8 + 1,159,000 / 2,328,000×8 + 2,322,000
const REC = [
  { EMP_NM: '문창재', ROLE_NM: '참여연구원', PAY_LIMT_AMT: '5823000', PAY_AMT: '1165000', PART_RT: '20.01', PLAN_YM_FROM: '202604', PLAN_YM_TO: '202611', NCNT: '8', REQ_CNT: '9', SEQ_NO: '2', PARTRATE_YN: 'N', PART_TRM_DT_DTL: '2026-04-01 ~ 2026-12-31', SSN: 'secret', EMP_NO: '1' },
  { EMP_NM: '문창재', ROLE_NM: '참여연구원', PAY_LIMT_AMT: '5823000', PAY_AMT: '1159000', PART_RT: '19.91', PLAN_YM_FROM: '202612', PLAN_YM_TO: '202612', NCNT: '1', REQ_CNT: '9', SEQ_NO: '2', PARTRATE_YN: 'N' },
  { EMP_NM: '김거화', ROLE_NM: '과제책임자', PAY_LIMT_AMT: '8480000', PAY_AMT: '2328000', PART_RT: '27.46', PLAN_YM_FROM: '202604', PLAN_YM_TO: '202611', NCNT: '8', REQ_CNT: '9', SEQ_NO: '1', PARTRATE_YN: 'N' },
  { EMP_NM: '김거화', ROLE_NM: '과제책임자', PAY_LIMT_AMT: '8480000', PAY_AMT: '2322000', PART_RT: '27.39', PLAN_YM_FROM: '202612', PLAN_YM_TO: '202612', NCNT: '1', REQ_CNT: '9', SEQ_NO: '1', PARTRATE_YN: 'N' },
  { EMP_NM: '' },
];
const PERSONS = [
  { name: '김거화', role: '수석', salary: 101763000, pay: 20946000, rate: 27.45, months: 9 },
  { name: '문창재', role: '책임', salary: 69877000, pay: 10479000, rate: 20, months: 9 },
];

test('달·돈', () => {
  assert.deepStrictEqual([S.isYm('2026-04'), S.isYm('2026-13'), S.ymOf('2026-04-01'), S.ymOf('202604'), S.ymOf('')], [true, false, '2026-04', '2026-04', '']);
  assert.deepStrictEqual([S.addMonths('2026-12', 1), S.addMonths('2026-04', -4)], ['2027-01', '2025-12']);
  assert.deepStrictEqual(S.ymRange('2026-11', '2027-02'), ['2026-11', '2026-12', '2027-01', '2027-02']);
  assert.deepStrictEqual([S.ymRange('2026-12', '2026-11'), S.spanMonths(SPAN).length, S.spanMonths({ start: '20260401', end: '20261231' }).length, S.spanMonths({})], [[], 9, 9, []]);
  assert.deepStrictEqual([S.ymText('2026-04', '2026-12'), S.ymText('2026-12', '2026-12'), S.ymText('2026-04', '2027-03'), S.monthLabel('2027-01', '2026-12'), S.monthLabel('2026-05', '2026-04')], ['4~12월', '12월', "'26.4~'27.3월", "'27 1월", '5월']);
  assert.deepStrictEqual([S.money('1,165,000원'), S.money('-1'), S.money(''), S.thousand(10479000), S.thousandOf('10,479'), S.thousandOf('x')], [1165000, null, null, '10,479', 10479000, null]);
});
test('rERP 식 — 월급여 절삭 · 계상률 올림(실측 표) · 참여율의 금액 · 균등 분할 = 저장 행', () => {
  assert.deepStrictEqual([S.monthlyOfSalary(69877000), S.monthlyOfSalary(101763000), S.monthlyOfSalary(0)], [5823000, 8480000, null]);
  assert.deepStrictEqual([S.rerpRate(1165000, 5823000), S.rerpRate(1164000, 5823000), S.rerpRate(1159000, 5823000), S.rerpRate(2328000, 8480000), S.rerpRate(2327000, 8480000)], [20.01, 19.99, 19.91, 27.46, 27.45]);
  assert.deepStrictEqual([S.rerpRate(10479000, 5823000 * 9), S.rerpRate(20946000, 8480000 * 9), S.rerpRate(0, 1), S.rerpRate(1, 0)], [20, 27.45, 0, null]);
  assert.deepStrictEqual([S.amountOfRate(5823000, 20), S.amountOfRate(8480000, 27.45)], [1165000, 2328000]);
  assert.deepStrictEqual(S.splitEven(10479000, 9), [1165000, 1165000, 1165000, 1165000, 1165000, 1165000, 1165000, 1165000, 1159000]);
  assert.deepStrictEqual([S.splitEven(5000, 1), S.splitEven(1000, 3), S.splitEven(-1, 2)], [[5000], [0, 0, 1000], []]);
});
test('참여인력 행 → 사람 — 주민번호는 버리고, 지급기간을 달마다 펼쳐 월별 지급·월급여·신청 번호', () => {
  const rows = S.rowsOfErp(REC);
  assert.strictEqual(rows.length, 4);
  assert.deepStrictEqual(rows[0], { name: '문창재', role: '참여연구원', limit: 5823000, amt: 1165000, rate: 20.01, from: '2026-04', to: '2026-11', count: 8, req: '9', seq: '2', excluded: false, term: '2026-04-01 ~ 2026-12-31' });
  assert.ok(!JSON.stringify(rows).includes('secret') && !('EMP_NO' in rows[0]));
  const by = S.byName(rows);
  assert.deepStrictEqual([by['문창재'].monthly, by['문창재'].total, by['문창재'].req, by['문창재'].seq, by['문창재'].from, by['문창재'].to, by['김거화'].total], [5823000, 10479000, '9', '2', '2026-04', '2026-12', 20946000]);
  const staff = S.peopleOfErp(rows, { prjNo: 'P', now: 5 });
  assert.deepStrictEqual([staff.basis, staff.src, staff.people.map((p) => p.name)], ['rerp', 'erp', ['문창재', '김거화']]);
  const moon = staff.people[0];
  assert.deepStrictEqual([moon.erp.monthly, moon.erp.prjNo, moon.erp.at, moon.erp.req, moon.erp.seq, moon.plan.length, moon.plan[8]], [5823000, 'P', 5, '9', '2', 9, { ym: '2026-12', amt: 1159000 }]);
  const s = S.personStats(moon, 'rerp');
  assert.deepStrictEqual([s.total, s.months, s.from, s.to, s.rate, s.maxRate, s.maxYm, s.limit, s.src], [10479000, 9, '2026-04', '2026-12', 20, 20.01, '2026-04', 5823000, 'rerp']);
  assert.strictEqual(S.monthlyText(moon.plan), '4~11월 1,165 · 12월 1,159');
  const part = S.peopleOfErp(rows, { prjNo: 'P', months: S.ymRange('2026-10', '2026-12') });
  assert.deepStrictEqual(part.people[0].plan.map((x) => x.amt), [1165000, 1165000, 1159000], '달을 주면 그 달들만');
  assert.strictEqual(S.peopleOfErp(rows, { months: S.ymRange('2027-01', '2027-12') }), null, '그 달에 지급이 없으면 null');
  assert.strictEqual(S.peopleOfErp([]), null);
  const o = S.othersOfErp({ STD_AMT: '5823000', REC: [{ PLAN_YM: '202604', ETC_PART_RT: '64.00', ETC_PAY_AMT: '0', SSN: 'secret' }, { PLAN_YM: '' }] });
  assert.deepStrictEqual(o, { std: 5823000, rows: [{ ym: '2026-04', rate: 64, amt: 0 }] });
  assert.deepStrictEqual(S.sharesOfErp(rows, { prjNo: 'P' }).map((x) => [x.name, x.total, x.erp.monthly]), [['문창재', 10479000, 5823000], ['김거화', 20946000, 8480000]]);
});
test('계획서 사람들로 — 첫 달부터 참여개월만큼 균등, 다시 만들면 id·직접 값·rERP 값을 잇는다', () => {
  const s = S.buildStaff(PERSONS, SPAN);
  assert.deepStrictEqual([s.basis, s.src, s.people[0].plan.map((x) => x.amt)], ['plan', 'yaml', [2328000, 2328000, 2328000, 2328000, 2328000, 2328000, 2328000, 2328000, 2322000]]);
  assert.deepStrictEqual([S.personStats(s.people[0], 'plan').rate, S.personStats(s.people[1], 'plan').maxRate], [27.45, 20.01]);
  s.people[1].manual = 6000000;
  s.people[1].plan[8].amt = 1000000;
  const again = S.buildStaff([PERSONS[1], Object.assign({}, PERSONS[0], { pay: 21000000 })], SPAN, s);
  assert.deepStrictEqual([again.people[0].id, again.people[0].manual, again.people[0].plan[8].amt, again.people[1].plan[0].amt], [s.people[1].id, 6000000, 1000000, 2334000]);
  assert.strictEqual(S.buildStaff([], SPAN), null);
});
test('월급여 기준 — 직접 > rERP > 계획서 > (계획서 없으면) rERP, 금액은 그대로', () => {
  const s = S.buildStaff(PERSONS, SPAN);
  const moon = s.people[1];
  assert.deepStrictEqual(S.monthlyPay(moon, 'rerp'), { amt: 5823000, src: 'plan', fallback: true });
  moon.erp = { monthly: 6000000, prjNo: 'P', at: 1, req: '', seq: '', others: [] };
  assert.deepStrictEqual([S.monthlyPay(moon, 'rerp').src, S.monthlyPay(moon, 'plan').src, S.personStats(moon, 'rerp').rate, S.personStats(moon, 'rerp').total], ['rerp', 'plan', 19.41, 10479000]);
  assert.deepStrictEqual(S.monthlyPay(S.normalizePerson({ name: 'x', erp: { monthly: 5000000 } }), 'plan'), { amt: 5000000, src: 'rerp', fallback: false });
  assert.deepStrictEqual([S.setManual(moon, 'plan', '5,900').manual, S.setManual(moon, 'plan', '5,823').manual, S.setManual(Object.assign({}, moon, { manual: 5900000 }), 'plan', '').manual], [5900000, null, null]);
  assert.throws(() => S.setManual(moon, 'plan', 'abc'), /천원 단위의 수/);
});
test('적용월부터 — 앞 달 그대로, 제외, 구간, 더하기, 틀린 값', () => {
  const s = S.buildStaff(PERSONS, SPAN);
  const months = S.spanMonths(SPAN);
  const a = S.applyChange(s.people[1], 'plan', { from: '2026-12', mode: 'rate', value: '10' }, months);
  assert.deepStrictEqual([a.plan[8].amt, S.personStats(a, 'plan').rate, S.personStats(a, 'plan').maxRate, s.people[1].plan[8].amt], [582000, 18.9, 20.01, 1159000]);
  const ex = S.applyChange(s.people[1], 'plan', { from: '2026-12', mode: 'exclude' }, months);
  assert.deepStrictEqual([S.personStats(ex, 'plan').months, S.personStats(ex, 'plan').rate, S.monthlyText(ex.plan)], [8, 20.01, '4~11월 1,165 · 12월 제외']);
  const r = S.applyChange(s.people[0], 'plan', { from: '2026-10', to: '2026-11', mode: 'amt', value: 1000000 }, months);
  assert.strictEqual(S.monthlyText(r.plan), '4~9월 2,328 · 10~11월 1,000 · 12월 2,322');
  const q = S.applyChange(S.normalizePerson({ name: '새사람', manual: 5000000 }), 'plan', { from: '2026-05', mode: 'rate', value: 15 }, months);
  assert.deepStrictEqual([q.plan.length, q.plan[0], S.personStats(q, 'plan').rate], [8, { ym: '2026-05', amt: 750000 }, 15]);
  assert.throws(() => S.applyChange(s.people[1], 'plan', { from: '', mode: 'rate', value: 10 }, months), /적용월을 고르세요/);
  assert.throws(() => S.applyChange(s.people[1], 'plan', { from: '2027-01', mode: 'rate', value: 10 }, months), /기간 밖/);
  assert.throws(() => S.applyChange(s.people[1], 'plan', { from: '2026-12', mode: 'rate', value: 101 }, months), /0~100/);
  assert.throws(() => S.applyChange(S.normalizePerson({ name: 'n' }), 'plan', { from: '2026-12', mode: 'rate', value: 10 }, months), /월급여가 없어/);
  assert.throws(() => S.applyChange(S.normalizePerson({ name: 'n', manual: 1 }), 'plan', { from: '2026-12', mode: 'rate', value: 10 }, []), /기간이 없어/);
  const t = S.setTotal(s.people[1], 9000000);
  assert.deepStrictEqual(t.plan.map((x) => x.amt), Array(9).fill(1000000));
  assert.deepStrictEqual([S.setRate(s.people[1], 'plan', '15', months).plan[0].amt, S.personStats(S.setRate(s.people[1], 'plan', '15', months), 'plan').rate], [873000, 15]);
});
test('이전 기간 비율로 초기화 — 합은 정확히 예산, 모든 달 균등, 직접 값·rERP 값을 잇는다', () => {
  const sources = S.sharesOfErp(S.rowsOfErp(REC), { prjNo: 'P', now: 1 });
  const s = S.initFromShares(sources, { budgetPay: 35900000, span: Y2 });
  assert.deepStrictEqual([s.basis, s.src, s.people.map((p) => p.name)], ['rerp', 'init', ['문창재', '김거화']]);
  const pays = s.people.map((p) => S.personStats(p, 'rerp').total);
  assert.deepStrictEqual([pays, pays[0] + pays[1], s.people[0].plan.length, s.people[0].erp.monthly], [[11971000, 23929000], 35900000, 12, 5823000]);
  assert.deepStrictEqual([S.personStats(s.people[0], 'rerp').rate, S.personStats(s.people[1], 'rerp').rate], [17.14, 23.52]);
  const odd = S.initFromShares([{ name: 'a', total: 1 }, { name: 'b', total: 1 }, { name: 'c', total: 1 }], { budgetPay: 1000000, span: Y2 });
  assert.deepStrictEqual(odd.people.map((p) => p.pay), [334000, 333000, 333000]);
  assert.deepStrictEqual([S.initFromShares(sources, { budgetPay: null, span: Y2 }), S.initFromShares([], { budgetPay: 1, span: Y2 })], [null, null]);
  const prev = S.buildStaff(PERSONS, SPAN); prev.people[0].manual = 8500000;
  assert.strictEqual(S.initFromShares(S.sharesOfStaff(prev), { budgetPay: 1000000, span: Y2 }).people[0].manual, 8500000);
});
test('100% 알림 — 같은 달에 rERP 값이 있으면 그것만, 정확히 100 은 아니고, 예산 초과·남음·월급여 없음', () => {
  const s = S.buildStaff(PERSONS, SPAN);
  s.people[1].erp = { monthly: 5823000, prjNo: 'P', at: 1, req: '9', seq: '2', others: [{ ym: '2026-04', rate: 64, amt: 0 }, { ym: '2026-05', rate: 85, amt: 0 }, { ym: '2026-06', rate: 0, amt: 0 }] };
  const others = S.mergeOthers({ 문창재: [{ ym: '2026-04', rate: 30, label: 'x' }, { ym: '2026-06', rate: 90, label: 'x' }], 김거화: [{ ym: '2026-04', rate: 72.55, label: '차단기 과제' }] }, s);
  assert.deepStrictEqual(others['문창재'].map((o) => [o.ym, o.rate]), [['2026-04', 64], ['2026-05', 85]]);
  const w = S.checks(s, 'plan', { others });
  assert.deepStrictEqual(w.map((x) => [x.kind, x.name]), [['over', '김거화'], ['over', '문창재']]);
  assert.strictEqual(w[0].text, '김거화 — 4월 참여율 합 100.01% (이 과제 27.46% · 차단기 과제 72.55%)');
  assert.strictEqual(w[1].text, '문창재 — 5월 참여율 합 105.01% (이 과제 20.01% · rERP 다른 과제 85.00%)');
  assert.strictEqual(S.checks(s, 'plan', { others: { 김거화: [{ ym: '2026-04', rate: 72.54, label: 'x' }] } }).length, 0);
  assert.deepStrictEqual(S.overBudget(s, 'plan', 31425000), { total: 31425000, budget: 31425000, over: false, left: 0 });
  assert.deepStrictEqual(S.checks(s, 'plan', { budgetPay: 31000000 }).map((x) => x.kind), ['budget']);
  assert.ok(/남음 575천원/.test(S.checks(s, 'plan', { budgetPay: 32000000 })[0].text));
  assert.deepStrictEqual(S.checks(S.normalizeStaff({ people: [{ name: '새사람', plan: [{ ym: '2026-04', amt: 1000 }] }] }), 'plan', {}).map((x) => x.kind), ['salary']);
});
test('글·표·저장 모양', () => {
  const s = S.buildStaff(PERSONS, SPAN);
  const lines = S.staffLines(s, 'plan', { budgetPay: 31425000 });
  assert.strictEqual(lines[0], '■ 참여연구자 (2명) — 월급여 기준: 계획서 연봉 · 인건비 합 31,425천원 (예산 31,425천원)');
  assert.strictEqual(lines[2], '- 문창재 — 책임 · 월급여 5,823천원(계획서) · 4~12월 (9개월) · 계상인건비 10,479천원 · 참여율 20.00% (월 최대 20.01%) · 월별 4~11월 1,165 · 12월 1,159');
  assert.strictEqual(S.staffTsv(s, 'plan').split('\n')[1], ['김거화', '수석', '8,480', '4~12월', '9', '20,946', '27.45%', '27.46%', '4~11월 2,328 · 12월 2,322'].join('\t'));
  assert.deepStrictEqual([S.rateText(20), S.rateText(null), S.statsText(S.personStats(s.people[1], 'plan')), S.statsText(null)], ['20.00%', '', '20.00% · 10,479천원 · 4~12월', '(없음)']);
  const plans = S.normalizePlans({ P1: { prjNo: 'P1', prjNm: 'x', from: '2027-01', to: '2027-12', budgetPay: '35,900,000', people: [{ name: '홍길동', plan: [{ ym: '2027-01', amt: 1 }] }], note: 'n' }, bad: null, P2: { from: 'x', people: [] } });
  assert.deepStrictEqual(Object.keys(plans), ['P1', 'P2']);
  assert.deepStrictEqual([plans.P1.budgetPay, plans.P1.people.length, plans.P1.basis, plans.P2.from, plans.P2.people], [35900000, 1, 'rerp', '', []]);
  const raw = S.normalizeStaff({ basis: 'rerp', src: 'init', people: [{ id: 'a', name: ' 홍 길동 ', rate: 120, months: 0, manual: 0, erp: { monthly: '5,000,000', others: [{ ym: '2026-04', rate: '55' }, { ym: 'bad' }] }, plan: [{ ym: '2026-05', amt: 2 }, { ym: '2026-04', amt: 1 }, { ym: 'x', amt: 1 }] }, { name: '' }, { name: '홍길동' }] });
  assert.deepStrictEqual([raw.people.length, raw.people[0].rate, raw.people[0].months, raw.people[0].manual, raw.people[0].erp.others, raw.people[0].plan.map((x) => x.ym)], [1, null, null, null, [{ ym: '2026-04', rate: 55, amt: 0 }], ['2026-04', '2026-05']]);
  assert.strictEqual(S.normalizeStaff({ people: [] }), null);
});

console.log(`\n${n} passed${failed ? `, ${failed} failed` : ''}`);
