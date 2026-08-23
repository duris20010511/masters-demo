import * as THREE from 'three'
import { makeDoor, makePlateTexture } from './props'
import { makeGlowSprite, makeExitSign } from './textures'
import { surface } from './materials'

const M = {
  // 알베도를 너무 낮추면 어떤 조명으로도 안 보인다 — 어둠은 조명·안개로 만든다
  wallDark: surface('wall', { repeatX: 2, repeatY: 1.2, color: 0x9a9aa4 }),
  floorDark: surface('floor', { repeatX: 2, repeatY: 12, color: 0x8f8f96 }),
  lamp: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  redLamp: new THREE.MeshBasicMaterial({ color: 0xff2a1a }),
}

function box(w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
  mesh.position.set(x, y, z)
  return mesh
}

export interface RecessZone {
  side: -1 | 1
  zMin: number
  zMax: number
}

export interface CorridorRig {
  group: THREE.Group
  length: number // 복도는 z=0에서 -length까지
  endDoorZ: number
  wallMeshes: THREE.Mesh[] // occlusion 레이캐스트용
  recessZones: RecessZone[] // 문 알코브 (숨을 공간) — 플레이어 이동 클램프에 사용
  setAllPlates(text: string): void
}

const SEG = 4 // 세그먼트 길이(m)
const SEGS = 8
const W = 2.4 // 폭
const DOOR_W = 1.0
const RECESS = 0.45 // 알코브 깊이

export const CORRIDOR = { SEG, SEGS, W, DOOR_W, RECESS }

export function buildCorridor(opts: { dark: boolean; segments?: number }): CorridorRig {
  const g = new THREE.Group()
  const segs = opts.segments ?? SEGS
  const length = SEG * segs
  const wall = opts.dark ? M.wallDark : surface('wall', { repeatX: 8, repeatY: 1.2 })
  const floor = opts.dark
    ? M.floorDark
    : surface('floor', { repeatX: 2, repeatY: (length + 4) / 2, color: 0xb8b8bc })
  const ceil = opts.dark
    ? M.wallDark
    : surface('ceil', { repeatX: 2, repeatY: (length + 4) / 3 })
  const walls: THREE.Mesh[] = []
  const recessZones: RecessZone[] = []

  const mkWall = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const m = box(w, h, d, wall, x, y, z)
    walls.push(m)
    g.add(m)
  }

  // 바닥·천장 (알코브 폭까지 커버)
  g.add(box(W + RECESS * 2 + 0.2, 0.1, length + 4, floor, 0, -0.05, -length / 2 + 1))
  g.add(box(W + RECESS * 2 + 0.2, 0.1, length + 4, ceil, 0, 3, -length / 2 + 1))
  // 시작 쪽 막힌 벽
  mkWall(W + RECESS * 2, 3, 0.1, 0, 1.5, 2.4)

  const plateMats: THREE.MeshBasicMaterial[] = []
  for (let i = 0; i < segs; i++) {
    const zs = -SEG * i + 2 // 세그먼트 시작 (시작벽 z=2.4에 맞춤)
    const zc = zs - 2 // 문 중심
    // 조명
    if (opts.dark) {
      // 비상등: 전 세그먼트 (시야 확보 — 유저 피드백)
      g.add(box(0.1, 0.5, 0.18, M.redLamp, -W / 2 + 0.06, 2.4, zc))
      const glow = makeGlowSprite(1.6, 1.6, 0xff3322)
      glow.position.set(-W / 2 + 0.2, 2.4, zc)
      g.add(glow)
    } else {
      g.add(box(0.9, 0.04, 0.35, M.lamp, 0, 2.95, zc))
      const glow = makeGlowSprite(1.8, 1.0)
      glow.position.set(0, 2.82, zc)
      g.add(glow)
    }
    // 양옆: 벽 조각 2개 + 알코브(뒷벽·옆벽 2) + 문 + 명패
    for (const side of [-1, 1] as const) {
      const x0 = side * (W / 2)
      // 문 앞뒤 벽 조각
      mkWall(0.1, 3, SEG / 2 - DOOR_W / 2, x0, 1.5, zs - (SEG / 2 - DOOR_W / 2) / 2)
      mkWall(0.1, 3, SEG / 2 - DOOR_W / 2, x0, 1.5, zs - SEG + (SEG / 2 - DOOR_W / 2) / 2)
      // 알코브 뒷벽·옆벽
      mkWall(0.1, 3, DOOR_W + 0.1, side * (W / 2 + RECESS), 1.5, zc)
      mkWall(RECESS, 3, 0.1, side * (W / 2 + RECESS / 2), 1.5, zc + DOOR_W / 2)
      mkWall(RECESS, 3, 0.1, side * (W / 2 + RECESS / 2), 1.5, zc - DOOR_W / 2)
      // 문 (알코브 안쪽)
      const door = makeDoor()
      door.position.set(side * (W / 2 + RECESS - 0.07), 0, zc)
      door.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2
      g.add(door)
      // 명패 (알코브 옆벽 앞면)
      const num = String(401 + ((i * 2 + (side > 0 ? 1 : 0)) % 8))
      const mat = new THREE.MeshBasicMaterial({ map: makePlateTexture(`${num}호`) })
      plateMats.push(mat)
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), mat)
      plate.position.set(side * (W / 2 - 0.02), 2.0, zc + DOOR_W / 2 + 0.25)
      plate.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2
      g.add(plate)
      recessZones.push({ side, zMin: zc - (DOOR_W / 2 - 0.08), zMax: zc + (DOOR_W / 2 - 0.08) })
    }
  }

  // 끝 문 (정문/면담실)
  const endDoorZ = -length + 1.6
  const endDoor = makeDoor()
  endDoor.scale.set(1.6, 1.05, 1)
  endDoor.position.set(0, 0, endDoorZ - 0.4)
  g.add(endDoor)
  mkWall(W + RECESS * 2, 3, 0.1, 0, 1.5, endDoorZ - 0.5)
  // 비상구 표지
  const exit = makeExitSign()
  exit.position.set(0, 2.55, endDoorZ - 0.33)
  g.add(exit)
  if (opts.dark) {
    const exitGlow = makeGlowSprite(1.2, 0.7, 0x22cc66)
    exitGlow.position.set(0, 2.55, endDoorZ - 0.2)
    g.add(exitGlow)
  }

  return {
    group: g,
    length,
    endDoorZ,
    wallMeshes: walls,
    recessZones,
    setAllPlates(text: string) {
      const tex = makePlateTexture(text)
      for (const m of plateMats) {
        m.map = tex
        m.needsUpdate = true
      }
    },
  }
}
