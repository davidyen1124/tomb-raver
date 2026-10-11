// A bench for the picture alone (not built, not deployed): the stage with nothing playing.
//   dev.html?shot=front&beat=3.2&energy=1&yaw=0.3&A.low=0.1&l=A.low&r=B.platter
// It also carries the two measurements scripts/check.mjs runs:
//   bench.sight()  looks along every camera, at every corner of the range it may be dragged through,
//                  for anything standing between it and the DJ or the desk
//   bench.arms()   puts each hand on everything it ever touches and measures how far the arms, the
//                  hands and the belly stay from the gear
import * as THREE from 'three'
import { createStage } from './webgl/stage.js'
import { createPuppet, ELBOW, REACH } from './dj/puppet.js'
import LAY from './dj/layout.json'

const q = new URLSearchParams(location.search)
const stage = await createStage(document.getElementById('canvas'))
const puppet = createPuppet(stage)
stage.setShot(q.get('shot') || 'back')
// for trying a rig before it is built: ?sh=1.14 moves the shoulders to that height, ?pole=1,-0.1,-0.25 sends the elbows that way
if (q.has('sh')) for (const a of Object.values(puppet.arms)) a.shoulder.y += Number(q.get('sh')) - (a.shoulder.y + 0.45)
if (q.has('pole')) ELBOW.fromArray(q.get('pole').split(',').map(Number))
if (q.has('reach')) REACH.fromArray(q.get('reach').split(',').map(Number))
// ?shphi=1.3 moves the shoulders round the body to that angle from the front; ?arm=0.6 sets each bone's length
for (const a of Object.values(puppet.arms)) {
  if (q.has('shphi')) {
    const r = Math.hypot(a.shoulder.x, a.shoulder.z)
    a.shoulder.x = a.side * Math.sin(Number(q.get('shphi'))) * r
    a.shoulder.z = Math.cos(Number(q.get('shphi'))) * r
  }
  if (q.has('arm')) a.a = a.b = Number(q.get('arm'))
}
// ?cam=x,y,z,lookx,looky,lookz,fov: a camera of one's own (the icons are photographed with one)
if (q.has('cam')) {
  const c = q.get('cam').split(',').map(Number)
  stage.cam.pos.set(c[0], c[1], c[2])
  stage.cam.look.set(c[3], c[4], c[5])
  stage.cam.fov = c[6] || 30
}
stage.cam.yaw = Number(q.get('yaw') || 0)
stage.cam.pitch = Number(q.get('pitch') || 0)
stage.cam.zoom = Number(q.get('zoom') || 1)
for (const id in stage.controls) stage.setControl(id, q.has(id) ? Number(q.get(id)) : ['fader', 'button'].includes(stage.controls[id].kind) ? 0 : 0.5)
stage.setMeter('A', 0.7)
stage.setMeter('B', 0.3)
stage.setMeter('M', 0.9)

