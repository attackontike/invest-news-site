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
// 리포트를 완성합니다: 사이트 파일, 옵시디안 노트, DB 행, 지식베이스 조각, Discord 메시지.
const c = $('설정').first().json;
const { plan, targets } = $('조사 대상 정리').first().json;
const P = $('자료 정리').first().json;
const sources = P.sources;
const ids = new Set(sources.map((s) => s.id));
const byId = Object.fromEntries(sources.map((s) => [s.id, s]));
const clean = (s) => String(s || '').replace(/https?:\/\/\S+/g, '').trim();
const refs = (r) => (Array.isArray(r) ? r.map(String).filter((x) => ids.has(x)).slice(0, 6) : []);

// ---------- Gemini 리포트 ----------
let rep = null;
for (const it of $('리포트 결과 합치기').all()) {
  const o = parseJson(geminiText(it.json));
  if (o && Array.isArray(o.summary)) { rep = o; break; }
}
if (!rep) {
  return [{ json: { ok: false, discord: { content: `⚠️ "${c.topic}" 리서치를 완성하지 못했습니다. Gemini 리포트 작성이 실패했어요. 잠시 뒤 다시 시도해 주세요.` } } }];
}
const TONES = ['호재 우세', '악재 우세', '혼재', '중립'];
const report = {
  summary: (rep.summary || []).map(clean).filter(Boolean).slice(0, 6),
  filings: (rep.filings || []).map((x) => ({ text: clean(x.text), refs: refs(x.refs) })).filter((x) => x.text).slice(0, 10),
  news: (rep.news || []).map((x) => ({ text: clean(x.text), refs: refs(x.refs), sentiment: ['호재', '악재', '중립'].includes(x.sentiment) ? x.sentiment : '중립' })).filter((x) => x.text).slice(0, 12),
  context: (rep.context || []).map((x) => ({ text: clean(x.text), refs: refs(x.refs) })).filter((x) => x.text).slice(0, 8),
  issues: (rep.issues || []).map(clean).filter(Boolean).slice(0, 6),
  checks: (rep.checks || []).map(clean).filter(Boolean).slice(0, 6),
  background: P.background || '',
};
const tone = TONES.includes(rep.tone) ? rep.tone : '중립';

