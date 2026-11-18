// DART 커서(마지막으로 본 접수번호)가 바뀌었을 때만 저장합니다.
const p = $('새 공시 고르기').first().json;
if (!p.cursorChanged) return [];
return [{ json: { rows: [{ key: 'dart_last_rcept_no', value: p.cursor, updated_at: new Date().toISOString() }] } }];
