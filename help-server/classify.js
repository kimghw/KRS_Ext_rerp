/* 청구 준비 자동 분류 — Help 서버의 POST /classify (0.8.5). 확장 백그라운드(lib/prep-ai.js)가 카드 거래 하나의 정보·청구내역(적요)·첨부 파일(이미지·PDF 는 내용째)을 보내면
 * Claude Code CLI 를 짧게 한 번 돌려(claude -p, 기본 claude-haiku-5-5, 도구 없음, --json-schema 의 enum 으로 후보 밖 값을 막음) 청구종류와 파일마다 첨부 종류를 고르고,
 * 청구내역(적요) 한 줄을 쓴다 — 품목은 첨부 파일 내용(인보이스·거래명세서)에서, 용도는 그 과제 연구개발계획서의 개발내용·목표에서.
 * 코드를 고치는 Help Chat(/ask)과 달리 이 저장소가 아닌 임시 폴더에서 --safe-mode 로 돈다: CLAUDE.md·훅(이 저장소의 Stop 훅 = 확장 다시 올리기)·MCP·세션 기록 없이. 입력은 stream-json(image · document 블록).
 * 입력 정리·프롬프트·스키마·결과 검사(입력·결과 모양 포함)는 lib/classify-core.js (0.8.6 — 확장이 Claude API 로 직접 물을 때도 같은 글). 서버(server.js)는 clean → run 만 부른다 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const core = require('../lib/classify-core.js');   // 입력 정리·프롬프트·스키마·결과 검사 — 확장 백그라운드(lib/claude-api.js, Claude API 직접)와 같이 씀
const { clean, build, parse, SYSTEM, LIMIT } = core;
const WORK_DIR = path.join(os.tmpdir(), 'krx-help-classify');   // 분류용 claude 의 작업 폴더 (이 저장소의 CLAUDE.md·.claude 설정을 읽지 않게)
const str = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n || LIMIT.text);

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
