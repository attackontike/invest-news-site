-- 투자 뉴스 브리프 · 4-B 추가 스키마 (종목 데이터)
-- SQL Editor에 전체를 붙여 넣고 Run. 여러 번 실행해도 안전합니다.

-- 관심 종목별 재무 요약·실적 정보 (매일 갱신)
create table if not exists stock_data (
  market         text not null,               -- KR / US
  code           text not null,               -- 005930 / NVDA
  name           text not null,
  financials     jsonb default '{}'::jsonb,   -- 국내: 분기 매출·영업이익·순이익
  metrics        jsonb default '{}'::jsonb,   -- 미국: PER, 52주 고가·저가 등
  earnings       jsonb default '[]'::jsonb,   -- 미국: 최근 EPS 실제·예상
  next_earnings  jsonb,                       -- 다음 실적 발표 (한국 시간)
  latest_label   text,                        -- 가장 최근 분기 (새 실적 감지용)
  updated_at     timestamptz not null default now(),
  primary key (market, code)
);
alter table stock_data enable row level security;
