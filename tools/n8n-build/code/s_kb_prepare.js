// 새로 나온 실적만 Gemini 임베딩 요청으로 만듭니다. 없으면 여기서 끝납니다.
const c = $('설정').first().json;
const chunks = $('종목 데이터 정리').first().json.kbChunks || [];
if (!chunks.length) return [];
return [{ json: { chunks, body: { requests: chunks.map((k) => ({ model: `models/${c.embeddingModel}`, content: { parts: [{ text: k.content }] }, taskType: 'RETRIEVAL_DOCUMENT', outputDimensionality: c.embedDim })) } } }];
