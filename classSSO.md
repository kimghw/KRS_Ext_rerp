# eClass SSO 인증 흐름 (R&D ERP · HR System)

이 확장이 R&D ERP(rnd.krs.co.kr)와 HR System(hr.krs.co.kr)의 로그인 세션을 어떻게 얻고, 풀렸을 때 어떻게 되살리는지 정리한 문서입니다. 기준 0.8.0 (2026-09-27).
요구사항은 [SPEC.md](SPEC.md) 8장(SSO-01~06)·9장(HR-07), 사용자 안내는 [README.md](README.md) "R&D ERP 자동 로그인 (eClass SSO)"·"급여·연구수당" 절에 있고, 이 문서는 두 곳에 흩어진 내용과 코드 위치를 한데 모은 것입니다.

## 1. 한눈에

- **eClass(eclass.krs.co.kr)가 유일한 신원 제공자**입니다. R&D ERP 와 HR 은 자체 계정으로 들어가는 것이 아니라 eClass 가 발급한 **UID + SID 한 쌍**을 받아 자기 세션을 만듭니다.
- 확장은 **비밀번호를 다루지 않습니다**. eClass 세션(쿠키)이 살아 있을 때만 그 뒤 두 시스템에 백그라운드로 다시 들어가고, eClass 세션까지 없으면 "eClass 로그인 필요"만 안내합니다.
- 세 도메인이 같은 사이트(krs.co.kr)라 SameSite 쿠키가 서로 흐르고, 확장 출처(chrome-extension://)에서 `fetch(credentials:'include')` 로 보내도 브라우저 탭과 같은 결과를 받습니다.
- 두 시스템의 **경로는 다릅니다**. HR 은 eClass 중계 페이지가 UID·SID 를 URL 에 실어 보내고(GET 한 번), R&D ERP 는 rERP 쪽 페이지가 eClass 에 되물어 받은 값을 POST 합니다(요청 세 번). 6장 비교표 참고.

## 2. 신원 제공자: eClass

- 자체 로그인은 `/eClassVer4/Account/Login` POST(UserId, Password, ReturnUrl, DeviceName, gcmRegId, chkSaveUid).
- 로그인 뒤 쿠키: `AUTH_TOKEN`, `KRS.OASIS.WEB.SITE.AUTH`(6h), `SID`·`UID`·`TWOFA_UID`·`EMAILAUTHCODE`(12h), 공용 `eclass_sid`·`eclass_uid`(.krs.co.kr, 12h), `DEVICE_AUTH`(1년).
- 기기 인증·2차 인증(TWOFA, 이메일 코드) 요소가 있으므로 확장이 eClass ID/PW 를 저장하거나 자동 입력하면 안 됩니다(SPEC `CMN-11`).
- 세션 없이 홈이나 SSOMessage 를 열면 302 → `/eClassVer4/Account/Logout` → Login 으로 갑니다.

## 3. 넘어가는 값: UID + SID

| 항목 | 내용 |
|---|---|
| UID | 암호화된 사용자 ID. R&D ERP 에 주는 값은 30자, HR 에 주는 값은 36자로 서로 다름 |
| SID | eClass 세션 GUID 36자 |
| 발급 엔드포인트 (R&D ERP 용) | `https://eclass.krs.co.kr/intra/intranet/Main_N/json/loginCheck_json.aspx?callback=cb` → JSONP `cb({"UID":"…","SID":"…"})`. 로그아웃 상태면 빈 문자열(33바이트) |
| 발급 방식 (HR 용) | eClass 중계 페이지 `/eClassVer4/External/SSOMessage` 의 인라인 JS 에 `hr.krs.co.kr/sso-proc?UID=…&SID=…` 주소가 박혀 나옴 |
| 서버 쪽 검증 | R&D ERP·HR 이 받은 UID·SID 를 eClass 에 어떻게 검증하는지는 밖에서 관찰할 수 없음 |

다른 eClass SSO(`intraMenu.OpenSSOLink`: ITHELP/UAS/Invoice 등)도 페이지 data 속성 `user_encrypt_Id`·`user_sid` 로 `?uid=&sid=` URL 을 여는 같은 체계입니다.

## 4. R&D ERP 경로

### 4.1 브라우저가 실제로 하는 일 (2026-09-26 CDP 로 추적)

eClass 홈의 앱 아이콘 "rERP"(`<span data-app="MAP00046" data-sso="N" data-link-url="https://rnd.krs.co.kr/jsp/rderp/main/sso_login_krs_view.jsp">`)를 클릭하면 main-common.js 의 `mainCommon.rERP` 가 `?SSO_PAGE_GB=A` 를 붙여 창 이름 `SSO_RESULT` 로 엽니다. 그 페이지(제목 "SSO RESULT", 세션 없이도 200 + 새 JSESSIONID)의 `fn_init` 이:

1. JSONP GET `loginCheck_json.aspx` → UID·SID. 둘 중 하나라도 비면 alert 뒤 `https://eclass.krs.co.kr/newcheckmember/login.aspx` 로 이동.
2. `#UID`/`#SID`/`#SSO_PAGE_GB=A` 를 채우고 `jex.web.doSubmit("frm1")` → 폼(`type="ajax" action="sso_login_krs" callback="doAjax"`)을 `_trxAjax` 가 **`sso_login_krs.jct`** 에 `_JSON_` POST → 응답 JSON `{ URL, COMMON_HEAD }` 와 함께 새 JSESSIONID 발급.
3. `dat.URL`(`rderp_layoutMain.act`)로 폼 frm(`SYS_LOGIN=Y`, `SSO_PAGE_GB=A`)을 POST → JSESSIONID 가 로그인 상태가 됨.

R&D ERP 자체 로그인 화면(`main_0001_08.act`, `USER_NM`·`USER_PW`, LOGIN_GB=1)은 별개 계정 체계라 쓰지 않습니다.

### 4.2 확장의 재현: `KRX_API.ssoLogin` ([lib/rnd-api.js](lib/rnd-api.js))

| # | 요청 | 비고 |
|---|---|---|
| 1 | GET `loginCheck_json.aspx?callback=cb&_=…` | 정규식으로 UID·SID 추출. 비면 kind `eclass-login` 으로 throw |
| 2 | POST `https://rnd.krs.co.kr/jsp/rderp/main/sso_login_krs.jct` body `_JSON_=enc(enc({UID,SID,SSO_PAGE_GB:"A"}))` | 공용 `call()` 사용(이중 인코딩·EUC-KR 디코딩 포함). **반드시 `.jct`** — `.act` 로 보내면 JSON 이 아니라 view 페이지 HTML 이 돌아옴. 응답에 `URL` 이 없으면 kind `sso` |
| 3 | POST 응답 `URL`(`rderp_layoutMain.act`) body `SYS_LOGIN=Y&SSO_PAGE_GB=A` | 응답(레이아웃 HTML)은 읽지 않고 버림. 2xx 가 아니면 kind `sso` |

- 세 요청 모두 `fetch(credentials:'include', cache:'no-store', redirect:'follow')`. 탭을 열지 않고 0.5초 안팎에 끝납니다.
- R&D ERP 는 Referer·Origin 을 보지 않아 확장 출처에서 그대로 통합니다.
- 새 JSESSIONID 는 브라우저 쿠키 저장소에 들어가므로 열려 있는 ERP 탭도 함께 살아납니다.
- 반환 `{ ok:true, url }`. 실패는 kind `eclass-login`(eClass 세션 없음) | `network` | `sso`(응답 이상) | `call` 의 `login`/`service`(COMMON_HEAD 오류·HTML) 로 throw.
- 상수는 바로 위 `SSO` 객체: `loginCheck` 주소, `dir: 'jsp/rderp/main'`, `pageGb: 'A'`.

### 4.3 호출 시점: `rndAutoLogin` ([background.js](background.js))

- 모든 조회(알람·패널/팝업 열기·↻)에서 `KRX_API.collect` 결과가 `loginRequired` 이고 설정 `rndAutoLogin !== false` 이면 `rndAutoLogin()` 을 한 번 부르고, 성공하면 collect 를 한 번 더 한 뒤 결과에 `autoLogin:{ ok:true, ts, ms }` 를 붙입니다.
- 실패하면 `autoLogin:{ ok:false, ts, kind, error }` 를 붙이고, kind 가 `eclass-login` 이면 `eclassLogin:true` 도 기록합니다.
- 동시에 여러 조회가 겹쳐도 `rndSsoInflight` 로 SSO 는 한 번만 실행됩니다.
- "로그인 필요"로 끝난 캐시는 `RND_SSO_RETRY_MS`(60초) 뒤부터 TTL 과 무관하게 다시 조회합니다. eClass 에 로그인하고 돌아오면 다음 패널 열기나 알람에서 SSO 로 이어집니다(실패해도 요청 2개라 가볍습니다).
- 설정 페이지의 **R&D ERP 자동 로그인 지금 시도** 버튼(`#btnRndSso` → 메시지 `rndSsoLogin`)은 SSO 만 실행해 소요 시간을 보인 뒤 캐시를 무시하고 다시 조회합니다.

### 4.4 "로그인 필요" 판정 (`call`, [lib/rnd-api.js](lib/rnd-api.js))

- 응답 content-type 이 JSON 이 아니고 HTML 이면 kind `login`("로그인 페이지가 반환되었습니다").
- `COMMON_HEAD.ERROR` 이고 CODE 가 `GWM0001`("사용자 정보가 존재하지 않습니다") 또는 메시지에 세션/로그인/사용자 정보가 들어 있으면 kind `login`, 그 외는 `service`.
- `collect` 는 하위 조회 어디서든 kind `login` 을 만나면 `loginRequired:true` 로 모아 돌려줍니다.

## 5. HR System 경로

### 5.1 브라우저가 실제로 하는 일

eClass 홈 메뉴 **HR › Main Page** 는 href 없이 `onclick="openNewWindow('…/eClassVer4/External/SSOMessage')"` 로 중계 페이지(제목 "SSO Redirect", eClass 세션 필요, GET)를 엽니다. 그 페이지의 인라인 JS 가 `https://hr.krs.co.kr/sso-proc?UID=…&SID=…` 로 이동하면 HR 이 `JSESSIONID`·`X-AUTH-TOKEN` 을 발급합니다.

`hr.krs.co.kr/` 를 직접 열면 로그아웃 상태에서는 SSO 로 넘어가지 않고 **본문 없는 403**(Chrome 오류 페이지)만 옵니다(2026-09-25 확인). 그래서 설정 `hr.url` 의 기본값을 중계 주소로 바꿨고, 이전 기본값(HR 루트)은 `KRX_SETTINGS` 마이그레이션(SPEC `MIG-05`)으로 자동 이전합니다.

### 5.2 확장의 재현: `hrAutoLogin(hrUrl, tryCollect)` ([background.js](background.js))

1. `hrUrl` 이 중계 주소(`KRX_HR_API.isSsoBridge`)면 백그라운드에서 `fetchHrSsoUrl` 로 중계 페이지를 받아 `KRX_HR_API.SSO_PROC_RE` 로 sso-proc 주소를 뽑습니다. 없으면(eClass 로그인 페이지 등) kind `eclass-login` 으로 끝내고 탭을 열지 않습니다. 네트워크 오류는 3단계 탭으로 넘어갑니다.
2. sso-proc 를 `fetch(credentials:'include', redirect:'follow')` 한 뒤 바로 `tryCollect()` 를 해 봅니다. 되면 `autoLogin:'fetch'` 로 끝(탭 없음).
3. 안 되면 `hrUrl` 을 **비활성 탭**으로 열고(이미 HR 탭이 있으면 그 탭을 그 주소로 이동) `hr.krs.co.kr` 로 돌아와 로딩이 끝나면 1.5초 뒤부터 2초 간격으로 `tryCollect`, 최대 `HR_AUTO_LOGIN_MS`(30초). 되면 `autoLogin:'tab'` 로 끝내고 만든 탭은 닫습니다. 안 되면 `{ ok:false, kind, error, tabOpened:true }`.

- HR 쪽 로그인 필요 판정([lib/hr-api.js](lib/hr-api.js) `getJson`): `/hrm_admin/login` 으로 리다이렉트되거나 401/403/419 이면 kind `login`.
- 호출 시점: `collectHr` 에서 첫 `tryCollect` 가 kind `login` 이고 설정 `hr.autoLogin !== false` 일 때. 결과는 `storage.local.hrPay.status` 에 `loginRequired`/`eclassLogin`/`tabOpened`/`autoLogin` 으로 기록됩니다.
- HR API 자체는 Referer 를 검사하므로 확장은 DNR 동적 규칙(id 9101)으로 이 확장이 보낸 hr.krs.co.kr 요청의 Referer 를 바꿔 호출합니다(SPEC `HR-03`). SSO 진입 자체(sso-proc)에는 필요 없습니다.

## 6. 두 경로 비교

| | R&D ERP | HR System |
|---|---|---|
| UID·SID 를 얻는 쪽 | rERP 쪽 페이지가 eClass 에 되물음(loginCheck JSONP) | eClass 중계 페이지가 URL 에 실어 보냄 |
| 요청 수 | 3 (GET loginCheck → POST .jct → POST layoutMain) | 2 (GET 중계 페이지 → GET sso-proc) |
| UID 길이 | 30자 | 36자 |
| 세션 쿠키 | `JSESSIONID` | `JSESSIONID`·`X-AUTH-TOKEN` |
| 확장 재현 | 백그라운드 fetch 만 | 백그라운드 fetch → 안 되면 비활성 탭 |
| 세션 수명 | 브라우저 세션 + 서버 유휴(확장의 주기 조회가 연장) | 유휴 만료(주기 호출 없음) |
| Referer/Origin | 보지 않음 | API 는 Referer 검사(DNR 규칙 9101), SSO 진입은 무관 |
| 실패 종류 | `eclass-login` / `network` / `sso` / `login` / `service` | `eclass-login` / `login` / `network` / 기타 |

## 7. 사용자에게 보이는 것

- **패널·팝업**([lib/render.js](lib/render.js)): `loginRequired` 이면 "R&D ERP 로그인 필요" 칩. `eclassLogin` 이면 "eClass 로그인이 풀려 자동 로그인(SSO)을 못 했습니다. eClass 에 다시 로그인하면 다음 조회 때 R&D ERP 에 자동으로 로그인합니다". `autoLogin.ok:false` 면 실패 이유와 함께 "eClass 의 R&D ERP 메뉴를 클릭해서 로그인" 안내, `ok:true` 인데 여전히 로그인 필요면 그 사실을 안내. HR 은 `hrPay.status` 로 같은 방식.
- **배지 툴팁**([background.js](background.js) `updateBadge`): "로그인 필요 (자동 로그인 실패: …)".
- **설정 페이지**([options/options.html](options/options.html)): `rndAutoLogin` 체크박스, **R&D ERP 자동 로그인 지금 시도** 버튼과 상태 문구, HR 의 `hrAutoLogin` 체크박스, **HR 탭에서 지금 수집** 결과에 자동 로그인 경로(백그라운드 SSO / SSO 탭) 표시.
- **eClass 콘텐츠 스크립트**([content/eclass.js](content/eclass.js)): 홈 화면에서 `rnd.krs.co.kr` 링크와 `SSOMessage` onclick 을 찾아 패널의 R&D ERP·HR 열기 링크로 씁니다(`PGMID` 가 붙은 것은 HR 하위 화면이라 제외).

## 8. 설정 항목 ([lib/settings.js](lib/settings.js))

| 키 | 기본값 | 뜻 |
|---|---|---|
| `rndAutoLogin` | `true` | R&D ERP 세션이 풀리면 eClass SSO 로 백그라운드 재로그인 |
| `hr.url` | `https://eclass.krs.co.kr/eClassVer4/External/SSOMessage` | HR System 열기 링크 겸 자동 로그인 중계 주소 |
| `hr.autoLogin` | `true` | HR 세션이 풀리면 위 주소로 자동 로그인 |

## 9. 원칙·제약

- `CMN-11` 비밀번호는 저장·전송하지 않습니다. UID·SID 는 메모리에서만 쓰고 저장하지 않습니다. eClass·HR 자체 로그인 페이지는 건드리지 않습니다.
- `CMN-31` 로그인 필요이면 자동 로그인을 한 번 시도한 뒤 재조회하고, 꺼져 있거나 실패하면 안내만 합니다.
- `CMN-32` R&D ERP 주소를 직접 열면 세션이 만들어지지 않습니다(eClass SSO 경로만 유효).
- eClass 세션이 없으면 자동화하지 않고 안내만 합니다(2차 인증·기기 인증을 우회하지 않음).
- `host_permissions` 에 세 도메인(rnd·eclass·hr)이 모두 있어야 합니다([manifest.json](manifest.json)).

## 10. 코드 위치 (0.8.0 기준, 행 번호는 바뀔 수 있음)

| 무엇 | 어디 |
|---|---|
| R&D ERP SSO 상수 `SSO`·`ssoLogin` | [lib/rnd-api.js](lib/rnd-api.js) 약 1016–1046행 |
| 로그인 판정 `call` | [lib/rnd-api.js](lib/rnd-api.js) 약 10–40행 |
| `rndAutoLogin`·`RND_SSO_RETRY_MS`·`rndSsoInflight` | [background.js](background.js) 약 51–63행 |
| 조회 흐름에서의 SSO 연동(`retryLogin`, `autoLogin` 기록) | [background.js](background.js) 약 80–87행 |
| `rndSsoLogin` 메시지 처리 | [background.js](background.js) 약 627행 |
| HR SSO 상수 `SSO_URL`·`SSO_PROC_RE`·`isSsoBridge` | [lib/hr-api.js](lib/hr-api.js) 16–20행 |
| HR 로그인 판정 `getJson` | [lib/hr-api.js](lib/hr-api.js) 약 30–40행 |
| `HR_AUTO_LOGIN_MS`·`fetchHrSsoUrl`·`hrAutoLogin` | [background.js](background.js) 약 383–430행 |
| `collectHr` 의 자동 로그인 연동 | [background.js](background.js) 약 458행 |
| 설정 기본값·`hr.url` 마이그레이션 | [lib/settings.js](lib/settings.js) 27, 56–59, 113행 |
| 설정 페이지 UI·버튼 처리 | [options/options.html](options/options.html) 117–118행, [options/options.js](options/options.js) 376, 394, 644–657, 665–667행 |
| 패널 문구 | [lib/render.js](lib/render.js) 8–19, 71–73, 381–383행 |
| eClass 홈 링크 탐지 | [content/eclass.js](content/eclass.js) 79–91행 |
| 요구사항 | [SPEC.md](SPEC.md) 8장 `SSO-01~06`, 9장 `HR-07`, `CMN-11/31/32`, `MIG-05` |
| 사용자 안내 | [README.md](README.md) "R&D ERP 자동 로그인 (eClass SSO)", "급여·연구수당 (HR System 급여명세서)" |

## 11. 확인된 것과 미확인

**확인** (2026-09-25~26, CDP·curl)

- `loginCheck_json.aspx` 는 확장 출처에서 credentials include 로 받아도 같은 값이 오고 Referer 가 필요 없습니다.
- R&D ERP SSO 의 POST 경로는 `sso_login_krs.jct` 입니다(`.act` 는 HTML). Origin·Referer 검사가 없습니다.
- HR 루트를 직접 열면 로그아웃 상태에서 403. `SSOMessage` → `sso-proc` 가 실제 진입 경로입니다.
- 0.7.1 `hrAutoLogin`, 0.7.2 `rndAutoLogin` 이 탭 없이 성공하는 것을 CDP 로 확인했습니다.

**미확인**

- eClass 2차 인증(TWOFA/EMAILAUTHCODE)이 실제로 뜨는 시점과 그때 `loginCheck` 가 무엇을 돌려주는지.
- R&D ERP·HR 서버가 UID·SID 를 eClass 에 검증하는 방식(밖에서 관찰 불가).
- HR 세션의 유휴 만료 시간.

다이어그램: [eClass SSO 인증 흐름](https://claude.ai/artifact/AKcScNXeMz5PTJdJ9MDDAk)
