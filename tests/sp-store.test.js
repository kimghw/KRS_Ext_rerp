/* lib/sp-store.js (확장 Plus — SharePoint(OneDrive) 폴더 저장소, 0.8.7) 테스트: parseFolder 네 모양(폴더 주소 · onedrive.aspx?id= · AllItems.aspx?id= · 퍼센트 인코딩)과 badurl, 한글 폴더·파일 이름 왕복, folderUrl('#' 왕복),
 * resolveMyFolder(webUrl → /RERP · PersonalUrl 대체 · auth · offline), resolveFolder 의 공유 링크 redirect 풀기, listFiles 모양·nofolder(404 · Exists:false), readFile 200/404/로그인 redirect→auth · checkedOut/checkedOutByMe,
 * writer.modify 네 경로(없으면 생성 / 바뀌면 체크아웃·PUT·체크인 / 안 바뀌면 UndoCheckOut / 남이 잡으면 locked) + 동료가 먼저 만든 경쟁, 끊긴 체크아웃 이어받기(안 바뀌어도 CheckIn · discard 면 UndoCheckOut · 체크인 실패 뒤 다음 쓰기가 체크인),
 * "체크아웃 필수" 문서함(Files/add 뒤 CheckIn), 다이제스트 만료(403 security validation → 다시 받아 한 번 더 · TTL 지나면 미리 다시), ensureFolder, close 가 창을 닫는지, sweepWorkers 가 남은 작업 창만 닫는지,
 * v2 폴더 트리(2026-10-18 저녁 "업무/shared 안에 과제별로 … 참여연구원들에게 공유"): listFolders(모양 · Forms 제외 · Exists 규칙) · childCfg · writer.ensurePath(여러 단 — 문서함 뿌리 위로는 안 올라감) · sharedWithMe(nextLink 2쪽 · 폴더/파일 · cfg 는 폴더 주소가 풀릴 때만) ·
 * writer.sharePeople(피커 — 표시 이름이 꼭 같은 1명만, 1명이어도 이름이 다르면 ambiguous, 여럿/0명 · ShareObject 호출 모양 — odata=verbose · roleValue · peoplePickerInput JSON 문자열 · StatusCode≠0 → 한 명씩) · writer.orgLink(ShareLink → 실패 시 CreateOrganizationSharingLink) · writer.rename(MoveTo → MoveToUsingPath) ·
 * writer.at(같은 사이트의 다른 폴더 — 같은 작업 창·다이제스트, close 는 no-op, 사이트 밖은 badurl),
 * 참여연구원 자료 요청(0.8.9): writer.createList(목록 · 칸(영문 내부 이름 · 한글 표시 이름 · 기본값) · 기본 보기 · 자기 항목만 · 있으면 빠진 칸만 · 다이제스트 거부 뒤 다시) · listItems(Author 펼침 · 404 notfound) · recycleList · 목록 경로 sharePeople(메일 알림 옵션),
 * 쿠키·다이제스트·피커 Key 값이 결과에 없는지, 페이지 함수가 바깥 변수를 쓰지 않는지. 가짜 fetch(메모리 폴더·파일(체크인 글 text · 체크아웃 초안 draft) · 요청 기록 · 다이제스트 검사 · 피커/공유/링크 끝점)·가짜 chrome(executeScript 는 func 를 실제로 호출해 가짜 fetch 위에서 돌림)만 쓴다 — 실 SharePoint 에 쓰지 않는다.
 * 실행: node tests/sp-store.test.js */
globalThis.self = globalThis;
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..');
require(path.join(root, 'lib/sp-store.js'));
const SP = KRX_SP;
let n = 0, failed = 0;
const test = async (name, fn) => { try { await fn(); n++; console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n   ', e.stack || e.message); process.exitCode = 1; } };
const rejects = async (p, kind, re) => { try { await p; } catch (e) { assert.strictEqual(e.kind, kind, `kind ${e.kind} ≠ ${kind}: ${e.message}`); if (re) assert.ok(re.test(e.message), `메시지 "${e.message}" 가 ${re} 에 안 맞음`); return e; } throw new Error(`오류(${kind})가 나야 하는데 성공함`); };
const throws = (fn, kind, re) => { try { fn(); } catch (e) { assert.strictEqual(e.kind, kind, `kind ${e.kind} ≠ ${kind}: ${e.message}`); if (re) assert.ok(re.test(e.message), `메시지 "${e.message}" 가 ${re} 에 안 맞음`); return e; } throw new Error(`오류(${kind})가 나야 하는데 성공함`); };

const ORIGIN = 'https://krclass-my.sharepoint.com';
const ME_PATH = '/personal/kimghw_krs_co_kr/Documents';
const RERP = `${ME_PATH}/RERP`;              // 시험용 폴더(이름은 아무것이어도 됨 — v1 때의 이름을 그대로 둠)
const BASE = `${ME_PATH}/업무/shared`;       // 설정 folder 가 비었을 때의 기본 밑폴더(DEFAULT_FOLDER_NAME, 두 단) — background.js SHARE_BASE_NAME 과 같음
const ME = 7;
const COOKIE = 'FedAuth=SECRET-COOKIE-VALUE-77';
const DIGEST = '0xDIGEST-SECRET-ABC,18 Oct 2026 00:00:00 -0000';

/* 가짜 SharePoint: 메모리 폴더·파일 + REST 끝점. o = { folders:[경로], files:{ 경로:{ 이름: 내용 } }, loggedIn, drive(404 면 v2.0 drive 없음), deny403, failPut, failCheckIn(한 번 500), shareDest, raceCreate,
 *   checkedOutBy:{ 이름: 사용자 Id }, drafts:{ 이름: 초안 }(내가 잡은 체크아웃에 올라가 있던 글), requireCheckout("체크아웃 필수" 문서함 — Files/add 가 파일을 내 체크아웃·판 0 으로 둠),
 *   people:{ 검색어: [피커 항목] }(clientPeoplePickerSearchUser), shareFailEmails:[이메일](그 사람이 든 ShareObject 는 StatusCode 1), shareHttp(ShareObject 가 늘 이 HTTP 상태), noShareLink(ShareLink 400), noOrgLink(CreateOrganizationSharingLink 400),
 *   noMoveTo(MoveTo 404 → MoveToUsingPath 로), shared:[{ value:[항목] } …](sharedWithMe 쪽들 — $skiptoken 으로 다음 쪽), noShared(sharedWithMe 404),
 *   perms:{ 폴더 경로: [{ id, type(1 사용자 · 8 그룹), title, email, login, roles:[{ id, name, kind, hidden }] }] }(권한 — permissions · unshare; ShareObject 가 성공하면 그 폴더에 사람을 더함), search:{ 질문: [{ title, email, login }] }(search REST People 줄), searchVerbose(verbose 모양으로 답함) }
 * 파일 = { text(체크인된 글), draft(체크아웃 중 PUT 한 글 — 주인에게만 $value 로 보임), version(0 = 체크인된 판 없음 — UndoCheckOut 이 파일을 지움), checkedOutBy }
 * 다이제스트: contextinfo 마다 새 값을 내고(st.validDigests), F.expire() 뒤 옛 값으로 쓰면 403 + "security validation" 본문(실 SharePoint 의 -2130575251). st.calls = [메서드, 짧은 경로(폴더/파일은 디코딩한 서버 상대 경로)]
 * st.pickerBodies · st.shareBodies · st.linkBodies = [{ headers, body }](받은 요청 그대로 — 호출 모양 검사용), st.shares = [{ url, roleValue, emails }](성공한 공유), st.unshares = [[폴더, principalId, roleId]](거둔 역할), st.searchUrls(사람 찾기 요청 주소) */
function fakeSp(o) {
  o = o || {};
  const st = { folders: {}, calls: [], digestIssued: 0, validDigests: new Set(), cookie: COOKIE, loggedIn: o.loggedIn !== false, pickerBodies: [], shareBodies: [], linkBodies: [], shares: [], unshares: [], searchUrls: [], perms: JSON.parse(JSON.stringify(o.perms || {})), nextPrincipal: 5000, lists: {}, nextList: 0, listBodies: [], itemUrls: [] };
  const LIST_ID = 'aaaabbbb-0000-0000-0000-000000000001', ITEM_ID = 42;
  let seq = 0;
  const mkFile = (text) => ({ text, draft: null, version: 1, checkedOutBy: null, uniqueId: `${String(++seq).padStart(8, '0')}-0000-0000-0000-00000000ABCD`, modified: '2026-10-18T01:02:03Z' });
  const addFolder = (p) => { st.folders[p] = st.folders[p] || { files: {} }; return st.folders[p]; };
  for (const p of o.folders || []) addFolder(p);
  for (const [p, files] of Object.entries(o.files || {})) for (const [name, text] of Object.entries(files)) addFolder(p).files[name] = mkFile(text);
  for (const [name, who] of Object.entries(o.checkedOutBy || {})) for (const f of Object.values(st.folders)) if (f.files[name]) f.files[name].checkedOutBy = who;
  for (const [name, draft] of Object.entries(o.drafts || {})) for (const f of Object.values(st.folders)) if (f.files[name]) f.files[name].draft = draft;
  for (const l of o.lists || []) st.lists[l.id] = Object.assign({ title: '', description: '', path: `/personal/kimghw_krs_co_kr/Lists/${l.title}`, fields: [{ InternalName: 'Title', Title: 'Title', Description: '', DefaultValue: null, kind: 2 }], viewFields: ['LinkTitle'], readSecurity: 1, writeSecurity: 1, items: [] }, l);   // 미리 있는 목록(참여연구원 자료 요청)
  const json = (obj, status, url) => ({ ok: (status || 200) >= 200 && (status || 200) < 300, status: status || 200, url: url || '', json: async () => obj, text: async () => JSON.stringify(obj) });
  const text = (s, status) => ({ ok: (status || 200) >= 200 && (status || 200) < 300, status: status || 200, url: '', json: async () => { throw new Error('not json'); }, text: async () => s });
  const login = () => ({ ok: true, status: 200, url: 'https://login.microsoftonline.com/common/oauth2/authorize?x=1', json: async () => ({}), text: async () => '<html>login</html>' });
  const dec = (lit) => decodeURIComponent(lit).replace(/''/g, "'");
  const LIT = "([^']*(?:''[^']*)*)";
  const fetch = async (url, init) => {
    init = init || {};
    const m = String(init.method || 'GET').toUpperCase();
    const u = String(url);
    const H = init.headers || {};
    assert.strictEqual(init.credentials, 'include', `쿠키로 요청해야: ${m} ${u}`);
    if (!st.loggedIn) { st.calls.push([m, 'login-redirect']); return login(); }
    if (/^https:\/\/[^/]+\/:[a-z]:\//.test(u)) {   // 공유 링크 → redirect 끝 주소
      st.calls.push([m, 'share', init.redirect]);
      if (o.shareDest === 'login') return login();
      return json({}, 200, o.shareDest || `${ORIGIN}/personal/kimghw_krs_co_kr/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fkimghw%5Fkrs%5Fco%5Fkr%2FDocuments%2FRERP&view=0`);
    }
    if (u === `${ORIGIN}/_api/v2.0/me/drive`) { st.calls.push([m, 'me/drive']); if (o.deny403) return json({}, 403); return o.drive === 404 ? json({ error: 'nope' }, 404) : json({ id: 'b!xyz', webUrl: `${ORIGIN}${ME_PATH}` }); }
    if (u.startsWith(`${ORIGIN}/_api/SP.UserProfiles.PeopleManager/GetMyProperties`)) { st.calls.push([m, 'GetMyProperties']); return json({ PersonalUrl: `${ORIGIN}/personal/kimghw_krs_co_kr/` }); }
    const am = /^(https:\/\/[^/]+)((?:\/(?:sites|teams|personal)\/[^/]+)?)\/_api\/(.*)$/.exec(u);
    if (!am) { st.calls.push([m, u]); return text('nope', 404); }
    const rest = am[3];
    if (rest.startsWith('v2.0/me/drive/sharedWithMe')) {   // "나와 공유" — 쪽은 $skiptoken=<쪽 번호>
      const idx = Number(new URL(u).searchParams.get('$skiptoken') || 0);
      st.calls.push([m, `sharedWithMe#${idx}`]);
      if (o.deny403) return json({}, 403);
      if (o.noShared) return json({ error: 'nope' }, 404);
      const pages = o.shared || [{ value: [] }];
      const page = pages[idx] || { value: [] };
      const r = { value: page.value };
      if (idx + 1 < pages.length) r['@odata.nextLink'] = `${ORIGIN}/_api/v2.0/me/drive/sharedWithMe?$skiptoken=${idx + 1}`;
      return json(r);
    }
    if (rest === 'contextinfo') {
      st.calls.push([m, 'contextinfo']); if (o.deny403) return json({}, 403); if (m !== 'POST') return json({}, 405);
      const d = `${DIGEST}#${++st.digestIssued}`; st.validDigests.add(d);
      return json({ FormDigestValue: d, FormDigestTimeoutSeconds: o.digestSec || 1800 });
    }
    if (rest.startsWith('web/currentuser')) { st.calls.push([m, 'currentuser']); return json({ Id: ME }); }
    if (rest.startsWith('search/query?')) {   // 사람 찾기(findPeople) — People 결과 원본, querytext 리터럴로 질문
      const qm = /querytext='([^']*)'/.exec(rest); const q = qm ? dec(qm[1]) : '';
      st.calls.push([m, `search(${q})`]); st.searchUrls.push(u);
      if (o.deny403) return json({}, 403);
      const rows = ((o.search || {})[q] || []).map((x) => ({ Cells: [{ Key: 'PreferredName', Value: x.title }, { Key: 'WorkEmail', Value: x.email || null }, { Key: 'AccountName', Value: x.login || (x.email ? `i:0#.f|membership|${x.email}` : '') }, { Key: 'Rank', Value: '1' }] }));
      if (o.searchVerbose) return json({ d: { query: { PrimaryQueryResult: { RelevantResults: { Table: { Rows: { results: rows.map((r) => ({ Cells: { results: r.Cells } })) } } } } } } });
      return json({ PrimaryQueryResult: { RelevantResults: { Table: { Rows: rows } } } });
    }
    const digestOk = st.validDigests.has(H['X-RequestDigest']);
    // 다이제스트가 없거나 틀리면 403. 우리가 냈던 값(만료)이면 실 SharePoint 처럼 "security validation" 본문
    const deny = () => (H['X-RequestDigest'] && String(H['X-RequestDigest']).startsWith(DIGEST) && !digestOk
      ? json({ 'odata.error': { code: '-2130575251, Microsoft.SharePoint.SPException', message: { lang: 'en-US', value: "The security validation for this page is invalid and might be corrupted. Please use your web browser's Back button to try your operation again." } } }, 403)
      : json({}, 403));
    const body = () => { try { return JSON.parse(init.body); } catch (e) { return null; } };
    const verbose = /odata=verbose/.test(String(H.Accept || ''));
    const children = (p) => Object.keys(st.folders).filter((k) => k.startsWith(`${p}/`) && !k.slice(p.length + 1).includes('/'));
    const moveFolder = (p, to) => { for (const k of Object.keys(st.folders)) if (k === p || k.startsWith(`${p}/`)) { st.folders[`${to}${k.slice(p.length)}`] = st.folders[k]; delete st.folders[k]; } };
    // 사람 찾기 · 공유 · 조직 내 링크(사이트 _api 바로 아래)
    if (rest === 'SP.UI.ApplicationPages.ClientPeoplePickerWebServiceInterface.clientPeoplePickerSearchUser') {
      st.calls.push([m, 'peoplePicker']);
      if (m !== 'POST' || !digestOk) return deny();
      const b = body(); st.pickerBodies.push({ headers: H, body: b });
      const q = b && b.queryParams && b.queryParams.QueryString;
      const entries = (o.people || {})[q] || [];
      return verbose ? json({ d: { ClientPeoplePickerSearchUser: JSON.stringify(entries) } }) : json({ value: JSON.stringify(entries) });
    }
    if (rest === 'SP.Web.ShareObject') {
      st.calls.push([m, 'ShareObject']);
      if (m !== 'POST' || !digestOk) return deny();
      const b = body(); st.shareBodies.push({ headers: H, body: b });
      let entries = []; try { entries = JSON.parse(b.peoplePickerInput); } catch (e) { return json({ 'odata.error': { message: { value: 'peoplePickerInput 이 JSON 문자열이 아님' } } }, 400); }
      const emails = entries.map((e) => e.EntityData && e.EntityData.Email);
      if (o.shareHttp) return json({ 'odata.error': { message: { value: 'ShareObject boom' } } }, o.shareHttp);
      const bad = emails.filter((e) => (o.shareFailEmails || []).includes(e));
      const wrap = (r) => (verbose ? json({ d: { ShareObject: r } }) : json(r));
      if (bad.length) return wrap({ StatusCode: 1, ErrorMessage: `초대할 수 없는 사용자: ${bad.join(', ')}`, InvitedUsers: null, UniquelyPermissionedUsers: { results: [] } });
      st.shares.push({ url: b.url, roleValue: b.roleValue, emails });
      // 폴더의 권한에도 남긴다(permissions 가 보게) — 같은 사람이면 역할을 더함
      const fp = decodeURIComponent(new URL(b.url).pathname);
      if (st.folders[fp]) {
        const role = b.roleValue === 'role:1073741826' ? { id: 1073741826, name: '읽기', kind: 2 } : { id: 1073741827, name: '참가', kind: 3 };
        const list = st.perms[fp] = st.perms[fp] || [];
        for (const e of entries) { const email = e.EntityData && e.EntityData.Email; let who = list.find((y) => y.email === email); if (!who) { who = { id: ++st.nextPrincipal, type: 1, title: e.DisplayText, email, roles: [] }; list.push(who); } if (!who.roles.some((r) => r.id === role.id)) who.roles.push(Object.assign({}, role)); }
      }
      return wrap({ StatusCode: 0, ErrorMessage: null, InvitedUsers: null, UniquelyPermissionedUsers: { results: emails.map((Email) => ({ Email, DisplayName: '', User: 'i:0#.f|membership|KEY-SECRET-x' })) } });
    }
    if (rest === 'SP.Web.CreateOrganizationSharingLink') {
      st.calls.push([m, 'CreateOrganizationSharingLink']);
      if (m !== 'POST' || !digestOk) return deny();
      const b = body(); st.linkBodies.push({ headers: H, body: b, at: 'CreateOrganizationSharingLink' });
      if (o.noOrgLink) return json({ 'odata.error': { message: { value: 'Sharing links are disabled by policy' } } }, 400);
      return json({ value: `${ORIGIN}/:f:/g/personal/kimghw_krs_co_kr/EFallback?e=${b && b.isEditLink ? 'edit' : 'view'}` });
    }
    // 목록(참여연구원 자료 요청 — createList · listItems · recycleList): st.lists[id] = { id, title, description, path, fields:[{ InternalName, Title, Description, DefaultValue, kind }], viewFields, readSecurity, writeSecurity, items }
    const listInfo = (l) => ({ Id: l.id, Title: l.title, DefaultNewFormUrl: `${l.path}/NewForm.aspx`, DefaultViewUrl: `${l.path}/AllItems.aspx`, RootFolder: { ServerRelativeUrl: l.path } });
    const listByTitle = (t) => Object.values(st.lists).find((l) => l.title === t);
    let xm = new RegExp(`^web/lists/getbytitle\\('${LIT}'\\)(.*)$`).exec(rest);
    if (xm) { const t = dec(xm[1]); st.calls.push([m, `list(${t})`]); if (o.deny403) return json({}, 403); const l = listByTitle(t); return l ? json(listInfo(l)) : json({ 'odata.error': { message: { value: 'List does not exist' } } }, 404); }
    if (rest === 'web/lists') {
      st.calls.push([m, 'lists']);
      if (m !== 'POST' || !digestOk) return deny();
      const b = body(); st.listBodies.push({ headers: H, body: b });
      if (!b || !b.__metadata || b.__metadata.type !== 'SP.List') return json({ 'odata.error': { message: { value: '__metadata.type 없음' } } }, 400);
      if (listByTitle(b.Title)) return json({ 'odata.error': { message: { value: 'A list with the specified title already exists' } } }, 400);
      const id = `11111111-2222-3333-4444-${String(++st.nextList).padStart(12, '0')}`;
      st.lists[id] = { id, title: b.Title, description: b.Description || '', path: `/personal/kimghw_krs_co_kr/Lists/${b.Title}`, fields: [{ InternalName: 'Title', Title: 'Title', Description: '', DefaultValue: null, kind: 2 }], viewFields: ['LinkTitle'], readSecurity: 1, writeSecurity: 1, items: [] };
      return json({ Id: id, Title: b.Title });
    }
    xm = new RegExp(`^web/lists\\(guid'${LIT}'\\)(.*)$`).exec(rest);
    if (xm) {
      const id = dec(xm[1]), tail = xm[2], l = st.lists[id];
      st.calls.push([m, `list#${id.slice(-3)}${tail.replace(/\?.*$/, '?')}`]);
      if (o.deny403) return json({}, 403);
      if (!l) return json({ 'odata.error': { message: { value: 'List does not exist' } } }, 404);
      const isMerge = m === 'POST' && H['X-HTTP-Method'] === 'MERGE';
      if (tail.startsWith('?$select=Id,Title,DefaultNewFormUrl')) return json(listInfo(l));
      if (tail === '' && isMerge) { if (!digestOk) return deny(); const b = body(); if (b.ReadSecurity != null) l.readSecurity = b.ReadSecurity; if (b.WriteSecurity != null) l.writeSecurity = b.WriteSecurity; return json({}, 204); }
      if (tail.startsWith('/fields?')) return json({ value: l.fields.map((f) => ({ InternalName: f.InternalName })) });
      if (tail === '/fields/addfield') { if (m !== 'POST' || !digestOk) return deny(); const b = body(); const pr = b && b.parameters; if (!pr || !pr.__metadata || pr.__metadata.type !== 'SP.FieldCreationInformation') return json({}, 400); if (l.fields.some((f) => f.InternalName === pr.Title)) return json({ 'odata.error': { message: { value: 'duplicate' } } }, 400); l.fields.push({ InternalName: pr.Title, Title: pr.Title, Description: '', DefaultValue: null, kind: pr.FieldTypeKind, required: !!pr.Required, choices: pr.Choices && Array.isArray(pr.Choices.results) ? pr.Choices.results.slice() : null }); return json({ InternalName: pr.Title, Title: pr.Title }); }
      let fx;
      if ((fx = new RegExp(`^/fields/getbyinternalnameortitle\\('${LIT}'\\)$`).exec(tail))) { if (!isMerge || !digestOk) return deny(); const f = l.fields.find((y) => y.InternalName === dec(fx[1])); if (!f) return json({}, 404); const b = body(); if (b.Title != null) f.Title = b.Title; if (b.Description != null) f.Description = b.Description; if (b.DefaultValue != null) f.DefaultValue = b.DefaultValue; if (b.Choices && Array.isArray(b.Choices.results)) f.choices = b.Choices.results.slice(); if (b.FillInChoice != null) f.fillIn = b.FillInChoice; if (b.EditFormat != null) f.editFormat = b.EditFormat; return json({}, 204); }
      if ((fx = new RegExp(`^/DefaultView/ViewFields/addViewField\\('${LIT}'\\)$`).exec(tail))) { if (m !== 'POST' || !digestOk) return deny(); l.viewFields.push(dec(fx[1])); return json({}, 200); }
      if (tail.startsWith('/items?')) { st.itemUrls.push(u); return json({ value: l.items }); }
      if (tail === '/recycle()') { if (m !== 'POST' || !digestOk) return deny(); delete st.lists[id]; return json('recycle-guid'); }
      return text('nope', 404);
    }
    let lm = /^web\/Lists\(guid'([^']+)'\)\/GetItemById\((\d+)\)\/ShareLink$/.exec(rest);
    if (lm) {
      st.calls.push([m, `ShareLink(${lm[1]},${lm[2]})`]);
      if (m !== 'POST' || !digestOk) return deny();
      const b = body(); st.linkBodies.push({ headers: H, body: b, at: 'ShareLink' });
      if (lm[1] !== LIST_ID || Number(lm[2]) !== ITEM_ID) return json({ 'odata.error': { message: { value: 'Item does not exist' } } }, 404);
      if (o.noShareLink) return json({ 'odata.error': { message: { value: 'ShareLink not supported here' } } }, 400);
      const kind = b && b.request && b.request.settings && b.request.settings.linkKind;
      return json({ sharingLinkInfo: { Url: `${ORIGIN}/:f:/g/personal/kimghw_krs_co_kr/EOrgLink${kind}?e=abc`, IsEditLink: kind === 3, LinkKind: kind } });
    }
    let fm = new RegExp(`^web/GetFolderByServerRelativePath\\(decodedurl='${LIT}'\\)(.*)$`).exec(rest);
    if (fm) {
      const p = dec(fm[1]), tail = fm[2];
      st.calls.push([m, `folder(${p})${tail}`]);
      const f = st.folders[p];
      if (tail.startsWith('?$select=Exists')) return json({ Exists: !!f, Name: p.slice(p.lastIndexOf('/') + 1) });   // 없는 폴더에도 200 + Exists:false (실측 2026-10-18)
      if (tail.startsWith('/Files?')) { if (!f) return json({}, 404); return json({ value: Object.entries(f.files).filter(([, x]) => x.version > 0 || x.checkedOutBy === ME).map(([Name, x]) => ({ Name, Length: String(x.text.length), TimeLastModified: x.modified, UIVersionLabel: `${x.version}.0`, UniqueId: x.uniqueId })) }); }
      if (tail.startsWith('/Folders?')) { if (!f) return json({}, 404); return json({ value: children(p).map((k) => ({ Name: k.slice(p.length + 1), ServerRelativeUrl: k, ItemCount: Object.keys(st.folders[k].files).length + children(k).length, TimeLastModified: '2026-10-18T03:04:05Z' })) }); }
      if (tail.startsWith('/ListItemAllFields?') && /RoleAssignments/.test(tail)) {   // 권한(permissions) — RoleAssignments(Member · RoleDefinitionBindings) 펼침
        if (!f) return json({ 'odata.error': { message: { value: 'File Not Found.' } } }, 404);
        if (o.deny403) return json({}, 403);
        const list = st.perms[p] || [];
        return json({ Id: ITEM_ID, HasUniqueRoleAssignments: list.length > 0, RoleAssignments: list.map((y) => ({ PrincipalId: y.id, Member: { Id: y.id, Title: y.title, Email: y.email || '', LoginName: y.login || (y.email ? `i:0#.f|membership|${y.email}` : y.title), PrincipalType: y.type || 1 }, RoleDefinitionBindings: y.roles.map((r) => ({ Id: r.id, Name: r.name || '', RoleTypeKind: r.kind, Hidden: !!r.hidden })) })) });
      }
      if (tail.startsWith('/ListItemAllFields?')) { if (!f) return json({ 'odata.error': { message: { value: 'File Not Found.' } } }, 404); return json({ Id: ITEM_ID, ParentList: { Id: LIST_ID } }); }
      let x;
      if ((x = /^\/ListItemAllFields\/RoleAssignments\/GetByPrincipalId\((\d+)\)\/RoleDefinitionBindings\?/.exec(tail))) {   // unshare 1단계 — 그 사람의 역할
        const who = (st.perms[p] || []).find((y) => y.id === Number(x[1]));
        if (!f || !who) return json({ 'odata.error': { message: { value: 'Item does not exist' } } }, 404);
        return json({ value: who.roles.map((r) => ({ Id: r.id, RoleTypeKind: r.kind, Hidden: !!r.hidden })) });
      }
      if ((x = /^\/ListItemAllFields\/RoleAssignments\/RemoveRoleAssignment\(principalid=(\d+),roledefid=(\d+)\)$/.exec(tail))) {   // unshare 2단계 — 역할 하나 거두기(다이제스트)
        if (m !== 'POST' || !digestOk) return deny();
        const list = st.perms[p] || []; const who = list.find((y) => y.id === Number(x[1]));
        if (!f || !who || !who.roles.some((r) => r.id === Number(x[2]))) return json({ 'odata.error': { message: { value: 'Item does not exist' } } }, 404);
        who.roles = who.roles.filter((r) => r.id !== Number(x[2])); if (!who.roles.length) list.splice(list.indexOf(who), 1);
        st.unshares.push([p, Number(x[1]), Number(x[2])]);
        return json({}, 200);
      }
      if ((x = new RegExp(`^/MoveTo\\(newUrl='${LIT}'\\)$`).exec(tail))) { if (m !== 'POST' || !digestOk) return deny(); if (!f) return json({}, 404); if (o.noMoveTo) return json({ 'odata.error': { message: { value: 'MoveTo 없음' } } }, 404); moveFolder(p, dec(x[1])); return json({}, 200); }
      if ((x = new RegExp(`^/MoveToUsingPath\\(DecodedUrl='${LIT}'\\)$`).exec(tail))) { if (m !== 'POST' || !digestOk) return deny(); if (!f) return json({}, 404); moveFolder(p, dec(x[1])); return json({}, 200); }
      if ((x = new RegExp(`^/Folders/add\\('${LIT}'\\)$`).exec(tail))) { if (m !== 'POST' || !digestOk) return deny(); if (!f) return json({}, 404); const name = dec(x[1]); addFolder(`${p}/${name}`); return json({ Name: name, Exists: true }); }
      if ((x = new RegExp(`^/Files/add\\(url='${LIT}',overwrite=(true|false)\\)$`).exec(tail))) {
        if (m !== 'POST' || !digestOk) return deny();
        if (!f) return json({}, 404);
        const name = dec(x[1]);
        if (o.raceCreate && !f.files[name]) { f.files[name] = mkFile(o.raceCreate); return json({ 'odata.error': { message: { value: 'exists' } } }, 400); }   // 그사이 동료가 만듦
        if (f.files[name] && x[2] !== 'true') return json({ 'odata.error': { message: { value: 'A file with the name already exists' } } }, 400);
        const nf = f.files[name] = mkFile(String(init.body));
        if (o.requireCheckout) { nf.draft = nf.text; nf.text = ''; nf.version = 0; nf.checkedOutBy = ME; }   // "체크아웃 필수" 문서함: 새 파일은 내 체크아웃 상태(판 0.1) — 남에게 안 보임
        return json({ Name: name, UniqueId: nf.uniqueId, UIVersionLabel: o.requireCheckout ? '0.1' : '1.0', CheckOutType: o.requireCheckout ? 0 : 2, Length: String((nf.draft || nf.text).length), TimeLastModified: nf.modified });
      }
      return text('nope', 404);
    }
    fm = new RegExp(`^web/GetFileByServerRelativePath\\(decodedurl='${LIT}'\\)(.*)$`).exec(rest);
    if (fm) {
      const full = dec(fm[1]), tail = fm[2];
      const i = full.lastIndexOf('/'); const p = full.slice(0, i), name = full.slice(i + 1);
      st.calls.push([m, `file(${full})${tail}`]);
      const f = st.folders[p]; const file = f && f.files[name];
      if (!file) return json({ 'odata.error': { message: { value: 'File Not Found.' } } }, 404);
      const meta = () => ({ Exists: true, CheckOutType: file.checkedOutBy == null ? 2 : 0, UniqueId: file.uniqueId, UIVersionLabel: `${file.version}.0`, Length: String(file.text.length), TimeLastModified: file.modified });
      if (tail.startsWith('?$select')) return json(meta());
      if (tail.startsWith('/CheckedOutByUser')) return json({ Id: file.checkedOutBy, Email: 'other@krs.co.kr', Title: '다른 사람' });
      if (tail === '/CheckOut()') { if (m !== 'POST' || !digestOk) return deny(); if (file.checkedOutBy != null && file.checkedOutBy !== ME) return json({}, 423); file.checkedOutBy = ME; return json({}, 200); }
      if (tail === '/UndoCheckOut()') { if (m !== 'POST' || !digestOk) return deny(); file.checkedOutBy = null; file.draft = null; if (file.version === 0) delete f.files[name]; return json({}, 200); }   // 체크인된 판이 없는 파일은 되돌리면 사라진다
      if (tail.startsWith('/CheckIn(')) {
        if (m !== 'POST' || !digestOk) return deny();
        if (o.failCheckIn) { o.failCheckIn = false; return json({}, 500); }
        const cm = /comment='(.*)',checkintype=1\)$/.exec(tail); file.lastComment = dec(cm[1]);
        if (file.draft != null) file.text = file.draft; file.draft = null; file.checkedOutBy = null; file.version++; file.modified = '2026-10-18T02:00:00Z'; return json({}, 200);
      }
      if (tail === '/recycle()') { if (m !== 'POST' || !digestOk) return deny(); delete f.files[name]; return json('recycle-guid'); }
      if (tail === '/$value') {
        if (m === 'GET') return text(file.checkedOutBy === ME && file.draft != null ? file.draft : file.text);   // 주인에게는 초안, 남에게는 지난 판
        if (m === 'PUT') { if (!digestOk) return deny(); if (o.failPut) return json({}, 500); if (file.checkedOutBy !== ME) return json({}, 423); file.draft = String(init.body); return { ok: true, status: 204, url: '', json: async () => null, text: async () => '' }; }
      }
      return text('nope', 404);
    }
    st.calls.push([m, rest]);
    return text('nope', 404);
  };
  return { st, fetch, file: (p, name) => st.folders[p] && st.folders[p].files[name], expire: () => st.validDigests.clear() };
}

