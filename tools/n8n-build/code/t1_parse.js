// DART 공시목록, SEC 제출 서류, 연준 보도자료를 공시 후보로 정리합니다.
const c = $('설정').first().json;
const ctx = $('수집 맥락 조회').first().json || {};
const now = Date.parse(c.nowIso);
const cursor = (ctx.cursors || {}).dart_last_rcept_no || '';
const watch = ctx.watchlist || [];
const watchKR = new Map(watch.filter((w) => w.market === 'KR').map((w) => [w.code, w]));
const cands = [];
const report = [];

const kst = (ymd8, hhmm) => `${ymd8.slice(0, 4)}-${ymd8.slice(4, 6)}-${ymd8.slice(6, 8)}T${hhmm}:00+09:00`;
const todayKst = c.endDe;
const norm = (s) => String(s || '').replace(/\[[^\]]*\]/g, '').replace(/[\s()（）ㆍ·∙,]/g, '');
function rule(reportNm) {
  const n = norm(reportNm);
  for (const [kw, ev, imp] of c.dartRules) if (n.includes(kw)) return { ev, imp };
  return null;
}
function paired(item) {
  const p = item.pairedItem;
  if (Array.isArray(p)) return p[0] ? p[0].item : 0;
  return p && typeof p.item === 'number' ? p.item : 0;
}

