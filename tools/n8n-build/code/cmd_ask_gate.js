// /ask면 질문 답변 워크플로를 실행합니다 (끝나기를 기다리지 않음).
const { ask } = $('처리 결정').first().json;
return ask ? [{ json: ask }] : [];
