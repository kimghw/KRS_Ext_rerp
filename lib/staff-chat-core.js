/* 참여연구원 변경 도우미(채팅)의 공용 부분 (0.8.8 — 2026-10-19 사용자 "여기 우측에 LLM 에이전트 채팅창을 붙여주고, 참여연구원 변경 사항에 대한 작업요청을 대신 해 줄 수 있도록 해줘. 이건 LLM 이 연결된 경우에만")
 * — 입력 정리 · 프롬프트 · JSON 스키마 · 결과 검사 · 작업 한 줄 글. 두 곳이 같이 쓴다:
 *   Help 서버(help-server/staff-chat.js 가 require — claude -p 한 번, 도구 없음)와 확장의 참여연구원 변경 탭(popup/staff-chat.js 가 opText 로 반영 결과를 적음). 고치면 서버를 다시 띄우고 확장도 다시 올려야 둘 다 반영된다.
 * 흐름: 탭이 요청 글 + 보고 있는 과제·연차 계획의 요약(lib/staff-ui.js bind().agent.snapshot — 이름·역할·월급여·월별 지급·참여율(천원·%)·예산·초과금/부족금·rERP 등록·지급 완료(잠금)·알림)과 이전 대화 몇 줄을 보내면
 *   Claude 가 { reply(한두 문장), ops[작업…] } 을 돌려주고, 확장(agent.apply)이 ops 를 차례대로 화면의 계획에 반영한다(계산·저장·변경이력은 표의 칸·✎ 폼과 같은 길 — lib/staff.js). Claude 는 화면·R&D ERP 를 직접 만지지 못한다.
 * 작업(ops) — 스키마는 모든 칸을 required 로 두고 안 쓰는 칸은 ''·0·false (구조화 출력의 optional 을 쓰지 않음, classify-core 와 같은 방식):
 *   change(name, from, to, mode rate|amt|exclude|short|fit, value) · total(name, from, to, value) · monthly(name, value) · role(name, role) · remove(name)
 *   · add(newName, role, monthly, from, to, mode, value) · init(how erp|prev|carry) · clear · year(year) · period(from, to 'YYYY-MM') · budget(value) · support_add(newName, supportRole, ref) · support_remove(name)
 *   날짜는 'YYYY-MM-DD'(달만이면 'YYYY-MM' — 확장이 1일·마지막 날로), 금액은 천원, 참여율·나머지의 % 는 %. 이름(name)은 계획·행정지원 목록의 enum — 목록 밖 이름은 버린다(add·support_add 의 newName 만 자유).
 * 입력(clean): { text, history:[{ role:'user'|'assistant', text }], snapshot:{ prjNo, alias, prjNm, year, from, to, months, today, lock, budgetPay, total, diff, basis, names[], people[], support, supportNames[], erp:{ at, lines[], missing[] }, warnings[], collect[](자료 요청 응답 줄 — 0.8.9), defaultRange:{ from, to }, years[], hasPlan, erpState } }
 * 결과(parse): { reply, ops(검사를 통과한 것만 — 모르는 작업·목록에 없는 이름·읽을 수 없는 날짜·값은 버림), dropped }
 * 예산 규칙(rules — 2026-10-20 사용자 "이 에이전트에 claude.md … 예산에 대해서만 참고할 만한 프롬프트를 넣고 관리할 수 있도록"): 변경 도우미의 CLAUDE.md 구실. 기본 글은 DEFAULT_RULES, 사용자가 고친 글은 storage.local.staffRules(채팅 머리의 [규칙])이며
 *   요청의 rules 로 와서(rulesOf — 줄바꿈은 두고 제어 문자·줄 끝 공백만 지움, 3,000자) build().system 이 SYSTEM 뒤에 붙인다(빈 글이면 SYSTEM 그대로). 예산(인건비 예산·참여율·월급여)에 관한 것만 두고 작업 종류·스키마는 여기서 바꾸지 않는다.
 * 첨부(files — 2026-10-21 사용자 "엑셀, 워드, PDF, HWP/X, 이미지를 첨부할 수 있게"): 확장이 보내기 전에 lib/doc-text.js 로 글을 뽑아 { name, kind, type, size, text, truncated } 로, PDF·이미지는 data(base64)로 보낸다(fileOf 가 검사 — 이름의 경로 문자는 _, 종류 밖은 '', base64 는 pdf·image 만).
 *   Help 서버는 data 를 요청별 폴더에 써 두고 path 를 두며(Read 로 읽게), Claude API 길은 블록으로 붙이고 attached 를 둔다. build() 가 "첨부 파일" 절(filesLines — 글은 그대로 — 파일마다 LIMIT.fileText, 합 LIMIT.filesText · path 는 Read 안내 · attached 는 블록 안내 · 못 읽은 것은 note)을 요청 글에 넣는다.
 * 연구수당 도우미(lib/allow-chat-core.js — 연구수당 계산 탭의 같은 채팅, 2026-10-21)가 이 파일의 글 정리(str·multi·list·fin·fmt·nameKeyOf)·rulesOf·fileOf·filesLines·LIMIT 를 가져다 쓴다 — 프롬프트·작업·스키마는 그쪽 것 */
