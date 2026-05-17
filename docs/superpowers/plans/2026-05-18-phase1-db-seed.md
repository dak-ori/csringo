# Phase 1: DB + 유틸리티 + 시드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DB 스키마 업데이트, 타입 정의, XP/하트 유틸리티, 콘텐츠 JSON 파일, 시드 스크립트를 완성한다.

**Architecture:** Supabase 원격 DB에 migration SQL을 직접 실행. lib/ 유틸리티는 TDD로 작성. scripts/seed.ts는 data/ JSON 파일을 읽어 Supabase에 upsert.

**Tech Stack:** Next.js 15, Supabase, TypeScript, Vitest, tsx (seed script runner)

---

## Task 1: 의존성 설치 + 환경변수

**Files:**
- Modify: `package.json`
- Modify: `.env.local`

- [ ] **Step 1: dnd-kit, anthropic SDK, tsx 설치**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities @anthropic-ai/sdk
npm install --save-dev tsx
```

Expected: `package.json`의 dependencies에 `@dnd-kit/core`, `@anthropic-ai/sdk` 추가됨.

- [ ] **Step 2: `.env.local`에 service role key 추가**

Supabase 대시보드 → Project Settings → API → `service_role` secret 값 복사.

```
NEXT_PUBLIC_SUPABASE_URL=https://tdtyragtxikafpwtfyxq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...여기에_service_role_키_붙여넣기
ANTHROPIC_API_KEY=sk-ant-...여기에_Claude_API_키_붙여넣기
```

- [ ] **Step 3: 커밋**

```bash
git add package.json package-lock.json
git commit -m "feat: add dnd-kit, anthropic sdk, tsx"
```

---

## Task 2: DB Migration — 스키마 업데이트

**Files:**
- Create: `supabase/migrations/20260518000003_schema_updates.sql`

> **실행 방법:** Supabase 대시보드 → SQL Editor → New query → 아래 SQL 전체 붙여넣고 Run.

- [ ] **Step 1: migration 파일 생성**

```sql
-- supabase/migrations/20260518000003_schema_updates.sql

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

-- 6. user_progress.status: 'started' 제거, 'completed'만 허용
ALTER TABLE public.user_progress DROP CONSTRAINT IF EXISTS user_progress_status_check;
ALTER TABLE public.user_progress ADD CONSTRAINT user_progress_status_check
  CHECK (status IN ('completed'));

-- 7. problems: (lesson_id, order_index) unique constraint 추가 (seed upsert용)
ALTER TABLE public.problems DROP CONSTRAINT IF EXISTS problems_lesson_order_unique;
ALTER TABLE public.problems ADD CONSTRAINT problems_lesson_order_unique
  UNIQUE (lesson_id, order_index);

-- 8. 사용자명 충돌 처리 트리거 업데이트 (구글 동명이인: name_1, name_2 형식)
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
```

- [ ] **Step 2: Supabase 대시보드에서 SQL 실행**

위 SQL을 Supabase SQL Editor에 붙여넣고 Run.  
Expected: "Success. No rows returned" 또는 각 ALTER 성공 메시지.

- [ ] **Step 3: 파일 커밋**

```bash
git add supabase/migrations/20260518000003_schema_updates.sql
git commit -m "feat: update db schema - add slugs, remove level column, fix league"
```

---

## Task 3: TypeScript 타입 정의

**Files:**
- Create: `lib/types/lesson.ts`

- [ ] **Step 1: 타입 파일 생성**

```typescript
// lib/types/lesson.ts

export type ProblemType = 'fill_blank' | 'drag_order' | 'logic_flow'
export type LeagueType = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'

export interface Course {
  id: string
  slug: string
  title: string
  description: string | null
  icon: string | null
  order_index: number
}

export interface Chapter {
  id: string
  course_id: string
  slug: string
  title: string
  order_index: number
}

export interface Card {
  title: string
  content: string
}

export interface Lesson {
  id: string
  chapter_id: string
  slug: string
  title: string
  cards: Card[]
  concept_tags: string[]
  order_index: number
  xp_reward: number
  estimated_minutes: number
}

