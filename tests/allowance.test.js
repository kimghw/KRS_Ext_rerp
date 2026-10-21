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
  assert.ok(html.includes('data-alp="grade" data-i="k" value="P2"') && html.includes('data-aladd="k"') && html.includes('<optgroup label="가 (50점)">') && html.includes('<option value="가|연구총괄 및 관리">연구총괄 및 관리</option>') && html.includes('<option value="나|">기타(직접 입력)</option>') && !html.includes('<option value="다|진도보고서 작성">') && !html.includes('연구내용 (') && html.includes('data-alp="etc" data-i="m"') && html.includes('<b>S</b>') && html.includes('<b>A</b>'), '별지 1 — 선택 상자(가·나·다 묶음, 필수 항목은 옵션에 없음, 연구내용 묶음은 도우미 연결 때만)');
  assert.ok(html.includes('krext-al-item krext-al-item-req" data-k="0"><input type="text" class="krext-st-in krext-al-in krext-al-item-nm" data-ali="name" data-i="k" data-k="0" value="연구내용 사전조사"') && html.includes('data-ali="name" data-i="k" data-k="1" value="진도보고서 작성"') && html.includes('data-ali="weight" data-i="k" data-k="0" value="0.5"') && html.includes('>필수</span>') && !html.includes('data-act="al-item-del" data-i="k" data-k="0"') && !html.includes('data-act="al-classify"'), '필수 항목 두 줄(다 · 가중치 1/2 · × 없음)');
  assert.ok(html.includes('data-al="merge-sa" disabled') && html.includes('data-alp="out" data-i="m"') && html.includes('<strong>3,000,000</strong>') && html.includes('S 60% (1명 · 1인 60.00%)'), '별지 2 — 5명 미만이라 통합 꺼짐(2명: S 60 · A 40)');
  assert.ok(!html.includes('krext-al-row krext-al-off') && !html.includes('조주희'), '행정지원은 표에 없음');
  assert.ok(html.includes('data-act="al-docx"') && html.includes('>DOCX 내려받기</button>') && html.includes('data-act="al-reset" title="이 과제 1차년도 의 일반 정보·성과 항목·기타·등급 배정·조정·부서별·미지급을 지우고 기본값으로" disabled'));
  assert.ok(A.checks(c.res).some((x) => x.text.startsWith('김거화: 지급액 3,000천원이 남은 연구수당 2,500천원(HR)을 넘습니다')) && A.checks(c.res).some((x) => x.text.startsWith('문창재: 지급액 2,000천원이 남은 연구수당 1,500천원(응답)')));
  // 저장된 항목·기타·미지급·직접 금액이 칸에
  const st2 = mk({ allowCalc: { [S.planKey(P.prjNo, 1)]: { pool: 4000000, org: 'KR', people: { k: { dept: '연구본부', items: [{ name: '연구총괄 및 관리', level: '가', count: 1, weight: 1 }], etc: 100 }, m: { out: true, note: '휴직' } }, at: 1 } } });
  const c2 = A.ctxOf(P, plan, 1, U.budgetRows(P, plan, 1, st2), st2, { me: '김거화', hr: null });
  assert.deepStrictEqual([c2.pool, c2.avail, c2.org, c2.res.n, byId(c2.res, 'k').amt, byId(c2.res, 'm').reason], [4000000, 5000000, 'KR', 1, 5000000, '휴직'], '계상 직접 4,000 이어도 집행 가능액은 예산 줄 잔액 5,000(직접 적지 않음)');
  const html2 = A.card(P, plan, 1, U.budgetRows(P, plan, 1, st2), st2, {});
  assert.ok(html2.includes('data-ali="name" data-i="k" data-k="2" value="연구총괄 및 관리"') && html2.includes('data-act="al-item-del" data-i="k" data-k="2"') && html2.includes('<option value="100" selected>우수 100</option>') && html2.includes('data-alp="out" data-i="m" checked') && html2.includes('placeholder="미지급 사유"') && html2.includes('data-al="org" value="KR"'));
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
test('복사 글과 Word 문서 모형 — 별지 1 표(항목 줄 · 계)와 별지 2 표, docx 로 만들어짐', () => {
  const st = mk({ allowCalc: { [S.planKey(P.prjNo, 1)]: { people: { k: { dept: '연구본부', grade: 'P2', items: [{ name: '연구총괄 및 관리', level: '가', count: 1, weight: 1 }, { name: '논문(SCI(E))', level: '가', count: 1, weight: 0.8 }], etc: 100 }, m: { grade: 'P1', etc: 75 } }, at: 1 } } });
  const c = A.ctxOf(P, plan, 1, U.budgetRows(P, plan, 1, st), st, {});
  const t = A.tsv(c).split('\n');
  assert.ok(t[0].startsWith('[별지 1] 연구수행 기여도 평가서\tMW급') && t[1].startsWith('부서명\t성명\t직급\t참여율(%)') && t[2].startsWith('연구본부\t김거화\tP2\t') && t[2].includes('\t연구내용 사전조사\t다\t1\t0.5\t5\t') && t[5].startsWith('연구본부\t\t\t\t\t논문(SCI(E))\t가\t1\t0.8\t40\t') && t[6].includes('문창재') && t[8].startsWith('계\t\t\t\t100'), t.slice(0, 9).join('\n'));
  assert.ok(t.some((l) => l.startsWith('[별지 2] 연구수당 지급 내역서')) && t[t.length - 1].startsWith('계\t\t\t\t\t\t100\t5,000,000'), t[t.length - 1]);
  const doc = A.docOf(c);
  const tables = doc.blocks.filter((b) => b.type === 'table');
  assert.strictEqual(tables.length, 4, '별지 1 일반·평가, 별지 2 일반·지급');
  assert.deepStrictEqual([tables[1].rows.length, tables[1].widths.length, tables[3].rows.length], [2 + 4 + 2 + 1, 15, 1 + 2 + 1], '평가 표: 머리 2 + 김거화 항목 4줄(필수 2 + 2) + 문창재 2줄(필수) + 계');
  assert.ok(tables[1].rows[2][1].rowSpan === 4 && tables[1].rows[3][1].skip && tables[1].rows[2][5].text === '연구내용 사전조사' && tables[1].rows[4][5].text === '연구총괄 및 관리' && tables[3].rows[1][7].text === '3,000,000');
  assert.ok(tables[1].rows[0][11].text === '기타<sup>3)</sup>\n(10%)' && tables[1].rows[8][5].hatch && tables[1].rows[8][5].colSpan === 4 && tables[1].rows[8][14].hatch && tables[3].rows[0][3].text === '기여도<sup>1)</sup>' && tables[3].rows[3][3].hatch && tables[3].rows[3][3].colSpan === 3 && tables[3].rows[3][8].hatch, '양식대로 주석 번호 위첨자 · 계 줄 빗금 칸');
  assert.strictEqual(A.fileName(c), '연구수당_2026-0063-01_1차년도.docx');
  const bytes = D.build(doc);
  const ents = D.entries(bytes);
  assert.ok(ents.every((e) => e.ok) && ents.some((e) => e.name === 'word/document.xml'));
  const xml = ents.find((e) => e.name === 'word/document.xml').data;
  assert.ok(xml.includes('>연구수행 기여도 평가서</w:t>') && xml.includes('>김거화</w:t>') && xml.includes('<w:pageBreakBefore/><w:spacing w:before="0" w:after="60"/></w:pPr><w:r><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t xml:space="preserve">별지 2</w:t>') && (xml.match(/<w:tblHeader\/>/g) || []).length === 5 && xml.includes('>연구수당 지급 내역서</w:t>') && xml.includes('<w:vMerge w:val="restart"/>') && xml.includes('<w:vertAlign w:val="superscript"/></w:rPr><w:t xml:space="preserve">3)</w:t>') && xml.includes('w:val="thinDiagStripe"') && xml.includes('w:orient="landscape"'));
  const dir = process.env.KRX_TEST_OUT; if (dir) require('fs').writeFileSync(path.join(dir, A.fileName(c)), bytes);   // 바깥 검사(XSD · Word)용
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
/* 2026-10-21 사용자 "평가항목에 대해서 사용자가 선택할 수 있는 옵션을 제공하고 … 연구내용 사전조사, 진도보고서 작성은 필수로 … 연구개발 보고서의 차년도 상위 연구 항목들에 대해서도 가등급 또는 나등급으로 … 에이전트가 연결된 경우만" */
test('필수 항목(ensureRequired) — 모든 연구자 앞에 다 등급 · 가중치 1/N, 있으면 그대로; 가중치 합 알림(논문·특허 제외); 저장 모양의 research', () => {
  assert.deepStrictEqual(A.ensureRequired([], 4), [{ name: '연구내용 사전조사', level: '다', count: 1, weight: 0.25 }, { name: '진도보고서 작성', level: '다', count: 1, weight: 0.25 }]);
  assert.deepStrictEqual(A.ensureRequired([{ name: '진도 보고서 작성', level: '나', count: 2, weight: 1 }, { name: '논문(SCI(E))', level: '가', count: 1, weight: 0.8 }], 0).map((it) => [it.name, it.weight]), [['연구내용 사전조사', 1], ['진도 보고서 작성', 1], ['논문(SCI(E))', 0.8]], '띄어쓰기가 달라도 같은 항목, n 0 은 1');
  assert.ok(A.isRequired('진도보고서 작성') && A.isRequired(' 연구내용사전조사') && !A.isRequired('기타'));
  assert.deepStrictEqual([A.ensureRequired([], 3)[0].weight, A.ensureRequired([], 7)[1].weight], [0.3333, 0.1429], '소수 4자리');
  const three = A.compute({ pool: 1000000, people: [1, 2, 3].map((i) => P_('p' + i, 30, { items: A.ensureRequired([], 3) })) });
  assert.ok(!A.checks(three).some((w) => w.text.includes('가중치 합')), '1/3 × 3 의 반올림 오차는 알림 없음');
  const ok = A.compute({ pool: 1000000, people: [P_('x', 50, { items: [{ name: '최종보고서 작성', level: '가', count: 1, weight: 0.6 }, { name: '논문(SCI(E))', level: '가', count: 1, weight: 0.8 }] }), P_('y', 50, { items: [{ name: '최종보고서 작성', level: '가', count: 1, weight: 0.4 }, { name: '특허(국제)', level: '가', count: 1, weight: 0.6 }] })] });
  assert.ok(!A.checks(ok).some((w) => w.text.includes('가중치 합')), '0.6 + 0.4 = 1 · 논문·특허는 안 봄');
  const bad = A.compute({ pool: 1000000, people: [P_('x', 50, { items: [{ name: '최종보고서 작성', level: '가', count: 1, weight: 0.6 }] }), P_('y', 50, { items: [{ name: '최종 보고서 작성', level: '가', count: 1, weight: 0.6 }, { name: '진도보고서 작성', level: '다', count: 1, weight: 0.5 }] })] });
  assert.ok(A.checks(bad).some((w) => w.level === 'warn' && w.text.startsWith('참여연구원간 가중치 합이 1 이 아닌 항목: 최종보고서 작성(1.2), 진도보고서 작성(0.5) — 논문·특허를 뺀')), A.checks(bad).map((w) => w.text).join('\n'));
  assert.deepStrictEqual(A.normalize({ k: { research: { 'DC 차단기 설계': '가', ' 시험 평가 ': '나', x: '엉', '': '가' }, at: 1 } }).k.research, { 'DC 차단기 설계': '가', '시험 평가': '나' });
  assert.strictEqual(A.normalize({ k: { research: {}, at: 1 } }).k.research, undefined);
});
test('연구내용 항목 — 도우미가 연결돼 있을 때만 ＋ 항목 추가의 연구내용 묶음(분류 전은 고를 수 없음)과 [연구내용 분류]; 선택 상자·×·분류 단추의 입력 처리(가짜 host)', async () => {
  const rec = { id: 'r1', name: P.prjNm, prjNo: P.prjNo, n: 1, contents: [{ item: 'DC 차단기 설계', details: ['반도체 소자 선정', '보호 알고리즘'] }, { item: '시험 평가', details: [] }, { item: '', details: ['x'] }] };
  const st = mk({ research: { r1: rec } });
  const br = U.budgetRows(P, plan, 1, st);
  assert.deepStrictEqual(A.researchItems(A.researchOf(st, P.prjNo, 1)), [{ name: 'DC 차단기 설계', text: '반도체 소자 선정 · 보호 알고리즘' }, { name: '시험 평가', text: '' }]);
  assert.strictEqual(A.researchOf(st, P.prjNo, 2), null);
  const off = A.card(P, plan, 1, br, st, {});   // 도우미 없음(globalThis.KRX_STAFF_CHAT 없음)
  assert.ok(!off.includes('data-act="al-classify"') && !off.includes('연구내용 (1차년도') && off.includes('연구수당 도우미(에이전트)가 연결돼 있을 때 ＋ 항목 추가에 나옵니다'), '연결 전에는 안내만');
  const sent = [];
  globalThis.KRX_STAFF_CHAT = { route: () => 'server', toggle() { sent.push('open'); }, send(t) { sent.push(t); } };
  try {
    const on = A.card(P, plan, 1, br, st, {});
    assert.ok(on.includes('data-act="al-classify"') && on.includes('연구내용 분류 <small>0/2</small>') && on.includes('<optgroup label="연구내용 (1차년도 연구개발계획서 — [연구내용 분류] 로 등급을 매기세요)">') && on.includes('<option value="" disabled>(분류 전) DC 차단기 설계</option>') && !on.includes('연결돼 있을 때 ＋ 항목 추가에 나옵니다'), '연결되면 묶음(분류 전)과 단추');
    st.allowCalc[S.planKey(P.prjNo, 1)] = { people: {}, research: { 'DC 차단기 설계': '가' }, at: 1 };
    const half = A.card(P, plan, 1, br, st, {});
    assert.ok(half.includes('연구내용 분류 <small>1/2</small>') && half.includes('<option value="가|DC 차단기 설계">가 DC 차단기 설계</option>') && half.includes('<option value="" disabled>(분류 전) 시험 평가</option>'), '매긴 항목은 등급과 함께 고를 수 있음');
    // 입력 처리 — 가짜 host: 리스너를 기록하고 change·click 을 흉내 냄
    const L = {}; let draws = 0;
    const host = { addEventListener(t, fn) { (L[t] = L[t] || []).push(fn); }, contains: () => false, querySelector: () => null, querySelectorAll: () => [], ownerDocument: { activeElement: null } };
    const st2 = mk({ research: { r1: rec }, data: { projects: [P] }, staffView: { prjNo: P.prjNo, years: { [P.prjNo]: 1 }, extra: {}, inc: {}, fold: {} }, staffAliases: {} });
    A.bind(host, st2, () => { draws++; });
    const key = S.planKey(P.prjNo, 1), card = { dataset: { alkey: key } };
    const el = (dataset, value) => { const n = { dataset, value }; n.closest = (sel) => (sel.startsWith('[data-alkey') ? card : sel.startsWith('[data-act') ? n : null); return n; };
    const fire = (t, target) => { for (const fn of L[t]) fn({ target, preventDefault() {} }); };
    fire('change', el({ aladd: 'k' }, '가|DC 차단기 설계'));
    let items = st2.allowCalc[key].people.k.items;
    assert.deepStrictEqual(items.map((it) => [it.name, it.level, it.weight]), [['연구내용 사전조사', '다', 0.5], ['진도보고서 작성', '다', 0.5], ['DC 차단기 설계', '가', 1]], '고르면 필수 둘 뒤에 그 등급으로');
    fire('change', el({ aladd: 'k' }, '나|'));
    assert.deepStrictEqual(st2.allowCalc[key].people.k.items[3], { name: '', level: '나', count: 1, weight: 1 }, '기타(직접 입력)는 이름이 빈 줄');
    fire('change', el({ aladd: 'k' }, '엉'));
    assert.strictEqual(st2.allowCalc[key].people.k.items.length, 4, '모양이 틀리면 무시');
    fire('change', el({ ali: 'weight', i: 'm', k: '1' }, '0.3'));
    assert.deepStrictEqual(st2.allowCalc[key].people.m.items.map((it) => [it.name, it.weight]), [['연구내용 사전조사', 0.5], ['진도보고서 작성', 0.3]], '저장이 없던 사람의 칸도 필수 줄의 index 로');
    fire('click', el({ act: 'al-item-del', i: 'k', k: '0' }));
    assert.strictEqual(st2.allowCalc[key].people.k.items.length, 4, '필수 항목은 × 로도 못 뺌');
    fire('click', el({ act: 'al-item-del', i: 'k', k: '2' }));
    assert.deepStrictEqual(st2.allowCalc[key].people.k.items.map((it) => it.name), ['연구내용 사전조사', '진도보고서 작성', ''], '고른 항목은 뺌');
    fire('click', el({ act: 'al-classify' }));
    assert.deepStrictEqual(sent, ['open', A.CLASSIFY_ASK], '[연구내용 분류] 는 채팅을 열어 요청 글을 보냄');
    assert.ok(draws >= 4);
  } finally { delete globalThis.KRX_STAFF_CHAT; }
});
/* 2026-10-21 사용자(AIP 세션 인계) "S부터 1,2,3,4,5 등급 … 1등급에는 연구총괄, 연구계획서, 연구수행 내용(사용자), 2등급에는 설계,해석, 검증, ..지침서 …, 3등급은 제어기술, 기준/절차/가이드/알고리즘 …, 4,5 등급은 … 하나만 … 최대 3개" */
test('등급별 자동 분해(decompose) — 등급 템플릿(있는 항목·필수는 그대로, 필수 밖 3개까지), 템플릿·필수 항목 가중치 1/N, 통합 묶음은 첫 키, [등급별 자동 분해] 단추', () => {
  const five = [P_('a', 50, { items: [{ name: '논문(SCI(E))', level: '가', count: 1, weight: 0.8 }, { name: '특허(국제)', level: '가', count: 1, weight: 1 }] }), P_('b', 40), P_('c', 30), P_('d', 20, { items: [{ name: '기준/절차/가이드라인/지침서', level: '나', count: 2, weight: 1 }] }), P_('e', 10), P_('j', 10, { role: '행정지원' })];
  const res = A.compute({ pool: 1000000, people: five.map((p) => Object.assign({}, p, { items: p.role === '행정지원' ? [] : A.ensureRequired([], 5) })) });   // 화면의 등급(참여율 순) — 저장 항목은 entry 쪽
  assert.deepStrictEqual(res.people.map((p) => p.gradeLabel), ['S', 'A', 'B', 'C', 'D', ''], '5명 S~D');
  const entry = { people: { a: { items: five[0].items.slice() }, d: { items: five[3].items.slice() } } };
  assert.strictEqual(A.decompose(res, entry), 1 + 2 + 2 + 0 + 1, 'a 는 필수 밖이 이미 2개라 1개만 · d 는 이미 있어 0개');
  const names = (id) => entry.people[id].items.map((it) => `${it.name}/${it.level}/${it.weight}`);
  assert.deepStrictEqual(names('a'), ['연구내용 사전조사/다/0.2', '진도보고서 작성/다/0.2', '논문(SCI(E))/가/0.8', '특허(국제)/가/1', '연구총괄 및 관리/가/1'], 'S: 논문·특허는 가중치 그대로, 연구총괄만(3개 한도)');
  assert.deepStrictEqual(names('b'), ['연구내용 사전조사/다/0.2', '진도보고서 작성/다/0.2', '설계,해석 및 검증 S/W 개발/가/1', '기준/절차/가이드라인/지침서/나/0.25'], 'A: 기준/절차는 b·c·d·e 넷이 가져 1/4');
  assert.deepStrictEqual(names('c'), ['연구내용 사전조사/다/0.2', '진도보고서 작성/다/0.2', '알고리즘/제어기술 개발/나/1', '기준/절차/가이드라인/지침서/나/0.25'], 'B');
  assert.deepStrictEqual(names('d'), ['연구내용 사전조사/다/0.2', '진도보고서 작성/다/0.2', '기준/절차/가이드라인/지침서/나/0.25'], 'C: 있던 항목(건수 2)은 그대로, 가중치만 1/N');
  assert.strictEqual(entry.people.d.items[2].count, 2);
  assert.deepStrictEqual(names('e'), ['연구내용 사전조사/다/0.2', '진도보고서 작성/다/0.2', '기준/절차/가이드라인/지침서/나/0.25'], 'D: 하나');
  assert.ok(!entry.people.j, '행정지원은 없음');
  const after = A.compute({ pool: 1000000, people: five.map((p) => Object.assign({}, p, { items: (entry.people[p.id] || {}).items || [] })) });
  assert.ok(!A.checks(after).some((w) => w.text.includes('가중치 합')), '넣은 뒤 가중치 합 알림 없음');
  assert.deepStrictEqual(after.people.slice(0, 5).map((p) => p.gradeLabel), ['S', 'A', 'B', 'C', 'D'], '등급 차례 유지');
  const merged = A.compute({ pool: 1000000, merge: { sa: true, cd: true }, people: five.slice(0, 5).map((p) => Object.assign({}, p, { items: [] })) }), e2 = { people: {} };
  A.decompose(merged, e2);
  assert.deepStrictEqual([e2.people.b.items[2].name, e2.people.e.items[2].name, e2.people.e.items.length], ['연구총괄 및 관리', '기준/절차/가이드라인/지침서', 3], 'S+A 는 S 템플릿, C+D 는 C 템플릿');
  // 단추·처리(가짜 host)
  const st = mk({ data: { projects: [P] }, staffView: { prjNo: P.prjNo, years: { [P.prjNo]: 1 }, extra: {}, inc: {}, fold: {} }, staffAliases: {} });
  assert.ok(A.card(P, plan, 1, U.budgetRows(P, plan, 1, st), st, {}).includes('data-act="al-decompose" title="지금 평가등급대로 기본 성과 항목을 넣습니다'));
  const L = {}; const host = { addEventListener(t, fn) { (L[t] = L[t] || []).push(fn); }, contains: () => false, querySelector: () => null, querySelectorAll: () => [], ownerDocument: { activeElement: null } };
  A.bind(host, st, () => {});
  const key = S.planKey(P.prjNo, 1), card = { dataset: { alkey: key } }, btn = { dataset: { act: 'al-decompose' } }; btn.closest = (sel) => (sel.startsWith('[data-alkey') ? card : sel.startsWith('[data-act') ? btn : null);
  for (const fn of L.click) fn({ target: btn, preventDefault() {} });
  assert.deepStrictEqual(st.allowCalc[key].people.k.items.map((it) => it.name), ['연구내용 사전조사', '진도보고서 작성', '연구총괄 및 관리', '연구계획서작성(선정평가포함)'], '김거화 S');
  assert.deepStrictEqual(st.allowCalc[key].people.m.items.map((it) => [it.name, it.weight]), [['연구내용 사전조사', 0.5], ['진도보고서 작성', 0.5], ['설계,해석 및 검증 S/W 개발', 1], ['기준/절차/가이드라인/지침서', 1]], '문창재 A');
  assert.ok(st.allowMsg && st.allowMsg.key === key && st.allowMsg.text.startsWith('등급별 기본 성과 항목 4개를 넣었습니다'));
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
test('평가항목 목록 편집 — 기본은 지침 ITEMS, [목록 저장] 이 entry.items 로 ＋ 항목 드롭다운을 바꾸고 [지침 기본값] 이 되돌림, normalize 가 지킴', () => {
  const st = mk({});
  const html0 = A.card(P, plan, 1, U.budgetRows(P, plan, 1, st), st, {});
  assert.ok(html0.includes('data-al-disclosure="itemlist"') && html0.includes('· 지침 기본</small>') && html0.includes('<option value="가|기술문서 발간">기술문서 발간</option>') && html0.includes('data-act="al-items-default" title="지침 1) 의 기본 목록으로 되돌림" disabled'), html0.slice(html0.indexOf('krext-al-itemlist'), html0.indexOf('krext-al-itemlist') + 300));
  assert.strictEqual(A.itemsOf({}), A.ITEMS);
  assert.deepStrictEqual(A.parseItems(' 디지털 트윈 \n\n디지털 트윈\n기타 '), ['디지털 트윈', '기타']);
  const L = {}; const host = { addEventListener(t, fn) { (L[t] = L[t] || []).push(fn); }, contains: () => false, querySelector: () => null, querySelectorAll: () => [], ownerDocument: { activeElement: null } };
  A.bind(host, st, () => {});
  const key = S.planKey(P.prjNo, 1), card = { dataset: { alkey: key } };
  const tas = { '가': '연구총괄 및 관리\n디지털 트윈 모델 개발', '나': '기준/절차/가이드라인/지침서', '다': '진도보고서 작성\n기타' };
  const box = { querySelector: (sel) => ({ value: tas[sel.match(/"(.)"/)[1]] }) };
  const click = (act) => { const btn = { dataset: { act } }; btn.closest = (sel) => (sel.startsWith('[data-alkey') ? card : sel.startsWith('[data-act') ? btn : sel === '.krext-al-itemlist' ? box : null); for (const fn of L.click) fn({ target: btn, preventDefault() {} }); };
  click('al-items-save');
  assert.deepStrictEqual(st.allowCalc[key].items, { '가': ['연구총괄 및 관리', '디지털 트윈 모델 개발'], '나': ['기준/절차/가이드라인/지침서'], '다': ['진도보고서 작성', '기타'] });
  assert.ok(st.allowMsg && st.allowMsg.text === '평가항목 목록을 저장했습니다 — 가 2 · 나 1 · 다 2.');
  const html1 = A.card(P, plan, 1, U.budgetRows(P, plan, 1, st), st, {});
  assert.ok(html1.includes('<option value="가|디지털 트윈 모델 개발">디지털 트윈 모델 개발</option>') && !html1.includes('기술문서 발간</option>') && html1.includes('가 2 · 나 1 · 다 2 · 고침</small>') && html1.includes('data-act="al-items-default" title="지침 1) 의 기본 목록으로 되돌림">지침 기본값'));
  assert.deepStrictEqual(A.normalize({ [key]: { items: { '가': ['a', ' a ', ''], '나': [], '다': ['b'] }, at: 1 } })[key].items, { '가': ['a'], '나': [], '다': ['b'] });
  assert.strictEqual(A.normalize({ [key]: { items: { '가': ['a'] }, at: 1 } })[key].items, undefined, '세 묶음이 다 있어야 목록');
  click('al-items-default');
  assert.ok(!st.allowCalc[key].items && st.allowMsg.text.startsWith('평가항목 목록을 지침 기본값'));
});

console.log(`\n${n} passed, ${failed} failed`);
