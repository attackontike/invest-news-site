import { getCollection } from 'astro:content';

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

  // 관심 종목: 마지막 게시 때의 목록
  const watchlist: Watch[] = days.length ? (days[0].data.watchlist as Watch[]) : [];
  const watchSet = new Set(watchlist.map(tkey));
  const watchGroups = watchlist.map((w) => ({
    ...w,
    items: recentAll.filter((it) => it.tickers.some((t) => t.code && tkey(t) === tkey(w))).slice(0, RULES.watchItems),
  }));

  const editions: Edition[] = days.length
    ? [...days[0].data.editions]
        .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
        .map((e) => ({ date: days[0].data.date, ...e }))
    : [];

  return { ref, generatedAt: days[0]?.data.generatedAt ?? null, news, filings, top, topFilings, editions, watchlist, watchSet, watchGroups };
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
