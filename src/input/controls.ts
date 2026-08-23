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

  /** 통과 불가 오브젝트들의 AABB (월드 좌표). 씬이 구성된 뒤 한 번 넣어주면 된다. */
  private colliders: THREE.Box3[] = []
  private radius = 0.32 // 플레이어 반경 (m)

  setColliders(boxes: THREE.Box3[], radius = 0.32): void {
    this.colliders = boxes
    this.radius = radius
  }

  /** 씬 그래프에서 통과 불가 오브젝트의 AABB를 수집 (지정한 오브젝트들만) */
  static collidersFrom(objects: THREE.Object3D[]): THREE.Box3[] {
    return objects
      .map(o => new THREE.Box3().setFromObject(o))
      .filter(b => Number.isFinite(b.min.x) && b.max.y > 0.12) // 바닥·빈 그룹 제외
  }

  private blocked(x: number, z: number): boolean {
    const r = this.radius
    for (const b of this.colliders) {
      if (x > b.min.x - r && x < b.max.x + r && z > b.min.z - r && z < b.max.z + r) return true
    }
    return false
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
    // 이동량을 먼저 합산한 뒤, 축별로 충돌 판정 (벽을 따라 미끄러지도록)
    const d = new THREE.Vector3()
    if (this.keys.has('KeyW')) d.addScaledVector(f, speed)
    if (this.keys.has('KeyS')) d.addScaledVector(f, -speed)
    if (this.keys.has('KeyD')) d.addScaledVector(r, -speed)
    if (this.keys.has('KeyA')) d.addScaledVector(r, speed)

    const nx = Math.max(this.min.x, Math.min(this.max.x, p.x + d.x))
    if (!this.blocked(nx, p.z)) p.x = nx
    const nz = Math.max(this.min.z, Math.min(this.max.z, p.z + d.z))
    if (!this.blocked(p.x, nz)) p.z = nz
    p.y = Math.max(this.min.y, Math.min(this.max.y, p.y))
  }

  dispose(): void {
    document.removeEventListener('mousemove', this.onMouse)
    document.removeEventListener('keydown', this.onKey)
    document.removeEventListener('keyup', this.onKey)
  }
}
