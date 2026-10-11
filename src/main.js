// Boot, the title screen, the loop, and the little there is on screen during the set.
import './styles.css'
import './cursor.css'
import { createStage } from './webgl/stage.js'
import { createPuppet } from './dj/puppet.js'
import { createEngine } from './audio/engine.js'
import { createDesk } from './dj/desk.js'
import { createHands } from './dj/hands.js'
import { createBrain } from './dj/brain.js'
import { STYLE_NAMES, keyName } from './audio/records.js'

const $ = (s) => document.querySelector(s)
const canvas = $('#canvas')
const q = new URLSearchParams(location.search)

// ── loading ────────────────────────────────────────────────────────────────
// The title is on screen already (it is in the page itself). A bar runs along its foot while the room
// loads; when everything is ready the bar goes and the button appears.
const bootBar = $('[data-boot-bar]')
const stage = await createStage(canvas, { onProgress: (p) => (bootBar.style.width = Math.round(p * 100) + '%') })
const puppet = createPuppet(stage)
bootBar.style.width = '100%'
const grid = () => document.documentElement.style.setProperty('--px', stage.size.pixel + 'px')
grid()
window.addEventListener('resize', grid)
// the button's lettering has to be there before the button is (but do not wait for ever for it)
await Promise.race([Promise.all([document.fonts.load('700 1em Arvo'), document.fonts.load('400 1em Silkscreen')]), new Promise((r) => setTimeout(r, 3000))]).catch(() => {})
$('#app').hidden = false
// the chamber as it is before anybody arrives, waiting behind the title
stage.setShot('front')
puppet.update(0.016, { beat: 0, energy: 0.2 })
stage.render(0.016, { beat: 0, energy: 0.2 })
bootBar.remove()
const startButton = $('[data-start]')
startButton.hidden = false
startButton.focus({ preventScroll: true })

// ── the set ────────────────────────────────────────────────────────────────
let ctx, engine, desk, hands, brain
let started = false
let begunAt = 0
let muted = false

const LABEL = { trim: 'TRIM', hi: 'HI', mid: 'MID', low: 'LOW', filter: 'FILTER', fader: 'FADER', cue: 'CUE', pitch: 'PITCH', play: 'START / STOP' }
const WHOLE = { xfader: 'CROSSFADER', master: 'MASTER', echo: 'ECHO', reverb: 'REVERB', fxsel: 'FX: A / BOTH / B' }
const nameOf = (id) => WHOLE[id] || `${LABEL[id.split('.')[1]]} ${id[0]}`

// A phone's silent switch silences sound that a page synthesises, though not a record played from an
// <audio> element: it takes the one for a ringtone and the other for music. A newer iPhone (iOS 17 on) can
// simply be told which this is. For an older one, a silent <audio> element looping alongside makes the
// same point: while it plays, what the page synthesises is treated as music too. Either has to be done
// from a touch, which is why this is called from New Set and from the prompt.
let hush = null
function unsilence() {
  if (navigator.audioSession) {
    try {
      navigator.audioSession.type = 'playback'
    } catch {}
    return
  }
  const iphone = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (!iphone) return
  if (!hush) {
    // half a second of nothing, as good a recording as the music is (the phone mixes everything down to match it)
    const rate = ctx?.sampleRate || 44100
    const n = Math.floor(rate / 2)
    const wav = new DataView(new ArrayBuffer(44 + n * 4))
    const text = (at, t) => [...t].forEach((c, i) => wav.setUint8(at + i, c.charCodeAt(0)))
    text(0, 'RIFF')
    wav.setUint32(4, 36 + n * 4, true)
    text(8, 'WAVEfmt ')
    wav.setUint32(16, 16, true)
    wav.setUint16(20, 1, true)
    wav.setUint16(22, 2, true)
    wav.setUint32(24, rate, true)
    wav.setUint32(28, rate * 4, true)
    wav.setUint16(32, 4, true)
    wav.setUint16(34, 16, true)
    text(36, 'data')
    wav.setUint32(40, n * 4, true)
    hush = new Audio(URL.createObjectURL(new Blob([wav.buffer], { type: 'audio/wav' })))
    hush.loop = true
    hush.setAttribute('x-webkit-airplay', 'deny')
    hush.addEventListener('ended', () => hush.play().catch(() => {})) // (for a phone that does not loop)
  }
  if (hush.paused) hush.play().catch(() => {})
}

