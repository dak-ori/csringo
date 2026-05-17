# Phase 2: 레슨 플로우 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 카드 캐러셀 → 3종 문제 풀기 → 레슨 완료까지의 전체 레슨 플로우를 구현한다.

**Architecture:** 서버 컴포넌트(`learn/` 페이지들)가 Supabase에서 데이터 fetch. `LessonView` 클라이언트 컴포넌트가 cards→problems→complete 상태 머신 관리. 채점/완료는 Route Handler(`/api/learning/*`)가 처리.

**Tech Stack:** Next.js 15 App Router, @dnd-kit (drag_order), Supabase, Vitest + @testing-library

**전제조건:** Phase 1 완료 (DB 스키마 업데이트, 시드 데이터 존재)

---

## Task 9: shadcn 컴포넌트 추가 + 로그아웃 API

**Files:**
- Add: `components/ui/input.tsx`, `components/ui/progress.tsx` (shadcn)
- Create: `app/api/auth/signout/route.ts`

- [ ] **Step 1: shadcn input, progress 설치**

```bash
npx shadcn add input progress
```

Expected: `components/ui/input.tsx`, `components/ui/progress.tsx` 생성됨.

- [ ] **Step 2: 로그아웃 Route Handler 생성**

```typescript
// app/api/auth/signout/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_SUPABASE_URL!.replace('supabase.co', 'vercel.app') || 'http://localhost:3000'), {
    status: 302,
  })
}
```

실제로는 절대 URL이 필요하므로 아래처럼:

```typescript
// app/api/auth/signout/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

export async function POST() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const proto = headersList.get('x-forwarded-proto') ?? 'http'
  return NextResponse.redirect(`${proto}://${host}/login`, { status: 302 })
}
```

- [ ] **Step 3: 커밋**

```bash
git add app/api/auth/signout/route.ts components/ui/input.tsx components/ui/progress.tsx
git commit -m "feat: add signout API and shadcn input/progress components"
```

---

## Task 10: 코스 목록 페이지

**Files:**
- Create: `app/(protected)/learn/page.tsx`

- [ ] **Step 1: 파일 생성**

```typescript
// app/(protected)/learn/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Course } from '@/lib/types/lesson'

