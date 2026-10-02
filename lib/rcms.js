/* RCMS(www.rcms.go.kr, 범부처 연구비통합관리시스템) 열기 + ID 로그인 자동 입력 — 백그라운드 쪽 (화면 쪽은 content/rcms.js)
 * RCMS 는 eClass SSO 와 무관한 외부 사이트라 ID·비밀번호로 로그인한다. 값은 설정 페이지에서 받아 storage.local.rcmsCred {id, pw} 에 둔다(암호화 없음. 동기화되는 settings 와 패널 캐시에는 넣지 않음).
 * 로그인 버튼까지 누르는 것은 패널·팝업의 "RCMS 열기"로 연 탭에서 한 번만이다(storage.session.rcmsAuto {tabId, until}) — 로그인에 실패하면 RCMS 가 같은 폼(loginRcvFail.do)을 다시 보이므로
 * 폼이 보일 때마다 누르면 틀린 비밀번호로 계속 시도해 계정이 잠길 수 있다. 다른 경로로 로그인 화면에 가면 칸만 채운다. ID 로그인 뒤의 2차 인증(SMS·인증앱)은 사용자가 직접 한다 */
(function (g) {
  const CRED_KEY = 'rcmsCred', AUTO_KEY = 'rcmsAuto';
  const AUTO_MS = 120000;   // RCMS 열기 뒤 이 시간 안에 로그인 화면에 닿아야 로그인 버튼까지 누름
  const ORIGIN = 'https://www.rcms.go.kr';

  async function config() {
    const settings = await g.KRX_SETTINGS.load();
    const rcms = Object.assign({}, g.KRX_SETTINGS.DEFAULTS.rcms, settings.rcms || {});
    const cred = (await chrome.storage.local.get(CRED_KEY))[CRED_KEY] || {};
    const id = String(cred.id || '').trim(), pw = String(cred.pw || '');
    return { url: rcms.url || g.KRX_SETTINGS.DEFAULTS.rcms.url, auto: rcms.autoLogin !== false && !!id && !!pw, id, pw };
  }

  /* 패널·팝업 하단 "RCMS 열기": 탭을 열고, 자동 로그인이 켜져 있고 ID·비밀번호가 있으면 그 탭에 로그인 버튼 한 번을 걸어 둔다 */
  async function open(sender) {
    const c = await config();
    const opt = { url: c.url };
    if (sender && sender.tab) { opt.windowId = sender.tab.windowId; opt.index = sender.tab.index + 1; }   // eClass 패널에서 누르면 그 탭 옆에
    const tab = await chrome.tabs.create(opt);
    if (c.auto) await chrome.storage.session.set({ [AUTO_KEY]: { tabId: tab.id, until: Date.now() + AUTO_MS } });
    else await chrome.storage.session.remove(AUTO_KEY);
    return { ok: true, auto: c.auto };
  }

  /* content/rcms.js 의 물음. stage 'check'(로그인 화면이 아닌 곳: RCMS 열기로 연 탭인가) · 'form'(로그인 폼이 보임: ID·비밀번호, 버튼을 누를지) · 'done'(이미 로그인돼 있음) */
  async function login(msg, sender) {
    // 비밀번호는 www.rcms.go.kr 최상위 프레임의 콘텐츠 스크립트에만 준다
    if (!sender || !sender.tab || sender.frameId !== 0 || !String(sender.url || '').startsWith(ORIGIN + '/')) return { ok: false };
    const c = await config();
    if (!c.auto) return { ok: false };
    const a = (await chrome.storage.session.get(AUTO_KEY))[AUTO_KEY];
    const armed = !!a && a.tabId === sender.tab.id && Date.now() < a.until;
    const stage = msg && msg.stage;
    if (stage === 'check') return { ok: true, armed };
    if (armed) await chrome.storage.session.remove(AUTO_KEY);   // 버튼을 누르거나('form') 이미 로그인돼 있으면('done') 끝 — 한 번만
    if (stage !== 'form') return { ok: true };
    return { ok: true, id: c.id, pw: c.pw, submit: armed };
  }

  g.KRX_RCMS = { open, login, AUTO_MS };
})(typeof self !== 'undefined' ? self : this);
