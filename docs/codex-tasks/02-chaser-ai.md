# Codex 작업 #2 — 추적자 AI 상태머신

**확인 질문 없이 바로 구현할 것. 완료 후 `npm test`를 실행해 결과를 보여줄 것.**

## 맡기는 것
새 파일 2개 생성:
- `src/chase/chaserAI.ts` — 추적자 AI (Three.js 의존 금지, 순수 TypeScript 로직만)
- `tests/chaserAI.test.ts` — vitest 단위 테스트 (아래 시나리오 포함)

다른 파일은 절대 수정하지 말 것.

## 고정 인터페이스 (변경 금지 — 이대로 export)

```ts
export type ChaserState = 'patrol' | 'investigate' | 'chase' | 'search' | 'return'

export interface ChaserConfig {
  waypoints: { x: number; z: number }[] // 순찰 순환 경로 (최소 2개)
  hearRadius: number                    // 달리기 소음 감지 반경 (m)
  sightRadius: number                   // 시야 감지 거리 (m)
  sightAngleDeg: number                 // 시야 원뿔 전체 각도 (도)
  speedPatrol: number                   // m/s
  speedChase: number                    // m/s
  searchMs: number                      // 시야 상실 후 그 자리 주변을 배회하는 시간
  catchRadius: number                   // 이 거리 안이면 잡힘 (m)
}

export interface ChaserInput {
  dtMs: number
  playerPos: { x: number; z: number }
  playerIsRunning: boolean              // 달리는 중 (소음 발생)
  occluded: boolean                     // 추적자→플레이어 시선이 벽에 막혔는가 (호출측이 판정해서 줌)
}

export interface ChaserOutput {
  pos: { x: number; z: number }
  state: ChaserState
  facing: number                        // 이동 방향 라디안 (atan2(dx, dz) 기준)
  caught: boolean
}

export class ChaserAI {
  constructor(config: ChaserConfig)
  reset(): void                         // 시작 웨이포인트로 복귀, patrol 상태로
  update(input: ChaserInput): ChaserOutput
}
```

## 상태 전이 규칙 (스펙 §8)

- **patrol**: waypoints를 순서대로 순환 (speedPatrol). 다음 조건으로 전이 —
  - 플레이어가 달리는 중 && 거리 ≤ hearRadius → **investigate** (소리 난 지점을 기억)
  - 플레이어가 보임 → **chase**
- **investigate**: 기억한 지점으로 이동. 도착했는데 아무것도 없으면 → **return**. 이동 중 플레이어가 보이면 → **chase**
- **chase**: 플레이어 현재 위치를 향해 직선 이동 (speedChase). 시선이 occluded 상태로 1초 지속되면 마지막 목격 지점으로 이동 후 → **search**
- **search**: 마지막 목격 지점 주변 반경 1.5m를 searchMs 동안 배회. 다시 보이면 → **chase**, 시간 만료 → **return**
- **return**: 가장 가까운 waypoint로 이동, 도착하면 → **patrol**
- **"보임" 판정**: 거리 ≤ sightRadius && 추적자의 진행 방향 기준 sightAngleDeg/2 이내 && !occluded
- **caught**: 어느 상태에서든 거리 ≤ catchRadius면 true (한 번 true면 reset 전까지 유지)

## 구현 제약
- 경로 탐색(A* 등) 금지 — 이동은 전부 목표점 직선 이동 (맵이 복도형이라 충분)
- `Math.random()` 사용 금지 — search 배회는 결정적 패턴(예: 사인파 원운동)으로
- 외부 라이브러리·Three.js import 금지. 시간은 input.dtMs 누적으로만

## 테스트에 반드시 포함할 시나리오
1. patrol 상태에서 웨이포인트를 순환한다 (여러 update 후 위치가 경로를 따라간다)
2. 달리는 플레이어가 hearRadius 안에 오면 investigate로 전이
3. 시야(거리·각도·occluded 아님) 안의 플레이어를 보면 chase로 전이
4. chase 중 1초 이상 가려지면 search를 거쳐 return→patrol로 복귀
5. catchRadius 안에서 caught=true, reset() 후 초기화

## 검증
`npm test` 전체 통과 (기존 17개 + 새 테스트). 기존 테스트를 깨뜨리지 말 것.
