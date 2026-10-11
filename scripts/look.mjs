// Opens the real page, starts the set, and photographs it at the given seconds (and reports what the DJ says he did).
//   node scripts/look.mjs qa/live "8,30,60" [width] [height] [query]
import path from 'node:path'
import fs from 'node:fs'
import { chromium, webkit } from 'playwright'
import { createServer, preview } from 'vite'

const ROOT = path.resolve(import.meta.dirname, '..')
const [out = 'qa/live', times = '8', w = '1280', h = '800', query = 'seed=7', mode = 'dev'] = process.argv.slice(2)
// mode: dev (the source, served by vite), dist (the build), or a URL (the deployed page)
const remote = /^https?:/.test(mode)
const server = remote ? null : mode === 'dist' ? await preview({ root: ROOT, preview: { port: 5196 } }) : await createServer({ root: ROOT, logLevel: 'error', server: { port: 5196, strictPort: false, hmr: false, watch: null } })
if (server && mode !== 'dist') await server.listen()
const base = remote ? mode : server.resolvedUrls.local[0]
const browser = process.env.BROWSER === 'webkit' ? await webkit.launch() : await chromium.launch({ args: ['--use-angle=metal', '--autoplay-policy=no-user-gesture-required', '--disable-audio-output'] })
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 1 })
const errors = []
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(m.text().slice(0, 300)))
page.on('pageerror', (e) => errors.push('PAGE ERROR ' + e.message))
await page.goto(base + '?' + query)
await page.waitForSelector('[data-start]', { timeout: 30000 })
await page.waitForTimeout(600)
fs.mkdirSync(path.dirname(path.resolve(ROOT, out)), { recursive: true })
await page.screenshot({ path: path.resolve(ROOT, out + '-title.png') })
await page.click('[data-start]')
const t0 = Date.now()
for (const t of times.split(',').map(Number)) {
  await page.waitForTimeout(Math.max(0, t * 1000 - (Date.now() - t0)))
  await page.screenshot({ path: path.resolve(ROOT, `${out}-${String(t).padStart(3, '0')}.png`) })
  const s = await page.evaluate(async () => {
    const { brain, engine, desk, stage, hands } = window.set
    // the loudest moment in the last second or so, per channel and at the output
    const peak = { A: 0, B: 0, M: 0 }
    for (let i = 0; i < 24; i++) {
      for (const n in peak) peak[n] = Math.max(peak[n], engine.mixer.level(n).peak)
      await new Promise((r) => setTimeout(r, 40))
    }
    const lv = (n) => peak[n].toFixed(2)
    return `shot=${stage.shot} live=${brain.state.live} A=${engine.decks.A.playing ? 'play' : 'stop'}@${(engine.decks.A.posAt(engine.ctx.currentTime) / 16).toFixed(1)} B=${engine.decks.B.playing ? 'play' : 'stop'}@${(engine.decks.B.posAt(engine.ctx.currentTime) / 16).toFixed(1)} levels A ${lv('A')} B ${lv('B')} M ${lv('M')} touches=${desk.touches} doing="${hands.lastTouch?.tag || ''}" ctxState=${engine.ctx.state}`
  })
  console.log(`${t}s  ${s}`)
}
if (errors.length) console.log('errors:\n  ' + [...new Set(errors)].join('\n  '))
await browser.close()
if (server) await (server.close ? server.close() : server.httpServer.close())
