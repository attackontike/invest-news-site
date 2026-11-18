// /research면 리서치 워크플로를 실행합니다 (끝나기를 기다리지 않음).
const { research } = $('처리 결정').first().json;
return research ? [{ json: research }] : [];
