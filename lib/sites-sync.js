/* 확장 Plus — 자주 사용 가맹점 공유의 차례(순수 오케스트레이션 · 백그라운드 background.js shareSync 전용 + Node 테스트는 가짜 store 로).
 * 2026-10-22 사용자: "가맹점 정보는 어디에 저장하지.. shared/common 아래 두면 어떨까" → 이름 가맹점.json · "동료와도 합침".
 *   밑폴더(base — 과제 폴더들과 같은 업무/shared) 아래 common/가맹점.json 하나. 내 파일은 내가 쓰고(내 PC·브라우저끼리 같은 파일),
 *   "나와 공유" 에서 찾은 동료의 같은 파일(…/shared/common 을 공유받았거나 …/shared 를 통째로 공유받은 것)은 **읽기만** 해서 합친다. 파일 모양·병합은 lib/fetch-sites.js(KRX_SITES parseShared · mergeShared).
 *   common 폴더는 과제 폴더 훑기(lib/prjdoc-sync.js)에서 연차 파일이 없어 "못 알아본 폴더" 로 남을 뿐 과제로 잡히지 않는다.
 *
 * run(deps) — deps = {
 *   store: { childCfg(cfg, name), readFile(cfg, name, io) → { text, meta } | null, openWriter(cfg, io) → writer { ensurePath(path) → { created, made }, modify(name, transform, { comment }), close() },
 *            sharedWithMe?(io, { driveHost }) → [{ name, webUrl, folder, ownerName, cfg? }], parseFolder?(url), fileUrl?(cfg, name), folderUrl?(cfg) }   (KRX_SP 를 감싼 것 — background.js shareStore)
 *   io, base(밑폴더 cfg), driveHost, discover(나와 공유에서 동료 파일 찾기 — 기본 true), shared?(이미 받은 나와 공유 목록 — 과제 동기화가 받은 것을 넘기면 다시 부르지 않음), who, now,
 *   loadLocal() → { sites(fetchSites), meta(fetchSitesSync) }, saveLocal({ sites?, meta }) — sites 는 목록이 바뀌었을 때만 }
 * 차례: ① 내 파일 읽기(폴더·파일이 없으면 null — 처음 쓸 때 만듦, 깨진 파일은 kind 'parse' 로 쓰지 않음) ② 동료 파일 읽기(동료마다 실패는 그 동료만 — offline 은 전체)
 *   ③ loadLocal → mergeShared → 바뀌었으면 저장 직전에 다시 loadLocal 해 다시 병합(그 사이 설정 페이지·패널에서 고친 것을 덮지 않게) → saveLocal
 *   ④ 내 파일과 다르거나(없던 파일이면 가맹점·묘비가 있을 때) 내가 남긴 체크아웃이면 writer(common 폴더 — 없으면 ensurePath 로 만듦)로 modify(체크아웃한 최신 글로 다시 병합)
 * → state = { at, ok, path(내 파일 서버 상대 경로), url(내 파일 주소), folderUrl, exists, created(폴더를 새로 만듦), count, added, updated, removed, pulled, pushed,
 *             others:[{ owner, n, url, error? }], error?, kind?, discoverError? }. 쿠키·다이제스트 값은 어디에도 남기지 않는다 */
