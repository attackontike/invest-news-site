import market from '../data/market.json';
import { stocks, displayName } from './stocks';

export type Indicator = {
  key: string; market: 'KR' | 'US'; group?: string | null; name: string; unit: string; date: string; value: number | null;
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
  .map((s) => ({ date: s.nextEarnings!.date, time: s.nextEarnings!.time, market: s.market, name: `${displayName(s)}(${s.code}) 실적 발표`, importance: 2, source: 'Finnhub' }));
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

// ---------- 시장 심리 ----------
// 참고용 기준: VIX 15·20·30, 하이일드 스프레드 3.5·4.5·6%
export const MOOD = ['', '안정', '보통', '불안', '공포'] as const;
const level = (v: number | null | undefined, cuts: [number, number, number]) =>
  v === null || v === undefined ? null : v < cuts[0] ? 1 : v < cuts[1] ? 2 : v < cuts[2] ? 3 : 4;
export function sentimentNote(i: Indicator): string {
  const v = i.value;
  if (v === null) return '';
  if (i.key === 'US:VIXCLS') return MOOD[level(v, [15, 20, 30])!];
  if (i.key === 'US:BAMLH0A0HYM2') return MOOD[level(v, [3.5, 4.5, 6])!];
  if (i.key === 'US:T10Y2Y') return v < 0 ? '역전' : '정상';
  if (i.key === 'US:STLFSI4') return v > 0 ? '평소보다 긴장' : '평소보다 안정';
  return '';
}
export function thermometer() {
  const vix = indicators.find((i) => i.key === 'US:VIXCLS');
  const hy = indicators.find((i) => i.key === 'US:BAMLH0A0HYM2');
  const lv = [level(vix?.value, [15, 20, 30]), level(hy?.value, [3.5, 4.5, 6])].filter((x): x is number => x !== null);
  if (!lv.length) return null;
  const n = Math.round(lv.reduce((a, b) => a + b, 0) / lv.length) as 1 | 2 | 3 | 4;
  return { level: n, label: MOOD[n], vix: vix?.value ?? null, hy: hy?.value ?? null };
}

// ---------- 첫 화면 시장 요약 ----------
// T3 설정의 키 순서대로: 코스피, 코스닥, S&P 500, 나스닥, 원/달러. 없는 지표는 건너뜀
const STRIP_KEYS = ['KR:802Y001:0001000', 'KR:802Y001:0089000', 'US:SP500', 'US:NASDAQCOM', 'KR:731Y001:0000001'];
const SHORT: Record<string, string> = { 'KR:802Y001:0001000': '코스피', 'KR:802Y001:0089000': '코스닥', 'US:SP500': 'S&P 500', 'US:NASDAQCOM': '나스닥', 'KR:731Y001:0000001': '원/달러' };
export const marketStrip = STRIP_KEYS.map((k) => indicators.find((i) => i.key === k)).filter((i): i is Indicator => !!i && i.value !== null)
  .map((i) => ({ ...i, short: SHORT[i.key] ?? i.name, pct: i.prev ? Math.round((i.value! - i.prev) / Math.abs(i.prev) * 10000) / 100 : null }));
