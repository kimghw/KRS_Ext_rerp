/* 참여연구원 변경 도우미(채팅, 0.8.8) 테스트 — lib/staff-chat-core.js(입력 정리 · 프롬프트 · 스키마 · 결과 검사 · 작업 한 줄 글), lib/staff-ui.js bind().agent(계획 요약 snapshot · 작업 반영 apply — 표의 칸·✎ 폼과 같은 길),
 * help-server/staff-chat.js run(claude -p 인수와 stream-json 결과 읽기 — child_process.spawn 은 가짜). DOM·chrome·claude 없이. 실행: node tests/staff-chat.test.js */
globalThis.self = globalThis;
const path = require('path');
const assert = require('assert');
const EventEmitter = require('events');
const root = path.join(__dirname, '..');
for (const f of ['lib/format.js', 'lib/staff.js', 'lib/staff-ui.js']) require(path.join(root, f));
const C = require(path.join(root, 'lib/staff-chat-core.js'));   // Node 에서는 module.exports (확장에서는 self.KRX_STAFF_CHAT_CORE)
globalThis.KRX_STAFF_CHAT_CORE = C;
const S = KRX_STAFF, U = KRX_STAFF_UI;
let n = 0, failed = 0;
const queue = [];
const test = (name, fn) => queue.push([name, fn]);

const REC = [
  { EMP_NM: '문창재', ROLE_NM: '참여연구원', PAY_LIMT_AMT: '5823000', PAY_AMT: '1165000', PART_RT: '20.01', PLAN_YM_FROM: '202604', PLAN_YM_TO: '202611', NCNT: '8', REQ_CNT: '9', SEQ_NO: '2' },
  { EMP_NM: '문창재', ROLE_NM: '참여연구원', PAY_LIMT_AMT: '5823000', PAY_AMT: '1159000', PART_RT: '19.91', PLAN_YM_FROM: '202612', PLAN_YM_TO: '202612', NCNT: '1', REQ_CNT: '9', SEQ_NO: '2' },
  { EMP_NM: '김거화', ROLE_NM: '과제책임자', PAY_LIMT_AMT: '8480000', PAY_AMT: '2328000', PART_RT: '27.46', PLAN_YM_FROM: '202604', PLAN_YM_TO: '202611', NCNT: '8', REQ_CNT: '9', SEQ_NO: '1' },
  { EMP_NM: '김거화', ROLE_NM: '과제책임자', PAY_LIMT_AMT: '8480000', PAY_AMT: '2322000', PART_RT: '27.39', PLAN_YM_FROM: '202612', PLAN_YM_TO: '202612', NCNT: '1', REQ_CNT: '9', SEQ_NO: '1' },
];
const ITEMS = [{ exp: '인건비', bgt: 31425000, appr: 0, req: 0 }, { exp: '연구활동비', bgt: 50000000, appr: 19712839, req: 148500 }];   // 인건비 승인액 0 — 아직 지급된 달이 없어 잠금 없음
const P = { prjNo: '2026-0063-01', prjNm: 'MW급 10kV 고전압 직류 시스템용 반도체 차단기 개발', rspr: '김거화', anl: '1', stDt: '20260401', endDt: '20261231', budget: { items: ITEMS, bgtAmt: 81425000, apprAmt: 19712839 } };
const SNAP = { prjNo: P.prjNo, alias: 'SSCB', prjNm: P.prjNm, year: 1, from: '2026-04', to: '2026-12', months: 9, today: '2026-10-19', lock: '', budgetPay: 31425, total: 29535, diff: '부족금 1,890천원', basis: 'rerp',
  names: ['문창재', '김거화'], people: ['문창재 — 참여연구원 · 월급여 5,823천원(rERP) · 4~12월 (9개월) · 계상인건비 10,479천원 · 참여율 20.00% (월 최대 20.01%) · 월별 4~11월 1,165 · 12월 1,159', '김거화 — 과제책임자 · 월급여 8,480천원(rERP) · 4~12월 (9개월) · 계상인건비 19,056천원 · 참여율 24.97% (월 최대 27.46%)'],
  support: '조주희(행정 담당·참조)', supportNames: ['조주희'], erp: { at: '10.19 22:34', lines: ['문창재 — rERP 등록 4~11월 1,165 · 12월 1,159 · 계획과 같음'], missing: ['홍길동 (참여연구원) — 월급여 6,000천원 · rERP 등록 4~12월 1,200 · 20.00%'] },
  warnings: ['인건비 합 29,535천원 · 예산 31,425천원 — 부족금 1,890천원 (예산보다 적게 잡음).'], defaultRange: { from: '2026-11-01', to: '2026-12-31' }, years: [1, 2], hasPlan: true, erpState: '' };

