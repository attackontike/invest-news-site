// 관심 종목 중 미국 종목의 SEC 제출 목록 + 연준 보도자료 요청을 만듭니다.
const c = $('설정').first().json;
const ctx = $('수집 맥락 조회').first().json || {};
const out = [{ json: { kind: 'fed', url: c.fedFeed } }];
for (const w of ctx.watchlist || []) {
  if (w.market !== 'US' || !w.cik) continue;
  out.push({ json: { kind: 'sec', url: `https://data.sec.gov/submissions/CIK${String(w.cik).padStart(10, '0')}.json`, watch: w } });
}
return out;
