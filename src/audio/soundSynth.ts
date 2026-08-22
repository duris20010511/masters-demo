export type OneShot = 'footstep' | 'glitch' | 'beep_error' | 'beep_ok' | 'knock' | 'whisper'
export type Loop = 'hum' | 'heartbeat'

type LoopHandle = {
  sources: AudioScheduledSourceNode[]
  nodes: AudioNode[]
  timer: ReturnType<typeof setTimeout> | null
  volume: number
}

export class SoundSynth {
  private readonly noiseBuffer: AudioBuffer
  private readonly loops = new Map<Loop, LoopHandle>()
  private readonly activeSources = new Set<AudioScheduledSourceNode>()
  private readonly activeNodes = new Set<AudioNode>()
  private heartRate = 0
  private disposed = false

  constructor(private readonly ctx: AudioContext) {
    const length = Math.max(1, Math.floor(ctx.sampleRate * 2))
    this.noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const samples = this.noiseBuffer.getChannelData(0)
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1
  }

  start(name: Loop, volume = 0.3): void {
    if (this.disposed || this.loops.has(name)) return
    const handle: LoopHandle = { sources: [], nodes: [], timer: null, volume: this.volume(volume) }
    this.loops.set(name, handle)
    if (name === 'hum') this.startHum(handle)
    else this.scheduleHeartbeat(handle)
  }

  stop(name: Loop): void {
    const handle = this.loops.get(name)
    if (!handle) return
    if (handle.timer !== null) clearTimeout(handle.timer)
    for (const source of handle.sources) this.stopSource(source)
    for (const node of handle.nodes) this.disconnect(node)
    this.loops.delete(name)
  }

  play(name: OneShot, volume = 0.5): void {
    if (this.disposed) return
    const level = this.volume(volume)
    if (name === 'footstep') this.playFootstep(level)
    else if (name === 'glitch') this.playGlitch(level)
    else if (name === 'beep_error') this.playErrorBeep(level)
    else if (name === 'beep_ok') this.playOkBeep(level)
    else if (name === 'knock') this.playKnock(level)
    else this.playWhisper(level)
  }

