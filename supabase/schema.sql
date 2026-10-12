-- Supabase SQL Editor 에서 한 번 실행하세요.
create table if not exists public.submissions (
  participant_id text primary key,          -- 중복 제출 방지
  first_version  text check (first_version in ('before','after')),
  mail_status    text not null default 'pending',  -- pending | sent | failed | skipped
  created_at     timestamptz not null default now()
);

create table if not exists public.responses (
  id             uuid primary key,
  participant_id text not null references public.submissions(participant_id) on delete cascade,
  question_id    text not null,
  variant        text check (variant in ('before','after')),
  value          jsonb,
  answered_at    timestamptz not null default now()
);
create index if not exists responses_pid_idx on public.responses(participant_id);

-- 브라우저(anon)는 접근하지 못하게 RLS 를 켭니다. 서버는 service role 키로만 씁니다.
alter table public.submissions enable row level security;
alter table public.responses  enable row level security;
