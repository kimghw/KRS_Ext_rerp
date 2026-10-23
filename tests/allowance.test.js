/* lib/allowance.js (연구수당 계산 탭 — 10-53 국가연구개발과제 연구수당 지급 기준(2024-03-05) 별지 1·2, references/10-53_…md) — 인원 배분표·지급비율표, 합산기여도(a·b·c), 등급 배정(동점 상위등급), 통합·조정, 미지급·연구지원 제외, 상한 알림, 저장 모양, 카드 HTML, 복사 글, Word 문서 모형(docx). 실행: node tests/allowance.test.js */
globalThis.self = globalThis;
globalThis.CSS = globalThis.CSS || { escape: (s) => String(s) };   // bind 의 querySelector 가 씀(DOM 없음)
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
const REQUIRED = [['연구총괄 및 관리', '가'], ['진도보고서 작성', '다'], ['연구내용 사전조사', '다']];   // 2026-10-22 부터 3개 (그 전 연구계획서·최종보고서까지 5개)
const requiredNames = REQUIRED.map(([name]) => name);
const requiredRows = (weight = 0.5) => REQUIRED.map(([name, level]) => ({ name, level, count: 1, weight, auto: true }));
const requiredText = (weight = 0.5) => requiredNames.map((name) => `${name}*/${weight}`);
const pickButton = (html, name) => (html.match(/<button\b[^>]*>/g) || []).find((tag) => tag.includes('data-act="al-pick"') && tag.includes(`data-nm="${name}"`)) || '';
const scopeSelect = (html, name) => (html.match(/<select\b[^>]*>[\s\S]*?<\/select>/g) || []).find((tag) => tag.includes(`data-alscope="${name}"`)) || '';

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
test('저장 모양 — 사람 칸은 적은 것만, 항목은 30개까지(저장 — 보이는 개인 항목 추가는 MAX_ITEMS 4개까지), 통합·조정은 켜진 것만', () => {
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
  assert.ok(html.includes('data-alp="grade" data-i="k" value="P2"') && html.includes('data-aladd="k"') && html.includes('<optgroup label="가 (50점)">') && html.includes('<option value="나|">기타(직접 입력)</option>') && REQUIRED.every(([name, level]) => !html.includes(`<option value="${level}|${name}">`)) && html.includes('data-alp="etc" data-i="m"') && html.includes('<b>S</b>') && html.includes('<b>A</b>'), '별지 1 — 선택 상자(가·나·다 묶음, 포함된 필수 5개는 옵션에 없음)');
  for (const [i, [name]] of REQUIRED.entries()) {
    assert.ok(html.includes(`data-ali="name" data-i="k" data-k="${i}" value="${name}"`) && html.includes(`data-ali="weight" data-i="k" data-k="${i}" value="0.5"`) && !html.includes(`data-act="al-item-del" data-i="k" data-k="${i}"`), `${name}: 필수 자동 줄 · 가중치 1/2 · 삭제 없음`);
  }
  assert.ok(!html.includes('class="krext-al-req" title=') && html.includes('<span class="krext-al-req" aria-hidden="true"></span>') && !html.includes('>가 50</option>') && html.includes('<option value="가" selected>가</option>') && !html.includes('성과 기여도 <span>60%') && !html.includes('기타 평가 <span>10%') && html.includes('</div><div class="krext-al-subhead" aria-hidden="true">기타 평가</div><div class="krext-al-eval-other"><label><span class="krext-al-caption">협력·소통·적극성</span><select') && html.includes('<span class="krext-al-eval-c" title="기타 평가 환산비율"><span class="krext-al-caption">환산비율 (c)</span><b>') && !html.includes('data-act="al-classify"'), '필수·포함 글자 없음(자리만) · 등급은 가·나·다만 · 성과 기여도/기타 평가 10% 머리글 없음 · 기타 평가는 항목 표 아래 두 칸(2026-10-21)');
  assert.strictEqual(A.MAX_ITEMS, 4);
  const full = mk({ allowCalc: { [S.planKey(P.prjNo, 1)]: { people: { k: { items: [1, 2, 3, 4].map((n) => ({ name: `개인 ${n}`, level: '가', count: 1, weight: 1 })) } }, at: 1 } } });
  const htmlFull = A.card(P, plan, 1, U.budgetRows(P, plan, 1, full), full, {});
  assert.ok(/data-aladd="k"[^>]* disabled>/.test(htmlFull) && !/data-aladd="m"[^>]* disabled>/.test(htmlFull), '개인 항목이 4개면 ＋ 항목 추가가 꺼짐(포함 항목은 세지 않음)');
  assert.ok(html.includes('data-al="merge-sa" disabled') && html.includes('data-alp="out" data-i="m"') && html.includes('<strong>3,000,000</strong>') && html.includes('S 60% (1명 · 1인 60.00%)'), '별지 2 — 5명 미만이라 통합 꺼짐(2명: S 60 · A 40)');
  assert.ok(!html.includes('krext-al-row krext-al-off') && !html.includes('조주희'), '행정지원은 표에 없음');
  assert.ok(html.includes('data-act="al-docx"') && html.includes('>DOCX 내려받기</button>') && html.includes('data-act="al-reset" title="이 과제 1차년도 의 일반 정보·성과 항목·기타·등급 배정·조정·부서별·미지급을 지우고 기본값으로" disabled'));
  assert.ok(A.checks(c.res).some((x) => x.text.startsWith('김거화: 지급액 3,000천원이 남은 연구수당 2,500천원(HR)을 넘습니다')) && A.checks(c.res).some((x) => x.text.startsWith('문창재: 지급액 2,000천원이 남은 연구수당 1,500천원(응답)')));
  // 저장된 항목·기타·미지급·직접 금액이 칸에
  const st2 = mk({ allowCalc: { [S.planKey(P.prjNo, 1)]: { pool: 4000000, org: 'KR', people: { k: { dept: '연구본부', items: [{ name: '연구총괄 및 관리', level: '가', count: 1, weight: 1 }], etc: 100 }, m: { out: true, note: '휴직' } }, at: 1 } } });
  const c2 = A.ctxOf(P, plan, 1, U.budgetRows(P, plan, 1, st2), st2, { me: '김거화', hr: null });
  assert.deepStrictEqual([c2.pool, c2.avail, c2.org, c2.res.n, byId(c2.res, 'k').amt, byId(c2.res, 'm').reason], [4000000, 5000000, 'KR', 1, 5000000, '휴직'], '계상 직접 4,000 이어도 집행 가능액은 예산 줄 잔액 5,000(직접 적지 않음)');
  const html2 = A.card(P, plan, 1, U.budgetRows(P, plan, 1, st2), st2, {});
  assert.ok(html2.includes('data-ali="name" data-i="k" data-k="0" value="연구총괄 및 관리"') && !html2.includes('data-act="al-item-del" data-i="k" data-k="0"') && html2.includes('<option value="100" selected>우수 100</option>') && html2.includes('data-alp="out" data-i="m" checked') && html2.includes('placeholder="미지급 사유"') && html2.includes('data-al="org" value="KR"'));
});
test('부서명·직급 기본값 — rERP 참여인력(state.allowErp[과제].members, 이름키): 저장값이 우선 · 내 직급도 rERP 먼저, 없으면 HR · 조회 중/실패 표시', () => {
  const erp = { at: 1, busy: false, members: { '김거화': { dept: '자율운항연구팀', pos: 'P2' }, '문창재': { dept: '디지털연구팀', pos: 'P3' } }, error: '' };
  const st = mk({ allowErp: { [P.prjNo]: erp }, allowCalc: { [S.planKey(P.prjNo, 1)]: { people: { m: { grade: 'G1' } }, at: 1 } } });
  const br = U.budgetRows(P, plan, 1, st);
  const c = A.ctxOf(P, plan, 1, br, st, { me: '김거화', hr: { grade: 'P4', remain: 0 } });
  const k = byId(c.res, 'k'), m = byId(c.res, 'm');
  assert.deepStrictEqual([k.dept, k.grade, m.dept, m.grade, c.erp], ['자율운항연구팀', 'P2', '디지털연구팀', 'G1', erp], 'rERP 기본값, 저장된 직급 우선, 내 직급도 rERP 먼저');
  const html = A.card(P, plan, 1, br, st, { me: '김거화', hr: null });
  assert.ok(html.includes('data-alp="dept" data-i="k" value="자율운항연구팀"') && html.includes('data-alp="grade" data-i="k" value="P2"') && html.includes('data-alp="grade" data-i="m" value="G1"') && !html.includes('rERP 참여인력 조회 중') && !html.includes('못 받음'), '칸에 기본값');
  assert.strictEqual(A.inputOf({ basis: 'rerp', people: plan.people }, {}, { me: '김거화', hr: { grade: 'P4' }, erp: { '김거화': { pos: 'P1' } } })[0].grade, 'P1', 'opts.erp 를 직접 주면 그것');
  assert.deepStrictEqual(A.inputOf({ basis: 'rerp', people: plan.people }, {}, { me: '김거화', hr: { grade: 'P4' } }).map((x) => [x.dept, x.grade]), [['', 'P4'], ['', ''], ['', '']], 'rERP 가 없으면 내 직급만 HR');
  const busy = A.card(P, plan, 1, br, mk({ allowErp: { [P.prjNo]: { at: 1, busy: true, members: {}, error: '' } } }), {});
  assert.ok(busy.includes('rERP 참여인력 조회 중…</small>') && busy.includes('data-alp="dept" data-i="k" value=""'), '조회 중');
  const bad = A.card(P, plan, 1, br, mk({ allowErp: { [P.prjNo]: { at: 1, busy: false, members: {}, error: 'R&D ERP 로그인이 필요합니다' } } }), {});
  assert.ok(bad.includes('부서명·직급을 rERP 참여인력에서 못 받음') && bad.includes('title="R&amp;D ERP 로그인이 필요합니다"'), '실패 표시');
  assert.ok(!('allowErp' in mk()) && A.card(P, plan, 1, br, mk(), {}).includes('data-alp="dept" data-i="k" value=""'), 'chrome 이 없으면(테스트) 조회하지 않음');
  assert.deepStrictEqual(A.erpMapOf([{ name: '김 거화', dept: '(사)한국선급 수소전기추진연구팀', pos: 'P2' }, { name: '김거화', dept: '다른팀', pos: 'P9' }, { name: '이은주', dept: '자율운항연구팀', pos: 'P3', src: 'hr' }, { name: '' }]), { '김거화': { dept: '수소전기추진연구팀', pos: 'P2' }, '이은주': { dept: '자율운항연구팀', pos: 'P3' } }, '이름키 · 먼저 온 사람 · 기관 머리 뗌');
});
test('카드 — 계획이 없으면 일반 정보와 안내만; section(only:allow) 은 제목·연차 칩·카드·안내', () => {
  const st = mk({ staffPlans: {} });
  const html = A.card(P, null, 1, U.budgetRows(P, null, 1, st), st, {});
  assert.ok(html.includes('0명 · 집행 가능액 5,000천원') && html.includes('1차년도 참여연구원 계획이 아직 없습니다') && !html.includes('krext-al-t1') && html.includes('disabled>DOCX 내려받기'));
  const sec = U.section({ projects: [P] }, {}, st, '<span class="krext-page-title">연구수당 계산</span>', { only: 'allow' });
  assert.ok(sec.includes('krext-page-title">연구수당 계산') && sec.includes('data-act="st-year" data-year="1"') && sec.includes('data-alkey="2026-0063-01@1"') && sec.includes('data-act="st-agent"') && sec.includes('연구수당 도우미(채팅) 열기') && !sec.includes('data-card="staff"') && sec.includes('별지 1·2 를 그대로 셈합니다'));
});
test('카드 — 계획이 없어도 rERP 등록 지급계획(이 기간)을 조회해 두었으면 그 참여율로 셈한다(사람 id erp:이름키 · staff.erpOnly · 안내 한 줄 · 별지와 DOCX 켜짐); 조회 전에는 전처럼 안내만', () => {
  const REC = [
    { EMP_NM: '문창재', ROLE_NM: '참여연구원', PAY_LIMT_AMT: '5823000', PAY_AMT: '1165000', PART_RT: '20.01', PLAN_YM_FROM: '202604', PLAN_YM_TO: '202611', NCNT: '8', REQ_CNT: '9', SEQ_NO: '2' },
    { EMP_NM: '문창재', ROLE_NM: '참여연구원', PAY_LIMT_AMT: '5823000', PAY_AMT: '1159000', PART_RT: '19.91', PLAN_YM_FROM: '202612', PLAN_YM_TO: '202612', NCNT: '1', REQ_CNT: '9', SEQ_NO: '2' },
    { EMP_NM: '김거화', ROLE_NM: '과제책임자', PAY_LIMT_AMT: '8480000', PAY_AMT: '2328000', PART_RT: '27.46', PLAN_YM_FROM: '202604', PLAN_YM_TO: '202611', NCNT: '8', REQ_CNT: '9', SEQ_NO: '1' },
    { EMP_NM: '김거화', ROLE_NM: '과제책임자', PAY_LIMT_AMT: '8480000', PAY_AMT: '2322000', PART_RT: '27.39', PLAN_YM_FROM: '202612', PLAN_YM_TO: '202612', NCNT: '1', REQ_CNT: '9', SEQ_NO: '1' },
  ];
  const st = mk({ staffPlans: {}, staffRows: { [P.prjNo]: { at: 1, rows: S.rowsOfErp(REC), others: {} } } });
  const br = U.budgetRows(P, null, 1, st);
  const c = A.ctxOf(P, null, 1, br, st, { me: '김거화', hr: null });
  assert.ok(c.staff && c.staff.erpOnly === true && c.erpOnly === true && c.staff.basis === 'rerp', 'rERP 등록 지급계획으로 대체');
  assert.deepStrictEqual(c.res.people.map((x) => [x.id, x.name, x.target, x.rate > 0]).sort((a, b) => a[0].localeCompare(b[0])), [['erp:김거화', '김거화', true, true], ['erp:문창재', '문창재', true, true]], '이름키 id · 지급 대상 둘');
  assert.strictEqual(c.res.n, 2);
  const html = A.card(P, null, 1, br, st, { me: '김거화', hr: null });
  assert.ok(html.includes('2명 · 집행 가능액 5,000천원') && html.includes('1차년도 참여연구원 계획이 아직 없어 rERP 등록 지급계획의 참여율로 셈합니다') && html.includes('krext-al-t1') && !html.includes('disabled>DOCX 내려받기') && !html.includes('참여연구원 계획이 아직 없습니다 — <b>참여연구원 변경</b>') && html.includes('data-alp="dept" data-i="erp:김거화"'), '안내 한 줄 · 별지 1 · DOCX 단추 켜짐 · 칸의 id 는 erp:이름키');
  const st0 = mk({ staffPlans: {} });
  const none = A.card(P, null, 1, U.budgetRows(P, null, 1, st0), st0, {});
  assert.ok(none.includes('0명 · 집행 가능액 5,000천원') && none.includes('1차년도 참여연구원 계획이 아직 없습니다') && none.includes('disabled>DOCX 내려받기') && !none.includes('krext-al-t1') && !none.includes('krext-al-erponly'), '계획도 rERP 조회도 없으면 전처럼 안내만');
});
test('복사 글과 Word 문서 모형 — 별지 1 표(항목 줄 · 계)와 별지 2 표, docx 로 만들어짐', () => {
  const st = mk({ allowCalc: { [S.planKey(P.prjNo, 1)]: { people: { k: { dept: '연구본부', grade: 'P2', items: [{ name: '연구총괄 및 관리', level: '가', count: 1, weight: 1 }, { name: '논문(SCI(E))', level: '가', count: 1, weight: 0.8 }], etc: 100 }, m: { grade: 'P1', etc: 75 } }, at: 1 } } });
  const c = A.ctxOf(P, plan, 1, U.budgetRows(P, plan, 1, st), st, {});
  const t = A.tsv(c).split('\n');
  assert.ok(t[0].startsWith('[별지 1] 연구수행 기여도 평가서\tMW급') && t[1].startsWith('부서명\t성명\t직급\t참여율(%)') && t[2].startsWith('연구본부\t김거화\tP2\t') && t[2].includes('\t연구총괄 및 관리\t가\t1\t0.5\t25\t') && t[5].startsWith('연구본부\t\t\t\t\t논문(SCI(E))\t가\t1\t0.8\t40\t') && t[6].includes('문창재') && t[9].startsWith('계\t\t\t\t100'), t.slice(0, 14).join('\n'));
  assert.deepStrictEqual(t.slice(2, 5).map((line) => line.split('\t').slice(5, 7)), REQUIRED, '문서에 필수 3개를 정해진 순서와 난이도로 표시');
  assert.ok(t.some((l) => l.startsWith('[별지 2] 연구수당 지급 내역서')) && t[t.length - 1].startsWith('계\t\t\t\t\t\t100\t5,000,000'), t[t.length - 1]);
  const doc = A.docOf(c);
  const tables = doc.blocks.filter((b) => b.type === 'table');
  assert.strictEqual(tables.length, 4, '별지 1 일반·평가, 별지 2 일반·지급');
  assert.deepStrictEqual([tables[1].rows.length, tables[1].widths.length, tables[3].rows.length], [2 + 4 + 3 + 1, 15, 1 + 2 + 1], '평가 표: 머리 2 + 김거화 항목 4줄(필수 3 + 논문) + 문창재 3줄(필수) + 계');
  assert.ok(tables[1].rows[2][1].rowSpan === 4 && tables[1].rows[3][1].skip && tables[1].rows[2][5].text === '연구총괄 및 관리' && tables[1].rows[4][5].text === '연구내용 사전조사' && tables[3].rows[1][7].text === '3,000,000');
  assert.ok(tables[1].rows[0][11].text === '기타<sup>3)</sup>\n(10%)' && tables[1].rows[9][5].hatch && tables[1].rows[9][5].colSpan === 4 && tables[1].rows[9][14].hatch && tables[3].rows[0][3].text === '기여도<sup>1)</sup>' && tables[3].rows[3][3].hatch && tables[3].rows[3][3].colSpan === 3 && tables[3].rows[3][8].hatch, '양식대로 주석 번호 위첨자 · 계 줄 빗금 칸');
  assert.strictEqual(A.fileName(c), '연구수당_2026-0063-01_1차년도.docx');
  const bytes = D.build(doc);
  const ents = D.entries(bytes);
  assert.ok(ents.every((e) => e.ok) && ents.some((e) => e.name === 'word/document.xml'));
  const xml = ents.find((e) => e.name === 'word/document.xml').data;
  assert.ok(xml.includes('>연구수행 기여도 평가서</w:t>') && xml.includes('>김거화</w:t>') && xml.includes('<w:pageBreakBefore/><w:spacing w:before="0" w:after="60"/></w:pPr><w:r><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t xml:space="preserve">별지 2</w:t>') && (xml.match(/<w:tblHeader\/>/g) || []).length === 5 && xml.includes('>연구수당 지급 내역서</w:t>') && xml.includes('<w:vMerge w:val="restart"/>') && xml.includes('<w:vertAlign w:val="superscript"/></w:rPr><w:t xml:space="preserve">3)</w:t>') && xml.includes('w:val="thinDiagStripe"') && xml.includes('w:orient="landscape"'));
  const dir = process.env.KRX_TEST_OUT; if (dir) require('fs').writeFileSync(path.join(dir, A.fileName(c)), bytes);   // 바깥 검사(XSD · Word)용
});

