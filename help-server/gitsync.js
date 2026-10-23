/* GitHub 새 커밋 확인·받기 — 패널 제목 줄의 업데이트 단추(lib/gitsync.js)가 Help 서버(브릿지)를 거쳐 부른다: GET /git · POST /git/pull (server.js, 2026-10-23).
 * kr_ext_workspace 의 native/gitsync.mjs(네이티브 메시징 다리)와 같은 일을 이 저장소에서는 Help 서버가 한다 — 브라우저 확장은 git 을 띄울 수 없다.
 * 확장이 git 에 넘기는 값은 없다. 할 수 있는 일은 둘뿐이고 명령도 여기 고정돼 있다.
 *  - gitStatus: 받아 오기(fetch)를 한 뒤 올라간 곳(upstream)보다 몇 커밋 뒤졌는지·앞섰는지, 새 커밋의 줄, 고치고 있는 파일과 겹치는 것
 *  - gitPull: 빨리 감기로만 받는다(pull --ff-only --no-rebase). 갈라졌거나 고치고 있는 파일과 겹치면 git 이 거절하고 그 까닭을 돌려준다 — 고치던 것을 덮거나 병합 커밋을 만들지 않는다.
 *    받은 파일로 확장을 다시 불러와야 하는지(reload — 확장이 읽는 파일), 서버를 다시 띄워야 하는지(server — help-server/·site-fetch/ 의 코드와 서버가 require 한 lib/)를 가른다.
 * 서버에는 창이 없어 git 이 비밀번호를 물으면 답할 사람이 없다 — 묻지 않고 실패하게 한다(GIT_TERMINAL_PROMPT·GCM_INTERACTIVE). 테스트: node tests/gitsync.test.js (임시 저장소로). */
'use strict';
const { execFile } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GIT_BIN = process.env.GIT_BIN || 'git';
/** 풍선 말에 보이는 새 커밋 줄 · 바뀐 파일 수의 한도 */
const COMMITS_MAX = 10, FILES_MAX = 30;
/** 확장이 읽지 않는 것 — 여기만 바뀌면 확장을 다시 불러올 까닭이 없다 (tests/cdp/reload.mjs 의 규칙과 같다). */
const NOT_EXTENSION_DIRS = new Set(['.git', '.claude', 'tests', 'help-server', 'site-fetch', 'node_modules']);
const NOT_EXTENSION_FILE = /(^\.gitignore$|\.md$|\.mp4$|^package\.json$|^package-lock\.json$)/i;
/** 서버가 뜰 때 읽는 코드 — 바뀌면 서버를 다시 띄워야 반영된다. help-server/rules.md · site-fetch/sites/*.md 는 요청마다 읽으므로 아니다. lib/ 는 실제로 require 된 것(loaded)만. */
const SERVER_CODE = /^(help-server|site-fetch)\/.*\.(c?js|mjs|json)$/i;

