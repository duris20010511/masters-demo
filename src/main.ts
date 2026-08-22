import * as THREE from 'three'
import { createState } from './core/state'
import { loadCheckpoint } from './core/checkpoint'
import { ModeManager } from './input/modes'
import { PostFX } from './render/postfx'
import { Overlay } from './ui/overlay'
import { SceneManager } from './scenes/sceneManager'
import { makeTitle } from './scenes/title'
import { makeLab } from './scenes/lab'
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
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
renderer.setSize(innerWidth, innerHeight)
app.appendChild(renderer.domElement)

const boot = new THREE.Scene()
const bootCam = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 100)
const fx = new PostFX(renderer, boot, bootCam)
;(window as never as { __fx: PostFX }).__fx = fx // Codex 셰이더 검증용

const overlay = new Overlay(uiRoot)
const modes = new ModeManager({
  lock: () => renderer.domElement.requestPointerLock(),
  unlock: () => document.exitPointerLock(),
})

// 재접속 복원 (스펙 §11 체크포인트)
let state = createState()
const saved = loadCheckpoint()
if (saved && saved.phase !== 'title' && saved.phase !== 'ending') {
  if (confirm(STR.title.resume)) state = saved
  else state.phase = 'title'
}

const scenes = new SceneManager({ state, overlay, fx, modes, renderer })
scenes.register('title', () => makeTitle())
scenes.register('cycle1', () => makeLab())
scenes.register('ending', () => makeEnding())
// opening / cycle2 / chase 는 이 슬라이스에서 미등록 → 유실 카드로 자동 통과

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
