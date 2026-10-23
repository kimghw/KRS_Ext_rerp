# KR eClass + R&D ERP 현황 (Chrome 확장, MV3)

- 파일별 역할은 README.md 의 "구조" 절, 기능 사양은 SPEC.md, eClass SSO 경로는 classSSO.md.
- 빌드 단계 없음: 이 폴더를 `chrome://extensions` 에서 "압축해제된 확장"으로 로드해 쓴다. 테스트는 `node tests/<파일>.test.js`.
- 코드를 고친 뒤 확장을 다시 올리는 것은 `.claude/settings.local.json` 의 Stop 훅이 한다: 작업을 마칠 때마다 `node tests/cdp/reload.mjs --if-changed` 가 디버그 포트(9333) 크롬의 **이 폴더에서 로드된** 확장을 CDP 로 다시 올리고(바뀐 파일에 문법 오류가 있으면 보류), 커밋 상태(커밋 안 한 변경·올리지 않은 커밋·GitHub 의 새 커밋)를 한 줄로 알린다 — README "개발: 확장 다시 올리기" 절. 작업 도중 새 코드로 실서버를 확인해야 하면 `node tests/cdp/reload.mjs` 를 직접 돌린다. Help Chat 의 헤드리스 실행(`claude -p`)이 끝날 때도 같은 훅이 돈다. 훅이 없는 PC 는 README 의 JSON 으로 만든다.
- 동작이 바뀌면 README.md(해당 절이 있으면 SPEC.md 도)를 같이 고친다.
- **공유 (Plus)** 는 SharePoint(OneDrive) 의 **과제별 폴더**(밑폴더 — 기본 내 OneDrive 문서/업무/shared — 아래 `<약칭 → Job Id → 과제번호>/`)에 둔 연차 파일 `<n>차년도.json`(과제 정보 · 예산 줄 · 참여연구원 계획 · 연구내용 · 변경이력)과 `예상비용.json`(모든 연차의 예상 비용 — 연차에 걸치는 항목이 두 파일에 갈라지지 않게 과제 폴더에 하나, 2026-10-18 저녁 사용자 "예상지출도 다 들어 가겠지? 이건 별도 파일에서 해도 되긴하는데 알아서 해줘")이다. 밑폴더의 `common/가맹점.json` 은 증빙 찾아오기의 자주 사용 가맹점(아이디·비밀번호·로그인해 둔 Chrome 은 빼고) — 내 파일만 쓰고 "나와 공유" 의 동료 파일은 읽어 가맹점마다 나중에 고친 쪽으로 합친다(`lib/sites-sync.js` · `lib/fetch-sites.js mergeShared`, 2026-10-22 사용자 "shared/common 아래" · "동료와도 합침"; 실 테넌트 확인 전). KRS WORKSPACE 는 같은 폴더·같은 파일을 쓴다(jobId·io·note·`auto` 변경이력은 그쪽 몫; **예상 비용·예산 줄·참여연구원 계획은 rerp 만 고치고 그쪽은 받아 보이기만**, **행정지원 project.support·supportAt 는 양쪽이 고침**(supportAt 큰 쪽) — 2026-10-19 사용자 "참여인력 변경, 예산 변경등은 rerp 에서만 할게 … 행정지원은 서로 변경 가능하고"; 그쪽 포팅은 별도): `lib/sp-store.js`(저장소 접근 — 폴더 목록 · 나와 공유 · 사람 찾기·공유 · 조직 내 링크 · 이름 바꾸기 포함) · `lib/prjdoc.js`(문서 v2 모양·병합) · `lib/prjdoc-sync.js`(과제별·연차별 차례) · 배선 `background.js shareSync`(폴더를 새로 만들면 참여연구원에게 자동 공유, 받는 쪽은 "나와 공유" 에서 저절로 찾음). 과제 식별은 폴더 이름이 아니라 파일 안의 `project.prjNo`(캐시 `storage.local.shareIndex`). v1(`<과제번호>.json`) 파일은 읽지 않는다. **브라우저의 SharePoint 로그인 쿠키만** 쓰므로 서버가 필요 없다 — 원노트 · KR_MS365_mcp MCP 서버 · Graph · Entra 로그인은 2026-10-18 에 모두 걷어 냈고(README "공유 (Plus)" › 쓰지 않은 길) 다시 붙이지 않는다. **예외(2026-10-20 사용자 "각기 보내는 건 mcp teams 로 하고 연결 안 되면 못 쓰는 거고")**: 참여연구원 자료 요청의 **팀즈 글 보내기만** 이 PC 의 KR_MS365_mcp **teams** 서버(`teams.mcpUrl` 기본 `http://localhost:5003/mcp`, `lib/teams-mcp.js` · `lib/mcp-client.js`, 백그라운드 `collectSend`)로 창 없이 보내고 연결이 안 되면 딥 링크만 — 저장소·동기화에는 여전히 MCP·Graph 를 쓰지 않는다. 테스트는 가짜 fetch·가짜 chrome 으로만(`node tests/sp-store.test.js` · `prjdoc.test.js` · `prjdoc-sync.test.js`); 실 SharePoint 에 쓰는 확인은 사용자 승인이 있을 때 로그인된 CDP Chrome 에서 하고, 쿠키·다이제스트 값은 로그·결과에 찍지 않는다. 쓰기 때 최소화된 SharePoint 작업 창(`…/_api/web/currentuser?$select=Id`)이 잠깐 뜨는 것은 정상이다(끝나면 닫힘, 남은 것은 다음 워커 시작 때 `KRX_SP.sweepWorkers` 가 거둠). 참여연구원 **자료 요청**(0.8.9)도 같은 쿠키 길이다 — 내 OneDrive 에 응답 목록(SharePoint List)을 만들어(`writer.createList`) 참여연구원에게 공유하고 Teams **딥 링크**(`users=이메일&message=글` — 보내기는 사용자)로 알리며 응답은 `listItems` 로 읽는다(`lib/collect.js` · `background.js collect*` · 탭의 `collectSection`, README "사업비 관리" › 자료 요청); Graph 채팅 API·Forms 는 쓰지 않는다. 실 테넌트에서는 아직 확인 전(2026-10-20).

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

