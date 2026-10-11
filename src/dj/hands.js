// Two hands and a list of things to do with them. The DJ's brain (brain.js) and the visitor (who can
// grab a control and ask for it to be turned) both hand moves to this file; it decides which hand goes
// where, and it is the only thing that ever changes a control. A control moves only while a fingertip is
// on it. That is the whole point of the page: no touch, no change in the music.
import * as THREE from 'three'

const TOUCH = 0.05 // metres: this close and the fingers are on it
const SLEW = { knob: 2.6, fader: 3.2, switch: 6, button: 99 } // how fast a hand can move a control, per second
const ease = (t) => t * t * (3 - 2 * t)

export function createHands({ stage, puppet, desk }) {
  const moves = [] // everything asked for and not yet finished
  const hand = { l: { side: 'l', move: null, pressed: 0 }, r: { side: 'r', move: null, pressed: 0 } }
  const held = {} // control id -> time the visitor last had it
  const expect = {} // where each control was last deliberately left
  let user = null
  let lastTouch = null // what the last contact was, for the screen to say so
  let clock = 0
  const missed = [] // jobs that ran out of time before a hand was free (the housekeeping picks up the pieces)
  const p3 = new THREE.Vector3()
  // where idle hands lie: one on the start corner of the left deck, one hovering over the front lip of the mixer
  const home = { l: () => p3.set(0.98, 1.115, 0.8), r: () => p3.set(-0.13, 1.15, 0.76) }

  // a move: { clock, s0, s1, point(), ctl?, to?, press?, pri, flat, hand?, tag?, onTouch?, onDone? }
  //   clock: anything with posAt(time) in sixteenths (a deck); s0..s1: when the fingers are on it
  function add(m) {
    m.pri ??= 2
    m.flat ??= 0
    m.lead ??= 0.55 // seconds before s0 that the hand sets off
    m.state = 'waiting'
    moves.push(m)
    return m
  }
  const pointOf = (m, out) => (m.point ? out.copy(m.point()) : stage.controlPoint(m.ctl, out))
  const sideFor = (m) => {
    if (m.hand) return m.hand
    const x = pointOf(m, p3).x
    return x > 0.04 ? 'l' : x < -0.04 ? 'r' : null
  }
  function assign(m) {
    const want = sideFor(m)
    const order = want ? [want, m.hand ? null : want === 'l' ? 'r' : 'l'] : hand.l.move ? ['r', 'l'] : ['l', 'r']
    for (const s of order) {
      if (!s) continue
      const h = hand[s]
      if (!h.move) return take(h, m)
    }
    // both busy: the more urgent job wins the hand it would rather have
    for (const s of order) {
      if (!s) continue
      const h = hand[s]
      if (h.move.pri < m.pri) {
        h.move.state = 'waiting'
        h.move.h = null
        return take(h, m)
      }
    }
    return false
  }
  function take(h, m) {
    h.move = m
    m.h = h
    m.state = 'going'
    return true
  }
  function finish(m, now) {
    if (m.h) {
      m.h.move = null
      m.h = null
    }
    if (m.ctl && typeof m.to === 'number' && !m.user && m.state === 'touching') expect[m.ctl] = m.to
    m.state = 'done'
    if (m.onDone) m.onDone(now)
  }

  const goal = new THREE.Vector3()
  function update(now, dt, beat) {
    clock = now
    // who needs a hand
    for (let i = moves.length - 1; i >= 0; i--) {
      const m = moves[i]
      if (m.state === 'done') {
        moves.splice(i, 1)
        continue
      }
      if (m.user) continue
      if (m.clock.playing === false) {
        // its clock has stopped (a record not yet started, or one that has ended): nothing happens on it
        if (m.h) {
          m.h.move = null
          m.h = null
          m.state = 'waiting'
        }
        continue
      }
      const p = m.clock.posAt(now)
      const lead = m.lead / (m.clock.stepDur || 0.12)
      if (p > m.s1 + (m.grace ?? 12)) {
        // out of time. A control that never got where it was going is left for the housekeeping to find.
        if (m.ctl && m.toAt) m.to = m.toAt()
        if (m.ctl && typeof m.to === 'number') expect[m.ctl] = m.to
        if (m.state !== 'touching' && (m.pri >= 2 || m.ctl)) missed.push({ text: `(never got to: ${m.tag || m.ctl || 'a pose'})`, at: now })
        finish(m, now)
      } else if (m.state === 'waiting' && p >= m.s0 - lead) {
        // (never two hands on one knob: if the visitor has it, wait)
        if (!(user && user.ctl === m.ctl)) assign(m)
      }
    }
    moves.sort((a, b) => a.s0 - b.s0)

    for (const s of ['l', 'r']) {
      const h = hand[s]
      const arm = puppet.arms[s]
      const m = h.move
      h.pressed = Math.max(0, h.pressed - dt * 6)
      if (!m) {
        // nothing to do: rest where the next job is likely to be, and keep time
        arm.goal.copy(home[s]())
        arm.goal.y -= Math.exp(-(beat % 1) * 6) * 0.012
        arm.flat += (1 - arm.flat) * Math.min(1, dt * 8)
        arm.speed = 7
        continue
      }
      pointOf(m, goal)
      const p = m.user ? 0 : m.clock.posAt(now)
      const early = !m.user && p < m.s0
      // arrived early: hover just above it
      if (early && !m.rest) goal.y += 0.035
      arm.goal.copy(goal)
      arm.flat += (m.flat - arm.flat) * Math.min(1, dt * 10)
      arm.speed = m.speed || (m.pri >= 3 ? 20 : 13)
      const near = arm.tip.distanceTo(goal) < TOUCH
      if (!near || early) continue
      if (m.state !== 'touching') {
        m.state = 'touching'
        m.from = m.ctl ? desk.value[m.ctl] : 0
        if (m.toAt) m.to = m.toAt() // where to turn it to is only known now (matching a tempo, say)
        if (m.onTouch) m.onTouch(now)
        if (m.tag) lastTouch = { tag: m.tag, ctl: m.ctl, at: now }
      }
      if (m.ctl) {
        const c = stage.controls[m.ctl]
        const cur = desk.value[m.ctl]
        let want
        if (m.user) want = m.to
        else {
          const span = Math.max(m.s1 - m.s0, 0.001)
          const t = Math.min(1, Math.max(0, (p - m.s0) / span))
          want = typeof m.to === 'function' ? m.to(t) : m.from + (m.to - m.from) * (m.linear ? t : ease(t))
        }
        if (held[m.ctl] && !m.user && now - held[m.ctl] < 2.5) want = cur // the visitor just had this: leave it a moment
        const step = (SLEW[c.kind] || 3) * dt
        const next = Math.abs(want - cur) <= step ? want : cur + Math.sign(want - cur) * step
        if (next !== cur) {
          if (c.kind === 'button') h.pressed = 1
          desk.set(m.ctl, next, h.pressed)
          if (m.tag) lastTouch = { tag: m.tag, ctl: m.ctl, at: now }
        }
        if (m.user) held[m.ctl] = now
        else if (p >= m.s1 && Math.abs(want - next) < 0.004) finish(m, now)
      } else if (!m.user && p >= m.s1) finish(m, now)
    }
    // buttons spring back
    for (const id in stage.controls) {
      const c = stage.controls[id]
      if (c.kind !== 'button') continue
      const down = Math.max(hand.l.move?.ctl === id ? hand.l.pressed : 0, hand.r.move?.ctl === id ? hand.r.pressed : 0)
      stage.setControl(id, desk.value[id] ?? 0, down)
    }
  }

  return {
    add,
    update,
    hand,
    home,
    expect,
    moves,
    missed,
    get lastTouch() {
      return lastTouch
    },
    busy: (s) => !!hand[s].move,
    // the visitor takes hold of a control: the nearer hand drops what it is doing and goes to it
    grab(id) {
      if (user) this.release()
      user = add({ user: true, ctl: id, to: desk.value[id], pri: 5, s0: -Infinity, tag: 'request' })
      const want = sideFor(user) || 'r'
      const h = hand[want]
      if (h.move) {
        h.move.state = 'waiting'
        h.move.h = null
      }
      take(h, user)
      // if the other hand was on its way to this very control, send it home
      const o = hand[want === 'l' ? 'r' : 'l']
      if (o.move && o.move.ctl === id) {
        o.move.state = 'waiting'
        o.move.h = null
        o.move = null
      }
      held[id] = clock
      return user
    },
    turn(v) {
      if (user) user.to = Math.max(0, Math.min(1, v))
    },
    release() {
      if (!user) return
      const m = user
      user = null
      if (m.h) {
        m.h.move = null
        m.h = null
      }
      m.state = 'done'
    },
    get user() {
      return user
    },
    heldAt: (id) => held[id] || -Infinity,
    // drop everything that is not already under a finger (used when the plan changes)
    clear(keep = () => false) {
      for (const m of moves) if (!m.user && m.state !== 'done' && !keep(m)) finish(Object.assign(m, { onDone: null, to: null, toAt: null }), 0)
    },
  }
}
