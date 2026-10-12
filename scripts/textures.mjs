// Every texture in the tomb, written into assets-src/blender/tex/ for assets-src/blender/build_tomb.py.
// Three kinds: small repeating grey "cloth" tiles that the model's vertex colours tint (the Pebble, the
// gear's plastic and metal); the pictures the image model drew (assets-src/art/raw), cut down to the size a 1996
// console would have given them; and everything with lettering or lights on it, drawn here pixel by
// pixel. The last two share one sheet, like a console's texture page. atlas.json says where each is.
// Also writes the title-screen pictures and the record sleeves the page itself shows (public/art).
// usage: node scripts/textures.mjs
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT = path.join(ROOT, 'assets-src/blender/tex')
fs.mkdirSync(OUT, { recursive: true })

function rng(seed) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}
const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255]

class Canvas {
  constructor(w, h, fill = [0, 0, 0, 0]) {
    this.w = w
    this.h = h
    this.d = new Uint8ClampedArray(w * h * 4)
    this.rect(0, 0, w, h, fill)
  }
  px(x, y, c) {
    x |= 0
    y |= 0
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    const i = (y * this.w + x) * 4
    const a = c[3] === undefined ? 255 : c[3]
    if (a === 255) {
      this.d[i] = c[0]
      this.d[i + 1] = c[1]
      this.d[i + 2] = c[2]
      this.d[i + 3] = 255
    } else {
      const t = a / 255
      this.d[i] = this.d[i] * (1 - t) + c[0] * t
      this.d[i + 1] = this.d[i + 1] * (1 - t) + c[1] * t
      this.d[i + 2] = this.d[i + 2] * (1 - t) + c[2] * t
      this.d[i + 3] = Math.max(this.d[i + 3], a)
    }
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c)
  }
  frame(x, y, w, h, c) {
    this.rect(x, y, w, 1, c)
    this.rect(x, y + h - 1, w, 1, c)
    this.rect(x, y, 1, h, c)
    this.rect(x + w - 1, y, 1, h, c)
  }
  line(x0, y0, x1, y1, c) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
    for (let i = 0; i <= n; i++) this.px(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c)
  }
  disc(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) this.px(x, y, c)
  }
  blit(src, dx, dy) {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const i = (y * src.w + x) * 4
        this.px(dx + x, dy + y, [src.d[i], src.d[i + 1], src.d[i + 2], src.d[i + 3]])
      }
  }
  // sprinkle: nudge every pixel a little lighter or darker, so flat areas read as printed, not as plastic
  grain(r, amount) {
    for (let i = 0; i < this.d.length; i += 4) {
      if (!this.d[i + 3]) continue
      const k = 1 + (r() - 0.5) * amount
      this.d[i] *= k
      this.d[i + 1] *= k
      this.d[i + 2] *= k
    }
    return this
  }
  save(file) {
    return sharp(Buffer.from(this.d.buffer), { raw: { width: this.w, height: this.h, channels: 4 } }).png().toFile(path.join(OUT, file))
  }
}

