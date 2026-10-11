// The record box. Nothing here is a recording: each record is a small program that knows its style,
// its key and its arrangement, and writes itself out one sixteenth-note at a time when a deck asks.
// The same record (same seed) always plays the same notes; a second pressing (another seed) does not.
import * as V from './voices.js'

// ── arithmetic ──────────────────────────────────────────────────────────────────────────────────
export function rnd(...xs) {
  let h = 0x9e3779b9
  for (const x of xs) {
    h ^= Math.imul((x | 0) + 0x7f4a7c15, 0x85ebca6b)
    h = Math.imul(h ^ (h >>> 15), 0xc2b2ae35)
    h ^= h >>> 13
  }
  return (h >>> 0) / 4294967296
}
const pick = (r, list) => list[Math.min(list.length - 1, Math.floor(r * list.length))]
const clamp = (x, a, b) => Math.max(a, Math.min(b, x))
const lerp = (a, b, t) => a + (b - a) * t
const xp = (a, b, t) => a * (b / a) ** clamp(t, 0, 1) // a glide that sounds even, for frequencies
const P = (s) => Array.from(s.replace(/[\s|]/g, ''), (ch) => ({ X: 1.25, x: 1, o: 0.6, '-': 0.3 })[ch] || 0)

// chords, as semitones above the tonic of a minor key
const CH = {
  i: [0, 3, 7],
  i7: [0, 3, 7, 10],
  i9: [0, 3, 7, 10, 14],
  iv: [5, 8, 12],
  iv7: [5, 8, 12, 15],
  iv9: [5, 8, 12, 15, 19],
  IV7: [5, 9, 12, 15],
  v: [7, 10, 14],
  v7: [7, 10, 14, 17],
  V7: [7, 11, 14, 17],
  VI: [8, 12, 15],
  VI7: [8, 12, 15, 19],
  VII: [10, 14, 17],
  VII6: [10, 14, 17, 19],
  VII7: [10, 14, 17, 20],
  III: [3, 7, 10],
  III7: [3, 7, 10, 14],
}
const PENTA = [0, 3, 5, 7, 10]
const penta = (base, i) => base + 12 * Math.floor(i / 5) + PENTA[((i % 5) + 5) % 5]

// the notes of a chord gathered round `centre`, closest position
function voice(ch, key, centre = 62) {
  const pc = key % 12
  const out = new Set()
  for (const o of ch) {
    let n = pc + (o % 12)
    while (n < centre - 6) n += 12
    while (n >= centre + 6) n -= 12
    out.add(n)
  }
  return [...out].sort((a, b) => a - b)
}
// a bass note for a chord root, kept where a sub can speak
function low(key, off) {
  let n = key + off
  while (n > key + 7) n -= 12
  while (n < key - 4) n += 12
  return n
}
// 'r' root, 'o' the octave, 'f' the fifth, 's' the seventh underneath
function bassTone(key, ch, tone) {
  const r = low(key, ch[0])
  if (tone === 'o') return r + 12
  if (tone === 'f') return r + (ch[2] - ch[0])
  if (tone === 's') return ch.length > 3 ? r + (ch[3] - ch[0]) - 12 : r + (ch[2] - ch[0]) - 12
  return r
}
// a little tune: a walk up and down the pentatonic on the given steps
function motif(seed, k, steps, start = 6, lo = 3, hi = 11) {
  let i = start
  return steps.map((s, n) => {
    const r = rnd(seed, k, n)
    i += r < 0.28 ? -1 : r < 0.5 ? 1 : r < 0.66 ? -2 : r < 0.82 ? 2 : 0
    i = clamp(i, lo, hi)
    return { s, i }
  })
}

// a section: which layers are on. "8:clap" comes in at its eighth bar, "-8:bass" leaves at it.
function sect(name, bars, spec, energy) {
  const on = {}
  for (const tok of spec.split(/\s+/)) {
    if (!tok) continue
    const m = tok.match(/^(-?\d+):(.+)$/)
    if (m) on[m[2]] = +m[1]
    else on[tok] = 0
  }
  return { name, bars, on, energy }
}

// ── things most dance records do ────────────────────────────────────────────────────────────────
function four(c, o) {
  if (c.s % 4) return
  // the last beat before a change is left empty, so the change lands
  if (c.last && c.s === 12 && c.has('gap')) return
  V.kick(c.ctx, c.bus.kick, c.t, o)
  c.deck.pump(c.t)
}
function hats(c, vels, o) {
  const v = vels[c.s % vels.length]
  if (v > 0) V.hat(c.ctx, c.bus.hats, c.t, { vel: v * (0.82 + 0.36 * c.r(1)), p: c.s % 2 ? 0.25 : -0.15, ...o })
}
function offhat(c, vel = 0.55, decay = 0.2) {
  if (c.s % 4 === 2) V.hat(c.ctx, c.bus.hats, c.t, { vel, decay, tone: 7000, metal: 0.75, p: 0.1 })
}
function backbeat(c, clap = 0.8, snare = 0, o) {
  if (c.s !== 4 && c.s !== 12) return
  if (clap) V.clap(c.ctx, c.bus.drums, c.t, { vel: clap, ...o })
  if (snare) V.snare(c.ctx, c.bus.drums, c.t, { vel: snare })
}
function shake(c, lvl = 0.3) {
  V.shaker(c.ctx, c.bus.hats, c.t, { vel: lvl * [0.9, 0.45, 0.7, 0.5][c.s % 4], p: -0.3 })
}
function rideOn(c, lvl = 0.2) {
  if (c.s % 2 === 0) V.ride(c.ctx, c.bus.hats, c.t, { vel: lvl * (c.s % 4 === 0 ? 1 : 0.7), decay: 0.4 })
}
// a riser over the last `bars` bars of the section and a snare roll that tightens
function build(c, bars, { vel = 0.45, roll = 0.6, f = 185 } = {}) {
  const left = c.sec.end - c.bar
  if (left === bars && c.s === 0) V.riser(c.ctx, c.bus.fx, c.t, { dur: bars * 16 * c.dur, vel })
  const n = Math.min(bars, 4)
  if (roll && left <= n) {
    const q = 1 - (left * 16 - c.s) / (n * 16)
    const every = q < 0.25 ? 4 : q < 0.55 ? 2 : 1
    if (c.s % every === 0) V.snare(c.ctx, c.bus.drums, c.t, { vel: roll * (0.3 + 0.7 * q), f: f + 110 * q, decay: 0.11, snap: 0.9 })
    if (q > 0.88) V.snare(c.ctx, c.bus.drums, c.t + c.dur / 2, { vel: roll * 0.8 * q, f: f + 130, decay: 0.08 })
  }
}
// what happens on the first beat after a build
function drop(c, vel = 0.55) {
  if (c.s || c.sb) return
  V.crash(c.ctx, c.bus.fx, c.t, { vel })
  V.fall(c.ctx, c.bus.fx, c.t, { vel: vel * 0.5, boom: 0.5 })
}
function crashOn(c, vel = 0.4) {
  if (c.s === 0 && c.sb === 0) V.crash(c.ctx, c.bus.fx, c.t, { vel })
}
// four toms down the stairs at the end of every eighth bar
function tomFill(c, vel = 0.4) {
  if (c.bar % 8 === 7 && c.s >= 12) V.tom(c.ctx, c.bus.drums, c.t, { f: 220 - (c.s - 12) * 28, vel, p: (c.s - 13.5) * 0.3 })
}

const STYLES = {}

