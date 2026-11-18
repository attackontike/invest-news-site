// 국내 대상 회사의 최근 공시 요청. 없으면 건너뛰기 요청 1개 (DART 응답만 무시함)
const c = $('설정').first().json;
const { targets } = $('조사 대상 정리').first().json;
const kr = targets.filter((t) => t.market === 'KR' && t.corp_code);
if (!kr.length) return [{ json: { skip: true, url: `https://opendart.fss.or.kr/api/list.json?bgn_de=${c.endDe}&end_de=${c.endDe}&page_count=1` } }];
return kr.map((t) => ({
  json: { target: t, url: `https://opendart.fss.or.kr/api/list.json?corp_code=${t.corp_code}&bgn_de=${c.bgnDe}&end_de=${c.endDe}&page_count=50` },
}));
