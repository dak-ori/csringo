import Link from 'next/link'
import type { CompleteResult } from '@/lib/types/lesson'

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
