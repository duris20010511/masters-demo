import * as THREE from 'three'
import { makeDoor, makePlateTexture } from './props'
import { makeGlowSprite, makeExitSign } from './textures'

/**
 * ㅁ자 순환 맵 — 가운데가 막힌 사각 링 복도 + 바깥으로 붙은 방 3개.
 *
 * 직선 복도와 달리 (a) 추적자를 돌아서 따돌릴 수 있고 (b) 막다른 길이 없어
 * 플레이어가 갇히지 않으며 (c) 방을 뒤지는 동안 어느 쪽에서 올지 모른다.
 *
 *        ┌────── 북 ──────┐   ← 방C 문
 *        │   ▓▓ 안쪽 ▓▓   │
 *  방A문 서              동  방B문
 *        │   ▓▓ 막힘 ▓▓   │
 *        └────── 남 ──────┘   ← 출구(면담실)
 */

const M = {
  wall: new THREE.MeshLambertMaterial({ color: 0x6a6a74 }),
  inner: new THREE.MeshLambertMaterial({ color: 0x5c5c66 }),
  floor: new THREE.MeshLambertMaterial({ color: 0x55555c }),
  ceil: new THREE.MeshLambertMaterial({ color: 0x3a3a42 }),
  redLamp: new THREE.MeshBasicMaterial({ color: 0xff2a1a }),
  desk: new THREE.MeshLambertMaterial({ color: 0x8b8577 }),
}

// 링 바깥 경계
const OUT = { xMin: -11, xMax: 11, zMin: -17, zMax: 1 }
const CORRIDOR_W = 2.8
// 가운데 막힌 블록
const IN = {
  xMin: OUT.xMin + CORRIDOR_W,
  xMax: OUT.xMax - CORRIDOR_W,
  zMin: OUT.zMin + CORRIDOR_W,
  zMax: OUT.zMax - CORRIDOR_W,
}
const H = 3 // 천장 높이
const T = 0.12 // 벽 두께

export interface RoomSpec {
  name: string
  /** 자료가 놓이는 지점 */
  spot: THREE.Vector3
  /** 방 중심 (조명·소품 배치용) */
  center: THREE.Vector3
}

export interface LoopMapRig {
  group: THREE.Group
  wallMeshes: THREE.Mesh[]
  spawn: THREE.Vector3
  /** 면담실 문 앞 지점 */
  exit: THREE.Vector3
  rooms: RoomSpec[]
  /** 추적자 순찰 경로 (링을 도는 4개 코너) */
  patrol: { x: number; z: number }[]
  bounds: { min: THREE.Vector3; max: THREE.Vector3 }
}