async function begin() {
  if (started) return
  started = true
  unsilence()
  ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' })
  // (not waited for: if the browser will not let the sound start yet, the set is laid out all the same,
  // and the prompt further down asks for the touch it wants)
  ctx.resume().catch(() => {})
  engine = createEngine(ctx)
  desk = createDesk(engine, stage)
  hands = createHands({ stage, puppet, desk })
  brain = createBrain({ engine, stage, puppet, hands, desk, seed: q.has('seed') ? Number(q.get('seed')) : undefined })
  begunAt = performance.now()
  stage.setShot('back')
  brain.start(Number(q.get('bar') || 0))
  const title = $('[data-title]')
  title.classList.add('gone')
  setTimeout(() => title.remove(), 700) // once it has faded, it is not there to be tabbed to either
  $('[data-hud]').hidden = false
  canvas.focus()
  window.set = { engine, desk, hands, brain, stage, puppet } // for the curious, and for the QA scripts
  if (q.has('cam')) camera(q.get('cam'))
}
startButton.addEventListener('click', begin)

// the scheduler runs off a worker's timer, which a background tab does not slow to a crawl
const ticker = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 25)'], { type: 'text/javascript' })))
let simAt = 0
ticker.onmessage = () => {
  if (!engine) return
  engine.lookahead = document.hidden ? 1.6 : 0.18
  // with the tab hidden nothing is drawn, but he goes on mixing
  if (document.hidden) sim(0.025, true)
  engine.tick()
}

const live = () => (brain.state.live ? engine.decks[brain.state.live] : null)
let env = { beat: 0, energy: 0.2 }
function sim(dt, blind = false) {
  const now = ctx.currentTime
  brain.update(now)
  env = brain.env(now - (ctx.outputLatency || 0.02))
  hands.update(now, dt, env.beat)
  if (blind) {
    for (const a of Object.values(puppet.arms)) a.tip.lerp(a.goal, 1 - Math.exp(-dt * a.speed))
    return
  }
  puppet.update(dt, env)
  for (const d of ['A', 'B']) {
    const k = engine.decks[d]
    const v = brain.vis[d]
    stage.setDeck(d, { loaded: v.loaded, sleeve: v.sleeve, playing: k.playing && now >= k.startedAt, rate: k.rate, progress: k.record ? k.posAt(now) / (k.bars * 16) : 0, needle: v.needle }, dt)
  }
  const c = brain.carry
  stage.carry.visible = c.on
  if (c.on) {
    if (c.sleeve !== c.shown) stage.carryLabel.show('sleeve_' + (c.shown = c.sleeve))
    stage.carry.position.copy(puppet.arms[c.hand].tip)
    stage.carry.position.y -= 0.02
  }
  const dbl = (x) => Math.max(0, Math.min(1, (20 * Math.log10(x + 1e-5) + 30) / 30))
  stage.setMeter('A', dbl(engine.mixer.level('A').peak * 1.9))
  stage.setMeter('B', dbl(engine.mixer.level('B').peak * 1.9))
  stage.setMeter('M', dbl(engine.mixer.level('M').peak))
  simAt = now
}

// ── the director: cuts between cameras on the phrase, and to the room when a drop lands ───────────
let auto = true
let phraseSeen = -1
let cut = 0
let dropSeen = 0
function direct(now) {
  if (!auto) return
  const k = live()
  if (!k) return
  const phrase = Math.floor(k.posAt(now) / 128) + (brain.state.live === 'A' ? 0 : 1000)
  if (brain.state.dropAt !== dropSeen && now - brain.state.dropAt < 0.4) {
    // a drop lands on a phrase, so this is that phrase's cut: one cut, not two a frame apart
    dropSeen = brain.state.dropAt
    phraseSeen = phrase
    return stage.setShot(cut++ % 2 ? 'wide' : 'front')
  }
  if (phrase === phraseSeen) return
  phraseSeen = phrase
  const order = brain.state.mixing ? ['top', 'back', 'side', 'top', 'front', 'back'] : ['front', 'back', 'wide', 'side', 'front', 'top']
  stage.setShot(order[cut++ % order.length])
}
function camera(name) {
  auto = name === 'auto'
  if (!auto) stage.setShot(name)
  else phraseSeen = -1
  for (const b of document.querySelectorAll('[data-cam]')) b.setAttribute('aria-pressed', String(b.dataset.cam === (auto ? 'auto' : name)))
}
for (const b of document.querySelectorAll('[data-cam]')) b.addEventListener('click', () => camera(b.dataset.cam))

