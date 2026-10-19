/* lib/staff-sync.js (공유 (Plus) — 사업비 참여연구원 계획 병합 규칙, 0.8.7) 테스트: plansOf, 연차별 at 병합·묘비, gcTomb, delSlice/putBack. 원노트 페이지 부분은 0.8.7 에서 걷어 냄(2026-10-18) — 파일 쪽은 lib/prjdoc*.js 테스트. 실행: node tests/staff-sync.test.js */
globalThis.self = globalThis;
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..');
for (const f of ['lib/format.js', 'lib/staff.js', 'lib/staff-sync.js']) require(path.join(root, f));
const S = KRX_STAFF, Y = KRX_STAFF_SYNC;
let n = 0, failed = 0;
const test = async (name, fn) => { try { await fn(); n++; console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n   ', e.stack || e.message); process.exitCode = 1; } };

const person = (name, amts, monthly) => S.normalizePerson({ id: name, name, role: '연구원', manual: monthly, plan: amts.map((amt, i) => ({ ym: `2026-${String(i + 4).padStart(2, '0')}`, amt })) });
const plan = (prjNo, year, at, people, extra) => Object.assign({ prjNo, year, prjNm: '과제', from: '2026-04', to: '2026-12', budgetPay: 31425000, basis: 'rerp', src: 'erp', people, at, by: '김거화', note: 'n' }, extra || {});
const P1Y1 = () => plan('P1', 1, 1000, [person('문창재', [1165000, 1165000, 1159000], 5823000)]);

(async () => {
await test('plansOf 는 연차 있는 것만 키 차례로 · 과제 하나만 · keyOf', () => {
  const list = Y.plansOf({ 'P1@2': plan('P1', 2, 1), P1: { prjNo: 'P1' }, 'P1@1': plan('P1', 1, 1), 'P2@1': plan('P2', 1, 1) });
  assert.deepStrictEqual(list.map((p) => `${p.prjNo}@${p.year}`), ['P1@1', 'P1@2', 'P2@1']);
  assert.deepStrictEqual(Y.plansOf(list, 'P2').map((p) => p.prjNo), ['P2']);
  assert.strictEqual(Y.keyOf(list[1]), S.planKey('P1', 2));
  assert.deepStrictEqual(Y.plansOf(null), []);
});
await test('merge — 연차마다 at 큰 쪽(같으면 로컬), 묘비가 새로우면 삭제 · 계획이 새로우면 묘비 폐기, 원격 없음, 같음', () => {
  const L = { plans: { 'P1@1': plan('P1', 1, 10, [person('a', [1000])]), 'P1@2': plan('P1', 2, 50, [person('b', [1000])]) }, del: { 'P1@3': 30 } };
  const R = { plans: [plan('P1', 1, 20, [person('a', [2000])]), plan('P1', 2, 50, [person('b', [9000])]), plan('P1', 3, 20, [person('c', [1000])]), plan('P1', 4, 5, [person('d', [1000])])], del: { 'P1@4': 40 } };
  const m = Y.merge(L, R, 1000);
  const by = Object.fromEntries(m.plans.map((p) => [p.year, p.people[0].plan[0].amt]));
  assert.deepStrictEqual(by, { 1: 2000, 2: 1000 }, '1차: 원격이 새로움 · 2차: 같으면 로컬 · 3차: 묘비 · 4차: 원격 묘비');
  assert.deepStrictEqual(m.del, { 'P1@3': 30, 'P1@4': 40 });
  assert.ok(m.localChanged && m.remoteChanged);
  const m2 = Y.merge({ plans: { 'P1@1': plan('P1', 1, 100, [person('a', [1])]) }, del: {} }, { plans: [], del: { 'P1@1': 90 } }, 1000);
  assert.deepStrictEqual([m2.plans.length, m2.del], [1, {}], '계획이 묘비보다 새로우면 계획이 남고 묘비는 버림');
  const m3 = Y.merge({ plans: { 'P1@1': P1Y1() }, del: {} }, null, 1000);
  assert.deepStrictEqual([m3.localChanged, m3.remoteChanged, m3.plans.length], [false, true, 1]);
  const m4 = Y.merge({ plans: { 'P1@1': P1Y1() }, del: {} }, { plans: [P1Y1()], del: {} }, 1000);
  assert.deepStrictEqual([m4.localChanged, m4.remoteChanged], [false, false]);
  const withBudget = plan('P1', 1, 2000, [], { budget: [{ name: '인건비', plan: 31425000 }, { name: '연구활동비', plan: 50000000 }] });
  const m5 = Y.merge({ plans: { 'P1@1': P1Y1() }, del: {} }, { plans: [withBudget], del: {} }, 3000);
  assert.deepStrictEqual([m5.plans[0].budget && m5.plans[0].budget.length, m5.plans[0].people.length, m5.localChanged], [2, 0, true], '예산 줄도 연차 계획과 함께 오간다');
  const old = 200 * 24 * 3600 * 1000;
  assert.deepStrictEqual(Y.gcTomb({ a: 1, b: old - 1000 }, old), { b: old - 1000 });
});
await test('delSlice — 그 과제 묘비만 · putBack — 그 과제 몫만 바꾸고 다른 과제는 그대로', () => {
  const del = { 'P1@1': 10, 'P2@1': 20, 'P1@3': 30 };
  assert.deepStrictEqual(Y.delSlice(del, 'P1'), { 'P1@1': 10, 'P1@3': 30 });
  const local = { plans: { 'P1@1': P1Y1(), 'P2@1': plan('P2', 1, 1, [person('x', [1])]) }, del };
  const back = Y.putBack(local, 'P1', [plan('P1', 2, 500, [person('홍길동', [1000000], 5000000)])], { 'P1@1': 400 });
  assert.deepStrictEqual(Object.keys(back.plans).sort(), ['P1@2', 'P2@1'], 'P1 은 병합 결과(2차년도만)로, P2 는 그대로');
  assert.deepStrictEqual(back.del, { 'P2@1': 20, 'P1@1': 400 }, 'P1 묘비는 새것으로(P1@3 은 사라짐), P2 는 그대로');
  assert.strictEqual(back.plans['P2@1'], local.plans['P2@1']);
});
await test('merge — 지급 완료(paid)는 계획 at 과 따로 paid.at 큰 쪽 (2026-10-19 "sharepoint 에도 제공해줘")', () => {
  const paidA = { from: '2026-04', through: '2026-06', amt: 1, appr: 1, left: 0, at: 100, src: 'erp' }, paidB = Object.assign({}, paidA, { through: '2026-08', at: 200 });
  const L = { plans: { 'P1@1': plan('P1', 1, 50, [person('a', [1000])], { paid: paidB }) }, del: {} };   // 로컬: 계획은 옛것, rERP 조회는 새것
  const R = { plans: [plan('P1', 1, 90, [person('a', [2000])], { paid: paidA })], del: {} };            // 원격: 계획은 새것, 조회는 옛것
  const m = Y.merge(L, R, 1000);
  assert.deepStrictEqual([m.plans[0].people[0].plan[0].amt, m.plans[0].paid], [2000, paidB], '계획은 원격(at 90), paid 는 로컬(at 200)');
  assert.ok(m.localChanged && m.remoteChanged);
  const m2 = Y.merge({ plans: { 'P1@1': plan('P1', 1, 90, [person('a', [1])]) }, del: {} }, { plans: [plan('P1', 1, 50, [person('a', [2])], { paid: paidA })], del: {} }, 1000);
  assert.deepStrictEqual([m2.plans[0].people[0].plan[0].amt, m2.plans[0].paid, m2.localChanged], [1, paidA, true], '한쪽에만 있으면 그것');
  const m3 = Y.merge({ plans: { 'P1@1': plan('P1', 1, 90, [person('a', [1])], { paid: paidB }) }, del: {} }, { plans: [plan('P1', 1, 90, [person('a', [1])], { paid: paidB })], del: {} }, 1000);
  assert.deepStrictEqual([m3.localChanged, m3.remoteChanged], [false, false]);
});
console.log(`\n${n} passed${failed ? `, ${failed} failed` : ''}`);
})();