// ── deep house: electric piano, a round bass, nothing in a hurry ────────────────────────────────
STYLES.deep = (d) => {
  const R = (k) => rnd(d.seed, 101, k)
  const prog = pick(R(1), [['i9', 'i9', 'VI7', 'VII6'], ['i9', 'iv9', 'i9', 'v7'], ['VI7', 'VII6', 'i9', 'i9'], ['iv9', 'v7', 'i9', 'VI7']]).map((n) => CH[n])
  const hits = pick(R(2), [[3, 6, 11, 14], [2, 7, 10, 15], [0, 3, 10, 13]])
  const bassP = pick(R(3), [
    [[0, 'r', 2.5], [3, 'r', 1], [6, 'o', 1.2], [10, 'r', 1.6], [13, 's', 1.6]],
    [[0, 'r', 1.6], [2, 'r', 1], [5, 'o', 1], [8, 'r', 2], [11, 'f', 1.2], [14, 's', 1.4]],
    [[0, 'r', 3], [6, 'f', 1.2], [8, 'r', 1.5], [11, 'o', 1], [14, 'r', 1.4]],
  ])
  const hook = [motif(d.seed, 7, [2, 5, 8, 13], 6), motif(d.seed, 8, [3, 6, 11], 7)]
  const tune = [0, 1, 0, 2].map((k, b) => motif(d.seed, 20 + k, b % 2 ? [2, 6, 8, 11, 14] : [0, 3, 6, 10], 8, 5, 13))
  const vowels = ['a', 'o', 'a', 'e', 'o', 'a', 'u']
  return {
    swing: 0.14,
    mix: { dly: { lead: 0.32, chords: 0.1 }, rev: { chords: 0.14, lead: 0.3, pad: 0.3, drums: 0.05 }, duck: { chords: 0.35 } },
    sections: [
      sect('intro', 16, 'kick ch shaker 8:clap 8:oh 8:rim 12:pad', 0.4),
      sect('a1', 16, 'kick ch shaker clap oh rim bass chords crash gap', 0.6),
      sect('a2', 16, 'kick ch shaker clap oh rim conga bass chords pad vox gap', 0.75),
      sect('break', 8, 'chords pad harp shaker build', 0.3),
      sect('b1', 16, 'kick ch shaker clap oh rim conga bass chords pad lead ride drop', 1),
      sect('b2', 16, 'kick ch shaker clap oh rim conga bass chords pad lead vox ride crash', 1),
      sect('outro', 16, 'kick ch shaker clap oh rim -8:bass -8:conga crash', 0.5),
    ],
    play(c) {
      const ch = prog[c.bar % 4]
      if (c.has('kick')) four(c, { f: 49, punch: 3.1, decay: 0.36, click: 0.22 })
      if (c.has('clap')) backbeat(c, 0.75)
      if (c.has('ch')) hats(c, c.has('oh') ? [0.5, 0.2, 0, 0.26] : [0.5, 0.2, 0.42, 0.24])
      if (c.has('oh')) offhat(c, 0.5, 0.2)
      if (c.has('shaker')) shake(c, 0.26)
      if (c.has('ride')) rideOn(c, 0.16)
      if (c.has('rim') && (c.bar % 2 ? [2, 7, 13] : [7, 10, 15]).includes(c.s)) V.rim(c.ctx, c.bus.drums, c.t, { vel: 0.4, p: 0.35 })
      if (c.has('conga')) {
        const hit = (c.bar % 2 ? { 3: 220, 6: 300, 11: 300, 14: 220 } : { 3: 220, 6: 300, 9: 220 })[c.s]
        if (hit) V.tom(c.ctx, c.bus.drums, c.t, { f: hit, vel: 0.3, decay: 0.16, drop: 1.25, p: -0.4 })
      }
      if (c.has('bass')) for (const [s, tone, len] of bassP) if (s === c.s) V.organBass(c.ctx, c.bus.bass, c.t, { note: bassTone(c.key, ch, tone), len: len * c.dur, vel: 0.62 })
      if (c.has('chords') && hits.includes(c.s)) {
        // a hit late in the bar belongs to the next bar's chord
        const now = c.s >= 13 ? prog[(c.bar + 1) % 4] : ch
        V.ep(c.ctx, c.bus.chords, c.t, { notes: voice(now, c.key, 63), len: (c.s === hits[hits.length - 1] ? 2.4 : 1.4) * c.dur, vel: c.s === hits[0] ? 0.5 : 0.4, bright: c.n === 'break' ? 0.6 : 1 })
      }
      if (c.has('pad') && c.s === 0) V.pad(c.ctx, c.bus.pad, c.t, { notes: voice(ch, c.key, 67), len: 15 * c.dur, vel: 0.22, cut: 1300 })
      if (c.has('vox')) for (const [n, m] of hook[c.bar % 2].entries()) if (m.s === c.s) V.vox(c.ctx, c.bus.lead, c.t, { note: penta(c.key + 36, m.i - 5), len: 1.3 * c.dur, vel: 0.28, vowel: vowels[(n + c.bar) % vowels.length], bend: n % 3 ? 0 : -2, p: -0.2 })
      if (c.has('lead')) for (const m of tune[c.bar % 4]) if (m.s === c.s) V.bell(c.ctx, c.bus.lead, c.t, { note: penta(c.key + 36, m.i - 5), vel: 0.2, ring: 1.1, p: 0.25 })
      if (c.has('harp') && c.s % 2 === 0) {
        const tones = voice(ch, c.key, 60)
        const i = (c.s / 2) % 8
        V.harp(c.ctx, c.bus.lead, c.t, { note: tones[(i < 5 ? i : 8 - i) % tones.length] + (i > 2 && i < 6 ? 12 : 0), vel: 0.26, p: (i - 3.5) / 6 })
      }
      if (c.has('build')) build(c, 4, { roll: 0 })
      if (c.has('drop')) drop(c, 0.45)
      if (c.has('crash')) crashOn(c, 0.3)
    },
  }
}

// ── filter house: one bar of somebody else's disco, a filter, and a kick that leans on it ───────
STYLES.filter = (d) => {
  const R = (k) => rnd(d.seed, 202, k)
  const prog = pick(R(1), [['i7', 'IV7'], ['iv7', 'VII7', 'III7', 'VI7'], ['VI7', 'VII7', 'i7', 'i7']]).map((n) => CH[n])
  const chank = P(pick(R(2), ['x..x.xo..x.x.xo.', '.x.xo..x.x.xo.x.', 'x.ox..x.xo.x..xo']))
  const answer = motif(d.seed, 31, [8, 11, 14], 7)
  // how far open the filter is, per section: [from, to] in Hz
  const sweep = { intro: [300, 650], a1: [650, 1900], a2: [1900, 5200], break: [5200, 280], b1: [9500, 9500], b2: [9500, 9500], outro: [3200, 260] }
  return {
    swing: 0.1,
    mix: { level: { chords: 1.15 }, dly: { lead: 0.25 }, rev: { chords: 0.08, lead: 0.25, pad: 0.25 }, duck: { chords: 0.62, pad: 0.6, bass: 0.55 } },
    sections: [
      sect('intro', 16, 'kick ch loop 8:clap 8:oh', 0.4),
      sect('a1', 16, 'kick ch clap oh loop bass shaker crash gap', 0.65),
      sect('a2', 16, 'kick ch clap oh loop bass shaker ride gap', 0.8),
      sect('break', 8, 'loop shaker build', 0.35),
      sect('b1', 16, 'kick ch clap oh loop bass shaker ride strings drop', 1),
      sect('b2', 16, 'kick ch clap oh loop bass shaker ride strings vox crash wah', 1),
      sect('outro', 16, 'kick ch clap oh loop -8:bass crash', 0.5),
    ],
    play(c) {
      const ch = prog[c.bar % prog.length]
      if (c.has('kick')) four(c, { f: 52, punch: 3.6, decay: 0.3, click: 0.4 })
      if (c.has('clap')) backbeat(c, 0.7, 0.25)
      if (c.has('ch')) hats(c, [0.45, 0.18, 0, 0.24])
      if (c.has('oh')) offhat(c, 0.62, 0.24)
      else if (c.s % 4 === 2) V.hat(c.ctx, c.bus.hats, c.t, { vel: 0.4 })
      if (c.has('shaker')) shake(c, 0.3)
      if (c.has('ride')) rideOn(c, 0.17)
      // the filter: opens through the track; in the break it shuts and then tears open
      let [f0, f1] = sweep[c.n]
      let cut = xp(f0, f1, c.sp)
      if (c.n === 'break' && c.sp > 0.75) cut = xp(280, 9500, (c.sp - 0.75) * 4)
      if (c.has('wah')) cut = xp(9500, 1300, 0.5 - 0.5 * Math.cos(((c.bar % 4) + c.s / 16) * (Math.PI / 2)))
      c.deck.tone('chords', cut, c.t, cut < 8000 ? 3.2 : 0.8)
      if (c.has('loop')) {
        const v = chank[c.s]
        if (v) V.stab(c.ctx, c.bus.chords, c.t, { notes: voice(ch, c.key, 64), len: (v < 1 ? 0.5 : 0.9) * c.dur, vel: 0.5 * v, cut: 2600, env: 3, decay: 0.09, spread: 7 })
        // the string line that came with the sample
        if (c.s === 0) V.pad(c.ctx, c.bus.chords, c.t, { notes: [voice(ch, c.key, 76).pop()], len: 14 * c.dur, vel: 0.16, cut: 5000, a: 0.08, r: 0.2 })
      }
      if (c.has('bass') && c.s % 2 === 0) {
        const walk = c.bar % 4 === 3 && c.s >= 12
        const tone = walk ? (c.s === 12 ? 'f' : 's') : c.s % 4 === 0 ? 'r' : 'o'
        V.sawBass(c.ctx, c.bus.bass, c.t, { note: bassTone(c.key, ch, tone), len: 1.3 * c.dur, vel: c.s % 4 ? 0.42 : 0.56, cut: 420, env: 3.2, decay: 0.12, sub: 0.75 })
      }
      if (c.has('strings') && c.s === 0) V.pad(c.ctx, c.bus.pad, c.t, { notes: voice(ch, c.key, 74), len: 15 * c.dur, vel: 0.15, cut: 3200 })
      if (c.has('vox') && c.bar % 4 === 3) for (const m of answer) if (m.s === c.s) V.vox(c.ctx, c.bus.lead, c.t, { note: penta(c.key + 36, m.i - 5), len: 1.6 * c.dur, vel: 0.26, vowel: 'a', to: 'o' })
      if (c.has('build')) build(c, 2, { roll: 0.5 })
      if (c.has('drop')) drop(c, 0.5)
      if (c.has('crash')) crashOn(c, 0.32)
    },
  }
}

