/* 연구수당 도우미(채팅)의 공용 부분 (2026-10-21 사용자 "연구수당도, 참여연구원 과 같은 동일한 에이전트를 넣어줘. 참고하는 프롬프트만 달리해서. 여기에는 연구수당 지침을 넣어줘라")
 * — 연구수당 계산 탭(popup.html#…&only=allow — lib/allowance.js)의 오른쪽 채팅은 참여연구원 변경 탭의 변경 도우미와 **같은 UI·연결·첨부·규칙 편집**(popup/staff-chat.js 의 allow 모드)이고, 프롬프트·작업(ops)·스키마·검사·작업 한 줄 글만 이 파일이다.
 *   글 정리(str·multi·list·fin·fmt·nameKeyOf)·rulesOf·fileOf·filesLines·LIMIT 는 lib/staff-chat-core.js 의 것을 그대로 쓴다(확장에서는 그 스크립트가 먼저 실려 있어야 함 — popup.html 차례).
 * 두 곳이 같이 쓴다: Help 서버(help-server/server.js POST /allow → help-server/staff-chat.js run(input, { core }) — claude -p 한 번, 도구 없음)와 확장(popup/staff-chat.js 가 opText 로 반영 결과를 적음, lib/claude-api.js staff(input, { core })). 고치면 서버를 다시 띄우고 확장도 다시 올려야 둘 다 반영된다.
 * 흐름: 탭이 요청 글 + 보고 있는 과제·연차 연구수당 계산의 요약(lib/allowance.js bind().agent.snapshot — 계상금액·집행 가능액·사람마다 부서·직급·참여율·성과 항목·기타·합산기여도·등급·지급비율·지급액·한도·알림)과 이전 대화 몇 줄을 보내면
 *   Claude 가 { reply(한두 문장), ops[작업…] } 을 돌려주고, 확장(agent.apply)이 ops 를 차례대로 저장 항목(storage.local.allowCalc[과제@연차])에 반영한다(표의 칸·끌어 놓기와 같은 길 — 계산은 lib/allowance.js compute). Claude 는 화면·R&D ERP 를 직접 만지지 못한다.
 * 작업(ops) — 스키마는 모든 칸을 required 로 두고 안 쓰는 칸은 ''·0 (staff-chat-core 와 같은 방식). 값(value)은 늘 글(string)이라 칸 하나로 금액·이름·on/off 를 다 받는다:
 *   pool(value 천원) · avail(value 천원) · org(value) · person(name, field dept|grade|etc|note|out|rank, value) · item_add(name, value 항목 이름, level 가|나|다, count, weight) · item_del(name, value 항목 이름)
 *   · research(value 연구내용 상위 항목 이름 — snapshot.research 목록 안, level 가|나|다 — 2026-10-21 "연구개발 보고서의 차년도 상위 연구 항목들에 대해서도 가등급 또는 나등급으로 … 분류는 가 또는 나 또는 다의 평가항목들을 보고 판단": 확장 entry.research[항목] = 등급, 사람에게는 안 넣음)
 *   · merge(field sa|cd, value on|off) · adjust(field S~D, value %p) · bydept(value on|off) · auto
 *   이름(name)은 계획의 참여연구원(행정지원 제외) enum — 목록 밖 이름은 버린다. 참여연구원을 더하거나 참여율을 바꾸는 일은 참여연구원 변경 탭의 몫이라 여기엔 없다.
 * 규칙(rules) = **연구수당 지침**: 기본 글 DEFAULT_RULES 는 references/10-53_국가연구개발과제_연구수당지급기준_20240305.md(2024-03-05 시행판)를 옮겨 적은 것(조문 · 표 1·2 · 별지 1 항목·가중치·등급 인원 배분 · 별지 2 지급비율 배분·조정 규칙)이고
 *   사용자가 고친 글은 storage.local.allowRules(채팅 머리의 [지침]). 요청의 rules 로 와서 build().system 이 SYSTEM 뒤에 붙인다(빈 글이면 SYSTEM 그대로). 변경 도우미의 예산 규칙(staffRules)과는 따로.
 * 입력(clean): { text, rules, files, history, snapshot:{ prjNo, alias, prjNm, year, rspr, period, org, pool(천원), avail(천원), payTotal(천원), n, merge{ sa, cd }, adjust{ S~D }, byDept, names[], people[](줄), groups[](줄), depts[](줄), warnings[], hasPlan } }
 * 결과(parse): { reply, ops(검사를 통과한 것만), dropped } */