/* 가짜 chrome: windows.create 로 창·탭 하나, executeScript 는 func 를 이 프로세스에서 globalThis.fetch 를 가짜로 바꿔 실행. o = { landing(탭이 멈춘 주소), failOpen, noTabs }
 *   tabs.query 는 windowId 와 url(매치 패턴 — * 만 받음) 로 고른다. addWindow(urls) 로 미리 열린 창을 흉내 낸다(sweepWorkers) */
function fakeChrome(fetch, o) {
  o = o || {};
  const log = [];
  const windows = {};
  let nextId = 10;
  const allTabs = () => Object.values(windows).flatMap((w) => w.tabs);
  const matches = (pattern, url) => new RegExp(`^${String(pattern).split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`).test(String(url || ''));
  const c = {
    log, windows_: windows,
    windows: {
      create: async (opts) => {
        if (o.failOpen) throw new Error('창 없음');
        const id = ++nextId; const tab = { id: ++nextId, windowId: id, url: o.landing || opts.url, status: 'complete' };
        windows[id] = { tabs: [tab] };
        log.push(['create', opts.state, opts.focused, opts.url]);
        return { id, tabs: o.noTabs ? undefined : [tab] };
      },
      remove: async (id) => { log.push(['windows.remove', id]); delete windows[id]; }
    },
    tabs: {
      get: async (id) => { const t = allTabs().find((x) => x.id === id); if (!t) throw new Error('No tab with id'); return t; },
      query: async (q) => allTabs().filter((t) => (q.windowId == null || t.windowId === q.windowId) && (q.url == null || matches(q.url, t.url))),
      update: async (id, p) => { log.push(['update', id, JSON.stringify(p)]); },
      remove: async (id) => { log.push(['tabs.remove', id]); for (const w of Object.values(windows)) w.tabs = w.tabs.filter((t) => t.id !== id); }
    },
    addWindow: (urls) => { const id = ++nextId; windows[id] = { tabs: urls.map((url) => ({ id: ++nextId, windowId: id, url, status: 'complete' })) }; return { id, tabIds: windows[id].tabs.map((t) => t.id) }; },
    scripting: {
      executeScript: async ({ target, world, func, args }) => {
        log.push(['run', func.name, world, target.frameIds.join()]);
        const orig = globalThis.fetch; globalThis.fetch = fetch;
        try { return [{ result: await func(...(args || [])) }]; } finally { globalThis.fetch = orig; }
      }
    },
    addTab: (windowId) => { windows[windowId].tabs.push({ id: ++nextId, windowId, url: 'https://other.example/', status: 'complete' }); }
  };
  return c;
}
const calls = (F, from) => F.st.calls.slice(from || 0).map((c) => c.join(' '));
const CFG = SP.parseFolder(`${ORIGIN}${RERP}`);
/* 피커 항목(clientPeoplePickerSearchUser 가 주는 모양). Key 는 로그인 이름 — 결과·기록에 새면 안 되는 값이라 KEY-SECRET 표식을 넣는다 */
const person = (name, email) => ({ Key: `i:0#.f|membership|KEY-SECRET-${email}`, DisplayText: name, EntityType: 'User', IsResolved: true, Description: email, EntityData: { Email: email, Title: '연구원', Department: 'R&D', PrincipalType: 'User' } });
const PEOPLE = {
  '문창재': [person('문창재', 'moon@krs.co.kr')],                                                    // 1명
  '김철수': [person('김철수', 'kim1@krs.co.kr'), person('김철수(해양)', 'kim2@krs.co.kr')],            // 여럿 — 표시 이름이 꼭 같은 1명
  '이영희': [person('이영희 (연구)', 'lee1@krs.co.kr'), person('이영희 (기획)', 'lee2@krs.co.kr')],   // 여럿 — 꼭 같은 이름 없음 → ambiguous
  '박보람': [person('박보람', 'park1@krs.co.kr'), person('박보람', 'park2@krs.co.kr')],              // 동명이인 → ambiguous
  '이영': [person('이영희', 'lee1@krs.co.kr')],                                                       // 1명이지만 이름이 다름(접두 일치 — 디렉터리에 없는 이름) → ambiguous
  '홍길동': [person('홍 길동', 'hong@krs.co.kr')],                                                    // 공백만 다름 → 같은 이름으로 봄
  '없는사람': [],
  'moon@krs.co.kr': [person('MOON Changjae', 'moon@krs.co.kr')],                                      // 이메일로 물음(2026-10-19) — 표시 이름이 영문이라도 이메일이 같은 1명
  'kim@krs.co.kr': [person('김철수', 'kim1@krs.co.kr')]                                               // 이메일로 물었는데 이메일이 다른 1명 → ambiguous
};
/* 권한(permissions · unshare)의 가짜 폴더 — 실측(2026-10-19) 모양: 제한된 액세스 시스템 그룹 · 사람(참가 3 / 읽기 2 / 모든 권한 5 / 편집 6) · 제한된 액세스만 있는 사람 · 조직 내 링크 그룹 · 나(ME) */
const PERM_FOLDER = `${BASE}/과제A`;
const PERMS = { [PERM_FOLDER]: [
  { id: 14, type: 8, title: 'Limited Access System Group For List 3051a4ff', roles: [{ id: 1073741825, name: '제한된 액세스', kind: 1, hidden: true }] },
  { id: 1909, type: 1, title: 'MOON Changjae', email: 'moon@krs.co.kr', roles: [{ id: 1073741827, name: '참가', kind: 3 }] },
  { id: 1944, type: 1, title: 'LEE Jaehoon', email: 'jhlee81@krs.co.kr', roles: [{ id: 1073741826, name: '읽기', kind: 2 }, { id: 1073741825, name: '제한된 액세스', kind: 1, hidden: true }] },
  { id: 2040, type: 1, title: 'ROH Gilltae', email: '', login: 'i:0#.f|membership|gtroh@krs.co.kr', roles: [{ id: 1073741829, name: '모든 권한', kind: 5 }, { id: 1073741827, name: '참가', kind: 3 }] },
  { id: 2411, type: 1, title: 'YOON Sewoong', email: 'swyoon@krs.co.kr', roles: [{ id: 1073741825, name: '제한된 액세스', kind: 1, hidden: true }] },
  { id: 3478, type: 8, title: 'SharingLinks.70ebcbd6-e7ab-4052-b4c3-7bd3ed3f1648.OrganizationEdit.a30f6b6c', roles: [{ id: 1073741827, name: '참가', kind: 3 }] },
  { id: ME, type: 1, title: 'KIM Geohwa', email: 'kimghw@krs.co.kr', roles: [{ id: 1073741830, name: '편집', kind: 6 }] },
] };
const SEARCH = {
  '문창재': [{ title: 'MOON Changjae', email: 'cjmoon@krs.co.kr', login: 'i:0#.f|membership|cjmoon@krs.co.kr' }],
  '김철수': [{ title: 'KIM Chulsoo', email: 'kim1@krs.co.kr' }, { title: 'KIM Chulsoo (해양)', email: 'kim2@krs.co.kr' }],
  'kim2@krs.co.kr': [{ title: 'KIM Chulsoo', email: 'kim1@krs.co.kr' }, { title: 'KIM Chulsoo (해양)', email: 'kim2@krs.co.kr' }],
  'LEE Jaehoon': [{ title: 'LEE Jaehoon', email: 'jhlee81@krs.co.kr' }, { title: 'LEE Jaehoon2', email: 'jhlee2@krs.co.kr' }],
  '없는사람': [],
  '메일없음': [{ title: 'NO Mail', email: '' }],
  '이은주': [{ title: 'LEE Eunjoo', email: 'ejlee@krs.co.kr' }, { title: '이은주', email: 'eunjoo00417@gmail.com', login: 'i:0#.f|membership|eunjoo00417_gmail.com#ext#@krclass.onmicrosoft.com' }],   // 2026-10-20 실측 — 조직 사용자 + 같은 한글 이름의 게스트
  '외부인': [{ title: '외부인', email: 'guest@gmail.com', login: 'i:0#.f|membership|guest_gmail.com#ext#@krclass.onmicrosoft.com' }],
};

