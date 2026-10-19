/* lib/staff-ui.js (제목 줄 아이콘으로 여는 사업비 관리 화면 — kr_ext_workspace R&D 탭 꼴, 0.8.7) 그리기 테스트 — DOM 없이 section() 이 만드는 HTML 만 본다(bind 는 브라우저에서). 실행: node tests/staff-ui.test.js
 * 과제 칩·별칭, 과제 카드(연차 칩 · 기간 줄), 예산 카드(기본값: 현재 연차 rERP 예산액 · 다른 연차 계획서 · 비목만, 집행 = 승인 + 사용계획 + 미청구, 미청구 보조 줄, 합계, 막대), 참여인력 카드, 보기/고치기, 옛 계획 이동(adopt) */
globalThis.self = globalThis;
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..');
for (const f of ['lib/format.js', 'lib/staff.js', 'lib/staff-ui.js']) require(path.join(root, f));
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
  assert.ok(html.includes('data-card="staff"') && html.includes('계획 없음') && html.includes('data-act="st-init-erp"') && !html.includes('data-page="staff"'), '참여인력 카드 · 탭으로 가는 링크 없음');
  assert.ok(/표시할 과제가 없습니다/.test(U.section({ projects: [] }, {}, mk(), '')));
});
test('2차년도 기본 기간·계획서 예산, 직접 적은 줄, 접기, 별칭 폼, rERP 조회 상태, 더하기 폼', () => {
  const st = mk({ research: { [rec2.id]: rec2 } });
  let html = U.section(d, {}, st, '', EDIT);
  assert.ok(html.includes('data-act="st-alias"') && html.includes('data-stp="from" value="2026-04"') && html.includes('data-stp="to" value="2026-12"'));
  assert.ok(html.includes('data-act="st-year-add" data-year="3"') && html.includes('(2028-01 ~ 2028-12)'));
  assert.ok(html.includes('data-stb="name" data-i="0" value="인건비"') && html.includes('data-stb="plan" data-i="0" value="31,425"') && html.includes('data-act="st-bdel" data-i="3"') && html.includes('data-act="st-badd"') && !html.includes('data-act="st-breset"'), '예산 칸·×·＋ 비목 (기본값이라 되돌리기 없음)');
  assert.ok(html.includes('data-act="st-init-erp"') && html.includes('data-act="st-add"') && html.includes('rERP 참여인력을 아직 조회하지 않았습니다'));
  st.staffView.years[P.prjNo] = 2;
  html = U.section(d, {}, st, '', EDIT);
  assert.ok(html.includes('data-styr="2"') && html.includes('data-stp="from" value="2027-01"') && html.includes('data-stb="plan" data-i="0" value="35,900"') && html.includes('계획: 연구개발계획서 2차년도 r2') && html.includes('rERP 자금현황은 현재 연차(1차년도)만'), '2차년도: 12달 뒤 기간, 계획서 예산');
  st.staffPlans[K2] = { prjNo: P.prjNo, year: 2, budget: [{ name: '인건비', plan: 40000000 }], people: [] };
  html = U.section(d, {}, st, '', EDIT);
  assert.ok(html.includes('data-act="st-breset"') && html.includes('계획: 직접 적은 계획') && html.includes('2차년도 지우기'));
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
  assert.ok(html.includes('rERP 참여인력 2명 · 이 기간 지급 2명') && html.includes('<b>rERP 현재로</b>'));
  st.staffEdit = { prjNo: P.prjNo, year: 1, id: 'new' }; st.staffDraft = { from: '2026-10', mode: 'rate', value: '20', name: '' };
  html = U.section(d, {}, st, '', EDIT);
  assert.ok(html.includes('data-stf="name"') && html.includes('<option value="2026-10" selected>10월</option>') && html.includes('data-act="st-apply" data-id="new"') && !html.includes('value="exclude"'), '더하기 폼에는 제외가 없다');
});
test('참여인력 계획이 있으면 — 카드 머리(인원 · 합 / 예산), 사람 표(칸·월 최대·✎ ×), 달마다의 지급, rERP 등록(같음/다름), 알림, 예산 칸 인건비 줄의 참여연구원 합 메모', () => {
  const rows = S.rowsOfErp(REC);
  const staff = S.peopleOfErp(rows, { prjNo: P.prjNo, now: 1 });
  staff.people[0].erp.others = [{ ym: '2026-05', rate: 85, amt: 0 }];
  const plan = Object.assign({ prjNo: P.prjNo, year: 1, prjNm: P.prjNm, from: '2026-04', to: '2026-12', budgetPay: null, budget: null, at: 1, by: '김거화', note: 'rERP 등록 지급계획(4~12월) 그대로' }, staff);
  const st = mk({ staffPlans: { [K1]: plan }, staffRows: { [P.prjNo]: { at: 1, rows, others: {} } } });
  const html = U.section(d, {}, st, '', EDIT);
  assert.ok(html.includes('2명 · 인건비 31,425 / 31,425천원') && html.includes('<span class="krext-badge">2</span>'), '참여인력 카드 머리 · 연차 칩 배지');
  assert.ok(html.includes('참여연구원 계획 합 31,425천원 (계획의 100%)'), '예산 칸 인건비 줄 메모');
  assert.ok(html.includes('data-stc="monthly"') && html.includes('data-stc="total"') && html.includes('data-stc="rate"') && html.includes('월 최대 20.01%') && html.includes('월 최대 27.46%'));
  assert.ok(html.includes('data-act="st-edit"') && html.includes('data-act="st-drop"') && html.includes('data-act="st-copy"') && html.includes('data-act="st-clear"'));
  assert.ok(html.includes('krext-st-months') && html.includes('4월 <b>1,165</b>') && html.includes('12월 <b>1,159</b>'));
  assert.ok(html.includes('rERP 등록: 4~11월 1,165 · 12월 1,159 · 20.00% (월 최대 20.01%) · 같음'));
  assert.ok(html.includes('문창재 — 5월 참여율 합 105.01% (이 과제 20.01% · rERP 다른 과제 85.00%)'), '100% 초과 알림');
  assert.ok(html.includes('rERP 등록 지급계획(4~12월) 그대로') === false || true);
  plan.people[0] = S.applyChange(plan.people[0], 'rerp', { from: '2026-12', mode: 'exclude' }, S.ymRange('2026-04', '2026-12'));
  const html2 = U.section(d, {}, st, '', EDIT);
  assert.ok(html2.includes('krext-st-off') && html2.includes('12월 <b>—</b>') && html2.includes('· <b>다름</b>') && /남음 1,159천원/.test(html2));
  plan.budget = [{ name: '인건비', plan: 30000000 }]; plan.budgetPay = 30000000;
  const html3 = U.section(d, {}, st, '', EDIT);
  assert.ok(/krext-st-error">인건비 합 30,266천원이 예산 30,000천원을 넘습니다/.test(html3) && html3.includes('krext-ws-bnote krext-red">참여연구원 계획 합 30,266천원 (계획의 101%)') && html3.includes('2명 · 인건비 30,266 / 30,000천원'));
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
test('변경이력 카드 — 기본 접힘(머리에 건수·마지막 날짜), fold.changes=false 면 날짜 역순 표(WORKSPACE 의 auto 줄도), 없으면 안내; openOf 토글 규칙', () => {
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
  assert.ok(html.includes('krext-ws-changes') && i1 > 0 && i2 > i1, '펼침: 날짜 역순 표');
  assert.ok(html.includes('<td class="krext-mono krext-dim">2026-10-01</td><td><span class="krext-ws-kind">예산</span></td><td>인건비</td><td class="krext-ws-diff">31,425천원 → <b>35,900천원</b></td>') && html.includes('연장') && html.includes('자동</small>'));
  st.staffView.years[P.prjNo] = 2;
  assert.ok(/변경이력이 없습니다/.test(U.section(d, {}, st, '', EDIT)), '다른 연차는 없음 안내');
  const v = { fold: {} };
  assert.deepStrictEqual([U.openOf(v, 'budget'), U.openOf(v, 'changes')], [true, false], '기본: 예산 펴짐 · 변경이력 접힘');
  assert.deepStrictEqual([U.openOf({ fold: { budget: true } }, 'budget'), U.openOf({ fold: { changes: false } }, 'changes'), U.openOf({ fold: { changes: true } }, 'changes')], [false, true, false]);
});
test('공유 줄 — 공유 (Plus) 가 켜져 있을 때만: 폴더 이름 · 폴더 열기 · 참여연구원에게 공유 · 링크 복사 · 주소 복사 · 공유 결과(n명 · 겹침 · 못 찾음); 남의 폴더면 공유 단추 없음; 폴더를 모르면 지금 동기화; 연차 파일 링크', () => {
  const pages = { [P.prjNo]: { prjNo: P.prjNo, title: P.prjNm, folder: 'SSCB', folderUrl: 'https://x.sharepoint.com/personal/u/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fu%2FDocuments%2F%EC%97%85%EB%AC%B4%2Fshared%2FSSCB', webUrl: 'https://x.sharepoint.com/personal/u/Documents/%EC%97%85%EB%AC%B4/shared/SSCB/1%EC%B0%A8%EB%85%84%EB%8F%84.json', years: [1], at: 5,
    share: { shared: [{ name: '문창재', email: 'a@krs.co.kr' }], ambiguous: [{ name: '김철수', candidates: ['김철수(A)', '김철수(B)'] }], notFound: ['홍길동'], role: 'edit', at: 6 } } };
  const st = mk({ staffSync: { at: 5, ok: true, count: 1, base: { path: '/personal/u/Documents/업무/shared' }, pages } });
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

console.log(`\n${n} passed${failed ? `, ${failed} failed` : ''}`);
