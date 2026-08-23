import * as THREE from 'three'
import { createState, type PhaseId } from './core/state'
import { ModeManager, lockState } from './input/modes'
import { PostFX } from './render/postfx'
import { configureRenderer } from './render/rendererConfig'
import { Overlay } from './ui/overlay'
import { SceneManager } from './scenes/sceneManager'
import { makeTitle } from './scenes/title'
import { makeOpening } from './scenes/opening'
import { makeLab } from './scenes/lab'
import { makeChase } from './scenes/chase'
import { makeEnding } from './scenes/ending'
import { STR } from './content/strings'

const app = document.getElementById('app')!
const uiRoot = document.getElementById('ui')!

// 모바일/터치 안내 (스펙 §11)
if (matchMedia('(pointer: coarse)').matches) {
  uiRoot.innerHTML = `<div style="display:grid;place-items:center;height:100%;text-align:center;background:#000">
    <p>이 기록은 데스크톱 + 키보드 + 헤드폰 환경에서만 복원됩니다.</p></div>`
  throw new Error('desktop only')
}

const renderer = new THREE.WebGLRenderer({ antialias: false })
configureRenderer(renderer)
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
renderer.setSize(innerWidth, innerHeight)
app.appendChild(renderer.domElement)

const boot = new THREE.Scene()
const bootCam = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 100)
const fx = new PostFX(renderer, boot, bootCam)
;(window as never as { __fx: PostFX }).__fx = fx // Codex 셰이더 검증용

const overlay = new Overlay(uiRoot)
let lockWarned = false
function onLockBroken(): void {
  if (!lockState.broken) {
    lockState.broken = true
    if (!lockWarned) {
      lockWarned = true
      void overlay.showSubtitle(
        '이 환경에서는 마우스 잠금이 차단되어 있습니다 — 좌클릭 드래그로 시점을 돌리세요. (우상단 "새 창에서 열기" 권장)',
        5000,
      )
    }
  }
}
const modes = new ModeManager({
  lock: () => {
    try {
      const p = renderer.domElement.requestPointerLock() as unknown as Promise<void> | undefined
      if (p && typeof p.catch === 'function') p.catch(onLockBroken)
    } catch {
      onLockBroken()
    }
  },
  unlock: () => document.exitPointerLock(),
})

// 재접속 복원은 타이틀 씬 내부에서 처리 (title.ts)
const state = createState()

// 개발용 진입점: ?scene=cycle1 처럼 특정 페이즈로 직행한다.
// 시각 검증(헤드리스 캡처)과 데모 영상 촬영에서 타이틀·이전 씬을 건너뛰기 위한 것.
const PHASES: PhaseId[] = ['title', 'opening', 'cycle1', 'cycle2', 'chase', 'ending']
const devScene = new URLSearchParams(location.search).get('scene')
if (devScene && (PHASES as string[]).includes(devScene)) state.phase = devScene as PhaseId

const scenes = new SceneManager({ state, overlay, fx, modes, renderer })
scenes.register('title', () => makeTitle())
scenes.register('opening', () => makeOpening())
scenes.register('cycle1', () => makeLab(1))
scenes.register('cycle2', () => makeLab(2))
scenes.register('chase', () => makeChase())
scenes.register('ending', () => makeEnding())
// 전 페이즈 실제 씬 등록 완료 — 유실 카드 없음

// Esc = 일시정지 (스펙 §11) — pointerlockchange 단일 진입점
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && modes.mode === 'fps') {
    modes.pause()
    void overlay
      .showChoices(STR.pause.title, [{ id: 'resume', label: STR.pause.resume }])
      .then(() => modes.resume(true))
  }
})
document.addEventListener('keydown', e => {
  if (e.key === 'Tab') e.preventDefault()
})
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight)
  fx.resize(innerWidth, innerHeight)
  scenes.resize(innerWidth, innerHeight)
})

let last = performance.now()
function loop(now: number): void {
  const dt = Math.min(50, now - last)
  last = now
  scenes.update(dt)
  fx.render(dt)
  requestAnimationFrame(loop)
}
void scenes.start()
requestAnimationFrame(loop)
