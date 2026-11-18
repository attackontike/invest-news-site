// Discord에서 물어본 경우만 답변을 보냅니다 (n8n에서 직접 실행하면 "답변 완성" 출력에서 확인).
if (!$('설정').first().json.followUrl) return [];
return [{ json: $('답변 완성').first().json }];
