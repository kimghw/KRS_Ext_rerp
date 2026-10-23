/* 연구수당 계산 (2026-10-21 사용자 "참여연구원 변경 옆에 연구수당 계산 페이지를 하나 만들어줘. 그리고 첨부된 지침에 따라 계산 페이지를 만들어줘" · "최종적으로는 HWPX 양식에 맞게 계산서를 출력해줘야해" → 같은 날 "hwpx 아니고 docx 로 출력해줘").
 * 근거: references/10-53_국가연구개발과제_연구수당지급기준_20240305.md(10-53, 2024-03-05 시행 — 원본 hwpx 는 DRM 이라 사용자 캡처를 옮겨 적은 것). 처음(같은 날 오전)에는 지침을 못 본 채 "참여율 × 개월 비례 · 1인 70%" 가정으로 만들었다가 지침을 받고 별지 1·2 흐름으로 다시 만들었다.
 * 순수 계산(compute) + 저장(load/save — storage.local.allowCalc["과제번호@연차"]) + 연구수당 계산 탭(popup.html#…&only=allow — lib/staff-ui.js section 이 card 를 부름)의 카드(card)·입력 처리(bind) + Word 문서 모형(docOf → lib/docx.js build).
 * 연구수당 도우미(2026-10-21 사용자 "연구수당도, 참여연구원 과 같은 동일한 에이전트를 넣어줘. 참고하는 프롬프트만 달리해서. 여기에는 연구수당 지침을 넣어줘라"): 탭 제목 줄의 [에이전트]가 여는 채팅은 참여연구원 변경 탭의 변경 도우미와 같은 popup/staff-chat.js(allow 모드)이고,
 *   bind() 가 돌려주는 agent { current, snapshot, apply } 가 보고 있는 과제·연차의 계산 요약(일반 정보 · 사람마다 부서·직급·참여율·성과 항목·기타·합산기여도·등급·지급비율·지급액·한도 · 등급 몫 · 부서별 자리 · 알림)을 만들고, Claude 가 돌려준 작업(lib/allow-chat-core.js — pool·avail·org·person·item_add·item_del·merge·adjust·bydept·auto)을
 *   표의 칸·끌어 놓기와 같은 길(저장 항목 entry 를 고치고 persist → compute)로 차례대로 반영한다. 참여연구원을 더하거나 참여율을 바꾸는 작업은 없다(참여연구원 변경 탭의 몫).
 * popup.html 에만 싣는다(패널 카드는 [연구수당 계산 ↗] 단추만 — lib/staff-ui.js actsOf → openTab(prjNo, year, 'allow')). Node 테스트: node tests/allowance.test.js
 *
 * 지침의 흐름(제4·5·6조, 별지 1·2):
 *  - 대상(제4조) = 참여연구원 계획의 연구책임자·연구자(계획이 아직 없으면 이 기간의 rERP 등록 지급계획 — KRX_STAFF_UI.staffCtx 의 erpPeople, 참여인력 카드·참여연구원 변경 탭이 보이는 것과 같음; staffFor — 2026-10-23 사용자 "참여연구원이 보이질 않아 참여연구원 변경 및 연구수당 모두"). 역할에 "행정"이 든 사람(연구지원)은 뺀다. 참여율 0 인 사람과 미지급(out)으로 표시한 사람은 별지 2 에 사유만 적고 지급하지 않는다.
 *  - 재원(제5조) = 연구수당 계상금액(연차 예산 줄의 연구수당 — 직접 적을 수 있음) · 집행 가능액(기본 계상금액 − 집행, 직접 적을 수 있음). 지급액은 집행 가능액 × 지급비율.
 *  - 별지 1 합산기여도 = a×0.3 + b×0.6 + c×0.1 — a 참여율 환산비율(참여율 ÷ 참여율 합 × 100), b 성과 기여율(사람의 기여도 합 ÷ 전체 합 × 100, 기여도 = 등급 점수(가 50 · 나 30 · 다 10) × 건수 × 가중치), c 기타 환산비율(우수 100 · 양호 75 · 보통 50 · 미흡 25 ÷ 합 × 100). 각 열의 계는 100.
 *  - 평가등급(별지 1 주석 5·5-1) = 합산기여도 내림차순으로 참여 연구원 수별 인원 배분표(HEADCOUNT — S 10% · A 20% · B 40% · C 20% · D 10%)대로 S/A/B/C/D. 5명 이상이면 S+A · C+D 통합 가능(merge). 동점이면 상위등급(그 사람 몫은 하위등급 1인 비율을 상위등급 몫에 합쳐 N분).
 *  - 지급비율(별지 2 배분기준) = 참여 연구원 수별 등급 몫 표(PAY_SHARE — 등급 전체의 %) ÷ 그 등급 인원. 책임자가 등급간 ±10%p 제로섬 조정(adjust), 등급별 최소 3%, 하위등급 1인 지급액 ≤ 상위등급 1인 지급액(어기면 알림만).
 *  - 상한(제6조④, 표 2) = 당해연도 개인 연구수당 총액 ≤ 기본연봉 × 직급 비율(P1 18 · P2 20 · P3 22 · P4 24 · G/C 22%). 남은 연구수당(자료 요청 응답 person.allowance · 내 HR 잔여)을 알면 넘을 때 알림만 — 초과분은 예산변경·반납(재배분 규정 없음).
 *  - 자동 배당 규칙·−/+·[자동 배정](2026-10-21 사용자 "이거 자동 배정 안되네 … 숫자는 넣어도 되지만 클릭으로 증감할 수 있게" → "s,a,b,c,d 등 똑같이 수로 배당 하고 남은 것들은 차례대로, 부서이동하면서 … 한 부서는 6개가 남고 다른 부서는 2개가 남았다면 랜덤으로 하되 평균이 비슷하도록 … 그룹단위로.. 그룹이 없을땐 각 부서가 그룹") = apportion 은 단위(그룹 — 그룹 없는 부서는 저 혼자)마다 묶음의 기준 인원을 똑같이 나누고(단위 사람 수 넘지 않게) 나머지는 한 자리씩 받은 자리 ÷ 사람 수가 가장 낮은 단위(사람이 많이 남은 쪽 — 평균이 비슷하게)에, 같으면 지난번 받은 다음 단위부터 차례로. 난수는 안 쓴다(다시 그릴 때마다 같아야). 사용자가 자리를 줄여 자리가 없는 사람은 place 의 fallback 으로 과제 전체 자동 등급(p.auto)에 두어 자리와 배정이 달라 ! 가 뜨고, 자리 표의 −/+(al-slot) 또는 칸으로 더한다(열 합 < 기준이면 "남은 자리" 알림). [자동 배정](al-slots-auto)은 고친 자리·확정·끌어 놓은 등급을 모두 지운다(그 전에는 고친 칸만 지우고 칸이 없으면 꺼져 있어 "자동 배정 안되네").
 *  - 여럿 끌기(2026-10-21 사용자 "등급배정에서 1개 이상 드래그로 옮길 수 있게 해줘") = 칩을 누르면 골라지고(state.allowSel[key] = [id…] — 탭 동안만, krext-al-chip-sel), 고른 칩을 끌면 이 판에 보이는 고른 칩 모두가 같이(text/plain 에 id 를 쉼표로), 놓으면 모두 setRank 하고 고름을 푼다. 안 고른 칩을 끌면 그것만.
 *  - 부서 그룹(2026-10-21 사용자 "부서별 매칭에서 그룹 기능도 추가 해줘. 부서를 드래그 하면 병합하고, split 도 되고") = 저장 unions[[부서명, …], …]. compute 는 계획의 부서들을 unitsOf 로 단위(그룹 또는 부서 하나)로 묶어 depts 로 삼는다 — name(key) 는 이름을 '|' 로 이은 것(저장 depts[key] 의 자리·확정 · 탭 data-d · 자리 표 data-unit), names · title(이름을 ' + ' 로) · label(약칭을 '+' 로). [부서별 배정] 자리 표의 부서 이름 칸(data-unitdrag)을 끌어 다른 줄에 놓으면 mergeUnions(겹치던 그룹 흡수, 옛 단위의 자리·확정은 버림), 그룹 줄의 [분리](al-split)가 splitUnion. 별지의 부서명(p.dept)은 그대로.
 *  - 부서별 재조정 알림(2026-10-21 사용자 "부서별 등급배정 시... 배정 내용을 변경할 수 있도록 해주고... 재종이 필요한 경우 부서별 배정 탭에 느낌표 같은 알람 표시를 해줘") = 등급 배정 판(부서 탭)의 열 머리 `배정/자리` 의 자리 수가 칸(data-alq — 자리 표의 data-als 와 같은 저장 depts[부서].slots)이라 그 자리에서 고치고, compute 가 부서마다 actual(묶음별 실제 배정 수)·fit(자리와 다른 묶음)·rowBad(줄 합 ≠ 사람 수)와 res.deptAlert{ cols(열 합 ≠ 기준인 묶음), depts(자리≠배정 또는 줄 합이 틀린 부서) } 를 두면 [부서별 배정] 탭 단추·부서 칩에 빨간 !(krext-al-alert) 과 자리 표 칸의 "배정 n", 알림 줄.
 *  - 잔여 한도 열·↓ 가능(2026-10-21 사용자 "여기도 참여연구원 변경 처럼 팀즈로 조사하고 연구수당 한도를 각 연구원 지급 금액에 할당해 주고, 금액상 등급을 낮춰도 각 연구원의 한도를 다 채울 수 있는지 알람? … 화살표 아래로.. 가능.. 이런식이라던지") = 지급 내역 표의 **잔여 한도** 열에 사람의 cap(응답 · HR)과 여유(cap − 지급액)/초과(지급액 − cap)를 두고, 초과면 지금 등급 아래 묶음 가운데 기준 1인 지급액(집행 가능액 × perHead0)이 한도 이상인 **가장 낮은** 묶음을 down(↓ B 가능)으로 — 그 등급으로 낮춰도 그 사람은 한도를 다 채우니 초과분을 다른 사람에게 돌릴 수 있다는 표시(옮긴 뒤의 N분·넘침 재배분은 안 셈하는 어림 — 옮기면 표가 다시 셈함). 알림(checks)에도 같은 말 + 초과분 합·여유 있는 사람. 한도를 모르는 사람은 카드 아래 **자료 요청**(lib/staff-ui.js collectSection — 참여연구원 변경 탭과 같은 양식·팀즈·응답, 이 탭은 잔여 연구수당만 기본으로 묻고 반영도 연구수당만 기본 — opts.tail)으로 팀즈에 묻는다.
 *  - 부서명·직급 기본값(2026-10-21 사용자 "연구수당 계산에서 부서명, 직급 이런거 갖어 올 수 있지 않냐?") = 탭을 열 때 이 과제의 rERP 참여인력(ensureErp → background allowMembers → lib/rnd-api.js fetchMembers = rcomm_0029_01_r001 의 BLNG_DEPT_NM · POS_NM; 참여인력에 아직 없는 계획 사람은 인적정보 검색 searchPerson)을 이름으로 맞춰 채운다(erpMapOf — "(사)한국선급 " 머리 뗌, state.allowErp[prjNo] — 이 탭 동안만, 저장 없음). 칸에 적으면 그 값, 비우면 다시 rERP 값. 내 직급은 rERP 에 없을 때 HR 급여.
 *  - 등급 칸(2026-10-21 사용자 "지급 내역을 먼저 작성하고 평가내용을 작성하도록 할게 … 지급내역 바로 아래 SABCD/ 1,2,3,4,5로 할게. 할당해야할 갯수를 인원 배분 기준으로 할당해 주고. 평가 등급을 마우스 드래그로 할 수 있게 해줘") = 탭의 차례는 일반 정보 → 지급 내역(별지 2) → 평가 내용(별지 1)이고(문서 차례는 그대로 별지 1 → 2), 지급 내역 표 바로 아래 등급 열(1 S · 2 A · … · 5 D, 통합이면 묶음)마다 인원 배분 기준(n/기준)과 몫을 보이고 이름 칩을 끌어 다른 등급에 놓으면 그 사람의 수동 등급(rank)이 된다 — 처음 한 번 같은 범위 모두의 현재 등급을 적어 두어 다른 사람은 그대로. 줄의 평가등급 칸(select)도 같은 길. 기준보다 많은 등급은 넘친 사람마다 빈자리가 있는 가장 가까운 아래(없으면 위) 등급의 1인 몫을 가져와 N분(동점 규칙을 그대로 넓힘). [자동] 이 되돌린다.
 *  - 부서별(같은 날 "부서 별로 그룹핑 할 수 있게 하고, 각 부서별로 인원을 배분 하고 부서간의 등급 인원 조율 할 수 있도록 하고 .. 부서별로 할때는 탭으로 해서 옆으로 해라. ... 어느부서는 하고 어느 부서는 안할 수 있으니. 부서별로 확정할 수 있게 하고") = byDept 를 켜면 부서(별지 1 의 부서명 — rERP 참여인력 기본값)마다 탭을 옆으로 두고, 등급 자리(slots)는 [부서별 배정] 탭의 표에서 조율한다(기본 = 자동 배당 apportion — 묶음마다 위 등급부터 인원 배분 기준을 부서의 남은 사람 수에 비례해 큰 나머지 순으로, 나머지가 같으면 그 자리를 받을 다음 사람의 합산기여도가 큰 부서. 같은 날 저녁 사용자 "부서별로 하면 부서별로 s,a,b .. 을 몇개 갖어갈지 자동 배당을 해주는 기능이 있어야지" — 그 전에는 과제 전체 합산기여도 순 배정에서 그 부서가 받은 수였음. 열 합은 인원 배분 기준, 줄 합은 부서 사람 수여야 하며 어긋나면 알림, [자동 배당] 단추가 고친 칸을 지워 되돌림). 부서 안에서는 그 자리대로 합산기여도 순(자동)이거나 끌어 놓은 수동이고, [확정] 은 그 부서 사람 모두의 현재 등급을 적어 잠근다(안 한 부서는 자동 그대로). 지급 몫은 부서와 상관없이 과제 전체 등급 표(같은 등급은 N분). 탭 이름은 shortDepts — 앞 2글자, 겹치면 3글자, 그래도 겹치면 숫자("수소전기추진.. 이런건 수소, 자율이면 자율 까지만 표기하고 동일한게 있으면 3글자 까지 하고 그뒤로는 숫자로 하자").
 *  - 평가항목 고르기·필수 항목·연구내용 항목(2026-10-21 사용자 "평가항목에 대해서 사용자가 선택할 수 있는 옵션을 제공하고 … 연구내용 사전조사, 진도보고서 작성은 필수로 넣어주고 다른 항목은 옵션으로 … 연구개발 보고서의 차년도 상위 연구 항목들에 대해서도 가등급 또는 나등급으로 선택할 수 있도록 … 에이전트가 연결된 경우만 … 분류는 가 또는 나 또는 다의 평가항목들을 보고 판단") = 사람마다 ＋ 항목 추가 **선택 상자**(data-aladd — 지침 1) 의 가·나·다 묶음 옵션, 값 "등급|이름", 기타는 묶음마다 이름이 비어 새 줄의 이름 칸에 초점)로 넣는다.
 *    **포함 항목**(같은 날 밤 사용자 "필수로 지정한 건 선택된 상태로 두고 클릭하면 비활성화 다시 클릭하면 활성화(포함) … 에이전트로 연구내용에서 평가 항목 추출하면 활성화로 기본 추출하고 다시 클릭하면 비활성화 … 연구내용 건은 대부분 all 이 기본이고, 그룹을 할당할 수 있게 … 그 그룹은 이 항목을 넣을 수 있게") = [평가항목 목록] 상자의 칩(al-pick — pickList): REQUIRED(연구총괄 및 관리 가 · 진도보고서 작성 다 · 연구내용 사전조사 다 — 2026-10-22 부터 3개, 그 전엔 연구계획서·최종보고서까지 5개) 와 분류된 연구내용 항목은 기본 켜짐, 다른 목록 항목은 기본 꺼짐, 누르면 토글(entry.pick[이름] = true|false, 분류 전 연구내용은 못 켬).
 *    켜진 항목은 autoItemsOf 가 연구자(행정 제외)마다 저절로 넣고(auto: true — 이름·건수 1·가중치 1/N(받는 지급 대상 수) readonly, 등급 disabled, × 대신 "필수"/"포함") 저장하지 않는다 — 그룹(entry.groups[{ name, people[id], items[이름] }], 상자 아래 [＋ 그룹] · 사람 칩 · 항목 칩)에 든 항목은 그 그룹들 사람에게만, 아니면 모두에게. inputOf 의 mergeItems 가 표 줄 = 포함 항목 + 저장 항목(같은 이름은 뺌 — 옛 저장의 필수 줄도)이라 칸·× 의 data-k 는 그 결과 기준이고 handler(autoOf · stored)는 포함 수만큼 뺀다. 도우미 item_add·item_del 은 포함 항목이면 거절.
 *    그 연차 연구개발계획서(lib/research.js, state.research)의 연구내용 상위 항목(rec.contents[].item)은 [평가항목 목록] 의 연구내용 칸 칩으로 나오고(분류 전은 못 켬), 연구수당 도우미(KRX_STAFF_CHAT.route())가 연결돼 있을 때 별지 1 제목 줄의 [연구내용 분류](al-classify)가 채팅을 열어 CLASSIFY_ASK 를 보내면 Claude 가 research 작업(value 항목 · level)으로 등급을 매겨 entry.research[항목] = 등급 에 저장 → 그 칩이 기본 포함(모든 연구자에게)되고 칩 옆 등급 칸(data-alrl)으로 바꿀 수 있다; 포함을 끈 분류 항목만 ＋ 항목 추가의 연구내용 묶음에서 사람마다 고른다. 연결이 바뀌면 popup/staff-chat.js render 가 H.draw() 로 카드를 다시 그린다.
 *    checks 는 논문·특허·실용신안·의장을 뺀 같은 이름 항목의 참여연구원간 가중치 합이 1 이 아니면 warn(제6조②).
 *  - 등급별 자동 분해(2026-10-21 사용자 "S부터 1,2,3,4,5 등급이 있는데 1등급에는 연구총괄, 연구계획서, 연구수행 내용(사용자), 2등급에는 설계,해석, 검증, ..지침서등 연구수행 내용(사용자), 3등급은 제어기술, 기준/절차/가이드/알고리즘, 연구수행 내용(사용자) 4,5 등급은 선택된 나의 기준절차, 연구내용 사전조사, 진도보고서 작성등으로 자동 분해 할 수 있게 해줘.. 가중치랑 등급등을 참조하고 최대 3개 까지.. 4,5등급은 하나만 하면 되겠지" — AIP 세션에서 인계) = 별지 1 제목 줄 [등급별 자동 분해](al-decompose) 가 decompose(res, entry) 로 대상 사람마다 지금 평가등급(묶음 첫 키 S~D)의 TEMPLATE 항목을 넣는다(있는 항목은 그대로, 필수 밖 항목이 AUTO_MAX 3개를 넘지 않게).
 *    "연구수행 내용(사용자)" 은 자동으로 짓지 않고 사용자가 ＋ 항목 추가의 연구내용 묶음에서 고르는 세 번째 자리로 둔다(가정 — 사용자 확인 전). 필수(포함된 항목)는 중복 추가하지 않고 4·5등급은 기준/절차/가이드라인/지침서(나) 하나. 필수 포함을 껐거나 그룹 대상 밖인 사람에게는 해당 등급의 TEMPLATE 항목을 개인 항목으로 넣을 수 있다. TEMPLATE·REQUIRED 이름 항목의 가중치는 그 항목을 가진 대상 수로 1/N(제6조②), 그 밖(논문·특허·연구내용·직접 적은 것)은 손대지 않는다. 등급은 합산기여도로 다시 셈하므로 넣은 뒤 등급이 바뀔 수 있다(수동 등급은 그대로).
 *  - 평가항목 목록 편집(2026-10-21 사용자 "평가항목 리스트 … 웹에서 내가 조정할려고 하는데 버튼이 안보임"; 같은 날 밤부터 textarea 대신 칩) = 3. 평가 내용 첫머리의 접히는 [평가항목 목록] 상자(data-al-disclosure itemlist) — 가·나·다·연구내용 칸의 칩(위 포함 항목), 칸 아래 입력(data-alnew — change 에 그 등급 목록에 더하고 비움)과 목록 칩의 ×(al-pick-del — 필수·연구내용은 없음)가 entry.items { 가[], 나[], 다[] } 를 고치고(parseItems — 다듬기·중복 제거·묶음당 40개), [지침 기본값](al-items-default) 이 지움(포함·그룹은 그대로). ＋ 항목 드롭다운은 이 목록(itemsOf — 없으면 ITEMS)에서 그 사람에게 포함되지 않은 항목 + 기타 + 포함을 끈 분류된 연구내용; 등급 템플릿은 이름으로 넣으므로 목록과 무관하며 사람에게 이미 넣은 항목도 그대로. 과제·연차별(지침 1) "평가항목(점수배분)은 연구책임자가 연구특성에 따라 추가할 수 있음").
 *  - 설명 문단 없음(2026-10-21 밤 사용자 "접어줘. 기본적인 설명은 필요 없음, 필요한 경우 아이콘으로 지침 내용을 알려줘") = 2·3 절 제목 · [평가항목 목록] 의 필수 항목·선택 항목·연구내용·적용 그룹 머리 · [등급 통합·비율 조정] 요약 줄의 ⓘ(info — title 툴팁)가 별지 1·2 지침과 조작법(끌기·여럿 고르기·자리 조율)을 보이고, 등급 배정·부서별 배정·지급 내역 판의 안내 문단과 그룹 없음 안내는 없다. [등급 통합·비율 조정]은 기본 접힘(요약 줄에 지금 켜진 통합·조정, 펼침은 ui.settings).
 * 저장(storage.local.allowCalc[key]) = { pool(원), avail(원), org(연구기관명), items{ 가[], 나[], 다[] }(평가항목 목록 — 고친 경우만), pick{ [항목 이름]: true|false }(포함 토글), groups[{ name, people[id], items[이름] }](포함 항목을 받을 사람 그룹), merge{ sa, cd }, adjust{ S, A, B, C, D }(%p), byDept, depts{ [부서명]: { slots{ [묶음 key 'S'|'S+A'|…]: n }, done } }, people{ [id]: { dept, grade, etc(100|75|50|25), items[{ name, level('가'|'나'|'다'), count, weight }], note, out, rank('S'~'D' — 수동 등급) } }, research{ [연구내용 항목]: '가'|'나'|'다' }, at }. 이 브라우저만(공유·변경이력 없음). 탭에서 고른 부서는 state.allowDept[key], 2 절의 탭([등급 배정] · byDept 면 [부서별 배정] · [지급 내역] — 같은 날 저녁 사용자 "지급내역. 부서별 배정, 부서별 참여자 등급은... 탭으로 하자. 너무 길어질거 같아" · "중요한게. 등급 배정이 1" 이라 기본은 등급 배정)은 state.allowUi[key].tab(저장 없음). */
