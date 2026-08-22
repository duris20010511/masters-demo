import * as THREE from 'three'

// 전부 캔버스 프로시저럴 생성 — 외부 파일 0, 용량 0
function cv(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const c = canvas.getContext('2d')!
  draw(c)
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.RepeatWrapping
  return t
}

// 결정적 의사난수 (빌드마다 같은 결과)
function rng(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

function speckle(c: CanvasRenderingContext2D, w: number, h: number, n: number, alpha: number, seed: number): void {
  const r = rng(seed)
  for (let i = 0; i < n; i++) {
    const g = Math.floor(r() * 90)
    c.fillStyle = `rgba(${g},${g},${g},${alpha})`
    c.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2)
  }
}

/** 비닐 타일 바닥 — 512px = 2x2 타일 (타일 1개 = 1m로 repeat 계산) */
export function floorTexture(repeatX: number, repeatY: number): THREE.CanvasTexture {
  const t = cv(512, 512, c => {
    const tones = ['#a7a79e', '#a2a29a', '#9e9e96', '#a5a59b']
    const r = rng(7)
    for (let ty = 0; ty < 2; ty++)
      for (let tx = 0; tx < 2; tx++) {
        c.fillStyle = tones[(tx + ty * 2) % 4]
        c.fillRect(tx * 256, ty * 256, 256, 256)
        // 타일 내부 얼룩
        for (let i = 0; i < 14; i++) {
          const g = 140 + Math.floor(r() * 40)
          c.fillStyle = `rgba(${g},${g},${g - 6},0.10)`
          const x = tx * 256 + r() * 236
          const y = ty * 256 + r() * 236
          c.beginPath()
          c.ellipse(x, y, 6 + r() * 26, 4 + r() * 18, r() * 3, 0, Math.PI * 2)
          c.fill()
        }
      }
    // 줄눈
    c.strokeStyle = 'rgba(60,60,58,0.55)'
    c.lineWidth = 3
    for (const p of [0, 256, 512]) {
      c.beginPath(); c.moveTo(p, 0); c.lineTo(p, 512); c.stroke()
      c.beginPath(); c.moveTo(0, p); c.lineTo(512, p); c.stroke()
    }
    speckle(c, 512, 512, 900, 0.05, 11)
  })
  t.repeat.set(repeatX / 2, repeatY / 2) // 타일 1m 기준
  return t
}

/** 사무실 천장 텍스처 — 흡음 패널 그리드 */
export function ceilingTexture(repeatX: number, repeatY: number): THREE.CanvasTexture {
  const t = cv(512, 512, c => {
    c.fillStyle = '#e9e7e0'
    c.fillRect(0, 0, 512, 512)
    speckle(c, 512, 512, 2600, 0.06, 23)
    c.strokeStyle = 'rgba(120,118,110,0.6)'
    c.lineWidth = 4
    for (const p of [0, 256, 512]) {
      c.beginPath(); c.moveTo(p, 0); c.lineTo(p, 512); c.stroke()
      c.beginPath(); c.moveTo(0, p); c.lineTo(512, p); c.stroke()
    }
  })
  t.repeat.set(repeatX / 1.2, repeatY / 1.2)
  return t
}

/** 벽 — 미세 플라스터 질감 + 하단 걸레받이 */
export function wallTexture(repeatX: number, withBaseboard = true): THREE.CanvasTexture {
  const t = cv(256, 512, c => {
    c.fillStyle = '#e3e0d7'
    c.fillRect(0, 0, 256, 512)
    speckle(c, 256, 512, 1500, 0.035, 41)
    // 위쪽 살짝 어둡게 (가짜 AO)
    const gr = c.createLinearGradient(0, 0, 0, 60)
    gr.addColorStop(0, 'rgba(0,0,0,0.10)')
    gr.addColorStop(1, 'rgba(0,0,0,0)')
    c.fillStyle = gr
    c.fillRect(0, 0, 256, 60)
    if (withBaseboard) {
      c.fillStyle = '#6d685e'
      c.fillRect(0, 492, 256, 20)
    }
  })
  t.repeat.set(repeatX / 2, 1)
  return t
}

/** 모니터 화면 — 스프레드시트 풍 */
export function screenSheetTexture(): THREE.CanvasTexture {
  return cv(256, 192, c => {
    c.fillStyle = '#f2f1ec'
    c.fillRect(0, 0, 256, 192)
    c.fillStyle = '#2a6b46'
    c.fillRect(0, 0, 256, 18)
    c.strokeStyle = 'rgba(120,130,140,0.6)'
    c.lineWidth = 1
    for (let y = 18; y < 192; y += 14) { c.beginPath(); c.moveTo(0, y); c.lineTo(256, y); c.stroke() }
    for (let x = 0; x < 256; x += 42) { c.beginPath(); c.moveTo(x, 18); c.lineTo(x, 192); c.stroke() }
    const r = rng(77)
    c.fillStyle = 'rgba(60,64,70,0.85)'
    for (let y = 22; y < 180; y += 14)
      for (let x = 4; x < 240; x += 42)
        if (r() > 0.4) c.fillRect(x, y + 4, 10 + r() * 24, 4)
    c.fillStyle = 'rgba(200,120,40,0.5)'
    c.fillRect(84, 88, 42, 14)
  })
}