- 또는 `help-server\setup.cmd` 더블클릭(2026-10-21): Claude Code CLI 설치(없으면, 공식 install.ps1)/최신화(`claude update`) → `git pull --ff-only` → 서버 실행을 한 번에(내용은 `setup.ps1`). 설정 페이지 › LLM 연결이 이 파일을 안내한다(Win+R → `<확장 폴더>\help-server\setup.cmd` → Enter); 패널 제목 줄의 **B**(브릿지) 아이콘(서버가 없을 때만 보임)은 누르면 연결 지침(`lib/help-setup.js` 의 Claude Code 설정 프롬프트)을 클립보드에 복사하고 풍선 말에 이 길도 적는다(2026-10-23 사용자 "B를 클릭하면 연결 지침을 복사하게 해줘") — 브라우저 확장은 이 PC 에 프로그램을 띄우거나 설치할 수 없어 이 한 번은 사용자 몫.

- 터미널을 열어 둔 동안만 동작한다(`127.0.0.1:8106`). **Claude 에 로그인한 Windows 사용자 계정으로** 실행해야 한다 — SYSTEM 계정의 Windows 서비스로 돌리면 로그인 정보가 없어 실패한다.
- 확인: 설정 페이지 › LLM 설정 › **연결 확인**(탭 이름 옆에 연결됨/연결 안 됨 — LLM 으로 하는 기능은 연결돼 있을 때만 켜짐), 또는 `curl http://127.0.0.1:8106/health`.
- 포트 8106 은 `/port_manager` 대장에 `kr_ext_rerp` 로 등록돼 있다.

### 환경 변수 (선택)

