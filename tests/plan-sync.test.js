/* lib/plan-sync.js · lib/plus-onenote.js · lib/mcp-client.js 의 순수 함수 + run() 오케스트레이션(가짜 OneNote) 테스트. 실행: node tests/plan-sync.test.js */
globalThis.self = globalThis;
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..');
for (const f of ['lib/format.js', 'lib/plan.js', 'lib/mcp-client.js', 'lib/plus-onenote.js', 'lib/plan-sync.js']) require(path.join(root, f));
const S = KRX_PLAN_SYNC, O = KRX_ONENOTE, M = KRX_MCP;
let n = 0, failed = 0;
const test = async (name, fn) => { try { await fn(); n++; console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n   ', e.stack || e.message); process.exitCode = 1; } };

(async () => {
await test('flatten/unflatten 왕복 · 과제 하나만', () => {
  const plans = { P1: { '10|연구활동비': [{ id: 'a', name: 'x', qty: 2, unit: 10, amt: 20, ts: 5 }], '10|장비비': [{ id: 'b', name: 'y', qty: 1, unit: 3, amt: 3, ts: 6, sub: { date: '2026-09-02' }, by: '홍' }] }, P2: { K: [{ id: 'c', name: 'z', qty: 1, unit: 1, amt: 1, ts: 1 }] } };
  const items = S.flatten(plans);
  assert.strictEqual(items.length, 3);
  assert.deepStrictEqual(S.unflatten(items), plans);
  assert.deepStrictEqual(S.flatten(plans, 'P2').map((e) => e.id), ['c']);
});

await test('titleFor / prjOfTitle', () => {
  assert.strictEqual(S.titleFor('2026-0063-01', 'MW급 차단기'), '[예상 비용] 2026-0063-01 MW급 차단기');
  assert.strictEqual(S.titleFor('2026-0063-01'), '[예상 비용] 2026-0063-01');
  assert.strictEqual(S.prjOfTitle('[예상 비용] 2026-0063-01 MW급 차단기'), '2026-0063-01');
  assert.strictEqual(S.prjOfTitle(' [예상 비용]  2026-0064-01'), '2026-0064-01');
  assert.strictEqual(S.prjOfTitle('회의록'), '');
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

await test('merge: 원격 없음(블록 없음) → remoteChanged, 로컬 그대로 · 같으면 아무것도 안 바뀜', () => {
  const items = [{ id: 'a', prj: 'P', key: 'K', name: 'a', qty: 1, unit: 1, amt: 1, ts: 10 }];
  const m = S.merge({ items, del: { z: 999 } }, null, 1000);
  assert.strictEqual(m.localChanged, false); assert.strictEqual(m.remoteChanged, true); assert.strictEqual(m.items.length, 1);
  const m2 = S.merge({ items, del: {} }, { items: items.map((e) => Object.assign({}, e)), del: {} }, 1000);
  assert.strictEqual(m2.localChanged, false); assert.strictEqual(m2.remoteChanged, false);
});

await test('gcTomb: 90일 지난 묘비 버림 (객체 값도)', () => {
  const now = 100 * 24 * 3600 * 1000;
  assert.deepStrictEqual(S.gcTomb({ old: 1, fresh: now - 1000, obj: { ts: now - 5, prj: 'P' } }, now), { fresh: now - 1000, obj: now - 5 });
});

await test('serialize → parse 왕복 (한글·특수문자·구독·묘비·제목)', () => {
  const items = [{ id: 'a1', prj: 'PRJ-1', key: '10|연구활동비', name: 'CHATGPT <A&B> "따옴표"', qty: 3, unit: 300000, amt: 900000, ts: 1000, by: '김거화' },
    { id: 'a2', prj: 'PRJ-1', key: '10|연구활동비', name: 'azure', qty: 3, unit: 500000, amt: 1500000, ts: 2000, sub: { date: '2026-09-02' } }];
  const html = S.serialize({ items, del: { zz: 5 }, at: 123456, by: '김거화' }, { title: 'MW급 차단기 (PRJ-1)', calc: KRX_PLAN });
  assert.ok(html.startsWith('<table data-id="krx-plan"'));
  assert.ok(!/<div/.test(html), 'div 없음 (Graph replace 제약)');
  assert.ok(html.includes('MW급 차단기 (PRJ-1)'));
  assert.ok(html.includes('&lt;A&amp;B&gt;'));
  const p = S.parse(html);
  assert.strictEqual(p.at, 123456); assert.strictEqual(p.by, '김거화');
  assert.deepStrictEqual(p.del, { zz: 5 });
  assert.strictEqual(p.items.length, 2);
  assert.strictEqual(p.items.find((e) => e.id === 'a1').name, 'CHATGPT <A&B> "따옴표"');
  assert.deepStrictEqual(p.items.find((e) => e.id === 'a2').sub, { date: '2026-09-02' });
});

await test('parse: Graph 가 되돌려 준 형태(생성 id · span · 엔티티 · 줄바꿈)도 읽는다 · JSON 없으면 null', () => {
  const html = S.serialize({ items: [{ id: 'q', prj: 'P', key: 'K', name: 'n', qty: 1, unit: 2, amt: 2, ts: 3 }], del: {}, at: 1, by: 'x' });
  const b64 = /krxplan1:([A-Za-z0-9+/=]+)/.exec(html)[1];
  const wrapped = `<table id="table:{g}{15}" data-id="krx-plan" style="border:1px solid"><tr><td id="td:{g}{1}">제목</td></tr>\n<tr><td><span style="color:#c0c4cc">krxplan1:${b64.slice(0, 10)}\n${b64.slice(10)}</span>&nbsp;</td><td><br /></td></tr></table>`;
  const blk = O.findBlock(wrapped, 'krx-plan');
  assert.ok(blk); assert.strictEqual(blk.tag, 'table'); assert.strictEqual(blk.id, 'table:{g}{15}');
  assert.strictEqual(S.parse(blk.inner).items[0].id, 'q');
  assert.strictEqual(S.parse('<tr><td>x</td></tr>'), null); assert.strictEqual(S.parse(''), null);
});

await test('parseLink: 웹 링크(인코딩) · onenote: 링크 · sourcedoc 무시 · Graph page_id', () => {
  const web = 'https://krclass-my.sharepoint.com/personal/x/Documents/Notebooks/AIPWork?wd=target%282026.one%7Ca745a153-ea3f-4b6e-8f16-9163bfe64932%2F%EC%A0%9C%EB%AA%A9%7Cb08d1e95-6615-497d-8f11-a88ecb8dea94%2F%29';
  assert.deepStrictEqual(O.parseLink(web), { guid: 'b08d1e95-6615-497d-8f11-a88ecb8dea94' });
  const doc = 'https://x.sharepoint.com/personal/y/_layouts/15/Doc.aspx?sourcedoc={11111111-2222-3333-4444-555555555555}&action=edit&wd=target(2026.one|a745a153-ea3f-4b6e-8f16-9163bfe64932/제목|B08D1E95-6615-497D-8F11-A88ECB8DEA94/)&wdorigin=NavigationUrl';
  assert.deepStrictEqual(O.parseLink(doc), { guid: 'b08d1e95-6615-497d-8f11-a88ecb8dea94' });
  const client = 'onenote:https://x/2026.one#[작업] 문서&section-id={A745A153-EA3F-4B6E-8F16-9163BFE64932}&page-id={B08D1E95-6615-497D-8F11-A88ECB8DEA94}&end';
  assert.deepStrictEqual(O.parseLink(client), { guid: 'b08d1e95-6615-497d-8f11-a88ecb8dea94' });
  const pid = '1-1a765a0db0ab4b3bb67d6117bfe03e9c!6-8ad4548c-604b-4512-a444-e20d8b0b64f1';
  assert.deepStrictEqual(O.parseLink(pid), { pageId: pid });
  assert.strictEqual(O.parseLink('hello'), null); assert.strictEqual(O.parseLink(''), null);
});

await test('checkTools: replace · include_ids 지원 판정', () => {
  const tools = [{ name: 'read_onenote', inputSchema: { properties: { include_ids: {} } } }, { name: 'write_onenote', inputSchema: { properties: { action: { enum: ['append', 'replace'] } } } }];
  assert.deepStrictEqual(O.checkTools(tools), { hasWrite: true, hasRead: true, replace: true, includeIds: true });
  assert.deepStrictEqual(O.checkTools([{ name: 'write_onenote', inputSchema: { properties: { action: { enum: ['append'] } } } }]), { hasWrite: true, hasRead: false, replace: false, includeIds: false });
});

await test('ensureSection: 이름으로 찾기(대소문자 무시) · 여럿이면 노트북 요구 · 없으면 고른 노트북에 만듦', async () => {
  const secs = [{ id: 's1', display_name: '2026', parent_notebook_id: 'n1', parent_notebook_name: 'AIPWork' }, { id: 's2', display_name: 'rerp', parent_notebook_id: 'n2', parent_notebook_name: '회의' }];
  const calls = [];
  const client = { call: async (name, args) => { calls.push(args.action); if (args.action === 'list_sections') return { json: { sections: secs } }; if (args.action === 'create_section') { secs.push({ id: 's9', display_name: args.title, parent_notebook_id: args.notebook_id, parent_notebook_name: 'AIPWork' }); return { json: { section: { id: 's9', display_name: args.title } } }; } throw new Error('unexpected ' + args.action); } };
  const found = await O.ensureSection(client, { name: 'RERP' });
  assert.deepStrictEqual(found, { id: 's2', label: '회의 › rerp', name: 'RERP', notebookId: 'n2', notebook: '회의', created: false });
  // 두 노트북에 있으면 notebookId 없이는 고르라고 함
  await assert.rejects(() => O.ensureSection(client, { name: '2026' , notebookId: '' }).then(() => { secs.push({ id: 's3', display_name: '2026', parent_notebook_id: 'n2', parent_notebook_name: '회의' }); return O.ensureSection(client, { name: '2026' }); }), (e) => e.kind === 'notebook' && e.notebooks.length === 2);
  // 없고 노트북도 없으면 고르라고 함 (notebooks = 전체)
  await assert.rejects(() => O.ensureSection(client, { name: 'NEW' }), (e) => e.kind === 'notebook' && e.notebooks.map((n) => n.id).sort().join() === 'n1,n2');
  // 노트북을 주면 만든다
  const made = await O.ensureSection(client, { name: 'NEW', notebookId: 'n1' });
  assert.deepStrictEqual(made, { id: 's9', label: 'AIPWork › NEW', name: 'NEW', notebookId: 'n1', notebook: 'AIPWork', created: true });
  assert.ok(calls.includes('create_section'));
  // 그 뒤에는 찾는다
  const again = await O.ensureSection(client, { name: 'new', notebookId: 'n1' });
  assert.strictEqual(again.id, 's9'); assert.strictEqual(again.created, false);
});

await test('resolveLink: 내보내기가 복사한 글(링크+ID) · 링크만(web_url GUID 대조, 없으면 syncDb 뒤 재시도) · 엉뚱한 글', async () => {
  const pid = '1-1a765a0db0ab4b3bb67d6117bfe03e9c!6-8ad4548c-604b-4512-a444-e20d8b0b64f1';
  const web = 'https://krclass-my.sharepoint.com/personal/x/Documents/Notebooks/AIPWork?wd=target%282026.one%7Ca745a153-ea3f-4b6e-8f16-9163bfe64932%2F%EC%A0%9C%EB%AA%A9%7Cb08d1e95-6615-497d-8f11-a88ecb8dea94%2F%29';
  let synced = 0; let pages = [];
  const client = { call: async (name, args) => { if (args.action === 'list_pages') return { json: { pages } }; if (name === 'sync_onenote_db') { synced++; pages = [{ page_id: pid, title: '[예상 비용] P1', web_url: web, section_id: 's1' }]; return { json: {} }; } throw new Error('unexpected'); } };
  const a = await O.resolveLink(client, `${web}\n[예상 비용 페이지 ID] ${pid}`);
  assert.strictEqual(a.pageId, pid); assert.strictEqual(a.title, '[예상 비용] P1');
  pages = []; synced = 0;
  const b = await O.resolveLink(client, web);   // 링크만: 목록에 없어 syncDb 뒤 찾음
  assert.strictEqual(b.pageId, pid); assert.strictEqual(synced, 1);
  await assert.rejects(() => O.resolveLink(client, '안녕하세요'), (e) => e.kind === 'badlink');
  const pid2 = '1-ffffffffffffffffffffffffffffffff!6-8ad4548c-604b-4512-a444-e20d8b0b64f1';
  const c = await O.resolveLink(client, pid2);   // ID 만 있고 목록에 없어도 시도는 한다
  assert.strictEqual(c.pageId, pid2); assert.strictEqual(c.title, '');
});

await test('run: 링크로 연결한(bound) 페이지는 섹션 없이도 동기화되고 만들지는 않는다', async () => {
  const fake = fakeOneNote();
  const boss = memStore({ P1: { K: [{ id: 'a', name: '책임자것', qty: 1, unit: 10, amt: 10, ts: 5 }] } });
  const r1 = await S.run({ client: {}, onenote: fake, sectionId: 'S', names: { P1: '과제1' }, myPrjNos: ['P1'], leadPrjNos: ['P1'], calc: KRX_PLAN, who: '책임자', loadLocal: boss.loadLocal, saveLocal: boss.saveLocal, now: 1000 });
  const pageId = r1.pages.P1.pageId;
  // 동료: RERP 섹션 없음(sectionId ''), 링크로 연결한 페이지만
  const me = memStore({ P1: { K: [{ id: 'b', name: '내것', qty: 1, unit: 1, amt: 1, ts: 2000 }] }, P2: { K: [{ id: 'c', name: 'p2', qty: 1, unit: 1, amt: 1, ts: 1 }] } });
  const bound = { P1: { pageId, title: 't', webUrl: 'web:' + pageId, sectionId: '', bound: true } };
  const calls0 = fake.calls.length;
  const r2 = await S.run({ client: {}, onenote: fake, sectionId: '', pages: bound, names: {}, myPrjNos: ['P1', 'P2'], leadPrjNos: ['P2'], createAll: true, calc: KRX_PLAN, who: '나', loadLocal: me.loadLocal, saveLocal: me.saveLocal, now: 3000 });
  assert.deepStrictEqual(Object.keys(r2.state.pages).sort(), ['P1', 'P2']);
  assert.strictEqual(r2.state.pages.P1.pulled, true, '책임자 항목을 가져옴');
  assert.strictEqual(r2.state.pages.P1.pushed, true, '내 항목을 올림');
  assert.strictEqual(r2.state.pages.P2.noPage, true, '섹션이 없으면 책임자여도 만들지 않음');
  assert.strictEqual(Object.keys(fake.pages).length, 1);
  assert.ok(!fake.calls.slice(calls0).includes('list') && !fake.calls.slice(calls0).includes('syncDb'), '섹션이 없으면 목록 조회 없음');
  assert.deepStrictEqual(me.st.plans.P1.K.map((e) => e.id).sort(), ['a', 'b']);
  assert.ok(r2.pages.P1.bound, '연결 표시가 캐시에 남음');
});

await test('MCP SSE 응답 해석', () => {
  const sse = 'event: message\r\ndata: {"jsonrpc":"2.0","id":1,"result":{"ok":1}}\r\n\r\nevent: message\ndata: {"jsonrpc":"2.0",\ndata: "id":2,"result":{"ok":2}}\n\n';
  const msgs = M._parseSse(sse);
  assert.strictEqual(msgs.length, 2);
  assert.strictEqual(msgs[1].result.ok, 2);
});

/* run(): 가짜 OneNote(메모리 페이지 저장소)로 과제별 생성·병합·묘비·과제 하나만 동기화를 검증 */
function fakeOneNote() {
  const pages = {};   // pageId → { title, sectionId, html }
  let seq = 0;
  const calls = [];
  const api = {
    calls, pages,
    listSectionPages: async (c, sectionId) => { calls.push('list'); return Object.entries(pages).filter(([, p]) => p.sectionId === sectionId).map(([pageId, p]) => ({ pageId, title: p.title, webUrl: `web:${pageId}`, sectionId })); },
    syncDb: async () => { calls.push('syncDb'); },
    createPage: async (c, sectionId, title, html) => { calls.push('create:' + title); const pageId = `pg${++seq}`; pages[pageId] = { title, sectionId, html: `<html><head><title>${title}</title></head><body>${html.replace('<table ', `<table id="table:{x}{${seq}}" `)}</body></html>` }; return { pageId, title, webUrl: `web:${pageId}` }; },
    readPage: async (c, pageId) => { calls.push('read:' + pageId); if (!pages[pageId]) throw new Error('없는 페이지'); return pages[pageId].html; },
    pageTitle: O.pageTitle, findBlock: O.findBlock,
    writeBlock: async (c, pageId, dataId, html, block) => { calls.push((block ? 'replace:' : 'append:') + pageId); const p = pages[pageId]; const withId = html.replace('<table ', `<table id="table:{x}{${++seq}}" `); p.html = block ? p.html.replace(block.html, withId) : p.html.replace('</body>', withId + '</body>'); }
  };
  return api;
}
function memStore(plans, del) { const st = { plans, del: del || {} }; return { st, loadLocal: async () => ({ plans: JSON.parse(JSON.stringify(st.plans)), del: JSON.parse(JSON.stringify(st.del)) }), saveLocal: async (plans, del) => { st.plans = plans; st.del = del; } }; }   // 함수 선언이라 위쪽 테스트에서도 쓸 수 있음

await test('run: 책임자가 아니면 페이지를 만들지 않고 noPage 로 기다린다 (오류 아님) · 책임자가 만든 뒤에는 씀', async () => {
  const fake = fakeOneNote();
  const me = memStore({ P1: { K: [{ id: 'a', name: 'x', qty: 1, unit: 10, amt: 10, ts: 5 }] } });
  const r = await S.run({ client: {}, onenote: fake, sectionId: 'S', names: { P1: '과제1' }, myPrjNos: ['P1'], leadPrjNos: [], calc: KRX_PLAN, who: '나', loadLocal: me.loadLocal, saveLocal: me.saveLocal, now: 1000 });
  assert.strictEqual(r.state.ok, true);
  assert.strictEqual(r.state.waiting, 1);
  assert.strictEqual(r.state.pages.P1.noPage, true);
  assert.strictEqual(r.state.pages.P1.count, 1);
  assert.strictEqual(Object.keys(fake.pages).length, 0, '페이지 생성 없음');
  assert.strictEqual(fake.calls.filter((c) => c === 'syncDb').length, 1, '목록 갱신은 한 번');
  // createAll 도 책임자가 아니면 만들지 않음
  const r2 = await S.run({ client: {}, onenote: fake, sectionId: 'S', names: {}, myPrjNos: ['P1', 'P2'], leadPrjNos: [], createAll: true, calc: KRX_PLAN, loadLocal: me.loadLocal, saveLocal: me.saveLocal, now: 1500 });
  assert.strictEqual(Object.keys(fake.pages).length, 0);
  assert.strictEqual(r2.state.waiting, 1);
  // 책임자는 항목이 없어도 동기화만 하면 자동으로 만들고, 그 뒤 동료 동기화에서 씀
  const boss = memStore({});
  await S.run({ client: {}, onenote: fake, sectionId: 'S', names: { P1: '과제1' }, myPrjNos: ['P1'], leadPrjNos: ['P1'], calc: KRX_PLAN, who: '책임자', loadLocal: boss.loadLocal, saveLocal: boss.saveLocal, now: 2000 });
  assert.strictEqual(Object.keys(fake.pages).length, 1);
  const r3 = await S.run({ client: {}, onenote: fake, sectionId: 'S', names: { P1: '과제1' }, myPrjNos: ['P1'], leadPrjNos: [], calc: KRX_PLAN, who: '나', loadLocal: me.loadLocal, saveLocal: me.saveLocal, now: 3000 });
  assert.strictEqual(r3.state.pages.P1.noPage, undefined);
  assert.strictEqual(r3.state.pages.P1.pushed, true);
  assert.strictEqual(r3.state.waiting, 0);
});

await test('run: 책임자인 과제는 항목이 없어도 페이지를 자동으로 만들고, 책임자가 아닌 과제는 항목이 없으면 건너뜀', async () => {
  const fake = fakeOneNote();
  const A = memStore({ P1: { K: [{ id: 'a', name: 'x', qty: 1, unit: 10, amt: 10, ts: 5 }] } });
  const r = await S.run({ client: {}, onenote: fake, sectionId: 'S', names: { P1: '과제1', P2: '과제2', P3: '과제3' }, myPrjNos: ['P1', 'P2', 'P3'], leadPrjNos: ['P1', 'P2'], calc: KRX_PLAN, who: '나', loadLocal: A.loadLocal, saveLocal: A.saveLocal, now: 1000 });
  assert.strictEqual(r.state.ok, true);
  assert.deepStrictEqual(Object.keys(r.state.pages).sort(), ['P1', 'P2'], 'P3 은 책임자가 아니고 항목도 없어 대상 아님');
  assert.strictEqual(r.state.pages.P1.created, true);
  assert.strictEqual(r.state.pages.P2.created, true, '항목이 없어도 책임 과제는 자동 생성');
  assert.strictEqual(r.state.pages.P1.title, '[예상 비용] P1 과제1');
  assert.ok(fake.calls.includes('syncDb'), '만들기 전에 목록 새로 받음');
  assert.strictEqual(Object.keys(fake.pages).length, 2);
  // 다시 돌리면 만들지 않고 그대로
  const r2 = await S.run({ client: {}, onenote: fake, sectionId: 'S', pages: r.pages, names: { P1: '과제1', P2: '과제2' }, myPrjNos: ['P1', 'P2'], leadPrjNos: ['P1', 'P2'], calc: KRX_PLAN, loadLocal: A.loadLocal, saveLocal: A.saveLocal, now: 2000 });
  assert.strictEqual(r2.state.pages.P1.created, false); assert.strictEqual(r2.state.pages.P2.created, false);
  assert.strictEqual(r2.state.pages.P1.pushed, false, 'P1 은 페이지와 같아 안 씀');
  assert.strictEqual(Object.keys(fake.pages).length, 2);
});

await test('run: 동료가 같은 섹션에서 동기화하면 같은 페이지를 쓰고 항목·묘비가 오간다 (과제별 묘비)', async () => {
  const fake = fakeOneNote();
  const me = memStore({ P1: { K: [{ id: 'a', name: '내것', qty: 1, unit: 10, amt: 10, ts: 5 }] }, P2: { K: [{ id: 'p2', name: 'p2', qty: 1, unit: 1, amt: 1, ts: 1 }] } });
  const r1 = await S.run({ client: {}, onenote: fake, sectionId: 'S', names: {}, myPrjNos: ['P1', 'P2'], leadPrjNos: ['P1', 'P2'], calc: KRX_PLAN, who: '나', loadLocal: me.loadLocal, saveLocal: me.saveLocal, now: 1000 });
  assert.strictEqual(Object.keys(fake.pages).length, 2);
  // 동료: 로컬에 항목 없음, P1 참여 → 페이지에서 내 항목을 가져온다 (페이지는 만들지 않음)
  const you = memStore({});
  const r2 = await S.run({ client: {}, onenote: fake, sectionId: 'S', names: {}, myPrjNos: ['P1'], calc: KRX_PLAN, who: '동료', loadLocal: you.loadLocal, saveLocal: you.saveLocal, now: 2000 });
  assert.strictEqual(Object.keys(fake.pages).length, 2, '페이지 중복 생성 없음');
  assert.deepStrictEqual(Object.keys(r2.state.pages), ['P1'], '참여하지 않는 P2 는 건드리지 않음');
  assert.strictEqual(r2.state.pages.P1.pulled, true);
  assert.strictEqual(you.st.plans.P1.K[0].name, '내것');
  // 동료가 항목을 지우고(묘비) 새 항목을 더함 → 동기화
  you.st.plans = { P1: { K: [{ id: 'b', name: '동료것', qty: 2, unit: 5, amt: 10, ts: 3000, by: '동료' }] } };
  you.st.del = { a: { ts: 3000, prj: 'P1' }, zz: { ts: 3000, prj: 'P9' } };
  await S.run({ client: {}, onenote: fake, sectionId: 'S', pages: r2.pages, names: {}, myPrjNos: ['P1'], calc: KRX_PLAN, who: '동료', loadLocal: you.loadLocal, saveLocal: you.saveLocal, now: 3500 });
  // 나: P1 만 동기화(구름 아이콘) → a 삭제, b 추가, P2 는 그대로. 묘비 zz(P9)는 P1 페이지에 실리지 않음
  const callsBefore = fake.calls.length;
  const r3 = await S.run({ client: {}, onenote: fake, sectionId: 'S', pages: r1.pages, names: {}, myPrjNos: ['P1', 'P2'], only: 'P1', calc: KRX_PLAN, who: '나', loadLocal: me.loadLocal, saveLocal: me.saveLocal, now: 4000 });
  assert.deepStrictEqual(Object.keys(r3.state.pages), ['P1']);
  assert.strictEqual(r3.state.pages.P1.pulled, true);
  assert.strictEqual(r3.state.pages.P1.remoteBy, '동료');
  assert.deepStrictEqual(me.st.plans.P1.K.map((e) => e.id), ['b']);
  assert.deepStrictEqual(me.st.plans.P2.K.map((e) => e.id), ['p2']);
  assert.deepStrictEqual(me.st.del, { a: { ts: 3000, prj: 'P1' } });
  const p1 = Object.values(fake.pages).find((p) => p.title.includes('P1'));
  const parsed = S.parse(O.findBlock(p1.html, 'krx-plan').inner);
  assert.deepStrictEqual(Object.keys(parsed.del), ['a']);
  assert.ok(!fake.calls.slice(callsBefore).includes('list'), '캐시된 페이지로 과제 하나만 돌 때는 목록 조회 없음');
});

await test('run: 과제 하나가 실패해도 나머지는 진행하고 errors 에 남긴다', async () => {
  const fake = fakeOneNote();
  const me = memStore({ P1: { K: [{ id: 'a', name: 'x', qty: 1, unit: 1, amt: 1, ts: 5 }] }, P2: { K: [{ id: 'b', name: 'y', qty: 1, unit: 1, amt: 1, ts: 5 }] } });
  const r = await S.run({ client: {}, onenote: fake, sectionId: 'S', pages: { P1: { pageId: 'ghost', title: 't', sectionId: 'S' } }, names: {}, myPrjNos: [], leadPrjNos: ['P2'], calc: KRX_PLAN, loadLocal: me.loadLocal, saveLocal: me.saveLocal, now: 1000 });
  assert.strictEqual(r.state.ok, false);
  assert.strictEqual(r.state.errors, 1);
  assert.ok(/없는 페이지/.test(r.state.pages.P1.error));
  assert.strictEqual(r.state.pages.P2.created, true);
});

console.log(`\n${n} passed${failed ? `, ${failed} failed` : ''}`);
})();
