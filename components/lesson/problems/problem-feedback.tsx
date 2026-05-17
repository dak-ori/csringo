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
        correct
          ? 'bg-green-50 border-green-200 dark:bg-green-950'
          : 'bg-red-50 border-red-200 dark:bg-red-950'
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