/* 2026-10-21 밤 사용자 "docx 파일의 테이블이 좀 깨졌는데… 부서별로 하면 부서원 별로 페이지 구분되게 해줘" — Word 에서 한 사람의 병합 줄이 쪽 사이에서 갈라져 이어지는 쪽의 이름·부서 칸이 비어 보이던 것 */
test('부서별이면 Word 문서의 별지 1·2 표가 부서(단위) 차례로 묶이고 둘째 부서부터 첫 칸에 쪽 나눔', () => {
  const st = mk({ allowCalc: { [S.planKey(P.prjNo, 1)]: { byDept: true, people: { k: { dept: '연구본부' }, m: { dept: '자율운항연구팀' } }, at: 1 } } });
  const c = A.ctxOf(P, plan, 1, U.budgetRows(P, plan, 1, st), st, {});
  assert.deepStrictEqual(c.res.depts.map((d) => [d.name, d.people.map((p) => p.name)]), [['연구본부', ['김거화']], ['자율운항연구팀', ['문창재']]]);
  const tables = A.docOf(c).blocks.filter((b) => b.type === 'table');
  const t1 = tables[1].rows, t2 = tables[3].rows;
  assert.deepStrictEqual([t1[2][1].text, t1[2][0].pageBreakBefore, t1[5][1].text, t1[5][0].pageBreakBefore, t1[5][0].rowSpan], ['김거화', undefined, '문창재', true, 3], '별지 1: 둘째 부서 첫 사람의 첫 칸(부서명)만 쪽 나눔');
  assert.deepStrictEqual([t2[1][0].text, t2[1][0].pageBreakBefore, t2[2][0].text, t2[2][0].pageBreakBefore], ['연구본부', undefined, '자율운항연구팀', true], '별지 2 도 같은 차례·쪽 나눔');
  const st2 = mk({ allowCalc: { [S.planKey(P.prjNo, 1)]: { byDept: true, people: { k: { dept: '자율운항연구팀' }, m: { dept: '연구본부', out: true } }, at: 1 } } });   // 미지급(out)은 부서 단위에 없어 맨 뒤 묶음(쪽 나눔)
  const c2 = A.ctxOf(P, plan, 1, U.budgetRows(P, plan, 1, st2), st2, {});
  const r2 = A.docOf(c2).blocks.filter((b) => b.type === 'table')[3].rows;
  assert.deepStrictEqual(r2.slice(1, 3).map((r) => [r[1].text, r[0].pageBreakBefore]), [['김거화', undefined], ['문창재', true]]);
  const c3 = A.ctxOf(P, plan, 1, U.budgetRows(P, plan, 1, mk({ allowCalc: { [S.planKey(P.prjNo, 1)]: { people: { k: { dept: '연구본부' }, m: { dept: '자율운항연구팀' } }, at: 1 } } })), mk(), {});
  assert.ok(!JSON.stringify(A.docOf(c3).blocks).includes('pageBreakBefore'), '부서별이 아니면 계획 차례 그대로, 쪽 나눔 없음');
});

