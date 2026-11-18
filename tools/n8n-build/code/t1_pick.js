// 이미 저장된 공시를 빼고 저장할 행, 즉시 알림, 새 커서를 만듭니다.
const p = $('공시 정리').first().json;
const res = $input.first().json || {};
const existing = new Set(Array.isArray(res.keys) ? res.keys : []);
const fresh = p.candidates.filter((a) => !existing.has(a.url_key));

const COLS = ['url_key', 'url', 'title', 'source', 'source_trust', 'source_grade', 'tier', 'market', 'feed_kind', 'published_at', 'snippet', 'tickers', 'event_type', 'impact'];
const rows = fresh.map((a) => Object.fromEntries(COLS.map((k) => [k, a[k] === undefined ? null : a[k]]))).map((r) => ({ ...r, status: 'new' }));

const kstTime = (iso) => new Date(Date.parse(iso) + 9 * 3600_000).toISOString().slice(5, 16).replace('T', ' ').replace('-', '.');
const alerts = fresh
  .filter((a) => a._alert)
  .sort((a, b) => b.impact - a.impact)
  .map((a) => ({
    title: `${a._watch ? '⭐ ' : ''}${a.title}`.slice(0, 250),
    url: a.url,
    color: a.market === 'KR' ? 0xd7263d : 0x1b5fd1,
    description: `**${a.event_type}** · ${a.source} · ${kstTime(a.published_at)}\n${a.snippet}`.slice(0, 1000),
  }));

return [{ json: { rows, alerts, cursor: p.cursor, cursorChanged: p.cursor && p.cursor !== p.oldCursor, report: p.report } }];
