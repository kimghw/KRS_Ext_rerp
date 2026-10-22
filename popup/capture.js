/* 화면 캡처 첨부 (0.8.5, 사이드 패널 전용) — 청구 준비 줄의 "화면 전체" · "영역 선택" 버튼(lib/render.js prepControls, prepCtx.capture).
 * 사이드 패널 왼쪽(같은 창의 활성 탭) 웹페이지를 캡처해 그 거래의 첨부 파일로 저장한다(lib/prep.js bind 가 돌려준 addFilesTo → 끌어다 놓은 파일과 같은 저장 경로).
 *   화면 전체: 페이지를 위에서부터 한 화면씩 스크롤하며 chrome.tabs.captureVisibleTab 으로 찍어 세로로 이어 붙인다. 문서가 스크롤되지 않으면 화면에서 가장 큰 스크롤 영역(요소)을,
 *     그것도 없으면 보이는 부분만 찍는다. 둘째 장부터는 position fixed/sticky 요소를 잠깐 숨겨(머리글이 장마다 반복되지 않게) 끝나면 스크롤 위치와 함께 되돌린다. 높이는 MAX_CSS_H 까지.
 *     프레임(iframe) 안에서 스크롤되는 화면(R&D ERP 등)은 보이는 부분만 찍힌다.
 *   영역 선택: 페이지에 반투명 막을 씌우고 끌어서 고른 사각형을 찍어 한 장씩 저장한다. 막은 고를 때마다 다시 씌워 Esc·막의 "끝내기"·패널의 "끝내기"까지 여러 장을 이어서 고른다.
 * 페이지에 넣는 함수(pickArea·fullPrep·fullStep·fullDone)는 chrome.scripting.executeScript 로 확장 격리 월드에서 돈다(같은 프레임에서는 전역이 이어짐 → window.__krxCap*).
 * 권한: 아무 사이트나 찍어야 하므로 manifest optional_host_permissions <all_urls> 를 처음 누를 때 요청한다(Chrome 확인 창 한 번, 클릭 안에서 맨 먼저 불러야 함).
 * 파일: PNG 가 500KB(일부 과제의 첨부 규칙 P: jpg/png 500KB 이하, content/rnd-claim.js)를 넘으면 JPEG 품질을 낮춰 맞추고, 그래도 넘으면 읽기 좋은 품질로 두고 크기를 알린다.
 * 상태는 state.capBusy = { key, mode, n(저장한 장 수), step, steps } — 렌더러가 그 줄에 진행 문구와 "끝내기"를 그린다 */
