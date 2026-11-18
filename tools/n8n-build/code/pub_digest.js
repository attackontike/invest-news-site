// 회사명 비교용 키: 대문자, (주)·법인 접미사·기호 제거. 종목 사전과 게시 워크플로가 같은 규칙을 씀
function nameKey(s) {
  let t = String(s || '').toUpperCase();
  t = t.replace(/\(주\)|㈜|주식회사|\(유\)/g, ' ').replace(/&/g, ' AND ').replace(/\/[A-Z]{2}\/?\s*$/, ' ');
  t = t.replace(/[.,'’"()\-\/:;!]/g, ' ');
  const STOP = new Set(['INC', 'INCORPORATED', 'CORP', 'CORPORATION', 'CO', 'COMPANY', 'LTD', 'LIMITED', 'PLC', 'HOLDINGS', 'HOLDING', 'GROUP', 'THE', 'CLASS', 'A', 'B', 'C', 'SA', 'NV', 'AG', 'SE', 'LLC', 'LP', 'ADR', 'DE', 'TECHNOLOGIES', 'TECHNOLOGY']);
  return t.split(/\s+/).filter((w) => w && !STOP.has(w)).join('');
}
// Gemini 결과를 합쳐 기사 행, 다이제스트 Markdown, Discord 메시지, 지식베이스 조각을 만듭니다.
const c = $('설정').first().json;
const nowIso = c.nowIso;
const now = Date.parse(nowIso);
const meta = ($('프롬프트 생성').all().find((i) => i.json.requestId === 'classify') || { json: { meta: { pickIds: [], skipIds: [] } } }).json.meta;

// ---------- Gemini 결과·종목 사전 ----------
const { classify, sums, failed } = $('Gemini 결과 정리').first().json;
const ctx = $input.first().json || {};
const symbols = Array.isArray(ctx.symbols) ? ctx.symbols : [];
const watchlist = Array.isArray(ctx.watchlist) ? ctx.watchlist : [];
const watchCodes = new Set(watchlist.map((w) => `${w.market}:${w.code}`));
const watchName = Object.fromEntries(watchlist.map((w) => [`${w.market}:${w.code}`, w.name]));
const usByTicker = Object.fromEntries(symbols.filter((x) => x.market === 'US').map((x) => [x.code, x]));
const byKey = {};
for (const x of symbols) (byKey[`${x.market}:${x.name_key}`] = byKey[`${x.market}:${x.name_key}`] || x);

// Gemini가 쓴 회사명을 종목 사전과 맞춤. 사전에 없으면 코드 없이 이름만 남김
function resolve(x) {
  const market = x.market === 'US' ? 'US' : 'KR';
  const tk = x.ticker ? String(x.ticker).toUpperCase().trim() : '';
  let hit = market === 'US' && tk && usByTicker[tk] ? usByTicker[tk] : byKey[`${market}:${nameKey(x.name)}`];
  if (!hit) return { market, name: String(x.name).slice(0, 40) };
  const id = `${hit.market}:${hit.code}`;
  return { market: hit.market, code: hit.code, name: watchName[id] || (hit.market === 'KR' ? hit.name : String(x.name).slice(0, 40)) };
}
function mergeTickers(a, b) {
  const out = [];
  for (const t of [...(a || []), ...(b || [])]) {
    if (!t || !t.name) continue;
    if (out.some((o) => (t.code && o.code === t.code && o.market === t.market) || (!t.code && !o.code && o.name === t.name))) continue;
    out.push(t);
  }
  return out.slice(0, 5);
}

const storyOf = {};
for (const s of (classify && classify.stories) || []) storyOf[Number(s.id)] = s;

// ---------- 기사 행 만들기 ----------
const fresh = {};
for (const i of $('새 기사 조회').all()) if (i.json && i.json.id) fresh[i.json.id] = i.json;
const todayRows = $('오늘 게시분 조회').all().map((i) => i.json).filter((r) => r && r.id);

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const TAGS = new Set(['증시', '금리', '환율', '물가', '고용', '실적', '반도체', '2차전지', 'AI', '자동차', '바이오', '에너지', '원자재', '부동산', '정책', '규제', '무역', '지정학', '가상자산', '기업', '공모·상장']);
const TONES = new Set(['호재', '악재', '중립']);
const stripUrl = (s) => String(s || '').replace(/https?:\/\/\S+/g, '').trim();

const processed = [];
for (const id of meta.pickIds) {
  const r = fresh[id];
  if (!r) continue;
  const s = sums[id] || {};
  const st = storyOf[id] || {};
  const gemCred = Number(s.credibility) || r.source_trust;
  processed.push({
    ...r,
    status: 'published',
    title_ko: stripUrl(s.titleKo) || r.title,
    summary: stripUrl(s.summary),
    key_points: Array.isArray(s.keyPoints) ? s.keyPoints.map(stripUrl).filter(Boolean).slice(0, 3) : [],
    tags: Array.isArray(s.tags) ? s.tags.filter((t) => TAGS.has(t)).slice(0, 3) : [],
    tickers: mergeTickers(r.tickers, Array.isArray(s.companies) ? s.companies.filter((x) => x && x.name).slice(0, 4).map(resolve) : []),
    sentiment: TONES.has(s.sentiment) ? s.sentiment : '중립',
    credibility: clamp(Math.round((gemCred + r.source_trust) / 2), 1, 5),
    impact: clamp(Math.max(Number(st.impact) || 40, r.tier === 'T1' && r.impact ? r.impact : 0), 0, 100), // 공시는 규칙 영향도를 최소값으로
    story_key: (st.storyKey && String(st.storyKey).slice(0, 80)) || `a-${id}`,
    digest_date: c.today,
    edition: c.edition,
    processed_at: nowIso,
  });
}
const skipped = meta.skipIds.map((id) => fresh[id]).filter(Boolean).map((r) => ({ ...r, status: 'skipped', processed_at: nowIso }));

// ---------- 같은 사건 묶기, 점수 ----------
const all = [...todayRows.filter((r) => !meta.pickIds.includes(r.id)), ...processed];
const bySrc = {};
for (const r of all) (bySrc[r.story_key] = bySrc[r.story_key] || new Set()).add(r.source);
const BONUS = { '공시': 20, '통신사': 10, '해설': 5, '커뮤니티': 0 };
for (const r of all) {
  const cov = bySrc[r.story_key].size;
  const age = (now - Date.parse(r.published_at)) / 3600_000;
  const recency = age < 12 ? 10 : age < 24 ? 5 : 0;
  r.coverage = cov;
  const watched = (r.tickers || []).some((t) => t.code && watchCodes.has(`${t.market}:${t.code}`));
  r.importance = clamp(Math.round(0.5 * r.impact + (BONUS[r.source_grade] || 0) + 5 * Math.min(cov - 1, 4) + recency + (watched ? 15 : 0)), 0, 100);
}

// DB 저장용 (모든 행의 열을 똑같이 맞춤)
const COLS = ['url_key', 'url', 'title', 'source', 'source_trust', 'source_grade', 'tier', 'market', 'feed_kind', 'published_at', 'snippet', 'status',
  'title_ko', 'summary', 'key_points', 'tags', 'tickers', 'sentiment', 'credibility', 'impact', 'importance', 'coverage', 'story_key', 'event_type',
  'digest_date', 'edition', 'processed_at'];
const pickCols = (r) => Object.fromEntries(COLS.map((k) => [k, r[k] === undefined ? null : r[k]]));
const articleRows = [...all, ...skipped].map(pickCols);

// ---------- 다이제스트: 사건마다 대표 기사 1건 ----------
const reps = {};
for (const r of all) {
  const k = `${r.tier === 'T1' ? 'T1' : 'T2'}:${r.story_key}`; // 공시와 기사는 따로 대표를 뽑음
  const cur = reps[k];
  if (!cur || r.source_trust > cur.source_trust || (r.source_trust === cur.source_trust && r.importance > cur.importance)) reps[k] = r;
}
const items = Object.values(reps)
  .sort((a, b) => b.importance - a.importance)
  .map((r) => ({
    id: Number(r.id), tier: r.tier, market: r.market, title: r.title, titleKo: r.title_ko || r.title, source: r.source,
    sourceGrade: r.source_grade, url: r.url, publishedAt: new Date(r.published_at).toISOString(), summary: r.summary || '',
    keyPoints: r.key_points || [], tags: r.tags || [], tickers: r.tickers || [], sentiment: r.sentiment || '중립',
    credibility: r.credibility || r.source_trust, importance: r.importance, coverage: r.coverage, storyKey: r.story_key, edition: r.edition || c.edition,
    ...(r.event_type ? { eventType: r.event_type } : {}),
  }));

// ---------- 브리핑 ----------
let briefing = (classify && Array.isArray(classify.briefing) ? classify.briefing : []).map(stripUrl).filter(Boolean).slice(0, 6);
if (!briefing.length) briefing = items.slice(0, 5).map((it) => `**${it.source}**: ${it.titleKo}`);
const editions = [];
for (const i of $('오늘 브리핑 조회').all()) {
  const r = i.json;
  if (!r || !r.report_key) continue;
  const ed = r.report_key.split(':').slice(2).join(':');
  if (ed === c.edition) continue;
  let lines = [];
  try { lines = JSON.parse(r.body); } catch (e) {}
  editions.push({ edition: ed, generatedAt: new Date(r.created_at).toISOString(), briefing: lines });
}
editions.push({ edition: c.edition, generatedAt: nowIso, briefing });
editions.sort((a, b) => a.generatedAt.localeCompare(b.generatedAt));
const reportRows = [{ report_key: `briefing:${c.today}:${c.edition}`, kind: 'briefing', title: `${c.today} ${c.edition} 브리핑`, body: JSON.stringify(briefing), tickers: [], created_at: nowIso }];

// ---------- Markdown (JSON 한 줄 = YAML 한 항목) ----------
const md = [
  '---',
  `date: ${JSON.stringify(c.today)}`,
  `generatedAt: ${JSON.stringify(nowIso)}`,
  watchlist.length ? 'watchlist:' : 'watchlist: []',
  ...watchlist.map((w) => `  - ${JSON.stringify({ market: w.market, code: w.code, name: w.name })}`),
  'editions:',
  ...editions.map((e) => `  - ${JSON.stringify(e)}`),
  items.length ? 'items:' : 'items: []',
  ...items.map((it) => `  - ${JSON.stringify(it)}`),
  '---',
  '',
  ...briefing.map((l) => `- ${l}`),
  '',
].join('\n');

// UTF-8 → Base64 (Buffer 없이)
function b64(str) {
  const by = [];
  for (let i = 0; i < str.length; i++) {
    let cp = str.charCodeAt(i);
    if (cp >= 0xd800 && cp < 0xdc00 && i + 1 < str.length) {
      const lo = str.charCodeAt(i + 1);
      if (lo >= 0xdc00 && lo < 0xe000) { cp = 0x10000 + ((cp - 0xd800) << 10) + (lo - 0xdc00); i++; }
    }
    if (cp < 0x80) by.push(cp);
    else if (cp < 0x800) by.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) by.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else by.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
  }
  const T = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < by.length; i += 3) {
    const n = (by[i] << 16) | ((by[i + 1] || 0) << 8) | (by[i + 2] || 0);
    out += T[(n >> 18) & 63] + T[(n >> 12) & 63] + (i + 1 < by.length ? T[(n >> 6) & 63] : '=') + (i + 2 < by.length ? T[n & 63] : '=');
  }
  return out;
}

