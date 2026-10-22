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
  assert.ok(doc.includes('xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"') && doc.includes('<w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>') && doc.includes('<w:pgMar w:top="720"') && doc.endsWith('</w:sectPr></w:body></w:document>'));
});
test('문단·표 — 제목(16pt 굵게 가운데) · 줄바꿈 · 위첨자 · 병합(gridSpan · vMerge restart/continue) · 회색 머리 · 빗금 · 열 너비 합(A4 가로) · 머리 줄 반복 · 쪽 나눔', () => {
  const doc = { blocks: [{ type: 'p', text: '제목', align: 'CENTER', style: 'title' }, { type: 'table', widths: [1, 3], rows: [[{ text: '머리<sup>1)</sup>\n(%)', shade: true, colSpan: 2 }, { skip: true }], [{ text: 'a\nb', rowSpan: 2 }, { text: '<x> & "y"', align: 'RIGHT', bold: true }], [{ skip: true }, { text: '', hatch: true }]] }, { type: 'pagebreak' }, { type: 'p', text: '작게', style: 'small' }] };
  const xml = get(D.build(doc), 'word/document.xml');
  assert.ok(balanced(xml));
  assert.ok(xml.includes('<w:jc w:val="center"/></w:pPr>') && xml.includes('<w:rPr><w:b/><w:bCs/><w:sz w:val="32"/>') && xml.includes('<w:t xml:space="preserve">제목</w:t>'));
  assert.ok((xml.match(/<w:tc>/g) || []).length === 5, '칸: 머리 1 + 둘째 줄 2 + 셋째 줄 2(세로 병합 이어짐 칸 포함)');
  assert.ok(xml.includes('<w:gridSpan w:val="2"/>') && xml.includes('<w:vMerge w:val="restart"/>') && xml.includes('<w:vMerge/>') && xml.includes('<w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/>') && xml.includes('<w:shd w:val="thinDiagStripe" w:color="808080" w:fill="D9D9D9"/>'));
  assert.ok(xml.includes('<w:t xml:space="preserve">머리</w:t></w:r><w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/><w:vertAlign w:val="superscript"/></w:rPr><w:t xml:space="preserve">1)</w:t></w:r><w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:br/><w:t xml:space="preserve">(%)</w:t></w:r>'), '위첨자 run 뒤 줄바꿈 run');
  assert.ok(xml.includes('<w:br/><w:t xml:space="preserve">b</w:t>') && xml.includes('&lt;x&gt; &amp; &quot;y&quot;') && xml.includes('<w:jc w:val="right"/>'));
  const grid = [...xml.matchAll(/<w:gridCol w:w="(\d+)"\/>/g)].map((m) => Number(m[1]));
  assert.deepStrictEqual([grid, grid.reduce((s, x) => s + x, 0)], [[3850, 11548], D.BODY_W], '1:3 나눔, 합은 본문 너비 15398(A4 가로)');
  const tcw = [...xml.matchAll(/<w:tcW w:w="(\d+)"/g)].map((m) => Number(m[1]));
  assert.deepStrictEqual(tcw, [D.BODY_W, 3850, 11548, 3850, 11548], '병합 칸은 두 열 너비 합');
  assert.ok(xml.includes('<w:tblHeader/>') && xml.includes('<w:p><w:pPr><w:pageBreakBefore/><w:spacing w:before="0" w:after="60"/></w:pPr><w:r><w:rPr><w:sz w:val="16"/>') && !xml.includes('w:type="page"'), '쪽 나눔은 다음 문단의 pageBreakBefore');
  const x2 = get(D.build({ blocks: [{ type: 'table', headerRows: 2, rows: [['a'], ['b'], ['c']] }, { type: 'pagebreak' }] }), 'word/document.xml');
  assert.ok((x2.match(/<w:tblHeader\/>/g) || []).length === 2 && x2.includes('<w:br w:type="page"/>'), '머리 줄 2개 반복, 마지막 쪽 나눔은 run');
  assert.ok(xml.includes('<w:tblLayout w:type="fixed"/>') && xml.includes('<w:tblW w:w="15398" w:type="dxa"/>'));
});

test('쪽 나눔 규칙 — 세로 병합 묶음(한 사람)은 keepNext 로 한 쪽에, 줄은 cantSplit, 칸의 pageBreakBefore 로 그 줄부터 새 쪽(부서별)', () => {
  const xml = get(D.build({ blocks: [{ type: 'table', widths: [1, 1], rows: [['h1', 'h2'], [{ text: 'a', rowSpan: 3 }, '1'], [{ skip: true }, '2'], [{ skip: true }, '3'], [{ text: 'b', pageBreakBefore: true }, '4']] }] }), 'word/document.xml');
  const trs = xml.match(/<w:tr>.*?<\/w:tr>/g);
  assert.strictEqual(trs.length, 5);
  assert.deepStrictEqual(trs.map((tr) => (tr.match(/<w:keepNext\/>/g) || []).length), [2, 2, 2, 0, 0], '머리 줄과, a 의 세 줄 중 앞 두 줄의 모든 칸(이어지는 병합 칸 포함)이 다음 줄과 붙음');
  assert.ok(trs.every((tr) => tr.includes('<w:trPr><w:cantSplit/><w:trHeight')), '줄 안에서 쪽이 나뉘지 않음');
  assert.ok(trs[4].includes('<w:tc><w:tcPr><w:tcW w:w="7699" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:pageBreakBefore/><w:spacing') && (xml.match(/<w:pageBreakBefore\/>/g) || []).length === 1, '이어지는 병합 칸에는 쪽 나눔 없음');
  const x3 = get(D.build({ blocks: [{ type: 'p', text: '2. 평가', style: 'h' }, { type: 'p', text: '본문' }] }), 'word/document.xml');
  assert.ok(x3.includes('<w:p><w:pPr><w:keepNext/><w:spacing w:before="120"') && (x3.match(/<w:keepNext\/>/g) || []).length === 1, "'h' 제목 문단은 다음 문단·표와 붙음");
});

console.log(`\n${n} passed, ${failed} failed`);
