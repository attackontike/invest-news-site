import data from '../data/stocks.json';

export type Quarter = { label: string; revenue: number | null; op: number | null; net: number | null; revenueYoY: number | null; opYoY: number | null; netYoY: number | null };
export type Price = { value: number; change: number | null; pct: number | null; date: string | null; currency: 'KRW' | 'USD'; marketCap?: number | null };
export type StockData = {
  market: 'KR' | 'US'; code: string; name: string; companyName?: string | null;
  price?: Price | null;
  financials: { unit?: string; quarters?: Quarter[] };
  metrics: { pe?: number | null; eps?: number | null; revenueGrowthQ?: number | null; netMargin?: number | null; high52?: number | null; low52?: number | null; marketCap?: number | null; dividendYield?: number | null };
  earnings: { period: string; year: number; quarter: number; actual: number | null; estimate: number | null; surprisePercent: number | null }[];
  nextEarnings: { date: string; time: string | null; usDate?: string; label?: string; epsEstimate?: number | null } | null;
};

export const stocksUpdatedAt: string | null = (data as any).updatedAt ?? null;
export const stocks = ((data as any).stocks ?? {}) as Record<string, StockData>;
export const stockOf = (market: string, code: string): StockData | undefined => stocks[`${market}:${code}`];

// 화면에 쓸 종목 이름. 미국 관심 종목은 이름이 티커 그대로 저장되므로, 종목 데이터의 회사 이름(Finnhub)이 있으면 그것을 씀
export function displayName(t: { market?: string; code?: string; name: string }) {
  if (t.code && t.name === t.code) return stockOf(t.market ?? '', t.code)?.companyName || t.name;
  return t.name;
}
// 이름 뒤에 작게 붙일 코드 (이름과 같으면 생략)
export const codeLabel = (t: { market?: string; code?: string; name: string }) => (t.code && displayName(t) !== t.code ? t.code : '');

// 원 단위 → 조·억
export function won(v: number | null | undefined) {
  if (v === null || v === undefined) return '-';
  const a = Math.abs(v);
  if (a >= 1e12) return `${(Math.round(v / 1e11) / 10).toLocaleString('ko-KR')}조`;
  if (a >= 1e8) return `${Math.round(v / 1e8).toLocaleString('ko-KR')}억`;
  return v.toLocaleString('ko-KR');
}
export const pct = (v: number | null | undefined) => (v === null || v === undefined ? '' : `${v > 0 ? '+' : ''}${v}%`);
export const num = (v: number | null | undefined, d = 2) => (v === null || v === undefined ? '-' : v.toLocaleString('en-US', { maximumFractionDigits: d }));
export function usdCap(m: number | null | undefined) {
  if (!m) return '-';
  return m >= 1e6 ? `${(Math.round(m / 1e5) / 10).toLocaleString('en-US')}조 달러` : `${Math.round(m / 1e3).toLocaleString('en-US')}억 달러`;
}

// 주가 (전 거래일 종가)
export function priceText(p: Price | null | undefined) {
  if (!p || !Number.isFinite(p.value)) return '';
  const v = p.currency === 'KRW' ? `${p.value.toLocaleString('ko-KR')}원` : `$${p.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const c = p.pct === null || p.pct === undefined ? '' : ` ${p.pct > 0 ? '▲' : p.pct < 0 ? '▼' : ''}${Math.abs(p.pct)}%`;
  return v + c;
}
export const priceDir = (p: Price | null | undefined) => (!p || !p.pct ? 'flat' : p.pct > 0 ? 'up' : 'down');

// 한 줄 요약 (관심 종목 목록용)
export function oneLine(s: StockData | undefined) {
  if (!s) return '';
  const pr = priceText(s.price);
  const rest = oneLineBody(s);
  return [pr && `${pr} (${(s.price?.date ?? '').slice(5).replace('-', '.')} 종가)`, rest].filter(Boolean).join(' · ');
}
function oneLineBody(s: StockData) {
  if (s.market === 'KR') {
    const q = s.financials.quarters?.[0];
    return q ? `${q.label} 매출 ${won(q.revenue)}${q.revenueYoY !== null ? `(${pct(q.revenueYoY)})` : ''} · 영업이익 ${won(q.op)}${q.opYoY !== null ? `(${pct(q.opYoY)})` : ''}` : '';
  }
  const parts = [];
  if (s.metrics.pe) parts.push(`PER ${num(s.metrics.pe, 1)}`);
  const e = s.earnings[0];
  if (e && e.actual !== null) parts.push(`최근 EPS ${num(e.actual)}${e.surprisePercent !== null ? `(예상 대비 ${pct(e.surprisePercent)})` : ''}`);
  if (s.nextEarnings) parts.push(`다음 실적 ${s.nextEarnings.date.slice(5).replace('-', '.')}`);
  return parts.join(' · ');
}
