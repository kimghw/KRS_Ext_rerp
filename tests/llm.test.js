/* LLM(Help 서버) 연결 상태(lib/llm.js) 테스트 — /health 응답을 상태로 바꾸고 storage.local.llmStatus 에 두며, TTL 안의 재요청은 다시 묻지 않고(force 면 다시), 같은 결과면 저장소를 다시 쓰지 않는다.
 * chrome.storage·fetch 는 가짜. 실행: node tests/llm.test.js */
globalThis.self = globalThis;
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const root = path.join(__dirname, '..');

let n = 0, failed = 0;
const queue = [];
const test = (name, fn) => queue.push([name, fn]);

let store = {}, sets = 0;
globalThis.chrome = { storage: { local: {
  get: async (k) => { const out = {}; for (const x of [].concat(k)) if (x in store) out[x] = JSON.parse(JSON.stringify(store[x])); return out; },
  set: async (o) => { sets++; for (const [k, v] of Object.entries(o)) store[k] = JSON.parse(JSON.stringify(v)); },
} } };
let reply = null, calls = 0;
globalThis.fetch = async (url) => {
  calls++;
  if (reply === 'down') throw new TypeError('Failed to fetch');
  return { status: 200, json: async () => reply };
};
vm.runInThisContext(fs.readFileSync(path.join(root, 'lib/llm.js'), 'utf8'), { filename: 'lib/llm.js' });
const L = KRX_LLM;
const reset = () => { store = {}; sets = 0; calls = 0; };

test('주소는 이 PC 만: 다른 호스트·빈 값은 기본 주소', () => {
  assert.strictEqual(L.baseUrl(''), 'http://127.0.0.1:8106');
  assert.strictEqual(L.baseUrl('http://localhost:9000/'), 'http://localhost:9000');
  assert.strictEqual(L.baseUrl('http://evil.example/'), 'http://127.0.0.1:8106');
});
test('연결됨: /health 를 상태로 바꿔 저장하고, TTL 안의 재요청은 다시 묻지 않음 (force 면 다시)', async () => {
  reset();
  reply = { ok: true, name: 'krx-help', model: 'claude-opus-5-5', classify: 'claude-haiku-5-5', classifyPtcl: true, fetch: '', fetchNote: 'Node 22 이상이 필요합니다', cli: '2.1.286', version: '0.8.5', repo: 'E:\\x' };
  const st = await L.probe('http://127.0.0.1:8106', true);
  assert.strictEqual(st.ok, true); assert.strictEqual(st.classify, 'claude-haiku-5-5'); assert.strictEqual(st.classifyPtcl, true);
  assert.strictEqual(st.fetch, ''); assert.strictEqual(st.fetchNote, 'Node 22 이상이 필요합니다'); assert.strictEqual(st.cli, '2.1.286'); assert.strictEqual(st.error, '');
  assert.deepStrictEqual(store.llmStatus.url, 'http://127.0.0.1:8106');
  assert.strictEqual(calls, 1);
  await L.probe('http://127.0.0.1:8106/', false);
  assert.strictEqual(calls, 1, 'TTL 안이면 다시 묻지 않음');
  const again = await L.probe('http://127.0.0.1:8106', true);
  assert.strictEqual(calls, 2, 'force 면 다시');
  assert.strictEqual(sets, 1, '같은 결과면 저장소를 다시 쓰지 않음');
  assert.strictEqual(again.ok, true);
});
test('연결 안 됨 · 다른 서버: ok false 와 이유, 바뀌면 저장', async () => {
  reply = 'down';
  let st = await L.probe('http://127.0.0.1:8106', true);
  assert.strictEqual(st.ok, false); assert.ok(/node help-server\/server.js/.test(st.error)); assert.strictEqual(st.classify, ''); assert.strictEqual(st.fetch, '');
  assert.strictEqual(store.llmStatus.ok, false);
  reply = { ok: true, name: 'other' };
  st = await L.probe('http://127.0.0.1:8106', true);
  assert.strictEqual(st.ok, false, 'krx-help 가 아니면 연결로 보지 않음');
  reply = { ok: false, error: '다른 확장에 연결돼 있습니다' };
  st = await L.probe('http://127.0.0.1:8106', true);
  assert.ok(/거절됨/.test(st.error));
  assert.strictEqual((await L.status()).error, st.error);
});
test('같은 주소의 동시 요청은 한 번만 묻는다', async () => {
  reset(); reply = { ok: true, name: 'krx-help', classify: 'h' };
  const [a, b] = await Promise.all([L.probe('http://127.0.0.1:8106', true), L.probe('http://127.0.0.1:8106', true)]);
  assert.strictEqual(calls, 1); assert.strictEqual(a, b);
});

(async () => {
  for (const [name, fn] of queue) {
    n++;
    try { await fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}\n     ${e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n     ') : e}`); }
  }
  console.log(`\n${n - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
