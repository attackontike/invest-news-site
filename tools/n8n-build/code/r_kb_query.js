// 지식베이스 검색 요청: 질문 임베딩을 길이 1로 맞추고, 대상 종목이 있으면 그 종목으로 거름
const c = $('설정').first().json;
const { targets } = $('조사 대상 정리').first().json;
const v = ((($input.first().json || {}).embedding) || {}).values || [];
if (v.length !== c.embedDim) return [{ json: { skip: true, body: null } }];
const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
const codes = targets.filter((t) => t.code).map((t) => t.code);
return [{
  json: {
    body: {
      query_embedding: v.map((x) => Math.round((x / norm) * 1e6) / 1e6),
      match_count: c.maxContext,
      filter_codes: codes.length ? codes : null,
      since: new Date(Date.now() - c.kbDays * 86400_000).toISOString(),
      include_ai: true,
    },
  },
}];
