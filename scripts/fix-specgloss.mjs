// KHR_materials_pbrSpecularGlossiness → 표준 metallic-roughness 변환기
//
// Sketchfab의 구형(특히 Mixamo 경유) GLB는 이 확장을 쓰는데, three.js r160+ 는
// 지원을 제거해서 텍스처가 통째로 무시되고 무채색으로 렌더된다.
// 확장 안의 diffuseTexture/diffuseFactor를 표준 슬롯으로 옮긴다. (바이너리 청크는 그대로)
//
// 사용: node scripts/fix-specgloss.mjs <파일.glb> [출력.glb]
import { readFile, writeFile } from 'node:fs/promises'

const EXT = 'KHR_materials_pbrSpecularGlossiness'
const src = process.argv[2]
const dst = process.argv[3] ?? src
if (!src) {
  console.error('usage: node scripts/fix-specgloss.mjs <file.glb> [out.glb]')
  process.exit(1)
}

const buf = await readFile(src)
if (buf.slice(0, 4).toString() !== 'glTF') throw new Error('GLB가 아님')
const jsonLen = buf.readUInt32LE(12)
const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'))
const binChunk = buf.slice(20 + jsonLen) // [length, type, data...] 그대로 재사용

let converted = 0
for (const mat of json.materials ?? []) {
  const sg = mat.extensions?.[EXT]
  if (!sg) continue
  const pbr = (mat.pbrMetallicRoughness ??= {})
  if (sg.diffuseTexture && !pbr.baseColorTexture) pbr.baseColorTexture = sg.diffuseTexture
  if (sg.diffuseFactor && !pbr.baseColorFactor) pbr.baseColorFactor = sg.diffuseFactor
  // 스펙큘러 워크플로 → 러프니스 근사 (광택도의 반대)
  pbr.metallicFactor = 0
  pbr.roughnessFactor = 1 - (sg.glossinessFactor ?? 0.5)
  delete mat.extensions[EXT]
  if (Object.keys(mat.extensions).length === 0) delete mat.extensions
  converted++
}
const drop = (arr) => (arr ?? []).filter((e) => e !== EXT)
if (json.extensionsUsed) json.extensionsUsed = drop(json.extensionsUsed)
if (json.extensionsRequired) {
  json.extensionsRequired = drop(json.extensionsRequired)
  if (json.extensionsRequired.length === 0) delete json.extensionsRequired
}

// JSON 청크 재작성 (4바이트 정렬, 공백 패딩)
let jsonBuf = Buffer.from(JSON.stringify(json), 'utf8')
const pad = (4 - (jsonBuf.length % 4)) % 4
if (pad) jsonBuf = Buffer.concat([jsonBuf, Buffer.from(' '.repeat(pad))])

const header = Buffer.alloc(12)
header.write('glTF', 0)
header.writeUInt32LE(2, 4)
header.writeUInt32LE(12 + 8 + jsonBuf.length + binChunk.length, 8)
const jsonHeader = Buffer.alloc(8)
jsonHeader.writeUInt32LE(jsonBuf.length, 0)
jsonHeader.writeUInt32LE(0x4e4f534a, 4) // 'JSON'

await writeFile(dst, Buffer.concat([header, jsonHeader, jsonBuf, binChunk]))
console.log(`변환 완료: ${converted}개 머티리얼 → ${dst}`)
