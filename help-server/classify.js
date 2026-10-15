/* 청구 준비 자동 분류 — Help 서버의 POST /classify (0.8.5). 확장 백그라운드(lib/prep-ai.js)가 카드 거래 하나의 정보·청구내역(적요)·첨부 파일(이미지·PDF 는 내용째)을 보내면
 * Claude Code CLI 를 짧게 한 번 돌려(claude -p, 기본 claude-haiku-5-5, 도구 없음, --json-schema 의 enum 으로 후보 밖 값을 막음) 청구종류와 파일마다 첨부 종류를 고르고,
 * 청구내역(적요) 한 줄을 쓴다 — 품목은 첨부 파일 내용(인보이스·거래명세서)에서, 용도는 그 과제 연구개발계획서의 개발내용·목표에서.
 * 코드를 고치는 Help Chat(/ask)과 달리 이 저장소가 아닌 임시 폴더에서 --safe-mode 로 돈다: CLAUDE.md·훅(이 저장소의 Stop 훅 = 확장 다시 올리기)·MCP·세션 기록 없이. 입력은 stream-json(image · document 블록).
 * 입력: { tx: { shop, amount, usedDate, project }, ptcl, type(지금 청구종류), wantType, wantPtcl, ptclGuide(설정의 청구내역 작성 안내), picks: [{ label, hint }], kinds: [이름],
 *        files: [{ id, name, kind, classify, ref?(청구내역을 쓸 때 참고할, 종류가 이미 정해진 파일), b64?, media? }], history: [{ shop, ptcl, type }],
 *        research?: { year, goals[], contents[], spend[{ name, kind, method, amount }] } (그 과제의 연구개발계획서 — lib/research.js refOf. 청구종류를 고르거나 청구내역을 쓸 때만 짧게 붙인다. 개발내용은 청구내역을 쓸 때만) }
 * 결과: { type: { value, reason } | null, ptcl: { value, reason } | null, files: [{ id, kind, reason }] } — value/kind 가 '' 면 근거 부족(고르지·쓰지 않음). 서버(server.js)는 clean → run 만 부른다 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const LIMIT = { picks: 40, kinds: 20, files: 8, refs: 2, history: 30, text: 300, b64: 8 * 1024 * 1024, goals: 3, contents: 8, spend: 12, ptcl: 150, guide: 300 };
const MEDIA = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']);
const WORK_DIR = path.join(os.tmpdir(), 'krx-help-classify');   // 분류용 claude 의 작업 폴더 (이 저장소의 CLAUDE.md·.claude 설정을 읽지 않게)
const SYSTEM = [
  '너는 한국 국가 R&D 과제 연구비 카드 사용 건의 청구 준비를 돕는 분류기다. 사용자는 연구원이며, 카드 거래마다 R&D ERP 의 청구종류를 고르고 증빙 첨부 파일에 종류 이름을 붙인다.',
  '- 반드시 주어진 후보 중에서만 고른다. 사용자가 언제든 바꿀 수 있으니 정보가 가맹점 이름뿐이어도 가장 그럴듯한 후보를 고르고, 확신이 낮으면 reason 에 그렇다고 적는다.',
  '- 청구종류: 가맹점 이름으로 업종을 추정하고(소프트웨어·클라우드 회사, 온라인 강의 플랫폼, 식당·카페 등) 금액·사용일시·청구내역(적요)·첨부 파일 내용·사용자가 전에 고른 예를 함께 본다.',
  '  적요와 첨부 내용이 가맹점 추정보다 우선하고, 같은 가맹점에 대해 사용자가 전에 고른 값은 강한 근거다. 후보 어느 것과도 관련이 없다고 볼 때만 빈 문자열 "" 을 고른다.',
  '  "회의록 필요"라고 표시된 후보는 식당·카페·다과 거래이거나 적요가 회의를 말할 때 고른다.',
  '- 첨부 종류: 이미지·PDF 의 내용(제목·표·문구)을 우선하고 파일 이름은 보조로 본다. 내용이 후보 어느 것에도 해당하지 않으면(관련 없는 화면 등) "" 을 고른다.',
  '- 과제 연구개발계획서(연구활동비 계획)가 주어지면 거래가 계획한 지출 항목 중 무엇에 해당하는지를 보조 근거로 본다.',
  '- 청구내역(적요): 연구비 집행 증빙으로 남는 한 줄이다. 무엇을 샀는지(품목·서비스·강의 이름, 알면 사용 기간·수량)와 어느 연구에 쓰는지(연구개발계획서의 개발내용·목표에서)를 사실대로 짧게 쓴다.',
  '  첨부 파일 내용이 가맹점 이름보다 우선하고, 파일·입력에 없는 수량·기간·금액·제품명은 지어내지 않는다.',
  '- reason 은 한국어 한 문장, 50자 이내로 근거만 적는다.',
].join('\n');

const str = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n || LIMIT.text);
const list = (v, n) => (Array.isArray(v) ? v : []).slice(0, n);

/* 요청 본문 → 검사·정리한 입력 (잘못되면 throw) */
function clean(body) {
  const b = body && typeof body === 'object' ? body : {};
  const tx = b.tx && typeof b.tx === 'object' ? b.tx : {};
  const picks = list(b.picks, LIMIT.picks).map((p) => ({ label: str(p && p.label, 60), hint: str(p && p.hint, 120) })).filter((p) => p.label);
  const kinds = Array.from(new Set(list(b.kinds, LIMIT.kinds).map((k) => str(k, 40)).filter(Boolean)));
  const wantPtcl = !!b.wantPtcl;
  const files = list(b.files, 30).map((f, i) => {
    const o = { id: str(f && f.id, 40) || `f${i + 1}`, name: str(f && f.name, 120), kind: str(f && f.kind, 40), classify: !!(f && f.classify), ref: wantPtcl && !!(f && f.ref) };
    const b64 = typeof (f && f.b64) === 'string' ? f.b64 : '';
    if ((o.classify || o.ref) && b64 && b64.length <= LIMIT.b64 && MEDIA.has(String(f.media || ''))) { o.b64 = b64; o.media = String(f.media); }
    return o;
  });
  const todo = kinds.length ? files.filter((f) => f.classify).slice(0, LIMIT.files) : [];
  const refs = wantPtcl ? files.filter((f) => f.ref && f.b64 && !todo.includes(f)).slice(0, LIMIT.refs) : [];   // 청구내역을 쓸 때만 내용을 보는 파일 (종류는 이미 정해짐)
  const wantType = !!b.wantType && picks.length > 0;
  if (!wantType && !wantPtcl && !todo.length) return { wantType: false, wantPtcl: false, todo: [] };
  return {
    tx: { shop: str(tx.shop, 80), amount: Number(tx.amount) || 0, usedDate: str(tx.usedDate, 30), project: str(tx.project, 120) },
    ptcl: wantPtcl ? '' : str(b.ptcl, 500), type: str(b.type, 60), wantType, wantPtcl, ptclGuide: wantPtcl ? str(b.ptclGuide, LIMIT.guide) : '', picks, kinds, files, todo, refs,
    history: list(b.history, LIMIT.history).map((h) => ({ shop: str(h && h.shop, 80), ptcl: str(h && h.ptcl, 100), type: str(h && h.type, 60) })).filter((h) => h.shop && h.type),
    research: wantType || wantPtcl ? cleanResearch(b.research, wantPtcl) : null,
  };
}
/* 과제 연구개발계획서(참고) — 빠른 모델에 짧게: 목표 LIMIT.goals 개 · 연구활동비 세부사용계획 이름(구분·방식) LIMIT.spend 개 · 청구내역을 쓸 때는 개발내용 항목 LIMIT.contents 개. 없으면 null */
function cleanResearch(v, withContents) {
  const r = v && typeof v === 'object' ? v : null;
  if (!r) return null;
  const goals = list(r.goals, LIMIT.goals).map((x) => str(x, 80)).filter(Boolean);
  const spend = list(r.spend, LIMIT.spend).map((s) => {
    const how = [str(s && s.kind, 20), str(s && s.method, 10)].filter(Boolean).join('·');
    return str(`${str(s && s.name, 50)}${how ? `(${how})` : ''}`, 70);
  }).filter(Boolean);
  const contents = withContents ? list(r.contents, LIMIT.contents).map((x) => str(x, 80)).filter(Boolean) : [];
  return goals.length || spend.length || contents.length ? { year: str(r.year, 20), goals, contents, spend } : null;
}

