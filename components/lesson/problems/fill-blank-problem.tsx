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