// ---------- DART ----------
let maxRcept = cursor;
let dartPages = 0;
for (const it of $('DART 공시목록').all()) {
  const b = it.json || {};
  if (b.status && b.status !== '000' && b.status !== '013') {
    throw new Error(`DART 오류 ${b.status}: ${b.message || ''} (020은 하루 요청 한도, 010·011은 인증키 문제)`);
  }
  dartPages++;
  for (const d of b.list || []) {
    if (d.rcept_no > maxRcept) maxRcept = d.rcept_no;
    const w = watchKR.get(d.stock_code);
    const r = rule(d.report_nm);
    const listed = c.dartMarkets.includes(d.corp_cls);
    if (!w && !(r && listed)) continue;
    const correction = /\[기재정정\]|\[정정/.test(d.report_nm);
    const impact = Math.max(20, (r ? r.imp : 40) - (correction ? 10 : 0));
    const name = (w && w.label) || d.corp_name;
    const isToday = d.rcept_dt === todayKst;
    cands.push({
      url_key: `dart:${d.rcept_no}`,
      url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${d.rcept_no}`,
      title: `[${d.corp_name}] ${d.report_nm.trim()}`,
      source: 'DART', source_trust: 5, source_grade: '공시', tier: 'T1', market: 'KR', feed_kind: 'dart',
      published_at: isToday ? c.nowIso : new Date(kst(d.rcept_dt, '18:00')).toISOString(),
      snippet: `${d.corp_name} ${d.corp_cls === 'Y' ? '유가증권' : d.corp_cls === 'K' ? '코스닥' : '기타'} 공시. 제출인 ${d.flr_nm || d.corp_name}.${d.rm ? ` 비고 ${d.rm}.` : ''}`,
      tickers: d.stock_code ? [{ market: 'KR', code: d.stock_code, name }] : [],
      event_type: r ? r.ev : '기타 공시',
      impact,
      _alert: !!(cursor && !correction && ((w && r) || (c.alertAllImportant && r && r.imp >= 70))),
      _watch: !!w,
    });
  }
}
report.push(`DART ${dartPages}페이지`);

// ---------- SEC · 연준 ----------
const ITEMS = { '1.01': '중요 계약 체결', '1.02': '중요 계약 종료', '1.03': '파산·회생', '2.01': '자산 인수·처분', '2.02': '실적 발표', '2.03': '채무 발생', '2.05': '구조조정 비용', '2.06': '자산 손상', '3.01': '상장 유지 기준 미달', '3.02': '비등록 증권 발행', '4.01': '감사인 변경', '4.02': '재무제표 신뢰성 문제', '5.01': '지배권 변경', '5.02': '임원·이사 변동', '5.03': '정관 변경', '5.07': '주주총회 결과', '7.01': '공정공시', '8.01': '기타 중요 사항' };
const FORMS = { '10-Q': '분기보고서', '10-K': '연차보고서', '6-K': '해외기업 수시보고', '20-F': '해외기업 연차보고서', 'DEF 14A': '주총 위임장 설명서', 'S-1': '증권신고서' };
const reqs = $('SEC 요청 만들기').all().map((i) => i.json);
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m);
const strip = (s) => decode(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const tag = (b, n) => { const m = b.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, 'i')); return m ? m[1] : ''; };

for (const it of $('SEC·연준 읽기').all()) {
  const req = reqs[paired(it)] || {};
  const j = it.json || {};
  const body = typeof j.body === 'string' ? j.body : typeof j.data === 'string' ? j.data : '';
  if (j.error || !j.statusCode || j.statusCode >= 400 || !body) {
    report.push(`${req.kind === 'fed' ? '연준' : (req.watch || {}).code}: 실패 ${j.statusCode || ''}`);
    continue;
  }
  if (req.kind === 'fed') {
    const inc = new RegExp(c.fedInclude, 'i');
    for (const b of body.match(/<item[\s>][\s\S]*?<\/item>/gi) || []) {
      const title = strip(tag(b, 'title'));
      if (!inc.test(title)) continue;
      const link = strip(tag(b, 'link'));
      const t = Date.parse(strip(tag(b, 'pubDate')));
      if (!link || !Number.isFinite(t) || now - t > c.secDays * 86400_000) continue;
      const fomc = /FOMC statement/i.test(title);
      cands.push({
        url_key: `fed:${link.replace(/^https?:\/\/(www\.)?/i, '')}`, url: link, title, source: 'Federal Reserve', source_trust: 5, source_grade: '공시',
        tier: 'T1', market: 'US', feed_kind: 'fed', published_at: new Date(t).toISOString(), snippet: strip(tag(b, 'description')).slice(0, 500),
        tickers: [], event_type: fomc ? 'FOMC 성명' : '연준 발표', impact: fomc ? 90 : 60,
        _alert: fomc && now - t < c.alertHours * 3600_000, _watch: false,
      });
    }
    continue;
  }
  // SEC submissions JSON
  let s;
  try { s = JSON.parse(body); } catch (e) { report.push(`${req.watch.code}: JSON 오류`); continue; }
  const r = (s.filings || {}).recent || {};
  const w = req.watch;
  const n = (r.accessionNumber || []).length;
  for (let i = 0; i < n; i++) {
    const form = r.form[i];
    if (!c.secForms.includes(form)) continue;
    const accepted = Date.parse(r.acceptanceDateTime[i]) || Date.parse(r.filingDate[i]);
    if (!Number.isFinite(accepted) || now - accepted > c.secDays * 86400_000) continue;
    const acc = r.accessionNumber[i];
    const items = String(r.items[i] || '').split(',').map((x) => x.trim()).filter((x) => ITEMS[x]);
    const label = form === '8-K' ? (items.length ? items.map((x) => ITEMS[x]).join(', ') : '수시보고') : FORMS[form] || form;
    let impact = form === '10-Q' || form === '10-K' ? 65 : form === '6-K' || form === '20-F' ? 50 : 45;
    if (form === '8-K') impact = items.some((x) => ['1.01', '1.03', '2.01', '3.01', '4.02', '5.01'].includes(x)) ? 75 : items.includes('2.02') ? 70 : items.includes('5.02') ? 60 : 50;
    cands.push({
      url_key: `sec:${acc}`,
      url: `https://www.sec.gov/Archives/edgar/data/${Number(w.cik)}/${acc.replace(/-/g, '')}/${r.primaryDocument[i]}`,
      title: `[${w.code}] ${form}: ${label}`,
      source: 'SEC EDGAR', source_trust: 5, source_grade: '공시', tier: 'T1', market: 'US', feed_kind: 'sec',
      published_at: new Date(accepted).toISOString(),
      snippet: `${s.name || w.name} (${w.code}) ${form} 제출.${r.primaryDocDescription && r.primaryDocDescription[i] ? ` ${r.primaryDocDescription[i]}.` : ''}`,
      tickers: [{ market: 'US', code: w.code, name: w.label || w.name }],
      event_type: form === '8-K' ? `8-K ${items.join(' ') || ''}`.trim() : form,
      impact,
      _alert: c.secAlertForms.includes(form) && impact >= 60 && now - accepted < c.alertHours * 3600_000,
      _watch: true,
    });
  }
}

const seen = new Set();
const uniq = cands.filter((a) => (seen.has(a.url_key) ? false : (seen.add(a.url_key), true)));
return [{ json: { candidates: uniq, keys: uniq.map((a) => a.url_key), cursor: maxRcept, oldCursor: cursor, report } }];
