/* 툴바 팝업 Help Chat — 한 줄 요청을 이 PC 의 Help 서버(help-server/server.js, 기본 http://127.0.0.1:8106)에 보내 Claude Code CLI(Opus 5.5)가 확장 코드를 고치게 하고, 진행·완료 여부를 한 줄 로그로 보인다.
 * 일부러 독립 스크립트: 다른 lib·백그라운드가 (잘못된 수정으로) 깨져 있어도 이 창구로 다시 고쳐 달라고 할 수 있게 KRX_* 나 chrome.runtime.sendMessage 에 기대지 않는다. 팝업은 확장 페이지라 localhost 호스트 권한으로 서버를 직접 fetch 한다.
 * 팝업은 다른 곳을 누르면 닫히므로 작업은 서버에서 계속 돌고, 마지막 요청은 storage.local.helpChat = { id, text, at, state(running|done|error|canceled), summary, error, files, checks, endedAt, applied } 에 남겨 다시 열 때 이어서 본다(쓰던 글은 helpDraft).
 * 끝나면 "적용" = chrome.runtime.reload() (바뀐 파일이 있고 서버의 문법 검사가 통과했을 때만 보임). "새 대화"는 다음 요청을 이전 대화와 잇지 않는다(helpChat = { fresh: true }).
 * 설정 help = { enabled, url } (lib/settings.js) — 주소는 이 PC(localhost · 127.0.0.1)만 */
