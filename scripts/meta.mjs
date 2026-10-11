// Favicon, app icons and the social card, photographed from the page itself so they always match it:
// the icons are DJ MONOLITH's face from the stage bench (dev.html), the card is the title screen.
// usage: node scripts/meta.mjs
import { chromium } from 'playwright'
import { createServer } from 'vite'
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const PUB = path.join(ROOT, 'public')
const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5194, strictPort: false, hmr: false, watch: null } })
await server.listen()
const base = server.resolvedUrls.local[0]
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-audio-output'] })
async function portrait(size, cam) {
  const page = await (await browser.newContext({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })).newPage()
  await page.goto(`${base}dev.html?still&energy=0.5&cam=${cam}`, { waitUntil: 'load' })
  await page.waitForFunction(() => window.ready, null, { timeout: 60000 })
  await page.waitForTimeout(500)
  const buf = await page.screenshot({ type: 'png' })
  await page.close()
  return buf
}
// head, headphones and the decks under his chin
const SRC = await portrait(512, '0.5,2.0,4.6,0,1.52,0.3,31')
for (const [file, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]])
  await sharp(SRC).resize(size, size, { kernel: 'nearest' }).png({ compressionLevel: 9 }).toFile(path.join(PUB, file))
// browser-tab sizes: closer on the face so it still reads at 16px, corners rounded
const FACE = await portrait(256, '0.3,1.85,3.3,0,1.6,0.2,24')
async function tab(size) {
  const r = Math.round(size * 0.2)
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}"/></svg>`)
  return sharp(FACE).resize(size, size, { kernel: 'lanczos3' }).composite([{ input: mask, blend: 'dest-in' }]).png({ compressionLevel: 9 }).toBuffer()
}
const sizes = [16, 32, 48]
const pngs = {}
for (const s of sizes) pngs[s] = await tab(s)
fs.writeFileSync(path.join(PUB, 'favicon-32.png'), pngs[32])
// favicon.ico with PNG-compressed entries
const header = Buffer.alloc(6)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(sizes.length, 4)
let offset = 6 + 16 * sizes.length
const entries = sizes.map((s) => {
  const e = Buffer.alloc(16)
  e.writeUInt8(s, 0)
  e.writeUInt8(s, 1)
  e.writeUInt16LE(1, 4)
  e.writeUInt16LE(32, 6)
  e.writeUInt32LE(pngs[s].length, 8)
  e.writeUInt32LE(offset, 12)
  offset += pngs[s].length
  return e
})
fs.writeFileSync(path.join(PUB, 'favicon.ico'), Buffer.concat([header, ...entries, ...sizes.map((s) => pngs[s])]))

fs.writeFileSync(
  path.join(PUB, 'site.webmanifest'),
  JSON.stringify(
    {
      name: 'TOMB RAVER',
      short_name: 'Tomb Raver',
      description: 'DJ Monolith, live from Burial Chamber 2. An endless set, mixed by hand. A fan-made page.',
      start_url: '/',
      display: 'browser',
      background_color: '#000000',
      theme_color: '#0b0810',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    null,
    2,
  ) + '\n',
)

// social card, 1200 x 630: the title screen, without the button
{
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage()
  await page.goto(base, { waitUntil: 'load' })
  await page.waitForSelector('[data-start]', { timeout: 60000 })
  await page.addStyleTag({ content: '[data-start], .title-bar { visibility: hidden !important } #canvas { visibility: hidden }' })
  await page.waitForTimeout(500)
  const buf = await page.screenshot({ type: 'png' })
  await sharp(buf).jpeg({ quality: 88, mozjpeg: true }).toFile(path.join(PUB, 'og.jpg'))
  await page.close()
}
await browser.close()
await server.close()
for (const f of ['favicon.ico', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'site.webmanifest', 'og.jpg'])
  console.log(f.padEnd(22), (fs.statSync(path.join(PUB, f)).size / 1024).toFixed(1) + ' KB')
