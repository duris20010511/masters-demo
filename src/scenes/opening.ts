import * as THREE from 'three'
import type { GameScene, SceneCtx } from './sceneManager'
import { FPSControls } from '../input/controls'
import { buildCorridor } from '../world/corridor'
import { applyStat } from '../core/state'
import { addJournal } from '../core/journal'
import { sound, FootstepTracker } from '../audio/sound'

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

export function makeOpening(): GameScene {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x101014)
  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 60)
  camera.position.set(0, 1.6, 1.6)

  const rig = buildCorridor({ dark: false })
  scene.add(rig.group)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9a9aa8, 2.2))
  scene.add(new THREE.AmbientLight(0xffffff, 0.45))

  const controls = new FPSControls(camera)
  controls.setBounds(new THREE.Vector3(-0.9, 1.6, rig.endDoorZ + 0.8), new THREE.Vector3(0.9, 1.6, 1.8))

  let ctx!: SceneCtx
  let platesSwapped = false
  let teleports = 0
  let ended = false
  const steps = new FootstepTracker()

  async function endSequence(): Promise<void> {
    ended = true
    ctx.modes.toUI()
    const o = ctx.overlay
    // 정문 카드 오류 (스펙 §3)
    ctx.fx.pulse('rgbShift', 0.7, 500)
    ctx.fx.pulse('glitch', 0.5, 500)
    sound.synth?.play('beep_error', 0.5)
    await o.showSubtitle('출입 권한을 확인할 수 없습니다.', 1900)
    sound.synth?.play('beep_error', 0.5)
    await o.showSubtitle('등록되지 않은 구성원입니다.', 1900)
    applyStat(ctx.state, 'sanity', -10)
    // 암전 — 교수 시퀀스 (원작 3-3장 대사)
    await o.showCard('…', 900)
    await o.showSubtitle('교수: "어디 갔다 왔어?"', 2100)
    await o.showSubtitle('교수: "이걸 두고 가면 어떡해."', 2100)
    await o.showBadge(ctx.state)
    await o.showSubtitle('교수: "연구실 사람은 이거 없으면 안 되지."', 2200)
    await o.showSubtitle('교수: "내일 일찍 와."', 1900)
    // 시계 파괴
    await o.showCard('21:47', 1100)
    ctx.fx.pulse('glitch', 0.9, 600)
    ctx.fx.pulse('rgbShift', 0.8, 600)
    await wait(400)
    await o.showCard('??:??', 1600)
    addJournal(ctx.state, 'opening')
    ctx.advance()
  }

  return {
    scene,
    camera,
    async enter(c: SceneCtx) {
      ctx = c
      ctx.modes.onChange(m => { controls.enabled = m === 'fps' })
      ctx.fx.set({ grain: 0.07, vignette: 0.2 })
      sound.synth?.start('hum', 0.15)
      await ctx.overlay.showCard('21:47', 1200)
      void ctx.overlay.showSubtitle('"저 먼저 가보겠습니다."', 1800)
      await wait(1900)
      void ctx.overlay.showSubtitle('동료: "어. 내일 봐."', 1600)
      await ctx.overlay.showClickToContinue()
      ctx.modes.toFPS(true)
      void ctx.overlay.showSubtitle('정문으로 나가자. (앞으로 이동)', 2600)
    },
    exit() {
      controls.dispose()
      ctx?.overlay.setCrosshair('off')
      sound.synth?.stop('hum')
    },
    update(dt) {
      controls.update(dt)
      if (!ctx || ended || ctx.modes.mode !== 'fps') return
      steps.update(camera.position)
      const z = camera.position.z

      // 첫 이상: 명패가 전부 405호로 (조작 시작 후 ~10초 지점, 글리치로 교체 은폐)
      if (!platesSwapped && z < -10) {
        platesSwapped = true
        ctx.fx.pulse('glitch', 0.4, 250)
        rig.setAllPlates('405호')
        void ctx.overlay.showSubtitle('…또 405호?', 2000)
      }
      // 비유클리드 루프: 시야 밖 텔레포트 2회 (글리치 프레임에 은폐)
      if (teleports < 2 && z < -26) {
        teleports++
        ctx.fx.pulse('glitch', 0.55, 180)
        camera.position.z += 18
        if (teleports === 2) void ctx.overlay.showSubtitle('복도가… 끝나지 않는다.', 2200)
      }
      // 정문 도달
      if (teleports >= 2 && z < rig.endDoorZ + 1.6) {
        void endSequence()
      }
    },
  }
}
