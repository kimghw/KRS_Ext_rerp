/* 첨부 문서의 글 뽑기 (0.8.9 — 2026-10-21 사용자 "엑셀, 워드, PDF, HWP/X, 이미지를 첨부할 수 있게 해줘. HWP 인 경우 HWPX 로 변환해야 할거 같고.. 이미지는 OCR 를 하면 될거 같아"):
 * 변경 도우미 채팅에 붙인 파일 가운데 글로 뽑을 수 있는 것을 의존 패키지 없이 읽는다 —
 *   xlsx(시트별 줄, 칸은 탭, 날짜 서식 칸은 YYYY-MM-DD) · docx(문단 · 표는 칸 탭/줄) · hwpx(문단 · 표) · hwp 5.x(변환 없이 바로 — CFB(OLE2) 안의 BodyText/Section 레코드에서 PARA_TEXT 를 읽음; 표 칸은 LIST_HEADER 의 행·열로) · txt/csv/md(utf-8, 아니면 euc-kr).
 *   zip 은 중앙 디렉터리를 읽어 DecompressionStream('deflate-raw')(Chrome · Node 22+)로 풀고, CFB 는 FAT·미니 FAT 체인을 따라 스트림을 읽는다(E:/dev/choi 의 파이썬 검증 스크립트 _verify_hwp_hwpx_direct 와 같은 길).
 *   PDF·이미지는 여기서 읽지 않는다 — Claude 가 직접 본다(Help 서버: 작업 폴더의 파일을 Read 로, Claude API: document·image 블록 — 이미지 OCR 구실). 암호·배포용(DRM) HWP 와 .xls/.doc 옛 형식은 못 읽는다(kindOf '' 또는 throw).
 * 확장(popup.html script — popup/staff-chat.js 가 보내기 전에 글을 뽑음)과 테스트(require)가 쓴다. 테스트: node tests/doc-text.test.js */
