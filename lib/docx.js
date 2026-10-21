/* Word 문서(.docx) 만들기 (2026-10-21 사용자 "최종적으로는 HWPX 양식에 맞게 계산서를 출력해줘야해" → "hwpx 아니고 docx 로 출력해줘") — 의존 패키지 없이 확장 안에서 .docx(zip + WordprocessingML)를 만든다.
 * 쓰는 곳: 연구수당 계산 탭(lib/allowance.js)의 [DOCX 내려받기] — 별지 1 연구수행 기여도 평가서 · 별지 2 연구수당 지급 내역서(references/10-53_…md 의 서식).
 * 문서 모형(build 의 입력): { title, author, blocks[ { type:'p', text(줄바꿈 \n 은 <w:br/>, <sup>…</sup> 는 위첨자 — 양식의 주석 번호 1)…5)), align('LEFT'|'CENTER'|'RIGHT'), style('title'|'h'|'small'|''), bold }
 *                                            | { type:'table', widths[열 너비 비율], small(8pt), rowHeight(DXA — 최소 높이), headerRows(쪽마다 반복할 머리 줄 수, 기본 1), rows[[ { text, colSpan, rowSpan, shade(머리 회색), hatch(빗금 — 양식의 적지 않는 칸), align, bold, skip(병합으로 가려진 자리) } ]] }
 *                                            | { type:'pagebreak' } ] } — 쪽 나눔은 다음 문단의 pageBreakBefore 로(앞 쪽이 꽉 찼을 때 빈 쪽이 생기지 않게 — 2026-10-21 Word 로 확인), 다음이 문단이 아니면 쪽 나눔 run
 * 병합: colSpan 은 gridSpan(가려진 자리는 적지 않음), rowSpan 은 vMerge(restart 뒤 가려진 줄에는 빈 칸을 vMerge 로 적어야 함 — table() 이 skip 자리에서 만든다).
 * 결과: Uint8Array(zip — 압축 없이 저장, CRC32) → download(name, bytes). A4 가로(별지 1·2 양식이 가로 — 2026-10-21 양식 p03·p10 과 대조), 여백 1.27cm(720 DXA) → 본문 너비 15398 DXA. 글꼴 맑은 고딕 10pt(표 small 8pt). Node 테스트: node tests/docx.test.js */