/* 2026-10-21 사용자 "지급내역 바로 아래 SABCD/ 1,2,3,4,5로 할게. 할당해야할 갯수를 인원 배분 기준으로 할당해 주고. 평가 등급을 마우스 드래그로 할 수 있게 해줘" · "부서 별로 그룹핑 … 부서별로 확정" · "수소전기추진.. 이런건 수소 … 동일한게 있으면 3글자 까지 하고 그뒤로는 숫자로" */
test('수동 배정(rank) — 끌어 놓은 등급은 그대로, 넘친 묶음은 빈 묶음의 1인 몫을 가져와 N분, 자동 순서와 다른 사람 알림, rank 없는 새 사람은 남은 자리', () => {
  const res = A.compute({ pool: 1000000, people: [P_('x', 30, { rank: 'S' }), P_('y', 20, { rank: 'S' }), P_('z', 10, { rank: 'B' })] });   // 3명: S1 A1 B1 · 50/30/20
  assert.strictEqual(res.manual, true);
  assert.deepStrictEqual(res.groups.map((g) => [g.label, g.members.length, r2(g.share), r2(g.perHead), g.over]), [['S', 2, 80, 40, 1], ['A', 0, 0, 0, 0], ['B', 1, 20, 20, 0], ['C', 0, 0, 0, 0], ['D', 0, 0, 0, 0]], 'S 에 둘 → 빈 A 의 30 을 S 로');
  assert.deepStrictEqual(res.people.map((p) => [p.gradeLabel, p.autoLabel, r2(p.ratio), p.amt, p.tie]), [['S', 'S', 40, 400000, false], ['S', 'A', 40, 400000, false], ['B', 'B', 20, 200000, false]]);
  const w = A.checks(res).map((x) => x.text);
  assert.ok(w.some((t) => t.startsWith('S 등급 2명 — 인원 배분 기준은 1명')) && w.some((t) => t.startsWith('A 등급 0명 — 인원 배분 기준은 1명')) && w.some((t) => t.startsWith('합산기여도 순(별지 1)과 다른 등급: Y S(순서대로면 A)')), w.join('\n'));
  const nw = A.compute({ pool: 1000000, people: [P_('x', 30, { rank: 'A' }), P_('y', 20), P_('z', 10, { rank: 'B' })] });
  assert.deepStrictEqual(nw.people.map((p) => [p.gradeLabel, r2(p.ratio)]), [['A', 30], ['S', 50], ['B', 20]], 'rank 없는 y 는 남은 자리 S');
  const m = A.compute({ pool: 1000000, merge: { sa: true }, people: [P_('a', 50, { rank: 'D' }), P_('b', 40, { rank: 'A' }), P_('c', 30, { rank: 'S' }), P_('d', 20, { rank: 'B' }), P_('e', 10, { rank: 'C' })] });   // 5명 S+A 통합: 65/17.5/11.7/5.8
  assert.deepStrictEqual(m.groups.map((g) => [g.label, g.members.map((p) => p.id).join(''), r2(g.share)]), [['S+A', 'bc', 65], ['B', 'd', 17.5], ['C', 'e', 11.7], ['D', 'a', 5.8]], '통합 묶음엔 S·A 둘 다, 기준 인원대로면 표 그대로');
  assert.ok(!A.checks(m).some((x) => x.text.includes('인원 배분 기준')));
  assert.strictEqual(A.compute({ pool: 1000000, people: [P_('x', 30, { rank: 'S', out: true }), P_('y', 20)] }).manual, false, '대상 아닌 사람의 rank 는 무시');
  const t = A.compute({ pool: 1000000, people: [P_('x', 60), P_('y', 20), P_('z', 20), P_('w', 5)] });   // 동점은 자동 그대로(기존 셈과 같음)
  assert.deepStrictEqual(t.groups.map((g) => [g.members.length, r2(g.share)]), [[1, 40], [2, 50], [0, 0], [1, 10], [0, 0]]);
});
test('부서별(byDept) — 부서 약칭, 부서마다 자리(기본 = 자동 배당, 이 경우 전체 순위와 같음)·조율(slots)·그 안에서 자동, 몫은 과제 전체 등급으로, 확정(done)', () => {
  assert.deepStrictEqual(A.shortDepts(['수소전기추진연구팀', '자율운항연구팀', '수소연료전지팀', '수소전지팀', '']), { '수소전기추진연구팀': '수소전', '자율운항연구팀': '자율', '수소연료전지팀': '수소연', '수소전지팀': '수소전2', '': '부서 없음' });
  const six = [P_('a', 60, { dept: '수소전기추진연구팀' }), P_('b', 50, { dept: '자율운항연구팀' }), P_('c', 40, { dept: '수소전기추진연구팀' }), P_('d', 30, { dept: '자율운항연구팀' }), P_('e', 20, { dept: '수소전기추진연구팀' }), P_('f', 10, { dept: '자율운항연구팀' })];   // 6명: S1 A1 B2 C1 D1 · 33/22.3/29.9/9.9/4.9
  const res = A.compute({ pool: 1000000, byDept: true, people: six });
  assert.deepStrictEqual(res.depts.map((d) => [d.label, d.n, d.slots, d.done]), [['수소', 3, { S: 1, A: 0, B: 1, C: 1, D: 0 }, false], ['자율', 3, { S: 0, A: 1, B: 1, C: 0, D: 1 }, false]], '기본 자리 = 자동 배당(이 경우 전체 순위와 같음)');
  assert.deepStrictEqual(res.people.map((p) => p.gradeLabel), ['S', 'A', 'B', 'B', 'C', 'D'], '기본 자리면 전체 자동과 같음');
  const adj = A.compute({ pool: 1000000, byDept: true, depts: { '수소전기추진연구팀': { slots: { S: 0, A: 1, B: 1, C: 1, D: 0 } }, '자율운항연구팀': { slots: { S: 1, A: 0, B: 1, C: 0, D: 1 }, done: true } }, people: six });
  assert.deepStrictEqual(adj.people.map((p) => [p.gradeLabel, r2(p.ratio)]), [['A', 22.3], ['S', 33], ['B', 14.95], ['B', 14.95], ['C', 9.9], ['D', 4.9]], 'S 자리를 자율로 넘기면 b 가 S, a 는 A — 몫은 과제 전체 등급 표');
  assert.deepStrictEqual([adj.depts[1].done, adj.depts[0].slots0.S, adj.depts[0].slots.S, adj.depts[0].custom, res.depts[0].custom], [true, 1, 0, true, false]);
  assert.deepStrictEqual([res.depts[0].actual, res.depts[0].fit, res.depts[0].rowBad, res.deptAlert, adj.deptAlert], [{ S: 1, A: 0, B: 1, C: 1, D: 0 }, [], false, { cols: [], depts: [] }, { cols: [], depts: [] }], '자리대로면 재조정 없음');
  const drag = A.compute({ pool: 1000000, byDept: true, people: six.map((p) => (p.id === 'a' ? Object.assign({}, p, { rank: 'B' }) : p.id === 'c' ? Object.assign({}, p, { rank: 'A' }) : p)) });   // 수소 a 를 B 로, c 를 A 로 끌어 놓음 → 수소 자리 S1 A0 B1 C1 과 다름(S 0/1 · A 1/0 · B 2/1 · C 0/1)
  assert.deepStrictEqual([drag.depts[0].actual, drag.depts[0].fit, drag.depts[0].rowBad, drag.depts[1].fit, drag.deptAlert], [{ S: 1, A: 1, B: 1, C: 0, D: 0 }, ['A 1/0', 'C 0/1'], false, [], { cols: [], depts: ['수소'] }], '끌어 놓아 자리와 다른 부서만 알림(열 합은 그대로) — rank 없는 e 는 남은 자리 S');
  assert.ok(A.checks(drag).some((x) => x.level === 'warn' && x.text === '수소 부서: 자리와 배정이 다릅니다(A 1/0 · C 0/1) — 등급 판의 자리 수나 [부서별 배정] 표를 고치거나 이름을 옮기세요.'), A.checks(drag).map((x) => x.text).join('\n'));
  assert.deepStrictEqual(A.compute({ pool: 1000000, people: six }).deptAlert, { cols: [], depts: [] }, '부서별 아니면 빈 알림');
  assert.ok(!A.checks(adj).some((x) => x.text.includes('인원')), A.checks(adj).map((x) => x.text).join('\n'));
  const bad = A.compute({ pool: 1000000, byDept: true, depts: { '수소전기추진연구팀': { slots: { S: 1, A: 1, B: 1, C: 1, D: 0 } } }, people: six });   // 수소 자리 4 > 사람 3, A 열 합 2 > 기준 1
  const w = A.checks(bad).map((x) => x.text);
  assert.ok(w.some((t) => t.startsWith('A 등급 부서별 인원 합 2명 — 인원 배분 기준은 1명')) && w.some((t) => t.startsWith('수소 부서 등급 인원 합 4명 — 사람은 3명')), w.join('\n'));
  assert.deepStrictEqual(bad.groups.map((g) => [g.members.length, r2(g.share)]), [[1, 33], [2, 32.2], [2, 29.9], [0, 0], [1, 4.9]], 'A 에 둘 → 빈 C 의 9.9 를 A 로');
  assert.deepStrictEqual(bad.deptAlert, { cols: ['A'], depts: ['수소'] }, '열 합/줄 합이 틀리면 그 묶음·부서 — [부서별 배정] 탭·부서 칩 !');
  const less = A.compute({ pool: 1000000, byDept: true, depts: { '수소전기추진연구팀': { slots: { S: 1, A: 0, B: 0, C: 0, D: 0 } } }, people: six });   // 수소 자리를 S 하나만 — c·e 는 자리가 없어 과제 전체 자동 등급(B · C)
  assert.deepStrictEqual([less.people.map((p) => p.gradeLabel), less.depts[0].fit, less.deptAlert], [['S', 'A', 'B', 'B', 'C', 'D'], ['B 1/0', 'C 1/0'], { cols: ['B', 'C'], depts: ['수소'] }]);
  assert.ok(A.checks(less).some((x) => x.text === 'B 등급 남은 자리 1명 — [부서별 배정] 표에서 부서에 더하세요(+).'), A.checks(less).map((x) => x.text).join('\n'));
});
/* 2026-10-21 사용자 "s,a,b,c,d 등 똑같이 수로 배당 하고 남은 것들은 차례대로, 부서이동하면서 … 한 부서는 6개가 남고 다른 부서는 2개가 남았다면 랜덤으로 하되 평균이 비슷하도록 … 그룹단위로" */
test('부서(그룹)별 자동 배당(apportion) — 묶음마다 기준 인원을 똑같이 나누고 나머지는 받은 자리 ÷ 사람 수가 낮은 단위부터, 같으면 차례로 돌아가며; 열 합·줄 합은 늘 맞음', () => {
  const six = [P_('a', 60, { dept: '수소' }), P_('b', 50, { dept: '수소' }), P_('c', 40, { dept: '수소' }), P_('d', 30, { dept: '자율' }), P_('e', 20, { dept: '자율' }), P_('f', 10, { dept: '자율' })];   // 6명 S1 A1 B2 C1 D1, 3명 + 3명
  const r = A.compute({ pool: 1000000, byDept: true, people: six });
  assert.deepStrictEqual(r.depts.map((d) => d.slots0), [{ S: 1, A: 0, B: 1, C: 1, D: 0 }, { S: 0, A: 1, B: 1, C: 0, D: 1 }], 'S 나머지는 차례(수소) → A 는 덜 받은 자율 → B 1씩 → C 차례(수소) → D 남은 자율');
  assert.deepStrictEqual(r.people.map((p) => p.gradeLabel), ['S', 'B', 'C', 'A', 'B', 'D']);
  const U_ = (...t) => t.map((total) => ({ total }));
  assert.deepStrictEqual(A.apportion([{ key: 'S', count0: 1 }, { key: 'A', count0: 2 }, { key: 'B', count0: 3 }, { key: 'C', count0: 1 }, { key: 'D', count0: 1 }], [U_(8, 7, 6, 5, 4, 3), U_(2, 1)]), [{ S: 1, A: 1, B: 2, C: 1, D: 1 }, { S: 0, A: 1, B: 1, C: 0, D: 0 }], '6명 + 2명 — 나머지는 받은 비율이 낮은(사람이 많이 남은) 쪽에, 줄 합 6 · 2');
  assert.deepStrictEqual(A.apportion([{ key: 'S', count0: 1 }, { key: 'A', count0: 1 }, { key: 'B', count0: 1 }], [U_(2, 1), U_(3)]), [{ S: 1, A: 0, B: 1 }, { S: 0, A: 1, B: 0 }], '2명 + 1명 — S 는 차례(앞), A 는 덜 받은 뒤, B 는 남은 앞');
  assert.deepStrictEqual(A.apportion([{ key: 'S', count0: 1 }], []), [], '단위 없음');
  assert.deepStrictEqual(A.apportion([{ key: 'S+A', count0: 2 }, { key: 'B', count0: 2 }, { key: 'C+D', count0: 2 }], [six.slice(0, 3).map((p) => ({ total: p.rate })), six.slice(3).map((p) => ({ total: p.rate }))]), [{ 'S+A': 1, B: 1, 'C+D': 1 }, { 'S+A': 1, B: 1, 'C+D': 1 }], '통합 묶음');
  for (let n = 1; n <= 40; n++) for (const k of [1, 2, 3, 5]) {
    const res = A.compute({ pool: 1000000, byDept: true, people: Array.from({ length: n }, (_, i) => P_('p' + i, 100 - i, { dept: 'd' + (i % k) })) });
    for (const d of res.depts) assert.strictEqual(res.groups.reduce((s, gr) => s + d.slots0[gr.key], 0), d.n, `${n}명 ${k}부서 ${d.name} 줄 합`);
    for (const gr of res.groups) assert.strictEqual(res.depts.reduce((s, d) => s + d.slots0[gr.key], 0), gr.count0, `${n}명 ${k}부서 ${gr.key} 열 합`);
    assert.ok(!A.checks(res).some((x) => x.text.includes('인원 합')), `${n}명 ${k}부서 알림 없음`);
  }
});
test('카드 — 차례 일반 정보 → 등급 배정·지급 내역(탭: 등급 배정(기본) · 부서별 배정 · 지급 내역, 안 고른 판은 hidden) → 평가 내용(별지 1); 등급 칸(번호 · n/기준 · 몫 · 끌 수 있는 이름), 줄의 평가등급 고르는 칸, 부서별 탭·자리 표·자동 배당·확정', () => {
  const st = mk();
  const br = U.budgetRows(P, plan, 1, st);
  const html = A.card(P, plan, 1, br, st, {});
  const i2 = html.indexOf('2. 등급 배정·지급 내역'), ib = html.indexOf('krext-al-board"'), ip = html.indexOf('<div class="krext-al-pane" data-tab="pay" hidden>'), i3 = html.indexOf('3. 평가 내용');
  assert.ok(i2 > 0 && ib > i2 && ip > ib && i3 > ip, `${i2} ${ib} ${ip} ${i3}`);
  assert.ok(html.includes('data-act="al-tab" data-tab="board" aria-selected="true">등급 배정</button>') && html.includes('data-act="al-tab" data-tab="pay" aria-selected="false">지급 내역</button>') && !html.includes('data-tab="slots"') && html.includes('<div class="krext-al-pane" data-tab="board">'), '탭 — 기본 등급 배정, 부서별 아니면 부서별 배정 탭 없음');
  const stp = mk({ allowUi: { [S.planKey(P.prjNo, 1)]: { tab: 'slots' } } });   // 부서별이 아니면 slots 탭은 board 로
  assert.ok(A.card(P, plan, 1, U.budgetRows(P, plan, 1, stp), stp, {}).includes('<div class="krext-al-pane" data-tab="board">'));
  stp.allowUi[S.planKey(P.prjNo, 1)].tab = 'pay';
  const htmlp = A.card(P, plan, 1, U.budgetRows(P, plan, 1, stp), stp, {});
  assert.ok(htmlp.includes('<div class="krext-al-pane" data-tab="board" hidden>') && htmlp.includes('<div class="krext-al-pane" data-tab="pay">') && htmlp.includes('data-tab="pay" aria-selected="true">지급 내역</button>'), '지급 내역 탭');
  assert.ok(html.includes('data-grp="S" title="S 등급 — 인원 배분 기준 1명 · 몫 60% · 1인 60.00%"') && !html.includes('krext-al-colshare') && html.includes('<span class="krext-al-colno">1</span><b>S</b><span class="krext-al-colcnt" title="배정 인원 / 인원 배분 기준">1/1명</span>') && html.includes('draggable="true" data-i="k" aria-pressed="false" title="김거화 — 합산기여도 ') && html.includes('data-grp="D"'), '등급 칸');
  assert.ok(html.includes('<select class="krext-al-sel krext-al-rank" data-alp="rank" data-i="m"') && html.includes('<option value="A" selected>A</option>') && html.includes('합산기여도 순(자동)') && html.includes('data-act="al-auto" title="끌어 놓은 등급을 지우고 합산기여도 순으로" disabled>자동</button>') && html.includes('data-al="bydept">') && !html.includes('krext-al-tabs'), '전체 모드');
  const st2 = mk({ allowCalc: { [S.planKey(P.prjNo, 1)]: { people: { k: { rank: 'A' }, m: { rank: 'S' } }, at: 1 } } });
  const html2 = A.card(P, plan, 1, U.budgetRows(P, plan, 1, st2), st2, {});
  assert.ok(html2.includes('수동 배정') && /data-i="m" aria-pressed="false" title="문창재 — 합산기여도 [\d.]+ · 수동 · 한도 초과 1,500,000원 \(↓ A 가능\)"/.test(html2) && html2.includes('data-act="al-auto" title="끌어 놓은 등급을 지우고 합산기여도 순으로">자동</button>') && html2.includes('합산기여도 순(별지 1)과 다른 등급: 김거화 A(순서대로면 S), 문창재 S(순서대로면 A)'), '수동');
  const erp = { at: 1, busy: false, members: { '김거화': { dept: '수소전기추진연구팀', pos: 'P2' }, '문창재': { dept: '자율운항연구팀', pos: 'P3' } }, error: '' };
  const st3 = mk({ allowErp: { [P.prjNo]: erp }, allowCalc: { [S.planKey(P.prjNo, 1)]: { byDept: true, depts: { '자율운항연구팀': { done: true } }, people: { m: { rank: 'A' } }, at: 1 } }, allowDept: { [S.planKey(P.prjNo, 1)]: '자율운항연구팀' } });
  const html3 = A.card(P, plan, 1, U.budgetRows(P, plan, 1, st3), st3, {});
  assert.ok(html3.includes('data-al="bydept" checked') && html3.includes('<table class="krext-cards krext-st-table krext-al-slots"') && html3.includes('data-als="S" data-d="수소전기추진연구팀" value="1"') && html3.includes('data-als="A" data-d="자율운항연구팀" value="1"') && html3.includes('data-act="al-tab" data-tab="slots" aria-selected="false">부서별 배정</button>') && html3.includes('<div class="krext-al-pane" data-tab="slots" hidden>') && html3.includes('data-act="al-slots-auto" title="고친 칸과 끌어 놓은 등급·확정을 모두 지우고 자동 배당부터 다시">자동 배정</button>') && html3.includes('<td class="krext-num krext-al-slotcell"><span class="krext-al-stepper"><button type="button" class="krext-al-step" data-act="al-slot" data-d="수소전기추진연구팀" data-g="S" data-dir="-1" aria-label="수소 S 자리 하나 줄이기" title="하나 줄이기">−</button><input type="text" class="krext-st-in krext-al-in krext-al-num" data-als="S" data-d="수소전기추진연구팀" value="1"') && html3.includes('data-d="수소전기추진연구팀" data-g="A" data-dir="-1" aria-label="수소 A 자리 하나 줄이기" title="하나 줄이기" disabled>−</button>'), '자리 표 — −/+(0 이면 − 꺼짐) · [자동 배정]은 끌어 놓은 등급·확정이 있어 켜짐');
  const st0 = mk({ allowErp: { [P.prjNo]: erp }, allowCalc: { [S.planKey(P.prjNo, 1)]: { byDept: true, at: 1 } } });
  const html0 = A.card(P, plan, 1, U.budgetRows(P, plan, 1, st0), st0, {});
  assert.ok(html0.includes('data-als="S" data-d="수소전기추진연구팀" value="1"') && html0.includes('data-als="A" data-d="자율운항연구팀" value="1"') && html0.includes('data-act="al-slots-auto" title="고친 칸과 끌어 놓은 등급·확정을 모두 지우고 자동 배당부터 다시" disabled>자동 배정</button>') && !html0.includes('krext-al-alert') && html0.includes('<td class="krext-num">1/1<span class="krext-al-dots" title="S — 기준 1 · 자리 합 1" style="--krx-cols:1" aria-hidden="true"><i class="krext-al-dot-on"></i></span></td>') && html0.includes('title="수소 S — 자리 1 · 배정 1" style="--krx-cols:1" aria-hidden="true"><i class="krext-al-dot-on"></i></span>') && html0.includes('<td class="krext-num">0/0</td>'), '기본(자동 배당 그대로) — 되돌릴 것이 없으면 [자동 배정] 꺼짐, ! 없음');
  assert.ok(html3.includes('data-tab="slots" aria-selected="false">부서별 배정</button>') && !html3.includes('krext-al-alert') && html3.includes('<span class="krext-al-colcnt" title="배정 인원 / 이 부서의 자리(고칠 수 있음)">1/<input type="text" class="krext-al-slot-in" data-alq="A" data-d="자율운항연구팀" value="1" inputmode="numeric" aria-label="자율 의 A 등급 자리"'), '자리대로면 ! 없음 · 등급 판 열 머리의 자리 수 칸(data-alq)');
  st3.allowCalc[S.planKey(P.prjNo, 1)].people.m.rank = 'S';   // 자율(자리 A1)의 문창재를 S 로 → 자리와 다름 → [부서별 배정] 탭·자율 칩에 !, 자리 표에 배정 n
  const html3b = A.card(P, plan, 1, U.budgetRows(P, plan, 1, st3), st3, {});
  assert.ok(html3b.includes('data-tab="slots" aria-selected="false">부서별 배정<b class="krext-al-alert" title="재조정 필요 — 자리와 배정이 다르거나 줄 합이 틀린 부서: 자율">!</b></button>') && html3b.includes('>자율<small>1</small><span class="krext-al-done">✓</span><b class="krext-al-alert" title="재조정 필요 — 자리와 배정이 다름: S 1/0 · A 0/1">!</b></button>') && html3b.includes('data-als="S" data-d="자율운항연구팀" value="0" inputmode="numeric" title="자율 의 S 등급 자리 — 기본 0명(자동 배당)"><button type="button" class="krext-al-step" data-act="al-slot" data-d="자율운항연구팀" data-g="S" data-dir="1" aria-label="자율 S 자리 하나 늘리기" title="하나 늘리기">+</button></span><span class="krext-al-dots" title="자율 S — 자리 0 · 배정 1" style="--krx-cols:1" aria-hidden="true"><i class="krext-al-dot-over"></i></span><small class="krext-al-fitbad" title="지금 이 등급에 배정된 사람 수 — 자리와 다릅니다">배정 1</small></td>') && html3b.includes('title="자율 A — 자리 1 · 배정 0" style="--krx-cols:1" aria-hidden="true"><i></i></span>') && !html3b.includes('data-d="수소전기추진연구팀" title="수소전기추진연구팀 — 1명"><b'), '! 와 배정 n');
  st3.allowCalc[S.planKey(P.prjNo, 1)].people.m.rank = 'A';
  st3.allowCalc[S.planKey(P.prjNo, 1)].depts['수소전기추진연구팀'] = { slots: { S: 0, A: 1 } };
  assert.ok(A.card(P, plan, 1, U.budgetRows(P, plan, 1, st3), st3, {}).includes('<span class="krext-al-manual">조율함</span><button type="button" class="krext-plan-btn" data-act="al-slots-auto" title="고친 칸과 끌어 놓은 등급·확정을 모두 지우고 자동 배당부터 다시">자동 배정</button>'), '칸을 고치면 조율함 + 자동 배정 단추');
  delete st3.allowCalc[S.planKey(P.prjNo, 1)].depts['수소전기추진연구팀'];
  assert.ok(html3.includes('data-act="al-dtab" data-d="수소전기추진연구팀" title="수소전기추진연구팀 — 1명" aria-selected="false">수소<small>1</small></button>') && html3.includes('data-d="자율운항연구팀" title="자율운항연구팀 — 1명 · 확정" aria-selected="true">자율<small>1</small><span class="krext-al-done">✓</span></button>'), '탭');
  assert.ok(html3.includes('draggable="false" data-i="m"') && !html3.includes('data-i="k" title="김거화') && html3.includes('data-act="al-done" data-d="자율운항연구팀" title="확정을 풀어 다시 옮길 수 있게">확정 해제</button>') && html3.includes('data-alp="rank" data-i="m" title="평가등급 — 고르면 수동 배정([등급 배정] 탭에서 끌어 놓아도 됩니다)" disabled>'), '확정된 부서 탭 — 잠김');
  assert.deepStrictEqual(A.normalize({ k: { byDept: 1, depts: { '수소': { slots: { S: '1', 'S+A': 2, X: 3, B: -1 }, done: 1 }, '': { done: true }, bad: null }, people: { a: { rank: 'S' }, b: { rank: 'X' } } } }).k, { people: { a: { rank: 'S' } }, at: 0, byDept: true, depts: { '수소': { slots: { S: 1, 'S+A': 2 }, done: true }, '': { done: true } } });
});

