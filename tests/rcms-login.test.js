/* lib/rcms.js (RCMS 열기 · ID 로그인 자동 입력의 백그라운드 판정) 테스트 — 로그인 버튼은 "RCMS 열기"로 연 탭에서 한 번만 누르고, 비밀번호는 www.rcms.go.kr 최상위 프레임에만 준다. 실행: node tests/rcms-login.test.js */
globalThis.self = globalThis;
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..');

// chrome.storage(sync·local·session) · chrome.tabs.create 흉내
const area = () => {
  const data = {};
  return {
    data,
    get: async (k) => (typeof k === 'string' ? (k in data ? { [k]: data[k] } : {}) : Object.assign({}, data)),
    set: async (o) => { Object.assign(data, JSON.parse(JSON.stringify(o))); },
    remove: async (k) => { delete data[k]; }
  };
};
const sync = area(), local = area(), session = area();
const created = [];
globalThis.chrome = { storage: { sync, local, session }, tabs: { create: async (opt) => { created.push(opt); return { id: 100 + created.length }; } } };
for (const f of ['lib/settings.js', 'lib/rcms.js']) require(path.join(root, f));
const R = KRX_RCMS;

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const reset = (cred, rcms) => {
  for (const a of [sync, local, session]) for (const k of Object.keys(a.data)) delete a.data[k];
  created.length = 0;
  if (cred) local.data.rcmsCred = cred;
  if (rcms) sync.data.settings = { rcms };
};
const from = (tabId, url, frameId) => ({ tab: { id: tabId, index: 3, windowId: 7 }, frameId: frameId || 0, url: url || 'https://www.rcms.go.kr/login/rid.do?PORTAL_YN=Y' });
const CRED = { id: 'KRXUSER', pw: 'p@ss word' };

test('RCMS 열기: 기본 주소로 탭을 열고(누른 탭 옆), ID·비밀번호가 있으면 그 탭에 자동 로그인을 걸어 둔다', async () => {
  reset(CRED);
  const r = await R.open(from(5, 'https://eclass.krs.co.kr/eClassVer4/Home/Index'));
  assert.deepStrictEqual(r, { ok: true, auto: true });
  assert.deepStrictEqual(created, [{ url: 'https://www.rcms.go.kr/index.do', windowId: 7, index: 4 }]);
  assert.strictEqual(session.data.rcmsAuto.tabId, 101);
  assert.ok(session.data.rcmsAuto.until > Date.now() && session.data.rcmsAuto.until <= Date.now() + R.AUTO_MS);
});

test('ID·비밀번호가 없거나 자동 로그인을 끄면 링크만 연다 (설정의 RCMS 링크 사용, 팝업에서 누르면 위치 지정 없음)', async () => {
  reset(null, { url: 'https://www.rcms.go.kr/index.do#x' });
  assert.deepStrictEqual(await R.open({}), { ok: true, auto: false });
  assert.deepStrictEqual(created, [{ url: 'https://www.rcms.go.kr/index.do#x' }]);
  assert.strictEqual(session.data.rcmsAuto, undefined);
  reset(CRED, { autoLogin: false });
  assert.deepStrictEqual(await R.open({}), { ok: true, auto: false });
  assert.deepStrictEqual(await R.login({ stage: 'form' }, from(101)), { ok: false });
  reset({ id: 'KRXUSER', pw: '' });
  assert.deepStrictEqual(await R.login({ stage: 'form' }, from(101)), { ok: false });
});

test('연 탭의 흐름: 포털(check, 걸려 있음) → 로그인 폼(form, 값 + 버튼 누름) → 실패해 폼이 다시 보이면 값만(버튼은 한 번만)', async () => {
  reset(CRED);
  await R.open({});
  assert.deepStrictEqual(await R.login({ stage: 'check' }, from(101, 'https://www.rcms.go.kr/index.do')), { ok: true, armed: true });
  assert.ok(session.data.rcmsAuto, 'check 는 걸어 둔 것을 쓰지 않는다');
  assert.deepStrictEqual(await R.login({ stage: 'form' }, from(101)), { ok: true, id: 'KRXUSER', pw: 'p@ss word', submit: true });
  assert.strictEqual(session.data.rcmsAuto, undefined);
  assert.deepStrictEqual(await R.login({ stage: 'form' }, from(101, 'https://www.rcms.go.kr/login/loginRcvFail.do?sysId=exo')), { ok: true, id: 'KRXUSER', pw: 'p@ss word', submit: false });
  assert.deepStrictEqual(await R.login({ stage: 'check' }, from(101, 'https://www.rcms.go.kr/index.do')), { ok: true, armed: false });
});

test('이미 로그인돼 있으면(done) 걸어 둔 것을 지운다 — 나중에 로그아웃해 로그인 화면에 가도 버튼은 누르지 않음', async () => {
  reset(CRED);
  await R.open({});
  assert.deepStrictEqual(await R.login({ stage: 'done' }, from(101, 'https://www.rcms.go.kr/index.do')), { ok: true });
  assert.strictEqual(session.data.rcmsAuto, undefined);
  assert.strictEqual((await R.login({ stage: 'form' }, from(101))).submit, false);
});

test('다른 탭이나 시간이 지난 뒤의 로그인 화면은 값만 채운다', async () => {
  reset(CRED);
  await R.open({});
  assert.strictEqual((await R.login({ stage: 'form' }, from(999))).submit, false);
  assert.ok(session.data.rcmsAuto, '다른 탭의 물음은 걸어 둔 것을 쓰지 않는다');
  session.data.rcmsAuto.until = Date.now() - 1;
  assert.strictEqual((await R.login({ stage: 'form' }, from(101))).submit, false);
});

test('비밀번호는 www.rcms.go.kr 최상위 프레임의 콘텐츠 스크립트에만: 다른 출처 · 하위 프레임 · 탭이 아닌 보낸 곳은 거절', async () => {
  reset(CRED);
  await R.open({});
  for (const s of [from(101, 'https://www.rcms.go.kr.evil.example/login/rid.do'), from(101, 'https://pm.rcms.go.kr/login/rid.do'), from(101, 'http://www.rcms.go.kr/login/rid.do'),
    from(101, undefined, 2), { url: 'https://www.rcms.go.kr/login/rid.do', frameId: 0 }, null]) {
    assert.deepStrictEqual(await R.login({ stage: 'form' }, s), { ok: false });
  }
  assert.ok(session.data.rcmsAuto, '거절한 물음은 걸어 둔 것을 쓰지 않는다');
});

(async () => {
  let n = 0, failed = 0;
  for (const [name, fn] of tests) {
    try { await fn(); n++; console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n   ', e.stack || e.message); process.exitCode = 1; }
  }
  console.log(`\n${n} passed, ${failed} failed`);
})();
