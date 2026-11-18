// 국내 관심 종목의 최근 3개년 분기·연간 보고서 주요 계정 요청 (종목당 12개)
// 보고서 코드: 11013 1분기, 11012 반기, 11014 3분기, 11011 사업보고서
const c = $('설정').first().json;
const watch = (($('관심 종목 조회').first().json || {}).watchlist || []).filter((w) => w.market === 'KR' && w.corp_code);
if (!watch.length) return [{ json: { skip: true, url: `https://opendart.fss.or.kr/api/fnlttSinglAcnt.json?corp_code=00126380&bsns_year=${c.year - 1}&reprt_code=11011` } }];
const out = [];
for (const w of watch) {
  for (const y of [c.year, c.year - 1, c.year - 2]) {
    for (const r of ['11013', '11012', '11014', '11011']) {
      out.push({ json: { watch: w, year: y, reprt: r, url: `https://opendart.fss.or.kr/api/fnlttSinglAcnt.json?corp_code=${w.corp_code}&bsns_year=${y}&reprt_code=${r}` } });
    }
  }
}
return out;
