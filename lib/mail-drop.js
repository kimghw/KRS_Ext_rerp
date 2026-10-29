/* 메일·Teams·OneDrive 첨부 끌어 놓기 (2026-10-28) — Gmail·Outlook 메일의 첨부 카드, Teams 채팅의 파일·그림, OneDrive(회사 = SharePoint) 파일 목록의 파일을
 * 청구 준비 줄(lib/prep.js 드롭 구역)에 끌어 놓으면 그 원본을 받아 증빙 첨부로 저장한다. 끌기 시작 쪽 표시는 content/mail-drag.js.
 * 공용(사이드 패널 · eClass 패널 · 백그라운드). take 와 페이지 함수(mailFetch · tabGrab)는 백그라운드에서만 쓴다(chrome.scripting · chrome.tabs · fetch).
 *   패널: drop 처리기 안에서 곧바로(dataTransfer 는 await 뒤에 비므로) parseDrop(dataTransfer) → { site, items } | null 을 'prepMailDrop' 메시지로 보낸다.
 *   백그라운드 take: drop 이 없으면 탭들이 남긴 마지막 끌기(window.__krxMailDrag, FRESH_MS 안)를 읽는다. 그다음 항목마다
 *     url — 백그라운드가 쿠키를 실어 받는다(manifest host_permissions). Gmail download_url 은 mail.google.com → *.googleusercontent.com 으로 넘어가고,
 *       SharePoint·OneDrive 파일 주소는 REST GetFileByServerRelativePath(…)/$value 로, 공유 링크(/:x:/…)는 download=1 로 바꿔 받는다(spFileUrl — 확장 출처 GET 은 lib/sp-store.js 실측 200).
 *     root — OneDrive "내 파일" 맨 위(주소에 폴더가 없음): PeopleManager/GetMyProperties 의 PersonalUrl + /Documents/이름.
 *     src — Teams 메시지 그림: 그 탭의 페이지 세계에서 받는다(tabGrab — blob: 주소는 그 탭에서만 받힘, 안 되면 그려진 그림을 캔버스로), https 면 백그라운드도 한 번 더.
 *     그 밖(Outlook 첨부 ID·이름, 주소 없는 Teams 파일 카드)은 그 탭의 페이지 세계에서 mailFetch — 카드의 메뉴 단추 → "다운로드" 를 누르고 페이지가 만드는 blob·내려받기 주소를 가로챔
 *       (브라우저 내려받기는 생기지 않음; 주소면 백그라운드가 받음). Outlook 은 첨부를 MSAL 토큰을 붙여 attachments.office.net 에서 받으므로 주소만으로는 못 받는다 — kr_ext_workspace src/mailgrab.js 실측(2026-10-15)을 옮김.
 *     받은 파일은 끌어다 놓은 파일과 같은 저장 경로(KRX_PREP_STORE.addFiles)와 같은 거르기(첨부할 수 없는 종류·MAX_MB 초과·빈 파일)로.
 *   실측: Outlook 카드의 'attachment' JSON·메뉴 다운로드(workspace)와 SharePoint 확장 출처 GET(sp-store)만. 탭 → 확장 패널로 끌었을 때 무엇이 건너오는지, Gmail·Teams·OneDrive 화면 짜임은 실측 전(2026-10-28).
 * 끌어 오는 데이터 형식(types 는 소문자):
 *   'application/x-krx-mail' — content/mail-drag.js 가 덧붙인 JSON { site, items: [{ name, mime?, url?, src?, root?, id?, size? }] }
 *   'attachment' — Outlook 카드가 싣는 JSON { attachmentFiles: [{ attachmentItemId, name, size, ContentType }] }
 *   'downloadurl' — "형식:이름:주소" (크롬은 다른 페이지의 drop 에는 보이지 않음 — 그래서 mail-drag.js 가 옮겨 실음)
 *   'text/uri-list' — 링크(Gmail 카드의 첨부 링크 …attid=…, SharePoint 파일·공유 링크, 그 밖의 파일 링크 — 접근 권한이 있는 사이트만 받힘) */
