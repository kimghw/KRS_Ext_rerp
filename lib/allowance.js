/* 연구수당 계산 (2026-10-21 사용자 "참여연구원 변경 옆에 연구수당 계산 페이지를 하나 만들어줘. 그리고 첨부된 지침에 따라 계산 페이지를 만들어줘" · "최종적으로는 HWPX 양식에 맞게 계산서를 출력해줘야해" → 같은 날 "hwpx 아니고 docx 로 출력해줘").
 * 근거: references/10-53_국가연구개발과제_연구수당지급기준_20240305.md(10-53, 2024-03-05 시행 — 원본 hwpx 는 DRM 이라 사용자 캡처를 옮겨 적은 것). 처음(같은 날 오전)에는 지침을 못 본 채 "참여율 × 개월 비례 · 1인 70%" 가정으로 만들었다가 지침을 받고 별지 1·2 흐름으로 다시 만들었다.
 * 순수 계산(compute) + 저장(load/save — storage.local.allowCalc["과제번호@연차"]) + 연구수당 계산 탭(popup.html#…&only=allow — lib/staff-ui.js section 이 card 를 부름)의 카드(card)·입력 처리(bind) + Word 문서 모형(docOf → lib/docx.js build).
 * popup.html 에만 싣는다(패널 카드는 [연구수당 계산 ↗] 단추만 — lib/staff-ui.js actsOf → openTab(prjNo, year, 'allow')). Node 테스트: node tests/allowance.test.js
 *
 * 지침의 흐름(제4·5·6조, 별지 1·2):
 *  - 대상(제4조) = 참여연구원 계획의 연구책임자·연구자. 역할에 "행정"이 든 사람(연구지원)은 뺀다. 참여율 0 인 사람과 미지급(out)으로 표시한 사람은 별지 2 에 사유만 적고 지급하지 않는다.
 *  - 재원(제5조) = 연구수당 계상금액(연차 예산 줄의 연구수당 — 직접 적을 수 있음) · 집행 가능액(기본 계상금액 − 집행, 직접 적을 수 있음). 지급액은 집행 가능액 × 지급비율.
 *  - 별지 1 합산기여도 = a×0.3 + b×0.6 + c×0.1 — a 참여율 환산비율(참여율 ÷ 참여율 합 × 100), b 성과 기여율(사람의 기여도 합 ÷ 전체 합 × 100, 기여도 = 등급 점수(가 50 · 나 30 · 다 10) × 건수 × 가중치), c 기타 환산비율(우수 100 · 양호 75 · 보통 50 · 미흡 25 ÷ 합 × 100). 각 열의 계는 100.
 *  - 평가등급(별지 1 주석 5·5-1) = 합산기여도 내림차순으로 참여 연구원 수별 인원 배분표(HEADCOUNT — S 10% · A 20% · B 40% · C 20% · D 10%)대로 S/A/B/C/D. 5명 이상이면 S+A · C+D 통합 가능(merge). 동점이면 상위등급(그 사람 몫은 하위등급 1인 비율을 상위등급 몫에 합쳐 N분).
 *  - 지급비율(별지 2 배분기준) = 참여 연구원 수별 등급 몫 표(PAY_SHARE — 등급 전체의 %) ÷ 그 등급 인원. 책임자가 등급간 ±10%p 제로섬 조정(adjust), 등급별 최소 3%, 하위등급 1인 지급액 ≤ 상위등급 1인 지급액(어기면 알림만).
 *  - 상한(제6조④, 표 2) = 당해연도 개인 연구수당 총액 ≤ 기본연봉 × 직급 비율(P1 18 · P2 20 · P3 22 · P4 24 · G/C 22%). 남은 연구수당(자료 요청 응답 person.allowance · 내 HR 잔여)을 알면 넘을 때 알림만 — 초과분은 예산변경·반납(재배분 규정 없음).
 * 저장(storage.local.allowCalc[key]) = { pool(원), avail(원), org(연구기관명), merge{ sa, cd }, adjust{ S, A, B, C, D }(%p), people{ [id]: { dept, grade, etc(100|75|50|25), items[{ name, level('가'|'나'|'다'), count, weight }], note, out } }, at }. 이 브라우저만(공유·변경이력 없음). */
