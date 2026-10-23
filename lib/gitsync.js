/* GitHub 새 커밋 확인·받기 — 패널 제목 줄의 **업데이트** 단추 (2026-10-23 사용자 "최신 깃이 올라오면 버튼이 생기고 누르면 브릿지 이용해서 업데이트 … rerp workspace 둘다").
 * kr_ext_workspace 의 gitsync.js(네이티브 메시징 다리)와 같은 일을 이 확장은 Help 서버(브릿지)로 한다: help-server/gitsync.js — GET /git(확인) · POST /git/pull(받기). 브라우저 확장은 git 을 띄울 수 없다.
 *
 * 세 곳에서 쓴다 (manifest 의 eClass content script · popup/popup.html · background.js importScripts 모두 lib/render.js 앞):
 *  - 백그라운드(background.js): check(url, force) 가 조회(refresh)마다 LLM 연결 확인에 이어 서버에 묻고(10분 안이면 마지막 결과 — 서버도 받아 오기는 10분에 한 번) storage.local.gitStatus 에 둔다.
 *    pull(url) 이 받고, 받은 것에 확장 파일이 있으면 reload 표시를 남긴다(그 뒤로는 다시 불러올 때까지 확인하지 않음). offline() 은 서버가 없거나 이 기능이 없는(이전 버전) 서버일 때 상태를 비워 단추를 숨긴다.
 *  - 패널(lib/render.js 제목 줄): button(state) — state.git 으로 단추 HTML. **새 커밋이 있을 때만** 보인다(GitHub 과 같으면 아무것도 없음 — 사용자 지정). 귀퉁이 수는 새 커밋 수.
 *      new: 켜진 색, 누르면 받기 · blocked(고치고 있는 파일과 겹침)·diverged(여기에만 있는 커밋도 있음): 흐림, 누르면 다시 확인(풍선 말에 까닭) · reload: ↻(받은 것을 반영 — 누르면 확장 다시 불러오기, 사용자가 누를 때만) · busy: 받는 중
 *  - content/eclass.js · popup/popup.js: bind(state, draw) 가 저장소를 읽고 변화를 따르며, act(state) 가 누른 뜻을 백그라운드 메시지({ type: 'gitPull' | 'gitReload' | 'gitCheck' })로 준다.
 * gitStatus = { url, at, ok, branch, upstream, ahead, behind, commits[{ hash, subject }], dirty, overlap[], fetchError, fetchedAt, error, busy(''|'pull'), pullError, reload(bool), reloadText }
 * 테스트: node tests/gitsync.test.js (가짜 chrome·fetch) */