(function (g) {
  'use strict';
  const LIMIT = { text: 2000, history: 8, turn: 400, names: 40, line: 400, lines: 40, ops: 20, reply: 600, name: 40, rules: 3000, files: 6, fileName: 80, fileText: 12000, filesText: 40000, fileData: 28 * 1024 * 1024 };
  const OPS = Object.freeze(['change', 'total', 'monthly', 'role', 'remove', 'add', 'init', 'clear', 'year', 'period', 'budget', 'support_add', 'support_remove']);
  const MODES = Object.freeze(['rate', 'amt', 'exclude', 'short', 'fit']);
  const NOVALUE = new Set(['exclude', 'fit']);   // 값이 필요 없는 구분
  const ROLES = Object.freeze(['과제책임자', '참여연구원', '행정지원']);
  const HOWS = Object.freeze(['erp', 'prev', 'carry']);   // carry — 이전 차년도에서 가져오기(2026-10-20, 2차년도부터)
  const YEAR_MAX = 60;
  const KINDS = Object.freeze(['xlsx', 'docx', 'hwpx', 'hwp', 'text', 'pdf', 'image']);   // 첨부 종류 (lib/doc-text.js kindOf)
  const KIND_LABEL = Object.freeze({ xlsx: '엑셀', docx: '워드', hwpx: 'HWPX', hwp: 'HWP', text: '글', pdf: 'PDF', image: '이미지' });
  const SYSTEM = [
    '너는 한국 국가 R&D 과제의 참여연구원 인건비 지급 계획(참여율·월별 지급금액)을 고치는 도우미다. 사용자는 연구원이며, 브라우저 확장 "KR eClass + R&D ERP 현황"의 참여연구원 변경 화면 옆 채팅으로 요청한다.',
    '너는 화면이나 R&D ERP 를 직접 만지지 못한다. 정해진 작업(ops)을 돌려주면 확장이 그 차례대로 화면의 계획에 반영하고 결과 수치를 셈한다. 이 화면의 계획은 확장 안의 계획표이며 R&D ERP 에 바로 쓰이지 않는다.',
    '규칙:',
    '- 금액 단위는 천원, 참여율은 %. 월 지급금액 = 월급여 × 참여율(천원 반올림). 연간 참여율 = 지급 합 ÷ (월급여 × 참여개월). 계획 합과 인건비 예산의 차가 부족금(예산보다 적음)·초과금(예산을 넘음)이다. 같은 사람의 어느 달 참여율 합(이 과제 + 다른 과제)이 100% 를 넘으면 안 된다.',
    '- 요청이 분명하면 ops 를 채우고 reply 에 무엇을 반영하는지 짧게 적는다. 누구·언제·얼마가 분명하지 않으면 ops 를 비우고 reply 로 되묻는다. 질문·설명 요청이면 ops 없이 답만 한다.',
    '- 되돌리기 어려운 일(계획 지우기 clear · 초기화 init · 사람 빼기 remove)은 사용자가 그렇게 하라고 분명히 말했을 때만 넣는다.',
    '- 날짜는 YYYY-MM-DD. 달만 말하면 적용일(from)은 그 달 1일, 종료일(to)은 그 달 마지막 날. "5월부터" 는 from 만 두고 to 는 비운다(기간 끝까지). 해를 말하지 않으면 계획 기간의 해로 본다. from 을 비우면 그 사람의 지급이 있는 전체 기간이다. 계획 기간 밖의 달은 쓸 수 없다.',
    '- rERP 지급이 끝난 달(잠금)까지의 지급은 바꿀 수 없다 — 적용일은 그 다음 달 1일 이후로 하고, 그 달에 지급이 있는 사람은 remove 대신 그 뒤 달부터 exclude 로.',
    '- 이름은 참여연구원 목록의 표기 그대로 name 에 넣는다. 목록에 없는 사람은 사용자가 더하라고 했을 때만 add(newName)로 — 그 밖에는 되묻는다.',
    '- 예산에 맞추기("초과금 줄여", "부족금 채워", "예산대로", "예산에 맞게")는 한 사람의 change 에 mode fit(그 기간의 지급을 차만큼 늘리거나 줄여 합을 예산과 같게). "나머지를 ○○에게 n%"·"남는 돈 다 ○○에게"는 mode short 로 나머지(인건비 예산 − 다른 사람들의 지급)의 %(한 사람이 다 가지면 100, 둘이 나누면 50)를 value 에.',
    '- 금액·참여율의 결과는 확장이 셈하므로 reply 에 계산 결과를 단정해 적지 말고, 반영 뒤 표를 보라고만 한다.',
    '- reply 는 한국어 평문으로 두 문장 안에, 마크다운·머리표 없이.',
  ].join('\n');
  const OPS_GUIDE = [
    '작업(ops) 종류 — 차례대로 반영된다. 안 쓰는 칸은 "" · 0 · false 로 둔다:',
    '- change: name 의 지급을 from~to 에 바꾼다 — mode rate(참여율 %, value) · amt(월 지급금액 천원, value) · exclude(0원) · short(나머지의 %, value — 인건비 예산에서 다른 사람들의 지급과 이 사람의 그 기간 밖 지급을 뺀 나머지의 몇 %) · fit(예산에 맞추기 — 그 기간의 지급을 초과금만큼 줄이거나 부족금만큼 늘려 합을 예산과 같게, value 불필요). from 을 비우면 지급이 있는 전체 기간.',
    '- total: name 의 from~to(비우면 전체) 지급 합을 value 천원으로(달마다 균등, 마지막 달 잔액).',
    '- monthly: name 의 월급여를 value 천원으로(직접 적은 값 — rERP 값보다 앞섬; 0 이면 rERP 값으로 되돌림).',
    '- role: name 의 역할을 role(과제책임자 · 참여연구원 · 행정지원)로 — 지급은 그대로.',
    '- remove: name 을 계획에서 뺀다.',
    '- add: newName 을 더한다 — role(비우면 참여연구원), monthly(월급여 천원 — rERP 에 있는 사람이면 0 으로 두면 그 값), from~to 와 mode·value 로 지급(mode 를 비우면 rate; fit 은 안 됨 — 더할 때 예산을 채우려면 short 100). role 이 행정지원이면 행정지원 구역에 더한다.',
    '- init: how erp(rERP 등록 지급계획을 이 기간 그대로) · prev(이전 기간의 지급 비율로 인건비 예산을 나눔) · carry(2차년도부터 — 앞 연차의 연구원·월급여·마지막 참여율을 이 기간 전체에, "이전 차년도 가져와")로 계획을 처음부터 세운다 — 있던 계획은 바뀐다.',
    '- clear: 이 연차 계획을 지운다.',
    '- year: 보는 연차를 year(정수)로 바꾼다 — 뒤의 작업은 그 연차에.',
    '- period: 계획 기간을 from~to(YYYY-MM)로 — 기간 밖 달의 지급은 버려진다.',
    '- budget: 인건비 예산을 value 천원으로.',
    '- support_add / support_remove: 행정지원에 newName 을 더한다(supportRole 맡은 일 · ref 공문 참조 여부) / name 을 뺀다.',
  ].join('\n');

  /* 예산 규칙 기본 글 — 사용자가 [규칙]에서 고쳐 쓰는 바탕. 예산에 관한 것만 */
  const DEFAULT_RULES = [
    '# 예산 규칙 — 변경 도우미가 요청을 작업으로 옮길 때 참고합니다. 이 글은 채팅 머리의 [규칙]에서 고칠 수 있어요.',
    '',
    '## 인건비 예산',
    '- 인건비 예산은 이 연차 협약의 인건비 비목 금액(천원)입니다. 계획 합은 예산을 넘기지 않습니다 — 요청대로 하면 초과금이 생길 때는 반영하지 말고 어느 사람·기간을 줄일지 되묻습니다.',
    '- 부족금(예산보다 적음)은 그대로 둘 수 있습니다. 채우라고 했으면 누구에게 얼마를 줄지 분명할 때만 반영합니다.',
    '- 인건비 예산 금액(budget)은 사용자가 금액을 말했을 때만 바꿉니다. 초과금을 없애려고 예산을 늘리지 않습니다.',
    '',
    '## 참여율 · 월급여',
    '- 한 사람의 어느 달 참여율 합(이 과제 + 다른 과제)은 100% 를 넘을 수 없습니다. 알림에 다른 과제 참여율이 있으면 그 범위 안에서만 올립니다.',
    '- 월급여는 rERP 등록 값이 기준입니다. 직접 적은 월급여(monthly)는 사용자가 값을 말했을 때만 넣습니다.',
    '- rERP 지급이 끝난 달(잠금)의 금액은 바꾸지 않습니다.',
    '',
    '## 반영 전에 확인받을 것',
    '- 한 번에 바뀌는 금액이 인건비 예산의 30% 를 넘는 요청(예: 전체 재배분)은 무엇을 어떻게 바꿀지 요약해 확인을 받습니다.',
  ].join('\n');
  const RULES_HEAD = '예산 규칙 — 사용자가 변경 도우미의 [규칙]에서 관리하는 글이다. 요청이 이 규칙에 어긋나면 ops 를 비우고 reply 로 까닭을 알린다:';

  const str = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n || LIMIT.line);
  const multi = (v, n) => String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').replace(/[^\S\n]+$/gm, '').trim().slice(0, n);   // 여러 줄 글 — 줄바꿈은 두고 제어 문자·줄 끝 공백만 지움
  const rulesOf = (v) => multi(v, LIMIT.rules);   // 규칙 글
  /* 첨부 하나 검사 → { name(경로 문자는 _), kind, type, size, text(뽑은 글), truncated, data(base64 — pdf·image 만), attached(API 블록으로 함께 감), note(못 읽은 까닭) }. 이름이 없으면 null */
  function fileOf(f) {
    const r = f && typeof f === 'object' ? f : {};
    const name = String(r.name == null ? '' : r.name).replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').trim().replace(/^\.+/, '').slice(0, LIMIT.fileName);
    if (!name) return null;
    const kind = KINDS.includes(r.kind) ? r.kind : '';
    const data = (kind === 'pdf' || kind === 'image') && typeof r.data === 'string' && r.data.length <= LIMIT.fileData && /^[A-Za-z0-9+\/]+=*$/.test(r.data) ? r.data : '';
    return { name, kind, type: str(r.type, 80), size: Math.max(0, Math.round(Number(r.size) || 0)), text: multi(r.text, LIMIT.fileText), truncated: !!r.truncated, data, attached: !!r.attached, note: str(r.note, 200) };
  }
  const list = (v, n) => (Array.isArray(v) ? v : []).slice(0, n);
  const fin = (v) => { const n = Number(typeof v === 'string' ? v.replace(/[,\s%원]/g, '') : v); return Number.isFinite(n) ? n : null; };
  const fmt = (n) => (Number.isFinite(Number(n)) ? Math.round(Number(n)).toLocaleString('en-US') : '');
  const nameKeyOf = (s) => String(s == null ? '' : s).replace(/\s/g, '');
  const dim = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  /* 날짜 글 → 'YYYY-MM-DD'(2026-05-01 · 20260501 · 2026.5.1 · 2026/05/01) 또는 'YYYY-MM'(2026-05 · 202605 · 2026.5). 못 읽거나 없는 날이면 '' */
  function dateOf(v) {
    const s = String(v == null ? '' : v).trim();
    if (!s) return '';
    const m = /^(\d{4})[-./]?(\d{1,2})(?:[-./]?(\d{1,2}))?$/.exec(s);
    if (!m) return '';
    const y = Number(m[1]), mo = Number(m[2]);
    if (!(mo >= 1 && mo <= 12)) return '';
    if (m[3] == null) return `${y}-${String(mo).padStart(2, '0')}`;
    const d = Number(m[3]);
    if (!(d >= 1 && d <= dim(y, mo))) return '';
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  const ymOf = (v) => { const d = dateOf(v); return d ? d.slice(0, 7) : ''; };
  const addMonth = (ym) => { const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; };

  /* 요청 본문 → 검사·정리한 입력 (글이 비면 throw) */
  function clean(body) {
    const b = body && typeof body === 'object' ? body : {};
    const text = str(b.text, LIMIT.text);
    if (!text) throw new Error('요청 글이 비어 있습니다');
    const s = b.snapshot && typeof b.snapshot === 'object' ? b.snapshot : {};
    const erp = s.erp && typeof s.erp === 'object' ? s.erp : {};
    const dr = s.defaultRange && typeof s.defaultRange === 'object' ? s.defaultRange : {};
    const names = (v) => Array.from(new Set(list(v, LIMIT.names).map((x) => str(x, LIMIT.name)).filter(Boolean)));
    const lines = (v) => list(v, LIMIT.lines).map((x) => str(x, LIMIT.line)).filter(Boolean);
    const years = list(s.years, YEAR_MAX).map((x) => Number(x)).filter((x) => Number.isInteger(x) && x >= 1 && x <= YEAR_MAX);
    const num = (v) => (v == null || v === '' ? null : fin(v));
    return {
      text,
      rules: rulesOf(b.rules),
      files: list(b.files, LIMIT.files).map(fileOf).filter(Boolean),
      history: list(b.history, LIMIT.history).map((h) => ({ role: h && h.role === 'assistant' ? 'assistant' : 'user', text: str(h && h.text, LIMIT.turn) })).filter((h) => h.text),
      snapshot: {
        prjNo: str(s.prjNo, 40), alias: str(s.alias, 40), prjNm: str(s.prjNm, 120), year: Number.isInteger(Number(s.year)) && Number(s.year) >= 1 ? Number(s.year) : 1,
        from: ymOf(s.from), to: ymOf(s.to), months: Number(s.months) || 0, today: dateOf(s.today) || '', lock: ymOf(s.lock),
        budgetPay: num(s.budgetPay), total: num(s.total), diff: str(s.diff, 60), basis: str(s.basis, 10),
        names: names(s.names), people: lines(s.people), support: str(s.support, LIMIT.line), supportNames: names(s.supportNames),
        erp: { at: str(erp.at, 40), lines: lines(erp.lines), missing: lines(erp.missing) }, warnings: lines(s.warnings), collect: lines(s.collect),
        defaultRange: { from: dateOf(dr.from), to: dateOf(dr.to) }, years, hasPlan: !!s.hasPlan, erpState: str(s.erpState, 200),
      },
    };
  }

  /* 첨부 파일 절(요청 글에 넣는 줄들 — 없으면 빈 배열). use = 파일을 무엇의 근거로 쓰는지 한 구절. 연구수당 도우미(lib/allow-chat-core.js)도 같이 쓴다 */
  function filesLines(files, use) {
    files = files || [];
    if (!files.length) return [];
    const lines = ['', `첨부 파일 ${files.length}개 (사용자가 요청과 함께 보낸 것 — ${use}, 요청이 파일 내용을 가리키면 거기서 값을 읽어 ops 에 넣는다. 파일에 없는 값은 지어내지 않는다):`];
    let used = 0;
    for (const f of files) {
      const head = `- ${f.name}${f.kind ? ` (${KIND_LABEL[f.kind] || f.kind})` : ''}`;
      if (f.text) { const t = f.text.slice(0, Math.max(0, LIMIT.filesText - used)); used += t.length; lines.push(`${head}${f.truncated || t.length < f.text.length ? ' — 앞부분만' : ''}:`, t, ''); }
      else if (f.path) lines.push(`${head} — 이 PC 의 파일 ${f.path} 을 Read 도구로 읽어 내용(이미지는 글자를 읽어 — OCR)을 참고한다.`);
      else if (f.attached) lines.push(`${head} — 이 메시지에 함께 붙인 ${f.kind === 'image' ? '이미지(글자를 읽어 — OCR)' : '문서'}를 본다.`);
      else lines.push(`${head} — 읽지 못함${f.note ? `: ${f.note}` : ''}.`);
    }
    return lines;
  }
  /* 입력 → { text(사용자 메시지 — 계획 요약 · 작업 안내 · 이전 대화 · 요청), schema(--json-schema), system(--system-prompt — SYSTEM 뒤에 예산 규칙) } */
  function build(input) {
    const s = input.snapshot, h = input.history || [];
    const lines = ['[참여연구원 변경 — 채팅 요청] 아래 계획을 보고 사용자의 요청을 작업(ops)으로 옮기세요.'];
    lines.push(`과제: ${s.alias ? `${s.alias} — ` : ''}${s.prjNm || ''} (${s.prjNo}) · ${s.year}차년도 · 계획 기간 ${s.from && s.to ? `${s.from} ~ ${s.to} (${s.months}개월)` : '미정 — period 로 먼저 정해야 함'}`);
    lines.push(`오늘: ${s.today || '(모름)'}${s.years.length ? ` · 있는 연차: ${s.years.join(', ')}차년도` : ''}`);
    if (s.lock) lines.push(`rERP 지급 완료: ${s.lock} 까지 — 그 달까지의 지급은 바꿀 수 없습니다(적용일은 ${addMonth(s.lock)}-01 이후로, 그 달에 지급이 있는 사람은 remove 대신 그 뒤 달부터 exclude).`);
    lines.push(`인건비 예산: ${s.budgetPay == null ? '없음 (budget 으로 정할 수 있음)' : `${fmt(s.budgetPay)}천원`}${s.hasPlan && s.total != null ? ` · 계획 합 ${fmt(s.total)}천원${s.diff ? ` · ${s.diff}` : ''}` : ''}`);
    if (s.hasPlan) { lines.push(`참여연구원 ${s.people.length}명 (금액은 천원, 참여율은 %):`); for (const l of s.people) lines.push(`- ${l}`); }
    else lines.push(`참여연구원 계획이 아직 없습니다 — init(erp: rERP 등록 지급계획 그대로 · prev: 이전 기간 비율로 예산을 나눔${s.year > 1 ? ` · carry: ${s.year - 1}차년도의 연구원·월급여·참여율을 이 기간 전체에` : ''})으로 세우거나 add 로 더합니다.`);
    lines.push(`행정지원: ${s.support || '없음'}`);
    lines.push(`rERP 참여인력: ${s.erpState || (s.erp.lines.length || s.erp.missing.length ? `${s.erp.at || ''} 조회` : '이 기간 등록 없음')}`);
    for (const l of s.erp.lines) lines.push(`- ${l}`);
    if (s.erp.missing.length) { lines.push('rERP 에 등록됐지만 계획에 없는 사람(add 후보 — 월급여는 rERP 값을 쓰면 됨):'); for (const l of s.erp.missing) lines.push(`- ${l}`); }
    if (s.warnings.length) { lines.push('알림:'); for (const w of s.warnings) lines.push(`- ${w}`); }
    if (s.collect && s.collect.length) { lines.push('자료 요청 응답(참여연구원이 SharePoint 양식에 적은 것 — 미반영 줄은 사용자가 말하면 change·add 로 옮길 수 있음):'); for (const l of s.collect) lines.push(`- ${l}`); }
    lines.push(...filesLines(input.files, '참여연구원·참여율·월급여·기간·금액의 근거로 쓰고'));
    if (s.defaultRange.from) lines.push(`직전 변경의 날짜(사용자가 날짜 없이 "같은 기간"이라 하면): ${s.defaultRange.from} ~ ${s.defaultRange.to || '기간 끝'}`);
    lines.push('', OPS_GUIDE);
    if (h.length) { lines.push('', '이전 대화:'); for (const t of h) lines.push(`${t.role === 'user' ? '사용자' : '도우미'}: ${t.text}`); }
    lines.push('', `요청: ${input.text}`);
    const names = s.names.concat(s.supportNames.filter((n) => !s.names.includes(n)));
    const op = { type: 'object', additionalProperties: false,
      required: ['op', 'name', 'newName', 'role', 'from', 'to', 'mode', 'value', 'monthly', 'how', 'year', 'supportRole', 'ref'],
      properties: {
        op: { type: 'string', enum: OPS.slice() }, name: { type: 'string', enum: names.concat(['']) }, newName: { type: 'string' }, role: { type: 'string', enum: ROLES.concat(['']) },
        from: { type: 'string' }, to: { type: 'string' }, mode: { type: 'string', enum: MODES.concat(['']) }, value: { type: 'number' }, monthly: { type: 'number' },
        how: { type: 'string', enum: HOWS.concat(['']) }, year: { type: 'integer' }, supportRole: { type: 'string' }, ref: { type: 'boolean' },
      } };
    const schema = { type: 'object', additionalProperties: false, required: ['reply', 'ops'], properties: { reply: { type: 'string' }, ops: { type: 'array', items: op } } };
    const system = input.rules ? `${SYSTEM}\n\n${RULES_HEAD}\n${input.rules}` : SYSTEM;
    return { text: lines.join('\n'), schema, system };
  }

  /* 목록의 이름 가운데 같은 이름(띄어쓰기 무시) — 없으면 '' */
  const pick = (names, n) => { const k = nameKeyOf(n); return k ? names.find((x) => nameKeyOf(x) === k) || '' : ''; };
  /* 작업 하나 검사 — 통과하면 그 작업에 필요한 칸만 남긴 객체, 아니면 null */
  function checkOp(raw, names, supportNames) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const op = str(r.op, 20);
    const name = pick(names, str(r.name, LIMIT.name)), sup = pick(supportNames, str(r.name, LIMIT.name)), newName = str(r.newName, LIMIT.name);
    const from = dateOf(r.from), to = dateOf(r.to);
    const value = fin(r.value), monthly = fin(r.monthly);
    const mode = MODES.includes(r.mode) ? r.mode : '';
    const role = ROLES.includes(r.role) ? r.role : '';
    const badDate = (r.from && !from) || (r.to && !to);   // 적었는데 못 읽는 날짜는 버린다(엉뚱한 기간에 반영하지 않게)
    switch (op) {
      case 'change': { const m = mode || 'rate'; if (!name || badDate || (!NOVALUE.has(m) && !(value >= 0))) return null; return { op, name, from, to, mode: m, value: NOVALUE.has(m) ? 0 : value }; }
      case 'total': if (!name || badDate || !(value >= 0)) return null; return { op, name, from, to, value };
      case 'monthly': if (!name || !(value >= 0)) return null; return { op, name, value };
      case 'role': if (!name || !role) return null; return { op, name, role };
      case 'remove': if (!name) return null; return { op, name };
      case 'add': { const m = mode && mode !== 'fit' ? mode : 'rate'; if (!newName || badDate) return null; return { op, newName, role: role || '참여연구원', monthly: monthly > 0 ? monthly : 0, from, to, mode: m, value: NOVALUE.has(m) ? 0 : (value >= 0 ? value : 0), supportRole: str(r.supportRole, 40), ref: r.ref !== false }; }
      case 'init': return { op, how: HOWS.includes(r.how) ? r.how : 'erp' };
      case 'clear': return { op };
      case 'year': { const y = Number(r.year); return Number.isInteger(y) && y >= 1 && y <= YEAR_MAX ? { op, year: y } : null; }
      case 'period': { const f = ymOf(r.from), t = ymOf(r.to); return f || t ? { op, from: f, to: t } : null; }
      case 'budget': return value >= 0 ? { op, value } : null;
      case 'support_add': return newName ? { op, newName, supportRole: str(r.supportRole, 40), ref: r.ref !== false } : null;
      case 'support_remove': return sup ? { op, name: sup } : null;
      default: return null;
    }
  }
  /* Claude 의 구조화 출력 → { reply, ops, dropped } */
  function parse(input, out) {
    const o = out && typeof out === 'object' ? out : {};
    const s = (input && input.snapshot) || { names: [], supportNames: [] };
    const ops = []; let dropped = 0;
    for (const raw of list(o.ops, LIMIT.ops)) { const op = checkOp(raw, s.names || [], s.supportNames || []); if (op) ops.push(op); else dropped++; }
    return { reply: str(o.reply, LIMIT.reply), ops, dropped };
  }

  /* 작업 한 줄 글(채팅의 반영 목록 · 이전 대화 요약) — "문창재 — 2026-11-01~ 참여율 25%" */
  function opText(op) {
    const o = op || {};
    const range = o.from ? `${o.from}~${o.to || ''}` : '전체';
    const how = { rate: `참여율 ${fmt(o.value)}%`, amt: `월 ${fmt(o.value)}천원`, exclude: '제외', short: `나머지의 ${fmt(o.value)}%`, fit: '예산에 맞추기' }[o.mode] || '';
    switch (o.op) {
      case 'change': return `${o.name} — ${range} ${how}`;
      case 'total': return `${o.name} — ${range} 지급 합 ${fmt(o.value)}천원`;
      case 'monthly': return `${o.name} — 월급여 ${o.value > 0 ? `${fmt(o.value)}천원` : 'rERP 값으로'}`;
      case 'role': return `${o.name} — 역할 ${o.role}`;
      case 'remove': return `${o.name} 빼기`;
      case 'add': return o.role === '행정지원' ? `행정지원 ${o.newName} 더하기${o.supportRole ? ` (${o.supportRole})` : ''}` : `${o.newName} 더하기 (${o.role}${o.monthly > 0 ? ` · 월급여 ${fmt(o.monthly)}천원` : ''} · ${range} ${how})`;
      case 'init': return `초기화 — ${({ prev: '이전 기간 비율로', carry: '이전 차년도에서 가져오기' })[o.how] || 'rERP 현재로'}`;
      case 'clear': return '이 연차 계획 지우기';
      case 'year': return `${o.year}차년도로`;
      case 'period': return `기간 ${o.from || '…'} ~ ${o.to || '…'}`;
      case 'budget': return `인건비 예산 ${fmt(o.value)}천원`;
      case 'support_add': return `행정지원 ${o.newName} 더하기${o.supportRole ? ` (${o.supportRole})` : ''}`;
      case 'support_remove': return `행정지원 ${o.name} 빼기`;
      default: return String(o.op || '');
    }
  }

  const api = { clean, build, parse, checkOp, opText, dateOf, ymOf, rulesOf, fileOf, filesLines, str, multi, list, fin, fmt, nameKeyOf, SYSTEM, OPS_GUIDE, DEFAULT_RULES, LIMIT, OPS, MODES, ROLES, HOWS, KINDS, KIND_LABEL };
  if (typeof module === 'object' && module.exports) module.exports = api;   // Help 서버 (Node)
  else g.KRX_STAFF_CHAT_CORE = api;                                        // 확장 (popup.html script · 테스트)
})(typeof self !== 'undefined' ? self : globalThis);
