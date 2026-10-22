/* Claude 자동 분류(0.8.5) 테스트 — help-server/classify.js(입력 정리·프롬프트·스키마·결과 검사), lib/prep-store.js(applyAuto·typeFree: 사용자가 고른 값은 안 바꿈),
 * lib/prep-ai.js(언제 묻고 언제 건너뛰나, 같은 거래 요청 합치기). chrome.storage·fetch 는 가짜. 실행: node tests/prep-ai.test.js */
globalThis.self = globalThis;
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..');

let n = 0, failed = 0;
const queue = [];
const test = (name, fn) => queue.push([name, fn]);

/* ---------- 가짜 chrome.storage.local · fetch · 설정 ---------- */
let store = {};
globalThis.chrome = { storage: { local: {
  get: async (k) => { const out = {}; for (const x of [].concat(k)) if (x in store) out[x] = JSON.parse(JSON.stringify(store[x])); return out; },
  set: async (o) => { for (const [k, v] of Object.entries(o)) store[k] = JSON.parse(JSON.stringify(v)); },
} } };
let settings = null;
globalThis.KRX_SETTINGS = { DEFAULTS: { claimHelper: { attachKinds: ['거래명세서', '교육내용', '수료증'] } }, load: async () => settings };
const calls = [];
let reply = null, healthReply = null;
const apiCalls = [];   // Claude API (api.anthropic.com) 로 간 요청 { url, method, headers, body }
let apiReply = null;   // { status, body, retryAfter? } 또는 (본문) => 그것
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://api.anthropic.com/')) {
    const body = init && init.body ? JSON.parse(init.body) : null;
    apiCalls.push({ url, method: (init && init.method) || 'GET', headers: Object.assign({}, init && init.headers), body });
    const rp = typeof apiReply === 'function' ? apiReply(body) : apiReply;
    return { ok: rp.status >= 200 && rp.status < 300, status: rp.status, headers: { get: (h) => (/retry-after/i.test(h) ? rp.retryAfter || null : null) }, json: async () => rp.body };
  }
  if (/\/health$/.test(url)) return { status: 200, json: async () => healthReply };
  const body = JSON.parse(init.body);
  calls.push(body);
  await new Promise((r) => setTimeout(r, 20));
  return { status: 200, json: async () => (typeof reply === 'function' ? reply(body) : reply) };
};

