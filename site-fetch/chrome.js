/* site-fetch: 작업용 Chrome — 증빙 찾아오기가 돌아다닐 브라우저를 찾거나 띄운다.
 * 기본은 이 모듈이 띄우는 별도 프로필의 Chrome(KRX_FETCH_PROFILE, 기본 %LOCALAPPDATA%\krx-help\fetch-chrome). 디버그 포트는 Chrome 이 고른 빈 포트(--remote-debugging-port=0)를
 * 프로필의 DevToolsActivePort 파일에서 읽는다 — 떠 있으면 그대로 쓰고(로그인 쿠키가 프로필에 남아 다음에는 로그인 없이 감), 없으면 새로 띄운다.
 * 창이 보이므로 사용자가 지켜보거나 추가 인증을 직접 할 수 있다(KRX_FETCH_HEADLESS=1 이면 창 없이).
 * 회사 시스템 세션이 있는 평소 브라우저와는 따로다. 프로필·고정 포트는 local.json(아래)이나 KRX_FETCH_PROFILE · KRX_FETCH_PORT 로 바꾸고,
 * KRX_FETCH_CDP=http://127.0.0.1:<포트>(또는 local.json 의 cdp)를 주면 이미 떠 있는 그 디버그 Chrome 을 띄우지 않고 쓴다 — 작업은 그 브라우저의 새 창에서 돌고(external),
 * 사용자 탭은 건드리지 않는다. 이 PC 는 평소 쓰는 KRS 프로필 Chrome(9333, 확장이 올라간 브라우저 — ChatGPT·Microsoft 로그인이 있는 곳)을 쓴다.
 * 가맹점마다 고른 브라우저(확장의 fetchSites[].browser → 요청의 site.browser, ensureBrowser(spec)): 그 가맹점에 로그인해 둔 Chrome 을 고른다 — 값은
 *   바탕화면 Chrome 바로가기(아이콘) 이름("SUB 전용" — .lnk 의 인수 --remote-debugging-port 로 포트를 알고, 안 떠 있으면 그 바로가기로 띄움. krs-web-agents chrome-bind 규약: 아이콘 = 채널(포트+프로필) 정의이자 기동 수단),
 *   디버그 포트("9444" — 안 떠 있으면 그 포트를 쓰는 바탕화면 바로가기를 찾아 띄움), 주소("http://127.0.0.1:9444" — 떠 있어야 함). 이 값이 있으면 local.json·환경 변수보다 먼저다 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFile } = require('child_process');

/* 이 PC 만의 설정 site-fetch/local.json (git 제외): { profile, port, cdp, chrome, headless, shortcuts: [바로가기를 더 찾을 폴더] } — 환경 변수가 있으면 그것이 먼저.
 * 예) krs-web-agents 의 sr-receipt·ed-course-evidence 와 같은 브라우저(그쪽에 로그인해 둔 ChatGPT·Microsoft·인프런 세션)를 쓰려면
 *     { "profile": "E:/dev/krs-web-agents/chrome_profile/SUB", "port": 9444 } (바탕화면 "SUB 전용" 바로가기와 같은 Chrome), 이미 떠 있는 브라우저에 붙기만 하려면 { "cdp": "http://127.0.0.1:9333" } — 포트를 같게 두면 어느 쪽이 먼저 띄워도 둘 다 붙는다 */
