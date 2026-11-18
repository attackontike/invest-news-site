// 매체 RSS와 Google News 검색 주소를 요청 목록으로 만듭니다.
const c = $('설정').first().json;
const out = [];
for (const f of c.feeds) {
  out.push({ json: { kind: 'rss', label: f.name, url: f.url, source: f.source, market: f.market, trust: f.trust, grade: f.grade } });
}
for (const g of c.googleNews) {
  const q = encodeURIComponent(`${g.q} when:1d`);
  const loc = g.market === 'KR' ? 'hl=ko&gl=KR&ceid=KR:ko' : 'hl=en-US&gl=US&ceid=US:en';
  out.push({ json: { kind: 'gnews', label: `Google News: ${g.q}`, url: `https://news.google.com/rss/search?q=${q}&${loc}`, market: g.market } });
}
// 관심 종목 중 미국 종목: Google News 영어 검색
const watch = (($('관심 종목 조회').first().json || {}).watchlist || []).slice(0, c.watchNewsMax);
for (const w of watch) {
  if (w.market !== 'US') continue;
  const q = encodeURIComponent(`${w.code} stock when:1d`);
  out.push({ json: { kind: 'gnews', label: `관심 종목: ${w.code}`, url: `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`, market: 'US', ticker: { market: 'US', code: w.code, name: w.label || w.name } } });
}
return out;
