// 미국 대상 회사의 SEC 서류 + Google News 검색 (국내·영어)
const { plan, targets } = $('조사 대상 정리').first().json;
const c = $('설정').first().json;
const out = [];
for (const t of targets) {
  if (t.market === 'US' && t.cik) out.push({ json: { kind: 'sec', target: t, url: `https://data.sec.gov/submissions/CIK${String(t.cik).padStart(10, '0')}.json` } });
}
const days = `when:${c.newsDays}d`;
for (const q of plan.queriesKo) out.push({ json: { kind: 'gnews', market: 'KR', url: `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} ${days}`)}&hl=ko&gl=KR&ceid=KR:ko` } });
const en = [...plan.queriesEn, ...targets.filter((t) => t.market === 'US' && t.code).map((t) => `${t.code} stock`)].slice(0, 3);
for (const q of en) out.push({ json: { kind: 'gnews', market: 'US', url: `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} ${days}`)}&hl=en-US&gl=US&ceid=US:en` } });
return out;
