import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { GLITCH_SHADER } from './glitchShader'

export interface FxLevels { vignette: number; grain: number; glitch: number; rgbShift: number }

const UNIFORM: Record<keyof FxLevels, string> = {
  vignette: 'uVignette',
  grain: 'uGrain',
  glitch: 'uGlitch',
  rgbShift: 'uRgbShift',
}

interface Pulse { key: keyof FxLevels; peak: number; ms: number; t: number; base: number }

export class PostFX {
  private composer: EffectComposer
  private renderPass: RenderPass
  private pass: ShaderPass
  private time = 0
  private pulses: Pulse[] = []
  private bloom: UnrealBloomPass

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer)
    this.renderPass = new RenderPass(scene, camera)
    this.pass = new ShaderPass(GLITCH_SHADER as never)
    this.composer.addPass(this.renderPass)
    // 발광체(형광등·비상등·비상구)만 번지게 — threshold를 낮추면 벽 전체가 뿌예져 공포가 날아간다
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(renderer.domElement.width, renderer.domElement.height),
      0.55, // strength
      0.5, // radius
      0.82, // threshold
    )
    // 톤매핑(ACES)·sRGB 변환은 OutputPass가 없으면 컴포저 체인에서 적용되지 않는다.
    // 글리치는 **OutputPass 뒤**여야 한다: 선형 공간에서 그레인을 더하면 어두운 화면에서
    // 0.07 선형 ≈ sRGB 0.29 로 증폭돼 복도 전체가 노이즈로 덮인다.
    this.composer.addPass(this.bloom)
    this.composer.addPass(new OutputPass())
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

  resize(w: number, h: number): void {
    this.composer.setSize(w, h)
    this.bloom.setSize(w, h)
  }

  render(dtMs: number): void {
    this.time += dtMs / 1000
    this.pass.uniforms.uTime.value = this.time
    this.pulses = this.pulses.filter(p => {
      p.t += dtMs
      const x = Math.min(1, p.t / p.ms)
      const v = p.base + (p.peak - p.base) * Math.sin(x * Math.PI) // 올라갔다 내려옴
      this.pass.uniforms[UNIFORM[p.key]].value = x < 1 ? Math.max(p.base, v) : p.base
      return x < 1
    })
    this.composer.render()
  }
}
