import * as THREE from 'three'
import type { GameScene, SceneCtx } from './sceneManager'
import { clearCheckpoint } from '../core/checkpoint'
import { STR } from '../content/strings'

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

export function makeEnding(): GameScene {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000000)
  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 10)

  return {
    scene,
    camera,
    async enter(ctx: SceneCtx) {
      ctx.modes.toUI()
      const o = ctx.overlay

      // 1. 일지 몽타주 — 이번 판에 쌓인 기록 (스펙 §9-1)
      for (const j of ctx.state.journal) await o.showCard(j.text, 1700)

      // 2. 면담 — 질문만 들리고 대답은 손상 (스펙 §9-2)
      await o.showSubtitle(STR.ending.q1, 2200)
      ctx.fx.pulse('glitch', 0.5, 900)
      await o.showSubtitle(STR.ending.corrupt, 1400)
      await o.showSubtitle(STR.ending.q2, 2400)
      ctx.fx.pulse('glitch', 0.6, 1100)
      await o.showSubtitle(STR.ending.corrupt, 1600)
      await o.showSubtitle(STR.ending.accept, 2400)

      // 3. 기록 끊김 (스펙 §9-3)
      await o.showCard(STR.ending.exit, 2000)
      ctx.fx.set({ glitch: 1, rgbShift: 0.8 })
      await wait(900)
      ctx.fx.set({ glitch: 0, rgbShift: 0, grain: 0.05 })

      // 4. 정적 1.5초 → 안내 (스펙 §9-4)
      await wait(1500)
      await o.showCard(STR.ending.lostFinal, 2400)

      // 5. 엔딩 타이틀 카드 (스펙 §9-5 — 크래시 오해 방지)
      await o.showCard(STR.ending.card, 3000)

      // 6. 포스트크레딧 고정 컷 (스펙 §9-6)
      await o.showCard(STR.ending.postcredit, 2600)
      ctx.fx.pulse('glitch', 0.9, 500)

      // 7. 크레딧 → 타이틀 복귀 (CC-BY 에셋 크레딧 포함)
      await o.showCard(STR.ending.creditsNote, 2200)
      await o.showSubtitle(STR.ending.creditsAssets, 2400)
      clearCheckpoint()
      location.reload()
    },
    exit() {},
    update() {},
  }
}
