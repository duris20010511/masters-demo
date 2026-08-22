import * as THREE from 'three'
import type { GameScene, SceneCtx } from './sceneManager'
import { loadCheckpoint, clearCheckpoint } from '../core/checkpoint'
import { STR } from '../content/strings'

export const audio = { ctx: null as AudioContext | null }

export function makeTitle(): GameScene {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000000)
  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 10)

  return {
    scene,
    camera,
    async enter(ctx: SceneCtx) {
      // 오디오 게이트 (자동재생 정책 — 스펙 §11). 이 클릭이 이후 PointerLock 제스처 체인의 시작.
      await ctx.overlay.showGate(STR.title.name, STR.title.sub, STR.title.gate)
      audio.ctx ??= new AudioContext()
      await audio.ctx.resume()

      // 재접속 복원 (스펙 §11 체크포인트) — 네이티브 confirm 대신 인게임 선택지
      const saved = loadCheckpoint()
      if (saved && saved.phase !== 'title' && saved.phase !== 'ending') {
        const pick = await ctx.overlay.showChoices(STR.title.resume, [
          { id: 'resume', label: '이어서 복원한다' },
          { id: 'restart', label: '처음부터 복원한다' },
        ])
        if (pick === 'resume') {
          Object.assign(ctx.state, saved)
          ctx.goTo(saved.phase)
          return
        }
        clearCheckpoint()
      }

      // 디제시스 프리로더: 슬라이스에서는 대용량 에셋이 없어 짧은 연출로 대체.
      // (계획 2에서 실제 프리로더 진행률과 연동)
      ctx.fx.set({ grain: 0.15 })
      for (const p of [12, 38, 61, 73, 89, 100]) {
        ctx.fx.pulse('glitch', 0.3, 120)
        await ctx.overlay.showSubtitle(STR.title.restoring(p), 220)
      }
      ctx.advance()
    },
    exit() {},
    update() {},
  }
}