// ── acid: the silver box, turned up slowly ──────────────────────────────────────────────────────
const LINES = [
  '0a 0 12s 0 - 3 0a 12 0s 10 0 - 7a 0 12s 15a',
  '0a - 0 12a 0 0s 3 0 10a 0 - 0 12s 13a 0 7',
  '0 0a 12 0s 7 0 - 12a 0 3s 5 0a - 0 10s 12a',
  '0a 12 0 0s 3a 0 12 - 0 0a 7s 5 0 10a 12s 0',
].map((l) => l.split(' ').map((tok) => (tok === '-' ? null : { n: parseInt(tok), accent: tok.includes('a'), slide: tok.includes('s') })))

function acidStep(c, line, o) {
  const st = line[c.s]
  if (!st) return c.st.acid.rest()
  c.st.acid.note(c.t, c.dur, { note: c.key + 12 + st.n, accent: st.accent, slide: st.slide, ...o })
}

STYLES.acid = (d) => {
  const R = (k) => rnd(d.seed, 303, k)
  const a = Math.floor(R(1) * LINES.length)
  const lineA = LINES[a]
  const lineB = LINES[(a + 1 + Math.floor(R(2) * (LINES.length - 1))) % LINES.length]
  const curve = { intro: [150, 170, 1.2, 0.5], a1: [180, 480, 2, 0.62], a2: [480, 850, 2.6, 0.7], break: [850, 220, 2.8, 0.82], b1: [1050, 1050, 3.1, 0.8], b2: [1100, 1100, 3.2, 0.82], outro: [700, 150, 2, 0.6] }
  return {
    swing: 0.04,
    mix: { dly: { lead: 0.4, chords: 0.16 }, rev: { lead: 0.25, drums: 0.05, chords: 0.08 }, duck: { chords: 0.25, bass: 0.6 }, drive: { drums: 1.5 } },
    sections: [
      sect('intro', 16, 'kick ch 8:oh 8:clap 8:acid', 0.45),
      sect('a1', 16, 'kick ch oh clap acid sub rim crash gap', 0.65),
      sect('a2', 16, 'kick ch oh clap acid sub rim ride stab toms gap', 0.8),
      sect('break', 8, 'acid build', 0.4),
      sect('b1', 16, 'kick ch oh clap acid sub rim ride stab toms drop', 1),
      sect('b2', 16, 'kick ch oh clap acid sub rim ride stab toms crash alt', 1),
      sect('outro', 16, 'kick ch oh clap -8:acid -8:sub crash', 0.5),
    ],
    attach: (deck) => ({ acid: new V.Acid(deck.ctx, deck.bus.chords, { level: 0.8 }) }),
    detach: (deck, st, t) => st.acid.stop(t),
    play(c) {
      if (c.has('kick')) four(c, { f: 48, punch: 4.2, decay: 0.3, click: 0.5 })
      if (c.has('clap')) backbeat(c, 0.7, 0.3)
      if (c.has('ch')) hats(c, [0.4, 0.3, 0, 0.34], { decay: 0.035 })
      if (c.has('oh')) offhat(c, 0.55, 0.16)
      if (c.has('ride')) rideOn(c, 0.18)
      if (c.has('toms')) tomFill(c)
      if (c.has('rim') && [3, 9, 14].includes(c.s)) V.rim(c.ctx, c.bus.drums, c.t, { vel: 0.3, p: -0.3 })
      if (c.has('acid')) {
        let [f0, f1, env, res] = curve[c.n]
        let cut = xp(f0, f1, c.sp)
        if (c.n === 'break' && c.sp > 0.5) cut = xp(220, 2600, (c.sp - 0.5) * 2)
        if (c.n === 'b2') cut *= 1 + 0.5 * Math.sin(((c.bar % 4) + c.s / 16) * (Math.PI / 2))
        acidStep(c, c.has('alt') && c.bar % 4 >= 2 ? lineB : lineA, { cut, env, res, decay: c.n[0] === 'b' ? 0.26 : 0.18 })
      } else if (c.st.acid) c.st.acid.rest()
      if (c.has('sub') && c.s % 4 === 2) V.sub(c.ctx, c.bus.bass, c.t, { note: c.key, len: 1.3 * c.dur, vel: 0.6 })
      if (c.has('stab') && (c.bar % 2 ? [10, 13] : [0, 3, 6]).includes(c.s)) V.stab(c.ctx, c.bus.lead, c.t, { notes: voice(CH.i, c.key, 70), len: 0.7 * c.dur, vel: 0.26, cut: 1500, env: 5 })
      if (c.has('build')) build(c, 4, { roll: 0.55 })
      if (c.has('drop')) drop(c, 0.5)
      if (c.has('crash')) crashOn(c, 0.3)
    },
  }
}

