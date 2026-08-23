// 헤드리스 Chrome으로 게임 화면을 캡처한다 (시각 검증용).
// 브라우저 창 없이 WebGL을 렌더링해야 하므로 SwiftShader를 강제한다.
//
//   node scripts/shot.mjs "http://localhost:5173/?scene=cycle1" shots/lab.png
//   node scripts/shot.mjs <url> <out.png> --wait 6000 --size 1280x800 \
//        --key KeyW:1200 --move 300,0 --click 640,400
//
// --key/--move/--click은 지정한 순서대로 실행된다.
import { spawn } from 'node:child_process'
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 9333 + (process.pid % 200)

const argv = process.argv.slice(2)
const url = argv[0]
const out = argv[1]
if (!url || !out) {
  console.error('usage: node scripts/shot.mjs <url> <out.png> [--wait ms] [--size WxH] [--key K:ms] [--move dx,dy] [--click x,y]')
  process.exit(1)
}

// 순서가 중요한 액션(--key/--move/--click)은 등장 순서대로 모은다
const actions = []
let waitMs = 6000
let [W, H] = [1280, 800]
for (let i = 2; i < argv.length; i += 2) {
  const [flag, v] = [argv[i], argv[i + 1]]
  if (flag === '--wait') waitMs = Number(v)
  else if (flag === '--size') [W, H] = v.split('x').map(Number)
  else if (flag === '--key') actions.push({ type: 'key', code: v.split(':')[0], ms: Number(v.split(':')[1] ?? 500) })
  else if (flag === '--move') actions.push({ type: 'move', dx: Number(v.split(',')[0]), dy: Number(v.split(',')[1]) })
  else if (flag === '--click') actions.push({ type: 'click', x: Number(v.split(',')[0]), y: Number(v.split(',')[1]) })
  else if (flag === '--eval') actions.push({ type: 'eval', src: v })
  else if (flag === '--sleep') actions.push({ type: 'sleep', ms: Number(v) })
  else throw new Error(`unknown flag ${flag}`)
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  '--remote-allow-origins=*',
  '--enable-unsafe-swiftshader', // GPU 없이 WebGL2 소프트웨어 렌더링
  '--use-angle=swiftshader',
  '--hide-scrollbars',
  '--mute-audio',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  `--window-size=${W},${H}`,
  '--user-data-dir=' + (process.env.TEMP ?? '.') + '/cc-shot-' + process.pid,
  'about:blank',
], { stdio: 'ignore' })

let ws
try {
  // DevTools 엔드포인트가 열릴 때까지 폴링
  let target = null
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(250)
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      target = list.find(t => t.type === 'page')
    } catch {}
  }
  if (!target) throw new Error('DevTools endpoint did not open')

  ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true })
    ws.addEventListener('error', rej, { once: true })
  })

  let id = 0
  const pending = new Map()
  ws.addEventListener('message', e => {
    const msg = JSON.parse(e.data)
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result)
    }
  })
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const n = ++id
      pending.set(n, { res, rej })
      ws.send(JSON.stringify({ id: n, method, params }))
    })

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url })
  await sleep(waitMs)

  // 포인터락은 헤드리스에서도 걸리므로, 시점 회전은 마우스 이동 이벤트로 전달된다
  let mx = W / 2
  let my = H / 2
  for (const a of actions) {
    if (a.type === 'click') {
      for (const type of ['mousePressed', 'mouseReleased'])
        await send('Input.dispatchMouseEvent', { type, x: a.x, y: a.y, button: 'left', clickCount: 1, buttons: type === 'mousePressed' ? 1 : 0 })
      await sleep(600)
    } else if (a.type === 'key') {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', code: a.code, key: a.code.replace('Key', '').toLowerCase(), windowsVirtualKeyCode: a.code.startsWith('Key') ? a.code.charCodeAt(3) : 0 })
      await sleep(a.ms)
      await send('Input.dispatchKeyEvent', { type: 'keyUp', code: a.code, key: a.code.replace('Key', '').toLowerCase(), windowsVirtualKeyCode: a.code.startsWith('Key') ? a.code.charCodeAt(3) : 0 })
      await sleep(200)
    } else if (a.type === 'move') {
      // 한 번에 크게 움직이면 씬이 무시할 수 있어 잘게 쪼갠다
      const steps = 12
      for (let i = 0; i < steps; i++) {
        mx += a.dx / steps
        my += a.dy / steps
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: mx, y: my, buttons: 0 })
        await sleep(16)
      }
      await sleep(300)
    } else if (a.type === 'eval') {
      const r = await send('Runtime.evaluate', { expression: a.src, awaitPromise: false, returnByValue: true })
      console.log('[eval]', JSON.stringify(r.result?.value ?? r.result?.description ?? null))
      await sleep(300)
    } else if (a.type === 'sleep') {
      await sleep(a.ms)
    }
  }

  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, Buffer.from(data, 'base64'))
  console.log('saved', out)
} finally {
  ws?.close()
  chrome.kill()
}
