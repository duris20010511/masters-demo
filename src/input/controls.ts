import * as THREE from 'three'
import { lockState } from './modes'

export class FPSControls {
  enabled = false
  private yaw = 0
  private pitch = 0
  private keys = new Set<string>()
  private min = new THREE.Vector3(-Infinity, 0, -Infinity)
  private max = new THREE.Vector3(Infinity, 0, Infinity)

  private onMouse = (e: MouseEvent) => {
    if (!this.enabled) return
    // 잠금 차단 환경에서는 드래그(좌클릭 유지) 중에만 시점 회전
    if (lockState.broken && !(e.buttons & 1)) return
    this.yaw -= e.movementX * 0.0022
    this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch - e.movementY * 0.0022))
  }
  private onKey = (e: KeyboardEvent) => {
    if (e.type === 'keydown') this.keys.add(e.code)
    else this.keys.delete(e.code)
  }

  constructor(private camera: THREE.PerspectiveCamera) {
    document.addEventListener('mousemove', this.onMouse)
    document.addEventListener('keydown', this.onKey)
    document.addEventListener('keyup', this.onKey)
  }

  setBounds(min: THREE.Vector3, max: THREE.Vector3): void {
    this.min = min
    this.max = max
  }

  /** 이번 프레임에 이동 중이고 Shift를 누른 상태인가 (추격전 소음 판정용) */
  isRunning = false

  update(dtMs: number): void {
    if (!this.enabled) {
      this.isRunning = false
      return
    }
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ')
    const moving =
      this.keys.has('KeyW') || this.keys.has('KeyS') || this.keys.has('KeyA') || this.keys.has('KeyD')
    const shift = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
    this.isRunning = moving && shift
    const speed = (this.isRunning ? 3.6 : 2.2) * (dtMs / 1000)
    const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
    const r = new THREE.Vector3(f.z, 0, -f.x)
    const p = this.camera.position
    if (this.keys.has('KeyW')) p.addScaledVector(f, speed)
    if (this.keys.has('KeyS')) p.addScaledVector(f, -speed)
    if (this.keys.has('KeyD')) p.addScaledVector(r, -speed)
    if (this.keys.has('KeyA')) p.addScaledVector(r, speed)
    p.clamp(this.min, this.max)
  }

  dispose(): void {
    document.removeEventListener('mousemove', this.onMouse)
    document.removeEventListener('keydown', this.onKey)
    document.removeEventListener('keyup', this.onKey)
  }
}
