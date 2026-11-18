// Discord에서 요청한 리서치만 결과를 Discord로 보냅니다 (n8n에서 직접 시험 실행하면 건너뜀).
if (!$('설정').first().json.followUrl) return [];
return [{ json: $('리포트 완성').first().json.discord }];
