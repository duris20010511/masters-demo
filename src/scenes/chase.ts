import * as THREE from 'three'
import type { GameScene, SceneCtx } from './sceneManager'
import { FPSControls } from '../input/controls'
import { buildCorridor, CORRIDOR } from '../world/corridor'
import { makeChaser } from '../world/person'
import { ChaserAI } from '../chase/chaserAI'
import { addJournal } from '../core/journal'
import { sound, FootstepTracker } from '../audio/sound'

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

export function makeChase(): GameScene {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x050505)
  scene.fog = new THREE.Fog(0x070707, 4, 30)
  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 40)
  const SPAWN = new THREE.Vector3(0, 1.6, 1.2)
  camera.position.copy(SPAWN)

  const rig = buildCorridor({ dark: true })
  scene.add(rig.group)
  // 어둠 속 최소 가시성: 차가운 저조도 + 붉은 비상등 풀 2개 + 비상구 초록 (포인트 3개 상한 준수)
  scene.add(new THREE.AmbientLight(0x39404f, 0.5))
  scene.add(new THREE.HemisphereLight(0x50586f, 0x0a0a0c, 0.45))
  const red1 = new THREE.PointLight(0xd21d16, 12, 11)
  red1.position.set(-0.8, 2.3, -4)
  scene.add(red1)
  const red2 = new THREE.PointLight(0xd21d16, 12, 11)
  red2.position.set(-0.8, 2.3, -20)
  scene.add(red2)
  const exitLight = new THREE.PointLight(0x22cc66, 5, 8)
  exitLight.position.set(0, 2.3, rig.endDoorZ + 0.5)
  scene.add(exitLight)
  // 물리 광원 단위: 스팟 강도는 수십 단위여야 체감된다
  const flashlight = new THREE.SpotLight(0xb8c9df, 28, 11, 0.5, 0.6, 1.6)
  flashlight.position.set(0, 0, 0)
  flashlight.target.position.set(0, 0, -1)
  camera.add(flashlight, flashlight.target)
  // 카메라 자식(손전등)은 카메라가 씬 그래프에 있어야만 렌더링에 반영된다
  scene.add(camera)

  const chaserVisual = makeChaser()
  scene.add(chaserVisual.group)
  // 점프스케어 전용 붉은 섬광 (평소 강도 0 — 광원 상한 계산에서 제외)
  const scareLight = new THREE.PointLight(0xff2318, 0, 4)
  scene.add(scareLight)

  const controls = new FPSControls(camera)
  // 알코브 진입을 위해 x 경계는 넓게 잡고, 프레임마다 수동 클램프
  controls.setBounds(
    new THREE.Vector3(-(CORRIDOR.W / 2 + CORRIDOR.RECESS - 0.15), 1.6, rig.endDoorZ + 0.6),
    new THREE.Vector3(CORRIDOR.W / 2 + CORRIDOR.RECESS - 0.15, 1.6, 1.8),
  )

  const ray = new THREE.Raycaster()
  const steps = new FootstepTracker()
  let ctx!: SceneCtx
  let ai: ChaserAI | null = null
  let busy = false // 포획 연출/종료 중

  function makeAI(fails: number): ChaserAI {
    // 자동 완화 (스펙 §8): 2회째부터 감지 반경 -20%씩, 4회째부터 추격 속도 -10%씩. 화면 표시 금지.
    const sense = Math.max(0.4, 0.8 ** Math.max(0, fails - 1))
    const spd = Math.max(0.7, 0.9 ** Math.max(0, fails - 3))
    return new ChaserAI({
      // 리셋 시 첫 웨이포인트에서 시작 — 반드시 스폰 반대편(-25)이 먼저.
      // 순찰 상한 -10: 시야 6m가 스폰(z≈1.2)까지 닿지 않게 (가만히 있으면 안전)
      waypoints: [{ x: 0, z: -25 }, { x: 0, z: -10 }],
      hearRadius: 8 * sense,
      sightRadius: 6 * sense,
      sightAngleDeg: 70,
      speedPatrol: 1.4,
      speedChase: 2.9 * spd,
      searchMs: 2500,
      catchRadius: 0.55,
    })
  }

  function clampToCorridor(p: THREE.Vector3): void {
    let xMin = -(CORRIDOR.W / 2 - 0.22)
    let xMax = CORRIDOR.W / 2 - 0.22
    for (const zone of rig.recessZones) {
      if (p.z >= zone.zMin && p.z <= zone.zMax) {
        const deep = zone.side * (CORRIDOR.W / 2 + CORRIDOR.RECESS - 0.18)
        if (zone.side > 0) xMax = deep
        else xMin = deep
      }
    }
    p.x = Math.max(xMin, Math.min(xMax, p.x))
  }

  function isOccluded(): boolean {
    const from = chaserVisual.group.position.clone().setY(1.8)
    const to = camera.position.clone()
    const dir = to.clone().sub(from)
    const dist = dir.length()
    ray.set(from, dir.normalize())
    ray.far = dist
    const hit = ray.intersectObjects(rig.wallMeshes, false)[0]
    return !!hit && hit.distance < dist - 0.15
  }

  async function onCaught(): Promise<void> {
    busy = true
    ctx.modes.toUI()
    sound.synth?.setHeartRate(1)
    sound.synth?.play('whisper', 1)
    sound.synth?.play('glitch', 0.9)

    // ── 점프스케어: 얼굴이 카메라 정면으로 들이닥친다 ──
    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    dir.y = 0
    dir.normalize()
    const from = camera.position.clone().addScaledVector(dir, 1.6)
    const to = camera.position.clone().addScaledVector(dir, 0.42)
    chaserVisual.group.rotation.y = Math.atan2(-dir.x, -dir.z) // 카메라를 마주 봄

    // 머리 본의 실제 월드 높이를 측정해 얼굴을 정확히 눈높이에 (스케일 가정 금지)
    chaserVisual.group.position.set(from.x, 0, from.z)
    chaserVisual.group.updateMatrixWorld(true)
    const headObj =
      chaserVisual.group.getObjectByName('head') ?? chaserVisual.group.getObjectByName('Head')
    const headWorldY = headObj
      ? headObj.getWorldPosition(new THREE.Vector3()).y
      : 1.84
    const groundY = camera.position.y - headWorldY

    flashlight.intensity = 0 // 손전등이 얼굴을 태우지 않게 — 붉은 섬광만
    // 턱 아래 언더라이팅 — 얼굴에 그림자가 위로 지는 고전 공포 조명
    scareLight.position.copy(camera.position).addScaledVector(dir, 0.18)
    scareLight.position.y = camera.position.y - 0.35
    scareLight.intensity = 30
    ctx.fx.set({ rgbShift: 0.85, glitch: 0.35, vignette: 0.7 })
    for (let t = 0; t <= 1; t += 0.2) {
      const p = from.clone().lerp(to, t * t) // 가속하며 돌진
      chaserVisual.group.position.set(p.x, groundY, p.z)
      await wait(40)
    }
    // 응시 — 스트로브 + 이펙트 지터로 릴 특유의 "뭉개진 얼굴" 질감
    for (let i = 0; i < 7; i++) {
      scareLight.intensity = i % 2 === 0 ? 34 : 10
      ctx.fx.set({ rgbShift: 0.6 + (i % 3) * 0.15, glitch: 0.25 + (i % 2) * 0.2 })
      await wait(90)
    }
    scareLight.intensity = 0
    flashlight.intensity = 28
    sound.synth?.stop('heartbeat')
    ctx.fx.set({ glitch: 1, rgbShift: 0.9 })
    await wait(400)
    ctx.fx.set({ glitch: 0, rgbShift: 0, grain: 0.1, vignette: 0.42 })
    ctx.state.chaseFails++
    addJournal(ctx.state, 'chase_failed')
    await ctx.overlay.showCard('기록 손상 — 해당 구간을 재복원합니다', 1900)
    // 리셋 — 크리처를 즉시 순찰 시작점으로 치운다 (잡힌 자리에 시체처럼 남지 않게)
    camera.position.copy(SPAWN)
    ai = makeAI(ctx.state.chaseFails)
    chaserVisual.apply({ x: 0, z: -25 }, Math.PI, 16, 'walk')
    sound.synth?.start('heartbeat', 0.22)
    await ctx.overlay.showClickToContinue()
    ctx.modes.toFPS(true)
    busy = false
  }

  async function onReach(): Promise<void> {
    busy = true
    ctx.modes.toUI()
    sound.synth?.stop('heartbeat')
    addJournal(ctx.state, 'chase_done')
    void ctx.overlay.showSubtitle('면담실이다.', 1500)
    await wait(900)
    ctx.advance()
  }

  return {
    scene,
    camera,
    async enter(c: SceneCtx) {
      ctx = c
      ctx.modes.onChange(m => { controls.enabled = m === 'fps' })
      ctx.fx.set({ grain: 0.14, vignette: 0.42 })
      ai = makeAI(ctx.state.chaseFails)
      await ctx.overlay.showCard('복도가 어둡다.', 1400)
      void ctx.overlay.showSubtitle('면담실은 복도 끝이다. 무언가가 돌아다닌다.', 3000)
      await ctx.overlay.showClickToContinue()
      sound.synth?.start('heartbeat', 0.22)
      ctx.modes.toFPS(true)
      void ctx.overlay.showSubtitle('걸으면 조용하다 · Shift 달리기는 소리가 난다 · 문틈에 숨어라', 3400)
    },
    exit() {
      controls.dispose()
      ctx?.overlay.setCrosshair('off')
      sound.synth?.stop('heartbeat')
    },
    update(dt) {
      controls.update(dt)
      if (!ctx || busy || !ai) return
      clampToCorridor(camera.position)
      if (ctx.modes.mode !== 'fps') return
      steps.update(camera.position)

      const out = ai.update({
        dtMs: dt,
        playerPos: { x: camera.position.x, z: camera.position.z },
        playerIsRunning: controls.isRunning,
        occluded: isOccluded(),
      })
      chaserVisual.apply(
        out.pos,
        out.facing,
        dt,
        out.state === 'chase' ? 'run' : out.state === 'search' ? 'idle' : 'walk',
      )

      // 근접 연출: 거리 = 심장 박동·글리치 강도
      const d = Math.hypot(out.pos.x - camera.position.x, out.pos.z - camera.position.z)
      const near = Math.max(0, 1 - d / 10)
      sound.synth?.setHeartRate(near)
      ctx.fx.set({ glitch: Math.max(0, 1 - d / 4) * 0.45 })

      if (out.caught) {
        void onCaught()
        return
      }
      if (camera.position.z < rig.endDoorZ + 1.3) void onReach()
    },
  }
}
