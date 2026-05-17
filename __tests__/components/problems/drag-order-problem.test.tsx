import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DragOrderProblem from '@/components/lesson/problems/drag-order-problem'
import type { Problem } from '@/lib/types/lesson'

const mockProblem: Problem = {
  id: 'p1',
  lesson_id: 'l1',
  type: 'drag_order',
  content: { question: '순서를 맞추세요.', items: ['A', 'B', 'C'] },
  correct_answer: ['A', 'B', 'C'],
  hint: null,
  concept_tags: [],
  order_index: 1,
  xp_reward: 5,
}

describe('DragOrderProblem', () => {
  it('아이템들이 렌더링된다', () => {
    render(<DragOrderProblem problem={mockProblem} onSubmit={vi.fn()} disabled={false} />)
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText('C')).toBeInTheDocument()
  })

  it('제출 버튼이 있다', () => {
    render(<DragOrderProblem problem={mockProblem} onSubmit={vi.fn()} disabled={false} />)
    expect(screen.getByRole('button', { name: '제출' })).toBeInTheDocument()
  })

  it('제출 클릭 시 현재 순서로 onSubmit 호출', () => {
    const onSubmit = vi.fn()
    render(<DragOrderProblem problem={mockProblem} onSubmit={onSubmit} disabled={false} />)
    fireEvent.click(screen.getByRole('button', { name: '제출' }))
    expect(onSubmit).toHaveBeenCalledWith(['A', 'B', 'C'])
  })
})
