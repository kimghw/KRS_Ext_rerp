/* 팀즈 MCP (0.8.9 — 백그라운드 전용, background.js 가 importScripts; Node 테스트 겸용 tests/teams-mcp.test.js) — 이 PC 의 KR_MS365_mcp **teams** 서버(기본 http://localhost:5003/mcp,
 * Streamable HTTP — lib/mcp-client.js KRX_MCP)로 참여연구원 자료 요청의 팀즈 글을 **창 없이** 보낸다(2026-10-20 사용자 "창도 안 열리고 알아서 보내기까지 … 각기 보내는 건 mcp teams 로 하고
 * 연결 안 되면 못 쓰는 거고 … 기존 단체 채팅방 … 채팅방 링크를 주면 되나"). 서버가 Graph 로 보내므로 로그인(토큰)은 그 서버 몫 — 확장은 토큰을 다루지 않는다(CLAUDE.md 의 예외: 보내기만).
 * 연결이 안 되면 탭(lib/staff-ui.js collectSection)은 딥 링크(새 탭 — 보내기는 사용자)만 보인다.
 *  상태 storage.local.teamsStatus = { url, at, ok, server, error } — probe(url, force) 가 쓰고(lib/llm.js 와 같은 꼴, TTL 30초) 탭이 읽는다('teamsProbe' 메시지 · onChanged).
 *  send(url, { chatId | email, text }) → { chatId, messageId }: chatId 가 없으면 handler_teams_list_chats(limit 50 — Graph /me/chats 의 $top 상한; 200 을 물으면 400 "The limit of '50' for Top query has been exceeded", 2026-10-20 실측) 에서 그 이메일과의 1:1 채팅(chat_type oneOnOne 의 members[].email)을 찾는다 —
 *    없으면 kind 'nochat'(Graph 로 새 채팅을 만들지 않는다 — 탭의 [채팅 열기] 딥 링크로 한 번 대화한 뒤). 보내기는 handler_teams_send_chat_message { chat_id, content: toHtml(글), prefix:'' (서버 기본 "[claude]" 를 안 붙이게), content_type:'html' } —
 *    글은 HTML 로(toHtml: &·<·> 이스케이프, 줄바꿈 → <br>, http(s) 주소 → <a href>) 양식 주소가 눌리는 링크가 되고 빈 줄이 문단을 띄운다(2026-10-20 사용자 "양식은 링크로 클릭해서 실행할 수 있고 … 줄넘기이랑 줄간격 조절").
 *  오류 kind: offline(서버 안 떠 있음) · notool(teams 서버가 아님) · nochat · empty · tool(서버가 거절 — 로그인 만료 등) · 그 밖은 lib/mcp-client.js 의 kind 그대로 */
