/* lib/rnd-api.js collect() 의 "내 참여 과제만 보기" — 과제책임자(PRJ_RSPR_EMP_NM)가 본인 이름이면 참여인력(참여구분 계속)에 본인 행이 없어도 과제를 남기고,
 * 동명이인(memberFilter ambiguous)이면 책임자 이름도 믿지 않는다 (2026-10-23 책임자인데 참여인력 탭에 본인 행이 아직 없어 목록에서 빠진 사례).
 * 가짜 chrome.storage · 가짜 fetch(R&D ERP .jct 규약)로 collect() 를 끝까지 돌린다. 네트워크 없음. 실행: node tests/rnd-api-lead.test.js */
globalThis.self = globalThis;
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..');

// 가짜 chrome.storage (local · sync 모두 같은 메모리)
const mem = {};
const area = {
  get: async (keys) => { const ks = keys == null ? Object.keys(mem) : [].concat(keys); const o = {}; for (const k of ks) if (k in mem) o[k] = mem[k]; return o; },
  set: async (obj) => { Object.assign(mem, obj); },
  remove: async (keys) => { for (const k of [].concat(keys)) delete mem[k]; }
};
globalThis.chrome = { storage: { local: area, sync: area }, runtime: { lastError: null } };

for (const f of ['lib/format.js', 'lib/settings.js', 'lib/rnd-api.js']) require(path.join(root, f));
const API = KRX_API;

