/* 설정 페이지 › LLM 설정 › 증빙 찾아오기의 사이트 만들기 채팅 — 가맹점을 고르고(또는 새 사이트) 한 줄 적어 보내면 이 PC 의 Help 서버(help-server/server.js, 팝업 Help Chat 과 같은 POST /ask)가
 * Claude Code 를 이 확장 폴더에서 돌려 fetch-site 스킬(.claude/skills/fetch-site/SKILL.md)대로 사이트를 시험(node site-fetch/run.js, 작업용 Chrome 창)하고 사이트 안내(site-fetch/sites/<이름>.md)·
 * 기억한 찾는 방법(howto)·시험으로 받은 서류(site-fetch-out/)를 만들게 한다. 보내는 글은 lib/fetch-sites.js buildPrompt(가맹점 값 + 요청 한 줄) — 아이디·비밀번호는 넣지 않는다.
 * 진행·결과는 popup/help.js 와 같은 한 줄 로그(GET /job 폴링, 줄을 누르면 펼침). 끝나면 답변의 `howto:` 줄을 그 가맹점의 "기억한 찾는 방법" 칸에 넣고(options.js 가 채우고 저장은 사용자),
 * 확장 파일(lib/fetch-sites.js KNOWN 등)이 바뀌었으면 "적용"(chrome.runtime.reload — 이 페이지는 닫힘). 서버·site-fetch/·문서만 바뀌었으면 적용이 필요 없다(서버는 sites/*.md 를 다음 요청부터 바로 읽음).
 * 마지막 요청은 storage.local.fetchChat = { id, text, at, state, summary, error, files, checks, endedAt, applied, mine, siteId, siteLabel, howtoDone } (쓰던 글은 fetchChatDraft) — 팝업의 helpChat 과 따로.
 * options.js 가 KRX_FETCH_CHAT.init({ base(), sites(), docsMap(), onHowto(siteId, label, howto) }) 로 잇고, 가맹점 목록이 바뀌면 refresh() */