(function (g) {
  const KEY = 'allowCalc';
  const F = g.KRX_FMT, S = g.KRX_STAFF;
  const esc = (v) => (F ? F.esc(v) : String(v == null ? '' : v));
  const num = (v) => { if (v === '' || v == null) return null; const n = Number(typeof v === 'string' ? v.replace(/[,\s%]/g, '') : v); return Number.isFinite(n) ? n : null; };
  const won = (v) => { const n = num(v); return n != null && n >= 0 ? Math.round(n) : null; };
  const text = (v, max = 80) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
  const isAdmin = (role) => /행정/.test(String(role || ''));
  const GRADES = ['S', 'A', 'B', 'C', 'D'];
  const LEVELS = Object.freeze({ '가': 50, '나': 30, '다': 10 });   // 별지 1 주석 1) 평가항목 난이도 점수
  const ETC = Object.freeze([['100', '우수'], ['75', '양호'], ['50', '보통'], ['25', '미흡']]);   // 주석 3) 기타
  const WEIGHT = Object.freeze({ a: 0.3, b: 0.6, c: 0.1 });   // 주석 4) 합산기여도
  const ITEMS = Object.freeze({ '가': ['연구총괄 및 관리', '선급기술규칙/IMO문서등재', '논문(SCI(E))', '특허(국제)', '설계,해석 및 검증 S/W 개발', '기술문서 발간', '최종보고서 작성', '기타'], '나': ['연구계획서작성(선정평가포함)', '연구과제 협약(주관기관만해당)', '기준/절차/가이드라인/지침서', '논문(KCI)', '알고리즘/제어기술 개발', '특허(국내),실용신안,의장', '연구홍보(연구활동보고서, 기고문 등)', '기타'], '다': ['연구내용 사전조사', '학술발표(국내/국제-발표자)', '세미나발표(발표자)', '진도보고서 작성', '기타'] });
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

  /* ---------- 계산 ---------- */
  /* 입력 { pool(원), avail(원 | null → pool), merge{ sa, cd }, adjust{ S, A, B, C, D }, people[{ id, name, role, dept, grade, rate(연간 %), etc(100|75|50|25|null), items[], note, out, cap(남은 연구수당 원 | null), capSrc }] }
   * → { pool, avail, n, groups[{ key, label, count, share, members, perHead, over }], people[{ …, admin, target, contrib, a, b, c, total, gradeLabel, ratio, amt, reason, tie }], sums{ a, b, c, total, amt }, left, overflow } */
  function compute(inp) {
    const pool = won(inp && inp.pool) || 0;
    const avail = won(inp && inp.avail) != null ? won(inp.avail) : pool;
    const merge = { sa: !!(inp && inp.merge && inp.merge.sa), cd: !!(inp && inp.merge && inp.merge.cd) };
    const adjust = {}; for (const k of GRADES) adjust[k] = num(inp && inp.adjust && inp.adjust[k]) || 0;
    const people = ((inp && inp.people) || []).map((p, idx) => {
      const items = (Array.isArray(p.items) ? p.items : []).map((it) => ({ name: text(it.name), level: LEVELS[it.level] ? it.level : '가', count: num(it.count) == null ? 1 : num(it.count), weight: num(it.weight) == null ? 1 : num(it.weight) })).map((it) => Object.assign(it, { score: itemScore(it) }));
      const admin = isAdmin(p.role), rate = num(p.rate) || 0, out = !!p.out;
      const target = !admin && !out && rate > 0;
      return { idx, id: String(p.id || ''), name: String(p.name || ''), role: String(p.role || ''), dept: text(p.dept), grade: text(p.grade, 20), rate, etc: num(p.etc), items, note: text(p.note, 200), out, cap: won(p.cap), capSrc: String(p.capSrc || ''),
        admin, target, contrib: items.reduce((s, it) => s + it.score, 0), a: 0, b: 0, c: 0, total: 0, g: -1, gradeLabel: '', ratio: 0, amt: 0, reason: admin ? '연구지원(행정)' : out ? (text(p.note, 200) || '미지급') : rate > 0 ? '' : '참여 없음', tie: false };
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
    let groups = [];
    if (n) {
      const hc = headcountOf(n), sh = shareOf(n);
      const mk = (keys) => ({ key: keys.join('+'), label: keys.join('+'), keys, count0: keys.reduce((s, k) => s + hc[GRADES.indexOf(k)], 0), share0: keys.reduce((s, k) => s + sh[GRADES.indexOf(k)] + adjust[k], 0), members: [], in: [], out: 0 });
      groups = (merge.sa ? [mk(['S', 'A'])] : [mk(['S']), mk(['A'])]).concat([mk(['B'])], merge.cd ? [mk(['C', 'D'])] : [mk(['C']), mk(['D'])]);
      for (const gr of groups) { gr.count = gr.count0; gr.perHead0 = gr.count0 ? gr.share0 / gr.count0 : 0; }
      // 합산기여도 내림차순 배정 — 동점은 앞사람(상위등급)과 같은 등급으로 올리고 그 자리는 하위등급에서 뺀다
      const sorted = T.slice().sort((x, y) => y.total - x.total || x.idx - y.idx);
      let gi = 0;
      for (let k = 0; k < sorted.length; k++) {
        const p = sorted[k];
        while (gi < groups.length - 1 && groups[gi].count - groups[gi].members.length <= 0) gi++;
        const prev = sorted[k - 1];
        if (prev && Math.abs(prev.total - p.total) < 1e-9 && prev.g !== gi) {
          const up = groups[prev.g]; up.members.push(p); up.in.push(groups[gi].perHead0); groups[gi].count--; groups[gi].out++; p.g = prev.g; p.tie = true; prev.tie = true;
        } else { groups[gi].members.push(p); p.g = gi; }
      }
      for (const gr of groups) {
        gr.share = gr.share0 - gr.out * gr.perHead0 + gr.in.reduce((s, x) => s + x, 0);
        gr.perHead = gr.members.length ? gr.share / gr.members.length : 0;
        gr.over = gr.in.length;
        for (const p of gr.members) { p.gradeLabel = gr.label; p.ratio = gr.perHead; p.amt = Math.floor(avail * gr.perHead / 100); }
      }
    }
    const sums = { a: T.reduce((s, p) => s + p.a, 0), b: T.reduce((s, p) => s + p.b, 0), c: T.reduce((s, p) => s + p.c, 0), total: T.reduce((s, p) => s + p.total, 0), ratio: T.reduce((s, p) => s + p.ratio, 0), amt: T.reduce((s, p) => s + p.amt, 0) };
    return { pool, avail, n, merge, adjust, groups, people, sums, left: avail - sums.amt, overflow: n > 40, contribSum, etcSum };
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
    const noEtc = res.people.filter((p) => p.target && p.etc == null);
    if (res.n && noEtc.length) out.push({ level: 'info', text: `기타(연구수행 성실성)를 고르지 않은 사람 ${noEtc.length}명 — 비우면 0 으로 셈합니다.` });
    const adjSum = GRADES.reduce((s, k) => s + res.adjust[k], 0);
    if (Math.abs(adjSum) > 1e-9) out.push({ level: 'warn', text: `등급간 조정의 합이 ${r2(adjSum)}%p 입니다 — 제로섬(합 0)이어야 합니다.` });
    for (const k of GRADES) if (Math.abs(res.adjust[k]) > 10) out.push({ level: 'warn', text: `${k} 등급 조정 ${res.adjust[k]}%p — 최대 10% 범위 안이어야 합니다.` });
    for (const gr of res.groups) if (gr.members.length && gr.share < 3) out.push({ level: 'warn', text: `${gr.label} 등급 몫 ${r2(gr.share)}% — 등급별 최소 3% 이상이어야 합니다.` });
    for (let i = 1; i < res.groups.length; i++) { const up = res.groups[i - 1], lo = res.groups[i]; if (up.members.length && lo.members.length && lo.perHead > up.perHead + 1e-9) out.push({ level: 'warn', text: `${lo.label} 등급 1인 지급비율 ${r2(lo.perHead)}% 가 ${up.label} 등급 ${r2(up.perHead)}% 보다 큽니다 — 하위등급 개인별 지급액은 상위등급을 넘을 수 없습니다.` }); }
    const ties = res.people.filter((p) => p.tie);
    if (ties.length) out.push({ level: 'info', text: `합산기여도 동점: ${ties.map((p) => p.name).join(', ')} — 상위등급으로 두고 하위등급 1인 몫을 합쳐 나눴습니다.` });
    for (const p of res.people) if (p.target && p.cap != null && p.amt > p.cap) out.push({ level: 'warn', text: `${p.name}: 지급액 ${th(p.amt)}천원이 남은 연구수당 ${th(p.cap)}천원(${p.capSrc})을 넘습니다 — 초과분은 예산변경·계속비 편성 또는 반납(제6조④).` });
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
    return out;
  }
  function normalize(raw) { const out = {}; for (const [k, v] of Object.entries(raw && typeof raw === 'object' ? raw : {})) if (k) out[k] = normalizeEntry(v); return out; }
  async function load() { try { const r = await chrome.storage.local.get(KEY); return normalize(r[KEY]); } catch (e) { return {}; } }
  async function save(all) { try { await chrome.storage.local.set({ [KEY]: normalize(all) }); } catch (e) {} }

  /* ---------- 계획 → 계산 입력 ---------- */
  /* staff(계획) · entry(저장) · opts { me(내 이름), hr{ grade, remain }(내 HR — 직급 기본값·남은 연구수당) } */
  function inputOf(staff, entry, opts = {}) {
    const ov = (entry && entry.people) || {};
    const hr = opts.hr || null;
    return ((staff && staff.people) || []).map((p) => {
      const st = S.personStats(p, staff.basis), o = ov[p.id] || {};
      const me = !!(opts.me && S.sameName(p.name, opts.me));
      const cap = p.allowance != null ? p.allowance : (me && hr && hr.remain != null ? Math.max(hr.remain, 0) : null);
      return { id: p.id, name: p.name, role: p.role, dept: o.dept || '', grade: o.grade || (me && hr && hr.grade ? hr.grade : ''), rate: st.rate || 0, etc: o.etc != null ? o.etc : null, items: o.items || [], note: o.note || '', out: !!o.out, cap, capSrc: p.allowance != null ? '응답' : cap != null ? 'HR' : '' };
    });
  }
  const sumRows = (rows, re) => { const hit = (rows || []).filter((r) => re.test(String(r.name || '')) && r.plan != null); return hit.length ? hit.reduce((s, r) => s + r.plan, 0) : null; };
  const poolOfRows = (rows) => sumRows(rows, /수당/);
  const availOfRows = (rows) => { const hit = (rows || []).filter((r) => /수당/.test(String(r.name || '')) && r.plan != null); return hit.length ? hit.reduce((s, r) => s + (r.left != null ? r.left : r.plan), 0) : null; };
  const payOfRows = (rows) => sumRows(rows, /인건비/);
  /* 과제·연차·저장·상태 → 계산에 쓸 것 전부 { key, entry, staff, pool, avail, org, period, payTotal, res } */
  function ctxOf(p, plan, year, br, state, opts = {}) {
    const key = S.planKey(p.prjNo, year);
    const entry = (state.allowCalc || {})[key] || { people: {} };
    const staff = plan && plan.people && plan.people.length ? { basis: plan.basis || 'rerp', people: plan.people } : null;
    const rows = br && br.rows;
    const pool = entry.pool != null ? entry.pool : poolOfRows(rows);
    const availDefault = availOfRows(rows);
    const avail = entry.avail != null ? entry.avail : (availDefault != null ? availDefault : pool);
    const U = g.KRX_STAFF_UI;
    const per = U && U.periodOf ? U.periodOf(p, plan, year) : null;
    const payTotal = U && U.budgetOf ? U.budgetOf(p, plan, year, rows) : payOfRows(rows);
    const res = compute({ pool, avail, merge: entry.merge, adjust: entry.adjust, people: inputOf(staff, entry, opts) });
    return { key, entry, staff, pool, avail, poolDefault: poolOfRows(rows), availDefault, org: entry.org || '한국선급', period: per && per.from ? `${per.from} ~ ${per.to}` : '', payTotal, res, p, year };
  }

  /* ---------- 탭의 카드 ---------- */
  const fmtWon = (n) => (n == null ? '' : F.money(n));
  const pctTxt = (x) => r2(x).toFixed(2);
  function card(p, plan, year, br, state, opts = {}) {
    const c = ctxOf(p, plan, year, br, state, opts);
    const { key, entry, staff, res } = c;
    const th = (n) => (n == null ? '' : S.thousand(n));
    const yl = S.yearLabel(year);
    const head = `<div class="krext-ws-cardhead krext-ws-pinned"><span>연구수당 계산</span><span class="krext-ws-state" title="지급 대상 연구원 수 · 집행 가능액">${res.n}명 · 집행 가능액 ${c.avail ? `${th(c.avail)}천원` : '없음'}</span><div class="krext-st-acts"><button type="button" class="krext-plan-btn krext-plan-save" data-act="al-docx" title="별지 1 연구수행 기여도 평가서 · 별지 2 연구수당 지급 내역서를 Word 문서(.docx)로 내려받습니다 (lib/docx.js)"${staff ? '' : ' disabled'}>DOCX 내려받기</button><button type="button" class="krext-plan-btn" data-act="al-copy" title="별지 1·2 표를 탭으로 나눈 글로 복사"${staff ? '' : ' disabled'}>복사</button><button type="button" class="krext-plan-btn" data-act="al-reset" title="이 과제 ${esc(yl)} 의 일반 정보·성과 항목·기타·등급 조정·미지급을 지우고 기본값으로"${entry.at ? '' : ' disabled'}>초기화</button></div></div>`;
    const inGen = (k, v, title, extra = '') => `<input type="text" class="krext-st-in krext-al-in" data-al="${k}" value="${esc(v)}" title="${esc(title)}"${extra}>`;
    const general = `<h4 class="krext-al-h">1. 일반 정보</h4><dl class="krext-al-general">
      <dt>연구과제명</dt><dd class="krext-al-wide">${esc(p.prjNm || '')}</dd>
      <dt>연구기관명</dt><dd>${inGen('org', c.org, '연구기관명 — 별지 2 에 적힘', ' maxlength="40"')}</dd><dt>연구책임자명</dt><dd>${esc(p.rspr || '—')}</dd>
      <dt>당해연도 연구기간</dt><dd>${esc(c.period || '—')}</dd><dt>인건비 계상금액</dt><dd>${c.payTotal != null ? `${esc(th(c.payTotal))}천원` : '—'}</dd>
      <dt>연구수당 계상금액</dt><dd>${inGen('pool', c.pool == null ? '' : th(c.pool), `천원 — 비우면 예산 줄의 연구수당${c.poolDefault != null ? ` ${th(c.poolDefault)}천원` : '(없음)'}`, ' inputmode="numeric" placeholder="천원"')}${entry.pool != null ? '<small>직접</small>' : ''}</dd>
      <dt>연구수당 집행 가능액</dt><dd>${inGen('avail', c.avail == null ? '' : th(c.avail), `천원 — 지급액의 기준. 비우면 계상금액 − 집행${c.availDefault != null ? ` = ${th(c.availDefault)}천원` : ''}`, ' inputmode="numeric" placeholder="천원"')}${entry.avail != null ? '<small>직접</small>' : ''}</dd>
      <dt>총 지급액</dt><dd><strong>${esc(th(res.sums.amt))}</strong>천원</dd></dl>`;
    if (!staff) return `<div class="krext-ws-card krext-al-card" data-alkey="${esc(key)}">${head}<div class="krext-ws-body">${general}<div class="krext-sub krext-dim">${esc(yl)} 참여연구원 계획이 아직 없습니다 — <b>참여연구원 변경</b>에서 계획을 세우면 그 참여율로 별지 1 을 셈합니다.</div>${warnHtml(checks(res))}</div></div>`;
    // 별지 1
    const datalist = `<datalist id="krext-al-items">${Object.entries(ITEMS).map(([lv, names]) => names.map((nm) => `<option value="${esc(nm)}">${esc(lv)} ${esc(nm)}</option>`).join('')).join('')}</datalist>`;
    const itemRows = (r) => r.items.map((it, k) => `<div class="krext-al-item" data-k="${k}"><input type="text" class="krext-st-in krext-al-in krext-al-item-nm" list="krext-al-items" data-ali="name" data-i="${esc(r.id)}" data-k="${k}" value="${esc(it.name)}" placeholder="평가항목" maxlength="80" title="평가항목 — 목록에서 고르거나 적습니다(책임자가 추가 가능)"><select class="krext-al-sel" data-ali="level" data-i="${esc(r.id)}" data-k="${k}" title="난이도 등급 — 가 50 · 나 30 · 다 10">${Object.keys(LEVELS).map((lv) => `<option value="${lv}"${it.level === lv ? ' selected' : ''}>${lv} ${LEVELS[lv]}</option>`).join('')}</select><input type="text" class="krext-st-in krext-al-in krext-al-num" data-ali="count" data-i="${esc(r.id)}" data-k="${k}" value="${esc(String(it.count))}" inputmode="decimal" title="건수"><input type="text" class="krext-st-in krext-al-in krext-al-num" data-ali="weight" data-i="${esc(r.id)}" data-k="${k}" value="${esc(String(it.weight))}" inputmode="decimal" title="가중치 — 논문 저자(1-1) · 산업재산권(1-2) 표, 그 밖은 참여연구원간 합 1"><span class="krext-al-score" title="기여도 = 등급 점수 × 건수 × 가중치">= ${esc(r2(it.score))}</span><button type="button" class="krext-ico-btn krext-al-del" data-act="al-item-del" data-i="${esc(r.id)}" data-k="${k}" aria-label="항목 빼기" title="이 항목 빼기">×</button></div>`).join('')
      + `<button type="button" class="krext-plan-btn krext-al-add" data-act="al-item-add" data-i="${esc(r.id)}" title="성과 항목 더하기">＋ 항목</button>`;
    const rows1 = res.people.filter((r) => !r.admin).map((r) => {
      const off = r.target ? '' : ' krext-al-off';
      const pin = (k, v, title, extra = '') => `<input type="text" class="krext-st-in krext-al-in" data-alp="${k}" data-i="${esc(r.id)}" value="${esc(v)}" title="${esc(title)}"${extra}>`;
      const etcSel = `<select class="krext-al-sel" data-alp="etc" data-i="${esc(r.id)}" title="연구수행 성실성(협력·소통·적극성) — 책임자 평가"><option value=""${r.etc == null ? ' selected' : ''}>—</option>${ETC.map(([v, l]) => `<option value="${v}"${r.etc === Number(v) ? ' selected' : ''}>${l} ${v}</option>`).join('')}</select>`;
      return `<tr class="krext-al-row${off}" data-i="${esc(r.id)}">
        <td>${pin('dept', r.dept, '부서명', ' maxlength="40" placeholder="부서"')}</td><td class="krext-st-nm">${esc(r.name)}<small class="krext-dim">${esc(S.roleShort(r.role))}</small></td><td>${pin('grade', r.grade, '직급(기여도평가시점) — P1~P4 · G1~G3 · C. 상한 비율의 근거', ' maxlength="20" placeholder="직급" class="krext-st-in krext-al-in krext-al-grade"')}</td>
        <td class="krext-num">${r.rate ? esc(S.rateText(r.rate)) : '—'}</td><td class="krext-num">${r.target ? esc(pctTxt(r.a)) : '—'}</td>
        <td class="krext-al-items">${r.target ? itemRows(r) : `<span class="krext-dim">${esc(r.reason)}</span>`}</td>
        <td class="krext-num" title="기여도 합">${r.target ? esc(r2(r.contrib)) : '—'}</td><td class="krext-num">${r.target ? esc(pctTxt(r.b)) : '—'}</td>
        <td>${r.target ? etcSel : '—'}</td><td class="krext-num">${r.target ? esc(pctTxt(r.c)) : '—'}</td>
        <td class="krext-num"><strong>${r.target ? esc(pctTxt(r.total)) : '—'}</strong></td><td class="krext-num krext-al-gr">${r.target ? `<b>${esc(r.gradeLabel)}</b>${r.tie ? '<small title="동점 — 상위등급">동점</small>' : ''}` : '—'}</td>
      </tr>`;
    }).join('');
    const t1 = `<h4 class="krext-al-h">2. 평가 내용 (별지 1 연구수행 기여도 평가서)</h4>${datalist}<div class="krext-ws-table-scroll" tabindex="0" role="region" aria-label="연구수행 기여도 평가"><table class="krext-cards krext-st-table krext-al-table krext-al-t1"><thead>
      <tr><th rowspan="2">부서명</th><th rowspan="2" class="krext-st-nm">성명</th><th rowspan="2">직급</th><th colspan="2" class="krext-al-grp">참여도 평가 (30%)</th><th colspan="3" class="krext-al-grp">성과 기여도 평가 (60%)</th><th colspan="2" class="krext-al-grp">기타 (10%)</th><th rowspan="2" class="krext-num" title="(a × 0.3) + (b × 0.6) + (c × 0.1)">합산 기여도</th><th rowspan="2" class="krext-num">평가등급</th></tr>
      <tr><th class="krext-num" title="연간 참여율">참여율(%)</th><th class="krext-num" title="참여율 ÷ 합 × 100">환산비율(a)</th><th>평가항목 · 등급 · 건수 · 가중치</th><th class="krext-num" title="Σ 등급 점수 × 건수 × 가중치">기여도</th><th class="krext-num" title="기여도 ÷ 합 × 100">기여율(b)</th><th title="연구수행 성실성">평가점수</th><th class="krext-num" title="평가점수 ÷ 합 × 100">환산비율(c)</th></tr></thead>
      <tbody>${rows1}</tbody><tfoot><tr><td colspan="3">계</td><td></td><td class="krext-num">${res.n ? esc(pctTxt(res.sums.a)) : '—'}</td><td></td><td class="krext-num">${esc(r2(res.contribSum))}</td><td class="krext-num">${res.n ? esc(pctTxt(res.sums.b)) : '—'}</td><td></td><td class="krext-num">${res.n ? esc(pctTxt(res.sums.c)) : '—'}</td><td class="krext-num">${res.n ? esc(pctTxt(res.sums.total)) : '—'}</td><td></td></tr></tfoot></table></div>`;
    // 별지 2
    const canMerge = res.n >= 5;
    const groupTxt = res.groups.map((gr) => `${gr.label} ${r2(gr.share)}%${gr.members.length ? ` (${gr.members.length}명 · 1인 ${pctTxt(gr.perHead)}%)` : ' (0명)'}`).join(' · ');
    const opts2 = `<div class="krext-st-budgetline krext-al-opts" aria-label="등급 통합·조정">
      <label title="참여연구원 5명 이상일 때 S 와 A 를 한 등급으로(지급비율은 두 등급 몫의 합)"><input type="checkbox" data-al="merge-sa"${res.merge.sa ? ' checked' : ''}${canMerge ? '' : ' disabled'}> S+A 통합</label>
      <label title="참여연구원 5명 이상일 때 C 와 D 를 한 등급으로"><input type="checkbox" data-al="merge-cd"${res.merge.cd ? ' checked' : ''}${canMerge ? '' : ' disabled'}> C+D 통합</label>
      <span class="krext-al-adj" title="연구책임자가 등급간 지급비율을 최대 10%p 범위에서 제로섬으로 조정 — 등급 몫(%)에 더하는 값">등급 조정 ${GRADES.map((k) => `<label>${k} <input type="text" class="krext-st-in krext-al-in krext-al-num" data-al="adj-${k}" value="${res.adjust[k] ? esc(String(res.adjust[k])) : ''}" inputmode="decimal" placeholder="0"></label>`).join('')}<small>%p</small></span>
      <span class="krext-al-groups" title="참여 연구원 ${res.n}명의 등급별 몫(별지 2 배분기준) — 등급 안에서는 인원수로 나눕니다">${esc(groupTxt)}</span></div>`;
    const rows2 = res.people.filter((r) => !r.admin).map((r) => {
      const off = r.target ? '' : ' krext-al-off';
      return `<tr class="krext-al-row${off}" data-i="${esc(r.id)}"><td>${esc(r.dept)}</td><td class="krext-st-nm">${esc(r.name)}</td><td>${esc(r.grade)}</td><td class="krext-num">${r.target ? esc(pctTxt(r.total)) : '—'}</td><td class="krext-num">${r.target ? `<b>${esc(r.gradeLabel)}</b>` : '—'}</td>
        <td class="krext-al-note"><label class="krext-al-out" title="미지급(퇴직·휴직·병가·연수·파견·참여연구원 변경·연구성과 미기여 등) — 켜면 등급·지급에서 빼고 사유만 적습니다"><input type="checkbox" data-alp="out" data-i="${esc(r.id)}"${r.out ? ' checked' : ''}${r.rate > 0 ? '' : ' disabled'}> 미지급</label><input type="text" class="krext-st-in krext-al-in krext-al-note-in" data-alp="note" data-i="${esc(r.id)}" value="${esc(r.note)}" maxlength="200" placeholder="${r.out ? '미지급 사유' : '기여내용'}" title="기여내용 및 미지급 사유 — ${esc(UNPAID)}"></td>
        <td class="krext-num">${r.target ? esc(pctTxt(r.ratio)) + '%' : '—'}</td><td class="krext-num"><strong>${r.target ? esc(fmtWon(r.amt)) : '—'}</strong></td><td class="krext-al-sign"></td></tr>`;
    }).join('');
    const t2 = `<h4 class="krext-al-h">3. 지급 내역 (별지 2 연구수당 지급 내역서)</h4>${opts2}<div class="krext-ws-table-scroll" tabindex="0" role="region" aria-label="연구수당 지급 내역"><table class="krext-cards krext-st-table krext-al-table krext-al-t2"><thead><tr><th>부서명</th><th class="krext-st-nm">성명</th><th>직급</th><th class="krext-num" title="별지 1 의 합산 기여도">기여도</th><th class="krext-num">평가등급</th><th>기여내용 및 미지급 사유</th><th class="krext-num" title="등급 몫 ÷ 등급 인원">지급비율</th><th class="krext-num" title="원 — 집행 가능액 × 지급비율">지급액(원)</th><th>서명</th></tr></thead>
      <tbody>${rows2}</tbody><tfoot><tr><td colspan="3">계</td><td></td><td></td><td></td><td class="krext-num">${res.n ? esc(pctTxt(res.sums.ratio)) + '%' : '—'}</td><td class="krext-num"><strong>${esc(fmtWon(res.sums.amt))}</strong></td><td></td></tr></tfoot></table></div>`;
    const msg = state.allowMsg && state.allowMsg.key === key ? `<div class="krext-sub krext-st-msg${state.allowMsg.error ? ' krext-err' : ''}" role="status">${esc(state.allowMsg.text)}</div>` : '';
    return `<div class="krext-ws-card krext-al-card" data-alkey="${esc(key)}">${head}<div class="krext-ws-body">${general}${t1}${t2}${warnHtml(checks(res))}${msg}</div></div>`;
  }
  const warnHtml = (warns) => (warns.length ? `<ul class="krext-st-warn">${warns.map((w) => `<li class="krext-st-${w.level === 'info' ? 'note' : w.level}">${esc(w.text)}</li>`).join('')}</ul>` : '');
  const guide = () => `<aside class="krext-st-guide"><strong>10-53 국가연구개발과제 연구수당 지급 기준(2024-03-05)의 별지 1·2 를 그대로 셈합니다.</strong><p>대상은 참여연구원 계획의 연구책임자·연구자(연구지원 제외). <b>합산 기여도</b> = 참여율 환산비율(a)×0.3 + 성과 기여율(b)×0.6 + 기타 환산비율(c)×0.1 — a 는 참여율 ÷ 합, b 는 성과 항목(등급 점수 가 50 · 나 30 · 다 10 × 건수 × 가중치)의 합 ÷ 전체, c 는 기타(우수 100 · 양호 75 · 보통 50 · 미흡 25) ÷ 합. <b>평가등급</b>은 합산 기여도 순으로 참여 연구원 수별 인원 배분표(S 10% · A 20% · B 40% · C 20% · D 10%)대로, 동점은 상위등급. <b>지급비율</b>은 참여 연구원 수별 등급 몫 표를 등급 인원으로 나눈 값이고 지급액 = 집행 가능액 × 지급비율(원 절삭). 책임자는 5명 이상일 때 S+A·C+D 를 통합하거나 등급간 몫을 ±10%p 제로섬으로 조정할 수 있습니다(등급별 최소 3%, 하위등급 1인 ≤ 상위등급 1인). 개인 연간 총액은 기본연봉 × 직급 비율(P1 18 · P2 20 · P3 22 · P4 24 · G/C 22%)을 넘을 수 없어 남은 연구수당을 알면 알립니다.</p><p>부서명·직급·성과 항목·기타·미지급·조정은 이 브라우저에만 저장됩니다(과제·연차별). <b>DOCX 내려받기</b>는 별지 1·2 를 Word 문서로 만듭니다 — 서명·승인(연구주관본부장)은 문서로 받고, R&amp;D ERP 연구수당 지급 신청에는 직접 입력합니다.</p></aside>`;

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
  /* lib/docx.js build 의 입력 — 별지 1 · (쪽 나눔) · 별지 2 */
  function docOf(c) {
    const res = c.res, people = res.people.filter((x) => !x.admin);
    const H = (t, o = {}) => Object.assign({ text: t, shade: true, bold: true }, o);
    const G = (t, o = {}) => Object.assign({ text: t }, o);
    const SH = { text: '', shade: true };
    const amt = (n) => (n == null ? '' : `${fmtWon(n)}원`);
    const b1 = [
      { type: 'p', text: '별지 1', style: 'small' }, { type: 'p', text: '연구수행 기여도 평가서', align: 'CENTER', style: 'title' }, { type: 'p', text: '1. 일반 정보', style: 'h' },
      { type: 'table', widths: [1.7, 2.3, 1.7, 2.3], rows: [[H('연구과제명'), G(c.p.prjNm || '', { colSpan: 3, align: 'LEFT' }), { skip: true }, { skip: true }], [H('당해연도 연구기간'), G(c.period), H('연구책임자명'), G(`${c.p.rspr || ''}        (인)`, { align: 'RIGHT' })], [H('인건비 계상금액'), G(amt(c.payTotal), { align: 'RIGHT' }), H('연구수당 계상금액'), G(amt(c.pool), { align: 'RIGHT' })]] },
      { type: 'p', text: '2. 평가 내용', style: 'h' },
    ];
    const head1 = [[H('부서명', { rowSpan: 2 }), H('성명', { rowSpan: 2 }), H('직급', { rowSpan: 2 }), H('참여도 평가\n(30%)', { colSpan: 2 }), { skip: true }, H('성과 기여도 평가\n(60%)', { colSpan: 6 }), { skip: true }, { skip: true }, { skip: true }, { skip: true }, { skip: true }, H('기타3)\n(10%)', { colSpan: 2 }), { skip: true }, H('합산\n기여도4)', { rowSpan: 2 }), H('평가\n등급5)', { rowSpan: 2 })],
      [{ skip: true }, { skip: true }, { skip: true }, H('참여율\n(%)'), H('환산비율\n(a)'), H('평가항목1)'), H('등급'), H('건수'), H('가중치'), H('기여도'), H('기여율2)\n(b)'), H('평가점수'), H('환산비율\n(c)'), { skip: true }, { skip: true }]];
    const body1 = [];
    for (const r of people) {
      const its = r.target && r.items.length ? r.items : [{ name: r.target ? '' : r.reason, level: '', count: '', weight: '', score: '' }];
      const rs = its.length;
      its.forEach((it, k) => {
        const first = (v, o = {}) => (k ? { skip: true } : G(v, Object.assign({ rowSpan: rs }, o)));
        body1.push([first(r.dept), first(r.name), first(r.grade), first(r.target ? pctTxt(r.rate) : ''), first(r.target ? pctTxt(r.a) : ''), G(it.name, { align: 'LEFT' }), G(it.level), G(it.count === '' ? '' : String(it.count)), G(it.weight === '' ? '' : String(it.weight)), G(it.score === '' ? '' : String(r2(it.score))), first(r.target ? pctTxt(r.b) : ''), first(r.target ? (r.etc == null ? '' : String(r.etc)) : ''), first(r.target ? pctTxt(r.c) : ''), first(r.target ? pctTxt(r.total) : '', { bold: true }), first(r.target ? r.gradeLabel : '', { bold: true })]);
      });
    }
    const foot1 = [[H('계', { colSpan: 3 }), { skip: true }, { skip: true }, H(''), H('100'), SH, SH, SH, SH, H(res.n ? String(r2(res.contribSum)) : ''), H('100'), H(''), H('100'), H('100'), SH]];
    b1.push({ type: 'table', small: true, rowHeight: 900, widths: [1.1, 1.0, 0.7, 0.8, 0.8, 1.9, 0.6, 0.6, 0.7, 0.8, 0.95, 0.8, 0.8, 0.95, 0.8], rows: head1.concat(body1, foot1) });
    b1.push({ type: 'p', text: '1) 평가항목 및 난이도(등급): 가 50점 · 나 30점 · 다 10점(논문 저자·산업재산권 가중치는 별표)  2) 기여율은 개별 참여연구원의 기여도를 합산하여 전체참여연구원간 백분율로 계산  3) 기타는 참여연구원간 협력/소통, 적극성 등을 연구책임자가 평가 — 우수(100), 양호(75), 보통(50), 미흡(25)  4) 합산기여도 = (a×0.3)+(b×0.6)+(c×0.1)  5) 평가등급: S 상위 10%, A 상위 20%, B 40%, C 하위 20%, D 하위 10%', style: 'small' });
    const b2 = [
      { type: 'pagebreak' },
      { type: 'p', text: '별지 2', style: 'small' }, { type: 'p', text: '연구수당 지급 내역서', align: 'CENTER', style: 'title' }, { type: 'p', text: '1. 일반 정보', style: 'h' },
      { type: 'table', widths: [1.7, 2.3, 1.7, 2.3], rows: [[H('연구과제명'), G(c.p.prjNm || '', { colSpan: 3, align: 'LEFT' }), { skip: true }, { skip: true }], [H('연구기관명'), G(c.org), H('연구책임자명'), G(`${c.p.rspr || ''}        (인)`, { align: 'RIGHT' })], [H('당해년도 연구기간'), G(c.period), H('연구수당 계상금액'), G(amt(c.pool), { align: 'RIGHT' })], [H('연구수당 집행 가능액'), G(amt(c.avail), { align: 'RIGHT' }), H('총 지급액'), G(amt(res.sums.amt), { align: 'RIGHT', bold: true })]] },
      { type: 'p', text: '2. 지급 내역', style: 'h' },
    ];
    const rows2 = [[H('부서명'), H('성명'), H('직급'), H('기여도1)'), H('평가등급2)'), H('기여내용 및 미지급 사유3)'), H('지급비율4)'), H('지급액'), H('서명')]];
    for (const r of people) rows2.push([G(r.dept), G(r.name), G(r.grade), G(r.target ? pctTxt(r.total) : ''), G(r.target ? r.gradeLabel : ''), G(r.target ? r.note : (r.note || r.reason), { align: 'LEFT' }), G(r.target ? pctTxt(r.ratio) : ''), G(r.target ? fmtWon(r.amt) : '', { align: 'RIGHT' }), G('')]);
    rows2.push([H('계', { colSpan: 3 }), { skip: true }, { skip: true }, SH, SH, SH, H('100'), H(fmtWon(res.sums.amt), { align: 'RIGHT' }), SH]);
    b2.push({ type: 'table', rowHeight: 420, widths: [1.3, 1.1, 0.8, 0.9, 1.0, 2.3, 1.0, 1.4, 1.0], rows: rows2 });
    b2.push({ type: 'p', text: `*미지급사유 : ${UNPAID}`, style: 'small' });
    b2.push({ type: 'p', text: '1) 기여도는 "연구수행 기여도평가서"의 합산 기여도  2) 평가등급은 "연구수행 기여도 평가서"의 평가등급  3) 미지급 사유: 퇴직, 휴직, 병가, 연수, 파견, 참여연구원 변경, 연구성과 미기여, 기타 등  4) 지급비율은 배분기준을 따름', style: 'small' });
    return { title: `연구수당 계산서 ${c.p.prjNo} ${S.yearLabel(c.year)}`, author: c.org, blocks: b1.concat(b2) };
  }
  const fileName = (c) => `연구수당_${String(c.p.prjNo).replace(/[^\w-]/g, '')}_${S.yearLabel(c.year)}.docx`;

  /* ---------- 입력 처리 (popup.js — 탭) ---------- */
  function bind(host, state, draw) {
    const U = g.KRX_STAFF_UI;
    const entryOf = (key, make) => { state.allowCalc = state.allowCalc || {}; if (!state.allowCalc[key] && make) state.allowCalc[key] = { people: {} }; return state.allowCalc[key] || null; };
    const persist = () => { const r = save(state.allowCalc || {}); if (r && r.catch) r.catch(() => {}); };
    const keyOf = (el) => { const c = el.closest('[data-alkey]'); return c ? c.dataset.alkey : ''; };
    const ctx = (key) => {
      const [prjNo, y] = key.split('@'); const year = Number(y) || 1;
      const p = (((state.data || {}).projects) || []).find((x) => x.prjNo === prjNo); if (!p) return null;
      const plan = (state.staffPlans || {})[key] || null;
      const br = U ? U.budgetRows(p, plan, year, state) : { rows: [] };
      return ctxOf(p, plan, year, br, state, { me: state.staffWho, hr: state.allowHr });
    };
    const personOf = (e, id) => e.people[id] || (e.people[id] = {});
    const tidy = (e, id) => { const o = e.people[id]; if (o && !Object.keys(o).length) delete e.people[id]; };
    host.addEventListener('change', (ev) => {
      const el = ev.target;
      if (!el || !el.dataset || (!el.dataset.al && !el.dataset.alp && !el.dataset.ali)) return;
      const key = keyOf(el); if (!key) return;
      const e = entryOf(key, true);
      const v = typeof el.value === 'string' ? el.value.trim() : '';
      if (el.dataset.al) {
        const k = el.dataset.al;
        if (k === 'pool' || k === 'avail') { const n = S.thousandOf(v); if (v && n == null) return; if (n == null) delete e[k]; else e[k] = n; }
        else if (k === 'org') { if (text(v, 40)) e.org = text(v, 40); else delete e.org; }
        else if (k === 'merge-sa' || k === 'merge-cd') { e.merge = Object.assign({ sa: false, cd: false }, e.merge || {}); e.merge[k === 'merge-sa' ? 'sa' : 'cd'] = !!el.checked; if (!e.merge.sa && !e.merge.cd) delete e.merge; }
        else if (k.startsWith('adj-')) { const gk = k.slice(4); e.adjust = e.adjust || {}; const n = num(v); if (!n) delete e.adjust[gk]; else e.adjust[gk] = n; if (!Object.keys(e.adjust).length) delete e.adjust; }
      } else if (el.dataset.alp) {
        const id = el.dataset.i, k = el.dataset.alp; if (!id) return;
        const o = personOf(e, id);
        if (k === 'out') { if (el.checked) o.out = true; else delete o.out; }
        else if (k === 'etc') { const n = num(v); if (n == null) delete o.etc; else o.etc = n; }
        else { const t = text(v, k === 'note' ? 200 : k === 'grade' ? 20 : 40); if (t) o[k] = t; else delete o[k]; }
        tidy(e, id);
      } else {
        const id = el.dataset.i, k = el.dataset.ali, idx = Number(el.dataset.k); if (!id || !(idx >= 0)) return;
        const o = personOf(e, id); const it = (o.items || [])[idx]; if (!it) return;
        if (k === 'name') it.name = text(v);
        else if (k === 'level') it.level = LEVELS[v] ? v : '가';
        else { const n = num(v); if (n == null || n < 0) return; it[k] = n; }
      }
      e.at = Date.now();
      persist(); draw();
    });
    host.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-act^="al-"]'); if (!btn) return;
      const key = keyOf(btn); if (!key) return;
      const act = btn.dataset.act;
      if (act === 'al-item-add' || act === 'al-item-del') {
        const e = entryOf(key, true), o = personOf(e, btn.dataset.i);
        o.items = o.items || [];
        if (act === 'al-item-add') { if (o.items.length >= 30) return; o.items.push({ name: '', level: '가', count: 1, weight: 1 }); }
        else { o.items.splice(Number(btn.dataset.k), 1); if (!o.items.length) delete o.items; }
        tidy(e, btn.dataset.i); e.at = Date.now(); persist(); draw();
        if (act === 'al-item-add') { const el = host.querySelector(`[data-ali="name"][data-i="${CSS.escape(btn.dataset.i)}"][data-k="${(o.items || []).length - 1}"]`); if (el) el.focus(); }
        return;
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
  }

  g.KRX_ALLOW = { KEY, GRADES, LEVELS, ETC, WEIGHT, ITEMS, HEADCOUNT, PAY_SHARE, headcountOf, shareOf, compute, checks, normalize, load, save, inputOf, poolOfRows, availOfRows, ctxOf, card, guide, tsv, docOf, fileName, bind };
})(typeof self !== 'undefined' ? self : this);
