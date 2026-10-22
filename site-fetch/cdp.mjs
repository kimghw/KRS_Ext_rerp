#!/usr/bin/env node
/* site-fetch: 브라우저 손잡이 — site-fetch/index.js 가 작업 폴더(%TEMP%\krx-help-fetch\<작업 id>)에 cdp.mjs 로 복사해 두고,
 * 헤드리스 Claude 는 `node cdp.mjs <명령>` 으로만 브라우저를 다룬다(그 밖의 명령·도구는 index.js 가 막음). 명령 하나가 프로세스 하나다: 디버그 포트의 브라우저에 붙어
 * 이 작업이 연 탭(state.json tabs)에만 손대고 끝나면 떨어진다. 저장한 서류는 out/ 과 out/files.json(index.js 가 결과로 읽음).
 *  - 브라우저: state.json 의 cdp(http://127.0.0.1:<포트>) — 보통 site-fetch/chrome.js 가 띄운 작업용 Chrome(별도 프로필)
 *  - 프레임: 같은 출처 iframe 은 그대로, 다른 출처 iframe(OOPIF — Azure 포털의 그리드 등)은 Target.setAutoAttach 로 붙어 그 안의 요소도 [번호]에 넣는다(누르기는 그 프레임에서 스크립트로)
 *  - 비밀번호: 환경 변수 KRX_FETCH_SECRET 의 파일({ id, pw }, 작업 폴더 밖)을 login 명령만 읽어 입력란에 넣는다. 출력에는 절대 싣지 않고(가림) 인자로도 받지 않는다
 *  - 막는 곳: 회사 시스템(*.krs.co.kr · rcms.go.kr)·이 PC(localhost)·chrome:// 등으로는 가지 않는다
 * Node 22+ (내장 WebSocket). 의존 패키지 없음 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const STATE = path.join(DIR, 'state.json');
const OUT = path.join(DIR, 'out');
const DL = path.join(OUT, 'dl');
const MANIFEST = path.join(OUT, 'files.json');
const VIEW = path.join(DIR, 'view.jpg');
const MAX_ELEMS = 160, TEXT_HEAD = 3500, TEXT_PAGE = 6000, CAPTURE_MAX_H = 15000, TARGET_IMG = 500 * 1024;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clip = (s, n) => { const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

const HELP = `node cdp.mjs <명령>
  look [글자]            지금 화면: 주소·제목·본문 앞부분·누를 수 있는 요소 [번호] (글자를 주면 그 글자가 든 줄·요소만)
  text [시작]            본문 글을 이어서 (look 이 자른 뒤 — 예: text 3500)
  shot                   보이는 화면을 view.jpg 로 찍음 → Read 도구로 view.jpg 를 열어 직접 본다
  go <주소>              지금 탭에서 이동          open <주소>   새 탭으로 열기
  click <번호>           요소 누르기 (새 탭이 열리면 그 탭으로 옮김)
  type <번호> <글>        입력란에 글 넣기 (원래 글은 지움)
  login <아이디칸> <비밀번호칸>   등록된 아이디·비밀번호 넣기 — 값은 보이지 않음. 한 화면에 한 칸이면 다른 쪽은 - (예: login 4 -)
  key <Enter|Tab|Escape|Space|PageDown|PageUp|ArrowDown|ArrowUp>
  select <번호> <보이는 글 또는 값>     scroll <down|up|top|bottom|번호>     back
  tabs / tab <번호>       이 작업의 탭 목록 / 옮기기 (close 로 지금 탭 닫기)
  dialog <ok|cancel>     떠 있는 확인창(confirm) 닫기
  wait <초>              (60초까지 — 1000 이상이면 밀리초로 봄)      waitfor <글자> [초]   화면에 그 글자가 나올 때까지 (추가 인증을 기다릴 때, 300초까지 — 화면 밖에서 돌던 창을 이때 사용자 화면에 띄움)
  eval <JS 식>           페이지에서 평가한 값 (읽기 전용으로만 — 조회 fetch 는 됨)
  pdf <종류> [메모]       지금 페이지를 PDF 로 저장 (PDF 를 보여 주는 탭이면 그 PDF 를 그대로)
  capture <종류> [메모]   지금 페이지 전체를 이미지로 저장 (pdf 가 깨질 때)
  download <번호> <종류>  눌러서 파일이 내려받아지는 링크·버튼 → 받은 파일을 저장
  saveurl <종류> <주소>   PDF·이미지 주소를 로그인된 상태로 받아 저장 (다른 사이트 주소면 내려받기로)
  files / drop <파일>     저장한 서류 목록 / 빼기`;

/* ---------- 상태 · 비밀 · 가림 ---------- */
function readJson(f, dflt) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return dflt; } }
const state = readJson(STATE, null);
/* 작업 창은 화면 밖에서(state.hidden — 2026-10-21 사용자 "찾아오기 할 때 백그라운드에서 작업"): 최소화하면 Page.captureScreenshot 이 멎지만(실험) 화면 밖(20000,20000) 창은 화면 사진·PDF·클릭·입력이 다 된다.
 * 탭마다 제 창(newWindow)을 열어 Target.activateTarget(사용자 창의 포커스를 뺏음) 없이도 그 탭이 제 창의 앞 탭이라 화면 사진이 된다. 사용자가 봐야 할 때(waitfor · end keep)만 showWindow 로 화면 안에 */
const OFF = { left: 20000, top: 20000 }, WIN = { width: 1280, height: 900 };
const hidden = () => !!(state && state.hidden);
async function newTarget(url, background) {
  const p = hidden() ? Object.assign({ url, newWindow: true, background: true }, WIN, OFF) : { url, newWindow: !!state.external && !state.tabs.length, background: !!background };
  const { targetId } = await C.send('Target.createTarget', p);
  return targetId;
}
async function showWindow(targetId) {   // 화면 밖·최소화된 창을 화면 안으로 옮기고 앞으로 (사용자가 로그인·추가 인증을 직접 할 때)
  try {
    const w = await C.send('Browser.getWindowForTarget', { targetId });
    const b = (w && w.bounds) || {};
    if (b.windowState === 'minimized') await C.send('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
    if (b.left >= 10000 || b.top >= 10000) await C.send('Browser.setWindowBounds', { windowId: w.windowId, bounds: { left: 80, top: 60 } });
    await C.send('Target.activateTarget', { targetId });
  } catch (e) {}
}
if (!state || !state.cdp) { console.log('오류: 작업 상태(state.json)가 없습니다 — site-fetch 가 만든 작업 폴더에서만 씁니다'); process.exit(1); }
state.tabs = Array.isArray(state.tabs) ? state.tabs : [];
state.refFrame = state.refFrame && typeof state.refFrame === 'object' ? state.refFrame : {};
const saveState = () => fs.writeFileSync(STATE, JSON.stringify(state, null, 1));
let secret = null;
function getSecret() {
  if (secret) return secret;
  const f = process.env.KRX_FETCH_SECRET;
  secret = (f && readJson(f, null)) || { id: '', pw: '' };
  return secret;
}
/* 비밀번호가 출력·인자에 섞이지 않게: 출력은 가리고, 그 값을 인자로 받으면 거절 */
const pwOf = () => { const s = getSecret(); return String(s.pw || '').length >= 3 ? String(s.pw) : ''; };
const redact = (s) => { const pw = pwOf(); let t = String(s == null ? '' : s); if (pw) t = t.split(pw).join('••••'); return t; };
const say = (s) => console.log(redact(s));
function die(msg) { say(`오류: ${msg}`); process.exit(1); }

const BLOCK_HOST = /(^|\.)krs\.co\.kr$|(^|\.)rcms\.go\.kr$|^localhost$|^127\.\d+\.\d+\.\d+$|^\[?::1\]?$|^0\.0\.0\.0$/i;
function checkUrl(u) {
  let x;
  try { x = new URL(u); } catch (e) { die(`주소가 올바르지 않습니다: ${u}`); }
  if (x.href === 'about:blank') return x.href;
  if (!/^https?:$/.test(x.protocol)) die(`http(s) 주소만 열 수 있습니다: ${x.protocol}`);
  if (BLOCK_HOST.test(x.hostname)) die(`이 작업에서는 ${x.hostname} 으로 갈 수 없습니다 (회사 시스템·이 PC)`);
  return x.href;
}
const blockedUrl = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) && BLOCK_HOST.test(x.hostname); } catch (e) { return false; } };

