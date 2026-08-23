import * as THREE from 'three'

const M = {
  chair: new THREE.MeshStandardMaterial({ color: 0x3c4048 }),
  shelf: new THREE.MeshStandardMaterial({ color: 0xb8b0a0 }),
  book: [
    new THREE.MeshStandardMaterial({ color: 0x7a6a52 }),
    new THREE.MeshStandardMaterial({ color: 0x5a6a72 }),
    new THREE.MeshStandardMaterial({ color: 0x6a5a68 }),
  ],
  printer: new THREE.MeshStandardMaterial({ color: 0xd8d4c8 }),
  printerDark: new THREE.MeshStandardMaterial({ color: 0x50504c }),
  frame: new THREE.MeshStandardMaterial({ color: 0x9a9488 }),
  night: new THREE.MeshBasicMaterial({ color: 0x0d1020 }), // 창밖은 항상 밤
  door: new THREE.MeshStandardMaterial({ color: 0xb6ac98 }),
  paper: new THREE.MeshStandardMaterial({ color: 0xf0eee6 }),
}

function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
  mesh.position.set(x, y, z)
  return mesh
}

export function makeChair(): THREE.Group {
  const g = new THREE.Group()
  g.add(box(0.42, 0.05, 0.42, M.chair, 0, 0.45, 0)) // 좌판
  g.add(box(0.42, 0.5, 0.05, M.chair, 0, 0.72, -0.2)) // 등받이
  g.add(box(0.05, 0.45, 0.05, M.chair, 0, 0.22, 0)) // 기둥
  g.add(box(0.4, 0.04, 0.4, M.printerDark, 0, 0.02, 0)) // 바퀴 베이스
  return g
}

export function makeShelf(): THREE.Group {
  const g = new THREE.Group()
  g.add(box(1.2, 2.0, 0.32, M.shelf, 0, 1.0, 0))
  for (let row = 0; row < 4; row++) {
    let x = -0.5
    let i = 0
    while (x < 0.45) {
      const w = 0.06 + ((row * 7 + i * 3) % 5) * 0.012
      const bh = 0.24 + ((row + i) % 3) * 0.03
      g.add(box(w, bh, 0.2, M.book[(row + i) % 3], x + w / 2, 0.32 + row * 0.47 + bh / 2, 0.08))
      x += w + 0.015
      i++
    }
  }
  return g
}

export function makePrinter(): THREE.Group {
  const g = new THREE.Group()
  g.add(box(0.55, 0.6, 0.5, M.shelf, 0, 0.3, 0)) // 받침장
  g.add(box(0.48, 0.28, 0.42, M.printer, 0, 0.74, 0))
  g.add(box(0.3, 0.03, 0.2, M.paper, 0, 0.9, 0.08)) // 출력물
  g.add(box(0.36, 0.05, 0.3, M.printerDark, 0, 0.62, 0.05))
  return g
}

export function makeWindow(w: number, h: number): THREE.Group {
  const g = new THREE.Group()
  g.add(box(w, h, 0.02, M.night))
  g.add(box(w + 0.08, 0.06, 0.06, M.frame, 0, h / 2, 0))
  g.add(box(w + 0.08, 0.06, 0.06, M.frame, 0, -h / 2, 0))
  g.add(box(0.06, h, 0.06, M.frame, -w / 2, 0, 0))
  g.add(box(0.06, h, 0.06, M.frame, w / 2, 0, 0))
  g.add(box(0.04, h, 0.04, M.frame, 0, 0, 0)) // 중간 창살
  return g
}

function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const c = cv.getContext('2d')!
  draw(c)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function makeWallClock(): THREE.Mesh {
  const tex = canvasTexture(256, 128, c => {
    c.fillStyle = '#1a1a1c'
    c.fillRect(0, 0, 256, 128)
    c.strokeStyle = '#444'
    c.lineWidth = 6
    c.strokeRect(3, 3, 250, 122)
    c.fillStyle = '#c33'
    c.font = 'bold 72px monospace'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText('??:??', 128, 68)
  })
  const m = new THREE.MeshBasicMaterial({ map: tex })
  return new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.28), m)
}

export function makePlateTexture(text: string): THREE.CanvasTexture {
  return canvasTexture(128, 64, c => {
    c.fillStyle = '#e8e4da'
    c.fillRect(0, 0, 128, 64)
    c.strokeStyle = '#777'
    c.lineWidth = 4
    c.strokeRect(2, 2, 124, 60)
    c.fillStyle = '#222'
    c.font = 'bold 30px sans-serif'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(text, 64, 34)
  })
}

export function makePlate(text: string): THREE.Mesh {
  const m = new THREE.MeshBasicMaterial({ map: makePlateTexture(text) })
  return new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), m)
}

export function makeDoor(): THREE.Group {
  const g = new THREE.Group()
  g.add(box(0.9, 2.1, 0.06, M.door, 0, 1.05, 0))
  g.add(box(0.08, 0.08, 0.1, M.printerDark, 0.32, 1.0, 0.03)) // 손잡이
  return g
}

export function makePaperPile(): THREE.Group {
  const g = new THREE.Group()
  for (let i = 0; i < 4; i++) {
    const p = box(0.26, 0.008, 0.34, M.paper, (i % 2) * 0.02 - 0.01, 0.01 + i * 0.009, (i % 3) * 0.015)
    p.rotation.y = ((i * 37) % 10 - 5) * 0.03
    g.add(p)
  }
  return g
}
