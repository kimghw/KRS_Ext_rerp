/* 메일·Teams 첨부 끌어 놓기 (2026-10-28 사용자 "outlook 메일이랑 gmail 에서 첨부파일을 증빙첨부로 갖어올 수 있도록 … 첨부파일 리스트를 드래그해서 넣으면 되도록",
 * 이어서 "팀즈에 있는 파일들도 드래그 해서 넣을 수 있도록 해줘. 이미지나 파일." · "onedirve 에서도 파일 드래그 할 수 있또록 해줘.") — Gmail·Outlook·Teams·OneDrive(회사 SharePoint) 웹 탭(최상위 프레임, 격리 월드).
 * 첨부를 끌기 시작할 때(dragstart) 그 첨부(이름·형식·받을 주소 또는 ID)를 알아 두어 청구 준비 줄(lib/prep.js drop → lib/mail-drop.js)이 받게 한다.
 *   1) 끌어 가는 데이터에 'application/x-krx-mail' = JSON { site, items: [{ name, mime?, url?, src?, id?, size? }] } 를 덧붙인다 — 패널의 drop 이 읽는다(KRX_MAIL_DROP.parseDrop).
 *      Gmail: 첨부 카드의 download_url("형식:이름:주소" — 크롬이 바탕화면으로 끌어 내려받을 때 쓰는 값; 크롬은 이 값을 다른 페이지의 drop 에 보이지 않으므로 옮겨 싣는다).
 *      Outlook: 카드에 Outlook 이 싣는 'attachment' JSON(attachmentFiles: 첨부 ID·이름·크기 — kr_ext_workspace src/mailgrab.js 실측)을 옮긴다.
 *      Teams: 파일 카드(파일 이름과 단추가 있는 가장 가까운 조상 — 카드 안 미리보기 그림을 끌어도 그 파일)면 이름과 카드 안 SharePoint 링크(있으면),
 *        아니면 메시지의 그림(아바타·이모지처럼 작은 것은 뺌)의 주소(src — blob: 이면 그 탭 안에서만 받힘).
 *      OneDrive: 파일 줄(선택돼 있으면 선택된 줄 모두)의 이름 + 지금 연 폴더 경로로 만든 파일 주소(onedriveItems).
 *      Teams·OneDrive·Gmail 화면은 실측 전(2026-10-28) — 화면 짜임(클래스)에 기대지 않게 이름(확장자 있는 글자)·역할(role)·단추로만 찾는다.
 *   2) 같은 것을 window.__krxMailDrag = { at, site, items } 에 남긴다 — 끌어 온 데이터가 패널까지 건너오지 않았을 때 백그라운드가 이 탭에서 읽는 대체 길(lib/mail-drop.js lastDrag).
 * 페이지 동작은 바꾸지 않는다(첨부를 끌 때만 덧붙이고 이벤트를 막지 않음). 스크립트가 쏜 dragstart(isTrusted 아님 — mail-drop 의 cardId)는 건너뛴다.
 * 확장을 다시 올리면 background.js 가 열린 탭에 다시 넣는다 — 이전 리스너는 스스로 뗀다 */
