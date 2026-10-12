-- Supabase SQL Editor 에서 한 번 실행하세요. (행동 기록용)
create table if not exists public.events (
  id             bigint generated always as identity primary key,
  participant_id text not null,
  session_id     text not null,
  variant        text not null check (variant in ('before','after')),
  seq            int  not null,
  type           text not null,          -- start | click | view | result | hidden
  t_ms           int,                    -- 화면 진입 후 경과 시간(ms)
  screen         text,                   -- 활성 화면 id
  overlay        text,                   -- 열려 있는 시트/드로어/팝업
  tab            text,                   -- 하단 탭
  target         text,                   -- 누른 요소
  label          text,                   -- 요소 문구
  x              int,                    -- 클릭 위치(%)
  y              int,
  extra          jsonb,
  created_at     timestamptz not null default now(),
  unique (session_id, seq)
);
create index if not exists events_pid_idx on public.events(participant_id, variant, t_ms);
alter table public.events enable row level security;

-- 1) 참가자/버전별 결과: 얼마 만에 포기/성공을 눌렀는지, 몇 번 눌렀는지
create or replace view public.ut_result as
select e.participant_id, e.variant,
       max(case when e.type='result' then e.extra->>'result' end)           as result,
       max(case when e.type='result' then (e.extra->>'elapsed_ms')::int end) as elapsed_ms,
       count(*) filter (where e.type='click')                              as clicks,
       count(distinct (e.screen||'|'||coalesce(e.overlay,'')))             as places_visited
from public.events e
group by e.participant_id, e.variant;

-- 2) 어디서 얼마나 머물렀는지(헤맸는지): 화면/오버레이별 체류 시간
create or replace view public.ut_dwell as
select participant_id, variant, session_id, screen, overlay, tab, t_ms as enter_ms,
       coalesce(lead(t_ms) over (partition by session_id order by seq), t_ms) - t_ms as dwell_ms
from public.events
where type in ('view','start');

-- 3) 무엇을 눌렀는지: 클릭 타임라인
create or replace view public.ut_clicks as
select participant_id, variant, session_id, seq, t_ms, screen, overlay, tab, target, label, x, y
from public.events
where type = 'click'
order by participant_id, variant, seq;
