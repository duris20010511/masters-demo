import { describe, it, expect } from 'vitest'
import { PHASE_ORDER, nextPhase } from '../src/core/phases'

describe('phases', () => {
  it('순서는 스펙 §3과 일치한다', () => {
    expect(PHASE_ORDER).toEqual(['title', 'opening', 'cycle1', 'cycle2', 'chase', 'ending'])
  })
  it('nextPhase는 다음 페이즈, 마지막이면 null', () => {
    expect(nextPhase('cycle1')).toBe('cycle2')
    expect(nextPhase('ending')).toBeNull()
  })
})
