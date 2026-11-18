// 지식베이스 검색 요청 두 개: 종목으로 거른 검색 + 전체 검색 (종목이 없으면 둘 다 전체)
const c = $('설정').first().json;
const p = $('검색 준비').first().json;
const v = ((($input.first().json || {}).embedding) || {}).values || [];
if (v.length !== c.embedDim) return [{ json: { filtered: null, all: null } }];
const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
const vec = v.map((x) => Math.round((x / norm) * 1e6) / 1e6);
const codes = p.targets.map((t) => t.code);
const base = { query_embedding: vec, since: p.since, include_ai: true };
return [{
  json: {
    filtered: { ...base, match_count: c.matchCount, filter_codes: codes.length ? codes : null },
    all: { ...base, match_count: c.extraCount, filter_codes: null },
  },
}];
