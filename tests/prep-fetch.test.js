/* 증빙 찾아오기(0.8.5) 테스트 — lib/fetch-sites.js(가맹점 글자 맞추기·기본값·검사), site-fetch/prompt.js(요청 정리·사이트 안내·결과 검사),
 * lib/prep-store.js addFetched(받은 서류 → 첨부 파일·종류), lib/prep-fetch.js(등록·비밀번호는 확장 페이지만·시작→진행→서류 받기·사이트에 결과 남김),
 * site-fetch/cdp.mjs(비밀번호를 인자로 받지 않음). chrome.storage · fetch · IndexedDB 는 가짜. 실행: node tests/prep-fetch.test.js */
globalThis.self = globalThis;
const path = require('path');
const fs = require('fs');
const os = require('os');
const vm = require('vm');
const assert = require('assert');
const { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');

let n = 0, failed = 0;
const queue = [];
const test = (name, fn) => queue.push([name, fn]);

/* ---------- 가짜 chrome.storage.local · IndexedDB · fetch · 설정 ---------- */
let store = {};
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
globalThis.chrome = { storage: { local: {
  get: async (k) => { const out = {}; for (const x of [].concat(k)) if (x in store) out[x] = clone(store[x]); return out; },
  set: async (o) => { for (const [k, v] of Object.entries(o)) store[k] = clone(v); },
} } };
const blobs = new Map();   // IndexedDB 대신
globalThis.indexedDB = { open: () => { const r = {}; setTimeout(() => { r.result = { objectStoreNames: { contains: () => true }, transaction: () => ({ objectStore: () => ({
  put: (rec) => { const q = {}; blobs.set(rec.id, rec); setTimeout(() => { q.result = rec.id; q.onsuccess && q.onsuccess(); }); return q; },
  get: (id) => { const q = {}; setTimeout(() => { q.result = blobs.get(id); q.onsuccess && q.onsuccess(); }); return q; },
  delete: (id) => { const q = {}; blobs.delete(id); setTimeout(() => { q.onsuccess && q.onsuccess(); }); return q; },
}) }) }; r.onsuccess && r.onsuccess(); }); return r; } };
let settings = null;
globalThis.KRX_SETTINGS = { DEFAULTS: { claimHelper: { attachKinds: ['거래명세서', '수강증', '강의내용', '수료증'] } }, load: async () => settings };
const aiCalls = [];
globalThis.KRX_PREP_AI = { run: (key) => { aiCalls.push(key); return Promise.resolve({ ok: true }); } };

let server = null;   // 가짜 Help 서버: (url, init) → { status, json?, blob? }
globalThis.fetch = async (url, init) => {
  const r = server(String(url), init || {});
  return { ok: r.status === 200, status: r.status, json: async () => r.json, blob: async () => r.blob, headers: { get: () => (r.blob && r.blob.type) || '' } };
};

for (const f of ['lib/fetch-sites.js', 'lib/prep-store.js', 'lib/prep-fetch.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
const SITES = KRX_SITES, PS = KRX_PREP_STORE, PF = KRX_PREP_FETCH;
const P = require(path.join(root, 'site-fetch/prompt.js'));
const reset = () => { store = {}; blobs.clear(); aiCalls.length = 0; settings = { help: { url: 'http://127.0.0.1:8106', fetch: true } }; };

/* ---------- lib/fetch-sites.js ---------- */
test('가맹점 글자: 띄어 쓴 영문·전각 공백·회사 꼬리표를 지우고 맞춘다', () => {
  const sites = [{ id: 'a', label: '인프런', match: '인프랩' }, { id: 'b', label: 'Azure', match: 'microsoft, azure' }];
  assert.strictEqual(SITES.match(sites, '주식회사\u3000인프랩').id, 'a');
  assert.strictEqual(SITES.match(sites, 'M i c r o s o f t - G').id, 'b');
  assert.strictEqual(SITES.match(sites, 'ＭＩＣＲＯＳＯＦＴ＊ＡＺＵＲＥ').id, 'b');
  assert.strictEqual(SITES.match(sites, '스타벅스'), null);
  assert.strictEqual(SITES.match([{ id: 'x', match: 'a' }], 'abc'), null, '한 글자 글자는 쓰지 않음');
});
test('가장 긴 글자가 맞은 사이트를 고른다', () => {
  const sites = [{ id: 'ms', match: 'microsoft' }, { id: 'az', match: 'microsoftazure' }];
  assert.strictEqual(SITES.match(sites, 'MICROSOFT*AZURE').id, 'az');
});
test('등록 기본값: 알려진 가맹점은 주소·종류·서류, 아니면 가맹점 글자만', () => {
  const d = SITES.defaultsFor('주식회사　인프랩');
  assert.strictEqual(d.url, 'https://www.inflearn.com/my/orders');
  assert.strictEqual(d.kind, 'lecture');
  assert.deepStrictEqual(d.docs, ['강의내용', '견적서', '수강증'], '강의 = 종류별 필요 서류 기본');
  assert.deepStrictEqual(SITES.defaultsFor('주식회사　인프랩', { lecture: ['수강증'] }).docs, ['수강증'], '설정의 종류별 필요 서류');
  const m = SITES.defaultsFor('M i c r o s o f t - G');
  assert.strictEqual(m.kind, 'subscription');
  assert.deepStrictEqual(m.docs, ['거래명세서']);
  const o = SITES.defaultsFor('(주)어떤가게 강남점');
  assert.strictEqual(o.url, '');
  assert.strictEqual(o.match, '어떤가게 강남점');
  assert.strictEqual(SITES.keywordOf('OPENAI *CHATGPT SUBSCR'), 'OPENAI');
});
test('저장 전 검사: 주소·가맹점 글자가 없으면 거절, 종류가 이상하면 기타', () => {
  assert.throws(() => SITES.sanitize({ match: '인프랩', url: 'inflearn.com' }), /https/);
  assert.throws(() => SITES.sanitize({ match: 'x', url: 'https://a.com' }), /가맹점 글자/);
  const s = SITES.sanitize({ match: '인프랩', url: 'https://www.inflearn.com', kind: '??', docs: ['거래명세서', '거래명세서', 'a/b'] });
  assert.strictEqual(s.kind, 'other');
  assert.deepStrictEqual(s.docs, ['거래명세서', 'ab']);
  assert.strictEqual(s.label, '인프랩');
  assert.deepStrictEqual(SITES.sanitize({ match: '인프랩', url: 'https://a.com', kind: 'lecture' }).docs, [], '서류를 안 고르면 [] = 종류 기본을 따름');
});
test('필요 서류: 가맹점이 따로 고른 서류 → 설정의 종류별 필요 서류 → 기본, 0.8.5 개발 중 저장된 기본 서류는 종류 기본으로 읽음', async () => {
  const map = { lecture: ['강의내용', '견적서'], subscription: [] };
  assert.deepStrictEqual(SITES.docsOf({ kind: 'lecture', docs: ['수료증'] }, map), ['수료증']);
  assert.deepStrictEqual(SITES.docsOf({ kind: 'lecture', docs: [] }, map), ['강의내용', '견적서']);
  assert.deepStrictEqual(SITES.docsOf({ kind: 'subscription' }, map), ['거래명세서'], '빈 설정은 기본');
  assert.deepStrictEqual(SITES.docsOf({ kind: '??' }, null), ['거래명세서']);
  assert.deepStrictEqual(SITES.docList('강의내용, 견적서·수강증\n강의내용'), ['강의내용', '견적서', '수강증']);
  store = { fetchSites: [{ id: 'a', kind: 'lecture', docs: ['거래명세서', '수강증', '강의내용'] }, { id: 'b', kind: 'lecture', docs: ['거래명세서', '수강증', '강의내용'], docsV: 2 }, { id: 'c', kind: 'subscription', docs: ['거래명세서'] }, { id: 'd', kind: 'lecture', docs: ['수강증'] }] };
  assert.deepStrictEqual((await SITES.load()).map((x) => x.docs), [[], ['거래명세서', '수강증', '강의내용'], [], ['수강증']]);
  store = {};
});
test('만들기 프롬프트: 가맹점 값·필요 서류를 채우고, 확장에서 찾아오기를 시작하지 말라는 규칙을 넣음 (없으면 빈 칸 틀)', () => {
  const p = SITES.buildPrompt({ label: '인프런', match: '인프랩', url: 'https://www.inflearn.com/my/orders', kind: 'lecture', docs: [] }, { lecture: ['강의내용', '견적서', '수강증'] }, { usedDate: '2026-10-06', amount: 43560 });
  assert.ok(p.includes('인프랩') && p.includes('https://www.inflearn.com/my/orders') && p.includes('강의내용·견적서·수강증 (종류 기본)') && p.includes('43,560원'), p);
  assert.ok(p.includes('node site-fetch/run.js') && p.includes('site-fetch/sites/') && p.includes('KRX_PREP_FETCH.start') && p.includes('커밋하지 않는다'));
  const blank = SITES.buildPrompt(null);
  assert.ok(blank.includes('- 이름: ＿＿') && blank.includes('필요 서류: ＿＿'));
});

/* ---------- site-fetch/prompt.js ---------- */
const body = { site: { label: '인프런', url: 'https://www.inflearn.com/my/orders', kind: 'lecture', docs: ['거래명세서', '수강증', '강의내용'] }, cred: { id: 'me@x.com', pw: ' sp ace ' }, tx: { shop: '주식회사 인프랩', amount: 43560, usedDate: '2026-10-06 09:53:35', appr: '39202010' } };
test('요청 정리: 회사 시스템·이 PC 주소와 http(s) 아닌 주소는 거절, 비밀번호는 다듬지 않음', () => {
  assert.throws(() => P.clean({ site: { url: 'https://rnd.krs.co.kr/x' } }), /회사 시스템/);
  assert.throws(() => P.clean({ site: { url: 'http://127.0.0.1:8106/ask' } }), /회사 시스템|이 PC/);
  assert.throws(() => P.clean({ site: { url: 'file:///c:/x' } }), /http/);
  const c = P.clean(body);
  assert.strictEqual(c.cred.pw, ' sp ace ');
  assert.strictEqual(c.site.host, 'www.inflearn.com');
  assert.deepStrictEqual(P.clean({ site: { url: 'https://a.com' } }).site.docs, ['거래명세서'], '서류가 없으면 거래명세서');
});
test('프롬프트: 거래·서류 설명과 그 사이트 안내(sites/inflearn.md)를 붙이고 비밀번호는 넣지 않음, 스키마 enum = 요청 서류', () => {
  const { prompt, schema } = P.build(P.clean(body));
  assert.ok(prompt.includes('43,560원') && prompt.includes('39202010'));
  assert.ok(!prompt.includes('해외 결제'));
  assert.ok(P.build(P.clean(Object.assign({}, body, { tx: Object.assign({}, body.tx, { abroad: true }) }))).prompt.includes('해외 결제'), '국외 거래 안내');
  assert.ok(prompt.includes('/orders/<주문번호>/billing'), '인프런 안내');
  assert.ok(prompt.includes('수강증:') && prompt.includes('강의내용:'));
  assert.ok(!prompt.includes('sp ace') && !prompt.includes('me@x.com'), '아이디·비밀번호는 프롬프트에 없음');
  assert.deepStrictEqual(schema.properties.files.items.properties.kind.enum, ['거래명세서', '수강증', '강의내용']);
  assert.strictEqual(P.guideFor('chatgpt.com').includes('settings/billing'), true);
  assert.strictEqual(P.guideFor('portal.azure.com').includes('iframe'), true);
  assert.strictEqual(P.guideFor('example.com'), '');
});
test('결과 검사: 저장되지 않은 파일·요청 밖 종류는 버리고, 못 찾은 서류는 missing 으로 채움, 구조화 출력이 없으면 저장 목록 전부', () => {
  const input = P.clean(body);
  const manifest = [{ file: '거래명세서_a.pdf', kind: '거래명세서', base: 'capture_a.pdf', mime: 'application/pdf', bytes: 10 }, { file: '기타_b.png', kind: '기타', bytes: 5 }];
  const r = P.parse(input, { summary: 's', files: [{ file: '거래명세서_a.pdf', kind: '거래명세서' }, { file: '없는.pdf', kind: '수강증' }, { file: '거래명세서_a.pdf', kind: '거래명세서' }], missing: [{ kind: '강의내용', reason: '없음' }] }, manifest);
  assert.deepStrictEqual(r.files.map((f) => f.name), ['거래명세서_a.pdf']);
  assert.deepStrictEqual(r.missing.map((m) => m.kind).sort(), ['강의내용', '수강증']);
  const r2 = P.parse(input, null, manifest);
  assert.deepStrictEqual(r2.files.map((f) => f.name), ['거래명세서_a.pdf'], '요청한 종류만');
});

/* ---------- lib/prep-store.js addFetched ---------- */
test('받은 서류 → 첨부 파일: 종류를 정해 두고(fetch) 자동 분류가 다시 묻지 않게, 종류를 바꾸면 이름도 따라감', async () => {
  reset();
  const r = await PS.addFetched('39202010|4126', { appr: '39202010', card4: '4126', shop: '주식회사 인프랩' }, [
    { name: '거래명세서_inflearn.com_1.pdf', base: 'capture_inflearn.com_1.pdf', kind: '거래명세서', why: '주문 4030982', mime: 'application/pdf', blob: new Blob(['%PDF'], { type: 'application/pdf' }) },
    { name: 'x.pdf', kind: '수강증', blob: new Blob([]) },   // 빈 파일은 버림
  ], '찾아오기: 인프런');
  assert.strictEqual(r.added, 1);
  const f = r.entry.files[0];
  assert.strictEqual(f.name, '거래명세서_inflearn.com_1.pdf');
  assert.strictEqual(f.kindBy, 'fetch');
  assert.strictEqual(f.kindTried, true);
  assert.ok(f.kindWhy.includes('인프런') && f.kindWhy.includes('4030982'));
  const e2 = await PS.setFileKind('39202010|4126', f.id, '수강증');
  assert.strictEqual(e2.files[0].name, '수강증_inflearn.com_1.pdf');
  assert.ok(blobs.has(f.id));
});

/* ---------- lib/prep-fetch.js ---------- */
test('등록: 비밀번호는 확장 페이지에서 온 것만 저장, 고쳐 저장해도 기억한 찾는 방법·마지막 결과는 남김', async () => {
  reset();
  const s = await PF.saveSite({ label: '인프런', match: '인프랩', url: 'https://www.inflearn.com/my/orders', kind: 'lecture' }, { id: 'me', pw: 'pw1' }, false);
  assert.ok(!(store.fetchCred || {})[s.id], '콘텐츠 스크립트가 보낸 비밀번호는 무시');
  await PF.saveSite(Object.assign({}, s), { id: 'me', pw: 'pw1' }, true);
  assert.deepStrictEqual(store.fetchCred[s.id], { id: 'me', pw: 'pw1' });
  store.fetchSites[0].howto = '구매내역 → 거래명세서'; store.fetchSites[0].last = { ts: 1, state: 'done', n: 2 };
  const s2 = await PF.saveSite({ id: s.id, label: '인프런2', match: '인프랩', url: 'https://www.inflearn.com/my/orders', kind: 'lecture' }, null, true);
  assert.strictEqual(s2.howto, '구매내역 → 거래명세서');
  assert.strictEqual(store.fetchSites[0].last.n, 2);
  assert.strictEqual(store.fetchSites.length, 1);
  assert.deepStrictEqual(store.fetchCred[s.id], { id: 'me', pw: 'pw1' }, 'cred 없이 저장하면 비밀번호 그대로');
  await PF.removeSite(s.id);
  assert.strictEqual(store.fetchSites.length, 0);
  assert.ok(!store.fetchCred[s.id]);
});
test('찾아오기: 등록 안 된 가맹점·꺼진 설정·옛 서버는 시작하지 않음', async () => {
  reset();
  server = (url) => (/\/health$/.test(url) ? { status: 200, json: { ok: true, name: 'krx-help', classify: 'h' } } : { status: 404, json: {} });
  let r = await PF.start('k|1', { shop: '스타벅스' });
  assert.strictEqual(r.kind, 'nosite');
  await PF.saveSite({ match: '인프랩', url: 'https://www.inflearn.com' }, null, true);
  r = await PF.start('k|1', { shop: '주식회사 인프랩' });
  assert.strictEqual(r.kind, 'old', '/health 에 fetch 가 없는 서버');
  settings.help.fetch = false;
  r = await PF.start('k|1', { shop: '주식회사 인프랩' });
  assert.ok(!r.ok && /꺼져/.test(r.error));
});
test('찾아오기: 시작 → 진행 줄 → 끝나면 서류를 받아 첨부하고 사이트에 결과·찾는 방법을 남김', async () => {
  reset();
  const site = await PF.saveSite({ label: '인프런', match: '인프랩', url: 'https://www.inflearn.com/my/orders', kind: 'lecture' }, { id: 'me@x.com', pw: 'pw!' }, true);
  let posted = null, polls = 0;
  server = (url, init) => {
    if (/\/health$/.test(url)) return { status: 200, json: { ok: true, name: 'krx-help', fetch: 'claude-opus-5-5' } };
    if (/\/fetch$/.test(url)) { posted = JSON.parse(init.body); return { status: 200, json: { ok: true, id: 'J1' } }; }
    if (/\/fetch\/job/.test(url)) {
      polls++;
      if (polls === 1) return { status: 200, json: { ok: true, job: { id: 'J1', state: 'running' }, lines: [{ k: 'tool', s: '브라우저 look' }, { k: 'say', s: '로그인하겠습니다.' }], next: 2 } };
      return { status: 200, json: { ok: true, job: { id: 'J1', state: 'done', summary: '3개 저장', item: 'LLM 강의', matched: '2026-10-06 ₩43,560', howto: '/my/orders → 거래명세서', files: [{ name: '거래명세서_inflearn.com_1.pdf', base: 'capture_inflearn.com_1.pdf', kind: '거래명세서', mime: 'application/pdf', note: '주문 4030982' }], missing: [{ kind: '수강증', reason: '미발급' }] }, lines: [{ k: 'ok', s: '완료 — 3개 저장' }], next: 3 } };
    }
    if (/\/fetch\/file/.test(url)) return { status: 200, blob: new Blob(['%PDF-1.4'], { type: 'application/pdf' }) };
    return { status: 404, json: {} };
  };
  const meta = { appr: '39202010', card4: '4126', prjNo: 'P1', shop: '주식회사 인프랩', amount: 43560, usedDate: '20261006', usedTime: '095335', abroad: false };
  const r = await PF.start('39202010|4126', meta);
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepStrictEqual(posted.cred, { id: 'me@x.com', pw: 'pw!' });
  assert.deepStrictEqual(posted.site.docs, ['강의내용', '견적서', '수강증'], '종류 기본 = 강의의 필요 서류');
  assert.deepStrictEqual(r.docs, ['강의내용', '견적서', '수강증']);
  assert.strictEqual(posted.tx.amount, 43560);
  assert.strictEqual(posted.tx.usedDate, '2026-10-06 09:53:35', '사용일 + 사용시각');
  assert.strictEqual(posted.tx.abroad, false);
  assert.strictEqual(store.prepFetch['39202010|4126'].state, 'running');
  assert.strictEqual((await PF.start('39202010|4126', meta)).ok, false, '같은 거래는 한 번에 하나');
  for (let i = 0; i < 60 && store.prepFetch['39202010|4126'].state === 'running'; i++) await new Promise((res) => setTimeout(res, 200));
  const st = store.prepFetch['39202010|4126'];
  assert.strictEqual(st.state, 'done');
  assert.strictEqual(st.n, 1);
  assert.deepStrictEqual(st.missing, [{ kind: '수강증', reason: '미발급' }]);
  assert.ok(st.lines.includes('로그인하겠습니다.'));
  const e = store.claimPrep['39202010|4126'];
  assert.strictEqual(e.files[0].kind, '거래명세서');
  assert.strictEqual(e.files[0].kindBy, 'fetch');
  assert.strictEqual(store.fetchSites[0].howto, '/my/orders → 거래명세서');
  assert.strictEqual(store.fetchSites[0].last.state, 'done');
  assert.deepStrictEqual(aiCalls, ['39202010|4126'], '청구종류 자동 분류를 한 번');
  assert.strictEqual(site.id, store.fetchSites[0].id);
});
test('찾아오기: 필요 서류 중 이미 첨부 파일 종류로 있는 것은 빼고 찾고, 다 있으면 전부 다시', async () => {
  reset();
  settings.help.fetchDocs = { lecture: ['강의내용', '견적서', '수강증'] };
  await PF.saveSite({ label: '인프런', match: '인프랩', url: 'https://www.inflearn.com/my/orders', kind: 'lecture' }, null, true);
  const posts = [];
  server = (url, init) => {
    if (/\/health$/.test(url)) return { status: 200, json: { ok: true, name: 'krx-help', fetch: 'claude-opus-5-5' } };
    if (/\/fetch$/.test(url)) { posts.push(JSON.parse(init.body)); return { status: 200, json: { ok: true, id: 'J' + posts.length } }; }
    if (/\/fetch\/cancel$/.test(url)) return { status: 200, json: { ok: true } };
    return { status: 200, json: { ok: true, job: { state: 'running' }, lines: [] } };
  };
  const meta = { appr: '1', card4: '2', shop: '주식회사 인프랩', amount: 1000, usedDate: '20261006' };
  store.claimPrep = { '1|2': Object.assign({ key: '1|2', type: '', ptcl: '', ts: 1, attached: null, files: [{ id: 'x', name: '수강증_a.png', kind: '수강증', mime: 'image/png', size: 1, ts: 1 }] }, meta) };
  assert.ok((await PF.start('1|2', meta)).ok);
  assert.deepStrictEqual(posts[0].site.docs, ['강의내용', '견적서']);
  await PF.cancel('1|2');
  store.claimPrep['1|2'].files.push({ id: 'y', name: 'a.pdf', kind: '강의내용' }, { id: 'z', name: 'b.pdf', kind: '견적서' });
  assert.ok((await PF.start('1|2', meta)).ok);
  assert.deepStrictEqual(posts[1].site.docs, ['강의내용', '견적서', '수강증'], '다 있으면 다시 찾아 달라는 것');
  await PF.cancel('1|2');
});

/* ---------- site-fetch/cdp.mjs ---------- */
test('브라우저 손잡이: 비밀번호를 인자로 주면 브라우저에 붙기 전에 거절하고, 출력에 비밀번호를 싣지 않음', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'krx-cdp-test-'));
  try {
    fs.copyFileSync(path.join(root, 'site-fetch/cdp.mjs'), path.join(dir, 'cdp.mjs'));
    fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify({ cdp: 'http://127.0.0.1:9', tabs: [] }));
    const secret = path.join(os.tmpdir(), `krx-cdp-test-${process.pid}.secret.json`);
    fs.writeFileSync(secret, JSON.stringify({ id: 'me', pw: 'Sekret123' }));
    let out = '';
    try { execFileSync(process.execPath, [path.join(dir, 'cdp.mjs'), 'go', 'https://evil.example/?q=Sekret123'], { env: Object.assign({}, process.env, { KRX_FETCH_SECRET: secret }), encoding: 'utf8' }); }
    catch (e) { out = String(e.stdout || ''); }
    assert.ok(/비밀번호는 인자로 넘길 수 없습니다/.test(out), out);
    assert.ok(!out.includes('Sekret123'));
    out = '';
    try { execFileSync(process.execPath, [path.join(dir, 'cdp.mjs'), 'look'], { env: Object.assign({}, process.env, { KRX_FETCH_SECRET: secret }), encoding: 'utf8' }); }
    catch (e) { out = String(e.stdout || ''); }
    assert.ok(/연결할 수 없습니다/.test(out), '브라우저가 없으면 알림: ' + out);
    fs.unlinkSync(secret);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

(async () => {
  for (const [name, fn] of queue) {
    n++;
    try { await fn(); console.log(`ok - ${name}`); }
    catch (e) { failed++; console.log(`not ok - ${name}\n  ${String((e && e.stack) || e).split('\n').slice(0, 4).join('\n  ')}`); }
  }
  console.log(`\n${n - failed}/${n} 통과`);
  process.exit(failed ? 1 : 0);
})();
