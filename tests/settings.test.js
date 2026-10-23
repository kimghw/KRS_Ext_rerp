/* lib/settings.js 테스트 — 저장분 → 쓰는 설정(KRX_SETTINGS.fromStored = merge(DEFAULTS, stored) 뒤 migrate). 0.8.7 의 공유 (Plus): 원노트 페이지(MCP 서버 · Microsoft 로그인)에서
 * SharePoint(OneDrive) 폴더의 과제별 JSON 파일로 바뀜 (2026-10-18 사용자 결정 "mcp 없이 … 브라우저 토큰으로"), 같은 날 저녁 v2 — 과제마다 폴더(별칭 → Job Id → 과제번호) · 연차 파일 · 예상비용.json, 참여연구원 자동 공유(shareWith),
 * 나와 공유 자동 찾기(discover), 변경이력(changesSync). plus 는 { enabled, folder, driveHost, researchSync, staffSync, planSync, changesSync, discover, shareWith } —
 * 옛 저장분의 connect · graph · onenoteMcpUrl · sectionName · notebookId · notebookLabel(과 0.8.0 개발 중의 sectionId · sectionLabel · planPageUrl)은 migrate 가 조용히 버리고 enabled·동기화 항목 체크는 이어받는다.
 * chrome 없이 돈다(load/save 는 부르지 않음). 실행: node tests/settings.test.js */
