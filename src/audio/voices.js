// Every sound on the records is made here, out of oscillators, noise and filters: no samples.
// A voice is a function (ctx, out, t, options): it builds a few nodes, schedules them and lets them go.
export const mtof = (m) => 440 * 2 ** ((m - 69) / 12)

// ── raw material: white noise, and the six-square "metal" a drum machine makes cymbals from ──────────
const cache = new WeakMap()
function material(ctx) {
  let m = cache.get(ctx)
  if (m) return m
  const sr = ctx.sampleRate
  const white = ctx.createBuffer(1, sr * 2, sr)
  const w = white.getChannelData(0)
  let seed = 22222
  for (let i = 0; i < w.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    w[i] = seed / 2147483648 - 1
  }
  const metal = ctx.createBuffer(1, sr * 2, sr)
  const d = metal.getChannelData(0)
  const fs = [263, 400, 421, 474, 587, 845].map((f) => f * 1.52)
  for (let i = 0; i < d.length; i++) {
    let s = 0
    for (const f of fs) s += ((i * f) / sr) % 1 < 0.5 ? 1 : -1
    d[i] = s / 6
  }
  // crackle for the run-in groove: sparse ticks of different sizes
  const dust = ctx.createBuffer(1, sr * 4, sr)
  const c = dust.getChannelData(0)
  for (let i = 0; i < c.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    if (seed % 2600 === 0) {
      const a = ((seed >>> 8) % 100) / 100
      const n = 2 + ((seed >>> 16) % 5)
      for (let k = 0; k < n && i + k < c.length; k++) c[i + k] = (k % 2 ? -1 : 1) * a * (1 - k / n)
    }
  }
  m = { white, metal, dust }
  cache.set(ctx, m)
  return m
}
export const buffers = material

function src(ctx, buffer, t, dur, rate = 1) {
  const s = ctx.createBufferSource()
  s.buffer = buffer
  s.loop = true
  s.playbackRate.value = rate
  // not always from the top, or every hat is the same hat
  s.start(t, (t * 7.31) % (buffer.duration - 0.5))
  s.stop(t + dur)
  return s
}
function osc(ctx, type, f, t, dur, detune = 0) {
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.value = f
  if (detune) o.detune.value = detune
  o.start(t)
  o.stop(t + dur)
  return o
}
function biquad(ctx, type, f, q = 0.707) {
  const b = ctx.createBiquadFilter()
  b.type = type
  b.frequency.value = f
  b.Q.value = q
  return b
}
function vca(ctx, v = 0) {
  const g = ctx.createGain()
  g.gain.value = v
  return g
}
function pan(ctx, node, out, p) {
  if (!p || !ctx.createStereoPanner) return node.connect(out)
  const n = ctx.createStereoPanner()
  n.pan.value = p
  node.connect(n).connect(out)
}
// attack, then an exponential fall to nothing at t + dur
function perc(g, t, peak, attack, dur) {
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(peak, t + attack)
  g.gain.exponentialRampToValueAtTime(Math.max(peak * 0.001, 1e-5), t + dur)
}
// attack, fall to a held level, release when the note is let go
function adsr(g, t, len, peak, a, d, s, r) {
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(peak, t + a)
  g.gain.setTargetAtTime(peak * s, t + a, d / 3)
  g.gain.setTargetAtTime(0, t + Math.max(len, a + 0.005), r / 3)
  return t + Math.max(len, a) + r * 2 // when it is safe to stop
}

// ── drums ───────────────────────────────────────────────────────────────────────────────────────
export function kick(ctx, out, t, { f = 50, punch = 3.4, sweep = 0.075, decay = 0.34, click = 0.35, vel = 1 } = {}) {
  const o = ctx.createOscillator()
  o.frequency.setValueAtTime(f * punch, t)
  o.frequency.exponentialRampToValueAtTime(f * 1.25, t + sweep)
  o.frequency.exponentialRampToValueAtTime(f, t + sweep * 3)
  const g = vca(ctx)
  g.gain.setValueAtTime(vel, t)
  g.gain.setValueAtTime(vel, t + decay * 0.3)
  g.gain.exponentialRampToValueAtTime(0.001, t + decay)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + decay + 0.02)
  if (click > 0) {
    const n = src(ctx, material(ctx).white, t, 0.03)
    const f1 = biquad(ctx, 'bandpass', 3200, 0.8)
    const cg = vca(ctx)
    perc(cg, t, click * vel, 0.0005, 0.018)
    n.connect(f1).connect(cg).connect(out)
  }
}

