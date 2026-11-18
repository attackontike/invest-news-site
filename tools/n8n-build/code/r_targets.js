// 회사명 비교용 키: 대문자, (주)·법인 접미사·기호 제거. 종목 사전과 게시 워크플로가 같은 규칙을 씀
function nameKey(s) {
  let t = String(s || '').toUpperCase();
  t = t.replace(/\(주\)|㈜|주식회사|\(유\)/g, ' ').replace(/&/g, ' AND ').replace(/\/[A-Z]{2}\/?\s*$/, ' ');
  t = t.replace(/[.,'’"()\-\/:;!]/g, ' ');
  const STOP = new Set(['INC', 'INCORPORATED', 'CORP', 'CORPORATION', 'CO', 'COMPANY', 'LTD', 'LIMITED', 'PLC', 'HOLDINGS', 'HOLDING', 'GROUP', 'THE', 'CLASS', 'A', 'B', 'C', 'SA', 'NV', 'AG', 'SE', 'LLC', 'LP', 'ADR', 'DE', 'TECHNOLOGIES', 'TECHNOLOGY']);
  return t.split(/\s+/).filter((w) => w && !STOP.has(w)).join('');
}
// 해석된 회사를 종목 사전과 맞춰 조사 대상을 정합니다. 사전에 없는 회사는 뉴스 검색에만 씁니다.
const { plan } = $('해석 정리').first().json;
const ctx = $input.first().json || {};
const symbols = Array.isArray(ctx.symbols) ? ctx.symbols : [];
const watch = Array.isArray(ctx.watchlist) ? ctx.watchlist : [];
const label = Object.fromEntries(watch.map((w) => [`${w.market}:${w.code}`, w.name]));
const targets = [];
for (const x of plan.companies) {
  const hit = (x.market === 'US' && x.ticker && symbols.find((s) => s.market === 'US' && s.code === x.ticker))
    || symbols.find((s) => s.market === x.market && s.name_key === nameKey(x.name));
  if (!hit) { targets.push({ market: x.market, name: x.name }); continue; }
  if (targets.some((t) => t.code === hit.code && t.market === hit.market)) continue;
  targets.push({
    market: hit.market, code: hit.code, corp_code: hit.corp_code, cik: hit.cik,
    name: label[`${hit.market}:${hit.code}`] || (hit.market === 'KR' ? hit.name : x.name),
    fullName: hit.name,
  });
}
const c = $('설정').first().json;
const bgText = `한국 개인 투자자를 위해 다음 주제의 배경을 웹 검색으로 확인해 한국어로 정리하라. 최근 동향, 관련 산업 구조, 주요 수치, 시장이 주목하는 쟁점을 5~8문장으로. 매수·매도 권유나 가격 예측은 쓰지 말고, 확실하지 않은 내용은 쓰지 마라.
주제: ${c.topic}
초점: ${plan.focus || c.topic}
관련 종목: ${targets.map((t) => t.fullName || t.name).join(', ') || '(없음)'}`;
const kbText = [c.topic, plan.focus, ...targets.map((t) => t.name)].filter(Boolean).join(' / ');
return [{
  json: {
    plan,
    targets,
    backgroundBody: { contents: [{ role: 'user', parts: [{ text: bgText }] }], tools: [{ google_search: {} }] },
    embedBody: { content: { parts: [{ text: kbText }] }, taskType: 'RETRIEVAL_QUERY', outputDimensionality: c.embedDim },
  },
}];
