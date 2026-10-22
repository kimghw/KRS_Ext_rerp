/* 청구 준비 줄 💬 의 찾는 방법 익히기 채팅(popup/prep-chat.js, 2026-10-22) 테스트 — 💬 로 그 거래 밑에 열고 닫기, 보내기 → Help 서버 POST /ask(가맹점 + 이 거래 + 요청),
 * GET /job 이 끝나면 답변의 howto: 를 그 가맹점에 저장(fetchSiteSave), 마지막 요청은 설정 페이지와 같은 storage.local.fetchChat. chrome · fetch 는 가짜. 실행: node tests/prep-chat.test.js */
globalThis.self = globalThis;
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..');

let store = {};
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const sent = [];   // runtime.sendMessage
globalThis.chrome = {
  storage: {
    local: {
      get: async (k) => { const out = {}; for (const x of [].concat(k)) if (x in store) out[x] = clone(store[x]); return out; },
      set: async (o) => { for (const [k, v] of Object.entries(o)) store[k] = clone(v); },
    },
    onChanged: { addListener: () => {} },
  },
  runtime: { getManifest: () => ({ version: '0.0.0' }), sendMessage: async (m) => { sent.push(m); return { ok: true }; } },
};
globalThis.CSS = { escape: (s) => s };
globalThis.KRX_SETTINGS = { load: async () => ({ help: { url: 'http://127.0.0.1:8106' } }) };
const posts = [];
let job = null;
globalThis.fetch = async (url, init) => {
  const u = new URL(url);
  if (u.pathname === '/ask') { posts.push(JSON.parse(init.body)); return { status: 200, json: async () => ({ ok: true, id: 'J1' }) }; }
  if (u.pathname === '/job') return { status: 200, json: async () => job };
  return { status: 404, json: async () => ({ ok: false }) };
};
require(path.join(root, 'lib/fetch-sites.js'));
require(path.join(root, 'popup/prep-chat.js'));

/* 가짜 패널: 이벤트 처리기만 모아 두고 직접 부름 */
const handlers = {};
const host = { addEventListener: (t, fn) => { (handlers[t] = handlers[t] || []).push(fn); }, querySelector: () => null };
const fire = (t, ev) => (handlers[t] || []).forEach((fn) => fn(Object.assign({ preventDefault() {} }, ev)));
const row = { dataset: { prepKey: 'k1', prepMeta: JSON.stringify({ shop: '주식회사 인프랩', amount: 43560, usedDate: '20261006' }) } };
const btn = (act) => ({ dataset: { act, key: 'k1' }, closest: (sel) => (sel === '[data-prep-key]' ? row : btn(act)) });
const click = (act) => fire('click', { target: { closest: () => btn(act) } });
const flush = () => new Promise((r) => setTimeout(r, 30));

const site = { id: 's1', label: '인프런', match: '인프랩', url: 'https://www.inflearn.com/my/orders', kind: 'lecture', docs: [] };
store.fetchSites = [site];
const state = { fetchSites: [site], data: { settings: { fetchDocs: { lecture: ['강의내용', '견적서', '수강증'] } } } };
let draws = 0;

(async () => {
  KRX_PREP_CHAT.bind(host, state, () => { draws++; });
  assert.strictEqual(KRX_PREP_CHAT.toggle('k1', 's1', '찾지 못함: 견적서(발급 메뉴 없음) — 고쳐 줘'), true, '묶여 있으면 💬 를 채팅이 받음');
  assert.deepStrictEqual(state.prepChat, { key: 'k1', siteId: 's1', draft: '찾지 못함: 견적서(발급 메뉴 없음) — 고쳐 줘', log: true }, '열 때 못 찾은 이유가 글에');
  assert.ok(draws > 0);

  fire('input', { target: { dataset: { prepChatIn: 'k1' }, value: '견적서는 구매 내역 상세를 캡처해 줘' } });
  assert.strictEqual(state.prepChat.draft, '견적서는 구매 내역 상세를 캡처해 줘', '적는 글은 state.prepChat.draft 에');

  job = { ok: true, lines: [{ t: 1, k: 'info', s: '시작' }], next: 1, job: { state: 'done', summary: '안내 고침', files: ['site-fetch/sites/inflearn.md'], detail: '안내 고침\nhowto: /my/orders → 주문 상세 캡처\nguide: site-fetch/sites/inflearn.md' } };
  click('prep-chat-send');
  await flush();
  assert.strictEqual(posts.length, 1, 'POST /ask 한 번');
  const p = posts[0];
  assert.ok(p.text.includes('인프랩') && p.text.includes('2026-10-06') && p.text.includes('43,560원') && p.text.includes('요청: 견적서는 구매 내역 상세를 캡처해 줘'), '가맹점 + 이 거래 + 요청: ' + p.text.slice(0, 200));
  assert.ok(!/비밀번호:|pw/.test(JSON.stringify(p.context)), '아이디·비밀번호는 보내지 않음');
  assert.strictEqual(p.context.from, '사이드 패널 › 청구 준비');
  assert.strictEqual(p.context.chat, 'fetch-site');
  assert.deepStrictEqual(p.context.site.docs, ['강의내용', '견적서', '수강증']);
  assert.strictEqual(state.prepChat.draft, '', '보내면 글을 비움');

  assert.strictEqual(state.fetchChat.state, 'done');
  assert.strictEqual(state.fetchChat.howto, true, 'howto 를 저장함');
  assert.strictEqual(store.fetchChat.id, 'J1', '마지막 요청은 storage.local.fetchChat (설정 페이지와 같음)');
  const save = sent.find((m) => m.type === 'fetchSiteSave');
  assert.ok(save && save.site.id === 's1' && save.site.howto === '/my/orders → 주문 상세 캡처', '답변의 howto: 줄을 그 가맹점에');
  assert.deepStrictEqual(state.fetchChatLog.lines.map((l) => l.s), ['시작']);

  click('prep-chat-new');
  await flush();
  assert.deepStrictEqual(store.fetchChat, { fresh: true }, '새 대화: 다음 요청은 이전 대화와 잇지 않음');
  job = { ok: true, lines: [], next: 0, job: { state: 'running' } };
  click('prep-chat-send');
  await flush();
  assert.strictEqual(posts[1].fresh, true);

  KRX_PREP_CHAT.toggle('k1', 's1', '');
  assert.strictEqual(state.prepChat, null, '다시 누르면 닫힘');
  console.log('prep-chat: ok');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
