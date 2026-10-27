/* help-server/shots.js — Help Chat 에 붙여 넣은 그림을 파일로 두고 저장소 기준 경로를 돌려준다(2026-10-27). 임시 폴더에서만. 실행: node tests/help-shots.test.js */
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const shots = require('../help-server/shots.js');

let n = 0, failed = 0;
const test = (name, fn) => { try { fn(); n++; console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n   ', e.stack || e.message); process.exitCode = 1; } };

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'krx-shots-'));
const dir = path.join(root, 'help-server', 'shots');
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a1b50000000049454e44ae426082', 'hex');
const url = (type, buf) => `data:${type};base64,${buf.toString('base64')}`;

test('그림을 <id>-<n>.<확장자> 로 두고 저장소 기준 슬래시 경로를 돌려준다', () => {
  const out = shots.keep('20261027075000-abc123', [{ type: 'image/png', dataUrl: url('image/png', PNG) }, { type: 'image/jpeg', dataUrl: url('image/jpeg', PNG) }], { dir, root });
  assert.deepStrictEqual(out, ['help-server/shots/20261027075000-abc123-1.png', 'help-server/shots/20261027075000-abc123-2.jpg']);
  assert.ok(fs.readFileSync(path.join(dir, '20261027075000-abc123-1.png')).equals(PNG));
});
test('그림이 아니거나 너무 크면 건너뛰고, 4장까지만', () => {
  const big = Buffer.alloc(shots.BYTES + 1, 1);
  const out = shots.keep('job2', [
    { dataUrl: 'data:text/html;base64,PGI+' },        // 그림 아님
    { dataUrl: url('image/svg+xml', PNG) },           // 모르는 그림 형식(svg 는 스크립트를 품을 수 있어 받지 않음)
    { dataUrl: url('image/png', big) },               // 5MB 넘음
    { dataUrl: url('image/png', PNG) },
    { dataUrl: url('image/png', PNG) }               // 다섯째 — 잘림
  ], { dir, root });
  assert.deepStrictEqual(out, ['help-server/shots/job2-4.png']);
});
test('id 가 파일 이름으로 안전하지 않거나 그림이 없으면 아무것도 두지 않는다', () => {
  assert.deepStrictEqual(shots.keep('../x', [{ dataUrl: url('image/png', PNG) }], { dir, root }), []);
  assert.deepStrictEqual(shots.keep('job3', null, { dir, root }), []);
  assert.deepStrictEqual(shots.keep('job3', [], { dir, root }), []);
});
test('7일 지난 그림은 다음에 둘 때 지운다', () => {
  const old = path.join(dir, 'old-1.png');
  fs.writeFileSync(old, PNG);
  const t = (Date.now() - 8 * 86400000) / 1000;
  fs.utimesSync(old, t, t);
  shots.keep('job4', [{ dataUrl: url('image/png', PNG) }], { dir, root });
  assert.ok(!fs.existsSync(old));
  assert.ok(fs.existsSync(path.join(dir, 'job4-1.png')));
});

fs.rmSync(root, { recursive: true, force: true });
console.log(`\n${n} 통과${failed ? `, ${failed} 실패` : ''}`);
