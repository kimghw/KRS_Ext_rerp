/* 청구 준비 줄 💬(사이트 안내 고치기)의 채팅 — 누르면 그 거래의 첨부 구역 바로 아래에 열린다 (사이드 패널·팝업 같은 확장 페이지만, 2026-10-22 사용자 "채팅 버튼 누르면 바로 아래 채팅창을 열어줘").
 * 설정 페이지 › 자주 사용 가맹점의 찾는 방법 익히기(options/fetch-chat.js)와 같은 길: 글 = KRX_SITES.buildPrompt(가맹점, 종류별 필요 서류, 이 거래, 요청 한 줄) → 이 PC 의 Help 서버 POST /ask(chat 'fetch-site') → GET /job 폴링.
 * 마지막 요청은 같은 storage.local.fetchChat 이라 설정 페이지와 같은 작업을 보인다(서버 줄도 하나). 끝나면 답변의 howto: 줄을 그 가맹점의 기억한 찾는 방법으로 바로 저장한다(fetchSiteSave — 설정 페이지는 칸만 채우고 저장은 사용자).
 * eClass 패널(콘텐츠 스크립트)은 이 PC 의 서버를 부를 수 없어 예전처럼 설정 페이지를 연다(lib/prep.js prep-fetch-chat).
 * 그리기는 lib/render.js prepChatHtml 이 state.prepChat({ key, siteId, draft, log }) · state.fetchChat(마지막 요청) · state.fetchChatLog({ lines, detail, note }) 로 */
