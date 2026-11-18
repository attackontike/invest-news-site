// Gemini 응답에서 글자만 꺼내고, JSON이면 읽어 줍니다.
function geminiText(j) {
  const parts = ((((j || {}).candidates || [])[0] || {}).content || {}).parts || [];
  return parts.filter((p) => !p.thought).map((p) => p.text || '').join('');
}
function parseJson(t) {
  t = String(t || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(t); } catch (e) {}
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) {} }
  return null;
}
