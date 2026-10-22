/* 증빙 찾아오기(0.8.5)의 "자주 사용" 가맹점 목록 — 패널(lib/prep.js · lib/render.js) · 설정 페이지 · 백그라운드(lib/prep-fetch.js) 공용.
 * 카드 가맹점 이름에 등록한 글자(match)가 들어 있으면 그 사이트로 찾아온다(Help 서버의 site-fetch — 다른 웹 사이트에 가는 부분은 저장소의 site-fetch/ 폴더에 따로 있다).
 *  storage.local.fetchSites = [{ id, label(이름), match(가맹점 글자, 쉼표로 여럿), url(시작 주소 — 구매내역·청구 화면이면 좋음), kind(lecture 강의 | subscription 구독 | other 기타),
 *                               docs(가져올 서류 이름 — 첨부 파일 종류가 됨. [] 면 종류 기본 = 설정 help.fetchDocs[kind] 를 따름), docsV(2 = 이 규칙으로 저장됨), hint(찾는 곳 메모 — 알려진 가맹점은 업체별 기본 KNOWN hint), hintV(1 = 업체별 메모가 생긴 뒤 저장됨),
 *                               at · by(올리는 칸 — 이름·가맹점 글자·주소·종류·필요 서류·찾는 곳 메모·기억한 찾는 방법 — 을 마지막으로 고친 시각(ms)·사람: 고칠 때 stamp 가 찍고 공유 (Plus) 가맹점 파일에서 날짜가 늦은 쪽이 이김, 2026-10-22),
 *                               howto(지난번에 Claude 가 찾은 방법, 다음 요청에 참고로), issue(개선점 — 사용자가 적은 안 되는 점·해야 할 것, 2000자·줄 바꿈 유지: 설정 페이지 가맹점 칸의 [Help 에 개선 요청]이 찾는 방법 익히기로 보내 Claude 가 사이트 안내·손잡이를 고치고 끝나면 비움, 2026-10-21), browser(로그인해 둔 Chrome — 바탕화면 Chrome 바로가기 이름 "SUB 전용" · 디버그 포트 "9444" · 주소. 비우면 서버 기본 site-fetch/local.json — site-fetch/chrome.js), ts, last: { ts, state, n, msg } }]
 *  필요 서류 = docsOf(site, 설정 help.fetchDocs): 가맹점이 따로 고른 서류가 있으면 그것, 아니면 그 종류의 필요 서류(강의 = 강의내용·견적서·수강증, 구독 = 거래명세서 — 설정에서 바꿈).
 *    패널은 그 서류가 첨부 파일 종류로 다 있는지 보이고(render.js), 찾아오기는 아직 없는 서류만 찾는다(prep-fetch.js). 있으면 받는 서류(EXTRA — 강의의 수료증, extraOf)는 ✓/○ 로 보이고 아직 없으면 같이 찾되 없어도 ✗ 가 아니다
 *  storage.local.fetchCred  = { [id]: { id(아이디), pw(비밀번호) } } — 비밀번호는 이 키에만(암호화 없음, 동기화 안 함). 백그라운드와 설정 페이지·사이드 패널(확장 페이지)만 쓴다.
 *    eClass 패널은 eClass 페이지 안의 DOM 이라 비밀번호 칸을 두지 않는다(등록은 설정 페이지로 연다) */