const LOCAL = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'local.json'), 'utf8')) || {}; } catch (e) { return {}; } })();
const PROFILE = process.env.KRX_FETCH_PROFILE || LOCAL.profile || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'krx-help', 'fetch-chrome');
const PORT = Number(process.env.KRX_FETCH_PORT || LOCAL.port) || 0;   // 0 = Chrome 이 빈 포트를 고름
const EXTERNAL = String(process.env.KRX_FETCH_CDP || LOCAL.cdp || '').trim().replace(/\/+$/, '');
const HEADLESS = /^(1|true|yes)$/i.test(String(process.env.KRX_FETCH_HEADLESS || LOCAL.headless || ''));
const SHOW = /^(1|true|yes)$/i.test(String(process.env.KRX_FETCH_SHOW || LOCAL.show || ''));   // 1 이면 예전처럼 작업 창을 화면에 보이며(지켜볼 때). 기본은 화면 밖에서(cdp.mjs state.hidden — 2026-10-21 "백그라운드에서 작업")
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function alive(http) {
  try { const r = await fetch(`${http}/json/version`, { signal: AbortSignal.timeout(2500) }); return r.ok ? await r.json() : null; } catch (e) { return null; }
}
/* chrome.exe: KRX_FETCH_CHROME → 설치 기본 위치 → Edge */
function chromeExe() {
  const env = process.env, list = [env.KRX_FETCH_CHROME, LOCAL.chrome];
  for (const base of [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA]) if (base) list.push(path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'));
  for (const base of [env['PROGRAMFILES(X86)'], env.PROGRAMFILES]) if (base) list.push(path.join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
  list.push('/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  return list.filter(Boolean).find((f) => { try { return fs.statSync(f).isFile(); } catch (e) { return false; } }) || '';
}

/* ---------- 가맹점이 고른 브라우저 (요청의 site.browser) ---------- */
/* "SUB 전용" · "SUB 전용.lnk" → 바로가기 이름, "9444" · ":9444" · "127.0.0.1:9444" → 포트, "http://127.0.0.1:9444" → 주소. 빈 값은 null */
function parseSpec(spec) {
  const s = String(spec == null ? '' : spec).trim();
  if (!s) return null;
  let m;
  if ((m = /^https?:\/\/[^/\s?#]+/i.exec(s))) return { kind: 'url', http: m[0], label: m[0] };
  if ((m = /^(?:(?:localhost|127\.0\.0\.1)?:)?(\d{2,5})$/i.exec(s))) { const port = Number(m[1]); if (port > 0 && port < 65536) return { kind: 'port', port, http: `http://127.0.0.1:${port}`, label: `포트 ${port}` }; }
  if ((m = /(?:포트|port)\s*[:：]?\s*(\d{2,5})(?!\d)|(?<!\d)(\d{2,5})\s*번?\s*포트/i.exec(s))) { const port = Number(m[1] || m[2]); if (port > 0 && port < 65536) return { kind: 'port', port, http: `http://127.0.0.1:${port}`, label: `포트 ${port}` }; }   // "크롬 9444포트에 자동연결되어 있음" 처럼 문장으로 적어도 포트로 (2026-10-22 사용자 등록 값이 바로가기 이름으로 읽혀 실패)
  if ((m = /^(.+?)\s*\((\d{2,5})\)$/.exec(s))) { const port = Number(m[2]); if (port > 0 && port < 65536) return { kind: 'port', port, http: `http://127.0.0.1:${port}`, label: `${m[1].trim()}(${port})` }; }   // "KRS 전용(9333)" — 오류 글·README 가 바로가기를 이렇게 적어 그대로 붙여 넣는 사용자가 있음(2026-10-22): 포트로 붙고 이름은 표시용
  const name = s.replace(/\.lnk$/i, '').trim();
  return { kind: 'name', name, label: name };
}
/* Chrome 바로가기 인수 → { port, profile } */
function parseLnkArgs(args) {
  const a = String(args || '');
  const port = Number((/--remote-debugging-port=(\d+)/.exec(a) || [])[1]) || 0;
  const pm = /--user-data-dir=(?:"([^"]*)"|(\S+))/.exec(a);
  return { port, profile: pm ? (pm[1] != null ? pm[1] : pm[2]) : '' };
}
const nullU16 = (b, start) => { for (let i = start; i + 1 < b.length; i += 2) if (b[i] === 0 && b[i + 1] === 0) return i; return -1; };
/* Windows 바로가기(.lnk, ShellLink) 파일에서 대상·인수를 읽는다 — COM(WScript.Shell) 없이 파일을 직접 읽으므로 한글 이름 .lnk 도 된다. 못 읽으면 null */
function readLnk(file) {
  let b; try { b = fs.readFileSync(file); } catch (e) { return null; }
  if (b.length < 0x4c || b.readUInt32LE(0) !== 0x4c) return null;
  const flags = b.readUInt32LE(0x14), uni = !!(flags & 0x80);
  let p = 0x4c, target = '';
  if (flags & 0x1) { if (p + 2 > b.length) return null; p += 2 + b.readUInt16LE(p); }   // LinkTargetIDList
  if (flags & 0x2) {   // LinkInfo: 대상 파일(LocalBasePath)
    if (p + 0x14 > b.length) return null;
    const size = b.readUInt32LE(p), hsize = b.readUInt32LE(p + 4), lflags = b.readUInt32LE(p + 8);
    if (lflags & 0x1) {
      let off = b.readUInt32LE(p + 0x10), enc = 'latin1';
      if (hsize >= 0x24 && p + 0x20 <= b.length) { const u = b.readUInt32LE(p + 0x1c); if (u) { off = u; enc = 'utf16le'; } }
      const start = p + off, lim = Math.min(p + size, b.length);
      if (start > p && start < lim) { const end = enc === 'latin1' ? b.indexOf(0, start) : nullU16(b, start); target = b.toString(enc, start, end < 0 || end > lim ? lim : end); }
    }
    p += size;
  }
  const str = () => { if (p + 2 > b.length) return ''; const n = b.readUInt16LE(p); p += 2; const len = uni ? n * 2 : n; const s = b.toString(uni ? 'utf16le' : 'latin1', p, Math.min(p + len, b.length)); p += len; return s; };
  if (flags & 0x4) str();    // NAME_STRING
  if (flags & 0x8) str();    // RELATIVE_PATH
  if (flags & 0x10) str();   // WORKING_DIR
  const args = (flags & 0x20) ? str() : '';
  return Object.assign({ target, args }, parseLnkArgs(args));
}
/* 바탕화면 폴더들: 사용자 바탕화면(OneDrive 로 옮겨졌으면 그곳 — 레지스트리 User Shell Folders) · 공용 · OneDrive · local.json 의 shortcuts 폴더 */
async function desktopDirs() {
  const out = new Set();
  const add = (d) => { try { if (d && fs.statSync(d).isDirectory()) out.add(path.resolve(d)); } catch (e) {} };
  if (process.platform === 'win32') {
    const reg = await new Promise((r) => execFile('reg', ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders', '/v', 'Desktop'], { windowsHide: true, timeout: 4000 }, (err, so) => r(err ? '' : String(so || ''))));
    const m = /\bDesktop\s+REG_(?:EXPAND_)?SZ\s+(.+?)\s*$/m.exec(reg);
    if (m) add(m[1].replace(/%([^%]+)%/g, (_, k) => process.env[k] || process.env[k.toUpperCase()] || ''));
    add(path.join(process.env.PUBLIC || 'C:\\Users\\Public', 'Desktop'));
    for (const k of ['OneDrive', 'OneDriveCommercial', 'OneDriveConsumer']) if (process.env[k]) add(path.join(process.env[k], 'Desktop'));
  }
  add(path.join(os.homedir(), 'Desktop'));
  for (const d of [].concat(LOCAL.shortcuts || [])) add(String(d));
  return Array.from(out);
}
let lnkCache = { at: 0, list: [] };
/* 바탕화면의 바로가기 목록 [{ name, file, target, args, port, profile }] (30초 캐시) — 디버그 포트(port)가 있는 것만 붙을 수 있다 */
async function shortcuts(force) {
  if (!force && Date.now() - lnkCache.at < 30000) return lnkCache.list;
  const list = [];
  for (const dir of await desktopDirs()) {
    let names = []; try { names = fs.readdirSync(dir); } catch (e) { continue; }
    for (const f of names) {
      if (!/\.lnk$/i.test(f)) continue;
      const l = readLnk(path.join(dir, f));
      if (l) list.push({ name: f.replace(/\.lnk$/i, ''), file: path.join(dir, f), target: l.target, args: l.args, port: l.port, profile: l.profile });
    }
  }
  lnkCache = { at: Date.now(), list };
  return list;
}
const sameName = (a, b) => String(a || '').normalize('NFC').replace(/\s+/g, '').toLowerCase() === String(b || '').normalize('NFC').replace(/\s+/g, '').toLowerCase();
const withPort = (list) => { const l = list.filter((x) => x.port).map((x) => `${x.name}(${x.port})`); return l.length ? ` — 바탕화면의 디버그 포트 Chrome 바로가기: ${l.join(' · ')}` : ' — 바탕화면에 디버그 포트(--remote-debugging-port)가 있는 Chrome 바로가기가 없습니다'; };
/* 바로가기를 실행해 그 Chrome 을 띄운다 — 한글 이름 .lnk 는 셸이 깨뜨릴 수 있어 ASCII 이름으로 복사한 것을 실행 (바로가기 복사본도 같은 대상·인수로 뜬다) */
function launchLnk(file) {
  const tmp = path.join(os.tmpdir(), 'krx-help-fetch', `launch-${process.pid}-${Date.now()}.lnk`);
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  fs.copyFileSync(file, tmp);
  const child = spawn('cmd.exe', [`/d /c start "" "${tmp}"`], { detached: true, stdio: 'ignore', windowsHide: true, windowsVerbatimArguments: true });
  child.on('error', () => {});
  child.unref();
  setTimeout(() => { try { fs.unlinkSync(tmp); } catch (e) {} }, 60000).unref();
}
/* 가맹점이 고른 브라우저에 붙는다(안 떠 있으면 바로가기로 띄움) → { http, external: true, label, launched? } (못 쓰면 throw) */
async function attachTo(want) {
  if (want.kind === 'url') {
    if (await alive(want.http)) return { http: want.http, external: true, label: want.label };
    throw new Error(`이 가맹점의 Chrome(${want.http})에 연결할 수 없습니다 — 그 Chrome(디버그 포트로 연 창)을 먼저 여세요`);
  }
  let lnk = null, http = want.http || '', label = want.label;
  if (want.kind === 'name') {
    const list = await shortcuts(true);
    lnk = list.find((x) => sameName(x.name, want.name)) || null;
    if (!lnk) throw new Error(`바탕화면에 "${want.name}" 바로가기가 없습니다${withPort(list)}`);
    if (!lnk.port) throw new Error(`"${lnk.name}" 바로가기에는 디버그 포트(--remote-debugging-port)가 없어 붙을 수 없습니다${withPort(list)}`);
    http = `http://127.0.0.1:${lnk.port}`; label = `${lnk.name}(${lnk.port})`;
  }
  if (await alive(http)) return { http, external: true, label };
  if (!lnk) { lnk = (await shortcuts(true)).find((x) => x.port === want.port) || null; if (lnk) label = `${lnk.name}(${lnk.port})`; }
  if (!lnk || process.platform !== 'win32') throw new Error(`${label} 에 Chrome 이 없습니다 — 그 Chrome(디버그 포트로 연 창)을 먼저 여세요`);
  launchLnk(lnk.file);
  for (let i = 0; i < 80; i++) { await sleep(250); if (await alive(http)) return { http, external: true, label, launched: true }; }
  throw new Error(`"${lnk.name}" 바로가기로 띄운 Chrome 이 20초 안에 뜨지 않았습니다 — 같은 프로필의 Chrome 창이 디버그 포트 없이 열려 있으면 모두 닫고 다시`);
}

/* 고른 Chrome 에 못 붙었을 때 다른 Chrome 을 차례로(2026-10-22 사용자 "안 열리면 다른 크롬 다 열어보라고 해"): 서버 기본(EXTERNAL) → 바탕화면의 디버그 포트 바로가기 중 떠 있는 것 → 없으면 그 바로가기들을 하나씩 띄워 봄. 다 안 되면 null */
async function anyOther(want) {
  const seen = new Set([want.http || '']), cands = [];
  const add = (http, label, lnk) => { if (!http || seen.has(http)) return; seen.add(http); cands.push({ http, label, lnk }); };
  if (EXTERNAL) add(EXTERNAL, `서버 기본(${EXTERNAL})`, null);
  for (const x of await shortcuts(true)) if (x.port) add(`http://127.0.0.1:${x.port}`, `${x.name}(${x.port})`, x);
  for (const c of cands) if (await alive(c.http)) return { http: c.http, external: true, label: c.label };
  if (process.platform !== 'win32') return null;
  for (const c of cands) {
    if (!c.lnk) continue;
    launchLnk(c.lnk.file);
    for (let i = 0; i < 80; i++) { await sleep(250); if (await alive(c.http)) return { http: c.http, external: true, label: c.label, launched: true }; }
  }
  return null;
}

let launching = null;
/* spec = 가맹점이 고른 브라우저(없으면 local.json·환경 변수·기본 작업용 프로필) → { http: 'http://127.0.0.1:<포트>', external, launched?, label? } (못 쓰면 throw) */
async function ensureBrowser(spec) {
  const want = parseSpec(spec);
  if (want) {
    try { return await attachTo(want); }
    catch (e) {   // 고른 Chrome 에 못 붙음 → 다른 Chrome 으로 (anyOther), 그것도 없으면 원래 이유
      const r = await anyOther(want);
      if (r) return Object.assign(r, { fallback: `${want.label} 에 못 붙어 대신 연결 (${String(e.message || e).replace(/\s+/g, ' ').slice(0, 120)})` });
      throw e;
    }
  }
  if (EXTERNAL) {
    if (await alive(EXTERNAL)) return { http: EXTERNAL, external: true };
    throw new Error(`${process.env.KRX_FETCH_CDP ? 'KRX_FETCH_CDP' : 'site-fetch/local.json 의 cdp'}(${EXTERNAL}) Chrome 에 연결할 수 없습니다 — 그 Chrome(디버그 포트로 연 창)을 먼저 여세요`);
  }
  if (launching) return launching;
  launching = (async () => {
    const portFile = path.join(PROFILE, 'DevToolsActivePort');
    const read = () => { try { const p = fs.readFileSync(portFile, 'utf8').split(/\r?\n/)[0].trim(); return /^\d+$/.test(p) ? `http://127.0.0.1:${p}` : ''; } catch (e) { return ''; } };
    let http = PORT ? `http://127.0.0.1:${PORT}` : read();
    if (http && await alive(http)) return { http, external: false };
    if (PORT && (http = read()) && await alive(http)) return { http, external: false };   // 같은 프로필이 다른 포트로 떠 있음
    const exe = chromeExe();
    if (!exe) throw new Error('Chrome 을 찾지 못했습니다 — 서버 환경 변수 KRX_FETCH_CHROME 에 chrome.exe 경로를 지정하세요');
    fs.mkdirSync(PROFILE, { recursive: true });
    try { fs.unlinkSync(portFile); } catch (e) {}
    const args = [`--user-data-dir=${PROFILE}`, `--remote-debugging-port=${PORT}`, '--no-first-run', '--no-default-browser-check', '--disable-default-apps', '--window-size=1280,960'];
    if (HEADLESS) args.push('--headless=new');
    else if (!SHOW) args.push('--window-position=20000,20000');   // 띄운 Chrome 의 첫 창도 화면 밖에 (작업 탭은 cdp.mjs 가 화면 밖 새 창에 열고, 사용자가 봐야 할 때만 화면 안으로)
    args.push('about:blank');
    const child = spawn(exe, args, { detached: true, stdio: 'ignore', windowsHide: false });
    child.on('error', () => {});
    child.unref();
    for (let i = 0; i < 80; i++) {
      await sleep(250);
      http = PORT ? `http://127.0.0.1:${PORT}` : read();   // 포트를 정해 띄우면 Chrome 이 DevToolsActivePort 를 쓰지 않는다
      if (http && await alive(http)) return { http, external: false, launched: true };
    }
    throw new Error(`작업용 Chrome 이 20초 안에 뜨지 않았습니다 (같은 프로필을 디버그 포트 없이 연 Chrome 이 있으면 닫고 다시${PORT ? ` — 포트 ${PORT}` : ''})`);
  })().finally(() => { launching = null; });
  return launching;
}

module.exports = { ensureBrowser, anyOther, chromeExe, alive, parseSpec, parseLnkArgs, readLnk, desktopDirs, shortcuts, PROFILE, PORT, EXTERNAL, SHOW };
