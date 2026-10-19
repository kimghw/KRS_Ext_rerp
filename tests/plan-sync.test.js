/* lib/plan-sync.js (공유 (Plus) — 예상 비용 병합 규칙) 테스트: flatten/unflatten, merge(ts · 묘비 · 원격 없음 · 같음), gcTomb, delSlice/putBack. 원노트 페이지 부분은 0.8.7 에서 걷어 냄(2026-10-18) — 파일 쪽은 lib/prjdoc*.js 테스트. 실행: node tests/plan-sync.test.js */
globalThis.self = globalThis;
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..');
require(path.join(root, 'lib/plan-sync.js'));
const S = KRX_PLAN_SYNC;
let n = 0, failed = 0;
const test = async (name, fn) => { try { await fn(); n++; console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n   ', e.stack || e.message); process.exitCode = 1; } };

(async () => {
await test('flatten/unflatten 왕복 · 과제 하나만', () => {
  const plans = { P1: { '10|연구활동비': [{ id: 'a', name: 'x', qty: 2, unit: 10, amt: 20, ts: 5 }], '10|장비비': [{ id: 'b', name: 'y', qty: 1, unit: 3, amt: 3, ts: 6, sub: { date: '2026-09-02' }, by: '홍' }] }, P2: { K: [{ id: 'c', name: 'z', qty: 1, unit: 1, amt: 1, ts: 1 }] } };
  const items = S.flatten(plans);
  assert.strictEqual(items.length, 3);
  assert.deepStrictEqual(S.unflatten(items), plans);
  assert.deepStrictEqual(S.flatten(plans, 'P2').map((e) => e.id), ['c']);
  assert.deepStrictEqual(S.unflatten([{ id: 'x' }, null, { id: 'y', prj: 'P', key: '' }]), {}, 'prj·key 없는 항목은 버림');
});

await test('merge: ts 큰 쪽이 이김, 같으면 로컬', () => {
  const L = { items: [{ id: 'a', prj: 'P', key: 'K', name: 'local', qty: 1, unit: 1, amt: 1, ts: 10 }, { id: 'b', prj: 'P', key: 'K', name: 'same-local', qty: 1, unit: 1, amt: 1, ts: 5 }], del: {} };
  const R = { items: [{ id: 'a', prj: 'P', key: 'K', name: 'remote', qty: 1, unit: 1, amt: 1, ts: 20 }, { id: 'b', prj: 'P', key: 'K', name: 'same-remote', qty: 1, unit: 1, amt: 1, ts: 5 }], del: {} };
  const m = S.merge(L, R, 1000);
  const by = Object.fromEntries(m.items.map((e) => [e.id, e.name]));
  assert.strictEqual(by.a, 'remote');
  assert.strictEqual(by.b, 'same-local');
  assert.strictEqual(m.localChanged, true);
  assert.strictEqual(m.remoteChanged, true);
});

await test('merge: 묘비(숫자·객체)가 항목보다 새로우면 삭제, 항목이 더 새로우면 묘비 폐기', () => {
  const L = { items: [{ id: 'a', prj: 'P', key: 'K', name: 'a', qty: 1, unit: 1, amt: 1, ts: 10 }, { id: 'b', prj: 'P', key: 'K', name: 'b', qty: 1, unit: 1, amt: 1, ts: 50 }], del: { c: { ts: 30, prj: 'P' } } };
  const R = { items: [{ id: 'c', prj: 'P', key: 'K', name: 'c', qty: 1, unit: 1, amt: 1, ts: 20 }], del: { a: 20, b: 40 } };
  const m = S.merge(L, R, 1000);
  assert.deepStrictEqual(m.items.map((e) => e.id).sort(), ['b']);
  assert.deepStrictEqual(m.del, { a: 20, c: 30 });
});

await test('merge: 원격 없음(파일 없음) → remoteChanged, 로컬 그대로 · 같으면 아무것도 안 바뀜 · 구독·작성자 보존', () => {
  const items = [{ id: 'a', prj: 'P', key: 'K', name: 'a', qty: 1, unit: 1, amt: 1, ts: 10, sub: { date: '2026-09-02' }, by: '김거화' }];
  const m = S.merge({ items, del: { z: 999 } }, null, 1000);
  assert.strictEqual(m.localChanged, false); assert.strictEqual(m.remoteChanged, true); assert.strictEqual(m.items.length, 1);
  assert.deepStrictEqual(m.items[0].sub, { date: '2026-09-02' }); assert.strictEqual(m.items[0].by, '김거화');
  const m2 = S.merge({ items, del: {} }, { items: items.map((e) => Object.assign({}, e)), del: {} }, 1000);
  assert.strictEqual(m2.localChanged, false); assert.strictEqual(m2.remoteChanged, false);
  const m3 = S.merge({ items: [], del: {} }, { items: [], del: {} }, 1000);
  assert.deepStrictEqual([m3.items, m3.del, m3.localChanged, m3.remoteChanged], [[], {}, false, false], '둘 다 비어도 같음');
});

await test('gcTomb: 90일 지난 묘비 버림 (객체 값도)', () => {
  const now = 100 * 24 * 3600 * 1000;
  assert.deepStrictEqual(S.gcTomb({ old: 1, fresh: now - 1000, obj: { ts: now - 5, prj: 'P' } }, now), { fresh: now - 1000, obj: now - 5 });
});

await test('delSlice: 그 과제 묘비(prj 없는 옛 숫자 포함)만 숫자 맵으로 · putBack: 그 과제 몫만 바꾸고 다른 과제는 그대로', () => {
  const del = { a: { ts: 10, prj: 'P1' }, b: { ts: 20, prj: 'P2' }, c: 30 };
  assert.deepStrictEqual(S.delSlice(del, 'P1'), { a: 10, c: 30 });
  assert.deepStrictEqual(S.delSlice(del, 'P2'), { b: 20, c: 30 });
  const local = { plans: { P1: { K: [{ id: 'a', name: 'old', qty: 1, unit: 1, amt: 1, ts: 1 }] }, P2: { K: [{ id: 'p2', name: 'p2', qty: 1, unit: 1, amt: 1, ts: 1 }] } }, del };
  const back = S.putBack(local, 'P1', [{ id: 'n', prj: 'P1', key: 'K2', name: 'new', qty: 2, unit: 5, amt: 10, ts: 100 }], { a: 10, z: 50 });
  assert.deepStrictEqual(Object.keys(back.plans).sort(), ['P1', 'P2']);
  assert.deepStrictEqual(back.plans.P1, { K2: [{ id: 'n', name: 'new', qty: 2, unit: 5, amt: 10, ts: 100 }] });
  assert.deepStrictEqual(back.plans.P2, local.plans.P2, '다른 과제는 그대로');
  assert.deepStrictEqual(back.del, { a: { ts: 10, prj: 'P1' }, b: { ts: 20, prj: 'P2' }, z: { ts: 50, prj: 'P1' } }, 'P1 몫(prj 없는 c 포함)은 새 묘비로 바뀌고 P2 는 그대로');
  const gone = S.putBack(local, 'P1', [], {});
  assert.ok(!('P1' in gone.plans), '항목이 모두 없어지면 과제 키도 사라짐');
});

console.log(`\n${n} passed${failed ? `, ${failed} failed` : ''}`);
})();