`KRX_HELP_PORT`(8106 — 바꾸면 설정 페이지의 Help 서버 주소도 맞출 것) · `KRX_HELP_MODEL`(claude-opus-5-5) · `KRX_HELP_FAST_MODEL`(claude-haiku-5-5 — 청구 준비 자동 분류 `POST /classify`) · `KRX_HELP_STAFF_MODEL`(KRX_HELP_MODEL — 참여연구원 변경 도우미 `POST /staff`) · `KRX_HELP_CLAUDE`(claude 실행 파일 경로) · `KRX_HELP_PERMISSION`(acceptEdits) · `KRX_HELP_TIMEOUT_MIN`(30) · `KRX_HELP_EXT_ID`(허용할 확장 id)

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
| 참여연구원 변경 탭의 변경 도우미([에이전트])에 "Help 서버가 이전 버전" | 0.8.8 전에 띄운 서버 → 서버를 끄고 다시 `node help-server/server.js` 한 뒤 [연결 확인] |
| 찾아오기에 "Node … 22 이상이 필요합니다" | 서버를 띄운 Node 가 낮음 → Node 22+ 로 서버 다시 실행 |
| 찾아오기에 "작업용 Chrome 이 20초 안에 뜨지 않았습니다" | 같은 프로필을 다른 Chrome 이 쓰는 중이거나 Chrome 을 못 찾음 → 작업용 Chrome 창을 닫고 다시, 또는 `KRX_FETCH_CHROME` |
| 찾아오기가 "찾지 못함: …(추가 인증 필요·로그인 실패)" | 남아 있는 작업용 Chrome 창에서 직접 로그인·인증 → 다시 찾아오기(로그인은 그 프로필에 남음). 아이디·비밀번호는 설정 › LLM 설정 › 증빙 찾아오기 |
| 제목 줄에 업데이트 단추가 안 보임 | GitHub 에 새 커밋이 없거나(같으면 단추 없음), 서버가 이전 버전(`GET /git` 없음 — 설정 › LLM 설정 › 연결 확인에 "GitHub 새 커밋 확인·받기 없음") → 서버를 끄고 다시 `node help-server/server.js`, 또는 서버 연결 안 됨(B 아이콘이 보임) |
| 완료인데 "적용" 버튼이 없음 | 확장 파일이 안 바뀜(문서·테스트만) 또는 문법 오류로 보류 — 상태 줄을 눌러 로그 확인 |

### 알아 둘 것

