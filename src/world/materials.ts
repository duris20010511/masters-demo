import * as THREE from 'three'

/**
 * PBR 월드 재질 — ambientCG CC0 텍스처(Color/Normal/Roughness) 기반.
 *
 * 중요: MeshLambertMaterial은 normalMap·roughnessMap·envMap을 **무시**한다.
 * 요철과 광택을 얻으려면 반드시 MeshStandardMaterial이어야 한다.
 */

const loader = new THREE.TextureLoader()
const cache = new Map<string, THREE.Texture>()

function tex(name: string, srgb: boolean, repeat: THREE.Vector2): THREE.Texture {
  const key = `${name}|${repeat.x}x${repeat.y}`
  const hit = cache.get(key)
  if (hit) return hit
  const t = loader.load(`./assets/textures/${name}.webp`)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.copy(repeat)
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace // 데이터맵은 선형
  t.anisotropy = 4
  cache.set(key, t)
  return t
}

export type SurfaceKind = 'wall' | 'floor' | 'ceil'

interface SurfaceOpts {
  /** 미터당 텍스처 반복 수 — 실제 타일 크기에 맞춘다 */
  repeatX: number
  repeatY: number
  color?: number
  roughness?: number
}

/** 표면 재질 생성 (Color+Normal+Roughness 세트) */
export function surface(kind: SurfaceKind, o: SurfaceOpts): THREE.MeshStandardMaterial {
  const r = new THREE.Vector2(o.repeatX, o.repeatY)
  return new THREE.MeshStandardMaterial({
    map: tex(`${kind}-color`, true, r),
    normalMap: tex(`${kind}-normal`, false, r),
    roughnessMap: tex(`${kind}-rough`, false, r),
    normalScale: new THREE.Vector2(1, 1),
    color: o.color ?? 0xffffff,
    roughness: o.roughness ?? 1,
    metalness: 0,
  })
}

/** 텍스처 없는 단색 표면 (소품·가구용) — Lambert 대신 Standard로 통일 */
export function solid(color: number, roughness = 0.85, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness })
}
