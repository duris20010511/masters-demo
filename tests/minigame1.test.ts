import { describe, it, expect } from 'vitest'
import { resolveDocChoice } from '../src/ui/minigame1'

describe('서류 미니게임 판정 (스펙 §6-1)', () => {
  it('정확히 입력: 신뢰+5 적합+15, good 일지', () => {
    expect(resolveDocChoice('accurate', 0.9)).toEqual({
      trust: 5, aptitude: 15, journal: 'cycle1_good', caught: false,
    })
  })
  it('사소한 실수: 신뢰-10 적합 0, bad 일지', () => {
    expect(resolveDocChoice('mistake', 0.9)).toEqual({
      trust: -10, aptitude: 0, journal: 'cycle1_bad', caught: false,
    })
  })
  it('행 삭제: 적합-10, 30% 미만 roll이면 들켜서 신뢰-15', () => {
    expect(resolveDocChoice('deleteRow', 0.29)).toEqual({
      trust: -15, aptitude: -10, journal: 'cycle1_bad', caught: true,
    })
    expect(resolveDocChoice('deleteRow', 0.31)).toEqual({
      trust: 0, aptitude: -10, journal: 'cycle1_bad', caught: false,
    })
  })
})
