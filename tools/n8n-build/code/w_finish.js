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
// 주간 리포트 완성. Gemini가 실패하면 숫자·목록만으로 된 리포트를 대신 만듭니다.
const c = $('설정').first().json;
const P = $('자료 정리').first().json;
const { sources } = P;
const ids = new Set(sources.map((s) => s.id));
const byId = Object.fromEntries(sources.map((s) => [s.id, s]));
const clean = (s) => String(s || '').replace(/https?:\/\/\S+/g, '').trim();
const refs = (r) => (Array.isArray(r) ? r.map(String).filter((x) => ids.has(x)).slice(0, 5) : []);

let o = null;
for (const it of $input.all()) { o = parseJson(geminiText(it.json)); if (o && Array.isArray(o.summary)) break; o = null; }
const ai = !!o;
let rep;
if (ai) {
  rep = {
    headline: clean(o.headline),
    summary: (o.summary || []).map(clean).filter(Boolean).slice(0, 5),
    market: (o.market || []).map((x) => ({ text: clean(x.text), refs: refs(x.refs) })).filter((x) => x.text).slice(0, 6),
    watch: (o.watch || []).map((x) => ({ name: clean(x.name), text: clean(x.text), refs: refs(x.refs) })).filter((x) => x.name && x.text),
    data: (o.data || []).map(clean).filter(Boolean).slice(0, 5),
    nextWeek: (o.nextWeek || []).map(clean).filter(Boolean).slice(0, 6),
  };
} else {
  const top = sources.filter((s) => s.kind === 'news').slice(0, 5);
  rep = {
    headline: '이번 주 주요 뉴스와 지표 정리 (AI 요약 없이 자동 정리)',
    summary: top.slice(0, 3).map((s) => `**${s.source}**: ${s.title}`),
    market: top.map((s) => ({ text: s.title, refs: [s.id] })),
    watch: P.watchStats.map((w) => ({ name: w.name, text: `기사 ${w.total}건, 공시 ${w.filings}건 (호재 ${w.up} · 악재 ${w.down})`, refs: w.refs })),
    data: P.indLines.slice(0, 6).map((l) => l.line),
    nextWeek: P.events.filter((e) => (e.importance || 1) >= 2).slice(0, 6).map((e) => `${e.date.slice(5).replace('-', '.')} ${e.time || ''} ${e.name}`.replace(/\s+/g, ' ')),
  };
}
const used = new Set([...rep.market, ...rep.watch].flatMap((x) => x.refs));
const usedSources = sources.filter((s) => used.has(s.id)).map(({ tickers, importance, ...s }) => s);

function b64(str) {
  const by = [];
  for (let i = 0; i < str.length; i++) {
    let cp = str.charCodeAt(i);
    if (cp >= 0xd800 && cp < 0xdc00 && i + 1 < str.length) { const lo = str.charCodeAt(i + 1); if (lo >= 0xdc00 && lo < 0xe000) { cp = 0x10000 + ((cp - 0xd800) << 10) + (lo - 0xdc00); i++; } }
    if (cp < 0x80) by.push(cp); else if (cp < 0x800) by.push(0xc0 | (cp >> 6), 0x80 | (cp & 63)); else if (cp < 0x10000) by.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63)); else by.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
  }
  const T = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < by.length; i += 3) { const n = (by[i] << 16) | ((by[i + 1] || 0) << 8) | (by[i + 2] || 0); out += T[(n >> 18) & 63] + T[(n >> 12) & 63] + (i + 1 < by.length ? T[(n >> 6) & 63] : '=') + (i + 2 < by.length ? T[n & 63] : '='); }
  return out;
}

// ---------- 사이트 파일 ----------
const site = [
  '---',
  `title: ${JSON.stringify(c.title)}`,
  `week: ${JSON.stringify(c.week)}`,
  `range: ${JSON.stringify(`${c.mon} ~ ${c.sun}`)}`,
  `createdAt: ${JSON.stringify(c.nowIso)}`,
  `ai: ${ai}`,
  `report: ${JSON.stringify(rep)}`,
  `events: ${JSON.stringify(P.events)}`,
  `stats: ${JSON.stringify(P.stats)}`,
  `research: ${JSON.stringify(P.research)}`,
  usedSources.length ? 'sources:' : 'sources: []',
  ...usedSources.map((s) => `  - ${JSON.stringify(s)}`),
  '---',
  '',
].join('\n');

