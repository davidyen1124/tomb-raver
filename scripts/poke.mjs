// Plays the visitor: starts the set, then grabs controls on the desk with the mouse and checks that the
// DJ's hand goes there, the knob turns, the sound changes, and afterwards he puts it back.
import path from 'node:path'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const ROOT = path.resolve(import.meta.dirname, '..')
const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5195, strictPort: false, hmr: false, watch: null } })
await server.listen()
const browser = await chromium.launch({ args: ['--use-angle=metal', '--autoplay-policy=no-user-gesture-required', '--disable-audio-output'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })
const errors = []
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(m.text().slice(0, 300)))
page.on('pageerror', (e) => errors.push('PAGE ERROR ' + e.message))
await page.goto(server.resolvedUrls.local[0] + '?seed=7&bar=24')
await page.waitForSelector('[data-start]')
await page.click('[data-start]')
await page.waitForTimeout(9000)
await page.keyboard.press('3') // straight down on the desk
await page.waitForTimeout(600)
const where = (id) => page.evaluate((id) => {
  const { stage } = window.set
  const p = stage.controlPoint(id)
  return stage.toScreen(p)
}, id)
const sound = () => page.evaluate(async () => {
  const { engine } = window.set
  const acc = { low: 0, mid: 0, high: 0 }
  for (let i = 0; i < 30; i++) {
    const b = engine.mixer.bands()
    for (const k in acc) acc[k] += b[k] / 30
    await new Promise((r) => setTimeout(r, 40))
  }
  return Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, +v.toFixed(3)]))
})
const value = (id) => page.evaluate((id) => +window.set.desk.value[id].toFixed(3), id)
const hand = (id) => page.evaluate((id) => {
  const { puppet, stage } = window.set
  const p = stage.controlPoint(id)
  return Math.min(puppet.arms.l.tip.distanceTo(p), puppet.arms.r.tip.distanceTo(p)).toFixed(3)
}, id)

console.log('before               ', await sound())
for (const [id, dy, what] of [['A.low', 150, 'low killed'], ['A.filter', -70, 'filter to high-pass'], ['A.hi', 150, 'hi killed']]) {
  const p = await where(id)
  const v0 = await value(id)
  await page.mouse.move(p.x, p.y)
  await page.mouse.down()
  await page.mouse.move(p.x, p.y + dy, { steps: 12 })
  await page.waitForTimeout(900)
  const v1 = await value(id)
  const d = await hand(id)
  const s = await sound()
  if (id === 'A.low') await page.screenshot({ path: path.resolve(ROOT, 'qa/poke-low.png') })
  await page.mouse.up()
  console.log(`${what.padEnd(21)}`, s, `${id}: ${v0} -> ${v1}, nearest fingertip ${d} m away`)
  await page.waitForTimeout(9500) // he puts it back himself
  console.log(`  ...left alone, ${id} is back at ${await value(id)}`)
}
// the start/stop button on the playing deck: the record stops, and he starts it again
{
  const p = await where('A.play')
  await page.mouse.click(p.x, p.y)
  // (watched all the way through: it is stopped for about a second)
  const seen = await page.evaluate(async () => {
    const out = []
    const t0 = performance.now()
    while (performance.now() - t0 < 4500) {
      const on = window.set.engine.decks.A.playing
      if (!out.length || out[out.length - 1][0] !== on) out.push([on, Math.round(performance.now() - t0)])
      await new Promise((r) => setTimeout(r, 40))
    }
    return out
  })
  const stopped = seen.find(([on]) => !on)
  const again = stopped && seen.find(([on, t]) => on && t > stopped[1])
  console.log(`start/stop pressed: ${stopped ? `the record stops ${(stopped[1] / 1000).toFixed(1)} s later` : 'THE RECORD DOES NOT STOP'}${again ? `, and he has it going again ${((again[1] - stopped[1]) / 1000).toFixed(1)} s after that` : stopped ? ', AND IT STAYS STOPPED' : ''}`)
}
// the sound taken away in the middle of the set (what a phone does when the page is put aside): the
// room goes dim, one thing to press appears, and pressing it brings the music back where it left off
{
  const state = () => page.evaluate(() => ({ sound: window.set.engine.ctx.state, prompt: !document.querySelector('[data-wake]').hidden, says: document.querySelector('[data-wake-button]').textContent, bar: +(window.set.engine.decks[window.set.brain.state.live].posAt(window.set.engine.ctx.currentTime) / 16).toFixed(2) }))
  await page.evaluate(() => window.set.engine.ctx.suspend())
  await page.waitForTimeout(1200)
  const off = await state()
  await page.screenshot({ path: path.resolve(ROOT, 'qa/poke-wake.png') })
  await page.mouse.click(640, 400)
  await page.waitForTimeout(1500)
  const on = await state()
  console.log(`sound taken away: sound ${off.sound}, prompt shown ${off.prompt} ("${off.says}"), record at bar ${off.bar}`)
  console.log(`  ...one click: sound ${on.sound}, prompt shown ${on.prompt}, record at bar ${on.bar}, output`, await sound())
}
if (errors.length) console.log('errors:\n  ' + [...new Set(errors)].join('\n  '))
await browser.close()

