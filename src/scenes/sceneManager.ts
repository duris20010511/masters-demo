import * as THREE from 'three'
import type { GameState, PhaseId } from '../core/state'
import { nextPhase } from '../core/phases'
import { saveCheckpoint } from '../core/checkpoint'
import { Overlay } from '../ui/overlay'
import { PostFX } from '../render/postfx'
import { ModeManager } from '../input/modes'
import { STR } from '../content/strings'

export interface SceneCtx {
  state: GameState
  overlay: Overlay
  fx: PostFX
  modes: ModeManager
  renderer: THREE.WebGLRenderer
  advance(): void
  goTo(phase: PhaseId): void
}

export interface GameScene {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  enter(ctx: SceneCtx): Promise<void>
  exit(): void
  update(dtMs: number): void
}

export class SceneManager {
  private makers = new Map<PhaseId, () => GameScene>()
  private current: GameScene | null = null
  private transitioning = false

  constructor(private ctx: Omit<SceneCtx, 'advance' | 'goTo'>) {}

  register(phase: PhaseId, make: () => GameScene): void {
    this.makers.set(phase, make)
  }

  private fullCtx(): SceneCtx {
    return { ...this.ctx, advance: () => void this.advance(), goTo: p => void this.goTo(p) }
  }

  async start(): Promise<void> {
    await this.goTo(this.ctx.state.phase)
  }

  private async advance(): Promise<void> {
    const n = nextPhase(this.ctx.state.phase)
    if (n) await this.goTo(n)
  }

  async goTo(phase: PhaseId): Promise<void> {
    if (this.transitioning) return
    this.transitioning = true
    // 글리치 램프 — 기록이 끊기는 순간 (타이틀 최초 진입은 램프 생략)
    if (this.current) {
      this.ctx.fx.pulse('glitch', 0.9, 700)
      this.ctx.fx.pulse('rgbShift', 0.6, 700)
      await new Promise(r => setTimeout(r, 700))
    }

    this.current?.exit()
    this.current = null
    this.ctx.state.phase = phase
    saveCheckpoint(this.ctx.state)

    const make = this.makers.get(phase)
    if (!make) {
      // 미구현 페이즈: 유실 카드 → 자동 다음
      this.transitioning = false
      await this.ctx.overlay.showCard(STR.lost(phase), 2000)
      const n = nextPhase(phase)
      if (n) await this.goTo(n)
      return
    }
    this.current = make()
    this.ctx.fx.setScene(this.current.scene, this.current.camera)
    this.transitioning = false
    await this.current.enter(this.fullCtx())
  }

  update(dtMs: number): void {
    this.current?.update(dtMs)
  }

  resize(w: number, h: number): void {
    if (!this.current) return
    this.current.camera.aspect = w / h
    this.current.camera.updateProjectionMatrix()
  }
}