(function (g) {
  const TYPE = 'application/x-krx-mail';
  const MAX_MB = 15;                 // lib/prep.js MAX_FILE_MB 와 같음
  const MAX_ITEMS = 10;              // 한 번에 끌어 온 첨부 수 상한
  const FRESH_MS = 2 * 60000;        // 탭이 남긴 끌기를 믿는 시간
  const FETCH_MS = 60000, TAB_WAIT_MS = 20000;
  const DENY_EXT = new Set(['exe', 'bat', 'sh', 'java', 'jsp', 'htm', 'html', 'js', 'class', 'ini', 'php', 'jsv']);   // lib/prep.js · content/rnd-claim.js 와 같음
  const GMAIL_URLS = ['https://mail.google.com/*'];
  const OUTLOOK_URLS = ['https://outlook.cloud.microsoft/*', 'https://outlook.office.com/*', 'https://outlook.office365.com/*', 'https://outlook.live.com/*'];
  const TEAMS_URLS = ['https://teams.microsoft.com/*', 'https://teams.cloud.microsoft/*', 'https://teams.live.com/*'];
  const ONEDRIVE_URLS = ['https://*.sharepoint.com/*'];
  const SITES = ['gmail', 'outlook', 'teams', 'onedrive'];
  const SITE_NAME = { gmail: 'Gmail', outlook: 'Outlook', teams: 'Teams', onedrive: 'OneDrive', link: '링크' };

  const one = (s) => String(s == null ? '' : s).replace(/[\u200b\ufeff\u00a0]/g, ' ').replace(/\s+/g, ' ').trim();
  const extOf = (name) => { const m = /\.([a-z0-9]{1,6})$/i.exec(String(name || '').trim()); return m ? m[1].toLowerCase() : null; };
  function siteOf(url) {
    let h = '';
    try { h = new URL(String(url || '')).hostname; } catch (e) { return ''; }
    if (/(^|\.)mail\.google\.com$/i.test(h)) return 'gmail';
    if (/(^|\.)outlook\.(cloud\.microsoft|office\.com|office365\.com|live\.com)$/i.test(h)) return 'outlook';
    if (/(^|\.)teams\.(microsoft\.com|cloud\.microsoft|live\.com)$/i.test(h)) return 'teams';
    if (/\.sharepoint\.com$/i.test(h)) return 'onedrive';
    return 'link';
  }
  const MIME = {
    pdf: 'application/pdf', hwp: 'application/x-hwp', hwpx: 'application/hwp+zip', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', csv: 'text/csv', txt: 'text/plain', zip: 'application/zip',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', tif: 'image/tiff', tiff: 'image/tiff', heic: 'image/heic',
    eml: 'message/rfc822', msg: 'application/vnd.ms-outlook',
  };
  const mimeOf = (name) => MIME[extOf(name)] || '';
  const EXT_OF_MIME = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/bmp': 'bmp' };
  /* 이름에 확장자가 없으면 받은 형식으로 붙인다(링크·Teams 그림) */
  const withExt = (name, mime) => { const e = EXT_OF_MIME[String(mime || '').split(';')[0].trim().toLowerCase()]; return extOf(name) || !e ? name : `${name}.${e}`; };
  /* Content-Disposition 의 파일 이름 — filename*=UTF-8''… 를 먼저, 없으면 filename="…" */
  function dispositionName(h) {
    const s = String(h || '');
    const star = /filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i.exec(s);
    if (star) { try { return one(decodeURIComponent(star[2].trim().replace(/^"|"$/g, ''))); } catch (e) {} }
    const plain = /filename\s*=\s*("([^"]*)"|[^;]+)/i.exec(s);
    return plain ? one(plain[2] != null ? plain[2] : plain[1]) : '';
  }
  const urlName = (url) => { try { const u = new URL(url); return one(decodeURIComponent(u.pathname.split('/').pop() || '')); } catch (e) { return ''; } };
  /* SharePoint·OneDrive 파일 주소 → 받을 주소. 서버 상대 경로의 파일(/personal/<u>/… · /sites/<x>/…)이면 그 웹의 REST $value, 공유 링크(/:b:/g/…)면 download=1, 그 밖은 그대로 */
  function spFileUrl(url) {
    let u;
    try { u = new URL(String(url)); } catch (e) { return url; }
    if (!/\.sharepoint\.com$/i.test(u.hostname)) return url;
    if (/\/_api\/|\/_layouts\/15\/download\.aspx/i.test(u.pathname) || u.searchParams.get('download') === '1') return url;
    if (/^\/:[a-z]:\//i.test(u.pathname)) { u.searchParams.set('download', '1'); return u.href; }
    let path = '';
    try { path = decodeURIComponent(u.pathname); } catch (e) { return url; }
    const web = /^\/(personal|sites|teams)\/[^/]+/i.exec(path);
    if (!web || !extOf(path)) return url;
    return `${u.origin}${web[0].split('/').map(encodeURIComponent).join('/')}/_api/web/GetFileByServerRelativePath(decodedurl='${encodeURIComponent(path.replace(/'/g, "''"))}')/$value`;
  }

  /* 끌어 놓은 것 → { site, items } | null. drop 처리기 안에서 곧바로 부른다. 파일(Files)이 실린 끌기는 부르는 쪽이 원래 길로 보낸다 */
  function parseDrop(dt) {
    if (!dt || typeof dt.getData !== 'function') return null;
    const types = Array.from(dt.types || []).map((t) => String(t).toLowerCase());
    const get = (t) => { try { return String(dt.getData(t) || ''); } catch (e) { return ''; } };
    const clean = (items) => (items || []).filter(Boolean).slice(0, MAX_ITEMS).map((x) => {
      const o = { name: one(x.name) };
      if (x.url && /^https?:\/\//i.test(String(x.url))) o.url = String(x.url).trim();
      if (x.src && /^(https?|blob):/i.test(String(x.src))) o.src = String(x.src).trim();
      if (x.root && /^https:\/\/[^/]+\.sharepoint\.com$/i.test(String(x.root))) o.root = String(x.root);
      if (x.id) o.id = String(x.id);
      if (x.mime) o.mime = one(x.mime);
      if (Number(x.size) > 0) o.size = Number(x.size);
      return o;
    }).filter((x) => x.url || x.src || x.name);
    if (types.includes(TYPE)) {
      try { const j = JSON.parse(get(TYPE)); const items = clean(j && j.items); if (items.length) return { site: SITES.includes(j.site) ? j.site : 'link', items }; } catch (e) {}
    }
    if (types.includes('attachment')) {
      try {
        const j = JSON.parse(get('attachment'));
        const items = clean((j && Array.isArray(j.attachmentFiles) ? j.attachmentFiles : []).map((f) => f && { name: f.name, size: f.size, id: f.attachmentItemId, mime: f.ContentType }));
        if (items.length) return { site: 'outlook', items };
      } catch (e) {}
    }
    if (types.includes('downloadurl')) {
      const m = /^([^:]*):(.*?):(https?:\/\/.+)$/i.exec(get('downloadurl').trim());
      if (m) return { site: siteOf(m[3]), items: clean([{ name: m[2], mime: m[1], url: m[3] }]) };
    }
    if (types.includes('text/uri-list')) {
      const urls = get('text/uri-list').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && /^https?:\/\//i.test(l));
      if (urls.length) return { site: siteOf(urls[0]), items: clean(urls.map((url) => ({ name: '', url }))) };
    }
    return null;
  }

  /* ---------- 탭의 페이지 세계(MAIN)에서 도는 함수 — chrome.scripting 이 글자 그대로 옮기므로 바깥 변수를 쓰지 않는다 ---------- */
  /* 카드의 메뉴 → "다운로드" 로 받기. items: [{ name, id?, size? }], opts.site: 'outlook' | 'teams'
   *   → [{ name, type, size, base64 } | { name, href }(blob 이 아닌 내려받기 주소 — 백그라운드가 받음) | { name, error }].
   * Outlook 카드: [role=listbox] [role=option] 을 첨부 ID(카드에 dragstart 를 쏘아 Outlook 이 싣는 'attachment' JSON) → 이름 차례로, 메뉴 단추는 button[aria-haspopup].
   * Teams 카드: 이름이 title·글자·aria-label 에 있는 칸에서 위로 올라가 메뉴 단추(aria-haspopup · "옵션/More" 이름)가 있는 가장 가까운 조상 — 보이는 것 중 마지막(최근 메시지).
   * 페이지가 내려받기로 누르는 <a download | blob: | download.aspx …> · window.open 을 가로챈다 — 감싼 URL.createObjectURL · a.click · dispatchEvent · window.open 은 끝에 반드시 되돌린다.
   * 기다리기는 MutationObserver — 뒤에 깔린 탭은 짧은 타이머가 늦춰진다(workspace 실측). window.__krsMailFetch 는 kr_ext_workspace 의 같은 함수와 같이 쓰는 표시(두 확장이 한꺼번에 감싸지 않게) */
  async function mailFetch(items, opts) {
    const o = opts || {};
    const teams = o.site === 'teams';
    const maxBytes = o.maxBytes || 15 * 1048576, waitMs = o.waitMs || 20000, menuMs = o.menuMs || 6000;
    const one = (s) => String(s == null ? '' : s).replace(/[\u200b\ufeff\u00a0]/g, ' ').replace(/\s+/g, ' ').trim();
    const label = (s) => String(s == null ? '' : s).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();   // 메뉴 글자 앞의 아이콘 글꼴 글자(U+E000 대)를 뺀다
    const mb = (n) => `${(n / 1048576).toFixed(1).replace(/\.0$/, '')}MB`;
    const tooBig = (name, n) => ({ name, error: `${mb(n)}로 한 파일의 한도(${mb(maxBytes)})를 넘었습니다 — 내려받아 직접 넣으세요` });
    const b64 = (blob) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.onerror = () => rej(fr.error || new Error('파일을 읽지 못했습니다')); fr.readAsDataURL(blob); });
    const until = (check, ms) => new Promise((resolve) => {
      const now = check(); if (now) { resolve(now); return; }
      let done = false, timer = 0;
      const mo = new MutationObserver(() => { const v = check(); if (v) end(v); });
      function end(v) { if (done) return; done = true; mo.disconnect(); clearTimeout(timer); resolve(v); }
      mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
      timer = setTimeout(() => end(check() || null), ms);
    });
    const shown = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const cardId = (opt) => {
      const drag = opt.querySelector('[draggable="true"]'); if (!drag) return '';
      try {
        const dt = new DataTransfer();
        drag.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true, cancelable: true }));
        const j = JSON.parse(dt.getData('attachment') || 'null');
        drag.dispatchEvent(new DragEvent('dragend', { dataTransfer: dt, bubbles: true }));
        const f = j && Array.isArray(j.attachmentFiles) ? j.attachmentFiles[0] : null;
        return String((f && f.attachmentItemId) || '');
      } catch (e) { return ''; }
    };
    const cardName = (opt) => { const x = Array.from(opt.querySelectorAll('[title]')).find((el) => !el.closest('button')); return one(x && x.getAttribute('title')); };
    const moreBtn = (el) => el.querySelector('button[aria-haspopup], [role=button][aria-haspopup]')
      || Array.from(el.querySelectorAll('button, [role=button]')).find((b) => /옵션|options|더 보기|more|기타 작업/i.test(b.getAttribute('aria-label') || b.getAttribute('title') || '')) || null;
    const outlookCard = (it) => {
      const cards = Array.from(document.querySelectorAll('[role=listbox] [role=option]'));
      return (it.id && cards.find((c) => cardId(c) === it.id)) || cards.find((c) => cardName(c) === one(it.name)) || null;
    };
    const teamsCard = (it) => {
      const name = one(it.name); if (!name) return null;
      const all = Array.from(document.querySelectorAll('[title], [aria-label], span, div, a'));
      let hits = all.filter((x) => one(x.getAttribute('title')) === name || (!x.children.length && one(x.textContent) === name));   // 이름 그대로인 칸 먼저 — aria-label 포함은 메시지 전체를 잡을 수 있어 그다음
      if (!hits.length) hits = all.filter((x) => one(x.getAttribute('aria-label')).includes(name));
      const cards = [];
      for (const h of hits.slice(-30)) {
        for (let el = h, i = 0; el && el !== document.body && i < 10; el = el.parentElement, i++) {
          for (const type of ['pointerover', 'mouseover']) el.dispatchEvent(new MouseEvent(type, { bubbles: true }));   // 마우스를 올려야 단추가 그려지는 카드
          if (moreBtn(el)) { if (!cards.includes(el)) cards.push(el); break; }
        }
      }
      const vis = cards.filter(shown);
      return (vis.length ? vis : cards).pop() || null;
    };
    const menuItem = () => Array.from(document.querySelectorAll('[role=menu] [role=menuitem], [role=menuitem]')).find((x) => /^(다운로드|Download)$/i.test(label(x.innerText || x.textContent))) || null;
    const DL = /download\.aspx|[?&]download=1|tempauth=/i;
    const intercept = (trigger) => new Promise((resolve) => {
      const blobs = new Map();
      const keep = [[URL, 'createObjectURL'], [HTMLAnchorElement.prototype, 'click'], [EventTarget.prototype, 'dispatchEvent'], [window, 'open']].map(([ob, k]) => [ob, k, Object.getOwnPropertyDescriptor(ob, k)]);
      const origCreate = URL.createObjectURL, origClick = HTMLAnchorElement.prototype.click, origDispatch = EventTarget.prototype.dispatchEvent, origOpen = window.open;
      let done = false, timer = 0;
      const finish = (v) => { if (done) return; done = true; clearTimeout(timer); for (const [ob, k, d] of keep) { if (d) Object.defineProperty(ob, k, d); else delete ob[k]; } resolve(v); };
      const caught = (a) => { const href = String(a.href || ''); if (!a.hasAttribute('download') && !/^blob:/i.test(href) && !DL.test(href)) return false; finish({ href, name: a.getAttribute('download') || '', blob: blobs.get(href) || null }); return true; };
      try {
        URL.createObjectURL = function (obj) { const u = origCreate.call(this, obj); if (obj instanceof Blob) blobs.set(u, obj); return u; };
        HTMLAnchorElement.prototype.click = function () { if (!done && caught(this)) return undefined; return origClick.call(this); };
        EventTarget.prototype.dispatchEvent = function (ev) { if (!done && this instanceof HTMLAnchorElement && ev && ev.type === 'click' && caught(this)) return false; return origDispatch.call(this, ev); };
        window.open = function (u) { const href = String(u || ''); if (!done && (/^blob:/i.test(href) || DL.test(href))) { finish({ href, name: '', blob: blobs.get(href) || null }); return null; } return origOpen.apply(this, arguments); };
        timer = setTimeout(() => finish(null), waitMs);
        Promise.resolve().then(trigger).catch((e) => finish({ error: String((e && e.message) || e) }));
      } catch (e) { finish({ error: String((e && e.message) || e) }); }
    });
    const viaMenu = async (card) => {
      const more = moreBtn(card);
      if (!more) throw new Error('파일의 메뉴 단추를 찾지 못했습니다');
      more.click();
      const item = await until(menuItem, menuMs);
      if (!item) throw new Error('메뉴에 "다운로드" 가 없습니다');
      item.click();
    };
    if (window.__krsMailFetch) return (items || []).map((x) => ({ name: one(x && x.name), error: '이미 다른 첨부를 가져오는 중입니다 — 끝난 뒤 다시 해 주세요' }));
    window.__krsMailFetch = true;
    const res = [];
    try {
      for (const it of items || []) {
        const name = one(it && it.name);
        try {
          if (it.size && it.size > maxBytes) { res.push(tooBig(name, it.size)); continue; }
          const card = teams ? teamsCard(it) : outlookCard(it);
          if (!card) throw new Error(teams ? '채팅에서 이 파일을 찾지 못했습니다 — 그 대화를 연 채로 다시 끌어 놓으세요' : '메일에서 이 첨부를 찾지 못했습니다 — 그 메일을 연 채로 다시 끌어 놓으세요');
          const got = await intercept(() => viaMenu(card));
          if (!got) throw new Error(`${Math.round(waitMs / 1000)}초 안에 받지 못했습니다 — 페이지가 브라우저 내려받기로 받았으면 그 파일을 끌어다 놓으세요`);
          if (got.error) throw new Error(got.error);
          let blob = got.blob;
          if (!blob && /^blob:/i.test(got.href)) blob = await (await fetch(got.href)).blob();
          if (!blob) { res.push({ name: name || one(got.name), href: got.href }); continue; }
          res.push(blob.size > maxBytes ? tooBig(name, blob.size) : { name: name || one(got.name), type: blob.type || '', size: blob.size, base64: await b64(blob) });
        } catch (e) {
          res.push({ name, error: String((e && e.message) || e) });
        } finally {
          const menu = document.querySelector('[role=menu]');
          if (menu) { const at = menu.contains(document.activeElement) ? document.activeElement : menu; for (const type of ['keydown', 'keyup']) at.dispatchEvent(new KeyboardEvent(type, { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true })); }
        }
      }
    } finally { delete window.__krsMailFetch; }
    return res;
  }
  /* 그 탭에서 그림 주소(blob: · https)를 받는다 → { type, size, base64 } | { error }. 받기가 안 되면 화면에 그려진 같은 주소의 <img> 를 캔버스로(PNG) */
  async function tabGrab(src, maxBytes) {
    const b64 = (blob) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.onerror = () => rej(fr.error || new Error('파일을 읽지 못했습니다')); fr.readAsDataURL(blob); });
    const pack = async (blob) => (blob.size > maxBytes ? { error: `${(blob.size / 1048576).toFixed(1)}MB 로 한도를 넘었습니다`, size: blob.size } : { type: blob.type || '', size: blob.size, base64: await b64(blob) });
    try {
      const r = await fetch(src, { credentials: 'include' });
      if (r.ok) { const blob = await r.blob(); if (blob.size && !/^text\/html/i.test(blob.type || '')) return await pack(blob); }
    } catch (e) {}
    const img = Array.from(document.images).find((x) => x.currentSrc === src || x.src === src);
    if (img && img.complete && img.naturalWidth) {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
        if (blob) return await pack(blob);
      } catch (e) {}
    }
    return { error: '그림을 받지 못했습니다 — 그 대화를 연 채로 다시 끌어 놓으세요' };
  }

  /* ---------- 백그라운드 ---------- */
  const bytesToB64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const b64Size = (b64) => { const s = String(b64 || ''); return Math.floor(s.length * 3 / 4) - (s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0); };
  async function windowOf(sender) {
    if (sender && sender.tab && sender.tab.windowId != null) return sender.tab.windowId;   // eClass 패널
    try { const w = await chrome.windows.getLastFocused(); return w ? w.id : null; } catch (e) { return null; }   // 사이드 패널 — 방금 놓은 창
  }
  /* 그 사이트 탭들 — 그 창의 앞 탭이 먼저, 그다음 최근에 본 차례 */
  async function siteTabs(urls, win) {
    let tabs = [];
    try { tabs = await chrome.tabs.query({ url: urls }); } catch (e) { return []; }
    const front = (t) => (t.active && t.windowId === win ? 1 : 0);
    return (tabs || []).sort((a, b) => (front(b) - front(a)) || ((b.lastAccessed || 0) - (a.lastAccessed || 0)));
  }
  const URLS_OF = { gmail: GMAIL_URLS, outlook: OUTLOOK_URLS, teams: TEAMS_URLS, onedrive: ONEDRIVE_URLS };
  /* 끌어 온 데이터가 건너오지 않았을 때: 탭들이 남긴 마지막 끌기 중 FRESH_MS 안의 가장 새 것 (읽은 탭의 기록은 지움) */
  async function lastDrag(win) {
    let best = null;
    for (const t of (await siteTabs([].concat(GMAIL_URLS, OUTLOOK_URLS, TEAMS_URLS, ONEDRIVE_URLS), win)).slice(0, 8)) {
      let r = null;
      try { r = ((await chrome.scripting.executeScript({ target: { tabId: t.id }, func: () => window.__krxMailDrag || null })) || [])[0]; } catch (e) { continue; }
      const rec = r && r.result;
      if (rec && Array.isArray(rec.items) && rec.items.length && Date.now() - (Number(rec.at) || 0) < FRESH_MS && (!best || rec.at > best.rec.at)) best = { rec, tab: t };
    }
    if (!best) return null;
    try { await chrome.scripting.executeScript({ target: { tabId: best.tab.id }, func: () => { window.__krxMailDrag = null; } }); } catch (e) {}
    return { drop: { site: SITES.includes(best.rec.site) ? best.rec.site : 'link', items: best.rec.items.slice(0, MAX_ITEMS) }, tab: best.tab };
  }
  /* 주소로 받기 — 백그라운드가 쿠키를 실어(host_permissions 가 있는 사이트만 CORS 없이 받힘). SharePoint 파일 주소는 REST $value 로 */
  async function fromUrl(it) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), FETCH_MS);
    try {
      const r = await fetch(spFileUrl(it.url), { credentials: 'include', cache: 'no-store', signal: ac.signal });
      if (r.status === 401 || r.status === 403) throw new Error(`HTTP ${r.status} — 그 사이트에 로그인돼 있지 않거나 이 파일을 볼 권한이 없습니다`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const len = Number(r.headers.get('content-length')) || 0;
      if (len > MAX_MB * 1048576) return { name: it.name || '', size: len };
      const blob = await r.blob();
      const name = one(it.name) || dispositionName(r.headers.get('content-disposition')) || urlName(it.url) || 'attachment';
      if (/^text\/html/i.test(blob.type || '') && !/\.html?$/i.test(name)) throw new Error('파일 대신 웹페이지가 왔습니다 — 그 사이트 로그인이 풀렸거나 파일 링크가 아닙니다');
      return { name, mime: blob.type || '', size: blob.size, b64: bytesToB64(new Uint8Array(await blob.arrayBuffer())) };
    } catch (e) {
      if (e && e.name === 'AbortError') throw new Error(`${FETCH_MS / 1000}초 안에 받지 못했습니다`);
      if (/failed to fetch/i.test(String((e && e.message) || e))) throw new Error('받지 못했습니다 — 이 사이트에 접근 권한이 없거나 로그인이 필요합니다');
      throw e;
    } finally { clearTimeout(t); }
  }
  /* OneDrive "내 파일" 맨 위의 파일 → 내 OneDrive 주소(PersonalUrl)/Documents/이름 */
  async function rootUrl(origin, name) {
    const r = await fetch(`${origin}/_api/SP.UserProfiles.PeopleManager/GetMyProperties?$select=PersonalUrl`, { credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json;odata=nometadata' } });
    const j = r.ok ? await r.json().catch(() => null) : null;
    if (!j || !j.PersonalUrl) throw new Error(`내 OneDrive 주소를 찾지 못했습니다(HTTP ${r.status}) — 파일이 든 폴더를 열고 다시 끌어 놓으세요`);
    return `${String(j.PersonalUrl).replace(/\/+$/, '')}/Documents/${encodeURIComponent(name)}`;
  }
  async function inTab(tab, func, args) {
    const res = await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', func, args });
    return res && res[0] ? res[0].result : null;
  }
  async function fromCard(tab, it, site) {
    const out = await inTab(tab, mailFetch, [[{ name: it.name, id: it.id || '', size: it.size || 0 }], { site, maxBytes: MAX_MB * 1048576, waitMs: TAB_WAIT_MS }]);
    const r = Array.isArray(out) ? out[0] : null;
    if (!r) throw new Error(`${SITE_NAME[site]} 탭에서 답이 없습니다 — 그 화면을 연 채로 다시 끌어 놓으세요`);
    if (r.error) throw new Error(r.error);
    if (r.href) return fromUrl({ name: r.name || it.name, url: r.href });   // blob 이 아닌 내려받기 주소(SharePoint download.aspx · 클라우드 첨부 등) — 쿠키를 실어 받아 봄
    return { name: one(r.name) || it.name, mime: r.type || '', size: Number(r.size) || b64Size(r.base64), b64: String(r.base64 || '') };
  }
  async function fromSrc(tab, it) {
    let why = '';
    if (tab) {
      const r = await inTab(tab, tabGrab, [it.src, MAX_MB * 1048576]).catch((e) => ({ error: String((e && e.message) || e) }));
      if (r && r.base64) return { name: it.name, mime: r.type || '', size: Number(r.size) || b64Size(r.base64), b64: r.base64 };
      if (r && r.size) return { name: it.name, size: r.size };   // 한도 넘음 → take 가 알림
      why = (r && r.error) || '';
    }
    if (/^https:/i.test(it.src)) return fromUrl({ name: it.name, url: it.src });
    throw new Error(why || '그림이 있는 탭을 찾지 못했습니다 — 그 대화를 연 채로 다시 끌어 놓으세요');
  }

  /* 'prepMailDrop' { key, meta, drop } → { ok, entry, added, failed: [{ name, why }], site } — 한 개도 못 받으면 ok 지만 added 0 */
  async function take(msg, sender) {
    const key = String((msg && msg.key) || '');
    if (!key) return { ok: false, error: '거래 키가 없습니다' };
    const meta = (msg && msg.meta) || {};
    const win = await windowOf(sender);
    let drop = msg.drop && Array.isArray(msg.drop.items) && msg.drop.items.length ? { site: String(msg.drop.site || ''), items: msg.drop.items.slice(0, MAX_ITEMS) } : null;
    let tab = null;
    if (!drop) { const r = await lastDrag(win); if (r) ({ drop, tab } = r); }
    if (!drop) return { ok: false, error: '끌어 놓은 것에서 첨부를 알아보지 못했습니다 — Gmail·Outlook 메일의 첨부, Teams 채팅의 파일·그림, OneDrive 파일을 끌어 놓거나 내려받은 파일을 놓으세요' };
    const site = SITES.includes(drop.site) ? drop.site : 'link';
    const needTab = site === 'outlook' || site === 'teams' || site === 'gmail';
    if (!tab && needTab) tab = (await siteTabs(URLS_OF[site], win))[0] || null;
    const files = [], failed = [];
    for (const it of drop.items) {
      const label = one(it && it.name) || (it && it.url ? urlName(it.url) : '') || '(이름 모름)';
      try {
        let got;
        if (it.src) got = await fromSrc(tab, it);
        else if (it.url) got = await fromUrl(it);
        else if (it.root) got = await fromUrl({ name: it.name, url: await rootUrl(it.root, it.name) });
        else if (site === 'outlook' || site === 'teams') { if (!tab) throw new Error(`첨부를 받을 ${SITE_NAME[site]} 탭을 찾지 못했습니다 — 그 화면을 연 채로 다시 끌어 놓으세요`); got = await fromCard(tab, it, site); }
        else throw new Error('받을 주소가 없습니다');
        const name = withExt(one(got.name) || label, got.mime);
        const ext = extOf(name);
        if (got.size > MAX_MB * 1048576) throw new Error(`${MAX_MB}MB 초과 — 내려받아 직접 넣으세요`);
        if (ext == null || DENY_EXT.has(ext)) throw new Error('첨부할 수 없는 종류');
        if (!got.b64 || !got.size) throw new Error('빈 파일');
        const given = String(got.mime || '').split(';')[0].trim();
        files.push({ name, mime: mimeOf(name) || (given && given !== 'application/octet-stream' ? given : '') || 'application/octet-stream', b64: got.b64,
          url: (tab && tab.url) || (it.url && site === 'onedrive' ? it.url : ''), title: `${SITE_NAME[site]}${site === 'gmail' || site === 'outlook' ? ' 메일' : ''} 첨부` });   // 파일 칩의 출처 링크 = 그 메일·대화 화면(OneDrive 는 그 파일)
      } catch (e) { failed.push({ name: label, why: String((e && e.message) || e) }); }
    }
    let entry = null;
    for (const f of files) entry = await KRX_PREP_STORE.addFiles(key, meta, [f]);   // 한 파일씩 (끌어다 놓은 파일과 같은 저장)
    return { ok: true, entry, added: files.length, failed, site };
  }

  g.KRX_MAIL_DROP = { TYPE, MAX_MB, GMAIL_URLS, OUTLOOK_URLS, TEAMS_URLS, ONEDRIVE_URLS, SITE_NAME, siteOf, parseDrop, dispositionName, mimeOf, withExt, spFileUrl, mailFetch, tabGrab, take };
})(typeof self !== 'undefined' ? self : this);