// ── dub techno: one chord, a long echo, a lot of room ───────────────────────────────────────────
STYLES.dub = (d) => {
  const R = (k) => rnd(d.seed, 404, k)
  const hits = pick(R(1), [[3, 11], [2, 9], [6, 14]])
  const other = pick(R(2), [CH.iv9, CH.VII6, CH.VI7])
  const sweep = { intro: [380, 520], a1: [520, 950], a2: [950, 1700], break: [1700, 420], b1: [1500, 2200], b2: [2200, 1300], outro: [1000, 350] }
  return {
    swing: 0.06,
    mix: { level: { lead: 1.9, pad: 1.4, hats: 1.2 }, dly: { lead: 0.55, drums: 0.12 }, rev: { lead: 0.4, pad: 0.4, drums: 0.08, hats: 0.06 }, duck: { lead: 0.35, pad: 0.65 }, feedback: 0.55 },
    sections: [
      sect('intro', 16, 'kick hat drone 8:chord 8:shaker', 0.4),
      sect('a1', 16, 'kick hat drone chord shaker sub crash', 0.6),
      sect('a2', 16, 'kick hat drone chord shaker sub rim ride gap', 0.75),
      sect('break', 8, 'drone chord rim build', 0.3),
      sect('b1', 16, 'kick hat drone chord shaker sub rim ride clap rumble drop', 0.95),
      sect('b2', 16, 'kick hat drone chord shaker sub rim ride clap rumble crash', 0.95),
      sect('outro', 16, 'kick hat drone shaker -8:sub -8:chord crash', 0.45),
    ],
    play(c) {
      if (c.has('kick')) four(c, { f: 46, punch: 3, decay: 0.42, click: 0.14 })
      if (c.has('hat')) {
        offhat(c, 0.36, 0.11)
        if (c.s % 2) V.hat(c.ctx, c.bus.hats, c.t, { vel: 0.1 + 0.1 * Math.sin(c.bar * 0.8 + c.s), decay: 0.03, p: 0.3 })
      }
      if (c.has('shaker')) shake(c, 0.2 + 0.08 * Math.sin(c.bar * 0.39))
      if (c.has('ride') && c.s % 4 === 0) V.ride(c.ctx, c.bus.hats, c.t, { vel: 0.12, decay: 0.3 })
      if (c.has('clap')) backbeat(c, 0.32)
      if (c.has('rim') && (c.s === 5 || c.s === 13)) V.rim(c.ctx, c.bus.drums, c.t, { vel: 0.34, f: 1500, p: c.s === 5 ? -0.4 : 0.4 })
      const ch = c.bar % 4 === 3 ? other : CH.i9
      if (c.has('chord') && hits.includes(c.s)) {
        const [f0, f1] = sweep[c.n]
        const cut = xp(f0, f1, c.sp) * (1 + 0.25 * Math.sin(c.bar * 0.7))
        V.stab(c.ctx, c.bus.lead, c.t, { notes: voice(ch, c.key, 60), len: 1.1 * c.dur, vel: 0.42, cut, env: 2.6, q: 2.4, decay: 0.22, spread: 9, r: 0.2, p: c.s === hits[0] ? -0.2 : 0.2 })
      }
      if (c.has('sub')) {
        const last = c.bar % 4 === 3
        for (const [s, len, off] of [[0, 3, 0], [6, 1.4, 0], [10, 2.2, last ? -2 : 0]]) if (s === c.s) V.sub(c.ctx, c.bus.bass, c.t, { note: c.key + off, len: len * c.dur, vel: 0.6, harm: 0.28 })
      }
      if (c.has('rumble') && c.s % 4 === 3) V.sub(c.ctx, c.bus.bass, c.t, { note: c.key, len: 0.8 * c.dur, vel: 0.24, harm: 0.1 })
      if (c.has('drone') && c.s === 0 && c.bar % 4 === 0) V.pad(c.ctx, c.bus.pad, c.t, { notes: [c.key + 24, c.key + 31], len: 62 * c.dur, vel: 0.15, cut: 520, a: 1.5, r: 1.5 })
      if (c.has('build')) build(c, 4, { roll: 0, vel: 0.35 })
      if (c.has('drop')) drop(c, 0.4)
      if (c.has('crash')) crashOn(c, 0.22)
    },
  }
}

// ── trance: four chords, an arpeggio and a choir in the middle ──────────────────────────────────
STYLES.trance = (d) => {
  const R = (k) => rnd(d.seed, 505, k)
  const prog = pick(R(1), [['i', 'VI', 'III', 'VII'], ['i', 'III', 'VII', 'iv'], ['VI', 'VII', 'i', 'i']]).map((n) => CH[n])
  const order = pick(R(2), [[0, 2, 3, 2, 4, 3, 2, 3, 0, 2, 3, 2, 5, 4, 3, 2], [0, 3, 2, 3, 4, 3, 2, 3, 5, 3, 2, 3, 4, 3, 2, 1], [0, 1, 2, 3, 2, 1, 2, 3, 4, 3, 2, 3, 5, 4, 3, 2]])
  const contour = pick(R(3), [[2, 3, 2, 1], [3, 4, 3, 2], [1, 2, 3, 2], [4, 3, 2, 3]])
  const arpCut = { intro: [280, 320], a1: [320, 1200], a2: [1200, 2400], break: [400, 6000], b1: [3400, 3400], b2: [3800, 3800], outro: [1800, 300] }
  const tones = (ch, key, centre) => {
    const v = voice(ch, key, centre)
    return [...v, ...v.map((n) => n + 12)]
  }
  return {
    swing: 0,
    mix: { dly: { lead: 0.4, chords: 0.36 }, rev: { lead: 0.35, chords: 0.2, pad: 0.4, drums: 0.05 }, duck: { pad: 0.7, chords: 0.3, lead: 0.3 } },
    sections: [
      sect('intro', 16, 'kick ch 8:oh 8:clap 8:arp', 0.45),
      sect('a1', 16, 'kick ch oh clap arp bass crash gap', 0.65),
      sect('a2', 16, 'kick ch oh clap arp bass pad gap', 0.8),
      sect('break', 16, 'pad -8:choir -8:harp 8:arp build', 0.3),
      sect('b1', 16, 'kick ch oh clap arp bass pad lead ride roll16 drop', 1),
      sect('b2', 16, 'kick ch oh clap arp bass pad lead ride roll16 crash up', 1),
      sect('outro', 16, 'kick ch oh clap -8:bass arp crash', 0.5),
    ],
    play(c) {
      const ch = prog[c.bar % 4]
      if (c.has('kick')) four(c, { f: 50, punch: 3.8, decay: 0.3, click: 0.42 })
      if (c.has('clap')) backbeat(c, 0.7, 0.35)
      if (c.has('ch')) hats(c, [0.34, 0.26, 0, 0.3], { decay: 0.035 })
      if (c.has('oh')) offhat(c, 0.52, 0.18)
      if (c.has('ride')) rideOn(c, 0.17)
      if (c.has('bass')) {
        const root = low(c.key, ch[0])
        if (c.s % 4 === 2) V.sawBass(c.ctx, c.bus.bass, c.t, { note: root, len: 1.5 * c.dur, vel: 0.6, cut: 300, env: 3, sub: 0.9 })
        else if (c.has('roll16') && c.s % 4 === 3) V.sawBass(c.ctx, c.bus.bass, c.t, { note: root, len: 0.8 * c.dur, vel: 0.36, cut: 300, env: 2.4, sub: 0.9 })
      }
      if (c.has('arp')) {
        const [f0, f1] = arpCut[c.n]
        const p = c.n === 'break' ? (c.sp - 0.5) * 2 : c.sp
        const ts = tones(ch, c.key, 62)
        V.pluck(c.ctx, c.bus.chords, c.t, { note: ts[order[c.s] % ts.length], len: 0.7 * c.dur, vel: 0.3 * (c.s % 4 === 0 ? 1.1 : 0.85), cut: xp(f0, f1, p), env: 4, decay: 0.09, p: c.s % 2 ? 0.3 : -0.3 })
      }
      if (c.has('pad') && c.s === 0) V.pad(c.ctx, c.bus.pad, c.t, { notes: voice(ch, c.key, 64), len: 15.5 * c.dur, vel: c.n === 'break' ? 0.2 : 0.24, cut: 2000, spread: 16 })
      if (c.has('choir') && c.s === 0) V.choir(c.ctx, c.bus.pad, c.t, { notes: voice(ch, c.key, 60), len: 15 * c.dur, vel: 0.36, vowel: c.bar % 2 ? 'o' : 'a' })
      if (c.has('harp') && c.s % 2 === 0) {
        const ts = tones(ch, c.key, 60)
        const i = c.s / 2
        V.harp(c.ctx, c.bus.lead, c.t, { note: ts[(i < 6 ? i : 10 - i) % ts.length], vel: 0.3, ring: 1.6, p: (i - 3.5) / 5 })
      }
      if (c.has('lead')) {
        const ts = tones(ch, c.key, c.has('up') ? 74 : 69)
        for (const [n, [s, len]] of [[0, 6], [6, 2], [8, 4], [12, 4]].entries())
          if (s === c.s) V.pluck(c.ctx, c.bus.lead, c.t, { note: ts[contour[n] % ts.length], len: len * 0.9 * c.dur, vel: 0.2, cut: 2600, env: 2.2, decay: 0.3, spread: 17 })
      }
      if (c.has('build')) build(c, 8, { roll: 0.6, vel: 0.5 })
      if (c.has('drop')) drop(c, 0.55)
      if (c.has('crash')) crashOn(c, 0.32)
    },
  }
}

