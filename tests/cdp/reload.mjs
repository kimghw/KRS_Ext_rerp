// 확장 다시 올리기 — 디버그 포트를 연 크롬에 **이 폴더**에서 로드된 압축해제 확장을 CDP 로 리로드한다(chrome://extensions 의 ↻ 단추와 같다).
// kr_ext_workspace 의 test/cdp/reload.mjs 를 이 저장소에 맞춘 것 — 패널 문서는 툴바 팝업·사이드 패널(0.8.4, 같은 popup/popup.html)이고, 리로드 뒤 커밋 상태(git)까지 한 줄에 붙인다.
//
//   node tests/cdp/reload.mjs                 # 이 폴더에서 로드된 확장을 다시 올리고, 올라온 상태·오류·커밋 상태를 찍는다 (바뀐 파일에 문법 오류가 있으면 올리지 않음 — --force 로 그대로)
//   node tests/cdp/reload.mjs <확장 ID>        # 경로로 못 찾을 때(다른 폴더의 복사본 등) ID 로 고른다
//   node tests/cdp/reload.mjs list            # 디버그 크롬의 압축해제 확장 목록(이름·버전·ID·상태·경로·남은 오류)
//   node tests/cdp/reload.mjs git             # 커밋 상태 한 줄만(리로드 없음, GitHub 받아 오기 포함)
//   node tests/cdp/reload.mjs --if-changed    # 훅용 — 소스가 지난 리로드 뒤 바뀌었을 때만 올리고, 커밋 상태가 달라졌으면 그것도, 훅 JSON(systemMessage) 한 줄로. 항상 종료 코드 0
//
// --if-changed 는 Claude Code 의 Stop 훅(.claude/settings.local.json)이 부른다 — Claude 가 한 차례 작업을 마칠 때마다 돌아,
//  1) 확장이 읽는 파일(tests·help-server·site-fetch·.claude·.git 과 *.md·*.mp4·package*.json·.gitignore 를 뺀 전부)의 가장 새 mtime 이 도장(임시 폴더의
//     krx-rerp-reload.stamp)보다 새로우면 리로드하고 도장을 그 mtime 으로 맞춘다. 올리기 전에 그 뒤 바뀐 .js 는 node --check, .json 은 JSON.parse 로
//     문법을 보고, 깨진 것이 있으면 올리지 않고 보류한다(help-server 의 "적용" 보호와 같다 — 깨진 채 올리면 팝업, 곧 Help Chat 창구까지 죽는다).
//     디버그 포트 크롬이 없으면 그렇다고만 말한다.
//  2) git 으로 커밋 상태를 본다 — 커밋 안 한 변경(파일 수·이름), 올리지 않은 커밋 수, GitHub 에 새 커밋 수(받아 오기는 10분에 한 번).
//     리로드했거나 커밋 상태의 말이 지난번과 달라졌을 때만 찍는다 — 같은 말을 매번 되풀이하지 않는다.
//
// 하는 일: chrome://extensions 탭(없으면 잠깐 열었다 닫는다)에 붙어 chrome.developerPrivate.reload(id) 를 부른다. 확장은 이름이 아니라
// **경로**(x.path 가 이 폴더)로 고른다 — 같은 이름의 확장이 다른 폴더에서도 올라가 있을 수 있어서다. 그 길이 막히면 확장의 서비스워커·페이지에서
// chrome.runtime.reload() 로 대신한다. 끝나면 다시 올라온 상태와 올라오면서 난 manifest·런타임 오류를 찍는다. 크롬은 리로드해도 런타임 오류 기록을
// 남겨 두므로 전에 쌓인 것은 먼저 찍고 비운 뒤 리로드한다 — 그래서 리로드 뒤에 보이는 건 전부 새 오류다.
//
// 리로드 뒤 열린 탭: background.js 의 onInstalled 가 eClass 홈 탭은 새로고침하고 열린 R&D ERP·HR 탭에는 브리지·청구서 도우미·HR 스크립트를
// 다시 넣으므로 손댈 것이 없다. 툴바 팝업·사이드 패널·설정 페이지는 리로드로 닫힌다 — 다시 열면 된다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { version, targets, newTab, closeTab, attach, PORT } from './cdp.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** 저장소 뿌리 — 확장이 읽는 파일들이 여기 있고, chrome://extensions 의 경로와 이것을 견준다. */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/** manifest.json 의 이름 — 경로로 못 찾을 때의 차선. */
const EXT_NAME = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')).name; } catch { return 'KR eClass + R&D ERP 현황'; } })();
/** --if-changed 가 "마지막으로 올린 소스의 mtime"·"마지막 받아 오기"·"마지막에 한 커밋 상태 말" 을 남겨 두는 도장. */
const STAMP = path.join(os.tmpdir(), 'krx-rerp-reload.stamp');
/** 확장이 읽지 않는 것들 — 여기만 바뀌면 리로드할 까닭이 없다. help-server 는 따로 도는 서버(바뀌면 서버를 다시 띄운다), site-fetch 는 그 서버가 쓰는 증빙 찾아오기 모듈. */
const NOT_EXTENSION_DIRS = new Set(['.git', '.claude', 'tests', 'help-server', 'site-fetch', 'node_modules']);
const NOT_EXTENSION_FILE = /(^\.gitignore$|\.md$|\.mp4$|^package\.json$|^package-lock\.json$)/i;
/** GitHub 받아 오기(fetch) 간격 — kr_ext_workspace 의 git 아이콘과 같다. */
const FETCH_EVERY_MS = 10 * 60_000;

