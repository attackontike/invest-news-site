// 종목별 재무 요약(국내)·지표와 실적(미국)을 정리하고, 미국 실적 발표일을 경제 일정에 넣습니다.
const c = $('설정').first().json;
const watch = ($('관심 종목 조회').first().json || {}).watchlist || [];
const paired = (it) => { const p = it.pairedItem; return Array.isArray(p) ? (p[0] ? p[0].item : 0) : p && typeof p.item === 'number' ? p.item : 0; };
const pairUp = (reqs, outs) => outs.map((it, i) => [reqs[outs.length === reqs.length ? i : paired(it)] || {}, it]);
const report = [];
const pct = (a, b) => (Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? Math.round(((a - b) / Math.abs(b)) * 1000) / 10 : null);

// ---------- 국내: DART 주요 계정 → 분기 실적 ----------
const amt = (s) => { const v = Number(String(s ?? '').replace(/,/g, '')); return String(s ?? '').trim() && Number.isFinite(v) ? v : null; };
const ACC = { revenue: /^(매출액|수익\(매출액\)|영업수익|매출)/, op: /^영업이익/, net: /^(당기순이익|분기순이익|반기순이익)/ };
const dart = {}; // code -> { 'year:reprt': { revenue:{a,add}, ... } }
const dReq = $('DART 재무 요청 만들기').all().map((i) => i.json);
for (const [req, it] of pairUp(dReq, $('DART 재무 조회').all())) {
  if (req.skip || !req.watch) continue;
  const b = (it.json || {}).body || {};
  if (b.status && b.status !== '000') { if (b.status !== '013') report.push(`DART ${req.watch.name} ${req.year} ${req.reprt}: ${b.status} ${b.message || ''}`); continue; }
  const list = b.list || [];
  const rows = list.some((r) => r.fs_div === 'CFS') ? list.filter((r) => r.fs_div === 'CFS') : list.filter((r) => r.fs_div === 'OFS');
  const rec = {};
  for (const [k, re] of Object.entries(ACC)) {
    const r = rows.find((x) => re.test(String(x.account_nm).replace(/\s/g, '')));
    if (r) rec[k] = { a: amt(r.thstrm_amount), add: amt(r.thstrm_add_amount) };
  }
  ((dart[req.watch.code] = dart[req.watch.code] || {})[`${req.year}:${req.reprt}`] = rec);
}
function quarters(byKey) {
  const out = [];
  for (const y of [c.year, c.year - 1, c.year - 2]) {
    const g = (r) => byKey[`${y}:${r}`];
    const q = { 1: g('11013'), 2: g('11012'), 3: g('11014') };
    for (const n of [1, 2, 3]) {
      if (!q[n]) continue;
      const v = {};
      for (const k of Object.keys(ACC)) if (q[n][k] && q[n][k].a !== null) v[k] = q[n][k].a;
      if (Object.keys(v).length) out.push({ label: `${y} ${n}Q`, y, n, ...v });
    }
    const ann = g('11011');
    if (ann) {
      const v = {};
      for (const k of Object.keys(ACC)) {
        if (!ann[k] || ann[k].a === null) continue;
        const cum3 = q[3] && q[3][k] ? (q[3][k].add ?? null) : null;
        const sum = [1, 2, 3].every((n) => q[n] && q[n][k] && q[n][k].a !== null) ? q[1][k].a + q[2][k].a + q[3][k].a : null;
        const base = cum3 ?? sum;
        if (base !== null) v[k] = ann[k].a - base;
      }
      if (Object.keys(v).length) out.push({ label: `${y} 4Q`, y, n: 4, ...v });
    }
  }
  out.sort((a, b) => b.y - a.y || b.n - a.n);
  const find = (y, n) => out.find((x) => x.y === y && x.n === n);
  return out.slice(0, 8).map((x) => {
    const p = find(x.y - 1, x.n);
    const R = (v) => (v === undefined || v === null ? null : Math.round(v));
    return { label: x.label, revenue: R(x.revenue), op: R(x.op), net: R(x.net), revenueYoY: p ? pct(x.revenue, p.revenue) : null, opYoY: p ? pct(x.op, p.op) : null, netYoY: p ? pct(x.net, p.net) : null };
  });
}

