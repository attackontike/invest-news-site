// ===== 바꿀 값은 이 노드에만 있습니다 =====
const cfg = {
  supabaseUrl: 'https://YOUR-PROJECT.supabase.co',
  geminiModel: 'gemini-3.8-flash',
  fallbackModel: 'gemini-flash-lite-latest',
  embeddingModel: 'gemini-embedding-001',
  embedDim: 768,
  matchCount: 12, // 종목으로 거른 검색 결과 수
  extraCount: 6, // 전체에서 더 찾는 결과 수
  maxSources: 14, // 답변에 넘길 최대 기록 수
  defaultDays: 90, // 질문에 기간이 없을 때 찾아볼 기간
  testQuestion: '최근 삼성전자 관련 주요 공시와 뉴스 흐름은?', // n8n에서 직접 실행할 때 쓰는 시험 질문
};

const input = $input.first().json || {};
const fromDiscord = !!(input.question && input.appId && input.token);
const question = String(input.question || cfg.testQuestion).trim().slice(0, 200);
const interpretText = `사용자가 자신의 투자 뉴스 지식베이스에 질문했다. 검색에 필요한 정보를 뽑아라.

질문: ${question}

출력: JSON 하나만.
{"companies": [질문의 중심 상장사 최대 3개. 국내는 {"name": 한국거래소 상장 종목명, "market": "KR"}, 미국은 {"name": 회사명, "market": "US", "ticker": 티커}. 없으면 빈 배열],
 "days": 질문에 기간이 있으면 일수(예: 최근 3개월 → 90, 이번 주 → 7), 없으면 null,
 "searchText": 의미 검색에 쓸 한국어 문장 (질문의 핵심 주제를 담아 한 문장)}`;

return [{
  json: {
    ...cfg,
    question,
    userDays: Number(input.days) || null,
    fromDiscord,
    followUrl: fromDiscord ? `https://discord.com/api/v10/webhooks/${input.appId}/${input.token}` : '',
    nowIso: new Date().toISOString(),
    interpretBody: { contents: [{ role: 'user', parts: [{ text: interpretText }] }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 2048 } },
  },
}];
