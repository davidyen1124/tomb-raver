// What DJ MONOLITH knows. It chooses the next record, and plans each mix the way the tutorials teach
// it (ref/REFERENCES.md): the new record is let go sixteen bars before the change, on a phrase; eight
// bars in the headphones; eight bars coming up with half its low taken out; the basses swapped on the
// one; then the old record dissolved, out by the one, or thrown into an echo. Between mixes: a reverb in
// the breakdown, a filter wound up through a build and let go on the drop, an arm in the air.
// Everything here is a plan in bars. hands.js carries it out, one fingertip at a time.
import * as THREE from 'three'
import { press, CRATE, STYLE_NAMES, keyName } from '../audio/records.js'

const BAR = 16 // sixteenths

export function createBrain({ engine, stage, puppet, hands, desk, seed = (Math.random() * 1e9) | 0 }) {
  const { decks } = engine
  let rs = seed >>> 0
  const rand = () => ((rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0) / 4294967296)
  const pick = (list) => list[Math.floor(rand() * list.length)]

  const vis = { A: { loaded: false, sleeve: null, needle: 0 }, B: { loaded: false, sleeve: null, needle: 0 } }
  const carry = { on: false, hand: 'l', sleeve: null }
  const state = { live: null, mixing: null, started: false, log: [], history: [], dropAt: -100, gaze: 'desk', tilt: 0, records: 0, pump: null, style: '' }
  const timers = []
  const other = (d) => (d === 'A' ? 'B' : 'A')
  const handFor = (d) => (d === 'A' ? 'l' : 'r') // deck A is on the DJ's left
  const say = (text) => {
    state.log.push({ text, at: engine.ctx.currentTime })
    if (state.log.length > 200) state.log.shift()
  }

  // ── places a hand can go that are not controls ─────────────────────────────
  const v = new THREE.Vector3()
  const at = {
    crate: () => v.set(1.5, 1.42, -0.42),
    handover: () => v.set(0.05, 1.5, 0.7),
    edge: (d) => () => stage.deckPoint(d, 'edge', v),
    label: (d) => () => stage.deckPoint(d, 'label', v),
    rim: (d) => () => stage.deckPoint(d, 'rim', v),
    needle: (d) => () => stage.deckPoint(d, 'needle', v),
    cup: (s) => () => puppet.onBody(s === 'l' ? 0.84 : -0.84, 1.5, 0.02, v),
    air: (s) => () => {
      const beat = decks[state.live]?.posAt(engine.ctx.currentTime) / 4 || 0
      return puppet.onBody((s === 'l' ? 1 : -1) * 0.72, 2.42 + Math.exp(-(beat % 1) * 4) * 0.2, 0.3, v)
    },
    belly: (s) => () => puppet.onBody((s === 'l' ? 1 : -1) * 0.15, 0.98, 0.72, v),
  }

  // ── a plan is written against a clock: a deck, whose position in sixteenths is the time ──────────
  const wall = { t0: 0, stepDur: 0.1, playing: true, posAt: (t) => (t - wall.t0) * 10, timeOf: (s) => wall.t0 + s / 10 }
  function on(clock, shift = 0) {
    const S = (s) => s - shift
    return {
      lane: (ctl, s0, s1, to, o = {}) => hands.add({ clock, ctl, s0: S(s0), s1: S(s1), to: typeof to === 'function' ? null : to, toAt: typeof to === 'function' ? to : null, ...o }),
      pose: (hand, s0, s1, point, o = {}) => hands.add({ clock, hand, s0: S(s0), s1: S(s1), point, flat: 1, pri: 1, grace: 2, ...o }),
      at: (s, fn) => timers.push({ clock, s: S(s), fn }),
      ahead: (s, fn) => timers.push({ clock, s: S(s), fn, ahead: 0.45 }),
    }
  }

  // ── records ──────────────────────────────────────────────────────────────
  function nextRecord(cur) {
    const recent = state.history.slice(-5)
    const pool = CRATE.filter((r) => !recent.includes(r.id))
    if (!cur) return press(pick(pool.filter((r) => r.bpm <= 127)).id, pick([9, 7, 5, 2, 0]), (rand() * 1e6) | 0)
    const tempo = cur.bpm
    const near = pool.filter((r) => Math.abs(r.bpm / tempo - 1) <= 0.062)
    let def
    // mostly the next record is one that can be blended, a little faster if anything; now and then, a jump
    if (near.length && rand() > 0.14) {
      const w = near.map((r) => Math.exp(-Math.abs(r.bpm - tempo - 2) / 3))
      let x = rand() * w.reduce((a, b) => a + b, 0)
      def = near.find((r, i) => (x -= w[i]) <= 0) || near[0]
    } else {
      const far = pool.filter((r) => !near.includes(r))
      def = far.length ? pick(far) : pick(pool)
    }
    const blend = Math.abs(def.bpm / tempo - 1) <= 0.062
    // a record that will be blended is pressed in a key that sits with the one playing
    const pc = cur.pc + (blend ? pick([0, 0, 7, 5]) : pick([0, 2, 5, 7, 10]))
    return press(def.id, pc, (rand() * 1e6) | 0)
  }

  // carry a record from the box to a deck: a hand to the box, across (changing hands for the far deck), down
  function fetch(p, d, rec, s) {
    const h = handFor(d)
    p.at(s - 6, () => (state.gaze = 'left'))
    p.pose('l', s, s + 12, at.crate, { tag: `pulls out "${rec.title}"`, onTouch: () => Object.assign(carry, { on: true, hand: 'l', sleeve: rec.id }), pri: 2, grace: 60 })
    let t = s + 14
    if (h === 'r') {
      p.pose('l', t, t + 8, at.handover, { pri: 2, flat: 0, grace: 60 })
      p.pose('r', t + 2, t + 8, at.handover, { pri: 2, flat: 0, grace: 60, onTouch: () => (carry.hand = 'r') })
      t += 10
    }
    p.at(t - 2, () => (state.gaze = 'desk'))
    p.pose(h, t, t + 8, at.label(d), {
      pri: 2,
      grace: 60,
      tag: `puts it on deck ${d}`,
      onTouch: () => {
        carry.on = false
        decks[d].load(rec)
        Object.assign(vis[d], { loaded: true, sleeve: rec.id })
      },
    })
    p.pose(h, t + 12, t + 20, at.needle(d), {
      pri: 2,
      grace: 60,
      flat: 0,
      tag: 'drops the needle',
      onTouch: (now) => {
        vis[d].needle = 1
        decks[d].dust.gain.setTargetAtTime(0.05, now, 0.05) // the run-in groove
      },
    })
    return t + 22
  }
  // and the other way: needle up, record off, back in the box, the channel put straight
  function clear(p, d, s) {
    const h = handFor(d)
    p.pose(h, s, s + 6, at.needle(d), { pri: 2, grace: 80, flat: 0, tag: `lifts the needle off ${d}`, onTouch: () => (vis[d].needle = 0) })
    p.pose(h, s + 10, s + 18, at.label(d), {
      pri: 2,
      grace: 80,
      onTouch: () => {
        Object.assign(carry, { on: true, hand: h, sleeve: vis[d].sleeve })
        vis[d].loaded = false
        decks[d].unload()
      },
    })
    let t = s + 20
    if (h === 'r') {
      p.pose('r', t, t + 8, at.handover, { pri: 2, flat: 0, grace: 80 })
      p.pose('l', t + 2, t + 8, at.handover, { pri: 2, flat: 0, grace: 80, onTouch: () => (carry.hand = 'l') })
      t += 10
    }
    p.at(t, () => (state.gaze = 'left'))
    p.pose('l', t + 2, t + 12, at.crate, { pri: 2, grace: 80, tag: 'files it back in the box', onTouch: () => (carry.on = false) })
    p.at(t + 14, () => (state.gaze = 'desk'))
    t += 18
    for (const k of ['filter', 'low', 'mid', 'hi', 'trim', 'pitch']) {
      if (Math.abs(desk.value[`${d}.${k}`] - 0.5) < 0.01) continue // already there: nothing to touch
      p.lane(`${d}.${k}`, t, t + 4, 0.5, { tag: `sets ${d}'s ${k} back to noon` })
      t += 7
    }
    return t + 8
  }
  const matchPitch = (pd, nd) => () => 0.5 + (decks[pd].bpm / decks[nd].record.bpm - 1) / 0.16

  // ── one record on its own: what he does with it ────────────────────────────────
  function solo(d) {
    const k = decks[d]
    const rec = k.record
    const p = on(k)
    const free = other(d)
    const br = rec.sections.find((s) => s.name === 'break')
    const b0 = br.start * BAR
    const b1 = br.end * BAR
    const now = k.posAt(engine.ctx.currentTime)
    // back to the speed the record was cut at, slowly enough that nobody notices
    if (Math.abs(k.pitch) > 0.001 && now < b0 - 200) p.lane(`${d}.pitch`, now + 40, now + 180, 0.5, { tag: `eases deck ${d} back to zero`, linear: true })
    if (now < b0 - 40) {
      const trick = pick(['echo', 'dip', 'none'])
      if (trick === 'echo') {
        p.lane('echo', b0 - 6, b0 - 2, 0.55, { tag: 'throws the last beat into the echo', pri: 3 })
        p.lane('echo', b0 + 10, b0 + 18, 0, {})
      } else if (trick === 'dip') {
        p.lane(`${d}.filter`, b0 - 34, b0 - 4, 0.24, { tag: 'closes the filter down' })
        p.lane(`${d}.filter`, b0 - 2, b0, 0.5, { tag: 'and opens it on the one', pri: 3 })
      }
    }
    if (now < b0) {
      const len = b1 - b0
      if (rand() < 0.75) {
        p.lane('reverb', b0 + 8, b0 + Math.min(48, len / 2), 0.42, { tag: 'opens the reverb in the breakdown' })
        p.lane('reverb', b1 - 30, b1 - 8, 0, { tag: 'dries it up before the drop' })
      }
      if (rand() < 0.8) {
        p.lane(`${d}.filter`, b1 - Math.min(64, len - 8), b1 - 3, 0.75, { tag: 'winds the filter up through the build' })
        p.lane(`${d}.filter`, b1 - 2, b1, 0.5, { tag: 'lets it go on the drop', pri: 3 })
      }
      // a beat or two after the drop, an arm goes up; the other hand stays on the desk
      const h = handFor(free)
      p.at(b1, (t) => (state.dropAt = t))
      p.at(b1 + 5, () => (state.gaze = 'room'))
      p.pose(h, b1 + 6, b1 + 62, at.air(h), { flat: -1, tag: 'one arm in the air', speed: 16 })
      p.at(b1 + 64, () => (state.gaze = 'desk'))
    }
  }

  // ── the mix: P is playing, N is next ───────────────────────────────────────
  function mix(pd) {
    const nd = other(pd)
    const P = decks[pd]
    const rec = nextRecord(P.record)
    const T = P.record.cue.outro * BAR // the change: beat one of the outgoing record's last section
    const blend = Math.abs(rec.bpm / P.record.bpm - 1) <= 0.062
    const style = !blend ? 'cut' : pick(['long', 'long', 'quick', 'echo'])
    const p = on(P)
    const nh = handFor(nd)
    const ph = handFor(pd)
    const S = blend ? T - 16 * BAR : T // where the new record is let go, in the old record's sixteenths
    const n = on(decks[nd], S) // the same plan, on the new record's clock, for everything after it has started
    state.next = rec
    p.at(S - 180, () => {
      state.mixing = { from: pd, to: nd, style, rec }
      say(`next: "${rec.title}" (${STYLE_NAMES[rec.style]}, ${rec.bpm} bpm, ${keyName(rec.pc)}) — ${style === 'cut' ? 'too far to blend: echo out and drop it' : style === 'long' ? 'a long blend' : style === 'quick' ? 'out by the one' : 'an echo out'}`)
    })
    fetch(p, nd, rec, S - 176)
    if (rec.trim) p.lane(`${nd}.trim`, S - 132, S - 127, 0.5 + rec.trim / 24, { tag: rec.trim > 0 ? `turns ${nd}'s trim up: a quiet pressing` : `backs ${nd}'s trim off: a loud pressing` })

    if (blend) {
      p.lane(`${nd}.low`, S - 120, S - 114, 0.25, { tag: `takes half the low out of ${nd}` })
      p.lane(`${nd}.mid`, S - 108, S - 104, 0.43, { tag: `trims ${nd}'s mid` })
      p.lane(`${nd}.hi`, S - 98, S - 94, 0.43, { tag: `and its top` })
      p.lane(`${nd}.cue`, S - 88, S - 86, 1, { tag: `cues ${nd} in the headphones`, pri: 3 })
      p.lane(`${nd}.pitch`, S - 80, S - 62, matchPitch(pd, nd), { tag: `matches deck ${nd} to ${Math.round(P.record.bpm)}` })
      // one hand on the record, the other on a headphone cup, listening for the one
      p.pose(ph, S - 56, S + 92, at.cup(ph), { flat: 0, tag: 'one ear in the headphones' })
      p.at(S - 54, () => (state.tilt = ph === 'l' ? 1 : -1))
      p.pose(nh, S - 44, S + 1, at.edge(nd), { pri: 3, tag: `holds ${nd} on its first beat` })
      p.ahead(S, (time) => {
        desk.set(`${nd}.pitch`, matchPitch(pd, nd)()) // by the time he lets go it is matched, whatever happened on the way
        decks[nd].startAt(time, 0)
        timers.push({ clock: wall, s: wall.posAt(time), fn: () => desk.set(`${nd}.play`, 1) })
        say(`lets go of "${rec.title}" on the phrase`)
      })
      // eight bars of checking it against the other: a finger on the rim, now and then
      for (const s of [24, 56, 88]) n.pose(nh, S + s, S + s + 5, at.rim(nd), { tag: 'a finger on the rim', grace: 1 })
      n.at(S + 94, () => (state.tilt = 0))
      // eight bars of bringing it up
      n.lane(`${nd}.fader`, S + 128, T - 30, 1, { tag: `brings ${nd} up underneath`, linear: true })
      // the one
      if (style === 'echo') {
        n.lane('fxsel', T - 60, T - 58, pd === 'A' ? 0 : 1, { tag: `points the echo at ${pd}` })
        n.lane(`${pd}.low`, T - 36, T - 32, 0, { tag: `cuts ${pd}'s low first`, pri: 3, lead: 1.4 })
        n.lane(`${nd}.low`, T - 36, T - 32, 0.5, { tag: `and gives ${nd} its bass`, pri: 3, lead: 1.4 })
        n.lane('echo', T - 10, T - 2, 0.6, { tag: 'turns the echo up' })
        n.lane(`${pd}.fader`, T, T + 2, 0, { tag: `shuts ${pd}: the echo carries on alone`, pri: 3, lead: 1.2 })
        n.lane('echo', T + 56, T + 72, 0, { tag: 'lets the echo die' })
        n.lane('fxsel', T + 78, T + 80, 0.5, {})
      } else {
        if (style === 'quick') {
          n.lane(`${pd}.mid`, T - 52, T - 20, 0.16, { tag: `rolls ${pd}'s mid out early` })
          n.lane(`${pd}.hi`, T - 18, T - 6, 0.3, {})
        }
        n.lane(`${pd}.low`, T - 4, T, 0, { tag: 'swaps the basses on the one', pri: 3, lead: 1.5, linear: true })
        n.lane(`${nd}.low`, T - 4, T, 0.5, { tag: 'swaps the basses on the one', pri: 3, lead: 1.5, linear: true })
        if (style === 'quick') n.lane(`${pd}.fader`, T + 1, T + 7, 0, { tag: `${pd} is gone by the one` })
        else {
          n.lane(`${pd}.hi`, T + 34, T + 50, 0.3, { tag: `takes the top off ${pd} to make room` })
          n.lane(`${pd}.filter`, T + 64, T + 116, 0.8, { tag: `sweeps ${pd} away with the filter` })
          n.lane(`${pd}.fader`, T + 106, T + 126, 0, { tag: `and takes ${pd} out` })
        }
      }
      n.lane(`${nd}.mid`, T + 8, T + 12, 0.5, { tag: `${nd}'s mid back to noon` })
      n.lane(`${nd}.hi`, T + 16, T + 20, 0.5, { tag: `and its top` })
      n.lane(`${nd}.cue`, T + 26, T + 28, 0, {})
    } else {
      // too far apart to blend: wind the old one up, throw it into the echo, let the new one start clean
      p.lane(`${nd}.pitch`, S - 120, S - 114, 0.5, {})
      p.lane(`${nd}.cue`, S - 108, S - 106, 1, { tag: `cues ${nd} in the headphones`, pri: 3 })
      p.lane(`${nd}.fader`, S - 96, S - 84, 1, { tag: `opens ${nd}, ready` })
      p.lane('fxsel', S - 76, S - 74, pd === 'A' ? 0 : 1, { tag: `points the echo at ${pd}` })
      p.lane(`${pd}.filter`, S - 64, S - 12, 0.72, { tag: `winds ${pd} up with the filter` })
      p.pose(nh, S - 40, S + 1, at.edge(nd), { pri: 3, tag: `holds ${nd} on its first beat` })
      p.lane('echo', S - 10, S - 2, 0.62, { tag: 'turns the echo up' })
      p.ahead(S, (time) => {
        decks[nd].startAt(time, 0)
        timers.push({ clock: wall, s: wall.posAt(time), fn: () => desk.set(`${nd}.play`, 1) })
        say(`drops "${rec.title}"`)
      })
      n.lane(`${pd}.fader`, T, T + 2, 0, { tag: `shuts ${pd}: the echo carries on alone`, pri: 3, lead: 1.2 })
      n.lane('echo', T + 48, T + 64, 0, { tag: 'lets the echo die' })
      n.lane('fxsel', T + 70, T + 72, 0.5, {})
      n.lane(`${nd}.cue`, T + 26, T + 28, 0, {})
    }
    // the old record stops once nobody can hear it, and is put away; then this one is the one playing
    const out = style === 'long' ? T + 128 : T + 24
    n.ahead(out, (time) => {
      decks[pd].stopAt(time)
      timers.push({ clock: wall, s: wall.posAt(time), fn: () => desk.set(`${pd}.play`, 0) })
    })
    n.pose(ph, out - 4, out + 1, () => stage.controlPoint(`${pd}.play`, v), { flat: 0, pri: 2, tag: `stops deck ${pd}` })
    n.at(out + 2, () => {
      hands.clear((m) => m.clock !== P) // anything still waiting on the old record's clock will wait for ever
      state.live = nd
      state.mixing = null
      state.history.push(rec.id)
      state.records++
      state.style = style
      clear(on(decks[nd]), pd, decks[nd].posAt(engine.ctx.currentTime) + 4)
      solo(nd)
      mix(nd)
    })
  }

  // ── the first record ───────────────────────────────────────────────────────
  // `bar`: begin the first record part-way through (for looking at a mix without waiting two minutes for it)
  function start(bar = 0) {
    const now = engine.ctx.currentTime
    wall.t0 = now
    state.started = true
    // where everything on the desk is now is where it belongs, until a plan says otherwise
    for (const id in desk.value) if (!id.endsWith('.play')) hands.expect[id] ??= desk.value[id]
    const rec = nextRecord(null)
    const p = on(wall)
    say(`first record: "${rec.title}" (${STYLE_NAMES[rec.style]}, ${rec.bpm} bpm)`)
    const t = fetch(p, 'A', rec, 4)
    if (rec.trim) p.lane('A.trim', t - 20, t - 14, 0.5 + rec.trim / 24, { hand: 'r' })
    p.lane('A.fader', t - 12, t - 2, 1, { tag: 'opens channel A', hand: 'r' })
    p.pose('l', t, t + 9, at.edge('A'), { pri: 3, tag: 'holds it on the first beat' })
    p.ahead(t + 8, (time) => {
      decks.A.startAt(time, bar)
      timers.push({
        clock: wall,
        s: wall.posAt(time),
        fn: () => {
          desk.set('A.play', 1)
          state.live = 'A'
          state.history.push(rec.id)
          state.records = 1
          solo('A')
          mix('A')
        },
      })
    })
  }

  // put back anything that has been left where it should not be (a visitor's doing, or a job that ran out of time)
  let tidyAt = 0
  function tidy(now) {
    if (now < tidyAt || !state.live) return
    tidyAt = now + 1.5
    const clock = decks[state.live]
    const pos = clock.posAt(now)
    for (const id in hands.expect) {
      const want = hands.expect[id]
      if (typeof want !== 'number' || Math.abs(desk.value[id] - want) < 0.035) continue
      if (now - hands.heldAt(id) < 6) continue
      // (unless a hand is on it, or about to be: a job planned for later in the record does not count)
      if (hands.moves.some((m) => m.ctl === id && (m.state !== 'waiting' || (m.clock.playing !== false && m.s0 - m.clock.posAt(now) < 48)))) continue
      const c = stage.controls[id]
      hands.add({ clock, ctl: id, s0: pos + 6, s1: pos + 10, to: want, tag: `puts the ${c ? c.id.split('.').pop() : id} back where it was`, pri: 1 })
      return
    }
  }

  function update(now) {
    for (let i = timers.length - 1; i >= 0; i--) {
      const t = timers[i]
      const c = t.clock
      if (t.ahead) {
        if (!c.playing && c !== wall) continue
        const when = c.timeOf(t.s)
        if (when - now < t.ahead) {
          timers.splice(i, 1)
          t.fn(Math.max(when, now + 0.02))
        }
      } else if ((c.playing || c === wall) && c.posAt(now) >= t.s) {
        // (a stopped deck's needle is wherever it was left: its clock means nothing until it runs again)
        timers.splice(i, 1)
        t.fn(now)
      }
    }
    // the music does not stop. If the playing record has been stopped (a visitor's finger), start it again.
    if (state.started && state.live && !decks.A.playing && !decks.B.playing && !state.rescue) {
      const d = state.live
      state.rescue = true
      say('the record has stopped. He starts it again.')
      const when = now + 1.1
      const bar = Math.floor(decks[d].step / BAR) % decks[d].bars
      hands.add({ clock: wall, hand: handFor(d), s0: wall.posAt(when) - 2, s1: wall.posAt(when) + 2, point: () => stage.controlPoint(`${d}.play`, v), flat: 0, pri: 4, tag: 'presses start' })
      timers.push({
        clock: wall,
        s: wall.posAt(when) - 2,
        fn: () => {
          decks[d].startAt(when, bar)
          desk.set(`${d}.play`, 1)
          desk.set(`${d}.fader`, Math.max(desk.value[`${d}.fader`], 0.9))
          state.rescue = false
        },
      })
    }
    tidy(now)
  }

  return {
    start,
    update,
    state,
    vis,
    carry,
    // what the room should be doing: position in beats, how full the record is, time since the last drop
    env(now) {
      const d = state.live
      if (!d || !decks[d].record) return { beat: now * 2, energy: 0.25, drop: null }
      const k = decks[d]
      const pos = k.posAt(now)
      let energy = k.record.sectionAt(Math.floor(pos / BAR)).energy
      const m = state.mixing
      if (m && decks[m.to].playing && decks[m.to].record) energy = Math.max(energy * (0.4 + 0.6 * engine.presence(m.from)), decks[m.to].record.sectionAt(Math.floor(decks[m.to].posAt(now) / BAR)).energy * engine.presence(m.to))
      if (!k.playing) energy = 0.15
      return { beat: pos / 4, energy, drop: now - state.dropAt, gaze: state.gaze, tilt: state.tilt }
    },
  }
}
