// 검색 결과를 합쳐 번호(S1…)를 붙이고 답변 요청을 만듭니다.
const c = $('설정').first().json;
const q = $('해석 정리').first().json;
const p = $('검색 준비').first().json;
const rows = [...$('지식베이스 검색 (종목)').all(), ...$('지식베이스 검색 (전체)').all()].map((i) => i.json).filter((r) => r && r.chunk_key && r.content);
const seen = new Set();
const uniq = rows.filter((r) => (seen.has(r.chunk_key) ? false : (seen.add(r.chunk_key), true)));
uniq.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
const top = uniq.slice(0, c.maxSources).sort((a, b) => String(a.published_at).localeCompare(String(b.published_at)));
const KIND = { news: '뉴스', filing: '공시', briefing: '시장 브리핑', research: '리서치', qa: '리서치 Q&A', data: '데이터' };
const day = (iso) => (iso ? new Date(Date.parse(iso) + 9 * 3600_000).toISOString().slice(0, 10) : '');
const sources = top.map((r, i) => ({
  id: `S${i + 1}`, date: day(r.published_at), kind: KIND[r.kind] || r.kind, source: r.source || '', url: r.url || '', isAI: !!r.is_ai,
  title: String(r.content).split('\n')[0].slice(0, 90), content: String(r.content).replace(/\s+/g, ' ').slice(0, 350),
}));
const recs = sources.map((s) => `[${s.id}] ${s.date} ${s.kind}${s.isAI ? ' (AI 해석)' : ''} · ${s.source} — ${s.content}`).join('\n');
const text = `너는 사용자의 투자 뉴스 지식베이스를 검색해 답하는 비서다. 아래 기록만 근거로 질문에 한국어로 답하라.

규칙
- 기록에 없는 내용은 추측하지 말고 없다고 말하라.
- 근거는 refs에 기록 번호(S1 등)로만 달고 URL은 쓰지 마라.
- "AI 해석" 기록은 과거 브리핑·리포트의 해석이다. 사실처럼 쓰지 말고 "당시 브리핑(리포트)은 ~로 봤다"처럼 구분하라.
- 시간 흐름을 묻는 질문이면 날짜 순서로 정리하라.
- 매수·매도 권유, 목표주가, 가격 예측은 하지 마라.

출력: JSON 하나만.
{"answer": [{"text": "문단 2~3문장", "refs": ["S1","S4"]}], "found": true 또는 false, "gaps": "기록이 부족한 점 한 문장, 없으면 빈 문자열"}

질문: ${c.question}
찾아본 기간: 최근 ${q.days}일${p.targets.length ? ` · 종목: ${p.targets.map((t) => `${t.name}(${t.code})`).join(', ')}` : ''}

기록
${recs || '(관련 기록 없음)'}`;
return [{
  json: {
    sources,
    answerBody: { contents: [{ role: 'user', parts: [{ text }] }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 4096 } },
  },
}];
