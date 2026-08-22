import { describe, it, expect, vi } from 'vitest'
import { ModeManager } from '../src/input/modes'

function make() {
  const lock = vi.fn()
  const unlock = vi.fn()
  return { m: new ModeManager({ lock, unlock }), lock, unlock }
}

describe('ModeManager', () => {
  it('초기 모드는 ui (타이틀 화면)', () => {
    expect(make().m.mode).toBe('ui')
  })
  it('toFPS는 제스처 없이는 실패, 제스처가 있으면 lock 호출', () => {
    const { m, lock } = make()
    expect(m.toFPS(false)).toBe(false)
    expect(m.toFPS(true)).toBe(true)
    expect(m.mode).toBe('fps')
    expect(lock).toHaveBeenCalledOnce()
  })
  it('toUI는 unlock을 부르고, pause→resume은 직전 모드로 복귀', () => {
    const { m, unlock } = make()
    m.toFPS(true)
    m.toUI()
    expect(m.mode).toBe('ui')
    expect(unlock).toHaveBeenCalledOnce()
    m.toFPS(true)
    m.pause()
    expect(m.mode).toBe('paused')
    expect(m.resume(false)).toBe(false)
    expect(m.resume(true)).toBe(true)
    expect(m.mode).toBe('fps')
  })
  it('onChange 콜백이 모드 변화마다 불린다', () => {
    const { m } = make()
    const cb = vi.fn()
    m.onChange(cb)
    m.toFPS(true)
    m.toUI()
    expect(cb.mock.calls.map(c => c[0])).toEqual(['fps', 'ui'])
  })
})
