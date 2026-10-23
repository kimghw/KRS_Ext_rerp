/* GitHub 새 커밋 확인·받기 테스트 — 서버 쪽(help-server/gitsync.js)과 확장 쪽(lib/gitsync.js).
 * 앞부분은 임시 폴더에 진짜 저장소를 만든다 — GitHub 대신 맨 저장소(origin) 하나와 그것을 받은 둘(here = 확장 폴더, there = 다른 PC).
 * there 에서 올린 커밋을 here 가 알아보는지, 빨리 감기로만 받는지(겹침·갈라짐은 거절), 받은 뒤 확장 다시 불러오기·서버 다시 띄우기가 필요한지를 본다.
 * 뒷부분은 확장 쪽 — 상태에 따른 단추 모양(view·button·act), 백그라운드의 확인(check: 10분 캐시·저장소)·받기(pull: busy → reload 표시 / 실패 → pullError). chrome·fetch 는 가짜.
 * 실행: node tests/gitsync.test.js */
globalThis.self = globalThis;
const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert');
const { spawnSync } = require('child_process');
const root = path.join(__dirname, '..');
const G = require(path.join(root, 'help-server/gitsync.js'));

let n = 0, failed = 0;
const queue = [];
const test = (name, fn) => queue.push([name, fn]);

/* ---------- 임시 저장소 ---------- */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'krx-gitsync-'));
const sh = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: Object.assign({}, process.env, { GIT_TERMINAL_PROMPT: '0' }) });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const write = (dir, file, text) => { fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.writeFileSync(path.join(dir, file), text); };
const commit = (dir, file, text, subject) => { write(dir, file, text); sh(dir, 'add', file); sh(dir, 'commit', '-q', '-m', subject); };
const who = (dir) => { sh(dir, 'config', 'user.name', '시험'); sh(dir, 'config', 'user.email', 'test@example.org'); sh(dir, 'config', 'core.autocrlf', 'false'); };
const origin = path.join(tmp, 'origin.git'), here = path.join(tmp, 'here'), there = path.join(tmp, 'there');
sh(tmp, 'init', '-q', '--bare', '-b', 'main', origin);
sh(tmp, 'clone', '-q', '-c', 'core.autocrlf=false', origin, there);
who(there);
sh(there, 'symbolic-ref', 'HEAD', 'refs/heads/main');
commit(there, 'lib/render.js', 'v1\n', '처음');
commit(there, 'README.md', '# 설명\n', '설명 추가');
sh(there, 'push', '-q', '-u', 'origin', 'main');
sh(tmp, 'clone', '-q', '-c', 'core.autocrlf=false', origin, here);
who(here);
const git = (args, o) => G.runGit(args, Object.assign({}, o, { cwd: here }));   // 테스트는 here 를 확장 폴더로 본다

