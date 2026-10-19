/* 청구 준비 자동 분류 (0.8.5, 백그라운드 전용 — background.js 가 importScripts) — 이 PC 의 Help 서버(help-server/server.js POST /classify → help-server/classify.js)가 연결돼 있으면
 * Claude 가 거래 하나의 청구종류(설정 quickPicks 표시이름)와 첨부 파일마다 종류(설정 attachKinds)를 골라 청구 준비에 넣고, 청구내역(적요)이 비어 있으면 한 줄을 쓴다 (lib/prep-store.js applyAuto).
 *  청구내역: 품목은 첨부 파일 내용(찾아온 인보이스·거래명세서 등 종류가 정해진 파일도 REF_MAX 개까지 내용째), 용도는 그 과제의 연구개발계획서(lib/research.js — 개발목표·개발내용·연구활동비 계획).
 *            설정 help.autoPtcl 이 꺼져 있거나 서버가 classifyPtcl 이 없는 옛 서버면 쓰지 않는다. 설정 help.ptclGuide(작성 안내)를 함께 보낸다
 *  보내는 것: 가맹점·금액·사용일시·과제명·청구내역(적요), 첨부 파일 이름·종류, 아직 종류를 안 정한 파일의 내용(이미지는 가로 IMG_W px · 세로는 가로의 IMG_RATIO 배까지 위쪽만 JPEG 로 줄여서,
 *            PDF 는 PDF_MAX 까지 그대로, 그 밖의 파일은 이름만), 사용자가 고른 청구종류 예(storage.local.prepTypeHist — 가맹점·적요·청구종류, 최근 HIST_MAX 건)
 *  덮어쓰지 않음: 청구종류는 비었거나 Claude 가 고른 것(typeBy 'auto')만 — 사용자가 고르면 typeBy 'user'. 작성 중·임시저장·신청된 거래는 건드리지 않는다(KRX_PREP_STORE.typeFree).
 *            청구내역도 비었거나 Claude 가 쓴 것(ptclBy 'auto')만 — 사용자가 적으면 ptclBy 'user' (KRX_PREP_STORE.ptclFree).
 *            파일 종류는 아직 안 정했고 한 번도 분류하지 않은(kindTried) 파일만. 같은 입력(사용자가 적은 청구내역 + 파일 목록 = sig)으로는 청구종류를 다시 묻지 않는다(typeAuto.sig, 못 고른 것은 메모리 tried).
 *            Claude 가 쓴 청구내역은 청구종류나 파일 목록이 바뀌면(ptclSig) 다시 쓴다(ptclAuto.sig, 못 쓴 것은 메모리 triedPtcl). Claude 가 쓴 청구내역은 청구종류를 다시 묻는 sig 에 넣지 않는다(서로 번갈아 다시 묻지 않게).
 *  부르는 곳: 패널(lib/prep.js autoPick)이 거래의 청구 준비 줄을 열 때 · 파일을 저장한 뒤 · 청구내역을 저장한 뒤 'prepAuto'. 같은 거래는 한 번에 하나만 돌고, 도는 중 들어온 요청은 끝난 뒤 한 번 더 돈다.
 *  서버 확인: GET /health 의 classify(HEALTH_TTL 캐시). 설정 help.autoPick · claimHelper.enabled 중 하나가 꺼졌거나 서버가 없거나 옛 서버면 조용히 건너뛴다(skipped)
 *  Claude API (0.8.6, lib/claude-api.js): 설정 › LLM 설정 › Claude API 에 키(storage.local.claudeApiKey)가 있으면 서버 대신 api.anthropic.com 에 직접 묻는다 — 같은 프롬프트(lib/classify-core.js).
 *            help.api.use: 'auto'(기본 — 서버가 없거나 옛 서버이거나 분류에 실패하면 API) · 'always'(늘 API) · 'off'(API 안 씀). 결과의 via 가 'api' 면 패널 안내가 "Claude API: …" */
