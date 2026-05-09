-- profiles (auth.users 확장)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  hearts int not null default 5 check (hearts >= 0 and hearts <= 5),
  hearts_last_refill timestamptz not null default now(),
  streak int not null default 0,
  last_lesson_date date,
  total_xp int not null default 0,
  level int not null default 1,
  league text not null default 'bronze' check (league in ('bronze', 'silver', 'gold', 'diamond')),
  created_at timestamptz not null default now()
);

-- courses
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  icon text,
  order_index int not null
);

-- chapters
create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade not null,
  title text not null,
  order_index int not null
);

-- lessons
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid references public.chapters(id) on delete cascade not null,
  title text not null,
  cards jsonb not null default '[]',
  concept_tags text[] not null default '{}',
  order_index int not null,
  xp_reward int not null default 15 check (xp_reward > 0),
  estimated_minutes int not null default 7
);

-- problems
create table public.problems (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references public.lessons(id) on delete cascade not null,
  type text not null check (type in ('fill_blank', 'drag_order', 'logic_flow')),
  content jsonb not null,
  correct_answer jsonb not null,
  hint text,
  concept_tags text[] not null default '{}',
  order_index int not null,
  xp_reward int not null default 5 check (xp_reward > 0)
);

-- user_progress
create table public.user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  lesson_id uuid references public.lessons(id) on delete cascade not null,
  status text not null check (status in ('started', 'completed')),
  last_card_index int not null default 0,
  completed_at timestamptz,
  unique (user_id, lesson_id)
);

-- wrong_answers
create table public.wrong_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  problem_id uuid references public.problems(id) on delete cascade not null,
  user_answer jsonb,
  wrong_count int not null default 1,
  last_wrong_at timestamptz not null default now(),
  unique (user_id, problem_id)
);

-- review_queue
create table public.review_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  problem_id uuid references public.problems(id) on delete cascade not null,
  priority int not null default 1,
  added_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (user_id, problem_id)
);

-- xp_logs
create table public.xp_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  amount int not null,
  reason text not null,
  reference_id uuid,
  created_at timestamptz not null default now()
);

-- 인덱스
create index on public.user_progress (user_id);
create index on public.user_progress (lesson_id, user_id);
create index on public.wrong_answers (user_id, last_wrong_at desc);
create index on public.review_queue (user_id, priority desc, added_at);
create index on public.xp_logs (user_id, created_at desc);
create index on public.problems (lesson_id);
create index on public.chapters (course_id);
create index on public.lessons (chapter_id);

-- 신규 사용자 가입 시 profile 자동 생성 트리거
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
      || '_' || substr(new.id::text, 1, 6)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
