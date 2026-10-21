/* lib/docx.js (Word .docx 만들기 — zip 저장 + WordprocessingML) — zip 항목·CRC, 꾸러미(Content_Types · rels), 문단(정렬·크기·굵게·줄바꿈)·표(gridSpan · vMerge · 회색 머리 · 열 너비 합 = 본문 너비)·쪽 나눔, 이스케이프, 태그 균형. 실행: node tests/docx.test.js */
globalThis.self = globalThis;
const path = require('path');
const assert = require('assert');
require(path.join(__dirname, '..', 'lib/docx.js'));
const D = KRX_DOCX;
let n = 0, failed = 0;
const test = (name, fn) => { try { fn(); n++; console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n   ', e.stack || e.message); process.exitCode = 1; } };
/* 여는 태그와 닫는 태그 수가 같은지(자기 닫힘 제외) */
const balanced = (xml) => { const open = {}, close = {}; for (const m of xml.matchAll(/<(\/?)([\w:]+)([^>]*?)(\/?)>/g)) { if (m[1]) close[m[2]] = (close[m[2]] || 0) + 1; else if (!m[4]) open[m[2]] = (open[m[2]] || 0) + 1; } return Object.keys(open).every((k) => open[k] === (close[k] || 0)) && Object.keys(close).every((k) => (open[k] || 0) === close[k]); };
const get = (bytes, nm) => D.entries(bytes).find((e) => e.name === nm).data;

test('zip — 항목 7개 차례, CRC, 끝 레코드, 표준 CRC32', () => {
  const bytes = D.build({ title: 'T', blocks: [{ type: 'p', text: '안녕' }] });
  const ents = D.entries(bytes);
  assert.deepStrictEqual(ents.map((e) => e.name), ['[Content_Types].xml', '_rels/.rels', 'docProps/core.xml', 'docProps/app.xml', 'word/_rels/document.xml.rels', 'word/styles.xml', 'word/document.xml']);
  assert.ok(ents.every((e) => e.ok), 'CRC');
  assert.deepStrictEqual([bytes[0], bytes[1]], [0x50, 0x4b]);
  const tail = bytes.subarray(bytes.length - 22);
  assert.deepStrictEqual([tail[0], tail[1], tail[2], tail[3], tail[10] | (tail[11] << 8)], [0x50, 0x4b, 0x05, 0x06, 7], 'EOCD 와 항목 수');
  assert.strictEqual(D.crc32(new TextEncoder().encode('123456789')), 0xCBF43926);
});
test('꾸러미 — Content_Types 의 document·styles, 관계, 제목·만든이 이스케이프, 태그 균형', () => {
  const bytes = D.build({ title: 'T<1>', author: 'A&B', blocks: [{ type: 'p', text: '안녕' }] });
  for (const e of D.entries(bytes)) { assert.ok(e.data.startsWith('<?xml version="1.0" encoding="UTF-8"'), e.name); assert.ok(balanced(e.data), `${e.name} 태그 균형`); }
  assert.ok(get(bytes, '[Content_Types].xml').includes('PartName="/word/document.xml"') && get(bytes, '_rels/.rels').includes('Target="word/document.xml"') && get(bytes, 'word/_rels/document.xml.rels').includes('Target="styles.xml"'));
  assert.ok(get(bytes, 'docProps/core.xml').includes('<dc:title>T&lt;1&gt;</dc:title>') && get(bytes, 'docProps/core.xml').includes('<dc:creator>A&amp;B</dc:creator>'));
  assert.ok(get(bytes, 'word/styles.xml').includes('w:eastAsia="맑은 고딕"') && get(bytes, 'word/styles.xml').includes('w:styleId="Normal"'));
  const doc = get(bytes, 'word/document.xml');
  assert.ok(doc.includes('xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"') && doc.includes('<w:pgSz w:w="11906" w:h="16838"/>') && doc.includes('<w:pgMar w:top="720"') && doc.endsWith('</w:sectPr></w:body></w:document>'));
});
test('문단·표 — 제목(16pt 굵게 가운데) · 줄바꿈 · 병합(gridSpan · vMerge restart/continue) · 회색 머리 · 열 너비 합 · 머리 줄 반복 · 쪽 나눔', () => {
  const doc = { blocks: [{ type: 'p', text: '제목', align: 'CENTER', style: 'title' }, { type: 'table', widths: [1, 3], rows: [[{ text: '머리', shade: true, colSpan: 2 }, { skip: true }], [{ text: 'a\nb', rowSpan: 2 }, { text: '<x> & "y"', align: 'RIGHT', bold: true }], [{ skip: true }, { text: 'c' }]] }, { type: 'pagebreak' }, { type: 'p', text: '작게', style: 'small' }] };
  const xml = get(D.build(doc), 'word/document.xml');
  assert.ok(balanced(xml));
  assert.ok(xml.includes('<w:jc w:val="center"/></w:pPr>') && xml.includes('<w:rPr><w:b/><w:bCs/><w:sz w:val="32"/>') && xml.includes('<w:t xml:space="preserve">제목</w:t>'));
  assert.ok((xml.match(/<w:tc>/g) || []).length === 5, '칸: 머리 1 + 둘째 줄 2 + 셋째 줄 2(세로 병합 이어짐 칸 포함)');
  assert.ok(xml.includes('<w:gridSpan w:val="2"/>') && xml.includes('<w:vMerge w:val="restart"/>') && xml.includes('<w:vMerge/>') && xml.includes('<w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/>'));
  assert.ok(xml.includes('<w:br/><w:t xml:space="preserve">b</w:t>') && xml.includes('&lt;x&gt; &amp; &quot;y&quot;') && xml.includes('<w:jc w:val="right"/>'));
  const grid = [...xml.matchAll(/<w:gridCol w:w="(\d+)"\/>/g)].map((m) => Number(m[1]));
  assert.deepStrictEqual([grid, grid.reduce((s, x) => s + x, 0)], [[2617, 7849], D.BODY_W], '1:3 나눔, 합은 본문 너비 10466');
  const tcw = [...xml.matchAll(/<w:tcW w:w="(\d+)"/g)].map((m) => Number(m[1]));
  assert.deepStrictEqual(tcw, [D.BODY_W, 2617, 7849, 2617, 7849], '병합 칸은 두 열 너비 합');
  assert.ok(xml.includes('<w:tblHeader/>') && xml.includes('<w:br w:type="page"/>') && xml.includes('<w:sz w:val="16"/>'));
  assert.ok(xml.includes('<w:tblLayout w:type="fixed"/>') && xml.includes('<w:tblW w:w="10466" w:type="dxa"/>'));
});

console.log(`\n${n} passed, ${failed} failed`);
