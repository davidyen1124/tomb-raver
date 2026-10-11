// Photographs the stage bench (dev.html) or the page itself.
//   node scripts/shot.mjs out.png "dev.html?shot=front" [width] [height]
import path from 'node:path'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const ROOT = path.resolve(import.meta.dirname, '..')
const [out = 'qa/shot.png', url = 'dev.html', w = '1280', h = '800', wait = '1500'] = process.argv.slice(2)
const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5198, strictPort: false, hmr: false, watch: null } })
await server.listen()
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 1 })
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && console.log('  [page]', m.text().slice(0, 300)))
page.on('pageerror', (e) => console.log('  [page error]', e.message))
const urls = url.split('|')
for (const [i, u] of urls.entries()) {
  await page.goto(server.resolvedUrls.local[0] + u)
  await page.waitForFunction(() => window.ready, null, { timeout: 30000 }).catch(() => console.log('  (never became ready)'))
  await page.waitForTimeout(Number(wait))
  const file = urls.length > 1 ? out.replace(/(\.\w+)$/, `-${i}$1`) : out
  await page.screenshot({ path: path.resolve(ROOT, file) })
  console.log(file)
}
await browser.close()
await server.close()