/* 2026-10-21 사용자 "여기도 참여연구원 변경 처럼 팀즈로 조사하고 연구수당 한도를 각 연구원 지급 금액에 할당해 주고, 금액상 등급을 낮춰도 각 연구원의 한도를 다 채울 수 있는지 알람? … 화살표 아래로.. 가능.. 이런식이라던지" */
test('잔여 한도 — 여유·초과, 초과면 낮춰도 한도를 채우는 가장 낮은 등급(↓ 가능)·알림, 표의 잔여 한도 열, 카드 tail, 탭의 자료 요청 구역(잔여 연구수당만 기본)', () => {
  // 3명 S/A/B = 50/30/20 × 1,000,000 → 500,000 / 300,000 / 200,000
  const res = A.compute({ pool: 1000000, people: [P_('x', 30, { cap: 250000, capSrc: '응답' }), P_('y', 20, { cap: 350000, capSrc: '응답' }), P_('z', 10)] });
  const x = byId(res, 'x'), y = byId(res, 'y'), z = byId(res, 'z');
  assert.deepStrictEqual([x.over, x.room, x.down, x.downAmt], [250000, 0, 'A', 300000], 'x 초과 250 → A 1인 300 ≥ 250, B 200 < 250 → ↓ A');
  assert.deepStrictEqual([y.over, y.room, y.down, z.cap, z.over, z.down], [0, 50000, '', null, 0, '']);
  const w = A.checks(res).map((t) => t.text);
  assert.ok(w.includes('X: 지급액 500천원이 남은 연구수당 250천원(응답)을 넘습니다(초과 250천원) — ↓ A 등급으로 낮춰도 한도를 채웁니다(A 1인 기준 300천원) · 초과분은 예산변경·계속비 편성 또는 반납(제6조④).'), w.join('\n'));
  assert.ok(w.includes('한도 초과분 합 250천원 — 한도에 여유가 있는 사람: Y(여유 50천원) · 한도를 모르는 사람 1명.') && w.includes('남은 연구수당(한도)을 모르는 사람 1명: Z — 아래 자료 요청으로 팀즈에 물어보면 잔여 한도 열에 들어옵니다.'), w.join('\n'));
  const no = A.compute({ pool: 1000000, people: [P_('x', 30, { cap: 400000, capSrc: 'HR' }), P_('y', 20), P_('z', 10)] });
  assert.deepStrictEqual([byId(no, 'x').over, byId(no, 'x').down], [100000, ''], 'A 300 < 400 → 낮추면 못 채움');
  assert.ok(A.checks(no).some((t) => t.text.includes('(초과 100천원) — 한 등급만 낮춰도 한도에 못 미칩니다')));
  assert.ok(!A.checks(A.compute({ pool: 1000000, people: [P_('x', 30, { cap: 1200000 })] })).some((t) => /한도/.test(t.text)), '한도 안이고 모르는 사람 없으면 한도 알림 없음');
  // 카드 — 김거화(S 3,000,000 · HR 1,800,000 → ↓ A 가능(A 1인 2,000,000)) · 문창재(A 2,000,000 · 응답 1,500,000 → 아래 등급 자리 없음 → 초과만)
  const st = mk(), br = U.budgetRows(P, plan, 1, st);
  const html = A.card(P, plan, 1, br, st, { me: '김거화', hr: { grade: 'P2', remain: 1800000 } });
  const cells = (h) => (h.match(/<td class="krext-num krext-al-cap">[^]*?<\/td>/g) || []).join('\n');
  assert.ok(html.includes('>잔여 한도(원)</th>') && html.includes('1,800,000<small>HR</small></span><small class="krext-al-capover" title="지급액 − 한도 — 초과분은 예산변경·계속비 편성 또는 반납(제6조④)">초과 1,200,000</small><span class="krext-al-capflag" title="A 등급으로 낮춰도(1인 기준 2,000,000원) 한도를 채울 수 있어 초과분을 다른 사람에게 돌릴 수 있습니다 — 평가등급 칸이나 아래 등급 칸에서 옮기세요">↓ A 가능</span></td>'), cells(html));
  assert.ok(html.includes('1,500,000<small>응답</small></span><small class="krext-al-capover" title="지급액 − 한도 — 초과분은 예산변경·계속비 편성 또는 반납(제6조④)">초과 500,000</small></td>') && html.includes('>초과 합 1,700,000</small></td>'), cells(html));
  assert.ok(html.includes('>김거화<b class="krext-al-chipdown" title="A 등급으로 낮춰도(1인 기준 2,000,000원) 한도를 채웁니다 — 초과 1,200,000원">↓A</b><small>') && html.includes('>문창재<b class="krext-al-chipover" title="한도 초과 500,000원 — 한 등급만 낮춰도 한도에 못 미칩니다">!</b><small>') && /data-i="k" aria-pressed="false" title="김거화 — 합산기여도 [\d.]+ · 한도 초과 1,200,000원 \(↓ A 가능\)"/.test(html), '등급 칸 칩 — ↓A(낮출 수 있음) · !(초과만)');
  const roomy = A.card(P, plan, 1, br, st, { me: '김거화', hr: { grade: 'P2', remain: 3500000 } });
  assert.ok(roomy.includes('3,500,000<small>HR</small></span><small class="krext-al-caproom" title="한도 − 지급액">여유 500,000</small></td>') && roomy.includes('>김거화<small>'), cells(roomy));
  const noCap = A.card(P, plan, 1, br, st, {});
  assert.ok(noCap.includes('<td class="krext-num krext-al-cap"><span class="krext-dim" title="남은 연구수당을 모릅니다 — 아래 자료 요청으로 팀즈에 물어보면 여기에 들어옵니다(내 것은 HR 급여)">—</span></td>'), cells(noCap));
  const empty = mk({ staffPlans: {} });
  assert.ok(A.card(P, plan, 1, br, st, { tail: '<i id="tail">x</i>' }).endsWith('<i id="tail">x</i></div></div>') && A.card(P, null, 1, U.budgetRows(P, null, 1, empty), empty, { tail: '<i id="tail">x</i>' }).endsWith('<i id="tail">x</i></div></div>'), 'opts.tail 은 카드 끝(계획이 없어도)');
  // 탭(section only:allow) — 카드 끝에 자료 요청 구역(새 요청 칸 기본 = 잔여 연구수당만), 응답 줄의 반영 체크 상자 기본 = 연구수당만(기간·참여율은 끄고 시작)
  const sec = U.section({ projects: [P] }, {}, st, '', { only: 'allow' });
  assert.ok(sec.includes('<div class="krext-st-collect" data-cokey="2026-0063-01@1" data-cono="1">') && sec.indexOf('krext-st-collects') > sec.indexOf('3. 평가 내용') && sec.includes('잔여 연구수당을 팀즈로 물어 지급 내역의 잔여 한도 열에 · 양식 공유') && sec.includes('data-stco-ask="Rate"> 잔여 참여율') && sec.includes('data-stco-ask="Monthly"> 월급여') && sec.includes('data-stco-ask="Allowance" checked> 잔여 연구수당') && sec.includes('대상 1명: 문창재'), '자료 요청 구역 — 잔여 연구수당만 기본');
  const K = S.planKey(P.prjNo, 1);
  const req = { prjNo: P.prjNo, year: 1, title: 'KR 참여현황 SSCB 1차년도', listId: '11111111-2222-3333-4444-000000000001', site: 'https://krclass-my.sharepoint.com/personal/x', path: '/personal/x/Lists/KR', listUrl: 'https://krclass-my.sharepoint.com/personal/x/Lists/KR/AllItems.aspx', formUrl: 'https://krclass-my.sharepoint.com/personal/x/Lists/KR/NewForm.aspx', createdAt: 1000, by: '김거화', ask: ['Allowance'],
    people: [{ name: '문창재', email: 'cjmoon@krs.co.kr', status: 'shared', sharedAt: 2000 }], responses: [{ id: '3', by: '문창재', email: 'cjmoon@krs.co.kr', name: '문창재', title: P.prjNm, from: '2026-10', to: '2026-12', rate: 25, monthly: null, allowance: 1200000, note: '', at: 5000 }], applied: {} };
  const sec2 = U.section({ projects: [P] }, {}, mk({ staffCollect: { [K]: req } }), '', { only: 'allow' });
  assert.ok(sec2.includes(`data-stco-pick="period" data-cokey="${K}" data-id="3">기간</label>`) && sec2.includes(`data-stco-pick="rate" data-cokey="${K}" data-id="3">참여율</label>`) && sec2.includes(`data-stco-pick="allowance" data-cokey="${K}" data-id="3" checked>연구수당</label>`) && sec2.includes('<td class="krext-num">1,200</td>'), '응답 줄 — 연구수당만 켜짐');
});

/* 2026-10-21 사용자 "부서별 매칭에서 그룹 기능도 추가 해줘. 부서를 드래그 하면 병합하고, split 도 되고" */
test('부서 그룹(unions) — 끌어 합친 부서는 한 단위(key 이름|이름 · label 수소+자율)로 자리를 같이 씀, 병합·분리 helper, 저장, 자리 표의 끌 수 있는 이름·[분리]·탭 제목', () => {
  const six = [P_('a', 60, { dept: '수소' }), P_('b', 50, { dept: '수소' }), P_('c', 40, { dept: '자율' }), P_('d', 30, { dept: '자율' }), P_('e', 20, { dept: '디지털' }), P_('f', 10, { dept: '디지털' })];
  const r = A.compute({ pool: 1000000, byDept: true, unions: [['수소', '자율']], people: six });
  assert.deepStrictEqual(r.depts.map((d) => [d.name, d.label, d.title, d.names, d.n, d.people.map((p) => p.id).join('')]), [['수소|자율', '수소+자율', '수소 + 자율', ['수소', '자율'], 4, 'abcd'], ['디지털', '디지', '디지털', ['디지털'], 2, 'ef']]);
  assert.deepStrictEqual(r.depts.map((d) => r.groups.reduce((s, gr) => s + d.slots0[gr.key], 0)), [4, 2], '그룹 단위로 자동 배당(줄 합 = 그룹 사람 수)');
  assert.deepStrictEqual(r.deptAlert, { cols: [], depts: [] });
  const cfg = A.compute({ pool: 1000000, byDept: true, unions: [['수소', '자율']], depts: { '수소|자율': { slots: { S: 1, A: 1, B: 2, C: 0, D: 0 }, done: true } }, people: six });
  assert.deepStrictEqual([cfg.depts[0].slots, cfg.depts[0].done, cfg.depts[0].custom], [{ S: 1, A: 1, B: 2, C: 0, D: 0 }, true, true], '그룹 key 로 저장된 자리·확정');
  assert.deepStrictEqual(A.unitsOf(['a', 'b', 'c', 'd'], [['c', 'a', 'x'], ['a', 'd'], ['b']]), [['c', 'a'], ['b'], ['d']], '없는 부서는 빼고, 겹치면 먼저 온 그룹, 하나 남으면 품; 차례는 첫 부서 순');
  assert.deepStrictEqual(A.mergeUnions([['a', 'b'], ['c', 'd']], 'a|b', 'e'), [['c', 'd'], ['a', 'b', 'e']]);
  assert.deepStrictEqual(A.mergeUnions([['a', 'b'], ['c', 'd']], 'a|b', 'c|d'), [['a', 'b', 'c', 'd']]);
  assert.deepStrictEqual(A.splitUnion([['a', 'b'], ['c', 'd']], 'a|b'), [['c', 'd']]);
  assert.deepStrictEqual(A.normalize({ k: { unions: [['수소', '자율'], ['x'], 'bad', ['a', 'a', 'b']], depts: { '수소|자율': { done: true } } } }).k, { people: {}, at: 0, depts: { '수소|자율': { done: true } }, unions: [['수소', '자율'], ['a', 'b']] });
  const erp = { at: 1, busy: false, members: { '김거화': { dept: '수소전기추진연구팀', pos: 'P2' }, '문창재': { dept: '자율운항연구팀', pos: 'P3' } }, error: '' };
  const KEY = '수소전기추진연구팀|자율운항연구팀';
  const st = mk({ allowErp: { [P.prjNo]: erp }, allowCalc: { [S.planKey(P.prjNo, 1)]: { byDept: true, unions: [['수소전기추진연구팀', '자율운항연구팀']], at: 1 } } });
  const html = A.card(P, plan, 1, U.budgetRows(P, plan, 1, st), st, {});
  const rows = (h) => (h.match(/<tr class="krext-al-unit"[^]*?<\/tr>/g) || []).join('\n');
  assert.ok(html.includes(`<tr class="krext-al-unit" data-unit="${KEY}"><td class="krext-al-dept" draggable="true" data-unitdrag="${KEY}" title="수소전기추진연구팀 + 자율운항연구팀 — 끌어 다른 부서 줄에 놓으면 한 그룹으로 합쳐 자리를 같이 씁니다">수소+자율<button type="button" class="krext-ico-btn krext-al-split" data-act="al-split" data-d="${KEY}" title="그룹을 풀어 부서별로" aria-label="수소+자율 그룹 분리">분리</button></td>`) && html.includes(`data-act="al-dtab" data-d="${KEY}" title="수소전기추진연구팀 + 자율운항연구팀 — 2명"`) && html.includes(`data-als="S" data-d="${KEY}" value="1"`) && html.includes(`data-als="A" data-d="${KEY}" value="1"`), rows(html));
  const st1 = mk({ allowErp: { [P.prjNo]: erp }, allowCalc: { [S.planKey(P.prjNo, 1)]: { byDept: true, at: 1 } } });
  const single = A.card(P, plan, 1, U.budgetRows(P, plan, 1, st1), st1, {});
  assert.ok(single.includes('data-unitdrag="수소전기추진연구팀" title="수소전기추진연구팀 — 끌어') && single.includes('data-unitdrag="자율운항연구팀"') && !single.includes('al-split'), '그룹이 아니면 줄마다 하나, [분리] 없음');
});

