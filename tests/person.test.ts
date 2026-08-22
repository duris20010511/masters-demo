import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { distortChaser, tintMaterial } from '../src/world/models'

describe('character visual transforms', () => {
  it('keeps PBR texture maps when tinting a material', () => {
    const map = new THREE.Texture()
    const normalMap = new THREE.Texture()
    const material = new THREE.MeshStandardMaterial({ map, normalMap, roughness: 0.4 })

    const tinted = tintMaterial(material, 0x241110) as THREE.MeshStandardMaterial

    expect(tinted).not.toBe(material)
    expect(tinted.map).toBe(map)
    expect(tinted.normalMap).toBe(normalMap)
    expect(tinted.color.getHex()).toBe(0x241110)
  })

  it('elongates the MakeHuman limbs without requiring a specific model instance', () => {
    const root = new THREE.Group()
    for (const name of ['lowerarm_l', 'lowerarm_r', 'thigh_l', 'thigh_r']) {
      const bone = new THREE.Bone()
      bone.name = name
      root.add(bone)
    }

    distortChaser(root)

    expect(root.getObjectByName('lowerarm_l')!.scale.y).toBe(1.35)
    expect(root.getObjectByName('lowerarm_r')!.scale.y).toBe(1.35)
    expect(root.getObjectByName('thigh_l')!.scale.y).toBe(1.35)
    expect(root.getObjectByName('thigh_r')!.scale.y).toBe(1.35)
  })
})
