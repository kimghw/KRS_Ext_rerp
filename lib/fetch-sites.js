/* 증빙 찾아오기(0.8.5)의 "자주 사용" 가맹점 목록 — 패널(lib/prep.js · lib/render.js) · 설정 페이지 · 백그라운드(lib/prep-fetch.js) 공용.
 * 카드 가맹점 이름에 등록한 글자(match)가 들어 있으면 그 사이트로 찾아온다(Help 서버의 site-fetch — 다른 웹 사이트에 가는 부분은 저장소의 site-fetch/ 폴더에 따로 있다).
 *  storage.local.fetchSites = [{ id, label(이름), match(가맹점 글자, 쉼표로 여럿), url(시작 주소 — 구매내역·청구 화면이면 좋음), kind(lecture 강의 | subscription 구독 | other 기타),
 *                               docs(가져올 서류 이름 — 첨부 파일 종류가 됨. [] 면 종류 기본 = 설정 help.fetchDocs[kind] 를 따름), docsV(2 = 이 규칙으로 저장됨), hint(찾는 곳 메모),
 *                               howto(지난번에 Claude 가 찾은 방법, 다음 요청에 참고로), ts, last: { ts, state, n, msg } }]
 *  필요 서류 = docsOf(site, 설정 help.fetchDocs): 가맹점이 따로 고른 서류가 있으면 그것, 아니면 그 종류의 필요 서류(강의 = 강의내용·견적서·수강증, 구독 = 거래명세서 — 설정에서 바꿈).
 *    패널은 그 서류가 첨부 파일 종류로 다 있는지 보이고(render.js), 찾아오기는 아직 없는 서류만 찾는다(prep-fetch.js)
 *  storage.local.fetchCred  = { [id]: { id(아이디), pw(비밀번호) } } — 비밀번호는 이 키에만(암호화 없음, 동기화 안 함). 백그라운드와 설정 페이지·사이드 패널(확장 페이지)만 쓴다.
 *    eClass 패널은 eClass 페이지 안의 DOM 이라 비밀번호 칸을 두지 않는다(등록은 설정 페이지로 연다) */