export function hat(ctx, out, t, { decay = 0.045, tone = 8500, vel = 1, metal = 0.6, p = 0 } = {}) {
  const m = material(ctx)
  const g = vca(ctx)
  const len = decay * 2.4 // `decay` is roughly how long the hat can be heard
  perc(g, t, vel, 0.001, len)
  const hp = biquad(ctx, 'highpass', tone, 0.9)
  const a = src(ctx, m.white, t, len + 0.02)
  const ag = vca(ctx, 1 - metal)
  a.connect(ag).connect(hp)
  if (metal > 0) {
    const b = src(ctx, m.metal, t, len + 0.02, 2.6)
    const bg = vca(ctx, metal * 1.6)
    b.connect(bg).connect(hp)
  }
  hp.connect(g)
  pan(ctx, g, out, p)
}

export function ride(ctx, out, t, { decay = 0.5, vel = 1, p = 0.15 } = {}) {
  const m = material(ctx)
  const g = vca(ctx)
  perc(g, t, vel, 0.001, decay * 1.6)
  const bp = biquad(ctx, 'bandpass', 6200, 1.4)
  const hp = biquad(ctx, 'highpass', 4200, 0.7)
  src(ctx, m.metal, t, decay * 1.6 + 0.02, 3.4).connect(bp).connect(hp).connect(g)
  pan(ctx, g, out, p)
}

export function crash(ctx, out, t, { decay = 1.8, vel = 1 } = {}) {
  const m = material(ctx)
  const g = vca(ctx)
  perc(g, t, vel, 0.002, decay)
  const hp = biquad(ctx, 'highpass', 3800, 0.7)
  src(ctx, m.white, t, decay + 0.02).connect(hp)
  const mg = vca(ctx, 0.9)
  src(ctx, m.metal, t, decay + 0.02, 2.2).connect(mg).connect(hp)
  hp.connect(g).connect(out)
}

export function clap(ctx, out, t, { decay = 0.2, tone = 1150, vel = 1, p = 0 } = {}) {
  const g = vca(ctx)
  // three hands that are not quite together, then the room
  for (let i = 0; i < 3; i++) {
    g.gain.setValueAtTime(vel * 0.9, t + i * 0.011)
    g.gain.exponentialRampToValueAtTime(vel * 0.18, t + i * 0.011 + 0.009)
  }
  g.gain.setValueAtTime(vel, t + 0.033)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.033 + decay)
  const bp = biquad(ctx, 'bandpass', tone, 1.1)
  const hp = biquad(ctx, 'highpass', 650, 0.7)
  src(ctx, material(ctx).white, t, decay + 0.08).connect(bp).connect(hp).connect(g)
  pan(ctx, g, out, p)
}

export function snare(ctx, out, t, { f = 190, decay = 0.17, snap = 0.8, tone = 0.6, vel = 1, bright = 2600, p = 0 } = {}) {
  const o = ctx.createOscillator()
  o.type = 'triangle'
  o.frequency.setValueAtTime(f * 1.6, t)
  o.frequency.exponentialRampToValueAtTime(f, t + 0.03)
  const og = vca(ctx)
  perc(og, t, vel * tone, 0.001, decay * 0.7)
  o.start(t)
  o.stop(t + decay)
  const ng = vca(ctx)
  perc(ng, t, vel * snap, 0.001, decay)
  const bp = biquad(ctx, 'bandpass', bright, 0.6)
  const hp = biquad(ctx, 'highpass', 900, 0.7)
  src(ctx, material(ctx).white, t, decay + 0.02).connect(bp).connect(hp).connect(ng)
  const sum = vca(ctx, 1)
  o.connect(og).connect(sum)
  ng.connect(sum)
  pan(ctx, sum, out, p)
}

export function rim(ctx, out, t, { f = 1750, vel = 1, p = 0 } = {}) {
  const g = vca(ctx)
  perc(g, t, vel, 0.0005, 0.035)
  const bp = biquad(ctx, 'bandpass', f, 6)
  osc(ctx, 'square', f * 0.47, t, 0.05).connect(bp)
  osc(ctx, 'triangle', f, t, 0.05).connect(bp)
  bp.connect(g)
  pan(ctx, g, out, p)
}