// ---------- 미국: Finnhub ----------
function usDst(y, m, d) {
  const dow = (yy, mm, dd) => new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay();
  const v = m * 100 + d;
  return v >= 300 + 8 + ((7 - dow(y, 3, 1)) % 7) && v < 1100 + 1 + ((7 - dow(y, 11, 1)) % 7);
}
function etToKst(date, hhmm) {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const k = new Date(Date.UTC(y, m - 1, d, h + (usDst(y, m, d) ? 4 : 5), mi) + 9 * 3600_000).toISOString();
  return { date: k.slice(0, 10), time: k.slice(11, 16) };
}
const fin = {};
const fReq = $('Finnhub 요청 만들기').all().map((i) => i.json);
for (const [req, it] of pairUp(fReq, $('Finnhub 조회').all())) {
  if (req.skip || !req.watch) continue;
  const j = it.json || {};
  if (j.error || !j.statusCode || j.statusCode >= 400) { report.push(`Finnhub ${req.watch.code} ${req.kind}: 실패 ${j.statusCode || ''} ${JSON.stringify(j.body || '').slice(0, 80)}`); continue; }
  ((fin[req.watch.code] = fin[req.watch.code] || {})[req.kind] = j.body);
}
const pick = (m, keys) => { for (const k of keys) if (m && Number.isFinite(m[k])) return m[k]; return null; };

// ---------- 종목별 정리 ----------
const existing = Object.fromEntries($('기존 종목 데이터 조회').all().map((i) => i.json).filter((r) => r && r.code).map((r) => [`${r.market}:${r.code}`, r]));
const rows = [];
const eventRows = [];
const kbChunks = [];
const site = {};
for (const w of watch) {
  const id = `${w.market}:${w.code}`;
  const name = w.label || w.name;
  let row = { market: w.market, code: w.code, name, financials: {}, metrics: {}, earnings: [], next_earnings: null, latest_label: null, updated_at: c.nowIso };
  if (w.market === 'KR') {
    if (!w.corp_code) { report.push(`${name}: DART 고유번호 없음 (종목 사전 확인)`); continue; }
    const qs = dart[w.code] ? quarters(dart[w.code]) : [];
    if (!qs.length) { report.push(`${name}: 재무 데이터 없음`); if (existing[id]) site[id] = existing[id]; continue; }
    row.financials = { unit: '원', quarters: qs };
    row.latest_label = qs[0].label;
    if (!existing[id] || existing[id].latest_label !== row.latest_label) {
      const l = qs[0];
      const eok = (v) => (v === null ? '-' : Math.abs(v) >= 1e12 ? `${(Math.round(v / 1e11) / 10).toLocaleString('en-US')}조원` : `${Math.round(v / 1e8).toLocaleString('en-US')}억원`);
      const yy = (v) => (v === null ? '' : ` (전년 동기 대비 ${v > 0 ? '+' : ''}${v}%)`);
      kbChunks.push({ chunk_key: `data:stock:${id}:${l.label}`, kind: 'data', is_ai: false, tier: 'T3', source_grade: '공시', market: 'KR', tickers: [{ market: 'KR', code: w.code, name }], source: 'DART 재무', url: `https://dart.fss.or.kr/`, published_at: c.nowIso,
        content: `${name}(${w.code}) ${l.label.replace(' ', '년 ').replace('Q', '분기')} 실적: 매출 ${eok(l.revenue)}${yy(l.revenueYoY)}, 영업이익 ${eok(l.op)}${yy(l.opYoY)}, 순이익 ${eok(l.net)}${yy(l.netYoY)}. 출처 DART 정기보고서.` });
    }
  } else {
    const f = fin[w.code] || {};
    const m = (f.metric || {}).metric || {};
    row.metrics = {
      pe: pick(m, ['peTTM', 'peBasicExclExtraTTM', 'peExclExtraTTM']),
      eps: pick(m, ['epsTTM', 'epsBasicExclExtraItemsTTM', 'epsInclExtraItemsTTM']),
      revenueGrowthQ: pick(m, ['revenueGrowthQuarterlyYoy']),
      netMargin: pick(m, ['netProfitMarginTTM']),
      high52: pick(m, ['52WeekHigh']), low52: pick(m, ['52WeekLow']),
      marketCap: pick(m, ['marketCapitalization']), // 백만 달러
      dividendYield: pick(m, ['dividendYieldIndicatedAnnual', 'currentDividendYieldTTM']),
    };
    row.earnings = (Array.isArray(f.earnings) ? f.earnings : []).slice(0, 4).map((e) => ({ period: e.period, year: e.year, quarter: e.quarter, actual: e.actual, estimate: e.estimate, surprisePercent: Number.isFinite(e.surprisePercent) ? Math.round(e.surprisePercent * 10) / 10 : null }));
    const cal = ((f.calendar || {}).earningsCalendar || []).filter((e) => e.date >= c.today).sort((a, b) => a.date.localeCompare(b.date))[0];
    if (cal) {
      const hour = cal.hour === 'bmo' ? '08:00' : cal.hour === 'amc' ? '16:05' : null;
      const k = hour ? etToKst(cal.date, hour) : { date: cal.date, time: null };
      row.next_earnings = { date: k.date, time: k.time, usDate: cal.date, hour: cal.hour || '', label: cal.hour === 'bmo' ? '장 시작 전' : cal.hour === 'amc' ? '장 마감 후' : '', epsEstimate: cal.epsEstimate ?? null };
      eventRows.push({ event_key: `earnings:${w.code}:${cal.date}`, event_date: k.date, event_time: k.time, market: 'US', name: `${name}(${w.code}) 실적 발표`, importance: 2, source: 'Finnhub', updated_at: c.nowIso });
    }
    const last = row.earnings[0];
    row.latest_label = last ? last.period : null;
    if (last && Number.isFinite(last.actual) && (!existing[id] || existing[id].latest_label !== row.latest_label)) {
      kbChunks.push({ chunk_key: `data:stock:${id}:${last.period}`, kind: 'data', is_ai: false, tier: 'T3', source_grade: '공시', market: 'US', tickers: [{ market: 'US', code: w.code, name }], source: 'Finnhub', url: `https://finnhub.io/`, published_at: c.nowIso,
        content: `${name}(${w.code}) 회계 ${last.year}년 ${last.quarter}분기(기준일 ${last.period}) EPS 실제 ${last.actual} vs 예상 ${last.estimate ?? '-'}${last.surprisePercent !== null ? ` (서프라이즈 ${last.surprisePercent > 0 ? '+' : ''}${last.surprisePercent}%)` : ''}.` });
    }
    if (!f.metric && !f.earnings && existing[id]) { site[id] = existing[id]; report.push(`${name}: Finnhub 응답 없음, 이전 값 유지`); continue; }
  }
  rows.push(row);
  site[id] = row;
}

