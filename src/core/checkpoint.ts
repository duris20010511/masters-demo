import type { GameState } from './state'

const KEY = 'masters-demo/checkpoint/v1'

export function saveCheckpoint(s: GameState): void {
  sessionStorage.setItem(KEY, JSON.stringify(s))
}

export function loadCheckpoint(): GameState | null {
  const raw = sessionStorage.getItem(KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as GameState
  } catch {
    return null
  }
}

export function clearCheckpoint(): void {
  sessionStorage.removeItem(KEY)
}
