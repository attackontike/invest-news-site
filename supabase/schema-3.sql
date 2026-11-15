-- 투자 뉴스 브리프 · 3단계 추가 스키마
-- SQL Editor에 전체를 붙여 넣고 Run. 여러 번 실행해도 안전합니다.

-- /watch 명령용: 현재 관심 종목 + 입력과 맞는 종목 후보
-- q: 사용자가 입력한 그대로, key: 이름 비교용 키(n8n이 계산)
create or replace function watch_context(q text, key text)
returns jsonb language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'watchlist', coalesce((
      select jsonb_agg(jsonb_build_object('market', market, 'code', code, 'name', name) order by added_at)
      from watchlist
    ), '[]'::jsonb),
    'candidates', coalesce((
      select jsonb_agg(jsonb_build_object('market', market, 'code', code, 'name', name, 'rank', rank) order by rank, length(name))
      from (
        select market, code, name,
               case when upper(code) = upper(q) then 0
                    when name_key = key then 1
                    when name ilike replace(replace(q, '%', ''), '_', '') || '%' then 2
                    else 3 end as rank
        from symbols
        where upper(code) = upper(q)
           or (key <> '' and name_key = key)
           or (length(q) >= 2 and name ilike '%' || replace(replace(q, '%', ''), '_', '') || '%')
        order by rank, length(name)
        limit 8
      ) s
    ), '[]'::jsonb)
  );
$$;

revoke execute on function watch_context(text, text) from public, anon, authenticated;
grant execute on function watch_context(text, text) to service_role;
