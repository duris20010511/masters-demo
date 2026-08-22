import * as THREE from 'three'
import { makeDoor, makePlateTexture } from './props'

const M = {
  wall: new THREE.MeshLambertMaterial({ color: 0xd8d4ca }),
  wallDark: new THREE.MeshLambertMaterial({ color: 0x2a2a30 }),
  floor: new THREE.MeshLambertMaterial({ color: 0x8e8e86 }),
  floorDark: new THREE.MeshLambertMaterial({ color: 0x232326 }),
  lamp: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  redLamp: new THREE.MeshBasicMaterial({ color: 0xff2a1a }),
}

function box(w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
  mesh.position.set(x, y, z)
  return mesh
}

export interface CorridorRig {
  group: THREE.Group
  length: number // 복도는 z=0에서 -length까지
  endDoorZ: number
  wallMeshes: THREE.Mesh[] // occlusion 레이캐스트용
  setAllPlates(text: string): void
}

const SEG = 4 // 세그먼트 길이(m)
const SEGS = 8
const W = 2.4 // 폭

export function buildCorridor(opts: { dark: boolean }): CorridorRig {
  const g = new THREE.Group()
  const wall = opts.dark ? M.wallDark : M.wall
  const floor = opts.dark ? M.floorDark : M.floor
  const length = SEG * SEGS
  const walls: THREE.Mesh[] = []

  const mkWall = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const m = box(w, h, d, wall, x, y, z)
    walls.push(m)
    g.add(m)
  }

  // 바닥·천장·양옆 벽 (긴 판 하나씩)
  g.add(box(W, 0.1, length + 4, floor, 0, -0.05, -length / 2 + 1))
  g.add(box(W, 0.1, length + 4, wall, 0, 3, -length / 2 + 1))
  mkWall(0.1, 3, length + 4, -W / 2, 1.5, -length / 2 + 1)
  mkWall(0.1, 3, length + 4, W / 2, 1.5, -length / 2 + 1)
  // 시작 쪽 막힌 벽
  mkWall(W, 3, 0.1, 0, 1.5, 2.4)

  const plateMats: THREE.MeshBasicMaterial[] = []
  for (let i = 0; i < SEGS; i++) {
    const z = -SEG * i - 2
    // 조명
    if (opts.dark) {
      if (i % 2 === 1) g.add(box(0.1, 0.5, 0.18, M.redLamp, -W / 2 + 0.06, 2.4, z)) // 붉은 비상등
    } else {
      g.add(box(0.9, 0.04, 0.35, M.lamp, 0, 2.95, z))
    }
    // 양옆 문 + 명패
    for (const side of [-1, 1]) {
      const door = makeDoor()
      door.position.set(side * (W / 2 - 0.04), 0, z)
      door.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2
      g.add(door)
      const num = String(401 + ((i * 2 + (side > 0 ? 1 : 0)) % 8))
      const mat = new THREE.MeshBasicMaterial({ map: makePlateTexture(`${num}호`) })
      plateMats.push(mat)
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), mat)
      plate.position.set(side * (W / 2 - 0.08), 2.0, z + 0.6)
      plate.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2
      g.add(plate)
    }
  }

  // 끝 문 (정문/면담실)
  const endDoorZ = -length - 1
  const endDoor = makeDoor()
  endDoor.scale.set(1.6, 1.05, 1)
  endDoor.position.set(0, 0, endDoorZ - 0.4)
  g.add(endDoor)
  mkWall(W, 3, 0.1, 0, 1.5, endDoorZ - 0.5)

  return {
    group: g,
    length,
    endDoorZ,
    wallMeshes: walls,
    setAllPlates(text: string) {
      const tex = makePlateTexture(text)
      for (const m of plateMats) {
        m.map = tex
        m.needsUpdate = true
      }
    },
  }
}
