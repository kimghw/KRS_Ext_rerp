/* 연구수당 도우미(채팅, 2026-10-21) 테스트 — lib/allow-chat-core.js(입력 정리 · 프롬프트(10-53 지침) · 스키마 · 결과 검사 · 작업 한 줄 글), lib/allowance.js bind().agent(계산 요약 snapshot · 작업 반영 apply — 표의 칸과 같은 저장 모양),
 * help-server/staff-chat.js run(…, { core }) 가 이 모듈의 프롬프트·스키마로 claude -p 를 돌리는지(child_process.spawn 은 가짜). DOM·chrome·claude 없이. 실행: node tests/allow-chat.test.js */
globalThis.self = globalThis;
const path = require('path');
const assert = require('assert');
const EventEmitter = require('events');
const root = path.join(__dirname, '..');
for (const f of ['lib/format.js', 'lib/staff.js', 'lib/collect.js', 'lib/staff-ui.js', 'lib/docx.js', 'lib/allowance.js']) require(path.join(root, f));
const C = require(path.join(root, 'lib/allow-chat-core.js'));
globalThis.KRX_ALLOW_CHAT_CORE = C;
const S = KRX_STAFF, U = KRX_STAFF_UI, A = KRX_ALLOW;
let n = 0, failed = 0;
const queue = [];
const test = (name, fn) => queue.push([name, fn]);
const o = (x) => Object.assign({ op: '', name: '', field: '', value: '', level: '', count: 0, weight: 0 }, x);   // 구조화 출력의 한 작업(모든 칸)

const SNAP = { prjNo: '2026-0063-01', alias: 'SSCB', prjNm: '반도체 차단기 개발', year: 1, rspr: '김거화', period: '2026-04 ~ 2026-12', org: '한국선급', pool: 6000, avail: 5000, payTotal: 35900, n: 2, merge: { sa: false, cd: true }, adjust: { S: 5, D: -5 },
  names: ['김거화', '문창재', '김거화'], people: ['김거화 (책임) — 등급 S', '문창재 (연구) — 등급 A'], groups: ['S: 인원 기준 1명 · 몫 60%'], depts: [], warnings: ['성과 항목을 아직 적지 않아'], hasPlan: true,
  research: [{ name: 'DC 차단기 설계', level: '', text: '반도체 소자 선정 · 보호 알고리즘' }, { name: ' 시험 평가 ', level: '가', text: '' }, { name: '', level: '나' }, { name: '엉', level: '엉' }] };

