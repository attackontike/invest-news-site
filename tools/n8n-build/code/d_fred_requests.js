// FRED 요청: 지표마다 최근 관측값 + 발표 일정 1개
const c = $('설정').first().json;
const out = c.fred.map((s) => ({
  json: { kind: 'series', series: s, url: `https://api.stlouisfed.org/fred/series/observations?series_id=${s.id}&file_type=json&sort_order=desc&limit=${s.limit}` },
}));
out.push({
  json: { kind: 'releases', url: `https://api.stlouisfed.org/fred/releases/dates?file_type=json&realtime_start=${c.today}&realtime_end=${c.until}&include_release_dates_with_no_data=true&order_by=release_date&sort_order=asc&limit=1000` },
});
return out;
