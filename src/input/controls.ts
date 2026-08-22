import * as THREE from 'three'

export class FPSControls {
  enabled = false
  private yaw = 0
  private pitch = 0
  private keys = new Set<string>()
  private min = new THREE.Vector3(-Infinity, 0, -Infinity)
  private max = new THREE.Vector3(Infinity, 0, Infinity)

  private onMouse = (e: MouseEvent) => {
    if (!this.enabled) return
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

  update(dtMs: number): void {
    if (!this.enabled) return
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ')
    const speed = 2.2 * (dtMs / 1000)
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