(function (g) {
  'use strict';
  const utf8 = new TextDecoder('utf-8');
  const dec = (b) => utf8.decode(b);
  const le16 = (b, o) => b[o] | (b[o + 1] << 8);
  const le32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
  const cat = (parts, size) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return size == null ? out : out.subarray(0, size); };
  const isNode = typeof process === 'object' && !!(process.versions && process.versions.node) && typeof require === 'function';
  /* raw deflate 풀기 — HWP 섹션 스트림은 끝에 남는 바이트가 있어(압축 스트림 뒤 찌꺼기) 엄격한 풀기는 "trailing junk" 로 실패한다: Node 는 zlib 의 Z_SYNC_FLUSH 로, 브라우저는 DecompressionStream 이 끝을 만나기 전까지 내놓은 조각을 모으고 그 뒤 오류는 버린다 */
  async function inflateRaw(bytes) {
    if (isNode) { const zlib = require('zlib'); return new Uint8Array(zlib.inflateRawSync(bytes, { finishFlush: zlib.constants.Z_SYNC_FLUSH })); }
    const ds = new DecompressionStream('deflate-raw');
    const w = ds.writable.getWriter(), r = ds.readable.getReader(), parts = [];
    const writing = w.write(bytes).then(() => w.close()).catch(() => {});
    try { for (;;) { const { value, done } = await r.read(); if (done) break; parts.push(value); } }
    catch (e) { if (!parts.length) throw e; }
    await writing;
    return cat(parts);
  }
  const isZip = (b) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b;
  const isCfb = (b) => b.length > 8 && le32(b, 0) === 0xe011cfd0 && le32(b, 4) === 0xe11ab1a1;

  /* zip → Map<이름, Uint8Array> (저장 0 · deflate 8, ZIP64 없음). 중앙 디렉터리의 크기를 믿는다(로컬 헤더는 0 일 수 있음) */
  async function unzip(bytes) {
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (le32(bytes, i) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('zip 파일이 아닙니다');
    const n = le16(bytes, eocd + 10);
    let p = le32(bytes, eocd + 16);
    const out = new Map();
    for (let k = 0; k < n && p + 46 <= bytes.length && le32(bytes, p) === 0x02014b50; k++) {
      const method = le16(bytes, p + 10), csize = le32(bytes, p + 20), nameLen = le16(bytes, p + 28), extraLen = le16(bytes, p + 30), commentLen = le16(bytes, p + 32), off = le32(bytes, p + 42);
      const name = dec(bytes.subarray(p + 46, p + 46 + nameLen));
      p += 46 + nameLen + extraLen + commentLen;
      if (off + 30 > bytes.length || le32(bytes, off) !== 0x04034b50) continue;
      const start = off + 30 + le16(bytes, off + 26) + le16(bytes, off + 28);
      const data = bytes.subarray(start, start + csize);
      if (method === 0) out.set(name, data);
      else if (method === 8) out.set(name, await inflateRaw(data));
    }
    return out;
  }

  /* XML 글 — 태그를 벗기고 엔티티를 되돌린다 */
  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  const unent = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => { try { return e[0] === '#' ? String.fromCodePoint(/^#x/i.test(e) ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENT[e.toLowerCase()] != null ? ENT[e.toLowerCase()] : m); } catch (x) { return m; } });
  const strip = (xml) => unent(xml.replace(/<[^>]*>/g, ''));
  const tidy = (t) => String(t || '').replace(/\r\n?/g, '\n').replace(/[ \t\u00a0]+$/gm, '').replace(/ {2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  const numOf = (k) => Number((k.match(/\d+/) || ['0'])[0]);
  const byNum = (a, b) => numOf(a) - numOf(b);
  const xmlOf = (z, name) => { const b = z.get(name); return b ? dec(b) : ''; };
  /* 표 칸 안의 문단은 한 줄로, 칸 끝은 탭, 줄 끝은 줄바꿈 — docx(w:) · hwpx(hp:) 공용 */
  const tables = (xml, p, tc, tr) => xml.replace(new RegExp(`<${tc}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tc}>`, 'g'), (m, inner) => strip(inner.replace(new RegExp(`<\\/${p}>`, 'g'), ' ')).replace(/\s+/g, ' ').trim() + '\t').replace(new RegExp(`<\\/${tr}>`, 'g'), '\n');

  function docxText(z) {
    let x = xmlOf(z, 'word/document.xml');
    if (!x) throw new Error('word/document.xml 이 없습니다');
    x = tables(x, 'w:p', 'w:tc', 'w:tr');
    x = x.replace(/<w:tab\/>/g, '\t').replace(/<w:(?:br|cr)\b[^>]*\/>/g, '\n').replace(/<\/w:p>/g, '\n');
    return tidy(strip(x));
  }
  function hwpxText(z) {
    const secs = [...z.keys()].filter((k) => /^Contents\/section\d+\.xml$/i.test(k)).sort(byNum);
    if (!secs.length) throw new Error('Contents/section*.xml 이 없습니다');
    return tidy(secs.map((k) => {
      let x = xmlOf(z, k);
      x = tables(x, '(?:hp:)?p', '(?:hp:)?tc', '(?:hp:)?tr');
      x = x.replace(/<(?:hp:)?tab\b[^>]*\/>/g, '\t').replace(/<(?:hp:)?lineBreak\b[^>]*\/>/g, '\n').replace(/<\/(?:hp:)?p>/g, '\n');
      return strip(x);
    }).join('\n\n'));
  }
  /* xlsx — 공유 문자열 · 셀 위치(r="C3")대로 칸을 맞추고, 날짜 서식(기본 14~22·27~36·45~47·50~58, 사용자 서식에 y/m/d)의 수는 YYYY-MM-DD 로 */
  function xlsxText(z) {
    const shared = [];
    for (const m of xmlOf(z, 'xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(strip(m[1].replace(/<rPh>[\s\S]*?<\/rPh>/g, '')));
    const styles = xmlOf(z, 'xl/styles.xml');
    const custom = new Map();
    for (const m of styles.matchAll(/<numFmt\b[^>]*\bnumFmtId="(\d+)"[^>]*\bformatCode="([^"]*)"/g)) custom.set(Number(m[1]), unent(m[2]));
    const isDateFmt = (id) => (id >= 14 && id <= 22) || (id >= 27 && id <= 36) || (id >= 45 && id <= 47) || (id >= 50 && id <= 58) || (custom.has(id) && /[ymd]/i.test(custom.get(id).replace(/"[^"]*"|\[[^\]]*\]/g, '')));
    const xfs = ((styles.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/) || [])[1] || '').match(/<xf\b[^>]*>/g) || [];
    const dateStyle = xfs.map((x) => isDateFmt(Number((x.match(/\bnumFmtId="(\d+)"/) || [])[1] || 0)));
    const serialDate = (n) => { const d = new Date(Date.UTC(1899, 11, 30) + Math.round(Number(n)) * 86400000); return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : String(n); };
    const colOf = (ref) => { let c = 0; for (const ch of (ref.match(/^[A-Z]+/) || [''])[0]) c = c * 26 + (ch.charCodeAt(0) - 64); return Math.max(0, c - 1); };
    const names = [...xmlOf(z, 'xl/workbook.xml').matchAll(/<sheet\b[^>]*\bname="([^"]*)"/g)].map((m) => unent(m[1]));
    const sheets = [...z.keys()].filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort(byNum);
    if (!sheets.length) throw new Error('xl/worksheets/sheet*.xml 이 없습니다');
    const out = [];
    sheets.forEach((k, i) => {
      const rows = [];
      for (const r of xmlOf(z, k).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
        const cells = [];
        for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
          const attrs = c[1], inner = c[2] || '';
          const t = (attrs.match(/\bt="(\w+)"/) || [])[1] || '', s = Number((attrs.match(/\bs="(\d+)"/) || [])[1] || -1), ref = (attrs.match(/\br="([A-Z]+\d+)"/) || [])[1] || '';
          const v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
          let val = '';
          if (t === 's') val = shared[Number(v)] != null ? shared[Number(v)] : '';
          else if (t === 'inlineStr') val = strip(inner);
          else if (v != null) val = t === '' && s >= 0 && dateStyle[s] && /^\d+(\.\d+)?$/.test(v) ? serialDate(v) : unent(v);
          const col = ref ? colOf(ref) : cells.length;
          while (cells.length < col) cells.push('');
          cells[col] = val.replace(/\s+/g, ' ').trim();
        }
        if (cells.some((x) => x)) rows.push(cells.join('\t').replace(/\t+$/, ''));
      }
      if (rows.length) out.push(`[시트 ${names[i] || i + 1}]\n${rows.join('\n')}`);
    });
    return tidy(out.join('\n\n'));
  }

  /* CFB(OLE2) 컨테이너 — { paths: Map<경로, entry>, read(경로) → Uint8Array|null } */
  function cfb(bytes) {
    if (le32(bytes, 0) !== 0xe011cfd0 || le32(bytes, 4) !== 0xe11ab1a1) throw new Error('HWP(CFB) 파일이 아닙니다');
    const ss = 1 << le16(bytes, 30), ms = 1 << le16(bytes, 32), cutoff = le32(bytes, 56), END = 0xfffffffe;
    const sector = (sid) => bytes.subarray((sid + 1) * ss, (sid + 2) * ss);
    const u32s = (b) => { const a = []; for (let i = 0; i + 4 <= b.length; i += 4) a.push(le32(b, i)); return a; };
    const difat = []; for (let i = 0; i < 109; i++) difat.push(le32(bytes, 76 + i * 4));
    for (let sid = le32(bytes, 68), i = 0, n = le32(bytes, 72); i < n && sid < END; i++) { const v = u32s(sector(sid)); difat.push(...v.slice(0, -1)); sid = v[v.length - 1]; }
    const fat = []; for (const s of difat) if (s < END) fat.push(...u32s(sector(s)));
    const chain = (start, table) => { const r = [], seen = new Set(); for (let s = start; s < END && s < table.length && !seen.has(s); s = table[s]) { seen.add(s); r.push(s); } return r; };
    const readNormal = (start, size) => cat(chain(start, fat).map(sector), size);
    const dir = readNormal(le32(bytes, 48));
    const entries = [];
    for (let o = 0; o + 128 <= dir.length; o += 128) {
      const nl = le16(dir, o + 64);
      entries.push({ name: nl >= 2 ? new TextDecoder('utf-16le').decode(dir.subarray(o, o + nl - 2)) : '', type: dir[o + 66], left: le32(dir, o + 68), right: le32(dir, o + 72), child: le32(dir, o + 76), start: le32(dir, o + 116), size: le32(dir, o + 120) });
    }
    const root = entries.find((e) => e.type === 5);
    if (!root) throw new Error('CFB 루트가 없습니다');
    const miniFat = []; for (const s of chain(le32(bytes, 60), fat).slice(0, le32(bytes, 64))) miniFat.push(...u32s(sector(s)));
    const mini = readNormal(root.start, root.size);
    const paths = new Map(), seen = new Set();
    const walk = (i, prefix) => {
      if (i >= END || i >= entries.length || seen.has(i)) return;
      seen.add(i);
      const e = entries[i];
      walk(e.left, prefix);
      const cur = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.type === 1) walk(e.child, cur); else if (e.type === 2) paths.set(cur, e);
      walk(e.right, prefix);
    };
    walk(root.child, '');
    const read = (name) => { const e = paths.get(name); if (!e) return null; return e.size < cutoff ? cat(chain(e.start, miniFat).map((s) => mini.subarray(s * ms, (s + 1) * ms)), e.size) : readNormal(e.start, e.size); };
    return { paths, read };
  }
  /* PARA_TEXT(UTF-16LE) → 글. 1~23(10·13 빼고)은 8칸짜리 컨트롤(9 탭은 탭으로), 10 줄바꿈, 13 문단 끝, 30 붙임표, 31 고정폭 빈칸, 0·24~29 는 버림 */
  function decodeText(p) {
    const u = []; for (let i = 0; i + 2 <= p.length; i += 2) u.push(le16(p, i));
    let s = '';
    for (let i = 0; i < u.length;) {
      const c = u[i];
      if (c === 10) { s += '\n'; i++; }
      else if (c === 13 || c === 0 || (c >= 24 && c <= 29)) i++;
      else if (c >= 1 && c <= 23) { if (c === 9) s += '\t'; i += 8; }
      else if (c === 30) { s += '-'; i++; }
      else if (c === 31) { s += ' '; i++; }
      else if (c >= 0xd800 && c <= 0xdbff && i + 1 < u.length && u[i + 1] >= 0xdc00 && u[i + 1] <= 0xdfff) { s += String.fromCodePoint(0x10000 + ((c - 0xd800) << 10) + (u[i + 1] - 0xdc00)); i += 2; }
      else { s += String.fromCharCode(c); i++; }
    }
    return s;
  }
  /* 섹션 레코드 → 글: PARA_HEADER(66) 마다 문단, PARA_TEXT(67) 글, TABLE(77)·LIST_HEADER(72, 칸 정보 있음)로 표 칸(탭)·행(줄바꿈), 표 수준보다 얕은 문단이 오면 표 끝 */
  function sectionText(raw) {
    const lines = [];
    let table = null;   // { level, row, cells:[], buf }
    const flushCell = () => { if (table && table.buf != null) { table.cells.push(table.buf.replace(/\s+/g, ' ').trim()); table.buf = null; } };
    const flushRow = () => { flushCell(); if (table && table.cells.length) { lines.push(table.cells.join('\t')); table.cells = []; } };
    const endTable = () => { if (table) { flushRow(); table = null; } };
    let para = null;
    const endPara = () => { if (para != null) { if (table && table.buf != null) table.buf += (table.buf ? ' ' : '') + para; else if (!table) lines.push(para); para = null; } };
    for (let o = 0; o + 4 <= raw.length;) {
      const h = le32(raw, o); o += 4;
      const tag = h & 0x3ff, level = (h >> 10) & 0x3ff; let size = h >>> 20;
      if (size === 0xfff) { size = le32(raw, o); o += 4; }
      if (o + size > raw.length) break;
      const p = raw.subarray(o, o + size); o += size;
      if (tag === 66) { endPara(); if (table && level < table.level) endTable(); para = ''; }
      else if (tag === 67) { para = (para || '') + decodeText(p); }
      else if (tag === 77) { if (para === '') para = null; endPara(); endTable(); table = { level, row: -1, cells: [], buf: null }; }   // 표를 담은 문단(컨트롤 글자뿐)은 빈 줄로 남기지 않음
      else if (tag === 72 && table && size >= 16) { endPara(); flushCell(); const row = le16(p, 10); if (table.row >= 0 && row !== table.row) flushRow(); table.row = row; table.buf = ''; }
    }
    endPara(); endTable();
    return lines.join('\n');
  }
  async function hwpText(bytes) {
    const f = cfb(bytes);
    const head = f.read('FileHeader');
    if (!head || dec(head.subarray(0, 17)) !== 'HWP Document File') throw new Error('HWP 5.x 문서가 아닙니다 (옛 HWP 3 형식은 못 읽음)');
    const flags = le32(head, 36);
    if (flags & 2) throw new Error('암호가 걸린 HWP 는 읽을 수 없습니다');
    if (flags & 4) throw new Error('배포용(DRM) HWP 는 읽을 수 없습니다');
    const secs = [...f.paths.keys()].filter((k) => /^BodyText\/Section\d+$/.test(k)).sort(byNum);
    if (!secs.length) throw new Error('BodyText 가 없습니다');
    const out = [];
    for (const k of secs) { let raw = f.read(k); if (flags & 1) raw = await inflateRaw(raw); out.push(sectionText(raw)); }
    return tidy(out.join('\n\n'));
  }

  /* 파일 이름·MIME → 종류: xlsx · docx · hwpx · hwp · text(글로 뽑음) / pdf · image(Claude 가 직접 봄) / ''(못 읽음 — .xls .doc .ppt 등) */
  function kindOf(name, type) {
    const ext = (String(name || '').match(/\.([a-z0-9]+)$/i) || ['', ''])[1].toLowerCase(), mime = String(type || '').toLowerCase();
    if (ext === 'xlsx' || ext === 'xlsm') return 'xlsx';
    if (ext === 'docx') return 'docx';
    if (ext === 'hwpx') return 'hwpx';
    if (ext === 'hwp') return 'hwp';
    if (ext === 'pdf' || mime === 'application/pdf') return 'pdf';
    if (/^(png|jpe?g|gif|webp|bmp)$/.test(ext) || /^image\/(png|jpe?g|gif|webp|bmp)$/.test(mime)) return 'image';
    if (/^(txt|csv|md|json|tsv)$/.test(ext) || /^text\//.test(mime)) return 'text';
    return '';
  }
  function plainText(bytes) {
    try { return tidy(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    catch (e) { try { return tidy(new TextDecoder('euc-kr').decode(bytes)); } catch (x) { return tidy(dec(bytes)); } }
  }
  /* 글 뽑기 — 종류에 따라. pdf·image·모르는 종류는 null (못 읽는 문서는 throw). hwp/hwpx 는 확장자를 믿지 않고 안을 본다(.hwpx 인데 CFB 인 내려받기 파일이 있음) */
  async function textOf(name, bytes, type) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (b.length > 16 && dec(b.subarray(0, 15)) === '<DOCUMENT SAFER') throw new Error('문서 보안(DRM, Document Safer)으로 잠긴 파일 — 보안을 푼 파일로 다시 붙이세요');
    switch (kindOf(name, type)) {
      case 'xlsx': return xlsxText(await unzip(b));
      case 'docx': return docxText(await unzip(b));
      case 'hwpx': case 'hwp': return isCfb(b) ? hwpText(b) : isZip(b) ? hwpxText(await unzip(b)) : hwpText(b);
      case 'text': return plainText(b);
      default: return null;
    }
  }

  const api = { unzip, textOf, kindOf, xlsxText, docxText, hwpxText, hwpText, cfb, decodeText, sectionText, tidy };
  if (typeof module === 'object' && module.exports) module.exports = api;   // Node (테스트 · 서버)
  else g.KRX_DOC_TEXT = api;                                               // 확장 (popup.html script)
})(typeof self !== 'undefined' ? self : globalThis);
