# 마이크로 레슨 시스템 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 코스 목록 → 챕터/레슨 목록 → 레슨 카드 뷰 → 문제 풀기 → 완료 처리까지 핵심 학습 루프를 구현한다.

**Architecture:** 서버 컴포넌트(코스·챕터·레슨 페이지)가 Supabase에서 데이터를 fetch해 클라이언트 컴포넌트(LessonView)에 props로 전달한다. 문제 제출(POST /api/learning/submit)과 레슨 완료(POST /api/learning/complete)는 Route Handler가 처리하며, LessonView에서 fetch()로 호출한다.

**Tech Stack:** Next.js 16 App Router, Supabase(@supabase/ssr), @dnd-kit/core + @dnd-kit/sortable, Vitest + @testing-library/react

---

## File Structure

### 신규 생성

| 파일 | 역할 |
|------|------|
| `lib/types/lesson.ts` | 레슨·카드·문제 공유 타입 |
| `app/(protected)/learn/page.tsx` | 코스 목록 (Server) |
| `app/(protected)/learn/[course]/page.tsx` | 코스 상세: 챕터 + 레슨 목록 (Server) |
| `app/(protected)/learn/[course]/[chapter]/[lesson]/page.tsx` | 레슨 데이터 fetch + LessonView 렌더 (Server) |
| `components/lesson/card-carousel.tsx` | 카드 슬라이드 (Client) |
| `components/lesson/problems/fill-blank-problem.tsx` | 빈칸 채우기 문제 UI (Client) |
| `components/lesson/problems/drag-order-problem.tsx` | 드래그 순서 배열 문제 UI (Client) |
| `components/lesson/lesson-complete.tsx` | 레슨 완료 오버레이 (Client) |
| `components/lesson/lesson-view.tsx` | 전체 레슨 흐름 조율 (Client) |
| `app/api/learning/submit/route.ts` | 문제 채점 API |
| `app/api/learning/complete/route.ts` | 레슨 완료 처리 API |
| `__tests__/components/lesson/card-carousel.test.tsx` | |
| `__tests__/components/lesson/fill-blank-problem.test.tsx` | |
| `__tests__/app/api/learning/submit.test.ts` | |
| `__tests__/app/api/learning/complete.test.ts` | |

### 수정

| 파일 | 변경 내용 |
|------|---------|
| `app/(protected)/dashboard/page.tsx` | "오늘의 레슨" 플레이스홀더 → /learn 링크 버튼 |

---

## Task 1: 타입 정의 + 코스 목록 페이지

**Files:**
- Create: `lib/types/lesson.ts`
- Create: `app/(protected)/learn/page.tsx`

- [ ] **Step 1: 타입 파일 작성**

`lib/types/lesson.ts`:
```typescript
export type CardType = 'concept' | 'example' | 'code' | 'comparison'

export interface LessonCard {
  type: CardType
  title: string
  body: string
}

export type ProblemType = 'fill_blank' | 'drag_order' | 'logic_flow'

export interface Problem {
  id: string
  type: ProblemType
  content: {
    question: string
    blank_count?: number
    items?: string[]
  }
  correct_answer: string[]
  hint: string | null
  concept_tags: string[]
  order_index: number
  xp_reward: number
}

export interface Lesson {
  id: string
  title: string
  cards: LessonCard[]
  concept_tags: string[]
  order_index: number
  xp_reward: number
  estimated_minutes: number
  problems: Problem[]
}

export interface Course {
  id: string
  slug: string
  title: string
  description: string | null
  icon: string | null
  order_index: number
}
```

- [ ] **Step 2: 코스 목록 페이지 작성**

`app/(protected)/learn/page.tsx`:
```typescript
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function LearnPage() {
  const supabase = await createClient()

  const { data: courses } = await supabase
    .from('courses')
    .select('id, slug, title, description, icon, order_index')
    .order('order_index')

  return (
    <main className="max-w-lg mx-auto px-4 pt-8 pb-24 space-y-4">
      <h1 className="text-2xl font-bold">학습</h1>
      <div className="space-y-3">
        {courses?.map(course => (
          <Link
            key={course.id}
            href={`/learn/${course.slug}`}
            className="flex items-center gap-4 rounded-xl border p-4 hover:bg-muted transition-colors"
          >
            <span className="text-3xl">{course.icon}</span>
            <div>
              <p className="font-semibold">{course.title}</p>
              {course.description && (
                <p className="text-sm text-muted-foreground">{course.description}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}
```

- [ ] **Step 3: 빌드 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 4: Commit**

```bash
git add lib/types/lesson.ts app/(protected)/learn/page.tsx
git commit -m "feat: add lesson types and course list page"
```

---

## Task 2: 코스 상세 페이지 (챕터 + 레슨 목록)

**Files:**
- Create: `app/(protected)/learn/[course]/page.tsx`

- [ ] **Step 1: 코스 상세 페이지 작성**

