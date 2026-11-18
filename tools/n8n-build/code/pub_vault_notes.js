// 옵시디안 노트를 만들어 GitHub 트리 요청으로 묶습니다 (회차당 커밋 1번).
// n8n은 "자동/" 폴더만 덮어쓰고, "종목/" 노트는 없을 때 한 번만 만듭니다.
const c = $('설정').first().json;
const { today, edition, editions, items, watchlist = [] } = $('다이제스트 생성').first().json.noteData;
const listing = $('볼트 파일 목록').first().json || {};
const parent = (($('볼트 기준 커밋').first().json || {}).object || {}).sha;
if (!listing.sha || !parent) throw new Error('볼트 저장소를 읽지 못했습니다. 저장소가 비어 있지 않은지(README로 초기화) 확인하세요.');

const paths = new Set((listing.tree || []).filter((t) => t.type === 'blob').map((t) => t.path));

// ---------- 도우미 ----------
const q = (v) => JSON.stringify(v); // YAML에서 그대로 읽히는 문자열
const safe = (s) => String(s).replace(/[\\/:*?"<>|#^[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
function hash(s) { // FNV-1a → 6자리, 같은 사건 노트를 다시 찾기 위한 꼬리표
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0').slice(0, 6);
}
const kst = (iso) => new Date(Date.parse(iso) + 9 * 3600_000).toISOString().replace('T', ' ').slice(0, 16);
const mkt = (m) => (m === 'KR' ? '국내' : m === 'US' ? '미국' : '해외');
const dot = (t) => (t === '호재' ? '🔴' : t === '악재' ? '🔵' : '⚪');
const month = today.slice(0, 7);
// 종목 노트 이름: 국내는 종목명, 미국은 티커. 종목 사전에서 확인된(코드가 있는) 종목만 노트를 만듦
const noteName = (t) => (t.market === 'US' ? safe(t.code) : safe(t.name));
const coded = (list) => (list || []).filter((t) => t && t.code);
const watchSet = new Set(watchlist.map((w) => `${w.market}:${w.code}`));
const dailyName = `${today} 시장`;

// ---------- 기사 노트 (사건마다 대표 기사 1개) ----------
const files = [];
const noteOf = {};
for (const it of items) {
  const tag = hash(`${today}:${it.tier === 'T1' ? 'T1:' : ''}${it.storyKey || it.id}`); // 공시와 기사는 같은 사건이어도 노트를 따로
  const existing = [...paths].find((p) => p.startsWith(`자동/기사/${month}/`) && p.endsWith(` ~${tag}.md`));
  const path = existing || `자동/기사/${month}/${safe(it.titleKo) || '기사'} ~${tag}.md`;
  const name = path.split('/').pop().replace(/\.md$/, '');
  noteOf[it.id] = name;
  const tickers = coded(it.tickers).map((t) => `[[${noteName(t)}]]`);
  const plain = (it.tickers || []).filter((t) => !t.code).map((t) => t.name);
  const body = [
    '---',
    `날짜: ${today}`,
    `발행: ${q(kst(it.publishedAt))}`,
    `출처: ${q(it.source)}`,
    `등급: ${q(it.sourceGrade)}`,
    ...(it.eventType ? [`공시유형: ${q(it.eventType)}`] : []),
    `시장: ${q(mkt(it.market))}`,
    `논조: ${q(it.sentiment)}`,
    `중요도: ${it.importance}`,
    `신뢰도: ${it.credibility}`,
    `보도매체: ${it.coverage}`,
    `종목: ${q(tickers)}`,
    `원문: ${q(it.url)}`,
    'AI해석: false',
    `tags: ${q((it.tags || []).map((t) => t.replace(/[\s·]/g, '_')))}`,
    '---',
    '',
    `# ${it.titleKo}`,
    it.titleKo !== it.title ? `\n> ${it.title}` : '',
    '',
    it.summary || '(요약 없음)',
    '',
    ...(it.keyPoints && it.keyPoints.length ? ['## 핵심 내용', ...it.keyPoints.map((p) => `- ${p}`), ''] : []),
    `[원문 보기](${it.url})`,
    '',
    `관련: [[${dailyName}]]${tickers.length ? ' ' + tickers.join(' ') : ''}${plain.length ? ` (그 밖에 언급: ${plain.join(', ')})` : ''}`,
    '',
  ].join('\n');
  files.push({ path, content: body });
}

// ---------- 일일 노트 ----------
const row = (it) => `- ${dot(it.sentiment)} [[${noteOf[it.id]}|${it.titleKo.replace(/[|\]]/g, ' ')}]] ${it.source}, 중요도 ${it.importance}${it.coverage > 1 ? `, ${it.coverage}개 매체` : ''}`;
const filings = items.filter((it) => it.tier === 'T1');
const kr = items.filter((it) => it.tier !== 'T1' && it.market === 'KR');
const us = items.filter((it) => it.tier !== 'T1' && it.market !== 'KR');
const tickerOf = {};
for (const it of items) for (const t of coded(it.tickers)) tickerOf[noteName(t)] = t;
const allTickers = Object.keys(tickerOf);
const daily = [
  '---',
  `날짜: ${today}`,
  `마지막회차: ${q(edition)}`,
  `기사수: ${items.length}`,
  'tags: ["시장브리핑"]',
  '---',
  '',
  `# ${today} 시장`,
  '',
  '## 브리핑 (AI 요약)',
  ...[...editions].reverse().flatMap((e) => ['', `### ${e.edition}`, ...(e.briefing || []).map((l) => `- ${String(l).replace(/^[-*]\s+/, '')}`)]),
  '',
  `## 공시·공식 발표 (${filings.length})`,
  ...(filings.length ? filings.map(row) : ['- 없음']),
  '',
  `## 국내 (${kr.length})`,
  ...(kr.length ? kr.map(row) : ['- 없음']),
  '',
  `## 미국·해외 (${us.length})`,
  ...(us.length ? us.map(row) : ['- 없음']),
  '',
  ...(allTickers.length ? ['## 오늘 언급된 종목', allTickers.map((t) => `${watchSet.has(`${tickerOf[t].market}:${tickerOf[t].code}`) ? '⭐' : ''}[[${t}]]`).join(' '), ''] : []),
].join('\n');
files.push({ path: `자동/일일/${dailyName}.md`, content: daily });

// ---------- 종목 노트 (없을 때만) ----------
for (const name of allTickers) {
  const t = tickerOf[name];
  const exists = [...paths].some((p) => p.endsWith(`/${name}.md`) || p === `${name}.md`);
  if (exists) continue;
  files.push({
    path: `종목/${name}.md`,
    content: [
      '---',
      `시장: ${q(t.market === 'US' ? '미국' : '국내')}`,
      `종목코드: ${q(t.code)}`,
      `이름: ${q(t.name)}`,
      'tags: ["종목"]',
      '---',
      '',
      `# ${t.name} (${t.code})`,
      '',
      '## 최근 기사',
      '```dataview',
      'TABLE 발행, 논조, 중요도, 출처',
      'FROM "자동/기사"',
      'WHERE contains(종목, this.file.link)',
      'SORT 발행 DESC',
      'LIMIT 30',
      '```',
      '(Dataview 플러그인이 없으면 오른쪽의 백링크에서 관련 기사를 볼 수 있습니다.)',
      '',
      '## 내 메모',
      '',
    ].join('\n'),
  });
}

return [{
  json: {
    parent,
    message: `notes: ${today} ${edition} (기사 ${items.length}건)`,
    tree: { base_tree: listing.sha, tree: files.map((f) => ({ path: f.path, mode: '100644', type: 'blob', content: f.content })) },
    count: files.length,
  },
}];
