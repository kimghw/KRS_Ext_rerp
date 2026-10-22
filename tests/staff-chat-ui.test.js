/* 변경 도우미 UI 동작 — 외부 연결 없이 popup/staff-chat.js를 실행한다.
 * 예시는 초안만 채우고, 닫기는 초안을 보존하며, 연결·처리 중 제한을 지킨다.
 * 실행: node tests/staff-chat-ui.test.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../popup/staff-chat.js'), 'utf8');
const CORE = require(path.join(__dirname, '../lib/staff-chat-core.js'));
const ALLOW_CORE = require(path.join(__dirname, '../lib/allow-chat-core.js'));   // 연구수당 도우미(allow 모드)
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
  const calls = { fetch: [], apply: [], allowApply: [], probe: [], api: [], clip: [], check: [] };
  const changes = [];
  const state = {};
  const globals = {
    document: { getElementById: getElement }, AbortController, setTimeout, clearTimeout, console, TextDecoder, File, btoa,
    navigator: { clipboard: { writeText: async (t) => { calls.clip.push(t); } } },
    KRX_STAFF_CHAT_CORE: CORE, KRX_ALLOW_CHAT_CORE: ALLOW_CORE, KRX_HELP_SETUP: { prompt: (o) => `SETUP ${o.url} ${o.from}` },
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
  if (options.api) globals.KRX_CLAUDE_API = { mask: (k) => `…${String(k).slice(-4)}`, keyTag: (k) => String(k).slice(-4), check: async (o) => { calls.check.push(clone(o)); return clone(options.apiCheck || { ok: true, model: o.model, name: 'Opus', error: '' }); }, staff: async (input, o) => { calls.api.push({ input: clone(input), model: o.model, blocks: o.blocks, core: o.core }); if (options.apiError) throw new Error(options.apiError); return clone(options.apiResult || { reply: 'API 답', ops: [], dropped: 0, model: 'claude-opus-5-5' }); } };   // check: 키 확인(2026-10-21 — API 길은 확인된 키만 연결)
  const context = vm.createContext(globals);
  context.self = context;
  vm.runInContext(source, context, { filename: 'popup/staff-chat.js' });
  const chat = context.KRX_STAFF_CHAT;
  await chat.init({ state, draw: options.draw || (() => {}), api: { agent: {
    snapshot: () => ({ prjNo: 'test-project', year: 1, names: ['문창재'] }),
    apply: async (ops) => { calls.apply.push(clone(ops)); return options.results || [{ ok: true, text: '참여율 변경', msg: '25%로 변경' }]; }
  } }, allow: { agent: {   // 연구수당 계산 탭의 반영 손(lib/allowance.js agent) — allow 모드가 씀
    snapshot: () => ({ prjNo: 'test-project', year: 1, n: 2, names: ['문창재', '김거화'], people: ['문창재 (연) — …'], hasPlan: true }),
    apply: async (ops) => { calls.allowApply.push(clone(ops)); return [{ ok: true, text: '문창재 — 기타 평가 우수(100)', msg: '문창재 — 합산기여도 …' }]; }
  } } });
  chat.show(options.mode || true);
  await tick();
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

/* 2026-10-21 사용자 "이거 다시 쓰려는데 바뀌는 곳이 없네... 에이전트에서" — 키를 저장하면 연결 카드가 숨어 바꿀 곳이 없던 것 */
test('[연결] 단추: 연결된 뒤에도 연결 카드를 열어 Claude API 키를 바꾸거나 지울 수 있다(열면 키 칸에 초점, 저장해도 열린 채, 다시 누르면 닫힘)', async () => {
  const h = await harness({ status: { ok: false, url: online.url }, api: true, data: { claudeApiKey: 'sk-ant-test-1234' } });
  assert.equal(h.chat.route(), 'api');
  assert.equal(h.get('scConnection').hidden, true);
  h.get('scConn').emit('click');
  assert.equal(h.get('scConnection').hidden, false);
  assert.ok(h.get('scConnTitle').textContent.includes('Claude API 키로 연결돼 있어요'));
  assert.ok(h.get('scConnText').textContent.includes('새 키를 넣고 [저장]') && h.get('scConnText').textContent.includes('sk-ant-api03-'));
  assert.ok(h.get('scApiKey').focusCount > 0);
  h.get('scApiKey').value = 'sk-ant-api03-new-5678';
  h.get('scApiSave').emit('click');
  await tick();
  assert.equal(h.data.claudeApiKey, 'sk-ant-api03-new-5678');
  assert.equal(h.get('scConnection').hidden, false, '저장해도 카드는 열린 채(저장 안내를 보임)');
  assert.ok(h.get('scApiNote').textContent.includes('저장했어요'));
  h.get('scConn').emit('click');
  assert.equal(h.get('scConnection').hidden, true);
  const cli = await harness({ api: true, data: { claudeApiKey: 'sk-ant-test-1234' } });
  cli.get('scConn').emit('click');
  assert.ok(cli.get('scConnTitle').textContent.includes('Claude CLI(Help 서버)에 연결돼 있어요'));
});

