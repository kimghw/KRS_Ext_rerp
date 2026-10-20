/* lib/teams-mcp.js(팀즈 MCP — 자료 요청 팀즈 글 창 없이 보내기, 0.8.9) + lib/mcp-client.js 테스트: 가짜 MCP 서버(Streamable HTTP — initialize 는 SSE, 나머지는 JSON, 세션 머리)로
 * 연결 확인(도구 유무 · 서버 없음 · 저장소) · 1:1 채팅 찾기 · chatId/이메일 보내기(prefix 없이, 세션 닫기) · 1:1 채팅 없음 · 서버 거절 · 빈 글 */
globalThis.self = globalThis;
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..');
for (const f of ['lib/mcp-client.js', 'lib/teams-mcp.js']) require(path.join(root, f));
const T = KRX_TEAMS;
let n = 0, failed = 0;
const test = async (name, fn) => { try { await fn(); n++; console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n   ', e.stack || e.message); process.exitCode = 1; } };
const rejects = async (p, kind, re) => { try { await p; } catch (e) { assert.strictEqual(e.kind, kind, `kind ${e.kind} ≠ ${kind}: ${e.message}`); if (re) assert.ok(re.test(e.message), `메시지 "${e.message}" 가 ${re} 와 안 맞음`); return; } throw new Error('거부되지 않음'); };

const URL_ = 'http://localhost:5003/mcp';
const CHATS = [
  { id: '19:a_b@unq.gbl.spaces', chat_type: 'oneOnOne', members: [{ email: 'kimghw@krs.co.kr' }, { email: 'CJMoon@krs.co.kr' }] },
  { id: '19:87062d12353c42558f52ebe1fae3714f@thread.v2', chat_type: 'group', topic: '[부서 채팅방]', members: [{ email: 'kimghw@krs.co.kr' }, { email: 'bjh@krs.co.kr' }] },
];
/* 가짜 MCP 서버 — o: offline · tools(도구 이름들) · chats · sendFail */
function fakeMcp(o) {
  o = o || {}; const calls = []; let sessions = 0;
  const res = (status, body, headers) => ({ ok: status >= 200 && status < 300, status, headers: { get: (k) => (headers || {})[String(k).toLowerCase()] || null }, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });
  const json = (id, result) => ({ jsonrpc: '2.0', id, result });
  const tool = (id, v, isError) => json(id, { content: [{ type: 'text', text: JSON.stringify(v) }], isError: !!isError });
  const fetch = async (url, init) => {
    if (o.offline) throw new TypeError('fetch failed');
    assert.strictEqual(url, URL_);
    const H = (init && init.headers) || {};
    if (init.method === 'DELETE') { calls.push(['DELETE', H['Mcp-Session-Id']]); return res(200, ''); }
    const b = JSON.parse(init.body);
    if (b.method === 'initialize') { sessions++; return res(200, `event: message\ndata: ${JSON.stringify(json(b.id, { protocolVersion: '2025-03-26', capabilities: {}, serverInfo: { name: o.name || 'teams', version: '1.0.0' } }))}\n\n`, { 'content-type': 'text/event-stream', 'mcp-session-id': `s${sessions}` }); }
    if (!H['Mcp-Session-Id']) return res(400, 'no session');
    if (b.method === 'notifications/initialized') return res(202, '');
    if (b.method === 'tools/list') return res(200, json(b.id, { tools: (o.tools || ['handler_teams_list_chats', 'handler_teams_send_chat_message']).map((name) => ({ name, inputSchema: {} })) }), { 'content-type': 'application/json' });
    if (b.method === 'tools/call') {
      calls.push([b.params.name, b.params.arguments]);
      if (b.params.name === 'handler_teams_list_chats') return res(200, tool(b.id, { success: true, chats: o.chats || CHATS }), { 'content-type': 'application/json' });
      if (b.params.name === 'handler_teams_send_chat_message') return o.sendFail ? res(200, tool(b.id, { success: false, error: 'token expired' }, true), { 'content-type': 'application/json' }) : res(200, tool(b.id, { success: true, message_id: '1760000000001' }), { 'content-type': 'application/json' });
    }
    return res(404, 'nope');
  };
  return { fetch, calls };
}
const writes = [];
globalThis.chrome = { storage: { local: { get: async () => ({}), set: async (v) => { writes.push(v); } } } };

(async () => {
  await test('baseUrl — 이 PC 의 localhost/127.0.0.1 경로만, 아니면 기본값', () => {
    assert.strictEqual(T.baseUrl(' http://localhost:5003/mcp '), 'http://localhost:5003/mcp');
    assert.strictEqual(T.baseUrl('http://127.0.0.1:5100/mcp'), 'http://127.0.0.1:5100/mcp');
    assert.strictEqual(T.baseUrl('https://evil.example/mcp'), T.DEFAULT_URL); assert.strictEqual(T.baseUrl(''), T.DEFAULT_URL); assert.strictEqual(T.baseUrl('http://localhost:5003'), T.DEFAULT_URL, '경로 없으면 기본값');
  });
  await test('chatIdFor — 이메일(대소문자 무시)이 든 1:1 채팅의 id, 단체 채팅은 안 잡음', () => {
    assert.strictEqual(T.chatIdFor(CHATS, 'cjmoon@krs.co.kr'), '19:a_b@unq.gbl.spaces');
    assert.strictEqual(T.chatIdFor(CHATS, 'bjh@krs.co.kr'), '', '단체 채팅에만 있는 사람은 없음');
    assert.strictEqual(T.chatIdFor(null, 'x@krs.co.kr'), ''); assert.strictEqual(T.chatIdFor(CHATS, ''), '');
  });
  await test('probe — 서버에 보내기 도구가 있으면 ok(서버 이름) · 없으면 ok:false · 안 떠 있으면 offline 글 · 저장소에는 바뀔 때만', async () => {
    const F = fakeMcp();
    const st = await T.probe(URL_, true, { fetch: F.fetch });
    assert.deepStrictEqual([st.ok, st.url, st.server, st.error], [true, URL_, 'teams 1.0.0', '']);
    assert.ok(F.calls.some(([m]) => m === 'DELETE'), '확인 뒤 세션 닫음');
    assert.ok(writes.length && writes[writes.length - 1].teamsStatus.ok === true, 'storage.local.teamsStatus');
    const w = writes.length;
    assert.strictEqual((await T.probe(URL_, false, { fetch: fakeMcp({ offline: true }).fetch })).ok, true, '30초 안이면 같은 결과');
    assert.strictEqual(writes.length, w);
    const no = await T.probe(URL_, true, { fetch: fakeMcp({ tools: ['handler_teams_list_chats'] }).fetch });
    assert.ok(!no.ok && /도구가 없음/.test(no.error), no.error);
    const off = await T.probe(URL_, true, { fetch: fakeMcp({ offline: true }).fetch });
    assert.ok(!off.ok && /연결할 수 없습니다/.test(off.error) && /teams 서버를 띄우세요/.test(off.error), off.error);
    assert.ok(writes.length === w + 2, '바뀐 두 번만 저장');
  });
  await test('send — chatId 로: list_chats 없이 send_chat_message { chat_id, content: HTML(줄바꿈 <br> · 주소 링크), prefix:"", content_type:html } → messageId, 세션 닫기', async () => {
    const F = fakeMcp();
    const r = await T.send(URL_, { chatId: '19:87062d12353c42558f52ebe1fae3714f@thread.v2', text: ' 글 \n양식: https://x ' }, { fetch: F.fetch });
    assert.deepStrictEqual(r, { chatId: '19:87062d12353c42558f52ebe1fae3714f@thread.v2', messageId: '1760000000001' });
    const calls = F.calls.filter(([m]) => m !== 'DELETE');
    assert.deepStrictEqual(calls, [['handler_teams_send_chat_message', { chat_id: '19:87062d12353c42558f52ebe1fae3714f@thread.v2', content: '글 <br>양식: <a href="https://x">https://x</a>', prefix: '', content_type: 'html' }]]);
    assert.strictEqual(T.toHtml('a<b & c\n\n양식: https://krclass-my.sharepoint.com/personal/x/Lists/KR%20%20SSCB%201/NewForm.aspx?a=1&b=2.\n끝'), 'a&lt;b &amp; c<br><br>양식: <a href="https://krclass-my.sharepoint.com/personal/x/Lists/KR%20%20SSCB%201/NewForm.aspx?a=1&amp;b=2">https://krclass-my.sharepoint.com/personal/x/Lists/KR%20%20SSCB%201/NewForm.aspx?a=1&amp;b=2</a>.<br>끝', 'toHtml — 이스케이프 · 빈 줄 · 끝 마침표는 링크 밖');
    assert.strictEqual(F.calls[F.calls.length - 1][0], 'DELETE');
  });
  await test('send — 이메일로: list_chats(limit 50 — Graph 상한, 200 은 400) 에서 1:1 채팅을 찾아 보냄 · 없으면 nochat · 서버가 거절하면 tool · 빈 글은 empty', async () => {
    const F = fakeMcp();
    const r = await T.send(URL_, { email: 'cjmoon@krs.co.kr', text: '글' }, { fetch: F.fetch });
    assert.strictEqual(r.chatId, '19:a_b@unq.gbl.spaces');
    assert.deepStrictEqual(F.calls.filter(([m]) => m !== 'DELETE').map(([m, a]) => [m, a.limit || a.chat_id]), [['handler_teams_list_chats', 50], ['handler_teams_send_chat_message', '19:a_b@unq.gbl.spaces']]);
    await rejects(T.send(URL_, { email: 'bjh@krs.co.kr', text: '글' }, { fetch: fakeMcp().fetch }), 'nochat', /1:1 채팅이 아직 없습니다/);
    await rejects(T.send(URL_, { chatId: '19:x@thread.v2', text: '글' }, { fetch: fakeMcp({ sendFail: true }).fetch }), 'tool', /token expired/);
    await rejects(T.send(URL_, { chatId: '19:x@thread.v2', text: '  ' }, { fetch: fakeMcp().fetch }), 'empty');
    await rejects(T.send(URL_, { chatId: '19:x@thread.v2', text: '글' }, { fetch: fakeMcp({ offline: true }).fetch }), 'offline');
  });
  console.log(`\n${n} passed${failed ? `, ${failed} failed` : ''}`);
})();