/* 2026-10-21 사용자 "접어줘" — 1. 일반 정보 */
/* 2026-10-21 밤 사용자 "필수로 지정한 건 선택된 상태로 두고 클릭하면 비활성화 다시 클릭하면 활성화(포함) … 에이전트로 연구내용에서 평가 항목 추출하면 활성화로 기본 추출하고 다시 클릭하면 비활성화 … 연구내용 건은 대부분 all 이 기본이고, 그룹을 할당할 수 있게 … 그 그룹은 이 항목을 넣을 수 있게" */
test('포함 항목 — pickList(필수·분류된 연구내용 기본 켜짐, pick 토글, 분류 전은 못 켬) · autoItemsOf(그룹 없으면 모두, 가중치 1/N 은 받는 지급 대상 수) · mergeItems(같은 이름 저장 줄은 뺌); 가중치 합 알림(논문·특허 제외); 저장 모양의 research·pick·groups', () => {
  const rec = { prjNo: P.prjNo, n: 1, contents: [{ item: 'DC 차단기 설계', details: [] }, { item: '시험 평가', details: [] }] };
  const pl0 = A.pickList({}, rec);
  assert.deepStrictEqual(pl0.filter((it) => it.on).map((it) => [it.name, it.level]), REQUIRED, '기본은 필수 3개(연구내용은 분류 전이라 못 켬)');
  assert.deepStrictEqual(pl0.filter((it) => it.src === 'research').map((it) => [it.name, it.level, it.on]), [['DC 차단기 설계', '', false], ['시험 평가', '', false]]);
  assert.ok(!pl0.some((it) => it.name === '기타') && pl0.filter((it) => it.level === '가').length === 7 && pl0[0].name === '연구총괄 및 관리', '기타는 칩이 아님 · 필수가 앞');
  const e1 = { research: { 'DC 차단기 설계': '가' }, pick: { '진도보고서 작성': false, '연구총괄 및 관리': true }, items: { '가': ['연구총괄 및 관리'], '나': [], '다': [] } };
  assert.deepStrictEqual(A.pickList(e1, rec).filter((it) => it.on).map((it) => `${it.name}/${it.level}/${it.src}`), REQUIRED.filter(([name]) => name !== '진도보고서 작성').map(([name, level]) => `${name}/${level}/list`).concat('DC 차단기 설계/가/research'), '분류된 연구내용은 기본 켜짐, pick 이 토글, 목록에서 뺀 필수도 원래 난이도로');
  assert.deepStrictEqual(A.pickList({ items: { '가': [], '나': [], '다': [] } }, null).map((it) => [it.name, it.level, it.on]), REQUIRED.map(([name, level]) => [name, level, true]), '사용자 목록에 필수 항목이 전혀 없어도 3개와 난이도 복구');
  assert.ok(REQUIRED.every(([name]) => A.isRequired(name) && A.isRequired(` ${name.replace(/ /g, '')} `)) && !A.isRequired('기타'));
  const ppl = [{ id: 'a', target: true }, { id: 'b', target: true }, { id: 'c', target: false }];
  const auto = A.autoItemsOf({}, null, ppl);
  assert.deepStrictEqual(auto.a, requiredRows(), '필수 3개의 가중치는 받는 지급 대상 수로 1/N');
  assert.deepStrictEqual(auto.c.map((it) => it.weight), Array(REQUIRED.length).fill(0.5), '대상이 아닌 사람도 줄은 받음(N 에는 안 듦)');
  const grouped = A.autoItemsOf({ research: { 'DC 차단기 설계': '가' }, groups: [{ name: 'G', people: ['a', 'c'], items: ['DC 차단기 설계'] }] }, rec, ppl);
  assert.deepStrictEqual([grouped.a.map((it) => `${it.name}/${it.weight}`), grouped.b.map((it) => it.name), grouped.c.map((it) => it.name)], [requiredNames.map((name) => `${name}/0.5`).concat('DC 차단기 설계/1'), requiredNames, requiredNames.concat('DC 차단기 설계')], '그룹에 든 항목은 그 그룹 사람만(1/N 은 그룹의 지급 대상 수)');
  assert.deepStrictEqual(A.mergeItems(auto.a, [{ name: '진도 보고서 작성', level: '나', count: 2, weight: 1 }, { name: '논문(SCI(E))', level: '가', count: 1, weight: 0.8 }]).map((it) => [it.name, it.weight]), requiredNames.map((name) => [name, 0.5]).concat([['논문(SCI(E))', 0.8]]), '띄어쓰기가 달라도 같은 이름의 저장 줄은 뺌(옛 필수 줄)');
  const savedOff = A.normalize({ k: { people: {}, pick: Object.fromEntries(requiredNames.map((name) => [name, false])) } }).k;
  assert.deepStrictEqual(A.autoItemsOf(savedOff, null, ppl), { a: [], b: [], c: [] }, '필수도 저장한 제외 선택을 다시 불러오면 그대로 꺼짐');
  const requiredGroup = A.autoItemsOf({ groups: [{ name: '총괄', people: ['a', 'c'], items: ['연구총괄 및 관리'] }] }, null, ppl);
  assert.strictEqual(requiredGroup.a[0].weight, 1, '필수도 그룹의 지급 대상 수로 1/N');
  assert.ok(!requiredGroup.b.some((it) => it.name === '연구총괄 및 관리'), '그룹에 배정한 필수는 그룹 밖 사람에게 넣지 않음');
  const tg = (n) => Array.from({ length: n }, (_, i) => ({ id: 'p' + (i + 1), target: true }));
  assert.deepStrictEqual([A.autoItemsOf({}, null, tg(3)).p1[0].weight, A.autoItemsOf({}, null, tg(7)).p1[1].weight], [0.3333, 0.1429], '소수 4자리');
  const three = A.compute({ pool: 1000000, people: [1, 2, 3].map((i) => P_('p' + i, 30, { items: A.autoItemsOf({}, null, tg(3))['p' + i] })) });
  assert.ok(!A.checks(three).some((w) => w.text.includes('가중치 합')), '1/3 × 3 의 반올림 오차는 알림 없음');
  assert.ok(three.people[0].items.every((it) => it.auto === true), 'compute 가 auto 표시를 지킴');
  const ok = A.compute({ pool: 1000000, people: [P_('x', 50, { items: [{ name: '최종보고서 작성', level: '가', count: 1, weight: 0.6 }, { name: '논문(SCI(E))', level: '가', count: 1, weight: 0.8 }] }), P_('y', 50, { items: [{ name: '최종보고서 작성', level: '가', count: 1, weight: 0.4 }, { name: '특허(국제)', level: '가', count: 1, weight: 0.6 }] })] });
  assert.ok(!A.checks(ok).some((w) => w.text.includes('가중치 합')), '0.6 + 0.4 = 1 · 논문·특허는 안 봄');
  const bad = A.compute({ pool: 1000000, people: [P_('x', 50, { items: [{ name: '최종보고서 작성', level: '가', count: 1, weight: 0.6 }] }), P_('y', 50, { items: [{ name: '최종 보고서 작성', level: '가', count: 1, weight: 0.6 }, { name: '진도보고서 작성', level: '다', count: 1, weight: 0.5 }] })] });
  assert.ok(A.checks(bad).some((w) => w.level === 'warn' && w.text.startsWith('참여연구원간 가중치 합이 1 이 아닌 항목: 최종보고서 작성(1.2), 진도보고서 작성(0.5) — 논문·특허를 뺀')), A.checks(bad).map((w) => w.text).join('\n'));
  assert.deepStrictEqual(A.weightSums(bad).map((w) => [w.name, w.sum, w.bad]), [['최종보고서 작성', 1.2, true], ['진도보고서 작성', 0.5, true]], 'weightSums — 띄어쓰기가 달라도 같은 항목, 논문·특허 제외');
  assert.deepStrictEqual(A.weightSums(ok).map((w) => [w.name, w.bad]), [['최종보고서 작성', false]], 'weightSums ok');
  assert.deepStrictEqual(A.normalize({ k: { research: { 'DC 차단기 설계': '가', ' 시험 평가 ': '나', x: '엉', '': '가' }, at: 1 } }).k.research, { 'DC 차단기 설계': '가', '시험 평가': '나' });
  assert.strictEqual(A.normalize({ k: { research: {}, at: 1 } }).k.research, undefined);
  assert.deepStrictEqual(A.normalize({ k: { pick: { '진도보고서 작성': false, x: 'no', '': true }, groups: [{ name: ' G ', people: ['a', 'a', ''], items: ['DC 차단기 설계'] }, { people: [] }, 'x'], at: 1 } }).k, { people: {}, at: 1, pick: { '진도보고서 작성': false }, groups: [{ name: 'G', people: ['a'], items: ['DC 차단기 설계'] }, { name: '그룹', people: [], items: [] }] }, 'pick 은 boolean 만, 그룹은 이름(기본 "그룹")·사람·항목 중복 제거');
});
test('항목 전담 그룹 — 기존 중복 배정을 정리하고 선택한 그룹만 적용, 그룹 대상 수로 1/N, 전체 연구자로 복원, 저장 유지', () => {
  const name = '최종보고서 작성';
  const entry = { people: {}, pick: { [name]: false }, groups: [
    { name: '총괄', people: ['a'], items: ['최종 보고서 작성', '연구총괄 및 관리'] },
    { name: '작성', people: ['b', 'c', 'off'], items: [name, '최종보고서작성', '진도보고서 작성'] },
  ] };
  const people = [{ id: 'a', target: true }, { id: 'b', target: true }, { id: 'c', target: true }, { id: 'off', target: false }];
  A.assignGroup(entry, name, 1);
  assert.deepStrictEqual(entry.groups.map((group) => group.items), [['연구총괄 및 관리'], ['진도보고서 작성', name]], '띄어쓰기 변형까지 이전 배정에서 제거한 뒤 전담 그룹에 한 번만 넣음');
  assert.strictEqual(entry.pick[name], true, '적용 그룹을 선택하면 꺼져 있던 항목도 포함');
  const assigned = A.autoItemsOf(entry, null, people);
  assert.ok(!assigned.a.some((item) => item.name === name), '전담 그룹 밖 연구자에게는 해당 항목이 없음');
  for (const id of ['b', 'c', 'off']) assert.deepStrictEqual(assigned[id].filter((item) => item.name === name), [{ name, level: '가', count: 1, weight: 0.5, auto: true }], `${id}: 지급 대상 둘에 대한 1/N`);
  const saved = A.normalize({ project: entry }).project;
  assert.deepStrictEqual(A.autoItemsOf(saved, null, people), assigned, '정규화·재로딩 후 전담 그룹 배분 유지');
  const before = JSON.stringify(entry);
  A.assignGroup(entry, name, 1);
  assert.strictEqual(JSON.stringify(entry), before, '같은 그룹 재선택은 중복을 만들지 않음');
  for (const invalid of [99, -2, 0.5, '1']) assert.strictEqual(A.assignGroup(entry, name, invalid), false);
  assert.strictEqual(JSON.stringify(entry), before, '유효하지 않은 그룹 번호는 기존 배정을 보존');
  A.assignGroup(entry, name, -1);
  assert.ok(entry.groups.every((group) => !group.items.includes(name)) && entry.pick[name], '전체 연구자는 모든 그룹에서 해당 항목의 전담 배정만 제거');
  const all = A.autoItemsOf(entry, null, people);
  for (const id of ['a', 'b', 'c', 'off']) assert.strictEqual(all[id].find((item) => item.name === name).weight, 0.3333, `${id}: 전체 지급 대상 셋으로 다시 배분`);
  assert.deepStrictEqual(entry.groups.map((group) => group.items), [['연구총괄 및 관리'], ['진도보고서 작성']], '다른 항목의 전담 배정은 유지');
});

