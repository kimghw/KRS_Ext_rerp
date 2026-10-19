/* 참여연구원 변경 도우미 — Help 서버의 POST /staff (0.8.8). 참여연구원 변경 탭의 채팅(popup/staff-chat.js)이 요청 한 줄과 보고 있는 과제·연차 계획의 요약(이름·월급여·월별 지급 — 천원)·이전 대화 몇 줄을 보내면
 * Claude Code CLI 를 짧게 한 번 돌려(claude -p, 기본 KRX_HELP_MODEL — 금액·기간을 따져야 해서 빠른 모델이 아님, 도구 없음, --json-schema 로 작업 종류·이름 enum 밖 값을 막음) 답 한두 문장(reply)과 확장이 반영할 작업 목록(ops — change·add·remove·init …)을 받는다.
 * 반영·계산은 확장(lib/staff-ui.js bind().agent.apply)이 한다 — 서버는 계획을 바꾸지도 저장하지도 않고, 콘솔에 작업 수만 적는다(이름·금액은 적지 않음).
 * classify.js 처럼 이 저장소가 아닌 임시 폴더에서 --safe-mode 로 돈다(CLAUDE.md·훅·MCP·세션 기록 없이). 프롬프트·스키마·결과 검사는 lib/staff-chat-core.js (확장과 같이 씀 — 고치면 서버를 다시 띄우고 확장도 다시 올린다) */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const core = require('../lib/staff-chat-core.js');
const { clean, build, parse, SYSTEM } = core;
const WORK_DIR = path.join(os.tmpdir(), 'krx-help-staff');   // 도우미용 claude 의 작업 폴더 (이 저장소의 CLAUDE.md·.claude 설정을 읽지 않게)
const str = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n || 300);

/* claude -p 한 번. input = clean(본문), opts: { bins: [실행 파일 후보], model, fallback, env, timeoutMs, kill(child) } → Promise<{ reply, ops, dropped, cost, apiMs }> */
function run(input, opts) {
  const { text, schema } = build(input);
  const args = ['-p', '--model', opts.model, '--safe-mode', '--tools', '', '--no-session-persistence', '--strict-mcp-config',
    '--system-prompt', SYSTEM, '--output-format', 'stream-json', '--verbose', '--json-schema', JSON.stringify(schema)];
  if (opts.fallback && opts.fallback !== opts.model) args.push('--fallback-model', opts.fallback);
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
      child.stdin.end(text, 'utf8');   // 요청 글(계획 요약 포함)은 stdin 으로 — 명령줄 길이 제한과 무관
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (d) => { buf += d; let nl; while ((nl = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1); if (l) onLine(l); } });
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (d) => { errTail = (errTail + d).slice(-2000); });
      child.on('close', (code) => {
        if (buf.trim()) onLine(buf.trim());
        if (!result) return end(new Error(str(errTail.split(/\r?\n/).filter((l) => l && !/unrecognized_model/.test(l)).pop() || `Claude 가 결과 없이 끝났습니다 (exit ${code})`, 300)));
        if (result.is_error) return end(new Error(str(result.result || result.subtype || '도우미 실패', 300)));
        let out = result.structured_output;
        if (!out) { try { out = JSON.parse(String(result.result || '').replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch (e) { out = null; } }
        if (!out) return end(new Error('Claude 의 답을 읽지 못했습니다'));
        end(null, Object.assign(parse(input, out), { cost: result.total_cost_usd, apiMs: result.duration_api_ms }));
      });
    };
    attempt(opts.bins);
  });
}

module.exports = { clean, build, parse, run, SYSTEM };
