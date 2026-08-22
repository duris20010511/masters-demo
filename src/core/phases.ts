import type { PhaseId } from './state'

export const PHASE_ORDER: PhaseId[] = ['title', 'opening', 'cycle1', 'cycle2', 'chase', 'ending']

export function nextPhase(p: PhaseId): PhaseId | null {
  const i = PHASE_ORDER.indexOf(p)
  return i >= 0 && i < PHASE_ORDER.length - 1 ? PHASE_ORDER[i + 1] : null
}
