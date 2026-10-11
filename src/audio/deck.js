// A turntable, as far as the sound goes: it carries one record, plays it a sixteenth-note at a time at
// whatever speed its pitch fader says, and hands the result to one channel of the mixer.
import { buffers } from './voices.js'

// where the instruments of a record go before they are summed; `duck` is how far the kick pushes each down
const BUSES = {
  kick: { duck: 0 },
  drums: { duck: 0 },
  hats: { duck: 0.1 },
  bass: { duck: 0.6 },
  chords: { duck: 0.4, tone: true },
  lead: { duck: 0.22, tone: true },
  pad: { duck: 0.6, tone: true },
  fx: { duck: 0 },
}
const LEVEL = { kick: 0.8, drums: 0.75, hats: 1.9, bass: 0.42, chords: 0.9, lead: 0.8, pad: 0.75, fx: 0.6 }

function softClip(ctx, drive) {
  const s = ctx.createWaveShaper()
  const n = 2048
  const c = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    c[i] = Math.tanh(x * drive) / Math.tanh(drive)
  }
  s.curve = c
  s.oversample = '2x'
  return s
}

// a room that does not exist: noise that dies away, darker as it goes
export function makeIR(ctx, seconds = 2.3) {
  const sr = ctx.sampleRate
  const n = Math.floor(sr * seconds)
  const ir = ctx.createBuffer(2, n, sr)
  let seed = 9001
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch)
    let lp = 0
    for (let i = 0; i < n; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0
      const x = seed / 2147483648 - 1
      const t = i / n
      const k = 0.55 - 0.45 * t // the top goes first
      lp += (x - lp) * k
      const early = i < sr * 0.012 ? i / (sr * 0.012) : 1
      d[i] = lp * early * Math.exp(-5.2 * t) * 0.9
    }
  }
  return ir
}

export class Deck {
  constructor(ctx, name, ir) {
    this.ctx = ctx
    this.name = name
    this.record = null
    this.playing = false
    this.step = 0 // the next sixteenth to be scheduled
    this.nextTime = 0 // and when it sounds
    this.pitch = 0 // -0.08 .. +0.08, as on the fader
    this.stopTime = Infinity
    this.startedAt = 0
    this.kicks = [] // times of the kicks already scheduled, for anything that wants to move with them

    this.sum = ctx.createGain()
    this.sum.gain.value = 0.42 // room above the loudest bar, so the clipper only ever rounds a peak
    this.sat = softClip(ctx, 1.25)
    this.brake = ctx.createDelay(1.5) // a delay that keeps getting longer is a record slowing down
    this.gate = ctx.createGain()
    this.gate.gain.value = 0
    this.out = ctx.createGain()
    this.out.gain.value = 0.5
    // a little air on top, the way a record is cut
    const air = ctx.createBiquadFilter()
    air.type = 'highshelf'
    air.frequency.value = 4800
    air.gain.value = 3.5
    this.sum.connect(this.sat).connect(air).connect(this.brake).connect(this.gate).connect(this.out)

    // the record's own echo and room (pressed into the groove, so they stop when the record does)
    this.dl = ctx.createDelay(2)
    this.dr = ctx.createDelay(2)
    this.fb = ctx.createGain()
    this.fb.gain.value = 0.42
    const fbLP = ctx.createBiquadFilter()
    fbLP.type = 'lowpass'
    fbLP.frequency.value = 3600
    const fbHP = ctx.createBiquadFilter()
    fbHP.type = 'highpass'
    fbHP.frequency.value = 320
    this.dlyIn = ctx.createGain()
    const merge = ctx.createChannelMerger(2)
    this.dlyIn.connect(fbHP).connect(fbLP).connect(this.dl)
    this.dl.connect(this.dr)
    this.dr.connect(this.fb).connect(fbHP)
    this.dl.connect(merge, 0, 0)
    this.dr.connect(merge, 0, 1)
    const dlyOut = ctx.createGain()
    dlyOut.gain.value = 0.9
    merge.connect(dlyOut).connect(this.sum)

    this.revIn = ctx.createGain()
    const revHP = ctx.createBiquadFilter()
    revHP.type = 'highpass'
    revHP.frequency.value = 280
    const conv = ctx.createConvolver()
    conv.buffer = ir
    const revOut = ctx.createGain()
    revOut.gain.value = 0.7
    this.revIn.connect(revHP).connect(conv).connect(revOut).connect(this.sum)

    // kick and drums share a little grit
    this.drumDrive = ctx.createGain()
    const drumSat = softClip(ctx, 1.6)
    this.drumOut = ctx.createGain()
    this.drumDrive.connect(drumSat).connect(this.drumOut).connect(this.sum)
    this.bassDrive = ctx.createGain()
    const bassSat = softClip(ctx, 1.4)
    this.bassOut = ctx.createGain()
    this.bassDrive.connect(bassSat).connect(this.bassOut).connect(this.sum)

    this.bus = {}
    this.strip = {}
    for (const [k, def] of Object.entries(BUSES)) {
      const input = ctx.createGain()
      input.gain.value = LEVEL[k]
      const duck = ctx.createGain()
      let tone = null
      if (def.tone) {
        tone = ctx.createBiquadFilter()
        tone.type = 'lowpass'
        tone.frequency.value = 18000
        tone.Q.value = 0.7
        input.connect(tone).connect(duck)
      } else input.connect(duck)
      const dly = ctx.createGain()
      dly.gain.value = 0
      const rev = ctx.createGain()
      rev.gain.value = 0
      duck.connect(k === 'kick' || k === 'drums' ? this.drumDrive : k === 'bass' ? this.bassDrive : this.sum)
      duck.connect(dly).connect(this.dlyIn)
      duck.connect(rev).connect(this.revIn)
      this.bus[k] = input
      this.strip[k] = { input, duck, tone, dly, rev, depth: def.duck }
    }

    // surface noise
    this.dust = ctx.createGain()
    this.dust.gain.value = 0
    const dustHP = ctx.createBiquadFilter()
    dustHP.type = 'highpass'
    dustHP.frequency.value = 1400
    const d = ctx.createBufferSource()
    d.buffer = buffers(ctx).dust
    d.loop = true
    d.connect(dustHP).connect(this.dust).connect(this.sum)
    d.start()
  }

