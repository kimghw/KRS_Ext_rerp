/* lib/render.js 의 보완요청 결의서 링크(slipScreen · slipLink · supplementLink) 테스트 — 미신청내역조회 화면(rappr_0017_01.js goProcTab)이 여는 화면·주소와 같아야 한다. 실행: node tests/supplement-link.test.js */
globalThis.self = globalThis;
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..');
for (const f of ['lib/format.js', 'lib/render.js']) require(path.join(root, f));
const R = KRX_RENDER;
let n = 0, failed = 0;
const test = (name, fn) => { try { fn(); n++; console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n   ', e.stack || e.message); process.exitCode = 1; } };
const req = (href) => { const m = /#krext=(.+)$/.exec(href); assert.ok(m, 'krext 딥링크가 아님: ' + href); return JSON.parse(decodeURIComponent(m[1])); };

// 2026-09-29 CDP 실측 행 (rappr_0017_01_r001 → rnd-api fetchSupplements 매핑)
const general = { procTypCd: 'P10', procTypNm: '청구서작성', prjNo: '2026-0063-01', prjNm: 'MW급 10kV 고전압 직류 시스템용 반도체 차단기 개발', reqCnt: '33', apprDivCd: '30', cfrcOut: 'Y', cfrcLimited: 'Y', cfrcLimitedAmt: '50000', gainBiz: '20', opinion: '교통비 수정', amount: 368536, reqGbn: false, cardSent: null };

test('일반청구(P10): 청구서(일반) rexpe_0084_01 을 메뉴 이름으로, 주소는 ERP goProcTab 과 같은 순서·값', () => {
  const r = req(R.slipLink(general));
  assert.strictEqual(r.open, 'rexpe_0084_01.act');
  assert.strictEqual(r.title, '청구서(일반)');
  assert.strictEqual(r.menuName, '일반청구');
  assert.strictEqual(r.menuId, undefined);
  assert.strictEqual(r.q, 'PRJ_NO=2026-0063-01&REQ_CNT=33&APPR_DIV_CD=30&CFRC_OUT_ATTNTS_MARK_YN=Y&CFRC_LIMITED_YN=Y&CFRC_LIMITED_AMT=50000&PRJ_GAIN_BIZ_DIV_CD=20');
});

test('P20 · P40 도 청구서(일반), 지재권(P10 + REQ_GBN)은 rexpe_0076_01 고정 메뉴', () => {
  assert.strictEqual(req(R.slipLink(Object.assign({}, general, { procTypCd: 'P20' }))).open, 'rexpe_0084_01.act');
  assert.strictEqual(req(R.slipLink(Object.assign({}, general, { procTypCd: 'P40' }))).open, 'rexpe_0084_01.act');
  const ip = req(R.slipLink(Object.assign({}, general, { reqGbn: true })));
  assert.strictEqual(ip.open, 'rexpe_0076_01.act'); assert.strictEqual(ip.menuId, 'menu_id_564'); assert.strictEqual(ip.title, '지재권청구');
});

test('카드청구(P11): 첨부 청구건수가 있으면 청구서(카드), 0 이면 청구서작성(미전송건)', () => {
  const sent = req(R.slipLink(Object.assign({}, general, { procTypCd: 'P11', cardSent: true })));
  assert.strictEqual(sent.open, 'rexpe_0083_01.act'); assert.strictEqual(sent.menuName, '카드청구'); assert.strictEqual(sent.title, '청구서(카드)');
  const unknown = req(R.slipLink(Object.assign({}, general, { procTypCd: 'P11', cardSent: null })));   // 확인 못 함 → 청구서(카드)
  assert.strictEqual(unknown.open, 'rexpe_0083_01.act');
  const none = req(R.slipLink(Object.assign({}, general, { procTypCd: 'P11', cardSent: false })));
  assert.strictEqual(none.open, 'rexpe_0002_02.act'); assert.strictEqual(none.menuId, 'menu_id_365');
});

test('대량(P12~P15)은 PROC_TYP_CD 를 덧붙이고, 나머지 지출 결의서는 ERP 고정 메뉴 ID', () => {
  const bulk = req(R.slipLink(Object.assign({}, general, { procTypCd: 'P13' })));
  assert.strictEqual(bulk.open, 'rexpe_0003_01.act'); assert.strictEqual(bulk.menuId, 'menu_id_95');
  assert.ok(bulk.q.endsWith('&PROC_TYP_CD=P13'), bulk.q);
  const want = { P21: ['rexpe_0004_01.act', 'menu_id_96'], P22: ['rexpe_0005_01.act', 'menu_id_97'], P23: ['rexpe_0006_01.act', 'menu_id_98'], P24: ['rexpe_0007_03.act', 'menu_id_99'], P31: ['rexpe_0036_01.act', 'menu_id_390'], P33: ['rexpe_0131_01.act', 'menu_id_894'], P34: ['rexpe_0180_01.act', 'menu_id_1386'] };
  for (const [cd, [open, menuId]] of Object.entries(want)) {
    const r = req(R.slipLink(Object.assign({}, general, { procTypCd: cd })));
    assert.strictEqual(r.open, open, cd); assert.strictEqual(r.menuId, menuId, cd); assert.ok(!r.q.includes('PROC_TYP_CD'), cd);
  }
});

test('지출 결의서가 아닌 업무구분·빈 행은 미신청내역조회로', () => {
  assert.strictEqual(R.slipScreen({ procTypCd: 'P99' }), null);
  assert.strictEqual(req(R.slipLink({ procTypCd: 'P99' })).open, 'rappr_0017_01.act');
  assert.strictEqual(req(R.slipLink({})).open, 'rappr_0017_01.act');
});

test('빈 값은 빈 문자열로, 특수문자는 인코딩', () => {
  const r = req(R.slipLink({ procTypCd: 'P10', prjNo: 'A&B', reqCnt: '7' }));
  assert.strictEqual(r.q, 'PRJ_NO=A%26B&REQ_CNT=7&APPR_DIV_CD=30&CFRC_OUT_ATTNTS_MARK_YN=&CFRC_LIMITED_YN=&CFRC_LIMITED_AMT=&PRJ_GAIN_BIZ_DIV_CD=');
});

test('supplementLink: 1건이면 그 결의서(툴팁에 과제명·결재의견), 여러 건·0건·없음이면 미신청내역조회', () => {
  const one = R.supplementLink({ supplements: { items: [general] } });
  assert.strictEqual(req(one.href).open, 'rexpe_0084_01.act');
  assert.ok(one.title.includes('청구서(일반)') && one.title.includes('교통비 수정'), one.title);
  const two = R.supplementLink({ supplements: { items: [general, Object.assign({}, general, { reqCnt: '34' })] } });
  assert.strictEqual(req(two.href).open, 'rappr_0017_01.act'); assert.ok(two.title.includes('2건'), two.title);
  assert.strictEqual(req(R.supplementLink({ supplements: { items: [] } }).href).open, 'rappr_0017_01.act');
  assert.strictEqual(req(R.supplementLink({}).href).open, 'rappr_0017_01.act');
  assert.strictEqual(req(R.supplementLink(null).href).open, 'rappr_0017_01.act');
});

console.log(`\n${n} passed, ${failed} failed`);