test('항목별 전담 그룹 선택 — 기존 그룹·부서·병합 부서 바로 지정, 새 그룹, 전체 복원, 유효하지 않은 선택·미분류·20개 한도', () => {
  const key = S.planKey(P.prjNo, 1), name = '최종보고서 작성';
  const rec = { id: 'r1', prjNo: P.prjNo, n: 1, contents: [{ item: '미분류 연구내용', details: [] }, { item: '설계 분석', details: [] }] };
  const savedItems = [{ name: '최종 보고서 작성', level: '가', count: 2, weight: 0.7 }, { name: '논문(SCI(E))', level: '가', count: 1, weight: 0.8 }];
  const entry = { people: { k: { dept: '수소' }, m: { dept: '자율', items: savedItems.map((item) => ({ ...item })) }, j: { dept: '수소' } }, research: { '설계 분석': '나' }, groups: [{ name: '기획', people: ['k'], items: [] }], at: 1 };
  const st = mk({ data: { projects: [P] }, research: { r1: rec }, allowCalc: { [key]: entry }, staffView: { prjNo: P.prjNo, years: { [P.prjNo]: 1 }, extra: {}, inc: {}, fold: {} }, staffAliases: {} });
  const listeners = {}, card = { dataset: { alkey: key } };
  const host = { addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }, contains: () => false, querySelector: () => null, querySelectorAll: () => [], ownerDocument: { activeElement: null } };
  A.bind(host, st, () => {});
  const changeScope = (item, value) => {
    const target = { dataset: { alscope: item }, value, closest: (selector) => selector.startsWith('[data-alkey') ? card : null };
    for (const fn of listeners.change) fn({ target });
  };
  const html = () => A.card(P, plan, 1, U.budgetRows(P, plan, 1, st), st, {});
  const rows = () => A.ctxOf(P, plan, 1, U.budgetRows(P, plan, 1, st), st, {}).res.people;
  const itemFor = (id, item) => byId({ people: rows() }, id).items.find((it) => it.name.replace(/\s/g, '') === item.replace(/\s/g, ''));
  const initial = html(), selector = scopeSelect(initial, name);
  assert.ok(selector.includes('value="all" selected') && selector.includes('value="group:0"') && selector.includes('기획') && selector.includes('value="unit:0"') && selector.includes('수소') && selector.includes('value="unit:1"') && selector.includes('자율') && selector.includes('value="new"'), '각 항목에서 전체·기존 그룹·부서·새 그룹을 고를 수 있음');
  assert.ok(scopeSelect(initial, '미분류 연구내용').split('>')[0].includes(' disabled') && !scopeSelect(initial, '설계 분석').split('>')[0].includes(' disabled'), '연구내용은 분류된 뒤 전담 그룹을 선택');
  changeScope(name, 'group:0');
  assert.deepStrictEqual(entry.groups[0].items, [name]);
  assert.ok(itemFor('k', name).weight === 1 && !itemFor('m', name), '선택한 그룹 한 사람에게만 1/N 적용');
  assert.deepStrictEqual(entry.people.m.items, savedItems, '그룹 밖 연구자의 옛 개별 저장은 삭제하지 않음');
  assert.strictEqual(itemFor('m', '논문(SCI(E))').weight, 0.8, '다른 개별 성과는 그대로 적용');
  assert.ok(scopeSelect(html(), name).includes('value="group:0" selected'), '선택 상태를 항목에 표시');
  assert.ok(!html().includes(`<option value="가|${name}">`), '공통 포함 항목은 그룹 밖 연구자의 개별 추가 목록에도 중복 표시하지 않음');
  const visiblePaperIndex = rows().find((person) => person.id === 'm').items.findIndex((item) => item.name === '논문(SCI(E))');
  const paperInput = { dataset: { ali: 'weight', i: 'm', k: String(visiblePaperIndex) }, value: '0.9', closest: (selector) => selector.startsWith('[data-alkey') ? card : null };
  for (const fn of listeners.change) fn({ target: paperInput });
  assert.deepStrictEqual(entry.people.m.items.map((item) => [item.name, item.weight]), [['최종 보고서 작성', 0.7], ['논문(SCI(E))', 0.9]], '보이지 않는 옛 항목 앞에 있어도 화면의 논문 줄 수정은 논문에만 적용');
  const deletePaper = { dataset: { act: 'al-item-del', i: 'm', k: String(visiblePaperIndex) } };
  deletePaper.closest = (selector) => selector.startsWith('[data-alkey') ? card : selector.startsWith('[data-act') ? deletePaper : null;
  for (const fn of listeners.click) fn({ target: deletePaper, preventDefault() {} });
  assert.deepStrictEqual(entry.people.m.items, [savedItems[0]], '화면의 개별 줄 삭제는 숨은 옛 항목을 보존');
  const addPaper = { dataset: { aladd: 'm' }, value: '가|논문(SCI(E))', closest: (selector) => selector.startsWith('[data-alkey') ? card : null };
  for (const fn of listeners.change) fn({ target: addPaper });
  assert.deepStrictEqual(entry.people.m.items.map((item) => item.name), ['최종 보고서 작성', '논문(SCI(E))'], '새 개별 항목을 넣어도 숨은 저장값을 보존');
  A.decompose(A.ctxOf(P, plan, 1, U.budgetRows(P, plan, 1, st), st, {}).res, entry);
  assert.deepStrictEqual(entry.people.m.items.find((item) => item.name === '최종 보고서 작성'), savedItems[0], '자동 분해도 숨은 개별 항목의 이름·건수·가중치를 보존');
  entry.pick[name] = false;
  assert.strictEqual(itemFor('m', name).weight, 0.7, '자동 분해 후 공통 포함을 꺼도 이전 개별 입력으로 돌아감');
  changeScope(name, 'all');
  assert.deepStrictEqual(entry.groups[0].items, []);
  assert.ok(itemFor('k', name).weight === 0.5 && itemFor('m', name).weight === 0.5, '전체로 돌리면 두 연구자에게 다시 배분');
  changeScope('진도보고서 작성', 'unit:0');
  assert.deepStrictEqual(entry.groups[1], { name: '수소', people: ['k'], items: ['진도보고서 작성'] }, '부서를 고르면 해당 연구자만 복사하고 행정지원은 제외');
  changeScope('연구계획서작성(선정평가포함)', 'unit:0');
  assert.strictEqual(entry.groups.length, 2, '동일 이름·인원의 부서 그룹은 재사용');
  assert.deepStrictEqual(entry.groups[1].items, ['진도보고서 작성', '연구계획서작성(선정평가포함)']);
  entry.unions = [['수소', '자율']];
  changeScope('연구총괄 및 관리', 'unit:0');
  assert.strictEqual(entry.groups.length, 3);
  assert.deepStrictEqual(entry.groups[2].people, ['k', 'm'], '병합한 부서는 양쪽 연구자를 함께 배정');
  assert.ok(entry.groups[2].name.includes('수소') && entry.groups[2].name.includes('자율'));
  entry.groups[2].people.reverse();
  changeScope('기술문서 발간', 'unit:0');
  assert.strictEqual(entry.groups.length, 3, '같은 인원 집합이면 순서와 무관하게 병합 그룹 재사용');
  assert.ok(entry.groups[2].items.includes('기술문서 발간') && entry.pick['기술문서 발간'], '선택 항목도 그룹을 지정하면 활성화');
  changeScope('연구내용 사전조사', 'new');
  assert.deepStrictEqual(entry.groups[3], { name: '전담 그룹 1', people: [], items: ['연구내용 사전조사'] }, '새 전담 그룹은 선택한 항목을 담고 연구자를 직접 지정');
  assert.ok(!itemFor('k', '연구내용 사전조사') && !itemFor('m', '연구내용 사전조사'), '아직 구성원이 없으면 다른 연구자에게 넘어가지 않음');
  assert.ok(html().includes('연구자 선택 필요'), '빈 전담 그룹은 연구자 선택이 필요함을 화면에 표시');
  const unchanged = JSON.stringify(entry);
  for (const value of ['group:99', 'unit:99', 'unexpected']) changeScope(name, value);
  changeScope('미분류 연구내용', 'group:0');
  assert.strictEqual(JSON.stringify(entry), unchanged, '오래되거나 잘못된 선택과 미분류 연구내용은 저장을 바꾸지 않음');
  entry.groups[0].items.push(name);
  entry.groups[1].items.push('최종 보고서 작성');
  const multiBefore = JSON.stringify(entry);
  const multi = scopeSelect(html(), name);
  assert.ok(/<option\b(?=[^>]*value="multi")(?=[^>]*selected)(?=[^>]*disabled)[^>]*>/.test(multi), '기존 복수 그룹 배정은 별도 상태로 표시');
  assert.strictEqual(JSON.stringify(entry), multiBefore, '화면 렌더링은 기존 복수 배정을 변경하지 않음');
  changeScope(name, 'group:0');
  assert.deepStrictEqual(entry.groups[0].items, [name]);
  assert.ok(!entry.groups[1].items.includes('최종 보고서 작성'), '전담 그룹을 다시 고르면 옛 복수 배정을 정리');
  while (entry.groups.length < 20) entry.groups.push({ name: `그룹 ${entry.groups.length + 1}`, people: [], items: [] });
  const full = JSON.stringify(entry);
  changeScope('설계 분석', 'new');
  assert.strictEqual(JSON.stringify(entry), full, '그룹 20개 한도에서는 새 그룹을 만들거나 항목 배정을 바꾸지 않음');
  changeScope('설계 분석', 'unit:0');
  assert.ok(entry.groups.length === 20 && entry.groups[2].items.includes('설계 분석'), '한도에 도달해도 일치하는 기존 부서 그룹은 재사용');
});

