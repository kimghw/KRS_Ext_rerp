/* 오프스크린 문서: 백그라운드가 보낸 글을 클립보드에 쓴다 (사용자 클릭 없이도 됨 — chrome.offscreen 의 CLIPBOARD 용도).
 * 메시지 { type: 'offscreenCopy', text } → { ok } */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== 'offscreenCopy') return;
  let ok = false, err = '';
  try {
    const ta = document.getElementById('t');
    ta.value = String(msg.text || '');
    ta.focus();   // focus 없이 select 만 하면 execCommand('copy') 가 false (2026-09-27 CDP 로 확인)
    ta.select();
    ok = document.execCommand('copy');
  } catch (e) { ok = false; err = String((e && e.message) || e); }
  sendResponse({ ok, err, ready: document.readyState, sel: String(window.getSelection()).length });
});
