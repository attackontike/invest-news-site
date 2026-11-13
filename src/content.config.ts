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
});

const digest = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/digest' }),
  schema: z.object({
    date: z.string(),
    generatedAt: z.string(),
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

export const collections = { digest };
