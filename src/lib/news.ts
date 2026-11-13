import { getCollection } from 'astro:content';

// 화면 기준은 여기서 바꿉니다.
export const RULES = {
  newsDays: 7, // 시장 뉴스 메뉴에 보여 줄 기간
  topHours: 24, // 시장 브리핑의 "주요 뉴스" 기간
  topCount: 6, // 시장 브리핑에서 시장별로 보여 줄 개수
  minCredibility: 2, // 이 값보다 낮은 신뢰도는 숨김
};

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
  tickers: { market?: string; code?: string; name: string }[];
  sentiment: '호재' | '악재' | '중립';
  credibility: number;
  importance: number;
  coverage: number;
  storyKey?: string;
  edition?: string;
};

export type Edition = { date: string; edition: string; generatedAt: string; briefing: string[] };

const isWebUrl = (u: string) => /^https?:\/\/[^\s]+$/i.test(u);

let cache: Awaited<ReturnType<typeof build>> | null = null;

async function build() {
  const days = (await getCollection('digest')).sort((a, b) => b.data.date.localeCompare(a.data.date));

  // 기준 시각: 빌드 시각이 아니라 마지막 게시 시각
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

  const within = (it: Item, hours: number) =>
    ref.getTime() - new Date(it.publishedAt).getTime() <= hours * 3600_000;

  const news = all
    .filter((it) => it.credibility >= RULES.minCredibility && within(it, RULES.newsDays * 24))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  const recent = news.filter((it) => within(it, RULES.topHours)).sort((a, b) => b.importance - a.importance);
  const top = {
    KR: recent.filter((it) => it.market === 'KR').slice(0, RULES.topCount),
    US: recent.filter((it) => it.market !== 'KR').slice(0, RULES.topCount),
  };

  // 오늘(마지막 게시일)의 브리핑, 최신 회차가 위
  const editions: Edition[] = days.length
    ? [...days[0].data.editions]
        .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
        .map((e) => ({ date: days[0].data.date, ...e }))
    : [];

  return { ref, generatedAt: days[0]?.data.generatedAt ?? null, news, top, editions };
}

export async function loadNews() {
  if (!cache) cache = await build();
  return cache;
}

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
    .map(([day, list]) => ({ day, items: list.sort((a, b) => b.importance - a.importance) }));
}

export function kstDate(iso: string) {
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000);
  return d.toISOString().slice(0, 10);
}
