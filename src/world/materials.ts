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

/** wall = 거친 콘크리트(추격전 지하복도) / plaster = 도장 미장(연구실·정상 복도) */
export type SurfaceKind = 'wall' | 'plaster' | 'floor' | 'ceil'

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

/** 미터당 텍스처 반복 수 — 벽/바닥은 텍스처 1장이 2m, 천장 패널은 1.2m */
export const PER_M = { wall: 0.5, plaster: 0.42, floor: 0.5, ceil: 0.85 } as const

/**
 * 면별 UV를 실제 치수에 비례하도록 다시 매긴 BoxGeometry.
 *
 * BoxGeometry는 면마다 UV가 0..1이라, 길이가 제각각인 벽들이 같은 재질을 쓰면
 * 22m 벽에도 1.5m 벽에도 텍스처가 똑같이 한 장 깔려 심하게 늘어난다.
 * 재질의 repeat 대신 UV로 밀도를 맞추면 재질 하나를 공유하면서도
 * 모든 면에서 타일 크기가 같아진다.
 */
export function boxUV(w: number, h: number, d: number, perMeter: number): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(w, h, d)
  const uv = geo.attributes.uv as THREE.BufferAttribute
  // BoxGeometry 면 순서: +X, -X, +Y, -Y, +Z, -Z (면당 정점 4개)
  const spans: Array<[number, number]> = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]
  for (let f = 0; f < 6; f++) {
    const [su, sv] = spans[f]
    for (let i = f * 4; i < f * 4 + 4; i++)
      uv.setXY(i, uv.getX(i) * su * perMeter, uv.getY(i) * sv * perMeter)
  }
  uv.needsUpdate = true
  return geo
}

/** 텍스처 없는 단색 표면 (소품·가구용) — Lambert 대신 Standard로 통일 */
export function solid(color: number, roughness = 0.85, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness })
}