/* 입력 → { content(사용자 메시지 블록), schema(--json-schema) } */
function build(input) {
  const { tx, picks, kinds, files, todo, history } = input;
  const refs = input.refs || [];
  const won = (n) => `${Math.round(n).toLocaleString('en-US')}원`;
  const lines = ['카드 거래 하나의 청구 준비입니다.',
    `- 가맹점: ${tx.shop || '(모름)'}`, `- 금액: ${won(tx.amount)}`, `- 사용일시: ${tx.usedDate || '(모름)'}`];
  if (tx.project) lines.push(`- 과제: ${tx.project}`);
  if (!input.wantPtcl) lines.push(`- 청구내역(적요): ${input.ptcl || '(아직 안 적음)'}`);
  if (!input.wantType && input.type) lines.push(`- 청구종류: ${input.type} (사용자가 정함)`);
  const others = files.filter((f) => !todo.includes(f));
  if (others.length) lines.push(`- 이미 있는 첨부 파일: ${others.map((f) => `"${f.name}"${f.kind ? `(${f.kind})` : ''}`).join(', ')}`);
  if (input.wantType) {
    lines.push('', '[할 일] type: 청구종류를 아래 후보 중 하나로 고르세요 (근거가 부족하면 "").');
    for (const p of picks) lines.push(`- ${p.label}${p.hint ? ` — ${p.hint}` : ''}`);
    if (history.length) {
      lines.push('', '사용자가 전에 고른 예:');
      for (const h of history) lines.push(`- 가맹점 "${h.shop}"${h.ptcl ? ` · 적요 "${h.ptcl}"` : ''} → ${h.type}`);
    }
  }
  if (input.wantPtcl) {
    lines.push('', `[할 일] ptcl: R&D ERP 청구서의 청구내역(적요) 한 줄을 쓰세요${input.wantType ? ' — 고른 청구종류에 맞게' : ''} (근거가 부족하면 "").`,
      '- 무엇을(품목·서비스·강의 이름, 알면 사용 기간·수량) 어느 연구에 쓰려고 샀는지 한 줄. 40~80자, 100자를 넘기지 않는다. 마침표·따옴표·줄바꿈 없이 명사형으로 끝낸다.',
      '- 품목은 첨부 파일 내용(인보이스·거래명세서의 품명·청구 기간)을 먼저 보고, 없으면 가맹점 이름·청구종류로 쓴다. 파일에 없는 수량·기간·금액은 쓰지 않는다.',
      '- 용도는 아래 과제 연구개발계획서의 개발내용·목표 중 이 거래와 가장 관련 있는 것을 짧게 줄여 쓴다(계획서 문장을 길게 옮기지 않음). 계획서는 이 연구원의 기관이 과제에서 맡은 부분이라 과제명과 결이 달라 보여도 계획서 쪽을 쓴다. 계획서가 없을 때만 과제명으로.',
      '- 예: "Azure 클라우드 사용료(2026년 9월분) - 차단기 제어 알고리즘 시뮬레이션용" · "LLM 평가 하네스 온라인 강의 수강 - 고장 진단 AI 모델 검증"');
    if (input.ptclGuide) lines.push(`- 사용자의 작성 안내(위 규칙보다 우선): ${input.ptclGuide}`);
    const ex = history.filter((h) => h.ptcl).slice(0, 8);
    if (ex.length) {
      lines.push('', '사용자가 전에 쓴 청구내역 예(형식·말투를 따른다):');
      for (const h of ex) lines.push(`- 가맹점 "${h.shop}" · ${h.type} → "${h.ptcl}"`);
    }
  }
  const rs = (input.wantType || input.wantPtcl) && input.research;
  if (rs) {
    lines.push('', `과제 연구개발계획서(${rs.year || '올해'} — 이 연구원의 기관이 맡은 부분, 참고):`);
    if (rs.goals.length) lines.push(`- 목표: ${rs.goals.join(' / ')}`);
    if ((rs.contents || []).length) lines.push(`- 개발내용: ${rs.contents.join(' / ')}`);
    if (rs.spend.length) lines.push(`- 연구활동비 계획: ${rs.spend.join(', ')}`);
  }
  if (todo.length) {
    lines.push('', `[할 일] files: 아래 첨부 파일마다 종류를 후보 중 하나로 고르세요 (근거가 부족하면 ""). 후보: ${kinds.join(' | ')}`);
    lines.push(`파일 ${todo.length}개 — 각 파일의 id·이름 바로 뒤에 내용이 옵니다(내용이 없으면 이름으로만 판단).`);
  }
  const content = [{ type: 'text', text: lines.join('\n') }];
  for (const f of todo) {
    content.push({ type: 'text', text: `파일 id=${f.id} 이름="${f.name}"${f.b64 ? '' : ' (내용 없음)'}` });
    if (f.b64) content.push(f.media === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: f.media, data: f.b64 } }
      : { type: 'image', source: { type: 'base64', media_type: f.media, data: f.b64 } });
  }
  if (refs.length) content.push({ type: 'text', text: `참고 파일 ${refs.length}개 — 종류는 이미 정해져 있고 청구내역을 쓸 때만 봅니다.` });
  for (const f of refs) {
    content.push({ type: 'text', text: `참고 파일 "${f.name}"${f.kind ? `(${f.kind})` : ''}` });
    content.push(f.media === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: f.media, data: f.b64 } }
      : { type: 'image', source: { type: 'base64', media_type: f.media, data: f.b64 } });
  }
  const schema = { type: 'object', additionalProperties: false, properties: {}, required: [] };
  if (input.wantType) {
    schema.properties.type = { type: 'object', additionalProperties: false, required: ['value', 'reason'],
      properties: { value: { type: 'string', enum: picks.map((p) => p.label).concat(['']) }, reason: { type: 'string' } } };
    schema.required.push('type');
  }
  if (input.wantPtcl) {
    schema.properties.ptcl = { type: 'object', additionalProperties: false, required: ['value', 'reason'], properties: { value: { type: 'string' }, reason: { type: 'string' } } };
    schema.required.push('ptcl');
  }
  if (todo.length) {
    schema.properties.files = { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'kind', 'reason'],
      properties: { id: { type: 'string', enum: todo.map((f) => f.id) }, kind: { type: 'string', enum: kinds.concat(['']) }, reason: { type: 'string' } } } };
    schema.required.push('files');
  }
  return { content, schema };
}

