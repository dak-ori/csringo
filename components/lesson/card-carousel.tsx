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
          {card.content}
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
