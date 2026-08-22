import * as THREE from 'three'
import type { GameScene, SceneCtx } from './sceneManager'
import { FPSControls } from '../input/controls'
import { runDocMinigame } from '../ui/minigame1'
import { applyStat } from '../core/state'
import { STR } from '../content/strings'
import { makePerson } from '../world/person'
import {
  makeChair, makeShelf, makePrinter, makeWindow, makeWallClock, makeDoor, makePaperPile,
} from '../world/props'

const M = {
  wall: new THREE.MeshLambertMaterial({ color: 0xdedbd2 }),
  floor: new THREE.MeshLambertMaterial({ color: 0x9a9a92 }),
  desk: new THREE.MeshLambertMaterial({ color: 0xc9c4b8 }),
  dark: new THREE.MeshLambertMaterial({ color: 0x333333 }),
  screen: new THREE.MeshBasicMaterial({ color: 0xbfd8ff }),
  screenDim: new THREE.MeshBasicMaterial({ color: 0x3a4450 }),
  lamp: new THREE.MeshBasicMaterial({ color: 0xffffff }), // emissive 형광등
}

function box(
  w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
  mesh.position.set(x, y, z)
  return mesh
}

/** hit.object가 어느 최상위 타깃 소속인지 찾는다 */
function ownerOf(obj: THREE.Object3D, targets: THREE.Object3D[]): THREE.Object3D | null {
  let cur: THREE.Object3D | null = obj
  while (cur) {
    if (targets.includes(cur)) return cur
    cur = cur.parent
  }
  return null
}

export function makeLab(): GameScene {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a1a1f) // 창밖은 밤
  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 50)
  camera.position.set(0, 1.6, 3)

  // ── 방 8x3x10 ──────────────────────────────────────────────
  scene.add(box(8, 0.1, 10, M.floor, 0, -0.05, 0))
  scene.add(box(8, 0.1, 10, M.wall, 0, 3, 0))
  scene.add(box(8, 3, 0.1, M.wall, 0, 1.5, -5))
  scene.add(box(8, 3, 0.1, M.wall, 0, 1.5, 5))
  scene.add(box(0.1, 3, 10, M.wall, -4, 1.5, 0))
  scene.add(box(0.1, 3, 10, M.wall, 4, 1.5, 0))
  for (const z of [-3, -1, 1, 3]) scene.add(box(1.4, 0.05, 0.5, M.lamp, 0, 2.95, z))

  // ── 책상 4 + 모니터 + 의자 ─────────────────────────────────
  const pc = box(0.6, 0.4, 0.06, M.screen, -2.5, 1.05, -3.2)
  scene.add(pc)
  const deskSpots: Array<[number, number]> = [[-2.5, -3], [2.5, -3], [-2.5, 0], [2.5, 0]]
  for (const [x, z] of deskSpots) {
    scene.add(box(1.6, 0.06, 0.8, M.desk, x, 0.8, z))
    scene.add(box(0.05, 0.74, 0.7, M.desk, x - 0.75, 0.4, z))
    scene.add(box(0.05, 0.74, 0.7, M.desk, x + 0.75, 0.4, z))
    if (!(x === -2.5 && z === -3)) scene.add(box(0.6, 0.4, 0.06, M.screenDim, x, 1.05, z - 0.2))
    const chair = makeChair()
    chair.position.set(x, 0, z + 0.6)
    chair.rotation.y = Math.PI
    scene.add(chair)
    const pile = makePaperPile()
    pile.position.set(x + 0.5, 0.84, z + 0.15)
    scene.add(pile)
  }

  // ── 앉아 있는 대학원생 2 (얼굴 없음, 머리만 아주 천천히 따라옴) ──
  const grad1 = makePerson({ seated: true })
  grad1.group.position.set(2.5, 0.45, -2.45) // 책상(2.5,-3) 의자에, 모니터를 향해 등 보임
  grad1.group.rotation.y = Math.PI
  scene.add(grad1.group)
  const grad2 = makePerson({ seated: true })
  grad2.group.position.set(-2.5, 0.45, 0.55)
  grad2.group.rotation.y = Math.PI
  scene.add(grad2.group)
  const colleague = grad1.group // 상호작용 대상 동료

  // ── 생활감 소품 ────────────────────────────────────────────
  for (const x of [-1.2, 0.2]) {
    const shelf = makeShelf()
    shelf.position.set(x, 0, -4.8)
    scene.add(shelf)
  }
  const printer = makePrinter()
  printer.position.set(3.5, 0, 2.6)
  printer.rotation.y = -Math.PI / 2
  scene.add(printer)
  for (const z of [-2, 1.6]) {
    const win = makeWindow(1.6, 1.2)
    win.position.set(-3.94, 1.7, z)
    win.rotation.y = Math.PI / 2
    scene.add(win)
  }
  const clock = makeWallClock()
  clock.position.set(0.8, 2.35, -4.94) // 스폰 정면 벽 — 반드시 보게
  scene.add(clock)
  const door = makeDoor()
  door.position.set(-1.5, 0, 4.96)
  door.rotation.y = Math.PI
  scene.add(door)

  // ── 냉동고 ─────────────────────────────────────────────────
  const freezer = box(1, 2, 0.8, M.dark, 3.4, 1, 4.2)
  scene.add(box(0.5, 0.06, 0.3, M.lamp, 3.4, 1.62, 3.78)) // 리더기 패널
  scene.add(freezer)

  // ── 라이팅: "지나치게 밝은 연구실" (스펙 §10-1, 그림자 금지) ──
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9a9aa8, 2.6))
  scene.add(new THREE.AmbientLight(0xffffff, 0.55))
  const p1 = new THREE.PointLight(0xfff4e0, 30, 14)
  p1.position.set(0, 2.7, -2)
  scene.add(p1)
  const p2 = new THREE.PointLight(0xfff4e0, 30, 14)
  p2.position.set(0, 2.7, 2)
  scene.add(p2)

  const controls = new FPSControls(camera)
  controls.setBounds(new THREE.Vector3(-3.3, 1.6, -4.2), new THREE.Vector3(3.3, 1.6, 4.4))
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
      ctx?.overlay.setCrosshair('off')
    },
    update(dt) {
      controls.update(dt)
      if (!ctx) return
      // 대학원생들의 머리가 아주 천천히 플레이어를 따라온다
      grad1.lookAt(camera.position, dt)
      grad2.lookAt(camera.position, dt)
      if (ctx.modes.mode !== 'fps') {
        ctx.overlay.setCrosshair('off')
        aimed = null
        return
      }
      aimed = null
      const target = stepTarget()
      if (target) {
        ray.setFromCamera(new THREE.Vector2(0, 0), camera)
        const hit = ray.intersectObject(target, true)[0]
        if (hit && hit.distance < 2.6) aimed = ownerOf(hit.object, [target]) ?? target
      }
      ctx.overlay.setCrosshair(aimed ? 'target' : 'idle')
    },
  }
}
