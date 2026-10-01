# KR eClass + R&D ERP 현황 (Chrome 확장, MV3)

- 파일별 역할은 README.md 의 "구조" 절, 기능 사양은 SPEC.md, eClass SSO 경로는 classSSO.md.
- 빌드 단계 없음: 이 폴더를 `chrome://extensions` 에서 "압축해제된 확장"으로 로드해 쓴다. 테스트는 `node tests/<파일>.test.js`.
- 동작이 바뀌면 README.md(해당 절이 있으면 SPEC.md 도)를 같이 고친다.

## Help Chat (help-server) 을 쓸 때 필요한 것

툴바 팝업의 Help Chat 줄은 이 PC 에서 도는 `help-server/server.js` 가 있어야 동작한다. 서버가 요청을 받아 Claude Code CLI 를 이 폴더에서 헤드리스로 실행한다.

### 설치해 둘 것 (한 번)

| 필요한 것 | 조건 | 확인 |
| --- | --- | --- |
| Node.js | 18 이상. `npm install` 은 필요 없음(의존 패키지 없음) | `node --version` |
| Claude Code CLI | **2.1.280 이상** — 그보다 낮으면 기본 모델 `claude-opus-5-5` 를 거절한다. `PATH` 의 `claude` 또는 `%USERPROFILE%\.local\bin\claude.exe` | `claude --version`, 낮으면 `claude update` |
| Claude 로그인 | Opus 5.5 를 쓸 수 있는 계정으로 CLI 에 로그인돼 있어야 함 | `claude` 실행 후 `/login` |
| git | `PATH` 에 있어야 함 — 바뀐 파일을 `git status` 로 찾는다. 없으면 "적용" 버튼이 나오지 않음 | `git --version` |
| 확장 | 이 폴더(`E:\dev\kr_ext_rerp`)에서 로드한 압축해제된 확장 — 서버가 고치는 파일이 곧 확장이 읽는 파일이어야 함 | `chrome://extensions` 의 경로 |

### 쓸 때마다

```
node help-server/server.js
```

- 터미널을 열어 둔 동안만 동작한다(`127.0.0.1:8106`). **Claude 에 로그인한 Windows 사용자 계정으로** 실행해야 한다 — SYSTEM 계정의 Windows 서비스로 돌리면 로그인 정보가 없어 실패한다.
- 확인: 설정 페이지 › Help Chat › **연결 확인**, 또는 `curl http://127.0.0.1:8106/health`.
- 포트 8106 은 `/port_manager` 대장에 `kr_ext_rerp` 로 등록돼 있다.

### 환경 변수 (선택)

`KRX_HELP_PORT`(8106 — 바꾸면 설정 페이지의 Help 서버 주소도 맞출 것) · `KRX_HELP_MODEL`(claude-opus-5-5) · `KRX_HELP_CLAUDE`(claude 실행 파일 경로) · `KRX_HELP_PERMISSION`(acceptEdits) · `KRX_HELP_TIMEOUT_MIN`(30) · `KRX_HELP_EXT_ID`(허용할 확장 id)

### 안 될 때

| 팝업에 보이는 것 | 원인 → 조치 |
| --- | --- |
| Help 서버에 연결할 수 없습니다 | 서버가 안 떠 있음 → `node help-server/server.js` |
| `does not support this model … 2.1.280 or newer` | CLI 가 낮음 → `claude update` 후 서버 다시 실행 |
| 실패 — 로그인/인증 오류 | CLI 로그인이 풀림 → `claude` 실행 후 `/login` |
| 다른 확장(…)에 연결돼 있습니다 (403) | 확장 id 가 바뀜(다른 폴더·다른 프로필에서 로드) → `help-server/.state.json` 의 `origin` 을 지우고 다시 요청 |
| 포트 8106 을 이미 쓰고 있습니다 (서버 콘솔) | 서버가 이미 떠 있거나 다른 프로그램이 사용 → 기존 것을 쓰거나 `KRX_HELP_PORT` |
| 완료인데 "적용" 버튼이 없음 | 확장 파일이 안 바뀜(문서·테스트만) 또는 문법 오류로 보류 — 상태 줄을 눌러 로그 확인 |

### 알아 둘 것

- Claude 의 작업 규칙은 `help-server/rules.md`: 커밋·푸시·되돌리기, 버전 올리기, R&D ERP·HR·eClass 에 쓰는 동작, 확장 다시 불러오기를 하지 않는다. 변경은 작업 트리에만 남으므로 확인 뒤 직접 커밋한다.
- 실서버 이상 동작을 Claude 가 직접 확인하려면 CDP 용 Chrome(KRS 프로필, `--remote-debugging-port=9333`)이 떠 있어야 한다. 없어도 코드 근거로 고친다.
- 작업 기록은 `help-server/logs/<id>.json`(최근 50개), 고정된 확장 출처와 대화 세션은 `help-server/.state.json` — 둘 다 git 에서 제외.
- `help-server/` 와 `popup/help.js` 는 이 창구 자체다. 깨지면 팝업에서 고쳐 달라고 할 수 없으니 고칠 때는 `node --check` 와 실제 요청으로 확인한다.
