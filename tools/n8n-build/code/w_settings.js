// ===== 바꿀 값은 이 노드에만 있습니다 =====
const cfg = {
  githubOwner: 'YOUR-GITHUB-ID',
  githubRepo: 'invest-news-site',
  githubBranch: 'main',
  siteUrl: 'https://invest-news-site.vercel.app',
  supabaseUrl: 'https://YOUR-PROJECT.supabase.co',
  vaultRepo: 'invest-vault', // 비우면 옵시디안 노트를 만들지 않음
  vaultBranch: 'main',
  discordWebhookUrl: '', // #브리핑 웹훅. 비우면 알림 없음
  geminiModel: 'gemini-3.8-flash',
  fallbackModel: 'gemini-flash-lite-latest',
  embeddingModel: 'gemini-embedding-001',
  embedDim: 768,
  maxStories: 25, // 이번 주 주요 뉴스 후보 수
  maxFilings: 12, // 이번 주 주요 공시 후보 수
};
// 이번 주 = 오늘(한국 시간) 기준 월~일, 다음 주 = 그다음 월~일
const now = new Date();
const kstMs = now.getTime() + 9 * 3600_000;
const d = new Date(kstMs);
const dow = (d.getUTCDay() + 6) % 7; // 월=0 … 일=6
const day = (off) => new Date(kstMs + off * 86400_000).toISOString().slice(0, 10);
const mon = day(-dow), sun = day(6 - dow), nextMon = day(7 - dow), nextSun = day(13 - dow);
// ISO 주차
const t = new Date(Date.UTC(+mon.slice(0, 4), +mon.slice(5, 7) - 1, +mon.slice(8, 10) + 3));
const y = t.getUTCFullYear();
const week = Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7); // t는 그 주의 목요일
const wk = `${y}-W${String(week).padStart(2, '0')}`;
return [{
  json: {
    ...cfg,
    nowIso: now.toISOString(),
    mon, sun, nextMon, nextSun,
    sinceIso: new Date(Date.parse(`${mon}T00:00:00+09:00`)).toISOString(),
    week: wk,
    title: `${y}년 ${week}주차 주간 리포트 (${mon.slice(5).replace('-', '.')}~${sun.slice(5).replace('-', '.')})`,
  },
}];
