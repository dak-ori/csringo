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