// ── garage: two kicks a bar, everything else arrives slightly late on purpose ───────────────────
STYLES.garage = (d) => {
  const R = (k) => rnd(d.seed, 606, k)
  const prog = pick(R(1), [['i7', 'VI7', 'iv7', 'V7'], ['i9', 'VI7', 'VII6', 'v7'], ['iv7', 'v7', 'i9', 'i9']]).map((n) => CH[n])
  const kicks = pick(R(2), [[[0, 10], [0, 7, 10]], [[0, 10], [0, 6, 10]], [[0, 10], [0, 10, 14]]])
  const stabs = [[0, 3, 6], [2, 5, 8, 14]]
  const bassP = [
    [[0, 'r', 3], [6, 'r', 1.4], [10, 'o', 2, 'r']],
    [[0, 'r', 2], [3, 'f', 1], [8, 's', 2, 'r'], [12, 'r', 3]],
  ]
  const chops = [
    [[1, 'e', 0], [6, 'a', -2], [9, 'o', 0], [11, 'a', 0]],
    [[2, 'i', 0], [5, 'a', 0], [8, 'o', 3], [13, 'e', 0], [14, 'a', 0]],
  ].map((bar, b) => bar.map(([s, vowel, bend], n) => ({ s, vowel, bend, i: motif(d.seed, 40 + b, bar.map((x) => x[0]), 7)[n].i })))
  const tune = [motif(d.seed, 50, [0, 6, 12], 9, 6, 13), motif(d.seed, 51, [4, 10], 8, 6, 13)]
  return {
    swing: 0.24,
    mix: { level: { bass: 1.1, chords: 1.5, lead: 1.4, kick: 1.1, drums: 1.15 }, dly: { lead: 0.3, chords: 0.1 }, rev: { chords: 0.14, lead: 0.28, pad: 0.3, drums: 0.07 }, duck: { bass: 0.5, chords: 0.3 } },
    sections: [
      sect('intro', 16, 'kick snare ch shaker 8:stabs 8:rim', 0.45),
      sect('a1', 16, 'kick snare ch shaker rim bass stabs crash', 0.65),
      sect('a2', 16, 'kick snare ch shaker rim bass stabs vox pad', 0.8),
      sect('break', 8, 'ep vox pad shaker build', 0.3),
      sect('b1', 16, 'kick snare ch shaker rim bass stabs vox pad bell drop', 1),
      sect('b2', 16, 'kick snare ch shaker rim bass stabs vox pad bell busy crash', 1),
      sect('outro', 16, 'kick snare ch shaker rim -8:bass crash', 0.5),
    ],
    play(c) {
      const ch = prog[c.bar % 4]
      const two = c.bar % 2
      if (c.has('kick')) {
        const k = c.has('busy') && c.bar % 4 === 3 ? [0, 3, 10, 13] : kicks[two]
        if (k.includes(c.s)) {
          V.kick(c.ctx, c.bus.kick, c.t, { f: 54, punch: 3.4, decay: 0.24, click: 0.4, vel: c.s ? 0.9 : 1 })
          c.deck.pump(c.t, c.s ? 0.8 : 1)
        }
      }
      if (c.has('snare')) {
        if (c.s === 4 || c.s === 12) {
          V.snare(c.ctx, c.bus.drums, c.t, { vel: 0.6, f: 215, decay: 0.13, snap: 0.9, bright: 3000 })
          V.clap(c.ctx, c.bus.drums, c.t, { vel: 0.45, decay: 0.12 })
        }
        if (c.s === 15 && c.r(3) < 0.5) V.snare(c.ctx, c.bus.drums, c.t, { vel: 0.22, f: 240, decay: 0.07 })
      }
      if (c.has('ch')) {
        const v = [0.3, 0, 0.7, 0.25][c.s % 4]
        if (v) V.hat(c.ctx, c.bus.hats, c.t, { vel: v * (0.8 + 0.4 * c.r(1)), decay: c.s === 14 && two ? 0.2 : 0.04, p: c.s % 4 === 3 ? 0.4 : -0.1 })
      }
      if (c.has('shaker')) shake(c, 0.22)
      if (c.has('rim') && (two ? [3, 11] : [3, 9]).includes(c.s)) V.rim(c.ctx, c.bus.drums, c.t, { vel: 0.36, f: 2100, p: 0.4 })
      if (c.has('bass')) for (const [s, tone, len, from] of bassP[two]) if (s === c.s) V.sub(c.ctx, c.bus.bass, c.t, { note: bassTone(c.key, ch, tone === 'o' ? 'r' : tone), from: from ? bassTone(c.key, ch, tone === 'o' ? 'o' : 'f') : null, slide: 0.09, len: len * c.dur, vel: 0.62, harm: 0.36 })
      if (c.has('stabs') && stabs[two].includes(c.s)) V.organ(c.ctx, c.bus.chords, c.t, { notes: voice(ch, c.key, 65), len: (c.s === 6 || c.s === 8 ? 1.8 : 0.8) * c.dur, vel: c.n === 'intro' ? 0.26 : 0.4, p: -0.15 })
      if (c.has('ep') && (c.s === 0 || c.s === 10)) V.ep(c.ctx, c.bus.chords, c.t, { notes: voice(ch, c.key, 63), len: 5 * c.dur, vel: 0.46, bright: 0.7 })
      if (c.has('vox')) for (const m of chops[two]) if (m.s === c.s) V.vox(c.ctx, c.bus.lead, c.t, { note: penta(c.key + 36, m.i - 5), len: 1.1 * c.dur, vel: 0.3, vowel: m.vowel, bend: m.bend, p: 0.2 })
      if (c.has('pad') && c.s === 0) V.pad(c.ctx, c.bus.pad, c.t, { notes: voice(ch, c.key, 70), len: 15 * c.dur, vel: 0.14, cut: 2400 })
      if (c.has('bell')) for (const m of tune[two]) if (m.s === c.s) V.bell(c.ctx, c.bus.lead, c.t, { note: penta(c.key + 36, m.i - 5), vel: 0.18, ring: 1, p: -0.3 })
      if (c.has('build')) build(c, 2, { roll: 0.5, f: 210 })
      if (c.has('drop')) drop(c, 0.45)
      if (c.has('crash')) crashOn(c, 0.28)
    },
  }
}