// ── what is on the screen ──────────────────────────────────────────────────
const bar = $('[data-bar]')
const barName = $('[data-bar-name]')
const barFill = $('[data-bar-fill]')
const doing = $('[data-doing]')
const playing = $('[data-playing]')
const pickup = $('[data-pickup]')
const liveRegion = $('[data-live]')
let shownTouch = null
let doingUntil = 0
let shownPlaying = ''
let pickupUntil = 0
let carried = null
let spoken = 0
function say(text, seconds = 3) {
  doing.textContent = text
  doing.classList.add('on')
  doingUntil = performance.now() + seconds * 1000
}
function hud(now) {
  const t = hands.lastTouch
  const fresh = t && now - t.at < 1.4
  // the bar: the control under a hand, and how far round it is
  if (fresh && t.ctl && stage.controls[t.ctl]?.kind !== 'button') {
    bar.className = 'bar on' + (t.tag === 'request' ? ' asked' : '')
    barName.textContent = nameOf(t.ctl)
    barFill.style.width = Math.round(desk.value[t.ctl] * 100) + '%'
  } else bar.className = 'bar'
  if (t && t !== shownTouch && t.tag && t.tag !== shownTouch?.tag) {
    if (t.tag === 'request') say(`By request: ${nameOf(t.ctl)}`, 2)
    else say(t.tag[0].toUpperCase() + t.tag.slice(1), 3.2)
  }
  shownTouch = t
  if (performance.now() > doingUntil) doing.classList.remove('on')

  // what is on the decks
  const rows = ['A', 'B'].filter((d) => engine.decks[d].record && brain.vis[d].loaded).map((d) => {
    const k = engine.decks[d]
    const r = k.record
    return { d, r, bpm: k.bpm.toFixed(1), quiet: engine.presence(d) < 0.06 }
  })
  const key = rows.map((x) => `${x.d}${x.r.id}${x.r.seed}${x.bpm}${x.quiet}`).join('|')
  if (key !== shownPlaying) {
    shownPlaying = key
    playing.innerHTML = rows.map((x) => `<div class="record${x.quiet ? ' quiet' : ''}"><img src="/art/sleeve-${x.r.id}.png" alt="" /><div><b>${x.r.title}</b><small>DECK ${x.d} · ${STYLE_NAMES[x.r.style].toUpperCase()} · ${x.bpm} BPM · ${keyName(x.r.pc).toUpperCase()}</small></div></div>`).join('')
  }
  // a record leaving the box
  const c = brain.carry
  if (c.on && c.sleeve !== carried) {
    carried = c.sleeve
    pickup.innerHTML = `<img src="/art/sleeve-${c.sleeve}.png" alt="" />`
    pickup.classList.add('on')
    pickupUntil = performance.now() + 3600
  }
  if (!c.on) carried = null
  if (performance.now() > pickupUntil) pickup.classList.remove('on')
  // for a screen reader: the larger events only
  const log = brain.state.log
  if (log.length > spoken) {
    liveRegion.textContent = log[log.length - 1].text
    spoken = log.length
  }
}

// ── the loop: the world moves every frame and is drawn at thirty a second, as it was ───────────────
let last = performance.now()
let odd = false
function frame(t) {
  requestAnimationFrame(frame)
  const dt = Math.min(0.1, (t - last) / 1000)
  last = t
  if (!engine) return
  prompt()
  // if the sound is allowed but its clock is not moving, there is no sound device answering: say so
  if (ctx.state === 'running' && ctx.currentTime < 0.05 && performance.now() - begunAt > 3500 && performance.now() > doingUntil) say('Waiting for a sound device to answer…', 4)
  sim(dt)
  direct(ctx.currentTime)
  odd = !odd
  if (odd && !q.has('fps60')) return
  const bands = engine.mixer.bands()
  stage.render(q.has('fps60') ? dt : dt * 2, { ...env, low: bands.low })
  hud(ctx.currentTime)
  window.ready = true
}
requestAnimationFrame(frame)

