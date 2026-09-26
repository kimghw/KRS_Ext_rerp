/* rnd.krs.co.kr 회의록 등록 팝업(rcomm_0071_01.act — 청구서(카드)의 증빙 [신규등록]이 여는 창): eClass 패널 청구 준비의 회의록 종류(식비/다과)와 참석자 카드를 팝업에 미리 넣는다.
 * 회의록 자체는 그대로 사용자가 쓴다(회의시간·장소·목적·내용을 적고 저장). 여기서는 저장하지 않는다.
 *
 * 준비 항목 찾기: 이 창을 연 청구서 프레임(window.opener = rexpe_0083_01.act 의 iframe)의 주소 krext_appr(승인번호)·krext_card(카드 뒤 4자리) → 백그라운드 prepGet.
 *   (isolated world 에서 opener 의 주소를 못 읽으면 MAIN 훅(rnd-hook.js krext-call)의 get 으로 읽는다)
 * 넣는 것 (청구종류의 넷째 값 kind, lib/prep.js parsePicks):
 *   1) "회의비(식비) 청구여부" 안내층(#mealCnf — $.blockUI, 회의사전신청 사용+필수 과제에서 새 회의록마다 뜸): 식비면 예, 다과면 아니오 → 화면 fn_confirm().
 *      층이 없으면(사전신청 필수 아님) 식비청구 라디오(MEAL_REQ_YN)를 직접 바꾼다. 예 → 식비(A) 입력·일자/시간/장소/목적은 사전신청 [불러오기]로, 아니오 → 식비 0·다과(B)/기타(C)만
 *   2) 다과면 다과(B) #SNACK_COST 에 청구액(열릴 때 식비 A 에 들어 있던 값)을 넣고 fnCfrcCalc() (합계 재계산)
 *   3) 참석자(entry.attendees): 참여인력 → 화면 콜백 uf_rcomm_0071_02Params(2, [{EMP_NO, EMP_NM, BLNG_DEPT_NM, PART_TRM_ST_DT, PART_TRM_END_DT}]) — 참여인력 조회 팝업(rcomm_0071_02)이 넘기는 것과 같음,
 *      내부참석자 → uf_rcomm_0008_04Params_multi(2, [{EMP_NO, EMP_NM, DEPT_NM}]) — 인적정보 팝업(rcomm_0008_04)이 넘기는 것과 같음,
 *      외부참석자 → 빈 행(열릴 때 이미 하나 있음, 모자라면 prjMngTblTrPush2)에 성명·소속을 적고 #OUT_COUNT 를 행 수로 (1인당 한도 계산에 쓰임)
 *   4) 상단 안내 막대: 무엇을 넣었고 무엇이 남았는지, 과제 규칙(hidden CFRC_OUT_ATTNTS_MARK_YN 외부참석자 필수, CFRC_LIMITED_AMT 1인당 한도 → 최소 인원, CFRC_PRE_APPL_ESST_YN 회의사전신청 필수)
 * 화면 함수 호출은 MAIN 훅(rnd-hook.js, 이 페이지에도 주입됨)의 krext-call 로 한다 (isolated world 는 페이지 함수를 못 본다) */
