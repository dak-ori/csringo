# 레슨 내 틀린 문제 재시도 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 레슨 마지막 문제 통과 후, 그 세션에서 틀린 문제들을 모두 맞출 때까지 반복 출제하고 완료 화면으로 이동한다.

**Architecture:** `lesson-view.tsx`의 Phase 상태 머신에 `'retry'` 단계를 추가한다. `retryQueue: Problem[]`(배열 앞이 현재 문제)로 큐를 관리하며, 정답이면 `slice(1)`, 오답이면 뒤에 다시 append한다. `/api/learning/submit`에 `is_retry` 플래그를 추가해 재시도 시 하트 차감·XP·DB 기록을 모두 생략한다.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase, Vitest, @testing-library/react

---

### Task 1: 복습 API 라우트 삭제

**Files:**
- Delete: `app/api/review/route.ts`
- Delete: `app/api/review/generate/route.ts`
- Delete: `app/api/review/complete/route.ts`

- [ ] **Step 1: 파일 삭제**

```bash
rm app/api/review/route.ts app/api/review/generate/route.ts app/api/review/complete/route.ts
rmdir app/api/review
```

- [ ] **Step 2: 삭제 확인**

```bash
ls app/api/
```

Expected: `auth/  learning/` — `review/`가 없어야 함

- [ ] **Step 3: 테스트 실행**

```bash
npm test
```

Expected: 모든 테스트 통과 (review API 관련 테스트가 없으므로 영향 없음)

- [ ] **Step 4: 커밋**

```bash
git add -A
git commit -m "chore: remove review API routes"
```

---

### Task 2: 복습 페이지·컴포넌트 삭제

**Files:**
- Delete: `app/(protected)/review/page.tsx`
- Delete: `app/(protected)/review/review-list.tsx`
- Delete: `components/review/review-item.tsx`

- [ ] **Step 1: 파일 삭제**

```bash
rm app/\(protected\)/review/page.tsx app/\(protected\)/review/review-list.tsx
rm components/review/review-item.tsx
rmdir app/\(protected\)/review components/review
```

- [ ] **Step 2: 삭제 확인**

```bash
ls app/\(protected\)/ && ls components/
```

Expected: `review/`가 두 곳 모두 없어야 함

- [ ] **Step 3: 커밋**

```bash
git add -A
git commit -m "chore: remove review page and components"
```

---

### Task 3: bottom-nav.tsx에서 복습 탭 제거 + 테스트 업데이트

**Files:**
- Modify: `components/layout/bottom-nav.tsx`
- Modify: `__tests__/components/bottom-nav.test.tsx`

- [ ] **Step 1: 테스트를 먼저 수정 (3탭 기준으로)**

`__tests__/components/bottom-nav.test.tsx`를 다음으로 교체:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BottomNav } from '@/components/layout/bottom-nav'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}))

