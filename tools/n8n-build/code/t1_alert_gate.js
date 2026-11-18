// 즉시 알림: 웹훅이 비어 있거나 알릴 공시가 없으면 건너뜁니다. Discord는 메시지당 카드 10개까지.
const hook = $('설정').first().json.discordAlertWebhook;
const { alerts } = $('새 공시 고르기').first().json;
if (!hook || !alerts.length) return [];
const out = [];
for (let i = 0; i < alerts.length; i += 10) {
  out.push({ json: { payload: { username: '투자 뉴스 브리프 · 공시', content: i === 0 ? `🔔 새 공시 ${alerts.length}건` : '', embeds: alerts.slice(i, i + 10) } } });
}
return out;
