/* 참여연구원 변경 도우미 — Help 서버의 POST /staff (0.8.8). 참여연구원 변경 탭의 채팅(popup/staff-chat.js)이 요청 한 줄과 보고 있는 과제·연차 계획의 요약(이름·월급여·월별 지급 — 천원)·이전 대화 몇 줄·예산 규칙·첨부를 보내면
 * Claude Code CLI 를 짧게 한 번 돌려(claude -p, 기본 KRX_HELP_MODEL — 금액·기간을 따져야 해서 빠른 모델이 아님, 도구 없음, --json-schema 로 작업 종류·이름 enum 밖 값을 막음) 답 한두 문장(reply)과 확장이 반영할 작업 목록(ops — change·add·remove·init …)을 받는다.
 * 반영·계산은 확장(lib/staff-ui.js bind().agent.apply)이 한다 — 서버는 계획을 바꾸지도 저장하지도 않고, 콘솔에 작업 수만 적는다(이름·금액은 적지 않음).
 * classify.js 처럼 이 저장소가 아닌 임시 폴더에서 --safe-mode 로 돈다(CLAUDE.md·훅·MCP·세션 기록 없이). 프롬프트·스키마·결과 검사는 lib/staff-chat-core.js (확장과 같이 씀 — 고치면 서버를 다시 띄우고 확장도 다시 올린다).
 * 시스템 프롬프트는 build().system — SYSTEM 뒤에 사용자의 예산 규칙(채팅 머리 [규칙], 2026-10-20).
 * 첨부(0.8.9, 2026-10-21 사용자 "엑셀, 워드, PDF, HWP/X, 이미지를 첨부"): 글은 확장이 lib/doc-text.js 로 미리 뽑아 files[].text 로 보내고, PDF·이미지만 base64(files[].data)로 온다 — 요청마다 새 작업 폴더에 써 두고(stageFiles) 그때만 --tools Read(--permission-mode dontAsk)로
 *   Claude 가 읽게 한다(이미지는 글자를 읽는 OCR 구실). 끝나면 폴더를 지운다. 첨부가 없으면 전처럼 도구 없음.
 * claude.exe 가 시작하다 결과 없이 바로 죽는 일(exit 0xC0000409, 2026-10-21 한 번 봄 — API 호출 전이라 비용 없음)이 있어 RETRY_MS 안에 결과 없이 끝나면 한 번 더 돌린다 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const core = require('../lib/staff-chat-core.js');
const { clean, build, parse, SYSTEM } = core;
const WORK_DIR = path.join(os.tmpdir(), 'krx-help-staff');   // 도우미용 claude 의 작업 폴더 (이 저장소의 CLAUDE.md·.claude 설정을 읽지 않게)
const RETRY_MS = 8000;
const str = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n || 300);

/* 내용(base64)이 온 첨부(PDF·이미지)를 요청마다 새 폴더에 쓰고 path 를 둔다(data 는 비움). cleanup() 이 폴더를 지운다. 없으면 WORK_DIR 그대로 */
function stageFiles(input) {
  const files = (input.files || []).filter((f) => f && f.data);
  if (!files.length) return { dir: WORK_DIR, cleanup() {} };
  const dir = path.join(WORK_DIR, `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`);
  fs.mkdirSync(dir, { recursive: true });
  const used = new Set();
  for (const f of files) {
    let name = f.name;
    for (let i = 2; used.has(name.toLowerCase()); i++) name = f.name.replace(/(\.[^.]*)?$/, ` (${i})$1`);
    used.add(name.toLowerCase());
    f.path = path.join(dir, name);
    fs.writeFileSync(f.path, Buffer.from(f.data, 'base64'));
    f.data = '';
  }
  return { dir, cleanup() { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} } };
}

/* claude -p 한 번. input = clean(본문), opts: { bins: [실행 파일 후보], model, fallback, env, timeoutMs, kill(child) } → Promise<{ reply, ops, dropped, cost, apiMs }> */
function run(input, opts) {
  try { fs.mkdirSync(WORK_DIR, { recursive: true }); } catch (e) {}
  const staged = stageFiles(input);
  const { text, schema, system } = build(input);   // system = SYSTEM + 사용자의 예산 규칙, text 에 첨부의 글·경로
  const tools = (input.files || []).some((f) => f && f.path) ? 'Read' : '';
  const args = ['-p', '--model', opts.model, '--safe-mode', '--tools', tools, '--no-session-persistence', '--strict-mcp-config',
    '--system-prompt', system, '--output-format', 'stream-json', '--verbose', '--json-schema', JSON.stringify(schema)];
  if (tools) args.push('--permission-mode', 'dontAsk');   // 작업 폴더의 첨부만 Read — 묻지 않음
  if (opts.fallback && opts.fallback !== opts.model) args.push('--fallback-model', opts.fallback);
  return new Promise((resolve, reject) => {
    let settled = false;
    const end = (err, val) => { if (settled) return; settled = true; staged.cleanup(); if (err) reject(err); else resolve(val); };
    const attempt = (bins, retried) => {
      const started = Date.now();
      const child = spawn(bins[0], args, { cwd: staged.dir, env: opts.env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
      let buf = '', errTail = '', result = null, moved = false;
      const timer = setTimeout(() => { if (opts.kill) opts.kill(child); else child.kill(); end(new Error(`시간 초과 (${Math.round(opts.timeoutMs / 1000)}초)`)); }, opts.timeoutMs);
      const onLine = (line) => { try { const ev = JSON.parse(line); if (ev && ev.type === 'result') result = ev; } catch (e) {} };
      child.on('error', (e) => {
        clearTimeout(timer);
        if (e && e.code === 'ENOENT' && bins.length > 1) { moved = true; return attempt(bins.slice(1), retried); }
        end(new Error(e && e.code === 'ENOENT' ? 'claude CLI 를 찾지 못했습니다 (PATH 또는 KRX_HELP_CLAUDE 확인)' : String((e && e.message) || e)));
      });
      child.stdin.on('error', () => {});
      child.stdin.end(text, 'utf8');   // 요청 글(계획 요약 포함)은 stdin 으로 — 명령줄 길이 제한과 무관
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (d) => { buf += d; let nl; while ((nl = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1); if (l) onLine(l); } });
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (d) => { errTail = (errTail + d).slice(-2000); });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (moved || settled) return;
        if (buf.trim()) onLine(buf.trim());
        if (!result && code !== 0 && !retried && Date.now() - started < RETRY_MS) return attempt(bins, true);   // 시작하다 죽음 — 한 번 더
        if (!result) return end(new Error(str(errTail.split(/\r?\n/).filter((l) => l && !/unrecognized_model/.test(l)).pop() || `Claude 가 결과 없이 끝났습니다 (exit ${code})`, 300)));
        if (result.is_error) return end(new Error(str(result.result || result.subtype || '도우미 실패', 300)));
        let out = result.structured_output;
        if (!out) { try { out = JSON.parse(String(result.result || '').replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch (e) { out = null; } }
        if (!out) return end(new Error('Claude 의 답을 읽지 못했습니다'));
        end(null, Object.assign(parse(input, out), { cost: result.total_cost_usd, apiMs: result.duration_api_ms }));
      });
    };
    attempt(opts.bins, false);
  });
}

module.exports = { clean, build, parse, run, stageFiles, SYSTEM, WORK_DIR };