(function (g) {
  'use strict';
  const B = typeof module === 'object' && module.exports ? require('./staff-chat-core.js') : g.KRX_STAFF_CHAT_CORE;
  const { str, multi, list, fin, fmt, nameKeyOf, rulesOf: baseRulesOf, fileOf, filesLines } = B;
  const LIMIT = Object.assign({}, B.LIMIT, { rules: 12000, names: 60, lines: 80, line: 700 });   // 지침 글이 길어 rules 는 넉넉히
  const OPS = Object.freeze(['pool', 'avail', 'org', 'person', 'item_add', 'item_del', 'research', 'merge', 'adjust', 'bydept', 'auto']);
  const itemKeyOf = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^0-9a-z가-힣]/g, '');   // 연구내용 항목 이름 견주기(띄어쓰기·기호 무시 — lib/allowance.js itemKey 와 같음)
  const FIELDS = Object.freeze(['dept', 'grade', 'etc', 'note', 'out', 'rank', 'sa', 'cd', 'S', 'A', 'B', 'C', 'D']);
  const PERSON_FIELDS = Object.freeze(['dept', 'grade', 'etc', 'note', 'out', 'rank']);
  const LEVELS = Object.freeze(['가', '나', '다']);
  const GRADES = Object.freeze(['S', 'A', 'B', 'C', 'D']);
  const ETC = Object.freeze({ 100: 100, 75: 75, 50: 50, 25: 25, '우수': 100, '양호': 75, '보통': 50, '미흡': 25 });
  const ETC_LABEL = Object.freeze({ 100: '우수', 75: '양호', 50: '보통', 25: '미흡' });
  const onOff = (v) => { const s = String(v == null ? '' : v).trim().toLowerCase(); return /^(on|true|1|yes|y|예|켬|통합|사용)$/.test(s) ? 'on' : /^(off|false|0|no|n|아니오|끔|해제|안\s?함)$/.test(s) ? 'off' : ''; };

  const SYSTEM = [
    '너는 한국 국가 R&D 과제의 연구수당 지급 계획(별지 1 연구수행 기여도 평가서 · 별지 2 연구수당 지급 내역서)을 작성하는 도우미다. 사용자는 연구책임자 또는 연구원이며, 브라우저 확장 "KR eClass + R&D ERP 현황"의 연구수당 계산 화면 옆 채팅으로 요청한다.',
    '너는 화면이나 R&D ERP 를 직접 만지지 못한다. 정해진 작업(ops)을 돌려주면 확장이 그 차례대로 화면의 계산에 반영하고 합산기여도·평가등급·지급비율·지급액을 다시 셈한다. 이 계산은 확장 안의 것이며 R&D ERP 에 바로 쓰이지 않는다.',
    '규칙:',
    '- 계산·판단은 아래 연구수당 지침(10-53)을 따른다. 지침의 해석·질문·설명 요청이면 ops 없이 지침을 근거로 답한다(지침에 없는 것은 모른다고 한다).',
    '- 금액 단위는 천원(계상금액·집행 가능액·지급액·남은 연구수당), 비율은 %. 등급·지급비율·지급액은 확장이 셈하므로 reply 에 결과 수치를 단정해 적지 말고 반영 뒤 표를 보라고만 한다.',
    '- 요청이 분명하면 ops 를 채우고 reply 에 무엇을 반영하는지 짧게 적는다. 누구·무엇·얼마가 분명하지 않으면 ops 를 비우고 reply 로 되묻는다.',
    '- 이름은 참여연구원 목록의 표기 그대로 name 에 넣는다. 목록에 없는 사람은 되묻는다 — 참여연구원 추가·참여율·기간 변경은 참여연구원 변경 화면의 일이라 여기서는 할 수 없다고 안내한다.',
    '- 평가등급은 합산기여도 순(자동)이 기본이다. 사용자가 사람의 등급을 말하면 person rank 로 수동 배정하되, 인원 배분 기준을 넘기는 등급이면 reply 에 알린다. 성과 항목·기타 평가를 고치면 등급이 저절로 바뀔 수 있다.',
    '- 되돌리기 어려운 일(auto — 수동 등급·부서별 자리·확정을 모두 지움)은 사용자가 그렇게 하라고 분명히 말했을 때만 넣는다.',
    '- reply 는 한국어 평문으로 두 문장 안에, 마크다운·머리표 없이.',
  ].join('\n');
  const OPS_GUIDE = [
    '작업(ops) 종류 — 차례대로 반영된다. 안 쓰는 칸은 "" · 0 으로 둔다. value 는 늘 글(string)이다:',
    '- pool: 연구수당 계상금액을 value 천원으로(value 를 비우면 예산 줄의 연구수당으로 되돌림). avail: 집행 가능액을 value 천원으로(비우면 계상금액 − 집행). org: 연구기관명을 value 로.',
    '- person: name 의 칸 field 를 value 로 — dept(부서명) · grade(직급 P1~P4·G1~G3·C) · etc(기타 평가 — 우수|양호|보통|미흡 또는 100|75|50|25, 비우면 미평가) · note(기여내용 및 미지급 사유) · out(미지급 on|off — on 이면 등급·지급에서 빼고 사유만 적음) · rank(평가등급 S|A|B|C|D 수동 배정, 비우면 자동).',
    '- item_add: name 에 성과 항목을 더한다 — value 평가항목 이름(지침 1) 의 항목 이름 그대로, 없는 것은 적은 대로), level 난이도 등급(가 50점 · 나 30점 · 다 10점 — 지침 1) 의 등급표대로), count 건수(기본 1), weight 가중치(논문은 1-1), 산업재산권은 1-2), 그 밖은 참여연구원간 합이 1 — 기본 1). 기여도 = 점수 × 건수 × 가중치.',
    '- item_del: name 의 성과 항목 value(이름)를 뺀다. 사람 줄에 "(포함)" 이 붙은 항목(평가항목 목록에서 포함한 것 — 연구내용 사전조사 · 진도보고서 작성, 분류한 연구내용 등)은 뺄 수 없다(사용자가 목록에서 끈다).',
    '- research: 연구개발계획서의 연구내용 상위 항목 value(아래 목록의 이름 그대로)에 난이도 등급 level(가|나|다)을 매긴다(한 번에 10개 이내 — 연구수당 평가에 의미 있는 상위 항목만, 비슷한 항목은 하나로; 2026-10-21 사용자 "10장 이내로 추출") — 지침 1) 의 가·나·다 평가항목(가: 연구총괄·규칙/IMO 등재·SCI 논문·국제특허·설계/해석/검증 S/W·기술문서·최종보고서 / 나: 계획서·협약·기준/절차/지침서·KCI 논문·알고리즘/제어기술·국내특허·연구홍보 / 다: 사전조사·발표·진도보고서)과 견주어 가장 가까운 항목의 등급으로, 애매하면 낮은 등급. 매긴 항목은 평가항목 목록에 기본 포함돼 모든 연구자에게 저절로 들어간다(사용자가 끄거나 그룹을 정함) — item_add 로 다시 넣지 않는다.',
    '- merge: field sa(S+A 통합) 또는 cd(C+D 통합)를 value on|off — 참여연구원 5명 이상일 때만.',
    '- adjust: field S|A|B|C|D 등급의 몫에 value %p 를 더한다(±10 안, 모든 등급 조정의 합은 0 인 제로섬 — 한쪽을 올리면 다른 쪽을 같은 만큼 내리는 adjust 를 같이 넣는다. 0 이면 지움).',
    '- bydept: 부서별 등급 배정을 value on|off.',
    '- auto: 수동 등급·부서별 자리 조율·확정을 모두 지우고 합산기여도 순 자동 배정으로 되돌린다.',
  ].join('\n');

  /* 연구수당 지침 기본 글 — references/10-53_국가연구개발과제_연구수당지급기준_20240305.md 를 옮겨 적음. 사용자가 [지침]에서 고쳐 쓰는 바탕 */
  const DEFAULT_RULES = [
    '# 연구수당 지침 — 10-53 국가연구개발과제 연구수당 지급 기준 (2024-02-27 개정, 2024-03-05 시행). 연구수당 도우미가 요청을 작업으로 옮기고 질문에 답할 때 근거로 삼는 글입니다. 채팅 머리의 [지침]에서 고칠 수 있어요(원문 정리: references/10-53_국가연구개발과제_연구수당지급기준_20240305.md).',
    '',
    '## 제1장 총칙',
    '- 제1조(목적) 연구개발(R&D) 업무관리에 관한 규칙 제18조(연구 수당의 지급)에 의한 연구수당 지급의 세부 사항을 정한다.',
    '- 제2조(적용범위) 선급에 재직하고 있는 직원이 수행하는 국가연구개발과제("연구과제")에 적용한다.',
    '- 제3조(정의) 연구수당 = 당해 연구과제 수행과 관련하여 연구에 참여한 자에게 직접비에서 지급되는 연구보상·장려금 지급을 위한 수당. 전문기관 = 과학기술기본법 제11조제4항에 따라 연구개발과제의 기획·관리·평가·활용 업무를 대행하는 기관.',
    '',
    '## 제2장 연구수당의 지급',
    '- 제4조(지급대상) 연구과제에 실제로 참여하였거나 지급기준일 현재 참여하고 있는 자로서 연구계획서에 연구책임자·연구자(연수인력, 외부 기관 파견자, 미지급 인건비로 계상되어 참여하는 자 등 포함)로 등록된 자. 확장에서는 역할이 행정지원(연구지원)인 사람은 대상이 아니다.',
    '- 제5조(지급액의 범위) 연구수당 총지급액은 국가연구개발사업의 연구개발비 관련 규정에 따른다.',
    '- 제6조(지급액 산정) ① 제5조의 범위 안에서 전체 참여연구자를 대상으로 종합적인 기여도(연구참여도·연구성과·창의성 등)를 평가한 뒤 지급한다. ② 표 1 의 기준에 따라 별지 1 로 연구수행 기여도 평가를 하되, 과제 특성에 따라 세부 산정기준 일부를 바꿀 수 있다. 단, 논문·특허를 제외한 각 평가항목은 참여연구자간 가중치 합이 1 이어야 한다. ③ 별지 1 평가서와 별지 2 지급내역서를 작성해 연구자의 서명을 받은 뒤 지급하고, 이의가 있으면 별지 3 이의 신청서로 소속 연구주관 부서장을 통해 조정한다. ④ 개인별 지급액은 전문기관의 별도 관리 규정에 따르고, 당해연도 개인별 연구수당 지급 총액은 표 2 의 지급상한을 초과할 수 없으며, 초과 금액은 계속비 편성 또는 예산변경으로 사용하거나 전문기관에 반납한다(다른 사람에게 재배분하는 규정은 없다).',
    '- 표 1 연구수행 기여도 평가기준: 참여도 30%(연구과제 참여율) · 성과기여도 60%(프로젝트 책임/관리, 선급기술규칙/IMO 문서 등재, 기준/절차서 개발, 설계해석 S/W 개발, 논문·특허 출원/등록, 최종보고서 작성, 기술문서 발간) · 연구수행 성실성 10%(참여연구원간 협력·소통, 적극성). 연구책임자가 평가 자료로 참여연구원별로 종합 평가하고, 각 평가등급의 합계는 기준 백분율과 같아야 하며, 기여도 평가를 바탕으로 지급금액을 산정한다. 논문은 국내 학술지·국외 SCI(E) 논문·학술발표(국내/국제 발표자)를 인정한다.',
    '- 표 2 직급별 연구수당 지급상한(기본연봉 기준, 기여도 평가 시점 직급): P1 18% · P2 20% · P3 22% · P4 24% · G1·G2·G3(전임직군 기술·행정)·C(기술계약직) 22%.',
    '- 제7조(지급시기) 전문기관 규정에 따라 지급하되 연구시작일 1개월 이내에는 지급할 수 없다.',
    '- 제8조(지급절차) 별지 1·2 에 대해 연구주관본부장(친환경선박해양연구소는 연구소장, 디지털기술원은 기술원장)의 승인을 받은 뒤 지급한다.',
    '- 부칙: 2024년 3월 5일부터 시행.',
    '',
    '## 별지 1 연구수행 기여도 평가서',
    '- 1. 일반 정보: 연구과제명 · 당해연도 연구기간 · 연구책임자명(인) · 인건비 계상금액 · 연구수당 계상금액.',
    '- 2. 평가 내용(사람마다): 부서명 · 성명 · 직급 · 참여도 평가(30%) 참여율 → 환산비율(a) · 성과 기여도 평가(60%) 평가항목·등급·건수·가중치·기여도 → 기여율(b) · 기타(10%) 평가점수 → 환산비율(c) · 합산 기여도 · 평가등급. 계 줄의 a·b·c·합산 기여도는 각각 100.',
    '- 1) 평가항목 및 난이도 등급 — 가(50점): 연구총괄 및 관리 · 선급기술규칙/IMO문서등재 · 논문(SCI(E)) · 특허(국제) · 설계,해석 및 검증 S/W 개발 · 기술문서 발간 · 최종보고서 작성 · 기타 / 나(30점): 연구계획서작성(선정평가포함) · 연구과제 협약(주관기관만해당) · 기준/절차/가이드라인/지침서 · 논문(KCI) · 알고리즘/제어기술 개발 · 특허(국내),실용신안,의장 · 연구홍보(연구활동보고서, 기고문 등) · 기타 / 다(10점): 연구내용 사전조사 · 학술발표(국내/국제-발표자) · 세미나발표(발표자) · 진도보고서 작성 · 기타. 평가항목(점수 배분)은 연구책임자가 연구특성에 따라 추가할 수 있다. 논문 투고·특허 출원은 세부 산정기준에 따른다. 논문·특허를 제외한 항목은 연구책임자가 참여연구원간 기여도율을 백분율로 배분한다(예: 최종보고서를 2명이 작성하면 가중치 0.6 과 0.4 — 합 1). S/W·알고리즘/제어기술 개발은 선급업무 관련 설계·해석·검증용으로 개발된 것을 말한다. 기여도 = 평가항목 등급 점수 × 가중치(× 건수).',
    '- 1-1) 논문 등재 개인별 가중치: 제1저자 — 단독 1 · 2인 공동 0.8 · 3인 공동 0.7 · 4인 이상 0.6 / 제2저자 — 2인 0.4 · 3인 0.3 · 4인 이상 0.3 / 제3저자 — 3인 0.2 · 4인 이상 0.2 / 제4저자 이상 — 0.1/(N−3), N 은 참여자 수. 교신저자는 주저자의 70%, 복수의 교신저자는 제2저자 가중치.',
    '- 1-2) 산업재산권 가중치: 등록 1 · 출원 0.6 · 실용신안 0.6 · 의장 0.5. 같은 기술의 국제특허는 1개국마다 추가 등록 점수, 직무발명 신고 없이 개인 명의로 출원·등록한 것은 반영하지 않음, 같은 사항이 중복되면 유리한 것을 적용, 실적자가 여럿이면 연구책임자가 개인별 기여율을 평가.',
    '- 2) 기여율(b) = 개별 참여연구원의 기여도 합 ÷ 전체 참여연구원 기여도 합 × 100. 3) 기타(c) = 협력/소통·적극성 등을 연구책임자가 우수(100) · 양호(75) · 보통(50) · 미흡(25)으로 평가해 전체 대비 백분율로. 4) 합산기여도 = (a×0.3) + (b×0.6) + (c×0.1).',
    '- 5) 평가등급: S 상위 10% · A 상위 20% · B 40% · C 하위 20% · D 하위 10%. 5-1) 평가등급별 인원 배분기준(참여 연구원 수 → S·A·B·C·D 인원): 1→1·0·0·0·0 / 2→1·1·0·0·0 / 3→1·1·1·0·0 / 4→1·1·1·1·0 / 5→1·1·1·1·1 / 6→1·1·2·1·1 / 7→1·2·2·1·1 / 8→1·2·3·1·1 / 9→1·2·3·2·1 / 10→1·2·4·2·1 / 11→1·3·4·2·1 / 12→1·3·5·2·1 / 13→1·3·5·3·1 / 14→1·3·6·3·1 / 15→1·3·6·3·2 / 16→2·3·6·3·2 / 17→2·3·7·3·2 / 18→2·4·7·3·2 / 19→2·4·8·3·2 / 20→2·4·8·4·2 / 21→2·5·8·4·2 / 22→2·5·9·4·2 / 23→2·5·9·5·2 / 24→2·5·10·5·2 / 25→3·5·10·5·2 / 26→3·5·10·5·3 / 27→3·5·11·5·3 / 28→3·6·11·5·3 / 29→3·6·11·6·3 / 30→3·6·12·6·3 / 31→3·7·12·6·3 / 32→3·7·13·6·3 / 33→3·7·13·7·3 / 34→3·7·14·7·3 / 35→4·7·14·7·3 / 36→4·7·14·7·4 / 37→4·7·15·7·4 / 38→4·8·15·7·4 / 39→4·8·15·8·4 / 40→4·8·16·8·4. 연구과제 특성에 따라 참여연구원이 5명 이상이면 연구책임자가 S 와 A 등급 또는/및 C 와 D 등급을 통합할 수 있다(예: 30명 — 5등급 S3·A6·B12·C6·D3 / 3등급 S+A 9·B12·C+D 9 / 4등급 S3·A6·B12·C+D 9 / 4등급 S+A 9·B12·C6·D3).',
    '',
    '## 별지 2 연구수당 지급 내역서',
    '- 1. 일반 정보: 연구과제명 · 연구기관명 · 연구책임자명(인) · 당해년도 연구기간 · 연구수당 계상금액 · 연구수당 집행 가능액 · 총 지급액. 2. 지급 내역(사람마다): 부서명 · 성명 · 직급 · 기여도(별지 1 의 합산 기여도) · 평가등급(별지 1 의 평가등급) · 기여내용 및 미지급 사유 · 지급비율(배분기준) · 지급액 · 서명. 계 줄의 지급비율은 100.',
    '- 미지급 사유: 연구연가, 퇴직, 휴직, 병가, 연수, 파견, 전출, 참여연구원 변경, 연구성과 미흡, 연구성과 미기여, 기타 등. 퇴직·휴직·병가·파견 등 서명을 받을 수 없는 경우를 제외하고 참여연구원의 서명을 받아야 한다.',
    '- 평가등급별 지급비율 배분기준(참여 연구원 수 → S/A/B/C/D 등급 전체의 몫 %, 같은 등급 안에서는 인원수로 N분): 1→100/0/0/0/0 · 2→60/40/0/0/0 · 3→50/30/20/0/0 · 4→40/30/20/10/0 · 5→38.8/26.2/17.5/11.7/5.8 · 6→33/22.3/29.9/9.9/4.9 · 7→26.3/37.1/24.7/7.9/4 · 8→23.5/32.8/33.1/7/3.6 · 9→22.7/30.3/30.2/13.4/3.4 · 10→20.8/27.5/36.3/12.2/3.2 · 11→17.7/36.5/32.5/10.7/2.6 · 12→16.5/33.7/37.4/9.9/2.5 · 13→16.4/31.9/35.1/14.1/2.5 · 14→15.5/29.7/39.2/13.3/2.3 · 15→16.3/29/37.3/12.9/4.5 · 16→25.3/25.5/33.9/11.4/3.9 · 17→24.1/24.2/37.4/10.8/3.5 · 18→22/29.9/34.9/9.9/3.3 · 19→21/28.4/37.9/9.5/3.2 · 20→20.8/27.5/36.3/12.2/3.2 · 21→19.1/32.2/34.4/11.4/2.9 · 22→18.5/30.9/36.9/11/2.7 · 23→18.4/30/35.6/13.3/2.7 · 24→17.7/28.8/38/12.8/2.7 · 25→23.5/26.6/35.8/11.8/2.3 · 26→23.6/26.3/34.8/11.7/3.6 · 27→22.9/25.4/37/11.3/3.4 · 28→21.6/29/35.5/10.7/3.2 · 29→21.4/28.4/34.4/12.6/3.2 · 30→20.8/27.5/36.3/12.2/3.2 · 31→19.7/30.7/34.9/11.7/3 · 32→19.2/29.8/36.8/11.4/2.8 · 33→19.1/29.2/35.9/13/2.8 · 34→18.6/28.5/37.5/12.7/2.7 · 35→22.7/26.9/35.9/11.9/2.6 · 36→22.8/26.7/35.3/11.9/3.3 · 37→22.3/26/36.8/11.6/3.3 · 38→21.4/28.6/35.6/11.2/3.2 · 39→21.2/28.2/34.9/12.5/3.2 · 40→20.8/27.5/36.3/12.2/3.2.',
    '- 연구과제 특성에 따라 연구책임자가 등급간 지급비율을 최대 10% 범위 안에서 제로섬 방식으로 조정할 수 있다. 등급별 최소 3% 이상 지급해야 하며, 하위등급 개인별 지급액은 상위등급 개인별 지급액을 초과할 수 없다. 등급을 통합하면(S-A, C-D) 통합 등급의 합산 비율을 적용한다.',
    '- 합산기여도가 동점이면 상위등급으로 결정하되, 지급비율은 하위등급 비율(동점자 수만큼)을 상위 비율에 합산해 N분한다(예: 14명에서 동점으로 A 등급이 4명(기준 3명)이면 B 등급 1인분 7% 를 A 등급 30% 에 합산해 4명이 나눠 1인 9.25%).',
    '',
    '## 확장이 셈하는 방식(위 지침을 그대로)',
    '- 지급액 = 집행 가능액 × 지급비율(원 단위 절삭). 집행 가능액은 비우면 계상금액 − 집행. 등급은 합산기여도 내림차순으로 인원 배분기준대로(동점은 상위등급), 수동 등급(rank)·부서별 자리로 바꿀 수 있고 기준보다 많은 등급은 넘친 사람마다 빈 등급의 1인 몫을 가져와 N분한다.',
    '- 개인별 연간 상한(표 2)은 남은 연구수당(자료 요청 응답 · 내 HR 급여)을 알 때만 "초과·여유" 로 보이며, 초과분은 재배분하지 않고 알림만 — 예산변경·계속비 편성 또는 반납.',
  ].join('\n');
  const RULES_HEAD = '연구수당 지침 — 사용자가 연구수당 도우미의 [지침]에서 관리하는 글이다. 요청이 이 지침에 어긋나면 ops 를 비우고 reply 로 까닭을 알리고, 지침 질문에는 이 글을 근거로 답한다:';
  const rulesOf = (v) => multi(v, LIMIT.rules);

  /* 요청 본문 → 검사·정리한 입력 (글이 비면 throw) */
  function clean(body) {
    const b = body && typeof body === 'object' ? body : {};
    const text = str(b.text, LIMIT.text);
    if (!text) throw new Error('요청 글이 비어 있습니다');
    const s = b.snapshot && typeof b.snapshot === 'object' ? b.snapshot : {};
    const lines = (v) => list(v, LIMIT.lines).map((x) => str(x, LIMIT.line)).filter(Boolean);
    const num = (v) => (v == null || v === '' ? null : fin(v));
    const adjust = {}; for (const k of GRADES) adjust[k] = num(s.adjust && s.adjust[k]) || 0;
    return {
      text,
      rules: rulesOf(b.rules),
      files: list(b.files, LIMIT.files).map(fileOf).filter(Boolean),
      history: list(b.history, LIMIT.history).map((h) => ({ role: h && h.role === 'assistant' ? 'assistant' : 'user', text: str(h && h.text, LIMIT.turn) })).filter((h) => h.text),
      snapshot: {
        prjNo: str(s.prjNo, 40), alias: str(s.alias, 40), prjNm: str(s.prjNm, 120), year: Number.isInteger(Number(s.year)) && Number(s.year) >= 1 ? Number(s.year) : 1, rspr: str(s.rspr, 40), period: str(s.period, 40), org: str(s.org, 40),
        pool: num(s.pool), avail: num(s.avail), payTotal: num(s.payTotal), n: Math.max(0, Math.round(Number(s.n) || 0)),
        merge: { sa: !!(s.merge && s.merge.sa), cd: !!(s.merge && s.merge.cd) }, adjust, byDept: !!s.byDept,
        names: Array.from(new Set(list(s.names, LIMIT.names).map((x) => str(x, LIMIT.name)).filter(Boolean))),
        people: lines(s.people), groups: lines(s.groups), depts: lines(s.depts), warnings: lines(s.warnings), hasPlan: !!s.hasPlan,
        research: list(s.research, 40).map((x) => ({ name: str(x && x.name, 120), level: LEVELS.includes(x && x.level) ? x.level : '', text: str(x && x.text, 300) })).filter((x) => x.name),   // 연구개발계획서 상위 항목(이름 · 매겨진 등급 · 세부)
      },
    };
  }

  /* 입력 → { text(사용자 메시지 — 계산 요약 · 작업 안내 · 이전 대화 · 요청), schema(--json-schema), system(--system-prompt — SYSTEM 뒤에 연구수당 지침) } */
  function build(input) {
    const s = input.snapshot, h = input.history || [];
    const won = (v) => (v == null ? '없음' : `${fmt(v)}천원`);
    const lines = ['[연구수당 계산 — 채팅 요청] 아래 계산 상태를 보고 사용자의 요청을 작업(ops)으로 옮기거나, 지침 질문이면 답하세요.'];
    lines.push(`과제: ${s.alias ? `${s.alias} — ` : ''}${s.prjNm || ''} (${s.prjNo}) · ${s.year}차년도 · 연구기간 ${s.period || '미정'} · 연구책임자 ${s.rspr || '(모름)'}`);
    lines.push(`연구기관명 ${s.org || '한국선급'} · 연구수당 계상금액 ${won(s.pool)} · 집행 가능액 ${won(s.avail)} · 인건비 계상금액 ${won(s.payTotal)}`);
    lines.push(`지급 대상 ${s.n}명 · 등급 통합 ${s.merge.sa ? 'S+A ' : ''}${s.merge.cd ? 'C+D' : ''}${!s.merge.sa && !s.merge.cd ? '없음' : ''} · 등급 조정 ${GRADES.filter((k) => s.adjust[k]).map((k) => `${k} ${s.adjust[k] > 0 ? '+' : ''}${s.adjust[k]}%p`).join(' · ') || '없음'} · 부서별 배정 ${s.byDept ? '켬' : '끔'}`);
    if (s.groups.length) { lines.push(`등급 몫(참여 연구원 ${s.n}명 기준 — 인원 배분 · 등급 전체 몫 %):`); for (const l of s.groups) lines.push(`- ${l}`); }
    if (!s.hasPlan) lines.push('참여연구원 계획이 아직 없습니다 — 참여연구원 변경 화면에서 계획을 세워야 계산할 수 있습니다(여기서는 할 수 없음).');
    else if (s.people.length) { lines.push('참여연구원 (금액은 천원, 비율은 %):'); for (const l of s.people) lines.push(`- ${l}`); }
    if (s.depts.length) { lines.push('부서별 등급 자리:'); for (const l of s.depts) lines.push(`- ${l}`); }
    if (s.research.length) { lines.push(`연구개발계획서 ${s.year}차년도 연구내용 상위 항목(research 작업으로 가·나·다 등급을 매길 수 있음 — [ ] 안은 지금 매겨진 등급):`); for (const x of s.research) lines.push(`- ${x.name} [${x.level || '분류 전'}]${x.text ? ` — ${x.text}` : ''}`); }
    if (s.warnings.length) { lines.push('알림:'); for (const w of s.warnings) lines.push(`- ${w}`); }
    lines.push(...filesLines(input.files, '성과 항목(논문·특허·보고서 등 실적)·기타 평가·부서·직급의 근거로 쓰고'));
    lines.push('', OPS_GUIDE);
    if (h.length) { lines.push('', '이전 대화:'); for (const t of h) lines.push(`${t.role === 'user' ? '사용자' : '도우미'}: ${t.text}`); }
    lines.push('', `요청: ${input.text}`);
    const op = { type: 'object', additionalProperties: false,
      required: ['op', 'name', 'field', 'value', 'level', 'count', 'weight'],
      properties: {
        op: { type: 'string', enum: OPS.slice() }, name: { type: 'string', enum: s.names.concat(['']) }, field: { type: 'string', enum: FIELDS.concat(['']) },
        value: { type: 'string' }, level: { type: 'string', enum: LEVELS.concat(['']) }, count: { type: 'number' }, weight: { type: 'number' },
      } };
    const schema = { type: 'object', additionalProperties: false, required: ['reply', 'ops'], properties: { reply: { type: 'string' }, ops: { type: 'array', items: op } } };
    const system = input.rules ? `${SYSTEM}\n\n${RULES_HEAD}\n${input.rules}` : SYSTEM;
    return { text: lines.join('\n'), schema, system };
  }

  const pick = (names, n) => { const k = nameKeyOf(n); return k ? names.find((x) => nameKeyOf(x) === k) || '' : ''; };
  /* 작업 하나 검사 — 통과하면 그 작업에 필요한 칸만 남긴 객체, 아니면 null */
  function checkOp(raw, names, research) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const op = str(r.op, 20), name = pick(names, str(r.name, LIMIT.name)), field = str(r.field, 10), value = String(r.value == null ? '' : r.value).trim();
    switch (op) {
      case 'pool': case 'avail': { const n = value === '' ? null : fin(value); if (value !== '' && !(n >= 0)) return null; return { op, value: n }; }
      case 'org': return { op, value: str(value, 40) };
      case 'person': {
        if (!name || !PERSON_FIELDS.includes(field)) return null;
        if (field === 'etc') { if (value === '') return { op, name, field, value: '' }; const v = ETC[value] || ETC[String(fin(value))]; return v ? { op, name, field, value: String(v) } : null; }
        if (field === 'out') { const v = onOff(value); return v ? { op, name, field, value: v } : null; }
        if (field === 'rank') { const v = value.toUpperCase(); return !v || GRADES.includes(v) ? { op, name, field, value: v } : null; }
        return { op, name, field, value: str(value, field === 'note' ? 200 : field === 'grade' ? 20 : 40) };
      }
      case 'item_add': { const item = str(value, 80); if (!name || !item) return null; const count = fin(r.count), weight = fin(r.weight); return { op, name, value: item, level: LEVELS.includes(r.level) ? r.level : '가', count: count > 0 ? count : 1, weight: weight >= 0 && r.weight !== 0 ? weight : 1 }; }
      case 'item_del': { const item = str(value, 80); return name && item ? { op, name, value: item } : null; }
      case 'research': { const k = itemKeyOf(value), hit = k ? (research || []).find((x) => itemKeyOf(x) === k) : ''; return hit && LEVELS.includes(r.level) ? { op, value: hit, level: r.level } : null; }
      case 'merge': { const v = onOff(value); return (field === 'sa' || field === 'cd') && v ? { op, field, value: v } : null; }
      case 'adjust': { const v = fin(value); return GRADES.includes(field) && v != null ? { op, field, value: v } : null; }
      case 'bydept': { const v = onOff(value); return v ? { op, value: v } : null; }
      case 'auto': return { op };
      default: return null;
    }
  }
  /* Claude 의 구조화 출력 → { reply, ops, dropped } */
  function parse(input, out) {
    const o = out && typeof out === 'object' ? out : {};
    const names = (input && input.snapshot && input.snapshot.names) || [], research = ((input && input.snapshot && input.snapshot.research) || []).map((x) => x.name);
    const ops = []; let dropped = 0;
    for (const raw of list(o.ops, LIMIT.ops)) { const op = checkOp(raw, names, research); if (op) ops.push(op); else dropped++; }
    return { reply: str(o.reply, LIMIT.reply), ops, dropped };
  }

  /* 작업 한 줄 글(채팅의 반영 목록 · 이전 대화 요약) */
  function opText(op) {
    const o = op || {};
    const FIELD = { dept: '부서', grade: '직급', etc: '기타 평가', note: '기여내용·사유', out: '미지급', rank: '평가등급' };
    switch (o.op) {
      case 'pool': return `연구수당 계상금액 ${o.value == null ? '예산 줄 값으로' : `${fmt(o.value)}천원`}`;
      case 'avail': return `집행 가능액 ${o.value == null ? '기본값으로' : `${fmt(o.value)}천원`}`;
      case 'org': return `연구기관명 ${o.value || '(기본)'}`;
      case 'person': return `${o.name} — ${FIELD[o.field] || o.field} ${o.field === 'etc' ? (o.value ? `${ETC_LABEL[o.value] || ''}(${o.value})` : '미평가') : o.field === 'out' ? (o.value === 'on' ? '켬' : '끔') : o.field === 'rank' ? (o.value || '자동') : (o.value || '(비움)')}`;
      case 'item_add': return `${o.name} — 성과 항목 ${o.value} (${o.level} · ${fmt(o.count)}건 · 가중치 ${o.weight})`;
      case 'item_del': return `${o.name} — 성과 항목 ${o.value} 빼기`;
      case 'research': return `연구내용 "${o.value}" — ${o.level} 등급`;
      case 'merge': return `${o.field === 'sa' ? 'S+A' : 'C+D'} 통합 ${o.value === 'on' ? '켬' : '끔'}`;
      case 'adjust': return `${o.field} 등급 조정 ${o.value > 0 ? '+' : ''}${o.value}%p`;
      case 'bydept': return `부서별 배정 ${o.value === 'on' ? '켬' : '끔'}`;
      case 'auto': return '자동 배정으로 되돌리기';
      default: return String(o.op || '');
    }
  }

  const api = { clean, build, parse, checkOp, opText, rulesOf, fileOf, SYSTEM, OPS_GUIDE, DEFAULT_RULES, LIMIT, OPS, FIELDS, LEVELS, GRADES, ETC, ETC_LABEL };
  if (typeof module === 'object' && module.exports) module.exports = api;   // Help 서버 (Node)
  else g.KRX_ALLOW_CHAT_CORE = api;                                        // 확장 (popup.html script · 테스트)
})(typeof self !== 'undefined' ? self : globalThis);
