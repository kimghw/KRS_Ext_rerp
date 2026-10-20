/* 사업비 관리 화면 (0.8.7, 2026-10-18) — 제목 줄(↻·설정 옆)의 사업비 관리 아이콘(render.js, data-act="st-page")으로 여는 본문 화면(state.page = 'staff'). eClass 콘텐츠스크립트 / 팝업 공용. kr_ext_workspace R&D 탭과 같은 꼴(2026-10-18 사용자 지정 "여기서는 과제 별로, 년차 별로 … workspace 같이 디자인").
 * 모양: 과제 칩(별칭 — 없으면 과제명 앞부분) → 과제 카드(이름 · 과제번호 · 책임자 · 과제 정보 링크, 연차 칩(현재 연차에 "현재", 계획이 있으면 인원 배지, 고치기 화면에는 ＋ 다음 연차), 기간 줄)
 *   → **예산** 카드(비목마다 계획 · 집행 · 잔액 — 집행은 R&D ERP 승인액(현재 연차)에 "집행에 더하기"의 미청구·사용계획(예상 비용)을 더한 것, 줄 아래 막대, 합계, ＋ 비목 · 기본값으로, rERP 자금현황 줄)
 *   → **참여인력** 카드(참여연구원 참여율·지급액 계획 — lib/staff.js) → **변경이력** 카드(접힘 — 그 연차의 변경 한 줄들, 날짜 역순. KRS WORKSPACE 가 연차 파일에 적은 것도 보임). 카드 머리를 누르면 접고 편다.
 *   참여연구원 변경 탭(section({ only:'staff' }) — 패널 카드의 단추가 연 브라우저 탭)은 제목 줄(참여연구원 변경 · 별칭 · 과제 정보 링크) → 연차 칩 → 참여인력 카드만(과제 카드·기간 칸·요약 세 칸 없음 — 2026-10-19 사용자 "너무 공간을 많이 차지함").
 * - 변경이력(0.8.7 v2, 2026-10-18 저녁 사용자 지정 "년차별로 1개 파일이고 1개 파일에서 변경사항이랑 다 관리"): 예산 줄(이름·계획 바꿈·더하기·빼기·기본값으로) · 참여인력(초기화·더하기·✎ 반영·칸 편집·×·연차 지우기) · 기간(첫 달·마지막 달) · 별칭을 고칠 때마다
 *   storage.local.shareChanges['과제번호@연차'] 에 { id, date(YYYY-MM-DD), kind, item, before, after, reason:'', by, at, auto:false } 를 덧붙인다(최대 500, id 합집합 — appendChanges). kind·item·before·after·reason·auto 는 kr_ext_workspace 변경이력(src/rnd.js CHANGE_KINDS = 예산·연구내용·연구기간·연구진·기타, budgetChanges·projectChanges)과 같은 이름 —
 *   공유 (Plus) 가 켜져 있으면 background.js shareSync 가 연차 파일(<n>차년도.json)의 changes 칸과 합집합으로 맞춘다(덧붙이기만). 사람 표의 칸 편집은 commit 에서 한 번만 남긴다.
 * - 과제 카드의 **공유** 줄(공유 (Plus) 가 켜져 있을 때만): 과제 폴더 이름 · [폴더 열기] · [참여연구원에게 공유](shareFolderPeople — 결과: 공유 n명 · 이름 겹침 n · 못 찾음 n) · [링크 복사](shareOrgLink — 조직 내 편집 링크) · [주소 복사](shareFolderCopy prjNo). 폴더를 아직 모르면 [지금 동기화].
 *   읽는 것은 storage.local.staffSyncState(= shareState).pages[prjNo] 의 folder · folderUrl · owner · share · webUrl(현재 연차 파일) · noFolder.
 * - 구역 스위치에는 없다. 2026-10-18 사용자 지정 차례: "사업비 변경은 여기(제목 줄 ↻·설정 옆) 메뉴로 넣어줘, 우선 각 과제별로 년차별로 수정할 수 있게" → "사업비 관리는 저기 사업비 변경 부분에서 관리하면 되서 (구역 스위치의 사업비) 메뉴는 필요 없어" → "사업비 변경을 사업비 관리 아이콘으로".
 * - 계획은 과제마다 **연차별**(키 "과제번호@연차", lib/staff.js planKey — 기간 from·to · 예산 줄 budget[{ name, plan }] · 사람들 people). 연차의 기본 기간은 R&D ERP 현재 연차에서 12달씩(yearSpan). 연차 없는 옛 계획은 adopt 가 현재 연차로.
 * - 예산 줄의 기본값(아직 안 적었을 때): 현재 연차는 R&D ERP 자금현황의 비목·예산액, 다른 연차는 그 차년도 연구개발계획서(lib/research.js 기록 budget)의 비목별 예산, 그것도 없으면 비목 이름만(현재 연차 비목 또는 여섯 비목). 인건비 줄의 계획이 참여인력 칸의 인건비 예산.
 * 계산(lib/staff.js KRX_STAFF — 월별 나누기 · 연간/월 최대 참여율 · 적용일부터 변경(날짜까지, 달 중간은 날 수 비율) · 기간 구간(runs — 구간마다 한 줄) · 이전 기간 비율로 초기화 · 100% 알림 · 예산 대비 초과금/부족금)은 KRS WORKSPACE 의 참여인력 칸이 하던 것을 옮긴 것이다 — WORKSPACE 는 rERP 등록값을 보이기만 한다.
 *   2026-10-19 사용자 지정: "참여인력을 날일까지 계산해서 수정할 수 있게" · "참여율 변경하면 초과금, 부족금 이게 표시가 되어야지" · "12월 참여율을 변경 했는데 … 참여 기간 별로 표기 … 2줄로" — 그래서 합이 예산을 넘는 편집을 막던 것은 빼고 머리·알림·메시지에 초과금(빨강)·부족금을 보인다.
 *   2026-10-19 저녁 사용자 지정(탭 스크린샷): "칸 줄이 안맞음 … M 은 그냥 두고 1월부터 12월까지 일정 간격으로 금액을" → 달마다의 지급은 1~12월 고정 칸 격자(monthGrid); "적용일은 올해인 경우 다음달 1일, 종료일은 올해 마지막 날을 기본값으로 … 다음 변경/추가되는 사람의 적용일, 종료일은 이전 사람의 변경된 날짜를 동일하게" → defaultRange + state.staffLastRange;
 *   "1명 삭감하고 1명, 2명, 3명 추가될 때 100% … 50% … 숫자를 넣어서 지급금액을 자동계산" → 폼의 구분 "나머지의 %"(처음 이름 부족금의 % — S.applyShare). 참여율로 바꿀 때의 월 금액은 rERP 식 round천원(월급여 × %)(S.amountOfRate).
 *   "나머지를 추가해서 현재 남은 금액을 모두 평균해서 반영하는 버튼 … 초과금에 맞춰서 줄이거나, 부족금 만큼 늘리거나" → (회의실 현황 스크린샷) "기준 금액에서 증액, 감소를 10% 간격으로 증가감소 드래그로 선택 … 마지막 우측에는 인건비 예산에 맞추어주는 기능"
 *   → 폼 아래 증감 줄(quickRow — ✎ 폼은 [제외 −100%] [−50%]…[기준]…[+50%] S.scaleRange, ＋ 폼·빈 달은 나머지 [10%]…[100%] S.applyShare, [−1%] [+1%], 맨 오른쪽 [예산에 맞추기] S.fitBudget · [MAX — 최대 참여율(예산 나머지 · 100% 규칙)] S.maxRate · [균등 — 달마다 같은 금액] S.evenRange);
 *   (폼 스크린샷) "반영/취소는 적용일, 종료일, 참여율 이거랑 1줄로 … 드래그로 선택하고 나면 반영 누를 때까지 기다려 … 50% 우측에는 금액을 1%씩 증감할 수 있는 버튼 2개" → 끌기·누름은 고르기만(draft.step), 반영 단추가 적용, 폼은 한 줄;
 *   "여기 월평균 참여율 들어가야하고... 소숫점 3자리 내림 … 10%를 초과해야함" → 성명 밑 작은 글에 월평균(S.floorRate — 셋째 자리 내림), 10% 이하면 빨강 + 알림 low.
 *   2026-10-20 사용자(2차년도 탭 스크린샷) "2차년도에는 일단 이전 차년도 정보 가져오기 넣어주고, 연구원, 월급, 참여율 정도 가져오면 되겠지? 기간은 전체, 그리고 드래그 말고 전체 참여개월 선택하는 기능도"
 *   → 2차년도부터 단추 줄 맨 앞에 [n−1차년도에서 가져오기](carryFrom — S.carryOver: 앞 연차 계획, 없으면 그 기간의 rERP 등록 지급계획에서 성명·역할·월급여·마지막 구간 참여율을 이 연차 기간 전체에; 계획이 있으면 두 번 누름),
 *     달 격자 왼쪽에 [전체](st-pick-all — wholePick: 그 사람의 지급이 있는 첫날 ~ 마지막 날, 없으면 기간 전체, 지급이 끝난 달 뒤부터)를 눌러 ✎ 폼을 그 날짜로 연다.
 * rERP 조회(과제정보 › 참여인력 rtask_0008_t03_01_r001 · 다른 과제 월별 참여율 rtask_0013_12_r003)는 백그라운드 callService 로 — 과제 칩을 고를 때(화면을 열 때) 한 번, ↻ 로 다시. 세션 동안 state.staffRows 에 둔다.
 *   같은 조회 때 자금현황(백그라운드 fetchBudget — 과제집행비율과 같은 rcomm_0041_01_r004; 실패하면 패널 캐시 state.data.projects[].budget.items)의 **인건비 비목 승인액**으로 몇 월까지 지급됐는지(KRX_STAFF.paidThroughOf — 현재 연차 계획의 달들) 셈해 cache.paid 와 현재 연차 계획의 plan.paid 에 둔다
 *   (내용이 바뀌면 저장·공유 요청 — 계획 at 은 올리지 않음, 공유 병합은 paid.at 으로 따로). 격자의 그 달 칸은 라벨 오른쪽에 "지급" 이 붙고 잠긴다(단추가 아님 · 끌어 고르기에서 빠짐), ✎·＋·부족금의 % 는 적용일이 그 안이면 거부, 칸 편집(계상인건비·참여율)은 그 뒤 달만, 이전 기간 비율로·사람 빼기는 막는다(lib/staff.js lock)
 *   — 2026-10-19 사용자 "몇월까지 지급한게 나오는구나? 그럼 지급된 월은 수정 못하게 해줘. 월 우측에 지급 이라고 하던지 … sharepoint 에도 제공해줘. workspace도 알아야지".
 * 저장은 storage.local.staffPlans(lib/staff.js load/save) — R&D ERP 에는 쓰지 않는다. 팝업과 eClass 패널이 같은 목록을 쓴다. 저장 뒤 planSyncQueue 로 공유 (Plus) 요청(background.js shareSync — 과제별 공유 파일의 staff 칸, 병합은 lib/staff-sync.js merge).
 * 변경 도우미(채팅, 0.8.8 — 참여연구원 변경 탭의 오른쪽, popup/staff-chat.js — 2026-10-19 사용자 "우측에 LLM 에이전트 채팅창을 붙여주고, 참여연구원 변경 사항에 대한 작업요청을 대신 … LLM 이 연결된 경우에만"): bind() 가 돌려주는 agent { current, snapshot, apply } —
 *   snapshot 은 보고 있는 과제·연차 계획의 요약(이름·역할·월급여·월별 지급·참여율·예산·초과금/부족금·rERP 등록·지급 완료(잠금)·알림, 천원·% — lib/staff-chat-core.js clean 의 snapshot 모양)이고, apply(ops) 는 Help 서버의 Claude 가 돌려준 작업(change·total·monthly·role·remove·add·init·clear·year·period·budget·support_add·support_remove)을
 *   표의 칸·✎ 폼·단추와 **같은 길**로 차례대로 반영한다: change·add·support_add 는 staffDraft 를 채워 applyForm(잠금·나머지의 %·예산 맞추기 규칙 그대로), total·monthly 는 setTotal·setManual + commit, init 은 initFrom(조회가 없으면 fetchRows 먼저), period·budget·support_remove 는 setPeriod·setBudget·setSupport,
 *   role·remove·clear 는 역할 선택·×·지우기 단추와 같은 규칙(잠긴 달에 지급이 있는 사람은 빼지 않음). 작업마다 { ok, text, msg } 를 돌려준다(msg 는 화면 메시지 그대로). LLM(Help 서버)이 연결돼 있을 때만 채팅이 열린다.
 * 자료 요청(0.8.9, 2026-10-20 사용자 "참여연구자들에게 sharepoint 로 자료 수집을 위한 웹링크를 팀즈로 보내고 거기에 응답하면 데이터를 취합 … 문창재, 김거화 이런게.. 팀즈랑 연동이 잘되어야" — lib/collect.js KRX_COLLECT, 탭(pinned)의 행정지원 구역 아래 collectSection):
 *   계획에 참여연구원이 새로 들면(touch → collectFollow) 요청이 있는 연차에서는 st-co-share 가 저절로 돈다(표에 들고 이메일이 풀리면 [팀즈로 보내기]).
 *   [자료 요청 만들기](만들기 전 체크 상자 data-stco-ask 로 양식에 둘 칸을 고름 — 참여율 · 월급여 · 남은 연구수당(KRX_COLLECT.ASK, state.staffCollectAsk[키], 기본 참여율·월급여; 항목·시작·끝·비고는 늘) → st-co-create → 백그라운드 collectCreate { ask }: 내 OneDrive 에 응답 목록(SharePoint List) + 참여연구원에게 편집 공유, 이름 → 이메일은 사람 찾기·캐시) → 양식 줄에 고른 칸 · 사람 표(성명 · 이메일 칸(data-stco="email" — 못 찾은 사람은 직접 적고 [공유]) · 공유 상태 · 응답 수 · [팀즈로 보내기] = Teams 딥 링크 a(data-cosent — 누른 시각만 남김, 보내기는 사용자))
 *   · [모두에게 팀즈](그룹 채팅) · 팀즈 MCP(state.teamsStatus = storage.local.teamsStatus — lib/teams-mcp.js; 자료 요청이 있으면 열 때 'teamsProbe' 한 번): 연결돼 있으면 사람마다 [보내기](st-co-send) · 기존 채팅방 칸(data-stco="chat", chatIdOf)의 [채팅방에 보내기](st-co-send-chat) 가 백그라운드 collectSend 로 창 없이, 딥 링크는 [채팅 열기]·[채팅방 열기](chatLink)로 남음 · 팀즈 글(data-stco="message") · [응답 받기](st-co-fetch → collectFetch) → 응답 표(성명 · 항목 · 기간 · 참여율 · 월급여 · 비고 · 응답 시각 · [반영]/반영됨/100% 검사) — 반영(applyResponses)은 줄의 체크 상자(기간 · 참여율 · 월급여 · 연구수당 — state.staffCollectPick[키:응답 id], 기본 모두; 2026-10-20 사용자 "참여율,기간, 연구수당 각각 반영할 것을 선택할 수 있게")대로 월급여(setManual + commit) · 참여율(viaForm — ✎ 폼과 같은 규칙; **최대**(responseMax → S.maxRate — 예산 나머지 · 100% 규칙)를 넘으면 최대로 자르고 참여율 칸에 "최대 n%" 표기 — 같은 날 "참여율은 MAX … 이거 이상 못넘어 가게") · 남은 연구수당(person.allowance 참고 값), 계획에 없는 사람은 더하기;
 *   다른 과제 줄은 collectBook → KRX_STAFF.mergeOthers 의 book 으로 100% 검사(알림)에 저절로. state.staffCollect(storage.local.staffCollect) · staffCollectBusy(키) · staffCollectMsg({ key, text, error }). 요약(snapshot)에도 응답 줄(collect).
 * 별칭: 과제 카드의 ✎ 로 정하는 이 브라우저의 별칭(storage.local.projectAliases = { prjNo: 별칭 } · projectAliasesAt = { prjNo: 고친 시각 }) — 공유 (Plus) 가 켜져 있으면 과제별 공유 파일의 alias 칸으로 같은 과제 사람들과 맞춘다(aliasAt 이 큰 쪽, lib/prjdoc.js merge).
 *   0.8.7 개발 중의 KRS WORKSPACE 잇기(원노트 「[R&D 과제 정보] KRS WORKSPACE」 페이지, lib/ws-info.js · wsLinks · wsInfo)는 2026-10-18 저장소가 SharePoint 폴더의 JSON 으로 바뀌면서 걷어 냈다.
 * state: page('staff' 면 사업비 변경 화면) · staffPlans · staffView({ prjNo(고른 과제), years{ prjNo: 연차 }, extra{ prjNo: ＋ 로 연 연차 }, inc{ unbilled, plan }, fold{ budget, staff, project, changes(과제 정보·변경이력 기본 접힘 — false 면 펼침) }, months(월별 지급 펼침), reasons{ 변경 id: 사유 펼침 } } — storage.local.staffView) · staffAliases({ prjNo: 별칭 } — storage.local.projectAliases) · staffAliasError
 *  · staffRows({ [prjNo]: { at, rows, others{seq: rows}, loading, error } }) · staffEdit({ prjNo, year, id | 'new' }) · staffDraft · staffMsg({ prjNo, year, text, error }) · staffArm({ key, until } — 두 번 누르기) · staffAliasEdit(prjNo) · staffSync(storage.local.staffSyncState = 공유 결과 shareState)
 *  · staffSupport(storage.local.projectSupport) · staffSupportNew({ prjNo, name, role, ref } — 행정지원 더하기의 빈 줄, 이름을 적으면 저장)
 *  · staffChanges(storage.local.shareChanges = { '과제번호@연차': [변경…] }) · staffShareMsg({ prjNo, text, error } — 공유 줄 단추의 결과) · staffShareBusy(prjNo — 공유 줄 단추 진행 중) */
