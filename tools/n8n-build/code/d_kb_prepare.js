// 새 관측값을 Gemini 임베딩 요청으로 만듭니다. 새 값이 없으면 여기서 끝납니다.
const c = $('설정').first().json;
const chunks = $('데이터 정리').first().json.kbChunks || [];
if (!chunks.length) return [];
return [{ json: { chunks, body: { requests: chunks.map((k) => ({ model: `models/${c.embeddingModel}`, content: { parts: [{ text: k.content }] }, taskType: 'RETRIEVAL_DOCUMENT', outputDimensionality: c.embedDim })) } } }];
