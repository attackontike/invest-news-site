// 네이버 뉴스 검색 (국내 검색어 + 국내 대상 회사명)
const { plan, targets } = $('조사 대상 정리').first().json;
const qs = [...new Set([...plan.queriesKo, ...targets.filter((t) => t.market === 'KR').map((t) => t.name)])].slice(0, 4);
if (!qs.length) return [{ json: { skip: true, url: 'https://openapi.naver.com/v1/search/news.json?query=skip&display=1' } }];
return qs.map((q) => ({ json: { query: q, url: `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(q)}&display=30&sort=date` } }));
