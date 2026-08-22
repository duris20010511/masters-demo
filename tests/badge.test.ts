import { describe, it, expect } from 'vitest'
import { badgeErodedLabel } from '../src/ui/overlay'

const firstSlot = () => 0 // 항상 첫 후보 위치를 고르는 결정적 rand

describe('badgeErodedLabel', () => {
  it('적합도 39 이하는 잠식 없음', () => {
    expect(badgeErodedLabel(30, firstSlot)).toBe('학부연구생')
  })
  it('적합도 구간별로 1/2/3자가 석사과정 글자로 바뀐다', () => {
    expect(badgeErodedLabel(45, firstSlot)).toBe('석부연구생')
    expect(badgeErodedLabel(65, firstSlot)).toBe('석사연구생')
    expect(badgeErodedLabel(85, firstSlot)).toBe('석사과구생')
  })
})