  get rate() {
    return 1 + this.pitch
  }
  get bpm() {
    return this.record ? this.record.bpm * this.rate : 0
  }
  get stepDur() {
    return 15 / this.bpm
  }
  get bars() {
    return this.record ? this.record.bars : 0
  }

  // put a record on: set the desk it was mixed on, plug in whatever it keeps running
  load(record) {
    if (this.record) this.unload()
    const t = this.ctx.currentTime
    this.record = record
    this.step = 0
    this.kicks.length = 0
    const mix = record.mix || {}
    for (const k in this.strip) {
      const s = this.strip[k]
      s.input.gain.setValueAtTime(LEVEL[k] * (mix.level?.[k] ?? 1), t)
      s.dly.gain.setValueAtTime(mix.dly?.[k] ?? 0, t)
      s.rev.gain.setValueAtTime(mix.rev?.[k] ?? 0, t)
      s.depth = mix.duck?.[k] ?? BUSES[k].duck
      s.duck.gain.cancelScheduledValues(t)
      s.duck.gain.setValueAtTime(1, t)
      if (s.tone) {
        s.tone.frequency.cancelScheduledValues(t)
        s.tone.frequency.setValueAtTime(18000, t)
        s.tone.Q.setValueAtTime(0.7, t)
      }
    }
    this.drumDrive.gain.setValueAtTime(mix.drive?.drums ?? 1, t)
    this.drumOut.gain.setValueAtTime(1 / Math.sqrt(mix.drive?.drums ?? 1), t)
    this.bassDrive.gain.setValueAtTime(mix.drive?.bass ?? 1, t)
    this.bassOut.gain.setValueAtTime(1 / Math.sqrt(mix.drive?.bass ?? 1), t)
    this.fb.gain.setValueAtTime(mix.feedback ?? 0.42, t)
    this.delayBeats = mix.delayBeats ?? 0.75
    this.state = record.attach ? record.attach(this) : {}
    this.retime(t)
  }
  unload() {
    if (!this.record) return
    if (this.record.detach) this.record.detach(this, this.state, this.ctx.currentTime)
    this.record = null
    this.state = null
    this.playing = false
  }
  retime(t) {
    if (!this.record) return
    const d = (60 / this.bpm) * this.delayBeats
    this.dl.delayTime.setTargetAtTime(d, t, 0.05)
    this.dr.delayTime.setTargetAtTime(d, t, 0.05)
  }
  setPitch(p) {
    this.pitch = Math.max(-0.08, Math.min(0.08, p))
    this.retime(this.ctx.currentTime)
  }

