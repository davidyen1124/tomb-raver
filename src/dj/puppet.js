// DJ MONOLITH's body. The model is rigid pieces, as characters were on that console: an egg, and for
// each arm an upper arm, a forearm and a mitten. Every frame this is told where each fingertip wants to
// be and how lively the music is; it works out the elbows (two-bone reach, with a little rubber in it for
// the far corners of the booth), leans and turns the body after the hands, and keeps time with its knees.
//
// An arm never goes through the gear. The shoulders are above the tops of the decks, the elbows are
// carried up and out, the wrist arrives above whatever the fingers are on, and a hand that rests on
// something lies on it, a palm's thickness up. scripts/check.mjs measures all of it.
import * as THREE from 'three'

const DOWN = new THREE.Vector3(0, -1, 0)
const UP = new THREE.Vector3(0, 1, 0)
const HAND = 0.235 // wrist to the end of the mitten
const PALM = 0.11 // half a mitten's thickness: how far above a surface its middle is when it lies there
const lerp = (a, b, t) => a + (b - a) * t
export const ELBOW = new THREE.Vector3(1, -0.1, -0.25) // where the elbow points with the arm folded
export const REACH = new THREE.Vector3(1, 0.2, -0.4) // and with it reaching

export function createPuppet(stage) {
  const { nodes, scene } = stage
  const root = nodes.pebble
  const body = nodes.body
  root.position.z = -0.16 // a step back from the table: the belly stays clear of it even at full lean
  body.rotation.order = 'YXZ'
  const bodyHome = body.position.clone()
  scene.updateMatrixWorld(true)

  const arms = {}
  for (const [s, side] of [['l', 1], ['r', -1]]) {
    const upper = nodes[`arm_${s}_upper`]
    const fore = nodes[`arm_${s}_fore`]
    const hand = nodes[`hand_${s}`]
    // the shoulder is a point on the body; the pieces themselves are set down in the world each frame
    const shoulder = body.worldToLocal(upper.getWorldPosition(new THREE.Vector3()))
    for (const n of [upper, fore, hand]) scene.attach(n)
    const rest = new THREE.Vector3(side * 0.62, 1.3, 0.5)
    arms[s] = {
      side,
      upper,
      fore,
      hand,
      shoulder,
      a: upper.userData.length,
      b: fore.userData.length,
      tip: rest.clone(), // where the fingertips are
      goal: rest.clone(), // where they are going
      speed: 13, // how briskly
      // how the hand is held: 0, fingers come down on it from above (a knob); 1, the hand lies flat on it
      // (a record, the table); -1, the hand is above the wrist (an arm in the air)
      flat: 0,
      S: new THREE.Vector3(),
      E: new THREE.Vector3(),
      Wr: new THREE.Vector3(),
      end: new THREE.Vector3(),
    }
  }

  const v1 = new THREE.Vector3()
  const v2 = new THREE.Vector3()
  const pole = new THREE.Vector3()
  const q = new THREE.Quaternion()
  function reach(arm, dt) {
    // fingertips go to their goal quickly but not instantly, and lift on the way over, clear of the knobs
    const d = v1.subVectors(arm.goal, arm.tip)
    const far = d.length()
    arm.tip.addScaledVector(d, 1 - Math.exp(-dt * arm.speed))
    const hop = Math.min(0.12, far * 0.5)
    const tip = v2.copy(arm.tip)
    tip.y += hop
    arm.S.copy(arm.shoulder)
    body.localToWorld(arm.S)
    const back = v1.subVectors(arm.S, tip).setY(0).normalize()
    // Where the wrist goes, and where the far end of the mitten goes, for the point the fingers are on.
    //   from above: the wrist a hand's length over it, a little towards the body; the mitten's end on it
    //   flat: the wrist low and well back; the mitten level, a palm's thickness above it
    //   raised: the wrist below it, the mitten pointing up
    const f = arm.flat
    const lift = f >= 0 ? lerp(0.225, 0.15, f) : lerp(0.225, -0.225, -f)
    const behind = f >= 0 ? lerp(0.07, 0.23, f) : lerp(0.07, 0, -f)
    arm.Wr.copy(tip).addScaledVector(UP, lift).addScaledVector(back, behind)
    arm.end.copy(tip).addScaledVector(UP, PALM * Math.max(f, 0))

    const dir = v1.subVectors(arm.Wr, arm.S)
    let len = dir.length()
    dir.divideScalar(len || 1)
    const max = (arm.a + arm.b) * 0.995
    const stretch = len > max ? len / max : 1
    const a = arm.a * stretch
    const b = arm.b * stretch
    len = Math.max(len, Math.abs(a - b) + 0.02)
    const cosA = THREE.MathUtils.clamp((a * a + len * len - b * b) / (2 * a * len), -1, 1)
    const sinA = Math.sqrt(1 - cosA * cosA)
    // Which way the elbow goes. With the hand close in, the arm is folded and the elbow sits out to the
    // side, beside the body and short of the table. As the hand goes further over the desk the elbow
    // comes up, so that the arm goes over the decks, never down through them.
    const straight = THREE.MathUtils.smoothstep(len / (arm.a + arm.b), 0.5, 0.88)
    pole.set(arm.side * ELBOW.x, lerp(ELBOW.y, REACH.y, straight), lerp(ELBOW.z, REACH.z, straight))
    pole.addScaledVector(dir, -pole.dot(dir)).normalize()
    arm.E.copy(arm.S).addScaledVector(dir, a * cosA).addScaledVector(pole, a * sinA)

    arm.upper.position.copy(arm.S)
    arm.upper.quaternion.setFromUnitVectors(DOWN, v1.subVectors(arm.E, arm.S).normalize())
    arm.upper.scale.set(1, stretch, 1)
    arm.fore.position.copy(arm.E)
    arm.fore.quaternion.setFromUnitVectors(DOWN, v1.subVectors(arm.Wr, arm.E).normalize())
    arm.fore.scale.set(1, stretch, 1)
    arm.hand.position.copy(arm.Wr)
    arm.hand.quaternion.setFromUnitVectors(DOWN, v1.subVectors(arm.end, arm.Wr).normalize())
    // turn the mitten about its own length so the thumb stays on the inside
    q.setFromAxisAngle(DOWN, arm.side * 0.4)
    arm.hand.quaternion.multiply(q)
  }

  const eyes = [nodes.eye_l, nodes.eye_r].filter(Boolean)
  let blinkAt = 2
  let blink = 0
  let time = 0
  const pose = { lean: 0.09, twist: 0, roll: 0, bob: 0, sway: 0 }

  // m: { beat (fractional beats), energy 0..1, gaze: 'desk' | 'room' | 'left' | 'right', tilt (-1..1, head to one side for the headphones) }
  function update(dt, m = {}) {
    time += dt
    const beat = m.beat || 0
    const energy = m.energy ?? 0.5
    const ph = beat % 1
    // down on the beat, up between: a dip that is deeper on the one
    const one = Math.floor(beat) % 4 === 0 ? 1.25 : 1
    const dip = Math.exp(-ph * 5) * one
    const groove = 0.35 + energy * 0.9
    // the body follows the hands: turned towards wherever they are working, further forward the further they reach
    const l = arms.l.goal
    const r = arms.r.goal
    const mid = (l.x + r.x) / 2
    const far = Math.max(l.z, r.z)
    const wantTwist = THREE.MathUtils.clamp(mid * 0.42, -0.5, 0.5) + (m.gaze === 'left' ? 0.5 : m.gaze === 'right' ? -0.5 : 0)
    const wantLean = m.gaze === 'room' ? 0.03 : 0.09 + THREE.MathUtils.clamp((far - 0.95) * 0.16, 0, 0.06)
    const k = Math.min(1, dt * 6)
    pose.twist += (wantTwist - pose.twist) * k
    pose.lean += (wantLean - pose.lean) * k
    pose.roll += ((m.tilt || 0) * 0.16 - pose.roll) * k
    pose.bob = -0.05 * dip * groove
    pose.sway = Math.sin(beat * Math.PI) * 0.035 * groove
    body.position.set(bodyHome.x + pose.sway, bodyHome.y + pose.bob, bodyHome.z)
    body.rotation.set(pose.lean + 0.035 * dip * groove, pose.twist, pose.roll + Math.sin(beat * Math.PI) * 0.03 * groove)
    // squash a little as it lands
    const sq = 1 - 0.022 * dip * groove
    body.scale.set(1 + (1 - sq) * 0.6, sq, 1 + (1 - sq) * 0.6)
    body.updateWorldMatrix(true, false)
    reach(arms.l, dt)
    reach(arms.r, dt)

    if (time > blinkAt) {
      blink = 1
      blinkAt = time + 2.4 + Math.random() * 3.6
    }
    blink = Math.max(0, blink - dt * 7)
    const lid = 1 - Math.sin(Math.min(blink, 1) * Math.PI) * 0.92
    for (const e of eyes) e.scale.y = lid
  }

  return {
    arms,
    body,
    update,
    // a point given in the body's own space (it leans, bounces and turns), as a point in the room
    onBody(x, y, z, out = new THREE.Vector3()) {
      return body.localToWorld(out.set(x, y - bodyHome.y, z))
    },
  }
}