// ── two pixel fonts ───────────────────────────────────────────────────────
const F57 = {
  A: '.###.#...##...#######...##...##...#', B: '####.#...##...#####.#...##...#####.', C: '.###.#...##....#....#....#...#.###.', D: '####.#...##...##...##...##...#####.',
  E: '######....#....####.#....#....#####', F: '######....#....####.#....#....#....', G: '.###.#...##....#.####...##...#.###.', H: '#...##...##...#######...##...##...#',
  I: '.###...#....#....#....#....#...###.', J: '..###...#....#....#....#.#..#..##..', K: '#...##..#.#.#..##...#.#..#..#.#...#', L: '#....#....#....#....#....#....#####',
  M: '#...###.###.#.##.#.##...##...##...#', N: '#...###..##.#.##..###...##...##...#', O: '.###.#...##...##...##...##...#.###.', P: '####.#...##...#####.#....#....#....',
  Q: '.###.#...##...##...##.#.##..#..##.#', R: '####.#...##...#####.#.#..#..#.#...#', S: '.#####....#.....###.....#....#####.', T: '#####..#....#....#....#....#....#..',
  U: '#...##...##...##...##...##...#.###.', V: '#...##...##...##...##...#.#.#...#..', W: '#...##...##...##.#.##.#.###.###...#', X: '#...##...#.#.#...#...#.#.#...##...#',
  Y: '#...##...#.#.#...#....#....#....#..', Z: '#####....#...#...#...#...#....#####',
  0: '.###.#...##..###.#.###..##...#.###.', 1: '..#...##....#....#....#....#...###.', 2: '.###.#...#....#...#...#...#...#####', 3: '####.....#....#.###.....#....#####.',
  4: '...#...##..#.#.#..#.#####...#....#.', 5: '######....####.....#....##...#.###.', 6: '.###.#....#....####.#...##...#.###.', 7: '#####....#...#...#....#....#....#..',
  8: '.###.#...##...#.###.#...##...#.###.', 9: '.###.#...##...#.####....#....#.###.',
  $: '..#...#####.#...###...#.#####...#..', '/': '....#....#...#...#...#...#....#....', '~': '...........#...#.#.#...#...........', '.': '.........................##...##...',
  '+': '.......#....#..#####..#....#.......', '-': '...............#####...............', ':': '......##...##.........##...##......', ' ': '...................................',
  '!': '..#....#....#....#....#.........#..', '?': '.###.#...#....#...#...#.........#..', '¥': '#...#.#.#.#####..#..#####..#....#..', '>': '.#.....#.....#.....#...#...#...#...',
}
const F35 = {
  A: '.#.#.#####.##.#', B: '##.#.###.#.###.', C: '.###..#..#...##', D: '##.#.##.##.###.', E: '####..##.#..###', F: '####..##.#..#..', G: '.###..#.##.#.##', H: '#.##.#####.##.#',
  I: '###.#..#..#.###', J: '..#..#..##.#.#.', K: '#.##.###.#.##.#', L: '#..#..#..#..###', M: '#.########.##.#', N: '##.#.##.##.##.#', O: '.#.#.##.##.#.#.', P: '##.#.###.#..#..',
  Q: '.#.#.##.#.#..##', R: '##.#.###.#.##.#', S: '.###...#...###.', T: '###.#..#..#..#.', U: '#.##.##.##.####', V: '#.##.##.##.#.#.', W: '#.##.#######.##', X: '#.##.#.#.#.##.#',
  Y: '#.##.#.#..#..#.', Z: '###..#.#.#..###',
  0: '####.##.##.####', 1: '.#.##..#..#.###', 2: '##...#.#.#..###', 3: '##...#.#...###.', 4: '#.##.####..#..#', 5: '####..##...###.', 6: '.###..####.####', 7: '###..#.#..#..#.',
  8: '####.#####.####', 9: '####.####..###.', $: '.####..#..####.', '/': '..#..#.#.#..#..', '+': '....#.###.#....', '-': '......###......', '.': '.............#.', ':': '....#.....#....', ' ': '...............', '~': '....#.#.#......',
}
function text(cv, str, x, y, c, { font = F57, scale = 1, spacing = 1 } = {}) {
  const [gw, gh] = font === F57 ? [5, 7] : [3, 5]
  let cx = x
  for (const ch of String(str).toUpperCase()) {
    const g = font[ch] || font[' ']
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) if (g[j * gw + i] === '#') cv.rect(cx + i * scale, y + j * scale, scale, scale, c)
    cx += (gw + spacing) * scale
  }
  return cx - x - spacing * scale
}
const width = (str, { font = F57, scale = 1, spacing = 1 } = {}) => String(str).length * ((font === F57 ? 5 : 3) + spacing) * scale - spacing * scale
const centred = (cv, str, cx, y, c, o = {}) => text(cv, str, Math.round(cx - width(str, o) / 2), y, c, o)

