import type { GameState } from '../core/state'
import { applyStat } from '../core/state'
import { addJournal } from '../core/journal'
import { STR } from '../content/strings'
import { Overlay } from './overlay'

type SampleAction = 'keep' | 'discard'

type Sample = {
  description: string
  instruction: SampleAction
  tooth?: boolean
}

const SAMPLES: Sample[] = [
  { description: '조직 샘플 03 — 정상', instruction: 'keep' },
  { description: '배양 실패 07 — 폐기 대상', instruction: 'discard' },
  { description: '혈청 분획 09 — 저온 보관', instruction: 'keep' },
  { description: '조직 샘플 12 — 검은 점', instruction: 'keep', tooth: true },
  { description: '배양 실패 14 — 오염 확인', instruction: 'discard' },
  { description: '조직 샘플 18 — 정상', instruction: 'keep' },
]

export function resolveSampleGame(errors: number): {
  trust: number
  aptitude: number
  journal: 'cycle2_good' | 'cycle2_bad'
} {
  if (errors <= 1) return { trust: 5, aptitude: 15, journal: 'cycle2_good' }
  if (errors <= 3) return { trust: 0, aptitude: 0, journal: 'cycle2_bad' }
  return { trust: -15, aptitude: 0, journal: 'cycle2_bad' }
}

export function runSampleMinigame(
  state: GameState,
  overlay: Overlay,
  rand: () => number = Math.random,
): Promise<void> {
  // 주의: 반드시 미니게임이 실제로 끝난 뒤 resolve되어야 한다 (호출측이 다음 페이즈로 진행)
  return new Promise(resolvePromise => {
  const panel = document.createElement('div')
  panel.className = 'interactive'
  panel.style.cssText =
    'position:absolute;left:50%;top:6%;transform:translateX(-50%);width:min(560px,82vw);max-height:76vh;background:rgba(43,46,51,0.96);color:#e4e7e9;padding:20px;overflow:auto;border:2px solid #626870;box-shadow:inset 0 0 42px #111, 0 12px 40px rgba(0,0,0,.6);font-size:14px'
  document.getElementById('ui')!.appendChild(panel)

  const resolved = new Map<number, SampleAction>()
  let selected: number | null = null
  let toothInspected = false

  const finish = async (): Promise<void> => {
    const errors = SAMPLES.reduce((total, sample, index) => total + (resolved.get(index) === sample.instruction ? 0 : 1), 0)
    const result = resolveSampleGame(errors)
    applyStat(state, 'trust', result.trust)
    applyStat(state, 'aptitude', result.aptitude)
    addJournal(state, result.journal)
    panel.remove()

    await overlay.showSubtitle(STR.sample.wasteSubtitle, 1800)
    const wasteChoice = await overlay.showChoices('', [
      { id: 'listen', label: STR.sample.listen },
      { id: 'seal', label: STR.sample.seal },
    ])
    if (wasteChoice === 'listen') {
      applyStat(state, 'sanity', -10)
      state.flags.heardVoice = true
      await overlay.showSubtitle(STR.sample.voice, 1800)
    } else {
      await overlay.showSubtitle(STR.sample.sealed, 1800)
    }

    const recordChoice = await overlay.showChoices('', [
      { id: 'search', label: STR.sample.search },
      { id: 'quit', label: STR.sample.quit },
    ])
    if (recordChoice === 'search') {
      state.flags.searchedRecords = true
      await overlay.showSubtitle(STR.sample.record, 2200)
      if (rand() < 0.3) {
        applyStat(state, 'trust', -10)
        await overlay.showSubtitle(STR.sample.caught, 1800)
      }
    }
    resolvePromise()
  }

  const render = (): void => {
    const tubes = SAMPLES.map((sample, index) => {
      const complete = resolved.has(index)
      const isSelected = selected === index
      const status = complete ? '판정 완료' : isSelected ? '분류 선택 중' : ''
      return `<button data-tube="${index}" ${complete ? 'disabled' : ''} style="display:block;width:100%;text-align:left;margin:8px 0;padding:12px;background:${complete ? '#3b4650' : isSelected ? '#48535f' : '#202328'};color:#e4e7e9;border:1px solid #70777f;cursor:${complete ? 'default' : 'pointer'};font:inherit">
        <strong>튜브 ${String(index + 1).padStart(2, '0')}</strong> · 지시: ${sample.instruction === 'keep' ? STR.sample.keep : STR.sample.discard}<br>
        <span style="color:#b9c1c8">${sample.description}</span>${status ? `<span style="float:right;color:#a8d4ae">${status}</span>` : ''}
      </button>`
    }).join('')
    const sample = selected === null ? null : SAMPLES[selected]
    const actions = sample
      ? `<div style="margin-top:16px;border-top:1px solid #626870;padding-top:14px">
          <button data-action="keep" style="margin-right:8px;padding:9px 20px;background:#35483a;color:#eef6ee;border:1px solid #829b85;font:inherit;cursor:pointer">${STR.sample.keep}</button>
          <button data-action="discard" style="padding:9px 20px;background:#513b3b;color:#f6eeee;border:1px solid #aa8585;font:inherit;cursor:pointer">${STR.sample.discard}</button>
          ${sample.tooth ? `<button data-inspect="true" ${toothInspected ? 'disabled' : ''} style="float:right;padding:9px 14px;background:#333;color:#ddd;border:1px solid #777;font:inherit;cursor:pointer">${toothInspected ? STR.sample.toothDetail : STR.sample.inspect}</button>` : ''}
        </div>`
      : ''
    panel.innerHTML = `<h3 style="margin-top:0;letter-spacing:.12em">${STR.sample.title}</h3><p style="color:#aeb6bd">${STR.sample.instruction}</p>${tubes}${actions}`
  }

  panel.addEventListener('click', event => {
    const target = event.target as HTMLElement
    const tube = target.closest<HTMLElement>('[data-tube]')
    if (tube) {
      selected = Number(tube.dataset.tube)
      render()
      return
    }
    if (target.dataset.inspect && !toothInspected) {
      toothInspected = true
      applyStat(state, 'sanity', -10)
      render()
      return
    }
    const action = target.dataset.action as SampleAction | undefined
    if (!action || selected === null) return
    resolved.set(selected, action)
    selected = null
    render()
    if (resolved.size === SAMPLES.length) void finish()
  })

  render()
  })
}
