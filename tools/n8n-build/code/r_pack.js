// Gemini 응답에서 글자만 꺼내고, JSON이면 읽어 줍니다.
function geminiText(j) {
  const parts = ((((j || {}).candidates || [])[0] || {}).content || {}).parts || [];
  return parts.filter((p) => !p.thought).map((p) => p.text || '').join('');
}
function parseJson(t) {
  t = String(t || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(t); } catch (e) {}
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) {} }
  return null;
}
// 모은 자료(공시·뉴스·과거 맥락·배경)에 번호를 붙이고, 리포트와 ChatGPT 요청을 만듭니다.
// 모델은 번호로만 근거를 대고 URL은 만들지 않습니다.
const c = $('설정').first().json;
const { plan, targets } = $('조사 대상 정리').first().json;
const now = Date.parse(c.nowIso);
const paired = (it) => { const p = it.pairedItem; return Array.isArray(p) ? (p[0] ? p[0].item : 0) : p && typeof p.item === 'number' ? p.item : 0; };
const kstDay = (iso) => new Date(Date.parse(iso) + 9 * 3600_000).toISOString().slice(0, 10);
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m);
const strip = (s) => decode(decode(s).replace(/<[^>]*>/g, ' ')).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const tag = (b, n) => { const m = b.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, 'i')); return m ? m[1] : ''; };
const TRUST = { '연합뉴스': 4, '연합인포맥스': 5, '한국경제': 4, '매일경제': 4, '서울경제': 3, '이데일리': 3, '머니투데이': 3, '조선일보': 4, '중앙일보': 4, '동아일보': 4, '한겨레': 4, '경향신문': 4, '뉴스1': 3, '뉴시스': 3, '더벨': 4, 'Reuters': 5, 'Bloomberg': 5, 'Associated Press': 5, 'The Wall Street Journal': 5, 'Financial Times': 5, 'CNBC': 4, 'MarketWatch': 4, "Barron's": 4, 'Yahoo Finance': 3 };
const DOMAINS = { 'yna.co.kr': '연합뉴스', 'einfomax.co.kr': '연합인포맥스', 'hankyung.com': '한국경제', 'mk.co.kr': '매일경제', 'sedaily.com': '서울경제', 'edaily.co.kr': '이데일리', 'mt.co.kr': '머니투데이', 'chosun.com': '조선일보', 'joongang.co.kr': '중앙일보', 'donga.com': '동아일보', 'hani.co.kr': '한겨레', 'khan.co.kr': '경향신문', 'news1.kr': '뉴스1', 'newsis.com': '뉴시스', 'thebell.co.kr': '더벨' };
const host = (u) => ((String(u).match(/^https?:\/\/([^/?#:]+)/i) || [])[1] || '').toLowerCase().replace(/^(www|m)\./, '');
const key = (u) => String(u).replace(/^https?:\/\/(www\.|m\.)?/i, '').replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase();

// ---------- 공시 ----------
const filings = [];
const dReq = $('DART 요청 만들기').all().map((i) => i.json);
for (const it of $('DART 공시 조회').all()) {
  const req = dReq[paired(it)] || {};
  if (req.skip) continue;
  const b = (it.json || {}).body || it.json || {};
  for (const d of b.list || []) {
    if (c.dartNoise.some((n) => String(d.report_nm).includes(n))) continue;
    filings.push({ kind: 'filing', title: `[${d.corp_name}] ${String(d.report_nm).trim()}`, source: 'DART', url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${d.rcept_no}`, date: `${d.rcept_dt.slice(0, 4)}-${d.rcept_dt.slice(4, 6)}-${d.rcept_dt.slice(6, 8)}`, isAI: false, market: 'KR', sortKey: d.rcept_no });
  }
}
const ITEMS = { '1.01': '중요 계약 체결', '1.02': '중요 계약 종료', '2.01': '자산 인수·처분', '2.02': '실적 발표', '2.03': '채무 발생', '2.05': '구조조정', '2.06': '자산 손상', '5.02': '임원·이사 변동', '5.07': '주주총회 결과', '7.01': '공정공시', '8.01': '기타 중요 사항' };
const FORMS = ['8-K', '10-Q', '10-K', '6-K', '20-F'];

// ---------- SEC · Google News ----------
const news = [];
const wReq = $('SEC·뉴스 요청 만들기').all().map((i) => i.json);
for (const it of $('SEC·뉴스 조회').all()) {
  const req = wReq[paired(it)] || {};
  const j = it.json || {};
  const body = typeof j.body === 'string' ? j.body : typeof j.data === 'string' ? j.data : '';
  if (j.error || !j.statusCode || j.statusCode >= 400 || !body) continue;
  if (req.kind === 'sec') {
    let s; try { s = JSON.parse(body); } catch (e) { continue; }
    const r = (s.filings || {}).recent || {};
    for (let i = 0; i < (r.accessionNumber || []).length; i++) {
      if (!FORMS.includes(r.form[i])) continue;
      const t = Date.parse(r.acceptanceDateTime[i]) || Date.parse(r.filingDate[i]);
      if (!Number.isFinite(t) || now - t > c.secDays * 86400_000) continue;
      const items = String(r.items[i] || '').split(',').map((x) => x.trim()).filter((x) => ITEMS[x]);
      filings.push({ kind: 'filing', title: `[${req.target.code}] ${r.form[i]}${items.length ? `: ${items.map((x) => ITEMS[x]).join(', ')}` : ''}`, source: 'SEC EDGAR', url: `https://www.sec.gov/Archives/edgar/data/${Number(req.target.cik)}/${r.accessionNumber[i].replace(/-/g, '')}/${r.primaryDocument[i]}`, date: kstDay(new Date(t).toISOString()), isAI: false, market: 'US', sortKey: new Date(t).toISOString().replace(/\D/g, '') });
    }
    continue;
  }
  for (const b of body.match(/<item[\s>][\s\S]*?<\/item>/gi) || []) {
    const source = strip(tag(b, 'source')) || 'Google News';
    let title = strip(tag(b, 'title'));
    if (title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    const t = Date.parse(strip(tag(b, 'pubDate')));
    const url = strip(tag(b, 'link'));
    if (!title || !/^https?:/i.test(url) || !Number.isFinite(t) || now - t > c.newsDays * 86400_000) continue;
    news.push({ kind: 'news', title, source, url, date: kstDay(new Date(t).toISOString()), t, isAI: false, market: req.market, snippet: '', trust: TRUST[source] || 2 });
  }
}

// ---------- 네이버 ----------
const nReq = $('네이버 요청 만들기').all().map((i) => i.json);
for (const it of $('네이버 조회').all()) {
  const req = nReq[paired(it)] || {};
  if (req.skip) continue;
  let b = (it.json || {}).body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  for (const n of (b && b.items) || []) {
    const url = (n.originallink || n.link || '').trim();
    const t = Date.parse(n.pubDate);
    if (!/^https?:/i.test(url) || !Number.isFinite(t) || now - t > c.newsDays * 86400_000) continue;
    const h = host(url);
    const source = DOMAINS[h] || DOMAINS[h.split('.').slice(-2).join('.')] || DOMAINS[h.split('.').slice(-3).join('.')] || h;
    news.push({ kind: 'news', title: strip(n.title), source, url, date: kstDay(new Date(t).toISOString()), t, isAI: false, market: 'KR', snippet: strip(n.description).slice(0, 160), trust: TRUST[source] || 2 });
  }
}

// ---------- 정리: 공시는 최신순, 뉴스는 중복 제거 후 신뢰도·최신순 ----------
filings.sort((a, b) => String(b.sortKey).localeCompare(String(a.sortKey)));
const seen = new Set();
const newsU = news
  .sort((a, b) => b.trust - a.trust || b.t - a.t)
  .filter((n) => { const k = key(n.url); const k2 = n.title.replace(/\s+/g, '').slice(0, 40); if (seen.has(k) || seen.has(k2)) return false; seen.add(k); seen.add(k2); return true; })
  .slice(0, c.maxNews)
  .sort((a, b) => b.t - a.t);

// ---------- 지식베이스 과거 맥락 ----------
const ctx = $('과거 맥락 조회').all().map((i) => i.json).filter((r) => r && r.chunk_key && r.content);
const context = ctx.slice(0, c.maxContext).map((r) => ({ kind: 'context', title: String(r.content).split('\n')[0].slice(0, 80), source: r.is_ai ? `${r.source || '지식베이스'} (AI 해석)` : r.source || '지식베이스', url: r.url || '', date: r.published_at ? kstDay(r.published_at) : '', isAI: !!r.is_ai, snippet: String(r.content).replace(/\s+/g, ' ').slice(0, 300) }));

// ---------- 배경 (Google 검색 기반, 링크는 쓰지 않음) ----------
const background = geminiText($('배경 조사').first().json).replace(/https?:\/\/\S+/g, '').trim().slice(0, 3000);

// ---------- 번호 붙이기 ----------
const sources = [];
filings.slice(0, c.maxFilings).forEach((s, i) => sources.push({ id: `F${i + 1}`, ...s }));
newsU.forEach((s, i) => sources.push({ id: `N${i + 1}`, ...s }));
context.forEach((s, i) => sources.push({ id: `K${i + 1}`, ...s }));
for (const s of sources) { delete s.sortKey; delete s.t; delete s.trust; }

const line = (s, snip) => `[${s.id}] ${s.date} ${s.source} · ${s.title}${snip && s.snippet ? ` — ${s.snippet.slice(0, snip)}` : ''}`;
// 자료 묶음. 입력 길이 제한이 있는 모델에는 개수·길이를 줄여 보냄 (번호는 그대로라 근거 연결이 유지됨)
function makePack(o) {
  const of = (k, n) => sources.filter((s) => s.kind === k).slice(0, n);
  const block = (title, list, snip) => [title, ...(list.length ? list.map((s) => line(s, snip)) : ['(없음)']), ''];
  return [
    `주제: ${c.topic}`,
    `조사 초점: ${plan.focus || '(없음)'}`,
    `대상 종목: ${targets.map((t) => `${t.name}${t.code ? `(${t.code})` : ''}`).join(', ') || '(특정 종목 없음)'}`,
    '',
    ...block('## 공시·공식 서류 (F)', of('filing', o.f), 0),
    ...block(`## 최근 ${c.newsDays}일 뉴스 (N)`, of('news', o.n), o.snip),
    ...block('## 지식베이스 과거 기록 (K) — "AI 해석" 표시는 예전에 AI가 쓴 해석이며 사실이 아님', of('context', o.k), o.ksnip),
    '## 배경 설명 (웹 검색 요약, 근거 번호 없음)',
    (background || '(없음)').slice(0, o.bg),
  ].join('\n');
}
function fitPack(maxChars) {
  const steps = [
    { f: 99, n: 99, k: 99, snip: 160, ksnip: 300, bg: 3000 },
    { f: 12, n: 20, k: 8, snip: 80, ksnip: 160, bg: 1500 },
    { f: 8, n: 12, k: 5, snip: 0, ksnip: 100, bg: 800 },
    { f: 6, n: 8, k: 3, snip: 0, ksnip: 60, bg: 400 },
  ];
  for (const o of steps) { const p = makePack(o); if (p.length <= maxChars) return p; }
  return makePack(steps[steps.length - 1]).slice(0, maxChars);
}
const pack = makePack({ f: 99, n: 99, k: 99, snip: 160, ksnip: 300, bg: 3000 });

const reportText = `너는 한국 개인 투자자를 위한 리서치 애널리스트다. 아래 자료만 근거로 리서치 리포트를 한국어로 작성하라.

규칙
- 자료에 없는 사실을 만들지 마라. 근거는 refs에 자료 번호(F1, N3, K2 등)로 달고, URL은 쓰지 마라.
- K 자료 중 "AI 해석"은 사실이 아니라 과거의 해석이다. 과거 맥락(context)에서는 그때의 쟁점이 지금 자료로 어떻게 됐는지 비교하라.
- 매수·매도 권유, 목표주가, 가격 예측을 쓰지 마라.
- 자료가 부족하면 부족하다고 쓰고 checks에 확인할 것을 남겨라.

출력: JSON 하나만.
{"summary": ["핵심 3~5줄, 각 줄은 '**핵심어**: 문장'"],
 "filings": [{"text": "공시가 말하는 사실 1~2문장", "refs": ["F1"]}],
 "news": [{"text": "뉴스 흐름 정리 1~2문장", "refs": ["N1","N4"], "sentiment": "호재|악재|중립"}],
 "context": [{"text": "과거 기록과 비교", "refs": ["K1"]}],
 "issues": ["핵심 쟁점"],
 "checks": ["앞으로 확인할 공시·발표·지표"],
 "tone": "호재 우세|악재 우세|혼재|중립"}

${pack}`;

const qaSystem = '너는 신중한 한국어 투자 리서치 보조다. 주어진 자료를 근거로 답하고, 자료에 없는 내용은 일반론임을 밝힌다. 매수·매도 권유, 목표주가, 가격 예측은 하지 않는다. URL을 쓰지 않는다. 반드시 JSON 하나만 출력한다.';
const qaUser = (pk) => `아래 주제에 대해 투자자 관점의 질문 7개를 만들고 각각 답하라. 질문 틀: 실적 영향, 성장 동력, 경쟁 구도, 리스크, 반대 시나리오(시장 기대가 틀린다면 왜일까), 앞으로의 일정·변수, 금리·환율·업황 같은 거시 영향. 특정 기업이 아닌 주제라면 틀을 주제에 맞게 바꿔라.

각 답은 2~4문장. refs에는 근거로 쓴 자료 번호, diff에는 답이 자료 내용과 다르거나 자료에 없는 일반론에 기댄 부분이 있으면 그 내용을 짧게(없으면 빈 문자열).

출력: {"qa": [{"q": "질문", "a": "답", "refs": ["N2"], "diff": ""}]}

${pk}`;

return [{
  json: {
    sources,
    background,
    counts: { filings: sources.filter((s) => s.kind === 'filing').length, news: newsU.length, context: context.length, background: background.length },
    reportBody: { contents: [{ role: 'user', parts: [{ text: reportText }] }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 16384, thinkingConfig: { thinkingLevel: 'low' } } },
    qaBodyPrimary: { model: c.qaPrimary.model, messages: [{ role: 'system', content: qaSystem }, { role: 'user', content: qaUser(fitPack(c.qaPrimary.maxChars - 1200)) }], response_format: { type: 'json_object' } },
    qaBodyFallback: { model: c.qaFallback.model, messages: [{ role: 'system', content: qaSystem }, { role: 'user', content: qaUser(fitPack(c.qaFallback.maxChars - 1200)) }], response_format: { type: 'json_object' } },
  },
}];
