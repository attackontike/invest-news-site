import { getCollection } from 'astro:content';
import { stocks, stocksUpdatedAt } from './stocks';

// 화면 기준은 여기서 바꿉니다.
export const RULES = {
  newsDays: 7, // 시장 뉴스·공시 메뉴에 보여 줄 기간
  topHours: 24, // 시장 브리핑의 "주요 뉴스·공시" 기간
  topCount: 6, // 시장 브리핑에서 시장별로 보여 줄 뉴스 개수
  topFilings: 5, // 시장 브리핑에서 보여 줄 공시 개수
  watchItems: 10, // 관심 종목 메뉴에서 종목마다 보여 줄 개수
  minCredibility: 2, // 이 값보다 낮은 신뢰도는 숨김 (공시는 항상 표시)
};

export type Ticker = { market?: string; code?: string; name: string };
export type Item = {
  id: number;
  tier: string;
  market: 'KR' | 'US' | 'GLOBAL';
  title: string;
  titleKo?: string;
  source: string;
  sourceGrade: string;
  url: string;
  publishedAt: string;
  summary: string;
  keyPoints: string[];
  tags: string[];
  tickers: Ticker[];
  sentiment: '호재' | '악재' | '중립';
  credibility: number;
  importance: number;
  coverage: number;
  storyKey?: string;
  edition?: string;
  eventType?: string;
};
export type Watch = { market: string; code: string; name: string };
export type Edition = { date: string; edition: string; generatedAt: string; briefing: string[] };

// 종목별 목록에서 앞에 보여 줄 만한 기록: 공시이거나, 한국어 요약이 붙은 커뮤니티 외 기사
export const isSolid = (it: Item) => it.tier === 'T1' || (!!it.summary && it.sourceGrade !== '커뮤니티');

const isWebUrl = (u: string) => /^https?:\/\/[^\s]+$/i.test(u);
const tkey = (t: { market?: string; code?: string }) => `${t.market}:${t.code}`;

let cache: Awaited<ReturnType<typeof build>> | null = null;

async function build() {
  const days = (await getCollection('digest')).sort((a, b) => b.data.date.localeCompare(a.data.date));
  const ref = days.length ? new Date(days[0].data.generatedAt) : new Date();

  const seen = new Set<number>();
  const all: Item[] = [];
  for (const d of days) {
    for (const it of d.data.items as Item[]) {
      if (seen.has(it.id) || !isWebUrl(it.url)) continue;
      seen.add(it.id);
      all.push(it);
    }
  }

  const within = (it: Item, hours: number) => ref.getTime() - new Date(it.publishedAt).getTime() <= hours * 3600_000;
  const recentAll = all
    .filter((it) => within(it, RULES.newsDays * 24))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  const news = recentAll.filter((it) => it.tier !== 'T1' && it.credibility >= RULES.minCredibility);
  const filings = recentAll.filter((it) => it.tier === 'T1');

  const byImp = (a: Item, b: Item) => b.importance - a.importance;
  const recentNews = news.filter((it) => within(it, RULES.topHours)).sort(byImp);
  const top = {
    KR: recentNews.filter((it) => it.market === 'KR').slice(0, RULES.topCount),
    US: recentNews.filter((it) => it.market !== 'KR').slice(0, RULES.topCount),
  };
  const topFilings = filings.filter((it) => within(it, RULES.topHours)).sort(byImp).slice(0, RULES.topFilings);

  // 관심 종목: 게시 파일과 종목 데이터 파일 중 더 최근에 만들어진 쪽의 목록을 씀
  // (종목 데이터 워크플로만 실행해도 새로 추가·삭제한 종목이 바로 반영되도록)
  const digestWatch: Watch[] = days.length ? (days[0].data.watchlist as Watch[]) : [];
  const digestAt = days[0]?.data.generatedAt ?? '';
  const stockList = Object.values(stocks);
  const watchlist: Watch[] =
    stocksUpdatedAt && stocksUpdatedAt > digestAt && stockList.length
      ? stockList.map((s) => ({ market: s.market, code: s.code, name: s.name }))
      : digestWatch;
  const watchSet = new Set(watchlist.map(tkey));
  const watchGroups = watchlist.map((w) => ({
    ...w,
    items: (() => {
      const mine = recentAll.filter((it) => it.tickers.some((t) => t.code && tkey(t) === tkey(w)));
      // 요약 있는 기사·공시를 먼저 채우고, 모자라면 나머지로 채운 뒤 다시 최신순
      const picked = [...mine.filter(isSolid), ...mine.filter((it) => !isSolid(it))].slice(0, RULES.watchItems);
      return picked.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    })(),
  }));

  const editions: Edition[] = days.length
    ? [...days[0].data.editions]
        .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
        .map((e) => ({ date: days[0].data.date, ...e }))
    : [];

  // 종목 페이지 타임라인용: 기간 제한 없이 그 종목의 모든 기록 (최신순)
  const timelineOf = (market: string, code: string) =>
    [...all].filter((it) => it.tickers.some((t) => t.code === code && t.market === market)).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  // 날짜별 보관 페이지용: 기간 제한 없이 (KST 날짜 → 공시·기사)
  const byDay = new Map<string, { filings: Item[]; news: Item[] }>();
  for (const it of all) {
    const isFiling = it.tier === 'T1';
    if (!isFiling && it.credibility < RULES.minCredibility) continue;
    const k = kstDate(it.publishedAt);
    if (!byDay.has(k)) byDay.set(k, { filings: [], news: [] });
    byDay.get(k)![isFiling ? 'filings' : 'news'].push(it);
  }
  for (const v of byDay.values()) { v.filings.sort(byImp); v.news.sort(byImp); }
  const dayKeys = [...byDay.keys()].sort().reverse();

  return { ref, generatedAt: days[0]?.data.generatedAt ?? null, news, filings, top, topFilings, editions, watchlist, watchSet, watchGroups, timelineOf, byDay, dayKeys };
}

export async function loadNews() {
  if (!cache) cache = await build();
  return cache;
}

export const isWatched = (it: Item, set: Set<string>) => it.tickers.some((t) => t.code && set.has(tkey(t)));

// 날짜(KST)별로 묶고, 하루 안에서는 중요도순
export function groupByDay(items: Item[]) {
  const map = new Map<string, Item[]>();
  for (const it of items) {
    const key = kstDate(it.publishedAt);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(it);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, list]) => ({ day, items: [...list].sort((a, b) => b.importance - a.importance) }));
}

export function kstDate(iso: string) {
  return new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}