const KRX_PREP_AI = (() => {
  const HIST = 'prepTypeHist', HIST_MAX = 30;
  const IMG_W = 1280, IMG_RATIO = 2, IMG_MAX = 15 * 1024 * 1024, PDF_MAX = 4 * 1024 * 1024, REF_MAX = 2;
  const HEALTH_TTL = 30000, HEALTH_MS = 2500, CLASSIFY_MS = 150000;
  const DEFAULT_URL = 'http://127.0.0.1:8106';
  let health = null;          // { url, at, ok, classify }
  const jobs = new Map();     // 준비 키 → { p, again, meta }
  const tried = new Map();    // 준비 키 → Claude 가 청구종류를 못 고른 입력의 sig (워커가 다시 뜨면 비워짐)
  const triedPtcl = new Map();   // 준비 키 → Claude 가 청구내역을 못 쓴 입력의 ptclSig

  /* 세목 빠른 선택 목록 → [{ label, kw, type, kind }] (lib/prep.js parsePicks 와 같은 규칙) */
  const parsePicks = (lines) => (Array.isArray(lines) ? lines : []).map((line) => {
    const s = String(line || '').trim();
    if (!s || s.startsWith('#')) return null;
    const p = s.split('=').map((x) => x.trim());
    return p[0] ? { label: p[0], kw: p[1] || p[0], type: p[2] || '', kind: p[3] || '' } : null;
  }).filter(Boolean);
  const pickHint = (p) => [p.kw && p.kw !== p.label ? `세목 "${p.kw}"` : '', p.type ? `청구종류 코드 ${p.type}` : '',
    String(p.type) === '17' || p.kind ? `회의록 필요${p.kind ? `(${p.kind})` : ''}` : ''].filter(Boolean).join(', ');
  const baseUrl = (u) => { const s = String(u || '').trim().replace(/\/+$/, ''); return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(s) ? s : DEFAULT_URL; };   // 이 PC 만 (popup/help.js 와 같음)
  const sigOf = (e) => JSON.stringify([e && e.ptclBy === 'auto' ? '' : String((e && e.ptcl) || ''), ((e && e.files) || []).map((f) => f.id)]);   // 청구종류를 다시 물을지 가르는 입력 (Claude 가 쓴 청구내역은 빼고)
  /* 청구내역을 쓸 때 내용을 같이 볼 파일: 종류가 정해진 것 중 거래명세서·견적서(품목·기간이 나옴) → 찾아온 서류 → 나머지 */
  const refRank = (f) => (/거래명세서|견적서|영수증|인보이스/.test(String(f.kind || '')) ? 0 : f.kindBy === 'fetch' ? 1 : 2);

  async function fetchJson(url, init, ms) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    try {
      const res = await fetch(url, Object.assign({ cache: 'no-store', signal: ac.signal }, init || {}));
      let j = null;
      try { j = await res.json(); } catch (e) {}
      return j && typeof j === 'object' ? j : { ok: false, error: `Help 서버 응답 ${res.status}` };
    } finally { clearTimeout(t); }
  }
  async function checkHealth(url) {
    if (typeof KRX_LLM !== 'undefined') {   // 백그라운드: 공용 연결 상태(lib/llm.js — storage.local.llmStatus 도 갱신해 패널의 찾아오기 버튼·설정 페이지가 같은 상태를 봄). const 전역이라 self.KRX_LLM 으로는 안 보임
      const st = await KRX_LLM.probe(url, false);
      return { url, at: st.at, ok: !!st.ok, classify: String(st.classify || ''), ptcl: !!st.classifyPtcl };
    }
    if (health && health.url === url && Date.now() - health.at < HEALTH_TTL) return health;
    let j = null;
    try { j = await fetchJson(`${url}/health`, null, HEALTH_MS); } catch (e) { j = null; }
    health = { url, at: Date.now(), ok: !!(j && j.ok && j.name === 'krx-help'), classify: String((j && j.classify) || ''), ptcl: !!(j && j.classifyPtcl) };
    return health;
  }

  async function blobB64(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  /* 이미지 → 가로 IMG_W 까지 줄이고 세로는 가로의 IMG_RATIO 배까지 위쪽만(긴 페이지 캡처는 제목·머리 부분이 종류를 말해 줌) → JPEG */
  async function shrink(blob) {
    const bmp = await createImageBitmap(blob);
    try {
      const k = Math.min(1, IMG_W / bmp.width);
      const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.min(Math.round(bmp.height * k), w * IMG_RATIO));
      const cv = new OffscreenCanvas(w, h);
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
      ctx.drawImage(bmp, 0, 0, bmp.width, h / k, 0, 0, w, h);
      return await blobB64(await cv.convertToBlob({ type: 'image/jpeg', quality: 0.8 }));
    } finally { try { bmp.close(); } catch (e) {} }
  }
  /* 분류할 파일 내용: 이미지·PDF 만 (그 밖의 파일과 읽지 못한 것은 이름만) */
  async function fileBody(f) {
    const rec = await KRX_PREP_STORE.fileRecord(f.id).catch(() => null);
    const blob = rec && rec.blob;
    if (!blob) return {};
    const mime = String(f.mime || rec.mime || blob.type || '').toLowerCase(), name = String(f.base || f.name || '');
    try {
      if (/^image\/(png|jpe?g|gif|webp|bmp)$/.test(mime) && blob.size <= IMG_MAX) return { b64: await shrink(blob), media: 'image/jpeg' };
      if ((mime === 'application/pdf' || /\.pdf$/i.test(name)) && blob.size <= PDF_MAX) return { b64: await blobB64(blob), media: 'application/pdf' };
    } catch (e) {}
    return {};
  }
  async function projectName(prjNo) {
    if (!prjNo) return '';
    try { const c = (await chrome.storage.local.get('cache')).cache || {}; const p = (c.projects || []).find((x) => x && x.prjNo === prjNo); return (p && p.prjNm) || ''; } catch (e) { return ''; }
  }
  /* 그 과제의 연구개발계획서(설정 페이지에 넣었거나 원노트로 받은 것, lib/research.js) — 청구종류의 보조 근거(목표·연구활동비 세부사용계획), 청구내역의 용도(개발내용·목표). 없으면 null */
  async function researchRef(prjNo) {
    if (!prjNo || typeof KRX_RESEARCH === 'undefined') return null;
    try {
      const c = (await chrome.storage.local.get('cache')).cache || {};
      const p = (c.projects || []).find((x) => x && x.prjNo === prjNo);
      return KRX_RESEARCH.refOf(KRX_RESEARCH.forProject(await KRX_RESEARCH.load(), prjNo, p && p.anl));
    } catch (e) { return null; }
  }

  async function once(key, meta) {
    const s = await KRX_SETTINGS.load();
    const h = s.help || {}, ch = s.claimHelper || {};
    if (h.autoPick === false || ch.enabled === false) return { ok: true, skipped: 'off' };   // Help Chat 줄 표시(help.enabled)와는 따로
    const picks = parsePicks(ch.quickPicks);
    const kinds = (Array.isArray(ch.attachKinds) ? ch.attachKinds : (KRX_SETTINGS.DEFAULTS.claimHelper.attachKinds || [])).map((k) => String(k || '').trim()).filter(Boolean);
    const e = (await KRX_PREP_STORE.loadMeta())[key] || null;
    const sig = sigOf(e);
    const wantType = picks.length > 0 && KRX_PREP_STORE.typeFree(e) && !(e && e.typeBy === 'auto' && e.typeAuto && e.typeAuto.sig === sig) && tried.get(key) !== sig;
    const psig = KRX_PREP_STORE.ptclSig(e);
    let wantPtcl = h.autoPtcl !== false && KRX_PREP_STORE.ptclFree(e) && !(e && e.ptcl && e.ptclAuto && e.ptclAuto.sig === psig) && triedPtcl.get(key) !== psig;
    const todo = kinds.length && e ? (e.files || []).filter((f) => !f.kind && !f.kindTried) : [];
    if (!wantType && !wantPtcl && !todo.length) return { ok: true, skipped: 'none' };
    const rt = await route(h, wantPtcl);
    if (!rt.via && !rt.hs.ok) return { ok: true, skipped: 'offline' };
    if (!rt.via) return { ok: true, skipped: 'old' };   // /classify 가 없는 옛 서버 — 다시 띄워야 함
    if (rt.via === 'server' && wantPtcl && !rt.hs.ptcl) { wantPtcl = false; if (!wantType && !todo.length) return { ok: true, skipped: 'oldPtcl' }; }   // 청구내역을 못 쓰는 옛 서버 (0.8.5 개발 중)

    const m = Object.assign({}, meta || {}, e || {});
    const refs = wantPtcl && e ? (e.files || []).filter((f) => f.kind && !todo.includes(f)).sort((a, b) => refRank(a) - refRank(b)).slice(0, REF_MAX) : [];
    const files = [];
    for (const f of (e && e.files) || []) {
      const go = todo.includes(f), ref = refs.includes(f);
      files.push(Object.assign({ id: f.id, name: f.base || f.name, kind: f.kind || '', classify: go, ref }, go || ref ? await fileBody(f) : {}));
    }
    let hist = [];
    try { hist = (await chrome.storage.local.get(HIST))[HIST] || []; } catch (x) {}
    const body = {
      tx: { shop: m.shop || '', amount: Number(m.amount) || 0, usedDate: m.usedDate || '', project: await projectName(m.prjNo) },
      ptcl: (e && e.ptcl) || '', type: (e && e.type) || '', wantType, wantPtcl, ptclGuide: wantPtcl ? String(h.ptclGuide || '').trim() : '',
      picks: wantType ? picks.map((p) => ({ label: p.label, hint: pickHint(p) })) : [], kinds, files,
      history: wantType ? hist.filter((x) => x && x.shop && picks.some((p) => p.label === x.type)).slice(0, HIST_MAX) : wantPtcl ? hist.filter((x) => x && x.shop && x.ptcl).slice(0, HIST_MAX) : [],
      research: wantType || wantPtcl ? await researchRef(m.prjNo) : null,
    };
    let r = null;
    if (rt.via === 'server') {
      try { r = await fetchJson(`${rt.url}/classify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, CLASSIFY_MS); }
      catch (x) { health = null; r = { ok: false, error: x && x.name === 'AbortError' ? 'Help 서버 응답이 너무 늦습니다' : 'Help 서버에 연결할 수 없습니다' }; }
      if (!r.ok && !rt.api) return { ok: false, error: r.error || '분류하지 못했습니다' };
    }
    if (!r || !r.ok) {   // Claude API 로 직접 (설정이 "항상"이거나, 서버가 없거나 실패했을 때)
      const input = self.KRX_CLASSIFY ? KRX_CLASSIFY.clean(body) : null;
      if (!input) return { ok: false, error: r ? r.error || '분류하지 못했습니다' : 'lib/classify-core.js 를 읽지 못했습니다' };
      try { r = !input.wantType && !input.wantPtcl && !input.todo.length ? { ok: true, type: null, ptcl: null, files: [] } : Object.assign({ ok: true, via: 'api' }, await KRX_CLAUDE_API.classify(input, { model: rt.api.model, timeoutMs: CLASSIFY_MS })); }
      catch (x) { return { ok: false, error: `${r ? `${r.error || 'Help 서버 분류 실패'} · ` : ''}${String((x && x.message) || x)}` }; }
    }
    const out = await KRX_PREP_STORE.applyAuto(key, meta || {}, { type: wantType ? r.type : null, ptcl: wantPtcl ? (r.ptcl || { value: '' }) : null, sig, files: r.files || [], tried: todo.map((f) => f.id) });
    if (wantType && !out.typeSet) tried.set(key, sig);
    if (wantPtcl && !out.ptclSet) triedPtcl.set(key, KRX_PREP_STORE.ptclSig(out.entry || e));
    return { ok: true, via: r.via === 'api' ? 'api' : 'server', entry: out.entry, type: out.typeSet ? r.type : null, ptcl: out.ptclSet ? r.ptcl : null, kinds: out.kinds };
  }

  /* 어느 길로 물을지 → { via: 'server' | 'api' | null(못 물음), url, hs(서버 상태 — 'always' 면 없음), api: { model } | null(API 를 못 씀 — 키 없음 · 사용 안 함) }.
   * 'auto' 는 서버가 연결돼 있고 /classify 가 있으면(청구내역을 써야 하는데 classifyPtcl 이 없는 옛 서버면 API 가 있을 때 API) 서버, 아니면 API */
  async function route(h, wantPtcl) {
    const a = Object.assign({ use: 'auto', model: '' }, h.api || {});
    const api = a.use !== 'off' && typeof KRX_CLAUDE_API !== 'undefined' && await KRX_CLAUDE_API.getKey() ? { model: a.model } : null;
    if (api && a.use === 'always') return { via: 'api', api };
    const url = baseUrl(h.url);
    const hs = await checkHealth(url);
    if (hs.ok && hs.classify && (!wantPtcl || hs.ptcl || !api)) return { via: 'server', url, hs, api };
    return { via: api ? 'api' : null, url, hs, api };
  }

  /* 패널의 'prepAuto' — 같은 거래는 한 번에 하나만. 도는 중 들어온 요청은 끝난 뒤 한 번 더 돌리고, 둘의 결과(고른 청구종류·쓴 청구내역·파일 종류 수)를 합쳐 돌려준다 */
  function run(key, meta) {
    if (!key) return Promise.resolve({ ok: false, error: '준비 키가 없습니다' });
    const cur = jobs.get(key);
    if (cur) { cur.again = true; if (meta) cur.meta = meta; return cur.p; }
    const job = { again: false, meta };
    job.p = (async () => {
      const acc = { ok: true, type: null, ptcl: null, kinds: [] };
      do {
        job.again = false;
        let r;
        try { r = await once(key, job.meta); } catch (x) { r = { ok: false, error: String((x && x.message) || x) }; }
        if (!r.ok) return Object.assign(acc, { ok: false, error: r.error });
        if (r.type) acc.type = r.type;
        if (r.ptcl) acc.ptcl = r.ptcl;
        if (r.via && (r.type || r.ptcl || (r.kinds && r.kinds.length))) acc.via = r.via;   // 무엇으로 물었나 (패널 안내 "Claude API: …")
        if (r.kinds) acc.kinds = acc.kinds.concat(r.kinds);
        if ('entry' in r) acc.entry = r.entry;
        if (r.skipped && !acc.type && !acc.ptcl && !acc.kinds.length) acc.skipped = r.skipped;
        else delete acc.skipped;
      } while (job.again);
      return acc;
    })().finally(() => jobs.delete(key));
    jobs.set(key, job);
    return job.p;
  }

  /* 사용자가 고른 청구종류를 예로 남긴다 — 청구종류를 직접 골랐을 때와 청구서 작성을 눌렀을 때(Claude 가 고른 것을 그대로 쓴 경우 포함). 같은 가맹점·적요는 최신 것만 */
  async function remember(e) {
    const shop = String((e && e.shop) || '').trim(), type = String((e && e.type) || '').trim(), ptcl = String((e && e.ptcl) || '').trim().slice(0, 100);
    if (!shop || !type) return;
    try {
      const list = ((await chrome.storage.local.get(HIST))[HIST] || []).filter((x) => x && !(x.shop === shop && x.ptcl === ptcl));
      list.unshift({ shop, ptcl, type, ts: Date.now() });
      await chrome.storage.local.set({ [HIST]: list.slice(0, HIST_MAX) });
    } catch (x) {}
  }

  return { run, remember, parsePicks, sigOf };
})();
