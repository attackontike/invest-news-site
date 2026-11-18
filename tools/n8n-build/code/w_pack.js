// 한 주치 자료를 모아 번호(W1…)를 붙이고 Gemini 요청을 만듭니다.
const c = $('설정').first().json;
const rows = (n) => $(n).all().map((i) => i.json).filter((r) => r && Object.keys(r).length);
const arts = rows('주간 기사 조회');
const inds = rows('지표 조회');
const events = rows('다음 주 일정 조회');
const watch = (($('관심 종목 조회').first().json || {}).watchlist) || [];
const research = rows('주간 리서치 조회');
const day = (iso) => new Date(Date.parse(iso) + 9 * 3600_000).toISOString().slice(0, 10);

// 사건마다 대표 1건 (신뢰도·중요도 높은 것), 뉴스와 공시 따로
function reps(list, n) {
  const m = new Map();
  for (const a of list) {
    const k = a.story_key || `a-${a.id}`;
    const cur = m.get(k);
    if (!cur || (a.importance || 0) > (cur.importance || 0)) m.set(k, a);
  }
  return [...m.values()].sort((a, b) => (b.importance || 0) - (a.importance || 0)).slice(0, n);
}
const news = reps(arts.filter((a) => a.tier !== 'T1'), c.maxStories);
const filings = reps(arts.filter((a) => a.tier === 'T1'), c.maxFilings);

const sources = [];
const add = (a, kind) => { const id = `W${sources.length + 1}`; sources.push({ id, kind, title: a.title_ko || a.title, source: a.source, url: a.url, date: day(a.published_at), market: a.market, sentiment: a.sentiment || '중립', importance: a.importance || 0, tickers: a.tickers || [] }); return id; };
filings.forEach((a) => add(a, 'filing'));
news.forEach((a) => add(a, 'news'));

// 관심 종목별 한 주 통계
const has = (a, w) => (a.tickers || []).some((t) => t.code === w.code && t.market === w.market);
const watchStats = watch.map((w) => {
  const mine = arts.filter((a) => has(a, w));
  const cnt = (s) => mine.filter((a) => a.sentiment === s).length;
  return { market: w.market, code: w.code, name: w.name, total: mine.length, filings: mine.filter((a) => a.tier === 'T1').length, up: cnt('호재'), down: cnt('악재'), refs: sources.filter((s) => s.tickers.some((t) => t.code === w.code && t.market === w.market)).slice(0, 4).map((s) => s.id) };
});

// 지표: 최근 값과 1주 전 값 (일간 지표만 1주 비교, 월간 지표는 이번 주 발표된 경우 표시)
const num = (v) => (v === null || v === undefined ? '-' : Number(v).toLocaleString('en-US', { maximumFractionDigits: Math.abs(v) < 10 ? 4 : 2 }));
const indLines = inds.map((i) => {
  const h = Array.isArray(i.history) ? i.history : [];
  const daily = /^\d{4}-\d{2}-\d{2}$/.test(String(i.latest_date || ''));
  let line = `${i.name}: ${num(i.latest_value)}${i.unit === '%' ? '%' : ` ${i.unit}`} (${i.latest_date})`;
  if (daily) {
    const prev = [...h].reverse().find((p) => p[0] < c.mon);
    if (prev && i.latest_value !== null) line += `, 1주 전 ${num(prev[1])} → ${(i.latest_value - prev[1] >= 0 ? '+' : '')}${num(Math.round((i.latest_value - prev[1]) * 10000) / 10000)}`;
  } else if (String(i.updated_at || '') >= c.sinceIso && i.prev_value !== null) {
    line += `, 이전 발표 ${num(i.prev_value)}`;
  }
  return { key: i.series_key, market: i.market, line };
});

const evLines = events.map((e) => `${e.event_date} ${e.event_time || ''} [${e.market === 'US' ? '미국' : '한국'}] ${e.name}${'★'.repeat(e.importance || 1)}`.replace(/\s+/g, ' ').trim());
const line = (s) => `[${s.id}] ${s.date} ${s.source} · ${s.title} (중요도 ${s.importance}, ${s.sentiment})`;
const pack = [
  `기간: ${c.mon} ~ ${c.sun}`,
  '', '## 이번 주 주요 공시 (W)', ...(sources.filter((s) => s.kind === 'filing').map(line)), sources.some((s) => s.kind === 'filing') ? '' : '(없음)',
  '', '## 이번 주 주요 뉴스 (W)', ...(sources.filter((s) => s.kind === 'news').map(line)), sources.some((s) => s.kind === 'news') ? '' : '(없음)',
  '', '## 관심 종목 이번 주 통계', ...(watchStats.length ? watchStats.map((w) => `${w.name}(${w.code}): 기사 ${w.total}건, 공시 ${w.filings}건, 호재 ${w.up} · 악재 ${w.down}, 관련 번호 ${w.refs.join(', ') || '없음'}`) : ['(관심 종목 없음)']),
  '', '## 지표 (최근 값, 1주 비교)', ...indLines.map((l) => l.line),
  '', `## 다음 주 일정 (${c.nextMon} ~ ${c.nextSun}, 한국 시간)`, ...(evLines.length ? evLines : ['(없음)']),
  '', '## 이번 주 리서치', ...(research.length ? research.map((r) => `- ${r.title}`) : ['(없음)']),
].join('\n');

const text = `너는 한국 개인 투자자를 위한 주간 시장 리포트 편집자다. 아래 자료만 근거로 지난 한 주를 정리하고 다음 주를 준비하는 리포트를 한국어로 써라.

규칙
- 자료에 없는 사실을 만들지 마라. 근거는 refs에 번호(W1 등)로만 달고 URL은 쓰지 마라.
- 매수·매도 권유, 목표주가, 가격 예측은 쓰지 마라. "체크포인트"는 확인할 일정·지표·공시로만.
- 지표는 숫자 변화를 그대로 전하고 해석은 짧게.

출력: JSON 하나만.
{"headline": "이번 주를 한 문장으로",
 "summary": ["**핵심어**: 문장" 3~5줄],
 "market": [{"text": "이번 주 시장 흐름 1~2문장", "refs": ["W3"]}] 3~5개,
 "watch": [{"name": "관심 종목 이름", "text": "이번 주 그 종목 소식 1~2문장 (없으면 '특별한 소식 없음')", "refs": ["W1"]}],
 "data": ["지표·시장 심리 변화 한 문장"] 2~4개,
 "nextWeek": ["다음 주 체크포인트 (날짜 포함)"] 3~5개}

${pack}`;

return [{
  json: {
    sources, watchStats, indLines, events: events.map((e) => ({ date: e.event_date, time: e.event_time, market: e.market, name: e.name, importance: e.importance })),
    research: research.map((r) => ({ title: r.title, key: r.report_key })),
    stats: { articles: arts.length, filings: arts.filter((a) => a.tier === 'T1').length, research: research.length },
    body: { contents: [{ role: 'user', parts: [{ text }] }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 8192, thinkingConfig: { thinkingLevel: 'low' } } },
  },
}];