/** 모니터 화면 — 어두운 터미널 풍 */
export function screenCodeTexture(): THREE.CanvasTexture {
  return cv(256, 192, c => {
    c.fillStyle = '#14161a'
    c.fillRect(0, 0, 256, 192)
    const r = rng(99)
    for (let y = 10; y < 186; y += 11) {
      const g = 120 + Math.floor(r() * 80)
      c.fillStyle = r() > 0.85 ? `rgba(180,150,90,0.8)` : `rgba(90,${g},110,0.75)`
      c.fillRect(8 + r() * 20, y, 30 + r() * 170, 5)
    }
  })
}

/** 포스터 3종 */
export function posterTexture(kind: 'safety' | 'conf' | 'grad'): THREE.CanvasTexture {
  return cv(256, 384, c => {
    c.fillStyle = '#f4f2ea'
    c.fillRect(0, 0, 256, 384)
    c.strokeStyle = '#999'
    c.lineWidth = 4
    c.strokeRect(2, 2, 252, 380)
    c.textAlign = 'center'
    if (kind === 'safety') {
      c.fillStyle = '#b33'
      c.fillRect(8, 8, 240, 56)
      c.fillStyle = '#fff'
      c.font = 'bold 30px sans-serif'
      c.fillText('실험실 안전 수칙', 128, 46)
      c.fillStyle = '#333'
      c.font = '16px sans-serif'
      const lines = ['1. 보호구를 착용할 것', '2. 샘플에 이름을 붙일 것', '3. 폐기물은 봉인할 것', '4. 이름을 부르지 말 것']
      lines.forEach((s, i) => c.fillText(s, 128, 110 + i * 34))
      c.fillStyle = '#b33'
      c.font = 'bold 16px sans-serif'
      c.fillText('― 안전관리위원회', 128, 300)
    } else if (kind === 'conf') {
      c.fillStyle = '#2a4a7a'
      c.fillRect(8, 8, 240, 100)
      c.fillStyle = '#fff'
      c.font = 'bold 24px sans-serif'
      c.fillText('추계 학술대회', 128, 52)
      c.font = '15px sans-serif'
      c.fillText('논문 모집', 128, 82)
      c.fillStyle = '#444'
      c.font = '14px sans-serif'
      c.fillText('제출 마감: ??.??.', 128, 150)
      c.fillStyle = '#ccc'
      c.fillRect(28, 180, 200, 120)
      c.fillStyle = '#888'
      c.font = '12px sans-serif'
      c.fillText('발표 일정은 추후 공지', 128, 330)
    } else {
      c.fillStyle = '#222'
      c.fillRect(0, 0, 256, 384)
      c.fillStyle = '#e8e4da'
      c.font = 'bold 26px sans-serif'
      c.fillText('대학원 진학 상담', 128, 80)
      c.font = '18px sans-serif'
      c.fillText('언제든지', 128, 130)
      c.fillText('어디서든지', 128, 162)
      c.fillStyle = '#b33'
      c.font = 'bold 20px sans-serif'
      c.fillText('당신을 기다립니다', 128, 260)
      c.fillStyle = '#777'
      c.font = '13px sans-serif'
      c.fillText('문의: 지도교수', 128, 340)
    }
  })
}

/** 비상구 표지 */
export function exitSignTexture(): THREE.CanvasTexture {
  return cv(256, 128, c => {
    c.fillStyle = '#0f7a3d'
    c.fillRect(0, 0, 256, 128)
    c.fillStyle = '#eafff0'
    // 달리는 사람 픽토그램 (단순화)
    c.beginPath(); c.arc(70, 34, 12, 0, Math.PI * 2); c.fill()
    c.fillRect(52, 48, 40, 12)
    c.save(); c.translate(64, 60); c.rotate(0.6); c.fillRect(0, 0, 34, 10); c.restore()
    c.save(); c.translate(76, 58); c.rotate(-0.5); c.fillRect(0, 0, 34, 10); c.restore()
    c.font = 'bold 44px sans-serif'
    c.textAlign = 'center'
    c.fillText('비상구', 168, 80)
  })
}

/** 형광등 글로우 스프라이트용 방사형 그라데이션 */
export function glowTexture(): THREE.CanvasTexture {
  return cv(128, 128, c => {
    const g = c.createRadialGradient(64, 64, 4, 64, 64, 62)
    g.addColorStop(0, 'rgba(255,250,235,0.85)')
    g.addColorStop(0.4, 'rgba(255,246,220,0.28)')
    g.addColorStop(1, 'rgba(255,244,214,0)')
    c.fillStyle = g
    c.fillRect(0, 0, 128, 128)
  })
}

export function makeGlowSprite(scaleX: number, scaleY: number, color = 0xffffff): THREE.Sprite {
  const m = new THREE.SpriteMaterial({
    map: glowTexture(),
    color,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  })
  const s = new THREE.Sprite(m)
  s.scale.set(scaleX, scaleY, 1)
  return s
}

export function makePosterMesh(kind: 'safety' | 'conf' | 'grad'): THREE.Mesh {
  const m = new THREE.MeshBasicMaterial({ map: posterTexture(kind) })
  return new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.9), m)
}

export function makeExitSign(): THREE.Mesh {
  const m = new THREE.MeshBasicMaterial({ map: exitSignTexture() })
  return new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.28), m)
}