export interface FillBlankContent {
  question: string
  blank_count: number
}

export interface DragOrderContent {
  question: string
  items: string[]
}

export interface LogicFlowContent {
  question: string
  steps: string[]
  blank_index: number
  options: string[]
}

export type ProblemContent = FillBlankContent | DragOrderContent | LogicFlowContent

export interface Problem {
  id: string
  lesson_id: string
  type: ProblemType
  content: ProblemContent
  correct_answer: string[]
  hint: string | null
  concept_tags: string[]
  order_index: number
  xp_reward: number
}

export interface UserProfile {
  id: string
  username: string
  hearts: number
  hearts_last_refill: string
  streak: number
  last_lesson_date: string | null
  total_xp: number
  league: LeagueType
  created_at: string
}

export interface UserProgress {
  id: string
  user_id: string
  lesson_id: string
  status: 'completed'
  completed_at: string | null
}

export interface WrongAnswer {
  id: string
  user_id: string
  problem_id: string
  user_answer: string[] | null
  wrong_count: number
  last_wrong_at: string
}

export interface ReviewQueueItem {
  id: string
  user_id: string
  problem_id: string
  priority: number
  added_at: string
  reviewed_at: string | null
  problem?: Problem
}

export interface SubmitResult {
  correct: boolean
  xp_earned?: number
  hearts_remaining?: number
}

export interface CompleteResult {
  xp_earned: number
  total_xp: number
  streak: number
  leveled_up: boolean
  new_level: number
}
```

- [ ] **Step 2: 커밋**

```bash
git add lib/types/lesson.ts
git commit -m "feat: add TypeScript types for lesson domain"
```

---

## Task 4: XP 유틸리티 TDD

**Files:**
- Create: `__tests__/lib/xp.test.ts`
- Create: `lib/xp.ts`

레벨 임계값: 1=0 XP, 2=100, 3=300, 4=600, 5+=600+(n-4)*400

- [ ] **Step 1: 테스트 작성**

```typescript
// __tests__/lib/xp.test.ts
import { describe, it, expect } from 'vitest'
import { calculateLevel } from '@/lib/xp'

