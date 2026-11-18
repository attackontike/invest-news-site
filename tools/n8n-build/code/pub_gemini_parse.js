// 회사명 비교용 키: 대문자, (주)·법인 접미사·기호 제거. 종목 사전과 게시 워크플로가 같은 규칙을 씀
function nameKey(s) {
  let t = String(s || '').toUpperCase();
  t = t.replace(/\(주\)|㈜|주식회사|\(유\)/g, ' ').replace(/&/g, ' AND ').replace(/\/[A-Z]{2}\/?\s*$/, ' ');
  t = t.replace(/[.,'’"()\-\/:;!]/g, ' ');
  const STOP = new Set(['INC', 'INCORPORATED', 'CORP', 'CORPORATION', 'CO', 'COMPANY', 'LTD', 'LIMITED', 'PLC', 'HOLDINGS', 'HOLDING', 'GROUP', 'THE', 'CLASS', 'A', 'B', 'C', 'SA', 'NV', 'AG', 'SE', 'LLC', 'LP', 'ADR', 'DE', 'TECHNOLOGIES', 'TECHNOLOGY']);
  return t.split(/\s+/).filter((w) => w && !STOP.has(w)).join('');
}
// Gemini 응답을 읽어 분류·요약 결과를 정리하고, 종목 사전에서 찾아볼 회사명·티커를 모읍니다.
function parseJson(t) {
  t = String(t || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(t); } catch (e) {}
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) {} }
  return null;
}
let classify = null;
const sums = {};
let failed = 0;
for (const it of $input.all()) {
  const j = it.json || {};
  const parts = (((j.candidates || [])[0] || {}).content || {}).parts || [];
  const obj = parseJson(parts.filter((p) => !p.thought).map((p) => p.text || '').join(''));
  if (!obj) { failed++; continue; }
  if (Array.isArray(obj.stories)) classify = obj;
  if (Array.isArray(obj.items)) for (const s of obj.items) if (s && s.id !== undefined) sums[Number(s.id)] = s;
}
if (!classify && !Object.keys(sums).length) throw new Error('Gemini 요약이 모두 실패했습니다');

const keys = new Set();
const tickers = new Set();
for (const s of Object.values(sums)) {
  for (const x of Array.isArray(s.companies) ? s.companies : []) {
    if (!x || !x.name) continue;
    const k = nameKey(x.name);
    if (k) keys.add(k);
    if (x.ticker) tickers.add(String(x.ticker).toUpperCase().trim());
  }
}
return [{ json: { classify, sums, failed, keys: [...keys], tickers: [...tickers] } }];