test('send(글) 은 입력란 대신 그 글을 보내고 초안은 그대로 두며, 연결 길이 바뀌면 탭을 다시 그린다(H.draw — 연구수당 계산 카드의 연구내용 항목이 연결 여부를 봄)', async () => {
  let draws = 0;
  const h = await harness({ mode: 'allow', status: { ok: true, url: online.url, staff: 'test-model', allow: 'test-model' }, draw: () => { draws++; }, data: { allowChat: { turns: [], open: true }, allowChatDraft: '쓰던 초안' } });
  const d0 = draws;
  assert.ok(d0 >= 1, '연결된 채 시작하면 한 번 다시 그림');
  assert.equal(h.get('scText').value, '쓰던 초안');
  await h.chat.send('연구내용 분류해줘');
  assert.equal(h.calls.fetch.length, 1);
  assert.equal(h.calls.fetch[0].body.text, '연구내용 분류해줘');
  assert.equal(h.get('scText').value, '쓰던 초안');
  assert.equal(h.data.allowChatDraft, '쓰던 초안');
  assert.equal(h.data.allowChat.turns[0].text, '연구내용 분류해줘');
  const d1 = draws;
  h.data.llmStatus = { ok: false, url: online.url, error: '꺼짐' };
  await h.chat.probe(true);
  assert.equal(h.chat.route(), '');
  assert.ok(draws > d1, '연결이 끊기면 다시 그림');
  const d2 = draws;
  await h.chat.probe(true);
  assert.equal(draws, d2, '그대로면 다시 그리지 않음');
});
test('allow 모드(연구수당 계산 탭): 같은 틀에서 제목·[지침]·예시만 바뀌고, 대화·초안·규칙은 allowChat·allowChatDraft·allowRules, 요청은 POST /allow + 연구수당 지침, 반영은 allow agent — 서버에 /allow 가 없으면 업데이트 필요', async () => {
  const h = await harness({ mode: 'allow', status: { ok: true, url: online.url, staff: 'test-model', allow: 'test-model' }, data: { staffChat: { turns: [{ role: 'user', text: '참여 쪽 대화', at: 1 }], open: true }, staffRules: '- 예산 규칙', allowChat: { turns: [], open: true }, allowChatDraft: '연구수당 초안' } });
  assert.equal(h.chat.mode(), 'allow');
  assert.equal(h.get('scTitle').textContent, '연구수당 도우미');
  assert.equal(h.get('scRules').textContent, '지침');
  assert.equal(h.get('scRulesTitle').textContent, '연구수당 지침');
  assert.equal(h.get('scRulesText').maxLength, ALLOW_CORE.LIMIT.rules);
  assert.equal(h.get('scText').value, '연구수당 초안');
  assert.ok(h.get('scLog').innerHTML.includes('연구수당 계산을 도와 드릴까요?') && h.get('scLog').innerHTML.includes('P3 직급의 연구수당 지급상한은 얼마야?'), '빈 대화의 연구수당 예시');
  assert.ok(h.get('scHelpText').textContent.includes('연구수당 계산의 요약') && h.get('scHelpText').textContent.includes('[지침]'));
  h.get('scText').value = '김거화 기타 평가를 우수로 해줘';
  h.get('scText').emit('input');
  assert.equal(h.data.allowChatDraft, '김거화 기타 평가를 우수로 해줘');
  await h.chat.send();
  assert.equal(h.calls.fetch[0].url, online.url + '/allow');
  assert.equal(h.calls.fetch[0].body.rules, ALLOW_CORE.DEFAULT_RULES, '저장한 지침이 없으면 10-53 기본 글');
  assert.equal(h.calls.fetch[0].body.snapshot.n, 2);
  assert.deepEqual(h.calls.apply, [], '참여연구원 쪽 반영 손은 안 씀');
  assert.equal(h.data.allowChat.turns.length, 2);
  assert.equal(h.data.staffChat.turns.length, 1, '참여연구원 대화는 그대로');
  assert.equal(h.data.allowChatDraft, undefined);
  // 반영: 서버가 작업을 주면 allow agent 로
  const h2 = await harness({ mode: 'allow', status: { ok: true, url: online.url, staff: 'test-model', allow: 'test-model' }, fetch: () => ({ json: async () => ({ ok: true, reply: '우수로 둡니다.', ops: [{ op: 'person', name: '김거화', field: 'etc', value: '100' }] }) }) });
  h2.get('scText').value = '김거화 기타 우수';
  await h2.chat.send();
  assert.deepEqual(h2.calls.allowApply, [[{ op: 'person', name: '김거화', field: 'etc', value: '100' }]]);
  assert.ok(h2.data.allowChat.turns[1].results[0].text === '문창재 — 기타 평가 우수(100)');
  // [지침] 편집란 — 기본값은 10-53 글, 저장은 allowRules
  h2.get('scRules').emit('click');
  assert.equal(h2.get('scRulesText').value, ALLOW_CORE.DEFAULT_RULES);
  h2.get('scRulesText').value = '# 내 지침';
  h2.get('scRulesSave').emit('click');
  assert.equal(h2.data.allowRules, '# 내 지침');
  assert.equal(h2.data.staffRules, undefined);
  // Claude API 길도 allow 모듈로
  const h3 = await harness({ mode: 'allow', status: { ok: false, url: online.url }, api: true, data: { claudeApiKey: 'sk-ant-test-1234' } });
  assert.equal(h3.chat.route(), 'api');
  h3.get('scText').value = '지침 질문';
  await h3.chat.send();
  assert.equal(h3.calls.api[0].input.snapshot.n, 2);
  assert.equal(h3.calls.api[0].core, ALLOW_CORE);
  // /allow 가 없는 옛 서버 — 업데이트 필요
  const old = await harness({ mode: 'allow' });
  assert.equal(old.chat.route(), '');
  assert.equal(old.get('scStatus').textContent, '업데이트 필요');
  assert.ok(old.get('scConnTitle').textContent.includes('업데이트'));
  // 같은 탭에서 모드가 바뀌면 그 모드의 대화를 읽는다
  old.chat.show('staff');
  await tick();
  assert.equal(old.chat.mode(), 'staff');
  assert.equal(old.get('scTitle').textContent, '변경 도우미');
  assert.equal(old.chat.route(), 'server');
});