export function tom(ctx, out, t, { f = 150, decay = 0.22, vel = 1, drop = 1.7, p = 0 } = {}) {
  const o = ctx.createOscillator()
  o.frequency.setValueAtTime(f * drop, t)
  o.frequency.exponentialRampToValueAtTime(f, t + 0.06)
  const g = vca(ctx)
  perc(g, t, vel, 0.002, decay)
  o.connect(g)
  o.start(t)
  o.stop(t + decay + 0.02)
  pan(ctx, g, out, p)
}

export function shaker(ctx, out, t, { vel = 1, decay = 0.05, p = 0 } = {}) {
  const g = vca(ctx)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vel, t + 0.012)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.012 + decay * 2)
  const bp = biquad(ctx, 'bandpass', 6800, 1.6)
  src(ctx, material(ctx).white, t, decay * 2 + 0.04).connect(bp).connect(g)
  pan(ctx, g, out, p)
}

export function cowbell(ctx, out, t, { vel = 1, p = 0 } = {}) {
  const g = vca(ctx)
  perc(g, t, vel, 0.001, 0.22)
  const bp = biquad(ctx, 'bandpass', 2640, 2.5)
  osc(ctx, 'square', 540, t, 0.25).connect(bp)
  osc(ctx, 'square', 800, t, 0.25).connect(bp)
  bp.connect(g)
  pan(ctx, g, out, p)
}

// ── noise that goes somewhere: builds and landings ────────────────────────────────────────────────
export function riser(ctx, out, t, { dur = 4, vel = 1, from = 300, to = 9000 } = {}) {
  const g = vca(ctx)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vel, t + dur * 0.97)
  g.gain.linearRampToValueAtTime(0, t + dur)
  const bp = biquad(ctx, 'bandpass', from, 1.6)
  bp.frequency.setValueAtTime(from, t)
  bp.frequency.exponentialRampToValueAtTime(to, t + dur)
  src(ctx, material(ctx).white, t, dur + 0.02).connect(bp).connect(g).connect(out)
}

export function fall(ctx, out, t, { dur = 2.4, vel = 1, boom = 0.8, f = 46 } = {}) {
  const g = vca(ctx)
  perc(g, t, vel, 0.004, dur)
  const lp = biquad(ctx, 'lowpass', 9000, 0.7)
  lp.frequency.setValueAtTime(9000, t)
  lp.frequency.exponentialRampToValueAtTime(300, t + dur)
  src(ctx, material(ctx).white, t, dur + 0.02).connect(lp).connect(g).connect(out)
  if (boom > 0) {
    const o = ctx.createOscillator()
    o.frequency.setValueAtTime(f * 2.2, t)
    o.frequency.exponentialRampToValueAtTime(f * 0.7, t + 0.9)
    const bg = vca(ctx)
    perc(bg, t, boom, 0.004, 1.3)
    o.connect(bg).connect(out)
    o.start(t)
    o.stop(t + 1.4)
  }
}

export function zap(ctx, out, t, { from = 2400, to = 180, dur = 0.18, vel = 1, type = 'sine' } = {}) {
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(from, t)
  o.frequency.exponentialRampToValueAtTime(to, t + dur)
  const g = vca(ctx)
  perc(g, t, vel, 0.002, dur)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + dur + 0.02)
}

// ── bass ────────────────────────────────────────────────────────────────────────────────────────
// a sine with a little second harmonic so it is still there on small speakers; can slide up or down into the note
export function sub(ctx, out, t, { note, len = 0.2, vel = 1, from = null, slide = 0.06, harm = 0.22, a = 0.006, r = 0.05 } = {}) {
  const f = mtof(note)
  const g = vca(ctx)
  const end = adsr(g, t, len, vel, a, 0.2, 0.85, r)
  for (const [mult, lvl] of [[1, 1], [2, harm], [3, harm * 0.4]]) {
    if (lvl <= 0) continue
    const o = ctx.createOscillator()
    o.frequency.setValueAtTime((from != null ? mtof(from) : f) * mult, t)
    if (from != null) o.frequency.exponentialRampToValueAtTime(f * mult, t + slide)
    const og = vca(ctx, lvl)
    o.connect(og).connect(g)
    o.start(t)
    o.stop(end)
  }
  g.connect(out)
}