export default async function LearnPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: courses } = await supabase
    .from('courses')
    .select('id, slug, title, description, icon, order_index')
    .order('order_index')

  return (
    <main className="max-w-lg mx-auto px-4 pt-8 pb-24">
      <h1 className="text-2xl font-bold mb-6">학습</h1>
      <div className="space-y-3">
        {(courses as Course[] ?? []).map(course => (
          <Link
            key={course.id}
            href={`/learn/${course.slug}`}
            className="flex items-center gap-4 p-4 rounded-xl border hover:bg-muted transition-colors"
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

- [ ] **Step 2: 개발 서버 실행 후 `/learn` 접속 확인**

```bash
npm run dev
```

브라우저에서 `http://localhost:3000/learn` → 4개 코스 목록이 보여야 함.

- [ ] **Step 3: 커밋**

```bash
git add app/(protected)/learn/page.tsx
git commit -m "feat: add course list page"
```

---

## Task 11: 챕터+레슨 목록 페이지

**Files:**
- Create: `app/(protected)/learn/[course]/page.tsx`

- [ ] **Step 1: 파일 생성**

```typescript
// app/(protected)/learn/[course]/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
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
    .select(`
      id, slug, title, order_index,
      lessons (id, slug, title, estimated_minutes, order_index)
    `)
    .eq('course_id', course.id)
    .order('order_index')

  // 완료된 레슨 ID 목록
  const { data: progress } = await supabase
    .from('user_progress')
    .select('lesson_id')
    .eq('user_id', user.id)
    .eq('status', 'completed')

  const completedIds = new Set(progress?.map(p => p.lesson_id) ?? [])

  return (
    <main className="max-w-lg mx-auto px-4 pt-8 pb-24">
      <div className="flex items-center gap-2 mb-6">
        <span className="text-2xl">{course.icon}</span>
        <h1 className="text-2xl font-bold">{course.title}</h1>
      </div>

      <div className="space-y-6">
        {(chapters ?? []).map(chapter => {
          const lessons = (chapter.lessons as Array<{
            id: string; slug: string; title: string; estimated_minutes: number; order_index: number
          }>).sort((a, b) => a.order_index - b.order_index)

          return (
            <div key={chapter.id}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {chapter.title}
              </h2>
              <div className="space-y-2">
                {lessons.map(lesson => {
                  const done = completedIds.has(lesson.id)
                  return (
                    <Link
                      key={lesson.id}
                      href={`/learn/${courseSlug}/${chapter.slug}/${lesson.slug}`}
                      className="flex items-center justify-between p-4 rounded-xl border hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{done ? '✅' : '📖'}</span>
                        <div>
                          <p className="font-medium">{lesson.title}</p>
                          <p className="text-xs text-muted-foreground">{lesson.estimated_minutes}분</p>
                        </div>
                      </div>
                      <span className="text-muted-foreground">›</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </main>
  )
}
```

- [ ] **Step 2: `/learn/data-structures` 접속 확인**

챕터 3개, 레슨 5개가 보여야 함.

- [ ] **Step 3: 커밋**

```bash
git add "app/(protected)/learn/[course]/page.tsx"
git commit -m "feat: add chapter and lesson list page"
```

---

## Task 12: 레슨 서버 컴포넌트

**Files:**
- Create: `app/(protected)/learn/[course]/[chapter]/[lesson]/page.tsx`

- [ ] **Step 1: 파일 생성**

```typescript
// app/(protected)/learn/[course]/[chapter]/[lesson]/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import LessonView from '@/components/lesson/lesson-view'
import type { Card, Problem } from '@/lib/types/lesson'

interface Props {
  params: Promise<{ course: string; chapter: string; lesson: string }>
}

export default async function LessonPage({ params }: Props) {
  const { lesson: lessonSlug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: lesson } = await supabase
    .from('lessons')
    .select('id, title, cards')
    .eq('slug', lessonSlug)
    .single()

  if (!lesson) notFound()

  const { data: problems } = await supabase
    .from('problems')
    .select('id, type, content, correct_answer, hint, concept_tags, order_index, xp_reward')
    .eq('lesson_id', lesson.id)
    .order('order_index')

  return (
    <main className="min-h-screen">
      <div className="max-w-lg mx-auto px-4 pt-4">
        <h1 className="text-lg font-semibold mb-4">{lesson.title}</h1>
      </div>
      <LessonView
        lessonId={lesson.id}
        cards={lesson.cards as Card[]}
        problems={(problems ?? []) as Problem[]}
      />
    </main>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add "app/(protected)/learn/[course]/[chapter]/[lesson]/page.tsx"
git commit -m "feat: add lesson server component page"
```

---

## Task 13: CardCarousel 컴포넌트

**Files:**
- Create: `components/lesson/card-carousel.tsx`

- [ ] **Step 1: 파일 생성**

```typescript
// components/lesson/card-carousel.tsx
'use client'

import { useState } from 'react'
import type { Card } from '@/lib/types/lesson'

interface Props {
  cards: Card[]
  onComplete: () => void
}

export default function CardCarousel({ cards, onComplete }: Props) {
  const [index, setIndex] = useState(0)
  const card = cards[index]
  const isLast = index === cards.length - 1

  function formatContent(content: string) {
    // 마크다운 테이블/코드블록 기본 처리 (whitespace-pre-wrap)
    return content
  }

  return (
    <div className="max-w-lg mx-auto px-4 pb-24">
      {/* 진행 바 */}
      <div className="flex gap-1 mb-6">
        {cards.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= index ? 'bg-primary' : 'bg-muted'
            }`}
          />
        ))}
      </div>

      {/* 카드 */}
      <div className="rounded-2xl border bg-card p-6 min-h-64">
        <h2 className="text-lg font-bold mb-4">{card.title}</h2>
        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
          {formatContent(card.content)}
        </p>
      </div>

      {/* 버튼 */}
      <div className="mt-6 flex gap-3">
        {index > 0 && (
          <button
            onClick={() => setIndex(i => i - 1)}
            className="flex-1 py-3 rounded-xl border hover:bg-muted transition-colors"
          >
            이전
          </button>
        )}
        <button
          onClick={() => isLast ? onComplete() : setIndex(i => i + 1)}
          className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-medium"
        >
          {isLast ? '문제 풀기 →' : '다음'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add components/lesson/card-carousel.tsx
git commit -m "feat: add CardCarousel component"
```

---

## Task 14: ProblemFeedback 컴포넌트

**Files:**
- Create: `components/lesson/problems/problem-feedback.tsx`

- [ ] **Step 1: 파일 생성**

```typescript
// components/lesson/problems/problem-feedback.tsx

interface Props {
  correct: boolean
  xpEarned?: number
  hint: string | null
  onNext: () => void
}

export default function ProblemFeedback({ correct, xpEarned, hint, onNext }: Props) {
  return (
    <div
      className={`fixed bottom-16 left-0 right-0 border-t p-4 ${
        correct ? 'bg-green-50 border-green-200 dark:bg-green-950' : 'bg-red-50 border-red-200 dark:bg-red-950'
      }`}
    >
      <div className="max-w-lg mx-auto">
        {correct ? (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">✓</span>
            <span className="font-bold text-green-700 dark:text-green-300">
              정답이에요! {xpEarned ? `+${xpEarned} XP` : ''}
            </span>
          </div>
        ) : (
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">✗</span>
              <span className="font-bold text-red-700 dark:text-red-300">틀렸어요</span>
            </div>
            {hint && (
              <p className="text-sm text-red-600 dark:text-red-400 ml-7">{hint}</p>
            )}
          </div>
        )}
        <button
          onClick={onNext}
          className={`w-full py-3 rounded-xl font-medium text-white ${
            correct ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          계속
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add components/lesson/problems/problem-feedback.tsx
git commit -m "feat: add ProblemFeedback component"
```

---

## Task 15: FillBlankProblem (TDD)

**Files:**
- Create: `__tests__/components/problems/fill-blank-problem.test.tsx`
- Create: `components/lesson/problems/fill-blank-problem.tsx`

- [ ] **Step 1: 테스트 작성**

```typescript
// __tests__/components/problems/fill-blank-problem.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FillBlankProblem from '@/components/lesson/problems/fill-blank-problem'
import type { Problem } from '@/lib/types/lesson'

const mockProblem: Problem = {
  id: 'p1',
  lesson_id: 'l1',
  type: 'fill_blank',
  content: { question: '배열 접근 시간 복잡도는 ___입니다.', blank_count: 1 },
  correct_answer: ['O(1)'],
  hint: '매우 빠릅니다.',
  concept_tags: [],
  order_index: 1,
  xp_reward: 5,
}

describe('FillBlankProblem', () => {
  it('빈칸 input이 렌더링된다', () => {
    render(<FillBlankProblem problem={mockProblem} onSubmit={vi.fn()} disabled={false} />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('빈칸 비어있으면 제출 버튼 비활성화', () => {
    render(<FillBlankProblem problem={mockProblem} onSubmit={vi.fn()} disabled={false} />)
    expect(screen.getByRole('button', { name: '제출' })).toBeDisabled()
  })

  it('입력 후 제출 시 onSubmit 호출', () => {
    const onSubmit = vi.fn()
    render(<FillBlankProblem problem={mockProblem} onSubmit={onSubmit} disabled={false} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'O(1)' } })
    fireEvent.click(screen.getByRole('button', { name: '제출' }))
    expect(onSubmit).toHaveBeenCalledWith(['O(1)'])
  })

  it('disabled일 때 input과 버튼 비활성화', () => {
    render(<FillBlankProblem problem={mockProblem} onSubmit={vi.fn()} disabled={true} />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npm test -- fill-blank
```

Expected: FAIL

- [ ] **Step 3: 구현**

```typescript
// components/lesson/problems/fill-blank-problem.tsx
'use client'

import { useState } from 'react'
import type { Problem, FillBlankContent } from '@/lib/types/lesson'

interface Props {
  problem: Problem
  onSubmit: (answer: string[]) => void
  disabled: boolean
}

export default function FillBlankProblem({ problem, onSubmit, disabled }: Props) {
  const content = problem.content as FillBlankContent
  const [answers, setAnswers] = useState<string[]>(
    Array(content.blank_count).fill('')
  )

  const parts = content.question.split('___')
  const allFilled = answers.every(a => a.trim().length > 0)

  return (
    <div className="space-y-6">
      <div className="text-base leading-relaxed">
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < parts.length - 1 && (
              <input
                type="text"
                value={answers[i]}
                onChange={e => {
                  const next = [...answers]
                  next[i] = e.target.value
                  setAnswers(next)
                }}
                disabled={disabled}
                className="inline-block border-b-2 border-primary bg-transparent text-center w-20 mx-1 outline-none disabled:opacity-60"
                aria-label={`빈칸 ${i + 1}`}
              />
            )}
          </span>
        ))}
      </div>
      <button
        onClick={() => onSubmit(answers)}
        disabled={disabled || !allFilled}
        className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-50"
      >
        제출
      </button>
    </div>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm test -- fill-blank
```

Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add __tests__/components/problems/fill-blank-problem.test.tsx components/lesson/problems/fill-blank-problem.tsx
git commit -m "feat: add FillBlankProblem with tests"
```

---

## Task 16: DragOrderProblem (TDD)

**Files:**
- Create: `__tests__/components/problems/drag-order-problem.test.tsx`
- Create: `components/lesson/problems/drag-order-problem.tsx`

- [ ] **Step 1: 테스트 작성**

```typescript
// __tests__/components/problems/drag-order-problem.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DragOrderProblem from '@/components/lesson/problems/drag-order-problem'
import type { Problem } from '@/lib/types/lesson'

const mockProblem: Problem = {
  id: 'p1',
  lesson_id: 'l1',
  type: 'drag_order',
  content: { question: '순서를 맞추세요.', items: ['A', 'B', 'C'] },
  correct_answer: ['A', 'B', 'C'],
  hint: null,
  concept_tags: [],
  order_index: 1,
  xp_reward: 5,
}

describe('DragOrderProblem', () => {
  it('아이템들이 렌더링된다', () => {
    render(<DragOrderProblem problem={mockProblem} onSubmit={vi.fn()} disabled={false} />)
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText('C')).toBeInTheDocument()
  })

  it('제출 버튼이 있다', () => {
    render(<DragOrderProblem problem={mockProblem} onSubmit={vi.fn()} disabled={false} />)
    expect(screen.getByRole('button', { name: '제출' })).toBeInTheDocument()
  })

  it('제출 클릭 시 현재 순서로 onSubmit 호출', () => {
    const onSubmit = vi.fn()
    render(<DragOrderProblem problem={mockProblem} onSubmit={onSubmit} disabled={false} />)
    fireEvent.click(screen.getByRole('button', { name: '제출' }))
    expect(onSubmit).toHaveBeenCalledWith(['A', 'B', 'C'])
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npm test -- drag-order
```

Expected: FAIL

- [ ] **Step 3: 구현**

```typescript
// components/lesson/problems/drag-order-problem.tsx
'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Problem, DragOrderContent } from '@/lib/types/lesson'

interface SortableItemProps {
  id: string
  value: string
  disabled: boolean
}

function SortableItem({ id, value, disabled }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id,
    disabled,
  })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className="flex items-center gap-3 p-3 bg-card border rounded-xl cursor-grab active:cursor-grabbing"
    >
      <span className="text-muted-foreground select-none">⋮⋮</span>
      <span>{value}</span>
    </div>
  )
}

interface Props {
  problem: Problem
  onSubmit: (answer: string[]) => void
  disabled: boolean
}

export default function DragOrderProblem({ problem, onSubmit, disabled }: Props) {
  const content = problem.content as DragOrderContent
  const [items, setItems] = useState(
    content.items.map((value, i) => ({ id: `item-${i}`, value }))
  )
  const sensors = useSensors(useSensor(PointerSensor))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setItems(prev => {
        const oldIdx = prev.findIndex(i => i.id === active.id)
        const newIdx = prev.findIndex(i => i.id === over.id)
        return arrayMove(prev, oldIdx, newIdx)
      })
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-base">{content.question}</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map(item => (
              <SortableItem key={item.id} id={item.id} value={item.value} disabled={disabled} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <button
        onClick={() => onSubmit(items.map(i => i.value))}
        disabled={disabled}
        className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-50"
      >
        제출
      </button>
    </div>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm test -- drag-order
```

Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add __tests__/components/problems/drag-order-problem.test.tsx components/lesson/problems/drag-order-problem.tsx
git commit -m "feat: add DragOrderProblem with dnd-kit and tests"
```

---

## Task 17: LogicFlowProblem (TDD)

**Files:**
- Create: `__tests__/components/problems/logic-flow-problem.test.tsx`
- Create: `components/lesson/problems/logic-flow-problem.tsx`

- [ ] **Step 1: 테스트 작성**

```typescript
// __tests__/components/problems/logic-flow-problem.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LogicFlowProblem from '@/components/lesson/problems/logic-flow-problem'
import type { Problem } from '@/lib/types/lesson'

const mockProblem: Problem = {
  id: 'p1',
  lesson_id: 'l1',
  type: 'logic_flow',
  content: {
    question: 'TCP 연결 수립 순서',
    steps: ['SYN', '___', 'ACK'],
    blank_index: 1,
    options: ['SYN-ACK', 'FIN', 'RST'],
  },
  correct_answer: ['SYN-ACK'],
  hint: null,
  concept_tags: [],
  order_index: 1,
  xp_reward: 5,
}

describe('LogicFlowProblem', () => {
  it('스텝과 보기가 렌더링된다', () => {
    render(<LogicFlowProblem problem={mockProblem} onSubmit={vi.fn()} disabled={false} />)
    expect(screen.getByText('SYN')).toBeInTheDocument()
    expect(screen.getByText('ACK')).toBeInTheDocument()
    expect(screen.getByText('SYN-ACK')).toBeInTheDocument()
    expect(screen.getByText('FIN')).toBeInTheDocument()
  })

  it('선택 전 제출 버튼 비활성화', () => {
    render(<LogicFlowProblem problem={mockProblem} onSubmit={vi.fn()} disabled={false} />)
    expect(screen.getByRole('button', { name: '제출' })).toBeDisabled()
  })

  it('보기 선택 후 제출 시 onSubmit 호출', () => {
    const onSubmit = vi.fn()
    render(<LogicFlowProblem problem={mockProblem} onSubmit={onSubmit} disabled={false} />)
    fireEvent.click(screen.getByText('SYN-ACK'))
    fireEvent.click(screen.getByRole('button', { name: '제출' }))
    expect(onSubmit).toHaveBeenCalledWith(['SYN-ACK'])
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npm test -- logic-flow
```

Expected: FAIL

- [ ] **Step 3: 구현**

```typescript
// components/lesson/problems/logic-flow-problem.tsx
'use client'

import { useState } from 'react'
import type { Problem, LogicFlowContent } from '@/lib/types/lesson'

interface Props {
  problem: Problem
  onSubmit: (answer: string[]) => void
  disabled: boolean
}

export default function LogicFlowProblem({ problem, onSubmit, disabled }: Props) {
  const content = problem.content as LogicFlowContent
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <p className="text-base font-medium">{content.question}</p>

      {/* 플로우 스텝 */}
      <div className="space-y-1">
        {content.steps.map((step, i) => (
          <div key={i}>
            {i > 0 && <div className="w-px h-3 bg-border ml-5" />}
            <div
              className={`p-3 rounded-xl border ${
                i === content.blank_index
                  ? 'border-dashed border-primary bg-primary/5'
                  : 'bg-muted'
              }`}
            >
              {i === content.blank_index ? (
                selected ? (
                  <span className="text-primary font-medium">{selected}</span>
                ) : (
                  <span className="text-muted-foreground">?</span>
                )
              ) : (
                <span>{step}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 보기 */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground font-medium">보기에서 선택하세요</p>
        {content.options.map((option, i) => (
          <button
            key={i}
            onClick={() => !disabled && setSelected(option)}
            disabled={disabled}
            className={`w-full p-3 rounded-xl border text-left transition-colors ${
              selected === option
                ? 'border-primary bg-primary/10'
                : 'hover:bg-muted'
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      <button
        onClick={() => selected && onSubmit([selected])}
        disabled={disabled || !selected}
        className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-50"
      >
        제출
      </button>
    </div>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm test -- logic-flow
```

Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add __tests__/components/problems/logic-flow-problem.test.tsx components/lesson/problems/logic-flow-problem.tsx
git commit -m "feat: add LogicFlowProblem with tests"
```

---

## Task 18: LessonComplete 컴포넌트

**Files:**
- Create: `components/lesson/lesson-complete.tsx`

- [ ] **Step 1: 파일 생성**

```typescript
// components/lesson/lesson-complete.tsx
import Link from 'next/link'
import type { CompleteResult } from '@/lib/types/lesson'
import { calculateLevel } from '@/lib/xp'

interface Props {
  result: CompleteResult
}

export default function LessonComplete({ result }: Props) {
  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center p-6 z-50">
      <div className="text-6xl mb-4">🎉</div>
      <h2 className="text-2xl font-bold mb-2">레슨 완료!</h2>

      <div className="flex gap-6 my-6 text-center">
        <div>
          <p className="text-3xl font-bold text-primary">+{result.xp_earned}</p>
          <p className="text-sm text-muted-foreground">XP 획득</p>
        </div>
        <div>
          <p className="text-3xl font-bold text-orange-500">{result.streak}</p>
          <p className="text-sm text-muted-foreground">일 연속</p>
        </div>
        <div>
          <p className="text-3xl font-bold">Lv.{result.new_level}</p>
          <p className="text-sm text-muted-foreground">레벨</p>
        </div>
      </div>

      {result.leveled_up && (
        <div className="mb-6 px-4 py-2 bg-yellow-100 dark:bg-yellow-900 rounded-xl text-yellow-700 dark:text-yellow-200 text-sm font-medium">
          ⭐ 레벨업! Lv.{result.new_level} 달성
        </div>
      )}

      <div className="flex gap-3 w-full max-w-xs">
        <Link
          href="/learn"
          className="flex-1 py-3 rounded-xl border text-center hover:bg-muted transition-colors"
        >
          다음 레슨
        </Link>
        <Link
          href="/dashboard"
          className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-center font-medium"
        >
          대시보드
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add components/lesson/lesson-complete.tsx
git commit -m "feat: add LessonComplete overlay component"
```

---

## Task 19: LessonView 상태 머신

**Files:**
- Create: `components/lesson/lesson-view.tsx`

- [ ] **Step 1: 파일 생성**

```typescript
// components/lesson/lesson-view.tsx
'use client'

import { useState } from 'react'
import type { Card, Problem, SubmitResult, CompleteResult } from '@/lib/types/lesson'
import CardCarousel from './card-carousel'
import LessonComplete from './lesson-complete'
import FillBlankProblem from './problems/fill-blank-problem'
import DragOrderProblem from './problems/drag-order-problem'
import LogicFlowProblem from './problems/logic-flow-problem'
import ProblemFeedback from './problems/problem-feedback'
import Link from 'next/link'

type Phase = 'cards' | 'problems' | 'complete'

interface Props {
  lessonId: string
  cards: Card[]
  problems: Problem[]
}

export default function LessonView({ lessonId, cards, problems }: Props) {
  const [phase, setPhase] = useState<Phase>('cards')
  const [problemIndex, setProblemIndex] = useState(0)
  const [feedback, setFeedback] = useState<SubmitResult | null>(null)
  const [heartsRemaining, setHeartsRemaining] = useState<number | null>(null)
  const [completeResult, setCompleteResult] = useState<CompleteResult | null>(null)

  const currentProblem = problems[problemIndex]

  async function handleProblemSubmit(answer: string[]) {
    const res = await fetch('/api/learning/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problem_id: currentProblem.id, user_answer: answer }),
    })
    const result: SubmitResult = await res.json()
    setFeedback(result)
    if (!result.correct && result.hearts_remaining !== undefined) {
      setHeartsRemaining(result.hearts_remaining)
    }
  }

  async function handleNext() {
    setFeedback(null)
    const isLastProblem = problemIndex + 1 >= problems.length

    if (isLastProblem) {
      const res = await fetch('/api/learning/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lesson_id: lessonId }),
      })
      const result: CompleteResult = await res.json()
      setCompleteResult(result)
      setPhase('complete')
      // fire-and-forget: 복습 큐 생성 트리거 (ADR 0002)
      fetch('/api/review/generate', { method: 'POST' })
    } else {
      setProblemIndex(i => i + 1)
    }
  }

  if (phase === 'cards') {
    return <CardCarousel cards={cards} onComplete={() => setPhase('problems')} />
  }

  if (phase === 'complete' && completeResult) {
    return <LessonComplete result={completeResult} />
  }

  // 하트 소진
  if (heartsRemaining === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <p className="text-5xl mb-4">💔</p>
        <h2 className="text-xl font-bold mb-2">하트가 부족해요</h2>
        <p className="text-muted-foreground mb-6">4시간마다 하트가 1개씩 충전됩니다.</p>
        <Link href="/dashboard" className="py-3 px-6 rounded-xl bg-primary text-primary-foreground">
          대시보드로
        </Link>
      </div>
    )
  }

  // problems phase
  return (
    <div className="max-w-lg mx-auto px-4 pb-40">
      <div className="flex items-center justify-between mb-6">
        <span className="text-sm text-muted-foreground">
          {problemIndex + 1} / {problems.length}
        </span>
        {heartsRemaining !== null && (
          <span className="text-sm">{'❤️'.repeat(heartsRemaining)}{'🖤'.repeat(5 - heartsRemaining)}</span>
        )}
      </div>

      {currentProblem.type === 'fill_blank' && (
        <FillBlankProblem
          problem={currentProblem}
          onSubmit={handleProblemSubmit}
          disabled={feedback !== null}
        />
      )}
      {currentProblem.type === 'drag_order' && (
        <DragOrderProblem
          problem={currentProblem}
          onSubmit={handleProblemSubmit}
          disabled={feedback !== null}
        />
      )}
      {currentProblem.type === 'logic_flow' && (
        <LogicFlowProblem
          problem={currentProblem}
          onSubmit={handleProblemSubmit}
          disabled={feedback !== null}
        />
      )}

      {feedback && (
        <ProblemFeedback
          correct={feedback.correct}
          xpEarned={feedback.xp_earned}
          hint={currentProblem.hint}
          onNext={handleNext}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add components/lesson/lesson-view.tsx
git commit -m "feat: add LessonView state machine (cards→problems→complete)"
```

---

## Task 20: /api/learning/submit Route Handler

**Files:**
- Create: `app/api/learning/submit/route.ts`

- [ ] **Step 1: 파일 생성**

```typescript
// app/api/learning/submit/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateCurrentHearts } from '@/lib/hearts'

function gradeAnswer(userAnswer: string[], correctAnswer: string[]): boolean {
  if (userAnswer.length !== correctAnswer.length) return false
  return userAnswer.every(
    (ans, i) => ans.trim().toLowerCase() === correctAnswer[i].trim().toLowerCase()
  )
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body?.problem_id || !Array.isArray(body?.user_answer)) {
    return NextResponse.json({ error: 'problem_id and user_answer required' }, { status: 400 })
  }

  const { problem_id, user_answer } = body as { problem_id: string; user_answer: string[] }

  const { data: problem } = await supabase
    .from('problems')
    .select('id, correct_answer, xp_reward, hint')
    .eq('id', problem_id)
    .single()

  if (!problem) return NextResponse.json({ error: 'Problem not found' }, { status: 404 })

  const isCorrect = gradeAnswer(user_answer, problem.correct_answer as string[])

  if (isCorrect) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('total_xp')
      .eq('id', user.id)
      .single()

    const newXp = (profile?.total_xp ?? 0) + problem.xp_reward

    await Promise.all([
      supabase.from('profiles').update({ total_xp: newXp }).eq('id', user.id),
      supabase.from('xp_logs').insert({
        user_id: user.id,
        amount: problem.xp_reward,
        reason: 'correct_answer',
        reference_id: problem_id,
      }),
    ])

    return NextResponse.json({ correct: true, xp_earned: problem.xp_reward })
  }

  // 오답 처리
  const { data: profile } = await supabase
    .from('profiles')
    .select('hearts, hearts_last_refill')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const currentHearts = calculateCurrentHearts(
    profile.hearts,
    new Date(profile.hearts_last_refill)
  )
  const newHearts = Math.max(0, currentHearts - 1)

  // wrong_answers: 기존 카운트 조회 후 upsert
  const { data: existing } = await supabase
    .from('wrong_answers')
    .select('wrong_count')
    .eq('user_id', user.id)
    .eq('problem_id', problem_id)
    .maybeSingle()

  await Promise.all([
    supabase
      .from('profiles')
      .update({ hearts: newHearts, hearts_last_refill: new Date().toISOString() })
      .eq('id', user.id),
    supabase.from('wrong_answers').upsert(
      {
        user_id: user.id,
        problem_id,
        user_answer,
        wrong_count: (existing?.wrong_count ?? 0) + 1,
        last_wrong_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,problem_id' }
    ),
  ])

  return NextResponse.json({ correct: false, hearts_remaining: newHearts })
}
```

- [ ] **Step 2: 커밋**

```bash
git add app/api/learning/submit/route.ts
git commit -m "feat: add /api/learning/submit route handler"
```

---

## Task 21: /api/learning/complete Route Handler

**Files:**
- Create: `app/api/learning/complete/route.ts`

- [ ] **Step 1: 파일 생성**

```typescript
// app/api/learning/complete/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateLevel } from '@/lib/xp'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body?.lesson_id) {
    return NextResponse.json({ error: 'lesson_id required' }, { status: 400 })
  }

  const { lesson_id } = body as { lesson_id: string }

  const { data: lesson } = await supabase
    .from('lessons')
    .select('xp_reward')
    .eq('id', lesson_id)
    .single()

  if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('total_xp, streak, last_lesson_date')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // KST 기준 오늘/어제 날짜 계산
  const todayKST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
  const yesterdayKST = new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA', {
    timeZone: 'Asia/Seoul',
  })

  let newStreak = profile.streak
  if (profile.last_lesson_date === todayKST) {
    // 오늘 이미 완료 → 스트릭 변화 없음
  } else if (profile.last_lesson_date === yesterdayKST) {
    newStreak += 1
  } else {
    newStreak = 1
  }

  const oldXp = profile.total_xp
  const newXp = oldXp + lesson.xp_reward
  const oldLevel = calculateLevel(oldXp)
  const newLevel = calculateLevel(newXp)

  await Promise.all([
    supabase
      .from('profiles')
      .update({ total_xp: newXp, streak: newStreak, last_lesson_date: todayKST })
      .eq('id', user.id),
    supabase.from('user_progress').upsert(
      {
        user_id: user.id,
        lesson_id,
        status: 'completed',
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,lesson_id' }
    ),
    supabase.from('xp_logs').insert({
      user_id: user.id,
      amount: lesson.xp_reward,
      reason: 'lesson_complete',
      reference_id: lesson_id,
    }),
  ])

  return NextResponse.json({
    xp_earned: lesson.xp_reward,
    total_xp: newXp,
    streak: newStreak,
    leveled_up: newLevel > oldLevel,
    new_level: newLevel,
  })
}
```

- [ ] **Step 2: 레슨 플로우 E2E 수동 테스트**

1. `npm run dev` 실행
2. `/learn/data-structures/arrays/array-basics` 접속
3. 카드 3장 넘기기
4. 3개 문제 풀기 (정답/오답 모두 테스트)
5. 완료 화면 확인

- [ ] **Step 3: Phase 2 완료 커밋**

```bash
git add app/api/learning/complete/route.ts
git commit -m "feat: complete phase 2 - full lesson flow"
```
