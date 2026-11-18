// ===== 바꿀 값은 이 노드에만 있습니다 =====
const cfg = {
  githubOwner: 'YOUR-GITHUB-ID',
  githubRepo: 'invest-news-site',
  githubBranch: 'main',
  siteUrl: 'https://invest-news-site.vercel.app',
  supabaseUrl: 'https://YOUR-PROJECT.supabase.co',
  vaultRepo: 'invest-vault', // 비우면 옵시디안 노트를 만들지 않음
  vaultBranch: 'main',

  geminiModel: 'gemini-3.8-flash',
  fallbackModel: 'gemini-flash-lite-latest',
  embeddingModel: 'gemini-embedding-001',
  embedDim: 768,
  // 다른 AI의 투자 관점 Q&A: 기본(primary)이 실패하거나 한도에 걸리면 예비(fallback)로 넘어감
  // 둘 다 OpenAI 방식 요청을 받는 무료 서비스. 모델 이름은 각 서비스의 모델 목록에서 확인
  qaPrimary: {
    name: 'GitHub Models',
    url: 'https://models.github.ai/inference/chat/completions',
    model: 'openai/gpt-4.1-mini',
    maxChars: 6000, // 무료 등급은 요청당 입력 길이 제한이 작아 자료를 줄여 보냄
  },
  qaFallback: {
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'openai/gpt-oss-120b', // 안 되면 'llama-3.3-70b-versatile'
    maxChars: 30000,
  },
  secUserAgent: 'invest-news-site your-email@example.com',

  filingDays: 30, // 국내 공시 조회 기간
  secDays: 90, // 미국 SEC 서류 조회 기간
  newsDays: 7, // 뉴스 조회 기간
  kbDays: 180, // 지식베이스 과거 맥락 조회 기간
  maxFilings: 15,
  maxNews: 30,
  maxContext: 12,
  // 리서치에서 뺄 반복성 공시 (보고서명에 들어 있으면 제외)
  dartNoise: ['임원ㆍ주요주주특정증권등소유상황보고서', '최대주주등소유주식변동신고서', '특수관계인'],

  testTopic: '삼성전자 HBM', // n8n에서 직접 실행할 때 쓰는 시험용 주제 (Discord로 결과를 보내지 않음)
};

const input = $input.first().json || {};
const now = new Date();
const kst = (d) => new Date(d.getTime() + 9 * 3600_000).toISOString();
const ymd8 = (d) => kst(d).slice(0, 10).replace(/-/g, '');
const fromDiscord = !!(input.topic && input.appId && input.token);
const topic = String(input.topic || cfg.testTopic).trim().slice(0, 100);

const interpretText = `너는 한국 개인 투자자의 리서치 보조다. 사용자가 조사하려는 주제를 해석하라.

주제: ${topic}

출력: JSON 하나만.
{"title": 한국어 리포트 제목(30자 이내),
 "slug": 영어 소문자·숫자·하이픈 2~5단어,
 "companies": [주제의 중심이 되는 상장사 최대 3개. 국내는 {"name": 한국거래소 상장 종목명, "market": "KR"}, 미국은 {"name": 회사명, "market": "US", "ticker": 티커}. 특정 기업이 아닌 주제면 빈 배열],
 "queriesKo": [국내 뉴스 검색어 1~3개, 짧게],
 "queriesEn": [해외 뉴스 영어 검색어 0~2개. 해외와 관련이 없으면 빈 배열],
 "focus": 투자자 입장에서 조사 초점 한 문장}`;

return [{
  json: {
    ...cfg,
    topic,
    fromDiscord,
    followUrl: fromDiscord ? `https://discord.com/api/v10/webhooks/${input.appId}/${input.token}` : '',
    nowIso: now.toISOString(),
    today: kst(now).slice(0, 10),
    stamp: kst(now).slice(0, 16).replace('T', '-').replace(':', ''),
    endDe: ymd8(now),
    bgnDe: ymd8(new Date(now.getTime() - cfg.filingDays * 86400_000)),
    interpretBody: {
      contents: [{ role: 'user', parts: [{ text: interpretText }] }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 4096 },
    },
  },
}];