test('서버: 받은 그대로면 같다(뒤진 것도 앞선 것도 없다)', async () => {
  const s = await G.gitStatus({ git });
  assert.deepStrictEqual([s.ok, s.branch, s.upstream, s.ahead, s.behind, s.commits, s.dirty, s.overlap, 'fetchError' in s], [true, 'main', 'origin/main', 0, 0, [], 0, [], false]);
});
test('서버: 다른 곳에서 올린 커밋을 받아 와서 센다 — 한글 제목도 그대로, 겹치는 파일 없음', async () => {
  commit(there, 'lib/render.js', 'v2\n', '패널 고침');
  commit(there, 'README.md', '# 설명 둘\n', '설명 고침');
  sh(there, 'push', '-q');
  const s = await G.gitStatus({ git });
  assert.strictEqual(s.behind, 2); assert.strictEqual(s.ahead, 0);
  assert.deepStrictEqual(s.commits.map((c) => c.subject), ['설명 고침', '패널 고침']);
  assert.ok(/^[0-9a-f]{7,}$/.test(s.commits[0].hash)); assert.strictEqual(s.commits[0].author, '시험');
  assert.deepStrictEqual(s.overlap, []); assert.strictEqual(s.dirty, 0);
});
test('서버: 고치고 있는 파일이 받을 커밋과 겹치면 overlap 에 들고, pull 은 거절한다(고치던 것은 그대로)', async () => {
  write(here, 'lib/render.js', '내가 고치는 중\n');
  const s = await G.gitStatus({ git, fetch: false });
  assert.deepStrictEqual(s.overlap, ['lib/render.js']); assert.strictEqual(s.dirty, 1);
  const p = await G.gitPull({ git });
  assert.strictEqual(p.ok, false); assert.ok(/고치고 있는 파일과 겹쳐/.test(p.error), p.error);
  assert.strictEqual(fs.readFileSync(path.join(here, 'lib/render.js'), 'utf8'), '내가 고치는 중\n');
  sh(here, 'checkout', '--', 'lib/render.js');
});
test('서버: 빨리 감기로 받는다 — 받은 커밋 수·바뀐 파일, 확장 파일이 있어 reload, 서버 파일은 없어 server 아님', async () => {
  const p = await G.gitPull({ git, loaded: ['lib/classify-core.js'] });
  assert.strictEqual(p.ok, true); assert.strictEqual(p.pulled, 2);
  assert.deepStrictEqual(p.files.sort(), ['README.md', 'lib/render.js']); assert.strictEqual(p.fileCount, 2);
  assert.strictEqual(p.reload, true); assert.strictEqual(p.server, false); assert.strictEqual(p.deps, false);
  assert.ok(/^[0-9a-f]{7}$/.test(p.from) && /^[0-9a-f]{7}$/.test(p.to) && p.from !== p.to);
  const s = await G.gitStatus({ git, fetch: false });
  assert.strictEqual(s.behind, 0);
});
test('서버: 다시 받으면 받을 것이 없다(pulled 0, reload 아님)', async () => {
  const p = await G.gitPull({ git });
  assert.deepStrictEqual([p.ok, p.pulled, p.fileCount, p.reload, p.server], [true, 0, 0, false, false]);
});
test('서버: 문서만 바뀐 커밋은 reload 가 아니고, help-server 코드·require 한 lib 가 바뀌면 server', async () => {
  commit(there, 'README.md', '# 설명 셋\n', '설명만');
  sh(there, 'push', '-q');
  let p = await G.gitPull({ git });
  assert.deepStrictEqual([p.pulled, p.reload, p.server], [1, false, false]);
  commit(there, 'help-server/server.js', 'srv\n', '서버 고침');
  commit(there, 'help-server/rules.md', '규칙\n', '규칙 고침');
  sh(there, 'push', '-q');
  p = await G.gitPull({ git });
  assert.deepStrictEqual([p.pulled, p.reload, p.server], [2, false, true]);
  commit(there, 'lib/classify-core.js', 'core\n', '분류 공용 고침');
  sh(there, 'push', '-q');
  p = await G.gitPull({ git, loaded: new Set(['lib/classify-core.js']) });
  assert.deepStrictEqual([p.pulled, p.reload, p.server], [1, true, true]);   // 확장도 읽고(reload) 서버도 require(server)
});
test('서버: 여기에만 있는 커밋이 있으면 갈라짐(ahead) — pull 은 거절', async () => {
  commit(here, 'lib/plan.js', 'mine\n', '여기서만');
  commit(there, 'lib/pay.js', 'theirs\n', '저기서만');
  sh(there, 'push', '-q');
  const s = await G.gitStatus({ git });
  assert.strictEqual(s.ahead, 1); assert.strictEqual(s.behind, 1);
  const p = await G.gitPull({ git });
  assert.strictEqual(p.ok, false); assert.ok(/빨리 감기로 받을 수 없습니다/.test(p.error), p.error);
  sh(here, 'reset', '-q', '--hard', 'origin/main');
});
test('서버: classify 규칙 — 확장 파일·서버 파일·package.json', () => {
  assert.deepStrictEqual(G.classify(['lib/render.js'], []), { reload: true, server: false, deps: false });
  assert.deepStrictEqual(G.classify(['README.md', 'tests/x.test.js', '.claude/skills/a/SKILL.md', 'site-fetch/sites/인프런.md'], []), { reload: false, server: false, deps: false });
  assert.deepStrictEqual(G.classify(['site-fetch/index.js'], []), { reload: false, server: true, deps: false });
  assert.deepStrictEqual(G.classify(['package.json'], []), { reload: false, server: false, deps: true });
  assert.deepStrictEqual(G.classify(['manifest.json', 'popup/popup.html'], []), { reload: true, server: false, deps: false });
  assert.strictEqual(G.isExtensionFile('help-server/gitsync.js'), false);
  assert.strictEqual(G.isServerFile('lib/allow-chat-core.js', ['lib/allow-chat-core.js']), true);
  assert.strictEqual(G.isServerFile('lib/render.js', ['lib/allow-chat-core.js']), false);
});
test('서버: git 의 말 → 할 일', () => {
  assert.ok(/인증이 필요/.test(G.gitError('fatal: Authentication failed for ...')));
  assert.ok(/닿지 못했습니다/.test(G.gitError('fatal: unable to access ...: Could not resolve host')));
  assert.ok(/다른 git 작업/.test(G.gitError('fatal: Unable to create index.lock: File exists')));
  assert.ok(/겹쳐 받지 않았습니다\(lib\/a\.js, lib\/b\.js\)/.test(G.gitError('error: Your local changes to the following files would be overwritten by merge:\n\tlib/a.js\n\tlib/b.js\nPlease commit')));
});

