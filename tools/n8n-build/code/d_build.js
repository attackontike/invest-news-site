// 지표 계산, 경제 일정 정리, 사이트용 market.json, 새 관측값의 지식베이스 조각을 만듭니다.
const c = $('설정').first().json;
const paired = (it) => { const p = it.pairedItem; return Array.isArray(p) ? (p[0] ? p[0].item : 0) : p && typeof p.item === 'number' ? p.item : 0; };
// 요청과 응답 짝짓기: 개수가 같으면 순서대로, 다르면 n8n의 짝 정보로
const pairUp = (reqs, outs) => outs.map((it, i) => [reqs[outs.length === reqs.length ? i : paired(it)] || {}, it]);
const r2 = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const report = [];

// ---------- 시계열 변환 ----------
function transform(points, how, monthly) {
  // points: [[date, value]] 오름차순. 월간 날짜는 YYYY-MM
  if (how === 'yoy') {
    const map = Object.fromEntries(points);
    return points.map(([d, v]) => {
      const [y, m] = d.split('-').map(Number);
      const prev = map[`${y - 1}-${String(m).padStart(2, '0')}`];
      return prev ? [d, r2((v / prev - 1) * 100, 1)] : null;
    }).filter(Boolean);
  }
  if (how === 'diff') return points.slice(1).map(([d, v], i) => [d, r2(v - points[i][1], 0)]);
  return points;
}
function summarize(key, s, points, market, source, url) {
  if (!points.length) return null;
  const last = points[points.length - 1];
  let prev = points.length > 1 ? points[points.length - 2] : null;
  if (s.change === 'lastDifferent') prev = [...points].reverse().find((p) => p[1] !== last[1]) || prev;
  return {
    series_key: key, market, name: s.name, unit: s.unit, latest_date: last[0], latest_value: r2(last[1], 4),
    prev_value: prev ? r2(prev[1], 4) : null, change: prev ? r2(last[1] - prev[1], 4) : null,
    history: points.slice(-30), source, updated_at: c.nowIso, _url: url,
  };
}

const rows = [];
let releases = [];

// ---------- FRED ----------
const fReq = $('FRED 요청 만들기').all().map((i) => i.json);
const fOut = $('FRED 조회').all();
let fredOk = 0;
for (const [req, it] of pairUp(fReq, fOut)) {
  const j = it.json || {};
  const b = j.body || {};
  if (j.error || !j.statusCode || j.statusCode >= 400) { report.push(`FRED ${req.kind === 'series' ? req.series.id : '일정'}: 실패 ${j.statusCode || ''} ${(b && (b.error_message || '')) || ''}`.trim()); continue; }
  if (req.kind === 'releases' || Array.isArray(b.release_dates)) { releases = b.release_dates || []; continue; }
  const s = req.series;
  if (!s || !Array.isArray(b.observations)) { report.push(`FRED 응답 해석 실패: ${JSON.stringify(b).slice(0, 120)}`); continue; }
  const monthly = s.transform !== 'level' || ['UNRATE'].includes(s.id);
  const pts = (b.observations || [])
    .filter((o) => o.value !== '.' && o.value !== '')
    .map((o) => [monthly ? o.date.slice(0, 7) : o.date, Number(o.value)])
    .filter((p) => Number.isFinite(p[1]))
    .sort((a, b2) => a[0].localeCompare(b2[0]));
  const row = summarize(`US:${s.id}`, s, transform(pts, s.transform, monthly), s.market || 'US', 'FRED', `https://fred.stlouisfed.org/series/${s.id}`);
  if (row) { rows.push(row); fredOk++; } else report.push(`FRED ${s.id}: 값 없음`);
}
report.unshift(`FRED: 요청 ${fReq.length}개, 응답 ${fOut.length}개, 지표 ${fredOk}개, 발표 일정 원본 ${releases.length}건`);

// ---------- ECOS ----------
const eReq = $('ECOS 요청 만들기').all().map((i) => i.json);
const eOut = $('ECOS 조회').all();
for (const [req, it] of pairUp(eReq, eOut)) {
  if (req.skip) { report.push('ECOS: 인증키 없음 (설정 노드 ecosKey)'); continue; }
  const j = it.json || {};
  const b = j.body || {};
  const s = req.series;
  const list = (b.StatisticSearch || {}).row;
  if (!Array.isArray(list)) { report.push(`ECOS ${s.name}: ${(b.RESULT && `${b.RESULT.CODE} ${b.RESULT.MESSAGE}`) || `실패 ${j.statusCode || ''}`}`); continue; }
  const fmt = (t) => (t.length === 6 ? `${t.slice(0, 4)}-${t.slice(4, 6)}` : `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`);
  const pts = list.map((r) => [fmt(String(r.TIME)), Number(String(r.DATA_VALUE).replace(/,/g, ''))]).filter((p) => Number.isFinite(p[1])).sort((a, b2) => a[0].localeCompare(b2[0]));
  const row = summarize(`KR:${s.stat}:${s.item}`, s, transform(pts, s.transform, s.cycle === 'M'), 'KR', '한국은행 ECOS', 'https://ecos.bok.or.kr/');
  if (row) rows.push(row); else report.push(`ECOS ${s.name}: 값 없음`);
}

