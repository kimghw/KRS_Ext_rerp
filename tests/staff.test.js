/* lib/staff.js (사업비 변경 — 참여연구원 참여율·지급액 계산, 0.8.7) 테스트. 실행: node tests/staff.test.js
 * rERP 식(월급여 절삭·계상률 올림·균등 분할 = 자료생성 저장 행), 참여인력 행 → 사람(월별 지급·월급여), 다른 과제 월별 참여율, 형편(연간·월 최대), 적용일부터 바꾸기(앞 달 그대로·제외·구간·더하기, 날짜까지 — 날 수 비율 조각·기간 구간·경계),
 * 총액·참여율 통째로(구간만도)·월급여 직접, 이전 기간 비율로 초기화(합 = 예산·잔차), 100% 알림(같은 달은 rERP 값만)·예산 대비 초과금·부족금, 요약 줄·탭 표, 저장 모양. 어디에도 보내지 않는다 */
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
  assert.deepStrictEqual([s.total, s.months, s.from, s.to, s.rate, s.maxRate, s.maxYm, s.limit, s.src], [10479000, 9, '2026-04-01', '2026-12-31', 20, 20.01, '2026-04', 5823000, 'rerp']);
  assert.deepStrictEqual([moon.cuts, s.runs.length, s.runs[0].rate], [[], 1, 20], '자료생성의 마지막 달 잔액 행(1,159)은 같은 구간 — 경계 없음');
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
  assert.throws(() => S.applyChange(s.people[1], 'plan', { from: '', mode: 'rate', value: 10 }, months), /적용일을 고르세요/);
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
  assert.ok(/부족금 575천원/.test(S.checks(s, 'plan', { budgetPay: 32000000 })[0].text));
  assert.ok(/초과금 425천원/.test(S.checks(s, 'plan', { budgetPay: 31000000 })[0].text) && /예산과 같습니다/.test(S.checks(s, 'plan', { budgetPay: 31425000 })[0].text));
  assert.deepStrictEqual([S.budgetDiff({ total: 30799000, budget: 31425000 }), S.budgetDiff({ total: 31691000, budget: 31425000 }), S.budgetDiff({ total: 1, budget: null }).kind, S.budgetDiff(null).text], [{ diff: -626000, kind: 'short', text: '부족금 626천원' }, { diff: 266000, kind: 'over', text: '초과금 266천원' }, '', '']);
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

