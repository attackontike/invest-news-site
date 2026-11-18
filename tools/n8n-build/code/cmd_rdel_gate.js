// /research-delete면 리서치 삭제로 넘어갑니다.
const { rdel } = $('처리 결정').first().json;
return rdel ? [{ json: rdel }] : [];
