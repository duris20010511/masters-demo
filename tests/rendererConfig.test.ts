import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { configureRenderer } from '../src/render/rendererConfig'

describe('configureRenderer', () => {
  it('uses filmic sRGB output with soft shadows', () => {
    const renderer = {
      outputColorSpace: THREE.LinearSRGBColorSpace,
      toneMapping: THREE.NoToneMapping,
      toneMappingExposure: 1,
      shadowMap: { enabled: false, type: THREE.BasicShadowMap },
    } as unknown as THREE.WebGLRenderer

    configureRenderer(renderer)

    expect(renderer.outputColorSpace).toBe(THREE.SRGBColorSpace)
    expect(renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping)
    expect(renderer.toneMappingExposure).toBe(0.9)
    expect(renderer.shadowMap.enabled).toBe(true)
    expect(renderer.shadowMap.type).toBe(THREE.PCFSoftShadowMap)
  })
})
