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
  state: GameState,
  overlay: Overlay,
  rand: () => number = Math.random,
): Promise<void> {
  const rows = [
    ['2019 · 김▓▓', STR.doc.allGrad],
    ['2020 · 이▓▓', STR.doc.allGrad],
    ['2021 · 박▓▓', STR.doc.allGrad],
    ['2022 · 최▓▓', STR.doc.allGrad],
    ['2023 · 정▓▓', STR.doc.allGrad],
  ]
  const sheet = document.createElement('div')
  sheet.className = 'interactive'
  sheet.style.cssText =
    'position:absolute;left:50%;top:6%;transform:translateX(-50%);width:min(560px,82vw);max-height:76vh;background:#e8e6df;color:#222;padding:20px;font-size:14px;overflow:auto;border:2px solid #999;box-shadow:0 12px 40px rgba(0,0,0,.5)'
  sheet.innerHTML = `<h3>${STR.doc.taskTitle}</h3><table style="width:100%;border-collapse:collapse"></table>`
  document.getElementById('ui')!.appendChild(sheet)
  const table = sheet.querySelector('table')!

  for (const [name, path] of rows) {
    await new Promise(r => setTimeout(r, 450))
    table.insertAdjacentHTML(
      'beforeend',
      `<tr><td style="border:1px solid #bbb;padding:6px">${name}</td>
           <td style="border:1px solid #bbb;padding:6px">${path}</td></tr>`,
    )
  }
  await new Promise(r => setTimeout(r, 900))
  // 발견 2: 본인 행이 스스로 나타난다
  table.insertAdjacentHTML(
    'beforeend',
    `<tr style="background:#f7d9d9"><td style="border:1px solid #bbb;padding:6px">${STR.badge.name}</td>
         <td style="border:1px solid #bbb;padding:6px">${STR.doc.selfRow}</td></tr>`,
  )

  const choice = (await overlay.showChoices('…어떻게 할까.', [
    { id: 'accurate', label: STR.doc.choices.accurate },
    { id: 'mistake', label: STR.doc.choices.mistake },
    { id: 'deleteRow', label: STR.doc.choices.deleteRow },
  ])) as DocChoice

  const r = resolveDocChoice(choice, rand())
  applyStat(state, 'trust', r.trust)
  applyStat(state, 'aptitude', r.aptitude)
  addJournal(state, r.journal)
  state.flags[`doc_${choice}`] = true
  sheet.remove()

  if (r.caught) await overlay.showSubtitle(STR.doc.caught, 1800)
  if (choice === 'accurate') await overlay.showSubtitle(STR.colleague.likeYou, 1800) // 즉시 반응 비트 (스펙 §6-1)
}