test('연구내용 항목 — 평가항목 목록의 연구내용 칩(분류 전은 못 켬 · 분류되면 기본 포함 → 사람 줄에 readonly "포함"), [연구내용 분류] 는 도우미가 연결돼 있을 때만; 선택 상자·×·칩·그룹의 입력 처리(가짜 host)', () => {
  const rec = { id: 'r1', name: P.prjNm, prjNo: P.prjNo, n: 1, contents: [{ item: 'DC 차단기 설계', details: ['반도체 소자 선정', '보호 알고리즘'] }, { item: '시험 평가', details: [] }, { item: '', details: ['x'] }] };
  const st = mk({ research: { r1: rec } });
  const br = U.budgetRows(P, plan, 1, st);
  assert.deepStrictEqual(A.researchItems(A.researchOf(st, P.prjNo, 1)), [{ name: 'DC 차단기 설계', text: '반도체 소자 선정 · 보호 알고리즘' }, { name: '시험 평가', text: '' }]);
  assert.strictEqual(A.researchOf(st, P.prjNo, 2), null);
  const off = A.card(P, plan, 1, br, st, {});   // 도우미 없음(globalThis.KRX_STAFF_CHAT 없음)
  assert.ok(!off.includes('data-act="al-classify"') && off.includes('0/2 분류') && off.includes('1차년도 연구개발계획서') && pickButton(off, 'DC 차단기 설계').includes('aria-pressed="false"') && pickButton(off, 'DC 차단기 설계').includes(' disabled>') && off.includes('에이전트를 연결해 등급을 분류하세요') && !off.includes('<optgroup label="연구내용'), '연결 전: 칩은 분류 전(못 켬), 드롭다운에는 없음, 안내');
  const sent = [];
  globalThis.KRX_STAFF_CHAT = { route: () => 'server', toggle() { sent.push('open'); }, send(t) { sent.push(t); } };
  try {
    const on = A.card(P, plan, 1, br, st, {});
    assert.ok(on.includes('data-act="al-classify"') && on.includes('연구내용 분류 <small>0/2</small>') && !on.includes('연결돼 있을 때 됩니다'), '연결되면 단추');
    const key = S.planKey(P.prjNo, 1);
    st.allowCalc[key] = { people: {}, research: { 'DC 차단기 설계': '가' }, at: 1 };
    const half = A.card(P, plan, 1, br, st, {});
    assert.ok(half.includes('연구내용 분류 <small>1/2</small>') && pickButton(half, 'DC 차단기 설계').includes('aria-pressed="true"') && half.includes('data-alrl="DC 차단기 설계"') && !half.includes('<optgroup label="연구내용') && half.includes('포함 <b>4</b>') && half.includes('필수 <b>3/3</b>') && half.includes('그룹 <b>0</b>'), '매긴 항목은 기본 포함(필수 3 + 연구내용 1) — 모두에게 들어가 드롭다운에는 없음');
    assert.ok(/<div class="krext-al-pickcol" data-level="가">[\s\S]*?draggable="true" data-ritem="DC 차단기 설계"[\s\S]*?<div class="krext-al-pickcol" data-level="나">/.test(half) && /<section class="krext-al-research-picks">[\s\S]*?data-ritem="시험 평가"/.test(half) && !/<section class="krext-al-research-picks">[\s\S]*?data-ritem="DC 차단기 설계"/.test(half) && half.includes('<small>연구내용</small>'), '분류된 연구내용은 그 등급 열의 끌 수 있는 칩, 분류 전은 연구내용 구역(2026-10-21)');
    assert.ok(half.includes('</select></div><button type="button" class="krext-ico-btn krext-al-pick-x"') , '선택 항목 칩은 한 줄 — 담당 선택이 × 앞(2026-10-21); 필수 카드는 담당이 아래 줄 그대로');
    assert.ok(half.includes('value="DC 차단기 설계" placeholder="평가항목 이름" maxlength="80" title="포함 항목 — 평가항목 목록에서 포함한 항목(모든 연구자 · 가중치 1/N). 빼거나 그룹을 바꾸려면 목록에서" aria-label="김거화 평가항목 4" readonly>') && !half.includes('>포함</span>') && !half.includes('<option value="가|기타">') && half.includes('<option value="가|">기타(직접 입력)</option>'), '사람 줄에 readonly 포함 줄(필수/포함 표시), 기타는 묶음마다 직접 입력');
    // 입력 처리 — 가짜 host: 리스너를 기록하고 change·click 을 흉내 냄
    const L = {}; let draws = 0;
    const host = { addEventListener(t, fn) { (L[t] = L[t] || []).push(fn); }, contains: () => false, querySelector: () => null, querySelectorAll: () => [], ownerDocument: { activeElement: null } };
    const st2 = mk({ research: { r1: rec }, data: { projects: [P] }, staffView: { prjNo: P.prjNo, years: { [P.prjNo]: 1 }, extra: {}, inc: {}, fold: {} }, staffAliases: {} });
    st2.allowCalc[key] = { people: {}, research: { 'DC 차단기 설계': '가' }, at: 1 };
    A.bind(host, st2, () => { draws++; });
    const card = { dataset: { alkey: key } };
    const el = (dataset, value) => { const n = { dataset, value }; n.closest = (sel) => (sel.startsWith('[data-alkey') ? card : sel.startsWith('[data-act') ? n : null); return n; };
    const fire = (t, target) => { for (const fn of L[t]) fn({ target, preventDefault() {} }); };
    const rows = (id) => A.ctxOf(P, plan, 1, U.budgetRows(P, plan, 1, st2), st2, {}).res.people.find((r) => r.id === id).items.map((it) => `${it.name}${it.auto ? '*' : ''}/${it.weight}`);
    fire('change', el({ aladd: 'k' }, '가|논문(SCI(E))'));
    assert.deepStrictEqual(st2.allowCalc[key].people.k.items, [{ name: '논문(SCI(E))', level: '가', count: 1, weight: 1 }], '저장에는 고른 항목만(포함 항목은 저장하지 않음)');
    assert.deepStrictEqual(rows('k'), requiredText().concat('DC 차단기 설계*/0.5', '논문(SCI(E))/1'), '표 줄 = 필수 3 + 연구내용(1/2) + 저장');
    fire('change', el({ aladd: 'k' }, '나|'));
    assert.deepStrictEqual(st2.allowCalc[key].people.k.items[1], { name: '', level: '나', count: 1, weight: 1 }, '기타(직접 입력)는 이름이 빈 줄');
    fire('change', el({ aladd: 'k' }, '엉'));
    assert.strictEqual(st2.allowCalc[key].people.k.items.length, 2, '모양이 틀리면 무시');
    fire('change', el({ ali: 'weight', i: 'k', k: '1' }, '0.3'));
    assert.strictEqual(st2.allowCalc[key].people.k.items[0].weight, 1, '포함 줄(data-k 0~3)의 칸은 무시');
    fire('change', el({ ali: 'weight', i: 'k', k: '4' }, '0.3'));   // 포함 줄 4개(필수 3 + 연구내용) 뒤
    assert.strictEqual(st2.allowCalc[key].people.k.items[0].weight, 0.3, '칸의 data-k 는 포함 수만큼 뒤');
    fire('change', el({ ali: 'weight', i: 'm', k: '0' }, '0.3'));
    assert.strictEqual(st2.allowCalc[key].people.m, undefined, '저장이 없던 사람의 포함 줄은 빈 저장을 남기지 않음');
    fire('click', el({ act: 'al-item-del', i: 'k', k: '0' }));
    assert.strictEqual(st2.allowCalc[key].people.k.items.length, 2, '포함 항목은 × 로도 못 뺌');
    fire('click', el({ act: 'al-item-del', i: 'k', k: '4' }));
    assert.deepStrictEqual(st2.allowCalc[key].people.k.items.map((it) => it.name), [''], '고른 항목은 뺌');
    fire('click', el({ act: 'al-pick', nm: '진도보고서 작성' }));
    assert.deepStrictEqual(st2.allowCalc[key].pick, { '진도보고서 작성': false }, '필수를 누르면 꺼짐');
    assert.deepStrictEqual(rows('m'), requiredText().filter((row) => !row.startsWith('진도보고서 작성')).concat('DC 차단기 설계*/0.5'));
    fire('click', el({ act: 'al-pick', nm: '진도보고서 작성' }));
    assert.deepStrictEqual(st2.allowCalc[key].pick, { '진도보고서 작성': true }, '다시 누르면 켜짐');
    fire('click', el({ act: 'al-pick', nm: '시험 평가' }));
    assert.strictEqual(st2.allowCalc[key].pick['시험 평가'], undefined, '분류 전은 못 켬');
    fire('click', el({ act: 'al-pick', nm: '연구총괄 및 관리' }));
    assert.ok(!rows('m').includes('연구총괄 및 관리*/0.5'), '연구총괄도 기본 켜짐에서 누르면 꺼짐');
    fire('click', el({ act: 'al-pick', nm: '연구총괄 및 관리' }));
    assert.strictEqual(rows('m')[0], '연구총괄 및 관리*/0.5', '필수를 다시 켜면 모두에게');
    const dropCol = { dataset: { level: '다' }, classList: { add() {}, remove() {} }, contains: () => false, closest: (sel) => (sel.startsWith('[data-alkey') ? card : sel.startsWith('.krext-al-pickcol') ? dropCol : null) };
    for (const fn of L.drop) fn({ target: dropCol, dataTransfer: { types: ['application/x-krx-ritem'], getData: (t) => (t === 'application/x-krx-ritem' ? 'DC 차단기 설계' : '') }, preventDefault() {} });
    assert.strictEqual(st2.allowCalc[key].research['DC 차단기 설계'], '다', '연구내용 칩을 등급 열에 끌어 놓으면 그 등급(2026-10-21)');
    // 사람 칩을 다른 사람 칩 위에 놓으면 둘의 등급을 맞바꿈(2026-10-21) — S 열의 k 를 A 열의 m 칩 위에
    const colS = { dataset: { grp: 'S' } }, colA = { dataset: { grp: 'A' }, classList: { add() {}, remove() {}, contains: () => false } };
    const chipK = { dataset: { i: 'k' }, closest: (sel) => (sel === '.krext-al-col' ? colS : null) };
    const chipM = { dataset: { i: 'm' }, classList: { contains: () => false }, closest: (sel) => (sel === '.krext-al-chip' ? chipM : sel === '.krext-al-col' ? colA : null) };
    colA.closest = (sel) => (sel.startsWith('[data-alkey') ? Object.assign({ querySelector: () => chipK }, card) : sel === '.krext-al-col' ? colA : null);
    for (const fn of L.drop) fn({ target: chipM, dataTransfer: { types: [], getData: (t) => (t === 'text/plain' ? 'k' : '') }, preventDefault() {} });
    assert.deepStrictEqual([st2.allowCalc[key].people.k.rank, st2.allowCalc[key].people.m.rank], ['A', 'S'], '칩 위에 놓으면 둘의 등급을 맞바꿈');
    for (const fn of L.drop) fn({ target: chipM, dataTransfer: { types: [], getData: (t) => (t === 'text/plain' ? 'k,m' : '') }, preventDefault() {} });
    assert.deepStrictEqual([st2.allowCalc[key].people.k.rank, st2.allowCalc[key].people.m.rank], ['A', 'A'], '여럿을 끌면 열에 놓는 것과 같음');
    fire('change', el({ alrl: 'DC 차단기 설계' }, '나'));
    assert.strictEqual(st2.allowCalc[key].research['DC 차단기 설계'], '나', '칩 옆 등급 칸');
    fire('click', el({ act: 'al-group-add' }));
    fire('click', el({ act: 'al-group-person', gi: '0', i: 'm' }));
    fire('click', el({ act: 'al-group-item', gi: '0', nm: 'DC 차단기 설계' }));
    assert.deepStrictEqual(st2.allowCalc[key].groups, [{ name: '전담 그룹 1', people: ['m'], items: ['DC 차단기 설계'] }]);
    assert.deepStrictEqual([rows('k'), rows('m')], [requiredText().concat('/1'), requiredText().concat('DC 차단기 설계*/1')], '그룹 항목은 그 그룹 사람만 · 1/N 은 그룹 안');
    fire('change', el({ algname: '0' }, ' 설계팀 '));
    assert.strictEqual(st2.allowCalc[key].groups[0].name, '설계팀');
    const html = A.card(P, plan, 1, U.budgetRows(P, plan, 1, st2), st2, {});
    assert.ok(html.includes('data-act="al-group-person" data-gi="0" data-i="m" aria-pressed="true"') && html.includes('data-act="al-group-person" data-gi="0" data-i="k" aria-pressed="false"') && html.includes('data-act="al-group-item" data-gi="0" data-nm="DC 차단기 설계" aria-pressed="true"') && scopeSelect(html, 'DC 차단기 설계').includes('value="group:0" selected>설계팀 (1명)</option>') && html.includes('포함 <b>4</b>') && html.includes('그룹 <b>1</b>') && html.includes('title="포함 항목 — 평가항목 목록에서 포함한 항목(설계팀 그룹 · 가중치 1/N). 빼거나 그룹을 바꾸려면 목록에서"'), '그룹 카드의 사람·항목 칩, 담당 그룹 이름, 사람 줄의 그룹');
    fire('click', el({ act: 'al-group-person', gi: '0', i: 'm' }));
    assert.deepStrictEqual(st2.allowCalc[key].groups[0].people, [], '다시 누르면 뺌');
    fire('click', el({ act: 'al-group-del', gi: '0' }));
    assert.strictEqual(st2.allowCalc[key].groups, undefined, '마지막 그룹을 지우면 없음');
    fire('click', el({ act: 'al-classify' }));
    assert.deepStrictEqual(sent, ['open', A.CLASSIFY_ASK], '[연구내용 분류] 는 채팅을 열어 요청 글을 보냄');
    assert.ok(draws >= 10);
  } finally { delete globalThis.KRX_STAFF_CHAT; }
});
/* 2026-10-21 사용자(AIP 세션 인계) "S부터 1,2,3,4,5 등급 … 1등급에는 연구총괄, 연구계획서, 연구수행 내용(사용자), 2등급에는 설계,해석, 검증, ..지침서 …, 3등급은 제어기술, 기준/절차/가이드/알고리즘 …, 4,5 등급은 … 하나만 … 최대 3개" */
test('등급별 자동 분해(decompose) — 등급 템플릿(있는 항목·숨은 개별 저장 보존, 포함 항목 밖 3개까지), 템플릿 항목 가중치 1/N, 통합 묶음은 첫 키, [등급별 자동 분해] 단추', () => {
  const five = [P_('a', 50, { items: [{ name: '논문(SCI(E))', level: '가', count: 1, weight: 0.8 }, { name: '특허(국제)', level: '가', count: 1, weight: 1 }] }), P_('b', 40), P_('c', 30), P_('d', 20, { items: [{ name: '기준/절차/가이드라인/지침서', level: '나', count: 2, weight: 1 }] }), P_('e', 10), P_('j', 10, { role: '행정지원' })];
  const auto = A.autoItemsOf({}, null, five.filter((p) => p.role !== '행정지원').map((p) => ({ id: p.id, target: true })));
  const res = A.compute({ pool: 1000000, people: five.map((p) => Object.assign({}, p, { items: p.role === '행정지원' ? [] : auto[p.id] })) });   // 화면의 등급(참여율 순 — 포함 항목만) — 저장 항목은 entry 쪽
  assert.deepStrictEqual(res.people.map((p) => p.gradeLabel), ['S', 'A', 'B', 'C', 'D', ''], '5명 S~D');
  const entry = { people: { a: { items: [{ name: '진도보고서 작성', level: '다', count: 1, weight: 0.2 }].concat(five[0].items) }, d: { items: five[3].items.slice() } } };
  assert.strictEqual(A.decompose(res, entry), 1 + 2 + 2 + 0 + 1, 'a 의 S 템플릿은 연구총괄이 필수 포함이라 연구계획서 하나(2026-10-22 부터 필수가 아님) · d 는 이미 있어 0개');
  const names = (id) => entry.people[id].items.map((it) => `${it.name}/${it.level}/${it.weight}`);
  assert.deepStrictEqual(names('a'), ['진도보고서 작성/다/0.2', '논문(SCI(E))/가/0.8', '특허(국제)/가/1', '연구계획서작성(선정평가포함)/나/1'], 'S: 숨은 옛 필수 줄과 논문·특허 가중치는 보존, 이미 포함된 연구총괄은 중복 추가 안 함, 연구계획서는 개인 항목으로(1/1)');
  assert.deepStrictEqual(names('b'), ['설계,해석 및 검증 S/W 개발/가/1', '기준/절차/가이드라인/지침서/나/0.25'], 'A: 기준/절차는 b·c·d·e 넷이 가져 1/4');
  assert.deepStrictEqual(names('c'), ['알고리즘/제어기술 개발/나/1', '기준/절차/가이드라인/지침서/나/0.25'], 'B');
  assert.deepStrictEqual(names('d'), ['기준/절차/가이드라인/지침서/나/0.25'], 'C: 있던 항목(건수 2)은 그대로, 가중치만 1/N');
  assert.strictEqual(entry.people.d.items[0].count, 2);
  assert.deepStrictEqual(names('e'), ['기준/절차/가이드라인/지침서/나/0.25'], 'D: 하나');
  assert.ok(!entry.people.j, '행정지원은 없음');
  const after = A.compute({ pool: 1000000, people: five.map((p) => Object.assign({}, p, { items: p.role === '행정지원' ? [] : A.mergeItems(auto[p.id], (entry.people[p.id] || {}).items || []) })) });
  assert.strictEqual(after.people[0].items.filter((item) => item.name === '진도보고서 작성').length, 1, '보존한 옛 줄은 자동 포함 줄과 중복 계산되지 않음');
  assert.ok(after.people[0].items.find((item) => item.name === '진도보고서 작성').auto, '화면 계산은 공통 포함 줄을 사용');
  assert.ok(!A.checks(after).some((w) => w.text.includes('가중치 합')), '넣은 뒤 가중치 합 알림 없음');
  assert.deepStrictEqual(after.people.slice(0, 5).map((p) => p.gradeLabel), ['S', 'A', 'B', 'C', 'D'], '등급 차례 유지');
  const merged = A.compute({ pool: 1000000, merge: { sa: true, cd: true }, people: five.slice(0, 5).map((p) => Object.assign({}, p, { items: [] })) }), e2 = { people: {}, pick: Object.fromEntries(requiredNames.map((name) => [name, false])) };
  A.decompose(merged, e2);
  assert.deepStrictEqual([e2.people.b.items[0].name, e2.people.e.items[0].name, e2.people.e.items.length], ['연구총괄 및 관리', '기준/절차/가이드라인/지침서', 1], '공통 포함을 끈 경우 S+A 는 S 템플릿, C+D 는 C 템플릿');
  const hiddenTemplate = { name: '연구 총괄 및 관리', level: '가', count: 2, weight: 0.7 };
  const scoped = { people: { a: { items: [{ ...hiddenTemplate }] } }, pick: { '연구계획서작성(선정평가포함)': true }, groups: [{ name: '계획 전담', people: ['b'], items: ['연구총괄 및 관리', '연구계획서작성(선정평가포함)'] }] };
  const scopedAuto = A.autoItemsOf(scoped, null, [{ id: 'a', target: true }, { id: 'b', target: true }]);
  const scopedRes = A.compute({ pool: 1000000, people: [P_('a', 30, { rank: 'S', items: scopedAuto.a }), P_('b', 20, { rank: 'A', items: scopedAuto.b })] });
  A.decompose(scopedRes, scoped);
  assert.deepStrictEqual(scoped.people.a.items, [hiddenTemplate], 'S 템플릿이어도 다른 전담 그룹의 공통 항목을 추가하지 않고 숨은 원래 가중치도 보존');
  // 단추·처리(가짜 host)
  const st = mk({ data: { projects: [P] }, staffView: { prjNo: P.prjNo, years: { [P.prjNo]: 1 }, extra: {}, inc: {}, fold: {} }, staffAliases: {} });
  assert.ok(A.card(P, plan, 1, U.budgetRows(P, plan, 1, st), st, {}).includes('data-act="al-decompose" title="지금 평가등급대로 기본 성과 항목을 넣습니다'));
  const L = {}; const host = { addEventListener(t, fn) { (L[t] = L[t] || []).push(fn); }, contains: () => false, querySelector: () => null, querySelectorAll: () => [], ownerDocument: { activeElement: null } };
  A.bind(host, st, () => {});
  const key = S.planKey(P.prjNo, 1), card = { dataset: { alkey: key } }, btn = { dataset: { act: 'al-decompose' } }; btn.closest = (sel) => (sel.startsWith('[data-alkey') ? card : sel.startsWith('[data-act') ? btn : null);
  for (const fn of L.click) fn({ target: btn, preventDefault() {} });
  assert.deepStrictEqual(st.allowCalc[key].people.k.items.map((it) => it.name), ['연구계획서작성(선정평가포함)'], '김거화 S — 연구총괄은 필수라 저장 밖, 연구계획서는 개인 항목');
  assert.deepStrictEqual(st.allowCalc[key].people.m.items.map((it) => [it.name, it.weight]), [['설계,해석 및 검증 S/W 개발', 1], ['기준/절차/가이드라인/지침서', 1]], '문창재 A');
  assert.ok(st.allowMsg && st.allowMsg.key === key && st.allowMsg.text.startsWith('등급별 기본 성과 항목 3개를 넣었습니다'));
  const researchNames = ['회로 설계', '보호 방식 검증', '실증 시험'];
  const hiddenResearch = researchNames.map((name, i) => ({ name, level: '나', count: i + 1, weight: (i + 1) / 10 }));
  st.research = { r1: { id: 'r1', prjNo: P.prjNo, n: 1, contents: researchNames.map((item) => ({ item, details: [] })) } };
  st.allowCalc[key] = { people: { k: { rank: 'S' }, m: { rank: 'B', items: hiddenResearch.map((item) => ({ ...item })) } }, research: Object.fromEntries(researchNames.map((name) => [name, '나'])), groups: [{ name: '실증 전담', people: ['k'], items: researchNames }], at: 1 };
  const beforeResearch = A.ctxOf(P, plan, 1, U.budgetRows(P, plan, 1, st), st, {}).res;
  assert.ok(byId(beforeResearch, 'm').gradeLabel === 'B' && !byId(beforeResearch, 'm').items.some((item) => researchNames.includes(item.name)), 'B 연구자에게 옛 연구내용 3개가 저장됐지만 현재 다른 전담 그룹에 속해 숨겨짐');
  for (const fn of L.click) fn({ target: btn, preventDefault() {} });
  assert.deepStrictEqual(st.allowCalc[key].people.m.items.slice(0, 3), hiddenResearch, '자동 분해가 다른 전담 그룹의 연구내용 원본을 보존');
  assert.deepStrictEqual(st.allowCalc[key].people.m.items.slice(3).map((item) => item.name), ['알고리즘/제어기술 개발', '기준/절차/가이드라인/지침서'], '숨은 연구내용 3개는 개인 항목 최대 3개 한도를 소모하지 않아 B 템플릿을 추가');
});
test('1. 일반 정보는 접히는 상자 — 기본 접힘, 요약 줄에 과제명·계상·집행 가능액, 펼침은 state.allowUi[key].general', () => {
  const st = mk(), br = U.budgetRows(P, plan, 1, st);
  const html = A.card(P, plan, 1, br, st, {});
  assert.ok(html.includes('<details class="krext-al-section krext-al-general-wrap" data-al-disclosure="general"><summary class="krext-al-h">1. 일반 정보 <small>MW급 10kV 고전압 직류 시스템용 반도체 차단기 개발 · 계상 6,000천원 · 집행 가능액 5,000천원</small></summary><dl class="krext-al-general">') && html.includes('</dl></details>') && !html.includes('<h4 class="krext-al-h">1. 일반 정보</h4>'), '기본 접힘');
  const st2 = mk({ allowUi: { [S.planKey(P.prjNo, 1)]: { general: true } } });
  assert.ok(A.card(P, plan, 1, U.budgetRows(P, plan, 1, st2), st2, {}).includes('data-al-disclosure="general" open><summary'), '펼침 유지');
  assert.ok(A.card(P, null, 1, U.budgetRows(P, null, 1, mk({ staffPlans: {} })), mk({ staffPlans: {} }), {}).includes('data-al-disclosure="general"><summary'), '계획이 없어도');
});