// ── piano house: the riff everybody's hands went up for ─────────────────────────────────────────
STYLES.piano = (d) => {
  const R = (k) => rnd(d.seed, 707, k)
  const prog = pick(R(1), [['i', 'VI', 'III', 'VII'], ['VI', 'VII', 'i', 'i'], ['III', 'VII', 'i', 'VI']]).map((n) => CH[n])
  const riff = pick(R(2), [[[0, 3, 6, 10, 13], [0, 3, 6, 8, 11, 14]], [[0, 3, 6, 9, 12, 14], [0, 3, 6, 10, 13]], [[0, 2, 6, 8, 11, 14], [0, 3, 6, 10, 12, 14]]])
  const cutBy = { intro: [450, 600], a1: [900, 3200], outro: [2600, 350] }
  const full = (ch, key) => {
    const v = voice(ch, key, 62)
    return [...v, v[0] + 12]
  }
  return {
    swing: 0.07,
    mix: { level: { chords: 1.1 }, dly: { lead: 0.3, chords: 0.06 }, rev: { chords: 0.16, lead: 0.34, pad: 0.3, drums: 0.06 }, duck: { chords: 0.3, bass: 0.55 } },
    sections: [
      sect('intro', 16, 'kick ch shaker 8:clap 8:oh 8:piano', 0.45),
      sect('a1', 16, 'kick ch shaker clap oh piano bass crash gap', 0.7),
      sect('a2', 16, 'kick ch shaker clap oh piano bass strings gap', 0.85),
      sect('break', 8, 'piano strings chime build', 0.35),
      sect('b1', 16, 'kick ch shaker clap oh piano bass strings ride vox drop', 1),
      sect('b2', 16, 'kick ch shaker clap oh piano bass strings ride vox chime crash', 1),
      sect('outro', 16, 'kick ch shaker clap oh -8:bass -8:piano crash', 0.5),
    ],
    play(c) {
      const ch = prog[c.bar % 4]
      const next = prog[(c.bar + 1) % 4]
      if (c.has('kick')) four(c, { f: 52, punch: 3.5, decay: 0.3, click: 0.4 })
      if (c.has('clap')) backbeat(c, 0.8, 0.2)
      if (c.has('ch')) hats(c, [0.4, 0.2, 0, 0.26])
      if (c.has('oh')) offhat(c, 0.6, 0.22)
      if (c.has('shaker')) shake(c, 0.3)
      if (c.has('ride')) rideOn(c, 0.17)
      const [f0, f1] = cutBy[c.n] || [18000, 18000]
      c.deck.tone('chords', xp(f0, f1, c.sp), c.t, 0.9)
      if (c.has('piano') && riff[c.bar % 2].includes(c.s)) V.piano(c.ctx, c.bus.chords, c.t, { notes: full(c.s >= 13 ? next : ch, c.key), len: 1.7 * c.dur, vel: c.s === 0 ? 0.62 : 0.5 })
      if (c.has('bass')) for (const [s, tone, len] of [[0, 'r', 2], [3, 'r', 1], [6, 'o', 1], [8, 'r', 2], [11, 'f', 1], [14, 'o', 1]]) if (s === c.s) V.organBass(c.ctx, c.bus.bass, c.t, { note: bassTone(c.key, s >= 14 ? next : ch, tone), len: len * c.dur, vel: 0.6 })
      if (c.has('strings') && c.s === 0) V.pad(c.ctx, c.bus.pad, c.t, { notes: voice(ch, c.key, 72), len: 15 * c.dur, vel: 0.16, cut: 3000 })
      if (c.has('vox') && c.bar % 2 && (c.s === 6 || c.s === 14)) V.vox(c.ctx, c.bus.lead, c.t, { note: voice(ch, c.key, 72)[2] ?? 72, len: 1.6 * c.dur, vel: 0.24, vowel: 'a', p: 0.2 })
      // four notes up and a shimmer: something has been found
      if (c.has('chime') && c.bar % 4 === 0 && c.s < 8 && c.s % 2 === 0) {
        const v = voice(ch, c.key, 79)
        V.bell(c.ctx, c.bus.lead, c.t, { note: [v[0], v[1], v[2], v[0] + 12][c.s / 2], vel: 0.22, ring: 2, p: (c.s - 3) / 5 })
      }
      if (c.has('build')) build(c, 4, { roll: 0.55 })
      if (c.has('drop')) drop(c, 0.55)
      if (c.has('crash')) crashOn(c, 0.32)
    },
  }
}

// ── jungle: a drum break cut into pieces, a bass you feel more than hear, a sky of pads ─────────
// one bar of break, on sixteenths: K kick, S snare, g a ghost on the snare
const BREAK = {
  a: 'K.K.S..g.gKKS..g',
  b: 'K.K.S..g.gK...S.',
  c: 'K...S.....K.S.gg',
  d: 'K.K.S.KS.gK.S.Sg',
  e: 'K..KS..g.gK.S.S.',
  f: 'K.K.S..gSgSgSSSS',
}
STYLES.jungle = (d) => {
  const R = (k) => rnd(d.seed, 808, k)
  const loopA = ['a', 'a', 'b', pick(R(1), ['c', 'e'])]
  const loopB = ['a', 'd', pick(R(2), ['b', 'e']), 'd']
  const chords = pick(R(3), [[CH.i9, CH.VI7], [CH.i9, CH.iv9], [CH.VI7, CH.i9]])
  const bells = motif(d.seed, 60, [0, 3, 6, 9, 12, 14], 8, 5, 13)
  return {
    swing: 0,
    mix: { level: { drums: 1.25, kick: 0.8, bass: 1.15, hats: 0.9 }, dly: { lead: 0.38, chords: 0.2 }, rev: { pad: 0.45, lead: 0.35, drums: 0.12, chords: 0.2 }, duck: { bass: 0.25, pad: 0.3, chords: 0.2, lead: 0.1 }, drive: { drums: 2.1, bass: 1.6 } },
    sections: [
      sect('intro', 16, 'pad bell 4:vox 8:ride 12:tease', 0.4),
      sect('a1', 16, 'break sub pad ride drop', 0.85),
      sect('a2', 16, 'break sub pad ride bell crash', 0.9),
      sect('break', 8, 'pad choir harp build', 0.3),
      sect('b1', 16, 'break chop reese pad ride stab drop', 1),
      sect('b2', 16, 'break chop reese sub pad ride stab vox bell crash', 1),
      sect('outro', 16, 'break -8:sub pad ride crash', 0.55),
    ],
    play(c) {
      const ch = chords[Math.floor(c.bar / 2) % 2]
      if (c.has('break') || (c.has('tease') && c.bar % 2)) {
        const loop = c.has('chop') ? loopB : loopA
        const fill = c.bar % 8 === 7 && !c.has('tease')
        const hit = BREAK[fill ? 'f' : loop[c.bar % 4]][c.s]
        const quiet = c.has('tease') ? 0.5 : 1
        if (hit === 'K') {
          V.kick(c.ctx, c.bus.kick, c.t, { f: 62, punch: 3, sweep: 0.05, decay: 0.17, click: 0.6, vel: quiet })
          if (c.s === 0 || c.s === 10) c.deck.pump(c.t, 0.8)
        } else if (hit === 'S') V.snare(c.ctx, c.bus.drums, c.t, { vel: 0.7 * quiet, f: fill ? 200 + c.s * 6 : 205, decay: 0.15, snap: 1, bright: 3300, tone: 0.5 })
        else if (hit === 'g') V.snare(c.ctx, c.bus.drums, c.t, { vel: 0.24 * quiet, f: 235, decay: 0.08, snap: 0.9, bright: 3600 })
        // the rush: thirty-seconds on the way into the next phrase
        if (fill && c.s >= 14) V.snare(c.ctx, c.bus.drums, c.t + c.dur / 2, { vel: 0.4, f: 250 + c.s * 6, decay: 0.07 })
      }
      if (c.has('ride') && c.s % 2 === 0) V.ride(c.ctx, c.bus.hats, c.t, { vel: c.s % 4 ? 0.2 : 0.3, decay: 0.2 })
      if (c.has('sub')) {
        const two = c.bar % 2
        for (const [s, tone, len, from] of two ? [[0, 'r', 4], [6, 'f', 2], [8, 'r', 6]] : [[0, 'r', 6], [10, 'r', 2], [14, 'r', 2, 's']])
          if (s === c.s) V.sub(c.ctx, c.bus.bass, c.t, { note: bassTone(c.key, CH.i7, tone), from: from ? bassTone(c.key, CH.i7, from) : null, slide: 0.08, len: len * c.dur, vel: 0.7, harm: 0.4 })
      }
      if (c.has('reese')) {
        const two = c.bar % 2
        if (c.s === 0) V.reese(c.ctx, c.bus.bass, c.t, { note: c.key + 12, len: (two ? 7.5 : 15.5) * c.dur, vel: 0.36 })
        if (two && c.s === 8) V.reese(c.ctx, c.bus.bass, c.t, { note: c.key + 10, len: 7.5 * c.dur, vel: 0.36 })
      }
      if (c.has('pad') && c.s === 0 && c.bar % 2 === 0) V.pad(c.ctx, c.bus.pad, c.t, { notes: voice(ch, c.key, 65), len: 31 * c.dur, vel: 0.26, cut: 1700, a: 0.7, r: 1.2, spread: 15 })
      if (c.has('bell')) for (const m of bells) if (m.s === c.s && (c.bar % 2 === 0 || m.s < 8)) V.bell(c.ctx, c.bus.lead, c.t, { note: penta(c.key + 36, m.i - 5), vel: 0.16, ring: 1.2, p: (m.s - 7) / 9 })
      if (c.has('vox') && c.bar % 4 === 0 && c.s === 0) V.vox(c.ctx, c.bus.lead, c.t, { note: c.key + 43, len: 14 * c.dur, vel: 0.2, vowel: 'o', to: 'u', bend: -3 })
      if (c.has('stab') && c.bar % 4 === 2 && (c.s === 0 || c.s === 6)) V.stab(c.ctx, c.bus.lead, c.t, { notes: voice(CH.i7, c.key, 72), len: 1.6 * c.dur, vel: 0.24, cut: 1700, env: 4 })
      if (c.has('choir') && c.s === 0 && c.bar % 2 === 0) V.choir(c.ctx, c.bus.pad, c.t, { notes: voice(ch, c.key, 60).slice(0, 3), len: 30 * c.dur, vel: 0.34, vowel: 'a' })
      if (c.has('harp') && c.s % 4 === 0) {
        const v = voice(ch, c.key, 67)
        V.harp(c.ctx, c.bus.lead, c.t, { note: v[((c.bar % 2) * 4 + c.s / 4) % v.length] + 12, vel: 0.28, ring: 1.8 })
      }
      if (c.has('build')) build(c, 4, { roll: 0.5, f: 215 })
      if (c.has('drop')) drop(c, 0.5)
      if (c.has('crash')) crashOn(c, 0.3)
    },
  }
}