/* ---------- 확장 쪽 (lib/gitsync.js) — 가짜 chrome·fetch ---------- */
let store = {}, sets = 0, listeners = [];
globalThis.chrome = { storage: {
  local: {
    get: async (k) => { const out = {}; for (const x of [].concat(k)) if (x in store) out[x] = JSON.parse(JSON.stringify(store[x])); return out; },
    set: async (o) => { sets++; for (const [k, v] of Object.entries(o)) { const old = store[k]; store[k] = JSON.parse(JSON.stringify(v)); for (const fn of listeners) fn({ [k]: { oldValue: old, newValue: store[k] } }, 'local'); } },
    remove: async (k) => { for (const x of [].concat(k)) delete store[x]; },
  },
  onChanged: { addListener: (fn) => listeners.push(fn) },
} };
let replies = [], calls = [];
globalThis.fetch = async (url, init) => {
  calls.push({ url, method: (init && init.method) || 'GET' });
  const r = replies.length ? replies.shift() : { ok: false, error: '응답 없음' };
  if (r === 'down') throw new TypeError('Failed to fetch');
  return { status: 200, json: async () => r };
};
require(path.join(root, 'lib/gitsync.js'));
const K = KRX_GIT;
const reset = () => { store = {}; sets = 0; replies = []; calls = []; listeners = []; };
const URL0 = 'http://127.0.0.1:8106';

