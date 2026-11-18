// 회사명 비교용 키: 대문자, (주)·법인 접미사·기호 제거. 종목 사전과 게시 워크플로가 같은 규칙을 씀
function nameKey(s) {
  let t = String(s || '').toUpperCase();
  t = t.replace(/\(주\)|㈜|주식회사|\(유\)/g, ' ').replace(/&/g, ' AND ').replace(/\/[A-Z]{2}\/?\s*$/, ' ');
  t = t.replace(/[.,'’"()\-\/:;!]/g, ' ');
  const STOP = new Set(['INC', 'INCORPORATED', 'CORP', 'CORPORATION', 'CO', 'COMPANY', 'LTD', 'LIMITED', 'PLC', 'HOLDINGS', 'HOLDING', 'GROUP', 'THE', 'CLASS', 'A', 'B', 'C', 'SA', 'NV', 'AG', 'SE', 'LLC', 'LP', 'ADR', 'DE', 'TECHNOLOGIES', 'TECHNOLOGY']);
  return t.split(/\s+/).filter((w) => w && !STOP.has(w)).join('');
}
// 회사를 종목 사전과 맞추고 검색 문장을 만듭니다.
const c = $('설정').first().json;
const q = $('해석 정리').first().json;
const ctx = $input.first().json || {};
const symbols = Array.isArray(ctx.symbols) ? ctx.symbols : [];
const targets = [];
for (const x of q.companies) {
  const hit = (x.market === 'US' && x.ticker && symbols.find((s) => s.market === 'US' && s.code === x.ticker))
    || symbols.find((s) => s.market === x.market && s.name_key === nameKey(x.name));
  if (hit && !targets.some((t) => t.code === hit.code)) targets.push({ market: hit.market, code: hit.code, name: hit.market === 'KR' ? hit.name : x.name });
}
const text = [q.searchText, ...targets.map((t) => t.name)].join(' / ');
return [{
  json: {
    targets,
    since: new Date(Date.now() - q.days * 86400_000).toISOString(),
    embedBody: { content: { parts: [{ text }] }, taskType: 'RETRIEVAL_QUERY', outputDimensionality: c.embedDim },
  },
}];
