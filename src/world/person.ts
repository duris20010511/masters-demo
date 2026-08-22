import * as THREE from 'three'
import { distortChaser, loadModel, instantiate, playClip } from './models'

// MakeHuman/MPFB 2 기반 CC0 디지털 휴먼. 텍스처와 locomotion clip이 GLB에 내장되어 있다.
const MODEL_URL = {
  man: './assets/models/makehuman-man.glb',
  suit: './assets/models/makehuman-suited.glb',
  woman: './assets/models/makehuman.glb',
  monster: './assets/models/makehuman-man.glb',
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

/** 추적자 — 동료와 같은 디지털 휴먼을 길게 왜곡한 형체. */
export function makeChaser(): Chaser {
  const g = new THREE.Group()
  const fallback = primitiveFallback(false)
  fallback.scale.setScalar(1.4)
  g.add(fallback)
  // 출입증 — 유일하게 빛나는 부분
  const badge = new THREE.Mesh(
    new THREE.PlaneGeometry(0.07, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xf0ead8 }),
  )
  badge.position.set(0.02, 1.12, 0.3) // 구부정한 걸음 자세의 가슴 높이
  g.add(badge)

  let mixer: THREE.AnimationMixer | null = null
  let clips: THREE.AnimationClip[] = []
  let current: { name: string; action: THREE.AnimationAction } | null = null
  let t = 0

  const CLIP: Record<ChaserMode, string> = { idle: 'Idle', walk: 'Walk', run: 'Run' }

  function setMode(mode: ChaserMode): void {
    if (!mixer) return
    const name = CLIP[mode]
    if (current?.name === name) return
    const clip = clips.find(c => c.name.toLowerCase() === name.toLowerCase())
    if (!clip) return
    const action = mixer.clipAction(clip)
    action.reset().fadeIn(0.25).play()
    current?.action.fadeOut(0.25)
    current = { name, action }
  }

  void loadModel(MODEL_URL.monster)
    .then(model => {
      const inst = instantiate(model, { scale: 1.12, tint: 0x241110 })
      distortChaser(inst.root)
      g.remove(fallback)
      g.add(inst.root)
      mixer = inst.mixer
      clips = inst.clips
      setMode('walk')
    })
    .catch(e => {
      console.warn('[chaser] load failed', e)
    })

  return {
    group: g,
    apply(pos, facing, dtMs, mode) {
      t += dtMs / 1000
      g.position.set(pos.x, 0, pos.z)
      g.rotation.y = facing
      setMode(mode)
      mixer?.update(dtMs / 1000)
      badge.rotation.z = Math.sin(t * 3.2) * 0.25 // 출입증이 걸음에 흔들리는 미광
    },
  }
}
