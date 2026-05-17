# Phase 4: 복습 화면 + Claude API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 복습 큐 목록 페이지, Claude API 기반 복습 큐 자동 생성, 복습 완료 처리를 구현한다.

**Architecture:** `LessonView`가 레슨 완료 후 `/api/review/generate`를 fire-and-forget 호출 (ADR 0002). Claude API가 사용자의 `wrong_answers`를 분석해 `review_queue`에 삽입. 복습 페이지는 서버 컴포넌트로 큐 목록 렌더링.

**Tech Stack:** @anthropic-ai/sdk, Next.js Route Handlers, Supabase

**전제조건:** Phase 1 + Phase 2 + Phase 3 완료. `ANTHROPIC_API_KEY` `.env.local`에 설정됨.

---

## Task 24: /api/review GET Route Handler

**Files:**
- Create: `app/api/review/route.ts`

- [ ] **Step 1: 파일 생성**

```typescript
// app/api/review/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('review_queue')
    .select(`
      id, priority, added_at,
      problem:problems(id, type, content, correct_answer, hint, concept_tags, xp_reward)
    `)
    .eq('user_id', user.id)
    .is('reviewed_at', null)
    .order('priority', { ascending: false })
    .order('added_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ items: data ?? [] })
}
```

- [ ] **Step 2: 커밋**

```bash
git add app/api/review/route.ts
git commit -m "feat: add GET /api/review route"
```

---

## Task 25: /api/review/generate POST Route Handler (Claude API)

**Files:**
- Create: `app/api/review/generate/route.ts`

- [ ] **Step 1: 파일 생성**

```typescript
// app/api/review/generate/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // wrong_count >= 2인 문제들 조회 (아직 복습 큐에 없거나 완료된 것 포함)
  const { data: wrongAnswers } = await supabase
    .from('wrong_answers')
    .select(`
      problem_id, wrong_count,
      problem:problems(id, type, content, concept_tags, lesson_id)
    `)
    .eq('user_id', user.id)
    .gte('wrong_count', 2)
    .order('wrong_count', { ascending: false })
    .limit(20)

  if (!wrongAnswers || wrongAnswers.length === 0) {
    return NextResponse.json({ message: 'No weak concepts found' })
  }

  // Claude에게 분석 요청
  const conceptSummary = wrongAnswers
    .map(wa => {
      const problem = wa.problem as { concept_tags: string[]; type: string } | null
      return `- 문제 ID: ${wa.problem_id}, 틀린 횟수: ${wa.wrong_count}, 개념: ${problem?.concept_tags?.join(', ') ?? '알 수 없음'}`
    })
    .join('\n')

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: `다음은 학생이 자주 틀린 CS 문제 목록입니다:\n${conceptSummary}\n\n틀린 횟수가 많은 순서로 최대 5개 문제 ID를 선택해 복습 우선순위(1-5, 5가 최고)를 JSON 배열로만 반환하세요. 형식: [{"problem_id":"...","priority":5},...]`,
      },
    ],
  })

  let prioritized: Array<{ problem_id: string; priority: number }> = []
  try {
    const content = message.content[0]
    if (content.type === 'text') {
      const jsonMatch = content.text.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        prioritized = JSON.parse(jsonMatch[0])
      }
    }
  } catch {
    // Claude 응답 파싱 실패 시 단순 우선순위로 fallback
    prioritized = wrongAnswers.slice(0, 5).map((wa, i) => ({
      problem_id: wa.problem_id,
      priority: 5 - i,
    }))
  }

  // review_queue upsert (UNIQUE(user_id, problem_id) — 재완료 시 reviewed_at 초기화)
  if (prioritized.length > 0) {
    const upsertData = prioritized.map(item => ({
      user_id: user.id,
      problem_id: item.problem_id,
      priority: item.priority,
      added_at: new Date().toISOString(),
      reviewed_at: null,
    }))

    await supabase
      .from('review_queue')
      .upsert(upsertData, { onConflict: 'user_id,problem_id' })
  }

  return NextResponse.json({ added: prioritized.length })
}
```

- [ ] **Step 2: 커밋**

```bash
git add app/api/review/generate/route.ts
git commit -m "feat: add /api/review/generate with Claude API integration"
```

---

## Task 26: /api/review/complete POST Route Handler

**Files:**
- Create: `app/api/review/complete/route.ts`

- [ ] **Step 1: 파일 생성**

```typescript
// app/api/review/complete/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body?.review_queue_id) {
    return NextResponse.json({ error: 'review_queue_id required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('review_queue')
    .update({ reviewed_at: new Date().toISOString() })
    .eq('id', body.review_queue_id)
    .eq('user_id', user.id)  // RLS 보완: 본인 항목만 수정 가능

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: 커밋**

```bash
git add app/api/review/complete/route.ts
git commit -m "feat: add /api/review/complete route"
```

---

## Task 27: 복습 페이지

**Files:**
- Create: `app/(protected)/review/page.tsx`
- Create: `components/review/review-item.tsx`

- [ ] **Step 1: ReviewItem 클라이언트 컴포넌트 생성**

```typescript
// components/review/review-item.tsx
'use client'

