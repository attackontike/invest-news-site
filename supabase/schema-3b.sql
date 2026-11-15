-- 투자 뉴스 브리프 · 3-B 추가 스키마 (/research)
-- SQL Editor에 전체를 붙여 넣고 Run. 여러 번 실행해도 안전합니다.

-- 리서치용: Gemini가 고른 회사명·티커를 종목 사전과 맞추고, 공시 조회에 필요한 DART 고유번호·SEC CIK까지 돌려줌
create or replace function research_context(keys text[], tickers text[])
returns jsonb language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'symbols', coalesce((
      select jsonb_agg(jsonb_build_object('market', market, 'code', code, 'name', name, 'name_key', name_key, 'corp_code', corp_code, 'cik', cik))
      from symbols
      where name_key = any(keys) or (market = 'US' and code = any(tickers))
    ), '[]'::jsonb),
    'watchlist', coalesce((
      select jsonb_agg(jsonb_build_object('market', market, 'code', code, 'name', name))
      from watchlist
    ), '[]'::jsonb)
  );
$$;

revoke execute on function research_context(text[], text[]) from public, anon, authenticated;
grant execute on function research_context(text[], text[]) to service_role;