(function (g) {
  const KEY = 'fetchSites', CRED = 'fetchCred';
  const KINDS = [['lecture', '강의'], ['subscription', '구독'], ['other', '기타']];
  const DOCS = { lecture: ['강의내용', '견적서', '수강증'], subscription: ['거래명세서'], other: ['거래명세서'] };   // 종류별 필요 서류의 기본값 (설정 help.fetchDocs 가 없을 때 — lib/settings.js 와 같게)
  const OLD_DOCS = { lecture: ['거래명세서', '수강증', '강의내용'], subscription: ['거래명세서'], other: ['거래명세서'] };   // 0.8.5 개발 중 등록 칸이 그대로 저장하던 기본 서류 → 읽을 때 "종류 기본"으로 (load)
  const DOC_CHOICES = ['거래명세서', '견적서', '수강증', '강의내용', '수료증'];   // 등록 칸에 늘 보이는 서류 (설정의 첨부 파일 종류가 더해짐)
  const EXTRA = { lecture: ['수료증'] };   // 있으면 받는 서류(종류별): 필요 서류가 아니라 없어도 ✗ 가 아니고(패널 ○), 아직 없으면 찾아오기가 늘 같이 찾는다 — 2026-10-22 사용자 "수료증도 받아줘 … 이건 있으면 받아줘"
  /* 가맹점 이름 → 사이트 추정 (등록 칸을 미리 채움, 사용자가 고침). 주소는 구매·청구 화면 — 인프런·ChatGPT·Claude·Azure 는 site-fetch/sites/*.md 에 화면 안내가 있다.
   * hint = 그 가맹점의 찾는 곳 메모(Claude 에 전달) — 위 넷은 안내 파일의 실측 경로, GitHub 이하는 실측 전 추정(찾아온 뒤의 기억한 찾는 방법이 더 정확) */
  const KNOWN = [
    { re: /인프랩|인프런|inflearn/i, label: '인프런', match: '인프랩', url: 'https://www.inflearn.com/my/orders', kind: 'lecture',
      hint: '구매 내역(/my/orders) › 주문 행의 거래명세서 · 견적서는 발급 안 함 → 구매 내역 상세(/orders/<번호>/detail, 강의명·가격) 캡처 · 수강증은 내 학습 › 수료증 탭(/my/vouchers)의 수강확인증 다운로드 pdf(수료한 강의는 수료증 pdf) · 강의내용은 강의 소개 › 커리큘럼(모두 펼치기)' },
    { re: /openai|chatgpt/i, label: 'ChatGPT', match: 'openai', url: 'https://chatgpt.com/settings/billing', kind: 'subscription',
      hint: '설정 › 결제(/settings/billing) › 거래 내역 › 날짜 행의 청구서 아이콘 › Stripe 화면의 청구서·영수증 다운로드' },
    { re: /anthropic|claude/i, label: 'Claude', match: 'anthropic', url: 'https://claude.ai/settings/billing', kind: 'subscription',
      hint: '설정 › 결제(/settings/billing) › 인보이스 › Stripe 화면의 청구서(Invoice) PDF + 영수증(Receipt)이 있으면 같이 다운로드 (같은 금액이 여러 번이면 결제일로)' },
    { re: /microsoft|azure|msft/i, label: 'Microsoft Azure', match: 'microsoft', url: 'https://portal.azure.com/#view/Microsoft_Azure_GTM/ModernBillingMenuBlade/~/Invoices', kind: 'subscription',
      hint: 'Cost Management + Billing › 인보이스 › 행의 다운로드(PDF, 10~20초 뒤 시작) — 가맹점 이름의 G<숫자>가 인보이스 ID' },
    { re: /github/i, label: 'GitHub', match: 'github', url: 'https://github.com/settings/billing', kind: 'subscription',
      hint: 'Settings › Billing and licensing › Payment history › 결제 행의 영수증(Receipt)' },
    { re: /udemy|유데미/i, label: 'Udemy', match: 'udemy', url: 'https://www.udemy.com/dashboard/purchase-history/', kind: 'lecture',
      hint: '구매 내역(purchase-history) › 주문 행의 영수증(Receipt)·인보이스' },
    { re: /패스트캠퍼스|데이원컴퍼니|fastcampus/i, label: '패스트캠퍼스', match: '데이원컴퍼니', url: 'https://fastcampus.co.kr', kind: 'lecture',
      hint: '마이페이지(내 강의장) › 결제 내역 › 영수증 · 수강증' },
    { re: /클래스101|class101/i, label: '클래스101', match: '클래스101', url: 'https://class101.net', kind: 'lecture',
      hint: '마이페이지 › 결제 내역 › 영수증' },
  ];
  /* 등록한 가맹점(이름·가맹점 글자·주소)에 맞는 알려진 사이트 — 설정 페이지 칸의 업체별 예시와 비어 있는 찾는 곳 메모 채우기에 */
  const knownOf = (site) => {
    const s = site || {}, t = `${s.label || ''} ${s.match || ''} ${s.url || ''}`;
    return t.trim() ? KNOWN.find((x) => x.re.test(t.normalize('NFKC')) || x.re.test(norm(t))) || null : null;
  };

  /* 비교용: 전각·띄어쓰기·회사 꼬리표(주식회사·(주)·㈜)·기호를 지우고 소문자 — "M i c r o s o f t - …" 와 "주식회사　인프랩" 도 맞게 */
  const norm = (s) => String(s || '').normalize('NFKC').toLowerCase().replace(/주식회사|유한회사|\(주\)|㈜|\(유\)/g, '').replace(/[^0-9a-z가-힣]/g, '');
  /* 등록 칸에 미리 넣을 가맹점 글자: 회사 꼬리표·괄호 뒤를 지우고, 한 글자씩 띄운 영문은 붙이고, "-" "*" 앞까지 */
  function keywordOf(shop) {
    let s = String(shop || '').normalize('NFKC').replace(/주식회사|유한회사|\(주\)|㈜|\(유\)/g, ' ').replace(/[…·]+/g, ' ').replace(/\.{2,}/g, ' ').trim();
    const toks = s.split(/\s+/).filter(Boolean);
    if (toks.length > 3 && toks.filter((t) => t.length === 1).length >= toks.length * 0.7) s = toks.join('');
    const cut = s.split(/[-*/(|]/)[0].trim();
    return (cut.length >= 2 ? cut : s).replace(/\s+/g, ' ').slice(0, 40);
  }
  const keysOf = (site) => String((site && site.match) || '').split(/[,|]/).map(norm).filter((k) => k.length >= 2);
  /* 가맹점 이름에 맞는 등록 사이트 (가장 긴 글자가 맞은 것) */
  function match(sites, shop) {
    const n = norm(shop);
    if (!n) return null;
    let best = null, len = 0;
    for (const s of Array.isArray(sites) ? sites : []) for (const k of keysOf(s)) if (n.includes(k) && k.length > len) { best = s; len = k.length; }
    return best;
  }
  const docList = (v) => Array.from(new Set((Array.isArray(v) ? v : String(v || '').split(/[,·\n]/)).map((d) => String(d || '').trim().replace(/[\\/:*?"<>|]+/g, '').slice(0, 20)).filter(Boolean))).slice(0, 6);
  /* 종류의 필요 서류: 설정 help.fetchDocs(map)에 있으면 그것, 없으면 기본 */
  const docsFor = (kind, map) => { const k = DOCS[kind] ? kind : 'other'; const v = map && docList(map[k]); return v && v.length ? v : DOCS[k].slice(); };
  /* 그 가맹점의 필요 서류: 따로 고른 서류(docs)가 있으면 그것, 아니면 종류 기본 */
  const docsOf = (site, map) => { const own = docList(site && site.docs); return own.length ? own : docsFor(site && site.kind, map); };
  /* 그 가맹점의 있으면 받는 서류: 종류의 EXTRA 중 필요 서류에 이미 없는 것 */
  const extraOf = (site, map) => { const need = docsOf(site, map); return (EXTRA[site && site.kind] || []).filter((d) => !need.includes(d)); };
  const kindLabel = (kind) => (KINDS.find((k) => k[0] === kind) || KINDS[2])[1];
  /* 새 등록의 기본값: 알려진 사이트면 그 주소·종류·찾는 곳 메모, 아니면 가맹점 글자만. docs 는 등록 칸에 보일 종류 기본(서류를 직접 고르지 않으면 [] 로 저장해 종류 기본을 따름) */
  function defaultsFor(shop, map) {
    const k = KNOWN.find((x) => x.re.test(String(shop || '').normalize('NFKC')) || x.re.test(norm(shop)));
    const kw = keywordOf(shop);
    if (k) return { label: k.label, match: k.match, url: k.url, kind: k.kind, docs: docsFor(k.kind, map), hint: k.hint || '', browser: '' };
    return { label: kw, match: kw, url: '', kind: 'other', docs: docsFor('other', map), hint: '', browser: '' };
  }
  const str = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
  const text = (v, n) => String(v == null ? '' : v).replace(/\r\n?/g, '\n').trim().slice(0, n);   // 줄 바꿈을 살림 (개선점 칸)
  /* 저장 전 정리 (잘못되면 throw) */
  function sanitize(site) {
    const s = site || {};
    const url = str(s.url, 500);
    try { const u = new URL(url); if (!/^https?:$/.test(u.protocol)) throw new Error('x'); } catch (e) { throw new Error('사이트 주소는 https:// 로 시작하는 주소여야 합니다'); }
    const match = str(s.match, 120);
    if (!keysOf({ match }).length) throw new Error('가맹점 글자(카드 내역의 가맹점 이름에 들어 있는 글자, 2자 이상)를 적으세요');
    const kind = KINDS.some((k) => k[0] === s.kind) ? s.kind : 'other';
    const docs = docList(Array.isArray(s.docs) ? s.docs : []);   // [] = 종류 기본을 따름
    return { id: str(s.id, 40), label: str(s.label, 60) || match.split(/[,|]/)[0].trim(), match, url, kind, docs, docsV: 2, hint: str(s.hint, 500), hintV: 1, browser: str(s.browser, 120), howto: str(s.howto, 500), issue: text(s.issue, 2000), ts: Number(s.ts) || Date.now(), at: Number(s.at) || 0, by: str(s.by, 60), last: s.last || null };
  }
  /* 읽을 때 고침: 0.8.5 개발 중에 저장된 등록은 그때의 종류 기본 서류를 그대로 담고 있다 → 그 값이면 "종류 기본"([])으로 (설정의 종류별 필요 서류를 따르게).
   * 업체별 찾는 곳 메모(KNOWN hint)가 생기기 전(hintV 없음)에 메모를 비워 둔 알려진 가맹점은 그 업체의 메모로 — 저장한 뒤(hintV 1)에는 사용자가 비운 칸을 다시 채우지 않는다 */
  const legacy = (x) => {
    if (!x || typeof x !== 'object') return x;
    let o = x;
    if (!o.docsV && Array.isArray(o.docs) && o.docs.join('|') === (OLD_DOCS[o.kind] || OLD_DOCS.other).join('|')) o = Object.assign({}, o, { docs: [] });
    const k = !o.hintV && !o.hint && knownOf(o);
    if (k && k.hint) o = Object.assign({}, o, { hint: k.hint });
    return o;
  };
  async function load() { try { const v = (await chrome.storage.local.get(KEY))[KEY]; return Array.isArray(v) ? v.map(legacy) : []; } catch (e) { return []; } }

  /* 사이트 붙이기 절차는 저장소의 fetch-site 스킬(대화형 Claude Code 에서 /fetch-site). 원문은 Help 서버 GET /fetch/skill (설정 페이지의 [스킬 복사]) */
  const SKILL = '.claude/skills/fetch-site/SKILL.md';
  /* 가맹점 블록 + 요청 한 줄 → Claude Code 에 보내는 글. 설정 › LLM 설정 › 증빙 찾아오기의 [만들기 프롬프트 복사](이 저장소의 Claude Code 에 붙여 넣음)와 찾는 방법 익히기(Help 서버 POST /ask)이 같은 글을 쓴다 —
   * 절차 자체는 fetch-site 스킬에 있고 여기에는 가맹점 값·요청·지킬 것·답변 형식만. site 가 없으면 빈 칸(＿＿)인 틀(ask 가 있으면 요청 글로 채우게). tx = { usedDate, amount, shop } 시험할 거래(없으면 빈 칸). 아이디·비밀번호는 넣지 않는다 */
  function buildPrompt(site, map, tx, ask) {
    const s = site || {}, t = tx || {}, blank = '＿＿';
    const v = (x) => String(x == null ? '' : x).trim() || blank;
    const q = str(ask, 2000) || (str(s.issue, 2000) ? '개선점대로 고쳐 줘' : '');   // 요청 한 줄이 없고 개선점이 있으면 그것이 요청
    const docs = site ? docsOf(s, map) : [];
    const own = site && docList(s.docs).length;
    const last = s.last ? `${new Date(s.last.ts).toLocaleString('ko-KR')} ${s.last.state === 'done' ? `${s.last.n}개 찾아옴` : s.last.state === 'empty' ? '찾지 못함' : s.last.state === 'canceled' ? '중지' : '실패'}${s.last.msg ? ` — ${s.last.msg}` : ''}` : '';
    const kinds = KINDS.map(([id, nm]) => `${nm}(${id}) = ${docsFor(id, map).join('·')}`).join(' / ');
    return [
      '[증빙 찾아오기 — 새 사이트 붙이기]',
      `이 저장소(kr_ext_rerp)의 증빙 찾아오기에 아래 가맹점 사이트를 붙여 주세요 — fetch-site 스킬(${SKILL})의 절차대로: 확장을 건드리지 않는 단독 실행 \`node site-fetch/run.js 요청.json --out site-fetch-out/<이름>\` 으로 시험하며 사이트 안내 site-fetch/sites/<이름>.md 와 기억한 찾는 방법(howto)을 만들고 받은 서류를 남깁니다. 안내가 이미 있으면 헤맨 곳만 고칩니다.`,
      '',
      '가맹점',
      `- 이름: ${v(s.label)}`,
      `- 카드 내역의 가맹점 이름에 든 글자: ${v(s.match)}`,
      `- 시작 주소(구매·결제 내역 화면이면 좋음): ${v(s.url)}`,
      `- 종류: ${site ? `${kindLabel(s.kind)}(${s.kind || 'other'})` : blank} — 필요 서류: ${docs.length ? docs.join('·') : blank}${site ? (own ? ' (이 가맹점만 따로 고름)' : ' (종류 기본)') : ''}`,
      `  (설정 › LLM 설정 › 증빙 찾아오기 › 종류별 필요 서류: ${kinds})`,
      ...(s.browser ? [`- 로그인해 둔 Chrome: ${s.browser} (요청 JSON 의 site.browser — 바탕화면 바로가기 이름·디버그 포트·주소, site-fetch/chrome.js 가 그 Chrome 에 붙음)`] : []),
      ...(s.hint ? [`- 찾는 곳 메모: ${s.hint}`] : []),
      ...(s.howto ? [`- 지난번에 찾은 방법: ${s.howto}`] : []),
      ...(last ? [`- 지난 결과: ${last}`] : []),
      ...(str(s.issue, 2000) ? [`- 개선점(사용자가 적은 안 되는 점·해야 할 것 — 이번에 고칠 것. 사이트 안내(절차 2)를 고치고, 안내만으로 안 되면 site-fetch/ 의 손잡이 cdp.mjs·규칙 prompt.js 도): ${str(s.issue, 2000)}`] : []),
      `- 시험할 거래: 사용일 ${v(t.usedDate)} · 금액 ${t.amount ? `${Math.round(Number(t.amount)).toLocaleString('ko-KR')}원` : blank}${t.shop ? ` · 가맹점 이름 "${t.shop}"` : ''} (모르면 사이트 구매 내역의 가장 최근 결제로)`,
      ...(!site && q ? ['  (＿＿ 칸은 아래 요청 글의 내용으로 채우고, 없으면 사이트에서 알아낸다)'] : []),
      ...(q ? ['', `요청: ${q}`] : []),
      '',
      '지킬 것',
      '- 확장에서 찾아오기를 시작하지 않는다(KRX_PREP_FETCH.start · prepFetch 메시지 · CDP 로 서비스워커 평가 모두). 확장 경로 확인은 사용자가 패널의 [찾아오기]를 누른다. 확장 설정(help.url 등)도 바꾸지 않는다.',
      '- 사거나 바꾸지 않는다(조회 · 영수증 보기/내려받기만). 회사 시스템(*.krs.co.kr · rcms.go.kr)으로 가지 않는다. 아이디·비밀번호를 파일·로그·대화에 남기지 않는다.',
      '- 다른 웹 사이트에 가는 코드는 site-fetch/ 에만 둔다. 커밋하지 않는다 — 바뀐 파일과 시험 결과를 알려 주면 사용자가 확인하고 커밋한다.',
      '- 마지막 답변: 첫 줄 한 줄 요약, 그 다음 `howto: …`(이 사이트에서 빨리 찾는 방법 — 메뉴 경로 위주 500자 이내 한 줄) · `guide: site-fetch/sites/<이름>.md` · `files: 받은 서류 경로` 줄.',
    ].join('\n');
  }
  /* Claude 의 마지막 답변에서 `howto: …` 줄(fetch-site 스킬의 답변 형식, `**howto:**`·`- howto:` 도) → 기억한 찾는 방법. 없으면 '' */
  function howtoOf(text) {
    const m = /^\s*(?:[-*]\s*)?\**howto\**\s*[:：]\**\s*(.+)$/im.exec(String(text || ''));
    return m ? str(m[1].replace(/^[`"'“]+|[`"'”]+$/g, ''), 500) : '';
  }
  /* 가맹점의 안내 글(설정 페이지의 [안내 복사]): 등록 값 + 기억한 찾는 방법 + Help 서버가 준 사이트 안내 파일 원문 [{ name, text }] — 다른 PC·다른 등록에 옮겨 쓰거나 Claude 에 보여 줄 때 */
  function guideText(site, map, files) {
    const s = site || {};
    const lines = [`[${s.label || s.match || '가맹점'}] 증빙 찾아오기 안내 (${new Date().toLocaleDateString('ko-KR')})`,
      `- 카드 내역의 가맹점 글자: ${s.match || ''}`, `- 사이트 주소: ${s.url || ''}`, `- 종류: ${kindLabel(s.kind)} — 필요 서류: ${docsOf(s, map).join('·')}`,
      ...(s.browser ? [`- 로그인해 둔 Chrome: ${s.browser}`] : []), ...(s.hint ? [`- 찾는 곳 메모: ${s.hint}`] : []),
      `- 기억한 찾는 방법: ${s.howto || '(없음)'}`];
    for (const f of Array.isArray(files) ? files : []) if (f && f.name) lines.push('', `--- ${f.name} ---`, String(f.text || '').trim());
    return lines.join('\n');
  }

  /* 가맹점 파일 (설정 페이지 가맹점 칸의 [내보내기] · 아래 [가져오기] — 2026-10-22 사용자 "yaml 이나 json 으로 주고 import, export … 가맹점 별로"): 등록 값만 옮긴다 —
   * id · 아이디 · 비밀번호 · 마지막 결과 · 개선점은 넣지 않는다(가져오면 같은 가맹점의 것은 그대로 남음). 같은 모양을 YAML·JSON 으로(설정 페이지가 vendor/yaml 로 쓰고 풂) */
  const FORMAT = 'krx-fetch-site';
  const PORT = [['label', 60], ['match', 120], ['url', 500], ['kind'], ['docs'], ['browser', 120], ['hint', 500], ['howto', 500]];
  function toFile(site) {
    const s = site || {}, o = { format: FORMAT, v: 1, exported: new Date().toISOString().slice(0, 10) };
    for (const [k, n] of PORT) o[k] = k === 'docs' ? docList(s.docs) : k === 'kind' ? (KINDS.some((x) => x[0] === s.kind) ? s.kind : 'other') : str(s[k], n);
    return o;
  }
  /* 파일에서 푼 값(가맹점 하나 · 배열 · { sites: [...] }) → 등록 칸에 넣을 값 [{ label, match, url, kind, docs, browser, hint, howto }]. 우리 파일이 아니거나 저장 검사(sanitize)에 걸리면 throw */
  function fromFile(data) {
    const list = Array.isArray(data) ? data : data && Array.isArray(data.sites) ? data.sites : [data];
    if (!list.length) throw new Error('가맹점이 없습니다');
    return list.map((x, i) => {
      if (!x || typeof x !== 'object' || Array.isArray(x)) throw new Error(`${list.length > 1 ? `${i + 1}번째 항목이 ` : ''}가맹점 파일이 아닙니다`);
      if (x.format != null && x.format !== FORMAT) throw new Error(`가맹점 파일이 아닙니다 (format: ${x.format})`);
      const o = {};
      for (const [k, n] of PORT) o[k] = k === 'docs' ? docList(Array.isArray(x.docs) ? x.docs : []) : k === 'kind' ? (KINDS.some((y) => y[0] === x.kind) ? x.kind : 'other') : str(x[k], n);
      try { sanitize(o); } catch (e) { throw new Error(`${o.label || o.match || `${i + 1}번째 가맹점`}: ${e.message}`); }
      if (!o.label) o.label = o.match.split(/[,|]/)[0].trim();
      return o;
    });
  }
  /* 가져온 값이 이미 등록한 어느 가맹점인지: 가맹점 글자(쉼표로 나눈 것) 하나라도 같거나 이름이 같으면 */
  const sameSite = (a, b) => { const ka = keysOf(a); return keysOf(b).some((k) => ka.includes(k)) || (!!norm(a && a.label) && norm(a && a.label) === norm(b && b.label)); };

  /* ---------- 공유 (Plus) 의 가맹점 파일 — 밑폴더(업무/shared)/common/가맹점.json (2026-10-22 사용자 "shared/common 아래 두면 어떨까" → 이름 가맹점.json · "동료와도 합침") ----------
   * 내 파일은 내가 쓰고(내 PC·브라우저끼리 같은 파일), 나와 공유된 동료의 같은 파일은 **읽기만** 해서 합친다 — 차례는 lib/sites-sync.js, 배선은 background.js shareSync.
   * 파일 { v:1, kind:'fetchSites', updatedAt, updatedBy, sites:[{ id, label, match, url, kind, docs, hint, howto, at, by }], del:{ [id]: { at, match, label } } } —
   *   올리는 칸은 SHARED 만: 아이디·비밀번호(fetchCred)·로그인해 둔 Chrome(browser — PC 마다 다름)·마지막 결과(last)·개선점(issue)은 이 브라우저에만.
   * 가맹점마다 수정 시각·사람(at · by)은 **고칠 때** stamp 가 찍고(설정 페이지 저장 · 패널 등록 · 찾아오기가 남긴 찾는 방법 — 2026-10-22 사용자 "가맹점 마다 업데이트 날짜 넣고 … 날짜보고 최신화 결정"), 지운 등록은 bury 가 그 시각의 묘비로 남긴다.
   *   찍지 않고 바뀐 것(옛 저장)의 대비로 지난 동기화의 지문을 storage.local.fetchSitesSync = { sites:{ [id]: { h(지문), at, by, match, label } }, del:{ [id]: { at, match, label } } } 에 두어, 지문이 바뀌었는데 at 이 그때보다 늦지 않으면 지금 고친 것, 지문에는 있는데 목록에 없으면 지운 것(묘비)으로 본다.
   * 병합(mergeShared) — 가맹점마다 at 이 큰 쪽의 SHARED 칸이 남고(id 가 달라도 sameSite 면 같은 가맹점 — 따로 등록한 같은 업체), 로컬에 없던 것은 그 id 로 새로 넣는다.
   *   묘비는 **내 것만**(이 브라우저 + 내 파일 — 내 다른 PC) 따른다: 동료가 지운 가맹점은 내 목록에서 지우지 않고, 내가 지운 가맹점은 동료 파일에 남아 있어도(더 늦게 고친 것이 아니면) 되살리지 않는다 */
  const SHARE_FILE = '가맹점.json', SHARE_DIR = 'common', SHARE_META = 'fetchSitesSync';
  const DEL_KEEP_MS = 180 * 24 * 3600000;
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const sharedOf = (s) => { const o = {}; for (const [k, n] of PORT) if (k !== 'browser') o[k] = k === 'docs' ? docList(Array.isArray(s && s.docs) ? s.docs : []) : k === 'kind' ? (KINDS.some((x) => x[0] === (s && s.kind)) ? s.kind : 'other') : str(s && s[k], n); return o; };
  const fpOf = (s) => JSON.stringify(sharedOf(s));
  const tombOf = (t, at) => ({ at: Number(isObj(t) ? t.at : t) || at || 0, match: str(isObj(t) ? t.match : '', 120), label: str(isObj(t) ? t.label : '', 60) });
  const normDel = (d) => { const o = {}; for (const [id, t] of Object.entries(isObj(d) ? d : {})) { const x = tombOf(t); if (id && x.at) o[id] = x; } return o; };
  const normMeta = (m) => { const sites = {}; for (const [id, x] of Object.entries(isObj(m) && isObj(m.sites) ? m.sites : {})) if (id && isObj(x)) sites[id] = { h: String(x.h || ''), at: Number(x.at) || 0, by: str(x.by, 60), match: str(x.match, 120), label: str(x.label, 60) }; return { sites, del: normDel(isObj(m) ? m.del : null) }; };
  /* 고칠 때 수정 시각 찍기(설정 페이지 저장 · 패널 등록 · 찾아오기가 남긴 찾는 방법 — 2026-10-22 사용자 "가맹점 마다 업데이트 날짜 넣고 … 날짜보고 최신화 결정"):
   * 올리는 칸(sharedOf)이 old(저장소의 지금 값)와 다르거나 새 등록이면 at = now · by = who, 같으면 old 의 at · by 그대로. s 를 고쳐 돌려준다 */
  function stamp(s, old, now, who) {
    const same = !!old && fpOf(old) === fpOf(s);
    return Object.assign(s, same ? { at: Number(old.at) || 0, by: str(old.by, 60) } : { at: Number(now) || Date.now(), by: str(who, 60) });
  }
  /* 지운 등록의 묘비를 지운 시각으로 fetchSitesSync 에 바로 남긴다(설정 페이지 [삭제] 뒤 저장 · 패널의 등록 지우기) — 동기화가 늦게 알아채도 지운 날짜는 그때 것 */
  async function bury(removed, now) {
    const list = (Array.isArray(removed) ? removed : [removed]).filter((s) => s && s.id);
    if (!list.length) return;
    let m;
    try { m = normMeta((await chrome.storage.local.get(SHARE_META))[SHARE_META]); } catch (e) { return; }
    for (const s of list) { m.del[s.id] = { at: Number(now) || Date.now(), match: str(s.match, 120), label: str(s.label, 60) }; delete m.sites[s.id]; }
    try { await chrome.storage.local.set({ [SHARE_META]: m }); } catch (e) {}
  }
  /* 가맹점 파일 글 → { sites:[{ id, …SHARED, at, by }], del, updatedAt, updatedBy } | null(JSON 이 아니거나 kind 가 다름 — 덮어쓰지 않는다). id·가맹점 글자가 없는 줄은 버림 */
  function parseShared(text) {
    let j;
    try { j = JSON.parse(String(text == null ? '' : text).replace(/^﻿/, '')); } catch (e) { return null; }
    if (!isObj(j) || j.kind !== 'fetchSites' || !Array.isArray(j.sites)) return null;
    const sites = [];
    for (const x of j.sites) if (isObj(x) && x.id && keysOf(x).length) sites.push(Object.assign({ id: str(x.id, 40) }, sharedOf(x), { at: Number(x.at) || 0, by: str(x.by, 60) }));
    return { v: Number(j.v) || 1, sites, del: normDel(j.del), updatedAt: str(j.updatedAt, 40), updatedBy: str(j.updatedBy, 60) };
  }
  /* 병합 — o = { local(fetchSites 목록), meta(fetchSitesSync), mine(parseShared — 내 파일, 없으면 null), others:[{ owner, doc(parseShared) }], now, who }
   * → { sites(새 로컬 목록 — 로컬에만 있는 칸은 그대로), meta(새 지문), doc · text(내 파일에 쓸 것), localChanged(목록이 바뀜), metaChanged, remoteChanged(내 파일과 다름 — 없던 파일이면 가맹점·묘비가 있을 때만), added, updated, removed, count } */
  function mergeShared(o) {
    const now = Number(o.now) || Date.now(), who = str(o.who, 60);
    const meta = normMeta(o.meta), mine = o.mine || null;
    const local = (Array.isArray(o.local) ? o.local : []).filter((x) => x && x.id);
    const tombs = {};
    const putTomb = (id, t) => { if (!tombs[id] || tombs[id].at < t.at) tombs[id] = t; };
    for (const [id, t] of Object.entries(meta.del)) putTomb(id, t);
    if (mine) for (const [id, t] of Object.entries(mine.del)) putTomb(id, t);
    const res = new Map(), ids = new Set(local.map((x) => String(x.id)));
    for (const x of local) {   // 로컬의 수정 시각: 고칠 때 찍은 at(stamp) — 지난 지문과 같으면 둘 중 늦은 것, 다른데 at 이 지난 동기화보다 늦지 않으면(찍지 않고 바뀐 옛 저장) 지금
      const id = String(x.id), m = meta.sites[id], xat = Number(x.at) || 0;
      let at, by;
      if (m && m.h === fpOf(x)) { at = Math.max(xat, m.at); by = xat >= m.at ? (str(x.by, 60) || m.by) : m.by; }
      else if (xat && (!m || xat > m.at)) { at = xat; by = str(x.by, 60) || who; }
      else { at = now; by = who; }
      res.set(id, { id, s: sharedOf(x), at, by, local: x, changed: false });
    }
    for (const [id, m] of Object.entries(meta.sites)) if (!ids.has(id)) putTomb(id, { at: now, match: m.match, label: m.label });   // 지난 동기화 뒤 이 브라우저에서 지움
    let removed = 0, added = 0;
    for (const [id, e] of Array.from(res)) if (tombs[id] && tombs[id].at >= e.at) { res.delete(id); removed++; }   // 내 다른 PC 가 지움(더 늦게)
    const buried = (r) => Object.entries(tombs).some(([tid, t]) => (tid === r.id || sameSite(t, r)) && t.at >= r.at);
    const remotes = [].concat(mine ? mine.sites.map((r) => [r, '']) : [], ...(Array.isArray(o.others) ? o.others : []).map((x) => (x && x.doc ? x.doc.sites.map((r) => [r, str(x.owner, 60)]) : [])));
    for (const [r, owner] of remotes) {
      if (tombs[r.id] && tombs[r.id].at >= r.at) continue;
      const t = res.get(r.id) || Array.from(res.values()).find((e) => sameSite(e.s, r));
      if (!t) { if (buried(r)) continue; res.set(r.id, { id: r.id, s: sharedOf(r), at: r.at, by: r.by || owner, local: null, changed: true }); added++; continue; }
      if (r.at > t.at) { if (fpOf(r) !== fpOf(t.s)) t.changed = true; t.s = sharedOf(r); t.at = r.at; t.by = r.by || owner; }
    }
    const list = Array.from(res.values());
    const sites = list.map((e) => (e.local ? Object.assign({}, e.local, e.s, { at: e.at, by: e.by }) : Object.assign({ id: e.id }, e.s, { at: e.at, by: e.by, browser: '', issue: '', docsV: 2, hintV: 1, ts: now, last: null })));
    const restamped = list.some((e) => e.local && ((Number(e.local.at) || 0) !== e.at || str(e.local.by, 60) !== e.by));
    const updated = list.filter((e) => e.local && e.changed).length;
    const del = {};
    for (const [id, t] of Object.entries(tombs)) if (now - t.at < DEL_KEEP_MS && !res.has(id)) del[id] = t;
    const metaOut = { sites: {}, del };
    for (const e of list) metaOut.sites[e.id] = { h: fpOf(e.s), at: e.at, by: e.by, match: e.s.match, label: e.s.label };
    const docSites = list.map((e) => Object.assign({ id: e.id }, e.s, { at: e.at, by: e.by }));
    const canon = (ss, dd) => JSON.stringify([ss.slice().sort((a, b) => (a.id < b.id ? -1 : 1)), Object.keys(dd).sort().map((k) => [k, dd[k].at])]);
    const doc = { v: 1, kind: 'fetchSites', updatedAt: new Date(now).toISOString(), updatedBy: who, sites: docSites, del };
    const remoteChanged = mine ? canon(mine.sites, mine.del) !== canon(docSites, del) : !!(docSites.length || Object.keys(del).length);
    return { sites, meta: metaOut, doc, text: JSON.stringify(doc, null, 2), localChanged: added > 0 || updated > 0 || removed > 0 || restamped, metaChanged: JSON.stringify(normMeta(o.meta)) !== JSON.stringify(normMeta(metaOut)), remoteChanged, added, updated, removed, count: list.length };
  }

  g.KRX_SITES = { KEY, CRED, KINDS, DOCS, DOC_CHOICES, EXTRA, KNOWN, SKILL, FORMAT, SHARE_FILE, SHARE_DIR, SHARE_META, norm, keywordOf, match, knownOf, docList, docsFor, docsOf, extraOf, kindLabel, defaultsFor, sanitize, load, buildPrompt, howtoOf, guideText, toFile, fromFile, sameSite, sharedOf, stamp, bury, parseShared, mergeShared };
})(typeof self !== 'undefined' ? self : this);