// ---------- Discord ----------
const recent = items.filter((it) => now - Date.parse(it.publishedAt) < 24 * 3600_000);
const line = (it) => `${it.sentiment === '호재' ? '🔴' : it.sentiment === '악재' ? '🔵' : '⚪'} [${it.titleKo.slice(0, 90)}](${it.url}) · ${it.source}`;
const filings = recent.filter((it) => it.tier === 'T1').slice(0, 5);
const kr = recent.filter((it) => it.tier !== 'T1' && it.market === 'KR').slice(0, 5);
const us = recent.filter((it) => it.tier !== 'T1' && it.market !== 'KR').slice(0, 5);
const embeds = [
  { title: `${c.today} ${c.edition} 시장 브리핑`, url: c.siteUrl, color: 0x14213d, description: briefing.map((l) => `• ${l}`).join('\n').slice(0, 4000) },
];
if (filings.length) embeds.push({ title: '주요 공시·공식 발표', color: 0x5b6676, description: filings.map(line).join('\n').slice(0, 4000) });
if (kr.length) embeds.push({ title: '국내 주요 뉴스', color: 0xd7263d, description: kr.map(line).join('\n').slice(0, 4000) });
if (us.length) embeds.push({ title: '미국·해외 주요 뉴스', color: 0x1b5fd1, description: us.map(line).join('\n').slice(0, 4000) });