/* 2026-10-21 사용자 "에이전트는 claude 연결이 안되어 있으면 입력이 안되게 해줘" · "왜 에이전트가 이 모양으로 나오냐"(키는 있는데 400 워크스페이스 ID 오류로 보내기마다 실패) — 키가 있어도 확인(check)이 실패하면 연결로 보지 않는다 */
test('Claude API 키가 확인(check)에 실패하면 연결 아님 — 입력란·보내기 막힘, 상태 "Claude API 키 오류", 연결 카드에 까닭; 저장된 확인 결과(llmApi)가 ok 면 다시 묻지 않고 연결; 보내기가 API 오류로 실패하면 다시 확인해 끊는다', async () => {
  const err = '이 키는 워크스페이스 ID 가 있어야 합니다 (400) — 설정 › LLM 설정 › Claude API 의 워크스페이스 ID(Claude Console › Settings › Workspaces 의 wrkspc_…)를 넣고 저장하세요';
  const bad = await harness({ status: { ok: false, url: online.url }, api: true, data: { claudeApiKey: 'sk-ant-api03-bad-0001' }, apiCheck: { ok: false, error: err } });
  assert.equal(bad.chat.route(), '');
  assert.equal(bad.get('scText').disabled, true);
  assert.equal(bad.get('scSend').disabled, true);
  assert.equal(bad.get('scStatus').textContent, 'Claude API 키 오류');
  assert.equal(bad.get('scConnection').hidden, false);
  assert.ok(bad.get('scConnTitle').textContent.includes('API 키 오류') && bad.get('scConnText').textContent.includes('워크스페이스 ID') && bad.get('scApiNote').textContent.includes('워크스페이스 ID'));
  assert.equal(bad.calls.check[0].key, 'sk-ant-api03-bad-0001');
  bad.example(); await bad.chat.send();
  assert.equal(bad.calls.api.length, 0);
  const cached = await harness({ status: { ok: false, url: online.url }, api: true, data: { claudeApiKey: 'sk-ant-test-1234', llmApi: { ok: true, keyTag: '1234', at: Date.now(), model: 'claude-opus-5-5' } } });
  assert.equal(cached.chat.route(), 'api');
  assert.equal(cached.calls.check.length, 0, 'TTL 안의 같은 키는 다시 확인하지 않음');
  const opts = { status: { ok: false, url: online.url }, api: true, data: { claudeApiKey: 'sk-ant-test-1234' }, apiError: 'Claude API: ' + err };
  const h = await harness(opts);
  assert.equal(h.chat.route(), 'api');
  opts.apiCheck = { ok: false, error: err };
  h.example(); await h.chat.send(); await tick(); await tick();
  assert.equal(h.calls.api.length, 1);
  assert.ok(h.data.staffChat.turns[1].error && h.data.staffChat.turns[1].text.includes('워크스페이스'));
  assert.equal(h.chat.route(), '', '거절된 키는 다시 확인해 끊는다');
  assert.equal(h.get('scText').disabled, true);
  // sk-ant-usr-… 키(워크스페이스에 안 묶인 키)는 워크스페이스 ID 가 없으면 묻지 않고 연결 아님(GET /v1/models 는 통과해도 /v1/messages 가 400 — 2026-10-21 실측), ID 를 넣으면 확인 뒤 연결
  const usr = await harness({ status: { ok: false, url: online.url }, api: true, data: { claudeApiKey: 'sk-ant-usr-abcd-0001', llmApi: { ok: true, keyTag: '0001', at: Date.now() } } });
  assert.equal(usr.chat.route(), '');
  assert.equal(usr.calls.check.length, 0);
  assert.ok(usr.get('scConnText').textContent.includes('워크스페이스 ID') && usr.get('scStatus').textContent === 'Claude API 키 오류');
  const usrWs = await harness({ status: { ok: false, url: online.url }, api: true, data: { claudeApiKey: 'sk-ant-usr-abcd-0001', claudeApiWorkspace: 'wrkspc_01' } });
  assert.equal(usrWs.chat.route(), 'api');
  assert.equal(usrWs.calls.check.length, 1);
});

(async () => {
  let passed = 0;
  for (const [name, run] of queue) {
    try { await run(); passed++; console.log('ok  ', name); }
    catch (error) { process.exitCode = 1; console.error('FAIL', name, '\n', error.stack); }
  }
  console.log(`${passed} passed, ${queue.length - passed} failed`);
})();