/* ---------- CDP (브라우저 엔드포인트 하나 + flatten 세션) ---------- */
async function connect() {
  let ver;
  try { ver = await (await fetch(`${state.cdp}/json/version`, { signal: AbortSignal.timeout(5000) })).json(); }
  catch (e) { die(`브라우저(${state.cdp})에 연결할 수 없습니다 — 작업용 Chrome 창이 닫혔을 수 있습니다`); }
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  const pending = new Map(), listeners = [];
  let seq = 0;
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('CDP 소켓을 열지 못했습니다')); setTimeout(() => rej(new Error('CDP 소켓이 열리지 않습니다')), 8000); }).catch((e) => die(e.message));
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); if (m.error) p.rej(new Error(m.error.message)); else p.res(m.result); return; }
    if (m.method) for (const l of listeners.slice()) if (l.method === m.method && (!l.session || l.session === m.sessionId)) l.fn(m.params || {}, m.sessionId);
  };
  const send = (method, params = {}, sessionId, ms = 20000) => new Promise((res, rej) => {
    const id = ++seq;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
    setTimeout(() => { if (pending.delete(id)) rej(new Error(`${method} 응답 없음 (${ms / 1000}초) — 확인창이 떠 있으면 dialog ok|cancel`)); }, ms);
  });
  const on = (method, fn, session) => { const l = { method, fn, session }; listeners.push(l); return () => { const i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); }; };
  return { send, on, close: () => { try { ws.close(); } catch (e) {} } };
}
let C = null;
const pages = async () => ((await C.send('Target.getTargets')).targetInfos || []).filter((t) => t.type === 'page');
/* 이 작업의 탭: state.tabs 중 살아 있는 것 + 그 탭들이 연 새 탭(openerId). adopt: 동작 전에 없던 탭도 이 작업 것으로 (작업용 Chrome 에서만) */
async function myTabs(adoptSince) {
  const all = await pages();
  const ids = new Set(all.map((t) => t.targetId));
  let changed = false;
  state.tabs = state.tabs.filter((id) => { const ok = ids.has(id); if (!ok) changed = true; return ok; });
  for (const t of all) {
    if (state.tabs.includes(t.targetId)) continue;
    const mine = (t.openerId && state.tabs.includes(t.openerId)) || (adoptSince && !state.external && !adoptSince.has(t.targetId));
    if (mine) { state.tabs.push(t.targetId); changed = true; }
  }
  if (!state.tabs.includes(state.cur)) { state.cur = state.tabs[state.tabs.length - 1] || ''; changed = true; }
  if (changed) saveState();
  return state.tabs.map((id) => all.find((t) => t.targetId === id)).filter(Boolean);
}
let S = '';                   // 지금 탭 세션
const FR = new Map();         // 다른 출처 프레임: targetId → { sid, url }
const dialogs = [];
async function attach(targetId) {
  const { sessionId } = await C.send('Target.attachToTarget', { targetId, flatten: true });
  S = sessionId;
  FR.clear();
  C.on('Page.javascriptDialogOpening', (p) => {
    dialogs.push(`${p.type}: ${clip(p.message, 200)}`);
    if (p.type === 'alert' || p.type === 'beforeunload') C.send('Page.handleJavaScriptDialog', { accept: true }, S).catch(() => {});
  }, S);
  await C.send('Page.enable', {}, S).catch(() => {});
  if (hidden()) await C.send('Emulation.setFocusEmulationEnabled', { enabled: true }, S).catch(() => {});   // 화면 밖 창도 페이지가 포커스를 가진 것처럼 (document.hasFocus · focus 이벤트 — 입력칸 스크립트가 포커스를 보는 사이트)
  // 다른 출처 iframe(OOPIF)에 붙기 — 이벤트로 세션이 온다(그 안의 iframe 도 한 단계 더)
  const onAttach = (p) => {
    const ti = p.targetInfo || {};
    if (ti.type !== 'iframe') { C.send('Runtime.runIfWaitingForDebugger', {}, p.sessionId).catch(() => {}); return; }
    FR.set(ti.targetId, { sid: p.sessionId, url: ti.url || '' });
    C.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true }, p.sessionId).catch(() => {});
  };
  C.on('Target.attachedToTarget', onAttach);
  await C.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true }, S).catch(() => {});
  await sleep(150);
  return S;
}
async function current() {
  const tabs = await myTabs();
  if (!tabs.length) die('이 작업의 탭이 없습니다 — open <주소> 로 여세요');
  const t = tabs.find((x) => x.targetId === state.cur) || tabs[tabs.length - 1];
  await attach(t.targetId);
  return t;
}
async function evaluate(fn, arg, ms, sid, gesture) {
  const expression = `(${fn.toString()})(${JSON.stringify(arg === undefined ? null : arg)})`;
  const r = await C.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: !!gesture }, sid || S, ms || 15000);
  if (r.exceptionDetails) throw new Error(clip((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text, 300));
  return r.result.value;
}
/* 화면이 가라앉을 때까지: readyState complete + 주소가 0.6초 그대로 (최대 ms). 이동 중 평가 실패는 다시 */
async function settle(ms = 15000) {
  const t0 = Date.now();
  let last = '', same = 0;
  await sleep(500);
  while (Date.now() - t0 < ms) {
    let st = null;
    try { st = await evaluate(() => ({ rs: document.readyState, u: location.href }), null, 3000); } catch (e) { st = null; }
    if (st && st.rs === 'complete' && st.u === last) { if (++same >= 2) break; } else same = 0;
    last = st ? st.u : '';
    await sleep(300);
  }
}