  // let go of the record so that bar `bar` lands exactly at `time`
  startAt(time, bar = 0) {
    if (!this.record) return
    this.playing = true
    this.step = bar * 16
    this.nextTime = time
    this.startedAt = time
    this.stopTime = Infinity
    this.brake.delayTime.cancelScheduledValues(time)
    this.brake.delayTime.setValueAtTime(0, time)
    this.gate.gain.cancelScheduledValues(time)
    this.gate.gain.setValueAtTime(0, Math.max(0, time - 0.004))
    this.gate.gain.linearRampToValueAtTime(1, time)
    this.dust.gain.setTargetAtTime(0.05, time, 0.02)
  }
  // press stop. With `brake` the platter winds down audibly, as it does if the channel is still open.
  stopAt(time, brake = 0) {
    if (!this.playing) return
    this.stopTime = time + brake * 0.5
    const g = this.gate.gain
    g.cancelScheduledValues(time)
    if (brake > 0) {
      const n = 32
      const curve = new Float32Array(n)
      for (let i = 0; i < n; i++) curve[i] = ((i / (n - 1)) ** 2 * brake) / 2
      this.brake.delayTime.setValueCurveAtTime(curve, time, brake)
      g.setValueAtTime(1, time + brake * 0.7)
      g.linearRampToValueAtTime(0, time + brake)
      this.brake.delayTime.setValueAtTime(0, time + brake + 0.05)
    } else {
      g.setValueAtTime(1, time)
      g.linearRampToValueAtTime(0, time + 0.012)
    }
    this.dust.gain.setTargetAtTime(0, time + brake, 0.02)
  }

  // every kick leans on the rest of the record for a moment
  pump(t, amount = 1) {
    const rel = this.stepDur * 2 // back up by the off-beat: the breathing every one of these records has
    for (const k in this.strip) {
      const s = this.strip[k]
      if (s.depth <= 0) continue
      s.duck.gain.setTargetAtTime(1 - s.depth * amount, t, 0.004)
      s.duck.gain.setTargetAtTime(1, t + 0.035, rel / 3)
    }
    this.kicks.push(t)
    if (this.kicks.length > 64) this.kicks.splice(0, 32)
  }
  tone(bus, freq, t, q) {
    const f = this.strip[bus].tone
    f.frequency.setTargetAtTime(Math.min(freq, 18000), t, 0.03)
    if (q !== undefined) f.Q.setTargetAtTime(q, t, 0.03)
  }

  // schedule every sixteenth that begins before `horizon`
  tick(now, horizon) {
    if (!this.playing || !this.record) return
    if (this.nextTime < now - 0.08) {
      // fell behind (a sleeping tab): keep the place, skip what was missed
      const dur = this.stepDur
      const n = Math.ceil((now - this.nextTime) / dur)
      this.step += n
      this.nextTime += n * dur
    }
    const total = this.record.bars * 16
    while (this.nextTime < horizon) {
      if (this.nextTime >= this.stopTime) {
        this.playing = false
        return
      }
      // a record left on plays its last eight bars round and round rather than run out
      if (this.step >= total) this.step -= 128
      const dur = this.stepDur
      this.record.play(this, this.state, this.step, this.nextTime, dur)
      this.nextTime += dur
      this.step++
    }
  }

  // where the needle is at `time`, in sixteenths (a fraction while between two)
  posAt(time) {
    if (!this.record) return 0
    if (!this.playing) return this.step
    return this.step - (this.nextTime - time) / this.stepDur
  }
  // when sixteenth number `step` will sound, if the speed is left alone
  timeOf(step) {
    return this.nextTime + (step - this.step) * this.stepDur
  }
  // bars left before the record runs out
  barsLeft(time) {
    return this.record ? this.record.bars - this.posAt(time) / 16 : 0
  }
}
