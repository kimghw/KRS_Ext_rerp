/* 청구 준비 (카드미청구 거래 행 밑 "↳" 둘째 줄의 "청구종류 · 청구내역(적요) · 첨부 · 청구서 작성 · 작성+신청" 요소, 식사비면 그 밑 참석자 카드, 신청 대기 목록의 "신청") 입력 처리. eClass 콘텐츠스크립트 / 팝업 공용
 * 거래마다 청구종류(청구서 세목 빠른 선택 항목: 연구실 운영비, 회의비 …)를 고르고 청구내역(청구서 폼의 적요 글, 화면 필수값)을 적고 첨부 파일을 끌어다 놓거나(첨부 구역 클릭 → 파일 선택 창) 두면,
 * 그 거래 행을 클릭해 R&D ERP 청구서(카드)를 열 때(rexpe_0083_01 + krext_appr) content/rnd-claim.js 가 청구내역 폼에서 세목·청구종류를 고르고 청구내역을 적고 파일을 첨부 목록에 넣는다.
 * 저장은 백그라운드(lib/prep-store.js)가 한다: 메타 storage.local.claimPrep(이 모듈이 읽어 state.prep 에 둠), 파일 내용은 확장 IndexedDB(메시지로 base64 전달).
 * 렌더러(render.js)는 state.prep(키 → 항목) / state.prepBusy / state.prepNote / state.prepDraft(적는 중인 청구내역) / state.prepAi(Claude 자동 분류 중인 키) 를 읽는다.
 * Claude 자동 분류(0.8.5, Help 서버가 연결돼 있거나 0.8.6 부터 설정에 Claude API 키가 있을 때):줄을 열 때 · 파일을 저장한 뒤 · 청구내역을 저장한 뒤 백그라운드에 'prepAuto' (lib/prep-ai.js) — 청구종류와 첨부 파일 종류를 골라 저장소에 넣는다.
 * 증빙 찾아오기(0.8.5): prep-fetch(찾아오기 → 'prepFetch', lib/prep-fetch.js) · prep-fetch-stop · prep-fetch-reg(자주 사용 등록 — 확장 페이지면 카드 안 등록 칸 state.fetchForm, eClass 패널이면 설정 페이지) · prep-fetch-edit · prep-fetch-chat(💬 설정 페이지의 찾는 방법 익히기를 그 가맹점으로, 못 찾은 이유를 글에 미리) · prep-fetch-save · prep-fetch-formclose.
 *   state.fetchSites(등록 사이트, 비밀번호 없음) · state.prepFetch(진행·결과) 는 이 모듈이 읽고 storage.onChanged 로 맞춘다.
 * 드롭 구역: data-prep-key 가 붙은 행(거래 행과 그 밑 준비 줄. data-prep-meta 에 거래 정보 JSON). select[data-prep-type] 청구종류, input[data-prep-ptcl] 청구내역(input 마다 state.prepDraft 에 보관, change 에 저장, Enter 저장·Esc 되돌림), data-act: prep-row(거래 행 클릭, data-key=준비 키 → state.prepRows 로 그 거래 밑 줄 열기/닫기) · prep-pick(data-key, 첨부 구역 클릭 → 파일 선택 창; 팝업은 창이 닫혀 버려 렌더러가 붙이지 않음) · prep-file-del(data-key/data-id) · prep-clear(data-key) · prep-run · prep-tab */
