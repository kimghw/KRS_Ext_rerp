/* 설정 기본값 / 로드 / 저장 */
(function (g) {
  const DEFAULTS = {
    eclassPanel: true,                // eClass 홈에 패널 표시 (끄면 툴바 아이콘 팝업으로만 봄. content/eclass.js)
    panelMode: 'inline',              // 'inline'(eClass 본문에 삽입) | 'float'(우측 상단 띄우기)
    actionPopup: false,               // 툴바 아이콘 클릭 시 열 곳: false 사이드 패널(기본, 0.8.5) | true 팝업 창 (같은 popup/popup.html, background.js applySidePanel → action.setPopup · sidePanel.setPanelBehavior)
    accountRule: true,                // 발급 카드의 계좌번호가 과제 계좌(지출계좌)와 같은 카드만 그 과제의 카드로 인정
    cardOverrides: {},                // { [과제번호]: { include: [카드숫자...], exclude: [카드숫자...] } } 계좌 규칙 재정의
    showShared: false,                // 어느 과제에도 귀속되지 않은(공용) 카드 내역 표시 여부
    cardFilterMode: 'all',            // 'all' | 'specific'
    selectedCards: [],                // 모니터링 카드 선택(숫자만, 전체 번호)
    cardFilterList: [],               // 직접 입력한 카드번호 뒷자리 목록 (예: "4126", "0478-4126")
    cardNames: {},                    // 카드 별명 { [카드번호 숫자(전체 또는 뒷자리)]: '별명' } - 패널에서 뒤 8자리 대신 표시
    monthsBack: 6,                    // 사용일자 조회 시작: N개월 전
    monthsForward: 1,                 // 사용일자 조회 종료: N개월 후
    hideZeroProjects: false,          // 미청구 0건 과제 숨김
    budgetItemInclude: {},            // 과제집행비율 비목별 포함 여부 { [비목명]: true(포함) | false(제외) } - 설정 페이지 목록에서 선택
    budgetExcludeDefault: ['인건비', '연구수당', '간접비'],   // 명시적으로 고르지 않은 비목의 기본값: 이름에 이 단어가 들어가면 제외, 아니면 포함
    projectStatusKeyword: '진행',     // 과제 진행상태명(PROG_STS_NM)에 이 문자열이 포함된 과제만 (비우면 전체)
    excludedProjects: [],             // 설정에서 제외한 과제번호 목록 (새 과제는 기본 포함)
    onlyMyProjects: true,             // 참여인력에 본인이 있는 과제만 (사번을 알 수 있을 때만 적용)
    myEmpNo: '',                      // 본인 학번/사번 (비우면 R&D ERP 방문 시 자동 감지값 사용)
    myName: '',                       // 본인 이름 (사번을 모를 때 참여인력 이름으로 대조. 동명이인이면 사번을 골라야 함)
    maxProjects: 30,                  // 조회할 과제 최대 수 (내 참여 과제만 보기를 끈 경우에만 적용. 참여 과제는 모두 표시)
    refreshMinutes: 10,               // 캐시 유지 / 자동 새로고침 주기(분)
    autoRefresh: true,
    rndUrl: 'https://rnd.krs.co.kr/rderp_layoutMain.act',
    rndAutoLogin: true,               // R&D ERP 세션이 풀려 조회가 "로그인 필요"로 끝나면 eClass SSO(loginCheck → sso_login_krs.jct → rderp_layoutMain.act)로 백그라운드에서 다시 로그인한 뒤 한 번 더 조회
                                      //   (background.js rndAutoLogin · lib/rnd-api.js ssoLogin). eClass 에 로그인돼 있어야 하고 탭은 열지 않음. eClass 도 풀려 있으면 "eClass 로그인 필요"로 안내
    prjPicker: true,                  // R&D ERP 과제 화면(과제정보·과제예산신청·참여인력신청·회의사전신청·청구서 등)의 과제책임자/과제명 칸 앞에 내 참여 과제 드롭다운 표시 (content/rnd-prjpick.js)
    plus: {                           // 공유 (Plus) — SharePoint(OneDrive) 의 공유 폴더 아래 **과제마다 폴더 하나**(이름: 별칭 → Job Id → rERP 과제번호)를 두고 그 안의 연차 파일(<n>차년도.json — 과제 정보·예산 줄·참여인력·연구내용·변경이력)과
                                      //   예상 비용 파일(예상비용.json — 연차에 걸치는 항목이 두 파일에 걸치지 않게 과제 폴더에 하나)을 같은 과제 사람들과 나누는 선택 기능 (0.8.7, 2026-10-18 사용자 지정 "onedrive 에 업무/shared 안에 과제별로 .. 약칭으로 없으면 jobid 없으면 임시번호 …
                                      //   년차별로 1개 파일이고 1개 파일에서 변경사항이랑 다 관리" · "참여연구원들에게 공유할 수 있게 설정까지" · "예상지출도 다 들어 가겠지? 이건 별도 파일에서 해도 되긴하는데").
                                      //   브라우저의 SharePoint 로그인 쿠키만 쓴다 — MCP 서버·Graph·Entra 로그인·원노트는 0.8.7 에서 모두 걷어 냄 ("mcp 없이 grph api 하지 않고 브라우저 토큰으로 하라고"). 저장소 접근 lib/sp-store.js · 문서 lib/prjdoc.js · 차례 lib/prjdoc-sync.js · 배선 background.js shareSync
      enabled: false,
      folder: '',                     // 밑폴더(base) 주소. 비우면 **내 OneDrive 의 문서/업무/shared**(KRX_SP.resolveMyFolder 가 driveHost 의 /_api/v2.0/me/drive 로 찾아 storage.local.shareFolder 에 캐시, 두 단 모두 없으면 만듦).
                                      //   동료 폴더(동료가 자동 공유해 준 것)는 보통 비워 두어도 "나와 공유" 에서 저절로 찾는다(discover). 팀 사이트나 동료의 base 를 직접 쓰려면 그 주소를 여기에. 받는 모양: 폴더 주소(https://<테넌트>-my.sharepoint.com/personal/<u>/Documents/업무/shared ·
                                      //   https://<테넌트>.sharepoint.com/sites/<x>/Shared Documents/<폴더>, 퍼센트 인코딩 가능) · 문서함 보기 주소(…/onedrive.aspx?id=… · …/Forms/AllItems.aspx?id=…) · 공유 링크(https://…sharepoint.com/:f:/… — redirect 를 따라가 id= 에서)
      driveHost: 'https://krclass-my.sharepoint.com',   // 내 OneDrive 를 찾는 호스트(folder 가 비었을 때) — 설정 페이지에 칸은 없고 기본값 그대로
      researchSync: true,             // 연구내용(연구개발계획서 기록) 공유 (0.8.7): 연차 파일의 research 칸과 기록 id(과제명 키#차년도)마다 — 판·넣은 시각이 새로운 쪽 (lib/research-sync.js merge)
      staffSync: true,                // 사업비(참여연구원 참여율·지급액 계획 · 예산 줄) 공유 (0.8.7): 연차 파일의 staff·budget 칸과 연차마다 — 수정 시각이 새로운 쪽, 지운 연차는 묘비로 (lib/staff-sync.js merge)
      planSync: true,                 // 예상 비용 공유: 패널·팝업을 열 때, 항목을 바꾼 4초 뒤, 자동 갱신 알람 때 (background.js shareSync). 예상비용.json 의 plan 칸과 항목 id 마다 — 마지막 수정 시각이 새로운 쪽, 삭제는 묘비 (lib/plan-sync.js merge)
      changesSync: true,              // 변경이력 공유 (0.8.7): 사업비 관리에서 예산 줄·참여인력·기간·별칭을 고칠 때 남기는 한 줄(storage.local.shareChanges — lib/staff-ui.js)을 연차 파일의 changes 칸과 — 덧붙이기만(id 합집합, 최대 500). KRS WORKSPACE 의 변경이력과 같은 모양
      discover: true,                 // 나와 공유된 과제 폴더 자동 찾기: 동기화 때 "나와 공유"(/_api/v2.0/me/drive/sharedWithMe) 의 폴더 가운데 내 참여 과제의 연차 파일이 든 것을 대상에 넣는다 — 동료가 자동 공유해 주면 주소를 받아 붙일 일이 없다
      shareWith: 'participants'       // 과제 폴더를 새로 만들 때 참여연구원에게 자동 공유(편집): 'participants' | 'none'. 참여인력(rtask_0008_t03_01_r001)의 이름을 사람 찾기로 풀어 폴더를 공유한다 — 동명이인(ambiguous)·못 찾은 이름(notFound)은 설정 페이지에서 직접
    },
                                      //   고르면 과제 검색 팝업 없이 바로 적용(rnd-hook.js prjPick), 돋보기 조회는 그대로. 메인화면에서 연 과제도 드롭다운·입력란(과제명)에 반영
    help: {                           // Help Chat — 툴바 팝업의 한 줄 요청을 이 PC 의 Help 서버(help-server/server.js)가 Claude Code CLI(Opus 5.5)로 처리해 확장 코드를 고침 (popup/help.js)
      enabled: true,                  // 끄면 팝업의 Help Chat 줄을 숨김
      url: 'http://127.0.0.1:8106',   // Help 서버 주소 (이 PC 만: localhost · 127.0.0.1). 서버 포트는 환경 변수 KRX_HELP_PORT
      autoPick: true,                 // 청구 준비 자동 분류 (0.8.5): 서버가 연결돼 있으면 Claude 가 청구종류와 첨부 파일 종류를 골라 줌 (lib/prep-ai.js → 서버 POST /classify). 사용자가 고른 값은 바꾸지 않음
      autoPtcl: true,                 // 자동 분류 때 청구내역(적요)이 비어 있으면 Claude 가 한 줄을 씀 — 첨부 파일 내용 + 과제 연구개발계획서(연구내용). 사용자가 적은 글은 바꾸지 않음 (autoPick 이 켜져 있어야 함)
      ptclGuide: '',                  // 청구내역 작성 안내 (Claude 에 그대로 줌, 300자 — 예: "[과제 약칭] 품목(기간) - 용도" 형식)
      api: {                          // Claude API (0.8.6, lib/claude-api.js): Anthropic API 키(storage.local.claudeApiKey — 이 settings 에는 넣지 않음)로 자동 분류·청구내역 작성을 api.anthropic.com 에 직접. Help Chat·찾아오기는 서버로만
        use: 'auto',                  //   'auto' Help 서버가 없거나 실패할 때만 · 'always' 늘 API · 'off' 안 씀
        model: 'claude-haiku-5-5'     //   서버의 빠른 모델(KRX_HELP_FAST_MODEL)과 같은 기본값. 설정 페이지에서 Sonnet 5.5 · Opus 5.5 도 고름
      },
      fetchDocs: {                    // 종류별 필요 서류 (증빙 찾아오기): 가맹점 등록의 종류(lib/fetch-sites.js KINDS)마다 갖춰야 할 첨부 서류 이름. 등록한 가맹점이 "종류 기본"이면 찾아오기가 이 서류를 찾고(이미 있는 종류는 빼고),
        lecture: ['강의내용', '견적서', '수강증'],   //   청구 준비 줄에 "필요 서류" 체크(첨부 파일 종류로 맞춤)를 보인다. 가맹점마다 따로 고를 수도 있음(fetchSites[].docs)
        subscription: ['거래명세서'],
        other: ['거래명세서']
      },
      fetch: true                     // 증빙 찾아오기 (0.8.5): 청구 준비 줄의 [찾아오기]·[자주 사용 등록] — "자주 사용" 가맹점 사이트에서 서버(POST /fetch → 저장소의 site-fetch/)가 Claude 로 거래명세서 등을 찾아 첨부 (lib/prep-fetch.js, 등록 목록은 storage.local.fetchSites)
    },
    claimHelper: {                    // R&D ERP 청구서(카드) 화면의 청구내역 폼 입력 도우미 (content/rnd-claim.js)
      enabled: true,                  // 끄면 아래 기능 모두 사용 안 함
      defaultBudget: '연구활동비',      // 예산(비목) 선택이 비어 있을 때 채울 항목명 (비우면 채우지 않음)
      defaultRcms: '본예산',            // RCMS 부가정보 > 사용금액구분이 비어 있을 때 채울 항목명 (비우면 채우지 않음)
      dragDrop: true,                 // 첨부문서 칸에 파일 드래그 앤 드롭
      meetingPlace: '부산광역시 강서구',   // 청구종류 회의비(17)일 때 RCMS 부가정보의 회의장소(도/시, 화면 필수값)가 비어 있으면 채울 지역 이름 (시/도 + 구/군, 비우면 채우지 않음)
      attachKinds: ['거래명세서', '견적서', '수강증', '강의내용', '수료증'],   // 청구 준비 첨부 파일(캡처·끌어다 놓은 파일·찾아온 서류)마다 고르는 "무슨 파일인지" 목록 (0.8.5). 증빙 찾아오기의 서류 이름(거래명세서·견적서·수강증·강의내용 — help.fetchDocs)과 맞춤. 고르면 파일 이름이 "<종류>_…" 로 바뀌어 그 이름으로 ERP 에 첨부됨 (lib/prep-store.js setFileKind). 비우면 고르는 칸을 숨김
      quickPicks: [                   // "청구" 소제목 옆 세목 빠른 선택 버튼: "표시이름=세목 목록의 항목명(또는 일부)=청구종류 코드(또는 이름)=종류(식비|다과)".
        '연구실 운영비=연구실운영비',   //   항목명을 생략하면 표시이름으로 찾고, 청구종류를 적으면 세목이 그 항목으로 바뀔 때 "(83) …" 처럼 코드가 맞는 청구종류를 고른다.
        '회의비=회의비=17',           //   넷째 값(식비|다과)은 회의록 팝업의 "회의비(식비) 청구여부"와 금액 칸(식비 A / 다과 B)을 정하고, 식비면 패널에 참석자 카드가 붙는다 (content/rnd-meeting.js)
        '식사비=회의비=17=식비',
        '다과비=회의비=17=다과',
        '클라우드 사용비=클라우드',
        '외부전문가 활용비=외부 전문기술=83',
        '소프트웨어 활용비=소프트웨어',
        '연구활동비 기타비용=기타비용'
      ]
    },
    hr: {                             // HR System(hr.krs.co.kr) 급여명세서 API 수집 → 패널 "급여·연구수당" 구역 (lib/hr-api.js, content/hr-pay.js)
      enabled: true,                  // 끄면 수집도 표시도 하지 않음
      url: 'https://eclass.krs.co.kr/eClassVer4/External/SSOMessage',   // 패널·팝업의 HR System 열기 링크, 자동 로그인 때 쓰는 주소.
                                      //   eClass 홈 메뉴 HR › Main Page 가 여는 SSO 중계 페이지("SSO Redirect")로, 인라인 JS 가 hr.krs.co.kr/sso-proc?UID&SID 로 이동해 HR 세션을 만든다.
                                      //   hr.krs.co.kr/ 를 직접 열면 로그아웃 상태에서는 SSO 없이 본문 없는 403 이라 자동 로그인이 안 됨 (2026-09-25 확인)
      autoLogin: true,                // 로그인이 풀려 있으면 위 주소로 SSO 자동 로그인 뒤 다시 읽기: 백그라운드에서 중계 페이지 → sso-proc 를 받아 보고, 안 되면 비활성 탭으로 열어 기다림 (background.js hrAutoLogin)
      baseItem: '기본연봉',            // 지급내역(소득명)에서 기본연봉 항목명
      researchItem: '연구수당지급',     // 지급내역(소득명)에서 연구수당 항목명 (올해 1월부터 합계)
      grade: '',                      // 직급 (P1~P4). 비우면 HR 직원 정보(gradeCode)에서 자동 감지한 값 사용
      gradeRates: { P1: 18, P2: 20, P3: 22, P4: 24 }   // 연구수당 한도(%) = 연 기본연봉(월 기본연봉 × 12) × 직급 비율
    },
    rcms: {                           // RCMS(www.rcms.go.kr, 범부처 연구비통합관리시스템) 열기 링크 + ID 로그인 자동 입력 (background.js openRcms · rcmsLogin, content/rcms.js)
      url: 'https://www.rcms.go.kr/index.do',   // 패널·팝업의 RCMS 열기 링크
      autoLogin: true                 // ID·비밀번호(설정 페이지에서 입력, storage.local.rcmsCred — 동기화되는 이 settings 에는 넣지 않음)가 있으면 로그인 화면의 ID 로그인 칸을 채우고,
                                      //   RCMS 열기로 연 탭에서는 로그아웃 상태일 때 로그인 화면으로 가서 로그인 버튼까지 한 번 누름. 2차 인증(SMS·인증앱)은 사용자가 직접
    },
    unapproved: {
      serviceId: 'rmain_0002_01_r006', // 미승인내역 건수 (메인화면 setPendingStatusCount 와 동일). refreshMinutes 마다 자동 갱신
      input: '{}',                    // 서비스 입력 JSON
      fields: { temp: 'TEMP_SAVE_CNT', supplement: 'SUPPLEMENT_CNT', apply: 'APPLY_CNT', purchase: 'BUY_REQ_CNT' }  // 응답 필드명
    },
    adv: {
      usefacSeqNo: '10',
      projectsService: 'rcomm_0009_01_r001',                              // 과제 검색 팝업(과제책임자/과제명)과 동일
      projectsInput: '{"SEARCH_NM":"","SEARCH_GB":"10","GUBUN":"A","PRJ_AUTH":""}',   // SEARCH_GB 진행상태 코드(10 진행, '' 전체 — 전체는 500건에서 잘림), PRJ_AUTH 과제권한(1 본인, 2 담당, 9 전체)
      projectsFallbackService: 'rmain_0005_01_r001',                      // 종료 90일 이내 진행과제 (대체 경로)
      cardsService: 'rtask_0008_t05_01_r001',
      cardsInput: '{"SEARCH_GB":"1","CARD_DATE_GBN":"1"}',
      issuedService: 'rtask_0008_t01_01_r002',  // 과제카드발급내역
      accountsService: 'rtask_0010_02_r003',    // 과제정보 > 기본정보 > 과제관리계좌
      expenseAcctDivCd: '',                     // 지출계좌 계좌구분 코드 (비우면 등록된 모든 계좌와 대조)
      participantsService: 'rtask_0008_t03_01_r001',            // 과제정보 > 참여인력
      participantsInput: '{"SEARCH_NM":"","SEARCH_GB":"1"}',    // 참여구분 0:전체 1:계속 2:종료
      budgetService: 'rcomm_0041_01_r004',                      // 과제정보 > 자금현황 > 비목별 잔액 (예산기준 10:과제예산)
      budgetInput: '{"REQ_CNT":"-1","RES_CD":"","PROC_TYP_CD":"","INCLUDE_TAX":"Y"}',  // RES_CD 비우면 전체 재원
      budgetBaseService: 'rcomm_0041_01_r006',                  // 예산기준 20:본예산 과제의 비목별 잔액 (BIZSECTION_CD, BGT_YEAR 필요)
      projectDetailService: 'rcomm_0102_01_r001'                // 과제 상세 (BGT_STD_CD 예산기준, BIZSECTION_CD, TOT_DIR_AMT/TOT_STD_AMT)
    }
  };
  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  /* 공유 폴더 칸의 값이 0.8.7 v1(2026-10-18 낮)의 기본 밑폴더 — 내 OneDrive 의 /personal/<u>/Documents/RERP — 주소인가. 폴더 주소와 문서함 보기 주소(onedrive.aspx?id=) 모두, 퍼센트 인코딩·끝 / 허용. 팀 사이트·다른 이름은 아님 */
  function isV1Base(folder) {
    const s = String(folder || '').trim();
    if (!s) return false;
    let u;
    try { u = new URL(s); } catch (e) { return false; }
    if (!/-my\.sharepoint\.com$/i.test(u.hostname)) return false;
    let p = /\.aspx$/i.test(u.pathname) ? (u.searchParams.get('id') || '') : u.pathname;
    try { p = decodeURIComponent(p); } catch (e) { /* 그대로 본다 */ }
    return /^\/personal\/[^/]+\/Documents\/RERP\/?$/i.test(p);
  }
  function merge(base, over) {
    const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    if (!isObj(over)) return out;
    for (const k of Object.keys(over)) {
      out[k] = (isObj(base[k]) && isObj(over[k])) ? merge(base[k], over[k]) : over[k];
    }
    return out;
  }
  /* 이전 버전 기본값이 저장돼 있으면 새 기본값으로 교체 */
  function migrate(s) {
    const adv = s.adv || {};
    if (adv.projectsService === 'rmain_0005_01_r001' && (adv.projectsInput || '') === '{"SEARCH_GB":"D"}') {
      adv.projectsService = DEFAULTS.adv.projectsService;
      adv.projectsInput = DEFAULTS.adv.projectsInput;
    }
    // 이전 기본값(진행상태 전체 조회)은 서버가 500건에서 잘라 진행 과제가 빠질 수 있어 진행(10)만 조회하는 새 기본값으로
    if ((adv.projectsInput || '') === '{"SEARCH_NM":"","SEARCH_GB":"","GUBUN":"A","PRJ_AUTH":""}') adv.projectsInput = DEFAULTS.adv.projectsInput;
    // 이전 버전의 제외 키워드 목록(budgetExcludeItems) → 기본 제외 키워드로 이전
    if (Array.isArray(s.budgetExcludeItems)) { s.budgetExcludeDefault = s.budgetExcludeItems; delete s.budgetExcludeItems; }
    // 미승인내역 서비스가 비어 있으면(이전 버전은 사용자가 직접 찾아 넣어야 했음) 기본 서비스로 채움
    if (!s.unapproved || !String(s.unapproved.serviceId || '').trim()) {
      s.unapproved = Object.assign({}, DEFAULTS.unapproved, { fields: Object.assign({}, DEFAULTS.unapproved.fields) });
    }
    // 0.8.1: 보완요청 클릭 링크(linkUrl, 기본값이 메인화면이라 보완요청 건으로 못 갔음)는 없앰 — 보완요청 결의서를 조회해 그 화면을 연다 (rnd-api fetchSupplements · render supplementLink)
    if (s.unapproved) delete s.unapproved.linkUrl;
    // 0.8.4 의 actionSidePanel(기본 꺼짐 = 팝업)은 0.8.5 에서 actionPopup(기본 꺼짐 = 사이드 패널)으로 바뀜 — 저장할 때 기본값까지 통째로 써서 false 가 남아 있을 수 있으므로 옮기지 않고 버린다
    delete s.actionSidePanel;
    // 0.8.7 공유 (Plus) 가 원노트에서 SharePoint 폴더의 과제별 JSON 파일로 바뀜 (2026-10-18) — 원노트·MCP·Entra 때의 설정은 조용히 버린다:
    //   0.8.0 개발 중의 sectionId/sectionLabel/planPageUrl · 0.8.0~0.8.6 의 onenoteMcpUrl/sectionName/notebookId/notebookLabel · 0.8.7 개발 중의 connect/graph. enabled 의 뜻("공유 (Plus)")과 planSync·researchSync·staffSync 는 그대로.
    //   folder 는 늘 문자열(다듬기는 쓰는 쪽), driveHost 는 비어 있으면 기본값. v2(과제별 폴더·연차 파일, 2026-10-18 저녁)의 shareWith 는 'participants' | 'none' 만, discover · changesSync 는 참/거짓(그 밖의 값은 기본값)
    if (s.plus) {
      for (const k of ['sectionId', 'sectionLabel', 'planPageUrl', 'connect', 'graph', 'onenoteMcpUrl', 'sectionName', 'notebookId', 'notebookLabel']) delete s.plus[k];
      s.plus.folder = typeof s.plus.folder === 'string' ? s.plus.folder : '';
      // v1(2026-10-18 낮, 문서/RERP 의 <과제번호>.json) 때 공유 폴더 칸에 내 OneDrive 의 문서/RERP 주소를 적어 두었으면 비운다(= 기본 문서/업무/shared) — v2 의 자동 발견(나와 공유)은 경로 끝이 shared · shared/<이름> 인 폴더만
      //   과제 폴더로 보므로 RERP 아래에 만든 과제 폴더는 참여연구원에게 자동 공유돼도 상대 쪽에서 영영 찾히지 않는다(2026-10-18 검토). 팀 사이트·다른 이름의 폴더는 사용자가 고른 것이라 그대로
      if (isV1Base(s.plus.folder)) s.plus.folder = '';
      if (typeof s.plus.driveHost !== 'string' || !s.plus.driveHost.trim()) s.plus.driveHost = DEFAULTS.plus.driveHost;
      if (!['participants', 'none'].includes(s.plus.shareWith)) s.plus.shareWith = DEFAULTS.plus.shareWith;
      for (const k of ['discover', 'changesSync']) if (typeof s.plus[k] !== 'boolean') s.plus[k] = DEFAULTS.plus[k];
    }
    // 0.8.5 개발 중의 첨부 파일 종류 기본값(교육내용)을 증빙 찾아오기 서류 이름(수강증·강의내용)에 맞춘 새 기본값으로 — 그대로 저장돼 있을 때만
    if (s.claimHelper && Array.isArray(s.claimHelper.attachKinds) && s.claimHelper.attachKinds.join('|') === '거래명세서|교육내용|수료증') s.claimHelper.attachKinds = DEFAULTS.claimHelper.attachKinds.slice();
    // 0.8.5 개발 중의 기본값(견적서 없음)이 그대로면 종류별 필요 서류(강의 = 강의내용·견적서·수강증)의 견적서를 고를 수 있게 새 기본값으로
    if (s.claimHelper && Array.isArray(s.claimHelper.attachKinds) && s.claimHelper.attachKinds.join('|') === '거래명세서|수강증|강의내용|수료증') s.claimHelper.attachKinds = DEFAULTS.claimHelper.attachKinds.slice();
    // 이전 기본값(HR 루트 주소)은 로그아웃 상태에서 403 이라 자동 로그인이 안 됨 → eClass SSO 중계 주소로
    if (s.hr && /^https?:\/\/hr\.krs\.co\.kr\/?$/i.test(String(s.hr.url || '').trim())) s.hr.url = DEFAULTS.hr.url;
    // 0.7.2: 회의비 세목 빠른 선택에 식사비(식비)·다과비(다과) 항목 추가 — 사용자가 목록을 바꿨더라도 회의비(17) 항목이 있고 종류(넷째 값) 항목이 하나도 없으면 그 뒤에 끼워 넣는다
    if (s.claimHelper && Array.isArray(s.claimHelper.quickPicks)) {
      const qp = s.claimHelper.quickPicks;
      const hasKind = qp.some((l) => /^[^=#]+=[^=]*=[^=]*=\s*(식비|다과)\s*$/.test(String(l || '')));
      const at = qp.findIndex((l) => /^[^=#]+=[^=]*=\s*17\s*$/.test(String(l || '')));
      if (!hasKind && at >= 0) qp.splice(at + 1, 0, '식사비=회의비=17=식비', '다과비=회의비=17=다과');
    }
    return s;
  }
  /* 저장된 설정 → 쓰는 설정: 기본값과 깊이 합친 뒤 migrate. 0.8.6 이하(원노트·MCP)·0.8.7 개발 중(Microsoft 로그인)의 plus 저장분은 migrate 가 옛 칸을 버리고 enabled·동기화 항목 체크만 이어받아
   * 공유 폴더(기본 내 OneDrive 의 문서/업무/shared 아래 과제별 폴더)로 간다. 테스트용으로 노출(KRX_SETTINGS.fromStored) */
  function fromStored(stored) {
    stored = isObj(stored) ? stored : {};
    const plus = isObj(stored.plus) ? stored.plus : {};
    stored = Object.assign({}, stored, { plus: Object.assign({}, plus) });   // plus 는 늘 새 객체로 — merge 가 깊이 합쳐 DEFAULTS.plus 를 그대로 돌려주지 않게 (migrate 가 s.plus 에 쓴다)
    return migrate(merge(DEFAULTS, stored));
  }
  async function load() {
    let stored = {};
    try { stored = (await chrome.storage.sync.get('settings')).settings || {}; }
    catch (e) { stored = (await chrome.storage.local.get('settings')).settings || {}; }
    return fromStored(stored);
  }
  async function save(s) {
    try { await chrome.storage.sync.set({ settings: s }); }
    catch (e) { await chrome.storage.local.set({ settings: s }); }
  }
  function parseJson(s, fallback) { try { return s ? JSON.parse(s) : (fallback || {}); } catch (e) { return fallback || {}; } }
  g.KRX_SETTINGS = { DEFAULTS, merge, migrate, fromStored, load, save, parseJson, isV1Base };
})(typeof self !== 'undefined' ? self : this);
