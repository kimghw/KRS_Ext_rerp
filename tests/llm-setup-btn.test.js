/* lib/render.js 의 제목 줄 B(브릿지) 아이콘(llmSetupBtn)과 복사할 글(llmPromptText) · 복사 동작(copyLlmPrompt) 테스트.
 * 서버(Help 서버)가 연결돼 있지 않을 때만 B 가 보이고, 누르면(data-act="llm-prompt") 연결 지침 — lib/help-setup.js(KRX_HELP_SETUP.prompt)와 같은 글 — 을 클립보드에 복사하며
 * help-setup.js 가 없으면 짧은 글로 대신한다(2026-10-23 사용자 "B 브릿지가 연결되지 않으면 B를 클릭하면 연결 지침을 복사하게 해줘" — 그 전의 [설정 프롬프트 복사] 글자 단추는 B 로 합침).
 * eClass 패널에서도 쓰도록 manifest 의 eClass content script 에 lib/help-setup.js 가 render.js 앞에 들어 있는지도 본다. 실행: node tests/llm-setup-btn.test.js */
globalThis.self = globalThis;
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const root = path.join(__dirname, '..');
for (const f of ['lib/format.js', 'lib/help-setup.js', 'lib/render.js']) require(path.join(root, f));
const R = KRX_RENDER;
let n = 0, failed = 0;
const queue = [];
const test = (name, fn) => queue.push([name, fn]);

test('서버 상태를 아직 모르거나(llm 없음) 연결돼 있으면 B 가 없다', () => {
  assert.strictEqual(R.llmSetupBtn({ llm: null }, {}), '');
  assert.strictEqual(R.llmSetupBtn({}, {}), '');
  assert.strictEqual(R.llmSetupBtn({ llm: { ok: true, url: 'http://127.0.0.1:8106' } }, {}), '');
});

test('서버가 연결돼 있지 않으면 B 하나만 — 누르면 연결 지침 복사(data-act="llm-prompt"), 따로 글자 단추나 설정 열기는 없다', () => {
  const h = R.llmSetupBtn({ llm: { ok: false, url: 'http://127.0.0.1:8106', error: '연결 실패' } }, {});
  assert.ok(h.includes('data-act="llm-prompt"'), 'B 가 복사 동작이 아님');
  assert.ok(!h.includes('data-act="llm-setup"'), '설정 열기 동작이 남아 있음');
  assert.ok(!h.includes('krext-btn-txt'), '글자 단추가 남아 있음');
  assert.strictEqual((h.match(/<button/g) || []).length, 1, '단추는 B 하나');
  assert.ok(/class="krext-btn krext-btn-ai"/.test(h), 'B class');
  assert.ok(h.endsWith('>B</button>'), '글자 B');
  assert.ok(h.includes('연결 지침') && h.includes('복사'), '풍선 말에 복사 안내');
  assert.ok(h.includes('setup.cmd'), '풍선 말에 setup.cmd 길');
  assert.ok(!h.includes('krext-btn-ai krext-on'), '서버도 API 도 없으면 흐림');
});

test('Claude API 키로 되는 중이면 B 가 켜진 색(연결 방식 off 면 흐림)', () => {
  const h = R.llmSetupBtn({ llm: { ok: false }, llmApi: { ok: true } }, { apiUse: 'auto' });
  assert.ok(h.includes('krext-btn-ai krext-on'), 'B 가 켜진 색이 아님');
  assert.ok(h.includes('Claude API 키로는 되는 중'), '풍선 말');
  const off = R.llmSetupBtn({ llm: { ok: false }, llmApi: { ok: true } }, { apiUse: 'off' });
  assert.ok(!off.includes('krext-btn-ai krext-on'), '연결 방식 off 면 API 키가 있어도 B 는 흐림');
});

test('복사할 글은 lib/help-setup.js 의 설정 프롬프트 — 백그라운드가 두드린 주소 · 연결 상태 · 보낸 곳이 들어간다', () => {
  const state = { llm: { ok: false, url: 'http://127.0.0.1:8111', error: 'Failed to fetch' } };
  const t = R.llmPromptText(state, 'eClass 패널 제목 줄');
  assert.strictEqual(t, KRX_HELP_SETUP.prompt({ url: 'http://127.0.0.1:8111', from: 'eClass 패널 제목 줄', reason: 'Failed to fetch' }));
  assert.ok(t.startsWith('[KR eClass + R&D ERP 현황 확장 — Help 서버(LLM) 연결 설정]'));
  assert.ok(t.includes('http://127.0.0.1:8111'), '설정된 서버 주소');
  assert.ok(t.includes('포트 8111 확인'), '주소의 포트로 포트 확인');
  assert.ok(t.includes('확장이 본 상태: Failed to fetch'), '그때 본 연결 상태');
  assert.ok(t.includes('보낸 곳: eClass 패널 제목 줄'), '보낸 곳');
  assert.ok(t.includes('하지 말 것: 확장 코드·설정 파일 수정, 커밋·푸시'), '코드 수정·커밋 금지');
});