(function () {
  if (window.__krxMailDragOff) { try { window.__krxMailDragOff(); } catch (e) {} }
  const TYPE = 'application/x-krx-mail';
  const host = location.hostname;
  const site = /(^|\.)mail\.google\.com$/i.test(host) ? 'gmail' : /(^|\.)teams\.(microsoft\.com|cloud\.microsoft|live\.com)$/i.test(host) ? 'teams' : /\.sharepoint\.com$/i.test(host) ? 'onedrive' : 'outlook';
  const one = (s) => String(s == null ? '' : s).replace(/[​﻿ ]/g, ' ').replace(/\s+/g, ' ').trim();
  const elOf = (t) => (t && t.nodeType === 1 ? t : t && t.parentElement) || null;   // 글자 노드에서 시작한 끌기도
  const closest = (t, sel) => { const el = elOf(t); return el && el.closest ? el.closest(sel) : null; };
  /* "형식:이름:주소" — 주소에 ':' 가 있으므로 주소(http…) 앞까지만 자른다 */
  const splitDl = (v) => { const m = /^([^:]*):(.*?):(https?:\/\/.+)$/i.exec(String(v || '').trim()); return m ? { name: one(m[2]), mime: one(m[1]), url: m[3].trim() } : null; };

  /* Gmail: 첨부 카드(span[download_url], draggable) 안에서 시작한 끌기. download_url 이 없으면 카드 안 첨부 링크(…attid=…)의 주소만 — 이름은 받을 때 Content-Disposition 으로 */
  function gmailItems(t) {
    const card = closest(t, '[download_url]');
    const d = card && splitDl(card.getAttribute('download_url'));
    if (d) return [d];
    const a = closest(t, 'a[href*="attid="]') || (card && card.querySelector('a[href*="attid="]'));
    return a && /^https:\/\/mail\.google\.com\//i.test(a.href) ? [{ name: '', url: a.href }] : [];
  }
  /* Outlook: 첨부 목록([role=listbox])의 카드([role=option]) 안에서 시작한 끌기 */
  const outlookCard = (t) => { const o = closest(t, '[role=option]'); return o && o.closest('[role=listbox]') ? o : null; };
  const cardName = (opt) => { const x = Array.from(opt.querySelectorAll('[title]')).find((el) => !el.closest('button')); return one(x && x.getAttribute('title')); };
  function outlookItems(dt) {
    let j = null;
    try { j = JSON.parse((dt && dt.getData('attachment')) || 'null'); } catch (e) {}
    const files = j && Array.isArray(j.attachmentFiles) ? j.attachmentFiles : [];
    return files.filter((f) => f && f.name).map((f) => ({ name: one(f.name), size: Number(f.size) || 0, id: String(f.attachmentItemId || ''), mime: one(f.ContentType) }));
  }
  /* Teams: 파일 이름 — title(보통 온전한 이름) → 자식 없는 칸의 글자(말줄임은 CSS 라 DOM 에는 온전함) → aria-label 안의 이름 */
  const EXT = '(?:pdf|hwpx?|docx?|xlsx?|pptx?|zip|7z|txt|csv|png|jpe?g|gif|bmp|webp|tiff?|heic|eml|msg)';
  const WHOLE = new RegExp(`^[^\\\\/:*?"<>|\\r\\n]+\\.${EXT}$`, 'i');
  const INSIDE = new RegExp(`([^\\\\/:*?"<>|\\r\\n,]+?\\.${EXT})(?=$|[\\s,;)\\]])`, 'i');
  function fileNameIn(el) {
    const list = [el].concat(Array.from(el.querySelectorAll('*')).slice(0, 200));
    for (const x of list) { const v = one(x.getAttribute && x.getAttribute('title')); if (WHOLE.test(v)) return v; }
    for (const x of list) { if (!x.children || x.children.length) continue; const v = one(x.textContent); if (WHOLE.test(v)) return v; }
    for (const x of list) { const m = INSIDE.exec(one(x.getAttribute && x.getAttribute('aria-label'))); if (m) return one(m[1]); }
    return '';
  }
  function teamsItems(t) {
    for (let el = elOf(t), i = 0; el && el !== document.body && i < 10; el = el.parentElement, i++) {
      if (!el.querySelector('button')) continue;
      const name = fileNameIn(el);
      if (!name) continue;
      const a = el.querySelector('a[href*=".sharepoint.com/"], a[href*="1drv.ms/"], a[href*="onedrive.live.com/"]');
      return [a ? { name, url: a.href } : { name }];
    }
    const img = closest(t, 'img');
    if (!img) return [];
    const r = img.getBoundingClientRect();
    const src = String(img.currentSrc || img.src || '');
    if (r.width < 48 || r.height < 32 || !/^(https?|blob):/i.test(src) || img.closest('[class*="avatar" i], [data-tid*="avatar" i]')) return [];
    const alt = one(img.getAttribute('alt'));
    const d = new Date(), p = (n) => String(n).padStart(2, '0');
    return [{ name: WHOLE.test(alt) ? alt : `teams_image_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`, src }];
  }

  /* OneDrive(회사 — SharePoint 문서함 화면): 파일 줄(목록 행·타일)에서 시작한 끌기. 그 줄이 선택돼 있으면 선택된 줄 모두.
   * 받을 주소 = 지금 연 폴더(주소의 id= · 미리보기면 parent= · /personal/<u>/_layouts/… 면 /personal/<u>/Documents · 사이트 문서함이면 …/Forms/ 앞) + 파일 이름.
   * 폴더를 모르면(새 /my 화면의 "내 파일" 맨 위) root(사이트 주소)만 — 백그라운드가 내 OneDrive 주소로 푼다. 최근 항목·나와 공유 화면처럼 폴더가 주소에 없으면 그 파일이 든 폴더를 열어야 받힘 */
  const ROW = '[role=row], [data-automationid="DetailsRow"], [data-automationid*="Tile" i], [role=listitem], [role=option]';
  function odFolder() {
    const q = new URLSearchParams(location.search);
    let id = q.get('id') || '';
    if (id && /\.[a-z0-9]{1,6}$/i.test(id)) id = q.get('parent') || id.replace(/\/[^/]*$/, '');   // 파일 미리보기 화면
    if (id.startsWith('/')) return id.replace(/\/+$/, '');
    let p = location.pathname;
    try { p = decodeURIComponent(p); } catch (e) {}
    const my = /^(\/personal\/[^/]+)\/_layouts\//i.exec(p);
    if (my) return `${my[1]}/Documents`;
    const lib = /^(\/(?:sites|teams)\/[^/]+\/.+?)\/Forms\//i.exec(p);
    return lib ? lib[1] : '';
  }
  function onedriveItems(t) {
    const row = closest(t, ROW);
    if (!row) return [];
    const grid = row.closest('[role=grid], [role=treegrid], [role=list], [role=listbox]') || document;
    const rows = row.getAttribute('aria-selected') === 'true' ? Array.from(grid.querySelectorAll('[aria-selected="true"]')).filter((r) => r.matches(ROW)) : [row];
    const folder = odFolder();
    const enc = (path) => path.split('/').map(encodeURIComponent).join('/');
    return rows.slice(0, 10).map((r) => {
      const name = fileNameIn(r);
      if (!name) return null;
      return folder ? { name, url: location.origin + enc(`${folder}/${name}`) } : { name, root: location.origin };
    }).filter(Boolean);
  }

  function put(ev, items) {
    if (!items.length) return;
    window.__krxMailDrag = { at: Date.now(), site, items, page: location.href };
    try { ev.dataTransfer.setData(TYPE, JSON.stringify({ site, items })); } catch (e) {}
  }
  /* 앞(capture): 첨부에서 시작한 끌기인지 보고 화면에서 읽을 수 있는 것을 먼저 싣는다 — 페이지가 이벤트를 멈춰도 남게 */
  const onStart = (ev) => {
    if (!ev.isTrusted || !ev.dataTransfer) return;
    if (site === 'gmail') { put(ev, gmailItems(ev.target)); return; }
    if (site === 'teams') { put(ev, teamsItems(ev.target)); return; }
    if (site === 'onedrive') { put(ev, onedriveItems(ev.target)); return; }
    const card = outlookCard(ev.target);
    if (card) { const nm = cardName(card); if (nm) put(ev, [{ name: nm }]); }
  };
  /* 뒤(bubble): Outlook 이 자기 처리기에서 'attachment' 를 채운 뒤 — 정확한 이름·크기·ID 로 바꿔 싣는다 */
  const onStartLate = (ev) => {
    if (!ev.isTrusted || !ev.dataTransfer || site !== 'outlook') return;
    const items = outlookItems(ev.dataTransfer);
    if (items.length) put(ev, items);
  };
  window.addEventListener('dragstart', onStart, true);
  window.addEventListener('dragstart', onStartLate, false);
  window.__krxMailDragOff = () => { window.removeEventListener('dragstart', onStart, true); window.removeEventListener('dragstart', onStartLate, false); };
})();
