/* 증빙 찾아오기 (0.8.5, 백그라운드 전용 — background.js 가 importScripts) — 청구 준비 줄의 "찾아오기".
 * 거래의 가맹점이 "자주 사용" 으로 등록돼 있으면(lib/fetch-sites.js) 그 사이트·로그인 정보·가져올 서류를 이 PC 의 Help 서버(POST /fetch → 저장소의 site-fetch/)에 보내고,
 * 가져올 서류 = 그 가맹점의 필요 서류(docsOf — 따로 고른 것, 아니면 설정 help.fetchDocs 의 종류별 필요 서류) 중 아직 첨부 파일 종류로 없는 것(다 있으면 전부 다시).
 * 서버가 작업용 Chrome 에서 Claude 로 서류를 찾는 동안 GET /fetch/job 으로 진행을 받아 storage.local.prepFetch 에 둔다(패널이 그 줄에 진행 한 줄을 보임).
 * 끝나면 받은 서류(GET /fetch/file)를 청구 준비 첨부 파일로 넣고(lib/prep-store.js addFetched — 파일 종류 = 서류 이름), Claude 가 남긴 "찾는 방법"을 그 사이트에 기억해 다음 요청에 준다.
 *  prepFetch = { [준비 키]: { state: running | done | empty | error | canceled, job, site(등록 id), label, docs, ts(시작), endTs, line(마지막 진행 줄), lines(최근 줄), n(넣은 파일 수), missing: [{ kind, reason }], item, matched, msg } }
 *  서비스워커가 잠들었다 깨면(resume) 진행 중인 작업을 다시 지켜본다. 폴링 때마다 확장 API 를 불러 워커가 그동안 잠들지 않게 한다 */
