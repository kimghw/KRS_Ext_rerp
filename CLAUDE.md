# KR eClass + R&D ERP 현황 (Chrome 확장, MV3)

- 파일별 역할은 README.md 의 "구조" 절, 기능 사양은 SPEC.md, eClass SSO 경로는 classSSO.md.
- 빌드 단계 없음: 이 폴더를 `chrome://extensions` 에서 "압축해제된 확장"으로 로드해 쓴다. 테스트는 `node tests/<파일>.test.js`.
- 코드를 고친 뒤 확장을 다시 올리는 것은 `.claude/settings.local.json` 의 Stop 훅이 한다: 작업을 마칠 때마다 `node tests/cdp/reload.mjs --if-changed` 가 디버그 포트(9333) 크롬의 **이 폴더에서 로드된** 확장을 CDP 로 다시 올리고(바뀐 파일에 문법 오류가 있으면 보류), 커밋 상태(커밋 안 한 변경·올리지 않은 커밋·GitHub 의 새 커밋)를 한 줄로 알린다 — README "개발: 확장 다시 올리기" 절. 작업 도중 새 코드로 실서버를 확인해야 하면 `node tests/cdp/reload.mjs` 를 직접 돌린다. Help Chat 의 헤드리스 실행(`claude -p`)이 끝날 때도 같은 훅이 돈다. 훅이 없는 PC 는 README 의 JSON 으로 만든다.
- 동작이 바뀌면 README.md(해당 절이 있으면 SPEC.md 도)를 같이 고친다.

## Help Chat (help-server) 을 쓸 때 필요한 것

툴바 아이콘으로 여는 사이드 패널(설정에 따라 팝업)의 Help Chat 줄은 이 PC 에서 도는 `help-server/server.js` 가 있어야 동작한다. 서버가 요청을 받아 Claude Code CLI 를 이 폴더에서 헤드리스로 실행한다.

### 설치해 둘 것 (한 번)

| 필요한 것 | 조건 | 확인 |
| --- | --- | --- |
| Node.js | 18 이상, 증빙 찾아오기는 **22 이상**(브라우저 손잡이가 내장 WebSocket 을 씀). `npm install` 은 필요 없음(의존 패키지 없음) | `node --version` |
| Chrome | 증빙 찾아오기의 작업용 창 — 서버가 별도 프로필(`%LOCALAPPDATA%krx-helpetch-chrome`)로 띄움. 기본 설치 위치가 아니면 `KRX_FETCH_CHROME` | — |
| Claude Code CLI | **2.1.280 이상** — 그보다 낮으면 기본 모델 `claude-opus-5-5` 를 거절한다. `PATH` 의 `claude` 또는 `%USERPROFILE%\.local\bin\claude.exe` | `claude --version`, 낮으면 `claude update` |
| Claude 로그인 | Opus 5.5 를 쓸 수 있는 계정으로 CLI 에 로그인돼 있어야 함 | `claude` 실행 후 `/login` |
| git | `PATH` 에 있어야 함 — 바뀐 파일을 `git status` 로 찾는다. 없으면 "적용" 버튼이 나오지 않음 | `git --version` |
| 확장 | 이 폴더(`E:\dev\kr_ext_rerp`)에서 로드한 압축해제된 확장 — 서버가 고치는 파일이 곧 확장이 읽는 파일이어야 함 | `chrome://extensions` 의 경로 |

### 쓸 때마다

```
node help-server/server.js
```

- 터미널을 열어 둔 동안만 동작한다(`127.0.0.1:8106`). **Claude 에 로그인한 Windows 사용자 계정으로** 실행해야 한다 — SYSTEM 계정의 Windows 서비스로 돌리면 로그인 정보가 없어 실패한다.
- 확인: 설정 페이지 › LLM 설정 › **연결 확인**(탭 이름 옆에 연결됨/연결 안 됨 — LLM 으로 하는 기능은 연결돼 있을 때만 켜짐), 또는 `curl http://127.0.0.1:8106/health`.
- 포트 8106 은 `/port_manager` 대장에 `kr_ext_rerp` 로 등록돼 있다.