(function (g) {
  const F = g.KRX_FMT;
  const KEY = 'claimPrep';
  const MAX_FILE_MB = 15;   // 파일 하나 상한 (메시지로 base64 를 넘기므로 너무 큰 파일은 받지 않음)
  const DENY_EXT = new Set(['exe', 'bat', 'sh', 'java', 'jsp', 'htm', 'html', 'js', 'class', 'ini', 'php', 'jsv']);   // 파일등록 팝업이 무조건 거부하는 종류 (content/rnd-claim.js 와 동일)
  const extOf = (name) => { const s = String(name || ''); const i = s.lastIndexOf('.'); return i < 0 ? null : s.slice(i + 1).toLowerCase(); };

  /* 청구서 세목 빠른 선택 목록("표시이름=항목명=청구종류=종류") → [{ label, kw, type, kind }] (content/rnd-claim.js parsePicks 와 동일).
   * kind(넷째 값): 식비 | 다과 | '' — 회의록 팝업의 "회의비(식비) 청구여부"와 금액 칸(식비 A / 다과 B). 식비면 패널에 참석자 카드가 붙는다 */
  function parsePicks(list) {
    return (Array.isArray(list) ? list : String(list || '').split(/\r?\n/)).map((line) => {
      const s = String(line || '').trim();
      if (!s || s.startsWith('#')) return null;
      const parts = s.split('=').map((x) => x.trim());
      return parts[0] ? { label: parts[0], kw: parts[1] || parts[0], type: parts[2] || '', kind: parts[3] || '' } : null;
    }).filter(Boolean);
  }
  const pickOf = (picks, label) => (picks || []).find((p) => p.label === label) || null;
  const isMeetingPick = (p) => !!p && (String(p.type) === '17' || p.kind === '식비' || p.kind === '다과');   // 회의록(부가증빙)이 필요한 청구종류 — "청구서 작성"이 탭을 앞에 열고 회의록 저장을 기다린다
  const wantsMinutes = (p) => !!p && (p.kind === '식비' || p.kind === '다과');   // 패널에 회의록 카드(참석자 + 회의 내용)를 붙이는 청구종류 (식사비·다과비). 회의비(종류 없음)는 회의록 팝업을 직접 쓰는 경로
  const wantsAttendees = wantsMinutes;
  const bytesOf = (s) => { let n = 0; for (const ch of String(s || '')) n += ch.charCodeAt(0) > 127 ? 2 : 1; return n; };   // 화면 getByteLength 와 같은 기준(한글 2바이트)
  const timeOk = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t || ''));
  /* 회의록 카드 준비 상태 — 회의록 팝업 save() 의 검증을 패널에서 미리 본 것. entry(준비 항목), pick(청구종류 항목), info(state.prepMeet: members·rules·preApps·holiday), amount(청구액) → { ready, missing: [문구] } */
  function minutesCheck(entry, pick, info, amount) {
    const m = (entry && entry.minutes) || {}; const a = (entry && entry.attendees) || {}; const part = a.part || [], inner = a.inner || [], outer = a.outer || [];
    const r = (info && info.rules) || null; const missing = [];
    const mealY = pick && pick.kind === '식비';
    const amt = Math.abs(Number(amount) || 0);
    const snack = mealY ? 0 : (m.snack == null ? amt : Number(m.snack) || 0), etc = mealY ? 0 : (Number(m.etc) || 0), meal = mealY ? amt : 0;
    if (mealY && r && r.preApplRequired && !m.preApplReqCnt) missing.push('회의사전신청(식비는 승인된 사전신청 필요 — 없으면 다과비로)');
    if (m.preApplReqCnt && !m.preApplModReason && info && info.preApps) {
      const pa = info.preApps.find((x) => x.reqCnt === m.preApplReqCnt);
      if (pa && (pa.partCnt !== part.length || pa.inCnt !== inner.length)) missing.push('사전신청 수정 사유(참석자 수가 사전신청과 다름)');
    }
    if (!m.preApplReqCnt) {   // 사전신청을 고르면 일자·시간·장소·목적·내용은 사전신청 내용으로 채워진다
      if (!timeOk(m.stDtm)) missing.push('회의시작시간');
      if (!timeOk(m.endDtm)) missing.push('회의종료시간');
      else if (timeOk(m.stDtm) && m.endDtm <= m.stDtm) missing.push('종료시간이 시작시간보다 늦어야 함');
      if (!m.place) missing.push('회의장소'); else if (bytesOf(m.place) > 100) missing.push('회의장소 한글50자 이내');
      if (!m.purpose) missing.push('회의목적'); else if (bytesOf(m.purpose) > 2000) missing.push('회의목적 한글1000자 이내');
      const min = (r && r.contentMin) || 20;
      if (!m.content) missing.push(`회의내용(${min}자 이상)`); else if (String(m.content).length < min) missing.push(`회의내용 ${min}자 이상 (지금 ${String(m.content).length}자)`); else if (bytesOf(m.content) > 2000) missing.push('회의내용 한글1000자 이내');
    }
    if (info && info.holiday && !m.rmk) missing.push('휴일 집행사유(회의일자가 휴일)');
    if (r && r.partRequired && !part.length) missing.push('참여인력 1명 이상');
    if (r && r.outRequired === 'Y' && !outer.length) missing.push('외부참석자 1명 이상');
    if (r && r.outRequired === 'Z' && !outer.length && !inner.length) missing.push('내부 또는 외부참석자 1명 이상');
    if (part.some((x) => inner.some((y) => y.empNo && y.empNo === x.empNo))) missing.push('참여인력과 내부참석자에 같은 사람');
    if (r && r.limitYn && r.limitAmt > 0) { const need = Math.ceil((meal + snack) / r.limitAmt); const n = part.length + inner.length + outer.length; if (n < need) missing.push(`참석자 ${need}명 이상 (1인당 한도 ${r.limitAmt.toLocaleString()}원, 지금 ${n}명)`); }
    if (!mealY && Math.round(snack + etc) !== Math.round(amt)) missing.push(`다과(B)+기타(C) = 청구액 ${amt.toLocaleString()}원 (지금 ${(snack + etc).toLocaleString()}원)`);
    return { ready: !missing.length, missing, meal, snack, etc };
  }
  const fmtSize = (n) => { n = Number(n) || 0; return n >= 1048576 ? `${(n / 1048576).toFixed(1)}MB` : n >= 1024 ? `${Math.round(n / 1024)}KB` : `${n}B`; };

  async function load() { try { return (await chrome.storage.local.get(KEY))[KEY] || {}; } catch (e) { return {}; } }
  const send = (msg) => new Promise((res, rej) => {
    try { chrome.runtime.sendMessage(msg).then((r) => { if (r && r.error) rej(new Error(r.error)); else res(r); }, rej); }
    catch (e) { rej(e); }
  });
  const readB64 = (f) => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result || '').split(',')[1] || '');
    fr.onerror = () => rej(fr.error || new Error('파일 읽기 실패'));
    fr.readAsDataURL(f);
  });
  const metaOf = (row) => { try { return JSON.parse((row && row.dataset.prepMeta) || '{}'); } catch (e) { return {}; } };

  /* 패널(host)에 위임 리스너를 붙인다. draw() 는 렌더러 호출. state.prep 은 미리 load() 로 채워 둔다 */
  function bind(host, state, draw) {
    if (!state.prep) state.prep = {};
    let noteTimer = 0;
    const note = (key, msg, err) => {
      state.prepNote = { key, msg, err: !!err }; draw();
      clearTimeout(noteTimer); noteTimer = setTimeout(() => { state.prepNote = null; draw(); }, err ? 8000 : 3500);
    };
    const apply = (key, r) => { if (r && r.entry) state.prep[key] = r.entry; else delete state.prep[key]; draw(); };
    const errMsg = (e) => { const m = String((e && e.message) || e); return /context invalidated/i.test(m) ? '확장 프로그램이 업데이트되었습니다. 페이지를 새로고침하세요' : m; };
    const hasFiles = (ev) => { try { return Array.from(ev.dataTransfer.types || []).includes('Files'); } catch (e) { return false; } };
    const rowOf = (ev) => (ev.target && ev.target.closest) ? ev.target.closest('[data-prep-key]') : null;
    const pair = (row) => { const k = row.dataset.prepKey; return Array.from(host.querySelectorAll('[data-prep-key]')).filter((r) => r.dataset.prepKey === k); };   // 거래 행 + 준비 줄
    const clearOver = () => { for (const r of host.querySelectorAll('.krext-prep-over')) r.classList.remove('krext-prep-over'); };

    /* 드래그 앤 드롭: 거래 행이나 준비 줄에 파일을 놓으면 저장. 패널 안 다른 곳에 놓아도 브라우저가 파일을 열며 화면을 떠나지 않게 기본 동작만 막는다 */
    host.addEventListener('dragover', (ev) => {
      if (!hasFiles(ev)) return;
      ev.preventDefault();
      const row = rowOf(ev);
      ev.dataTransfer.dropEffect = row ? 'copy' : 'none';
      if (row && !row.classList.contains('krext-prep-over')) { clearOver(); for (const r of pair(row)) r.classList.add('krext-prep-over'); }
      else if (!row) clearOver();
    });
    host.addEventListener('dragleave', (ev) => {
      const row = rowOf(ev); if (!row) return;
      const to = ev.relatedTarget;
      if (!to || !pair(row).some((r) => r.contains(to))) clearOver();
    });
    host.addEventListener('drop', (ev) => {
      if (!hasFiles(ev)) return;
      ev.preventDefault(); ev.stopPropagation();
      clearOver();
      const row = rowOf(ev); if (!row) return;
      addFiles(row, Array.from(ev.dataTransfer.files || []));
    });
    /* 파일 선택 창: 첨부 구역(data-act prep-pick)을 클릭하면 숨은 input[type=file] 을 연다. 고른 파일은 끌어다 놓은 것과 같은 경로(addFiles)로 저장.
     * input 은 패널 밖(body)에 둔다 — 패널은 그릴 때마다 innerHTML 이 갈려서 안에 두면 사라진다 */
    let picker = null, pickKey = '';
    const openPicker = (key) => {
      if (!picker) {
        picker = document.createElement('input');
        picker.type = 'file'; picker.multiple = true; picker.style.display = 'none';
        picker.addEventListener('change', () => {
          const files = Array.from(picker.files || []);
          picker.value = '';
          const row = host.querySelector(`[data-prep-key="${CSS.escape(pickKey)}"]`);   // 선택하는 동안 다시 그려졌을 수 있어 키로 다시 찾는다
          if (row && files.length) addFiles(row, files);
        });
        document.body.appendChild(picker);
      }
      pickKey = key;
      picker.click();
    };
    async function addFiles(row, files) {
      const key = row.dataset.prepKey, meta = metaOf(row);
      if (!state.prepRows) state.prepRows = new Set();
      if (!state.prepRows.has(key)) { state.prepRows.add(key); draw(); }   // 닫힌 거래 행에 놓아도 줄을 열어 저장되는 파일을 보인다
      const ok = [], bad = [];
      for (const f of files) {
        const ext = extOf(f.name);
        if (ext == null || DENY_EXT.has(ext)) bad.push(`${f.name} (첨부할 수 없는 종류)`);
        else if (f.size > MAX_FILE_MB * 1048576) bad.push(`${f.name} (${MAX_FILE_MB}MB 초과)`);
        else if (!f.size) bad.push(`${f.name} (빈 파일)`);
        else ok.push(f);
      }
      if (bad.length) note(key, `제외: ${bad.join(', ')}`, true);
      if (!ok.length) return false;
      state.prepBusy = { key, done: 0, total: ok.length }; draw();
      try {
        for (const f of ok) {   // 한 파일씩 (메시지 크기)
          const b64 = await readB64(f);
          const r = await send({ type: 'prepAddFiles', key, meta, files: [{ name: f.name, mime: f.type || '', size: f.size, b64, url: (f.src && f.src.url) || '', title: (f.src && f.src.title) || '' }] });   // src: 캡처한 탭(popup/capture.js fileOf) — 출처 링크
          if (r && r.entry) state.prep[key] = r.entry;
          state.prepBusy.done++; draw();
        }
        state.prepBusy = null;
        note(key, `${ok.length}개 파일 저장됨`);
        autoPick(key, meta);   // 새 파일의 종류(와 비어 있으면 청구종류)를 Claude 에
        return true;
      } catch (e) { state.prepBusy = null; note(key, `파일 저장 실패: ${errMsg(e)}`, true); return false; }
    }

    /* Claude 자동 분류 (lib/prep-ai.js, Help 서버 POST /classify): 고를 것이 없거나 서버가 없으면 백그라운드가 곧바로 skipped 로 답한다.
     * AI_SHOW_MS 넘게 걸릴 때만 그 줄에 "Claude 분류 중…"(state.prepAi[key]). 사용자가 고른 값은 백그라운드가 바꾸지 않는다 */
    const AI_SHOW_MS = 400;
    if (!state.prepAi) state.prepAi = {};
    const aiWait = {};   // 키 → 기다리는 요청 수
    let aiOldNoted = false;
    function autoPick(key, meta, force) {   // force: 청구내역 옆 [AI] 단추 — 직접 적은 글이 있어도 지금 첨부 파일로 청구내역을 꼭 다시 쓴다 (lib/prep-ai.js once force)
      aiWait[key] = (aiWait[key] || 0) + 1;
      const t = setTimeout(() => { if (aiWait[key]) { state.prepAi[key] = true; draw(); } }, force ? 0 : AI_SHOW_MS);
      const done = () => {
        clearTimeout(t);
        if (--aiWait[key] > 0) return;
        delete aiWait[key];
        if (state.prepAi[key]) { delete state.prepAi[key]; draw(); }
      };
      send({ type: 'prepAuto', key, meta, force: !!force }).then((r) => {
        done();   // 바뀐 항목은 storage.onChanged 로 들어온다 (그 사이 사용자가 바꾼 값을 응답의 옛 값으로 덮지 않게 여기서는 넣지 않음)
        const n = (r && r.kinds && r.kinds.length) || 0;
        if (r && (r.type || r.ptcl || n)) note(key, `${r.via === 'api' ? 'Claude API' : 'Claude'}: ${[r.type ? `청구종류 ${r.type.value}` : '', r.ptcl ? '청구내역 작성' : '', n ? `파일 종류 ${n}개` : ''].filter(Boolean).join(' · ')}`);
        else if (r && (r.skipped === 'old' || r.skipped === 'oldPtcl') && !aiOldNoted) { aiOldNoted = true; note(key, `Help 서버가 이전 버전이라 Claude ${r.skipped === 'old' ? '자동 분류를' : '청구내역 작성을'} 건너뜁니다 — 서버를 다시 실행하세요 (node help-server/server.js)`, true); }
        else if (force) note(key, r && r.skipped === 'offline' ? 'LLM 이 연결돼 있지 않습니다 — 설정 › LLM 설정에서 Help 서버 또는 Claude API 키를 확인하세요' : `Claude 가 청구내역을 쓰지 못했습니다${r && r.error ? `: ${r.error}` : r && r.skipped ? ` (${r.skipped})` : ' (작성 중·임시저장·신청된 거래는 바꾸지 않음)'}`, true);
      }, (e) => { done(); note(key, `Claude 자동 분류 실패: ${errMsg(e)}`, true); });
    }

    /* 첨부 파일 종류 select (파일 칩) → 저장소가 파일 이름을 "<종류>_…" 로 바꾼다 */
    host.addEventListener('change', (ev) => {
      const el = ev.target; if (!el || !el.dataset || !el.dataset.prepFkind) return;
      const key = el.dataset.prepFkind;
      send({ type: 'prepSetFileKind', key, id: el.dataset.id, kind: el.value }).then((r) => apply(key, r), (e) => note(key, `저장 실패: ${errMsg(e)}`, true));
    });
    /* 청구종류 select */
    host.addEventListener('change', (ev) => {
      const el = ev.target; if (!el || !el.dataset || !el.dataset.prepType) return;
      const key = el.dataset.prepType, meta = metaOf(el.closest('[data-prep-key]'));
      send({ type: 'prepSetType', key, meta, value: el.value })
        .then((r) => { apply(key, r); autoPick(key, meta); if (wantsMinutes(pickOf(picksNow(), el.value))) loadMeeting(meta.prjNo, meta.usedDate, false); }, (e) => note(key, `저장 실패: ${errMsg(e)}`, true));   // Claude 가 쓴 청구내역은 새 청구종류에 맞게 다시
    });

    /* ---- 참석자 카드 (식사비처럼 종류가 '식비'인 청구종류, render.js attRow): 참여인력 체크 · 내부참석자 검색 · 외부참석자 직접 입력 → prepSetAttendees.
     * 참여인력 목록과 회의록 규칙(외부참석자 필수·1인당 한도·회의사전신청 필수)은 과제별로 백그라운드(prepMeetingInfo → rcomm_0029_01_r001 + rcomm_0102_01_r001)에서 받아 state.prepMeet[prjNo] 에 둔다.
     * 회의록 팝업(content/rnd-meeting.js)이 저장된 참석자를 그대로 넣는다 ---- */
    if (!state.prepMeet) state.prepMeet = {};
    const picksNow = () => parsePicks((((state.data || {}).settings) || {}).quickPicks || []);
    const attOf = (key) => { const e = (state.prep || {})[key]; const a = (e && e.attendees) || {}; return { part: (a.part || []).slice(), inner: (a.inner || []).slice(), outer: (a.outer || []).slice() }; };
    const saveAtt = (key, meta, att) => send({ type: 'prepSetAttendees', key, meta, attendees: att }).then((r) => apply(key, r), (e) => note(key, `참석자 저장 실패: ${errMsg(e)}`, true));
    const meetKey = (prjNo, date) => `${prjNo}|${String(date || '').replace(/\D/g, '').slice(0, 8)}`;   // 과제 + 카드 사용일(휴일 여부·사전신청 연도)
    async function loadMeeting(prjNo, date, force) {
      if (!prjNo) return;
      const k = meetKey(prjNo, date);
      const cur = state.prepMeet[k];
      if (cur && (cur.loading || (!force && !cur.err && cur.members))) return;
      state.prepMeet[k] = Object.assign({}, cur || {}, { loading: true, err: '' }); draw();
      try {
        const r = await send({ type: 'prepMeetingInfo', prjNo, date, force: !!force });
        state.prepMeet[k] = r && r.ok
          ? { loading: false, err: '', members: r.info.members || [], rules: r.info.rules || null, preApps: r.info.preApps || [], holiday: !!r.info.holiday, rulesError: r.info.rulesError || '', ts: Date.now() }
          : { loading: false, err: (r && r.error) || '응답 없음', members: null, rules: null };
      } catch (e) { state.prepMeet[k] = { loading: false, err: errMsg(e), members: null, rules: null }; }
      draw();
    }
    // 그려진 카드가 아직 목록을 못 받았으면(data-att-need="과제|사용일") 불러온다 — 저장된 항목이 처음 그려질 때
    try { new MutationObserver(() => { for (const el of host.querySelectorAll('[data-att-need]')) { const [prj, dt] = String(el.dataset.attNeed || '').split('|'); loadMeeting(prj, dt, false); } }).observe(host, { childList: true, subtree: true }); } catch (e) {}
    /* 회의 내용 입력란(data-min=키, data-field=필드): 적는 동안 초안(state.prepMinDraft)에, 칸을 벗어나면(change) 저장 — 저장은 카드의 모든 칸 값을 모아 prepSetMinutes */
    const minutesOf = (key) => { const e = (state.prep || {})[key]; return Object.assign({}, (e && e.minutes) || {}); };
    function saveMinutes(key, row) {
      const m = minutesOf(key);
      for (const el of host.querySelectorAll(`[data-min="${CSS.escape(key)}"]`)) m[el.dataset.field] = el.value;
      if (state.prepMinDraft && state.prepMinDraft.key === key) state.prepMinDraft = null;
      return send({ type: 'prepSetMinutes', key, meta: metaOf(row), minutes: m }).then((r) => apply(key, r), (e) => note(key, `회의록 저장 실패: ${errMsg(e)}`, true));
    }
    host.addEventListener('input', (ev) => {
      const el = ev.target; if (!el || !el.dataset || !el.dataset.min) return;
      const key = el.dataset.min;
      const d = state.prepMinDraft && state.prepMinDraft.key === key ? state.prepMinDraft : { key, fields: {} };
      d.fields[el.dataset.field] = el.value;
      state.prepMinDraft = d;
      const cnt = host.querySelector(`[data-min-cnt="${CSS.escape(key)}"]`);   // 회의내용 글자수는 바로 갱신
      if (cnt && el.dataset.field === 'content') cnt.textContent = `${el.value.length}자`;
    });
    host.addEventListener('change', (ev) => {
      const el = ev.target; if (!el || !el.dataset || !el.dataset.min) return;
      saveMinutes(el.dataset.min, el.closest('[data-prep-key]'));
    });
    host.addEventListener('keydown', (ev) => {
      const el = ev.target; if (!el || !el.dataset || !el.dataset.min || el.tagName === 'TEXTAREA') return;
      if (ev.key === 'Enter') { ev.preventDefault(); el.blur(); }
    });
    async function searchInner(key) {
      const d = state.prepAttDraft && state.prepAttDraft.key === key ? state.prepAttDraft : {};
      const box = host.querySelector(`input[data-att-q="${CSS.escape(key)}"]`);
      const q = String(d.q != null ? d.q : ((box && box.value) || '')).trim();
      if (!q) { note(key, '검색할 성명을 적으세요', true); return; }
      state.prepSearch = { key, q, loading: true, list: null, err: '' }; draw();
      try { const r = await send({ type: 'prepPersonSearch', name: q }); state.prepSearch = { key, q, loading: false, list: (r && r.ok) ? (r.list || []) : [], err: r && r.ok ? '' : ((r && r.error) || '응답 없음') }; }
      catch (e) { state.prepSearch = { key, q, loading: false, list: [], err: errMsg(e) }; }
      draw();
    }
    function addOuter(key, row) {
      const d = state.prepAttDraft && state.prepAttDraft.key === key ? state.prepAttDraft : {};
      const val = (sel, v) => String(v != null ? v : ((host.querySelector(sel) || {}).value || '')).trim();
      const nm = val(`input[data-att-out-nm="${CSS.escape(key)}"]`, d.nm), dept = val(`input[data-att-out-dept="${CSS.escape(key)}"]`, d.dept);
      if (nm.length < 2) { note(key, '외부참석자 성명을 2자 이상 적으세요 (회의록 화면 규칙)', true); return; }
      if (!dept) { note(key, '외부참석자 소속을 적으세요', true); return; }
      const att = attOf(key);
      att.outer.push({ name: nm, dept });
      state.prepAttDraft = { key, q: d.q || '' };
      saveAtt(key, metaOf(row), att);
    }
    host.addEventListener('change', (ev) => {   // 참여인력 체크
      const el = ev.target; if (!el || !el.dataset || !el.dataset.attPart) return;
      const key = el.dataset.attPart, meta = metaOf(el.closest('[data-prep-key]'));
      const mi = state.prepMeet[meta.prjNo]; const m = mi && mi.members ? mi.members.find((x) => x.empNo === el.value) : null;
      const att = attOf(key);
      att.part = att.part.filter((x) => x.empNo !== el.value);
      if (el.checked && m) att.part.push({ empNo: m.empNo, name: m.name, dept: m.dept, from: m.from, to: m.to });
      saveAtt(key, meta, att);
    });
    host.addEventListener('input', (ev) => {   // 검색어·외부참석자 입력란은 적는 동안 초안에 (다시 그려져도 남게)
      const el = ev.target; if (!el || !el.dataset) return;
      const key = el.dataset.attQ || el.dataset.attOutNm || el.dataset.attOutDept; if (!key) return;
      const d = state.prepAttDraft && state.prepAttDraft.key === key ? state.prepAttDraft : { key };
      if (el.dataset.attQ) d.q = el.value; else if (el.dataset.attOutNm) d.nm = el.value; else d.dept = el.value;
      state.prepAttDraft = d;
    });
    host.addEventListener('keydown', (ev) => {
      const el = ev.target; if (!el || !el.dataset || ev.key !== 'Enter') return;
      if (el.dataset.attQ) { ev.preventDefault(); searchInner(el.dataset.attQ); }
      else if (el.dataset.attOutNm || el.dataset.attOutDept) { ev.preventDefault(); addOuter(el.dataset.attOutNm || el.dataset.attOutDept, el.closest('[data-prep-key]')); }
    });
    /* 청구내역(적요) 입력란: 적는 동안은 state.prepDraft 에만 두고(다른 이유로 다시 그려져도 글이 남게. 저장·다시 그리기는 안 함), 칸을 벗어나거나 Enter 면(change) 저장. Esc 는 저장된 글로 되돌림.
     * 저장 중이면 "청구서 작성"이 그 저장을 기다린다(ptclSaving): 버튼을 누르면 blur → change → 저장이 먼저 시작되므로 옛 글로 작성되지 않게 */
    let ptclSaving = null;
    const savedPtcl = (key) => String(((state.prep || {})[key] || {}).ptcl || '');
    host.addEventListener('input', (ev) => {
      const el = ev.target; if (!el || !el.dataset || !el.dataset.prepPtcl) return;
      state.prepDraft = { key: el.dataset.prepPtcl, value: el.value };
    });
    host.addEventListener('change', (ev) => {
      const el = ev.target; if (!el || !el.dataset || !el.dataset.prepPtcl) return;
      const key = el.dataset.prepPtcl, value = el.value.trim();
      state.prepDraft = null;
      if (value === savedPtcl(key)) { draw(); return; }
      const meta = metaOf(el.closest('[data-prep-key]'));
      const p = send({ type: 'prepSetPtcl', key, meta, value })
        .then((r) => { apply(key, r); autoPick(key, meta); }, (e) => note(key, `저장 실패: ${errMsg(e)}`, true))   // 청구내역이 바뀌면 Claude 가 고른(또는 빈) 청구종류를 다시
        .finally(() => { if (ptclSaving === p) ptclSaving = null; });
      ptclSaving = p;
    });
    host.addEventListener('keydown', (ev) => {
      const el = ev.target; if (!el || !el.dataset || !el.dataset.prepPtcl) return;
      if (ev.key === 'Enter') { ev.preventDefault(); el.blur(); }
      else if (ev.key === 'Escape') { ev.preventDefault(); el.value = savedPtcl(el.dataset.prepPtcl); state.prepDraft = null; el.blur(); }
    });
    host.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-act^="prep-"]'); if (!btn) return;
      ev.preventDefault(); ev.stopPropagation();
      const act = btn.dataset.act, key = btn.dataset.key;
      if (act === 'prep-file-del') send({ type: 'prepRemoveFile', key, id: btn.dataset.id }).then((r) => apply(key, r), (e) => note(key, `삭제 실패: ${errMsg(e)}`, true));
      else if (act === 'prep-file-open') send({ type: 'prepFileOpen', id: btn.dataset.id }).catch((e) => note(key, `파일 열기 실패: ${errMsg(e)}`, true));   // 파일 칩 이름 클릭 → 백그라운드가 popup/file.html 새 탭 (세 호스트 공통)
      else if (act === 'prep-ptcl-ai') { state.prepDraft = null; autoPick(key, metaOf(btn.closest('[data-prep-key]')), true); }   // 청구내역 옆 [AI]: 지금 첨부 파일(찾아온 서류 포함)로 Claude 가 다시 씀
      else if (act === 'prep-clear') send({ type: 'prepClear', key }).then(() => apply(key, null), (e) => note(key, `지우기 실패: ${errMsg(e)}`, true));   // 패널의 준비 항목만 지움/감춤 (R&D ERP 는 그대로)
      else if (act === 'prep-run') {   // 백그라운드 탭에서 청구서 작성(data-mode add) / 작성+신청(add,apply) / 신청(apply) (background.js prepRun → ERP 청구서의 rnd-claim.js). 진행 상태는 claimPrep[key].run 으로 돌아온다
        const mode = btn.dataset.mode || 'add';
        const doing = mode === 'delete' ? '임시저장을 삭제하는' : mode === 'apply' ? '신청하는' : mode.includes('apply') ? '작성하고 신청하는' : '작성하는';
        if (mode === 'delete' && !confirm('R&D ERP 결의서에서 이 청구내역(임시저장)을 삭제할까요?\n결의서에 이 건만 있으면 결의서 자체가 삭제됩니다. 삭제되면 거래가 미청구 목록으로 돌아옵니다.')) return;
        btn.disabled = true;
        Promise.resolve(ptclSaving).catch(() => {}).then(() => send({ type: 'prepRun', key, mode })).then((r) => {
          if (r && r.ok) note(key, `백그라운드 탭에서 청구서를 ${doing} 중…`);
          else { btn.disabled = false; note(key, `시작 실패: ${(r && r.error) || '응답 없음'}`, true); }
        }, (e) => { btn.disabled = false; note(key, `시작 실패: ${errMsg(e)}`, true); });
      }
      else if (act === 'prep-pick') openPicker(key);   // 첨부 구역 클릭 → 파일 선택 창 (사용자 클릭 안에서 열어야 함)
      else if (act === 'prep-att-search') searchInner(key);   // 참석자 카드: 내부참석자 검색
      else if (act === 'prep-att-add-inner') {   // 검색 결과에서 내부참석자 추가
        const att = attOf(key);
        if (!att.inner.some((x) => x.empNo === btn.dataset.emp)) att.inner.push({ empNo: btn.dataset.emp || '', name: btn.dataset.name || '', dept: btn.dataset.dept || '' });
        state.prepSearch = null; state.prepAttDraft = null;
        saveAtt(key, metaOf(btn.closest('[data-prep-key]')), att);
      }
      else if (act === 'prep-att-add-outer') addOuter(key, btn.closest('[data-prep-key]'));
      else if (act === 'prep-att-del') { const att = attOf(key); const g = btn.dataset.group; if (att[g]) att[g].splice(Number(btn.dataset.idx), 1); saveAtt(key, metaOf(btn.closest('[data-prep-key]')), att); }
      else if (act === 'prep-att-reload') loadMeeting(btn.dataset.prj, btn.dataset.date, true);
      else if (act === 'prep-att-close') { state.prepSearch = null; draw(); }
      else if (act === 'prep-row') {   // 거래 행 클릭: 그 거래 밑 청구 준비 줄 열기/닫기 (render.js txRow · prepShown). 행 안 글자를 끌어 고르는 중이면 무시
        try { if (String(window.getSelection() || '').length) return; } catch (e) {}
        ev.preventDefault();
        if (!state.prepRows) state.prepRows = new Set();
        if (state.prepRows.has(key)) state.prepRows.delete(key);
        else { state.prepRows.add(key); autoPick(key, metaOf(btn)); }   // 열 때 청구종류가 비어 있으면 Claude 에 (가맹점·금액·사용일로)
        draw();
      }
      else if (act === 'prep-tab') send({ type: 'prepFocusTab', key }).then((r) => { if (!(r && r.ok)) note(key, (r && r.error) || '탭을 찾지 못했습니다', true); }, (e) => note(key, errMsg(e), true));
      else if (act === 'prep-fetch') startFetch(key, metaOf(btn.closest('[data-prep-key]')));
      else if (act === 'prep-fetch-stop') send({ type: 'prepFetchCancel', key }).catch((e) => note(key, `중지 실패: ${errMsg(e)}`, true));
      else if (act === 'prep-fetch-reg') {   // 등록 칸: 확장 페이지면 이 카드에, eClass 패널이면 설정 페이지(비밀번호를 eClass 페이지 DOM 에 받지 않음)
        const meta = metaOf(btn.closest('[data-prep-key]'));
        if (!secure) send({ type: 'openOptions', hash: 'fetch-new=' + encodeURIComponent(meta.shop || '') }).catch((e) => note(key, errMsg(e), true));
        else if (state.fetchForm && state.fetchForm.key === key) { state.fetchForm = null; draw(); }
        else openForm(key, meta);
      }
      else if (act === 'prep-fetch-edit') send({ type: 'openOptions', hash: 'fetch=' + encodeURIComponent(btn.dataset.id || '') }).catch((e) => note(key, errMsg(e), true));
      else if (act === 'prep-fetch-chat') {   // 💬 사이트 안내 고치기: 확장 페이지면 바로 아래 채팅(popup/prep-chat.js), eClass 패널이면 설정 페이지의 찾는 방법 익히기를 이 가맹점으로(options/fetch-chat.js pick) — 마지막 찾아오기가 못 찾은 이유(why)를 글에 미리 넣는다
        const f = (state.prepFetch || {})[key] || {};
        const why = f.state === 'empty' ? (f.missing || []).map((m) => `${m.kind}(${m.reason})`).join(', ') : f.state === 'error' ? String(f.msg || '') : '';
        if (secure && g.KRX_PREP_CHAT && g.KRX_PREP_CHAT.toggle(key, btn.dataset.id || '', why ? `찾지 못함: ${why} — 이 사이트의 안내·기억한 찾는 방법을 고쳐 줘` : '')) return;
        send({ type: 'openOptions', hash: 'fetch-chat=' + encodeURIComponent(btn.dataset.id || '') + (why ? '&why=' + encodeURIComponent(why) : '') }).catch((e) => note(key, errMsg(e), true));
      }
      else if (act === 'prep-fetch-formclose') { state.fetchForm = null; draw(); }
      else if (act === 'prep-fetch-save') saveForm(key, !!btn.dataset.go);
    });

    /* ---- 증빙 찾아오기 (lib/prep-fetch.js · lib/fetch-sites.js): 가맹점이 "자주 사용" 으로 등록돼 있으면 [찾아오기] → 백그라운드가 Help 서버(site-fetch/)에 맡기고 진행을 storage.local.prepFetch 에 둔다.
     * 등록 칸(render.js fetchFormHtml)은 확장 페이지(사이드 패널·팝업)에서만 — 입력값은 state.fetchForm.f 에 보관(다시 그려져도 남게), 저장은 fetchSiteSave(비밀번호는 storage.local.fetchCred) ---- */
    const SITES = g.KRX_SITES;
    const secure = typeof location !== 'undefined' && location.protocol === 'chrome-extension:';
    if (SITES) {
      SITES.load().then((v) => { state.fetchSites = v; draw(); });
      chrome.storage.local.get('prepFetch').then((r) => { state.prepFetch = (r && r.prepFetch) || {}; draw(); }, () => {});
    }
    // LLM(Help 서버) 연결 상태 (background lib/llm.js → storage.local.llmStatus): 찾아오기·자주 사용 등록은 연결돼 있고 서버에 찾아오기가 있을 때만 보인다 (render.js prepCtx.fetch)
    chrome.storage.local.get('llmStatus').then((r) => { state.llm = (r && r.llmStatus) || null; draw(); }, () => {});
    // Claude API 쪽 연결(제목 줄 B(브릿지) 아이콘의 색 — lib/render.js llmSetupBtn): 키가 있고 마지막 확인(storage.local.llmApi, lib/claude-api.js check)이 그 키로 ok. 키 값은 들고 있지 않고 지문(길이·끝 4자 = keyTag)만 견준다
    const apiOk = (r) => { const k = String((r && r.claudeApiKey) || '').trim(), st = r && r.llmApi; return { ok: !!(k && st && st.ok && st.keyTag === `${k.length}·${k.slice(-4)}`) }; };
    chrome.storage.local.get(['claudeApiKey', 'llmApi']).then((r) => { state.llmApi = apiOk(r); draw(); }, () => {});
    function openForm(key, meta) {
      if (!SITES) return;
      state.fetchForm = { key, meta, f: Object.assign(SITES.defaultsFor(meta.shop, kindDocs()), { id: '', pw: '' }), docsTouched: false, err: '', saving: false };
      draw();
      setTimeout(() => { const el = host.querySelector(`[data-fetch-f="${state.fetchForm && state.fetchForm.f.url ? 'id' : 'url'}"]`); if (el) el.focus(); }, 0);
    }
    const kindDocs = () => (((state.data || {}).settings) || {}).fetchDocs || null;   // 설정의 종류별 필요 서류
    async function startFetch(key, meta) {
      const r = await send({ type: 'prepFetch', key, meta }).catch((e) => ({ ok: false, error: errMsg(e) }));
      if (r && r.ok) note(key, `${r.label} 에서 ${(r.docs || []).join('·') || '서류'} 찾는 중 — 작업용 Chrome 창이 열립니다 (추가 인증이 나오면 그 창에서)`);
      else if (r && r.kind === 'nosite' && secure) openForm(key, meta);
      else note(key, `찾아오기: ${(r && r.error) || '응답 없음'}`, true);
    }
    async function saveForm(key, go) {
      const ff = state.fetchForm;
      if (!ff || ff.key !== key || ff.saving) return;
      const v = ff.f;
      ff.saving = true; ff.err = ''; draw();
      const r = await send({ type: 'fetchSiteSave', site: { label: v.label, match: v.match, url: v.url, kind: v.kind, docs: ff.docsTouched ? v.docs : [], hint: v.hint, browser: v.browser }, cred: { id: v.id, pw: v.pw } })   // 서류를 직접 고르지 않았으면 종류 기본을 따름.catch((e) => ({ ok: false, error: errMsg(e) }));
      if (!r || !r.ok) { ff.saving = false; ff.err = (r && r.error) || '저장하지 못했습니다'; draw(); return; }
      state.fetchSites = (state.fetchSites || []).filter((x) => x.id !== r.site.id).concat([r.site]);   // storage.onChanged 가 오기 전에도 [찾아오기]가 보이게
      state.fetchForm = null;
      if (!SITES.match(state.fetchSites, ff.meta.shop)) { note(key, `등록했지만 가맹점 글자 "${v.match}" 가 이 거래의 가맹점 이름에 없습니다 — 설정 › LLM 설정 › 증빙 찾아오기에서 고치세요`, true); return; }
      note(key, `${r.site.label} 을(를) 자주 사용으로 등록했습니다`);
      if (go) startFetch(key, ff.meta);
    }
    host.addEventListener('input', (ev) => {
      const el = ev.target;
      if (el && el.dataset && el.dataset.fetchF && state.fetchForm) state.fetchForm.f[el.dataset.fetchF] = el.value;
    });
    host.addEventListener('change', (ev) => {
      const el = ev.target, ff = state.fetchForm;
      if (!el || !el.dataset || !ff) return;
      if (el.dataset.fetchF === 'kind') { ff.f.kind = el.value; if (!ff.docsTouched) ff.f.docs = SITES.docsFor(el.value, kindDocs()); draw(); }   // 종류를 바꾸면 그 종류의 필요 서류로 (서류를 직접 고른 뒤에는 그대로)
      else if (el.dataset.fetchDoc) { const set = new Set(ff.f.docs || []); if (el.checked) set.add(el.dataset.fetchDoc); else set.delete(el.dataset.fetchDoc); ff.f.docs = Array.from(set); ff.docsTouched = true; draw(); }
    });
    // 다른 창(팝업 ↔ eClass)이나 ERP 청구서(첨부 완료 표시)에서 바뀐 값 반영
    try {
      chrome.storage.onChanged.addListener((ch, area) => {
        try { if (area === 'local' && ch[KEY]) { state.prep = ch[KEY].newValue || {}; draw(); } } catch (e) {}
        try { if (area === 'local' && (ch.fetchSites || ch.prepFetch)) { if (ch.fetchSites) state.fetchSites = ch.fetchSites.newValue || []; if (ch.prepFetch) state.prepFetch = ch.prepFetch.newValue || {}; draw(); } } catch (e) {}   // 증빙 찾아오기: 등록 사이트 · 진행 상태
        try { if (area === 'local' && ch.llmStatus) { state.llm = ch.llmStatus.newValue || null; draw(); } } catch (e) {}   // LLM 연결 상태가 바뀜 → 찾아오기 버튼 표시 갱신
        try { if (area === 'local' && (ch.claudeApiKey || ch.llmApi)) chrome.storage.local.get(['claudeApiKey', 'llmApi']).then((r) => { state.llmApi = apiOk(r); draw(); }, () => {}); } catch (e) {}   // API 키·확인 결과가 바뀜 → B 아이콘 색
      });
    } catch (e) {}
    /* 다른 모듈(사이드 패널의 화면 캡처, popup/capture.js)이 쓰는 손잡이: 준비 키로 파일 저장(끌어다 놓은 것과 같은 경로, 실패하면 throw) · 그 줄에 안내 문구 */
    return {
      note,
      async addFilesTo(key, files) {
        const row = Array.from(host.querySelectorAll('[data-prep-key]')).find((r) => r.dataset.prepKey === key);
        if (!row) throw new Error('그 거래 행이 목록에 없습니다 (새로 조회돼 사라졌을 수 있음)');
        if (!(await addFiles(row, files))) throw new Error('파일을 저장하지 못했습니다');
      },
    };
  }

  g.KRX_PREP = { KEY, MAX_FILE_MB, parsePicks, pickOf, isMeetingPick, wantsAttendees, wantsMinutes, minutesCheck, meetKey: (prjNo, date) => `${prjNo}|${String(date || '').replace(/\D/g, '').slice(0, 8)}`, fmtSize, load, bind };
})(typeof self !== 'undefined' ? self : this);