(function (g) {
  const KEY = 'allowCalc';
  const F = g.KRX_FMT, S = g.KRX_STAFF;
  const esc = (v) => (F ? F.esc(v) : String(v == null ? '' : v));
  const num = (v) => { if (v === '' || v == null) return null; const n = Number(typeof v === 'string' ? v.replace(/[,\s%]/g, '') : v); return Number.isFinite(n) ? n : null; };
  const won = (v) => { const n = num(v); return n != null && n >= 0 ? Math.round(n) : null; };
  const text = (v, max = 80) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
  const isAdmin = (role) => /행정/.test(String(role || ''));
  let redraw = null;   // bind 의 draw — ensureErp 가 rERP 참여인력을 받으면 다시 그린다
  /* 백그라운드 allowMembers 가 준 목록 → { [이름키]: { dept, pos } }. 같은 이름이 둘이면 먼저 온 사람. 참여인력의 소속 부서는 "(사)한국선급 수소전기추진연구팀" 꼴이라 기관 머리를 뗀다(별지 1 의 부서명 — 연구기관명은 따로 있음) */
  const erpMapOf = (members) => { const out = {}; for (const m of Array.isArray(members) ? members : []) { const k = S.nameKeyOf(m && m.name); if (k && !out[k]) out[k] = { dept: text(String((m && m.dept) || '').replace(/^\(사\)\s*한국선급\s*/, ''), 40), pos: text(m && m.pos, 20) }; } return out; };
  /* 이 과제의 rERP 참여인력(소속 부서·직급)을 한 번 받아 state.allowErp[prjNo] = { at, busy, members(erpMapOf), error } 에 둔다(이 탭 동안만 — 탭을 다시 열면 다시 받음). names = 계획 사람 이름들 — 참여인력에 없는 사람은 백그라운드가 인적정보 검색으로 보탠다. 테스트(chrome 없음)에서는 건너뜀 */
  function ensureErp(state, prjNo, names) {
    if (!prjNo || typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) return;
    const all = state.allowErp = state.allowErp || {};
    if (all[prjNo]) return;
    all[prjNo] = { at: Date.now(), busy: true, members: {}, error: '' };
    const done = (r) => {
      const cur = all[prjNo]; cur.busy = false;
      if (r && r.ok && Array.isArray(r.members)) cur.members = erpMapOf(r.members);
      else cur.error = (r && r.error) || '조회 실패';
      if (redraw) redraw();
    };
    let pr = null; try { pr = chrome.runtime.sendMessage({ type: 'allowMembers', prjNo, names: (names || []).filter(Boolean) }); } catch (e) { pr = null; }
    if (pr && pr.then) pr.then(done, () => done(null)); else done(null);
  }
  const GRADES = ['S', 'A', 'B', 'C', 'D'];
  const LEVELS = Object.freeze({ '가': 50, '나': 30, '다': 10 });   // 별지 1 주석 1) 평가항목 난이도 점수
  const ETC = Object.freeze([['100', '우수'], ['75', '양호'], ['50', '보통'], ['25', '미흡']]);   // 주석 3) 기타
  const WEIGHT = Object.freeze({ a: 0.3, b: 0.6, c: 0.1 });   // 주석 4) 합산기여도
  const ITEMS = Object.freeze({ '가': ['연구총괄 및 관리', '선급기술규칙/IMO문서등재', '논문(SCI(E))', '특허(국제)', '설계,해석 및 검증 S/W 개발', '기술문서 발간', '최종보고서 작성', '기타'], '나': ['연구계획서작성(선정평가포함)', '연구과제 협약(주관기관만해당)', '기준/절차/가이드라인/지침서', '논문(KCI)', '알고리즘/제어기술 개발', '특허(국내),실용신안,의장', '연구홍보(연구활동보고서, 기고문 등)', '기타'], '다': ['연구내용 사전조사', '학술발표(국내/국제-발표자)', '세미나발표(발표자)', '진도보고서 작성', '기타'] });
  const REQUIRED = Object.freeze(['연구총괄 및 관리', '진도보고서 작성', '연구내용 사전조사']);   // 사용자 지정 필수 3개 — 기본 포함, 기존 포함/해제·그룹 설정은 유지 (2026-10-22 사용자 "총괄관리, 진도보고서 작성, 연구내용 사전조사만 필수로 하고 나머진 필수가 아니도록" — 그 전 연구계획서·최종보고서까지 5개)
  /* 평가항목 목록 — 과제·연차 저장(entry.items)이 세 묶음을 다 가지면 그것, 아니면 지침 기본 ITEMS. parseItems: textarea 글(줄마다 한 항목) → 다듬고 중복을 뺀 묶음당 40개 */
  const itemsOf = (entry) => (entry && entry.items && Object.keys(LEVELS).every((lv) => Array.isArray(entry.items[lv])) ? entry.items : ITEMS);
  const parseItems = (lines) => [...new Set(String(lines == null ? '' : lines).split('\n').map((s) => text(s, 60)).filter(Boolean))].slice(0, 40);
  const itemKey = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^0-9a-z가-힣]/g, '');   // 항목 이름 견주기(띄어쓰기·기호 무시)
  const isRequired = (name) => REQUIRED.some((nm) => itemKey(nm) === itemKey(name));
  /* 항목의 전담 그룹 선택 — 기존 다중 연결을 풀고 한 그룹에 맡기거나(-1이면 전체), 포함을 켠다. */
  function assignGroup(entry, name, gi) {
    const groups = Array.isArray(entry.groups) ? entry.groups : [];
    if (!name || !Number.isInteger(gi) || gi < -1 || (gi >= 0 && !groups[gi])) return false;
    for (const gr of groups) gr.items = (gr.items || []).filter((nm) => itemKey(nm) !== itemKey(name));
    if (gi >= 0) groups[gi].items.push(name);
    entry.pick = entry.pick || {}; entry.pick[name] = true;
    return true;
  }
  /* [평가항목 목록] 의 항목들 — 필수 셋(목록의 등급, 빠졌으면 지침의 원래 등급) + 목록(itemsOf)의 가·나·다 항목(기타 제외) + 그 연차 연구내용 상위 항목(등급 = entry.research, 분류 전은 '') 마다 { name, level, src 'list'|'research', on }.
   * on(포함 = 모든 연구자 또는 그룹 사람에게 저절로 들어감) = entry.pick[이름] 이 있으면 그것, 없으면 필수·분류된 연구내용만. 분류 전(level '')은 못 켬 */
  function pickList(entry, rec) {
    const il = itemsOf(entry), rl = (entry && entry.research) || {}, pick = (entry && entry.pick) || {};
    const lvOf = (nm) => Object.keys(LEVELS).find((lv) => il[lv].some((x) => itemKey(x) === itemKey(nm))) || '';
    const out = REQUIRED.map((nm) => ({ name: nm, level: lvOf(nm) || Object.keys(LEVELS).find((lv) => ITEMS[lv].includes(nm)), src: 'list' }));
    const has = (nm) => out.some((o) => itemKey(o.name) === itemKey(nm));
    for (const lv of Object.keys(LEVELS)) for (const nm of il[lv]) if (nm !== '기타' && !has(nm)) out.push({ name: nm, level: lv, src: 'list' });
    for (const x of researchItems(rec)) if (!has(x.name)) out.push({ name: x.name, level: LEVELS[rl[x.name]] ? rl[x.name] : '', src: 'research' });
    for (const o of out) o.on = !!o.level && (pick[o.name] != null ? !!pick[o.name] : (isRequired(o.name) || o.src === 'research'));
    return out;
  }
  /* 켜진 항목이 들어갈 사람 — 그룹(entry.groups[{ name, people[id], items[이름] }])에 든 항목은 그 그룹들 사람만, 아니면 모두. people = 연구자(행정 제외) [{ id, target }].
   * → { [id]: [{ name, level, count 1, weight round(1/N, 4)(N = 받는 사람 가운데 지급 대상 수 — 제6조② 합 1), auto: true }] } — 저장하지 않고 늘 셈한다 */
  function autoItemsOf(entry, rec, people) {
    const groups = (entry && Array.isArray(entry.groups)) ? entry.groups : [], map = {};
    for (const p of people || []) map[p.id] = [];
    for (const it of pickList(entry, rec)) {
      if (!it.on) continue;
      const gs = groups.filter((gr) => (gr.items || []).some((nm) => itemKey(nm) === itemKey(it.name)));
      const ids = gs.length ? new Set(gs.flatMap((gr) => gr.people || [])) : null;
      const to = (people || []).filter((p) => !ids || ids.has(p.id)), n = to.filter((p) => p.target).length;
      for (const p of to) map[p.id].push({ name: it.name, level: it.level, count: 1, weight: Math.round(10000 / Math.max(1, n)) / 10000, auto: true });
    }
    return map;
  }
  /* 사람의 표 줄 = 포함 항목(앞) + 저장 항목(포함 항목과 같은 이름은 뺌 — 옛 저장의 필수 줄도). 칸·× 의 index 는 늘 이 결과 기준 */
  const mergeItems = (auto, stored) => { const k = new Set((auto || []).map((it) => itemKey(it.name))); return (auto || []).concat((stored || []).filter((it) => !k.has(itemKey(it && it.name)))); };
  /* 등급별 자동 분해의 등급(묶음 첫 키)별 기본 항목 [이름, 난이도] — 1 S · 2 A · 3 B · 4 C · 5 D. 연구수행 내용은 사용자가 고름 */
  const TEMPLATE = Object.freeze({ S: [['연구총괄 및 관리', '가'], ['연구계획서작성(선정평가포함)', '나']], A: [['설계,해석 및 검증 S/W 개발', '가'], ['기준/절차/가이드라인/지침서', '나']], B: [['알고리즘/제어기술 개발', '나'], ['기준/절차/가이드라인/지침서', '나']], C: [['기준/절차/가이드라인/지침서', '나']], D: [['기준/절차/가이드라인/지침서', '나']] });
  const MAX_ITEMS = 4;   // 사람당 보이는 개인 항목(＋ 항목 · 도우미) 수 — 목록에서 포함한 항목과 공통 포함으로 숨은 개인 줄은 세지 않음(저장 상한은 30; 2026-10-21 사용자 "평가 항목은 최대 4개까지만")
  const AUTO_MAX = 3;   // 사람당 필수 밖 항목 수
  const CLASSIFY_ASK = '연구개발계획서의 연구내용 상위 항목마다 별지 1 의 가·나·다 평가항목과 견주어 난이도 등급을 매겨 research 작업으로 돌려줘. 항목은 10개 이내로 — 연구수당 평가에 의미 있는 상위 항목만 고르고 비슷한 것은 하나로 묶어줘. 사람에게 넣지는 말고, reply 에 판단 근거를 짧게 적어줘.';   // 2026-10-21 사용자 "연구항목 추출할 때 10장 이내로"   // [연구내용 분류] 가 채팅으로 보내는 글
  /* 그 차년도의 연구개발계획서 기록(lib/research.js, state.research — lib/staff-ui.js researchRec 와 같음) */
  const researchOf = (state, prjNo, year) => Object.values((state && state.research) || {}).find((r) => r && r.prjNo === prjNo && Number(r.n) === Number(year)) || null;
  const researchItems = (rec) => (rec && Array.isArray(rec.contents) ? rec.contents : []).map((c) => ({ name: text(c && c.item, 120), text: (Array.isArray(c && c.details) ? c.details : []).map((d) => text(d, 120)).filter(Boolean).join(' · ') })).filter((x) => x.name);   // 상위 항목(item)과 세부(details)
  /* res(compute 결과)·entry(저장) → entry.people[id].items 에 등급 템플릿을 넣고 템플릿 이름 항목의 가중치를 1/N 으로(필수는 포함 항목이라 늘 1/N — 저장 밖). 돌려줌: 넣은 항목 수 */
  function decompose(res, entry, rec = null) {
    const e = entry; e.people = e.people || {};
    const T = res.people.filter((p) => p.target);
    const autoNames = new Set([].concat(...Object.values(TEMPLATE).map((t) => t.map(([nm]) => nm))).map(itemKey));
    const visible = {};
    let added = 0;
    for (const p of T) {
      const o = e.people[p.id] || (e.people[p.id] = {});
      const inc = new Set(pickList(e, rec).filter((it) => it.on).map((it) => itemKey(it.name)).concat(p.items.filter((it) => it.auto).map((it) => itemKey(it.name))));   // 그룹 밖 연구자에게도 공통 포함 항목을 개인 항목으로 중복 추가하지 않는다
      o.items = o.items || [];
      visible[p.id] = o.items.filter((it) => !inc.has(itemKey(it.name)));   // 공통 포함을 끄면 복원할 개인 저장 줄은 보존
      const grade = p.g >= 0 && res.groups[p.g] ? res.groups[p.g].keys[0] : 'D';
      for (const [nm, lv] of TEMPLATE[grade] || []) {
        if (visible[p.id].length >= AUTO_MAX || o.items.length >= 30) break;
        if (inc.has(itemKey(nm)) || visible[p.id].some((it) => itemKey(it.name) === itemKey(nm))) continue;
        const item = { name: nm, level: lv, count: 1, weight: 1 }; o.items.push(item); visible[p.id].push(item); added++;
      }
    }
    const share = {};   // 템플릿 이름 항목을 가진 대상 수
    for (const p of T) for (const it of visible[p.id]) { const k = itemKey(it.name); if (autoNames.has(k)) share[k] = (share[k] || 0) + 1; }
    for (const p of T) for (const it of visible[p.id]) { const k = itemKey(it.name); if (share[k]) it.weight = Math.round(10000 / share[k]) / 10000; }
    return added;
  }
  const UNPAID = '연구연가, 퇴직, 전출, 참여연구원 변경, 연구성과 미흡, 연구성과 미기여, 기타 등';
  /* 별지 1 주석 5-1) 평가등급별 인원 배분기준 (참여 연구원 수 1~40 → [S, A, B, C, D] 인원) */
  const HEADCOUNT = [null, [1, 0, 0, 0, 0], [1, 1, 0, 0, 0], [1, 1, 1, 0, 0], [1, 1, 1, 1, 0], [1, 1, 1, 1, 1], [1, 1, 2, 1, 1], [1, 2, 2, 1, 1], [1, 2, 3, 1, 1], [1, 2, 3, 2, 1], [1, 2, 4, 2, 1],
    [1, 3, 4, 2, 1], [1, 3, 5, 2, 1], [1, 3, 5, 3, 1], [1, 3, 6, 3, 1], [1, 3, 6, 3, 2], [2, 3, 6, 3, 2], [2, 3, 7, 3, 2], [2, 4, 7, 3, 2], [2, 4, 8, 3, 2], [2, 4, 8, 4, 2],
    [2, 5, 8, 4, 2], [2, 5, 9, 4, 2], [2, 5, 9, 5, 2], [2, 5, 10, 5, 2], [3, 5, 10, 5, 2], [3, 5, 10, 5, 3], [3, 5, 11, 5, 3], [3, 6, 11, 5, 3], [3, 6, 11, 6, 3], [3, 6, 12, 6, 3],
    [3, 7, 12, 6, 3], [3, 7, 13, 6, 3], [3, 7, 13, 7, 3], [3, 7, 14, 7, 3], [4, 7, 14, 7, 3], [4, 7, 14, 7, 4], [4, 7, 15, 7, 4], [4, 8, 15, 7, 4], [4, 8, 15, 8, 4], [4, 8, 16, 8, 4]];
  /* 별지 2 주석 4) 평가등급별 지급비율 배분기준 (참여 연구원 수 1~40 → 등급 전체의 몫 %, 등급 안에서 인원수로 N분) */
  const PAY_SHARE = [null, [100, 0, 0, 0, 0], [60, 40, 0, 0, 0], [50, 30, 20, 0, 0], [40, 30, 20, 10, 0], [38.8, 26.2, 17.5, 11.7, 5.8], [33, 22.3, 29.9, 9.9, 4.9], [26.3, 37.1, 24.7, 7.9, 4], [23.5, 32.8, 33.1, 7, 3.6], [22.7, 30.3, 30.2, 13.4, 3.4], [20.8, 27.5, 36.3, 12.2, 3.2],
    [17.7, 36.5, 32.5, 10.7, 2.6], [16.5, 33.7, 37.4, 9.9, 2.5], [16.4, 31.9, 35.1, 14.1, 2.5], [15.5, 29.7, 39.2, 13.3, 2.3], [16.3, 29, 37.3, 12.9, 4.5], [25.3, 25.5, 33.9, 11.4, 3.9], [24.1, 24.2, 37.4, 10.8, 3.5], [22, 29.9, 34.9, 9.9, 3.3], [21, 28.4, 37.9, 9.5, 3.2], [20.8, 27.5, 36.3, 12.2, 3.2],
    [19.1, 32.2, 34.4, 11.4, 2.9], [18.5, 30.9, 36.9, 11, 2.7], [18.4, 30, 35.6, 13.3, 2.7], [17.7, 28.8, 38, 12.8, 2.7], [23.5, 26.6, 35.8, 11.8, 2.3], [23.6, 26.3, 34.8, 11.7, 3.6], [22.9, 25.4, 37, 11.3, 3.4], [21.6, 29, 35.5, 10.7, 3.2], [21.4, 28.4, 34.4, 12.6, 3.2], [20.8, 27.5, 36.3, 12.2, 3.2],
    [19.7, 30.7, 34.9, 11.7, 3], [19.2, 29.8, 36.8, 11.4, 2.8], [19.1, 29.2, 35.9, 13, 2.8], [18.6, 28.5, 37.5, 12.7, 2.7], [22.7, 26.9, 35.9, 11.9, 2.6], [22.8, 26.7, 35.3, 11.9, 3.3], [22.3, 26, 36.8, 11.6, 3.3], [21.4, 28.6, 35.6, 11.2, 3.2], [21.2, 28.2, 34.9, 12.5, 3.2], [20.8, 27.5, 36.3, 12.2, 3.2]];
  const headcountOf = (n) => {   // 41명 이상은 10·20·40·20·10% 를 큰 나머지 순으로(표 밖 — 알림)
    if (n <= 40) return HEADCOUNT[n].slice();
    const raw = [0.1, 0.2, 0.4, 0.2, 0.1].map((p) => p * n), base = raw.map(Math.floor);
    let left = n - base.reduce((s, x) => s + x, 0);
    raw.map((r, i) => [r - base[i], i]).sort((x, y) => y[0] - x[0]).forEach(([, i]) => { if (left > 0) { base[i]++; left--; } });
    return base;
  };
  const shareOf = (n) => PAY_SHARE[Math.min(n, 40)].slice();
  const r2 = (x) => Math.round(x * 100) / 100;
  const itemScore = (it) => (LEVELS[it.level] || 0) * (num(it.count) || 0) * (num(it.weight) == null ? 1 : num(it.weight));
  /* 부서 약칭(탭 이름) — 앞 2글자, 겹치면 3글자, 그래도 겹치면 3글자 + 2, 3, … 빈 부서명은 '부서 없음' */
  function shortDepts(names) {
    const out = {}, list = Array.from(new Set((names || []).map((x) => String(x || ''))));
    const by = (arr, k) => { const m = new Map(); for (const nm of arr) { const key = nm.slice(0, k); if (!m.has(key)) m.set(key, []); m.get(key).push(nm); } return m; };
    for (const [k2, g2] of by(list, 2)) {
      if (g2.length === 1) { out[g2[0]] = k2 || '부서 없음'; continue; }
      for (const [k3, g3] of by(g2, 3)) g3.forEach((nm, i) => { out[nm] = i ? `${k3}${i + 1}` : k3; });
    }
    return out;
  }

  /* 부서 그룹(2026-10-21 사용자 "부서를 드래그 하면 병합하고, split 도 되고") — unions = [[부서명, …], …]. 단위 key 는 이름을 '|' 로 이음(저장 depts[key] · 탭 data-d · 자리 표 data-unit) */
  const unitKey = (names) => names.join('|');
  function unitsOf(names, unions) {   // 계획에 있는 부서(names 차례)를 unions 대로 묶은 단위들 — 없는 부서는 빼고, 겹치는 부서는 먼저 온 그룹에, 한 부서만 남는 그룹은 풂. 차례는 첫 부서가 names 에 나온 순
    const used = new Set(), units = [];
    for (const u of Array.isArray(unions) ? unions : []) { const fresh = (Array.isArray(u) ? u : []).filter((x, i, a) => names.includes(x) && !used.has(x) && a.indexOf(x) === i); if (fresh.length >= 2) { units.push(fresh); fresh.forEach((x) => used.add(x)); } }
    for (const nm of names) if (!used.has(nm)) units.push([nm]);
    const first = (u) => Math.min(...u.map((x) => names.indexOf(x)));
    return units.sort((a, b) => first(a) - first(b));
  }
  /* 부서/배정 그룹을 전담 그룹으로 복사할 후보. 행정지원·부서 미입력은 제외하며 기존 배정은 바꾸지 않는다. */
  function scopeUnits(people, unions) {
    const eligible = (people || []).filter((p) => !p.admin && !isAdmin(p.role) && p.dept);
    return unitsOf([...new Set(eligible.map((p) => p.dept))], unions).map((names) => ({ name: text(names.join(' + '), 40), people: eligible.filter((p) => names.includes(p.dept)).map((p) => p.id) }));
  }
  const nextGroupName = (groups) => { let n = 1; while (groups.some((gr) => gr.name === `전담 그룹 ${n}`)) n++; return `전담 그룹 ${n}`; };
  const mergeUnions = (unions, a, b) => { const names = Array.from(new Set(String(a).split('|').concat(String(b).split('|')))); return (Array.isArray(unions) ? unions : []).filter((u) => !u.some((x) => names.includes(x))).concat([names]); };   // 단위 key a·b 를 한 그룹으로(겹치던 그룹은 흡수)
  const splitUnion = (unions, key) => (Array.isArray(unions) ? unions : []).filter((u) => unitKey(u) !== String(key));   // 그룹 풀기

  /* ---------- 계산 ---------- */
  /* 단위(그룹 — 그룹 없는 부서는 저 혼자)별 등급 자리 자동 배당(2026-10-21 사용자 "똑같이 수로 배당 하고 남은 것들은 차례대로, 부서이동하면서 … 6개가 남고 … 2개가 남았다면 … 평균이 비슷하도록") — 묶음마다(위 등급부터) 인원 배분 기준(count0)을 사람이 남은 단위 수로 나눈 몫을 똑같이 주고(단위의 남은 사람 수를 넘지 않게), 나머지는 한 자리씩 받은 자리 ÷ 사람 수가 가장 낮은 단위(사람이 많이 남은 쪽)에, 같으면 지난번 나머지를 받은 다음 단위부터 차례로(turn). 난수 없음. 열 합 = count0, 줄 합 = 단위 사람 수(Σcount0 = Σ사람이라 늘 다 나뉨). groups[{ key, count0 }] · lists[단위][사람] → [단위]{ [묶음 key]: n }. (그 전에는 남은 사람 수 비례 큰 나머지) */
  function apportion(groups, lists) {
    const size = lists.map((l) => l.length), rem = size.slice(), got = size.map(() => 0), out = lists.map(() => ({}));
    let turn = 0;   // 나머지 차례 — 지난번 받은 단위의 다음부터
    for (const gr of groups) {
      const alive = rem.filter((r) => r > 0).length, each = alive ? Math.floor(gr.count0 / alive) : 0;
      lists.forEach((_, i) => { const t = Math.min(each, rem[i]); out[i][gr.key] = t; rem[i] -= t; got[i] += t; });
      let left = gr.count0 - lists.reduce((s, _, i) => s + out[i][gr.key], 0);
      while (left > 0) {
        let pick = -1;
        for (let k = 0; k < lists.length; k++) { const i = (turn + k) % lists.length; if (rem[i] > 0 && (pick < 0 || got[i] / size[i] < got[pick] / size[pick] - 1e-9)) pick = i; }
        if (pick < 0) break;
        out[pick][gr.key]++; rem[pick]--; got[pick]++; left--; turn = (pick + 1) % lists.length;
      }
    }
    return out;
  }
  /* 입력 { pool(원), avail(원 | null → pool), merge{ sa, cd }, adjust{ S, A, B, C, D }, byDept, depts{ [부서명]: { slots{ [묶음 key]: n }, done } }, people[{ id, name, role, dept, grade, rate(연간 %), etc(100|75|50|25|null), items[], note, out, rank('S'~'D' 수동 등급 | ''), cap(남은 연구수당 원 | null), capSrc }] }
   * → { pool, avail, n, manual, byDept, groups[{ key, label, keys, count0, share0, perHead0, share, members, perHead, over }], depts[{ name, label, people(합산 순), n, slots{ key: n }, slots0(기본 = 자동 배당), custom(저장 slots 있음), done }], people[{ …, admin, target, contrib, a, b, c, total, g, auto, dauto, autoLabel, gradeLabel, ratio, amt, reason, tie, over, room, down, downAmt }], sums{ a, b, c, total, ratio, amt }, left, overflow } */
  function compute(inp) {
    const pool = won(inp && inp.pool) || 0;
    const avail = won(inp && inp.avail) != null ? won(inp.avail) : pool;
    const merge = { sa: !!(inp && inp.merge && inp.merge.sa), cd: !!(inp && inp.merge && inp.merge.cd) };
    const adjust = {}; for (const k of GRADES) adjust[k] = num(inp && inp.adjust && inp.adjust[k]) || 0;
    const byDept = !!(inp && inp.byDept), deptCfg = (inp && inp.depts && typeof inp.depts === 'object') ? inp.depts : {};
    const people = ((inp && inp.people) || []).map((p, idx) => {
      const items = (Array.isArray(p.items) ? p.items : []).map((it) => ({ name: text(it.name), level: LEVELS[it.level] ? it.level : '가', count: num(it.count) == null ? 1 : num(it.count), weight: num(it.weight) == null ? 1 : num(it.weight), auto: !!it.auto })).map((it) => Object.assign(it, { score: itemScore(it) }));
      const admin = isAdmin(p.role), rate = num(p.rate) || 0, out = !!p.out;
      const target = !admin && !out && rate > 0;
      return { idx, id: String(p.id || ''), name: String(p.name || ''), role: String(p.role || ''), dept: text(p.dept), grade: text(p.grade, 20), rate, etc: num(p.etc), items, note: text(p.note, 200), out, rank: GRADES.includes(p.rank) ? p.rank : '', cap: won(p.cap), capSrc: String(p.capSrc || ''),
        admin, target, contrib: items.reduce((s, it) => s + it.score, 0), a: 0, b: 0, c: 0, total: 0, g: -1, auto: -1, dauto: -1, autoLabel: '', gradeLabel: '', ratio: 0, amt: 0, reason: admin ? '연구지원(행정)' : out ? (text(p.note, 200) || '미지급') : rate > 0 ? '' : '참여 없음', tie: false, over: 0, room: 0, down: '', downAmt: 0 };
    });
    const T = people.filter((p) => p.target);
    const n = T.length;
    const rateSum = T.reduce((s, p) => s + p.rate, 0), contribSum = T.reduce((s, p) => s + p.contrib, 0), etcSum = T.reduce((s, p) => s + (p.etc || 0), 0);
    for (const p of T) {
      p.a = rateSum ? p.rate / rateSum * 100 : 0;
      p.b = contribSum ? p.contrib / contribSum * 100 : 0;
      p.c = etcSum ? (p.etc || 0) / etcSum * 100 : 0;
      p.total = p.a * WEIGHT.a + p.b * WEIGHT.b + p.c * WEIGHT.c;
    }
    // 등급 묶음 — 인원·몫(통합이면 합침), 조정(%p)
    let groups = [], depts = [], manual = false;
    if (n) {
      const hc = headcountOf(n), sh = shareOf(n);
      const mk = (keys) => ({ key: keys.join('+'), label: keys.join('+'), keys, count0: keys.reduce((s, k) => s + hc[GRADES.indexOf(k)], 0), share0: keys.reduce((s, k) => s + sh[GRADES.indexOf(k)] + adjust[k], 0), members: [], over: 0 });
      groups = (merge.sa ? [mk(['S', 'A'])] : [mk(['S']), mk(['A'])]).concat([mk(['B'])], merge.cd ? [mk(['C', 'D'])] : [mk(['C']), mk(['D'])]);
      for (const gr of groups) gr.perHead0 = gr.count0 ? gr.share0 / gr.count0 : 0;
      const bySum = (x, y) => y.total - x.total || x.idx - y.idx;
      // 자동 배정 — 합산기여도 내림차순으로 자리(cap)에 차례로. 동점은 앞사람(상위등급)과 같은 묶음으로 올리고 그 자리는 아래 묶음에서 뺀다. 자리가 다 차면 마지막 묶음에.
      const place = (list, cap, field, fallback) => {   // fallback(p): 자리가 다 찬 뒤의 사람(사용자가 단위의 자리를 사람 수보다 적게 둠)이 갈 묶음. 없으면 마지막 묶음
        let gi = 0;
        list.forEach((p, k) => {
          while (gi < groups.length - 1 && cap[gi] <= 0) gi++;
          const prev = list[k - 1];
          if (prev && Math.abs(prev.total - p.total) < 1e-9 && prev[field] !== gi) { p[field] = prev[field]; p.tie = true; prev.tie = true; }
          else if (cap[gi] <= 0 && fallback) { p[field] = fallback(p); return; }
          else p[field] = gi;
          cap[gi]--;
        });
      };
      const sorted = T.slice().sort(bySum);
      place(sorted, groups.map((gr) => gr.count0), 'auto');   // 과제 전체 — 부서별 자리의 기본값이자 수동 배정과 견주는 기준
      for (const p of T) p.dauto = p.auto;
      if (byDept) {   // 단위(그룹·부서)마다 자리(기본 = 자동 배당 apportion, 조율하면 slots)를 두고 그 안에서 다시 자동 배정(자리가 없는 사람은 과제 전체 자동 등급)
        const names = []; for (const p of T) if (!names.includes(p.dept)) names.push(p.dept);
        const labels = shortDepts(names);
        for (const p of T) p.tie = false;
        const units = unitsOf(names, inp && inp.unions);   // 그룹(끌어 합친 부서들)은 한 단위로 자리를 같이 씀
        const lists = units.map((u) => T.filter((p) => u.includes(p.dept)).sort(bySum)), quota = apportion(groups, lists);
        depts = units.map((u, i) => {
          const name = unitKey(u), ppl = lists[i], cfg = deptCfg[name] || {};
          const slots0 = quota[i], slots = {};
          for (const gr of groups) { const v = num(cfg.slots && cfg.slots[gr.key]); slots[gr.key] = v != null && v >= 0 ? Math.floor(v) : slots0[gr.key]; }
          place(ppl, groups.map((gr) => slots[gr.key]), 'dauto', (p) => p.auto);
          return { name, names: u, title: u.map((x) => x || '부서 없음').join(' + '), label: u.map((x) => labels[x]).join('+'), people: ppl, n: ppl.length, slots, slots0, custom: !!(cfg.slots && Object.keys(cfg.slots).length), done: !!cfg.done };
        });
      }
      // 배정 — 수동 등급(rank)이 있으면 그 글자가 든 묶음. 없으면 자동(부서별이면 부서 안 자동)이되, 같은 범위에 수동이 있으면(계획에 새로 든 사람) 남은 자리부터
      const ranked = sorted.filter((p) => p.rank), unranked = sorted.filter((p) => !p.rank);
      manual = ranked.length > 0;
      for (const p of ranked) { p.g = groups.findIndex((gr) => gr.keys.includes(p.rank)); p.tie = false; groups[p.g].members.push(p); }
      for (const p of unranked) {
        const d = byDept ? depts.find((x) => x.people.includes(p)) : null, scope = d ? d.people : T;
        let gi = p.dauto;
        if (scope.some((q) => q.rank)) { const room = groups.findIndex((gr) => gr.members.filter((q) => scope.includes(q)).length < (d ? d.slots[gr.key] : gr.count0)); if (room >= 0) gi = room; }
        p.g = gi; groups[gi].members.push(p);
      }
      for (const p of sorted) p.autoLabel = groups[p.dauto].label;
      for (const gr of groups) gr.members.sort(bySum);
      for (const d of depts) {   // 부서별 재조정 — 묶음별 실제 배정 수(actual), 자리와 다른 묶음(fit "S 0/1"), 줄 합 ≠ 사람 수(rowBad) → [부서별 배정] 탭 · 부서 칩 !
        d.actual = {}; for (const gr of groups) d.actual[gr.key] = gr.members.filter((p) => d.people.includes(p)).length;
        d.fit = groups.filter((gr) => d.actual[gr.key] !== d.slots[gr.key]).map((gr) => `${gr.label} ${d.actual[gr.key]}/${d.slots[gr.key]}`);
        d.rowBad = groups.reduce((s, gr) => s + d.slots[gr.key], 0) !== d.n;
      }
      // 몫 — 묶음 인원이 배분 기준(count0)보다 많으면 넘친 사람마다 빈자리가 있는 가장 가까운 아래(없으면 위) 묶음의 1인 몫(perHead0)을 가져온다(별지 2 주석 "하위등급 비율을 상위비율에 합산하여 N분" — 동점·수동·부서별에 같이)
      const vac = groups.map((gr) => Math.max(0, gr.count0 - gr.members.length));
      for (const gr of groups) gr.share = gr.share0;
      groups.forEach((gr, i) => {
        gr.over = Math.max(0, gr.members.length - gr.count0);
        for (let m = 0; m < gr.over; m++) {
          let j = -1;
          for (let x = i + 1; x < groups.length && j < 0; x++) if (vac[x] > 0) j = x;
          for (let x = i - 1; x >= 0 && j < 0; x--) if (vac[x] > 0) j = x;
          if (j < 0) break;
          vac[j]--; gr.share += groups[j].perHead0; groups[j].share -= groups[j].perHead0;
        }
      });
      for (const gr of groups) {
        gr.perHead = gr.members.length ? gr.share / gr.members.length : 0;
        for (const p of gr.members) { p.gradeLabel = gr.label; p.ratio = gr.perHead; p.amt = Math.floor(avail * gr.perHead / 100); }
      }
      // 한도(cap) — 여유·초과, 초과면 지금 등급 아래 묶음 가운데 기준 1인 지급액이 한도 이상인 가장 낮은 묶음(down — "↓ B 가능"). ponytail: perHead0 어림 — 옮긴 뒤의 N분·넘침 재배분은 안 셈(옮기면 표가 다시 셈하므로 충분)
      for (const p of T) {
        if (p.cap == null) continue;
        p.over = Math.max(0, p.amt - p.cap); p.room = Math.max(0, p.cap - p.amt);
        if (p.over > 0) for (let j = groups.length - 1; j > p.g; j--) { const amt = Math.floor(avail * groups[j].perHead0 / 100); if (amt >= p.cap) { p.down = groups[j].label; p.downAmt = amt; break; } }
      }
    }
    const sums = { a: T.reduce((s, p) => s + p.a, 0), b: T.reduce((s, p) => s + p.b, 0), c: T.reduce((s, p) => s + p.c, 0), total: T.reduce((s, p) => s + p.total, 0), ratio: T.reduce((s, p) => s + p.ratio, 0), amt: T.reduce((s, p) => s + p.amt, 0) };
    const deptAlert = { cols: byDept ? groups.filter((gr) => depts.reduce((s, d) => s + d.slots[gr.key], 0) !== gr.count0).map((gr) => gr.label) : [], depts: depts.filter((d) => d.fit.length || d.rowBad).map((d) => d.label) };   // byDept 아니면 둘 다 빈 배열
    return { pool, avail, n, manual, byDept, merge, adjust, groups, depts, people, sums, left: avail - sums.amt, overflow: n > 40, contribSum, etcSum, deptAlert };
  }
  /* 사용한(지급 대상 카드에 있는) 항목마다 참여연구원간 가중치 합 [{ key, name, sum, bad }] — 논문·특허·실용신안·의장 제외, 제6조②·별지 1 주석: 합 1. bad = 1/N 반올림(소수 4자리) 오차를 봐주고도 1 이 아님. checks 의 알림과 [평가항목 목록] 머리 줄의 "가중치 합" 칩·칩 꼬리표 "합 n" 이 같이 쓴다(2026-10-21 사용자 "사용한 평가항목의 합을 모니터링 할 수 있도록") */
  function weightSums(res) {
    const wsum = {};
    for (const p of res.people) if (p.target) for (const it of p.items) if (it.name && !/논문|특허|실용신안|의장/.test(it.name)) { const k = itemKey(it.name); (wsum[k] = wsum[k] || { key: k, name: it.name, sum: 0 }).sum += it.weight; }
    return Object.values(wsum).map((w) => ({ ...w, bad: Math.abs(w.sum - 1) > 0.005 }));
  }
  /* 알림 줄 — { level: 'info' | 'warn' | 'error', text } */
  function checks(res) {
    const out = [];
    const th = (n) => S.thousand(n);
    if (!res.pool) out.push({ level: 'error', text: '연구수당 계상금액이 없습니다 — 사업비 관리 예산 칸의 연구수당 줄에 적거나 일반 정보의 계상금액 칸에 직접 적으세요.' });
    if (res.avail > res.pool) out.push({ level: 'warn', text: `집행 가능액 ${th(res.avail)}천원이 계상금액 ${th(res.pool)}천원보다 큽니다.` });
    if (!res.n) out.push({ level: 'error', text: '지급 대상 연구원이 없습니다 — 참여연구원 계획에 참여율이 있는 연구자가 있어야 합니다.' });
    if (res.overflow) out.push({ level: 'warn', text: `참여 연구원 ${res.n}명 — 지침의 표는 40명까지라 인원은 10·20·40·20·10% 로, 지급비율은 40명 줄로 셈했습니다.` });
    if (res.n && !res.contribSum) out.push({ level: 'info', text: '성과 항목을 아직 적지 않아 성과 기여율(b)은 모두 0 입니다 — 별지 1 의 ＋ 항목으로 적으세요.' });
    const wbad = weightSums(res).filter((w) => w.bad);
    if (wbad.length) out.push({ level: 'warn', text: `참여연구원간 가중치 합이 1 이 아닌 항목: ${wbad.map((w) => `${w.name}(${r2(w.sum)})`).join(', ')} — 논문·특허를 뺀 항목은 같은 항목을 나눈 사람들의 가중치 합이 1 이어야 합니다(제6조②).` });
    const noEtc = res.people.filter((p) => p.target && p.etc == null);
    if (res.n && noEtc.length) out.push({ level: 'info', text: `기타(연구수행 성실성)를 고르지 않은 사람 ${noEtc.length}명 — 비우면 0 으로 셈합니다.` });
    const adjSum = GRADES.reduce((s, k) => s + res.adjust[k], 0);
    if (Math.abs(adjSum) > 1e-9) out.push({ level: 'warn', text: `등급간 조정의 합이 ${r2(adjSum)}%p 입니다 — 제로섬(합 0)이어야 합니다.` });
    for (const k of GRADES) if (Math.abs(res.adjust[k]) > 10) out.push({ level: 'warn', text: `${k} 등급 조정 ${res.adjust[k]}%p — 최대 10% 범위 안이어야 합니다.` });
    for (const gr of res.groups) if (gr.members.length && gr.share < 3) out.push({ level: 'warn', text: `${gr.label} 등급 몫 ${r2(gr.share)}% — 등급별 최소 3% 이상이어야 합니다.` });
    for (let i = 1; i < res.groups.length; i++) { const up = res.groups[i - 1], lo = res.groups[i]; if (up.members.length && lo.members.length && lo.perHead > up.perHead + 1e-9) out.push({ level: 'warn', text: `${lo.label} 등급 1인 지급비율 ${r2(lo.perHead)}% 가 ${up.label} 등급 ${r2(up.perHead)}% 보다 큽니다 — 하위등급 개인별 지급액은 상위등급을 넘을 수 없습니다.` }); }
    const ties = res.people.filter((p) => p.tie);
    if (ties.length) out.push({ level: 'info', text: `합산기여도 동점: ${ties.map((p) => p.name).join(', ')} — 상위등급으로 두고 하위등급 1인 몫을 합쳐 나눴습니다.` });
    if (res.manual) {   // 수동 배정(끌어 놓기 · 등급 칸 · 확정)
      for (const gr of res.groups) if (gr.members.length !== gr.count0) out.push({ level: 'warn', text: `${gr.label} 등급 ${gr.members.length}명 — 인원 배분 기준은 ${gr.count0}명입니다${gr.members.length > gr.count0 ? ' (넘친 사람은 빈 등급의 1인 몫을 가져와 N분)' : ''}.` });
      const diff = res.people.filter((p) => p.target && p.gradeLabel !== p.autoLabel);
      if (diff.length) out.push({ level: 'info', text: `합산기여도 순(별지 1)과 다른 등급: ${diff.map((p) => `${p.name} ${p.gradeLabel}(순서대로면 ${p.autoLabel})`).join(', ')} — 평가 내용을 맞추거나 [자동]으로 되돌리세요.` });
    }
    if (res.byDept) {   // 부서별 자리 — 열 합 = 인원 배분 기준, 줄 합 = 부서 사람 수
      for (const gr of res.groups) { const s = res.depts.reduce((a, d) => a + d.slots[gr.key], 0); if (s > gr.count0) out.push({ level: 'warn', text: `${gr.label} 등급 부서별 인원 합 ${s}명 — 인원 배분 기준은 ${gr.count0}명입니다.` }); else if (s < gr.count0) out.push({ level: 'warn', text: `${gr.label} 등급 남은 자리 ${gr.count0 - s}명 — [부서별 배정] 표에서 부서에 더하세요(+).` }); }
      for (const d of res.depts) { const s = res.groups.reduce((a, gr) => a + d.slots[gr.key], 0); if (s !== d.n) out.push({ level: 'warn', text: `${d.label} 부서 등급 인원 합 ${s}명 — 사람은 ${d.n}명입니다.` }); }
      for (const d of res.depts) if (d.fit.length) out.push({ level: 'warn', text: `${d.label} 부서: 자리와 배정이 다릅니다(${d.fit.join(' · ')}) — 등급 판의 자리 수나 [부서별 배정] 표를 고치거나 이름을 옮기세요.` });
      const nd = res.depts.find((d) => !d.name);
      if (nd) out.push({ level: 'info', text: `부서가 빈 사람 ${nd.n}명 — 별지 1 의 부서명 칸에 적으면 그 부서 탭으로 갑니다.` });
    }
    const overs = res.people.filter((p) => p.target && p.cap != null && p.over > 0);   // 한도 초과 — ↓ 가능(낮춰도 한도를 채우는 가장 낮은 등급)이면 그 말, 아니면 못 미침
    for (const p of overs) out.push({ level: 'warn', text: `${p.name}: 지급액 ${th(p.amt)}천원이 남은 연구수당 ${th(p.cap)}천원(${p.capSrc})을 넘습니다(초과 ${th(p.over)}천원) — ${p.down ? `↓ ${p.down} 등급으로 낮춰도 한도를 채웁니다(${p.down} 1인 기준 ${th(p.downAmt)}천원)` : '한 등급만 낮춰도 한도에 못 미칩니다'} · 초과분은 예산변경·계속비 편성 또는 반납(제6조④).` });
    if (overs.length) {
      const rooms = res.people.filter((p) => p.target && p.cap != null && p.room > 0), unknown = res.people.filter((p) => p.target && p.cap == null).length;
      out.push({ level: 'info', text: `한도 초과분 합 ${th(overs.reduce((s, p) => s + p.over, 0))}천원 — 한도에 여유가 있는 사람: ${rooms.length ? rooms.map((p) => `${p.name}(여유 ${th(p.room)}천원)`).join(', ') : '없음'}${unknown ? ` · 한도를 모르는 사람 ${unknown}명` : ''}.` });
    }
    const noCap = res.people.filter((p) => p.target && p.cap == null);
    if (noCap.length) out.push({ level: 'info', text: `남은 연구수당(한도)을 모르는 사람 ${noCap.length}명: ${noCap.map((p) => p.name).join(', ')} — 아래 자료 요청으로 팀즈에 물어보면 잔여 한도 열에 들어옵니다.` });
    const admin = res.people.filter((p) => p.admin).length;
    if (admin) out.push({ level: 'info', text: `연구지원(행정) ${admin}명은 연구수당 대상이 아니어서 뺐습니다.` });
    const outs = res.people.filter((p) => !p.admin && !p.target);
    if (outs.length) out.push({ level: 'info', text: `미지급 ${outs.length}명: ${outs.map((p) => `${p.name}(${p.reason})`).join(', ')} — 별지 2 에 사유만 적습니다.` });
    if (res.n && res.left > 0) out.push({ level: 'info', text: `집행 가능액과 지급액 합의 차 ${th(res.left)}천원(원 단위 절삭·비율 합).` });
    return out;
  }

  /* ---------- 저장 (storage.local.allowCalc) ---------- */
  function normalizeEntry(raw) {
    const e = raw && typeof raw === 'object' ? raw : {};
    const people = {};
    for (const [id, p] of Object.entries(e.people && typeof e.people === 'object' ? e.people : {})) {
      if (!id || !p || typeof p !== 'object') continue;
      const o = {};
      if (text(p.dept)) o.dept = text(p.dept); if (text(p.grade, 20)) o.grade = text(p.grade, 20); if (text(p.note, 200)) o.note = text(p.note, 200);
      if (ETC.some(([v]) => Number(v) === num(p.etc))) o.etc = num(p.etc);
      if (p.out) o.out = true;
      if (GRADES.includes(p.rank)) o.rank = p.rank;
      const items = (Array.isArray(p.items) ? p.items : []).slice(0, 30).map((it) => ({ name: text(it && it.name), level: it && LEVELS[it.level] ? it.level : '가', count: num(it && it.count) == null ? 1 : num(it.count), weight: num(it && it.weight) == null ? 1 : num(it.weight) }));
      if (items.length) o.items = items;
      if (Object.keys(o).length) people[id] = o;
    }
    const out = { people, at: num(e.at) || 0 };
    if (won(e.pool) != null) out.pool = won(e.pool);
    if (won(e.avail) != null) out.avail = won(e.avail);
    if (text(e.org, 40)) out.org = text(e.org, 40);
    if (e.merge && (e.merge.sa || e.merge.cd)) out.merge = { sa: !!e.merge.sa, cd: !!e.merge.cd };
    const adj = {}; for (const k of GRADES) { const v = num(e.adjust && e.adjust[k]); if (v) adj[k] = v; }
    if (Object.keys(adj).length) out.adjust = adj;
    if (e.byDept) out.byDept = true;
    const research = {};   // 연구내용 항목 → 도우미가 매긴 등급
    for (const [nm, lv] of Object.entries(e.research && typeof e.research === 'object' ? e.research : {}).slice(0, 60)) if (text(nm, 120) && LEVELS[lv]) research[text(nm, 120)] = lv;
    if (Object.keys(research).length) out.research = research;
    const pick = {};   // 포함 토글(entry.pick[이름] = true|false)
    for (const [nm, v] of Object.entries(e.pick && typeof e.pick === 'object' ? e.pick : {}).slice(0, 100)) if (text(nm, 120) && typeof v === 'boolean') pick[text(nm, 120)] = v;
    if (Object.keys(pick).length) out.pick = pick;
    const uniq = (arr, max) => [...new Set((Array.isArray(arr) ? arr : []).map((x) => text(x, max)).filter(Boolean))].slice(0, 60);
    const groups = (Array.isArray(e.groups) ? e.groups : []).filter((gr) => gr && typeof gr === 'object').slice(0, 20).map((gr) => ({ name: text(gr.name, 40) || '그룹', people: uniq(gr.people, 80), items: uniq(gr.items, 120) }));   // 포함 항목을 받을 사람 그룹
    if (groups.length) out.groups = groups;
    const depts = {};
    for (const [nm, c] of Object.entries(e.depts && typeof e.depts === 'object' ? e.depts : {})) {
      if (!c || typeof c !== 'object' || nm.length > 200) continue;   // 그룹 단위 key(이름|이름)도
      const o = {}, slots = {};
      for (const [k, v] of Object.entries(c.slots && typeof c.slots === 'object' ? c.slots : {})) { const n = num(v); if (/^[SABCD](\+[SABCD])?$/.test(k) && n != null && n >= 0) slots[k] = Math.floor(n); }
      if (Object.keys(slots).length) o.slots = slots;
      if (c.done) o.done = true;
      if (Object.keys(o).length) depts[nm] = o;
    }
    if (Object.keys(depts).length) out.depts = depts;
    const unions = (Array.isArray(e.unions) ? e.unions : []).slice(0, 20).map((u) => (Array.isArray(u) ? u.map((x) => text(x, 40)).filter((x, i, a) => a.indexOf(x) === i) : [])).filter((u) => u.length >= 2);   // 부서 그룹
    if (unions.length) out.unions = unions;
    if (e.items && typeof e.items === 'object' && Object.keys(LEVELS).every((lv) => Array.isArray(e.items[lv]))) { const it = {}; for (const lv of Object.keys(LEVELS)) it[lv] = parseItems(e.items[lv].join('\n')); out.items = it; }   // 평가항목 목록(고친 경우만 — 세 묶음이 다 있어야)
    return out;
  }
  function normalize(raw) { const out = {}; for (const [k, v] of Object.entries(raw && typeof raw === 'object' ? raw : {})) if (k) out[k] = normalizeEntry(v); return out; }
  async function load() { try { const r = await chrome.storage.local.get(KEY); return normalize(r[KEY]); } catch (e) { return {}; } }
  async function save(all) { try { await chrome.storage.local.set({ [KEY]: normalize(all) }); } catch (e) {} }

  /* ---------- 계획 → 계산 입력 ---------- */
  /* staff(계획) · entry(저장) · opts { me(내 이름), hr{ grade, remain }(내 HR — 직급 기본값·남은 연구수당), erp{ [이름키]: { dept, pos } }(rERP 참여인력 — 부서명·직급 기본값, ensureErp), rec(그 연차 연구개발계획서 기록 — 연구내용 포함 항목) } */
  function inputOf(staff, entry, opts = {}) {
    const ov = (entry && entry.people) || {};
    const hr = opts.hr || null, erp = opts.erp || null;
    const people = (staff && staff.people) || [];
    const auto = autoItemsOf(entry, opts.rec, people.filter((p) => !isAdmin(p.role)).map((p) => ({ id: p.id, target: !(ov[p.id] && ov[p.id].out) && (S.personStats(p, staff.basis).rate || 0) > 0 })));   // 포함 항목 — 사람마다(가중치 1/N 은 받는 지급 대상 수)
    const shared = new Set(pickList(entry, opts.rec).filter((it) => it.on).map((it) => itemKey(it.name)));
    return people.map((p) => {
      const st = S.personStats(p, staff.basis), o = ov[p.id] || {};
      const me = !!(opts.me && S.sameName(p.name, opts.me));
      const e = (erp && erp[S.nameKeyOf(p.name)]) || null;
      const cap = p.allowance != null ? p.allowance : (me && hr && hr.remain != null ? Math.max(hr.remain, 0) : null);
      return { id: p.id, name: p.name, role: p.role, dept: o.dept || (e && e.dept) || '', grade: o.grade || (e && e.pos) || (me && hr && hr.grade ? hr.grade : ''), rate: st.rate || 0, etc: o.etc != null ? o.etc : null, items: isAdmin(p.role) ? (o.items || []) : mergeItems(auto[p.id], (o.items || []).filter((it) => !shared.has(itemKey(it.name)))), note: o.note || '', out: !!o.out, rank: o.rank || '', cap, capSrc: p.allowance != null ? '응답' : cap != null ? 'HR' : '' };
    });
  }
  const sumRows = (rows, re) => { const hit = (rows || []).filter((r) => re.test(String(r.name || '')) && r.plan != null); return hit.length ? hit.reduce((s, r) => s + r.plan, 0) : null; };
  const poolOfRows = (rows) => sumRows(rows, /수당/);
  const availOfRows = (rows) => { const hit = (rows || []).filter((r) => /수당/.test(String(r.name || '')) && r.plan != null); return hit.length ? hit.reduce((s, r) => s + (r.left != null ? r.left : r.plan), 0) : null; };
  const payOfRows = (rows) => sumRows(rows, /인건비/);
  /* 계산에 쓸 사람들 — 참여연구원 계획(staffPlans)이 있으면 그것, 없으면 이 기간의 rERP 등록 지급계획(lib/staff-ui.js staffCtx 의 erpPeople — 참여인력 카드·참여연구원 변경 탭이 계획 대신 보이는 것과 같음, 2026-10-23).
   * 대체 사람의 id 는 'erp:이름키'(저장 entry.people 의 키 — 나중에 계획을 세우면 새 id 라 그때 적은 부서·항목은 이어지지 않음), staff.erpOnly = true. 둘 다 없으면 null */
  function staffFor(p, plan, year, state) {
    if (plan && plan.people && plan.people.length) return { basis: plan.basis || 'rerp', people: plan.people };
    const U = g.KRX_STAFF_UI;
    let sc = null;
    try { sc = U && typeof U.staffCtx === 'function' ? U.staffCtx(p, plan, year, state) : null; } catch (e) { sc = null; }
    const ep = sc && sc.erpPeople && sc.erpPeople.people.length ? sc.erpPeople : null;
    return ep ? { basis: 'rerp', erpOnly: true, people: ep.people.map((q) => Object.assign({}, q, { id: `erp:${S.nameKeyOf(q.name)}` })) } : null;
  }
  /* 과제·연차·저장·상태 → 계산에 쓸 것 전부 { key, entry, staff, erpOnly, pool, avail, org, period, payTotal, res } */
  function ctxOf(p, plan, year, br, state, opts = {}) {
    const key = S.planKey(p.prjNo, year);
    const entry = (state.allowCalc || {})[key] || { people: {} };
    const staff = staffFor(p, plan, year, state);
    const rows = br && br.rows;
    const pool = entry.pool != null ? entry.pool : poolOfRows(rows);
    const availDefault = availOfRows(rows);
    const avail = entry.avail != null ? entry.avail : (availDefault != null ? availDefault : pool);
    const U = g.KRX_STAFF_UI;
    const per = U && U.periodOf ? U.periodOf(p, plan, year) : null;
    const payTotal = U && U.budgetOf ? U.budgetOf(p, plan, year, rows) : payOfRows(rows);
    const erpSt = (state.allowErp || {})[p.prjNo] || null;   // rERP 참여인력(ensureErp) — opts.erp 가 없으면 여기서
    const rec = researchOf(state, p.prjNo, year);   // 연구개발계획서 기록 — 연구내용 포함 항목·[연구내용 분류]
    const res = compute({ pool, avail, merge: entry.merge, adjust: entry.adjust, byDept: entry.byDept, depts: entry.depts, unions: entry.unions, people: inputOf(staff, entry, Object.assign({ rec }, opts, opts.erp ? {} : { erp: erpSt && erpSt.members })) });
    return { key, entry, staff, erpOnly: !!(staff && staff.erpOnly), pool, avail, poolDefault: poolOfRows(rows), availDefault, org: entry.org || '한국선급', period: per && per.from ? `${per.from} ~ ${per.to}` : '', payTotal, res, p, year, erp: erpSt, rec };
  }

  /* ---------- 탭의 카드 ---------- */
  const fmtWon = (n) => (n == null ? '' : F.money(n));
  const pctTxt = (x) => r2(x).toFixed(2);
  const info = (text) => `<span class="krext-al-info" tabindex="0" role="note" aria-label="${esc(text)}" title="${esc(text)}">ⓘ</span>`;   // 설명 문단 대신 지침 내용을 보이는 아이콘(2026-10-21 밤 사용자 "기본적인 설명은 필요 없음, 필요한 경우 아이콘으로 지침 내용을")
  function card(p, plan, year, br, state, opts = {}) {
    const used = staffFor(p, plan, year, state);   // 실제 셈에 쓰는 사람들(계획, 없으면 rERP 등록 지급계획)
    if (used) ensureErp(state, p.prjNo, used.people.filter((q) => !isAdmin(q.role)).map((q) => q.name));   // 부서명·직급 기본값 — 처음 한 번(받으면 bind 의 draw 로 다시 그림)
    const c = ctxOf(p, plan, year, br, state, opts);
    const { key, entry, staff, res } = c;
    const th = (n) => (n == null ? '' : S.thousand(n));
    const yl = S.yearLabel(year);
    const head = `<div class="krext-al-toolbar"><div class="krext-al-heading"><strong>지급 계획 작성</strong><small>${res.n}명 · 집행 가능액 ${c.avail ? `${th(c.avail)}천원` : '없음'}</small></div><div class="krext-st-acts"><button type="button" class="krext-plan-btn" data-act="al-copy" title="별지 1·2 표를 탭으로 나눈 글로 복사"${staff ? '' : ' disabled'}>복사</button><button type="button" class="krext-plan-btn" data-act="al-reset" title="이 과제 ${esc(yl)} 의 일반 정보·성과 항목·기타·등급 배정·조정·부서별·미지급을 지우고 기본값으로"${entry.at ? '' : ' disabled'}>초기화</button><button type="button" class="krext-plan-btn krext-plan-save" data-act="al-docx" title="별지 1 연구수행 기여도 평가서 · 별지 2 연구수당 지급 내역서를 Word 문서(.docx)로 내려받습니다"${staff ? '' : ' disabled'}>DOCX 내려받기</button></div></div>`;
    const remaining = (c.avail || 0) - res.sums.amt;
    const metric = (label, value, unit, hint, primary = false) => `<div class="krext-al-metric${primary ? ' krext-al-metric-primary' : ''}" title="${esc(hint)}"><span>${label}</span><strong>${esc(value)}<small>${unit}</small></strong></div>`;
    const summary = `<div class="krext-al-summary" tabindex="0" role="region" aria-label="연구수당 지급 요약">${metric('지급 대상', res.n, '명', `${yl} 참여연구원${staff && staff.erpOnly ? '(계획이 없어 rERP 등록 지급계획)' : ''}`)}${metric('집행 가능액', c.avail == null ? '—' : fmtWon(c.avail), '원', '지급비율을 적용할 금액')}${metric('총 지급액', fmtWon(res.sums.amt), '원', `지급비율 합계 ${pctTxt(res.sums.ratio)}%`, true)}${metric(remaining < 0 ? '초과 지급액' : '미배분 잔액', fmtWon(Math.abs(remaining)), '원', remaining === 0 && res.n ? '전액 배분되었습니다' : '집행 가능액 − 총 지급액')}</div>`;
    const inGen = (k, v, title, extra = '') => `<input type="text" class="krext-st-in krext-al-in" data-al="${k}" value="${esc(v)}" title="${esc(title)}" aria-label="${esc({ org: '연구기관명', pool: '연구수당 계상금액 (천원)', avail: '연구수당 집행 가능액 (천원)' }[k])}"${extra}>`;
    const ui = (state.allowUi || {})[key] || {};   // 탭의 과제·연차별 화면 상태(저장 없음) — 접기(data-al-disclosure) · 탭
    const generalOpen = ui.general != null ? ui.general : false;   // 1. 일반 정보 — 기본 접힘(2026-10-21 사용자 "접어줘"), 요약 줄에 과제명 · 계상 · 집행 가능액
    const general = `<details class="krext-al-section krext-al-general-wrap" data-al-disclosure="general"${generalOpen ? ' open' : ''}><summary class="krext-al-h">1. 일반 정보 <small>${esc(p.prjNm || '')}${c.pool != null ? ` · 계상 ${esc(th(c.pool))}천원` : ''}${c.avail != null ? ` · 집행 가능액 ${esc(th(c.avail))}천원` : ''}</small></summary><dl class="krext-al-general">
      <dt>연구과제명</dt><dd class="krext-al-wide">${esc(p.prjNm || '')}</dd>
      <dt>연구기관명</dt><dd>${inGen('org', c.org, '연구기관명 — 별지 2 에 적힘', ' maxlength="40"')}</dd><dt>연구책임자명</dt><dd>${esc(p.rspr || '—')}</dd>
      <dt>당해연도 연구기간</dt><dd>${esc(c.period || '—')}</dd><dt>인건비 계상금액</dt><dd>${c.payTotal != null ? `${esc(th(c.payTotal))}천원` : '—'}</dd>
      <dt>연구수당 계상금액</dt><dd><span class="krext-al-amount">${inGen('pool', c.pool == null ? '' : th(c.pool), `천원 — 비우면 예산 줄의 연구수당${c.poolDefault != null ? ` ${th(c.poolDefault)}천원` : '(없음)'}`, ' inputmode="decimal" placeholder="금액 입력"')}<span>천원</span></span>${entry.pool != null ? '<small>직접 입력</small>' : ''}</dd>
      <dt>연구수당 집행 가능액</dt><dd><span class="krext-al-amount">${inGen('avail', c.avail == null ? '' : th(c.avail), `천원 — 지급액의 기준. 비우면 계상금액 − 집행${c.availDefault != null ? ` = ${th(c.availDefault)}천원` : ''}`, ' inputmode="decimal" placeholder="금액 입력"')}<span>천원</span></span>${entry.avail != null ? '<small>직접 입력</small>' : ''}</dd></dl></details>`;
    const tail = opts.tail || '';   // 카드 끝에 붙이는 HTML — 연구수당 계산 탭의 자료 요청 구역(lib/staff-ui.js allowCard → collectSection)
    if (!staff) return `<div class="krext-ws-card krext-al-card" data-alkey="${esc(key)}">${head}${summary}<div class="krext-ws-body">${general}<div class="krext-sub krext-dim">${esc(yl)} 참여연구원 계획이 아직 없습니다 — <b>참여연구원 변경</b>에서 계획을 세우면 그 참여율로 별지 1 을 셈합니다.</div>${warnHtml(checks(res))}${tail}</div></div>`;
    // 계획 없이 rERP 등록 지급계획으로 셈할 때 별지 위 한 줄(2026-10-23)
    const erpOnlyNote = staff.erpOnly ? `<div class="krext-sub krext-dim krext-al-erponly" role="note" title="참여연구원 변경에서 계획을 세우면 그 참여율로 셈합니다 — 그때는 사람 id 가 바뀌어 여기 적은 부서·항목은 이어지지 않습니다">${esc(yl)} 참여연구원 계획이 아직 없어 rERP 등록 지급계획의 참여율로 셈합니다(이 기간의 등록 — 참여인력 카드가 보이는 것과 같음) — 계획은 <b>참여연구원 변경</b>에서 세웁니다.</div>` : '';
    // 별지 1
    // 연구내용 항목(연구개발계획서 상위 항목) — [평가항목 목록] 의 연구내용 칸 칩. 등급은 [연구내용 분류](도우미가 연결돼 있을 때만) 로 매긴 것(entry.research) — 매기면 기본 포함(모든 연구자에게), 끈 것만 ＋ 항목 추가의 연구내용 묶음에
    const chat = g.KRX_STAFF_CHAT, agentOn = !!(chat && typeof chat.route === 'function' && chat.route());
    const rItems = researchItems(c.rec), rl = entry.research || {}, classified = rItems.filter((x) => LEVELS[rl[x.name]]).length;
    const pl = pickList(entry, c.rec), groups = Array.isArray(entry.groups) ? entry.groups : [], same = (a) => (b) => itemKey(a) === itemKey(b);
    const groupsOf = (nm) => groups.filter((gr) => (gr.items || []).some(same(nm))).map((gr) => gr.name);
    const sharedKeys = new Set(pl.filter((it) => it.on).map((it) => itemKey(it.name)));
    const addSel = (r) => {
      const ak = sharedKeys;
      const rOpts = rItems.filter((x) => LEVELS[rl[x.name]] && !ak.has(itemKey(x.name))).map((x) => `<option value="${esc(`${rl[x.name]}|${x.name}`)}">${esc(rl[x.name])} ${esc(x.name)}</option>`).join('');
      return `<select class="krext-al-sel krext-al-add" data-aladd="${esc(r.id)}" title="성과 항목 더하기 — 지침 1) 의 평가항목(가 50 · 나 30 · 다 10)${rOpts ? ' · 연구내용(연구개발계획서 상위 항목 — 도우미가 매긴 등급)' : ''}. 평가항목 목록에서 포함한 항목은 저절로 들어가 여기에 없습니다 · 개인 항목은 사람마다 ${MAX_ITEMS}개까지" aria-label="${esc(r.name)} 성과 항목 더하기"${r.items.filter((it) => !it.auto).length >= MAX_ITEMS ? ' disabled' : ''}><option value="">＋ 항목 추가…</option>${Object.entries(itemsOf(entry)).map(([lv, names]) => `<optgroup label="${lv} (${LEVELS[lv]}점)">${names.filter((nm) => nm !== '기타' && !ak.has(itemKey(nm))).map((nm) => `<option value="${esc(`${lv}|${nm}`)}">${esc(nm)}</option>`).join('')}<option value="${lv}|">기타(직접 입력)</option></optgroup>`).join('')}${rOpts ? `<optgroup label="연구내용 (${esc(yl)} 연구개발계획서)">${rOpts}</optgroup>` : ''}</select>`;
    };
    const itemRows = (r) => `${r.items.length ? '<div class="krext-al-itemhead" aria-hidden="true"><span>평가항목</span><span>등급</span><span>건수</span><span>가중치</span><span>기여도</span><span></span></div>' : '<p class="krext-al-caption">성과 항목을 추가해 기여도를 입력하세요.</p>'}${r.items.map((it, k) => {
      const tag = it.auto ? (isRequired(it.name) ? '필수' : '포함') : '', ro = it.auto ? ' readonly' : '', gs = it.auto ? groupsOf(it.name) : [];
      const nmTitle = it.auto ? `${tag} 항목 — 평가항목 목록에서 포함한 항목(${gs.length ? `${gs.join(' · ')} 그룹` : '모든 연구자'} · 가중치 1/N). 빼거나 그룹을 바꾸려면 목록에서` : '평가항목 — ＋ 항목 추가에서 고르거나 적습니다';
      return `<div class="krext-al-item${it.auto ? ' krext-al-item-req' : ''}" data-k="${k}"><input type="text" class="krext-st-in krext-al-in krext-al-item-nm" data-ali="name" data-i="${esc(r.id)}" data-k="${k}" value="${esc(it.name)}" placeholder="평가항목 이름" maxlength="80" title="${esc(nmTitle)}" aria-label="${esc(r.name)} 평가항목 ${k + 1}"${ro}><label class="krext-al-item-field"><span>등급</span><select class="krext-al-sel" data-ali="level" data-i="${esc(r.id)}" data-k="${k}" title="난이도 등급 — 가 50 · 나 30 · 다 10" aria-label="${esc(r.name)} 항목 ${k + 1} 등급"${it.auto ? ' disabled' : ''}>${Object.keys(LEVELS).map((lv) => `<option value="${lv}"${it.level === lv ? ' selected' : ''}>${lv}</option>`).join('')}</select></label><label class="krext-al-item-field"><span>건수</span><input type="text" class="krext-st-in krext-al-in krext-al-num" data-ali="count" data-i="${esc(r.id)}" data-k="${k}" value="${esc(String(it.count))}" inputmode="decimal" title="건수" aria-label="${esc(r.name)} 항목 ${k + 1} 건수"${ro}></label><label class="krext-al-item-field"><span>가중치</span><input type="text" class="krext-st-in krext-al-in krext-al-num" data-ali="weight" data-i="${esc(r.id)}" data-k="${k}" value="${esc(String(it.weight))}" inputmode="decimal" title="${it.auto ? '가중치 — 같은 항목을 받는 지급 대상 수로 1/N(제6조②)' : '가중치 — 논문 저자·산업재산권 기준, 그 밖은 참여연구원간 합 1'}" aria-label="${esc(r.name)} 항목 ${k + 1} 가중치"${ro}></label><span class="krext-al-item-field krext-al-score" title="기여도 = 등급 점수 × 건수 × 가중치"><span>기여도</span><b>${esc(r2(it.score))}</b></span>${it.auto ? '<span class="krext-al-req" aria-hidden="true"></span>' : `<button type="button" class="krext-ico-btn krext-al-del" data-act="al-item-del" data-i="${esc(r.id)}" data-k="${k}" aria-label="${esc(r.name)} 평가항목 ${k + 1} 삭제" title="이 항목 빼기">×</button>`}</div>`;
    }).join('')}${addSel(r)}`;
    const rows1 = res.people.filter((r) => !r.admin).map((r) => {
      const pin = (k, v, title, extra = '') => `<input type="text" class="krext-st-in krext-al-in" data-alp="${k}" data-i="${esc(r.id)}" value="${esc(v)}" title="${esc(title)}"${extra}>`;
      const etcSel = `<label><span class="krext-al-caption">협력·소통·적극성</span><select class="krext-al-sel" data-alp="etc" data-i="${esc(r.id)}" title="연구수행 성실성(협력·소통·적극성) — 책임자 평가" aria-label="${esc(r.name)} 기타 평가점수"><option value=""${r.etc == null ? ' selected' : ''}>평가 선택</option>${ETC.map(([v, l]) => `<option value="${v}"${r.etc === Number(v) ? ' selected' : ''}>${l} ${v}</option>`).join('')}</select></label>`;
      return `<article class="krext-al-person${r.target ? '' : ' krext-al-off'}" data-i="${esc(r.id)}" aria-label="${esc(r.name)} 기여도 평가">
        <header class="krext-al-personhead"><div class="krext-al-person-title"><b>${esc(r.name)}</b><span>${esc(S.roleShort(r.role))}</span></div><div class="krext-al-person-fields"><label><span>부서</span>${pin('dept', r.dept, '부서명 — 비우면 rERP 참여인력의 소속 부서', ' maxlength="40" placeholder="부서 입력"')}</label><label><span>직급</span>${pin('grade', r.grade, '직급(기여도평가시점) — 비우면 rERP 참여인력의 직급(없으면 내 HR 직급)', ' maxlength="20" placeholder="직급"')}</label></div><div class="krext-al-person-result"><span>합산 기여도 <strong>${r.target ? esc(pctTxt(r.total)) : '—'}</strong></span>${r.target ? `<b title="평가등급${r.tie ? ' · 동점 상위등급' : ''}">${esc(r.gradeLabel)}</b>` : '<b>제외</b>'}</div></header>
        ${r.target ? `<div class="krext-al-eval-grid"><div class="krext-al-eval-part"><h5>참여도 <span>30%</span></h5><dl class="krext-al-values"><dt>연간 참여율</dt><dd>${r.rate ? esc(S.rateText(r.rate)) : '—'}</dd><dt>환산비율 (a)</dt><dd>${esc(pctTxt(r.a))}</dd></dl></div><div class="krext-al-eval-performance">${itemRows(r)}<div class="krext-al-eval-foot"><span>기여도 합 <b>${esc(r2(r.contrib))}</b></span><span>기여율 (b) <b>${esc(pctTxt(r.b))}</b></span></div><div class="krext-al-subhead" aria-hidden="true">기타 평가</div><div class="krext-al-eval-other">${etcSel}<span class="krext-al-eval-c" title="기타 평가 환산비율"><span class="krext-al-caption">환산비율 (c)</span><b>${esc(pctTxt(r.c))}</b></span></div></div></div>` : `<p class="krext-al-caption">평가·지급 제외 · ${esc(r.reason)}</p>`}
      </article>`;
    }).join('');
    const erpNote = c.erp ? (c.erp.busy ? '<small class="krext-dim" title="부서명·직급 기본값을 이 과제의 rERP 참여인력에서 받는 중">rERP 참여인력 조회 중…</small>' : c.erp.error ? `<small class="krext-err" title="${esc(c.erp.error)}">부서명·직급을 rERP 참여인력에서 못 받음 — 직접 적으세요</small>` : '') : '';
    const classifyBtn = agentOn && rItems.length ? `<button type="button" class="krext-plan-btn krext-al-classify" data-act="al-classify" title="연구개발계획서 ${esc(yl)} 연구내용 상위 항목 ${rItems.length}개를 연구수당 도우미가 별지 1 의 가·나·다 평가항목과 견주어 등급을 매깁니다(채팅으로 요청) — 매긴 항목은 평가항목 목록의 연구내용 칩에 기본 포함(모든 연구자에게)">연구내용 분류 <small>${classified}/${rItems.length}</small></button>` : '';
    const decomposeBtn = `<button type="button" class="krext-plan-btn krext-al-decompose" data-act="al-decompose" title="지금 평가등급대로 기본 성과 항목을 넣습니다 — 1 S: 연구총괄 및 관리(가) · 연구계획서작성(나) / 2 A: 설계,해석 및 검증 S/W 개발(가) · 기준/절차/가이드라인/지침서(나) / 3 B: 알고리즘/제어기술 개발(나) · 기준/절차/가이드라인/지침서(나) / 4·5 C·D: 기준/절차/가이드라인/지침서(나) 하나. 있는 항목은 그대로, 포함 항목 밖 항목은 사람당 3개까지, 같은 항목을 가진 사람 수로 가중치 1/N. 연구내용 항목은 평가항목 목록의 연구내용 칩으로 포함하세요"${res.n ? '' : ' disabled'}>등급별 자동 분해</button>`;
    const rHint = rItems.length && !agentOn && classified < rItems.length ? ' 연구내용 항목의 등급 분류([연구내용 분류])는 연구수당 도우미(에이전트)가 연결돼 있을 때 됩니다.' : '';
    // 필수 3개 → 선택 항목(등급별) → 연구내용 → 적용 그룹. 포함/해제와 그룹 설정은 기존 저장을 그대로 쓴다.
    const il = itemsOf(entry), ilCustom = il !== ITEMS, onCount = pl.filter((it) => it.on).length;
    const wsums = weightSums(res), wbad = wsums.filter((w) => w.bad), wOf = (nm) => wsums.find((w) => w.key === itemKey(nm));   // 머리 줄 "가중치 합" 칩 · 합이 1 이 아닌 칩의 꼬리표
    const people1 = res.people.filter((r) => !r.admin);
    const units = scopeUnits(people1, entry.unions);
    const scopeSelect = (it) => {
      const assigned = groups.map((gr, gi) => (gr.items || []).some(same(it.name)) ? gi : -1).filter((gi) => gi >= 0);
      const selected = assigned.length > 1 ? 'multi' : assigned.length ? `group:${assigned[0]}` : 'all';
      const empty = assigned.length && !people1.some((p) => assigned.some((gi) => (groups[gi].people || []).includes(p.id)));
      return `<div class="krext-al-pick-scope"><span>담당</span><select class="krext-al-sel krext-al-scope-sel" data-alscope="${esc(it.name)}" aria-label="${esc(it.name)} 담당 그룹" title="전체 연구자 또는 이 항목을 전담할 그룹을 선택하세요. 그룹을 지정하면 항목이 포함됩니다."${it.level ? '' : ' disabled'}><option value="all"${selected === 'all' ? ' selected' : ''}>전체 연구자</option>${selected === 'multi' ? `<option value="multi" selected disabled>${esc(assigned.map((gi) => groups[gi].name).join(' + '))}</option>` : ''}${groups.length ? `<optgroup label="전담 그룹">${groups.map((gr, gi) => `<option value="group:${gi}"${selected === `group:${gi}` ? ' selected' : ''}>${esc(gr.name)} (${people1.filter((p) => (gr.people || []).includes(p.id)).length}명)</option>`).join('')}</optgroup>` : ''}${units.length ? `<optgroup label="부서·배정 그룹에서 만들기">${units.map((unit, i) => `<option value="unit:${i}">${esc(unit.name)} (${unit.people.length}명)</option>`).join('')}</optgroup>` : ''}<option value="new"${groups.length >= 20 ? ' disabled' : ''}>＋ 새 전담 그룹</option></select>${empty ? '<small class="krext-al-scope-note">연구자 선택 필요</small>' : ''}</div>`;
    };
    const pickChip = (it) => {
      const gs = groupsOf(it.name), req = isRequired(it.name);
      const tip = !it.level ? '분류 전 — [연구내용 분류] 로 등급을 매기면 포함할 수 있습니다' : it.on ? `포함 — ${gs.length ? `${gs.join(' · ')} 그룹 사람` : '모든 연구자'}에게 저절로 들어갑니다(가중치 1/N). 누르면 뺍니다` : `누르면 포함합니다(모든 연구자 또는 그룹 사람에게 저절로)${req ? ' — 필수 항목' : ''}`;
      const label = it.name === '연구계획서작성(선정평가포함)' ? '연구계획서 작성·선정평가' : it.name;
      const w = wOf(it.name);
      const meta = (req ? '<small class="krext-al-pick-required-tag">필수</small>' : it.src === 'research' ? `<small>${it.level ? '연구내용' : '분류 대기'}</small>` : '') + (w && w.bad ? `<small class="krext-al-pick-wbad" title="참여연구원간 가중치 합 ${r2(w.sum)} — 1 이어야 합니다(제6조②)">합 ${r2(w.sum)}</small>` : '');
      return `<div class="krext-al-pickwrap"${it.src === 'research' ? ` draggable="true" data-ritem="${esc(it.name)}"` : ''}><div class="krext-al-pick-main"><button type="button" class="krext-al-pick${it.on ? ' krext-al-pick-on' : ''}" data-act="al-pick" data-nm="${esc(it.name)}" aria-pressed="${it.on ? 'true' : 'false'}" aria-label="${esc(it.name)}${req ? ' · 필수' : ''}${it.level ? ` · ${it.level} ${LEVELS[it.level]}점` : ' · 분류 대기'}" title="${esc(tip)}"${it.level ? '' : ' disabled'}><span class="krext-al-pick-check" aria-hidden="true">${it.on ? '✓' : ''}</span><span class="krext-al-pick-label">${esc(label)}</span>${meta ? `<span class="krext-al-pick-meta">${meta}</span>` : ''}</button>${it.src === 'research' && it.level ? `<select class="krext-al-sel krext-al-pick-lv" data-alrl="${esc(it.name)}" title="연구내용 항목의 난이도 등급" aria-label="${esc(it.name)} 등급">${Object.keys(LEVELS).map((lv) => `<option value="${lv}"${it.level === lv ? ' selected' : ''}>${lv}</option>`).join('')}</select>` : ''}${scopeSelect(it)}${it.src === 'list' && !req ? `<button type="button" class="krext-ico-btn krext-al-pick-x" data-act="al-pick-del" data-nm="${esc(it.name)}" title="목록에서 빼기" aria-label="${esc(it.name)} 목록에서 빼기">×</button>` : '<span class="krext-al-pick-x" aria-hidden="true"></span>'}</div></div>`;   // 칩은 모두 한 줄(✓ 이름 · (연구내용은 등급 칸) · 담당 · ×) — 2026-10-21 사용자 "이걸 한줄로 해줘. 2줄은 너무 길다". 필수도 따로 나누지 않고 그 등급 열에 기본 체크(사용자 "필수항목은 초기화 때 체크되어 있으라는 거지… 나누라는 건 아냐")
    };
    const pickCol = (list, lv) => `<div class="krext-al-pickcol" data-level="${lv}"><div class="krext-al-pickcol-head"><b>${lv}</b><span>${LEVELS[lv]}점</span><small>${list.filter((it) => it.on).length}/${list.length} 선택</small></div><div class="krext-al-pickrow">${list.map(pickChip).join('') || '<small class="krext-dim">추가한 항목이 없습니다.</small>'}</div><div class="krext-al-pick-add"><input type="text" class="krext-st-in krext-al-pick-new" data-alnew="${lv}" placeholder="새 항목 이름" maxlength="60" aria-label="${lv} 등급 항목 추가" title="항목 이름을 적고 Enter 또는 추가"><button type="button" class="krext-al-pick-add-btn" data-act="al-pick-add" data-level="${lv}" aria-label="${lv} 등급 새 항목 추가">＋ 추가</button></div></div>`;
    const pickCols = Object.keys(LEVELS).map((lv) => pickCol(pl.filter((it) => it.level === lv), lv)).join('');
    const required = pl.filter((it) => isRequired(it.name)), requiredOn = required.filter((it) => it.on).length;
    const rWait = pl.filter((it) => it.src === 'research' && !it.level);   // 분류 전만 여기 — 분류된 연구내용은 위 등급 열의 칩(연구내용 꼬리표, 끌어 다른 열에 놓으면 등급이 바뀜). 2026-10-21 사용자 "연구내용도 위 선택항목으로 들어가게 해줘. 표시만 하면 되잖아. … 드래그로 위치 변경할 수 있게"
    const researchHtml = rWait.length ? `<section class="krext-al-research-picks"><div class="krext-al-block-head"><h4>연구내용 <span>${classified}/${rItems.length} 분류</span>${info(`${yl} 연구개발계획서의 연구내용 상위 항목 — [연구내용 분류](연구수당 도우미)로 가·나·다 등급을 매기면 기본 포함됩니다(분류 전은 못 켬, 칩 옆 등급 칸이나 끌어 놓기로 바꿀 수 있음). 분류된 항목은 위 등급 열에 보입니다.${classified < rItems.length ? agentOn ? ' 위의 연구내용 분류 버튼으로 분류하세요.' : ' 에이전트를 연결해 등급을 분류하세요.' : ''}`)}</h4></div><div class="krext-al-pickrow">${rWait.map(pickChip).join('')}</div></section>` : '';
    const tog = (on, act, data, label, tip) => `<button type="button" class="krext-al-pick${on ? ' krext-al-pick-on' : ''}" data-act="${act}" ${data} aria-pressed="${on ? 'true' : 'false'}" title="${esc(tip)}">${esc(label)}</button>`;
    const groupsHtml = `<div class="krext-al-groups"><div class="krext-al-groups-h"><div><h4>전담 그룹 <span>${groups.length}</span>${info(`각 항목의 담당에서 전담 그룹을 선택하세요. 부서·배정 그룹을 가져오거나 새 그룹을 만들어 담당 연구자를 고를 수 있습니다. 전체 연구자는 모두에게 적용하며, 가중치는 담당 그룹의 지급 대상 인원으로 나눕니다.`)}</h4></div><button type="button" class="krext-plan-btn" data-act="al-group-add" title="사람과 항목을 고르는 그룹을 더합니다"${groups.length >= 20 ? ' disabled' : ''}>＋ 전담 그룹 추가</button></div>${groups.map((gr, gi) => { const inG = (nm) => (gr.items || []).some(same(nm)), has = (id) => (gr.people || []).includes(id); return `<div class="krext-al-group" data-gi="${gi}"><div class="krext-al-group-h"><input type="text" class="krext-st-in krext-al-in" data-algname="${gi}" value="${esc(gr.name)}" maxlength="40" aria-label="그룹 이름" title="그룹 이름"><small>${people1.filter((r) => has(r.id)).length}명 · ${pl.filter((it) => it.on && inG(it.name)).length}개 항목</small><button type="button" class="krext-ico-btn" data-act="al-group-del" data-gi="${gi}" title="그룹 지우기 — 그 항목은 다시 모든 연구자에게" aria-label="${esc(gr.name)} 그룹 지우기">×</button></div>${(gr.items || []).length && !people1.some((r) => has(r.id)) ? '<p class="krext-al-group-alert">연구자 선택 필요 · 아래에서 이 항목을 전담할 연구자를 선택하세요.</p>' : ''}<div class="krext-al-group-row"><span>연구자</span><div class="krext-al-group-options">${people1.map((r) => tog(has(r.id), 'al-group-person', `data-gi="${gi}" data-i="${esc(r.id)}"`, r.name, `${r.name} — 누르면 그룹에${has(r.id) ? '서 뺍니다' : ' 넣습니다'}`)).join('') || '<small class="krext-dim">연구자가 없습니다</small>'}</div></div><div class="krext-al-group-row"><span>적용 항목</span><div class="krext-al-group-options">${pl.filter((it) => it.on).map((it) => tog(inG(it.name), 'al-group-item', `data-gi="${gi}" data-nm="${esc(it.name)}"`, it.name, `${it.name} — 누르면 이 그룹에${inG(it.name) ? '서 뺍니다(다른 그룹에도 없으면 모든 연구자에게)' : ' 넣습니다(이 그룹 사람에게만)'}`)).join('') || '<small class="krext-dim">포함한 항목이 없습니다</small>'}</div></div></div>`; }).join('')}</div>`;
    const itemList = `<details class="krext-al-itemlist" data-al-disclosure="itemlist"${ui.itemlist !== false ? ' open' : ''}><summary><span class="krext-al-itemlist-heading"><b>평가항목 목록</b><small>공통 항목 선택 및 적용 대상 설정</small></span><span class="krext-al-itemlist-summary"><span class="krext-al-stat">포함 <b>${onCount}</b></span><span class="krext-al-stat">필수 <b>${requiredOn}/${REQUIRED.length}</b></span><span class="krext-al-stat">그룹 <b>${groups.length}</b></span><span class="krext-al-stat${wbad.length ? ' krext-al-stat-warn' : ''}" title="${esc(wsums.length ? `사용한 평가항목(논문·특허 제외) ${wsums.length}개의 참여연구원간 가중치 합 — 1 이어야 합니다(제6조②)\n${wsums.map((w) => `${w.name} ${r2(w.sum)}${w.bad ? ' !' : ''}`).join('\n')}` : '지급 대상 카드에 평가항목이 아직 없습니다')}">가중치 합 <b>${wbad.length ? `≠1 ${wbad.length}` : wsums.length ? '1' : '—'}</b></span></span></summary><div class="krext-al-itemlist-body"><section class="krext-al-optional"><div class="krext-al-block-head"><h4>등급별 항목${info(`지침 1) 평가항목(점수배분)은 연구책임자가 연구특성에 따라 추가할 수 있음 — 가 50 · 나 30 · 다 10점. 고른 항목은 전체 연구자 또는 지정한 담당 그룹에게(가중치 1/N), 개인별 항목은 아래 연구자 카드의 ＋ 항목 추가에서.`)}</h4></div><div class="krext-al-picks">${pickCols}</div></section>${researchHtml}${groupsHtml}<div class="krext-al-itemlist-footer"><small>${ilCustom ? '사용자 편집 목록' : '지침 기본 목록'} · 과제·연차별 저장</small><button type="button" class="krext-plan-btn" data-act="al-items-default" title="지침 1) 의 기본 목록으로 되돌림(포함·그룹은 그대로)"${ilCustom ? '' : ' disabled'}>지침 기본값</button></div></div></details>`;
    const t1 = `<section class="krext-al-section"><h4 class="krext-al-h">3. 평가 내용 <small>별지 1 · 연구수행 기여도 평가서</small>${info(`별지 1) 합산 기여도 = 참여도(a) × 30% + 성과(b) × 60% + 기타(c) × 10%. a = 참여율 ÷ 참여율 합 × 100, b = 성과 기여도 합 ÷ 전체 × 100(기여도 = 등급 점수 가 50 · 나 30 · 다 10 × 건수 × 가중치 — 논문은 저자, 산업재산권은 발명자 기준, 그 밖은 참여연구원간 합 1), c = 기타(우수 100 · 양호 75 · 보통 50 · 미흡 25) ÷ 합 × 100. 포함 항목(평가항목 목록에서 켠 것 — 기본은 필수 항목과 분류된 연구내용)은 가중치 1/N 로 저절로 들어가고 나머지는 ＋ 항목 추가에서 고릅니다.${rHint}`)}${erpNote}${decomposeBtn}${classifyBtn}</h4>${itemList}<div class="krext-al-evaluations krext-al-t1">${rows1}</div><div class="krext-al-eval-total"><span>평가 합계</span><span>참여도 (a) <b>${res.n ? esc(pctTxt(res.sums.a)) : '—'}</b></span><span>성과 (b) <b>${res.n ? esc(pctTxt(res.sums.b)) : '—'}</b></span><span>기타 (c) <b>${res.n ? esc(pctTxt(res.sums.c)) : '—'}</b></span><span>합산 기여도 <b>${res.n ? esc(pctTxt(res.sums.total)) : '—'}</b></span></div></section>`;
    // 별지 2
    const canMerge = res.n >= 5;
    const groupTxt = res.groups.map((gr) => `${gr.label} ${r2(gr.share)}%${gr.members.length ? ` (${gr.members.length}명 · 1인 ${pctTxt(gr.perHead)}%)` : ' (0명)'}`).join(' · ');
    const settingsOpen = !!ui.settings;   // 기본 접힘(2026-10-21 밤 사용자 "접어줘. 기본적인 설명은 필요 없음") — 요약 줄에는 지금 설정만, 지침은 ⓘ
    const setTxt = [res.merge.sa ? 'S+A 통합' : '', res.merge.cd ? 'C+D 통합' : ''].concat(GRADES.filter((k) => res.adjust[k]).map((k) => `${k} ${res.adjust[k] > 0 ? '+' : ''}${res.adjust[k]}%p`)).filter(Boolean).join(' · ');
    const opts2 = `<details class="krext-al-settings" data-al-disclosure="settings"${settingsOpen ? ' open' : ''}><summary>등급 통합·비율 조정 <small>${esc(setTxt)}</small>${info(`별지 2) 참여연구원 5명 이상이면 S+A · C+D 를 통합할 수 있고(지급비율은 두 등급 몫의 합), 연구책임자는 등급간 지급비율을 ±10%p 범위에서 제로섬으로 조정할 수 있습니다(등급별 최소 3%, 하위등급 1인 지급액 ≤ 상위등급 1인).`)}</summary><div class="krext-al-opts" aria-label="등급 통합·조정">
      <label title="참여연구원 5명 이상일 때 S 와 A 를 한 등급으로(지급비율은 두 등급 몫의 합)"><input type="checkbox" data-al="merge-sa"${res.merge.sa ? ' checked' : ''}${canMerge ? '' : ' disabled'}> S+A 통합</label>
      <label title="참여연구원 5명 이상일 때 C 와 D 를 한 등급으로"><input type="checkbox" data-al="merge-cd"${res.merge.cd ? ' checked' : ''}${canMerge ? '' : ' disabled'}> C+D 통합</label>
      <span class="krext-al-adj" title="연구책임자가 등급간 지급비율을 최대 10%p 범위에서 제로섬으로 조정 — 등급 몫(%)에 더하는 값">등급 조정 ${GRADES.map((k) => `<label>${k} <input type="text" class="krext-st-in krext-al-in krext-al-num" data-al="adj-${k}" value="${res.adjust[k] ? esc(String(res.adjust[k])) : ''}" inputmode="decimal" placeholder="0" aria-label="${k} 등급 지급비율 조정 (%p)"></label>`).join('')}<small>%p · 조정 합계 0 유지</small></span>
      <span class="krext-al-groups" title="참여 연구원 ${res.n}명의 등급별 몫(별지 2 배분기준) — 등급 안에서는 인원수로 나눕니다">${esc(groupTxt)}</span></div></details>`;
    const lockedOf = (r) => res.byDept && res.depts.some((d) => d.done && d.people.includes(r));   // 확정된 부서의 사람 — 등급을 못 옮김
    // 잔여 한도 열 — cap(응답 · HR) · 여유/초과 · 초과면 ↓ 가능(낮춰도 한도를 채우는 가장 낮은 등급). 모르면 — (아래 자료 요청으로)
    const capCell = (r) => {
      if (r.cap == null) return '<span class="krext-dim" title="남은 연구수당을 모릅니다 — 아래 자료 요청으로 팀즈에 물어보면 여기에 들어옵니다(내 것은 HR 급여)">—</span>';
      const base = `<span class="krext-al-capval" title="올해 남은 연구수당 — ${r.capSrc === '응답' ? '자료 요청 응답' : '내 HR 급여'}">${esc(fmtWon(r.cap))}<small>${esc(r.capSrc)}</small></span>`;
      if (!r.over) return `${base}<small class="krext-al-caproom" title="한도 − 지급액">여유 ${esc(fmtWon(r.room))}</small>`;
      return `${base}<small class="krext-al-capover" title="지급액 − 한도 — 초과분은 예산변경·계속비 편성 또는 반납(제6조④)">초과 ${esc(fmtWon(r.over))}</small>${r.down ? `<span class="krext-al-capflag" title="${esc(r.down)} 등급으로 낮춰도(1인 기준 ${esc(fmtWon(r.downAmt))}원) 한도를 채울 수 있어 초과분을 다른 사람에게 돌릴 수 있습니다 — 평가등급 칸이나 아래 등급 칸에서 옮기세요">↓ ${esc(r.down)} 가능</span>` : ''}`;
    };
    const sumOver = res.people.reduce((s, r) => s + (r.target ? r.over : 0), 0);
    const rows2 = res.people.filter((r) => !r.admin).map((r) => {
      const off = r.target ? '' : ' krext-al-off';
      const rankSel = `<select class="krext-al-sel krext-al-rank" data-alp="rank" data-i="${esc(r.id)}" title="평가등급 — 고르면 수동 배정([등급 배정] 탭에서 끌어 놓아도 됩니다)"${lockedOf(r) ? ' disabled' : ''}>${res.groups.map((gr) => `<option value="${esc(gr.keys[0])}"${gr.label === r.gradeLabel ? ' selected' : ''}>${esc(gr.label)}</option>`).join('')}</select>`;
      return `<tr class="krext-al-row${off}" data-i="${esc(r.id)}"><td>${esc(r.dept)}</td><td class="krext-st-nm">${esc(r.name)}</td><td>${esc(r.grade)}</td><td class="krext-num">${r.target ? esc(pctTxt(r.total)) : '—'}</td><td class="krext-num krext-al-gr">${r.target ? rankSel : '—'}</td>
        <td class="krext-al-note"><div><label class="krext-al-out" title="미지급(퇴직·휴직·병가·연수·파견·참여연구원 변경·연구성과 미기여 등) — 켜면 등급·지급에서 빼고 사유만 적습니다"><input type="checkbox" data-alp="out" data-i="${esc(r.id)}"${r.out ? ' checked' : ''}${r.rate > 0 ? '' : ' disabled'}> 미지급</label><input type="text" class="krext-st-in krext-al-in krext-al-note-in" data-alp="note" data-i="${esc(r.id)}" value="${esc(r.note)}" maxlength="200" placeholder="${r.out ? '미지급 사유' : '기여내용'}" aria-label="${esc(r.name)} 기여내용 및 미지급 사유" title="기여내용 및 미지급 사유 — ${esc(UNPAID)}"></div></td>
        <td class="krext-num">${r.target ? esc(pctTxt(r.ratio)) + '%' : '—'}</td><td class="krext-num krext-al-amt"><strong>${r.target ? esc(fmtWon(r.amt)) : '—'}</strong></td><td class="krext-num krext-al-cap">${r.target ? capCell(r) : '—'}</td></tr>`;
    }).join('');
    // 등급 칸 — [등급 배정] 탭. 전체 또는(부서별) 고른 부서 탭의 사람을 등급 열(1 S … 5 D)에 두고 이름을 끌어 옮긴다
    const dtab = res.byDept ? (res.depts.find((d) => d.name === ((state.allowDept || {})[key] || '')) || res.depts[0] || null) : null;
    const scope = dtab ? dtab.people : res.people.filter((r) => r.target);
    const locked = !!(dtab && dtab.done);
    // 칩의 한도 표시 — 초과인데 낮춰도 한도를 채우면 ↓(그 등급), 낮추면 못 채우면 !(초과만) (2026-10-21 사용자 "김거화 내릴 수 있으면 내릴 수 있다고 -> 이 아이콘을 넣던지")
    const capMark = (r) => (!r.over ? '' : r.down ? `<b class="krext-al-chipdown" title="${esc(r.down)} 등급으로 낮춰도(1인 기준 ${esc(fmtWon(r.downAmt))}원) 한도를 채웁니다 — 초과 ${esc(fmtWon(r.over))}원">↓${esc(r.down)}</b>` : `<b class="krext-al-chipover" title="한도 초과 ${esc(fmtWon(r.over))}원 — 한 등급만 낮춰도 한도에 못 미칩니다">!</b>`);
    const sel = new Set(((state.allowSel || {})[key]) || []);   // 눌러 고른 칩(여럿 끌기)
    const chip = (r) => `<div class="krext-al-chip${locked ? ' krext-al-locked' : ''}${sel.has(r.id) ? ' krext-al-chip-sel' : ''}" draggable="${locked ? 'false' : 'true'}" data-i="${esc(r.id)}"${locked ? '' : ` aria-pressed="${sel.has(r.id) ? 'true' : 'false'}"`} title="${esc(r.name)} — 합산기여도 ${pctTxt(r.total)}${r.rank ? ' · 수동' : ''}${locked ? ' · 확정됨' : ''}${r.over ? ` · 한도 초과 ${fmtWon(r.over)}원${r.down ? ` (↓ ${r.down} 가능)` : ''}` : ''}">${esc(r.name)}${capMark(r)}<small>${esc(pctTxt(r.total))}</small></div>`;
    const cols = res.groups.map((gr) => {
      const members = gr.members.filter((r) => scope.includes(r)), slots = dtab ? dtab.slots[gr.key] : gr.count0;
      const cls = members.length > slots ? ' krext-al-over' : members.length < slots ? ' krext-al-under' : '';
      return `<div class="krext-al-col${cls}" data-grp="${esc(gr.keys[0])}" title="${esc(gr.label)} 등급 — 인원 배분 기준 ${slots}명 · 몫 ${r2(gr.share)}% · 1인 ${pctTxt(gr.perHead)}%"><div class="krext-al-colhead"><span class="krext-al-colno">${gr.keys.map((k) => GRADES.indexOf(k) + 1).join('·')}</span><b>${esc(gr.label)}</b><span class="krext-al-colcnt" title="배정 인원 / ${dtab ? '이 부서의 자리(고칠 수 있음)' : '인원 배분 기준'}">${members.length}/${dtab ? `<input type="text" class="krext-al-slot-in" data-alq="${esc(gr.key)}" data-d="${esc(dtab.name)}" value="${slots}" inputmode="numeric" aria-label="${esc(dtab.label)} 의 ${esc(gr.label)} 등급 자리" title="${esc(dtab.label)} 의 ${esc(gr.label)} 등급 자리 — 고치면 [부서별 배정] 표에도 같이(열 합은 인원 배분 기준에 맞아야 함)">` : slots}명</span></div><div class="krext-al-chips">${members.length ? members.map(chip).join('') : `<span class="krext-al-empty">${slots ? '이름을 여기에 놓으세요' : '배정 인원 없음'}</span>`}</div></div>`;
    }).join('');
    // 자리 동그라미(2026-10-21 사용자 "sabcd 쉽게 분석할 수 있게 우측 갯수 만큼 동그라미칸을 그려넣어줘. 2줄로 하면 될듯") — max(자리, 배정)개를 두 줄(열 = 올림(n/2))로: 배정된 자리 ● 파랑, 빈 자리 ○, 자리보다 많은 배정 ● 빨강
    const dots = (slots, actual, tip) => { const n = Math.max(slots, actual); return n ? `<span class="krext-al-dots" title="${esc(tip)}" style="--krx-cols:${Math.ceil(n / 2)}" aria-hidden="true">${Array.from({ length: n }, (_, i) => (i < Math.min(slots, actual) ? '<i class="krext-al-dot-on"></i>' : i < slots ? '<i></i>' : '<i class="krext-al-dot-over"></i>')).join('')}</span>` : ''; };
    const slotsTbl = res.byDept ? `<table class="krext-cards krext-st-table krext-al-slots" aria-label="부서별 등급 인원"><thead><tr><th>부서</th>${res.groups.map((gr) => `<th class="krext-num">${esc(gr.label)}</th>`).join('')}<th class="krext-num" title="등급 자리 합 / 사람 수">계</th></tr></thead><tbody>${res.depts.map((d) => { const s = res.groups.reduce((a, gr) => a + d.slots[gr.key], 0); return `<tr class="krext-al-unit" data-unit="${esc(d.name)}"><td class="krext-al-dept" draggable="true" data-unitdrag="${esc(d.name)}" title="${esc(d.title)} — 끌어 다른 부서 줄에 놓으면 한 그룹으로 합쳐 자리를 같이 씁니다">${esc(d.label)}${d.done ? ' ✓' : ''}${d.names.length > 1 ? `<button type="button" class="krext-ico-btn krext-al-split" data-act="al-split" data-d="${esc(d.name)}" title="그룹을 풀어 부서별로" aria-label="${esc(d.label)} 그룹 분리">분리</button>` : ''}</td>${res.groups.map((gr) => `<td class="krext-num krext-al-slotcell"><span class="krext-al-stepper"><button type="button" class="krext-al-step" data-act="al-slot" data-d="${esc(d.name)}" data-g="${esc(gr.key)}" data-dir="-1" aria-label="${esc(d.label)} ${esc(gr.label)} 자리 하나 줄이기" title="하나 줄이기"${d.slots[gr.key] > 0 ? '' : ' disabled'}>−</button><input type="text" class="krext-st-in krext-al-in krext-al-num" data-als="${esc(gr.key)}" data-d="${esc(d.name)}" value="${d.slots[gr.key]}" inputmode="numeric" title="${esc(d.label)} 의 ${esc(gr.label)} 등급 자리 — 기본 ${d.slots0[gr.key]}명(자동 배당)"><button type="button" class="krext-al-step" data-act="al-slot" data-d="${esc(d.name)}" data-g="${esc(gr.key)}" data-dir="1" aria-label="${esc(d.label)} ${esc(gr.label)} 자리 하나 늘리기" title="하나 늘리기">+</button></span>${dots(d.slots[gr.key], d.actual[gr.key], `${d.label} ${gr.label} — 자리 ${d.slots[gr.key]} · 배정 ${d.actual[gr.key]}`)}${d.actual[gr.key] !== d.slots[gr.key] ? `<small class="krext-al-fitbad" title="지금 이 등급에 배정된 사람 수 — 자리와 다릅니다">배정 ${d.actual[gr.key]}</small>` : ''}</td>`).join('')}<td class="krext-num${s !== d.n ? ' krext-err' : ''}">${s}/${d.n}</td></tr>`; }).join('')}</tbody><tfoot><tr><td title="부서 합 / 인원 배분 기준">계 / 기준</td>${res.groups.map((gr) => { const s = res.depts.reduce((a, d) => a + d.slots[gr.key], 0); return `<td class="krext-num${s !== gr.count0 ? ' krext-err' : ''}"${s < gr.count0 ? ` title="남은 자리 ${gr.count0 - s}명 — + 로 부서에 더하세요"` : s > gr.count0 ? ' title="인원 배분 기준을 넘었습니다"' : ''}>${s}/${gr.count0}${dots(gr.count0, s, `${gr.label} — 기준 ${gr.count0} · 자리 합 ${s}`)}</td>`; }).join('')}<td class="krext-num">${res.n}</td></tr></tfoot></table>` : '';
    const tabs = res.byDept ? `<div class="krext-al-tabs" role="tablist" aria-label="부서">${res.depts.map((d) => { const on = dtab && d.name === dtab.name; return `<button type="button" role="tab" class="krext-al-tab${on ? ' krext-al-tab-on' : ''}" data-act="al-dtab" data-d="${esc(d.name)}" title="${esc(d.title)} — ${d.n}명${d.done ? ' · 확정' : ''}" aria-selected="${on ? 'true' : 'false'}">${esc(d.label)}<small>${d.n}</small>${d.done ? '<span class="krext-al-done">✓</span>' : ''}${d.fit.length || d.rowBad ? `<b class="krext-al-alert" title="재조정 필요 — ${esc([d.fit.length ? `자리와 배정이 다름: ${d.fit.join(' · ')}` : '', d.rowBad ? '등급 자리 합이 사람 수와 다름' : ''].filter(Boolean).join(' · '))}">!</b>` : ''}</button>`; }).join('')}</div>` : '';
    const scopeManual = dtab ? dtab.people.some((r) => !!r.rank) : res.manual;
    const board = res.n ? `<div class="krext-al-boardwrap">${tabs}<div class="krext-al-board" aria-label="평가등급 배정 — 이름을 끌어 등급 칸에 놓습니다">${cols}</div><div class="krext-al-boardfoot">${scopeManual ? '<span class="krext-al-manual">수동 배정</span>' : '<span class="krext-dim">합산기여도 순(자동)</span>'}${dtab ? `<button type="button" class="krext-plan-btn${dtab.done ? '' : ' krext-plan-save'}" data-act="al-done" data-d="${esc(dtab.name)}" title="${dtab.done ? '확정을 풀어 다시 옮길 수 있게' : '이 부서의 등급을 지금 그대로 확정 — 다른 부서를 바꿔도 안 움직임'}">${dtab.done ? '확정 해제' : '확정'}</button>` : ''}<button type="button" class="krext-plan-btn" data-act="al-auto"${dtab ? ` data-d="${esc(dtab.name)}"` : ''} title="끌어 놓은 등급을 지우고 합산기여도 순으로${dtab ? ' — 이 부서만(확정도 풀림)' : ''}"${scopeManual || locked ? '' : ' disabled'}>자동</button></div></div>` : '';
    // 부서별 배정 — 등급 자리 표(기본 = 자동 배당(똑같이 나누고 나머지는 차례로), −/+ 또는 칸으로 조율, [자동 배정] 이 고친 칸·끌어 놓은 등급·확정을 모두 지움)
    const custom = res.byDept && res.depts.some((d) => d.custom);
    const touched = custom || res.manual || res.depts.some((d) => d.done);   // [자동 배정] 이 되돌릴 것이 있음
    const slotsPane = res.byDept ? `<div class="krext-al-slot-scroll" tabindex="0" role="region" aria-label="부서별 등급 인원 조율">${slotsTbl}</div><div class="krext-al-boardfoot">${custom ? '<span class="krext-al-manual">조율함</span>' : '<span class="krext-dim">자동 배당(똑같이 나누고 나머지는 차례로)</span>'}<button type="button" class="krext-plan-btn" data-act="al-slots-auto" title="고친 칸과 끌어 놓은 등급·확정을 모두 지우고 자동 배당부터 다시"${touched ? '' : ' disabled'}>자동 배정</button></div>` : '';
    const payPane = `<div class="krext-ws-table-scroll" tabindex="0" role="region" aria-label="연구수당 지급 내역 — 좁은 화면에서는 좌우로 스크롤"><table class="krext-cards krext-st-table krext-al-table krext-al-t2"><thead><tr><th>부서명</th><th class="krext-st-nm">성명</th><th>직급</th><th class="krext-num" title="별지 1 의 합산 기여도">기여도</th><th class="krext-num">평가등급</th><th>기여내용 및 미지급 사유</th><th class="krext-num" title="등급 몫 ÷ 등급 인원">지급비율</th><th class="krext-num krext-al-amt" title="원 — 집행 가능액 × 지급비율">지급액(원)</th><th class="krext-num krext-al-cap" title="원 — 올해 남은 연구수당(자료 요청 응답 · 내 HR 급여)과 여유/초과. 초과면 낮춰도 한도를 채우는 등급을 ↓ 가능으로 — 모르는 사람은 아래 자료 요청으로">잔여 한도(원)</th></tr></thead>
      <tbody>${rows2}</tbody><tfoot><tr><td colspan="6">총 지급액</td><td class="krext-num">${res.n ? esc(pctTxt(res.sums.ratio)) + '%' : '—'}</td><td class="krext-num krext-al-amt"><strong>${esc(fmtWon(res.sums.amt))}</strong></td><td class="krext-num krext-al-cap">${sumOver ? `<small class="krext-al-capover" title="한도 초과분 합 — 여유가 있는 사람에게 돌리거나 반납">초과 합 ${esc(fmtWon(sumOver))}</small>` : ''}</td></tr></tfoot></table></div><p class="krext-al-scroll-hint">↔ 표를 좌우로 밀어 지급비율과 금액을 확인하세요.</p>`;
    // 2 절은 탭 — [등급 배정](기본) · (byDept) [부서별 배정] · [지급 내역]. 안 고른 판도 그려 두고 hidden — 입력 뒤 다시 그릴 때 초점·스크롤 복원이 같은 길
    const tab = ui.tab === 'pay' || (ui.tab === 'slots' && res.byDept) ? ui.tab : 'board';
    const al = res.deptAlert || { cols: [], depts: [] }, alTip = [al.cols.length ? `열 합이 인원 배분 기준과 다름: ${al.cols.join(', ')}` : '', al.depts.length ? `자리와 배정이 다르거나 줄 합이 틀린 부서: ${al.depts.join(', ')}` : ''].filter(Boolean).join(' · ');
    const tabDefs = [['board', '등급 배정']].concat(res.byDept ? [['slots', `부서별 배정${alTip ? `<b class="krext-al-alert" title="재조정 필요 — ${esc(alTip)}">!</b>` : ''}`]] : [], [['pay', '지급 내역']]);
    const tabBar = `<div class="krext-al-subtabs" role="tablist" aria-label="등급 배정·지급 내역">${tabDefs.map(([k, label]) => `<button type="button" role="tab" class="krext-al-subtab${tab === k ? ' krext-al-subtab-on' : ''}" data-act="al-tab" data-tab="${k}" aria-selected="${tab === k ? 'true' : 'false'}">${label}</button>`).join('')}<label title="부서마다 탭을 두고 등급 자리를 부서별로 나눠(기본은 부서 인원에 비례한 자동 배당) 부서 안에서 끌어 놓습니다 — 부서별로 확정할 수 있음"><input type="checkbox" data-al="bydept"${res.byDept ? ' checked' : ''}> 부서별</label></div>`;
    const pane = (k, inner) => `<div class="krext-al-pane" data-tab="${k}"${tab === k ? '' : ' hidden'}>${inner}</div>`;
    const t2 = `<section class="krext-al-section"><h4 class="krext-al-h">2. 등급 배정·지급 내역 <small>별지 2 · 연구수당 지급 내역서</small>${info(`별지 1 주석 5) 평가등급은 합산 기여도 순으로 참여 연구원 수별 인원 배분 기준(S 10% · A 20% · B 40% · C 20% · D 10%)대로 S/A/B/C/D, 동점은 상위등급. 별지 2) 지급비율 = 등급 몫 ÷ 등급 인원, 지급액 = 집행 가능액 × 지급비율(원 절삭). 개인 연간 총액은 기본연봉 × 직급 비율(P1 18 · P2 20 · P3 22 · P4 24 · G/C 22%)을 넘을 수 없고 초과분은 예산변경·반납. 조작: [등급 배정]에서 이름을 끌어 등급을 바꿉니다(지급 내역의 등급 칸도 같음) — 칸의 숫자는 배정 인원 / 기준 인원, 이름을 누르면 골라져 여럿을 한꺼번에 끌 수 있습니다. 부서별이면 부서 탭에서 끌고 확정하며, 등급 자리 수는 [부서별 배정] 표에서 −/+ 또는 칸으로 조율합니다(열 합 = 인원 배분 기준, 줄 합 = 부서 사람 수, 부서 이름을 끌어 합치고 [분리]로 풂).`)}</h4>${tabBar}${pane('board', board)}${res.byDept ? pane('slots', slotsPane) : ''}${pane('pay', payPane)}${opts2}</section>`;
    const msg = state.allowMsg && state.allowMsg.key === key ? `<div class="krext-sub krext-st-msg${state.allowMsg.error ? ' krext-err' : ''}" role="status">${esc(state.allowMsg.text)}</div>` : '';
    const warnings = checks(res);
    const review = warnings.length ? `<section class="krext-al-checks"><h4 class="krext-al-h">확인 사항 <small>${warnings.length}건</small></h4>${warnHtml(warnings)}</section>` : '';
    return `<div class="krext-ws-card krext-al-card" data-alkey="${esc(key)}">${head}${summary}<div class="krext-ws-body">${general}${erpOnlyNote}${t2}${t1}${review}${msg}${tail}</div></div>`;
  }
  const warnHtml = (warns) => (warns.length ? `<ul class="krext-st-warn">${warns.map((w) => `<li class="krext-st-${w.level === 'info' ? 'note' : w.level}">${esc(w.text)}</li>`).join('')}</ul>` : '');
  const guide = () => `<aside class="krext-st-guide"><strong>10-53 국가연구개발과제 연구수당 지급 기준(2024-03-05)의 별지 1·2 를 그대로 셈합니다.</strong><p>대상은 참여연구원 계획의 연구책임자·연구자(연구지원 제외). <b>합산 기여도</b> = 참여율 환산비율(a)×0.3 + 성과 기여율(b)×0.6 + 기타 환산비율(c)×0.1 — a 는 참여율 ÷ 합, b 는 성과 항목(등급 점수 가 50 · 나 30 · 다 10 × 건수 × 가중치)의 합 ÷ 전체, c 는 기타(우수 100 · 양호 75 · 보통 50 · 미흡 25) ÷ 합. 성과 항목은 평가항목 목록에서 <b>포함</b>(켜진 항목은 모든 연구자 또는 그룹 사람에게 저절로 — 필수 3개(연구총괄·진도보고서·사전조사)와 분류된 연구내용 항목이 기본, 가중치 1/N)하거나 ＋ 항목 추가에서 고르고(같은 항목을 나눈 사람들의 가중치 합은 1), 연구수당 도우미가 연결돼 있으면 연구개발계획서의 연구내용 상위 항목을 [연구내용 분류]로 등급을 매깁니다. <b>평가등급</b>은 합산 기여도 순으로 참여 연구원 수별 인원 배분표(S 10% · A 20% · B 40% · C 20% · D 10%)대로, 동점은 상위등급. <b>지급비율</b>은 참여 연구원 수별 등급 몫 표를 등급 인원으로 나눈 값이고 지급액 = 집행 가능액 × 지급비율(원 절삭). 책임자는 5명 이상일 때 S+A·C+D 를 통합하거나 등급간 몫을 ±10%p 제로섬으로 조정할 수 있습니다(등급별 최소 3%, 하위등급 1인 ≤ 상위등급 1인). 개인 연간 총액은 기본연봉 × 직급 비율(P1 18 · P2 20 · P3 22 · P4 24 · G/C 22%)을 넘을 수 없어 지급 내역의 <b>잔여 한도</b> 열에 남은 연구수당(자료 요청 응답 · 내 HR 급여)과 여유·초과를 보이고, 초과면 낮춰도 한도를 채우는 등급을 <b>↓ 가능</b>으로 표시합니다 — 모르는 사람은 카드 아래 <b>자료 요청</b>으로 팀즈에 물어보세요.</p><p>부서명·직급·성과 항목·기타·미지급·조정은 이 브라우저에만 저장됩니다(과제·연차별). <b>DOCX 내려받기</b>는 별지 1·2 를 Word 문서로 만듭니다 — 서명·승인(연구주관본부장)은 문서로 받고, R&amp;D ERP 연구수당 지급 신청에는 직접 입력합니다.</p></aside>`;

  /* ---------- 복사 글 · Word 문서 모형 ---------- */
  function tsv(c) {
    const res = c.res;
    const L = [];
    L.push(['[별지 1] 연구수행 기여도 평가서', c.p.prjNm || '', `연구기간 ${c.period}`, `연구책임자 ${c.p.rspr || ''}`, `인건비 계상 ${fmtWon(c.payTotal)}`, `연구수당 계상 ${fmtWon(c.pool)}`].join('\t'));
    L.push(['부서명', '성명', '직급', '참여율(%)', '환산비율(a)', '평가항목', '등급', '건수', '가중치', '기여도', '기여율(b)', '평가점수', '환산비율(c)', '합산 기여도', '평가등급'].join('\t'));
    for (const r of res.people.filter((x) => !x.admin)) {
      const its = r.items.length ? r.items : [{ name: '', level: '', count: '', weight: '', score: '' }];
      its.forEach((it, k) => L.push([r.dept, k ? '' : r.name, k ? '' : r.grade, k ? '' : (r.target ? pctTxt(r.rate) : ''), k ? '' : (r.target ? pctTxt(r.a) : ''), it.name, it.level, it.count, it.weight, it.score === '' ? '' : r2(it.score), k ? '' : (r.target ? pctTxt(r.b) : ''), k ? '' : (r.etc == null ? '' : r.etc), k ? '' : (r.target ? pctTxt(r.c) : ''), k ? '' : (r.target ? pctTxt(r.total) : ''), k ? '' : (r.target ? r.gradeLabel : r.reason)].join('\t')));
    }
    L.push(['계', '', '', '', '100', '', '', '', '', r2(res.contribSum), '100', '', '100', '100', ''].join('\t'));
    L.push('');
    L.push(['[별지 2] 연구수당 지급 내역서', c.p.prjNm || '', `연구기관 ${c.org}`, `연구책임자 ${c.p.rspr || ''}`, `연구기간 ${c.period}`, `연구수당 계상 ${fmtWon(c.pool)}`, `집행 가능액 ${fmtWon(c.avail)}`, `총 지급액 ${fmtWon(res.sums.amt)}`].join('\t'));
    L.push(['부서명', '성명', '직급', '기여도', '평가등급', '기여내용 및 미지급 사유', '지급비율(%)', '지급액(원)'].join('\t'));
    for (const r of res.people.filter((x) => !x.admin)) L.push([r.dept, r.name, r.grade, r.target ? pctTxt(r.total) : '', r.target ? r.gradeLabel : '', r.target ? r.note : (r.note || r.reason), r.target ? pctTxt(r.ratio) : '', r.target ? fmtWon(r.amt) : ''].join('\t'));
    L.push(['계', '', '', '', '', '', '100', fmtWon(res.sums.amt)].join('\t'));
    return L.join('\n');
  }
  /* lib/docx.js build 의 입력 — 별지 1 · (쪽 나눔) · 별지 2. 부서별(byDept)이면 두 표의 사람 줄을 부서 단위(res.depts — 단위 안은 합산 순) 차례로 묶고 둘째 묶음부터 첫 칸에 pageBreakBefore(부서마다 새 쪽 — 2026-10-21 밤 사용자 "부서별로 하면 부서원 별로 페이지 구분되게 해줘"); 단위에 없는 사람(미지급·부서 없음)은 맨 뒤 묶음 */
  function docOf(c) {
    const res = c.res, all = res.people.filter((x) => !x.admin);
    const units = res.byDept ? res.depts.map((d) => d.people.filter((p) => all.includes(p))) : [];
    const rest = all.filter((p) => !units.some((u) => u.includes(p)));
    const people = units.concat([rest]).filter((u) => u.length).flatMap((u, bi) => u.map((p, pi) => Object.assign({ pb: bi > 0 && pi === 0 }, p)));   // pb — 그 사람의 첫 줄부터 새 쪽
    const H = (t, o = {}) => Object.assign({ text: t, shade: true, bold: true }, o);
    const G = (t, o = {}) => Object.assign({ text: t }, o);
    const X = (o = {}) => Object.assign({ text: '', hatch: true }, o);   // 빗금 — 양식(p03 · p10)에서 적지 않는 칸. 주석 번호는 <sup>n)</sup> 위첨자(lib/docx.js run)
    const amt = (n) => (n == null ? '' : `${fmtWon(n)}원`);
    const b1 = [
      { type: 'p', text: '별지 1', style: 'small' }, { type: 'p', text: '연구수행 기여도 평가서', align: 'CENTER', style: 'title' }, { type: 'p', text: '1. 일반 정보', style: 'h' },
      { type: 'table', widths: [1.7, 2.3, 1.7, 2.3], rows: [[H('연구과제명'), G(c.p.prjNm || '', { colSpan: 3, align: 'LEFT' }), { skip: true }, { skip: true }], [H('당해연도 연구기간'), G(c.period), H('연구책임자명'), G(`${c.p.rspr || ''}        (인)`, { align: 'RIGHT' })], [H('인건비 계상금액'), G(amt(c.payTotal), { align: 'RIGHT' }), H('연구수당 계상금액'), G(amt(c.pool), { align: 'RIGHT' })]] },
      { type: 'p', text: '2. 평가 내용', style: 'h' },
    ];
    const head1 = [[H('부서명', { rowSpan: 2 }), H('성명', { rowSpan: 2 }), H('직급', { rowSpan: 2 }), H('참여도 평가\n(30%)', { colSpan: 2 }), { skip: true }, H('성과 기여도 평가\n(60%)', { colSpan: 6 }), { skip: true }, { skip: true }, { skip: true }, { skip: true }, { skip: true }, H('기타<sup>3)</sup>\n(10%)', { colSpan: 2 }), { skip: true }, H('합산\n기여도<sup>4)</sup>', { rowSpan: 2 }), H('평가\n등급<sup>5)</sup>', { rowSpan: 2 })],
      [{ skip: true }, { skip: true }, { skip: true }, H('참여율\n(%)'), H('환산비율\n(a)'), H('평가항목<sup>1)</sup>'), H('등급'), H('건수'), H('가중치'), H('기여도'), H('기여율<sup>2)</sup>\n(b)'), H('평가점수'), H('환산비율\n(c)'), { skip: true }, { skip: true }]];
    const body1 = [];
    for (const r of people) {
      const its = r.target && r.items.length ? r.items : [{ name: r.target ? '' : r.reason, level: '', count: '', weight: '', score: '' }];
      const rs = its.length;
      its.forEach((it, k) => {
        const first = (v, o = {}) => (k ? { skip: true } : G(v, Object.assign({ rowSpan: rs }, o)));
        body1.push([first(r.dept, r.pb ? { pageBreakBefore: true } : {}), first(r.name), first(r.grade), first(r.target ? pctTxt(r.rate) : ''), first(r.target ? pctTxt(r.a) : ''), G(it.name, { align: 'LEFT' }), G(it.level), G(it.count === '' ? '' : String(it.count)), G(it.weight === '' ? '' : String(it.weight)), G(it.score === '' ? '' : String(r2(it.score))), first(r.target ? pctTxt(r.b) : ''), first(r.target ? (r.etc == null ? '' : String(r.etc)) : ''), first(r.target ? pctTxt(r.c) : ''), first(r.target ? pctTxt(r.total) : '', { bold: true }), first(r.target ? r.gradeLabel : '', { bold: true })]);
      });
    }
    const foot1 = [[H('계', { colSpan: 3 }), { skip: true }, { skip: true }, H(''), H('100'), X({ colSpan: 4 }), { skip: true }, { skip: true }, { skip: true }, H(res.n ? String(r2(res.contribSum)) : ''), H('100'), H(''), H('100'), H('100'), X()]];
    b1.push({ type: 'table', small: true, rowHeight: 567, headerRows: 2, widths: [1.1, 1.0, 0.7, 0.8, 0.8, 1.9, 0.6, 0.6, 0.7, 0.8, 0.95, 0.8, 0.8, 0.95, 0.8], rows: head1.concat(body1, foot1) });
    b1.push({ type: 'p', text: '1) 평가항목 및 난이도(등급): 가 50점 · 나 30점 · 다 10점(논문 저자·산업재산권 가중치는 별표)  2) 기여율은 개별 참여연구원의 기여도를 합산하여 전체참여연구원간 백분율로 계산  3) 기타는 참여연구원간 협력/소통, 적극성 등을 연구책임자가 평가 — 우수(100), 양호(75), 보통(50), 미흡(25)  4) 합산기여도 = (a×0.3)+(b×0.6)+(c×0.1)  5) 평가등급: S 상위 10%, A 상위 20%, B 40%, C 하위 20%, D 하위 10%', style: 'small' });
    const b2 = [
      { type: 'pagebreak' },
      { type: 'p', text: '별지 2', style: 'small' }, { type: 'p', text: '연구수당 지급 내역서', align: 'CENTER', style: 'title' }, { type: 'p', text: '1. 일반 정보', style: 'h' },
      { type: 'table', widths: [1.7, 2.3, 1.7, 2.3], rows: [[H('연구과제명'), G(c.p.prjNm || '', { colSpan: 3, align: 'LEFT' }), { skip: true }, { skip: true }], [H('연구기관명'), G(c.org), H('연구책임자명'), G(`${c.p.rspr || ''}        (인)`, { align: 'RIGHT' })], [H('당해년도 연구기간'), G(c.period), H('연구수당 계상금액'), G(amt(c.pool), { align: 'RIGHT' })], [H('연구수당 집행 가능액'), G(amt(c.avail), { align: 'RIGHT' }), H('총 지급액'), G(amt(res.sums.amt), { align: 'RIGHT', bold: true })]] },
      { type: 'p', text: '2. 지급 내역', style: 'h' },
    ];
    const rows2 = [[H('부서명'), H('성명'), H('직급'), H('기여도<sup>1)</sup>'), H('평가등급<sup>2)</sup>'), H('기여내용 및 미지급 사유<sup>3)</sup>'), H('지급비율<sup>4)</sup>'), H('지급액'), H('서명')]];
    for (const r of people) rows2.push([G(r.dept, r.pb ? { pageBreakBefore: true } : {}), G(r.name), G(r.grade), G(r.target ? pctTxt(r.total) : ''), G(r.target ? r.gradeLabel : ''), G(r.target ? r.note : (r.note || r.reason), { align: 'LEFT' }), G(r.target ? pctTxt(r.ratio) : ''), G(r.target ? fmtWon(r.amt) : '', { align: 'RIGHT' }), G('')]);
    rows2.push([H('계', { colSpan: 3 }), { skip: true }, { skip: true }, X({ colSpan: 3 }), { skip: true }, { skip: true }, H('100'), H(fmtWon(res.sums.amt), { align: 'RIGHT' }), X()]);
    b2.push({ type: 'table', rowHeight: 680, widths: [1.6, 1.1, 0.8, 0.9, 1.0, 2.0, 1.0, 1.4, 1.0], rows: rows2 });
    b2.push({ type: 'p', text: `*미지급사유 : ${UNPAID}`, style: 'small' });
    b2.push({ type: 'p', text: '1) 기여도는 "연구수행 기여도평가서"의 합산 기여도  2) 평가등급은 "연구수행 기여도 평가서"의 평가등급  3) 미지급 사유: 퇴직, 휴직, 병가, 연수, 파견, 참여연구원 변경, 연구성과 미기여, 기타 등  4) 지급비율은 배분기준을 따름', style: 'small' });
    return { title: `연구수당 계산서 ${c.p.prjNo} ${S.yearLabel(c.year)}`, author: c.org, blocks: b1.concat(b2) };
  }
  const fileName = (c) => `연구수당_${String(c.p.prjNo).replace(/[^\w-]/g, '')}_${S.yearLabel(c.year)}.docx`;

  /* ---------- 입력 처리 (popup.js — 탭) ---------- */
  function bind(host, state, draw) {
    const U = g.KRX_STAFF_UI;
    redraw = draw;   // ensureErp 가 rERP 참여인력을 받으면
    const entryOf = (key, make) => { state.allowCalc = state.allowCalc || {}; if (!state.allowCalc[key] && make) state.allowCalc[key] = { people: {} }; return state.allowCalc[key] || null; };
    const persist = () => { const r = save(state.allowCalc || {}); if (r && r.catch) r.catch(() => {}); };
    const keyOf = (el) => { const c = el.closest('[data-alkey]'); return c ? c.dataset.alkey : ''; };
    // 비율 조정 중 다시 그려져도 펼친 설정을 유지한다(계산 데이터와 별개인 탭 상태).
    host.addEventListener('toggle', (ev) => {
      const el = ev.target;
      if (!el || !el.dataset || !el.dataset.alDisclosure || !host.contains(el)) return;
      const key = keyOf(el); if (!key) return;
      state.allowUi = state.allowUi || {};
      const ui = state.allowUi[key] = state.allowUi[key] || {};
      ui[el.dataset.alDisclosure] = el.open;
    }, true);
    const ctx = (key) => {
      const [prjNo, y] = key.split('@'); const year = Number(y) || 1;
      const p = (((state.data || {}).projects) || []).find((x) => x.prjNo === prjNo); if (!p) return null;
      const plan = (state.staffPlans || {})[key] || null;
      const br = U ? U.budgetRows(p, plan, year, state) : { rows: [] };
      return ctxOf(p, plan, year, br, state, { me: state.staffWho, hr: state.allowHr });
    };
    const personOf = (e, id) => e.people[id] || (e.people[id] = {});
    const tidy = (e, id) => { const o = e.people[id]; if (o && !Object.keys(o).length) delete e.people[id]; };
    /* 사람의 포함 항목(auto — 표 줄의 앞부분, compute 결과에서)과 저장 항목(포함 항목과 같은 이름은 걷어 냄 — 옛 저장의 필수 줄). 칸·× 의 data-k 는 포함 수만큼 뒤 */
    const autoOf = (key, id) => { const c = ctx(key), q = c && c.res.people.find((r) => r.id === id); return q ? q.items.filter((it) => it.auto) : []; };
    const sharedKeysOf = (key) => { const c = ctx(key); return new Set(pickList(entryOf(key, false), c && c.rec).filter((it) => it.on).map((it) => itemKey(it.name))); };
    const stored = (o, a, key) => { const k = sharedKeysOf(key); for (const it of a) k.add(itemKey(it.name)); return (o.items || []).filter((it) => !k.has(itemKey(it && it.name))); };   // 보이는 개인 항목의 원본 참조; 숨긴 저장 줄을 지우거나 인덱스로 잘못 고치지 않는다
    const listWith = (e, lv, fn) => { const il = itemsOf(e), out = {}; for (const l of Object.keys(LEVELS)) out[l] = l === lv ? parseItems(fn(il[l]).join('\n')) : il[l].slice(); return out; };   // 평가항목 목록(entry.items)의 한 등급을 fn 으로 고친 사본
    // blur/change 도중 DOM을 바꾸면 Tab의 다음 칸이나 클릭한 버튼이 사라진다.
    // 브라우저가 포커스를 옮긴 다음 다시 그리고, 해당 칸과 표의 스크롤을 복원한다.
    let inputFrame = 0;
    const redrawAfterInput = () => {
      if (typeof g.requestAnimationFrame !== 'function') { draw(); return; }
      if (inputFrame) g.cancelAnimationFrame(inputFrame);
      inputFrame = g.requestAnimationFrame(() => {
        inputFrame = 0;
        const active = host.ownerDocument.activeElement;
        const key = active && host.contains(active) ? keyOf(active) : '';
        const attrs = key ? ['data-al', 'data-alp', 'data-ali', 'data-als', 'data-alq', 'data-alnew', 'data-algname', 'data-alrl', 'data-alscope', 'data-act', 'data-i', 'data-k', 'data-d', 'data-nm', 'data-gi', 'data-level'].filter((a) => active.hasAttribute(a)).map((a) => `[${a}="${CSS.escape(active.getAttribute(a))}"]`).join('') : '';
        const selection = active && active.tagName === 'INPUT' && active.type === 'text' ? [active.selectionStart, active.selectionEnd] : null;
        const scrolls = Array.from(host.querySelectorAll('[data-alkey] .krext-ws-table-scroll, [data-alkey] .krext-al-slot-scroll')).map((el) => ({ key: keyOf(el), label: el.getAttribute('aria-label'), left: el.scrollLeft, top: el.scrollTop }));
        draw();
        if (attrs) {
          const next = host.querySelector(`[data-alkey="${CSS.escape(key)}"] ${attrs}`);
          if (next) { next.focus({ preventScroll: true }); if (selection) next.setSelectionRange(...selection); }
        }
        for (const pos of scrolls) {
          const el = host.querySelector(`[data-alkey="${CSS.escape(pos.key)}"] [aria-label="${CSS.escape(pos.label || '')}"]`);
          if (el) { el.scrollLeft = pos.left; el.scrollTop = pos.top; }
        }
      });
    };
    const deptOf = (c, name) => (c && c.res.byDept ? c.res.depts.find((d) => d.name === name) : null) || null;
    /* 수동 배정 — 처음 한 번 같은 범위(전체, 부서별이면 그 사람의 부서) 모두의 현재 등급을 rank 로 적어 두어 다른 사람은 그대로 있게 하고 그 사람만 바꾼다 */
    const setRank = (key, e, id, rank) => {
      const c = ctx(key); if (!c) return false;
      const me = c.res.people.find((p) => p.id === id), d = me && c.res.byDept ? c.res.depts.find((x) => x.people.includes(me)) : null;
      for (const p of d ? d.people : c.res.people.filter((p) => p.target)) if (!p.rank && p.g >= 0) personOf(e, p.id).rank = c.res.groups[p.g].keys[0];
      if (GRADES.includes(rank)) personOf(e, id).rank = rank;
      return true;
    };
    host.addEventListener('keydown', (ev) => {
      const el = ev.target;
      if (ev.key !== 'Enter' || ev.isComposing || !el || !el.dataset || !el.dataset.alnew) return;
      ev.preventDefault(); el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    host.addEventListener('change', (ev) => {
      const el = ev.target;
      if (!el || !el.dataset || (!el.dataset.al && !el.dataset.alp && !el.dataset.ali && !el.dataset.als && !el.dataset.alq && !el.dataset.aladd && !el.dataset.alnew && !el.dataset.algname && !el.dataset.alrl && !el.dataset.alscope)) return;
      const key = keyOf(el); if (!key) return;
      const e = entryOf(key, true);
      const v = typeof el.value === 'string' ? el.value.trim() : '';
      if (el.dataset.al) {
        const k = el.dataset.al;
        if (k === 'pool' || k === 'avail') { const n = S.thousandOf(v); if (v && n == null) return; if (n == null) delete e[k]; else e[k] = n; }
        else if (k === 'org') { if (text(v, 40)) e.org = text(v, 40); else delete e.org; }
        else if (k === 'merge-sa' || k === 'merge-cd') { e.merge = Object.assign({ sa: false, cd: false }, e.merge || {}); e.merge[k === 'merge-sa' ? 'sa' : 'cd'] = !!el.checked; if (!e.merge.sa && !e.merge.cd) delete e.merge; }
        else if (k === 'bydept') { if (el.checked) e.byDept = true; else delete e.byDept; }
        else if (k.startsWith('adj-')) { const gk = k.slice(4); e.adjust = e.adjust || {}; const n = num(v); if (!n) delete e.adjust[gk]; else e.adjust[gk] = n; if (!Object.keys(e.adjust).length) delete e.adjust; }
      } else if (el.dataset.als || el.dataset.alq) {   // 부서별 등급 자리(자리 표 data-als · 등급 판 열 머리 data-alq) — 그 부서 줄을 지금 값으로 채우고 한 칸만 바꿈
        const d = el.dataset.d, nv = num(v); if (d == null || nv == null || nv < 0) return;
        const dd = deptOf(ctx(key), d); if (!dd) return;
        e.depts = e.depts || {}; const cfg = e.depts[d] = e.depts[d] || {};
        cfg.slots = Object.assign({}, dd.slots, cfg.slots || {}); cfg.slots[el.dataset.als || el.dataset.alq] = Math.floor(nv);
      } else if (el.dataset.alp) {
        const id = el.dataset.i, k = el.dataset.alp; if (!id) return;
        const o = personOf(e, id);
        if (k === 'rank') { if (!setRank(key, e, id, v)) return; }
        else if (k === 'out') { if (el.checked) o.out = true; else delete o.out; }
        else if (k === 'etc') { const n = num(v); if (n == null) delete o.etc; else o.etc = n; }
        else { const t = text(v, k === 'note' ? 200 : k === 'grade' ? 20 : 40); if (t) o[k] = t; else delete o[k]; }
        tidy(e, id);
      } else if (el.dataset.aladd) {   // ＋ 항목 추가 선택 상자 — "등급|이름"(이름이 비면 기타: 새 줄의 이름 칸에 초점). 저장 항목은 포함 항목 뒤에 그려지므로 data-k 는 포함 수만큼 뒤
        const id = el.dataset.aladd, at = v.indexOf('|'); if (!v || at < 0) return;
        const o = personOf(e, id), a = autoOf(key, id), visible = stored(o, a, key); o.items = o.items || []; if (visible.length >= MAX_ITEMS) return;
        const nm = text(v.slice(at + 1)); if (sharedKeysOf(key).has(itemKey(nm))) return;
        o.items.push({ name: nm, level: LEVELS[v.slice(0, at)] ? v.slice(0, at) : '가', count: 1, weight: 1 });
        e.at = Date.now(); persist(); draw();
        if (!nm) { const inp = host.querySelector(`[data-ali="name"][data-i="${CSS.escape(id)}"][data-k="${a.length + visible.length}"]`); if (inp) inp.focus(); }
        return;
      } else if (el.dataset.alnew) {   // [평가항목 목록] 칸 아래 입력 — 그 등급의 목록(entry.items)에 더하고 비움
        const lv = el.dataset.alnew, nm = text(v, 60); if (!LEVELS[lv] || !nm) return;
        e.items = listWith(e, lv, (names) => names.concat(nm)); el.value = '';
      } else if (el.dataset.alscope) {   // 항목에서 바로 전담 그룹 지정(기존 그룹 · 부서 복사 · 새 그룹 · 전체)
        const c = ctx(key), it = pickList(e, c && c.rec).find((x) => x.name === el.dataset.alscope);
        if (!c || !it || !it.level) return;
        const groups = Array.isArray(e.groups) ? e.groups : [];
        let gi = -1, newGroup = null;
        if (/^group:\d+$/.test(v)) { gi = Number(v.slice(6)); if (!groups[gi]) return; }
        else if (/^unit:\d+$/.test(v)) {
          const unit = scopeUnits(c.res.people, e.unions)[Number(v.slice(5))]; if (!unit) return;
          gi = groups.findIndex((gr) => gr.name === unit.name && (gr.people || []).length === unit.people.length && unit.people.every((id) => gr.people.includes(id)));
          if (gi < 0) newGroup = { name: unit.name, people: unit.people.slice(), items: [] };
        } else if (v === 'new') newGroup = { name: nextGroupName(groups), people: [], items: [] };
        else if (v !== 'all') return;
        if (newGroup) {
          if (groups.length >= 20) { state.allowMsg = { key, text: '전담 그룹은 20개까지 만들 수 있습니다. 기존 그룹을 선택하세요.' }; redrawAfterInput(); return; }
          gi = groups.length; groups.push(newGroup); e.groups = groups;
        }
        if (!assignGroup(e, it.name, gi)) return;
        e.at = Date.now(); persist();
        if (v === 'new') {
          state.allowMsg = { key, text: `"${it.name}"의 전담 그룹을 만들었습니다. 그룹 이름을 적고 담당 연구자를 선택하세요.` };
          draw();
          const inp = host.querySelector(`[data-alkey="${CSS.escape(key)}"] [data-algname="${gi}"]`);
          if (inp) { inp.focus(); if (typeof inp.select === 'function') inp.select(); }
        } else redrawAfterInput();
        return;
      } else if (el.dataset.algname) {   // 그룹 이름
        const gr = (e.groups || [])[Number(el.dataset.algname)]; if (!gr) return; gr.name = text(v, 40) || gr.name;
      } else if (el.dataset.alrl) {   // 연구내용 칩 옆 등급 칸 — entry.research
        if (!LEVELS[v]) return; e.research = e.research || {}; e.research[el.dataset.alrl] = v;
      } else {
        const id = el.dataset.i, k = el.dataset.ali, idx = Number(el.dataset.k); if (!id || !(idx >= 0)) return;
        const o = personOf(e, id), a = autoOf(key, id); if (idx < a.length) { tidy(e, id); return; }   // 포함 항목 줄(readonly)
        const it = stored(o, a, key)[idx - a.length]; if (!it) { tidy(e, id); return; }
        if (k === 'name') { if (sharedKeysOf(key).has(itemKey(v))) { state.allowMsg = { key, text: '공통 포함 항목은 평가항목 목록의 담당 그룹에서 설정하세요.' }; redrawAfterInput(); return; } it.name = text(v); }
        else if (k === 'level') it.level = LEVELS[v] ? v : '가';
        else { const n = num(v); if (n == null || n < 0) return; it[k] = n; }
      }
      e.at = Date.now();
      persist(); redrawAfterInput();
    });
    // 등급 칸 — 이름 칩을 끌어 등급 열에 놓기(HTML5 drag & drop, 확정된 부서의 칩은 draggable=false)
    const DEPT_MIME = 'application/x-krx-dept';   // 부서 그룹 끌기(자리 표의 부서 이름) — 칩 끌기(text/plain 사람 id)와 가름
    const isDeptDrag = (ev) => Array.from((ev.dataTransfer && ev.dataTransfer.types) || []).includes(DEPT_MIME);
    const colOf = (ev) => (ev.target && ev.target.closest ? ev.target.closest('.krext-al-col') : null);
    host.addEventListener('dragstart', (ev) => {   // 고른 칩을 끌면 이 판에 보이는 고른 칩 모두(id 를 쉼표로), 안 고른 칩은 그것만
      const ch = ev.target && ev.target.closest ? ev.target.closest('.krext-al-chip[draggable="true"]') : null; if (!ch) return;
      const card = ch.closest('[data-alkey]') || host;
      const ids = ch.classList.contains('krext-al-chip-sel') ? Array.from(card.querySelectorAll('.krext-al-chip.krext-al-chip-sel[draggable="true"]')).map((el) => el.dataset.i) : [ch.dataset.i];
      ev.dataTransfer.setData('text/plain', ids.join(',')); ev.dataTransfer.effectAllowed = 'move';
      for (const id of ids) { const el = card.querySelector(`.krext-al-chip[data-i="${CSS.escape(id)}"]`); if (el) el.classList.add('krext-al-dragging'); }
    });
    host.addEventListener('dragend', () => { host.querySelectorAll('.krext-al-dragging, .krext-al-dropping, .krext-al-swap').forEach((el) => el.classList.remove('krext-al-dragging', 'krext-al-dropping', 'krext-al-swap')); });
    host.addEventListener('dragover', (ev) => { const col = colOf(ev); if (!col || isDeptDrag(ev)) return; ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; col.classList.add('krext-al-dropping'); const ch = ev.target && ev.target.closest ? ev.target.closest('.krext-al-chip') : null; host.querySelectorAll('.krext-al-swap').forEach((x) => { if (x !== ch) x.classList.remove('krext-al-swap'); }); if (ch && !ch.classList.contains('krext-al-dragging') && !ch.classList.contains('krext-al-locked')) ch.classList.add('krext-al-swap'); });   // 다른 사람 칩 위면 그 칩을 표시(놓으면 등급을 맞바꿈)
    host.addEventListener('dragleave', (ev) => { const col = colOf(ev); if (col && !col.contains(ev.relatedTarget)) col.classList.remove('krext-al-dropping'); });
    host.addEventListener('drop', (ev) => {
      const col = colOf(ev); if (!col || isDeptDrag(ev)) return;
      ev.preventDefault();
      const ids = String(ev.dataTransfer.getData('text/plain') || '').split(',').filter(Boolean), key = keyOf(col); if (!ids.length || !key) return;
      const e = entryOf(key, true);
      // 칩 하나를 다른 사람 칩 위에 놓으면 둘의 등급을 맞바꿈(2026-10-21 사용자 "사람이 사람으로 가면 서로 바뀌도록") — 여럿을 끌거나 확정된 칩 위면 열에 놓는 것과 같음
      const onto = ev.target && ev.target.closest ? ev.target.closest('.krext-al-chip') : null;
      const from = ids.length === 1 && onto && onto.dataset.i !== ids[0] && !onto.classList.contains('krext-al-locked') ? (col.closest('[data-alkey]') || host).querySelector(`.krext-al-chip[data-i="${CSS.escape(ids[0])}"]`) : null, fromCol = from ? from.closest('.krext-al-col') : null;
      if (fromCol && fromCol !== col && !setRank(key, e, onto.dataset.i, fromCol.dataset.grp)) return;
      for (const id of ids) if (!setRank(key, e, id, col.dataset.grp)) return;
      if (state.allowSel) delete state.allowSel[key];
      e.at = Date.now(); persist(); draw();
    });
    // 부서 그룹 — 자리 표의 부서 이름(data-unitdrag)을 다른 줄(tr[data-unit])에 놓으면 병합(mergeUnions — 옛 단위의 자리·확정은 버려 새 그룹은 자동 배당부터), 그룹 줄의 [분리](al-split)가 splitUnion (2026-10-21)
    const rowOf = (ev) => (ev.target && ev.target.closest ? ev.target.closest('tr[data-unit]') : null);
    host.addEventListener('dragstart', (ev) => { const h = ev.target && ev.target.closest ? ev.target.closest('[data-unitdrag]') : null; if (!h) return; ev.dataTransfer.setData(DEPT_MIME, h.dataset.unitdrag); ev.dataTransfer.setData('text/plain', `dept:${h.dataset.unitdrag}`); ev.dataTransfer.effectAllowed = 'move'; h.classList.add('krext-al-dragging'); });
    host.addEventListener('dragover', (ev) => { const tr = rowOf(ev); if (!tr || !isDeptDrag(ev)) return; ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; tr.classList.add('krext-al-dropping'); });
    host.addEventListener('dragleave', (ev) => { const tr = rowOf(ev); if (tr && !tr.contains(ev.relatedTarget)) tr.classList.remove('krext-al-dropping'); });
    host.addEventListener('drop', (ev) => {
      const tr = rowOf(ev); if (!tr || !isDeptDrag(ev)) return;
      ev.preventDefault();
      const src = ev.dataTransfer.getData(DEPT_MIME), dst = tr.dataset.unit, key = keyOf(tr); if (!src || src === dst || !key) return;
      const e = entryOf(key, true);
      e.unions = mergeUnions(e.unions, src, dst);
      if (e.depts) { delete e.depts[src]; delete e.depts[dst]; if (!Object.keys(e.depts).length) delete e.depts; }
      e.at = Date.now(); persist(); draw();
    });
    // 연구내용 칩(.krext-al-pickwrap[data-ritem])을 등급 열(.krext-al-pickcol[data-level])에 끌어 놓으면 그 등급 — 칩 옆 등급 칸(data-alrl)과 같은 entry.research. 분류 전 칩도 끌어 놓으면 분류됨(2026-10-21)
    const RITEM_MIME = 'application/x-krx-ritem';
    const isRitemDrag = (ev) => Array.from((ev.dataTransfer && ev.dataTransfer.types) || []).includes(RITEM_MIME);
    const pickColOf = (ev) => (ev.target && ev.target.closest ? ev.target.closest('.krext-al-pickcol[data-level]') : null);
    host.addEventListener('dragstart', (ev) => { const w = ev.target && ev.target.closest ? ev.target.closest('[data-ritem]') : null; if (!w) return; ev.dataTransfer.setData(RITEM_MIME, w.dataset.ritem); ev.dataTransfer.effectAllowed = 'move'; w.classList.add('krext-al-dragging'); });
    host.addEventListener('dragover', (ev) => { const col = pickColOf(ev); if (!col || !isRitemDrag(ev)) return; ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; col.classList.add('krext-al-dropping'); });
    host.addEventListener('dragleave', (ev) => { const col = pickColOf(ev); if (col && !col.contains(ev.relatedTarget)) col.classList.remove('krext-al-dropping'); });
    host.addEventListener('drop', (ev) => {
      const col = pickColOf(ev); if (!col || !isRitemDrag(ev)) return;
      ev.preventDefault();
      const nm = ev.dataTransfer.getData(RITEM_MIME), lv = col.dataset.level, key = keyOf(col); if (!nm || !LEVELS[lv] || !key) return;
      const e = entryOf(key, true); if ((e.research || {})[nm] === lv) return;
      e.research = e.research || {}; e.research[nm] = lv;
      e.at = Date.now(); persist(); draw();
    });
    host.addEventListener('click', (ev) => {
      const ch = ev.target && ev.target.closest ? ev.target.closest('.krext-al-chip[draggable="true"]') : null;
      if (ch) {   // 칩 누르기 = 고르기/풀기(여럿 끌기) — 다시 그리지 않고 표시만
        const key = keyOf(ch); if (!key) return;
        const all = state.allowSel || (state.allowSel = {}), list = all[key] || (all[key] = []), at = list.indexOf(ch.dataset.i);
        if (at >= 0) list.splice(at, 1); else list.push(ch.dataset.i);
        ch.classList.toggle('krext-al-chip-sel', at < 0); ch.setAttribute('aria-pressed', at < 0 ? 'true' : 'false');
        return;
      }
      const btn = ev.target.closest('[data-act^="al-"]'); if (!btn) return;
      const key = keyOf(btn); if (!key) return;
      const act = btn.dataset.act;
      if (act === 'al-dtab') { state.allowDept = state.allowDept || {}; state.allowDept[key] = btn.dataset.d; draw(); return; }
      if (act === 'al-split') {   // 부서 그룹 풀기 — 그 그룹의 자리·확정도 버림(부서마다 자동 배당부터)
        const e = entryOf(key, true), d = btn.dataset.d;
        e.unions = splitUnion(e.unions, d); if (!e.unions.length) delete e.unions;
        if (e.depts) { delete e.depts[d]; if (!Object.keys(e.depts).length) delete e.depts; }
        e.at = Date.now(); persist(); draw(); return;
      }
      if (act === 'al-tab') { state.allowUi = state.allowUi || {}; (state.allowUi[key] = state.allowUi[key] || {}).tab = btn.dataset.tab; draw(); return; }
      if (act === 'al-slot') {   // 자리 표의 −/+ (2026-10-21 사용자 "숫자는 넣어도 되지만 클릭으로 증감할 수 있게") — 칸(data-als)과 같은 저장
        const dd = deptOf(ctx(key), btn.dataset.d); if (!dd) return;
        const e = entryOf(key, true), gk = btn.dataset.g, nv = Math.max(0, (dd.slots[gk] || 0) + (Number(btn.dataset.dir) || 0));
        e.depts = e.depts || {}; const cfg = e.depts[btn.dataset.d] = e.depts[btn.dataset.d] || {};
        cfg.slots = Object.assign({}, dd.slots, cfg.slots || {}); cfg.slots[gk] = nv;
        e.at = Date.now(); persist(); draw(); return;
      }
      if (act === 'al-slots-auto') {   // [자동 배정] — 고친 자리(slots)·확정(done)·끌어 놓은 등급(rank)을 모두 지워 자동 배당 + 합산기여도 순으로(2026-10-21 사용자 "이거 자동 배정 안되네")
        const e = entryOf(key, false);
        if (e) { delete e.depts; for (const id of Object.keys(e.people)) { delete e.people[id].rank; tidy(e, id); } e.at = Date.now(); persist(); }
        draw(); return;
      }
      if (act === 'al-done') {   // 부서 확정 — 그 부서 사람 모두의 현재 등급을 적어 잠금 / 해제
        const e = entryOf(key, true), d = btn.dataset.d; e.depts = e.depts || {}; const cfg = e.depts[d] = e.depts[d] || {};
        if (cfg.done) delete cfg.done;
        else { const dd = deptOf(ctx(key), d); if (dd) for (const p of dd.people) if (!p.rank && p.g >= 0) personOf(e, p.id).rank = ctx(key).res.groups[p.g].keys[0]; cfg.done = true; }
        if (!Object.keys(cfg).length) delete e.depts[d]; if (!Object.keys(e.depts).length) delete e.depts;
        e.at = Date.now(); persist(); draw(); return;
      }
      if (act === 'al-auto') {   // 수동 등급 지우기 — 전체, 부서별이면 그 부서만(확정도 풀림)
        const e = entryOf(key, false);
        if (e) {
          const d = btn.dataset.d; let ids = Object.keys(e.people);
          if (d != null) { const dd = deptOf(ctx(key), d); ids = dd ? dd.people.map((p) => p.id) : []; if (e.depts && e.depts[d]) { delete e.depts[d].done; if (!Object.keys(e.depts[d]).length) delete e.depts[d]; if (!Object.keys(e.depts).length) delete e.depts; } }
          for (const id of ids) if (e.people[id]) { delete e.people[id].rank; tidy(e, id); }
          e.at = Date.now(); persist();
        }
        draw(); return;
      }
      if (act === 'al-item-del') {   // 줄의 × — 포함 항목 줄은 단추가 없지만 한 번 더 막음(data-k 는 포함 수만큼 뒤)
        const e = entryOf(key, true), id = btn.dataset.i, o = personOf(e, id), a = autoOf(key, id), k = Number(btn.dataset.k) - a.length;
        const it = k >= 0 ? stored(o, a, key)[k] : null;
        if (it) o.items.splice(o.items.indexOf(it), 1);
        if (o.items && !o.items.length) delete o.items;
        tidy(e, id); if (!it) return;
        e.at = Date.now(); persist(); draw(); return;
      }
      if (act === 'al-items-default') {   // [평가항목 목록] 지침 기본값 — 목록(entry.items)만, 포함·그룹·사람에게 넣은 항목은 그대로
        const e = entryOf(key, true); delete e.items;
        e.at = Date.now(); persist(); state.allowMsg = { key, text: '평가항목 목록을 지침 기본값으로 되돌렸습니다.' }; draw(); return;
      }
      if (act === 'al-pick') {   // 칩 — 포함 토글(entry.pick[이름]); 분류 전 연구내용은 못 켬
        const e = entryOf(key, true), c = ctx(key), it = pickList(e, c && c.rec).find((x) => x.name === btn.dataset.nm); if (!it || !it.level) return;
        e.pick = e.pick || {}; e.pick[it.name] = !it.on;
        e.at = Date.now(); persist(); redrawAfterInput(); return;
      }
      if (act === 'al-pick-add') {
        const col = btn.closest('.krext-al-pickcol'), inp = col && col.querySelector('[data-alnew]');
        if (inp) { inp.dispatchEvent(new Event('change', { bubbles: true })); inp.focus(); }
        return;
      }
      if (act === 'al-pick-del') {   // 칩의 × — 목록(entry.items)과 pick 에서 뺌
        const nm = btn.dataset.nm; if (!nm || isRequired(nm)) return;
        const e = entryOf(key, true);
        for (const lv of Object.keys(LEVELS)) e.items = listWith(e, lv, (names) => names.filter((x) => itemKey(x) !== itemKey(nm)));
        if (e.pick) { delete e.pick[nm]; if (!Object.keys(e.pick).length) delete e.pick; }
        e.at = Date.now(); persist(); draw(); return;
      }
      if (act.startsWith('al-group-')) {   // 그룹 — 더하기 · 지우기 · 사람/항목 토글(entry.groups[{ name, people, items }])
        const e = entryOf(key, true); e.groups = Array.isArray(e.groups) ? e.groups : [];
        const gi = Number(btn.dataset.gi), gr = e.groups[gi], flip = (arr, v) => { const at = arr.indexOf(v); if (at >= 0) arr.splice(at, 1); else arr.push(v); return arr; };
        if (act === 'al-group-add') { if (e.groups.length >= 20) return; e.groups.push({ name: nextGroupName(e.groups), people: [], items: [] }); }
        else if (!gr) { if (!e.groups.length) delete e.groups; return; }
        else if (act === 'al-group-del') e.groups.splice(gi, 1);
        else if (act === 'al-group-person') gr.people = flip(gr.people || [], btn.dataset.i);
        else if (act === 'al-group-item') gr.items = flip(gr.items || [], btn.dataset.nm);
        else return;
        if (!e.groups.length) delete e.groups;
        e.at = Date.now(); persist(); draw(); return;
      }
      if (act === 'al-decompose') {   // [등급별 자동 분해] — 지금 등급(수동이면 수동)대로 기본 항목을 넣음
        const c = ctx(key); if (!c || !c.res.n) return;
        const e = entryOf(key, true), n = decompose(c.res, e, c.rec);
        e.at = Date.now(); persist();
        state.allowMsg = { key, text: `등급별 기본 성과 항목 ${n}개를 넣었습니다(가중치는 같은 항목을 가진 사람 수로 1/N) — 연구내용 항목은 평가항목 목록에서 포함하고, 등급이 바뀌었으면 확인 사항을 보세요.` };
        draw(); return;
      }
      if (act === 'al-classify') {   // [연구내용 분류] — 연구수당 도우미 채팅을 열어 요청(단추는 연결돼 있을 때만 그려짐)
        const chat = g.KRX_STAFF_CHAT; if (!chat || typeof chat.send !== 'function') return;
        if (chat.toggle) chat.toggle(true); chat.send(CLASSIFY_ASK); return;
      }
      if (act === 'al-reset') { if (state.allowCalc) delete state.allowCalc[key]; persist(); state.allowMsg = { key, text: '기본값으로 되돌렸습니다.' }; draw(); return; }
      const c = ctx(key); if (!c || !c.staff) return;
      const done = (ok, t) => { state.allowMsg = { key, text: t, error: !ok }; draw(); };
      if (act === 'al-copy') { try { navigator.clipboard.writeText(tsv(c)).then(() => done(true, '별지 1·2 표를 복사했습니다.'), () => done(false, '복사하지 못했습니다.')); } catch (e) { done(false, '복사하지 못했습니다.'); } return; }
      if (act === 'al-docx') {
        const D = g.KRX_DOCX; if (!D) { done(false, 'lib/docx.js 를 싣지 못했습니다.'); return; }
        try { D.download(fileName(c), D.build(docOf(c))); done(true, `${fileName(c)} 를 내려받습니다 — Word 에서 열어 서명·승인을 받으세요.`); } catch (e) { done(false, `DOCX 를 만들지 못했습니다: ${String((e && e.message) || e)}`); }
      }
    });

    /* ---------- 연구수당 도우미(채팅 — popup/staff-chat.js allow 모드, 2026-10-21): 보고 있는 과제·연차 · 계산 요약 · 작업 반영 ---------- */
    const projects = () => (((state.data || {}).projects) || []);
    const current = () => { const p = U ? U.projOf(projects(), state) : null; return p ? { prjNo: p.prjNo, year: U.yearOf(p, state), p } : null; };
    const etcLabel = (v) => { const e = ETC.find(([x]) => Number(x) === v); return e ? `${e[1]}(${e[0]})` : String(v); };
    const th = (n) => (n == null ? '' : S.thousand(n));
    const groupsText = (c) => c.res.groups.map((gr) => `${gr.label} ${r2(gr.share)}%(${gr.members.length}명${gr.members.length ? ` · 1인 ${pctTxt(gr.perHead)}%` : ''})`).join(' · ');
    /* 사람 한 줄 — 요청 글에 들어가는 계산 상태(금액 천원 · 비율 %) */
    function personLine(r) {
      const head = `${r.name} (${S.roleShort(r.role)}) — 부서 ${r.dept || '(없음)'} · 직급 ${r.grade || '(없음)'}`;
      if (!r.target) return `${head} · 제외(${r.reason})${r.note ? ` · 사유 "${r.note}"` : ''}`;
      const items = r.items.length ? r.items.map((it) => `${it.name || '(이름 없음)'}${it.auto ? '(포함)' : ''}[${it.level} ${LEVELS[it.level]}점 × ${it.count}건 × 가중치 ${it.weight} = ${r2(it.score)}]`).join(', ') : '없음';
      const cap = r.cap == null ? '한도 모름' : `남은 연구수당 ${th(r.cap)}천원(${r.capSrc}) ${r.over ? `초과 ${th(r.over)}천원${r.down ? ` — ↓${r.down} 가능` : ''}` : `여유 ${th(r.room)}천원`}`;
      return `${head} · 참여율 ${pctTxt(r.rate)}%(a ${pctTxt(r.a)}) · 성과 항목 ${items} (기여도 합 ${r2(r.contrib)} · b ${pctTxt(r.b)}) · 기타 ${r.etc == null ? '미평가' : etcLabel(r.etc)}(c ${pctTxt(r.c)}) · 합산기여도 ${pctTxt(r.total)} · 등급 ${r.gradeLabel}${r.rank ? '(수동)' : ''}${r.tie ? '(동점)' : ''} · 지급비율 ${pctTxt(r.ratio)}% · 지급액 ${th(r.amt)}천원 · ${cap}${r.note ? ` · 기여내용 "${r.note}"` : ''}`;
    }
    /* 보고 있는 과제·연차의 계산 요약 — lib/allow-chat-core.js clean() 의 snapshot 모양. 과제가 없으면 null */
    function snapshot() {
      const cur = current(); if (!cur) return null;
      const key = S.planKey(cur.prjNo, cur.year), c = ctx(key); if (!c) return null;
      const { res, p } = c, k = (n) => (n == null ? null : Math.round(n / 1000));
      return {
        prjNo: p.prjNo, alias: U ? U.aliasOf(state, p.prjNo) : '', prjNm: p.prjNm || '', year: cur.year, rspr: p.rspr || '', period: c.period, org: c.org,
        pool: k(c.pool), avail: k(c.avail), payTotal: k(c.payTotal), n: res.n, merge: res.merge, adjust: res.adjust, byDept: res.byDept,
        names: res.people.filter((r) => !r.admin).map((r) => r.name), people: res.people.filter((r) => !r.admin).map(personLine),
        groups: res.groups.map((gr) => `${gr.label}: 인원 기준 ${gr.count0}명 · 몫 ${r2(gr.share0)}%${gr.share !== gr.share0 ? `(지금 ${r2(gr.share)}%)` : ''} · 지금 ${gr.members.length}명${gr.members.length ? `(${gr.members.map((q) => q.name).join(', ')}) · 1인 ${pctTxt(gr.perHead)}%` : ''}`),
        depts: res.depts.map((d) => `${d.title}: ${d.n}명 · 자리 ${res.groups.map((gr) => `${gr.label} ${d.slots[gr.key]}`).join(' · ')}${d.custom ? '(조율함)' : '(자동 배당)'}${d.done ? ' · 확정' : ''}`),
        warnings: checks(res).map((w) => w.text), hasPlan: !!c.staff,
        research: researchItems(c.rec).map((x) => ({ name: x.name, level: (c.entry.research || {})[x.name] || '', text: x.text })),   // 연구개발계획서 상위 항목(research 작업의 대상)
      };
    }
    /* 작업 하나 → 화면 메시지 글(실패면 throw). 표의 칸·끌어 놓기와 같은 저장 모양으로 entry 를 고친다 — persist·draw 는 apply 가 한 번에 */
    function runOp(key, op) {
      const c = ctx(key); if (!c) throw new Error('보고 있는 과제를 찾지 못했습니다.');
      const e = entryOf(key, true), touch = () => { e.at = Date.now(); };
      const person = (name) => { const q = c.res.people.find((r) => !r.admin && S.sameName(r.name, name)); if (!q) throw new Error(`${name} 이(가) 이 연차 계획에 없습니다.`); return q; };
      const after = (id) => { const n = ctx(key), q = n && n.res.people.find((r) => r.id === id); return !q ? '' : q.target ? `합산기여도 ${pctTxt(q.total)} · ${q.gradeLabel} 등급 · 지급비율 ${pctTxt(q.ratio)}% · 지급액 ${th(q.amt)}천원` : `제외(${q.reason})`; };
      switch (op.op) {
        case 'pool': case 'avail': { if (op.value == null) delete e[op.op]; else e[op.op] = Math.round(op.value) * 1000; touch(); const n = ctx(key); return `${op.op === 'pool' ? '계상금액' : '집행 가능액'} ${th(op.op === 'pool' ? n.pool : n.avail)}천원 · 총 지급액 ${th(n.res.sums.amt)}천원.`; }
        case 'org': { const t = text(op.value, 40); if (t) e.org = t; else delete e.org; touch(); return `연구기관명 ${e.org || '(기본 한국선급)'}.`; }
        case 'person': {
          const q = person(op.name), o = personOf(e, q.id), v = String(op.value == null ? '' : op.value);
          if (op.field === 'rank') { if (v) { if (!setRank(key, e, q.id, v)) throw new Error('등급을 바꾸지 못했습니다.'); } else delete o.rank; }
          else if (op.field === 'out') { if (v === 'on') { if (!(q.rate > 0)) throw new Error(`${q.name} — 참여율이 없어 이미 제외입니다.`); o.out = true; } else delete o.out; }
          else if (op.field === 'etc') { const n = num(v); if (n == null) delete o.etc; else o.etc = n; }
          else { const t = text(v, op.field === 'note' ? 200 : op.field === 'grade' ? 20 : 40); if (t) o[op.field] = t; else delete o[op.field]; }
          tidy(e, q.id); touch(); return `${q.name} — ${after(q.id)}`;
        }
        case 'item_add': { const q = person(op.name), o = personOf(e, q.id); if (pickList(e, c.rec).some((it) => it.on && itemKey(it.name) === itemKey(op.value))) throw new Error(`"${op.value}" 은(는) 평가항목 목록에서 포함한 항목입니다. 담당 그룹을 바꾸거나 공통 포함을 해제한 뒤 개인 항목으로 추가하세요.`); o.items = o.items || []; if (q.items.filter((it) => !it.auto).length >= MAX_ITEMS) throw new Error(`개인 성과 항목은 사람마다 ${MAX_ITEMS}개까지입니다(목록에서 포함한 항목 밖).`); o.items.push({ name: text(op.value), level: LEVELS[op.level] ? op.level : '가', count: num(op.count) == null ? 1 : num(op.count), weight: num(op.weight) == null ? 1 : num(op.weight) }); touch(); return `${q.name} — 성과 항목 ${o.items.length}개 · ${after(q.id)}`; }
        case 'item_del': { const q = person(op.name), o = personOf(e, q.id); if (pickList(e, c.rec).some((it) => it.on && itemKey(it.name) === itemKey(op.value))) throw new Error(`"${op.value}" 은(는) 평가항목 목록에서 포함한 항목이라 사람에게서 뺄 수 없습니다 — 사용자가 목록에서 끄거나 그룹을 바꿉니다.`); const k = (o.items || []).findIndex((it) => S.nameKeyOf(it.name) === S.nameKeyOf(op.value)); if (k < 0) throw new Error(`${q.name} — "${op.value}" 항목이 없습니다.`); o.items.splice(k, 1); if (!o.items.length) delete o.items; tidy(e, q.id); touch(); return `${q.name} — ${after(q.id)}`; }
        case 'research': {   // 연구내용 상위 항목의 난이도 등급 — 매기면 평가항목 목록의 칩이 기본 포함(모든 연구자에게)
          const hit = researchItems(c.rec).find((x) => itemKey(x.name) === itemKey(op.value)); if (!hit) throw new Error(`"${op.value}" 은(는) 이 연차 연구개발계획서의 연구내용에 없습니다.`);
          if (!LEVELS[op.level]) throw new Error('등급은 가·나·다 가운데 하나여야 합니다.');
          e.research = e.research || {}; e.research[hit.name] = op.level; touch();
          return `연구내용 "${hit.name}" — ${op.level} 등급(${LEVELS[op.level]}점) · 평가항목 목록에 포함돼 모든 연구자에게 들어갑니다(사용자가 끄거나 그룹을 정할 수 있음).`;
        }
        case 'merge': { if (c.res.n < 5) throw new Error('등급 통합은 참여연구원 5명 이상일 때만 됩니다.'); e.merge = Object.assign({ sa: false, cd: false }, e.merge || {}); e.merge[op.field] = op.value === 'on'; if (!e.merge.sa && !e.merge.cd) delete e.merge; touch(); return `등급 몫 — ${groupsText(ctx(key))}.`; }
        case 'adjust': { e.adjust = e.adjust || {}; const n = num(op.value); if (!n) delete e.adjust[op.field]; else e.adjust[op.field] = n; if (!Object.keys(e.adjust).length) delete e.adjust; touch(); return `등급 몫 — ${groupsText(ctx(key))}.`; }
        case 'bydept': { if (op.value === 'on') e.byDept = true; else delete e.byDept; touch(); return `부서별 배정을 ${op.value === 'on' ? '켰습니다' : '껐습니다'}.`; }
        case 'auto': { delete e.depts; for (const id of Object.keys(e.people)) { delete e.people[id].rank; tidy(e, id); } touch(); return '수동 등급·부서별 자리·확정을 지우고 합산기여도 순으로 되돌렸습니다.'; }
        default: throw new Error(`모르는 작업입니다: ${op.op}`);
      }
    }
    /* 작업 목록을 차례대로 — 작업마다 { ok, text(한 줄 — lib/allow-chat-core.js opText), msg }. 하나가 실패해도 다음 작업은 계속. 끝에 한 번 저장·다시 그림 */
    async function apply(ops) {
      const C = g.KRX_ALLOW_CHAT_CORE, out = [];
      for (const op of Array.isArray(ops) ? ops : []) {
        const t = C ? C.opText(op) : String((op && op.op) || '');
        const cur = current();
        if (!cur) { out.push({ ok: false, text: t, msg: '보고 있는 과제가 없습니다.' }); continue; }
        try { out.push({ ok: true, text: t, msg: runOp(S.planKey(cur.prjNo, cur.year), op) }); }
        catch (err) { out.push({ ok: false, text: t, msg: String((err && err.message) || err) }); }
      }
      persist(); draw();
      return out;
    }
    return { agent: { current, snapshot, apply } };
  }

  g.KRX_ALLOW = { KEY, GRADES, LEVELS, ETC, WEIGHT, ITEMS, REQUIRED, TEMPLATE, AUTO_MAX, MAX_ITEMS, CLASSIFY_ASK, isRequired, pickList, assignGroup, scopeUnits, autoItemsOf, mergeItems, itemsOf, parseItems, decompose, researchOf, researchItems, HEADCOUNT, PAY_SHARE, headcountOf, shareOf, shortDepts, apportion, unitsOf, mergeUnions, splitUnion, compute, weightSums, checks, normalize, load, save, erpMapOf, inputOf, poolOfRows, availOfRows, ctxOf, card, guide, tsv, docOf, fileName, bind };
})(typeof self !== 'undefined' ? self : this);
