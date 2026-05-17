import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LogicFlowProblem from '@/components/lesson/problems/logic-flow-problem'
import type { Problem } from '@/lib/types/lesson'

const mockProblem: Problem = {
  id: 'p1',
  lesson_id: 'l1',
  type: 'logic_flow',
  content: {
    question: 'TCP 연결 수립 순서',
    steps: ['SYN', '___', 'ACK'],
    blank_index: 1,
    options: ['SYN-ACK', 'FIN', 'RST'],
  },
  correct_answer: ['SYN-ACK'],
  hint: null,
  concept_tags: [],
  order_index: 1,
  xp_reward: 5,
}

describe('LogicFlowProblem', () => {
  it('스텝과 보기가 렌더링된다', () => {
    render(<LogicFlowProblem problem={mockProblem} onSubmit={vi.fn()} disabled={false} />)
    expect(screen.getByText('SYN')).toBeInTheDocument()
    expect(screen.getByText('ACK')).toBeInTheDocument()
    expect(screen.getByText('SYN-ACK')).toBeInTheDocument()
    expect(screen.getByText('FIN')).toBeInTheDocument()
  })

  it('선택 전 제출 버튼 비활성화', () => {
    render(<LogicFlowProblem problem={mockProblem} onSubmit={vi.fn()} disabled={false} />)
    expect(screen.getByRole('button', { name: '제출' })).toBeDisabled()
  })

  it('보기 선택 후 제출 시 onSubmit 호출', () => {
    const onSubmit = vi.fn()
    render(<LogicFlowProblem problem={mockProblem} onSubmit={onSubmit} disabled={false} />)
    fireEvent.click(screen.getByText('SYN-ACK'))
    fireEvent.click(screen.getByRole('button', { name: '제출' }))
    expect(onSubmit).toHaveBeenCalledWith(['SYN-ACK'])
  })
})
