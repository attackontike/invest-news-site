import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// n8n "게시" 워크플로가 하루 4번 src/content/digest/YYYY-MM-DD.md 를 덮어씁니다.
// 형식이 조금 어긋나도 빌드가 멈추지 않도록 대부분 기본값을 둡니다.
const ticker = z.object({
  market: z.string().optional(),
  code: z.string().optional(),
  name: z.string(),
});

const item = z.object({
  id: z.number(),
  tier: z.string().default('T2'),
  market: z.enum(['KR', 'US', 'GLOBAL']).default('KR'),
  title: z.string(),
  titleKo: z.string().optional(),
  source: z.string(),
  sourceGrade: z.string().default('해설'),
  url: z.string(),
  publishedAt: z.string(),
  summary: z.string().default(''),
  keyPoints: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  tickers: z.array(ticker).default([]),
  sentiment: z.enum(['호재', '악재', '중립']).default('중립'),
  credibility: z.number().default(3),
  importance: z.number().default(0),
  coverage: z.number().default(1),
  storyKey: z.string().optional(),
  edition: z.string().optional(),
  eventType: z.string().optional(),
});

const digest = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/digest' }),
  schema: z.object({
    date: z.string(),
    generatedAt: z.string(),
    watchlist: z.array(z.object({ market: z.string(), code: z.string(), name: z.string() })).default([]),
    editions: z
      .array(
        z.object({
          edition: z.string(),
          generatedAt: z.string(),
          briefing: z.array(z.string()).default([]),
        }),
      )
      .default([]),
    items: z.array(item).default([]),
  }),
});

// n8n "리서치" 워크플로가 /research 명령마다 src/content/research/<slug>.md 를 만듭니다.
const refItem = z.object({ text: z.string(), refs: z.array(z.string()).default([]) });
const research = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/research' }),
  schema: z.object({
    title: z.string(),
    topic: z.string(),
    slug: z.string(),
    createdAt: z.string(),
    tone: z.string().default('중립'),
    focus: z.string().default(''),
    tickers: z.array(ticker).default([]),
    report: z.object({
      summary: z.array(z.string()).default([]),
      filings: z.array(refItem).default([]),
      news: z.array(refItem.extend({ sentiment: z.string().default('중립') })).default([]),
      context: z.array(refItem).default([]),
      issues: z.array(z.string()).default([]),
      checks: z.array(z.string()).default([]),
      background: z.string().default(''),
    }),
    qa: z.array(z.object({ q: z.string(), a: z.string(), refs: z.array(z.string()).default([]), diff: z.string().default('') })).default([]),
    qaModel: z.string().default(''),
    sources: z
      .array(z.object({ id: z.string(), kind: z.string(), title: z.string(), source: z.string(), url: z.string().default(''), date: z.string().default(''), isAI: z.boolean().default(false) }))
      .default([]),
  }),
});

// n8n "주간 리포트" 워크플로가 매주 일요일 src/content/weekly/<YYYY-Www>.md 를 만듭니다.
const weekly = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/weekly' }),
  schema: z.object({
    title: z.string(),
    week: z.string(),
    range: z.string(),
    createdAt: z.string(),
    ai: z.boolean().default(true),
    report: z.object({
      headline: z.string().default(''),
      summary: z.array(z.string()).default([]),
      market: z.array(refItem).default([]),
      watch: z.array(refItem.extend({ name: z.string() })).default([]),
      data: z.array(z.string()).default([]),
      nextWeek: z.array(z.string()).default([]),
    }),
    events: z.array(z.object({ date: z.string(), time: z.string().nullable().optional(), market: z.string(), name: z.string(), importance: z.number().default(1) })).default([]),
    stats: z.object({ articles: z.number().default(0), filings: z.number().default(0), research: z.number().default(0) }).default({ articles: 0, filings: 0, research: 0 }),
    research: z.array(z.object({ title: z.string(), key: z.string() })).default([]),
    sources: z.array(z.object({ id: z.string(), kind: z.string(), title: z.string(), source: z.string(), url: z.string().default(''), date: z.string().default(''), market: z.string().optional(), sentiment: z.string().optional() })).default([]),
  }),
});

export const collections = { digest, research, weekly };
