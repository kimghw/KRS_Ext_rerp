/* site-fetch — 증빙 찾아오기 (0.8.5). 다른 웹 사이트에 가서 카드 거래의 증빙 서류를 가져오는 부분만 따로 모은 모듈(이 폴더). 확장 코드·Help Chat 과 섞지 않는다.
 * 확장 백그라운드(lib/prep-fetch.js)가 "자주 사용" 으로 등록한 가맹점 사이트(주소·종류·가져올 서류·로그인 정보)와 거래를 Help 서버의 POST /fetch 로 보내면(server.js 는 route() 만 이어 붙임),
 * 작업용 Chrome(chrome.js)을 CDP 로 열어 두고 Claude Code CLI 를 헤드리스로 돌려(claude -p) 그 사이트에 로그인해 이 거래의 거래명세서(강의면 수강증·강의내용도)를 찾아 PDF·이미지로 저장하게 한다.
 * 단독 실행(확장·서버 없이 시험): node site-fetch/run.js <요청.json>
 *  - Claude: 임시 작업 폴더(%TEMP%\krx-help-fetch\<id>)에서 --safe-mode --restricted(파일 도구는 그 폴더 안만) · 도구는 Bash/PowerShell(node cdp.mjs … 만 허용)·Read(화면 사진 view.jpg) ·
 *    --permission-mode dontAsk(허용 목록 밖은 묻지 않고 거절) · 세션 기록 없음. 브라우저 손잡이는 cdp.mjs 를 그 폴더에 복사한 것. 규칙·사이트 안내는 prompt.js · sites/*.md
 *  - 비밀번호: 작업 폴더 밖의 파일(KRX_FETCH_SECRET)로만 손잡이에 넘기고 작업이 끝나면 지운다. 손잡이가 출력에서 가리고 인자로도 받지 않아 Claude 에는 보이지 않는다.
 *  - 결과: 손잡이가 out/ 에 저장하고 out/files.json 에 적은 서류 중 Claude 의 구조화 출력(files)이 고른 것 → 확장이 GET /fetch/file 로 받아 청구 준비 첨부 파일로 넣는다.
 * 한 번에 하나만 돈다(작업용 Chrome 창 하나). 가맹점이 브라우저를 골랐으면(요청의 site.browser — 바탕화면 Chrome 바로가기 이름·디버그 포트·주소) 작업용 창 대신 그 Chrome 에 붙는다(chrome.js ensureBrowser(spec)).
 * 환경 변수: KRX_FETCH_MODEL(Help 서버의 KRX_HELP_MODEL) · KRX_FETCH_TIMEOUT_MIN(15) · KRX_FETCH_BUDGET_USD(0 = 제한 없음) · KRX_FETCH_CHROME · KRX_FETCH_PROFILE · KRX_FETCH_CDP · KRX_FETCH_HEADLESS (chrome.js) */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn, execFile } = require('child_process');
const chrome = require('./chrome');
const P = require('./prompt');

const JOB_ROOT = path.join(os.tmpdir(), 'krx-help-fetch');
const HELPER = path.join(__dirname, 'cdp.mjs');
const SKILL_REL = '.claude/skills/fetch-site/SKILL.md';   // 사이트 붙이기 절차(fetch-site 스킬) — 설정 페이지의 [스킬 복사]가 GET /fetch/skill 로 받아 감
const SKILL = path.join(__dirname, '..', ...SKILL_REL.split('/'));
const TIMEOUT_MS = (Number(process.env.KRX_FETCH_TIMEOUT_MIN) || 15) * 60000;
const BUDGET = Number(process.env.KRX_FETCH_BUDGET_USD) || 0;   // 한 번에 쓸 최대 금액(달러, 0 이면 제한 없음) — claude --max-budget-usd
const KEEP_MS = 6 * 3600000;   // 끝난 작업 폴더(받은 서류)를 지우기까지
const MAX_LINES = 600, KEEP_JOBS = 20;
const oneLine = (s, n) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

/* 손잡이는 Node 22+ 의 내장 WebSocket 을 쓴다 → 못 쓰면 이유 글, 쓸 수 있으면 '' */
function available() { return typeof WebSocket === 'function' ? '' : `Node ${process.versions.node} — 증빙 찾아오기에는 Node 22 이상이 필요합니다`; }