// ── tiles: grey detail around white, 32px square, repeating ───────────────
const TILE = 32
function tile(name, paint) {
  const cv = new Canvas(TILE, TILE, [255, 255, 255, 255])
  paint(cv, rng(name.length * 7919 + name.charCodeAt(0) * 31))
  return cv.save(`tile_${name}.png`)
}
const grey = (v) => [v, v, v, 255]
const tiles = [
  tile('skin', (cv, r) => {
    // a river stone: mostly even, with scattered darker and lighter flecks
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) cv.px(x, y, grey(236 + Math.floor(r() * 14)))
    for (let i = 0; i < 26; i++) cv.px(r() * TILE, r() * TILE, grey(196 + Math.floor(r() * 22)))
    for (let i = 0; i < 16; i++) cv.px(r() * TILE, r() * TILE, grey(255))
    for (let i = 0; i < 5; i++) {
      const x = Math.floor(r() * TILE)
      const y = Math.floor(r() * TILE)
      cv.rect(x, y, 2, 1, grey(204))
      cv.px(x, y + 1, grey(214))
    }
  }),
  tile('fabric', (cv, r) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) cv.px(x, y, grey(((x >> 1) + (y >> 1)) % 2 ? 236 : 212 + Math.floor(r() * 10)))
    for (let y = 0; y < TILE; y += 2) for (let x = y % 4 ? 1 : 0; x < TILE; x += 4) cv.px(x, y, grey(196))
  }),
  tile('leather', (cv, r) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) cv.px(x, y, grey(222 + Math.floor(r() * 26)))
    for (let i = 0; i < 36; i++) cv.px(r() * TILE, r() * TILE, grey(184 + Math.floor(r() * 20)))
    for (let i = 0; i < 4; i++) {
      let x = Math.floor(r() * TILE)
      let y = Math.floor(r() * TILE)
      for (let k = 0; k < 6; k++) {
        cv.px(x % TILE, y % TILE, grey(190))
        x += r() < 0.5 ? 1 : 0
        y += 1
      }
    }
  }),
  tile('metal', (cv, r) => {
    for (let y = 0; y < TILE; y++) {
      const row = 224 + Math.floor(r() * 26)
      for (let x = 0; x < TILE; x++) cv.px(x, y, grey(row + Math.floor(r() * 8)))
    }
    for (let i = 0; i < 7; i++) cv.rect(Math.floor(r() * TILE), Math.floor(r() * TILE), 3 + Math.floor(r() * 5), 1, grey(255))
  }),
  tile('plastic', (cv, r) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) cv.px(x, y, grey(240 + Math.floor(r() * 10)))
    for (let i = 0; i < 10; i++) cv.px(r() * TILE, r() * TILE, grey(224))
  }),
  tile('paper', (cv, r) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) cv.px(x, y, grey(238 + Math.floor(r() * 14)))
    for (let i = 0; i < 12; i++) cv.rect(Math.floor(r() * TILE), Math.floor(r() * TILE), 2, 1, grey(222))
  }),
  tile('wood', (cv, r) => {
    for (let x = 0; x < TILE; x++) {
      const col = 222 + Math.floor(r() * 26)
      for (let y = 0; y < TILE; y++) cv.px(x, y, grey(col + Math.floor(r() * 8)))
    }
    for (let i = 0; i < 4; i++) cv.rect(Math.floor(r() * TILE), 0, 1, TILE, grey(190))
  }),
  tile('rubber', (cv, r) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) cv.px(x, y, grey(228 + Math.floor(r() * 22)))
    for (let y = 3; y < TILE; y += 8) cv.rect(0, y, TILE, 1, grey(204))
  }),
]

// ── the sheet: pictures and labels ────────────────────────────────────────
const LAYOUT = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/dj/layout.json'), 'utf8'))
const RAW = path.join(ROOT, 'assets-src/art/raw')
const PUB = path.join(ROOT, 'public/art')
fs.mkdirSync(PUB, { recursive: true })
const SLEEVES = ['medipack', 'swandive', 'secret', 'tank', 'block', 'lever', 'crystal', 'butler', 'valley', 'boulder']
const A = (c, a = 255) => [...c, a]
const art = []
function label(name, w, h, paint) {
  const cv = new Canvas(w, h, [0, 0, 0, 0])
  paint(cv, rng(name.length * 131 + w * 17 + h))
  art.push({ name, cv })
  return cv
}
// one of the image model's pictures, cut down to w x h. `crop` is [left, top, width, height] as fractions.
async function picture(name, file, w, h, { crop, sat = 1.1 } = {}) {
  let img = sharp(path.join(RAW, file + '.png')).removeAlpha()
  if (crop) {
    const m = await img.metadata()
    img = img.extract({ left: Math.round(crop[0] * m.width), top: Math.round(crop[1] * m.height), width: Math.round(crop[2] * m.width), height: Math.round(crop[3] * m.height) })
  }
  const data = await img.resize(w, h, { fit: 'fill', kernel: 'lanczos3' }).sharpen({ sigma: 0.7 }).modulate({ saturation: sat }).ensureAlpha().raw().toBuffer()
  const cv = new Canvas(w, h)
  cv.d.set(data)
  art.push({ name, cv })
  return cv
}

await picture('wall_block', 'wall-block', 64, 64)
await picture('wall_cracked', 'wall-cracked', 64, 64)
await picture('wall_glyph', 'wall-glyph', 128, 128)
await picture('floor', 'floor', 64, 64)
await picture('sand', 'sand', 64, 64)
await picture('pillar', 'pillar', 96, 144)
await picture('sarcophagus', 'sarcophagus', 192, 72, { crop: [0, 0.2, 1, 0.58] })
await picture('gold', 'gold', 32, 32)
await picture('crate', 'crate', 64, 64)
await picture('speaker', 'speaker', 64, 96)
await picture('door', 'door', 96, 144)
await picture('bandage', 'bandage', 32, 32)
await picture('flyer', 'flyer', 48, 72, { sat: 1.2 })
await picture('mural', 'mural', 240, 160)
for (const id of SLEEVES) await picture(`sleeve_${id}`, `sleeve-${id}`, 32, 32, { sat: 1.2 })

