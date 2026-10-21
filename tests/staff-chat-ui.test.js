/* 변경 도우미 UI 동작 — 외부 연결 없이 popup/staff-chat.js를 실행한다.
 * 예시는 초안만 채우고, 닫기는 초안을 보존하며, 연결·처리 중 제한을 지킨다.
 * 실행: node tests/staff-chat-ui.test.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../popup/staff-chat.js'), 'utf8');
const CORE = require(path.join(__dirname, '../lib/staff-chat-core.js'));
const clone = (value) => JSON.parse(JSON.stringify(value));
const online = { ok: true, url: 'http://127.0.0.1:8106', staff: 'test-model' };
const tick = () => new Promise((resolve) => setImmediate(resolve));
const queue = [];
const test = (name, run) => queue.push([name, run]);

async function harness(options = {}) {
  const elements = new Map();
  const getElement = (id) => {
    if (!elements.has(id)) elements.set(id, {
      id, value: '', textContent: '', innerHTML: '', className: '', hidden: false,
      disabled: false, scrollTop: 0, clientHeight: 100, scrollHeight: 100,
      listeners: {}, focusCount: 0,
      addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); },
      focus() { this.focusCount++; },
      emit(type, values = {}) {
        const event = { prevented: false, target: this, preventDefault() { this.prevented = true; }, ...values };
        for (const handler of this.listeners[type] || []) handler(event);
        return event;
      }
    });
    return elements.get(id);
  };
  const data = clone({ staffChat: { turns: [], open: true }, llmStatus: options.status || online, ...options.data });
  const calls = { fetch: [], apply: [], probe: [], api: [], clip: [] };
  const changes = [];
  const state = {};
  const globals = {
    document: { getElementById: getElement }, AbortController, setTimeout, clearTimeout, console, TextDecoder, File, btoa,
    navigator: { clipboard: { writeText: async (t) => { calls.clip.push(t); } } },
    KRX_STAFF_CHAT_CORE: CORE, KRX_HELP_SETUP: { prompt: (o) => `SETUP ${o.url} ${o.from}` },
    KRX_DOC_TEXT: { kindOf: (n) => (/\.txt$/i.test(n) ? 'text' : /\.pdf$/i.test(n) ? 'pdf' : ''), textOf: async (n, buf) => new TextDecoder().decode(buf) },
    chrome: {
      storage: {
        sync: { get: async () => (options.settings ? { settings: clone(options.settings) } : {}) },
        local: {
          get: async () => clone(data),
          set: async (value) => { Object.assign(data, clone(value)); },
          remove: async (key) => { delete data[key]; }
        },
        onChanged: { addListener: (listener) => changes.push(listener) }
      },
      runtime: { sendMessage: async (message) => { calls.probe.push(clone(message)); return clone(data.llmStatus); } }
    },
    fetch: async (url, init) => {
      calls.fetch.push({ url, body: JSON.parse(init.body) });
      return options.fetch ? options.fetch(url, init) : { json: async () => ({ ok: true, reply: '반영했습니다.', ops: [] }) };
    }
  };
  if (options.api) globals.KRX_CLAUDE_API = { mask: (k) => `…${String(k).slice(-4)}`, staff: async (input, o) => { calls.api.push({ input: clone(input), model: o.model, blocks: o.blocks }); return clone(options.apiResult || { reply: 'API 답', ops: [], dropped: 0, model: 'claude-opus-5-5' }); } };
  const context = vm.createContext(globals);
  context.self = context;
  vm.runInContext(source, context, { filename: 'popup/staff-chat.js' });
  const chat = context.KRX_STAFF_CHAT;
  await chat.init({ state, draw() {}, api: { agent: {
    snapshot: () => ({ prjNo: 'test-project', year: 1, names: ['문창재'] }),
    apply: async (ops) => { calls.apply.push(clone(ops)); return options.results || [{ ok: true, text: '참여율 변경', msg: '25%로 변경' }]; }
  } } });
  chat.show(true);
  await tick();
  const example = (text = '문창재 11월부터 참여율을 25%로 바꿔줘') => getElement('scLog').emit('click', {
    target: { closest: () => ({ getAttribute: () => text }) }
  });
  return { chat, get: getElement, data, calls, state, example, changes };
}

test('연결이 없으면 예시·직접 보내기를 막고 초안을 그대로 둔다', async () => {
  const h = await harness({ status: { ok: false, url: online.url }, data: { staffChatDraft: '내 초안' } });
  assert.equal(h.get('scText').disabled, true);
  assert.equal(h.get('scSend').disabled, true);
  h.example();
  await h.chat.send();
  assert.equal(h.get('scText').value, '내 초안');
  assert.deepEqual(h.calls.fetch, []);
  assert.deepEqual(h.calls.apply, []);
  assert.equal(h.get('scConnection').hidden, false);
});

test('예시는 초안만 채우며 닫았다 열어도 초안과 대화가 보존된다', async () => {
  const h = await harness();
  const request = '문창재 11월부터 참여율을 25%로 바꿔줘';
  h.example(request);
  assert.equal(h.get('scText').value, request);
  assert.equal(h.data.staffChatDraft, request);
  assert.deepEqual(h.calls.fetch, []);
  assert.deepEqual(h.calls.apply, []);
  assert.deepEqual(h.data.staffChat.turns, []);
  assert.ok(h.get('scText').focusCount > 0);
  h.get('scClose').emit('click');
  assert.equal(h.get('staffChat').hidden, true);
  assert.equal(h.data.staffChat.open, false);
  assert.equal(h.state.staffChatOpen, false);
  assert.equal(h.data.staffChatDraft, request);
  h.chat.toggle(true);
  await tick();
  assert.equal(h.get('staffChat').hidden, false);
  assert.equal(h.get('scText').value, request);
  assert.deepEqual(h.calls.fetch, []);
});

test('예산 규칙: 저장한 글(storage.local.staffRules)을 요청마다 rules 로 보내고, [규칙]이 대화 자리의 편집란을 열며 [저장]이 저장소에 남긴다', async () => {
  const h = await harness({ data: { staffRules: '- 초과금 금지' } });
  h.example();
  await h.chat.send();
  assert.equal(h.calls.fetch[0].body.rules, '- 초과금 금지');
  assert.equal(h.get('scRulesBox').hidden, true);
  h.get('scRules').emit('click');
  assert.equal(h.get('scRulesBox').hidden, false);
  assert.equal(h.get('scRulesText').value, '- 초과금 금지');
  assert.ok(h.get('scRulesText').focusCount > 0);
  h.get('scRulesText').value = '- 부족금은 두어도 됨';
  h.get('scRulesSave').emit('click');
  assert.equal(h.data.staffRules, '- 부족금은 두어도 됨');
  assert.ok(h.get('scRulesStatus').textContent.includes('저장했어요'));
  h.get('scRules').emit('click');
  assert.equal(h.get('scRulesBox').hidden, true);
  h.example();
  await h.chat.send();
  assert.equal(h.calls.fetch[1].body.rules, '- 부족금은 두어도 됨');
  h.get('scRules').emit('click');
  h.get('scRulesText').value = '';
  h.get('scRulesSave').emit('click');   // 비우고 저장 — 규칙 없이
  assert.equal(h.data.staffRules, '');
  h.example();
  await h.chat.send();
  assert.equal(h.calls.fetch[2].body.rules, '');
});

test('연결: 기본은 Claude CLI, 서버가 없어도 저장된 Claude API 키가 있으면 API 길(설정 off 면 안 씀 · always 면 먼저), 키가 없으면 안내 카드의 [설정 프롬프트 복사]와 API 키 [저장]', async () => {
  const h = await harness({ status: { ok: false, url: online.url }, api: true, data: { claudeApiKey: 'sk-ant-test-1234' }, apiResult: { reply: 'API 로 반영', ops: [{ op: 'change', name: '문창재', from: '2026-11-01', to: '', mode: 'rate', value: 25 }], dropped: 0, model: 'claude-opus-5-5' } });
  assert.equal(h.chat.route(), 'api');
  assert.ok(h.get('scStatus').textContent.includes('Claude API'));
  assert.equal(h.get('scText').disabled, false);
  assert.equal(h.get('scConnection').hidden, true);
  h.example();
  await h.chat.send();
  assert.equal(h.calls.fetch.length, 0);
  assert.equal(h.calls.api.length, 1);
  assert.equal(h.calls.api[0].model, 'claude-opus-5-5');
  assert.equal(h.calls.api[0].input.text, '문창재 11월부터 참여율을 25%로 바꿔줘');
  assert.equal(h.calls.api[0].input.snapshot.prjNo, 'test-project');
  assert.equal(h.calls.apply.length, 1);
  assert.equal(h.data.staffChat.turns[1].via, 'api');
  const off = await harness({ status: { ok: false, url: online.url }, api: true, data: { claudeApiKey: 'sk-ant-test-1234' }, settings: { help: { api: { use: 'off' } } } });
  assert.equal(off.chat.route(), '');
  assert.equal(off.get('scConnection').hidden, false);
  const always = await harness({ api: true, data: { claudeApiKey: 'sk-ant-test-1234' }, settings: { help: { api: { use: 'always' } } } });
  assert.equal(always.chat.route(), 'api');
  const cli = await harness({ api: true, data: { claudeApiKey: 'sk-ant-test-1234' } });
  assert.equal(cli.chat.route(), 'server');
  assert.ok(cli.get('scStatus').textContent.includes('Claude CLI'));
  const none = await harness({ status: { ok: false, url: online.url }, api: true });
  assert.equal(none.chat.route(), '');
  assert.equal(none.get('scConnection').hidden, false);
  assert.ok(none.get('scConnTitle').textContent.includes('Claude CLI'));
  assert.ok(none.get('scConnText').textContent.includes('node help-server/server.js'));
  none.get('scSetup').emit('click');
  await tick();
  assert.equal(none.calls.clip[0], `SETUP ${online.url} 참여연구원 변경 도우미`);
  assert.ok(none.get('scSetupNote').textContent.includes('복사했어요'));
  none.get('scApiKey').value = ' sk-ant-new-9999 ';
  none.get('scApiSave').emit('click');
  await tick();
  assert.equal(none.data.claudeApiKey, 'sk-ant-new-9999');
  assert.equal(none.chat.route(), 'api');
  assert.equal(none.get('scConnection').hidden, true);
});

test('첨부: 글 파일은 보내기 전에 글을 뽑아 files 로 보내고, 보낸 뒤 목록은 비며 말풍선에 이름이 남는다 (서버가 첨부를 받는 버전일 때만 📎)', async () => {
  const h = await harness({ status: { ...online, staffFiles: true } });
  assert.equal(h.get('scAttach').disabled, false);
  h.chat.attach([new File(['문창재 11월부터 25%'], '메모.txt', { type: 'text/plain' }), new File(['x'], '표.pptx')]);
  assert.equal(h.get('scFiles').hidden, false);
  assert.ok(h.get('scHint').textContent.includes('pptx'), '못 붙이는 종류는 안내');
  h.get('scText').value = '첨부대로 반영해줘';
  await h.chat.send();
  const body = h.calls.fetch[0].body;
  assert.equal(body.files.length, 1);
  assert.deepEqual([body.files[0].name, body.files[0].kind, body.files[0].text, body.files[0].data], ['메모.txt', 'text', '문창재 11월부터 25%', '']);
  assert.deepEqual(h.data.staffChat.turns[0].files, ['메모.txt']);
  assert.equal(h.get('scFiles').hidden, true);
  const old = await harness();
  assert.equal(old.get('scAttach').disabled, true, 'staffFiles 없는 서버');
});

test('사용자가 보낼 때만 요청하고 처리 중 중복 전송·예시를 막는다', async () => {
  let resolveReply;
  const h = await harness({ fetch: () => new Promise((resolve) => { resolveReply = resolve; }), results: [
    { ok: true, text: '문창재 참여율 변경', msg: '25%로 변경' },
    { ok: false, text: '홍길동 제외', msg: '계획에 없습니다.' }
  ] });
  h.example();
  const sending = h.chat.send();
  assert.equal(h.calls.fetch.length, 1);
  assert.equal(h.calls.fetch[0].url, online.url + '/staff');
  assert.equal(h.calls.fetch[0].body.text, '문창재 11월부터 참여율을 25%로 바꿔줘');
  assert.equal(h.calls.fetch[0].body.snapshot.prjNo, 'test-project');
  assert.deepEqual(h.calls.fetch[0].body.history, []);
  assert.equal(h.get('scText').disabled, true);
  assert.equal(h.get('scSend').disabled, true);
  assert.equal(h.get('scNew').disabled, true);
  assert.ok(h.get('scLog').innerHTML.includes('sc-wait'));
  h.example('이 글은 들어가면 안 됨');
  assert.equal(h.get('scText').value, '');
  await h.chat.send();
  assert.equal(h.calls.fetch.length, 1);
  resolveReply({ json: async () => ({ ok: true, reply: '요청을 확인했습니다.', ops: [{ op: 'change', name: '문창재', value: 25 }] }) });
  await sending;
  assert.equal(h.calls.apply.length, 1);
  assert.equal(h.data.staffChat.turns.length, 2);
  assert.deepEqual(h.data.staffChat.turns[1].results.map((r) => r.ok), [true, false]);
  assert.equal(h.get('scText').disabled, false);
  assert.equal(h.get('scSend').disabled, false);
  assert.equal(h.get('scLog').innerHTML.includes('sc-wait'), false);
  assert.equal(h.data.staffChatDraft, undefined);
});

test('실패 응답은 계획에 적용하지 않고 입력을 다시 허용한다', async () => {
  const h = await harness({ fetch: async () => ({ json: async () => ({ ok: false, kind: 'model', error: '테스트 실패' }) }) });
  h.example();
  await h.chat.send();
  assert.deepEqual(h.calls.apply, []);
  assert.equal(h.data.staffChat.turns[1].error, true);
  assert.ok(h.data.staffChat.turns[1].text.includes('테스트 실패'));
  assert.equal(h.get('scText').disabled, false);
});

test('Shift+Enter와 한글 조합 중 Enter는 전송하지 않고 일반 Enter는 한 번 전송한다', async () => {
  const h = await harness();
  h.example();
  assert.equal(h.get('scText').emit('keydown', { key: 'Enter', shiftKey: true }).prevented, false);
  assert.equal(h.get('scText').emit('keydown', { key: 'Enter', isComposing: true }).prevented, false);
  assert.equal(h.calls.fetch.length, 0);
  assert.equal(h.get('scText').emit('keydown', { key: 'Enter' }).prevented, true);
  await tick();
  assert.equal(h.calls.fetch.length, 1);
});

(async () => {
  let passed = 0;
  for (const [name, run] of queue) {
    try { await run(); passed++; console.log('ok  ', name); }
    catch (error) { process.exitCode = 1; console.error('FAIL', name, '\n', error.stack); }
  }
  console.log(`${passed} passed, ${queue.length - passed} failed`);
})();