// the places a hand goes, by the names the URL uses: a control, A.platter / A.rim / A.label / A.needle, or home
const HOME = { l: new THREE.Vector3(0.98, 1.115, 0.8), r: new THREE.Vector3(-0.13, 1.15, 0.76) }
function place(what, side, out) {
  const [d, k] = what.split('.')
  if (what === 'home') return { p: out.copy(HOME[side]), flat: 1 }
  if (what === 'crate') return { p: out.set(1.5, 1.42, -0.42), flat: 1 }
  if (what === 'handover') return { p: out.set(0.05, 1.5, 0.7), flat: 0 }
  if (what === 'cup') return { p: puppet.onBody(side === 'l' ? 0.84 : -0.84, 1.5, 0.02, out), flat: 0 }
  if (what === 'air') return { p: puppet.onBody((side === 'l' ? 1 : -1) * 0.72, 2.5, 0.3, out), flat: -1 }
  if (k === 'platter') return { p: stage.deckPoint(d, 'edge', out), flat: 1 }
  if (k === 'rim' || k === 'label') return { p: stage.deckPoint(d, k, out), flat: 1 }
  if (k === 'needle') return { p: stage.deckPoint(d, 'needle', out), flat: 0 }
  return { p: stage.controlPoint(what, out), flat: 0 }
}
const want = { l: q.get('l') || 'home', r: q.get('r') || 'home' }
const beat = Number(q.get('beat') || 0)
const energy = Number(q.get('energy') ?? 0.6)
let t = 0
let paused = false
function pose(dt, b, e, gaze) {
  for (const s of ['l', 'r']) {
    const { p, flat } = place(want[s], s, puppet.arms[s].goal)
    puppet.arms[s].flat += (flat - puppet.arms[s].flat) * Math.min(1, dt * 10)
    void p
  }
  puppet.update(dt, { beat: b, energy: e, gaze })
}
function frame() {
  requestAnimationFrame(frame)
  if (paused) return
  for (const d of ['A', 'B']) stage.setDeck(d, { loaded: true, sleeve: d === 'A' ? 'crystal' : 'tank', playing: true, rate: 1, progress: d === 'A' ? 0.4 : 0.05, needle: 1 }, 1 / 30)
  const b = beat + t * (q.has('still') ? 0 : 2.1)
  pose(1 / 30, b, energy, q.get('gaze') || 'desk')
  stage.render(1 / 30, { beat: b, energy, low: 0.6 })
  t += 1 / 30
  window.ready = t > 1.2
}
frame()

// ── looking for things in the way ───────────────────────────────────────────────
const OWN = /^(pebble|body|shoes|eye_|shades|phones|arm_|hand_|carry|mixer|deck_|platter_|record_|label_|tonearm_|ctl_|meter_|pitch_|start_)/
function obstacles() {
  const list = []
  stage.scene.traverse((o) => {
    if (!o.isMesh || !o.visible) return
    // (walk up to the outermost named thing: a mummy's arm belongs to the mummy)
    let root = o
    for (let p = o; p; p = p.parent) if (p.name) root = p
    const name = root.name || ''
    if (!name || OWN.test(name)) return
    if (!o.material.uniforms || !o.material.uniforms.map) return // light in the air, shadows on the floor
    o.userData.owner = name
    list.push(o)
  })
  return list
}
const near2 = (p, x, z, r) => Math.hypot(p.x - x, p.z - z) < r
const PILLARS = [[6.7, -3.2], [6.7, 4.6], [6.7, 9.6]]
// what a ray has run into, in words
function what(hit) {
  const n = hit.object.userData.owner
  const p = hit.point
  if (n.startsWith('mummy')) return 'crowd'
  if (n.startsWith('woofer')) return 'speaker'
  if (n.startsWith('flame')) return p.y < 2.2 ? 'brazier' : 'torch'
  if (n === 'crystal' || n === 'medipack' || n === 'lever') return n
  if (n === 'tomb') {
    for (const [x, z] of PILLARS) if (near2(p, x, z, 1.3) || near2(p, -x, z, 1.3)) return 'pillar'
    if (near2(p, -6.7, 11.8, 1.5) && p.y < 1.6) return 'block'
    if (near2(p, 3.7, -2.5, 0.7) && p.y < 0.6) return 'pedestal'
    return hit.face && Math.abs(hit.face.normal.y) > 0.7 && p.y < 0.2 ? 'floor' : p.y > 7.5 ? 'ceiling' : 'wall'
  }
  if (n === 'props') {
    if (Math.abs(p.x) < 1.45 && p.z > 0.55 && p.z < 1.65 && p.y < 1.0) return 'table'
    if (Math.abs(p.x) < 0.5 && p.y < 1.2 && p.z > 1.3 && p.z < 1.7) return 'cables'
    if (near2(p, 1.7, -0.48, 0.95) && p.y < 1.5) return 'record box'
    if (near2(p, 5.1, -3.55, 1.2) || near2(p, -5.1, -3.55, 1.2)) return 'speaker'
    if ((near2(p, 5.7, 2.35, 0.6) || near2(p, -5.7, 2.35, 0.6)) && p.y < 1.5) return 'brazier'
    if (Math.abs(p.x) > 6.1 && p.z < 0 && p.z > -2.2 && p.y < 1.1) return 'crate'
    return p.y > 2.4 ? 'torch' : 'prop'
  }
  return n
}
// things that have no business between a camera and the booth. (The record box is where he fetches
// records from, behind him: it may be in the picture, so long as it hides none of him.)
const BIG = new Set(['pillar', 'speaker', 'brazier', 'crate', 'block', 'pedestal', 'torch'])