// git 의 말은 영어로 받는다(LC_ALL=C) — 거절한 까닭을 그 말로 가린다. 커밋 제목·파일 이름의 한글은 그대로 온다(core.quotepath=false).
const gitEnv = () => Object.assign({}, process.env, { GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never', LC_ALL: 'C' });
const clip = (s, n = 300) => (s.length > n ? `${s.slice(0, n)}…` : s);
const lines = (r) => (r.code === 0 && r.out ? r.out.split('\n').map((l) => l.trim()).filter(Boolean) : []);

/**
 * git 을 한 번 부른다. 던지지 않는다 — 실행이 안 되거나 시간이 다 되면 code 가 -1 이다.
 * @returns {Promise<{code: number, out: string, err: string}>}
 */
function runGit(args, { cwd = ROOT, timeoutMs = 30000 } = {}) {
  return new Promise((resolve) => {
    execFile(GIT_BIN, ['-c', 'core.quotepath=false', ...args], { cwd, env: gitEnv(), timeout: timeoutMs, windowsHide: true, maxBuffer: 8 << 20 }, (err, stdout, stderr) => {
      const out = String(stdout || '').trim();
      const errText = String(stderr || '').trim();
      if (!err) return resolve({ code: 0, out, err: errText });
      if (err.killed) return resolve({ code: -1, out, err: `git ${args[0]} 이 ${timeoutMs / 1000}초 안에 끝나지 않았습니다.` });
      resolve({ code: typeof err.code === 'number' ? err.code : -1, out, err: errText || err.message });
    });
  });
}

/** git 이 거절한 말을 사람이 할 일로 바꾼다. 모르는 말이면 그대로(잘라서) 둔다. */
function gitError(err) {
  const s = String(err || '').trim();
  if (/would be overwritten/i.test(s)) {
    const files = s.split('\n').filter((l) => /^\s/.test(l)).map((l) => l.trim()).filter(Boolean);
    return `고치고 있는 파일과 겹쳐 받지 않았습니다${files.length ? `(${files.slice(0, 5).join(', ')}${files.length > 5 ? ` 외 ${files.length - 5}개` : ''})` : ''} — 커밋하거나 치운 뒤 다시 누르세요.`;
  }
  if (/not possible to fast-forward|diverg/i.test(s)) return '여기에만 있는 커밋이 있어 빨리 감기로 받을 수 없습니다 — 터미널에서 직접 pull 하세요.';
  if (/authentication failed|could not read username|terminal prompts disabled|permission denied/i.test(s)) return 'GitHub 인증이 필요합니다 — 터미널에서 한 번 git pull 해 로그인해 두세요.';
  if (/could not resolve host|unable to access|failed to connect|timed out|끝나지 않았습니다/i.test(s)) return 'GitHub 에 닿지 못했습니다(네트워크).';
  if (/index\.lock|another git process/i.test(s)) return '다른 git 작업이 돌고 있습니다 — 잠시 뒤 다시 누르세요.';
  return clip(s) || 'git 이 까닭 없이 실패했습니다.';
}

/** 확장이 읽는 파일인가(저장소 상대 경로, 슬래시). 바뀌었으면 확장을 다시 불러와야 반영된다. */
function isExtensionFile(f) {
  const p = String(f || '').replace(/\\/g, '/');
  if (!p) return false;
  const top = p.split('/')[0];
  if (p.includes('/') && NOT_EXTENSION_DIRS.has(top)) return false;
  return !NOT_EXTENSION_FILE.test(path.posix.basename(p));
}
/** 서버가 읽는 파일인가 — help-server/·site-fetch/ 의 코드, 또는 서버 프로세스가 require 한 것(loaded: 상대 경로 목록). */
function isServerFile(f, loaded) {
  const p = String(f || '').replace(/\\/g, '/');
  return SERVER_CODE.test(p) || (Array.isArray(loaded) ? loaded.includes(p) : loaded instanceof Set && loaded.has(p));
}
/** 바뀐 파일 목록 → 확장 다시 불러오기(reload) · 서버 다시 띄우기(server) · npm install(deps) 이 필요한지. */
function classify(files, loaded) {
  const list = (files || []).map((f) => String(f).replace(/\\/g, '/'));
  return {
    reload: list.some(isExtensionFile),
    server: list.some((f) => isServerFile(f, loaded)),
    deps: list.some((f) => /^package(-lock)?\.json$/.test(f)),
  };
}

/**
 * 받아 오기를 한 뒤 올라간 곳과 비교한다. 받아 오기가 안 돼도(오프라인·인증) 마지막으로 받아 둔 것과는 비교한다 — 그 까닭은 fetchError.
 * @returns {Promise<{ok: true, branch: string, upstream: string, ahead: number, behind: number,
 *   commits: {hash: string, author: string, date: string, subject: string}[], dirty: number, overlap: string[], fetchError?: string}
 *   | {ok: false, error: string}>}
 */
async function gitStatus({ git = runGit, fetch = true } = {}) {
  const branch = await git(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branch.code !== 0) return { ok: false, error: `git 저장소가 아닙니다 — ${gitError(branch.err)}` };
  const up = await git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  if (up.code !== 0) return { ok: false, error: `${branch.out} 가지에 올라간 곳(upstream)이 없습니다.` };
  const fetched = fetch ? await git(['fetch', '--quiet'], { timeoutMs: 20000 }) : null;
  const count = await git(['rev-list', '--left-right', '--count', 'HEAD...@{u}']);
  const [ahead, behind] = count.out.split(/\s+/).map(Number);
  if (count.code !== 0 || !Number.isFinite(ahead) || !Number.isFinite(behind)) return { ok: false, error: `비교하지 못했습니다 — ${gitError(count.err)}` };
  const commits = behind
    ? lines(await git(['log', `--max-count=${COMMITS_MAX}`, '--format=%h%x1f%an%x1f%cI%x1f%s', 'HEAD..@{u}'])).map((l) => {
      const [hash, author, date, subject] = l.split('\x1f');
      return { hash, author, date, subject };
    })
    : [];
  // 고치고 있는 파일(커밋하지 않은 것)과 받을 커밋이 바꾸는 파일이 겹치면 git 이 받기를 거절한다 — 누르기 전에 알린다.
  const mine = lines(await git(['diff', '--name-only', 'HEAD']));
  const incoming = behind ? lines(await git(['diff', '--name-only', 'HEAD...@{u}'])) : [];
  const overlap = incoming.filter((f) => mine.includes(f)).slice(0, FILES_MAX);
  return Object.assign(
    { ok: true, branch: branch.out, upstream: up.out, ahead, behind, commits, dirty: mine.length, overlap },
    fetched && fetched.code !== 0 ? { fetchError: gitError(fetched.err) } : {},
  );
}

/**
 * 빨리 감기로만 받는다. 받은 커밋 수와 바뀐 파일, 확장을 다시 불러와야 하는지(reload) · 서버를 다시 띄워야 하는지(server) · package.json 이 바뀌었는지(deps)를 돌려준다.
 * @param {{git?: Function, loaded?: string[]|Set<string>}} [o] loaded — 서버 프로세스가 require 한 파일(저장소 상대 경로)
 * @returns {Promise<{ok: true, from: string, to: string, pulled: number, files: string[], fileCount: number, reload: boolean, server: boolean, deps: boolean}
 *   | {ok: false, error: string}>}
 */
async function gitPull({ git = runGit, loaded = [] } = {}) {
  const before = await git(['rev-parse', 'HEAD']);
  if (before.code !== 0) return { ok: false, error: `git 저장소가 아닙니다 — ${gitError(before.err)}` };
  // --no-rebase: 사용자 설정(pull.rebase)이 무엇이든 빨리 감기만 한다.
  const pulled = await git(['pull', '--ff-only', '--no-rebase', '--quiet'], { timeoutMs: 60000 });
  if (pulled.code !== 0) return { ok: false, error: gitError(pulled.err) };
  const after = await git(['rev-parse', 'HEAD']);
  const moved = after.code === 0 && after.out !== before.out;
  const changed = moved ? lines(await git(['diff', '--name-only', before.out, after.out])) : [];
  const n = moved ? Number((await git(['rev-list', '--count', `${before.out}..${after.out}`])).out) || 0 : 0;
  return Object.assign(
    { ok: true, from: before.out.slice(0, 7), to: (after.out || before.out).slice(0, 7), pulled: n, files: changed.slice(0, FILES_MAX), fileCount: changed.length },
    classify(changed, loaded),
  );
}

module.exports = { ROOT, runGit, gitError, gitStatus, gitPull, classify, isExtensionFile, isServerFile };
