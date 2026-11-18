// 리포트 조각을 Gemini 임베딩 요청으로 만듭니다.
const c = $('설정').first().json;
const chunks = $('리포트 완성').first().json.kbChunks || [];
if (!chunks.length) return [];
return [{
  json: {
    chunks,
    body: { requests: chunks.map((k) => ({ model: `models/${c.embeddingModel}`, content: { parts: [{ text: k.content }] }, taskType: 'RETRIEVAL_DOCUMENT', outputDimensionality: c.embedDim })) },
  },
}];