export function buildLoopMap(): LoopMapRig {
  const g = new THREE.Group()
  const walls: THREE.Mesh[] = []

  const wall = (w: number, d: number, x: number, z: number, mat = M.wall): void => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), mat)
    m.position.set(x, H / 2, z)
    walls.push(m)
    g.add(m)
  }

  /** 한 줄로 이어진 벽을 만들되, gaps 구간(문)만 비운다 */
  const wallRun = (
    axis: 'x' | 'z',
    fixed: number,
    from: number,
    to: number,
    gaps: Array<[number, number]> = [],
  ): void => {
    const sorted = [...gaps].sort((a, b) => a[0] - b[0])
    let cur = from
    for (const [gs, ge] of sorted) {
      if (gs > cur) {
        const len = gs - cur
        if (axis === 'x') wall(len, T, cur + len / 2, fixed)
        else wall(T, len, fixed, cur + len / 2)
      }
      cur = Math.max(cur, ge)
    }
    if (to > cur) {
      const len = to - cur
      if (axis === 'x') wall(len, T, cur + len / 2, fixed)
      else wall(T, len, fixed, cur + len / 2)
    }
  }

  // ── 바닥·천장 (방까지 덮는 큰 판) ──────────────────────────
  const FLOOR = { xMin: -19, xMax: 19, zMin: -25, zMax: 8 }
  const fw = FLOOR.xMax - FLOOR.xMin
  const fd = FLOOR.zMax - FLOOR.zMin
  const fx = (FLOOR.xMin + FLOOR.xMax) / 2
  const fz = (FLOOR.zMin + FLOOR.zMax) / 2
  const floor = new THREE.Mesh(new THREE.BoxGeometry(fw, 0.1, fd), M.floor)
  floor.position.set(fx, -0.05, fz)
  g.add(floor)
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(fw, 0.1, fd), M.ceil)
  ceil.position.set(fx, H, fz)
  g.add(ceil)

  // ── 방 정의 (문 폭 2m) ────────────────────────────────────
  const DOORW = 2
  const rooms: RoomSpec[] = [
    {
      name: '자료실',
      center: new THREE.Vector3(-14.5, 0, -8),
      spot: new THREE.Vector3(-15.6, 0.1, -9.4),
    },
    {
      name: '실험실',
      center: new THREE.Vector3(14.5, 0, -8),
      spot: new THREE.Vector3(15.6, 0.1, -6.6),
    },
    {
      name: '교수 연구실',
      center: new THREE.Vector3(5, 0, 4.5),
      spot: new THREE.Vector3(6.6, 0.1, 5.8),
    },
  ]

  // ── 바깥 링 벽 (문 자리만 뚫음) ────────────────────────────
  // 북(z=+1): 교수 연구실 문
  wallRun('x', OUT.zMax, OUT.xMin, OUT.xMax, [[5 - DOORW / 2, 5 + DOORW / 2]])
  // 남(z=-17): 출구(면담실)
  wallRun('x', OUT.zMin, OUT.xMin, OUT.xMax, [[-DOORW / 2, DOORW / 2]])
  // 서(x=-11): 자료실 문
  wallRun('z', OUT.xMin, OUT.zMin, OUT.zMax, [[-8 - DOORW / 2, -8 + DOORW / 2]])
  // 동(x=+11): 실험실 문
  wallRun('z', OUT.xMax, OUT.zMin, OUT.zMax, [[-8 - DOORW / 2, -8 + DOORW / 2]])

  // ── 가운데 막힌 블록 ───────────────────────────────────────
  wallRun('x', IN.zMax, IN.xMin, IN.xMax)
  wallRun('x', IN.zMin, IN.xMin, IN.xMax)
  wallRun('z', IN.xMin, IN.zMin, IN.zMax)
  wallRun('z', IN.xMax, IN.zMin, IN.zMax)
  // 블록 속을 시각적으로 채움 (안쪽이 비어 보이지 않게)
  const core = new THREE.Mesh(
    new THREE.BoxGeometry(IN.xMax - IN.xMin - 0.3, H, IN.zMax - IN.zMin - 0.3),
    M.inner,
  )
  core.position.set((IN.xMin + IN.xMax) / 2, H / 2, (IN.zMin + IN.zMax) / 2)
  g.add(core)

  // ── 방 벽 ─────────────────────────────────────────────────
  // 자료실 (서쪽 바깥): x -18..-11, z -11.5..-4.5
  wallRun('z', -18, -11.5, -4.5)
  wallRun('x', -11.5, -18, -11)
  wallRun('x', -4.5, -18, -11)
  // 실험실 (동쪽 바깥): x 11..18
  wallRun('z', 18, -11.5, -4.5)
  wallRun('x', -11.5, 11, 18)
  wallRun('x', -4.5, 11, 18)
  // 교수 연구실 (북쪽 바깥): x 1.5..8.5, z 1..8
  wallRun('x', 8, 1.5, 8.5)
  wallRun('z', 1.5, 1, 8)
  wallRun('z', 8.5, 1, 8)

  // ── 문짝·명패 ─────────────────────────────────────────────
  const doorAt = (x: number, z: number, ry: number, label: string): void => {
    const d = makeDoor()
    d.position.set(x, 0, z)
    d.rotation.y = ry
    d.scale.set(1.9, 1.05, 1) // 문 폭 2m에 맞춤
    g.add(d)
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.44, 0.22),
      new THREE.MeshBasicMaterial({ map: makePlateTexture(label) }),
    )
    plate.position.set(x, 2.35, z)
    plate.rotation.y = ry
    g.add(plate)
  }
  // 문은 열려 있는 상태 — 통로 옆에 붙여 세운다 (통행 방해 없음)
  doorAt(-11.05, -8 - DOORW / 2 - 0.5, Math.PI / 2, '자료실')
  doorAt(11.05, -8 + DOORW / 2 + 0.5, -Math.PI / 2, '실험실')
  doorAt(5 - DOORW / 2 - 0.5, 1.05, 0, '교수실')

  // ── 출구(면담실) 표시 ─────────────────────────────────────
  const exitSign = makeExitSign()
  exitSign.position.set(0, 2.5, OUT.zMin + 0.1)
  exitSign.rotation.y = 0
  g.add(exitSign)
  const exitGlow = makeGlowSprite(1.6, 0.9, 0x22cc66)
  exitGlow.position.set(0, 2.4, OUT.zMin + 0.3)
  g.add(exitGlow)

  // ── 붉은 비상등 (링 8곳 + 방 3곳) ─────────────────────────
  const lamp = (x: number, z: number): void => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.16), M.redLamp)
    b.position.set(x, 2.45, z)
    g.add(b)
    const gl = makeGlowSprite(2.0, 2.0, 0xff3322)
    gl.position.set(x, 2.45, z)
    g.add(gl)
  }
  for (const z of [-2.4, -8, -13.6]) {
    lamp(OUT.xMin + 0.35, z)
    lamp(OUT.xMax - 0.35, z)
  }
  for (const x of [-6, 6]) {
    lamp(x, OUT.zMax - 0.35)
    lamp(x, OUT.zMin + 0.35)
  }
  for (const r of rooms) lamp(r.center.x, r.center.z)

  // ── 방 안 소품 (책상 몇 개로 '방'처럼 보이게) ─────────────
  const deskAt = (x: number, z: number, ry = 0): void => {
    const d = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.8), M.desk)
    d.position.set(x, 0.78, z)
    d.rotation.y = ry
    walls.push(d) // 책상도 통과 불가
    g.add(d)
    for (const dx of [-0.72, 0.72]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.76, 0.7), M.desk)
      leg.position.set(x + Math.cos(ry) * dx, 0.38, z - Math.sin(ry) * dx)
      leg.rotation.y = ry
      g.add(leg)
    }
  }
  deskAt(-15.5, -6.2)
  deskAt(-13.2, -10.4, Math.PI / 2)
  deskAt(15.5, -9.6)
  deskAt(13.2, -5.6, Math.PI / 2)
  deskAt(3.2, 5.4, Math.PI / 2)
  deskAt(7, 3.2)

  return {
    group: g,
    wallMeshes: walls,
    // 스폰: 북서 코너 (출구는 정반대편 남쪽 — 한 바퀴 돌아야 한다)
    spawn: new THREE.Vector3(OUT.xMin + CORRIDOR_W / 2, 1.6, OUT.zMax - CORRIDOR_W / 2),
    exit: new THREE.Vector3(0, 1.6, OUT.zMin + 0.9),
    rooms,
    patrol: [
      { x: OUT.xMax - CORRIDOR_W / 2, z: OUT.zMin + CORRIDOR_W / 2 }, // 남동
      { x: OUT.xMax - CORRIDOR_W / 2, z: OUT.zMax - CORRIDOR_W / 2 }, // 북동
      { x: OUT.xMin + CORRIDOR_W / 2, z: OUT.zMax - CORRIDOR_W / 2 }, // 북서
      { x: OUT.xMin + CORRIDOR_W / 2, z: OUT.zMin + CORRIDOR_W / 2 }, // 남서
    ],
    bounds: {
      min: new THREE.Vector3(-18.5, 1.6, -24),
      max: new THREE.Vector3(18.5, 1.6, 7.5),
    },
  }
}