`app/(protected)/learn/[course]/page.tsx`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import Link from 'next/link'

interface Props {
  params: Promise<{ course: string }>
}

export default async function CoursePage({ params }: Props) {
  const { course: courseSlug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: course } = await supabase
    .from('courses')
    .select('id, slug, title, icon')
    .eq('slug', courseSlug)
    .single()

  if (!course) notFound()

  const { data: chapters } = await supabase
    .from('chapters')
    .select('id, title, order_index, lessons(id, title, order_index, xp_reward, estimated_minutes)')
    .eq('course_id', course.id)
    .order('order_index')
    .order('order_index', { referencedTable: 'lessons' })

  const { data: progress } = await supabase
    .from('user_progress')
    .select('lesson_id, status')
    .eq('user_id', user.id)

  const progressMap = new Map(progress?.map(p => [p.lesson_id, p.status]) ?? [])

  return (
    <main className="max-w-lg mx-auto px-4 pt-8 pb-24 space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-3xl">{course.icon}</span>
        <h1 className="text-2xl font-bold">{course.title}</h1>
      </div>
      <div className="space-y-6">
        {chapters?.map(chapter => (
          <div key={chapter.id} className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {chapter.title}
            </h2>
            <div className="space-y-2">
              {(chapter.lessons as { id: string; title: string; order_index: number; xp_reward: number; estimated_minutes: number }[] | null)?.map(lesson => {
                const status = progressMap.get(lesson.id)
                return (
                  <Link
                    key={lesson.id}
                    href={`/learn/${courseSlug}/${chapter.id}/${lesson.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted transition-colors"
                  >
                    <div>
                      <p className="font-medium">{lesson.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {lesson.estimated_minutes}분 · {lesson.xp_reward} XP
                      </p>
                    </div>
                    <span className="text-lg">
                      {status === 'completed' ? '✅' : status === 'started' ? '▶️' : '○'}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
```

- [ ] **Step 2: 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 3: Commit**

```bash
git add app/(protected)/learn/
git commit -m "feat: add course detail page with chapters and lessons"
```

---

## Task 3: 카드 캐러셀 컴포넌트 + 테스트

**Files:**
- Create: `__tests__/components/lesson/card-carousel.test.tsx`
- Create: `components/lesson/card-carousel.tsx`

- [ ] **Step 1: 테스트 작성**

`__tests__/components/lesson/card-carousel.test.tsx`:
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CardCarousel } from '@/components/lesson/card-carousel'
import type { LessonCard } from '@/lib/types/lesson'

const cards: LessonCard[] = [
  { type: 'concept', title: '스택이란?', body: 'LIFO 구조입니다' },
  { type: 'example', title: '예시', body: '접시 쌓기' },
]

describe('CardCarousel', () => {
  it('renders the first card title', () => {
    render(<CardCarousel cards={cards} onComplete={vi.fn()} />)
    expect(screen.getByText('스택이란?')).toBeInTheDocument()
  })

  it('advances to the next card on button click', () => {
    render(<CardCarousel cards={cards} onComplete={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '다음' }))
    expect(screen.getByText('예시')).toBeInTheDocument()
  })

  it('calls onComplete when the last card is confirmed', () => {
    const onComplete = vi.fn()
    render(<CardCarousel cards={cards} onComplete={onComplete} />)
    fireEvent.click(screen.getByRole('button', { name: '다음' }))
    fireEvent.click(screen.getByRole('button', { name: '문제 풀기' }))
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('shows progress indicators equal to card count', () => {
    const { container } = render(<CardCarousel cards={cards} onComplete={vi.fn()} />)
    const bars = container.querySelectorAll('[data-progress-bar]')
    expect(bars).toHaveLength(2)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npm test __tests__/components/lesson/card-carousel.test.tsx
```

Expected: FAIL — `CardCarousel` not found

- [ ] **Step 3: 컴포넌트 구현**

`components/lesson/card-carousel.tsx`:
```typescript
'use client'

import { useState } from 'react'
import type { LessonCard } from '@/lib/types/lesson'
import { cn } from '@/lib/utils'

interface Props {
  cards: LessonCard[]
  initialIndex?: number
  onComplete: () => void
}

export function CardCarousel({ cards, initialIndex = 0, onComplete }: Props) {
  const [index, setIndex] = useState(initialIndex)
  const card = cards[index]
  const isLast = index === cards.length - 1

  function handleNext() {
    if (isLast) {
      onComplete()
    } else {
      setIndex(i => i + 1)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {cards.map((_, i) => (
          <div
            key={i}
            data-progress-bar
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              i <= index ? 'bg-primary' : 'bg-muted'
            )}
          />
        ))}
      </div>
      <div className="rounded-xl border p-6 min-h-48 space-y-3">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{card.type}</p>
        <h2 className="text-lg font-semibold">{card.title}</h2>
        <p className="text-sm leading-relaxed whitespace-pre-line">{card.body}</p>
      </div>
      <button
        onClick={handleNext}
        className="w-full rounded-lg bg-primary text-primary-foreground py-3 font-semibold"
      >
        {isLast ? '문제 풀기' : '다음'}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: 테스트 성공 확인**

```bash
npm test __tests__/components/lesson/card-carousel.test.tsx
```

Expected: 4/4 PASS

- [ ] **Step 5: Commit**

```bash
git add components/lesson/card-carousel.tsx __tests__/components/lesson/card-carousel.test.tsx
git commit -m "feat: add card carousel component with TDD"
```

---

## Task 4: Fill-blank 문제 UI + 테스트

**Files:**
- Create: `__tests__/components/lesson/fill-blank-problem.test.tsx`
- Create: `components/lesson/problems/fill-blank-problem.tsx`

shadcn Input 컴포넌트 추가 필요.

- [ ] **Step 1: shadcn Input 추가**

```bash
npx shadcn add input
```

Expected: `components/ui/input.tsx` 생성됨

- [ ] **Step 2: 테스트 작성**

`__tests__/components/lesson/fill-blank-problem.test.tsx`:
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { FillBlankProblem } from '@/components/lesson/problems/fill-blank-problem'
import type { Problem } from '@/lib/types/lesson'

const problem: Problem = {
  id: 'p1',
  type: 'fill_blank',
  content: { question: '스택은 ___ 구조입니다', blank_count: 1 },
  correct_answer: ['LIFO'],
  hint: 'Last In First Out',
  concept_tags: ['stack'],
  order_index: 1,
  xp_reward: 5,
}

describe('FillBlankProblem', () => {
  it('renders question with blank input', () => {
    render(<FillBlankProblem problem={problem} onSubmit={vi.fn()} />)
    expect(screen.getByText(/스택은/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('?')).toBeInTheDocument()
  })

  it('shows hint text', () => {
    render(<FillBlankProblem problem={problem} onSubmit={vi.fn()} />)
    expect(screen.getByText(/Last In First Out/)).toBeInTheDocument()
  })

  it('submit button is disabled when input is empty', () => {
    render(<FillBlankProblem problem={problem} onSubmit={vi.fn()} />)
    expect(screen.getByRole('button', { name: '제출' })).toBeDisabled()
  })

  it('calls onSubmit with entered value when submitted', () => {
    const onSubmit = vi.fn()
    render(<FillBlankProblem problem={problem} onSubmit={onSubmit} />)
    fireEvent.change(screen.getByPlaceholderText('?'), { target: { value: 'LIFO' } })
    fireEvent.click(screen.getByRole('button', { name: '제출' }))
    expect(onSubmit).toHaveBeenCalledWith(['LIFO'])
  })
})
```

- [ ] **Step 3: 테스트 실패 확인**

```bash
npm test __tests__/components/lesson/fill-blank-problem.test.tsx
```

Expected: FAIL — `FillBlankProblem` not found

- [ ] **Step 4: 컴포넌트 구현**

`components/lesson/problems/fill-blank-problem.tsx`:
```typescript
'use client'

import { useState } from 'react'
import type { Problem } from '@/lib/types/lesson'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Props {
  problem: Problem
  onSubmit: (answer: string[]) => void
  disabled?: boolean
}

export function FillBlankProblem({ problem, onSubmit, disabled = false }: Props) {
  const blankCount = problem.content.blank_count ?? 1
  const [answers, setAnswers] = useState<string[]>(Array(blankCount).fill(''))

  const parts = problem.content.question.split('___')

  function updateAnswer(index: number, value: string) {
    const next = [...answers]
    next[index] = value
    setAnswers(next)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground font-medium">빈칸 채우기</p>
      <div className="rounded-xl border p-5 space-y-4">
        <div className="text-base leading-loose flex flex-wrap items-center gap-1">
          {parts.map((part, i) => (
            <span key={i} className="flex items-center gap-1">
              <span>{part}</span>
              {i < parts.length - 1 && (
                <Input
                  className="w-28 h-8 text-center inline-block"
                  value={answers[i] ?? ''}
                  onChange={e => updateAnswer(i, e.target.value)}
                  disabled={disabled}
                  placeholder="?"
                />
              )}
            </span>
          ))}
        </div>
        {problem.hint && (
          <p className="text-xs text-muted-foreground">💡 힌트: {problem.hint}</p>
        )}
      </div>
      <Button
        className="w-full"
        onClick={() => onSubmit(answers)}
        disabled={disabled || answers.some(a => a.trim() === '')}
      >
        제출
      </Button>
    </div>
  )
}
```

- [ ] **Step 5: 테스트 성공 확인**

```bash
npm test __tests__/components/lesson/fill-blank-problem.test.tsx
```

Expected: 4/4 PASS

- [ ] **Step 6: Commit**

```bash
git add components/ui/input.tsx components/lesson/problems/fill-blank-problem.tsx __tests__/components/lesson/fill-blank-problem.test.tsx
git commit -m "feat: add fill-blank problem UI with TDD"
```

---

## Task 5: Drag-order 문제 UI + @dnd-kit 설치

**Files:**
- Create: `components/lesson/problems/drag-order-problem.tsx`

테스트는 @dnd-kit가 JSDOM에서 pointer event를 지원하지 않아 유닛 테스트 생략. LessonView 통합 시 수동으로 검증한다.

- [ ] **Step 1: @dnd-kit 패키지 설치**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: 컴포넌트 구현**

`components/lesson/problems/drag-order-problem.tsx`:
```typescript
'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Problem } from '@/lib/types/lesson'
import { Button } from '@/components/ui/button'
import { GripVertical } from 'lucide-react'

interface SortableItemProps {
  id: string
  label: string
  disabled: boolean
}

function SortableItem({ id, label, disabled }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id, disabled })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex items-center gap-2 rounded-lg border bg-background p-3"
    >
      <GripVertical
        className="h-4 w-4 text-muted-foreground shrink-0 cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      />
      <span className="text-sm">{label}</span>
    </div>
  )
}

interface Props {
  problem: Problem
  onSubmit: (answer: string[]) => void
  disabled?: boolean
}

export function DragOrderProblem({ problem, onSubmit, disabled = false }: Props) {
  const [order, setOrder] = useState<string[]>(() => [...(problem.content.items ?? [])])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setOrder(prev => {
        const from = prev.indexOf(active.id as string)
        const to = prev.indexOf(over.id as string)
        return arrayMove(prev, from, to)
      })
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground font-medium">순서 배열</p>
      <div className="rounded-xl border p-5 space-y-3">
        <p className="text-base">{problem.content.question}</p>
        {problem.hint && (
          <p className="text-xs text-muted-foreground">💡 힌트: {problem.hint}</p>
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {order.map(item => (
                <SortableItem key={item} id={item} label={item} disabled={disabled} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
      <Button className="w-full" onClick={() => onSubmit(order)} disabled={disabled}>
        제출
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 4: Commit**

```bash
git add components/lesson/problems/drag-order-problem.tsx package.json package-lock.json
git commit -m "feat: add drag-order problem UI with @dnd-kit"
```

---

## Task 6: 문제 제출 API + 테스트

**Files:**
- Create: `__tests__/app/api/learning/submit.test.ts`
- Create: `app/api/learning/submit/route.ts`

**API 동작:**
- 인증 없으면 401
- `problem_id`, `answer` 없으면 400
- 정답: `{ correct: true, xp_earned: N, hearts: N, total_xp: N }`
- 오답: `{ correct: false, xp_earned: 0, hearts: N-1, total_xp: N }`
- 오답 시 `wrong_answers` upsert (wrong_count 증가), `profiles.hearts` 감소

- [ ] **Step 1: 테스트 작성**

`__tests__/app/api/learning/submit.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

function makeSupabaseMock({
  user = { id: 'user-1' },
  problem = { correct_answer: ['LIFO'], xp_reward: 5, concept_tags: ['stack'] },
  profile = { hearts: 5, total_xp: 100 },
  updatedProfile = { hearts: 5, total_xp: 105 },
}: {
  user?: { id: string } | null
  problem?: object | null
  profile?: object
  updatedProfile?: object
} = {}) {
  const single = vi.fn()
  const eq = vi.fn(() => ({ single }))
  const select = vi.fn(() => ({ eq, single }))
  const update = vi.fn(() => ({ eq }))
  const insert = vi.fn(() => Promise.resolve({}))
  const upsert = vi.fn(() => Promise.resolve({}))

  let callCount = 0
  single.mockImplementation(() => {
    callCount++
    if (callCount === 1) return Promise.resolve({ data: problem })
    if (callCount === 2) return Promise.resolve({ data: profile })
    return Promise.resolve({ data: updatedProfile })
  })

  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => ({ select, update, insert, upsert })),
  }
}

describe('POST /api/learning/submit', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns 401 if not authenticated', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeSupabaseMock({ user: null }) as never)

    const { POST } = await import('@/app/api/learning/submit/route')
    const req = new Request('http://localhost/api/learning/submit', {
      method: 'POST',
      body: JSON.stringify({ problem_id: 'p1', answer: ['LIFO'] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns correct:true for a correct answer', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseMock({ updatedProfile: { hearts: 5, total_xp: 105 } }) as never
    )

    const { POST } = await import('@/app/api/learning/submit/route')
    const req = new Request('http://localhost/api/learning/submit', {
      method: 'POST',
      body: JSON.stringify({ problem_id: 'p1', answer: ['LIFO'] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.correct).toBe(true)
    expect(body.xp_earned).toBe(5)
  })

  it('returns correct:false for a wrong answer', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseMock({ updatedProfile: { hearts: 4, total_xp: 100 } }) as never
    )

    const { POST } = await import('@/app/api/learning/submit/route')
    const req = new Request('http://localhost/api/learning/submit', {
      method: 'POST',
      body: JSON.stringify({ problem_id: 'p1', answer: ['FIFO'] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.correct).toBe(false)
    expect(body.xp_earned).toBe(0)
    expect(body.hearts).toBe(4)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npm test __tests__/app/api/learning/submit.test.ts
```

Expected: FAIL — route not found

- [ ] **Step 3: API 구현**

`app/api/learning/submit/route.ts`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

function isCorrect(correctAnswer: string[], userAnswer: string[]): boolean {
  if (correctAnswer.length !== userAnswer.length) return false
  return correctAnswer.every(
    (ca, i) => ca.toLowerCase() === (userAnswer[i] ?? '').trim().toLowerCase()
  )
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { problem_id, answer } = body as { problem_id?: string; answer?: string[] }
  if (!problem_id || !Array.isArray(answer)) {
    return NextResponse.json({ error: 'problem_id and answer required' }, { status: 400 })
  }

  const { data: problem } = await supabase
    .from('problems')
    .select('correct_answer, xp_reward, concept_tags')
    .eq('id', problem_id)
    .single()
  if (!problem) return NextResponse.json({ error: 'Problem not found' }, { status: 404 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('hearts, total_xp')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const correct = isCorrect(problem.correct_answer as string[], answer)
  let xp_earned = 0

  if (correct) {
    xp_earned = problem.xp_reward as number
    await supabase
      .from('profiles')
      .update({ total_xp: (profile.total_xp as number) + xp_earned })
      .eq('id', user.id)
    await supabase.from('xp_logs').insert({
      user_id: user.id,
      amount: xp_earned,
      reason: 'problem_correct',
      reference_id: problem_id,
    })
  } else {
    const newHearts = Math.max(0, (profile.hearts as number) - 1)
    await supabase.from('profiles').update({ hearts: newHearts }).eq('id', user.id)

    const { data: existing } = await supabase
      .from('wrong_answers')
      .select('id, wrong_count')
      .eq('user_id', user.id)
      .eq('problem_id', problem_id)
      .single()

    if (existing) {
      await supabase
        .from('wrong_answers')
        .update({
          wrong_count: (existing.wrong_count as number) + 1,
          last_wrong_at: new Date().toISOString(),
          user_answer: answer,
        })
        .eq('id', existing.id)
    } else {
      await supabase.from('wrong_answers').insert({
        user_id: user.id,
        problem_id,
        user_answer: answer,
        wrong_count: 1,
      })
    }
  }

  const { data: updated } = await supabase
    .from('profiles')
    .select('hearts, total_xp')
    .eq('id', user.id)
    .single()

  return NextResponse.json({
    correct,
    xp_earned,
    hearts: updated?.hearts ?? 0,
    total_xp: updated?.total_xp ?? 0,
  })
}
```

- [ ] **Step 4: 테스트 성공 확인**

```bash
npm test __tests__/app/api/learning/submit.test.ts
```

Expected: 3/3 PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/learning/submit/route.ts __tests__/app/api/learning/submit.test.ts
git commit -m "feat: add problem submit API with TDD"
```

---

## Task 7: 레슨 완료 API + 레슨 완료 오버레이 + 테스트

**Files:**
- Create: `__tests__/app/api/learning/complete.test.ts`
- Create: `app/api/learning/complete/route.ts`
- Create: `components/lesson/lesson-complete.tsx`

**API 동작:**
- 인증 없으면 401
- `lesson_id` 없으면 400
- 이미 completed이면 XP 0 (중복 지급 방지)
- `user_progress` upsert (status: 'completed')
- 스트릭: 어제 레슨 있으면 +1, 오늘 이미 레슨 있으면 유지, 그 외 1로 리셋
- XP 지급 + `xp_logs` 삽입
- 반환: `{ xp_earned, total_xp, streak, level }`

- [ ] **Step 1: 테스트 작성**

`__tests__/app/api/learning/complete.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

function makeSupabaseMock({
  user = { id: 'user-1' },
  lesson = { xp_reward: 15 },
  profile = { total_xp: 0, streak: 0, last_lesson_date: null, hearts: 5 },
  existingProgress = null as { status: string } | null,
}: {
  user?: { id: string } | null
  lesson?: object | null
  profile?: object
  existingProgress?: { status: string } | null
} = {}) {
  let singleCall = 0
  const single = vi.fn().mockImplementation(() => {
    singleCall++
    if (singleCall === 1) return Promise.resolve({ data: lesson })
    if (singleCall === 2) return Promise.resolve({ data: profile })
    return Promise.resolve({ data: existingProgress })
  })
  const eq = vi.fn(() => ({ single, eq }))
  const select = vi.fn(() => ({ eq, single }))
  const update = vi.fn(() => ({ eq }))
  const insert = vi.fn(() => Promise.resolve({}))
  const upsert = vi.fn(() => Promise.resolve({}))

  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => ({ select, update, insert, upsert })),
  }
}

describe('POST /api/learning/complete', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns 401 if not authenticated', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeSupabaseMock({ user: null }) as never)

    const { POST } = await import('@/app/api/learning/complete/route')
    const req = new Request('http://localhost/api/learning/complete', {
      method: 'POST',
      body: JSON.stringify({ lesson_id: 'l1' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('awards XP and returns streak for first completion', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeSupabaseMock() as never)

    const { POST } = await import('@/app/api/learning/complete/route')
    const req = new Request('http://localhost/api/learning/complete', {
      method: 'POST',
      body: JSON.stringify({ lesson_id: 'l1' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.xp_earned).toBe(15)
    expect(body.streak).toBe(1)
  })

  it('does not award XP if lesson already completed', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseMock({ existingProgress: { status: 'completed' } }) as never
    )

    const { POST } = await import('@/app/api/learning/complete/route')
    const req = new Request('http://localhost/api/learning/complete', {
      method: 'POST',
      body: JSON.stringify({ lesson_id: 'l1' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json()
    expect(body.xp_earned).toBe(0)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npm test __tests__/app/api/learning/complete.test.ts
```

Expected: FAIL

- [ ] **Step 3: 완료 API 구현**

`app/api/learning/complete/route.ts`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

function calculateLevel(xp: number): number {
  if (xp < 100) return 1
  if (xp < 300) return 2
  if (xp < 600) return 3
  return 4 + Math.floor((xp - 600) / 400)
}

function todayKST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function yesterdayKST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000 - 86_400_000).toISOString().slice(0, 10)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { lesson_id } = body as { lesson_id?: string }
  if (!lesson_id) return NextResponse.json({ error: 'lesson_id required' }, { status: 400 })

  const { data: lesson } = await supabase
    .from('lessons')
    .select('xp_reward')
    .eq('id', lesson_id)
    .single()
  if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('total_xp, streak, last_lesson_date, hearts')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Check if already completed (prevent double XP)
  const { data: existingProgress } = await supabase
    .from('user_progress')
    .select('status')
    .eq('user_id', user.id)
    .eq('lesson_id', lesson_id)
    .single()

  const wasAlreadyCompleted = existingProgress?.status === 'completed'
  const xp_earned = wasAlreadyCompleted ? 0 : (lesson.xp_reward as number)

  // Streak calculation (KST)
  const today = todayKST()
  const yesterday = yesterdayKST()
  const lastDate = profile.last_lesson_date as string | null
  const alreadyDoneToday = lastDate === today

  let newStreak = profile.streak as number
  if (!alreadyDoneToday) {
    newStreak = lastDate === yesterday ? (profile.streak as number) + 1 : 1
  }

  const newXp = (profile.total_xp as number) + xp_earned
  const newLevel = calculateLevel(newXp)

  await supabase
    .from('user_progress')
    .upsert(
      { user_id: user.id, lesson_id, status: 'completed', completed_at: new Date().toISOString() },
      { onConflict: 'user_id,lesson_id' }
    )

  await supabase
    .from('profiles')
    .update({ total_xp: newXp, streak: newStreak, last_lesson_date: today })
    .eq('id', user.id)

  if (xp_earned > 0) {
    await supabase.from('xp_logs').insert({
      user_id: user.id,
      amount: xp_earned,
      reason: 'lesson_complete',
      reference_id: lesson_id,
    })
  }

  return NextResponse.json({ xp_earned, total_xp: newXp, streak: newStreak, level: newLevel })
}
```

- [ ] **Step 4: 테스트 성공 확인**

```bash
npm test __tests__/app/api/learning/complete.test.ts
```

Expected: 3/3 PASS

- [ ] **Step 5: 레슨 완료 오버레이 컴포넌트 작성**

`components/lesson/lesson-complete.tsx`:
```typescript
'use client'

interface Props {
  xpEarned: number
  totalXp: number
  streak: number
  onDashboard: () => void
  onNextLesson: () => void
}

export function LessonComplete({ xpEarned, totalXp, streak, onDashboard, onNextLesson }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 px-4">
      <div className="text-6xl">🎉</div>
      <div className="space-y-1">
        <h2 className="text-2xl font-bold">레슨 완료!</h2>
        <p className="text-muted-foreground">오늘도 한 걸음 나아갔어요</p>
      </div>
      <div className="flex gap-8">
        <div>
          <p className="text-3xl font-bold text-primary">+{xpEarned}</p>
          <p className="text-xs text-muted-foreground mt-1">XP 획득</p>
        </div>
        <div>
          <p className="text-3xl font-bold">🔥 {streak}</p>
          <p className="text-xs text-muted-foreground mt-1">일 연속</p>
        </div>
      </div>
      <div className="w-full space-y-2">
        <button
          onClick={onNextLesson}
          className="w-full rounded-lg bg-primary text-primary-foreground py-3 font-semibold"
        >
          다음 레슨
        </button>
        <button
          onClick={onDashboard}
          className="w-full rounded-lg border py-3 font-semibold"
        >
          대시보드로
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add app/api/learning/complete/route.ts components/lesson/lesson-complete.tsx __tests__/app/api/learning/complete.test.ts
git commit -m "feat: add lesson complete API and completion overlay with TDD"
```

---

## Task 8: LessonView + 레슨 페이지 + 대시보드 업데이트

**Files:**
- Create: `components/lesson/lesson-view.tsx`
- Create: `app/(protected)/learn/[course]/[chapter]/[lesson]/page.tsx`
- Modify: `app/(protected)/dashboard/page.tsx`

- [ ] **Step 1: LessonView 조율 컴포넌트 작성**

`components/lesson/lesson-view.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Lesson } from '@/lib/types/lesson'
import { CardCarousel } from '@/components/lesson/card-carousel'
import { FillBlankProblem } from '@/components/lesson/problems/fill-blank-problem'
import { DragOrderProblem } from '@/components/lesson/problems/drag-order-problem'
import { LessonComplete } from '@/components/lesson/lesson-complete'

type Phase = 'cards' | 'problems' | 'complete'

interface CompletionData {
  xp_earned: number
  total_xp: number
  streak: number
  level: number
}

interface Feedback {
  correct: boolean
  xp_earned: number
  hearts: number
}

interface Props {
  lesson: Lesson
  courseSlug: string
  chapterId: string
}

export function LessonView({ lesson, courseSlug, chapterId }: Props) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('cards')
  const [problemIndex, setProblemIndex] = useState(0)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [hearts, setHearts] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [completion, setCompletion] = useState<CompletionData | null>(null)

  async function handleSubmit(answer: string[]) {
    if (submitting) return
    setSubmitting(true)
    const problem = lesson.problems[problemIndex]
    const res = await fetch('/api/learning/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problem_id: problem.id, answer }),
    })
    const data = await res.json()
    setHearts(data.hearts)
    setFeedback({ correct: data.correct, xp_earned: data.xp_earned, hearts: data.hearts })
    setSubmitting(false)
  }

  async function handleNextProblem() {
    setFeedback(null)
    if (problemIndex < lesson.problems.length - 1) {
      setProblemIndex(i => i + 1)
      return
    }
    // All problems done — complete lesson
    const res = await fetch('/api/learning/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lesson_id: lesson.id }),
    })
    const data = await res.json()
    setCompletion(data)
    setPhase('complete')
  }

  if (phase === 'complete' && completion) {
    return (
      <LessonComplete
        xpEarned={completion.xp_earned}
        totalXp={completion.total_xp}
        streak={completion.streak}
        onDashboard={() => router.push('/dashboard')}
        onNextLesson={() => router.push(`/learn/${courseSlug}/${chapterId}`)}
      />
    )
  }

  if (phase === 'cards') {
    return (
      <CardCarousel
        cards={lesson.cards}
        onComplete={() => setPhase('problems')}
      />
    )
  }

  const problem = lesson.problems[problemIndex]
  const isDisabled = submitting || feedback !== null
  const currentHearts = hearts ?? 5

  return (
    <div className="space-y-4">
      {/* Heart display */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          문제 {problemIndex + 1} / {lesson.problems.length}
        </p>
        <div className="flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className={i < currentHearts ? '' : 'opacity-20'}>❤️</span>
          ))}
        </div>
      </div>

      {/* Problem */}
      {problem.type === 'fill_blank' && (
        <FillBlankProblem problem={problem} onSubmit={handleSubmit} disabled={isDisabled} />
      )}
      {problem.type === 'drag_order' && (
        <DragOrderProblem problem={problem} onSubmit={handleSubmit} disabled={isDisabled} />
      )}
      {problem.type === 'logic_flow' && (
        <div className="rounded-xl border p-5 text-center text-muted-foreground text-sm">
          logic_flow 문제 유형은 Phase 2에서 지원됩니다.
        </div>
      )}

      {/* Feedback */}
      {feedback && (
        <div
          className={`rounded-lg border p-4 space-y-2 ${
            feedback.correct
              ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900'
              : 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900'
          }`}
        >
          <p className="font-semibold">
            {feedback.correct ? '정답! 🎉' : '아쉬워요 😢'}
          </p>
          {feedback.correct && feedback.xp_earned > 0 && (
            <p className="text-sm text-muted-foreground">+{feedback.xp_earned} XP</p>
          )}
          {!feedback.correct && feedback.hearts === 0 && (
            <p className="text-sm text-destructive">하트가 없어요. 4시간 후 회복됩니다.</p>
          )}
          <button
            className="w-full rounded-lg bg-primary text-primary-foreground py-2 text-sm font-semibold"
            onClick={handleNextProblem}
            disabled={!feedback.correct && feedback.hearts === 0}
          >
            {!feedback.correct && feedback.hearts === 0 ? '학습 종료' : '다음'}
          </button>
          {!feedback.correct && feedback.hearts === 0 && (
            <button
              className="w-full rounded-lg border py-2 text-sm font-semibold"
              onClick={() => router.push('/dashboard')}
            >
              대시보드로
            </button>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 레슨 서버 페이지 작성**

`app/(protected)/learn/[course]/[chapter]/[lesson]/page.tsx`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import { LessonView } from '@/components/lesson/lesson-view'
import type { Lesson, LessonCard, Problem } from '@/lib/types/lesson'
import Link from 'next/link'

interface Props {
  params: Promise<{ course: string; chapter: string; lesson: string }>
}

export default async function LessonPage({ params }: Props) {
  const { course: courseSlug, chapter: chapterId, lesson: lessonId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: lessonData } = await supabase
    .from('lessons')
    .select(`
      id, title, cards, concept_tags, order_index, xp_reward, estimated_minutes,
      problems(id, type, content, correct_answer, hint, concept_tags, order_index, xp_reward)
    `)
    .eq('id', lessonId)
    .eq('chapter_id', chapterId)
    .order('order_index', { referencedTable: 'problems' })
    .single()

  if (!lessonData) notFound()

  const lesson: Lesson = {
    id: lessonData.id,
    title: lessonData.title,
    cards: lessonData.cards as LessonCard[],
    concept_tags: lessonData.concept_tags,
    order_index: lessonData.order_index,
    xp_reward: lessonData.xp_reward,
    estimated_minutes: lessonData.estimated_minutes,
    problems: (lessonData.problems as Problem[] | null) ?? [],
  }

  return (
    <main className="max-w-lg mx-auto px-4 pt-6 pb-24 space-y-6">
      <div className="space-y-1">
        <Link
          href={`/learn/${courseSlug}`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← 코스로 돌아가기
        </Link>
        <h1 className="text-xl font-bold">{lesson.title}</h1>
        <p className="text-sm text-muted-foreground">
          {lesson.estimated_minutes}분 · {lesson.xp_reward} XP
        </p>
      </div>
      <LessonView lesson={lesson} courseSlug={courseSlug} chapterId={chapterId} />
    </main>
  )
}
```

- [ ] **Step 3: 대시보드 "오늘의 레슨" 섹션 업데이트**

`app/(protected)/dashboard/page.tsx`의 플레이스홀더 div를 교체한다.

기존:
```typescript
      <div className="rounded-lg border p-6 text-center text-muted-foreground">
        오늘의 레슨 — 곧 업데이트됩니다
      </div>
```

교체:
```typescript
      <div className="space-y-3">
        <h2 className="font-semibold">오늘의 학습</h2>
        <a
          href="/learn"
          className="flex items-center justify-between rounded-xl border p-4 hover:bg-muted transition-colors"
        >
          <div>
            <p className="font-medium">학습 계속하기</p>
            <p className="text-sm text-muted-foreground">코스를 선택해 레슨을 시작하세요</p>
          </div>
          <span className="text-2xl">📚</span>
        </a>
      </div>
```

- [ ] **Step 4: 전체 테스트 실행**

```bash
npm test
```

Expected: 전체 PASS (카드 캐러셀 4개, fill-blank 4개, submit 3개, complete 3개, supabase 7개 = 21개)

- [ ] **Step 5: 빌드 확인**

```bash
npm run build
```

Expected: 오류 없이 빌드 성공

- [ ] **Step 6: 개발 서버로 전체 흐름 수동 검증**

```bash
npm run dev
```

검증 항목:
1. `/learn` — CS 기초 코스 카드 표시
2. `/learn/cs-basics` — 자료구조 챕터와 스택·큐·프로세스 레슨 표시
3. `/learn/cs-basics/{chapter-id}/{lesson-id}` — 카드 3장 표시 후 "문제 풀기" 전환
4. fill_blank 문제: 입력 후 제출 → 정답/오답 피드백
5. drag_order 문제: 드래그로 순서 변경 후 제출 → 피드백
6. 레슨 완료 화면: XP + 스트릭 표시
7. Supabase `user_progress` 테이블에 `status: 'completed'` 행 추가 확인
8. Supabase `profiles.total_xp`, `profiles.streak` 값 증가 확인

- [ ] **Step 7: Commit**

```bash
git add components/lesson/ app/(protected)/learn/ app/(protected)/dashboard/ app/api/learning/
git commit -m "feat: complete micro-lesson flow — LessonView, lesson page, dashboard link"
```
