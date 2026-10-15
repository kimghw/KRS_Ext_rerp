/* lib/help-setup.js 테스트 — Help 서버를 못 붙인 PC 에서 Claude Code 에 붙여 넣는 설정 프롬프트(팝업 Help Chat · 설정 페이지의 [설정 프롬프트 복사]). 실행: node tests/help-setup.test.js */
globalThis.self = globalThis;
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'lib/help-setup.js'), 'utf8'), { filename: 'lib/help-setup.js' });
const S = globalThis.KRX_HELP_SETUP;

let n = 0, failed = 0;
const test = (name, fn) => { n++; try { fn(); console.log('ok', name); } catch (e) { failed++; console.log('FAIL', name, '\n   ', e.message); } };

test('기본 주소·포트와 핵심 절차가 들어 있다', () => {
  const p = S.prompt({});
  for (const s of ['http://127.0.0.1:8106/health', '-LocalPort 8106', 'node help-server/server.js', 'CLAUDE.md', 'node --version', 'git --version', 'claude --version', 'claude auth status', 'KRX_HELP_PORT', '하지 말 것', '커밋·푸시']) assert(p.includes(s), `없음: ${s}`);
  assert(p.startsWith('[KR eClass + R&D ERP 현황 확장'));
  assert(p.includes('보낸 곳: 툴바 팝업 Help Chat'));
  assert(!p.includes('(확장이 본 상태'), '이유가 없으면 그 괄호도 없음');
});
test('주소 끝 슬래시를 떼고 포트·버전·보낸 곳·이유를 넣는다', () => {
  const p = S.prompt({ url: 'http://localhost:8200/', version: ' 0.8.5 ', from: '설정 페이지 › LLM 설정', reason: '연결할 수  없습니다\n(http://localhost:8200)' });
  assert(p.includes('http://localhost:8200/health') && !p.includes('8200//'));
  assert(p.includes('-LocalPort 8200'));
  assert(p.includes('확장(버전 0.8.5)은'));
  assert(p.includes('보낸 곳: 설정 페이지 › LLM 설정 · 설정된 Help 서버 주소 http://localhost:8200'));
  assert(p.includes('(확장이 본 상태: 연결할 수 없습니다 (http://localhost:8200))'), '공백·줄바꿈을 한 칸으로');
});
test('빈 주소는 기본값, 긴 이유는 200자로 자른다', () => {
  assert(S.prompt({ url: '   ' }).includes('http://127.0.0.1:8106 에 연결하지 못합니다'));
  const p = S.prompt({ reason: 'x'.repeat(500) });
  assert(p.includes('x'.repeat(200)) && !p.includes('x'.repeat(201)));
  assert(p.length < 6000, 'Help 서버 /ask 한도(6000자)보다 짧게');
});
test('아이디·비밀번호 같은 값은 들어가지 않는다', () => {
  const p = S.prompt({ url: 'http://127.0.0.1:8106', version: '0.8.5', reason: 'r' });
  assert(!/비밀번호|password|api[_ -]?key/i.test(p));
});

console.log(`${n - failed}/${n} 통과`);
if (failed) process.exit(1);
