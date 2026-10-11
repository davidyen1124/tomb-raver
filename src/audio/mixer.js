// The mixer: two channels (trim, three-band isolator, filter, fader), a crossfader, an echo and a
// reverb that can be pointed at either channel or at both, and a master. Every control is a number
// from 0 to 1, the way a knob is; what the number does to the sound is decided here and nowhere else.
import { makeIR } from './deck.js'

export const XOVER = { low: 250, high: 2500 } // where the isolator splits the band, in Hz

const clamp01 = (v) => Math.max(0, Math.min(1, v))
const dB = (x) => 10 ** (x / 20)

// what each control does, as plain numbers (also used to describe the move on screen)
export const curve = {
  trim: (v) => dB((v - 0.5) * 24), // noon is unity, +-12 dB
  // an isolator: fully off at the bottom, unity at noon, +6 dB at the top
  eq: (v) => (v <= 0.5 ? (v * 2) ** 2.4 : dB((v - 0.5) * 12)),
  fader: (v) => v ** 1.7,
  master: (v) => (v / 0.75) ** 2,
  send: (v) => v ** 1.4,
  // one knob, two filters: left of noon a low-pass comes down, right of noon a high-pass goes up
  filter(v) {
    const dead = 0.035
    const lo = v < 0.5 - dead ? (0.5 - dead - v) / (0.5 - dead) : 0
    const hi = v > 0.5 + dead ? (v - 0.5 - dead) / (0.5 - dead) : 0
    return {
      lp: 20000 * (90 / 20000) ** lo,
      hp: 20 * (7000 / 20) ** hi,
      q: lo > 0 || hi > 0 ? 0.9 + 2.1 * Math.min(1, Math.max(lo, hi) * 6) : 0.707,
    }
  },
  // both channels are fully up through the middle of the crossfader's travel
  xfade: (x) => [Math.min(1, 2 * (1 - x)) ** 1.6, Math.min(1, 2 * x) ** 1.6],
}

function lr4(ctx, type, f) {
  // two Butterworth sections in a row: a Linkwitz-Riley slope, so the three bands add back up flat
  const a = ctx.createBiquadFilter()
  const b = ctx.createBiquadFilter()
  for (const n of [a, b]) {
    n.type = type
    n.frequency.value = f
    n.Q.value = Math.SQRT1_2
  }
  a.connect(b)
  return { in: a, out: b }
}

class Channel {
  constructor(ctx, source) {
    this.ctx = ctx
    this.trim = ctx.createGain()
    source.connect(this.trim)
    const low = lr4(ctx, 'lowpass', XOVER.low)
    const rest = lr4(ctx, 'highpass', XOVER.low)
    const mid = lr4(ctx, 'lowpass', XOVER.high)
    const high = lr4(ctx, 'highpass', XOVER.high)
    this.low = ctx.createGain()
    this.mid = ctx.createGain()
    this.hi = ctx.createGain()
    const eq = ctx.createGain()
    this.trim.connect(low.in)
    this.trim.connect(rest.in)
    rest.out.connect(mid.in)
    rest.out.connect(high.in)
    low.out.connect(this.low).connect(eq)
    mid.out.connect(this.mid).connect(eq)
    high.out.connect(this.hi).connect(eq)
    // the filter knob: two sections each way, the second one carries the resonance
    this.lp = [ctx.createBiquadFilter(), ctx.createBiquadFilter()]
    this.hp = [ctx.createBiquadFilter(), ctx.createBiquadFilter()]
    for (const f of this.lp) {
      f.type = 'lowpass'
      f.frequency.value = 20000
    }
    for (const f of this.hp) {
      f.type = 'highpass'
      f.frequency.value = 20
    }
    this.pre = ctx.createGain() // what the channel meter and the headphones hear
    eq.connect(this.lp[0]).connect(this.lp[1]).connect(this.hp[0]).connect(this.hp[1]).connect(this.pre)
    this.fader = ctx.createGain()
    this.xf = ctx.createGain()
    this.post = ctx.createGain()
    this.pre.connect(this.fader).connect(this.xf).connect(this.post)
    this.meter = ctx.createAnalyser()
    this.meter.fftSize = 512
    this.pre.connect(this.meter)
    this.fx = ctx.createGain() // how much of this channel the effects are listening to
    this.post.connect(this.fx)
    this.cue = ctx.createGain()
    this.cue.gain.value = 0
    this.pre.connect(this.cue)
  }
}

