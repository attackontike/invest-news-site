-- 투자 뉴스 브리프 · 4단계 추가 스키마 (데이터·일정)
-- SQL Editor에 전체를 붙여 넣고 Run. 여러 번 실행해도 안전합니다.

-- 거시 지표 (FRED, 한국은행 ECOS): 지표마다 한 행, 최근 값과 짧은 이력
create table if not exists indicators (
  series_key   text primary key,             -- US:CPIAUCSL, KR:731Y001:0000001
  market       text not null,                -- KR / US
  name         text not null,
  unit         text,
  latest_date  text,                         -- 2026-10 / 2026-11-13
  latest_value numeric,
  prev_value   numeric,
  change       numeric,
  history      jsonb default '[]'::jsonb,    -- [["2026-10", 3.1], …]
  source       text,
  updated_at   timestamptz not null default now()
);

-- 경제 일정: 발표 예정 (한국 시간 기준 날짜·시각)
create table if not exists econ_events (
  event_key   text primary key,              -- fred:10:2026-12-10, manual:2026-12-09:FOMC
  event_date  date not null,                 -- 한국 시간 날짜
  event_time  text,                          -- 22:30 (한국 시간), 모르면 null
  market      text not null,
  name        text not null,
  importance  smallint not null default 1,   -- 1~3
  source      text,
  updated_at  timestamptz not null default now()
);
create index if not exists econ_events_date_idx on econ_events (event_date);

alter table indicators  enable row level security;
alter table econ_events enable row level security;