const C = {
  panel: hex(0x22242b), strip: hex(0x2b2e37), edge: hex(0x14151a), line: hex(0x3d404b), ink: hex(0x0c0c10), print: hex(0xc9ccd6), dim: hex(0x7d808c),
  white: hex(0xf4f1e8), silver: hex(0xb4b7be), silverDark: hex(0x8c8f97), red: hex(0xd8382e), green: hex(0x4be06a), amber: hex(0xf2b33a), teal: hex(0x35c4b5), gold: hex(0xe0b04a),
}
const PXM = 200 // the gear is printed at 200 pixels to the metre

// the mixer's faceplate, as the DJ sees it from above: their left is the left, far from them is the top
{
  const M = LAYOUT.mixer
  const W = Math.round(M.w * PXM)
  const H = Math.round(M.d * PXM)
  const X = (x) => Math.round((M.w / 2 - x) * PXM)
  const Y = (z) => Math.round((M.d / 2 - z) * PXM)
  const small = { font: F35 }
  label('mixer_face', W, H, (cv, r) => {
    cv.rect(0, 0, W, H, A(C.panel))
    cv.frame(0, 0, W, H, A(C.line))
    // a scale of dots round a knob, from seven o'clock to five o'clock
    const dial = (x, y, rr, mark = C.print) => {
      for (let k = 0; k <= 10; k++) {
        const a = ((-135 + 27 * k) * Math.PI) / 180
        cv.px(Math.round(x + Math.sin(a) * rr - 0.5), Math.round(y - Math.cos(a) * rr - 0.5), A(k === 5 ? C.white : k === 0 || k === 10 ? mark : C.dim))
      }
      cv.disc(x, y, rr - 2, rr - 2, A(C.ink))
    }
    for (const ch of ['A', 'B']) {
      const x = X(LAYOUT.strip[ch])
      const out = ch === 'A' ? -1 : 1 // the side of the strip that faces away from the middle
      cv.rect(x - 17, 3, 35, H - 6, A(C.strip))
      cv.frame(x - 17, 3, 35, H - 6, A(C.edge))
      centred(cv, 'TRIM', x + 1, 1, A(C.print), small)
      for (const [row, z] of Object.entries(LAYOUT.rows)) {
        const y = Y(z)
        const big = row === 'filter'
        dial(x, y, Math.round((big ? LAYOUT.knob.big : LAYOUT.knob.r) * PXM) + 2, big ? C.teal : C.print)
        const name = { hi: 'HI', mid: 'MID', low: 'LOW', filter: 'FLT' }[row]
        if (name) text(cv, name, out < 0 ? x - 16 : x + 17 - width(name, small), y + (big ? 9 : 6), A(big ? C.teal : C.dim), small)
      }
      // the fader's slot and its scale
      const y0 = Y(LAYOUT.fader.z1)
      const y1 = Y(LAYOUT.fader.z0)
      cv.rect(x - 1, y0 - 2, 3, y1 - y0 + 5, A(C.ink))
      for (let k = 0; k <= 10; k++) {
        const y = Math.round(y0 + ((y1 - y0) * k) / 10)
        cv.rect(x - (k % 5 ? 5 : 7), y, k % 5 ? 2 : 4, 1, A(k === 0 ? C.white : C.dim))
        cv.rect(x + 4, y, k % 5 ? 2 : 4, 1, A(k === 0 ? C.white : C.dim))
      }
      text(cv, ch, out < 0 ? x - 15 : x + 13, y1 - 3, A(C.amber))
      // level meter backing
      const mx = X(Math.sign(LAYOUT.strip[ch]) * LAYOUT.meter.ch)
      cv.rect(mx - 3, Y(LAYOUT.meter.z1) - 2, 6, Y(LAYOUT.meter.z0) - Y(LAYOUT.meter.z1) + 4, A(C.ink))
      // cue button
      const cx = X(Math.sign(LAYOUT.strip[ch]) * LAYOUT.cue.x)
      centred(cv, 'CUE', cx + 1, Y(LAYOUT.cue.z) - 11, A(C.dim), small)
      cv.rect(cx - 5, Y(LAYOUT.cue.z) - 5, 10, 10, A(C.ink))
    }
    const mid = X(0)
    centred(cv, 'MASTER', mid + 1, 1, A(C.print), small)
    dial(X(LAYOUT.master.x), Y(LAYOUT.master.z), Math.round(LAYOUT.knob.r * PXM) + 2, C.red)
    cv.rect(mid - 8, Y(LAYOUT.meter.z1) - 2, 16, Y(LAYOUT.meter.z0) - Y(LAYOUT.meter.z1) + 4, A(C.ink))
    for (const [name, at] of [['ECHO', LAYOUT.echo], ['VERB', LAYOUT.reverb]]) {
      dial(X(at.x), Y(at.z), Math.round(LAYOUT.knob.r * PXM) + 2, C.amber)
      centred(cv, name, X(at.x) + 1, Y(at.z) - 14, A(C.amber), small)
    }
    // effects switch: A, both, B
    const sy = Y(LAYOUT.fxsel.z)
    centred(cv, 'FX', mid + 1, sy + 4, A(C.amber), small)
    cv.rect(mid - 9, sy - 1, 19, 3, A(C.ink))
    text(cv, 'A', mid - 15, sy - 2, A(C.dim), small)
    text(cv, 'B', mid + 13, sy - 2, A(C.dim), small)
    // crossfader
    const xy = Y(LAYOUT.xfader.z)
    const t = Math.round(LAYOUT.xfader.travel * PXM)
    cv.rect(mid - t - 3, xy - 1, t * 2 + 7, 3, A(C.ink))
    for (let k = -2; k <= 2; k++) cv.rect(mid + Math.round((k * t) / 2), xy + 3, 1, k ? 2 : 3, A(k ? C.dim : C.white))
    centred(cv, 'MONOLITH', mid + 1, H - 6, A(C.gold), small)
    cv.grain(r, 0.05)
  })
}

