// 리포트 작성에 실패했으면 Discord로 알립니다 (Discord에서 요청한 경우만).
const f = $('리포트 완성').first().json;
if (f.ok || !$('설정').first().json.followUrl) return [];
return [{ json: f.discord }];
