/* 자주 사용 가맹점 공유 (2026-10-22 — 밑폴더/common/가맹점.json) 테스트: lib/fetch-sites.js parseShared · mergeShared(가맹점마다 나중에 고친 쪽, 묘비는 내 것만, 비밀 칸은 올리지 않음)와
 * lib/sites-sync.js run(가짜 store — 처음 쓸 때 common 폴더 만들기 · 나와 공유의 동료 파일 읽기 · 깨진 내 파일은 쓰지 않음 · offline 은 전체 실패 · 저장 직전 다시 병합).
 * 실 SharePoint 에는 닿지 않는다. 실행: node tests/sites-sync.test.js */
globalThis.self = globalThis;
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..');
for (const f of ['lib/fetch-sites.js', 'lib/sites-sync.js']) require(path.join(root, f));
const SITES = KRX_SITES, SYNC = KRX_SITES_SYNC;
let n = 0, failed = 0;
const test = async (name, fn) => { try { await fn(); n++; console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n   ', e.stack || e.message); process.exitCode = 1; } };
const clone = (v) => JSON.parse(JSON.stringify(v));
const err = (kind, msg) => Object.assign(new Error(msg || kind), { kind });

const claude = (id, extra) => Object.assign({ id, label: 'Claude', match: 'anthropic, claude.ai', url: 'https://claude.ai/settings/billing', kind: 'subscription', docs: [], hint: '설정 › 결제', howto: '인보이스 표', browser: 'KRS 전용(9333)', issue: '영수증도', last: { ts: 1, state: 'done', n: 1 }, ts: 1, docsV: 2, hintV: 1 }, extra || {});
const inflearn = (id, extra) => Object.assign({ id, label: '인프런', match: '인프랩', url: 'https://www.inflearn.com/my/orders', kind: 'lecture', docs: [], hint: '구매 내역', howto: '', browser: '', issue: '', last: null, ts: 1, docsV: 2, hintV: 1 }, extra || {});
const merge = (o) => SITES.mergeShared(Object.assign({ who: '나' }, o));
/* 한 번 동기화한 것처럼: 첫 병합의 meta · 파일 */
const synced = (local, now) => { const r = merge({ local, meta: null, mine: null, others: [], now }); return { meta: r.meta, mine: SITES.parseShared(r.text), text: r.text, local: r.sites }; };   // local = 저장된 목록(수정 시각이 찍힘)

(async () => {
  await test('첫 동기화: 로컬 가맹점을 지금 시각으로 올리고(파일 없음 → remoteChanged), 아이디·비밀번호·Chrome·마지막 결과·개선점은 파일에 없음', () => {
    const r = merge({ local: [claude('a'), inflearn('b')], meta: null, mine: null, others: [], now: 100 });
    assert.deepStrictEqual([r.remoteChanged, r.metaChanged, r.localChanged, r.count], [true, true, true, 2], '옛 저장(at 없음)에 처음 수정 시각을 찍어 저장');
    assert.deepStrictEqual(r.sites.map((s) => [s.at, s.by]), [[100, '나'], [100, '나']]);
    assert.deepStrictEqual(r.doc.sites.map((s) => [s.id, s.at, s.by]), [['a', 100, '나'], ['b', 100, '나']]);
    for (const k of ['browser', 'issue', 'last', 'loginId', 'loginPw', 'KRS 전용', '영수증도']) assert.ok(!r.text.includes(k), `${k} 는 올리지 않음`);
    assert.strictEqual(SITES.parseShared(r.text).sites[0].howto, '인보이스 표');
    assert.strictEqual(merge({ local: [], meta: null, mine: null, others: [], now: 100 }).remoteChanged, false, '가맹점이 없으면 빈 파일을 만들지 않음');
  });
  await test('그대로면 아무것도 안 바뀜, 로컬에서 고치면 지금 시각으로 올리고, 마지막 결과·Chrome 만 바뀐 것은 고친 것이 아님', () => {
    const s = synced([claude('a'), inflearn('b')], 100), L = s.local;
    const same = merge({ local: L, meta: s.meta, mine: s.mine, others: [], now: 200 });
    assert.deepStrictEqual([same.remoteChanged, same.metaChanged, same.localChanged], [false, false, false]);
    const only = merge({ local: [Object.assign({}, L[0], { last: { ts: 9, state: 'empty' }, browser: '9444' }), L[1]], meta: s.meta, mine: s.mine, others: [], now: 200 });
    assert.deepStrictEqual([only.remoteChanged, only.metaChanged], [false, false]);
    const ed = merge({ local: [Object.assign({}, L[0], { howto: '새 경로' }), L[1]], meta: s.meta, mine: s.mine, others: [], now: 200 });   // 찍지 않고 바뀐 것(옛 경로) → 지금
    assert.ok(ed.remoteChanged);
    assert.deepStrictEqual(ed.doc.sites.find((x) => x.id === 'a'), Object.assign({ id: 'a' }, SITES.sharedOf(claude('a', { howto: '새 경로' })), { at: 200, by: '나' }));
    assert.strictEqual(ed.doc.sites.find((x) => x.id === 'b').at, 100, '안 고친 가맹점은 그때 시각');
  });
  await test('수정 시각은 고친 때(stamp): 오프라인·공유 꺼짐 동안 고친 것도 그 날짜로 겨루고, 동기화 시각으로 밀리지 않음', () => {
    const s = synced([claude('a')], 100);
    const mineEdit = Object.assign({}, s.local[0], { howto: '내 경로' });
    SITES.stamp(mineEdit, s.local[0], 150, '나');   // 150 에 고침, 동기화는 300 에
    const doc = (at, howto) => SITES.parseShared(JSON.stringify({ kind: 'fetchSites', sites: [Object.assign({ id: 'x' }, SITES.sharedOf(claude('x', { howto })), { at, by: '김동료' })] }));
    const later = merge({ local: [mineEdit], meta: s.meta, mine: s.mine, others: [{ owner: '김동료', doc: doc(170, '동료 경로') }], now: 300 });
    assert.deepStrictEqual([later.sites[0].howto, later.sites[0].at, later.sites[0].by], ['동료 경로', 170, '김동료'], '동료가 더 늦게(170) 고쳤으면 동료 것');
    const earlier = merge({ local: [mineEdit], meta: s.meta, mine: s.mine, others: [{ owner: '김동료', doc: doc(130, '동료 경로') }], now: 300 });
    assert.deepStrictEqual([earlier.sites[0].howto, earlier.sites[0].at, earlier.doc.sites[0].at, earlier.doc.sites[0].by], ['내 경로', 150, 150, '나'], '내가 더 늦게(150) 고쳤으면 내 것 — 동기화 시각(300)이 아니라 고친 시각으로 올림');
  });
  await test('stamp: 올리는 칸이 같으면 그때 시각·사람, 바뀌었거나 새 등록이면 지금·나 — 마지막 결과·Chrome·개선점만 바뀐 것은 고친 것이 아님', () => {
    const old = claude('a', { at: 50, by: '김동료' });
    assert.deepStrictEqual((({ at, by }) => [at, by])(SITES.stamp(Object.assign({}, old, { browser: '9444', issue: 'x', last: null }), old, 900, '나')), [50, '김동료']);
    assert.deepStrictEqual((({ at, by }) => [at, by])(SITES.stamp(Object.assign({}, old, { hint: '새 메모' }), old, 900, '나')), [900, '나']);
    assert.deepStrictEqual((({ at, by }) => [at, by])(SITES.stamp(inflearn('n'), null, 901, '나')), [901, '나']);
    assert.deepStrictEqual([SITES.sanitize(old).at, SITES.sanitize(old).by], [50, '김동료'], 'sanitize 가 수정 시각·사람을 지킴');
  });
  await test('bury: 지운 등록을 그 시각의 묘비로 fetchSitesSync 에 남기고 지문에서 뺌 → 다음 병합이 그 날짜로 올림', async () => {
    const box = {};
    globalThis.chrome = { storage: { local: { get: async (k) => ({ [k]: box[k] }), set: async (o) => Object.assign(box, clone(o)) } } };
    const s = synced([claude('a'), inflearn('b')], 100);
    box[SITES.SHARE_META] = s.meta;
    await SITES.bury([s.local[0]], 140);
    assert.deepStrictEqual([Object.keys(box[SITES.SHARE_META].sites), box[SITES.SHARE_META].del.a.at], [['b'], 140]);
    const r = merge({ local: [s.local[1]], meta: box[SITES.SHARE_META], mine: s.mine, others: [], now: 500 });
    assert.deepStrictEqual([r.doc.del.a.at, r.remoteChanged], [140, true], '동기화(500)가 아니라 지운 때(140)');
    delete globalThis.chrome;
  });
  await test('지우기: 이 브라우저에서 지운 가맹점은 묘비로 올리고, 내 다른 PC 는 그 묘비로 지움(아이디는 남은 것만)', () => {
    const s = synced([claude('a'), inflearn('b')], 100), L = s.local;
    const del = merge({ local: [L[1]], meta: s.meta, mine: s.mine, others: [], now: 300 });
    assert.ok(del.remoteChanged);
    assert.deepStrictEqual(Object.keys(del.doc.del), ['a']);
    assert.deepStrictEqual([del.doc.del.a.at, del.doc.del.a.match], [300, 'anthropic, claude.ai']);
    const pc2 = merge({ local: clone(L), meta: s.meta, mine: SITES.parseShared(del.text), others: [], now: 400 });   // 다른 PC: 아직 a 가 있음
    assert.deepStrictEqual([pc2.localChanged, pc2.removed, pc2.sites.map((x) => x.id)], [true, 1, ['b']]);
    assert.strictEqual(pc2.remoteChanged, false);
    const pc3 = merge({ local: [SITES.stamp(Object.assign({}, L[0], { howto: '지운 뒤 고침' }), L[0], 400, '나'), L[1]], meta: null, mine: SITES.parseShared(del.text), others: [], now: 500 });   // 묘비(300)보다 늦게(400) 고친 것은 살아남음
    assert.deepStrictEqual(pc3.sites.map((x) => x.id), ['a', 'b']);
  });
  await test('동료 파일: 새 가맹점은 그 id 로 받고(로컬 칸은 비움), 같은 가맹점(id 가 달라도 가맹점 글자가 같음)은 나중에 고친 쪽, 동료가 지운 것은 내 목록에서 지우지 않음', () => {
    const s = synced([claude('a')], 100), L = s.local;
    const theirs = SITES.parseShared(JSON.stringify({ v: 1, kind: 'fetchSites', sites: [
      Object.assign({ id: 'x' }, SITES.sharedOf(claude('x', { match: 'anthropic', howto: '동료 경로' })), { at: 150, by: '김동료' }),
      Object.assign({ id: 'y' }, SITES.sharedOf(inflearn('y')), { at: 120, by: '김동료' }),
    ], del: { a: { at: 999, match: 'anthropic', label: 'Claude' } } }));
    const r = merge({ local: L, meta: s.meta, mine: s.mine, others: [{ owner: '김동료', doc: theirs }], now: 200 });
    assert.deepStrictEqual([r.added, r.updated, r.removed], [1, 1, 0], '동료의 묘비(a)는 따르지 않음');
    const a = r.sites.find((x) => x.id === 'a'), y = r.sites.find((x) => x.id === 'y');
    assert.deepStrictEqual([a.howto, a.browser, a.issue, a.match], ['동료 경로', 'KRS 전용(9333)', '영수증도', 'anthropic'], '받은 칸만 바뀌고 이 브라우저 칸은 그대로');
    assert.deepStrictEqual([y.label, y.browser, y.issue, y.last, y.docsV], ['인프런', '', '', null, 2]);
    assert.deepStrictEqual(r.doc.sites.map((x) => [x.id, x.at, x.by]), [['a', 150, '김동료'], ['y', 120, '김동료']], '내 파일에도 받은 시각·누가 그대로');
    const older = merge({ local: L, meta: s.meta, mine: s.mine, others: [{ owner: '김동료', doc: SITES.parseShared(JSON.stringify({ kind: 'fetchSites', sites: [Object.assign({ id: 'x' }, SITES.sharedOf(claude('x', { howto: '옛 경로' })), { at: 50 })] })) }], now: 200 });
    assert.deepStrictEqual([older.updated, older.localChanged, older.remoteChanged], [0, false, false], '더 오래된 동료 값은 무시');
  });
  await test('내가 지운 가맹점은 동료 파일에 남아 있어도 되살리지 않고, 동료가 그 뒤에 고쳤으면 다시 받음', () => {
    const s = synced([claude('a')], 100);
    const del = merge({ local: [], meta: s.meta, mine: s.mine, others: [], now: 300 });
    const doc = (at) => SITES.parseShared(JSON.stringify({ kind: 'fetchSites', sites: [Object.assign({ id: 'x' }, SITES.sharedOf(claude('x')), { at, by: '김동료' })] }));
    const keep = merge({ local: [], meta: del.meta, mine: SITES.parseShared(del.text), others: [{ owner: '김동료', doc: doc(250) }], now: 400 });
    assert.deepStrictEqual([keep.count, keep.added, keep.localChanged], [0, 0, false]);
    const back = merge({ local: [], meta: del.meta, mine: SITES.parseShared(del.text), others: [{ owner: '김동료', doc: doc(350) }], now: 400 });
    assert.deepStrictEqual([back.count, back.added, back.sites[0].id], [1, 1, 'x']);
  });
  await test('파일 읽기: 우리 파일이 아니거나 JSON 이 아니면 null, id·가맹점 글자 없는 줄은 버림, 오래된 묘비는 정리(180일)', () => {
    assert.strictEqual(SITES.parseShared('{ 깨짐'), null);
    assert.strictEqual(SITES.parseShared(JSON.stringify({ v: 2, kind: 'year', sites: [] })), null);
    const d = SITES.parseShared('﻿' + JSON.stringify({ kind: 'fetchSites', sites: [{ id: '', match: 'x1' }, { id: 'k', match: '' }, { id: 'ok', match: '인프랩', url: 'https://a.com', kind: 'weird', at: 5 }] }));
    assert.deepStrictEqual(d.sites.map((x) => [x.id, x.kind]), [['ok', 'other']]);
    const day = 24 * 3600000;
    const r = merge({ local: [], meta: { sites: {}, del: { old: { at: 1, match: 'x' }, recent: { at: 200 * day, match: 'y' } } }, mine: null, others: [], now: 200 * day + 1 });
    assert.deepStrictEqual(Object.keys(r.doc.del), ['recent']);
  });

  /* ---------- run (가짜 store) ---------- */
  const ORIGIN = 'https://krclass-my.sharepoint.com';
  const BASE = '/personal/me/Documents/업무/shared';
  const cfgOf = (p) => ({ origin: ORIGIN, siteUrl: `${ORIGIN}${p.split('/').slice(0, 3).join('/')}`, folderPath: p, viewUrl: `${ORIGIN}/view?id=${encodeURIComponent(p)}` });
  function fakeStore(tree, opts) {
    opts = opts || {};
    const calls = [];
    const store = {
      calls,
      childCfg: (cfg, name) => cfgOf(`${cfg.folderPath}/${name}`),
      fileUrl: (cfg, name) => `${ORIGIN}${cfg.folderPath}/${name}`,
      readFile: async (cfg, name) => {
        const p = cfg.folderPath; calls.push(`read:${p}/${name}`);
        if ((opts.fail || {})[p]) throw err(opts.fail[p]);
        if (!(p in tree)) throw err('nofolder');
        return name in tree[p] ? { text: tree[p][name], meta: {} } : null;
      },
      sharedWithMe: async () => { calls.push('sharedWithMe'); return (opts.shared || []).map((s) => ({ name: s.path.split('/').pop(), webUrl: `${ORIGIN}${s.path}`, folder: true, ownerName: s.owner, cfg: cfgOf(s.path) })); },
      openWriter: async (cfg) => {
        const p = cfg.folderPath; calls.push(`open:${p}`);
        return {
          ensurePath: async (pp) => { calls.push(`ensurePath:${pp}`); const made = !(pp in tree); tree[pp] = tree[pp] || {}; return { created: made, made: made ? [pp] : [] }; },
          modify: async (name, transform) => {
            if (!(p in tree)) throw err('nofolder');
            const cur = name in tree[p] ? tree[p][name] : null;
            const r = await transform(cur);
            if (r.changed) { tree[p][name] = r.text; calls.push(`put:${p}/${name}`); return { changed: true, created: cur == null }; }
            calls.push(`undo:${p}/${name}`); return { changed: false };
          },
          close: async () => { calls.push(`close:${p}`); },
        };
      },
    };
    return store;
  }
  const localOf = (sites, meta) => {
    const box = { sites: clone(sites), meta: clone(meta || {}), saves: 0 };
    box.loadLocal = async () => ({ sites: clone(box.sites), meta: clone(box.meta) });
    box.saveLocal = async (d) => { box.saves++; if (d.sites) box.sites = clone(d.sites); box.meta = clone(d.meta); };
    return box;
  };
  const runWith = (store, box, extra) => SYNC.run(Object.assign({ store, io: {}, base: cfgOf(BASE), who: '나', now: 1000, loadLocal: box.loadLocal, saveLocal: box.saveLocal }, extra || {}));

  await test('처음: common 폴더가 없으면 만들고 가맹점.json 을 쓰며, 지문(meta)을 저장 — 다음 동기화는 아무것도 쓰지 않음', async () => {
    const tree = { [BASE]: {} }, store = fakeStore(tree), box = localOf([claude('a')]);
    const st = await runWith(store, box);
    assert.deepStrictEqual([st.ok, st.created, st.pushed, st.exists, st.count, st.path], [true, true, true, true, 1, `${BASE}/common/가맹점.json`]);
    assert.ok(store.calls.includes(`ensurePath:${BASE}/common`) && store.calls.includes(`put:${BASE}/common/가맹점.json`) && store.calls.includes(`close:${BASE}/common`));
    assert.strictEqual(SITES.parseShared(tree[`${BASE}/common`]['가맹점.json']).sites[0].id, 'a');
    assert.ok(box.meta.sites.a, '지문 저장');
    store.calls.length = 0;
    const st2 = await runWith(store, box, { now: 2000 });
    assert.deepStrictEqual([st2.ok, st2.pushed, st2.created], [true, false, false]);
    assert.ok(!store.calls.some((c) => c.startsWith('open:')), '바뀐 것이 없으면 작업 창을 열지 않음: ' + store.calls);
  });
  await test('나와 공유: …/shared/common · …/shared(밑폴더) · 밑폴더 이름이 shared 가 아닌 동료의 …/common 을 읽어 합치고, 과제 폴더·내 폴더·파일 없는 동료는 건너뜀, 받은 것은 로컬에 저장하고 내 파일에도 올림', async () => {
    const theirs = (id, extra, at, by) => JSON.stringify({ v: 1, kind: 'fetchSites', sites: [Object.assign({ id }, SITES.sharedOf(Object.assign(inflearn(id), extra || {})), { at, by })], del: {} });
    const tree = {
      [BASE]: {}, [`${BASE}/common`]: {},
      '/personal/kim/Documents/업무/shared/common': { '가맹점.json': theirs('k1', { howto: '김의 경로' }, 500, '김') },
      '/personal/lee/Documents/업무/shared': {}, '/personal/lee/Documents/업무/shared/common': { '가맹점.json': theirs('l1', { howto: '이의 경로' }, 700, '이') },
      '/personal/park/Documents/업무/shared/common': {},
      '/personal/choi/Documents/RnD공유/common': { '가맹점.json': theirs('c1', { howto: '최의 경로' }, 300, '최') },   // 최의 밑폴더는 shared 가 아님(2026-10-25)
    };
    const store = fakeStore(tree, { shared: [
      { path: '/personal/kim/Documents/업무/shared/common', owner: '김' },
      { path: '/personal/lee/Documents/업무/shared', owner: '이' },
      { path: '/personal/lee/Documents/업무/shared/SSCB', owner: '이' },   // 과제 폴더 — 가맹점과 무관
      { path: '/personal/park/Documents/업무/shared/common', owner: '박' },   // 아직 파일 없음
      { path: '/personal/choi/Documents/RnD공유/common', owner: '최' },
      { path: `${BASE}/common`, owner: '나' },   // 내 것이 되돌아온 것
    ] });
    const box = localOf([claude('a')]);
    const st = await runWith(store, box);
    assert.deepStrictEqual(st.others.map((o) => [o.owner, o.n]), [['김', 1], ['이', 1], ['최', 1]]);
    assert.deepStrictEqual([st.ok, st.added, st.pulled, st.pushed, st.count], [true, 1, true, true, 2]);
    assert.strictEqual(box.sites.find((x) => x.match === '인프랩').howto, '이의 경로', '같은 가맹점의 두 동료 값 가운데 나중 것(이 700)');
    assert.ok(!store.calls.some((c) => c.includes('/SSCB/')), '과제 폴더는 읽지 않음');
    assert.strictEqual(store.calls.filter((c) => c === `read:${BASE}/common/가맹점.json`).length, 1, '내 파일은 한 번만 읽음');
    const mine = SITES.parseShared(tree[`${BASE}/common`]['가맹점.json']);
    assert.deepStrictEqual(mine.sites.map((x) => [x.id, x.howto, x.by]), [['a', '인보이스 표', '나'], ['k1', '이의 경로', '이']], '같은 가맹점은 먼저 받은 id(k1)에 나중 값');
    assert.ok(!(await runWith(store, box, { shared: [] })).others.length, '받은 목록(deps.shared)을 넘기면 다시 부르지 않음');
  });
  await test('실패: 깨진 내 파일은 kind parse 로 쓰지 않고, 동료 사이트의 권한 오류는 그 동료만, offline 은 전체, 내 사이트 auth 는 전체', async () => {
    const tree = { [BASE]: {}, [`${BASE}/common`]: { '가맹점.json': '{ 깨짐' } };
    let store = fakeStore(tree), box = localOf([claude('a')]);
    let st = await runWith(store, box);
    assert.deepStrictEqual([st.ok, st.kind], [false, 'parse']);
    assert.ok(!store.calls.some((c) => c.startsWith('put:')) && tree[`${BASE}/common`]['가맹점.json'] === '{ 깨짐');
    const t2 = { [BASE]: {}, '/personal/kim/Documents/업무/shared/common': {} };
    store = fakeStore(t2, { shared: [{ path: '/personal/kim/Documents/업무/shared/common', owner: '김' }], fail: { '/personal/kim/Documents/업무/shared/common': 'auth' } });
    st = await runWith(store, localOf([claude('a')]));
    assert.deepStrictEqual([st.ok, st.others[0].owner, st.others[0].kind, st.pushed], [true, '김', 'auth', true]);
    store = fakeStore(t2, { shared: [{ path: '/personal/kim/Documents/업무/shared/common', owner: '김' }], fail: { '/personal/kim/Documents/업무/shared/common': 'offline' } });
    st = await runWith(store, localOf([claude('a')]));
    assert.deepStrictEqual([st.ok, st.kind], [false, 'offline']);
    store = fakeStore({ [BASE]: {} }, { fail: { [`${BASE}/common`]: 'auth' } });
    st = await runWith(store, localOf([claude('a')]));
    assert.deepStrictEqual([st.ok, st.kind], [false, 'auth']);
  });
  await test('저장 직전 다시 병합: 동기화 도중 설정 페이지에서 더한 가맹점을 덮지 않음', async () => {
    const tree = { [BASE]: {}, '/personal/kim/Documents/업무/shared/common': { '가맹점.json': JSON.stringify({ kind: 'fetchSites', sites: [Object.assign({ id: 'k1' }, SITES.sharedOf(inflearn('k1')), { at: 500, by: '김' })] }) } };
    const store = fakeStore(tree, { shared: [{ path: '/personal/kim/Documents/업무/shared/common', owner: '김' }] });
    const box = localOf([claude('a')]);
    let first = true;
    const load0 = box.loadLocal;
    box.loadLocal = async () => { const l = await load0(); if (first) { first = false; box.sites.push(claude('z', { label: 'GitHub', match: 'github', url: 'https://github.com/settings/billing' })); } return l; };
    await runWith(store, box);
    assert.deepStrictEqual(box.sites.map((x) => x.id), ['a', 'z', 'k1']);
  });

  console.log(`\n${n}/${n + failed} 통과`);
})();