// a turntable from above, the same way round
{
  const D = LAYOUT.deck
  const W = Math.round(D.w * PXM)
  const H = Math.round(D.d * PXM)
  const X = (x) => Math.round((D.w / 2 - x) * PXM)
  const Y = (z) => Math.round((D.d / 2 - z) * PXM)
  const small = { font: F35 }
  label('deck_top', W, H, (cv, r) => {
    for (let y = 0; y < H; y++) {
      const row = 176 + Math.floor(r() * 12)
      for (let x = 0; x < W; x++) cv.px(x, y, [row + Math.floor(r() * 6), row + 3 + Math.floor(r() * 6), row + 10 + Math.floor(r() * 6), 255])
    }
    cv.frame(0, 0, W, H, A(C.silverDark))
    cv.frame(1, 1, W - 2, H - 2, A(hex(0xd6d9df)))
    // the well the platter turns in
    const px = X(LAYOUT.platter.x)
    const py = Y(LAYOUT.platter.z)
    const pr = Math.round(LAYOUT.platter.r * PXM)
    cv.disc(px, py, pr + 3, pr + 3, A(C.silverDark))
    cv.disc(px, py, pr + 2, pr + 2, A(C.ink))
    // pitch: a long slot with the scale beside it; towards the DJ is faster
    const sx = X(LAYOUT.pitch.x)
    const sy = Y(LAYOUT.pitch.z)
    const t = Math.round(LAYOUT.pitch.travel * PXM)
    cv.rect(sx - 6, sy - t - 6, 13, t * 2 + 13, A(C.silverDark))
    cv.rect(sx - 1, sy - t - 3, 3, t * 2 + 7, A(C.ink))
    for (let k = -8; k <= 8; k += 2) {
      const y = sy + Math.round((k * t) / 8)
      cv.rect(sx - 5, y, k % 4 ? 2 : 3, 1, A(k ? C.ink : C.green))
      cv.rect(sx + 3, y, k % 4 ? 2 : 3, 1, A(k ? C.ink : C.green))
    }
    centred(cv, 'PITCH', sx - 2, sy - t - 13, A(C.ink), small)
    text(cv, '-', sx + 8, sy - t - 2, A(C.ink), small)
    text(cv, '+', sx + 8, sy + t - 3, A(C.ink), small)
    // tonearm base, and the weight for 45s in the far corner
    cv.disc(X(LAYOUT.tonearm.x), Y(LAYOUT.tonearm.z), 11, 11, A(C.silverDark))
    cv.disc(X(LAYOUT.tonearm.x), Y(LAYOUT.tonearm.z), 9, 9, A(hex(0x2a2c33)))
    cv.disc(X(0.33), Y(0.25), 7, 7, A(hex(0xdadde3)))
    cv.disc(X(0.33), Y(0.25), 2, 2, A(C.ink))
    // start/stop, 33 and 45, the power dial with its red lamp
    const bx = X(LAYOUT.start.x)
    const by = Y(LAYOUT.start.z)
    cv.rect(bx - 10, by - 10, 20, 20, A(C.ink))
    text(cv, 'START', bx - 9, by - 17, A(C.ink), small)
    for (const [n, dx] of [['33', 0.11], ['45', 0.18]]) {
      const x = X(LAYOUT.start.x - dx)
      cv.rect(x - 5, by - 1, 10, 9, A(C.ink))
      centred(cv, n, x + 1, by - 8, A(C.ink), small)
    }
    cv.disc(X(0.33), Y(-0.12), 8, 8, A(C.silverDark))
    cv.disc(X(0.33), Y(-0.12), 6, 6, A(hex(0x2a2c33)))
    cv.rect(X(0.33) + 8, Y(-0.12) - 2, 3, 4, A(C.red))
    centred(cv, 'QUARTZ SL-1996', X(-0.05), H - 8, A(C.silverDark), small)
  })
}