/** 경로 견주기 — 역슬래시·대소문자·끝 슬래시를 무시한다(developerPrivate 는 "E:\dev\kr_ext_rerp" 꼴로 준다). */
const normPath = (p) => String(p || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
const clip = (s, n = 300) => (String(s).length > n ? `${String(s).slice(0, n)}…` : String(s));

/** 확장이 읽는 파일 전부 — { file(슬래시 상대 경로), mtimeMs }. */
export function sourceFiles(root = ROOT) {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) { if (!NOT_EXTENSION_DIRS.has(e.name)) walk(path.join(dir, e.name)); continue; }
      if (!e.isFile() || NOT_EXTENSION_FILE.test(e.name)) continue;
      const f = path.join(dir, e.name);
      out.push({ file: path.relative(root, f).split(path.sep).join('/'), mtimeMs: fs.statSync(f).mtimeMs });
    }
  };
  walk(root);
  return out;
}

/** 확장이 읽는 파일 중 가장 새 것. */
export function newestSource(root = ROOT) {
  let best = { file: null, mtimeMs: 0 };
  for (const s of sourceFiles(root)) if (s.mtimeMs > best.mtimeMs) best = s;
  return best;
}

/** 도장(stampMs)보다 새 파일들 — 지난 리로드 뒤 바뀐 것. */
export const changedSince = (stampMs, root = ROOT) => sourceFiles(root).filter((s) => s.mtimeMs > (Number(stampMs) || 0)).map((s) => s.file);

/**
 * 바뀐 파일의 문법 검사 — .js 는 node --check, .json 은 JSON.parse. help-server 의 "적용" 보호와 같다:
 * 깨진 채 확장을 다시 올리면 팝업(= Help Chat 창구)까지 죽을 수 있어, 깨진 것이 있으면 올리지 않는다.
 * @returns {Promise<{file: string, error: string}[]>}
 */
export async function checkSyntax(files, root = ROOT) {
  const bad = [];
  for (const file of files) {
    const abs = path.join(root, file);
    if (/\.json$/i.test(file)) {
      try { JSON.parse(fs.readFileSync(abs, 'utf8')); } catch (e) { bad.push({ file, error: e.message }); }
    } else if (/\.js$/i.test(file)) {
      const err = await new Promise((res) => execFile(process.execPath, ['--check', abs], { windowsHide: true }, (e, so, se) => res(e ? String(se || e.message) : '')));
      if (!err) continue;
      // node 의 말: 첫 줄 "경로:줄", 그 아래 코드와 ^, 그 다음 "SyntaxError: …". 파일 이름과 오류 한 줄만 남긴다.
      const ls = err.split('\n').map((l) => l.trim()).filter(Boolean);
      const where = (ls[0] || '').replace(abs, file);
      const what = ls.find((l) => /^[A-Za-z]*Error/.test(l)) || ls[0] || '문법 오류';
      bad.push({ file, error: where && where !== what ? `${what} (${where})` : what });
    }
  }
  return bad;
}