// ── breaks: a heavy funky beat, a rude bass riff, a silver box somewhere at the back ────────────
STYLES.breaks = (d) => {
  const R = (k) => rnd(d.seed, 909, k)
  const beat = ['K...S..K.gK.S..g', 'K.K.S..g..KKS.g.']
  const riff = pick(R(1), [
    [[[0, 0, 2], [3, 0, 1], [6, 3, 1], [7, 5, 1], [8, 0, 2], [11, 0, 1], [14, -2, 2]], [[0, 0, 2], [3, 0, 1], [6, 3, 1], [7, 5, 1], [8, 7, 1.5], [10, 5, 1.5], [12, 3, 2], [14, 0, 2]]],
    [[[0, 0, 3], [6, 0, 1], [7, 3, 1], [10, 5, 1], [11, 3, 1], [14, 0, 2]], [[0, 0, 3], [6, 0, 1], [7, 3, 1], [10, 5, 1], [12, 7, 1], [13, 5, 1], [14, 3, 1], [15, -2, 1]]],
  ])
  const line = LINES[Math.floor(R(2) * LINES.length)]
  const cutBy = { intro: [240, 320], a1: [650, 800], a2: [800, 900], break: [700, 260], b1: [950, 950], b2: [1000, 1000], outro: [800, 300] }
  return {
    swing: 0.09,
    mix: { level: { drums: 1.15, bass: 0.58, chords: 1.3, lead: 1.5 }, dly: { lead: 0.3, chords: 0.3 }, rev: { lead: 0.25, drums: 0.1, chords: 0.15 }, duck: { bass: 0.35, chords: 0.2, lead: 0.15 }, drive: { drums: 1.9, bass: 2 } },
    sections: [
      sect('intro', 16, 'beat hat 8:riff', 0.5),
      sect('a1', 16, 'beat hat riff shaker zap crash', 0.7),
      sect('a2', 16, 'beat hat riff shaker zap acid stab', 0.85),
      sect('break', 8, 'riff acid build', 0.4),
      sect('b1', 16, 'beat hat riff shaker zap acid hoover drop', 1),
      sect('b2', 16, 'beat hat riff shaker zap acid hoover bell stab crash', 1),
      sect('outro', 16, 'beat hat -8:riff crash', 0.55),
    ],
    attach: (deck) => ({ acid: new V.Acid(deck.ctx, deck.bus.chords, { level: 0.34 }) }),
    detach: (deck, st, t) => st.acid.stop(t),
    play(c) {
      const two = c.bar % 2
      if (c.has('beat')) {
        const hit = beat[two][c.s]
        if (hit === 'K') {
          V.kick(c.ctx, c.bus.kick, c.t, { f: 55, punch: 3.5, decay: 0.28, click: 0.5 })
          c.deck.pump(c.t, c.s ? 0.7 : 1)
        } else if (hit === 'S') {
          V.snare(c.ctx, c.bus.drums, c.t, { vel: 0.75, f: 180, decay: 0.2, snap: 0.95, tone: 0.7 })
          V.clap(c.ctx, c.bus.drums, c.t, { vel: 0.35, decay: 0.14 })
        } else if (hit === 'g') V.snare(c.ctx, c.bus.drums, c.t, { vel: 0.2, f: 205, decay: 0.08 })
      }
      if (c.has('hat') && c.s % 2 === 0) V.hat(c.ctx, c.bus.hats, c.t, { vel: c.s % 4 ? 0.5 : 0.36, decay: two && c.s === 14 ? 0.22 : 0.05, p: 0.2 })
      if (c.has('shaker')) shake(c, 0.24)
      const [f0, f1] = cutBy[c.n]
      if (c.has('riff'))
        for (const [s, off, len] of riff[two])
          if (s === c.s) {
            V.sawBass(c.ctx, c.bus.bass, c.t, { note: low(c.key, 0) + 12 + off, len: len * 0.9 * c.dur, vel: 0.44, cut: xp(f0, f1, c.sp), env: 3.4, q: 3, decay: 0.14, sub: 0.5, type: 'square' })
            // the weight under the riff: its root notes again, an octave down
            if (off === 0 && c.n !== 'intro') V.sub(c.ctx, c.bus.bass, c.t, { note: low(c.key, 0), len: len * 0.9 * c.dur, vel: 0.7, harm: 0.15 })
          }
      if (c.has('acid')) acidStep(c, line, { cut: c.n === 'break' ? xp(400, 2400, c.sp) : c.n === 'b2' ? 1300 : 700, env: 2.6, res: 0.75, decay: 0.16 })
      else c.st.acid.rest()
      if (c.has('zap') && c.bar % 4 === 3 && c.s === 14) V.zap(c.ctx, c.bus.lead, c.t, { from: 3200, to: 200, dur: 0.22, vel: 0.2 })
      if (c.has('stab') && c.bar % 4 === 1 && (c.s === 3 || c.s === 6)) V.organ(c.ctx, c.bus.lead, c.t, { notes: voice(CH.i7, c.key, 67), len: 0.9 * c.dur, vel: 0.3 })
      if (c.has('hoover')) for (const [s, off, len] of two ? [[0, 0, 6], [8, 7, 4]] : [[0, 0, 3], [6, 3, 2], [8, 0, 2], [12, -2, 3]]) if (s === c.s) V.hoover(c.ctx, c.bus.lead, c.t, { note: c.key + 36 + off, len: len * 0.9 * c.dur, vel: 0.22, swoop: s === 0 ? -12 : -3 })
      if (c.has('bell') && [0, 3, 6, 8, 11, 14].includes(c.s)) V.cowbell(c.ctx, c.bus.hats, c.t, { vel: 0.16, p: -0.35 })
      if (c.has('build')) build(c, 4, { roll: 0.6, f: 180 })
      if (c.has('drop')) drop(c, 0.55)
      if (c.has('crash')) crashOn(c, 0.3)
    },
  }
}

