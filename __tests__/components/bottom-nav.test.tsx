import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BottomNav } from '@/components/layout/bottom-nav'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}))

describe('BottomNav', () => {
  it('renders all 4 navigation tabs', () => {
    render(<BottomNav />)
    expect(screen.getByText('홈')).toBeInTheDocument()
    expect(screen.getByText('학습')).toBeInTheDocument()
    expect(screen.getByText('복습')).toBeInTheDocument()
    expect(screen.getByText('프로필')).toBeInTheDocument()
  })

  it('highlights the active tab based on current path', () => {
    render(<BottomNav />)
    const homeLink = screen.getByRole('link', { name: /홈/i })
    expect(homeLink).toHaveClass('text-primary')
  })
})
