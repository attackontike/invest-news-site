// ===== 바꿀 값은 이 노드에만 있습니다 =====
const cfg = {
  githubOwner: 'YOUR-GITHUB-ID',
  githubRepo: 'invest-news-site',
  githubBranch: 'main',
  siteUrl: 'https://invest-news-site.vercel.app',
  supabaseUrl: 'https://YOUR-PROJECT.supabase.co',

  geminiModel: 'gemini-3.8-flash', // 404 no longer available이면 오류가 알려 주는 새 이름으로
  fallbackModel: 'gemini-flash-lite-latest', // 기본 모델이 3번 실패하면 사용
  embeddingModel: 'gemini-embedding-001', // 지식베이스용
  embedDim: 768, // Supabase kb_chunks.embedding 크기와 같아야 함

  discordWebhookUrl: '', // #브리핑 채널 웹훅. 비우면 알림을 건너뜀

  vaultRepo: 'invest-vault', // 옵시디안 볼트 저장소(비공개, githubOwner 계정). 비우면 노트 생성을 건너뜀
  vaultBranch: 'main',

  maxPerEdition: 90, // 한 회차에 요약할 최대 기사 수
  summaryBatch: 15, // Gemini 요약 요청 1개에 담을 기사 수
  staleHours: 72, // 이보다 오래된 미처리 기사는 요약하지 않고 건너뜀
};

// 회차 이름: 정해진 시각이면 그 이름, 수동 실행이면 실제 시각
const now = new Date();
const kst = new Date(now.getTime() + 9 * 3600_000);
const ymd = kst.toISOString().slice(0, 10);
const t = kst.getUTCHours() * 60 + kst.getUTCMinutes();
const slot = ['07:00', '12:00', '16:30', '22:00'].find((s) => {
  const m = Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  return t >= m && t - m < 30;
});
const edition = slot || kst.toISOString().slice(11, 16);

return [{ json: { ...cfg, today: ymd, edition, nowIso: now.toISOString() } }];
