// 볼트 저장소가 비어 있으면 옵시디안 노트 생성을 건너뜁니다.
if (!$('설정').first().json.vaultRepo) return [];
return [{ json: {} }];
