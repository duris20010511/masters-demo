import { describe, expect, it } from 'vitest'
import { resolveSampleGame } from '../src/ui/minigame2'

describe('resolveSampleGame', () => {
  it.each([
    [0, { trust: 5, aptitude: 15, journal: 'cycle2_good' }],
    [1, { trust: 5, aptitude: 15, journal: 'cycle2_good' }],
    [2, { trust: 0, aptitude: 0, journal: 'cycle2_bad' }],
    [3, { trust: 0, aptitude: 0, journal: 'cycle2_bad' }],
    [4, { trust: -15, aptitude: 0, journal: 'cycle2_bad' }],
  ])('오류 %i개의 결과를 정확히 분류한다', (errors, expected) => {
    expect(resolveSampleGame(errors)).toEqual(expected)
  })

  it('오류 수에 따라 journal을 good 또는 bad로 매핑한다', () => {
    expect(resolveSampleGame(0).journal).toBe('cycle2_good')
    expect(resolveSampleGame(2).journal).toBe('cycle2_bad')
    expect(resolveSampleGame(4).journal).toBe('cycle2_bad')
  })
})
