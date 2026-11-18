// 회사명 비교용 키: 대문자, (주)·법인 접미사·기호 제거. 종목 사전과 게시 워크플로가 같은 규칙을 씀
function nameKey(s) {
  let t = String(s || '').toUpperCase();
  t = t.replace(/\(주\)|㈜|주식회사|\(유\)/g, ' ').replace(/&/g, ' AND ').replace(/\/[A-Z]{2}\/?\s*$/, ' ');
  t = t.replace(/[.,'’"()\-\/:;!]/g, ' ');
  const STOP = new Set(['INC', 'INCORPORATED', 'CORP', 'CORPORATION', 'CO', 'COMPANY', 'LTD', 'LIMITED', 'PLC', 'HOLDINGS', 'HOLDING', 'GROUP', 'THE', 'CLASS', 'A', 'B', 'C', 'SA', 'NV', 'AG', 'SE', 'LLC', 'LP', 'ADR', 'DE', 'TECHNOLOGIES', 'TECHNOLOGY']);
  return t.split(/\s+/).filter((w) => w && !STOP.has(w)).join('');
}
// DART 고유번호 파일(상장사만)과 SEC 티커 목록으로 종목 사전 행을 만듭니다.
const now = new Date().toISOString();
const rows = new Map();

// 국내: <list><corp_code/><corp_name/><stock_code/>…</list>
const xml = String(($('텍스트로 읽기').first().json || {}).xml || '');
const re = /<list>([\s\S]*?)<\/list>/g;
const pick = (b, t) => { const m = b.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`)); return m ? m[1].trim() : ''; };
let m;
let kr = 0;
while ((m = re.exec(xml))) {
  const b = m[1];
  const code = pick(b, 'stock_code');
  if (!/^[0-9A-Z]{6}$/.test(code)) continue; // 상장사만 종목코드가 있음
  const name = pick(b, 'corp_name');
  rows.set(`KR:${code}`, { market: 'KR', code, name, name_key: nameKey(name), corp_code: pick(b, 'corp_code'), cik: null, updated_at: now });
  kr++;
}
if (kr < 1000) throw new Error(`국내 상장사가 ${kr}개만 읽혔습니다. DART 인증키와 "압축 풀기"·"텍스트로 읽기" 결과를 확인하세요.`);

// 미국: {"0":{"cik_str":320193,"ticker":"AAPL","title":"Apple Inc."}, …}
const sec = $input.first().json || {};
let us = 0;
for (const v of Object.values(sec)) {
  if (!v || !v.ticker) continue;
  const code = String(v.ticker).toUpperCase();
  rows.set(`US:${code}`, { market: 'US', code, name: v.title, name_key: nameKey(v.title), corp_code: null, cik: String(v.cik_str), updated_at: now });
  us++;
}
if (us < 1000) throw new Error(`미국 종목이 ${us}개만 읽혔습니다. "설정" 노드의 secUserAgent(이메일 포함)를 확인하세요.`);

return [{ json: { rows: [...rows.values()], counts: { kr, us } } }];