// a record: grooves, the gaps between tracks, the run-out. The label is another picture, laid on top.
label('vinyl', 64, 64, (cv, r) => {
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const d = Math.hypot(x + 0.5 - 32, y + 0.5 - 32)
      if (d > 32) continue
      const gap = Math.abs(d - 17) < 0.6 || Math.abs(d - 23.5) < 0.6 || Math.abs(d - 28) < 0.5
      let v = gap ? 52 : d > 30.5 ? 44 : d < 12 ? 30 : 17 + (Math.floor(d * 2) % 2) * 9 + Math.floor(r() * 5)
      // a scuff, so that it can be seen to turn
      if (Math.abs(Math.atan2(y - 32, x - 32) - 0.6) < 0.05 && d > 14 && d < 22) v += 34
      cv.px(x, y, [v, v, v + 3, 255])
    }
})
// knob caps from above: a pointer line that points away from the DJ at noon
for (const [name, cap, rim] of [['knob_dark', 0x33353d, 0x15161a], ['knob_teal', 0x2aa79a, 0x12534d], ['knob_red', 0xb5372f, 0x561712], ['knob_amber', 0xd09a2c, 0x62440c]])
  label(name, 16, 16, (cv) => {
    cv.disc(8, 8, 8, 8, A(hex(rim)))
    cv.disc(8, 8, 6.5, 6.5, A(hex(cap)))
    cv.rect(7, 0, 2, 8, A(C.white))
  })
// a woofer, straight on
label('cone', 32, 32, (cv, r) => {
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const d = Math.hypot(x + 0.5 - 16, y + 0.5 - 16) / 16
      if (d > 1) continue
      const v = d > 0.86 ? 22 : d < 0.3 ? 30 + (d < 0.16 ? 26 : 0) : 150 - (1 - d) * 70 + Math.floor(r() * 12) - (Math.floor(d * 22) % 3 === 0 ? 14 : 0)
      cv.px(x, y, [v, v, v, 255])
    }
})
// fire: four frames side by side, each 16 x 32
label('flame', 64, 32, (cv, r) => {
  for (let f = 0; f < 4; f++) {
    const lean = (r() - 0.5) * 5
    const tall = 22 + r() * 9
    for (let y = 0; y < 32; y++) {
      const h = (31 - y) / tall // 0 at the base, 1 at the tip
      if (h > 1) continue
      const half = 6.5 * Math.sin(Math.PI * Math.min(1, h * 0.55 + 0.45)) ** 1.4 * (1 - h * 0.25) + (r() - 0.5) * 1.6
      const cx = 8 + lean * h * h + Math.sin(h * 7 + f * 1.7) * 1.2
      for (let x = 0; x < 16; x++) {
        const k = Math.abs(x + 0.5 - cx) / Math.max(half, 0.01)
        if (k > 1) continue
        const heat = (1 - k) * (1 - h * 0.85)
        const c = heat > 0.55 ? [255, 244, 190] : heat > 0.32 ? [255, 196, 64] : heat > 0.14 ? [244, 122, 30] : [196, 52, 22]
        cv.px(f * 16 + x, y, [...c, 255])
      }
    }
  }
})
// a small medipack, drawn as the flat sprite it always was
label('medipack', 24, 20, (cv) => {
  cv.rect(2, 5, 20, 14, A(hex(0xe9e4d6)))
  cv.rect(2, 16, 20, 3, A(hex(0xbcb6a6)))
  cv.frame(1, 4, 22, 16, A(hex(0x3a342c)))
  cv.rect(7, 1, 10, 4, A(hex(0x8b2a22)))
  cv.frame(6, 0, 12, 5, A(hex(0x3a342c)))
  cv.rect(10, 7, 4, 10, A(hex(0xd1322a)))
  cv.rect(7, 10, 10, 4, A(hex(0xd1322a)))
})
// the cloth hung on the front of the booth
label('banner', 96, 20, (cv, r) => {
  cv.rect(0, 0, 96, 20, A(hex(0x16131c)))
  cv.frame(1, 1, 94, 18, A(C.gold))
  centred(cv, 'DJ MONOLITH', 48, 6, A(hex(0xf2c85a)))
  cv.rect(15, 14, 66, 1, A(hex(0xa5452b)))
  cv.grain(r, 0.1)
})
label('white', 8, 8, (cv) => cv.rect(0, 0, 8, 8, [255, 255, 255, 255]))

