import * as THREE from 'three'
import { loadModel, instantiate, playClip } from './models'

// Sketchfab CC-BY 인물 3종 (ATTRIBUTION.md 참조) + 크리처
const MODEL_URL = {
  man: './assets/models/colleague-man.glb', // 캐주얼 재킷 남성 (manoeldarochadeoliveira)
  sitting: './assets/models/colleague-sitting.glb', // 앉은 자세 전용 (Ace-of_spades)
  suit: './assets/models/professor.glb', // 정장 남성 — 교수용 (같은 작가)
  woman: './assets/models/colleague-woman.glb', // 안경+니트 여성 (yuriannoue)
  monster: './assets/models/crawler.glb', // 기어오는 변이 인간 (CC-BY-4.0, Elisey) — crawl 애니 내장
}

// 스킨드 메시는 지오메트리 경계가 무의미 — **관절(joint) 바인드 위치** 실측 기반 고정 스케일
// (man 1.73m / woman 3.35m / suit 1.70m / sitting 3.57m 원본)
const PERSON_SCALE: Record<'man' | 'sitting' | 'suit' | 'woman', number> = {
  man: 1.0,
  sitting: 1.74 / 3.57,
  suit: 1.035,
  woman: 1.66 / 3.35,
}

const BODY_M = new THREE.MeshStandardMaterial({ color: 0x4a4a58 })

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
  /** 이름(부분 일치)으로 클립 크로스페이드 전환 — 예: play(['walk']) */
  play(names: string[]): void
}

export function makePerson(
  opts: { seated?: boolean; variant?: 'man' | 'sitting' | 'suit' | 'woman' } = {},
): Person {
  const g = new THREE.Group()
  const fallback = primitiveFallback(!!opts.seated)
  g.add(fallback)

  let mixer: THREE.AnimationMixer | null = null
  let clips: THREE.AnimationClip[] = []
  let currentAction: THREE.AnimationAction | null = null
  let pendingPlay: string[] | null = null
  let headBone: THREE.Object3D | null = null
  let headRestY = 0
  let headYaw = 0

  function crossfade(names: string[]): void {
    if (!mixer) return
    const clip = names
      .map(n => clips.find(c => c.name.toLowerCase().includes(n.toLowerCase())))
      .find(Boolean)
    if (!clip || currentAction?.getClip() === clip) return
    const action = mixer.clipAction(clip)
    action.reset().fadeIn(0.3).play()
    currentAction?.fadeOut(0.3)
    currentAction = action
  }

  const variant = opts.variant ?? 'man'
  void loadModel(MODEL_URL[variant])
    .then(model => {
      const inst = instantiate(model, { scale: PERSON_SCALE[variant] })
      currentAction = playClip(inst.mixer, inst.clips, ['Idle'])
      g.remove(fallback)
      g.add(inst.root)
      mixer = inst.mixer
      clips = inst.clips
      if (pendingPlay) {
        crossfade(pendingPlay)
        pendingPlay = null
      }
      // 머리 본은 리그마다 이름이 다르다: Head, Head_06, Head_044 …
      inst.root.traverse(o => {
        if (!headBone && /^head[_0-9]*$/i.test(o.name)) headBone = o
      })
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
    play(names: string[]) {
      if (mixer) crossfade(names)
      else pendingPlay = names // 로드 전 호출 대비
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
 * 추적자 — 네발로 기어오는 변이 인간 (crawl 애니메이션 내장).
 * 이동·회전은 지수 보간, 걸음은 애니메이션이 담당. 속도에 따라 재생 속도만 조절.
 */
export function makeChaser(): Chaser {
  const g = new THREE.Group()
  const fallback = primitiveFallback(false)
  fallback.scale.setScalar(1.4)
  g.add(fallback)
  // 출입증 — 어둠 속에서 빛나는 부분 (직위: 석사과정). 기는 자세라 목 아래 낮게
  const badge = new THREE.Mesh(
    new THREE.PlaneGeometry(0.07, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xf0ead8 }),
  )
  badge.position.set(0.02, 0.8, 0.85)
  g.add(badge)

  let acc = 0
  let yaw = 0
  let mixer: THREE.AnimationMixer | null = null

  void loadModel(MODEL_URL.monster)
    .then(model => {
      const inst = instantiate(model)
      // FBX 유래 모델은 단위가 제각각 — 바인드 포즈 높이가 상식 범위(0.5~3m)를
      // 벗어나면 서 있는 인간 1.9m 기준으로 정규화
      // 관절 바인드 실측: 몸길이 174.5유닛 → 기는 몸길이 2.4m 목표
      inst.root.scale.multiplyScalar(2.4 / 174.5)
      // 텍스처는 살리고 어둠 속 실루엣만 배어나오게 약한 자발광
      inst.root.traverse(o => {
        const mesh = o as THREE.Mesh
        if (mesh.isMesh) {
          const m = mesh.material as THREE.MeshStandardMaterial
          if (m && 'emissive' in m) {
            m.emissive = new THREE.Color(0x2a0a08)
            m.emissiveIntensity = 0.7
          }
        }
      })
      playClip(inst.mixer, inst.clips, ['Layer0'], 0) // 단일 crawl 클립
      g.remove(fallback)
      g.add(inst.root)
      mixer = inst.mixer
    })
    .catch(e => {
      console.warn('[chaser] load failed', e)
    })

  return {
    group: g,
    apply(pos, facing, dtMs, mode) {
      acc += dtMs
      // 위치·방향 지수 보간 — 부드럽게
      const k = 1 - Math.exp(-dtMs / 90)
      g.position.x += (pos.x - g.position.x) * k
      g.position.z += (pos.z - g.position.z) * k
      let d = facing - yaw
      d = Math.atan2(Math.sin(d), Math.cos(d))
      yaw += d * k
      g.rotation.y = yaw
      // 기는 애니메이션 재생 속도 = 이동 속도
      if (mixer) {
        mixer.timeScale = mode === 'run' ? 1.8 : mode === 'walk' ? 1.0 : 0.35
        mixer.update(dtMs / 1000)
      }
      badge.rotation.z = Math.sin(acc * 0.0032) * 0.25
    },
  }
}