// the points that must never be hidden: the DJ, all round, and the top of every piece of gear
function targets() {
  const M = LAY.mixer
  const D = LAY.deck
  const y = LAY.table.y + 0.15
  const out = []
  const body = (name, x, yy, z) => out.push({ name, p: puppet.onBody(x, yy, z) })
  body('head', 0, 1.98, 0)
  body('face', 0, 1.5, 0.5)
  body('back', 0, 1.45, -0.5)
  body('left cup', 0.82, 1.5, 0)
  body('right cup', -0.82, 1.5, 0)
  body('left side', 0.64, 1.2, 0)
  body('right side', -0.64, 1.2, 0)
  for (const [sx, sz] of [[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) out.push({ name: `mixer ${sx},${sz}`, p: new THREE.Vector3(M.x + sx * (M.w / 2 - 0.03), y, M.z + sz * (M.d / 2 - 0.03)) })
  for (const d of ['A', 'B'])
    for (const [sx, sz] of [[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) out.push({ name: `deck ${d} ${sx},${sz}`, p: new THREE.Vector3(D[d].x + sx * (D.w / 2 - 0.03), y, D[d].z + sz * (D.d / 2 - 0.03)) })
  for (const s of ['l', 'r']) out.push({ name: `${s} hand`, p: puppet.arms[s].Wr.clone() })
  return out
}

const ray = new THREE.Raycaster()
const dir = new THREE.Vector3()
const ndc = new THREE.Vector2()
function look(obst, tg, subject) {
  const cam = stage.camera
  const found = {}
  const add = (k, v = 1) => (found[k] = (found[k] || 0) + v)
  // inside the room, and not up against anything
  const c = cam.position
  if (Math.abs(c.x) > 7.6 || c.z < -4.6 || c.z > 12.6 || c.y < 0.35 || c.y > 7.6) add('outside the room')
  // anything between the camera and a point that has to be seen
  for (const t of tg) {
    dir.subVectors(t.p, c)
    const dist = dir.length()
    ray.set(c, dir.divideScalar(dist))
    ray.far = dist - 0.03
    const hit = ray.intersectObjects(obst, false)[0]
    if (hit) add(`${what(hit)} hides ${t.name.replace(/ [-\d,]+$/, '')}`)
  }
  // anything big standing in the picture nearer than the booth, or anything at all right in front of the lens
  const NX = 14
  const NY = 9
  let closest = Infinity
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      ndc.set(((i + 0.5) / NX) * 2 - 1, ((j + 0.5) / NY) * 2 - 1)
      ray.setFromCamera(ndc, cam)
      ray.far = 60
      const hit = ray.intersectObjects(obst, false)[0]
      if (!hit) continue
      const w = what(hit)
      if (w !== 'floor') closest = Math.min(closest, hit.distance)
      if (BIG.has(w) && hit.distance < subject * 0.6) add(`${w} in the foreground`, 100 / (NX * NY))
    }
  if (closest < 0.45) add('lens against something')
  return found
}

window.bench = {
  // Every camera, across the whole of the range it can be dragged through (plus the little it drifts by
  // itself). Returns, for each, what was found in the way and at which settings.
  sight({ ny = 7, np = 5, margin = 0.03, shots = stage.shots, limits = null } = {}) {
    paused = true
    // the crowd as tall as it gets: mid-jump, arms up
    for (let i = 0; i < 40; i++) stage.render(1 / 30, { beat: 0.5, energy: 1, low: 0.5, drop: 0.2 })
    want.l = 'A.low'
    want.r = 'B.low'
    for (let i = 0; i < 40; i++) pose(1 / 30, 0, 1, 'desk')
    stage.scene.updateMatrixWorld(true)
    const obst = obstacles()
    const tg = targets()
    const report = {}
    for (const name of shots) {
      stage.setShot(name)
      const L = { ...stage.limits[name], ...(limits && limits[name]) }
      const rows = []
      const problems = {}
      let poses = 0
      // as the camera is when it is cut to: he, his hands and every corner of the gear are in the picture
      // (seen from straight above, his hands and the gear are the picture, and his head is under the lens)
      stage.aim(0, true)
      for (const t of tg) {
        const body = /^(head|left cup|right cup|left side|right side)$/.test(t.name)
        if (!(body || /^(l hand|r hand|mixer|deck)/.test(t.name)) || (name === 'top' && body)) continue
        dir.copy(t.p).project(stage.camera)
        if (Math.abs(dir.x) > 0.98 || Math.abs(dir.y) > 0.98 || dir.z > 1) (problems[`${t.name.replace(/ [-\d,]+$/, '')} is out of the picture`] ||= []).push(`as cut to (${dir.x.toFixed(2)}, ${dir.y.toFixed(2)})`)
      }
      for (const zoom of [...new Set([L.zoom[0], 1, L.zoom[1]])]) {
        for (let b = 0; b < np; b++) {
          const pitch = L.pitch[0] - margin + ((L.pitch[1] - L.pitch[0] + 2 * margin) * b) / Math.max(1, np - 1)
          let line = ''
          for (let a = 0; a < ny; a++) {
            const yaw = L.yaw[0] - margin + ((L.yaw[1] - L.yaw[0] + 2 * margin) * a) / Math.max(1, ny - 1)
            stage.cam.yaw = yaw
            stage.cam.pitch = pitch
            stage.cam.zoom = zoom
            stage.aim(0, true) // (without its own drift: the margin allows for that)
            const subject = stage.camera.position.distanceTo(stage.cam.look)
            const found = look(obst, tg, subject)
            poses++
            const keys = Object.keys(found)
            line += keys.length ? 'X' : '.'
            for (const k of keys) (problems[k] ||= []).push(`yaw ${yaw.toFixed(2)} pitch ${pitch.toFixed(2)} zoom ${zoom}${found[k] !== 1 ? ` (${found[k].toFixed(0)}% of the picture)` : ''}`)
          }
          rows.push(`zoom ${String(zoom).padEnd(4)} pitch ${pitch.toFixed(2).padStart(5)}  ${line}`)
        }
      }
      report[name] = { poses, limits: { yaw: L.yaw, pitch: L.pitch, zoom: L.zoom }, rows, problems }
      stage.setShot(name)
    }
    paused = false
    return report
  },

  // Each hand on everything it is ever asked to touch, held through a few beats at full energy (deepest
  // nod, furthest lean). Reports the least distance between any part of an arm and any piece of gear.
  arms() {
    paused = true
    const T = LAY.table
    const M = LAY.mixer
    const D = LAY.deck
    const box = (name, x0, x1, y1, z0, z1) => ({ name, min: new THREE.Vector3(x0, -1, z0), max: new THREE.Vector3(x1, y1, z1) })
    const boxes = [
      box('table', -T.x - 0.06, T.x + 0.06, T.y, T.z0, T.z1 + 0.06),
      box('mixer', M.x - M.w / 2, M.x + M.w / 2, T.y + M.h, M.z - M.d / 2, M.z + M.d / 2),
      box('deck A', D.A.x - D.w / 2, D.A.x + D.w / 2, T.y + D.h, D.A.z - D.d / 2, D.A.z + D.d / 2),
      box('deck B', D.B.x - D.w / 2, D.B.x + D.w / 2, T.y + D.h, D.B.z - D.d / 2, D.B.z + D.d / 2),
      box('record A', D.A.x + LAY.platter.x - 0.26, D.A.x + LAY.platter.x + 0.26, T.y + D.h + 0.036, D.A.z + LAY.platter.z - 0.26, D.A.z + LAY.platter.z + 0.26),
      box('record B', D.B.x + LAY.platter.x - 0.26, D.B.x + LAY.platter.x + 0.26, T.y + D.h + 0.036, D.B.z + LAY.platter.z - 0.26, D.B.z + LAY.platter.z + 0.26),
    ]
    const c = new THREE.Vector3()
    // how far a ball is from the nearest box: below zero, it is inside by that much
    const gap = (p, r) => {
      let best = { d: Infinity, name: '' }
      for (const b of boxes) {
        c.copy(p).clamp(b.min, b.max)
        const inside = c.distanceToSquared(p) < 1e-12
        const d = inside ? -Math.min(p.x - b.min.x, b.max.x - p.x, b.max.y - p.y, p.z - b.min.z, b.max.z - p.z) - r : c.distanceTo(p) - r
        if (d < best.d) best = { d, name: b.name }
      }
      return best
    }
    const p = new THREE.Vector3()
    const places = ['home', 'crate', 'handover', 'cup', 'air', ...Object.keys(stage.controls), 'A.platter', 'A.rim', 'A.label', 'A.needle', 'B.platter', 'B.rim', 'B.label', 'B.needle']
    const rows = []
    const worst = { upper: { d: Infinity }, forearm: { d: Infinity }, hand: { d: Infinity }, belly: { d: Infinity }, stretch: { d: 1 } }
    for (const s of ['l', 'r']) {
      const other = s === 'l' ? 'r' : 'l'
      for (const w of places) {
        want[s] = w
        want[other] = 'home'
        const arm = puppet.arms[s]
        const here = { upper: { d: Infinity }, forearm: { d: Infinity }, hand: { d: Infinity }, belly: { d: Infinity } }
        let stretch = 1
        for (let f = 0; f < 110; f++) {
          pose(1 / 30, f / 14, 1, w === 'crate' ? 'left' : w === 'air' ? 'room' : 'desk')
          if (f < 50) continue // (let the hand get there first)
          const note = (part, g) => g.d < here[part].d && (here[part] = g)
          for (let k = 0; k <= 8; k++) {
            note('upper', gap(p.lerpVectors(arm.S, arm.E, k / 8), 0.1))
            note('forearm', gap(p.lerpVectors(arm.E, arm.Wr, k / 8), 0.09))
          }
          // the mitten: its thick middle. (Its far end is on whatever it is touching: that is the point.)
          note('hand', gap(p.lerpVectors(arm.Wr, arm.end, 0.42), 0.1))
          // the belly, across the front of him, at and above table height
          for (const yy of [0.9, 1.0, 1.1, 1.2])
            for (const a of [-0.9, -0.45, 0, 0.45, 0.9]) {
              const cos = 1 - (2 * (yy - 0.16)) / 1.9
              const ang = Math.acos(cos)
              const rr = 0.66 * Math.sin(ang) ** 0.62 * (1 + 0.14 * cos)
              note('belly', gap(puppet.onBody(Math.sin(a) * rr, yy, Math.cos(a) * rr, p), 0))
            }
          stretch = Math.max(stretch, arm.upper.scale.y)
        }
        const cross = (s === 'l' && /^B\./.test(w)) || (s === 'r' && /^A\.|^crate$/.test(w)) // a hand on the far side of the booth
        rows.push({ side: s, at: w, cross, ...Object.fromEntries(Object.entries(here).map(([k, v]) => [k, +v.d.toFixed(3)])), nearest: here.forearm.name, stretch: +stretch.toFixed(2) })
        if (!cross) {
          for (const k in here) if (here[k].d < worst[k].d) worst[k] = { d: +here[k].d.toFixed(3), at: `${s} hand on ${w}`, against: here[k].name }
          if (stretch > worst.stretch.d) worst.stretch = { d: +stretch.toFixed(2), at: `${s} hand on ${w}` }
        }
      }
    }
    want.l = want.r = 'home'
    paused = false
    return { rows, worst }
  },
}
window.stage = stage
window.puppet = puppet