test('core.clean — 글·규칙·첨부·대화·요약을 정리하고 빈 글은 거절', () => {
  const i = C.clean({ text: '  문창재에게  논문 넣어줘 ', rules: ' - 규칙 \n', history: [{ role: 'assistant', text: '답' }, { role: 'x', text: '사용자 글' }, { text: '' }], snapshot: SNAP });
  assert.deepStrictEqual([i.text, i.rules, i.history], ['문창재에게 논문 넣어줘', '- 규칙', [{ role: 'assistant', text: '답' }, { role: 'user', text: '사용자 글' }]]);
  assert.deepStrictEqual([i.snapshot.names, i.snapshot.pool, i.snapshot.merge, i.snapshot.adjust, i.snapshot.byDept, i.snapshot.n], [['김거화', '문창재'], 6000, { sa: false, cd: true }, { S: 5, A: 0, B: 0, C: 0, D: -5 }, false, 2]);
  assert.deepStrictEqual(i.snapshot.research, [{ name: 'DC 차단기 설계', level: '', text: '반도체 소자 선정 · 보호 알고리즘' }, { name: '시험 평가', level: '가', text: '' }, { name: '엉', level: '', text: '' }], '연구내용 항목 — 이름 없는 것은 빼고 모르는 등급은 빈 값');
  assert.throws(() => C.clean({ text: '  ' }), /비어/);
  assert.strictEqual(C.clean({ text: 'x', rules: C.DEFAULT_RULES }).rules, C.DEFAULT_RULES, '지침 기본 글은 한도 안');
  assert.ok(C.DEFAULT_RULES.includes('P3 22%') && C.DEFAULT_RULES.includes('40→4·8·16·8·4') && C.DEFAULT_RULES.includes('14→15.5/29.7/39.2/13.3/2.3') && C.DEFAULT_RULES.includes('제6조') && C.LIMIT.rules >= C.DEFAULT_RULES.length, '지침(표 2 · 인원 배분 · 지급비율 · 조문)이 들어 있음');
});
test('core.build — 요청 글(계산 요약 · 작업 안내 · 첨부 · 대화 · 요청) · 스키마(작업·이름·칸 enum) · 시스템 프롬프트(SYSTEM + 지침)', () => {
  const i = C.clean({ text: '김거화 기타 우수로', rules: '# 지침', history: [{ role: 'user', text: '앞 요청' }], snapshot: SNAP, files: [{ name: 'a/실적.txt', kind: 'text', text: '논문 1건' }] });
  const b = C.build(i);
  for (const s of ['[연구수당 계산 — 채팅 요청]', 'SSCB — 반도체 차단기 개발 (2026-0063-01) · 1차년도 · 연구기간 2026-04 ~ 2026-12 · 연구책임자 김거화', '연구수당 계상금액 6,000천원 · 집행 가능액 5,000천원 · 인건비 계상금액 35,900천원', '등급 통합 C+D · 등급 조정 S +5%p · D -5%p · 부서별 배정 끔',
    '- S: 인원 기준 1명 · 몫 60%', '- 김거화 (책임) — 등급 S', '알림:\n- 성과 항목을 아직 적지 않아', '첨부 파일 1개', '- a_실적.txt (글):\n논문 1건', '작업(ops) 종류', '- item_add:', '- research: 연구개발계획서의 연구내용 상위 항목', '연구개발계획서 1차년도 연구내용 상위 항목(research 작업으로', '- DC 차단기 설계 [분류 전] — 반도체 소자 선정 · 보호 알고리즘', '- 시험 평가 [가]', '이전 대화:\n사용자: 앞 요청', '요청: 김거화 기타 우수로']) assert.ok(b.text.includes(s), s);
  assert.ok(!C.build(C.clean({ text: 'x', snapshot: Object.assign({}, SNAP, { research: [] }) })).text.includes('연구개발계획서 1차년도 연구내용 상위 항목(research'), '연구내용이 없으면 그 줄도 없음');
  assert.deepStrictEqual(b.schema.properties.ops.items.properties.name.enum, ['김거화', '문창재', '']);
  assert.deepStrictEqual(b.schema.properties.ops.items.properties.op.enum, C.OPS.slice());
  assert.deepStrictEqual(b.schema.properties.ops.items.required, ['op', 'name', 'field', 'value', 'level', 'count', 'weight']);
  assert.ok(b.system.startsWith(C.SYSTEM) && b.system.includes('연구수당 지침 — 사용자가') && b.system.endsWith('# 지침'), '지침은 시스템 프롬프트 뒤에');
  assert.strictEqual(C.build(C.clean({ text: 'x', snapshot: SNAP })).system, C.SYSTEM, '규칙이 비면 SYSTEM 그대로');
  assert.ok(C.build(C.clean({ text: 'x', snapshot: { names: [] } })).text.includes('참여연구원 계획이 아직 없습니다'));
});
test('core.parse — 검사를 통과한 작업만(이름·칸·값), 나머지는 버림 수로', () => {
  const i = C.clean({ text: 'x', snapshot: SNAP });
  const out = C.parse(i, { reply: ' 반영합니다. ', ops: [
    o({ op: 'item_add', name: '문창재', value: '논문(SCI(E))', level: '가', count: 1, weight: 0.8 }), o({ op: 'item_add', name: '문창재', value: '최종보고서 작성', level: '엉', count: 0, weight: 0 }), o({ op: 'item_add', name: '문창재', value: '' }),
    o({ op: 'item_del', name: '김거화', value: '연구총괄 및 관리' }),
    o({ op: 'person', name: '김 거화', field: 'etc', value: '우수' }), o({ op: 'person', name: '김거화', field: 'etc', value: '75' }), o({ op: 'person', name: '김거화', field: 'etc', value: '' }), o({ op: 'person', name: '김거화', field: 'etc', value: '90' }),
    o({ op: 'person', name: '문창재', field: 'out', value: '예' }), o({ op: 'person', name: '문창재', field: 'out', value: 'off' }), o({ op: 'person', name: '문창재', field: 'out', value: '글쎄' }),
    o({ op: 'person', name: '문창재', field: 'rank', value: 'b' }), o({ op: 'person', name: '문창재', field: 'rank', value: '' }), o({ op: 'person', name: '문창재', field: 'rank', value: 'X' }),
    o({ op: 'person', name: '문창재', field: 'dept', value: ' 수소전기추진연구팀 ' }), o({ op: 'person', name: '문창재', field: 'sa', value: 'on' }), o({ op: 'person', name: '아무개', field: 'dept', value: '팀' }),
  ] });
  assert.strictEqual(out.reply, '반영합니다.');
  assert.deepStrictEqual(out.ops, [
    { op: 'item_add', name: '문창재', value: '논문(SCI(E))', level: '가', count: 1, weight: 0.8 }, { op: 'item_add', name: '문창재', value: '최종보고서 작성', level: '가', count: 1, weight: 1 },
    { op: 'item_del', name: '김거화', value: '연구총괄 및 관리' },
    { op: 'person', name: '김거화', field: 'etc', value: '100' }, { op: 'person', name: '김거화', field: 'etc', value: '75' }, { op: 'person', name: '김거화', field: 'etc', value: '' },
    { op: 'person', name: '문창재', field: 'out', value: 'on' }, { op: 'person', name: '문창재', field: 'out', value: 'off' },
    { op: 'person', name: '문창재', field: 'rank', value: 'B' }, { op: 'person', name: '문창재', field: 'rank', value: '' },
    { op: 'person', name: '문창재', field: 'dept', value: '수소전기추진연구팀' },
  ]);
  assert.strictEqual(out.dropped, 6);
  const out2 = C.parse(i, { reply: 'x', ops: [
    o({ op: 'pool', value: '5,000' }), o({ op: 'avail', value: '' }), o({ op: 'avail', value: '-3' }), o({ op: 'org', value: 'KR' }),
    o({ op: 'merge', field: 'sa', value: '통합' }), o({ op: 'merge', field: 'S', value: 'on' }), o({ op: 'adjust', field: 'S', value: '-5' }), o({ op: 'adjust', field: 'sa', value: '1' }), o({ op: 'adjust', field: 'A', value: '끔' }),
    o({ op: 'bydept', value: 'on' }), o({ op: 'auto' }), o({ op: 'clear' }), 'x', null,
  ] });
  assert.deepStrictEqual(out2.ops, [{ op: 'pool', value: 5000 }, { op: 'avail', value: null }, { op: 'org', value: 'KR' }, { op: 'merge', field: 'sa', value: 'on' }, { op: 'adjust', field: 'S', value: -5 }, { op: 'bydept', value: 'on' }, { op: 'auto' }]);
  assert.strictEqual(out2.dropped, 7);
  assert.strictEqual(C.parse(i, { ops: Array(30).fill(o({ op: 'auto' })) }).ops.length, C.LIMIT.ops, '작업은 한 번에 20개까지');
  const out3 = C.parse(i, { ops: [o({ op: 'research', value: 'dc차단기 설계', level: '나' }), o({ op: 'research', value: '시험 평가', level: '다' }), o({ op: 'research', value: '없는 항목', level: '가' }), o({ op: 'research', value: '시험 평가', level: '' }), o({ op: 'research', value: '', level: '가' })] });
  assert.deepStrictEqual([out3.ops, out3.dropped], [[{ op: 'research', value: 'DC 차단기 설계', level: '나' }, { op: 'research', value: '시험 평가', level: '다' }], 3], 'research 는 목록의 항목(띄어쓰기·대소문자 무시)과 가·나·다 등급만');
  assert.deepStrictEqual(C.parse(i, null), { reply: '', ops: [], dropped: 0 });
});
test('core.opText — 작업마다 한 줄', () => {
  assert.deepStrictEqual([
    C.opText({ op: 'pool', value: 5000 }), C.opText({ op: 'avail', value: null }), C.opText({ op: 'org', value: 'KR' }),
    C.opText({ op: 'person', name: '김거화', field: 'etc', value: '100' }), C.opText({ op: 'person', name: '김거화', field: 'etc', value: '' }), C.opText({ op: 'person', name: '문창재', field: 'out', value: 'on' }), C.opText({ op: 'person', name: '문창재', field: 'rank', value: '' }), C.opText({ op: 'person', name: '문창재', field: 'dept', value: '팀' }),
    C.opText({ op: 'item_add', name: '문창재', value: '논문(SCI(E))', level: '가', count: 1, weight: 0.8 }), C.opText({ op: 'item_del', name: '문창재', value: '논문(SCI(E))' }), C.opText({ op: 'research', value: 'DC 차단기 설계', level: '나' }),
    C.opText({ op: 'merge', field: 'cd', value: 'off' }), C.opText({ op: 'adjust', field: 'S', value: 5 }), C.opText({ op: 'bydept', value: 'on' }), C.opText({ op: 'auto' }),
  ], ['연구수당 계상금액 5,000천원', '집행 가능액 기본값으로', '연구기관명 KR', '김거화 — 기타 평가 우수(100)', '김거화 — 기타 평가 미평가', '문창재 — 미지급 켬', '문창재 — 평가등급 자동', '문창재 — 부서 팀',
    '문창재 — 성과 항목 논문(SCI(E)) (가 · 1건 · 가중치 0.8)', '문창재 — 성과 항목 논문(SCI(E)) 빼기', '연구내용 "DC 차단기 설계" — 나 등급', 'C+D 통합 끔', 'S 등급 조정 +5%p', '부서별 배정 켬', '자동 배정으로 되돌리기']);
});