  setHeartRate(v: number): void {
    this.heartRate = Math.min(1, Math.max(0, v))
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const name of [...this.loops.keys()]) this.stop(name)
    for (const source of [...this.activeSources]) this.stopSource(source)
    for (const node of [...this.activeNodes]) this.disconnect(node)
    this.activeSources.clear()
    this.activeNodes.clear()
  }

  private startHum(handle: LoopHandle): void {
    const now = this.ctx.currentTime
    const hum = this.ctx.createOscillator()
    const humGain = this.ctx.createGain()
    const noise = this.noiseSource()
    const filter = this.ctx.createBiquadFilter()
    const noiseGain = this.ctx.createGain()
    const lfo = this.ctx.createOscillator()
    const lfoGain = this.ctx.createGain()

    hum.type = 'sine'
    hum.frequency.value = 60
    humGain.gain.value = handle.volume * 0.65
    noise.loop = true
    filter.type = 'lowpass'
    filter.frequency.value = 350
    noiseGain.gain.value = handle.volume * 0.04
    lfo.type = 'sine'
    lfo.frequency.value = 0.17
    lfoGain.gain.value = handle.volume * 0.08

    hum.connect(humGain).connect(this.ctx.destination)
    noise.connect(filter).connect(noiseGain).connect(this.ctx.destination)
    lfo.connect(lfoGain).connect(humGain.gain)
    this.trackLoop(handle, hum, humGain)
    this.trackLoop(handle, noise, filter, noiseGain)
    this.trackLoop(handle, lfo, lfoGain)
    hum.start(now)
    noise.start(now)
    lfo.start(now)
  }

  private scheduleHeartbeat(handle: LoopHandle): void {
    if (this.disposed || this.loops.get('heartbeat') !== handle) return
    const now = this.ctx.currentTime
    this.playHeartbeatBeat(handle, now, 1)
    this.playHeartbeatBeat(handle, now + 0.18, 0.72)
    const bpm = 50 + this.heartRate * 90
    handle.timer = setTimeout(() => this.scheduleHeartbeat(handle), 60000 / bpm)
  }

  private playHeartbeatBeat(handle: LoopHandle, at: number, accent: number): void {
    const oscillator = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(55, at)
    oscillator.frequency.exponentialRampToValueAtTime(42, at + 0.12)
    gain.gain.setValueAtTime(Math.max(0.0001, handle.volume * accent), at)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.14)
    oscillator.connect(gain).connect(this.ctx.destination)
    this.trackLoop(handle, oscillator, gain)
    oscillator.start(at)
    oscillator.stop(at + 0.15)
  }

  private playFootstep(level: number): void {
    const now = this.ctx.currentTime
    const source = this.noiseSource()
    const filter = this.ctx.createBiquadFilter()
    const gain = this.ctx.createGain()
    filter.type = 'lowpass'
    filter.frequency.value = 250
    gain.gain.setValueAtTime(Math.max(0.0001, level), now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08)
    source.connect(filter).connect(gain).connect(this.ctx.destination)
    this.trackOneShot(source, filter, gain)
    source.start(now)
    source.stop(now + 0.08)
  }

  private playGlitch(level: number): void {
    const now = this.ctx.currentTime
    const noise = this.noiseSource()
    const filter = this.ctx.createBiquadFilter()
    const noiseGain = this.ctx.createGain()
    const oscillator = this.ctx.createOscillator()
    const toneGain = this.ctx.createGain()
    filter.type = 'highpass'
    filter.frequency.value = 1800
    noiseGain.gain.setValueAtTime(Math.max(0.0001, level * 0.55), now)
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
    oscillator.type = 'square'
    oscillator.frequency.setValueAtTime(2100, now)
    oscillator.frequency.exponentialRampToValueAtTime(180, now + 0.12)
    toneGain.gain.setValueAtTime(Math.max(0.0001, level * 0.3), now)
    toneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
    noise.connect(filter).connect(noiseGain).connect(this.ctx.destination)
    oscillator.connect(toneGain).connect(this.ctx.destination)
    this.trackOneShot(noise, filter, noiseGain)
    this.trackOneShot(oscillator, toneGain)
    noise.start(now)
    noise.stop(now + 0.12)
    oscillator.start(now)
    oscillator.stop(now + 0.12)
  }

  private playErrorBeep(level: number): void {
    const now = this.ctx.currentTime
    this.playTone('square', 880, 440, now, 0.12, level)
    this.playTone('square', 880, 440, now + 0.16, 0.12, level)
  }

  private playOkBeep(level: number): void {
    this.playTone('sine', 660, 990, this.ctx.currentTime, 0.18, level)
  }

  private playKnock(level: number): void {
    const now = this.ctx.currentTime
    for (let i = 0; i < 3; i++) this.playTone('sine', 180, 110, now + i * 0.35, 0.09, level * 0.8)
  }

  private playWhisper(level: number): void {
    const now = this.ctx.currentTime
    const source = this.noiseSource()
    const filter = this.ctx.createBiquadFilter()
    const gain = this.ctx.createGain()
    filter.type = 'bandpass'
    filter.frequency.value = 1500
    filter.Q.value = 1.5
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.linearRampToValueAtTime(level * 0.28, now + 0.25)
    gain.gain.linearRampToValueAtTime(0.0001, now + 1.2)
    source.connect(filter).connect(gain).connect(this.ctx.destination)
    this.trackOneShot(source, filter, gain)
    source.start(now)
    source.stop(now + 1.2)
  }

  private playTone(type: OscillatorType, from: number, to: number, at: number, duration: number, level: number): void {
    const oscillator = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(from, at)
    oscillator.frequency.linearRampToValueAtTime(to, at + duration)
    gain.gain.setValueAtTime(Math.max(0.0001, level), at)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration)
    oscillator.connect(gain).connect(this.ctx.destination)
    this.trackOneShot(oscillator, gain)
    oscillator.start(at)
    oscillator.stop(at + duration)
  }

  private noiseSource(): AudioBufferSourceNode {
    const source = this.ctx.createBufferSource()
    source.buffer = this.noiseBuffer
    return source
  }

  private trackLoop(handle: LoopHandle, source: AudioScheduledSourceNode, ...nodes: AudioNode[]): void {
    handle.sources.push(source)
    handle.nodes.push(...nodes)
    this.activeSources.add(source)
    for (const node of nodes) this.activeNodes.add(node)
    source.onended = () => this.cleanupSource(source, nodes)
  }

  private trackOneShot(source: AudioScheduledSourceNode, ...nodes: AudioNode[]): void {
    this.activeSources.add(source)
    for (const node of nodes) this.activeNodes.add(node)
    source.onended = () => this.cleanupSource(source, nodes)
  }

  private cleanupSource(source: AudioScheduledSourceNode, nodes: AudioNode[]): void {
    this.activeSources.delete(source)
    this.disconnect(source)
    for (const node of nodes) {
      this.activeNodes.delete(node)
      this.disconnect(node)
    }
  }

  private stopSource(source: AudioScheduledSourceNode): void {
    try {
      source.stop()
    } catch {
      // A completed one-shot cannot be stopped again.
    }
    this.activeSources.delete(source)
    this.disconnect(source)
  }

  private disconnect(node: AudioNode): void {
    try {
      node.disconnect()
    } catch {
      // Nodes can already be disconnected after an onended cleanup.
    }
  }

  private volume(value: number): number {
    return Math.max(0, value)
  }
}
