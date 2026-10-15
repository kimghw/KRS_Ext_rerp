#!/usr/bin/env node
/* site-fetch 단독 실행 — 확장·Help 서버 없이 찾아오기 한 번을 돌려 본다 (사이트 안내를 고치거나 새 사이트를 시험할 때).
 *   node site-fetch/run.js <요청.json> [--out <폴더>]
 * 요청.json = { site: { label, url, kind: lecture|subscription|other, docs: [...], hint, howto, browser }, cred: { id, pw }, tx: { shop, amount, usedDate, appr, ptcl, type } }
 *   (site.browser = 로그인해 둔 Chrome — 바탕화면 바로가기 이름 "SUB 전용" · 디버그 포트 "9444" · 주소. 비우면 local.json·환경 변수·기본 작업용 프로필 — chrome.js)
 *   (확장이 POST /fetch 로 보내는 것과 같음. 비밀번호를 파일에 두기 싫으면 cred 를 빼고 환경 변수 KRX_FETCH_ID / KRX_FETCH_PW 로)
 * 진행 줄을 그대로 찍고, 끝나면 받은 서류를 --out(기본 현재 폴더의 site-fetch-out/)에 복사하고 결과 JSON 을 찍는다. 모델은 KRX_FETCH_MODEL(기본 claude-opus-5-5) */
'use strict';
const fs = require('fs');
const path = require('path');
const sf = require('./index');

const argv = process.argv.slice(2);
const reqFile = argv.find((a) => !a.startsWith('--'));
const outIdx = argv.indexOf('--out');
const outDir = path.resolve(outIdx >= 0 && argv[outIdx + 1] ? argv[outIdx + 1] : 'site-fetch-out');
if (!reqFile) { console.error('사용법: node site-fetch/run.js <요청.json> [--out <폴더>]'); process.exit(2); }
const na = sf.available();
if (na) { console.error(na); process.exit(2); }
let body;
try { body = JSON.parse(fs.readFileSync(reqFile, 'utf8')); } catch (e) { console.error(`요청 파일을 읽지 못했습니다: ${e.message}`); process.exit(2); }
if (process.env.KRX_FETCH_ID || process.env.KRX_FETCH_PW) body.cred = { id: process.env.KRX_FETCH_ID || '', pw: process.env.KRX_FETCH_PW || '' };
let input;
try { input = sf.clean(body); } catch (e) { console.error(e.message); process.exit(2); }

const home = process.env.USERPROFILE || process.env.HOME || '';
const bins = [process.env.KRX_HELP_CLAUDE || 'claude'].concat(home ? [path.join(home, '.local', 'bin', process.platform === 'win32' ? 'claude.exe' : 'claude')] : []);
const env = Object.assign({}, process.env);
for (const k of ['CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_SSE_PORT', 'KRX_FETCH_ID', 'KRX_FETCH_PW']) delete env[k];
const model = process.env.KRX_FETCH_MODEL || process.env.KRX_HELP_MODEL || 'claude-opus-5-5';
const t0 = Date.now();
const mark = { info: '·', say: '»', tool: '▸', warn: '!', ok: '✔', err: '✖' };
const kill = (child) => { if (!child || child.exitCode !== null) return; if (process.platform === 'win32') require('child_process').execFile('taskkill', ['/PID', String(child.pid), '/T', '/F'], () => {}); else child.kill('SIGTERM'); };

const job = sf.start(input, {
  bins, model, env, kill,
  onLine: (k, s) => console.log(`${String(Math.round((Date.now() - t0) / 1000)).padStart(4)}s ${mark[k] || ' '} ${s}`),
  onDone: (j) => {
    const files = [];
    if (j.files.length) fs.mkdirSync(outDir, { recursive: true });
    for (const f of j.files) {
      const src = sf.file(j.id, f.name);
      if (!src) continue;
      fs.writeFileSync(path.join(outDir, f.name), src.buf);
      files.push(Object.assign({}, f, { saved: path.join(outDir, f.name) }));
    }
    console.log(JSON.stringify({ state: j.state, summary: j.summary, error: j.error, item: j.item, matched: j.matched, howto: j.howto, files, missing: j.missing, cost: j.cost, seconds: Math.round((j.endedAt - j.startedAt) / 1000) }, null, 1));
    process.exit(j.state === 'done' ? 0 : 1);
  },
});
process.on('SIGINT', () => { sf.cancel(job.id); });
