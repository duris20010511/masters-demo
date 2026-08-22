import { describe, it, expect, beforeEach } from 'vitest'
import { createState, applyStat } from '../src/core/state'
import { saveCheckpoint, loadCheckpoint, clearCheckpoint } from '../src/core/checkpoint'

describe('checkpoint (sessionStorage)', () => {
  beforeEach(() => sessionStorage.clear())
  it('저장 후 복원하면 동일한 상태', () => {
    const s = createState()
    s.phase = 'cycle2'
    applyStat(s, 'aptitude', 20)
    s.flags.metColleague = true
    saveCheckpoint(s)
    const r = loadCheckpoint()
    expect(r).toEqual(s)
  })
  it('없으면 null, clear 후에도 null', () => {
    expect(loadCheckpoint()).toBeNull()
    saveCheckpoint(createState())
    clearCheckpoint()
    expect(loadCheckpoint()).toBeNull()
  })
})
