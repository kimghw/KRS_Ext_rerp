/* 첨부 끌어 놓기(2026-10-28) 테스트 — lib/mail-drop.js(끌어 온 것 읽기 · SharePoint 받을 주소 · 백그라운드 take: Gmail 주소 · Outlook/Teams 탭의 메뉴 받기 · Teams 그림 · OneDrive 폴더/맨 위 ·
 * 탭이 남긴 끌기로 대신 · 거르기)와 content/mail-drag.js(dragstart 에서 Gmail download_url · Outlook attachment JSON · Teams 파일 카드/그림 · OneDrive 줄 → 'application/x-krx-mail').
 * chrome · fetch · DOM 은 가짜(실제 Gmail·Outlook·Teams·OneDrive 화면 짜임은 실측 전). 실행: node tests/mail-drop.test.js */
globalThis.self = globalThis;
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const root = path.join(__dirname, '..');

let n = 0, failed = 0;
const queue = [];
const test = (name, fn) => queue.push([name, fn]);

/* ---------- 가짜 chrome · fetch · 저장소 ---------- */
let tabs = [], tabWindows = {}, execCalls = [], outlookResult = null, grabResult = null;
globalThis.chrome = {
  windows: { getLastFocused: async () => ({ id: 1 }) },
  tabs: { query: async (q) => tabs.filter((t) => [].concat(q.url).some((p) => new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$').test(t.url))) },
  scripting: {
    executeScript: async (o) => {
      execCalls.push(o);
      if (o.func === KRX_MAIL_DROP.mailFetch) return [{ result: [outlookResult] }];
      if (o.func === KRX_MAIL_DROP.tabGrab) return [{ result: grabResult }];
      const prev = globalThis.window;
      globalThis.window = tabWindows[o.target.tabId] || (tabWindows[o.target.tabId] = {});
      try { return [{ result: o.func.apply(null, o.args || []) }]; } finally { globalThis.window = prev; }
    },
  },
};
let routes = {}, fetched = [];
globalThis.fetch = async (url, init) => {
  fetched.push({ url: String(url), init });
  const r = routes[String(url)];
  if (!r) return { ok: false, status: 404, headers: { get: () => '' } };
  const blob = new Blob([r.body || ''], { type: r.type || '' });
  const hdr = Object.assign({ 'content-type': r.type || '' }, r.headers || {});
  return { ok: (r.status || 200) === 200, status: r.status || 200, url: String(url), headers: { get: (k) => hdr[String(k).toLowerCase()] || '' }, blob: async () => blob, json: async () => r.json };
};
let added = [];
globalThis.KRX_PREP_STORE = { addFiles: async (key, meta, files) => { added.push(...files.map((f) => Object.assign({ key }, f))); return { files: added.slice() }; } };
require(path.join(root, 'lib/mail-drop.js'));
const M = KRX_MAIL_DROP;
const reset = () => { tabs = []; tabWindows = {}; execCalls = []; outlookResult = null; grabResult = null; routes = {}; fetched = []; added = []; };
const dt = (data) => ({ types: Object.keys(data), getData: (t) => { const k = Object.keys(data).find((x) => x.toLowerCase() === String(t).toLowerCase()); return k ? data[k] : ''; } });   // 진짜 getData 처럼 형식 대소문자 무시
const b64 = (s) => Buffer.from(s).toString('base64');

/* ---------- parseDrop ---------- */
test('parseDrop: mail-drag.js 가 실은 형식 · Outlook attachment · DownloadURL · 링크 · 모르는 것', () => {
  const gm = M.parseDrop(dt({ [M.TYPE]: JSON.stringify({ site: 'gmail', items: [{ name: '영수증.pdf', mime: 'application/pdf', url: 'https://mail.google.com/mail/u/0?ui=2&attid=0.1&disp=safe' }] }) }));
  assert.deepStrictEqual(gm, { site: 'gmail', items: [{ name: '영수증.pdf', url: 'https://mail.google.com/mail/u/0?ui=2&attid=0.1&disp=safe', mime: 'application/pdf' }] });
  const tm = M.parseDrop(dt({ [M.TYPE]: JSON.stringify({ site: 'teams', items: [{ name: 'teams_image_1', src: 'blob:https://teams.microsoft.com/abc' }, { name: 'x', src: 'javascript:alert(1)' }] }) }));
  assert.deepStrictEqual(tm.items, [{ name: 'teams_image_1', src: 'blob:https://teams.microsoft.com/abc' }, { name: 'x' }], 'blob: 은 받고 다른 주소 형식은 뺌');
  const od = M.parseDrop(dt({ [M.TYPE]: JSON.stringify({ site: 'onedrive', items: [{ name: 'a.pdf', root: 'https://krsco-my.sharepoint.com' }, { name: 'b.pdf', root: 'https://evil.example.com' }] }) }));
  assert.deepStrictEqual(od.items, [{ name: 'a.pdf', root: 'https://krsco-my.sharepoint.com' }, { name: 'b.pdf' }], 'root 는 sharepoint.com 만');
  const ol = M.parseDrop(dt({ attachment: JSON.stringify({ attachmentFiles: [{ attachmentItemId: 'AAMk1', name: '견적서.xlsx', size: 1234, ContentType: 'application/octet-stream' }] }) }));
  assert.deepStrictEqual(ol, { site: 'outlook', items: [{ name: '견적서.xlsx', id: 'AAMk1', mime: 'application/octet-stream', size: 1234 }] });
  const du = M.parseDrop(dt({ DownloadURL: 'application/pdf:a:b.pdf:https://mail.google.com/x?attid=1' }));
  assert.deepStrictEqual(du, { site: 'gmail', items: [{ name: 'a:b.pdf', url: 'https://mail.google.com/x?attid=1', mime: 'application/pdf' }] }, '형식 대소문자 무시, 이름 속 : 도');
  const ul = M.parseDrop(dt({ 'text/uri-list': '# 주석\r\nhttps://krsco-my.sharepoint.com/:b:/g/personal/u/EAbc\r\nfile:///c:/x' }));
  assert.deepStrictEqual(ul, { site: 'onedrive', items: [{ name: '', url: 'https://krsco-my.sharepoint.com/:b:/g/personal/u/EAbc' }] });
  assert.strictEqual(M.parseDrop(dt({ 'text/plain': '그냥 글' })), null);
  assert.strictEqual(M.parseDrop(null), null);
});

test('spFileUrl: OneDrive·사이트 파일 → REST $value, 공유 링크 → download=1, 그 밖은 그대로', () => {
  assert.strictEqual(M.spFileUrl('https://krsco-my.sharepoint.com/personal/kim_krs_co_kr/Documents/%EC%97%85%EB%AC%B4/O%27Neil%20%231.pdf'),
    "https://krsco-my.sharepoint.com/personal/kim_krs_co_kr/_api/web/GetFileByServerRelativePath(decodedurl='" + encodeURIComponent("/personal/kim_krs_co_kr/Documents/업무/O''Neil #1.pdf") + "')/$value");
  assert.ok(M.spFileUrl('https://krs.sharepoint.com/sites/RnD/Shared%20Documents/a.docx').startsWith('https://krs.sharepoint.com/sites/RnD/_api/web/GetFileByServerRelativePath('));
  assert.strictEqual(M.spFileUrl('https://krsco-my.sharepoint.com/:b:/g/personal/u/EAbc?e=1'), 'https://krsco-my.sharepoint.com/:b:/g/personal/u/EAbc?e=1&download=1');
  assert.strictEqual(M.spFileUrl('https://krsco-my.sharepoint.com/personal/u/Documents/폴더'), 'https://krsco-my.sharepoint.com/personal/u/Documents/폴더', '확장자 없는 폴더는 그대로');
  assert.strictEqual(M.spFileUrl('https://mail.google.com/x.pdf'), 'https://mail.google.com/x.pdf');
  assert.strictEqual(M.dispositionName("attachment; filename=\"a.pdf\"; filename*=UTF-8''%EC%98%81%EC%88%98%EC%A6%9D.pdf"), '영수증.pdf');
  assert.strictEqual(M.withExt('teams_image_1', 'image/png'), 'teams_image_1.png');
  assert.strictEqual(M.withExt('a.jpg', 'image/png'), 'a.jpg');
});

/* ---------- take ---------- */
test('take: Gmail 주소는 백그라운드가 쿠키를 실어 받고, 출처는 그 메일 탭', async () => {
  reset();
  tabs = [{ id: 7, windowId: 1, active: true, url: 'https://mail.google.com/mail/u/0/#inbox/FMfc' }];
  routes['https://mail.google.com/x?attid=0.1'] = { body: '%PDF-1.4', type: 'application/pdf', headers: { 'content-disposition': 'attachment; filename="r.pdf"' } };
  const r = await M.take({ key: 'k1', meta: { shop: 'A' }, drop: { site: 'gmail', items: [{ name: '', url: 'https://mail.google.com/x?attid=0.1' }] } }, {});
  assert.strictEqual(r.ok, true); assert.strictEqual(r.added, 1); assert.deepStrictEqual(r.failed, []);
  assert.strictEqual(fetched[0].init.credentials, 'include');
  assert.deepStrictEqual(added.map((f) => [f.key, f.name, f.mime, Buffer.from(f.b64, 'base64').toString(), f.url, f.title]),
    [['k1', 'r.pdf', 'application/pdf', '%PDF-1.4', 'https://mail.google.com/mail/u/0/#inbox/FMfc', 'Gmail 메일 첨부']]);
});

test('take: Outlook 은 그 창의 앞 Outlook 탭의 페이지 세계에서 mailFetch, 형식은 확장자로 바로잡음 · 내려받기 주소면 백그라운드가 받음', async () => {
  reset();
  tabs = [{ id: 3, windowId: 9, active: true, lastAccessed: 99, url: 'https://outlook.office.com/mail/' }, { id: 4, windowId: 1, active: true, lastAccessed: 1, url: 'https://outlook.cloud.microsoft/mail/inbox/id/AAQ' }];
  outlookResult = { name: '견적서.xlsx', type: 'application/octet-stream', size: 3, base64: b64('abc') };
  let r = await M.take({ key: 'k2', meta: {}, drop: { site: 'outlook', items: [{ name: '견적서.xlsx', id: 'AAMk1', size: 3 }] } }, {});
  assert.strictEqual(r.added, 1);
  const ex = execCalls.find((o) => o.func === M.mailFetch);
  assert.strictEqual(ex.target.tabId, 4, '사이드 패널 창(마지막 포커스 1)의 앞 탭');
  assert.strictEqual(ex.world, 'MAIN');
  assert.deepStrictEqual(ex.args[0], [{ name: '견적서.xlsx', id: 'AAMk1', size: 3 }]); assert.strictEqual(ex.args[1].site, 'outlook');
  assert.strictEqual(added[0].mime, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.strictEqual(added[0].title, 'Outlook 메일 첨부');

  reset();
  tabs = [{ id: 4, windowId: 1, active: true, url: 'https://outlook.cloud.microsoft/mail/' }];
  outlookResult = { name: '계약서.docx', href: 'https://krsco-my.sharepoint.com/personal/u/_layouts/15/download.aspx?UniqueId=1&tempauth=t' };
  routes[outlookResult.href] = { body: 'PK', type: 'application/octet-stream' };
  r = await M.take({ key: 'k2', meta: {}, drop: { site: 'outlook', items: [{ name: '계약서.docx' }] } }, { tab: { windowId: 1 } });
  assert.strictEqual(r.added, 1, '클라우드 첨부 — download.aspx 는 그대로 받음');
  assert.strictEqual(fetched[0].url, outlookResult.href);
});

test('take: OneDrive 폴더 주소는 REST $value, 맨 위(root)는 PersonalUrl 로 풀어서', async () => {
  reset();
  const url = 'https://krsco-my.sharepoint.com/personal/u/Documents/%EC%98%81%EC%88%98%EC%A6%9D.pdf';
  routes[M.spFileUrl(url)] = { body: '%PDF', type: 'application/pdf' };
  let r = await M.take({ key: 'k3', meta: {}, drop: { site: 'onedrive', items: [{ name: '영수증.pdf', url }] } }, {});
  assert.strictEqual(r.added, 1); assert.strictEqual(added[0].url, url, '출처 = 그 파일'); assert.strictEqual(added[0].title, 'OneDrive 첨부');

  reset();
  routes['https://krsco-my.sharepoint.com/_api/SP.UserProfiles.PeopleManager/GetMyProperties?$select=PersonalUrl'] = { json: { PersonalUrl: 'https://krsco-my.sharepoint.com/personal/u/' }, type: 'application/json' };
  routes[M.spFileUrl('https://krsco-my.sharepoint.com/personal/u/Documents/' + encodeURIComponent('a b.png'))] = { body: 'PNG', type: 'image/png' };
  r = await M.take({ key: 'k3', meta: {}, drop: { site: 'onedrive', items: [{ name: 'a b.png', root: 'https://krsco-my.sharepoint.com' }] } }, {});
  assert.strictEqual(r.added, 1, JSON.stringify(r.failed)); assert.strictEqual(added[0].name, 'a b.png');
});

test('take: Teams 그림(blob:)은 그 탭에서 받고 확장자를 붙임 · 주소 없는 파일 카드는 메뉴로', async () => {
  reset();
  tabs = [{ id: 5, windowId: 1, active: true, url: 'https://teams.cloud.microsoft/v2/' }];
  grabResult = { type: 'image/png', size: 3, base64: b64('PNG') };
  let r = await M.take({ key: 'k4', meta: {}, drop: { site: 'teams', items: [{ name: 'teams_image_20261028_091300', src: 'blob:https://teams.cloud.microsoft/1' }] } }, {});
  assert.strictEqual(r.added, 1); assert.strictEqual(added[0].name, 'teams_image_20261028_091300.png'); assert.strictEqual(added[0].title, 'Teams 첨부');
  assert.deepStrictEqual(execCalls.find((o) => o.func === M.tabGrab).args[0], 'blob:https://teams.cloud.microsoft/1');

  reset();
  tabs = [{ id: 5, windowId: 1, active: true, url: 'https://teams.cloud.microsoft/v2/' }];
  outlookResult = { name: 'Scan_2026.pdf', type: 'application/pdf', size: 4, base64: b64('%PDF') };
  r = await M.take({ key: 'k4', meta: {}, drop: { site: 'teams', items: [{ name: 'Scan_2026.pdf' }] } }, {});
  assert.strictEqual(r.added, 1); assert.strictEqual(execCalls.find((o) => o.func === M.mailFetch).args[1].site, 'teams');
});

test('take: 끌어 온 것이 없으면 탭이 남긴 마지막 끌기(2분 안)를 쓰고 지움 · 없으면 오류', async () => {
  reset();
  tabs = [{ id: 7, windowId: 1, active: false, lastAccessed: 5, url: 'https://mail.google.com/mail/u/0/' }, { id: 8, windowId: 1, active: true, url: 'https://teams.microsoft.com/' }];
  tabWindows[7] = { __krxMailDrag: { at: Date.now() - 1000, site: 'gmail', items: [{ name: 'g.pdf', url: 'https://mail.google.com/g?attid=1' }] } };
  tabWindows[8] = { __krxMailDrag: { at: Date.now() - 10 * 60000, site: 'teams', items: [{ name: 'old.png', src: 'blob:x' }] } };
  routes['https://mail.google.com/g?attid=1'] = { body: '%PDF', type: 'application/pdf' };
  const r = await M.take({ key: 'k5', meta: {}, drop: null }, {});
  assert.strictEqual(r.added, 1); assert.strictEqual(r.site, 'gmail'); assert.strictEqual(added[0].name, 'g.pdf');
  assert.strictEqual(tabWindows[7].__krxMailDrag, null, '쓴 기록은 지움');
  reset();
  const e = await M.take({ key: 'k5', meta: {}, drop: null }, {});
  assert.strictEqual(e.ok, false); assert.ok(/알아보지 못했습니다/.test(e.error));
});

test('take: 첨부할 수 없는 종류 · 한도 초과 · 웹페이지 응답 · 권한 없음은 못 받음으로', async () => {
  reset();
  routes['https://mail.google.com/a'] = { body: '<html>', type: 'text/html' };
  routes['https://mail.google.com/b'] = { body: 'x', type: 'application/pdf', headers: { 'content-length': String(16 * 1048576) } };
  routes['https://mail.google.com/c'] = { body: 'x', type: 'text/html', headers: { 'content-disposition': 'attachment; filename="page.html"' } };
  routes['https://mail.google.com/d'] = { status: 403 };
  const r = await M.take({ key: 'k6', meta: {}, drop: { site: 'gmail', items: ['a', 'b', 'c', 'd'].map((x) => ({ name: '', url: `https://mail.google.com/${x}` })) } }, {});
  assert.strictEqual(r.added, 0);
  assert.deepStrictEqual(r.failed.map((f) => /웹페이지|MB 초과|첨부할 수 없는 종류|403/.exec(f.why)[0]), ['웹페이지', 'MB 초과', '첨부할 수 없는 종류', '403']);
});

/* ---------- content/mail-drag.js (가짜 DOM) ---------- */
function matchOne(el, s) {
  if (s === '*') return true;
  const m = /^([a-z]*)((?:\[[^\]]+\])*)$/i.exec(s); if (!m) return false;
  if (m[1] && el.tagName !== m[1].toUpperCase()) return false;
  for (const a of m[2].match(/\[[^\]]+\]/g) || []) {
    const x = /^\[([\w-]+)(?:(\*?=)"?([^"\]]*?)"?(\s+i)?)?\]$/.exec(a);
    const v = el.getAttribute(x[1]); if (v == null) return false;
    if (!x[2]) continue;
    const want = x[4] ? x[3].toLowerCase() : x[3], have = x[4] ? v.toLowerCase() : v;
    if (x[2] === '=' ? have !== want : !have.includes(want)) return false;
  }
  return true;
}
class El {
  constructor(tag, attrs, kids, text) { this.tagName = tag.toUpperCase(); this.attrs = attrs || {}; this.children = []; this.parentElement = null; this.nodeType = 1; this._t = text || ''; this.rect = { width: 200, height: 120 }; for (const k of kids || []) { k.parentElement = this; this.children.push(k); } }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  get textContent() { return this._t + this.children.map((c) => c.textContent).join(''); }
  get href() { return this.attrs.href; }
  get src() { return this.attrs.src; }
  get currentSrc() { return this.attrs.src; }
  matches(sel) { return sel.split(',').some((s) => matchOne(this, s.trim())); }
  closest(sel) { for (let e = this; e; e = e.parentElement) if (e.matches(sel)) return e; return null; }
  querySelectorAll(sel) { const out = []; const walk = (e) => { for (const c of e.children) { if (c.matches(sel)) out.push(c); walk(c); } }; walk(this); return out; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  getBoundingClientRect() { return this.rect; }
}
const code = fs.readFileSync(path.join(root, 'content/mail-drag.js'), 'utf8');
function page(href) {
  const u = new URL(href);
  const win = { handlers: [], addEventListener(t, fn, cap) { this.handlers.push([t, fn, !!cap]); }, removeEventListener() {} };
  vm.runInNewContext(code, { window: win, location: { hostname: u.hostname, href, search: u.search, pathname: u.pathname, origin: u.origin }, document: { body: null }, URLSearchParams, Date, JSON });
  const drag = (target, pre, trusted = true) => {
    const data = Object.assign({}, pre || {});
    const ev = { isTrusted: trusted, target, dataTransfer: { setData: (t, v) => { data[t] = v; }, getData: (t) => data[t] || '' } };
    for (const [t, fn, cap] of win.handlers) if (t === 'dragstart' && cap) fn(ev);
    for (const [t, fn, cap] of win.handlers) if (t === 'dragstart' && !cap) fn(ev);
    return { data, j: data['application/x-krx-mail'] ? JSON.parse(data['application/x-krx-mail']) : null };
  };
  return { win, drag };
}

test('mail-drag: Gmail 카드의 download_url 을 옮겨 싣고 기록 · 스크립트가 쏜 끌기는 무시', () => {
  const { win, drag } = page('https://mail.google.com/mail/u/0/#inbox/FM');
  const img = new El('img', { src: 'https://mail.google.com/thumb' });
  new El('span', { download_url: 'application/pdf:거래명세서.pdf:https://mail.google.com/mail/u/0?ui=2&attid=0.1&disp=safe' }, [new El('a', { href: 'https://mail.google.com/mail/u/0?attid=0.1&disp=inline' }, [img])]);
  assert.strictEqual(drag(img, null, false).j, null);
  const { j } = drag(img);
  assert.deepStrictEqual(j, { site: 'gmail', items: [{ name: '거래명세서.pdf', mime: 'application/pdf', url: 'https://mail.google.com/mail/u/0?ui=2&attid=0.1&disp=safe' }] });
  assert.strictEqual(win.__krxMailDrag.site, 'gmail');
  assert.strictEqual(drag(new El('div', {}, [], '본문')).j, null, '첨부가 아니면 싣지 않음');
});

test('mail-drag: Outlook 은 카드 이름을 먼저, Outlook 이 채운 attachment 로 바꿔 실음', () => {
  const { drag } = page('https://outlook.cloud.microsoft/mail/inbox');
  const grip = new El('div', { draggable: 'true' });
  new El('div', { role: 'listbox' }, [new El('div', { role: 'option' }, [new El('span', { title: '견적서.xlsx' }), grip])]);
  assert.deepStrictEqual(drag(grip).j.items, [{ name: '견적서.xlsx' }], 'attachment 가 없으면 화면 이름');
  const { j } = drag(grip, { attachment: JSON.stringify({ attachmentFiles: [{ attachmentItemId: 'AAMk', name: '견적서.xlsx', size: 10, ContentType: 'application/x' }] }) });
  assert.deepStrictEqual(j, { site: 'outlook', items: [{ name: '견적서.xlsx', size: 10, id: 'AAMk', mime: 'application/x' }] });
});

test('mail-drag: Teams 파일 카드(미리보기 그림을 끌어도 그 파일) · 메시지 그림 · 작은 그림은 뺌', () => {
  const { drag } = page('https://teams.cloud.microsoft/v2/');
  const thumb = new El('img', { src: 'https://x/preview' });
  new El('div', {}, [new El('div', {}, [new El('span', {}, [], 'Scan_2026-10-28.pdf'), new El('button', { 'aria-label': '추가 옵션' })]), thumb]);
  assert.deepStrictEqual(drag(thumb).j, { site: 'teams', items: [{ name: 'Scan_2026-10-28.pdf' }] });
  const linkThumb = new El('img', { src: 'https://x/p2' });
  new El('div', {}, [new El('a', { href: 'https://krsco-my.sharepoint.com/personal/u/Documents/Microsoft Teams 채팅 파일/a.pdf', title: 'a.pdf' }), new El('button'), linkThumb]);
  assert.deepStrictEqual(drag(linkThumb).j.items, [{ name: 'a.pdf', url: 'https://krsco-my.sharepoint.com/personal/u/Documents/Microsoft Teams 채팅 파일/a.pdf' }]);
  const pic = new El('img', { src: 'blob:https://teams.cloud.microsoft/9', alt: '이미지' });
  new El('div', {}, [pic]);
  const it = drag(pic).j.items[0];
  assert.strictEqual(it.src, 'blob:https://teams.cloud.microsoft/9'); assert.ok(/^teams_image_\d{8}_\d{6}$/.test(it.name));
  const avatar = new El('img', { src: 'https://x/a' }); avatar.rect = { width: 32, height: 32 };
  assert.strictEqual(drag(avatar).j, null);
});

test('mail-drag: OneDrive 줄 — 지금 연 폴더(id=) + 이름, 선택된 줄 모두, 맨 위면 root', () => {
  let { drag } = page('https://krsco-my.sharepoint.com/personal/u/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fu%2FDocuments%2F%EC%97%85%EB%AC%B4&view=0');
  const cell = new El('span', {}, [], '영수증 #1.pdf');
  const r1 = new El('div', { role: 'row', 'aria-selected': 'true' }, [new El('div', {}, [cell])]);
  const r2 = new El('div', { role: 'row', 'aria-selected': 'true' }, [new El('button', { title: '견적서.xlsx' })]);
  const r3 = new El('div', { role: 'row' }, [new El('span', {}, [], '폴더')]);
  new El('div', { role: 'grid' }, [r1, r2, r3]);
  assert.deepStrictEqual(drag(cell).j, { site: 'onedrive', items: [
    { name: '영수증 #1.pdf', url: 'https://krsco-my.sharepoint.com/personal/u/Documents/%EC%97%85%EB%AC%B4/%EC%98%81%EC%88%98%EC%A6%9D%20%231.pdf' },
    { name: '견적서.xlsx', url: 'https://krsco-my.sharepoint.com/personal/u/Documents/%EC%97%85%EB%AC%B4/%EA%B2%AC%EC%A0%81%EC%84%9C.xlsx' }] });
  ({ drag } = page('https://krsco-my.sharepoint.com/my'));
  const c2 = new El('span', {}, [], 'a.pdf');
  new El('div', { role: 'row' }, [c2]);
  assert.deepStrictEqual(drag(c2).j.items, [{ name: 'a.pdf', root: 'https://krsco-my.sharepoint.com' }]);
});

/* ---------- lib/prep.js 드롭 구역: 파일이 아닌 끌기를 받아 'prepMailDrop' 으로 ---------- */
test('prep.js: 거래 줄 위의 메일 첨부 끌기만 받고(effectAllowed 그대로) 끌어 온 것을 읽어 백그라운드로 → 저장·분류', async () => {
  const sent = [];
  chrome.runtime = { sendMessage: (m) => { sent.push(m); return Promise.resolve(m.type === 'prepMailDrop' ? { ok: true, site: 'outlook', added: 1, failed: [{ name: 'b.exe', why: '첨부할 수 없는 종류' }], entry: { files: [{ id: 'f1' }] } } : { ok: true }); } };
  chrome.storage = { local: { get: async () => ({}) }, onChanged: { addListener() {} } };
  require(path.join(root, 'lib/format.js'));
  require(path.join(root, 'lib/prep.js'));
  const handlers = {};
  const host = { addEventListener: (t, fn) => { (handlers[t] = handlers[t] || []).push(fn); }, querySelector: () => null, querySelectorAll: () => [] };
  const row = { dataset: { prepKey: 'k9', prepMeta: '{"shop":"A"}' }, classList: { contains: () => false, add() {}, remove() {} } };
  const state = {};
  KRX_PREP.bind(host, state, () => {});
  const fire = (t, ev) => { let prevented = false; (handlers[t] || []).forEach((fn) => fn(Object.assign({ preventDefault() { prevented = true; }, stopPropagation() {} }, ev))); return prevented; };
  const data = { attachment: JSON.stringify({ attachmentFiles: [{ attachmentItemId: 'A1', name: 'a.pdf', size: 3 }] }) };
  const mk = (target) => ({ target, dataTransfer: Object.assign(dt(data), { dropEffect: 'move' }) });
  const off = mk({ closest: () => null });
  assert.strictEqual(fire('dragover', off), false, '거래 줄 밖은 받지 않음');
  const on = mk({ closest: (s) => (s === '[data-prep-key]' ? row : null) });
  assert.strictEqual(fire('dragover', on), true);
  assert.strictEqual(on.dataTransfer.dropEffect, 'move', '파일이 아니면 dropEffect 를 건드리지 않음');
  fire('drop', mk({ closest: (s) => (s === '[data-prep-key]' ? row : null) }));
  await new Promise((r) => setTimeout(r, 20));
  const m = sent.find((x) => x.type === 'prepMailDrop');
  assert.deepStrictEqual({ key: m.key, meta: m.meta, drop: m.drop }, { key: 'k9', meta: { shop: 'A' }, drop: { site: 'outlook', items: [{ name: 'a.pdf', id: 'A1', size: 3 }] } });
  assert.deepStrictEqual(state.prep.k9, { files: [{ id: 'f1' }] });
  assert.ok(/Outlook 첨부 1개 저장됨 · 못 받음: b\.exe/.test(state.prepNote.msg), state.prepNote.msg);
  assert.ok(sent.some((x) => x.type === 'prepAuto' && x.key === 'k9'), '끌어다 놓은 파일처럼 Claude 자동 분류');
  assert.strictEqual(state.prepBusy, null);
});

(async () => {
  for (const [name, fn] of queue) {
    n++;
    try { await fn(); console.log(`ok - ${name}`); }
    catch (e) { failed++; console.log(`not ok - ${name}\n  ${String((e && e.stack) || e).split('\n').slice(0, 4).join('\n  ')}`); }
  }
  console.log(`\n${n - failed}/${n} 통과`);
  process.exit(failed ? 1 : 0);
})();
