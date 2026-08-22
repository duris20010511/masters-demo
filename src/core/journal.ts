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