- 같은 서버가 **청구 준비 자동 분류**(`POST /classify`, `help-server/classify.js`)도 한다: 빠른 모델로 `claude -p` 를 저장소가 아닌 임시 폴더에서 `--safe-mode`·도구 없이 한 번 돌리므로 이 저장소의 CLAUDE.md·Stop 훅은 돌지 않는다. `classify.js` 를 고치면 서버를 다시 띄워야 반영된다.
- 자동 분류는 서버 없이 **Claude API** 로도 된다(0.8.6): 설정 › LLM 설정 › Claude API 의 키(`storage.local.claudeApiKey`)로 확장 백그라운드가 `api.anthropic.com` 에 직접(`lib/claude-api.js`, 의존 패키지가 없어 SDK 대신 fetch). 프롬프트·스키마·결과 검사는 서버와 같은 `lib/classify-core.js` — 고치면 서버를 다시 띄우고 확장도 다시 올려야 둘 다 반영된다. Help Chat·증빙 찾아오기는 서버로만.
- 같은 서버가 **참여연구원 변경 도우미**(`POST /staff`, `help-server/staff-chat.js`)도 한다(연구수당 계산 탭의 **연구수당 도우미**는 같은 채팅·같은 실행의 `POST /allow` — 프롬프트·작업만 `lib/allow-chat-core.js`(10-53 연구수당 지침이 [지침] 기본 글), 반영은 `lib/allowance.js agent.apply`; 2026-10-21): 참여연구원 변경 탭 제목 줄의 [에이전트] 단추로 여는 채팅(`popup/staff-chat.js`)이 보낸 요청 + 계획 요약으로 `claude -p` 를 임시 폴더에서 `--safe-mode`·도구 없이 한 번 돌려 작업 목록(ops)을 받고, 반영은 확장(`lib/staff-ui.js bind().agent.apply` — 폼·칸과 같은 길)이 한다. 프롬프트·스키마·검사는 `lib/staff-chat-core.js` — 고치면 서버를 다시 띄우고 확장도 다시 올려야 둘 다 반영된다. LLM(Help 서버)이 연결돼 있을 때만 입력란이 켜진다(Claude API 키도 연결로 치지만 **확인된 키만** — `lib/claude-api.js check`(GET /v1/models, `storage.local.llmApi`) 가 ok 이고, `sk-ant-usr-…` 키는 워크스페이스 ID(`claudeApiWorkspace`)가 있어야 하며(GET 은 통과해도 /v1/messages 가 400 — 2026-10-21 실측), 보내기가 400/401/403/404 로 거절되면 바로 연결 해제 — 2026-10-21 사용자 "claude 연결이 안되어 있으면 입력이 안되게"). 0.8.9(2026-10-21): 기본 연결은 Claude CLI(Help 서버)이고 서버가 없으면 채팅의 안내 카드에서 Claude API 키(`storage.local.claudeApiKey`)를 넣어 `lib/claude-api.js staff()` 로 바로 보낼 수 있으며, 📎 첨부(엑셀·워드·HWP/HWPX·txt 는 확장의 `lib/doc-text.js` 가 의존 없이 글을 뽑음 — HWP 는 변환 없이 CFB 를 바로 읽음; PDF·이미지는 서버가 요청별 임시 폴더에 두고 `--tools Read` 로 Claude 가 봄)도 받는다. 서버 쪽 첨부·규칙 반영에는 서버 재시작이 필요하다.
- 같은 서버가 **증빙 찾아오기**(`POST /fetch` …)도 한다 — 다른 웹 사이트에 가는 부분은 확장 코드와 섞지 않고 `site-fetch/` 폴더에 따로 둔다(서버는 `/fetch*` 경로만 넘김). 작업용 Chrome(별도 프로필 — 창은 화면 밖에서 돌고 추가 인증·남겨 둘 때만 화면에, `KRX_FETCH_SHOW=1` 이면 보임)을 띄우고 `claude -p` 를 임시 폴더에서 `--safe-mode --restricted --permission-mode dontAsk`(허용 = `node cdp.mjs …` · Read)로 돌리므로 이 저장소의 CLAUDE.md·Stop 훅은 돌지 않는다. 아이디·비밀번호는 Claude 에 보이지 않게 브라우저 손잡이(`site-fetch/cdp.mjs`)만 쓴다. `site-fetch/` 를 고치면 서버를 다시 띄워야 반영되고(사이트 안내 `site-fetch/sites/*.md` 는 다음 요청부터 바로), 확장 없이 시험하려면 `node site-fetch/run.js 요청.json`.
- Claude 의 작업 규칙은 `help-server/rules.md`: 커밋·푸시·되돌리기, 버전 올리기, R&D ERP·HR·eClass 에 쓰는 동작, 확장 다시 불러오기를 하지 않는다. 변경은 작업 트리에만 남으므로 확인 뒤 직접 커밋한다.
- 설정 페이지 › LLM 설정 › 자주 사용 가맹점의 **찾는 방법 익히기**도 같은 `/ask` 로 온다(글이 `[증빙 찾아오기 — 새 사이트 붙이기]` 로 시작). 그 요청은 **fetch-site 스킬**(`.claude/skills/fetch-site/SKILL.md`, 대화형에서 `/fetch-site`)의 절차대로 — `node site-fetch/run.js` 단독 실행으로만 시험하고 `site-fetch/sites/<이름>.md` 를 만들며, 마지막 답변에 `howto:` 줄(채팅이 그 가맹점의 "기억한 찾는 방법" 칸에 넣음)을 둔다. 시험 서류는 `site-fetch-out/`(git 제외). 서버의 `GET /fetch/skill` · `GET /fetch/guide?url=` 가 설정 페이지의 **스킬 복사** · **안내 복사**에 원문을 준다.
- 실서버 이상 동작을 Claude 가 직접 확인하려면 CDP 용 Chrome(KRS 프로필, `--remote-debugging-port=9333`)이 떠 있어야 한다. 없어도 코드 근거로 고친다.
- 작업 기록은 `help-server/logs/<id>.json`(최근 50개), 고정된 확장 출처와 대화 세션은 `help-server/.state.json` — 둘 다 git 에서 제외.
- 같은 서버가 **GitHub 새 커밋 확인·받기**(`GET /git` · `POST /git/pull`, `help-server/gitsync.js`, 2026-10-23)도 한다 — 패널 제목 줄의 **업데이트** 단추(`lib/gitsync.js`, 새 커밋이 있을 때만 보임)가 조회마다 묻고 누르면 `git pull --ff-only` 로 받는다(2026-10-23 사용자 "최신 깃이 올라오면 버튼이 생기고 누르면 브릿지 이용해서 업데이트"). 받은 것에 확장 파일이 있으면 단추가 ↻ 로 바뀌고 **사용자가 눌러야** 확장을 다시 불러온다(저절로 올리지 않음). 받은 것에 서버 파일(`help-server/`·`site-fetch/` 코드, 서버가 require 한 `lib/`)이 있으면 서버가 한가할 때 스스로 다시 뜬다(같은 명령을 떼어 띄우고 포트를 닫은 뒤 끝남 — 출력은 `help-server/logs/server.log`). 커밋·푸시는 하지 않는다. kr_ext_workspace 는 같은 기능을 네이티브 다리(`gitsync.js` · `native/gitsync.mjs`)로 이미 갖고 있다.
- `help-server/` 와 `popup/help.js` 는 이 창구 자체다. 깨지면 팝업에서 고쳐 달라고 할 수 없으니 고칠 때는 `node --check` 와 실제 요청으로 확인한다.
