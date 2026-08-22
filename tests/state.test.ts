import { describe, it, expect } from 'vitest'
import { createState, applyStat } from '../src/core/state'

describe('GameState', () => {
  it('초기값: 신뢰 50 / 적합 30 / 정신 100, phase=title', () => {
    const s = createState()
    expect(s.stats).toEqual({ trust: 50, aptitude: 30, sanity: 100 })
    expect(s.phase).toBe('title')
    expect(s.journal).toEqual([])
    expect(s.chaseFails).toBe(0)
  })
  it('applyStat은 0~100으로 클램프한다', () => {
    const s = createState()
    applyStat(s, 'sanity', -150)
    expect(s.stats.sanity).toBe(0)
    applyStat(s, 'trust', 999)
    expect(s.stats.trust).toBe(100)
    applyStat(s, 'aptitude', 15)
    expect(s.stats.aptitude).toBe(45)
  })
})
