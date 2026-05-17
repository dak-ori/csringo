-- 1. profiles.level 컬럼 제거 (calculateLevel(total_xp)로 즉석 계산)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS level;

-- 2. profiles.league check constraint에 'platinum' 추가
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_league_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_league_check
  CHECK (league IN ('bronze', 'silver', 'gold', 'platinum', 'diamond'));

-- 3. chapters.slug 추가
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS slug text;
UPDATE public.chapters SET slug = id::text WHERE slug IS NULL;
ALTER TABLE public.chapters ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS chapters_slug_key ON public.chapters(slug);

-- 4. lessons.slug 추가
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS slug text;
UPDATE public.lessons SET slug = id::text WHERE slug IS NULL;
ALTER TABLE public.lessons ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS lessons_slug_key ON public.lessons(slug);

-- 5. user_progress.last_card_index 제거 (카드 인덱스 저장 안 함)
ALTER TABLE public.user_progress DROP COLUMN IF EXISTS last_card_index;

-- 6. user_progress.status: 'completed'만 허용
ALTER TABLE public.user_progress DROP CONSTRAINT IF EXISTS user_progress_status_check;
ALTER TABLE public.user_progress ADD CONSTRAINT user_progress_status_check
  CHECK (status IN ('completed'));

-- 7. problems: (lesson_id, order_index) unique constraint 추가 (seed upsert용)
ALTER TABLE public.problems DROP CONSTRAINT IF EXISTS problems_lesson_order_unique;
ALTER TABLE public.problems ADD CONSTRAINT problems_lesson_order_unique
  UNIQUE (lesson_id, order_index);

-- 8. 사용자명 충돌 처리 트리거 업데이트 (name_1, name_2 형식)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  base_name text;
  candidate text;
  counter int := 0;
BEGIN
  base_name := COALESCE(
    NULLIF(TRIM(new.raw_user_meta_data ->> 'name'), ''),
    split_part(new.email, '@', 1)
  );
  candidate := base_name;

  LOOP
    BEGIN
      INSERT INTO public.profiles (id, username)
      VALUES (new.id, candidate);
      RETURN new;
    EXCEPTION WHEN unique_violation THEN
      counter := counter + 1;
      candidate := base_name || '_' || counter;
    END;
  END LOOP;
END;
$$;

-- 9. get_league_rankings() RPC (RLS 우회해서 리그 순위 집계)
CREATE OR REPLACE FUNCTION public.get_league_rankings(
  p_league text DEFAULT NULL,
  p_limit int DEFAULT 50
)
RETURNS TABLE(
  user_id uuid,
  username text,
  total_xp int,
  league text,
  rank bigint
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.username,
    p.total_xp,
    p.league,
    RANK() OVER (PARTITION BY p.league ORDER BY p.total_xp DESC)
  FROM public.profiles p
  WHERE (p_league IS NULL OR p.league = p_league)
  ORDER BY p.league, rank
  LIMIT p_limit;
END;
$$;
