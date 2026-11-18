// 회사명 비교용 키: 대문자, (주)·법인 접미사·기호 제거. 종목 사전과 게시 워크플로가 같은 규칙을 씀
function nameKey(s) {
  let t = String(s || '').toUpperCase();
  t = t.replace(/\(주\)|㈜|주식회사|\(유\)/g, ' ').replace(/&/g, ' AND ').replace(/\/[A-Z]{2}\/?\s*$/, ' ');
  t = t.replace(/[.,'’"()\-\/:;!]/g, ' ');
  const STOP = new Set(['INC', 'INCORPORATED', 'CORP', 'CORPORATION', 'CO', 'COMPANY', 'LTD', 'LIMITED', 'PLC', 'HOLDINGS', 'HOLDING', 'GROUP', 'THE', 'CLASS', 'A', 'B', 'C', 'SA', 'NV', 'AG', 'SE', 'LLC', 'LP', 'ADR', 'DE', 'TECHNOLOGIES', 'TECHNOLOGY']);
  return t.split(/\s+/).filter((w) => w && !STOP.has(w)).join('');
}
// 중계 함수가 보낸 Discord 명령을 읽습니다.
const b = $('Discord 명령 받기').first().json.body || {};
const sub = (b.options || [])[0] || {};
const opt = (n) => ((sub.options || []).find((o) => o.name === n) || {}).value;
const q = String(opt('symbol') || '').trim();
const top = (n) => ((b.options || []).find((o) => o.name === n) || {}).value;
const question = b.command === 'ask' ? String(top('question') || '').trim() : '';
const days = b.command === 'ask' ? Number(top('days')) || null : null;
const topic = b.command === 'research' ? String(((b.options || []).find((o) => o.name === 'topic') || {}).value || '').trim() : '';
return [{
  json: {
    command: b.command,
    sub: sub.name || '',
    q,
    label: String(opt('label') || '').trim(),
    key: nameKey(q),
    topic,
    question,
    days,
    appId: b.applicationId,
    token: b.token,
    followUrl: `https://discord.com/api/v10/webhooks/${b.applicationId}/${b.token}/messages/@original`,
  },
}];