test('core.clean — 글이 비면 거부, 이름·줄·대화를 한도 안에서 정리하고 날짜·달·잠금은 모양을 맞춤', () => {
  assert.throws(() => C.clean({ text: '  ' }), /비어/);
  const i = C.clean({ text: ' 문창재  11월부터 25% ', history: [{ role: 'assistant', text: 'x'.repeat(500) }, { role: 'bogus', text: '' }, { text: '앞 요청' }], snapshot: Object.assign({}, SNAP, { from: '202604', to: '2026-12-01', today: '2026.10.19', lock: '2026-09-30', names: ['문창재', '문창재', ' 김거화 '], years: ['1', 2, 'x', 99] }) });
  assert.strictEqual(i.text, '문창재 11월부터 25%');
  assert.deepStrictEqual(i.history, [{ role: 'assistant', text: 'x'.repeat(C.LIMIT.turn) }, { role: 'user', text: '앞 요청' }], '글 없는 줄은 빼고 역할은 user/assistant 만');
  assert.deepStrictEqual([i.snapshot.from, i.snapshot.to, i.snapshot.today, i.snapshot.lock, i.snapshot.names, i.snapshot.years, i.snapshot.supportNames], ['2026-04', '2026-12', '2026-10-19', '2026-09', ['문창재', '김거화'], [1, 2], ['조주희']]);
  assert.strictEqual(i.snapshot.hasPlan, true); assert.strictEqual(i.snapshot.budgetPay, 31425);
  const e = C.clean({ text: 'x' }).snapshot;
  assert.deepStrictEqual([e.names, e.people, e.erp.lines, e.budgetPay, e.hasPlan, e.year, e.lock], [[], [], [], null, false, 1, ''], '요약이 없어도 빈 모양');
});
test('core.build — 사용자 메시지에 과제·기간·잠금·예산·부족금·사람 줄·행정지원·rERP·알림·직전 날짜·작업 안내·이전 대화·요청이 들고, 스키마는 작업·이름 enum 과 모든 칸 required', () => {
  const i = C.clean({ text: '문창재 11월부터 25%로', history: [{ role: 'user', text: '김거화 12월 제외' }, { role: 'assistant', text: '12월을 제외했습니다. (반영: 김거화 — 2026-12-01~2026-12-31 제외)' }], snapshot: Object.assign({}, SNAP, { lock: '2026-08' }) });
  const { text, schema } = C.build(i);
  for (const s of ['SSCB — MW급', '(2026-0063-01) · 1차년도 · 계획 기간 2026-04 ~ 2026-12 (9개월)', '오늘: 2026-10-19 · 있는 연차: 1, 2차년도', 'rERP 지급 완료: 2026-08 까지', '적용일은 2026-09-01 이후로', '인건비 예산: 31,425천원 · 계획 합 29,535천원 · 부족금 1,890천원', '참여연구원 2명', '- 문창재 — 참여연구원 · 월급여 5,823천원', '행정지원: 조주희(행정 담당·참조)',
    'rERP 참여인력: 10.19 22:34 조회', '- 문창재 — rERP 등록', 'add 후보', '- 홍길동 (참여연구원)', '알림:', '- 인건비 합 29,535천원', '직전 변경의 날짜', '2026-11-01 ~ 2026-12-31', '작업(ops) 종류', '- change:', 'fit(예산에 맞추기', '- support_add / support_remove', '이전 대화:', '사용자: 김거화 12월 제외', '도우미: 12월을 제외했습니다.', '요청: 문창재 11월부터 25%로']) assert.ok(text.includes(s), `프롬프트에 "${s}"`);
  assert.deepStrictEqual(schema.required, ['reply', 'ops']);
  const op = schema.properties.ops.items;
  assert.strictEqual(op.additionalProperties, false);
  assert.deepStrictEqual(op.required, ['op', 'name', 'newName', 'role', 'from', 'to', 'mode', 'value', 'monthly', 'how', 'year', 'supportRole', 'ref']);
  assert.deepStrictEqual(op.properties.op.enum, C.OPS.slice());
  assert.deepStrictEqual(op.properties.name.enum, ['문창재', '김거화', '조주희', ''], '이름은 계획 + 행정지원 목록 + 빈 값');
  assert.deepStrictEqual(op.properties.mode.enum, ['rate', 'amt', 'exclude', 'short', 'fit', '']);
  assert.ok(C.SYSTEM.includes('ops 를 비우고 reply 로 되묻는다') && C.SYSTEM.includes('clear · 초기화 init · 사람 빼기 remove') && C.SYSTEM.includes('잠금'));
  const none = C.build(C.clean({ text: 'x', snapshot: { prjNo: 'p', hasPlan: false, erpState: 'rERP 참여인력 조회 전' } })).text;
  assert.ok(none.includes('계획이 아직 없습니다') && none.includes('rERP 참여인력: rERP 참여인력 조회 전') && none.includes('기간 미정') && !none.includes('이전 대화:') && !none.includes('지급 완료'));
});
test('core.parse — 통과한 작업만 필요한 칸으로, 모르는 작업·목록 밖 이름·못 읽는 날짜·값은 버림(dropped), 띄어쓰기 다른 이름은 목록 표기로, fit 은 값 없이', () => {
  const i = C.clean({ text: 'x', snapshot: SNAP });
  const blank = { name: '', newName: '', role: '', from: '', to: '', mode: '', value: 0, monthly: 0, how: '', year: 0, supportRole: '', ref: true };
  const o = (x) => Object.assign({}, blank, x);
  const r = C.parse(i, { reply: ' 반영합니다. ', ops: [
    o({ op: 'change', name: '문 창재', from: '2026-11-01', mode: 'rate', value: 25 }),
    o({ op: 'change', name: '김거화', from: '2026-12', to: '2026.12.31', mode: 'exclude', value: 99 }),
    o({ op: 'change', name: '홍길동', mode: 'rate', value: 10 }),          // 목록에 없음
    o({ op: 'change', name: '문창재', from: '11월', mode: 'rate', value: 10 }),   // 날짜를 못 읽음
    o({ op: 'change', name: '문창재', mode: 'rate', value: -1 }),          // 값이 틀림
    o({ op: 'change', name: '문창재', mode: 'short', value: 100 }),
    o({ op: 'change', name: '문창재', from: '2026-11-01', mode: 'fit', value: 7 }),
    o({ op: 'total', name: '문창재', from: '2026-10-01', to: '2026-12-31', value: 3000 }),
    o({ op: 'monthly', name: '김거화', value: 0 }),
    o({ op: 'role', name: '김거화', role: '참여연구원' }), o({ op: 'role', name: '김거화', role: '대표' }),
    o({ op: 'remove', name: '김거화' }),
    o({ op: 'add', newName: '홍길동', role: '', monthly: 6000, from: '20260701', mode: '', value: 20 }),
    o({ op: 'add', newName: '이몽룡', mode: 'fit', value: 3 }),
    o({ op: 'add', newName: '' }),
  ] });
  assert.strictEqual(r.reply, '반영합니다.');
  assert.strictEqual(r.dropped, 5);
  assert.deepStrictEqual(r.ops, [
    { op: 'change', name: '문창재', from: '2026-11-01', to: '', mode: 'rate', value: 25 },
    { op: 'change', name: '김거화', from: '2026-12', to: '2026-12-31', mode: 'exclude', value: 0 },
    { op: 'change', name: '문창재', from: '', to: '', mode: 'short', value: 100 },
    { op: 'change', name: '문창재', from: '2026-11-01', to: '', mode: 'fit', value: 0 },
    { op: 'total', name: '문창재', from: '2026-10-01', to: '2026-12-31', value: 3000 },
    { op: 'monthly', name: '김거화', value: 0 },
    { op: 'role', name: '김거화', role: '참여연구원' },
    { op: 'remove', name: '김거화' },
    { op: 'add', newName: '홍길동', role: '참여연구원', monthly: 6000, from: '2026-07-01', to: '', mode: 'rate', value: 20, supportRole: '', ref: true },
    { op: 'add', newName: '이몽룡', role: '참여연구원', monthly: 0, from: '', to: '', mode: 'rate', value: 3, supportRole: '', ref: true },
  ]);
  const r2 = C.parse(i, { reply: 'x', ops: [
    o({ op: 'init', how: 'prev' }), o({ op: 'init', how: 'x' }), o({ op: 'init', how: 'carry' }), o({ op: 'clear' }),
    o({ op: 'year', year: 2 }), o({ op: 'year', year: 0 }),
    o({ op: 'period', from: '2027-01', to: '2027-12' }), o({ op: 'period' }),
    o({ op: 'budget', value: 35000 }),
    o({ op: 'support_add', newName: '이몽룡', supportRole: '행정', ref: false }), o({ op: 'support_remove', name: '조주희' }), o({ op: 'support_remove', name: '문창재' }),
    o({ op: 'fly' }), 'junk',
  ] });
  assert.strictEqual(r2.dropped, 5);
  assert.deepStrictEqual(r2.ops, [
    { op: 'init', how: 'prev' }, { op: 'init', how: 'erp' }, { op: 'init', how: 'carry' }, { op: 'clear' },
    { op: 'year', year: 2 },
    { op: 'period', from: '2027-01', to: '2027-12' },
    { op: 'budget', value: 35000 },
    { op: 'support_add', newName: '이몽룡', supportRole: '행정', ref: false }, { op: 'support_remove', name: '조주희' },
  ]);
  assert.strictEqual(C.parse(i, { ops: Array(30).fill(o({ op: 'clear' })) }).ops.length, C.LIMIT.ops, '작업은 한 번에 20개까지');
  assert.deepStrictEqual(C.parse(i, null), { reply: '', ops: [], dropped: 0 });
  assert.deepStrictEqual([C.dateOf('2026-02-30'), C.dateOf('2026/5/1'), C.dateOf('202605'), C.ymOf('2026-05-07'), C.dateOf('')], ['', '2026-05-01', '2026-05', '2026-05', '']);
});
test('core.opText — 작업마다 한 줄', () => {
  assert.deepStrictEqual([
    C.opText({ op: 'change', name: '문창재', from: '2026-11-01', to: '', mode: 'rate', value: 25 }), C.opText({ op: 'change', name: '김거화', from: '2026-12-01', to: '2026-12-31', mode: 'exclude' }), C.opText({ op: 'change', name: '문창재', from: '', mode: 'short', value: 100 }), C.opText({ op: 'change', name: '문창재', from: '2026-11-01', mode: 'fit' }),
    C.opText({ op: 'total', name: '문창재', value: 3000 }), C.opText({ op: 'monthly', name: '김거화', value: 0 }), C.opText({ op: 'role', name: '김거화', role: '참여연구원' }), C.opText({ op: 'remove', name: '김거화' }),
    C.opText({ op: 'add', newName: '홍길동', role: '참여연구원', monthly: 6000, from: '2026-07-01', mode: 'rate', value: 20 }), C.opText({ op: 'add', newName: '이몽룡', role: '행정지원', supportRole: '행정' }),
    C.opText({ op: 'init', how: 'erp' }), C.opText({ op: 'init', how: 'carry' }), C.opText({ op: 'clear' }), C.opText({ op: 'year', year: 2 }), C.opText({ op: 'period', from: '2027-01', to: '2027-12' }), C.opText({ op: 'budget', value: 35000 }), C.opText({ op: 'support_remove', name: '조주희' }),
  ], ['문창재 — 2026-11-01~ 참여율 25%', '김거화 — 2026-12-01~2026-12-31 제외', '문창재 — 전체 나머지의 100%', '문창재 — 2026-11-01~ 예산에 맞추기', '문창재 — 전체 지급 합 3,000천원', '김거화 — 월급여 rERP 값으로', '김거화 — 역할 참여연구원', '김거화 빼기',
    '홍길동 더하기 (참여연구원 · 월급여 6,000천원 · 2026-07-01~ 참여율 20%)', '행정지원 이몽룡 더하기 (행정)', '초기화 — rERP 현재로', '초기화 — 이전 차년도에서 가져오기', '이 연차 계획 지우기', '2차년도로', '기간 2027-01 ~ 2027-12', '인건비 예산 35,000천원', '행정지원 조주희 빼기']);
});

