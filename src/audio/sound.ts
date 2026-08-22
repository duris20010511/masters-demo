import * as THREE from 'three'
import { SoundSynth } from './soundSynth'

// 오디오 게이트(타이틀 클릭) 이후에만 생성되는 전역 신스
export const sound: { synth: SoundSynth | null } = { synth: null }

export function initSound(ctx: AudioContext): void {
  sound.synth ??= new SoundSynth(ctx)
}

/** 이동 거리 누적으로 발소리 타이밍을 만든다 */
export class FootstepTracker {
  private last: THREE.Vector3 | null = null
  private acc = 0

  update(pos: THREE.Vector3, stride = 0.62): void {
    if (this.last) {
      const dx = pos.x - this.last.x
      const dz = pos.z - this.last.z
      this.acc += Math.hypot(dx, dz)
      if (this.acc >= stride) {
        this.acc = 0
        sound.synth?.play('footstep', 0.14)
      }
    }
    this.last = pos.clone()
  }
}