(function (g) {
  const PAGE_W = 16838, PAGE_H = 11906, MARGIN = 720, BODY_W = PAGE_W - MARGIN * 2;   // A4 가로
  const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* ---------- zip (저장만, CRC32) ---------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; } return t; })();
  const crc32 = (u8) => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const enc = (s) => new TextEncoder().encode(s);
  /* entries [{ name, data(string | Uint8Array) }] → Uint8Array */
  function zip(entries) {
    const parts = [], central = [];
    let offset = 0;
    const u16 = (n) => [n & 0xFF, (n >>> 8) & 0xFF], u32 = (n) => [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF];
    const dos = { time: 0, date: 0x21 };   // 1980-01-01 00:00 — 재현 가능
    for (const e of entries) {
      const name = enc(e.name), data = typeof e.data === 'string' ? enc(e.data) : e.data;
      const crc = crc32(data);
      const head = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(dos.time), ...u16(dos.date), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...name]);
      parts.push(head, data);
      central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(dos.time), ...u16(dos.date), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name]));
      offset += head.length + data.length;
    }
    const cdSize = central.reduce((s, c) => s + c.length, 0);
    const eocd = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length), ...u32(cdSize), ...u32(offset), ...u16(0)]);
    const all = [...parts, ...central, eocd];
    const out = new Uint8Array(all.reduce((s, a) => s + a.length, 0));
    let pos = 0; for (const a of all) { out.set(a, pos); pos += a.length; }
    return out;
  }
  /* zip 안의 항목 [{ name, data(문자열), ok(CRC) }] — 테스트·검사용(저장 방식만 읽는다) */
  function entries(bytes) {
    const out = []; const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let pos = 0;
    while (pos + 30 <= bytes.length && dv.getUint32(pos, true) === 0x04034b50) {
      const size = dv.getUint32(pos + 18, true), nl = dv.getUint16(pos + 26, true), xl = dv.getUint16(pos + 28, true);
      const name = new TextDecoder().decode(bytes.subarray(pos + 30, pos + 30 + nl));
      const data = bytes.subarray(pos + 30 + nl + xl, pos + 30 + nl + xl + size);
      out.push({ name, data: new TextDecoder().decode(data), ok: crc32(data) === dv.getUint32(pos + 14, true) });
      pos += 30 + nl + xl + size;
    }
    return out;
  }

  /* ---------- WordprocessingML ---------- */
  const SZ = { title: 32, h: 24, small: 16, '': 20 };   // 반 포인트
  const JC = { LEFT: 'left', CENTER: 'center', RIGHT: 'right' };
  function run(text, { style, bold } = {}) {
    const sz = SZ[style] || SZ[''];
    const rpr = (sup) => `<w:rPr>${bold || style === 'title' || style === 'h' ? '<w:b/><w:bCs/>' : ''}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>${sup ? '<w:vertAlign w:val="superscript"/>' : ''}</w:rPr>`;   // 스키마 차례: b → sz → vertAlign
    // 줄마다 <sup>…</sup> 로 나눈 조각(홀수 자리가 위첨자)을 run 으로 — 줄의 첫 조각은 비어도 적어 줄바꿈(<w:br/>)과 빈 글이 남는다
    return String(text == null ? '' : text).split('\n').map((line, i) => line.split(/<sup>(.*?)<\/sup>/).map((seg, k) => (!k || seg ? `<w:r>${rpr(k % 2)}${!k && i ? '<w:br/>' : ''}<w:t xml:space="preserve">${esc(seg)}</w:t></w:r>` : '')).join('')).join('');
  }
  function para(text, o = {}) {
    const ppr = `<w:pPr>${o.pageBreakBefore ? '<w:pageBreakBefore/>' : ''}<w:spacing w:before="${o.style === 'h' ? 120 : 0}" w:after="${o.inCell ? 0 : o.style === 'title' ? 160 : 60}"/>${o.align && JC[o.align] ? `<w:jc w:val="${JC[o.align]}"/>` : ''}</w:pPr>`;   // 스키마 차례: pageBreakBefore → spacing → jc
    return `<w:p>${ppr}${run(text, o)}</w:p>`;
  }
  const pageBreak = () => '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
  /* 표 — widths(비율) 로 열 너비를 본문 너비에 맞춘다. rowSpan 은 첫 줄에 vMerge restart, 아래 줄의 skip 자리에 vMerge 빈 칸(gridSpan 같이) */
  function table(t) {
    const widths = t.widths && t.widths.length ? t.widths : [1];
    const sum = widths.reduce((s, w) => s + w, 0);
    const colW = widths.map((w) => Math.round(BODY_W * w / sum));
    colW[colW.length - 1] = BODY_W - colW.slice(0, -1).reduce((s, x) => s + x, 0);   // 반올림 나머지는 마지막 열에 — 열 너비 합 = 본문 너비
    const rowH = t.rowHeight || 360;
    const style = t.small ? 'small' : '';
    const cover = {};   // `${r}:${c}` → { lead, span } 세로 병합으로 가려진 자리
    const tc = (cell, col, cs, vmerge) => {
      const w = colW.slice(col, col + cs).reduce((s, x) => s + x, 0);
      const pr = `<w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${cs > 1 ? `<w:gridSpan w:val="${cs}"/>` : ''}${vmerge ? `<w:vMerge${vmerge === 'restart' ? ' w:val="restart"' : ''}/>` : ''}${cell.hatch ? '<w:shd w:val="thinDiagStripe" w:color="808080" w:fill="D9D9D9"/>' : cell.shade ? '<w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/>' : ''}<w:vAlign w:val="center"/></w:tcPr>`;
      return `<w:tc>${pr}${para(vmerge === 'cont' ? '' : cell.text, { align: cell.align || 'CENTER', style: cell.style || style, bold: cell.bold, inCell: true })}</w:tc>`;
    };
    const trs = (t.rows || []).map((cells, r) => {
      let col = 0;
      const out = [];
      for (const c of cells) {
        if (c && c.skip) { const cv = cover[`${r}:${col}`]; if (cv && cv.lead) out.push(tc(cv.cell, col, cv.span, 'cont')); col += 1; continue; }
        const cell = c && typeof c === 'object' ? c : { text: c };
        const cs = cell.colSpan || 1, rs = cell.rowSpan || 1;
        out.push(tc(cell, col, cs, rs > 1 ? 'restart' : ''));
        if (rs > 1) for (let rr = r + 1; rr < r + rs; rr++) for (let cc = col; cc < col + cs; cc++) cover[`${rr}:${cc}`] = { lead: cc === col, span: cs, cell };
        col += cs;
      }
      return `<w:tr><w:trPr><w:trHeight w:val="${rowH}"/>${r < (t.headerRows || 1) && t.header !== false ? '<w:tblHeader/>' : ''}</w:trPr>${out.join('')}</w:tr>`;
    }).join('');
    const borders = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((b) => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`).join('');
    return `<w:tbl><w:tblPr><w:tblW w:w="${BODY_W}" w:type="dxa"/><w:jc w:val="center"/><w:tblBorders>${borders}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="60" w:type="dxa"/><w:right w:w="60" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${colW.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${trs}</w:tbl><w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`;
  }
  function documentXml(blocks) {
    const bs = blocks || [], parts = [];
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i], nx = bs[i + 1];
      if (b.type === 'table') parts.push(table(b));
      else if (b.type === 'pagebreak') { if (nx && nx.type === 'p') { parts.push(para(nx.text, Object.assign({}, nx, { pageBreakBefore: true }))); i++; } else parts.push(pageBreak()); }
      else parts.push(para(b.text, b));
    }
    const body = parts.join('');
    const sect = `<w:sectPr><w:pgSz w:w="${PAGE_W}" w:h="${PAGE_H}" w:orient="landscape"/><w:pgMar w:top="${MARGIN}" w:right="${MARGIN}" w:bottom="${MARGIN}" w:left="${MARGIN}" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr>`;
    return `${XML}<w:document xmlns:w="${W}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}${sect}</w:body></w:document>`;
  }
  const stylesXml = `${XML}<w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="맑은 고딕" w:hAnsi="맑은 고딕" w:eastAsia="맑은 고딕" w:cs="맑은 고딕"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="ko-KR" w:eastAsia="ko-KR" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="60" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>`;
  const contentTypes = `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
  const rootRels = `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
  const docRels = `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const coreXml = (doc) => { const t = new Date().toISOString().replace(/\.\d+Z$/, 'Z'); return `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(doc.title || '')}</dc:title><dc:creator>${esc(doc.author || '')}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${t}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${t}</dcterms:modified></cp:coreProperties>`; };
  const appXml = `${XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>KR eClass + R&amp;D ERP 현황</Application></Properties>`;

  /* 문서 모형 → docx 바이트 */
  function build(doc) {
    const d = doc || {};
    return zip([
      { name: '[Content_Types].xml', data: contentTypes },
      { name: '_rels/.rels', data: rootRels },
      { name: 'docProps/core.xml', data: coreXml(d) },
      { name: 'docProps/app.xml', data: appXml },
      { name: 'word/_rels/document.xml.rels', data: docRels },
      { name: 'word/styles.xml', data: stylesXml },
      { name: 'word/document.xml', data: documentXml(d.blocks) },
    ]);
  }
  /* 브라우저에서 내려받기 */
  function download(name, bytes) {
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  g.KRX_DOCX = { BODY_W, build, download, entries, zip, crc32, esc, documentXml };
})(typeof self !== 'undefined' ? self : this);
