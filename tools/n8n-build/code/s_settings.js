// ===== 바꿀 값은 이 노드에만 있습니다 =====
const now = new Date();
const kst = new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
return [{
  json: {
    githubOwner: 'YOUR-GITHUB-ID',
    githubRepo: 'invest-news-site',
    githubBranch: 'main',
    supabaseUrl: 'https://YOUR-PROJECT.supabase.co',
    embeddingModel: 'gemini-embedding-001',
    embedDim: 768,
    finnhubDays: 90, // 미국 실적 발표 예정일을 며칠 앞까지 찾을지
    krxKey: '', // 공공데이터포털 "금융위원회_주식시세정보" 일반 인증키(Decoding). 비우면 국내 주가를 건너뜀
    nowIso: now.toISOString(),
    today: kst,
    year: Number(kst.slice(0, 4)),
  },
}];