/* Claude 의 구조화 출력 → 결과 (후보 밖 값·모르는 id 는 버림) */
function parse(input, out) {
  const o = out && typeof out === 'object' ? out : {};
  const labels = new Set(input.picks.map((p) => p.label)), kinds = new Set(input.kinds), ids = new Set(input.todo.map((f) => f.id));
  let type = null;
  if (input.wantType) {
    const v = str(o.type && o.type.value, 60);
    type = { value: labels.has(v) ? v : '', reason: str(o.type && o.type.reason, 200) };
  }
  let ptcl = null;
  if (input.wantPtcl) {   // 한 줄로, 앞뒤 따옴표·마침표 없이
    const v = String((o.ptcl && o.ptcl.value) || '').replace(/\s+/g, ' ').trim().replace(/^["'“”‘’]+|["'“”‘’.]+$/g, '').trim();
    ptcl = { value: v.slice(0, LIMIT.ptcl), reason: str(o.ptcl && o.ptcl.reason, 200) };
  }
  const seen = new Set();
  const files = list(o.files, 50).map((f) => ({ id: str(f && f.id, 40), kind: str(f && f.kind, 40), reason: str(f && f.reason, 200) }))
    .filter((f) => ids.has(f.id) && !seen.has(f.id) && seen.add(f.id))
    .map((f) => Object.assign(f, { kind: kinds.has(f.kind) ? f.kind : '' }));
  return { type, ptcl, files };
}

/* claude -p 한 번. opts: { bins: [실행 파일 후보], model, fallback, env, timeoutMs, kill(child) } → Promise<결과> */
function run(input, opts) {
  const { content, schema } = build(input);
  const args = ['-p', '--model', opts.model, '--safe-mode', '--tools', '', '--no-session-persistence', '--strict-mcp-config', '--effort', 'low',
    '--system-prompt', SYSTEM, '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--json-schema', JSON.stringify(schema)];
  if (opts.fallback && opts.fallback !== opts.model) args.push('--fallback-model', opts.fallback);
  const msg = JSON.stringify({ type: 'user', message: { role: 'user', content } }) + '\n';
  try { fs.mkdirSync(WORK_DIR, { recursive: true }); } catch (e) {}
  return new Promise((resolve, reject) => {
    const attempt = (bins) => {
      const child = spawn(bins[0], args, { cwd: WORK_DIR, env: opts.env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
      let buf = '', errTail = '', result = null, done = false;
      const end = (err, val) => { if (done) return; done = true; clearTimeout(timer); if (err) reject(err); else resolve(val); };
      const timer = setTimeout(() => { if (opts.kill) opts.kill(child); else child.kill(); end(new Error(`시간 초과 (${Math.round(opts.timeoutMs / 1000)}초)`)); }, opts.timeoutMs);
      const onLine = (line) => { try { const ev = JSON.parse(line); if (ev && ev.type === 'result') result = ev; } catch (e) {} };
      child.on('error', (e) => {
        if (e && e.code === 'ENOENT' && bins.length > 1) { done = true; clearTimeout(timer); return attempt(bins.slice(1)); }
        end(new Error(e && e.code === 'ENOENT' ? 'claude CLI 를 찾지 못했습니다 (PATH 또는 KRX_HELP_CLAUDE 확인)' : String((e && e.message) || e)));
      });
      child.stdin.on('error', () => {});
      child.stdin.end(msg, 'utf8');
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (d) => { buf += d; let nl; while ((nl = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1); if (l) onLine(l); } });
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (d) => { errTail = (errTail + d).slice(-2000); });
      child.on('close', (code) => {
        if (buf.trim()) onLine(buf.trim());
        if (!result) return end(new Error(str(errTail.split(/\r?\n/).filter((l) => l && !/unrecognized_model/.test(l)).pop() || `Claude 가 결과 없이 끝났습니다 (exit ${code})`, 300)));
        if (result.is_error) return end(new Error(str(result.result || result.subtype || '분류 실패', 300)));
        let out = result.structured_output;
        if (!out) { try { out = JSON.parse(String(result.result || '').replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch (e) { out = null; } }
        if (!out) return end(new Error('Claude 의 답을 읽지 못했습니다'));
        end(null, Object.assign(parse(input, out), { cost: result.total_cost_usd, apiMs: result.duration_api_ms }));
      });
    };
    attempt(opts.bins);
  });
}

module.exports = { clean, build, parse, run, SYSTEM, LIMIT };
