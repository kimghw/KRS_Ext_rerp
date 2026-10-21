/* lib/doc-text.js 테스트 — zip(저장·deflate) 읽기, xlsx(공유 문자열·칸 위치·날짜 서식)·docx(문단·표)·hwpx(문단·표) 글 뽑기, HWP 5.x 레코드(PARA_TEXT 컨트롤·표 칸)·종류 판정. 실제 HWP(CFB)·HWPX·xlsx 파일로는 2026-10-21 에 따로 확인함.
 * 실행: node tests/doc-text.test.js */
const assert = require('assert');
const path = require('path');
const zlib = require('zlib');
const D = require(path.join(__dirname, '..', 'lib/doc-text.js'));
const queue = [];
const test = (name, fn) => queue.push([name, fn]);

/* zip 만들기 — entries: [[이름, 글]…], deflate 면 8 번 방식 */
function crc32(buf) { let crc = 0xffffffff; for (let i = 0; i < buf.length; i++) { let c = (crc ^ buf[i]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function zip(entries, deflate) {
  const locals = [], centrals = []; let off = 0;
  for (const [name, text] of entries) {
    const nameB = Buffer.from(name), raw = Buffer.from(text), data = deflate ? zlib.deflateRawSync(raw) : raw;
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x800, 6); h.writeUInt16LE(deflate ? 8 : 0, 8); h.writeUInt32LE(crc32(raw), 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(raw.length, 22); h.writeUInt16LE(nameB.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x800, 8); c.writeUInt16LE(deflate ? 8 : 0, 10); c.writeUInt32LE(crc32(raw), 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(nameB.length, 28); c.writeUInt32LE(off, 42);
    locals.push(h, nameB, data); centrals.push(c, nameB); off += 30 + nameB.length + data.length;
  }
  const cd = Buffer.concat(centrals), e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(entries.length, 8); e.writeUInt16LE(entries.length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return new Uint8Array(Buffer.concat([...locals, cd, e]));
}
/* HWP 레코드 — 머리 4바이트(tag 10비트 · level 10비트 · size 12비트) + 내용 */
const rec = (tag, level, payload) => { const b = Buffer.alloc(4 + payload.length); b.writeUInt32LE((tag | (level << 10) | (payload.length << 20)) >>> 0, 0); payload.copy(b, 4); return b; };
const u16 = (...codes) => { const b = Buffer.alloc(codes.length * 2); codes.forEach((c, i) => b.writeUInt16LE(c, i * 2)); return b; };
const txt = (s, ...tail) => u16(...Array.from(s).map((ch) => ch.charCodeAt(0)), ...tail);
const cell = (col, row) => { const b = Buffer.alloc(16); b.writeUInt16LE(col, 8); b.writeUInt16LE(row, 10); return b; };

test('unzip — 저장(0)·deflate(8) 항목을 이름대로 돌려준다', async () => {
  for (const deflate of [false, true]) {
    const z = await D.unzip(zip([['a/b.xml', '<x>하나</x>'], ['c.txt', 'two']], deflate));
    assert.deepStrictEqual([...z.keys()], ['a/b.xml', 'c.txt']);
    assert.strictEqual(new TextDecoder().decode(z.get('a/b.xml')), '<x>하나</x>');
    assert.strictEqual(new TextDecoder().decode(z.get('c.txt')), 'two');
  }
  await assert.rejects(() => D.unzip(new Uint8Array([1, 2, 3])), /zip 파일이 아닙니다/);
});

test('xlsx — 공유 문자열·칸 위치(빈 칸은 비워 둠)·인라인 문자열·날짜 서식 칸(YYYY-MM-DD)·시트 이름', async () => {
  const z = zip([
    ['xl/workbook.xml', '<workbook><sheets><sheet name="계획" sheetId="1" r:id="rId1"/></sheets></workbook>'],
    ['xl/sharedStrings.xml', '<sst><si><t>이름</t></si><si><r><t>참여</t></r><r><t>율</t></r></si><si><t>문창재</t></si></sst>'],
    ['xl/styles.xml', '<styleSheet><numFmts><numFmt numFmtId="164" formatCode="yyyy&quot;년&quot; m&quot;월&quot;"/></numFmts><cellXfs><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="164"/></cellXfs></styleSheet>'],
    ['xl/worksheets/sheet1.xml', '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>25</v></c><c r="C2" s="1"><v>46023</v></c><c r="E2" t="inlineStr"><is><t>메모</t></is></c><c r="F2" s="2"><v>46054</v></c></row><row r="3"/></sheetData></worksheet>'],
  ], true);
  assert.strictEqual(await D.textOf('계획.xlsx', z), '[시트 계획]\n이름\t참여율\n문창재\t25\t2026-01-01\t\t메모\t2026-02-01');
});

test('docx — 문단은 줄, 표는 칸 탭·행 줄, 엔티티', async () => {
  const z = zip([['word/document.xml', '<w:document><w:body><w:p><w:r><w:t>제목</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>이름</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>참여</w:t></w:r><w:r><w:t>율</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>문창재</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>25%</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:r><w:t>끝 &amp; 더</w:t><w:br/><w:t>둘째 줄</w:t></w:r></w:p></w:body></w:document>']]);
  assert.strictEqual(await D.textOf('공문.docx', z), '제목\n이름\t참여율\n문창재\t25%\n끝 & 더\n둘째 줄');
});

test('hwpx — 섹션 차례대로, 문단 줄·표 칸, hp: 접두사 없는 것도', async () => {
  const z = zip([
    ['Contents/section1.xml', '<hs:sec><p><run><t>둘째 섹션</t></run></p></hs:sec>'],
    ['Contents/section0.xml', '<hs:sec><hp:p><hp:run><hp:t>머리</hp:t></hp:run></hp:p><hp:tbl><hp:tr><hp:tc><hp:subList><hp:p><hp:run><hp:t>이름</hp:t></hp:run></hp:p></hp:subList></hp:tc><hp:tc><hp:subList><hp:p><hp:run><hp:t>25%</hp:t></hp:run></hp:p><hp:p><hp:run><hp:t>(계획)</hp:t></hp:run></hp:p></hp:subList></hp:tc></hp:tr></hp:tbl><hp:p><hp:run><hp:t>끝</hp:t></hp:run></hp:p></hs:sec>'],
  ]);
  assert.strictEqual(await D.textOf('공문.hwpx', z), '머리\n이름\t25% (계획)\n끝\n\n둘째 섹션');
});

test('hwp 레코드 — PARA_TEXT 의 컨트롤(8칸·탭·줄바꿈·고정폭 빈칸)과 표 칸(LIST_HEADER 행·열)·표 끝', () => {
  assert.strictEqual(D.decodeText(txt('가', 9, 0, 0, 0, 0, 0, 0, 0, 10, 31, 0xd55c, 13)), '가\t\n 한');
  const section = Buffer.concat([
    rec(66, 0, Buffer.alloc(22)), rec(67, 1, txt('제목', 13)),
    rec(66, 0, Buffer.alloc(22)), rec(67, 1, u16(11, 0, 0, 0, 0, 0, 0, 0, 13)), rec(71, 1, Buffer.alloc(4)), rec(77, 2, Buffer.alloc(8)),
    rec(72, 2, cell(0, 0)), rec(66, 3, Buffer.alloc(22)), rec(67, 4, txt('이름', 13)),
    rec(72, 2, cell(1, 0)), rec(66, 3, Buffer.alloc(22)), rec(67, 4, txt('참여율', 13)),
    rec(72, 2, cell(0, 1)), rec(66, 3, Buffer.alloc(22)), rec(67, 4, txt('문창재', 13)),
    rec(72, 2, cell(1, 1)), rec(66, 3, Buffer.alloc(22)), rec(67, 4, txt('25%', 13)),
    rec(66, 0, Buffer.alloc(22)), rec(67, 1, txt('끝', 13)),
  ]);
  assert.strictEqual(D.sectionText(new Uint8Array(section)), '제목\n이름\t참여율\n문창재\t25%\n끝');
  assert.throws(() => D.cfb(new Uint8Array(16)), /CFB/);
});

test('kindOf · 글 파일', async () => {
  assert.deepStrictEqual(['a.XLSX', 'b.xlsm', 'c.docx', 'd.hwpx', 'e.hwp', 'f.pdf', 'g.PNG', 'h.csv', 'i.doc', 'j.pptx', 'k'].map((n) => D.kindOf(n, '')), ['xlsx', 'xlsx', 'docx', 'hwpx', 'hwp', 'pdf', 'image', 'text', '', '', '']);
  assert.deepStrictEqual([D.kindOf('x', 'image/jpeg'), D.kindOf('x', 'application/pdf'), D.kindOf('x', 'text/plain')], ['image', 'pdf', 'text']);
  assert.strictEqual(await D.textOf('메모.csv', Buffer.from('이름,참여율\r\n문창재,25  \n')), '이름,참여율\n문창재,25');
  assert.strictEqual(await D.textOf('사진.png', new Uint8Array(4)), null);
  assert.strictEqual(await D.textOf('옛.doc', new Uint8Array(4)), null);
});

(async () => {
  let passed = 0;
  for (const [name, fn] of queue) {
    try { await fn(); passed++; console.log('ok  ', name); }
    catch (e) { process.exitCode = 1; console.error('FAIL', name, '\n', e.stack); }
  }
  console.log(`${passed} passed, ${queue.length - passed} failed`);
})();