/* ---------- 페이지에 넣는 함수 (자기 완결) ---------- */
function pageLook(a) {
  const vis = (el) => { const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; const s = el.ownerDocument.defaultView.getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05; };
  const docs = [];
  const frames = [];
  const walk = (doc, depth) => {
    docs.push(doc);
    if (depth > 3) return;
    for (const f of doc.querySelectorAll('iframe,frame')) {
      let d = null; try { d = f.contentDocument; } catch (e) { d = null; }
      if (d && d.documentElement) walk(d, depth + 1);
      else if (f.src && vis(f)) frames.push(f.src);
    }
  };
  walk(document, 0);
  const sel = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=link],[role=tab],[role=menuitem],[role=menuitemradio],[role=checkbox],[role=radio],[role=option],[role=gridcell] [tabindex],[onclick],[contenteditable=""],[contenteditable=true]';
  const q = String(a.find || '').toLowerCase();
  const out = [];
  let n = a.start || 0, total = 0;
  for (const d of docs) for (const e of d.querySelectorAll('[data-krx-ref]')) e.removeAttribute('data-krx-ref');
  // 열린 창(모달·dialog)이 있으면 그 안의 요소를 먼저, 그다음 화면에 보이는 것, 나머지 순 (로그인 창이 목록 뒤로 밀려 잘리지 않게)
  const dlgs = Array.from(document.querySelectorAll('[role=dialog],[role=alertdialog],[aria-modal=true],dialog[open]')).filter(vis);
  const rank = (el) => (dlgs.some((x) => x.contains(el)) ? 0 : (() => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight ? 1 : 2; })());
  const name = (el) => {
    const t = (el.getAttribute('aria-label') || el.innerText || el.value || el.getAttribute('title') || el.getAttribute('alt') || el.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim();
    if (t) return t;
    const img = el.querySelector && el.querySelector('img[alt],svg[aria-label],[title]');
    return img ? (img.getAttribute('alt') || img.getAttribute('aria-label') || img.getAttribute('title') || '') : '';
  };
  const cands = [];
  for (const d of docs) for (const el of d.querySelectorAll(sel)) if (vis(el) && !el.closest('[aria-hidden=true]')) cands.push([d === document ? rank(el) : 1, cands.length, el]);
  cands.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  for (const [, , el] of cands) {
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') || '').toLowerCase();
    let label;
    if (tag === 'input' || tag === 'textarea') {
      const lab = (el.labels && el.labels[0] && el.labels[0].innerText) || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name') || el.id || '';
      const val = type === 'password' ? (el.value ? '(입력됨)' : '') : (type === 'checkbox' || type === 'radio') ? (el.checked ? '[체크됨]' : '[ ]') : (el.value ? `값="${String(el.value).slice(0, 40)}"` : '');
      label = `${tag}${type ? ` type=${type}` : ''} "${lab.replace(/\s+/g, ' ').trim().slice(0, 50)}"${val ? ' ' + val : ''}`;
    } else if (tag === 'select') {
      const o = el.selectedOptions && el.selectedOptions[0];
      label = `select "${(el.getAttribute('aria-label') || el.name || '').slice(0, 30)}" 고른 것="${o ? o.text.trim().slice(0, 30) : ''}" (${el.options.length}개: ${Array.from(el.options).slice(0, 8).map((x) => x.text.trim().slice(0, 16)).join(' / ')})`;
    } else {
      const role = el.getAttribute('role') || (tag === 'a' ? 'link' : tag);
      label = `${role} "${name(el).slice(0, 70)}"`;
      const href = tag === 'a' ? el.getAttribute('href') : '';
      if (href && !/^javascript:|^#$/i.test(href)) label += ` → ${href.length > 90 ? href.slice(0, 89) + '…' : href}`;
      if (el.getAttribute('target') === '_blank') label += ' (새 탭)';
      if (el.getAttribute('download') != null) label += ' (내려받기)';
    }
    if (el.disabled) label += ' (비활성)';
    total++;
    if (q && !label.toLowerCase().includes(q)) continue;
    if (n - (a.start || 0) >= a.max) continue;
    n++;
    el.setAttribute('data-krx-ref', String(n));
    out.push(`[${n}] ${a.tag ? a.tag + ' ' : ''}${label}`);
  }
  let text = dlgs.length ? `[열린 창] ${dlgs.map((x) => x.innerText).join('\n')}\n[페이지]\n` : '';
  for (const d of docs) { try { text += (d.body ? d.body.innerText : '') + '\n'; } catch (e) {} }
  text = text.replace(/[ \t ]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  if (q) text = text.split('\n').filter((l) => l.toLowerCase().includes(q)).join('\n');
  const isPdf = document.contentType === 'application/pdf';
  return { url: location.href, title: document.title, pdf: isPdf, text: text.slice(a.from || 0, (a.from || 0) + a.len), textLen: text.length, els: out, last: n, total, frames: frames.slice(0, 6), sy: Math.round(scrollY), sh: Math.round(document.documentElement.scrollHeight), vh: innerHeight };
}
function pageFind(a) {   // 번호 → 요소 (같은 출처 프레임 안까지). 화면 가운데로 옮기고 누를 점·가림 여부
  const docs = [];
  const walk = (doc, ox, oy) => { docs.push([doc, ox, oy]); for (const f of doc.querySelectorAll('iframe,frame')) { try { const d = f.contentDocument; if (d && d.documentElement) { const r = f.getBoundingClientRect(); walk(d, ox + r.left + f.clientLeft, oy + r.top + f.clientTop); } } catch (e) {} } };
  walk(document, 0, 0);
  for (const [d, ox, oy] of docs) {
    const el = d.querySelector(`[data-krx-ref="${a.ref}"]`);
    if (!el) continue;
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    if (a.op === 'focus') {
      el.focus();
      try { if (el.select) el.select(); } catch (e) {}
      try { if (el.isContentEditable) { const r = d.createRange(); r.selectNodeContents(el); const s = d.getSelection(); s.removeAllRanges(); s.addRange(r); } } catch (e) {}
      if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.value) { try { el.setSelectionRange(0, el.value.length); } catch (e) { el.value = ''; } }
      return { ok: true, tag: el.tagName.toLowerCase(), type: el.type || '' };
    }
    if (a.op === 'value') return { ok: true, value: el.value == null ? el.innerText : el.value, type: el.type || '' };
    if (a.op === 'setvalue') {   // insertText 가 먹지 않는 칸: 값 직접 + input/change
      const proto = el.tagName === 'TEXTAREA' ? d.defaultView.HTMLTextAreaElement.prototype : d.defaultView.HTMLInputElement.prototype;
      const set = Object.getOwnPropertyDescriptor(proto, 'value').set;
      set.call(el, a.text); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true };
    }
    if (a.op === 'select') {
      const want = String(a.text).trim().toLowerCase();
      const o = Array.from(el.options || []).find((x) => x.text.trim().toLowerCase() === want || x.value.toLowerCase() === want) || Array.from(el.options || []).find((x) => x.text.toLowerCase().includes(want));
      if (!o) return { ok: false, error: '그 항목이 없습니다' };
      el.value = o.value; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true, text: o.text.trim() };
    }
    if (a.op === 'jsclick') { el.click(); return { ok: true }; }
    if (a.op === 'show') return { ok: true };
    // 누를 점: 가운데부터 몇 군데를 찍어 보아 그 요소(나 그 안)가 맨 위인 곳 — 카드 위에 다른 요소가 덮인 경우
    const r = el.getBoundingClientRect();
    const pts = [[0.5, 0.5], [0.5, 0.2], [0.2, 0.5], [0.8, 0.5], [0.5, 0.8], [0.15, 0.15], [0.85, 0.85]];
    const hitOk = (x, y) => { const h = d.elementFromPoint(x, y); return !!h && (h === el || el.contains(h)); };
    let pick = null;
    for (const [fx, fy] of pts) { const x = r.left + r.width * fx, y = r.top + Math.min(r.height * fy, r.height - 2); if (x >= 0 && y >= 0 && x <= d.defaultView.innerWidth && y <= d.defaultView.innerHeight && hitOk(x, y)) { pick = [x, y]; break; } }
    return { ok: true, x: pick ? ox + pick[0] : 0, y: pick ? oy + pick[1] : 0, hit: !!pick, tag: el.tagName.toLowerCase(), href: el.tagName === 'A' ? el.href : '', blank: el.getAttribute && el.getAttribute('target') === '_blank' };
  }
  return { ok: false, error: `[${a.ref}] 요소가 없습니다 — 화면이 바뀌었으면 look 을 다시` };
}
async function pageFetch(u) {   // 로그인된 상태로 그 주소를 받아 base64 (같은 출처이거나 CORS 가 허용될 때)
  const r = await fetch(u, { credentials: 'include' });
  const b = await r.blob();
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return { ok: r.ok, status: r.status, type: b.type || r.headers.get('content-type') || '', disp: r.headers.get('content-disposition') || '', b64: btoa(s), size: buf.length };
}

