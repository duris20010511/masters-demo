export type Mode = 'fps' | 'ui' | 'paused'

interface LockHooks { lock: () => void; unlock: () => void }

export class ModeManager {
  mode: Mode = 'ui'
  private before: Mode = 'ui'
  private cbs: Array<(m: Mode) => void> = []

  constructor(private hooks: LockHooks) {}

  onChange(cb: (m: Mode) => void): void {
    this.cbs.push(cb)
  }

  private set(m: Mode): void {
    if (this.mode === m) return
    this.mode = m
    for (const cb of this.cbs) cb(m)
  }

  toFPS(userGesture: boolean): boolean {
    if (!userGesture) return false
    this.hooks.lock()
    this.set('fps')
    return true
  }

  toUI(): void {
    if (this.mode === 'fps') this.hooks.unlock()
    this.set('ui')
  }

  pause(): void {
    if (this.mode === 'paused') return
    this.before = this.mode
    if (this.before === 'fps') this.hooks.unlock()
    this.set('paused')
  }

  resume(userGesture: boolean): boolean {
    if (this.mode !== 'paused') return false
    if (this.before === 'fps') {
      if (!userGesture) return false
      this.hooks.lock()
    }
    this.set(this.before)
    return true
  }
}