const KRX_TEAMS = (() => {
  const KEY = 'teamsStatus', TTL = 30000, DEFAULT_URL = 'http://localhost:5003/mcp';
  const SEND_TOOL = 'handler_teams_send_chat_message', LIST_TOOL = 'handler_teams_list_chats';
  const g = typeof self !== 'undefined' ? self : globalThis;
  const baseUrl = (u) => { const s = String(u || '').trim(); return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/\S*$/i.test(s) ? s : DEFAULT_URL; };   // 이 PC 만
  const low = (s) => String(s || '').trim().toLowerCase();
  const mcp = () => g.KRX_MCP;
  const store = () => (g.chrome && g.chrome.storage && g.chrome.storage.local) || null;
  const fail = (kind, message) => Object.assign(new Error(message), { kind });
  /* 글 → Teams HTML 본문: 이스케이프 · 줄바꿈 <br> · 주소는 <a>(끝의 문장부호는 링크 밖) */
  const toHtml = (text) => String(text || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
    .replace(/https?:\/\/[^\s<>"']*[^\s<>"'.,;:!?)]/g, (u) => `<a href="${u}">${u}</a>`).replace(/\n/g, '<br>');
  let last = null;   // 마지막 상태(메모리 — 워커가 다시 뜨면 저장소에서)

  /* 1:1 채팅 찾기 — list_chats 결과 chats[{ id, chat_type, members[{ email }] }] 에서 그 이메일이 든 oneOnOne 의 id, 없으면 '' */
  function chatIdFor(chats, email) {
    const e = low(email); if (!e) return '';
    const hit = (Array.isArray(chats) ? chats : []).find((c) => c && c.chat_type === 'oneOnOne' && (Array.isArray(c.members) ? c.members : []).some((m) => low(m && m.email) === e));
    return hit ? String(hit.id || '') : '';
  }
  function shape(url, r, err) {
    const ok = !!(r && Array.isArray(r.tools) && r.tools.some((t) => t && t.name === SEND_TOOL));
    const server = r && r.server ? `${r.server.name || ''} ${r.server.version || ''}`.trim() : '';
    return { url, at: Date.now(), ok, server, error: ok ? '' : r ? `팀즈 MCP 서버가 아닙니다 (${url}) — ${SEND_TOOL} 도구가 없음` : err || `연결할 수 없습니다 (${url})` };
  }
  /* 연결 확인 → 상태(저장소에는 바뀌었을 때만). force 가 아니면 30초 안의 같은 주소 결과를 그대로 */
  async function probe(url, force, opts) {
    url = baseUrl(url);
    const st = store();
    if (!last && st) { try { const s = (await st.get(KEY))[KEY]; if (s && s.url) last = s; } catch (e) {} }
    if (!force && last && last.url === url && Date.now() - last.at < TTL) return last;
    let r = null, err = '';
    try { r = await mcp().probe(url, Object.assign({ initTimeoutMs: 4000 }, opts || {})); } catch (e) { err = `연결할 수 없습니다 (${url}) — 이 PC 의 KR_MS365_mcp teams 서버를 띄우세요: ${String((e && e.message) || e)}`; }
    const next = shape(url, r, err);
    const changed = !last || last.url !== next.url || last.ok !== next.ok || last.error !== next.error;
    last = next;
    if (st && changed) { try { await st.set({ [KEY]: next }); } catch (e) {} }
    return next;
  }
  /* 보내기 — o = { chatId | email, text } → { chatId, messageId } */
  async function send(url, o, opts) {
    url = baseUrl(url); o = o || {};
    const text = String(o.text || '').trim();
    if (!text) throw fail('empty', '보낼 글이 없습니다');
    const c = await mcp().open(url, opts);
    try {
      let chatId = String(o.chatId || '').trim();
      if (!chatId) {
        const r = await c.call(LIST_TOOL, { limit: 50 });   // ponytail: Graph 상한 50 — 최근 50개 채팅 밖의 사람은 nochat → [채팅 열기]; 더 필요하면 서버 list_chats 에 nextLink 페이징
        chatId = chatIdFor(r.json && r.json.chats, o.email);
        if (!chatId) throw fail('nochat', `${o.email || '(이메일 없음)'} 와의 1:1 채팅이 아직 없습니다 — [채팅 열기]로 한 번 대화한 뒤 다시`);
      }
      const r = await c.call(SEND_TOOL, { chat_id: chatId, content: toHtml(text), prefix: '', content_type: 'html' });
      if (r.json && r.json.success === false) throw fail('tool', String(r.json.error || r.json.message || '보내지 못했습니다'));
      return { chatId, messageId: String((r.json && r.json.message_id) || '') };
    } finally { try { await c.close(); } catch (e) {} }
  }
  async function status() { if (last) return last; const st = store(); if (!st) return null; try { return (await st.get(KEY))[KEY] || null; } catch (e) { return null; } }
  const api = { KEY, TTL, DEFAULT_URL, SEND_TOOL, baseUrl, chatIdFor, toHtml, probe, send, status };
  g.KRX_TEAMS = api;
  return api;
})();
