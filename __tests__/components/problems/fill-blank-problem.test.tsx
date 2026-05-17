import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FillBlankProblem from '@/components/lesson/problems/fill-blank-problem'
import type { Problem } from '@/lib/types/lesson'

const mockProblem: Problem = {
  id: 'p1',
  lesson_id: 'l1',
  type: 'fill_blank',
  content: { question: '배열 접근 시간 복잡도는 ___입니다.', blank_count: 1 },
  correct_answer: ['O(1)'],
  hint: '매우 빠릅니다.',
  concept_tags: [],
  order_index: 1,
  xp_reward: 5,
}

describe('FillBlankProblem', () => {
  it('빈칸 input이 렌더링된다', () => {
    render(<FillBlankProblem problem={mockProblem} onSubmit={vi.fn()} disabled={false} />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('빈칸 비어있으면 제출 버튼 비활성화', () => {
    render(<FillBlankProblem problem={mockProblem} onSubmit={vi.fn()} disabled={false} />)
    expect(screen.getByRole('button', { name: '제출' })).toBeDisabled()
  })

  it('입력 후 제출 시 onSubmit 호출', () => {
    const onSubmit = vi.fn()
    render(<FillBlankProblem problem={mockProblem} onSubmit={onSubmit} disabled={false} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'O(1)' } })
    fireEvent.click(screen.getByRole('button', { name: '제출' }))
    expect(onSubmit).toHaveBeenCalledWith(['O(1)'])
  })

  it('disabled일 때 input 비활성화', () => {
    render(<FillBlankProblem problem={mockProblem} onSubmit={vi.fn()} disabled={true} />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })
})