/* staff-ui 의 agent — 가짜 chrome(저장소는 바로 실행되는 thenable)·host 로 bind 한 뒤 snapshot·apply 를 부른다 */
async function withAgent(run) {   // run 이 끝날 때까지(await) 가짜 chrome 을 유지 — 반영이 비동기라 finally 가 먼저 돌면 저장소 쓰기가 조용히 빠진다
  const writes = [], sent = [];
  const local = { projectSupport: { [P.prjNo]: { people: [{ name: '조주희', role: '행정 담당', ref: true }], at: 1 } }, rndUser: { userNm: '나' } };
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const thenable = (v) => ({ then: (ok) => thenable(ok ? ok(v) : undefined) });
  const priorChrome = globalThis.chrome, priorTimeout = globalThis.setTimeout;
  globalThis.chrome = { storage: { local: { get: () => thenable(clone(local)), set: (v) => { const next = clone(v); writes.push(next); Object.assign(local, next); return thenable(); }, remove: () => thenable() }, onChanged: { addListener() {} } }, runtime: { sendMessage: (m) => { sent.push(m); return { then() {} }; } } };
  globalThis.setTimeout = () => 0;
  try {
    const st = { data: { projects: [P] }, staffPlans: {}, staffRows: { [P.prjNo]: { rows: S.rowsOfErp(REC), at: Date.UTC(2026, 9, 19, 13, 34), others: {}, appr: 0 } }, staffView: { prjNo: P.prjNo, years: { [P.prjNo]: 1 }, extra: {}, inc: {}, fold: {} }, research: {}, plans: {}, staffAliases: { [P.prjNo]: 'SSCB' }, page: 'staff', staffOnly: 'staff' };
    let draws = 0;
    const api = U.bind({ addEventListener() {}, contains: () => true, querySelector: () => ({ focus() {}, select() {} }) }, st, () => { draws++; });
    return await run({ api, st, writes, sent, local, draws: () => draws });
  } finally { globalThis.chrome = priorChrome; globalThis.setTimeout = priorTimeout; }
}
const planOf = (st, year = 1) => st.staffPlans[S.planKey(P.prjNo, year)] || null;
const personOf = (st, name, year = 1) => (planOf(st, year) || { people: [] }).people.find((q) => q.name === name) || null;
const statsOf = (st, name, year = 1) => { const q = personOf(st, name, year); return q ? S.personStats(q, planOf(st, year).basis) : null; };
const totalOf = (st, year = 1) => S.staffTotal(planOf(st, year), 'rerp');