// shelf-pack everything into one sheet, with a gutter, and bleed each picture's own edge into the gutter
const SW = 1024
const SH = 512
const sheet = new Canvas(SW, SH, [0, 0, 0, 0])
const labels = {}
let x = 2
let y = 2
let rowH = 0
for (const { name, cv } of art.sort((a, b) => b.cv.h - a.cv.h || b.cv.w - a.cv.w)) {
  if (x + cv.w + 2 > SW) {
    x = 2
    y += rowH + 4
    rowH = 0
  }
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) {
    // (only where the picture itself is solid: a sprite's transparent edge stays transparent)
    if (!['flame', 'medipack'].includes(name)) sheet.blit(cv, x + dx, y + dy)
  }
  for (let j = 0; j < cv.h; j++) for (let i = 0; i < cv.w; i++) sheet.d.set(cv.d.subarray((j * cv.w + i) * 4, (j * cv.w + i) * 4 + 4), ((y + j) * SW + x + i) * 4)
  labels[name] = { x, y, w: cv.w, h: cv.h }
  x += cv.w + 4
  rowH = Math.max(rowH, cv.h)
}
if (y + rowH > SH) throw new Error('the sheet is full')
await Promise.all([...tiles, sheet.save('sheet.png')])
fs.writeFileSync(path.join(OUT, 'atlas.json'), JSON.stringify({ w: SW, h: SH, tile: TILE, labels }, null, 1))
fs.writeFileSync(path.join(ROOT, 'src/webgl/atlas.json'), JSON.stringify({ w: SW, h: SH, labels }))
console.log(`tiles: ${tiles.length}, pictures and labels: ${Object.keys(labels).length}, sheet used down to y=${y + rowH} of ${SH}`)

// ── what the page itself shows ────────────────────────────────────────────
// fifteen-bit colour with an ordered dither, the way the console would have stored a still
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
function console15(data, w, h, channels) {
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const o = (j * w + i) * channels
      const t = (BAYER[(j & 3) * 4 + (i & 3)] + 0.5) / 16
      for (let k = 0; k < 3; k++) data[o + k] = Math.min(255, Math.floor((data[o + k] / 255) * 31 + t) * (255 / 31))
      if (channels === 4) data[o + 3] = data[o + 3] > 110 ? 255 : 0
    }
  return data
}
async function still(input, file, w, h, { fit = 'cover', position = 'centre' } = {}) {
  const { data, info } = await input.resize(w, h, { fit, position, kernel: 'lanczos3' }).sharpen({ sigma: 0.6 }).raw().toBuffer({ resolveWithObject: true })
  await sharp(console15(data, info.width, info.height, info.channels), { raw: { width: info.width, height: info.height, channels: info.channels } }).png({ compressionLevel: 9 }).toFile(path.join(PUB, file))
  return info
}
await still(sharp(path.join(RAW, 'keyart.png')).removeAlpha(), 'title.png', 480, 320)
const logo = await still(sharp(await sharp(path.join(RAW, 'logo.png')).trim().toBuffer()), 'logo.png', 448, null, { fit: 'inside' })
for (const id of SLEEVES) await still(sharp(path.join(RAW, `sleeve-${id}.png`)).removeAlpha(), `sleeve-${id}.png`, 64, 64)
await still(sharp(path.join(RAW, 'flyer.png')).removeAlpha(), 'flyer.png', 160, 240)
console.log(`title 480x320, logo ${logo.width}x${logo.height}, ${SLEEVES.length} sleeves -> public/art`)

