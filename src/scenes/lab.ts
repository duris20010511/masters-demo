import * as THREE from 'three'
import type { GameScene, SceneCtx } from './sceneManager'
import { FPSControls } from '../input/controls'
import { runDocMinigame } from '../ui/minigame1'
import { applyStat } from '../core/state'
import { STR } from '../content/strings'

const M = {
  wall: new THREE.MeshLambertMaterial({ color: 0xdedbd2 }),
  floor: new THREE.MeshLambertMaterial({ color: 0x9a9a92 }),
  desk: new THREE.MeshLambertMaterial({ color: 0xc9c4b8 }),
  dark: new THREE.MeshLambertMaterial({ color: 0x333333 }),
  screen: new THREE.MeshBasicMaterial({ color: 0xbfd8ff }),
  lamp: new THREE.MeshBasicMaterial({ color: 0xffffff }), // emissive 형광등
  body: new THREE.MeshLambertMaterial({ color: 0x555566 }), // 동료 실루엣
}

function box(
  w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
  mesh.position.set(x, y, z)
  return mesh
}

export function makeLab(): GameScene {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a1a1f) // 창밖은 밤
  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 50)
  camera.position.set(0, 1.6, 3)

  // 방 8x3x10
  scene.add(box(8, 0.1, 10, M.floor, 0, -0.05, 0))
  scene.add(box(8, 0.1, 10, M.wall, 0, 3, 0))
  scene.add(box(8, 3, 0.1, M.wall, 0, 1.5, -5))
  scene.add(box(8, 3, 0.1, M.wall, 0, 1.5, 5))
  scene.add(box(0.1, 3, 10, M.wall, -4, 1.5, 0))
  scene.add(box(0.1, 3, 10, M.wall, 4, 1.5, 0))
  // 형광등 패널 4개 (emissive)
  for (const z of [-3, -1, 1, 3]) scene.add(box(1.4, 0.05, 0.5, M.lamp, 0, 2.95, z))
  // 책상 4 + 모니터 (PC 상호작용 대상은 첫 책상)
  const pc = box(0.6, 0.4, 0.06, M.screen, -2.5, 1.05, -3.2)
  for (const [x, z] of [[-2.5, -3], [2.5, -3], [-2.5, 0], [2.5, 0]] as const) {
    scene.add(box(1.6, 0.06, 0.8, M.desk, x, 0.8, z))
    if (!(x === -2.5 && z === -3)) scene.add(box(0.6, 0.4, 0.06, M.dark, x, 1.05, z - 0.2))
  }
  scene.add(pc)
  // 냉동고 (사이클 종료 리더기)
  const freezer = box(1, 2, 0.8, M.dark, 3.4, 1, 4.2)
  scene.add(freezer)
  // 동료 실루엣 2
  const colleague = box(0.45, 1.7, 0.3, M.body, 2.5, 0.85, -0.4)
  scene.add(colleague)
  scene.add(box(0.45, 1.7, 0.3, M.body, -2.5, 0.85, 0.4))

  // "지나치게 밝은 연구실" — 형광등 느낌의 과노출 (스펙 §10-1)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9a9aa8, 2.6))
  scene.add(new THREE.AmbientLight(0xffffff, 0.55))
  const p1 = new THREE.PointLight(0xfff4e0, 30, 14)
  p1.position.set(0, 2.7, -2)
  scene.add(p1)
  const p2 = new THREE.PointLight(0xfff4e0, 30, 14)
  p2.position.set(0, 2.7, 2)
  scene.add(p2)

  const controls = new FPSControls(camera)
  controls.setBounds(new THREE.Vector3(-3.5, 1.6, -4.5), new THREE.Vector3(3.5, 1.6, 4.5))
  const ray = new THREE.Raycaster()
  let ctx!: SceneCtx
  let step: 'colleague' | 'pc' | 'reader' | 'done' = 'colleague'
  let aimed: THREE.Object3D | null = null

  function stepTarget(): THREE.Object3D | null {
    return step === 'colleague' ? colleague : step === 'pc' ? pc : step === 'reader' ? freezer : null
  }

  async function interact(target: THREE.Object3D): Promise<void> {
    ctx.modes.toUI()
    if (step === 'colleague' && target === colleague) {
      const pick = await ctx.overlay.showChoices(STR.colleague.approach[0], [
        { id: 'good', label: STR.colleague.choiceGood },
        { id: 'meh', label: STR.colleague.choiceMeh },
      ])
      if (pick === 'good') applyStat(ctx.state, 'aptitude', 5) // 호의적 응답 (스펙 §7)
      step = 'pc'
      void ctx.overlay.showSubtitle('PC 앞에 앉아 업무를 시작하자. (모니터에 E)', 2200)
    } else if (step === 'pc' && target === pc) {
      await runDocMinigame(ctx.state, ctx.overlay)
      step = 'reader'
      void ctx.overlay.showSubtitle('냉동고 리더기가 출입증을 요구한다. (냉동고에 E)', 2200)
    } else if (step === 'reader' && target === freezer) {
      await ctx.overlay.showBadge(ctx.state) // 출입증 강제 노출 (스펙 §3)
      ctx.fx.pulse('glitch', 0.4, 300)
      step = 'done'
      ctx.advance()
      return
    }
    ctx.modes.toFPS(true) // 직전 오버레이 클릭이 제스처
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'KeyE' && ctx.modes.mode === 'fps' && aimed) {
      void interact(aimed)
    }
    if (e.code === 'Tab' && ctx.modes.mode === 'fps') {
      ctx.modes.toUI()
      void ctx.overlay.showBadge(ctx.state).then(() => ctx.modes.toFPS(true))
    }
  }

  return {
    scene,
    camera,
    async enter(c: SceneCtx) {
      ctx = c
      document.addEventListener('keydown', onKey)
      ctx.modes.onChange(m => { controls.enabled = m === 'fps' })
      ctx.fx.set({ grain: 0.06, vignette: 0.18 }) // 밝은 랩실에선 절제
      await ctx.overlay.showCard('??:??', 1200)
      // PointerLock은 유저 제스처 내에서만 허용 — 클릭 게이트로 재잠금
      await ctx.overlay.showClickToContinue()
      ctx.modes.toFPS(true)
      void ctx.overlay.showSubtitle('동료가 말을 걸어온다. (동료에게 다가가 E)', 2600)
    },
    exit() {
      document.removeEventListener('keydown', onKey)
      controls.dispose()
    },
    update(dt) {
      controls.update(dt)
      if (!ctx) return
      if (ctx.modes.mode !== 'fps') {
        ctx.overlay.setCrosshair('off')
        aimed = null
        return
      }
      // 조준 판정: 현재 단계의 대상만, 화면 중앙 레이 + 거리 2.6m
      aimed = null
      const target = stepTarget()
      if (target) {
        ray.setFromCamera(new THREE.Vector2(0, 0), camera)
        const hit = ray.intersectObject(target, false)[0]
        if (hit && hit.distance < 2.6) aimed = target
      }
      ctx.overlay.setCrosshair(aimed ? 'target' : 'idle')
    },
  }
}
