import market from '../data/market.json';
import { stocks } from './stocks';

export type Indicator = {
  key: string; market: 'KR' | 'US'; name: string; unit: string; date: string; value: number | null;
  prev: number | null; change: number | null; source: string; history: [string, number][];
};
export type EconEvent = { date: string; time: string | null; market: 'KR' | 'US'; name: string; importance: number; source: string };

export const updatedAt: string | null = (market as any).updatedAt ?? null;
export const indicators = ((market as any).indicators ?? []) as Indicator[];
export const events = ((market as any).events ?? []) as EconEvent[];

export const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
// 경제 일정 + 관심 종목(미국) 실적 발표일
const earningsEvents: EconEvent[] = Object.values(stocks)
  .filter((s) => s.nextEarnings)
  .map((s) => ({ date: s.nextEarnings!.date, time: s.nextEarnings!.time, market: s.market, name: `${s.name}(${s.code}) 실적 발표`, importance: 2, source: 'Finnhub' }));
export function upcoming(days: number) {
  const today = kstToday();
  const until = new Date(Date.parse(today) + days * 86400_000).toISOString().slice(0, 10);
  const seen = new Set<string>();
  return [...events, ...earningsEvents]
    .filter((e) => e.date >= today && e.date <= until)
    .filter((e) => { const k = `${e.date}:${e.name}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => (a.date + (a.time ?? '99')).localeCompare(b.date + (b.time ?? '99')));
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