import { useState } from 'react'
import type { ReviewQueueItem, Problem } from '@/lib/types/lesson'
import FillBlankProblem from '@/components/lesson/problems/fill-blank-problem'
import DragOrderProblem from '@/components/lesson/problems/drag-order-problem'
import LogicFlowProblem from '@/components/lesson/problems/logic-flow-problem'
import ProblemFeedback from '@/components/lesson/problems/problem-feedback'

interface Props {
  item: ReviewQueueItem
  onComplete: (id: string) => void
}

interface SubmitResult {
  correct: boolean
  xp_earned?: number
}

export default function ReviewItem({ item, onComplete }: Props) {
  const [feedback, setFeedback] = useState<SubmitResult | null>(null)
  const problem = item.problem as Problem

  async function handleSubmit(answer: string[]) {
    const res = await fetch('/api/learning/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problem_id: problem.id, user_answer: answer }),
    })
    const result: SubmitResult = await res.json()
    setFeedback(result)
  }

  async function handleNext() {
    if (feedback?.correct) {
      await fetch('/api/review/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_queue_id: item.id }),
      })
      onComplete(item.id)
    } else {
      setFeedback(null)
    }
  }

  if (!problem) return null

  return (
    <div className="rounded-2xl border p-5">
      <div className="mb-4 flex gap-2 flex-wrap">
        {problem.concept_tags.map(tag => (
          <span key={tag} className="text-xs px-2 py-0.5 bg-muted rounded-full">{tag}</span>
        ))}
      </div>

      {problem.type === 'fill_blank' && (
        <FillBlankProblem problem={problem} onSubmit={handleSubmit} disabled={feedback !== null} />
      )}
      {problem.type === 'drag_order' && (
        <DragOrderProblem problem={problem} onSubmit={handleSubmit} disabled={feedback !== null} />
      )}
      {problem.type === 'logic_flow' && (
        <LogicFlowProblem problem={problem} onSubmit={handleSubmit} disabled={feedback !== null} />
      )}

      {feedback && (
        <ProblemFeedback
          correct={feedback.correct}
          xpEarned={feedback.xp_earned}
          hint={problem.hint}
          onNext={handleNext}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: ReviewPage 서버 컴포넌트 생성**

```typescript
// app/(protected)/review/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReviewList from './review-list'

export default async function ReviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: items } = await supabase
    .from('review_queue')
    .select(`
      id, priority, added_at,
      problem:problems(id, type, content, correct_answer, hint, concept_tags, xp_reward, lesson_id)
    `)
    .eq('user_id', user.id)
    .is('reviewed_at', null)
    .order('priority', { ascending: false })
    .order('added_at')

  return (
    <main className="max-w-lg mx-auto px-4 pt-8 pb-24">
      <h1 className="text-2xl font-bold mb-6">복습</h1>
      <ReviewList items={items ?? []} />
    </main>
  )
}
```

- [ ] **Step 3: ReviewList 클라이언트 컴포넌트 생성**

```typescript
// app/(protected)/review/review-list.tsx
'use client'

import { useState } from 'react'
import ReviewItem from '@/components/review/review-item'
import type { ReviewQueueItem } from '@/lib/types/lesson'
import Link from 'next/link'

interface Props {
  items: ReviewQueueItem[]
}

export default function ReviewList({ items: initialItems }: Props) {
  const [items, setItems] = useState(initialItems)

  function handleComplete(id: string) {
    setItems(prev => prev.filter(item => item.id !== id))
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-4xl mb-4">✅</p>
        <p className="font-medium">복습할 문제가 없어요!</p>
        <p className="text-sm mt-2">레슨을 완료하면 틀린 문제가 여기 나타납니다.</p>
        <Link href="/learn" className="inline-block mt-6 py-2 px-4 rounded-xl bg-primary text-primary-foreground text-sm">
          학습하러 가기
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{items.length}개 문제 남음</p>
      {items.map(item => (
        <ReviewItem key={item.id} item={item} onComplete={handleComplete} />
      ))}
    </div>
  )
}
```

- [ ] **Step 4: 복습 플로우 수동 테스트**

1. 레슨에서 문제 2회 이상 틀리기
2. 레슨 완료 (fire-and-forget으로 `/api/review/generate` 호출됨)
3. `/review` 접속해서 복습 문제 표시 확인
4. 복습 문제 정답 → 목록에서 사라지는지 확인

- [ ] **Step 5: Phase 4 완료 커밋**

```bash
git add app/(protected)/review/ app/api/review/ components/review/
git commit -m "feat: complete phase 4 - review queue with Claude API"
```
