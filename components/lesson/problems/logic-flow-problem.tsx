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
