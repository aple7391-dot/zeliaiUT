-- its 모으기 A/B 테스트 3회차 — Supabase SQL Editor 에서 한 번 실행하세요.
-- 기존(1·2회차) 테이블과 데이터는 지우거나 바꾸지 않습니다. 컬럼 추가·제약 완화·조회용 뷰만 만듭니다.
-- (vault_v2.sql 을 이미 실행했어도 다시 실행해도 됩니다.)

-- 1) 한쪽 방식만 체험한 제출('1' / '2')을 허용하고, 참가자 화면 기준 라벨(A/B) 컬럼을 추가 (vault_v2.sql 과 동일)
alter table public.vault_submissions drop constraint if exists vault_submissions_order_shown_check;
alter table public.vault_submissions add constraint vault_submissions_order_shown_check
  check (order_shown in ('1then2', '2then1', '1', '2'));
alter table public.vault_submissions add column if not exists tested_variant text;

-- 2) 미션 퍼널: 참가자(기기 ID) × 테스트(A/B)별로 각 단계에 도달한 시각과 미션 1 이후 걸린 시간(ms)
--    vault_events.type = 'funnel', extra = { step, test, elapsed_ms, step_ms, round }
--    회차는 extra.round(3) 와 created_at 으로 구분한다 — 1·2회차 기록은 그대로 남아 있다.
create or replace view public.vault_funnel as
select
  participant_id,
  extra->>'test'  as test,                       -- A(b) | B(c)
  extra->>'round' as round,
  min(created_at) as started_at,
  max((extra->>'elapsed_ms')::bigint) filter (where extra->>'step' = 'm1_first_collect') as m1_first_collect_ms,
  max((extra->>'elapsed_ms')::bigint) filter (where extra->>'step' = 'm1_done')          as m1_done_ms,
  max((extra->>'elapsed_ms')::bigint) filter (where extra->>'step' = 'm2_done')          as m2_done_ms,
  max((extra->>'elapsed_ms')::bigint) filter (where extra->>'step' = 'm3_shown')         as m3_shown_ms,
  max((extra->>'elapsed_ms')::bigint) filter (where extra->>'step' = 'm3_done')          as m3_done_ms,
  max((extra->>'step_ms')::bigint)    filter (where extra->>'step' = 'm3_done')          as m3_find_list_ms, -- 마지막 미션이 뜬 뒤 리스트를 찾기까지
  max((extra->>'elapsed_ms')::bigint) filter (where extra->>'step' = 'complete_shown')   as complete_ms,
  bool_or(extra->>'step' = 'survey_clicked') as survey_clicked
from public.vault_events
where type = 'funnel'
group by participant_id, extra->>'test', extra->>'round';

-- 3) 테스트별 단계 도달 인원(완수율)과 중앙값 시간
create or replace view public.vault_funnel_summary as
select
  test, round,
  count(*)                                   as started,
  count(m1_done_ms)                          as m1_done,
  count(m2_done_ms)                          as m2_done,
  count(m3_done_ms)                          as m3_done,
  round(100.0 * count(m3_done_ms) / nullif(count(*), 0), 1) as complete_rate_pct,
  percentile_cont(0.5) within group (order by m1_done_ms)      as m1_median_ms,
  percentile_cont(0.5) within group (order by m3_find_list_ms) as m3_find_list_median_ms,
  percentile_cont(0.5) within group (order by m3_done_ms)      as total_median_ms
from public.vault_funnel
group by test, round;

-- 설문 응답과 퍼널을 같은 기기 ID 로 잇는 예시:
--   select f.*, s.tested_variant, s.prior_use, s.device_type
--   from public.vault_funnel f left join public.vault_submissions s using (participant_id)
--   where f.round = '3';
