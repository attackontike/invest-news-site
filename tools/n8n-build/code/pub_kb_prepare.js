// 지식베이스 조각을 50개씩 묶어 Gemini 임베딩 요청을 만듭니다.
const c = $('설정').first().json;
const chunks = $('다이제스트 생성').first().json.kbChunks || [];
const out = [];
for (let i = 0; i < chunks.length; i += 50) {
  const part = chunks.slice(i, i + 50);
  out.push({
    json: {
      chunks: part,
      body: {
        requests: part.map((k) => ({
          model: `models/${c.embeddingModel}`,
          content: { parts: [{ text: k.content }] },
          taskType: 'RETRIEVAL_DOCUMENT',
          outputDimensionality: c.embedDim,
        })),
      },
    },
  });
}
return out;
