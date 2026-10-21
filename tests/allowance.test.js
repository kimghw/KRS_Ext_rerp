/* lib/allowance.js (연구수당 계산 탭 — 10-53 국가연구개발과제 연구수당 지급 기준(2024-03-05) 별지 1·2, references/10-53_…md) — 인원 배분표·지급비율표, 합산기여도(a·b·c), 등급 배정(동점 상위등급), 통합·조정, 미지급·연구지원 제외, 상한 알림, 저장 모양, 카드 HTML, 복사 글, Word 문서 모형(docx). 실행: node tests/allowance.test.js */
globalThis.self = globalThis;
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..');
for (const f of ['lib/format.js', 'lib/staff.js', 'lib/collect.js', 'lib/staff-ui.js', 'lib/docx.js', 'lib/allowance.js']) require(path.join(root, f));
const S = KRX_STAFF, U = KRX_STAFF_UI, A = KRX_ALLOW, D = KRX_DOCX;
let n = 0, failed = 0;
const test = (name, fn) => { try { fn(); n++; console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n   ', e.stack || e.message); process.exitCode = 1; } };
const r2 = (x) => Math.round(x * 100) / 100;
const P_ = (id, rate, extra = {}) => Object.assign({ id, name: id.toUpperCase(), role: '참여연구원', rate }, extra);
const byId = (res, id) => res.people.find((p) => p.id === id);

test('표 — 인원 배분(1~40, 41명 이상은 비율), 지급비율 합은 100', () => {
  assert.deepStrictEqual([A.headcountOf(1), A.headcountOf(14), A.headcountOf(40)], [[1, 0, 0, 0, 0], [1, 3, 6, 3, 1], [4, 8, 16, 8, 4]]);
  assert.deepStrictEqual(A.headcountOf(50), [5, 10, 20, 10, 5]);
  for (let k = 1; k <= 40; k++) { assert.strictEqual(A.headcountOf(k).reduce((s, x) => s + x, 0), k, `${k}명 인원 합`); assert.strictEqual(r2(A.shareOf(k).reduce((s, x) => s + x, 0)), 100, `${k}명 지급비율 합`); }
  assert.deepStrictEqual(A.shareOf(14), [15.5, 29.7, 39.2, 13.3, 2.3]);
});
test('합산기여도 — 참여율 환산(a)만 있을 때, 등급 S/A/B, 지급비율 50/30/20 × 집행 가능액', () => {
  const res = A.compute({ pool: 7000000, avail: 6000000, people: [P_('x', 30), P_('y', 20), P_('z', 10)] });
  assert.deepStrictEqual([res.n, res.pool, res.avail], [3, 7000000, 6000000]);
  assert.deepStrictEqual(res.people.map((p) => [r2(p.a), p.b, p.c, r2(p.total), p.gradeLabel, p.ratio, p.amt]), [[50, 0, 0, 15, 'S', 50, 3000000], [33.33, 0, 0, 10, 'A', 30, 1800000], [16.67, 0, 0, 5, 'B', 20, 1200000]]);
  assert.deepStrictEqual([r2(res.sums.a), res.sums.amt, res.left, r2(res.sums.ratio)], [100, 6000000, 0, 100]);
  const w = A.checks(res);
  assert.ok(w.some((x) => x.level === 'info' && x.text.startsWith('성과 항목을 아직 적지 않아')) && w.some((x) => x.text.startsWith('기타(연구수행 성실성)를 고르지 않은 사람 3명')));
});
test('성과 항목(등급 점수 × 건수 × 가중치)과 기타가 들어간 합산기여도', () => {
  const res = A.compute({ pool: 1000000, people: [P_('x', 50, { items: [{ name: '논문(SCI(E))', level: '가', count: 1, weight: 0.8 }, { name: '최종보고서 작성', level: '가', count: 1, weight: 0.6 }], etc: 100 }), P_('y', 50, { items: [{ name: '진도보고서 작성', level: '다', count: 2, weight: 1 }], etc: 50 })] });
  const x = byId(res, 'x'), y = byId(res, 'y');
  assert.deepStrictEqual([x.contrib, y.contrib, res.contribSum], [70, 20, 90]);
  assert.deepStrictEqual([r2(x.a), r2(x.b), r2(x.c), r2(x.total)], [50, 77.78, 66.67, r2(15 + 700 / 9 * 0.6 + 200 / 3 * 0.1)]);
  assert.deepStrictEqual([r2(y.b), r2(y.c), r2(y.total)], [22.22, 33.33, r2(15 + 200 / 9 * 0.6 + 100 / 3 * 0.1)]);
  assert.deepStrictEqual([x.gradeLabel, y.gradeLabel, x.ratio, y.ratio], ['S', 'A', 60, 40]);
});
test('동점 — 상위등급으로 올리고 하위등급 1인 몫을 합쳐 N분, 비운 등급은 0명', () => {
  const res = A.compute({ pool: 1000000, people: [P_('x', 60), P_('y', 20), P_('z', 20), P_('w', 5)] });   // 4명: S1 A1 B1 C1 · 40/30/20/10
  assert.deepStrictEqual(res.people.map((p) => [p.gradeLabel, r2(p.ratio), p.tie]), [['S', 40, false], ['A', 25, true], ['A', 25, true], ['C', 10, false]], 'y·z 동점 → 둘 다 A, A 몫 30 + B 1인 20 = 50 을 둘로');
  assert.deepStrictEqual(res.groups.map((g) => [g.label, g.members.length, r2(g.share)]), [['S', 1, 40], ['A', 2, 50], ['B', 0, 0], ['C', 1, 10], ['D', 0, 0]]);
  assert.strictEqual(res.sums.amt, 1000000);
  assert.ok(A.checks(res).some((x) => x.level === 'info' && x.text.startsWith('합산기여도 동점: Y, Z')));
});
test('통합(S+A · C+D, 5명 이상)과 등급간 조정(제로섬 ±10%p · 최소 3%)', () => {
  const five = [P_('a', 50), P_('b', 40), P_('c', 30), P_('d', 20), P_('e', 10)];   // 5명: 38.8/26.2/17.5/11.7/5.8
  const m = A.compute({ pool: 1000000, merge: { sa: true, cd: true }, people: five });
  assert.deepStrictEqual(m.groups.map((g) => [g.label, g.members.length, r2(g.share), r2(g.perHead)]), [['S+A', 2, 65, 32.5], ['B', 1, 17.5, 17.5], ['C+D', 2, 17.5, 8.75]]);
  assert.deepStrictEqual(m.people.map((p) => p.gradeLabel), ['S+A', 'S+A', 'B', 'C+D', 'C+D']);
  const adj = A.compute({ pool: 1000000, adjust: { S: 5, D: -5 }, people: five });
  assert.deepStrictEqual(adj.groups.map((g) => r2(g.share)), [43.8, 26.2, 17.5, 11.7, 0.8]);
  const w = A.checks(adj);
  assert.ok(w.some((x) => x.text === 'D 등급 몫 0.8% — 등급별 최소 3% 이상이어야 합니다.') && !w.some((x) => x.text.includes('제로섬')), '최소 3% 알림, 제로섬은 맞음');
  const bad = A.checks(A.compute({ pool: 1000000, adjust: { S: 12, A: -4 }, people: five }));
  assert.ok(bad.some((x) => x.text.startsWith('등급간 조정의 합이 8%p')) && bad.some((x) => x.text.startsWith('S 등급 조정 12%p')));
  const up = A.checks(A.compute({ pool: 1000000, adjust: { A: -20, B: 20 }, people: five }));
  assert.ok(up.some((x) => x.text.startsWith('B 등급 1인 지급비율 37.5% 가 A 등급 6.2% 보다 큽니다')), '하위등급 1인 > 상위등급 1인');
});
test('대상 제외 — 연구지원(행정) · 미지급 · 참여율 0, 남은 연구수당 상한 알림, 41명 알림', () => {
  const res = A.compute({ pool: 3000000, people: [P_('x', 30, { cap: 1000000, capSrc: 'HR' }), P_('j', 10, { role: '행정지원' }), P_('o', 10, { out: true, note: '휴직' }), P_('z', 0)] });
  assert.deepStrictEqual(res.people.map((p) => [p.target, p.reason, p.gradeLabel, p.amt]), [[true, '', 'S', 3000000], [false, '연구지원(행정)', '', 0], [false, '휴직', '', 0], [false, '참여 없음', '', 0]]);
  const w = A.checks(res);
  assert.ok(w.some((x) => x.level === 'warn' && x.text.startsWith('X: 지급액 3,000천원이 남은 연구수당 1,000천원(HR)을 넘습니다')));
  assert.ok(w.some((x) => x.text === '연구지원(행정) 1명은 연구수당 대상이 아니어서 뺐습니다.') && w.some((x) => x.text.startsWith('미지급 2명: O(휴직), Z(참여 없음)')));
  const many = A.compute({ pool: 1000000, people: Array.from({ length: 41 }, (_, i) => P_('p' + i, 41 - i)) });
  assert.ok(many.overflow && A.checks(many).some((x) => x.text.startsWith('참여 연구원 41명')) && many.groups.map((g) => g.members.length).join() === '4,8,17,8,4');
  assert.strictEqual(A.checks(A.compute({ pool: 0, people: [] })).map((x) => x.level).join(), 'error,error');
});
test('저장 모양 — 사람 칸은 적은 것만, 항목은 30개까지, 통합·조정은 켜진 것만', () => {
  const v = A.normalize({ '2026-0063-01@1': { pool: '6,000,000', avail: 5000000, org: ' 한국선급 ', merge: { sa: true, cd: false }, adjust: { S: 5, A: 0, D: -5 }, people: { k: { dept: '연구본부', grade: 'P2', etc: '75', items: [{ name: '논문(SCI(E))', level: '가', count: 1, weight: 0.8 }, { level: '엉' }], note: '', out: false }, m: { out: true, note: '휴직' }, e: {} }, at: 5 }, '': {} });
  assert.deepStrictEqual(v, { '2026-0063-01@1': { people: { k: { dept: '연구본부', grade: 'P2', etc: 75, items: [{ name: '논문(SCI(E))', level: '가', count: 1, weight: 0.8 }, { name: '', level: '가', count: 1, weight: 1 }] }, m: { note: '휴직', out: true } }, at: 5, pool: 6000000, avail: 5000000, org: '한국선급', merge: { sa: true, cd: false }, adjust: { S: 5, D: -5 } } });
});

/* 카드 — 계획의 사람(personStats)과 예산 줄로 */
const P = { prjNo: '2026-0063-01', prjNm: 'MW급 10kV 고전압 직류 시스템용 반도체 차단기 개발', rspr: '김거화', anl: '1', stDt: '20260401', endDt: '20261231', budget: { items: [{ exp: '인건비', bgt: 35900000, appr: 0, req: 0 }, { exp: '연구수당', bgt: 6000000, appr: 1000000, req: 0 }] } };
const months = S.ymRange('2026-04', '2026-12');
const plan = { prjNo: P.prjNo, year: 1, from: '2026-04', to: '2026-12', basis: 'rerp', people: [
  { id: 'k', name: '김거화', role: '과제책임자', erp: { monthly: 8480000 }, plan: months.map((m) => ({ ym: m, amt: 2186000 })), cuts: [] },
  { id: 'm', name: '문창재', role: '참여연구원', erp: { monthly: 5823000 }, plan: months.map((m) => ({ ym: m, amt: 805000 })), cuts: [], allowance: 1500000 },
  { id: 'j', name: '조주희', role: '행정지원', plan: [], cuts: [] }] };
const mk = (over = {}) => Object.assign({ staffPlans: { [S.planKey(P.prjNo, 1)]: plan }, staffRows: {}, staffView: { years: {}, extra: {}, inc: { unbilled: true, plan: true }, fold: {} }, research: {}, plans: {}, allowCalc: {}, staffWho: '김거화' }, over);
test('카드 — 일반 정보(계상금액 · 집행 가능액 = 계상 − 집행 · 기간 · 인건비), 별지 1 표(항목 입력 · 기타 · 등급), 별지 2 표(통합은 5명부터 · 미지급), 내 직급은 HR 에서', () => {
  const st = mk();
  const br = U.budgetRows(P, plan, 1, st);
  const c = A.ctxOf(P, plan, 1, br, st, { me: '김거화', hr: { grade: 'P2', remain: 2500000 } });
  assert.deepStrictEqual([c.pool, c.avail, c.period, c.payTotal, c.org, c.res.n], [6000000, 5000000, '2026-04 ~ 2026-12', 35900000, '한국선급', 2]);
  const k = byId(c.res, 'k'), m = byId(c.res, 'm');
  assert.deepStrictEqual([k.grade, k.cap, k.capSrc, m.grade, m.cap, m.capSrc], ['P2', 2500000, 'HR', '', 1500000, '응답'], '내 직급·HR 잔여, 응답 잔여');
  assert.deepStrictEqual([k.gradeLabel, m.gradeLabel, k.ratio, m.ratio, k.amt, m.amt], ['S', 'A', 60, 40, 3000000, 2000000]);
  const html = A.card(P, plan, 1, br, st, { me: '김거화', hr: { grade: 'P2', remain: 2500000 } });
  assert.ok(html.includes('data-alkey="2026-0063-01@1"') && html.includes('2명 · 집행 가능액 5,000천원') && html.includes('data-al="pool" value="6,000"') && html.includes('data-al="avail" value="5,000"') && html.includes('<dd>2026-04 ~ 2026-12</dd>') && html.includes('35,900천원</dd>'), '일반 정보');
  assert.ok(html.includes('data-alp="grade" data-i="k" value="P2"') && html.includes('data-act="al-item-add" data-i="k"') && html.includes('<datalist id="krext-al-items">') && html.includes('data-alp="etc" data-i="m"') && html.includes('<b>S</b>') && html.includes('<b>A</b>'), '별지 1');
  assert.ok(html.includes('data-al="merge-sa" disabled') && html.includes('data-alp="out" data-i="m"') && html.includes('<strong>3,000,000</strong>') && html.includes('S 60% (1명 · 1인 60.00%)'), '별지 2 — 5명 미만이라 통합 꺼짐(2명: S 60 · A 40)');
  assert.ok(!html.includes('krext-al-row krext-al-off') && !html.includes('조주희'), '행정지원은 표에 없음');
  assert.ok(html.includes('data-act="al-docx"') && html.includes('>DOCX 내려받기</button>') && html.includes('data-act="al-reset" title="이 과제 1차년도 의 일반 정보·성과 항목·기타·등급 조정·미지급을 지우고 기본값으로" disabled'));
  assert.ok(A.checks(c.res).some((x) => x.text.startsWith('김거화: 지급액 3,000천원이 남은 연구수당 2,500천원(HR)을 넘습니다')) && A.checks(c.res).some((x) => x.text.startsWith('문창재: 지급액 2,000천원이 남은 연구수당 1,500천원(응답)')));
  // 저장된 항목·기타·미지급·직접 금액이 칸에
  const st2 = mk({ allowCalc: { [S.planKey(P.prjNo, 1)]: { pool: 4000000, org: 'KR', people: { k: { dept: '연구본부', items: [{ name: '연구총괄 및 관리', level: '가', count: 1, weight: 1 }], etc: 100 }, m: { out: true, note: '휴직' } }, at: 1 } } });
  const c2 = A.ctxOf(P, plan, 1, U.budgetRows(P, plan, 1, st2), st2, { me: '김거화', hr: null });
  assert.deepStrictEqual([c2.pool, c2.avail, c2.org, c2.res.n, byId(c2.res, 'k').amt, byId(c2.res, 'm').reason], [4000000, 5000000, 'KR', 1, 5000000, '휴직'], '계상 직접 4,000 이어도 집행 가능액은 예산 줄 잔액 5,000(직접 적지 않음)');
  const html2 = A.card(P, plan, 1, U.budgetRows(P, plan, 1, st2), st2, {});
  assert.ok(html2.includes('data-ali="name" data-i="k" data-k="0" value="연구총괄 및 관리"') && html2.includes('<option value="100" selected>우수 100</option>') && html2.includes('data-alp="out" data-i="m" checked') && html2.includes('placeholder="미지급 사유"') && html2.includes('data-al="org" value="KR"'));
});
test('카드 — 계획이 없으면 일반 정보와 안내만; section(only:allow) 은 제목·연차 칩·카드·안내', () => {
  const st = mk({ staffPlans: {} });
  const html = A.card(P, null, 1, U.budgetRows(P, null, 1, st), st, {});
  assert.ok(html.includes('0명 · 집행 가능액 5,000천원') && html.includes('1차년도 참여연구원 계획이 아직 없습니다') && !html.includes('krext-al-t1') && html.includes('disabled>DOCX 내려받기'));
  const sec = U.section({ projects: [P] }, {}, st, '<span class="krext-page-title">연구수당 계산</span>', { only: 'allow' });
  assert.ok(sec.includes('krext-page-title">연구수당 계산') && sec.includes('data-act="st-year" data-year="1"') && sec.includes('data-alkey="2026-0063-01@1"') && !sec.includes('data-act="st-agent"') && !sec.includes('data-card="staff"') && sec.includes('별지 1·2 를 그대로 셈합니다'));
});
test('복사 글과 Word 문서 모형 — 별지 1 표(항목 줄 · 계)와 별지 2 표, docx 로 만들어짐', () => {
  const st = mk({ allowCalc: { [S.planKey(P.prjNo, 1)]: { people: { k: { dept: '연구본부', grade: 'P2', items: [{ name: '연구총괄 및 관리', level: '가', count: 1, weight: 1 }, { name: '논문(SCI(E))', level: '가', count: 1, weight: 0.8 }], etc: 100 }, m: { grade: 'P1', etc: 75 } }, at: 1 } } });
  const c = A.ctxOf(P, plan, 1, U.budgetRows(P, plan, 1, st), st, {});
  const t = A.tsv(c).split('\n');
  assert.ok(t[0].startsWith('[별지 1] 연구수행 기여도 평가서\tMW급') && t[1].startsWith('부서명\t성명\t직급\t참여율(%)') && t[2].startsWith('연구본부\t김거화\tP2\t') && t[3].startsWith('연구본부\t\t\t\t\t논문(SCI(E))\t가\t1\t0.8\t40\t') && t[5].startsWith('계\t\t\t\t100'), t.slice(0, 6).join('\n'));
  assert.ok(t.some((l) => l.startsWith('[별지 2] 연구수당 지급 내역서')) && t[t.length - 1].startsWith('계\t\t\t\t\t\t100\t5,000,000'), t[t.length - 1]);
  const doc = A.docOf(c);
  const tables = doc.blocks.filter((b) => b.type === 'table');
  assert.strictEqual(tables.length, 4, '별지 1 일반·평가, 별지 2 일반·지급');
  assert.deepStrictEqual([tables[1].rows.length, tables[1].widths.length, tables[3].rows.length], [2 + 3 + 1, 15, 1 + 2 + 1], '평가 표: 머리 2 + 김거화 항목 2줄 + 문창재 1줄 + 계');
  assert.ok(tables[1].rows[2][1].rowSpan === 2 && tables[1].rows[3][1].skip && tables[1].rows[2][5].text === '연구총괄 및 관리' && tables[3].rows[1][7].text === '3,000,000');
  assert.strictEqual(A.fileName(c), '연구수당_2026-0063-01_1차년도.docx');
  const bytes = D.build(doc);
  const ents = D.entries(bytes);
  assert.ok(ents.every((e) => e.ok) && ents.some((e) => e.name === 'word/document.xml'));
  const xml = ents.find((e) => e.name === 'word/document.xml').data;
  assert.ok(xml.includes('>연구수행 기여도 평가서</w:t>') && xml.includes('>김거화</w:t>') && xml.includes('<w:br w:type="page"/>') && xml.includes('>연구수당 지급 내역서</w:t>') && xml.includes('<w:vMerge w:val="restart"/>'));
  const dir = process.env.KRX_TEST_OUT; if (dir) require('fs').writeFileSync(path.join(dir, A.fileName(c)), bytes);   // 바깥 검사(XSD · Word)용
});

console.log(`\n${n} passed, ${failed} failed`);
