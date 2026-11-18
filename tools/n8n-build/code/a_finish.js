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
// Discord에 보낼 답변을 만듭니다. 근거 번호는 원문 링크로 바꿉니다.
const c = $('설정').first().json;
const q = $('해석 정리').first().json;
const p = $('검색 준비').first().json;
const { sources } = $('근거 정리').first().json;
const byId = Object.fromEntries(sources.map((s) => [s.id, s]));
let o = null;
for (const it of $input.all()) { o = parseJson(geminiText(it.json)); if (o && Array.isArray(o.answer)) break; o = null; }

const head = `**Q. ${c.question}**\n_최근 ${q.days}일${p.targets.length ? ` · ${p.targets.map((t) => t.name).join(', ')}` : ''} · 기록 ${sources.length}건 검색_`;
const link = (r) => { const s = byId[r]; return s && /^https?:/.test(s.url) ? `[${r}](<${s.url}>)` : r; };
let content;
if (!sources.length) {
  content = `${head}\n\n지식베이스에서 관련 기록을 찾지 못했습니다. 기간을 늘려(days 옵션) 다시 묻거나, /research로 새로 조사해 보세요.`;
} else if (!o) {
  content = `${head}\n\n⚠️ 답변을 만들지 못했습니다(Gemini 응답 오류). 잠시 뒤 다시 물어봐 주세요.`;
} else {
  const ids = new Set(sources.map((s) => s.id));
  const paras = o.answer.filter((x) => x && x.text).map((x) => {
    const refs = (Array.isArray(x.refs) ? x.refs : []).map(String).filter((r) => ids.has(r)).slice(0, 5);
    return `${String(x.text).replace(/https?:\/\/\S+/g, '').trim()}${refs.length ? ' ' + refs.map(link).join(' ') : ''}`;
  });
  const used = [...new Set(o.answer.flatMap((x) => (Array.isArray(x.refs) ? x.refs.map(String) : [])))].filter((r) => ids.has(r));
  const srcLines = used.slice(0, 8).map((r) => { const s = byId[r]; return `${r} ${s.date} ${s.kind}${s.isAI ? ' (AI 해석)' : ''} · ${s.title.slice(0, 60)}`; });
  content = [
    head,
    '',
    ...paras,
    o.gaps ? `\n_부족한 점: ${String(o.gaps).trim()}_` : '',
    srcLines.length ? `\n**근거**\n${srcLines.join('\n')}` : '',
  ].filter((x) => x !== '').join('\n');
}
if (content.length > 1990) content = content.slice(0, 1985) + '…';
return [{ json: { content } }];