(() => {
  const KEY = 'fetchChat', DRAFT = 'fetchChatDraft', FROM = '설정 페이지 › 증빙 찾아오기';
  const $ = (id) => document.getElementById(id);
  const box = $('fetchChat'), sel = $('fcSite'), input = $('fcText'), btnSend = $('fcSend'), row = $('fcRow'), statusEl = $('fcStatus'), linesEl = $('fcLines'),
    btnApply = $('fcApply'), btnStop = $('fcStop'), btnNew = $('fcNew');
  if (!box || !sel || !input) return;
  let H = null, cur = null, lines = [], next = 0, detail = '', timer = 0, tick = 0, note = null /* { text, err } 일시 문구 */, open = false;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const hms = (t) => { const d = new Date(t); return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':'); };
  const save = () => { try { return chrome.storage.local.set({ [KEY]: cur }); } catch (e) { return Promise.resolve(); } };
  /* 확장이 읽는 파일이 바뀌었을 때만 적용(다시 불러오기)이 필요 — 서버·site-fetch·스킬·문서·시험 결과 폴더는 아님 */
  const needsReload = (files) => (files || []).some((f) => !/^(help-server|tests|site-fetch|site-fetch-out|\.claude)\//.test(f) && !/\.md$/i.test(f));

  async function api(path, body) {
    const base = H.base();
    let res;
    try { res = await fetch(base + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' }); }
    catch (e) { return { ok: false, kind: 'offline', error: `Help 서버에 연결할 수 없습니다 (${base}) — 이 PC 에서 node help-server/server.js 를 실행하세요` }; }
    try { const j = await res.json(); return j && typeof j === 'object' ? j : { ok: false, kind: 'parse', error: '서버 응답을 읽지 못했습니다' }; }
    catch (e) { return { ok: false, kind: 'http', error: `Help 서버 오류 ${res.status} — 주소가 Help 서버가 맞는지 확인하세요 (${base})` }; }
  }

  const siteOf = () => { const v = sel.value; if (!v || !H) return null; return H.sites()[Number(v)] || null; };
  /* 가맹점 select 다시 채움 (options.js 가 목록을 바꿀 때마다) — 고른 것은 유지 */
  function refresh() {
    const list = H ? H.sites() : [];
    const keep = sel.value;
    sel.innerHTML = '<option value="">새 사이트 (요청 글에 이름·주소를 적음)</option>' + list.map((s, i) => `<option value="${i}">${esc(s.label || s.match || '새 가맹점')}</option>`).join('');
    if (keep && list[Number(keep)]) sel.value = keep;
  }

  function render() {
    const running = !!(cur && cur.state === 'running');
    const has = !!(cur && cur.id);
    row.hidden = !has && !note;
    let text = '', cls = '';
    if (note) { text = note.text; cls = note.err ? 'err' : ''; }
    else if (running) {
      const last = lines.filter((l) => l.k !== 'warn').pop();
      text = `⏳ ${mmss(Date.now() - cur.at)} · ${(last && last.s) || '요청을 보냈습니다'}`; cls = 'run';
    } else if (has && cur.state === 'done') {
      const bad = (cur.checks || [])[0], n = (cur.files || []).length;
      text = `${cur.applied ? '✔ 적용됨' : '✔ 완료'} — ${cur.summary || ''}${n ? ` · 수정 ${n}개` : ''}${cur.howto ? ` · 기억한 찾는 방법 채움(저장을 누르세요)` : ''}${bad ? ` · ⚠ 문법 오류 ${bad.file}${needsReload([bad.file]) ? ' (적용 보류 — 고쳐 달라고 다시 요청하세요)' : ''}` : ''}`;
      cls = bad ? 'err' : 'ok';
    } else if (has) { text = `${cur.state === 'canceled' ? '■ 중지됨' : '✖ 실패'} — ${cur.error || ''}`; cls = 'err'; }
    statusEl.textContent = text; statusEl.className = 'help-status ' + cls;
    statusEl.title = has ? `요청: ${cur.text || ''}\n(누르면 로그 펼치기/접기)` : '';
    btnStop.hidden = !running || !!note;
    btnApply.hidden = !(has && cur.state === 'done' && !cur.applied && needsReload(cur.files) && !needsReload((cur.checks || []).map((c) => c.file)));
    btnNew.hidden = running || !has;
    btnSend.disabled = running; input.disabled = running; sel.disabled = running;
    input.placeholder = running ? '처리 중… (이 페이지를 닫아도 계속됩니다)' : '예) 10/06 43,560원 거래로 안내를 만들어 줘';
    linesEl.hidden = !open || !has;
    if (!linesEl.hidden) {
      const stick = linesEl.scrollTop + linesEl.clientHeight >= linesEl.scrollHeight - 8;
      linesEl.innerHTML = lines.map((l) => `<div class="help-line ${esc(l.k)}"><span class="t">${hms(l.t)}</span> ${esc(l.s)}</div>`).join('')
        + (!running && detail && detail.includes('\n') ? `<div class="help-detail">${esc(detail)}</div>` : '')
        + (!running && (cur.files || []).length ? `<div class="help-line info">바뀐 파일: ${esc(cur.files.join(', '))} — 커밋은 하지 않았습니다</div>` : '');
      if (stick) linesEl.scrollTop = linesEl.scrollHeight;
    }
  }

  function stopTimers() { clearTimeout(timer); clearInterval(tick); timer = 0; tick = 0; }
  async function poll() {
    if (!cur || !cur.id) return;
    const id = cur.id;
    const r = await api(`/job?id=${encodeURIComponent(id)}&since=${next}`);
    if (!cur || cur.id !== id) return;
    if (r.ok) {
      note = null;
      lines = lines.concat(r.lines || []); next = r.next || lines.length;
      const j = r.job || {};
      detail = j.detail || '';
      if (j.state !== 'running' || cur.state !== 'running' || !cur.text) {
        const was = cur.state;
        cur = Object.assign({}, cur, { text: cur.text || j.text || '', at: j.startedAt || cur.at, state: j.state, summary: j.summary || '', error: j.error || '', files: j.files || [], checks: j.checks || [], endedAt: j.endedAt || 0 });
        if (cur.state === 'done' && cur.mine && !cur.howtoDone) {   // 내가 보낸 요청이 끝남 → 답변의 howto: 줄을 그 가맹점의 기억한 찾는 방법 칸에
          const h = self.KRX_SITES ? KRX_SITES.howtoOf(detail) : '';
          cur.howtoDone = true;
          if (h && H.onHowto) { try { cur.howto = !!H.onHowto(cur.siteId, cur.siteLabel, h); } catch (e) {} }
        }
        if (was !== cur.state) await save();
      }
    } else if (r.kind === 'nojob') { cur = Object.assign({}, cur, { state: 'error', error: '서버에 이 요청의 기록이 없습니다 (서버를 다시 띄웠거나 기록이 지워짐)' }); await save(); }
    else if (cur.state === 'running') note = { text: `${r.error} · 다시 연결하는 중…`, err: true };
    render();
    if (cur && cur.state === 'running') timer = setTimeout(poll, r.ok ? 1500 : 5000); else stopTimers();
  }
  function watch() {
    stopTimers();
    if (cur && cur.state === 'running') tick = setInterval(render, 1000);
    poll();
  }

  async function send() {
    const ask = input.value.trim();
    if (cur && cur.state === 'running') return;
    const site = siteOf();
    if (!site && !ask) { note = { text: '새 사이트는 요청 글에 가맹점 이름·사이트 주소·종류를 적어 주세요 (등록한 가맹점은 왼쪽에서 고름)', err: true }; render(); return; }
    const text = KRX_SITES.buildPrompt(site, H.docsMap(), null, ask);
    btnSend.disabled = true;
    note = { text: '요청을 보내는 중…' }; render();
    const fresh = !!(cur && cur.fresh);
    const context = { from: FROM, chat: 'fetch-site' };   // 가맹점 값은 글에 있음. 아이디·비밀번호는 보내지 않음
    try { context.version = chrome.runtime.getManifest().version; } catch (e) {}
    if (site) context.site = { id: site.id || '', label: site.label || '', url: site.url || '', kind: site.kind || '', docs: KRX_SITES.docsOf(site, H.docsMap()) };
    const r = await api('/ask', { text, context, fresh });
    if (r.ok || (r.kind === 'busy' && r.id)) {   // busy: 앞선 요청(팝업 Help Chat 등)을 이어서 본다 — 쓴 글은 그대로 둠
      cur = { id: r.id, text: r.ok ? (ask || `${site ? site.label || site.match : '새 사이트'} 붙이기`) : '', at: Date.now(), state: 'running', mine: !!r.ok, siteId: site ? site.id || '' : '', siteLabel: site ? site.label || site.match || '' : '', howtoDone: false };
      lines = []; next = 0; detail = ''; note = r.ok ? null : { text: '앞선 요청을 처리하는 중이라 그것을 이어서 봅니다 — 끝나면 다시 보내세요', err: true };
      if (r.ok) { input.value = ''; try { chrome.storage.local.remove(DRAFT); } catch (e) {} }
      await save();
      watch();
    } else { note = { text: r.error || '요청을 보내지 못했습니다', err: true }; render(); btnSend.disabled = false; }
  }

  btnSend.addEventListener('click', send);
  input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.isComposing) { ev.preventDefault(); send(); } });   // 설정 페이지의 큰 form 이 저장되지 않게
  input.addEventListener('input', () => { try { chrome.storage.local.set({ [DRAFT]: input.value }); } catch (e) {} if (note && note.err) { note = null; render(); } });
  statusEl.addEventListener('click', () => { if (cur && cur.id) { open = !open; render(); if (open) linesEl.scrollTop = linesEl.scrollHeight; } });
  btnStop.addEventListener('click', async () => { btnStop.disabled = true; await api('/cancel', {}); btnStop.disabled = false; clearTimeout(timer); poll(); });
  btnApply.addEventListener('click', async () => {
    cur = Object.assign({}, cur, { applied: true }); await save();
    try { chrome.runtime.reload(); } catch (e) { note = { text: '다시 불러오지 못했습니다 — chrome://extensions 에서 새로고침하세요', err: true }; render(); }
  });
  btnNew.addEventListener('click', async () => { stopTimers(); cur = { fresh: true }; lines = []; next = 0; detail = ''; note = null; open = false; await save(); render(); input.focus(); });

  async function init(hooks) {
    H = hooks;
    refresh();
    try {
      const l = await chrome.storage.local.get([KEY, DRAFT]);
      cur = l[KEY] || null;
      if (l[DRAFT] && !input.value) input.value = String(l[DRAFT]);
    } catch (e) {}
    render();
    if (cur && cur.id) watch();   // 진행 중이면 이어서 보고, 끝난 것도 로그를 다시 받아 둔다
  }
  self.KRX_FETCH_CHAT = { init, refresh };
})();
