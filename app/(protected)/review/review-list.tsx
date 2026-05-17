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
