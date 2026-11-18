// 내일 일정 예고 메시지. 일정이 없거나 웹훅이 비어 있으면 보내지 않습니다.
const c = $('설정').first().json;
if (!c.discordWebhookUrl) return [];
const rows = $input.all().map((i) => i.json).filter((r) => r && r.name && (r.importance || 1) >= c.minImportance);
if (!rows.length) return [];
rows.sort((a, b) => (a.event_time || '99').localeCompare(b.event_time || '99'));
const flag = (m) => (m === 'US' ? '🇺🇸' : '🇰🇷');
const lines = rows.map((r) => `• ${r.event_time || '시간 미정'} ${flag(r.market)} ${r.name} ${'★'.repeat(r.importance || 1)}`);
const late = rows.some((r) => r.market === 'US');
return [{
  json: {
    username: '투자 뉴스 브리프 · 일정',
    content: [`📅 **내일, ${c.label} 주요 경제 일정**`, ...lines, late ? '_시각은 한국 시간. 미국 지표는 밤이나 다음 날 새벽에 나옵니다._' : '', `전체 일정: ${c.siteUrl}/data`].filter(Boolean).join('\n'),
  },
}];
