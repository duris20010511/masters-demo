import * as THREE from 'three'
import type { GameScene, SceneCtx } from './sceneManager'
import { FPSControls } from '../input/controls'
import { runDocMinigame } from '../ui/minigame1'
import { runSampleMinigame } from '../ui/minigame2'
import { applyStat } from '../core/state'
import { STR } from '../content/strings'
import { makePerson } from '../world/person'
import { sound, FootstepTracker } from '../audio/sound'
import {
  makePrinter, makeWindow, makeWallClock, makeDoor, makePaperPile,
} from '../world/props'
import { makeProp } from '../world/models'
import {
  floorTexture, ceilingTexture, wallTexture, makeGlowSprite, makePosterMesh,
} from '../world/textures'

const M = {
  wallZ: new THREE.MeshLambertMaterial({ map: wallTexture(8) }),   // 앞뒤 벽 (8m)
  wallX: new THREE.MeshLambertMaterial({ map: wallTexture(10) }),  // 옆 벽 (10m)
  floor: new THREE.MeshLambertMaterial({ map: floorTexture(8, 10) }),
  ceil: new THREE.MeshLambertMaterial({ map: ceilingTexture(8, 10) }),
  desk: new THREE.MeshLambertMaterial({ color: 0xc9c4b8 }),
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

export function makeLab(cycle: 1 | 2 = 1): GameScene {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a1a1f) // 창밖은 밤
  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 50)
  camera.position.set(0, 1.6, 3)

  // ── 방 8x3x10 ──────────────────────────────────────────────
  scene.add(box(8, 0.1, 10, M.floor, 0, -0.05, 0))
  scene.add(box(8, 0.1, 10, M.ceil, 0, 3, 0))
  scene.add(box(8, 3, 0.1, M.wallZ, 0, 1.5, -5))
  scene.add(box(8, 3, 0.1, M.wallZ, 0, 1.5, 5))
  scene.add(box(0.1, 3, 10, M.wallX, -4, 1.5, 0))
  scene.add(box(0.1, 3, 10, M.wallX, 4, 1.5, 0))
  for (const z of [-3, -1, 1, 3]) {
    scene.add(box(1.4, 0.05, 0.5, M.lamp, 0, 2.95, z))
    const glow = makeGlowSprite(2.6, 1.3)
    glow.position.set(0, 2.8, z)
    scene.add(glow)
  }

  // ── 벽 포스터 (세계관 소품) ────────────────────────────────
  const pSafety = makePosterMesh('safety')
  pSafety.position.set(3.94, 1.7, 0.6)
  pSafety.rotation.y = -Math.PI / 2
  scene.add(pSafety)
  const pConf = makePosterMesh('conf')
  pConf.position.set(1.9, 1.7, -4.93)
  scene.add(pConf)
  const pGrad = makePosterMesh('grad')
  pGrad.position.set(1.4, 1.7, 4.94)
  pGrad.rotation.y = Math.PI
  scene.add(pGrad)

  let grad1Chair: THREE.Group | null = null
  let seatAligned = false

  // ── 책상 4 + 컴퓨터(실물 모델) + 의자 ──────────────────────
  // 주인공 PC = 회색 풀세트, 나머지 = 검정 모던 세트 (Poly by Google, CC-BY)
  const pc = makeProp('./assets/models/prop-computer.glb', 0.52)
  pc.position.set(-2.5, 0.83, -3.05)
  scene.add(pc)
  const deskSpots: Array<[number, number]> = [[-2.5, -3], [2.5, -3], [-2.5, 0], [2.5, 0]]
  for (const [x, z] of deskSpots) {
    scene.add(box(1.6, 0.06, 0.8, M.desk, x, 0.8, z))
    scene.add(box(0.05, 0.74, 0.7, M.desk, x - 0.75, 0.4, z))
    scene.add(box(0.05, 0.74, 0.7, M.desk, x + 0.75, 0.4, z))
    if (!(x === -2.5 && z === -3)) {
      const comp = makeProp('./assets/models/prop-computer2.glb', 0.48)
      comp.position.set(x, 0.83, z - 0.05)
      scene.add(comp)
    }
    const chair = makeProp('./assets/models/prop-chair.glb', 1.0) // 사무용 의자 (Quaternius CC0)
    chair.position.set(x, 0, z + 0.6)
    chair.rotation.y = Math.PI
    scene.add(chair)
    if (x === 2.5 && z === -3) grad1Chair = chair // 앉은 동료의 의자 — 런타임 정렬 대상
    const pile = makePaperPile()
    pile.position.set(x + 0.5, 0.84, z + 0.15)
    scene.add(pile)
  }

  // ── 앉아 있는 대학원생 2 (얼굴 없음, 머리만 아주 천천히 따라옴) ──
  // 남성 동료: 책상 의자에 앉아 일하는 중 (sit_idle) / 여성 동료: 서 있음
  const grad1 = makePerson({ variant: 'man' })
  grad1.play(['new_sit_idle'])
  // 좌판 정렬 실측 보정: 엉덩이가 등받이에 붙도록
  grad1.group.position.set(2.5, 0, -2.58)
  grad1.group.rotation.y = Math.PI // 모니터를 향해 앉음 (플레이어에겐 등)
  scene.add(grad1.group)
  const grad2 = makePerson({ variant: 'woman' })
  grad2.group.position.set(2.8, 0, 3.45) // 냉동고 앞에 서서 뭔가 확인하는 중
  grad2.group.rotation.y = Math.atan2(3.4 - 2.8, 4.2 - 3.45) // 냉동고를 향해
  scene.add(grad2.group)
  const colleague = grad1.group // 상호작용 대상 동료

  // ── 생활감 소품 ────────────────────────────────────────────
  for (const x of [-1.2, 0.2]) {
    const shelf = makeProp('./assets/models/prop-bookcase.glb', 2.0) // 책 꽂힌 책장 (Quaternius CC0)
    shelf.position.set(x, 0, -4.72)
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

  // ── 냉동고 (실물 모델: 스틸 캐비닛, MilkAndBanana CC0) ──────
  const freezer = makeProp('./assets/models/prop-fridge.glb', 1.9)
  freezer.position.set(3.4, 0, 4.2)
  freezer.rotation.y = Math.PI // 문이 방 안쪽을 향하게
  scene.add(freezer)
  scene.add(box(0.4, 0.06, 0.25, M.lamp, 2.85, 1.55, 4.2)) // 리더기 패널 (옆 벽면)

  // ── 라이팅: "지나치게 밝은 연구실" — 컨셉의 핵심은 과도한 밝음 (스펙 §10-1)
  // ACES 톤매핑(노출 0.9) 하에서 과노출 형광등 느낌이 나도록 상향 보정
  scene.add(new THREE.HemisphereLight(0xfff6e8, 0x8a8a96, 2.2))
  scene.add(new THREE.AmbientLight(0xffffff, 0.5))
  const p1 = new THREE.PointLight(0xfff2dc, 34, 13)
  p1.position.set(0, 2.7, -2)
  scene.add(p1)
  const p2 = new THREE.PointLight(0xfff2dc, 34, 13)
  p2.position.set(0, 2.7, 2)
  scene.add(p2)

  const controls = new FPSControls(camera)
  controls.setBounds(new THREE.Vector3(-3.3, 1.6, -4.2), new THREE.Vector3(3.3, 1.6, 4.4))
  const ray = new THREE.Raycaster()
  let ctx!: SceneCtx
  let step: 'colleague' | 'pc' | 'reader' | 'freezer' | 'done' =
    cycle === 1 ? 'colleague' : 'freezer'
  let aimed: THREE.Object3D | null = null
  const steps = new FootstepTracker()

  function stepTarget(): THREE.Object3D | null {
    return step === 'colleague'
      ? colleague
      : step === 'pc'
        ? pc
        : step === 'reader'
          ? door
          : step === 'freezer'
            ? freezer
            : null
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
      void ctx.overlay.showSubtitle('오늘은 여기까지 하자. 문을 나서자. (문에 E)', 2400)
    } else if (step === 'freezer' && target === freezer) {
      // 사이클 ②: 샘플 분류 (Codex 작업 #4)
      sound.synth?.play('beep_ok', 0.35)
      await runSampleMinigame(ctx.state, ctx.overlay)
      step = 'done'
      await ctx.overlay.showCard('면담실로 오게. — 교수', 2400)
      ctx.advance()
      return
    } else if (step === 'reader' && target === door) {
      // 퇴근 시도 → 문 리더기가 출입증을 요구 → 출입증 강제 노출 (스펙 §3)
      sound.synth?.play('beep_error', 0.5)
      await ctx.overlay.showBadge(ctx.state)
      void ctx.overlay.showSubtitle('퇴실할 수 없습니다. 처리되지 않은 업무가 존재합니다.', 2400)
      ctx.fx.pulse('glitch', 0.5, 400)
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
      // 사이클 ②는 이상현상 강도 상승 (스펙 §3)
      ctx.fx.set({ grain: cycle === 2 ? 0.1 : 0.06, vignette: cycle === 2 ? 0.26 : 0.18 })
      sound.synth?.start('hum', 0.18) // 형광등 험
      await ctx.overlay.showCard('??:??', 1200)
      // PointerLock은 유저 제스처 내에서만 허용 — 클릭 게이트로 재잠금
      await ctx.overlay.showClickToContinue()
      ctx.modes.toFPS(true)
      void ctx.overlay.showSubtitle(
        cycle === 1
          ? '동료가 말을 걸어온다. (동료에게 다가가 E)'
          : '오늘 들어온 조직 샘플을 정리해야 한다. (냉동고에 E)',
        2600,
      )
    },
    exit() {
      document.removeEventListener('keydown', onKey)
      controls.dispose()
      ctx?.overlay.setCrosshair('off')
      sound.synth?.stop('hum')
    },
    update(dt) {
      controls.update(dt)
      if (!ctx) return
      if (ctx.modes.mode === 'fps') steps.update(camera.position)
      // 대학원생들의 머리가 아주 천천히 플레이어를 따라온다 (+숨쉬기·타이핑)
      grad1.update(dt, camera.position)
      grad2.update(dt, camera.position)
      // 의자를 앉은 자세의 실제 엉덩이 뼈 아래로 자동 정렬 (눈대중 배치 금지)
      if (!seatAligned && grad1Chair) {
        let hip: THREE.Object3D | null = null
        grad1.group.traverse(o => {
          if (!hip && /hip|pelvis/i.test(o.name)) hip = o
        })
        if (hip) {
          const p = (hip as THREE.Object3D).getWorldPosition(new THREE.Vector3())
          // 앉은 자세가 완성된 뒤에만 (서있는 크로스페이드 중이면 0.9m대라 스킵)
          if (p.y > 0.15 && p.y < 0.75) {
            grad1Chair.position.x = p.x
            grad1Chair.position.z = p.z + 0.06
            grad1Chair.scale.setScalar(Math.min(1.4, Math.max(0.8, (p.y - 0.03) / 0.475)))
            seatAligned = true
          }
        }
      }
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
