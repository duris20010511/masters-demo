import * as THREE from 'three'

const BODY_M = new THREE.MeshLambertMaterial({ color: 0x4a4a58 })

export interface Person {
  group: THREE.Group
  // 머리만 아주 천천히 목표를 향해 회전 — 눈치채기 어려운 속도가 핵심
  lookAt(target: THREE.Vector3, dtMs: number): void
}

export function makePerson(opts: { seated?: boolean } = {}): Person {
  const g = new THREE.Group()
  const h = opts.seated ? 0.95 : 1.45 // 몸통 상단 높이
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.2, opts.seated ? 0.55 : 0.9, 10),
    BODY_M,
  )
  torso.position.y = h - (opts.seated ? 0.28 : 0.45)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), BODY_M)
  head.position.y = h + 0.16
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), BODY_M)
  armL.position.set(-0.24, h - 0.3, 0.05)
  const armR = armL.clone()
  armR.position.x = 0.24
  if (!opts.seated) {
    const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.7, 8), BODY_M)
    legs.position.y = 0.35
    g.add(legs)
  }
  g.add(torso, head, armL, armR)

  let headYaw = 0
  return {
    group: g,
    lookAt(target: THREE.Vector3, dtMs: number) {
      const local = g.worldToLocal(target.clone())
      const want = Math.atan2(local.x, local.z)
      const maxTurn = 0.15 * (dtMs / 1000)
      headYaw += Math.max(-maxTurn, Math.min(maxTurn, want - headYaw))
      head.rotation.y = headYaw
    },
  }
}