/* ---------- 작업 ---------- */
const jobs = new Map();
let running = null;   // { job, child, timer, opts }
function log(job, k, s) { if (job.lines.length < MAX_LINES) job.lines.push({ t: Date.now(), k, s: oneLine(s, 240) }); if (job.onLine) job.onLine(k, s); }
function cleanupOld() {
  try {
    for (const f of fs.readdirSync(JOB_ROOT)) {
      const p = path.join(JOB_ROOT, f);
      if (running && running.job.dir === p) continue;
      let st; try { st = fs.statSync(p); } catch (e) { continue; }
      const age = Date.now() - st.mtimeMs;
      if (f.endsWith('.secret.json') ? age > 3600000 : age > KEEP_MS) { try { fs.rmSync(p, { recursive: true, force: true }); } catch (e) {} }
    }
  } catch (e) {}
}
cleanupOld();
function runHelper(job, args, env, ms) {
  return new Promise((resolve) => {
    execFile(process.execPath, [path.join(job.dir, 'cdp.mjs')].concat(args), { cwd: job.dir, env, timeout: ms || 60000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, out) => resolve({ ok: !err, out: String(out || '').trim() }));
  });
}
const busy = () => (running ? running.job.id : '');

/* 도구 사용 → 한 줄 로그 ("브라우저 click 12"). Read 는 화면 보기 */
function toolLine(name, input) {
  const i = input || {};
  if (/^(Bash|PowerShell)$/.test(name)) { const m = /node\s+(?:\.[\\/])?cdp\.mjs\s*([\s\S]*)$/.exec(String(i.command || '')); return m ? `브라우저 ${oneLine(m[1], 140)}` : `${name} ${oneLine(i.command, 120)}`; }
  if (name === 'Read') return '화면 사진 보기';
  if (name === 'StructuredOutput') return '결과 정리';
  return name;
}
function onEvent(job, ev, tools) {
  if (!ev || typeof ev !== 'object') return;
  if (ev.type === 'system' && ev.subtype === 'init') log(job, 'info', `Claude 시작 (${ev.model || job.model})`);
  else if (ev.type === 'assistant') {
    for (const b of (ev.message && ev.message.content) || []) {
      if (b.type === 'text' && String(b.text || '').trim()) { job.say = oneLine(String(b.text).trim().split(/\r?\n/)[0], 160); log(job, 'say', job.say); }
      else if (b.type === 'tool_use') { tools.set(b.id, b.name); log(job, 'tool', toolLine(b.name, b.input)); }
    }
  } else if (ev.type === 'user') {
    const c = ev.message && ev.message.content;
    for (const b of Array.isArray(c) ? c : []) {
      if (b.type !== 'tool_result') continue;
      const text = typeof b.content === 'string' ? b.content : (Array.isArray(b.content) ? b.content.filter((x) => x && x.type === 'text').map((x) => x.text).join('\n') : '');
      const first = String(text || '').split(/\r?\n/).find((l) => l.trim()) || '';
      if (b.is_error) log(job, 'warn', first || '도구 오류');
      else if (/^(Bash|PowerShell)$/.test(tools.get(b.tool_use_id) || '') && /^(저장|→|열림|\(새 탭|\(다른|나옴|오류|뺐습니다|창|"|아이디|비밀번호)/.test(first)) log(job, 'info', first);
    }
  } else if (ev.type === 'result') job.result = ev;
}

function view(job, since) {
  const { lines, result, dir, input, env, secret, onLine, ...rest } = job;
  const from = Math.max(0, Number(since) || 0);
  return { ok: true, job: Object.assign(rest, { elapsedMs: (job.endedAt || Date.now()) - job.startedAt }), lines: lines.slice(from), next: lines.length };
}
function find(id) { return jobs.get(String(id || '')) || null; }
/* 받은 서류 하나: 작업의 files 에 있는 이름만 */
function file(id, name) {
  const job = find(id);
  if (!job || !Array.isArray(job.files)) return null;
  const f = job.files.find((x) => x.name === String(name || ''));
  if (!f) return null;
  try { return { buf: fs.readFileSync(path.join(job.dir, 'out', f.name)), mime: f.mime, path: path.join(job.dir, 'out', f.name) }; } catch (e) { return null; }
}

/* input = prompt.clean(요청), opts: { bins: [claude 실행 파일 후보], model, fallback, env, kill(child), onLine?(k, s), onDone?(job) } → job (곧바로 돌려주고 뒤에서 진행) */
function start(input, opts) {
  if (running) { const e = new Error('다른 찾아오기가 진행 중입니다'); e.kind = 'busy'; e.id = running.job.id; throw e; }
  cleanupOld();
  const id = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) + '-' + crypto.randomBytes(3).toString('hex');
  const dir = path.join(JOB_ROOT, id);
  const job = { id, state: 'running', label: input.site.label, docs: input.site.docs, startedAt: Date.now(), endedAt: 0, lines: [], say: '', summary: '', error: '', item: '', matched: '', howto: '', files: null, missing: [], cost: 0, model: opts.model, dir, input, onLine: opts.onLine };
  jobs.set(id, job);
  for (const k of Array.from(jobs.keys()).slice(0, -KEEP_JOBS)) jobs.delete(k);
  running = { job, child: null, opts, timer: setTimeout(() => cancel(id, `시간 초과 (${Math.round(TIMEOUT_MS / 60000)}분)`), TIMEOUT_MS) };
  log(job, 'info', `${input.site.label}: ${input.site.docs.join(' · ')} 찾기`);
  run(job, input, opts).catch((e) => finish(job, { state: 'error', error: oneLine((e && e.message) || e, 300) }));
  return job;
}
async function run(job, input, opts) {
  const browser = await chrome.ensureBrowser(input.site.browser);   // 가맹점이 고른 Chrome(바로가기 이름·포트·주소) → 없으면 local.json·환경 변수·기본 작업용 프로필
  if (job.state !== 'running') return;
  log(job, 'info', browser.external ? `브라우저 ${browser.label || browser.http} 에 연결${browser.launched ? ' (바로가기로 띄움)' : ''}${browser.fallback ? ` — ${browser.fallback}` : ''}` : browser.launched ? '작업용 Chrome 을 띄움' : '작업용 Chrome 에 연결');
  fs.mkdirSync(path.join(job.dir, 'out'), { recursive: true });
  fs.copyFileSync(HELPER, path.join(job.dir, 'cdp.mjs'));
  fs.writeFileSync(path.join(job.dir, 'state.json'), JSON.stringify({ cdp: browser.http, external: !!browser.external, hidden: !chrome.SHOW, site: input.site.url, tabs: [], cur: '' }));   // hidden: 작업 창을 화면 밖에서 (cdp.mjs newTarget · showWindow, KRX_FETCH_SHOW=1 이면 보이게)
  const env = Object.assign({}, opts.env);
  delete env.KRX_FETCH_SECRET;
  if (input.cred.id || input.cred.pw) {
    job.secret = path.join(JOB_ROOT, `${job.id}.secret.json`);   // 작업 폴더 밖 — Claude 의 파일 도구(--restricted)가 닿지 않는 곳
    fs.writeFileSync(job.secret, JSON.stringify({ id: input.cred.id, pw: input.cred.pw }), { mode: 0o600 });
    env.KRX_FETCH_SECRET = job.secret;
  }
  job.env = env;
  const o = await runHelper(job, ['open', input.site.url], env, 45000);   // 사이트를 먼저 열어 둠 (Claude 를 부르기 전에 브라우저 경로 확인)
  if (!o.ok) throw new Error(`사이트를 열지 못했습니다: ${oneLine(o.out.replace(/^오류:\s*/, ''), 200)}`);
  log(job, 'info', o.out.split(/\r?\n/)[0]);
  if (job.state !== 'running') return;
  const { prompt, schema } = P.build(input);
  const allow = ['node cdp.mjs', 'node ./cdp.mjs'].flatMap((c) => [`Bash(${c} *)`, `Bash(${c})`, `PowerShell(${c} *)`, `PowerShell(${c})`]).concat(['Read']);
  const deny = ['cat', 'type', 'more', 'less', 'head', 'tail', 'env', 'printenv', 'set', 'Get-Content', 'gc', 'Get-ChildItem', 'dir', 'ls', 'curl', 'wget', 'Invoke-WebRequest', 'iwr']   // 손잡이 말고는 못 쓰지만(dontAsk) 혹시 자동 허용되는 읽기 명령까지 막음
    .flatMap((c) => [`Bash(${c} *)`, `Bash(${c})`, `PowerShell(${c} *)`, `PowerShell(${c})`]);
  const args = ['-p', '--model', opts.model, '--safe-mode', '--restricted', '--tools', 'Bash,PowerShell,Read', '--allowedTools', ...allow, '--disallowedTools', ...deny,
    '--permission-mode', 'dontAsk', '--no-session-persistence', '--strict-mcp-config', '--system-prompt', P.SYSTEM,
    '--output-format', 'stream-json', '--verbose', '--json-schema', JSON.stringify(schema)];
  if (opts.fallback && opts.fallback !== opts.model) args.push('--fallback-model', opts.fallback);
  if (BUDGET > 0) args.push('--max-budget-usd', String(BUDGET));
  spawnClaude(job, input, args, prompt, env, opts.bins);
}
function spawnClaude(job, input, args, prompt, env, bins) {
  const child = spawn(bins[0], args, { cwd: job.dir, env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  if (running && running.job === job) running.child = child;
  const tools = new Map();
  let buf = '', errTail = '', failed = false;
  child.on('error', (e) => {
    failed = true;
    if (e && e.code === 'ENOENT' && bins.length > 1) return spawnClaude(job, input, args, prompt, env, bins.slice(1));
    finish(job, { state: 'error', error: e && e.code === 'ENOENT' ? 'claude CLI 를 찾지 못했습니다 (PATH 또는 KRX_HELP_CLAUDE 확인)' : String((e && e.message) || e) });
  });
  child.stdin.on('error', () => {});
  child.stdin.end(prompt, 'utf8');
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (d) => { buf += d; let nl; while ((nl = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1); if (l) { try { onEvent(job, JSON.parse(l), tools); } catch (e) {} } } });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (d) => { errTail = (errTail + d).slice(-2000); });
  child.on('close', (code) => {
    if (failed || job.state !== 'running') return;
    if (buf.trim()) { try { onEvent(job, JSON.parse(buf.trim()), tools); } catch (e) {} }
    const r = job.result;
    let manifest = [];
    try { manifest = JSON.parse(fs.readFileSync(path.join(job.dir, 'out', 'files.json'), 'utf8')); } catch (e) {}
    const out = r && !r.is_error ? (r.structured_output || (() => { try { return JSON.parse(String(r.result || '').replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch (e) { return null; } })()) : null;
    const res = P.parse(input, out, manifest);
    const cost = r ? Number(r.total_cost_usd) || 0 : 0;
    if (!r || (r.is_error && !res.files.length)) {
      const why = /budget/i.test(String(r && r.subtype)) ? `한 번에 쓸 금액(KRX_FETCH_BUDGET_USD $${BUDGET})을 넘어 멈췄습니다`
        : (r && (r.result || r.subtype)) || errTail.split(/\r?\n/).filter((l) => l && !/unrecognized_model/.test(l)).pop() || `Claude 가 결과 없이 끝났습니다 (exit ${code})`;
      return finish(job, Object.assign(res, { state: 'error', error: oneLine(why, 300), cost }));
    }
    finish(job, Object.assign(res, { state: res.files.length ? 'done' : 'empty', summary: res.summary || (res.files.length ? `${res.files.length}개 저장` : '찾지 못함'), cost }));
  });
}
async function finish(job, patch) {
  if (job.state !== 'running') return;
  const keepTabs = patch.state !== 'done';   // 실패·못 찾음이면 탭을 남겨 사용자가 이어서 보게(로그인·추가 인증을 직접 하면 다음에는 그 세션으로 감)
  Object.assign(job, patch, { endedAt: Date.now() });
  if (!Array.isArray(job.files)) job.files = [];
  const opts = running && running.job === job ? running.opts : null;
  if (running && running.job === job) { clearTimeout(running.timer); running = null; }
  if (job.secret) { try { fs.unlinkSync(job.secret); } catch (e) {} delete job.secret; }
  if (job.env && fs.existsSync(path.join(job.dir, 'cdp.mjs'))) { const env = Object.assign({}, job.env); delete env.KRX_FETCH_SECRET; await runHelper(job, keepTabs ? ['end', 'keep'] : ['end'], env, 15000); }
  delete job.env;
  if (job.state === 'done' || job.state === 'empty') log(job, job.state === 'done' ? 'ok' : 'warn', `${job.state === 'done' ? '완료' : '못 찾음'} — ${job.summary}${job.missing.length ? ` · 없음: ${job.missing.map((m) => `${m.kind}(${m.reason})`).join(', ')}` : ''}`);
  else log(job, 'err', `${job.state === 'canceled' ? '중지' : '실패'} — ${job.error}`);
  if (opts && opts.onDone) { try { opts.onDone(job); } catch (e) {} }
}
function cancel(id, why) {
  const job = find(id) || (running && running.job);
  if (!job || job.state !== 'running') return false;
  if (running && running.job === job && running.child) { if (running.opts && running.opts.kill) running.opts.kill(running.child); else { try { running.child.kill(); } catch (e) {} } }
  finish(job, { state: why ? 'error' : 'canceled', error: why || '사용자가 중지했습니다' });
  return true;
}

/* ---------- HTTP (Help 서버가 /fetch, /fetch/* 를 그대로 넘김) ----------
 * POST /fetch { site, cred, tx } → { id } · GET /fetch/job?id=&since= → 상태·새 로그 줄 · GET /fetch/file?id=&name= → 받은 서류 원본 · POST /fetch/cancel { id }
 * GET /fetch/guide?url= → 그 사이트의 안내 파일 원문(설정 페이지 [안내 복사]) · GET /fetch/skill → fetch-site 스킬 원문(설정 페이지 [스킬 복사])
 * ctx: { readBody(req), send(res, status, body), claude: { bins, model, fallback, env, kill } } — 요청 검사(Host·Origin)는 서버가 먼저 한다 */
async function route(req, res, u, ctx) {
  const { send } = ctx;
  if (req.method === 'POST' && u.pathname === '/fetch') {
    const body = await ctx.readBody(req);
    const na = available();
    if (na) return send(res, 501, { ok: false, kind: 'node', error: na });
    let input;
    try { input = P.clean(body); } catch (e) { return send(res, 400, { ok: false, kind: 'input', error: e.message }); }
    try {
      const job = start(input, Object.assign({}, ctx.claude, {
        onDone: (j) => console.log(`[${new Date().toLocaleTimeString()}] 찾아오기 ${j.id} ${j.state} (${Math.round((j.endedAt - j.startedAt) / 1000)}초${j.cost ? ` $${j.cost.toFixed(2)}` : ''}) ${j.label}: ${oneLine(j.summary || j.error, 120)}`),
      }));
      console.log(`[${new Date().toLocaleTimeString()}] 찾아오기 ${job.id} 시작: ${input.site.label} (${input.site.docs.join('·')}) · ${input.tx.shop} ${input.tx.usedDate}${input.site.browser ? ` · 브라우저 ${input.site.browser}` : ''}`);
      return send(res, 200, { ok: true, id: job.id });
    } catch (e) { return send(res, e.kind === 'busy' ? 409 : 500, { ok: false, kind: e.kind || 'error', id: e.id, error: String(e.message || e) }); }
  }
  if (req.method === 'GET' && u.pathname === '/fetch/job') {
    const job = find(u.searchParams.get('id'));
    if (!job) return send(res, 404, { ok: false, kind: 'nojob', error: '그 찾아오기 작업이 없습니다 (서버가 다시 시작됐을 수 있음)' });
    return send(res, 200, view(job, u.searchParams.get('since')));
  }
  if (req.method === 'GET' && u.pathname === '/fetch/file') {
    const f = file(u.searchParams.get('id'), u.searchParams.get('name'));
    if (!f) return send(res, 404, { ok: false, kind: 'nofile', error: '그 파일이 없습니다' });
    res.writeHead(200, { 'Content-Type': f.mime || 'application/octet-stream', 'Content-Length': f.buf.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    return res.end(f.buf);
  }
  if (req.method === 'POST' && u.pathname === '/fetch/cancel') {
    const body = await ctx.readBody(req);
    return send(res, 200, { ok: true, canceled: cancel(String(body.id || '')) });
  }
  if (req.method === 'GET' && u.pathname === '/fetch/guide') {   // 설정 페이지의 [안내 복사]: 그 주소(url 또는 host)에 맞는 사이트 안내 파일(sites/*.md) 원문
    let host = String(u.searchParams.get('host') || '');
    try { host = new URL(String(u.searchParams.get('url') || '')).hostname; } catch (e) {}
    return send(res, 200, { ok: true, host, files: P.guideFiles(host).map((g) => ({ name: `site-fetch/sites/${g.name}`, text: g.text })) });
  }
  if (req.method === 'GET' && u.pathname === '/fetch/skill') {   // 설정 페이지의 [스킬 복사]: 사이트 붙이기 스킬 원문
    try { return send(res, 200, { ok: true, name: 'fetch-site', path: SKILL_REL, text: fs.readFileSync(SKILL, 'utf8') }); }
    catch (e) { return send(res, 404, { ok: false, kind: 'noskill', error: `${SKILL_REL} 이 없습니다` }); }
  }
  return send(res, 404, { ok: false, error: 'not found' });
}

module.exports = { available, start, view, find, file, cancel, busy, route, clean: P.clean, build: P.build, parse: P.parse, ensureBrowser: chrome.ensureBrowser, JOB_ROOT };
