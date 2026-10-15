/* site-fetch: 작업용 Chrome — 증빙 찾아오기가 돌아다닐 브라우저를 찾거나 띄운다.
 * 기본은 이 모듈이 띄우는 별도 프로필의 Chrome(KRX_FETCH_PROFILE, 기본 %LOCALAPPDATA%\krx-help\fetch-chrome). 디버그 포트는 Chrome 이 고른 빈 포트(--remote-debugging-port=0)를
 * 프로필의 DevToolsActivePort 파일에서 읽는다 — 떠 있으면 그대로 쓰고(로그인 쿠키가 프로필에 남아 다음에는 로그인 없이 감), 없으면 새로 띄운다.
 * 창이 보이므로 사용자가 지켜보거나 추가 인증을 직접 할 수 있다(KRX_FETCH_HEADLESS=1 이면 창 없이).
 * 회사 시스템 세션이 있는 평소 브라우저와는 따로다. 프로필·고정 포트는 local.json(아래)이나 KRX_FETCH_PROFILE · KRX_FETCH_PORT 로 바꾸고,
 * KRX_FETCH_CDP=http://127.0.0.1:<포트>(또는 local.json 의 cdp)를 주면 이미 떠 있는 그 디버그 Chrome 을 띄우지 않고 쓴다 — 작업은 그 브라우저의 새 창에서 돌고(external),
 * 사용자 탭은 건드리지 않는다. 이 PC 는 평소 쓰는 KRS 프로필 Chrome(9333, 확장이 올라간 브라우저 — ChatGPT·Microsoft 로그인이 있는 곳)을 쓴다 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

/* 이 PC 만의 설정 site-fetch/local.json (git 제외): { profile, port, cdp, chrome, headless } — 환경 변수가 있으면 그것이 먼저.
 * 예) krs-web-agents 의 sr-receipt·ed-course-evidence 와 같은 브라우저(그쪽에 로그인해 둔 ChatGPT·Microsoft·인프런 세션)를 쓰려면
 *     { "profile": "E:/dev/krs-web-agents/chrome_profile/SUB", "port": 9444 } (바탕화면 "SUB 전용" 바로가기와 같은 Chrome), 이미 떠 있는 브라우저에 붙기만 하려면 { "cdp": "http://127.0.0.1:9333" } — 포트를 같게 두면 어느 쪽이 먼저 띄워도 둘 다 붙는다 */
const LOCAL = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'local.json'), 'utf8')) || {}; } catch (e) { return {}; } })();
const PROFILE = process.env.KRX_FETCH_PROFILE || LOCAL.profile || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'krx-help', 'fetch-chrome');
const PORT = Number(process.env.KRX_FETCH_PORT || LOCAL.port) || 0;   // 0 = Chrome 이 빈 포트를 고름
const EXTERNAL = String(process.env.KRX_FETCH_CDP || LOCAL.cdp || '').trim().replace(/\/+$/, '');
const HEADLESS = /^(1|true|yes)$/i.test(String(process.env.KRX_FETCH_HEADLESS || LOCAL.headless || ''));
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
let launching = null;
/* → { http: 'http://127.0.0.1:<포트>', external, launched? } (못 쓰면 throw) */
async function ensureBrowser() {
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

module.exports = { ensureBrowser, chromeExe, alive, PROFILE, PORT, EXTERNAL };
