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
