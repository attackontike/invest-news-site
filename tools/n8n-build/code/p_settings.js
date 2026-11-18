// ===== 바꿀 값은 이 노드에만 있습니다 =====
const cfg = {
  supabaseUrl: 'https://YOUR-PROJECT.supabase.co',
  discordWebhookUrl: '', // 예고를 받을 채널 웹훅 (#브리핑 또는 #공시알림)
  siteUrl: 'https://invest-news-site.vercel.app',
  minImportance: 2, // 이 중요도 이상만 예고 (1~3)
};
const t = new Date(Date.now() + 9 * 3600_000 + 86400_000);
const tomorrow = t.toISOString().slice(0, 10);
const label = new Intl.DateTimeFormat('ko-KR', { timeZone: 'UTC', month: 'long', day: 'numeric', weekday: 'short' }).format(t);
return [{ json: { ...cfg, tomorrow, label } }];
