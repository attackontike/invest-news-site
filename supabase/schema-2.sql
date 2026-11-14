-- 투자 뉴스 브리프 · 2단계 추가 스키마
-- 1단계 schema.sql을 실행한 프로젝트에서 SQL Editor → 전체 붙여넣고 Run. 여러 번 실행해도 안전합니다.

-- 1) 종목 사전: 이름 비교용 키
alter table symbols add column if not exists name_key text;
create index if not exists symbols_name_key_idx on symbols (name_key);

-- 2) 공시·관심 종목 수집용: 관심 종목(사전 정보 포함) + 수집 커서
create or replace function t1_context()
returns jsonb language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'watchlist', coalesce((
      select jsonb_agg(jsonb_build_object(
        'market', w.market, 'code', w.code, 'name', coalesce(s.name, w.name), 'label', w.name,
        'corp_code', s.corp_code, 'cik', s.cik) order by w.added_at)
      from watchlist w
      left join symbols s on s.market = w.market and s.code = w.code
    ), '[]'::jsonb),
    'cursors', coalesce((select jsonb_object_agg(key, value) from cursors), '{}'::jsonb)
  );
$$;

-- 3) 게시용: Gemini가 뽑은 회사명·티커를 종목 사전과 맞춰 보고, 관심 종목도 함께 돌려줌
create or replace function digest_context(keys text[], tickers text[])
returns jsonb language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'symbols', coalesce((
      select jsonb_agg(jsonb_build_object('market', market, 'code', code, 'name', name, 'name_key', name_key))
      from symbols
      where name_key = any(keys) or (market = 'US' and code = any(tickers))
    ), '[]'::jsonb),
    'watchlist', coalesce((
      select jsonb_agg(jsonb_build_object('market', w.market, 'code', w.code, 'name', w.name) order by w.added_at)
      from watchlist w
    ), '[]'::jsonb)
  );
$$;

revoke execute on function t1_context() from public, anon, authenticated;
revoke execute on function digest_context(text[], text[]) from public, anon, authenticated;
grant execute on function t1_context() to service_role;
grant execute on function digest_context(text[], text[]) to service_role;

-- 4) 관심 종목 예시 (원하는 것만 남기고 실행하거나, Table Editor의 watchlist에서 직접 추가)
--    market은 KR 또는 US, code는 국내 6자리 종목코드 또는 미국 티커, name은 화면에 보일 이름
-- insert into watchlist (market, code, name) values
--   ('KR', '005930', '삼성전자'),
--   ('KR', '000660', 'SK하이닉스'),
--   ('US', 'NVDA', '엔비디아'),
--   ('US', 'AAPL', '애플')
-- on conflict do nothing;