(function (g) {
  const F = g.KRX_FMT, S = g.KRX_STAFF;
  const api = {};
  const esc = (v) => F.esc(v);
  const PART_SVC = 'rtask_0008_t03_01_r001';
  const OTHERS_SVC = 'rtask_0013_12_r003';
  const ARM_MS = 3000;
  const PAGE = 'staff';   // state.page 값 — 사업비 변경 화면 (render.js 가 머리 단추·본문에 씀)
  const VIEW_KEY = 'staffView';        // storage.local — 보는 상태 { prjNo, years, extra, inc, fold, months, reasons }
  const ALIAS_KEY = 'projectAliases';  // storage.local — 과제 별칭 { [prjNo]: 'SSCB' } (과제 칩·카드 이름)
  const ALIAS_AT_KEY = 'projectAliasesAt';   // storage.local — 별칭을 고친 시각 { [prjNo]: ms } (공유 (Plus) 병합이 새 쪽을 알게 — lib/prjdoc.js aliasAt)
  const CHANGES_KEY = 'shareChanges';   // storage.local — 변경이력 { ['과제번호@연차']: [{ id, date, kind, item, before, after, reason, by, at, auto }] } (background.js shareSync 가 연차 파일 changes 칸과 합집합)
  const SUPPORT_KEY = 'projectSupport';   // storage.local — 행정지원 { [prjNo]: { people:[{ name, role, ref }], at } } (과제 공통 — 연차 파일 project.support · supportAt 로 KRS WORKSPACE 와 양쪽이 맞춤, background.js SHARE_SUPPORT_KEY). 참여인력 카드 아래 행정지원 구역(supportSection)
  const COLLECT_KEY = 'staffCollect';   // storage.local — 참여연구원 자료 요청 { ['과제번호@연차' | '과제번호@연차#no']: req }(같은 과제·연차에 요청 여럿 — [요청 추가]) (lib/collect.js KRX_COLLECT — 응답 목록 · 사람 · 응답 · 반영 시각). 참여연구원 변경 탭의 자료 요청 구역(collectSection)
  const C = () => g.KRX_COLLECT;        // 있을 때만(패널·탭은 lib/collect.js 를 싣고, 테스트는 없을 수 있음)
  const CHANGES_MAX = 500;              // 한 연차에 남기는 변경 수 — 넘으면 오래된 것부터 버림 (prjdoc 계약과 같음)
  const CHANGE_KINDS = ['예산', '연구내용', '연구기간', '연구진', '기타'];   // kr_ext_workspace src/rnd.js CHANGE_KINDS 와 같은 이름 — 두 확장이 같은 연차 파일의 changes 를 읽는다
  const srcLabel = { manual: '직접', rerp: 'rERP', plan: '계획서', none: '없음' };
  const nowMs = () => Date.now();
  const todayYm = () => S.ymOf(F.ymd(new Date()));
  const ymdDash = (t) => { const d = new Date(t); return `${d.getFullYear()}-${F.pad2(d.getMonth() + 1)}-${F.pad2(d.getDate())}`; };
  const cut = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

  /* ---------- 변경이력 (순수 — 테스트에서 직접 부름) ---------- */
  const newId = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
  /* 변경 한 줄 — WORKSPACE normalizeChange 와 같은 칸. kind 는 CHANGE_KINDS 가운데(아니면 기타), item 100자 · before/after 300자 · reason 은 비움(사유는 WORKSPACE 나 파일에서 적음), auto 는 사용자가 고친 것이라 false */
  function changeEntry(o) {
    const x = o || {}, t = Number(x.now) || nowMs();
    return { id: cut(x.id, 40) || newId(), date: ymdDash(t), kind: CHANGE_KINDS.includes(x.kind) ? x.kind : '기타', item: cut(x.item, 100), before: cut(x.before, 300), after: cut(x.after, 300), reason: cut(x.reason, 1000), by: cut(x.by, 40), at: t, auto: x.auto === true };
  }
  /* 목록에 덧붙임 — id 로 합집합(같은 id 는 뒤 것이 칸을 덧씀), at 차례(같으면 date), 최대 CHANGES_MAX(오래된 것부터 버림). background.js shareMergeChanges 와 같은 규칙. entry 는 하나 또는 배열 */
  function appendChanges(list, entry) {
    const map = new Map();
    for (const c of (Array.isArray(list) ? list : []).concat(Array.isArray(entry) ? entry : (entry ? [entry] : []))) {
      if (!c || typeof c !== 'object' || !c.id) continue;
      const id = String(c.id);
      map.set(id, map.has(id) ? Object.assign({}, map.get(id), c) : c);
    }
    const out = Array.from(map.values()).sort((a, b) => ((Number(a.at) || 0) - (Number(b.at) || 0)) || String(a.date || '').localeCompare(String(b.date || '')));
    return out.length > CHANGES_MAX ? out.slice(out.length - CHANGES_MAX) : out;
  }
  /* 그 연차의 변경이력(저장 차례 — state.staffChanges['과제번호@연차']) */
  const changesOf = (state, prjNo, year) => { const l = (state.staffChanges || {})[S.planKey(prjNo, year)]; return Array.isArray(l) ? l : []; };
  /* 날짜가 늦은 것부터(같은 날은 at 이 큰 것부터) — WORKSPACE newestFirst 와 같은 뜻 */
  const newestFirst = (list) => (list || []).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || ((Number(b.at) || 0) - (Number(a.at) || 0)));
  const thousandText = (v) => (v == null || v === '' ? '(비움)' : `${S.thousand(v)}천원`);

  /* ---------- 보는 상태 · 연차 · 기간 ---------- */
  const viewOf = (state) => {
    if (!state.staffView || typeof state.staffView !== 'object') state.staffView = {};
    const v = state.staffView;
    if (!v.years || typeof v.years !== 'object') v.years = {};
    if (!v.extra || typeof v.extra !== 'object') v.extra = {};
    if (!v.inc || typeof v.inc !== 'object') v.inc = { unbilled: true, plan: true };
    if (!v.fold || typeof v.fold !== 'object') v.fold = {};
    if (!v.reasons || typeof v.reasons !== 'object') v.reasons = {};
    return v;
  };
  /* 고른 과제 — 없거나 목록에 없으면 첫 과제 */
  const projOf = (projects, state) => { const v = viewOf(state); return projects.find((p) => p.prjNo === v.prjNo) || projects[0] || null; };
  /* 과제에서 고른 연차 — 없으면 R&D ERP 의 현재 연차 */
  const yearOf = (p, state) => { const y = viewOf(state).years[p.prjNo]; return y >= 1 ? y : S.anlOf(p); };
  /* 과제 칩·카드에 보일 별칭 — 이 브라우저에서 정한 것(공유 (Plus) 가 켜져 있으면 백그라운드가 공유 파일과 맞춰 둔다) */
  const aliasOf = (state, prjNo) => String(((state.staffAliases || {})[prjNo]) || '').trim();
  const shortName = (nm) => { const s = String(nm || '').trim(); return s.length > 12 ? `${s.slice(0, 11)}…` : s; };
  /* 연차 없는 옛 계획(키가 과제번호만 — 연차를 두기 전 저장분)은 그 과제의 현재 연차 계획으로 옮긴다(메모리에서 — 다음 저장 때 그대로 남는다). 그 연차에 이미 계획이 있으면 옛것을 버린다 */
  function adopt(plans, p) {
    const old = plans[p.prjNo];
    if (!old || typeof old !== 'object' || old.year >= 1) return;
    const year = S.anlOf(p), key = S.planKey(p.prjNo, year);
    if (!plans[key]) { old.year = year; plans[key] = old; }
    delete plans[p.prjNo];
  }
  /* 과제에 보일 연차들 — 1 ~ max(현재 연차 + 1, 계획이 있는 연차, ＋ 로 연 연차) */
  function yearsOf(p, plans, state) {
    let max = S.anlOf(p) + 1;
    for (const y of Object.keys(S.plansOfProject(plans, p.prjNo))) max = Math.max(max, Number(y));
    const extra = viewOf(state).extra[p.prjNo];
    if (extra > max) max = extra;
    max = Math.min(max, S.YEAR_MAX);
    const out = [];
    for (let n = 1; n <= max; n++) out.push(n);
    return out;
  }
  /* 계획의 기간 — 저장된 것, 없으면 그 연차의 달 범위(현재 연차는 R&D ERP 의 연차 기간 RCH_ST_DT~END_DT, 다른 연차는 거기서 12달씩 — lib/staff.js yearSpan). { from, to } 'YYYY-MM' */
  function periodOf(p, plan, year) {
    if (plan && S.isYm(plan.from) && S.isYm(plan.to)) return { from: plan.from, to: plan.to };
    return S.yearSpan(p, year == null ? (plan && plan.year) || S.anlOf(p) : year);
  }
  const spanText = (per) => (per && per.from ? `${per.from} ~ ${per.to}` : '');
  /* 연차의 형편 — 오늘 달이 기간 앞이면 예정, 뒤면 지남 */
  function yearState(per) { if (!per || !per.from) return '기간 미정'; const t = todayYm(); return t < per.from ? '예정' : t > per.to ? '지남' : '진행 중'; }

  /* ---------- 예산 (비목별 계획 · 집행 · 잔액) ---------- */
  /* 과제집행비율의 인건비 비목 예산(원) — 비목명에 인건비가 들고 수당이 안 드는 줄의 예산액 합. 없으면 null */
  function erpBudgetPay(p) {
    const items = (p && p.budget && Array.isArray(p.budget.items)) ? p.budget.items : [];
    const hit = items.filter((x) => S.isPayItem(x.exp || x.item));
    return hit.length ? hit.reduce((s, x) => s + (F.num(x.bgt) || 0), 0) : null;
  }
  /* 인건비 예산 — 저장된 budgetPay(예산 칸의 인건비 줄을 고치면 거기서 받음) > 예산 줄(rows — budgetRows 의 기본값)의 인건비 > 현재 연차의 과제집행비율 인건비 비목 > null */
  const budgetOf = (p, plan, year, rows) => {
    if (plan && plan.budgetPay != null) return plan.budgetPay;
    if (rows) { const v = S.budgetPayOf(rows); if (v != null) return v; }
    return (year == null ? (plan && plan.year) || S.anlOf(p) : year) === S.anlOf(p) ? erpBudgetPay(p) : null;
  };
  const staffOf = (plan) => (plan && plan.people && plan.people.length ? { basis: plan.basis || 'rerp', src: plan.src || 'erp', people: plan.people } : null);
  const planShell = (p, year, plan) => Object.assign({ prjNo: p.prjNo, year, prjNm: p.prjNm || '', from: '', to: '', budgetPay: null, budget: null, basis: 'rerp', src: 'erp', people: [], at: 0, note: '' }, plan || {});
  const sumText = (staff) => `참여연구원 ${staff.people.length}명 · 인건비 합 ${S.thousand(S.staffTotal(staff, staff.basis))}천원`;
  /* 그 차년도의 연구개발계획서 기록(lib/research.js, state.research) */
  const researchRec = (state, prjNo, year) => Object.values(state.research || {}).find((r) => r && r.prjNo === prjNo && Number(r.n) === year) || null;
  /* 과제집행비율의 예상 비용(lib/plan.js plannedExpenses) 비목별 합(원) — { 비목 키: 합 } */
  function planSumsOf(state, prjNo) {
    const P = g.KRX_PLAN, out = {};   // P 가 없으면(테스트) 키의 비목 이름과 저장된 금액만으로
    const nameOf = (key) => (P ? P.keyName(key) : String(key).slice(String(key).indexOf('|') + 1));
    const amtOf = (e) => (P && typeof P.amtOf === 'function' ? P.amtOf(e) : (F.num(e && e.amt) || 0));
    for (const [key, list] of Object.entries(((state.plans || {})[prjNo]) || {})) {
      const k = S.itemKeyOf(nameOf(key));
      out[k] = (out[k] || 0) + (Array.isArray(list) ? list : []).reduce((s, e) => s + amtOf(e), 0);
    }
    return out;
  }
  /* 예산 칸의 줄들 — { rows[{ name, plan, appr, req, pl, ub, used, left, erp }], src('plan' 직접 | 'erp' R&D ERP 예산액 | 'yaml' 계획서 | 'default' 비목만), loose(연구활동비 줄이 없을 때의 미청구 보조 줄 | null), sums{ plan, used, left }, cur, rec }
   * 집행 = R&D ERP 승인액(현재 연차, 같은 비목은 재원을 합침) + 사용계획(예상 비용 — inc.plan) + 미청구(연구활동비 줄 — inc.unbilled). 승인전(청구했지만 결재 전)은 더하지 않고 툴팁에만 */
  function budgetRows(p, plan, year, state) {
    const cur = year === S.anlOf(p);
    const items = p && p.budget && Array.isArray(p.budget.items) ? p.budget.items : [];
    const erp = new Map();
    for (const x of items) {
      const nm = String(x.exp || x.item || '').trim();
      if (!nm) continue;
      const k = S.itemKeyOf(nm);
      const e = erp.get(k) || { name: nm, bgt: 0, appr: 0, req: 0 };
      e.bgt += F.num(x.bgt) || 0; e.appr += F.num(x.appr) || 0; e.req += F.num(x.req) || 0;
      erp.set(k, e);
    }
    const rec = researchRec(state, p.prjNo, year);
    let src, base;
    if (plan && Array.isArray(plan.budget)) { src = 'plan'; base = plan.budget.map((r) => ({ name: r.name, plan: r.plan })); }
    else if (cur && erp.size) { src = 'erp'; base = [...erp.values()].map((e) => ({ name: e.name, plan: e.bgt })); }
    else if (rec && Array.isArray(rec.budget) && rec.budget.length) { src = 'yaml'; base = rec.budget.map((b) => ({ name: String(b.item || '').trim(), plan: b.plan == null ? null : F.num(b.plan) })); }
    else { src = 'default'; base = (erp.size ? [...erp.values()].map((e) => e.name) : S.BUDGET_ITEMS).map((n) => ({ name: n, plan: null })); }
    const inc = viewOf(state).inc;
    const planSums = cur ? planSumsOf(state, p.prjNo) : {};
    const unbilled = cur && p.budget ? (F.num(p.budget.unbilled) || F.num(p.amount) || 0) : 0;
    const ubIdx = inc.unbilled && unbilled > 0 ? base.findIndex((r) => /연구활동비/.test(String(r.name || ''))) : -1;
    const rows = base.map((r, i) => {
      const e = cur ? erp.get(S.itemKeyOf(r.name)) : null;
      const appr = e ? e.appr : 0, req = e ? e.req : 0;
      const pl = inc.plan ? (planSums[S.itemKeyOf(r.name)] || 0) : 0;
      const ub = i === ubIdx ? unbilled : 0;
      const used = appr + pl + ub;
      return { name: r.name, plan: r.plan, appr, req, pl, ub, used, left: r.plan == null ? null : r.plan - used, erp: !!e };
    });
    const loose = inc.unbilled && unbilled > 0 && ubIdx < 0 ? { amt: unbilled, count: F.num(p.count) || 0 } : null;
    const sums = { plan: rows.reduce((s, r) => s + (r.plan || 0), 0), used: rows.reduce((s, r) => s + r.used, 0) + (loose ? loose.amt : 0) };
    sums.left = sums.plan - sums.used;
    return { rows, src, loose, sums, cur, rec };
  }
  /* 예산 표(탭으로 나눈 글, 천원) */
  function budgetTsv(br) {
    const lines = [['비목', '계획(천원)', '집행(천원)', '잔액(천원)'].join('\t')];
    for (const r of br.rows) lines.push([r.name, r.plan == null ? '' : S.thousand(r.plan), S.thousand(r.used), r.left == null ? '' : S.thousand(r.left)].join('\t'));
    if (br.loose) lines.push([`미청구 · 과제카드 ${br.loose.count}건`, '', S.thousand(br.loose.amt), S.thousand(-br.loose.amt)].join('\t'));
    lines.push(['합계', S.thousand(br.sums.plan), S.thousand(br.sums.used), S.thousand(br.sums.left)].join('\t'));
    return lines.join('\n');
  }

  /* ---------- 그리기 ---------- */
  const ICON_EXT = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>';
  const ICON_FOLDER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
  const ICON_BUDGET = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/></svg>';
  const ICON_PEOPLE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 19.5v-.5A5 5 0 0 1 7.5 14h3a5 5 0 0 1 5 5v.5M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14a5 5 0 0 1 3 4.6v.9"/></svg>';
  const ICON_COPY = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
  const ICON_REFRESH = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16M16 16h5v5"/></svg>';
  const ICON_LOG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/></svg>';
  const ICON_PERSON_ADD = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 19.5v-.5A5 5 0 0 1 7.5 14h3a5 5 0 0 1 5 5v.5M19 8v6M16 11h6"/></svg>';   // 행정지원 사람 더하기 — WORKSPACE 의 같은 아이콘
  /* 카드가 펴져 있나 — fold[card] 가 참이면 접힘. 과제 정보·변경이력은 기본 접힘(false 를 적어야 펼침) */
  const openOf = (v, card) => (card === 'changes' || card === 'project' ? v.fold[card] === false : !v.fold[card]);
  const partLink = (prjNo) => (g.KRX_RENDER && typeof g.KRX_RENDER.projectLink === 'function') ? g.KRX_RENDER.projectLink(prjNo, '03') : 'https://rnd.krs.co.kr/rderp_layoutMain.act';
  const fundLink = (prjNo) => (g.KRX_RENDER && typeof g.KRX_RENDER.projectLink === 'function') ? g.KRX_RENDER.projectLink(prjNo, '06') : 'https://rnd.krs.co.kr/rderp_layoutMain.act';

  /* ✎·＋ 폼의 적용일·종료일 기본값(2026-10-19 사용자 "적용일은 올해인 경우 다음달 1일을, 종료일은 올해 마지막 날을 기본값으로 … 다음 변경/추가되는 사람의 적용일, 종료일은 이전 사람의 변경된 날짜를 동일하게"):
   * last(이 연차에서 직전에 반영한 변경·추가의 { from, to } — state.staffLastRange)가 있으면 그대로. 없으면 적용일은 오늘(today 'YYYY-MM')이 기간 안이면 다음 달 1일(다음 달이 기간 밖이면 이번 달 1일), 아니면 기간 첫 달 1일;
   * 종료일은 적용일이 든 해의 12월 마지막 날(그 달이 기간 밖이면 기간 마지막 달의 마지막 날). months 는 기간의 달들('YYYY-MM') */
  function defaultRange(months, today, last, lock = '') {
    // lock('YYYY-MM' — rERP 지급이 끝난 마지막 달)이 있으면 적용일은 그 다음 달 1일보다 앞설 수 없다(종료일이 그보다 앞이면 기간 마지막 날)
    const clamp = (r) => {
      if (!S.isYm(lock) || !r.from || r.from > S.monthEnd(lock)) return r;
      const min = S.monthStart(S.addMonths(lock, 1));
      return { from: min, to: r.to && r.to >= min ? r.to : (months.length ? S.monthEnd(months[months.length - 1]) : '') };
    };
    if (last && last.from) return clamp({ from: last.from, to: last.to || '' });
    if (!months.length) return { from: '', to: '' };
    let fy = months[0];
    if (months.includes(today)) { const nx = S.addMonths(today, 1); fy = months.includes(nx) ? nx : today; }
    const ye = `${fy.slice(0, 4)}-12`;
    return clamp({ from: S.monthStart(fy), to: S.monthEnd(months.includes(ye) ? ye : months[months.length - 1]) });
  }
  /* headHtml: 화면 제목(render.js). opts.tail 은 제목 줄 끝(돌아가기 단추) */
  function section(d, s, state, headHtml, opts = {}) {
    const plans = state.staffPlans || {};
    const projects = (d && d.projects) || [];
    for (const p of projects) adopt(plans, p);
    const n = Object.values(plans).filter((x) => x && ((x.people && x.people.length) || (x.budget && x.budget.length))).length;
    const only = opts.only === 'staff';   // 참여연구원 변경 탭(popup.js applyHash → render.js): 과제 칩·과제 카드·예산·변경이력 없이 제목 줄(제목 · 별칭 · 과제 정보 링크) · 연차 칩 · 접히지 않는 참여인력 카드만 — 패널 카드의 [참여연구원 변경] 단추(st-tab)가 연 브라우저 탭. 계획 편집(단추 줄 · 칸 · ✎ · ×)은 여기서만, 패널 카드는 보기 + 행정지원
    const head = only
      ? `<div class="krext-sec-title">${headHtml || ''}${projects.length ? focusTitle(projOf(projects, state), state) : ''}${opts.tail || ''}</div>`   // 탭: 계획 수는 다른 과제까지 세므로 뺌
      : `<div class="krext-sec-title">${headHtml || ''}<span class="krext-note">${n ? `계획 ${F.money(n)}개` : ''}</span>${opts.tail || ''}</div>`;
    if (!projects.length) return `<section class="krext-sec krext-st-sec krext-ws">${head}<div class="krext-msg krext-dim">표시할 과제가 없습니다.</div></section>`;
    const p = projOf(projects, state);
    const year = yearOf(p, state);
    const plan = plans[S.planKey(p.prjNo, year)] || null;
    const sync = state.staffSync || null;
    const pg = sync && sync.pages && sync.pages[p.prjNo] ? sync.pages[p.prjNo] : null;   // 공유 결과의 이 과제 몫 — 폴더 이름·주소·공유 결과·현재 연차 파일(webUrl 은 파일이 있을 때만)
    const plus = !!(s && s.plus && s.plus.enabled);   // 공유 (Plus) 켜짐 — 과제 카드의 공유 줄은 이때만
    const br = budgetRows(p, plan, year, state);
    // 탭(only): 과제 카드(과제명 · 과제번호 · 책임자 · 기간 칸) 없이 연차 칩 바로 아래 참여인력 카드 — 2026-10-19 사용자 "너무 공간을 많이 차지함 … 날짜가 필요 없을거 같고 … 약칭있는데 왜 과제 제목이며, 과제번호는 여기 왜 있냐 … 막상 중요한 참여연구원이 한참 아래에 있잖아". 기간 칸은 사업비 관리의 과제 카드에서
    const body = only
      ? `<div class="krext-ws-wrap krext-st-only" data-stprj="${esc(p.prjNo)}" data-styr="${year}">${yearTabs(p, plans, state, year)}${staffCard(p, plan, year, br, state, true)}</div>`
      : `<div class="krext-ws-wrap" data-stprj="${esc(p.prjNo)}" data-styr="${year}">${projCard(p, plans, plan, year, state, pg, plus)}${budgetCard(p, plan, year, br, state)}${staffCard(p, plan, year, br, state)}${changesCard(p, year, state, plus)}</div>`;
    const foot = only
      ? `<aside class="krext-st-guide"><strong>변경한 계획은 자동으로 저장됩니다.</strong><p>표의 월급여·지급 합·참여율 칸을 눌러 바로 고칩니다(금액은 천원, 참여율은 %). 달마다의 지급 격자에서 달 칸을 누르거나 끌어 고르면 그 달들의 참여율·월 지급금액·제외를 한 번에 반영하는 폼이 열립니다(격자 왼쪽 <b>전체</b>는 그 사람의 참여개월 모두, 달 중간의 날은 폼의 적용일·종료일로).${year > 1 ? ` <b>${esc(S.yearLabel(year - 1))}에서 가져오기</b>는 ${esc(S.yearLabel(year - 1))}의 연구원·월급여·참여율(마지막 구간)을 이 연차 기간 전체에 넣습니다.` : ''} 사이드 패널의 사업비 관리에서도 같은 ${esc(S.yearLabel(year))} 계획을 확인할 수 있습니다.${plus ? ' 공유 폴더를 통해 같은 과제의 참여연구원과도 동기화됩니다.' : ''} 기간(첫 달·마지막 달)·예산·변경이력·다른 과제는 사업비 관리에서 확인하세요.</p><p>R&amp;D ERP의 참여인력신청·인건비지급계획에는 별도로 입력해야 합니다.</p></aside>`
      : `<div class="krext-sub krext-dim">예산 칸의 계획은 비목마다 천원으로 적고(현재 연차는 R&D ERP 예산액, 다른 연차는 연구개발계획서가 기본), 참여인력 칸은 월별 지급금액이 관리 대상이고 참여율은 100% 가 찼는지 보는 값입니다. 연차 칩마다 따로 세우며, 여기서 세운 계획은 ${plus ? '공유 폴더의 연차 파일로 같은 과제 사람들과 맞춰지고' : '이 브라우저에만 남고'} R&D ERP 의 사업비 변경·참여인력신청·인건비지급계획에는 직접 넣어야 합니다.</div>`;
    return `<section class="krext-sec krext-st-sec krext-ws krext-st-edit${only ? ' krext-st-focus' : ''}">${head}${only ? '' : chips(projects, p, plans, state)}${body}${foot}${syncLine(sync)}</section>`;
  }
  /* 참여연구원 변경 탭의 제목 줄 뒤 — 과제 별칭(없으면 과제명 앞부분; 과제명 · 과제번호 · 책임자는 툴팁) · 오른쪽 끝 과제 정보 링크. 과제 카드는 두지 않는다(패널에서 빠져나온 화면이라 과제는 이미 안다) */
  function focusTitle(p, state) {
    const alias = aliasOf(state, p.prjNo);
    const tip = [p.prjNm, p.prjNo, p.rspr ? `책임자 ${p.rspr}` : ''].filter(Boolean).join(' · ');
    const agentOn = !!state.staffChatOpen;   // 변경 도우미(채팅) 열림 — popup/staff-chat.js 가 state 에 둔다(2026-10-19 사용자 "에이전트 버튼을 누르면 나오도록")
    return `<span class="krext-st-focus-prj" title="${esc(tip)}">${esc(alias || shortName(p.prjNm))}</span><a class="krext-ws-focus-link" href="${esc(partLink(p.prjNo))}" target="_blank" rel="noopener" title="R&amp;D ERP 과제정보 › 참여인력 탭 (${esc(p.prjNo)})">과제 정보 ${ICON_EXT}</a><button type="button" class="krext-ws-focus-link krext-st-agent" data-act="st-agent" aria-pressed="${agentOn}" title="변경 도우미(채팅) ${agentOn ? '닫기' : '열기'} — 글로 적은 변경 요청을 이 PC 의 Help 서버(Claude)가 작업 목록으로 만들어 이 표에 반영합니다. LLM(Help 서버)이 연결돼 있을 때만 작업할 수 있습니다">에이전트</button>`;
  }
  /* 과제 카드의 공유 줄(공유 (Plus) 켜짐) — 과제 폴더 이름 · [폴더 열기] · [참여연구원에게 공유] · [링크 복사] · [주소 복사] · 공유 결과(n명 · 이름 겹침 · 못 찾음). 폴더를 아직 모르면 [지금 동기화]. pg = shareState.pages[prjNo] */
  function shareLine(p, pg, state) {
    const busy = state.staffShareBusy === p.prjNo;
    const m = state.staffShareMsg && state.staffShareMsg.prjNo === p.prjNo && state.staffShareMsg.text ? state.staffShareMsg : null;
    const msg = m ? `<span class="krext-ws-share-r${m.error ? ' krext-err' : ''}">${esc(m.text)}</span>` : '';
    const dis = busy ? ' disabled' : '';
    if (!pg || !pg.folder) {
      const why = pg && pg.error ? `공유 실패: ${pg.error}` : pg && pg.noFolder ? '과제 폴더가 아직 없습니다 — 과제책임자(또는 이 과제의 자료가 있는 사람)가 동기화하면 만들어지고 참여연구원에게 공유됩니다' : '과제 폴더를 아직 모릅니다 — 동기화하면 공유 폴더(또는 나와 공유된 폴더)에서 찾거나 만듭니다';
      return `<div class="krext-ws-share"><span class="krext-ws-share-k">공유</span><span class="krext-dim${pg && pg.error ? ' krext-err' : ''}">${esc(why)}</span><button type="button" class="krext-plan-btn" data-act="st-share-sync" title="공유 폴더와 지금 맞춥니다 (background.js shareSync — 이 과제만)"${dis}>${busy ? '동기화 중…' : '지금 동기화'}</button>${msg}</div>`;
    }
    const sh = pg.share || null;
    const n = (k) => (sh && Array.isArray(sh[k]) ? sh[k].length : 0);
    const resTxt = sh ? (sh.error ? `자동 공유 실패: ${sh.error}` : `공유 ${n('shared')}명${n('ambiguous') ? ` · 이름 겹침 ${n('ambiguous')}` : ''}${n('notFound') ? ` · 못 찾음 ${n('notFound')}` : ''}${sh.note ? ` · ${sh.note}` : ''}`) : '';
    const resTip = sh ? [n('shared') ? `공유: ${sh.shared.map((x) => x.name).join(', ')}` : '', n('ambiguous') ? `이름 겹침(OneDrive 에서 직접 공유): ${sh.ambiguous.map((x) => `${x.name}(${(x.candidates || []).join('/')})`).join(', ')}` : '', n('notFound') ? `못 찾음: ${sh.notFound.join(', ')}` : '', sh.at ? `${F.fmtClock(sh.at)}` : ''].filter(Boolean).join(' · ') : '';
    const owner = pg.owner ? `<span class="krext-dim" title="나와 공유된 다른 사람의 폴더 — 그 사람이 참여연구원 공유를 관리합니다">${esc(pg.owner)} 의 폴더</span>` : '';
    const open = pg.folderUrl ? `<a href="${esc(pg.folderUrl)}" target="_blank" rel="noopener" title="SharePoint(OneDrive) 에서 이 과제 폴더를 엽니다 — 연차 파일(<n>차년도.json) · 예상비용.json">폴더 열기 ${ICON_EXT}</a>` : '';
    const people = pg.owner ? '' : `<button type="button" class="krext-plan-btn" data-act="st-share-people" title="R&amp;D ERP 참여인력(나 제외)에게 이 폴더를 편집 권한으로 공유합니다 — 이름이 겹치거나 못 찾은 사람은 OneDrive 에서 직접"${dis}>참여연구원에게 공유</button>`;
    const link = `<button type="button" class="krext-plan-btn" data-act="st-share-link" title="조직 내 편집 링크를 만들어 클립보드에 복사합니다 — 참여연구원이 아닌 사람에게 줄 때"${dis}>링크 복사</button>`;
    const copy = `<button type="button" class="krext-ico-btn" data-act="st-share-copy" title="과제 폴더 주소 복사 — 동료가 설정 › 공유 (Plus) 의 공유 폴더 칸에 붙여 넣으면 같은 파일을 씁니다"${dis}>${ICON_COPY}</button>`;
    return `<div class="krext-ws-share"><span class="krext-ws-share-k">공유</span><b class="krext-ws-share-f" title="과제 폴더 이름(별칭 → Job Id → 과제번호) — 만들 때 정해지며 저절로 바뀌지 않습니다">${esc(pg.folder)}</b>${owner}${open}${people}${link}${copy}${resTxt ? `<span class="krext-ws-share-r${sh.error ? ' krext-err' : ''}" title="${esc(resTip)}">${esc(resTxt)}</span>` : ''}${msg}</div>`;
  }
  /* 변경이력 카드(기본 접힘) — WORKSPACE 와 같은 날짜 역순 이벤트 목록(날짜 · 구분 · 항목 · 누가, 전 → 후, 펼치는 사유). 연차 파일의 auto 줄도 함께 표시 */
  function changesCard(p, year, state, plus) {
    const v = viewOf(state), open = openOf(v, 'changes');
    const list = changesOf(state, p.prjNo, year), latest = newestFirst(list)[0] || null;
    const stateTxt = list.length ? `${F.money(list.length)}건${latest && latest.date ? ` · 마지막 ${latest.date}` : ''}` : '없음';
    const head = `<button type="button" class="krext-ws-cardhead" data-act="st-fold" data-card="changes" aria-expanded="${open}" title="${open ? '접기' : '펴기'}">${ICON_LOG}<span>변경이력</span><span class="krext-ws-state" title="${esc(S.yearLabel(year))} 변경이력 — 예산 줄·참여인력·기간·별칭을 고칠 때 한 줄씩">${esc(stateTxt)}</span><i class="krext-ws-chev${open ? '' : ' krext-closed'}"></i></button>`;
    if (!open) return `<div class="krext-ws-card">${head}</div>`;
    const rows = newestFirst(list).map((c) => `<li><div class="krext-ws-change-head"><span class="krext-ws-change-date">${esc(c.date || '')}</span><span class="krext-ws-kind">${esc(c.kind || '기타')}</span><strong class="krext-ws-change-title">${esc(c.item || '')}</strong><span class="krext-ws-by">${esc(c.by || '')}${c.auto ? ' <small title="계획서 들여오기 등 프로그램이 남긴 줄">자동</small>' : ''}</span></div><p class="krext-ws-diff"><s>${esc(c.before || '—')}</s><span class="krext-ws-arrow">→</span><b>${esc(c.after || '—')}</b></p>${c.reason ? `<details class="krext-ws-reason" data-streason="${esc(c.id || '')}"${v.reasons[c.id] ? ' open' : ''}><summary><span class="krext-ws-reason-label">사유</span><span class="krext-ws-reason-peek">${esc(c.reason)}</span></summary><p class="krext-ws-reason-text">${esc(c.reason)}</p></details>` : ''}</li>`).join('');
    const body = list.length
      ? `<ul class="krext-ws-changes krext-ws-change-list">${rows}</ul>`
      : `<div class="krext-sub krext-dim">${esc(S.yearLabel(year))} 변경이력이 없습니다 — 예산 줄·참여인력·기간·별칭을 고치면 한 줄씩 남습니다${plus ? '. 공유 (Plus) 가 켜져 있어 연차 파일(changes)로 같은 과제 사람들·KRS WORKSPACE 와 맞춥니다' : ''}.</div>`;
    return `<div class="krext-ws-card">${head}<div class="krext-ws-body">${body}</div></div>`;
  }
  /* 과제 칩 줄 — 별칭(없으면 과제명 앞부분), 고른 과제는 파랑 */
  function chips(projects, cur, plans, state) {
    return `<div class="krext-ws-projs">${projects.map((x) => {
      const nPlans = Object.keys(S.plansOfProject(plans, x.prjNo)).length;
      const tip = [x.prjNm, x.prjNo, x.rspr ? `책임자 ${x.rspr}` : '', nPlans ? `계획 ${nPlans}개 연차` : ''].filter(Boolean).join(' · ');
      return `<button type="button" class="krext-ws-proj${x.prjNo === cur.prjNo ? ' krext-on' : ''}" data-act="st-proj" data-prj="${esc(x.prjNo)}" aria-pressed="${x.prjNo === cur.prjNo}" title="${esc(tip)}">${esc(aliasOf(state, x.prjNo) || shortName(x.prjNm))}</button>`;
    }).join('')}</div>`;
  }
  /* 과제 카드 — 접는 정보(별칭 ✎ · 과제명 · 과제번호 · 책임자 · 링크 · 공유), 항상 보이는 별칭 편집·연차 칩·기간 줄 */
  function projCard(p, plans, plan, year, state, pg, plus) {
    const open = openOf(viewOf(state), 'project');
    const alias = aliasOf(state, p.prjNo);
    const editing = state.staffAliasEdit === p.prjNo;
    const fileLink = pg && pg.webUrl ? `<a href="${esc(pg.webUrl)}" target="_blank" rel="noopener" title="공유 폴더의 이 과제 연차 파일(${esc(S.yearLabel(Array.isArray(pg.years) && pg.years.length ? pg.years[pg.years.length - 1] : year))}) — ${esc(pg.title || '')}${pg.at ? ` · ${esc(F.fmtClock(pg.at))} 공유` : ''}">연차 파일 ${ICON_EXT}</a>` : '';
    const title = `<div class="krext-ws-title"><button type="button" class="krext-ws-cardhead krext-ws-project-toggle" data-act="st-fold" data-card="project" aria-expanded="${open}" title="과제 정보 ${open ? '접기' : '펴기'}">${ICON_FOLDER}<b class="krext-ws-name" title="${esc(p.prjNm)}">${esc(alias || p.prjNm)}</b><span class="krext-ws-state">과제 정보</span><i class="krext-ws-chev${open ? '' : ' krext-closed'}"></i></button><button type="button" class="krext-ws-edit" data-act="st-alias" aria-label="과제 별칭 정하기" title="별칭 정하기 — 과제 칩과 여기에 보일 짧은 이름 (예: SSCB). 공유 (Plus) 가 켜져 있으면 같은 과제 사람들과 맞추고, 새로 만드는 과제 폴더의 이름이 됩니다">✎</button></div>`;
    const info = open ? `<div class="krext-ws-project-info"><dl class="krext-ws-project-meta"><dt>과제명</dt><dd>${esc(p.prjNm)}</dd><dt>과제번호</dt><dd>${esc(p.prjNo)}</dd><dt>책임자</dt><dd>${esc(p.rspr || '—')}</dd></dl><div class="krext-ws-links"><a href="${esc(partLink(p.prjNo))}" target="_blank" rel="noopener" title="R&amp;D ERP 과제정보 › 참여인력 탭 (${esc(p.prjNo)})">과제 정보 ${ICON_EXT}</a>${fileLink}</div>${plus ? shareLine(p, pg, state) : ''}</div>` : '';
    const aliasForm = editing ? `<div class="krext-plan-form krext-ws-alias"><input type="text" data-stalias value="${esc(state.staffAliasDraft == null ? alias : state.staffAliasDraft)}" placeholder="별칭 — 예) SSCB" maxlength="20" autocomplete="off" spellcheck="false"><button type="button" class="krext-plan-btn krext-plan-save" data-act="st-alias-set">정하기</button><button type="button" class="krext-plan-btn" data-act="st-alias-cancel" title="취소 (Esc)">취소</button><span class="krext-dim">비우면 과제명 앞부분</span>${state.staffAliasError ? `<span class="krext-err krext-plan-err">${esc(state.staffAliasError)}</span>` : ''}</div>` : '';
    return `<div class="krext-ws-card krext-ws-head">${title}${info}${aliasForm}${yearTabs(p, plans, state, year)}${periodNote(p, plan, year)}</div>`;
  }
  /* 기간 줄 — 연차 이름 · 시작월 ~ 끝월(칸) · 예정/진행 중/지남 · 현재 연차 표시 · 마지막 수정 (과제 카드와 참여인력 변경 탭의 머리 공용) */
  function periodNote(p, plan, year) {
    const per = periodOf(p, plan, year);
    const cur = year === S.anlOf(p);
    const period = `<input type="month" data-stp="from" value="${esc(per.from)}" title="${esc(S.yearLabel(year))} 계획 기간의 첫 달 — 기본은 ${cur ? 'R&D ERP 의 연차 시작월' : '현재 연차 기간에서 12달씩 셈한 달'}. 바꾸면 기간 밖 달의 지급은 버립니다"> ~ <input type="month" data-stp="to" value="${esc(per.to)}" title="${esc(S.yearLabel(year))} 계획 기간의 마지막 달 — 기본은 ${cur ? 'R&D ERP 의 연차 종료월' : '현재 연차 기간에서 12달씩 셈한 달'}">`;
    return `<div class="krext-ws-note"><b>${esc(S.yearLabel(year))}</b> · ${period} · ${esc(yearState(per))}${cur ? ' · <span class="krext-ws-cur">R&amp;D ERP 현재 연차</span>' : ''}${plan && plan.at ? ` · <span class="krext-dim" title="이 연차 계획의 마지막 수정">${esc(F.fmtClock(plan.at))}${plan.by ? ` ${esc(plan.by)}` : ''}</span>` : ''}</div>`;
  }
  /* 연차 칩 줄 — 1차년도 … (R&D ERP 의 현재 연차는 "현재", 계획이 있으면 인원 배지), ＋ 로 다음 연차 칸 */
  function yearTabs(p, plans, state, cur) {
    const a = S.anlOf(p);
    const years = yearsOf(p, plans, state);
    const tabs = years.map((n) => {
      const plan = plans[S.planKey(p.prjNo, n)] || null, staff = staffOf(plan);
      const per = periodOf(p, plan, n);
      const tip = [S.yearLabel(n), spanText(per) || '기간 미정', n === a ? 'R&D ERP 의 현재 연차' : '', staff ? sumText(staff) : (plan && plan.budget && plan.budget.length ? `예산 ${S.budgetText(plan.budget)}` : '계획 없음')].filter(Boolean).join(' · ');
      return `<button type="button" class="krext-ws-year${n === cur ? ' krext-on' : ''}" data-act="st-year" data-year="${n}" aria-pressed="${n === cur}" title="${esc(tip)}">${esc(S.yearLabel(n))}${n === a ? '<small>현재</small>' : ''}${staff ? `<span class="krext-badge">${F.money(staff.people.length)}</span>` : ''}</button>`;
    });
    const next = years[years.length - 1] + 1;
    const span = S.yearSpan(p, next);
    const add = next <= S.YEAR_MAX ? `<button type="button" class="krext-ws-year krext-ws-add" data-act="st-year-add" data-year="${next}" title="${esc(S.yearLabel(next))} 칸을 엽니다${span.from ? ` (${esc(spanText(span))})` : ''}">＋ ${esc(S.yearLabel(next))}</button>` : '';
    return `<div class="krext-ws-years">${tabs.join('')}${add}</div>`;
  }
  /* 줄 아래 막대 — 계획 대비 몫을 색으로 이어 붙인다: 승인액 파랑 → 사용계획 주황 → 미청구 보라, 계획을 넘는 몫은 빨강(100% 에서 잘림) */
  function bars(r) {
    const plan = r.plan;
    const pct = (v) => (plan > 0 ? Math.min(100, (v / plan) * 100) : 0);
    const fix = (n) => String(Math.round(n * 100) / 100);
    let at = 0;
    return [{ k: 'base', v: r.appr }, { k: 'plan', v: r.pl }, { k: 'unbilled', v: r.ub }].map(({ k, v }, i) => {
      if (!(v > 0) && i) return '';
      const from = pct(at); at += v > 0 ? v : 0; const to = pct(at);
      return `<i class="krext-ws-bar ${k}${plan > 0 && at > plan ? ' over' : ''}" style="left:${fix(from)}%;width:${fix(to - from)}%"></i>`;
    }).join('');
  }
  /* 예산 카드 — 집행에 더하기(미청구 · 사용계획) · 복사, 머리글, 비목 줄(계획 칸 · 집행 · 잔액 · × · 막대), 미청구 보조 줄, 합계, ＋ 비목 · 기본값으로, rERP 자금현황 줄 */
  function budgetCard(p, plan, year, br, state) {
    const v = viewOf(state), open = !v.fold.budget;
    const sums = br.sums;
    const pct = sums.plan > 0 ? Math.round((sums.used / sums.plan) * 100) : 0;
    const stateTxt = `계획 ${S.thousand(sums.plan)} · 집행 ${S.thousand(sums.used)} (${pct}%)${sums.left < 0 ? ' · 초과' : ''}`;
    const head = `<button type="button" class="krext-ws-cardhead" data-act="st-fold" data-card="budget" aria-expanded="${open}" title="${open ? '접기' : '펴기'}">${ICON_BUDGET}<span>예산</span><span class="krext-ws-state${sums.left < 0 ? ' krext-red' : ''}" title="천원">${esc(stateTxt)}</span><i class="krext-ws-chev${open ? '' : ' krext-closed'}"></i></button>`;
    if (!open) return `<div class="krext-ws-card">${head}</div>`;
    const inc = v.inc;
    const arm = (key) => state.staffArm && state.staffArm.key === key && state.staffArm.until > nowMs();
    const tools = `<div class="krext-ws-tools"><span class="krext-ws-inc" title="비목별 집행은 R&amp;D ERP 승인액(현재 연차)입니다. 여기서 고른 것을 더합니다 — 미청구: 이 과제 카드로 썼지만 청구 전인 금액(연구활동비 줄에, 그 줄이 없으면 합계 위 한 줄) · 사용계획: 과제집행비율에 적어 둔 예상 비용. 승인전(청구했지만 결재 전)은 더하지 않습니다"><span>집행에 더하기</span><label><input type="checkbox" data-stinc="unbilled"${inc.unbilled ? ' checked' : ''}> 미청구</label><label><input type="checkbox" data-stinc="plan"${inc.plan ? ' checked' : ''}> 사용계획(예상 비용)</label></span><button type="button" class="krext-ico-btn" data-act="st-bcopy" title="예산 표 복사 — 비목별 계획·집행·잔액과 합계를 탭으로 나눈 표로(엑셀·한글 표에 그대로 붙습니다)">${ICON_COPY}</button></div>`;
    const bhead = '<div class="krext-ws-bhead"><span>비목</span><span>계획(천원)</span><span>집행(천원)</span><span>잔액</span><span></span></div>';
    const rows = br.rows.map((r, i) => {
      const usedTip = [`${r.name || '비목'} 집행(천원)`, r.erp ? `R&D ERP 승인액 ${S.thousand(r.appr)}` : (br.cur ? 'R&D ERP 에 없는 비목' : '다른 연차 — R&D ERP 집행 없음'), r.pl ? `+ 사용계획(예상 비용) ${S.thousand(r.pl)}` : '', r.ub ? `+ 미청구 ${S.thousand(r.ub)}` : '', r.req ? `(승인전 ${S.thousand(r.req)} 은 더하지 않음)` : ''].filter(Boolean).join(' · ');
      const over = r.left != null && r.left < 0;
      const name = `<input type="text" data-stb="name" data-i="${i}" value="${esc(r.name)}" placeholder="비목" maxlength="40" autocomplete="off" spellcheck="false">`;
      const planCell = `<input type="text" data-stb="plan" data-i="${i}" value="${r.plan == null ? '' : esc(S.thousand(r.plan))}" placeholder="0" inputmode="numeric" autocomplete="off" title="${esc(r.name || '비목')} 계획(천원)${br.src === 'erp' ? ' — R&D ERP 예산액' : br.src === 'yaml' ? ' — 연구개발계획서' : ''}">`;
      return `<div class="krext-ws-brow${r.erp ? ' krext-ws-erp' : ''}" data-i="${i}">${name}${planCell}<span class="krext-ws-cell krext-ws-num krext-ws-used" title="${esc(usedTip)}">${esc(S.thousand(r.used))}</span><span class="krext-ws-left${over ? ' krext-over' : ''}" title="잔액(천원) = 계획 − 집행">${r.left == null ? '' : esc(S.thousand(r.left))}</span><button type="button" class="krext-ws-bdel" data-act="st-bdel" data-i="${i}" title="이 비목 빼기">×</button><span class="krext-ws-bars" aria-hidden="true">${bars(r)}</span></div>`;
    }).join('');
    const loose = br.loose ? `<div class="krext-ws-brow krext-ws-extra" title="이 과제 카드로 썼지만 아직 청구하지 않은 금액 — 연구활동비 줄이 없어 합계에서만 뺍니다"><span class="krext-ws-cell">미청구 · 과제카드 ${F.money(br.loose.count)}건</span><span></span><span class="krext-ws-cell krext-ws-num">${esc(S.thousand(br.loose.amt))}</span><span class="krext-ws-left krext-over">${esc(S.thousand(-br.loose.amt))}</span><span></span></div>` : '';
    const sum = `<div class="krext-ws-bsum"><span>합계</span><span>${esc(S.thousand(sums.plan))}</span><span>${esc(S.thousand(sums.used))}</span><span class="${sums.left < 0 ? 'krext-red' : ''}">${esc(S.thousand(sums.left))}</span><span></span></div>`;
    const srcTxt = { plan: '직접 적은 계획', erp: 'R&D ERP 예산액(자금현황)', yaml: `연구개발계획서 ${br.rec ? `${br.rec.n}차년도${br.rec.rev ? ` ${br.rec.rev}` : ''}` : ''}`, default: '비목만 (계획을 적으세요)' }[br.src] || '';
    const resetKey = `breset:${p.prjNo}@${year}`;
    const acts = `<div class="krext-ws-bact"><button type="button" class="krext-plan-btn" data-act="st-badd" title="비목 줄 더하기">＋ 비목</button>${br.src === 'plan' ? `<button type="button" class="krext-plan-btn${arm(resetKey) ? ' krext-red' : ''}" data-act="st-breset" title="직접 적은 계획을 지우고 기본값(현재 연차는 R&amp;D ERP 예산액, 다른 연차는 연구개발계획서의 비목별 예산)으로 — 두 번 누릅니다">${arm(resetKey) ? '정말 되돌리기' : '기본값으로'}</button>` : ''}<span class="krext-dim">계획: ${esc(srcTxt)}</span></div>`;
    const b = p.budget;
    const erpLine = br.cur && b
      ? `<div class="krext-ws-erpline"><span>rERP 자금현황(원) · 예산 ${F.money(b.bgtAmt)} · 승인 ${F.money(b.apprAmt)} · 미청구 ${F.money(b.unbilled || 0)} · 승인전 ${F.money(b.reqAmt || 0)}</span><a href="${esc(fundLink(p.prjNo))}" target="_blank" rel="noopener" title="R&amp;D ERP 과제정보 › 자금현황 탭">열기 ${ICON_EXT}</a></div>`
      : `<div class="krext-ws-erpline"><span class="krext-dim">${br.cur ? 'rERP 자금현황을 아직 받지 못했습니다 — 제목 줄 ↻' : `rERP 자금현황은 현재 연차(${S.anlOf(p)}차년도)만 — 이 연차의 집행은 0 입니다`}</span></div>`;
    return `<div class="krext-ws-card">${head}<div class="krext-ws-body">${tools}<div class="krext-ws-budget-scroll" tabindex="0" role="region" aria-label="비목별 예산 표"><div class="krext-ws-budget-grid">${bhead}${rows}${loose}${sum}</div></div>${acts}${erpLine}</div></div>`;
  }
  /* 참여인력 카드 — KRS WORKSPACE R&D 탭 참여인력 칸(kr_ext_workspace rndpanel.js staffHtml · paintSupport)과 같은 꼴(2026-10-19 사용자 "rerp 랑 workspace 랑 유사한 디자인이잖아. 이건 각각 동일하게 해주고. 추가 메뉴버튼만 rerp 에 참여연구원 변경 버튼만 추가"):
   * 머리(연구자 n명 · 행정 n명 — 계획이면 뒤에 · 초과 n | · 부족 n) → [참여연구원 변경 ↗] 단추 하나(패널 카드만) → rERP 상태 한 줄(rERP 과제번호 · 시각 조회 · ↻ · M · 복사) → 사람 표(보기만 — 성명 · 역할(책임/참여/행정) · 월급여 · 참여 · 지급 합 · 참여율(아래 월 최대))
   * → 알림 · 메시지 → 행정지원 구역(성명 · 맡은 일 · 공문 참조 · × · 사람 더하기 — 양쪽이 고침). 계획이 아직 없으면 rERP 등록 지급계획(이 기간)을 보인다(WORKSPACE 가 보이는 것과 같음).
   * pinned(참여연구원 변경 탭): 접지 않는 머리(참여인력 · 연구자 n명 · 행정 n명 + 앞 연차에서 가져오기 · 계획 관리 · ＋ 참여인력) → 얇은 계획 인건비·예산·차이·천원 단위 요약 → rERP 상태 줄 → 월급여·지급 합·참여율 칸과 역할 선택·✎·× 가 있는 표 — 계획 편집은 여기서만.
   *   요약 세 칸(참여인력 · 계획 인건비 · 인건비 예산)은 2026-10-19 사용자 "3개는 또 왜 이렇게 크냐. 막상 중요한 참여연구원이 한참 아래에 있잖아" 로 뺐다 */
  function staffCard(p, plan, year, br, state, pinned) {
    const v = viewOf(state), open = pinned || !v.fold.staff;
    const c = staffCtx(p, plan, year, state);
    const budget = budgetOf(p, plan, year, br.rows);
    const view = !pinned && !c.staff && c.erpPeople && c.erpPeople.people.length ? c.erpPeople : null;   // 패널 카드에서 계획이 없을 때 보이는 rERP 등록 지급계획(이 기간)
    const shown = c.staff || view;
    const admin = (q) => q.role === '행정지원';
    const researchers = shown ? shown.people.filter((q) => !admin(q)).length : 0;
    const adminCount = c.support.length + (shown ? shown.people.filter(admin).length : 0);
    const total = c.staff ? S.staffTotal(c.staff, c.staff.basis) : null;
    const bd = S.budgetDiff(c.staff ? { total, budget } : null);
    const diffTxt = bd.kind === 'over' ? ` · 초과 ${S.thousand(bd.diff)}` : bd.kind === 'short' ? ` · 부족 ${S.thousand(-bd.diff)}` : '';
    const people = [researchers ? `연구자 ${F.money(researchers)}명` : '', adminCount ? `행정 ${F.money(adminCount)}명` : ''].filter(Boolean).join(' · ') || '계획 없음';
    // 탭 머리는 인원만, 계획·예산·차이는 바로 아래 얇은 요약 줄에(큰 요약 카드 없이 표를 위로).
    const stateTxt = pinned ? people : people + diffTxt;
    const stateTip = `연구자 수 · 행정지원 수${c.staff ? ` · 인건비 계획 합 ${S.thousand(total)}${budget != null ? ` / 예산 ${S.thousand(budget)}` : ''}천원 — 초과금(합이 예산을 넘음) 또는 부족금(예산보다 적게 잡음)` : view ? ' — 계획이 아직 없어 rERP 등록 지급계획을 보입니다' : ''}`;
    const inner = `${ICON_PEOPLE}<span>참여인력</span><span class="krext-ws-state${!pinned && bd.kind === 'over' ? ' krext-red' : !pinned && bd.kind === 'short' ? ' krext-st-short' : ''}" title="${esc(stateTip)}">${esc(stateTxt)}</span>`;
    // 숫자는 한 줄의 얇은 요약으로 분리한다. 큰 요약 카드 없이 연구원 표를 바로 이어 보인다.
    const summary = pinned ? `<div class="krext-st-budgetline" aria-label="인건비 계획과 예산"><span>계획 인건비 <strong>${total == null ? '—' : esc(S.thousand(total))}</strong></span><span>예산 <strong>${budget == null ? '미설정' : esc(S.thousand(budget))}</strong></span>${bd.text ? `<span class="krext-st-budgetstate krext-st-budget-${esc(bd.kind)}">${bd.kind === 'even' ? '✓ ' : ''}${esc(bd.text)}</span>` : ''}<span class="krext-st-unit">금액 단위: 천원</span></div>` : '';
    const head = pinned
      ? `<div class="krext-ws-cardhead krext-ws-pinned">${inner}${actsOf(p.prjNo, plan, year, state, true, p)}</div>`   // 탭: 앞 연차에서 가져오기 · 계획 관리(초기화·지우기) · ＋ 참여인력을 머리 오른쪽에
      : `<button type="button" class="krext-ws-cardhead" data-act="st-fold" data-card="staff" aria-expanded="${open}" title="${open ? '접기' : '펴기'}">${inner}<i class="krext-ws-chev${open ? '' : ' krext-closed'}"></i></button>`;
    if (!open) return `<div class="krext-ws-card">${head}</div>`;
    return `<div class="krext-ws-card${v.months ? ' krext-st-months-open' : ''}">${head}${summary}<div class="krext-ws-body">${staffBody(p, plan, year, budget, state, pinned, c, view)}</div></div>`;
  }
  /* 카드가 쓰는 값 — rERP 조회 캐시 · 기간 · 달들 · 계획(staff) · 이 기간의 rERP 등록 지급계획(erpPeople) · 전체 등록(erpAll) · 행정지원 */
  function staffCtx(p, plan, year, state) {
    const prjNo = p.prjNo;
    const cache = (state.staffRows || {})[prjNo] || null;
    const per = periodOf(p, plan, year);
    const months = S.ymRange(per.from, per.to);
    const rows = cache && cache.rows ? cache.rows : null;
    const paid = paidOf(plan, cache, year === S.anlOf(p));
    return { prjNo, cache, per, months, staff: staffOf(plan), erpPeople: rows ? S.peopleOfErp(rows, { prjNo, now: cache.at, months: months.length ? months : null }) : null, erpAll: rows ? S.peopleOfErp(rows, { prjNo }) : null, support: supportOf(state, prjNo).people, paid, lock: S.lockOf(paid) };
  }
  /* 지급 완료 — 계획에 실린 것(plan.paid — 공유 파일로도 옴)과 이 세션의 rERP 조회(cache.paid — 현재 연차(current)만) 가운데 조회 시각 at 이 늦은 쪽. 없으면 null */
  const paidOf = (plan, cache, current) => { const a = plan && plan.paid ? plan.paid : null, b = current && cache && cache.paid ? cache.paid : null; return a && b ? (b.at > a.at ? b : a) : (a || b); };
  /* 자금현황 비목 줄(fetchBudget items)의 인건비(수당 아님) 승인액 합(원) — 없으면 null */
  const payApprOf = (items) => { const hit = (Array.isArray(items) ? items : []).filter((x) => x && S.isPayItem(x.exp || x.item)); return hit.length ? hit.reduce((s, x) => s + (F.num(x.appr) || 0), 0) : null; };
  const erpClock = (t) => { const d = new Date(t); return `${F.pad2(d.getMonth() + 1)}.${F.pad2(d.getDate())} ${F.pad2(d.getHours())}:${F.pad2(d.getMinutes())}`; };   // WORKSPACE 의 rERP 조회 시각 꼴 "10.19 18:21"(src/rnderp.js clock)
  /* 단추 줄 — 탭(pinned): (2차년도부터) n−1차년도에서 가져오기 · 계획 관리(rERP 현재로 · 이전 기간 비율로 · n차년도 지우기(두 번)) · ＋ 참여인력. 계획 관리는 현재 탭의 과제·연차별로 펼침을 유지. 패널 카드: [참여연구원 변경 ↗] 하나. p 는 과제(가져오기의 재료를 셈) */
  function actsOf(prjNo, plan, year, state, pinned, p = null) {
    const yl = S.yearLabel(year);
    const arm = (key) => state.staffArm && state.staffArm.key === key && state.staffArm.until > nowMs();
    if (!pinned) return `<div class="krext-st-acts"><button type="button" class="krext-plan-btn krext-st-tab" data-act="st-tab" title="참여연구원 변경 — 이 과제 ${esc(yl)} 의 참여연구원 계획(rERP 현재로 · 이전 기간 비율로 · ＋ 참여인력 · 월급여·지급 합·참여율 칸 · ✎ 적용일부터 · 지우기)을 브라우저 탭에서 넓게 고칩니다(같은 계획, 바꾸면 여기에도 바로). 이미 열린 탭이 있으면 그 탭으로 갑니다">참여연구원 변경 ${ICON_EXT}</button></div>`;
    const clearKey = 'clear:' + prjNo + '@' + year;
    const panelKey = S.planKey(prjNo, year);
    const manageOpen = !!(state.staffPlanOpen && state.staffPlanOpen[panelKey]) || arm(clearKey);
    return `<div class="krext-st-acts">${p && year > 1 ? carryBtn(p, plan, year, state, arm('carry:' + prjNo + '@' + year)) : ''}
        <details class="krext-st-plan-menu" data-stplan="${esc(panelKey)}"${manageOpen ? ' open' : ''}><summary>계획 관리</summary><div class="krext-st-plan-options"><span class="krext-st-menu-label">계획 가져오기 · 초기화</span>
        <button type="button" class="krext-plan-btn" data-act="st-init-erp" title="rERP 에 등록된 지급계획(이 기간의 달들)을 그대로 계획으로 — 사람마다 월급여(지급한도액)·월별 지급">rERP 현재로</button>
        <button type="button" class="krext-plan-btn" data-act="st-init-prev" title="이 기간 앞 12달의 rERP 지급 비율(없으면 앞 연차 계획의 비율)로 인건비 예산(예산 칸의 인건비 줄)을 나눠 초기화 — 다음 연차처럼 rERP 에 아직 없는 기간에">이전 기간 비율로</button>
        ${plan ? `<button type="button" class="krext-plan-btn${arm(clearKey) ? ' krext-red' : ''}" data-act="st-clear" title="이 과제 ${esc(yl)} 계획(예산 줄·참여인력)을 지웁니다(두 번)">${arm(clearKey) ? '정말 지우기' : `${esc(yl)} 지우기`}</button>` : ''}
        </div></details><button type="button" class="krext-plan-btn" data-act="st-add" title="참여인력 추가 — 책임·참여·행정 역할 선택">＋ 참여인력</button>
      </div>`;
  }
  /* [n−1차년도에서 가져오기] — 2차년도부터 단추 줄 맨 앞. 재료(carrySource)를 아직 모르면(rERP 조회 전) 켜 두고 누르면 조회부터, 조회했는데도 없으면 꺼짐. 계획에 사람이 있으면 두 번 누른다(지금 계획을 바꿈 — armed 면 "정말 가져오기") */
  function carryBtn(p, plan, year, state, armed) {
    const prev = S.yearLabel(year - 1), src = carrySource(p, year, state);
    const cache = (state.staffRows || {})[p.prjNo];
    if (!src && cache && cache.rows && !cache.loading) return `<button type="button" class="krext-plan-btn" data-act="st-init-carry" disabled title="${esc(`${prev} 계획도, rERP 에 ${prev} 기간의 지급계획도 없어 가져올 것이 없습니다`)}">${esc(prev)}에서 가져오기</button>`;
    const per = periodOf(p, plan, year), n = S.ymRange(per.from, per.to).length;
    const what = src ? `${prev} ${src.from === 'plan' ? '계획' : 'rERP 등록 지급계획'}(${F.money(src.staff.people.length)}명)` : `${prev} 계획(없으면 그 기간의 rERP 등록 지급계획)`;
    const tip = `${what}의 연구원(성명·역할)·월급여·참여율(마지막 구간)을 가져와 이 연차 기간 전체${n ? `(${S.ymText(per.from, per.to)}, ${n}개월)` : ''}의 달마다 월급여 × 참여율로 넣습니다 — 마지막이 제외인 사람은 뺍니다${staffOf(plan) ? '. 지금 계획을 바꾸므로 두 번 누릅니다' : ''}`;
    return `<button type="button" class="krext-plan-btn${armed ? ' krext-red' : ''}" data-act="st-init-carry" title="${esc(tip)}">${armed ? '정말 가져오기' : `${esc(prev)}에서 가져오기`}</button>`;
  }
  function staffBody(p, plan, year, budget, state, pinned, c, view) {
    const { prjNo, cache, months, staff, erpPeople, erpAll } = c;
    const basis = staff ? staff.basis : 'rerp';
    const yl = S.yearLabel(year);
    const acts = pinned ? '' : actsOf(prjNo, plan, year, state, false);   // 탭은 머리 줄에(staffCard)
    let status, statusTip = '';
    if (!cache) status = 'rERP 참여인력을 아직 조회하지 않았습니다.';
    else if (cache.loading) status = 'rERP 참여인력 조회 중…';
    else if (cache.error) status = `<span class="krext-err">rERP 조회 실패: ${esc(cache.error)}</span>`;
    else { status = `rERP ${esc(prjNo)} · ${esc(erpClock(cache.at))} 조회`; statusTip = `R&D ERP 과제정보 › 참여인력 ${F.money(erpAll ? erpAll.people.length : 0)}명${erpPeople ? ` · 이 기간 지급 ${F.money(erpPeople.people.length)}명` : ' · 이 기간 지급 없음'} · ${F.fmtClock(cache.at)} 조회`; }
    // 지급 완료 — 자금현황 인건비 승인액으로 셈한 "몇 월까지"(현재 연차). 승인액을 받았는데 한 달도 안 됐으면 '지급 전'
    if (c.paid) status += ` · <span class="krext-st-paidst" title="${esc(S.paidText(c.paid))} — 그 달까지의 계획은 바꿀 수 없습니다 (${esc(F.fmtClock(c.paid.at))} 조회)">지급 ~${esc(S.monthLabel(c.paid.through))}</span>`;
    else if (cache && !cache.loading && cache.appr != null) status += ` · <span class="krext-st-paidst" title="rERP 자금현황 인건비 승인액 ${esc(S.thousand(cache.appr))}천원 — 아직 한 달치도 지급되지 않았습니다">지급 전</span>`;
    const shown = staff || view;
    const tools = `<div class="krext-ws-tools"><span class="krext-sub krext-dim krext-st-status"${statusTip ? ` title="${esc(statusTip)}"` : ''}>${status}</span><button type="button" class="krext-ico-btn" data-act="st-refresh" aria-label="rERP 참여인력 다시 조회" title="rERP 참여인력(월급여·지급계획)과 다른 과제 참여율을 다시 조회"${cache && cache.loading ? ' disabled' : ''}>${ICON_REFRESH}</button>${shown && pinned && staff ? '<span class="krext-sub krext-dim krext-st-pickhint" title="달마다의 지급 격자에서 같은 사람의 달 칸을 누르거나 끌어 고르면 그 달들을 바꾸는 폼이 열립니다 — 달 중간의 날은 폼의 적용일·종료일로">달 칸을 누르거나 끌어 고르세요</span>' : ''}${shown ? `<button type="button" class="krext-ico-btn krext-st-month-toggle${viewOf(state).months ? ' krext-on' : ''}" data-act="st-months" aria-pressed="${!!viewOf(state).months}" aria-label="${pinned ? 'rERP 등록 비교' : '달마다의 지급'} ${viewOf(state).months ? '접기' : '보이기'}" title="${pinned ? 'rERP 등록 비교 줄 보이기/접기 — 달마다의 지급 격자는 늘 보입니다' : '달마다의 지급과 rERP 등록 비교 보이기/접기'}">M</button>` : ''}${shown || c.support.length ? `<button type="button" class="krext-ico-btn" data-act="st-copy" aria-label="참여인력 표 복사" title="이 연차의 참여인력 표(탭으로 나눈 글)를 복사">${ICON_COPY}</button>` : ''}</div>`;
    const editing = pinned && state.staffEdit && state.staffEdit.prjNo === prjNo && state.staffEdit.year === year ? state.staffEdit : null;
    let table;
    const book = S.mergeOthers(collectBook(state, prjNo, year, p), staff);   // 다른 과제 월별 참여율(rERP · 응답) — 100% 검사 · MAX(증감 줄 · 응답 반영)
    if (staff) table = staffTable(prjNo, year, staff, months, erpPeople, state, editing, pinned, budget, c.lock, book);
    else if (view) table = `<div class="krext-sub krext-dim">${esc(yl)} 계획이 아직 없어 rERP 등록 지급계획(이 기간)을 보입니다 — 계획은 <b>참여연구원 변경</b>에서 세웁니다.</div>${staffTable(prjNo, year, view, months, null, state, null, false, null, c.lock)}`;
    else {
      let hint;
      const loaded = !!(cache && cache.rows && !cache.loading);
      const prevY = pinned && year > 1 && (carrySource(p, year, state) || !loaded) ? S.yearLabel(year - 1) : '';   // 2차년도부터 — 가져올 것이 있거나 아직 모를 때
      const carryTxt = prevY ? `<b>${esc(prevY)}에서 가져오기</b>(${esc(prevY)} 연구원·월급여·참여율을 이 기간 전체에)` : '';
      if (!pinned) hint = '<b>참여연구원 변경</b>에서 rERP 현재로 · 이전 기간 비율로 초기화하거나 ＋ 참여인력으로 적습니다.';
      else if (loaded) hint = erpPeople ? `<b>계획 관리 → rERP 현재로</b> 를 누르면 등록된 지급계획으로 계획을 세웁니다${carryTxt ? ` — 또는 ${carryTxt}` : ''}.` : `rERP 에 이 기간의 지급계획이 없습니다 — ${carryTxt ? `${carryTxt}, ` : ''}<b>계획 관리 → 이전 기간 비율로</b>(인건비 예산을 앞 12달의 rERP 지급, 없으면 앞 연차 계획의 비율로 나눔) 또는 <b>＋ 참여인력</b>.`;
      else hint = `${carryTxt ? `${carryTxt} 를 누르거나, ` : ''}조회가 끝나면 <b>계획 관리</b>에서 <b>rERP 현재로</b> 또는 <b>이전 기간 비율로</b> 초기화하거나 <b>＋ 참여인력</b> 으로 적습니다.`;
      table = `<div class="krext-sub krext-dim">${esc(yl)} 인건비 계획이 아직 없습니다. ${hint}</div>${editing && editing.id === 'new' ? staffTable(prjNo, year, { basis, people: [] }, months, erpPeople, state, editing, true, budget, c.lock, book) : ''}`;
    }
    // 알림 — 계획이면 100% 초과 · 월급여 없음 · 예산 대비 · 지급 완료(그 달의 계획이 rERP 등록과 다르면 경고), rERP 등록 지급계획만 보일 때는 100% 초과만(WORKSPACE 와 같음)
    const warns = staff ? S.checks(staff, basis, { others: book, budgetPay: budget, paid: c.paid, erp: erpPeople }).filter((w) => !pinned || w.kind !== 'even') : view ? S.checks(view, 'rerp', { others: S.mergeOthers({}, view) }).filter((w) => w.kind === 'over') : [];   // 예산 일치는 위 요약에 한 번만, 주의·초과 알림은 표 아래에도 유지
    const warnHtml = warns.length ? `<ul class="krext-st-warn">${warns.map((w) => `<li class="krext-st-${w.level}">${esc(w.text)}</li>`).join('')}</ul>` : '';
    const msg = state.staffMsg && state.staffMsg.prjNo === prjNo && state.staffMsg.year === year && state.staffMsg.text ? `<div class="krext-sub krext-st-msg${state.staffMsg.error ? ' krext-err' : ''}" role="status">${esc(state.staffMsg.text)}</div>` : '';
    return `${acts}${tools}${table}${warnHtml}${msg}${supportSection(prjNo, state)}${pinned ? collectSection(p, plan, year, state, c, { budget, months, book, lock: c.lock }) : ''}`;   // 자료 요청 구역은 탭에만(SharePoint 양식 · 팀즈 · 응답 취합)
  }
  /* 행정지원 구역(표 아래, 과제 공통 — 연차 아님): 머리(행정지원 · 사람 더하기 아이콘) · 표(성명 · 맡은 일 · 공문 참조 · ×) — 칸에 바로 적는다. 더하기는 빈 줄(data-i="new" — 이름을 적으면 저장, Esc·× 로 거둠).
   * storage.local.projectSupport[prjNo] = { people[{ name, role, ref }], at } — 연차 파일 project.support · supportAt 로 KRS WORKSPACE 와 양쪽이 맞춤(supportAt 큰 쪽, background.js SHARE_SUPPORT_KEY). WORKSPACE R&D 탭 참여인력 칸의 행정지원(rndpanel.js paintSupport)과 같은 꼴.
   * 2026-10-19 사용자 "참여인력 변경, 예산 변경등은 rerp 에서만 할게 … 행정지원은 서로 변경 가능하고" */
  function supportSection(prjNo, state) {
    const cur = supportOf(state, prjNo);
    const draft = state.staffSupportNew && state.staffSupportNew.prjNo === prjNo ? state.staffSupportNew : null;
    const row = (q, i, label) => `<tr class="krext-st-support-row" data-i="${i}">
      <td class="krext-st-nm"><input type="text" data-sts="name" data-i="${i}" value="${esc(q.name)}" placeholder="이름" maxlength="40" autocomplete="off" spellcheck="false" aria-label="행정지원 ${esc(label)} 이름" title="${i === 'new' ? '이름을 적으면 저장됩니다 (Esc 로 거둠)' : '행정지원 이름 — 비우면 줄을 뺍니다'}"></td>
      <td class="krext-st-sup-role"><input type="text" data-sts="role" data-i="${i}" value="${esc(q.role)}" placeholder="예) 행정 담당" maxlength="40" autocomplete="off" aria-label="행정지원 ${esc(label)} 맡은 일"></td>
      <td class="krext-st-sup-ref"><label class="krext-st-support-ref" title="이 과제의 공문(구매·교육·출장)마다 결재선의 참조자로 넣습니다"><input type="checkbox" data-sts="ref" data-i="${i}"${q.ref ? ' checked' : ''} aria-label="행정지원 ${esc(label)} 공문 참조"></label></td>
      <td class="krext-st-act"><span class="krext-plan-acts"><button type="button" data-act="st-sup-del" data-i="${i}" aria-label="행정지원 ${esc(label)} 빼기" title="${i === 'new' ? '거두기' : '이 사람 빼기'}">×</button></span></td>
    </tr>`;
    const rows = cur.people.map((q, i) => row(q, i, q.name || String(i + 1))).concat(draft ? [row(draft, 'new', '새 사람')] : []).join('');
    const full = cur.people.length >= S.SUPPORT_MAX;
    const head = `<div class="krext-st-sup-head"><strong title="과제 공통 — 모든 연차에서 함께 관리하며 KRS WORKSPACE 와 공유합니다">행정지원</strong><button type="button" class="krext-ico-btn" data-act="st-sup-add" aria-label="행정지원 더하기" title="${full ? `행정지원은 과제마다 ${S.SUPPORT_MAX}명까지입니다` : '사람 더하기 — 행정 담당 등. 공문 참조를 켜면 이 과제의 공문마다 참조자로 들어갑니다'}"${full ? ' disabled' : ''}>${ICON_PERSON_ADD}</button></div>`;
    return `<div class="krext-st-sup">${head}${rows ? `<table class="krext-cards krext-st-table krext-st-sup-table"><thead><tr><th class="krext-st-nm">성명</th><th>맡은 일</th><th>공문 참조</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : ''}</div>`;
  }
  /* ---------- 자료 요청 (참여연구원 변경 탭 — SharePoint 응답 목록 · 팀즈 딥 링크 · 응답 취합, lib/collect.js, 0.8.9) ---------- */
  /* 자료 요청의 저장 키 — "과제번호@연차"(첫 요청) · "과제번호@연차#no"(추가 요청; KRX_COLLECT.planKey) */
  const coKey = (prjNo, year, no) => (C() ? C().planKey(prjNo, year, no) : S.planKey(prjNo, year));
  /* 단추·칸이 든 요청 카드(.krext-st-collect[data-cono])의 no — 없으면 1 */
  const coNoOf = (el) => { const b = el && typeof el.closest === 'function' ? el.closest('.krext-st-collect') : null; return b && b.dataset && Number(b.dataset.cono) >= 1 ? Math.floor(Number(b.dataset.cono)) : 1; };
  /* 이 과제·연차의 no 번째 요청(state.staffCollect — 정리해서) | null */
  const reqOf = (state, prjNo, year, no) => { const C_ = C(); const key = coKey(prjNo, year, no); const r = (state.staffCollect || {})[key]; return C_ && r ? C_.normalizeRequest(r, key) : null; };
  /* 이 과제·연차의 요청들 — no 차례 */
  const reqsOf = (state, prjNo, year) => (C() ? C().requestsOf(state.staffCollect, prjNo, year) : []);
  const collectCtx = (state, p) => ({ alias: aliasOf(state, p.prjNo), prjNo: p.prjNo, prjNm: (p && p.prjNm) || '', template: (((state.data || {}).settings || {}).teamsTemplate) || '' });   // template: 설정의 팀즈 글 템플릿(캐시 settings.teamsTemplate — lib/rnd-api.js)
  /* 응답의 다른 과제 참여율 → KRX_STAFF.mergeOthers 의 book(100% 검사에 저절로 — rERP 가 모르는 다른 과제를 연구원이 알려 준 것) */
  const collectBook = (state, prjNo, year, p) => { const C_ = C(); if (!C_) return {}; const out = {}; for (const req of reqsOf(state, prjNo, year)) for (const [k, v] of Object.entries(C_.otherBook(req, collectCtx(state, p || { prjNo })))) out[k] = (out[k] || []).concat(v); return out; };   // 요청 모두의 다른 과제 줄
  /* 요청 대상 이름 — 계획의 참여연구원(행정지원 역할 제외), 계획이 없으면 이 기간의 rERP 등록 지급계획 사람들. 내 이름(state.staffWho — R&D ERP 로그인 이름)은 뺀다(백그라운드도 뺌) */
  function collectNames(state, prjNo, year, plan, c) {
    const staff = staffOf(plan);
    const list = staff ? staff.people.filter((q) => q.role !== '행정지원').map((q) => q.name) : (c && c.erpPeople ? c.erpPeople.people.map((q) => q.name) : []);
    const me = String((state && state.staffWho) || '');
    return Array.from(new Set(list.map((n) => String(n || '').trim()).filter((n) => n && !(me && S.sameName(n, me)))));
  }
  /* 자료 요청 구역 — 요청이 없으면 설명 + [자료 요청 만들기]; 있으면 주요 단추 · 공유/응답/실패 요약 · 양식 줄 · 메시지 · 사람 표 · 응답 표 → 접힌 메시지·채팅방 설정(현재 탭에서 펼침 유지). 카드는 머리의 ▾/▸ 로 접고(state.staffCollectOpen["키:card"] === false 면 머리만) [지우기]는 머리 단추 줄 끝(두 번). 표는 좁은 창에서 가로 스크롤. c = staffCtx(기간 · rERP 등록) */
  /* 적용일이 없는 change — 그 사람의 지급이 있는 전체 기간(없으면 계획 기간). bind 의 runOp(변경 도우미)와 응답 반영이 쓴다 */
  const wholeOf = (q, months) => { const active = q.plan.filter((x) => x.amt > 0); const first = active[0] || q.plan[0], last = active[active.length - 1] || q.plan[q.plan.length - 1]; return { from: first ? S.segStart(first) : (months[0] ? S.monthStart(months[0]) : ''), to: last ? S.segEnd(last) : (months.length ? S.monthEnd(months[months.length - 1]) : '') }; };
  /* 응답 줄의 반영 항목 — 체크 상자(state.staffCollectPick[키:응답 id] = { period, rate, monthly, allowance } — 끈 것만 false)와 줄에 있는 값으로. 값이 없는 항목은 늘 false */
  const coPickOf = (r, picks) => { const k = picks || {}; return { period: !!r.from && k.period !== false, rate: r.rate != null && k.rate !== false, monthly: r.monthly > 0 && k.monthly !== false, allowance: r.allowance > 0 && k.allowance !== false }; };
  /* 응답 줄의 적용일~종료일 — 기간을 켰으면 응답의 시작 달 1일~끝 달 마지막 날(끝이 없으면 시작 달), 아니면 그 사람의 지급이 있는 전체 기간(계획에 없는 사람은 계획 기간) */
  const responseRange = (r, usePeriod, q, months) => (usePeriod && r.from ? { from: S.monthStart(r.from), to: S.monthEnd(r.to || r.from) } : q ? wholeOf(q, months) : { from: months[0] ? S.monthStart(months[0]) : '', to: months.length ? S.monthEnd(months[months.length - 1]) : '' });
  /* 응답 줄의 최대 참여율(S.maxRate — 예산 나머지 · 100% 규칙) — 참여율 칸의 "최대 n%" 표기와 반영(그 값으로 자름)이 같은 셈. 체크 상자대로 월급여(응답 값)·기간을 쓴 뒤의 값. 월급여가 없거나 기간이 계획 밖이면 throw */
  function responseMax(plan, r, { budget = null, months = [], book = {}, lock = '' } = {}, pk = {}) {
    const staff = staffOf(plan) || { basis: 'rerp', people: [] };
    const q = staff.people.find((x) => S.sameName(x.name, r.name)) || null;
    let person = q || S.normalizePerson({ name: r.name });
    if (pk.monthly !== false && r.monthly > 0) person = Object.assign({}, person, { manual: Math.round(r.monthly / 1000) * 1000 });
    const others = S.staffTotal({ people: staff.people.filter((x) => !q || x.id !== q.id) }, staff.basis);
    return S.maxRate(person, staff.basis, responseRange(r, pk.period !== false, q, months), months, { budgetPay: budget, others, lock, others100: (book || {})[S.nameKeyOf(r.name)] || [] });
  }
  const maxTip = (mx) => `넣을 수 있는 최대 참여율 — ${mx.byBudget != null ? `인건비 예산 나머지 ${S.thousand(mx.left)}천원 기준 ${mx.byBudget}%` : '인건비 예산 없음'} · 100% 규칙(다른 과제 참여율) 기준 ${mx.by100}%. 응답이 이보다 크면 최대로 반영합니다`;
  function collectSection(p, plan, year, state, c, x = {}) {
    const C_ = C(); if (!C_) return '';
    const prjNo = p.prjNo, base = S.planKey(prjNo, year), reqs = reqsOf(state, prjNo, year);
    const nextNo = reqs.length ? Math.max(...reqs.map((r) => r.no)) + 1 : 1;
    const showNew = !reqs.length || !!(state.staffCollectNew || {})[base];   // 요청이 없거나 [요청 추가]를 눌렀을 때 새 요청 폼
    const head = `<div class="krext-st-sup-head krext-st-co-head"><div class="krext-st-co-heading"><strong title="참여연구원에게 SharePoint 응답 양식(내 OneDrive 의 목록) 링크를 팀즈로 보내고, 응답(참여 기간 · 참여율 · 월급여 · 남은 연구수당 · 다른 과제 참여율)을 받아(팀즈로 보낸 뒤 회신이 올 때까지 자동 갱신마다 저절로) 이 계획에 반영합니다">자료 요청</strong><span class="krext-sub krext-dim">양식 공유 → 팀즈 안내 → 응답 반영${reqs.length ? ` · 요청 ${reqs.length}개` : ''}</span></div>${reqs.length ? `<span class="krext-st-co-acts"><button type="button" class="krext-plan-btn" data-act="st-co-new" title="같은 과제·연차에 양식(목록)을 하나 더 만듭니다 — 다른 칸을 묻거나 나중에 다시 물을 때. 요청마다 따로 공유·응답 받기·반영">${showNew ? '추가 취소' : '요청 추가'}</button></span>` : ''}</div>`;
    return `<div class="krext-st-collects" data-cobase="${esc(base)}">${head}${reqs.map((req) => collectCard(p, plan, year, state, c, req, x)).join('')}${showNew ? collectNew(p, plan, year, state, c, nextNo) : ''}</div>`;
  }
  const COLLECT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>';
  /* 요청(카드)마다 공통 — 진행 중 · 안내 글 · 머리(요청 n + 오른쪽 단추) */
  function collectBits(state, key, no) {
    const busy = state.staffCollectBusy === key;
    const m = state.staffCollectMsg && state.staffCollectMsg.key === key && state.staffCollectMsg.text ? state.staffCollectMsg : null;
    const msg = m ? `<div class="krext-sub krext-st-msg${m.error ? ' krext-err' : ''}" role="status">${esc(m.text)}</div>` : '';
    const head = (right, label, lead = '', tail = '') => `<div class="krext-st-co-head krext-st-co-subhead"><div class="krext-st-co-heading">${lead}<span class="krext-st-co-request-icon" aria-hidden="true">${COLLECT_ICON}</span><strong>${esc(label || `요청 ${no}`)}</strong>${tail}</div>${right}</div>`;   // lead = 접기 단추(▾/▸), tail = 접혔을 때 요약 한 줄
    return { busy, msg, dis: busy ? ' disabled' : '', head };
  }
  /* 새 요청 폼 — 양식에 둘 칸 고르기 + [자료 요청 만들기] (no = 몇 번째 요청) */
  function collectNew(p, plan, year, state, c, no) {
    const C_ = C(), prjNo = p.prjNo, key = coKey(prjNo, year, no);
    const { busy, msg, dis, head } = collectBits(state, key, no);
    {
      const names = collectNames(state, prjNo, year, plan, c);
      const who = names.length ? `대상 ${names.length}명: ${names.join(', ')}` : '대상이 없습니다 — 계획의 참여연구원(또는 rERP 참여인력)이 대상입니다';
      const askRaw = (state.staffCollectAsk || {})[key], ask = Array.isArray(askRaw) ? askRaw : C_.askOf();   // 고른 칸(체크 상자) — 안 고르면 기본(참여율·월급여)
      const askBox = `<div class="krext-st-co-ask" role="group" aria-label="양식에 둘 칸">${C_.ASK.map((f) => `<label title="${esc(f.desc)}"><input type="checkbox" data-stco-ask="${esc(f.name)}"${ask.includes(f.name) ? ' checked' : ''}${dis}> ${esc(f.ask)}</label>`).join('')}<span class="krext-dim">항목(기본값 과제 제목) · 시작·끝 달(연차 기간의 달 목록에서 고름) · 비고는 늘 둡니다</span></div>`;
      return `<div class="krext-st-collect" data-cokey="${esc(key)}" data-cono="${no}">${head(`<span class="krext-st-co-acts"><button type="button" class="krext-plan-btn krext-plan-save krext-st-co-create" data-act="st-co-create" title="내 OneDrive 에 응답 목록(양식)을 만들고 대상에게 편집 권한으로 공유합니다 — 이름은 SharePoint 사람 찾기로 이메일을 풉니다(SharePoint 작업 창이 잠깐 뜸)"${dis || (!names.length || !ask.length ? ' disabled' : '')}>${busy ? '만드는 중…' : '자료 요청 만들기'}</button></span>`, no > 1 ? `새 요청 ${no}` : '새 요청')}<div class="krext-sub krext-dim krext-st-co-empty"><strong>${esc(who)}</strong><p>만들면 사람마다 <b>팀즈로 보내기</b> 단추가 생깁니다. 양식 링크를 안내하면 회신이 자동 갱신마다 저절로 들어오고(바로 보려면 <b>응답 받기</b>), 응답 표에서 계획에 반영하세요.</p>${askBox}</div>${msg}</div>`;
    }
  }
  /* 요청 하나의 카드 — 머리(▾/▸ 접기 · 단추 줄 · [지우기]) · 요약 · 양식 줄([링크 복사]) · 사람 표(회신/미회신) · 응답 표 · 설정. 접히면 머리(요약 한 줄 · 지우기)만 */
  function collectCard(p, plan, year, state, c, req, x = {}) {   // x = { budget, months, book, lock } — 응답 줄의 최대 참여율(responseMax)
    const C_ = C(), prjNo = p.prjNo, no = req.no, key = coKey(prjNo, year, no);
    const { busy, msg, dis, head } = collectBits(state, key, no);
    const ctx = collectCtx(state, p);
    const stats = C_.responseStats(req);
    const noReply = req.people.filter((x) => x.email && !stats[S.nameKeyOf(x.name)]), noReplyMails = noReply.map((x) => x.email);   // 이메일은 있는데 아직 회신이 없는 사람 — [안 온 사람 다시 보내기](2026-10-20 사용자 "회신이 오면 회신 주고 안온사람 다시보내기 버튼")
    const pend = C_.pending(req, ctx);
    const shared = req.people.filter((x) => x.status === 'shared').length;
    const replied = req.people.filter((x) => stats[S.nameKeyOf(x.name)]).length;
    const replyPercent = req.people.length ? Math.round(replied / req.people.length * 100) : 0;
    const failed = req.people.filter((x) => x.status === 'failed').length;
    const missing = req.people.filter((x) => !x.email || x.status === 'ambiguous' || x.status === 'notFound').length;
    const openPanels = state.staffCollectOpen || {};
    const tm = state.teamsStatus || null, mcp = !!(tm && tm.ok);   // 팀즈 MCP(lib/teams-mcp.js) — 연결돼 있으면 창 없이 보내는 단추, 아니면 딥 링크만
    const message = C_.messageOf(req, { alias: ctx.alias, prjNm: ctx.prjNm, prjNo, from: c && c.per ? c.per.from : '', to: c && c.per ? c.per.to : '', who: '', template: ctx.template });
    const allMails = req.people.map((x) => x.email).filter(Boolean);
    const groupLink = allMails.length > 1 ? C_.teamsLink(allMails, message, `${ctx.alias || shortName(ctx.prjNm) || prjNo} 자료 요청`) : '';
    const chatId = C_.chatIdOf(req.chat), chatOpen = chatId ? C_.chatLink(chatId, message) : '';   // 기존 채팅방(req.chat — 아래 칸)
    const chatBtns = chatId ? `${mcp ? `<button type="button" class="krext-plan-btn krext-st-teams" data-act="st-co-send-chat" title="적어 둔 기존 채팅방에 팀즈 MCP 로 팀즈 글을 보냅니다 — 창 없이 바로 보내집니다"${dis}>채팅방에 보내기</button>` : ''}<a class="krext-plan-btn krext-st-teams" href="${esc(chatOpen)}" target="_blank" rel="noopener" data-cosent="*" title="적어 둔 기존 채팅방을 Teams 에서 엽니다 — 글이 채워지지 않으면 아래 팀즈 글을 붙여 넣으세요(보내기는 직접)">채팅방 열기</a>` : '';
    const removeKey = `co-remove:${key}`, armed = !!(state.staffArm && state.staffArm.key === removeKey && state.staffArm.until > nowMs());
    const removeBtn = `<button type="button" class="krext-plan-btn${armed ? ' krext-red' : ''}" data-act="st-co-remove" title="이 요청을 지우고 목록을 재활용통으로 보냅니다(두 번 누름)"${dis}>${armed ? '정말 지우기' : '지우기'}</button>`;   // 머리 단추 줄 끝 — 접혀 있어도 보임(2026-10-20 사용자 "요청을 접었다 폈다 하고 삭제도 할 수 있게")
    const open = openPanels[`${key}:card`] !== false;   // 카드 접기 — 머리의 ▾/▸(st-co-toggle, 현재 탭에서만 유지)
    const toggle = `<button type="button" class="krext-ico-btn krext-st-co-toggle" data-act="st-co-toggle" aria-expanded="${open ? 'true' : 'false'}" aria-label="요청 ${no} ${open ? '접기' : '펼치기'}" title="${open ? '요청 접기' : '요청 펼치기'}">${open ? '▾' : '▸'}</button>`;
    if (!open) return `<div class="krext-st-collect krext-st-co-closed" data-cokey="${esc(key)}" data-cono="${no}">${head(`<span class="krext-st-co-acts">${removeBtn}</span>`, '', toggle, `<span class="krext-sub krext-dim">${esc(C_.summary(req, ctx))}</span>`)}${msg}</div>`;   // 접힌 카드 — 머리(요약 한 줄 · 지우기)와 메시지만
    const right = `<span class="krext-st-co-acts krext-st-co-toolbar"><button type="button" class="krext-plan-btn krext-plan-save" data-act="st-co-fetch" title="목록의 응답 항목을 읽어 옵니다"${dis}>${busy ? '처리 중…' : '응답 받기'}</button>${groupLink ? `<a class="krext-plan-btn krext-st-teams" href="${esc(groupLink)}" target="_blank" rel="noopener" data-cosent="*" title="이메일을 아는 사람 모두와 그룹 채팅을 열고 글을 채워 둡니다(보내기는 직접)">모두에게 팀즈</a>` : ''}${noReplyMails.length ? (mcp ? `<button type="button" class="krext-plan-btn krext-st-teams" data-act="st-co-resend" title="아직 회신이 없는 ${esc(noReply.map((x) => x.name).join(', '))} 에게 팀즈 MCP 로 글을 다시 보냅니다(1:1 채팅, 창 없이)"${dis}>안 온 사람 다시 보내기 (${noReplyMails.length})</button>` : `<a class="krext-plan-btn krext-st-teams" href="${esc(C_.teamsLink(noReplyMails, message, noReplyMails.length > 1 ? `${ctx.alias || shortName(ctx.prjNm) || prjNo} 자료 재요청` : ''))}" target="_blank" rel="noopener" data-cosent="!" title="아직 회신이 없는 ${esc(noReply.map((x) => x.name).join(', '))} 과 채팅을 열고 글을 채워 둡니다(보내기는 직접)">안 온 사람에게 팀즈 (${noReplyMails.length})</a>`) : ''}${removeBtn}</span>`;
    const progress = req.people.length ? `<span class="krext-st-co-progress" role="progressbar" aria-label="요청 대상자 응답률" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${replyPercent}" aria-valuetext="${req.people.length}명 중 ${replied}명 응답" title="${req.people.length}명 중 ${replied}명 응답 (${replyPercent}%)"><i style="width:${replyPercent}%"></i></span>` : '';
    const summary = `<div class="krext-st-co-summary" role="group" aria-label="${esc(C_.summary(req, ctx))}"><span class="krext-st-co-badge krext-st-co-stat">공유 <b>${shared}/${req.people.length}명</b></span><span class="krext-st-co-badge krext-st-co-stat">응답 <b>${Object.keys(stats).length}명</b> · ${req.responses.length}건${progress}</span>${pend.length ? `<span class="krext-st-co-badge krext-st-co-badge-warn">미반영 <b>${pend.length}건</b></span>` : ''}${failed ? `<span class="krext-st-co-badge krext-st-co-badge-warn">공유 실패 <b>${failed}명</b></span>` : ''}${missing ? `<span class="krext-st-co-badge krext-st-co-badge-warn">이메일 확인 <b>${missing}명</b></span>` : ''}<span class="krext-st-co-badge krext-st-co-connection ${mcp ? 'krext-st-co-ok' : 'krext-dim'}" title="${esc(tm ? (tm.ok ? `${tm.server || ''} ${tm.url || ''}`.trim() : tm.error || '') : '설정 › LLM 설정 › 팀즈 MCP')}">팀즈 MCP ${mcp ? '연결됨' : tm ? '연결 안 됨 — 새 탭으로만' : '확인 전'}</span><button type="button" class="krext-plan-btn" data-act="st-co-share" title="이메일을 못 찾았거나 고친 사람, 계획에 새로 든 사람에게 공유합니다"${dis}>공유</button></div>`;
    const shareHelp = failed || missing ? `<div class="krext-st-co-share-help">${missing ? '이메일을 확인한 뒤 ' : ''}${failed ? '공유에 실패한 사람은 ' : ''}<b>공유</b>를 눌러 다시 시도하세요.</div>` : '';
    const showAllow = (req.ask || []).includes('Allowance') || req.responses.some((r) => r.allowance);   // 남은 연구수당 칸은 물었을 때만(응답에 있으면 보임)
    const line = `<div class="krext-sub krext-st-co-line krext-st-co-form"><div class="krext-st-co-form-info"><b title="${esc(req.title)}">${esc(req.title)}</b><span class="krext-st-co-form-meta"><span title="만들 때 고른 칸 — 바꾸려면 요청을 지우고 다시 만드세요">${esc(C_.askLabels(req.ask).join(' · '))}</span>${req.createdAt ? `<span>${esc(F.fmtClock(req.createdAt))} 생성</span>` : ''}${req.fetchedAt ? `<span title="${esc(req.fetchError || '')}">${esc(F.fmtClock(req.fetchedAt))} ${req.fetchError ? '<span class="krext-err">받기 실패</span>' : '받음'}</span>` : ''}</span></div><div class="krext-st-co-form-links">${req.formUrl ? `<a href="${esc(req.formUrl)}" target="_blank" rel="noopener" title="응답자가 여는 새 항목 폼">양식 열기 ${ICON_EXT}</a><button type="button" class="krext-st-co-copy" data-act="st-co-copy" title="양식 주소를 복사합니다">링크 복사</button>` : ''}${req.listUrl ? `<a href="${esc(req.listUrl)}" target="_blank" rel="noopener" title="응답 목록(SharePoint) — 모든 응답은 목록 주인만 봅니다">응답 목록 ${ICON_EXT}</a>` : ''}</div></div>`;
    const rows = req.people.map((x) => {
      const st = stats[S.nameKeyOf(x.name)] || null;
      const last = st ? C_.lastResponse(req, x.name) : null;   // 마지막 응답 — 응답 칸에 항목·기간·참여율·월급여·남은 연구수당(2026-10-20 사용자 "결과를 이 웹으로 갖어오게 … 연봉, 참여율, 연구수당, 기간")
      const link = x.email ? C_.teamsLink([x.email], message) : '';
      const again = !st && !!(x.sentAt || x.sendError);   // 보냈는데(또는 실패) 회신이 없으면 [다시 보내기](2026-10-20 사용자 "보내고 다시 보내기 기능")
      const picks = x.status === 'ambiguous' ? (x.candidates || []).map((c) => ({ email: C_.candidateEmail(c), label: C_.candidateLabel(c) })).filter((c) => c.email) : [];   // 동명이인(eClass 직원검색) — 이메일 칸이 선택 상자가 된다(2026-10-20 사용자 "동명 2인이면 선택할 수 있게")
      const status = x.status === 'shared' ? `<span class="krext-st-co-ok" title="${esc(x.sharedAt ? `${F.fmtClock(x.sharedAt)} 공유` : '')}">공유됨</span>` : x.status === 'ambiguous' ? `<span class="krext-st-co-warn" title="${esc((x.candidates || []).join(' / ') || x.error || '')}">이름 겹침 — ${picks.length ? '고르세요' : '이메일을 적으세요'}</span>` : x.status === 'notFound' ? `<span class="krext-st-co-warn" title="${esc(x.error || '')}">못 찾음 — 이메일을 적으세요</span>` : x.status === 'failed' ? `<span class="krext-err" title="${esc(x.error || '')}">공유 실패</span>` : x.email ? '<span class="krext-dim">공유 전 — [공유]</span>' : `<span class="krext-dim" title="${esc(x.error || '')}">이메일 없음</span>`;
      return `<tr class="krext-st-co-row"><td class="krext-st-nm"><div class="krext-st-co-person"><span class="krext-st-co-avatar" aria-hidden="true">${esc(Array.from(x.name || '?')[0])}</span><span class="krext-st-co-person-name"><b>${esc(x.name)}</b>${x.title ? `<small class="krext-dim">${esc(x.title)}</small>` : ''}</span></div></td><td>${picks.length ? `<select data-stco="email" data-name="${esc(x.name)}" aria-label="${esc(x.name)} 이메일 고르기" title="eClass 직원검색에 같은 이름이 여럿입니다 — 고르면 그 이메일로(그 뒤 [공유])"><option value="">동명이인 — 고르세요</option>${picks.map((c) => `<option value="${esc(c.email)}">${esc(c.label)} — ${esc(c.email)}</option>`).join('')}</select>` : `<input type="text" data-stco="email" data-name="${esc(x.name)}" value="${esc(x.email)}" placeholder="이메일" inputmode="email" autocomplete="off" spellcheck="false" aria-label="${esc(x.name)} 이메일" title="팀즈 채팅과 목록 공유에 쓰는 이메일 — eClass 직원검색으로 못 풀면 직접 적으세요(다음 과제에서도 기억). Enter 로 반영">`}</td><td>${status}</td><td class="krext-dim">${st ? `<span class="krext-st-co-ok">회신</span> ${st.n}건 · ${esc(F.fmtClock(st.at))}${last ? `<small class="krext-st-co-last" title="마지막 응답 — 항목 · 기간 · 참여율 · 월급여 · 연구수당(천원)">${esc(C_.responseBits(last, ctx).join(' · '))}</small>` : ''}` : x.sendError ? `<span class="krext-err" title="${esc(x.sendError)}">보내기 실패</span>` : x.sentAt ? '<span class="krext-st-co-warn">미회신</span>' : x.email ? '<span class="krext-dim">보내기 전</span>' : '—'}${x.sentAt ? `<small title="팀즈로 보낸(또는 보내기를 누른) 시각">보냄 ${esc(F.fmtClock(x.sentAt))}</small>` : ''}</td><td class="krext-st-act">${link ? `${mcp ? `<button type="button" class="krext-plan-btn krext-st-teams" data-act="st-co-send" data-name="${esc(x.name)}" title="팀즈 MCP 로 ${esc(x.name)} 과의 1:1 채팅에 팀즈 글을 보냅니다 — 창 없이 바로 보내집니다(1:1 채팅이 아직 없으면 [채팅 열기]로 한 번 대화한 뒤)"${dis}>${again ? '다시 보내기' : '보내기'}</button>` : ''}<a class="krext-plan-btn krext-st-teams" href="${esc(link)}" target="_blank" rel="noopener" data-cosent="${esc(x.name)}" title="Teams 에서 ${esc(x.name)} 과의 채팅을 열고 양식 링크가 든 글을 채워 둡니다 — 보내기는 직접">${mcp ? '채팅 열기' : again ? '다시 팀즈로 보내기' : '팀즈로 보내기'}</a>` : '<span class="krext-dim">—</span>'}</td></tr>`;
    }).join('');
    const peopleTable = `<div class="krext-ws-table-scroll krext-st-co-table-scroll" tabindex="0" role="region" aria-label="자료 요청 대상과 공유 상태"><table class="krext-cards krext-st-table krext-st-co-table"><thead><tr><th class="krext-st-nm" scope="col">성명</th><th scope="col">이메일</th><th scope="col">공유</th><th scope="col">응답</th><th scope="col">팀즈 안내</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="krext-dim">대상이 없습니다 — [공유] 로 계획의 참여연구원을 더합니다</td></tr>'}</tbody></table></div>`;
    const msgBox = `<label class="krext-st-co-msg"><span class="krext-dim">팀즈 글 (비우면 설정 › 팀즈 MCP 의 템플릿으로 — 팀즈 MCP 로 보내면 주소는 링크, 빈 줄은 문단)</span><textarea data-stco="message" rows="3" maxlength="1500" spellcheck="false" aria-label="팀즈 글">${esc(message)}</textarea></label>`;
    const chatBox = `<label class="krext-st-co-msg"><span class="krext-dim">기존 채팅방 (단체 채팅방에 보내려면 — Teams 에서 그 방의 아무 메시지 › 기타 옵션 › <b>링크 복사</b>를 붙여 넣거나 19:…@thread.v2 ID. Enter 로 반영)</span><input type="text" data-stco="chat" value="${esc(req.chat || '')}" placeholder="https://teams.microsoft.com/l/message/19:…@thread.v2/… 또는 19:…@thread.v2" spellcheck="false" autocomplete="off" aria-label="기존 채팅방 링크">${req.chat ? `<small class="${chatId ? 'krext-dim' : 'krext-err'}">${chatId ? `채팅 ID ${esc(chatId)}${req.sentChatAt ? ` · 보냄 ${esc(F.fmtClock(req.sentChatAt))}` : ''}` : '링크/ID 에서 채팅 ID(19:…)를 찾지 못했습니다'}</small>` : ''}</label>`;
    const settings = `<details class="krext-st-co-details krext-st-co-settings" data-stco-panel="settings"${openPanels[`${key}:settings`] || (req.chat && !chatId) ? ' open' : ''}><summary>메시지 · 채팅방 설정<span class="krext-st-co-detail-hint">${req.message ? '직접 작성한 글' : '기본 안내 글'}${chatId ? ' · 채팅방 지정됨' : ''}</span></summary><div class="krext-st-co-settings-body">${msgBox}${chatBox}${chatBtns ? `<div class="krext-st-co-acts">${chatBtns}</div>` : ''}</div></details>`;
    const respRows = req.responses.map((r) => {
      const mine = C_.isThis(r.title, ctx), done = !!(req.applied || {})[r.id];
      // 반영할 항목(체크 상자 — 값이 있는 것만) · 최대 참여율(표기 + 반영 때 자름) — 2026-10-20 사용자 "참여율,기간, 연구수당 각각 반영할 것을 선택 … 참여율은 MAX … 표기도 해주고. 이거 이상 못넘어 가게"
      const pk = coPickOf(r, (state.staffCollectPick || {})[`${key}:${r.id}`]);
      let mx = null;
      if (mine && !done && (pk.rate || pk.period)) { try { mx = responseMax(plan, r, x, pk); } catch (e) { /* 월급여 없음 · 기간이 계획 밖 — 표기 없이, 반영 때 그 말 */ } }
      const box = (k, label, has, tip) => (has ? `<label class="krext-st-co-pick" title="${esc(tip)}"><input type="checkbox" data-stco-pick="${k}" data-cokey="${esc(key)}" data-id="${esc(r.id)}"${pk[k] ? ' checked' : ''}>${label}</label>` : '');
      const picks = mine && !done ? `<span class="krext-st-co-picks" role="group" aria-label="${esc(r.name)} 반영할 항목">${box('period', '기간', !!r.from, '응답의 시작~끝 달을 적용일~종료일로 — 끄면 그 사람의 참여 기간 전체(계획에 없는 사람은 계획 기간)')}${box('rate', '참여율', r.rate != null, '응답의 참여율 — 최대(예산 나머지 · 100% 규칙)를 넘으면 최대로 넣습니다. 끄고 기간만 켜면 지금 월평균 참여율을 그 기간에')}${box('monthly', '월급여', r.monthly > 0, '응답의 월급여를 직접 값으로')}${box('allowance', '연구수당', r.allowance > 0, '응답의 남은 연구수당을 그 사람에게 참고 값으로 적어 둡니다(지급 계획에는 들지 않음)')}</span>` : '';
      const act = mine ? (done ? `<span class="krext-st-co-ok" title="${esc(F.fmtClock(req.applied[r.id]))} 반영">반영됨</span>` : `${picks}<button type="button" class="krext-plan-btn krext-plan-save" data-act="st-co-apply" data-id="${esc(r.id)}" title="고른 항목을 계획에 반영 — 월급여는 직접 값으로, 참여율은 적용일~종료일에 ✎ 폼과 같은 길로(최대를 넘으면 최대로), 계획에 없는 사람은 더합니다">반영</button>`) : '<span class="krext-dim" title="다른 과제의 참여율 — 100% 검사(알림)에 저절로 듭니다">100% 검사</span>';
      const maxTxt = mx ? `<small class="krext-st-co-max ${r.rate != null && r.rate > mx.rate ? 'krext-st-co-warn' : 'krext-dim'}" title="${esc(maxTip(mx))}">최대 ${esc(String(mx.rate))}%</small>` : '';
      return `<tr class="krext-st-co-resp${done ? ' krext-st-co-done' : ''}"><td class="krext-st-nm"><b>${esc(r.name)}</b>${r.by && !S.sameName(r.by, r.name) ? `<small class="krext-dim">${esc(r.by)}</small>` : ''}</td><td>${esc(mine ? C_.THIS : r.title || '—')}</td><td class="krext-mono">${esc(r.from ? `${r.from}${r.to && r.to !== r.from ? ` ~ ${r.to}` : ''}` : '—')}</td><td class="krext-num">${r.rate == null ? '—' : esc(`${r.rate}%`)}${maxTxt}</td><td class="krext-num">${r.monthly ? esc(S.thousand(r.monthly)) : '—'}</td>${showAllow ? `<td class="krext-num">${r.allowance ? esc(S.thousand(r.allowance)) : '—'}</td>` : ''}<td class="krext-dim krext-st-co-note" title="${esc(r.note)}">${esc(r.note.slice(0, 40))}</td><td class="krext-dim">${esc(F.fmtClock(r.at))}</td><td class="krext-st-act">${act}</td></tr>`;
    }).join('');
    const respTable = req.responses.length
      ? `<div class="krext-st-co-resphead"><strong>응답 ${F.money(req.responses.length)}건</strong>${pend.length ? `<button type="button" class="krext-plan-btn" data-act="st-co-apply-all" title="아직 반영하지 않은 이 과제 줄 ${pend.length}건을 차례대로 반영합니다">미반영 ${pend.length}건 모두 반영</button>` : ''}</div><div class="krext-ws-table-scroll" tabindex="0" role="region" aria-label="자료 요청 응답 표"><table class="krext-cards krext-st-table krext-st-co-table krext-st-co-responses"><thead><tr><th class="krext-st-nm">성명</th><th>항목</th><th>기간</th><th class="krext-num">참여율</th><th class="krext-num" title="천원">월급여</th>${showAllow ? '<th class="krext-num" title="천원 — 연구수당 상자를 켜고 반영하면 그 사람의 참고 값으로 적어 둡니다(지급 계획에는 들지 않음)">남은 연구수당</th>' : ''}<th>비고</th><th>응답</th><th></th></tr></thead><tbody>${respRows}</tbody></table></div>`
      : `<div class="krext-sub krext-dim">${req.fetchedAt && !req.fetchError ? '아직 응답이 없습니다 — 회신이 올 때까지 자동 갱신 주기마다 저절로 다시 읽습니다(바로 보려면 [응답 받기]).' : '팀즈로 보내면 회신이 올 때까지 자동 갱신 주기마다 저절로 가져옵니다(설정 › 자동 갱신) — 바로 보려면 [응답 받기].'}</div>`;
    return `<div class="krext-st-collect" data-cokey="${esc(key)}" data-cono="${no}">${head(right, '', toggle)}${summary}${shareHelp}${line}${msg}${peopleTable}${respTable}<div class="krext-st-co-utilities">${settings}</div></div>`;
  }
  const supportOf = (state, prjNo) => { const s = (state.staffSupport || {})[prjNo]; return s && typeof s === 'object' ? { people: S.normalizeSupport(s.people), at: Number(s.at) || 0 } : { people: [], at: 0 }; };
  /* 표 복사 — 참여연구원(계획, 없으면 fallback: 패널 카드가 보이는 rERP 등록 지급계획) TSV 에 행정지원 줄(담당업무 · 공문 참조)을 덧붙인다 */
  function rosterTsv(plan, state, prjNo, fallback) {
    const staff = staffOf(plan) || fallback || null, support = supportOf(state, prjNo).people;
    if (!support.length) return staff ? S.staffTsv(staff, staff.basis) : '';
    const rows = S.staffTsv(staff || { basis: 'rerp', people: [] }).split('\n').map((line, i) => `${line}\t${i ? '\t' : '담당업무\t공문 참조'}`);
    const cell = (value) => String(value || '').replace(/[\t\r\n]+/g, ' ');
    for (const p of support) rows.push([p.name, '행정지원', '', '과제 공통', '', '', '', '', '', p.role, p.ref ? '예' : '아니오'].map(cell).join('\t'));
    return rows.join('\n');
  }
  /* 바닥글 밑 공유 (Plus) 한 줄 — 공유가 한 번이라도 돌았을 때 (storage.local.staffSyncState = shareState: at · ok · base{ path } · pages{ prjNo: 과제 폴더 } · error · kind) */
  function syncLine(sync) {
    if (!sync || !sync.at) return '';
    const n = Object.keys(sync.pages || {}).length;
    const base = (sync.base && sync.base.path) || (sync.folder && sync.folder.path) || '';
    return `<div class="krext-sub krext-dim krext-st-sync">공유: ${sync.ok ? `${esc(F.fmtClock(sync.at))} · 과제 ${F.money(sync.count || n)}개${base ? ` · ${esc(base)}` : ''}` : `<span class="krext-err">${esc(F.fmtClock(sync.at))} 실패 — ${esc(sync.error || sync.kind || '')}</span>`}</div>`;
  }

  /* 달마다의 지급 — 1~12월 고정 칸의 격자(해마다 한 줄 — 기간이 두 해에 걸치면 줄 둘, 라벨에 '26.). 기간 밖 달은 라벨만 흐리게, 제외는 —, 월 최대 참여율의 달은 파랑, 일부 달 조각은 금액 밑에 날 범위(같은 달 조각 둘이면 둘 다).
   * 2026-10-19 사용자 "칸 줄이 안맞음 … M 은 그냥 두고 1월부터 12월까지 일정 간격으로 금액을 넣어줘" — 사람마다 같은 달이 같은 자리에 오게 */
  /* 참여연구원 변경 탭(edit)에서는 **달 칸 고르기**의 바탕(2026-10-19 사용자, 회의실 현황 스크린샷: "2번째처럼 해줘. 드래그해서 선택할 수 있게"): 기간(months) 안의 달은 단추 `data-act="st-pick" data-id data-ym`(지급이 없는 달은 빈 칸)이고
   * 누르거나 끌어 고른 달(pick { from, to } — 'YYYY-MM')은 krext-st-picked · aria-pressed. 기간 밖 달은 고를 수 없다(지급 조각이 있어도 — applyChange 의 범위가 기간의 달들이므로). 격자는 탭에서 늘 보인다(M 은 rERP 등록 줄만) */
  /* lock('YYYY-MM' — 지급이 끝난 마지막 달)까지의 칸은 라벨 오른쪽에 "지급" 을 붙이고(krext-st-paid) 탭에서도 단추가 아니라 고를 수 없다(2026-10-19 사용자 "지급된 월은 수정 못하게 해줘. 월 우측에 지급 이라고 하던지") */
  function monthGrid(s, { months = [], edit = false, id = '', pick = null, lock = '' } = {}) {
    const years = [...new Set(s.rates.map((r) => r.ym.slice(0, 4)).concat(edit ? months.map((m) => m.slice(0, 4)) : []))].sort();
    const multi = years.length > 1;
    const inPeriod = new Set(edit ? months : []);
    const tipOf = (r) => { const when = r.full ? r.ym : `${r.from} ~ ${r.to}`; return r.amt > 0 ? `${when} · ${S.thousand(r.amt)}천원${r.rate != null ? ` · ${S.rateText(r.rate)}` : ''}` : `${when} · 제외`; };
    return years.map((y) => `<div class="krext-st-mogrid" data-year="${esc(y)}">${Array.from({ length: 12 }, (_, i) => {
      const ym = `${y}-${F.pad2(i + 1)}`, lab = `${multi ? `'${y.slice(2)}.` : ''}${i + 1}월`;
      const pieces = s.rates.filter((r) => r.ym === ym);
      const canPick = inPeriod.has(ym);
      if (!pieces.length && !canPick) return `<span class="krext-st-mo krext-st-mo-none" title="${esc(ym)} · 기간 밖"><i>${esc(lab)}</i><b></b></span>`;
      const paid = !!lock && ym <= lock;   // rERP 지급 완료 — 잠김
      const body = `<i>${esc(lab)}${paid ? '<em class="krext-st-paidtag" title="rERP 지급 완료 — 바꿀 수 없습니다">지급</em>' : ''}</i>${pieces.map((r) => {
        const cls = r.amt > 0 ? (s.maxRate != null && r.ym === s.maxYm && r.rate === s.maxRate ? 'krext-st-max' : '') : 'krext-st-off';
        return `<b${cls ? ` class="${cls}"` : ''} title="${esc(tipOf(r))}">${r.amt > 0 ? S.thousand(r.amt) : '—'}${r.full ? '' : `<small>${Number(r.from.slice(8))}~${Number(r.to.slice(8))}일</small>`}</b>`;
      }).join('')}${pieces.length ? '' : '<b></b>'}`;
      if (paid) return `<span class="krext-st-mo krext-st-paid"${canPick ? ` title="${esc(`${pieces.length ? pieces.map(tipOf).join(' · ') : `${ym} · 지급 없음`} — rERP 지급 완료, 바꿀 수 없습니다`)}"` : ''}>${body}</span>`;
      if (!canPick) return `<span class="krext-st-mo">${body}</span>`;
      const on = !!(pick && pick.from && ym >= pick.from && ym <= pick.to);
      const tip = `${pieces.length ? pieces.map(tipOf).join(' · ') : `${ym} · 지급 없음`} — 누르거나 끌어 달을 고릅니다(Shift+누름은 직전 칸부터)`;
      return `<button type="button" class="krext-st-mo${on ? ' krext-st-picked' : ''}" data-act="st-pick" data-id="${esc(id)}" data-ym="${esc(ym)}" aria-pressed="${on}" title="${esc(tip)}">${body}</button>`;
    }).join('')}</div>`).join('');
  }
  /* 폼의 적용일·종료일이 가리키는 달들 { from, to }('YYYY-MM') — 격자의 고른 칸 표시. 종료일이 없으면 기간 마지막 달까지 */
  function pickOf(d, months) {
    const from = d && d.from ? S.dateOf(d.from, 'start').slice(0, 7) : '';
    if (!from) return null;
    const to = d.to ? S.dateOf(d.to, 'end').slice(0, 7) : months.length ? months[months.length - 1] : from;
    return { from, to: to && to >= from ? to : from };
  }
  /* 전체 참여개월 — 격자 왼쪽 [전체] 단추가 고르는 날짜(2026-10-20 사용자 "드래그 말고 전체 참여개월 선택하는 기능도"): 그 사람의 기간(months) 안 지급이 있는 첫 조각의 첫날 ~ 마지막 조각의 마지막 날
   * (지급이 없으면 기간 전체), 지급이 끝난 달(lock) 뒤부터. → { from, to('YYYY-MM-DD'), lo, hi('YYYY-MM'), count(달 수) } | null(고를 달이 없음) */
  function wholePick(q, months, lock = '') {
    if (!months || !months.length) return null;
    const active = ((q && q.plan) || []).filter((x) => x.amt > 0 && months.includes(x.ym));
    let from = active.length ? S.segStart(active[0]) : S.monthStart(months[0]);
    const to = active.length ? S.segEnd(active[active.length - 1]) : S.monthEnd(months[months.length - 1]);
    if (S.isYm(lock) && from <= S.monthEnd(lock)) from = S.monthStart(S.addMonths(lock, 1));
    if (from > to) return null;
    return { from, to, lo: from.slice(0, 7), hi: to.slice(0, 7), count: S.ymRange(from.slice(0, 7), to.slice(0, 7)).length };
  }
  /* 폼의 적용일~종료일(종료일을 비우면 기간 끝) — 'YYYY-MM-DD' 둘 | null */
  const draftRange = (d, months) => (d && d.from ? { from: S.dateOf(d.from, 'start'), to: d.to ? S.dateOf(d.to, 'end') : (months.length ? S.monthEnd(months[months.length - 1]) : '') } : null);
  /* 격자 왼쪽 [전체] — 누르면 그 사람의 전체 참여개월(wholePick)로 ✎ 폼(st-pick-all). 열린 폼(draft)의 날짜가 그 범위와 같으면 눌린 꼴(krext-st-picked · aria-pressed) — data-from·data-to 는 날짜 칸을 고칠 때 bind 의 paintDraft 가 견준다 */
  function allPickBtn(q, months, lock, draft) {
    const w = wholePick(q, months, lock);
    if (!w) return `<button type="button" class="krext-st-allpick" disabled title="${esc(S.isYm(lock) ? `${S.ymText(lock)}까지 rERP 지급이 끝나 고를 달이 없습니다` : '계획 기간(첫 달·마지막 달)을 먼저 정하세요')}"><span>전체</span></button>`;
    const r = draftRange(draft, months), on = !!r && r.from === w.from && r.to === w.to;
    const tip = `전체 참여개월 고르기 — ${S.spanText(w.from, w.to)}(${w.count}개월)의 달들을 한 번에 골라 폼을 엽니다${S.isYm(lock) ? ` (${S.ymText(lock)}까지는 지급 완료라 빼고)` : ''}`;
    return `<button type="button" class="krext-st-allpick${on ? ' krext-st-picked' : ''}" data-act="st-pick-all" data-id="${esc(q.id)}" data-from="${esc(w.from)}" data-to="${esc(w.to)}" aria-pressed="${on}" title="${esc(tip)}"><span>전체</span><small>${w.count}개월</small></button>`;
  }
  /* 이전 차년도에서 가져오기의 재료 — 앞 연차 계획(사람이 있으면), 없으면 그 연차 기간의 rERP 등록 지급계획(조회가 있을 때). → { staff, from: 'plan'|'erp', year(앞 연차) } | null. 1차년도는 null */
  function carrySource(p, year, state) {
    if (!(year > 1)) return null;
    const prev = year - 1, plan = (state.staffPlans || {})[S.planKey(p.prjNo, prev)] || null;
    const staff = staffOf(plan);
    if (staff) return { staff, from: 'plan', year: prev };
    const cache = (state.staffRows || {})[p.prjNo];
    if (!cache || !cache.rows) return null;
    const per = periodOf(p, plan, prev), months = S.ymRange(per.from, per.to);
    const erp = months.length ? S.peopleOfErp(cache.rows, { prjNo: p.prjNo, now: cache.at, months }) : null;
    return erp ? { staff: erp, from: 'erp', year: prev } : null;
  }
  /* 사람 표 — 성명 · 역할(책임/참여/행정 — S.roleShort) · 월급여 · 참여(기간 · 개월) · 지급 합 · 참여율(아래 월 최대). edit(참여연구원 변경 탭)면 월급여·지급 합·참여율은 칸, 역할은 선택, 끝에 ✎ × ;
   * 기간 구간이 둘 이상이면 **구간마다 한 줄**(성명·역할·월급여·✎× 는 첫 줄에 rowspan, 연간 합·참여율·월 최대는 성명 밑 작은 글) ; 달마다의 지급 줄(일부 달 조각은 "12월 15~31일") ; rERP 등록 줄(계획일 때 — 달 합으로 견줌) ; 폼(edit) */
  function staffTable(prjNo, year, staff, months, erpPeople, state, editing, edit, budget = null, lock = '', book = {}) {
    const basis = staff.basis;
    const cols = edit ? 7 : 6;
    const ctx = { budget, staff, lock, book };   // 폼의 빠른 단추 줄(나머지 · 초과금/부족금 · MAX — quickRow) · 지급이 끝난 달(적용일 하한) · 다른 과제 참여율(MAX 의 100% 규칙)
    const arm = (key) => state.staffArm && state.staffArm.key === key && state.staffArm.until > nowMs();
    const rows = staff.people.map((q) => {
      const s = S.personStats(q, basis);
      const pick = edit && editing && editing.id === q.id ? pickOf(state.staffDraft, months) : null;   // 고르는 중(또는 폼의 날짜)인 달들 — 이 사람의 격자에만
      const grid = monthGrid(s, { months, edit, id: q.id, pick, lock });
      const strip = edit ? `<tr class="krext-st-months"><td colspan="${cols}"><div class="krext-st-mowrap">${allPickBtn(q, months, lock, edit && editing && editing.id === q.id ? state.staffDraft : null)}<div class="krext-st-mogrids">${grid}</div></div></td></tr>`   // 탭은 지급이 없는 사람도 격자(빈 칸을 끌어 달을 고르게) + 왼쪽 [전체]
        : s.planned ? `<tr class="krext-st-months"><td colspan="${cols}">${grid}</td></tr>` : '';
      const ep = erpPeople ? erpPeople.people.find((x) => S.sameName(x.name, q.name)) : null;
      const es = ep ? S.personStats(ep, 'rerp') : null;
      const erpRow = ep ? `<tr class="krext-st-erp"><td colspan="${cols}"><span class="krext-dim" title="R&amp;D ERP 참여인력에 등록된 지급계획 — 이 기간의 달들(달마다의 지급 합으로 견줌)">rERP 등록: ${esc(S.monthlyText(ep.plan))}${es && es.rate != null ? ` · ${esc(S.rateText(es.rate))}${es.maxRate != null ? ` (월 최대 ${esc(S.rateText(es.maxRate))})` : ''}` : ''}${S.sameMonthly(ep.plan, q.plan) ? ' · 같음' : ' · <b>다름</b>'}</span></td></tr>` : '';
      const dropKey = `drop:${prjNo}@${year}:${q.id}`;
      const runs = s.runs.length ? s.runs : [null];
      const n = runs.length;
      const maxTag = s.maxRate != null ? `<span class="krext-st-tag krext-st-maxtag" title="월 최대 참여율 — ${esc(s.maxYm)}. 100% 검사는 달마다 이 값으로">월 최대 ${esc(S.rateText(s.maxRate))}</span>` : '';
      // 성명 밑 작은 글 — 구간이 둘 이상이면 연간 합 · 월평균 · 월 최대, 한 구간이면 월평균만(합·월 최대는 그 줄에). 월평균 = 합 ÷ (월급여 × 참여개월) 셋째 자리 내림(S.floorRate),
      // 10% 이하면 빨강(2026-10-19 사용자 "여기 월평균 참여율 들어가야하고... 소숫점 3자리 내림으로 해줘. 그리고 이게 10%를 초과해야함")
      const low = s.avgRate != null && s.avgRate <= S.MIN_RATE;
      const avgTip = `월평균 참여율 ${S.rateText(s.avgRate) || '—'} = 지급 합 ${S.thousand(s.total)}천원 ÷ (월급여 × ${S.monthsText(s.months)}개월), 소수점 셋째 자리 내림 — ${S.MIN_RATE}% 를 넘어야 합니다`;
      const avgSpan = `<span${low ? ' class="krext-st-low"' : ''}>월평균 ${esc(S.rateText(s.avgRate) || '—')}</span>`;
      const sumLine = n > 1 ? `<small class="krext-st-sum" title="${esc(`연간 — 계상인건비 합 ${S.thousand(s.total)}천원 · ${avgTip}${s.maxRate != null ? ` · 월 최대 ${S.rateText(s.maxRate)}(${s.maxYm})` : ''}`)}"><span>합 ${esc(S.thousand(s.total))}</span>${avgSpan}${s.maxRate != null ? `<span>월 최대 ${esc(S.rateText(s.maxRate))}</span>` : ''}</small>`
        : s.avgRate != null ? `<small class="krext-st-sum" title="${esc(avgTip)}">${avgSpan}</small>` : '';
      const roleCell = edit
        ? `<td class="krext-st-role-cell" rowspan="${n}"><select class="krext-st-role" data-stc="role" data-id="${esc(q.id)}" aria-label="${esc(q.name)} 역할" title="역할만 변경하며 지급계획은 그대로 유지합니다">${roleOptions(q.role)}</select></td>`
        : `<td class="krext-st-role-cell krext-dim" rowspan="${n}" title="${esc(q.role || '')}">${esc(S.roleShort(q.role) || '—')}</td>`;
      const payCell = edit
        ? `<td class="krext-num" rowspan="${n}"><input type="text" class="krext-st-in" data-stc="monthly" data-id="${esc(q.id)}" value="${s.limit ? esc(S.thousand(s.limit)) : ''}" placeholder="천원" inputmode="numeric" aria-label="${esc(q.name)} 월급여 (천원)" title="월급여(천원) — rERP 지급한도액. 직접 적으면 그 값이 앞서고, 비우면 rERP 값으로"><span class="krext-st-tag">${esc(srcLabel[s.src] || '')}</span></td>`
        : `<td class="krext-num" rowspan="${n}" title="월급여(천원) — ${s.src === 'manual' ? '직접 적은 값' : 'rERP 참여인력의 지급한도액'}">${s.limit ? esc(S.thousand(s.limit)) : '—'}${s.src === 'manual' ? '<span class="krext-st-tag">직접</span>' : ''}</td>`;
      const allowLine = q.allowance ? `<small class="krext-st-sum krext-st-allow" title="자료 요청 응답으로 받은 올해 남은 연구수당(천원) — 참고 값, 인건비 지급 계획에는 들지 않습니다"><span>남은 연구수당 ${esc(S.thousand(q.allowance))}</span></small>` : '';
      const headCells = `<td class="krext-st-nm" rowspan="${n}"><b>${esc(q.name)}</b>${sumLine}${allowLine}</td>${roleCell}${payCell}`;
      const actCell = edit ? `<td class="krext-st-act" rowspan="${n}"><span class="krext-plan-acts"><button type="button" data-act="st-edit" data-id="${esc(q.id)}" title="적용일부터 바꾸기 — 참여율 · 월 지급금액 · 나머지의 % · 제외(0%), 폼 아래 증감 칸(기준에서 ±10% 간격 · 예산에 맞추기). 그 앞의 지급은 그대로, 달 중간이면 날 수 비율" aria-label="${esc(q.name)} 참여 계획 수정">✎</button><button type="button" data-act="st-drop" data-id="${esc(q.id)}" class="${arm(dropKey) ? 'krext-red' : ''}" title="이 사람 빼기(두 번)" aria-label="${esc(q.name)} ${arm(dropKey) ? '삭제 확인' : '참여인력에서 삭제'}">${arm(dropKey) ? '정말?' : '×'}</button></span></td>` : '';
      const runRows = runs.map((r, i) => {
        const span = r ? `${esc(S.spanText(r.from, r.to))} (${esc(S.monthsText(r.months))}개월)` : s.months ? `${esc(S.monthsText(s.months))}개월` : '—';
        const total = r ? r.amt : s.total, rate = r ? r.rate : s.rate;
        const scope = n > 1 ? '이 구간' : '지급이 있는 달';
        const spanCell = `<td class="krext-mono krext-dim" title="${r ? esc(`${r.from} ~ ${r.to} (${S.monthsText(r.months)}개월)`) : ''}">${span}${r && r.off ? ' <span class="krext-st-tag">제외</span>' : ''}</td>`;
        const locked = !!lock && !!r && r.to <= S.monthEnd(lock);   // 구간 전체가 rERP 지급이 끝난 달 — 칸을 읽기만
        const ro = locked ? ' readonly' : '';
        const lockNote = lock && !locked ? ' · 지급이 끝난 달은 그대로' : '';
        const cells = edit
          ? `${spanCell}<td class="krext-num"><input type="text" class="krext-st-in" data-stc="total" data-id="${esc(q.id)}" data-r="${i}" value="${esc(S.thousand(total))}" inputmode="numeric"${ro} aria-label="${esc(q.name)} ${r ? esc(S.spanText(r.from, r.to)) : '전체'} 지급 합 (천원)" title="${locked ? 'rERP 지급이 끝난 구간이라 바꿀 수 없습니다' : `${n > 1 ? '이 구간의 ' : ''}지급 합(계상인건비, 천원) — 바꾸면 ${scope}에 균등하게 다시 나눕니다(앞달 올림 · 마지막 달 잔액 · 일부 달은 날 수 비율${lockNote})`}"></td>
        <td class="krext-num"><input type="text" class="krext-st-in krext-st-rate" data-stc="rate" data-id="${esc(q.id)}" data-r="${i}" value="${rate == null ? '' : rate.toFixed(2)}" placeholder="—" inputmode="decimal"${ro} aria-label="${esc(q.name)} ${r ? esc(S.spanText(r.from, r.to)) : '전체'} 참여율 (%)" title="${locked ? 'rERP 지급이 끝난 구간이라 바꿀 수 없습니다' : `${n > 1 ? '이 구간의 ' : '연간 '}참여율(%) = 계상인건비 ÷ (월급여 × 참여개월), rERP 올림 — 바꾸면 ${scope}마다 round천원(월급여 × %)${lockNote}`}">${n === 1 ? maxTag : ''}</td>`
          : `${spanCell}<td class="krext-num" title="${n > 1 ? '이 구간의 ' : ''}지급 합(천원) — 월별 지급의 합(계상인건비)">${esc(S.thousand(total))}</td><td class="krext-num" title="${n > 1 ? '이 구간의 ' : '연간 '}참여율 = 지급 합 ÷ (월급여 × 참여개월), rERP 올림">${rate == null ? '—' : esc(S.rateText(rate))}${n === 1 ? maxTag : ''}</td>`;
        const active = edit && editing && editing.id === q.id ? ' data-editing="true"' : '';
        return i ? `<tr class="krext-st-row krext-st-run" data-id="${esc(q.id)}"${active}>${cells}</tr>` : `<tr class="krext-st-row" data-id="${esc(q.id)}"${active}>${headCells}${cells}${actCell}</tr>`;
      }).join('');
      return runRows + strip + erpRow + (edit && editing && editing.id === q.id ? formRow(q, months, state, ctx) : '');
    }).join('');
    return `<div class="krext-ws-table-scroll" tabindex="0" role="region" aria-label="참여인력 ${edit ? '계획 ' : ''}표"><table class="krext-cards krext-st-table ${edit ? 'krext-st-editable' : 'krext-st-view'}"><thead><tr><th class="krext-st-nm">성명</th><th class="krext-st-role-cell">역할</th><th class="krext-num" title="천원">월급여${edit ? ' <small>(천원)</small>' : ''}</th><th title="기간 구간 (참여개월 — 일부 달은 날 수 비율)">${edit ? '참여 기간' : '참여'}</th><th class="krext-num" title="천원 — 월별 지급의 합(계상인건비)">지급 합${edit ? ' <small>(천원)</small>' : ''}</th><th class="krext-num">참여율${edit ? ' <small>(%)</small>' : ''}</th>${edit ? '<th><span class="krext-st-sr-only">편집</span></th>' : ''}</tr></thead>
      <tbody>${rows}${edit && editing && editing.id === 'new' ? formRow(null, months, state, ctx) : ''}</tbody></table></div>`;
  }
  // 역할 선택지 — 책임 · 참여 · 행정(저장값은 과제책임자 · 참여연구원 · 행정지원). ERP 에서 받은 다른 역할명도 선택지에 남겨, 화면을 열거나 역할을 바꿀 때 잃지 않는다.
  function roleOptions(value) {
    const current = String(value || '');
    return [...new Set(['과제책임자', '참여연구원', '행정지원', current])].map((role) => `<option value="${esc(role)}"${role === current ? ' selected' : ''}>${esc(role ? S.roleShort(role) : '역할 선택')}</option>`).join('');
  }
  /* 적용일부터 바꾸는 폼 — 한 줄: 적용일 · 종료일(비우면 끝까지; 날짜 칸, 달 중간이면 그 달은 날 수 비율) · 구분 · 값 · [반영] [취소], 그 뒤에 안내(나머지의 % · 지급 완료 — 줄이 모자라면 안내만 다음 줄로). 더하기(q 가 null)면 성명 · 역할 · 월급여가 앞에.
   * 2026-10-19 사용자(폼 스크린샷) "반영/취소는 적용일, 종료일, 참여율 이거랑 1줄로 해줘. 날짜 너비 줄이면 될듯" — 날짜 140px · 구분 150px · 값 92px(panel.css .krext-st-focus).
   * 증감 줄에서 고른 것(draft.step)이 있으면 반영 단추에 그 값이 붙는다(반영 +30% · 더하기 50% · 반영 예산) — 반영은 구분·값 대신 그것으로 */
  function formRow(q, months, state, ctx) {
    const d = state.staffDraft || {};
    const support = !q && d.role === '행정지원';
    const shortHint = d.mode === 'short' && !d.step ? '<span class="krext-dim krext-st-form-hint">나머지(아래 줄)의 몇 % — 100 이면 전부, 둘이 나누면 50</span>' : '';
    const lock = ctx && S.isYm(ctx.lock) ? ctx.lock : '';   // 지급이 끝난 마지막 달 — 적용일은 그 다음 달 1일부터
    let first = months.length ? S.monthStart(months[0]) : '';
    if (lock && first && first <= S.monthEnd(lock)) first = S.monthStart(S.addMonths(lock, 1));
    const lockHint = lock && !support ? `<span class="krext-dim krext-st-form-hint" title="rERP 자금현황 인건비 승인액으로 셈한 지급 완료 달 — 그 달까지의 계획은 바꿀 수 없습니다">${esc(S.ymText(lock))}까지 지급 완료 — 그 뒤 달부터</span>` : '';
    const last = months.length ? S.monthEnd(months[months.length - 1]) : '';
    const dateIn = (k, v, tip) => `<input type="date" data-stf="${k}" value="${esc(S.dateOf(v, k === 'to' ? 'end' : 'start'))}" min="${esc(first)}" max="${esc(last)}" title="${esc(tip)}">`;
    const head = q ? '' : `<input type="text" data-stf="name" value="${esc(d.name || '')}" placeholder="성명" maxlength="40" autocomplete="off" spellcheck="false" aria-label="추가할 참여인력 성명"><label>역할 <select data-stf="role">${roleOptions(d.role || '참여연구원')}</select></label>${support ? '' : `<label>월급여 <input type="text" data-stf="manual" value="${esc(d.manual || '')}" inputmode="numeric" placeholder="천원" title="참여율로 금액을 셈할 때 필요 — rERP 에 있는 사람이면 비워도 됨">천원</label>`}`;
    const fields = support
      ? `<label>담당업무 <input type="text" data-stf="supportRole" value="${esc(d.supportRole || '')}" maxlength="40" placeholder="선택 입력" autocomplete="off"></label><label class="krext-st-support-ref"><input type="checkbox" data-stf="ref"${d.ref !== false ? ' checked' : ''}> 공문 참조</label><span class="krext-st-support-note">과제 공통 · 모든 연차에 표시</span>`
      : `<label>적용일 ${dateIn('from', d.from, '이 날부터 바꿉니다 — 달 중간이면 그 달은 날 수 비율로 나눈 조각 둘이 되고, 이 날이 기간 구간의 경계가 됩니다')}</label><label>종료일 ${dateIn('to', d.to, '이 날까지 — 비우면 기간 끝까지')}</label>
      <label>구분 <select data-stf="mode"><option value="rate"${d.mode === 'rate' || !d.mode ? ' selected' : ''}>참여율 %</option><option value="amt"${d.mode === 'amt' ? ' selected' : ''}>월 지급금액(천원)</option><option value="short"${d.mode === 'short' ? ' selected' : ''} title="인건비 예산에서 다른 사람들의 지급을 뺀 나머지의 몇 % 를 적용일~종료일에 고르게 나눠 넣습니다 — 한 사람이면 100, 둘이 나누면 50">나머지의 %</option>${q ? `<option value="exclude"${d.mode === 'exclude' ? ' selected' : ''}>제외 (0%)</option>` : ''}</select></label>
      <label>값 <input type="text" data-stf="value" value="${esc(d.value || '')}" inputmode="decimal" autocomplete="off"${d.mode === 'short' ? ' placeholder="100"' : ''}></label>`;
    const applyTip = d.step && d.step.kind ? '증감 줄에서 고른 것을 반영합니다 — 구분·값은 쓰지 않습니다' : '';
    const heading = q ? `<strong>${esc(q.name)}</strong><span>참여 계획 조정</span>` : `<strong>${support ? '행정지원' : '참여연구원'} 추가</strong>`;
    return `<tr class="krext-st-form${support ? ' krext-st-support-form' : ''}"><td colspan="7"><div class="krext-st-editor-head">${heading}<span class="krext-st-editor-state">편집 중</span></div><div class="krext-plan-form"><span class="krext-plan-ind">↳</span>${head}${fields}
      <button type="button" class="krext-plan-btn krext-plan-save" data-act="st-apply" data-id="${q ? esc(q.id) : 'new'}"${applyTip ? ` title="${esc(applyTip)}"` : ''}>${q ? '반영' : '인력추가'}${esc(stepLabel(d.step))}</button>
      <button type="button" class="krext-plan-btn" data-act="st-cancel" title="취소 (Esc)">취소</button>
      ${support ? '' : shortHint + lockHint}${state.staffError ? `<span class="krext-err krext-plan-err">${esc(state.staffError)}</span>` : ''}
    </div>${support ? '' : quickRow(q, months, d, ctx || {})}</td></tr>`;
  }
  /* 폼 아래 증감 줄 — 2026-10-19 사용자 차례: "나머지를 추가해서 현재 남은 금액을 모두 평균해서 반영하는 버튼 … 25%, 50%, 75%, 100% … n월 개 선택한 후 .. 초과금에 맞춰서 줄이거나, 부족금 만큼 늘리거나 하는 버튼"
   * → (회의실 현황 스크린샷) "이거 기준 금액에서 증액, 감소를 10% 간격으로 증가감소 드래그로 선택할 수 게 해줘. 마지막 우측에는 인건비 제안(예산)에 맞추어주는 기능을 추가해줘"
   * → (폼 스크린샷) "드래그로 선택하고 나면 반영 누를 때까지 기다려. 50% 우측에는 금액을 1%씩 증감할 수 있는 버튼 2개를 넣어줘".
   * 회의실 현황 격자처럼 한 줄의 칸(data-step): ✎ 폼이고 그 기간에 지급이 있으면 [제외 −100%] [−50%] … [−10%] [기준] [+10%] … [+50%](S.scaleRange — 그 기간의 지금 지급에서 10% 간격),
   * ＋ 폼이나 그 기간에 지급이 없으면 [10%] … [100%](나머지의 % — S.applyShare). 그 오른쪽에 [−1%] [+1%](고른 값을 1% 씩 — 칸 밖의 값도 됨, 예 +51%), 맨 오른쪽 **예산에 맞추기**(✎ 폼 — S.fitBudget; 같거나 맞출 수 없으면 꺼짐).
   * 칸을 누르거나 끌어 **고르기만** 한다(draft.step = { kind: 'scale'|'share'|'fit', v }) — 기준 ~ 고른 칸이 krext-st-step-on, 읽기 줄에 "반영을 누르면 — 미리보기", 반영 단추에 값. 반영을 눌러야 적용(applyForm). 기준 칸에서 놓으면 고른 것을 거둠. 값 칸을 적거나 구분을 바꾸면 고른 것을 거둠.
   * 나머지는 폼의 적용일~종료일로 셈한다(S.shareLeft) — 날짜를 고치면 bind 의 paintQuick 이 이 줄만 다시 그린다(고른 것의 미리보기도 새 날짜로). ctx = { budget(인건비 예산 원 | null), staff(계획 — 더하기면 사람 없음), lock, book(다른 과제 월별 참여율 — S.mergeOthers, MAX 의 100% 규칙) } */
  const STEPS_SCALE = [-100, -50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50];
  const STEPS_SHARE = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const signed = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}%`;
  /* 고른 것의 짧은 이름 — 반영 단추에 붙는 " 제외" · " +30%" · " 50%" · " 예산". 없으면 '' */
  const stepLabel = (step) => (!step || !step.kind ? '' : step.kind === 'fit' ? ' 예산' : step.kind === 'even' ? ' 균등' : step.kind === 'max' ? ` MAX ${step.v}%` : step.kind === 'scale' ? (step.v === -100 ? ' 제외' : ` ${signed(step.v)}`) : ` ${step.v}%`);
  /* 칸이 고른 범위 안인가 — scale: 기준(0)과 고른 값 사이(같은 부호), share: 고른 값 이하, fit: 그 칸 */
  const stepOn = (sel, kind, v) => !!sel && sel.kind === kind && (kind === 'fit' || kind === 'even' || kind === 'max' || (kind === 'share' ? v > 0 && v <= sel.v : (sel.v > 0 ? v > 0 && v <= sel.v : v < 0 && v >= sel.v)));
  function quickRow(q, months, d, ctx) {
    const staff = ctx.staff || { basis: 'rerp', people: [] };
    if (ctx.budget == null) return '<div class="krext-st-quick"><span class="krext-dim">인건비 예산이 없어 나머지·초과금을 셈할 수 없습니다 — 사업비 관리의 예산 칸에 인건비 줄을 적으세요.</span></div>';
    const basis = staff.basis, lock = ctx.lock || '';
    const others = S.staffTotal({ people: staff.people.filter((x) => !q || x.id !== q.id) }, basis);
    const range = { from: d.from || (months[0] ? S.monthStart(months[0]) : ''), to: d.to || '' };
    const opts = { budgetPay: ctx.budget, others, lock };
    let info = null, err = '';
    try { info = S.shareLeft(q || S.normalizePerson({ name: '새 사람' }), basis, range, months, opts); } catch (e) { err = String((e && e.message) || e); }
    if (!info) return `<div class="krext-st-quick"><span class="krext-dim">${esc(err)}</span></div>`;
    const left = info.left, span = S.spanText(info.fromD, info.endD), mo = S.monthsText(info.span);
    const id = q ? esc(q.id) : 'new';
    const sel = d.step && d.step.kind ? d.step : null;   // 고른 칸 — 반영을 누르면 적용
    const avgNow = q ? S.personStats(q, basis).avgRate : null;
    // MAX — 이 기간에 넣을 수 있는 최대 참여율(S.maxRate: 예산 나머지 · 100% 규칙 — 이 사람의 다른 과제 월별 참여율은 ctx.book(mergeOthers)). 더하기는 폼의 월급여로. 못 셈하면(월급여 없음) mxWhy
    const newPerson = () => S.normalizePerson({ name: d.name || '새 사람', manual: S.thousandOf(d.manual) });
    const others100 = (ctx.book || {})[S.nameKeyOf(q ? q.name : d.name)] || [];
    let mx = null, mxWhy = '';
    try { mx = S.maxRate(q || newPerson(), basis, range, months, Object.assign({ others100 }, opts)); } catch (e) { mxWhy = String((e && e.message) || e); }
    const outcome = (p) => ({ avg: S.personStats(p, basis).avgRate, bd: S.budgetDiff({ total: others + S.personStats(p, basis).total, budget: ctx.budget }) });   // 바꾼 뒤 — 월평균 · 예산 대비
    const avgTxt = (a) => (a == null ? '' : ` · 월평균 ${avgNow != null ? `${S.rateText(avgNow)} → ` : ''}${S.rateText(a)}${a <= S.MIN_RATE ? `(${S.MIN_RATE}% 이하)` : ''}`);
    // 기준 — 그 기간의 이 사람 지급(S.scaleRange 의 before). 없으면(＋ 폼 · 빈 달) 나머지의 % 칸
    let base = 0;
    if (q) { try { base = S.scaleRange(q, basis, range, months, 10, { lock }).before; } catch (e) { /* 지급 없음 · 잠긴 달 */ } }
    const kind = base > 0 ? 'scale' : 'share';
    /* 칸 하나(또는 고른 값)의 미리보기 — 그 기간 합 · 월평균 · 예산 대비. 못 바꾸면 '' */
    const preview = (k, v) => {
      try {
        if (k === 'scale') { const r = S.scaleRange(q, basis, range, months, v, { lock }); const o = outcome(r.person); return `${v === -100 ? '제외 (−100%)' : signed(v)} — ${span} ${S.thousand(r.before)} → ${S.thousand(r.after)}천원${avgTxt(o.avg)}${o.bd.text ? ` · ${o.bd.text}` : ''}`; }
        if (k === 'share') {
          if (!(left > 0) || !(v > 0) || v > 100) return '';
          const total = Math.round((left * v) / 100 / 1000) * 1000;
          const per = info.span > 0 ? Math.ceil(total / info.span / 1000) * 1000 : total;
          let avg = null;   // 월평균 — 있는 사람은 반영한 뒤의 값, 더하기는 폼의 월급여로
          if (q) avg = outcome(S.applyShare(q, basis, Object.assign({ pct: v }, range), months, opts).person).avg;
          else { const m = S.thousandOf(d.manual); if (m > 0 && info.span > 0) avg = S.floorRate(total, m * info.span); }
          const bd = S.budgetDiff({ total: ctx.budget - left + total, budget: ctx.budget });
          return `나머지 ${S.thousand(left)}천원의 ${v}% = ${S.thousand(total)}천원 → ${span} 월 약 ${S.thousand(per)}천원${avgTxt(avg)}${bd.text ? ` · ${bd.text}` : ''}`;
        }
        if (k === 'even' && q) {   // 균등 — 달마다 같은 금액(합 ÷ 개월, 천원 반올림). 합이 천원 단위로 달라지면 그 차와 예산 대비를 같이
          const r = S.evenRange(q, basis, range, months, { lock }); const o = outcome(r.person); const dd = r.after - r.before;
          return `균등 — ${span} 월 ${S.thousand(r.per)}천원씩 (합 ${S.thousand(r.before)}${dd ? ` → ${S.thousand(r.after)}천원, ${dd > 0 ? '+' : '−'}${S.thousand(Math.abs(dd))}` : ''}천원)${avgTxt(o.avg)}${o.bd.text ? ` · ${o.bd.text}` : ''}`;
        }
        if (k === 'max' && mx) {   // MAX — 최대 참여율을 그 기간에 round천원(월급여 × %)로(S.applyChange 'rate'). 예산 나머지와 100% 규칙 가운데 어느 쪽이 묶었는지 같이
          const after = S.applyChange(q || newPerson(), basis, Object.assign({ mode: 'rate', value: v }, range), months, { lock }); const o = outcome(after);
          const why = mx.byBudget != null && mx.byBudget <= mx.by100 ? `예산 나머지 ${S.thousand(mx.left)}천원 기준` : `100% 규칙(다른 과제 ${S.rateText(Math.round((100 - mx.by100) * 100) / 100)}) 기준`;
          return `MAX — 참여율 ${v}% (${why}): ${span} 월 ${S.thousand(S.amountOfRate(mx.limit, v))}천원씩${avgTxt(o.avg)}${o.bd.text ? ` · ${o.bd.text}` : ''}`;
        }
        if (k === 'fit' && q) {
          const r = S.fitBudget(q, basis, range, months, opts);
          const over = r.diff > 0, amt = S.thousand(Math.abs(r.diff));
          const pctTxt = r.before > 0 ? ` (기준의 ${signed(Math.round((r.after / r.before - 1) * 100))})` : '';
          return `예산에 맞추기 — ${over ? `초과금 ${amt}천원 줄임` : `부족금 ${amt}천원 채움`}: ${span} ${S.thousand(r.before)} → ${S.thousand(r.after)}천원${pctTxt}${avgTxt(outcome(r.person).avg)} · 인건비 합 = 예산 ${S.thousand(ctx.budget)}천원 (달마다 고르게 — 달 사이의 차이는 그대로)`;
        }
      } catch (e) { return ''; }
      return '';
    };
    const cell = (v, label, cls, offTip) => {
      const pv = preview(kind, v);
      if (!pv) return `<button type="button" class="krext-st-step ${cls}" disabled title="${esc(offTip)}">${label}</button>`;
      const on = stepOn(sel, kind, v);
      return `<button type="button" class="krext-st-step ${cls}${on ? ' krext-st-step-on' : ''}" data-act="st-step" data-step="${v}" data-kind="${kind}" data-id="${id}" data-preview="${esc(pv)}" title="${esc(pv)}" aria-pressed="${on}">${label}</button>`;
    };
    let cells, head, hint;
    if (kind === 'scale') {
      cells = STEPS_SCALE.map((v) => (v ? cell(v, v === -100 ? '제외<small>−100%</small>' : signed(v), v === -100 ? 'krext-st-step-dn krext-st-step-exclude' : v < 0 ? 'krext-st-step-dn' : 'krext-st-step-up', '이 칸으로는 바꿀 수 없습니다')
        : `<span class="krext-st-step krext-st-step-base" data-step="0" data-preview="" title="${esc(`기준 — ${span} 지금 지급 ${S.thousand(base)}천원. 여기서 놓으면 고른 것을 거둡니다`)}">기준</span>`)).join('');
      head = `기준 <b>${esc(S.thousand(base))}</b>천원 · ${esc(span)} (${esc(mo)}개월) · ${left > 0 ? `나머지 ${esc(S.thousand(left))}천원` : '나머지 없음'}`;
      hint = '칸을 누르거나 기준에서 끌어 10% 간격으로 고르고(−1% · +1% 로 미세 조정) 반영을 누르세요';
    } else {
      cells = STEPS_SHARE.map((v) => cell(v, `${v}%`, 'krext-st-step-share', '나머지가 없습니다 — 다른 지급의 합이 예산에 닿았습니다')).join('');
      head = `${left > 0 ? `나머지 <b>${esc(S.thousand(left))}</b>천원` : '나머지 없음'} · ${esc(span)} (${esc(mo)}개월)`;
      hint = `칸을 누르거나 끌어 나머지의 10~100% 를 고르고(−1% · +1% 로 미세 조정) ${q ? '반영을' : '인력추가를'} 누르세요 — 그 기간에 고르게 ${q ? '넣습니다' : '넣어 더합니다'}`;
    }
    // −1% · +1% — 고른 값을 1% 씩(scale: 기준에서 ±, share: 나머지의 %). 고른 것이 없으면 0 에서 시작
    const nudge = (dir) => `<button type="button" class="krext-st-step krext-st-step-nudge" data-act="st-nudge" data-dir="${dir}" data-kind="${kind}" data-id="${id}" title="${esc(`${kind === 'scale' ? '기준에서' : '나머지의'} 1% 씩 ${dir > 0 ? '늘림' : '줄임'}${sel && sel.kind === kind ? ` — 지금 ${kind === 'scale' ? signed(sel.v) : `${sel.v}%`}` : ''}`)}">${dir > 0 ? '+1%' : '−1%'}</button>`;
    let fit = '';
    if (q) {   // 맨 오른쪽 — 예산에 맞추기(초과금 줄이기 · 부족금 채우기). 더하기는 나머지 100% 가 같은 일
      const bd = S.budgetDiff(S.overBudget(staff, basis, ctx.budget));
      const pv = preview('fit', 1);
      const sub = bd.kind === 'over' ? `초과금 ${S.thousand(bd.diff)}` : bd.kind === 'short' ? `부족금 ${S.thousand(-bd.diff)}` : '예산과 같음';
      if (pv) {
        const on = stepOn(sel, 'fit', 1);
        fit = `<button type="button" class="krext-st-step krext-st-step-fit${bd.kind === 'over' ? ' krext-st-fit-over' : ''}${on ? ' krext-st-step-on' : ''}" data-act="st-fit" data-id="${id}" data-preview="${esc(pv)}" title="${esc(pv)}" aria-pressed="${on}">예산에 맞추기<small>${sub}</small></button>`;
      } else {
        const why = bd.kind === 'even' || bd.kind === '' ? '인건비 합이 이미 예산과 같습니다' : `${span}의 지급을 모두 0 으로 해도 예산을 넘습니다 — 다른 사람이나 기간을 고르세요`;
        fit = `<button type="button" class="krext-st-step krext-st-step-fit" disabled title="${esc(why)}">예산에 맞추기<small>${sub}</small></button>`;
      }
    }
    let mxBtn = '';
    {   // 예산에 맞추기 오른쪽 · 균등 왼쪽 — MAX(최대 참여율 — 2026-10-20 사용자 "참여율은 MAX/ 최대 들어 갈 수 있는 것으로 … 표기도 해주고 … 우측에 균등 왼쪽에 MAX"). 더하기(＋ 폼)도 됨. 월급여가 없거나 0% 면 꺼짐
      const pv = mx && mx.rate > 0 ? preview('max', mx.rate) : '';
      const sub = `참여율 ${mx ? `${mx.rate}%` : '—'}`;
      if (pv) {
        const on = stepOn(sel, 'max', mx.rate);
        mxBtn = `<button type="button" class="krext-st-step krext-st-step-fit krext-st-step-max${on ? ' krext-st-step-on' : ''}" data-act="st-max" data-id="${id}" data-v="${mx.rate}" data-preview="${esc(pv)}" title="${esc(pv)}" aria-pressed="${on}">MAX<small>${esc(sub)}</small></button>`;
      } else {
        const why = mxWhy || (mx && mx.by100 <= 0 ? '다른 과제 참여율이 이미 100% 라 넣을 수 없습니다' : mx && mx.byBudget === 0 ? '나머지가 없습니다 — 다른 지급의 합이 예산에 닿았습니다' : '이 기간에는 최대 참여율을 셈할 수 없습니다');
        mxBtn = `<button type="button" class="krext-st-step krext-st-step-fit krext-st-step-max" disabled title="${esc(why)}">MAX<small>${esc(sub)}</small></button>`;
      }
    }
    let even = '';
    if (q) {   // MAX 오른쪽 — 균등(달마다 같은 금액 = 합 ÷ 개월 천원 반올림 — 2026-10-20 사용자 "매월 동일 금액 … '균등'", "균등이 안되는데"(마지막 달 잔액 꼴은 아님)). 지급이 없거나 잠긴 달이면 꺼짐
      const pv = preview('even', 1);
      const on = stepOn(sel, 'even', 1);
      even = pv ? `<button type="button" class="krext-st-step krext-st-step-fit krext-st-step-even${on ? ' krext-st-step-on' : ''}" data-act="st-even" data-id="${id}" data-preview="${esc(pv)}" title="${esc(pv)}" aria-pressed="${on}">균등<small>매월 같게</small></button>`
        : `<button type="button" class="krext-st-step krext-st-step-fit krext-st-step-even" disabled title="${esc(`${span}에 지급이 없거나 지급이 끝난 달이라 고르게 나눌 수 없습니다`)}">균등<small>매월 같게</small></button>`;
    }
    // 읽기 줄 — 고른 것이 있으면 "반영을 누르면 — 미리보기"(지금 날짜로 안 되면 그 말), 없으면 안내. 칸에 올리면 bind 가 그 칸의 미리보기로 잠깐 바꾼다(data-default 로 돌아옴)
    const pending = sel ? preview(sel.kind, sel.v) : '';
    const read = sel ? (pending ? `<b>${q ? '반영' : '인력추가'}</b>${q ? '을' : '를'} 누르면 — ${esc(pending)}` : `${esc(stepLabel(sel).trim())} 은(는) 지금 날짜로 반영할 수 없습니다 — 다른 칸을 고르거나 날짜를 고치세요`) : esc(hint);
    return `<div class="krext-st-quick"><div class="krext-st-steps krext-st-steps-${kind}" role="group" aria-label="${kind === 'scale' ? '기준에서 10% 간격으로 늘리고 줄이기' : '나머지의 10~100%'}" data-kind="${kind}" data-id="${id}"><div class="krext-st-scale-options">${cells}</div><div class="krext-st-nudges" role="group" aria-label="1%씩 미세 조정">${nudge(-1)}${nudge(1)}</div></div>`
      + `<div class="krext-st-quick-footer"><span class="krext-st-quick-k">${head}</span><div class="krext-st-auto-actions" role="group" aria-label="자동 계산">${fit}${mxBtn}${even}</div></div>`
      + `<div class="krext-st-step-read"><span class="krext-st-step-pv${sel ? ' krext-st-step-pending' : ''}" data-default="${esc(sel && pending ? `반영을 누르면 — ${pending}` : sel ? read.replace(/<[^>]+>/g, '') : hint)}" aria-live="polite">${read}</span></div></div>`;
  }

  /* ---------- 처리 ---------- */
  function bind(host, state, draw) {
    if (!state.staffPlans || typeof state.staffPlans !== 'object') state.staffPlans = {};
    if (!state.staffRows) state.staffRows = {};
    if (!state.staffAliases) state.staffAliases = {};
    if (!state.staffChanges || typeof state.staffChanges !== 'object') state.staffChanges = {};
    if (!state.staffSupport || typeof state.staffSupport !== 'object') state.staffSupport = {};
    if (!state.staffCollect || typeof state.staffCollect !== 'object') state.staffCollect = {};   // 자료 요청(lib/collect.js)
    viewOf(state);
    const swallow = (r) => { if (r && r.catch) r.catch(() => {}); };
    const requestSync = () => { try { swallow(chrome.runtime.sendMessage({ type: 'planSyncQueue', reason: 'edit' })); } catch (e) {} };   // 공유 (Plus) 요청(4초 모아서 — 꺼져 있으면 백그라운드가 무시, background.js shareSync)
    const persist = () => { try { const r = S.save(state.staffPlans); if (r && r.then) r.then(requestSync, () => {}); } catch (e) {} };
    const saveView = () => { try { swallow(chrome.storage.local.set({ [VIEW_KEY]: state.staffView })); } catch (e) {} };
    // 보기 단추는 다시 그리면 새 DOM 이 된다 — 누른 단추로 초점을 돌려 Enter/Space 를 이어서 쓸 수 있게 한다.
    const drawView = (selector) => { draw(); const el = host.querySelector(selector); if (el) el.focus({ preventScroll: true }); };
    /* 참여인력 변경 탭(popup.js applyHash — 주소 #tab&page=staff&only=staff&prj=과제번호&year=연차): 주소의 과제·연차를 보는 상태로. 저장된 staffView 가 뒤늦게 읽혀도 덮지 않게 state.staffFocus 로 기억해 두고 읽은 뒤 다시 적용 */
    const applyFocus = () => { const f = state.staffFocus; if (!f || !f.prjNo) return; const v = viewOf(state); v.prjNo = f.prjNo; if (f.year >= 1) v.years[f.prjNo] = f.year; };
    const focus = (f) => { state.staffFocus = f && f.prjNo ? { prjNo: String(f.prjNo), year: Number(f.year) || 0 } : null; applyFocus(); openPage(true); };
    /* [참여인력 변경] 단추 — 같은 popup.html 을 브라우저 탭으로 (background.js openExtTab: 같은 경로의 탭이 있으면 그 탭의 주소만 바꿔 앞으로). eClass 패널(콘텐츠스크립트)·사이드 패널·팝업 어디서나 백그라운드가 연다 */
    const openTab = (prjNo, year) => {
      try {
        const url = `${chrome.runtime.getURL('popup/popup.html')}#tab&page=staff&only=staff&prj=${encodeURIComponent(prjNo)}&year=${Number(year) || 1}`;
        swallow(chrome.runtime.sendMessage({ type: 'openExtTab', url }));
      } catch (e) {}
    };
    let who = '';   // 계획의 by(누가 고쳤나) — R&D ERP 로그인 이름
    try {
      const r = chrome.storage.local.get(['rndUser', 'staffSyncState', VIEW_KEY, ALIAS_KEY, CHANGES_KEY, SUPPORT_KEY, COLLECT_KEY, 'teamsStatus']);
      if (r && r.then) r.then((l) => {
        who = String((l.rndUser || {}).userNm || '');
        state.staffWho = who;   // 자료 요청 대상(collectNames)에서 내 이름을 빼는 데 — 백그라운드도 뺀다
        if (l.staffSyncState) state.staffSync = l.staffSyncState;
        if (l[VIEW_KEY] && typeof l[VIEW_KEY] === 'object') { state.staffView = l[VIEW_KEY]; viewOf(state); applyFocus(); }
        if (l[ALIAS_KEY] && typeof l[ALIAS_KEY] === 'object') state.staffAliases = l[ALIAS_KEY];
        if (l[CHANGES_KEY] && typeof l[CHANGES_KEY] === 'object') state.staffChanges = l[CHANGES_KEY];
        if (l[SUPPORT_KEY] && typeof l[SUPPORT_KEY] === 'object') state.staffSupport = l[SUPPORT_KEY];
        if (l[COLLECT_KEY] && typeof l[COLLECT_KEY] === 'object') state.staffCollect = l[COLLECT_KEY];
        if (l.teamsStatus && typeof l.teamsStatus === 'object') state.teamsStatus = l.teamsStatus;   // 팀즈 MCP 연결 상태(lib/teams-mcp.js)
        if (Object.keys(state.staffCollect || {}).length) { try { const pr = chrome.runtime.sendMessage({ type: 'teamsProbe' }); if (pr && pr.then) pr.then((st) => { if (st && typeof st.ok === 'boolean') { state.teamsStatus = st; draw(); } }, () => {}); } catch (e) {} }   // 자료 요청을 쓰는 사람만 확인(이 PC 의 localhost — 싸다)
        draw();
        setTimeout(ensureCurrent, 300);
      }, () => {});
    } catch (e) {}
    const touch = (plan) => { plan.at = nowMs(); if (who) plan.by = who; collectFollow(plan); };
    /* 계획에 새로 든 참여연구원은 자료 요청에도 저절로(2026-10-20 사용자 "참여연구원 추가 하면 자동으로 추가하도록") — 이 연차의 요청이 있고 표에 없는 대상 이름이 생기면 [공유]와 같은 길(st-co-share: 이메일 찾기 · 목록 공유 → [팀즈로 보내기] 단추).
     * 더하는 손(＋ 폼 · 변경 도우미 · 가져오기 · 응답 반영)이 모두 touch 를 거치므로 여기 한 곳에서. 뺀 사람은 표에 그대로(응답이 남아 있을 수 있어). 다른 collect 일이 진행 중이면 건너뜀(다음 변경 때 다시) */
    const collectFollow = (plan) => {
      if (state.staffCollectBusy) return;
      const names = collectNames(state, plan.prjNo, plan.year, plan, null);
      const req = reqsOf(state, plan.prjNo, plan.year).find((r) => names.some((n) => !r.people.some((x) => S.sameName(x.name, n))));   // 표에 없는 사람이 있는 첫 요청(한 번에 하나 — 다음 요청은 다음 touch 때)
      if (req) collectAct('st-co-share', plan.prjNo, plan.year, null, req.no);
    };
    /* 변경이력 한 줄 — 메모리(state.staffChanges)에 바로, 저장소(shareChanges)는 읽어서 합집합으로 덧붙여(다른 창·백그라운드가 같은 키에 쓰는 중일 수 있어 통째로 덮지 않음) 쓰고 공유 요청 */
    const logChange = (prjNo, year, kind, item, before, after) => {
      const e = changeEntry({ kind, item, before, after, by: who });
      const key = S.planKey(prjNo, year);
      state.staffChanges[key] = appendChanges(state.staffChanges[key], e);
      try {
        const r = chrome.storage.local.get(CHANGES_KEY);
        const write = (l) => { const all = Object.assign({}, (l && l[CHANGES_KEY] && typeof l[CHANGES_KEY] === 'object') ? l[CHANGES_KEY] : {}); all[key] = appendChanges(all[key], e); return chrome.storage.local.set({ [CHANGES_KEY]: all }); };
        if (r && r.then) r.then((l) => { const w = write(l); if (w && w.then) w.then(requestSync, () => {}); }, () => swallow(write(null)));
        else swallow(write(null));
      } catch (e2) {}
      return e;
    };
    /* 연차 계획 한 줄 요약(변경이력의 before — 지우기·초기화 때) */
    const planSummary = (plan) => { const st = staffOf(plan); const parts = [plan && Array.isArray(plan.budget) ? `예산 ${plan.budget.length}줄` : '', st ? sumText(st) : '']; return parts.filter(Boolean).join(' · ') || '(없음)'; };
    const setShareMsg = (prjNo, text, error) => { state.staffShareMsg = { prjNo, text, error: !!error }; };
    const projects = () => ((state.data || {}).projects) || [];
    const projectOf = (prjNo) => projects().find((p) => p.prjNo === prjNo) || { prjNo, prjNm: '' };
    const setMsg = (prjNo, year, text, error) => { state.staffMsg = { prjNo, year, text, error: !!error }; };
    const closeForm = () => { state.staffEdit = null; state.staffDraft = null; state.staffError = ''; state.staffAliasEdit = null; state.staffAliasDraft = null; state.staffAliasError = ''; state.staffSupportNew = null; };
    /* 패널 카드가 계획 대신 보이는 rERP 등록 지급계획(이 기간) — 표 복사에 */
    const erpViewOf = (prjNo, year) => { const c = cacheOf(prjNo); if (!c || !c.rows) return null; const months = monthsOf(prjNo, year); return S.peopleOfErp(c.rows, { prjNo, now: c.at, months: months.length ? months : null }); };
    /* 행정지원 저장 — projectSupport[prjNo] = { people, at(지금) } (저장소를 읽어 이 과제만 갈아 넣음), 변경이력 한 줄(그 연차 몫에), 공유 요청. 비어도 삭제 시각은 남긴다. */
    function setSupport(prjNo, people, what) {
      const was = supportOf(state, prjNo);
      const next = S.normalizeSupport(people);
      const same = JSON.stringify(next) === JSON.stringify(was.people);
      const at = same ? was.at : nowMs();
      state.staffSupport[prjNo] = { people: next, at };
      if (same) return;
      try {
        const r = chrome.storage.local.get(SUPPORT_KEY);
        const write = (l) => { const all = Object.assign({}, (l && l[SUPPORT_KEY] && typeof l[SUPPORT_KEY] === 'object') ? l[SUPPORT_KEY] : {}); if (next.length || at) all[prjNo] = { people: next, at }; else delete all[prjNo]; return chrome.storage.local.set({ [SUPPORT_KEY]: all }); };
        if (r && r.then) r.then((l) => { const w = write(l); if (w && w.then) w.then(requestSync, () => {}); }, () => swallow(write(null)));
        else swallow(write(null));
      } catch (e) {}
      logChange(prjNo, yearSel(prjNo), '연구진', '행정지원', S.supportText(was.people) || '(없음)', `${S.supportText(next) || '(없음)'} (${what})`);
      setMsg(prjNo, yearSel(prjNo), `행정지원 — ${what}: ${S.supportText(next) || '없음'}`, false);
    }
    const yearSel = (prjNo) => yearOf(projectOf(prjNo), state);
    const planOf = (prjNo, year, make) => {
      const key = S.planKey(prjNo, year); let plan = state.staffPlans[key];
      if (!plan && make) {
        plan = planShell(projectOf(prjNo), year, null);
        const c = cacheOf(prjNo);
        if (c && c.paid && year === S.anlOf(projectOf(prjNo))) plan.paid = c.paid;   // 이 세션에서 셈한 지급 완료를 새 계획에
        state.staffPlans[key] = plan;
      }
      return plan || null;
    };
    const monthsOf = (prjNo, year) => { const per = periodOf(projectOf(prjNo), planOf(prjNo, year), year); return S.ymRange(per.from, per.to); };
    const rowsOf = (prjNo, year) => budgetRows(projectOf(prjNo), planOf(prjNo, year), year, state);
    const payOf = (prjNo, year) => budgetOf(projectOf(prjNo), planOf(prjNo, year), year, rowsOf(prjNo, year).rows);
    const arm = (key) => { const a = state.staffArm; if (a && a.key === key && a.until > nowMs()) { state.staffArm = null; return true; } state.staffArm = { key, until: nowMs() + ARM_MS }; setTimeout(() => { if (state.staffArm && state.staffArm.key === key && state.staffArm.until <= nowMs()) { state.staffArm = null; draw(); } }, ARM_MS + 50); return false; };
    const call = (service, input) => new Promise((res, rej) => { try { chrome.runtime.sendMessage({ type: 'callService', service, input }).then((r) => (r && r.error ? rej(Object.assign(new Error(r.error), { kind: r.kind })) : res(r || {})), rej); } catch (e) { rej(e); } });
    const fetchBudgetOf = (prjNo) => new Promise((res, rej) => { try { chrome.runtime.sendMessage({ type: 'fetchBudget', prjNo }).then((r) => (!r || r.error ? rej(Object.assign(new Error((r && r.error) || '응답 없음'), { kind: r && r.kind })) : res(r)), rej); } catch (e) { rej(e); } });   // 자금현황 비목별 잔액(인건비 승인액)
    /* 지급이 끝난 마지막 달('YYYY-MM' | '') — 계획의 paid 와 이 세션 조회의 cache.paid(현재 연차만) 가운데 늦은 쪽(paidOf) */
    const lockAt = (prjNo, year) => S.lockOf(paidOf(planOf(prjNo, year), cacheOf(prjNo), year === S.anlOf(projectOf(prjNo))));
    const samePaid = (a, b) => JSON.stringify(a ? [a.from, a.through, a.amt, a.appr, a.left] : null) === JSON.stringify(b ? [b.from, b.through, b.amt, b.appr, b.left] : null);
    /* 현재 연차 계획의 지급 완료 칸 — 내용이 바뀌었을 때만 저장·공유 요청(계획의 at 은 올리지 않는다 — 남의 더 새로운 편집을 덮지 않게; 공유 병합은 paid.at 으로 따로). 계획이 없으면 cache.paid 만(계획을 만들 때 planOf 가 옮김) */
    function setPaid(prjNo, year, paid) {
      const plan = planOf(prjNo, year);
      if (!plan || samePaid(plan.paid || null, paid)) return false;
      if (paid) plan.paid = paid; else delete plan.paid;
      persist();
      return true;
    }
    const showing = () => state.page === PAGE;
    /* 보고 있는 과제의 rERP 참여인력을 아직 안 받았으면 받는다 — 화면을 열 때, 과제 칩을 고를 때 */
    const ensureCurrent = () => { if (!showing()) return; const p = projOf(projects(), state); if (p && needRows(p.prjNo)) fetchRows(p.prjNo); };
    /* 사업비 관리 화면 열기/닫기 — 접힌 패널(eClass)이면 펼친다 */
    const openPage = (on) => { state.page = on ? PAGE : ''; closeForm(); if (on && state.collapsed) { state.collapsed = false; try { swallow(chrome.storage.local.set({ panelCollapsed: false })); } catch (e) {} } draw(); if (on) setTimeout(ensureCurrent, 0); };
    setTimeout(ensureCurrent, 1500); setTimeout(ensureCurrent, 6000);   // 패널이 열리며 자료가 늦게 올 수 있어 두 번

    /* rERP 조회 — 참여인력 행 + 사람마다 다른 과제 월별 참여율. 끝나면 이 과제 모든 연차 계획 사람들의 rERP 값(월급여·신청 번호·다른 과제)을 잇는다 */
    async function fetchRows(prjNo, { manual = false } = {}) {
      const cache = state.staffRows[prjNo] = Object.assign({}, state.staffRows[prjNo] || {}, { loading: true, error: '' });
      draw();
      try {
        const data = await call(PART_SVC, { SEARCH_NM: '', SEARCH_GB: '1', PRJ_NO: prjNo });
        const rows = S.rowsOfErp(data.INFO_REC);
        cache.rows = rows; cache.at = nowMs(); cache.others = cache.others || {};
        // 자금현황 인건비 비목 승인액 → 몇 월까지 지급됐나(현재 연차 계획의 달들). 조회가 안 되면 패널 캐시의 자금현황(과제집행비율 조회)으로
        let appr = null;
        try { appr = payApprOf((await fetchBudgetOf(prjNo)).items); } catch (e) { appr = payApprOf(((projectOf(prjNo).budget || {}).items) || null); }
        cache.appr = appr;
        if (appr != null) {
          const cur = S.anlOf(projectOf(prjNo));
          cache.paid = S.paidThroughOf(rows, appr, { prjNo, months: monthsOf(prjNo, cur), now: cache.at });
          setPaid(prjNo, cur, cache.paid);
        }
        const by = S.byName(rows);
        const want = new Map();
        for (const h of Object.values(by)) if (h.req && h.seq) want.set(h.seq, h);
        for (const [seq, h] of want) {
          try { cache.others[seq] = S.othersOfErp(await call(OTHERS_SVC, { PRJ_NO: prjNo, REQ_CNT: h.req, SEQ_NO: seq })).rows; } catch (e) { /* 한 사람의 다른 과제 조회 실패는 넘어간다 */ }
        }
        let linked = false;
        for (const plan of Object.values(S.plansOfProject(state.staffPlans, prjNo))) if (plan.people.length) { linkErp(plan, prjNo, by, cache); linked = true; }
        if (linked) { try { swallow(S.save(state.staffPlans)); } catch (e) {} }   // rERP 값만 이은 것 — 동기화 요청은 하지 않는다
        setMsg(prjNo, yearSel(prjNo), manual ? `rERP 참여인력 ${Object.keys(by).length}명을 다시 받았습니다.` : '', false);
      } catch (e) {
        cache.error = (e && e.kind === 'login') ? 'R&D ERP 로그인이 필요합니다 — 제목 줄 ↻ 로 다시 조회한 뒤 다시 누르세요' : String((e && e.message) || e);
      } finally {
        cache.loading = false;
        draw();
      }
    }
    /* 계획 사람들에 rERP 값(월급여·신청 번호·다른 과제 월별 참여율)을 이름으로 잇는다 — 금액은 건드리지 않는다 */
    function linkErp(plan, prjNo, by, cache) {
      for (const q of plan.people) {
        const h = by[S.nameKeyOf(q.name)];
        if (!h || !(h.monthly > 0)) continue;
        q.erp = { monthly: h.monthly, prjNo, at: cache.at || nowMs(), req: h.req, seq: h.seq, others: (cache.others && cache.others[h.seq]) || [] };
      }
    }
    const cacheOf = (prjNo) => state.staffRows[prjNo] || null;
    const needRows = (prjNo) => { const c = cacheOf(prjNo); return !c || (!c.loading && !c.rows); };

    /* 예산 대비 한 마디 — 초과금(빨강)·부족금. 예산을 모르면 '' */
    const diffOf = (plan) => S.budgetDiff(S.overBudget(staffOf(plan), plan.basis, payOf(plan.prjNo, plan.year)));
    /* 바뀐 사람을 그 연차 계획에 — 예산을 넘어도 막지 않고 초과금을 보인다(2026-10-19 사용자 "참여율 변경하면 초과금, 부족금 이게 표시가 되어야지") */
    function commit(prjNo, year, before, after, what, tail = '') {   // tail: 메시지에 덧붙일 글(부족금의 % 결과)
      const plan = planOf(prjNo, year);
      if (!plan) return false;
      const sb = S.personStats(before, plan.basis), sa = S.personStats(after, plan.basis);
      plan.people = plan.people.map((x) => (x.id === before.id ? after : x)); touch(plan);
      closeForm(); persist();
      const moved = JSON.stringify(before.plan) !== JSON.stringify(after.plan);
      const bd = diffOf(plan);
      logChange(prjNo, year, '연구진', before.name, S.statsText(sb), `${S.statsText(sa)} (${what})`);   // 사람 표의 칸 편집(월급여·계상인건비·참여율)과 ✎ 반영은 모두 여기서 한 번만
      setMsg(prjNo, year, `${moved ? `${before.name} — ${what}: ${S.statsText(sb)} → ${S.statsText(sa)}` : `${before.name} — ${what}을 바꿨습니다(지급은 그대로).`}${tail}${bd.text ? ` · ${bd.text}` : ''}`, bd.kind === 'over');
      draw();
      return true;
    }
    function applyForm(prjNo, year, id) {   // 반영·더하기 — 증감 줄에서 고른 것(draft.step: fit 예산에 맞추기 S.fitBudget · scale 기준에서 ±n% S.scaleRange · share 나머지의 n%)이 있으면 그것으로, 없으면 구분·값으로
      const d = state.staffDraft || {};
      // 행정지원도 같은 추가 폼을 쓰지만, 과제 공통 공유 정보는 기존 저장소에 둔다.
      if (id === 'new' && d.role === '행정지원') {
        try {
          const name = String(d.name || '').trim();
          if (!name) throw new Error('성명을 적으세요.');
          const cur = supportOf(state, prjNo);
          if (cur.people.some((p) => S.sameName(p.name, name)) || Object.values(S.plansOfProject(state.staffPlans, prjNo)).some((p) => p.people.some((q) => S.sameName(q.name, name)))) throw new Error(`${name} 은(는) 이미 있습니다.`);
          if (cur.people.length >= S.SUPPORT_MAX) throw new Error(`행정지원은 ${S.SUPPORT_MAX}명까지입니다.`);
          setSupport(prjNo, cur.people.concat([{ name, role: d.supportRole || '', ref: d.ref !== false }]), `${name} 더함`);
          closeForm(); draw();
        } catch (e) { state.staffError = String((e && e.message) || e); draw(); }
        return;
      }
      const plan = planOf(prjNo, year, true);
      const months = monthsOf(prjNo, year);
      const lock = lockAt(prjNo, year);   // rERP 지급이 끝난 달까지는 거부(S.applyChange)
      const step = d.step && d.step.kind ? d.step : null;   // 증감 줄에서 고른 것 — 구분·값보다 앞선다
      const mode = step ? (step.kind === 'share' ? 'short' : step.kind) : (d.mode || 'rate');
      const change = { from: d.from || (months[0] ? S.monthStart(months[0]) : ''), to: d.to || '', mode, value: step ? step.v : mode === 'amt' ? S.thousandOf(d.value) : d.value };
      let share = null, fit = null, scaled = null, even = null;   // 나머지의 % 의 결과 { left, total, pct } · 예산 맞추기의 결과 { diff, before, after } · 증감의 결과 { pct, before, after } — 메시지에
      const budgetOpts = (q) => ({ budgetPay: payOf(prjNo, year), others: S.staffTotal({ people: plan.people.filter((x) => x.id !== q.id) }, plan.basis), lock });   // 인건비 예산 · 다른 사람들의 합
      const apply = (q) => {   // 구분대로 바꾼 사람 — 나머지의 % 는 S.applyShare, 예산 맞추기는 S.fitBudget(둘 다 인건비 예산과 다른 사람들의 합으로), 그 밖은 S.applyChange
        if (mode === 'fit') { fit = S.fitBudget(q, plan.basis, { from: change.from, to: change.to }, months, budgetOpts(q)); return fit.person; }
        if (mode === 'even') { even = S.evenRange(q, plan.basis, { from: change.from, to: change.to }, months, { lock }); return even.person; }
        if (mode === 'max') return S.applyChange(q, plan.basis, { from: change.from, to: change.to, mode: 'rate', value: change.value }, months, { lock });   // MAX — 고른 최대 참여율을 그대로(더하기도 됨)
        if (mode === 'scale') { scaled = S.scaleRange(q, plan.basis, { from: change.from, to: change.to }, months, change.value, { lock }); return scaled.person; }
        if (mode !== 'short') return S.applyChange(q, plan.basis, change, months, { lock });
        share = S.applyShare(q, plan.basis, { from: change.from, to: change.to, pct: change.value }, months, budgetOpts(q));
        return share.person;
      };
      const remember = () => { state.staffLastRange = { key: S.planKey(prjNo, year), from: S.dateOf(change.from, 'start'), to: S.dateOf(change.to, 'end') }; };   // 다음 ✎·＋ 폼의 기본 날짜(defaultRange)
      const shareTxt = () => (share ? ` · 나머지 ${S.thousand(share.left)}천원의 ${share.pct}% = ${S.thousand(share.total)}천원` : fit ? ` · ${fit.diff > 0 ? `초과금 ${S.thousand(fit.diff)}천원 줄임` : `부족금 ${S.thousand(-fit.diff)}천원 채움`}` : scaled ? ` · 기준 ${S.thousand(scaled.before)} → ${S.thousand(scaled.after)}천원 (${signed(scaled.pct)})` : mode === 'max' ? ` · MAX 참여율 ${change.value}%` : '');
      try {
        if (id === 'new') {
          if (mode === 'fit') throw new Error('초과금·부족금 맞추기는 있는 사람의 ✎ 폼에서 합니다 — 더할 때는 나머지 100%.');
          if (mode === 'scale') throw new Error('증감은 지급이 있는 사람의 ✎ 폼에서 합니다 — 더할 때는 나머지의 %.');
          if (mode === 'even') throw new Error('균등은 지급이 있는 사람의 ✎ 폼에서 합니다 — 더할 때는 나머지의 %.');
          if (!months.length) throw new Error('계획 기간(첫 달·마지막 달)을 먼저 정하세요.');
          const name = String(d.name || '').trim();
          if (!name) throw new Error('성명을 적으세요.');
          if (plan.people.some((x) => S.sameName(x.name, name)) || supportOf(state, prjNo).people.some((x) => S.sameName(x.name, name))) throw new Error(`${name} 은(는) 이미 있습니다.`);
          if (plan.people.length >= S.STAFF_MAX) throw new Error(`참여연구원은 ${S.STAFF_MAX}명까지입니다.`);
          const manual = String(d.manual || '').trim();
          if (manual && S.thousandOf(manual) == null) throw new Error('월급여는 천원 단위의 수입니다.');
          let q = S.normalizePerson({ name, role: String(d.role || '').trim(), manual: S.thousandOf(manual) });
          const cache = cacheOf(prjNo);
          if (cache && cache.rows) { const h = S.byName(cache.rows)[S.nameKeyOf(name)]; if (h && h.monthly > 0) q.erp = { monthly: h.monthly, prjNo, at: cache.at, req: h.req, seq: h.seq, others: (cache.others && cache.others[h.seq]) || [] }; }
          q = apply(q);
          if (!plan.people.length) plan.src = 'manual';
          plan.people = plan.people.concat([q]); touch(plan);
          closeForm(); persist(); remember();
          const bd = diffOf(plan);
          logChange(prjNo, year, '연구진', name, '(없음)', `${S.statsText(S.personStats(q, plan.basis))} (더함${share ? ` — 나머지의 ${share.pct}%` : ''})`);
          setMsg(prjNo, year, `${name} 을(를) 더했습니다 — ${S.statsText(S.personStats(q, plan.basis))}${shareTxt()}${bd.text ? ` · ${bd.text}` : ''}.`, bd.kind === 'over'); draw();
          return;
        }
        const q = plan.people.find((x) => x.id === id);
        if (!q) return;
        const after = apply(q);
        if (commit(prjNo, year, q, after, mode === 'scale' ? `증감 ${signed(scaled.pct)}` : ({ rate: '참여율 변경', amt: '월 지급금액 변경', exclude: '제외', short: '나머지 배분', fit: '예산 맞춤', even: '균등', max: 'MAX 참여율' })[change.mode] || '변경', shareTxt() + (even ? ` · 월 ${S.thousand(even.per)}천원씩(합 ${S.thousand(even.before)}${even.after !== even.before ? ` → ${S.thousand(even.after)}` : ''}천원)` : ''))) remember();
      } catch (e) { state.staffError = String((e && e.message) || e); draw(); }
    }
    /* 초기화 — how 'erp': 그 기간의 rERP 등록 지급계획 그대로 · 'prev': 기간 앞 12달의 rERP 지급 비율(없으면 앞 연차 계획의 비율)로 인건비 예산을 나눔 */
    function initFrom(prjNo, year, how) {
      const p = projectOf(prjNo);
      const plan = planOf(prjNo, year, true);
      const cache = cacheOf(prjNo);
      if (!cache || !cache.rows) { setMsg(prjNo, year, 'rERP 참여인력을 먼저 조회합니다…', false); fetchRows(prjNo).then(() => { if (cacheOf(prjNo) && cacheOf(prjNo).rows) initFrom(prjNo, year, how); }); return; }
      const per = periodOf(p, plan, year);
      const months = S.ymRange(per.from, per.to);
      if (!months.length) { setMsg(prjNo, year, '계획 기간(첫 달·마지막 달)을 먼저 정하세요.', true); draw(); return; }
      let staff = null, note = '';
      if (how === 'erp') {
        staff = S.peopleOfErp(cache.rows, { prjNo, now: cache.at, months });
        if (!staff) { setMsg(prjNo, year, `rERP 에 ${S.ymText(per.from, per.to)} 의 지급계획이 없습니다 — 이전 기간 비율로 초기화하거나 ＋ 참여인력으로 적으세요.`, true); draw(); return; }
        for (const q of staff.people) if (q.erp && cache.others) q.erp.others = cache.others[q.erp.seq] || [];
        note = `rERP 등록 지급계획(${S.ymText(per.from, per.to)}) 그대로`;
      } else {
        const lock = lockAt(prjNo, year);   // 지급이 끝난 달이 이 기간에 있으면 비율로 다시 나눌 수 없다(그 달의 지급은 사실)
        if (lock && months.some((ym) => ym <= lock)) { setMsg(prjNo, year, `${S.ymText(lock)}까지는 rERP 에서 지급이 끝났습니다 — rERP 현재로 로 초기화한 뒤 그 뒤 달만 바꾸세요.`, true); draw(); return; }
        const budget = payOf(prjNo, year);
        if (!(budget > 0)) { setMsg(prjNo, year, '예산 칸의 인건비 줄에 계획(천원)을 먼저 적으세요 — 그 금액을 이전 기간 참여연구원의 지급 비율로 나눕니다.', true); draw(); return; }
        const prevMonths = S.ymRange(S.addMonths(per.from, -12), S.addMonths(per.from, -1));
        const prevText = S.ymText(prevMonths[0], prevMonths[prevMonths.length - 1]);
        let sources = S.sharesOfErp(cache.rows, { prjNo, now: cache.at, months: prevMonths });
        let basisText = `${prevText} 의 rERP 지급 비율`;
        const prevPlan = year > 1 ? staffOf(planOf(prjNo, year - 1)) : null;
        if (!sources.length && prevPlan) { sources = S.sharesOfStaff(prevPlan); basisText = `${S.yearLabel(year - 1)} 계획의 지급 비율`; }
        staff = S.initFromShares(sources, { budgetPay: budget, span: per });
        if (!staff) { setMsg(prjNo, year, `${prevText} 에 rERP 지급이 없고${year > 1 ? ` ${S.yearLabel(year - 1)} 계획도 없어` : ''} 비율을 셈할 수 없습니다 — ＋ 연구자로 적으세요.`, true); draw(); return; }
        for (const q of staff.people) if (q.erp && cache.others) q.erp.others = cache.others[q.erp.seq] || [];
        note = `${basisText}로 인건비 ${S.thousand(budget)}천원을 나눔`;
      }
      const wasStaff = staffOf(plan);
      Object.assign(plan, { from: per.from, to: per.to, basis: staff.basis, src: staff.src, people: staff.people, note }); touch(plan);
      closeForm(); persist();
      logChange(prjNo, year, '연구진', '참여인력 초기화', wasStaff ? sumText(wasStaff) : '(없음)', `${staff.people.length}명 — ${note}`);
      setMsg(prjNo, year, `${S.yearLabel(year)} 참여연구원 ${staff.people.length}명 — ${note}.`, false); draw();
    }
    /* 이전 차년도에서 가져오기(2차년도부터 — S.carryOver): 앞 연차 계획(없으면 그 기간의 rERP 등록 지급계획 — 조회가 없으면 먼저 받음)의 연구원·월급여·마지막 구간 참여율을 이 연차 기간 전체에.
     * 계획에 사람이 있으면 두 번 눌러야 바꾼다(sure — 변경 도우미의 init carry 는 이미 사용자가 말한 것이라 한 번에). 지급이 끝난 달이 이 기간에 있으면 거부(그 달의 지급은 사실). 가져왔으면 true(메시지는 초과금이면 빨강이어도) */
    function carryFrom(prjNo, year, { sure = false } = {}) {
      if (!(year > 1)) return;
      const p = projectOf(prjNo), prev = S.yearLabel(year - 1);
      const key = S.planKey(prjNo, year);
      if (!sure && staffOf(planOf(prjNo, year)) && !arm(`carry:${key}`)) { draw(); return; }
      const cache = cacheOf(prjNo);
      const src = carrySource(p, year, state);
      if (!src && (!cache || !cache.rows)) {
        if (cache && cache.loading) { setMsg(prjNo, year, 'rERP 참여인력을 조회하는 중입니다 — 끝나면 다시 누르세요.', false); draw(); return; }
        setMsg(prjNo, year, `${prev} 계획이 없어 rERP 참여인력을 먼저 조회합니다…`, false);
        fetchRows(prjNo).then(() => { const c = cacheOf(prjNo); if (c && c.rows) carryFrom(prjNo, year, { sure: true }); });
        return;
      }
      if (!src) { setMsg(prjNo, year, `${prev} 계획도, rERP 에 ${prev} 기간의 지급계획도 없어 가져올 것이 없습니다 — ${prev} 계획을 먼저 세우거나 ＋ 참여인력으로 적으세요.`, true); draw(); return; }
      const per = periodOf(p, planOf(prjNo, year), year);
      const months = S.ymRange(per.from, per.to);
      if (!months.length) { setMsg(prjNo, year, '계획 기간(첫 달·마지막 달)을 먼저 정하세요.', true); draw(); return; }
      const lock = lockAt(prjNo, year);
      if (lock && months.some((ym) => ym <= lock)) { setMsg(prjNo, year, `${S.ymText(lock)}까지는 rERP 에서 지급이 끝났습니다 — rERP 현재로 로 초기화한 뒤 그 뒤 달만 바꾸세요.`, true); draw(); return; }
      const staff = S.carryOver(src.staff, months);
      if (!staff) { setMsg(prjNo, year, `${prev}의 연구원이 모두 마지막에 제외(0원)라 가져올 사람이 없습니다 — ＋ 참여인력으로 적으세요.`, true); draw(); return; }
      if (cache && cache.others) for (const q of staff.people) if (q.erp && cache.others[q.erp.seq]) q.erp.others = cache.others[q.erp.seq];
      const plan = planOf(prjNo, year, true);
      const wasStaff = staffOf(plan);
      const note = `${prev} ${src.from === 'plan' ? '계획' : 'rERP 등록 지급계획'}에서 연구원·월급여·참여율을 가져와 ${S.ymText(per.from, per.to)} 전체(${months.length}개월)에`;
      Object.assign(plan, { from: per.from, to: per.to, basis: staff.basis, src: staff.src, people: staff.people, note }); touch(plan);
      closeForm(); persist();
      logChange(prjNo, year, '연구진', '참여인력 초기화', wasStaff ? sumText(wasStaff) : '(없음)', `${staff.people.length}명 — ${note}`);
      const bd = diffOf(plan);
      setMsg(prjNo, year, `${S.yearLabel(year)} 참여연구원 ${staff.people.length}명 — ${note}${staff.skipped.length ? ` · 마지막이 제외인 ${staff.skipped.join(', ')} 은(는) 뺌` : ''}${bd.text ? ` · ${bd.text}` : ''}.`, bd.kind === 'over'); draw();   // 초과금이면 빨강(✎ 반영과 같음) — 그래도 가져온 것
      return true;
    }
    function setPeriod(prjNo, year, k, v) {
      const plan = planOf(prjNo, year, true);
      const per = periodOf(projectOf(prjNo), plan, year);
      const ym = S.ymOf(v);
      if (!S.isYm(ym)) return;
      plan.from = k === 'from' ? ym : per.from; plan.to = k === 'to' ? ym : per.to;
      if (plan.to && plan.from && plan.to < plan.from) { if (k === 'from') plan.to = plan.from; else plan.from = plan.to; }
      const months = new Set(S.ymRange(plan.from, plan.to));
      for (const q of plan.people) q.plan = q.plan.filter((x) => months.has(x.ym));   // 기간 밖 달은 버린다
      if (plan.from !== per.from || plan.to !== per.to) logChange(prjNo, year, '연구기간', `${S.yearLabel(year)} 계획 기간`, spanText(per) || '(미정)', spanText(plan));
      touch(plan); persist(); draw();
    }
    /* 예산 줄을 처음 고칠 때 기본값(rERP 예산액 · 계획서)을 계획에 옮겨 적는다 — 그 뒤로는 저장된 줄이 기준 */
    function materialize(prjNo, year) {
      const plan = planOf(prjNo, year, true);
      if (!Array.isArray(plan.budget)) plan.budget = rowsOf(prjNo, year).rows.map((r) => ({ name: r.name, plan: r.plan }));
      return plan;
    }
    const syncPay = (plan) => { plan.budgetPay = S.budgetPayOf(plan.budget); };   // 참여인력 칸의 인건비 예산 = 예산 칸의 인건비 줄
    function setBudget(prjNo, year, i, k, v) {
      const plan = materialize(prjNo, year);
      const row = plan.budget[i];
      if (!row) return;
      if (k === 'name') {
        const name = String(v || '').trim().slice(0, 40);
        if (name !== String(row.name || '')) {
          if (!row.name && name) logChange(prjNo, year, '예산', name, '', '(비목 더함)');   // ＋ 비목으로 빈 줄을 만들고 이름을 적는 때
          else logChange(prjNo, year, '예산', `비목 이름`, row.name, name || '(비움)');
        }
        row.name = name;
      } else {
        const t = String(v || '').trim();
        if (t && S.thousandOf(t) == null) { setMsg(prjNo, year, '계획은 천원 단위의 수입니다.', true); draw(); return; }
        const next = t ? S.thousandOf(t) : null;
        if (next !== (row.plan == null ? null : row.plan)) logChange(prjNo, year, '예산', row.name || '비목', thousandText(row.plan), thousandText(next));
        row.plan = next;
      }
      syncPay(plan); touch(plan); persist(); draw();
    }

    /* ---------- 자료 요청(lib/collect.js KRX_COLLECT): 만들기·공유·응답 받기·지우기는 백그라운드(collect*)에 맡기고 결과(req)를 state.staffCollect 에, 응답 반영은 ✎ 폼과 같은 길(commit · viaForm) ---------- */
    const setCoMsg = (key, text, error) => { state.staffCollectMsg = { key, text, error: !!error }; };
    const coReq = (prjNo, year, no) => reqOf(state, prjNo, year, no);
    /* 요청 하나를 저장소에 — 읽어서 그 키만 갈아 넣는다(백그라운드·다른 창이 다른 키를 쓰는 중일 수 있어 통째로 덮지 않음). req 가 null 이면 지움 */
    function saveCollect(prjNo, year, req) {
      const key = coKey(prjNo, year, req && req.no);
      if (req) state.staffCollect[key] = req; else delete state.staffCollect[key];
      try {
        const r = chrome.storage.local.get(COLLECT_KEY);
        const write = (l) => { const all = Object.assign({}, (l && l[COLLECT_KEY] && typeof l[COLLECT_KEY] === 'object') ? l[COLLECT_KEY] : {}); if (req) all[key] = req; else delete all[key]; return chrome.storage.local.set({ [COLLECT_KEY]: all }); };
        if (r && r.then) r.then((l) => swallow(write(l)), () => swallow(write(null))); else swallow(write(null));
      } catch (e) {}
    }
    /* 백그라운드에 한 가지 일(collect*) — 진행 중이면 무시, 끝나면 돌아온 req 를 상태에 */
    async function collectCall(prjNo, year, no, msg, busyText, quiet) {   // quiet: 시작 때 카드를 다시 그리지 않음(누른 단추만 바꾼 뒤 — 한 사람 보내기에 다른 줄까지 깜박이지 않게)
      const key = coKey(prjNo, year, no);
      msg = Object.assign({ no }, msg);
      if (state.staffCollectBusy) return null;
      state.staffCollectBusy = key; setCoMsg(key, busyText, false); if (!quiet) draw();
      let r = null;
      try { r = await chrome.runtime.sendMessage(Object.assign({ prjNo, year }, msg)); } catch (e) { r = { ok: false, error: String((e && e.message) || e) }; }
      state.staffCollectBusy = null;
      if (r && r.req && typeof r.req === 'object') state.staffCollect[key] = r.req;   // 저장은 백그라운드가 했다(onChanged 로도 오지만 같은 값)
      return r || { ok: false, error: '응답이 없습니다' };
    }
    function collectAct(act, prjNo, year, btn, noArg) {
      const no = Number(noArg) >= 1 ? Math.floor(Number(noArg)) : coNoOf(btn), key = coKey(prjNo, year, no), p = projectOf(prjNo), plan = planOf(prjNo, year);
      if (act === 'st-co-new') { const base = S.planKey(prjNo, year), nw = state.staffCollectNew || (state.staffCollectNew = {}); nw[base] = !nw[base]; draw(); return; }   // [요청 추가]/[추가 취소] — 새 요청 폼 보이기
      if (act === 'st-co-toggle') { const op = state.staffCollectOpen || (state.staffCollectOpen = {}), k = `${key}:card`; op[k] = op[k] === false; draw(); return; }   // 카드 접기/펼치기(▾/▸) — 저장 없이 현재 탭만
      const nShared = (req) => (req && req.people ? req.people.filter((x) => x.status === 'shared').length : 0);
      if (act === 'st-co-create') {
        const c = staffCtx(p, plan, year, state);
        const names = collectNames(state, prjNo, year, plan, c);
        if (!names.length) { setCoMsg(key, '대상이 없습니다 — 참여연구원 계획을 먼저 세우거나 rERP 참여인력을 조회하세요.', true); draw(); return; }
        const ask = (state.staffCollectAsk || {})[key];   // 고른 칸(없으면 백그라운드가 기본 참여율·월급여)
        if (Array.isArray(ask) && !ask.length) { setCoMsg(key, '양식에 둘 칸을 하나 이상 고르세요(참여율 · 월급여 · 남은 연구수당).', true); draw(); return; }
        collectCall(prjNo, year, no, { type: 'collectCreate', names, ask, alias: aliasOf(state, prjNo), prjNm: p.prjNm || '', from: c.per.from, to: c.per.to }, '내 OneDrive 에 응답 목록을 만들고 공유하는 중… (SharePoint 작업 창이 잠깐 뜹니다)').then((r) => {
          if (!r) return;
          if (r.ok && state.staffCollectNew) delete state.staffCollectNew[S.planKey(prjNo, year)];   // 새 요청 폼 닫기
          if (!r.ok) setCoMsg(key, `만들지 못했습니다: ${r.message || r.error || ''}`, true);
          else { const req = r.req || {}; const n = nShared(req), all = (req.people || []).length; setCoMsg(key, `양식을 ${r.existed ? '다시 썼습니다' : '만들었습니다'} — ${req.title || ''} · 공유 ${n}/${all}명${r.warnings && r.warnings.length ? ` · 주의: ${r.warnings.join(' · ')}` : ''}. 사람마다 [팀즈로 보내기]를 누르세요${n < all ? ' — 공유 안 된 사람은 이메일을 적고 [공유]' : ''}.`, n < all); }
          draw();
        });
      } else if (act === 'st-co-fetch') {
        collectCall(prjNo, year, no, { type: 'collectFetch' }, '응답을 읽는 중…').then((r) => { if (!r) return; setCoMsg(key, r.ok ? `응답 ${r.count || 0}건을 받았습니다.` : `받지 못했습니다: ${r.message || r.error || ''}`, !r.ok); draw(); });
      } else if (act === 'st-co-share') {
        const req = coReq(prjNo, year, no); if (!req) return;
        const people = req.people.map((x) => ({ name: x.name, email: x.email }));
        for (const n of collectNames(state, prjNo, year, plan, staffCtx(p, plan, year, state))) if (!people.some((x) => S.sameName(x.name, n))) people.push({ name: n, email: '' });   // 계획에 새로 든 사람도
        collectCall(prjNo, year, no, { type: 'collectShare', people }, '이메일을 찾아 공유하는 중…').then((r) => {
          if (!r) return;
          const req2 = (r.req && typeof r.req === 'object') ? r.req : coReq(prjNo, year, no), n = nShared(req2), all = req2 && req2.people ? req2.people.length : 0;
          setCoMsg(key, r.ok ? `공유 ${n}/${all}명${req2 && req2.people.some((x) => x.status === 'ambiguous' || x.status === 'notFound') ? ' — 이름 겹침·못 찾음은 이메일 칸에 직접 적고 다시 [공유]' : ''}.` : `공유하지 못했습니다: ${r.message || r.error || ''}`, !r.ok || n < all); draw();
        });
      } else if (act === 'st-co-send' || act === 'st-co-send-chat' || act === 'st-co-resend') {   // 팀즈 MCP 로 창 없이(lib/teams-mcp.js — 백그라운드 collectSend)
        const req = coReq(prjNo, year, no); if (!req) return;
        const c = staffCtx(p, plan, year, state), ctx = collectCtx(state, p);
        const message = C().messageOf(req, { alias: ctx.alias, prjNm: ctx.prjNm, prjNo, from: c && c.per ? c.per.from : '', to: c && c.per ? c.per.to : '', who: '', template: ctx.template });
        const stats = act === 'st-co-resend' ? C().responseStats(req) : null;   // 다시 보내기 = 이메일은 있는데 회신이 없는 사람 모두(1:1)
        const names = act === 'st-co-send' ? [String((btn && btn.dataset && btn.dataset.name) || '')].filter(Boolean) : stats ? req.people.filter((x) => x.email && !stats[S.nameKeyOf(x.name)]).map((x) => x.name) : [];
        if (act !== 'st-co-send-chat' && !names.length) { setCoMsg(key, '보낼 사람이 없습니다 — 모두 회신했거나 이메일이 없습니다.', true); draw(); return; }
        const whom = names.join(', ');
        if (btn && !state.staffCollectBusy) { btn.disabled = true; btn.textContent = '보내는 중…'; }   // 누른 단추만 — 카드 전체를 다시 그리면 다른 줄의 단추도 꺼졌다 켜지며 깜박인다(2026-10-20 사용자 "한사람 보내기 하는데 왜 둘다 깜박이냐"). 끝나면 draw 가 되살림
        collectCall(prjNo, year, no, names.length ? { type: 'collectSend', names, message } : { type: 'collectSend', chat: true, message }, names.length ? `${whom} 에게 팀즈로 보내는 중…` : '채팅방에 보내는 중…', true).then((r) => {
          if (!r) return;
          setCoMsg(key, r.ok ? (names.length ? `${whom} 에게 팀즈로 보냈습니다.` : '채팅방에 보냈습니다.') : `보내지 못했습니다: ${r.message || r.error || ''}`, !r.ok); draw();
        });
      } else if (act === 'st-co-copy') {
        const req = coReq(prjNo, year, no); if (!req || !req.formUrl) return;
        const done = (ok) => { setCoMsg(key, ok ? '양식 주소를 복사했습니다.' : `복사하지 못했습니다 — ${req.formUrl}`, !ok); draw(); };
        try { navigator.clipboard.writeText(req.formUrl).then(() => done(true), () => done(false)); } catch (e) { done(false); }
      } else if (act === 'st-co-remove') {
        if (!arm(`co-remove:${key}`)) { draw(); return; }
        collectCall(prjNo, year, no, { type: 'collectRemove', recycle: true }, '요청을 지우는 중…').then((r) => { if (!r) return; if (r.ok) { delete state.staffCollect[key]; setCoMsg(key, `요청을 지웠습니다${r.recycled ? ' — 목록은 재활용통에' : r.warning ? ` — 목록은 남아 있습니다(${r.warning})` : ''}.`, false); } else setCoMsg(key, `지우지 못했습니다: ${r.message || r.error || ''}`, true); draw(); });
      } else if (act === 'st-co-apply') applyResponses(prjNo, year, no, [btn.dataset.id]);
      else if (act === 'st-co-apply-all') { const req = coReq(prjNo, year, no); if (req) applyResponses(prjNo, year, no, C().pending(req, collectCtx(state, p)).map((r) => r.id)); }
    }
    /* 응답 줄을 계획에 — 이 과제 줄을 체크 상자(coPickOf — 기간 · 참여율 · 월급여 · 연구수당)대로: 월급여(setManual + commit) · 남은 연구수당(person.allowance 참고 값, commit) · 참여율(응답 값 — 참여율을 끄고 기간만 켰으면 지금 월평균 참여율 — 을 **최대**(responseMax → S.maxRate: 예산 나머지 · 100% 규칙)로 자른 뒤
     * 적용일~종료일(responseRange — 기간을 켰으면 응답의 시작 달 1일~끝 달 마지막 날, 아니면 그 사람의 참여 기간 전체)에 viaForm — ✎ 폼과 같은 규칙: 잠긴 달 거부 등), 계획에 없는 사람은 더하기(viaForm 'new'). 다른 과제 줄은 반영 표시만(collectBook 이 100% 검사에 씀). 줄마다 결과 한 마디(잘랐으면 "참여율 25% → 최대 20% 로") */
    function applyResponses(prjNo, year, no, ids) {
      const req = coReq(prjNo, year, no); if (!req) return;
      const p = projectOf(prjNo), ctx = collectCtx(state, p), key = coKey(prjNo, year, no);
      const months = monthsOf(prjNo, year);
      const x = { budget: payOf(prjNo, year), months, lock: lockAt(prjNo, year) };   // responseMax 의 재료 — book 은 줄마다(앞 줄의 반영으로 계획이 바뀌므로)
      const out = []; let failed = false;
      for (const id of Array.isArray(ids) ? ids : []) {
        const r = req.responses.find((x) => String(x.id) === String(id)); if (!r) continue;
        if (!C().isThis(r.title, ctx)) { req.applied[r.id] = nowMs(); out.push(`${r.name}: 다른 과제(${r.title}) — 100% 검사에 씀`); continue; }
        try {
          if (!months.length) throw new Error('계획 기간(첫 달·마지막 달)을 먼저 정하세요.');
          const pk = coPickOf(r, (state.staffCollectPick || {})[`${key}:${r.id}`]);
          if (!pk.period && !pk.rate && !pk.monthly && !pk.allowance) throw new Error('반영할 것을 하나 이상 고르세요(기간 · 참여율 · 월급여 · 연구수당).');
          const plan = planOf(prjNo, year, true);
          let q = plan.people.find((x) => S.sameName(x.name, r.name));
          const range = responseRange(r, pk.period, q, months);
          const notes = [];
          let rate = pk.rate ? r.rate : (pk.period && q ? S.personStats(q, plan.basis).avgRate : null);
          if (rate != null) {   // 최대(예산 나머지 · 100% 규칙)를 넘으면 최대로 — 못 셈하면(월급여 없음 등) 그 말 그대로 실패
            const mx = responseMax(plan, r, Object.assign({ book: S.mergeOthers(collectBook(state, prjNo, year, p), plan) }, x), pk);
            if (rate > mx.rate) { notes.push(`참여율 ${rate}% → 최대 ${mx.rate}% 로`); rate = mx.rate; }
          }
          const manualTxt = pk.monthly ? String(Math.round(r.monthly / 1000)) : '';
          const fresh = () => planOf(prjNo, year).people.find((y) => S.sameName(y.name, r.name)) || null;
          if (q) {
            if (pk.monthly) { if (!commit(prjNo, year, q, S.setManual(q, plan.basis, manualTxt), '월급여(응답)')) throw new Error('월급여를 반영하지 못했습니다.'); q = fresh() || q; }
            if (pk.allowance) { if (!commit(prjNo, year, q, Object.assign({}, q, { allowance: Math.round(r.allowance / 1000) * 1000 }), '남은 연구수당(응답)')) throw new Error('남은 연구수당을 적지 못했습니다.'); q = fresh() || q; }
            if (rate != null) viaForm(prjNo, year, q.id, { from: range.from, to: range.to, mode: 'rate', value: String(rate) });
            else if (!pk.monthly && !pk.allowance) throw new Error(pk.period ? '기간만 골랐는데 이 사람의 지금 참여율이 없어 넣을 값이 없습니다 — 참여율을 같이 고르세요.' : '참여율도 월급여도 없는 줄입니다.');
          } else {
            if (rate == null) throw new Error(`${r.name} 은(는) 계획에 없고 참여율도 없어 더할 수 없습니다.`);
            viaForm(prjNo, year, 'new', { name: r.name, role: '참여연구원', manual: manualTxt, from: range.from, to: range.to, mode: 'rate', value: String(rate) });
            if (pk.allowance) { const nq = fresh(); if (nq) { const msg = state.staffMsg; commit(prjNo, year, nq, Object.assign({}, nq, { allowance: Math.round(r.allowance / 1000) * 1000 }), '남은 연구수당(응답)'); state.staffMsg = msg; } }   // 더한 메시지는 그대로 두고 참고 값만
          }
          req.applied[r.id] = nowMs();
          out.push(`${r.name}: ${(state.staffMsg && state.staffMsg.prjNo === prjNo && state.staffMsg.text) || '반영'}${notes.length ? ` (${notes.join(' · ')})` : ''}`);
        } catch (e) { failed = true; out.push(`${r.name}: 실패 — ${String((e && e.message) || e)}`); }
      }
      saveCollect(prjNo, year, req);
      setCoMsg(key, out.join(' / ') || '반영할 줄이 없습니다.', failed);
      draw();
    }
    /* 탭의 칸(이메일 · 팀즈 글) — 요청에 적고 저장. 이메일을 고치면 그 사람은 공유 전으로(다시 [공유]) + 이름 → 이메일 캐시 */
    function collectField(prjNo, year, no, k, el) {
      const req = coReq(prjNo, year, no); if (!req) return;
      const key = coKey(prjNo, year, no);
      if (k === 'message') { req.message = String(el.value || '').trim().slice(0, 1500); saveCollect(prjNo, year, req); draw(); return; }
      if (k === 'chat') {   // 기존 채팅방 링크/ID — 값은 그대로 두고 채팅 ID 를 못 찾으면 알림
        const v = String(el.value || '').trim().slice(0, 600), id = C().chatIdOf(v); req.chat = v;
        if (v && !id) setCoMsg(key, '채팅방 링크/ID 에서 채팅 ID(19:…@thread.v2)를 찾지 못했습니다 — Teams 에서 그 방의 메시지 › 기타 옵션 › 링크 복사', true);
        else if (v) setCoMsg(key, `기존 채팅방 ${id} — [채팅방에 보내기](팀즈 MCP) 또는 [채팅방 열기]`, false);
        saveCollect(prjNo, year, req); draw(); return;
      }
      if (k !== 'email') return;
      const name = String(el.dataset.name || ''), raw = String(el.value || '').trim(), em = C().email(raw);
      const x = req.people.find((y) => S.sameName(y.name, name)); if (!x) return;
      if (raw && !em) { setCoMsg(key, `${name} — 이메일 모양이 아닙니다: ${raw}`, true); draw(); return; }
      if (x.email !== em) { x.email = em; x.status = ''; x.error = ''; x.candidates = []; setCoMsg(key, em ? `${name} — 이메일을 적었습니다. [공유]를 누르면 그 이메일로 공유합니다.` : `${name} — 이메일을 비웠습니다.`, false); }
      saveCollect(prjNo, year, req);
      if (em) {   // 이름 → 이메일 캐시(peopleEmails — 읽어서 그 이름만 더함, 저장소 쓰기와 같은 꼴)
        try {
          const EK = C().EMAILS_KEY, r = chrome.storage.local.get(EK);
          const write = (l) => { const all = Object.assign({}, (l && l[EK] && typeof l[EK] === 'object') ? l[EK] : {}); all[S.nameKeyOf(name)] = em; return chrome.storage.local.set({ [EK]: all }); };
          if (r && r.then) r.then((l) => swallow(write(l)), () => swallow(write(null))); else swallow(write(null));
        } catch (e) {}
      }
      draw();
    }
    /* [팀즈로 보내기] 링크(a — 새 탭으로 Teams 딥 링크)를 누른 시각을 남긴다(data-cosent = 이름 · '*' 는 이메일 있는 모두). 기본 동작(이동)은 그대로 두고 다음 틱에 그린다 */
    host.addEventListener('click', (ev) => {
      const a = ev.target && typeof ev.target.closest === 'function' ? ev.target.closest('[data-cosent]') : null;
      if (!a || !a.dataset) return;
      const box = a.closest('[data-stprj]'); if (!box) return;
      const prjNo = box.dataset.stprj, year = Number(box.dataset.styr) || yearSel(prjNo);
      const req = coReq(prjNo, year, coNoOf(a)); if (!req) return;
      const who = String(a.dataset.cosent || '');
      const stats = who === '!' ? C().responseStats(req) : null;   // '!' = 회신 없는 사람(이메일 있는) — [안 온 사람에게 팀즈]
      for (const x of req.people) if ((who === '*' && x.email) || (stats && x.email && !stats[S.nameKeyOf(x.name)]) || S.sameName(x.name, who)) x.sentAt = nowMs();
      saveCollect(prjNo, year, req);
      setTimeout(draw, 0);
    });
    host.addEventListener('click', (ev) => {
      const menu = host.querySelector('details[data-stplan][open]');
      if (menu && menu.dataset.stplan && !menu.contains(ev.target)) {
        menu.open = false;
        (state.staffPlanOpen || (state.staffPlanOpen = {}))[menu.dataset.stplan] = false;
      }
      const btn = ev.target.closest('[data-act^="st-"]');
      if (!btn) return;
      ev.preventDefault();
      const act = btn.dataset.act, id = btn.dataset.id || '';
      if (act === 'st-page') { openPage(btn.dataset.page === PAGE); return; }   // 제목 줄 아이콘 · 화면의 돌아가기
      if (act === 'st-proj') {   // 과제 칩
        const prj = btn.dataset.prj; if (!prj) return;
        viewOf(state).prjNo = prj; closeForm(); saveView(); drawView('[data-act="st-proj"][aria-pressed="true"]'); setTimeout(ensureCurrent, 0);
        return;
      }
      const box = btn.closest('[data-stprj]');
      const prjNo = box ? box.dataset.stprj : '';
      if (!prjNo) return;
      const v = viewOf(state);
      if (act === 'st-year' || act === 'st-year-add') {   // 연차 칩 · ＋ 다음 연차
        const n = Number(btn.dataset.year);
        if (!(n >= 1) || n > S.YEAR_MAX) return;
        if (act === 'st-year-add') v.extra[prjNo] = n;
        v.years[prjNo] = n; if (state.staffFocus && state.staffFocus.prjNo === prjNo) state.staffFocus.year = n;   // 참여인력 변경 탭에서 연차를 바꾸면 그 연차를 기억
        closeForm(); saveView(); drawView(`[data-act="st-year"][data-year="${n}"]`);
        return;
      }
      if (act === 'st-fold') { const c = btn.dataset.card; v.fold[c] = openOf(v, c); saveView(); drawView(`[data-act="st-fold"][data-card="${c}"]`); return; }   // 펴져 있으면 접음(true), 접혀 있으면 폄(false)
      if (act === 'st-months') { v.months = !v.months; saveView(); drawView('[data-act="st-months"]'); return; }
      const year = Number(box.dataset.styr) || yearSel(prjNo);
      if (act === 'st-tab') { openTab(prjNo, year); return; }   // [참여연구원 변경] — 이 과제·연차의 참여인력만 브라우저 탭으로
      if (act === 'st-pick') {   // 달 칸 — 키보드(Enter·Space)나 Shift+누름(직전 고른 칸부터). 끌기는 pointerup 이 끝맺으므로 그 뒤에 오는 click 은 무시
        if (swallowClick) { swallowClick = false; return; }
        const ym = btn.dataset.ym; if (!ym) return;
        const e = state.staffEdit;
        const anchor = ev.shiftKey && e && e.prjNo === prjNo && e.year === year && e.id === id && e.anchor ? e.anchor : ym;
        openPick(prjNo, year, id, anchor < ym ? anchor : ym, anchor < ym ? ym : anchor, anchor);
        return;
      }
      if (act === 'st-pick-all') {   // 격자 왼쪽 [전체] — 그 사람의 전체 참여개월(지급이 있는 첫날 ~ 마지막 날, 없으면 기간 전체 · 지급이 끝난 달 뒤부터)로 ✎ 폼
        const plan = planOf(prjNo, year), q = plan && plan.people.find((x) => x.id === id);
        if (!q) return;
        const months = monthsOf(prjNo, year);
        if (!months.length) { setMsg(prjNo, year, '계획 기간(첫 달·마지막 달)을 먼저 정하세요.', true); draw(); return; }
        const lock = lockAt(prjNo, year), w = wholePick(q, months, lock);
        if (!w) { setMsg(prjNo, year, `${q.name} — ${S.ymText(lock)}까지 rERP 지급이 끝나 고를 달이 없습니다.`, true); draw(); return; }
        openPick(prjNo, year, id, w.lo, w.hi, w.lo, w);
        return;
      }
      if (act === 'st-alias') { const was = state.staffAliasEdit === prjNo; closeForm(); if (!was) { state.staffAliasEdit = prjNo; state.staffAliasDraft = null; } draw(); const el = host.querySelector('[data-stalias]'); if (el) { el.focus(); el.select(); } }
      else if (act === 'st-alias-cancel') { closeForm(); draw(); }
      else if (act === 'st-alias-set') setAlias(prjNo, state.staffAliasDraft == null ? aliasOf(state, prjNo) : state.staffAliasDraft);
      else if (act === 'st-refresh') fetchRows(prjNo, { manual: true });
      else if (act === 'st-init-erp') initFrom(prjNo, year, 'erp');
      else if (act === 'st-init-prev') initFrom(prjNo, year, 'prev');
      else if (act === 'st-init-carry') carryFrom(prjNo, year);
      else if (act === 'st-add' || act === 'st-edit') {
        const same = state.staffEdit && state.staffEdit.prjNo === prjNo && state.staffEdit.year === year && state.staffEdit.id === (act === 'st-add' ? 'new' : id);
        if (same) { closeForm(); draw(); return; }
        const months = monthsOf(prjNo, year);
        if (!months.length && act === 'st-edit') { setMsg(prjNo, year, '계획 기간(첫 달·마지막 달)을 먼저 정하세요.', true); draw(); return; }
        const last = state.staffLastRange && state.staffLastRange.key === S.planKey(prjNo, year) ? state.staffLastRange : null;   // 이 연차에서 직전에 반영한 변경·추가의 날짜
        const def = defaultRange(months, todayYm(), last, lockAt(prjNo, year));   // 지급이 끝난 달 뒤부터
        closeForm();
        state.staffEdit = { prjNo, year, id: act === 'st-add' ? 'new' : id };
        state.staffDraft = { name: '', role: '참여연구원', manual: '', from: def.from, to: def.to, mode: 'rate', value: '', supportRole: '', ref: true };   // 적용일·종료일 기본값은 defaultRange — 날은 폼에서 고친다
        draw();
        const el = host.querySelector(`[data-stf="${act === 'st-add' ? 'name' : 'value'}"]`); if (el) el.focus();
      }
      else if (act === 'st-cancel') { closeForm(); draw(); }
      else if (act === 'st-apply') applyForm(prjNo, year, id);
      else if (act === 'st-step') {   // 증감 줄의 칸 — 키보드(Enter·Space)·누름은 고르기만(반영은 반영 단추). 끌기는 pointerup 이 고르므로 그 뒤에 오는 click 은 무시
        if (swallowClick) { swallowClick = false; return; }
        stageStep(id, btn.dataset.kind, Number(btn.dataset.step));
      }
      else if (act === 'st-fit') { if (swallowClick) { swallowClick = false; return; } stageStep(id, 'fit', 1); }   // 증감 줄 맨 오른쪽 — 예산에 맞추기를 고름(반영을 누르면 S.fitBudget)
      else if (act === 'st-max') { if (swallowClick) { swallowClick = false; return; } stageStep(id, 'max', Number(btn.dataset.v)); }   // 예산에 맞추기와 균등 사이 — MAX(최대 참여율)를 고름(반영을 누르면 S.applyChange 'rate' 그 값)
      else if (act === 'st-even') { if (swallowClick) { swallowClick = false; return; } stageStep(id, 'even', 1); }   // 그 옆 — 균등을 고름(반영을 누르면 S.evenRange)
      else if (act === 'st-nudge') nudgeStep(id, btn.dataset.kind, Number(btn.dataset.dir));   // −1% · +1% — 고른 값을 1% 씩
      else if (act === 'st-sup-add') {   // 행정지원 사람 더하기 — 빈 줄을 내고 이름 칸에 초점(이름을 적으면 저장, Esc·× 로 거둠)
        if (supportOf(state, prjNo).people.length >= S.SUPPORT_MAX) { setMsg(prjNo, year, `행정지원은 과제마다 ${S.SUPPORT_MAX}명까지입니다.`, true); draw(); return; }
        closeForm(); state.staffSupportNew = { prjNo, name: '', role: '', ref: true }; draw();
        const el = host.querySelector('[data-sts="name"][data-i="new"]'); if (el) el.focus();
      }
      else if (act === 'st-sup-del') {
        if (btn.dataset.i === 'new') { state.staffSupportNew = null; draw(); return; }
        const i = Number(btn.dataset.i), cur = supportOf(state, prjNo);
        if (!(i >= 0) || i >= cur.people.length) return;
        const gone = cur.people[i];
        setSupport(prjNo, cur.people.filter((_, k) => k !== i), `${gone.name} 뺌`); draw();
      }
      else if (act === 'st-drop') {
        if (!arm(`drop:${prjNo}@${year}:${id}`)) { draw(); return; }
        const plan = planOf(prjNo, year); if (!plan) return;
        const q = plan.people.find((x) => x.id === id);
        const lock = lockAt(prjNo, year);   // 지급이 끝난 달에 지급이 있는 사람은 뺄 수 없다 — 그 뒤 달부터 제외(0%)로
        if (q && lock && q.plan.some((x) => x.ym <= lock && x.amt > 0)) { setMsg(prjNo, year, `${q.name} — ${S.ymText(lock)}까지 rERP 에서 지급된 사람은 뺄 수 없습니다. ✎ 적용일부터 제외(0%)로 하세요.`, true); draw(); return; }
        plan.people = plan.people.filter((x) => x.id !== id); touch(plan);
        if (state.staffEdit && state.staffEdit.id === id) closeForm();
        if (q) logChange(prjNo, year, '연구진', q.name, S.statsText(S.personStats(q, plan.basis)), '(뺌)');
        persist(); setMsg(prjNo, year, q ? `${q.name} 을(를) 뺐습니다.` : '', false); draw();
      }
      else if (act === 'st-clear') {
        if (!arm(`clear:${prjNo}@${year}`)) { draw(); return; }
        closeForm();
        const was = planSummary(planOf(prjNo, year));
        try { const r = S.remove(state.staffPlans, S.planKey(prjNo, year)); if (r && r.then) r.then(requestSync, () => {}); } catch (e) { delete state.staffPlans[S.planKey(prjNo, year)]; }   // 묘비를 남겨 공유 (Plus) 가 다른 사람의 사본도 지우게
        logChange(prjNo, year, '기타', `${S.yearLabel(year)} 계획`, was, '(지움)');
        setMsg(prjNo, year, `${S.yearLabel(year)} 계획을 지웠습니다.`, false); draw();
      }
      else if (act === 'st-share-sync' || act === 'st-share-people' || act === 'st-share-link' || act === 'st-share-copy') {   // 과제 카드 공유 줄 — 백그라운드에 맡기고 결과 한 줄
        if (state.staffShareBusy) return;
        const type = { 'st-share-sync': 'planSync', 'st-share-people': 'shareFolderPeople', 'st-share-link': 'shareOrgLink', 'st-share-copy': 'shareFolderCopy' }[act];
        state.staffShareBusy = prjNo; setShareMsg(prjNo, act === 'st-share-sync' ? '공유 폴더와 맞추는 중…' : act === 'st-share-people' ? '참여인력을 조회해 공유하는 중…' : act === 'st-share-link' ? '조직 내 링크를 만드는 중…' : '주소를 복사하는 중…', false); draw();
        (async () => {
          let r = null;
          try { r = await chrome.runtime.sendMessage(Object.assign({ type, prjNo }, act === 'st-share-sync' ? { reason: 'manual' } : {})); } catch (e) { r = { ok: false, error: String((e && e.message) || e) }; }
          state.staffShareBusy = null;
          if (!r) setShareMsg(prjNo, '응답이 없습니다', true);
          else if (r.skipped) setShareMsg(prjNo, `공유 꺼짐: ${(r.missing || []).join(' · ') || '설정을 확인하세요'}`, true);
          else if (act === 'st-share-sync') { const pg = r.pages && r.pages[prjNo]; setShareMsg(prjNo, pg && pg.error ? `공유 실패: ${pg.error}` : r.ok ? `${pg && pg.created ? '과제 폴더를 만들었습니다' : '맞췄습니다'}${pg && pg.pulled ? ' · 받음' : ''}${pg && pg.pushed ? ' · 씀' : ''}` : `공유 실패: ${r.error || r.message || ''}`, !!(pg && pg.error) || !r.ok); }
          else if (!r.ok) setShareMsg(prjNo, `실패: ${r.message || r.error || '응답 없음'}`, true);
          else if (act === 'st-share-people') setShareMsg(prjNo, r.message || '공유했습니다', false);
          else if (act === 'st-share-link') setShareMsg(prjNo, r.copied ? '조직 내 편집 링크를 복사했습니다' : `링크를 만들었지만 복사하지 못했습니다 · ${r.url || ''}`, !r.copied);
          else setShareMsg(prjNo, r.copied ? (r.what === 'project' ? '과제 폴더 주소를 복사했습니다 — 동료가 설정 › 공유 (Plus) 의 공유 폴더 칸에 붙여 넣으면 같은 파일을 씁니다' : '과제 폴더를 아직 몰라 공유 폴더(밑폴더) 주소를 복사했습니다') : `주소를 복사하지 못했습니다 · ${r.url || ''}`, !r.copied);
          draw();
        })();
      }
      else if (act.startsWith('st-co-')) collectAct(act, prjNo, year, btn);   // 자료 요청 구역(만들기 · 응답 받기 · 공유 · 링크 복사 · 지우기 · 반영)
      else if (act === 'st-copy' || act === 'st-bcopy') {
        const text = act === 'st-copy' ? rosterTsv(planOf(prjNo, year), state, prjNo, state.staffOnly === 'staff' ? null : erpViewOf(prjNo, year)) : budgetTsv(rowsOf(prjNo, year));
        const done = (ok) => { setMsg(prjNo, year, ok ? '표를 복사했습니다.' : '복사하지 못했습니다 — 패널을 한 번 누른 뒤 다시.', !ok); draw(); };
        try { navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); } catch (e) { done(false); }
      }
      else if (act === 'st-badd') {   // 비목 줄 더하기
        const plan = materialize(prjNo, year);
        if (plan.budget.length >= 30) { setMsg(prjNo, year, '비목은 30줄까지입니다.', true); draw(); return; }
        plan.budget.push({ name: '', plan: null }); touch(plan); persist(); draw();
        const el = host.querySelector(`[data-stb="name"][data-i="${plan.budget.length - 1}"]`); if (el) el.focus();
      }
      else if (act === 'st-bdel') {   // 비목 줄 빼기
        const plan = materialize(prjNo, year);
        const i = Number(btn.dataset.i);
        if (!(i >= 0) || i >= plan.budget.length) return;
        const row = plan.budget.splice(i, 1)[0];
        if (row.name || row.plan != null) logChange(prjNo, year, '예산', row.name || '비목', thousandText(row.plan), '(비목 뺌)');
        syncPay(plan); touch(plan); persist(); setMsg(prjNo, year, `${row.name || '비목'} 줄을 뺐습니다.`, false); draw();
      }
      else if (act === 'st-breset') {   // 직접 적은 예산 줄을 지우고 기본값으로
        if (!arm(`breset:${prjNo}@${year}`)) { draw(); return; }
        const plan = planOf(prjNo, year); if (!plan) return;
        const was = Array.isArray(plan.budget) ? S.budgetText(plan.budget) : '';
        plan.budget = null; plan.budgetPay = null; touch(plan); persist();
        logChange(prjNo, year, '예산', '예산 줄', was || '직접 적은 계획', '(기본값으로 — rERP 예산액·계획서)');
        setMsg(prjNo, year, '예산 줄을 기본값으로 되돌렸습니다.', false); draw();
      }
    });
    /* 별칭 정하기 — projectAliases[prjNo](비우면 지움)와 고친 시각 projectAliasesAt[prjNo] 을 저장(공유 (Plus) 병합이 새 쪽을 알게), 그리고 공유 요청 */
    function setAlias(prjNo, value) {
      const alias = String(value || '').trim().slice(0, 20);
      const was = aliasOf(state, prjNo);
      if (alias) state.staffAliases[prjNo] = alias; else delete state.staffAliases[prjNo];
      closeForm();
      if (alias !== was) logChange(prjNo, yearSel(prjNo), '기타', '별칭', was || '(없음)', alias || '(비움)');
      try {
        const r = chrome.storage.local.get(ALIAS_AT_KEY);
        const write = (l) => { const at = Object.assign({}, (l && l[ALIAS_AT_KEY]) || {}); at[prjNo] = nowMs(); return chrome.storage.local.set({ [ALIAS_KEY]: state.staffAliases, [ALIAS_AT_KEY]: at }); };
        if (r && r.then) r.then((l) => { const w = write(l); if (w && w.then) w.then(requestSync, () => {}); }, () => swallow(write(null)));
        else swallow(write(null));
      } catch (e) {}
      draw();
    }
    host.addEventListener('change', (ev) => {
      const el = ev.target;
      if (!el || !el.dataset) return;
      const box = el.closest('[data-stprj]');
      const prjNo = box ? box.dataset.stprj : '';
      if (!prjNo) return;
      const year = Number(box.dataset.styr) || yearSel(prjNo);
      if (el.dataset.stinc) { viewOf(state).inc[el.dataset.stinc] = !!el.checked; saveView(); draw(); return; }   // 집행에 더하기
      if (el.dataset.stp) { setPeriod(prjNo, year, el.dataset.stp, el.value); return; }
      if (el.dataset.stb) { setBudget(prjNo, year, Number(el.dataset.i), el.dataset.stb, el.value); return; }   // 예산 줄(비목 · 계획)
      if (el.dataset.stf) {
        const draft = state.staffDraft || (state.staffDraft = {});
        draft[el.dataset.stf] = el.dataset.stf === 'ref' ? !!el.checked : el.value;
        if (el.dataset.stf === 'role') { state.staffError = ''; drawView('[data-stf="role"]'); }
        else if (el.dataset.stf === 'mode') { draft.step = null; drawView('[data-stf="value"]'); }   // 구분을 바꾸면 증감 줄에서 고른 것은 거둠 · 나머지의 % 면 값 칸 옆에 안내
        return;
      }
      if (el.dataset.stcoAsk) {   // 자료 요청 만들기 전의 체크 상자(참여율 · 월급여 · 남은 연구수당) — 고른 것을 state 에 두고 다시 그림(하나도 없으면 만들기 단추 꺼짐)
        const box = el.closest('.krext-st-collect');
        if (box) { (state.staffCollectAsk || (state.staffCollectAsk = {}))[box.dataset.cokey] = Array.from(box.querySelectorAll('input[data-stco-ask]')).filter((x) => x.checked).map((x) => x.dataset.stcoAsk); draw(); }
        return;
      }
      if (el.dataset.stcoPick) {   // 응답 줄의 반영 항목 체크 상자(기간 · 참여율 · 월급여 · 연구수당) — 끈 것을 state 에 두고 다시 그림(참여율 칸의 "최대"가 기간·월급여에 따라 달라지므로)
        const m = state.staffCollectPick || (state.staffCollectPick = {}), pkKey = `${el.dataset.cokey}:${el.dataset.id}`;
        (m[pkKey] || (m[pkKey] = {}))[el.dataset.stcoPick] = !!el.checked; draw();
        return;
      }
      if (el.dataset.stco) { collectField(prjNo, year, coNoOf(el), el.dataset.stco, el); return; }   // 자료 요청 구역의 칸(이메일 · 팀즈 글)
      if (el.dataset.sts) {   // 행정지원 구역의 줄(이름 · 맡은 일 · 공문 참조). 이름을 비우면 뺀다. data-i="new" 는 더하기의 빈 줄 — 이름을 적으면 저장
        const cur = supportOf(state, prjNo), k = el.dataset.sts;
        const dup = (name, skip) => cur.people.some((p, idx) => idx !== skip && S.sameName(p.name, name)) || Object.values(S.plansOfProject(state.staffPlans, prjNo)).some((p) => p.people.some((q) => S.sameName(q.name, name)));
        if (el.dataset.i === 'new') {
          const nd = state.staffSupportNew && state.staffSupportNew.prjNo === prjNo ? state.staffSupportNew : (state.staffSupportNew = { prjNo, name: '', role: '', ref: true });
          if (k === 'role') { nd.role = el.value; return; }
          if (k === 'ref') { nd.ref = !!el.checked; return; }
          const name = String(el.value || '').trim();
          if (!name) return;
          if (dup(name, -1)) { setMsg(prjNo, year, '같은 이름이 이미 있습니다.', true); draw(); return; }
          if (cur.people.length >= S.SUPPORT_MAX) { setMsg(prjNo, year, `행정지원은 과제마다 ${S.SUPPORT_MAX}명까지입니다.`, true); draw(); return; }
          state.staffSupportNew = null;
          setSupport(prjNo, cur.people.concat([{ name, role: String(nd.role || '').trim(), ref: nd.ref !== false }]), `${name} 더함`);
          draw(); return;
        }
        const i = Number(el.dataset.i);
        const people = cur.people.map((p) => Object.assign({}, p));
        if (!(i >= 0) || i >= people.length) return;
        if (k === 'name' && String(el.value || '').trim() && dup(el.value, i)) { setMsg(prjNo, year, '같은 이름이 이미 있습니다.', true); draw(); return; }
        if (k === 'name') { if (!String(el.value || '').trim()) people.splice(i, 1); else people[i].name = el.value; }
        else if (k === 'role') people[i].role = el.value;
        else if (k === 'ref') people[i].ref = !!el.checked;
        setSupport(prjNo, people, k === 'name' && !String(el.value || '').trim() ? `${cur.people[i].name} 뺌` : { name: '이름', role: '맡은 일', ref: '공문 참조' }[k]);
        draw();
        return;
      }
      const k = el.dataset.stc;
      if (!k) return;
      const plan = planOf(prjNo, year);
      const q = plan && plan.people.find((x) => x.id === el.dataset.id);
      if (!q) return;
      if (k === 'role') {
        const role = String(el.value || '').trim().slice(0, 40), before = q.role || '';
        if (role === before) return;
        q.role = role; touch(plan); persist();
        logChange(prjNo, year, '연구진', `${q.name} 역할`, before || '(없음)', role || '(없음)');
        setMsg(prjNo, year, `${q.name} — 역할을 ${role || '(없음)'}(으)로 변경했습니다.`, false); draw();
        return;
      }
      try {
        const months = monthsOf(prjNo, year);
        const runs = S.personStats(q, plan.basis).runs;
        const run = el.dataset.r != null && runs.length > 1 ? runs[Number(el.dataset.r)] || null : null;   // 기간 구간이 둘 이상이면 그 줄의 구간에만
        const range = run ? { from: run.from, to: run.to } : null;
        const lock = lockAt(prjNo, year);   // rERP 지급이 끝난 달은 그대로 두고 그 뒤 달만
        const next = k === 'monthly' ? S.setManual(q, plan.basis, el.value) : k === 'total' ? S.setTotal(q, S.thousandOf(el.value), months, range, { lock }) : k === 'rate' ? S.setRate(q, plan.basis, el.value, months, range, { lock }) : null;
        if (next) commit(prjNo, year, q, next, `${{ monthly: '월급여', total: '계상인건비', rate: '참여율' }[k]}${run ? ` ${S.spanText(run.from, run.to)}` : ''}`);
      } catch (e) { setMsg(prjNo, year, String((e && e.message) || e), true); draw(); }
    });
    host.addEventListener('toggle', (ev) => {
      const el = ev.target;
      if (!el || !el.dataset || !host.contains(el)) return;
      if (el.dataset.stcoPanel) {
        const box = el.closest('[data-cokey]');
        if (box) (state.staffCollectOpen || (state.staffCollectOpen = {}))[`${box.dataset.cokey}:${el.dataset.stcoPanel}`] = el.open;
        return;
      }
      if (el.dataset.stplan) {
        (state.staffPlanOpen || (state.staffPlanOpen = {}))[el.dataset.stplan] = el.open;
        return;
      }
      if (!el.dataset.streason) return;
      const reasons = viewOf(state).reasons, id = el.dataset.streason;
      if (!!reasons[id] === el.open) return;
      if (el.open) reasons[id] = true; else delete reasons[id];
      saveView();
    }, true);
    host.addEventListener('input', (ev) => {
      const el = ev.target; if (!el || !el.dataset) return;
      if (el.dataset.stf) {
        (state.staffDraft || (state.staffDraft = {}))[el.dataset.stf] = el.dataset.stf === 'ref' ? !!el.checked : el.value;
        if (el.dataset.stf === 'from' || el.dataset.stf === 'to') { paintDraft(); paintQuick(); }   // 날짜를 고치면 격자의 고른 달·증감 줄(나머지 · 고른 것의 미리보기)도 따라감(다시 그리지 않고 — 날짜 칸의 입력 자리를 지키려고)
        else if (el.dataset.stf === 'value' && state.staffDraft.step) { state.staffDraft.step = null; paintQuick(); }   // 값을 적으면 증감 줄에서 고른 것은 거둠(구분·값으로 반영)
      }
      else if ('stalias' in el.dataset) state.staffAliasDraft = el.value;
    });
    /* 달 칸 고르기(참여연구원 변경 탭 — 2026-10-19 사용자, 회의실 현황 스크린샷 "2번째처럼 해줘. 드래그해서 선택할 수 있게"): 달마다의 지급 격자의 달 칸(data-act="st-pick")을 누르거나 끌어 같은 사람의 이어지는 달들을 고르면
     * 그 사람의 ✎ 폼이 적용일 = 첫 달 1일 · 종료일 = 마지막 달 마지막 날로 열린다(구분·값은 폼에서, 달 중간의 날은 폼의 날짜 칸으로). 끄는 동안은 DOM 의 칸에 krext-st-picked 만 붙였다 떼고 놓을 때 상태를 바꿔 다시 그린다.
     * 포인터를 잡아(setPointerCapture) 칸 밖에서 놓아도 끝맺고 손가락(터치)도 같은 길 — 칸 밑의 요소는 elementFromPoint 로 찾는다(잡은 뒤의 ev.target 은 처음 칸이므로). 다른 사람의 칸으로 나가면 늘어나지 않는다. 취소(pointercancel)면 표시만 거둔다 */
    let drag = null, swallowClick = false;
    const cellOf = (el) => (el && typeof el.closest === 'function' ? el.closest('[data-act="st-pick"]') : null);
    const pointAt = (ev) => {   // 손가락 밑 요소(포인터를 잡은 뒤의 ev.target 은 처음 요소이므로)
      const root = typeof host.getRootNode === 'function' ? host.getRootNode() : null;
      const doc = root && typeof root.elementFromPoint === 'function' ? root : host.ownerDocument && typeof host.ownerDocument.elementFromPoint === 'function' ? host.ownerDocument : null;
      return doc ? doc.elementFromPoint(ev.clientX, ev.clientY) : ev.target;
    };
    const cellAt = (ev) => cellOf(pointAt(ev));
    /* 증감 줄 끌기(2026-10-19 사용자, 회의실 현황 스크린샷 "기준 금액에서 증액, 감소를 10% 간격으로 증가감소 드래그로 선택" → 폼 스크린샷 "드래그로 선택하고 나면 반영 누를 때까지 기다려") — 칸(data-step)을 누르거나 끌면 기준(0)부터 손가락 밑 칸까지 krext-st-step-on,
     * 읽기 줄(.krext-st-step-pv)에 그 칸의 미리보기(data-preview). 놓으면 그 칸의 값을 **고르기만**(stageStep → draft.step; 반영은 반영 단추 — applyForm). 기준 칸에서 놓으면 고른 것을 거둠, pointercancel 은 고른 것 그대로. 끌지 않을 때는 칸에 올린 것의 미리보기만 */
    let step = null, hoverPv = null;
    const stepOf = (el) => (el && typeof el.closest === 'function' ? el.closest('[data-step]') : null);
    /* 칸 표시 — 기준(0)부터 v 까지(같은 부호) krext-st-step-on, 읽기 줄은 그 칸의 미리보기(v 가 0 이거나 칸이 없으면 data-default) */
    const markSteps = (cells, pv, v, lead = '') => {
      for (const c of cells) { const k = Number(c.dataset.step) || 0; c.classList.toggle('krext-st-step-on', !!v && !!k && !c.disabled && (v > 0 ? k > 0 && k <= v : k < 0 && k >= v)); }
      if (!pv) return;
      const hit = v ? cells.find((c) => Number(c.dataset.step) === v) : null;
      pv.textContent = hit && hit.dataset.preview ? lead + hit.dataset.preview : pv.dataset.default || '';
    };
    const paintStep = () => { if (step) markSteps(step.cells, step.pv, Number(step.cur.dataset.step) || 0); };
    const hoverPreview = (ev) => {
      const c = ev.target && typeof ev.target.closest === 'function' ? ev.target.closest('.krext-st-quick [data-preview]') : null;
      const quick = c ? c.closest('.krext-st-quick') : null;
      const pv = quick && typeof quick.querySelector === 'function' ? quick.querySelector('.krext-st-step-pv') : null;
      if (hoverPv && hoverPv !== pv) { hoverPv.textContent = hoverPv.dataset.default || ''; hoverPv = null; }
      if (pv) { pv.textContent = c.dataset.preview || pv.dataset.default || ''; hoverPv = pv; }
    };
    /* 증감 줄에서 고르기 — draft.step = { kind('scale' 기준에서 ±v% · 'share' 나머지의 v% · 'fit' 예산에 맞추기), v }. v 가 0 이면 거둠. 반영은 반영 단추(applyForm 이 draft.step 을 먼저 본다). 열린 폼의 사람(id)이 아니면 무시 */
    function stageStep(id, kind, v) {
      const e = state.staffEdit;
      if (!e || e.id !== id) return;
      const dr = state.staffDraft || (state.staffDraft = {});
      dr.step = v ? { kind, v } : null;
      state.staffError = '';
      paintQuick();
    }
    /* −1% · +1% — 고른 값을 1% 씩(scale: 기준에서 −100 ~ +1000, share: 나머지의 0 ~ 100). 고른 것이 없거나 다른 종류면 0 에서 시작, 0 이 되면 거둠 */
    function nudgeStep(id, kind, dir) {
      const dr = state.staffDraft || {};
      const cur = dr.step && dr.step.kind === kind ? Number(dr.step.v) || 0 : 0;
      const v = kind === 'share' ? Math.max(0, Math.min(100, cur + dir)) : Math.max(-100, Math.min(1000, cur + dir));
      stageStep(id, kind, v);
    }
    const span = (a, b) => (a <= b ? [a, b] : [b, a]);
    const paint = () => { if (!drag) return; const [lo, hi] = span(drag.a, drag.b); for (const c of drag.cells) c.classList.toggle('krext-st-picked', c.dataset.ym >= lo && c.dataset.ym <= hi); };
    function paintDraft() {   // 폼의 적용일·종료일 → 그 사람의 칸 표시
      const e = state.staffEdit;
      if (!e || typeof host.querySelectorAll !== 'function') return;
      const months = monthsOf(e.prjNo, e.year), pk = pickOf(state.staffDraft, months), r = draftRange(state.staffDraft, months);
      for (const c of host.querySelectorAll('[data-act="st-pick"]')) c.classList.toggle('krext-st-picked', !!pk && c.dataset.id === e.id && c.dataset.ym >= pk.from && c.dataset.ym <= pk.to);
      for (const c of host.querySelectorAll('[data-act="st-pick-all"]')) {   // [전체] — 폼의 날짜가 그 사람의 전체 참여개월과 같을 때만 눌린 꼴
        if (!c.dataset || c.dataset.act !== 'st-pick-all') continue;
        const on = !!r && c.dataset.id === e.id && r.from === c.dataset.from && r.to === c.dataset.to;
        c.classList.toggle('krext-st-picked', on);
        if (typeof c.setAttribute === 'function') c.setAttribute('aria-pressed', String(on));
      }
    }
    function paintQuick() {   // 폼 아래 증감 줄(quickRow)만 지금의 적용일~종료일·고른 것으로 다시 그리고, 반영 단추에 고른 값을 붙인다(폼 전체를 다시 그리지 않고 — 날짜 칸의 입력 자리를 지키려고)
      const e = state.staffEdit;
      if (!e || typeof host.querySelector !== 'function') return;
      const btn = host.querySelector('[data-act="st-apply"]');
      if (btn && typeof btn.textContent === 'string') btn.textContent = `${e.id === 'new' ? '인력추가' : '반영'}${stepLabel(state.staffDraft && state.staffDraft.step)}`;
      const el = host.querySelector('.krext-st-quick');
      if (!el || typeof el.outerHTML !== 'string') return;
      const staff = staffOf(planOf(e.prjNo, e.year)) || { basis: 'rerp', people: [] };
      const q = e.id === 'new' ? null : staff.people.find((x) => x.id === e.id) || null;
      el.outerHTML = quickRow(q, monthsOf(e.prjNo, e.year), state.staffDraft || {}, { budget: payOf(e.prjNo, e.year), staff, lock: lockAt(e.prjNo, e.year), book: S.mergeOthers(collectBook(state, e.prjNo, e.year, projectOf(e.prjNo)), staff) });
    }
    /* 고른 달들로 ✎ 폼 열기 — 같은 사람의 폼이 이미 열려 있으면 구분·값은 두고 날짜만 바꾼다. anchor 는 Shift+누름의 시작 칸 */
    function openPick(prjNo, year, id, lo, hi, anchor, exact = null) {   // exact { from, to('YYYY-MM-DD') } — [전체] 처럼 달 중간의 날까지 정해 연다(그 달들 안일 때만)
      const months = monthsOf(prjNo, year);
      if (!months.length) { setMsg(prjNo, year, '계획 기간(첫 달·마지막 달)을 먼저 정하세요.', true); draw(); return; }
      const lock = lockAt(prjNo, year);   // 지급이 끝난 달은 고를 수 없다(그 칸은 단추가 아니지만 Shift+누름의 시작점이 될 수 있다)
      if (lock && hi <= lock) { setMsg(prjNo, year, `${S.ymText(lock)}까지는 rERP 지급이 끝나 고를 수 없습니다.`, true); draw(); return; }
      if (lock && lo <= lock) lo = S.addMonths(lock, 1);
      const e = state.staffEdit;
      const keep = e && e.prjNo === prjNo && e.year === year && e.id === id && state.staffDraft ? state.staffDraft : null;
      closeForm();
      state.staffEdit = { prjNo, year, id, anchor };
      const from = exact && exact.from && exact.from.slice(0, 7) === lo ? exact.from : S.monthStart(lo);
      const to = exact && exact.to && exact.to.slice(0, 7) === hi ? exact.to : S.monthEnd(hi);
      state.staffDraft = Object.assign({ name: '', role: '참여연구원', manual: '', mode: 'rate', value: '', supportRole: '', ref: true }, keep || {}, { from, to });
      draw();
      const el = host.querySelector('[data-stf="value"]'); if (el) el.focus({ preventScroll: true });
    }
    host.addEventListener('pointerdown', (ev) => {
      if (ev.button > 0) return;
      const sc = stepOf(ev.target);
      if (sc) {   // 증감 줄의 칸
        const strip = sc.closest('.krext-st-steps'), box = sc.closest('[data-stprj]');
        if (sc.disabled || !strip || !box) return;
        const quick = strip.closest('.krext-st-quick');
        step = { pointerId: ev.pointerId, cells: typeof strip.querySelectorAll === 'function' ? [...strip.querySelectorAll('[data-step]')] : [sc], cur: sc, pv: quick && typeof quick.querySelector === 'function' ? quick.querySelector('.krext-st-step-pv') : null,
          prjNo: box.dataset.stprj, year: Number(box.dataset.styr) || yearSel(box.dataset.stprj), id: strip.dataset.id, kind: strip.dataset.kind };
        try { sc.setPointerCapture(ev.pointerId); } catch (e) {}
        paintStep();
        if (ev.preventDefault) ev.preventDefault();   // 글자 선택 없이
        return;
      }
      const cell = cellOf(ev.target); if (!cell) return;
      const box = cell.closest('[data-stprj]'); if (!box) return;
      const id = cell.dataset.id, ym = cell.dataset.ym;
      const scope = cell.closest('tbody') || box;
      const cells = typeof scope.querySelectorAll === 'function' ? [...scope.querySelectorAll('[data-act="st-pick"]')].filter((c) => c.dataset.id === id) : [cell];
      drag = { pointerId: ev.pointerId, prjNo: box.dataset.stprj, year: Number(box.dataset.styr) || yearSel(box.dataset.stprj), id, a: ym, b: ym, cells };
      try { cell.setPointerCapture(ev.pointerId); } catch (e) {}
      paint();
      if (ev.preventDefault) ev.preventDefault();   // 글자 선택·초점 이동 없이
    });
    host.addEventListener('pointermove', (ev) => {
      if (step) {
        if (ev.pointerId !== step.pointerId) return;
        const c = stepOf(pointAt(ev));
        if (c && c !== step.cur && !c.disabled && step.cells.includes(c)) { step.cur = c; paintStep(); }
        return;
      }
      if (!drag) { hoverPreview(ev); return; }
      if (ev.pointerId !== drag.pointerId) return;
      const cell = cellAt(ev);
      if (!cell || cell.dataset.id !== drag.id || cell.dataset.ym === drag.b) return;
      drag.b = cell.dataset.ym; paint();
    });
    const endDrag = (ev, ok) => {
      if (step) {   // 증감 줄 — 놓은 칸의 값을 고른다(기준 칸이면 거둠). 반영은 반영 단추
        if (ev && ev.pointerId != null && ev.pointerId !== step.pointerId) return;
        const s = step; step = null;
        const v = Number(s.cur.dataset.step) || 0;
        // 놓은(pointerup) 뒤의 click 은 늘 무시 — 포인터를 잡은 칸(처음 누른 칸)으로 오므로, 기준에서 놓아 거둬도 그 칸이 다시 골라지면 안 된다(pointercancel 뒤에는 click 이 오지 않음)
        if (ok) { swallowClick = true; setTimeout(() => { swallowClick = false; }, 0); stageStep(s.id, s.kind, v); }
        const cur = state.staffDraft && state.staffDraft.step && state.staffDraft.step.kind === s.kind ? Number(state.staffDraft.step.v) || 0 : 0;   // 표시를 고른 것으로(paintQuick 이 다시 그리지 못하는 때도)
        markSteps(s.cells, s.pv, cur, '반영을 누르면 — ');
        return;
      }
      if (!drag || (ev && ev.pointerId != null && ev.pointerId !== drag.pointerId)) return;
      const d = drag; drag = null;
      if (!ok) { for (const c of d.cells) c.classList.remove('krext-st-picked'); return; }
      const [lo, hi] = span(d.a, d.b);
      swallowClick = true; setTimeout(() => { swallowClick = false; }, 0);   // 놓은 뒤의 click 은 무시(다시 그린 뒤 떨어져 나간 칸에서 옴)
      openPick(d.prjNo, d.year, d.id, lo, hi, d.a);
    };
    host.addEventListener('pointerup', (ev) => endDrag(ev, true));
    host.addEventListener('pointercancel', (ev) => endDrag(ev, false));
    host.addEventListener('keydown', (ev) => {
      const el = ev.target; if (!el || !el.dataset) return;
      if (ev.key === 'Escape') {
        const menu = el.closest('details[data-stplan]');
        if (menu && menu.dataset.stplan && menu.open) {
          ev.preventDefault(); menu.open = false;
          (state.staffPlanOpen || (state.staffPlanOpen = {}))[menu.dataset.stplan] = false;
          menu.querySelector('summary').focus();
          return;
        }
      }
      const box = el.closest('[data-stprj]'); if (!box) return;
      if ('stalias' in el.dataset) {
        if (ev.key === 'Enter') { ev.preventDefault(); setAlias(box.dataset.stprj, el.value); }
        else if (ev.key === 'Escape') { ev.preventDefault(); closeForm(); draw(); }
        return;
      }
      if (el.dataset.stb && ev.key === 'Enter') { ev.preventDefault(); el.blur(); return; }   // 예산 칸: Enter 로 반영(change)
      if ((el.dataset.stco === 'email' || el.dataset.stco === 'chat') && ev.key === 'Enter') { ev.preventDefault(); el.blur(); return; }   // 자료 요청의 이메일 칸: Enter 로 반영(change)
      if (el.dataset.sts) {   // 행정지원 칸: Enter 로 반영(change), 더하기의 빈 줄은 Esc 로 거둠
        if (ev.key === 'Enter') { ev.preventDefault(); el.blur(); }
        else if (ev.key === 'Escape' && el.dataset.i === 'new') { ev.preventDefault(); state.staffSupportNew = null; draw(); }
        return;
      }
      if (el.dataset.act === 'st-pick') { if (ev.key === 'Escape' && state.staffEdit) { ev.preventDefault(); closeForm(); draw(); } return; }   // 달 칸: Esc 로 고른 것·폼 거둠 (Enter·Space 는 click)
      if (!el.dataset.stf) return;
      if (ev.key === 'Enter') { ev.preventDefault(); if (state.staffEdit) applyForm(box.dataset.stprj, Number(box.dataset.styr) || yearSel(box.dataset.stprj), state.staffEdit.id); }
      else if (ev.key === 'Escape') { ev.preventDefault(); closeForm(); draw(); }
    });
    // 다른 창(팝업 ↔ eClass)·백그라운드 공유가 바꾼 계획·별칭·공유 결과 반영
    try {
      chrome.storage.onChanged.addListener((ch, area) => {
        try {
          if (area !== 'local') return;
          if (ch[S.KEY]) { state.staffPlans = S.normalizePlans(ch[S.KEY].newValue); draw(); }
          if (ch[ALIAS_KEY]) { state.staffAliases = (ch[ALIAS_KEY].newValue && typeof ch[ALIAS_KEY].newValue === 'object') ? ch[ALIAS_KEY].newValue : {}; draw(); }   // 여기서 고친 것 · 공유 파일에서 받은 것 (background.js shareSync)
          if (ch.staffSyncState) { state.staffSync = ch.staffSyncState.newValue || null; draw(); }   // 공유 (Plus) 결과 (background.js shareSync — shareState 와 같은 내용)
          if (ch[CHANGES_KEY]) { const v = ch[CHANGES_KEY].newValue; state.staffChanges = v && typeof v === 'object' ? v : {}; draw(); }   // 여기서 남긴 것 · 연차 파일에서 받은 것(WORKSPACE 쪽 포함)
          if (ch[SUPPORT_KEY]) { const v = ch[SUPPORT_KEY].newValue; state.staffSupport = v && typeof v === 'object' ? v : {}; draw(); }   // 행정지원 — 여기서 고친 것 · 연차 파일에서 받은 것(WORKSPACE 가 고친 것)
          if (ch[COLLECT_KEY]) { const v = ch[COLLECT_KEY].newValue; state.staffCollect = v && typeof v === 'object' ? v : {}; if (!state.staffCollectBusy) draw(); }   // 진행 중(collectCall)이면 끝났을 때 한 번만 — 중간에 그리면 단추가 모두 꺼졌다 켜지며 깜박임
          if (ch.teamsStatus) { state.teamsStatus = ch.teamsStatus.newValue || null; draw(); }   // 팀즈 MCP 연결 상태(lib/teams-mcp.js probe)   // 자료 요청 — 백그라운드(collect*)가 저장한 결과 · 다른 탭
        } catch (e) {}
      });
    } catch (e) {}
    /* ---------- 변경 도우미(채팅 — popup/staff-chat.js, 0.8.8): 보고 있는 과제·연차 · 계획 요약 · 작업 반영 ---------- */
    const current = () => { const p = projOf(projects(), state); return p ? { prjNo: p.prjNo, year: yearOf(p, state), p } : null; };
    /* 계획 요약(lib/staff-chat-core.js clean 의 snapshot 모양 — 천원·%): Claude 가 요청을 작업으로 옮길 때 보는 전부. 보고 있는 과제가 없으면 null */
    function snapshot() {
      const c = current(); if (!c) return null;
      const { p, prjNo, year } = c;
      const plan = planOf(prjNo, year), staff = staffOf(plan);
      const per = periodOf(p, plan, year), months = S.ymRange(per.from, per.to);
      const budget = payOf(prjNo, year);
      const cache = cacheOf(prjNo);
      const erpPeople = cache && cache.rows ? S.peopleOfErp(cache.rows, { prjNo, now: cache.at, months: months.length ? months : null }) : null;
      const k = (n) => Math.round(n / 1000);
      const names = staff ? staff.people.map((q) => q.name) : [];
      const inPlan = (q) => names.some((n) => S.sameName(n, q.name));
      const erpLine = (q) => { const s = S.personStats(q, 'rerp'); return `${q.name} (${q.role || '역할 모름'}) — 월급여 ${S.thousand(s.limit)}천원 · rERP 등록 ${S.monthlyText(q.plan)}${s.rate != null ? ` · ${S.rateText(s.rate)}` : ''}`; };
      const erpCmp = (q) => { const mine = staff.people.find((x) => S.sameName(x.name, q.name)); return `${q.name} — rERP 등록 ${S.monthlyText(q.plan)}${mine && S.sameMonthly(q.plan, mine.plan) ? ' · 계획과 같음' : ' · 계획과 다름'}`; };
      const total = staff ? S.staffTotal(staff, staff.basis) : null;
      const bd = S.budgetDiff(staff ? { total, budget } : null);
      const last = state.staffLastRange && state.staffLastRange.key === S.planKey(prjNo, year) ? state.staffLastRange : null;
      const support = supportOf(state, prjNo).people;
      const paid = paidOf(plan, cache, year === S.anlOf(p));
      return {
        prjNo, alias: aliasOf(state, prjNo), prjNm: p.prjNm || '', year, from: per.from, to: per.to, months: months.length, today: ymdDash(nowMs()), lock: S.lockOf(paid),
        budgetPay: budget == null ? null : k(budget), total: total == null ? null : k(total), diff: bd.text, basis: staff ? staff.basis : 'rerp',
        names, people: staff ? S.staffLines(staff, staff.basis, { budgetPay: budget }).slice(1).map((l) => l.replace(/^- /, '')) : [],
        support: S.supportText(support), supportNames: support.map((x) => x.name),
        erp: { at: cache && cache.at ? erpClock(cache.at) : '', lines: erpPeople && staff ? erpPeople.people.filter(inPlan).map(erpCmp) : [], missing: erpPeople ? erpPeople.people.filter((q) => !inPlan(q)).map(erpLine) : [] },
        warnings: staff ? S.checks(staff, staff.basis, { others: S.mergeOthers(collectBook(state, prjNo, year, p), staff), budgetPay: budget, paid, erp: erpPeople }).map((w) => w.text) : [],
        defaultRange: defaultRange(months, todayYm(), last), years: yearsOf(p, state.staffPlans, state), hasPlan: !!staff,
        erpState: !cache ? 'rERP 참여인력 조회 전 (init 은 조회한 뒤에 됨)' : cache.loading ? '조회 중' : cache.error ? `조회 실패: ${cache.error}` : '',
        collect: (() => { const C_ = C(); return C_ ? reqsOf(state, prjNo, year).flatMap((req) => C_.summaryLines(req, collectCtx(state, p))) : []; })(),   // 자료 요청 응답 줄(참고 — 반영은 사용자가 탭에서)
      };
    }
    const FORM = { name: '', role: '참여연구원', manual: '', from: '', to: '', mode: 'rate', value: '', supportRole: '', ref: true };
    /* ✎·＋ 폼의 처리(applyForm)를 폼 값 d 로 — 잠금·나머지의 %·예산 맞추기(how 'fit' → 증감 줄에서 고른 것 draft.step 과 같은 길) 규칙을 그대로 탄다. 실패는 state.staffError 에 남으므로 그것을 오류로 */
    function viaForm(prjNo, year, id, d, how = '') {
      state.staffError = ''; state.staffEdit = { prjNo, year, id }; state.staffDraft = Object.assign({}, FORM, d, how === 'fit' ? { step: { kind: 'fit', v: 1 } } : {});
      applyForm(prjNo, year, id);
      const err = state.staffError;
      if (err) { closeForm(); draw(); throw new Error(err); }
    }
    /* 적용일이 없는 change — 그 사람의 지급이 있는 전체 기간(없으면 계획 기간) */
    const initAsync = async (prjNo, year, how) => {   // rERP 조회가 아직이면 먼저 받고 초기화 — 초기화의 거부(기간 없음·등록 없음·잠금)는 메시지의 error 로 안다. carry(이전 차년도에서 가져오기)는 앞 연차 계획이 있으면 조회 없이
      if (how === 'carry' && !(year > 1)) throw new Error('1차년도에는 가져올 앞 연차가 없습니다.');
      let c = cacheOf(prjNo);
      const need = how !== 'carry' || !carrySource(projectOf(prjNo), year, state);
      if (need && (!c || !c.rows)) { await fetchRows(prjNo); c = cacheOf(prjNo); }
      if (need && (!c || !c.rows)) throw new Error((c && c.error) || 'rERP 참여인력을 받지 못했습니다.');
      if (how === 'carry') { if (!carryFrom(prjNo, year, { sure: true })) throw new Error((state.staffMsg && state.staffMsg.text) || '가져오지 못했습니다.'); return; }   // 초과금의 빨간 메시지는 실패가 아님
      initFrom(prjNo, year, how);
      const m = state.staffMsg;
      if (m && m.error && m.prjNo === prjNo && m.year === year) throw new Error(m.text);
    };
    /* 작업 하나 → 화면 메시지 글(실패면 throw). 과제·연차는 보고 있는 것(year 작업이 바꾸면 그다음 작업부터) */
    async function runOp(prjNo, year, op) {
      const plan = planOf(prjNo, year);
      const months = monthsOf(prjNo, year);
      const person = (name) => { const q = plan && plan.people.find((x) => S.sameName(x.name, name)); if (!q) throw new Error(`${name} 이(가) ${S.yearLabel(year)} 계획에 없습니다.`); return q; };
      const msgOf = () => { const m = state.staffMsg; return m && m.prjNo === prjNo && m.year === year ? m.text : ''; };
      const done = (ok) => { if (!ok) throw new Error('반영하지 못했습니다.'); return msgOf(); };
      const won = (v) => String(Math.round(Number(v) || 0));   // 천원 글 — 폼의 값·월급여 칸과 같은 모양
      switch (op.op) {
        case 'change': { const q = person(op.name); const r = op.from ? { from: op.from, to: op.to } : wholeOf(q, months); const m = op.mode || 'rate'; viaForm(prjNo, year, q.id, { from: r.from, to: r.to, mode: m === 'fit' ? 'rate' : m, value: m === 'amt' ? won(op.value) : op.value }, m === 'fit' ? 'fit' : ''); return msgOf(); }
        case 'total': { const q = person(op.name); const range = op.from ? { from: S.dateOf(op.from, 'start'), to: op.to ? S.dateOf(op.to, 'end') : (months.length ? S.monthEnd(months[months.length - 1]) : '') } : null; return done(commit(prjNo, year, q, S.setTotal(q, Math.round(Number(op.value) || 0) * 1000, months, range, { lock: lockAt(prjNo, year) }), `계상인건비${range ? ` ${S.spanText(range.from, range.to)}` : ''}`)); }
        case 'monthly': { const q = person(op.name); return done(commit(prjNo, year, q, S.setManual(q, plan.basis, op.value > 0 ? op.value : ''), '월급여')); }
        case 'role': {   // 역할 선택과 같은 처리 — 지급은 그대로
          const q = person(op.name), role = String(op.role || '').trim().slice(0, 40), before = q.role || '';
          if (role === before) return `${q.name} — 역할이 이미 ${S.roleShort(role)} 입니다.`;
          q.role = role; touch(plan); persist();
          logChange(prjNo, year, '연구진', `${q.name} 역할`, before || '(없음)', role || '(없음)');
          setMsg(prjNo, year, `${q.name} — 역할을 ${role || '(없음)'}(으)로 변경했습니다.`, false); draw(); return msgOf();
        }
        case 'remove': {   // × 두 번과 같은 처리 — 잠긴 달에 지급이 있는 사람은 뺄 수 없다
          const q = person(op.name), lock = lockAt(prjNo, year);
          if (lock && q.plan.some((x) => x.ym <= lock && x.amt > 0)) throw new Error(`${q.name} — ${S.ymText(lock)}까지 rERP 에서 지급된 사람은 뺄 수 없습니다. 그 뒤 달부터 제외(0%)로 하세요.`);
          plan.people = plan.people.filter((x) => x.id !== q.id); touch(plan);
          if (state.staffEdit && state.staffEdit.id === q.id) closeForm();
          logChange(prjNo, year, '연구진', q.name, S.statsText(S.personStats(q, plan.basis)), '(뺌)');
          persist(); setMsg(prjNo, year, `${q.name} 을(를) 뺐습니다.`, false); draw(); return msgOf();
        }
        case 'add': { const m = op.mode || 'rate'; viaForm(prjNo, year, 'new', { name: op.newName, role: op.role || '참여연구원', manual: op.monthly > 0 ? won(op.monthly) : '', from: op.from, to: op.to, mode: m === 'fit' ? 'rate' : m, value: m === 'amt' ? won(op.value) : op.value, supportRole: op.supportRole || '', ref: op.ref !== false }); return msgOf(); }
        case 'init': await initAsync(prjNo, year, op.how === 'prev' || op.how === 'carry' ? op.how : 'erp'); return msgOf();
        case 'clear': {   // 지우기 두 번과 같은 처리
          if (!plan) throw new Error(`${S.yearLabel(year)} 계획이 없습니다.`);
          closeForm();
          const was = planSummary(plan);
          try { const r = S.remove(state.staffPlans, S.planKey(prjNo, year)); if (r && r.then) r.then(requestSync, () => {}); } catch (e) { delete state.staffPlans[S.planKey(prjNo, year)]; }
          logChange(prjNo, year, '기타', `${S.yearLabel(year)} 계획`, was, '(지움)');
          setMsg(prjNo, year, `${S.yearLabel(year)} 계획을 지웠습니다.`, false); draw(); return msgOf();
        }
        case 'year': { const v = viewOf(state); const n = Number(op.year); if (!(n >= 1) || n > S.YEAR_MAX) throw new Error('연차가 잘못됐습니다.'); const have = yearsOf(projectOf(prjNo), state.staffPlans, state); if (n > have[have.length - 1]) v.extra[prjNo] = n; v.years[prjNo] = n; if (state.staffFocus && state.staffFocus.prjNo === prjNo) state.staffFocus.year = n; closeForm(); saveView(); draw(); return `${S.yearLabel(n)} 로 옮겼습니다.`; }
        case 'period': { if (op.from) setPeriod(prjNo, year, 'from', op.from); if (op.to) setPeriod(prjNo, year, 'to', op.to); return `${S.yearLabel(year)} 계획 기간 ${spanText(periodOf(projectOf(prjNo), planOf(prjNo, year), year))}.`; }
        case 'budget': { const pl = materialize(prjNo, year); let i = pl.budget.findIndex((r) => S.isPayItem(r.name)); if (i < 0) { pl.budget.push({ name: '인건비', plan: null }); i = pl.budget.length - 1; } setBudget(prjNo, year, i, 'plan', won(op.value)); const bd = diffOf(planOf(prjNo, year)); return `인건비 예산 ${S.thousand(payOf(prjNo, year))}천원${bd.text ? ` · ${bd.text}` : ''}.`; }
        case 'support_add': viaForm(prjNo, year, 'new', { name: op.newName, role: '행정지원', supportRole: op.supportRole || '', ref: op.ref !== false }); return msgOf();
        case 'support_remove': { const cur = supportOf(state, prjNo); const i = cur.people.findIndex((x) => S.sameName(x.name, op.name)); if (i < 0) throw new Error(`${op.name} 이(가) 행정지원에 없습니다.`); setSupport(prjNo, cur.people.filter((_, j) => j !== i), `${cur.people[i].name} 뺌`); draw(); return msgOf(); }
        default: throw new Error(`모르는 작업입니다: ${op.op}`);
      }
    }
    /* 작업 목록을 차례대로 — 작업마다 { ok, text(한 줄 — lib/staff-chat-core.js opText), msg(화면 메시지 또는 오류) }. 하나가 실패해도 다음 작업은 계속 */
    async function apply(ops) {
      const C = g.KRX_STAFF_CHAT_CORE;
      const out = [];
      for (const op of Array.isArray(ops) ? ops : []) {
        const text = C ? C.opText(op) : String((op && op.op) || '');
        const c = current();
        if (!c) { out.push({ ok: false, text, msg: '보고 있는 과제가 없습니다.' }); continue; }
        try { out.push({ ok: true, text, msg: await runOp(c.prjNo, c.year, op) }); }
        catch (e) { const msg = String((e && e.message) || e); out.push({ ok: false, text, msg }); setMsg(c.prjNo, c.year, msg, true); }
      }
      draw();
      return out;
    }
    return { fetchRows, initFrom, commit, applyForm, openPage, focus, openTab, setBudget, setAlias, logChange, agent: { current, snapshot, apply } };
  }

  Object.assign(api, { PAGE, VIEW_KEY, ALIAS_KEY, ALIAS_AT_KEY, CHANGES_KEY, CHANGES_MAX, CHANGE_KINDS, SUPPORT_KEY, COLLECT_KEY, collectSection, collectBook, collectNames, reqOf, section, bind, aliasOf, periodOf, erpBudgetPay, budgetOf, budgetRows, budgetTsv, yearOf, yearsOf, projOf, adopt, yearState, shortName,
    changeEntry, appendChanges, changesOf, newestFirst, openOf, supportOf, rosterTsv, defaultRange, monthGrid, pickOf, wholePick, carrySource, paidOf, payApprOf });
  g.KRX_STAFF_UI = api;
})(typeof self !== 'undefined' ? self : this);