// the percussive organ bass that half of 1993 was built on
export function organBass(ctx, out, t, { note, len = 0.16, vel = 1 } = {}) {
  const f = mtof(note)
  const g = vca(ctx)
  const end = adsr(g, t, len, vel, 0.003, 0.14, 0.55, 0.05)
  const lp = biquad(ctx, 'lowpass', 1400, 0.7)
  for (const [mult, lvl] of [[1, 1], [2, 0.6], [3, 0.22], [4, 0.1]]) {
    const o = osc(ctx, 'sine', f * mult, t, end - t)
    const og = vca(ctx, lvl)
    o.connect(og).connect(lp)
  }
  // the key click
  const c = osc(ctx, 'square', f * 6, t, 0.03)
  const cg = vca(ctx)
  perc(cg, t, 0.12, 0.0005, 0.02)
  c.connect(cg).connect(lp)
  lp.connect(g).connect(out)
}

export function sawBass(ctx, out, t, { note, len = 0.18, vel = 1, cut = 900, env = 2.6, q = 2.2, decay = 0.16, sub: s = 0.6, type = 'sawtooth' } = {}) {
  const f = mtof(note)
  const g = vca(ctx)
  const end = adsr(g, t, len, vel, 0.004, 0.2, 0.7, 0.05)
  const lp = biquad(ctx, 'lowpass', cut, q)
  lp.frequency.setValueAtTime(Math.min(cut * env, 12000), t)
  lp.frequency.exponentialRampToValueAtTime(cut, t + decay)
  osc(ctx, type, f, t, end - t, -5).connect(lp)
  osc(ctx, type, f, t, end - t, 6).connect(lp)
  lp.connect(g)
  if (s > 0) {
    const so = osc(ctx, 'sine', f, t, end - t)
    const sg = vca(ctx, s)
    so.connect(sg).connect(g)
  }
  g.connect(out)
}

// two saws that disagree, under a low filter that keeps moving
export function reese(ctx, out, t, { note, len = 1, vel = 1, cut = 380, move = 500, rate = 0.35, spread = 14 } = {}) {
  const f = mtof(note)
  const g = vca(ctx)
  const end = adsr(g, t, len, vel, 0.02, 0.3, 0.9, 0.12)
  const lp = biquad(ctx, 'lowpass', cut, 2.4)
  const lfo = osc(ctx, 'sine', rate, t, end - t)
  const lg = vca(ctx, move)
  lfo.connect(lg).connect(lp.frequency)
  for (const d of [-spread, spread, 0]) osc(ctx, 'sawtooth', d === 0 ? f / 2 : f, t, end - t, d).connect(lp)
  lp.connect(g)
  const so = osc(ctx, 'sine', f / 2, t, end - t)
  const sg = vca(ctx, 0.7)
  so.connect(sg).connect(g)
  g.connect(out)
}

// ── keys ────────────────────────────────────────────────────────────────────────────────────────
// two-operator electric piano: a tine that barks when hit hard and goes round as it rings
export function ep(ctx, out, t, { notes, len = 0.3, vel = 1, bright = 1, p = 0 } = {}) {
  const g = vca(ctx)
  const end = adsr(g, t, len, vel / Math.sqrt(notes.length), 0.004, 0.9, 0.25, 0.14)
  for (const n of notes) {
    const f = mtof(n)
    const car = osc(ctx, 'sine', f, t, end - t)
    const mod = osc(ctx, 'sine', f, t, end - t)
    const idx = vca(ctx)
    idx.gain.setValueAtTime(f * 2.4 * bright, t)
    idx.gain.exponentialRampToValueAtTime(f * 0.35 * bright, t + 0.35)
    mod.connect(idx).connect(car.frequency)
    const tine = osc(ctx, 'sine', f * 14.01, t, 0.09)
    const tg = vca(ctx)
    tg.gain.setValueAtTime(f * 0.7 * bright, t)
    tg.gain.exponentialRampToValueAtTime(1, t + 0.07)
    tine.connect(tg).connect(car.frequency)
    car.connect(g)
  }
  pan(ctx, g, out, p)
}