test('날짜까지 — 적용일·종료일로 바꾸면 그 달은 날 수 비율의 조각 둘, 기간 구간(runs)은 경계·제외·끊김에서 갈리고 같은 금액의 온달 경계는 지워진다', () => {
  assert.deepStrictEqual([S.dim('2026-02'), S.dim('2028-02'), S.isYmd('2026-02-29'), S.isYmd('2028-02-29'), S.monthEnd('2026-04'), S.addDays('2026-12-31', 1), S.dayCount('2026-04-15', '2026-04-30')], [28, 29, false, true, '2026-04-30', '2027-01-01', 16]);
  assert.deepStrictEqual([S.dateOf('2026-10-15'), S.dateOf('20261015'), S.dateOf('2026-10'), S.dateOf('2026-10', 'end'), S.dateOf('x'), S.dateOf('2026-02-30')], ['2026-10-15', '2026-10-15', '2026-10-01', '2026-10-31', '', '']);
  assert.deepStrictEqual([S.spanText('2026-04-01', '2026-12-31'), S.spanText('2026-12-01', '2026-12-31'), S.spanText('2026-04-15', '2026-12-31'), S.spanText('2026-12-15', '2026-12-31'), S.spanText('2026-04-15', '2027-03-31'), S.spanText('2026-04', '2026-12'), S.monthsText(8.5333), S.monthsText(9)], ['4~12월', '12월', '4.15~12.31', '12.15~12.31', "'26.4.15~'27.3.31", '4~12월', '8.53', '9']);
  const months = S.spanMonths(SPAN);
  const kim = S.peopleOfErp(S.rowsOfErp(REC), { prjNo: 'P', now: 1 }).people[1];
  // 12월부터 20% — 구간 둘 (사용자 화면: 4~11월 27.46% · 12월 20.00%), 연간 26.63% · 20,320천원 (2026-10-19 스크린샷과 같음)
  const dec = S.applyChange(kim, 'rerp', { from: '2026-12', mode: 'rate', value: 20 }, months);
  const sd = S.personStats(dec, 'rerp');
  assert.deepStrictEqual([dec.cuts, sd.total, sd.rate, sd.runs.map((r) => [S.spanText(r.from, r.to), r.amt, r.rate, r.months, r.off])], [['2026-12-01'], 20320000, 26.63, [['4~11월', 18624000, 27.46, 8, false], ['12월', 1696000, 20, 1, false]]]);
  assert.strictEqual(S.statsText(sd), '26.63% · 20,320천원 · 4~12월 (4~11월 27.46% · 12월 20.00%)');
  // 12월 15일부터 20% — 12월은 1~14일(2,328 × 14/31 → 1,049) · 15~31일(1,696 × 17/31 → 930) 조각 둘, 참여개월은 날 수 비율
  const mid = S.applyChange(kim, 'rerp', { from: '2026-12-15', mode: 'rate', value: 20 }, months);
  assert.deepStrictEqual(mid.plan.slice(-2), [{ ym: '2026-12', amt: 1049000, to: '2026-12-14' }, { ym: '2026-12', amt: 930000, from: '2026-12-15' }]);
  const sm = S.personStats(mid, 'rerp');
  assert.deepStrictEqual([mid.cuts, sm.total, sm.runs.map((r) => [S.spanText(r.from, r.to), r.amt, r.rate, S.monthsText(r.months)]), S.monthlyText(mid.plan)], [['2026-12-15'], 20603000, [['4.1~12.14', 19673000, 27.45, '8.45'], ['12.15~12.31', 930000, 20, '0.55']], '4~11월 2,328 · 12.1~12.14 1,049 · 12.15~12.31 930']);
  assert.deepStrictEqual([S.monthSums(mid.plan).slice(-1), S.sameMonthly(kim.plan, dec.plan), S.sameMonthly(kim.plan, S.applyChange(kim, 'rerp', { from: '2026-12', mode: 'amt', value: 2322000 }, months).plan)], [[['2026-12', 1979000]], false, true], '달 합으로 견준다');
  // 가운데를 날짜로 제외 — 걸치는 조각은 날 수 비율로 잘리고 구간 넷
  const gap = S.applyChange(mid, 'rerp', { from: '2026-07-10', to: '2026-08-20', mode: 'exclude' }, months);
  assert.deepStrictEqual([gap.cuts, S.personStats(gap, 'rerp').runs.map((r) => `${S.spanText(r.from, r.to)} ${r.off ? '제외' : r.amt}`)], [['2026-07-10', '2026-08-21', '2026-12-15'], ['4.1~7.9 7660000', '7.10~8.20 제외', '8.21~12.14 8859000', '12.15~12.31 930000']]);
  // 새 사람을 4월 15일부터 20% — 4월은 16/30 (1,165 → 621), 연간 20.01% · 8.53개월
  const nu = S.applyChange(S.normalizePerson({ name: '새', manual: 5823000 }), 'rerp', { from: '2026-04-15', mode: 'rate', value: 20 }, months);
  const sn = S.personStats(nu, 'rerp');
  assert.deepStrictEqual([nu.plan[0], nu.plan.length, sn.total, sn.rate, S.monthsText(sn.months), nu.cuts, sn.runs.length, S.spanText(sn.from, sn.to)], [{ ym: '2026-04', amt: 621000, from: '2026-04-15' }, 9, 9941000, 20.01, '8.53', [], 1, '4.15~12.31']);
  assert.deepStrictEqual(S.splitByFrac(9941000, nu.plan.map(S.segFrac)), [621000, 1165000, 1165000, 1165000, 1165000, 1165000, 1165000, 1165000, 1165000]);
  assert.deepStrictEqual([S.splitByFrac(10479000, Array(9).fill(1)), S.splitByFrac(1000, [1, 1, 1]), S.splitByFrac(5000, [0.5])], [S.splitEven(10479000, 9), [0, 0, 1000], [5000]]);
  // 구간만 바꾸기 — 그 구간의 조각에만, 12월을 27.45% 로 되돌리면 11월과 같은 금액이라 경계가 지워져 구간 하나
  const t = S.setTotal(dec, 18000000, months, { from: '2026-04-01', to: '2026-11-30' });
  assert.deepStrictEqual([S.personStats(t, 'rerp').runs.map((r) => r.amt), t.plan[8].amt], [[18000000, 1696000], 1696000]);
  const back = S.setRate(dec, 'rerp', 27.45, months, { from: '2026-12-01', to: '2026-12-31' });
  assert.deepStrictEqual([back.cuts, S.personStats(back, 'rerp').runs.length, S.monthlyText(back.plan)], [[], 1, '4~12월 2,328']);
  assert.deepStrictEqual(S.setRate(mid, 'rerp', 20, months).cuts, [], '통째로 바꾸면 경계도 사라진다');
  // rERP 행의 경계 — 지급기간이 정말 바뀐 행(4~9월 2,328 · 10~12월 1,696)은 구간 둘, 모양·경계 다듬기
  const two = S.peopleOfErp(S.rowsOfErp([
    { EMP_NM: '김거화', ROLE_NM: '과제책임자', PAY_LIMT_AMT: '8480000', PAY_AMT: '2328000', PLAN_YM_FROM: '202604', PLAN_YM_TO: '202609', NCNT: '6', REQ_CNT: '9', SEQ_NO: '1' },
    { EMP_NM: '김거화', ROLE_NM: '과제책임자', PAY_LIMT_AMT: '8480000', PAY_AMT: '1696000', PLAN_YM_FROM: '202610', PLAN_YM_TO: '202612', NCNT: '3', REQ_CNT: '9', SEQ_NO: '1' }]), { prjNo: 'P' }).people[0];
  assert.deepStrictEqual([two.cuts, S.personStats(two, 'rerp').runs.map((r) => [S.spanText(r.from, r.to), r.rate])], [['2026-10-01'], [['4~9월', 27.46], ['10~12월', 20]]]);
  // 경계 없는 옛 저장분(0.8.7 — 12월만 바꾼 뒤 저장된 4~11월 2,328 · 12월 1,696)도 온달 금액이 바뀌는 곳에서 두 구간, 균등 분할의 마지막 달 잔액(1,165×8 + 1,159 · 2,328×8 + 2,322)은 한 구간
  const legacy = S.normalizePerson({ name: '김거화', manual: 8480000, plan: months.map((ym) => ({ ym, amt: ym === '2026-12' ? 1696000 : 2328000 })) });
  assert.deepStrictEqual([legacy.cuts, S.personStats(legacy, 'rerp').runs.map((r) => [S.spanText(r.from, r.to), r.amt])], [[], [['4~11월', 18624000], ['12월', 1696000]]]);
  assert.deepStrictEqual(S.personStats(S.setTotal(legacy, 10479000, months), 'rerp').runs.map((r) => r.amt), [10479000], '균등 분할의 잔액 달은 같은 구간');
  assert.deepStrictEqual(S.personStats(S.normalizePerson({ name: 'x', manual: 8480000, plan: months.map((ym, i) => ({ ym, amt: i < 2 ? 2328000 : 2322000 })) }), 'rerp').runs.map((r) => r.amt), [4656000, 16254000], '마지막 달 하나가 아니면 잔액이 아니다');
  const np = S.normalizePlan([{ ym: '2026-12', amt: 1, from: '2026-12-01', to: '2026-12-31' }, { ym: '2026-12', amt: 2, from: '2026-12-15' }, { ym: '2026-11', amt: 3, to: '2026-11-10' }, { ym: '2026-11', amt: 4, from: '2026-11-05', to: '2026-11-20' }, { ym: '2026-11', amt: 5, from: '2026-11-20', to: '2026-11-15' }, { ym: '2026-10', amt: 6, from: '2026-11-01' }]);
  assert.deepStrictEqual(np, [{ ym: '2026-10', amt: 6 }, { ym: '2026-11', amt: 3, to: '2026-11-10' }, { ym: '2026-12', amt: 1 }], '달 전체 from·to 는 지우고, 겹치는 조각은 앞 것만, 거꾸로·다른 달의 날짜는 버린다');
  assert.deepStrictEqual([S.normalizeCuts(['2026-12-15', 'x', '2026-12-01', '2026-12-15']), S.pruneCuts([{ ym: '2026-11', amt: 1 }, { ym: '2026-12', amt: 1 }], ['2026-12-01', '2026-11-01', '2027-01-01']), S.pruneCuts([{ ym: '2026-11', amt: 1 }, { ym: '2026-12', amt: 2 }], ['2026-12-01'])], [['2026-12-01', '2026-12-15'], [], ['2026-12-01']]);
  assert.strictEqual(S.normalizeStaff({ people: [mid] }).people[0].plan.length, mid.plan.length, '저장 모양을 거쳐도 조각이 남는다');
  const tsv = S.staffTsv({ basis: 'rerp', src: 'erp', people: [dec] }, 'rerp').split('\n');
  assert.deepStrictEqual([tsv.length, tsv[1].split('\t').slice(3, 8), tsv[2].split('\t').slice(3, 8)], [3, ['4~11월', '8', '18,624', '27.46%', '27.46%'], ['12월', '1', '1,696', '20.00%', '']], '구간마다 한 줄');
  assert.ok(/구간 4~11월 18,624천원 27.46% · 12월 1,696천원 20.00%/.test(S.staffLines({ basis: 'rerp', src: 'erp', people: [dec] }, 'rerp')[1]));
});

