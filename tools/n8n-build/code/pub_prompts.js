// Gemini 요청을 만듭니다: 분류 요청 1개 + 요약 요청 여러 개(summaryBatch건씩)
// Gemini는 기사 번호(id)로만 답하고 URL은 만들지 않습니다.
const c = $('설정').first().json;
const now = Date.parse(c.nowIso);
const fresh = $('새 기사 조회').all().map((i) => i.json).filter((r) => r && r.id);
const today = $('오늘 게시분 조회').all().map((i) => i.json).filter((r) => r && r.id);

const skipIds = [];
const usable = [];
for (const r of fresh) {
  if (now - Date.parse(r.published_at) > c.staleHours * 3600_000) skipIds.push(r.id);
  else usable.push(r);
}
usable.sort((a, b) => b.published_at.localeCompare(a.published_at));
const pick = usable.slice(0, c.maxPerEdition);
if (!pick.length) return []; // 새 기사 없음: 이번 회차는 조용히 끝남

const mk = (m) => (m === 'KR' ? '국내' : '미국·해외');
const genCfg = { responseMimeType: 'application/json', maxOutputTokens: 65536, thinkingConfig: { thinkingLevel: 'low' } };
const req = (requestId, text) => ({ requestId, body: { contents: [{ role: 'user', parts: [{ text }] }], generationConfig: genCfg } });

// ---- 분류 요청 ----
const stories = {};
for (const r of today) if (r.story_key && !stories[r.story_key]) stories[r.story_key] = r.title_ko || r.title;
const earlier = Object.entries(stories).slice(0, 150).map(([k, t]) => `${k}: ${t}`).join('\n') || '(없음)';
const list = pick.map((r) => `[${r.id}] (${mk(r.market)}) ${r.title} — ${r.source}`).join('\n');
const classifyText = `너는 한국 개인 투자자를 위한 시장 뉴스 편집자다. 아래 "새 기사"를 같은 사건끼리 묶고 중요도를 매긴 뒤, 오늘의 시장 브리핑을 써라.

규칙
- storyKey: 같은 사건이면 같은 키. 영어 소문자·숫자·하이픈 2~5단어 (예: fed-rate-hold-nov). "오늘 앞서 나온 사건"과 같은 사건이면 그 키를 그대로 써라.
- impact: 0~100. 시장 전체·주요 종목 주가에 미칠 영향과 화제성. 단순 시황 반복·홍보성 기사는 낮게.
- briefing: 4~6줄. 각 줄은 "**핵심어**: 한 문장" 형식의 한국어. 국내와 미국·해외를 고르게 다루고, 사실만 쓰며 매수·매도 권유나 예측은 쓰지 마라. URL을 쓰지 마라.
- 모든 새 기사 id를 stories에 빠짐없이 넣어라.

출력: JSON 하나만.
{"requestId":"classify","stories":[{"id":123,"storyKey":"...","impact":60}],"briefing":["**...**: ..."]}

오늘 앞서 나온 사건 (storyKey: 대표 제목)
${earlier}

새 기사
${list}`;

const out = [{ json: { ...req('classify', classifyText), meta: { pickIds: pick.map((r) => r.id), skipIds } } }];

// ---- 요약 요청 ----
for (let i = 0; i < pick.length; i += c.summaryBatch) {
  const batch = pick.slice(i, i + c.summaryBatch);
  const n = i / c.summaryBatch + 1;
  const arts = batch
    .map((r) => `[${r.id}] (${mk(r.market)}) ${r.source}: ${r.title}${r.snippet ? `\n내용: ${r.snippet}` : ''}`)
    .join('\n\n');
  const text = `너는 한국 개인 투자자를 위한 시장 뉴스 요약가다. 아래 기사마다 다음을 한국어로 작성하라.

- titleKo: 한국어 제목 (국내 기사는 원제를 다듬기만, 해외 기사는 번역). 60자 이내.
- summary: 2~3문장 요약. 기사에 있는 사실만. 내용이 제목뿐이면 제목에서 알 수 있는 것만 1문장.
- keyPoints: 투자자가 알아야 할 핵심 1~3개 (수치·일정·주체 중심). 없으면 빈 배열.
- tags: 다음 중 1~3개 [증시, 금리, 환율, 물가, 고용, 실적, 반도체, 2차전지, AI, 자동차, 바이오, 에너지, 원자재, 부동산, 정책, 규제, 무역, 지정학, 가상자산, 기업, 공모·상장]
- companies: 기사의 중심이 되는 상장 기업 (없으면 빈 배열). 국내 기업은 {"name": 한국거래소 상장 종목명(예: 삼성전자, SK하이닉스, LG에너지솔루션), "market": "KR"}, 미국 상장 기업은 {"name": 회사명, "market": "US", "ticker": 티커(예: NVDA)}. 확실하지 않으면 ticker를 빼라. 국내 종목코드는 쓰지 마라.
- sentiment: 관련 기업·시장에 우호적인 소식이면 "호재", 불리하면 "악재", 판단이 어렵거나 중립적이면 "중립". 기사 논조 분류이며 투자 의견이 아니다.
- credibility: 1~5. 공식 발표·1차 자료 인용·주요 통신사 5, 주요 언론의 사실 보도 4, 해설·전망 기사 3, 출처 불명·추측·홍보성 1~2.

규칙: 모든 기사 id에 대해 빠짐없이 답하라. URL을 쓰지 마라. 매체가 DART·SEC EDGAR·Federal Reserve인 항목은 공시·공식 발표이므로 제목에 담긴 사실만 요약하고 credibility는 5로 하라.
출력: JSON 하나만.
{"requestId":"summary-${n}","items":[{"id":123,"titleKo":"...","summary":"...","keyPoints":["..."],"tags":["..."],"companies":[{"name":"...","market":"US","ticker":"..."}],"sentiment":"중립","credibility":4}]}

기사
${arts}`;
  out.push({ json: req(`summary-${n}`, text) });
}
return out;
