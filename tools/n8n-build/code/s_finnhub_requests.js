// 미국 관심 종목: 실적 발표 일정, 기본 지표, 최근 EPS, 회사 프로필, 시세 (종목당 5개)
const c = $('설정').first().json;
const watch = (($('관심 종목 조회').first().json || {}).watchlist || []).filter((w) => w.market === 'US');
if (!watch.length) return [{ json: { skip: true, url: 'https://finnhub.io/api/v1/stock/metric?symbol=AAPL&metric=all' } }];
const until = new Date(Date.now() + c.finnhubDays * 86400_000).toISOString().slice(0, 10);
const out = [];
for (const w of watch) {
  const s = encodeURIComponent(w.code);
  out.push({ json: { watch: w, kind: 'calendar', url: `https://finnhub.io/api/v1/calendar/earnings?from=${c.today}&to=${until}&symbol=${s}` } });
  out.push({ json: { watch: w, kind: 'metric', url: `https://finnhub.io/api/v1/stock/metric?symbol=${s}&metric=all` } });
  out.push({ json: { watch: w, kind: 'earnings', url: `https://finnhub.io/api/v1/stock/earnings?symbol=${s}&limit=4` } });
  out.push({ json: { watch: w, kind: 'profile', url: `https://finnhub.io/api/v1/stock/profile2?symbol=${s}` } });
  out.push({ json: { watch: w, kind: 'quote', url: `https://finnhub.io/api/v1/quote?symbol=${s}` } });
}
return out;