// ---------- 다른 AI의 투자 관점 Q&A (기본 → 예비) ----------
let qa = [];
let qaModel = '';
const qaErrors = [];
for (const it of $input.all()) {
  const oj = it.json || {};
  const qo = parseJson((((oj.choices || [])[0] || {}).message || {}).content);
  if (qo && Array.isArray(qo.qa) && qo.qa.length) {
    qa = qo.qa.filter((x) => x && x.q && x.a).slice(0, 8).map((x) => ({ q: clean(x.q), a: clean(x.a), refs: refs(x.refs), diff: clean(x.diff) }));
    qaModel = String(oj.model || '').replace(/^openai\//, '') || 'AI';
    break;
  }
  const e = oj.error;
  if (e) qaErrors.push(String((e.message || e.code || e.description || JSON.stringify(e))).slice(0, 120));
}
const qaNote = qa.length ? '' : (qaErrors.join(' / ') || '응답 없음');

// ---------- 공통 ----------
const coded = targets.filter((t) => t.code).map((t) => ({ market: t.market, code: t.code, name: t.name }));
const url = `${c.siteUrl}/research/${plan.slug}`;
const used = new Set([...report.filings, ...report.news, ...report.context, ...qa].flatMap((x) => x.refs));
const usedSources = sources.filter((s) => used.has(s.id));

// UTF-8 → Base64 (Buffer 없이)
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

// ---------- 사이트 파일 (JSON 한 줄 = YAML 한 항목) ----------
const site = [
  '---',
  `title: ${JSON.stringify(plan.title)}`,
  `topic: ${JSON.stringify(c.topic)}`,
  `slug: ${JSON.stringify(plan.slug)}`,
  `createdAt: ${JSON.stringify(c.nowIso)}`,
  `tone: ${JSON.stringify(tone)}`,
  `focus: ${JSON.stringify(plan.focus)}`,
  `tickers: ${JSON.stringify(coded)}`,
  `report: ${JSON.stringify(report)}`,
  `qa: ${JSON.stringify(qa)}`,
  `qaModel: ${JSON.stringify(qaModel)}`,
  usedSources.length ? 'sources:' : 'sources: []',
  ...usedSources.map((s) => `  - ${JSON.stringify({ id: s.id, kind: s.kind, title: s.title, source: s.source, url: s.url, date: s.date, isAI: s.isAI })}`),
  '---',
  '',
].join('\n');

// ---------- 옵시디안 노트 ----------
const safe = (s) => String(s).replace(/[\\/:*?"<>|#^[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
const link = (r) => { const s = byId[r]; return s && s.url ? `[${r}](${s.url})` : r; };
const withRefs = (x) => `${x.text}${x.refs.length ? ' ' + x.refs.map(link).join(' ') : ''}`;
const noteName = (t) => (t.market === 'US' ? safe(t.code) : safe(t.name));
const sec = (title, lines) => (lines.length ? [`## ${title}`, ...lines, ''] : []);
const vault = [
  '---',
  `주제: ${JSON.stringify(c.topic)}`,
  `생성: ${JSON.stringify(c.stamp)}`,
  `논조: ${JSON.stringify(tone)}`,
  `종목: ${JSON.stringify(coded.map((t) => `[[${noteName(t)}]]`))}`,
  `사이트: ${JSON.stringify(url)}`,
  'AI해석: true',
  'tags: ["리서치"]',
  '---',
  '',
  `# ${plan.title}`,
  '',
  `> 주제: ${c.topic}${plan.focus ? `\n> 초점: ${plan.focus}` : ''}`,
  '',
  ...sec('요약 (AI)', report.summary.map((l) => `- ${l}`)),
  ...sec('공시·공식 서류', report.filings.map((x) => `- ${withRefs(x)}`)),
  ...sec('뉴스 흐름', report.news.map((x) => `- ${x.sentiment === '호재' ? '🔴' : x.sentiment === '악재' ? '🔵' : '⚪'} ${withRefs(x)}`)),
  ...sec('배경 설명 (AI, 웹 검색 요약)', report.background ? [report.background] : []),
  ...sec('과거 맥락 (지식베이스)', report.context.map((x) => `- ${withRefs(x)}`)),
  ...sec('핵심 쟁점', report.issues.map((l) => `- ${l}`)),
  ...sec(`다른 AI의 투자 관점 Q&A (${qaModel || '-'}, AI 해석)`, qa.flatMap((x) => [`**Q. ${x.q}**`, `${x.a}${x.refs.length ? ' ' + x.refs.map(link).join(' ') : ''}`, ...(x.diff ? [`> 자료와 다른 점: ${x.diff}`] : []), ''])),
  ...sec('추가 확인 필요', report.checks.map((l) => `- [ ] ${l}`)),
  ...sec('출처', usedSources.map((s) => `- ${s.id} ${s.date} ${s.source} · ${s.url ? `[${s.title.replace(/[[\]]/g, (m) => '\\' + m)}](${s.url})` : s.title}`)),
  `관련: ${coded.map((t) => `[[${noteName(t)}]]`).join(' ')} [[${c.today} 시장]]`,
  '',
].join('\n');
const vaultPath = `자동/리서치/${c.today.slice(0, 7)}/${c.stamp} ${safe(plan.title)}.md`;

// ---------- 지식베이스 조각 ----------
const base = { tier: null, source_grade: null, market: targets[0] ? targets[0].market : null, tickers: coded, source: '리서치 리포트', url, published_at: c.nowIso };
const chunk = (k, kind, isAi, text) => (text.trim() ? [{ ...base, chunk_key: `research:${plan.slug}#${k}`, kind, is_ai: isAi, content: `${plan.title} (${c.today})\n${text}`.slice(0, 4000) }] : []);
const kbChunks = [
  ...chunk('summary', 'research', true, [...report.summary, ...report.issues.map((l) => `쟁점: ${l}`)].join('\n')),
  ...chunk('filings', 'research', false, report.filings.map((x) => x.text).join('\n')),
  ...chunk('news', 'research', false, report.news.map((x) => `[${x.sentiment}] ${x.text}`).join('\n')),
  ...chunk('context', 'research', true, report.context.map((x) => x.text).join('\n')),
  ...chunk('background', 'research', true, report.background),
  ...chunk('checks', 'research', true, report.checks.map((l) => `확인 필요: ${l}`).join('\n')),
  ...qa.flatMap((x, i) => chunk(`qa${i + 1}`, 'qa', true, `Q. ${x.q}\nA. ${x.a}`)),
];

// ---------- Discord ----------
const qaLines = qa.slice(0, 2).map((x) => `• **${x.q}**\n  ${x.a.slice(0, 160)}${x.a.length > 160 ? '…' : ''}`);
const discord = [
  `📑 **${plan.title}** (${tone})`,
  ...report.summary.map((l) => `• ${l}`),
  '',
  qa.length ? `**다른 AI의 투자 관점** (${qaModel}, 전체 ${qa.length}개 중 2개)\n${qaLines.join('\n')}` : `다른 AI의 Q&A는 이번에 받지 못했습니다 (${qaNote}).`,
  '',
  `자료: 공시 ${P.counts.filings} · 뉴스 ${P.counts.news} · 과거 기록 ${P.counts.context}`,
  `전체 리포트: ${url} (1~2분 뒤 열립니다)`,
].join('\n');

return [{
  json: {
    ok: true,
    sitePath: `src/content/research/${plan.slug}.md`,
    siteContent: b64(site),
    vaultPath,
    vaultContent: b64(vault),
    commitMessage: `research: ${plan.title}`,
    reportRows: [{ report_key: `research:${plan.slug}`, kind: 'research', title: plan.title, body: JSON.stringify({ topic: c.topic, tone, ...report, qa, qaModel }), tickers: coded, created_at: c.nowIso }],
    kbChunks,
    discord: { content: discord.slice(0, 1990) },
  },
}];