const siteJson = {
  updatedAt: c.nowIso,
  stocks: Object.fromEntries(Object.entries(site).map(([k, r]) => [k, { market: r.market, code: r.code, name: r.name, financials: r.financials || {}, metrics: r.metrics || {}, earnings: r.earnings || [], nextEarnings: r.next_earnings || null }])),
};
function b64(str) {
  const by = [];
  for (let i = 0; i < str.length; i++) {
    let cp = str.charCodeAt(i);
    if (cp >= 0xd800 && cp < 0xdc00 && i + 1 < str.length) { const lo = str.charCodeAt(i + 1); if (lo >= 0xdc00 && lo < 0xe000) { cp = 0x10000 + ((cp - 0xd800) << 10) + (lo - 0xdc00); i++; } }
    if (cp < 0x80) by.push(cp); else if (cp < 0x800) by.push(0xc0 | (cp >> 6), 0x80 | (cp & 63)); else if (cp < 0x10000) by.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63)); else by.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
  }
  const T = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < by.length; i += 3) { const n = (by[i] << 16) | ((by[i + 1] || 0) << 8) | (by[i + 2] || 0); out += T[(n >> 18) & 63] + T[(n >> 12) & 63] + (i + 1 < by.length ? T[(n >> 6) & 63] : '=') + (i + 2 < by.length ? T[n & 63] : '='); }
  return out;
}
report.unshift(`관심 종목 ${watch.length}개 (국내 ${watch.filter((w) => w.market === 'KR').length}, 미국 ${watch.filter((w) => w.market === 'US').length}) → 정리 ${rows.length}개, 실적 일정 ${eventRows.length}건, 새 실적 ${kbChunks.length}건`);

return [{
  json: {
    stockRows: rows,
    eventRows,
    siteContent: b64(JSON.stringify(siteJson, null, 2) + '\n'),
    kbChunks,
    report,
  },
}];
