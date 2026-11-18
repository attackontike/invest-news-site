// 저장할 새 공시가 없으면 여기서 끝납니다.
const { rows } = $('새 공시 고르기').first().json;
return rows.length ? [{ json: { rows } }] : [];