test('확장: 상태가 없거나 서버가 없거나 GitHub 과 같으면 단추가 없다 — 새 커밋이 있을 때만 보인다', () => {
  assert.strictEqual(K.button({}), ''); assert.strictEqual(K.button({ git: null }), '');
  assert.strictEqual(K.button({ git: { ok: false, error: '연결 안 됨' } }), '');
  assert.strictEqual(K.button({ git: { ok: true, behind: 0, ahead: 0 } }), '');
  assert.strictEqual(K.view({ ok: true, behind: 0, ahead: 2, upstream: 'origin/main' }).mode, 'same');
  const h = K.button({ git: { ok: true, behind: 3, ahead: 0, upstream: 'origin/main', commits: [{ hash: 'abc1234', subject: '패널 고침' }], dirty: 1, overlap: [] } });
  assert.ok(h.includes('data-act="git"') && h.includes('krext-git-new') && h.includes('<span class="krext-git-count">3</span>'), h);
  assert.ok(h.includes('새 커밋 3개') && h.includes('abc1234 패널 고침') && h.includes('고치고 있는 파일 1개는 그대로'), h);
  assert.ok(!h.includes('disabled'));
});
test('확장: 겹침·갈라짐은 흐린 단추(누르면 다시 확인), 받는 중은 돌아가는 단추(눌러도 아무것도), 받은 뒤는 ↻(누르면 다시 불러오기)', () => {
  const blocked = { git: { ok: true, behind: 1, ahead: 0, upstream: 'origin/main', commits: [], overlap: ['lib/render.js'] } };
  assert.strictEqual(K.view(blocked.git).mode, 'blocked'); assert.ok(K.button(blocked).includes('krext-git-blocked'));
  assert.ok(K.view(blocked.git).title.includes('고치고 있는 파일과 겹쳐 지금은 받을 수 없습니다(lib/render.js)'));
  assert.deepStrictEqual(K.act(blocked), { type: 'gitCheck', force: true });
  const div = { git: { ok: true, behind: 1, ahead: 1, upstream: 'origin/main', commits: [] } };
  assert.strictEqual(K.view(div.git).mode, 'diverged'); assert.deepStrictEqual(K.act(div), { type: 'gitCheck', force: true });
  const busy = { git: { ok: true, behind: 1, busy: 'pull' } };
  assert.strictEqual(K.view(busy.git).mode, 'busy'); assert.ok(K.button(busy).includes('disabled') && K.button(busy).includes('krext-spin')); assert.strictEqual(K.act(busy), null);
  const rl = { git: { ok: true, reload: true, reloadText: 'GitHub 에서 커밋 2개를 받았습니다(a → b, 파일 3개)' } };
  assert.strictEqual(K.view(rl.git).mode, 'reload'); assert.ok(K.button(rl).includes('krext-git-reload') && K.button(rl).includes('받았습니다')); assert.deepStrictEqual(K.act(rl), { type: 'gitReload' });
  assert.deepStrictEqual(K.act({ git: { ok: true, behind: 2, ahead: 0, commits: [], overlap: [] } }), { type: 'gitPull' });
  assert.strictEqual(K.view({ ok: false, reload: true }).mode, 'reload', '서버가 끊겨도 받은 것의 ↻ 는 남는다');
});
test('확장: 받은 결과의 말', () => {
  assert.deepStrictEqual(K.said(null), { ok: false, reload: false, text: 'GitHub 에서 받지 못했습니다 — Help 서버가 답하지 않았습니다' });
  assert.deepStrictEqual(K.said({ ok: false, error: '인증 필요' }), { ok: false, reload: false, text: 'GitHub 에서 받지 못했습니다 — 인증 필요' });
  assert.deepStrictEqual(K.said({ ok: true, pulled: 0 }), { ok: true, reload: false, text: '이미 GitHub 과 같습니다.' });
  const s = K.said({ ok: true, pulled: 2, from: 'aaaaaaa', to: 'bbbbbbb', fileCount: 3, reload: true, server: true, restart: 'later', deps: true });
  assert.strictEqual(s.reload, true);
  assert.strictEqual(s.text, 'GitHub 에서 커밋 2개를 받았습니다(aaaaaaa → bbbbbbb, 파일 3개) — 단추를 한 번 더 누르면 확장을 다시 불러옵니다(패널이 닫힙니다). Help 서버는 하던 일(채팅·분류·찾아오기)을 마치면 스스로 다시 뜹니다. package.json 이 바뀌었습니다 — 저장소 폴더에서 npm install 을 돌리세요.');
  assert.strictEqual(K.said({ ok: true, pulled: 1, from: 'a', to: 'b', fileCount: 1, reload: false, server: true, restart: 'now' }).text, 'GitHub 에서 커밋 1개를 받았습니다(a → b, 파일 1개). Help 서버는 스스로 다시 뜹니다.');
});
test('확장(백그라운드): 확인은 GET /git 을 상태로 바꿔 저장하고, 10분 안의 재요청은 다시 묻지 않으며(force 면 ?fetch=1 로 다시), 같은 모양이면 저장소를 다시 쓰지 않는다', async () => {
  reset();
  replies = [{ ok: true, branch: 'main', upstream: 'origin/main', ahead: 0, behind: 2, commits: [{ hash: 'abc1234', author: 'x', date: 'd', subject: '하나' }, { hash: 'def5678', subject: '둘' }], dirty: 0, overlap: [], fetchedAt: 5 }];
  const st = await K.check('http://127.0.0.1:8106/', false);
  assert.strictEqual(calls[0].url, `${URL0}/git`);
  assert.deepStrictEqual([st.ok, st.behind, st.ahead, st.upstream, st.commits.length, st.commits[0], st.fetchedAt, st.busy], [true, 2, 0, 'origin/main', 2, { hash: 'abc1234', subject: '하나' }, 5, '']);
  assert.strictEqual(store.gitStatus.behind, 2); assert.strictEqual(sets, 1);
  const again = await K.check(URL0, false);
  assert.strictEqual(calls.length, 1, '10분 안이면 다시 묻지 않음'); assert.strictEqual(again, st);
  replies = [{ ok: true, branch: 'main', upstream: 'origin/main', ahead: 0, behind: 2, commits: [{ hash: 'abc1234', subject: '하나' }, { hash: 'def5678', subject: '둘' }], dirty: 0, overlap: [], fetchedAt: 9 }];
  await K.check(URL0, true);
  assert.strictEqual(calls[1].url, `${URL0}/git?fetch=1`); assert.strictEqual(sets, 1, '모양이 같으면(시각·fetchedAt 만 다름) 저장소는 그대로');
  replies = ['down'];
  const off = await K.check(URL0, true);
  assert.strictEqual(off.ok, false); assert.ok(/연결할 수 없습니다/.test(off.error)); assert.strictEqual(sets, 2); assert.strictEqual(K.button({ git: store.gitStatus }), '');
});
test('확장(백그라운드): 서버가 없거나 이전 버전이면 offline 이 상태를 비운다 — 받은 것의 ↻ 표시는 남긴다', async () => {
  const o = await K.offline(URL0, '이전 버전 Help 서버');
  assert.deepStrictEqual([o.ok, o.error], [false, '이전 버전 Help 서버']);
  assert.strictEqual(K.button({ git: store.gitStatus }), '');
});
test('확장(백그라운드): 받기 — 받는 동안 busy 를 저장하고, 확장 파일이 있으면 reload 표시, 없으면 다시 확인, 실패면 pullError', async () => {
  reset();
  // 먼저 새 커밋 2개인 상태를 만든다
  replies = [{ ok: true, branch: 'main', upstream: 'origin/main', ahead: 0, behind: 2, commits: [{ hash: 'a', subject: '하나' }], dirty: 0, overlap: [] }];
  await K.check(URL0, true);
  const seen = [];
  listeners.push((ch) => { if (ch.gitStatus) seen.push(K.view(ch.gitStatus.newValue).mode); });
  // 1) 받음 — 확장 파일 바뀜 → reload
  replies = [{ ok: true, from: 'aaaaaaa', to: 'bbbbbbb', pulled: 2, files: ['lib/render.js'], fileCount: 1, reload: true, server: false, deps: false }];
  let r = await K.pull(URL0);
  assert.strictEqual(calls[1].url, `${URL0}/git/pull`); assert.strictEqual(calls[1].method, 'POST');
  assert.deepStrictEqual([r.ok, r.reload, r.restart], [true, true, '']); assert.ok(r.text.startsWith('GitHub 에서 커밋 2개를 받았습니다(aaaaaaa → bbbbbbb, 파일 1개) — 단추를 한 번 더'));
  assert.deepStrictEqual(seen, ['busy', 'reload']);
  assert.strictEqual(store.gitStatus.reload, true); assert.strictEqual(store.gitStatus.pulled.fileCount, 1);
  // reload 표시가 있는 동안은 확인도 받기도 하지 않는다
  const before = calls.length;
  assert.strictEqual((await K.check(URL0, true)).reload, true); assert.strictEqual((await K.pull(URL0)).reload, true); assert.strictEqual(calls.length, before);
  // 확장이 다시 올라오면(background onInstalled → reset) ↻ 표시가 지워지고 다음 확인부터 새로
  await K.reset();
  assert.strictEqual('gitStatus' in store, false); assert.strictEqual(await K.load(), null);
  // 2) 서버·문서만 바뀜 → reload 아님, 서버가 다시 뜨므로(restart) 지금은 다시 묻지 않고 같음으로 둔다
  reset();
  replies = [{ ok: true, branch: 'main', upstream: 'origin/main', ahead: 0, behind: 1, commits: [{ hash: 'c', subject: '서버' }], dirty: 0, overlap: [] }];
  await K.check(URL0, true);
  replies = [{ ok: true, from: 'bbbbbbb', to: 'ccccccc', pulled: 1, files: ['help-server/server.js'], fileCount: 1, reload: false, server: true, restart: 'now' }];
  r = await K.pull(URL0);
  assert.deepStrictEqual([r.ok, r.reload, r.restart], [true, false, 'now']); assert.ok(r.text.includes('Help 서버는 스스로 다시 뜹니다'));
  assert.strictEqual(calls.length, 2, '서버가 다시 뜨는 중이라 다시 묻지 않음'); assert.strictEqual(K.view(store.gitStatus).mode, 'same'); assert.strictEqual(store.gitStatus.busy, '');
  // 3) 실패 — 다시 확인하고 그 까닭을 pullError 에
  replies = [{ ok: false, error: 'GitHub 인증이 필요합니다 — 터미널에서 한 번 git pull 해 로그인해 두세요.' }, { ok: true, branch: 'main', upstream: 'origin/main', ahead: 0, behind: 1, commits: [{ hash: 'c', subject: '서버' }], dirty: 0, overlap: [] }];
  r = await K.pull(URL0);
  assert.strictEqual(r.ok, false); assert.ok(r.text.includes('인증이 필요합니다'));
  assert.strictEqual(calls[3].url, `${URL0}/git?fetch=1`, '실패 뒤 다시 확인');
  const v = K.view(store.gitStatus);
  assert.strictEqual(v.mode, 'new'); assert.ok(v.title.startsWith('GitHub 에서 받지 못했습니다 — GitHub 인증이 필요합니다'), v.title);
  // 4) 서버가 답하지 않음
  replies = ['down', 'down'];
  r = await K.pull(URL0);
  assert.strictEqual(r.ok, false); assert.ok(/답하지 않았습니다|연결할 수 없습니다/.test(r.text), r.text);
  assert.strictEqual(K.button({ git: store.gitStatus }), '', '서버가 없으면 단추도 없다');
});
test('확장(패널): bind 는 저장소의 gitStatus 를 state.git 에 넣고 바뀌면 다시 그린다', async () => {
  reset();
  store.gitStatus = { ok: true, behind: 1, ahead: 0, commits: [], overlap: [] };
  const state = {}; let draws = 0;
  K.bind(state, () => draws++);
  await new Promise((r) => setTimeout(r, 0));
  assert.strictEqual(state.git.behind, 1); assert.strictEqual(draws, 1);
  await chrome.storage.local.set({ gitStatus: { ok: true, behind: 0 } });
  assert.strictEqual(state.git.behind, 0); assert.strictEqual(draws, 2);
  await chrome.storage.local.set({ other: 1 });
  assert.strictEqual(draws, 2);
});

(async () => {
  for (const [name, fn] of queue) {
    try { await fn(); n++; console.log('ok  ', name); }
    catch (e) { failed++; console.log('FAIL', name, '\n   ', e.stack || e.message); process.exitCode = 1; }
  }
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  console.log(`\n${failed ? `실패 ${failed}건 / ` : ''}통과 ${n}건`);
})();
