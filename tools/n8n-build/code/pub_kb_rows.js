// 임베딩 결과를 조각과 짝지어 저장할 행을 만듭니다. 768차원으로 줄인 벡터는 길이를 1로 맞춥니다.
const c = $('설정').first().json;
const reqs = $('지식베이스 준비').all();
function paired(item) {
  const p = item.pairedItem;
  if (Array.isArray(p)) return p[0] ? p[0].item : 0;
  return p && typeof p.item === 'number' ? p.item : 0;
}
const rows = [];
for (const it of $input.all()) {
  const req = reqs[paired(it)];
  const embs = (it.json && it.json.embeddings) || [];
  if (!req || embs.length !== req.json.chunks.length) throw new Error('임베딩 결과 개수가 요청과 다릅니다');
  req.json.chunks.forEach((k, i) => {
    const v = embs[i].values || [];
    if (v.length !== c.embedDim) throw new Error(`임베딩 크기 ${v.length} ≠ embedDim ${c.embedDim}`);
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    rows.push({ ...k, embedding: v.map((x) => Math.round((x / norm) * 1e6) / 1e6) });
  });
}
if (!rows.length) return [];
return [{ json: { rows } }];