let n = 0, failed = 0;
const test = async (name, fn) => { try { await fn(); n++; console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n   ', e.stack || e.message); process.exitCode = 1; } };

// 가짜 fetch: 서비스 이름(…/<service>.jct)별 응답. 입력은 _JSON_ 이중 인코딩을 풀어 넘긴다. 없는 서비스는 빈 REC (계좌·카드·결재 조회 등은 이 테스트와 무관)
const calls = [];
function fakeFetch(routes) {
  return async (url, init) => {
    const service = (/\/([^/]+)\.jct$/.exec(String(url)) || [])[1] || '';
    let input = {};
    try { input = JSON.parse(decodeURIComponent(decodeURIComponent(String((init && init.body) || '').replace(/^_JSON_=/, '')))); } catch (e) {}
    calls.push({ service, input });
    const r = routes[service];
    const data = typeof r === 'function' ? r(input) : (r || { REC: [] });
    const buf = Buffer.from(JSON.stringify(Object.assign({ COMMON_HEAD: { ERROR: false } }, data)), 'utf8');
    return { status: 200, headers: { get: (k) => (/content-type/i.test(k) ? 'application/json;charset=UTF-8' : null) },
      arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
  };
}
const prj = (no, rspr, extra) => Object.assign({ PRJ_NO: no, PRJ_NM: '과제 ' + no, PRJ_RSPR_EMP_NM: rspr, PROG_STS_NM: '진행', ANL: '1', RCH_ST_DT: '20260101', RCH_END_DT: '20261231' }, extra || {});
const row = (empNo, empNm, extra) => Object.assign({ EMP_NO: empNo, EMP_NM: empNm, ROLE_NM: '참여연구원', PART_RT: '20', PART_TRM_DT: '2026-01-01 ~ 2026-12-31', PART_TRM_DT_DTL: '2026-01-01 ~ 2026-12-31', PART_HM_DIV_NM: '내부' }, extra || {});
const settingsOf = (over) => Object.assign({}, KRX_SETTINGS.DEFAULTS, {
  onlyMyProjects: true, accountRule: false, projectStatusKeyword: '진행', excludedProjects: [],
  adv: Object.assign({}, KRX_SETTINGS.DEFAULTS.adv || {}, { budgetService: '' })   // 자금현황 조회 생략
}, over || {});
const prjNos = (out) => out.projects.map((p) => p.prjNo).sort();

(async () => {
  await test('책임자 과제는 참여인력에 본인 행이 없어도(끝났어도) 남고, 남의 과제는 빠진다 — 참여율 표에는 계상률 행이 있는 과제만(끝난 행만 있으면 0%)', async () => {
    delete mem.membership; delete mem.rndUser; calls.length = 0;
    globalThis.fetch = fakeFetch({
      rcomm_0009_01_r001: { REC: [
        prj('2026-0063-01', '김책임'),                                   // 내가 책임자, 참여인력에 내 행 없음
        prj('2026-0064-01', '이타인'),                                   // 남의 과제, 내 행 없음
        prj('2026-0065-01', '이타인'),                                   // 참여연구원으로 사번 일치
        prj('2026-0066-01', '김책임', { RCH_ST_DT: '20250101' })        // 내가 책임자, 내 행은 참여기간이 끝남
      ] },
      rtask_0008_t03_01_r001: (input) => ({ INFO_REC: {
        '2026-0063-01': [row('99999', '박연구')],
        '2026-0064-01': [row('99999', '박연구')],
        '2026-0065-01': [row('99999', '박연구'), row('12345', '김책임')],
        '2026-0066-01': [row('12345', '김책임', { PART_RT: '10', PART_TRM_DT: '2025-01-01 ~ 2025-06-30', PART_TRM_DT_DTL: '2025-01-01 ~ 2025-06-30' })]
      }[input.PRJ_NO] || [], HM_PER_REC: [] })
    });
    const out = await API.collect(settingsOf({ myEmpNo: '12345', myName: '김책임' }));
    assert.strictEqual(out.error, null); assert.strictEqual(out.loginRequired, false);
    assert.strictEqual(out.memberFilter, 'applied');
    assert.deepStrictEqual(prjNos(out), ['2026-0063-01', '2026-0065-01', '2026-0066-01']);
    assert.strictEqual(out.notMemberCount, 1, '남의 과제 1건만 미참여');
    assert.strictEqual(out.endedCount, 0, '책임자 과제는 참여 종료로 세지 않음');
    assert.ok(calls.some((c) => c.service === 'rtask_0008_t03_01_r001' && c.input.SEARCH_GB === '1' && c.input.PRJ_NO === '2026-0063-01'), '참여인력 조회 입력은 그대로(SEARCH_GB 1)');
    assert.ok(out.participation, '참여율 요약');
    assert.deepStrictEqual(out.participation.items.map((x) => [x.prjNo, x.rate]), [['2026-0065-01', 20], ['2026-0066-01', 0]], '참여율 표는 계상률 행이 있는 과제만 — 책임자인데 행이 없는 과제는 빠지고, 끝난 행만 있는 과제는 0%');
    assert.strictEqual(out.participation.useId, true);
  });

  await test('동명이인이면 책임자 이름도 믿지 않는다 — 과제를 하나도 남기지 않고 후보만 넘김', async () => {
    delete mem.membership; delete mem.rndUser; calls.length = 0;
    globalThis.fetch = fakeFetch({
      rcomm_0009_01_r001: { REC: [prj('2026-0063-01', '김책임'), prj('2026-0067-01', '이타인'), prj('2026-0068-01', '이타인')] },
      rtask_0008_t03_01_r001: (input) => ({ INFO_REC: {
        '2026-0063-01': [row('99999', '박연구')],
        '2026-0067-01': [row('11111', '김책임')],     // 같은 이름, 다른 사번
        '2026-0068-01': [row('22222', '김책임')]
      }[input.PRJ_NO] || [], HM_PER_REC: [] })
    });
    const out = await API.collect(settingsOf({ myEmpNo: '', myName: '김책임' }));   // 사번을 몰라 이름으로만
    assert.strictEqual(out.error, null);
    assert.strictEqual(out.memberFilter, 'ambiguous');
    assert.deepStrictEqual(prjNos(out), []);
    assert.deepStrictEqual(out.nameCandidates.map((c) => c.empNo).sort(), ['11111', '22222']);
    assert.strictEqual(out.participation, null, '동명이인이면 참여율도 계산하지 않음');
  });

  console.log(`\n${n} passed, ${failed} failed`);
})();
