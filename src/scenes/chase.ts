import * as THREE from 'three'
import type { GameScene, SceneCtx } from './sceneManager'
import { FPSControls } from '../input/controls'
import { buildLoopMap } from '../world/loopMap'
import { makeGlowSprite } from '../world/textures'
import { STR } from '../content/strings'
import { makeChaser } from '../world/person'
import { loadModel } from '../world/models'
import { ChaserAI } from '../chase/chaserAI'
import { addJournal } from '../core/journal'
import { sound, FootstepTracker } from '../audio/sound'

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

export function makeChase(): GameScene {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x050505)
  scene.fog = new THREE.Fog(0x070707, 4, 30)
  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 40)
  const rig = buildLoopMap() // ㅁ자 순환 복도 + 방 3개
  scene.add(rig.group)
  const SPAWN = rig.spawn.clone()
  camera.position.copy(SPAWN)

  // ── 연구 자료 픽업 3종 (알코브 안에 숨겨 배치 — 들어가려면 위험을 감수) ──
  const PAPER = new THREE.MeshStandardMaterial({
    color: 0xe8e2d0,
    emissive: 0x6a6455, // 어둠 속에서 배어나오게
    emissiveIntensity: 1,
    roughness: 0.9,
  })
  interface Pickup { group: THREE.Group; taken: boolean }
  const pickups: Pickup[] = []
  // 방 3곳에 하나씩 — 세 방을 전부 뒤져야 나갈 수 있다
  for (const room of rig.rooms) {
    const g2 = new THREE.Group()
    const folder = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.22), PAPER)
    folder.rotation.z = 0.06
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.01, 0.19), PAPER)
    sheet.position.set(0.03, 0.03, 0.02)
    sheet.rotation.y = 0.2
    g2.add(folder, sheet)
    const glow = makeGlowSprite(1.1, 1.1, 0xfff0c0)
    glow.position.y = 0.1
    g2.add(glow)
    g2.position.copy(room.spot)
    scene.add(g2)
    pickups.push({ group: g2, taken: false })
  }
  let collected = 0
  // 어둠 속 최소 가시성: 차가운 저조도 + 붉은 비상등 풀 2개 + 비상구 초록 (포인트 3개 상한 준수)
  scene.add(new THREE.AmbientLight(0x39404f, 0.5))
  scene.add(new THREE.HemisphereLight(0x50586f, 0x0a0a0c, 0.45))
  const red1 = new THREE.PointLight(0xd21d16, 14, 13)
  red1.position.set(-9.6, 2.3, -8)
  scene.add(red1)
  const red2 = new THREE.PointLight(0xd21d16, 14, 13)
  red2.position.set(9.6, 2.3, -8)
  scene.add(red2)
  const exitLight = new THREE.PointLight(0x22cc66, 6, 9)
  exitLight.position.copy(rig.exit).setY(2.3)
  scene.add(exitLight)
  // 물리 광원 단위: 스팟 강도는 수십 단위여야 체감된다
  const flashlight = new THREE.SpotLight(0xb8c9df, 28, 11, 0.5, 0.6, 1.6)
  // 손전등이 추격자를 비출 때 벽에 실루엣이 드리운다 — 이 장르에서 가장 강한 연출
  flashlight.castShadow = true
  flashlight.shadow.mapSize.set(1024, 1024)
  flashlight.shadow.camera.near = 0.5
  flashlight.shadow.camera.far = 12
  flashlight.shadow.bias = -0.0015
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

  // 점프스케어 전용 히어로 크리처 (Gaunt Horror Creature, PurplePoint CC-BY-4.0)
  // 정적 모델 — 추격 본체는 애니메이션 있는 왜곡 인간이 맡고, 들이닥치는 얼굴만 이걸로 스왑
  let scareFigure: THREE.Group | null = null
  let scareFaceY = 1.9
  void loadModel('./assets/models/gaunt.glb')
    .then(m => {
      const root = m.scene.clone(true)
      const box = new THREE.Box3().setFromObject(root) // 뼈대 없는 정적 메시 — Box3 신뢰 가능
      const h = box.max.y - box.min.y
      const s = 2.3 / h
      root.scale.setScalar(s)
      root.position.y = -box.min.y * s // 발이 y=0
      scareFaceY = h * 0.88 * s // 얼굴 ≈ 키의 88% 지점
      const wrap = new THREE.Group()
      wrap.add(root)
      wrap.visible = false
      scene.add(wrap)
      scareFigure = wrap
    })
    .catch(e => console.warn('[scare] gaunt load failed', e))

  const controls = new FPSControls(camera)
  // 경계는 복도 전체(알코브 포함)로 넓게, 실제 차단은 벽 콜라이더가 담당한다.
  // (좌표 클램프 방식은 알코브에서 대각선 이동에 뚫린다 — 연구실과 같은 AABB 방식으로 통일)
  controls.setBounds(rig.bounds.min, rig.bounds.max)
  // 반경 0.22 — 문 폭 2m라 통행에 여유가 있다
  controls.setColliders(FPSControls.collidersFrom(rig.wallMeshes), 0.22)
  // 방 소품(GLB)은 비동기 로드 — 다 들어오면 콜라이더를 한 번 재계산
  let propColliders = false

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
      // 링을 도는 4코너 순찰 — 어느 쪽에서 올지 모른다
      waypoints: rig.patrol,
      hearRadius: 8 * sense,
      sightRadius: 6 * sense,
      sightAngleDeg: 70,
      speedPatrol: 1.4,
      speedChase: 2.9 * spd,
      searchMs: 2500,
      catchRadius: 0.55,
    })
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
    const facing = Math.atan2(-dir.x, -dir.z) // 카메라를 마주 봄

    // 히어로 크리처가 로드돼 있으면 스왑, 아니면 추격 본체 얼굴로 폴백
    let figure: THREE.Group
    let groundY: number
    if (scareFigure) {
      figure = scareFigure
      figure.visible = true
      chaserVisual.group.visible = false
      groundY = camera.position.y - scareFaceY
    } else {
      figure = chaserVisual.group
      figure.position.set(from.x, 0, from.z)
      figure.updateMatrixWorld(true)
      const headObj = figure.getObjectByName('head') ?? figure.getObjectByName('Head')
      const headWorldY = headObj ? headObj.getWorldPosition(new THREE.Vector3()).y : 1.84
      groundY = camera.position.y - headWorldY
    }
    figure.rotation.y = facing

    flashlight.intensity = 0 // 손전등이 얼굴을 태우지 않게 — 붉은 섬광만
    // 턱 아래 언더라이팅 — 얼굴에 그림자가 위로 지는 고전 공포 조명
    scareLight.position.copy(camera.position).addScaledVector(dir, 0.18)
    scareLight.position.y = camera.position.y - 0.35
    scareLight.intensity = 30
    ctx.fx.set({ rgbShift: 0.85, glitch: 0.35, vignette: 0.7 })
    for (let t = 0; t <= 1; t += 0.2) {
      const p = from.clone().lerp(to, t * t) // 가속하며 돌진
      figure.position.set(p.x, groundY, p.z)
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
    if (scareFigure) {
      scareFigure.visible = false
      chaserVisual.group.visible = true
    }
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
    chaserVisual.apply(rig.patrol[0], Math.PI, 16, 'walk')
    sound.synth?.start('heartbeat', 0.22)
    await ctx.overlay.showClickToContinue()
    ctx.modes.toFPS(true)
    busy = false
  }

  /** 자료 회수 — 근접하면 자동 수집 (쫓기는 중이라 조작을 요구하지 않는다) */
  function checkPickups(): void {
    for (const [i, p] of pickups.entries()) {
      if (p.taken) continue
      const d = Math.hypot(p.group.position.x - camera.position.x, p.group.position.z - camera.position.z)
      if (d > 1.0) continue
      p.taken = true
      p.group.visible = false
      collected++
      sound.synth?.play('beep_ok', 0.35)
      ctx.fx.pulse('glitch', 0.25, 260)
      ctx.overlay.setHud(STR.chase.hud(collected, pickups.length))
      void ctx.overlay.showSubtitle(
        `${rig.rooms[i].name} · ${STR.chase.pickup[i]} — "${STR.chase.note[i]}"`,
        2800,
      )
      if (collected === pickups.length) {
        void ctx.overlay.showSubtitle(STR.chase.complete, 2400)
        addJournal(ctx.state, 'cycle2_bad') // "나갈 이유를 먼저 만들어라"
      }
    }
  }

  let lockedNotice = 0
  async function onReach(): Promise<void> {
    // 자료가 모자라면 문이 열리지 않는다 (되돌아가서 마저 챙겨야 함)
    if (collected < pickups.length) {
      if (performance.now() - lockedNotice > 3000) {
        lockedNotice = performance.now()
        sound.synth?.play('beep_error', 0.4)
        void ctx.overlay.showSubtitle(STR.chase.locked, 2200)
      }
      return
    }
    busy = true
    ctx.modes.toUI()
    ctx.overlay.setHud('')
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
      await ctx.overlay.showCard(STR.chase.brief, 1400)
      void ctx.overlay.showSubtitle(STR.chase.order, 3200)
      await ctx.overlay.showClickToContinue()
      sound.synth?.start('heartbeat', 0.22)
      ctx.overlay.setHud(STR.chase.hud(0, pickups.length))
      ctx.modes.toFPS(true)
      void ctx.overlay.showSubtitle(STR.chase.tip, 3400)
    },
    exit() {
      controls.dispose()
      ctx?.overlay.setCrosshair('off')
      ctx?.overlay.setHud('')
      sound.synth?.stop('heartbeat')
    },
    update(dt) {
      controls.update(dt)
      if (!ctx || busy || !ai) return
      if (!propColliders && rig.solidProps.every(p => p.children.length > 0)) {
        propColliders = true
        controls.setColliders(
          FPSControls.collidersFrom([...rig.wallMeshes, ...rig.solidProps]),
          0.22,
        )
      }
      if (ctx.modes.mode !== 'fps') return
      steps.update(camera.position)
      checkPickups()

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
      if (camera.position.distanceTo(rig.exit) < 1.6) void onReach()
    },
  }
}
