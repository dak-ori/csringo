import { describe, it, expect } from 'vitest'
import { calculateCurrentHearts } from '@/lib/hearts'

describe('calculateCurrentHearts', () => {
  it('방금 소모 → 저장값 그대로', () => {
    const now = new Date()
    expect(calculateCurrentHearts(3, now)).toBe(3)
  })

  it('4시간 경과 → 1 회복', () => {
    const fourHoursAgo = new Date(Date.now() - 4 * 3_600_000)
    expect(calculateCurrentHearts(3, fourHoursAgo)).toBe(4)
  })

  it('8시간 경과 → 2 회복', () => {
    const eightHoursAgo = new Date(Date.now() - 8 * 3_600_000)
    expect(calculateCurrentHearts(2, eightHoursAgo)).toBe(4)
  })

  it('최대 5개 초과 불가', () => {
    const dayAgo = new Date(Date.now() - 24 * 3_600_000)
    expect(calculateCurrentHearts(3, dayAgo)).toBe(5)
  })

  it('이미 5개면 경과 시간 무관 5 유지', () => {
    const hourAgo = new Date(Date.now() - 3_600_000)
    expect(calculateCurrentHearts(5, hourAgo)).toBe(5)
  })

  it('3시간 경과 → 회복 없음', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3_600_000)
    expect(calculateCurrentHearts(0, threeHoursAgo)).toBe(0)
  })
})
