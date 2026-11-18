// 한국은행 ECOS 요청. 인증키가 없으면 건너뛰기 표시가 붙은 요청 1개
const c = $('설정').first().json;
if (!c.ecosKey) return [{ json: { skip: true, url: 'https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/1/722Y001/M/202601/202601/0101000' } }];
const now = new Date(c.nowIso);
const ymd = (d) => new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10).replace(/-/g, '');
return c.ecos.map((s) => {
  let start, end;
  if (s.cycle === 'M') {
    const d = new Date(now.getTime() - s.months * 31 * 86400_000);
    start = ymd(d).slice(0, 6); end = ymd(now).slice(0, 6);
  } else {
    start = ymd(new Date(now.getTime() - s.days * 86400_000)); end = ymd(now);
  }
  return { json: { series: s, url: `https://ecos.bok.or.kr/api/StatisticSearch/${encodeURIComponent(c.ecosKey)}/json/kr/1/1000/${s.stat}/${s.cycle}/${start}/${end}/${s.item}` } };
});