(async () => {
await test('parseFolder: 폴더 주소(내 OneDrive · 팀 사이트 · 퍼센트 인코딩 · 끝 /) → origin · sitePath · api · folderApi · viewUrl', () => {
  const a = SP.parseFolder(`${ORIGIN}/personal/kimghw_krs_co_kr/Documents/RERP/`);
  assert.strictEqual(a.origin, ORIGIN);
  assert.strictEqual(a.sitePath, '/personal/kimghw_krs_co_kr');
  assert.strictEqual(a.siteUrl, `${ORIGIN}/personal/kimghw_krs_co_kr`);
  assert.strictEqual(a.apiRoot, `${a.siteUrl}/_api`);
  assert.strictEqual(a.api, `${a.siteUrl}/_api/web`);
  assert.strictEqual(a.folderPath, RERP);
  assert.strictEqual(a.name, 'RERP');
  assert.strictEqual(a.folderApi, `${a.api}/GetFolderByServerRelativePath(decodedurl='${encodeURIComponent(RERP)}')`);
  assert.strictEqual(a.fileApi('2026-0063-01.json'), `${a.api}/GetFileByServerRelativePath(decodedurl='${encodeURIComponent(`${RERP}/2026-0063-01.json`)}')`);
  assert.strictEqual(a.fileUrl('2026-0063-01.json'), `${ORIGIN}${RERP}/2026-0063-01.json`);
  assert.strictEqual(a.viewUrl, `${a.siteUrl}/_layouts/15/onedrive.aspx?id=${encodeURIComponent(RERP)}`);
  assert.strictEqual(a.personal, true); assert.strictEqual(a.mine, false);
  // 팀 사이트 — 공백·한글 퍼센트 인코딩, 문서함 보기 주소는 AllItems.aspx
  const b = SP.parseFolder('https://krclass.sharepoint.com/sites/AIP/Shared%20Documents/%EA%B3%B5%EC%9C%A0/RERP');
  assert.strictEqual(b.sitePath, '/sites/AIP');
  assert.strictEqual(b.siteUrl, 'https://krclass.sharepoint.com/sites/AIP');
  assert.strictEqual(b.folderPath, '/sites/AIP/Shared Documents/공유/RERP');
  assert.strictEqual(b.viewUrl, `https://krclass.sharepoint.com/sites/AIP/Shared%20Documents/Forms/AllItems.aspx?id=${encodeURIComponent('/sites/AIP/Shared Documents/공유/RERP')}`);
  assert.strictEqual(b.personal, false);
  // 루트 사이트의 문서함
  const c = SP.parseFolder('https://krclass.sharepoint.com/Shared Documents/RERP');
  assert.strictEqual(c.sitePath, ''); assert.strictEqual(c.siteUrl, 'https://krclass.sharepoint.com'); assert.strictEqual(c.folderPath, '/Shared Documents/RERP');
});

await test('parseFolder: 문서함 보기 주소 onedrive.aspx?id= · Forms/AllItems.aspx?id= · 파일을 고른 주소(parent=)', () => {
  const a = SP.parseFolder(`${ORIGIN}/personal/kimghw_krs_co_kr/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fkimghw%5Fkrs%5Fco%5Fkr%2FDocuments%2FRERP&view=0`);
  assert.strictEqual(a.folderPath, RERP);
  assert.strictEqual(a.siteUrl, `${ORIGIN}/personal/kimghw_krs_co_kr`);
  const b = SP.parseFolder('https://krclass.sharepoint.com/sites/AIP/Shared%20Documents/Forms/AllItems.aspx?id=%2Fsites%2FAIP%2FShared%20Documents%2FRERP&p=true&ga=1');
  assert.strictEqual(b.folderPath, '/sites/AIP/Shared Documents/RERP');
  assert.strictEqual(b.api, 'https://krclass.sharepoint.com/sites/AIP/_api/web');
  // 파일을 고른 보기 주소 → parent 가 폴더
  const c = SP.parseFolder(`${ORIGIN}/personal/kimghw_krs_co_kr/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fkimghw%5Fkrs%5Fco%5Fkr%2FDocuments%2FRERP%2F2026%2D0063%2D01%2Ejson&parent=%2Fpersonal%2Fkimghw%5Fkrs%5Fco%5Fkr%2FDocuments%2FRERP`);
  assert.strictEqual(c.folderPath, RERP);
  // 폴더를 연 주소에 parent 가 있어도(하위 폴더로 들어감) id 가 폴더
  const d = SP.parseFolder(`${ORIGIN}/personal/kimghw_krs_co_kr/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fkimghw%5Fkrs%5Fco%5Fkr%2FDocuments%2FRERP&parent=%2Fpersonal%2Fkimghw%5Fkrs%5Fco%5Fkr%2FDocuments`);
  assert.strictEqual(d.folderPath, RERP);
});

await test('parseFolder: badurl — 빈 값 · 주소 아님 · http · sharepoint 아님 · 공유 링크 · id 없는 aspx · 사이트만(폴더 없음) · _layouts 경로 · 금지 글자', () => {
  throws(() => SP.parseFolder(''), 'badurl', /비어/);
  throws(() => SP.parseFolder('안녕'), 'badurl', /주소 모양/);
  throws(() => SP.parseFolder('http://krclass.sharepoint.com/sites/A/Shared Documents/x'), 'badurl', /https/);
  throws(() => SP.parseFolder('https://onedrive.live.com/?id=abc'), 'badurl', /sharepoint/);
  throws(() => SP.parseFolder(`${ORIGIN}/:f:/g/personal/kimghw_krs_co_kr/EabcDEF?e=xyz`), 'badurl', /공유 링크 대신 폴더를 연 뒤/);
  throws(() => SP.parseFolder(`${ORIGIN}/personal/kimghw_krs_co_kr/_layouts/15/onedrive.aspx?view=0`), 'badurl', /id=/);
  throws(() => SP.parseFolder('https://krclass.sharepoint.com/sites/AIP'), 'badurl', /문서함 안의 폴더/);
  throws(() => SP.parseFolder('https://krclass.sharepoint.com/'), 'badurl', /문서함 안의 폴더/);
  throws(() => SP.parseFolder(`${ORIGIN}/personal/kimghw_krs_co_kr/_layouts/15/download`), 'badurl');
  throws(() => SP.parseFolder('https://krclass.sharepoint.com/sites/AIP/Shared%20Documents/a%3Cb'), 'badurl', /글자/);
  throws(() => SP.parseFolder(`https://krclass.sharepoint.com/sites/AIP/x/${'a'.repeat(2100)}`), 'badurl', /너무/);
});

await test('한글·공백·따옴표 폴더와 한글 파일 이름 왕복 — decodedurl 은 encodeURIComponent 뒤 \' → \'\', 가짜 서버가 디코딩해 같은 폴더를 찾는다 · fileUrl 은 브라우저 주소', async () => {
  const folder = "/personal/kimghw_krs_co_kr/Documents/공유 자료/RERP's";
  const name = '2026-0063-01 한글 과제.json';
  const cfg = SP.parseFolder(`${ORIGIN}${encodeURI(folder)}`);
  assert.strictEqual(cfg.folderPath, folder);
  assert.ok(cfg.folderApi.endsWith(`(decodedurl='${encodeURIComponent(folder.replace("'", "''"))}')`), cfg.folderApi);
  assert.ok(!/[가-힣 ]/.test(cfg.folderApi) && !/[가-힣 ]/.test(cfg.fileApi(name)), '요청 주소에 한글·공백이 날로 남지 않음');
  assert.strictEqual(decodeURIComponent(new URL(cfg.fileUrl(name)).pathname), `${folder}/${name}`);
  assert.strictEqual(cfg.fileUrl(name), `${ORIGIN}/personal/kimghw_krs_co_kr/Documents/%EA%B3%B5%EC%9C%A0%20%EC%9E%90%EB%A3%8C/RERP's/2026-0063-01%20%ED%95%9C%EA%B8%80%20%EA%B3%BC%EC%A0%9C.json`);
  const F = fakeSp({ files: { [folder]: { [name]: '{"v":1,"prjNo":"2026-0063-01"}' } } });
  const list = await SP.listFiles(cfg, { fetch: F.fetch });
  assert.deepStrictEqual(list.map((f) => f.name), [name]);
  assert.strictEqual(calls(F)[0], `GET folder(${folder})/Files?$select=Name,Length,TimeLastModified,UIVersionLabel,UniqueId`);
  const r = await SP.readFile(cfg, name, { fetch: F.fetch });
  assert.strictEqual(r.text, '{"v":1,"prjNo":"2026-0063-01"}');
  assert.ok(calls(F).includes(`GET file(${folder}/${name})/$value`));
  // 쓰기도 같은 경로로
  const C = fakeChrome(F.fetch);
  const w = await SP.openWriter(cfg, { chrome: C });
  const res = await w.write(name, '{"v":1,"x":"한글"}', { comment: "한글 '설명'" });
  assert.strictEqual(res.updated, true);
  assert.strictEqual(F.file(folder, name).text, '{"v":1,"x":"한글"}');
  assert.strictEqual(F.file(folder, name).lastComment, "한글 '설명'");
  await w.close();
});

await test('revive: storage 캐시(JSON)에서 읽은 cfg 에 fileApi · fileUrl 을 되살림 · KRX_SP.fileApi(cfg, name) 은 함수 없는 cfg 에도 됨 · 설정 없으면 badurl', () => {
  const plain = JSON.parse(JSON.stringify(Object.assign({}, CFG, { mine: true })));
  assert.strictEqual(plain.fileApi, undefined);
  assert.strictEqual(SP.fileApi(plain, 'a.json'), CFG.fileApi('a.json'));
  assert.strictEqual(SP.fileUrl(plain, 'a.json'), CFG.fileUrl('a.json'));
  const back = SP.revive(plain);
  assert.strictEqual(back.fileApi('a.json'), CFG.fileApi('a.json'));
  assert.strictEqual(back.viewUrl, CFG.viewUrl); assert.strictEqual(back.mine, true); assert.strictEqual(back.url, CFG.url);
  assert.strictEqual(SP.revive(CFG), CFG, '살아 있으면 그대로');
  throws(() => SP.revive(null), 'badurl'); throws(() => SP.revive({}), 'badurl');
  throws(() => SP.fileApi(CFG, 'a/b.json'), 'badurl', /파일 이름/); throws(() => SP.fileApi(CFG, ''), 'badurl');
});

await test('resolveMyFolder: v2.0 me/drive 의 webUrl + /업무/shared(기본 — 두 단, name 으로 바꿀 수 있음) → mine:true · drive 404 면 PersonalUrl 대체 · 403 → auth · 로그인 화면 → auth · 연결 실패 → offline', async () => {
  const F = fakeSp();
  const cfg = await SP.resolveMyFolder({ fetch: F.fetch });
  assert.strictEqual(cfg.folderPath, BASE); assert.strictEqual(cfg.name, 'shared'); assert.strictEqual(cfg.libPath, `${ME_PATH}`); assert.strictEqual(cfg.mine, true); assert.strictEqual(cfg.siteUrl, `${ORIGIN}/personal/kimghw_krs_co_kr`);
  assert.deepStrictEqual(calls(F), ['GET me/drive']);
  const G = fakeSp({ drive: 404 });
  const cfg2 = await SP.resolveMyFolder({ fetch: G.fetch, driveHost: `${ORIGIN}/` });
  assert.strictEqual(cfg2.folderPath, BASE);
  assert.strictEqual((await SP.resolveMyFolder({ fetch: F.fetch, name: 'RERP' })).folderPath, RERP, 'name 한 단');
  assert.deepStrictEqual(calls(G), ['GET me/drive', 'GET GetMyProperties']);
  const other = await SP.resolveMyFolder({ fetch: F.fetch, name: '공유' });
  assert.strictEqual(other.folderPath, `${ME_PATH}/공유`);
  await rejects(SP.resolveMyFolder({ fetch: fakeSp({ deny403: true }).fetch }), 'auth', /로그인/);
  await rejects(SP.resolveMyFolder({ fetch: fakeSp({ loggedIn: false }).fetch }), 'auth', /로그인 화면/);
  await rejects(SP.resolveMyFolder({ fetch: async () => { throw new Error('ENOTFOUND'); } }), 'offline', /연결/);
  await rejects(SP.resolveMyFolder({ fetch: F.fetch, driveHost: 'nope' }), 'badurl');
});

await test('resolveFolder: 비면 내 OneDrive · 공유 링크는 redirect:follow 로 따라간 끝 주소의 id= · 끝에 id 없으면 badurl(안내) · 로그인 화면 → auth · 폴더 주소는 parseFolder · 엉뚱한 글 badurl', async () => {
  const F = fakeSp();
  const mine = await SP.resolveFolder('', { fetch: F.fetch });
  assert.strictEqual(mine.mine, true); assert.strictEqual(mine.folderPath, BASE);
  assert.strictEqual((await SP.resolveFolder('', { fetch: F.fetch, name: 'RERP' })).folderPath, RERP, 'name 을 넘기면 그 밑폴더');
  const share = `${ORIGIN}/:f:/g/personal/kimghw_krs_co_kr/EabcDEFghi?e=xyz12`;
  const s = await SP.resolveFolder(share, { fetch: F.fetch });
  assert.strictEqual(s.folderPath, RERP); assert.strictEqual(s.mine, false); assert.strictEqual(s.shareUrl, share);
  assert.ok(s.url.includes('onedrive.aspx'), '풀린 주소가 url');
  assert.deepStrictEqual(calls(F).slice(-1), ['GET share follow']);
  await rejects(SP.resolveFolder(share, { fetch: fakeSp({ shareDest: `${ORIGIN}/personal/kimghw_krs_co_kr/_layouts/15/onedrive.aspx?view=0` }).fetch }), 'badurl', /공유 링크 대신 폴더를 연 뒤 주소창의 주소를 넣으세요/);
  await rejects(SP.resolveFolder(share, { fetch: fakeSp({ shareDest: 'login' }).fetch }), 'auth', /로그인/);
  await rejects(SP.resolveFolder(share, { fetch: async () => ({ ok: true, status: 200, url: '' }) }), 'badurl', /따라가지/);
  await rejects(SP.resolveFolder(share, { fetch: async () => { throw new Error('down'); } }), 'offline');
  const plain = await SP.resolveFolder(` ${ORIGIN}${RERP} `, { fetch: F.fetch });
  assert.strictEqual(plain.folderPath, RERP);
  await rejects(SP.resolveFolder('hello', { fetch: F.fetch }), 'badurl');
});

await test('listFiles: 모양(name · length · modified · version · uniqueId 소문자) · 404 → nofolder · 빈 폴더는 Exists 로 가름(false → nofolder, true → []) · 로그인 화면 → auth · 403 → auth', async () => {
  const F = fakeSp({ files: { [RERP]: { 'P1.json': '{"a":1}', 'P2.json': '{"b":22}' } } });
  const list = await SP.listFiles(CFG, { fetch: F.fetch });
  assert.deepStrictEqual(list, [
    { name: 'P1.json', length: 7, modified: '2026-10-18T01:02:03Z', version: '1.0', uniqueId: '00000001-0000-0000-0000-00000000abcd' },
    { name: 'P2.json', length: 8, modified: '2026-10-18T01:02:03Z', version: '1.0', uniqueId: '00000002-0000-0000-0000-00000000abcd' }
  ]);
  assert.strictEqual(F.st.calls.length, 1, '목록이 있으면 Exists 조회 없음');
  const e = await rejects(SP.listFiles(CFG, { fetch: fakeSp().fetch }), 'nofolder', /공유 폴더가 없습니다/);
  assert.strictEqual(e.path, RERP);
  const E = fakeSp({ folders: [RERP] });
  assert.deepStrictEqual(await SP.listFiles(CFG, { fetch: E.fetch }), []);
  assert.deepStrictEqual(calls(E), [`GET folder(${RERP})/Files?$select=Name,Length,TimeLastModified,UIVersionLabel,UniqueId`, `GET folder(${RERP})?$select=Exists`]);
  // 가짜가 200 + 빈 목록 뒤 Exists:false 를 주는 경우(실측의 GetFolder… 동작)
  const X = fakeSp({ folders: [RERP] });
  const base = X.fetch;
  const fetch2 = async (u, i) => (String(u).includes('/Files?') ? { ok: true, status: 200, url: '', json: async () => ({ value: [] }) } : base(u, i));
  delete X.st.folders[RERP];
  await rejects(SP.listFiles(CFG, { fetch: fetch2 }), 'nofolder');
  await rejects(SP.listFiles(CFG, { fetch: fakeSp({ loggedIn: false }).fetch }), 'auth', /로그인 화면/);
  await rejects(SP.listFiles(CFG, { fetch: async (u, i) => ({ ok: false, status: 403, url: '', json: async () => ({}) }) }), 'auth');
  await rejects(SP.listFiles(CFG, { fetch: async () => ({ ok: true, status: 200, url: '', json: async () => 'x' }) }), 'http', /JSON/);
  await rejects(SP.listFiles(JSON.parse(JSON.stringify(CFG)), { fetch: fakeSp().fetch }), 'nofolder');   // 캐시 cfg 도 받음
});

await test('readFile: 200 → { text, meta } · 404 → null · Exists:false → null · 로그인 redirect → auth · 500 → http(status) · 연결 실패 → offline', async () => {
  const F = fakeSp({ files: { [RERP]: { 'P1.json': '{"v":1,"prjNo":"P1"}' } } });
  const r = await SP.readFile(CFG, 'P1.json', { fetch: F.fetch });
  assert.deepStrictEqual(r, { text: '{"v":1,"prjNo":"P1"}', meta: { version: '1.0', modified: '2026-10-18T01:02:03Z', length: 20, uniqueId: '00000001-0000-0000-0000-00000000abcd', checkedOut: false, checkedOutByMe: false } });
  assert.deepStrictEqual(calls(F), [`GET file(${RERP}/P1.json)?$select=Exists,CheckOutType,UniqueId,Length,TimeLastModified,UIVersionLabel`, `GET file(${RERP}/P1.json)/$value`]);
  assert.strictEqual(await SP.readFile(CFG, 'none.json', { fetch: F.fetch }), null);
  // 체크아웃된 파일: 내가 잡은 것(끊긴 지난 쓰기)은 checkedOutByMe 와 함께 $value 가 내 초안, 남이 잡은 것은 지난 판
  const G = fakeSp({ files: { [RERP]: { 'mine.json': '{"n":1}', 'other.json': '{"n":1}' } }, checkedOutBy: { 'mine.json': ME, 'other.json': 99 }, drafts: { 'mine.json': '{"n":2}' } });
  const mine = await SP.readFile(CFG, 'mine.json', { fetch: G.fetch });
  assert.deepStrictEqual([mine.text, mine.meta.checkedOut, mine.meta.checkedOutByMe], ['{"n":2}', true, true]);
  assert.ok(calls(G).includes('GET currentuser') && calls(G).some((c) => c.includes('/CheckedOutByUser')), '누가 잡았는지 본다');
  const other = await SP.readFile(CFG, 'other.json', { fetch: G.fetch });
  assert.deepStrictEqual([other.text, other.meta.checkedOut, other.meta.checkedOutByMe], ['{"n":1}', true, false]);
  assert.strictEqual(await SP.readFile(CFG, 'x.json', { fetch: async () => ({ ok: true, status: 200, url: '', json: async () => ({ Exists: false }) }) }), null);
  await rejects(SP.readFile(CFG, 'P1.json', { fetch: fakeSp({ loggedIn: false }).fetch }), 'auth', /로그인 화면/);
  const e = await rejects(SP.readFile(CFG, 'P1.json', { fetch: async () => ({ ok: false, status: 500, url: '', json: async () => ({}) }) }), 'http');
  assert.strictEqual(e.status, 500);
  await rejects(SP.readFile(CFG, 'P1.json', { fetch: async () => { throw new TypeError('Failed to fetch'); } }), 'offline');
  await rejects(SP.readFile(CFG, '../x', { fetch: F.fetch }), 'badurl', /파일 이름/);
});

await test('openWriter: 최소화·비포커스 창으로 사이트 페이지를 열고 contextinfo 한 번 · 작업 탭이 로그인 화면이면 auth(페이지 함수 없이 창 닫음) · 창 못 열면 tab · contextinfo 403 → auth', async () => {
  const F = fakeSp({ folders: [RERP] });
  const C = fakeChrome(F.fetch);
  const w = await SP.openWriter(CFG, { chrome: C });
  assert.deepStrictEqual(C.log[0], ['create', 'minimized', false, `${CFG.siteUrl}/_api/web/currentuser?$select=Id`]);
  assert.deepStrictEqual(C.log.filter((l) => l[0] === 'run').map((l) => l.slice(1)), [['spDigest', 'MAIN', '0']]);
  assert.strictEqual(F.st.digestIssued, 1);
  assert.strictEqual(w.tabId, 12); assert.strictEqual(w.windowId, 11); assert.strictEqual(w.folderPath, RERP);
  await w.close();
  assert.deepStrictEqual(C.log.slice(-1), [['windows.remove', 11]]);
  await w.close();   // 두 번 닫아도 조용히
  assert.strictEqual(C.log.filter((l) => l[0] === 'windows.remove').length, 1);
  // 로그인 화면으로 넘어간 탭
  const L = fakeChrome(F.fetch, { landing: 'https://login.microsoftonline.com/common/oauth2/authorize?x=1' });
  await rejects(SP.openWriter(CFG, { chrome: L }), 'auth', /로그인/);
  assert.deepStrictEqual(L.log.map((l) => l[0]), ['create', 'update', 'windows.remove']);
  // 창 못 열면 tab
  await rejects(SP.openWriter(CFG, { chrome: fakeChrome(F.fetch, { failOpen: true }) }), 'tab', /작업 탭/);
  // 창에 tabs 가 없으면 tabs.query 로 찾음
  const N = fakeChrome(F.fetch, { noTabs: true });
  const w2 = await SP.openWriter(CFG, { chrome: N }); assert.strictEqual(w2.tabId, 12); await w2.close();
  // contextinfo 403 → auth, 창 닫음
  const D = fakeSp({ deny403: true }); const DC = fakeChrome(D.fetch);
  await rejects(SP.openWriter(CFG, { chrome: DC }), 'auth');
  assert.strictEqual(DC.log.slice(-1)[0][0], 'windows.remove');
  await rejects(SP.openWriter(CFG, { chrome: {} }), 'tab');
});

await test('writer.modify ① 없으면 transform(null) → Files/add(url,overwrite=false) 본문 = 내용 (체크아웃 없음) · transform 이 changed:false 면 만들지 않음', async () => {
  const F = fakeSp({ folders: [RERP] });
  const C = fakeChrome(F.fetch);
  const w = await SP.openWriter(CFG, { chrome: C });
  const from = F.st.calls.length;
  const seen = [];
  const r = await w.modify('P1.json', (cur) => { seen.push(cur); return { changed: true, text: '{"v":1,"prjNo":"P1"}' }; });
  assert.deepStrictEqual(seen, [null]);
  assert.deepStrictEqual(r, { changed: true, created: true, updated: false, checkedIn: false, version: '1.0', meta: { version: '1.0', modified: '2026-10-18T01:02:03Z', length: 20, uniqueId: '00000001-0000-0000-0000-00000000abcd' } });
  assert.strictEqual(F.file(RERP, 'P1.json').text, '{"v":1,"prjNo":"P1"}');
  assert.deepStrictEqual(calls(F, from), [`GET file(${RERP}/P1.json)?$select=Exists,CheckOutType,UniqueId,UIVersionLabel,Length,TimeLastModified`, `POST folder(${RERP})/Files/add(url='P1.json',overwrite=false)`], '보통 문서함(CheckOutType 2)이면 체크인 호출 없음');
  const from2 = F.st.calls.length;
  const r2 = await w.modify('P2.json', () => ({ changed: false }));
  assert.deepStrictEqual(r2, { changed: false, created: false, updated: false, checkedIn: false, version: '', meta: null });
  assert.strictEqual(F.file(RERP, 'P2.json'), undefined);
  assert.strictEqual(calls(F, from2).length, 1, '파일 정보만 봄');
  assert.strictEqual(F.st.digestIssued, 1, '다이제스트는 writer 하나에 한 번');
  await w.close();
});

await test('writer.modify ② 있고 바뀌면 CheckOut → $value → PUT → CheckIn(comment, 주 버전) → 파일 정보 · ③ 안 바뀌면 UndoCheckOut(PUT 없음)', async () => {
  const F = fakeSp({ files: { [RERP]: { 'P1.json': '{"v":1,"n":1}' } } });
  const C = fakeChrome(F.fetch);
  const w = await SP.openWriter(CFG, { chrome: C });
  const from = F.st.calls.length;
  const r = await w.modify('P1.json', (cur) => ({ changed: true, text: cur.replace('"n":1', '"n":2') }), { comment: "동기화 'x'" });
  assert.deepStrictEqual(r, { changed: true, created: false, updated: true, checkedIn: true, version: '2.0', meta: { version: '2.0', modified: '2026-10-18T02:00:00Z', length: 13, uniqueId: '00000001-0000-0000-0000-00000000abcd' } });
  const file = F.file(RERP, 'P1.json');
  assert.strictEqual(file.text, '{"v":1,"n":2}'); assert.strictEqual(file.checkedOutBy, null); assert.strictEqual(file.version, 2); assert.strictEqual(file.lastComment, "동기화 'x'");
  const P = `file(${RERP}/P1.json)`;
  assert.deepStrictEqual(calls(F, from), [
    `GET ${P}?$select=Exists,CheckOutType,UniqueId,UIVersionLabel,Length,TimeLastModified`, `POST ${P}/CheckOut()`, `GET ${P}/$value`,
    `PUT ${P}/$value`, `POST ${P}/CheckIn(comment='${encodeURIComponent("동기화 ''x''")}',checkintype=1)`, `GET ${P}?$select=UniqueId,UIVersionLabel,Length,TimeLastModified`
  ]);
  assert.deepStrictEqual(C.log.filter((l) => l[0] === 'run').map((l) => l[1]), ['spDigest', 'spBegin', 'spCommit']);
  // ③ 안 바뀌면
  const from2 = F.st.calls.length;
  const r2 = await w.modify('P1.json', () => ({ changed: false }));
  assert.deepStrictEqual(r2, { changed: false, created: false, updated: false, checkedIn: false, version: '2.0', meta: { version: '2.0', modified: '2026-10-18T02:00:00Z', length: 13, uniqueId: '00000001-0000-0000-0000-00000000abcd' } });
  assert.ok(!calls(F, from2).some((c) => c.startsWith('PUT')), 'PUT 없음');
  assert.ok(calls(F, from2).includes(`POST ${P}/UndoCheckOut()`));
  assert.strictEqual(file.checkedOutBy, null); assert.strictEqual(file.version, 2);
  // 기본 설명 · 비동기 transform
  await w.modify('P1.json', async (cur) => ({ changed: true, text: cur + ' ' }));
  assert.strictEqual(file.lastComment, SP.DEFAULT_COMMENT);
  // transform 이 던지면 UndoCheckOut 뒤 그대로 던짐 · 결과가 없으면 Error
  await assert.rejects(w.modify('P1.json', () => { throw new Error('병합 실패'); }), /병합 실패/);
  assert.strictEqual(file.checkedOutBy, null);
  await assert.rejects(w.modify('P1.json', () => null), /변환 결과/);
  assert.strictEqual(file.checkedOutBy, null);
  await w.close();
});

await test('writer.modify ④ 남이 체크아웃 → locked(쓰지 않음, 그 파일만) · 내가 잡고 있던 체크아웃은 이어서 씀 · PUT 실패 → http + UndoCheckOut', async () => {
  const F = fakeSp({ files: { [RERP]: { 'P1.json': '{"a":1}', 'P2.json': '{"b":1}', 'P3.json': '{"c":1}' } }, checkedOutBy: { 'P1.json': 99, 'P3.json': ME } });
  const C = fakeChrome(F.fetch);
  const w = await SP.openWriter(CFG, { chrome: C });
  const from = F.st.calls.length;
  const e = await rejects(w.modify('P1.json', () => ({ changed: true, text: 'x' })), 'locked', /다른 사람/);
  assert.strictEqual(F.file(RERP, 'P1.json').text, '{"a":1}'); assert.strictEqual(F.file(RERP, 'P1.json').checkedOutBy, 99);
  assert.ok(!calls(F, from).some((c) => c.includes('CheckOut()') || c.startsWith('PUT')), '체크아웃·PUT 시도 없음');
  assert.strictEqual(SP.describe(e).kind, 'locked');
  // 같은 writer 로 다른 파일은 계속
  const r2 = await w.modify('P2.json', () => ({ changed: true, text: '{"b":2}' }));
  assert.strictEqual(r2.updated, true); assert.strictEqual(F.file(RERP, 'P2.json').text, '{"b":2}');
  // 내가 잡고 있던 것(지난번에 끊긴 체크아웃)은 CheckOut 없이 이어서
  const from3 = F.st.calls.length;
  const r3 = await w.modify('P3.json', () => ({ changed: true, text: '{"c":2}' }));
  assert.strictEqual(r3.updated, true);
  assert.ok(!calls(F, from3).some((c) => c.includes('/CheckOut()')), '이미 내가 잡고 있으면 CheckOut 안 함');
  assert.ok(calls(F, from3).includes('GET currentuser') && calls(F, from3).some((c) => c.includes('/CheckedOutByUser')));
  assert.strictEqual(F.file(RERP, 'P3.json').checkedOutBy, null);
  // CheckOut 이 423 이면 locked
  const base = F.fetch;
  C.scripting.executeScript = (({ target, world, func, args }) => { C.log.push(['run', func.name]); const orig = globalThis.fetch; globalThis.fetch = async (u, i) => (String(u).endsWith('/CheckOut()') ? { ok: false, status: 423, json: async () => ({}) } : base(u, i)); return (async () => { try { return [{ result: await func(...args) }]; } finally { globalThis.fetch = orig; } })(); });
  await rejects(w.modify('P2.json', () => ({ changed: true, text: 'y' })), 'locked');
  await w.close();
  // PUT 실패 → http + UndoCheckOut
  const G = fakeSp({ files: { [RERP]: { 'P1.json': '{"a":1}' } }, failPut: true });
  const w2 = await SP.openWriter(CFG, { chrome: fakeChrome(G.fetch) });
  const e2 = await rejects(w2.modify('P1.json', () => ({ changed: true, text: 'x' })), 'http', /쓰기 500/);
  assert.strictEqual(e2.status, 500);
  assert.strictEqual(G.file(RERP, 'P1.json').text, '{"a":1}'); assert.strictEqual(G.file(RERP, 'P1.json').checkedOutBy, null, 'PUT 실패 → UndoCheckOut');
  await w2.close();
});

await test('끊긴 체크아웃 이어받기(resumed): 올라간 초안과 같아 안 바뀌어도 UndoCheckOut 이 아니라 CheckIn(초안이 판이 되고 체크아웃 끝) · discard:true 면 UndoCheckOut · 체크인 실패 뒤 다음 쓰기가 체크인한다', async () => {
  // 지난 쓰기가 PUT 뒤 CheckIn 전에 끊김: 내 체크아웃 + 초안 {"n":2}, 체크인된 판은 {"n":1}
  const F = fakeSp({ files: { [RERP]: { 'P1.json': '{"n":1}', 'P2.json': '{"n":1}' } }, checkedOutBy: { 'P1.json': ME, 'P2.json': ME }, drafts: { 'P1.json': '{"n":2}', 'P2.json': '깨진 초안' } });
  const w = await SP.openWriter(CFG, { chrome: fakeChrome(F.fetch) });
  const from = F.st.calls.length;
  const seen = [];
  const r = await w.modify('P1.json', (cur) => { seen.push(cur); return { changed: false }; });
  assert.deepStrictEqual(seen, ['{"n":2}'], 'transform 은 초안을 본다');
  assert.deepStrictEqual([r.changed, r.updated, r.checkedIn, r.version], [false, false, true, '2.0']);
  const P = `file(${RERP}/P1.json)`;
  assert.ok(!calls(F, from).some((c) => c.includes('UndoCheckOut') || c.startsWith('PUT') || c.includes('/CheckOut()')), 'UndoCheckOut · PUT · CheckOut 없음');
  assert.ok(calls(F, from).some((c) => c.startsWith(`POST ${P}/CheckIn(`)), 'CheckIn 만');
  assert.deepStrictEqual([F.file(RERP, 'P1.json').text, F.file(RERP, 'P1.json').draft, F.file(RERP, 'P1.json').checkedOutBy, F.file(RERP, 'P1.json').version], ['{"n":2}', null, null, 2], '초안이 판이 됐고 체크아웃이 끝남');
  // 해석되지 않는 초안은 transform 이 discard 로 알려 UndoCheckOut(지난 판으로)
  const r2 = await w.modify('P2.json', () => ({ changed: false, discard: true }));
  assert.deepStrictEqual([r2.changed, r2.checkedIn, F.file(RERP, 'P2.json').text, F.file(RERP, 'P2.json').draft, F.file(RERP, 'P2.json').checkedOutBy], [false, false, '{"n":1}', null, null]);
  await w.close();
  // PUT 은 됐는데 CheckIn 이 실패 → http(체크아웃은 내게 남음) → 다음 writer 의 modify(안 바뀜)가 이어받아 체크인
  const G = fakeSp({ files: { [RERP]: { 'P1.json': '{"n":1}' } }, failCheckIn: true });
  const w2 = await SP.openWriter(CFG, { chrome: fakeChrome(G.fetch) });
  const e = await rejects(w2.modify('P1.json', () => ({ changed: true, text: '{"n":2}' })), 'http', /체크인 500/);
  assert.strictEqual(e.status, 500);
  assert.deepStrictEqual([G.file(RERP, 'P1.json').checkedOutBy, G.file(RERP, 'P1.json').draft, G.file(RERP, 'P1.json').text], [ME, '{"n":2}', '{"n":1}']);
  await w2.close();
  const read = await SP.readFile(CFG, 'P1.json', { fetch: G.fetch });
  assert.deepStrictEqual([read.text, read.meta.checkedOutByMe], ['{"n":2}', true], '읽기는 내 초안을 주고 내 체크아웃이라 알린다 — prjdoc-sync 가 내용이 같아도 modify 를 탄다');
  const w3 = await SP.openWriter(CFG, { chrome: fakeChrome(G.fetch) });
  const r3 = await w3.modify('P1.json', (cur) => ({ changed: cur !== '{"n":2}', text: '{"n":2}' }));
  assert.deepStrictEqual([r3.changed, r3.checkedIn, G.file(RERP, 'P1.json').checkedOutBy, G.file(RERP, 'P1.json').text, G.file(RERP, 'P1.json').version], [false, true, null, '{"n":2}', 2]);
  await w3.close();
});

await test('"체크아웃 필수" 문서함: Files/add 뒤 파일이 내 체크아웃(CheckOutType 0 · 판 0.1)이면 CheckIn 까지 — 남에게 보이고 UndoCheckOut 이 파일을 지우는 일이 없다', async () => {
  const F = fakeSp({ folders: [RERP], requireCheckout: true });
  const w = await SP.openWriter(CFG, { chrome: fakeChrome(F.fetch) });
  const from = F.st.calls.length;
  const r = await w.modify('P1.json', () => ({ changed: true, text: '{"v":1}' }), { comment: '처음' });
  assert.deepStrictEqual([r.created, r.checkedIn, r.version], [true, true, '1.0']);
  const P = `file(${RERP}/P1.json)`;
  assert.deepStrictEqual(calls(F, from).filter((c) => c.startsWith('POST')), [`POST folder(${RERP})/Files/add(url='P1.json',overwrite=false)`, `POST ${P}/CheckIn(comment='${encodeURIComponent('처음')}',checkintype=1)`]);
  const file = F.file(RERP, 'P1.json');
  assert.deepStrictEqual([file.text, file.draft, file.checkedOutBy, file.version, file.lastComment], ['{"v":1}', null, null, 1, '처음']);
  // 다음 쓰기(안 바뀜)는 보통 경로: CheckOut → UndoCheckOut — 파일은 남는다
  await w.modify('P1.json', () => ({ changed: false }));
  assert.ok(F.file(RERP, 'P1.json'), '파일 보존');
  await w.close();
});

await test('다이제스트: 만료·거부(403 security validation)면 다시 받아 한 번 더 · TTL(FormDigestTimeoutSeconds - 1분)이 지나면 쓰기 전에 미리 다시 받음 · 그래도 거부면 http(auth 로 오해하지 않음)', async () => {
  const F = fakeSp({ files: { [RERP]: { 'P1.json': '{"n":1}', 'P2.json': '{"n":1}' } } });
  const w = await SP.openWriter(CFG, { chrome: fakeChrome(F.fetch) });
  assert.strictEqual(F.st.digestIssued, 1);
  F.expire();   // 서버가 다이제스트를 만료시킴
  const r = await w.modify('P1.json', () => ({ changed: true, text: '{"n":2}' }));
  assert.deepStrictEqual([r.updated, F.file(RERP, 'P1.json').text, F.file(RERP, 'P1.json').checkedOutBy, F.st.digestIssued], [true, '{"n":2}', null, 2], '체크아웃 403 → 새 다이제스트로 다시');
  // PUT 뒤 체크인 사이에 만료 — PUT 은 되돌리지 않고(다이제스트 탓) 새 다이제스트로 다시 PUT·체크인
  const base = F.fetch;
  let armed = true;
  const C = fakeChrome(async (u, i) => { const r2 = await base(u, i); if (armed && String(u).endsWith('/$value') && String((i || {}).method).toUpperCase() === 'PUT') { armed = false; F.expire(); } return r2; });
  const w2 = await SP.openWriter(CFG, { chrome: C });
  const n0 = F.st.digestIssued;
  const r2 = await w2.modify('P2.json', () => ({ changed: true, text: '{"n":3}' }));
  assert.deepStrictEqual([r2.updated, F.file(RERP, 'P2.json').text, F.file(RERP, 'P2.json').checkedOutBy, F.st.digestIssued - n0], [true, '{"n":3}', null, 1]);
  await w2.close();
  await w.close();
  // TTL: 시각을 주입 — 발급 뒤 29분이 지나면 다음 쓰기 전에 다시 받는다 (서버 거부 전에)
  let t = 1000000;
  const G = fakeSp({ files: { [RERP]: { 'P1.json': '{"n":1}' } } });
  const w3 = await SP.openWriter(CFG, { chrome: fakeChrome(G.fetch), now: () => t });
  await w3.modify('P1.json', () => ({ changed: true, text: '{"n":2}' }));
  assert.strictEqual(G.st.digestIssued, 1);
  t += 29 * 60 * 1000 + 1;
  await w3.modify('P1.json', () => ({ changed: true, text: '{"n":3}' }));
  assert.strictEqual(G.st.digestIssued, 2, '만료 1분 전이 지나 미리 다시 받음');
  assert.strictEqual(G.file(RERP, 'P1.json').text, '{"n":3}');
  await w3.close();
  // 짧은 FormDigestTimeoutSeconds(90초)도 따른다
  const H = fakeSp({ files: { [RERP]: { 'P1.json': '{"n":1}' } }, digestSec: 90 });
  let t2 = 0;
  const w4 = await SP.openWriter(CFG, { chrome: fakeChrome(H.fetch), now: () => t2 });
  t2 += 61 * 1000;
  await w4.modify('P1.json', () => ({ changed: true, text: '{"n":2}' }));
  assert.strictEqual(H.st.digestIssued, 2);
  await w4.close();
  // 새로 받아도 거부하면 http (로그인 안내가 아니라)
  const K = fakeSp({ files: { [RERP]: { 'P1.json': '{"n":1}' } } });
  const w5 = await SP.openWriter(CFG, { chrome: fakeChrome(K.fetch) });
  K.st.validDigests.clear(); K.st.validDigests.add = () => K.st.validDigests;   // 앞으로 내는 다이제스트도 모두 거부
  const e = await rejects(w5.modify('P1.json', () => ({ changed: true, text: 'x' })), 'http', /체크아웃 403/);
  assert.strictEqual(e.status, 403);
  await w5.close();
});

await test('folderUrl: 폴더 이름의 # · 공백 · 한글 · % 가 parseFolder 로 그대로 돌아온다 (encodeURI 는 # 을 두어 fragment 로 잘림)', () => {
  const folder = '/sites/x/Shared Documents/RERP#2 (가) 100%';   // SharePoint Online 은 폴더 이름에 # 과 % 를 허용한다
  const cfg = SP.parseFolder(`https://krclass.sharepoint.com${folder.split('/').map(encodeURIComponent).join('/')}`);
  assert.strictEqual(cfg.folderPath, folder);
  const url = SP.folderUrl(cfg);
  assert.strictEqual(url, 'https://krclass.sharepoint.com/sites/x/Shared%20Documents/RERP%232%20(%EA%B0%80)%20100%25');
  assert.strictEqual(SP.parseFolder(url).folderPath, folder, '동료가 붙여 넣으면 같은 폴더');
  assert.notStrictEqual(SP.parseFolder(`https://krclass.sharepoint.com${encodeURI(folder)}`).folderPath, folder, 'encodeURI 로 만든 주소는 # 뒤가 잘린다(옛 결함)');
  assert.strictEqual(SP.folderUrl(CFG), `${ORIGIN}${RERP}`);
  assert.strictEqual(SP.folderUrl(JSON.parse(JSON.stringify(CFG))), `${ORIGIN}${RERP}`, '캐시 cfg 에도');
});

await test('sweepWorkers: 지난 워커가 남긴 작업 창(…/_api/web/currentuser?$select=Id)만 닫고, 다른 SharePoint 탭·지금 살아 있는 writer 의 탭은 두며, 다른 탭이 섞인 창은 그 탭만 닫는다', async () => {
  const F = fakeSp({ folders: [RERP] });
  const C = fakeChrome(F.fetch);
  const orphan = C.addWindow([`${CFG.siteUrl}${SP.WORKER_PAGE}`]);
  const mixed = C.addWindow(['https://krclass.sharepoint.com/sites/AIP/Shared%20Documents/Forms/AllItems.aspx', `https://krclass.sharepoint.com/sites/AIP/_api/web/currentuser?%24select=Id`]);
  const other = C.addWindow([`${ORIGIN}/personal/kimghw_krs_co_kr/_layouts/15/onedrive.aspx?id=x`, 'https://eclass.krs.co.kr/']);
  const w = await SP.openWriter(CFG, { chrome: C });   // 살아 있는 writer
  const r = await SP.sweepWorkers({ chrome: C });
  assert.strictEqual(r.closed, 2);
  assert.ok(!C.windows_[orphan.id], '우리 탭만 있던 창은 창째');
  assert.deepStrictEqual(C.windows_[mixed.id].tabs.map((t) => t.url), ['https://krclass.sharepoint.com/sites/AIP/Shared%20Documents/Forms/AllItems.aspx'], '섞인 창은 작업 탭만');
  assert.strictEqual(C.windows_[other.id].tabs.length, 2, '다른 탭은 그대로');
  assert.ok(C.windows_[w.windowId] && C.windows_[w.windowId].tabs.length === 1, '살아 있는 writer 의 탭은 둔다');
  const ok = await w.write('P1.json', '{"a":1}');
  assert.strictEqual(ok.created, true, 'writer 는 계속 쓸 수 있다');
  await w.close();
  assert.deepStrictEqual(await SP.sweepWorkers({ chrome: C }), { closed: 0 });
  assert.deepStrictEqual(await SP.sweepWorkers({ chrome: {} }), { closed: 0 }, 'tabs 가 없으면 조용히');
  assert.deepStrictEqual(await SP.sweepWorkers({ chrome: { tabs: { query: async () => { throw new Error('x'); } } } }), { closed: 0 });
});

await test('writer.modify: 없다고 보고 만들다가 동료가 먼저 만들었으면(add 400) 체크아웃 경로로 다시 — transform 이 그 글로 한 번 더 불린다', async () => {
  const F = fakeSp({ folders: [RERP], raceCreate: '{"v":1,"by":"동료"}' });
  const w = await SP.openWriter(CFG, { chrome: fakeChrome(F.fetch) });
  const seen = [];
  const r = await w.modify('P1.json', (cur) => { seen.push(cur); return { changed: true, text: cur ? cur.replace('}', ',"me":1}') : '{"v":1,"me":1}' }; });
  assert.deepStrictEqual(seen, [null, '{"v":1,"by":"동료"}']);
  assert.strictEqual(r.created, false); assert.strictEqual(r.updated, true); assert.strictEqual(r.version, '2.0');
  assert.strictEqual(F.file(RERP, 'P1.json').text, '{"v":1,"by":"동료","me":1}');
  await w.close();
  // 폴더가 없는데 만들려 하면 nofolder
  const G = fakeSp();
  const w2 = await SP.openWriter(CFG, { chrome: fakeChrome(G.fetch) });
  await rejects(w2.modify('P1.json', () => ({ changed: true, text: 'x' })), 'nofolder');
  await w2.close();
});

await test('writer.write: 없으면 생성, 있으면 체크아웃·PUT·체크인 · writer.remove: recycle() → removed, 없으면 false', async () => {
  const F = fakeSp({ folders: [RERP] });
  const w = await SP.openWriter(CFG, { chrome: fakeChrome(F.fetch) });
  const a = await w.write('P1.json', '{"a":1}');
  assert.strictEqual(a.created, true); assert.strictEqual(a.version, '1.0');
  const b = await w.write('P1.json', '{"a":2}', { comment: '둘째' });
  assert.strictEqual(b.updated, true); assert.strictEqual(b.version, '2.0');
  assert.strictEqual(F.file(RERP, 'P1.json').text, '{"a":2}'); assert.strictEqual(F.file(RERP, 'P1.json').lastComment, '둘째');
  const from = F.st.calls.length;
  assert.deepStrictEqual(await w.remove('P1.json'), { removed: true });
  assert.deepStrictEqual(calls(F, from), [`POST file(${RERP}/P1.json)/recycle()`]);
  assert.strictEqual(F.file(RERP, 'P1.json'), undefined);
  assert.deepStrictEqual(await w.remove('P1.json'), { removed: false });
  await w.close();
});

await test('writer.ensureFolder: 있으면 created:false(Folders/add 없음) · 없으면 부모의 Folders/add(이름) · 부모도 없으면 nofolder · 한글 폴더 이름', async () => {
  const F = fakeSp({ folders: [RERP] });
  const w = await SP.openWriter(CFG, { chrome: fakeChrome(F.fetch) });
  const from = F.st.calls.length;
  assert.deepStrictEqual(await w.ensureFolder(), { created: false });
  assert.deepStrictEqual(calls(F, from), [`GET folder(${RERP})?$select=Exists`]);
  await w.close();
  const G = fakeSp({ folders: [ME_PATH] });
  const w2 = await SP.openWriter(CFG, { chrome: fakeChrome(G.fetch) });
  const from2 = G.st.calls.length;
  assert.deepStrictEqual(await w2.ensureFolder(), { created: true });
  assert.deepStrictEqual(calls(G, from2), [`GET folder(${RERP})?$select=Exists`, `GET folder(${ME_PATH})?$select=Exists`, `POST folder(${ME_PATH})/Folders/add('RERP')`]);
  assert.ok(G.st.folders[RERP], '폴더가 생김');
  assert.deepStrictEqual(await w2.ensureFolder(), { created: false });
  await w2.close();
  const H = fakeSp();   // 부모(Documents)도 없음
  const w3 = await SP.openWriter(CFG, { chrome: fakeChrome(H.fetch) });
  await rejects(w3.ensureFolder(), 'nofolder', /상위 폴더가 없습니다/);
  await w3.close();
  const K = fakeSp({ folders: ['/sites/AIP/Shared Documents'] });
  const kcfg = SP.parseFolder("https://krclass.sharepoint.com/sites/AIP/Shared Documents/공유 자료's");
  const w4 = await SP.openWriter(kcfg, { chrome: fakeChrome(K.fetch) });
  assert.deepStrictEqual(await w4.ensureFolder(), { created: true });
  assert.ok(K.st.folders["/sites/AIP/Shared Documents/공유 자료's"], '한글·따옴표 이름이 디코딩돼 생김');
  assert.ok(calls(K).includes(`POST folder(/sites/AIP/Shared Documents)/Folders/add('${encodeURIComponent('공유 자료')}''s')`), '리터럴은 encodeURIComponent 뒤 \' → \'\'');
  await w4.close();
});

await test('listFolders: 하위 폴더 모양(name · path · itemCount · modified) · 문서함 뿌리의 Forms 는 뺌(아래 단의 Forms 는 둠) · 404 → nofolder · 빈 폴더는 Exists 로 가름 · 로그인 화면 → auth · 캐시 cfg · ServerRelativeUrl 없으면 folderPath/이름', async () => {
  const F = fakeSp({ folders: [ME_PATH, `${ME_PATH}/Forms`, `${ME_PATH}/업무`, `${ME_PATH}/업무/shared`, `${ME_PATH}/업무/shared/과제A`, `${ME_PATH}/업무/shared/과제A/Forms`, `${ME_PATH}/업무/shared/B-2026-0001`], files: { [`${ME_PATH}/업무/shared/과제A`]: { '1차년도.json': '{}', '2차년도.json': '{}' } } });
  const root = SP.parseFolder(`${ORIGIN}${ME_PATH}`);
  assert.strictEqual(root.libPath, ME_PATH);
  assert.deepStrictEqual(await SP.listFolders(root, { fetch: F.fetch }), [{ name: '업무', path: `${ME_PATH}/업무`, itemCount: 1, modified: '2026-10-18T03:04:05Z' }]);
  assert.deepStrictEqual(calls(F), [`GET folder(${ME_PATH})/Folders?$select=Name,ServerRelativeUrl,ItemCount,TimeLastModified`]);
  const base = SP.childCfg(root, '업무/shared');
  const list = await SP.listFolders(base, { fetch: F.fetch });
  assert.deepStrictEqual(list.map((f) => [f.name, f.path, f.itemCount]), [['과제A', `${ME_PATH}/업무/shared/과제A`, 3], ['B-2026-0001', `${ME_PATH}/업무/shared/B-2026-0001`, 0]]);
  assert.deepStrictEqual((await SP.listFolders(SP.childCfg(base, '과제A'), { fetch: F.fetch })).map((f) => f.name), ['Forms'], '뿌리가 아닌 곳의 Forms 는 그대로');
  const e = await rejects(SP.listFolders(SP.childCfg(base, '없음'), { fetch: F.fetch }), 'nofolder', /공유 폴더가 없습니다/);
  assert.strictEqual(e.path, `${ME_PATH}/업무/shared/없음`);
  const empty = SP.childCfg(base, 'B-2026-0001');
  const from = F.st.calls.length;
  assert.deepStrictEqual(await SP.listFolders(empty, { fetch: F.fetch }), []);
  assert.deepStrictEqual(calls(F, from), [`GET folder(${empty.folderPath})/Folders?$select=Name,ServerRelativeUrl,ItemCount,TimeLastModified`, `GET folder(${empty.folderPath})?$select=Exists`]);
  const fetch2 = async (u, i) => (String(u).includes('/Folders?') ? { ok: true, status: 200, url: '', json: async () => ({ value: [] }) } : F.fetch(u, i));   // 200 + 빈 목록 뒤 Exists:false
  await rejects(SP.listFolders(SP.childCfg(base, '없음'), { fetch: fetch2 }), 'nofolder');
  await rejects(SP.listFolders(base, { fetch: fakeSp({ loggedIn: false }).fetch }), 'auth', /로그인 화면/);
  await rejects(SP.listFolders(base, { fetch: async () => ({ ok: true, status: 200, url: '', json: async () => 'x' }) }), 'http', /JSON/);
  assert.strictEqual((await SP.listFolders(JSON.parse(JSON.stringify(base)), { fetch: F.fetch })).length, 2, '캐시 cfg 도 받음');
  const r = await SP.listFolders(base, { fetch: async () => ({ ok: true, status: 200, url: '', json: async () => ({ value: [{ Name: 'X' }] }) }) });
  assert.deepStrictEqual(r, [{ name: 'X', path: `${base.folderPath}/X`, itemCount: 0, modified: '' }]);
});

await test('childCfg: 하위 폴더 cfg — 같은 사이트 · folderPath/api/viewUrl · mine 상속 · url 은 폴더 주소(parseFolder 왕복) · 여러 단 · libPath 그대로 · 금지 글자·빈 이름 badurl · 캐시 cfg 도 받음', () => {
  const mine = Object.assign(SP.parseFolder(`${ORIGIN}${ME_PATH}/업무/shared`), { mine: true });
  const c = SP.childCfg(mine, '과제A');
  assert.strictEqual(c.folderPath, `${ME_PATH}/업무/shared/과제A`);
  assert.strictEqual(c.siteUrl, mine.siteUrl); assert.strictEqual(c.api, mine.api); assert.strictEqual(c.libPath, ME_PATH); assert.strictEqual(c.name, '과제A'); assert.strictEqual(c.personal, true);
  assert.strictEqual(c.mine, true);
  assert.strictEqual(c.url, SP.folderUrl(c)); assert.strictEqual(SP.parseFolder(c.url).folderPath, c.folderPath);
  assert.strictEqual(c.viewUrl, `${mine.siteUrl}/_layouts/15/onedrive.aspx?id=${encodeURIComponent(c.folderPath)}`);
  assert.strictEqual(c.fileApi('1차년도.json'), `${mine.api}/GetFileByServerRelativePath(decodedurl='${encodeURIComponent(`${c.folderPath}/1차년도.json`)}')`);
  assert.strictEqual(c.fileUrl('예상비용.json'), `${ORIGIN}${ME_PATH}/${encodeURIComponent('업무')}/shared/${encodeURIComponent('과제A')}/${encodeURIComponent('예상비용.json')}`);
  const two = SP.childCfg(SP.parseFolder(`${ORIGIN}${ME_PATH}`), '업무/shared');
  assert.strictEqual(two.folderPath, `${ME_PATH}/업무/shared`); assert.strictEqual(two.mine, false);
  const team = SP.childCfg(SP.parseFolder('https://krclass.sharepoint.com/sites/AIP/Shared Documents/공유'), "RERP's #1");
  assert.strictEqual(team.folderPath, "/sites/AIP/Shared Documents/공유/RERP's #1"); assert.strictEqual(team.libPath, '/sites/AIP/Shared Documents');
  assert.ok(team.viewUrl.includes('/Forms/AllItems.aspx?id='));
  assert.strictEqual(SP.parseFolder(team.url).folderPath, team.folderPath, "# 과 ' 도 왕복");
  throws(() => SP.childCfg(mine, ''), 'badurl', /비어/); throws(() => SP.childCfg(mine, '/'), 'badurl'); throws(() => SP.childCfg(mine, 'a:b'), 'badurl', /글자/); throws(() => SP.childCfg(mine, '..'), 'badurl');
  assert.strictEqual(SP.childCfg(JSON.parse(JSON.stringify(mine)), 'X').folderPath, `${ME_PATH}/업무/shared/X`);
  assert.strictEqual(SP.revive(JSON.parse(JSON.stringify(c))).libPath, ME_PATH, '캐시에서 되살려도 libPath');
});

await test('writer.ensurePath / ensureFolder(path): 여러 단(업무/shared 둘 다 없으면 위로 올라가 있는 단을 찾고 아래로 add) · 한 단 · 문서함 뿌리가 없으면 nofolder(뿌리 위로는 안 올라감) · 인수 없으면 writer 폴더 · 다른 사이트·상대 경로 badurl · 다이제스트 만료 중간에도 끝까지', async () => {
  const base = SP.parseFolder(`${ORIGIN}${ME_PATH}/업무/shared`);
  const F = fakeSp({ folders: [ME_PATH] });
  const w = await SP.openWriter(base, { chrome: fakeChrome(F.fetch) });
  const from = F.st.calls.length;
  assert.deepStrictEqual(await w.ensurePath(), { created: true, made: [`${ME_PATH}/업무`, `${ME_PATH}/업무/shared`] });
  assert.deepStrictEqual(calls(F, from), [
    `GET folder(${ME_PATH}/업무/shared)?$select=Exists`, `GET folder(${ME_PATH}/업무)?$select=Exists`, `GET folder(${ME_PATH})?$select=Exists`,
    `POST folder(${ME_PATH})/Folders/add('${encodeURIComponent('업무')}')`, `POST folder(${ME_PATH}/업무)/Folders/add('shared')`
  ]);
  assert.ok(F.st.folders[`${ME_PATH}/업무/shared`]);
  assert.deepStrictEqual(await w.ensurePath(), { created: false, made: [] });
  assert.deepStrictEqual(await w.ensurePath(`${ME_PATH}/업무/shared/과제A`), { created: true, made: [`${ME_PATH}/업무/shared/과제A`] });
  assert.deepStrictEqual(await w.ensureFolder(SP.childCfg(base, 'B-2026-0001')), { created: true });
  assert.deepStrictEqual(await w.ensureFolder(SP.childCfg(base, 'B-2026-0001')), { created: false });
  assert.deepStrictEqual(await w.ensureFolder(`${ME_PATH}/업무/shared/과제A/`), { created: false }, '끝 / 는 떼고');
  assert.ok(F.st.folders[`${ME_PATH}/업무/shared/B-2026-0001`]);
  await rejects(w.ensurePath('/personal/other_krs_co_kr/Documents/업무/shared'), 'badurl', /사이트.*밖/);
  await rejects(w.ensurePath(SP.parseFolder('https://krclass.sharepoint.com/sites/AIP/Shared Documents/x')), 'badurl', /밖/);
  await rejects(w.ensurePath('relative/path'), 'badurl', /서버 상대/);
  await rejects(w.ensurePath(`${ME_PATH}/a<b`), 'badurl', /글자/);
  await w.close();
  // 문서함 뿌리(Documents)가 없으면 nofolder — 사이트 뿌리에 만들려 하지 않는다
  const G = fakeSp();
  const w2 = await SP.openWriter(base, { chrome: fakeChrome(G.fetch) });
  await rejects(w2.ensurePath(), 'nofolder', new RegExp(`상위 폴더가 없습니다: ${ME_PATH}$`));
  assert.ok(!calls(G).some((c) => c.startsWith('POST folder(')), '만들기 시도 없음');
  assert.ok(!calls(G).includes('GET folder(/personal/kimghw_krs_co_kr)?$select=Exists'), '사이트 뿌리는 보지 않음');
  await w2.close();
  // 둘째 단을 만드는 사이에 다이제스트가 만료돼도 새로 받아 이어 만든다(이미 만든 단은 Exists 로 건너뜀)
  const K = fakeSp({ folders: [ME_PATH] });
  let armed = true;
  const C = fakeChrome(async (u, i) => { const r = await K.fetch(u, i); if (armed && /Folders\/add/.test(String(u))) { armed = false; K.expire(); } return r; });
  const w3 = await SP.openWriter(base, { chrome: C });
  const r3 = await w3.ensurePath();
  assert.deepStrictEqual([r3.created, K.st.digestIssued, !!K.st.folders[`${ME_PATH}/업무/shared`]], [true, 2, true]);
  assert.strictEqual(calls(K).filter((c) => c.includes('Folders/add')).length, 3, '업무(성공) · shared(403 거부) · shared(다시)');
  await w3.close();
  // 팀 사이트: 문서함 뿌리 Shared Documents 아래 두 단
  const T = fakeSp({ folders: ['/sites/AIP/Shared Documents'] });
  const tcfg = SP.parseFolder('https://krclass.sharepoint.com/sites/AIP/Shared Documents/RERP/shared');
  const w4 = await SP.openWriter(tcfg, { chrome: fakeChrome(T.fetch) });
  assert.deepStrictEqual(await w4.ensurePath(), { created: true, made: ['/sites/AIP/Shared Documents/RERP', '/sites/AIP/Shared Documents/RERP/shared'] });
  await w4.close();
});

await test('sharedWithMe: @odata.nextLink 2쪽을 끝까지 · 폴더/파일 flag · 폴더 주소(remoteItem.webUrl 우선)가 풀리면 cfg(주인의 personal 사이트) · 공유 링크 모양·파일·다른 호스트는 cfg 없이 · ownerName · 404 → [] · 403/로그인 화면 → auth · maxPages · 다른 호스트 nextLink 는 안 따라감', async () => {
  const other = `${ORIGIN}/personal/moon_krs_co_kr/Documents/${encodeURIComponent('업무')}/shared`;
  const pages = [
    { value: [
      { name: '과제A', folder: { childCount: 2 }, webUrl: `${ORIGIN}/:f:/g/personal/moon_krs_co_kr/EabcA?e=1`, remoteItem: { name: '과제A', folder: { childCount: 2 }, webUrl: `${other}/${encodeURIComponent('과제A')}`, shared: { owner: { user: { displayName: '문창재' } } }, parentReference: { driveId: 'b!m' } } },
      { name: '보고서.docx', file: { mimeType: 'x' }, webUrl: `${ORIGIN}/:w:/g/personal/moon_krs_co_kr/Edoc`, remoteItem: { file: {}, webUrl: `${other}/${encodeURIComponent('보고서.docx')}`, createdBy: { user: { displayName: '문창재' } } } },
      { name: 'shared', folder: {}, remoteItem: { folder: {}, webUrl: other, shared: { owner: { user: { displayName: '문창재' } } } } }
    ] },
    { value: [
      { name: '링크만', folder: {}, webUrl: `${ORIGIN}/:f:/g/personal/x_krs_co_kr/Eonly?e=2` },   // remoteItem 없음 — 공유 링크 모양이라 cfg 없음
      { name: '팀 폴더', folder: {}, remoteItem: { folder: {}, webUrl: 'https://krclass.sharepoint.com/sites/AIP/Shared%20Documents/RERP', createdBy: { user: { displayName: '팀' } } } },
      { name: '다른 호스트', folder: {}, remoteItem: { folder: {}, webUrl: 'https://example.com/x/y' } },
      null, 'junk'
    ] }
  ];
  const F = fakeSp({ shared: pages });
  const list = await SP.sharedWithMe({ fetch: F.fetch }, { driveHost: ORIGIN });
  assert.deepStrictEqual(calls(F), ['GET sharedWithMe#0', 'GET sharedWithMe#1']);
  assert.deepStrictEqual(list.map((x) => [x.name, x.folder, x.ownerName, !!x.cfg]), [['과제A', true, '문창재', true], ['보고서.docx', false, '문창재', false], ['shared', true, '문창재', true], ['링크만', true, '', false], ['팀 폴더', true, '팀', true], ['다른 호스트', true, '', false]]);
  assert.strictEqual(list[0].webUrl, `${other}/${encodeURIComponent('과제A')}`, 'remoteItem.webUrl 우선');
  assert.strictEqual(list[0].cfg.folderPath, '/personal/moon_krs_co_kr/Documents/업무/shared/과제A');
  assert.strictEqual(list[0].cfg.siteUrl, `${ORIGIN}/personal/moon_krs_co_kr`, '주인의 personal 사이트 — writer 는 사이트마다');
  assert.strictEqual(list[0].cfg.mine, false);
  assert.strictEqual(list[2].cfg.folderPath, '/personal/moon_krs_co_kr/Documents/업무/shared');
  assert.strictEqual(list[4].cfg.folderPath, '/sites/AIP/Shared Documents/RERP');
  assert.strictEqual(list[3].webUrl, `${ORIGIN}/:f:/g/personal/x_krs_co_kr/Eonly?e=2`);
  assert.deepStrictEqual(Object.keys(list[1]), ['name', 'webUrl', 'folder', 'ownerName'], '파일은 cfg 칸 없음');
  const G = fakeSp({ shared: pages });
  assert.strictEqual((await SP.sharedWithMe({ fetch: G.fetch }, { driveHost: ORIGIN, maxPages: 1 })).length, 3);
  assert.deepStrictEqual(calls(G), ['GET sharedWithMe#0']);
  assert.deepStrictEqual(await SP.sharedWithMe({ fetch: fakeSp().fetch }), [], '기본 driveHost · 빈 목록');
  assert.deepStrictEqual(await SP.sharedWithMe({ fetch: fakeSp({ noShared: true }).fetch }), [], '끝점 없음(404)은 빈 목록');
  await rejects(SP.sharedWithMe({ fetch: fakeSp({ deny403: true }).fetch }), 'auth');
  await rejects(SP.sharedWithMe({ fetch: fakeSp({ loggedIn: false }).fetch }), 'auth', /로그인 화면/);
  await rejects(SP.sharedWithMe({ fetch: async () => { throw new Error('down'); } }), 'offline');
  await rejects(SP.sharedWithMe({ fetch: async () => ({ ok: true, status: 200, url: '', json: async () => ({ x: 1 }) }) }), 'http', /JSON/);
  await rejects(SP.sharedWithMe({ fetch: async () => ({ ok: false, status: 500, url: '', json: async () => ({}) }) }), 'http');
  await rejects(SP.sharedWithMe({ fetch: F.fetch }, { driveHost: 'nope' }), 'badurl');
  let n = 0;
  const far = async () => ({ ok: true, status: 200, url: '', json: async () => (n++ === 0 ? { value: [], '@odata.nextLink': 'https://evil.example/next' } : { value: [{ name: 'x' }] }) });
  assert.deepStrictEqual(await SP.sharedWithMe({ fetch: far }), []); assert.strictEqual(n, 1);
  // 상대 경로 nextLink 도 같은 호스트로
  let seen = [];
  const rel = async (u) => { seen.push(String(u)); return { ok: true, status: 200, url: '', json: async () => (seen.length === 1 ? { value: [], '@odata.nextLink': '/_api/v2.0/me/drive/sharedWithMe?$skiptoken=z' } : { value: [] }) }; };
  await SP.sharedWithMe({ fetch: rel });
  assert.deepStrictEqual(seen, [`${SP.DEFAULT_DRIVE_HOST}/_api/v2.0/me/drive/sharedWithMe`, `${SP.DEFAULT_DRIVE_HOST}/_api/v2.0/me/drive/sharedWithMe?$skiptoken=z`]);
});

await test('writer.sharePeople: 이름마다 피커 검색(표시 이름이 꼭 같은(공백 무시) 1명 → 그 사람 · 1명이어도 이름이 다르면(접두 일치) ambiguous · 여럿(비슷한 이름·동명이인) → ambiguous · 0명 → notFound) → 모인 사람을 ShareObject 한 번에(odata=verbose · 다이제스트 · roleValue · peoplePickerInput 은 피커 항목 JSON 문자열 · url 은 폴더 절대 주소 · sendEmail:false)', async () => {
  const base = SP.parseFolder(`${ORIGIN}${ME_PATH}/업무/shared`);
  const folder = `${ME_PATH}/업무/shared/과제A`;
  const F = fakeSp({ folders: [folder], people: PEOPLE });
  const w = await SP.openWriter(base, { chrome: fakeChrome(F.fetch) });
  const from = F.st.calls.length;
  const r = await w.sharePeople(folder, ['문창재', '김철수', ' 이영희 ', '박보람', '없는사람', '문창재', '', null]);
  assert.deepStrictEqual(r, {
    shared: [{ name: '문창재', email: 'moon@krs.co.kr' }, { name: '김철수', email: 'kim1@krs.co.kr' }],
    ambiguous: [{ name: '이영희', candidates: ['이영희 (연구)', '이영희 (기획)'] }, { name: '박보람', candidates: ['박보람', '박보람'] }],
    notFound: ['없는사람'], failed: []
  });
  assert.deepStrictEqual(calls(F, from), ['POST peoplePicker', 'POST peoplePicker', 'POST peoplePicker', 'POST peoplePicker', 'POST peoplePicker', 'POST ShareObject'], '이름 5개(중복·빈 것 제외) 검색 뒤 공유 한 번');
  assert.deepStrictEqual(F.st.pickerBodies.map((p) => p.body.queryParams.QueryString), ['문창재', '김철수', '이영희', '박보람', '없는사람']);
  assert.deepStrictEqual(F.st.pickerBodies[0].body, { queryParams: { AllowEmailAddresses: true, AllowMultipleEntities: false, AllUrlZones: false, MaximumEntitySuggestions: 10, PrincipalSource: 15, PrincipalType: 1, QueryString: '문창재' } });
  assert.strictEqual(F.st.pickerBodies[0].headers['Content-Type'], 'application/json;odata=verbose');
  assert.strictEqual(F.st.shareBodies.length, 1);
  const s = F.st.shareBodies[0];
  assert.strictEqual(s.headers.Accept, 'application/json;odata=verbose'); assert.strictEqual(s.headers['Content-Type'], 'application/json;odata=verbose');
  assert.ok(F.st.validDigests.has(s.headers['X-RequestDigest']), '다이제스트를 실음');
  assert.strictEqual(s.body.url, `${ORIGIN}${folder}`, '폴더 절대 주소(디코딩)');
  assert.strictEqual(s.body.roleValue, 'role:1073741827'); assert.strictEqual(SP.ROLE_EDIT, 'role:1073741827'); assert.strictEqual(SP.ROLE_READ, 'role:1073741826');
  assert.strictEqual(typeof s.body.peoplePickerInput, 'string', 'JSON 문자열');
  assert.deepStrictEqual(JSON.parse(s.body.peoplePickerInput).map((e) => [e.Key, e.DisplayText, e.EntityData.Email]), [['i:0#.f|membership|KEY-SECRET-moon@krs.co.kr', '문창재', 'moon@krs.co.kr'], ['i:0#.f|membership|KEY-SECRET-kim1@krs.co.kr', '김철수', 'kim1@krs.co.kr']], '피커 결과 항목 그대로(Key 포함)');
  assert.deepStrictEqual([s.body.groupId, s.body.propagateAcl, s.body.sendEmail, s.body.includeAnonymousLinkInEmail, s.body.emailSubject, s.body.emailBody], [0, false, false, false, '', '']);
  assert.deepStrictEqual(F.st.shares, [{ url: `${ORIGIN}${folder}`, roleValue: 'role:1073741827', emails: ['moon@krs.co.kr', 'kim1@krs.co.kr'] }]);
  // 읽기 역할 · cfg 인수 · 문자열 하나 · 비면 writer 폴더
  const r2 = await w.sharePeople(SP.childCfg(base, '과제A'), '문창재', { role: 'read' });
  assert.deepStrictEqual(r2.shared, [{ name: '문창재', email: 'moon@krs.co.kr' }]);
  assert.strictEqual(F.st.shareBodies[1].body.roleValue, 'role:1073741826');
  const r3 = await w.sharePeople(null, ['문창재']);
  assert.strictEqual(F.st.shareBodies[2].body.url, `${ORIGIN}${ME_PATH}/업무/shared`);
  assert.strictEqual(r3.shared.length, 1);
  // 빈 이름 → 호출 없이 빈 결과 · 공유할 사람이 없으면 ShareObject 없음
  const from2 = F.st.calls.length;
  assert.deepStrictEqual(await w.sharePeople(folder, []), { shared: [], ambiguous: [], notFound: [], failed: [] });
  assert.deepStrictEqual(await w.sharePeople(folder, [' ', null]), { shared: [], ambiguous: [], notFound: [], failed: [] });
  assert.deepStrictEqual(await w.sharePeople(folder), { shared: [], ambiguous: [], notFound: [], failed: [] });
  assert.strictEqual(calls(F, from2).length, 0);
  const r4 = await w.sharePeople(folder, ['없는사람', '이영희']);
  assert.deepStrictEqual([r4.shared, r4.notFound, r4.ambiguous.length], [[], ['없는사람'], 1]);
  assert.ok(!calls(F, from2).includes('POST ShareObject'), '공유할 사람이 없으면 ShareObject 안 부름');
  // 1명이 왔어도 표시 이름이 질문한 이름과 다르면(ERP 참여인력 '이영' 이 디렉터리에 없어 접두 일치 '이영희' 한 사람) 그 사람에게 주지 않고 ambiguous — 자동 공유는 사람이 보지 않고 돈다
  const from3 = F.st.calls.length;
  const r5 = await w.sharePeople(folder, ['이영']);
  assert.deepStrictEqual(r5, { shared: [], ambiguous: [{ name: '이영', candidates: ['이영희'] }], notFound: [], failed: [] });
  assert.ok(!calls(F, from3).includes('POST ShareObject'));
  const r6 = await w.sharePeople(folder, ['홍길동']);
  assert.deepStrictEqual(r6.shared, [{ name: '홍 길동', email: 'hong@krs.co.kr' }], '공백만 다른 표시 이름은 같은 이름');
  await rejects(w.sharePeople('/personal/moon_krs_co_kr/Documents/업무/shared/과제A', ['문창재']), 'badurl', /밖/);
  await w.close();
});

await test('writer.at(cfg|경로): 같은 사이트의 다른 폴더에 묶인 writer — 같은 작업 창·다이제스트(창 하나 · contextinfo 한 번), modify/write/remove/ensurePath/sharePeople 의 폴더가 그 폴더, close 는 no-op(원래 writer 의 close 가 창을 닫음) · 사이트 밖은 badurl', async () => {
  const base = SP.parseFolder(`${ORIGIN}${BASE}`);
  const A = `${BASE}/과제A`, B = `${BASE}/과제B`;
  const F = fakeSp({ folders: [BASE, A], people: PEOPLE });
  const C = fakeChrome(F.fetch);
  const w = await SP.openWriter(base, { chrome: C });
  const a = w.at(SP.childCfg(base, '과제A'));
  assert.deepStrictEqual([a.folderPath, a.tabId, a.windowId, typeof a.at, typeof a.modify, typeof a.close], [A, w.tabId, w.windowId, 'function', 'function', 'function']);
  const from = F.st.calls.length;
  const r = await a.modify('1차년도.json', (cur) => ({ changed: true, text: `{"v":2,"kind":"year","cur":${JSON.stringify(cur)}}` }));
  assert.deepStrictEqual([r.created, F.file(A, '1차년도.json').text, F.file(BASE, '1차년도.json')], [true, '{"v":2,"kind":"year","cur":null}', undefined], '과제A 폴더에 만듦(base 가 아님)');
  assert.deepStrictEqual(calls(F, from), [`GET file(${A}/1차년도.json)?$select=Exists,CheckOutType,UniqueId,UIVersionLabel,Length,TimeLastModified`, `POST folder(${A})/Files/add(url='${encodeURIComponent('1차년도.json')}',overwrite=false)`]);
  await a.write('예상비용.json', '{"v":2,"kind":"plan"}');
  assert.strictEqual(F.file(A, '예상비용.json').text, '{"v":2,"kind":"plan"}');
  assert.strictEqual((await a.remove('예상비용.json')).removed, true); assert.strictEqual(F.file(A, '예상비용.json'), undefined);
  // 경로 문자열로도 · 없는 폴더는 ensurePath()(인수 없음 = 그 폴더) 로
  const b = w.at(B);
  assert.strictEqual(b.folderPath, B);
  assert.deepStrictEqual(await b.ensurePath(), { created: true, made: [B] });
  assert.ok(F.st.folders[B]);
  assert.deepStrictEqual(await b.ensurePath(), { created: false, made: [] }, '이미 있으면 created:false');
  await b.write('1차년도.json', '{"v":2}');
  assert.strictEqual(F.file(B, '1차년도.json').text, '{"v":2}');
  // sharePeople 의 기본 폴더도 그 폴더
  const s = await a.sharePeople(null, ['문창재']);
  assert.deepStrictEqual([s.shared.length, F.st.shareBodies[F.st.shareBodies.length - 1].body.url], [1, `${ORIGIN}${A}`]);
  // 창 하나 · 다이제스트 한 번 · 하위 writer 의 close 는 창을 두고, 원래 writer 가 닫는다
  assert.deepStrictEqual([C.log.filter((l) => l[0] === 'create').length, F.st.digestIssued, Object.keys(C.windows_).length], [1, 1, 1]);
  await a.close(); await b.close();
  assert.strictEqual(Object.keys(C.windows_).length, 1, '하위 writer 의 close 는 no-op');
  assert.strictEqual((await a.write('2차년도.json', '{"v":2}')).created, true, '닫은 뒤에도(원래 writer 가 살아 있으면) 쓸 수 있다');
  // 사이트 밖 → badurl(다른 personal 사이트 · 다른 origin)
  throws(() => w.at('/personal/moon_krs_co_kr/Documents/업무/shared/과제A'), 'badurl', /밖/);
  throws(() => w.at(SP.parseFolder('https://krclass.sharepoint.com/sites/AIP/Shared Documents/x')), 'badurl', /밖/);
  throws(() => a.at(SP.parseFolder('https://krclass.sharepoint.com/sites/AIP/Shared Documents/x')), 'badurl', /밖/);
  await w.close();
  assert.strictEqual(Object.keys(C.windows_).length, 0, '원래 writer 의 close 가 창을 닫음');
});

await test('writer.sharePeople: ShareObject 가 StatusCode ≠ 0 이면 한 명씩 다시 돌려 안 되는 사람만 failed(+error 요지) · HTTP 500 도 같은 길(본문 요지) · 피커 403 → auth · 다이제스트 만료는 다시 받아 한 번 더 · nometadata 응답(value)도 읽음', async () => {
  const base = SP.parseFolder(`${ORIGIN}${ME_PATH}/업무/shared`);
  const folder = `${ME_PATH}/업무/shared/과제A`;
  const F = fakeSp({ folders: [folder], people: PEOPLE, shareFailEmails: ['kim1@krs.co.kr'] });
  const w = await SP.openWriter(base, { chrome: fakeChrome(F.fetch) });
  const from = F.st.calls.length;
  const r = await w.sharePeople(folder, ['문창재', '김철수']);
  assert.deepStrictEqual(r.shared, [{ name: '문창재', email: 'moon@krs.co.kr' }]);
  assert.deepStrictEqual(r.failed, [{ name: '김철수', email: 'kim1@krs.co.kr', error: '공유 실패(StatusCode 1): 초대할 수 없는 사용자: kim1@krs.co.kr' }]);
  assert.ok(/^김철수: 공유 실패\(StatusCode 1\)/.test(r.error), r.error);
  assert.deepStrictEqual(r.ambiguous, []); assert.deepStrictEqual(r.notFound, []);
  assert.strictEqual(calls(F, from).filter((c) => c === 'POST ShareObject').length, 3, '한 번에(실패) → 한 명씩 둘');
  assert.deepStrictEqual(F.st.shares.map((s) => s.emails), [['moon@krs.co.kr']]);
  const from2 = F.st.calls.length;
  const r2 = await w.sharePeople(folder, ['김철수']);
  assert.deepStrictEqual([r2.shared, r2.failed.length, calls(F, from2).filter((c) => c === 'POST ShareObject').length], [[], 1, 1], '한 명만 실패 — 다시 돌 것 없음');
  await w.close();
  const G = fakeSp({ folders: [folder], people: PEOPLE, shareHttp: 500 });
  const w2 = await SP.openWriter(base, { chrome: fakeChrome(G.fetch) });
  const r3 = await w2.sharePeople(folder, ['문창재']);
  assert.deepStrictEqual([r3.shared, r3.failed.length], [[], 1]);
  assert.ok(/^공유 500: .*ShareObject boom/.test(r3.failed[0].error), r3.failed[0].error);
  assert.strictEqual(r3.error, `문창재: ${r3.failed[0].error}`);
  await w2.close();
  const K = fakeSp({ folders: [folder], people: PEOPLE });
  const w3 = await SP.openWriter(base, { chrome: fakeChrome(K.fetch) });
  K.expire();
  const r4 = await w3.sharePeople(folder, ['문창재']);
  assert.deepStrictEqual([r4.shared.length, K.st.digestIssued], [1, 2], '피커 403 security validation → 새 다이제스트로 다시');
  await w3.close();
  const D = fakeSp({ folders: [folder], people: PEOPLE });
  const w4 = await SP.openWriter(base, { chrome: fakeChrome(async (u, i) => (String(u).endsWith('clientPeoplePickerSearchUser') ? { ok: false, status: 403, url: '', json: async () => ({}), text: async () => 'Access denied' } : D.fetch(u, i))) });
  await rejects(w4.sharePeople(folder, ['문창재']), 'auth');
  await w4.close();
  const N = fakeSp({ folders: [folder], people: PEOPLE });
  const w5 = await SP.openWriter(base, { chrome: fakeChrome(async (u, i) => { if (/clientPeoplePickerSearchUser$|SP\.Web\.ShareObject$/.test(String(u))) i = Object.assign({}, i, { headers: Object.assign({}, i.headers, { Accept: 'application/json;odata=nometadata' }) }); return N.fetch(u, i); }) });
  const r5 = await w5.sharePeople(folder, ['문창재']);
  assert.deepStrictEqual(r5.shared, [{ name: '문창재', email: 'moon@krs.co.kr' }]);
  await w5.close();
});

await test('writer.orgLink: ListItemAllFields(Id·ParentList/Id) → Lists(guid)/GetItemById/ShareLink(createLink · linkKind 3 편집 / 2 보기 · expiration null) → sharingLinkInfo.Url · 안 되면 SP.Web.CreateOrganizationSharingLink(url, isEditLink) · 둘 다 안 되면 http 에 본문 요지 · 폴더 없으면 ShareLink 건너뜀 · 다이제스트 만료', async () => {
  const base = SP.parseFolder(`${ORIGIN}${ME_PATH}/업무/shared`);
  const folder = `${ME_PATH}/업무/shared/과제A`;
  const F = fakeSp({ folders: [`${ME_PATH}/업무/shared`, folder] });
  const w = await SP.openWriter(base, { chrome: fakeChrome(F.fetch) });
  const from = F.st.calls.length;
  const r = await w.orgLink(folder);
  assert.deepStrictEqual(r, { url: `${ORIGIN}/:f:/g/personal/kimghw_krs_co_kr/EOrgLink3?e=abc`, edit: true, via: 'ShareLink' });
  assert.deepStrictEqual(calls(F, from), [`GET folder(${folder})/ListItemAllFields?$select=Id,ParentList/Id&$expand=ParentList`, 'POST ShareLink(aaaabbbb-0000-0000-0000-000000000001,42)']);
  assert.deepStrictEqual(F.st.linkBodies[0].body, { request: { createLink: true, settings: { linkKind: 3, expiration: null } } });
  assert.ok(F.st.validDigests.has(F.st.linkBodies[0].headers['X-RequestDigest']));
  const v = await w.orgLink(SP.childCfg(base, '과제A'), { edit: false });
  assert.deepStrictEqual([v.url.includes('EOrgLink2'), v.edit, v.via], [true, false, 'ShareLink']);
  assert.strictEqual((await w.orgLink()).via, 'ShareLink', '인수 없으면 writer 폴더');
  await rejects(w.orgLink('/sites/AIP/Shared Documents/x'), 'badurl', /밖/);
  await w.close();
  const G = fakeSp({ folders: [folder], noShareLink: true });
  const w2 = await SP.openWriter(base, { chrome: fakeChrome(G.fetch) });
  const r2 = await w2.orgLink(folder);
  assert.deepStrictEqual(r2, { url: `${ORIGIN}/:f:/g/personal/kimghw_krs_co_kr/EFallback?e=edit`, edit: true, via: 'CreateOrganizationSharingLink' });
  assert.deepStrictEqual(G.st.linkBodies.map((l) => l.at), ['ShareLink', 'CreateOrganizationSharingLink']);
  assert.deepStrictEqual(G.st.linkBodies[1].body, { url: `${ORIGIN}${folder}`, isEditLink: true });
  assert.strictEqual((await w2.orgLink(folder, { edit: false })).url, `${ORIGIN}/:f:/g/personal/kimghw_krs_co_kr/EFallback?e=view`);
  await w2.close();
  const H = fakeSp({ folders: [folder], noShareLink: true, noOrgLink: true });
  const w3 = await SP.openWriter(base, { chrome: fakeChrome(H.fetch) });
  const e = await rejects(w3.orgLink(folder), 'http', /ShareLink 400: .*not supported.*CreateOrganizationSharingLink 400: .*disabled by policy/);
  assert.strictEqual(e.status, 400);
  await w3.close();
  const K = fakeSp({ folders: [folder], noOrgLink: true });
  const w4 = await SP.openWriter(base, { chrome: fakeChrome(K.fetch) });
  await rejects(w4.orgLink(`${ME_PATH}/업무/shared/없음`), 'http', /항목 정보 404/);
  assert.ok(!calls(K).some((c) => c.startsWith('POST ShareLink')), 'ShareLink 시도 없음');
  await w4.close();
  const D = fakeSp({ folders: [folder] });
  const w5 = await SP.openWriter(base, { chrome: fakeChrome(D.fetch) });
  D.expire();
  assert.strictEqual((await w5.orgLink(folder)).via, 'ShareLink'); assert.strictEqual(D.st.digestIssued, 2);
  await w5.close();
});

await test('writer.rename: MoveTo(newUrl=<부모>/<새 이름>) 로 폴더(하위·파일까지) 이름 바꾸기 → { path, name, changed, url } · 같은 이름이면 호출 없이 changed:false · 새 이름이 이미 있으면 http("이미 있습니다") · 없는 폴더 notfound · MoveTo 404 면 MoveToUsingPath · 금지 글자·문서함 뿌리·다른 사이트 badurl', async () => {
  const base = SP.parseFolder(`${ORIGIN}${ME_PATH}/업무/shared`);
  const F = fakeSp({ folders: [`${ME_PATH}/업무/shared`, `${ME_PATH}/업무/shared/2026-0063-01`, `${ME_PATH}/업무/shared/2026-0063-01/sub`, `${ME_PATH}/업무/shared/기존`], files: { [`${ME_PATH}/업무/shared/2026-0063-01`]: { '1차년도.json': '{}' } } });
  const w = await SP.openWriter(base, { chrome: fakeChrome(F.fetch) });
  const from = F.st.calls.length;
  const r = await w.rename(`${ME_PATH}/업무/shared/2026-0063-01`, "선체 AI's");
  assert.deepStrictEqual(r, { path: `${ME_PATH}/업무/shared/선체 AI's`, name: "선체 AI's", changed: true, url: `${ORIGIN}${ME_PATH}/${encodeURIComponent('업무')}/shared/${encodeURIComponent("선체 AI's")}` });
  assert.deepStrictEqual(calls(F, from), [`GET folder(${ME_PATH}/업무/shared/선체 AI's)?$select=Exists`, `POST folder(${ME_PATH}/업무/shared/2026-0063-01)/MoveTo(newUrl='${encodeURIComponent(`${ME_PATH}/업무/shared/선체 AI`)}''s')`]);
  assert.ok(F.st.folders[`${ME_PATH}/업무/shared/선체 AI's`] && F.st.folders[`${ME_PATH}/업무/shared/선체 AI's/sub`] && !F.st.folders[`${ME_PATH}/업무/shared/2026-0063-01`], '하위까지 옮겨짐');
  assert.ok(F.st.folders[`${ME_PATH}/업무/shared/선체 AI's`].files['1차년도.json'], '파일 보존');
  assert.strictEqual(SP.parseFolder(r.url).folderPath, r.path, '돌려준 주소가 새 폴더');
  const from2 = F.st.calls.length;
  assert.deepStrictEqual(await w.rename(`${ME_PATH}/업무/shared/기존`, '기존'), { path: `${ME_PATH}/업무/shared/기존`, name: '기존', changed: false, url: `${ORIGIN}${ME_PATH}/${encodeURIComponent('업무')}/shared/${encodeURIComponent('기존')}` });
  assert.strictEqual(calls(F, from2).length, 0);
  const e = await rejects(w.rename(SP.childCfg(base, "선체 AI's"), '기존'), 'http', /이미 있습니다/);
  assert.strictEqual(e.status, 409);
  assert.ok(F.st.folders[`${ME_PATH}/업무/shared/선체 AI's`], '그대로');
  await rejects(w.rename(`${ME_PATH}/업무/shared/기존`, 'a/b'), 'badurl', /파일 이름/);
  await rejects(w.rename(`${ME_PATH}/업무/shared/기존`, ''), 'badurl');
  await rejects(w.rename(ME_PATH, 'X'), 'badurl', /뿌리/);
  await rejects(w.rename('/personal/moon_krs_co_kr/Documents/x', 'y'), 'badurl', /밖/);
  await rejects(w.rename(`${ME_PATH}/업무/shared/없음`, 'y'), 'notfound');
  await w.close();
  const G = fakeSp({ folders: [`${ME_PATH}/업무/shared`, `${ME_PATH}/업무/shared/A`], noMoveTo: true });
  const w2 = await SP.openWriter(base, { chrome: fakeChrome(G.fetch) });
  const r2 = await w2.rename(`${ME_PATH}/업무/shared/A`, 'B');
  assert.deepStrictEqual([r2.changed, r2.path, !!G.st.folders[`${ME_PATH}/업무/shared/B`]], [true, `${ME_PATH}/업무/shared/B`, true]);
  assert.ok(calls(G).some((c) => c.includes('/MoveTo(newUrl=')) && calls(G).some((c) => c.includes('/MoveToUsingPath(DecodedUrl=')));
  G.expire();
  assert.strictEqual((await w2.rename(`${ME_PATH}/업무/shared/B`, 'C')).changed, true); assert.strictEqual(G.st.digestIssued, 2, '다이제스트 만료 → 다시');
  await w2.close();
});

await test('writer.close: 창에 우리 탭만 있으면 windows.remove, 사용자가 다른 탭을 옮겨 놓았으면 tabs.remove 만 · 탭이 사라져도 조용히', async () => {
  const F = fakeSp({ folders: [RERP] });
  const C = fakeChrome(F.fetch);
  const w = await SP.openWriter(CFG, { chrome: C });
  C.addTab(w.windowId);
  await w.close();
  assert.deepStrictEqual(C.log.slice(-1), [['tabs.remove', w.tabId]]);
  assert.strictEqual(C.windows_[w.windowId].tabs.length, 1, '다른 탭은 남음');
  const D = fakeChrome(F.fetch);
  const w2 = await SP.openWriter(CFG, { chrome: D });
  delete D.windows_[w2.windowId];   // 사용자가 이미 닫음
  await w2.close();
  // 닫힌 탭에서 페이지 함수를 돌리면 tab
  const E = fakeChrome(F.fetch);
  const w3 = await SP.openWriter(CFG, { chrome: E });
  E.scripting.executeScript = async () => { throw new Error('No tab with id: 12.'); };
  await rejects(w3.modify('P1.json', () => ({ changed: true, text: 'x' })), 'tab', /작업 탭/);
  E.scripting.executeScript = async () => [];
  await rejects(w3.ensureFolder(), 'tab', /결과 없음/);
  E.scripting.executeScript = async () => [{ error: { message: 'boom' } }];
  await rejects(w3.remove('P1.json'), 'tab', /boom/);
  await w3.close();
});

await test('쿠키·다이제스트 값이 결과·오류·writer 객체·호출 기록에 없다 (쿠키는 브라우저가 붙이고 다이제스트는 클로저에만)', async () => {
  const F = fakeSp({ files: { [RERP]: { 'P1.json': '{"a":1}', 'P2.json': '{"b":1}' } }, checkedOutBy: { 'P2.json': 99 } });
  const C = fakeChrome(F.fetch);
  const out = [];
  out.push(await SP.resolveMyFolder({ fetch: F.fetch }));
  out.push(await SP.listFiles(CFG, { fetch: F.fetch }));
  out.push(await SP.readFile(CFG, 'P1.json', { fetch: F.fetch }));
  const w = await SP.openWriter(CFG, { chrome: C });
  out.push(w);
  out.push(await w.modify('P1.json', () => ({ changed: true, text: '{"a":2}' })));
  out.push(await w.modify('P1.json', () => ({ changed: false })));
  out.push(await w.ensureFolder());
  try { await w.modify('P2.json', () => ({ changed: true, text: 'x' })); } catch (e) { out.push(SP.describe(e)); out.push({ message: e.message, stack: e.stack }); }
  await w.close();
  out.push(C.log);
  // v2: 폴더 목록 · 나와 공유 · 공유(피커 Key) · 링크 · 이름 바꾸기 · 여러 단
  const base2 = SP.parseFolder(`${ORIGIN}${ME_PATH}/업무/shared`);
  const F2 = fakeSp({ folders: [`${ME_PATH}/업무/shared`, `${ME_PATH}/업무/shared/과제A`], people: PEOPLE, shareFailEmails: ['kim1@krs.co.kr'], shared: [{ value: [{ name: '과제A', folder: {}, remoteItem: { folder: {}, webUrl: `${ORIGIN}/personal/moon_krs_co_kr/Documents/${encodeURIComponent('업무')}/shared/A` } }] }] });
  out.push(await SP.listFolders(base2, { fetch: F2.fetch }));
  out.push(await SP.sharedWithMe({ fetch: F2.fetch }));
  const C2 = fakeChrome(F2.fetch);
  const w2 = await SP.openWriter(base2, { chrome: C2 });
  out.push(await w2.sharePeople(`${ME_PATH}/업무/shared/과제A`, ['문창재', '김철수', '이영희', '박보람']));
  out.push(await w2.orgLink(`${ME_PATH}/업무/shared/과제A`));
  out.push(await w2.rename(`${ME_PATH}/업무/shared/과제A`, '과제B'));
  out.push(await w2.ensurePath(`${ME_PATH}/업무/shared/과제C`));
  try { await w2.rename(`${ME_PATH}/업무/shared/없음`, 'x'); } catch (e) { out.push(SP.describe(e)); out.push({ message: e.message, stack: e.stack }); }
  await w2.close();
  out.push(C2.log);
  const dump = JSON.stringify(out, (k, v) => (typeof v === 'function' ? `[fn ${v.name}]` : v));
  assert.ok(!dump.includes('SECRET-COOKIE'), '쿠키 값 없음');
  assert.ok(!dump.includes('DIGEST-SECRET'), '다이제스트 값 없음');
  assert.ok(!dump.includes('KEY-SECRET') && !dump.includes('i:0#.f|membership'), '피커 Key(로그인 이름) 없음');
  assert.ok(dump.includes('moon@krs.co.kr') && dump.includes('kim1@krs.co.kr'), '이름·이메일은 결과에 있음(공유 n명 표시용)');
  assert.ok(F.st.calls.length > 5 && F.st.digestIssued >= 1 && F2.st.shareBodies.length >= 2, '정말 다이제스트를 쓰는 요청이 있었다');
  assert.ok(!Object.keys(w).includes('digest') && !('digest' in w) && !('digest' in w2));
  assert.ok(F.st.calls.every((c) => !c.join(' ').includes('SECRET')) && F2.st.calls.every((c) => !c.join(' ').includes('SECRET')), '기록에도 없음');
});

await test('permissions: ListItemAllFields(RoleAssignments 펼침 — 확장 출처 GET, 다이제스트 없음) + currentuser → 사람(PrincipalType 1)만 people(PrincipalId · 표시 이름 · 이메일(없으면 LoginName 의 것) · 가장 센 역할: 참가 3 → edit · 읽기 2 → read · 모든 권한 5 → owner · 편집 6 → edit), 제한된 액세스(Hidden·kind 1)만 있는 사람·시스템 그룹은 빼고, SharingLinks 그룹은 links, 나(currentuser) 표시, 상속이면 unique:false · 없는 폴더 nofolder · 403 → auth · 로그인 화면 → auth', async () => {
  const cfg = SP.childCfg(SP.parseFolder(`${ORIGIN}${BASE}`), '과제A');
  const F = fakeSp({ folders: [PERM_FOLDER], perms: PERMS });
  const r = await SP.permissions(cfg, { fetch: F.fetch });
  assert.deepStrictEqual(calls(F).map((c) => c.replace(/\?.*$/, '')), [`GET folder(${PERM_FOLDER})/ListItemAllFields`, 'GET currentuser']);
  assert.ok(F.st.calls[0][1].includes('$expand=RoleAssignments/Member,RoleAssignments/RoleDefinitionBindings') && F.st.calls[0][1].includes('RoleAssignments/RoleDefinitionBindings/RoleTypeKind'));
  assert.strictEqual(r.unique, true);
  assert.deepStrictEqual(r.me, { id: ME, name: '', email: '' });
  assert.deepStrictEqual(r.people.map((p) => [p.id, p.name, p.email, p.login, p.role, p.roles.map((x) => x.id), p.me]), [
    [1909, 'MOON Changjae', 'moon@krs.co.kr', 'i:0#.f|membership|moon@krs.co.kr', 'edit', [1073741827], false],
    [1944, 'LEE Jaehoon', 'jhlee81@krs.co.kr', 'i:0#.f|membership|jhlee81@krs.co.kr', 'read', [1073741826], false],
    [2040, 'ROH Gilltae', 'gtroh@krs.co.kr', 'i:0#.f|membership|gtroh@krs.co.kr', 'owner', [1073741829, 1073741827], false],
    [ME, 'KIM Geohwa', 'kimghw@krs.co.kr', 'i:0#.f|membership|kimghw@krs.co.kr', 'edit', [1073741830], true],
  ], '제한된 액세스만 있는 YOON 과 시스템 그룹은 없고, 숨은 역할은 roles 에서도 빠진다');
  assert.deepStrictEqual(r.people[0].roles, [{ id: 1073741827, name: '참가', kind: 3 }]);
  assert.deepStrictEqual(r.links, [{ id: 3478, name: 'SharingLinks.70ebcbd6-e7ab-4052-b4c3-7bd3ed3f1648.OrganizationEdit.a30f6b6c', role: 'edit' }]);
  assert.ok(!JSON.stringify(r).includes('SECRET'));
  const G = fakeSp({ folders: [PERM_FOLDER] });
  const r2 = await SP.permissions(cfg, { fetch: G.fetch });
  assert.deepStrictEqual([r2.unique, r2.people, r2.links, r2.me.id], [false, [], [], ME], '상속(아무에게도 따로 주지 않음)');
  await rejects(SP.permissions(cfg, { fetch: fakeSp().fetch }), 'nofolder', /공유 폴더가 없습니다/);
  await rejects(SP.permissions(cfg, { fetch: fakeSp({ folders: [PERM_FOLDER], deny403: true }).fetch }), 'auth', /로그인/);
  await rejects(SP.permissions(cfg, { fetch: fakeSp({ loggedIn: false }).fetch }), 'auth', /로그인 화면/);
  await rejects(SP.permissions(JSON.parse(JSON.stringify(cfg)), { fetch: fakeSp().fetch }), 'nofolder');   // 캐시 cfg 도 받음
  assert.deepStrictEqual([SP.roleOf([{ kind: 2 }, { kind: 3 }]), SP.roleOf([{ kind: 0 }]), SP.roleOf([{ kind: 5 }, { kind: 2 }]), SP.roleOf([]), SP.roleOf(null)], ['edit', 'other', 'owner', '', '']);
});

await test('findPeople: 사이트 search REST(People 결과 원본 sourceid · querytext 리터럴(한글은 퍼센트 인코딩) · 확장 출처 GET) → 1명이면 그 사람(한글 질문 → 영문 PreferredName 이라도), 여럿이면 PreferredName/이메일이 꼭 같은 1명 아니면 ambiguous(후보 "이름 <이메일>"), 없으면 notFound, 이메일 없는 줄은 안 셈, 중복·빈 이름은 한 번·건너뜀, 빈 목록은 호출 없음 · verbose 응답 · 403 → auth', async () => {
  const cfg = SP.parseFolder(`${ORIGIN}${BASE}`);
  const F = fakeSp({ search: SEARCH });
  const r = await SP.findPeople(cfg, ['문창재', ' 김철수 ', 'kim2@krs.co.kr', 'LEE Jaehoon', '없는사람', '메일없음', '문창재', '', null], { fetch: F.fetch });
  assert.deepStrictEqual(r, {
    found: [{ name: '문창재', title: 'MOON Changjae', email: 'cjmoon@krs.co.kr', login: 'i:0#.f|membership|cjmoon@krs.co.kr' }, { name: 'kim2@krs.co.kr', title: 'KIM Chulsoo (해양)', email: 'kim2@krs.co.kr', login: 'i:0#.f|membership|kim2@krs.co.kr' }, { name: 'LEE Jaehoon', title: 'LEE Jaehoon', email: 'jhlee81@krs.co.kr', login: 'i:0#.f|membership|jhlee81@krs.co.kr' }],
    ambiguous: [{ name: '김철수', candidates: ['KIM Chulsoo <kim1@krs.co.kr>', 'KIM Chulsoo (해양) <kim2@krs.co.kr>'] }],
    notFound: ['없는사람', '메일없음'],
  });
  assert.deepStrictEqual(calls(F), ['GET search(문창재)', 'GET search(김철수)', 'GET search(kim2@krs.co.kr)', 'GET search(LEE Jaehoon)', 'GET search(없는사람)', 'GET search(메일없음)']);
  assert.strictEqual(F.st.searchUrls[0], `${ORIGIN}/personal/kimghw_krs_co_kr/_api/search/query?querytext='${encodeURIComponent('문창재')}'&sourceid='b09a7990-05ea-4af9-81ef-edfab16c4e31'&selectproperties='PreferredName,WorkEmail,AccountName'&rowlimit=10`);
  assert.strictEqual(SP.PEOPLE_SOURCE, 'b09a7990-05ea-4af9-81ef-edfab16c4e31');
  const g = await SP.findPeople(cfg, ['이은주', '외부인'], { fetch: F.fetch });
  assert.deepStrictEqual(g.found.map((x) => [x.name, x.email]), [['이은주', 'ejlee@krs.co.kr'], ['외부인', 'guest@gmail.com']], '게스트(#ext#)는 조직 사용자가 있으면 빼고(이름이 꼭 같아도), 게스트뿐이면 그 사람');
  assert.deepStrictEqual([g.ambiguous, g.notFound], [[], []]);
  const from = F.st.calls.length;
  assert.deepStrictEqual(await SP.findPeople(cfg, [], { fetch: F.fetch }), { found: [], ambiguous: [], notFound: [] });
  assert.deepStrictEqual(await SP.findPeople(cfg, [' ', null], { fetch: F.fetch }), { found: [], ambiguous: [], notFound: [] });
  assert.strictEqual(F.st.calls.length, from);
  const V = fakeSp({ search: SEARCH, searchVerbose: true });
  assert.deepStrictEqual((await SP.findPeople(cfg, '문창재', { fetch: V.fetch })).found.map((x) => x.email), ['cjmoon@krs.co.kr'], 'verbose(d.query … results) 도 읽는다 · 문자열 하나도 받는다');
  await rejects(SP.findPeople(cfg, ['문창재'], { fetch: fakeSp({ search: SEARCH, deny403: true }).fetch }), 'auth', /로그인/);
  await rejects(SP.findPeople(cfg, ['문창재'], { fetch: fakeSp({ loggedIn: false }).fetch }), 'auth', /로그인 화면/);
});

await test('writer.unshare: 사람(PrincipalId)마다 GetByPrincipalId(id)/RoleDefinitionBindings 로 역할을 읽어 Hidden·제한된 액세스가 아닌 역할마다 RemoveRoleAssignment(principalid,roledefid)(다이제스트) → { removed:[{ id, roles }], missing }, 없는 사람은 missing, 겹침·0·글자는 거름, 빈 목록은 호출 없음, 다이제스트 만료는 다시 받아 한 번 더, 거둔 뒤 permissions 에서 사라짐 · 이메일로 sharePeople(피커가 이메일로 찾은 1명 — 표시 이름은 영문, 이메일이 다르면 ambiguous)한 사람이 permissions 에 보임 · 사이트 밖 badurl', async () => {
  const base = SP.parseFolder(`${ORIGIN}${BASE}`);
  const cfg = SP.childCfg(base, '과제A');
  const F = fakeSp({ folders: [PERM_FOLDER], perms: PERMS, people: PEOPLE });
  const w = await SP.openWriter(base, { chrome: fakeChrome(F.fetch) });
  const from = F.st.calls.length;
  const r = await w.unshare(PERM_FOLDER, [1944, 2040, 999, 1944, 0, 'x']);
  assert.deepStrictEqual(r, { removed: [{ id: 1944, roles: [1073741826] }, { id: 2040, roles: [1073741829, 1073741827] }], missing: [999] });
  const item = `folder(${PERM_FOLDER})/ListItemAllFields/RoleAssignments`;
  assert.deepStrictEqual(calls(F, from).map((c) => c.replace(/\?.*$/, '')), [
    `GET ${item}/GetByPrincipalId(1944)/RoleDefinitionBindings`, `POST ${item}/RemoveRoleAssignment(principalid=1944,roledefid=1073741826)`,
    `GET ${item}/GetByPrincipalId(2040)/RoleDefinitionBindings`, `POST ${item}/RemoveRoleAssignment(principalid=2040,roledefid=1073741829)`, `POST ${item}/RemoveRoleAssignment(principalid=2040,roledefid=1073741827)`,
    `GET ${item}/GetByPrincipalId(999)/RoleDefinitionBindings`,
  ], '제한된 액세스(숨은 역할)는 거두지 않는다');
  assert.deepStrictEqual(F.st.unshares, [[PERM_FOLDER, 1944, 1073741826], [PERM_FOLDER, 2040, 1073741829], [PERM_FOLDER, 2040, 1073741827]]);
  const perms = await SP.permissions(cfg, { fetch: F.fetch });
  assert.deepStrictEqual(perms.people.map((p) => [p.id, p.role]), [[1909, 'edit'], [ME, 'edit']], '거둔 사람은 없고(LEE 는 제한된 액세스만 남음) 나머지는 그대로');
  const from2 = F.st.calls.length;
  assert.deepStrictEqual(await w.unshare(PERM_FOLDER, []), { removed: [], missing: [] });
  assert.deepStrictEqual(await w.unshare(PERM_FOLDER, [0, 'x', null]), { removed: [], missing: [] });
  assert.strictEqual(F.st.calls.length, from2);
  // 다이제스트 만료 → 다시 받아 한 번 더(이미 거둔 역할은 다시 읽히지 않는다) · cfg 인수 · 숫자 하나
  F.expire();
  const from3 = F.st.calls.length;
  assert.deepStrictEqual(await w.unshare(cfg, 1909), { removed: [{ id: 1909, roles: [1073741827] }], missing: [] });
  assert.ok(calls(F, from3).includes('POST contextinfo') && F.st.unshares.length === 4);
  // 이메일로 공유 → 피커 질문이 이메일, 이메일이 같은 1명(표시 이름은 영문) → permissions 에 읽기로 보임. 이메일이 다른 1명이면 ambiguous
  const s = await w.sharePeople(PERM_FOLDER, ['moon@krs.co.kr'], { role: 'read' });
  assert.deepStrictEqual(s, { shared: [{ name: 'MOON Changjae', email: 'moon@krs.co.kr' }], ambiguous: [], notFound: [], failed: [] });
  assert.strictEqual(F.st.pickerBodies.slice(-1)[0].body.queryParams.QueryString, 'moon@krs.co.kr');
  assert.strictEqual(F.st.shareBodies.slice(-1)[0].body.roleValue, 'role:1073741826');
  const after = await SP.permissions(cfg, { fetch: F.fetch });
  assert.deepStrictEqual(after.people.filter((p) => p.email === 'moon@krs.co.kr').map((p) => [p.name, p.role]), [['MOON Changjae', 'read']]);
  assert.deepStrictEqual(await w.sharePeople(PERM_FOLDER, ['kim@krs.co.kr']), { shared: [], ambiguous: [{ name: 'kim@krs.co.kr', candidates: ['김철수'] }], notFound: [], failed: [] });
  await rejects(w.unshare('/personal/moon_krs_co_kr/Documents/업무/shared/과제A', [1]), 'badurl', /밖/);
  // 역할 읽기 403 → auth(상태 그대로 던짐)
  const D = fakeSp({ folders: [PERM_FOLDER], perms: PERMS, deny403: true });
  await rejects(SP.openWriter(base, { chrome: fakeChrome(D.fetch) }), 'auth');
  await w.close();
});

await test('describe: kind 있는 오류 · kind 없는 Error(error) · 문자열', () => {
  assert.deepStrictEqual(SP.describe(Object.assign(new Error('x'), { kind: 'auth' })), { kind: 'auth', message: 'x' });
  assert.deepStrictEqual(SP.describe(new Error('y')), { kind: 'error', message: 'y' });
  assert.deepStrictEqual(SP.describe('z'), { kind: 'error', message: 'z' });
  assert.strictEqual(SP.describe(null).kind, 'error');
});

/* ----- 참여연구원 자료 요청(0.8.9) — 목록 ----- */
const LIST_T = 'KR 참여현황 SSCB 1차년도';
const LIST_FIELDS = [{ name: 'PeriodFrom', title: '시작 달', kind: 2, desc: '시작' }, { name: 'PeriodTo', title: '끝 달', kind: 6, desc: '끝', choices: ['2026-11', '2026-12'] }, { name: 'Rate', title: '참여율(%)', kind: 9, desc: '%' }, { name: 'Note', title: '비고', kind: 3, desc: '' }];
const TITLE_F = { title: '항목', desc: '이 과제면 그대로', defaultValue: '이 과제' };
await test('writer.createList: 같은 제목이 없으면 POST lists(SP.List · 100 · verbose 본문) → 칸마다 addfield(영문 내부 이름) · MERGE 표시 이름·설명 · 기본 보기에 더함 → 제목 칸 MERGE(항목 · 기본값 "이 과제") → 목록 보안(자기 항목만) → 정보(절대 주소 · 디코딩한 경로); 다시 부르면 existed 로 빠진 칸만; 빈 제목은 badurl', async () => {
  const F = fakeSp(); const C = fakeChrome(F.fetch);
  const w = await SP.openWriter(CFG, { chrome: C });
  const r = await w.createList({ title: LIST_T, description: '설명', fields: LIST_FIELDS, titleField: TITLE_F });
  assert.strictEqual(r.existed, false); assert.ok(/^11111111-2222-3333-4444-/.test(r.id)); assert.strictEqual(r.title, LIST_T); assert.deepStrictEqual(r.warnings, []);
  assert.strictEqual(r.path, `/personal/kimghw_krs_co_kr/Lists/${LIST_T}`);
  assert.strictEqual(r.url, `${ORIGIN}/personal/kimghw_krs_co_kr/Lists/${encodeURIComponent(LIST_T)}`);
  assert.strictEqual(r.newFormUrl, `${r.url}/NewForm.aspx`); assert.strictEqual(r.viewUrl, `${r.url}/AllItems.aspx`);
  const l = F.st.lists[r.id];
  assert.deepStrictEqual(l.fields.map((f) => [f.InternalName, f.Title, f.kind]), [['Title', '항목', 2], ['PeriodFrom', '시작 달', 2], ['PeriodTo', '끝 달', 6], ['Rate', '참여율(%)', 9], ['Note', '비고', 3]], '내부 이름은 영문, 표시 이름은 한글');
  assert.deepStrictEqual([l.fields[0].DefaultValue, l.fields[0].Description, l.fields[3].Description, l.description], ['이 과제', '이 과제면 그대로', '%', '설명']);
  assert.deepStrictEqual([l.fields[2].choices, l.fields[2].fillIn, l.fields[2].editFormat, l.fields[1].choices, l.fields[1].fillIn], [['2026-11', '2026-12'], true, 0, null, undefined], '선택 칸(kind 6)은 만들 때 Choices, MERGE 로 직접 입력 허용·드롭다운; 글 칸은 그대로');
  assert.deepStrictEqual(l.viewFields, ['LinkTitle', 'PeriodFrom', 'PeriodTo', 'Rate', 'Note', 'Author'], '기본 보기에 칸들 + 작성자(2026-10-20 "이거 누가 작성했는지도 모르네")');
  assert.deepStrictEqual([l.readSecurity, l.writeSecurity], [2, 2], '응답자는 자기 항목만');
  const cb = F.st.listBodies[0]; assert.strictEqual(cb.headers['Content-Type'], 'application/json;odata=verbose'); assert.strictEqual(cb.body.BaseTemplate, 100); assert.ok(cb.headers['X-RequestDigest']);
  const seq = calls(F).filter((c) => /\blists?\b|list[(#]/.test(c));
  assert.ok(seq[0] === `GET list(${LIST_T})` && seq[1] === 'POST lists' && seq.includes('POST list#001/fields/addfield') && seq[seq.length - 1] === 'GET list#001?', seq.join(' | '));
  // 다시(지난번에 만들다 끊김 · 다이제스트 거부 뒤) — 있는 목록에 빠진 칸만
  l.fields.splice(3, 1);   // Rate 가 빠진 상태로
  const n0 = F.st.calls.length;
  const r2 = await w.createList({ title: LIST_T, fields: LIST_FIELDS, titleField: TITLE_F });
  assert.strictEqual(r2.existed, true); assert.strictEqual(r2.id, r.id); assert.strictEqual(r2.newFormUrl, r.newFormUrl);
  const seq2 = calls(F, n0);
  assert.ok(!seq2.includes('POST lists') && seq2.filter((c) => c.endsWith('/fields/addfield')).length === 1 && seq2.includes('GET list#001/fields?'), seq2.join(' | '));
  assert.deepStrictEqual(l.fields.map((f) => f.InternalName), ['Title', 'PeriodFrom', 'PeriodTo', 'Note', 'Rate']);
  assert.strictEqual(l.viewFields.filter((v) => v === 'Author').length, 1, '있던 목록에는 작성자를 다시 더하지 않음');
  await rejects(w.createList({ title: '' }), 'badurl');
  await w.close();
});

await test('writer.createList: 다이제스트가 만료됐으면 403(security validation) → 다시 받아 한 번 더(목록은 한 번만) · 로그인 풀림(403) → auth', async () => {
  const F = fakeSp(); const C = fakeChrome(F.fetch);
  const w = await SP.openWriter(CFG, { chrome: C });
  F.expire();
  const r = await w.createList({ title: LIST_T, fields: LIST_FIELDS, titleField: TITLE_F });
  assert.strictEqual(r.existed, false); assert.strictEqual(Object.keys(F.st.lists).length, 1);
  assert.strictEqual(calls(F).filter((c) => c === 'POST contextinfo').length, 2, '다이제스트를 다시 받음');
  assert.strictEqual(calls(F).filter((c) => c === 'POST lists').length, 2, '첫 POST 는 403, 둘째가 만듦');
  await w.close();
  const w3 = await SP.openWriter(CFG, { chrome: fakeChrome(fakeSp({ deny403: true }).fetch) }).catch((e) => e);
  assert.strictEqual(w3.kind, 'auth', '로그인이 풀린 사이트에서는 작업 창부터 auth');
});

await test('listInfo: 목록 정보(Id 로 — 경로 · 폼 주소 · 제목, 빈칸 둘인 경로 그대로) · 없는 목록 404 → notfound · Id 모양 아니면 badurl', async () => {
  const ID = '11111111-2222-3333-4444-000000000019';
  const F = fakeSp({ lists: [{ id: ID, title: 'KR 참여현황 SSCB 2차년도', path: '/personal/kimghw_krs_co_kr/Lists/KR  SSCB 2' }] });
  const got = await SP.listInfo(`${ORIGIN}/personal/kimghw_krs_co_kr/`, ID, { fetch: F.fetch });
  assert.deepStrictEqual(got, { id: ID, title: 'KR 참여현황 SSCB 2차년도', path: '/personal/kimghw_krs_co_kr/Lists/KR  SSCB 2', newFormUrl: '/personal/kimghw_krs_co_kr/Lists/KR  SSCB 2/NewForm.aspx', viewUrl: '/personal/kimghw_krs_co_kr/Lists/KR  SSCB 2/AllItems.aspx' });
  assert.ok(F.st.calls.some(([m, c]) => m === 'GET' && c === `list#${ID.slice(-3)}?`), '확장 출처 GET 한 번');
  await rejects(SP.listInfo(`${ORIGIN}/personal/kimghw_krs_co_kr`, '11111111-2222-3333-4444-000000000008', { fetch: F.fetch }), 'notfound', /목록이 없습니다/);
  await rejects(SP.listInfo(`${ORIGIN}/personal/kimghw_krs_co_kr`, 'nope', { fetch: F.fetch }), 'badurl');
});

await test('listItems: 목록 항목(Author 펼침 · $select 에 영문 칸만 · Modified desc · top 500) · 없는 목록 404 → notfound · 403 → auth · Id·사이트 주소 모양 아니면 badurl', async () => {
  const items = [{ Id: 1, Title: '이 과제', PeriodFrom: '2026-11', PeriodTo: '2027-03', Rate: 25, Monthly: 5823, Note: '', Created: '2026-10-20T01:00:00Z', Modified: '2026-10-20T02:00:00Z', Author: { Title: 'MOON Changjae', EMail: 'cjmoon@krs.co.kr' } }];
  const ID = '11111111-2222-3333-4444-000000000009';
  const F = fakeSp({ lists: [{ id: ID, title: 'T', items }] });
  const got = await SP.listItems(`${ORIGIN}/personal/kimghw_krs_co_kr/`, ID, { fetch: F.fetch }, { fields: ['PeriodFrom', 'Rate', 'Bad name!'] });
  assert.deepStrictEqual(got, items);
  const u = new URL(F.st.itemUrls[0]);
  assert.strictEqual(u.pathname, `/personal/kimghw_krs_co_kr/_api/web/lists(guid'${ID}')/items`);
  assert.strictEqual(u.searchParams.get('$select'), 'Id,Title,PeriodFrom,Rate,Badname,Created,Modified,Author/Title,Author/EMail');
  assert.deepStrictEqual([u.searchParams.get('$expand'), u.searchParams.get('$orderby'), u.searchParams.get('$top')], ['Author', 'Modified desc', '500']);
  await rejects(SP.listItems(`${ORIGIN}/personal/kimghw_krs_co_kr`, '11111111-2222-3333-4444-000000000008', { fetch: F.fetch }), 'notfound', /목록이 없습니다/);
  await rejects(SP.listItems(`${ORIGIN}/personal/kimghw_krs_co_kr`, ID, { fetch: fakeSp({ deny403: true }).fetch }), 'auth');
  await rejects(SP.listItems(`${ORIGIN}/personal/kimghw_krs_co_kr`, ID, { fetch: fakeSp({ loggedIn: false }).fetch }), 'auth');
  await rejects(SP.listItems(`${ORIGIN}/personal/kimghw_krs_co_kr`, 'nope', { fetch: F.fetch }), 'badurl');
  await rejects(SP.listItems('nope', ID, { fetch: F.fetch }), 'badurl');
});

await test('목록 경로 sharePeople(이메일로 · 메일 알림 옵션은 ShareObject sendEmail/제목/본문, 기본은 없음) · writer.recycleList(있으면 removed · 없으면 false · Id 모양 badurl)', async () => {
  const ID = '11111111-2222-3333-4444-000000000009';
  const F = fakeSp({ lists: [{ id: ID, title: 'T' }], people: PEOPLE }); const C = fakeChrome(F.fetch);
  const w = await SP.openWriter(CFG, { chrome: C });
  const listPath = '/personal/kimghw_krs_co_kr/Lists/T';
  const r = await w.sharePeople(listPath, ['moon@krs.co.kr'], { role: 'edit', email: { subject: '자료 요청', body: '양식: https://x' } });
  assert.deepStrictEqual(r.shared, [{ name: 'MOON Changjae', email: 'moon@krs.co.kr' }]);
  const sb = F.st.shareBodies[F.st.shareBodies.length - 1].body;
  assert.deepStrictEqual([sb.url, sb.sendEmail, sb.emailSubject, sb.emailBody, sb.roleValue], [`${ORIGIN}${listPath}`, true, '자료 요청', '양식: https://x', 'role:1073741827']);
  await w.sharePeople(listPath, ['moon@krs.co.kr']);
  const sb2 = F.st.shareBodies[F.st.shareBodies.length - 1].body;
  assert.deepStrictEqual([sb2.sendEmail, sb2.emailSubject, sb2.emailBody], [false, '', ''], '기본은 메일 없음');
  assert.ok(!JSON.stringify(r).includes('KEY-SECRET'), '피커 Key 는 결과에 없음');
  assert.deepStrictEqual(await w.recycleList(ID), { removed: true });
  assert.strictEqual(F.st.lists[ID], undefined);
  assert.deepStrictEqual(await w.recycleList(ID), { removed: false });
  await rejects(w.recycleList('x'), 'badurl');
  await w.close();
});

await test('페이지 함수는 바깥 변수를 쓰지 않는다(직렬화 주입) — 모듈 안 이름이 소스에 없고 쿠키로 요청한다', () => {
  const names = Object.keys(SP._page);
  assert.deepStrictEqual(names.sort(), ['spBegin', 'spCommit', 'spCreate', 'spCreateList', 'spDigest', 'spEnsureFolder', 'spOrgLink', 'spRecycle', 'spRecycleList', 'spRelease', 'spRename', 'spSharePeople', 'spUnshare']);
  for (const fn of Object.values(SP._page)) {
    const src = fn.toString();
    assert.ok(!/mkErr|encLit|encPath|AUTH_MSG|ACCEPT_JSON|errOfResult|errOfStatus|kindOfStatus|DEFAULT_COMMENT|checkName|metaOf|redirectedOut|ROLE_EDIT|ROLE_READ|ROLE_RANK|roleOfKind|PEOPLE_SOURCE|SHARED_MAX_PAGES|\bbadurl\b|\bfolderOf\b|\bfileOf\b|\bsharedItemOf\b|\blistChildren\b|\bspGet\b|\bapi\.|\bg\./.test(src), `${fn.name}: 바깥 이름 참조`);
    assert.ok(/credentials: 'include'/.test(src), `${fn.name}: 쿠키로 요청`);
    assert.ok(/^async function sp[A-Z]/.test(src), `${fn.name}: 이름 있는 async 함수(executeScript func)`);
  }
});

console.log(`\n${n} passed${failed ? `, ${failed} failed` : ''}`);
})();