globalThis.self = globalThis;
const path = require('path');
const assert = require('assert');
require(path.join(__dirname, '..', 'lib/settings.js'));
const S = KRX_SETTINGS;
let n = 0, failed = 0;
const test = (name, fn) => { try { fn(); n++; console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n   ', e.stack || e.message); process.exitCode = 1; } };

const OLD_KEYS = ['connect', 'graph', 'onenoteMcpUrl', 'sectionName', 'notebookId', 'notebookLabel', 'sectionId', 'sectionLabel', 'planPageUrl'];
const PLUS = { enabled: false, folder: '', driveHost: 'https://krclass-my.sharepoint.com', researchSync: true, staffSync: true, planSync: true, changesSync: true, sitesSync: true, discover: true, shareWith: 'participants', projectSync: true, scope: 'all', projects: [], sitesScope: 'all', sitesProjects: [] };

test('DEFAULTS.plus — 공유 폴더 기본(비움 = 내 OneDrive 의 문서/업무/shared) · driveHost · 네 동기화 체크 · 자동 찾기 · 참여연구원 자동 공유, 원노트·MCP·Entra 칸은 없음', () => {
  assert.deepStrictEqual(S.DEFAULTS.plus, PLUS);
  for (const k of OLD_KEYS) assert.ok(!(k in S.DEFAULTS.plus), `DEFAULTS.plus 에 ${k} 없음`);
});
test('새 설치(plus 없음) · 빈 저장분 → 기본값, plus 는 DEFAULTS 를 공유하지 않음', () => {
  for (const stored of [{}, null, undefined, { plus: {} }, { plus: null }, { plus: 'x' }]) {
    const s = S.fromStored(stored);
    assert.deepStrictEqual(s.plus, S.DEFAULTS.plus, `stored ${JSON.stringify(stored)}`);
    assert.notStrictEqual(s.plus, S.DEFAULTS.plus, 'plus 는 DEFAULTS 를 공유하지 않음');
  }
  assert.deepStrictEqual(S.DEFAULTS.plus, PLUS, 'migrate 가 DEFAULTS 를 바꾸지 않음');
});
test('0.8.6 이하(원노트 MCP) 저장분 — 켜 둔 것·동기화 항목 체크는 이어받고 MCP 주소·섹션·노트북은 버림', () => {
  const s = S.fromStored({ plus: { enabled: true, onenoteMcpUrl: 'http://127.0.0.1:5005/mcp', sectionName: 'RERP', notebookId: 'nb1', notebookLabel: 'AIPWork', planSync: false, sectionId: 'old', sectionLabel: 'x', planPageUrl: 'u' } });
  assert.deepStrictEqual(s.plus, Object.assign({}, PLUS, { enabled: true, planSync: false }));
});
test('0.8.7 개발 중(Microsoft 로그인 connect · graph) 저장분 — connect · graph 를 버림', () => {
  const s = S.fromStored({ plus: { enabled: true, connect: 'direct', graph: { clientId: 'app-1', tenantId: 't-1' }, onenoteMcpUrl: 'http://localhost:5005/mcp', researchSync: false } });
  assert.deepStrictEqual(s.plus, Object.assign({}, PLUS, { enabled: true, researchSync: false }));
  for (const k of OLD_KEYS) assert.ok(!(k in s.plus), `${k} 없음`);
});
test('0.8.7 v1(문서/RERP 의 <과제번호>.json) 저장분 — 새 칸(changesSync · discover · shareWith)은 기본값으로 채워짐', () => {
  const s = S.fromStored({ plus: { enabled: true, folder: '', driveHost: 'https://krclass-my.sharepoint.com', researchSync: true, staffSync: false, planSync: true } });
  assert.deepStrictEqual(s.plus, Object.assign({}, PLUS, { enabled: true, staffSync: false }));
});
test('folder 는 그대로(다듬기는 쓰는 쪽) · 문자열이 아니면 빈 값 · driveHost 는 비면 기본값', () => {
  const url = 'https://krclass.sharepoint.com/sites/AIP/Shared Documents/RERP';
  assert.strictEqual(S.fromStored({ plus: { folder: ` ${url} ` } }).plus.folder, ` ${url} `);
  for (const folder of [null, 3, {}, ['a'], true]) assert.strictEqual(S.fromStored({ plus: { folder } }).plus.folder, '', `folder ${JSON.stringify(folder)}`);
  for (const driveHost of ['', '  ', null, 7]) assert.strictEqual(S.fromStored({ plus: { driveHost } }).plus.driveHost, S.DEFAULTS.plus.driveHost, `driveHost ${JSON.stringify(driveHost)}`);
  assert.strictEqual(S.fromStored({ plus: { driveHost: 'https://other-my.sharepoint.com' } }).plus.driveHost, 'https://other-my.sharepoint.com');
});
test('v1(2026-10-18 낮) 기본 밑폴더 — 내 OneDrive 의 문서/RERP 주소가 공유 폴더 칸에 남아 있으면 비운다(= 문서/업무/shared); 팀 사이트·다른 이름·업무/shared 는 그대로', () => {
  const my = 'https://krclass-my.sharepoint.com/personal/kimghw_krs_co_kr';
  for (const folder of [`${my}/Documents/RERP`, `${my}/Documents/RERP/`, ` ${my}/Documents/RERP `, `${my}/Documents/rerp`, `${my}/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fkimghw%5Fkrs%5Fco%5Fkr%2FDocuments%2FRERP&view=0`, `${my}/Documents/RERP%2F`]) {
    assert.strictEqual(S.isV1Base(folder), true, `isV1Base ${folder}`);
    assert.strictEqual(S.fromStored({ plus: { enabled: true, folder } }).plus.folder, '', `folder ${folder}`);
  }
  for (const folder of ['', 'https://krclass.sharepoint.com/sites/AIP/Shared Documents/RERP', `${my}/Documents/RERP2`, `${my}/Documents/RERP/과제A`, `${my}/Documents/업무/shared`, `${my}/Documents`, 'https://krclass-my.sharepoint.com/personal/other_krs_co_kr/Documents/업무/shared', '안녕', 'https://onedrive.live.com/RERP']) {
    assert.strictEqual(S.isV1Base(folder), false, `isV1Base ${folder}`);
    assert.strictEqual(S.fromStored({ plus: { folder } }).plus.folder, folder, `folder ${folder}`);
  }
  const stored = { plus: { enabled: true, folder: `${my}/Documents/RERP` } };
  S.fromStored(stored);
  assert.strictEqual(stored.plus.folder, `${my}/Documents/RERP`, '입력을 바꾸지 않는다');
});
test('enabled · 동기화 항목은 저장분 그대로', () => {
  assert.deepStrictEqual([S.fromStored({ plus: { enabled: false } }).plus.enabled, S.fromStored({ plus: { enabled: true } }).plus.enabled], [false, true]);
  const s = S.fromStored({ plus: { planSync: false, researchSync: false, staffSync: false, changesSync: false } });
  assert.deepStrictEqual([s.plus.planSync, s.plus.researchSync, s.plus.staffSync, s.plus.changesSync], [false, false, false, false]);
});
test('shareWith 는 participants | none 만, discover · changesSync 는 참/거짓만 — 그 밖의 값은 기본값', () => {
  assert.strictEqual(S.fromStored({ plus: { shareWith: 'none' } }).plus.shareWith, 'none');
  assert.strictEqual(S.fromStored({ plus: { shareWith: 'participants' } }).plus.shareWith, 'participants');
  for (const v of ['', 'all', 1, true, null, {}]) assert.strictEqual(S.fromStored({ plus: { shareWith: v } }).plus.shareWith, 'participants', `shareWith ${JSON.stringify(v)}`);
  assert.deepStrictEqual([S.fromStored({ plus: { discover: false } }).plus.discover, S.fromStored({ plus: { changesSync: false } }).plus.changesSync], [false, false]);
  for (const v of ['', 'yes', 1, 0, null, {}]) {
    assert.strictEqual(S.fromStored({ plus: { discover: v } }).plus.discover, true, `discover ${JSON.stringify(v)}`);
    assert.strictEqual(S.fromStored({ plus: { changesSync: v } }).plus.changesSync, true, `changesSync ${JSON.stringify(v)}`);
  }
});
test('공유할 과제 — scope 는 all | pick 만(그 밖은 all), projects 는 다듬은 과제번호(중복·빈 값 뺌), projectSync 는 참/거짓만', () => {
  assert.strictEqual(S.fromStored({ plus: { scope: 'pick' } }).plus.scope, 'pick');
  for (const v of ['', 'some', 1, true, null, {}]) assert.strictEqual(S.fromStored({ plus: { scope: v } }).plus.scope, 'all', `scope ${JSON.stringify(v)}`);
  assert.deepStrictEqual(S.fromStored({ plus: { projects: [' 2026-0063-01 ', '', null, '2026-0063-01', 7] } }).plus.projects, ['2026-0063-01', '7']);
  assert.deepStrictEqual(S.fromStored({ plus: { projects: 'x' } }).plus.projects, []);
  assert.strictEqual(S.fromStored({ plus: { projectSync: false } }).plus.projectSync, false);
  assert.strictEqual(S.fromStored({ plus: { projectSync: 0 } }).plus.projectSync, true);
  const a = S.fromStored({}), b = S.fromStored({});
  a.plus.projects.push('X');
  assert.deepStrictEqual([b.plus.projects, S.DEFAULTS.plus.projects], [[], []], 'DEFAULTS 의 배열을 같이 쓰지 않는다');
});
test('가맹점을 공유할 과제 — sitesScope 는 all | pick 만, sitesProjects 는 다듬은 과제번호, sitesPick 은 고른 과제만이면 그 목록 · 아니면 null, 과제별 공유의 scope 와 따로', () => {
  const s = S.fromStored({ plus: { sitesScope: 'pick', sitesProjects: [' A ', 'A', '', 'B'], scope: 'all' } }).plus;
  assert.deepStrictEqual([s.sitesScope, s.sitesProjects, s.scope], ['pick', ['A', 'B'], 'all']);
  for (const v of ['', 'x', null, 1]) assert.strictEqual(S.fromStored({ plus: { sitesScope: v } }).plus.sitesScope, 'all', `sitesScope ${JSON.stringify(v)}`);
  assert.deepStrictEqual(S.fromStored({ plus: { sitesProjects: 'A' } }).plus.sitesProjects, []);
  assert.deepStrictEqual([S.sitesPick({ sitesScope: 'pick', sitesProjects: ['A'] }), S.sitesPick({ sitesScope: 'pick' }), S.sitesPick({ sitesScope: 'all', sitesProjects: ['A'] }), S.sitesPick(null)], [['A'], [], null, null]);
  assert.strictEqual(S.sitesPick({ scope: 'pick', projects: ['A'] }), null, '과제별 공유의 고른 과제와 섞지 않는다');
  const a = S.fromStored({}), b = S.fromStored({});
  a.plus.sitesProjects.push('X');
  assert.deepStrictEqual([b.plus.sitesProjects, S.DEFAULTS.plus.sitesProjects], [[], []]);
});
test('sharePick · sharesProject — 전체면 null · 모든 과제, 고른 과제면 그 목록만, 공유 꺼짐·과제별 꺼짐이면 아무 과제도', () => {
  assert.strictEqual(S.sharePick({ scope: 'all', projects: ['A'] }), null);
  assert.deepStrictEqual(S.sharePick({ scope: 'pick', projects: ['A'] }), ['A']);
  assert.deepStrictEqual(S.sharePick({ scope: 'pick' }), []);
  assert.strictEqual(S.sharePick(null), null);
  assert.deepStrictEqual(['A', 'B'].map((p) => S.sharesProject({ enabled: true, scope: 'all' }, p)), [true, true]);
  assert.deepStrictEqual(['A', 'B'].map((p) => S.sharesProject({ enabled: true, scope: 'pick', projects: ['A'] }, p)), [true, false]);
  assert.deepStrictEqual([S.sharesProject({ enabled: false, scope: 'all' }, 'A'), S.sharesProject({ enabled: true, projectSync: false }, 'A'), S.sharesProject(null, 'A')], [false, false, false]);
});
test('입력을 바꾸지 않는다 · 다른 migrate 는 그대로(actionSidePanel 버림)', () => {
  const stored = { plus: { enabled: true, sectionId: 'old', sectionLabel: 'x', connect: 'mcp' }, actionSidePanel: true };
  const s = S.fromStored(stored);
  assert.deepStrictEqual(stored, { plus: { enabled: true, sectionId: 'old', sectionLabel: 'x', connect: 'mcp' }, actionSidePanel: true });
  assert.deepStrictEqual(['sectionId' in s.plus, 'connect' in s.plus, 'actionSidePanel' in s, s.plus.enabled], [false, false, false, true]);
});
test('MIG-09 rndUrl — 이전 기본값(레이아웃 GET, ERP 자체 비밀번호 변경 창이 뜰 수 있음)은 SSO 진입 페이지로, 사용자가 바꾼 주소는 그대로', () => {
  const SSO = 'https://rnd.krs.co.kr/jsp/rderp/main/sso_login_krs_view.jsp?SSO_PAGE_GB=A';
  assert.strictEqual(S.DEFAULTS.rndUrl, SSO);
  assert.strictEqual(S.fromStored({}).rndUrl, SSO);
  for (const old of ['https://rnd.krs.co.kr/rderp_layoutMain.act', ' http://rnd.krs.co.kr/rderp_layoutMain.act/ ']) assert.strictEqual(S.fromStored({ rndUrl: old }).rndUrl, SSO, old);
  for (const mine of ['https://rnd.krs.co.kr/rderp_layoutMain.act#krext=x', 'https://rnd.krs.co.kr/rmain_0002_01.act']) assert.strictEqual(S.fromStored({ rndUrl: mine }).rndUrl, mine, mine);
});
console.log(`\n${n} passed${failed ? `, ${failed} failed` : ''}`);