/* 2026-10-21 사용자 "등급배정에서 1개 이상 드래그로 옮길 수 있게 해줘" */
test('등급 칸 칩 고르기(여럿 끌기) — state.allowSel[key] 의 칩은 krext-al-chip-sel · aria-pressed, 확정된 칩은 고를 수 없음', () => {
  const st = mk({ allowSel: { [S.planKey(P.prjNo, 1)]: ['k'] } });
  const html = A.card(P, plan, 1, U.budgetRows(P, plan, 1, st), st, {});
  assert.ok(html.includes('<div class="krext-al-chip krext-al-chip-sel" draggable="true" data-i="k" aria-pressed="true" title="김거화') && html.includes('<div class="krext-al-chip" draggable="true" data-i="m" aria-pressed="false" title="문창재') && html.includes('이름을 누르면 골라져 여럿을 한꺼번에 끌 수 있습니다'), html.match(/<div class="krext-al-chip[^>]*>/g).join('\n'));
  const erp = { at: 1, busy: false, members: { '김거화': { dept: '수소전기추진연구팀', pos: 'P2' }, '문창재': { dept: '자율운항연구팀', pos: 'P3' } }, error: '' };
  const st2 = mk({ allowErp: { [P.prjNo]: erp }, allowSel: { [S.planKey(P.prjNo, 1)]: ['m'] }, allowCalc: { [S.planKey(P.prjNo, 1)]: { byDept: true, depts: { '자율운항연구팀': { done: true } }, at: 1 } }, allowDept: { [S.planKey(P.prjNo, 1)]: '자율운항연구팀' } });
  assert.ok(A.card(P, plan, 1, U.budgetRows(P, plan, 1, st2), st2, {}).includes('<div class="krext-al-chip krext-al-locked krext-al-chip-sel" draggable="false" data-i="m" title="문창재'), '확정된 칩은 aria-pressed 없음(끌 수 없음)');
});
test('평가항목 목록 — 칩(기본은 지침 ITEMS, 필수 칩은 켜짐·× 없음), 칸 아래 입력(data-alnew)이 entry.items 에 더하고 칩의 ×(al-pick-del)가 빼며 [지침 기본값] 이 되돌림, normalize 가 지킴', () => {
  const st = mk({});
  const html0 = A.card(P, plan, 1, U.budgetRows(P, plan, 1, st), st, {});
  assert.ok(html0.includes('data-al-disclosure="itemlist" open') && html0.includes('포함 <b>3</b>') && html0.includes('필수 <b>3/3</b>') && html0.includes('가중치 합 <b>1</b>') && !html0.includes('krext-al-stat-warn') && !html0.includes('krext-al-pick-wbad') && html0.includes('<option value="가|기술문서 발간">기술문서 발간</option>') && pickButton(html0, '기술문서 발간').includes('aria-pressed="false"') && html0.includes('data-act="al-pick-del" data-nm="기술문서 발간"') && html0.includes('data-alnew="가"') && html0.includes('data-act="al-pick-add" data-level="가"') && html0.includes('data-act="al-group-add"') && html0.includes('data-act="al-items-default" title="지침 1) 의 기본 목록으로 되돌림(포함·그룹은 그대로)" disabled') && !html0.includes('data-alitems='), html0.slice(html0.indexOf('krext-al-itemlist'), html0.indexOf('krext-al-itemlist') + 700));
  for (const [name, level] of REQUIRED) {
    const button = pickButton(html0, name);
    assert.ok(button.includes('aria-pressed="true"') && button.includes(`aria-label="${name} · 필수 · ${level} ${A.LEVELS[level]}점"`) && !html0.includes(`data-act="al-pick-del" data-nm="${name}"`), `${name}: 필수 3개 모두 선택 · 난이도 표시 · 삭제 없음`);
    assert.strictEqual((html0.match(/<button\b[^>]*>/g) || []).filter((tag) => tag.includes('data-act="al-pick"') && tag.includes(`data-nm="${name}"`)).length, 1, `${name}: 필수와 선택 구역에 중복되지 않음`);
  }
  const optionalAt = html0.indexOf('class="krext-al-optional"'), groupsAt = html0.indexOf('class="krext-al-groups-h"');
  const [rn, rl] = REQUIRED[0], rx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.ok(!html0.includes('class="krext-al-required"') && !html0.includes('krext-al-pickwrap-required') && new RegExp(`<div class="krext-al-pickcol" data-level="${rl}">[\\s\\S]*?data-nm="${rx(rn)}" aria-pressed="true"[\\s\\S]*?<small class="krext-al-pick-required-tag">필수</small>`).test(html0) && optionalAt > 0 && groupsAt > optionalAt, '필수는 따로 나누지 않고 그 등급 열에 기본 체크(필수 꼬리표) → 적용 그룹(2026-10-21)');
  const closed = mk({ allowUi: { [S.planKey(P.prjNo, 1)]: { itemlist: false } } });
  assert.ok(A.card(P, plan, 1, U.budgetRows(P, plan, 1, closed), closed, {}).includes('data-al-disclosure="itemlist"><summary>'), '사용자가 접은 상태는 유지');
  assert.strictEqual(A.itemsOf({}), A.ITEMS);
  assert.deepStrictEqual(A.parseItems(' 디지털 트윈 \n\n디지털 트윈\n기타 '), ['디지털 트윈', '기타']);
  const L = {}; const host = { addEventListener(t, fn) { (L[t] = L[t] || []).push(fn); }, contains: () => false, querySelector: () => null, querySelectorAll: () => [], ownerDocument: { activeElement: null } };
  A.bind(host, st, () => {});
  const key = S.planKey(P.prjNo, 1), card = { dataset: { alkey: key } };
  const el = (dataset, value) => { const n = { dataset, value }; n.closest = (sel) => (sel.startsWith('[data-alkey') ? card : sel.startsWith('[data-act') ? n : null); return n; };
  const fire = (t, target) => { for (const fn of L[t]) fn({ target, preventDefault() {} }); };
  const inp = el({ alnew: '가' }, ' 디지털 트윈 모델 개발 ');
  fire('change', inp);
  assert.deepStrictEqual(st.allowCalc[key].items, { '가': A.ITEMS['가'].concat('디지털 트윈 모델 개발'), '나': A.ITEMS['나'].slice(), '다': A.ITEMS['다'].slice() }, '그 등급에 다듬어 더함');
  assert.strictEqual(inp.value, '', '입력은 비움');
  fire('change', el({ alnew: '가' }, '디지털 트윈 모델 개발'));
  assert.strictEqual(st.allowCalc[key].items['가'].length, 9, '같은 이름은 안 더함');
  fire('change', el({ alnew: '엉' }, '무엇'));
  assert.strictEqual(st.allowCalc[key].items['가'].length, 9, '모르는 등급은 무시');
  fire('click', el({ act: 'al-pick-del', nm: '기술문서 발간' }));
  assert.ok(!st.allowCalc[key].items['가'].includes('기술문서 발간') && st.allowCalc[key].items['가'].length === 8, '× 는 목록에서 뺌');
  const html1 = A.card(P, plan, 1, U.budgetRows(P, plan, 1, st), st, {});
  assert.ok(html1.includes('<option value="가|디지털 트윈 모델 개발">디지털 트윈 모델 개발</option>') && !html1.includes('기술문서 발간</option>') && pickButton(html1, '디지털 트윈 모델 개발').includes('aria-pressed="false"') && html1.includes('사용자 편집 목록') && html1.includes('data-act="al-items-default" title="지침 1) 의 기본 목록으로 되돌림(포함·그룹은 그대로)">지침 기본값'));
  const beforeProtectedDelete = JSON.stringify(st.allowCalc[key]);
  for (const name of requiredNames.concat(requiredNames.map((name) => ` ${name.replace(/ /g, '')} `))) fire('click', el({ act: 'al-pick-del', nm: name }));
  assert.strictEqual(JSON.stringify(st.allowCalc[key]), beforeProtectedDelete, '필수 5개는 canonical/띄어쓰기 변형 모두 목록 삭제를 거절');
  const enterInput = el({ alnew: '나' }, ' 입력 중인 한글 ');
  enterInput.dispatchEvent = (event) => fire(event.type, enterInput);
  let prevented = 0;
  for (const fn of L.keydown) fn({ target: enterInput, key: 'Enter', isComposing: true, preventDefault() { prevented++; } });
  assert.ok(!st.allowCalc[key].items['나'].includes('입력 중인 한글') && prevented === 0, '한글 조합 중 Enter 는 항목을 추가하지 않음');
  enterInput.value = ' 검증 기준서 ';
  for (const fn of L.keydown) fn({ target: enterInput, key: 'Enter', isComposing: false, preventDefault() { prevented++; } });
  assert.ok(st.allowCalc[key].items['나'].includes('검증 기준서') && enterInput.value === '' && prevented === 1, 'Enter 로 새 항목을 추가하고 입력 비움');
  const buttonInput = el({ alnew: '다' }, ' 사내 발표 ');
  let focused = false;
  buttonInput.dispatchEvent = (event) => fire(event.type, buttonInput);
  buttonInput.focus = () => { focused = true; };
  const addButton = el({ act: 'al-pick-add', level: '다' });
  const closest = addButton.closest;
  addButton.closest = (selector) => selector === '.krext-al-pickcol' ? { querySelector: () => buttonInput } : closest(selector);
  fire('click', addButton);
  assert.ok(st.allowCalc[key].items['다'].includes('사내 발표') && buttonInput.value === '' && focused, '추가 버튼은 같은 등급 입력을 저장하고 다시 입력에 초점');
  assert.deepStrictEqual(A.normalize({ [key]: { items: { '가': ['a', ' a ', ''], '나': [], '다': ['b'] }, at: 1 } })[key].items, { '가': ['a'], '나': [], '다': ['b'] });
  assert.strictEqual(A.normalize({ [key]: { items: { '가': ['a'] }, at: 1 } })[key].items, undefined, '세 묶음이 다 있어야 목록');
  fire('click', el({ act: 'al-items-default' }));
  assert.ok(!st.allowCalc[key].items && st.allowMsg.text.startsWith('평가항목 목록을 지침 기본값'));
});

/* 2026-10-21 밤 사용자 "접어줘. 기본적인 설명은 필요 없음, 필요한 경우 아이콘으로 지침 내용을 알려줘" */
test('설명 문단 대신 ⓘ 툴팁 — 2·3 절 제목·필수/선택 항목·적용 그룹 머리·등급 통합 요약 줄, 판의 안내 문단 없음; 등급 통합·비율 조정은 조정이 있어도 기본 접힘(요약 줄에 지금 설정)', () => {
  const key = S.planKey(P.prjNo, 1);
  const st = mk({ allowCalc: { [key]: { adjust: { S: 1, A: -1 }, people: {}, at: 1 } } });
  const html = A.card(P, plan, 1, U.budgetRows(P, plan, 1, st), st, {});
  assert.ok(html.includes('data-al-disclosure="settings"><summary>등급 통합·비율 조정 <small>S +1%p · A -1%p</small><span class="krext-al-info"'), html.slice(html.indexOf('krext-al-settings'), html.indexOf('krext-al-settings') + 200));
  assert.strictEqual((html.match(/class="krext-al-info"/g) || []).length, 5, '2 절 · 3 절 · 등급별 항목 · 적용 그룹 · 등급 통합(연구내용은 계획서가 있을 때만; 필수 구역은 2026-10-21 에 없앰)');
  assert.ok(html.includes('2. 등급 배정·지급 내역 <small>별지 2 · 연구수당 지급 내역서</small><span class="krext-al-info" tabindex="0" role="note" aria-label="별지 1 주석 5) 평가등급은') && html.includes('이름을 누르면 골라져 여럿을 한꺼번에 끌 수 있습니다') && !html.includes('krext-al-boardhead') && !html.includes('<p class="krext-al-caption">등급을 선택하거나') && !html.includes('<p class="krext-al-caption">연구원별') && !html.includes('<h4>선택 항목</h4><p>') && !html.includes('krext-al-group-empty'), '안내 문단 없음');
  const st2 = mk({ allowCalc: { [key]: { adjust: { S: 1 }, people: {}, at: 1 } }, allowUi: { [key]: { settings: true } } });
  assert.ok(A.card(P, plan, 1, U.budgetRows(P, plan, 1, st2), st2, {}).includes('data-al-disclosure="settings" open><summary>'), '펼친 상태는 ui.settings');
});

console.log(`\n${n} passed, ${failed} failed`);
