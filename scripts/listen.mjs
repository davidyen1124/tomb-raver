// Listens to the music for you. Renders a scenario from the bench (listen.html) on an offline audio
// context in headless Chromium, writes it to qa/audio/<name>.wav, measures it, and draws its spectrogram.
//   node scripts/listen.mjs solo crystal        one record, start to finish
//   node scripts/listen.mjs solo all            every record in the box (a table)
//   node scripts/listen.mjs knobs crystal       one record with each control worked in turn
//   node scripts/listen.mjs set 6               the DJ's own set, six minutes of it
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT = path.join(ROOT, 'qa/audio')
fs.mkdirSync(OUT, { recursive: true })
const [scenario = 'solo', arg = 'crystal', ...rest] = process.argv.slice(2)

const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5199, strictPort: false, hmr: false, watch: null } })
await server.listen()
const url = server.resolvedUrls.local[0]
const browser = await chromium.launch()
const page = await browser.newPage()
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && console.log('  [page]', m.text()))
page.on('pageerror', (e) => console.log('  [page error]', e.message))
await page.goto(url + 'listen.html')
await page.waitForFunction(() => window.bench)

function fft(re, im) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let k = 0; k < len / 2; k++) {
        const a = i + k
        const b = a + len / 2
        const tr = re[b] * cr - im[b] * ci
        const ti = re[b] * ci + im[b] * cr
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
        const t = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = t
      }
    }
  }
}
const N = 4096
const hann = Float32Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N))
const BANDS = [['sub', 30, 70], ['low', 70, 250], ['mid', 250, 2500], ['high', 2500, 16000]]
const db = (x) => (x > 1e-9 ? 20 * Math.log10(x) : -180)

// loudness and balance of mono[a..b)
function measure(mono, sr, a, b) {
  a = Math.max(0, Math.floor(a))
  b = Math.min(mono.length, Math.floor(b))
  let peak = 0
  let sq = 0
  for (let i = a; i < b; i++) {
    const x = Math.abs(mono[i])
    if (x > peak) peak = x
    sq += x * x
  }
  const power = BANDS.map(() => 0)
  let frames = 0
  const re = new Float64Array(N)
  const im = new Float64Array(N)
  for (let s = a; s + N <= b; s += N / 2) {
    for (let i = 0; i < N; i++) {
      re[i] = mono[s + i] * hann[i]
      im[i] = 0
    }
    fft(re, im)
    BANDS.forEach(([, f0, f1], k) => {
      let p = 0
      for (let i = Math.ceil((f0 * N) / sr); i < (f1 * N) / sr; i++) p += re[i] * re[i] + im[i] * im[i]
      power[k] += p
    })
    frames++
  }
  const out = { peak: db(peak), rms: db(Math.sqrt(sq / Math.max(1, b - a))) }
  // scaled so that a full-scale sine in a band reads about 0 dB
  BANDS.forEach(([name], k) => (out[name] = db(Math.sqrt((power[k] / Math.max(1, frames)) * 2) / (N / 2) / Math.sqrt(0.375) / Math.SQRT2)))
  return out
}
const row = (label, m) => `${label.padEnd(22)} peak ${m.peak.toFixed(1).padStart(6)}  rms ${m.rms.toFixed(1).padStart(6)}   sub ${m.sub.toFixed(1).padStart(6)}  low ${m.low.toFixed(1).padStart(6)}  mid ${m.mid.toFixed(1).padStart(6)}  high ${m.high.toFixed(1).padStart(6)}`