(function (g) {
  const ALL = { origins: ['<all_urls>'] };
  const MAX_CSS_H = 20000;          // 화면 전체 최대 높이(CSS px)
  const MAX_PX_H = 30000, MAX_AREA = 160e6;   // 캔버스 한계 안쪽 (넘으면 줄여서 그림)
  const SHOT_GAP_MS = 600;          // captureVisibleTab 은 초당 2번까지
  const TARGET_BYTES = 500 * 1024;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- 페이지에 넣는 함수 (자기 완결: 바깥 변수를 쓰지 않음) ---------- */
  function pickArea(count) {
    return new Promise((resolve) => {
      if (window.__krxCapCancel) { try { window.__krxCapCancel(); } catch (e) {} }
      const host = document.createElement('div');
      host.style.cssText = 'all:initial;position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:2147483647;cursor:crosshair;';
      const sh = host.attachShadow({ mode: 'closed' });
      sh.innerHTML = `<style>
        .dim{position:fixed;inset:0;background:rgba(15,23,42,.28)}
        .box{position:fixed;display:none;border:2px solid #2f7bf5;background:rgba(47,123,245,.06);box-shadow:0 0 0 100vmax rgba(15,23,42,.38)}
        .size{position:fixed;display:none;font:11px/16px "Segoe UI","Malgun Gothic",sans-serif;color:#fff;background:#2f7bf5;padding:0 5px;border-radius:3px}
        .bar{position:fixed;top:12px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:10px;padding:7px 8px 7px 12px;border-radius:8px;background:#1f4e9c;color:#fff;
          font:13px/1.4 "Segoe UI","Malgun Gothic",sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.28);cursor:default;white-space:nowrap}
        .bar b{font-weight:700}
        .bar button{font:inherit;font-size:12px;padding:2px 10px;border-radius:5px;border:1px solid rgba(255,255,255,.6);background:rgba(255,255,255,.14);color:#fff;cursor:pointer}
        .bar button:hover{background:rgba(255,255,255,.26)}
      </style><div class="dim"></div><div class="box"></div><div class="size"></div>
      <div class="bar"><span>첨부할 영역을 끌어서 고르세요${count ? ` · <b>${count}장</b> 추가됨` : ''} · 고를 때마다 한 장씩 · Esc 로 끝</span><button type="button">끝내기</button></div>`;
      const dim = sh.querySelector('.dim'), box = sh.querySelector('.box'), size = sh.querySelector('.size'), bar = sh.querySelector('.bar');
      let start = null, cur = null, done = false;
      const rectOf = () => { const x = Math.min(start.x, cur.x), y = Math.min(start.y, cur.y); return { x, y, w: Math.abs(cur.x - start.x), h: Math.abs(cur.y - start.y) }; };
      const cleanup = () => { done = true; window.removeEventListener('keydown', onKey, true); host.remove(); if (window.__krxCapCancel === cancel) window.__krxCapCancel = null; };
      const finish = (v) => { if (done) return; cleanup(); requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => resolve(v), 30))); };   // 막이 화면에서 사라진 뒤에 찍게
      const cancel = () => finish({ cancel: true });
      const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); } };
      window.__krxCapCancel = cancel;
      window.addEventListener('keydown', onKey, true);
      bar.addEventListener('pointerdown', (e) => e.stopPropagation());
      bar.querySelector('button').addEventListener('click', (e) => { e.stopPropagation(); cancel(); });
      host.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        try { host.setPointerCapture(e.pointerId); } catch (err) {}
        start = cur = { x: e.clientX, y: e.clientY };
        dim.style.display = 'none'; bar.style.display = 'none';
      });
      host.addEventListener('pointermove', (e) => {
        if (!start) return;
        cur = { x: Math.max(0, Math.min(innerWidth, e.clientX)), y: Math.max(0, Math.min(innerHeight, e.clientY)) };
        const r = rectOf();
        Object.assign(box.style, { display: 'block', left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
        Object.assign(size.style, { display: 'block', left: r.x + 'px', top: Math.max(0, r.y - 18) + 'px' });
        size.textContent = `${Math.round(r.w)} × ${Math.round(r.h)}`;
      });
      host.addEventListener('pointerup', () => {
        if (!start) return;
        const r = rectOf(); start = cur = null;
        if (r.w < 6 || r.h < 6) { box.style.display = size.style.display = 'none'; dim.style.display = ''; bar.style.display = ''; return; }   // 클릭만 한 것은 무시
        finish({ rect: r, vw: innerWidth, vh: innerHeight });
      });
      (document.body || document.documentElement).appendChild(host);
    });
  }
  function cancelPick() { if (window.__krxCapCancel) { try { window.__krxCapCancel(); } catch (e) {} return true; } return false; }

  function fullPrep() {
    const se = document.scrollingElement || document.documentElement;
    const vw = innerWidth, vh = innerHeight;
    const canScroll = (el) => { const t = el.scrollTop; el.scrollTop = t + 1; const ok = el.scrollTop !== t; el.scrollTop = t; return ok; };
    let kind = 'none', el = null, rect = { x: 0, y: 0, w: vw, h: vh }, total = vh;
    if (se.scrollHeight > se.clientHeight + 4 && canScroll(se)) {
      kind = 'doc'; el = se; rect = { x: 0, y: 0, w: se.clientWidth || vw, h: se.clientHeight || vh }; total = se.scrollHeight;
    } else {   // 문서가 안 움직이면 화면에서 가장 크게 보이는 스크롤 요소
      let best = null, bestArea = 0;
      for (const x of document.body ? document.body.querySelectorAll('*') : []) {
        if (x.scrollHeight <= x.clientHeight + 20 || x.clientHeight < 120) continue;
        const oy = getComputedStyle(x).overflowY;
        if (oy !== 'auto' && oy !== 'scroll' && oy !== 'overlay') continue;
        const r = x.getBoundingClientRect();
        const a = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
        if (a > bestArea) { best = x; bestArea = a; }
      }
      if (best) {
        const r = best.getBoundingClientRect();
        const x0 = Math.max(0, r.left + best.clientLeft), y0 = Math.max(0, r.top + best.clientTop);
        kind = 'el'; el = best; total = best.scrollHeight;
        rect = { x: x0, y: y0, w: Math.min(vw, r.left + best.clientLeft + best.clientWidth) - x0, h: Math.min(vh, r.top + best.clientTop + best.clientHeight) - y0 };
      }
    }
    const scope = kind === 'el' ? el : document.body || document.documentElement;
    const pinned = [];   // 둘째 장부터 숨길 fixed/sticky 요소 (문서 전체면 fixed+sticky, 요소면 그 안의 sticky)
    if (kind !== 'none') {
      for (const x of scope.querySelectorAll('*')) {
        const p = getComputedStyle(x).position;
        if (p === 'sticky' || (p === 'fixed' && kind === 'doc')) pinned.push(x);
        if (pinned.length > 400) break;
      }
    }
    window.__krxFull = { kind, el, y0: kind === 'doc' ? scrollY : kind === 'el' ? el.scrollTop : 0, pinned, hidden: null };
    return { kind, rect, total, view: rect.h, vw, vh };
  }
  function fullStep(y, hidePinned) {
    const st = window.__krxFull; if (!st) return { error: '준비 정보가 없습니다' };
    if (hidePinned && !st.hidden) {
      st.hidden = st.pinned.map((x) => [x, x.style.getPropertyValue('visibility'), x.style.getPropertyPriority('visibility')]);
      for (const x of st.pinned) x.style.setProperty('visibility', 'hidden', 'important');
    }
    if (st.kind === 'doc') window.scrollTo({ top: y, left: scrollX, behavior: 'instant' });
    else if (st.kind === 'el') st.el.scrollTo({ top: y, behavior: 'instant' });
    return new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => res({ y: st.kind === 'doc' ? scrollY : st.kind === 'el' ? st.el.scrollTop : 0 }), 60))));
  }
  function fullDone() {
    const st = window.__krxFull; if (!st) return false;
    for (const [x, v, p] of st.hidden || []) { if (v) x.style.setProperty('visibility', v, p); else x.style.removeProperty('visibility'); }
    if (st.kind === 'doc') window.scrollTo({ top: st.y0, left: scrollX, behavior: 'instant' });
    else if (st.kind === 'el') st.el.scrollTo({ top: st.y0, behavior: 'instant' });
    window.__krxFull = null;
    return true;
  }

  /* ---------- 사이드 패널 쪽 ---------- */
  async function exec(tabId, func, args) {
    const r = await chrome.scripting.executeScript({ target: { tabId }, func, args: args || [] });
    return r && r[0] ? r[0].result : undefined;
  }
  async function bitmapOf(dataUrl) { return createImageBitmap(await (await fetch(dataUrl)).blob()); }
  async function encode(canvas) {   // PNG → 500KB 넘으면 JPEG 품질을 낮춰 맞춤. 끝내 넘으면 0.85 로
    const png = await canvas.convertToBlob({ type: 'image/png' });
    if (png.size <= TARGET_BYTES) return png;
    let keep = null;
    for (const q of [0.92, 0.85, 0.75, 0.65]) {
      const j = await canvas.convertToBlob({ type: 'image/jpeg', quality: q });
      if (q === 0.85) keep = j;
      if (j.size <= TARGET_BYTES) return j;
    }
    return keep;
  }
  const bigNote = (blob) => blob && blob.size > TARGET_BYTES ? ' · 500KB 가 넘어 첨부 규칙이 “500KB 이하”인 과제에서는 빠질 수 있습니다(영역 선택으로 나눠 찍으면 작아짐)' : '';
  const stamp = () => { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; };
  const siteOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, '').replace(/[^a-z0-9.-]/gi, '_').slice(0, 40) || 'page'; } catch (e) { return 'page'; } };
  // src: 캡처한 탭의 { url, title } — File 에 얹어 두면 lib/prep.js addFiles 가 저장소에 출처로 넣는다(파일 칩 ↗ · Claude 청구내역 참고)
  const fileOf = (blob, site, tag, src) => Object.assign(new File([blob], `capture_${site}_${stamp()}${tag}.${blob.type === 'image/png' ? 'png' : 'jpg'}`, { type: blob.type }), src ? { src } : {});
  const srcOf = async (tabId) => { try { const t = await chrome.tabs.get(tabId); return t && t.url ? { url: t.url, title: t.title || '' } : null; } catch (e) { return null; } };

  function bind(host, state, draw, prep) {
    let session = null;   // { key, mode, tabId, windowId, stop }
    const note = (key, msg, err) => { if (prep && prep.note) prep.note(key, msg, err); };
    const busy = (patch) => { state.capBusy = patch ? Object.assign({}, state.capBusy || {}, patch) : null; draw(); };

    async function activeTab() {
      const win = await chrome.windows.getCurrent();
      const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
      if (!tab) throw new Error('캡처할 탭이 없습니다');
      const url = String(tab.url || '');
      if (!/^(https?|file):/i.test(url) || /^https:\/\/(chrome\.google\.com\/webstore|chromewebstore\.google\.com)/i.test(url)) throw new Error('이 탭(Chrome 화면·확장 페이지·웹 스토어)은 캡처할 수 없습니다 — 캡처할 웹페이지를 왼쪽에 띄우세요');
      return { tab, windowId: win.id };
    }
    async function shot(windowId, tabId) {
      const t = await chrome.tabs.get(tabId);
      if (!t.active) throw new Error('캡처하던 탭이 바뀌었습니다');
      return chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
    }

    async function runArea(s, site) {
      for (;;) {
        let r;
        try { r = await exec(s.tabId, pickArea, [s.n]); }
        catch (e) { if (s.n) break; throw new Error(`이 페이지에는 영역 선택을 띄울 수 없습니다 (${String((e && e.message) || e).slice(0, 80)}) — 화면 전체를 쓰세요`); }
        if (!r || r.cancel || s.stop) break;
        const bmp = await bitmapOf(await shot(s.windowId, s.tabId));
        const k = bmp.width / r.vw;
        const w = Math.max(1, Math.round(r.rect.w * k)), h = Math.max(1, Math.round(r.rect.h * k));
        const cv = new OffscreenCanvas(w, h);
        cv.getContext('2d').drawImage(bmp, Math.round(r.rect.x * k), Math.round(r.rect.y * k), w, h, 0, 0, w, h);
        const blob = await encode(cv);
        await prep.addFilesTo(s.key, [fileOf(blob, site, `_${s.n + 1}`, await srcOf(s.tabId))]);
        s.n++; busy({ n: s.n });
        if (blob.size > TARGET_BYTES) s.big = true;
      }
    }
    async function runFull(s, site) {
      let info = null;
      try { info = await exec(s.tabId, fullPrep); } catch (e) { info = null; }
      if (!info || info.kind === 'none') {   // 스크립트를 못 넣는 페이지(PDF 보기 등)이거나 스크롤할 곳이 없으면 보이는 부분만
        const bmp = await bitmapOf(await shot(s.windowId, s.tabId));
        const cv = new OffscreenCanvas(bmp.width, bmp.height); cv.getContext('2d').drawImage(bmp, 0, 0);
        await prep.addFilesTo(s.key, [fileOf(await encode(cv), site, '', await srcOf(s.tabId))]);
        s.n = 1;
        return info ? '' : ' (보이는 부분만 — 이 페이지는 스크롤해 찍을 수 없음)';
      }
      const totalCss = Math.min(info.total, MAX_CSS_H);
      const ys = []; for (let y = 0; y < totalCss; y += info.view) ys.push(y);
      let cv = null, ctx = null, k = 1, out = 1, last = 0;
      try {
        for (let i = 0; i < ys.length && !s.stop; i++) {
          busy({ step: i + 1, steps: ys.length });
          const st = await exec(s.tabId, fullStep, [ys[i], i > 0]);
          if (!st || st.error) throw new Error((st && st.error) || '스크롤하지 못했습니다');
          const wait = SHOT_GAP_MS - (Date.now() - last); if (wait > 0) await sleep(wait);
          last = Date.now();
          const bmp = await bitmapOf(await shot(s.windowId, s.tabId));
          if (!cv) {
            k = bmp.width / info.vw;
            const W = info.rect.w * k, H = totalCss * k;
            out = Math.min(1, MAX_PX_H / H, Math.sqrt(MAX_AREA / (W * H)));
            cv = new OffscreenCanvas(Math.max(1, Math.round(W * out)), Math.max(1, Math.round(H * out)));
            ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
          }
          ctx.drawImage(bmp, info.rect.x * k, info.rect.y * k, info.rect.w * k, info.rect.h * k, 0, st.y * k * out, info.rect.w * k * out, info.rect.h * k * out);
          if (st.y + info.view >= totalCss) break;   // 끝에 닿음 (마지막 장은 덜 내려가 겹침)
        }
      } finally { try { await exec(s.tabId, fullDone); } catch (e) {} }
      if (!cv || s.stop) return null;
      const blob = await encode(cv);
      await prep.addFilesTo(s.key, [fileOf(blob, site, '', await srcOf(s.tabId))]);
      s.n = 1;
      return (info.total > MAX_CSS_H ? ` (너무 길어 위에서 ${MAX_CSS_H.toLocaleString()}px 까지만)` : '') + bigNote(blob);
    }

    async function start(key, mode) {
      if (session) return;
      let at;
      try { at = await activeTab(); } catch (e) { note(key, String(e.message || e), true); return; }
      const s = session = { key, mode, tabId: at.tab.id, windowId: at.windowId, stop: false, n: 0 };
      busy({ key, mode, n: 0, step: 0, steps: 0 });
      const site = siteOf(at.tab.url);
      try {
        if (mode === 'area') { await runArea(s, site); if (s.n) note(key, `영역 ${s.n}장을 첨부 파일로 저장했습니다${s.big ? bigNote({ size: TARGET_BYTES + 1 }) : ''}`); }
        else { const extra = await runFull(s, site); if (extra != null) note(key, `페이지 캡처를 첨부 파일로 저장했습니다${extra}`, false); }
      } catch (e) { note(key, `캡처 실패: ${String((e && e.message) || e)}`, true); }
      finally { session = null; busy(null); }
    }
    function stop() {
      if (!session) return;
      session.stop = true;
      if (session.mode === 'area') exec(session.tabId, cancelPick).catch(() => {});
    }

    host.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-act="prep-cap"], [data-act="prep-cap-stop"]');
      if (!btn) return;
      ev.preventDefault();
      if (btn.dataset.act === 'prep-cap-stop') { stop(); return; }
      const key = btn.dataset.key, mode = btn.dataset.mode === 'area' ? 'area' : 'full';
      if (session) return;
      // 권한 요청은 클릭 안에서 맨 먼저 (이미 있으면 확인 창 없이 true)
      chrome.permissions.request(ALL).then((ok) => {
        if (!ok) { note(key, '다른 사이트 화면을 캡처하려면 Chrome 확인 창에서 허용해야 합니다', true); return; }
        start(key, mode);
      }, (e) => note(key, `권한 요청 실패: ${String((e && e.message) || e)}`, true));
    });
  }

  g.KRX_CAP = { bind };
})(typeof self !== 'undefined' ? self : this);
