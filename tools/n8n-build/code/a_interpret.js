// 회사명 비교용 키: 대문자, (주)·법인 접미사·기호 제거. 종목 사전과 게시 워크플로가 같은 규칙을 씀
function nameKey(s) {
  let t = String(s || '').toUpperCase();
  t = t.replace(/\(주\)|㈜|주식회사|\(유\)/g, ' ').replace(/&/g, ' AND ').replace(/\/[A-Z]{2}\/?\s*$/, ' ');
  t = t.replace(/[.,'’"()\-\/:;!]/g, ' ');
  const STOP = new Set(['INC', 'INCORPORATED', 'CORP', 'CORPORATION', 'CO', 'COMPANY', 'LTD', 'LIMITED', 'PLC', 'HOLDINGS', 'HOLDING', 'GROUP', 'THE', 'CLASS', 'A', 'B', 'C', 'SA', 'NV', 'AG', 'SE', 'LLC', 'LP', 'ADR', 'DE', 'TECHNOLOGIES', 'TECHNOLOGY']);
  return t.split(/\s+/).filter((w) => w && !STOP.has(w)).join('');
}
// Gemini 응답에서 글자만 꺼내고, JSON이면 읽어 줍니다.
function geminiText(j) {
  const parts = ((((j || {}).candidates || [])[0] || {}).content || {}).parts || [];
  return parts.filter((p) => !p.thought).map((p) => p.text || '').join('');
}
function parseJson(t) {
  t = String(t || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(t); } catch (e) {}
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) {} }
  return null;
}
// 질문 해석 정리. Gemini가 실패해도 질문 그대로 검색합니다.
const c = $('설정').first().json;
const o = parseJson(geminiText($input.first().json)) || {};
const companies = Array.isArray(o.companies) ? o.companies.filter((x) => x && x.name).slice(0, 3).map((x) => ({ name: String(x.name).slice(0, 40), market: x.market === 'US' ? 'US' : 'KR', ticker: x.ticker ? String(x.ticker).toUpperCase().trim() : '' })) : [];
const days = Math.max(1, Math.min(365, c.userDays || Number(o.days) || c.defaultDays));
return [{
  json: {
    companies,
    days,
    searchText: String(o.searchText || c.question).slice(0, 300),
    keys: companies.map((x) => nameKey(x.name)).filter(Boolean),
    tickers: companies.map((x) => x.ticker).filter(Boolean),
  },
}];
