-- its 모으기 A/B 테스트 3회차: 미션이 "둘 중 하나만 성공해도" 기준으로 바뀌면서
-- 한쪽 방식만 체험한 제출도 들어올 수 있게 vault_submissions 의 제약을 완화한다.
-- Supabase SQL Editor 에서 vault.sql 을 먼저 실행한 뒤, 이어서 한 번 실행하세요.

-- order_shown: 기존엔 둘 다 체험('1then2'/'2then1')만 허용했는데, 하나만 체험한 경우('1'/'2')도 허용
alter table public.vault_submissions drop constraint if exists vault_submissions_order_shown_check;
alter table public.vault_submissions add constraint vault_submissions_order_shown_check
  check (order_shown in ('1then2', '2then1', '1', '2'));

-- 참가자 화면 기준 라벨(A/B)을 바로 조회할 수 있게 컬럼 추가 (메일에 쓰는 것과 동일한 값)
alter table public.vault_submissions add column if not exists tested_variant text;

-- vault_responses.question_id 에 새 재인지(recheck) 질문이 추가되었다. 별도 제약은 없어 그대로 들어간다.
