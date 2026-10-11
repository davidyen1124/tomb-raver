// Two things that are easy to get wrong and hard to see, measured on the real model in a browser:
//   sight  every camera, at every corner of the range it can be dragged through: is anything standing
//          between it and the DJ or the desk, or looming in the foreground?
//   arms   each hand on everything it is ever asked to touch: do the arms, the hands or the belly go
//          into the gear?
// usage: node scripts/check.mjs [sight|arms]      (exits 1 if anything is wrong)
import path from 'node:path'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const ROOT = path.resolve(import.meta.dirname, '..')
const only = process.argv[2]
const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5193, strictPort: false, hmr: false, watch: null } })
await server.listen()
const browser = await chromium.launch({ args: ['--use-angle=metal'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })
page.on('pageerror', (e) => console.log('  [page error]', e.message))
let bad = 0

if (only !== 'arms') {
  for (const [w, h] of [[1280, 800], [1920, 1080], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h })
    await page.goto(server.resolvedUrls.local[0] + 'dev.html?still')
    await page.waitForFunction(() => window.ready, null, { timeout: 60000 })
    const report = await page.evaluate(() => window.bench.sight())
    console.log(`\nsight, ${w} x ${h}`)
    for (const [name, r] of Object.entries(report)) {
      const n = Object.keys(r.problems).length
      console.log(`  ${name.padEnd(6)} ${String(r.poses).padStart(3)} positions, yaw ${r.limits.yaw.join('..')} pitch ${r.limits.pitch.join('..')} zoom ${r.limits.zoom.join('..')}: ${n ? 'BLOCKED' : 'clear'}`)
      if (!n) continue
      bad++
      if (process.argv.includes('--map')) for (const row of r.rows) console.log('      ' + row)
      for (const [k, where] of Object.entries(r.problems)) console.log(`      ${k}: ${where.length} positions, e.g. ${where[0]}; ${where[where.length - 1]}`)
    }
  }
}

if (only !== 'sight') {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(server.resolvedUrls.local[0] + 'dev.html?still' + (process.env.RIG ? '&' + process.env.RIG : ''))
  await page.waitForFunction(() => window.ready, null, { timeout: 60000 })
  const { rows, worst } = await page.evaluate(() => window.bench.arms())
  console.log('\narms: least distance from the gear, in metres (below zero is inside it)')
  if (process.argv.includes('--all')) for (const r of rows) console.log(`  ${r.side} ${r.at.padEnd(10)} upper ${String(r.upper).padStart(7)} forearm ${String(r.forearm).padStart(7)} hand ${String(r.hand).padStart(7)} belly ${String(r.belly).padStart(7)} stretch ${r.stretch}${r.cross ? '  (across the body)' : ''}`)
  for (const [k, v] of Object.entries(worst)) console.log(`  ${k.padEnd(8)} ${String(v.d).padStart(7)}   ${v.at || ''}${v.against ? ' / ' + v.against : ''}`)
  const through = rows.filter((r) => r.upper < 0 || r.forearm < 0 || r.belly < 0 || r.hand < 0)
  for (const r of through) console.log(`  THROUGH THE GEAR: ${r.side} hand on ${r.at}: upper ${r.upper}, forearm ${r.forearm}, belly ${r.belly}${r.cross ? ' (across the body)' : ''}`)
  if (through.length) bad++
}
await browser.close()
await server.close()
console.log(bad ? '\nNOT CLEAR' : '\nall clear')
process.exit(bad ? 1 : 0)
