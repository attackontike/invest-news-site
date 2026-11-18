// 회사명 비교용 키: 대문자, (주)·법인 접미사·기호 제거. 종목 사전과 게시 워크플로가 같은 규칙을 씀
function nameKey(s) {
  let t = String(s || '').toUpperCase();
  t = t.replace(/\(주\)|㈜|주식회사|\(유\)/g, ' ').replace(/&/g, ' AND ').replace(/\/[A-Z]{2}\/?\s*$/, ' ');
  t = t.replace(/[.,'’"()\-\/:;!]/g, ' ');
  const STOP = new Set(['INC', 'INCORPORATED', 'CORP', 'CORPORATION', 'CO', 'COMPANY', 'LTD', 'LIMITED', 'PLC', 'HOLDINGS', 'HOLDING', 'GROUP', 'THE', 'CLASS', 'A', 'B', 'C', 'SA', 'NV', 'AG', 'SE', 'LLC', 'LP', 'ADR', 'DE', 'TECHNOLOGIES', 'TECHNOLOGY']);
  return t.split(/\s+/).filter((w) => w && !STOP.has(w)).join('');
}
// 명령에 맞게 할 일(추가·삭제)과 Discord 답장을 정합니다.
const p = $('명령 해석').first().json;
const ctx = $input.first().json || {};
const list = Array.isArray(ctx.watchlist) ? ctx.watchlist : [];
const cands = Array.isArray(ctx.candidates) ? ctx.candidates : [];
const mk = (m) => (m === 'KR' ? '국내' : '미국');
const fmt = (w) => `${w.name} (${w.code}, ${mk(w.market)})`;
const listText = () => (list.length ? list.map((w) => `• ${fmt(w)}`).join('\n') : '(비어 있음)');

let reply = '';
let insert = null;
let del = null;
let research = null;
let ask = null;
let rdel = null;

if (p.command === 'ask') {
  if (!p.question) {
    reply = '질문을 입력해 주세요. 예: /ask question:최근 삼성전자 공시 흐름은?';
  } else {
    ask = { question: p.question.slice(0, 200), days: p.days, appId: p.appId, token: p.token };
    reply = `🔍 지식베이스에서 찾는 중: **${ask.question}**${p.days ? ` (최근 ${p.days}일)` : ''}`;
  }
} else if (p.command === 'research') {
  if (!p.topic) {
    reply = '조사할 주제를 입력해 주세요. 예: /research topic:삼성전자 HBM';
  } else {
    research = { topic: p.topic.slice(0, 100), appId: p.appId, token: p.token };
    reply = `🔎 리서치를 시작합니다: **${research.topic}**\n공시·뉴스·과거 기록을 모으고 Gemini 리포트와 다른 AI의 투자 관점 Q&A를 만드는 데 1~3분 걸립니다. 끝나면 이 채널에 결과를 보내 드릴게요.`;
  }
} else if (p.command === 'research-delete') {
  if (!/^[0-9A-Za-z][0-9A-Za-z_-]{2,80}$/.test(p.slug || '')) {
    reply = '지울 리서치의 주소를 넣어 주세요. 예: /research-delete target:https://…/research/2026-11-17-1407-report';
  } else {
    rdel = { slug: p.slug, appId: p.appId, token: p.token };
    reply = `🗑️ 리서치 **${p.slug}** 를 지우는 중입니다. 사이트 파일, 리포트 기록, 지식베이스 조각을 함께 지웁니다.`;
  }
} else if (p.command !== 'watch') {
  reply = `/${p.command} 명령은 아직 준비 중입니다.`;
} else if (p.sub === 'list') {
  reply = `⭐ 관심 종목 ${list.length}개\n${listText()}`;
} else if (p.sub === 'add') {
  const pick = (r) => cands.filter((x) => x.rank === r);
  const one = pick(0).length === 1 ? pick(0)[0] : pick(1).length === 1 ? pick(1)[0] : cands.length === 1 ? cands[0] : null;
  if (!cands.length) {
    reply = `"${p.q}"에 맞는 종목을 찾지 못했습니다. 종목코드(예: 005930)나 티커(예: NVDA)로 다시 입력해 보세요. 미국 종목은 영어 이름이나 티커로 찾을 수 있습니다.\n(종목 사전 워크플로를 한 번도 실행하지 않았다면 먼저 실행해야 합니다.)`;
  } else if (!one) {
    reply = `"${p.q}"에 맞는 종목이 여러 개입니다. 종목코드나 티커로 다시 입력해 주세요.\n${cands.map((x) => `• ${x.name} — /watch add symbol:${x.code}`).join('\n')}`;
  } else if (list.some((w) => w.market === one.market && w.code === one.code)) {
    reply = `이미 관심 종목입니다: ${fmt(list.find((w) => w.market === one.market && w.code === one.code))}`;
  } else {
    const name = (p.label || (one.market === 'KR' ? one.name : one.code)).slice(0, 30);
    insert = { market: one.market, code: one.code, name };
    reply = `✅ 관심 종목에 추가했습니다: ${fmt(insert)}${one.market === 'US' && !p.label ? `\n(회사명: ${one.name}. 한글 이름을 쓰려면 삭제 후 label 옵션으로 다시 추가)` : ''}\n다음 수집부터 공시와 뉴스를 챙기고, 다음 게시 회차부터 사이트에 반영됩니다. 현재 ${list.length + 1}개.`;
  }
} else if (p.sub === 'remove') {
  const q = p.q.toUpperCase();
  const hit = list.find((w) => w.code.toUpperCase() === q || w.name === p.q || nameKey(w.name) === p.key);
  if (!hit) {
    reply = `"${p.q}"는 관심 종목에 없습니다.\n현재 목록:\n${listText()}`;
  } else {
    del = { market: hit.market, code: hit.code };
    reply = `🗑️ 관심 종목에서 삭제했습니다: ${fmt(hit)}. 남은 종목 ${list.length - 1}개.`;
  }
} else {
  reply = '알 수 없는 명령입니다.';
}

return [{ json: { reply: reply.slice(0, 1900), insert, del, research, ask, rdel, followUrl: p.followUrl } }];