const classify = require(path.join(root, 'help-server/classify.js'));
const vm = require('vm');
const fs = require('fs');
for (const f of ['lib/prep-store.js', 'lib/classify-core.js', 'lib/claude-api.js', 'lib/prep-ai.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
const S = KRX_PREP_STORE, AI = KRX_PREP_AI, API = KRX_CLAUDE_API;

const PICKS = ['연구실 운영비=연구실운영비', '회의비=회의비=17', '식사비=회의비=17=식비', '연구활동비 기타비용'];
const reset = () => {
  store = {}; calls.length = 0; apiCalls.length = 0; apiReply = null;
  settings = { help: { enabled: true, url: 'http://127.0.0.1:8106', autoPick: true }, claimHelper: { enabled: true, quickPicks: PICKS, attachKinds: ['거래명세서', '교육내용', '수료증'] } };
  healthReply = { ok: true, name: 'krx-help', classify: 'claude-haiku-5-5', classifyPtcl: true };
  reply = { ok: true, type: { value: '연구활동비 기타비용', reason: '온라인 강의' }, files: [] };
};
const META = { appr: '39202010', card4: '4126', prjNo: '2026-0063-01', shop: '주식회사 인프랩', amount: 43560, usedDate: '2026-10-06 09:53:35' };
const KEY = '39202010|4126';
let fileSeq = 0;
const withFiles = (names, extra) => { store.claimPrep = { [KEY]: Object.assign({ key: KEY, type: '', ptcl: '', ts: 1, attached: null, files: names.map((nm) => ({ id: `id${++fileSeq}`, name: nm, mime: 'image/png', size: 10, ts: 1 })) }, META, extra || {}) }; };

/* ---------- help-server/classify.js ---------- */
test('clean: 청구종류 후보가 없고 분류할 파일도 없으면 할 일 없음', () => {
  const r = classify.clean({ wantType: true, picks: [], kinds: ['수료증'], files: [{ id: 'a', name: 'x.png', classify: false }] });
  assert.strictEqual(r.wantType, false); assert.deepStrictEqual(r.todo, []);
});
test('clean: 허용하지 않는 media 의 내용은 버리고 이름만, 첨부 종류 후보가 없으면 파일은 묻지 않음', () => {
  const r = classify.clean({ wantType: true, picks: [{ label: 'A' }], kinds: ['수료증'], files: [{ id: 'a', name: 'x.svg', classify: true, b64: 'AAAA', media: 'image/svg+xml' }, { id: 'b', name: 'y.pdf', classify: true, b64: 'BBBB', media: 'application/pdf' }] });
  assert.strictEqual(r.todo.length, 2); assert.strictEqual(r.todo[0].b64, undefined); assert.strictEqual(r.todo[1].media, 'application/pdf');
  assert.strictEqual(classify.clean({ wantType: false, picks: [{ label: 'A' }], kinds: [], files: [{ id: 'a', name: 'x.png', classify: true }] }).todo.length, 0);
});
test('build: 스키마 enum 은 후보 + "" 이고, 파일마다 id 글 뒤에 image/document 블록', () => {
  const input = classify.clean({ tx: { shop: '인프랩', amount: 43560 }, ptcl: '온라인 강의', wantType: true, picks: [{ label: '연구실 운영비', hint: '세목 "연구실운영비"' }, { label: '회의비' }],
    kinds: ['거래명세서', '수료증'], files: [{ id: 'f1', name: 'cert.pdf', classify: true, b64: 'JVBE', media: 'application/pdf' }, { id: 'f2', name: 'cap.png', classify: true, b64: 'iVBO', media: 'image/jpeg' }, { id: 'f3', name: 'old.png', kind: '거래명세서' }],
    history: [{ shop: 'Microsoft', ptcl: '', type: '연구실 운영비' }] });
  const { content, schema } = classify.build(input);
  assert.deepStrictEqual(schema.properties.type.properties.value.enum, ['연구실 운영비', '회의비', '']);
  assert.deepStrictEqual(schema.properties.files.items.properties.id.enum, ['f1', 'f2']);
  assert.deepStrictEqual(schema.properties.files.items.properties.kind.enum, ['거래명세서', '수료증', '']);
  assert.deepStrictEqual(schema.required, ['type', 'files']);
  assert.deepStrictEqual(content.map((b) => b.type), ['text', 'text', 'document', 'text', 'image']);
  const intro = content[0].text;
  assert.ok(intro.includes('43,560원') && intro.includes('온라인 강의') && intro.includes('"old.png"(거래명세서)') && intro.includes('가맹점 "Microsoft" → 연구실 운영비'), intro);
});
test('parse: 후보 밖 값은 "", 모르는 id·중복은 버림', () => {
  const input = classify.clean({ wantType: true, picks: [{ label: 'A' }, { label: 'B' }], kinds: ['수료증'], files: [{ id: 'f1', name: 'a.png', classify: true }, { id: 'f2', name: 'b.png', classify: true }] });
  const r = classify.parse(input, { type: { value: 'C', reason: 'x' }, files: [{ id: 'f1', kind: '수료증', reason: 'r' }, { id: 'f1', kind: '', reason: '' }, { id: 'zz', kind: '수료증', reason: '' }, { id: 'f2', kind: '영수증', reason: '' }] });
  assert.deepStrictEqual(r.type, { value: '', reason: 'x' });
  assert.deepStrictEqual(r.files.map((f) => [f.id, f.kind]), [['f1', '수료증'], ['f2', '']]);
});

/* ---------- lib/prep-store.js ---------- */
test('typeFree: 비었거나 Claude 가 고른 것만, 사용자가 고르거나 비운 것·작성 중·임시저장은 아님', () => {
  assert.ok(S.typeFree(null));
  assert.ok(S.typeFree({ type: '' }));
  assert.ok(S.typeFree({ type: 'A', typeBy: 'auto' }));
  assert.ok(!S.typeFree({ type: 'A' }));                      // 0.8.5 전에 고른 값 (typeBy 없음) = 사용자
  assert.ok(!S.typeFree({ type: '', typeBy: 'user' }));
  assert.ok(!S.typeFree({ type: 'A', typeBy: 'auto', run: { state: 'saved' } }));
  assert.ok(!S.typeFree({ type: 'A', typeBy: 'auto', run: { state: 'running' } }));
  assert.ok(S.typeFree({ type: 'A', typeBy: 'auto', run: { state: 'failed' } }));
});
test('applyAuto: 청구종류를 넣고 파일 종류로 이름을 바꾸며, 이미 종류가 있는 파일은 그대로', async () => {
  reset(); withFiles(['capture_inflearn.com_1.png', 'cert.pdf']);
  const [f1, f2] = store.claimPrep[KEY].files;
  f2.kind = '거래명세서'; f2.kindBy = 'user';
  const r = await S.applyAuto(KEY, META, { type: { value: '연구활동비 기타비용', reason: '강의' }, sig: 's1', files: [{ id: f1.id, kind: '교육내용', reason: '강의 화면' }, { id: f2.id, kind: '수료증', reason: '' }], tried: [f1.id, f2.id] });
  assert.strictEqual(r.typeSet, true);
  const e = store.claimPrep[KEY];
  assert.strictEqual(e.type, '연구활동비 기타비용'); assert.strictEqual(e.typeBy, 'auto'); assert.strictEqual(e.typeAuto.sig, 's1');
  assert.strictEqual(e.files[0].name, '교육내용_inflearn.com_1.png'); assert.strictEqual(e.files[0].kindBy, 'auto'); assert.strictEqual(e.files[0].kindTried, true);
  assert.strictEqual(e.files[1].kind, '거래명세서'); assert.strictEqual(e.files[1].kindBy, 'user');
  assert.deepStrictEqual(r.kinds, [{ id: f1.id, kind: '교육내용' }]);
});
test('applyAuto: 묻는 동안 사용자가 고른 청구종류는 덮지 않고, 못 고르면 항목을 새로 만들지 않음', async () => {
  reset(); withFiles([], { type: '회의비', typeBy: 'user' });
  await S.applyAuto(KEY, META, { type: { value: '연구활동비 기타비용', reason: '' }, sig: 's', files: [], tried: [] });
  assert.strictEqual(store.claimPrep[KEY].type, '회의비');
  reset();
  const r = await S.applyAuto(KEY, META, { type: { value: '', reason: '모름' }, sig: 's', files: [], tried: [] });
  assert.strictEqual(r.entry, null); assert.strictEqual(store.claimPrep, undefined);
});
test('setType / setFileKind 는 사용자 선택으로 표시 (typeAuto·kindWhy 지움)', async () => {
  reset(); withFiles(['a.png'], { type: 'A', typeBy: 'auto', typeAuto: { why: 'x', sig: 's' } });
  const id = store.claimPrep[KEY].files[0].id;
  store.claimPrep[KEY].files[0].kindWhy = 'y'; store.claimPrep[KEY].files[0].kindBy = 'auto'; store.claimPrep[KEY].files[0].kind = '수료증';
  await S.setType(KEY, META, '회의비');
  await S.setFileKind(KEY, id, '교육내용');
  const e = store.claimPrep[KEY];
  assert.strictEqual(e.typeBy, 'user'); assert.strictEqual(e.typeAuto, undefined);
  assert.strictEqual(e.files[0].kindBy, 'user'); assert.strictEqual(e.files[0].kindWhy, undefined); assert.strictEqual(e.files[0].name, '교육내용_a.png');
});

test('청구내역: wantPtcl 이면 스키마에 ptcl, 연구 개발내용·작성 안내·예를 붙이고 참고 파일 내용을 넣음 — 지금 청구내역(Claude 가 쓴 것)은 보내지 않음', () => {
  const input = classify.clean({ tx: { shop: 'Microsoft-G190457040', amount: 603566, usedDate: '20261009', project: '반도체 차단기' }, ptcl: '옛 글', type: '클라우드 사용비', wantPtcl: true, ptclGuide: '품목 - 용도',
    kinds: ['거래명세서'], files: [{ id: 'a', name: 'inv.pdf', kind: '거래명세서', ref: true, b64: 'JVBE', media: 'application/pdf' }, { id: 'b', name: 'x.png', kind: '거래명세서', b64: 'iVBO', media: 'image/png' }],
    history: [{ shop: 'OPENAI', ptcl: 'ChatGPT 구독 - 문서 요약', type: '소프트웨어 활용비' }, { shop: 'B', ptcl: '', type: '회의비' }],
    research: { year: '1차년도', goals: ['10kV 차단기 개발'], contents: ['차단기 제어 알고리즘 시뮬레이션', '고장 진단 AI'], spend: [{ name: '클라우드', kind: '사용료' }] } });
  assert.strictEqual(input.wantPtcl, true); assert.strictEqual(input.ptcl, ''); assert.strictEqual(input.refs.length, 1); assert.strictEqual(input.files[1].b64, undefined, 'ref 가 아닌 파일 내용은 버림');
  const { content, schema } = classify.build(input);
  assert.deepStrictEqual(schema.required, ['ptcl']);
  const intro = content[0].text;
  assert.ok(intro.includes('[할 일] ptcl') && intro.includes('개발내용: 차단기 제어 알고리즘 시뮬레이션 / 고장 진단 AI') && intro.includes('사용자의 작성 안내') && intro.includes('"ChatGPT 구독 - 문서 요약"'), intro);
  assert.ok(!intro.includes('옛 글') && !intro.includes('"B"'));
  assert.deepStrictEqual(content.slice(1).map((b) => b.type), ['text', 'text', 'document']);
  const r = classify.parse(input, { ptcl: { value: ' "Azure 클라우드 사용료(9월분) - 차단기 시뮬레이션용." \n', reason: '인보이스' } });
  assert.deepStrictEqual(r.ptcl, { value: 'Azure 클라우드 사용료(9월분) - 차단기 시뮬레이션용', reason: '인보이스' });
  assert.strictEqual(classify.clean({ wantPtcl: false, files: [{ id: 'a', ref: true, b64: 'x', media: 'image/png' }] }).wantPtcl, false);
});
test('ptclFree: 비었거나 Claude 가 쓴 것만, 사용자가 적은 것(0.8.5 전 글 포함)·작성 중·임시저장은 아님', () => {
  assert.ok(S.ptclFree(null)); assert.ok(S.ptclFree({ ptcl: '' })); assert.ok(S.ptclFree({ ptcl: 'a', ptclBy: 'auto' }));
  assert.ok(!S.ptclFree({ ptcl: 'a' })); assert.ok(!S.ptclFree({ ptcl: 'a', ptclBy: 'user' })); assert.ok(!S.ptclFree({ ptcl: '', ptclBy: 'auto', run: { state: 'saved' } }));
});

/* ---------- lib/prep-ai.js ---------- */
test('run: 항목이 없는 거래(줄을 처음 엶)는 가맹점 정보로 청구종류를 묻고 넣음, 같은 입력으로는 다시 묻지 않음', async () => {
  reset();
  const r = await AI.run(KEY, META);
  assert.strictEqual(r.ok, true); assert.strictEqual(r.type.value, '연구활동비 기타비용');
  assert.strictEqual(calls.length, 1);
  const b = calls[0];
  assert.strictEqual(b.wantType, true); assert.strictEqual(b.tx.shop, '주식회사 인프랩'); assert.strictEqual(b.files.length, 0);
  assert.ok(b.picks.find((p) => p.label === '식사비').hint.includes('회의록 필요(식비)'));
  assert.strictEqual(store.claimPrep[KEY].typeBy, 'auto');
  const again = await AI.run(KEY, META);
  assert.strictEqual(again.skipped, 'none'); assert.strictEqual(calls.length, 1);
});
test('run: 청구내역이 바뀌면 Claude 가 고른 청구종류를 다시 묻고, 사용자가 고른 뒤에는 묻지 않음', async () => {
  reset(); await AI.run(KEY, META);
  await S.setPtcl(KEY, META, '회의 다과');
  reply = { ok: true, type: { value: '회의비', reason: '회의' }, files: [] };
  const r = await AI.run(KEY, META);
  assert.strictEqual(r.type.value, '회의비'); assert.strictEqual(calls.length, 2); assert.strictEqual(calls[1].ptcl, '회의 다과');
  await S.setType(KEY, META, '연구실 운영비');
  await S.setPtcl(KEY, META, '다른 글');
  const r2 = await AI.run(KEY, META);
  assert.strictEqual(r2.skipped, 'none'); assert.strictEqual(calls.length, 2); assert.strictEqual(store.claimPrep[KEY].type, '연구실 운영비');
});
test('run: 청구종류를 사용자가 정했어도 새 파일의 종류는 묻는다 (파일만, 한 번만)', async () => {
  reset(); withFiles(['capture_x.png'], { type: '회의비', typeBy: 'user' });
  const id = store.claimPrep[KEY].files[0].id;
  reply = (b) => ({ ok: true, type: null, files: b.files.filter((f) => f.classify).map((f) => ({ id: f.id, kind: '거래명세서', reason: '표' })) });
  const r = await AI.run(KEY, META);
  assert.strictEqual(calls[0].wantType, false); assert.strictEqual(calls[0].type, '회의비'); assert.deepStrictEqual(calls[0].files.map((f) => f.classify), [true]);
  assert.deepStrictEqual(r.kinds, [{ id, kind: '거래명세서' }]);
  assert.strictEqual(store.claimPrep[KEY].files[0].name, '거래명세서_x.png');
  assert.strictEqual((await AI.run(KEY, META)).skipped, 'none'); assert.strictEqual(calls.length, 1);
});
test('run: 서버가 없거나 이전 버전이거나 설정이 꺼져 있으면 묻지 않음', async () => {
  // 서버 확인 결과는 30초 캐시라 경우마다 다른 주소로
  reset(); healthReply = null; settings.help.url = 'http://127.0.0.1:8201';
  assert.strictEqual((await AI.run('k1|1', META)).skipped, 'offline');
  reset(); healthReply = { ok: true, name: 'krx-help' }; settings.help.url = 'http://127.0.0.1:8202';
  assert.strictEqual((await AI.run('k2|1', META)).skipped, 'old');
  reset(); settings.help.autoPick = false;
  assert.strictEqual((await AI.run('k3|1', META)).skipped, 'off');
  assert.strictEqual(calls.length, 0);
});
test('run: 같은 거래의 요청이 겹치면 하나만 돌고 끝난 뒤 한 번 더 (파일을 연달아 넣은 경우)', async () => {
  reset(); settings.help.url = 'http://127.0.0.1:8107';
  withFiles(['capture_1.png'], { type: '회의비', typeBy: 'user' });
  reply = (b) => ({ ok: true, type: null, files: b.files.filter((f) => f.classify).map((f) => ({ id: f.id, kind: '거래명세서', reason: '' })) });
  const p1 = AI.run(KEY, META);
  await new Promise((r) => setTimeout(r, 5));
  store.claimPrep[KEY].files.push({ id: 'late', name: 'capture_2.png', mime: 'image/png', size: 10, ts: 2 });   // 첫 요청이 도는 동안 둘째 파일
  const p2 = AI.run(KEY, META);
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.strictEqual(r1, r2);
  assert.strictEqual(calls.length, 2);
  assert.deepStrictEqual(calls[1].files.filter((f) => f.classify).map((f) => f.id), ['late']);
  assert.strictEqual(r1.kinds.length, 2);
});
test('run: 청구내역이 비어 있으면 청구종류와 함께 Claude 가 쓰고(연구내용 참조), 같은 입력으로는 다시 쓰지 않음', async () => {
  reset(); settings.help.url = 'http://127.0.0.1:8301';
  store.researchPlans = {};
  reply = { ok: true, type: { value: '연구활동비 기타비용', reason: '강의' }, ptcl: { value: 'LLM 평가 강의 수강 - 고장 진단 AI 검증', reason: '계획서 개발내용' }, files: [] };
  const r = await AI.run(KEY, META);
  assert.strictEqual(r.ptcl.value, 'LLM 평가 강의 수강 - 고장 진단 AI 검증');
  assert.strictEqual(calls[0].wantType, true); assert.strictEqual(calls[0].wantPtcl, true);
  const e = store.claimPrep[KEY];
  assert.strictEqual(e.ptcl, 'LLM 평가 강의 수강 - 고장 진단 AI 검증'); assert.strictEqual(e.ptclBy, 'auto'); assert.strictEqual(e.ptclAuto.sig, S.ptclSig(e));
  assert.strictEqual((await AI.run(KEY, META)).skipped, 'none', 'Claude 가 쓴 청구내역은 청구종류를 다시 묻게 하지 않음'); assert.strictEqual(calls.length, 1);
});
test('run: 청구종류를 바꾸면 Claude 가 쓴 청구내역만 다시 쓰고, 사용자가 고친 글은 그대로 · 비우면 다시 씀', async () => {
  reset(); settings.help.url = 'http://127.0.0.1:8302';
  reply = { ok: true, type: { value: '연구활동비 기타비용', reason: '' }, ptcl: { value: '첫 글', reason: '' }, files: [] };
  await AI.run(KEY, META);
  await S.setType(KEY, META, '회의비');
  reply = (b) => ({ ok: true, type: null, ptcl: { value: `${b.type} 글`, reason: '' }, files: [] });
  await AI.run(KEY, META);
  assert.strictEqual(calls[1].wantType, false); assert.strictEqual(calls[1].wantPtcl, true);
  assert.strictEqual(store.claimPrep[KEY].ptcl, '회의비 글');
  await S.setPtcl(KEY, META, '내가 쓴 글');
  assert.strictEqual(store.claimPrep[KEY].ptclBy, 'user');
  await S.setType(KEY, META, '연구실 운영비');
  assert.strictEqual((await AI.run(KEY, META)).skipped, 'none'); assert.strictEqual(store.claimPrep[KEY].ptcl, '내가 쓴 글');
  await S.setPtcl(KEY, META, '');
  await AI.run(KEY, META);
  assert.strictEqual(store.claimPrep[KEY].ptcl, '연구실 운영비 글'); assert.strictEqual(calls.length, 3);
});
test('run force([AI] 단추): 사용자가 적은 글·같은 입력·자동 분류 꺼짐이어도 청구내역을 다시 쓰고, 찾아온 상품 이름(prepFetch item)·파일 출처 제목을 보냄 · 임시저장된 거래는 안 바꿈', async () => {
  reset(); settings.help.url = 'http://127.0.0.1:8304'; settings.help.autoPick = false;
  withFiles(['강의내용_inflearn.com_1.pdf'], { ptcl: '내가 쓴 글', ptclBy: 'user' });
  store.claimPrep[KEY].files[0].kind = '강의내용'; store.claimPrep[KEY].files[0].kindBy = 'fetch'; store.claimPrep[KEY].files[0].title = 'LLM 평가 하네스 엔지니어링 강의 | 인프런'; store.claimPrep[KEY].files[0].url = 'https://www.inflearn.com/course/x';
  store.prepFetch = { [KEY]: { state: 'done', item: '실리콘밸리 개발자가 알려주는 LLM 평가 하네스 엔지니어링' } };
  reply = { ok: true, type: null, ptcl: { value: 'LLM 평가 하네스 강의 수강 - 규정 분석', reason: '찾아온 주문' }, files: [] };
  assert.strictEqual((await AI.run(KEY, META)).skipped, 'off', '설정이 꺼져 있으면 보통 요청은 건너뜀');
  const r = await AI.run(KEY, META, { force: true });
  assert.strictEqual(r.ptcl.value, 'LLM 평가 하네스 강의 수강 - 규정 분석');
  assert.strictEqual(calls.length, 1); assert.strictEqual(calls[0].wantPtcl, true); assert.strictEqual(calls[0].wantType, true, '청구종류는 비어 있으니 보통대로 묻기');
  assert.strictEqual(calls[0].tx.item, '실리콘밸리 개발자가 알려주는 LLM 평가 하네스 엔지니어링');
  assert.strictEqual(calls[0].files[0].title, 'LLM 평가 하네스 엔지니어링 강의 | 인프런');
  const e = store.claimPrep[KEY];
  assert.strictEqual(e.ptcl, 'LLM 평가 하네스 강의 수강 - 규정 분석'); assert.strictEqual(e.ptclBy, 'auto', '다시 쓴 글은 Claude 것 — 그 뒤 서류가 바뀌면 또 다시 씀');
  const prompt = classify.build(classify.clean(calls[0])).content.map((b) => b.text || '').join('\n');
  assert.ok(/구매한 상품·강의.*하네스 엔지니어링/.test(prompt) && /출처 페이지 "LLM 평가 하네스 엔지니어링 강의 \| 인프런"/.test(prompt), '프롬프트에 상품 이름과 출처 제목');
  await AI.run(KEY, META, { force: true });
  assert.strictEqual(calls.length, 2, 'force 는 같은 입력이어도 다시 묻는다');
  store.claimPrep[KEY].run = { state: 'saved' };   // (e 는 앞 run 의 저장으로 바뀐 옛 객체)
  reply = { ok: true, type: null, ptcl: { value: '새 글', reason: '' }, files: [] };
  const r3 = await AI.run(KEY, META, { force: true });
  assert.strictEqual(r3.ptcl, null); assert.strictEqual(store.claimPrep[KEY].ptcl, 'LLM 평가 하네스 강의 수강 - 규정 분석', '임시저장된 거래의 청구내역은 force 여도 안 바꿈');
});
test('run: 못 쓰면(빈 값) 같은 입력으로 다시 묻지 않고, 청구내역을 못 쓰는 옛 서버면 청구내역만 건너뜀', async () => {
  reset(); settings.help.url = 'http://127.0.0.1:8303';
  withFiles([], { type: '회의비', typeBy: 'user' });
  reply = { ok: true, type: null, ptcl: { value: '', reason: '근거 없음' }, files: [] };
  await AI.run(KEY, META);
  assert.strictEqual(calls.length, 1); assert.strictEqual(store.claimPrep[KEY].ptcl, '');
  assert.strictEqual((await AI.run(KEY, META)).skipped, 'none'); assert.strictEqual(calls.length, 1);
  reset(); settings.help.url = 'http://127.0.0.1:8304'; healthReply = { ok: true, name: 'krx-help', classify: 'claude-haiku-5-5' };
  const user = (k) => { store.claimPrep = { [k]: Object.assign({ key: k, type: '회의비', typeBy: 'user', ptcl: '', ts: 1, attached: null, files: [] }, META) }; };   // 위에서 KEY 는 못 쓴 입력으로 기억됨 → 다른 키
  user('old|1');
  assert.strictEqual((await AI.run('old|1', META)).skipped, 'oldPtcl'); assert.strictEqual(calls.length, 0);
  reset(); settings.help.url = 'http://127.0.0.1:8305'; settings.help.autoPtcl = false;
  user('off|1');
  assert.strictEqual((await AI.run('off|1', META)).skipped, 'none', '설정에서 끄면 쓰지 않음');
});
test('remember: 가맹점·적요별 최신 청구종류만, 사용자 예는 그 청구종류가 후보에 있을 때만 보냄', async () => {
  reset();
  await AI.remember({ shop: 'A', ptcl: '', type: '회의비' });
  await AI.remember({ shop: 'A', ptcl: '', type: '연구실 운영비' });
  await AI.remember({ shop: 'B', ptcl: 'x', type: '없는 종류' });
  assert.deepStrictEqual(store.prepTypeHist.map((h) => [h.shop, h.type]), [['B', '없는 종류'], ['A', '연구실 운영비']]);
  await AI.run(KEY, META);
  assert.deepStrictEqual(calls[0].history.map((h) => h.shop), ['A']);
});

/* ---------- lib/claude-api.js · Claude API 로 직접 (0.8.6) ---------- */
const TEST_KEY = 'sk-ant-api03-test-0000000000-WXYZ';
const apiMsg = (out, extra) => ({ status: 200, body: Object.assign({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-haiku-5-5', stop_reason: 'end_turn',
  content: [{ type: 'thinking', thinking: '', signature: 's' }, { type: 'text', text: JSON.stringify(out) }], usage: { input_tokens: 900, output_tokens: 80 } }, extra || {}) });

test('Claude API check: GET /v1/models/{모델} 을 키·버전·브라우저 직접 호출 헤더로 부르고 상태를 남김 (401 은 다시 하지 않고 오류)', async () => {
  reset();
  apiReply = { status: 200, body: { id: 'claude-haiku-5-5', display_name: 'Claude Haiku 5.5' } };
  const st = await API.check({ key: TEST_KEY, model: 'claude-haiku-5-5' });
  assert.strictEqual(st.ok, true); assert.strictEqual(st.name, 'Claude Haiku 5.5');
  const c = apiCalls[0];
  assert.strictEqual(c.url, 'https://api.anthropic.com/v1/models/claude-haiku-5-5'); assert.strictEqual(c.method, 'GET');
  assert.strictEqual(c.headers['x-api-key'], TEST_KEY); assert.strictEqual(c.headers['anthropic-version'], '2023-06-01'); assert.strictEqual(c.headers['anthropic-dangerous-direct-browser-access'], 'true');
  assert.strictEqual(store.llmApi.ok, true); assert.strictEqual(store.llmApi.keyTag, API.keyTag(TEST_KEY));
  apiReply = { status: 401, body: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } } };
  const bad = await API.check({ key: 'sk-bad', model: 'claude-haiku-5-5' });
  assert.strictEqual(bad.ok, false); assert.ok(bad.error.includes('401'), bad.error); assert.strictEqual(store.llmApi.ok, false);
  assert.strictEqual(apiCalls.length, 2);
  assert.strictEqual(API.modelOf('이상한 값'), 'claude-opus-5-5'); assert.strictEqual(API.mask(TEST_KEY), 'sk-ant-…WXYZ');
});
test('Claude API 워크스페이스 ID: 워크스페이스에 묶이지 않은 키의 400 은 설정 안내로, check 는 입력란 값(o.ws)·그 밖은 저장된 claudeApiWorkspace 를 anthropic-workspace-id 헤더로', async () => {
  reset();
  apiReply = { status: 400, body: { type: 'error', error: { type: 'invalid_request_error', message: 'This API key is not scoped to a workspace, so this request must include the anthropic-workspace-id header with the ID of the workspace to use. Add the header, or use an API key that is scoped to a workspace.' } } };
  const bad = await API.check({ key: 'sk-ant-usr-x', model: 'claude-haiku-5-5' });
  assert.strictEqual(bad.ok, false); assert.ok(/워크스페이스 ID/.test(bad.error) && bad.error.includes('400'), bad.error);
  assert.strictEqual(apiCalls[0].headers['anthropic-workspace-id'], undefined, '저장된 것도 입력도 없으면 헤더 없음');
  apiReply = { status: 200, body: { id: 'claude-haiku-5-5', display_name: 'Claude Haiku 5.5' } };
  const ok = await API.check({ key: 'sk-ant-usr-x', model: 'claude-haiku-5-5', ws: ' wrkspc_abc ' });
  assert.strictEqual(ok.ok, true); assert.strictEqual(apiCalls[1].headers['anthropic-workspace-id'], 'wrkspc_abc', 'check 는 입력란 값(저장 전)을 씀');
  store.claudeApiWorkspace = 'wrkspc_saved'; store.claudeApiKey = TEST_KEY;
  const input = classify.clean({ tx: { shop: 'X' }, wantType: true, picks: [{ label: 'A' }], kinds: [], files: [] });
  apiReply = () => apiMsg({ type: { value: 'A', reason: '' } });
  await API.classify(input, {});
  assert.strictEqual(apiCalls[2].headers['anthropic-workspace-id'], 'wrkspc_saved', '저장된 워크스페이스 ID 는 모든 호출에');
  assert.strictEqual(apiCalls[2].headers['x-api-key'], TEST_KEY);
});
test('Claude API classify: Help 서버와 같은 프롬프트·스키마로 구조화 출력(effort low) — Haiku 는 대체 모델 없음 · Opus 는 fallbacks "default" + 베타 헤더', async () => {
  reset(); store.claudeApiKey = TEST_KEY;
  const input = classify.clean({ tx: { shop: '인프랩', amount: 43560 }, wantType: true, picks: [{ label: '회의비' }, { label: '연구활동비 기타비용' }], kinds: ['수료증'],
    files: [{ id: 'f1', name: 'a.png', classify: true, b64: 'iVBO', media: 'image/jpeg' }] });
  apiReply = () => apiMsg({ type: { value: '연구활동비 기타비용', reason: '강의' }, files: [{ id: 'f1', kind: '수료증', reason: '수료증 제목' }, { id: 'zz', kind: '수료증', reason: '' }] });
  const r = await API.classify(input, { model: 'claude-haiku-5-5' });
  assert.deepStrictEqual(r.type, { value: '연구활동비 기타비용', reason: '강의' });
  assert.deepStrictEqual(r.files.map((f) => [f.id, f.kind]), [['f1', '수료증']], '모르는 id 는 버림 (classify-core parse)');
  const c = apiCalls[0];
  assert.strictEqual(c.url, 'https://api.anthropic.com/v1/messages'); assert.strictEqual(c.method, 'POST');
  const { content, schema } = classify.build(input);
  assert.strictEqual(c.body.model, 'claude-haiku-5-5'); assert.strictEqual(c.body.system, classify.SYSTEM);
  assert.deepStrictEqual(c.body.messages, [{ role: 'user', content }]);
  assert.deepStrictEqual(c.body.output_config, { effort: 'low', format: { type: 'json_schema', schema } });
  assert.strictEqual(c.body.thinking, undefined); assert.strictEqual(c.body.fallbacks, undefined); assert.strictEqual(c.headers['anthropic-beta'], undefined);
  await API.classify(input, { model: 'claude-opus-5-5' });
  assert.strictEqual(apiCalls[1].body.fallbacks, 'default'); assert.strictEqual(apiCalls[1].headers['anthropic-beta'], 'server-side-fallback-2026-07-01');
});
test('Claude API classify: 거절(refusal)·키 오류는 오류로(키 오류는 상태에도), 429 는 다시 해서 성공', async () => {
  reset(); store.claudeApiKey = TEST_KEY;
  const input = classify.clean({ tx: { shop: 'X' }, wantType: true, picks: [{ label: 'A' }], kinds: [], files: [] });
  apiReply = { status: 200, body: { type: 'message', stop_reason: 'refusal', stop_details: { type: 'refusal', category: 'cyber' }, content: [] } };
  await assert.rejects(API.classify(input, {}), /거절.*cyber/);
  apiReply = { status: 401, body: { type: 'error', error: { type: 'authentication_error', message: 'invalid' } } };
  await assert.rejects(API.classify(input, {}), /API 키가 올바르지 않습니다/);
  assert.strictEqual(store.llmApi.ok, false);
  let tries = 0;
  apiReply = () => (tries++ === 0 ? { status: 429, body: { type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } } } : apiMsg({ type: { value: 'A', reason: '' } }));
  const r = await API.classify(input, {});
  assert.strictEqual(r.type.value, 'A'); assert.strictEqual(tries, 2); assert.strictEqual(store.llmApi.ok, true, '성공하면 상태도 사용 가능으로');
});
test('run: Help 서버가 없으면 Claude API 키로 직접 묻고(via api), 서버가 있으면 서버 · "항상"이면 API · "사용 안 함"이면 건너뜀', async () => {
  const ok = () => apiMsg({ type: { value: '연구활동비 기타비용', reason: '강의' }, ptcl: { value: '온라인 강의 수강 - 연구', reason: '' } });
  reset(); healthReply = null; settings.help.url = 'http://127.0.0.1:8401'; store.claudeApiKey = TEST_KEY; apiReply = ok;
  const r = await AI.run('api|1', META);
  assert.strictEqual(r.via, 'api'); assert.strictEqual(r.type.value, '연구활동비 기타비용'); assert.strictEqual(r.ptcl.value, '온라인 강의 수강 - 연구');
  assert.strictEqual(calls.length, 0); assert.strictEqual(apiCalls.length, 1);
  assert.strictEqual(apiCalls[0].body.model, 'claude-opus-5-5', '모델 설정이 없으면 기본 Opus 5.5');
  assert.strictEqual(store.claimPrep['api|1'].typeBy, 'auto'); assert.strictEqual(store.claimPrep['api|1'].ptclBy, 'auto');

  reset(); settings.help.url = 'http://127.0.0.1:8402'; store.claudeApiKey = TEST_KEY; apiReply = ok;
  const r2 = await AI.run('srv|1', META);
  assert.strictEqual(r2.via, 'server'); assert.strictEqual(calls.length, 1); assert.strictEqual(apiCalls.length, 0);

  reset(); settings.help.url = 'http://127.0.0.1:8403'; settings.help.api = { use: 'always', model: 'claude-sonnet-5-5' }; store.claudeApiKey = TEST_KEY; apiReply = ok;
  const r3 = await AI.run('alw|1', META);
  assert.strictEqual(r3.via, 'api'); assert.strictEqual(calls.length, 0); assert.strictEqual(apiCalls[0].body.model, 'claude-sonnet-5-5');

  reset(); healthReply = null; settings.help.url = 'http://127.0.0.1:8404'; settings.help.api = { use: 'off' }; store.claudeApiKey = TEST_KEY; apiReply = ok;
  assert.strictEqual((await AI.run('off2|1', META)).skipped, 'offline'); assert.strictEqual(apiCalls.length, 0);
});
test('run: 서버 분류가 실패하면 Claude API 로 다시 묻고, 둘 다 실패하면 두 이유를 함께', async () => {
  reset(); settings.help.url = 'http://127.0.0.1:8405'; store.claudeApiKey = TEST_KEY;
  reply = { ok: false, kind: 'claude', error: 'Not logged in' };
  apiReply = () => apiMsg({ type: { value: '회의비', reason: '' }, ptcl: { value: '', reason: '' } });
  const r = await AI.run('fb|1', META);
  assert.strictEqual(r.via, 'api'); assert.strictEqual(r.type.value, '회의비'); assert.strictEqual(calls.length, 1); assert.strictEqual(apiCalls.length, 1);
  reset(); settings.help.url = 'http://127.0.0.1:8406'; store.claudeApiKey = TEST_KEY;
  reply = { ok: false, error: 'Not logged in' };
  apiReply = { status: 401, body: { type: 'error', error: { type: 'authentication_error', message: 'invalid' } } };
  const r2 = await AI.run('fb|2', META);
  assert.strictEqual(r2.ok, false); assert.ok(r2.error.includes('Not logged in') && r2.error.includes('401'), r2.error);
});

(async () => {
  for (const [name, fn] of queue) {
    try { await fn(); n++; console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n   ', e.stack || e.message); process.exitCode = 1; }
  }
  console.log(`\n${n} passed, ${failed} failed`);
})();
