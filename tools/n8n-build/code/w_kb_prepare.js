const c = $('설정').first().json;
const chunks = $('리포트 완성').first().json.kbChunks || [];
if (!chunks.length) return [];
return [{ json: { chunks, body: { requests: chunks.map((k) => ({ model: `models/${c.embeddingModel}`, content: { parts: [{ text: k.content }] }, taskType: 'RETRIEVAL_DOCUMENT', outputDimensionality: c.embedDim })) } } }];