/* allowance 의 agent — 가짜 host 로 bind 한 뒤 snapshot·apply (chrome 없음 — 저장은 조용히 건너뜀) */
const P = { prjNo: '2026-0063-01', prjNm: 'MW급 10kV 고전압 직류 시스템용 반도체 차단기 개발', rspr: '김거화', anl: '1', stDt: '20260401', endDt: '20261231', budget: { items: [{ exp: '인건비', bgt: 35900000, appr: 0, req: 0 }, { exp: '연구수당', bgt: 6000000, appr: 1000000, req: 0 }] } };
const months = S.ymRange('2026-04', '2026-12');
const plan = { prjNo: P.prjNo, year: 1, from: '2026-04', to: '2026-12', basis: 'rerp', people: [
  { id: 'k', name: '김거화', role: '과제책임자', erp: { monthly: 8480000 }, plan: months.map((m) => ({ ym: m, amt: 2186000 })), cuts: [] },
  { id: 'm', name: '문창재', role: '참여연구원', erp: { monthly: 5823000 }, plan: months.map((m) => ({ ym: m, amt: 805000 })), cuts: [], allowance: 1500000 },
  { id: 'j', name: '조주희', role: '행정지원', plan: [], cuts: [] }] };
function withAgent() {
  const st = { data: { projects: [P] }, staffPlans: { [S.planKey(P.prjNo, 1)]: plan }, staffRows: {}, staffView: { prjNo: P.prjNo, years: { [P.prjNo]: 1 }, extra: {}, inc: {}, fold: {} }, research: {}, plans: {}, allowCalc: {}, staffWho: '김거화', staffAliases: { [P.prjNo]: 'SSCB' } };
  let draws = 0;
  const api = A.bind({ addEventListener() {}, contains: () => false, querySelector: () => null, querySelectorAll: () => [], ownerDocument: { activeElement: null } }, st, () => { draws++; });
  return { api, st, draws: () => draws };
}
test('agent.snapshot — 보고 있는 과제·연차의 계산 요약(천원 · 사람 줄 · 등급 몫 · 알림)', () => {
  const { api, st } = withAgent();
  st.allowCalc[S.planKey(P.prjNo, 1)] = { people: { k: { items: [{ name: '연구총괄 및 관리', level: '가', count: 1, weight: 1 }], etc: 100 } }, adjust: { S: 5, A: -5 }, at: 1 };
  const s = api.agent.snapshot();
  assert.deepStrictEqual([s.prjNo, s.alias, s.year, s.rspr, s.period, s.org, s.pool, s.avail, s.payTotal, s.n, s.names, s.hasPlan, s.merge, s.adjust.S, s.byDept], [P.prjNo, 'SSCB', 1, '김거화', '2026-04 ~ 2026-12', '한국선급', 6000, 5000, 35900, 2, ['김거화', '문창재'], true, { sa: false, cd: false }, 5, false]);
  assert.strictEqual(s.people.length, 2, '행정지원은 없음');
  const requiredSummary = '연구총괄 및 관리(포함)[가 50점 × 1건 × 가중치 0.5 = 25], 진도보고서 작성(포함)[다 10점 × 1건 × 가중치 0.5 = 5], 연구내용 사전조사(포함)[다 10점 × 1건 × 가중치 0.5 = 5]';   // 필수 3개 (2026-10-22)
  assert.ok(s.people[0].startsWith('김거화 (') && s.people[0].includes(`성과 항목 ${requiredSummary} (기여도 합 35`) && s.people[0].includes('기타 우수(100)') && s.people[0].includes('등급 S') && s.people[0].includes('지급액 3,250천원') && s.people[0].includes('한도 모름'), s.people[0]);
  assert.ok(s.people[1].includes('기타 미평가') && s.people[1].includes('등급 A') && s.people[1].includes('남은 연구수당 1,500천원(응답) 초과 250천원'), s.people[1]);
  assert.ok(s.groups[0].startsWith('S: 인원 기준 1명 · 몫 65% · 지금 1명(김거화) · 1인 65.00%') && s.groups.length === 5, s.groups[0]);
  assert.ok(s.warnings.some((w) => w.startsWith('문창재: 지급액')) && s.depts.length === 0);
  assert.strictEqual(api.agent.current().prjNo, P.prjNo);
  assert.ok(withAgent().api.agent.snapshot().people[0].includes(`성과 항목 ${requiredSummary} (기여도 합 35`), '저장이 없어도 필수 3개 · 난이도 가/다/다 · 가중치 1/2');
  assert.deepStrictEqual(s.research, [], '연구개발계획서가 없으면 빈 목록');
  const { api: api2, st: st2 } = withAgent();
  st2.research = { r1: { id: 'r1', prjNo: P.prjNo, n: 1, contents: [{ item: 'DC 차단기 설계', details: ['소자 선정'] }, { item: '시험 평가', details: [] }] } };
  st2.allowCalc[S.planKey(P.prjNo, 1)] = { people: {}, research: { '시험 평가': '다' }, at: 1 };
  assert.deepStrictEqual(api2.agent.snapshot().research, [{ name: 'DC 차단기 설계', level: '', text: '소자 선정' }, { name: '시험 평가', level: '다', text: '' }], '연구내용 항목과 매겨진 등급');
});
test('agent.apply — 작업을 차례대로 저장 모양에(표의 칸과 같이), 실패해도 다음 작업은 계속, 끝에 한 번 다시 그림', async () => {
  const { api, st, draws } = withAgent();
  const key = S.planKey(P.prjNo, 1);
  const out = await api.agent.apply([
    { op: 'item_add', name: '문창재', value: '논문(SCI(E))', level: '가', count: 1, weight: 0.8 }, { op: 'item_add', name: '김거화', value: '연구총괄 및 관리', level: '가', count: 1, weight: 1 },
    { op: 'person', name: '김거화', field: 'etc', value: '100' }, { op: 'person', name: '문창재', field: 'dept', value: '수소전기추진연구팀' }, { op: 'person', name: '아무개', field: 'etc', value: '100' },
    { op: 'pool', value: 4000 }, { op: 'avail', value: null }, { op: 'org', value: 'KR' },
    { op: 'merge', field: 'sa', value: 'on' }, { op: 'adjust', field: 'S', value: -5 }, { op: 'adjust', field: 'A', value: 5 },
    { op: 'person', name: '문창재', field: 'rank', value: 'S' },
  ]);
  const e = st.allowCalc[key];
  assert.deepStrictEqual(out.map((r) => r.ok), [true, false, true, true, false, true, true, true, false, true, true, true]);
  assert.ok(out[1].msg.includes('포함한 항목') && out[1].msg.includes('담당 그룹'), '필수 연구총괄을 도우미로 중복 추가할 수 없음');
  assert.ok(out[4].msg.includes('아무개') && out[4].msg.includes('없습니다') && out[8].msg.includes('5명 이상'), '목록 밖 이름 · 5명 미만 통합');
  assert.deepStrictEqual([e.people.m.items, e.people.k.items, e.people.k.etc, e.people.m.dept, e.pool, e.avail, e.org, e.merge, e.adjust], [[{ name: '논문(SCI(E))', level: '가', count: 1, weight: 0.8 }], undefined, 100, '수소전기추진연구팀', 4000000, undefined, 'KR', undefined, { S: -5, A: 5 }]);
  assert.deepStrictEqual([e.people.m.rank, e.people.k.rank], ['S', 'A'], '수동 등급 — 같은 범위의 다른 사람은 그때 등급(김거화 A — 필수가 3개가 되어 논문이 있는 문창재가 앞섬, 2026-10-22)으로 적혀 안 움직임');
  assert.ok(out[0].text === '문창재 — 성과 항목 논문(SCI(E)) (가 · 1건 · 가중치 0.8)' && out[0].msg.includes('성과 항목 1개 · 합산기여도') && out[5].msg.startsWith('계상금액 4,000천원 · 총 지급액') && out[11].msg.includes('S 등급'), out[11].msg);
  assert.ok(draws() === 1 && e.at > 0);
  // 되돌리기·빼기·미지급
  const out2 = await api.agent.apply([{ op: 'item_del', name: '문창재', value: '논문 (SCI(E))' }, { op: 'item_del', name: '문창재', value: '없는 항목' }, { op: 'person', name: '문창재', field: 'out', value: 'on' }, { op: 'auto' }, { op: 'person', name: '김거화', field: 'etc', value: '' }, { op: 'bydept', value: 'on' }, { op: 'nope' }]);
  assert.deepStrictEqual(out2.map((r) => r.ok), [true, false, true, true, true, true, false]);
  assert.deepStrictEqual([e.people.m.items, e.people.m.out, e.people.m.rank, (e.people.k || {}).rank, (e.people.k || {}).etc, e.byDept], [undefined, true, undefined, undefined, undefined, true]);
  assert.strictEqual(e.people.k, undefined, '필수 항목은 자동 계산하므로 직접 입력값을 모두 지운 사람은 저장에서 정리');
  assert.ok(out2[2].msg.includes('제외(미지급)') && out2[6].msg.includes('모르는 작업'));
  assert.strictEqual(api.agent.snapshot().n, 1, '미지급은 대상에서 빠짐');
  // 연구내용 등급(research) · 포함 항목(필수)은 못 뺌
  st.research = { r1: { id: 'r1', prjNo: P.prjNo, n: 1, contents: [{ item: 'DC 차단기 설계', details: [] }] } };
  const out3 = await api.agent.apply([{ op: 'research', value: 'dc 차단기설계', level: '나' }, { op: 'research', value: '없는 항목', level: '가' }, { op: 'research', value: 'DC 차단기 설계', level: '엉' }, { op: 'item_del', name: '김거화', value: '진도보고서 작성' }]);
  assert.deepStrictEqual(out3.map((r) => r.ok), [true, false, false, false]);
  assert.deepStrictEqual(e.research, { 'DC 차단기 설계': '나' });
  assert.ok(out3[0].text === '연구내용 "dc 차단기설계" — 나 등급' && out3[0].msg.startsWith('연구내용 "DC 차단기 설계" — 나 등급(30점)') && out3[1].msg.includes('연구내용에 없습니다') && out3[2].msg.includes('가·나·다') && out3[3].msg.includes('포함한 항목이라 사람에게서 뺄 수 없습니다'), out3.map((r) => r.msg).join('\n'));
  const protectedItems = ['연구 총괄 및 관리', '진도 보고서 작성', '연구내용사전조사'];   // 필수 3개 (2026-10-22 — 연구계획서·최종보고서는 이제 보통 항목)
  const protectedResults = await api.agent.apply(protectedItems.map((value) => ({ op: 'item_del', name: '김거화', value })));
  assert.ok(protectedResults.every((r) => !r.ok && r.msg.includes('포함한 항목이라 사람에게서 뺄 수 없습니다')), '필수 3개는 띄어쓰기가 달라도 도우미가 개인 줄에서 삭제할 수 없음');
});

