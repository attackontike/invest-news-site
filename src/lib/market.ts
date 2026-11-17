import market from '../data/market.json';

export type Indicator = {
  key: string; market: 'KR' | 'US'; name: string; unit: string; date: string; value: number | null;
  prev: number | null; change: number | null; source: string; history: [string, number][];
};
export type EconEvent = { date: string; time: string | null; market: 'KR' | 'US'; name: string; importance: number; source: string };

export const updatedAt: string | null = (market as any).updatedAt ?? null;
export const indicators = ((market as any).indicators ?? []) as Indicator[];
export const events = ((market as any).events ?? []) as EconEvent[];

export const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
export function upcoming(days: number) {
  const today = kstToday();
  const until = new Date(Date.parse(today) + days * 86400_000).toISOString().slice(0, 10);
  return events.filter((e) => e.date >= today && e.date <= until);
}

// 1 미만·10 미만 값(유로/달러 1.0842 등)은 소수점을 더 보여 줌
const digits = (v: number) => (Math.abs(v) >= 1000 ? 1 : Math.abs(v) < 10 ? 4 : 2);
export function fmtValue(v: number | null, unit: string) {
  if (v === null || v === undefined) return '-';
  const s = v.toLocaleString('ko-KR', { maximumFractionDigits: digits(v) });
  return unit === '%' ? `${s}%` : `${s}${unit === '원' ? '원' : ` ${unit}`}`;
}
export function fmtChange(c: number | null, unit: string) {
  if (c === null || c === undefined || Math.abs(c) < 1e-9) return '변화 없음';
  const n = Math.abs(c).toLocaleString('ko-KR', { maximumFractionDigits: Math.abs(c) < 1 ? 4 : 2 });
  const u = unit === '%' ? '%p' : unit === '원' ? '원' : ` ${unit}`;
  return `${c > 0 ? '▲' : '▼'} ${n}${u}`;
}