// ── the pointer: his own hand ─────────────────────────────────────────────
// Three drawings (open, about to pinch, closed), cut down to 32 pixels square, which is as large as a
// browser will let a pointer be everywhere on the page, and the same again at twice the size for
// sharp screens. They are cut with one frame, so the hand stays where it is as it opens and closes.
// Writes the pictures to public/art and the rules that use them to src/cursor.css.
{
  const HANDS = ['open', 'point', 'grab']
  const SIZE = 32
  const raws = []
  const box = { x0: Infinity, y0: Infinity, x1: 0, y1: 0 }
  for (const name of HANDS) {
    const { data, info } = await sharp(path.join(RAW, `cursor-${name}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    for (let y = 0; y < info.height; y++)
      for (let x = 0; x < info.width; x++)
        if (data[(y * info.width + x) * 4 + 3] > 128) {
          box.x0 = Math.min(box.x0, x)
          box.y0 = Math.min(box.y0, y)
          box.x1 = Math.max(box.x1, x)
          box.y1 = Math.max(box.y1, y)
        }
    raws.push({ name, data, info })
  }
  const side = Math.max(box.x1 - box.x0, box.y1 - box.y0) + 1
  const INK = [11, 8, 16]
  const hands = {}
  for (const { name, data, info } of raws) {
    // the same square out of each, from the top left corner of all three together
    const w = Math.min(side, info.width - box.x0)
    const h = Math.min(side, info.height - box.y0)
    const cut = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .extract({ left: box.x0, top: box.y0, width: w, height: h })
      .extend({ right: side - w, bottom: side - h, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .resize(SIZE, SIZE, { kernel: 'lanczos3' })
      .raw()
      .toBuffer()
    const px = new Uint8ClampedArray(cut)
    const solid = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE && px[(y * SIZE + x) * 4 + 3] >= 128
    const out = new Uint8ClampedArray(SIZE * SIZE * 4)
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) {
        if (!solid(x, y)) continue
        const o = (y * SIZE + x) * 4
        // a hard edge, a dark line all the way round it, and the console's fifteen-bit colour inside
        const edge = !solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1)
        for (let k = 0; k < 3; k++) out[o + k] = edge ? INK[k] : Math.round((px[o + k] / 255) * 31) * (255 / 31)
        out[o + 3] = 255
      }
    hands[name] = out
    const img = () => sharp(Buffer.from(out.buffer), { raw: { width: SIZE, height: SIZE, channels: 4 } })
    await img().png({ compressionLevel: 9 }).toFile(path.join(PUB, `cursor-${name}.png`))
    await img().resize(SIZE * 2, SIZE * 2, { kernel: 'nearest' }).png({ compressionLevel: 9 }).toFile(path.join(PUB, `cursor-${name}-2x.png`))
  }
  // the point of the pointer: the tip of the open hand, the part of it nearest the top left corner
  let hot = [0, 0]
  let best = Infinity
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (hands.open[(y * SIZE + x) * 4 + 3] && x + y < best) [best, hot] = [x + y, [x + 1, y + 1]]
  const rule = (selector, name, fallback) => {
    const at = `${hot[0]} ${hot[1]}, ${fallback}`
    const one = `url(/art/cursor-${name}.png)`
    const set = (fn) => `${fn}(${one} 1x, url(/art/cursor-${name}-2x.png) 2x)`
    // (the question put to the browser is only whether it can read such a line, so no real picture is named
    // in it: Vite rewrites the addresses in the rules for wherever the page is served from, but not in a question)
    const can = (fn) => `(cursor: ${fn}(url(a.png) 1x, url(b.png) 2x) 0 0, auto)`
    return [
      `${selector} {\n  cursor: ${one} ${at};\n}`,
      // (on a sharp screen, the same picture at twice the size: said separately, so that a browser which does not know how keeps the line above)
      `@supports ${can('image-set')} {\n  ${selector} {\n    cursor: ${set('image-set')} ${at};\n  }\n}`,
      `@supports ${can('-webkit-image-set')} and (not ${can('image-set')}) {\n  ${selector} {\n    cursor: ${set('-webkit-image-set')} ${at};\n  }\n}`,
    ].join('\n')
  }
  const css = [
    '/* Written by scripts/textures.mjs. The pointer is his own hand, drawn by the image model (assets-src/art/raw/cursor-*.png):',
    '   open as it moves about, about to pinch over anything that can be pressed or turned, closed while it holds. */',
    rule('html', 'open', 'auto'),
    rule('button,\n#canvas.over,\n.wake', 'point', 'pointer'),
    rule('#canvas.held,\nbutton:active', 'grab', 'grabbing'),
    '',
  ].join('\n')
  fs.writeFileSync(path.join(ROOT, 'src/cursor.css'), css)
  console.log(`pointer: 3 hands at ${SIZE} and ${SIZE * 2} pixels, its point at ${hot.join(',')} -> public/art, src/cursor.css`)
}