// ───────────── git: 커밋 상태 ─────────────

// git 의 말은 영어로 받는다(LC_ALL=C) — 거절한 까닭을 그 말로 가린다. 훅에는 창이 없어 비밀번호를 물으면 답할 사람이 없다 — 묻지 않고 실패하게 한다.
const gitEnv = () => ({ ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never', LC_ALL: 'C' });

/** git 을 한 번 부른다. 던지지 않는다 — 실행이 안 되거나 시간이 다 되면 code 가 -1 이다. */
export function git(args, { cwd = ROOT, timeoutMs = 20_000 } = {}) {
  return new Promise((resolve) => {
    execFile('git', ['-c', 'core.quotepath=false', ...args], { cwd, env: gitEnv(), timeout: timeoutMs, windowsHide: true, maxBuffer: 4 << 20 }, (err, stdout, stderr) => {
      const out = String(stdout || '').trimEnd();
      const errText = String(stderr || '').trim();
      if (!err) return resolve({ code: 0, out, err: errText });
      if (err.killed) return resolve({ code: -1, out, err: `git ${args[0]} 이 ${timeoutMs / 1000}초 안에 끝나지 않았습니다.` });
      resolve({ code: typeof err.code === 'number' ? err.code : -1, out, err: errText || err.message });
    });
  });
}

/** git 이 거절한 말을 사람이 할 일로. */
export function gitError(err) {
  const s = String(err || '').trim();
  if (/authentication failed|could not read username|terminal prompts disabled|permission denied/i.test(s)) return 'GitHub 인증 필요 — 터미널에서 한 번 git fetch 해 로그인해 두세요';
  if (/could not resolve host|unable to access|failed to connect|timed out|끝나지 않았습니다/i.test(s)) return 'GitHub 에 닿지 못함(네트워크)';
  if (/index\.lock|another git process/i.test(s)) return '다른 git 작업이 돌고 있음';
  return clip(s, 160) || 'git 이 까닭 없이 실패';
}

/** `git status --porcelain` 한 줄 → 파일 이름(이름이 바뀐 것은 새 이름). */
const porcelainName = (line) => { const n = line.slice(3).trim(); const i = n.indexOf(' -> '); return i >= 0 ? n.slice(i + 4) : n; };

/**
 * 커밋 상태 — 커밋 안 한 변경·올리지 않은 커밋·GitHub 의 새 커밋을 한 줄 말로.
 * fetch 는 lastFetchMs 가 FETCH_EVERY_MS 보다 오래됐을 때만 한다(실패해도 그때로 적어 매번 다시 두드리지 않는다).
 * @returns {Promise<{ok: boolean, text: string, branch?: string, upstream?: string, dirty?: string[], ahead?: number, behind?: number, clean?: boolean, fetchedAt?: number, fetchError?: string}>}
 */
export async function gitSummary({ lastFetchMs = 0, fetch = true, now = Date.now() } = {}) {
  const branch = await git(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branch.code !== 0) return { ok: false, text: `git 저장소를 읽지 못함(${gitError(branch.err)})` };
  const status = await git(['status', '--porcelain']);
  const dirty = status.code === 0 && status.out ? status.out.split('\n').filter(Boolean).map(porcelainName) : [];
  const up = await git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  const upstream = up.code === 0 ? up.out : '';
  let fetchedAt = lastFetchMs;
  let fetchError = '';
  if (upstream && fetch && now - lastFetchMs >= FETCH_EVERY_MS) {
    const f = await git(['fetch', '--quiet'], { timeoutMs: 15_000 });
    fetchedAt = now;
    if (f.code !== 0) fetchError = gitError(f.err);
  }
  let ahead = 0;
  let behind = 0;
  if (upstream) {
    const c = await git(['rev-list', '--left-right', '--count', '@{u}...HEAD']);
    if (c.code === 0) { const [b, a] = c.out.split(/\s+/).map(Number); behind = b || 0; ahead = a || 0; }
  }
  const parts = [];
  if (dirty.length) parts.push(`커밋 안 한 변경 ${dirty.length}개(${dirty.slice(0, 5).join(', ')}${dirty.length > 5 ? ` 외 ${dirty.length - 5}개` : ''})`);
  if (ahead) parts.push(`올리지 않은 커밋 ${ahead}개`);
  if (behind) parts.push(`GitHub(${upstream})에 새 커밋 ${behind}개 — git pull`);
  if (!upstream) parts.push(`${branch.out} 가지에 올라간 곳(upstream)이 없음`);
  const clean = parts.length === 0;
  let text = clean ? `커밋·푸시 모두 됨(${branch.out} = ${upstream})` : parts.join(' · ');
  if (fetchError) text += ` (받아 오기 실패: ${fetchError} — 마지막으로 받아 둔 것과 견줌)`;
  return { ok: true, branch: branch.out, upstream, dirty, ahead, behind, clean, fetchedAt, fetchError, text };
}

// ───────────── 훅 ─────────────

function readStamp() {
  // 도장은 파일의 mtime 이 아니라 **내용**으로 읽는다 — NTFS 의 mtime 은 100ns 단위라 utimes 로 ms 단위를 쓰면 원본보다 늘 조금 앞서
  // "바뀌었다" 로 읽힌다(kr_ext_workspace 에서 2026-10-09 에 실제로 겪어, 매번 리로드했다).
  try { const s = JSON.parse(fs.readFileSync(STAMP, 'utf8')); return s && typeof s === 'object' ? s : {}; } catch { return {}; }
}
const writeStamp = (s) => fs.writeFileSync(STAMP, JSON.stringify(s) + '\n');

/** 리로드 결과를 한 토막 말로. */
function reloadSaid(r, why) {
  const problems = [r.loadError && `LOAD ERROR ${r.loadError}`, ...r.manifestErrors.map((m) => `manifest: ${m}`), ...r.runtimeErrors.map((m) => `runtime: ${m}`)].filter(Boolean);
  return `확장 다시 올림(${why}) — ${r.state}${r.pathNote ? ` ${r.pathNote}` : ''}${problems.length ? ', ' + problems.join(' | ').slice(0, 500) : ', 오류 없음'}`;
}

/** 훅이 부르는 길 — 바뀐 게 있을 때만 올리고, Claude Code 에 보일 한 줄(systemMessage)을 돌려준다. null 이면 조용히 지나간다. */
export async function reloadIfChanged({ id } = {}) {
  const stamp = readStamp();
  const newest = newestSource();
  const changed = newest.mtimeMs > (Number(stamp.mtimeMs) || 0);
  const said = [];
  if (changed) {
    let chromeUp = true;
    try { await version(); } catch { chromeUp = false; }
    if (!chromeUp) {
      said.push(`확장 소스가 바뀌었지만(${newest.file}) 디버그 포트 ${PORT} 크롬이 없어 다시 올리지 못했습니다.`);
    } else {
      // 올리기 전에 지난 리로드 뒤 바뀐 파일의 문법을 본다 — 깨진 것이 있으면 올리지 않고 보류한다(도장도 그대로 — 고치면 다음 턴에 올린다).
      const bad = await checkSyntax(changedSince(stamp.mtimeMs));
      if (bad.length) {
        said.push(`확장 다시 올리지 않음 — 문법 오류 ${bad.length}건: ${bad.map((b) => `${b.file}: ${b.error}`).join(' | ').slice(0, 500)}`);
      } else {
        try {
          const r = await reloadExtension({ id });
          // 도장에는 "지금" 이 아니라 올린 소스의 mtime 을 적는다 — 그 사이에 또 고친 파일은 다음에 잡힌다.
          Object.assign(stamp, { mtimeMs: newest.mtimeMs, file: newest.file, at: new Date().toISOString() });
          said.push(reloadSaid(r, `${newest.file} 바뀜`));
        } catch (e) {
          said.push(`확장을 다시 올리지 못했습니다: ${e.message}`);
        }
      }
    }
  }
  let g;
  try { g = await gitSummary({ lastFetchMs: Number(stamp.fetchedAt) || 0 }); } catch (e) { g = { ok: false, text: `커밋 상태를 보지 못함: ${e.message}` }; }
  if (g.ok) stamp.fetchedAt = g.fetchedAt;
  if (changed || g.text !== stamp.gitText) said.push(`커밋 상태: ${g.text}`);
  stamp.gitText = g.text;
  try { writeStamp(stamp); } catch { /* 임시 폴더에 못 쓰면 다음에 또 본다 */ }
  return said.length ? said.join(' / ') : null;
}

// ───────────── CDP: chrome://extensions ─────────────

/** chrome://extensions 에서 보는 확장 목록(이름·상태·경로·오류). */
const infoExpr = `new Promise((r) => chrome.developerPrivate.getExtensionsInfo({}, (xs) => r(xs.map((x) => ({
  id: x.id, name: x.name, state: x.state, path: x.path || '', location: x.location, version: x.version,
  manifestErrors: (x.manifestErrors || []).map((e) => e.message),
  runtimeErrors: (x.runtimeErrors || []).map((e) => e.message + (e.source ? '  @ ' + e.source.replace(/^chrome-extension:[/][/][a-p]{32}[/]/, '') : '')),
})))))`;

/** chrome://extensions 탭(없으면 잠깐 열었다 닫는다)에 붙어 fn(손잡이, 로그) 을 돌린다. */
async function withExtensionsPage(fn, log = () => {}) {
  const all = await targets();
  let page = all.find((x) => x.type === 'page' && x.url.startsWith('chrome://extensions'));
  let opened = null;
  if (!page) { opened = page = await newTab('chrome://extensions/'); log('chrome://extensions 탭을 잠깐 연다'); }
  const c = await attach(page);
  try { return await fn(c, all); } finally { c.close(); if (opened) await closeTab(opened.id); }
}

/** 디버그 크롬의 확장 목록. developerPrivate 를 못 쓰면 null. */
export async function listExtensions({ log = () => {} } = {}) {
  return withExtensionsPage(async (c) => {
    try { return await c.evaluate(infoExpr, 8000); } catch (e) { log(`developerPrivate 를 못 쓴다: ${e.message}`); return null; }
  }, log);
}

/** 목록에서 이 폴더의 확장을 고른다 — 경로가 같은 압축해제 확장, 없으면 이름이 같은 압축해제 확장(경로가 다르다고 알린다). */
export function pickExtension(list, { id, root = ROOT, name = EXT_NAME } = {}) {
  if (!list) return { ext: null, pathNote: '' };
  if (id) return { ext: list.find((x) => x.id === id) || null, pathNote: '' };
  const byPath = list.find((x) => x.location === 'UNPACKED' && normPath(x.path) === normPath(root));
  if (byPath) return { ext: byPath, pathNote: '' };
  const byName = list.filter((x) => x.location === 'UNPACKED' && x.name === name);
  if (byName.length === 1) return { ext: byName[0], pathNote: `(경로가 다름: ${byName[0].path} — 이 폴더의 변경이 반영되지 않는다)` };
  return { ext: null, pathNote: '' };
}

/**
 * 확장을 다시 올린다.
 * @param {{ id?: string, log?: (s: string) => void }} opts  id 가 없으면 이 폴더에서 로드된 압축해제 확장을 찾는다.
 * @returns {Promise<{ id: string, state: string, via: string, loadError: string|null, manifestErrors: string[], runtimeErrors: string[], before: string[], pathNote: string }>}
 */
export async function reloadExtension({ id, log = () => {} } = {}) {
  return withExtensionsPage(async (c, all) => {
    let list;
    try { list = await c.evaluate(infoExpr, 8000); } catch (e) { list = null; log(`developerPrivate 를 못 쓴다: ${e.message}`); }
    const { ext, pathNote } = pickExtension(list, { id });
    if (pathNote) log(pathNote);

    if (!ext) {
      // developerPrivate 가 없거나 목록에 없다 — 확장의 서비스워커·페이지에서 chrome.runtime.reload() 로 간다.
      const extId = id || findExtId(all);
      if (!extId) {
        throw new Error(list ? `이 폴더(${ROOT})에서 로드된 압축해제 확장이 chrome://extensions 목록에 없다 — list 로 확인하세요.`
          : '확장을 찾지 못했다 — chrome://extensions 의 developerPrivate 도, 열린 확장 타깃도 없다.');
      }
      return { ...(await reloadFromExtensionTarget(extId, log)), pathNote };
    }

    const before = [...ext.manifestErrors, ...ext.runtimeErrors];
    log(`${ext.name} ${ext.version} (${ext.id}, ${ext.state}) ← ${ext.path}`);
    if (before.length) log(`리로드 전 남아 있던 오류 ${before.length}건: ${before.slice(0, 3).join(' | ').slice(0, 300)}`);

    // 크롬은 리로드해도 런타임 오류를 일부러 남겨 둔다. 먼저 비워야 리로드 뒤에 보이는 것이 전부 새 오류가 된다. 지우기 전에 위에서 찍어 두었다.
    if (before.length) {
      await c.evaluate(`new Promise((res) => chrome.developerPrivate.deleteExtensionErrors({ extensionId: ${JSON.stringify(ext.id)} }, () => res(chrome.runtime.lastError ? chrome.runtime.lastError.message : null)))`, 8000)
        .then((e) => { if (e) log(`오류 기록을 못 비웠다: ${e}`); }, (e) => log(`오류 기록을 못 비웠다: ${e.message}`));
    }

    // failQuietly: 실패해도 chrome://extensions 에 대화상자를 띄우지 않고, populateErrorForUnpacked: 대신 콜백으로 오류를 돌려준다.
    const loadError = await c.evaluate(`new Promise((res) => chrome.developerPrivate.reload(${JSON.stringify(ext.id)},
      { failQuietly: true, populateErrorForUnpacked: true },
      (e) => res(chrome.runtime.lastError ? chrome.runtime.lastError.message : (e ? (e.error + (e.path ? '  @ ' + e.path : '')) : null))))`, 30000);

    // 다시 올라올 틈을 주고 상태를 본다. 서비스워커가 뜨면서 던진 오류는 runtimeErrors 로 모인다.
    let after = null;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      const xs = await c.evaluate(infoExpr, 8000).catch(() => null);
      after = xs && xs.find((x) => x.id === ext.id);
      if (after && after.state === 'ENABLED' && i >= 3) break;   // 2초는 기다려 SW 시작 오류까지 본다
    }
    return {
      id: ext.id, via: 'developerPrivate.reload', loadError, before, pathNote,
      state: after ? after.state : '(목록에 없음)',
      manifestErrors: after ? after.manifestErrors : [],
      runtimeErrors: after ? after.runtimeErrors : [],
    };
  }, log);
}

/** 타깃 목록에서 이 확장의 ID — 확장의 서비스워커나 페이지가 떠 있어야 잡힌다. 이름(title)이 같은 것만. */
function findExtId(all) {
  const t = all.find((x) => (x.url || '').startsWith('chrome-extension://') && x.title === EXT_NAME);
  return t ? t.url.split('/')[2] : null;
}

/** 우회로 — 확장의 서비스워커나 페이지에서 chrome.runtime.reload(). 그 타깃은 바로 죽으니 응답을 기다리지 않는다. */
async function reloadFromExtensionTarget(id, log) {
  const t = (await targets()).find((x) => (x.url || '').startsWith(`chrome-extension://${id}/`));
  if (!t) throw new Error(`확장 ${id} 의 살아 있는 타깃이 없다 — 설정 페이지를 열어 두거나 chrome://extensions 를 열어 두세요.`);
  log(`확장 타깃에서 runtime.reload(): ${t.url}`);
  const c = await attach(t);
  c.send('Runtime.evaluate', { expression: 'chrome.runtime.reload()' }, 2000).catch(() => {});
  await sleep(300);
  c.close();
  let up = false;
  for (let i = 0; i < 20 && !up; i++) {
    await sleep(500);
    up = (await targets()).some((x) => (x.url || '').startsWith(`chrome-extension://${id}/`));
  }
  return { id, via: 'runtime.reload', loadError: null, before: [], state: up ? 'ENABLED(추정 — 타깃이 다시 보임)' : '(타깃이 안 보임 — 서비스워커가 잠들었을 수 있음)', manifestErrors: [], runtimeErrors: [] };
}

// ───────────── 명령줄 ─────────────

if (process.argv[1] && /reload\.mjs$/.test(process.argv[1])) {
  const args = process.argv.slice(2);
  const id = args.find((a) => /^[a-p]{32}$/.test(a));
  const log = (s) => console.log('  ' + s);
  if (args.includes('--if-changed')) {
    // 훅 길 — 무슨 일이 있어도 종료 코드 0 (Stop 훅이 2 로 끝나면 Claude 가 멈추지 못한다). 할 말이 있을 때만 JSON 한 줄.
    try {
      const msg = await reloadIfChanged({ id });
      if (msg) console.log(JSON.stringify({ systemMessage: msg }));
    } catch (e) {
      console.log(JSON.stringify({ systemMessage: `확장 리로드 훅 실패: ${e.message}` }));
    }
    process.exit(0);
  }
  try {
    if (args.includes('git')) {
      const g = await gitSummary();
      console.log(g.text);
      process.exit(g.ok ? 0 : 1);
    }
    if (args.includes('list')) {
      const list = await listExtensions({ log });
      if (!list) throw new Error('chrome://extensions 의 developerPrivate 를 쓰지 못했다.');
      const unpacked = list.filter((x) => x.location === 'UNPACKED');
      if (!unpacked.length) console.log('압축해제 확장이 없다.');
      for (const x of unpacked) {
        const mine = normPath(x.path) === normPath(ROOT) ? '  ← 이 폴더' : '';
        const errs = x.manifestErrors.length + x.runtimeErrors.length;
        console.log(`${x.name} ${x.version}  ${x.id}  ${x.state}  ${x.path}${errs ? `  (남은 오류 ${errs}건)` : ''}${mine}`);
      }
      process.exit(0);
    }
    if (!args.includes('--force')) {
      // 지난 리로드 뒤 바뀐 파일의 문법 — 깨진 채 올리면 팝업(Help Chat 창구)까지 죽는다. 도장이 없으면(처음) 전부 본다.
      const bad = await checkSyntax(changedSince(readStamp().mtimeMs));
      if (bad.length) {
        for (const b of bad) console.log(`  문법 오류  ${b.file}: ${b.error}`);
        console.log('  올리지 않았다 — 고친 뒤 다시, 또는 --force 로 그대로 올린다.');
        process.exit(1);
      }
    }
    const r = await reloadExtension({ id, log });
    console.log(`다시 올렸다 (${r.via}) — ${r.id} ${r.state}${r.pathNote ? ' ' + r.pathNote : ''}`);
    if (r.loadError) console.log('  LOAD ERROR  ' + r.loadError);
    for (const m of r.manifestErrors) console.log('  manifest    ' + m);
    for (const m of r.runtimeErrors) console.log('  runtime     ' + m.slice(0, 400));
    if (!r.loadError && !r.manifestErrors.length && !r.runtimeErrors.length) console.log('  오류 없음');
    console.log('  eClass 홈 탭은 확장이 스스로 새로고침하고, 열린 R&D ERP·HR 탭에는 스크립트를 다시 넣는다. 팝업·설정 페이지는 다시 열면 된다.');
    const g = await gitSummary().catch((e) => ({ text: `커밋 상태를 보지 못함: ${e.message}` }));
    console.log(`  커밋 상태: ${g.text}`);
    process.exit(r.loadError || r.manifestErrors.length ? 1 : 0);
  } catch (e) {
    console.error('실패: ' + e.message);
    process.exit(1);
  }
}
