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
