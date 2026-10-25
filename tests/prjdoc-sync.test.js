/* lib/prjdoc-sync.js v2 (확장 Plus — base/<과제 폴더>/<n>차년도.json · 예상비용.json ↔ 로컬 동기화 차례, 2026-10-18 저녁) 테스트 — 가짜 store(메모리 폴더 트리: listFolders/childCfg/listFiles/readFile/openWriter(ensureFolder·ensurePath·at·modify)/sharedWithMe/parseFolder)와 가짜 로컬로:
 * 처음(업무/shared 와 과제 폴더 만들기 — 이름 규칙 약칭 → Job Id → 과제번호, 책임자 아닌데 로컬 자료 없으면 noFolder) · 연차 파일 둘 + 예상비용.json 생성·갱신 · 동료 변경 받기(칸마다 saveLocal) · 변경이력 합집합 · project 칸 규칙 · 모르는 칸 보존 ·
 * 나와 공유에서 찾은 다른 사이트 폴더(writer 가 사이트마다 따로) · 색인 적중/불일치 · 깨진 파일·v1 파일 건너뜀 · locked · auth/tab 전체 실패(나와 공유 끝점의 auth 는 discoverError 만) · want · pull 다시 병합 · 내가 남긴 체크아웃 · only · at 없는 writer · pages 호환 칸 ·
 * (2026-10-18 검토 반영) 같은 약칭의 두 과제는 <이름>-<과제번호> 로 비켜 감 · 체크아웃한 최신 글이 남의 과제 것이면 쓰지 않고 다시 고름 · 이미 있던 폴더는 created 아님 · 색인에 남은 동료 폴더가 없어졌으면 동료 사이트에 만들지 않음(alt → 내 base → noFolder) · 예상비용.json 만 남의 것이면 그 파일만 parse.
 * 실 SharePoint 에는 닿지 않는다. 실행: node tests/prjdoc-sync.test.js */
