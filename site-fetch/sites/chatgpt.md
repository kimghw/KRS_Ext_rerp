hosts: chatgpt.com, openai.com
[ChatGPT(OpenAI)] 출처: krs-web-agents references/구독결제포털_영수증수집.md (2026-10-01 실측) + site-fetch 실제 찾아오기 (2026-10-14, 9/24 ₩299,000 — 45초)
- 청구 화면: https://chatgpt.com/settings/billing 로 바로 간다(설정이 모달에서 전체 페이지로 바뀜 — 예전 #settings 모달·Billing 탭 아님). 목록 제목 "Transaction history", 행 예: "ChatGPT Pro 200 / 9/24/2026 / Paid / ₩299,000"(날짜는 M/D/YYYY 또는 "YYYY년 M월"). 요금제 제목이 먼저 그려지므로 목록이 뜰 때까지 기다린다.
- 행의 인보이스 링크는 글자 없는 아이콘 링크(invoice.stripe.com/i/...)다 — "View" 글자로 찾지 말 것. 다른 행의 글자가 섞이지 않게 그 행의 링크를 고른다. 인보이스는 결제(갱신)일에 발행된다.
- Stripe 인보이스 페이지: "Download invoice"(청구서)·"Download receipt"(카드 영수증, 카드 뒤 4자리) 두 버튼 — 둘 다 download 로 받아 "거래명세서" 종류로 저장한다.
- 로그인 판정: 비로그인 익명 화면에도 입력창이 보인다. 확실한 비로그인 신호는 사이드바의 "Log in"/"See plans and pricing". 로그인은 auth.openai.com(이메일 → 비밀번호, 메일 인증코드가 나올 수 있음 → 추가 인증). "Continue with Google/Microsoft" 는 누르지 않는다.
- 쿠키 동의 배너("We use cookies")가 클릭을 가로챈다 — "Reject non-essential" 로 닫는다.
- 확인된 길(2026-10-14, 한국어 화면): settings/billing → "거래 내역" 표에서 날짜가 맞는 행의 아이콘 링크(접근성 이름 "YYYY년 M월 D일의 청구서 열기") → Stripe 페이지의 "청구서 다운로드"·"영수증 다운로드"를 각각 download 로 — 둘 다 거래명세서 종류로 저장(영수증에 Visa •••• 4126 · 결제일 · ₩금액). 카드 승인일과 결제일이 같았다.