async function run(name, opts, file) {
  const t0 = Date.now()
  const { info, pcm } = await page.evaluate(([n, o]) => window.bench.run(n, o), [name, opts])
  const bytes = Buffer.from(pcm, 'base64')
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + bytes.length, 4)
  header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(2, 22)
  header.writeUInt32LE(info.sr, 24)
  header.writeUInt32LE(info.sr * 4, 28)
  header.writeUInt16LE(4, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(bytes.length, 40)
  const wav = path.join(OUT, file + '.wav')
  fs.writeFileSync(wav, Buffer.concat([header, bytes]))
  const s16 = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.length / 2)
  const mono = new Float32Array(s16.length / 2)
  let clipped = 0
  for (let i = 0; i < mono.length; i++) {
    mono[i] = (s16[i * 2] + s16[i * 2 + 1]) / 65534
    if (Math.abs(s16[i * 2]) >= 32700 || Math.abs(s16[i * 2 + 1]) >= 32700) clipped++
  }
  return { info, mono, wav, clipped, took: (Date.now() - t0) / 1000 }
}
function picture(wav) {
  const png = wav.replace(/\.wav$/, '.png')
  try {
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', wav, '-lavfi', 'showspectrumpic=s=1500x420:legend=0:scale=log:fscale=log:stop=18000', png])
  } catch (e) {
    console.log('  (no spectrogram: ' + e.message.split('\n')[0] + ')')
  }
  return png
}

if (scenario === 'solo') {
  const ids = arg === 'all' ? await page.evaluate(() => window.bench.crate) : [arg]
  const summary = []
  for (const id of ids) {
    const r = await run('solo', { id, pc: Number(rest[0] ?? 9), seed: Number(rest[1] ?? 1) }, id)
    const { info, mono } = r
    const bar = (240 / info.bpm) * info.sr
    console.log(`\n${id}  ${info.bpm} bpm  ${info.seconds.toFixed(0)} s  rendered in ${r.took.toFixed(1)} s  clipped samples: ${r.clipped}`)
    for (const s of info.sections) console.log(row(`  ${s.name} (${s.bars})`, measure(mono, info.sr, info.start * info.sr + s.start * bar, info.start * info.sr + s.end * bar)))
    const all = measure(mono, info.sr, 0, mono.length)
    console.log(row('  whole record', all))
    summary.push([id, all])
    picture(r.wav)
  }
  if (summary.length > 1) {
    console.log('\nthe box:')
    for (const [id, m] of summary) console.log(row('  ' + id, m))
  }
} else if (scenario === 'drop') {
  const ids = arg === 'all' ? await page.evaluate(() => window.bench.crate) : [arg]
  console.log('eight bars from the drop:')
  for (const id of ids) {
    const r = await run('drop', { id, pc: 9, seed: 1, raw: rest.includes('raw') }, 'drop-' + id)
    console.log(row(`  ${id}${r.clipped ? ' CLIP ' + r.clipped : ''}`, measure(r.mono, r.info.sr, r.info.start * r.info.sr, r.mono.length)))
  }
} else if (scenario === 'knobs') {
  const r = await run('knobs', { id: arg, pc: Number(rest[0] ?? 9), seed: Number(rest[1] ?? 1) }, 'knobs-' + arg)
  console.log(`\nknobs on ${arg}: rendered in ${r.took.toFixed(1)} s, clipped samples: ${r.clipped}`)
  const bar = 240 / r.info.bpm
  for (const m of r.info.marks) console.log(row('  ' + m.name, measure(r.mono, r.info.sr, (m.t0 + bar) * r.info.sr, (m.t0 + 3 * bar) * r.info.sr)))
  picture(r.wav)
} else {
  const minutes = Number(arg) || 6
  const r = await run(scenario, { seconds: minutes * 60, seed: Number(rest[0] ?? 1) }, scenario)
  console.log(`\n${scenario}: ${minutes} min rendered in ${r.took.toFixed(1)} s, clipped samples: ${r.clipped}, records: ${r.info.records}, control changes: ${r.info.touches}`)
  if (r.info.log) for (const l of r.info.log) console.log('  ' + l)
  const win = 7.5 * r.info.sr
  const fmt = (t) => `${(t / 60) | 0}:${String(Math.floor(t % 60)).padStart(2, '0')}`
  for (let a = 0; a + win <= r.mono.length; a += win) console.log(row(`  ${fmt(a / r.info.sr)}`, measure(r.mono, r.info.sr, a, a + win)))
  picture(r.wav)
}

await browser.close()
await server.close()