globalThis.self = globalThis;
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..');
for (const f of ['lib/format.js', 'lib/plan-sync.js', 'lib/research.js', 'lib/research-sync.js', 'lib/staff.js', 'lib/staff-sync.js', 'lib/prjdoc.js', 'lib/prjdoc-sync.js']) require(path.join(root, f));
const D = KRX_PRJDOC, Y = KRX_PRJDOC_SYNC, S = KRX_STAFF;
let n = 0, failed = 0;
const test = async (name, fn) => { try { await fn(); n++; console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n   ', e.stack || e.message); process.exitCode = 1; } };

/* ---------- 자료 예 (저장소 모양 그대로) ---------- */
const item = (id, ts, extra) => Object.assign({ id, name: `항목 ${id}`, qty: 1, unit: 1000, amt: 1000, ts }, extra || {});
const rec = (prjNo, nn, rev, at, extra) => Object.assign({ id: `mw급과제#${nn}`, name: 'MW급 과제', code: 'RS-1', n: nn, rev, tag: '', file: 'KR_x.yaml', at, agree: '', period: '', role: '공동', lead: '김거화', note: '',
  goals: [`${nn}차 목표`], contents: [], perf: [], outputs: [], schedule: null, spend: [], budget: [], roster: [], prjNo, prjNm: prjNo ? '과제1' : '', linkBy: prjNo ? 'auto' : '' }, extra || {});
const person = (name, amts, monthly) => S.normalizePerson({ id: name, name, role: '연구원', manual: monthly, plan: amts.map((amt, i) => ({ ym: `2026-${String(i + 4).padStart(2, '0')}`, amt })) });
const BUDGET = [{ name: '인건비', plan: 31425000 }, { name: '연구활동비', plan: 5000000 }];
const splan = (prjNo, year, at, people, extra) => Object.assign({ prjNo, year, prjNm: '과제1', from: year === 1 ? '2026-04' : '2027-01', to: year === 1 ? '2026-12' : '2027-12', budgetPay: 31425000, budget: BUDGET, basis: 'rerp', src: 'erp', people, at, by: '김거화', note: '' }, extra || {});
const change = (id, date, kind, item, before, after, extra) => Object.assign({ id, date, kind, item, before, after, reason: '', by: '나', at: Number(id.replace(/\D/g, '')) || 0, auto: false }, extra || {});
const clone = (v) => JSON.parse(JSON.stringify(v));
const err = (kind, msg) => Object.assign(new Error(msg || kind), { kind });
const ORIGIN = 'https://krclass-my.sharepoint.com';
const ME = '/personal/me', YOU = '/personal/you';
const BASE = `${ME}/Documents/업무/shared`, YOUR_BASE = `${YOU}/Documents/업무/shared`;
/* 폴더 경로 → cfg (KRX_SP.parseFolder 결과 꼴 가운데 prjdoc-sync 가 쓰는 칸) */
const cfgOf = (p) => { const site = `${ORIGIN}${p.split('/').slice(0, 3).join('/')}`; return { origin: ORIGIN, siteUrl: site, folderPath: p, name: p.split('/').pop(), url: `${ORIGIN}${p}`, viewUrl: `${site}/_layouts/15/onedrive.aspx?id=${encodeURIComponent(p)}`, fileUrl: (nm) => `${ORIGIN}${p}/${nm}` }; };
const siteOf = (p) => `${ORIGIN}${p.split('/').slice(0, 3).join('/')}`;

/* 가짜 store — tree: { [폴더 경로]: { [파일 이름]: 글 } }(키가 있으면 폴더 — 빈 객체도). opts = { locked:[경로/이름], mine:[경로/이름](내가 남긴 체크아웃), authList, openFail, denied:[사이트](그 사이트는 readFile·listFiles·openWriter 가 auth),
 *   beforeModify(path, name, tree), shared:[{ path, ownerName }](나와 공유 — 폴더 항목), sharedFail(kind), noAt(writer.at 없음 — 폴더마다 하나 더 연다), noEnsurePath(writer.ensurePath 없음 — 한 단씩) } */
function fakeStore(tree, opts) {
  opts = opts || {};
  const calls = [];
  const mine = new Set(opts.mine || []);
  const meta = (p, name) => ({ name, length: tree[p][name].length, modified: '2026-10-18T00:00:00Z', version: '1.0', uniqueId: `u-${name}`, checkedOut: mine.has(`${p}/${name}`), checkedOutByMe: mine.has(`${p}/${name}`) });
  const nofolder = (p) => err('nofolder', `공유 폴더가 없습니다: ${p}`);
  const denied = (cfg) => (opts.denied || []).includes(siteOf(cfg.folderPath));
  const bound = (p) => {
    const w = {
      folderPath: p,
      ensureFolder: async () => { calls.push(`ensureFolder:${p}`); if (p in tree) return { created: false }; const parent = p.replace(/\/[^/]*$/, ''); if (!(parent in tree)) throw nofolder(parent); tree[p] = {}; return { created: true }; },
      modify: async (name, transform) => {
        calls.push(`modify:${p}/${name}`);
        if (!(p in tree)) throw nofolder(p);
        const key = `${p}/${name}`;
        if ((opts.locked || []).includes(key)) throw err('locked', `${name} 을(를) 다른 사람이 체크아웃했습니다`);
        if (opts.beforeModify) opts.beforeModify(p, name, tree);
        const cur = name in tree[p] ? tree[p][name] : null;
        const r = transform(cur);
        if (r && r.changed) { tree[p][name] = r.text; mine.delete(key); calls.push(`put:${key}`); return { changed: true, created: cur == null, updated: cur != null, checkedIn: cur != null, version: '2.0' }; }
        if (cur != null && mine.has(key) && !(r && r.discard)) { mine.delete(key); calls.push(`checkin:${key}`); return { changed: false, checkedIn: true, version: '2.0' }; }
        calls.push(`undo:${key}`); return { changed: false, checkedIn: false };
      },
      close: async () => { calls.push(`close:${p}`); },
    };
    if (!opts.noEnsurePath) w.ensurePath = async (pp) => {   // KRX_SP(spEnsureFolder) 처럼: 있는 가장 깊은 단을 찾아 거기서부터 만들고 { created, made } — 다 있으면 made 비움(성근 시험 트리라 문서함 뿌리(3단)까지 없으면 뿌리도 만든다)
      calls.push(`ensurePath:${pp}`);
      const segs = pp.split('/').filter(Boolean), at = (d) => `/${segs.slice(0, d).join('/')}`;
      let d = segs.length;
      while (d > 3 && !(at(d) in tree)) d--;
      const made = [];
      if (!(at(d) in tree)) { tree[at(d)] = {}; made.push(at(d)); }
      for (let i = d + 1; i <= segs.length; i++) { tree[at(i)] = {}; made.push(at(i)); }
      return { created: made.length > 0, made };
    };
    if (!opts.noAt) w.at = (cfg) => bound(cfg.folderPath);
    return w;
  };
  return {
    calls, tree, mine,
    listFolders: async (cfg, io) => { calls.push(`folders:${cfg.folderPath}`); assert.ok(io && typeof io === 'object', 'io 를 넘긴다'); if (opts.authList) throw err('auth', '이 브라우저에서 SharePoint(OneDrive)에 로그인하세요'); if (denied(cfg)) throw err('auth', '권한 없음'); if (!(cfg.folderPath in tree)) throw nofolder(cfg.folderPath); return Object.keys(tree).filter((k) => k.startsWith(`${cfg.folderPath}/`) && !k.slice(cfg.folderPath.length + 1).includes('/')).map((k) => ({ name: k.split('/').pop(), path: k, itemCount: Object.keys(tree[k]).length, modified: '2026-10-18T00:00:00Z' })); },
    childCfg: (cfg, name) => cfgOf(`${cfg.folderPath}/${name}`),
    listFiles: async (cfg) => { calls.push(`list:${cfg.folderPath}`); if (denied(cfg)) throw err('auth', '권한 없음'); if (!(cfg.folderPath in tree)) throw nofolder(cfg.folderPath); return Object.keys(tree[cfg.folderPath]).map((nm) => meta(cfg.folderPath, nm)); },
    readFile: async (cfg, name) => { calls.push(`read:${cfg.folderPath}/${name}`); if (denied(cfg)) throw err('auth', '권한 없음'); const f = tree[cfg.folderPath]; return f && name in f ? { text: f[name], meta: meta(cfg.folderPath, name) } : null; },
    openWriter: async (cfg) => { calls.push(`open:${siteOf(cfg.folderPath)}`); if (opts.openFail) throw err(opts.openFail, '작업 탭을 열 수 없습니다'); if (denied(cfg)) throw err('auth', '권한 없음'); return bound(cfg.folderPath); },
    sharedWithMe: async (io, o) => { calls.push('shared'); assert.ok(o && 'driveHost' in o); if (opts.sharedFail) throw err(opts.sharedFail, '나와 공유 실패'); return (opts.shared || []).map((s) => ({ name: s.path.split('/').pop(), webUrl: furl(s.path), folder: true, ownerName: s.ownerName || '', cfg: cfgOf(s.path) })); },
    parseFolder: (url) => cfgOf(decodeURIComponent(new URL(url).pathname)),   // KRX_SP.parseFolder 처럼 경로를 디코딩
    folderUrl: (cfg) => furl(cfg.folderPath),
  };
}
/* 폴더 주소 — KRX_SP.folderUrl 처럼 칸마다 encodeURIComponent */
const furl = (p) => `${ORIGIN}${p.split('/').map(encodeURIComponent).join('/')}`;
/* 가짜 로컬 — loadLocal/saveLocal(part, prj, data): background.js 가 할 일을 그대로(그 칸의 전체 구조를 받아 저장). 시각 없는 별칭은 10 으로 찍어 둔다(시각 없는 별칭은 병합이 지금 시각을 매겨 로컬에 저장하므로 — 그 동작은 prjdoc.test.js 에서 본다) */
function memLocal(init) {
  // projects 는 background.js shareLoadLocal 모양 — ERP 칸(prjNm·rspr·anl)과 ERP 현재 연차 기간 stDt/endDt(yearSpan 용). 과제 전체 기간 start/end 는 WORKSPACE 몫이라 rerp 로컬에는 받아 둔 것(shareProjects)만 있다
  const st = Object.assign({ plan: { plans: {}, del: {} }, research: {}, staff: { plans: {}, del: {} }, aliases: {}, aliasesAt: {}, changes: {}, projects: { P1: { prjNm: '과제1', rspr: '김거화', anl: 1, stDt: '20260401', endDt: '20261231' }, P2: { prjNm: '과제2', rspr: '동료', anl: 1, stDt: '20260101', endDt: '20261231' } } }, clone(init || {}));
  for (const k of Object.keys(st.aliases)) if (st.aliases[k] && !st.aliasesAt[k]) st.aliasesAt[k] = 10;
  const saved = [];
  return {
    st, saved,
    loadLocal: async () => clone(st),
    saveLocal: async (part, prj, data) => {
      saved.push(`${part}:${prj}`);
      if (part === 'plan') { st.plan.plans = clone(data.plans); st.plan.del = clone(data.del); }
      else if (part === 'research') st.research = clone(data.map);
      else if (part === 'staff') { st.staff.plans = clone(data.plans); st.staff.del = clone(data.del); }
      else if (part === 'budget') { const key = `${prj}@${data.year}`; const plan = st.staff.plans[key] || S.normalizePlanEntry({ prjNo: prj, year: data.year }, key); plan.budget = data.budget.map((r) => ({ name: r.name, plan: r.plan })); plan.budgetPay = S.budgetPayOf(plan.budget); st.staff.plans[key] = plan; }   // background.js 처럼 그 연차 계획의 budget(·budgetPay)만(없으면 빈 계획)
      else if (part === 'changes') st.changes[`${prj}@${data.year}`] = clone(data.list);
      else if (part === 'alias') { st.aliases = clone(data.aliases); st.aliasesAt = clone(data.aliasesAt); }
      else if (part === 'support') st.support = clone(data.all);   // projectSupport 전체 맵(이 과제만 바뀐 것)
      else if (part === 'project') st.projects[prj] = Object.assign({}, st.projects[prj], clone(data));   // shareProjects[prj] 에 겹치듯
      else throw new Error('모르는 칸 ' + part);
    },
  };
}
const deps = (store, mem, extra) => Object.assign({ store, io: { fetch: () => { throw new Error('실 fetch 금지'); } }, base: cfgOf(BASE), driveHost: ORIGIN, names: { P1: '과제1', P2: '과제2' }, rsprs: { P1: '김거화', P2: '동료' }, myPrjNos: ['P1', 'P2'], leadPrjNos: ['P1'], aliases: {}, index: {}, discover: true,
  want: { plan: true, research: true, staff: true, budget: true, changes: true, alias: true, support: true }, who: '나', loadLocal: mem.loadLocal, saveLocal: mem.saveLocal, now: 100000 }, extra || {});
const PAGE_KEYS = ['prjNo', 'title', 'webUrl', 'at', 'created', 'pulled', 'pushed', 'count', 'remoteAt', 'remoteBy'];   // planSyncState.pages 와 호환해야 하는 칸
const docOf = (store, p, name) => D.parse(store.tree[p][name]).doc;
const myLocal = () => ({
  plan: { plans: { P1: { '10|연구활동비': [item('a', 5), item('b', 6, { sub: { date: '2026-09-02' }, by: '나' })] } }, del: { x: { ts: 9, prj: 'P1' }, y: { ts: 9, prj: 'P9' } } },
  research: { 'mw급과제#1': rec('P1', 1, 'r2', 3), 'mw급과제#2': rec('P1', 2, 'r1', 4), '안이음#1': rec('', 1, 'r0', 1, { id: '안이음#1', name: '안이음' }) },
  staff: { plans: { 'P1@1': splan('P1', 1, 1000, [person('문창재', [1165000], 5823000)]), 'P1@2': splan('P1', 2, 2000, [person('홍길동', [1000000], 5000000)]) }, del: { 'P1@3': 30 } },
  aliases: { P1: 'SSCB' }, aliasesAt: { P1: 10 },
  changes: { 'P1@1': [change('c10', '2026-10-01', '예산', '연구활동비', '5,000천원', '6,000천원')], 'P1@2': [change('c30', '2026-10-06', '연구기간', '기간', '', '')] },
});

(async () => {
await test('처음: 업무/shared 도 과제 폴더도 없음 → base 를 만들고(ensurePath) 책임자인 P1 은 약칭 폴더 SSCB 에 1·2차년도.json + 예상비용.json 을 만들며 로컬 전부 올림 · 참여자인 P2 는 로컬 자료가 없어 noFolder(오류 아님) · writer 는 사이트에 하나 · pages·index 모양', async () => {
  const store = fakeStore({ [`${ME}/Documents`]: {} });
  const me = memLocal(myLocal());
  const r = await Y.run(deps(store, me));
  assert.deepStrictEqual([r.state.ok, r.state.count, r.state.written, r.state.files, r.state.pulled, r.state.errors, r.state.created, r.state.scanned], [true, 2, 3, 3, 0, 0, ['P1'], 0]);
  assert.deepStrictEqual([r.state.base, r.state.folder], [{ path: BASE, viewUrl: cfgOf(BASE).viewUrl }, { path: BASE, viewUrl: cfgOf(BASE).viewUrl }]);
  assert.deepStrictEqual(Object.keys(store.tree).sort(), [`${ME}/Documents`, `${ME}/Documents/업무`, BASE, `${BASE}/SSCB`].sort(), '업무 · shared · 과제 폴더(약칭)');
  assert.deepStrictEqual(Object.keys(store.tree[`${BASE}/SSCB`]).sort(), ['1차년도.json', '2차년도.json', '예상비용.json']);
  const y1 = docOf(store, `${BASE}/SSCB`, '1차년도.json'), y2 = docOf(store, `${BASE}/SSCB`, '2차년도.json'), pl = docOf(store, `${BASE}/SSCB`, '예상비용.json');
  assert.deepStrictEqual(y1.project, { prjNo: 'P1', prjNm: '과제1', rspr: '김거화', alias: 'SSCB', aliasAt: 10, jobId: '', io: '', start: '', end: '', note: '', support: [], supportAt: 0 }, 'start/end(과제 전체 기간)는 rerp 가 몰라 비움 — ERP 현재 연차 기간(stDt/endDt)을 넣지 않는다');
  assert.deepStrictEqual([y1.year, y1.budget.map((b) => [b.name, b.plan, b.at, b.by]), y1.staff.plans.map((p) => p.year), y1.staff.del, y1.research.map((x) => [x.id, 'prjNo' in x]), y1.changes.map((c) => c.id), y1.updatedBy, y1.updatedAt],
    [{ n: 1, start: '2026-04', end: '2026-12' }, [['인건비', 31425000, 1000, '김거화'], ['연구활동비', 5000000, 1000, '김거화']], [1], {}, [['mw급과제#1', false]], ['c10'], '나', '1970-01-01T00:01:40.000Z']);
  assert.deepStrictEqual([y2.project, y2.year, y2.staff.plans.map((p) => p.year), y2.research.map((x) => x.n), y2.changes.map((c) => c.id)], [y1.project, { n: 2, start: '2027-01', end: '2027-12' }, [2], [2], ['c30']], 'project 는 연차 파일마다 같은 내용 · 2차년도에는 2차 것만');
  assert.deepStrictEqual([pl.project, pl.plan.items.map((e) => [e.id, e.prj, e.key]), pl.plan.del], [{ prjNo: 'P1', prjNm: '과제1' }, [['a', 'P1', '10|연구활동비'], ['b', 'P1', '10|연구활동비']], { x: 9 }], 'P9 묘비는 P1 파일에 안 실림');
  const pg = r.state.pages.P1;
  for (const k of PAGE_KEYS) assert.ok(k in pg, `pages 에 ${k}`);
  assert.deepStrictEqual([pg.prjNo, pg.title, pg.folder, pg.folderUrl, pg.webUrl, pg.planUrl, pg.owner, pg.years, pg.at, pg.created, pg.folderCreated, pg.pulled, pg.pushed, pg.remoteAt, pg.remoteBy, pg.count, pg.counts],
    ['P1', '과제1', 'SSCB', cfgOf(`${BASE}/SSCB`).viewUrl, `${ORIGIN}${BASE}/SSCB/1차년도.json`, `${ORIGIN}${BASE}/SSCB/예상비용.json`, '', [1, 2], 100000, true, true, false, true, 0, '', 2, { plan: 2, research: 2, staff: 2, budget: 4, changes: 2 }]);
  assert.deepStrictEqual([r.state.pages.P2.noFolder, r.state.pages.P2.kind, r.state.pages.P2.error, r.state.pages.P2.folder], [true, 'nofolder', undefined, '']);
  assert.deepStrictEqual(r.state.index, { P1: { base: BASE, folder: 'SSCB', site: siteOf(BASE), path: `${BASE}/SSCB`, url: furl(`${BASE}/SSCB`), owner: '', at: 100000 } });
  assert.deepStrictEqual(me.saved, [], '로컬은 안 바뀜');
  assert.deepStrictEqual(store.calls.filter((c) => c.startsWith('open') || c.startsWith('close') || c.startsWith('ensure') || c === 'shared'), ['shared', `open:${siteOf(BASE)}`, `ensurePath:${BASE}/SSCB`, `close:${BASE}/SSCB`], 'writer 하나(과제 폴더에서 열어 ensurePath 로 base 까지 한 번에)');
  // 둘 다 같음 → 쓰지 않고 writer 도 안 열며 index 가 맞아 훑지도 않는다
  const n0 = store.calls.length;
  const r2 = await Y.run(deps(store, me, { now: 200000, index: r.state.index }));
  assert.deepStrictEqual([r2.state.ok, r2.state.written, r2.state.pulled, r2.state.scanned, r2.state.pages.P1.pushed, r2.state.pages.P1.pulled, r2.state.pages.P1.remoteBy, r2.state.pages.P1.remoteAt, r2.state.pages.P1.webUrl], [true, 0, 0, 0, false, false, '나', 100000, `${ORIGIN}${BASE}/SSCB/1차년도.json`]);
  assert.ok(!store.calls.slice(n0).some((c) => c.startsWith('open') || c.startsWith('modify')), 'writer 안 열림');
  assert.deepStrictEqual(me.saved, []);
});

await test('폴더 이름 규칙: 약칭 → 없으면 Job Id(로컬 projects 의 jobId) → 없으면 과제번호 · ensurePath 가 없는 writer 면 ensureFolder 를 한 단씩 · 같은 이름의 못 알아본 폴더가 있으면 그것을 쓴다', async () => {
  const store = fakeStore({ [`${ME}/Documents/업무`]: {}, [BASE]: {}, [`${BASE}/P5`]: {}, [`${BASE}/메모`]: { '읽어줘.txt': 'x' } }, { noEnsurePath: true });
  const me = memLocal({ aliases: { P3: 'MW' }, projects: { P3: { anl: 1 }, P4: { anl: 2, jobId: 'RND4' }, P5: { anl: 1 } } });
  const r = await Y.run(deps(store, me, { myPrjNos: ['P3', 'P4', 'P5'], leadPrjNos: ['P3', 'P4', 'P5'], names: {} }));
  assert.deepStrictEqual([r.state.ok, Object.keys(r.state.pages).sort(), r.state.scanned], [true, ['P3', 'P4', 'P5'], 2], '알 수 없는 폴더 둘(P5 · 메모)을 훑었다');
  assert.deepStrictEqual([r.state.pages.P3.folder, r.state.pages.P4.folder, r.state.pages.P5.folder, r.state.pages.P4.years, r.state.pages.P5.folderCreated], ['MW', 'RND4', 'P5', [2], undefined], 'P5 는 비어 있던 같은 이름 폴더를 그대로 씀 · 현재 연차 2 인 P4 는 2차년도만');
  assert.deepStrictEqual(Object.keys(store.tree).filter((k) => k.startsWith(`${BASE}/`)).sort(), [`${BASE}/MW`, `${BASE}/P5`, `${BASE}/RND4`, `${BASE}/메모`]);
  assert.deepStrictEqual(Object.keys(store.tree[`${BASE}/P5`]), ['1차년도.json'], '예상 비용이 비면 예상비용.json 은 만들지 않음');
  assert.deepStrictEqual(store.calls.filter((c) => c.startsWith('ensure')), [`ensureFolder:${BASE}/MW`, `ensureFolder:${BASE}/RND4`]);
  assert.deepStrictEqual(r.state.created.sort(), ['P3', 'P4']);
});

await test('공유할 과제(allow — 설정 고른 과제만): 고르지 않은 과제는 책임자·로컬 자료가 있어도 폴더를 만들지도 쓰지도 않음 · only 가 고르지 않은 과제면 아무것도 안 함 · 빈 목록이면 과제 없음', async () => {
  const store = fakeStore({ [BASE]: {} });
  const me = memLocal({ aliases: { P3: 'MW' }, projects: { P3: { anl: 1 }, P4: { anl: 1, jobId: 'RND4' } } });
  const r = await Y.run(deps(store, me, { myPrjNos: ['P3', 'P4'], leadPrjNos: ['P3', 'P4'], names: {}, allow: ['P3'] }));
  assert.deepStrictEqual([r.state.ok, Object.keys(r.state.pages), r.state.created], [true, ['P3'], ['P3']]);
  assert.deepStrictEqual(Object.keys(store.tree).filter((k) => k.startsWith(`${BASE}/`)), [`${BASE}/MW`], 'P4(RND4) 폴더는 안 만듦');
  const n0 = store.calls.length;
  const r2 = await Y.run(deps(store, me, { myPrjNos: ['P3', 'P4'], leadPrjNos: ['P3', 'P4'], names: {}, allow: ['P3'], only: 'P4', index: r.state.index }));
  assert.deepStrictEqual([r2.state.ok, Object.keys(r2.state.pages)], [true, []]);
  assert.ok(!store.calls.slice(n0).some((c) => c.startsWith('open') || c.startsWith('modify') || c.startsWith('ensure')), 'writer 안 열림');
  const r3 = await Y.run(deps(store, me, { myPrjNos: ['P3', 'P4'], leadPrjNos: ['P3', 'P4'], names: {}, allow: [], index: r.state.index }));
  assert.deepStrictEqual(Object.keys(r3.state.pages), []);
  assert.deepStrictEqual(r3.state.index.P3 && r3.state.index.P3.folder, 'MW', '고르지 않아도 알아본 폴더의 색인은 남김');
});

await test('동료가 고친 파일: 예산 줄(WORKSPACE at)·새 사람(새 at)·높은 판·변경이력·별칭·jobId 를 받아 칸마다 saveLocal, 내 것은 올림 · 다시 돌리면 둘이 같아 쓰지 않음 · 동료가 다시 받으면 내 것이 들어온다', async () => {
  const store = fakeStore({ [BASE]: {} });
  const you = memLocal({ plan: { plans: { P1: { '10|연구활동비': [item('a', 5), item('d', 6, { by: '동료' })] } }, del: {} }, research: { 'mw급과제#1': rec('P1', 1, 'r3', 2, { goals: ['새 판'] }) },
    staff: { plans: { 'P1@1': splan('P1', 1, 3000, [person('새사람', [1000000], 5000000)], { budget: [{ name: '인건비', plan: 40000000 }] }) }, del: {} }, aliases: { P1: 'SSCB' }, aliasesAt: { P1: 10 },
    changes: { 'P1@1': [change('c15', '2026-10-03', '예산', '인건비', '31,425천원', '40,000천원', { by: '동료' })] }, projects: { P1: { prjNm: '과제1', rspr: '김거화', start: '2026-04-01', end: '2026-12-31', anl: 1, jobId: 'RND1', io: 'IO1', at: 1 } } });
  const r0 = await Y.run(deps(store, you, { who: '동료', myPrjNos: ['P1'], leadPrjNos: ['P1'], now: 50000 }));
  assert.deepStrictEqual([r0.state.ok, r0.state.pages.P1.folder, docOf(store, `${BASE}/SSCB`, '1차년도.json').project.jobId], [true, 'SSCB', 'RND1']);
  const me = memLocal({ plan: { plans: { P1: { '10|연구활동비': [item('c', 7)] } }, del: { a: { ts: 9, prj: 'P1' }, y: { ts: 9, prj: 'P9' } } },   // a 는 내가 지움(묘비 9 > ts 5) · y 는 다른 과제 묘비
    research: { 'mw급과제#1': rec('P1', 1, 'r2', 3), 'mw급과제#2': rec('P1', 2, 'r1', 4) }, staff: { plans: { 'P1@1': splan('P1', 1, 1000, [person('문창재', [1165000], 5823000)]), 'P1@2': splan('P1', 2, 2000, [person('홍길동', [1000000], 5000000)]) }, del: {} },
    changes: { 'P1@1': [change('c10', '2026-10-01', '예산', '연구활동비', '5,000천원', '6,000천원')] } });
  const r = await Y.run(deps(store, me, { myPrjNos: ['P1'], leadPrjNos: [] }));   // 나는 참여자 — 로컬 자료가 있어 폴더(이미 있음)를 쓴다
  assert.deepStrictEqual([r.state.ok, r.state.count, r.state.written, r.state.pulled, r.state.files], [true, 1, 3, 1, 3], '1차년도(병합) · 2차년도(새로) · 예상비용(병합)');
  const pg = r.state.pages.P1;
  assert.deepStrictEqual([pg.created, pg.pulled, pg.pushed, pg.remoteBy, pg.remoteAt, pg.title, pg.years, pg.folder], [true, true, true, '동료', 50000, '과제1', [1, 2], 'SSCB']);
  assert.deepStrictEqual(me.saved, ['budget:P1', 'staff:P1', 'research:P1', 'changes:P1', 'alias:P1', 'project:P1', 'plan:P1'], '칸마다 그 과제 몫만(연차 파일 → 예상 비용 파일)');
  assert.deepStrictEqual([me.st.staff.plans['P1@1'].people[0].name, me.st.staff.plans['P1@1'].budget, Object.keys(me.st.staff.plans).sort()], ['새사람', [{ name: '인건비', plan: 40000000 }], ['P1@1', 'P1@2']], '동료 계획(3000 > 1000)과 그 예산 줄');
  assert.deepStrictEqual([me.st.research['mw급과제#1'].rev, me.st.research['mw급과제#1'].goals, me.st.research['mw급과제#1'].linkBy, me.st.research['mw급과제#1'].src, me.st.research['mw급과제#2'].rev], ['r3', ['새 판'], 'auto', 'SSCB/1차년도.json', 'r1']);
  assert.deepStrictEqual(me.st.changes['P1@1'].map((c) => c.id), ['c10', 'c15'], '변경이력 합집합');
  assert.deepStrictEqual([me.st.aliases, me.st.aliasesAt, me.st.projects.P1.jobId, me.st.projects.P1.io, me.st.projects.P1.at], [{ P1: 'SSCB' }, { P1: 10 }, 'RND1', 'IO1', 100000], 'WORKSPACE 몫을 받은 시각 = 이번에 쓴 문서의 updatedAt(now)');
  assert.deepStrictEqual(me.st.plan.plans.P1['10|연구활동비'].map((e) => e.id).sort(), ['c', 'd'], 'd 받음 · a 는 묘비로 안 들어옴');
  assert.deepStrictEqual([Object.keys(me.st.plan.plans), me.st.plan.del], [['P1'], { a: { ts: 9, prj: 'P1' }, y: { ts: 9, prj: 'P9' } }], '다른 과제 묘비 그대로');
  const y1 = docOf(store, `${BASE}/SSCB`, '1차년도.json');
  assert.deepStrictEqual([y1.changes.map((c) => c.id), y1.research.map((x) => x.rev), y1.staff.plans[0].people[0].name, y1.updatedBy, y1.updatedAt, y1.project.jobId], [['c10', 'c15'], ['r3'], '새사람', '나', '1970-01-01T00:01:40.000Z', 'RND1']);
  assert.deepStrictEqual([Object.values(docOf(store, `${BASE}/SSCB`, '예상비용.json').plan.items).map((e) => e.id).sort(), docOf(store, `${BASE}/SSCB`, '예상비용.json').plan.del], [['c', 'd'], { a: 9 }]);
  assert.deepStrictEqual(docOf(store, `${BASE}/SSCB`, '2차년도.json').project.jobId, 'RND1', '2차년도 를 새로 만들 때 1차년도에서 받은 jobId 가 퍼진다');
  // 둘 다 같음
  const n0 = store.calls.length; me.saved.length = 0;
  const r2 = await Y.run(deps(store, me, { myPrjNos: ['P1'], leadPrjNos: [], now: 200000, index: r.state.index }));
  assert.deepStrictEqual([r2.state.written, r2.state.pulled, r2.state.pages.P1.pushed, r2.state.pages.P1.pulled, me.saved], [0, 0, false, false, []]);
  assert.ok(!store.calls.slice(n0).some((c) => c.startsWith('open')));
  // 동료가 다시 받으면 내 것(c · 묘비 a · 2차년도 · 2차 기록 · c10)이 들어온다
  const r3 = await Y.run(deps(store, you, { who: '동료', myPrjNos: ['P1'], leadPrjNos: ['P1'], now: 300000 }));
  assert.deepStrictEqual([r3.state.pages.P1.pulled, r3.state.pages.P1.pushed, you.st.plan.plans.P1['10|연구활동비'].map((e) => e.id).sort(), you.st.plan.del, Object.keys(you.st.staff.plans).sort(), you.st.research['mw급과제#2'].prjNm, you.st.changes['P1@1'].map((c) => c.id), you.st.changes['P1@2'] || []],
    [true, false, ['c', 'd'], { a: { ts: 9, prj: 'P1' } }, ['P1@1', 'P1@2'], '과제1', ['c10', 'c15'], []]);
});

await test('나와 공유: 동료 base(…/shared)와 과제 폴더 항목을 훑어 내 참여 과제(P2)면 그 폴더에 — writer 는 사이트마다 따로 · 남의 과제(P9)·연차 파일 없는 폴더는 무시(skip) · index 에 owner·site · 다음엔 index 만으로(discover 끄면 sharedWithMe 안 부름) · 참여자는 동료(책임자) 폴더를, 책임자는 내 폴더를 고른다', async () => {
  const p2doc = Object.assign(D.emptyYear({ prjNo: 'P2', prjNm: '과제2', rspr: '동료' }, 1), { staff: { plans: [splan('P2', 1, 500, [person('옛것', [1])], { prjNm: '과제2' })], del: {} }, updatedAt: '2026-10-18T00:00:00.000Z', updatedBy: '동료' });
  const tree = { [BASE]: {}, [YOUR_BASE]: {}, [`${YOUR_BASE}/MW`]: { '1차년도.json': D.serialize(p2doc) }, [`${YOUR_BASE}/ZZ`]: { '1차년도.json': D.serialize(D.emptyYear({ prjNo: 'P9' }, 1)) }, [`${YOU}/Documents/기타`]: { '메모.txt': 'x' } };
  const store = fakeStore(tree, { shared: [{ path: YOUR_BASE, ownerName: '동료' }, { path: `${YOU}/Documents/기타`, ownerName: '동료' }] });
  const me = memLocal({ staff: { plans: { 'P2@1': splan('P2', 1, 9000, [person('문창재', [1165000], 5823000)], { prjNm: '과제2' }) }, del: {} }, aliases: { P1: 'SSCB' } });
  const r = await Y.run(deps(store, me));
  assert.deepStrictEqual([r.state.ok, r.state.scanned, Object.keys(r.state.pages).sort()], [true, 3, ['P1', 'P2']], '동료 base 의 폴더 둘 + 기타 폴더를 훑음');
  assert.deepStrictEqual(Object.keys(r.state.skip).sort(), [`${YOU}/Documents/기타`, `${YOUR_BASE}/ZZ`].map((p) => p.toLowerCase()).sort(), '내 과제 폴더가 아닌 것(연차 파일 없음 · 남의 과제)은 skip');
  assert.deepStrictEqual([r.state.pages.P2.folder, r.state.pages.P2.owner, r.state.pages.P2.folderUrl, r.state.pages.P2.pushed, r.state.pages.P2.pulled, r.state.pages.P2.webUrl], ['MW', '동료', cfgOf(`${YOUR_BASE}/MW`).viewUrl, true, false, `${ORIGIN}${YOUR_BASE}/MW/1차년도.json`]);
  assert.deepStrictEqual(docOf(store, `${YOUR_BASE}/MW`, '1차년도.json').staff.plans[0].people[0].name, '문창재', '내 계획(9000)이 동료 폴더의 파일에 올라감');
  assert.deepStrictEqual([r.state.pages.P1.folder, r.state.pages.P1.owner], ['SSCB', '']);
  assert.deepStrictEqual(store.calls.filter((c) => c.startsWith('open')).sort(), [`open:${siteOf(BASE)}`, `open:${siteOf(YOUR_BASE)}`], '사이트마다 writer 하나');
  assert.deepStrictEqual(store.calls.filter((c) => c.startsWith('close')).length, 2);
  assert.deepStrictEqual(r.state.index.P2, { base: YOUR_BASE, folder: 'MW', site: siteOf(YOUR_BASE), path: `${YOUR_BASE}/MW`, url: furl(`${YOUR_BASE}/MW`), owner: '동료', at: 100000 });
  assert.ok(!('P9' in r.state.pages) && !('P9' in r.state.index));
  // index 만으로(discover 끔) — sharedWithMe 를 부르지 않고 parseFolder 로 cfg 를 되살려 그 폴더를 쓴다
  const n0 = store.calls.length;
  const r2 = await Y.run(deps(store, me, { now: 200000, index: r.state.index, discover: false }));
  assert.deepStrictEqual([r2.state.ok, r2.state.scanned, r2.state.pages.P2.folder, r2.state.pages.P2.owner, r2.state.pages.P2.pushed, r2.state.index.P2.owner], [true, 0, 'MW', '동료', false, '동료']);
  assert.ok(!store.calls.slice(n0).includes('shared'));
  // 책임자는 내 base 의 폴더를, 참여자는 동료 폴더를 — P1 이 동료 base 에도 있고 내 base 에도 있으면 내 것(책임자) · P2 가 내 base 에도 있으면 동료 것(참여자)
  tree[`${YOUR_BASE}/P1-copy`] = { '1차년도.json': D.serialize(D.emptyYear({ prjNo: 'P1', prjNm: '과제1' }, 1)) };
  tree[`${BASE}/P2-mine`] = { '1차년도.json': D.serialize(D.emptyYear({ prjNo: 'P2', prjNm: '과제2' }, 1)) };
  const r3 = await Y.run(deps(store, me, { now: 300000 }));
  assert.deepStrictEqual([r3.state.pages.P1.folder, r3.state.pages.P1.owner, r3.state.pages.P2.folder, r3.state.pages.P2.owner], ['SSCB', '', 'MW', '동료']);
  // 동료 사이트의 권한 오류(공유가 풀림)는 그 과제만(전체 실패 아님) — 참여자라 내 base 의 사본(P2-mine)보다 색인의 동료 폴더를 고르므로 조용히 내 사본으로 돌아가지 않고 알린다
  const store2 = fakeStore(clone(tree), { shared: [{ path: YOUR_BASE, ownerName: '동료' }], denied: [siteOf(YOUR_BASE)] });
  const r4 = await Y.run(deps(store2, memLocal({ aliases: { P1: 'SSCB' } }), { index: r.state.index }));
  assert.deepStrictEqual([r4.state.ok, r4.state.pages.P1.error, r4.state.pages.P1.pushed, r4.state.pages.P2.kind, r4.state.pages.P2.folder, r4.state.kind, /권한/.test(r4.state.discoverError)], [false, undefined, false, 'auth', 'MW', 'auth', true]);
});

await test('나와 공유 (2026-10-25): 동료의 밑폴더가 shared 가 아니어도 과제 폴더를 연차 파일로 찾음 · 같은 과제 폴더가 여럿이면 누가 돌려도 같은 것(책임자 폴더 → 경로 차례) · skip 은 이레 동안 다시 훑지 않음(그사이 그 과제 참여인력이 되면 다시)', async () => {
  const KIM = '/personal/kim', LEE = '/personal/lee';
  const KIM_DIR = `${KIM}/Documents/연구/공유/MW`, LEE_DIR = `${LEE}/Documents/RnD/MW`, JUNK = `${LEE}/Documents/잡동사니`;
  const y = () => ({ '1차년도.json': D.serialize(D.emptyYear({ prjNo: 'P2', prjNm: '과제2', rspr: '동료' }, 1)) });
  const tree = { [BASE]: {}, [`${KIM}/Documents/연구/공유`]: {}, [KIM_DIR]: y(), [`${LEE}/Documents/RnD`]: {}, [LEE_DIR]: y(), [JUNK]: { 'a.txt': 'x' } };
  const shared = [{ path: LEE_DIR, ownerName: '이' }, { path: KIM_DIR, ownerName: '김' }, { path: JUNK, ownerName: '이' }];
  // 나(참여자) — 김·이 둘 다 책임자가 아니면 경로가 앞선 김의 폴더, 목록 차례를 뒤집어도 같음
  for (const list of [shared, shared.slice().reverse()]) {
    const r = await Y.run(deps(fakeStore(clone(tree), { shared: list }), memLocal({}), { leadPrjNos: [] }));
    assert.deepStrictEqual([r.state.ok, r.state.pages.P2.owner, r.state.index.P2.path], [true, '김', KIM_DIR]);
  }
  // 김(참여자 — 자기 base 가 연구/공유)도 이(자기 base 가 RnD)도 같은 김의 폴더를 고른다 — 서로 상대 폴더를 골라 갈라지지 않음
  const kim = await Y.run(deps(fakeStore(clone(tree), { shared: [{ path: LEE_DIR, ownerName: '이' }] }), memLocal({}), { base: cfgOf(`${KIM}/Documents/연구/공유`), leadPrjNos: [] }));
  const lee = await Y.run(deps(fakeStore(clone(tree), { shared: [{ path: KIM_DIR, ownerName: '김' }] }), memLocal({}), { base: cfgOf(`${LEE}/Documents/RnD`), leadPrjNos: [] }));
  assert.deepStrictEqual([kim.state.index.P2.path, kim.state.index.P2.owner, lee.state.index.P2.path, lee.state.index.P2.owner], [KIM_DIR, '', KIM_DIR, '김']);
  // 책임자('동료' — rsprs.P2)의 폴더가 있으면 경로와 상관없이 그것
  const t2 = Object.assign(clone(tree), { [`${YOUR_BASE}/MW`]: y() });
  const r3 = await Y.run(deps(fakeStore(t2, { shared: shared.concat([{ path: `${YOUR_BASE}/MW`, ownerName: '동 료' }]) }), memLocal({}), { leadPrjNos: [] }));
  assert.deepStrictEqual([r3.state.index.P2.path, r3.state.index.P2.owner], [`${YOUR_BASE}/MW`, '동 료'], '주인 이름은 공백 무시');
  // skip — 연차 파일 없는 폴더는 이레 동안 다시 훑지 않고, 이레가 지나면 다시
  const r4 = await Y.run(deps(fakeStore(clone(tree), { shared }), memLocal({}), { leadPrjNos: [] }));
  assert.deepStrictEqual(r4.state.skip[JUNK.toLowerCase()], { at: 100000, prj: '' });
  const s5 = fakeStore(clone(tree), { shared });
  await Y.run(deps(s5, memLocal({}), { leadPrjNos: [], skip: r4.state.skip, now: 100000 + 6 * 86400000 }));
  assert.ok(!s5.calls.includes(`list:${JUNK}`), '이레 안 — 안 훑음');
  const s6 = fakeStore(clone(tree), { shared });
  await Y.run(deps(s6, memLocal({}), { leadPrjNos: [], skip: r4.state.skip, now: 100000 + 7 * 86400000 }));
  assert.ok(s6.calls.includes(`list:${JUNK}`), '이레 지남 — 다시 훑음');
  // 남의 과제(P2 — 내 참여 과제가 아님) 폴더는 skip 에 과제번호와 함께 → 그 과제 참여인력이 되면 이레를 기다리지 않고 다시 훑어 연결
  const r7 = await Y.run(deps(fakeStore(clone(tree), { shared }), memLocal({}), { leadPrjNos: [], myPrjNos: ['P1'] }));
  assert.deepStrictEqual([r7.state.skip[KIM_DIR.toLowerCase()], 'P2' in r7.state.pages], [{ at: 100000, prj: 'P2' }, false]);
  const r8 = await Y.run(deps(fakeStore(clone(tree), { shared }), memLocal({}), { leadPrjNos: [], skip: r7.state.skip, now: 200000 }));
  assert.deepStrictEqual([r8.state.index.P2.path, KIM_DIR.toLowerCase() in r8.state.skip], [KIM_DIR, false]);
});

await test('색인(index): 경로가 맞으면 훑지 않고(scanned 0) 첫 읽기에서 과제번호로 검증 · 폴더가 없어진 색인은 버리고 다시 훑는다 · 색인의 폴더가 실제로 다른 과제 것이면 그 과제에 돌리고 이 과제는 새로 고른다', async () => {
  const tree = { [BASE]: {}, [`${BASE}/X`]: { '1차년도.json': D.serialize(D.emptyYear({ prjNo: 'P2', prjNm: '과제2' }, 1)) } };
  // 적중
  const hit = await Y.run(deps(fakeStore(clone(tree)), memLocal({}), { index: { P2: { base: BASE, folder: 'X', site: siteOf(BASE), path: `${BASE}/X`, url: `${ORIGIN}${BASE}/X`, owner: '', at: 1 } }, leadPrjNos: [] }));
  assert.deepStrictEqual([hit.state.scanned, hit.state.pages.P2.folder, hit.state.pages.P1.noFolder, hit.state.index.P2.folder, hit.state.index.P2.at], [0, 'X', true, 'X', 100000]);
  // 불일치: 색인은 OLD 인데 폴더가 없다 → 버리고 X 를 훑어 P2 를 찾는다
  const miss = await Y.run(deps(fakeStore(clone(tree)), memLocal({}), { index: { P2: { base: BASE, folder: 'OLD', path: `${BASE}/OLD` } }, leadPrjNos: [] }));
  assert.deepStrictEqual([miss.state.scanned, miss.state.pages.P2.folder, miss.state.index.P2.folder, JSON.stringify(miss.state.index).includes('OLD')], [1, 'X', 'X', false]);
  // 색인이 P1 → X 라는데 X 의 파일은 P2 것 → P2 에 돌리고 P1(책임자)은 약칭 폴더를 새로 만든다
  const store = fakeStore(clone(tree));
  const me = memLocal({ aliases: { P1: 'SSCB' } });
  const r = await Y.run(deps(store, me, { index: { P1: { base: BASE, folder: 'X', path: `${BASE}/X` } } }));
  assert.deepStrictEqual([r.state.ok, r.state.scanned, r.state.pages.P1.folder, r.state.pages.P1.folderCreated, r.state.pages.P2.folder, r.state.index.P1.folder, r.state.index.P2.folder], [true, 0, 'SSCB', true, 'X', 'SSCB', 'X']);
  assert.deepStrictEqual(Object.keys(store.tree).filter((k) => k.startsWith(`${BASE}/`)).sort(), [`${BASE}/SSCB`, `${BASE}/X`]);
  assert.deepStrictEqual(docOf(store, `${BASE}/X`, '1차년도.json').project.prjNo, 'P2', 'X 를 P1 것으로 덮어쓰지 않음');
});

await test('깨진 파일·v1 파일: 그 파일만 kind parse 로 건너뛰고(덮어쓰지 않음) 같은 과제의 다른 연차·예상 비용은 계속 · 폴더의 P1.json(v1) 과 다른 파일은 건드리지 않음 · 연차가 이름과 다른 파일도 parse', async () => {
  const good2 = D.serialize(Object.assign(D.emptyYear({ prjNo: 'P1', prjNm: '과제1' }, 2), { updatedAt: '2026-10-18T00:00:00.000Z', updatedBy: '동료' }));
  const tree = { [BASE]: {}, [`${BASE}/SSCB`]: { '1차년도.json': '{"v":2, 깨짐', '2차년도.json': good2, '3차년도.json': JSON.stringify({ v: 1, prjNo: 'P1', plan: { items: {} } }), '4차년도.json': D.serialize(D.emptyYear({ prjNo: 'P1' }, 5)), 'P1.json': '{"v":1,"prjNo":"P1"}', '메모.txt': 'x' } };
  const store = fakeStore(clone(tree), { index: {} });
  const me = memLocal({ aliases: { P1: 'SSCB' }, plan: { plans: { P1: { K: [item('a', 1)] } }, del: {} }, staff: { plans: { 'P1@2': splan('P1', 2, 2000, [person('홍길동', [1000000], 5000000)]) }, del: {} } });
  const r = await Y.run(deps(store, me, { myPrjNos: ['P1'] }));
  const pg = r.state.pages.P1;
  assert.deepStrictEqual([r.state.ok, r.state.errors, r.state.kind, pg.kind, pg.years, pg.pushed, pg.planUrl], [false, 1, 'parse', 'parse', [2], true, `${ORIGIN}${BASE}/SSCB/예상비용.json`], '1·3·4차는 건너뛰고 2차와 예상 비용은 씀');
  assert.ok(/1차년도\.json/.test(pg.error) && /지우면 다시/.test(r.state.error));
  assert.deepStrictEqual([store.tree[`${BASE}/SSCB`]['1차년도.json'], store.tree[`${BASE}/SSCB`]['3차년도.json'], store.tree[`${BASE}/SSCB`]['4차년도.json'], store.tree[`${BASE}/SSCB`]['P1.json']], [tree[`${BASE}/SSCB`]['1차년도.json'], tree[`${BASE}/SSCB`]['3차년도.json'], tree[`${BASE}/SSCB`]['4차년도.json'], '{"v":1,"prjNo":"P1"}'], '덮어쓰지 않음');
  assert.deepStrictEqual(docOf(store, `${BASE}/SSCB`, '2차년도.json').staff.plans.map((p) => p.year), [2]);
  assert.ok(!store.calls.some((c) => c === `modify:${BASE}/SSCB/1차년도.json` || c === `modify:${BASE}/SSCB/3차년도.json` || c === `modify:${BASE}/SSCB/P1.json`));
  assert.deepStrictEqual([me.saved, me.st.plan.plans.P1.K[0].id], [[], 'a'], '로컬 보존');
  assert.strictEqual(pg.webUrl, `${ORIGIN}${BASE}/SSCB/1차년도.json`, '있는 파일(깨진 것도)은 주소를 걸어 열어 볼 수 있게');
  // 폴더를 훑을 때 첫 연차 파일이 깨져 있으면 그 폴더는 못 알아본 폴더 — 책임자가 같은 이름으로 만들 차례면 그것을 쓴다
  const r2 = await Y.run(deps(fakeStore(clone(tree)), memLocal({ aliases: { P1: 'SSCB' } }), { myPrjNos: ['P1'] }));
  assert.deepStrictEqual([r2.state.pages.P1.folder, r2.state.pages.P1.kind, r2.state.pages.P1.years], ['SSCB', 'parse', [2]]);
});

await test('남이 체크아웃(locked): 그 파일만 실패하고 같은 과제의 다른 파일·다른 과제는 계속 · writer 는 닫힘 · 만들지 못한 파일에는 webUrl 을 걸지 않는다', async () => {
  const store = fakeStore({ [BASE]: {} }, { locked: [`${BASE}/SSCB/1차년도.json`] });
  const me = memLocal({ aliases: { P1: 'SSCB', P2: 'X' }, plan: { plans: { P1: { K: [item('a', 1)] }, P2: { K: [item('b', 1)] } }, del: {} } });
  const r = await Y.run(deps(store, me, { leadPrjNos: ['P1', 'P2'] }));
  assert.deepStrictEqual([r.state.ok, r.state.errors, r.state.kind, r.state.pages.P1.kind, r.state.pages.P1.years, r.state.pages.P1.planUrl, r.state.pages.P2.pushed, r.state.pages.P2.created], [false, 1, 'locked', 'locked', [], `${ORIGIN}${BASE}/SSCB/예상비용.json`, true, true]);
  assert.ok(/체크아웃/.test(r.state.error));
  assert.deepStrictEqual([Object.keys(store.tree[`${BASE}/SSCB`]), Object.keys(store.tree[`${BASE}/X`]).sort()], [['예상비용.json'], ['1차년도.json', '예상비용.json']]);
  assert.ok(store.calls[store.calls.length - 1].startsWith('close:'));
  assert.deepStrictEqual([r.state.pages.P1.webUrl, r.state.pages.P2.webUrl], ['', `${ORIGIN}${BASE}/X/1차년도.json`], '없는 파일 주소(404)를 ↗ 에 걸지 않는다');
});

await test('로그인 필요(auth)·작업 탭 실패(tab)는 전체 실패로 — 던지지 않고 state.kind 로, 나머지 과제는 멈춤 · 나와 공유 목록의 http 오류는 discoverError 로만', async () => {
  const idx = { P1: { base: BASE, folder: 'SSCB', site: siteOf(BASE), path: `${BASE}/SSCB`, url: furl(`${BASE}/SSCB`), owner: '', at: 1 } };
  const r = await Y.run(deps(fakeStore({ [BASE]: {} }, { authList: true }), memLocal({}), { index: idx }));
  assert.deepStrictEqual([r.state.ok, r.state.kind, r.state.count, r.state.pages, r.state.index], [false, 'auth', 0, {}, idx], '로그인 만료로 멈추면 지난 색인은 그대로');
  assert.ok(/로그인/.test(r.state.error));
  const store = fakeStore({ [BASE]: {} }, { openFail: 'tab' });
  const me = memLocal({ aliases: { P1: 'A', P2: 'B' }, plan: { plans: { P1: { K: [item('a', 1)] }, P2: { K: [item('b', 1)] } }, del: {} } });
  const r2 = await Y.run(deps(store, me, { leadPrjNos: ['P1', 'P2'] }));
  assert.deepStrictEqual([r2.state.ok, r2.state.kind, r2.state.pages.P1.kind, 'P2' in r2.state.pages, store.calls.filter((c) => c.startsWith('open')).length], [false, 'tab', 'tab', false, 1]);
  const r3 = await Y.run(deps(fakeStore({ [BASE]: {} }, { sharedFail: 'http' }), memLocal({ aliases: { P1: 'A' } }), { myPrjNos: ['P1'] }));
  assert.deepStrictEqual([r3.state.ok, r3.state.pages.P1.pushed, /나와 공유/.test(r3.state.discoverError)], [true, true, true]);
  // 나와 공유 끝점만 auth(테넌트 정책으로 403) — base 목록은 이미 성공했으므로 전체 실패가 아니라 discoverError 로만, 내 base 의 과제는 계속 쓴다(offline 은 여전히 전체 실패)
  const r4 = await Y.run(deps(fakeStore({ [BASE]: {} }, { sharedFail: 'auth' }), memLocal({ aliases: { P1: 'A' } }), { myPrjNos: ['P1'] }));
  assert.deepStrictEqual([r4.state.ok, r4.state.kind, r4.state.pages.P1.pushed, r4.state.pages.P1.folder, /나와 공유/.test(r4.state.discoverError)], [true, undefined, true, 'A', true]);
  const r5 = await Y.run(deps(fakeStore({ [BASE]: {} }, { sharedFail: 'offline' }), memLocal({ aliases: { P1: 'A' } }), { myPrjNos: ['P1'] }));
  assert.deepStrictEqual([r5.state.ok, r5.state.kind, r5.state.pages], [false, 'offline', {}]);
});

await test('같은 약칭의 두 과제: 둘째는 <이름>-<과제번호> 폴더로 비켜 가 첫째의 파일을 덮지 않는다 · base 에 다른 과제로 확인된 같은 이름 폴더가 있어도 비켜 간다 · 체크아웃한 최신 글이 남의 과제 것이면 쓰지 않고(discard) 다시 고른다 · 이미 있던 폴더는 created 가 아니다', async () => {
  const store = fakeStore({ [BASE]: {} });
  const me = memLocal({ aliases: { P1: 'SSCB', P2: 'SSCB' }, staff: { plans: { 'P1@1': splan('P1', 1, 1000, [person('문창재', [1165000], 5823000)]), 'P2@1': splan('P2', 1, 1000, [person('홍길동', [1000000], 5000000)], { prjNm: '과제2' }) }, del: {} } });
  const r = await Y.run(deps(store, me, { leadPrjNos: ['P1', 'P2'] }));
  assert.deepStrictEqual([r.state.ok, r.state.pages.P1.folder, r.state.pages.P2.folder, r.state.created.sort()], [true, 'SSCB', 'SSCB-P2', ['P1', 'P2']]);
  assert.deepStrictEqual(Object.keys(store.tree).filter((k) => k.startsWith(`${BASE}/`)).sort(), [`${BASE}/SSCB`, `${BASE}/SSCB-P2`]);
  assert.deepStrictEqual([docOf(store, `${BASE}/SSCB`, '1차년도.json').project.prjNo, docOf(store, `${BASE}/SSCB`, '1차년도.json').staff.plans[0].people[0].name, docOf(store, `${BASE}/SSCB-P2`, '1차년도.json').project.prjNo, docOf(store, `${BASE}/SSCB-P2`, '1차년도.json').staff.plans[0].people[0].name], ['P1', '문창재', 'P2', '홍길동']);
  assert.notStrictEqual(r.state.index.P1.path, r.state.index.P2.path);
  assert.deepStrictEqual([r.state.index.P1.folder, r.state.index.P2.folder], ['SSCB', 'SSCB-P2']);
  // 다시 돌려도 같은 폴더(색인·훑기 모두) — 두 번째 run 은 색인 없이 훑어서도 SSCB-P2 를 P2 로 알아본다
  const r2 = await Y.run(deps(store, me, { leadPrjNos: ['P1', 'P2'], now: 200000 }));
  assert.deepStrictEqual([r2.state.pages.P1.folder, r2.state.pages.P2.folder, r2.state.written, Object.keys(store.tree).filter((k) => k.startsWith(`${BASE}/`)).length], ['SSCB', 'SSCB-P2', 0, 2]);
  // base 에 P2 것으로 확인된 폴더 'SSCB' 가 이미 있고 P1(책임자)의 약칭도 SSCB → P1 은 SSCB-P1
  const store2 = fakeStore({ [BASE]: {}, [`${BASE}/SSCB`]: { '1차년도.json': D.serialize(D.emptyYear({ prjNo: 'P2', prjNm: '과제2' }, 1)) } });
  const r3 = await Y.run(deps(store2, memLocal({ aliases: { P1: 'SSCB' } }), { myPrjNos: ['P1'] }));
  assert.deepStrictEqual([r3.state.pages.P1.folder, docOf(store2, `${BASE}/SSCB`, '1차년도.json').project.prjNo, 'SSCB-P1' in Object.fromEntries(Object.keys(store2.tree).map((k) => [k.split('/').pop(), 1]))], ['SSCB-P1', 'P2', true]);
  // 체크아웃한 최신 글이 남의 과제 것(그 사이 누가 SSCB/1차년도.json 을 P9 파일로 바꿔 놓음) → 쓰지 않고(discard → undo) 색인을 돌려 P1 은 SSCB-P1 에 새로
  const p9 = D.serialize(Object.assign(D.emptyYear({ prjNo: 'P9', prjNm: '남의 과제' }, 1), { updatedAt: '2026-10-18T00:00:00.000Z', updatedBy: '남' }));
  const store3 = fakeStore({ [BASE]: {}, [`${BASE}/SSCB`]: { '1차년도.json': D.serialize(D.emptyYear({ prjNo: 'P1', prjNm: '과제1' }, 1)) } }, { beforeModify: (p, name, tree) => { if (p === `${BASE}/SSCB` && name === '1차년도.json') tree[p][name] = p9; } });
  const me3 = memLocal({ aliases: { P1: 'SSCB' }, changes: { 'P1@1': [change('c1', '2026-10-01', '기타', 'x', '', '')] } });
  const r4 = await Y.run(deps(store3, me3, { myPrjNos: ['P1'] }));
  assert.deepStrictEqual([r4.state.ok, r4.state.pages.P1.folder, r4.state.pages.P1.pushed, store3.tree[`${BASE}/SSCB`]['1차년도.json'], docOf(store3, `${BASE}/SSCB-P1`, '1차년도.json').project.prjNo, docOf(store3, `${BASE}/SSCB-P1`, '1차년도.json').changes.map((c) => c.id)], [true, 'SSCB-P1', true, p9, 'P1', ['c1']], 'P9 파일은 그대로 · P1 자료는 새 폴더에');
  assert.ok(store3.calls.includes(`undo:${BASE}/SSCB/1차년도.json`) && !store3.calls.includes(`put:${BASE}/SSCB/1차년도.json`), '남의 파일에 PUT 없음(체크아웃 되돌림)');
  assert.deepStrictEqual([r4.state.index.P1.folder, r4.state.index.P9.folder], ['SSCB-P1', 'SSCB'], '그 폴더는 실제 과제(P9)의 것으로 색인');
  // 폴더 목록이 비었는데 폴더가 실제로는 이미 있으면(그 사이 동료가 만듦) ensurePath 가 만든 것이 없다고 하므로 created 가 아니다 → 참여연구원 자동 공유를 다시 하지 않는다
  const store4 = fakeStore({ [BASE]: {}, [`${BASE}/SSCB`]: {} });
  const listFolders0 = store4.listFolders; store4.listFolders = async (cfg, io) => (cfg.folderPath === BASE ? [] : listFolders0(cfg, io));
  const r5 = await Y.run(deps(store4, memLocal({ aliases: { P1: 'SSCB' } }), { myPrjNos: ['P1'] }));
  assert.deepStrictEqual([r5.state.pages.P1.folder, r5.state.pages.P1.pushed, r5.state.pages.P1.folderCreated, r5.state.created], ['SSCB', true, undefined, []]);
});

await test('색인에 남은 동료 폴더가 없어졌으면(지움·이름 바꿈) 동료 사이트에 새로 만들지 않는다 — 색인을 버리고(state.index 에서 빠짐) 다시 고름: 밀어냈던 내 base 폴더(alt) → 책임자·로컬 자료면 내 base 에 새로 → 아니면 noFolder', async () => {
  const idx = { P2: { base: YOUR_BASE, folder: '과제2', site: siteOf(YOUR_BASE), path: `${YOUR_BASE}/과제2`, url: furl(`${YOUR_BASE}/과제2`), owner: '동료', at: 1 } };
  // 참여자 · 로컬 자료 없음 → noFolder, 동료 사이트는 열지도 만들지도 않음, 색인에서 빠짐
  const store = fakeStore({ [BASE]: {}, [YOUR_BASE]: {} });
  const r = await Y.run(deps(store, memLocal({}), { index: clone(idx), leadPrjNos: [], discover: false }));
  assert.deepStrictEqual([r.state.ok, r.state.pages.P2.noFolder, r.state.pages.P2.kind, r.state.pages.P2.error, 'P2' in r.state.index, `${YOUR_BASE}/과제2` in store.tree], [true, true, 'nofolder', undefined, false, false]);
  assert.ok(!store.calls.some((c) => c.startsWith('open') || c.startsWith('ensure')), 'writer 를 열지 않음');
  // 참여자 · 로컬 자료 있음 → 내 base 에 새로(동료 사이트 아님)
  const store2 = fakeStore({ [BASE]: {}, [YOUR_BASE]: {} });
  const me2 = memLocal({ staff: { plans: { 'P2@1': splan('P2', 1, 9000, [person('문창재', [1165000], 5823000)], { prjNm: '과제2' }) }, del: {} } });
  const r2 = await Y.run(deps(store2, me2, { index: clone(idx), leadPrjNos: [], discover: false }));
  assert.deepStrictEqual([r2.state.ok, r2.state.pages.P2.folder, r2.state.pages.P2.owner, r2.state.pages.P2.pushed, r2.state.pages.P2.folderCreated, Object.keys(store2.tree).filter((k) => k.includes('과제2') || k.endsWith('/P2')), r2.state.index.P2.base, r2.state.index.P2.owner], [true, 'P2', '', true, true, [`${BASE}/P2`], BASE, '']);
  assert.deepStrictEqual(store2.calls.filter((c) => c.startsWith('open')), [`open:${siteOf(BASE)}`], '내 사이트만');
  // 내 base 에 P2 사본이 있었으면(pick 이 동료 폴더로 밀어냄 — alt) 그 사본으로 되돌아간다
  const store3 = fakeStore({ [BASE]: {}, [`${BASE}/P2-mine`]: { '1차년도.json': D.serialize(D.emptyYear({ prjNo: 'P2', prjNm: '과제2' }, 1)) }, [YOUR_BASE]: {} });
  const r3 = await Y.run(deps(store3, me2, { index: clone(idx), leadPrjNos: [], discover: false }));
  assert.deepStrictEqual([r3.state.ok, r3.state.pages.P2.folder, r3.state.pages.P2.owner, r3.state.pages.P2.pushed, r3.state.index.P2.folder, Object.keys(store3.tree).filter((k) => k.startsWith(`${YOUR_BASE}/`))], [true, 'P2-mine', '', true, 'P2-mine', []]);
  // 동료 폴더가 있으면 그대로 그 폴더(비교)
  const store4 = fakeStore({ [BASE]: {}, [YOUR_BASE]: {}, [`${YOUR_BASE}/과제2`]: { '1차년도.json': D.serialize(D.emptyYear({ prjNo: 'P2', prjNm: '과제2' }, 1)) } });
  const r4 = await Y.run(deps(store4, me2, { index: clone(idx), leadPrjNos: [], discover: false }));
  assert.deepStrictEqual([r4.state.pages.P2.folder, r4.state.pages.P2.owner, r4.state.index.P2.owner], ['과제2', '동료', '동료']);
});

await test('예상비용.json 만 다른 과제 것이면(연차 파일은 맞음) 그 파일만 kind parse 로 건너뛰고 덮어쓰지 않는다 — 폴더는 그대로 이 과제 것', async () => {
  const foreign = D.serialize(Object.assign(D.emptyPlan({ prjNo: 'P2', prjNm: '과제2' }), { plan: { items: [item('z', 1, { prj: 'P2', key: 'K' })], del: {} }, updatedAt: '2026-10-18T00:00:00.000Z', updatedBy: '동료' }));
  const store = fakeStore({ [BASE]: {}, [`${BASE}/SSCB`]: { '1차년도.json': D.serialize(D.emptyYear({ prjNo: 'P1', prjNm: '과제1' }, 1)), '예상비용.json': foreign } });
  const me = memLocal({ aliases: { P1: 'SSCB' }, plan: { plans: { P1: { K: [item('a', 1)] } }, del: {} } });
  const r = await Y.run(deps(store, me, { myPrjNos: ['P1'] }));
  const pg = r.state.pages.P1;
  assert.deepStrictEqual([r.state.ok, pg.folder, pg.kind, /다른 과제\(P2\)/.test(pg.error), pg.years, store.tree[`${BASE}/SSCB`]['예상비용.json'], me.st.plan.plans.P1.K.map((e) => e.id), pg.planUrl], [false, 'SSCB', 'parse', true, [1], foreign, ['a'], `${ORIGIN}${BASE}/SSCB/예상비용.json`]);
  assert.ok(!store.calls.some((c) => c.startsWith(`put:${BASE}/SSCB/예상비용.json`)), '덮어쓰지 않음');
  assert.deepStrictEqual([r.state.index.P1.folder, 'P2' in r.state.index], ['SSCB', false], '폴더는 이 과제 것 그대로');
});

await test('want 로 끈 칸: 파일의 그 칸은 받지도 덮지도 않고 그대로 · plan 을 끄면 예상비용.json 은 읽지도 쓰지도 않음', async () => {
  const doc = Object.assign(D.emptyYear({ prjNo: 'P1', prjNm: '과제1' }, 1), { research: [D.cleanRec(rec('P1', 1, 'r2', 3))], staff: { plans: [splan('P1', 1, 1000, [person('문창재', [1165000], 5823000)])], del: {} }, changes: [change('c1', '2026-10-01', '기타', 'x', '', '')], updatedAt: '2026-10-18T00:00:00.000Z', updatedBy: '동료' });
  const store = fakeStore({ [BASE]: {}, [`${BASE}/SSCB`]: { '1차년도.json': D.serialize(doc), '예상비용.json': D.serialize(Object.assign(D.emptyPlan({ prjNo: 'P1' }), { plan: { items: [item('q', 1, { prj: 'P1', key: 'K' })], del: {} } })) } });
  const me = memLocal({ aliases: { P1: 'SSCB' }, plan: { plans: { P1: { K: [item('b', 6)] } }, del: {} }, research: { 'mw급과제#2': rec('P1', 2, 'r0', 1) }, staff: { plans: { 'P1@2': splan('P1', 2, 5, [person('x', [1])]) }, del: {} }, changes: { 'P1@1': [change('c9', '2026-10-09', '기타', 'y', '', '')] } });
  const r = await Y.run(deps(store, me, { myPrjNos: ['P1'], want: { plan: false, research: false, staff: false, budget: false, changes: false, alias: true } }));
  const back = docOf(store, `${BASE}/SSCB`, '1차년도.json');
  assert.deepStrictEqual([r.state.pages.P1.pushed, r.state.pages.P1.years, me.saved, back.research.map((x) => x.n), back.staff.plans.map((x) => x.year), back.changes.map((c) => c.id), back.budget], [true, [1, 2], [], [1], [1], ['c1'], []], '1차년도는 project(ERP 칸)만 맞추고 2차년도는 빈 껍데기');
  assert.deepStrictEqual([Object.keys(me.st.research), Object.keys(me.st.staff.plans), me.st.changes['P1@1'].map((c) => c.id)], [['mw급과제#2'], ['P1@2'], ['c9']]);
  assert.ok(!store.calls.some((c) => /예상비용\.json/.test(c)), '예상비용.json 은 건드리지 않음');
  assert.deepStrictEqual([r.state.pages.P1.planUrl, r.state.pages.P1.counts.plan], ['', 0]);
});

await test('pullOnly(받기만 — KRS WORKSPACE 몫): plan 이면 예상비용.json 을 읽어 로컬에 받기만 하고 쓰지도 만들지도 않음(로컬에만 있는 항목은 올라가지 않음) · year 면 연차 파일도 같은 식 · 파일·폴더가 없으면 만들지도 않음', async () => {
  const pl = Object.assign(D.emptyPlan({ prjNo: 'P1', prjNm: '과제1' }), { plan: { items: [item('q', 1, { prj: 'P1', key: 'K' })], del: {} }, updatedAt: '2026-10-18T00:00:00.000Z', updatedBy: '동료' });
  const y1 = Object.assign(D.emptyYear({ prjNo: 'P1', prjNm: '과제1', alias: 'SSCB', aliasAt: 10 }, 1), { changes: [change('c1', '2026-10-01', '기타', 'x', '', '')], updatedAt: '2026-10-18T00:00:00.000Z', updatedBy: '동료' });
  const store = fakeStore({ [BASE]: {}, [`${BASE}/SSCB`]: { '1차년도.json': D.serialize(y1), '예상비용.json': D.serialize(pl) } });
  const me = memLocal({ aliases: { P1: 'SSCB' }, plan: { plans: { P1: { K: [item('b', 6)] } }, del: {} }, changes: { 'P1@1': [change('c9', '2026-10-09', '기타', 'y', '', '')] } });
  // ① plan 만 받기 — 연차 파일(변경이력 c9)은 양방향이라 쓴다
  const r = await Y.run(deps(store, me, { myPrjNos: ['P1'], pullOnly: { plan: true } }));
  assert.deepStrictEqual([r.state.ok, r.state.pages.P1.pulled, r.state.pages.P1.pushed, r.state.written, me.saved], [true, true, true, 1, ['changes:P1', 'plan:P1']], '연차 파일만 씀(변경이력 합집합) · 예상 비용은 받기만');
  assert.deepStrictEqual([me.st.plan.plans.P1.K.map((e) => e.id).sort(), docOf(store, `${BASE}/SSCB`, '예상비용.json').plan.items.map((e) => e.id)], [['b', 'q'], ['q']], '동료 항목 q 는 받고 내 항목 b 는 올라가지 않음');
  assert.deepStrictEqual(store.calls.filter((c) => /예상비용\.json/.test(c)), [`read:${BASE}/SSCB/예상비용.json`], '예상비용.json 은 읽기만');
  assert.deepStrictEqual([r.state.pages.P1.planUrl, r.state.pages.P1.counts.plan, docOf(store, `${BASE}/SSCB`, '1차년도.json').changes.map((c) => c.id)], [`${ORIGIN}${BASE}/SSCB/예상비용.json`, 2, ['c1', 'c9']]);
  // ② year 도 받기만 — 동료의 변경이력을 받되 내 것은 올리지 않고, 파일이 없는 2차년도는 만들지 않는다
  const me2 = memLocal({ aliases: { P1: 'SSCB' }, changes: { 'P1@1': [change('c8', '2026-10-08', '기타', 'z', '', '')], 'P1@2': [change('c30', '2026-10-06', '연구기간', '기간', '', '')] } });
  const n0 = store.calls.length;
  const r2 = await Y.run(deps(store, me2, { myPrjNos: ['P1'], pullOnly: { plan: true, year: true } }));
  assert.deepStrictEqual([r2.state.ok, r2.state.written, r2.state.pages.P1.pulled, r2.state.pages.P1.pushed, r2.state.pages.P1.years, me2.saved, me2.st.changes['P1@1'].map((c) => c.id), me2.st.plan.plans.P1.K.map((e) => e.id)], [true, 0, true, false, [1, 2], ['changes:P1', 'plan:P1'], ['c1', 'c8', 'c9'], ['q']], '동료 변경이력 c1 과 예상 비용 q 를 받음');
  assert.deepStrictEqual([docOf(store, `${BASE}/SSCB`, '1차년도.json').changes.map((c) => c.id), Object.keys(store.tree[`${BASE}/SSCB`]).sort()], [['c1', 'c9'], ['1차년도.json', '예상비용.json']], '파일은 그대로 · 2차년도.json 안 만듦');
  assert.ok(!store.calls.slice(n0).some((c) => /^(open|modify|ensure)/.test(c)), 'writer 를 열지 않음');
  // ③ 폴더조차 없는 책임자 과제 — 받을 것이 없고 만들지도 않는다
  const empty = fakeStore({ [BASE]: {} });
  const me3 = memLocal(myLocal());
  const r3 = await Y.run(deps(empty, me3, { myPrjNos: ['P1'], pullOnly: { plan: true, year: true } }));
  assert.deepStrictEqual([r3.state.ok, r3.state.written, r3.state.created, Object.keys(empty.tree), r3.state.index, r3.state.pages.P1.noFolder], [true, 0, [], [BASE], {}, undefined]);
});

await test('작업 탭을 여는 사이에 동료가 쓴 것(체크아웃한 최신 글)을 다시 병합해 잃지 않고 새로 받은 것은 로컬에도 넣는다 · 그 사이 패널에서 고친 항목은 덮지 않는다(pull 이 저장 직전에 로컬을 다시 읽어 다시 병합)', async () => {
  const me = memLocal({ aliases: { P1: 'SSCB' }, plan: { plans: { P1: { K: [item('a', 1)] } }, del: {} }, staff: { plans: { 'P1@1': splan('P1', 1, 1000, [person('문창재', [1165000], 5823000)]) }, del: {} } });
  const store = fakeStore({ [BASE]: {} }, { beforeModify: (p, name, tree) => {
    if (name === '예상비용.json' && !tree[p][name]) {   // 동료가 late 를 썼고, 나는 패널에서 edit 를 더하고 2차년도 계획을 넣었다
      tree[p][name] = D.serialize(Object.assign(D.emptyPlan({ prjNo: 'P1' }), { plan: { items: [item('late', 50, { prj: 'P1', key: 'K', by: '동료' })], del: {} }, updatedAt: '2026-10-18T00:00:00.000Z', updatedBy: '동료' }));
      me.st.plan.plans.P1.K.push(item('edit', 70));
      me.st.staff.plans['P1@2'] = splan('P1', 2, 2000, [person('홍길동', [1000000], 5000000)]);
    }
  } });
  const r = await Y.run(deps(store, me, { myPrjNos: ['P1'] }));
  assert.deepStrictEqual(me.st.plan.plans.P1.K.map((e) => e.id).sort(), ['a', 'edit', 'late'], '패널 편집(edit)이 남고 동료 항목(late)도 들어옴');
  assert.deepStrictEqual([Object.keys(me.st.staff.plans).sort(), me.saved], [['P1@1', 'P1@2'], ['plan:P1']]);
  const pl = docOf(store, `${BASE}/SSCB`, '예상비용.json');
  assert.deepStrictEqual([pl.plan.items.map((e) => e.id).sort(), r.state.pages.P1.pulled, r.state.pages.P1.pushed, r.state.pages.P1.count], [['a', 'late'], true, true, 2], '파일은 이번에 a+late — edit 는 다음에');
  me.saved.length = 0;
  const r2 = await Y.run(deps(store, me, { myPrjNos: ['P1'], now: 200000 }));
  assert.deepStrictEqual([docOf(store, `${BASE}/SSCB`, '예상비용.json').plan.items.map((e) => e.id).sort(), r2.state.pages.P1.years, r2.state.pages.P1.pushed, r2.state.pages.P1.pulled, me.saved], [['a', 'edit', 'late'], [1, 2], true, false, []]);
  // 연차 파일에서도: 쓰기 직전에 동료가 변경이력을 더했으면 합쳐 쓰고 로컬에도 받는다
  const me2 = memLocal({ aliases: { P1: 'SSCB' }, changes: { 'P1@1': [change('c10', '2026-10-01', '기타', 'a', '', '')] } });
  const store2 = fakeStore({ [BASE]: {} }, { beforeModify: (p, name, tree) => { if (name === '1차년도.json' && !tree[p][name]) tree[p][name] = D.serialize(Object.assign(D.emptyYear({ prjNo: 'P1' }, 1), { changes: [change('c20', '2026-10-02', '기타', 'b', '', '', { by: '동료' })], updatedAt: '2026-10-18T00:00:00.000Z', updatedBy: '동료' })); } });
  const r3 = await Y.run(deps(store2, me2, { myPrjNos: ['P1'] }));
  assert.deepStrictEqual([docOf(store2, `${BASE}/SSCB`, '1차년도.json').changes.map((c) => c.id), me2.st.changes['P1@1'].map((c) => c.id), me2.saved, r3.state.pages.P1.pulled, r3.state.pages.P1.created], [['c10', 'c20'], ['c10', 'c20'], ['changes:P1'], true, true]);
});

await test('내가 남긴 체크아웃(readFile checkedOutByMe): 내용이 같아 쓸 것이 없어도 modify 로 이어받아 체크인(checkedIn, pushed 아님) · 다음엔 writer 를 열지 않음 · 남이 잡은 것으로 드러나면(locked) 조용히 · 쓸 것이 있는데 잡혀 있으면 locked', async () => {
  const me = memLocal({ aliases: { P1: 'SSCB' }, plan: { plans: { P1: { K: [item('a', 1)] } }, del: {} } });
  const text = D.serialize(D.mergePlan(D.fromLocalPlan('P1', me.st, { prjNm: '과제1', who: '나' }), null, 100000, '나').doc);
  const ytext = D.serialize(D.mergeYear(D.fromLocalYear('P1', 1, me.st, { prjNm: '과제1', rspr: '김거화', start: '2026-04-01', end: '2026-12-31', who: '나' }), null, 100000, '나').doc);
  const mk = (extra) => fakeStore({ [BASE]: {}, [`${BASE}/SSCB`]: { '1차년도.json': ytext, '예상비용.json': text } }, Object.assign({ mine: [`${BASE}/SSCB/예상비용.json`] }, extra || {}));
  const store = mk();
  const r = await Y.run(deps(store, me, { myPrjNos: ['P1'] }));
  assert.deepStrictEqual([r.state.ok, r.state.written, r.state.pages.P1.pushed, r.state.pages.P1.pulled, r.state.pages.P1.checkedIn, store.mine.size], [true, 0, false, false, true, 0]);
  assert.deepStrictEqual(store.calls.filter((c) => /open|modify|checkin|close/.test(c)), [`open:${siteOf(BASE)}`, `modify:${BASE}/SSCB/예상비용.json`, `checkin:${BASE}/SSCB/예상비용.json`, `close:${BASE}/SSCB`]);
  const n0 = store.calls.length;
  const r2 = await Y.run(deps(store, me, { myPrjNos: ['P1'], now: 200000 }));
  assert.deepStrictEqual([r2.state.ok, store.calls.slice(n0).some((c) => c.startsWith('open')), r2.state.pages.P1.checkedIn], [true, false, undefined]);
  const store2 = mk({ locked: [`${BASE}/SSCB/예상비용.json`] });
  const r3 = await Y.run(deps(store2, me, { myPrjNos: ['P1'] }));
  assert.deepStrictEqual([r3.state.ok, r3.state.errors, r3.state.pages.P1.error], [true, 0, undefined]);
  me.st.plan.plans.P1.K.push(item('b', 2));
  const r4 = await Y.run(deps(store2, me, { myPrjNos: ['P1'] }));
  assert.deepStrictEqual([r4.state.ok, r4.state.pages.P1.kind], [false, 'locked']);
});

await test('과제 하나만(only): 그 과제만 읽고 쓰며 pages 도 그것만 · 다른 과제의 색인은 그대로 둔다 · 참여 과제가 아니어도 로컬 자료가 있는 과제는 대상(폴더를 만든다)', async () => {
  const store = fakeStore({ [BASE]: {} });
  const me = memLocal({ aliases: { P1: 'SSCB' }, plan: { plans: { P1: { K: [item('a', 1)] }, P9: { K: [item('q', 1)] } }, del: {} } });
  const r = await Y.run(deps(store, me, { only: 'P9', index: { P1: { base: BASE, folder: 'SSCB', path: `${BASE}/SSCB`, at: 1 } } }));
  assert.deepStrictEqual([Object.keys(r.state.pages), r.state.pages.P9.folder, r.state.pages.P9.title, Object.keys(store.tree[`${BASE}/P9`]).sort(), Object.keys(r.state.index).sort()], [['P9'], 'P9', 'P9', ['1차년도.json', '예상비용.json'], ['P1', 'P9']]);
  const r2 = await Y.run(deps(store, me));
  assert.deepStrictEqual(Object.keys(r2.state.pages).sort(), ['P1', 'P2', 'P9'], 'myPrjNos ∪ 로컬 자료');
  assert.deepStrictEqual([r2.state.pages.P2.noFolder, r2.state.pages.P1.folder, r2.state.pages.P9.folder], [true, 'SSCB', 'P9']);
});

await test('at 이 없는 writer(같은 사이트의 다른 폴더를 못 바꾸는 store): 폴더마다 writer 를 하나 더 열어도 동작은 같고 끝에 모두 닫는다', async () => {
  const store = fakeStore({ [BASE]: {} }, { noAt: true });
  const me = memLocal({ aliases: { P1: 'A', P2: 'B' }, plan: { plans: { P1: { K: [item('a', 1)] }, P2: { K: [item('b', 1)] } }, del: {} } });
  const r = await Y.run(deps(store, me, { leadPrjNos: ['P1', 'P2'] }));
  assert.deepStrictEqual([r.state.ok, r.state.written, r.state.pages.P1.folder, r.state.pages.P2.folder], [true, 4, 'A', 'B']);
  assert.deepStrictEqual([store.calls.filter((c) => c.startsWith('open')).length, store.calls.filter((c) => c.startsWith('close')).sort()], [2, [`close:${BASE}/A`, `close:${BASE}/B`]]);
});

await test('모르는 최상위 칸·project 의 모르는 칸 보존 · 동료 변경을 받아도 그대로 남는다', async () => {
  const doc = Object.assign(D.emptyYear({ prjNo: 'P1', prjNm: '과제1' }, 1), { workspace: { memo: 'KRS WORKSPACE 가 넣은 것' }, changes: [change('c1', '2026-10-01', '기타', 'x', '', '', { key: 'yaml' })], updatedAt: '2026-10-18T00:00:00.000Z', updatedBy: '동료' });
  doc.project.extra = { ws: 1 };
  const store = fakeStore({ [BASE]: {}, [`${BASE}/SSCB`]: { '1차년도.json': D.serialize(doc) } });
  const me = memLocal({ aliases: { P1: 'SSCB' }, changes: { 'P1@1': [change('c2', '2026-10-02', '기타', 'y', '', '')] } });
  const r = await Y.run(deps(store, me, { myPrjNos: ['P1'] }));
  const back = JSON.parse(store.tree[`${BASE}/SSCB`]['1차년도.json']);
  assert.deepStrictEqual([r.state.pages.P1.pulled, r.state.pages.P1.pushed, back.workspace, back.project.extra, back.changes.map((c) => [c.id, c.key]), Object.keys(back).slice(-1), r.state.pages.P1.remoteAt], [true, true, { memo: 'KRS WORKSPACE 가 넣은 것' }, { ws: 1 }, [['c1', 'yaml'], ['c2', undefined]], ['workspace'], Date.parse('2026-10-18T00:00:00.000Z')]);
  assert.deepStrictEqual([me.st.changes['P1@1'].map((c) => c.id), me.st.projects.P1.extra, me.st.projects.P1.at], [['c1', 'c2'], { ws: 1 }, 100000], '받은 시각은 이번에 쓴 문서의 updatedAt(= now — 파일도 바뀌었으므로)');
  // 다시 돌리면 받아 둔 extra 가 같아 project 를 다시 받지 않는다
  me.saved.length = 0;
  const r2 = await Y.run(deps(store, me, { myPrjNos: ['P1'], now: 200000 }));
  assert.deepStrictEqual([r2.state.pages.P1.pulled, r2.state.pages.P1.pushed, me.saved], [false, false, []]);
});

console.log(`\n${n} passed${failed ? `, ${failed} failed` : ''}`);
})();
