import * as THREE from 'three'

const BODY_M = new THREE.MeshLambertMaterial({ color: 0x4a4a58 })
const CHASER_M = new THREE.MeshLambertMaterial({ color: 0x16161c })

export interface Person {
  group: THREE.Group
  /** 숨쉬기·타이핑 미세 동작 + 머리만 아주 천천히 목표를 향해 회전 */
  update(dtMs: number, lookTarget?: THREE.Vector3): void
}

export function makePerson(opts: { seated?: boolean } = {}): Person {
  const g = new THREE.Group()
  const h = opts.seated ? 0.95 : 1.45 // 몸통 상단 높이

  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.19, opts.seated ? 0.5 : 0.85, 12),
    BODY_M,
  )
  torso.position.y = h - (opts.seated ? 0.25 : 0.42)
  // 어깨
  const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.14, 12), BODY_M)
  shoulder.position.y = h - 0.02
  // 목 + 머리
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 8), BODY_M)
  neck.position.y = h + 0.08
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 12), BODY_M)
  head.scale.y = 1.15
  head.position.y = h + 0.22

  // 팔 — 앉은 자세는 책상 쪽으로 뻗음 (타이핑)
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.42, 0.055), BODY_M)
  const armR = armL.clone()
  if (opts.seated) {
    armL.position.set(-0.2, h - 0.22, -0.14)
    armL.rotation.x = 1.15
    armR.position.set(0.2, h - 0.22, -0.14)
    armR.rotation.x = 1.15
  } else {
    armL.position.set(-0.23, h - 0.26, 0.02)
    armR.position.set(0.23, h - 0.26, 0.02)
  }

  if (!opts.seated) {
    const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.68, 10), BODY_M)
    legs.position.y = 0.34
    g.add(legs)
  } else {
    // 허벅지 (의자에 앉음)
    const lap = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.4), BODY_M)
    lap.position.set(0, 0.52, -0.12)
    g.add(lap)
  }
  g.add(torso, shoulder, neck, head, armL, armR)

  let headYaw = 0
  let t = 0
  return {
    group: g,
    update(dtMs: number, lookTarget?: THREE.Vector3) {
      t += dtMs / 1000
      // 숨쉬기 — 몸통이 아주 미세하게
      const breathe = 1 + Math.sin(t * 1.8) * 0.012
      torso.scale.set(1, breathe, 1)
      shoulder.position.y = h - 0.02 + Math.sin(t * 1.8) * 0.006
      // 타이핑 미동 (앉은 자세)
      if (opts.seated) {
        armL.position.y = h - 0.22 + Math.sin(t * 9.1) * 0.008
        armR.position.y = h - 0.22 + Math.sin(t * 8.3 + 1.7) * 0.008
      }
      if (lookTarget) {
        const local = g.worldToLocal(lookTarget.clone())
        const want = Math.atan2(local.x, local.z)
        const maxTurn = 0.15 * (dtMs / 1000) // 눈치채기 어려운 속도
        headYaw += Math.max(-maxTurn, Math.min(maxTurn, want - headYaw))
        head.rotation.y = headYaw
        neck.rotation.y = headYaw * 0.5
      }
    },
  }
}

export interface Chaser {
  group: THREE.Group
  /** ChaserAI output을 그대로 반영 */
  apply(pos: { x: number; z: number }, facing: number, dtMs: number): void
}

/** 추적자 — 2.3m 세장한 실루엣. 전신 디테일 없음, 가슴의 출입증만 희미하게 빛난다. */
export function makeChaser(): Chaser {
  const g = new THREE.Group()
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 1.35, 10), CHASER_M)
  torso.position.y = 1.35
  const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.12, 0.12, 10), CHASER_M)
  shoulder.position.y = 2.0
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), CHASER_M)
  head.scale.set(0.9, 1.5, 0.9)
  head.position.y = 2.22
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.75, 8), CHASER_M)
  legs.position.y = 0.37
  // 무릎까지 내려오는 긴 팔
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.15, 0.05), CHASER_M)
  armL.position.set(-0.2, 1.35, 0)
  const armR = armL.clone()
  armR.position.x = 0.2
  // 출입증 — 유일하게 빛나는 부분
  const badge = new THREE.Mesh(
    new THREE.PlaneGeometry(0.07, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xf0ead8 }),
  )
  badge.position.set(0.02, 1.62, 0.145)
  g.add(torso, shoulder, head, legs, armL, armR, badge)

  let t = 0
  return {
    group: g,
    apply(pos, facing, dtMs) {
      t += dtMs / 1000
      g.position.set(pos.x, 0, pos.z)
      g.rotation.y = facing
      // 출입증이 걸음에 따라 흔들리는 미광
      badge.rotation.z = Math.sin(t * 3.2) * 0.25
      // 팔이 걸음과 어긋난 박자로 미세하게 흔들림 — 부자연스러움
      armL.rotation.x = Math.sin(t * 2.3) * 0.14
      armR.rotation.x = Math.sin(t * 1.7 + 2.1) * 0.14
    },
  }
}