describe('BottomNav', () => {
  it('renders 3 navigation tabs without review tab', () => {
    render(<BottomNav />)
    expect(screen.getByText('홈')).toBeInTheDocument()
    expect(screen.getByText('학습')).toBeInTheDocument()
    expect(screen.queryByText('복습')).not.toBeInTheDocument()
    expect(screen.getByText('프로필')).toBeInTheDocument()
  })

  it('highlights the active tab based on current path', () => {
    render(<BottomNav />)
    const homeLink = screen.getByRole('link', { name: /홈/i })
    expect(homeLink).toHaveClass('text-primary')
  })
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npm test -- --reporter=verbose __tests__/components/bottom-nav.test.tsx
```

Expected: FAIL — `복습` 텍스트가 여전히 존재하므로 첫 번째 케이스 실패

- [ ] **Step 3: bottom-nav.tsx 수정**

`components/layout/bottom-nav.tsx`를 다음으로 교체:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, BookOpen, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/dashboard', label: '홈', icon: Home },
  { href: '/learn', label: '학습', icon: BookOpen },
  { href: '/profile', label: '프로필', icon: User },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background">
      <div className="flex h-16 max-w-lg mx-auto">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 text-xs transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm test -- --reporter=verbose __tests__/components/bottom-nav.test.tsx
```

Expected: PASS 2 tests

- [ ] **Step 5: 커밋**

```bash
git add components/layout/bottom-nav.tsx __tests__/components/bottom-nav.test.tsx
git commit -m "feat: remove review tab from bottom nav"
```

---

### Task 4: lib/types/lesson.ts에서 ReviewQueueItem 삭제

**Files:**
- Modify: `lib/types/lesson.ts`

- [ ] **Step 1: ReviewQueueItem 인터페이스 삭제**

`lib/types/lesson.ts`에서 다음 블록을 제거:

```ts
export interface ReviewQueueItem {
  id: string
  user_id: string
  problem_id: string
  priority: number
  added_at: string
  reviewed_at: string | null
  problem?: Problem
}
```

(파일의 98~106번 줄)

- [ ] **Step 2: 빌드 타입 체크로 잔여 참조 없는지 확인**

```bash
npx tsc --noEmit
```

Expected: 에러 없음. 에러가 있다면 해당 파일에서 `ReviewQueueItem` 참조를 제거한다.

- [ ] **Step 3: 커밋**

```bash
git add lib/types/lesson.ts
git commit -m "chore: remove ReviewQueueItem type"
```

---

### Task 5: submit API에 is_retry 플래그 추가

**Files:**
- Modify: `app/api/learning/submit/route.ts`

- [ ] **Step 1: route.ts 수정**

`app/api/learning/submit/route.ts`를 다음으로 교체:

```ts
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

  const { problem_id, user_answer, is_retry = false } = body as {
    problem_id: string
    user_answer: string[]
    is_retry?: boolean
  }

  const { data: problem } = await supabase
    .from('problems')
    .select('id, correct_answer, xp_reward, hint')
    .eq('id', problem_id)
    .single()

  if (!problem) return NextResponse.json({ error: 'Problem not found' }, { status: 404 })

  const isCorrect = gradeAnswer(user_answer, problem.correct_answer as string[])

  // 재시도: 정답 확인만 하고 사이드 이펙트 없음
  if (is_retry) {
    return NextResponse.json({ correct: isCorrect })
  }

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

- [ ] **Step 2: 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add app/api/learning/submit/route.ts
git commit -m "feat: add is_retry flag to submit API — skips hearts/XP/DB on retry"
```

---

### Task 6: lesson-view.tsx에 retry phase 추가

**Files:**
- Modify: `components/lesson/lesson-view.tsx`
- Create: `__tests__/components/lesson-view.test.tsx`

`retryQueue`는 `Problem[]` 배열로 관리한다. 배열 앞(인덱스 0)이 현재 문제다. 정답이면 `slice(1)`로 앞을 제거, 오답이면 `[...slice(1), retryQueue[0]]`으로 뒤에 다시 추가한다.

- [ ] **Step 1: 테스트 파일 작성**

`__tests__/components/lesson-view.test.tsx` 생성:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import LessonView from '@/components/lesson/lesson-view'
import type { Card, Problem } from '@/lib/types/lesson'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const mockCards: Card[] = [{ title: '테스트', content: '내용' }]

const makeProblem = (id: string): Problem => ({
  id,
  lesson_id: 'lesson-1',
  type: 'fill_blank',
  content: { question: `문제 ${id}`, blank_count: 1 },
  correct_answer: ['정답'],
  hint: null,
  concept_tags: [],
  order_index: 0,
  xp_reward: 10,
})

const problems = [makeProblem('p1'), makeProblem('p2')]

function mockFetch(responses: object[]) {
  let call = 0
  vi.stubGlobal('fetch', vi.fn(() =>
    Promise.resolve({ json: () => Promise.resolve(responses[call++]) })
  ))
}

describe('LessonView — retry phase', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('goes to complete directly when all problems are correct', async () => {
    mockFetch([
      { correct: true, xp_earned: 10 },  // p1 정답
      { correct: true, xp_earned: 10 },  // p2 정답
      { xp_earned: 20, total_xp: 100, streak: 1, leveled_up: false, new_level: 1 }, // complete
    ])

    render(<LessonView lessonId="lesson-1" cards={mockCards} problems={problems} />)
    // cards phase 건너뜀: 카드 완료 버튼 클릭
    fireEvent.click(screen.getByRole('button', { name: /시작|완료|계속/i }))

    // p1 제출 후 계속
    await waitFor(() => screen.getByText(/문제 p1/))
    fireEvent.click(screen.getByRole('button', { name: /제출/i }))
    await waitFor(() => screen.getByText(/계속/))
    fireEvent.click(screen.getByText(/계속/))

    // p2 제출 후 계속 → retry 없이 complete
    await waitFor(() => screen.getByText(/문제 p2/))
    fireEvent.click(screen.getByRole('button', { name: /제출/i }))
    await waitFor(() => screen.getByText(/계속/))
    fireEvent.click(screen.getByText(/계속/))

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))
    const calls = vi.mocked(fetch).mock.calls
    // 세 번째 호출이 /api/learning/complete
    expect(calls[2][0]).toBe('/api/learning/complete')
  })

  it('shows retry banner when a problem was wrong', async () => {
    mockFetch([
      { correct: false, hearts_remaining: 4 }, // p1 오답
      { correct: true, xp_earned: 10 },        // p2 정답
      { correct: true },                        // retry p1 정답 (is_retry)
      { xp_earned: 10, total_xp: 100, streak: 1, leveled_up: false, new_level: 1 },
    ])

    render(<LessonView lessonId="lesson-1" cards={mockCards} problems={problems} />)
    fireEvent.click(screen.getByRole('button', { name: /시작|완료|계속/i }))

    // p1 오답
    await waitFor(() => screen.getByText(/문제 p1/))
    fireEvent.click(screen.getByRole('button', { name: /제출/i }))
    await waitFor(() => screen.getByText(/계속/))
    fireEvent.click(screen.getByText(/계속/))

    // p2 정답
    await waitFor(() => screen.getByText(/문제 p2/))
    fireEvent.click(screen.getByRole('button', { name: /제출/i }))
    await waitFor(() => screen.getByText(/계속/))
    fireEvent.click(screen.getByText(/계속/))

    // retry 배너 표시 확인
    await waitFor(() => screen.getByText(/틀린 문제 복습/))
    expect(screen.getByText(/1개 남음/)).toBeInTheDocument()

    // retry p1 정답 → complete
    fireEvent.click(screen.getByRole('button', { name: /제출/i }))
    await waitFor(() => screen.getByText(/계속/))
    // retry submit에 is_retry: true가 포함됐는지 확인
    const calls = vi.mocked(fetch).mock.calls
    const retryCall = calls[2]
    const body = JSON.parse(retryCall[1]!.body as string)
    expect(body.is_retry).toBe(true)
  })
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npm test -- --reporter=verbose __tests__/components/lesson-view.test.tsx
```

Expected: FAIL (retry phase 미구현)

- [ ] **Step 3: lesson-view.tsx 전체 교체**

`components/lesson/lesson-view.tsx`를 다음으로 교체:

```tsx
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

type Phase = 'cards' | 'problems' | 'retry' | 'complete'

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
  const [wrongProblemIds, setWrongProblemIds] = useState<string[]>([])
  const [retryQueue, setRetryQueue] = useState<Problem[]>([])

  const isRetry = phase === 'retry'
  const currentProblem = isRetry ? retryQueue[0] : problems[problemIndex]

  async function handleSubmit(answer: string[]) {
    const res = await fetch('/api/learning/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problem_id: currentProblem.id, user_answer: answer, is_retry: isRetry }),
    })
    const result: SubmitResult = await res.json()
    setFeedback(result)
    if (!isRetry && !result.correct && result.hearts_remaining !== undefined) {
      setHeartsRemaining(result.hearts_remaining)
    }
    if (!isRetry && !result.correct) {
      setWrongProblemIds(ids =>
        ids.includes(currentProblem.id) ? ids : [...ids, currentProblem.id]
      )
    }
  }

  async function enterComplete() {
    const res = await fetch('/api/learning/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lesson_id: lessonId }),
    })
    const result: CompleteResult = await res.json()
    setCompleteResult(result)
    setPhase('complete')
  }

  async function handleNext() {
    const wasCorrect = feedback?.correct ?? false
    setFeedback(null)

    if (isRetry) {
      if (wasCorrect) {
        const next = retryQueue.slice(1)
        if (next.length === 0) {
          await enterComplete()
        } else {
          setRetryQueue(next)
        }
      } else {
        setRetryQueue([...retryQueue.slice(1), retryQueue[0]])
      }
      return
    }

    const isLastProblem = problemIndex + 1 >= problems.length
    if (isLastProblem) {
      const finalWrong = wasCorrect
        ? wrongProblemIds
        : wrongProblemIds.includes(currentProblem.id)
          ? wrongProblemIds
          : [...wrongProblemIds, currentProblem.id]

      if (finalWrong.length > 0) {
        const queue = problems.filter(p => finalWrong.includes(p.id))
        setRetryQueue(queue)
        setPhase('retry')
      } else {
        await enterComplete()
      }
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

  return (
    <div className="max-w-lg mx-auto px-4 pb-40">
      <div className="flex items-center justify-between mb-6">
        {isRetry ? (
          <span className="text-sm font-medium text-amber-600">
            틀린 문제 복습 · {retryQueue.length}개 남음
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">
            {problemIndex + 1} / {problems.length}
          </span>
        )}
        {heartsRemaining !== null && (
          <span className="text-sm">
            {'❤️'.repeat(heartsRemaining)}{'🖤'.repeat(5 - heartsRemaining)}
          </span>
        )}
      </div>

      {currentProblem.type === 'fill_blank' && (
        <FillBlankProblem problem={currentProblem} onSubmit={handleSubmit} disabled={feedback !== null} />
      )}
      {currentProblem.type === 'drag_order' && (
        <DragOrderProblem problem={currentProblem} onSubmit={handleSubmit} disabled={feedback !== null} />
      )}
      {currentProblem.type === 'logic_flow' && (
        <LogicFlowProblem problem={currentProblem} onSubmit={handleSubmit} disabled={feedback !== null} />
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

- [ ] **Step 4: 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 5: 테스트 통과 확인**

```bash
npm test -- --reporter=verbose __tests__/components/lesson-view.test.tsx
```

Expected: PASS 2 tests

- [ ] **Step 6: 전체 테스트 통과 확인**

```bash
npm test
```

Expected: 모든 테스트 PASS

- [ ] **Step 7: 커밋**

```bash
git add components/lesson/lesson-view.tsx __tests__/components/lesson-view.test.tsx
git commit -m "feat: add retry phase to lesson-view — wrong problems repeat until correct"
```

---

### 완료 기준

- `npm test` 전체 통과
- `/review` 라우트 접근 시 404
- 하단 네비게이션: 홈, 학습, 프로필 3탭만 표시
- 레슨에서 문제를 틀리면 마지막 문제 이후 `틀린 문제 복습 · N개 남음` 배너와 함께 재시도
- 재시도 정답 시 하트 차감 없음, XP 없음
- 모든 재시도 통과 후 완료 화면 진입