const KRX_PREP_FETCH = (() => {
  const KEY = 'prepFetch';
  const POLL_MS = 2000, LOST_MS = 90000, KEEP_MS = 3 * 24 * 3600000, LINES = 8;
  const DEFAULT_URL = 'http://127.0.0.1:8106';
  const baseUrl = (u) => { const s = String(u || '').trim().replace(/\/+$/, ''); return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(s) ? s : DEFAULT_URL; };   // 이 PC 만 (popup/help.js 와 같음)
  const watching = new Map();   // 준비 키 → 폴링 Promise

  async function loadAll() { try { return (await chrome.storage.local.get(KEY))[KEY] || {}; } catch (e) { return {}; } }
  async function patch(key, p) {
    const all = await loadAll();
    if (p === null) delete all[key]; else all[key] = Object.assign({}, all[key] || {}, p);
    for (const [k, v] of Object.entries(all)) if (v && v.state !== 'running' && Date.now() - (v.endTs || v.ts || 0) > KEEP_MS) delete all[k];
    await chrome.storage.local.set({ [KEY]: all });
    return all[key] || null;
  }
  async function fetchJson(url, init, ms) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms || 15000);
    try {
      const res = await fetch(url, Object.assign({ cache: 'no-store', signal: ac.signal }, init || {}));
      let j = null;
      try { j = await res.json(); } catch (e) {}
      return j && typeof j === 'object' ? Object.assign({ status: res.status }, j) : { ok: false, status: res.status, error: `Help 서버 응답 ${res.status}` };
    } finally { clearTimeout(t); }
  }
  const sites = () => KRX_SITES.load();
  /* 사용일 "20261009" + 사용시각 "000000" → "2026-10-09 00:00:00" (이미 형식이 있으면 그대로) */
  const fmtUsed = (d, t) => { const a = String(d || '').replace(/D/g, ''), b = String(t || '').replace(/D/g, ''); if (a.length < 8) return String(d || ''); const day = `${a.slice(0, 4)}-${a.slice(4, 6)}-${a.slice(6, 8)}`; const hms = a.length >= 14 ? a.slice(8, 14) : b.length >= 4 ? b.padEnd(6, '0').slice(0, 6) : ''; return hms ? `${day} ${hms.slice(0, 2)}:${hms.slice(2, 4)}:${hms.slice(4, 6)}` : day; };
  async function creds() { try { return (await chrome.storage.local.get(KRX_SITES.CRED))[KRX_SITES.CRED] || {}; } catch (e) { return {}; } }

  /* ---------- 등록 (패널의 자주 사용 등록 · 설정 페이지) ---------- */
  /* site 를 넣거나 바꾼다(id 가 같으면). cred 는 확장 페이지(사이드 패널·팝업·설정)에서 온 것만 — eClass 패널(콘텐츠 스크립트)이 보낸 비밀번호는 받지 않는다 */
  async function saveSite(site, cred, fromExtPage) {
    const s = KRX_SITES.sanitize(site);
    const list = await sites();
    const i = s.id ? list.findIndex((x) => x.id === s.id) : -1;
    if (!s.id) s.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    if (i >= 0) { s.last = list[i].last || s.last; if (!site.howto && site.howto !== '') s.howto = list[i].howto || ''; list[i] = s; } else list.push(s);
    const out = { [KRX_SITES.KEY]: list };
    if (fromExtPage && cred && (cred.id != null || cred.pw != null)) {
      const all = await creds();
      const c = { id: String(cred.id || '').trim(), pw: String(cred.pw || '') };
      if (c.id || c.pw) all[s.id] = c; else delete all[s.id];
      out[KRX_SITES.CRED] = all;
    }
    await chrome.storage.local.set(out);
    return s;
  }
  async function removeSite(id) {
    const list = (await sites()).filter((x) => x.id !== id);
    const all = await creds(); delete all[id];
    await chrome.storage.local.set({ [KRX_SITES.KEY]: list, [KRX_SITES.CRED]: all });
    return true;
  }

  /* ---------- 찾아오기 ---------- */
  async function start(key, meta) {
    if (!key) return { ok: false, error: '준비 키가 없습니다' };
    const cur = (await loadAll())[key];
    if (cur && cur.state === 'running') return { ok: false, error: '이미 찾아오는 중입니다' };
    const s = await KRX_SETTINGS.load();
    const h = s.help || {};
    if (h.fetch === false) return { ok: false, error: '설정 › 증빙 찾아오기가 꺼져 있습니다' };
    const e = (await KRX_PREP_STORE.loadMeta())[key] || null;
    const m = Object.assign({}, meta || {}, e || {});
    const site = KRX_SITES.match(await sites(), m.shop);
    if (!site) return { ok: false, kind: 'nosite', error: '이 가맹점은 자주 사용으로 등록돼 있지 않습니다' };
    const c = (await creds())[site.id] || {};
    const url = baseUrl(h.url);
    let hs = null;
    try { hs = await fetchJson(`${url}/health`, null, 3000); } catch (x) { hs = null; }
    if (!hs || !hs.ok || hs.name !== 'krx-help') return { ok: false, kind: 'offline', error: 'Help 서버에 연결할 수 없습니다 — 이 PC 에서 node help-server/server.js 를 실행하세요' };
    if (!hs.fetch) return { ok: false, kind: 'old', error: hs.fetchNote || 'Help 서버가 이전 버전이라 찾아오기를 할 수 없습니다 — 서버를 다시 실행하세요' };
    let prjNm = '';
    try { const cache = (await chrome.storage.local.get('cache')).cache || {}; const p = (cache.projects || []).find((x) => x && x.prjNo === m.prjNo); prjNm = (p && p.prjNm) || ''; } catch (x) {}
    const need = KRX_SITES.docsOf(site, h.fetchDocs);
    const have = new Set(((e && e.files) || []).map((f) => f.kind).filter(Boolean));
    const docs = need.filter((d) => !have.has(d)).length ? need.filter((d) => !have.has(d)) : need;   // 이미 있는 서류는 빼고 (다 있으면 다시 찾아 달라는 것)
    const body = {
      site: { label: site.label, url: site.url, kind: site.kind, docs, hint: site.hint || '', howto: site.howto || '' },
      cred: { id: c.id || '', pw: c.pw || '' },
      tx: { shop: m.shop || '', amount: Number(m.amount) || 0, usedDate: fmtUsed(m.usedDate, m.usedTime), abroad: !!m.abroad, appr: m.appr || '', project: prjNm, ptcl: (e && e.ptcl) || '', type: (e && e.type) || '' },
    };
    let r;
    try { r = await fetchJson(`${url}/fetch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 20000); }
    catch (x) { return { ok: false, error: 'Help 서버에 연결할 수 없습니다' }; }
    if (!r.ok) return { ok: false, kind: r.kind, error: r.kind === 'busy' ? '다른 거래를 찾아오는 중입니다 — 끝난 뒤 다시 누르세요' : (r.error || '찾아오기를 시작하지 못했습니다') };
    await patch(key, { state: 'running', job: r.id, url, site: site.id, label: site.label, docs, ts: Date.now(), endTs: 0, line: `${site.label} 여는 중…`, lines: [], n: 0, missing: [], item: '', matched: '', msg: '', meta: { appr: m.appr, card4: m.card4, prjNo: m.prjNo, shop: m.shop, amount: m.amount, usedDate: m.usedDate, usedTime: m.usedTime || '', abroad: !!m.abroad } });
    watch(key);
    return { ok: true, job: r.id, label: site.label, docs };
  }
  async function cancel(key) {
    const st = (await loadAll())[key];
    if (!st || st.state !== 'running') return { ok: true };
    try { await fetchJson(`${st.url || DEFAULT_URL}/fetch/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: st.job }) }, 8000); } catch (x) {}
    await patch(key, { state: 'canceled', endTs: Date.now(), msg: '중지했습니다' });
    return { ok: true };
  }
  /* 서버 작업을 끝날 때까지 지켜본다 (같은 키는 하나만) */
  function watch(key) {
    if (watching.has(key)) return watching.get(key);
    const p = (async () => {
      let since = 0, lostAt = 0;
      for (;;) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        const st = (await loadAll())[key];   // 확장 API 호출 — 워커가 잠들지 않게
        if (!st || st.state !== 'running') return;
        let r = null;
        try { r = await fetchJson(`${st.url || DEFAULT_URL}/fetch/job?id=${encodeURIComponent(st.job)}&since=${since}`, null, 10000); } catch (x) { r = null; }
        if (!r || !r.ok) {
          if (r && r.status === 404) { await patch(key, { state: 'error', endTs: Date.now(), msg: 'Help 서버가 다시 시작돼 작업을 잃었습니다 — 다시 누르세요' }); return; }
          if (!lostAt) lostAt = Date.now();
          if (Date.now() - lostAt > LOST_MS) { await patch(key, { state: 'error', endTs: Date.now(), msg: 'Help 서버와 연결이 끊겼습니다' }); return; }
          continue;
        }
        lostAt = 0;
        const fresh = (r.lines || []).filter((l) => l && l.s);
        since = r.next || since;
        const job = r.job || {};
        if (fresh.length) {
          const show = fresh.filter((l) => l.k === 'say' || l.k === 'warn' || l.k === 'err' || l.k === 'ok').pop() || fresh[fresh.length - 1];
          await patch(key, { line: show.s, lines: (st.lines || []).concat(fresh.map((l) => l.s)).slice(-LINES) });
        }
        if (job.state && job.state !== 'running') { await done(key, st, job); return; }
      }
    })().catch(async (x) => { try { await patch(key, { state: 'error', endTs: Date.now(), msg: String((x && x.message) || x) }); } catch (y) {} }).finally(() => watching.delete(key));
    watching.set(key, p);
    return p;
  }
  /* 끝난 작업: 서류를 받아 첨부 파일로 넣고 사이트에 결과·찾는 방법을 남긴다 */
  async function done(key, st, job) {
    const url = st.url || DEFAULT_URL;
    const files = [];
    for (const f of job.files || []) {
      try {
        const res = await fetch(`${url}/fetch/file?id=${encodeURIComponent(job.id)}&name=${encodeURIComponent(f.name)}`, { cache: 'no-store' });
        if (!res.ok) continue;
        files.push({ name: f.name, base: f.base, kind: f.kind, why: f.note || '', mime: f.mime || res.headers.get('content-type') || '', blob: await res.blob() });
      } catch (x) {}
    }
    let n = 0;
    if (files.length) { const r = await KRX_PREP_STORE.addFetched(key, st.meta || {}, files, `찾아오기: ${st.label}`); n = r.added; }
    const state = job.state === 'done' && !n && (job.files || []).length ? 'error' : job.state;
    const msg = state === 'error' ? (job.error || ((job.files || []).length ? `서류 ${job.files.length}개를 받지 못했습니다` : '실패')) : job.state === 'canceled' ? '중지했습니다' : job.summary || '';
    await patch(key, { state, endTs: Date.now(), n, missing: job.missing || [], item: job.item || '', matched: job.matched || '', msg, line: msg || st.line, cost: job.cost || 0 });
    // 사이트에 마지막 결과와 Claude 가 남긴 "찾는 방법" (다음 요청에 참고로 넘김)
    try {
      const list = await sites();
      const s = list.find((x) => x.id === st.site);
      if (s) {
        s.last = { ts: Date.now(), state, n, msg: String(msg || '').slice(0, 200) };
        if (state === 'done' && job.howto) s.howto = String(job.howto).slice(0, 500);
        await chrome.storage.local.set({ [KRX_SITES.KEY]: list });
      }
    } catch (x) {}
    if (n) { try { KRX_PREP_AI.run(key, st.meta || {}); } catch (x) {} }   // 청구종류가 비어 있으면 새 서류 내용으로 Claude 가 고름 (파일 종류는 이미 정해짐)
  }
  /* 워커가 다시 떴을 때: 진행 중으로 남은 작업을 다시 지켜봄 */
  async function resume() {
    const all = await loadAll();
    for (const [k, v] of Object.entries(all)) if (v && v.state === 'running') watch(k);
  }
  async function clear(key) { const st = (await loadAll())[key]; if (st && st.state !== 'running') await patch(key, null); }

  return { start, cancel, resume, clear, saveSite, removeSite, KEY };
})();
