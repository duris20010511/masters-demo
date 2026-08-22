# 《석사과정》 데모 — 계획 1: 관통 슬라이스 구현

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 타이틀 → 연구실(업무 사이클 ① + 동료 대화 최소) → 엔딩 시네마틱 축약판까지, 처음부터 끝까지 플레이 가능하고 GitHub Pages에 배포된 수직 슬라이스를 만든다.

**Architecture:** Three.js 1인칭 씬 위에 DOM 오버레이(UI 모드)를 얹는 2층 구조. 게임 로직(스탯·일지·페이즈·미니게임 판정)은 렌더링과 분리된 순수 TS 모듈로 두고 vitest로 테스트한다. 씬 전환은 단일 포스트프로세싱 패스의 글리치 강도 램프로 연출한다. 미구현 페이즈는 "기록 유실" 카드로 자동 통과시켜 어느 시점에든 끝까지 플레이 가능하게 유지한다.

**Tech Stack:** Vite 6 + TypeScript 5 + three ^0.170 + vitest 2 (jsdom). 배포: GitHub Actions → GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-08-22-lab-horror-demo-design.md` (v3)

## Global Constraints (스펙 발췌 — 전 태스크 공통)

- `vite.config.ts`에 `base: './'` 필수. 에셋 경로는 전부 상대 경로.
- 실시간 그림자 전면 배제. 씬당 포인트/스팟 라이트 2~3개 상한, 형광등은 emissive.
- 포스트프로세싱은 **단일 커스텀 ShaderPass 하나** (비네트·그레인·글리치·RGB시프트 통합). `renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))`.
- 스탯 수치는 화면에 절대 노출하지 않는다. 내부 범위 0~100 클램프.
- 엔딩은 단일 1종 "기록의 끝". 스탯은 엔딩을 분기시키지 않는다.
- Esc = 일시정지 (가로채기 금지). Tab은 잠금 중 `preventDefault`.
- 체크포인트는 sessionStorage, 페이즈 경계에서만.
- 한글 텍스트·대사는 전부 `src/content/strings.ts`에 모은다 (스펙 문구 그대로).
- 오디오 파일은 이 계획에 없음 (계획 2에서 MP3/AAC로 추가). 오디오 게이트 클릭만 먼저 구현.
- 커밋은 각 태스크 끝마다. 메시지는 `feat:`/`test:`/`chore:` 프리픽스.

## File Structure

```
index.html                  # 캔버스 + #ui 오버레이 루트 + 새 창에서 열기 링크
vite.config.ts / tsconfig.json / package.json
.github/workflows/deploy.yml
src/main.ts                 # 부트스트랩: renderer, postfx, sceneManager, modes 연결
src/core/state.ts           # GameState, applyStat, flags
src/core/journal.ts         # 일지 트리거 테이블 (스펙 §5)
src/core/phases.ts          # 페이즈 순서 머신
src/core/checkpoint.ts      # sessionStorage 저장/복원
src/core/rng.ts             # 주입 가능한 RNG (들킴 30%)
src/input/modes.ts          # FPS↔UI↔PAUSED 상태머신 (PointerLock 래퍼)
src/input/controls.ts       # WASD + 마우스 시점 + E 레이캐스트
src/render/postfx.ts        # EffectComposer + 단일 패스, setFx/pulse API
src/render/glitchShader.ts  # GLSL (Codex 위임 — 폴백 셰이더 포함)
src/scenes/sceneManager.ts  # GameScene 인터페이스, 글리치 전환, 유실 카드
src/scenes/title.ts         # 오디오 게이트 + 디제시스 프리로더 + 조작법
src/scenes/lab.ts           # 연구실: 지오메트리, 라이팅, 상호작용, 동료
src/scenes/ending.ts        # 엔딩 시네마틱 축약판 시퀀서
src/ui/overlay.ts           # 대화·자막·선택지·출입증·카드 DOM 헬퍼
src/ui/minigame1.ts         # 서류 미니게임 (로직 reducer + DOM)
src/content/strings.ts      # 전 텍스트·명단 데이터
tests/*.test.ts             # state, journal, phases, checkpoint, modes, minigame1, badge
docs/codex-tasks/01-glitch-shader.md   # Codex 지시서 #1
docs/codex-log.md           # Codex 활용 로그 (제출용 원자료)
```

---

### Task 1: 프로젝트 스캐폴드 + 배포 파이프라인

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.ts`(임시), `.gitignore`, `.github/workflows/deploy.yml`, `docs/codex-log.md`

**Interfaces:**
- Produces: `npm run dev` / `npm run build` / `npm test` 동작. push 시 Pages 자동 배포.

- [ ] **Step 1: 설정 파일 작성**

`package.json`:
```json
{
  "name": "masters-demo",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": { "three": "^0.170.0" },
  "devDependencies": {
    "@types/three": "^0.170.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.0",
    "jsdom": "^25.0.0"
  }
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vite'
export default defineConfig({
  base: './',
  test: { environment: 'jsdom' },
} as any)
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "bundler",
    "strict": true, "skipLibCheck": true, "types": ["vite/client"],
    "noEmit": true
  },
  "include": ["src", "tests"]
}
```

`index.html`:
```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>석사과정</title>
  <style>
    html, body { margin: 0; height: 100%; background: #000; overflow: hidden;
      font-family: "Noto Sans KR", "Malgun Gothic", sans-serif; }
    #app { position: fixed; inset: 0; }
    #ui { position: fixed; inset: 0; pointer-events: none; color: #ddd; }
    #ui .interactive { pointer-events: auto; }
    #popout { position: fixed; top: 8px; right: 12px; z-index: 99; font-size: 12px;
      color: #666; text-decoration: none; pointer-events: auto; }
  </style>
</head>
<body>
  <div id="app"></div>
  <div id="ui"></div>
  <a id="popout" href="./" target="_blank" rel="noopener">새 창에서 열기 ↗</a>
  <script type="module" src="./src/main.ts"></script>
</body>
</html>
```

`src/main.ts` (임시 — Task 8에서 교체):
```ts
console.log('석사과정 — 손상된 기록')
```

`.gitignore`:
```
node_modules/
dist/
```

`.github/workflows/deploy.yml`:
```yaml
name: deploy
on: { push: { branches: [main] } }
permissions: { contents: read, pages: write, id-token: write }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: ${{ steps.deployment.outputs.page_url }} }
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

`docs/codex-log.md`:
```markdown
# Codex 활용 로그
| 날짜 | 작업 | 프롬프트 요지 | 결과 | 사람이 결정·수정한 부분 |
|---|---|---|---|---|
```

- [ ] **Step 2: 설치·기동 확인**

Run: `npm install && npm run dev` → 브라우저 콘솔에 로그 출력 확인 후 종료. `npm run build` 성공 확인.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "chore: Vite+TS+Three 스캐폴드, Pages 배포 워크플로"
```

---

### Task 2: GameState + 스탯

**Files:**
- Create: `src/core/state.ts`, Test: `tests/state.test.ts`

**Interfaces:**
- Produces:
  - `type StatKey = 'trust' | 'aptitude' | 'sanity'`
  - `type PhaseId = 'title' | 'opening' | 'cycle1' | 'cycle2' | 'chase' | 'ending'`
  - `interface JournalEntry { trigger: string; text: string }`
  - `interface GameState { phase: PhaseId; stats: Record<StatKey, number>; flags: Record<string, boolean>; journal: JournalEntry[]; chaseFails: number }`
  - `createState(): GameState` — trust 50, aptitude 30, sanity 100, phase 'title'
  - `applyStat(s: GameState, key: StatKey, delta: number): void` — 0~100 클램프

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/state.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { createState, applyStat } from '../src/core/state'

describe('GameState', () => {
  it('초기값: 신뢰 50 / 적합 30 / 정신 100, phase=title', () => {
    const s = createState()
    expect(s.stats).toEqual({ trust: 50, aptitude: 30, sanity: 100 })
    expect(s.phase).toBe('title')
    expect(s.journal).toEqual([])
    expect(s.chaseFails).toBe(0)
  })
  it('applyStat은 0~100으로 클램프한다', () => {
    const s = createState()
    applyStat(s, 'sanity', -150)
    expect(s.stats.sanity).toBe(0)
    applyStat(s, 'trust', 999)
    expect(s.stats.trust).toBe(100)
    applyStat(s, 'aptitude', 15)
    expect(s.stats.aptitude).toBe(45)
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npm test` → state.test 실패(모듈 없음) 확인

- [ ] **Step 3: 구현**

`src/core/state.ts`:
```ts
export type StatKey = 'trust' | 'aptitude' | 'sanity'
export type PhaseId = 'title' | 'opening' | 'cycle1' | 'cycle2' | 'chase' | 'ending'

export interface JournalEntry { trigger: string; text: string }

export interface GameState {
  phase: PhaseId
  stats: Record<StatKey, number>
  flags: Record<string, boolean>
  journal: JournalEntry[]
  chaseFails: number
}

export function createState(): GameState {
  return {
    phase: 'title',
    stats: { trust: 50, aptitude: 30, sanity: 100 },
    flags: {},
    journal: [],
    chaseFails: 0,
  }
}

export function applyStat(s: GameState, key: StatKey, delta: number): void {
  s.stats[key] = Math.max(0, Math.min(100, s.stats[key] + delta))
}
```

- [ ] **Step 4: 통과 확인** — Run: `npm test` → PASS

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: GameState와 스탯 클램프"`

---

### Task 3: 일지 시스템 + 텍스트 데이터

**Files:**
- Create: `src/core/journal.ts`, `src/content/strings.ts`, Test: `tests/journal.test.ts`

**Interfaces:**
- Produces:
  - `type JournalTrigger = 'opening' | 'cycle1_good' | 'cycle1_bad' | 'cycle2_good' | 'cycle2_bad' | 'chase_failed' | 'sanity_low' | 'chase_done'`
  - `addJournal(s: GameState, t: JournalTrigger): void` — 같은 트리거 중복 삽입 금지
  - `STR` — 전 한글 텍스트 상수 객체 (`src/content/strings.ts`)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/journal.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { createState } from '../src/core/state'
import { addJournal, JOURNAL_LINES } from '../src/core/journal'

describe('journal', () => {
  it('트리거 문장은 스펙 §5와 일치한다', () => {
    expect(JOURNAL_LINES.opening).toBe('오늘도 밤이었다.')
    expect(JOURNAL_LINES.cycle1_bad).toBe('잘하면 안 된다. 못해도 안 된다.')
    expect(JOURNAL_LINES.chase_done).toBe('말하는 것만으로는 안 된다. 정말로 갈 수 없게 만들어야 한다.')
  })
  it('addJournal은 순서대로 쌓이고 같은 트리거는 한 번만', () => {
    const s = createState()
    addJournal(s, 'opening')
    addJournal(s, 'cycle1_good')
    addJournal(s, 'opening')
    expect(s.journal.map(j => j.trigger)).toEqual(['opening', 'cycle1_good'])
    expect(s.journal[1].text).toBe('칭찬을 받았다. 기분이 나쁘다.')
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npm test`

- [ ] **Step 3: 구현**

`src/core/journal.ts`:
```ts
import type { GameState } from './state'

export type JournalTrigger =
  | 'opening' | 'cycle1_good' | 'cycle1_bad' | 'cycle2_good' | 'cycle2_bad'
  | 'chase_failed' | 'sanity_low' | 'chase_done'

export const JOURNAL_LINES: Record<JournalTrigger, string> = {
  opening: '오늘도 밤이었다.',
  cycle1_good: '칭찬을 받았다. 기분이 나쁘다.',
  cycle1_bad: '잘하면 안 된다. 못해도 안 된다.',
  cycle2_good: '여기까지 오면 늦는다.',
  cycle2_bad: '나갈 이유를 먼저 만들어라.',
  chase_failed: '복도에서 무언가를 봤다. 아무도 믿지 않는다.',
  sanity_low: '내 발소리가 한 박자 늦게 들린다.',
  chase_done: '말하는 것만으로는 안 된다. 정말로 갈 수 없게 만들어야 한다.',
}

export function addJournal(s: GameState, t: JournalTrigger): void {
  if (s.journal.some(j => j.trigger === t)) return
  s.journal.push({ trigger: t, text: JOURNAL_LINES[t] })
}
```

`src/content/strings.ts`:
```ts
export const STR = {
  title: {
    name: '석사과정',
    sub: '손상된 기록',
    gate: '클릭하여 기록 재생',
    restoring: (p: number) => `손상된 기록 복원 중… ${p}%`,
    headphones: '헤드폰 착용을 권장합니다',
    controls: 'WASD 이동 · 마우스 시점 · E 상호작용 · Tab 출입증 · Esc 일시정지',
    resume: '기록을 이어서 복원하시겠습니까?',
  },
  badge: { affil: '○○대학교 ○○연구실', roleBase: '학부연구생', roleTarget: '석사과정', name: '한○○' },
  lost: (phase: string) => `해당 구간의 기록은 유실되었습니다 — ${phase}`,
  colleague: {
    approach: ['교수님이 너 얘기 하더라.', '요즘 어때? 랩 생활.'],
    likeYou: '교수님이 너 마음에 들어하시더라.',
    choiceGood: '재밌어요. 배울 게 많아서.',
    choiceMeh: '…그냥 그렇죠, 뭐.',
  },
  doc: {
    taskTitle: '졸업생 진로 현황 업데이트',
    allGrad: '진로: 대학원 진학',
    selfRow: '한○○ — 대학원 진학 예정',
    choices: { accurate: '정확히 입력한다', mistake: '사소한 실수를 낸다', deleteRow: '내 이름이 있는 행을 조용히 지운다' },
    caught: '…방금 뭐 지웠어?',
  },
  ending: {
    q1: '"요즘 연구는 어때?"',
    q2: '"그런데 왜 우리 연구실에 들어왔어?"',
    corrupt: '▓▓▓▓▓▓치지직▓▓▓▓▓▓',
    accept: '"……그래."',
    exit: '퇴실 처리되었습니다',
    lostFinal: '이후의 기록은 복원할 수 없습니다.',
    card: '기록의 끝',
    postcredit: '한○○ · 진로 확인 필요',
    creditsNote: '이 데모는 복원된 기록의 일부입니다.',
  },
  pause: { title: '일시정지', resume: '계속하기 (클릭)' },
} as const
```

- [ ] **Step 4: 통과 확인** — Run: `npm test` → PASS

- [ ] **Step 5: Commit** — `git commit -am "feat: 일지 시스템과 전 텍스트 데이터"`

---

### Task 4: 페이즈 머신 + 체크포인트

**Files:**
- Create: `src/core/phases.ts`, `src/core/checkpoint.ts`, Test: `tests/phases.test.ts`, `tests/checkpoint.test.ts`

**Interfaces:**
- Produces:
  - `PHASE_ORDER: PhaseId[]` = `['title','opening','cycle1','cycle2','chase','ending']`
  - `nextPhase(p: PhaseId): PhaseId | null`
  - `saveCheckpoint(s: GameState): void` / `loadCheckpoint(): GameState | null` / `clearCheckpoint(): void`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/phases.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { PHASE_ORDER, nextPhase } from '../src/core/phases'

describe('phases', () => {
  it('순서는 스펙 §3과 일치한다', () => {
    expect(PHASE_ORDER).toEqual(['title', 'opening', 'cycle1', 'cycle2', 'chase', 'ending'])
  })
  it('nextPhase는 다음 페이즈, 마지막이면 null', () => {
    expect(nextPhase('cycle1')).toBe('cycle2')
    expect(nextPhase('ending')).toBeNull()
  })
})
```

`tests/checkpoint.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createState, applyStat } from '../src/core/state'
import { saveCheckpoint, loadCheckpoint, clearCheckpoint } from '../src/core/checkpoint'

describe('checkpoint (sessionStorage)', () => {
  beforeEach(() => sessionStorage.clear())
  it('저장 후 복원하면 동일한 상태', () => {
    const s = createState()
    s.phase = 'cycle2'
    applyStat(s, 'aptitude', 20)
    s.flags.metColleague = true
    saveCheckpoint(s)
    const r = loadCheckpoint()
    expect(r).toEqual(s)
  })
  it('없으면 null, clear 후에도 null', () => {
    expect(loadCheckpoint()).toBeNull()
    saveCheckpoint(createState())
    clearCheckpoint()
    expect(loadCheckpoint()).toBeNull()
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npm test`

- [ ] **Step 3: 구현**

`src/core/phases.ts`:
```ts
import type { PhaseId } from './state'

export const PHASE_ORDER: PhaseId[] = ['title', 'opening', 'cycle1', 'cycle2', 'chase', 'ending']

export function nextPhase(p: PhaseId): PhaseId | null {
  const i = PHASE_ORDER.indexOf(p)
  return i >= 0 && i < PHASE_ORDER.length - 1 ? PHASE_ORDER[i + 1] : null
}
```

`src/core/checkpoint.ts`:
```ts
import type { GameState } from './state'

const KEY = 'masters-demo/checkpoint/v1'

export function saveCheckpoint(s: GameState): void {
  sessionStorage.setItem(KEY, JSON.stringify(s))
}

export function loadCheckpoint(): GameState | null {
  const raw = sessionStorage.getItem(KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as GameState } catch { return null }
}

export function clearCheckpoint(): void {
  sessionStorage.removeItem(KEY)
}
```

- [ ] **Step 4: 통과 확인** — Run: `npm test` → PASS

- [ ] **Step 5: Commit** — `git commit -am "feat: 페이즈 순서와 sessionStorage 체크포인트"`

---

### Task 5: FPS↔UI 모드 상태머신

**Files:**
- Create: `src/input/modes.ts`, Test: `tests/modes.test.ts`

**Interfaces:**
- Produces:
  - `type Mode = 'fps' | 'ui' | 'paused'`
  - `class ModeManager { mode: Mode; toUI(): void; toFPS(userGesture: boolean): boolean; pause(): void; resume(userGesture: boolean): boolean; onChange(cb: (m: Mode) => void): void }`
  - 규칙: `toFPS`/`resume`은 `userGesture=true`일 때만 성공(브라우저 PointerLock 재잠금 정책). `pause()`는 fps/ui 어디서든 진입, `resume`은 pause 직전 모드로 복귀.
  - 실제 PointerLock 호출은 콜백 주입: `new ModeManager({ lock: () => void, unlock: () => void })` — 테스트에서는 스파이.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/modes.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { ModeManager } from '../src/input/modes'

function make() {
  const lock = vi.fn(); const unlock = vi.fn()
  return { m: new ModeManager({ lock, unlock }), lock, unlock }
}

describe('ModeManager', () => {
  it('초기 모드는 ui (타이틀 화면)', () => {
    expect(make().m.mode).toBe('ui')
  })
  it('toFPS는 제스처 없이는 실패, 제스처가 있으면 lock 호출', () => {
    const { m, lock } = make()
    expect(m.toFPS(false)).toBe(false)
    expect(m.toFPS(true)).toBe(true)
    expect(m.mode).toBe('fps')
    expect(lock).toHaveBeenCalledOnce()
  })
  it('toUI는 unlock을 부르고, pause→resume은 직전 모드로 복귀', () => {
    const { m, unlock } = make()
    m.toFPS(true)
    m.toUI()
    expect(m.mode).toBe('ui')
    expect(unlock).toHaveBeenCalledOnce()
    m.toFPS(true)
    m.pause()
    expect(m.mode).toBe('paused')
    expect(m.resume(false)).toBe(false)
    expect(m.resume(true)).toBe(true)
    expect(m.mode).toBe('fps')
  })
  it('onChange 콜백이 모드 변화마다 불린다', () => {
    const { m } = make()
    const cb = vi.fn()
    m.onChange(cb)
    m.toFPS(true); m.toUI()
    expect(cb.mock.calls.map(c => c[0])).toEqual(['fps', 'ui'])
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npm test`

- [ ] **Step 3: 구현**

`src/input/modes.ts`:
```ts
export type Mode = 'fps' | 'ui' | 'paused'

interface LockHooks { lock: () => void; unlock: () => void }

export class ModeManager {
  mode: Mode = 'ui'
  private before: Mode = 'ui'
  private cbs: Array<(m: Mode) => void> = []

  constructor(private hooks: LockHooks) {}

  onChange(cb: (m: Mode) => void): void { this.cbs.push(cb) }

  private set(m: Mode): void {
    if (this.mode === m) return
    this.mode = m
    for (const cb of this.cbs) cb(m)
  }

  toFPS(userGesture: boolean): boolean {
    if (!userGesture) return false
    this.hooks.lock()
    this.set('fps')
    return true
  }

  toUI(): void {
    if (this.mode === 'fps') this.hooks.unlock()
    this.set('ui')
  }

  pause(): void {
    if (this.mode === 'paused') return
    this.before = this.mode
    if (this.before === 'fps') this.hooks.unlock()
    this.set('paused')
  }

  resume(userGesture: boolean): boolean {
    if (this.mode !== 'paused') return false
    if (this.before === 'fps') {
      if (!userGesture) return false
      this.hooks.lock()
    }
    this.set(this.before)
    return true
  }
}
```

- [ ] **Step 4: 통과 확인** — Run: `npm test` → PASS

- [ ] **Step 5: Commit** — `git commit -am "feat: FPS/UI/일시정지 모드 상태머신"`

---

### Task 6: 포스트FX 단일 패스 + Codex 지시서 #1 (글리치 셰이더)

**Files:**
- Create: `src/render/postfx.ts`, `src/render/glitchShader.ts`, `docs/codex-tasks/01-glitch-shader.md`

**Interfaces:**
- Produces:
  - `interface FxLevels { vignette: number; grain: number; glitch: number; rgbShift: number }` (각 0~1)
  - `class PostFX { constructor(renderer, scene, camera); set(levels: Partial<FxLevels>): void; pulse(key: keyof FxLevels, peak: number, ms: number): void; setScene(scene, camera): void; render(dtMs: number): void }`
  - `GLITCH_SHADER` — `{ uniforms, vertexShader, fragmentShader }` (ShaderPass용). **uniform 계약(Codex에 위임되는 고정 인터페이스): `tDiffuse, uTime, uVignette, uGrain, uGlitch, uRgbShift`** — 이름·타입 변경 금지.

- [ ] **Step 1: 폴백 셰이더 + PostFX 구현** (셰이더 본체는 Codex 몫이지만, 게임이 항상 돌도록 단순 폴백을 먼저 넣는다)

`src/render/glitchShader.ts`:
```ts
// uniform 계약 고정 — 이름/타입 변경 금지 (docs/codex-tasks/01-glitch-shader.md)
export const GLITCH_SHADER = {
  uniforms: {
    tDiffuse: { value: null as unknown },
    uTime: { value: 0 },
    uVignette: { value: 0.25 },
    uGrain: { value: 0.08 },
    uGlitch: { value: 0.0 },
    uRgbShift: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  // 폴백: 비네트+그레인만. 본 구현은 Codex 작업 #1 결과로 교체.
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uVignette, uGrain, uGlitch, uRgbShift;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float d = distance(vUv, vec2(0.5));
      c *= 1.0 - uVignette * smoothstep(0.3, 0.8, d);
      c += (hash(vUv * uTime) - 0.5) * uGrain;
      c = mix(c, vec3(hash(vUv + uTime)), uGlitch * 0.5);
      gl_FragColor = vec4(c, 1.0);
    }
  `,
}
```

`src/render/postfx.ts`:
```ts
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { GLITCH_SHADER } from './glitchShader'

export interface FxLevels { vignette: number; grain: number; glitch: number; rgbShift: number }

const UNIFORM: Record<keyof FxLevels, string> = {
  vignette: 'uVignette', grain: 'uGrain', glitch: 'uGlitch', rgbShift: 'uRgbShift',
}

interface Pulse { key: keyof FxLevels; peak: number; ms: number; t: number; base: number }

export class PostFX {
  private composer: EffectComposer
  private renderPass: RenderPass
  private pass: ShaderPass
  private time = 0
  private pulses: Pulse[] = []

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer)
    this.renderPass = new RenderPass(scene, camera)
    this.pass = new ShaderPass(GLITCH_SHADER as never)
    this.composer.addPass(this.renderPass)
    this.composer.addPass(this.pass)
  }

  setScene(scene: THREE.Scene, camera: THREE.Camera): void {
    this.renderPass.scene = scene
    this.renderPass.camera = camera
  }

  set(levels: Partial<FxLevels>): void {
    for (const [k, v] of Object.entries(levels) as Array<[keyof FxLevels, number]>)
      this.pass.uniforms[UNIFORM[k]].value = v
  }

  get(key: keyof FxLevels): number {
    return this.pass.uniforms[UNIFORM[key]].value as number
  }

  pulse(key: keyof FxLevels, peak: number, ms: number): void {
    this.pulses.push({ key, peak, ms, t: 0, base: this.get(key) })
  }

  resize(w: number, h: number): void { this.composer.setSize(w, h) }

  render(dtMs: number): void {
    this.time += dtMs / 1000
    this.pass.uniforms.uTime.value = this.time
    this.pulses = this.pulses.filter(p => {
      p.t += dtMs
      const x = Math.min(1, p.t / p.ms)
      const v = p.base + (p.peak - p.base) * Math.sin(x * Math.PI) // 올라갔다 내려옴
      this.pass.uniforms[UNIFORM[p.key]].value = Math.max(p.base, v)
      return x < 1
    })
    this.composer.render()
  }
}
```

- [ ] **Step 2: Codex 지시서 작성**

`docs/codex-tasks/01-glitch-shader.md`:
```markdown
# Codex 작업 #1 — 글리치 프래그먼트 셰이더

## 맡기는 것
`src/render/glitchShader.ts`의 `fragmentShader` GLSL 문자열 **본체만** 교체 구현.
파일의 다른 부분(uniforms 정의, vertexShader, export 이름)은 절대 수정하지 말 것.

## 고정 인터페이스 (변경 금지)
- `sampler2D tDiffuse` — 렌더된 씬
- `float uTime` — 초 단위 경과 시간
- `float uVignette` (0~1) — 화면 가장자리 어두움 강도
- `float uGrain` (0~1) — 필름 그레인 강도
- `float uGlitch` (0~1) — 글리치 강도 (아래 상세)
- `float uRgbShift` (0~1) — RGB 채널 분리 강도 (0.02 UV 오프셋 상한)
- `varying vec2 vUv`

## uGlitch 동작 상세 (0→1로 갈수록)
1. 수평 스캔라인 블록이 무작위로 좌우로 찢어진다 (블록 높이 5~40px 상당, 개수는 강도 비례)
2. 화면 일부에 블록 노이즈(사각형 색면)가 깜빡인다
3. 0.7 이상에서는 프레임 전체가 간헐적으로 밝은 노이즈로 덮인다 (VHS 트래킹 실패 느낌)
4. uTime 기반 의사난수 사용 (hash/fract-sin). 텍스처 추가 금지, 외부 함수 추가 금지.

## 품질 기준
- WebGL1/WebGL2 겸용 GLSL (three ShaderPass 기본). 컴파일 오류 없이 동작.
- uGlitch=0, uRgbShift=0이면 비네트+그레인만 남고 원본 화면이 또렷해야 함.
- 분기 최소화, 루프 상한 고정 (모바일 아님, 내장 GPU 60fps 기준).

## 검증 방법
`npm run dev` → 브라우저 콘솔에서 `window.__fx.set({ glitch: 0.8, rgbShift: 0.5 })` 실행 시
화면이 위 설명대로 무너지는지 확인. (main.ts가 `window.__fx`를 노출함)
```

- [ ] **Step 3: 수동 확인** — Task 8 부트스트랩 후 `window.__fx`로 폴백 셰이더 동작 확인 (여기서는 컴파일만: `npm run build` 성공 확인)

- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: 단일 패스 포스트FX + Codex 셰이더 지시서"`

---

### Task 7: 오버레이 UI 헬퍼 + 출입증 잠식

**Files:**
- Create: `src/ui/overlay.ts`, Test: `tests/badge.test.ts`

**Interfaces:**
- Produces:
  - `badgeErodedLabel(aptitude: number, rand?: () => number): string` — 적합도에 비례해 "학부연구생" 글자가 "석사과정" 글자로 잠식된 문자열 (0~39: 0자, 40~59: 1자, 60~79: 2자, 80~100: 3자 치환; 치환 위치는 rand 주입으로 결정적 테스트)
  - `class Overlay { constructor(root: HTMLElement); showCard(text: string, ms: number): Promise<void>; showSubtitle(text: string, ms: number): Promise<void>; showChoices(prompt: string, options: { id: string; label: string }[]): Promise<string>; showBadge(state: GameState): Promise<void>; showGate(title: string, sub: string, buttonText: string): Promise<void>; clear(): void }`
  - 모든 표시 요소는 `#ui` 하위 DOM. 선택지·게이트만 `pointer-events: auto`.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/badge.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { badgeErodedLabel } from '../src/ui/overlay'

const firstSlot = () => 0 // 항상 첫 후보 위치를 고르는 결정적 rand

describe('badgeErodedLabel', () => {
  it('적합도 39 이하는 잠식 없음', () => {
    expect(badgeErodedLabel(30, firstSlot)).toBe('학부연구생')
  })
  it('적합도 구간별로 1/2/3자가 석사과정 글자로 바뀐다', () => {
    expect(badgeErodedLabel(45, firstSlot)).toBe('석부연구생')
    expect(badgeErodedLabel(65, firstSlot)).toBe('석사연구생')
    expect(badgeErodedLabel(85, firstSlot)).toBe('석사과구생')
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npm test`

- [ ] **Step 3: 구현**

`src/ui/overlay.ts` (로직 + DOM — DOM 부분은 테스트 제외):
```ts
import type { GameState } from '../core/state'
import { STR } from '../content/strings'

export function badgeErodedLabel(aptitude: number, rand: () => number = Math.random): string {
  const base = [...STR.badge.roleBase]     // 학부연구생 (5자)
  const target = [...STR.badge.roleTarget] // 석사과정 (4자)
  const n = aptitude >= 80 ? 3 : aptitude >= 60 ? 2 : aptitude >= 40 ? 1 : 0
  for (let i = 0; i < n; i++) {
    // 앞에서부터 순서대로 잠식하되, 시작 오프셋만 rand로 흔든다 (결정적 테스트 가능)
    const slot = i + Math.floor(rand() * (base.length - n))
    base[slot] = target[Math.min(slot, target.length - 1)]
  }
  return base.join('')
}

export class Overlay {
  constructor(private root: HTMLElement) {}

  clear(): void { this.root.replaceChildren() }

  private el(cls: string, html: string, interactive = false): HTMLDivElement {
    const d = document.createElement('div')
    d.className = cls + (interactive ? ' interactive' : '')
    d.innerHTML = html
    this.root.appendChild(d)
    return d
  }

  showCard(text: string, ms: number): Promise<void> {
    const d = this.el('card', `<p>${text}</p>`)
    d.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;background:#000;font-size:22px;letter-spacing:0.2em'
    return new Promise(res => setTimeout(() => { d.remove(); res() }, ms))
  }

  showSubtitle(text: string, ms: number): Promise<void> {
    const d = this.el('subtitle', text)
    d.style.cssText = 'position:absolute;left:0;right:0;bottom:12%;text-align:center;font-size:18px;text-shadow:0 0 6px #000'
    return new Promise(res => setTimeout(() => { d.remove(); res() }, ms))
  }

  showChoices(prompt: string, options: { id: string; label: string }[]): Promise<string> {
    const html = `<p>${prompt}</p>` + options.map(o =>
      `<button data-id="${o.id}" style="display:block;width:100%;margin:6px 0;padding:10px;background:#111;color:#ddd;border:1px solid #444;cursor:pointer;font-size:15px">${o.label}</button>`).join('')
    const d = this.el('choices', html, true)
    d.style.cssText = 'position:absolute;left:50%;bottom:10%;transform:translateX(-50%);width:min(420px,90vw);background:rgba(0,0,0,.85);padding:16px;border:1px solid #333'
    return new Promise(res => d.addEventListener('click', e => {
      const id = (e.target as HTMLElement).dataset?.id
      if (id) { d.remove(); res(id) }
    }))
  }

  showBadge(state: GameState): Promise<void> {
    const role = badgeErodedLabel(state.stats.aptitude)
    const d = this.el('badge',
      `<div style="border:1px solid #666;background:#f4f2ec;color:#222;width:240px;padding:18px;text-align:center">
         <div style="font-size:11px;color:#888">${STR.badge.affil}</div>
         <div style="height:80px;margin:10px auto;width:64px;background:#ccc"></div>
         <div style="font-size:18px;font-weight:bold">${STR.badge.name}</div>
         <div style="font-size:14px;letter-spacing:0.3em;margin-top:4px">${role}</div>
       </div><p style="text-align:center;font-size:12px;color:#888">클릭하여 닫기</p>`, true)
    d.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;background:rgba(0,0,0,.6)'
    return new Promise(res => d.addEventListener('click', () => { d.remove(); res() }))
  }

  showGate(title: string, sub: string, buttonText: string): Promise<void> {
    const d = this.el('gate',
      `<h1 style="font-size:34px;letter-spacing:0.5em;margin:0">${title}</h1>
       <p style="color:#777">${sub}</p>
       <button style="margin-top:24px;padding:12px 32px;background:#000;color:#ddd;border:1px solid #555;cursor:pointer;font-size:16px">${buttonText}</button>
       <p style="font-size:12px;color:#555;margin-top:18px">${STR.title.headphones}<br>${STR.title.controls}</p>`, true)
    d.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;place-content:center;text-align:center;background:#000'
    return new Promise(res => d.querySelector('button')!.addEventListener('click', () => { d.remove(); res() }))
  }
}
```

- [ ] **Step 4: 통과 확인** — Run: `npm test` → PASS

- [ ] **Step 5: Commit** — `git commit -am "feat: 오버레이 UI와 출입증 잠식"`

---

### Task 8: 부트스트랩 + 씬 매니저 + 글리치 전환 + 유실 카드

**Files:**
- Create: `src/scenes/sceneManager.ts`, Modify: `src/main.ts` (전면 교체)

**Interfaces:**
- Produces:
  - `interface SceneCtx { state: GameState; overlay: Overlay; fx: PostFX; modes: ModeManager; renderer: THREE.WebGLRenderer; advance(): void }`
  - `interface GameScene { scene: THREE.Scene; camera: THREE.PerspectiveCamera; enter(ctx: SceneCtx): Promise<void>; exit(): void; update(dtMs: number): void }`
  - `class SceneManager { register(phase: PhaseId, make: () => GameScene): void; start(): Promise<void>; goTo(phase: PhaseId): Promise<void> }` — 미등록 페이즈는 `STR.lost(phase)` 카드 2초 → 자동 다음 페이즈. 전환마다 글리치 램프(0→0.9→0) + 페이즈 경계 체크포인트 저장.
  - `main.ts`는 `window.__fx = fx` 노출 (Codex 셰이더 검증용).

- [ ] **Step 1: 구현**

`src/scenes/sceneManager.ts`:
```ts
import * as THREE from 'three'
import type { GameState, PhaseId } from '../core/state'
import { nextPhase } from '../core/phases'
import { saveCheckpoint } from '../core/checkpoint'
import { Overlay } from '../ui/overlay'
import { PostFX } from '../render/postfx'
import { ModeManager } from '../input/modes'
import { STR } from '../content/strings'

export interface SceneCtx {
  state: GameState
  overlay: Overlay
  fx: PostFX
  modes: ModeManager
  renderer: THREE.WebGLRenderer
  advance(): void
}

export interface GameScene {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  enter(ctx: SceneCtx): Promise<void>
  exit(): void
  update(dtMs: number): void
}

export class SceneManager {
  private makers = new Map<PhaseId, () => GameScene>()
  private current: GameScene | null = null
  private transitioning = false

  constructor(private ctx: Omit<SceneCtx, 'advance'>) {}

  register(phase: PhaseId, make: () => GameScene): void { this.makers.set(phase, make) }

  private fullCtx(): SceneCtx {
    return { ...this.ctx, advance: () => void this.advance() }
  }

  async start(): Promise<void> { await this.goTo(this.ctx.state.phase) }

  private async advance(): Promise<void> {
    const n = nextPhase(this.ctx.state.phase)
    if (n) await this.goTo(n)
  }

  async goTo(phase: PhaseId): Promise<void> {
    if (this.transitioning) return
    this.transitioning = true
    // 글리치 램프 인 (기록이 끊기는 순간)
    this.ctx.fx.pulse('glitch', 0.9, 700)
    this.ctx.fx.pulse('rgbShift', 0.6, 700)
    await new Promise(r => setTimeout(r, 700))

    this.current?.exit()
    this.ctx.state.phase = phase
    saveCheckpoint(this.ctx.state)

    const make = this.makers.get(phase)
    if (!make) {
      // 미구현 페이즈: 유실 카드 → 자동 다음
      this.transitioning = false
      await this.ctx.overlay.showCard(STR.lost(phase), 2000)
      const n = nextPhase(phase)
      if (n) await this.goTo(n)
      return
    }
    this.current = make()
    this.ctx.fx.setScene(this.current.scene, this.current.camera)
    this.transitioning = false
    await this.current.enter(this.fullCtx())
  }

  update(dtMs: number): void { this.current?.update(dtMs) }

  resize(w: number, h: number): void {
    if (!this.current) return
    this.current.camera.aspect = w / h
    this.current.camera.updateProjectionMatrix()
  }
}
```

`src/main.ts`:
```ts
import * as THREE from 'three'
import { createState } from './core/state'
import { loadCheckpoint } from './core/checkpoint'
import { ModeManager } from './input/modes'
import { PostFX } from './render/postfx'
import { Overlay } from './ui/overlay'
import { SceneManager } from './scenes/sceneManager'
import { makeTitle } from './scenes/title'
import { makeLab } from './scenes/lab'
import { makeEnding } from './scenes/ending'
import { STR } from './content/strings'

const app = document.getElementById('app')!
const uiRoot = document.getElementById('ui')!

// 모바일/터치 안내 (스펙 §11)
if (matchMedia('(pointer: coarse)').matches) {
  uiRoot.innerHTML = `<div style="display:grid;place-items:center;height:100%;text-align:center;background:#000">
    <p>이 기록은 데스크톱 + 키보드 + 헤드폰 환경에서만 복원됩니다.</p></div>`
  throw new Error('desktop only')
}

const renderer = new THREE.WebGLRenderer({ antialias: false })
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
renderer.setSize(innerWidth, innerHeight)
app.appendChild(renderer.domElement)

const boot = new THREE.Scene()
const bootCam = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 100)
const fx = new PostFX(renderer, boot, bootCam)
;(window as never as { __fx: PostFX }).__fx = fx // Codex 셰이더 검증용

const overlay = new Overlay(uiRoot)
const modes = new ModeManager({
  lock: () => renderer.domElement.requestPointerLock(),
  unlock: () => document.exitPointerLock(),
})

// 재접속 복원 (스펙 §11 체크포인트)
let state = createState()
const saved = loadCheckpoint()
if (saved && saved.phase !== 'title') {
  if (confirm(STR.title.resume)) state = saved
}

const scenes = new SceneManager({ state, overlay, fx, modes, renderer })
scenes.register('title', () => makeTitle())
scenes.register('cycle1', () => makeLab())
scenes.register('ending', () => makeEnding())
// opening / cycle2 / chase 는 이 슬라이스에서 미등록 → 유실 카드로 자동 통과

// Esc = 일시정지 (스펙 §11) — pointerlockchange 단일 진입점
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && modes.mode === 'fps') {
    modes.pause()
    overlay.showChoices(STR.pause.title, [{ id: 'resume', label: STR.pause.resume }])
      .then(() => modes.resume(true))
  }
})
document.addEventListener('keydown', e => { if (e.key === 'Tab') e.preventDefault() })
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight)
  fx.resize(innerWidth, innerHeight)
  scenes.resize(innerWidth, innerHeight)
})

let last = performance.now()
function loop(now: number): void {
  const dt = Math.min(50, now - last)
  last = now
  scenes.update(dt)
  fx.render(dt)
  requestAnimationFrame(loop)
}
scenes.start()
requestAnimationFrame(loop)
```

(이 시점에서 `makeTitle`/`makeLab`/`makeEnding`은 아직 없으므로 빌드가 깨진다 — Task 9~11에서 만든다. 커밋은 Task 9와 함께 진행.)

- [ ] **Step 2:** Task 9 완료 후 함께 커밋 (아래)

---

### Task 9: 타이틀 씬 (오디오 게이트 + 디제시스 프리로더)

**Files:**
- Create: `src/scenes/title.ts`

**Interfaces:**
- Consumes: `SceneCtx`, `Overlay.showGate`, `STR.title`
- Produces: `makeTitle(): GameScene` — 게이트 클릭 → `AudioContext.resume()`(전역 1회) → 복원 카운터 연출(스킵 가능) → `ctx.advance()`

- [ ] **Step 1: 구현**

`src/scenes/title.ts`:
```ts
import * as THREE from 'three'
import type { GameScene, SceneCtx } from './sceneManager'
import { STR } from '../content/strings'

export const audio = { ctx: null as AudioContext | null }

export function makeTitle(): GameScene {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000000)
  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 10)

  return {
    scene, camera,
    async enter(ctx: SceneCtx) {
      // 오디오 게이트 (자동재생 정책 — 스펙 §11). 클릭이 이후 PointerLock 제스처 체인의 시작.
      await ctx.overlay.showGate(STR.title.name, STR.title.sub, STR.title.gate)
      audio.ctx ??= new AudioContext()
      await audio.ctx.resume()

      // 디제시스 프리로더: 슬라이스에서는 로드할 대용량 에셋이 없으므로 짧은 연출로 대체.
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
```

- [ ] **Step 2: 커밋 전 빌드 확인** — `makeLab`/`makeEnding` 스텁을 임시로 만들지 말고, Task 10·11을 이어서 구현한 뒤 한 번에 확인한다. (중간 커밋이 필요하면 `main.ts`의 해당 register 줄을 잠시 주석 처리)

---

### Task 10: 연구실 씬 + 1인칭 컨트롤 + 미니게임 ① + 동료 대화

**Files:**
- Create: `src/input/controls.ts`, `src/scenes/lab.ts`, `src/ui/minigame1.ts`, Test: `tests/minigame1.test.ts`

**Interfaces:**
- Consumes: `SceneCtx`, `applyStat`, `addJournal`, `Overlay`, `ModeManager`
- Produces:
  - `class FPSControls { constructor(camera, dom); enabled: boolean; update(dtMs): void; dispose(): void }` — WASD 이동(2.2m/s), 마우스 시점(pointerlock 기준), 이동 범위는 AABB 클램프 `setBounds(min: THREE.Vector3, max: THREE.Vector3)`
  - `resolveDocChoice(choice: 'accurate' | 'mistake' | 'deleteRow', roll: number): { trust: number; aptitude: number; journal: 'cycle1_good' | 'cycle1_bad'; caught: boolean }` — 순수 함수 (roll < 0.3 = 들킴, 스펙 §6-1 수치)
  - `makeLab(): GameScene` — 상호작용 2개: 동료(자동 접근 대사 + 선택지), PC(미니게임 ①). 미니게임 완료 → 냉동고 리더기 연출(출입증 강제 노출) → `ctx.advance()`

- [ ] **Step 1: 미니게임 판정 테스트 작성**

`tests/minigame1.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { resolveDocChoice } from '../src/ui/minigame1'

describe('서류 미니게임 판정 (스펙 §6-1)', () => {
  it('정확히 입력: 신뢰+5 적합+15, good 일지', () => {
    expect(resolveDocChoice('accurate', 0.9)).toEqual(
      { trust: 5, aptitude: 15, journal: 'cycle1_good', caught: false })
  })
  it('사소한 실수: 신뢰-10 적합 0, bad 일지', () => {
    expect(resolveDocChoice('mistake', 0.9)).toEqual(
      { trust: -10, aptitude: 0, journal: 'cycle1_bad', caught: false })
  })
  it('행 삭제: 적합-10, 30% 미만 roll이면 들켜서 신뢰-15', () => {
    expect(resolveDocChoice('deleteRow', 0.29)).toEqual(
      { trust: -15, aptitude: -10, journal: 'cycle1_bad', caught: true })
    expect(resolveDocChoice('deleteRow', 0.31)).toEqual(
      { trust: 0, aptitude: -10, journal: 'cycle1_bad', caught: false })
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npm test`

- [ ] **Step 3: 미니게임 구현**

`src/ui/minigame1.ts`:
```ts
import type { GameState } from '../core/state'
import { applyStat } from '../core/state'
import { addJournal } from '../core/journal'
import { Overlay } from './overlay'
import { STR } from '../content/strings'

export type DocChoice = 'accurate' | 'mistake' | 'deleteRow'

export function resolveDocChoice(choice: DocChoice, roll: number) {
  if (choice === 'accurate')
    return { trust: 5, aptitude: 15, journal: 'cycle1_good' as const, caught: false }
  if (choice === 'mistake')
    return { trust: -10, aptitude: 0, journal: 'cycle1_bad' as const, caught: false }
  const caught = roll < 0.3
  return { trust: caught ? -15 : 0, aptitude: -10, journal: 'cycle1_bad' as const, caught }
}

// 가짜 스프레드시트 DOM. 행을 차례로 표시하다 발견 1(전원 대학원 진학) → 발견 2(본인 행) → 선택지.
export async function runDocMinigame(
  state: GameState, overlay: Overlay, rand: () => number = Math.random,
): Promise<void> {
  const rows = [
    ['2019 · 김▓▓', STR.doc.allGrad], ['2020 · 이▓▓', STR.doc.allGrad],
    ['2021 · 박▓▓', STR.doc.allGrad], ['2022 · 최▓▓', STR.doc.allGrad],
    ['2023 · 정▓▓', STR.doc.allGrad],
  ]
  const sheet = document.createElement('div')
  sheet.className = 'interactive'
  sheet.style.cssText = 'position:absolute;inset:8%;background:#e8e6df;color:#222;padding:24px;font-size:14px;overflow:auto;border:2px solid #999'
  sheet.innerHTML = `<h3>${STR.doc.taskTitle}</h3><table style="width:100%;border-collapse:collapse"></table>`
  document.getElementById('ui')!.appendChild(sheet)
  const table = sheet.querySelector('table')!

  for (const [name, path] of rows) {
    await new Promise(r => setTimeout(r, 450))
    table.insertAdjacentHTML('beforeend',
      `<tr><td style="border:1px solid #bbb;padding:6px">${name}</td>
           <td style="border:1px solid #bbb;padding:6px">${path}</td></tr>`)
  }
  await new Promise(r => setTimeout(r, 900))
  // 발견 2: 본인 행이 스스로 나타난다
  table.insertAdjacentHTML('beforeend',
    `<tr style="background:#f7d9d9"><td style="border:1px solid #bbb;padding:6px">${STR.badge.name}</td>
         <td style="border:1px solid #bbb;padding:6px">${STR.doc.selfRow}</td></tr>`)

  const choice = await overlay.showChoices('…어떻게 할까.', [
    { id: 'accurate', label: STR.doc.choices.accurate },
    { id: 'mistake', label: STR.doc.choices.mistake },
    { id: 'deleteRow', label: STR.doc.choices.deleteRow },
  ]) as DocChoice

  const r = resolveDocChoice(choice, rand())
  applyStat(state, 'trust', r.trust)
  applyStat(state, 'aptitude', r.aptitude)
  addJournal(state, r.journal)
  state.flags.docChoice_ = true
  state.flags[`doc_${choice}`] = true
  sheet.remove()

  if (r.caught) await overlay.showSubtitle(STR.doc.caught, 1800)
  if (choice === 'accurate') await overlay.showSubtitle(STR.colleague.likeYou, 1800) // 즉시 반응 비트 (스펙 §6-1)
}
```

- [ ] **Step 4: 판정 테스트 통과 확인** — Run: `npm test` → PASS

- [ ] **Step 5: 1인칭 컨트롤 구현**

`src/input/controls.ts`:
```ts
import * as THREE from 'three'

export class FPSControls {
  enabled = false
  private yaw = 0
  private pitch = 0
  private keys = new Set<string>()
  private min = new THREE.Vector3(-Infinity, 0, -Infinity)
  private max = new THREE.Vector3(Infinity, 0, Infinity)
  private onMouse = (e: MouseEvent) => {
    if (!this.enabled) return
    this.yaw -= e.movementX * 0.0022
    this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch - e.movementY * 0.0022))
  }
  private onKey = (e: KeyboardEvent) => {
    if (e.type === 'keydown') this.keys.add(e.code); else this.keys.delete(e.code)
  }

  constructor(private camera: THREE.PerspectiveCamera) {
    document.addEventListener('mousemove', this.onMouse)
    document.addEventListener('keydown', this.onKey)
    document.addEventListener('keyup', this.onKey)
  }

  setBounds(min: THREE.Vector3, max: THREE.Vector3): void { this.min = min; this.max = max }

  update(dtMs: number): void {
    if (!this.enabled) return
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ')
    const speed = 2.2 * (dtMs / 1000)
    const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
    const r = new THREE.Vector3(f.z, 0, -f.x)
    const p = this.camera.position
    if (this.keys.has('KeyW')) p.addScaledVector(f, speed)
    if (this.keys.has('KeyS')) p.addScaledVector(f, -speed)
    if (this.keys.has('KeyD')) p.addScaledVector(r, -speed)
    if (this.keys.has('KeyA')) p.addScaledVector(r, speed)
    p.clamp(this.min, this.max)
  }

  dispose(): void {
    document.removeEventListener('mousemove', this.onMouse)
    document.removeEventListener('keydown', this.onKey)
    document.removeEventListener('keyup', this.onKey)
  }
}
```

- [ ] **Step 6: 연구실 씬 구현**

`src/scenes/lab.ts` — 라이팅 정책(스펙 §11): 그림자 없음, Hemisphere + 형광등 emissive + 포인트 2개.
```ts
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
  body: new THREE.MeshLambertMaterial({ color: 0x556 }),  // 동료 실루엣
}

function box(w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
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
    scene.add(box(0.6, 0.4, 0.06, x === -2.5 && z === -3 ? M.screen : M.dark, x, 1.05, z - 0.2))
  }
  scene.add(pc)
  // 냉동고 (사이클 종료 리더기)
  const freezer = box(1, 2, 0.8, M.dark, 3.4, 1, 4.2)
  scene.add(freezer)
  // 동료 실루엣 2 (캡슐 근사: 박스)
  const colleague = box(0.45, 1.7, 0.3, M.body, 2.5, 0.85, -0.4)
  scene.add(colleague)
  scene.add(box(0.45, 1.7, 0.3, M.body, -2.5, 0.85, 0.4))

  scene.add(new THREE.HemisphereLight(0xffffff, 0x777788, 1.1))
  const p1 = new THREE.PointLight(0xfff4e0, 12, 12); p1.position.set(0, 2.7, -2); scene.add(p1)
  const p2 = new THREE.PointLight(0xfff4e0, 12, 12); p2.position.set(0, 2.7, 2); scene.add(p2)

  const controls = new FPSControls(camera)
  controls.setBounds(new THREE.Vector3(-3.5, 1.6, -4.5), new THREE.Vector3(3.5, 1.6, 4.5))
  const ray = new THREE.Raycaster()
  let ctx!: SceneCtx
  let step: 'colleague' | 'pc' | 'reader' | 'done' = 'colleague'

  async function interact(target: THREE.Object3D | null): Promise<void> {
    ctx.modes.toUI()
    if (step === 'colleague' && target === colleague) {
      const pick = await ctx.overlay.showChoices(STR.colleague.approach[0], [
        { id: 'good', label: STR.colleague.choiceGood },
        { id: 'meh', label: STR.colleague.choiceMeh },
      ])
      if (pick === 'good') applyStat(ctx.state, 'aptitude', 5) // 호의적 응답 (스펙 §7)
      step = 'pc'
      await ctx.overlay.showSubtitle('PC 앞에 앉아 업무를 시작하자. (모니터에 E)', 2200)
    } else if (step === 'pc' && target === pc) {
      await runDocMinigame(ctx.state, ctx.overlay)
      step = 'reader'
      await ctx.overlay.showSubtitle('냉동고 리더기가 출입증을 요구한다. (냉동고에 E)', 2200)
    } else if (step === 'reader' && target === freezer) {
      await ctx.overlay.showBadge(ctx.state) // 출입증 강제 노출 (스펙 §3)
      ctx.fx.pulse('glitch', 0.4, 300)
      step = 'done'
      ctx.advance()
      return
    }
    ctx.modes.toFPS(true) // showChoices/카드 클릭이 제스처
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'KeyE' && ctx.modes.mode === 'fps') {
      ray.setFromCamera(new THREE.Vector2(0, 0), camera)
      const hit = ray.intersectObjects([colleague, pc, freezer], false)[0]
      if (hit && hit.distance < 2.2) void interact(hit.object)
    }
    if (e.code === 'Tab' && ctx.modes.mode === 'fps') {
      ctx.modes.toUI()
      void ctx.overlay.showBadge(ctx.state).then(() => ctx.modes.toFPS(true))
    }
  }

  return {
    scene, camera,
    async enter(c: SceneCtx) {
      ctx = c
      document.addEventListener('keydown', onKey)
      await ctx.overlay.showCard('??:??', 1200)
      ctx.modes.onChange(m => { controls.enabled = m === 'fps' })
      await ctx.overlay.showSubtitle('동료가 말을 걸어온다. (동료에게 다가가 E)', 2600)
      ctx.modes.toFPS(true) // 직전 카드 표시가 클릭 게이트에서 이어진 제스처 체인
    },
    exit() {
      document.removeEventListener('keydown', onKey)
      controls.dispose()
    },
    update(dt) { controls.update(dt) },
  }
}
```

- [ ] **Step 7: 수동 확인** — `npm run dev`: 타이틀 게이트 → 연구실 → 동료 대화 → 미니게임 → 출입증 → 유실 카드 2장(cycle2/chase) → (엔딩은 Task 11 후). Tab 출입증, Esc 일시정지 동작 확인.

- [ ] **Step 8: Commit** — `git add -A && git commit -m "feat: 연구실 씬, 1인칭 컨트롤, 서류 미니게임, 동료 대화"`

---

### Task 11: 엔딩 시네마틱 축약판

**Files:**
- Create: `src/scenes/ending.ts`

**Interfaces:**
- Consumes: `SceneCtx`, `state.journal`, `badgeErodedLabel`, `STR.ending`
- Produces: `makeEnding(): GameScene` — 스펙 §9 시퀀스 축약: 일지 몽타주 → 면담 자막(대답은 치지직) → 기록 끊김 → 정적 → 엔딩 카드 → 포스트크레딧 → 크레딧 → 타이틀 복귀(체크포인트 클리어)

- [ ] **Step 1: 구현**

`src/scenes/ending.ts`:
```ts
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
    scene, camera,
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

      // 7. 크레딧 → 타이틀 복귀
      await o.showCard(STR.ending.creditsNote, 2200)
      clearCheckpoint()
      location.reload()
    },
    exit() {},
    update() {},
  }
}
```

- [ ] **Step 2: 관통 플레이 확인** — `npm run dev`: 타이틀부터 엔딩 카드·포스트크레딧·타이틀 복귀까지 전 구간 통과. F5 후 "이어서 복원" 동작 확인.

- [ ] **Step 3: 테스트·빌드 최종 확인** — Run: `npm test && npm run build` → 전부 PASS

- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: 엔딩 시네마틱 축약판 — 관통 슬라이스 완성"`

---

### Task 12: 배포 + Codex 작업 #1 실행 준비

**Files:**
- Modify: `docs/codex-log.md`

- [ ] **Step 1: GitHub 저장소 생성·푸시** — `gh repo create` (public) 후 push. 저장소 Settings → Pages → Source를 "GitHub Actions"로 설정.

```bash
gh repo create masters-demo --public --source . --push
```

- [ ] **Step 2: 배포 확인** — Actions 완료 후 `https://<user>.github.io/masters-demo/` 접속, 관통 플레이 1회.

- [ ] **Step 3: Codex 작업 #1 실행** — 사용자가 Codex CLI로 `docs/codex-tasks/01-glitch-shader.md`를 지시서로 셰이더 본체를 구현하게 한다 (또는 codex 플러그인 경유). 결과를 `docs/codex-log.md`에 기록하고 `window.__fx.set({ glitch: 0.8 })`로 검증.

- [ ] **Step 4: Commit** — `git add -A && git commit -m "chore: 배포 및 Codex 셰이더 작업 로그"`

---

## Self-Review 결과

- **스펙 커버리지**: 계획 1은 스펙 §11 컷 라인 1단계(관통 슬라이스)를 구현. 오프닝·사이클②·추격전·실제 오디오·파편 플래시·한글 폰트 서브셋은 계획 2로 명시 이월 (유실 카드로 대체되어 플레이는 항상 관통 가능).
- **플레이스홀더**: 없음 — 모든 코드 블록 실제 내용 포함. 폴백 셰이더는 의도된 임시 구현(Codex 계약의 일부)으로 지시서에 명시.
- **타입 일관성**: `GameScene`/`SceneCtx`/`FxLevels`/`StatKey`/`JournalTrigger` 전 태스크 교차 확인 완료.