test('agent.apply — 전담 그룹 밖 연구자의 옛 개별 항목은 숨기고 도우미 추가·삭제도 공통 배정에 따름', async () => {
  const { api, st } = withAgent(), key = S.planKey(P.prjNo, 1), name = '최종보고서 작성';
  const stored = [{ name: '최종 보고서 작성', level: '가', count: 2, weight: 0.7 }, { name: '논문(SCI(E))', level: '가', count: 1, weight: 0.8 }];
  st.allowCalc[key] = { people: { k: { items: stored.map((item) => ({ ...item })) } }, pick: { [name]: true }, groups: [{ name: '보고서 전담', people: ['m'], items: [name] }], at: 1 };   // 최종보고서는 2026-10-22 부터 필수가 아니라 pick 으로 포함
  const snapshot = api.agent.snapshot();
  assert.ok(!snapshot.people[0].includes('최종') && snapshot.people[0].includes('논문(SCI(E))') && snapshot.people[1].includes('최종보고서 작성(포함)'), '도우미 요약도 전담 그룹 적용 결과를 사용');
  const results = await api.agent.apply([{ op: 'item_add', name: '김거화', value: name, level: '가', count: 1, weight: 1 }, { op: 'item_del', name: '김거화', value: '최종 보고서 작성' }]);
  assert.ok(results.every((result) => !result.ok && result.msg.includes('포함한 항목')), '공통 포함 상태에서는 그룹 밖 사람에게도 도우미가 중복 추가·삭제하지 못함');
  assert.deepStrictEqual(st.allowCalc[key].people.k.items, stored, '거절된 작업은 숨은 개별 저장값을 그대로 보존');
});

