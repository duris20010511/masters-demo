import { describe, expect, it } from 'vitest'
import { ChaserAI, type ChaserConfig } from '../src/chase/chaserAI'

const config: ChaserConfig = {
  waypoints: [{ x: 0, z: 0 }, { x: 0, z: 10 }],
  hearRadius: 6,
  sightRadius: 8,
  sightAngleDeg: 120,
  speedPatrol: 2,
  speedChase: 10,
  searchMs: 100,
  catchRadius: 0.25,
}

const hiddenPlayer = { playerPos: { x: 100, z: 100 }, playerIsRunning: false, occluded: true }

describe('ChaserAI', () => {
  it('patrol 상태에서 웨이포인트를 순환한다', () => {
    const ai = new ChaserAI(config)
    const positions = Array.from({ length: 5 }, () => ai.update({ dtMs: 1000, ...hiddenPlayer }).pos.z)

    expect(positions).toEqual([2, 4, 6, 8, 10])
    expect(ai.update({ dtMs: 1000, ...hiddenPlayer }).pos).toEqual({ x: 0, z: 8 })
  })

  it('달리는 플레이어가 hearRadius 안에 오면 investigate로 전이한다', () => {
    const ai = new ChaserAI(config)

    const output = ai.update({
      dtMs: 0,
      playerPos: { x: 4, z: 0 },
      playerIsRunning: true,
      occluded: true,
    })

    expect(output.state).toBe('investigate')
  })

  it('시야 거리와 각도 안의 가려지지 않은 플레이어를 보면 chase로 전이한다', () => {
    const ai = new ChaserAI(config)

    const output = ai.update({
      dtMs: 0,
      playerPos: { x: 0, z: 5 },
      playerIsRunning: false,
      occluded: false,
    })

    expect(output.state).toBe('chase')
  })

  it('chase 중 1초 이상 가려지면 search를 거쳐 return과 patrol로 복귀한다', () => {
    const ai = new ChaserAI(config)
    ai.update({ dtMs: 100, playerPos: { x: 0, z: 5 }, playerIsRunning: false, occluded: false })

    expect(ai.update({ dtMs: 1000, ...hiddenPlayer }).state).toBe('search')
    expect(ai.update({ dtMs: 101, ...hiddenPlayer }).state).toBe('return')
    expect(ai.update({ dtMs: 2500, ...hiddenPlayer }).state).toBe('patrol')
  })

  it('catchRadius 안에서 caught=true이고 reset 후 초기화한다', () => {
    const ai = new ChaserAI(config)

    expect(ai.update({ dtMs: 0, playerPos: { x: 0.2, z: 0 }, playerIsRunning: false, occluded: true }).caught).toBe(true)
    ai.reset()
    const resetOutput = ai.update({ dtMs: 0, ...hiddenPlayer })

    expect(resetOutput).toMatchObject({ pos: { x: 0, z: 0 }, state: 'patrol', caught: false })
  })
})