// ── techno: three notes that never line up with the bar, and a kick that does ────────────────────
STYLES.techno = (d) => {
  const R = (k) => rnd(d.seed, 1010, k)
  const gate = P(pick(R(1), ['x.xx.x.xx.x.xx.x', 'xx.x.xx.x.xx.x.x', 'x.x.xx.xx.x.x.xx']))
  const cell = pick(R(2), [[0, 3, 7], [0, 0, 10, 3, 7], [0, 7, 3, 0, 10], [0, 12, 3, 0, 7]])
  const cutBy = { intro: [400, 500], a1: [500, 1100], a2: [1100, 2400], break: [2400, 500], b1: [3000, 3000], b2: [2200, 3600], outro: [1600, 400] }
  return {
    swing: 0,
    mix: { dly: { lead: 0.34, chords: 0.3, drums: 0.08 }, rev: { lead: 0.2, chords: 0.12, pad: 0.4, drums: 0.05 }, duck: { chords: 0.3, pad: 0.6 }, drive: { drums: 1.7 } },
    sections: [
      sect('intro', 16, 'kick ch 8:oh 8:perc', 0.45),
      sect('a1', 16, 'kick ch oh perc bass bleep drone crash gap', 0.65),
      sect('a2', 16, 'kick ch oh perc bass bleep drone clap ride gap', 0.8),
      sect('break', 8, 'bleep drone build', 0.35),
      sect('b1', 16, 'kick ch oh perc bass rumble bleep drone clap ride hoover toms drop', 1),
      sect('b2', 16, 'kick ch oh perc perc2 bass rumble bleep drone clap ride hoover toms crash', 1),
      sect('outro', 16, 'kick ch oh perc -8:bass crash', 0.5),
    ],
    play(c) {
      const i = c.bar * 16 + c.s
      if (c.has('kick')) four(c, { f: 47, punch: 4.4, decay: 0.34, click: 0.5 })
      if (c.has('clap')) backbeat(c, 0.5)
      if (c.has('ch')) hats(c, [0.3, 0.36, 0, 0.36], { decay: 0.03 })
      if (c.has('oh')) offhat(c, 0.6, 0.15)
      if (c.has('ride')) rideOn(c, 0.2)
      if (c.has('toms')) tomFill(c)
      if (c.has('perc') && i % 3 === 0) V.tom(c.ctx, c.bus.drums, c.t, { f: 165, vel: 0.26, decay: 0.12, drop: 1.3, p: -0.3 })
      if (c.has('perc2') && i % 5 === 2) V.rim(c.ctx, c.bus.drums, c.t, { vel: 0.3, f: 1300, p: 0.4 })
      if (c.has('bass') && c.s % 4 === 2) V.sub(c.ctx, c.bus.bass, c.t, { note: c.key, len: 1.4 * c.dur, vel: 0.64, harm: 0.3 })
      if (c.has('rumble') && c.s % 4 === 3) V.sub(c.ctx, c.bus.bass, c.t, { note: c.key, len: 0.8 * c.dur, vel: 0.3, harm: 0.1 })
      if (c.has('bleep') && gate[c.s]) {
        const [f0, f1] = cutBy[c.n]
        V.pluck(c.ctx, c.bus.chords, c.t, { note: c.key + 36 + cell[i % cell.length], len: 0.5 * c.dur, vel: 0.26, cut: xp(f0, f1, c.sp), env: 2.5, q: 4, decay: 0.07, type: 'square', spread: 5, p: (i % 4) / 3 - 0.5 })
      }
      if (c.has('drone') && c.s === 0 && c.bar % 4 === 0) V.pad(c.ctx, c.bus.pad, c.t, { notes: [c.key + 24, c.key + 31], len: 62 * c.dur, vel: 0.12, cut: 700, a: 1.2, r: 1.2 })
      if (c.has('hoover') && ((c.bar % 2 === 0 && c.s === 0) || (c.bar % 4 === 3 && c.s === 10))) V.hoover(c.ctx, c.bus.lead, c.t, { note: c.key + 36 + (c.s ? 3 : 0), len: (c.s ? 2 : 3) * c.dur, vel: 0.22 })
      if (c.has('build')) build(c, 4, { roll: 0.55 })
      if (c.has('drop')) drop(c, 0.5)
      if (c.has('crash')) crashOn(c, 0.3)
    },
  }
}

// ── the box itself ──────────────────────────────────────────────────────────────────────────────
// `trim` is how far off the others a record was cut, in dB: the DJ makes it up on the channel's trim knob
export const CRATE = [
  { id: 'medipack', title: 'Small Medipack', style: 'deep', bpm: 122, tint: '#c8553d' },
  { id: 'swandive', title: 'Swan Dive', style: 'filter', bpm: 124, tint: '#2fb5a8' },
  { id: 'secret', title: 'Secret Found', style: 'piano', bpm: 126, tint: '#e0a83a' },
  { id: 'tank', title: 'Tank Controls', style: 'acid', bpm: 127, tint: '#e6e02e', trim: -1.5 },
  { id: 'block', title: 'Pushable Block', style: 'dub', bpm: 129, tint: '#8a63c9' },
  { id: 'lever', title: 'Pull The Lever', style: 'techno', bpm: 131, tint: '#e0398b' },
  { id: 'crystal', title: 'Save Crystal', style: 'trance', bpm: 132, tint: '#3b7bf0' },
  { id: 'butler', title: 'Butler In The Freezer', style: 'garage', bpm: 132, tint: '#7fd6e8', trim: 2.5 },
  { id: 'valley', title: 'Lost Valley', style: 'breaks', bpm: 135, tint: '#3fa652' },
  { id: 'boulder', title: 'Rolling Boulder', style: 'jungle', bpm: 165, tint: '#e2472a' },
]
export const STYLE_NAMES = { deep: 'deep house', filter: 'filter house', piano: 'piano house', acid: 'acid', dub: 'dub techno', techno: 'techno', trance: 'trance', garage: 'garage', breaks: 'breaks', jungle: 'jungle' }
const NOTE = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
export const keyName = (pc) => NOTE[((pc % 12) + 12) % 12] + 'm'

// press a record: `pc` is its tonic (0..11), `seed` picks its riffs
export function press(id, pc = 9, seed = 1) {
  const def = CRATE.find((r) => r.id === id)
  if (!def) throw new Error(`no record called ${id}`)
  // the tonic, down where the bass lives: E1 (41 Hz) up to D#2 (78 Hz)
  let key = 24 + (((pc % 12) + 12) % 12)
  if (key < 28) key += 12
  const style = STYLES[def.style]({ ...def, seed })
  const sections = []
  let bar = 0
  for (const s of style.sections) {
    sections.push({ ...s, start: bar, end: bar + s.bars })
    bar += s.bars
  }
  const find = (n) => sections.find((s) => s.name === n)
  const swing = style.swing || 0
  const record = {
    ...def,
    pc: ((pc % 12) + 12) % 12,
    key,
    seed,
    bars: bar,
    sections,
    mix: style.mix,
    attach: style.attach,
    detach: style.detach,
    // the places a DJ needs to know
    cue: { intro: find('intro').end, drop: find('b1').start, breakdown: find('break').start, outro: find('outro').start },
    sectionAt(b) {
      for (const s of sections) if (b < s.end) return s
      return sections[sections.length - 1]
    },
    play(deck, st, i, t, dur) {
      const b = Math.floor(i / 16)
      const s = i - b * 16
      const sec = record.sectionAt(b)
      const sb = b - sec.start
      const c = {
        ctx: deck.ctx,
        deck,
        bus: deck.bus,
        st,
        key,
        t: t + (s % 2 ? swing * dur : 0),
        dur,
        bar: b,
        s,
        sec,
        n: sec.name,
        sb,
        sp: (sb + s / 16) / sec.bars,
        last: b === sec.end - 1,
        has(name) {
          const v = sec.on[name]
          return v === undefined ? false : v >= 0 ? sb >= v : sb < -v
        },
        r: (k) => rnd(seed, b, s, k),
      }
      style.play(c)
    },
  }
  return record
}
