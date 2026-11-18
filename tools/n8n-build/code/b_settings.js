// ===== 바꿀 값은 이 노드에만 있습니다 =====
const now = new Date();
return [{
  json: {
    githubOwner: 'YOUR-GITHUB-ID',
    backupRepo: 'invest-backup', // 비공개 저장소 (README로 초기화해 둘 것)
    backupBranch: 'main',
    supabaseUrl: 'https://YOUR-PROJECT.supabase.co',
    discordWebhookUrl: '', // 백업 결과를 받을 채널 웹훅. 비우면 알림 없음
    overlapHours: 24, // 지난 백업 시점보다 이만큼 앞부터 다시 담음 (빠지는 것 방지)
    nowIso: now.toISOString(),
    today: new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10),
  },
}];