(function (g) {
  const KEY = 'fetchSites', CRED = 'fetchCred';
  const KINDS = [['lecture', '강의'], ['subscription', '구독'], ['other', '기타']];
  const DOCS = { lecture: ['강의내용', '견적서', '수강증'], subscription: ['거래명세서'], other: ['거래명세서'] };   // 종류별 필요 서류의 기본값 (설정 help.fetchDocs 가 없을 때 — lib/settings.js 와 같게)
  const OLD_DOCS = { lecture: ['거래명세서', '수강증', '강의내용'], subscription: ['거래명세서'], other: ['거래명세서'] };   // 0.8.5 개발 중 등록 칸이 그대로 저장하던 기본 서류 → 읽을 때 "종류 기본"으로 (load)
  const DOC_CHOICES = ['거래명세서', '견적서', '수강증', '강의내용', '수료증'];   // 등록 칸에 늘 보이는 서류 (설정의 첨부 파일 종류가 더해짐)
  /* 가맹점 이름 → 사이트 추정 (등록 칸을 미리 채움, 사용자가 고침). 주소는 구매·청구 화면 — 인프런·ChatGPT·Claude·Azure 는 site-fetch/sites/*.md 에 화면 안내가 있다 */
  const KNOWN = [
    { re: /인프랩|인프런|inflearn/i, label: '인프런', match: '인프랩', url: 'https://www.inflearn.com/my/orders', kind: 'lecture' },
    { re: /openai|chatgpt/i, label: 'ChatGPT', match: 'openai', url: 'https://chatgpt.com/settings/billing', kind: 'subscription' },
    { re: /anthropic|claude/i, label: 'Claude', match: 'anthropic', url: 'https://claude.ai/settings/billing', kind: 'subscription' },
    { re: /microsoft|azure|msft/i, label: 'Microsoft Azure', match: 'microsoft', url: 'https://portal.azure.com/#view/Microsoft_Azure_GTM/ModernBillingMenuBlade/~/Invoices', kind: 'subscription' },
    { re: /github/i, label: 'GitHub', match: 'github', url: 'https://github.com/settings/billing', kind: 'subscription' },
    { re: /udemy|유데미/i, label: 'Udemy', match: 'udemy', url: 'https://www.udemy.com/dashboard/purchase-history/', kind: 'lecture' },
    { re: /패스트캠퍼스|데이원컴퍼니|fastcampus/i, label: '패스트캠퍼스', match: '데이원컴퍼니', url: 'https://fastcampus.co.kr', kind: 'lecture' },
    { re: /클래스101|class101/i, label: '클래스101', match: '클래스101', url: 'https://class101.net', kind: 'lecture' },
  ];

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
  const kindLabel = (kind) => (KINDS.find((k) => k[0] === kind) || KINDS[2])[1];
  /* 새 등록의 기본값: 알려진 사이트면 그 주소·종류, 아니면 가맹점 글자만. docs 는 등록 칸에 보일 종류 기본(서류를 직접 고르지 않으면 [] 로 저장해 종류 기본을 따름) */
  function defaultsFor(shop, map) {
    const k = KNOWN.find((x) => x.re.test(String(shop || '').normalize('NFKC')) || x.re.test(norm(shop)));
    const kw = keywordOf(shop);
    if (k) return { label: k.label, match: k.match, url: k.url, kind: k.kind, docs: docsFor(k.kind, map), hint: '' };
    return { label: kw, match: kw, url: '', kind: 'other', docs: docsFor('other', map), hint: '' };
  }
  const str = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
  /* 저장 전 정리 (잘못되면 throw) */
  function sanitize(site) {
    const s = site || {};
    const url = str(s.url, 500);
    try { const u = new URL(url); if (!/^https?:$/.test(u.protocol)) throw new Error('x'); } catch (e) { throw new Error('사이트 주소는 https:// 로 시작하는 주소여야 합니다'); }
    const match = str(s.match, 120);
    if (!keysOf({ match }).length) throw new Error('가맹점 글자(카드 내역의 가맹점 이름에 들어 있는 글자, 2자 이상)를 적으세요');
    const kind = KINDS.some((k) => k[0] === s.kind) ? s.kind : 'other';
    const docs = docList(Array.isArray(s.docs) ? s.docs : []);   // [] = 종류 기본을 따름
    return { id: str(s.id, 40), label: str(s.label, 60) || match.split(/[,|]/)[0].trim(), match, url, kind, docs, docsV: 2, hint: str(s.hint, 500), howto: str(s.howto, 500), ts: Number(s.ts) || Date.now(), last: s.last || null };
  }
  /* 0.8.5 개발 중에 저장된 등록은 그때의 종류 기본 서류를 그대로 담고 있다 → 그 값이면 "종류 기본"([])으로 읽는다 (설정의 종류별 필요 서류를 따르게) */
  const legacy = (x) => {
    if (!x || x.docsV || !Array.isArray(x.docs)) return x;
    const old = OLD_DOCS[x.kind] || OLD_DOCS.other;
    return x.docs.join('|') === old.join('|') ? Object.assign({}, x, { docs: [] }) : x;
  };
  async function load() { try { const v = (await chrome.storage.local.get(KEY))[KEY]; return Array.isArray(v) ? v.map(legacy) : []; } catch (e) { return []; } }

  /* 새 사이트 찾아오기를 만드는 Claude Code 프롬프트 (설정 › 증빙 찾아오기의 [만들기 프롬프트 복사]) — 이 저장소에서 Claude Code 에 붙여 넣으면 site-fetch/sites/<이름>.md 사이트 안내를 만들고
   * 확장을 건드리지 않는 단독 실행(site-fetch/run.js)으로 시험한다. site 가 없으면 빈 칸(＿＿)인 틀. tx = { usedDate, amount, shop } 시험할 거래(없으면 빈 칸) */
  function buildPrompt(site, map, tx) {
    const s = site || {}, t = tx || {}, blank = '＿＿';
    const v = (x) => String(x == null ? '' : x).trim() || blank;
    const docs = site ? docsOf(s, map) : [];
    const own = site && docList(s.docs).length;
    const last = s.last ? `${new Date(s.last.ts).toLocaleString('ko-KR')} ${s.last.state === 'done' ? `${s.last.n}개 찾아옴` : s.last.state === 'empty' ? '찾지 못함' : s.last.state === 'canceled' ? '중지' : '실패'}${s.last.msg ? ` — ${s.last.msg}` : ''}` : '';
    const kinds = KINDS.map(([id, nm]) => `${nm}(${id}) = ${docsFor(id, map).join('·')}`).join(' / ');
    return [
      '[증빙 찾아오기 — 새 사이트 붙이기]',
      '이 저장소(kr_ext_rerp)의 증빙 찾아오기에 아래 가맹점 사이트를 붙여 주세요. 청구 준비 줄의 [찾아오기]가 이 사이트에서 카드 거래 하나의 필요 서류를 찾아 첨부 파일로 넣게 하는 것이 목표입니다.',
      '',
      '가맹점',
      `- 이름: ${v(s.label)}`,
      `- 카드 내역의 가맹점 이름에 든 글자: ${v(s.match)}`,
      `- 시작 주소(구매·결제 내역 화면이면 좋음): ${v(s.url)}`,
      `- 종류: ${site ? `${kindLabel(s.kind)}(${s.kind || 'other'})` : blank} — 필요 서류: ${docs.length ? docs.join('·') : blank}${site ? (own ? ' (이 가맹점만 따로 고름)' : ' (종류 기본)') : ''}`,
      `  (설정 › 증빙 찾아오기 › 종류별 필요 서류: ${kinds})`,
      ...(s.hint ? [`- 찾는 곳 메모: ${s.hint}`] : []),
      ...(s.howto ? [`- 지난번에 찾은 방법: ${s.howto}`] : []),
      ...(last ? [`- 지난 결과: ${last}`] : []),
      `- 시험할 거래: 사용일 ${v(t.usedDate)} · 금액 ${t.amount ? `${Math.round(Number(t.amount)).toLocaleString('ko-KR')}원` : blank}${t.shop ? ` · 가맹점 이름 "${t.shop}"` : ''} (모르면 사이트 구매 내역의 가장 최근 결제로)`,
      '',
      '먼저 읽을 것',
      '- site-fetch/README.md (구조 · 단독 실행 · 안전장치), site-fetch/prompt.js (찾는 Claude 에 주는 규칙 SYSTEM · 서류 설명 DOC_HINT), site-fetch/sites/inflearn.md · azure.md (사이트 안내 예)',
      '',
      '할 일',
      '1. 요청 파일을 스크래치 폴더에 만들어(형식은 README "단독 실행". 비밀번호는 파일에 넣지 말고 필요하면 환경 변수 KRX_FETCH_ID · KRX_FETCH_PW) `node site-fetch/run.js 요청.json --out <폴더>` 로 한 번 돌린다. 진행 줄 · 결과 JSON(matched · howto · missing) · 받은 파일을 보고 어디서 헤맸는지 찾는다.',
      '2. site-fetch/sites/<영문 이름>.md 를 만든다. 첫 줄 `hosts: <사이트 도메인>, <로그인 도메인>`(시작 주소가 이 도메인이면 찾는 Claude 의 프롬프트에 붙음), 둘째 줄 `[이름] 출처: … (YYYY-MM-DD 실측)`, 그 아래 한 줄씩:',
      '   로그인(칸 · 추가 인증) · 구매/결제 내역 주소와 행에서 날짜·금액·주문번호를 읽는 법 · 필요 서류마다 어디서 어떻게 저장하는지(download · saveurl · pdf · capture) · 함정(내려받기 지연, 다른 출처 iframe, 없는 주소 404, 해외 결제 금액 차이, 사이트가 주지 않는 서류).',
      '3. 다시 run.js 로 돌려 필요 서류가 모두 나오는지(사이트가 주지 않는 것은 missing 이유와 함께) 확인하고, 결과·걸린 시간·비용을 site-fetch/README.md 의 실제 시험 표에 한 줄 더한다.',
      '4. 필요 서류 이름이 site-fetch/prompt.js 의 DOC_HINT 에 없으면 한 줄 설명을 더한다(이 사이트에서 부르는 이름 — 예: Invoice · Receipt · 수강확인증).',
      '5. lib/fetch-sites.js 의 KNOWN 에 { re, label, match, url, kind } 를 더해 패널의 [자주 사용 등록]이 이 사이트로 미리 채워지게 하고 `node tests/prep-fetch.test.js` 를 돌린다.',
      '6. README.md 의 증빙 찾아오기 절(사이트 안내가 있는 사이트 목록)에 이 사이트를 더한다.',
      '',
      '지킬 것',
      '- 확장에서 찾아오기를 시작하지 않는다(KRX_PREP_FETCH.start · prepFetch 메시지 · CDP 로 서비스워커 평가 모두). 확장 경로 확인은 사용자가 패널의 [찾아오기]를 누른다. 확장 설정(help.url 등)도 바꾸지 않는다.',
      '- 사거나 바꾸지 않는다(조회 · 영수증 보기/내려받기만). 회사 시스템(*.krs.co.kr · rcms.go.kr)으로 가지 않는다. 아이디·비밀번호를 파일·로그·대화에 남기지 않는다.',
      '- 다른 웹 사이트에 가는 코드는 site-fetch/ 에만 둔다. 커밋하지 않는다 — 바뀐 파일과 시험 결과를 알려 주면 사용자가 확인하고 커밋한다.',
    ].join('\n');
  }

  g.KRX_SITES = { KEY, CRED, KINDS, DOCS, DOC_CHOICES, KNOWN, norm, keywordOf, match, docList, docsFor, docsOf, kindLabel, defaultsFor, sanitize, load, buildPrompt };
})(typeof self !== 'undefined' ? self : this);