(function (g) {
  const api = {};
  const S = () => g.KRX_SITES;
  const SHARED_SEG = 'shared';
  const fail = (kind, msg) => { const e = new Error(msg); e.kind = kind; return e; };
  const kindOf = (e) => (e && e.kind) || '';
  const msgOf = (e) => String((e && e.message) || e);
  const str = (v) => (v == null ? '' : String(v));
  const lower = (s) => str(s).toLowerCase();
  const siteOf = (cfg) => str(cfg && (cfg.siteUrl || cfg.origin));

  api.run = async function (deps) {
    const now = deps.now || Date.now(), who = str(deps.who);
    const store = deps.store, io = deps.io || {}, base = deps.base || {};
    const FILE = S().SHARE_FILE, DIR = S().SHARE_DIR;
    const fileUrlOf = (cfg) => (typeof cfg.fileUrl === 'function' ? str(cfg.fileUrl(FILE)) : typeof store.fileUrl === 'function' ? str(store.fileUrl(cfg, FILE)) : '');
    const folderUrlOf = (cfg) => str(cfg.viewUrl) || (typeof store.folderUrl === 'function' ? str(store.folderUrl(cfg)) : '');
    const state = { at: now, ok: true, path: '', url: '', folderUrl: '', exists: false, created: false, count: 0, added: 0, updated: 0, removed: 0, pulled: false, pushed: false, others: [] };
    const fatal = (e) => Object.assign(state, { ok: false, error: msgOf(e), kind: kindOf(e) || 'error' });
    let cfg;
    try { cfg = store.childCfg(base, DIR); } catch (e) { return fatal(e); }
    state.path = `${str(cfg.folderPath)}/${FILE}`; state.url = fileUrlOf(cfg); state.folderUrl = folderUrlOf(cfg);

    // ① 내 파일
    let mineFile = null;
    try { mineFile = await store.readFile(cfg, FILE, io); } catch (e) { if (kindOf(e) !== 'nofolder' && kindOf(e) !== 'notfound') return fatal(e); }
    let mine = null;
    if (mineFile && mineFile.text != null) {
      state.exists = true;
      mine = S().parseShared(mineFile.text);
      if (!mine) return fatal(fail('parse', `${FILE} 을(를) 읽을 수 없습니다 — JSON 이 아니거나 가맹점 파일이 아닙니다. common 폴더에서 그 파일을 지우면 다시 만듭니다`));
    }

    // ② 동료 파일 — …/shared/common(그 폴더를 공유받음) · …/shared(밑폴더를 통째로 공유받음 → 그 안의 common)
    const others = [];
    if (deps.discover !== false && (Array.isArray(deps.shared) || typeof store.sharedWithMe === 'function')) {
      let shared = Array.isArray(deps.shared) ? deps.shared : [];
      if (!Array.isArray(deps.shared)) { try { shared = (await store.sharedWithMe(io, { driveHost: deps.driveHost })) || []; } catch (e) { if (kindOf(e) === 'offline') return fatal(e); state.discoverError = msgOf(e); } }
      const seen = new Set([lower(`${siteOf(cfg)}|${cfg.folderPath}`)]);
      for (const it of shared) {
        if (!it || !it.folder) continue;
        let c = it.cfg || null;
        if (!c && typeof store.parseFolder === 'function') { try { c = store.parseFolder(str(it.webUrl)); } catch (x) { c = null; } }
        if (!c || !c.folderPath) continue;
        const segs = str(c.folderPath).split('/').filter(Boolean);
        const last = lower(segs[segs.length - 1]), parent = lower(segs[segs.length - 2]);
        let oc = null;
        try {
          if (last === lower(DIR) && parent === SHARED_SEG) oc = c;
          else if (last === SHARED_SEG) oc = store.childCfg(c, DIR);
        } catch (x) { oc = null; }
        if (!oc) continue;
        const key = lower(`${siteOf(oc)}|${oc.folderPath}`);
        if (seen.has(key)) continue;
        seen.add(key);
        const owner = str(it.ownerName);
        const o = { owner, n: 0, url: fileUrlOf(oc) };
        try {
          const f = await store.readFile(oc, FILE, io);
          if (!f || f.text == null) continue;   // 그 동료는 아직 가맹점 파일이 없음
          const doc = S().parseShared(f.text);
          if (!doc) { o.error = `${FILE} 을(를) 읽을 수 없습니다`; o.kind = 'parse'; }
          else { o.n = doc.sites.length; others.push({ owner, doc }); }
        } catch (e) {
          if (kindOf(e) === 'offline') return fatal(e);
          if (kindOf(e) === 'nofolder' || kindOf(e) === 'notfound') continue;
          o.error = msgOf(e); o.kind = kindOf(e) || 'error';
        }
        state.others.push(o);
      }
    }

    // ③ 병합 · 로컬 저장
    const mergeWith = (l, m) => S().mergeShared({ local: l.sites, meta: l.meta, mine: m, others, now, who });
    let local = await deps.loadLocal();
    let r = mergeWith(local, mine);
    if (r.localChanged || r.metaChanged) {
      local = await deps.loadLocal();   // 저장 직전의 지금 목록으로 다시
      r = mergeWith(local, mine);
      if (r.localChanged || r.metaChanged) await deps.saveLocal(r.localChanged ? { sites: r.sites, meta: r.meta } : { meta: r.meta });
      state.pulled = r.added + r.updated + r.removed > 0;   // 받은 것(옛 저장에 수정 시각만 처음 찍은 것은 빼고)
    }
    Object.assign(state, { count: r.count, added: r.added, updated: r.updated, removed: r.removed });

    // ④ 내 파일 쓰기
    const tidy = !!(mineFile && mineFile.meta && mineFile.meta.checkedOutByMe);
    if (r.remoteChanged || tidy) {
      let w = null;
      try {
        w = await store.openWriter(cfg, io);
        if (!state.exists && typeof w.ensurePath === 'function') { const made = await w.ensurePath(str(cfg.folderPath)); state.created = !!(made && (made.created || (Array.isArray(made.made) && made.made.length))); }
        const res = await w.modify(FILE, async (cur) => {
          let m = null;
          if (cur != null) { m = S().parseShared(cur); if (!m) return { changed: false, discard: true }; }
          const r2 = mergeWith(await deps.loadLocal(), m);
          return { changed: cur == null ? true : r2.remoteChanged, text: r2.text };
        }, { comment: `KR eClass 확장 가맹점 ${who ? `· ${who} ` : ''}${new Date(now).toISOString()}` });
        state.pushed = !!(res && (res.changed || res.created || res.updated));
        state.exists = true;
      } catch (e) { fatal(e); }
      finally { if (w) { try { await w.close(); } catch (x) {} } }
    }
    if (!state.url) state.url = fileUrlOf(cfg);
    return state;
  };

  g.KRX_SITES_SYNC = api;
})(typeof self !== 'undefined' ? self : this);