test('agent.snapshot — 계획이 없을 때(rERP 등록 사람은 add 후보)와 init 뒤(이름·사람 줄·예산·합·알림·rERP 비교·직전 날짜·연차·잠금 없음)', async () => {
  await withAgent(async ({ api, st }) => {
    const a = api.agent.snapshot();
    assert.deepStrictEqual([a.prjNo, a.alias, a.year, a.from, a.to, a.months, a.hasPlan, a.names, a.people, a.budgetPay, a.total, a.diff, a.years, a.erpState, a.lock], [P.prjNo, 'SSCB', 1, '2026-04', '2026-12', 9, false, [], [], 31425, null, '', [1, 2], '', '']);
    assert.strictEqual(a.erp.missing.length, 2); assert.ok(a.erp.missing[0].startsWith('문창재 (참여연구원) — 월급여 5,823천원 · rERP 등록 4~11월 1,165 · 12월 1,159 · 20.00%'), a.erp.missing[0]);
    assert.deepStrictEqual([a.support, a.supportNames, a.erp.lines, a.defaultRange.from.length], ['조주희(행정 담당·참조)', ['조주희'], [], 10]);
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(a.today) && /\d{2}\.\d{2} \d{2}:\d{2}/.test(a.erp.at));
    const r = await api.agent.apply([{ op: 'init', how: 'erp' }]);
    assert.strictEqual(r.length, 1); assert.ok(r[0].ok, r[0].msg); assert.strictEqual(r[0].text, '초기화 — rERP 현재로'); assert.ok(r[0].msg.includes('참여연구원 2명 — rERP 등록 지급계획(4~12월) 그대로'), r[0].msg);
    const b = api.agent.snapshot();
    assert.deepStrictEqual([b.hasPlan, b.names, b.total, b.diff, b.erp.missing], [true, ['문창재', '김거화'], 31425, '예산과 같음', []]);
    assert.ok(b.people[0].startsWith('문창재 — 참여연구원 · 월급여 5,823천원(rERP) · 4~12월 (9개월) · 계상인건비 10,479천원 · 참여율 20.00% (월 최대 20.01%) · 월별 4~11월 1,165 · 12월 1,159'), b.people[0]);
    assert.deepStrictEqual(b.erp.lines, ['문창재 — rERP 등록 4~11월 1,165 · 12월 1,159 · 계획과 같음', '김거화 — rERP 등록 4~11월 2,328 · 12월 2,322 · 계획과 같음']);
    assert.ok(b.warnings.some((w) => w.includes('예산과 같습니다')), b.warnings.join(' | '));
  });
});
test('agent.apply — change(적용일부터 · 전체 · 제외 · 나머지의 % · 예산에 맞추기) · total · monthly · role · add · remove · support · year · budget · period · clear 가 표의 칸·폼과 같은 길로 반영되고 작업마다 ok·text·msg, 실패해도 다음 작업은 계속, 변경이력에 남음', async () => {
  await withAgent(async ({ api, st, local }) => {
    await api.agent.apply([{ op: 'init', how: 'erp' }]);
    let r = await api.agent.apply([{ op: 'change', name: '문창재', from: '2026-11-01', to: '', mode: 'rate', value: 25 }, { op: 'change', name: '나그네', mode: 'rate', value: 10 }, { op: 'change', name: '김거화', from: '2026-12', to: '2026-12', mode: 'exclude', value: 0 }]);
    assert.deepStrictEqual(r.map((x) => x.ok), [true, false, true]);
    assert.ok(r[0].msg.startsWith('문창재 — 참여율 변경: 20.00% · 10,479천원 · 4~12월 → '), r[0].msg);
    assert.strictEqual(r[1].msg, '나그네 이(가) 1차년도 계획에 없습니다.');
    const m = personOf(st, '문창재');
    assert.deepStrictEqual(m.plan.filter((x) => x.ym >= '2026-11').map((x) => x.amt), [1456000, 1456000], '11·12월 = round천원(5,823 × 25%)');
    assert.deepStrictEqual(m.plan.filter((x) => x.ym < '2026-11').map((x) => x.amt), Array(7).fill(1165000), '그 앞은 그대로');
    assert.deepStrictEqual(st.staffLastRange, { key: S.planKey(P.prjNo, 1), from: '2026-12-01', to: '2026-12-31' }, '다음 폼의 기본 날짜 = 마지막으로 반영한 작업의 날짜(applyForm 과 같은 길)');
    assert.strictEqual(personOf(st, '김거화').plan.find((x) => x.ym === '2026-12').amt, 0, '12월 제외');
    assert.strictEqual(st.staffDraft, null, '반영 뒤 폼은 닫힘');
    r = await api.agent.apply([{ op: 'change', name: '문창재', from: '2026-11-01', to: '', mode: 'fit', value: 0 }]);   // 11·12월을 올려 초과금 → 그 기간에서 줄여 예산과 같게
    assert.ok(r[0].ok, r[0].msg); assert.ok(r[0].msg.includes('예산 맞춤') && r[0].msg.includes('채움'), r[0].msg);   // 12월 제외로 생긴 부족금을 문창재의 11~12월에 채움
    assert.strictEqual(totalOf(st), 31425000, '예산과 같아짐');
    r = await api.agent.apply([{ op: 'change', name: '김거화', from: '', to: '', mode: 'rate', value: 20 }]);
    assert.ok(r[0].ok); assert.deepStrictEqual(personOf(st, '김거화').plan.map((x) => x.amt), Array(8).fill(1696000).concat([0]), '적용일이 없으면 지급이 있는 전체 기간(4~11월 — 참여율 칸과 같은 규칙, 제외한 12월은 그대로)');
    r = await api.agent.apply([{ op: 'total', name: '문창재', from: '', to: '', value: 9000 }, { op: 'monthly', name: '문창재', value: 6000 }, { op: 'role', name: '문창재', role: '과제책임자' }, { op: 'role', name: '문창재', role: '과제책임자' }]);
    assert.deepStrictEqual(r.map((x) => x.ok), [true, true, true, true]);
    assert.strictEqual(statsOf(st, '문창재').total, 9000000);
    assert.strictEqual(personOf(st, '문창재').manual, 6000000); assert.ok(r[1].msg.includes('월급여'));
    assert.deepStrictEqual([personOf(st, '문창재').role, r[3].msg], ['과제책임자', '문창재 — 역할이 이미 책임 입니다.']);
    r = await api.agent.apply([{ op: 'add', newName: '홍길동', role: '참여연구원', monthly: 6000, from: '2026-07-01', to: '', mode: 'rate', value: 20 }, { op: 'add', newName: '홍길동', role: '참여연구원', monthly: 0, from: '', to: '', mode: 'rate', value: 10 }]);
    assert.deepStrictEqual(r.map((x) => x.ok), [true, false]); assert.strictEqual(r[1].msg, '홍길동 은(는) 이미 있습니다.');
    const h = personOf(st, '홍길동');
    assert.deepStrictEqual([h.manual, h.plan.map((x) => x.ym)[0], h.plan.length, h.plan[0].amt], [6000000, '2026-07', 6, 1200000]);
    assert.ok(r[0].msg.startsWith('홍길동 을(를) 더했습니다 — 20.00% · 7,200천원 · 7~12월'), r[0].msg);
    r = await api.agent.apply([{ op: 'change', name: '홍길동', from: '2026-10-01', to: '', mode: 'short', value: 100 }]);
    assert.ok(r[0].ok, r[0].msg); assert.ok(r[0].msg.includes('나머지') && r[0].msg.includes('= '), r[0].msg);
    assert.strictEqual(totalOf(st), 31425000, '나머지의 100% 를 넣으면 합이 정확히 예산');
    r = await api.agent.apply([{ op: 'support_add', newName: '이몽룡', supportRole: '행정', ref: false }, { op: 'support_remove', name: '조주희' }, { op: 'support_remove', name: '없는이' }, { op: 'remove', name: '홍길동' }]);
    assert.deepStrictEqual(r.map((x) => x.ok), [true, true, false, true]);
    assert.deepStrictEqual(local.projectSupport[P.prjNo].people, [{ name: '이몽룡', role: '행정', ref: false }], '행정지원 저장소(projectSupport)에도 씀');
    assert.ok(local.staffPlans && local.staffPlans[S.planKey(P.prjNo, 1)], '계획 저장소(staffPlans)에도 씀');
    assert.ok(r[0].msg.includes('이몽룡') && r[0].msg.includes('더함'), r[0].msg);
    assert.strictEqual(personOf(st, '홍길동'), null); assert.strictEqual(r[3].msg, '홍길동 을(를) 뺐습니다.');
    r = await api.agent.apply([{ op: 'year', year: 2 }, { op: 'clear' }, { op: 'budget', value: 40000 }, { op: 'period', from: '2027-02', to: '' }]);
    assert.deepStrictEqual([r[0].ok, r[0].msg, api.agent.current().year, r[1].ok, r[1].msg], [true, '2차년도 로 옮겼습니다.', 2, false, '2차년도 계획이 없습니다.']);
    assert.ok(r[2].ok && r[2].msg.startsWith('인건비 예산 40,000천원'), r[2].msg);
    assert.strictEqual(planOf(st, 2).budgetPay, 40000000);
    assert.ok(r[3].ok && r[3].msg.includes('2차년도 계획 기간 2027-02 ~ 2027-12'), r[3].msg);
    r = await api.agent.apply([{ op: 'year', year: 1 }, { op: 'clear' }]);
    assert.deepStrictEqual([r[1].ok, r[1].msg, planOf(st, 1)], [true, '1차년도 계획을 지웠습니다.', null]);
    const ch = (st.staffChanges[S.planKey(P.prjNo, 1)] || []).map((c) => `${c.item}: ${c.after}`);
    assert.ok(ch.some((c) => c.includes('(참여율 변경)')) && ch.some((c) => c.includes('(더함')) && ch.some((c) => c.includes('(뺌)')) && ch.some((c) => c.includes('(지움)')) && ch.some((c) => c.startsWith('문창재 역할: 과제책임자')), ch.join('\n'));
    r = await api.agent.apply([{ op: 'fly' }]);
    assert.deepStrictEqual([r[0].ok, r[0].msg], [false, '모르는 작업입니다: fly']);
  });
});
test('agent.apply fit — 초과금이 생기면 그 기간에서 줄여 합을 예산과 같게', async () => {
  await withAgent(async ({ api, st }) => {
    await api.agent.apply([{ op: 'init', how: 'erp' }, { op: 'change', name: '문창재', from: '2026-11-01', to: '', mode: 'rate', value: 25 }]);
    assert.ok(totalOf(st) > 31425000, '초과');
    const r = await api.agent.apply([{ op: 'change', name: '문창재', from: '2026-11-01', to: '', mode: 'fit', value: 0 }]);
    assert.ok(r[0].ok, r[0].msg); assert.strictEqual(r[0].text, '문창재 — 2026-11-01~ 예산에 맞추기');
    assert.strictEqual(totalOf(st), 31425000, r[0].msg);
    assert.ok(r[0].msg.includes('예산 맞춤') || r[0].msg.includes('줄임'), r[0].msg);
  });
});
test('agent.apply init — rERP 조회가 없으면 먼저 받는다(백그라운드 callService)', async () => {
  await withAgent(async ({ api, st, sent }) => {
    st.staffRows = {};
    const p = api.agent.apply([{ op: 'init', how: 'erp' }]);
    const call = sent.find((m) => m.type === 'callService');
    assert.ok(call && call.service === 'rtask_0008_t03_01_r001', 'rERP 참여인력 조회를 먼저');
    assert.strictEqual(typeof p.then, 'function');   // 가짜 sendMessage 는 답하지 않으므로 여기서는 기다리기만
  });
});
test('agent.apply init carry — 이전 차년도에서 가져오기(2026-10-20): 1차년도에는 거부, 1차년도 계획의 연구원·월급여·참여율을 2차년도 기간 전체에(초과금 빨강이어도 성공), 계획이 있어도 한 번에(두 번 누르기 없음)', async () => {
  await withAgent(async ({ api, st }) => {
    let r = await api.agent.apply([{ op: 'init', how: 'carry' }]);
    assert.deepStrictEqual([r[0].ok, r[0].text, r[0].msg], [false, '초기화 — 이전 차년도에서 가져오기', '1차년도에는 가져올 앞 연차가 없습니다.']);
    r = await api.agent.apply([{ op: 'init', how: 'erp' }, { op: 'year', year: 2 }, { op: 'budget', value: 35900 }, { op: 'init', how: 'carry' }]);
    assert.ok(r.every((x) => x.ok), JSON.stringify(r));
    assert.ok(r[3].msg.startsWith('2차년도 참여연구원 2명 — 1차년도 계획에서 연구원·월급여·참여율을 가져와 1~12월 전체(12개월)에 · 초과금 6,016천원'), r[3].msg);
    assert.deepStrictEqual(planOf(st, 2).people.map((q) => [q.name, q.plan.length, q.plan[0].amt, q.plan[11].ym]), [['문창재', 12, 1165000, '2027-12'], ['김거화', 12, 2328000, '2027-12']]);
    personOf(st, '문창재', 2).plan[0].amt = 0;
    r = await api.agent.apply([{ op: 'init', how: 'carry' }]);
    assert.ok(r[0].ok && personOf(st, '문창재', 2).plan[0].amt === 1165000, JSON.stringify(r));
  });
});

