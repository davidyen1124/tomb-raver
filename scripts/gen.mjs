// Draws the art with Codex CLI's built-in image_gen tool (the imagegen skill), one `codex exec` per image.
// An entry's `refs` are attached to the run: the name of another raw image, or `photo:<name>` for a picture
// in assets-src/art/ref.
// usage: node scripts/gen.mjs [--force] [-j 4] [name ...]   (default: every entry in assets-src/art/manifest.mjs)
//        a name ending in * picks every entry that starts with it, e.g. 'sleeve-*'
// Output: assets-src/art/raw/<name>.png
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ASSETS, CUTOUT, STYLE } from '../assets-src/art/manifest.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')
const RAW = path.join(ROOT, 'assets-src/art/raw')
const LOG = path.join(ROOT, 'assets-src/art/logs')
const GEN = path.join(os.homedir(), '.codex/generated_images')
fs.mkdirSync(RAW, { recursive: true })
fs.mkdirSync(LOG, { recursive: true })

const argv = process.argv.slice(2)
const force = argv.includes('--force')
const jIdx = argv.indexOf('-j')
const jobs = jIdx >= 0 ? Number(argv[jIdx + 1]) : 4
const names = argv.filter((a, i) => !a.startsWith('-') && argv[i - 1] !== '-j')

const picked = ASSETS.filter((a) => (names.length ? names.some((n) => (n.endsWith('*') ? a.name.startsWith(n.slice(0, -1)) : n === a.name)) : true))
const raw = (name) => path.join(RAW, name + '.png')
const file = (ref) => (ref.startsWith('photo:') ? path.join(ROOT, 'assets-src/art/ref', ref.slice(6) + '.png') : raw(ref))
const has = (name) => fs.existsSync(raw(name))

const HEAD = [
  'Use the imagegen skill with your built-in image_gen tool (NOT the CLI fallback, no API key needed).',
  'Make exactly ONE image_gen call, then reply with just DONE. Do not write code, do not create or edit files, do not ask questions.',
]
const ALPHA = 'This image MUST have a genuinely transparent background (real alpha channel): request a transparent background from image_gen and keep the alpha.'

const brief = (a) =>
  [
    ...HEAD,
    a.refs?.length && 'The attached image is a REFERENCE, described in the brief. Use it as the reference input image for image_gen; make a new image, do not edit it.',
    a.transparent ? ALPHA : 'This image is OPAQUE and full-bleed: it fills the whole canvas. Do not make it transparent.',
    '',
    `Canvas: ${a.size}.`,
    '',
    'BRIEF:',
    a.prompt,
    '',
    a.plain ? a.style || '' : STYLE,
    a.transparent ? CUTOUT : '',
  ].filter((l) => l !== undefined && l !== false).join('\n')

function run(a) {
  return new Promise((resolve) => {
    // --image is variadic, so it goes after the "-" that means "prompt on stdin"
    const images = (a.refs || []).flatMap((ref) => ['-i', file(ref)])
    const args = ['exec', '--skip-git-repo-check', '-c', 'model_reasoning_effort="low"', '-C', RAW, '--json', '-', ...images]
    const t0 = Date.now()
    const p = spawn('codex', args, { stdio: ['pipe', 'pipe', 'pipe'] })
    const out = fs.createWriteStream(path.join(LOG, a.name + '.jsonl'))
    let first = ''
    p.stdout.on('data', (d) => {
      if (!first) first = d.toString()
      out.write(d)
    })
    p.stderr.pipe(fs.createWriteStream(path.join(LOG, a.name + '.err')))
    p.stdin.end(brief(a))
    p.on('close', (code) => {
      out.end()
      const tid = (first.match(/"thread_id":"([^"]+)"/) || [])[1]
      const dir = tid && path.join(GEN, tid)
      const pngs = dir && fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.png')) : []
      const secs = Math.round((Date.now() - t0) / 1000)
      if (pngs.length) {
        const newest = pngs.map((f) => path.join(dir, f)).sort((x, y) => fs.statSync(y).mtimeMs - fs.statSync(x).mtimeMs)[0]
        fs.copyFileSync(newest, raw(a.name))
        console.log(`ok   ${a.name.padEnd(18)} ${secs}s`)
        resolve(true)
      } else {
        console.log(`FAIL ${a.name.padEnd(18)} exit=${code} ${secs}s thread=${tid}`)
        resolve(false)
      }
    })
  })
}

async function asset(a) {
  if (!force && has(a.name)) return
  const missing = (a.refs || []).find((ref) => !fs.existsSync(file(ref)))
  if (missing) return console.log(`skip ${a.name.padEnd(18)} its reference ${missing} does not exist yet`)
  // one more try if a run comes back without an image
  if (!(await run(a))) await run(a)
}

// an entry waits until the references made in this run are done
const queue = [...picked]
const pending = new Set(queue.map((a) => a.name))
const waits = (a) => (a.refs || []).some((ref) => pending.has(ref))
console.log(`${queue.length} asset(s), ${jobs} at a time`)
await Promise.all(
  Array.from({ length: Math.min(jobs, queue.length) }, async () => {
    while (queue.length) {
      const i = queue.findIndex((a) => !waits(a))
      if (i < 0) {
        await new Promise((r) => setTimeout(r, 500))
        continue
      }
      const a = queue.splice(i, 1)[0]
      await asset(a)
      pending.delete(a.name)
    }
  }),
)
console.log('all done')