/* ---------- 저장 ---------- */
const manifest = () => readJson(MANIFEST, []);
const stamp = () => { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; };
const safe = (s, n) => String(s || '').replace(/[\\/:*?"<>|\r\n\t]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, n || 40);
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, '') || 'page'; } catch (e) { return 'page'; } };
const EXT_MIME = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', zip: 'application/zip', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', hwp: 'application/x-hwp', csv: 'text/csv' };
const BAD_EXT = /^(exe|bat|cmd|js|mjs|jsp|html?|sh|php|class|ini|msi|ps1|vbs|jsv)$/i;   // 첨부(파일등록 팝업)가 받지 않거나 위험한 것
const extOfMime = (m) => { m = String(m || '').toLowerCase(); return m.includes('pdf') ? 'pdf' : m.includes('png') ? 'png' : m.includes('jpeg') || m.includes('jpg') ? 'jpg' : m.includes('gif') ? 'gif' : m.includes('webp') ? 'webp' : ''; };
const nameOfDisp = (disp) => { const m = /filename\*=(?:UTF-8'')?([^;]+)|filename="?([^";]+)"?/i.exec(String(disp || '')); try { return m ? decodeURIComponent(String(m[1] || m[2]).trim().replace(/^"|"$/g, '')) : ''; } catch (e) { return m ? String(m[1] || m[2]) : ''; } };
function record(kind, buf, ext, info) {
  const k = safe(kind, 20);
  if (!k) die('종류를 적으세요 (예: 거래명세서)');
  if (!buf || !buf.length) die('저장할 내용이 비어 있습니다');
  fs.mkdirSync(OUT, { recursive: true });
  const site = safe(hostOf(info.page || info.url || state.site || ''), 40);   // page: 내려받은 파일이면 그 화면의 사이트(받은 주소는 저장소 호스트일 수 있음)
  const st = stamp();
  let file = `${k}_${site}_${st}.${ext}`;
  for (let i = 2; fs.existsSync(path.join(OUT, file)); i++) file = `${k}_${site}_${st}_${i}.${ext}`;
  fs.writeFileSync(path.join(OUT, file), buf);
  const m = manifest().filter((x) => x.file !== file);
  m.push({ file, kind: k, base: safe(info.base, 120) || `capture_${site}_${st}.${ext}`, how: info.how, url: String(info.url || '').slice(0, 300), title: clip(info.title, 120), note: clip(info.note, 200), bytes: buf.length, mime: EXT_MIME[ext] || 'application/octet-stream', ts: Date.now() });
  fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 1));
  return { file, bytes: buf.length };
}
const kb = (n) => n >= 1048576 ? `${(n / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`;