/* help-server/staff-chat.js run — child_process.spawn 을 가짜로: 인수를 보고 stream-json result 한 줄을 돌려준다 */
test('server run — claude -p 인수(모델 · --safe-mode · 도구 없음 · --json-schema · 시스템 프롬프트)와 stdin 의 요청 글, structured_output → parse', async () => {
  const cp = require('child_process');
  const realSpawn = cp.spawn;
  let seen = null;
  cp.spawn = (bin, args) => {
    const child = new EventEmitter();
    seen = { bin, args, stdin: '' };
    child.stdin = { on() {}, end(s) { seen.stdin = String(s); } };
    child.stdout = new EventEmitter(); child.stdout.setEncoding = () => {};
    child.stderr = new EventEmitter(); child.stderr.setEncoding = () => {};
    child.kill = () => {};
    setImmediate(() => {
      child.stdout.emit('data', JSON.stringify({ type: 'system', subtype: 'init' }) + '\n' + JSON.stringify({ type: 'result', is_error: false, total_cost_usd: 0.02, duration_api_ms: 3000,
        structured_output: { reply: '11월부터 25% 로 바꿉니다.', ops: [{ op: 'change', name: '문창재', newName: '', role: '', from: '2026-11-01', to: '', mode: 'rate', value: 25, monthly: 0, how: '', year: 0, supportRole: '', ref: true }, { op: 'remove', name: '아무개', newName: '', role: '', from: '', to: '', mode: '', value: 0, monthly: 0, how: '', year: 0, supportRole: '', ref: true }] } }) + '\n');
      child.emit('close', 0);
    });
    return child;
  };
  try {
    const runner = require(path.join(root, 'help-server/staff-chat.js'));
    const input = runner.clean({ text: '문창재 11월부터 25%로', snapshot: SNAP });
    const out = await runner.run(input, { bins: ['claude-x'], model: 'claude-opus-5-5', fallback: '', env: {}, timeoutMs: 5000 });
    assert.deepStrictEqual([out.reply, out.ops, out.dropped, out.cost], ['11월부터 25% 로 바꿉니다.', [{ op: 'change', name: '문창재', from: '2026-11-01', to: '', mode: 'rate', value: 25 }], 1, 0.02]);
    assert.strictEqual(seen.bin, 'claude-x');
    const a = seen.args;
    for (const s of ['-p', '--safe-mode', '--no-session-persistence', '--strict-mcp-config', '--json-schema', '--system-prompt']) assert.ok(a.includes(s), s);
    assert.strictEqual(a[a.indexOf('--model') + 1], 'claude-opus-5-5');
    assert.strictEqual(a[a.indexOf('--tools') + 1], '', '도구 없음');
    assert.ok(!a.includes('--fallback-model'));
    assert.strictEqual(a[a.indexOf('--system-prompt') + 1], C.SYSTEM);
    assert.deepStrictEqual(JSON.parse(a[a.indexOf('--json-schema') + 1]).required, ['reply', 'ops']);
    assert.ok(seen.stdin.includes('요청: 문창재 11월부터 25%로') && seen.stdin.includes('- 문창재 — 참여연구원'), 'stdin 에 계획 요약과 요청');
  } finally { cp.spawn = realSpawn; }
});

(async () => {
  for (const [name, fn] of queue) {
    try { await fn(); n++; console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n   ', e.stack || e.message); process.exitCode = 1; }
  }
  console.log(`${n} passed, ${failed} failed`);
})();