/* help-server/staff-chat.js run(…, { core }) — child_process.spawn 을 가짜로: 이 모듈의 시스템 프롬프트·스키마·요청 글로 돌고 결과를 이 모듈의 parse 로 읽는다 */
test('server run(core) — --system-prompt 에 연구수당 지침, --json-schema 에 이 모듈의 작업, stdin 에 계산 요약, structured_output → allow parse', async () => {
  const cp = require('child_process');
  const realSpawn = cp.spawn;
  let seen = null;
  cp.spawn = (bin, args, opt) => {
    const child = new EventEmitter();
    seen = { bin, args, stdin: '' };
    child.stdin = { on() {}, end(s) { seen.stdin = String(s); } };
    child.stdout = new EventEmitter(); child.stdout.setEncoding = () => {};
    child.stderr = new EventEmitter(); child.stderr.setEncoding = () => {};
    child.kill = () => {};
    setImmediate(() => {
      child.stdout.emit('data', JSON.stringify({ type: 'result', is_error: false, total_cost_usd: 0.03, duration_api_ms: 4000,
        structured_output: { reply: '기타 평가를 우수로 둡니다.', ops: [o({ op: 'person', name: '김거화', field: 'etc', value: '우수' }), o({ op: 'change', name: '문창재', value: '25' })] } }) + '\n');
      child.emit('close', 0);
    });
    return child;
  };
  try {
    const runner = require(path.join(root, 'help-server/staff-chat.js'));
    const input = C.clean({ text: '김거화 기타 우수로', rules: C.DEFAULT_RULES, snapshot: SNAP });
    const out = await runner.run(input, { bins: ['claude-x'], model: 'claude-opus-5-5', fallback: '', env: {}, timeoutMs: 5000, core: C });
    assert.deepStrictEqual([out.reply, out.ops, out.dropped, out.cost], ['기타 평가를 우수로 둡니다.', [{ op: 'person', name: '김거화', field: 'etc', value: '100' }], 1, 0.03]);
    const a = seen.args, sys = a[a.indexOf('--system-prompt') + 1], schema = JSON.parse(a[a.indexOf('--json-schema') + 1]);
    assert.ok(sys.startsWith(C.SYSTEM) && sys.includes('10-53 국가연구개발과제 연구수당 지급 기준') && sys.includes('P3 22%'), '지침이 시스템 프롬프트에');
    assert.deepStrictEqual(schema.properties.ops.items.properties.op.enum, C.OPS.slice());
    assert.ok(seen.stdin.startsWith('[연구수당 계산 — 채팅 요청]') && seen.stdin.includes('요청: 김거화 기타 우수로') && a.includes('--safe-mode') && a[a.indexOf('--tools') + 1] === '');
  } finally { cp.spawn = realSpawn; }
});

(async () => {
  for (const [name, fn] of queue) { try { await fn(); n++; console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n   ', e.stack || e.message); } }
  console.log(`${n} passed, ${failed} failed`);
  if (failed) process.exitCode = 1;
})();