/* ---------- 명령 ---------- */
async function report(prefix) {
  let st = null;
  try { st = await evaluate(() => ({ u: location.href, t: document.title }), null, 4000); } catch (e) {}
  const tabs = state.tabs.length;
  say(`${prefix || ''}${st ? `${st.u} · ${clip(st.t, 80)}` : '(화면을 읽지 못함)'}${tabs > 1 ? ` · 탭 ${state.tabs.indexOf(state.cur) + 1}/${tabs}` : ''}`);
  if (dialogs.length) say(`창: ${dialogs.join(' / ')}${dialogs.some((d) => /^(confirm|prompt)/.test(d)) ? ' — 닫으려면 dialog ok|cancel' : ''}`);
}
/* 지금 탭 + 다른 출처 프레임들을 읽는다 → { main, frames: [{ targetId, url, r }] } 그리고 프레임 요소의 번호 → 프레임(state.refFrame) */
async function lookAll(opts) {
  const main = await evaluate(pageLook, Object.assign({ start: 0, max: MAX_ELEMS }, opts), 15000);
  const frames = [];
  const refFrame = {};
  let last = main.last;
  for (const [targetId, f] of FR) {
    if (blockedUrl(f.url) || !/^https?:/.test(f.url)) continue;
    let r = null;
    try { r = await evaluate(pageLook, Object.assign({}, opts, { start: last, max: Math.max(0, MAX_ELEMS - (last - main.last) - (last ? 0 : 0)), tag: `(프레임 ${hostOf(f.url)})`, from: 0 }), 10000, f.sid); } catch (e) { r = null; }
    if (!r) continue;
    for (let i = last + 1; i <= r.last; i++) refFrame[i] = targetId;
    last = r.last;
    frames.push({ targetId, url: f.url, r });
  }
  state.refFrame = refFrame; saveState();
  return { main, frames };
}
async function cmdLook(find) {
  const t = await current();
  let all;
  try { all = await lookAll({ find: find || '', from: 0, len: TEXT_HEAD }); } catch (e) { die(`화면을 읽지 못했습니다: ${e.message}`); }
  const r = all.main;
  const out = [`주소: ${r.url}`, `제목: ${clip(r.title, 120)}`];
  const tabs = state.tabs.length;
  if (tabs > 1) out.push(`탭: ${state.tabs.indexOf(t.targetId) + 1}/${tabs} (tabs 로 목록)`);
  if (dialogs.length) out.push(`창: ${dialogs.join(' / ')}`);
  if (r.pdf) { out.push('이 탭은 PDF 문서입니다 — pdf <종류> 로 그대로 저장할 수 있습니다 (내용 확인은 shot)'); say(out.join('\n')); return; }
  out.push(`스크롤: ${r.sy}/${Math.max(0, r.sh - r.vh)}px`);
  const more = r.textLen > TEXT_HEAD;
  out.push(`--- 본문${find ? ` ("${find}" 든 줄)` : ''} (${Math.min(r.textLen, TEXT_HEAD)} / ${r.textLen}자${more ? ` — 이어서: text ${TEXT_HEAD}` : ''}) ---`);
  out.push(r.text || '(본문 글 없음)');
  for (const f of all.frames) if (f.r.text) out.push(`--- 프레임 ${hostOf(f.url)} 본문 (${Math.min(f.r.textLen, TEXT_HEAD)} / ${f.r.textLen}자) ---\n${f.r.text}`);
  const els = r.els.concat(...all.frames.map((f) => f.r.els));
  const total = r.total + all.frames.reduce((s, f) => s + f.r.total, 0);
  out.push(`--- 누를 수 있는 것 ${els.length}개${total > els.length ? ` (전체 ${total}개 중${find ? '' : ' — 나머지는 look <글자> 로 좁히기'})` : ''} ---`);
  out.push(els.join('\n') || '(없음)');
  const unread = r.frames.filter((u) => !all.frames.some((f) => f.url === u));
  if (unread.length) out.push(`--- 읽지 못한 프레임 (그 주소로 go 하면 직접 다룰 수 있음) ---\n${unread.join('\n')}`);
  say(out.join('\n'));
}
async function cmdText(from) {
  await current();
  const r = await evaluate(pageLook, { find: '', from, len: TEXT_PAGE, max: 0, start: 0 }, 15000);
  let text = r.text, len = r.textLen;
  if (from >= r.textLen) {   // 본문이 다 끝났으면 프레임 본문을 이어서
    let off = from - r.textLen;
    for (const [, f] of FR) {
      let x = null; try { x = await evaluate(pageLook, { find: '', from: Math.max(0, off), len: TEXT_PAGE, max: 0, start: 0 }, 10000, f.sid); } catch (e) {}
      if (!x) continue;
      if (off < x.textLen) { text = `(프레임 ${hostOf(f.url)}) ${x.text}`; len = r.textLen + x.textLen; break; }
      off -= x.textLen;
    }
  }
  say(`--- 본문 ${from}~${from + text.length} / ${len}자${len > from + TEXT_PAGE ? ` — 이어서: text ${from + TEXT_PAGE}` : ''} ---\n${text}`);
}
async function cmdShot() {
  await current();
  const r = await C.send('Page.captureScreenshot', { format: 'jpeg', quality: 60 }, S, 20000);
  fs.writeFileSync(VIEW, Buffer.from(r.data, 'base64'));
  say(`view.jpg 에 찍었습니다 — Read 도구로 view.jpg 를 열어 보세요`);
}
async function navigate(url) {
  await C.send('Page.navigate', { url }, S, 30000).catch((e) => die(`이동 실패: ${e.message}`));
  await settle(30000);
}
async function cmdOpen(url) {
  url = checkUrl(url);
  await myTabs();
  const targetId = await newTarget('about:blank', false);
  state.tabs.push(targetId); state.cur = targetId; saveState();
  await attach(targetId);
  if (url !== 'about:blank') await navigate(url);
  await report('열림: ');
}
async function cmdGo(url) { url = checkUrl(url); await current(); await navigate(url); await report('→ '); }
const sidOf = (ref) => { const tid = state.refFrame[String(ref)]; const f = tid && FR.get(tid); if (tid && !f) die(`[${ref}] 가 있던 프레임이 사라졌습니다 — look 을 다시`); return f ? f.sid : S; };
async function find(ref, op, extra, gesture) {
  if (!/^\d+$/.test(String(ref || ''))) die(`요소 번호를 주세요 (look 의 [번호]): ${ref}`);
  const r = await evaluate(pageFind, Object.assign({ ref: String(ref), op }, extra || {}), 10000, sidOf(ref), gesture);
  if (!r || !r.ok) die((r && r.error) || `[${ref}] 요소를 찾지 못했습니다`);
  return r;
}
async function mouseClick(x, y) {
  await C.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' }, S);
  await C.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 }, S);
  await C.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 }, S);
}
/* 누른 뒤: 새 탭이 열렸으면 그 탭으로, 아니면 지금 탭이 가라앉을 때까지 */
async function afterAction(beforeAll) {
  await sleep(400);
  const known = new Set(state.tabs);
  let fresh = [];
  for (let i = 0; i < 6; i++) {
    const tabs = await myTabs(beforeAll);
    fresh = tabs.filter((t) => !known.has(t.targetId));
    if (fresh.length) break;
    await sleep(250);
  }
  if (fresh.length) {
    const t = fresh[fresh.length - 1];
    if (blockedUrl(t.url)) { await C.send('Target.closeTarget', { targetId: t.targetId }).catch(() => {}); die('새 탭이 회사 시스템·이 PC 주소라 닫았습니다'); }
    state.cur = t.targetId; saveState();
    await attach(t.targetId);
    await settle(20000);
    return report('(새 탭으로 옮김) ');
  }
  await settle(15000);
  return report('→ ');
}
const allPageIds = async () => new Set((await pages()).map((t) => t.targetId));
/* 다른 출처 프레임(OOPIF)의 화면 위치: 그 iframe 요소(프레임 주인)의 내용 상자 왼쪽 위 — 프레임 안 좌표에 더하면 페이지 좌표. 못 구하면 null */
async function frameOffset(targetId) {
  try {
    await C.send('DOM.enable', {}, S).catch(() => {});
    const { backendNodeId } = await C.send('DOM.getFrameOwner', { frameId: targetId }, S, 5000);
    const { model } = await C.send('DOM.getBoxModel', { backendNodeId }, S, 5000);
    const q = model && model.content;
    return q ? { x: q[0], y: q[1], w: model.width, h: model.height } : null;
  } catch (e) { return null; }
}
async function clickRef(ref) {
  const tid = state.refFrame[String(ref)];
  const inFrame = !!tid;
  const r = await find(ref, 'point');
  if (!inFrame && r.hit) { await mouseClick(r.x, r.y); return ''; }
  if (inFrame && r.hit) {   // 프레임 안: 진짜 마우스로 (pointerdown 으로 동작하는 그리드·메뉴 — Azure 인보이스 등. 스크립트 click() 은 무시되곤 함)
    const o = await frameOffset(tid);
    const vp = o && await evaluate(() => ({ w: innerWidth, h: innerHeight }), null, 3000).catch(() => null);
    const x = o && o.x + r.x, y = o && o.y + r.y;
    if (o && vp && x >= 0 && y >= 0 && x <= vp.w && y <= vp.h) { await mouseClick(x, y); return ''; }
  }
  if (!inFrame && /^https?:/i.test(r.href || '') && !blockedUrl(r.href)) {   // 덮인 링크(마우스를 올리면 뜨는 미리보기 카드 등): 그 주소로 바로 — 새 탭 링크면 새 탭으로
    if (r.blank && !state.external) { const targetId = await newTarget(r.href, false); state.tabs.push(targetId); state.cur = targetId; saveState(); await attach(targetId); }   // 평소 브라우저(external)에서는 새 탭이 사용자 창에 열리지 않게 지금 탭에서
    else if (r.blank) await C.send('Page.navigate', { url: r.href }, S, 30000);
    else await C.send('Page.navigate', { url: r.href }, S, 30000);
    return '(다른 요소에 덮여 있어 링크 주소로 바로 엶)';
  }
  await find(ref, 'jsclick', null, true);   // 다른 출처 프레임 안이거나 다른 요소에 덮인 것: 그 프레임에서 사용자 동작으로 친 스크립트 클릭(새 탭이 막히지 않게)
  return inFrame ? '(프레임 안이라 스크립트로 누름)' : '(다른 요소에 덮여 있어 스크립트로 누름)';
}
async function cmdClick(ref) {
  await current();
  const before = await allPageIds();
  const note = await clickRef(ref);
  if (note) say(note);
  await afterAction(before);
}
async function insert(ref, text, quiet) {
  const f = await find(ref, 'focus');
  if (f.type === 'file') die('파일 칸은 다룰 수 없습니다');
  await C.send('Input.insertText', { text }, S);   // 포커스가 있는 프레임으로 간다
  await sleep(120);
  const v = await find(ref, 'value');
  if (String(v.value || '') !== text) await find(ref, 'setvalue', { text });
  if (!quiet) say(`[${ref}] 에 넣었습니다`);
}
function refuseSecret(args) { const pw = pwOf(); if (pw && args.some((a) => String(a).includes(pw))) die('비밀번호는 인자로 넘길 수 없습니다 — login 명령을 쓰세요'); }
async function cmdLogin(idRef, pwRef) {
  const s = getSecret();
  if (!s.id && !s.pw) die('등록된 아이디·비밀번호가 없습니다 — 사용자가 열린 Chrome 창에서 직접 로그인해야 합니다(waitfor 로 기다리거나 missing 에 "로그인 정보 없음")');
  await current();
  const done = [];
  if (idRef && idRef !== '-') { if (!s.id) die('등록된 아이디가 없습니다'); await insert(idRef, String(s.id), true); done.push(`아이디 → [${idRef}]`); }
  if (pwRef && pwRef !== '-') {
    if (!s.pw) die('등록된 비밀번호가 없습니다');
    const f = await find(pwRef, 'focus');
    if (f.type !== 'password') die(`[${pwRef}] 는 비밀번호 칸(type=password)이 아닙니다 (${f.tag}${f.type ? ' type=' + f.type : ''})`);
    await insert(pwRef, String(s.pw), true); done.push(`비밀번호 → [${pwRef}]`);
  }
  if (!done.length) die('넣을 칸 번호를 주세요 (login <아이디칸> <비밀번호칸>)');
  say(`${done.join(', ')} 넣었습니다 (값은 보이지 않음). 이제 로그인 버튼을 click 하거나 key Enter`);
}
const KEYS = { Enter: [13, '\r'], Tab: [9], Escape: [27], Space: [32, ' '], PageDown: [34], PageUp: [33], ArrowDown: [40], ArrowUp: [38], ArrowLeft: [37], ArrowRight: [39], Backspace: [8], Home: [36], End: [35] };
async function cmdKey(name) {
  const k = Object.keys(KEYS).find((x) => x.toLowerCase() === String(name || '').toLowerCase());
  if (!k) die(`모르는 키: ${name} (${Object.keys(KEYS).join(', ')})`);
  await current();
  const before = await allPageIds();
  const [code, text] = KEYS[k];
  const base = { key: k === 'Space' ? ' ' : k, code: k === 'Space' ? 'Space' : k, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code };
  await C.send('Input.dispatchKeyEvent', Object.assign({ type: text ? 'keyDown' : 'rawKeyDown' }, base, text ? { text } : {}), S);
  await C.send('Input.dispatchKeyEvent', Object.assign({ type: 'keyUp' }, base), S);
  await afterAction(before);
}
async function cmdScroll(where) {
  await current();
  const w = String(where || 'down');
  if (/^\d+$/.test(w)) { await find(w, 'show'); say(`[${w}] 가 보이게 옮겼습니다`); return; }
  const fn = (d) => {
    const se = document.scrollingElement || document.documentElement;
    let el = se;
    if (se.scrollHeight <= se.clientHeight + 4) {   // 문서가 안 움직이면 가장 큰 스크롤 영역
      let best = 0;
      for (const x of document.querySelectorAll('*')) { if (x.scrollHeight > x.clientHeight + 20 && x.clientHeight > 120) { const oy = getComputedStyle(x).overflowY; if (oy === 'auto' || oy === 'scroll') { const a = x.clientWidth * x.clientHeight; if (a > best) { best = a; el = x; } } } }
    }
    const h = el.clientHeight * 0.85;
    if (d === 'top') el.scrollTop = 0; else if (d === 'bottom') el.scrollTop = el.scrollHeight; else el.scrollTop += d === 'up' ? -h : h;
    return { y: Math.round(el.scrollTop), max: Math.round(el.scrollHeight - el.clientHeight) };
  };
  let r = await evaluate(fn, w);
  if (r.max <= 0) for (const [, f] of FR) { try { const x = await evaluate(fn, w, 5000, f.sid); if (x.max > 0) { r = Object.assign(x, { frame: hostOf(f.url) }); break; } } catch (e) {} }   // 그리드가 프레임 안에서 스크롤되는 화면
  await sleep(400);
  say(`스크롤 ${r.y}/${r.max}px${r.frame ? ` (프레임 ${r.frame})` : ''}`);
}
async function cmdTabs() {
  const tabs = await myTabs();
  say(tabs.map((t, i) => `${i + 1}. ${t.targetId === state.cur ? '▶ ' : ''}${t.url} · ${clip(t.title, 60)}`).join('\n') || '(탭 없음)');
}
async function cmdTab(n) {
  const tabs = await myTabs();
  const t = tabs[Number(n) - 1];
  if (!t) die(`${n}번 탭이 없습니다 (tabs 로 목록)`);
  state.cur = t.targetId; saveState();
  await attach(t.targetId);
  if (!hidden()) await C.send('Target.activateTarget', { targetId: t.targetId }).catch(() => {});   // 화면 밖 모드는 탭마다 제 창이라 앞으로 올릴 필요가 없고, 올리면 사용자 창의 포커스를 뺏는다
  await report('→ ');
}
async function cmdCloseTab() {
  const t = await current();
  if (state.tabs.length <= 1) die('마지막 탭은 닫지 않습니다');
  await C.send('Target.closeTarget', { targetId: t.targetId });
  state.tabs = state.tabs.filter((x) => x !== t.targetId); state.cur = state.tabs[state.tabs.length - 1]; saveState();
  await attach(state.cur);
  await report('닫음 → ');
}
async function cmdWaitFor(text, sec) {
  await current();
  const want = String(text || '').toLowerCase();
  if (!want) die('기다릴 글자를 주세요');
  const until = Date.now() + Math.min(300, Math.max(5, Number(sec) || 120)) * 1000;
  await showWindow(state.cur);   // 사용자가 그 창에서 인증해야 하니 화면 밖·최소화된 창을 화면 안으로, 탭을 앞으로
  const has = (w) => (document.body ? document.body.innerText : '').toLowerCase().includes(w) || location.href.toLowerCase().includes(w);
  while (Date.now() < until) {
    await myTabs();
    for (const id of state.tabs) {
      try {
        await attach(id);
        let hit = await evaluate(has, want, 4000);
        for (const [, f] of FR) { if (hit) break; try { hit = await evaluate(has, want, 3000, f.sid); } catch (e) {} }
        if (hit) { state.cur = id; saveState(); return report('나옴: '); }
      } catch (e) {}
    }
    await sleep(2000);
  }
  if (state.cur) await attach(state.cur).catch(() => {});
  await report(`"${text}" 가 나오지 않았습니다 (시간 초과) — 지금: `);
}
async function cmdEval(expr) {
  await current();
  const r = await C.send('Runtime.evaluate', { expression: String(expr || ''), awaitPromise: true, returnByValue: true }, S, 20000);
  if (r.exceptionDetails) die(clip((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text, 400));
  const v = r.result.value !== undefined ? r.result.value : r.result.description;
  const s = typeof v === 'string' ? v : JSON.stringify(v, null, 1);
  say(String(s == null ? 'undefined' : s).slice(0, 6000));
}
async function savePdfTab(kind, note, info) {   // PDF 를 보여 주는 탭: 원본 PDF 를 그대로
  const r = await evaluate(pageFetch, info.u, 60000).catch((e) => die(`PDF 를 받지 못했습니다: ${e.message}`));
  if (!r.ok) die(`PDF 를 받지 못했습니다 (HTTP ${r.status})`);
  let base = nameOfDisp(r.disp); try { base = base || decodeURIComponent(path.basename(new URL(info.u).pathname)); } catch (e) {}
  const x = record(kind, Buffer.from(r.b64, 'base64'), 'pdf', { how: 'raw', url: info.u, title: info.t, note, base });
  say(`저장: ${x.file} (${kb(x.bytes)}, 원본 PDF)`);
}
async function cmdPdf(kind, note) {
  await current();
  const info = await evaluate(() => ({ u: location.href, t: document.title, pdf: document.contentType === 'application/pdf' }), null, 5000);
  if (info.pdf) return savePdfTab(kind, note, info);
  await C.send('Emulation.setEmulatedMedia', { media: 'print' }, S).catch(() => {});
  let r;
  try { r = await C.send('Page.printToPDF', { printBackground: true, preferCSSPageSize: false, paperWidth: 8.27, paperHeight: 11.69, marginTop: 0.35, marginBottom: 0.35, marginLeft: 0.35, marginRight: 0.35, scale: 0.9 }, S, 60000); }
  catch (e) { die(`PDF 로 만들지 못했습니다: ${e.message} — capture 를 쓰세요`); }
  finally { await C.send('Emulation.setEmulatedMedia', { media: '' }, S).catch(() => {}); }
  const x = record(kind, Buffer.from(r.data, 'base64'), 'pdf', { how: 'pdf', url: info.u, title: info.t, note });
  say(`저장: ${x.file} (${kb(x.bytes)}) — 내용이 맞는지 걱정되면 shot 으로 화면을 보세요`);
}
async function cmdCapture(kind, note) {
  await current();
  const info = await evaluate(() => ({ u: location.href, t: document.title }), null, 5000);
  const lm = await C.send('Page.getLayoutMetrics', {}, S);
  const cs = lm.cssContentSize || lm.contentSize, vv = lm.cssVisualViewport || lm.visualViewport;
  const w = Math.max(320, Math.ceil(Math.min(cs.width, 2400))), h = Math.max(200, Math.ceil(Math.min(cs.height, CAPTURE_MAX_H)));
  const shot = async (format, quality) => Buffer.from((await C.send('Page.captureScreenshot', Object.assign({ format, captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: h, scale: 1 } }, quality ? { quality } : {}), S, 60000)).data, 'base64');
  let buf = await shot('png'), ext = 'png';
  if (buf.length > TARGET_IMG) {   // 일부 과제의 첨부 규칙(jpg/png 500KB 이하)에 맞춰 JPEG 로 줄여 봄
    let keep = null;
    for (const q of [85, 70, 55]) { const j = await shot('jpeg', q); if (q === 85) keep = j; if (j.length <= TARGET_IMG) { keep = j; break; } }
    buf = keep; ext = 'jpg';
  }
  const x = record(kind, buf, ext, { how: 'capture', url: info.u, title: info.t, note });
  say(`저장: ${x.file} (${kb(x.bytes)}, ${w}×${h}px${cs.height > CAPTURE_MAX_H ? ` — 너무 길어 위에서 ${CAPTURE_MAX_H}px 까지` : ''}${vv && cs.height <= vv.clientHeight + 4 ? ' — 문서가 스크롤되지 않는 화면이면 보이는 부분만 찍혔을 수 있음(shot 으로 확인)' : ''})`);
}
/* 내려받기 지켜보기: trigger() 를 부른 뒤 Browser.downloadWillBegin → completed 를 기다려 out/dl/<guid> 를 서류로 저장 */
async function viaDownload(kind, trigger, note) {
  fs.mkdirSync(DL, { recursive: true });
  let begin = null, doneGuid = '', failed = '';
  C.on('Browser.downloadWillBegin', (p) => { if (!begin) begin = p; });
  C.on('Browser.downloadProgress', (p) => { if (begin && p.guid === begin.guid) { if (p.state === 'completed') doneGuid = p.guid; else if (p.state === 'canceled') failed = '내려받기가 취소됐습니다'; } });
  await C.send('Browser.setDownloadBehavior', { behavior: 'allowAndName', downloadPath: DL, eventsEnabled: true });
  let page = '';
  try { page = await evaluate(() => location.href, null, 3000); } catch (e) {}
  if (!/^https?:/.test(page)) page = state.site || '';
  try {
    await trigger();
    const t0 = Date.now();
    while (!doneGuid && !failed && Date.now() - t0 < 90000) { await sleep(300); if (!begin && Date.now() - t0 > 30000) break; }   // 서버가 PDF 를 만든 뒤 내려받기가 시작되는 사이트(Azure 인보이스 등)가 있어 시작은 30초까지 기다림
    if (!begin) return false;
    if (failed || !doneGuid) die(failed || '내려받기가 90초 안에 끝나지 않았습니다');
    const src = path.join(DL, begin.guid);
    if (!fs.existsSync(src)) die('받은 파일을 찾지 못했습니다');
    const name = String(begin.suggestedFilename || 'download');
    const ext = ((/\.([a-z0-9]{2,5})$/i.exec(name) || [])[1] || 'bin').toLowerCase();
    if (BAD_EXT.test(ext)) { try { fs.unlinkSync(src); } catch (e) {} die(`첨부할 수 없는 파일 종류입니다: ${name}`); }
    const x = record(kind, fs.readFileSync(src), ext === 'jpeg' ? 'jpg' : ext, { how: 'download', url: /^blob:/i.test(begin.url) ? page : begin.url, page, title: name, base: name, note });   // blob: 주소(인프런 수료증 pdf 등)는 다시 열 수 없으니 출처는 그 화면으로
    try { fs.unlinkSync(src); } catch (e) {}
    say(`저장: ${x.file} (${kb(x.bytes)}, 받은 파일 ${name})`);
    return true;
  } finally { await C.send('Browser.setDownloadBehavior', { behavior: 'default' }).catch(() => {}); }
}
async function cmdDownload(ref, kind) {
  await current();
  if (!kind) die('종류를 적으세요 (download <번호> <종류>)');
  const before = await allPageIds();
  const ok = await viaDownload(kind, async () => { const note = await clickRef(ref); if (note) say(note); });
  if (!ok) { await afterAction(before); die('누른 뒤 내려받기가 시작되지 않았습니다 (위 화면 참고 — PDF 를 탭에 보여 주면 그 탭에서 pdf <종류>, 화면이면 pdf)'); }
}
async function cmdSaveUrl(kind, url) {
  url = checkUrl(url);
  await current();
  let r = null;
  try { r = await evaluate(pageFetch, url, 60000); } catch (e) { r = null; }   // 다른 사이트 주소는 CORS 로 막힘 → 아래 내려받기로
  if (r && r.ok) {
    const ext = extOfMime(r.type) || ((/\.([a-z0-9]{2,5})(?:$|\?)/i.exec(url) || [])[1] || '').toLowerCase();
    if (!/^(pdf|png|jpg|jpeg|gif|webp)$/.test(ext)) die(`PDF·이미지가 아닙니다 (${r.type || '종류 모름'}) — 화면이면 go 로 연 뒤 pdf <종류>`);
    let base = nameOfDisp(r.disp); try { base = base || decodeURIComponent(path.basename(new URL(url).pathname)); } catch (e) {}
    const x = record(kind, Buffer.from(r.b64, 'base64'), ext === 'jpeg' ? 'jpg' : ext, { how: 'saveurl', url, title: base, base });
    say(`저장: ${x.file} (${kb(x.bytes)})`);
    return;
  }
  // 새 탭에서 그 주소를 연다: 내려받기면 받은 파일을, PDF 를 보여 주면 그 PDF 를 저장
  const targetId = await newTarget('about:blank', true);
  state.tabs.push(targetId); saveState();
  const prevCur = state.cur;
  await attach(targetId);
  const ok = await viaDownload(kind, () => C.send('Page.navigate', { url }, S, 30000).catch(() => {}));
  if (!ok) {
    await settle(15000);
    const info = await evaluate(() => ({ u: location.href, t: document.title, pdf: document.contentType === 'application/pdf' }), null, 5000).catch(() => null);
    if (info && info.pdf) await savePdfTab(kind, '', info);
    else { state.cur = targetId; saveState(); die(`PDF·내려받기가 아닌 화면입니다 — 새 탭(지금 탭)에 열어 두었으니 look 으로 보고 pdf <종류>`); }
  }
  await C.send('Target.closeTarget', { targetId }).catch(() => {});
  state.tabs = state.tabs.filter((x) => x !== targetId); state.cur = prevCur; saveState();
}
function cmdFiles() {
  const m = manifest();
  say(m.length ? m.map((x) => `${x.file} · ${x.kind} · ${kb(x.bytes)} · ${x.how}${x.note ? ` · ${x.note}` : ''}`).join('\n') : '(저장한 서류 없음)');
}
function cmdDrop(file) {
  const m = manifest();
  const hit = m.find((x) => x.file === file);
  if (!hit) die(`그 파일이 없습니다: ${file}`);
  try { fs.unlinkSync(path.join(OUT, file)); } catch (e) {}
  fs.writeFileSync(MANIFEST, JSON.stringify(m.filter((x) => x !== hit), null, 1));
  say(`뺐습니다: ${file}`);
}
/* index.js 전용: 작업을 마치며 탭을 닫음(keep 이면 남겨 사용자가 이어서 볼 수 있게) */
async function cmdEnd(keep) {
  const tabs = await myTabs();
  await C.send('Browser.setDownloadBehavior', { behavior: 'default' }).catch(() => {});
  if (keep) { for (const t of tabs) await showWindow(t.targetId); say(`탭 ${tabs.length}개를 남겨 둠`); return; }   // 남겨 둔 창은 사용자가 로그인·인증을 직접 하게 화면 안으로
  for (const t of tabs) await C.send('Target.closeTarget', { targetId: t.targetId }).catch(() => {});
  state.tabs = []; state.cur = ''; saveState();
  say(`탭 ${tabs.length}개를 닫음`);
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd || cmd === 'help' || cmd === '-h') { console.log(HELP); return; }
  refuseSecret(args);
  C = await connect();
  try {
    const lastNum = args.length > 1 && /^\d+$/.test(args[args.length - 1]);
    switch (cmd) {
      case 'look': await cmdLook(args.join(' ')); break;
      case 'text': await cmdText(Math.max(0, Number(args[0]) || 0)); break;
      case 'shot': await cmdShot(); break;
      case 'open': await cmdOpen(args.join(' ') || 'about:blank'); break;
      case 'go': await cmdGo(args.join(' ')); break;
      case 'click': await cmdClick(args[0]); break;
      case 'type': await current(); await insert(args[0], args.slice(1).join(' ')); break;
      case 'login': await cmdLogin(args[0], args[1]); break;
      case 'key': await cmdKey(args[0]); break;
      case 'select': { await current(); const r = await find(args[0], 'select', { text: args.slice(1).join(' ') }); await settle(8000); say(`[${args[0]}] → ${r.text}`); break; }
      case 'scroll': await cmdScroll(args[0]); break;
      case 'back': { await current(); const h = await C.send('Page.getNavigationHistory', {}, S); const e = h.entries[h.currentIndex - 1]; if (!e) die('뒤로 갈 곳이 없습니다'); await C.send('Page.navigateToHistoryEntry', { entryId: e.id }, S); await settle(); await report('← '); break; }
      case 'tabs': await cmdTabs(); break;
      case 'tab': await cmdTab(args[0]); break;
      case 'close': await cmdCloseTab(); break;
      case 'dialog': { await current(); await C.send('Page.handleJavaScriptDialog', { accept: !/^(cancel|no|취소)$/i.test(args[0] || '') }, S).catch((e) => die(`떠 있는 확인창이 없습니다 (${clip(e.message, 80)})`)); await settle(8000); await report('창 닫음 → '); break; }
      case 'wait': { const n = Number(args[0]) || 2; await sleep(Math.min(60, Math.max(0, n >= 1000 ? n / 1000 : n)) * 1000); await current(); await report(); break; }   // "wait 5000" 처럼 밀리초로 적은 것을 60초로 기다리던 일(2026-10-22 Azure 102초 중 60초) — 1000 이상은 밀리초
      case 'waitfor': await cmdWaitFor((lastNum ? args.slice(0, -1) : args).join(' '), lastNum ? args[args.length - 1] : 0); break;
      case 'eval': await cmdEval(args.join(' ')); break;
      case 'pdf': await cmdPdf(args[0], args.slice(1).join(' ')); break;
      case 'capture': await cmdCapture(args[0], args.slice(1).join(' ')); break;
      case 'download': await cmdDownload(args[0], args[1]); break;
      case 'saveurl': await cmdSaveUrl(args[0], args.slice(1).join(' ')); break;
      case 'files': cmdFiles(); break;
      case 'drop': cmdDrop(args.join(' ')); break;
      case 'end': await cmdEnd(args[0] === 'keep'); break;
      default: die(`모르는 명령: ${cmd}\n${HELP}`);
    }
  } finally { C.close(); }
}
main().then(() => process.exit(0), (e) => { say(`오류: ${(e && e.message) || e}`); process.exit(1); });
