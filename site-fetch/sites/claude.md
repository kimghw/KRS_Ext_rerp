hosts: claude.ai, anthropic.com
[Claude(Anthropic)] 출처: krs-web-agents references/구독결제포털_영수증수집.md (2026-08-03 실측) + site-fetch 실제 찾아오기 (2026-10-14, 7/6 USkrs-web-agents references/구독결제포털_영수증수집.md (2026-08-03 실측),320 — 61초)
- 청구: https://claude.ai/settings/billing (Invoices 목록). 화면 탐색보다 내부 API 가 확실하다 — eval 로 조회:
  fetch('/api/organizations').then(r=>r.json()) → 조직마다 uuid → fetch('/api/stripe/<uuid>/invoices?limit=24').then(r=>r.json()) (응답은 배열이거나 {invoices:[...]}; 결제 없는 조직은 null — 다음 조직).
  항목: created_ts(결제 시각 epoch 초 → 한국 시간으로 바꿔 카드 사용일과 맞춤), total(센트, 132000 = US$1,320.00), currency, hosted_invoice_url(Stripe 인보이스 페이지), invoice_pdf_url(PDF 직링크 → saveurl).
  total 0 은 카드 결제 없음(기프트·크레딧) — 제외. 같은 달 여러 건일 수 있어 결제 시각으로 1:1 로 맞춘다.
- Stripe 인보이스 페이지는 ChatGPT 와 같은 구조("Download invoice"·"Download receipt").
- 로그인은 이메일 코드·Google 로그인뿐(비밀번호 칸 없음) → 로그인돼 있지 않으면 "열린 Chrome 창에서 claude.ai 로그인을 해 주세요" 라고 말하고 waitfor 로 기다린다.
- 확인된 길(2026-10-14): 위 API 로 결제 시각·금액을 맞춘 뒤 hosted_invoice_url(Stripe 페이지)의 "청구서 다운로드"·"영수증 다운로드"를 download 로 — 둘 다 거래명세서 종류. 같은 금액의 선물(gift) 결제가 다른 날에도 있었다(7/6·7/22 모두 US$1,320) — 카드 사용일과 Stripe 결제일(영수증의 Date paid)로 고른다. 청구서 작성 시각(created_ts)은 결제일보다 하루 늦을 수 있다.