// And a browser that will not let a page make a sound until it has been touched. (The test browser has no
// such rule, so it is given one: sound may not start, or start again, before the page's first real touch.)
// The set is started without a touch (?go), which is exactly what such a browser objects to.
{
  const strict = await chromium.launch({ args: ['--use-angle=metal', '--disable-audio-output'] })
  for (const [w, h, touch] of [[1280, 800, false], [390, 844, true]]) {
    const ctx = await strict.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch })
    await ctx.addInitScript(() => {
      const Real = window.AudioContext
      // (counted here, by hand: the test's own questions to the page would otherwise pass for touches)
      let was = false
      for (const type of ['mousedown', 'touchend', 'keydown']) window.addEventListener(type, (e) => (was = was || e.isTrusted), true)
      const touched = () => was
      window.AudioContext = class extends Real {
        constructor(options) {
          super(options)
          if (!touched()) super.suspend()
        }
        resume() {
          return touched() ? super.resume() : new Promise(() => {})
        }
      }
    })
    const p = await ctx.newPage()
    const errs = []
    p.on('pageerror', (e) => errs.push(e.message))
    await p.goto(server.resolvedUrls.local[0] + '?seed=7&go')
    await p.waitForFunction(() => window.set, null, { timeout: 30000 })
    await p.waitForTimeout(2500)
    const state = () => p.evaluate(() => ({ sound: window.set.engine.ctx.state, prompt: !document.querySelector('[data-wake]').hidden, says: document.querySelector('[data-wake-button]').textContent, clock: +window.set.engine.ctx.currentTime.toFixed(2), playing: window.set.brain.state.live }))
    const off = await state()
    await p.screenshot({ path: path.resolve(ROOT, `qa/poke-wake-${w}.png`) })
    if (touch) await p.touchscreen.tap(w / 2, h / 3)
    else await p.mouse.click(w / 2, h / 3)
    await p.waitForTimeout(8000)
    const on = await state()
    const level = await p.evaluate(async () => {
      let peak = 0
      for (let i = 0; i < 30; i++) {
        peak = Math.max(peak, window.set.engine.mixer.level('M').peak)
        await new Promise((r) => setTimeout(r, 40))
      }
      return +peak.toFixed(2)
    })
    console.log(`untouched page, ${w} x ${h}${touch ? ' (touch)' : ''}: sound ${off.sound}, prompt shown ${off.prompt} ("${off.says}"), clock ${off.clock} s, record playing: ${off.playing}`)
    console.log(`  ...one ${touch ? 'tap' : 'click'}: sound ${on.sound}, prompt shown ${on.prompt}, clock ${on.clock} s, record playing: deck ${on.playing}, output level ${level}${errs.length ? '  ERRORS ' + errs.join(' | ') : ''}`)
    await ctx.close()
  }
  await strict.close()
}
await server.close()
