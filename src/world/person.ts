import * as THREE from 'three'
import { loadModel, instantiate, playClip } from './models'

// 외부 CC0 모델 (Quaternius, poly.pizza static CDN에서 다운로드해 저장소에 커밋)
const MODEL_URL = {
  man: './assets/models/man-longsleeve.glb',
  suit: './assets/models/man-suit.glb',
  woman: './assets/models/woman-casual.glb',
  zombie: './assets/models/zombie.glb',
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
  let headYaw = 0

  void loadModel(MODEL_URL[opts.variant ?? 'man'])
    .then(model => {
      // 원본 ~3.2유닛 → 1.7m. Sitting은 의자 정렬이 깨져서 서 있는 Idle로 통일.
      const inst = instantiate(model, { scale: 0.53 })
      playClip(inst.mixer, inst.clips, ['Idle'])
      g.remove(fallback)
      g.add(inst.root)
      mixer = inst.mixer
      headBone = inst.root.getObjectByName('Head') ?? null
    })
    .catch(e => {
      console.warn('[person] load failed', e)
    })

  return {
    group: g,
    update(dtMs: number, lookTarget?: THREE.Vector3) {
      mixer?.update(dtMs / 1000)
      // 믹서가 포즈를 덮어쓴 뒤에 머리 회전을 얹는다
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

/** 추적자 — 좀비 모델. 가슴의 출입증만 빛난다 (직위: 석사과정). */
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
  badge.position.set(0.02, 1.5, 0.16)
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
    const clip =
      clips.find(c => c.name === name) ?? clips.find(c => c.name.endsWith(`|${name}`))
    if (!clip) return
    const action = mixer.clipAction(clip)
    action.reset().fadeIn(0.25).play()
    current?.action.fadeOut(0.25)
    current = { name, action }
  }

  void loadModel(MODEL_URL.zombie)
    .then(model => {
      const inst = instantiate(model, { scale: 0.68 }) // ~2.2m 추적자
      // 완전 어둠에서도 실루엣이 배어나오게 — 어두운 적색 자발광
      inst.root.traverse(o => {
        const mesh = o as THREE.Mesh
        if (mesh.isMesh) {
          const m = mesh.material as THREE.MeshStandardMaterial
          if (m && 'emissive' in m) {
            m.emissive = new THREE.Color(0x3a0d08)
            m.emissiveIntensity = 1
          }
        }
      })
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
