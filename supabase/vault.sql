-- its 보관함 비교 테스트 전용 테이블 (젤리아이 submissions/responses 와 분리). Supabase SQL Editor 에서 한 번 실행하세요.
create table if not exists public.vault_submissions (
  participant_id text primary key,          -- 중복 제출 방지
  prior_use      text check (prior_use in ('예','아니요')),  -- 테스트 전 '모으기' 사용 경험
  order_shown    text check (order_shown in ('1then2','2then1')),
  device_type    text check (device_type in ('mobile','pc')),
  mail_status    text not null default 'pending',  -- pending | sent | failed | skipped
  created_at     timestamptz not null default now()
);

create table if not exists public.vault_responses (
  id             uuid primary key,
  participant_id text not null references public.vault_submissions(participant_id) on delete cascade,
  question_id    text not null,
  variant        text check (variant in ('1','2')),   -- 1 / 2 (1=보관-비우기=c, 2=모으기-비우기=b)
  value          jsonb,
  question_text  text,
  answered_at    timestamptz not null default now()
);
create index if not exists vault_responses_pid_idx on public.vault_responses(participant_id);

alter table public.vault_submissions enable row level security;
alter table public.vault_responses  enable row level security;

-- 행동 기록(index.html / survey.html 이 남김). 어느 방식을 먼저 눌렀는지 등을 participant_id 로 조회한다.
create table if not exists public.vault_events (
  id             uuid primary key,                 -- 클라이언트가 만든 값, 재전송 시 중복 방지
  participant_id text not null,
  page           text,                             -- index | survey
  type           text not null,                    -- page_view | open_its | its_done | survey_click | survey_step
  variant        text check (variant in ('1','2')),-- 1=보관-비우기(c), 2=모으기-비우기(b)
  client_ts      timestamptz,                      -- 브라우저 시각
  extra          jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists vault_events_pid_idx on public.vault_events(participant_id, created_at);
alter table public.vault_events enable row level security;

-- 참가자별로 어느 방식을 먼저 눌렀는지
create or replace view public.vault_first_open as
select participant_id,
       (array_agg(variant order by client_ts) filter (where type='open_its'))[1] as first_variant,
       min(client_ts) filter (where type='open_its' and variant='1') as t1,
       min(client_ts) filter (where type='open_its' and variant='2') as t2
from public.vault_events group by participant_id;