test('주소·상태가 없으면 기본 주소(8106)·기본 보낸 곳으로, help-setup.js 가 없으면 짧은 글로 대신한다', () => {
  const t = R.llmPromptText({ llm: { ok: false } });
  assert.ok(t.includes('http://127.0.0.1:8106'), '기본 주소');
  assert.ok(t.includes('보낸 곳: 패널 제목 줄'), '기본 보낸 곳');
  assert.ok(!t.includes('확장이 본 상태'), '상태가 없으면 그 괄호도 없음');
  const keep = globalThis.KRX_HELP_SETUP;
  try {
    delete globalThis.KRX_HELP_SETUP;
    const s = R.llmPromptText({ llm: { ok: false, url: 'http://localhost:8106/' } }, '팝업');
    assert.ok(s.startsWith('[KR eClass + R&D ERP 현황 확장 — Help 서버(LLM) 연결 설정]'), '짧은 글도 같은 머리');
    assert.ok(s.includes('http://localhost:8106/health'), '주소 끝 / 를 떼고 /health');
    assert.ok(s.includes('node help-server/server.js'), '서버 실행 명령');
  } finally { globalThis.KRX_HELP_SETUP = keep; }
});

test('B 를 누르면(copyLlmPrompt) 글이 클립보드에 가고 아이콘이 잠깐 ✓ 로 바뀐다 — 글자 단추면 "복사했습니다 ✓"', async () => {
  let copied = '';
  const setNav = (v) => Object.defineProperty(globalThis, 'navigator', { value: v, configurable: true, writable: true });   // Node 21+ 의 navigator 는 getter 라 대입이 안 먹음
  setNav({ clipboard: { writeText: async (t) => { copied = t; } } });
  const fakeBtn = (cls) => { const set = new Set(cls); return { classList: { contains: (c) => set.has(c), toggle: (c, on) => { if (on) set.add(c); else set.delete(c); }, remove: (c) => set.delete(c) }, innerHTML: 'B', title: 't', textContent: 'B', isConnected: false, set }; };
  const state = { llm: { ok: false, url: 'http://127.0.0.1:8106', error: 'x' } };
  const b = fakeBtn(['krext-btn', 'krext-btn-ai']);
  assert.strictEqual(await R.copyLlmPrompt(b, state, '팝업'), true);
  assert.strictEqual(copied, R.llmPromptText(state, '팝업'));
  assert.strictEqual(b.textContent, '✓'); assert.ok(b.set.has('krext-on')); assert.ok(b.title.includes('붙여 넣으세요'));
  const t = fakeBtn(['krext-btn', 'krext-btn-txt']);
  await R.copyLlmPrompt(t, state, '팝업');
  assert.strictEqual(t.textContent, '복사했습니다 ✓');
  setNav({ clipboard: { writeText: async () => { throw new Error('no'); } } });
  globalThis.document = { createElement: () => { throw new Error('no dom'); } };
  const f = fakeBtn(['krext-btn', 'krext-btn-ai']);
  assert.strictEqual(await R.copyLlmPrompt(f, state, '팝업'), false);
  assert.strictEqual(f.textContent, '✗'); assert.ok(!f.set.has('krext-on'));
});

test('manifest: eClass 패널 content script 에 lib/help-setup.js 가 lib/render.js 앞에 있다', () => {
  const m = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const cs = m.content_scripts.find((c) => c.js.includes('content/eclass.js'));
  assert.ok(cs, 'eClass content script 블록');
  const a = cs.js.indexOf('lib/help-setup.js'), b = cs.js.indexOf('lib/render.js');
  assert.ok(a >= 0, 'lib/help-setup.js 가 없음');
  assert.ok(a < b, 'lib/render.js 보다 앞이어야 함');
  assert.ok(fs.existsSync(path.join(root, 'lib/help-setup.js')));
});

test('클릭 배선: eclass.js 와 popup.js 가 data-act="llm-prompt" 를 KRX_RENDER.copyLlmPrompt 로 잇고, 옛 llm-setup(설정 열기) 배선은 없다', () => {
  for (const f of ['content/eclass.js', 'popup/popup.js']) {
    const s = fs.readFileSync(path.join(root, f), 'utf8');
    assert.ok(/act === 'llm-prompt'[\s\S]{0,200}KRX_RENDER\.copyLlmPrompt\(btn, state/.test(s), `${f}: llm-prompt 배선이 없음`);
    assert.ok(!s.includes("act === 'llm-setup'"), `${f}: llm-setup 배선이 남아 있음`);
  }
  assert.strictEqual(typeof R.copyLlmPrompt, 'function');
});

(async () => {
  for (const [name, fn] of queue) {
    try { await fn(); n++; console.log('ok  ', name); }
    catch (e) { failed++; console.log('FAIL', name, '\n   ', e.stack || e.message); process.exitCode = 1; }
  }
  console.log(`\n${n} passed, ${failed} failed`);
})();
