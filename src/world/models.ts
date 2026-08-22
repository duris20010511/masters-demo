import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'

export interface LoadedModel {
  scene: THREE.Group
  animations: THREE.AnimationClip[]
}

const loader = new GLTFLoader()
const cache = new Map<string, Promise<LoadedModel>>()

/** GLB 로드 (캐시). 실패 시 reject — 호출측에서 프리미티브 폴백 처리. */
export function loadModel(url: string): Promise<LoadedModel> {
  let p = cache.get(url)
  if (!p) {
    p = loader.loadAsync(url).then(g => ({ scene: g.scene, animations: g.animations }))
    cache.set(url, p)
  }
  return p
}

/** 스킨드 메시 안전 복제 + 그림자 비활성 + 재질 틴트 옵션 */
export function instantiate(
  model: LoadedModel,
  opts: { tint?: number; scale?: number } = {},
): { root: THREE.Group; mixer: THREE.AnimationMixer; clips: THREE.AnimationClip[] } {
  const root = cloneSkeleton(model.scene) as THREE.Group
  if (opts.scale) root.scale.setScalar(opts.scale)
  root.traverse(o => {
    const mesh = o as THREE.Mesh
    if (mesh.isMesh) {
      mesh.castShadow = false
      mesh.receiveShadow = false
      if (opts.tint !== undefined) {
        const m = (mesh.material as THREE.MeshStandardMaterial).clone()
        m.color = new THREE.Color(opts.tint)
        mesh.material = m
      }
    }
  })
  const mixer = new THREE.AnimationMixer(root)
  return { root, mixer, clips: model.animations }
}

export function playClip(
  mixer: THREE.AnimationMixer,
  clips: THREE.AnimationClip[],
  names: string[],
  fallbackIndex = 0,
): THREE.AnimationAction | null {
  let clip: THREE.AnimationClip | undefined
  for (const n of names) {
    clip = clips.find(c => c.name.toLowerCase().includes(n.toLowerCase()))
    if (clip) break
  }
  clip ??= clips[fallbackIndex]
  if (!clip) return null
  const action = mixer.clipAction(clip)
  action.play()
  return action
}