(() => {
  const DEFAULT_URL = 'http://127.0.0.1:8106', KEY = 'helpChat', DRAFT = 'helpDraft';
  const $ = (id) => document.getElementById(id);
  const bar = $('helpbar'), form = $('helpForm'), input = $('helpText'), btnSend = $('helpSend'), row = $('helpRow'), statusEl = $('helpStatus'), linesEl = $('helpLines'),
    btnApply = $('helpApply'), btnStop = $('helpStop'), btnNew = $('helpNew');
  if (!bar || !form) return;
  let base = DEFAULT_URL, cur = null, lines = [], next = 0, detail = '', timer = 0, tick = 0, note = null /* { text, err } 서버 연결 안내 등 일시 문구 */, open = false;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const hms = (t) => { const d = new Date(t); return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':'); };
  const save = () => { try { return chrome.storage.local.set({ [KEY]: cur }); } catch (e) { return Promise.resolve(); } };
  const needsReload = (files) => (files || []).some((f) => !/^(help-server|tests)\//.test(f) && !/\.md$/i.test(f));   // 문서·테스트·서버만 바뀌었으면 확장을 다시 불러올 필요 없음

  async function api(path, body) {
    let res;
    try { res = await fetch(base + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' }); }
    catch (e) { return { ok: false, kind: 'offline', error: `Help 서버에 연결할 수 없습니다 (${base}) — 이 PC 에서 node help-server/server.js 를 실행하세요` }; }
    try { const j = await res.json(); return j && typeof j === 'object' ? j : { ok: false, kind: 'parse', error: '서버 응답을 읽지 못했습니다' }; }
    catch (e) { return { ok: false, kind: 'http', error: `Help 서버 오류 ${res.status} — 주소가 Help 서버가 맞는지 확인하세요 (${base})` }; }
  }

  /* 요청에 붙이는 화면 상태: 무엇을 보고 있었는지와 조회 오류만 (금액·이름 같은 내용은 보내지 않음) */
  async function context() {
    const out = { from: '툴바 팝업' };
    try { out.version = chrome.runtime.getManifest().version; } catch (e) {}
    try {
      const l = await chrome.storage.local.get(['cache', 'panelView', 'panelSection']);
      const c = l.cache || {};
      out.panel = { section: l.panelSection === 'budget' ? '과제집행비율' : '카드미청구', view: l.panelView === 'card' ? '카드별' : '과제별' };
      out.cache = { at: c.ts ? new Date(c.ts).toLocaleString('ko-KR') : '없음', loginRequired: !!c.loginRequired, eclassLogin: !!c.eclassLogin, projects: (c.projects || []).length, unclaimed: c.totalCount || 0, memberFilter: c.memberFilter || '' };
      const errs = {};
      for (const k of ['error', 'unapprovedError', 'inboxError', 'supplementsError', 'participationError']) if (c[k]) errs[k] = String(c[k]).slice(0, 200);
      for (const p of c.projects || []) for (const k of ['acctError', 'issuedError', 'budgetError', 'cardsError']) if (p && p[k]) errs[`${p.prjNo || ''} ${k}`] = String(p[k]).slice(0, 200);
      if (Object.keys(errs).length) out.errors = errs;
    } catch (e) {}
    return out;
  }

  function render() {
    const running = !!(cur && cur.state === 'running');
    const has = !!(cur && cur.id);
    row.hidden = !has && !note;
    let text = '', cls = '';
    if (note) { text = note.text; cls = note.err ? 'err' : ''; }
    else if (running) {   // 한 줄 상태에는 마지막 진행 줄 (도구가 한 번 거절·실패한 줄은 곧 다른 방법으로 넘어가므로 펼친 로그에만)
      const last = lines.filter((l) => l.k !== 'warn').pop();
      text = `⏳ ${mmss(Date.now() - cur.at)} · ${(last && last.s) || '요청을 보냈습니다'}`; cls = 'run';
    } else if (has && cur.state === 'done') {
      const bad = (cur.checks || [])[0], n = (cur.files || []).length;
      text = `${cur.applied ? '✔ 적용됨' : '✔ 완료'} — ${cur.summary || ''}${n ? ` · 수정 ${n}개` : ''}${bad ? ` · ⚠ 문법 오류 ${bad.file}${needsReload([bad.file]) ? ' (적용 보류 — 고쳐 달라고 다시 요청하세요)' : ''}` : ''}`;
      cls = bad ? 'err' : 'ok';
    } else if (has) { text = `${cur.state === 'canceled' ? '■ 중지됨' : '✖ 실패'} — ${cur.error || ''}`; cls = 'err'; }
    statusEl.textContent = text; statusEl.className = 'help-status ' + cls;
    statusEl.title = has ? `요청: ${cur.text || ''}\n(누르면 로그 펼치기/접기)` : '';
    btnStop.hidden = !running || !!note;
    btnApply.hidden = !(has && cur.state === 'done' && !cur.applied && needsReload(cur.files) && !needsReload((cur.checks || []).map((c) => c.file)));
    btnNew.hidden = running || !has;
    btnSend.disabled = running; input.disabled = running;
    input.placeholder = running ? '처리 중… (팝업을 닫아도 계속됩니다)' : 'Help Chat — 고칠 점이나 이상한 결과를 한 줄로 적고 Enter';
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
    if (!cur || cur.id !== id) return;   // 그 사이 새 대화·새 요청
    if (r.ok) {
      note = null;
      lines = lines.concat(r.lines || []); next = r.next || lines.length;
      const j = r.job || {};
      detail = j.detail || '';
      if (j.state !== 'running' || cur.state !== 'running' || !cur.text) {
        const was = cur.state;
        cur = Object.assign({}, cur, { text: cur.text || j.text || '', at: j.startedAt || cur.at, state: j.state, summary: j.summary || '', error: j.error || '', files: j.files || [], checks: j.checks || [], endedAt: j.endedAt || 0 });
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

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const text = input.value.trim();
    if (!text || (cur && cur.state === 'running')) return;
    btnSend.disabled = true;
    note = { text: '요청을 보내는 중…' }; render();
    const fresh = !!(cur && cur.fresh);
    const r = await api('/ask', { text, context: await context(), fresh });
    if (r.ok || (r.kind === 'busy' && r.id)) {   // busy: 앞선 요청(다른 창에서 보냈거나 저장이 안 된 것)을 이어서 본다 — 쓴 글은 그대로 둠
      cur = { id: r.id, text: r.ok ? text : '', at: Date.now(), state: 'running' };
      lines = []; next = 0; detail = ''; note = null;
      if (r.ok) { input.value = ''; try { chrome.storage.local.remove(DRAFT); } catch (e) {} }
      await save();
      watch();
    } else { note = { text: r.error || '요청을 보내지 못했습니다', err: true }; render(); btnSend.disabled = false; }
  });
  input.addEventListener('input', () => { try { chrome.storage.local.set({ [DRAFT]: input.value }); } catch (e) {} if (note && note.err) { note = null; render(); } });
  statusEl.addEventListener('click', () => { if (cur && cur.id) { open = !open; render(); if (open) linesEl.scrollTop = linesEl.scrollHeight; } });
  btnStop.addEventListener('click', async () => { btnStop.disabled = true; await api('/cancel', {}); btnStop.disabled = false; clearTimeout(timer); poll(); });
  btnApply.addEventListener('click', async () => {   // 확장을 다시 불러와 바뀐 코드를 적용 (팝업은 닫힌다. 열려 있는 eClass 홈은 백그라운드가 새로고침)
    cur = Object.assign({}, cur, { applied: true }); await save();
    try { chrome.runtime.reload(); } catch (e) { note = { text: '다시 불러오지 못했습니다 — chrome://extensions 에서 새로고침하세요', err: true }; render(); }
  });
  btnNew.addEventListener('click', async () => { stopTimers(); cur = { fresh: true }; lines = []; next = 0; detail = ''; note = null; open = false; await save(); render(); input.focus(); });

  (async () => {
    try {
      let s = null;
      try { s = (await chrome.storage.sync.get('settings')).settings; } catch (e) {}
      if (!s) { try { s = (await chrome.storage.local.get('settings')).settings; } catch (e) {} }
      const h = (s && s.help) || {};
      if (h.enabled === false) { bar.hidden = true; return; }
      const u = String(h.url || '').trim().replace(/\/+$/, '');
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(u)) base = u;
    } catch (e) {}
    try {
      const l = await chrome.storage.local.get([KEY, DRAFT]);
      cur = l[KEY] || null;
      if (l[DRAFT] && !input.value) input.value = String(l[DRAFT]);
    } catch (e) {}
    render();
    if (cur && cur.id) watch();   // 진행 중이면 이어서 보고, 끝난 것도 로그를 다시 받아 둔다
  })();
})();
