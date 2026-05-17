import { describe, it, expect } from 'vitest'
import { calculateLevel } from '@/lib/xp'

describe('calculateLevel', () => {
  it('0 XP → level 1', () => expect(calculateLevel(0)).toBe(1))
  it('99 XP → level 1', () => expect(calculateLevel(99)).toBe(1))
  it('100 XP → level 2', () => expect(calculateLevel(100)).toBe(2))
  it('299 XP → level 2', () => expect(calculateLevel(299)).toBe(2))
  it('300 XP → level 3', () => expect(calculateLevel(300)).toBe(3))
  it('599 XP → level 3', () => expect(calculateLevel(599)).toBe(3))
  it('600 XP → level 4', () => expect(calculateLevel(600)).toBe(4))
  it('999 XP → level 4', () => expect(calculateLevel(999)).toBe(4))
  it('1000 XP → level 5', () => expect(calculateLevel(1000)).toBe(5))
  it('1400 XP → level 6', () => expect(calculateLevel(1400)).toBe(6))
  it('3000 XP → level 10', () => expect(calculateLevel(3000)).toBe(10))
})
