// 주의: 이 머신(Node 24 + Windows)에서는 fs.rmSync가 0xC0000409로 프로세스를 죽인다.
// (vite build가 outDir을 rmSync로 비우다 같은 이유로 크래시 → esbuild 스크립트로 대체)
// 반드시 비동기 fs/promises.rm을 쓸 것.
import { build } from 'esbuild'
import { rm, mkdir, readFile, writeFile } from 'node:fs/promises'

await rm('dist', { recursive: true, force: true })
await mkdir('dist/assets', { recursive: true })

await build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2022',
  outfile: 'dist/assets/main.js',
  sourcemap: false,
  logLevel: 'info',
})

const html = (await readFile('index.html', 'utf8')).replace('./src/main.ts', './assets/main.js')
await writeFile('dist/index.html', html)
console.log('build OK → dist/')
