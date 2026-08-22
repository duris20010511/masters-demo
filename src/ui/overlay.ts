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

  clear(): void {
    this.root.replaceChildren()
  }

  private el(cls: string, html: string, interactive = false): HTMLDivElement {
    const d = document.createElement('div')
    d.className = cls + (interactive ? ' interactive' : '')
    d.innerHTML = html
    this.root.appendChild(d)
    return d
  }

  showCard(text: string, ms: number): Promise<void> {
    const d = this.el('card', `<p>${text}</p>`)
    d.style.cssText =
      'position:absolute;inset:0;display:grid;place-items:center;background:#000;font-size:22px;letter-spacing:0.2em'
    return new Promise(res => setTimeout(() => { d.remove(); res() }, ms))
  }

  private subtitleCount = 0

  showSubtitle(text: string, ms: number): Promise<void> {
    const d = this.el('subtitle', text)
    // 자막이 겹치면 위로 쌓는다
    const offset = 12 + this.subtitleCount * 7
    this.subtitleCount++
    d.style.cssText =
      `position:absolute;left:0;right:0;bottom:${offset}%;text-align:center;font-size:18px;text-shadow:0 0 6px #000`
    return new Promise(res =>
      setTimeout(() => { d.remove(); this.subtitleCount = Math.max(0, this.subtitleCount - 1); res() }, ms),
    )
  }

  showChoices(prompt: string, options: { id: string; label: string }[]): Promise<string> {
    const html =
      `<p>${prompt}</p>` +
      options
        .map(
          o =>
            `<button data-id="${o.id}" style="display:block;width:100%;margin:6px 0;padding:10px;background:#111;color:#ddd;border:1px solid #444;cursor:pointer;font-size:15px;font-family:inherit">${o.label}</button>`,
        )
        .join('')
    const d = this.el('choices', html, true)
    d.style.cssText =
      'position:absolute;left:50%;bottom:10%;transform:translateX(-50%);width:min(420px,90vw);background:rgba(0,0,0,.85);padding:16px;border:1px solid #333'
    return new Promise(res =>
      d.addEventListener('click', e => {
        const id = (e.target as HTMLElement).dataset?.id
        if (id) { d.remove(); res(id) }
      }),
    )
  }

  showBadge(state: GameState): Promise<void> {
    const role = badgeErodedLabel(state.stats.aptitude)
    const d = this.el(
      'badge',
      `<div style="border:1px solid #666;background:#f4f2ec;color:#222;width:240px;padding:18px;text-align:center">
         <div style="font-size:11px;color:#888">${STR.badge.affil}</div>
         <div style="height:80px;margin:10px auto;width:64px;background:#ccc"></div>
         <div style="font-size:18px;font-weight:bold">${STR.badge.name}</div>
         <div style="font-size:14px;letter-spacing:0.3em;margin-top:4px">${role}</div>
       </div><p style="text-align:center;font-size:12px;color:#888">클릭하여 닫기</p>`,
      true,
    )
    d.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;background:rgba(0,0,0,.6)'
    return new Promise(res => d.addEventListener('click', () => { d.remove(); res() }))
  }

  private crosshairEl: HTMLDivElement | null = null

  setCrosshair(state: 'off' | 'idle' | 'target'): void {
    if (state === 'off') {
      this.crosshairEl?.remove()
      this.crosshairEl = null
      return
    }
    if (!this.crosshairEl) {
      this.crosshairEl = document.createElement('div')
      this.root.appendChild(this.crosshairEl)
    }
    const active = state === 'target'
    this.crosshairEl.textContent = active ? 'E' : ''
    this.crosshairEl.style.cssText =
      `position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);` +
      (active
        ? 'width:22px;height:22px;border:1px solid #fff;border-radius:50%;display:grid;place-items:center;font-size:11px;color:#fff;background:rgba(0,0,0,.35)'
        : 'width:4px;height:4px;border-radius:50%;background:rgba(255,255,255,.55)')
  }

  showClickToContinue(): Promise<void> {
    const d = this.el('continue', `<p style="letter-spacing:0.3em;color:#aaa">클릭하여 계속 ▶</p>`, true)
    d.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;cursor:pointer'
    return new Promise(res => d.addEventListener('click', () => { d.remove(); res() }, { once: true }))
  }

  showGate(title: string, sub: string, buttonText: string): Promise<void> {
    const d = this.el(
      'gate',
      `<h1 style="font-size:34px;letter-spacing:0.5em;margin:0">${title}</h1>
       <p style="color:#777">${sub}</p>
       <button style="margin-top:24px;padding:12px 32px;background:#000;color:#ddd;border:1px solid #555;cursor:pointer;font-size:16px;font-family:inherit">${buttonText}</button>
       <p style="font-size:12px;color:#555;margin-top:18px">${STR.title.headphones}<br>${STR.title.controls}</p>`,
      true,
    )
    d.style.cssText =
      'position:absolute;inset:0;display:grid;place-items:center;place-content:center;text-align:center;background:#000'
    return new Promise(res => d.querySelector('button')!.addEventListener('click', () => { d.remove(); res() }))
  }
}