// the bright, slightly wrong piano of a rompler: enough attack to carry a riff
export function piano(ctx, out, t, { notes, len = 0.25, vel = 1, p = 0 } = {}) {
  const g = vca(ctx)
  const end = adsr(g, t, len, vel / Math.sqrt(notes.length), 0.002, 1.1, 0.12, 0.12)
  const lp = biquad(ctx, 'lowpass', 5200, 0.6)
  lp.frequency.setValueAtTime(6500, t)
  lp.frequency.exponentialRampToValueAtTime(1100, t + 0.5)
  for (const n of notes) {
    const f = mtof(n)
    for (const [type, mult, lvl, det] of [['triangle', 1, 1, 0], ['sawtooth', 1, 0.32, 4], ['sine', 2, 0.3, -3], ['sine', 3.01, 0.08, 0]]) {
      const o = osc(ctx, type, f * mult, t, end - t, det)
      const og = vca(ctx, lvl)
      o.connect(og).connect(lp)
    }
  }
  lp.connect(g)
  pan(ctx, g, out, p)
}

// drawbars and a key click
export function organ(ctx, out, t, { notes, len = 0.12, vel = 1, p = 0 } = {}) {
  const g = vca(ctx)
  const end = adsr(g, t, len, vel / Math.sqrt(notes.length), 0.003, 0.1, 0.7, 0.04)
  for (const n of notes) {
    const f = mtof(n)
    for (const [mult, lvl] of [[1, 1], [2, 0.7], [3, 0.35], [4, 0.2], [6, 0.08]]) {
      const o = osc(ctx, 'sine', f * mult, t, end - t)
      const og = vca(ctx, lvl * 0.5)
      o.connect(og).connect(g)
    }
  }
  pan(ctx, g, out, p)
}

// a chord of saws through one filter that snaps shut: the stab
export function stab(ctx, out, t, { notes, len = 0.12, vel = 1, cut = 700, env = 6, q = 1.2, decay = 0.16, spread = 10, type = 'sawtooth', p = 0, r = 0.08 } = {}) {
  const g = vca(ctx)
  const end = adsr(g, t, len, vel / Math.sqrt(notes.length), 0.003, 0.25, 0.4, r)
  const lp = biquad(ctx, 'lowpass', cut, q)
  lp.frequency.setValueAtTime(Math.min(cut * env, 14000), t)
  lp.frequency.exponentialRampToValueAtTime(cut, t + decay)
  for (const n of notes) {
    const f = mtof(n)
    osc(ctx, type, f, t, end - t, -spread).connect(lp)
    osc(ctx, type, f, t, end - t, spread).connect(lp)
  }
  lp.connect(g)
  pan(ctx, g, out, p)
}

// slow saws: a held chord
export function pad(ctx, out, t, { notes, len = 2, vel = 1, cut = 1400, open = 1, a = 0.5, r = 0.9, spread = 12 } = {}) {
  const g = vca(ctx)
  const end = adsr(g, t, len, vel / Math.sqrt(notes.length), a, 0.5, 0.9, r)
  const lp = biquad(ctx, 'lowpass', cut, 0.8)
  if (open !== 1) {
    lp.frequency.setValueAtTime(cut, t)
    lp.frequency.exponentialRampToValueAtTime(cut * open, t + len)
  }
  for (const n of notes) {
    const f = mtof(n)
    for (const d of [-spread, 0, spread]) osc(ctx, 'sawtooth', f, t, end - t, d + (n % 5)).connect(lp)
  }
  lp.connect(g).connect(out)
}

export function pluck(ctx, out, t, { note, len = 0.1, vel = 1, cut = 800, env = 7, q = 1.5, decay = 0.11, spread = 8, p = 0, type = 'sawtooth' } = {}) {
  const f = mtof(note)
  const g = vca(ctx)
  const end = adsr(g, t, len, vel, 0.002, 0.18, 0.2, 0.09)
  const lp = biquad(ctx, 'lowpass', cut, q)
  lp.frequency.setValueAtTime(Math.min(cut * env, 15000), t)
  lp.frequency.exponentialRampToValueAtTime(cut, t + decay)
  for (const d of [-spread, 0, spread]) osc(ctx, type, f, t, end - t, d).connect(lp)
  lp.connect(g)
  pan(ctx, g, out, p)
}

