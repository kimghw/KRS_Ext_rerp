/* lib/prjdoc.js v2 (확장 Plus — 과제 폴더의 연차 파일 <n>차년도.json · 예상비용.json, 2026-10-18 저녁) 테스트: 파일·폴더 이름(약칭 → Job Id → 과제번호), 빈 문서·직렬화·해석(키 차례·모르는 칸 보존·v1·다른 판 거절),
 * 로컬 몫 떼기(fromLocalYear · fromLocalPlan — 연차 기간·예산 줄·연차 슬라이스), 병합(project — ERP 칸은 ERP 값·alias 는 aliasAt·jobId 는 시각 규칙 / budget 한 덩이 at·빈 쪽 못 이김·사업비 계획에 비침 / staff·research 연차 /
 * changes 합집합·500 제한 / want 로 끈 칸), 로컬에 되돌려 넣기(toLocalYear — 그 연차 키만 · toLocalPlan). 실행: node tests/prjdoc.test.js */
globalThis.self = globalThis;
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..');
for (const f of ['lib/format.js', 'lib/plan-sync.js', 'lib/research.js', 'lib/research-sync.js', 'lib/staff.js', 'lib/staff-sync.js', 'lib/prjdoc.js']) require(path.join(root, f));
const D = KRX_PRJDOC, S = KRX_STAFF;
let n = 0, failed = 0;
const test = async (name, fn) => { try { await fn(); n++; console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n   ', e.stack || e.message); process.exitCode = 1; } };

/* 자료 예 — 각 칸은 지금 저장소 모양 그대로 */
const item = (id, ts, extra) => Object.assign({ id, name: `항목 ${id}`, qty: 1, unit: 1000, amt: 1000, ts }, extra || {});
const rec = (prjNo, nn, rev, at, extra) => Object.assign({ id: `mw급과제#${nn}`, name: 'MW급 과제', code: 'RS-1', n: nn, rev, tag: '', file: 'KR_x.yaml', at, agree: '', period: '', role: '공동', lead: '김거화', note: '',
  goals: [`${nn}차 목표`], contents: [], perf: [], outputs: [], schedule: null, spend: [], budget: [], roster: [], prjNo, prjNm: prjNo ? '과제1' : '', linkBy: prjNo ? 'auto' : '' }, extra || {});
const person = (name, amts, monthly) => S.normalizePerson({ id: name, name, role: '연구원', manual: monthly, plan: amts.map((amt, i) => ({ ym: `2026-${String(i + 4).padStart(2, '0')}`, amt })) });
const BUDGET = [{ name: '인건비', plan: 31425000 }, { name: '연구활동비', plan: 5000000 }];
const splan = (prjNo, year, at, people, extra) => Object.assign({ prjNo, year, prjNm: '과제1', from: year === 1 ? '2026-04' : '2027-01', to: year === 1 ? '2026-12' : '2027-12', budgetPay: 31425000, budget: BUDGET, basis: 'rerp', src: 'erp', people, at, by: '김거화', note: '' }, extra || {});
const change = (id, date, kind, item, before, after, extra) => Object.assign({ id, date, kind, item, before, after, reason: '', by: '나', at: Number(id.replace(/\D/g, '')) || 0, auto: false }, extra || {});
const localOf = () => ({
  plan: { plans: { P1: { '10|연구활동비': [item('a', 5), item('b', 6, { sub: { date: '2026-09-02' }, by: '홍' })], '10|장비비': [item('c', 7)] }, P2: { K: [item('z', 1)] } },
    del: { d: { ts: 9, prj: 'P1' }, e: { ts: 9, prj: 'P2' }, f: 8 } },   // f = 이전 형식(과제 없음) — 모든 과제 몫
  research: { 'mw급과제#1': rec('P1', 1, 'r2', 3), 'mw급과제#2': rec('P1', 2, 'r1', 4), '다른#1': rec('P2', 1, 'r0', 1, { id: '다른#1', name: '다른' }), '안이음#1': rec('', 1, 'r0', 1, { id: '안이음#1', name: '안이음' }) },
  staff: { plans: { 'P1@1': splan('P1', 1, 1000, [person('문창재', [1165000, 1165000], 5823000)]), 'P1@2': splan('P1', 2, 2000, [person('홍길동', [1000000], 5000000)]), 'P2@1': splan('P2', 1, 1000, [person('x', [1])]), P1: { prjNo: 'P1' } }, del: { 'P1@3': 30, 'P2@2': 20 } },
  aliases: { P1: 'SSCB', P2: 'X' }, aliasesAt: { P1: 10 },
  changes: { 'P1@1': [change('c10', '2026-10-01', '예산', '연구활동비', '5,000천원', '6,000천원'), change('c20', '2026-10-05', '연구진', '참여연구원', '', '홍길동')], 'P1@2': [change('c30', '2026-10-06', '연구기간', '기간', '', '')], 'P2@1': [change('c40', '2026-10-07', '기타', 'x', '', '')] },
  // projects: ERP 칸(prjNm·rspr·anl)과 ERP 현재 연차 기간(stDt/endDt — yearSpan 용, 문서로는 안 감) + 받아 둔 WORKSPACE 몫(start/end = 과제 전체 연구기간, jobId …; at 없으면 0 = 아직 못 받음)
  projects: { P1: { prjNm: '과제1', rspr: '김거화', anl: 1, stDt: '20260401', endDt: '20261231', start: '2026-04-01', end: '2026-12-31' }, P2: { prjNm: '과제2', rspr: '', anl: 1, stDt: '20260101', endDt: '20261231', start: '20260101', end: '20261231' } },
});
const META = { prjNm: '과제1', rspr: '김거화', stDt: '20260401', endDt: '20261231', who: '나' };   // prjdoc-sync 의 metaOf 가 주는 것 — 과제 전체 기간(start/end)은 없다(WORKSPACE 몫)

(async () => {
await test('파일 이름(yearName · isYearName · planName) · 폴더 이름(약칭 → Job Id → 과제번호, 못 쓰는 글자 걷고 60자)', () => {
  assert.strictEqual(D.yearName(1), '1차년도.json'); assert.strictEqual(D.yearName('3'), '3차년도.json');
  assert.strictEqual(D.isYearName('2차년도.json'), 2); assert.strictEqual(D.isYearName(' 12차년도.JSON '), 12);
  assert.deepStrictEqual([D.isYearName('예상비용.json'), D.isYearName('P1.json'), D.isYearName('차년도.json'), D.isYearName('')], [0, 0, 0, 0]);
  assert.strictEqual(D.planName(), '예상비용.json'); assert.strictEqual(D.PLAN_NAME, '예상비용.json');
  assert.ok(D.isPlanName('예상비용.json') && !D.isPlanName('1차년도.json'));
  assert.strictEqual(D.folderNameFor({ alias: 'SSCB', jobId: 'RND00202026', prjNo: '2026-0063-01' }), 'SSCB');
  assert.strictEqual(D.folderNameFor({ alias: '', jobId: 'RND00202026', prjNo: '2026-0063-01' }), 'RND00202026');
  assert.strictEqual(D.folderNameFor({ prjNo: '2026-0063-01' }), '2026-0063-01');
  assert.strictEqual(D.folderNameFor({ alias: ' MW급/과제: "A"? *.. ' }), 'MW급과제 A');
  assert.strictEqual(D.folderNameFor({ alias: 'x'.repeat(80) }).length, 60);
  assert.strictEqual(D.folderNameFor({ alias: '///' }), '과제');
});

await test('emptyYear · serialize 키 차례 고정 · parse 왕복 · 모르는 칸 보존(최상위·project·changes) · v1·JSON 아님·종류 모름은 null', () => {
  const e = D.emptyYear({ prjNo: 'P1', prjNm: '과제1', rspr: '김거화', who: '나', yearStart: '2026-04', yearEnd: '2026-12' }, 1);
  assert.deepStrictEqual(e, { v: 2, kind: 'year', project: { prjNo: 'P1', prjNm: '과제1', rspr: '김거화', alias: '', aliasAt: 0, jobId: '', io: '', start: '', end: '', note: '' }, year: { n: 1, start: '2026-04', end: '2026-12' },
    budget: [], staff: { plans: [], del: {} }, research: [], changes: [], updatedAt: '', updatedBy: '나' });
  const text = D.serialize(Object.assign({ workspace: { x: 1 }, zeta: 'z' }, e, {
    project: Object.assign({}, e.project, { jobId: 'RND1', extra: '보존' }), research: [rec('', 1, 'r2', 3)], budget: [{ name: '인건비', plan: '31,425,000', at: 5, by: '나' }, { name: '', plan: null }, 3],
    staff: { plans: [splan('P1', 1, 1000, [person('문창재', [1165000], 5823000)]), splan('P1', 2, 1, [])], del: { 'P1@1': 5, 'P1@2': 6, 'P2@1': 7 } },
    changes: [change('c2', '2026-10-02', '예산', 'a', '1', '2', { key: 'yaml' }), change('c1', '2026-10-01', '엉뚱', 'b', '1', '2'), { id: 'c3', date: '2026-10-03', kind: '기타' }, { date: '2026-10-04', item: 'id 없음' }] }));
  assert.ok(text.endsWith('\n') && text.includes('\n  "project": {\n'), '2칸 들여쓰기');
  assert.deepStrictEqual(Object.keys(JSON.parse(text)), ['v', 'kind', 'project', 'year', 'budget', 'staff', 'research', 'changes', 'updatedAt', 'updatedBy', 'workspace', 'zeta'], '정해진 차례 뒤에 모르는 칸');
  const back = D.parse(text);
  assert.strictEqual(back.kind, 'year');
  const d = back.doc;
  assert.deepStrictEqual([d.workspace, d.zeta, d.project.jobId, d.project.extra], [{ x: 1 }, 'z', 'RND1', '보존']);
  assert.deepStrictEqual(Object.keys(d.project), ['prjNo', 'prjNm', 'rspr', 'alias', 'aliasAt', 'jobId', 'io', 'start', 'end', 'note', 'extra']);
  assert.deepStrictEqual(d.budget, [{ name: '인건비', plan: 31425000, at: 5, by: '나' }], '이름도 금액도 없는 줄·객체 아닌 것은 뺀다');
  assert.deepStrictEqual([d.staff.plans.map((p) => p.year), d.staff.del], [[1], { 'P1@1': 5 }], '연차 파일에는 그 연차 계획·묘비만');
  assert.deepStrictEqual(d.research.map((r) => r.id), ['mw급과제#1']);
  assert.deepStrictEqual(d.changes.map((c) => [c.id, c.kind, c.key]), [['c1', '기타', undefined], ['c2', '예산', 'yaml']], '날짜 차례 · 모르는 kind 는 기타 · 내용 없는 줄·id 없는 줄은 뺌 · key 보존');
  // 연구내용의 n 이 연차와 다르면 그 파일에 넣지 않는다
  assert.deepStrictEqual(D.parse(D.serialize(Object.assign({}, e, { research: [rec('', 2, 'r0', 1)] }))).doc.research, []);
  // 종류
  assert.strictEqual(D.parse(JSON.stringify({ v: 2, year: { n: 1 } })).kind, 'year'); assert.strictEqual(D.parse(JSON.stringify({ v: 2, plan: { items: [] } })).kind, 'plan');
  assert.strictEqual(D.parse(JSON.stringify({ v: 2, project: {} })), null, '종류를 모르면 null');
  assert.strictEqual(D.parse(JSON.stringify({ v: 1, prjNo: 'P1', plan: { items: {} } })), null, 'v1 파일은 읽지 않는다');
  assert.strictEqual(D.parse(JSON.stringify({ v: 3, kind: 'year' })), null, '다른 판');
  assert.strictEqual(D.parse('[1,2]'), null); assert.strictEqual(D.parse('not json'), null); assert.strictEqual(D.parse(''), null);
  // 파일 이름의 연차 힌트 — year.n 이 없을 때만
  assert.strictEqual(D.parse('{"v":2,"kind":"year"}', { year: 3 }).doc.year.n, 3);
  assert.strictEqual(D.parse('{"v":2,"kind":"year","year":{"n":"2"}}', { year: 3 }).doc.year.n, 2);
  // 예상 비용 문서
  const p = D.emptyPlan({ prjNo: 'P1', prjNm: '과제1', who: '나' });
  assert.deepStrictEqual(p, { v: 2, kind: 'plan', project: { prjNo: 'P1', prjNm: '과제1' }, plan: { items: [], del: {} }, updatedAt: '', updatedBy: '나' });
  const pt = D.serialize(Object.assign({ ws: 1 }, p, { project: { prjNo: 'P1', prjNm: '과제1', alias: '보존' }, plan: { items: [{ id: 'a', key: 'K', name: 'x', qty: 1, unit: 5, amt: 5, ts: 1 }, { key: 'K' }], del: { q: 7 } } }));
  assert.deepStrictEqual(Object.keys(JSON.parse(pt)), ['v', 'kind', 'project', 'plan', 'updatedAt', 'updatedBy', 'ws']);
  const pb = D.parse(pt);
  assert.deepStrictEqual([pb.kind, pb.doc.project, pb.doc.plan.items.map((e) => [e.id, e.prj, e.key]), pb.doc.plan.del, pb.doc.ws], ['plan', { prjNo: 'P1', prjNm: '과제1', alias: '보존' }, [['a', 'P1', 'K']], { q: 7 }, 1], 'prj 가 비면 과제번호로');
});

await test('fromLocalYear: 과제·연차 몫만 — project(ERP meta·별칭·받아 둔 jobId·start/end) · 연차 기간(계획 from/to, 없으면 yearSpan — ERP 현재 연차 기간 stDt/endDt 에서; meta.start/end 는 쓰지 않음) · 예산 줄(계획의 at·by) · 그 연차 계획·묘비 · 그 차년도 기록 · 변경이력', () => {
  const local = localOf();
  local.projects.P1.jobId = 'RND1'; local.projects.P1.at = 77;
  const L = D.fromLocalYear('P1', 1, local, META);
  assert.deepStrictEqual(L.project, { prjNo: 'P1', prjNm: '과제1', rspr: '김거화', alias: 'SSCB', aliasAt: 10, jobId: 'RND1', io: '', start: '2026-04-01', end: '2026-12-31', note: '' });
  assert.deepStrictEqual(D.fromLocalYear('P1', 1, local, Object.assign({}, META, { start: '2000-01-01', end: '2000-12-31' })).project.start, '2026-04-01', 'meta.start/end(옛 ERP 연차 기간 자리)는 받지 않는다 — 받아 둔 WORKSPACE 값만');
  assert.ok(!('stDt' in L.project) && !('endDt' in L.project) && !('anl' in L.project), 'ERP 연차 기간·연차는 문서 project 로 가지 않는다');
  assert.deepStrictEqual(L.year, { n: 1, start: '2026-04', end: '2026-12' });
  assert.deepStrictEqual(L.budget, [{ name: '인건비', plan: 31425000, at: 1000, by: '김거화' }, { name: '연구활동비', plan: 5000000, at: 1000, by: '김거화' }]);
  assert.deepStrictEqual([L.staff.plans.map((p) => `${p.prjNo}@${p.year}`), L.staff.del], [['P1@1'], {}], '그 연차 계획·묘비만(옛 키 P1 은 뺀다)');
  const l1 = localOf(); l1.staff.del['P1@1'] = 5;
  assert.deepStrictEqual(D.fromLocalYear('P1', 1, l1, META).staff.del, { 'P1@1': 5 }, '이 연차 묘비는 싣고 다른 연차(P1@3)·과제(P2@2) 묘비는 뺀다');
  assert.deepStrictEqual(L.research.map((r) => [r.id, r.prjNo]), [['mw급과제#1', 'P1']], '연결 칸은 그대로');
  assert.deepStrictEqual(L.changes.map((c) => c.id), ['c10', 'c20']);
  assert.strictEqual(L.updatedBy, '나');
  assert.strictEqual(D.localProjectAt(local, 'P1'), 77);
  const L2 = D.fromLocalYear('P1', 2, local, META);
  assert.deepStrictEqual([L2.year, L2.staff.plans.map((p) => p.year), L2.research.map((r) => r.id), L2.changes.map((c) => c.id), L2.staff.del], [{ n: 2, start: '2027-01', end: '2027-12' }, [2], ['mw급과제#2'], ['c30'], {}]);
  // 계획이 없는 연차 — 기간은 ERP 현재 연차(stDt/endDt)에서 12달씩(yearSpan), 예산 줄 없음. 연차 기간을 모르면(stDt 없음) 빈 값 — 과제 전체 기간(start/end)으로 셈하지 않는다(36달짜리 연차가 된다)
  const L3 = D.fromLocalYear('P1', 3, local, META);
  assert.deepStrictEqual([L3.year, L3.budget, L3.staff, L3.research, L3.changes], [{ n: 3, start: '2028-01', end: '2028-12' }, [], { plans: [], del: { 'P1@3': 30 } }, [], []]);
  const l3n = localOf(); delete l3n.projects.P1.stDt; delete l3n.projects.P1.endDt;
  assert.deepStrictEqual(D.fromLocalYear('P1', 3, l3n, { prjNm: '과제1' }).year, { n: 3, start: '', end: '' });
  // meta 가 없으면 local.projects 의 ERP 칸
  const L4 = D.fromLocalYear('P2', 1, local, {});
  assert.deepStrictEqual([L4.project.prjNm, L4.project.start, L4.project.alias, L4.project.aliasAt, L4.year], ['과제2', '20260101', 'X', 0, { n: 1, start: '2026-04', end: '2026-12' }]);
  const L5 = D.fromLocalYear('P9', 1, {}, {});
  assert.deepStrictEqual([L5.project.prjNo, L5.year, L5.budget, L5.staff, L5.research, L5.changes], ['P9', { n: 1, start: '', end: '' }, [], { plans: [], del: {} }, [], []]);
  // 예상 비용 몫
  const P = D.fromLocalPlan('P1', local, META);
  assert.deepStrictEqual([P.project, P.plan.items.map((e) => [e.id, e.prj, e.key]).sort(), P.plan.del], [{ prjNo: 'P1', prjNm: '과제1' }, [['a', 'P1', '10|연구활동비'], ['b', 'P1', '10|연구활동비'], ['c', 'P1', '10|장비비']], { d: 9, f: 8 }], 'P2 묘비 e 는 빼고 과제 없는 f 는 넣는다');
  assert.deepStrictEqual(P.plan.items.find((e) => e.id === 'b').sub, { date: '2026-09-02' });
  // 대상 고르기
  assert.deepStrictEqual(D.localPrjNos(local).sort(), ['P1', 'P2']);
  assert.deepStrictEqual(D.localPrjNos({ aliases: { P7: 'a', P8: '' }, changes: { 'P6@1': [change('c1', '2026-10-01', '기타', 'x', '', '')], 'P5@1': [] }, research: { x: rec('', 1, 'r0', 1) } }).sort(), ['P6', 'P7']);
  assert.deepStrictEqual([D.localYears('P1', local), D.localYears('P2', local), D.localYears('P9', local)], [[1, 2], [1], []]);
  assert.deepStrictEqual(D.otherRecs('P2', local) && Object.keys(D.otherRecs('P2', local)).sort(), ['mw급과제#1', 'mw급과제#2']);
});

await test('mergeYear: 파일 없음 → 로컬로 문서를 만든다(remoteChanged, 로컬 안 바뀜, updatedAt/updatedBy) · 왕복하면 아무것도 안 바뀜', () => {
  const L = D.fromLocalYear('P1', 1, localOf(), META);
  const m = D.mergeYear(L, null, 100000, '나');
  assert.strictEqual(m.remoteChanged, true);
  assert.deepStrictEqual(m.localChanged, { budget: false, staff: false, research: false, changes: false, alias: false, project: false });
  assert.deepStrictEqual([m.year, m.doc.updatedAt, m.doc.updatedBy, m.doc.project.prjNm, m.doc.project.alias, m.doc.year], [1, '1970-01-01T00:01:40.000Z', '나', '과제1', 'SSCB', { n: 1, start: '2026-04', end: '2026-12' }]);
  assert.deepStrictEqual(m.doc.budget.map((r) => r.name), ['인건비', '연구활동비']);
  assert.ok(m.doc.research.every((r) => !('prjNo' in r) && !('linkBy' in r) && !('src' in r)), '문서의 기록에는 연결 칸이 없다');
  assert.deepStrictEqual([m.doc.staff.plans[0].people[0].name, m.doc.staff.del, m.doc.changes.map((c) => c.id)], ['문창재', {}, ['c10', 'c20']]);
  assert.deepStrictEqual(D.countOfYear(m.doc), { budget: 2, staff: 1, research: 1, changes: 2 });
  assert.deepStrictEqual(m.parts.project, Object.assign({}, m.doc.project, { at: 0 }));
  // 로컬 별칭에 시각이 없으면 지금으로(로컬에만 반영 — aliasAt 저장)
  const m2 = D.mergeYear(D.fromLocalYear('P2', 1, localOf(), {}), null, 500, '나');
  assert.deepStrictEqual([m2.doc.project.alias, m2.doc.project.aliasAt, m2.localChanged.alias], ['X', 500, true]);
  // 왕복
  const again = D.mergeYear(L, D.parse(D.serialize(m.doc)).doc, 200000, '나');
  assert.deepStrictEqual([again.remoteChanged, Object.values(again.localChanged).some(Boolean), again.doc.updatedAt, again.doc.updatedBy], [false, false, '1970-01-01T00:01:40.000Z', '나']);
  // 90일 지난 묘비는 병합 때 버려진다 — 그것만으로도 로컬이 바뀐 것으로 친다
  const l3 = localOf(); delete l3.staff.plans['P1@1']; l3.staff.del['P1@1'] = 5;
  const old = D.mergeYear(D.fromLocalYear('P1', 1, l3, META), null, 1700000000000, '나');
  assert.deepStrictEqual([old.localChanged.staff, old.doc.staff.del], [true, {}]);
  assert.deepStrictEqual(D.mergeYear(D.fromLocalYear('P1', 1, l3, META), null, 100, '나').doc.staff.del, { 'P1@1': 5 }, '90일 안이면 묘비가 파일에 실린다');
});

await test('mergeYear project: ERP 칸(prjNm·rspr)은 로컬(ERP) 값, 비면 파일 것 · alias 는 aliasAt 큰 쪽 · jobId·io·start·end·note·모르는 칸은 파일이 로컬이 받은 시각보다 뒤면 파일 것(빈 값이라도) 아니면 로컬 것 · parts.project.at — start/end(과제 전체 연구기간)는 WORKSPACE 몫(rERP 가 아는 날짜는 연차 기간)', () => {
  const local = localOf();
  local.projects.P1.jobId = 'RND-OLD'; local.projects.P1.at = 1000; local.projects.P1.rspr = '';
  const L = D.fromLocalYear('P1', 1, local, Object.assign({}, META, { prjNm: 'ERP 과제명', rspr: '' }));
  const R = Object.assign(D.emptyYear({ prjNo: 'P1', prjNm: '파일 과제명', rspr: '파일 책임자', alias: 'SSCB2', aliasAt: 20, jobId: 'RND-NEW', io: 'IO1', note: '메모', start: '2020-01-01', end: '2020-12-31' }, 1), { updatedAt: new Date(5000).toISOString(), updatedBy: 'WORKSPACE' });
  R.project.extra = { ws: true };
  const m = D.mergeYear(L, R, 100000, '나');
  assert.deepStrictEqual(m.doc.project, { prjNo: 'P1', prjNm: 'ERP 과제명', rspr: '파일 책임자', alias: 'SSCB2', aliasAt: 20, jobId: 'RND-NEW', io: 'IO1', start: '2020-01-01', end: '2020-12-31', note: '메모', extra: { ws: true } });
  assert.deepStrictEqual([m.localChanged.alias, m.localChanged.project, m.remoteChanged, m.parts.project.at], [true, true, true, 5000], 'ERP 과제명이 파일과 달라 파일도 바뀜 · 로컬은 jobId·io·start·end·note·extra 를 받음(파일 5000 > 로컬이 받은 시각 1000)');
  // 파일이 로컬이 받은 시각보다 앞이면 로컬의 WORKSPACE 칸이 이김(연차 파일 여럿에 퍼뜨리는 길)
  local.projects.P1.at = 9000;
  const at = () => ({ localAt: D.localProjectAt(local, 'P1') });   // prjdoc-sync 가 넘기는 값(로컬이 WORKSPACE 칸을 받은 시각)
  const m2 = D.mergeYear(D.fromLocalYear('P1', 1, local, META), R, 100000, '나', at());
  assert.deepStrictEqual([m2.doc.project.jobId, m2.doc.project.io, m2.doc.project.note, m2.doc.project.start, m2.doc.project.end, m2.localChanged.project, m2.remoteChanged, m2.parts.project.at], ['RND-OLD', '', '', '2026-04-01', '2026-12-31', true, true, 9000], '로컬이 받은 시각(9000)이 파일(5000)보다 뒤 — jobId·io·note·start·end 모두 로컬 값(빈 것도) · extra 는 로컬에 없어 파일 것(→ project 바뀜)');
  // 연차 기간이 바뀌어도(stDt/endDt — 다음 연차) project 는 그대로 — 매 연차 가짜 '연구기간' 변경이 나지 않는다
  const l2 = localOf(); l2.projects.P1.stDt = '20270401'; l2.projects.P1.endDt = '20280331'; l2.projects.P1.anl = 2; l2.projects.P1.at = 9000; l2.projects.P1.extra = { ws: true };
  const m2b = D.mergeYear(D.fromLocalYear('P1', 1, l2, { prjNm: 'ERP 과제명', rspr: '', stDt: '20270401', endDt: '20280331' }), Object.assign({}, R, { project: Object.assign({}, R.project, { start: '2026-04-01', end: '2026-12-31', jobId: 'RND-OLD', io: '', note: '' }) }), 100000, '나', { localAt: 9000 });
  assert.deepStrictEqual([m2b.doc.project.start, m2b.doc.project.end, m2b.localChanged.project], ['2026-04-01', '2026-12-31', false]);
  local.projects.P1.extra = { ws: true };
  assert.strictEqual(D.mergeYear(D.fromLocalYear('P1', 1, local, META), R, 100000, '나', at()).localChanged.project, false, '받아 둔 모르는 칸(extra)까지 같으면 로컬은 안 바뀜');
  delete local.projects.P1.extra;
  // 파일 쪽이 더 새로우면 빈 값으로 지우는 것도 받는다(되치기 방지)
  const R2 = Object.assign({}, R, { project: Object.assign({}, R.project, { jobId: '' }), updatedAt: new Date(20000).toISOString() });
  const m3 = D.mergeYear(D.fromLocalYear('P1', 1, local, META), R2, 100000, '나', at());
  assert.deepStrictEqual([m3.doc.project.jobId, m3.localChanged.project, m3.parts.project.at], ['', true, 20000]);
  // 로컬 시각이 없으면(0) 파일 것
  assert.strictEqual(D.mergeYear(D.fromLocalYear('P1', 1, local, META), R, 100000, '나').doc.project.jobId, 'RND-NEW');
  // 별칭: 같은 시각이면 파일 · 로컬이 더 새로우면 로컬 · 로컬 시각 없고 파일 별칭 있으면 파일 · 로컬 별칭이 다른데 시각이 없으면 지금
  const withAlias = (a, t) => { const l = localOf(); l.aliases.P1 = a; if (t) l.aliasesAt.P1 = t; else delete l.aliasesAt.P1; return D.fromLocalYear('P1', 1, l, META); };
  assert.deepStrictEqual([D.mergeYear(withAlias('A', 20), R, 1, '나').doc.project.alias, D.mergeYear(withAlias('A', 30), R, 1, '나').doc.project.alias, D.mergeYear(withAlias('', 0), R, 999, '나').doc.project.alias, D.mergeYear(withAlias('B', 0), R, 999, '나').doc.project.aliasAt], ['SSCB2', 'A', 'SSCB2', 999]);
  // want.alias 를 끄면 별칭은 파일 그대로(받지도 올리지도 않음)
  const off = D.mergeYear(withAlias('A', 99), R, 1, '나', { want: { alias: false } });
  assert.deepStrictEqual([off.doc.project.alias, off.doc.project.aliasAt, off.localChanged.alias], ['SSCB2', 20, false]);
});

await test('mergeYear budget: 내용이 다르면 at 큰 쪽(같으면 로컬) · 빈 쪽은 못 이김(로컬 budget null = 기본값) · 이긴 줄이 사업비 계획의 budget 에도 비침 · 같은 내용이면 at·by 만 맞춤', () => {
  const local = localOf();
  const L = D.fromLocalYear('P1', 1, local, META);   // 예산 줄 at 1000(계획의 at)
  const mk = (rows, planAt) => Object.assign(D.emptyYear({ prjNo: 'P1', prjNm: '과제1' }, 1), { budget: rows, staff: { plans: planAt ? [splan('P1', 1, planAt, [person('옛것', [1])])] : [], del: {} }, updatedAt: '2026-10-18T00:00:00.000Z', updatedBy: 'WORKSPACE' });
  // WORKSPACE 가 더 늦게 고친 예산 줄 → 받고, 내 계획(at 1000 > 파일 계획 500)은 남되 그 budget 은 파일 줄로 비침
  const m = D.mergeYear(L, mk([{ name: '인건비', plan: 40000000, at: 3000, by: 'WORKSPACE' }], 500), 100000, '나');
  assert.deepStrictEqual([m.doc.budget, m.localChanged.budget, m.localChanged.staff, m.remoteChanged], [[{ name: '인건비', plan: 40000000, at: 3000, by: 'WORKSPACE' }], true, true, true]);
  assert.deepStrictEqual([m.doc.staff.plans[0].people[0].name, m.doc.staff.plans[0].budget, m.doc.staff.plans[0].at], ['문창재', [{ name: '인건비', plan: 40000000 }], 1000], '내 계획이 이기되 budget 은 이긴 줄');
  assert.deepStrictEqual(m.parts.budget, { year: 1, rows: m.doc.budget, at: 3000, by: 'WORKSPACE' });
  // 파일 예산 줄이 이기면 계획의 budgetPay(참여인력 카드의 인건비 예산)도 따라온다 — 로컬 계획은 31,425,000 이었다
  assert.deepStrictEqual([m.doc.staff.plans[0].budgetPay, m.parts.staff.plans[0].budgetPay], [40000000, 40000000], '비친 줄에 맞춰 budgetPay 도(KRX_STAFF.budgetPayOf)');
  const noPay = D.mergeYear(L, mk([{ name: '연구활동비', plan: 9, at: 3000, by: 'WS' }]), 100000, '나');
  assert.deepStrictEqual([noPay.doc.staff.plans[0].budget, noPay.doc.staff.plans[0].budgetPay], [[{ name: '연구활동비', plan: 9 }], null], '인건비 줄이 없으면 null(lib/staff-ui.js syncPay 와 같음)');
  // 내 줄이 더 새로우면(계획 at 1000 > 파일 줄 at 300) 내 것 → 파일 바뀜, 로컬 안 바뀜
  const m2 = D.mergeYear(L, mk([{ name: '인건비', plan: 40000000, at: 300, by: 'WORKSPACE' }]), 100000, '나');
  assert.deepStrictEqual([m2.doc.budget.map((r) => [r.name, r.plan, r.at]), m2.localChanged.budget, m2.remoteChanged], [[['인건비', 31425000, 1000], ['연구활동비', 5000000, 1000]], false, true]);
  // 같은 at 이면 로컬
  const m3 = D.mergeYear(L, mk([{ name: '인건비', plan: 1, at: 1000, by: 'WORKSPACE' }]), 100000, '나');
  assert.deepStrictEqual([m3.doc.budget[0].plan, m3.localChanged.budget], [31425000, false]);
  // 로컬 budget 이 null(기본값) 이면 파일 줄을 받는다 — 계획 at 가 커도
  local.staff.plans['P1@1'].budget = null;
  const m4 = D.mergeYear(D.fromLocalYear('P1', 1, local, META), mk([{ name: '인건비', plan: 7, at: 1, by: 'WS' }]), 100000, '나');
  assert.deepStrictEqual([m4.doc.budget, m4.localChanged.budget, m4.doc.staff.plans[0].budget, m4.doc.staff.plans[0].budgetPay], [[{ name: '인건비', plan: 7, at: 1, by: 'WS' }], true, [{ name: '인건비', plan: 7 }], 7]);
  // 파일 줄이 비면 로컬 것(지우기는 전파하지 않음)
  const m5 = D.mergeYear(L, mk([]), 100000, '나');
  assert.deepStrictEqual([m5.doc.budget.length, m5.localChanged.budget, m5.remoteChanged], [2, false, true]);
  // 같은 내용 · 파일 at 가 더 크면 at·by 만 파일 것으로(로컬 변경 아님, 예산 줄로는 파일도 그대로) · 내 at 가 더 크면 내 at·by 로 파일만 맞춤
  const rows5000 = BUDGET.map((r) => Object.assign({}, r, { at: 5000, by: 'WS' }));
  assert.deepStrictEqual(D.mergeBudget(L.budget, rows5000, true), { rows: rows5000, localChanged: false, remoteChanged: false });
  assert.deepStrictEqual(D.mergeBudget(L.budget, BUDGET.map((r) => Object.assign({}, r, { at: 1, by: 'WS' })), true), { rows: L.budget, localChanged: false, remoteChanged: true });
  const m6 = D.mergeYear(L, mk(rows5000), 100000, '나');
  assert.deepStrictEqual([m6.doc.budget[0].at, m6.doc.budget[0].by, m6.localChanged.budget], [5000, 'WS', false]);
  // 끄면 파일 그대로
  const m7 = D.mergeYear(L, mk([{ name: '인건비', plan: 1, at: 1, by: 'WS' }]), 100000, '나', { want: { budget: false } });
  assert.deepStrictEqual([m7.doc.budget[0].plan, m7.localChanged.budget, m7.parts.budget, m7.doc.staff.plans[0].budget], [1, false, null, BUDGET], '비치지도 않음');
});

await test('mergeYear changes: id 합집합(둘 다 있으면 파일 것) · (date, at, id) 차례 · 500 개 상한(오래된 것부터 버림) · 로컬·파일 바뀜 판정 · 끄면 파일 그대로', () => {
  const L = D.fromLocalYear('P1', 1, localOf(), META);   // c10(10-01) · c20(10-05)
  const R = Object.assign(D.emptyYear({ prjNo: 'P1', prjNm: '과제1' }, 1), { changes: [change('c15', '2026-10-03', '예산', 'ws', '1', '2', { by: '', at: 0, auto: true, key: 'yaml' }), change('c20', '2026-10-05', '연구진', '참여연구원', '', '홍길동(파일)')], updatedAt: '2026-10-18T00:00:00.000Z', updatedBy: 'WS' });
  const m = D.mergeYear(L, R, 100000, '나');
  assert.deepStrictEqual(m.doc.changes.map((c) => [c.id, c.after]), [['c10', '6,000천원'], ['c15', '2'], ['c20', '홍길동(파일)']], '파일 것이 같은 id 를 덮음');
  assert.deepStrictEqual([m.localChanged.changes, m.remoteChanged, m.doc.changes[1].key, m.doc.changes[1].auto], [true, true, 'yaml', true]);
  assert.deepStrictEqual(m.parts.changes, m.doc.changes);
  // 둘이 같으면 안 바뀜
  const same = D.mergeYear(L, Object.assign({}, R, { changes: L.changes }), 100000, '나');
  assert.deepStrictEqual([same.localChanged.changes, same.remoteChanged], [false, true], '변경이력은 같고(파일에 budget 등이 없어 파일은 바뀜)');
  // 500 개 상한
  const many = []; for (let i = 0; i < 520; i++) many.push(change(`m${String(i).padStart(4, '0')}`, `2026-01-${String(1 + (i % 28)).padStart(2, '0')}`, '기타', `x${i}`, '', '', { at: i }));
  const big = D.mergeYear(L, Object.assign({}, R, { changes: many }), 100000, '나');
  assert.strictEqual(big.doc.changes.length, 500);
  assert.ok(big.doc.changes.some((c) => c.id === 'c20') && big.doc.changes.some((c) => c.id === 'c10'), '내 10월 줄은 남는다');
  assert.ok(!big.doc.changes.some((c) => c.id === 'm0000'), '1월 1일의 가장 오래된 것부터 버림');
  assert.strictEqual(big.remoteChanged, true);
  // 끄면
  const off = D.mergeYear(L, R, 100000, '나', { want: { changes: false } });
  assert.deepStrictEqual([off.doc.changes.map((c) => c.id), off.localChanged.changes, off.parts.changes], [['c15', 'c20'], false, null]);
});

await test('mergeYear staff·research·연차 기간: 연차별 at · 묘비 · 판 → 넣은 시각 · year.start/end 는 계획의 from/to · 끈 칸은 파일 그대로 · 모르는 최상위 칸 보존', () => {
  const local = localOf();
  const L = D.fromLocalYear('P1', 1, local, META);
  const R = Object.assign(D.emptyYear({ prjNo: 'P1', prjNm: '과제1' }, 1), {
    year: { n: 1, start: '2026-01', end: '2026-12' }, workspace: { note: '보존' },
    staff: { plans: [splan('P1', 1, 3000, [person('새사람', [1000000], 5000000)], { from: '2026-05', to: '2026-12' })], del: {} },
    research: [D.cleanRec(rec('P1', 1, 'r3', 2, { goals: ['새 판'] })), D.cleanRec(rec('P1', 2, 'r0', 1))],   // 2차 기록은 1차 파일에 들어가지 않음(normalize 가 뺌)
    updatedAt: '2026-10-18T01:00:00.000Z', updatedBy: '동료' });
  const m = D.mergeYear(L, R, 100000, '나');
  assert.deepStrictEqual([m.doc.staff.plans[0].people[0].name, m.doc.staff.plans[0].at, m.localChanged.staff], ['새사람', 3000, true], '파일 계획(3000)이 내 것(1000)보다 새로움');
  assert.deepStrictEqual(m.doc.year, { n: 1, start: '2026-05', end: '2026-12' }, '연차 기간은 이긴 계획의 from/to');
  assert.deepStrictEqual([m.doc.research.map((r) => [r.n, r.rev]), m.parts.research.fromRemote, m.localChanged.research], [[[1, 'r3']], { 'mw급과제#1': true }, true]);
  assert.deepStrictEqual([m.doc.workspace, m.doc.budget.map((r) => r.plan)], [{ note: '보존' }, [31425000, 5000000]], '모르는 칸 보존 · 파일에 예산 줄이 없어 내 것(파일 계획의 budget 에도 비침)');
  assert.deepStrictEqual(m.doc.staff.plans[0].budget, [{ name: '인건비', plan: 31425000 }, { name: '연구활동비', plan: 5000000 }]);
  // 묘비가 계획보다 새로우면 지움
  const gone = D.mergeYear(L, Object.assign({}, R, { staff: { plans: [], del: { 'P1@1': 5000 } } }), 100000, '나');
  assert.deepStrictEqual([gone.doc.staff.plans, gone.doc.staff.del, gone.localChanged.staff, gone.doc.year], [[], { 'P1@1': 5000 }, true, { n: 1, start: '2026-01', end: '2026-12' }], '계획이 없으면 연차 기간은 파일 것');
  // 끈 칸
  const off = D.mergeYear(L, R, 100000, '나', { want: { staff: false, research: false } });
  assert.deepStrictEqual([off.doc.staff.plans[0].people[0].name, off.doc.research.map((r) => r.rev), off.localChanged.staff, off.localChanged.research, off.parts.staff, off.parts.research], ['새사람', ['r3'], false, false, null, null]);
  // 파일이 없을 때 끈 칸은 빈 값(내 자료를 올리지 않음)
  const off2 = D.mergeYear(L, null, 100000, '나', { want: { staff: false, budget: false, changes: false } });
  assert.deepStrictEqual([off2.doc.staff, off2.doc.budget, off2.doc.changes, off2.doc.research.length], [{ plans: [], del: {} }, [], [], 1]);
  // 같은 연구내용 기록이 두 과제 파일에(others) — 파일에만 있어도 "받았다" 고 하지 않는다
  const l2 = localOf(); l2.research['mw급과제#1'].linkBy = 'user';
  const L2 = D.fromLocalYear('P2', 1, l2, { prjNm: '과제2' });
  const R2 = Object.assign(D.emptyYear({ prjNo: 'P2', prjNm: '과제2' }, 1), { research: [D.cleanRec(rec('P2', 1, 'r2', 3)), D.cleanRec(rec('P2', 1, 'r0', 1, { id: '다른#1', name: '다른' }))], updatedAt: '2026-10-18T00:00:00.000Z', updatedBy: '동료' });
  const o = D.mergeYear(L2, R2, 100000, '나', { others: D.otherRecs('P2', l2) });
  assert.deepStrictEqual([o.localChanged.research, o.parts.research.fromRemote, o.doc.research.map((r) => r.id).sort()], [false, {}, ['mw급과제#1', '다른#1']]);
});

await test('toLocalYear: 그 과제·연차 몫만 갈아 넣고 다른 연차·과제는 그대로 — staff 키 · budget(plans 의 그 연차 계획에 비침) · 받은 기록은 과제에 잇고(user 유지·src) · changes 키 · 별칭 · project(WORKSPACE 몫·at)', () => {
  const local = localOf();
  local.research['mw급과제#1'].linkBy = 'user';
  local.staff.del['P1@1'] = 5;   // 내 묘비(5) — 파일 계획(5000)이 새로워 폐기된다
  const L = D.fromLocalYear('P1', 1, local, META);
  const R = Object.assign(D.emptyYear({ prjNo: 'P1', prjNm: '과제1', alias: 'SSCB2', aliasAt: 20, jobId: 'RND1', io: 'IO1' }, 1), {
    budget: [{ name: '인건비', plan: 40000000, at: 3000, by: 'WS' }],
    staff: { plans: [splan('P1', 1, 5000, [person('새사람', [1000000], 5000000)])], del: {} },
    research: [D.cleanRec(rec('P1', 1, 'r3', 2)), D.cleanRec(rec('P1', 1, 'r0', 1, { id: '새것#1', name: '새것' }))],
    changes: [change('c15', '2026-10-03', '예산', 'ws', '1', '2')], updatedAt: new Date(7000).toISOString(), updatedBy: 'WS' });
  const m = D.mergeYear(L, R, 100000, '나');
  assert.deepStrictEqual(m.localChanged, { budget: true, staff: true, research: true, changes: true, alias: true, project: true });
  const back = D.toLocalYear('P1', 1, local, m, { src: 'SSCB/1차년도.json' });
  // 사업비: P1@1 만 바뀜, P1@2 · P2@1 · 옛 키 P1 그대로(옛 키는 연차가 없어 이 연차 몫이 아님)
  assert.deepStrictEqual(Object.keys(back.staff.plans).sort(), ['P1', 'P1@1', 'P1@2', 'P2@1']);
  assert.deepStrictEqual([back.staff.plans['P1@1'].people[0].name, back.staff.plans['P1@1'].budget, back.staff.plans['P1@2'], back.staff.del], ['새사람', [{ name: '인건비', plan: 40000000 }], local.staff.plans['P1@2'], { 'P1@3': 30, 'P2@2': 20 }], '내 묘비 P1@1(5) 은 계획(5000)이 새로워 폐기');
  // 예산 줄 — 그 연차 줄만(계획 쪽은 staff 가 비춘 budget 으로 간다)
  assert.deepStrictEqual(back.budget, { year: 1, budget: [{ name: '인건비', plan: 40000000, at: 3000, by: 'WS' }], at: 3000, by: 'WS' });
  // 연구내용: 1차는 user 연결 유지·src · 새것은 auto 로 잇고 · 2차·다른 과제 기록 그대로
  assert.deepStrictEqual(Object.keys(back.research.map).sort(), ['mw급과제#1', 'mw급과제#2', '다른#1', '새것#1', '안이음#1']);
  assert.deepStrictEqual([back.research.map['mw급과제#1'].rev, back.research.map['mw급과제#1'].linkBy, back.research.map['mw급과제#1'].src, back.research.map['새것#1'].linkBy, back.research.map['새것#1'].prjNm, back.research.map['새것#1'].src], ['r3', 'user', 'SSCB/1차년도.json', 'auto', '과제1', 'SSCB/1차년도.json']);
  assert.strictEqual(back.research.map['mw급과제#2'], local.research['mw급과제#2']);
  assert.deepStrictEqual([back.research.ids, back.research.year, back.research.yearRecs.map((r) => r.id)], [['mw급과제#1', '새것#1', 'mw급과제#2'], 1, ['mw급과제#1', '새것#1']], 'recs 는 이 과제 기록 전부(차년도 차례) · yearRecs 는 이 연차 것');
  // 변경이력
  assert.deepStrictEqual([back.changes.key, back.changes.year, back.changes.list.map((c) => c.id), back.changes.all['P1@1'].length, back.changes.all['P1@2'].map((c) => c.id), back.changes.all['P2@1'].length], ['P1@1', 1, ['c10', 'c15', 'c20'], 3, ['c30'], 1]);
  // 별칭
  assert.deepStrictEqual(back.alias, { alias: 'SSCB2', aliasAt: 20, aliases: { P1: 'SSCB2', P2: 'X' }, aliasesAt: { P1: 20 } });
  // project: WORKSPACE 몫(jobId·io·start·end·note)과 받은 시각만(ERP 칸·별칭은 넣지 않음 — 배선이 그대로 shareProjects[prj] 에 겹친다). 파일(7000)이 로컬이 받은 시각(0)보다 뒤라 빈 start/end 도 받는다
  assert.deepStrictEqual(back.project, { jobId: 'RND1', io: 'IO1', start: '', end: '', note: '', at: 7000 });
  assert.deepStrictEqual(back.research.others, {}, '이 과제 기록만 받았으면 others 는 비어 있다');
  // 다른 과제(P2)에 이어 둔 기록이 이 파일에서 새 글을 받으면 — 연결은 그대로, 글만 새것, research.others 로 따로(배선이 그 과제 몫(recs)과 함께 저장해야 매 동기화마다 다시 "받은 것" 이 되지 않는다)
  const l3 = localOf();
  const R3 = Object.assign(D.emptyYear({ prjNo: 'P1', prjNm: '과제1' }, 1), { research: [D.cleanRec(rec('P1', 1, 'r2', 5, { id: '다른#1', name: '다른', goals: ['새 글'] }))], updatedAt: new Date(8000).toISOString(), updatedBy: 'WS' });
  const m3 = D.mergeYear(D.fromLocalYear('P1', 1, l3, META), R3, 100000, '나', { others: D.otherRecs('P1', l3) });
  const b3 = D.toLocalYear('P1', 1, l3, m3, { src: 'SSCB/1차년도.json' });
  assert.deepStrictEqual([m3.localChanged.research, Object.keys(b3.research.others), b3.research.others['다른#1'].prjNo, b3.research.others['다른#1'].rev, b3.research.others['다른#1'].goals, b3.research.others['다른#1'].src, b3.research.map['다른#1'].rev, b3.research.ids.includes('다른#1')],
    [true, ['다른#1'], 'P2', 'r2', ['새 글'], undefined, 'r2', false], 'P2 연결 그대로(src 도 안 바꿈) · 글은 r2 · 이 과제 recs 에는 없음');
  // 끈 칸(parts null)은 로컬 그대로
  const off = D.toLocalYear('P1', 1, local, D.mergeYear(L, R, 100000, '나', { want: { budget: false, staff: false, research: false, changes: false } }));
  assert.deepStrictEqual([off.staff.plans, off.staff.del, off.budget, off.research.ids, off.changes.list.map((c) => c.id), off.changes.all], [local.staff.plans, { 'P1@3': 30, 'P2@2': 20, 'P1@1': 5 }, null, ['mw급과제#1', 'mw급과제#2'], ['c10', 'c20'], local.changes]);
  // 별칭을 지운 쪽이 새로우면 로컬에서도 지운다
  const gone = D.toLocalYear('P1', 1, local, D.mergeYear(L, Object.assign({}, R, { project: Object.assign({}, R.project, { alias: '', aliasAt: 99 }) }), 1, '나'));
  assert.deepStrictEqual(gone.alias, { alias: '', aliasAt: 99, aliases: { P2: 'X' }, aliasesAt: { P1: 99 } });
});

await test('mergePlan · toLocalPlan: KRX_PLAN_SYNC.merge 그대로(id 별 ts·묘비) · 과제명은 ERP 값 · 모르는 칸 보존 · 끄면 파일 그대로 · 로컬 전체 구조에 되돌려 넣기(묘비 { ts, prj })', () => {
  const local = localOf();
  const L = D.fromLocalPlan('P1', local, META);
  const m0 = D.mergePlan(L, null, 100000, '나');
  assert.deepStrictEqual([m0.remoteChanged, m0.localChanged, m0.doc.project, m0.doc.plan.items.map((e) => e.id).sort(), m0.doc.plan.del, m0.doc.updatedAt], [true, { plan: false }, { prjNo: 'P1', prjNm: '과제1' }, ['a', 'b', 'c'], { d: 9, f: 8 }, '1970-01-01T00:01:40.000Z']);
  assert.deepStrictEqual(D.countOfPlan(m0.doc), { plan: 3 });
  const again = D.mergePlan(L, D.parse(D.serialize(m0.doc)).doc, 200000, '나');
  assert.deepStrictEqual([again.remoteChanged, again.localChanged.plan], [false, false]);
  const R = { v: 2, kind: 'plan', project: { prjNo: 'P1', prjNm: '파일 과제명', ws: 1 }, extra: true, plan: { items: [item('a', 5, { prj: 'P1', key: '10|연구활동비' }), item('g', 50, { key: '10|연구활동비', by: '동료' })], del: { b: 60, c: 1 } }, updatedAt: '2026-10-18T00:00:00.000Z', updatedBy: '동료' };
  const m = D.mergePlan(L, R, 100000, '나');
  assert.deepStrictEqual([m.localChanged.plan, m.remoteChanged, m.doc.project, m.doc.extra], [true, true, { prjNo: 'P1', prjNm: '과제1', ws: 1 }, true]);
  assert.deepStrictEqual([m.doc.plan.items.map((e) => e.id).sort(), m.doc.plan.del], [['a', 'c', 'g'], { b: 60, d: 9, f: 8 }], 'g 받음 · b 묘비 받음 · c 묘비(1)는 항목(7)이 새로워 폐기');
  const back = D.toLocalPlan('P1', local, m);
  assert.deepStrictEqual(Object.keys(back.plan.plans).sort(), ['P1', 'P2']);
  assert.deepStrictEqual(back.plan.plans.P1['10|연구활동비'].map((e) => e.id), ['a', 'g']);
  assert.deepStrictEqual(back.plan.plans.P1['10|장비비'].map((e) => e.id), ['c']);
  assert.deepStrictEqual(back.plan.plans.P2, local.plan.plans.P2);
  assert.deepStrictEqual(back.plan.del, { e: { ts: 9, prj: 'P2' }, b: { ts: 60, prj: 'P1' }, d: { ts: 9, prj: 'P1' }, f: { ts: 8, prj: 'P1' } });
  const off = D.mergePlan(L, R, 100000, '나', { want: { plan: false } });
  assert.deepStrictEqual([off.doc.plan.items.map((e) => e.id), off.localChanged.plan, off.parts.plan, off.remoteChanged], [['a', 'g'], false, null, true], '과제명만 ERP 값으로 바뀜');
  assert.deepStrictEqual(D.toLocalPlan('P1', local, off).plan, { plans: local.plan.plans, del: local.plan.del });
});

console.log(`\n${n} passed${failed ? `, ${failed} failed` : ''}`);
})();
