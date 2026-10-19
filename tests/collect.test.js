/* lib/collect.js(참여연구원 자료 요청 — SharePoint 응답 목록 · 팀즈 딥 링크 · 응답 취합의 순수 부분, 0.8.9) 테스트: 목록 제목·칸, 기본 글·Teams 딥 링크(이메일 · 그룹 · 인코딩), 목록 항목 → 응답(이메일로 사람 맞춤 · 표시 이름 대체 · 달 모양 정리 · 월급여 천원 → 원 · 최신 먼저),
 * 요청 모양 정리(중복 사람·응답 · applied), 이 과제 판정(isThis), 다른 과제 참여율 → 100% 검사 book(otherBook — KRX_STAFF.checks 와 이어서), 미반영·요약·응답 줄 글, 이름 → 이메일 캐시 모양. 네트워크·chrome 없음. 실행: node tests/collect.test.js */
globalThis.self = globalThis;
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..');
for (const f of ['lib/staff.js', 'lib/collect.js']) require(path.join(root, f));
const S = KRX_STAFF, C = KRX_COLLECT;
let n = 0, failed = 0;
const test = (name, fn) => { try { fn(); n++; console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n   ', e.stack || e.message); process.exitCode = 1; } };

const CTX = { alias: 'SSCB', prjNo: '2026-0063-01', prjNm: 'MW급 10kV 고전압 직류 시스템용 반도체 차단기 개발' };
const FORM = 'https://krclass-my.sharepoint.com/personal/kimghw_krs_co_kr/Lists/KR%20%EC%B0%B8%EC%97%AC%ED%98%84%ED%99%A9%20SSCB%201%EC%B0%A8%EB%85%84%EB%8F%84/NewForm.aspx';

test('목록 제목·칸·설명 — 별칭 → 과제명 앞부분 → 과제번호, 못 쓰는 글자 제거, 80자; 칸은 영문 내부 이름 + 한글 표시 이름, 제목 칸 기본값 "이 과제"', () => {
  assert.strictEqual(C.listTitleFor({ alias: 'SSCB', year: 1 }), 'KR 참여현황 SSCB 1차년도');
  assert.strictEqual(C.listTitleFor({ prjNm: 'MW급 10kV 고전압 직류 시스템용 반도체 차단기 개발', year: 2 }), 'KR 참여현황 MW급 10kV 고전압 직류 시스템용 2차년도');
  assert.strictEqual(C.listTitleFor({ prjNo: '2026-0063-01' }), 'KR 참여현황 2026-0063-01 1차년도');
  assert.strictEqual(C.listTitleFor({ alias: 'A/B: "C"? #1 & 2', year: 3 }), 'KR 참여현황 AB C 1 2 3차년도');
  assert.ok(C.listTitleFor({ alias: '가'.repeat(100), year: 1 }).length <= 80);
  const fields = C.fieldsOf();
  assert.deepStrictEqual(fields.map((f) => [f.name, f.kind]), [['PeriodFrom', 2], ['PeriodTo', 2], ['Rate', 9], ['Monthly', 9], ['Note', 3]]);
  assert.ok(fields.every((f) => /^[A-Za-z]+$/.test(f.name) && /[가-힣]/.test(f.title)));
  fields[0].name = 'X'; assert.strictEqual(C.FIELDS[0].name, 'PeriodFrom', '사본');
  assert.deepStrictEqual([C.TITLE_FIELD.title, C.TITLE_FIELD.defaultValue], ['항목', '이 과제']);
  assert.ok(C.listDescription({ label: 'SSCB', year: 1 }).startsWith('SSCB 1차년도 참여연구원'));
});

test('기본 글 · messageOf · Teams 딥 링크 — users 는 이메일(여럿이면 그룹 + topicName), message 는 URL 인코딩, 이메일이 없으면 빈 값', () => {
  const msg = C.defaultMessage({ alias: 'SSCB', prjNm: 'MW급', year: 1, from: '2026-04', to: '2026-12', formUrl: FORM, who: '김거화' });
  assert.ok(msg.startsWith('[SSCB — MW급] 1차년도 참여연구원 자료 요청') && msg.includes('기간 2026-04 ~ 2026-12의') && msg.includes(`양식: ${FORM}`) && msg.endsWith('— 김거화'), msg);
  assert.strictEqual(C.messageOf({ message: '내 글', formUrl: FORM }, {}), '내 글');
  assert.ok(C.messageOf({ message: '', formUrl: FORM, year: 2 }, { alias: 'SSCB' }).includes('2차년도') && C.messageOf({ formUrl: FORM }, {}).includes(FORM));
  const one = C.teamsLink(['CJMoon@krs.co.kr'], '양식: https://x/y?z=1&w=2');
  assert.strictEqual(one, 'https://teams.microsoft.com/l/chat/0/0?users=cjmoon%40krs.co.kr&message=%EC%96%91%EC%8B%9D%3A%20https%3A%2F%2Fx%2Fy%3Fz%3D1%26w%3D2');
  const grp = C.teamsLink(['a@krs.co.kr', 'b@krs.co.kr', 'nope', ''], '글', 'SSCB 자료 요청');
  assert.strictEqual(grp, 'https://teams.microsoft.com/l/chat/0/0?users=a%40krs.co.kr%2Cb%40krs.co.kr&topicName=SSCB%20%EC%9E%90%EB%A3%8C%20%EC%9A%94%EC%B2%AD&message=%EA%B8%80');
  assert.ok(!C.teamsLink(['a@krs.co.kr'], '글', '제목').includes('topicName'), '혼자면 topicName 없음');
  assert.strictEqual(C.teamsLink([], '글'), ''); assert.strictEqual(C.teamsLink(['nope'], '글'), '');
  assert.strictEqual(C.teamsLink('a@krs.co.kr', ''), 'https://teams.microsoft.com/l/chat/0/0?users=a%40krs.co.kr');
});

test('ymOf · email — 달 모양 여러 가지, 이메일 모양', () => {
  for (const [v, want] of [['2026-11', '2026-11'], ['2026.11', '2026-11'], ['202611', '2026-11'], ['2026-11-15', '2026-11'], ['2026년 11월', '2026-11'], ['2026/1', '2026-01'], [' 2026-3 ', '2026-03'], ['2026-13', ''], ['11월', ''], ['', ''], [null, ''], [202611, '2026-11']]) assert.strictEqual(C.ymOf(v), want, `ymOf(${JSON.stringify(v)})`);
  assert.strictEqual(C.email(' CJMoon@KRS.co.kr '), 'cjmoon@krs.co.kr'); assert.strictEqual(C.email('cjmoon'), ''); assert.strictEqual(C.email('a@b'), '');
  assert.deepStrictEqual(C.normalizeEmails({ '문 창재': 'A@krs.co.kr', '김거화': 'nope', '': 'x@y.z' }), { 문창재: 'a@krs.co.kr' });
});

test('responsesOfItems — Author 이메일로 사람(한글 이름) 맞춤, 없으면 표시 이름이 같은 이름, 없으면 표시 이름; 달 모양 정리 · 월급여 천원 → 원(원으로 적은 큰 값은 그대로) · 참여율 범위 · 최신 먼저 · Id 없는 줄 뺌', () => {
  const req = { people: [{ name: '문창재', email: 'cjmoon@krs.co.kr', title: 'MOON Changjae' }, { name: '김거화', email: '', title: '' }] };
  const items = [
    { Id: 3, Title: '이 과제', PeriodFrom: '2026.11', PeriodTo: '202703', Rate: '25', Monthly: '5,823', Note: ' 11월부터 ', Created: '2026-10-20T01:00:00Z', Modified: '2026-10-20T02:00:00Z', Author: { Title: 'MOON Changjae', EMail: 'CJMoon@krs.co.kr' } },
    { Id: 4, Title: '선박 과제', PeriodFrom: '2026-10', PeriodTo: '', Rate: 80, Monthly: null, Note: null, Modified: '2026-10-20T03:00:00Z', Author: { Title: 'KIM Geohwa', EMail: 'kimghw@krs.co.kr' } },
    { Id: 5, Title: '', PeriodFrom: '', PeriodTo: '', Rate: 120, Monthly: 6000000, Note: '', Modified: '2026-10-19T03:00:00Z', Author: { Title: '김거화', EMail: '' } },
    { Title: 'Id 없음', Author: {} },
    { Id: 6, Title: 'x', Rate: -1, Modified: 'bad', Author: { Title: 'HONG Gildong', EMail: 'hong@krs.co.kr' } },
  ];
  const out = C.responsesOfItems(items, req, ['이몽룡']);
  assert.deepStrictEqual(out.map((r) => r.id), ['4', '3', '5', '6'], '최신 먼저(Modified), 못 읽는 시각은 0');
  const r3 = out.find((r) => r.id === '3');
  assert.deepStrictEqual([r3.name, r3.by, r3.email, r3.title, r3.from, r3.to, r3.rate, r3.monthly, r3.note, r3.at], ['문창재', 'MOON Changjae', 'cjmoon@krs.co.kr', '이 과제', '2026-11', '2027-03', 25, 5823000, '11월부터', Date.parse('2026-10-20T02:00:00Z')]);
  const r4 = out.find((r) => r.id === '4');
  assert.deepStrictEqual([r4.name, r4.from, r4.to, r4.rate, r4.monthly], ['KIM Geohwa', '2026-10', '2026-10', 80, null], '이메일·이름으로 못 맞추면 표시 이름, 끝 달이 비면 시작 달');
  const r5 = out.find((r) => r.id === '5');
  assert.deepStrictEqual([r5.name, r5.rate, r5.monthly, r5.from], ['김거화', null, 6000000, ''], '표시 이름이 사람 이름과 같음 · 100 넘는 참여율은 버림 · 100만 넘는 월급여는 원 그대로');
  assert.deepStrictEqual([out.find((r) => r.id === '6').rate, out.find((r) => r.id === '6').at], [null, 0]);
  assert.deepStrictEqual(C.responsesOfItems(null, null), []);
});

test('normalizeRequest · normalizeAll — 키에서 과제·연차, 사람은 이름마다 하나(공백 무시) · 40명, 응답은 id 마다 하나 · 차례, applied 시각, 글 길이, 모르는 상태는 빈 값', () => {
  const raw = { title: 'T', listId: 'L', site: 'https://s', path: '/p', listUrl: 'https://l', formUrl: 'https://f', createdAt: '2026-10-20T00:00:00Z', by: '김거화', message: '  글  ',
    people: [{ name: '문창재', email: 'A@krs.co.kr', status: 'shared', sharedAt: 5 }, { name: '문 창재', email: 'b@krs.co.kr' }, { name: '', email: 'c@krs.co.kr' }, { name: '김거화', status: 'weird', candidates: ['a', ''] }],
    responses: [{ id: 3, name: '문창재', title: '이 과제', from: '2026-11', rate: 25, at: 5 }, { id: '3', name: '중복' }, { id: 4, rate: 80, at: 9 }, { name: 'id 없음' }], applied: { 3: 7, 9: 'bad', 4: '2026-10-20T00:00:00Z' } };
  const req = C.normalizeRequest(raw, '2026-0063-01@2');
  assert.deepStrictEqual([req.prjNo, req.year, req.title, req.createdAt, req.by, req.message], ['2026-0063-01', 2, 'T', Date.parse('2026-10-20T00:00:00Z'), '김거화', '글']);
  assert.deepStrictEqual(req.people.map((p) => [p.name, p.email, p.status, p.sharedAt, p.candidates]), [['문창재', 'a@krs.co.kr', 'shared', 5, []], ['김거화', '', '', 0, ['a']]]);
  assert.deepStrictEqual(req.responses.map((r) => [r.id, r.name, r.rate, r.to]), [['4', '', 80, ''], ['3', '문창재', 25, '2026-11']]);
  assert.deepStrictEqual(req.applied, { 3: 7, 4: Date.parse('2026-10-20T00:00:00Z') });
  assert.strictEqual(C.normalizeRequest({ year: 1 }, ''), null, '키에 과제가 없고 prjNo 도 없으면 null');
  assert.strictEqual(C.normalizeRequest({ year: 1 }, 'x@2').prjNo, 'x', '키에서 과제번호');
  assert.strictEqual(C.normalizeRequest(null), null);
  const all = C.normalizeAll({ 'A@1': { prjNo: 'A', year: 1 }, bad: { year: 2 }, 'B@3': { prjNo: 'B', year: 9 } });
  assert.deepStrictEqual(Object.keys(all), ['A@1', 'bad@2', 'B@9'], '저장 키는 prjNo@year 로 다시(과제번호가 없으면 키에서)');
  const many = C.normalizeRequest({ prjNo: 'A', year: 1, people: Array.from({ length: 50 }, (_, i) => ({ name: `사람${i}` })) });
  assert.strictEqual(many.people.length, C.PEOPLE_MAX);
});

test('isThis — 비었거나 "이 과제" 또는 별칭·과제번호·과제명 앞부분을 품으면 이 과제; pending · responseStats · summary · responseText · summaryLines', () => {
  for (const t of ['', '이 과제', ' 이과제 ', 'SSCB', 'sscb 과제', '2026-0063-01', 'MW급 10kV 고전압', 'MW급 10kV']) assert.strictEqual(C.isThis(t, CTX), true, `isThis(${t})`);
  for (const t of ['선박 과제', '수소 엔진', 'MW', 'MW급']) assert.strictEqual(C.isThis(t, CTX), false, `isThis(${t}) — 두세 글자 조각은 다른 과제일 수 있어 이 과제로 보지 않음`);
  assert.strictEqual(C.isThis('', {}), true); assert.strictEqual(C.isThis('x', {}), false);
  const req = C.normalizeRequest({ prjNo: CTX.prjNo, year: 1, people: [{ name: '문창재', email: 'a@krs.co.kr', status: 'shared' }, { name: '김거화', status: 'notFound' }, { name: '홍길동', email: 'h@krs.co.kr' }],
    responses: [{ id: '3', name: '문창재', title: '이 과제', from: '2026-11', to: '2027-03', rate: 25, monthly: 5823000, at: 5 }, { id: '4', name: '문창재', title: '선박 과제', from: '2026-10', rate: 80, at: 4 }, { id: '5', name: '홍길동', title: '', from: '2026-11', rate: 10, note: '참고로 길게 적은 비고 글', at: 3 }], applied: { 5: 9 } });
  assert.deepStrictEqual(C.pending(req, CTX).map((r) => r.id), ['3'], '이 과제 줄 가운데 미반영만(4 는 다른 과제, 5 는 반영됨)');
  assert.deepStrictEqual(C.responseStats(req), { 문창재: { n: 2, at: 5 }, 홍길동: { n: 1, at: 3 } });
  assert.strictEqual(C.summary(req, CTX), '공유 1/3명 · 응답 2명 (3건) · 미반영 1건');
  assert.strictEqual(C.summary({ people: [], responses: [] }, CTX), '사람 없음 · 응답 0명');
  assert.strictEqual(C.summary(null), '');
  assert.strictEqual(C.responseText(req.responses[0], req, CTX), '문창재 — 이 과제 · 2026-11~2027-03 · 25% · 월급여 5,823천원 · 미반영');
  assert.strictEqual(C.responseText(req.responses[1], req, CTX), '문창재 — 선박 과제 · 2026-10 · 80% · 100% 검사에 씀');
  assert.strictEqual(C.responseText(req.responses[2], req, CTX), '홍길동 — 이 과제 · 2026-11 · 10% · "참고로 길게 적은 비고 글" · 반영됨');
  assert.strictEqual(C.summaryLines(req, CTX).length, 3);
});

test('otherBook — 다른 과제 줄을 달마다 { ym, rate, label } 로(이름키, 기간 펼침, 이 과제·참여율 없음·기간 없음은 뺌) → KRX_STAFF.mergeOthers · checks 가 100% 초과 알림에 쓴다', () => {
  const req = { responses: [
    { id: '1', name: '문창재', title: '선박 과제', from: '2026-10', to: '2026-12', rate: 80, at: 1 },
    { id: '2', name: '문창재', title: '이 과제', from: '2026-10', to: '2026-12', rate: 20, at: 1 },
    { id: '3', name: '문창재', title: '수소 과제', from: '2026-12', to: '2026-12', rate: 10, at: 1 },
    { id: '4', name: '김거화', title: '다른', from: '', to: '', rate: 50, at: 1 },
    { id: '5', name: '김거화', title: '다른', from: '2026-10', to: '2026-10', rate: null, at: 1 },
  ] };
  const book = C.otherBook(req, CTX);
  assert.deepStrictEqual(Object.keys(book), ['문창재']);
  assert.deepStrictEqual(book['문창재'], [{ ym: '2026-10', rate: 80, label: '선박 과제(응답)' }, { ym: '2026-11', rate: 80, label: '선박 과제(응답)' }, { ym: '2026-12', rate: 80, label: '선박 과제(응답)' }, { ym: '2026-12', rate: 10, label: '수소 과제(응답)' }]);
  assert.deepStrictEqual(C.otherBook(null, CTX), {});
  // checks 와 이어서 — 이 과제 20.01% + 응답의 80% = 100.01% → 알림(막지 않음)
  const person = S.normalizePerson({ name: '문창재', manual: 5823000, plan: S.ymRange('2026-04', '2026-12').map((ym) => ({ ym, amt: 1165000 })) });
  const warns = S.checks({ basis: 'rerp', people: [person] }, 'rerp', { others: S.mergeOthers(book, { people: [person] }) });
  const over = warns.find((w) => w.kind === 'over');
  assert.ok(over && over.text.includes('10월 참여율 합 100.01%') && over.text.includes('선박 과제(응답) 80.00%') && over.text.includes('외 2달'), over && over.text);
});

console.log(`\n${n} passed${failed ? `, ${failed} failed` : ''}`);