// plucked string: quick, round, rings on
export function harp(ctx, out, t, { note, vel = 1, ring = 1.4, p = 0 } = {}) {
  const f = mtof(note)
  const g = vca(ctx)
  perc(g, t, vel, 0.002, ring)
  for (const [type, mult, lvl, dec] of [['triangle', 1, 1, 1], ['sine', 2, 0.35, 0.5], ['sine', 3, 0.14, 0.25], ['sine', 4.02, 0.06, 0.12]]) {
    const o = osc(ctx, type, f * mult, t, ring + 0.02)
    const og = vca(ctx)
    perc(og, t, lvl, 0.001, ring * dec)
    o.connect(og).connect(g)
  }
  pan(ctx, g, out, p)
}

// struck metal: the chime a hidden room makes when it is found
export function bell(ctx, out, t, { note, vel = 1, ring = 1.8, p = 0 } = {}) {
  const f = mtof(note)
  const g = vca(ctx)
  perc(g, t, vel, 0.001, ring)
  const car = osc(ctx, 'sine', f, t, ring + 0.02)
  const mod = osc(ctx, 'sine', f * 3.51, t, ring + 0.02)
  const idx = vca(ctx)
  idx.gain.setValueAtTime(f * 2.2, t)
  idx.gain.exponentialRampToValueAtTime(f * 0.05, t + ring * 0.6)
  mod.connect(idx).connect(car.frequency)
  car.connect(g)
  pan(ctx, g, out, p)
}

// ── voices that are nearly voices ─────────────────────────────────────────────────────────────────
const VOWELS = {
  a: [[730, 1], [1090, 0.5], [2440, 0.25]],
  o: [[500, 1], [840, 0.45], [2400, 0.12]],
  e: [[460, 1], [1750, 0.4], [2500, 0.25]],
  i: [[300, 1], [2200, 0.35], [2950, 0.25]],
  u: [[330, 1], [800, 0.3], [2300, 0.1]],
}
function formants(ctx, input, vowel, to = null, t = 0, glide = 0) {
  const sum = vca(ctx, 1)
  VOWELS[vowel].forEach(([f, lvl], i) => {
    const bp = biquad(ctx, 'bandpass', f, 7)
    if (to) {
      bp.frequency.setValueAtTime(f, t)
      bp.frequency.linearRampToValueAtTime(VOWELS[to][i][0], t + glide)
    }
    const g = vca(ctx, lvl * 2.6)
    input.connect(bp).connect(g).connect(sum)
  })
  return sum
}

// a choir on one vowel, for when the kick goes away
export function choir(ctx, out, t, { notes, len = 4, vel = 1, vowel = 'a', a = 0.6, r = 1.2 } = {}) {
  const g = vca(ctx)
  const end = adsr(g, t, len, vel / Math.sqrt(notes.length), a, 0.5, 0.9, r)
  const pre = vca(ctx, 1)
  const vib = osc(ctx, 'sine', 5.1, t, end - t)
  const vg = vca(ctx, 7)
  vib.connect(vg)
  for (const n of notes) {
    const f = mtof(n)
    for (const d of [-9, 8]) {
      const o = osc(ctx, 'sawtooth', f, t, end - t, d)
      vg.connect(o.detune)
      o.connect(pre)
    }
  }
  formants(ctx, pre, vowel).connect(g).connect(out)
}

// a sung syllable cut out of a record that never existed
export function vox(ctx, out, t, { note, len = 0.14, vel = 1, vowel = 'a', to = null, bend = 0, p = 0 } = {}) {
  const f = mtof(note)
  const g = vca(ctx)
  const end = adsr(g, t, len, vel, 0.012, 0.2, 0.75, 0.06)
  const pre = vca(ctx, 1)
  for (const [type, d, lvl] of [['sawtooth', -6, 0.7], ['square', 5, 0.3]]) {
    const o = osc(ctx, type, f, t, end - t, d)
    if (bend) {
      o.frequency.setValueAtTime(f * 2 ** (bend / 12), t)
      o.frequency.exponentialRampToValueAtTime(f, t + 0.05)
    }
    const og = vca(ctx, lvl)
    o.connect(og).connect(pre)
  }
  const breath = src(ctx, material(ctx).white, t, end - t)
  const bg = vca(ctx, 0.05)
  breath.connect(bg).connect(pre)
  const sum = formants(ctx, pre, vowel, to, t, len)
  sum.connect(g)
  pan(ctx, g, out, p)
}

