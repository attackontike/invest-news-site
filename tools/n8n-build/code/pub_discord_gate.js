// 웹훅이 비어 있으면 Discord 알림을 건너뜁니다.
if (!$('설정').first().json.discordWebhookUrl) return [];
return [{ json: $('다이제스트 생성').first().json.discord }];
