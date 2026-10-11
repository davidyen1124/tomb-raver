// A bench for the sound alone (not built, not deployed): renders a scenario faster than real time on an
// offline context and hands the samples to scripts/listen.mjs, which measures them.
import { createEngine, CONTROLS } from './audio/engine.js'
import { press, CRATE } from './audio/records.js'
import { createGhost } from './dj/ghost.js'
import { createDesk } from './dj/desk.js'
import { createHands } from './dj/hands.js'
import { createBrain } from './dj/brain.js'

const SR = 44100

// run a scenario; at(time, callback) lets it do something at a point on the clock, and a scenario that
// returns `tick` has it called every `step` seconds, the way the page's own loop would
async function render(seconds, setup) {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * SR), SR)
  const engine = createEngine(ctx)
  for (const c of CONTROLS) engine.mixer.set(c.id, c.home, 0)
  const todo = []
  const at = (t, cb) => todo.push({ t, cb })
  const info = setup(engine, at) || {}
  todo.sort((a, b) => a.t - b.t)
  const STEP = info.step || 0.25
  engine.lookahead = STEP + 0.06
  for (let i = 0; i * STEP < seconds; i++) {
    const t = i * STEP
    ctx.suspend(t).then(() => {
      while (todo.length && todo[0].t <= t + 1e-6) todo.shift().cb(t)
      if (info.tick) info.tick(t, STEP)
      engine.tick()
      ctx.resume()
    })
  }
  const buf = await ctx.startRendering()
  if (info.done) Object.assign(info, info.done())
  return { info, l: buf.getChannelData(0), r: buf.getChannelData(1) }
}

// a knob turned by hand: from where it is to `to`, over `dur` seconds
function turn(engine, at, id, t0, dur, from, to) {
  const n = Math.max(1, Math.round(dur / 0.25))
  for (let i = 0; i <= n; i++) at(t0 + (dur * i) / n, (t) => engine.mixer.set(id, from + ((to - from) * i) / n, t))
}
const open = (engine) => {
  engine.mixer.set('A.fader', 1, 0)
  engine.mixer.set('xfader', 0, 0)
}

const SCENARIOS = {
  // one record from the first bar to the last, channel wide open
  solo({ id, pc = 9, seed = 1 }) {
    const rec = press(id, pc, seed)
    return {
      seconds: (rec.bars * 240) / rec.bpm + 2,
      setup(engine) {
        engine.decks.A.load(rec)
        open(engine)
        engine.decks.A.startAt(0.1)
        return { bpm: rec.bpm, sections: rec.sections, start: 0.1 }
      },
    }
  },
  // eight bars from the drop: the record at its fullest, for setting levels
  drop({ id, pc = 9, seed = 1, bars = 8, raw = false }) {
    const rec = press(id, pc, seed)
    return {
      seconds: (bars * 240) / rec.bpm + 0.5,
      setup(engine) {
        if (raw) {
          // what the deck hands to the mixer, before the master's compressor and limiter
          engine.mixer.out.disconnect()
          engine.decks.A.out.connect(engine.ctx.destination)
        }
        engine.decks.A.load(rec)
        open(engine)
        engine.decks.A.startAt(0.1, rec.cue.drop)
        return { bpm: rec.bpm, start: 0.1 }
      },
    }
  },
  // one record, with every control on its channel worked in turn, from the drop
  knobs({ id = 'crystal', pc = 9, seed = 1 }) {
    const rec = press(id, pc, seed)
    const bar = 240 / rec.bpm
    return {
      seconds: 0.1 + 4 * bar + 9 * 6 * bar + 1,
      setup(engine, at) {
        engine.decks.A.load(rec)
        open(engine)
        engine.decks.A.startAt(0.1, rec.cue.drop)
        const marks = [{ name: 'flat', t0: 0.1, t1: 0.1 + 4 * bar }]
        let t = 0.1 + 4 * bar
        const move = (name, ctl, home, to) => {
          marks.push({ name, t0: t, t1: t + 4 * bar })
          turn(engine, at, ctl, t, bar, home, to)
          turn(engine, at, ctl, t + 3 * bar, bar, to, home)
          t += 6 * bar
        }
        move('low killed', 'A.low', 0.5, 0)
        move('mid killed', 'A.mid', 0.5, 0)
        move('hi killed', 'A.hi', 0.5, 0)
        move('filter: low-pass', 'A.filter', 0.5, 0.08)
        move('filter: high-pass', 'A.filter', 0.5, 0.92)
        move('echo', 'echo', 0, 0.8)
        move('reverb', 'reverb', 0, 0.8)
        move('fader half', 'A.fader', 1, 0.5)
        move('crossfader across', 'xfader', 0, 1)
        return { bpm: rec.bpm, marks, start: 0.1 }
      },
    }
  },
  // the DJ's own set: the brain and the hands, with a ghost for a body
  set({ seconds = 360, seed = 1 }) {
    return {
      seconds,
      setup(engine, at) {
        const { stage, puppet } = createGhost()
        const desk = createDesk(engine, stage)
        const hands = createHands({ stage, puppet, desk })
        const brain = createBrain({ engine, stage, puppet, hands, desk, seed })
        const touched = []
        let last = null
        at(0.1, () => brain.start())
        return {
          step: 0.04,
          tick(now, dt) {
            brain.update(now)
            const env = brain.env(now)
            hands.update(now, dt, env.beat)
            puppet.update(dt)
            const t = hands.lastTouch
            if (t && t !== last && t.tag !== last?.tag) touched.push({ text: `  · ${t.tag}`, at: t.at })
            last = t
          },
          done: () => ({
            log: [...brain.state.log, ...touched, ...hands.missed].sort((a, b) => a.at - b.at).map((l) => `${(l.at / 60) | 0}:${String(Math.floor(l.at % 60)).padStart(2, '0')}  ${l.text}`),
            touches: desk.touches,
            records: brain.state.records,
          }),
        }
      },
    }
  },
}

window.bench = {
  crate: CRATE.map((r) => r.id),
  async run(name, opts = {}) {
    const sc = SCENARIOS[name](opts)
    const seconds = sc.seconds
    const { info, l, r } = await render(seconds, sc.setup)
    delete info.tick
    delete info.done
    // 16-bit interleaved, base64, in pieces small enough to hand across
    const pcm = new Int16Array(l.length * 2)
    for (let i = 0; i < l.length; i++) {
      pcm[i * 2] = Math.max(-1, Math.min(1, l[i])) * 32767
      pcm[i * 2 + 1] = Math.max(-1, Math.min(1, r[i])) * 32767
    }
    const bytes = new Uint8Array(pcm.buffer)
    let bin = ''
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
    return { info: { ...info, seconds, sr: SR }, pcm: btoa(bin) }
  },
}
