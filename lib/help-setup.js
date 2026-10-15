/* Help 서버(LLM) 를 아직 못 붙인 PC 에서 Claude Code 에 붙여 넣는 "설정 프롬프트" — 팝업 Help Chat(popup/help.js) 의 [설정 프롬프트 복사] 와 설정 페이지 › LLM 설정(options/options.js) 의
 * [Claude Code 설정 프롬프트 복사] 가 쓴다. 서버가 안 떠 있으면 Help Chat 으로는 물을 수 없으니, 이 글을 저장소 폴더(확장을 로드한 폴더)에서 연 대화형 Claude Code 에 붙여 넣어
 * 준비물 확인·포트 확인·서버 실행·/health 확인을 시키는 용도다. 내용은 CLAUDE.md "Help Chat (help-server) 을 쓸 때 필요한 것" 절을 따르고, 확장 코드 수정·커밋은 하지 말라고 못 박는다.
 * popup/help.js 는 독립 스크립트라 이 파일이 없어도(깨져도) 짧은 글로 대신한다. 테스트: node tests/help-setup.test.js */
(function (g) {
  'use strict';
  const DEFAULT_URL = 'http://127.0.0.1:8106';
  /* o = { url(설정된 Help 서버 주소), version(확장 버전), from(어디서 복사했나), reason(확장이 본 연결 상태 한 줄) } */
  function prompt(o) {
    const x = o || {};
    const url = String(x.url || '').trim().replace(/\/+$/, '') || DEFAULT_URL;
    const port = (url.match(/:(\d+)$/) || [])[1] || '8106';
    const ver = x.version ? `(버전 ${String(x.version).trim()})` : '';
    const reason = x.reason ? String(x.reason).replace(/\s+/g, ' ').trim().slice(0, 200) : '';
    return [
      '[KR eClass + R&D ERP 현황 확장 — Help 서버(LLM) 연결 설정]',
      `이 폴더는 Chrome 확장 "KR eClass + R&D ERP 현황"(kr_ext_rerp) 저장소이고, 확장${ver}은 chrome://extensions 에 이 폴더를 압축해제된 확장으로 로드해 두었습니다. 확장의 LLM 기능(Help Chat · 청구 준비 자동 분류 · 증빙 찾아오기)은 이 PC 에서 도는 Help 서버(node help-server/server.js)가 있어야 하는데, 지금 확장이 ${url} 에 연결하지 못합니다${reason ? ` (확장이 본 상태: ${reason})` : ''}. CLAUDE.md 의 "Help Chat (help-server) 을 쓸 때 필요한 것" 절을 따라 이 PC 를 준비하고 서버를 띄워 주세요.`,
      '',
      '해 줄 것',
      '1. 이 폴더가 그 저장소인지 확인(manifest.json 의 name, help-server/server.js, CLAUDE.md). 아니면 멈추고 알려 주세요.',
      '2. 준비물 확인 — 없거나 낮은 것은 설치·갱신 방법을 알려 주고, 설치는 나에게 먼저 물은 뒤에:',
      '   - Node.js 22 이상: node --version (https://nodejs.org LTS). npm install 은 필요 없음(의존 패키지 없음)',
      '   - git: git --version (https://git-scm.com — PATH 에 있어야 함)',
      '   - Claude Code CLI 2.1.280 이상: claude --version (낮으면 claude update. 없으면 PowerShell 에서 irm https://claude.ai/install.ps1 | iex 또는 npm install -g @anthropic-ai/claude-code)',
      '   - Claude 로그인: claude auth status 의 loggedIn 이 true 인지 — 아니면 claude 를 실행해 /login (Opus 5.5 를 쓸 수 있는 계정). 서버는 지금 로그인한 이 Windows 사용자 계정으로 돌려야 합니다(SYSTEM 계정의 서비스는 안 됨)',
      `3. 포트 ${port} 확인: Get-NetTCPConnection -LocalPort ${port} -State Listen. 다른 프로세스가 잡고 있으면 무엇인지 알려 주고, 끄기 전에 나에게 물으세요. 포트를 바꿔야 하면 환경 변수 KRX_HELP_PORT 와 확장 설정 페이지 › LLM 설정 › Help 서버 주소를 같이 바꿔야 합니다.`,
      '4. 서버 실행: 이 폴더에서 node help-server/server.js — 터미널 창을 열어 둔 동안만 동작하므로 별도 터미널(또는 VS Code 터미널)에서 띄우고 그 창을 닫지 말라고 안내하세요. 백그라운드 프로세스로 띄우면 나중에 보이지 않는 옛 서버가 남으니 그렇게 하지 마세요.',
      `5. 확인: curl ${url}/health 응답에 "ok":true · "name":"krx-help" · "fetch" 가 있는지. 그런 뒤 확장 설정 페이지 › LLM 설정 › 연결 확인에서 "연결됨" 이 되는지 나에게 확인을 요청하세요(페이지를 열어 두면 30초 안에 저절로 바뀜).`,
      '6. 증빙 찾아오기도 쓸 거면: Chrome 이 기본 위치에 없을 때만 환경 변수 KRX_FETCH_CHROME 을 잡습니다. site-fetch/local.json 은 다른 PC 의 것이라 없어도 됩니다(없으면 서버가 작업용 Chrome 프로필을 직접 띄움).',
      '',
      '하지 말 것: 확장 코드·설정 파일 수정, 커밋·푸시, 확장 다시 불러오기. 안 되는 것이 있으면 CLAUDE.md 의 "안 될 때" 표로 원인을 짚어 주세요.',
      `(보낸 곳: ${String(x.from || '툴바 팝업 Help Chat').trim()} · 설정된 Help 서버 주소 ${url})`,
    ].join('\n');
  }
  g.KRX_HELP_SETUP = { DEFAULT_URL, prompt };
})(typeof self !== 'undefined' ? self : this);