// ── asking him to turn something ────────────────────────────────────────────
const tip = $('[data-tip]')
let drag = null
function pressPlay(id) {
  const d = id[0]
  const k = engine.decks[d]
  const m = hands.grab(id)
  m.onTouch = (now) => {
    if (engine.decks.A.playing && engine.decks.B.playing) return say('Not now: two records are running')
    if (k.playing) {
      k.stopAt(now + 0.03, 0.7)
      desk.set(id, 0)
      say('You stop the record', 1.6)
    }
  }
  setTimeout(() => hands.user === m && hands.release(), 900)
}
const pointer = (e) => ({ x: e.clientX, y: e.clientY })
canvas.addEventListener('pointerdown', (e) => {
  if (!started || !engine) return
  const p = pointer(e)
  const id = stage.pick(p.x, p.y)
  canvas.setPointerCapture(e.pointerId)
  const c = id && stage.controls[id]
  if (c) {
    if (id.endsWith('.play')) return pressPlay(id)
    hands.grab(id)
    if (c.kind === 'button') {
      hands.turn(desk.value[id] > 0.5 ? 0 : 1)
      const m = hands.user
      setTimeout(() => hands.user === m && hands.release(), 900)
      return
    }
    // a fader is dragged along itself as it lies on the screen; a knob, up or to the right for more
    let axis = null
    if (c.axis) {
      const a = stage.toScreen(c.node.parent.localToWorld(c.home.clone()))
      const b = stage.toScreen(c.node.parent.localToWorld(c.home.clone().addScaledVector(c.axis, c.travel)))
      const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
      if (len2 > 60) axis = { x: (b.x - a.x) / len2, y: (b.y - a.y) / len2 }
    }
    drag = { id, p, v0: desk.value[id], axis, snap: c.kind === 'switch' }
    canvas.classList.add('held')
  } else {
    drag = { orbit: true, p, yaw: stage.cam.yaw, pitch: stage.cam.pitch }
    canvas.classList.add('held') // the hand closes on the picture to turn it
  }
})
canvas.addEventListener('pointermove', (e) => {
  const p = pointer(e)
  if (drag?.orbit) {
    stage.orbit(drag.yaw - (p.x - drag.p.x) * 0.005, drag.pitch + (p.y - drag.p.y) * 0.004)
    return
  }
  if (drag) {
    const dx = p.x - drag.p.x
    const dy = p.y - drag.p.y
    let v = drag.v0 + (drag.axis ? dx * drag.axis.x + dy * drag.axis.y : (dx - dy) / 180)
    if (drag.snap) v = Math.round(v * 2) / 2
    hands.turn(v)
    return
  }
  if (!started || !engine || e.pointerType === 'touch') return
  const id = stage.pick(p.x, p.y)
  canvas.classList.toggle('over', !!id)
  if (id && !id.endsWith('.platter')) {
    tip.textContent = nameOf(id)
    tip.style.transform = `translate(${Math.min(p.x + 14, innerWidth - 150)}px, ${p.y + 16}px)`
    tip.classList.add('on')
  } else tip.classList.remove('on')
})
const drop = () => {
  if (drag && !drag.orbit) hands.release()
  drag = null
  canvas.classList.remove('held')
}
canvas.addEventListener('pointerup', drop)
canvas.addEventListener('pointercancel', drop)
canvas.addEventListener('pointerleave', () => tip.classList.remove('on'))
canvas.addEventListener('wheel', (e) => {
  e.preventDefault()
  stage.dolly(stage.cam.zoom * (1 + e.deltaY * 0.0012))
}, { passive: false })

// ── the browser's say in the matter ─────────────────────────────────────────
// No page may make a sound until it has been touched, and a phone can take the sound away again (another
// app, the lock screen, a call). So whenever the set is under way and the sound is not, the room goes dim
// and there is one thing on screen to press; pressing anything at all brings the music back.
const wake = $('[data-wake]')
const wakeButton = $('[data-wake-button]')
wakeButton.textContent = matchMedia('(pointer: coarse)').matches ? 'Tap for sound' : 'Click for sound'
const asleep = () => started && !!ctx && ctx.state !== 'running'
let asleepSince = 0
function rouse() {
  if (!asleep()) return
  unsilence()
  ctx.resume().catch(() => {})
}
for (const type of ['click', 'mousedown', 'pointerup', 'touchend', 'keydown']) window.addEventListener(type, rouse, { capture: true, passive: true })
// coming back to the page: try without being asked (some browsers allow it once a page has been touched)
for (const type of ['pageshow', 'focus']) window.addEventListener(type, rouse)
function prompt() {
  // (not for the blink of an eye it takes the sound to start when it is allowed to)
  if (!asleep()) asleepSince = 0
  else if (!asleepSince) asleepSince = performance.now()
  const show = asleepSince > 0 && performance.now() - asleepSince > 500
  if (show !== wake.hidden) return
  wake.hidden = !show
  if (show) wakeButton.focus({ preventScroll: true })
}

// ── mute, keys ────────────────────────────────────────────────────────────
function mute(on) {
  muted = on
  if (engine) engine.mixer.out.gain.setTargetAtTime(on ? 0 : 0.9, ctx.currentTime, 0.03)
  $('[data-mute]').setAttribute('aria-pressed', String(on))
}
$('[data-mute]').addEventListener('click', () => mute(!muted))
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  if (!started) {
    if (e.key === 'Enter' || e.key === ' ') begin()
    return
  }
  const cams = { 1: 'back', 2: 'front', 3: 'top', 4: 'side', 5: 'wide', a: 'auto' }
  if (cams[e.key.toLowerCase()]) camera(cams[e.key.toLowerCase()])
  else if (e.key.toLowerCase() === 'm') mute(!muted)
})
document.addEventListener('visibilitychange', () => {
  last = performance.now()
  if (!document.hidden) rouse()
})
if (q.has('go')) begin() // (starts without being asked: where the browser will not have that, the prompt above appears)
