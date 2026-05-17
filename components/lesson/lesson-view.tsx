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
      // fire-and-forget: 복습 큐 생성 (ADR 0002)
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

  return (
    <div className="max-w-lg mx-auto px-4 pb-40">
      <div className="flex items-center justify-between mb-6">
        <span className="text-sm text-muted-foreground">
          {problemIndex + 1} / {problems.length}
        </span>
        {heartsRemaining !== null && (
          <span className="text-sm">
            {'❤️'.repeat(heartsRemaining)}{'🖤'.repeat(5 - heartsRemaining)}
          </span>
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