describe('calculateLevel', () => {
  it('0 XP → level 1', () => expect(calculateLevel(0)).toBe(1))
  it('99 XP → level 1', () => expect(calculateLevel(99)).toBe(1))
  it('100 XP → level 2', () => expect(calculateLevel(100)).toBe(2))
  it('299 XP → level 2', () => expect(calculateLevel(299)).toBe(2))
  it('300 XP → level 3', () => expect(calculateLevel(300)).toBe(3))
  it('599 XP → level 3', () => expect(calculateLevel(599)).toBe(3))
  it('600 XP → level 4', () => expect(calculateLevel(600)).toBe(4))
  it('999 XP → level 4', () => expect(calculateLevel(999)).toBe(4))
  it('1000 XP → level 5', () => expect(calculateLevel(1000)).toBe(5))
  it('1400 XP → level 6', () => expect(calculateLevel(1400)).toBe(6))
  it('3000 XP → level 10', () => expect(calculateLevel(3000)).toBe(10))
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npm test -- xp
```

Expected: FAIL — "Cannot find module '@/lib/xp'"

- [ ] **Step 3: 구현**

```typescript
// lib/xp.ts
export function calculateLevel(xp: number): number {
  if (xp < 100) return 1
  if (xp < 300) return 2
  if (xp < 600) return 3
  if (xp < 1000) return 4
  return 5 + Math.floor((xp - 1000) / 400)
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm test -- xp
```

Expected: PASS (11 tests)

- [ ] **Step 5: 커밋**

```bash
git add __tests__/lib/xp.test.ts lib/xp.ts
git commit -m "feat: add calculateLevel utility with tests"
```

---

## Task 5: 하트 유틸리티 TDD

**Files:**
- Create: `__tests__/lib/hearts.test.ts`
- Create: `lib/hearts.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// __tests__/lib/hearts.test.ts
import { describe, it, expect } from 'vitest'
import { calculateCurrentHearts } from '@/lib/hearts'

describe('calculateCurrentHearts', () => {
  it('방금 소모 → 저장값 그대로', () => {
    const now = new Date()
    expect(calculateCurrentHearts(3, now)).toBe(3)
  })

  it('4시간 경과 → 1 회복', () => {
    const fourHoursAgo = new Date(Date.now() - 4 * 3_600_000)
    expect(calculateCurrentHearts(3, fourHoursAgo)).toBe(4)
  })

  it('8시간 경과 → 2 회복', () => {
    const eightHoursAgo = new Date(Date.now() - 8 * 3_600_000)
    expect(calculateCurrentHearts(2, eightHoursAgo)).toBe(4)
  })

  it('최대 5개 초과 불가', () => {
    const dayAgo = new Date(Date.now() - 24 * 3_600_000)
    expect(calculateCurrentHearts(3, dayAgo)).toBe(5)
  })

  it('이미 5개면 경과 시간 무관 5 유지', () => {
    const hourAgo = new Date(Date.now() - 3_600_000)
    expect(calculateCurrentHearts(5, hourAgo)).toBe(5)
  })

  it('3시간 경과 → 회복 없음', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3_600_000)
    expect(calculateCurrentHearts(0, threeHoursAgo)).toBe(0)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npm test -- hearts
```

Expected: FAIL

- [ ] **Step 3: 구현**

```typescript
// lib/hearts.ts
export function calculateCurrentHearts(
  storedHearts: number,
  lastRefill: Date
): number {
  const hoursElapsed = (Date.now() - lastRefill.getTime()) / 3_600_000
  const recovered = Math.floor(hoursElapsed / 4)
  return Math.min(5, storedHearts + recovered)
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm test -- hearts
```

Expected: PASS (6 tests)

- [ ] **Step 5: 전체 테스트 확인**

```bash
npm test
```

Expected: All tests pass

- [ ] **Step 6: 커밋**

```bash
git add __tests__/lib/hearts.test.ts lib/hearts.ts
git commit -m "feat: add calculateCurrentHearts utility with tests"
```

---

## Task 6: 콘텐츠 JSON 파일 (자료구조 3챕터)

**Files:**
- Create: `data/courses.json`
- Create: `data/data-structures/chapter-01-arrays.json`
- Create: `data/data-structures/chapter-02-stacks.json`
- Create: `data/data-structures/chapter-03-hash-tables.json`

- [ ] **Step 1: courses.json 생성**

```json
[
  {
    "slug": "data-structures",
    "title": "자료구조",
    "description": "배열, 스택, 해시 테이블 등 핵심 자료구조를 마스터합니다.",
    "icon": "🗂️",
    "order_index": 1
  },
  {
    "slug": "algorithms",
    "title": "알고리즘",
    "description": "정렬, 탐색, 재귀 알고리즘의 원리를 익힙니다.",
    "icon": "⚙️",
    "order_index": 2
  },
  {
    "slug": "os",
    "title": "운영체제",
    "description": "프로세스, 메모리, 파일 시스템을 이해합니다.",
    "icon": "💻",
    "order_index": 3
  },
  {
    "slug": "network",
    "title": "네트워크",
    "description": "TCP/IP, HTTP, DNS의 동작 원리를 배웁니다.",
    "icon": "🌐",
    "order_index": 4
  }
]
```

- [ ] **Step 2: chapter-01-arrays.json 생성**

```json
{
  "course_slug": "data-structures",
  "slug": "arrays",
  "title": "배열 (Arrays)",
  "order_index": 1,
  "lessons": [
    {
      "slug": "array-basics",
      "title": "배열이란 무엇인가",
      "order_index": 1,
      "estimated_minutes": 7,
      "xp_reward": 15,
      "concept_tags": ["array", "index", "random-access"],
      "cards": [
        {
          "title": "배열의 정의",
          "content": "배열(Array)은 **같은 타입**의 데이터를 **연속된 메모리 공간**에 순서대로 저장하는 자료구조입니다.\n\n```\n인덱스: [0]  [1]  [2]  [3]  [4]\n값:     [10] [20] [30] [40] [50]\n```\n\n- 인덱스(index)로 O(1) 시간에 접근 가능\n- 정수형 기준, 주소 = 시작주소 + (인덱스 × 4바이트)"
        },
        {
          "title": "배열의 시간 복잡도",
          "content": "| 연산 | 시간 복잡도 |\n|------|-------------|\n| 읽기/수정 | O(1) |\n| 탐색 | O(n) |\n| 삽입(끝) | O(1) |\n| 삽입(중간) | O(n) |\n| 삭제(중간) | O(n) |"
        }
      ],
      "problems": [
        {
          "type": "fill_blank",
          "content": {
            "question": "배열에서 인덱스로 원소에 직접 접근하는 시간 복잡도는 ___입니다.",
            "blank_count": 1
          },
          "correct_answer": ["O(1)"],
          "hint": "배열은 시작 주소와 인덱스로 메모리 주소를 바로 계산합니다.",
          "concept_tags": ["array", "time-complexity"],
          "order_index": 1,
          "xp_reward": 5
        },
        {
          "type": "drag_order",
          "content": {
            "question": "배열 중간에 원소를 삽입할 때 올바른 순서로 정렬하세요.",
            "items": ["삽입할 위치 결정", "삽입 위치부터 끝까지 원소를 한 칸씩 뒤로 이동", "빈 자리에 새 원소 삽입"]
          },
          "correct_answer": ["삽입할 위치 결정", "삽입 위치부터 끝까지 원소를 한 칸씩 뒤로 이동", "빈 자리에 새 원소 삽입"],
          "hint": null,
          "concept_tags": ["array", "insertion"],
          "order_index": 2,
          "xp_reward": 5
        },
        {
          "type": "logic_flow",
          "content": {
            "question": "이진 탐색(Binary Search)의 실행 흐름",
            "steps": ["left=0, right=n-1 초기화", "___", "목표값과 같으면 반환, 작으면 left=mid+1, 크면 right=mid-1"],
            "blank_index": 1,
            "options": ["mid = (left+right)/2 계산", "left부터 순서대로 비교", "배열을 먼저 정렬"]
          },
          "correct_answer": ["mid = (left+right)/2 계산"],
          "hint": "이진 탐색은 매 단계마다 탐색 범위를 절반으로 줄입니다.",
          "concept_tags": ["array", "binary-search"],
          "order_index": 3,
          "xp_reward": 5
        }
      ]
    },
    {
      "slug": "dynamic-arrays",
      "title": "동적 배열과 JavaScript 배열",
      "order_index": 2,
      "estimated_minutes": 6,
      "xp_reward": 15,
      "concept_tags": ["dynamic-array", "amortized"],
      "cards": [
        {
          "title": "동적 배열이란",
          "content": "동적 배열은 크기가 자동으로 늘어나는 배열입니다.\n\n**내부 동작:**\n1. 초기 capacity로 배열 생성\n2. 꽉 차면 2배 크기 새 배열 할당\n3. 기존 원소 전부 복사\n\nJavaScript의 `Array`, Python의 `list`가 동적 배열입니다."
        },
        {
          "title": "분할 상환 분석 (Amortized O(1))",
          "content": "동적 배열의 push는 **평균적으로 O(1)**입니다.\n\n- 대부분: O(1) (공간 남으면 그냥 추가)\n- 꽉 찰 때: O(n) (복사 필요)\n\n2배씩 늘리면 복사 비용이 분산되어 n번 push의 총 비용 = O(n) → 1회 평균 O(1)"
        }
      ],
      "problems": [
        {
          "type": "fill_blank",
          "content": {
            "question": "동적 배열이 꽉 찼을 때 원소를 추가하면 내부적으로 크기가 약 ___배인 새 배열을 할당합니다.",
            "blank_count": 1
          },
          "correct_answer": ["2"],
          "hint": "대부분의 동적 배열 구현은 용량을 2배로 늘립니다.",
          "concept_tags": ["dynamic-array", "amortized"],
          "order_index": 1,
          "xp_reward": 5
        },
        {
          "type": "logic_flow",
          "content": {
            "question": "동적 배열 push() 내부 동작 흐름",
            "steps": ["현재 size와 capacity 비교", "___", "원소 추가 후 size++"],
            "blank_index": 1,
            "options": ["capacity 부족 시 2배 크기 새 배열 할당 후 복사", "capacity 부족 시 삽입 거부", "capacity 부족 시 첫 원소 삭제 후 추가"]
          },
          "correct_answer": ["capacity 부족 시 2배 크기 새 배열 할당 후 복사"],
          "hint": null,
          "concept_tags": ["dynamic-array"],
          "order_index": 2,
          "xp_reward": 5
        }
      ]
    }
  ]
}
```

- [ ] **Step 3: chapter-02-stacks.json 생성**

```json
{
  "course_slug": "data-structures",
  "slug": "stacks-and-queues",
  "title": "스택과 큐 (Stack & Queue)",
  "order_index": 2,
  "lessons": [
    {
      "slug": "stack-basics",
      "title": "스택 (Stack)",
      "order_index": 1,
      "estimated_minutes": 7,
      "xp_reward": 15,
      "concept_tags": ["stack", "lifo", "call-stack"],
      "cards": [
        {
          "title": "스택이란",
          "content": "스택(Stack)은 **LIFO (Last In, First Out)** 구조입니다. 나중에 넣은 것이 먼저 나옵니다.\n\n```\n push(A) → [A]\n push(B) → [A, B]\n push(C) → [A, B, C]\n pop()   → C 반환, [A, B]\n```\n\n**실생활 예:** 브라우저 뒤로가기, 함수 호출 스택, Ctrl+Z (실행취소)"
        },
        {
          "title": "스택의 시간 복잡도",
          "content": "| 연산 | 시간 복잡도 |\n|------|-------------|\n| push (추가) | O(1) |\n| pop (제거) | O(1) |\n| peek (최상단 조회) | O(1) |\n| 탐색 | O(n) |\n\n스택은 push/pop 모두 O(1)이라 매우 효율적입니다."
        },
        {
          "title": "콜 스택 (Call Stack)",
          "content": "JavaScript 엔진은 함수 호출을 스택으로 관리합니다.\n\n```javascript\nfunction a() { b() }\nfunction b() { c() }\nfunction c() { console.log('hello') }\na()\n```\n\n```\n콜 스택: [a] → [a, b] → [a, b, c] → [a, b] → [a] → []\n```\n\n재귀 함수가 너무 깊으면 **Stack Overflow** 발생!"
        }
      ],
      "problems": [
        {
          "type": "fill_blank",
          "content": {
            "question": "스택은 ___ (Last In, First Out) 구조로, push와 pop 연산의 시간 복잡도는 모두 ___입니다.",
            "blank_count": 2
          },
          "correct_answer": ["LIFO", "O(1)"],
          "hint": "스택은 접시 쌓기와 같습니다.",
          "concept_tags": ["stack", "lifo"],
          "order_index": 1,
          "xp_reward": 5
        },
        {
          "type": "drag_order",
          "content": {
            "question": "스택에 A, B, C를 순서대로 push한 후 pop을 2번 했을 때 순서를 맞추세요.",
            "items": ["C가 먼저 pop됨", "B가 다음 pop됨", "스택에 A만 남음"]
          },
          "correct_answer": ["C가 먼저 pop됨", "B가 다음 pop됨", "스택에 A만 남음"],
          "hint": null,
          "concept_tags": ["stack", "lifo"],
          "order_index": 2,
          "xp_reward": 5
        },
        {
          "type": "logic_flow",
          "content": {
            "question": "괄호 유효성 검사 알고리즘 (스택 사용)",
            "steps": ["문자열을 왼쪽부터 순회", "___", "닫는 괄호면 스택 top과 비교 후 pop 또는 invalid"],
            "blank_index": 1,
            "options": ["여는 괄호면 스택에 push", "닫는 괄호면 스택에 push", "모든 괄호를 스택에 push"]
          },
          "correct_answer": ["여는 괄호면 스택에 push"],
          "hint": "여는 괄호는 저장하고, 닫는 괄호가 올 때 짝을 확인합니다.",
          "concept_tags": ["stack"],
          "order_index": 3,
          "xp_reward": 5
        }
      ]
    },
    {
      "slug": "queue-basics",
      "title": "큐 (Queue)",
      "order_index": 2,
      "estimated_minutes": 6,
      "xp_reward": 15,
      "concept_tags": ["queue", "fifo", "bfs"],
      "cards": [
        {
          "title": "큐란",
          "content": "큐(Queue)는 **FIFO (First In, First Out)** 구조입니다. 먼저 넣은 것이 먼저 나옵니다.\n\n```\nenqueue(A) → [A]\nenqueue(B) → [A, B]\nenqueue(C) → [A, B, C]\ndequeue()  → A 반환, [B, C]\n```\n\n**실생활 예:** 줄 서기, 프린터 인쇄 대기열, BFS 탐색"
        },
        {
          "title": "큐 vs 스택",
          "content": "| | 스택 | 큐 |\n|--|------|----|\n| 원리 | LIFO | FIFO |\n| 추가 | push (위) | enqueue (뒤) |\n| 제거 | pop (위) | dequeue (앞) |\n| 활용 | 실행취소, DFS | BFS, 대기열 |"
        }
      ],
      "problems": [
        {
          "type": "fill_blank",
          "content": {
            "question": "큐는 ___ (First In, First Out) 구조로, 먼저 들어온 데이터가 먼저 나갑니다.",
            "blank_count": 1
          },
          "correct_answer": ["FIFO"],
          "hint": "줄 서기처럼 먼저 온 사람이 먼저 처리됩니다.",
          "concept_tags": ["queue", "fifo"],
          "order_index": 1,
          "xp_reward": 5
        },
        {
          "type": "logic_flow",
          "content": {
            "question": "BFS(너비 우선 탐색)에서 큐 활용 흐름",
            "steps": ["시작 노드를 큐에 enqueue", "___", "꺼낸 노드의 미방문 인접 노드를 모두 enqueue"],
            "blank_index": 1,
            "options": ["큐에서 노드를 dequeue하고 방문 처리", "스택에서 노드를 pop하고 방문 처리", "가장 깊은 노드부터 방문"]
          },
          "correct_answer": ["큐에서 노드를 dequeue하고 방문 처리"],
          "hint": "BFS는 큐, DFS는 스택(또는 재귀)을 사용합니다.",
          "concept_tags": ["queue", "bfs"],
          "order_index": 2,
          "xp_reward": 5
        }
      ]
    }
  ]
}
```

- [ ] **Step 4: chapter-03-hash-tables.json 생성**

```json
{
  "course_slug": "data-structures",
  "slug": "hash-tables",
  "title": "해시 테이블 (Hash Tables)",
  "order_index": 3,
  "lessons": [
    {
      "slug": "hash-table-basics",
      "title": "해시 테이블이란",
      "order_index": 1,
      "estimated_minutes": 8,
      "xp_reward": 15,
      "concept_tags": ["hash-table", "hash-function", "key-value"],
      "cards": [
        {
          "title": "해시 테이블의 정의",
          "content": "해시 테이블은 **키(key)→값(value)** 쌍을 저장하는 자료구조입니다.\n\n**동작 원리:**\n1. key를 해시 함수에 입력\n2. 해시 함수가 배열 인덱스 반환\n3. 해당 인덱스에 value 저장\n\nJavaScript의 `Object`, `Map`이 해시 테이블입니다."
        },
        {
          "title": "해시 테이블의 시간 복잡도",
          "content": "| 연산 | 평균 | 최악 |\n|------|------|------|\n| 삽입 | O(1) | O(n) |\n| 조회 | O(1) | O(n) |\n| 삭제 | O(1) | O(n) |\n\n최악의 경우는 해시 충돌(collision)이 많을 때 발생합니다."
        },
        {
          "title": "해시 충돌 (Hash Collision)",
          "content": "다른 key가 같은 인덱스를 가리킬 때 **충돌**이 발생합니다.\n\n**해결 방법:**\n1. **체이닝 (Chaining):** 같은 인덱스에 연결 리스트로 여러 값 저장\n2. **개방 주소법 (Open Addressing):** 충돌 시 다음 빈 슬롯 탐색\n\n좋은 해시 함수는 충돌을 최소화합니다."
        }
      ],
      "problems": [
        {
          "type": "fill_blank",
          "content": {
            "question": "해시 테이블에서 key로 value를 조회하는 평균 시간 복잡도는 ___입니다.",
            "blank_count": 1
          },
          "correct_answer": ["O(1)"],
          "hint": "해시 함수가 인덱스를 바로 계산해주므로 매우 빠릅니다.",
          "concept_tags": ["hash-table", "time-complexity"],
          "order_index": 1,
          "xp_reward": 5
        },
        {
          "type": "logic_flow",
          "content": {
            "question": "해시 테이블에서 key로 value를 저장하는 과정",
            "steps": ["key를 해시 함수에 입력", "___", "해당 인덱스 위치에 value 저장"],
            "blank_index": 1,
            "options": ["해시 함수가 배열 인덱스 반환", "해시 함수가 value를 반환", "해시 함수가 key를 정렬"]
          },
          "correct_answer": ["해시 함수가 배열 인덱스 반환"],
          "hint": null,
          "concept_tags": ["hash-table", "hash-function"],
          "order_index": 2,
          "xp_reward": 5
        },
        {
          "type": "drag_order",
          "content": {
            "question": "체이닝(Chaining)으로 해시 충돌을 처리하는 과정을 순서대로 정렬하세요.",
            "items": ["같은 인덱스에 이미 값이 있음을 확인", "해당 인덱스의 연결 리스트 끝에 새 값 추가", "이후 조회 시 연결 리스트를 순회하며 key 비교"]
          },
          "correct_answer": ["같은 인덱스에 이미 값이 있음을 확인", "해당 인덱스의 연결 리스트 끝에 새 값 추가", "이후 조회 시 연결 리스트를 순회하며 key 비교"],
          "hint": null,
          "concept_tags": ["hash-table", "collision"],
          "order_index": 3,
          "xp_reward": 5
        }
      ]
    }
  ]
}
```

- [ ] **Step 5: 커밋**

```bash
git add data/
git commit -m "feat: add content JSON files for data structures (3 chapters)"
```

---

## Task 7: 시드 스크립트

**Files:**
- Create: `scripts/seed.ts`

- [ ] **Step 1: 스크립트 생성**

```typescript
// scripts/seed.ts
import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('환경변수 필요: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

interface CourseJson {
  slug: string
  title: string
  description: string
  icon: string
  order_index: number
}

interface ProblemJson {
  type: 'fill_blank' | 'drag_order' | 'logic_flow'
  content: unknown
  correct_answer: string[]
  hint?: string | null
  concept_tags: string[]
  order_index: number
  xp_reward: number
}

interface LessonJson {
  slug: string
  title: string
  order_index: number
  estimated_minutes: number
  xp_reward: number
  concept_tags: string[]
  cards: Array<{ title: string; content: string }>
  problems: ProblemJson[]
}

interface ChapterJson {
  course_slug: string
  slug: string
  title: string
  order_index: number
  lessons: LessonJson[]
}

async function seedCourses(courses: CourseJson[]) {
  console.log('📚 Seeding courses...')
  const { error } = await supabase
    .from('courses')
    .upsert(courses, { onConflict: 'slug' })
  if (error) throw error
  console.log(`  ✓ ${courses.length}개 코스`)
}

async function seedChapter(chapter: ChapterJson) {
  const { data: course, error: ce } = await supabase
    .from('courses')
    .select('id')
    .eq('slug', chapter.course_slug)
    .single()
  if (ce || !course) throw new Error(`코스 없음: ${chapter.course_slug}`)

  const { data: ch, error: che } = await supabase
    .from('chapters')
    .upsert(
      { course_id: course.id, slug: chapter.slug, title: chapter.title, order_index: chapter.order_index },
      { onConflict: 'slug' }
    )
    .select('id')
    .single()
  if (che || !ch) throw che ?? new Error('chapter upsert failed')

  for (const lesson of chapter.lessons) {
    const { data: ls, error: le } = await supabase
      .from('lessons')
      .upsert(
        {
          chapter_id: ch.id,
          slug: lesson.slug,
          title: lesson.title,
          cards: lesson.cards,
          concept_tags: lesson.concept_tags,
          order_index: lesson.order_index,
          xp_reward: lesson.xp_reward,
          estimated_minutes: lesson.estimated_minutes,
        },
        { onConflict: 'slug' }
      )
      .select('id')
      .single()
    if (le || !ls) throw le ?? new Error('lesson upsert failed')

    for (const problem of lesson.problems) {
      const { error: pe } = await supabase
        .from('problems')
        .upsert(
          {
            lesson_id: ls.id,
            type: problem.type,
            content: problem.content,
            correct_answer: problem.correct_answer,
            hint: problem.hint ?? null,
            concept_tags: problem.concept_tags,
            order_index: problem.order_index,
            xp_reward: problem.xp_reward,
          },
          { onConflict: 'lesson_id,order_index' }
        )
      if (pe) throw pe
    }
    console.log(`  ✓ ${lesson.slug} (문제 ${lesson.problems.length}개)`)
  }
}

async function main() {
  const dataDir = join(process.cwd(), 'data')

  const courses: CourseJson[] = JSON.parse(
    readFileSync(join(dataDir, 'courses.json'), 'utf8')
  )
  await seedCourses(courses)

  const subdirs = readdirSync(dataDir)
    .filter(f => statSync(join(dataDir, f)).isDirectory())
    .sort()

  for (const dir of subdirs) {
    const files = readdirSync(join(dataDir, dir))
      .filter(f => f.endsWith('.json'))
      .sort()

    for (const file of files) {
      const chapter: ChapterJson = JSON.parse(
        readFileSync(join(dataDir, dir, file), 'utf8')
      )
      console.log(`\n📖 챕터: ${chapter.slug}`)
      await seedChapter(chapter)
    }
  }

  console.log('\n✅ 시드 완료!')
}

main().catch(err => {
  console.error('시드 실패:', err)
  process.exit(1)
})
```

- [ ] **Step 2: package.json에 seed 스크립트 추가**

`package.json`의 `scripts` 섹션에 추가:

```json
"seed": "tsx --env-file=.env.local scripts/seed.ts"
```

- [ ] **Step 3: 커밋**

```bash
git add scripts/seed.ts package.json
git commit -m "feat: add seed script"
```

---

## Task 8: 시드 실행 및 검증

- [ ] **Step 1: 시드 실행**

```bash
npm run seed
```

Expected 출력:
```
📚 Seeding courses...
  ✓ 4개 코스

📖 챕터: arrays
  ✓ array-basics (문제 3개)
  ✓ dynamic-arrays (문제 2개)

📖 챕터: stacks-and-queues
  ✓ stack-basics (문제 3개)
  ✓ queue-basics (문제 2개)

📖 챕터: hash-tables
  ✓ hash-table-basics (문제 3개)

✅ 시드 완료!
```

오류 발생 시: Supabase 대시보드 Table Editor에서 스키마 migration이 적용됐는지 확인.

- [ ] **Step 2: Supabase 대시보드에서 데이터 확인**

- courses 테이블: 4개 행 (data-structures, algorithms, os, network)
- chapters 테이블: 3개 행 (arrays, stacks-and-queues, hash-tables)
- lessons 테이블: 5개 행
- problems 테이블: 13개 행

- [ ] **Step 3: 전체 테스트 통과 확인**

```bash
npm test
```

Expected: All tests pass

- [ ] **Step 4: Phase 1 완료 커밋**

```bash
git add -A
git commit -m "feat: complete phase 1 - db setup, utilities, seed"
```
