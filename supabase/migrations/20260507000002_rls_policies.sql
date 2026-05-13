-- RLS 활성화
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.chapters enable row level security;
alter table public.lessons enable row level security;
alter table public.problems enable row level security;
alter table public.user_progress enable row level security;
alter table public.wrong_answers enable row level security;
alter table public.review_queue enable row level security;
alter table public.xp_logs enable row level security;

-- profiles: 본인만 읽기/수정
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- courses, chapters, lessons, problems: 로그인 사용자 전체 읽기
create policy "courses_select_authenticated" on public.courses
  for select using (auth.role() = 'authenticated');

create policy "chapters_select_authenticated" on public.chapters
  for select using (auth.role() = 'authenticated');

create policy "lessons_select_authenticated" on public.lessons
  for select using (auth.role() = 'authenticated');

create policy "problems_select_authenticated" on public.problems
  for select using (auth.role() = 'authenticated');

-- user_progress: 본인만 전체 접근
create policy "user_progress_all_own" on public.user_progress
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- wrong_answers: 본인만 전체 접근
create policy "wrong_answers_all_own" on public.wrong_answers
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- review_queue: 본인만 전체 접근
create policy "review_queue_all_own" on public.review_queue
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- xp_logs: 본인만 읽기/삽입
create policy "xp_logs_select_own" on public.xp_logs
  for select using (auth.uid() = user_id);

create policy "xp_logs_insert_own" on public.xp_logs
  for insert with check (auth.uid() = user_id);
