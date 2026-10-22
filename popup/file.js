/* 청구 준비 첨부 파일 보기 (0.8.9) — 파일 칩의 이름을 클릭하면 백그라운드(prepFileOpen)가 이 페이지를 새 탭으로 연다(주소의 #<파일 id>).
 * 파일은 확장 IndexedDB(lib/prep-store.js)에 있어 백그라운드 'prepFile' 로 base64 를 받아 Blob 으로 만들고 PDF 는 Chrome PDF 보기(embed), 이미지는 img, 그 밖은 내려받기 */
(async () => {
  const body = document.body;
  const say = (msg) => { body.innerHTML = ''; const p = document.createElement('p'); p.textContent = msg; body.appendChild(p); };
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id) { say('파일 id 가 없습니다'); return; }
  let r = null;
  try { r = await chrome.runtime.sendMessage({ type: 'prepFile', id }); } catch (e) { r = { error: String((e && e.message) || e) }; }
  if (!r || !r.ok || !r.b64) { say((r && r.error) || '파일을 찾지 못했습니다 (청구 준비에서 지웠거나 다른 브라우저에 저장된 파일)'); return; }
  const bin = atob(r.b64), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const mime = String(r.mime || 'application/octet-stream');
  const url = URL.createObjectURL(new Blob([u8], { type: mime }));
  document.title = r.name || '첨부 파일';
  body.innerHTML = '';
  if (/^image\//.test(mime)) { const img = document.createElement('img'); img.src = url; img.alt = r.name || ''; body.appendChild(img); }
  else if (mime === 'application/pdf') { const em = document.createElement('embed'); em.src = url; em.type = mime; body.appendChild(em); }
  else {   // 엑셀·HWP 등 브라우저가 못 보이는 것은 내려받기
    const a = document.createElement('a'); a.href = url; a.download = r.name || 'file'; a.textContent = `${r.name} 내려받기`;
    const p = document.createElement('p'); p.textContent = '브라우저에서 바로 볼 수 없는 파일입니다 — '; p.appendChild(a); body.appendChild(p);
    a.click();
  }
})();
