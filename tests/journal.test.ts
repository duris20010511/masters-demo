import { describe, it, expect } from 'vitest'
import { createState } from '../src/core/state'
import { addJournal, JOURNAL_LINES } from '../src/core/journal'

describe('journal', () => {
  it('트리거 문장은 스펙 §5와 일치한다', () => {
    expect(JOURNAL_LINES.opening).toBe('오늘도 밤이었다.')
    expect(JOURNAL_LINES.cycle1_bad).toBe('잘하면 안 된다. 못해도 안 된다.')
    expect(JOURNAL_LINES.chase_done).toBe('말하는 것만으로는 안 된다. 정말로 갈 수 없게 만들어야 한다.')
  })
  it('addJournal은 순서대로 쌓이고 같은 트리거는 한 번만', () => {
    const s = createState()
    addJournal(s, 'opening')
    addJournal(s, 'cycle1_good')
    addJournal(s, 'opening')
    expect(s.journal.map(j => j.trigger)).toEqual(['opening', 'cycle1_good'])
    expect(s.journal[1].text).toBe('칭찬을 받았다. 기분이 나쁘다.')
  })
})