(() => {
  if (!/\/rcomm_0071_01\.act/i.test(location.pathname)) return;
  const log = (...a) => { try { console.debug('[krext meeting]', ...a); } catch (e) {} };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const visible = (el) => !!el && el.isConnected && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const hid = (id) => { const el = document.getElementById(id); return el && el.value != null ? String(el.value).trim() : ''; };
  const money = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const unformat = (s) => Number(String(s || '').replace(/[^\d.-]/g, '')) || 0;
  const bgSend = (msg) => { try { return chrome.runtime.sendMessage(msg).catch(() => null); } catch (e) { return Promise.resolve(null); } };

  /* MAIN 훅 호출 (content/rnd-claim.js pageCall/pageGet 과 같은 규약, 별도 id 접두어) */
  let seq = 0; const waiters = new Map();
  document.addEventListener('krext-call-result', (ev) => { let r = null; try { r = JSON.parse(String((ev && ev.detail) || '')); } catch (e) { return; } const w = r && waiters.get(r.id); if (w) { waiters.delete(r.id); w(r); } });
  const bridge = (req, ms) => new Promise((resolve) => {
    const id = 'm' + (++seq) + '_' + Date.now().toString(36);
    const timer = setTimeout(() => { waiters.delete(id); resolve({ ok: false, error: '응답 없음 (훅 미동작)' }); }, ms || 4000);
    waiters.set(id, (r) => { clearTimeout(timer); resolve(r); });
    try { document.dispatchEvent(new CustomEvent('krext-call', { detail: JSON.stringify(Object.assign({ id }, req)) })); }
    catch (e) { clearTimeout(timer); waiters.delete(id); resolve({ ok: false, error: String((e && e.message) || e) }); }
  });
  const pageCall = (fn, args) => bridge({ fn, args: args || [] });
  const pageGet = (path) => bridge({ get: path });

  /* 이 창을 연 청구서 프레임의 주소에서 준비 항목 파라미터 */
  async function openerQuery() {
    let search = '';
    try { search = window.opener && window.opener.location ? String(window.opener.location.search || '') : ''; } catch (e) { search = ''; }
    if (!search) { const r = await pageGet('opener.location.search'); if (r.ok && typeof r.value === 'string') search = r.value; }
    try { const sp = new URLSearchParams(search); return { appr: (sp.get('krext_appr') || sp.get('krext_prep') || '').trim(), card4: (sp.get('krext_card') || '').replace(/\D/g, '').slice(-4) }; }
    catch (e) { return { appr: '', card4: '' }; }
  }
  function parsePicks(list) {
    return (Array.isArray(list) ? list : []).map((line) => {
      const s = String(line || '').trim(); if (!s || s.startsWith('#')) return null;
      const parts = s.split('=').map((x) => x.trim());
      return parts[0] ? { label: parts[0], kw: parts[1] || parts[0], type: parts[2] || '', kind: parts[3] || '' } : null;
    }).filter(Boolean);
  }
  async function pickFor(label) {
    try {
      const s = await KRX_SETTINGS.load();
      const picks = parsePicks((s.claimHelper && s.claimHelper.quickPicks) || []);
      return picks.find((p) => p.label === label) || null;
    } catch (e) { return null; }
  }
  /* 안내 막대 (문서 맨 위) */
  let bar = null;
  function showBar(lines, err) {
    if (!bar) {
      const st = document.createElement('style');
      st.textContent = `.krext-meet-bar{margin:6px 8px;padding:6px 10px;border:1px solid #b7cdf0;border-radius:6px;background:#eef5ff;font:12px/1.5 "Malgun Gothic","맑은 고딕",sans-serif;color:#1f2f4a}
.krext-meet-bar.krext-err{border-color:#e6b8b3;background:#fff3f1}.krext-meet-bar b{color:#1f4e9c}.krext-meet-bar .krext-meet-ttl{font-weight:700;color:#1f4e9c;margin-right:6px}.krext-meet-bar div{margin:1px 0}`;
      (document.head || document.documentElement).appendChild(st);
      bar = document.createElement('div'); bar.className = 'krext-meet-bar';
      const first = document.body.firstElementChild;
      if (first) document.body.insertBefore(bar, first); else document.body.appendChild(bar);
    }
    bar.classList.toggle('krext-err', !!err);
    bar.innerHTML = `<div><span class="krext-meet-ttl">eClass 패널 청구 준비</span>${lines[0] || ''}</div>` + lines.slice(1).map((l) => `<div>${l}</div>`).join('');
  }
  const fire = (el, types) => { for (const t of types) el.dispatchEvent(new Event(t, { bubbles: true })); };

  /* 1) 식비 여부 */
  async function applyKind(kind) {
    const want = kind === '식비' ? 'Y' : 'N';
    const layer = document.getElementById('mealCnf');
    if (layer && visible(layer)) {   // 안내층이 떠 있음 → 라디오 고르고 화면의 확인(fn_confirm)
      const r = document.getElementById(want === 'Y' ? 'MEAL_YN_1' : 'MEAL_YN_2');
      if (r) { r.checked = true; fire(r, ['change']); }
      const c = await pageCall('fn_confirm');
      if (!c.ok) { log('fn_confirm 실패', c.error); return `식비 여부를 정하지 못했습니다 (${c.error})`; }
      await sleep(300);
      return '';
    }
    const r = document.getElementById(want === 'Y' ? 'MEAL_REQ_YN_1' : 'MEAL_REQ_YN_2');
    if (!r) return '식비청구 라디오를 찾지 못했습니다';
    if (!r.checked) { r.checked = true; fire(r, ['change']); await sleep(300); }
    return '';
  }
  /* 2) 다과비: 청구액을 다과(B)로 */
  async function applySnack(amount) {
    const snack = document.getElementById('SNACK_COST'), meal = document.getElementById('MEAL_COST');
    if (!snack) return '다과 칸을 찾지 못했습니다';
    if (meal && !meal.disabled && !meal.readOnly) { meal.value = '0'; fire(meal, ['keyup', 'change']); }
    snack.value = money(amount); fire(snack, ['keyup', 'change']);
    const c = await pageCall('fnCfrcCalc');
    if (!c.ok) fire(snack, ['keyup']);
    return '';
  }
  /* 2b) 회의 내용(패널 회의록 카드 entry.minutes): 활성 칸에만. 회의장소·비고는 클릭 핸들러가 기본 문구를 지우고 defaultCfrcPlce/defaultRmk 를 내리므로 click 뒤에 넣는다(안 그러면 save() 가 RMK 를 버림) */
  function applyMinutes(m) {
    const put = (id, v, click) => { const el = document.getElementById(id); if (!el || el.disabled || el.readOnly || v == null || v === '') return false; if (click) el.click(); el.value = String(v); fire(el, ['input', 'keyup', 'change']); return true; };
    const done = [];
    if (put('CFRC_ST_DTM', m.stDtm)) done.push('시작시간'); if (put('CFRC_END_DTM', m.endDtm)) done.push('종료시간');
    if (put('CFRC_PLCE', m.place, true)) done.push('회의장소'); if (put('CFRC_PURS', m.purpose, true)) done.push('회의목적'); if (put('CFRC_CONT', m.content)) done.push('회의내용');
    if (put('COST_PTCL', m.costPtcl)) done.push('경비내역'); if (put('RMK', m.rmk, true)) done.push('비고'); if (put('MC_USER', m.mcUser)) done.push('진행자');
    return done;
  }
  /* 3) 참석자 */
  const rowsIn = (tbl) => Array.from(document.querySelectorAll(`#${tbl} tbody tr.generated`));
  async function applyAttendees(att) {
    const out = [];
    const part = (att.part || []).filter((x) => x.empNo);
    if (part.length) {
      const have = new Set(rowsIn('rtaskTb').map((tr) => (tr.querySelector('#CFRC_IN_EMP_NO') || {}).value || ''));
      const rows = part.filter((x) => !have.has(x.empNo)).map((x) => ({ EMP_NO: x.empNo, EMP_NM: x.name, BLNG_DEPT_NM: x.dept, PART_TRM_ST_DT: x.from || '', PART_TRM_END_DT: x.to || '' }));
      if (rows.length) { const r = await pageCall('uf_rcomm_0071_02Params', [2, rows]); if (!r.ok) out.push(`참여인력 넣기 실패 (${r.error})`); await sleep(200); }
    }
    const inner = (att.inner || []).filter((x) => x.empNo);
    if (inner.length) {
      const have = new Set(rowsIn('rtaskTb1').map((tr) => (tr.querySelector('#CFRC_IN_EMP_NO') || {}).value || ''));
      const rows = inner.filter((x) => !have.has(x.empNo)).map((x) => ({ EMP_NO: x.empNo, EMP_NM: x.name, DEPT_NM: x.dept }));
      if (rows.length) { const r = await pageCall('uf_rcomm_0008_04Params_multi', [2, rows]); if (!r.ok) out.push(`내부참석자 넣기 실패 (${r.error})`); await sleep(200); }
    }
    const outer = (att.outer || []).filter((x) => x.name);
    if (outer.length) {
      const have = new Set(rowsIn('rtaskTb2').map((tr) => ((tr.querySelector('#CFRC_OUT_EMP_NM') || {}).value || '').trim()).filter(Boolean));
      for (const x of outer) {
        if (have.has(x.name)) continue;
        let tr = rowsIn('rtaskTb2').find((r) => !((r.querySelector('#CFRC_OUT_EMP_NM') || {}).value || '').trim());   // 열릴 때 들어 있는 빈 행부터
        if (!tr) { const r = await pageCall('prjMngTblTrPush2', ['']); if (!r.ok) { out.push(`외부참석자 행 추가 실패 (${r.error})`); break; } await sleep(120); const all = rowsIn('rtaskTb2'); tr = all[all.length - 1]; }
        if (!tr) { out.push('외부참석자 행을 찾지 못했습니다'); break; }
        const nm = tr.querySelector('#CFRC_OUT_EMP_NM'), dept = tr.querySelector('#DEPT_NM');
        if (nm) { nm.value = x.name; fire(nm, ['input', 'change']); }
        if (dept) { dept.value = x.dept || ''; fire(dept, ['input', 'change']); }
        have.add(x.name);
      }
      const cnt = document.getElementById('OUT_COUNT');
      if (cnt && !cnt.disabled) { cnt.value = String(rowsIn('rtaskTb2').filter((r) => ((r.querySelector('#CFRC_OUT_EMP_NM') || {}).value || '').trim()).length); fire(cnt, ['change']); }
    }
    return out;
  }
  /* 과제 규칙 안내 (팝업 hidden 값) */
  function ruleLines(kind, amount) {
    const lines = [];
    const inN = Number(hid('IN_COUNT')) || rowsIn('rtaskTb').length, empN = Number(hid('EMP_COUNT')) || rowsIn('rtaskTb1').length, outN = rowsIn('rtaskTb2').filter((r) => ((r.querySelector('#CFRC_OUT_EMP_NM') || {}).value || '').trim()).length;
    const total = inN + empN + outN;
    if (hid('CFRC_OUT_ATTNTS_MARK_YN') === 'Y') lines.push(outN ? '외부참석자 필수 과제 ✓' : '<b>외부참석자 1명 이상 필수</b>');
    else if (hid('CFRC_OUT_ATTNTS_MARK_YN') === 'Z') lines.push('내부 또는 외부참석자 1명 이상 필수');
    if (hid('CFRC_PART_ATTNTS_YN') === 'Y') lines.push(inN ? '참여인력 필수 과제 ✓' : '<b>참여인력 1명 이상 필수</b>');
    const limit = Number(hid('CFRC_LIMITED_AMT')) || 0;
    if (hid('CFRC_LIMITED_YN') === 'Y' && limit > 0) { const need = Math.ceil((Number(amount) || 0) / limit); lines.push(`1인당 한도 ${money(limit)}원: 식비+다과 ${money(amount)}원이면 ${need}명 이상 (지금 ${total}명${total >= need ? ' ✓' : ''}) — 기타경비(C)는 한도에 들지 않음`); }
    if (hid('CFRC_PRE_APPL_ESST_YN') === 'Y' && kind === '식비') lines.push('<b>회의사전신청 사용+필수 과제</b>: 식비(예) 청구는 회의일자(카드 사용일) 전에 승인된 회의사전신청을 [불러오기] 해야 저장됩니다 — 없으면 식비 아니오(다과비·기타경비)로만 저장할 수 있습니다');
    return lines;
  }

  async function main() {
    // 새 회의록(UPD_YN N)만 — 상세/수정 창은 건드리지 않는다
    for (let i = 0; i < 40 && !document.getElementById('UPD_YN'); i++) await sleep(250);
    if (hid('UPD_YN') !== 'N') return;
    const q = await openerQuery();
    if (!q.appr) return;
    const r = await bgSend({ type: 'prepGet', appr: q.appr, card4: q.card4, withFiles: false });
    const entry = r && r.entry; if (!entry) return;
    const pk = await pickFor(entry.type);
    const kind = pk ? pk.kind : '';
    const att = entry.attendees || null;
    const nAtt = att ? (att.part || []).length + (att.inner || []).length + (att.outer || []).length : 0;
    if (!kind && !nAtt && !entry.minutes) return;
    // 화면 스크립트(전역 함수·jQuery)가 준비될 때까지
    for (let i = 0; i < 40; i++) { const g = await pageGet('fn_confirm'); if (g.ok && g.value === '[function]') break; await sleep(250); }
    const amount = unformat(hid('MEAL_COST') || hid('CFRC_COST')) || Math.abs(Number(entry.amount) || 0);   // 열릴 때 식비(A)=청구액
    log('준비 항목', entry.key, entry.type, kind || '(종류 없음)', '참석자', nAtt, '청구액', amount);
    const problems = [];
    const done = [];
    if (kind) {
      const e1 = await applyKind(kind);
      if (e1) problems.push(e1);
      else if (kind === '다과') { const mm = entry.minutes || {}; const snack = mm.snack == null ? amount : Number(mm.snack) || 0; const e2 = await applySnack(snack); if (e2) problems.push(e2); else { done.push(`식비 아니오 · 다과(B) ${money(snack)}원`); const etcEl = document.getElementById('ETC_COST'); if (etcEl && mm.etc) { etcEl.value = money(mm.etc); fire(etcEl, ['keyup', 'change']); await pageCall('fnCfrcCalc'); done.push(`기타(C) ${money(mm.etc)}원`); } } }
      else done.push(`식비 예 · 식비(A) ${money(amount)}원`);
    }
    if (entry.minutes) { const dm = applyMinutes(entry.minutes); if (dm.length) done.push(`회의 내용: ${dm.join('·')}`); }
    if (nAtt) {
      const errs = await applyAttendees(att);
      problems.push(...errs);
      done.push(`참석자: 참여인력 ${(att.part || []).length}명 · 내부참석자 ${(att.inner || []).length}명 · 외부참석자 ${(att.outer || []).length}명`);
    }
    await sleep(300);
    const val = (id) => ((document.getElementById(id) || {}).value || '').trim();
    const remain = [['CFRC_ST_DTM', '회의시작시간'], ['CFRC_END_DTM', '회의종료시간'], ['CFRC_PLCE', '회의장소'], ['CFRC_PURS', '회의목적']].filter(([id]) => !val(id)).map(([, nm]) => nm);
    const cmin = Number(hid('CFRC_CONTENT_LENGTH_LIMITED')) || 20; if (val('CFRC_CONT').length < cmin) remain.push(`회의내용(${cmin}자 이상, 지금 ${val('CFRC_CONT').length}자)`);
    if (!remain.length) remain.push('없음 — 확인 뒤 저장');
    const lines = [`넣음: ${done.map(esc).join(' / ') || '없음'}`, `남은 입력: ${remain.join(', ')} → 저장하면 청구서 탭이 이어서 내역 추가합니다`].concat(ruleLines(kind, unformat(hid('MEAL_SNACK_COST')) || amount));
    if (problems.length) lines.push(`<b>문제:</b> ${problems.map(esc).join(' / ')}`);
    showBar(lines, problems.length > 0);
    try { await pageCall('rderp.common.fnPopupResize'); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { main().catch((e) => log('오류', e)); });
  else main().catch((e) => log('오류', e));
})();
