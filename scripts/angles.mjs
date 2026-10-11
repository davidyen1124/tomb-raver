// Photographs every camera at the middle and at the corners of the range it can be dragged through, and
// lays them out on one sheet per camera (qa/angles-<name>.jpg), for looking over by eye.
// usage: node scripts/angles.mjs [width] [height]
import path from 'node:path'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import sharp from 'sharp'

const ROOT = path.resolve(import.meta.dirname, '..')
const W = Number(process.argv[2] || 640)
const H = Number(process.argv[3] || 400)
const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5192, strictPort: false, hmr: false, watch: null } })
await server.listen()
const browser = await chromium.launch({ args: ['--use-angle=metal'] })
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
await page.goto(server.resolvedUrls.local[0] + 'dev.html?still&energy=1&beat=0.5&l=A.low&r=B.low')
await page.waitForFunction(() => window.ready, null, { timeout: 60000 })
const limits = await page.evaluate(() => window.stage.limits)
for (const [name, L] of Object.entries(limits)) {
  const views = [
    ['as it cuts to it', 0, 0, 1],
    ['left, high', L.yaw[0], L.pitch[0], 1],
    ['right, high', L.yaw[1], L.pitch[0], 1],
    ['left, low', L.yaw[0], L.pitch[1], 1],
    ['right, low', L.yaw[1], L.pitch[1], 1],
    ['closest', 0, 0, L.zoom[0]],
    ['furthest', 0, 0, L.zoom[1]],
    ['furthest, left', L.yaw[0], L.pitch[1], L.zoom[1]],
    ['furthest, right', L.yaw[1], L.pitch[0], L.zoom[1]],
  ]
  const tiles = []
  for (const [i, [, yaw, pitch, zoom]] of views.entries()) {
    await page.evaluate(([n, y, p, z]) => {
      window.stage.setShot(n)
      Object.assign(window.stage.cam, { yaw: y, pitch: p, zoom: z })
    }, [name, yaw, pitch, zoom])
    await page.waitForTimeout(350)
    tiles.push({ input: await page.screenshot({ type: 'png' }), left: (i % 3) * W, top: Math.floor(i / 3) * H })
  }
  const out = path.join(ROOT, `qa/angles-${name}.jpg`)
  await sharp({ create: { width: W * 3, height: H * 3, channels: 3, background: '#000' } }).composite(tiles).jpeg({ quality: 82 }).toFile(out)
  console.log(`${out}   ${views.map((v) => v[0]).join(' | ')}`)
}
await browser.close()
await server.close()
