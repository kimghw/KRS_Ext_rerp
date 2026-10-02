/* www.rcms.go.kr (RCMS, 범부처 연구비통합관리시스템): ID 로그인 자동 입력 — background.js openRcms · rcmsLogin 과 짝
 * 로그인 화면(/login/rid.do?PORTAL_YN=Y, 로그인 실패 뒤 같은 폼을 다시 보이는 /login/loginRcvFail.do)은 WebSquare 가 화면 XML(/common/login/loginForm.xml)을 받아 그린다:
 *   form#loginForm(action https://cims.keit.re.kr/login/login.do) 안의 input#loginId · input#loginPasswd 와 hidden 값(sysCd, cmd, failRedir, successRedir),
 *   로그인 버튼 a#btn_login(scwin.btn_login_onclick → 시스템 작업시간 확인 /rest/com/lginSysWorkNoti → form submit).
 *   화면 컴포넌트의 getValue() 는 DOM 값을 그대로 읽으므로 값은 DOM 에 넣고 버튼은 클릭만 한다(2026-10-02 CDP 확인). 키보드보안(TouchEn nxKey)은 이 화면에서 꺼져 있다.
 * 설정에 ID·비밀번호가 있으면 폼을 채우고, 패널·팝업의 "RCMS 열기"로 연 탭이면(백그라운드가 submit 을 한 번만 줌) 로그인 버튼까지 누른다.
 * 그 탭이 로그인 화면이 아닌 곳(포털 /index.do)에 닿았으면 세션(/wq/getSession.do 의 userInfo — 로그아웃 상태면 null)을 보고 로그아웃 상태일 때만 로그인 화면으로 간다.
 * ID 로그인 뒤의 2차 인증(SMS·인증앱)은 사용자가 직접 한다 */
(async () => {
  if (window.top !== window) return;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const ask = async (stage) => { try { return await chrome.runtime.sendMessage({ type: 'rcmsLogin', stage }); } catch (e) { return null; } };

  if (!/^\/login\//i.test(location.pathname)) {
    const r = await ask('check');
    if (!r || !r.armed) return;
    let user = null;
    try { user = (await (await fetch('/wq/getSession.do?sessionKey=' + Date.now(), { credentials: 'include', cache: 'no-store' })).json()).userInfo; } catch (e) { return; }
    if (user) { ask('done'); return; }
    location.href = '/login/rid.do?PORTAL_YN=Y';   // 포털 머리글의 로그인 버튼이 가는 주소
    return;
  }

  // 폼이 그려지고 화면 onpageload(initTarget: form action · successRedir 채움, 저장된 아이디 복원)가 끝날 때까지 — 로그인 화면이 아닌 /login/ 주소(2차 인증 등)에서는 폼이 없어 그냥 끝난다
  let f = null;
  for (let i = 0; i < 60 && !f; i++) {
    const id = document.getElementById('loginId'), pw = document.getElementById('loginPasswd'), btn = document.getElementById('btn_login'), redir = document.getElementById('successRedir');
    if (id && pw && btn && redir && redir.value) f = { id, pw, btn }; else await sleep(250);
  }
  if (!f) return;
  const r = await ask('form');
  if (!r || !r.id || !r.pw) return;
  if (f.pw.value) return;   // 사용자가 이미 입력 중이면 건드리지 않음
  const put = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  put(f.id, r.id); put(f.pw, r.pw);
  if (r.submit) f.btn.click();
})();
