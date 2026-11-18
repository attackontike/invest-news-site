// 국내 관심 종목 주가: 금융위원회 주식시세정보 (공공데이터포털, 전 영업일 종가). 인증키가 없으면 건너뜀
const c = $('설정').first().json;
const watch = (($('관심 종목 조회').first().json || {}).watchlist || []).filter((w) => w.market === 'KR');
if (!c.krxKey || !watch.length) return [{ json: { skip: true, url: 'https://apis.data.go.kr/' } }];
const begin = new Date(Date.now() + 9 * 3600_000 - 14 * 86400_000).toISOString().slice(0, 10).replace(/-/g, '');
return watch.map((w) => ({
  json: { watch: w, url: `https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo?serviceKey=${encodeURIComponent(c.krxKey)}&resultType=json&numOfRows=30&pageNo=1&likeSrtnCd=${w.code}&beginBasDt=${begin}` },
}));