const KRX_GIT = (() => {
  const g = typeof self !== 'undefined' ? self : globalThis;
  const KEY = 'gitStatus';
  const CHECK_MS = 10 * 60000;                       // 조회마다 불려도 이 안에서는 서버에 다시 묻지 않는다
  const CHECK_TIMEOUT = 50000, PULL_TIMEOUT = 90000;  // 확인은 서버의 git fetch(최대 20초) 뒤에 답한다 · 받기는 pull(최대 60초)
  const SHOW_COMMITS = 5;                            // 풍선 말에 적는 새 커밋 줄 수
  const DEFAULT_URL = 'http://127.0.0.1:8106';
  const base = (u) => (g.KRX_LLM && g.KRX_LLM.baseUrl ? g.KRX_LLM.baseUrl(u) : String(u || DEFAULT_URL).trim().replace(/\/+$/, '') || DEFAULT_URL);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hhmm = (t) => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const svg = (d) => `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICON_DOWN = svg('<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>');      // 받기: 아래 화살표 + 바닥 줄
  const ICON_RELOAD = svg('<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>');          // 다시 불러오기: 원형 화살표
  let last = null;      // 마지막 상태 (메모리 — 워커가 다시 뜨면 저장소에서)
  let inflight = null;  // 진행 중인 확인

  /* ---------- 순수: 상태 → 단추 모양 · 받은 결과 → 말 ---------- */

  /**
   * 상태(gitStatus)를 단추의 모양으로. mode — off: 숨김(서버 없음·확인 실패·아직 모름) · same: 숨김(GitHub 과 같음) · new: 새 커밋(누르면 받기) ·
   * blocked: 새 커밋이 고치고 있는 파일과 겹침 · diverged: 여기에만 있는 커밋도 있어 갈라짐 · reload: 받은 것을 반영하려면 다시 불러와야 함 · busy: 받는 중. count 는 귀퉁이의 새 커밋 수.
   * @returns {{mode: string, count: string, title: string}}
   */
  function view(s) {
    if (!s) return { mode: 'off', count: '', title: '' };
    if (s.reload) return { mode: 'reload', count: '', title: `${s.reloadText || 'GitHub 에서 받은 것을 반영하려면 확장을 다시 불러와야 합니다.'}\n누르면 확장을 다시 불러옵니다 (패널이 닫힙니다 — 다시 열면 됩니다).` };
    if (s.busy === 'pull') return { mode: 'busy', count: '', title: 'GitHub 에서 받는 중…' };
    if (!s.ok) return { mode: 'off', count: '', title: '' };
    const when = s.at ? ` · ${hhmm(s.at)} 확인` : '';
    const stale = s.fetchError ? `\n(받아 오기 실패: ${s.fetchError} — 마지막으로 받아 둔 것과 비교했습니다)` : '';
    const failed = s.pullError ? `${s.pullError}\n\n` : '';
    const behind = Number(s.behind) || 0, ahead = Number(s.ahead) || 0;
    if (behind > 0) {
      const count = behind > 99 ? '99+' : String(behind);
      const list = (s.commits || []).slice(0, SHOW_COMMITS).map((c) => `· ${c.hash} ${c.subject}`).join('\n');
      const more = behind > SHOW_COMMITS ? `\n… 외 ${behind - SHOW_COMMITS}개` : '';
      const head = `${failed}GitHub(${s.upstream || 'origin'})에 새 커밋 ${behind}개${when}`;
      if (ahead > 0) return { mode: 'diverged', count, title: `${head}\n${list}${more}\n\n여기에만 있는 커밋도 ${ahead}개 있어 빨리 감기로 받을 수 없습니다 — 터미널에서 직접 pull 하세요. 누르면 다시 확인합니다.${stale}` };
      if (s.overlap && s.overlap.length) {
        const files = `${s.overlap.slice(0, 5).join(', ')}${s.overlap.length > 5 ? ` 외 ${s.overlap.length - 5}개` : ''}`;
        return { mode: 'blocked', count, title: `${head}\n${list}${more}\n\n고치고 있는 파일과 겹쳐 지금은 받을 수 없습니다(${files}) — 커밋하거나 치운 뒤 누르면 다시 확인합니다.${stale}` };
      }
      return { mode: 'new', count, title: `${head} — 누르면 받습니다(git pull, Help 서버)\n${list}${more}${s.dirty ? `\n\n고치고 있는 파일 ${s.dirty}개는 그대로 둡니다.` : ''}${stale}` };
    }
    return { mode: 'same', count: '', title: `${failed}GitHub(${s.upstream || 'origin'})과 같습니다${when}${ahead ? ` · 여기에만 있는 커밋 ${ahead}개(올리기는 하지 않습니다)` : ''}${stale}` };
  }

  /** 받은 결과(POST /git/pull)를 한 줄 말로. reload 면 확장을 다시 불러와야 반영된다. */
  function said(r) {
    if (!r || !r.ok) return { ok: false, reload: false, text: `GitHub 에서 받지 못했습니다 — ${(r && r.error) || 'Help 서버가 답하지 않았습니다'}` };
    if (!r.pulled) return { ok: true, reload: false, text: '이미 GitHub 과 같습니다.' };
    const server = !r.server ? '' : r.restart === 'later' ? ' Help 서버는 하던 일(채팅·분류·찾아오기)을 마치면 스스로 다시 뜹니다.' : ' Help 서버는 스스로 다시 뜹니다.';
    return {
      ok: true, reload: !!r.reload,
      text: `GitHub 에서 커밋 ${r.pulled}개를 받았습니다(${r.from} → ${r.to}, 파일 ${r.fileCount}개)`
        + (r.reload ? ' — 단추를 한 번 더 누르면 확장을 다시 불러옵니다(패널이 닫힙니다).' : '.')
        + server + (r.deps ? ' package.json 이 바뀌었습니다 — 저장소 폴더에서 npm install 을 돌리세요.' : ''),
    };
  }

  /* ---------- 패널 ---------- */

  /** 제목 줄 단추 HTML — 보일 것이 없으면 빈 문자열 (lib/render.js 제목 줄) */
  function button(state) {
    const v = view(state && state.git);
    if (v.mode === 'off' || v.mode === 'same') return '';
    const first = v.title.split('\n')[0];
    return `<button type="button" class="krext-btn krext-btn-git krext-git-${v.mode}${v.mode === 'busy' ? ' krext-spin' : ''}" data-act="git" title="${esc(v.title)}" aria-label="${esc(first)}"${v.mode === 'busy' ? ' disabled' : ''}>${v.mode === 'reload' ? ICON_RELOAD : ICON_DOWN}${v.count ? `<span class="krext-git-count">${esc(v.count)}</span>` : ''}</button>`;
  }
  /** 단추를 눌렀을 때 백그라운드에 보낼 메시지 — new 면 받기, reload 면 확장 다시 불러오기, 그 밖에는 다시 확인. busy 면 null */
  function act(state) {
    const v = view(state && state.git);
    if (v.mode === 'busy') return null;
    if (v.mode === 'reload') return { type: 'gitReload' };
    if (v.mode === 'new') return { type: 'gitPull' };
    return { type: 'gitCheck', force: true };
  }
  /** 패널 상태에 저장소의 gitStatus 를 넣고(state.git) 바뀌면 다시 그린다 */
  function bind(state, draw) {
    try { chrome.storage.local.get(KEY).then((r) => { state.git = (r && r[KEY]) || null; draw(); }, () => {}); } catch (e) {}
    try { chrome.storage.onChanged.addListener((ch, area) => { try { if (area === 'local' && ch[KEY]) { state.git = ch[KEY].newValue || null; draw(); } } catch (e) {} }); } catch (e) {}
  }

  /* ---------- 백그라운드 ---------- */

  async function load() {
    if (last) return last;
    try { last = (await chrome.storage.local.get(KEY))[KEY] || null; } catch (e) {}
    return last;
  }
  const same = (a, b) => JSON.stringify(Object.assign({}, a, { at: 0, fetchedAt: 0 })) === JSON.stringify(Object.assign({}, b, { at: 0, fetchedAt: 0 }));
  /** 상태를 저장한다 — 모양이 같으면(시각만 다르면) 저장소는 건드리지 않는다(패널이 다시 그리지 않게) */
  async function save(st) {
    const prev = last;
    last = st;
    if (prev && same(prev, st)) return st;
    try { await chrome.storage.local.set({ [KEY]: st }); } catch (e) {}
    return st;
  }
  async function fetchJson(url, init, ms) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    try {
      const res = await fetch(url, Object.assign({ cache: 'no-store', signal: ac.signal }, init || {}));
      let j = null;
      try { j = await res.json(); } catch (e) {}
      if (j && typeof j === 'object') return j;
      return { ok: false, error: `Help 서버 응답 ${res.status}` };
    } finally { clearTimeout(t); }
  }
  /** GET /git 응답 → 상태 */
  function shape(url, j, err) {
    const at = Date.now();
    if (!j || !j.ok) return { url, at, ok: false, error: (j && j.error) || err || `연결할 수 없습니다 (${url})`, busy: '' };
    return {
      url, at, ok: true, branch: String(j.branch || ''), upstream: String(j.upstream || ''), ahead: Number(j.ahead) || 0, behind: Number(j.behind) || 0,
      commits: (Array.isArray(j.commits) ? j.commits : []).slice(0, 10).map((c) => ({ hash: String(c.hash || ''), subject: String(c.subject || '') })),
      dirty: Number(j.dirty) || 0, overlap: (Array.isArray(j.overlap) ? j.overlap : []).map(String), fetchError: String(j.fetchError || ''), fetchedAt: Number(j.fetchedAt) || 0, busy: '',
    };
  }
  /**
   * GitHub 새 커밋 확인 — Help 서버 GET /git. force 면 10분 안이어도 다시 묻고 서버도 받아 오기부터(?fetch=1).
   * 받은 것을 아직 반영하지 않았으면(reload) 다시 불러올 때까지 그 표시를 그대로 둔다.
   */
  async function check(url, force) {
    url = base(url);
    const prev = await load();
    if (prev && prev.reload) return prev;
    if (!force && prev && prev.ok && prev.url === url && Date.now() - prev.at < CHECK_MS) return prev;
    if (inflight) return inflight;
    inflight = (async () => {
      let j = null, err = '';
      try { j = await fetchJson(`${url}/git${force ? '?fetch=1' : ''}`, null, CHECK_TIMEOUT); } catch (e) { err = `연결할 수 없습니다 (${url})`; }
      return save(shape(url, j, err));
    })();
    try { return await inflight; } finally { inflight = null; }
  }
  /** 확장이 다시 올라왔을 때(background onInstalled) — 받은 뒤의 ↻ 표시까지 지워 다음 조회에서 새로 확인한다 */
  async function reset() {
    last = null;
    try { await chrome.storage.local.remove(KEY); } catch (e) {}
  }
  /** 서버가 없거나 이 기능이 없는 서버 — 단추를 숨긴다 (reload 표시는 남김) */
  async function offline(url, why) {
    const prev = await load();
    if (prev && prev.reload) return prev;
    return save({ url: base(url), at: Date.now(), ok: false, error: String(why || 'Help 서버 연결 안 됨'), busy: '' });
  }
  /**
   * 받기 — Help 서버 POST /git/pull (git pull --ff-only). 받는 동안 busy 'pull' 을 저장해 단추가 돌아가고, 끝나면
   * 확장 파일이 바뀌었으면 reload 표시(↻)를, 아니면 다시 확인한 상태(실패면 pullError 와 함께)를 저장한다.
   * @returns {Promise<{ok: boolean, reload: boolean, text: string, restart: string}>}
   */
  async function pull(url) {
    url = base(url);
    const prev = await load();
    if (prev && prev.busy === 'pull') return { ok: false, reload: false, text: '받는 중입니다', restart: '' };
    if (prev && prev.reload) return { ok: true, reload: true, text: prev.reloadText || '', restart: '' };
    await save(Object.assign({}, prev && prev.ok ? prev : { url, ok: true }, { busy: 'pull', pullError: '' }));
    let r;
    try { r = await fetchJson(`${url}/git/pull`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }, PULL_TIMEOUT); }
    catch (e) { r = { ok: false, error: `Help 서버가 ${PULL_TIMEOUT / 1000}초 안에 답하지 않았습니다 (${url})` }; }
    const s = said(r);
    const restart = (r && r.ok && r.restart) || '';
    if (s.ok && s.reload) {
      await save({ url, at: Date.now(), ok: true, branch: String(r.branch || (prev && prev.branch) || ''), upstream: String((prev && prev.upstream) || ''), ahead: 0, behind: 0, commits: [], dirty: 0, overlap: [], fetchError: '', fetchedAt: 0, busy: '', reload: true, reloadText: s.text, pulled: { from: r.from, to: r.to, pulled: r.pulled, files: r.files || [], fileCount: r.fileCount } });
      return { ok: true, reload: true, text: s.text, restart };
    }
    last = Object.assign({}, last, { busy: '' });   // 다시 확인(force) — 받은 것이 없거나 서버·문서만 바뀜, 또는 실패
    const st = restart ? Object.assign({}, shape(url, null, ''), { ok: true, behind: 0, ahead: 0, commits: [], overlap: [], dirty: 0, fetchError: '', fetchedAt: 0 }) : await check(url, true);   // 서버가 다시 뜨는 중이면 지금은 묻지 않는다(다음 조회에서)
    if (restart) await save(st);
    if (!s.ok) await save(Object.assign({}, st, { pullError: s.text }));
    return { ok: s.ok, reload: false, text: s.text, restart };
  }

  const api = { KEY, CHECK_MS, view, said, button, act, bind, check, offline, pull, load, reset };
  g.KRX_GIT = api;   // 다른 스크립트(render.js 의 g.KRX_GIT · eclass.js/popup.js 의 self.KRX_GIT)가 속성으로 찾는다 — 최상위 const 는 self 의 속성이 아니다
  return api;
})();
