/* lib/staff-ui.js (제목 줄 아이콘으로 여는 사업비 관리 화면 — kr_ext_workspace R&D 탭 꼴, 0.8.7) 그리기·보기 상태 테스트 — DOM 없이 section() HTML 과 bind 의 위임 이벤트를 확인한다. 실행: node tests/staff-ui.test.js
 * 과제 칩·별칭, 과제 카드(연차 칩 · 기간 줄), 예산 카드(기본값: 현재 연차 rERP 예산액 · 다른 연차 계획서 · 비목만, 집행 = 승인 + 사용계획 + 미청구, 미청구 보조 줄, 합계, 막대), 참여인력 카드(패널은 WORKSPACE 꼴 보기 + 참여연구원 변경 단추 · 행정지원 구역, 탭(only:'staff')은 칸·✎·기간 구간 줄 · 날짜 폼 · 초과금/부족금), 옛 계획 이동(adopt) */
const TAB = { edit: true, only: 'staff' };   // 참여연구원 변경 탭 — 계획 편집(단추 줄 · 칸 · ✎ · ×)은 여기서만
globalThis.self = globalThis;
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..');
for (const f of ['lib/format.js', 'lib/staff.js', 'lib/collect.js', 'lib/staff-ui.js']) require(path.join(root, f));   // collect: 참여연구원 자료 요청 구역(탭)
const S = KRX_STAFF, U = KRX_STAFF_UI;
let n = 0, failed = 0;
const test = (name, fn) => { try { fn(); n++; console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n   ', e.stack || e.message); process.exitCode = 1; } };

const REC = [
  { EMP_NM: '문창재', ROLE_NM: '참여연구원', PAY_LIMT_AMT: '5823000', PAY_AMT: '1165000', PART_RT: '20.01', PLAN_YM_FROM: '202604', PLAN_YM_TO: '202611', NCNT: '8', REQ_CNT: '9', SEQ_NO: '2' },
  { EMP_NM: '문창재', ROLE_NM: '참여연구원', PAY_LIMT_AMT: '5823000', PAY_AMT: '1159000', PART_RT: '19.91', PLAN_YM_FROM: '202612', PLAN_YM_TO: '202612', NCNT: '1', REQ_CNT: '9', SEQ_NO: '2' },
  { EMP_NM: '김거화', ROLE_NM: '과제책임자', PAY_LIMT_AMT: '8480000', PAY_AMT: '2328000', PART_RT: '27.46', PLAN_YM_FROM: '202604', PLAN_YM_TO: '202611', NCNT: '8', REQ_CNT: '9', SEQ_NO: '1' },
  { EMP_NM: '김거화', ROLE_NM: '과제책임자', PAY_LIMT_AMT: '8480000', PAY_AMT: '2322000', PART_RT: '27.39', PLAN_YM_FROM: '202612', PLAN_YM_TO: '202612', NCNT: '1', REQ_CNT: '9', SEQ_NO: '1' },
];
const ITEMS = [{ exp: '인건비', bgt: 31425000, appr: 10000000, req: 500000 }, { exp: '연구수당', bgt: 6000000, appr: 0, req: 0 }, { exp: '연구활동비', bgt: 50000000, appr: 19712839, req: 148500 }, { exp: '간접비', bgt: 20000000, appr: 0, req: 0 }];
const P = { prjNo: '2026-0063-01', prjNm: 'MW급 10kV 고전압 직류 시스템용 반도체 차단기 개발', rspr: '김거화', anl: '1', stDt: '20260401', endDt: '20261231', count: 3, amount: 1200000, budget: { items: ITEMS, bgtAmt: 107425000, apprAmt: 29712839, reqAmt: 648500, unbilled: 1200000 } };
const P2 = { prjNo: '2026-0064-01', prjNm: '선박용 수소 엔진-연료전지 하이브리드 추진 시스템 개발', rspr: '노길태', anl: '2', stDt: '20260101', endDt: '20261231', budget: { items: [{ exp: '인건비', bgt: 78000000, appr: 0 }], bgtAmt: 78000000, apprAmt: 0 } };
const d = { projects: [P, P2] };
const K1 = S.planKey(P.prjNo, 1), K2 = S.planKey(P.prjNo, 2);
const mk = (over = {}) => Object.assign({ staffPlans: {}, staffRows: {}, staffView: { years: {}, extra: {}, inc: { unbilled: true, plan: true }, fold: {} }, research: {}, plans: {} }, over);
const EDIT = { edit: true };
const rec2 = { id: 'mw#2', name: 'MW급', n: 2, rev: 'r2', prjNo: P.prjNo, budget: [{ item: '인건비', plan: 35900000 }, { item: '연구활동비', plan: 66300000 }, { item: '연구수당', plan: 7020000 }, { item: '간접비', plan: 26780000 }] };

test('기간·예산 — 현재 연차는 ERP 연차 기간·인건비 비목, 다른 연차는 12달씩 셈한 기간·예산 없음, 예산 줄이 있으면 그 인건비', () => {
  assert.deepStrictEqual(U.periodOf(P, null), { from: '2026-04', to: '2026-12' });
  assert.deepStrictEqual(U.periodOf(P, null, 2), { from: '2027-01', to: '2027-12' });
  assert.deepStrictEqual(U.periodOf(P, { from: '2027-01', to: '2027-12' }), { from: '2027-01', to: '2027-12' });
  assert.strictEqual(U.erpBudgetPay(P), 31425000, '연구수당은 인건비가 아니다');
  assert.strictEqual(U.budgetOf(P, { budgetPay: 35900000 }), 35900000);
  assert.deepStrictEqual([U.budgetOf(P, null, 1), U.budgetOf(P, null, 2), U.budgetOf(P, null, 2, [{ name: '인건비', plan: 1000 }])], [31425000, null, 1000]);
  assert.deepStrictEqual([U.yearState({ from: '2099-01', to: '2099-12' }), U.yearState({ from: '2000-01', to: '2000-12' }), U.yearState({ from: '2000-01', to: '2099-12' }), U.yearState(null)], ['예정', '지남', '진행 중', '기간 미정']);
  assert.deepStrictEqual([U.shortName('MW급 10kV 고전압 직류'), U.shortName('짧은 이름')], ['MW급 10kV 고전…', '짧은 이름']);
});
test('연차 · 고른 과제 · 옛 계획 이동', () => {
  const st = mk();
  assert.strictEqual(U.projOf(d.projects, st).prjNo, P.prjNo, '고른 과제가 없으면 첫 과제');
  st.staffView.prjNo = P2.prjNo;
  assert.strictEqual(U.projOf(d.projects, st).prjNo, P2.prjNo);
  assert.deepStrictEqual([U.yearOf(P, st), U.yearOf(P2, st)], [1, 2]);
  st.staffView.years[P.prjNo] = 3;
  assert.strictEqual(U.yearOf(P, st), 3);
  assert.deepStrictEqual(U.yearsOf(P, {}, mk()), [1, 2]);
  assert.deepStrictEqual(U.yearsOf(P, { [S.planKey(P.prjNo, 4)]: { prjNo: P.prjNo, year: 4, people: [] } }, mk()), [1, 2, 3, 4]);
  assert.deepStrictEqual(U.yearsOf(P, {}, mk({ staffView: { extra: { [P.prjNo]: 3 } } })), [1, 2, 3]);
  const plans = { [P.prjNo]: { prjNo: P.prjNo, prjNm: 'x', from: '2026-04', to: '2026-12', people: [{ id: 'a', name: '김거화', plan: [] }] } };
  U.adopt(plans, P);
  assert.deepStrictEqual([Object.keys(plans), plans[K1].year], [[K1], 1], '연차 없는 옛 계획은 현재 연차로');
});
test('예산 줄 — 현재 연차: rERP 예산액(같은 비목은 재원을 합침), 집행 = 승인 + 사용계획 + 미청구(연구활동비 줄), 승인전은 더하지 않음; 체크를 끄면 빠짐', () => {
  const st = mk({ plans: { [P.prjNo]: { '10|연구활동비': [{ id: 'a', name: 'x', qty: 1, unit: 300000, amt: 300000, ts: 1 }], '10|인건비': [{ id: 'b', name: 'y', qty: 2, unit: 100000, amt: 200000, ts: 1 }] } } });
  const items2 = ITEMS.concat([{ exp: '연구활동비', res: '20', bgt: 1000000, appr: 1000, req: 0 }]);
  const br = U.budgetRows(Object.assign({}, P, { budget: Object.assign({}, P.budget, { items: items2 }) }), null, 1, st);
  assert.deepStrictEqual([br.src, br.cur, br.rows.map((r) => r.name)], ['erp', true, ['인건비', '연구수당', '연구활동비', '간접비']]);
  const act = br.rows[2];
  assert.deepStrictEqual([act.plan, act.appr, act.req, act.pl, act.ub, act.used, act.left, act.erp], [51000000, 19713839, 148500, 300000, 1200000, 21213839, 29786161, true], '연구활동비: 재원 합침 · 사용계획 · 미청구');
  assert.deepStrictEqual([br.rows[0].pl, br.rows[0].used, br.rows[1].used, br.loose], [200000, 10200000, 0, null]);
  assert.deepStrictEqual([br.sums.plan, br.sums.used, br.sums.left], [108425000, 31413839, 77011161]);
  st.staffView.inc = { unbilled: false, plan: false };
  const br2 = U.budgetRows(P, null, 1, st);
  assert.deepStrictEqual([br2.rows[2].used, br2.rows[0].used, br2.sums.used], [19712839, 10000000, 29712839], '체크를 끄면 승인액만');
  // 연구활동비 줄이 없으면 미청구는 보조 줄로(합계에만)
  st.staffView.inc = { unbilled: true, plan: false };
  const br3 = U.budgetRows(P, { budget: [{ name: '인건비', plan: 1000000 }] }, 1, st);
  assert.deepStrictEqual([br3.src, br3.loose, br3.sums.used, br3.sums.left], ['plan', { amt: 1200000, count: 3 }, 11200000, -10200000]);
  assert.ok(U.budgetTsv(br3).includes('미청구 · 과제카드 3건\t\t1,200\t-1,200') && U.budgetTsv(br3).endsWith('합계\t1,000\t11,200\t-10,200'));
});
test('예산 줄 — 다른 연차: 계획서의 비목별 예산, 없으면 현재 연차 비목 이름만(집행 0); 직접 적은 줄이 있으면 그것', () => {
  const st = mk({ research: { [rec2.id]: rec2 } });
  const br = U.budgetRows(P, null, 2, st);
  assert.deepStrictEqual([br.src, br.cur, br.rec && br.rec.n, br.rows.map((r) => [r.name, r.plan, r.used, r.left])], ['yaml', false, 2, [['인건비', 35900000, 0, 35900000], ['연구활동비', 66300000, 0, 66300000], ['연구수당', 7020000, 0, 7020000], ['간접비', 26780000, 0, 26780000]]]);
  assert.deepStrictEqual([br.sums.plan, br.sums.used, U.budgetOf(P, null, 2, br.rows)], [136000000, 0, 35900000], '참여인력 칸의 인건비 예산은 계획서 인건비');
  const br2 = U.budgetRows(P, null, 3, st);
  assert.deepStrictEqual([br2.src, br2.rows.map((r) => r.name), br2.rows[0].plan, br2.sums.plan], ['default', ['인건비', '연구수당', '연구활동비', '간접비'], null, 0]);
  const br3 = U.budgetRows({ prjNo: 'X', anl: '1' }, null, 2, mk());
  assert.deepStrictEqual(br3.rows.map((r) => r.name), [...S.BUDGET_ITEMS], '비목 정보가 전혀 없으면 여섯 비목');
  const br4 = U.budgetRows(P, { budget: [{ name: '인건비', plan: 40000000 }, { name: '새 비목', plan: null }] }, 2, st);
  assert.deepStrictEqual([br4.src, br4.rows.map((r) => [r.name, r.plan])], ['plan', [['인건비', 40000000], ['새 비목', null]]]);
});
test('화면 — 과제 칩 · 과제 카드 · 연차 칩 · 예산 카드 · 참여인력 카드 (늘 고치기 — 구역 스위치의 사업비 탭은 없음)', () => {
  const st = mk({ staffAliases: { [P.prjNo]: 'SSCB' } });
  const html = U.section(d, {}, st, '<b>T</b>', { tail: '<i>BACK</i>' });
  assert.ok(html.includes('<b>T</b>') && html.includes('<i>BACK</i></div>') && html.includes('krext-ws') && html.includes('krext-st-edit'));
  assert.ok(html.includes('data-act="st-proj" data-prj="2026-0063-01"') && html.includes('krext-ws-proj krext-on" data-act="st-proj" data-prj="2026-0063-01"') && html.includes('>SSCB</button>') && html.includes('>선박용 수소 엔진-연…</button>'), '칩: 별칭 · 과제명 앞부분');
  assert.ok(html.includes('data-stprj="2026-0063-01" data-styr="1"') && html.includes('<b class="krext-ws-name" title="MW급 10kV 고전압 직류 시스템용 반도체 차단기 개발">SSCB</b>') && html.includes('과제 정보') && html.includes('data-act="st-alias"'));
  assert.ok(html.includes('data-act="st-year" data-year="1"') && html.includes('<small>현재</small>') && html.includes('data-year="2"') && html.includes('data-act="st-year-add" data-year="3"'), '연차 칩: 1(현재) · 2 · ＋ 3');
  assert.ok(html.includes('<b>1차년도</b> · <input type="month" data-stp="from" value="2026-04"') && html.includes('R&amp;D ERP 현재 연차'));
  assert.ok(html.includes('data-card="budget"') && html.includes('계획 107,425 · 집행 30,913 (29%)') && html.includes('data-stb="name" data-i="0" value="인건비"') && html.includes('data-stb="plan" data-i="0" value="31,425"'), '예산 카드 머리·칸');
  assert.ok(html.includes('data-stinc="unbilled" checked') && html.includes('data-act="st-bcopy"') && html.includes('rERP 자금현황(원) · 예산 107,425,000') && html.includes('data-act="st-bdel" data-i="3"') && html.includes('data-act="st-badd"'));
  assert.ok(html.includes('<div class="krext-ws-budget-scroll" tabindex="0" role="region" aria-label="비목별 예산 표"><div class="krext-ws-budget-grid"><div class="krext-ws-bhead">'), '예산 금액이 좁은 패널에서도 잘리지 않도록 키보드 스크롤 구역');
  assert.ok(html.includes('data-card="staff"') && html.includes('>계획 없음</span>') && html.includes('data-act="st-tab"') && !html.includes('data-act="st-init-erp"') && !html.includes('data-act="st-add"') && html.includes('<div class="krext-st-sup">') && html.includes('data-act="st-sup-add"') && !html.includes('data-page="staff"'), '참여인력 카드: 참여연구원 변경 단추만(편집 단추 없음) · 행정지원 구역 · 탭으로 가는 링크 없음');
  assert.ok(/표시할 과제가 없습니다/.test(U.section({ projects: [] }, {}, mk(), '')));
});

test('✎·＋ 폼의 기본 날짜·직전 날짜·부족금의 % — defaultRange(오늘이 기간 안이면 다음 달 1일 · 그 해 12월 마지막 날, 직전 변경의 날짜 그대로), st-add 는 그 기본값을 폼에, 구분 "부족금의 %"(값 칸 옆 안내)로 더하면 부족금 × % 를 적용일~종료일에 나누고 다음 폼은 같은 날짜로, 부족금이 없으면 오류', () => {
  const M = S.ymRange('2026-04', '2026-12');
  assert.deepStrictEqual(U.defaultRange(M, '2026-10', null), { from: '2026-11-01', to: '2026-12-31' });
  assert.deepStrictEqual(U.defaultRange(M, '2026-12', null), { from: '2026-12-01', to: '2026-12-31' }, '다음 달이 기간 밖이면 이번 달 1일');
  assert.deepStrictEqual(U.defaultRange(M, '2027-03', null), { from: '2026-04-01', to: '2026-12-31' }, '오늘이 기간 밖이면 기간 첫 달');
  assert.deepStrictEqual(U.defaultRange(S.ymRange('2026-10', '2027-09'), '2026-10', null), { from: '2026-11-01', to: '2026-12-31' }, '두 해에 걸치면 올해 마지막 날');
  assert.deepStrictEqual(U.defaultRange(S.ymRange('2027-01', '2027-12'), '2026-10', null), { from: '2027-01-01', to: '2027-12-31' });
  assert.deepStrictEqual(U.defaultRange(M, '2026-10', { from: '2026-10-15', to: '' }), { from: '2026-10-15', to: '' }, '직전 변경의 날짜');
  assert.deepStrictEqual(U.defaultRange([], '2026-10', null), { from: '', to: '' });
  const st = mk({ data: d });
  withStaffActions(st, ({ click, change, input }) => {
    click('st-add');
    assert.ok(st.staffDraft && /^2026-\d{2}-01$/.test(st.staffDraft.from) && st.staffDraft.to === '2026-12-31', '＋ 폼의 기본 적용일은 어느 달 1일, 종료일은 12월 31일');
    input('name', '새사람'); input('manual', '5000'); input('from', '2026-10-01'); input('to', '2026-12-31');
    change({ stf: 'mode' }, 'short');
    const html = U.section(d, {}, st, '', TAB);
    assert.ok(html.includes('<option value="short" selected') && html.includes('placeholder="100"') && html.includes('나머지(아래 줄)의 몇 % — 100 이면 전부, 둘이 나누면 50') && html.includes('>나머지의 %</option>') && html.includes('나머지 <b>31,425</b>천원 · 10~12월 (3개월)') && html.includes('<div class="krext-st-steps krext-st-steps-share"') && html.includes('data-act="st-step" data-step="50" data-kind="share" data-id="new" data-preview="나머지 31,425천원의 50% = 15,713천원 → 10~12월 월 약 5,238천원 · 월평균 104.75%') && (html.match(/data-act="st-step"/g) || []).length === 10 && !html.includes('data-act="st-fit"'), '구분 나머지의 % · 폼 아래 증감 줄은 나머지(예산 31,425 − 0)의 10~100% 칸(월평균은 폼의 월급여로) — 더하기 폼에는 예산에 맞추기 없음');
    input('value', '50'); click('st-apply', { id: 'new' });
    const plan = st.staffPlans[K1];
    assert.ok(plan && plan.people.length === 1 && plan.people[0].name === '새사람', st.staffError || '더해짐');
    assert.deepStrictEqual(plan.people[0].plan.map((x) => [x.ym, x.amt]), [['2026-10', 5238000], ['2026-11', 5238000], ['2026-12', 5237000]], '31,425천원의 50% = 15,712.5 → round천원 15,713천원을 3달에(앞달 ceil · 마지막 잔액)');
    assert.ok(st.staffMsg && st.staffMsg.text.includes('새사람 을(를) 더했습니다') && st.staffMsg.text.includes('나머지 31,425천원의 50% = 15,713천원') && st.staffMsg.text.includes('부족금 15,712천원'), st.staffMsg && st.staffMsg.text);
    assert.deepStrictEqual(st.staffLastRange, { key: K1, from: '2026-10-01', to: '2026-12-31' });
    click('st-add');
    assert.deepStrictEqual([st.staffDraft.from, st.staffDraft.to], ['2026-10-01', '2026-12-31'], '다음 ＋ 폼은 직전 변경의 날짜');
    input('name', '둘째'); input('manual', '4000'); change({ stf: 'mode' }, 'short'); input('value', '100'); click('st-apply', { id: 'new' });
    assert.strictEqual(S.staffTotal(st.staffPlans[K1], st.staffPlans[K1].basis), 31425000, '둘째가 남는 부족금의 100 → 합은 정확히 예산');
    click('st-edit', { id: plan.people[0].id });
    assert.deepStrictEqual([st.staffDraft.from, st.staffDraft.to], ['2026-10-01', '2026-12-31'], '✎ 폼도 직전 날짜');
    st.staffPlans[K1].budgetPay = 10000000;   // 예산을 줄이면 부족금이 없다 → 오류
    change({ stf: 'mode' }, 'short'); input('value', '100'); click('st-apply', { id: plan.people[0].id });
    assert.ok(/나머지가 없습니다/.test(st.staffError || ''), st.staffError);
  });
});

test('폼 아래 증감 줄(회의실 현황 꼴) — ✎ 폼: [제외 −100%][−50%]…[기준]…[+50%](그 기간의 지금 지급에서 10% 간격, 칸마다 미리보기) · [−1%] [+1%] · 맨 오른쪽 [예산에 맞추기](초과금 줄이기 | 부족금 채우기 → 합 = 예산); 칸은 고르기만(draft.step · 반영 단추에 값 · 읽기 줄 "반영을 누르면") 하고 반영을 눌러야 적용, 값을 적거나 구분을 바꾸면 거둠; 그 기간에 지급이 없으면 나머지 [10%]…[100%]; 예산 없음 안내 · 예산과 같으면 맞추기 꺼짐; 월평균 10% 이하 빨강 + 알림', () => {
  const rows = S.rowsOfErp(REC);
  const staff = S.peopleOfErp(rows, { prjNo: P.prjNo, now: 1 });
  const plan = Object.assign({ prjNo: P.prjNo, year: 1, prjNm: P.prjNm, from: '2026-04', to: '2026-12', budgetPay: 30000000, budget: null, at: 1, by: '', note: '' }, staff);
  const st = mk({ data: d, staffPlans: { [K1]: plan }, staffRows: { [P.prjNo]: { at: 1, rows, others: {} } } });
  const [moon, kim] = plan.people.map((x) => x.id);
  const total = () => S.staffTotal(st.staffPlans[K1], st.staffPlans[K1].basis);
  const who = (id) => st.staffPlans[K1].people.find((x) => x.id === id);
  const quickOf = (html) => { const i = html.indexOf('<div class="krext-st-quick">'); if (i < 0) return ''; const ends = ['<div class="krext-plan-form">', '</td></tr>'].map((t) => html.indexOf(t, i)).filter((k) => k > 0); return html.slice(i, Math.min(...ends)); };   // ✎ 폼은 증감 줄 뒤에 적용일·반영 줄
  withStaffActions(st, ({ click, change, input }) => {
    click('st-edit', { id: kim }); input('from', '2026-11-01'); input('to', '2026-12-31');
    let html = U.section(d, {}, st, '', TAB), quick = quickOf(html);
    assert.ok(quick.includes(`<div class="krext-st-steps krext-st-steps-scale" role="group" aria-label="기준에서 10% 간격으로 늘리고 줄이기" data-kind="scale" data-id="${kim}">`) && (quick.match(/data-act="st-step"/g) || []).length === 11 && quick.includes('<span class="krext-st-step krext-st-step-base" data-step="0" data-preview=""'), quick);
    assert.ok(quick.includes('>제외<small>−100%</small></button>') && quick.indexOf('data-step="-100"') < quick.indexOf('data-step="-50"') && quick.includes('data-preview="제외 (−100%) — 11~12월 4,650 → 0천원'), '−50% 왼쪽에 제외(−100%)와 선택 기간을 0원으로 바꾸는 미리보기');
    assert.ok(quick.includes(`class="krext-st-step krext-st-step-dn" data-act="st-step" data-step="-50" data-kind="scale" data-id="${kim}"`) && quick.includes('data-preview="+30% — 11~12월 4,650 → 6,045천원 · 월평균 27.44% → 29.27% · 초과금 2,820천원"') && quick.includes('aria-pressed="false">−10%</button><span class="krext-st-step krext-st-step-base"'), '칸마다 미리보기(그 기간 합 · 월평균 · 예산 대비)');
    assert.ok(quick.includes(`data-act="st-nudge" data-dir="-1" data-kind="scale" data-id="${kim}"`) && quick.includes('data-dir="1"') && quick.indexOf('st-nudge') > quick.lastIndexOf('data-step="50"') && quick.indexOf('st-step-fit') > quick.lastIndexOf('st-nudge'), '+50% 오른쪽에 −1% · +1%, 그 오른쪽에 예산에 맞추기');
    assert.ok(quick.includes('기준 <b>4,650</b>천원 · 11~12월 (2개월) · 나머지 3,225천원') && quick.includes('<span class="krext-st-step-pv" data-default="칸을 누르거나 기준에서 끌어') && quick.includes('class="krext-st-step krext-st-step-fit krext-st-fit-over" data-act="st-fit"') && quick.includes('>예산에 맞추기<small>초과금 1,425</small></button>'), '맨 오른쪽 예산에 맞추기 · 읽기 줄');
    // 폼 한 줄 — 반영·취소가 값 칸 바로 뒤, 지급 완료 안내는 그 뒤(2026-10-19 "반영/취소는 적용일, 종료일, 참여율 이거랑 1줄로")
    // ✎ 폼 — 머리글(이름) 없이 증감 줄 → 자동 계산 → 적용일·반영 줄(2026-10-20 "성명은 중복이라 … 빼도", "적용일/반영예산 메뉴를 아래에")
    const row = html.slice(html.indexOf('<tr class="krext-st-form"'), html.indexOf('</td></tr>', html.indexOf('<tr class="krext-st-form"')));
    assert.ok(!row.includes('krext-st-editor-head') && !row.includes('참여 계획 조정') && row.indexOf('<div class="krext-st-quick">') < row.indexOf('<div class="krext-plan-form">') && row.indexOf('data-act="st-even"') < row.indexOf('data-stf="from"'), '✎ 폼은 머리글 없이 증감 줄이 먼저');
    const form = row.slice(row.indexOf('<div class="krext-plan-form">'));
    const pos = (t) => form.indexOf(t);
    assert.ok(pos('data-stf="value"') < pos('data-act="st-apply"') && pos('data-act="st-apply"') < pos('data-act="st-cancel"') && !form.includes('krext-st-form-hint'), '값 → 반영 → 취소(지급 완료가 없으니 안내 없음)');
    assert.ok(form.includes('data-id="' + kim + '">반영</button>'), '고른 것이 없으면 반영');
    // 예산에 맞추기 — 누르면 바로 반영(2026-10-20 "균등하게, 예산맞추기, max를 넣으면 바로 반영해줘. 반영 예산 따로 넣지 말고"). 미리보기는 단추의 data-preview(올리면 읽기 줄)
    assert.ok(quick.includes('data-preview="예산에 맞추기 — 초과금 1,425천원 줄임: 11~12월 4,650 → 3,225천원 (기준의 −31%)') && !quick.includes('aria-pressed="false">예산에 맞추기'), quick);
    click('st-fit', { id: kim });
    assert.strictEqual(total(), 30000000, st.staffError || '누르면 바로 초과금만큼 줄여 합 = 예산');
    assert.strictEqual(S.monthlyText(who(kim).plan), '4~10월 2,328 · 11월 1,615 · 12월 1,610', '11·12월에서 712.5천원씩(앞달 올림) — 11월 2,328 · 12월 2,322 의 차이는 그대로');
    assert.ok(st.staffMsg && st.staffMsg.text.includes('김거화 — 예산 맞춤') && st.staffMsg.text.includes('초과금 1,425천원 줄임') && st.staffMsg.text.includes('예산과 같음'), st.staffMsg && st.staffMsg.text);
    assert.ok(U.changesOf(st, P.prjNo, 1).some((c) => c.item === '김거화' && /\(예산 맞춤\)$/.test(c.after)), '변경이력 한 줄');
    assert.ok(!st.staffEdit && !st.staffDraft, '반영하면 폼 닫힘(고른 것도 같이)');
    // 균등 — 예산에 맞추기 오른쪽. 11~12월(1,615 · 1,610)의 합 3,225 ÷ 2 = 1,612.5 → 달마다 1,613 — 합은 3,226 이 돼 초과금 1천원
    click('st-edit', { id: kim }); input('from', '2026-11-01'); input('to', '2026-12-31');
    html = U.section(d, {}, st, '', TAB); quick = quickOf(html);
    assert.ok(quick.includes('data-act="st-even"') && quick.indexOf('st-even') > quick.indexOf('st-fit') && quick.includes('>균등<small>매월 같게</small></button>') && quick.includes('data-preview="균등 — 11~12월 월 1,613천원씩 (합 3,225 → 3,226천원, +1천원)') && quick.includes('초과금 1천원'), '예산에 맞추기 오른쪽에 균등 · 미리보기(합의 차와 예산 대비)');
    click('st-even', { id: kim });   // 바로 반영
    assert.deepStrictEqual([total(), S.monthlyText(who(kim).plan)], [30001000, '4~10월 2,328 · 11~12월 1,613'], st.staffError || '달마다 같은 금액 — 합은 1천원 늘어남');
    assert.ok(st.staffMsg && st.staffMsg.text.includes('김거화 — 균등') && st.staffMsg.text.includes('월 1,613천원씩(합 3,225 → 3,226천원)') && U.changesOf(st, P.prjNo, 1).some((c) => c.item === '김거화' && /\(균등\)$/.test(c.after)), st.staffMsg && st.staffMsg.text);
    st.staffPlans[K1].people = st.staffPlans[K1].people.map((x) => (x.id === kim ? Object.assign({}, x, { plan: x.plan.map((m) => (m.ym === '2026-11' ? Object.assign({}, m, { amt: 1615000 }) : m.ym === '2026-12' ? Object.assign({}, m, { amt: 1610000 }) : m)) }) : x));   // 뒤 검사는 11월 1,615 · 12월 1,610 기준이라 되돌림
    // MAX — 예산에 맞추기와 균등 사이(2026-10-20 "우측에 균등 왼쪽에 MAX"). 11~12월 나머지 3,225천원 ÷ (8,480천원 × 2) → 19.01% → 1,612천원씩(합 3,224 — 예산을 넘지 않는 가장 큰 0.01%)
    click('st-edit', { id: kim }); input('from', '2026-11-01'); input('to', '2026-12-31');
    html = U.section(d, {}, st, '', TAB); quick = quickOf(html);
    assert.ok(quick.indexOf('data-act="st-fit"') < quick.indexOf('data-act="st-max"') && quick.indexOf('data-act="st-max"') < quick.indexOf('data-act="st-even"') && quick.includes(`data-act="st-max" data-id="${kim}" data-v="19.01"`) && quick.includes('>MAX<small>참여율 19.01%</small></button>') && quick.includes('data-preview="MAX — 참여율 19.01% (예산 나머지 3,225천원 기준): 11~12월 월 1,612천원씩 · 월평균'), quick);
    click('st-max', { id: kim, v: '19.01' });   // 바로 반영
    assert.deepStrictEqual([total(), S.monthlyText(who(kim).plan)], [29999000, '4~10월 2,328 · 11~12월 1,612'], st.staffError || 'MAX 를 반영하면 월급여 × 19.01% 씩 — 예산 아래');
    assert.ok(st.staffMsg && st.staffMsg.text.includes('김거화 — MAX 참여율') && st.staffMsg.text.includes('MAX 참여율 19.01%') && U.changesOf(st, P.prjNo, 1).some((c) => c.item === '김거화' && /\(MAX 참여율\)$/.test(c.after)), st.staffMsg && st.staffMsg.text);
    st.staffPlans[K1].people = st.staffPlans[K1].people.map((x) => (x.id === kim ? Object.assign({}, x, { plan: x.plan.map((m) => (m.ym === '2026-11' ? Object.assign({}, m, { amt: 1615000 }) : m.ym === '2026-12' ? Object.assign({}, m, { amt: 1610000 }) : m)) }) : x));   // 되돌림
    // 부족금 채우기 — 다른 사람(문창재)의 고른 달에서
    st.staffPlans[K1].budgetPay = 31000000;
    click('st-edit', { id: moon }); input('from', '2026-12-01'); input('to', '2026-12-31');
    html = U.section(d, {}, st, '', TAB);
    assert.ok(html.includes('>예산에 맞추기<small>부족금 1,000</small></button>') && !html.includes('krext-st-fit-over'));
    click('st-fit', { id: moon });
    assert.deepStrictEqual([total(), who(moon).plan[8].amt], [31000000, 2159000], '12월 1,159 + 1,000');
    assert.ok(!quickOf(U.section(d, {}, st, '', TAB)), '폼이 닫히면 증감 줄도 없음');
    // 칸을 누르면 고르기 — +20% 고른 뒤 +1% 두 번 → +22%, 반영 단추 "반영 +22%"; 반영하면 1,610 × 1.22
    click('st-edit', { id: kim }); input('from', '2026-12-01'); input('to', '2026-12-31');
    click('st-step', { id: kim, kind: 'scale', step: '20' });
    assert.deepStrictEqual(st.staffDraft.step, { kind: 'scale', v: 20 });
    click('st-nudge', { id: kim, kind: 'scale', dir: '1' }); click('st-nudge', { id: kim, kind: 'scale', dir: '1' });
    assert.deepStrictEqual([st.staffDraft.step, who(kim).plan[8].amt], [{ kind: 'scale', v: 22 }, 1610000], '+1% 두 번 — 아직 적용 안 됨');
    html = U.section(d, {}, st, '', TAB); quick = quickOf(html);
    assert.ok(html.includes('>반영 +22%</button>') && quick.includes('<b>반영</b>을 누르면 — +22% — 12월 1,610 → 1,964천원') && quick.includes('aria-pressed="true">+20%</button>') && quick.includes('aria-pressed="false">+30%</button>') && quick.includes('title="기준에서 1% 씩 늘림 — 지금 +22%"'), quick);
    click('st-apply', { id: kim });
    assert.strictEqual(who(kim).plan[8].amt, 1964000, st.staffError || '1,610 × 1.22 = 1,964.2 → 1,964');
    assert.ok(st.staffMsg.text.includes('김거화 — 증감 +22%') && st.staffMsg.text.includes('기준 1,610 → 1,964천원 (+22%)'), st.staffMsg.text);
    assert.ok(U.changesOf(st, P.prjNo, 1).some((c) => c.item === '김거화' && /\(증감 \+22%\)$/.test(c.after)));
    // −1% 만 누르면 0 에서 시작 → −1%; 값을 적으면 고른 것을 거둠; 구분을 바꿔도 거둠
    click('st-edit', { id: kim }); input('from', '2026-12-01'); input('to', '2026-12-31');
    click('st-nudge', { id: kim, kind: 'scale', dir: '-1' });
    assert.deepStrictEqual(st.staffDraft.step, { kind: 'scale', v: -1 });
    click('st-nudge', { id: kim, kind: 'scale', dir: '1' });
    assert.strictEqual(st.staffDraft.step, null, '0 이 되면 거둠');
    click('st-step', { id: kim, kind: 'scale', step: '-10' }); input('value', '15');
    assert.strictEqual(st.staffDraft.step, null, '값을 적으면 거둠');
    click('st-step', { id: kim, kind: 'scale', step: '-10' }); change({ stf: 'mode' }, 'amt');
    assert.strictEqual(st.staffDraft.step, null, '구분을 바꾸면 거둠');
    click('st-cancel');
    // 그 기간에 지급이 없으면(제외한 12월) 나머지의 10~100% 칸 — 50% 고르고 반영
    st.staffPlans[K1].budgetPay = 32000000;
    st.staffPlans[K1].people = st.staffPlans[K1].people.map((x) => (x.id === moon ? S.applyChange(x, 'rerp', { from: '2026-12', mode: 'exclude' }, S.ymRange('2026-04', '2026-12')) : x));
    click('st-edit', { id: moon }); input('from', '2026-12-01'); input('to', '2026-12-31');
    const left = 32000000 - S.personStats(who(kim), 'rerp').total - S.personStats(who(moon), 'rerp').total;   // 예산 − 김거화 − 문창재 4~11월
    quick = quickOf(U.section(d, {}, st, '', TAB));
    assert.ok(quick.includes('krext-st-steps-share') && quick.includes(`나머지 <b>${S.thousand(left)}</b>천원 · 12월 (1개월)`) && quick.includes(`data-step="100" data-kind="share" data-id="${moon}"`) && !quick.includes('krext-st-step-base') && quick.includes('data-kind="share" data-id="' + moon + '" title="나머지의 1% 씩 늘림"') && quick.includes('data-act="st-fit"'), quick);
    click('st-step', { id: moon, kind: 'share', step: '50' });
    html = U.section(d, {}, st, '', TAB);
    assert.ok(html.includes('>반영 50%</button>') && html.includes('aria-pressed="true">50%</button>') && html.includes('aria-pressed="true">10%</button>') && html.includes('aria-pressed="false">60%</button>'), '나머지 칸은 10~50 이 켜짐');
    click('st-apply', { id: moon });
    assert.ok(st.staffMsg.text.includes('문창재 — 나머지 배분') && st.staffMsg.text.includes('의 50% = '), st.staffError || st.staffMsg.text);
    assert.strictEqual(who(moon).plan[8].amt, Math.round(left / 2 / 1000) * 1000, '12월 = 나머지의 50%');
  });
  // 예산이 없으면 안내만 · 예산과 같으면 맞추기 꺼짐
  const st2 = mk({ data: d, staffPlans: { [K1]: Object.assign({}, plan, { people: staff.people, budgetPay: null }) }, staffEdit: { prjNo: P.prjNo, year: 1, id: moon }, staffDraft: { from: '2026-12-01', to: '2026-12-31', mode: 'rate', value: '' } });
  const noBudget = U.section(Object.assign({}, d, { projects: [Object.assign({}, P, { budget: { items: [] } }), P2] }), {}, st2, '', TAB);
  assert.ok(noBudget.includes('인건비 예산이 없어 나머지·초과금을 셈할 수 없습니다') && !noBudget.includes('data-act="st-step"'));
  st2.staffPlans[K1].budgetPay = 31425000;
  const even = quickOf(U.section(d, {}, st2, '', TAB));
  assert.ok(even.includes('<button type="button" class="krext-st-step krext-st-step-fit" disabled title="인건비 합이 이미 예산과 같습니다">예산에 맞추기<small>예산과 같음</small></button>') && !even.includes('data-act="st-fit"') && even.includes('기준 <b>1,159</b>천원 · 12월 (1개월) · 나머지 1,159천원'), even);
  assert.ok(even.includes('data-act="st-even"') && even.includes('>균등<small>매월 같게</small></button>'), '예산과 같아도 균등은 켜짐');
  // 고른 것이 지금 날짜로는 안 되면(날짜를 지급 없는 달로 옮김) 읽기 줄에 그 말
  st2.staffDraft.step = { kind: 'scale', v: 10 }; st2.staffPlans[K1].people = staff.people.map((x, i) => (i ? x : S.applyChange(x, 'rerp', { from: '2026-12', mode: 'exclude' }, S.ymRange('2026-04', '2026-12'))));
  assert.ok(quickOf(U.section(d, {}, st2, '', TAB)).includes('+10% 은(는) 지금 날짜로 반영할 수 없습니다'));
  st2.staffDraft.step = null;
  // 월평균 10% 이하 — 성명 밑 월평균 빨강 + 알림
  st2.staffPlans[K1].people = staff.people.map((x, i) => (i ? x : S.applyChange(x, 'rerp', { from: '2026-04', mode: 'amt', value: 500000 }, S.ymRange('2026-04', '2026-12'))));
  const low = U.section(d, {}, st2, '', TAB);
  assert.ok(low.includes('<span class="krext-st-low">월평균 8.58%</span>') && low.includes('문창재 — 월평균 참여율 8.58% — 10% 를 넘어야 합니다.'), '500 ÷ 5,823 = 8.586…% → 8.58%');
});
test('증감 줄 끌기 — 누른 칸부터 손가락 밑 칸(elementFromPoint)까지 기준에서 krext-st-step-on · 읽기 줄에 그 칸의 미리보기, 놓으면 그 값을 고르기만(draft.step — 계획 그대로, 표시는 "반영을 누르면") 하고 뒤따르는 click 은 무시, 반영을 눌러야 적용; 기준에서 놓으면 거둠, pointercancel 은 고른 것 그대로, 다른 포인터·꺼진 칸은 무시, 끌지 않을 때 올리면 미리보기', () => {
  const rows = S.rowsOfErp(REC);
  const staff = S.peopleOfErp(rows, { prjNo: P.prjNo, now: 1 });
  const plan = Object.assign({ prjNo: P.prjNo, year: 1, prjNm: P.prjNm, from: '2026-04', to: '2026-12', budgetPay: 30000000, budget: null, at: 1, by: '', note: '' }, staff);
  const st = mk({ data: d, staffPlans: { [K1]: plan }, staffRows: { [P.prjNo]: { at: 1, rows, others: {} } } });
  const kim = plan.people[1].id;
  const open = () => { st.staffEdit = { prjNo: P.prjNo, year: 1, id: kim }; st.staffDraft = { from: '2026-12-01', to: '2026-12-31', mode: 'rate', value: '' }; };
  const dec = () => st.staffPlans[K1].people.find((x) => x.id === kim).plan[8].amt;
  const listeners = {}, timers = [];
  const priorChrome = globalThis.chrome, priorTimeout = globalThis.setTimeout;
  const thenable = (v) => ({ then: (ok) => thenable(ok ? ok(v) : undefined) });
  globalThis.chrome = { storage: { local: { get: () => thenable({}), set: () => thenable() }, onChanged: { addListener() {} } }, runtime: { sendMessage: () => ({ then() {} }) } };
  globalThis.setTimeout = (fn) => { timers.push(fn); return 0; };
  try {
    const box = { dataset: { stprj: P.prjNo, styr: '1' } };
    const pv = { dataset: { default: 'hint' }, textContent: 'hint' };
    const applyBtn = { textContent: '반영' };
    const quickEl = { querySelector: (sel) => (sel === '.krext-st-step-pv' ? pv : null) };
    const strip = { dataset: { id: kim, kind: 'scale' }, closest: (sel) => (sel === '.krext-st-quick' ? quickEl : null) };
    const mkStep = (v) => {
      const c = { dataset: { step: String(v), preview: v ? `미리보기 ${v}` : '' }, disabled: false, cls: new Set(), captured: null, setPointerCapture(p) { c.captured = p; } };
      c.closest = (sel) => (sel === '[data-step]' || sel === '.krext-st-quick [data-preview]' ? c : sel === '.krext-st-steps' ? strip : sel === '[data-stprj]' ? box : sel === '.krext-st-quick' ? quickEl : null);
      c.classList = { toggle: (k, on) => { if (on) c.cls.add(k); else c.cls.delete(k); }, remove: (k) => c.cls.delete(k) };
      return c;
    };
    const steps = [-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50].map(mkStep);   // 5 가 기준
    strip.querySelectorAll = () => steps;
    const host = { addEventListener: (name, fn) => { listeners[name] = fn; }, contains: () => true, querySelector: (sel) => sel === 'details[data-stplan][open]' ? null : (sel === '[data-act="st-apply"]' ? applyBtn : { focus() {} }), querySelectorAll: () => [], ownerDocument: { elementFromPoint: (x) => steps[x] } };
    let draws = 0;
    U.bind(host, st, () => { draws++; });
    const on = () => steps.filter((c) => c.cls.has('krext-st-step-on')).map((c) => Number(c.dataset.step));
    const click = (dataset) => listeners.click({ target: { closest: () => ({ dataset, closest: () => box }) }, preventDefault() {} });
    open();
    listeners.pointerdown({ button: 0, pointerId: 1, target: steps[6], preventDefault() {} });
    assert.deepStrictEqual([on(), pv.textContent, steps[6].captured], [[10], '미리보기 10', 1], '누른 칸 — 기준부터 그 칸까지');
    listeners.pointermove({ pointerId: 1, clientX: 8, clientY: 0 });
    assert.deepStrictEqual([on(), pv.textContent], [[10, 20, 30], '미리보기 30'], '끌면 기준부터 손가락 밑 칸까지');
    listeners.pointermove({ pointerId: 1, clientX: 3, clientY: 0 });
    assert.deepStrictEqual([on(), pv.textContent], [[-20, -10], '미리보기 -20'], '기준을 넘어 줄이는 쪽으로');
    const d0 = draws;
    listeners.pointermove({ pointerId: 2, clientX: 0, clientY: 0 });
    assert.deepStrictEqual([on(), draws], [[-20, -10], d0], '다른 포인터는 무시 · 끄는 동안 다시 그리지 않음');
    listeners.pointerup({ pointerId: 1 });
    assert.deepStrictEqual([on(), pv.textContent, applyBtn.textContent, dec(), st.staffDraft.step, draws], [[-20, -10], '반영을 누르면 — 미리보기 -20', '반영 −20%', 2322000, { kind: 'scale', v: -20 }, d0], '놓으면 −20% 를 고르기만 — 계획 그대로 · 표시는 반영을 누르면 · 반영 단추에 값 · 다시 그리지 않음');
    click({ act: 'st-step', id: kim, kind: 'scale', step: '50' });
    assert.deepStrictEqual(st.staffDraft.step, { kind: 'scale', v: -20 }, '놓은 뒤의 click(포인터를 잡았던 칸)은 무시');
    timers.splice(0).forEach((fn) => fn());
    click({ act: 'st-apply', id: kim });
    assert.deepStrictEqual([dec(), st.staffEdit], [1858000, null], st.staffError || '반영을 누르면 −20% 반영(12월 2,322 × 0.8 = 1,857.6 → 1,858) · 폼 닫힘');
    open(); st.staffDraft.step = { kind: 'scale', v: 30 };
    listeners.pointerdown({ button: 0, pointerId: 3, target: steps[8], preventDefault() {} }); listeners.pointermove({ pointerId: 3, clientX: 5, clientY: 0 });
    assert.deepStrictEqual([on(), pv.textContent], [[], 'hint'], '기준 칸 위면 표시 없음');
    listeners.pointerup({ pointerId: 3 });
    assert.deepStrictEqual([st.staffDraft.step, dec(), !!st.staffEdit, applyBtn.textContent], [null, 1858000, true, '반영'], '기준에서 놓으면 고른 것을 거둠(폼은 그대로)');
    timers.splice(0).forEach((fn) => fn());
    st.staffDraft.step = { kind: 'scale', v: 30 };
    listeners.pointerdown({ button: 0, pointerId: 4, target: steps[2], preventDefault() {} }); listeners.pointercancel({ pointerId: 4 });
    assert.deepStrictEqual([on(), st.staffDraft.step, dec()], [[10, 20, 30], { kind: 'scale', v: 30 }, 1858000], 'pointercancel 은 고른 것 그대로(표시도 그것으로)');
    steps[0].disabled = true;
    listeners.pointerdown({ button: 0, pointerId: 5, target: steps[0], preventDefault() {} });
    assert.deepStrictEqual([on(), steps[0].captured], [[10, 20, 30], null], '꺼진 칸은 무시');
    listeners.pointermove({ pointerId: 6, target: steps[1], clientX: 0, clientY: 0 });
    assert.strictEqual(pv.textContent, '미리보기 -40', '끌지 않을 때 올리면 그 칸의 미리보기');
    listeners.pointermove({ pointerId: 6, target: { closest: () => null }, clientX: 0, clientY: 0 });
    assert.strictEqual(pv.textContent, 'hint', '벗어나면 안내(data-default)로');
    click({ act: 'st-step', id: kim, kind: 'scale', step: '10' });
    assert.deepStrictEqual([st.staffDraft.step, dec()], [{ kind: 'scale', v: 10 }, 1858000], '키보드(Enter·Space)의 click 도 고르기만');
    click({ act: 'st-apply', id: kim });
    assert.strictEqual(dec(), 2044000, st.staffError || '반영 — 1,858 × 1.1 = 2,043.8 → 2,044');
  } finally { globalThis.chrome = priorChrome; globalThis.setTimeout = priorTimeout; }
});
test('참여인력 변경 탭 — section({ only: "staff" }): 과제 칩·과제 카드(과제명 · 과제번호 · 기간 칸)·예산·변경이력·요약 세 칸 없이 제목 줄 뒤 별칭 · 과제 정보 링크, 연차 칩, 접히지 않는 참여인력 카드(머리 한 줄에 요약 + 단추 줄)만(2026-10-19 "너무 공간을 많이 차지함"), [참여연구원 변경] 단추는 보통 화면의 펼친 카드에만; bind().focus 는 주소의 과제·연차를 보는 상태로 두고 화면을 연다(저장된 staffView 가 뒤늦게 읽혀도 덮지 않음) · openTab 은 백그라운드 openExtTab 에 #tab&page=staff&only=staff&prj&year 주소를 보낸다', () => {
  const st = mk({ staffView: { years: {}, extra: {}, inc: { unbilled: true, plan: true }, fold: { staff: true } } });
  const folded = U.section(d, {}, st, '', EDIT);
  assert.ok(!folded.includes('data-act="st-tab"') && folded.includes('data-act="st-fold" data-card="staff"'), '접힌 카드: 단추는 몸통에 있으므로 없음');
  st.staffView.fold = {};
  const opened = U.section(d, {}, st, '', EDIT);
  assert.ok(opened.includes('data-act="st-tab" title="참여연구원 변경 — 이 과제 1차년도 의 참여연구원 계획(') && opened.includes('>참여연구원 변경 <svg'), '펼친 카드의 단추 하나 — 참여연구원 변경');
  const only = U.section(d, {}, st, '<b>T</b>', { edit: true, only: 'staff', tail: '' });
  assert.ok(only.includes('krext-st-focus') && only.includes('krext-st-only" data-stprj="2026-0063-01" data-styr="1"') && only.includes('<b>T</b>'));
  assert.ok(!only.includes('data-act="st-proj"') && !only.includes('data-card="budget"') && !only.includes('data-card="changes"') && !only.includes('data-card="project"') && !only.includes('data-act="st-tab"') && !only.includes('data-act="st-fold"') && !only.includes('data-act="st-alias"'), '과제 칩 · 과제 카드 접기·별칭 · 예산 · 변경이력 · 단추 없음');
  assert.ok(!only.includes('krext-ws-head') && !only.includes('data-stp=') && !only.includes('과제번호 ') && !only.includes('krext-st-overview') && !only.includes('계획 1개') && !only.includes('계획 2개') && !only.includes('계획 3개'), '과제 카드(과제명 · 과제번호 · 기간 칸) · 요약 세 칸 · 계획 수 없음');
  assert.ok(opened.includes('data-stp="from" value="2026-04"'), '기간 칸은 사업비 관리의 과제 카드에만');
  assert.ok(only.includes('<span class="krext-st-focus-prj" title="MW급 10kV 고전압 직류 시스템용 반도체 차단기 개발 · 2026-0063-01 · 책임자 김거화">') && only.includes('</span><a class="krext-ws-focus-link"') && only.includes('>과제 정보 '), '제목 줄 뒤 과제 이름(별칭이 없으면 과제명 앞부분 — 과제명·과제번호·책임자는 툴팁) · 과제 정보 링크');
  st.staffAliases = { [P.prjNo]: 'SSCB' };
  assert.ok(U.section(d, {}, st, '', { edit: true, only: 'staff' }).includes('책임자 김거화">SSCB</span><a class="krext-ws-focus-link"'), '별칭이 있으면 별칭만');
  delete st.staffAliases;
  assert.ok(only.includes('<div class="krext-ws-cardhead krext-ws-pinned">') && /krext-ws-pinned">.*?<span class="krext-ws-state" title="[^"]*">계획 없음<\/span><div class="krext-st-acts">/s.test(only) && only.includes('<details class="krext-st-plan-menu" data-stplan="2026-0063-01@1"><summary>계획 관리</summary>') && only.includes('data-act="st-init-erp"') && only.includes('data-act="st-init-prev"') && only.includes('</details><button type="button" class="krext-plan-btn" data-act="st-add"') && !only.includes('data-act="st-clear"'), '접히지 않는 머리: 인원과 참여인력 추가, 가져오기·초기화는 기본 접힌 계획 관리에(지우기는 계획이 있을 때만)');
  assert.ok(only.includes('class="krext-st-budgetline" aria-label="인건비 계획과 예산"') && only.includes('계획 인건비 <strong>—</strong>') && only.includes('예산 <strong>31,425</strong>') && only.includes('금액 단위: 천원'), '계획이 없을 때도 예산과 금액 단위는 별도 한 줄에 표시');
  assert.ok(only.includes('data-act="st-year" data-year="1"') && only.includes('data-act="st-year-add" data-year="3"'), '연차 칩');
  st.staffView.fold = { staff: true };
  assert.ok(U.section(d, {}, st, '', { edit: true, only: 'staff' }).includes('data-act="st-init-erp"'), '접어 둔 상태여도 펼쳐 보임');
  const priorChrome = globalThis.chrome, priorTimeout = globalThis.setTimeout;
  let loaded = null; const sent = [];
  globalThis.chrome = { storage: { local: { get: () => ({ then(ok) { loaded = ok; } }), set: () => {} }, onChanged: { addListener() {} } }, runtime: { getURL: (p) => `chrome-extension://abc/${p}`, sendMessage: (m) => { sent.push(m); return { then() {} }; } } };
  globalThis.setTimeout = () => 0;
  try {
    const st2 = mk({ staffView: { prjNo: P.prjNo, years: { [P.prjNo]: 1 }, extra: {}, inc: {}, fold: {} } });
    const api = U.bind({ addEventListener() {}, contains: () => true, querySelector: () => null }, st2, () => {});
    api.focus({ prjNo: P2.prjNo, year: 2 });
    assert.deepStrictEqual([st2.page, st2.staffView.prjNo, st2.staffView.years[P2.prjNo]], ['staff', P2.prjNo, 2], '주소의 과제·연차로 화면을 염');
    assert.ok(typeof loaded === 'function', 'bind 가 저장된 보기 상태를 읽는 중');
    loaded({ staffView: { prjNo: P.prjNo, years: { [P.prjNo]: 1 } } });
    assert.deepStrictEqual([st2.staffView.prjNo, st2.staffView.years[P2.prjNo], st2.staffView.years[P.prjNo]], [P2.prjNo, 2, 1], '저장된 보기 상태를 읽어도 주소의 과제·연차가 남음');
    api.openTab(P2.prjNo, 2);
    assert.deepStrictEqual(sent[sent.length - 1], { type: 'openExtTab', url: 'chrome-extension://abc/popup/popup.html#tab&page=staff&only=staff&prj=2026-0064-01&year=2' });
  } finally { globalThis.chrome = priorChrome; globalThis.setTimeout = priorTimeout; }
});
test('참여인력 탭 인건비 요약 — 예산과 같음·초과·부족·예산 미설정, 금액 단위를 유지하고 인원 머리와 구분', () => {
  const staff = S.peopleOfErp(S.rowsOfErp(REC), { prjNo: P.prjNo, now: 1 });
  const project = Object.assign({}, P, { budget: null });
  for (const [budget, kind, text] of [[31425000, 'even', '✓ 예산과 같음'], [30000000, 'over', '초과금 1,425천원'], [32000000, 'short', '부족금 575천원'], [null, '', '']]) {
    const plan = Object.assign({ prjNo: P.prjNo, year: 1, from: '2026-04', to: '2026-12', budgetPay: budget }, staff);
    const st = mk({ data: { projects: [project] }, staffPlans: { [K1]: plan } });
    const html = U.section(st.data, {}, st, '', TAB);
    const summary = html.match(/<div class="krext-st-budgetline"[^>]*>[\s\S]*?<\/div>/)[0];
    assert.ok(html.includes('>연구자 2명</span>') && summary.includes('계획 인건비 <strong>31,425</strong>') && summary.includes('금액 단위: 천원'));
    assert.ok(summary.includes(`예산 <strong>${budget == null ? '미설정' : S.thousand(budget)}</strong>`));
    if (kind) assert.ok(summary.includes(`class="krext-st-budgetstate krext-st-budget-${kind}">${text}</span>`), text);
    else assert.ok(!summary.includes('krext-st-budgetstate'), '예산이 없으면 차이를 꾸며 내지 않음');
    assert.ok(!U.section(st.data, {}, st, '', EDIT).includes('krext-st-budgetline'), '패널 보기에는 기존 요약 유지');
  }
});

test('2차년도 기본 기간·계획서 예산, 직접 적은 줄, 접기, 별칭 폼, rERP 조회 상태, 더하기 폼', () => {
  const st = mk({ research: { [rec2.id]: rec2 } });
  let html = U.section(d, {}, st, '', EDIT);
  assert.ok(html.includes('data-act="st-alias"') && html.includes('data-stp="from" value="2026-04"') && html.includes('data-stp="to" value="2026-12"'));
  assert.ok(html.includes('data-act="st-year-add" data-year="3"') && html.includes('(2028-01 ~ 2028-12)'));
  assert.ok(html.includes('data-stb="name" data-i="0" value="인건비"') && html.includes('data-stb="plan" data-i="0" value="31,425"') && html.includes('data-act="st-bdel" data-i="3"') && html.includes('data-act="st-badd"') && !html.includes('data-act="st-breset"'), '예산 칸·×·＋ 비목 (기본값이라 되돌리기 없음)');
  assert.ok(html.includes('data-act="st-tab"') && !html.includes('data-act="st-add"') && html.includes('rERP 참여인력을 아직 조회하지 않았습니다') && html.includes('<b>참여연구원 변경</b>에서 rERP 현재로'), '패널 카드: 편집 단추 없이 참여연구원 변경 안내');
  assert.ok(U.section(d, {}, st, '', TAB).includes('data-act="st-init-erp"') && U.section(d, {}, st, '', TAB).includes('data-act="st-add"'), '탭: 편집 단추');
  st.staffView.years[P.prjNo] = 2;
  html = U.section(d, {}, st, '', EDIT);
  assert.ok(html.includes('data-styr="2"') && html.includes('data-stp="from" value="2027-01"') && html.includes('data-stb="plan" data-i="0" value="35,900"') && html.includes('계획: 연구개발계획서 2차년도 r2') && html.includes('rERP 자금현황은 현재 연차(1차년도)만'), '2차년도: 12달 뒤 기간, 계획서 예산');
  st.staffPlans[K2] = { prjNo: P.prjNo, year: 2, budget: [{ name: '인건비', plan: 40000000 }], people: [] };
  html = U.section(d, {}, st, '', EDIT);
  assert.ok(html.includes('data-act="st-breset"') && html.includes('계획: 직접 적은 계획') && !html.includes('2차년도 지우기') && U.section(d, {}, st, '', TAB).includes('2차년도 지우기'), '지우기는 탭에만');
  st.staffView.fold = { budget: true, staff: true };
  html = U.section(d, {}, st, '', EDIT);
  assert.ok(html.includes('krext-ws-chev krext-closed') && !html.includes('krext-ws-bhead') && !html.includes('krext-st-status'), '접힌 카드는 머리만');
  st.staffView.fold = {}; st.staffAliasEdit = P.prjNo; st.staffAliasDraft = 'SS';
  html = U.section(d, {}, st, '', EDIT);
  assert.ok(html.includes('data-stalias value="SS"') && html.includes('data-act="st-alias-set"'));
  st.staffAliasEdit = null; st.staffView.years[P.prjNo] = 1;
  st.staffRows[P.prjNo] = { loading: true };
  assert.ok(/조회 중…/.test(U.section(d, {}, st, '', EDIT)));
  st.staffRows[P.prjNo] = { at: 1, rows: S.rowsOfErp(REC), others: {} };
  html = U.section(d, {}, st, '', EDIT);
  assert.ok(/krext-st-status" title="R&amp;D ERP 과제정보 › 참여인력 2명 · 이 기간 지급 2명 · [^"]+ 조회">rERP 2026-0063-01 · /.test(html) && html.includes('krext-st-view') && !html.includes('<b>계획 관리 → rERP 현재로</b>') && U.section(d, {}, st, '', TAB).includes('<b>계획 관리 → rERP 현재로</b>'), '조회 뒤 패널은 rERP 등록 표(인원은 툴팁), 탭은 계획 관리의 rERP 현재로 안내');
  st.staffEdit = { prjNo: P.prjNo, year: 1, id: 'new' }; st.staffDraft = { from: '2026-10', mode: 'rate', value: '20', name: '' };
  assert.ok(!U.section(d, {}, st, '', EDIT).includes('data-stf="name"'), '패널 카드에는 더하기 폼이 뜨지 않음(편집은 탭)');
  html = U.section(d, {}, st, '', TAB);
  assert.ok(html.includes('data-stf="name"') && html.includes('<input type="date" data-stf="from" value="2026-10-01" min="2026-04-01" max="2026-12-31"') && html.includes('type="date" data-stf="to" value=""') && html.includes('data-act="st-apply" data-id="new"') && !html.includes('value="exclude"'), '더하기 폼: 날짜 칸(달만 적은 초안은 1일), 제외가 없다');
});

test('Workspace 과제 머리 — 기본 접힘, 펼치면 메타·링크, 별칭 폼과 연차·기간은 접힌 상태에서도 사용', () => {
  const st = mk({ staffAliases: { [P.prjNo]: 'SSCB' } });
  let html = U.section(d, {}, st, '', EDIT);
  assert.ok(html.includes('data-card="project" aria-expanded="false"') && !html.includes('krext-ws-project-meta'));
  assert.ok(html.includes('data-act="st-proj" data-prj="2026-0063-01" aria-pressed="true"') && html.includes('data-act="st-proj" data-prj="2026-0064-01" aria-pressed="false"'));
  assert.ok(html.includes('data-act="st-year" data-year="1" aria-pressed="true"') && html.includes('data-act="st-year" data-year="2" aria-pressed="false"'));
  assert.ok(/<button type="button" class="krext-ws-cardhead[^>]*data-card="project"/.test(html));
  assert.ok(/<\/button><button type="button" class="krext-ws-edit"/.test(html), '별칭 단추는 접기 단추와 형제');
  st.staffAliasEdit = P.prjNo;
  html = U.section(d, {}, st, '', EDIT);
  assert.ok(html.includes('data-stalias') && html.includes('data-act="st-year"') && html.includes('data-stp="from"') && !html.includes('krext-ws-project-meta'));
  st.staffView.fold.project = false;
  html = U.section(d, {}, st, '', EDIT);
  assert.ok(html.includes('data-card="project" aria-expanded="true"') && html.includes('<dt>과제명</dt><dd>MW급 10kV 고전압 직류 시스템용 반도체 차단기 개발</dd><dt>과제번호</dt><dd>2026-0063-01</dd><dt>책임자</dt><dd>김거화</dd>'));
  assert.ok(html.includes('krext-ws-project-info') && html.includes('krext-ws-links'));
  for (const card of ['budget', 'staff', 'changes']) assert.ok(new RegExp(`<button type="button" class="krext-ws-cardhead" data-act="st-fold" data-card="${card}" aria-expanded="(?:true|false)"`).test(html), '기본 단추의 키보드 접기/펴기');
});
test('참여인력 계획이 있으면 — 카드 머리(연구자 n명 · 초과/부족), 패널 표는 보기만(성명 · 역할 책임/참여 · 월급여 · 참여 · 지급 합 · 참여율 · 월 최대 — WORKSPACE 와 같은 꼴), 탭 표는 칸·역할 선택·✎ ×, 달마다의 지급, rERP 등록(같음/다름), 알림, 예산 칸 인건비 줄의 참여연구원 합 메모', () => {
  const rows = S.rowsOfErp(REC);
  const staff = S.peopleOfErp(rows, { prjNo: P.prjNo, now: 1 });
  staff.people[0].erp.others = [{ ym: '2026-05', rate: 85, amt: 0 }];
  const plan = Object.assign({ prjNo: P.prjNo, year: 1, prjNm: P.prjNm, from: '2026-04', to: '2026-12', budgetPay: null, budget: null, at: 1, by: '김거화', note: 'rERP 등록 지급계획(4~12월) 그대로' }, staff);
  const st = mk({ staffPlans: { [K1]: plan }, staffRows: { [P.prjNo]: { at: 1, rows, others: {} } } });
  const html = U.section(d, {}, st, '', EDIT), tab = U.section(d, {}, st, '', TAB);
  assert.ok(html.includes('krext-ws-state" title="연구자 수 · 행정지원 수 · 인건비 계획 합 31,425 / 예산 31,425천원') && html.includes('>연구자 2명</span>') && html.includes('<span class="krext-badge">2</span>'), '참여인력 카드 머리(WORKSPACE 꼴 — 연구자 n명, 합·예산은 툴팁) · 연차 칩 배지');
  assert.ok(!html.includes('참여연구원 계획 합') && !html.includes('krext-ws-bnote'), '예산 칸 인건비 줄 아래 메모 없음(2026-10-20 뺌)');
  assert.ok(/krext-st-status" title="R&amp;D ERP 과제정보 › 참여인력 2명 · 이 기간 지급 2명 · [^"]+ 조회">rERP 2026-0063-01 · \d\d\.\d\d \d\d:\d\d 조회</.test(html), 'rERP 상태 줄은 과제번호 · 시각 조회(WORKSPACE 와 같은 꼴), 인원은 툴팁');
  const table = html.match(/<table class="krext-cards krext-st-table krext-st-view">[\s\S]*?<\/table>/)[0];
  assert.ok(table.includes('<thead><tr><th class="krext-st-nm">성명</th><th class="krext-st-role-cell">역할</th><th class="krext-num" title="천원">월급여</th><th title="기간 구간 (참여개월 — 일부 달은 날 수 비율)">참여</th><th class="krext-num" title="천원 — 월별 지급의 합(계상인건비)">지급 합</th><th class="krext-num">참여율</th></tr></thead>'), '패널 표 머리글 — 성명 · 역할 · 월급여 · 참여 · 지급 합 · 참여율(✎ × 칸 없음)');
  assert.ok(table.includes('<td class="krext-st-role-cell krext-dim" rowspan="1" title="참여연구원">참여</td>') && table.includes('title="과제책임자">책임</td>'), '역할은 참여 · 책임으로 짧게(저장값은 그대로)');
  assert.ok(table.includes('>5,823</td>') && table.includes('>4~12월 (9개월)</td>') && table.includes('>10,479</td>') && table.includes('>20.00%<span class="krext-st-tag krext-st-maxtag"') && table.includes('월 최대 20.01%') && table.includes('월 최대 27.46%'), '보기 칸: 월급여 · 참여(개월) · 지급 합 · 참여율 · 월 최대');
  assert.ok(!table.includes('data-stc=') && !html.includes('data-act="st-edit"') && !html.includes('data-act="st-drop"') && !html.includes('data-act="st-clear"') && html.includes('data-act="st-copy"') && html.includes('data-act="st-tab"'), '패널 카드에는 칸·✎·×·지우기 없음 — 복사와 참여연구원 변경만');
  assert.ok(tab.includes('data-stc="monthly"') && tab.includes('data-stc="total"') && tab.includes('data-stc="rate"') && tab.includes('data-act="st-edit"') && tab.includes('data-act="st-drop"') && tab.includes('data-act="st-clear"') && !tab.includes('data-act="st-tab"'), '참여연구원 변경 탭: 칸 · ✎ × · 지우기');
  assert.ok(tab.includes('<option value="과제책임자">책임</option><option value="참여연구원" selected>참여</option><option value="행정지원">행정</option>'), '탭의 역할 선택은 책임 · 참여 · 행정');
  assert.ok(html.includes('krext-st-months') && /<i>4월<\/i><b class="krext-st-max" title="2026-04 · 1,165천원 · 20\.01%">1,165<\/b>/.test(html) && /<i>12월<\/i><b title="2026-12 · 1,159천원 · 19\.91%">1,159<\/b>/.test(html) && html.includes('<span class="krext-st-mo krext-st-mo-none" title="2026-01 · 기간 밖"><i>1월</i><b></b></span>') && (html.match(/<div class="krext-st-mogrid" data-year="2026">/g) || []).length === 2 && !html.includes("'26."));
  assert.ok(html.includes('data-act="st-months" aria-pressed="false"') && !html.includes('krext-st-months-open'), '월별 지급은 기본 접힘, 데이터는 유지');
  assert.ok(html.includes('<div class="krext-ws-table-scroll" tabindex="0" role="region" aria-label="참여인력 표"><table class="krext-cards krext-st-table krext-st-view">') && tab.includes('aria-label="참여인력 계획 표"><table class="krext-cards krext-st-table krext-st-editable">'), '좁은 패널에서 사람 표만 키보드 가로 스크롤');
  const staffTools = html.slice(html.indexOf('<span class="krext-sub krext-dim krext-st-status"'), html.indexOf('<div class="krext-ws-table-scroll"'));
  assert.ok(staffTools.includes('class="krext-ico-btn" data-act="st-refresh" aria-label="rERP 참여인력 다시 조회"') && staffTools.includes('data-act="st-months"') && staffTools.includes('class="krext-ico-btn" data-act="st-copy" aria-label="참여인력 표 복사"'), '조회 상태와 새로고침·M·복사는 별도 도구 줄');
  st.staffView.months = true;
  const monthlyHtml = U.section(d, {}, st, '', EDIT);
  assert.ok(monthlyHtml.includes('krext-st-months-open') && monthlyHtml.includes('data-act="st-months" aria-pressed="true"'));
  assert.ok(html.includes('rERP 등록: 4~11월 1,165 · 12월 1,159 · 20.00% (월 최대 20.01%) · 같음'));
  assert.ok(html.includes('문창재 — 5월 참여율 합 105.01% (이 과제 20.01% · rERP 다른 과제 85.00%)'), '100% 초과 알림');
  assert.ok(!html.includes('krext-st-run') && !html.includes('<span>합 ') && html.includes('4~12월 (9개월)'), 'rERP 그대로면 사람마다 한 줄(자료생성의 마지막 달 잔액 행은 같은 구간)');
  assert.ok(html.includes('<small class="krext-st-sum" title="월평균 참여율 19.99% = 지급 합 10,479천원 ÷ (월급여 × 9개월), 소수점 셋째 자리 내림 — 10% 를 넘어야 합니다"><span>월평균 19.99%</span></small>'), '한 구간이어도 성명 밑에 월평균(셋째 자리 내림 — rERP 올림 20.00% 와 다름)');
  assert.ok(/인건비 합 31,425천원 — 예산과 같습니다/.test(html) && !html.includes('· 부족 ') && !html.includes('· 초과 '), '같으면 머리에 초과·부족 없음');
  plan.people[0] = S.applyChange(plan.people[0], 'rerp', { from: '2026-12', mode: 'exclude' }, S.ymRange('2026-04', '2026-12'));
  const html2 = U.section(d, {}, st, '', EDIT);
  assert.ok(html2.includes('krext-st-off') && /<i>12월<\/i><b class="krext-st-off" title="2026-12 · 제외">—<\/b>/.test(html2) && html2.includes('· <b>다름</b>') && /부족금 1,159천원/.test(html2) && html2.includes('>연구자 2명 · 부족 1,159</span>') && html2.includes('krext-ws-state krext-st-short'));
  assert.ok(html2.includes('krext-st-run') && html2.includes('12월 (1개월)') && html2.includes('<span class="krext-st-tag">제외</span>') && html2.includes('rowspan="2"') && html2.includes('<small class="krext-st-sum"'), '제외한 12월은 따로 한 줄(구간 둘 — 성명 칸은 rowspan, 연간 합은 성명 밑) — 패널 보기 표에도');
  plan.budget = [{ name: '인건비', plan: 30000000 }]; plan.budgetPay = 30000000;
  const html3 = U.section(d, {}, st, '', EDIT);
  assert.ok(/krext-st-error">인건비 합 30,266천원이 예산 30,000천원을 넘습니다 — 초과금 266천원/.test(html3) && html3.includes('>연구자 2명 · 초과 266</span>') && html3.includes('krext-ws-state krext-red'));
});
test('계획이 없는 패널 카드 — rERP 등록 지급계획(이 기간)을 보기 표로 보이고(WORKSPACE 와 같음) 머리는 연구자 n명, 100% 초과 알림만, 복사는 그 표; 탭은 안내와 편집 단추', () => {
  const rows = S.rowsOfErp(REC);
  const st = mk({ data: d, staffRows: { [P.prjNo]: { at: 1, rows, others: {} } }, staffSupport: { [P.prjNo]: { people: [{ name: '조주희', role: '행정 담당', ref: true }], at: 5 } } });
  const html = U.section(d, {}, st, '', EDIT);
  assert.ok(html.includes('>연구자 2명 · 행정 1명</span>') && html.includes('계획이 아직 없어 rERP 등록 지급계획(이 기간)을 보입니다 — 계획은 <b>참여연구원 변경</b>에서 세웁니다') && html.includes('<table class="krext-cards krext-st-table krext-st-view">') && html.includes('title="과제책임자">책임</td>') && html.includes('>10,479</td>') && !html.includes('krext-st-erp'), '머리 · 안내 · 보기 표(rERP 등록 줄은 계획일 때만)');
  assert.ok(!html.includes('<span class="krext-badge">') && !html.includes('참여연구원 계획 합'), '계획은 아니므로 연차 칩 배지·예산 메모 없음');
  const tab = U.section(d, {}, st, '', TAB);
  assert.ok(/>행정 1명( · 예산 [\d,]+천원)?<\/span>/.test(tab) && tab.includes('1차년도 인건비 계획이 아직 없습니다. <b>계획 관리 → rERP 현재로</b> 를 누르면') && !tab.includes('krext-st-view') && tab.includes('data-act="st-init-erp"'), '탭: 계획 관리 경로 안내와 편집 단추, rERP 표는 보이지 않음');
  withStaffActions(st, ({ click }) => {
    const prior = Object.getOwnPropertyDescriptor(globalThis, 'navigator'); let copied = '';   // Node 21+ 의 navigator 는 setter 없는 getter — defineProperty 로 바꾼다
    Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: (t) => { copied = t; return { then(ok) { ok(); } }; } } }, configurable: true, writable: true });
    try { click('st-copy'); } finally { if (prior) Object.defineProperty(globalThis, 'navigator', prior); else delete globalThis.navigator; }
    const lines = copied.split('\n');
    assert.ok(lines.length === 4 && lines[1].startsWith('문창재\t참여연구원\t5,823') && lines[3].startsWith('조주희\t행정지원\t\t과제 공통'), '복사는 보이는 rERP 등록 표 + 행정지원 줄');
  });
});
test('기간 구간 줄 — 12월부터 참여율을 바꾸면 구간마다 한 줄(4~11월 27.46% · 12월 20.00%), 구간 줄의 칸은 그 구간만 바꾸고, 예산을 넘어도 막지 않고 초과금·부족금을 메시지에', () => {
  const rows = S.rowsOfErp(REC);
  const staff = S.peopleOfErp(rows, { prjNo: P.prjNo, now: 1 });
  const months = S.ymRange('2026-04', '2026-12');
  staff.people[1] = S.applyChange(staff.people[1], 'rerp', { from: '2026-12', mode: 'rate', value: 20 }, months);
  const plan = Object.assign({ prjNo: P.prjNo, year: 1, prjNm: P.prjNm, from: '2026-04', to: '2026-12', budgetPay: null, budget: null, at: 1, by: '', note: '' }, staff);
  const st = mk({ data: d, staffPlans: { [K1]: plan }, staffRows: { [P.prjNo]: { at: 1, rows, others: {} } } });
  let html = U.section(d, {}, st, '', TAB);
  const kim = html.slice(html.indexOf('<b>김거화</b>'));
  assert.ok(html.includes('>연구자 2명</span>') && html.includes('계획 인건비 <strong>30,799</strong>') && html.includes('예산 <strong>31,425</strong>') && html.includes('class="krext-st-budgetstate krext-st-budget-short">부족금 626천원</span>') && U.section(d, {}, st, '', EDIT).includes('>연구자 2명 · 부족 626</span>'), '탭은 인원 머리와 계획·예산·부족금 요약을 분리하고 패널은 기존 머리 유지');
  assert.ok(kim.includes('<small class="krext-st-sum" title="연간 — 계상인건비 합 20,320천원 · 월평균 참여율 26.62% = 지급 합 20,320천원 ÷ (월급여 × 9개월), 소수점 셋째 자리 내림 — 10% 를 넘어야 합니다 · 월 최대 27.46%(2026-04)"><span>합 20,320</span><span>월평균 26.62%</span><span>월 최대 27.46%</span></small>'), '연간 합·월평균(셋째 자리 내림)·월 최대는 성명 밑(조각마다 줄바꿈 없이)');
  assert.ok(kim.includes('4~11월 (8개월)') && kim.includes('data-stc="total" data-id="' + staff.people[1].id + '" data-r="0" value="18,624"') && kim.includes('data-stc="rate" data-id="' + staff.people[1].id + '" data-r="0" value="27.46"'), '첫 구간 줄');
  assert.ok(kim.includes('<tr class="krext-st-row krext-st-run"') && kim.includes('12월 (1개월)') && kim.includes('data-r="1" value="1,696"') && kim.includes('data-r="1" value="20.00"') && !kim.includes('data-r="1" value="20.00" placeholder="—" inputmode="decimal" title="이 구간의 참여율(%) = 계상인건비 ÷ (월급여 × 참여개월), rERP 올림 — 바꾸면 이 구간마다 round천원(월급여 × %)"><span class="krext-st-tag krext-st-maxtag"'), '둘째 구간 줄 — 월 최대 태그는 구간 줄에 없음');
  assert.ok(kim.includes('rERP 등록: 4~11월 2,328 · 12월 2,322 · 27.45% (월 최대 27.46%) · <b>다름</b>'));
  st.staffEdit = { prjNo: P.prjNo, year: 1, id: staff.people[1].id }; st.staffDraft = { from: '2026-12-15', to: '', mode: 'rate', value: '20' };
  html = U.section(d, {}, st, '', TAB);
  assert.ok(!U.section(d, {}, st, '', EDIT).includes('data-stf="from"'), '패널 카드에는 폼이 뜨지 않음');
  assert.ok(html.includes('<input type="date" data-stf="from" value="2026-12-15" min="2026-04-01" max="2026-12-31"') && html.includes('value="exclude"'), '✎ 폼은 적용일·종료일 날짜 칸');
  // bind 의 change — 구간 줄의 참여율 칸은 그 구간만, 예산을 넘어도 반영하고 초과금을 빨갛게
  const listeners = [], writes = [];
  const priorChrome = globalThis.chrome, priorTimeout = globalThis.setTimeout;
  globalThis.chrome = { storage: { local: { get: () => ({}), set: (v) => writes.push(v) }, onChanged: { addListener() {} } }, runtime: { sendMessage: () => ({ then() {} }) } };
  globalThis.setTimeout = () => 0;
  try {
    const host = { addEventListener: (name, fn) => listeners.push([name, fn]), contains: () => true, querySelector: () => null };
    U.bind(host, st, () => {});
    const change = listeners.find((l) => l[0] === 'change')[1];
    const fire = (dataset, value) => change({ target: { dataset, value, closest: () => ({ dataset: { stprj: P.prjNo, styr: '1' } }) } });
    const id = staff.people[1].id;
    fire({ stc: 'rate', id, r: '1' }, '25');
    let s = S.personStats(st.staffPlans[K1].people[1], 'rerp');
    assert.deepStrictEqual([s.runs.map((r) => [S.spanText(r.from, r.to), r.rate]), st.staffMsg.error], [[['4~11월', 27.46], ['12월', 25]], false], '12월 구간만 25%');
    assert.ok(/김거화 — 참여율 12월: .* → .* · 부족금 202천원/.test(st.staffMsg.text), st.staffMsg.text);
    fire({ stc: 'total', id, r: '0' }, '20,000');
    s = S.personStats(st.staffPlans[K1].people[1], 'rerp');
    assert.deepStrictEqual([s.runs.map((r) => r.amt), st.staffMsg.error], [[20000000, 2120000], true], '4~11월 구간만 20,000천원 — 예산을 넘어도 반영');
    assert.ok(/초과금 1,174천원/.test(st.staffMsg.text) && writes.some((w) => w.staffPlans), st.staffMsg.text);
    fire({ stc: 'rate', id }, '27.45');
    s = S.personStats(st.staffPlans[K1].people[1], 'rerp');
    assert.deepStrictEqual([s.runs.length, s.total, st.staffPlans[K1].people[1].cuts], [1, 20952000, []], '구간 번호 없이(사람 줄) 바꾸면 통째로 — 경계도 사라짐');
  } finally { globalThis.chrome = priorChrome; globalThis.setTimeout = priorTimeout; }
});

test('변경이력 — changeEntry(WORKSPACE CHANGE_KINDS 와 같은 칸) · appendChanges(id 합집합 · at 차례 · 최대 500) · newestFirst · changesOf', () => {
  assert.deepStrictEqual(U.CHANGE_KINDS, ['예산', '연구내용', '연구기간', '연구진', '기타']);
  const e = U.changeEntry({ kind: '예산', item: '인건비', before: '31,425천원', after: '35,900천원', by: '김거화', now: Date.UTC(2026, 9, 18, 3) + new Date().getTimezoneOffset() * 60000 });
  assert.ok(/^[a-z0-9]{8,}$/.test(e.id) && e.date === '2026-10-18' && e.kind === '예산' && e.item === '인건비' && e.before === '31,425천원' && e.after === '35,900천원' && e.reason === '' && e.by === '김거화' && e.auto === false && e.at > 0, JSON.stringify(e));
  assert.strictEqual(U.changeEntry({ kind: '엉뚱' }).kind, '기타', '모르는 구분은 기타');
  assert.strictEqual(U.changeEntry({ item: 'x'.repeat(200), before: 'y'.repeat(400) }).item.length, 100);
  const a = { id: 'a', at: 1, date: '2026-10-01' }, b = { id: 'b', at: 3, date: '2026-10-03' }, c = { id: 'c', at: 2, date: '2026-10-02' };
  assert.deepStrictEqual(U.appendChanges([b, a], c).map((x) => x.id), ['a', 'c', 'b'], 'at 차례');
  assert.deepStrictEqual(U.appendChanges([a, b], [{ id: 'b', at: 3, date: '2026-10-03', reason: '사유' }]).map((x) => [x.id, x.reason || '']), [['a', ''], ['b', '사유']], '같은 id 는 칸을 덧씀(합집합)');
  assert.deepStrictEqual(U.appendChanges(null, null), []);
  const many = []; for (let i = 0; i < 520; i++) many.push({ id: `m${i}`, at: i + 10 });
  const capped = U.appendChanges(many, { id: 'new', at: 1 });
  assert.deepStrictEqual([capped.length, capped[0].id, capped[capped.length - 1].id], [500, 'm20', 'm519'], '500 을 넘으면 오래된 것(at 작은 것)부터 버림');
  assert.deepStrictEqual(U.newestFirst([a, b, c, { id: 'd', at: 9, date: '2026-10-03' }]).map((x) => x.id), ['d', 'b', 'c', 'a'], '날짜 역순, 같은 날은 at 큰 것부터');
  assert.deepStrictEqual(U.changesOf({ staffChanges: { [K1]: [a] } }, P.prjNo, 1), [a]);
  assert.deepStrictEqual([U.changesOf({}, P.prjNo, 1), U.changesOf({ staffChanges: { [K1]: 'x' } }, P.prjNo, 1)], [[], []]);
});
test('변경이력 카드 — 기본 접힘, 펼치면 날짜 역순 이벤트와 사유(WORKSPACE 의 auto 줄도), 없으면 안내; openOf 토글 규칙', () => {
  const ch = [
    { id: 'a', date: '2026-10-01', kind: '예산', item: '인건비', before: '31,425천원', after: '35,900천원', reason: '', by: '김거화', at: 1, auto: false },
    { id: 'b', date: '2026-10-05', kind: '연구기간', item: '연구기간', before: '2026-04-01 ~ 2026-12-31', after: '2026-04-01 ~ 2027-03-31', reason: '연장', by: '', at: 2, auto: true },
  ];
  const st = mk({ staffChanges: { [K1]: ch } });
  let html = U.section(d, {}, st, '', EDIT);
  assert.ok(html.includes('data-card="changes"') && html.includes('변경이력') && html.includes('2건 · 마지막 2026-10-05') && !html.includes('krext-ws-changes'), '접힘: 머리만');
  st.staffView.fold.changes = false;
  html = U.section(d, {}, st, '', EDIT);
  const i1 = html.indexOf('2026-10-05'), i2 = html.indexOf('2026-10-01');
  assert.ok(html.includes('<ul class="krext-ws-changes krext-ws-change-list">') && i1 > 0 && i2 > i1, '펼침: 날짜 역순 이벤트');
  assert.ok(html.includes('<span class="krext-ws-change-date">2026-10-01</span><span class="krext-ws-kind">예산</span><strong class="krext-ws-change-title">인건비</strong>') && html.includes('<p class="krext-ws-diff"><s>31,425천원</s><span class="krext-ws-arrow">→</span><b>35,900천원</b></p>') && html.includes('연장') && html.includes('자동</small>'));
  assert.ok(html.includes('<details class="krext-ws-reason" data-streason="b">') && !html.includes('data-streason="a"'), '사유가 있는 변경만 펼침 제공');
  st.staffView.reasons.b = true;
  assert.ok(U.section(d, {}, st, '', EDIT).includes('<details class="krext-ws-reason" data-streason="b" open>'), '다시 그려도 펼친 사유를 유지');
  st.staffView.years[P.prjNo] = 2;
  assert.ok(/변경이력이 없습니다/.test(U.section(d, {}, st, '', EDIT)), '다른 연차는 없음 안내');
  const v = { fold: {} };
  assert.deepStrictEqual([U.openOf(v, 'budget'), U.openOf(v, 'staff'), U.openOf(v, 'changes'), U.openOf(v, 'project')], [true, true, false, false], '기본: 예산·참여인력 펴짐, 과제 정보·변경이력 접힘');
  assert.deepStrictEqual([U.openOf({ fold: { budget: true } }, 'budget'), U.openOf({ fold: { changes: false } }, 'changes'), U.openOf({ fold: { changes: true } }, 'changes')], [false, true, false]);
});
test('공유 줄 — 공유 (Plus) 가 켜져 있을 때만: 폴더 이름 · 폴더 열기 · 참여연구원에게 공유 · 링크 복사 · 주소 복사 · 공유 결과(n명 · 겹침 · 못 찾음); 남의 폴더면 공유 단추 없음; 폴더를 모르면 지금 동기화; 연차 파일 링크', () => {
  const pages = { [P.prjNo]: { prjNo: P.prjNo, title: P.prjNm, folder: 'SSCB', folderUrl: 'https://x.sharepoint.com/personal/u/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fu%2FDocuments%2F%EC%97%85%EB%AC%B4%2Fshared%2FSSCB', webUrl: 'https://x.sharepoint.com/personal/u/Documents/%EC%97%85%EB%AC%B4/shared/SSCB/1%EC%B0%A8%EB%85%84%EB%8F%84.json', years: [1], at: 5,
    share: { shared: [{ name: '문창재', email: 'a@krs.co.kr' }], ambiguous: [{ name: '김철수', candidates: ['김철수(A)', '김철수(B)'] }], notFound: ['홍길동'], role: 'edit', at: 6 } } };
  const st = mk({ staffSync: { at: 5, ok: true, count: 1, base: { path: '/personal/u/Documents/업무/shared' }, pages } });
  st.staffView.fold.project = false;
  const off = U.section(d, {}, st, '', EDIT);
  assert.ok(!off.includes('krext-ws-share') && !off.includes('data-act="st-share-people"') && off.includes('연차 파일'), '꺼짐: 공유 줄 없음(연차 파일 링크는 있음)');
  const on = U.section(d, { plus: { enabled: true } }, st, '', EDIT);
  assert.ok(on.includes('krext-ws-share') && on.includes('<b class="krext-ws-share-f"') && on.includes('>SSCB</b>') && on.includes('폴더 열기') && on.includes('onedrive.aspx?id=') , '폴더 이름 · 열기');
  assert.ok(on.includes('data-act="st-share-people"') && on.includes('data-act="st-share-link"') && on.includes('data-act="st-share-copy"') && !on.includes('data-act="st-share-sync"'));
  assert.ok(on.includes('공유 1명 · 이름 겹침 1 · 못 찾음 1') && on.includes('김철수(김철수(A)/김철수(B))') && on.includes('못 찾음: 홍길동') && !on.includes('a@krs.co.kr'), '공유 결과와 툴팁(이메일은 화면에 안 보임)');
  assert.ok(on.includes(`공유: ${KRX_FMT.fmtClock(5)} · 과제 1개 · /personal/u/Documents/업무/shared`), '바닥 공유 줄은 base 경로·과제 수');
  pages[P.prjNo].owner = '김거화';
  const theirs = U.section(d, { plus: { enabled: true } }, st, '', EDIT);
  assert.ok(theirs.includes('김거화 의 폴더') && !theirs.includes('data-act="st-share-people"') && theirs.includes('data-act="st-share-link"'), '남의 폴더: 참여연구원 공유 단추 없음');
  st.staffSync = { at: 5, ok: true, pages: { [P.prjNo]: { prjNo: P.prjNo, title: P.prjNm, noFolder: true } } };
  const none = U.section(d, { plus: { enabled: true } }, st, '', EDIT);
  assert.ok(none.includes('data-act="st-share-sync"') && none.includes('과제 폴더가 아직 없습니다') && !none.includes('data-act="st-share-people"'), '폴더 없음: 지금 동기화');
  st.staffShareBusy = P.prjNo; st.staffShareMsg = { prjNo: P.prjNo, text: '맞추는 중…', error: false };
  const busy = U.section(d, { plus: { enabled: true } }, st, '', EDIT);
  assert.ok(busy.includes('동기화 중…') && busy.includes('disabled') && busy.includes('krext-ws-share-r">맞추는 중…'));
  st.staffSync = null; st.staffShareBusy = null; st.staffShareMsg = null;
  assert.ok(U.section(d, { plus: { enabled: true } }, st, '', EDIT).includes('과제 폴더를 아직 모릅니다'), '공유 결과가 아직 없어도 줄은 보임');
});

// 통합 인력 표의 이벤트와 저장 결과를 함께 확인한다. 저장소는 매번 실제로 갱신해 다른 과제 보존도 검사한다.
test('자료 요청 구역(참여연구원 변경 탭만, 0.8.9) — 요청이 없으면 설명 + [자료 요청 만들기](대상 = 계획의 연구원, 행정지원 제외); 요청이 있으면 양식 줄 · 사람 표(이메일 칸 · 공유 상태 · 응답 · 팀즈 딥 링크) · 팀즈 글 · 응답 표([반영] · 다른 과제는 100% 검사); 다른 과제 응답이 100% 초과 알림에; 패널 카드에는 없음', () => {
  const months = S.ymRange('2026-04', '2026-12');
  const mkPlan = () => ({ prjNo: P.prjNo, year: 1, from: '2026-04', to: '2026-12', basis: 'rerp', src: 'manual', at: 1, people: [S.normalizePerson({ id: 'a', name: '문창재', role: '참여연구원', manual: 5823000, plan: months.map((ym) => ({ ym, amt: 1165000 })) }), S.normalizePerson({ id: 'b', name: '홍길동', role: '행정지원', plan: [] })] });
  const plan = mkPlan();
  const st = mk({ data: d, staffPlans: { [K1]: plan }, staffAliases: { [P.prjNo]: 'SSCB' } });
  let html = U.section(d, {}, st, '', TAB);
  assert.ok(html.includes('<div class="krext-st-collect" data-cokey="2026-0063-01@1" data-cono="1">') && html.includes('data-act="st-co-create"') && html.includes('대상 1명: 문창재') && !html.includes('data-act="st-co-fetch"') && !html.includes('data-act="st-co-new"'), '요청 없음 — 새 요청 폼(1번째)과 만들기 단추(행정지원은 대상 아님), [요청 추가]는 요청이 있을 때만');
  assert.ok(html.includes('<input type="checkbox" data-stco-ask="Rate" checked> 참여율') && html.includes('<input type="checkbox" data-stco-ask="Monthly" checked> 월급여') && html.includes('<input type="checkbox" data-stco-ask="Allowance"> 남은 연구수당'), '양식에 둘 칸 체크 상자 — 기본 참여율·월급여');
  const noneHtml = U.section(d, {}, Object.assign({}, st, { staffCollectAsk: { [K1]: [] } }), '', TAB);
  assert.ok(noneHtml.includes('data-stco-ask="Rate">') && /data-act="st-co-create"[^>]*disabled/.test(noneHtml), '하나도 안 고르면 만들기 단추 꺼짐');
  assert.ok(!U.section(d, {}, st, '').includes('krext-st-collect'), '패널 카드에는 없음');
  assert.deepStrictEqual(U.collectNames(st, P.prjNo, 1, plan, null), ['문창재']);
  assert.deepStrictEqual(U.collectNames(Object.assign({}, st, { staffWho: '문 창재' }), P.prjNo, 1, plan, null), [], '내 이름(rERP 로그인)은 대상에서 뺌');
  const req = { prjNo: P.prjNo, year: 1, title: 'KR 참여현황 SSCB 1차년도', listId: '11111111-2222-3333-4444-000000000001', site: 'https://krclass-my.sharepoint.com/personal/kimghw_krs_co_kr', path: '/personal/kimghw_krs_co_kr/Lists/KR 참여현황 SSCB 1차년도',
    listUrl: 'https://krclass-my.sharepoint.com/personal/kimghw_krs_co_kr/Lists/KR%20x/AllItems.aspx', formUrl: 'https://krclass-my.sharepoint.com/personal/kimghw_krs_co_kr/Lists/KR%20x/NewForm.aspx', createdAt: 1000, by: '김거화',
    people: [{ name: '문창재', email: 'cjmoon@krs.co.kr', title: 'MOON Changjae', status: 'shared', sharedAt: 2000 }, { name: '김철수', email: '', status: 'notFound' }, { name: '이영희', email: 'lee@krs.co.kr', status: 'ambiguous', candidates: ['이영희 (연구)', '이영희 (기획)'] }],
    responses: [{ id: '3', by: 'MOON Changjae', email: 'cjmoon@krs.co.kr', name: '문창재', title: '이 과제', from: '2026-10', to: '2026-12', rate: 25, monthly: 6000000, note: '10월부터', at: 5000 }, { id: '4', by: 'MOON Changjae', email: 'cjmoon@krs.co.kr', name: '문창재', title: '선박 과제', from: '2026-10', to: '2026-12', rate: 80, monthly: null, note: '', at: 4000 }, { id: '5', by: 'NEW Person', email: 'new@krs.co.kr', name: '박보람', title: '', from: '2026-11', to: '2026-12', rate: 10, monthly: 4000000, allowance: 3000000, note: '', at: 3000 }], applied: {} };
  st.staffCollect = { [K1]: req };
  html = U.section(d, {}, st, '', TAB);
  const sec = html.match(/<div class="krext-st-collect"[\s\S]*$/)[0];
  assert.ok(sec.includes('<b title="KR 참여현황 SSCB 1차년도">') && sec.includes('href="https://krclass-my.sharepoint.com/personal/kimghw_krs_co_kr/Lists/KR%20x/NewForm.aspx" target="_blank"') && sec.includes('공유 1/3명 · 응답 2명 (3건) · 미반영 2건'), '양식 줄');
  assert.ok(sec.includes('>참여율 · 월급여</span>') && !sec.includes('참여율 · 월급여 · 남은 연구수당') && sec.includes('<th class="krext-num" title="천원 — 연구수당 상자를 켜고 반영하면 그 사람의 참고 값으로 적어 둡니다(지급 계획에는 들지 않음)">남은 연구수당</th>'), '양식 정보에 고른 칸 — ask 없는 요청은 기본; 남은 연구수당 열은 응답에 있어 보임');
  const allowSec = U.section(d, {}, Object.assign({}, st, { staffCollect: { [K1]: Object.assign({}, req, { ask: ['Monthly', 'Allowance'], responses: [Object.assign({}, req.responses[0], { allowance: 1200000 })] }) } }), '', TAB).match(/<div class="krext-st-collect"[\s\S]*$/)[0];
  assert.ok(allowSec.includes('>월급여 · 남은 연구수당</span>') && allowSec.includes('>남은 연구수당</th>') && allowSec.includes('<td class="krext-num">1,200</td>'), '남은 연구수당을 물은 요청은 열이 생기고 천원으로');
  const progressOf = (patch) => U.section(d, {}, Object.assign({}, st, { staffCollect: { [K1]: Object.assign({}, req, patch) } }), '', TAB).match(/role="progressbar"[^>]*>/);
  const partialProgress = progressOf({}), emptyProgress = progressOf({ responses: [] }), completeProgress = progressOf({ people: [req.people[0]] });
  assert.ok(partialProgress[0].includes('aria-valuenow="33"') && partialProgress[0].includes('aria-valuetext="3명 중 1명 응답"'), '응답률은 요청 대상자 중 회신한 사람 — 같은 사람의 여러 응답과 대상 밖 응답은 중복 계산하지 않음');
  assert.ok(emptyProgress[0].includes('aria-valuenow="0"') && emptyProgress[0].includes('aria-valuetext="3명 중 0명 응답"'), '응답이 없으면 0%');
  assert.ok(completeProgress[0].includes('aria-valuenow="100"') && completeProgress[0].includes('aria-valuetext="1명 중 1명 응답"'), '대상 전원이 응답하면 대상 밖 응답이 있어도 100%');
  assert.strictEqual(progressOf({ people: [] }), null, '대상이 없으면 응답률 막대를 표시하지 않음');
  assert.ok(sec.includes('>회신</span> 2건') && sec.includes('>보내기 전</span>') && !sec.includes('미회신') && sec.includes('data-cosent="!"') && sec.includes('안 온 사람에게 팀즈 (1)') && !sec.includes('data-act="st-co-resend"'), '회신 / 보내기 전(보낸 적 없음) — 팀즈 MCP 없이는 회신 없는 사람(이영희)과의 딥 링크');
  assert.ok(/<span class="krext-st-co-ok">회신<\/span> 2건 · [^<]+<small class="krext-st-co-last" title="[^"]*">이 과제 · 2026-10~2026-12 · 25% · 월급여 6,000천원 · (&quot;|")10월부터(&quot;|")<\/small>/.test(sec) && !/krext-st-co-last">[^<]*선박 과제/.test(sec), '사람 표의 응답 칸에 그 사람의 마지막 응답(항목 · 기간 · 참여율 · 월급여 · 비고)만 한 줄로(2026-10-20 "결과를 이 웹으로 … 연봉, 참여율, 연구수당, 기간")');
  assert.ok(U.section(d, {}, Object.assign({}, st, { staffCollect: { [K1]: Object.assign({}, req, { responses: [] }) } }), '', TAB).includes('회신이 올 때까지 자동 갱신 주기마다 저절로 가져옵니다'), '응답이 없으면 자동 갱신 안내');
  const stateSec = (patch) => U.section(d, {}, Object.assign({}, st, { staffCollect: { [K1]: Object.assign({}, req, { people: req.people.map((x) => (x.name === '이영희' ? Object.assign({}, x, patch) : x)) }) } }), '', TAB);
  assert.ok(stateSec({ sentAt: 3000 }).includes('>미회신</span><small title="팀즈로 보낸(또는 보내기를 누른) 시각">보냄 '), '보냈는데 응답이 없으면 미회신 + 보낸 시각');
  const failedSec = stateSec({ sendError: '1:1 채팅이 없습니다' });
  assert.ok(failedSec.includes('title="1:1 채팅이 없습니다">보내기 실패</span>') && !failedSec.includes('미회신'), '보내기 실패면 미회신이라 하지 않음(2026-10-20 "보내기 실패인데 무슨 미회신이냐")');
  const mcpSec = U.section(d, {}, Object.assign({}, st, { teamsStatus: { ok: true } }), '', TAB);
  assert.ok(mcpSec.includes('data-act="st-co-resend"') && mcpSec.includes('안 온 사람 다시 보내기 (1)'), '팀즈 MCP 가 연결돼 있으면 [안 온 사람 다시 보내기]');
  const two = Object.assign({}, st, { staffCollect: { [K1]: req, [`${K1}#2`]: Object.assign({}, req, { no: 2, title: 'KR 참여현황 SSCB 1차년도 (2)', ask: ['Allowance'], responses: [] }) } });
  const twoHtml = U.section(d, {}, two, '', TAB);
  assert.ok(twoHtml.includes('요청 2개') && twoHtml.includes('data-act="st-co-new"') && twoHtml.includes('data-cokey="2026-0063-01@1" data-cono="1"') && twoHtml.includes('data-cokey="2026-0063-01@1#2" data-cono="2"') && twoHtml.includes('<strong>요청 2</strong>') && !twoHtml.includes('data-act="st-co-create"'), '요청 둘 — 카드 둘 + [요청 추가], 새 요청 폼은 누르기 전엔 없음');
  const newHtml = U.section(d, {}, Object.assign({}, two, { staffCollectNew: { [K1]: true } }), '', TAB);
  assert.ok(newHtml.includes('data-cokey="2026-0063-01@1#3" data-cono="3"') && newHtml.includes('data-act="st-co-create"') && newHtml.includes('<strong>새 요청 3</strong>'), '[요청 추가] → 3번째 새 요청 폼');
  assert.deepStrictEqual(Object.keys(U.collectBook(two, P.prjNo, 1, P)), ['문창재'], '다른 과제 책은 요청 모두에서 모음');
  st.teamsStatus = { ok: true };
  withStaffActions(st, ({ click, sent, storageChange, draws }) => {
    const d0 = draws();
    click('st-co-resend');
    const m = sent.find((x) => x.type === 'collectSend');
    assert.ok(m && m.no === 1 && m.names.join() === '이영희' && /양식/.test(m.message), '[안 온 사람 다시 보내기] — 이메일은 있는데 회신이 없는 사람(이영희)에게만, 요청 no 와 함께');
    assert.strictEqual(draws(), d0, '보내기 시작은 누른 단추만 바꾸고 카드를 다시 그리지 않음(2026-10-20 "한사람 보내기 하는데 왜 둘다 깜박이냐")');
    storageChange({ staffCollect: { newValue: { [K1]: Object.assign({}, req, { fetchedAt: 9 }) } } }, 'local');
    assert.ok(st.staffCollect[K1].fetchedAt === 9 && draws() === d0, '보내는 동안 백그라운드가 저장한 요청은 상태에만 받고 그리지 않음 — 끝났을 때 한 번');
    st.staffCollect = { [K1]: req }; st.staffCollectBusy = null;
    click('st-co-send', { name: '이영희' });
    const m2 = sent.filter((x) => x.type === 'collectSend')[1];
    assert.ok(m2 && m2.names.join() === '이영희' && draws() === d0, '[보내기]/[다시 보내기] 한 사람 — 역시 시작 때 다시 그리지 않음');
    st.staffCollectBusy = null;
  });
  st.teamsStatus = null;
  const againSec = U.section(d, {}, Object.assign({}, st, { teamsStatus: { ok: true }, staffCollect: { [K1]: Object.assign({}, req, { people: req.people.map((x) => (x.name === '이영희' ? Object.assign({}, x, { sentAt: 3000 }) : x)) }) } }), '', TAB);
  assert.ok(/data-act="st-co-send" data-name="이영희"[^>]*>다시 보내기<\/button>/.test(againSec) && /data-act="st-co-send" data-name="문창재"[^>]*>보내기<\/button>/.test(againSec) && /data-cosent="이영희"[^>]*>채팅 열기<\/a>/.test(againSec) && /data-cosent="이영희"[^>]*>다시 팀즈로 보내기<\/a>/.test(stateSec({ sentAt: 3000 })), '보냈는데 회신이 없으면 [다시 보내기](MCP 없으면 [다시 팀즈로 보내기]), 회신한 사람은 [보내기](2026-10-20 "보내고 다시 보내기 기능")');
  st.teamsStatus = null;
  assert.ok(sec.includes('data-act="st-co-fetch"') && sec.includes('data-act="st-co-share"') && sec.includes('data-act="st-co-copy"') && sec.includes('data-act="st-co-remove"') && !sec.includes('data-act="st-co-create"'), '단추 줄');
  assert.ok(sec.includes('data-stco="email" data-name="김철수" value=""') && sec.includes('못 찾음 — 이메일을 적으세요') && sec.includes('이름 겹침 — 이메일을 적으세요') && sec.includes('title="이영희 (연구) / 이영희 (기획)"') && sec.includes('>공유됨</span>'), '사람 표 — 이메일 칸 · 상태');
  const ambSec = U.section(d, {}, Object.assign({}, st, { staffCollect: { [K1]: Object.assign({}, req, { people: [{ name: '이은주', email: '', status: 'ambiguous', candidates: ['이은주 (자율운항연구팀 책임) <ejlee@krs.co.kr>', '이은주 (해양 선임) <ejlee2@krs.co.kr>'] }] }) } }), '', TAB).match(/<div class="krext-st-collect"[\s\S]*$/)[0];
  assert.ok(ambSec.includes('<select data-stco="email" data-name="이은주"') && ambSec.includes('<option value="">동명이인 — 고르세요</option><option value="ejlee@krs.co.kr">이은주 (자율운항연구팀 책임) — ejlee@krs.co.kr</option><option value="ejlee2@krs.co.kr">이은주 (해양 선임) — ejlee2@krs.co.kr</option></select>') && ambSec.includes('이름 겹침 — 고르세요') && !ambSec.includes('data-name="이은주" value='), '동명이인(이메일 든 후보) — 이메일 칸이 선택 상자(값 = 이메일, change 는 이메일 칸과 같은 길 collectField)');
  assert.ok(/href="https:\/\/teams\.microsoft\.com\/l\/chat\/0\/0\?users=cjmoon%40krs\.co\.kr&amp;message=[^"]*NewForm\.aspx[^"]*" target="_blank" rel="noopener" data-cosent="문창재"/.test(sec), '사람마다 팀즈 딥 링크(이메일 · 양식 주소가 든 글)');
  assert.ok(/users=cjmoon%40krs\.co\.kr%2Clee%40krs\.co\.kr&amp;topicName=SSCB%20[^"]*" target="_blank" rel="noopener" data-cosent="\*"/.test(sec), '모두에게 팀즈 = 이메일 있는 둘의 그룹 채팅');
  assert.ok(sec.includes('<textarea data-stco="message"') && sec.includes('[SSCB — MW급 10kV 고전압 직류 시스템용 반도체 차단기 개발] 1차년도 참여연구원 자료 요청'), '팀즈 글(기본 글)');
  assert.ok(sec.includes('data-act="st-co-apply" data-id="3"') && sec.includes('data-act="st-co-apply" data-id="5"') && sec.includes('>100% 검사</span>') && sec.includes('미반영 2건 모두 반영') && sec.includes('<td class="krext-mono">2026-10 ~ 2026-12</td>') && sec.includes('<td class="krext-num">6,000</td>'), '응답 표');
  // 반영할 항목 체크 상자(값이 있는 것만, 기본 모두) · 최대 참여율 표기 — 문창재 10~12월은 선박 과제(응답) 80% 라 최대 20%(25% 는 넘침 → 경고색), 박보람은 예산 나머지가 넉넉해 100%(2026-10-20 "각각 반영할 것을 선택 … 참여율은 MAX … 표기도 해주고")
  assert.ok(sec.includes(`<input type="checkbox" data-stco-pick="period" data-cokey="${K1}" data-id="3" checked>기간</label>`) && sec.includes(`data-stco-pick="rate" data-cokey="${K1}" data-id="3" checked>참여율</label>`) && sec.includes(`data-stco-pick="monthly" data-cokey="${K1}" data-id="3" checked>월급여</label>`) && !sec.includes(`data-stco-pick="allowance" data-cokey="${K1}" data-id="3"`) && sec.includes(`data-stco-pick="allowance" data-cokey="${K1}" data-id="5" checked>연구수당</label>`) && !sec.includes('data-id="4" checked'), '줄마다 기간 · 참여율 · 월급여(· 연구수당) 체크 상자 — 다른 과제 줄에는 없음');
  assert.ok(sec.includes('<td class="krext-num">25%<small class="krext-st-co-max krext-st-co-warn" title="넣을 수 있는 최대 참여율 — 인건비 예산 나머지 24,435천원 기준 100% · 100% 규칙(다른 과제 참여율) 기준 20%. 응답이 이보다 크면 최대로 반영합니다">최대 20%</small></td>') && sec.includes('<td class="krext-num">10%<small class="krext-st-co-max krext-dim" title="넣을 수 있는 최대 참여율 — 인건비 예산 나머지 20,940천원 기준 100% · 100% 규칙(다른 과제 참여율) 기준 100%. 응답이 이보다 크면 최대로 반영합니다">최대 100%</small></td>'), '참여율 칸에 최대(넘으면 경고색)');
  assert.ok(sec.includes('공유 <b>1/3명</b>') && sec.includes('응답 <b>2명</b> · 3건') && sec.includes('미반영 <b>2건</b>') && sec.includes('이메일 확인 <b>2명</b>') && sec.includes('이메일을 확인한 뒤 <b>공유</b>를 눌러 다시 시도하세요.'), '공유·응답 진행과 이메일 확인 대상을 각각 표시');
  assert.ok(sec.includes('tabindex="0" role="region" aria-label="자료 요청 대상과 공유 상태"') && /data-stco-panel="settings"><summary>메시지 · 채팅방 설정/.test(sec) && !sec.includes('요청 관리') && !sec.includes('data-stco-panel="manage"') && sec.includes('data-act="st-co-toggle" aria-expanded="true"') && sec.includes('>지우기</button></span>') && /양식 열기 [\s\S]*?class="krext-st-co-copy" data-act="st-co-copy"[^>]*>링크 복사<\/button>/.test(sec), '넓은 대상 표는 키보드 스크롤, 메시지·채팅방은 기본 접힘("요청 관리" details 는 없음), 머리에 ▾ 와 [지우기](단추 줄 끝), 양식 줄의 [양식 열기] 옆에 [링크 복사]');
  const closed = U.section(d, {}, Object.assign({}, st, { staffCollectOpen: { [`${K1}:card`]: false } }), '', TAB).match(/<div class="krext-st-collect [\s\S]*$/)[0];
  assert.ok(closed.includes('krext-st-co-closed') && closed.includes('data-act="st-co-toggle" aria-expanded="false"') && closed.includes('<strong>요청 1</strong><span class="krext-sub krext-dim">공유 1/3명 · 응답 2명 (3건) · 미반영 2건</span>') && closed.includes('data-act="st-co-remove"') && !closed.includes('krext-st-co-table') && !closed.includes('data-act="st-co-fetch"') && !closed.includes('data-stco-panel'), '접은 카드 — 머리(▸ · 요약 한 줄 · 지우기)만(2026-10-20 "요청을 접었다 폈다 하고 삭제도")');
  withStaffActions(st, ({ click, sent, writes, draws }) => {
    const before = [sent.length, writes.length, draws()];
    click('st-co-toggle'); assert.strictEqual(st.staffCollectOpen[`${K1}:card`], false, '▾ → 접힘');
    click('st-co-toggle'); assert.strictEqual(st.staffCollectOpen[`${K1}:card`], true, '▸ → 펼침');
    assert.deepStrictEqual([sent.length, writes.length, draws()], [before[0], before[1], before[2] + 2], '접기·펼치기는 다시 그리기만(저장·메시지 없음)');
  });
  withStaffActions(st, ({ toggle, sent, writes, draws }) => {
    const beforePlan = JSON.stringify(st.staffPlans), beforeRequest = JSON.stringify(st.staffCollect);
    const beforeCounts = [sent.length, writes.length, draws()];
    toggle({ stplan: K1 }, true);
    toggle({ stcoPanel: 'settings' }, true);
    toggle({ stcoPanel: 'settings' }, true, K2);
    let redrawn = U.section(d, {}, st, '', TAB);
    assert.ok(redrawn.includes(`data-stplan="${K1}" open`) && redrawn.includes('data-stco-panel="settings" open'), '다시 그려도 계획·메시지가 열려 있음');
    toggle({ stplan: K1 }, false);
    toggle({ stcoPanel: 'settings' }, false);
    redrawn = U.section(d, {}, st, '', TAB);
    assert.ok(!redrawn.includes(`data-stplan="${K1}" open`) && !redrawn.includes('data-stco-panel="settings" open'), '닫은 상태도 다시 그릴 때 유지');
    assert.strictEqual(st.staffCollectOpen[`${K2}:settings`], true, '다른 연차 설정 상태는 유지');
    assert.deepStrictEqual([sent.length, writes.length, draws()], beforeCounts, '접기·펼치기는 저장·동기화·메시지·다시 그리기를 요청하지 않음');
    assert.deepStrictEqual([JSON.stringify(st.staffPlans), JSON.stringify(st.staffCollect)], [beforePlan, beforeRequest], '계획과 요청 데이터는 그대로');
  });
  assert.ok(html.includes('문창재 — 10월 참여율 합 100.01% (이 과제 20.01% · 선박 과제(응답) 80.00%)'), '응답의 다른 과제 참여율이 100% 초과 알림에');
  withStaffActions(st, ({ click, change, keydown, sent, writes, draws }) => {
    const cur = () => st.staffCollect[K1];   // 처리는 정리한 사본(reqOf)을 상태에 둔다
    change({ stcoPick: 'rate', cokey: K1, id: '3' }, undefined, false);   // 참여율을 끔 → state 에 남고 다시 그림(최대는 여전히 표기)
    assert.deepStrictEqual(st.staffCollectPick[`${K1}:3`], { rate: false });
    const unpicked = U.section(d, {}, st, '', TAB);
    assert.ok(unpicked.includes(`data-stco-pick="rate" data-cokey="${K1}" data-id="3">참여율</label>`) && unpicked.includes(`data-stco-pick="monthly" data-cokey="${K1}" data-id="3" checked>`) && unpicked.includes('>최대 20%</small>'), '끈 상자는 빈 채로, 다른 상자는 그대로');
    change({ stcoPick: 'rate', cokey: K1, id: '3' }, undefined, true);
    click('st-co-apply', { id: '3' });
    const q = st.staffPlans[K1].people.find((x) => x.name === '문창재');
    assert.strictEqual(q.manual, 6000000, '응답의 월급여(천원 → 원)를 직접 값으로');
    assert.deepStrictEqual(q.plan.filter((x) => x.ym >= '2026-10').map((x) => x.amt), [1200000, 1200000, 1200000], '10~12월 — 응답 25% 는 최대 20%(100 − 선박 과제 80%) 로 잘라 20% × 6,000천원(2026-10-20 "이거 이상 못넘어 가게")');
    assert.deepStrictEqual(q.plan.filter((x) => x.ym < '2026-10').map((x) => x.amt), [1165000, 1165000, 1165000, 1165000, 1165000, 1165000], '그 앞 달은 그대로');
    assert.ok(cur().applied['3'] > 0 && writes.some((w) => w.staffCollect && w.staffCollect[K1] && w.staffCollect[K1].applied['3']), '반영 시각을 요청에 남기고 저장(읽어서 그 키만)');
    assert.ok(st.staffCollectMsg && st.staffCollectMsg.key === K1 && /문창재: .*20\.00%.*\(참여율 25% → 최대 20% 로\)$/.test(st.staffCollectMsg.text) && !st.staffCollectMsg.error, st.staffCollectMsg && st.staffCollectMsg.text);
    assert.ok(st.staffChanges[K1].some((c) => c.item === '문창재' && /월급여\(응답\)/.test(c.after)) && st.staffChanges[K1].some((c) => c.item === '문창재' && /참여율 변경/.test(c.after)), '변경이력 두 줄');
    click('st-co-apply-all');
    const q2 = st.staffPlans[K1].people.find((x) => x.name === '박보람');
    assert.ok(q2 && q2.manual === 4000000 && q2.plan.map((x) => [x.ym, x.amt]).join() === '2026-11,400000,2026-12,400000', '계획에 없던 사람은 응답으로 더함(11~12월 10% × 4,000천원)');
    assert.ok(q2.allowance === 3000000 && U.section(d, {}, st, '', TAB).includes('<small class="krext-st-sum krext-st-allow" title="자료 요청 응답으로 받은 올해 남은 연구수당(천원) — 참고 값, 인건비 지급 계획에는 들지 않습니다"><span>남은 연구수당 3,000</span></small>') && st.staffChanges[K1].some((c) => c.item === '박보람' && /남은 연구수당\(응답\)/.test(c.after)), '응답의 남은 연구수당은 사람의 참고 값으로(표의 이름 칸 · 변경이력)');
    assert.ok(cur().applied['5'] > 0 && !cur().applied['4'], '다른 과제 줄은 반영 대상이 아님');
    const auto = sent.filter((m) => m.type === 'collectShare');
    assert.ok(auto.length === 1 && auto[0].people.map((x) => x.name).join() === '문창재,김철수,이영희,박보람' && st.staffCollectBusy === K1, '계획에 새로 든 사람(박보람)은 자료 요청 [공유]가 저절로 — 표의 사람 + 새 사람');
    st.staffCollectBusy = null; sent.length = 0;   // 가짜 백그라운드는 답하지 않으니 손으로 풀어 준다
    change({ stco: 'email', name: '김철수' }, ' Kim1@KRS.co.kr ');
    assert.deepStrictEqual([cur().people[1].email, cur().people[1].status], ['kim1@krs.co.kr', ''], '이메일을 적으면 공유 전으로');
    assert.ok(writes.some((w) => w.peopleEmails && w.peopleEmails['김철수'] === 'kim1@krs.co.kr'), '이름 → 이메일 캐시');
    change({ stco: 'email', name: '김철수' }, 'nope');
    assert.ok(st.staffCollectMsg.error && /이메일 모양/.test(st.staffCollectMsg.text) && cur().people[1].email === 'kim1@krs.co.kr');
    change({ stco: 'message' }, '  내 글  ');
    assert.strictEqual(cur().message, '내 글');
    click('st-co-fetch');
    assert.ok(sent.some((m) => m.type === 'collectFetch' && m.prjNo === P.prjNo && m.year === 1) && st.staffCollectBusy === K1, '백그라운드에 맡기고 진행 중 표시');
    click('st-co-share');
    assert.ok(!sent.some((m) => m.type === 'collectShare'), '진행 중이면 다른 요청은 무시');
    keydown({ stco: 'email' }, 'Enter');
  });
  // 팀즈 MCP(0.8.9): 연결돼 있으면 [보내기]·기존 채팅방 [채팅방에 보내기] 가 백그라운드 collectSend 로; 딥 링크는 [채팅 열기]·[채팅방 열기]로 남음. 연결 안 되면 딥 링크만
  const st3 = mk({ data: d, staffPlans: { [K1]: mkPlan() }, staffAliases: { [P.prjNo]: 'SSCB' } });
  st3.staffCollect = { [K1]: Object.assign({}, req, { chat: 'https://teams.microsoft.com/l/message/19:87062d12353c42558f52ebe1fae3714f@thread.v2/1760000000000?context=%7B%22contextType%22%3A%22chat%22%7D' }) };
  st3.teamsStatus = { url: 'http://localhost:5003/mcp', ok: true, at: 1, server: 'teams 1.0.0', error: '' };
  const sec3 = U.section(d, {}, st3, '', TAB).match(/<div class="krext-st-collect"[\s\S]*$/)[0];
  assert.ok(sec3.includes('data-act="st-co-send" data-name="문창재"') && sec3.includes('>채팅 열기</a>') && !sec3.includes('>팀즈로 보내기</a>') && sec3.includes('data-act="st-co-send-chat"') && sec3.includes('href="https://teams.microsoft.com/l/chat/19%3A87062d12353c42558f52ebe1fae3714f%40thread.v2/conversations?message=') && sec3.includes('팀즈 MCP 연결됨') && sec3.includes('채팅 ID 19:87062d12353c42558f52ebe1fae3714f@thread.v2'), '연결됨 — 보내기 단추 · 채팅방 ID · 열기 링크');
  withStaffActions(st3, ({ click, change, sent }) => {
    click('st-co-send', { name: '문창재' });
    const m = sent.find((x) => x.type === 'collectSend');
    assert.ok(m && m.names.join() === '문창재' && !m.chat && /NewForm\.aspx/.test(m.message) && st3.staffCollectBusy === K1, '사람마다 [보내기] → collectSend { names, message }');
    st3.staffCollectBusy = null; sent.length = 0;
    click('st-co-send-chat');
    assert.ok(sent.some((x) => x.type === 'collectSend' && x.chat === true && /NewForm\.aspx/.test(x.message)), '[채팅방에 보내기] → collectSend { chat:true, message }');
    st3.staffCollectBusy = null;
    change({ stco: 'chat' }, 'nope');
    assert.ok(st3.staffCollectMsg.error && /채팅 ID/.test(st3.staffCollectMsg.text) && st3.staffCollect[K1].chat === 'nope', '채팅방 링크 모양이 아니면 알림(값은 남김)');
    change({ stco: 'chat' }, ' 19:abc@thread.v2 ');
    assert.ok(!st3.staffCollectMsg.error && /19:abc@thread.v2/.test(st3.staffCollectMsg.text) && st3.staffCollect[K1].chat === '19:abc@thread.v2');
  });
  st3.teamsStatus = { url: 'http://localhost:5003/mcp', ok: false, at: 1, server: '', error: '연결할 수 없습니다' };
  const sec4 = U.section(d, {}, st3, '', TAB);
  assert.ok(!sec4.includes('data-act="st-co-send') && sec4.includes('>팀즈로 보내기</a>') && sec4.includes('>채팅방 열기</a>') && sec4.includes('연결 안 됨 — 새 탭으로만'), '연결 안 됨 — 딥 링크만');
  // 만들기 — 대상 이름·별칭·기간을 백그라운드에
  const st2 = mk({ data: d, staffPlans: { [K1]: mkPlan() }, staffAliases: { [P.prjNo]: 'SSCB' } });   // 위 반영으로 바뀐 계획이 아니라 새 계획
  withStaffActions(st2, ({ click, sent }) => {
    click('st-co-create');
    const m = sent.find((x) => x.type === 'collectCreate');
    assert.deepStrictEqual([m.prjNo, m.year, m.names, m.alias, m.from, m.to], [P.prjNo, 1, ['문창재'], 'SSCB', '2026-04', '2026-12']);
  });
});

function withStaffActions(st, run, localExtra = {}) {
  const listeners = {}, writes = [], sent = [];
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const local = Object.assign({ projectSupport: clone(st.staffSupport || {}) }, localExtra);
  const priorChrome = globalThis.chrome, priorTimeout = globalThis.setTimeout;
  const thenable = (v) => ({ then: (ok) => thenable(ok ? ok(v) : undefined) });
  let storageChange, draws = 0;
  globalThis.chrome = { storage: { local: { get: () => thenable(clone(local)), set: (v) => { const next = clone(v); writes.push(next); Object.assign(local, next); return thenable(); } }, onChanged: { addListener(fn) { storageChange = fn; } } }, runtime: { sendMessage: (m) => { sent.push(m); return { then() {} }; } } };
  globalThis.setTimeout = () => 0;
  try {
    const host = { addEventListener: (name, fn) => { listeners[name] = fn; }, contains: () => true, querySelector: (selector) => selector === 'details[data-stplan][open]' ? null : ({ focus() {}, select() {} }) };
    const api = U.bind(host, st, () => { draws++; });
    const project = st.data.projects[0];
    const box = { dataset: { stprj: project.prjNo, styr: '1' } };
    const click = (act, extra) => listeners.click({ target: { closest: () => ({ dataset: Object.assign({ act }, extra || {}), closest: () => box }) }, preventDefault() {} });
    const change = (dataset, value, checked) => listeners.change({ target: { dataset, value, checked, type: checked == null ? 'text' : 'checkbox', closest: () => box } });
    const input = (key, value) => listeners.input({ target: { dataset: { stf: key }, value, closest: () => box } });
    const keydown = (dataset, key) => listeners.keydown({ target: { dataset, value: '', closest: () => box, blur() {} }, key, preventDefault() {} });
    const toggle = (dataset, open, cokey = K1) => listeners.toggle({ target: { dataset, open, closest: (selector) => selector === '[data-cokey]' ? { dataset: { cokey } } : box } });
    run({ api, box, click, change, input, keydown, toggle, writes, sent, local, draws: () => draws, storageChange: (...args) => storageChange(...args) });
  } finally { globalThis.chrome = priorChrome; globalThis.setTimeout = priorTimeout; }
}

test('행정지원 구역 — 참여인력 표 아래 같은 꼴의 표(성명 · 맡은 일 · 공문 참조 · ×)와 사람 더하기 아이콘(WORKSPACE R&D 탭과 같음); 탭의 공통 추가 폼(역할 행정)으로도 등록 — 담당업무·공문 참조·다른 과제 보존, 변경이력·공유 요청, 마지막 삭제의 시각 유지', () => {
  const support = { [P.prjNo]: { people: [{ name: '홍길동', role: '행정 담당', ref: false }], at: 5 }, OTHER: { people: [{ name: '다른 과제 담당자', role: '정산', ref: true }], at: 1 } };
  const st = mk({ data: d, staffSupport: support });
  let html = U.section(d, {}, st, '', EDIT);
  const sup = html.match(/<div class="krext-st-sup">[\s\S]*?<\/table><\/div>/);
  assert.ok(sup && sup[0].includes('<strong title="과제 공통 — 모든 연차에서 함께 관리하며 KRS WORKSPACE 와 공유합니다">행정지원</strong>') && sup[0].includes('class="krext-ico-btn" data-act="st-sup-add"') && sup[0].includes('<table class="krext-cards krext-st-table krext-st-sup-table"><thead><tr><th class="krext-st-nm">성명</th><th>맡은 일</th><th>공문 참조</th><th></th></tr></thead>') && sup[0].includes('<tr class="krext-st-support-row" data-i="0">'), '연구원 계획이 없어도 행정지원 구역(머리 · 더하기 아이콘 · 표)');
  assert.ok(!html.includes('krext-st-support-role') && !html.includes('krext-st-view') && !html.includes('>행정 1명</span>') === false, '참여인력 표에 섞지 않음(계획·rERP 조회가 없으면 참여인력 표 없음) · 머리에 행정 1명');
  assert.ok(html.includes('>행정 1명</span>'));
  assert.ok(html.includes('data-sts="name" data-i="0" value="홍길동"') && html.includes('data-sts="role" data-i="0" value="행정 담당"') && !/data-sts="ref"[^>]*checked/.test(html) && html.includes('data-act="st-sup-del" data-i="0"'), '기존 자유로운 담당업무와 ref=false를 그대로 표시');
  assert.deepStrictEqual(U.supportOf(st, P2.prjNo), { people: [], at: 0 });
  withStaffActions(st, ({ click, change, input, writes, sent, local, draws }) => {
    click('st-add');
    assert.strictEqual(st.staffEdit.id, 'new');
    const beforeDraw = draws();
    change({ stf: 'role' }, '행정지원');
    assert.ok(draws() > beforeDraw && st.staffDraft.role === '행정지원', '역할을 고르면 행정지원 입력칸으로 바로 전환');
    html = U.section(d, {}, st, '', TAB);
    assert.ok(html.includes('data-stf="supportRole"') && html.includes('data-stf="ref"') && !html.includes('data-stf="manual"'), '행정지원은 담당업무·공문 참조로 입력');
    input('name', ' 이몽룡 '); input('supportRole', '연구지원'); change({ stf: 'ref' }, 'on', false);
    click('st-apply', { id: 'new' });
    assert.deepStrictEqual(st.staffSupport[P.prjNo].people, [{ name: '홍길동', role: '행정 담당', ref: false }, { name: '이몽룡', role: '연구지원', ref: false }]);
    assert.strictEqual(st.staffEdit, null);
    assert.deepStrictEqual(st.staffPlans, {}, '지원인력 추가로 빈 연차계획을 만들지 않는다');
    assert.ok(!writes.some((x) => x.staffPlans), '연구원 지급계획을 저장하지 않는다');
    assert.deepStrictEqual(local.projectSupport.OTHER, support.OTHER, '다른 과제의 지원인력도 보존');
    assert.ok(local.projectSupport[P.prjNo].at > 5 && sent.some((m) => m.type === 'planSyncQueue') && st.staffChanges[K1].some((c) => c.item === '행정지원' && /이몽룡 더함/.test(c.after)), '변경 시각 · 공유 요청 · 변경이력');
    change({ sts: 'role', i: '1' }, '구매·정산'); change({ sts: 'ref', i: '1' }, 'on', true);
    assert.deepStrictEqual(st.staffSupport[P.prjNo].people[1], { name: '이몽룡', role: '구매·정산', ref: true });
    change({ sts: 'name', i: '0' }, '   ');
    assert.deepStrictEqual(st.staffSupport[P.prjNo].people.map((p) => p.name), ['이몽룡'], '기존 이름 비우기 동작 유지');
    click('st-sup-del', { i: '0' });
    assert.deepStrictEqual(local.projectSupport[P.prjNo], { people: [], at: st.staffSupport[P.prjNo].at });
    assert.ok(local.projectSupport[P.prjNo].at > 0, '빈 목록도 시각을 남겨 다른 창/WORKSPACE로 삭제를 공유');
  });
});

test('행정지원 사람 더하기 아이콘 — 빈 줄(data-i="new")을 내고 이름을 적으면 저장(맡은 일·공문 참조는 그때까지 임시), 빈 이름은 저장하지 않음, ×·Esc 로 거둠, 중복 이름 거부, 열 명이면 아이콘 비활성', () => {
  const st = mk({ data: d, staffSupport: { [P.prjNo]: { people: [{ name: '홍길동', role: '행정 담당', ref: true }], at: 5 } } });
  withStaffActions(st, ({ click, change, keydown, local, sent }) => {
    click('st-sup-add');
    assert.deepStrictEqual(st.staffSupportNew, { prjNo: P.prjNo, name: '', role: '', ref: true });
    let html = U.section(d, {}, st, '', EDIT);
    assert.ok(html.includes('<tr class="krext-st-support-row" data-i="new">') && html.includes('data-sts="name" data-i="new" value=""') && html.includes('data-sts="ref" data-i="new" checked') && html.includes('data-act="st-sup-del" data-i="new"'), '빈 줄(공문 참조 기본 켜짐)');
    change({ sts: 'role', i: 'new' }, '구매 지원'); change({ sts: 'ref', i: 'new' }, 'on', false);
    assert.deepStrictEqual([st.staffSupportNew.role, st.staffSupportNew.ref, st.staffSupport[P.prjNo].people.length], ['구매 지원', false, 1], '이름 전에는 저장하지 않음');
    change({ sts: 'name', i: 'new' }, '  ');
    assert.strictEqual(st.staffSupport[P.prjNo].people.length, 1, '빈 이름은 그대로');
    change({ sts: 'name', i: 'new' }, '홍 길동');
    assert.ok(st.staffMsg.error && st.staffSupport[P.prjNo].people.length === 1 && st.staffSupportNew, '중복 이름 거부(빈 줄은 남음)');
    change({ sts: 'name', i: 'new' }, ' 이몽룡 ');
    assert.deepStrictEqual(st.staffSupport[P.prjNo].people, [{ name: '홍길동', role: '행정 담당', ref: true }, { name: '이몽룡', role: '구매 지원', ref: false }]);
    assert.strictEqual(st.staffSupportNew, null);
    assert.ok(local.projectSupport[P.prjNo].people.length === 2 && sent.some((m) => m.type === 'planSyncQueue') && st.staffChanges[K1].some((c) => c.item === '행정지원' && /이몽룡 더함/.test(c.after)), '저장 · 공유 요청 · 변경이력');
    click('st-sup-add'); click('st-sup-del', { i: 'new' });
    assert.strictEqual(st.staffSupportNew, null, '× 로 거둠');
    click('st-sup-add'); keydown({ sts: 'name', i: 'new' }, 'Escape');
    assert.strictEqual(st.staffSupportNew, null, 'Esc 로 거둠');
    assert.deepStrictEqual(st.staffSupport[P.prjNo].people.map((p) => p.name), ['홍길동', '이몽룡'], '거둬도 저장된 사람은 그대로');
    const ten = []; for (let i = 0; i < 10; i++) ten.push({ name: `사람${i}`, role: '', ref: true });
    st.staffSupport[P.prjNo] = { people: ten, at: 9 };
    html = U.section(d, {}, st, '', EDIT);
    assert.ok(/data-act="st-sup-add"[^>]*disabled/.test(html), '열 명이면 아이콘 비활성');
    click('st-sup-add');
    assert.ok(!st.staffSupportNew && st.staffMsg.error, '열 명이면 더하지 않음');
  });
});

test('공통 추가 폼 — 기간·지급계획 없는 과제에도 행정지원 등록, 기본 공문 참조 유지, 중복 이름 추가와 기존 이름 변경 차단', () => {
  const p = { prjNo: 'NO-PERIOD', prjNm: '기간 없는 과제', anl: '1' };
  const st = mk({ data: { projects: [p] } });
  withStaffActions(st, ({ click, change, input, local }) => {
    click('st-add');
    assert.ok(st.staffEdit && st.staffEdit.id === 'new', '기간이 없어도 역할을 선택할 수 있다');
    change({ stf: 'role' }, '행정지원'); input('name', '홍길동'); click('st-apply', { id: 'new' });
    assert.deepStrictEqual(st.staffSupport[p.prjNo].people, [{ name: '홍길동', role: '', ref: true }]);
    assert.deepStrictEqual(st.staffPlans, {});
    click('st-add'); change({ stf: 'role' }, '행정지원'); input('name', '홍 길동'); click('st-apply', { id: 'new' });
    assert.strictEqual(st.staffSupport[p.prjNo].people.length, 1);
    assert.ok(st.staffError, '공백을 무시한 같은 이름은 저장 전에 거부');
    input('name', '성춘향'); click('st-apply', { id: 'new' });
    const before = JSON.parse(JSON.stringify(local.projectSupport[p.prjNo]));
    change({ sts: 'name', i: '0' }, '성 춘향');
    assert.deepStrictEqual(st.staffSupport[p.prjNo], before, '기존 이름 중복 편집으로 다른 행을 버리지 않는다');
    assert.deepStrictEqual(local.projectSupport[p.prjNo], before);
    assert.ok(st.staffMsg.error);
  });
});

test('연구원과 행정지원의 총원은 합산하되 지급계획·인건비는 유지 — 과제 공통 지원인력은 다른 연차와 rERP 초기화에도 보존', () => {
  const rows = S.rowsOfErp(REC), staff = S.peopleOfErp(rows, { prjNo: P.prjNo, now: 1 });
  const plan = Object.assign({ prjNo: P.prjNo, year: 1, prjNm: P.prjNm, from: '2026-04', to: '2026-12', budgetPay: null, budget: null, at: 1 }, staff);
  const support = { [P.prjNo]: { people: [{ name: '홍길동', role: '구매지원', ref: false }], at: 5 } };
  const st = mk({ data: d, staffPlans: { [K1]: plan }, staffRows: { [P.prjNo]: { at: 1, rows, others: {} } }, staffSupport: support });
  const beforePeople = JSON.parse(JSON.stringify(plan.people)), beforeSupport = JSON.parse(JSON.stringify(support));
  const html = U.section(d, {}, st, '', { only: 'staff' });
  assert.ok(html.includes('>연구자 2명 · 행정 1명</span>') && html.includes('계획 인건비 <strong>31,425</strong>') && html.includes('예산 <strong>31,425</strong>') && html.includes('class="krext-st-budgetstate krext-st-budget-even">✓ 예산과 같음</span>') && !html.includes('krext-st-overview'), '탭 머리는 연구자·행정 인원, 얇은 요약 줄은 연구원 2명의 계획·예산·차이 — 요약 세 칸은 없음');
  assert.ok(U.section(d, {}, st, '', EDIT).includes('>연구자 2명 · 행정 1명</span>'), '패널 카드의 머리는 인원만(WORKSPACE 꼴)');
  assert.deepStrictEqual(plan.people, beforePeople);
  st.staffView.years[P.prjNo] = 2;
  assert.ok(U.section(d, {}, st, '', { only: 'staff' }).includes('data-sts="name" data-i="0" value="홍길동"'), '계획 없는 다른 연차에도 동일한 행정지원 표시');
  st.staffView.years[P.prjNo] = 1;
  withStaffActions(st, ({ api, click, change, input }) => {
    click('st-add'); change({ stf: 'role' }, '행정지원'); input('name', '문 창재'); click('st-apply', { id: 'new' });
    assert.ok(st.staffError && /이미/.test(st.staffError), '이미 있는 연구원을 행정지원 신규 행으로 중복 추가하지 않는다');
    assert.deepStrictEqual(st.staffPlans[K1].people, beforePeople);
    assert.deepStrictEqual(st.staffSupport, beforeSupport);
    api.initFrom(P.prjNo, 1, 'erp');
    assert.deepStrictEqual(st.staffSupport, beforeSupport, 'rERP 지급계획으로 초기화해도 지원인력 metadata를 보존');
    assert.strictEqual(S.staffTotal(st.staffPlans[K1], 'rerp'), 31425000);
  });
});

test('기존 연구원 역할만 행정지원으로 변경 — 지급계획·ERP 연결·사용자 역할 보존, projectSupport 이동 없음', () => {
  const staff = S.peopleOfErp(S.rowsOfErp(REC), { prjNo: P.prjNo, now: 1 });
  staff.people[0].role = '사용자 지정 역할';
  const plan = Object.assign({ prjNo: P.prjNo, year: 1, prjNm: P.prjNm, from: '2026-04', to: '2026-12', budgetPay: null, budget: null, at: 1 }, staff);
  const st = mk({ data: d, staffPlans: { [K1]: plan } });
  let html = U.section(d, {}, st, '', TAB);
  const id = plan.people[0].id;
  assert.ok(html.includes('data-stc="role" data-id="' + id + '"') && /<option value="사용자 지정 역할"[^>]*selected>사용자 지정 역할</.test(html), '알 수 없는 기존 역할도 선택값으로 보존');
  assert.ok(U.section(d, {}, st, '', EDIT).includes('title="사용자 지정 역할">사용자 지정 역할</td>'), '패널 보기 표는 모르는 역할을 그대로');
  const beforePeople = JSON.parse(JSON.stringify(plan.people));
  withStaffActions(st, ({ change, writes, local }) => {
    change({ stc: 'role', id }, '행정지원');
    assert.deepStrictEqual(st.staffPlans[K1].people[0], Object.assign({}, beforePeople[0], { role: '행정지원' }), '역할 외 person 데이터는 모두 동일');
    assert.deepStrictEqual(st.staffPlans[K1].people[1], beforePeople[1]);
    assert.deepStrictEqual(st.staffSupport, {});
    assert.ok(writes.some((x) => x.staffPlans) && !writes.some((x) => x.projectSupport), '기존 연차계획만 저장하고 과제 공통 지원인력으로 옮기지 않는다');
    assert.deepStrictEqual(local.projectSupport, {});
    assert.strictEqual(S.staffTotal(st.staffPlans[K1], 'rerp'), 31425000);
    html = U.section(d, {}, st, '', TAB);
    assert.ok(/<option value="행정지원"[^>]*selected>행정</.test(html) && !html.includes('krext-st-support-row'), '기존 연구원 행의 역할 표시만 변경');
    const panel = U.section(d, {}, st, '', EDIT);
    assert.ok(panel.includes('title="행정지원">행정</td>') && panel.includes('>연구자 1명 · 행정 1명</span>'), '패널 보기 표는 행정, 머리의 행정 수에 셈');
  });
});

test('통합 인력 표 복사 — 연구원 TSV 유지, 지원인력은 급여 없이 역할·과제 공통·담당업무·공문 참조를 추가하며 지원만 있어도 복사 가능', () => {
  const staff = S.peopleOfErp(S.rowsOfErp(REC), { prjNo: P.prjNo, now: 1 });
  const plan = Object.assign({ prjNo: P.prjNo, year: 1, prjNm: P.prjNm, from: '2026-04', to: '2026-12', at: 1 }, staff);
  const st = mk({ data: d, staffPlans: { [K1]: plan } });
  const original = S.staffTsv(staff, staff.basis);
  assert.strictEqual(U.rosterTsv(plan, st, P.prjNo), original, '지원인력이 없으면 기존 9열 TSV를 그대로 반환');
  assert.strictEqual(U.rosterTsv(null, st, P.prjNo), '');
  st.staffSupport = { [P.prjNo]: { people: [{ name: '홍길동', role: '구매\t지원\n정산', ref: false }, { name: '성춘향', role: '', ref: true }], at: 5 } };
  const exported = U.rosterTsv(plan, st, P.prjNo).split('\n').map((line) => line.split('\t'));
  assert.ok(exported.every((row) => row.length === 11), '탭/개행이 포함된 업무도 TSV 열·행을 깨뜨리지 않는다');
  assert.deepStrictEqual(exported[0].slice(9), ['담당업무', '공문 참조']);
  assert.deepStrictEqual(exported.slice(0, -2).map((row) => row.slice(0, 9).join('\t')), original.split('\n'), '기존 연구원 금액·참여기간·참여율·월별 지급은 그대로');
  assert.ok(exported.slice(1, -2).every((row) => row[9] === '' && row[10] === ''));
  assert.deepStrictEqual(exported.slice(-2), [
    ['홍길동', '행정지원', '', '과제 공통', '', '', '', '', '', '구매 지원 정산', '아니오'],
    ['성춘향', '행정지원', '', '과제 공통', '', '', '', '', '', '', '예'],
  ]);
  assert.deepStrictEqual(U.rosterTsv(null, st, P.prjNo).split('\n'), [exported[0], ...exported.slice(-2)].map((row) => row.join('\t')), '지급계획 없이 지원인력만 있어도 머리글과 지원 행을 복사');
  st.staffPlans = {};
  assert.ok(U.section(d, {}, st, '', { only: 'staff' }).includes('data-act="st-copy"'), '지원인력만 있는 표에도 복사 버튼 표시');
});

test('외부 공유에서 받은 행정지원도 같은 표에 표시 — 담당업무와 ref=false 및 기존 연구원 지급계획 보존', () => {
  const staff = S.peopleOfErp(S.rowsOfErp(REC), { prjNo: P.prjNo, now: 1 });
  const plan = Object.assign({ prjNo: P.prjNo, year: 1, prjNm: P.prjNm, from: '2026-04', to: '2026-12', at: 1 }, staff);
  const st = mk({ data: d, staffPlans: { [K1]: plan } });
  const beforePeople = JSON.parse(JSON.stringify(plan.people));
  withStaffActions(st, ({ storageChange, writes }) => {
    const next = { [P.prjNo]: { people: [{ name: '공유 담당자', role: '외부 사용자 업무', ref: false }], at: 777 } };
    storageChange({ projectSupport: { newValue: next } }, 'local');
    assert.deepStrictEqual(st.staffSupport, next);
    assert.deepStrictEqual(st.staffPlans[K1].people, beforePeople);
    const html = U.section(d, {}, st, '', EDIT);
    assert.ok(html.includes('krext-st-support-row') && html.includes('value="공유 담당자"') && html.includes('value="외부 사용자 업무"') && !/data-sts="ref"[^>]*checked/.test(html));
    assert.ok(!writes.some((x) => x.projectSupport || x.staffPlans), '받은 값을 UI 표시만으로 다시 쓰지 않는다');
  });
});

test('보기 상태 이벤트 — 과제·연차·접기·월별 지급 초점 유지와 저장, 사유는 DOM 유지하며 저장', () => {
  const listeners = {}, writes = [], focused = [];
  const st = mk({ data: d });
  let redraws = 0;
  const priorChrome = globalThis.chrome, priorTimeout = globalThis.setTimeout;
  globalThis.chrome = { storage: { local: { get: () => ({}), set: (value) => writes.push(JSON.parse(JSON.stringify(value))) }, onChanged: { addListener() {} } } };
  globalThis.setTimeout = () => 0;
  try {
    const host = { addEventListener: (name, fn, capture) => { listeners[name] = { fn, capture }; }, contains: (el) => el.connected !== false, querySelector: (selector) => selector === 'details[data-stplan][open]' ? null : ({ focus: (options) => focused.push({ selector, options, redraws }) }) };
    U.bind(host, st, () => { redraws++; });
    const click = (act, card, extra = {}) => {
      const btn = { dataset: { act, card, ...extra }, closest: () => ({ dataset: { stprj: P.prjNo, styr: '1' } }) };
      listeners.click.fn({ target: { closest: () => btn }, preventDefault() {} });
    };
    click('st-fold', 'project');
    assert.strictEqual(st.staffView.fold.project, false);
    click('st-fold', 'project');
    assert.strictEqual(st.staffView.fold.project, true);
    click('st-months');
    assert.strictEqual(st.staffView.months, true);
    assert.strictEqual(writes[writes.length - 1].staffView.months, true);
    click('st-months');
    assert.strictEqual(st.staffView.months, false);
    assert.strictEqual(redraws, 4);
    assert.deepStrictEqual(focused.map((f) => f.selector), ['[data-act="st-fold"][data-card="project"]', '[data-act="st-fold"][data-card="project"]', '[data-act="st-months"]', '[data-act="st-months"]']);
    assert.ok(focused.every((f, i) => f.redraws === i + 1 && f.options.preventScroll === true), '다시 그린 단추로 스크롤 없이 초점 복원');
    click('st-proj', undefined, { prj: P2.prjNo });
    click('st-year', undefined, { year: '2' });
    click('st-year-add', undefined, { year: '3' });
    assert.deepStrictEqual(focused.slice(4).map((f) => f.selector), ['[data-act="st-proj"][aria-pressed="true"]', '[data-act="st-year"][data-year="2"]', '[data-act="st-year"][data-year="3"]'], '더한 연차는 새로 생긴 연차 단추로 초점 이동');
    assert.strictEqual(st.staffView.prjNo, P2.prjNo);
    assert.strictEqual(st.staffView.extra[P.prjNo], 3);
    assert.strictEqual(listeners.toggle.capture, true, 'details toggle 는 버블링하지 않으므로 캡처');
    const reason = { dataset: { streason: 'change-1' }, open: true };
    listeners.toggle.fn({ target: reason });
    assert.strictEqual(writes[writes.length - 1].staffView.reasons['change-1'], true);
    assert.strictEqual(redraws, 7, '사유를 펴는 동안 초점·DOM 유지');
    const count = writes.length;
    listeners.toggle.fn({ target: reason });
    listeners.toggle.fn({ target: { dataset: { streason: 'change-1' }, open: false, connected: false } });
    assert.strictEqual(writes.length, count, '동일 상태·이전 렌더의 toggle 무시');
    reason.open = false;
    listeners.toggle.fn({ target: reason });
    assert.strictEqual(st.staffView.reasons['change-1'], undefined);
  } finally {
    globalThis.chrome = priorChrome;
    globalThis.setTimeout = priorTimeout;
  }
});

test('달 칸 고르기(2026-10-19 "회의실 현황처럼 … 드래그해서 선택") — 탭의 달마다의 지급 격자는 늘 보이고(M 은 rERP 등록 줄만) 기간 안의 달은 단추 data-act="st-pick"(지급 없는 달·사람은 빈 칸, 기간 밖은 고를 수 없음, 패널은 그대로); 끌어 고르면(pointerdown → move → up, 다른 사람 칸·다른 포인터는 무시) 그 사람의 ✎ 폼이 첫 달 1일~마지막 달 마지막 날로 열리고 고른 칸은 krext-st-picked, 놓은 뒤의 click 은 무시, Shift+누름은 직전 칸부터, 같은 사람의 폼이 열려 있으면 구분·값은 두고 날짜만, 날짜 칸을 고치면 칸 표시가 따라감(다시 그리지 않고), 반영은 그 달들만, Esc·pointercancel·오른쪽 단추', () => {
  const rows = S.rowsOfErp(REC);
  const staff = S.peopleOfErp(rows, { prjNo: P.prjNo, now: 1 });
  const plan = Object.assign({ prjNo: P.prjNo, year: 1, prjNm: P.prjNm, from: '2026-04', to: '2026-12', budgetPay: null, budget: null, at: 1, by: '', note: '' }, staff);
  const st = mk({ data: d, staffPlans: { [K1]: plan }, staffRows: { [P.prjNo]: { at: 1, rows, others: {} } } });
  const id = staff.people[0].id;   // 문창재 4~11월 1,165 · 12월 1,159
  let html = U.section(d, {}, st, '', TAB);
  assert.ok(html.includes(`<button type="button" class="krext-st-mo" data-act="st-pick" data-id="${id}" data-ym="2026-04" aria-pressed="false" title="2026-04 · 1,165천원 · 20.01% — 누르거나 끌어 달을 고릅니다(Shift+누름은 직전 칸부터)"><i>4월</i><b class="krext-st-max" title="2026-04 · 1,165천원 · 20.01%">1,165</b></button>`), '기간 안의 달은 단추(금액·참여율은 그대로)');
  assert.ok(html.includes('<span class="krext-st-mo krext-st-mo-none" title="2026-01 · 기간 밖"><i>1월</i><b></b></span>') && !html.includes('data-ym="2026-01"'), '기간 밖 달은 고를 수 없음');
  assert.ok(!html.includes('krext-st-months-open') && html.includes('aria-label="rERP 등록 비교 보이기"') && html.includes('>달 칸을 누르거나 끌어 고르세요</span>') && html.includes('달 칸을 누르거나 끌어 고르면 그 달들의 참여율'), '탭의 M 은 rERP 등록 줄만(격자는 CSS 로 늘 보임) · 도구 줄 안내 · 아래 안내');
  const panel = U.section(d, {}, st, '', EDIT);
  assert.ok(!panel.includes('data-act="st-pick"') && panel.includes('aria-label="달마다의 지급 보이기"') && !panel.includes('달 칸을 누르거나'), '패널 카드의 격자는 단추가 아니고 M 은 그대로');
  st.staffPlans[K1].people.push(S.normalizePerson({ name: '빈사람', role: '참여연구원', manual: 4000000 }));
  const empty = st.staffPlans[K1].people[2].id;
  html = U.section(d, {}, st, '', TAB);
  assert.ok(html.includes(`<button type="button" class="krext-st-mo" data-act="st-pick" data-id="${empty}" data-ym="2026-04" aria-pressed="false" title="2026-04 · 지급 없음 — 누르거나 끌어 달을 고릅니다(Shift+누름은 직전 칸부터)"><i>4월</i><b></b></button>`) && (html.match(new RegExp(`data-id="${empty}" data-ym="2026-`, 'g')) || []).length === 9, '지급이 없는 사람도 기간의 달(4~12월)은 빈 단추');
  assert.deepStrictEqual([(U.section(d, {}, st, '', EDIT).match(/<tr class="krext-st-months">/g) || []).length, (html.match(/<tr class="krext-st-months">/g) || []).length], [2, 3], '패널에는 지급 없는 사람의 격자 없음(둘), 탭은 셋');
  st.staffPlans[K1].people.pop();
  // bind — 끌기 · 누름 · 폼
  const listeners = {}, timers = [];
  const priorChrome = globalThis.chrome, priorTimeout = globalThis.setTimeout;
  const thenable = (v) => ({ then: (ok) => thenable(ok ? ok(v) : undefined) });
  globalThis.chrome = { storage: { local: { get: () => thenable({}), set: () => thenable() }, onChanged: { addListener() {} } }, runtime: { sendMessage: () => ({ then() {} }) } };
  globalThis.setTimeout = (fn) => { timers.push(fn); return 0; };
  try {
    const box = { dataset: { stprj: P.prjNo, styr: '1' } };
    const months = S.ymRange('2026-04', '2026-12');
    const tbody = {};
    const mkCell = (pid, ym) => { const c = { dataset: { act: 'st-pick', id: pid, ym }, cls: new Set(), captured: null, setPointerCapture(p) { c.captured = p; }, closest: (sel) => (sel === '[data-act="st-pick"]' ? c : sel === '[data-stprj]' ? box : sel === 'tbody' ? tbody : null) }; c.classList = { toggle: (k, on) => { if (on) c.cls.add(k); else c.cls.delete(k); }, remove: (k) => c.cls.delete(k) }; return c; };
    const cells = months.map((ym) => mkCell(id, ym)).concat(months.map((ym) => mkCell(staff.people[1].id, ym)));   // 0~8 문창재, 9~17 김거화
    tbody.querySelectorAll = () => cells;
    let draws = 0;
    const host = { addEventListener: (name, fn) => { listeners[name] = fn; }, contains: () => true, querySelector: (selector) => selector === 'details[data-stplan][open]' ? null : ({ focus() {} }), querySelectorAll: () => cells, ownerDocument: { elementFromPoint: (x) => cells[x] } };
    U.bind(host, st, () => { draws++; });
    assert.ok(listeners.pointerdown && listeners.pointermove && listeners.pointerup && listeners.pointercancel, '포인터 이벤트 넷');
    const d0 = draws;   // bind 가 저장소를 읽고 한 번 그림
    const picked = () => cells.filter((c) => c.cls.has('krext-st-picked')).map((c) => `${c.dataset.id === id ? 'A' : 'B'}${c.dataset.ym.slice(5)}`);
    const click = (cell, extra = {}) => listeners.click(Object.assign({ target: { closest: () => cell }, preventDefault() {} }, extra));
    listeners.pointerdown({ button: 0, pointerId: 7, target: cells[0], preventDefault() {} });
    assert.strictEqual(cells[0].captured, 7, '포인터를 잡음');
    assert.deepStrictEqual(picked(), ['A04']);
    listeners.pointermove({ pointerId: 7, clientX: 2, clientY: 0 });
    assert.deepStrictEqual(picked(), ['A04', 'A05', 'A06'], '끄는 동안은 칸 표시만');
    listeners.pointermove({ pointerId: 7, clientX: 12, clientY: 0 });
    assert.deepStrictEqual(picked(), ['A04', 'A05', 'A06'], '다른 사람의 칸으로 나가면 늘지 않음');
    listeners.pointermove({ pointerId: 7, clientX: 1, clientY: 0 });
    assert.deepStrictEqual(picked(), ['A04', 'A05'], '되돌아오면 줄어듦');
    listeners.pointermove({ pointerId: 8, clientX: 5, clientY: 0 });
    assert.deepStrictEqual([picked(), draws], [['A04', 'A05'], d0], '다른 포인터는 무시 · 끄는 동안 다시 그리지 않음');
    listeners.pointerup({ pointerId: 7 });
    assert.deepStrictEqual(st.staffEdit, { prjNo: P.prjNo, year: 1, id, anchor: '2026-04' });
    assert.deepStrictEqual([st.staffDraft.from, st.staffDraft.to, st.staffDraft.mode, st.staffDraft.value, draws], ['2026-04-01', '2026-05-31', 'rate', '', d0 + 1], '놓으면 첫 달 1일 ~ 마지막 달 마지막 날의 폼');
    html = U.section(d, {}, st, '', TAB);
    assert.ok(html.includes(`class="krext-st-mo krext-st-picked" data-act="st-pick" data-id="${id}" data-ym="2026-04" aria-pressed="true"`) && html.includes(`krext-st-picked" data-act="st-pick" data-id="${id}" data-ym="2026-05" aria-pressed="true"`) && html.includes(`class="krext-st-mo" data-act="st-pick" data-id="${id}" data-ym="2026-06" aria-pressed="false"`) && !html.includes(`krext-st-picked" data-act="st-pick" data-id="${staff.people[1].id}"`) && html.includes('<input type="date" data-stf="from" value="2026-04-01"') && html.includes('data-stf="to" value="2026-05-31"'), '다시 그리면 고른 칸은 폼의 날짜에서(그 사람만), 폼은 그 날짜');
    click(cells[0]);
    assert.strictEqual(draws, d0 + 1, '놓은 뒤의 click 은 무시');
    timers.splice(0).forEach((fn) => fn());
    click(cells[5], { shiftKey: true });
    assert.deepStrictEqual([st.staffDraft.from, st.staffDraft.to, st.staffEdit.anchor, draws], ['2026-04-01', '2026-09-30', '2026-04', d0 + 2], 'Shift+누름은 직전 칸(anchor)부터');
    st.staffDraft.mode = 'amt'; st.staffDraft.value = '1000';
    click(cells[8]);
    assert.deepStrictEqual([st.staffDraft.from, st.staffDraft.to, st.staffDraft.mode, st.staffDraft.value, st.staffEdit.anchor], ['2026-12-01', '2026-12-31', 'amt', '1000', '2026-12'], '같은 사람의 폼이 열려 있으면 구분·값은 두고 날짜만');
    const before = draws;
    listeners.input({ target: { dataset: { stf: 'from' }, value: '2026-11-15', closest: () => box } });
    assert.deepStrictEqual([picked(), draws, st.staffDraft.from], [['A11', 'A12'], before, '2026-11-15'], '날짜 칸을 고치면 칸 표시가 따라감(다시 그리지 않고)');
    listeners.click({ target: { closest: () => ({ dataset: { act: 'st-apply', id }, closest: () => box }) }, preventDefault() {} });
    const q = st.staffPlans[K1].people.find((x) => x.id === id);
    assert.deepStrictEqual(q.plan.filter((x) => x.ym >= '2026-10').map((x) => [x.ym, x.amt, x.from || '', x.to || '']), [['2026-10', 1165000, '', ''], ['2026-11', 544000, '', '2026-11-14'], ['2026-11', 533000, '2026-11-15', ''], ['2026-12', 1000000, '', '']], st.staffError || '11월 15일부터 월 1,000천원 — 11월은 날 수 비율 조각 둘, 10월은 그대로');
    assert.strictEqual(st.staffEdit, null, '반영하면 폼 닫힘');
    listeners.pointerdown({ button: 0, pointerId: 9, target: cells[3], preventDefault() {} }); listeners.pointerup({ pointerId: 9 });
    assert.ok(st.staffEdit && st.staffEdit.id === id && st.staffDraft.from === '2026-07-01' && st.staffDraft.to === '2026-07-31', '누르기만 하면 그 달 하나');
    listeners.keydown({ target: { dataset: { act: 'st-pick', id, ym: '2026-07' }, closest: () => box }, key: 'Escape', preventDefault() {} });
    assert.strictEqual(st.staffEdit, null, '칸에서 Esc 로 거둠');
    listeners.pointerdown({ button: 0, pointerId: 10, target: cells[3], preventDefault() {} }); listeners.pointermove({ pointerId: 10, clientX: 5, clientY: 0 });
    assert.deepStrictEqual(picked(), ['A07', 'A08', 'A09']);
    const d2 = draws; listeners.pointercancel({ pointerId: 10 });
    assert.deepStrictEqual([picked(), draws, st.staffEdit], [[], d2, null], 'pointercancel 은 표시만 거둠');
    listeners.pointerdown({ button: 2, pointerId: 11, target: cells[3], preventDefault() {} }); listeners.pointerup({ pointerId: 11 });
    assert.deepStrictEqual([picked(), st.staffEdit], [[], null], '오른쪽 단추는 무시');
    st.staffPlans[K1].from = ''; st.staffPlans[K1].to = '';
    const p0 = st.data.projects[0]; const stDt = p0.stDt, endDt = p0.endDt; p0.stDt = ''; p0.endDt = '';
    listeners.pointerdown({ button: 0, pointerId: 12, target: cells[3], preventDefault() {} }); listeners.pointerup({ pointerId: 12 });
    assert.ok(!st.staffEdit && st.staffMsg && /계획 기간/.test(st.staffMsg.text), '기간이 없으면 안내만');
    p0.stDt = stDt; p0.endDt = endDt;
  } finally { globalThis.chrome = priorChrome; globalThis.setTimeout = priorTimeout; }
});

test('지급 완료(2026-10-19 "지급된 월은 수정 못하게 … 월 우측에 지급") — 격자의 그 달 칸은 "지급" 꼬리표에 잠기고(탭에서 단추 아님), 상태 줄 "지급 ~8월", 알림, 폼 적용일 하한·안내, 기본 날짜, 잠긴 구간 칸은 읽기만, payApprOf·paidOf', () => {
  const rows = S.rowsOfErp(REC);
  const staff = S.peopleOfErp(rows, { prjNo: P.prjNo, now: 1 });
  const M = S.ymRange('2026-04', '2026-12');
  const paid = S.paidThroughOf(rows, 17465000, { prjNo: P.prjNo, months: M, now: 5 });
  assert.strictEqual(paid.through, '2026-08');
  assert.deepStrictEqual([U.payApprOf(ITEMS), U.payApprOf([{ exp: '연구수당', appr: 5 }]), U.payApprOf(null)], [10000000, null, null], '인건비(수당 아님) 비목의 승인액 합');
  const older = Object.assign({}, paid, { through: '2026-06', at: 2 });
  assert.deepStrictEqual([U.paidOf({ paid: older }, { paid }, true), U.paidOf({ paid: older }, { paid }, false), U.paidOf(null, { paid }, true), U.paidOf({ paid: older }, null, true), U.paidOf(null, null, true)], [paid, older, paid, older, null], '조회 시각이 늦은 쪽, 현재 연차가 아니면 계획 것만');
  const plan = Object.assign({ prjNo: P.prjNo, year: 1, prjNm: P.prjNm, from: '2026-04', to: '2026-12', budgetPay: null, budget: null, at: 1, by: '', note: '', paid }, staff);
  const st = mk({ data: d, staffPlans: { [K1]: plan }, staffRows: { [P.prjNo]: { at: 1, rows, others: {}, appr: 17465000, paid } } });
  const id = staff.people[0].id;   // 문창재 4~11월 1,165 · 12월 1,159
  const html = U.section(d, {}, st, '', TAB);
  assert.ok(html.includes(`<span class="krext-st-mo krext-st-paid" title="2026-08 · 1,165천원 · 20.01% — rERP 지급 완료, 바꿀 수 없습니다"><i>8월<em class="krext-st-paidtag" title="rERP 지급 완료 — 바꿀 수 없습니다">지급</em></i>`), '8월까지 잠김 — 라벨 오른쪽에 지급');
  assert.ok(!html.includes(`data-id="${id}" data-ym="2026-08"`) && html.includes(`data-act="st-pick" data-id="${id}" data-ym="2026-09"`) && !html.includes('<i>9월<em'), '잠긴 달은 단추가 아니고 9월부터 고를 수 있음');
  assert.ok(html.includes('<span class="krext-st-paidst" title="4~8월 지급 완료 · rERP 인건비 승인액 17,465천원 — 그 달까지의 계획은 바꿀 수 없습니다 (') && html.includes('조회)">지급 ~8월</span>'), '상태 줄');
  assert.ok(html.includes('4~8월 지급 완료 · rERP 인건비 승인액 17,465천원 — 8월까지의 계획은 바꿀 수 없습니다.'), '알림');
  assert.ok(html.includes('일부 달은 날 수 비율 · 지급이 끝난 달은 그대로)"') && !html.includes(' readonly'), '구간이 하나(4~12월)면 칸은 쓸 수 있고 안내만');
  const panel = U.section(d, {}, st, '', EDIT);
  assert.ok(panel.includes('<span class="krext-st-mo krext-st-paid"><i>4월<em class="krext-st-paidtag"') && panel.includes('>지급 ~8월</span>') && !panel.includes('rERP 지급 완료, 바꿀 수 없습니다'), '패널 카드에도 꼬리표·상태(칸 툴팁은 탭에서만)');
  // 폼 — 적용일 하한은 9월 1일, 안내 한 줄
  st.staffEdit = { prjNo: P.prjNo, year: 1, id };
  st.staffDraft = { from: '2026-09-01', to: '2026-12-31', mode: 'rate', value: '' };
  const form = U.section(d, {}, st, '', TAB);
  assert.ok(form.includes('data-stf="from" value="2026-09-01" min="2026-09-01"') && form.includes('>8월까지 지급 완료 — 그 뒤 달부터</span>'), '적용일 하한 · 안내');
  st.staffEdit = null; st.staffDraft = null;
  // 제외(−100%)도 먼저 고른 뒤 반영 — 선택한 9~10월만 0원, 지급 완료·선택 밖은 유지
  withStaffActions(st, ({ click, input }) => {
    const before = JSON.parse(JSON.stringify(st.staffPlans[K1].people));
    click('st-edit', { id }); input('from', '2026-09-01'); input('to', '2026-10-31');
    click('st-step', { id, kind: 'scale', step: '-100' });
    assert.deepStrictEqual(st.staffDraft.step, { kind: 'scale', v: -100 });
    assert.deepStrictEqual(st.staffPlans[K1].people, before, '제외를 골라도 반영 전에는 지급계획 그대로');
    const pending = U.section(d, {}, st, '', TAB);
    assert.ok(pending.includes('>반영 제외</button>') && pending.includes('aria-pressed="true">제외<small>−100%</small></button>') && pending.includes('<b>반영</b>을 누르면 — 제외 (−100%) — 9~10월 2,330 → 0천원'), '제외를 고른 상태와 반영 결과를 표시');
    click('st-nudge', { id, kind: 'scale', dir: '-1' });
    assert.strictEqual(st.staffDraft.step.v, -100, '제외에서 −1%를 눌러도 −100% 아래로 내려가지 않음');
    click('st-nudge', { id, kind: 'scale', dir: '1' });
    assert.strictEqual(st.staffDraft.step.v, -99, '제외에서 +1%를 누르면 −99%');
    click('st-nudge', { id, kind: 'scale', dir: '-1' });
    input('from', '2026-08-01'); click('st-apply', { id });
    assert.ok(st.staffError.includes('지급이 끝난 달'), '제외도 지급 완료 달에는 반영할 수 없음');
    assert.deepStrictEqual(st.staffPlans[K1].people, before, '잠긴 달에 반영을 시도해도 지급계획 그대로');
    input('from', '2026-09-01'); click('st-apply', { id });
    const after = st.staffPlans[K1].people.find((x) => x.id === id);
    assert.deepStrictEqual(after.plan, before[0].plan.map((x) => x.ym === '2026-09' || x.ym === '2026-10' ? Object.assign({}, x, { amt: 0 }) : x), '9~10월만 제외하고 지급 완료 4~8월과 선택 밖 11~12월은 유지');
    assert.deepStrictEqual(st.staffPlans[K1].people[1], before[1], '다른 연구원의 지급계획 유지');
    assert.ok(!st.staffEdit && !st.staffDraft, '반영하면 제외 선택과 폼을 닫음');
  });
  // 잠긴 구간(4~9월 전체가 지급 완료)의 칸은 읽기만 — 김거화를 9월까지 지급된 것으로
  const paid9 = Object.assign({}, paid, { through: '2026-09' });
  st.staffPlans[K1].paid = paid9; st.staffRows[P.prjNo].paid = paid9;
  st.staffPlans[K1].people[1] = S.applyChange(st.staffPlans[K1].people[1], 'rerp', { from: '2026-10-01', mode: 'rate', value: 20 }, M);   // 4~9월 2,328 · 10~12월 1,696
  const two = U.section(d, {}, st, '', TAB);
  const paidTotal = two.match(/<input\b[^>]*>/g).find((tag) => tag.includes('data-stc="total" data-id="' + staff.people[1].id + '" data-r="0"'));
  const unpaidRate = two.match(/<input\b[^>]*>/g).find((tag) => tag.includes('data-stc="rate" data-id="' + staff.people[1].id + '" data-r="1"'));
  assert.ok(paidTotal.includes('value="13,968"') && paidTotal.includes(' readonly ') && paidTotal.includes('title="rERP 지급이 끝난 구간이라 바꿀 수 없습니다"') && unpaidRate.includes('value="20.00"') && !unpaidRate.includes(' readonly'), '첫 구간(4~9월)은 readonly, 둘째 구간은 편집');
  assert.ok(paidTotal.includes('aria-label="김거화 4~9월 지급 합 (천원)"') && unpaidRate.includes('aria-label="김거화 10~12월 참여율 (%)"'), '접근성 이름에 사람·기간·금액 또는 비율 단위 포함');
  // 기본 날짜 — 잠긴 달 뒤부터(직전 날짜가 잠긴 달이어도)
  assert.deepStrictEqual([U.defaultRange(M, '2026-05', null, '2026-08'), U.defaultRange(M, '2026-10', null, '2026-08'), U.defaultRange(M, '2026-05', { from: '2026-06-15', to: '2026-07-31' }, '2026-08'), U.defaultRange(M, '2026-05', { from: '2026-10-15', to: '' }, '2026-08')],
    [{ from: '2026-09-01', to: '2026-12-31' }, { from: '2026-11-01', to: '2026-12-31' }, { from: '2026-09-01', to: '2026-12-31' }, { from: '2026-10-15', to: '' }]);
});

test('이전 차년도에서 가져오기 · 전체 참여개월(2026-10-20 "2차년도에는 일단 이전 차년도 정보 가져오기 … 연구원, 월급, 참여율 … 기간은 전체, 그리고 드래그 말고 전체 참여개월 선택하는 기능도") — 2차년도부터 단추 줄 맨 앞 [1차년도에서 가져오기](계획이 있으면 두 번), 빈 계획 안내, 1차년도 계획(없으면 그 기간의 rERP 등록)에서 기간 전체에; 격자 왼쪽 [전체]는 그 사람의 참여개월(지급 완료 뒤 · 달 중간 날까지)로 ✎ 폼', () => {
  const rows = S.rowsOfErp(REC);
  const staff = S.peopleOfErp(rows, { prjNo: P.prjNo, now: 1 });   // 1차년도: 문창재 1,165×8 + 1,159 (20.00%) · 김거화 2,328×8 + 2,322 (27.45%)
  const plan1 = Object.assign({ prjNo: P.prjNo, year: 1, prjNm: P.prjNm, from: '2026-04', to: '2026-12', budgetPay: null, budget: null, at: 1, by: '', note: '' }, staff);
  const st = mk({ data: d, research: { r2: rec2 }, staffPlans: { [K1]: plan1 } });
  st.staffView.years[P.prjNo] = 2;
  let html = U.section(d, {}, st, '', TAB);
  assert.ok(/<div class="krext-st-acts">\s*<button type="button" class="krext-plan-btn" data-act="st-init-carry" title="1차년도 계획\(2명\)의 연구원\(성명·역할\)·월급여·참여율\(마지막 구간\)을 가져와 이 연차 기간 전체\(1~12월, 12개월\)의[^"]*">1차년도에서 가져오기<\/button>\s*<details class="krext-st-plan-menu" data-stplan="2026-0063-01@2"><summary>계획 관리<\/summary>/.test(html), '2차년도: 앞 연차 가져오기는 접히지 않는 첫 단추, 나머지 가져오기·초기화는 계획 관리 안');
  assert.ok(html.includes('<b>1차년도에서 가져오기</b>(1차년도 연구원·월급여·참여율을 이 기간 전체에) 를 누르거나, 조회가 끝나면'), '빈 계획 안내');
  st.staffView.years[P.prjNo] = 1;
  assert.ok(!U.section(d, {}, st, '', TAB).includes('st-init-carry'), '1차년도에는 없음');
  st.staffView.years[P.prjNo] = 2;
  // 재료 — 계획 > 그 기간의 rERP 등록 지급계획 > 없음(조회했는데도 없으면 꺼짐)
  assert.deepStrictEqual([U.carrySource(P, 2, st).from, U.carrySource(P, 1, st)], ['plan', null]);
  const noPlan = mk({ data: d, staffRows: { [P.prjNo]: { at: 1, rows, others: {} } } });
  assert.deepStrictEqual([U.carrySource(P, 2, noPlan).from, U.carrySource(P, 2, noPlan).staff.people.length, U.carrySource(P, 3, noPlan)], ['erp', 2, null], '1차년도 계획이 없으면 그 기간의 rERP 등록, 2차년도(2027)는 rERP 에 없음');
  noPlan.staffView.years[P.prjNo] = 3;
  assert.ok(U.section(d, {}, noPlan, '', TAB).includes('<button type="button" class="krext-plan-btn" data-act="st-init-carry" disabled title="2차년도 계획도, rERP 에 2차년도 기간의 지급계획도 없어 가져올 것이 없습니다">2차년도에서 가져오기</button>'), '가져올 것이 없으면 꺼짐');
  withStaffActions(st, ({ box, click }) => {
    box.dataset.styr = '2';
    click('st-init-carry');
    const p2 = st.staffPlans[K2];
    assert.deepStrictEqual([p2.from, p2.to, p2.src, p2.people.map((q) => [q.name, q.role, q.plan.length, [...new Set(q.plan.map((x) => x.amt))]])],
      ['2027-01', '2027-12', 'init', [['문창재', '참여연구원', 12, [1165000]], ['김거화', '과제책임자', 12, [2328000]]]], '1~12월 전체에 월급여 × 1차년도 참여율');
    assert.ok(/^2차년도 참여연구원 2명 — 1차년도 계획에서 연구원·월급여·참여율을 가져와 1~12월 전체\(12개월\)에 · 초과금 6,016천원\.$/.test(st.staffMsg.text) && st.staffMsg.error, st.staffMsg.text);
    assert.strictEqual(st.staffChanges[K2].slice(-1)[0].item, '참여인력 초기화', '변경이력');
    // 계획이 있으면 두 번 — 처음은 묻기만
    p2.people[0] = Object.assign({}, p2.people[0], { plan: p2.people[0].plan.map((x) => Object.assign({}, x, { amt: 0 })) });
    click('st-init-carry');
    assert.ok(st.staffArm && st.staffArm.key === `carry:${K2}` && p2.people[0].plan[0].amt === 0, '처음 누르면 묻기만');
    assert.ok(U.section(d, {}, st, '', TAB).includes('>정말 가져오기</button>'));
    click('st-init-carry');
    assert.strictEqual(st.staffPlans[K2].people[0].plan[0].amt, 1165000, '두 번째에 바꿈');
    // [전체] — 격자 왼쪽, 누르면 그 사람의 전체 참여개월로 폼, 다시 그리면 눌린 꼴
    const id = st.staffPlans[K2].people[0].id;
    html = U.section(d, {}, st, '', TAB);
    assert.ok(html.includes(`<div class="krext-st-mowrap"><button type="button" class="krext-st-allpick" data-act="st-pick-all" data-id="${id}" data-from="2027-01-01" data-to="2027-12-31" aria-pressed="false" title="전체 참여개월 고르기 — 1~12월(12개월)의 달들을 한 번에 골라 폼을 엽니다"><span>전체</span><small>12개월</small></button><div class="krext-st-mogrids"><div class="krext-st-mogrid"`), '격자 왼쪽 [전체]');
    click('st-pick-all', { id });
    assert.deepStrictEqual([st.staffEdit, st.staffDraft.from, st.staffDraft.to], [{ prjNo: P.prjNo, year: 2, id, anchor: '2027-01' }, '2027-01-01', '2027-12-31']);
    html = U.section(d, {}, st, '', TAB);
    assert.ok(html.includes(`class="krext-st-allpick krext-st-picked" data-act="st-pick-all" data-id="${id}"`) && html.includes('aria-pressed="true" title="전체 참여개월') && (html.match(new RegExp(`krext-st-picked" data-act="st-pick" data-id="${id}"`, 'g')) || []).length === 12, '눌린 꼴 · 12달 모두 고름');
    assert.ok(!U.section(d, {}, st, '', EDIT).includes('st-pick-all'), '패널 카드에는 없음');
  });   // 변경 도우미의 init carry 는 tests/staff-chat.test.js
  // wholePick — 지급이 있는 첫날 ~ 마지막 날(달 중간 날까지), 없으면 기간 전체, 지급이 끝난 달 뒤부터, 모두 잠기면 null
  const M = S.ymRange('2026-04', '2026-12');
  const part = S.normalizePerson({ name: 'x', plan: [{ ym: '2026-05', amt: 0 }, { ym: '2026-06', amt: 500000, from: '2026-06-15' }, { ym: '2026-07', amt: 1000000 }, { ym: '2026-08', amt: 600000, to: '2026-08-20' }] });
  assert.deepStrictEqual([U.wholePick(part, M), U.wholePick(S.normalizePerson({ name: 'y' }), M), U.wholePick(staff.people[0], M, '2026-08'), U.wholePick(staff.people[0], M, '2026-12'), U.wholePick(part, [])],
    [{ from: '2026-06-15', to: '2026-08-20', lo: '2026-06', hi: '2026-08', count: 3 }, { from: '2026-04-01', to: '2026-12-31', lo: '2026-04', hi: '2026-12', count: 9 }, { from: '2026-09-01', to: '2026-12-31', lo: '2026-09', hi: '2026-12', count: 4 }, null, null]);
});

console.log(`\n${n} passed${failed ? `, ${failed} failed` : ''}`);