// ---------- 경제 일정 (한국 시간) ----------
function usDst(y, m, d) {
  const dow = (yy, mm, dd) => new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay();
  const start = 8 + ((7 - dow(y, 3, 1)) % 7); // 3월 둘째 일요일
  const end = 1 + ((7 - dow(y, 11, 1)) % 7); // 11월 첫째 일요일
  const v = m * 100 + d;
  return v >= 300 + start && v < 1100 + end;
}
function etToKst(date, hhmm) {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const utc = Date.UTC(y, m - 1, d, h + (usDst(y, m, d) ? 4 : 5), mi);
  const k = new Date(utc + 9 * 3600_000).toISOString();
  return { date: k.slice(0, 10), time: k.slice(11, 16) };
}
const events = new Map();
const add = (e) => { if (e.event_date >= c.today && e.event_date <= c.until) events.set(e.event_key, { ...e, updated_at: c.nowIso }); };
for (const r of releases) {
  const rule = c.fredReleases.find(([kw]) => String(r.release_name).includes(kw));
  if (!rule || !/^\d{4}-\d{2}-\d{2}$/.test(String(r.date))) continue;
  const k = etToKst(r.date, rule[3]);
  add({ event_key: `fred:${r.release_id}:${r.date}`, event_date: k.date, event_time: k.time, market: 'US', name: rule[1], importance: rule[2], source: 'FRED' });
}
const okDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && Number.isFinite(Date.parse(v));
const okTime = (v) => /^\d{1,2}:\d{2}$/.test(String(v || ''));
for (const e of c.manualEvents || []) {
  if (!e || !e.name) continue;
  // 날짜·시각 형식이 틀린 줄은 건너뛰고 report에 남김 (예: 가이드 예시 문구를 그대로 넣은 경우)
  if (!okDate(e.date) || (e.timeEt && !okTime(e.timeEt)) || (e.time && !okTime(e.time))) { report.push(`직접 입력 일정 건너뜀: "${e.name}" 날짜 ${JSON.stringify(e.date)} (YYYY-MM-DD 형식이어야 함)`); continue; }
  const k = e.market === 'US' && e.timeEt ? etToKst(e.date, e.timeEt) : { date: e.date, time: e.time || null };
  add({ event_key: `manual:${e.date}:${e.name}`, event_date: k.date, event_time: k.time, market: e.market || 'KR', name: e.name, importance: e.importance || 2, source: '직접 입력' });
}
for (const e of c.monthlyEvents || []) {
  const [y, m] = c.today.split('-').map(Number);
  for (let i = 0; i < 3; i++) {
    const dt = new Date(Date.UTC(y, m - 1 + i, e.day));
    const ds = dt.toISOString().slice(0, 10);
    add({ event_key: `monthly:${ds}:${e.name}`, event_date: ds, event_time: e.time || null, market: e.market, name: e.name, importance: e.importance || 1, source: '매월 일정' });
  }
}
const eventRows = [...events.values()].sort((a, b2) => (a.event_date + (a.event_time || '99')).localeCompare(b2.event_date + (b2.event_time || '99')));

if (!rows.length && !eventRows.length) throw new Error('지표와 일정을 하나도 가져오지 못했습니다.\n' + report.join('\n'));

// ---------- 사이트 파일: 이번에 못 가져온 지표는 DB의 이전 값 유지 ----------
const existing = Object.fromEntries($('기존 지표 조회').all().map((i) => i.json).filter((r) => r && r.series_key).map((r) => [r.series_key, r]));
const order = [...c.ecos.map((s) => `KR:${s.stat}:${s.item}`), ...c.fred.map((s) => `US:${s.id}`)];
const fresh = Object.fromEntries(rows.map((r) => [r.series_key, r]));
// 사이트 구역: 설정의 group (sentiment 등). DB에는 저장하지 않고 설정에서 매번 정함
const groupOf = Object.fromEntries([...c.ecos.map((s) => [`KR:${s.stat}:${s.item}`, s.group || null]), ...c.fred.map((s) => [`US:${s.id}`, s.group || null])]);
const site = {
  updatedAt: c.nowIso,
  indicators: order.map((k) => fresh[k] || existing[k]).filter(Boolean).map((r) => ({
    key: r.series_key, market: r.market, group: groupOf[r.series_key] || null, name: r.name, unit: r.unit, date: r.latest_date, value: r.latest_value === null ? null : Number(r.latest_value),
    prev: r.prev_value === null ? null : Number(r.prev_value), change: r.change === null ? null : Number(r.change), source: r.source, history: r.history || [],
  })),
  events: eventRows.map((e) => ({ date: e.event_date, time: e.event_time, market: e.market, name: e.name, importance: e.importance, source: e.source })),
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

// ---------- 지식베이스: 새 관측값만 ----------
const num = (v, u) => (v === null || v === undefined ? '-' : `${Number(v).toLocaleString('en-US')}${u === '%' ? '%' : ` ${u}`}`);
const kbChunks = rows
  .filter((r) => !existing[r.series_key] || existing[r.series_key].latest_date !== r.latest_date)
  .map((r) => ({
    chunk_key: `data:${r.series_key}:${r.latest_date}`, kind: 'data', is_ai: false, tier: 'T3', source_grade: '공시', market: r.market, tickers: [],
    source: r.source, url: r._url, published_at: c.nowIso,
    content: `${r.name} ${r.latest_date}: ${num(r.latest_value, r.unit)}${r.prev_value !== null ? ` (이전 ${num(r.prev_value, r.unit)}, 변화 ${r.change > 0 ? '+' : ''}${r.change})` : ''}. 출처 ${r.source}.`,
  }));

return [{
  json: {
    indicatorRows: rows.map(({ _url, ...r }) => r),
    eventRows,
    sitePath: 'src/data/market.json',
    siteContent: b64(JSON.stringify(site, null, 2) + '\n'),
    kbChunks,
    report,
    counts: { indicators: rows.length, events: eventRows.length, kb: kbChunks.length },
  },
}];