### 환경 변수 (선택)

`KRX_HELP_PORT`(8106 — 바꾸면 설정 페이지의 Help 서버 주소도 맞출 것) · `KRX_HELP_MODEL`(claude-opus-5-5) · `KRX_HELP_FAST_MODEL`(claude-haiku-5-5 — 청구 준비 자동 분류 `POST /classify`) · `KRX_HELP_CLAUDE`(claude 실행 파일 경로) · `KRX_HELP_PERMISSION`(acceptEdits) · `KRX_HELP_TIMEOUT_MIN`(30) · `KRX_HELP_EXT_ID`(허용할 확장 id)

증빙 찾아오기(`site-fetch/`): `KRX_FETCH_MODEL`(KRX_HELP_MODEL) · `KRX_FETCH_TIMEOUT_MIN`(15) · `KRX_FETCH_BUDGET_USD`(0 = 제한 없음) · `KRX_FETCH_CHROME`(chrome.exe) · `KRX_FETCH_PROFILE`(작업용 Chrome 프로필) · `KRX_FETCH_CDP`(이미 떠 있는 디버그 Chrome — 예 krs-web-agents 의 `http://127.0.0.1:9444`) · `KRX_FETCH_HEADLESS` — 자세히는 [site-fetch/README.md](site-fetch/README.md). 이 PC 는 `site-fetch/local.json`(git 제외)으로 평소 쓰는 "KRS 전용" Chrome(krs-web-agents `chrome_profile/KRS`, 9333)에 붙어 작업마다 새 창에서 찾는다 — 그 프로필의 ChatGPT·Microsoft·Claude 로그인 공유. 그 Chrome 이 떠 있어야 함. 가맹점 등록의 **로그인해 둔 Chrome**(바탕화면 바로가기 이름 "SUB 전용" · 포트 9444 · 주소)이 있으면 그 가맹점은 그 Chrome 에 붙는다 — 바탕화면 `.lnk` 인수에서 포트를 읽고, 안 떠 있으면 그 바로가기로 띄움(`site-fetch/chrome.js ensureBrowser(spec)`)

### 안 될 때

| 팝업에 보이는 것 | 원인 → 조치 |
| --- | --- |
| Help 서버에 연결할 수 없습니다 | 서버가 안 떠 있음 → `node help-server/server.js`. 처음 쓰는 PC 면 그 옆 **설정 프롬프트 복사**(설정 페이지 › LLM 설정에도 있음)를 저장소 폴더에서 연 Claude Code 에 붙여 넣으면 위 준비물 확인부터 서버 실행까지 안내한다(`lib/help-setup.js`) |
| `does not support this model … 2.1.280 or newer` | CLI 가 낮음 → `claude update` 후 서버 다시 실행 |
| 실패 — 로그인/인증 오류 | CLI 로그인이 풀림 → `claude` 실행 후 `/login` |
| 다른 확장(…)에 연결돼 있습니다 (403) | 확장 id 가 바뀜(다른 폴더·다른 프로필에서 로드) → `help-server/.state.json` 의 `origin` 을 지우고 다시 요청 |
| 포트 8106 을 이미 쓰고 있습니다 (서버 콘솔) | 서버가 이미 떠 있거나 다른 프로그램이 사용 → 기존 것을 쓰거나 `KRX_HELP_PORT` |
| 청구 준비에 "Help 서버가 이전 버전이라 Claude 자동 분류를 건너뜁니다" | 0.8.5 전에 띄운 서버 → 서버를 끄고 다시 `node help-server/server.js` |
| 청구 준비 찾아오기에 "Help 서버가 이전 버전이라 찾아오기를 할 수 없습니다" | 증빙 찾아오기가 생기기 전에 띄운 서버 → 서버를 끄고 다시 `node help-server/server.js` |
| 찾아오기에 "Node … 22 이상이 필요합니다" | 서버를 띄운 Node 가 낮음 → Node 22+ 로 서버 다시 실행 |
| 찾아오기에 "작업용 Chrome 이 20초 안에 뜨지 않았습니다" | 같은 프로필을 다른 Chrome 이 쓰는 중이거나 Chrome 을 못 찾음 → 작업용 Chrome 창을 닫고 다시, 또는 `KRX_FETCH_CHROME` |
| 찾아오기가 "찾지 못함: …(추가 인증 필요·로그인 실패)" | 남아 있는 작업용 Chrome 창에서 직접 로그인·인증 → 다시 찾아오기(로그인은 그 프로필에 남음). 아이디·비밀번호는 설정 › LLM 설정 › 증빙 찾아오기 |
| 완료인데 "적용" 버튼이 없음 | 확장 파일이 안 바뀜(문서·테스트만) 또는 문법 오류로 보류 — 상태 줄을 눌러 로그 확인 |

