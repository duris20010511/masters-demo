import * as THREE from 'three'
import { loadModel, instantiate, playClip } from './models'

// MakeHuman/MPFB 2 기반 CC0 디지털 휴먼. 텍스처와 locomotion clip이 GLB에 내장되어 있다.
const MODEL_URL = {
  man: './assets/models/makehuman-suited.glb', // 옷 입은 변형만 사용 (베이스는 알몸)
  suit: './assets/models/makehuman-suited.glb',
  woman: './assets/models/makehuman-suited.glb',
  monster: './assets/models/gaunt.glb', // Gaunt Horror Creature (CC-BY-4.0, PurplePoint)
}

const BODY_M = new THREE.MeshLambertMaterial({ color: 0x4a4a58 })

// 주의: 스킨드 메시는 Box3 측정이 엉터리(바인드 전 지오메트리 경계)라 자동 정규화 불가.
// Quaternius 캐릭터는 원본 ~1.8유닛 — 고정 스케일 사용.

/** 로드 전/실패 시 표시되는 단순 실루엣 */
function primitiveFallback(seated: boolean): THREE.Group {
  const g = new THREE.Group()
  const h = seated ? 0.95 : 1.45
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.19, seated ? 0.5 : 0.85, 12), BODY_M)
  torso.position.y = h - (seated ? 0.25 : 0.42)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 12), BODY_M)
  head.position.y = h + 0.22
  g.add(torso, head)
  return g
}

export interface Person {
  group: THREE.Group
  /** 애니메이션 진행 + 머리만 아주 천천히 목표를 향해 회전 */
  update(dtMs: number, lookTarget?: THREE.Vector3): void
}

export function makePerson(
  opts: { seated?: boolean; variant?: 'man' | 'suit' | 'woman' } = {},
): Person {
  const g = new THREE.Group()
  const fallback = primitiveFallback(!!opts.seated)
  g.add(fallback)

  let mixer: THREE.AnimationMixer | null = null
  let headBone: THREE.Object3D | null = null
  let headRestY = 0
  let headYaw = 0

  void loadModel(MODEL_URL[opts.variant ?? 'man'])
    .then(model => {
      const inst = instantiate(model, { scale: 1.0 })
      playClip(inst.mixer, inst.clips, ['Idle'])
      g.remove(fallback)
      g.add(inst.root)
      mixer = inst.mixer
      headBone = inst.root.getObjectByName('head') ?? inst.root.getObjectByName('Head') ?? null
      headRestY = headBone?.rotation.y ?? 0
    })
    .catch(e => {
      console.warn('[person] load failed', e)
    })

  return {
    group: g,
    update(dtMs: number, lookTarget?: THREE.Vector3) {
      // 클립이 머리 본을 애니메이션하지 않는 모델에서 += 가 누적되지 않도록,
      // 믹서 전에 기본값으로 되돌리고(애니메이션이 있으면 믹서가 덮어씀) 후에 얹는다
      if (headBone) headBone.rotation.y = headRestY
      mixer?.update(dtMs / 1000)
      if (headBone && lookTarget) {
        const local = g.worldToLocal(lookTarget.clone())
        const want = Math.max(-0.9, Math.min(0.9, Math.atan2(local.x, local.z)))
        const maxTurn = 0.15 * (dtMs / 1000) // 눈치채기 어려운 속도
        headYaw += Math.max(-maxTurn, Math.min(maxTurn, want - headYaw))
        headBone.rotation.y += headYaw
      }
    },
  }
}

export type ChaserMode = 'idle' | 'walk' | 'run'

export interface Chaser {
  group: THREE.Group
  /** ChaserAI output을 그대로 반영 */
  apply(pos: { x: number; z: number }, facing: number, dtMs: number, mode: ChaserMode): void
}

/**
 * 추적자 — Gaunt Horror Creature (정적 모델).
 * 뼈대·애니메이션이 없는 대신 "손상된 기록" 세계관대로 **스톱모션 글리치 이동**:
 * 위치·방향이 걸음 간격마다 뚝뚝 끊기며 스냅되고, 스냅 순간 미세하게 뒤틀린다.
 */
export function makeChaser(): Chaser {
  const g = new THREE.Group()
  const fallback = primitiveFallback(false)
  fallback.scale.setScalar(1.4)
  g.add(fallback)
  // 출입증 — 어둠 속에서 빛나는 부분 (직위: 석사과정)
  const badge = new THREE.Mesh(
    new THREE.PlaneGeometry(0.07, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xf0ead8 }),
  )
  badge.position.set(0.03, 1.35, 0.22)
  g.add(badge)

  let acc = 0
  let stepT = 0
  const target = { x: 0, z: 0, facing: 0 }

  void loadModel(MODEL_URL.monster)
    .then(model => {
      const root = model.scene.clone(true)
      const box = new THREE.Box3().setFromObject(root) // 정적 메시 — Box3 신뢰 가능
      const h = box.max.y - box.min.y
      const s = 2.3 / h
      root.scale.setScalar(s)
      root.position.y = -box.min.y * s // 발이 y=0
      // 텍스처는 살리고 어둠 속 실루엣만 배어나오게 약한 자발광
      root.traverse(o => {
        const mesh = o as THREE.Mesh
        if (mesh.isMesh) {
          const m = mesh.material as THREE.MeshStandardMaterial
          if (m && 'emissive' in m) {
            m.emissive = new THREE.Color(0x2a0a08)
            m.emissiveIntensity = 0.7
          }
        }
      })
      g.remove(fallback)
      g.add(root)
    })
    .catch(e => {
      console.warn('[chaser] load failed', e)
    })

  return {
    group: g,
    apply(pos, facing, dtMs, mode) {
      acc += dtMs
      stepT += dtMs
      target.x = pos.x
      target.z = pos.z
      target.facing = facing
      // 스톱모션: 걸음 간격마다만 실제 위치를 스냅 (뛸수록 간격이 짧아짐)
      const stepMs = mode === 'run' ? 130 : mode === 'walk' ? 300 : 550
      if (stepT >= stepMs) {
        stepT = 0
        g.position.set(target.x, 0, target.z)
        g.rotation.y = target.facing
        // 스냅 순간의 뒤틀림 — 프레임 깨진 데이터처럼
        const j = Math.sin(acc * 0.013)
        g.rotation.z = j * 0.05
        g.rotation.x = mode === 'run' ? 0.09 + j * 0.03 : j * 0.02
      }
      badge.rotation.z = Math.sin(acc * 0.0032) * 0.25
    },
  }
}