// saws in octaves that swoop up into the note: the sound of a warehouse in 1992
export function hoover(ctx, out, t, { note, len = 0.4, vel = 1, swoop = -12, p = 0 } = {}) {
  const f = mtof(note)
  const g = vca(ctx)
  const end = adsr(g, t, len, vel, 0.01, 0.3, 0.8, 0.1)
  const lp = biquad(ctx, 'lowpass', 3600, 1)
  const wob = osc(ctx, 'triangle', 6.3, t, end - t)
  const wg = vca(ctx, 22)
  wob.connect(wg)
  for (const [mult, d, lvl] of [[0.5, -14, 0.8], [1, 12, 1], [1, -11, 1], [2, 7, 0.45]]) {
    const o = osc(ctx, 'sawtooth', f * mult, t, end - t, d)
    o.frequency.setValueAtTime(f * mult * 2 ** (swoop / 12), t)
    o.frequency.exponentialRampToValueAtTime(f * mult, t + 0.09)
    wg.connect(o.detune)
    const og = vca(ctx, lvl * 0.4)
    o.connect(og).connect(lp)
  }
  lp.connect(g)
  pan(ctx, g, out, p)
}

// ── the silver box: one oscillator, one filter, one envelope, and slides and accents between steps ──
export class Acid {
  constructor(ctx, out, { type = 'sawtooth', level = 0.5 } = {}) {
    this.ctx = ctx
    this.osc = ctx.createOscillator()
    this.osc.type = type
    this.f1 = biquad(ctx, 'lowpass', 400, 9)
    this.f2 = biquad(ctx, 'lowpass', 400, 1.1)
    this.vca = vca(ctx, 0)
    this.drive = ctx.createWaveShaper()
    const n = 1024
    const curve = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1
      curve[i] = Math.tanh(x * 2.6) / Math.tanh(2.6)
    }
    this.drive.curve = curve
    this.out = vca(ctx, level)
    this.osc.connect(this.f1).connect(this.f2).connect(this.vca).connect(this.drive).connect(this.out).connect(out)
    this.osc.start()
    this.last = null
  }
  // cut: resting cutoff in Hz; env: how many octaves the envelope opens it; res: 0..1
  note(t, dur, { note, accent = false, slide = false, gate = 0.55, cut = 400, env = 2.5, res = 0.7, decay = 0.2, vel = 1 }) {
    const f = mtof(note)
    const o = this.osc.frequency
    const tied = this.last && this.last.slide // the step before asked to slide into this one
    if (tied) {
      o.setValueAtTime(this.last.f, t)
      o.exponentialRampToValueAtTime(f, t + 0.055)
    } else o.setValueAtTime(f, t)
    const peak = cut * 2 ** (env * (accent ? 1.35 : 1))
    const q = 2 + res * 15 * (accent ? 1.15 : 1)
    for (const flt of [this.f1, this.f2]) {
      if (!tied) {
        flt.frequency.setValueAtTime(Math.min(peak, 14000), t)
        flt.frequency.setTargetAtTime(cut, t + 0.004, (accent ? decay * 0.6 : decay) / 3)
      }
    }
    this.f1.Q.setValueAtTime(q, t)
    const level = (accent ? 1 : 0.62) * vel
    const g = this.vca.gain
    if (!tied) {
      g.setValueAtTime(0, t)
      g.linearRampToValueAtTime(level, t + 0.003)
    } else g.setTargetAtTime(level, t, 0.01)
    // a slide holds the note into the next step; otherwise it is let go part-way through
    if (!slide) g.setTargetAtTime(0, t + dur * gate, 0.012)
    this.last = { f, slide }
  }
  rest() {
    this.last = null
  }
  stop(t) {
    this.vca.gain.cancelScheduledValues(t)
    this.vca.gain.setTargetAtTime(0, t, 0.01)
    this.osc.stop(t + 0.2)
    setTimeout(() => this.out.disconnect(), 800)
  }
}