### 알아 둘 것

- 같은 서버가 **청구 준비 자동 분류**(`POST /classify`, `help-server/classify.js`)도 한다: 빠른 모델로 `claude -p` 를 저장소가 아닌 임시 폴더에서 `--safe-mode`·도구 없이 한 번 돌리므로 이 저장소의 CLAUDE.md·Stop 훅은 돌지 않는다. `classify.js` 를 고치면 서버를 다시 띄워야 반영된다.
- 같은 서버가 **증빙 찾아오기**(`POST /fetch` …)도 한다 — 다른 웹 사이트에 가는 부분은 확장 코드와 섞지 않고 `site-fetch/` 폴더에 따로 둔다(서버는 `/fetch*` 경로만 넘김). 작업용 Chrome(별도 프로필, 창이 보임)을 띄우고 `claude -p` 를 임시 폴더에서 `--safe-mode --restricted --permission-mode dontAsk`(허용 = `node cdp.mjs …` · Read)로 돌리므로 이 저장소의 CLAUDE.md·Stop 훅은 돌지 않는다. 아이디·비밀번호는 Claude 에 보이지 않게 브라우저 손잡이(`site-fetch/cdp.mjs`)만 쓴다. `site-fetch/` 를 고치면 서버를 다시 띄워야 반영되고(사이트 안내 `site-fetch/sites/*.md` 는 다음 요청부터 바로), 확장 없이 시험하려면 `node site-fetch/run.js 요청.json`.
- Claude 의 작업 규칙은 `help-server/rules.md`: 커밋·푸시·되돌리기, 버전 올리기, R&D ERP·HR·eClass 에 쓰는 동작, 확장 다시 불러오기를 하지 않는다. 변경은 작업 트리에만 남으므로 확인 뒤 직접 커밋한다.
- 설정 페이지 › LLM 설정 › 증빙 찾아오기의 **사이트 만들기 채팅**도 같은 `/ask` 로 온다(글이 `[증빙 찾아오기 — 새 사이트 붙이기]` 로 시작). 그 요청은 **fetch-site 스킬**(`.claude/skills/fetch-site/SKILL.md`, 대화형에서 `/fetch-site`)의 절차대로 — `node site-fetch/run.js` 단독 실행으로만 시험하고 `site-fetch/sites/<이름>.md` 를 만들며, 마지막 답변에 `howto:` 줄(채팅이 그 가맹점의 "기억한 찾는 방법" 칸에 넣음)을 둔다. 시험 서류는 `site-fetch-out/`(git 제외). 서버의 `GET /fetch/skill` · `GET /fetch/guide?url=` 가 설정 페이지의 **스킬 복사** · **안내 복사**에 원문을 준다.
- 실서버 이상 동작을 Claude 가 직접 확인하려면 CDP 용 Chrome(KRS 프로필, `--remote-debugging-port=9333`)이 떠 있어야 한다. 없어도 코드 근거로 고친다.
- 작업 기록은 `help-server/logs/<id>.json`(최근 50개), 고정된 확장 출처와 대화 세션은 `help-server/.state.json` — 둘 다 git 에서 제외.
- `help-server/` 와 `popup/help.js` 는 이 창구 자체다. 깨지면 팝업에서 고쳐 달라고 할 수 없으니 고칠 때는 `node --check` 와 실제 요청으로 확인한다.