test('연차 — 계획 키 과제번호@연차, 현재 연차 번호, 연차의 달 범위(현재 그대로 · 다음은 종료 다음 달부터 12달 · 앞은 시작 전 달까지 12달), 과제의 연차별 계획', () => {
  const P = { prjNo: 'P', anl: '2', stDt: '20270101', endDt: '20271231' };
  assert.deepStrictEqual([S.planKey('P', 1), S.planKey('P', '3'), S.planKey('P', null), S.planKey('P', 0), S.planKey('P', 999)], ['P@1', 'P@3', 'P', 'P', 'P']);
  assert.deepStrictEqual([S.yearLabel(2), S.anlOf(P), S.anlOf({ anl: '' }), S.anlOf(null), S.anlOf({ anl: '0' })], ['2차년도', 2, 1, 1, 1]);
  assert.deepStrictEqual([S.yearSpan(P, 2), S.yearSpan(P, 3), S.yearSpan(P, 4), S.yearSpan(P, 1), S.yearSpan(P, undefined)], [{ from: '2027-01', to: '2027-12' }, { from: '2028-01', to: '2028-12' }, { from: '2029-01', to: '2029-12' }, { from: '2026-01', to: '2026-12' }, { from: '2027-01', to: '2027-12' }]);
  assert.deepStrictEqual(S.yearSpan({ prjNo: 'Q', anl: '1', stDt: '20260401', endDt: '20261231' }, 2), { from: '2027-01', to: '2027-12' }, '첫 연차가 9달이어도 다음 연차는 종료 다음 달부터 12달');
  assert.deepStrictEqual([S.yearSpan({ anl: '1' }, 2), S.yearSpan({ anl: '1', stDt: '20261231', endDt: '20260101' }, 1)], [{ from: '', to: '' }, { from: '', to: '' }]);
  const plans = { 'P@1': { prjNo: 'P', year: 1 }, 'P@2': { prjNo: 'P', year: 2 }, P: { prjNo: 'P' }, 'Q@1': { prjNo: 'Q', year: 1 } };
  assert.deepStrictEqual(Object.keys(S.plansOfProject(plans, 'P')), ['1', '2']);
  assert.deepStrictEqual(S.plansOfProject(null, 'P'), {});
  const norm = S.normalizePlans({ 'P@2': { prjNm: 'x', people: [{ name: '홍길동', plan: [{ ym: '2027-01', amt: 1 }] }] }, 'P@1': { prjNo: 'P', year: '1' }, P: { prjNo: 'P' }, 'R@9': { prjNo: 'R', year: 3 } });
  assert.deepStrictEqual(Object.keys(norm).sort(), ['P', 'P@1', 'P@2', 'R@3'], '과제번호·연차가 빠지면 키에서, 있으면 값이 앞선다');
  assert.deepStrictEqual([norm['P@2'].prjNo, norm['P@2'].year, norm['P@2'].people.length, norm['P@1'].year, norm.P.year], ['P', 2, 1, 1, null]);
});

test('역할 짧은 이름(roleShort) — 과제책임자 → 책임 · 참여연구원 → 참여 · 행정지원 → 행정, 책임·행정이 든 다른 역할명도 그것, 그 밖은 그대로, 빈 값은 빈 글', () => {
  assert.deepStrictEqual(['과제책임자', '참여연구원', '행정지원', ' 참여연구원 ', '실무책임자', '행정 담당', '연구보조원', '', null].map(S.roleShort), ['책임', '참여', '행정', '참여', '책임', '행정', '연구보조원', '', '']);
});

console.log(`\n${n} passed${failed ? `, ${failed} failed` : ''}`);
