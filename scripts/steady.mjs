// Is the picture steady? Opens the page, starts the set just before a drop, and watches the camera
// through the drop and the loudest bars after it:
//   lens    the camera's field of view, every frame. It may change only when the camera is cut to
//           another position; within one position it must not move at all (no punching in on the beat).
//   cuts    how long the camera stays in each position. A position held for less than a second is a
//           flash, not a cut.
//   size    how far apart two fixed things are on the screen (the two platters), frame to frame.
//   light   how bright the whole picture is, from screenshots: just after the drop against later beats.
// usage: node scripts/steady.mjs [camera=front|auto|back|top|side|wide] [url]      (exits 1 if the lens moves)
import path from 'node:path'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import sharp from 'sharp'

const ROOT = path.resolve(import.meta.dirname, '..')
const cam = process.argv[2] || 'front'
const remote = process.argv[3]
const server = remote ? null : await createServer({ root: ROOT, logLevel: 'error', server: { port: 5189, strictPort: false, hmr: false, watch: null } })
if (server) await server.listen()
const base = remote || server.resolvedUrls.local[0]
const browser = await chromium.launch({ args: ['--use-angle=metal', '--autoplay-policy=no-user-gesture-required', '--disable-audio-output'] })
const page = await browser.newPage({ viewport: { width: 1000, height: 625 }, deviceScaleFactor: 1 })
page.on('pageerror', (e) => console.log('  [page error]', e.message))
// the first record of seed 7 is "Small Medipack": its breakdown is bars 48 to 56 and the drop lands on 56
await page.goto(`${base}?seed=7&bar=45&cam=${cam}`)
await page.waitForSelector('[data-start]')
await page.click('[data-start]')
await page.waitForFunction(() => window.set?.brain.state.live, null, { timeout: 30000 })
// watch every frame from here on
await page.evaluate(() => {
  const { stage, engine, brain } = window.set
  const a = { x: 0, y: 0, z: 0 }
  const b = { x: 0, y: 0, z: 0 }
  window.watch = []
  const tick = () => {
    const now = engine.ctx.currentTime
    stage.toScreen(stage.decks.A.centre, a)
    stage.toScreen(stage.decks.B.centre, b)
    // (the picture is drawn at thirty frames a second: note which camera position the picture drawn last was from)
    window.watch.push([now, stage.shot, stage.camera.fov, Math.hypot(a.x - b.x, a.y - b.y), brain.env(now).energy, now - brain.state.dropAt, stage.cam.fov])
    requestAnimationFrame(tick)
  }
  tick()
})
// photographs through the drop, for the brightness
const taken = []
const t0 = Date.now()
while (Date.now() - t0 < 60000) {
  const buf = await page.screenshot({ type: 'png' })
  const [now, dropAt] = await page.evaluate(() => [window.set.engine.ctx.currentTime, window.set.brain.state.dropAt])
  taken.push({ now, buf })
  if (taken.length > 400) taken.shift()
  if (dropAt > 0 && now - dropAt > 6) break
}
const dropAt = await page.evaluate(() => window.set.brain.state.dropAt)
const shots = []
for (const { now, buf } of taken) {
  if (Math.abs(now - dropAt) > 6) continue
  const st = await sharp(buf).stats()
  shots.push({ age: now - dropAt, lum: (st.channels[0].mean + st.channels[1].mean + st.channels[2].mean) / 3 })
}
const watch = await page.evaluate(() => window.watch)
await browser.close()
if (server) await server.close()

// the lens, within each stretch the camera stayed in one position
let bad = 0
const runs = []
for (const [t, shot, fov, span, energy, age, set] of watch) {
  const r = runs[runs.length - 1]
  // (between a cut being called and the next picture being drawn, the lens is still the last position's)
  if (r && r.shot === shot && Math.abs(fov - set) > 1e-9 && r.frames < 4) continue
  if (!r || r.shot !== shot) runs.push({ shot, t0: t, t1: t, min: set, max: set, frames: 1, jump: 0, last: 0, loud: 0 })
  else {
    r.t1 = t
    r.min = Math.min(r.min, fov)
    r.max = Math.max(r.max, fov)
    r.frames++
    if (r.last > 0) r.jump = Math.max(r.jump, Math.abs(span / r.last - 1))
    r.last = span
    if (energy > 0.85) r.loud++
  }
  void age
}
console.log(`camera: ${cam}   (${watch.length} frames watched, ${runs.length} camera position${runs.length > 1 ? 's' : ''})`)
for (const [i, r] of runs.entries()) {
  const moved = r.max - r.min > 1e-9
  if (moved) bad++
  // (the last position is still being held when the watching stops)
  const flashed = i < runs.length - 1 && r.t1 - r.t0 < 1
  if (flashed) bad++
  console.log(`  ${r.shot.padEnd(6)} ${String(r.frames).padStart(5)} frames (${r.loud} of them at full energy)   lens ${r.min.toFixed(3)}° .. ${r.max.toFixed(3)}°  ${moved ? 'MOVES by ' + (((r.max - r.min) / r.max) * 100).toFixed(2) + '%' : 'steady'}   held ${(r.t1 - r.t0).toFixed(1)} s${flashed ? ' A FLASH' : ''}   largest change in size between two frames ${(r.jump * 100).toFixed(3)}%`)
}
const before = shots.filter((s) => s.age < -0.3).map((s) => s.lum)
const at = shots.filter((s) => s.age >= 0 && s.age < 0.7).map((s) => s.lum)
const later = shots.filter((s) => s.age >= 1.5).map((s) => s.lum)
const max = (a) => (a.length ? Math.max(...a) : NaN)
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN)
console.log(`  brightness (0..255), ${shots.length} photographs: before the drop ${mean(before).toFixed(1)} on average, brightest ${max(before).toFixed(1)};  in the 0.7 s after it lands, brightest ${max(at).toFixed(1)};  later beats, brightest ${max(later).toFixed(1)}`)
console.log(bad ? '\nNOT STEADY' : '\nthe lens is steady, and no camera position flashes by')
process.exit(bad ? 1 : 0)
