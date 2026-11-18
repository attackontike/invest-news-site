// 네이버 뉴스 검색 요청 (일반 검색어 + 국내 관심 종목). 둘 다 없으면 건너뛰기 표시가 붙은 요청 1개만 보냅니다.
const c = $('설정').first().json;
const watch = (($('관심 종목 조회').first().json || {}).watchlist || []).slice(0, c.watchNewsMax).filter((w) => w.market === 'KR');
const reqs = (c.naverQueries || []).map((q) => ({ q, display: c.naverDisplay || 30 }));
for (const w of watch) reqs.push({ q: w.label || w.name, display: c.watchNaverDisplay || 10, ticker: { market: 'KR', code: w.code, name: w.label || w.name } });
if (!reqs.length) {
  return [{ json: { skip: true, url: 'https://openapi.naver.com/v1/search/news.json?query=skip&display=1' } }];
}
return reqs.map((r) => ({
  json: {
    kind: 'naver',
    label: r.ticker ? `관심 종목: ${r.q}` : `네이버: ${r.q}`,
    query: r.q,
    ticker: r.ticker,
    url: `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(r.q)}&display=${r.display}&sort=date`,
  },
}));