// ---------- 지식베이스 조각 (이번 회차에 새로 요약한 기사 + 브리핑) ----------
const kbChunks = processed.map((r) => ({
  chunk_key: `article:${r.id}`,
  kind: r.tier === 'T1' ? 'filing' : 'news',
  is_ai: false,
  tier: r.tier,
  source_grade: r.source_grade,
  market: r.market,
  tickers: r.tickers,
  source: r.source,
  url: r.url,
  published_at: r.published_at,
  content: [r.title_ko, r.title !== r.title_ko ? r.title : '', r.summary, ...(r.key_points || []).map((p) => `- ${p}`), r.tags.length ? `태그: ${r.tags.join(', ')}` : '', `논조: ${r.sentiment}`]
    .filter(Boolean).join('\n').slice(0, 4000),
}));
kbChunks.push({
  chunk_key: `briefing:${c.today}:${c.edition}`, kind: 'briefing', is_ai: true, tier: null, source_grade: null, market: null, tickers: [],
  source: '시장 브리핑', url: c.siteUrl, published_at: nowIso, content: `${c.today} ${c.edition} 시장 브리핑\n${briefing.join('\n')}`,
});

return [{
  json: {
    articleRows, reportRows, kbChunks,
    noteData: { today: c.today, edition: c.edition, editions, items, watchlist },
    path: `src/content/digest/${c.today}.md`,
    content: b64(md),
    commitMessage: `digest: ${c.today} ${c.edition} (${processed.length}건)`,
    discord: { username: '투자 뉴스 브리프', embeds },
    counts: { processed: processed.length, skipped: skipped.length, items: items.length, geminiFailed: failed },
  },
}];
