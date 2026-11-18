// RSS·Atom·네이버 응답을 읽어 기사 후보로 정리합니다.
// n8n Code 노드 실행 환경에는 URL, Buffer가 없을 수 있어 모두 문자열로 처리합니다.
const c = $('설정').first().json;
const now = Date.now();
const since = now - c.collectHours * 3600_000;

// ---------- 도우미 ----------
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—' };
function decode(s) {
  if (!s) return '';
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => (NAMED[n.toLowerCase()] !== undefined ? NAMED[n.toLowerCase()] : m));
}
const strip = (s) => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const text = (s) => strip(decode(strip(decode(s))));
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : '';
}
function linkOf(block) {
  let m = block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) || block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  if (m) return decode(m[1]).trim();
  const l = decode(tag(block, 'link')).trim();
  if (/^https?:\/\//i.test(l)) return l;
  const g = decode(tag(block, 'guid')).trim();
  return /^https?:\/\//i.test(g) ? g : '';
}
function hostOf(u) {
  const m = String(u).match(/^https?:\/\/([^/?#:]+)/i);
  return m ? m[1].toLowerCase().replace(/^www\./, '').replace(/^m\./, '') : '';
}
// 중복 비교용 키 (링크 자체는 원문 그대로 저장)
function urlKey(u) {
  let s = String(u).trim().replace(/^https?:\/\//i, '').replace(/#.*$/, '');
  let q = '';
  const qi = s.indexOf('?');
  if (qi >= 0) { q = s.slice(qi + 1); s = s.slice(0, qi); }
  const parts = s.split('/');
  const host = parts.shift().toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
  const path = parts.join('/').replace(/\/+$/, '');
  const params = q.split('&').filter((p) => p && !/^(utm_|fbclid|gclid|ref=|from=|cmpid|ocid|rss=|feed=)/i.test(p)).sort();
  return host + '/' + path + (params.length ? '?' + params.join('&') : '');
}
function sourceInfo(name) {
  const v = c.sources[name] || c.unknownSource;
  return { trust: v[0], grade: v[1] };
}
function toIso(s) {
  const t = Date.parse(String(s).trim());
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}
function paired(item) {
  const p = item.pairedItem;
  if (Array.isArray(p)) return p[0] ? p[0].item : 0;
  return p && typeof p.item === 'number' ? p.item : 0;
}

const report = [];
const cands = [];
const push = (req, a) => {
  if (!a.url || !/^https?:\/\//i.test(a.url)) { req._r.bad++; return; }
  if (!a.published_at) { req._r.noDate++; return; }
  const t = Date.parse(a.published_at);
  if (t < since || t > now + 3600_000) { req._r.old++; return; }
  a.url_key = urlKey(a.url);
  a.tickers = req.ticker ? [req.ticker] : [];
  a.title = a.title.slice(0, 300);
  a.snippet = (a.snippet || '').slice(0, 500);
  cands.push(a);
  req._r.ok++;
};

// ---------- 1) RSS·Google News ----------
const rssReqs = $('요청 목록').all().map((i) => i.json);
for (const it of $('RSS 읽기').all()) {
  const req = rssReqs[paired(it)] || {};
  const r = { label: req.label || '?', status: '', ok: 0, old: 0, bad: 0, noDate: 0 };
  req._r = r;
  report.push(r);
  const j = it.json || {};
  const code = j.statusCode;
  const body = typeof j.body === 'string' ? j.body : typeof j.data === 'string' ? j.data : '';
  if (j.error || !code || code >= 400 || !body) {
    r.status = `실패 ${code || (j.error && (j.error.code || j.error.message)) || ''}`.trim();
    continue;
  }
  r.status = '성공';
  const blocks = body.match(/<item[\s>][\s\S]*?<\/item>/gi) || body.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  const perSource = [];
  for (const b of blocks) {
    let title = text(tag(b, 'title'));
    if (!title) continue;
    const url = linkOf(b);
    const date = toIso(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date'));
    const snippet = text(tag(b, 'description') || tag(b, 'summary') || tag(b, 'content'));
    let source = req.source, trust = req.trust, grade = req.grade;
    if (req.kind === 'gnews') {
      source = text(tag(b, 'source')) || 'Google News';
      if (title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
      ({ trust, grade } = sourceInfo(source));
    }
    perSource.push({ url, title, source, source_trust: trust, source_grade: grade, tier: 'T2', market: req.market, feed_kind: req.kind, published_at: date, snippet: req.kind === 'gnews' ? '' : snippet });
  }
  perSource.slice(0, 200).forEach((a) => push(req, a));
}

// ---------- 2) 네이버 ----------
const nvReqs = $('네이버 요청').all().map((i) => i.json);
for (const it of $('네이버 뉴스').all()) {
  const req = nvReqs[paired(it)] || {};
  if (req.skip) continue;
  const r = { label: req.label || '네이버', status: '', ok: 0, old: 0, bad: 0, noDate: 0 };
  req._r = r;
  report.push(r);
  const j = it.json || {};
  let body = j.body !== undefined ? j.body : j;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  if (j.error || (j.statusCode && j.statusCode >= 400) || !body || !Array.isArray(body.items)) {
    r.status = `실패 ${j.statusCode || (j.error && j.error.message) || ''}`.trim();
    continue;
  }
  r.status = '성공';
  for (const n of body.items) {
    const url = (n.originallink || n.link || '').trim();
    const host = hostOf(url);
    const source = c.naverDomains[host] || c.naverDomains[host.split('.').slice(-3).join('.')] || c.naverDomains[host.split('.').slice(-2).join('.')] || host;
    const { trust, grade } = sourceInfo(source);
    push(req, { url, title: text(n.title), source, source_trust: trust, source_grade: grade, tier: 'T2', market: 'KR', feed_kind: 'naver', published_at: toIso(n.pubDate), snippet: text(n.description) });
  }
}

const okFeeds = report.filter((r) => r.status === '성공').length;
if (report.length && okFeeds === 0) {
  throw new Error('모든 피드 요청이 실패했습니다.\n' + report.map((r) => `${r.label}: ${r.status}`).join('\n'));
}

// 같은 실행 안의 중복 제거 (신뢰도 높은 매체 우선)
const KIND = { rss: 0, naver: 1, gnews: 2 }; // 같은 기사면 매체 RSS의 제목·요약을 우선
cands.sort((a, b) => b.source_trust - a.source_trust || KIND[a.feed_kind] - KIND[b.feed_kind] || b.published_at.localeCompare(a.published_at));
const seen = new Set();
const uniq = [];
const byKey = {};
for (const a of cands) {
  const kept = byKey[a.url_key];
  if (kept) { // 같은 기사: 관심 종목 표시만 합침
    for (const t of a.tickers) if (!kept.tickers.some((x) => x.code === t.code)) kept.tickers.push(t);
    continue;
  }
  byKey[a.url_key] = a;
  uniq.push(a);
}

if (!uniq.length) return []; // 새 기사 없음: 정상, 여기서 조용히 끝남
return [{ json: { candidates: uniq, keys: uniq.map((a) => a.url_key), report } }];
