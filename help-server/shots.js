/* Help Chat 에 붙여 넣은 그림(화면 캡처) — popup/help.js 가 /ask 의 images([{ type, dataUrl }])로 보내면 help-server/shots/<작업 id>-<n>.<확장자> 로 두고
 * 저장소 기준 경로를 돌려준다. 서버는 그 경로를 요청 글에 적어 Claude 가 Read 로 열어 보게 한다(저장소 안이라 묻지 않고 읽힘).
 * kr_ext_workspace 의 native/helpchat.mjs keepShots 를 옮긴 것 (2026-10-27 사용자 지정: "krer 처럼 캡쳐해서 붙여 넣을 수 있는 기능 추가 해줘").
 * 그림이 아니거나 크면 건너뛰고, 7일 지난 그림은 이때 지운다. shots/ 는 git 에서 제외(.gitignore). */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(__dirname, 'shots');
const MAX = 4, BYTES = 5 * 1024 * 1024, KEEP_MS = 7 * 86400000;
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };

/** @returns {string[]} 저장한 그림의 저장소 기준 경로(슬래시) — 없으면 [] */
function keep(id, images, opts) {
  const o = opts || {};
  const dir = o.dir || DIR, root = o.root || ROOT, now = o.now || Date.now();
  const list = (Array.isArray(images) ? images : []).slice(0, MAX);
  if (!list.length || !/^[\w-]+$/.test(String(id || ''))) return [];
  fs.mkdirSync(dir, { recursive: true });
  try {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (now - fs.statSync(p).mtimeMs > KEEP_MS) fs.unlinkSync(p);
    }
  } catch (e) { /* 지우기는 곁다리 */ }
  const out = [];
  list.forEach((img, i) => {
    const m = /^data:(image\/[\w.+-]+);base64,(.+)$/s.exec(String((img && img.dataUrl) || ''));
    const ext = m && EXT[m[1]];
    if (!ext) return;
    const bytes = Buffer.from(m[2], 'base64');
    if (!bytes.length || bytes.length > BYTES) return;
    const file = path.join(dir, `${id}-${i + 1}.${ext}`);
    fs.writeFileSync(file, bytes);
    out.push(path.relative(root, file).replace(/\\/g, '/'));
  });
  return out;
}

module.exports = { keep, MAX, BYTES, DIR };
