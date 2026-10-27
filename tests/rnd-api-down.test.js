/* lib/rnd-api.js — R&D ERP 서버가 내려갔을 때(2026-10-27 16:45 실측: 루트만 200, .act·.jsp·.jct 는 모두 빈 본문 404).
 * call() 은 404·5xx 를 로그인 문제가 아닌 'down' 으로 알리고, collect() 는 errorKind 'down' 을 남기며, keepOnDown 은 마지막 정상 결과를 지킨다.
 * 가짜 chrome.storage · 가짜 fetch. 네트워크 없음. 실행: node tests/rnd-api-down.test.js */
globalThis.self = globalThis;
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..');

const mem = {};
const area = {
  get: async (keys) => { const ks = keys == null ? Object.keys(mem) : [].concat(keys); const o = {}; for (const k of ks) if (k in mem) o[k] = mem[k]; return o; },
  set: async (obj) => { Object.assign(mem, obj); },
  remove: async (keys) => { for (const k of [].concat(keys)) delete mem[k]; }
};
globalThis.chrome = { storage: { local: area, sync: area }, runtime: { lastError: null } };

for (const f of ['lib/format.js', 'lib/settings.js', 'lib/rnd-api.js']) require(path.join(root, f));
const API = KRX_API;

let n = 0, failed = 0;
const test = async (name, fn) => { try { await fn(); n++; console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n   ', e.stack || e.message); process.exitCode = 1; } };

// 가짜 fetch: 모든 요청에 같은 상태·형식·본문
const reply = (status, ct, body) => async () => {
  const buf = Buffer.from(body || '', 'utf8');
  return { status, headers: { get: (k) => (/content-type/i.test(k) ? ct : null) }, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
};
const settings = () => Object.assign({}, KRX_SETTINGS.DEFAULTS, { onlyMyProjects: true, accountRule: false, adv: Object.assign({}, KRX_SETTINGS.DEFAULTS.adv || {}, { budgetService: '' }) });

(async () => {
  await test('빈 본문 404 는 down — 로그인 필요로 보지 않는다', async () => {
    globalThis.fetch = reply(404, null, '');
    await assert.rejects(API.call('rcomm_0009_01_r001', {}), (e) => e.kind === 'down' && /서버가 응답하지 않습니다 \(HTTP 404\)/.test(e.message));
  });
  await test('5xx 는 HTML 오류 페이지여도 down (로그인 페이지로 오인해 SSO 를 돌리지 않음)', async () => {
    globalThis.fetch = reply(502, 'text/html', '<html><body>Bad Gateway</body></html>');
    await assert.rejects(API.call('rcomm_0009_01_r001', {}), (e) => e.kind === 'down' && /HTTP 502/.test(e.message));
  });
  await test('200 HTML 은 그대로 로그인 필요', async () => {
    globalThis.fetch = reply(200, 'text/html', '<html>login</html>');
    await assert.rejects(API.call('rcomm_0009_01_r001', {}), (e) => e.kind === 'login');
  });
  await test('collect: 과제 목록이 down 이면 error 와 errorKind down, 로그인 필요 아님', async () => {
    globalThis.fetch = reply(404, null, '');
    const out = await API.collect(settings());
    assert.strictEqual(out.loginRequired, false);
    assert.strictEqual(out.errorKind, 'down');
    assert.match(out.error, /HTTP 404/);
    assert.strictEqual(out.projects.length, 0);
  });
  await test('keepOnDown: 마지막 정상 결과에 오류 한 줄만 얹고, 시각(ts)은 그 결과의 것', async () => {
    const good = { ts: 1000, error: null, loginRequired: false, projects: [{ prjNo: 'A' }], totalCount: 3 };
    const down = { ts: 2000, error: 'R&D ERP 서버가 응답하지 않습니다 (HTTP 404)', errorKind: 'down', loginRequired: false, projects: [] };
    const kept = API.keepOnDown(down, good);
    assert.deepStrictEqual(kept.projects, [{ prjNo: 'A' }]);
    assert.strictEqual(kept.totalCount, 3);
    assert.strictEqual(kept.ts, 1000);
    assert.strictEqual(kept.staleSince, 1000);
    assert.strictEqual(kept.downAt, 2000);
    assert.strictEqual(kept.error, down.error);
    // 다음 조회도 내려가 있으면 남긴 결과를 다시 남긴다 (staleSince 는 처음 것)
    const again = API.keepOnDown(Object.assign({}, down, { ts: 3000 }), kept);
    assert.strictEqual(again.staleSince, 1000);
    assert.strictEqual(again.downAt, 3000);
    assert.deepStrictEqual(again.projects, [{ prjNo: 'A' }]);
  });
  await test('keepOnDown: down 이 아니거나 남길 것이 없으면 그대로', async () => {
    const down = { ts: 2000, error: 'x', errorKind: 'down', projects: [] };
    assert.strictEqual(API.keepOnDown(down, null), down);
    assert.strictEqual(API.keepOnDown(down, { ts: 1, projects: [] }), down);                                   // 남길 과제 없음
    assert.strictEqual(API.keepOnDown(down, { ts: 1, loginRequired: true, projects: [{ prjNo: 'A' }] }), down);  // 로그인 필요였던 결과
    assert.strictEqual(API.keepOnDown(down, { ts: 1, error: '다른 오류', projects: [{ prjNo: 'A' }] }), down);  // 다른 오류로 끝난 결과
    const other = { ts: 2000, error: 'JSON 파싱 실패', errorKind: 'badresponse', projects: [] };
    assert.strictEqual(API.keepOnDown(other, { ts: 1, projects: [{ prjNo: 'A' }] }), other);
    const ok = { ts: 2000, error: null, projects: [{ prjNo: 'B' }] };
    assert.strictEqual(API.keepOnDown(ok, { ts: 1, projects: [{ prjNo: 'A' }] }), ok);
  });

  console.log(`\n${n} 통과${failed ? `, ${failed} 실패` : ''}`);
})();
