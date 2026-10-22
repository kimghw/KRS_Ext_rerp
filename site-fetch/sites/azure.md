hosts: portal.azure.com, azure.com, azure.net, microsoft.com, microsoftonline.com, live.com
[Microsoft Azure] 출처: krs-web-agents references/구독결제포털_영수증수집.md (2026-07-19 실측) + site-fetch 실제 찾아오기 (2026-10-14 · 2026-10-22 실측, 10/9 G190457040 — 37초)
- 인보이스: https://portal.azure.com/#view/Microsoft_Azure_GTM/ModernBillingMenuBlade/~/Invoices (신 블레이드 Billing.MenuView/~/invoices/… 로 저절로 이동). legacy BillingMenuBlade/~/invoice 는 쓰지 않는다(권한에 따라 빈 표·검색 오류). 2026-10-22 에는 청구 메뉴 블레이드가 먼저 떠서 왼쪽 메뉴의 청구 › 청구서를 한 번 눌러 Billing.MenuView/~/invoices/…/scope/BillingAccount(청구 계정 범위)로 갔다.
- 인보이스 그리드는 메인 화면이 아니라 Azure 확장 iframe(다른 출처 프레임) 안에 그려진다 — look 의 "(프레임 …)" 요소·본문을 보고, 스크롤도 프레임 안. 로딩이 느리면 wait 뒤 다시 look.
- 그리드 열(영문): Invoice ID · Invoice date (UTC) · Billing period (UTC) · Billing profile · Total amount · Status · Pay · Download invoice. 날짜 M/D/YYYY(예 7/9/2026), 한국어면 "2026. 6. 1.". 빈 상태 "No items to display"/"표시할 항목 없음". ₩0 인보이스 행도 있다.
- 행의 Download(다운로드) 아이콘은 메뉴 없이 인보이스 PDF(G<ID>_<guid>.pdf)를 내려받는데, 서버가 PDF 를 만드는 동안 10~20초 뒤에 시작된다(오른쪽 위 알림 수가 늘어남) — download <번호> 거래명세서 한 번만 누르고 기다린다. 다시 누르면 같은 PDF 가 또 오고, "추가 작업(…)" 메뉴에는 가격표뿐이다(2026-10-14 실측).
- 카드 가맹점 이름이 "Microsoft-G190457040" 처럼 "Microsoft-G<숫자>" 면 G<숫자>가 그 결제의 Azure 인보이스 ID(Invoice ID 열)다 — 날짜·금액보다 먼저 그 ID 의 행을 고른다(2026-08 "Microsoft-G176740268" 행이 Azure 8월분이었음). 카드 가맹점 이름은 전각 글자(Ｍｉｃｒｏｓｏｆｔ－Ｇ１９０４５７０４０)로 올 수 있다 — 숫자만 읽어 맞춘다.
- 카드 금액은 인보이스 원화(₩) 총액보다 2~3% 많을 수 있다(해외 결제 환산·수수료로 보임 — 2026-10 G190457040: 인보이스 ₩589,796 ↔ 카드 603,566원, 13,770원 차이). G<숫자>가 맞으면 금액이 달라도 그 인보이스이고, note 에 차이를 적는다. 다른 행을 찾아다니지 않는다.
- 카드 영수증은 따로 없다 — 거래명세서 = 인보이스 PDF. 카드 승인일은 인보이스 날짜와 며칠 다를 수 있다.
- 로그인: login.microsoftonline.com / login.live.com (이메일 → 다음 → 비밀번호). Authenticator 승인·문자 인증이 나오면 추가 인증으로 기다린다. "로그인 상태 유지?" 에는 "예".
- 로그인 세션이 있는 곳(2026-10-22 실측): 이 PC 의 Azure(회사 Microsoft 계정) 세션은 **KRS 전용 Chrome(9333)** 에 있어 바로 청구 화면이 열린다. **SUB 전용(9444)** 은 시작 주소가 계정 선택 화면(login.microsoftonline.com)으로 가고 계정을 고르면 Authenticator 코드를 요구한다 — 그 창에서 사용자가 인증하지 않으면 waitfor 300초 뒤 "추가 인증 필요" 로 끝난다. 로그인 화면이 나오면 다른 길을 찾지 말고 곧바로 waitfor.
- Microsoft 365·Copilot 같은 비Azure 구매는 https://admin.microsoft.com/#/billoverview/invoice-list (기업) 또는 https://account.microsoft.com/billing/orders (개인)에서 찾는다.