(() => {
  const KEY = 'fetchChat', FROM = '사이드 패널 › 청구 준비', DEFAULT_URL = 'http://127.0.0.1:8106';
  const baseUrl = (u) => { const s = String(u || '').trim().replace(/\/+$/, ''); return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(s) ? s : DEFAULT_URL; };   // 이 PC 만 (popup/help.js 와 같음)
  const metaOf = (row) => { try { return JSON.parse((row && row.dataset.prepMeta) || '{}'); } catch (e) { return {}; } };
  const day = (d) => { const a = String(d || '').replace(/\D/g, ''); return a.length >= 8 ? `${a.slice(0, 4)}-${a.slice(4, 6)}-${a.slice(6, 8)}` : String(d || ''); };
  let inst = null;

  function bind(host, state, draw) {
    let lines = [], next = 0, detail = '', note = null /* { text, err } 일시 문구 */, timer = 0, watching = '';
    const redraw = () => { state.fetchChatLog = { lines, detail, note }; if (state.prepChat) draw(); };
    const save = () => chrome.storage.local.set({ [KEY]: state.fetchChat }).catch(() => {});
    async function base() { try { const s = await KRX_SETTINGS.load(); return baseUrl(s && s.help && s.help.url); } catch (e) { return DEFAULT_URL; } }
    async function call(path, body) {
      const b = await base();
      let res;
      try { res = await fetch(b + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' }); }
      catch (e) { return { ok: false, kind: 'offline', error: `Help 서버에 연결할 수 없습니다 (${b}) — 이 PC 에서 node help-server/server.js 를 실행하세요` }; }
      try { const j = await res.json(); return j && typeof j === 'object' ? j : { ok: false, kind: 'parse', error: '서버 응답을 읽지 못했습니다' }; }
      catch (e) { return { ok: false, kind: 'http', error: `Help 서버 오류 ${res.status}` }; }
    }
    /* 답변의 howto: 줄 → 그 가맹점의 기억한 찾는 방법 (다음 찾아오기·요청에 참고로). 저장했으면 true */
    async function saveHowto(siteId, howto) {
      if (!siteId || !howto) return false;
      try {
        const site = (await KRX_SITES.load()).find((s) => s.id === siteId);
        if (!site) return false;
        const r = await chrome.runtime.sendMessage({ type: 'fetchSiteSave', site: Object.assign({}, site, { howto }) });
        return !!(r && r.ok);
      } catch (e) { return false; }
    }

    async function poll() {
      const c0 = state.fetchChat;
      if (!c0 || !c0.id) return;
      const id = c0.id;
      const r = await call(`/job?id=${encodeURIComponent(id)}&since=${next}`);
      if (!state.fetchChat || state.fetchChat.id !== id) return;
      let c = state.fetchChat;
      if (r.ok) {
        note = null;
        lines = lines.concat(r.lines || []); next = r.next || lines.length;
        const j = r.job || {};
        detail = j.detail || '';
        if (j.state !== 'running' || c.state !== 'running' || !c.text) {
          const was = c.state;
          c = Object.assign({}, c, { text: c.text || j.text || '', at: j.startedAt || c.at, state: j.state, summary: j.summary || '', error: j.error || '', files: j.files || [], checks: j.checks || [], endedAt: j.endedAt || 0 });
          const howto = c.state === 'done' && c.mine && !c.howtoDone;   // 내가 보낸 요청이 끝남 (설정 페이지가 먼저 봤으면 그쪽이 칸에 채움)
          if (howto) { c.howtoDone = true; c.howto = await saveHowto(c.siteId, KRX_SITES.howtoOf(detail)); }
          state.fetchChat = c;
          if (was !== c.state || howto) await save();
        }
      } else if (r.kind === 'nojob') { state.fetchChat = Object.assign({}, c, { state: 'error', error: '서버에 이 요청의 기록이 없습니다 (서버를 다시 띄웠거나 기록이 지워짐)' }); await save(); }
      else if (c.state === 'running') note = { text: `${r.error} · 다시 연결하는 중…`, err: true };
      redraw();
      clearTimeout(timer);
      if (state.fetchChat && state.fetchChat.id === id && state.fetchChat.state === 'running') timer = setTimeout(poll, r.ok ? 1500 : 5000);
    }
    function watch() {
      clearTimeout(timer);
      const c = state.fetchChat;
      watching = (c && c.id) || '';
      lines = []; next = 0; detail = '';
      if (watching) poll(); else redraw();
    }

    async function send(key, row) {
      const pc = state.prepChat;
      if (!pc || pc.key !== key || (state.fetchChat && state.fetchChat.state === 'running')) return;
      const site = (state.fetchSites || []).find((s) => s.id === pc.siteId);
      if (!site) { note = { text: '이 가맹점의 자주 사용 등록을 찾지 못했습니다 — 설정 › 자주 사용 가맹점', err: true }; redraw(); return; }
      const ask = String(pc.draft || '').trim();
      const m = metaOf(row);
      const docsMap = (((state.data || {}).settings) || {}).fetchDocs || null;   // 설정의 종류별 필요 서류
      const text = KRX_SITES.buildPrompt(site, docsMap, { usedDate: day(m.usedDate), amount: Number(m.amount) || 0, shop: m.shop || '' }, ask);   // 이 거래로 시험하게
      const context = { from: FROM, chat: 'fetch-site', site: { id: site.id || '', label: site.label || '', url: site.url || '', kind: site.kind || '', docs: KRX_SITES.docsOf(site, docsMap) } };   // 아이디·비밀번호는 보내지 않음
      try { context.version = chrome.runtime.getManifest().version; } catch (e) {}
      note = { text: '요청을 보내는 중…' }; redraw();
      const r = await call('/ask', { text, context, fresh: !!(state.fetchChat && state.fetchChat.fresh) });
      if (r.ok || (r.kind === 'busy' && r.id)) {   // busy: 앞선 요청(팝업 Help Chat · 설정 페이지 등)을 이어서 본다 — 쓴 글은 그대로 둠
        state.fetchChat = { id: r.id, text: r.ok ? (ask || `${site.label || site.match} 안내 고치기`) : '', at: Date.now(), state: 'running', mine: !!r.ok, siteId: site.id || '', siteLabel: site.label || site.match || '', howtoDone: false };
        note = r.ok ? null : { text: '앞선 요청을 처리하는 중이라 그것을 이어서 봅니다 — 끝나면 다시 보내세요', err: true };
        if (r.ok) pc.draft = '';
        pc.log = true;
        await save();
        watch();
      } else { note = { text: r.error || '요청을 보내지 못했습니다', err: true }; redraw(); }
    }

    host.addEventListener('click', async (ev) => {
      const btn = ev.target.closest('[data-act^="prep-chat-"]');
      if (!btn || !state.prepChat) return;
      const act = btn.dataset.act, key = btn.dataset.key;
      ev.preventDefault();
      if (act === 'prep-chat-send') send(key, btn.closest('[data-prep-key]'));
      else if (act === 'prep-chat-close') { state.prepChat = null; draw(); }
      else if (act === 'prep-chat-log') { state.prepChat.log = state.prepChat.log === false; redraw(); }
      else if (act === 'prep-chat-stop') { btn.disabled = true; await call('/cancel', {}); clearTimeout(timer); poll(); }
      else if (act === 'prep-chat-new') {   // 이 결과를 지우고 다음 요청은 이전 대화와 잇지 않음 (설정 페이지의 새 대화와 같음)
        clearTimeout(timer); state.fetchChat = { fresh: true }; watching = ''; lines = []; next = 0; detail = ''; note = null;
        await save(); redraw();
        const el = host.querySelector(`[data-prep-chat-in="${CSS.escape(key)}"]`); if (el) el.focus();
      }
    });
    /* 적는 동안은 state.prepChat.draft 에만 (다시 그려져도 글이 남게 — 포커스·커서는 render.js 가 되돌림), Enter 로 보내기 */
    host.addEventListener('input', (ev) => {
      const el = ev.target;
      if (!el || !el.dataset || el.dataset.prepChatIn == null || !state.prepChat) return;
      state.prepChat.draft = el.value;
      if (note && note.err) { note = null; redraw(); }
    });
    host.addEventListener('keydown', (ev) => {
      const el = ev.target;
      if (!el || !el.dataset || el.dataset.prepChatIn == null || ev.key !== 'Enter' || ev.isComposing) return;
      ev.preventDefault();
      send(el.dataset.prepChatIn, el.closest('[data-prep-key]'));
    });
    /* 설정 페이지가 보낸 새 요청·새 대화도 같이 보임 (내가 저장한 것은 id 가 같아 다시 그리기만) */
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area !== 'local' || !ch[KEY]) return;
      const v = ch[KEY].newValue || null;
      const cur = state.fetchChat;
      if (v && cur && v.id === cur.id && v.state === cur.state && v.howtoDone === cur.howtoDone) return;
      state.fetchChat = v;
      if (((v && v.id) || '') !== watching) watch(); else redraw();
    });
    chrome.storage.local.get(KEY).then((l) => { state.fetchChat = l[KEY] || null; if (state.fetchChat && state.fetchChat.id) watch(); }, () => {});   // 진행 중이면 이어서 보고, 끝난 것도 로그를 다시 받아 둔다

    /* 💬: 그 거래 밑 채팅을 열고 닫음. draft = 마지막 찾아오기가 못 찾은 이유(글이 비어 있을 때만) */
    function toggle(key, siteId, draft) {
      if (state.prepChat && state.prepChat.key === key) { state.prepChat = null; draw(); return; }
      state.prepChat = { key, siteId, draft: draft || '', log: true };
      redraw();
      const el = host.querySelector(`[data-prep-chat-in="${CSS.escape(key)}"]`);
      if (el) { el.focus(); el.scrollIntoView({ block: 'nearest' }); }
    }
    inst = { toggle };
    return inst;
  }

  self.KRX_PREP_CHAT = { bind, toggle: (key, siteId, draft) => { if (!inst) return false; inst.toggle(key, siteId, draft); return true; } };
})();
