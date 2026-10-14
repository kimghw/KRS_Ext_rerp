/* 이 문서가 어디에 떠 있는지를 가장 먼저 정한다 (popup.html 의 첫 스크립트) — 툴바 팝업 창(기본, action.default_popup) 또는 사이드 패널(manifest side_panel, 같은 popup.html)·탭.
 * 팝업 창은 문서 크기(460px × 최대 600px)를 스스로 정하고 다른 곳을 누르면 닫히지만, 사이드 패널은 크기를 패널이 정하므로 문서가 꽉 채워야 하고(popup.html 의 html.krext-side 스타일),
 * 닫히지 않으므로 청구 준비 줄의 파일 끌어다 놓기·파일 선택 창도 쓸 수 있다 (lib/render.js prepCtx.files).
 * 구분: chrome.extension.getViews({ type: 'popup' }) 에 이 window 가 있으면 팝업 창. 사이드 패널·탭은 여기 들지 않는다. API 를 못 쓰면 주소의 #side 로 판단.
 * 결과는 <html class="krext-side"> 와 window.KRX_SIDE 로 남겨 CSS(popup.html)·popup.js(state.sidePanel)·help.js(요청 출처 문구)가 쓴다 */
(() => {
  let popup;
  try { popup = chrome.extension.getViews({ type: 'popup' }).includes(window); }
  catch (e) { popup = !/[?#]side(\b|$)/.test(location.href); }
  window.KRX_SIDE = !popup;
  if (!popup) document.documentElement.classList.add('krext-side');
})();
