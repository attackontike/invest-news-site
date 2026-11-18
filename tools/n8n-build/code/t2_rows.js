// "링크 확인" 결과로 열리지 않는 기사를 빼고 저장할 행을 만듭니다.
// 404·410·5xx·연결 실패는 제외, 봇 차단(401·403·405·429)은 브라우저에서 열리므로 유지
function paired(item) {
  const p = item.pairedItem;
  if (Array.isArray(p)) return p[0] ? p[0].item : 0;
  return p && typeof p.item === 'number' ? p.item : 0;
}
const arts = $('새 기사 고르기').all().map((i) => i.json);
const rows = [];
const dead = [];
for (const it of $input.all()) {
  const a = arts[paired(it)];
  if (!a) continue;
  const j = it.json || {};
  const code = j.statusCode;
  const bad = j.error || !code || code === 404 || code === 410 || code >= 500;
  if (bad) { dead.push({ url: a.url, status: code || 'error' }); continue; }
  rows.push({
    url_key: a.url_key, url: a.url, title: a.title, source: a.source, source_trust: a.source_trust,
    source_grade: a.source_grade, tier: a.tier, market: a.market, feed_kind: a.feed_kind,
    published_at: a.published_at, snippet: a.snippet, tickers: a.tickers || [], status: 'new',
  });
}
if (!rows.length) return [];
return [{ json: { rows, dead } }];