export class Mixer {
  constructor(ctx, decks, ir = makeIR(ctx)) {
    this.ctx = ctx
    this.ch = { A: new Channel(ctx, decks.A.out), B: new Channel(ctx, decks.B.out) }
    this.sum = ctx.createGain()
    this.ch.A.post.connect(this.sum)
    this.ch.B.post.connect(this.sum)

    // echo: one beat, fed back through a narrowing band so it sinks as it repeats
    const fxBus = ctx.createGain()
    this.ch.A.fx.connect(fxBus)
    this.ch.B.fx.connect(fxBus)
    this.echoIn = ctx.createGain()
    this.echoIn.gain.value = 0
    this.echo = ctx.createDelay(2)
    this.echo.delayTime.value = 0.48
    this.echoFb = ctx.createGain()
    this.echoFb.gain.value = 0.62
    const eLP = ctx.createBiquadFilter()
    eLP.type = 'lowpass'
    eLP.frequency.value = 4200
    const eHP = ctx.createBiquadFilter()
    eHP.type = 'highpass'
    eHP.frequency.value = 260
    fxBus.connect(this.echoIn).connect(this.echo)
    this.echo.connect(eHP).connect(eLP).connect(this.echoFb).connect(this.echo)
    eLP.connect(this.sum)

    this.revIn = ctx.createGain()
    this.revIn.gain.value = 0
    const rHP = ctx.createBiquadFilter()
    rHP.type = 'highpass'
    rHP.frequency.value = 300
    const conv = ctx.createConvolver()
    conv.buffer = ir
    const rOut = ctx.createGain()
    rOut.gain.value = 1.3
    fxBus.connect(this.revIn).connect(rHP).connect(conv).connect(rOut).connect(this.sum)

    this.master = ctx.createGain()
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -11
    comp.knee.value = 8
    comp.ratio.value = 3
    comp.attack.value = 0.012
    comp.release.value = 0.2
    const lim = ctx.createWaveShaper()
    const n = 4096
    const c = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1
      c[i] = Math.tanh(x * 1.1) / Math.tanh(1.1)
    }
    lim.curve = c
    lim.oversample = '2x'
    this.out = ctx.createGain()
    this.out.gain.value = 0.9
    this.sum.connect(this.master).connect(comp).connect(lim).connect(this.out)
    this.meter = ctx.createAnalyser()
    this.meter.fftSize = 2048
    this.meter.smoothingTimeConstant = 0.6
    this.out.connect(this.meter)

    // the headphones: whatever is cued leaks out of one cup, thin and to one side
    const cueBP = ctx.createBiquadFilter()
    cueBP.type = 'bandpass'
    cueBP.frequency.value = 2300
    cueBP.Q.value = 0.9
    const cueOut = ctx.createGain()
    cueOut.gain.value = 0.07
    this.cueOut = cueOut
    this.ch.A.cue.connect(cueBP)
    this.ch.B.cue.connect(cueBP)
    cueBP.connect(cueOut)
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner()
      p.pan.value = -0.7
      cueOut.connect(p).connect(this.out)
    } else cueOut.connect(this.out)

    this.out.connect(ctx.destination)
    this.values = {}
    this.buf = new Float32Array(512)
    this.spec = new Uint8Array(this.meter.frequencyBinCount)
    this.bigBuf = new Float32Array(2048)
  }

  // turn one control to `v` (0..1). `t` is when, on the audio clock; changes glide over a few milliseconds.
  set(id, v, t = this.ctx.currentTime) {
    v = clamp01(v)
    this.values[id] = v
    const [chName, what] = id.includes('.') ? id.split('.') : [null, id]
    const ch = chName && this.ch[chName]
    const to = (param, value, tc = 0.012) => param.setTargetAtTime(value, t, tc)
    switch (what) {
      case 'trim':
        return to(ch.trim.gain, curve.trim(v))
      case 'hi':
      case 'mid':
      case 'low':
        return to(ch[what].gain, curve.eq(v))
      case 'filter': {
        const f = curve.filter(v)
        to(ch.lp[0].frequency, f.lp, 0.02)
        to(ch.lp[1].frequency, f.lp, 0.02)
        to(ch.hp[0].frequency, f.hp, 0.02)
        to(ch.hp[1].frequency, f.hp, 0.02)
        to(ch.lp[1].Q, f.lp < 19000 ? f.q : 0.707)
        to(ch.hp[1].Q, f.hp > 25 ? f.q : 0.707)
        return
      }
      case 'fader':
        return to(ch.fader.gain, curve.fader(v), 0.008)
      case 'cue':
        return to(ch.cue.gain, v > 0.5 ? 1 : 0, 0.03)
      case 'xfader': {
        const [a, b] = curve.xfade(v)
        to(this.ch.A.xf.gain, a, 0.006)
        to(this.ch.B.xf.gain, b, 0.006)
        return
      }
      case 'master':
        return to(this.master.gain, curve.master(v))
      case 'echo':
        return to(this.echoIn.gain, curve.send(v), 0.02)
      case 'reverb':
        return to(this.revIn.gain, curve.send(v) * 0.9, 0.03)
      case 'fxsel':
        // a three-way switch: A, both, B
        to(this.ch.A.fx.gain, v < 0.75 ? 1 : 0, 0.01)
        to(this.ch.B.fx.gain, v > 0.25 ? 1 : 0, 0.01)
        return
    }
  }

  setTempo(bpm, t = this.ctx.currentTime) {
    if (bpm > 0) this.echo.delayTime.setTargetAtTime(60 / bpm, t, 0.08) // one beat
  }

  // loudness of a channel before its fader, 0..1 on something like a meter's scale
  level(name) {
    const a = name === 'M' ? this.meter : this.ch[name].meter
    const buf = name === 'M' ? this.bigBuf : this.buf
    a.getFloatTimeDomainData(buf)
    let peak = 0
    let sq = 0
    for (let i = 0; i < buf.length; i++) {
      const x = Math.abs(buf[i])
      if (x > peak) peak = x
      sq += x * x
    }
    return { peak, rms: Math.sqrt(sq / buf.length) }
  }
  // energy below about 140 Hz, in the middle and at the top of what is going out, each 0..1
  bands() {
    this.meter.getByteFrequencyData(this.spec)
    const hz = this.ctx.sampleRate / this.meter.fftSize
    const avg = (f0, f1) => {
      let s = 0
      const a = Math.max(1, Math.round(f0 / hz))
      const b = Math.round(f1 / hz)
      for (let i = a; i <= b; i++) s += this.spec[i]
      return s / (b - a + 1) / 255
    }
    return { low: avg(35, 140), mid: avg(400, 2500), high: avg(5000, 12000) }
  }
}