// ---------- 옵시디안 ----------
const esc = (t) => String(t).replace(/[[\]]/g, (m) => '\\' + m);
const link = (r) => { const s = byId[r]; return s && s.url ? `[${r}](${s.url})` : r; };
const withRefs = (x) => `${x.text}${x.refs.length ? ' ' + x.refs.map(link).join(' ') : ''}`;
const sec = (t, lines) => (lines.length ? [`## ${t}`, ...lines, ''] : []);
const vault = [
  '---',
  `주차: ${JSON.stringify(c.week)}`,
  `기간: ${JSON.stringify(`${c.mon} ~ ${c.sun}`)}`,
  `AI해석: ${ai}`,
  `사이트: ${JSON.stringify(`${c.siteUrl}/weekly/${c.week}`)}`,
  'tags: ["주간리포트"]',
  '---',
  '',
  `# ${c.title}`,
  '',
  rep.headline ? `> ${rep.headline}` : '',
  '',
  ...sec(ai ? '핵심 (AI 요약)' : '핵심', rep.summary.map((l) => `- ${l}`)),
  ...sec('이번 주 시장 흐름', rep.market.map((x) => `- ${withRefs(x)}`)),
  ...sec('관심 종목', rep.watch.map((x) => `- **${x.name}**: ${withRefs(x)}`)),
  ...sec('지표·시장 심리', rep.data.map((l) => `- ${l}`)),
  ...sec('다음 주 체크포인트', rep.nextWeek.map((l) => `- [ ] ${l}`)),
  ...sec('출처', usedSources.map((s) => `- ${s.id} ${s.date} ${s.source} · ${s.url ? `[${esc(s.title)}](${s.url})` : s.title}`)),
  `관련: [[${c.sun} 시장]]`,
  '',
].join('\n');

// ---------- Discord ----------
const discord = [
  `🗓️ **${c.title}**`,
  rep.headline ? `_${rep.headline}_` : '',
  ...rep.summary.map((l) => `• ${l}`),
  '',
  rep.nextWeek.length ? `**다음 주 체크포인트**\n${rep.nextWeek.slice(0, 5).map((l) => `• ${l}`).join('\n')}` : '',
  '',
  `전체 리포트: ${c.siteUrl}/weekly/${c.week} (1~2분 뒤 열립니다)`,
].filter((x, i, a) => x !== '' || a[i - 1] !== '').join('\n').slice(0, 1990);

const kbText = [rep.headline, ...rep.summary, ...rep.market.map((x) => x.text), ...rep.watch.map((x) => `${x.name}: ${x.text}`), ...rep.data, ...rep.nextWeek.map((l) => `다음 주: ${l}`)].filter(Boolean).join('\n');
return [{
  json: {
    ai,
    sitePath: `src/content/weekly/${c.week}.md`,
    siteContent: b64(site),
    vaultPath: `자동/주간/${c.week} 주간 리포트.md`,
    vaultContent: b64(vault),
    reportRows: [{ report_key: `weekly:${c.week}`, kind: 'weekly', title: c.title, body: JSON.stringify(rep), tickers: [], created_at: c.nowIso }],
    kbChunks: [{ chunk_key: `weekly:${c.week}`, kind: 'weekly', is_ai: true, tier: null, source_grade: null, market: null, tickers: [], source: '주간 리포트', url: `${c.siteUrl}/weekly/${c.week}`, published_at: c.nowIso, content: `${c.title}\n${kbText}`.slice(0, 4000) }],
    discord: { username: '투자 뉴스 브리프 · 주간', content: discord },
    commitMessage: `weekly: ${c.week}${ai ? '' : ' (AI 요약 없음)'}`,
  },
}];
