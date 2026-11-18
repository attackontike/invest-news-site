// 이미 저장된 기사를 빼고, 피드당·전체 한도를 적용합니다.
const c = $('설정').first().json;
const { candidates } = $('기사 정리').first().json;
const res = $input.first().json || {};
const existing = new Set(Array.isArray(res.keys) ? res.keys : []);

const fresh = candidates.filter((a) => !existing.has(a.url_key));
fresh.sort((a, b) => b.published_at.localeCompare(a.published_at));

const per = {};
const picked = [];
for (const a of fresh) {
  const k = `${a.feed_kind}:${a.source}`;
  per[k] = (per[k] || 0) + 1;
  if (per[k] > c.perSourceMax) continue;
  picked.push(a);
  if (picked.length >= c.totalMax) break;
}
if (!picked.length) return [];
return picked.map((a) => ({ json: a }));
