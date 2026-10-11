// The picture: loads the Blender-built tomb and draws it the way a 1996 console would (few lines,
// vertex lighting, vertices snapped to whole pixels, textures stretched flat across each triangle,
// fifteen-bit colour with an ordered dither, darkness a few blocks away). It also owns every moving
// part of the model: the knobs and faders, the platters and tonearms, the meters, the fire, the
// woofers, the crowd. It decides nothing; it is told where things are and draws them there.
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import ATLAS from './atlas.json'

const LINES = 360 // the picture is this many pixels tall, whatever the screen
const NL = 6 // lights that move: two fires, two coloured washes, the crystal, a flash
const SHEET = ['env', 'prop', 'cutout', 'glow']

const BAYER = /* glsl */ `
  float bayer(vec2 p) {
    int x = int(mod(p.x, 4.0));
    int y = int(mod(p.y, 4.0));
    int i = x + y * 4;
    float m = 0.0;
    if (i == 0) m = 0.0; else if (i == 1) m = 8.0; else if (i == 2) m = 2.0; else if (i == 3) m = 10.0;
    else if (i == 4) m = 12.0; else if (i == 5) m = 4.0; else if (i == 6) m = 14.0; else if (i == 7) m = 6.0;
    else if (i == 8) m = 3.0; else if (i == 9) m = 11.0; else if (i == 10) m = 1.0; else if (i == 11) m = 9.0;
    else if (i == 12) m = 15.0; else if (i == 13) m = 7.0; else if (i == 14) m = 13.0; else m = 5.0;
    return m / 16.0;
  }`
const vertexShader = /* glsl */ `
  uniform vec2 uGrid;
  uniform float uMode;   // 0: lit here, per vertex. 1: light was baked into the vertex colours. 2: gives off its own light
  uniform vec3 uAmbient;
  uniform vec3 uKey;
  uniform vec3 uKeyCol;
  uniform vec3 uFill;
  uniform vec3 uFillCol;
  uniform vec3 uTint;
  uniform vec3 uLightPos[${NL}];
  uniform vec3 uLightCol[${NL}];
  uniform float uLightRange[${NL}];
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uExposure;
  varying vec2 vUv;
  varying vec3 vAff;
  varying vec3 vShade;
  varying float vFog;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec4 mv = viewMatrix * world;
    vec4 clip = projectionMatrix * mv;
    // old hardware had no sub-pixel precision: every vertex lands on a whole pixel
    if (clip.w > 0.05) clip.xy = floor(clip.xy / clip.w * uGrid + 0.5) / uGrid * clip.w;
    gl_Position = clip;
    // nor any sense of depth when it filled a triangle: carry the texture coordinate so that the
    // fragment shader can undo the perspective correction, which is what makes textures swim
    vUv = uv;
    vAff = vec3(uv * clip.w, clip.w);
    vec3 base = pow(color.rgb, vec3(1.0 / 2.2));
    vec3 light = vec3(1.0);
    if (uMode < 1.5) {
      vec3 n = normalize(mat3(modelMatrix) * normal);
      if (uMode < 0.5) light = uAmbient + uKeyCol * max(dot(n, uKey), 0.0) + uFillCol * max(dot(n, uFill), 0.0);
      else light = vec3(2.0 * uExposure);
      for (int i = 0; i < ${NL}; i++) {
        vec3 d = uLightPos[i] - world.xyz;
        float dist = length(d);
        float a = max(0.0, 1.0 - dist / uLightRange[i]);
        light += uLightCol[i] * a * a * (0.3 + 0.7 * max(dot(n, d / max(dist, 0.001)), 0.0));
      }
    }
    vShade = base * light * uTint;
    vFog = smoothstep(uFogNear, uFogFar, -mv.z);
  }`
const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform float uAffine;
  uniform float uAlphaTest;
  uniform float uFogged;
  uniform vec3 uFogCol;
  varying vec2 vUv;
  varying vec3 vAff;
  varying vec3 vShade;
  varying float vFog;
  ${BAYER}
  void main() {
    vec2 uv = mix(vUv, vAff.xy / vAff.z, uAffine);
    vec4 t = texture2D(map, uv);
    if (t.a < uAlphaTest) discard;
    vec3 c = mix(t.rgb * vShade, uFogCol, vFog * uFogged);
    // five bits a channel, ordered dither in between
    c = floor(min(c, 1.0) * 31.0 + bayer(gl_FragCoord.xy)) / 31.0;
    gl_FragColor = vec4(c, 1.0);
  }`
// light in the air: added to what is behind it, coarsened the same way
const beamVertex = /* glsl */ `
  attribute vec4 tint;
  varying vec4 vTint;
  void main() {
    vTint = tint;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`
const beamFragment = /* glsl */ `
  varying vec4 vTint;
  ${BAYER}
  void main() {
    vec3 c = floor(vTint.rgb * vTint.a * 31.0 + bayer(gl_FragCoord.xy)) / 31.0;
    gl_FragColor = vec4(c, 1.0);
  }`

// Each camera: where it stands, what it looks at, and how far it may be dragged round (yaw), tipped
// (pitch) and moved in or out (zoom) before something would come between it and the booth. The limits
// are not guesses: scripts/check.mjs looks along every camera at every corner of its range and fails
// if a column, a loudspeaker, a brazier, a crate or the crowd hides any part of the DJ or the desk.
const SHOTS = {
  // over the shoulder, the way the game always followed its raider: the desk is in plain view
  back: {
    pos: [2.9, 3.5, -0.3], look: [-0.25, 1.0, 1.2], fov: 46, span: 3.4, yaw: [-0.35, 0.45], pitch: [-0.22, 0.2], zoom: [0.75, 1.3],
    tall: { pos: [0.7, 5.4, -2.3], look: [0, 1.1, 0.75], span: 3.0, yaw: [-0.3, 0.3], pitch: [-0.1, 0.12], zoom: [0.8, 1.2] }, // steeply, from above his head: the desk shows over it
  },
  // the camera every streamed set has: in front and a little above, wide enough for both decks
  front: { pos: [0, 2.5, 6.6], look: [0, 1.42, 0.4], fov: 35, span: 4.6, yaw: [-0.6, 0.6], pitch: [-0.08, 0.2], zoom: [0.8, 1.25] },
  // straight down on the gear, the DJ's left on the left
  top: {
    pos: [0, 3.55, 0.99], look: [0, 1.1, 0.99], fov: 37, up: [0, 0, 1], span: 2.5, yaw: [-0.3, 0.3], pitch: [-0.3, 0.3], zoom: [0.75, 1.4],
    tall: { pos: [0, 5.1, 0.8], look: [0, 1.1, 0.8], span: 2.75, zoom: [0.8, 1.3] },
  },
  // low, along the line of the decks, hands crossing the frame
  side: {
    pos: [3.0, 1.75, 2.15], look: [-0.2, 1.28, 0.72], fov: 31, span: 3.2, yaw: [-0.5, 0.4], pitch: [-0.08, 0.3], zoom: [0.8, 1.2],
    tall: { pos: [3.3, 2.1, 3.3], look: [0.05, 1.3, 0.45], span: 3.5, yaw: [-0.4, 0.3], pitch: [-0.08, 0.25], zoom: [0.85, 1.15] },
  },
  // from the door: the whole chamber
  wide: { pos: [-2.7, 2.9, 9.1], look: [0.2, 1.8, 0], fov: 46, span: 9, yaw: [-0.2, 0.75], pitch: [-0.05, 0.15], zoom: [0.75, 1.1] },
}
// On a window taller than it is wide (a phone held upright) three of them stand somewhere else, so that
// he and the whole desk are still in the picture: `tall` says where.

export async function createStage(canvas, { onProgress = () => {}, model = '/models/tomb.glb' } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false })
  const FOG = new THREE.Color(0.028, 0.02, 0.04)
  renderer.setClearColor(FOG, 1)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(50, 1, 0.3, 60)

  const shared = {
    uGrid: { value: new THREE.Vector2(320, 240) },
    uAmbient: { value: new THREE.Vector3(0.34, 0.31, 0.38) },
    uKey: { value: new THREE.Vector3(0.3, 0.8, 0.5).normalize() },
    uKeyCol: { value: new THREE.Vector3(0.5, 0.45, 0.4) },
    uFill: { value: new THREE.Vector3(-0.35, 0.55, -0.75).normalize() },
    uFillCol: { value: new THREE.Vector3(0.26, 0.24, 0.34) },
    uLightPos: { value: Array.from({ length: NL }, () => new THREE.Vector3()) },
    uLightCol: { value: Array.from({ length: NL }, () => new THREE.Vector3()) },
    uLightRange: { value: new Array(NL).fill(1) },
    uFogNear: { value: 9 },
    uFogFar: { value: 26 },
    uFogCol: { value: new THREE.Vector3(FOG.r, FOG.g, FOG.b) },
    uExposure: { value: 1 },
  }
  const lights = Array.from({ length: NL }, (_, i) => ({ pos: shared.uLightPos.value[i], col: shared.uLightCol.value[i], set range(r) { shared.uLightRange.value[i] = r } }))

  // ── materials: one per kind of surface, all sharing the uniforms above ──────
  const maps = {}
  function material(name, { tint = [1, 1, 1], key = name } = {}) {
    const mode = name === 'env' ? 1 : name === 'cutout' || name === 'glow' ? 2 : 0
    const m = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      vertexColors: true,
      uniforms: {
        ...shared,
        map: { value: maps[SHEET.includes(name) ? 'sheet' : name] },
        uMode: { value: mode },
        uAffine: { value: name === 'env' ? 0.6 : mode === 2 ? 0 : 1 },
        uAlphaTest: { value: name === 'cutout' ? 0.5 : 0 },
        uFogged: { value: mode === 2 ? 0.5 : 1 },
        uTint: { value: new THREE.Vector3(...tint) },
      },
    })
    m.name = key
    return m
  }
  const materials = {}

  const gltf = await new GLTFLoader().loadAsync(model, (e) => e.total && onProgress(e.loaded / e.total))
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return
    const src = o.material
    const k = SHEET.includes(src.name) ? 'sheet' : src.name
    if (!maps[k] && src.map) {
      const map = src.map
      map.magFilter = map.minFilter = THREE.NearestFilter
      map.generateMipmaps = false
      map.colorSpace = THREE.NoColorSpace
      map.needsUpdate = true
      maps[k] = map
    }
  })
  const world = new THREE.Group()
  world.add(...gltf.scene.children.slice())
  scene.add(world)
  const nodes = {}
  world.traverse((o) => {
    if (o.name) nodes[o.name] = o
    if (o.isMesh) {
      const n = o.material.name
      o.material = materials[n] || (materials[n] = material(n))
      o.frustumCulled = false
    }
  })
  scene.updateMatrixWorld(true)
  // give one mesh its own copy of its material, so it can be brightened or dimmed alone
  const own = (mesh, tint = [1, 1, 1]) => (mesh.material = material(SHEET.includes(mesh.material.name) ? mesh.material.name : mesh.material.name, { tint }))
  const tintOf = (mesh) => mesh.material.uniforms.uTint.value

  // ── pictures on the sheet: a mesh that shows one can be made to show another ──
  function rect(name) {
    const a = ATLAS.labels[name]
    const e = 0.06
    return { u0: (a.x + e) / ATLAS.w, u1: (a.x + a.w - e) / ATLAS.w, v0: 1 - (a.y + a.h - e) / ATLAS.h, v1: 1 - (a.y + e) / ATLAS.h }
  }
  function pictured(mesh, from) {
    mesh.geometry = mesh.geometry.clone()
    const uv = mesh.geometry.attributes.uv
    const r = rect(from)
    const rel = new Float32Array(uv.count * 2)
    for (let i = 0; i < uv.count; i++) {
      rel[i * 2] = (uv.getX(i) - r.u0) / (r.u1 - r.u0)
      rel[i * 2 + 1] = (uv.getY(i) - r.v0) / (r.v1 - r.v0)
    }
    return {
      show(name, sub = [0, 0, 1, 1]) {
        const t = rect(name)
        for (let i = 0; i < uv.count; i++) uv.setXY(i, t.u0 + (t.u1 - t.u0) * (sub[0] + rel[i * 2] * (sub[2] - sub[0])), t.v0 + (t.v1 - t.v0) * (sub[1] + rel[i * 2 + 1] * (sub[3] - sub[1])))
        uv.needsUpdate = true
      },
    }
  }

  // ── the desk ───────────────────────────────────────────────────────────
  const controls = {}
  const tmp = new THREE.Vector3()
  world.traverse((o) => {
    const id = o.userData.ctl
    if (!id) return
    const c = { id, node: o, kind: o.userData.kind, home: o.position.clone(), axis: o.userData.axis ? new THREE.Vector3(...o.userData.axis) : null, travel: o.userData.travel || 0, value: 0, press: 0 }
    if (c.kind === 'button') {
      o.traverse((m) => {
        if (m.isMesh && m.material.name === 'glow') c.lamp = tintOf(Object.assign(m, { material: own(m) }))
      })
      // the start button's lamp is a small part of it; the cue button is all lamp
      if (!c.lamp && o.isMesh && o.material.name === 'glow') c.lamp = tintOf(Object.assign(o, { material: own(o) }))
    }
    controls[id] = c
  })
  function setControl(id, v, pressed = 0) {
    const c = controls[id]
    if (!c) return
    c.value = v
    if (c.kind === 'knob') c.node.rotation.y = -(v - 0.5) * 1.5 * Math.PI
    else if (c.kind === 'fader' || c.kind === 'switch') c.node.position.copy(c.home).addScaledVector(c.axis, c.travel * v)
    else if (c.kind === 'button') {
      c.node.position.y = c.home.y - 0.007 * pressed
      if (c.lamp) c.lamp.setScalar(v > 0.5 ? 3.4 : 0.8)
    }
  }
  // where a fingertip goes to work a control, in the world
  function controlPoint(id, out = new THREE.Vector3()) {
    const c = controls[id]
    c.node.getWorldPosition(out)
    out.y += c.kind === 'knob' ? 0.055 : c.kind === 'button' ? 0.022 : 0.04
    return out
  }

  // level meters: ten lamps a column, green then amber then red
  const meters = {}
  for (const name of ['A', 'B', 'M']) {
    const mesh = nodes['meter_' + name]
    if (!mesh) continue
    const n = mesh.userData.leds
    const cols = mesh.userData.columns
    const attr = new THREE.BufferAttribute(new Float32Array(n * cols * 4 * 3), 3)
    mesh.geometry = mesh.geometry.clone()
    mesh.geometry.setAttribute('color', attr)
    mesh.material = own(mesh)
    meters[name] = { attr, n, cols, shown: -1 }
  }
  const LAMP = (k, n) => (k >= n - 2 ? [1, 0.12, 0.08] : k >= n - 4 ? [1, 0.75, 0.1] : [0.2, 1, 0.3])
  function setMeter(name, level) {
    const m = meters[name]
    if (!m) return
    const lit = Math.round(Math.max(0, Math.min(1, level)) * m.n)
    if (lit === m.shown) return
    m.shown = lit
    for (let c = 0; c < m.cols; c++)
      for (let k = 0; k < m.n; k++) {
        const col = LAMP(k, m.n)
        const b = k < lit ? 1 : 0.1
        // (the shader takes these as linear and brings them back to display values)
        for (let v = 0; v < 4; v++) m.attr.setXYZ((c * m.n + k) * 4 + v, (col[0] * b) ** 2.2, (col[1] * b) ** 2.2, (col[2] * b) ** 2.2)
      }
    m.attr.needsUpdate = true
  }

  // ── the decks ──────────────────────────────────────────────────────────
  const decks = {}
  for (const d of ['A', 'B']) {
    const platter = nodes['platter_' + d]
    const arm = nodes['tonearm_' + d]
    const record = nodes['record_' + d]
    const label = pictured(nodes['label_' + d], 'sleeve_medipack')
    const centre = platter.getWorldPosition(new THREE.Vector3())
    const pivot = arm.getWorldPosition(new THREE.Vector3())
    // how far the arm has to swing for the stylus to sit a given distance from the spindle
    const tip = new THREE.Vector3(0.05, 0, -(arm.userData.length + 0.022))
    const swingFor = (r) => {
      let best = 0
      let err = 1e9
      for (let a = 0; a >= -1.4; a -= 0.004) {
        tmp.copy(tip).applyAxisAngle(THREE.Object3D.DEFAULT_UP, a).add(pivot)
        const e = Math.abs(Math.hypot(tmp.x - centre.x, tmp.z - centre.z) - r)
        if (e < err) {
          err = e
          best = a
        }
      }
      return best
    }
    record.visible = false
    decks[d] = { platter, arm, record, label, centre, pivot, outer: swingFor(0.245), inner: swingFor(0.125), angle: 0, speed: 0, swing: 0, lift: 0, loaded: false }
  }
  const carry = nodes.carry
  const carryLabel = pictured(nodes.carry_label, 'sleeve_medipack')
  scene.attach(carry)
  carry.visible = false
  // d: 'A' | 'B'. state: { loaded, sleeve, playing, rate, progress (0..1 through the side), needle (0 lifted .. 1 down) }
  function setDeck(d, s, dt) {
    const k = decks[d]
    if (s.sleeve && s.sleeve !== k.sleeve) {
      k.sleeve = s.sleeve
      k.label.show('sleeve_' + s.sleeve)
    }
    k.record.visible = !!s.loaded
    // a direct-drive platter is up to speed in a blink and takes a little longer to stop
    const want = s.playing ? s.rate : 0
    k.speed += (want - k.speed) * Math.min(1, dt * (want > k.speed ? 14 : 5))
    k.angle -= k.speed * 3.49 * dt
    k.platter.rotation.y = k.angle
    const down = s.needle ?? 0
    const to = down > 0 ? k.outer + (k.inner - k.outer) * Math.min(1, Math.max(0, s.progress || 0)) : 0
    k.swing += (to - k.swing) * Math.min(1, dt * 7)
    k.lift += ((down > 0.5 && Math.abs(k.swing - to) < 0.03 ? 0 : down > 0 || Math.abs(k.swing) > 0.02 ? 1 : 0) - k.lift) * Math.min(1, dt * 10)
    k.arm.rotation.set(-0.05 * k.lift, k.swing, 0, 'YXZ')
  }
  // the point on a deck's record nearest the DJ, where fingers go
  function deckPoint(d, what, out = new THREE.Vector3()) {
    const k = decks[d]
    if (what === 'needle') return out.copy(tip0).applyAxisAngle(THREE.Object3D.DEFAULT_UP, k.swing).add(k.pivot).setY(k.pivot.y + 0.06)
    // 'label': the middle of the record. 'rim': the edge of the platter nearest the DJ. Otherwise the record, part-way out.
    if (what === 'rim') return out.set(k.centre.x - 0.02, k.centre.y + 0.05, k.centre.z - 0.26)
    return out.set(k.centre.x + (what === 'label' ? 0 : 0.03), k.centre.y + 0.05, k.centre.z - (what === 'label' ? 0.03 : 0.19))
  }
  const tip0 = new THREE.Vector3(0.05, 0, -(nodes.tonearm_A.userData.length + 0.022))

  // ── fire, woofers, the crystal, the sprite ─────────────────────────────────
  const flames = []
  const woofers = []
  world.traverse((o) => {
    if (o.userData.kind === 'flame') flames.push({ node: o, pic: pictured(o, 'flame'), frame: Math.floor(Math.random() * 4), at: 0, strength: o.userData.strength })
    if (o.userData.kind === 'woofer') woofers.push({ node: o, home: o.position.clone(), facing: new THREE.Vector3(...o.userData.facing) })
  })
  for (const f of flames) f.node.material = materials.flame || (materials.flame = material('cutout', { tint: [1.25, 1.2, 1.1], key: 'flame' }))
  const crystal = nodes.crystal
  crystal.material = material('glow', { key: 'crystal' })
  const crystalHome = crystal.position.clone()
  const sprite = nodes.medipack

  // ── the crowd: copies of the one mummy, each a little different ───────────────
  const crowd = []
  {
    const proto = nodes.mummy
    const spots = [[-1.3, 4.5], [0.9, 4.2], [2.6, 4.8], [-2.9, 5.1], [0.0, 5.7], [-1.7, 6.5], [1.8, 6.3], [3.6, 6.7], [-3.9, 7.0], [0.5, 7.5], [-2.4, 8.4], [2.5, 8.6], [-0.6, 9.4], [4.3, 5.4], [-4.6, 5.6]]
    spots.forEach(([x, z], i) => {
      const m = i === 0 ? proto : proto.clone(true)
      if (i) world.add(m)
      const s = 0.56 + ((i * 37) % 10) * 0.02
      m.position.set(x, -0.5, z)
      m.scale.setScalar(s)
      m.rotation.set(0, Math.PI + (((i * 53) % 9) - 4) * 0.06 - x * 0.05, 0)
      const arms = []
      m.traverse((o) => o.userData.kind === 'arm' && arms.push(o))
      const body = m.children[0]
      crowd.push({ node: m, body, arms, phase: (i * 0.37) % 1, keen: 0.5 + ((i * 29) % 10) / 20, turn: m.rotation.y, up: 0 })
    })
  }

  // flat shadows under everybody, the way old games did it
  const blobs = []
  {
    const g = new THREE.CircleGeometry(1, 8)
    g.rotateX(-Math.PI / 2)
    const mat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false })
    const add = (x, y, z, r) => {
      const b = new THREE.Mesh(g, mat)
      b.position.set(x, y + 0.012, z)
      b.scale.set(r, 1, r * 0.9)
      b.renderOrder = 1
      scene.add(b)
      blobs.push(b)
      return b
    }
    add(0, 0, 0, 0.85)
    for (const c of crowd) c.blob = add(c.node.position.x, -0.5, c.node.position.z, 0.6 * c.node.scale.x)
  }

  // ── light in the air: two cones from the ceiling and a fan of lasers from over the painting ────
  const beamMat = new THREE.ShaderMaterial({ vertexShader: beamVertex, fragmentShader: beamFragment, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, transparent: true })
  const cones = [-1, 1].map((side) => {
    const n = 10
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 9), 3).setUsage(THREE.DynamicDrawUsage))
    g.setAttribute('tint', new THREE.BufferAttribute(new Float32Array(n * 12), 4).setUsage(THREE.DynamicDrawUsage))
    const mesh = new THREE.Mesh(g, beamMat)
    mesh.frustumCulled = false
    mesh.renderOrder = 5
    scene.add(mesh)
    return { g, n, side, apex: new THREE.Vector3(side * 2.6, 7.9, -3.6), aim: new THREE.Vector3(), color: new THREE.Color(), level: 0 }
  })
  const lasers = (() => {
    const n = 8
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 18), 3).setUsage(THREE.DynamicDrawUsage))
    g.setAttribute('tint', new THREE.BufferAttribute(new Float32Array(n * 24), 4).setUsage(THREE.DynamicDrawUsage))
    const mesh = new THREE.Mesh(g, beamMat)
    mesh.frustumCulled = false
    mesh.renderOrder = 6
    scene.add(mesh)
    return { g, n, origin: new THREE.Vector3(0, 7.2, -4.7), level: 0, color: new THREE.Color() }
  })()
  const a3 = new THREE.Vector3()
  const b3 = new THREE.Vector3()
  const c3 = new THREE.Vector3()
  function drawBeams(time) {
    for (const k of cones) {
      const pos = k.g.attributes.position
      const tint = k.g.attributes.tint
      a3.subVectors(k.aim, k.apex).normalize()
      b3.set(1, 0, 0).cross(a3).normalize()
      c3.crossVectors(a3, b3)
      const len = k.apex.distanceTo(k.aim)
      for (let i = 0; i < k.n; i++) {
        for (let j = 0; j < 2; j++) {
          const a = ((i + j) / k.n) * Math.PI * 2
          tmp.copy(k.aim).addScaledVector(b3, Math.cos(a) * len * 0.13).addScaledVector(c3, Math.sin(a) * len * 0.13)
          pos.setXYZ(i * 3 + 1 + j, tmp.x, tmp.y, tmp.z)
          tint.setXYZW(i * 3 + 1 + j, k.color.r, k.color.g, k.color.b, 0)
        }
        pos.setXYZ(i * 3, k.apex.x, k.apex.y, k.apex.z)
        tint.setXYZW(i * 3, k.color.r, k.color.g, k.color.b, 0.26 * k.level)
      }
      pos.needsUpdate = tint.needsUpdate = true
    }
    const pos = lasers.g.attributes.position
    const tint = lasers.g.attributes.tint
    for (let i = 0; i < lasers.n; i++) {
      const spread = (i / (lasers.n - 1) - 0.5) * 1.5
      const a = spread + Math.sin(time * 0.6 + i) * 0.16
      const drop = 0.5 + 0.22 * Math.sin(time * 0.9 + i * 1.7)
      a3.set(Math.sin(a) * 15, -drop * 15, Math.cos(a) * 15).add(lasers.origin)
      const o = lasers.origin
      const w = 0.018
      const quad = [[o.x, o.y - w, o.z], [o.x, o.y + w, o.z], [a3.x, a3.y + w, a3.z], [o.x, o.y - w, o.z], [a3.x, a3.y + w, a3.z], [a3.x, a3.y - w, a3.z]]
      const on = lasers.level * (0.6 + 0.4 * Math.sin(time * 7 + i * 2.1))
      quad.forEach((p, j) => {
        pos.setXYZ(i * 6 + j, p[0], p[1], p[2])
        tint.setXYZW(i * 6 + j, lasers.color.r, lasers.color.g, lasers.color.b, on)
      })
    }
    pos.needsUpdate = tint.needsUpdate = true
  }

  // ── sizing: a fixed number of picture lines, scaled up with hard pixel edges ─────────────
  let W = 2
  let H = 2
  let pixel = 2
  let bw = 2
  let bh = 2
  function resize() {
    W = window.innerWidth
    H = window.innerHeight
    const dpr = window.devicePixelRatio || 1
    const device = Math.max(1, Math.round((H * dpr) / LINES))
    pixel = device / dpr
    bw = Math.ceil(W / pixel)
    bh = Math.ceil(H / pixel)
    renderer.setPixelRatio(1)
    renderer.setSize(bw, bh, false)
    canvas.style.width = bw * pixel + 'px'
    canvas.style.height = bh * pixel + 'px'
    shared.uGrid.value.set(bw / 2, bh / 2)
    camera.aspect = bw / bh
    setShot(shotName, true)
  }

  // ── camera: a handful of fixed positions, cut between like a broadcast ─────────────────
  let shotName = 'back'
  const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), fov: 50, yaw: 0, pitch: 0, zoom: 1 }
  const shotFor = (name) => (SHOTS[name] && SHOTS[name].tall && camera.aspect < 0.8 ? { ...SHOTS[name], ...SHOTS[name].tall } : SHOTS[name])
  function setShot(name, keep = false) {
    const s = shotFor(name)
    if (!s) return
    shotName = name
    cam.pos.fromArray(s.pos)
    cam.look.fromArray(s.look)
    cam.up.fromArray(s.up || [0, 1, 0])
    // on a narrow window, widen the lens until the shot's subject still fits across it
    const dist = cam.pos.distanceTo(cam.look)
    const need = 2 * Math.atan(s.span / (2 * dist * camera.aspect))
    cam.fov = Math.max(s.fov, Math.min(86, THREE.MathUtils.radToDeg(need)))
    if (!keep) {
      cam.yaw = cam.pitch = 0
      cam.zoom = 1
    }
  }
  const within = (x, [lo, hi]) => Math.max(lo, Math.min(hi, x))
  // drag the camera round its subject, or move it in and out: never past what has been checked clear
  function orbit(yaw, pitch) {
    const s = shotFor(shotName)
    cam.yaw = within(yaw, s.yaw)
    cam.pitch = within(pitch, s.pitch)
  }
  function dolly(zoom) {
    cam.zoom = within(zoom, shotFor(shotName).zoom)
  }
  const off = new THREE.Vector3()
  const right = new THREE.Vector3()
  function placeCamera(time, still = false) {
    off.subVectors(cam.pos, cam.look)
    // a hand on the camera: it drifts a little, and can be dragged round its subject
    const drift = still || shotName === 'top' ? 0 : 1
    off.applyAxisAngle(cam.up, cam.yaw + Math.sin(time * 0.23) * 0.02 * drift)
    right.crossVectors(cam.up, off).normalize()
    off.applyAxisAngle(right, -cam.pitch + Math.sin(time * 0.31) * 0.012 * drift)
    camera.position.copy(cam.look).addScaledVector(off, cam.zoom)
    camera.up.copy(cam.up)
    camera.lookAt(cam.look)
    camera.fov = cam.fov // the lens never moves with the music: it changes only when the camera is cut to another position
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
  }
  setShot('back')
  resize()
  window.addEventListener('resize', resize)

  // ── every frame ──────────────────────────────────────────────────────────
  // env: { beat (position in beats, fractional), energy 0..1, low 0..1, mid, high, drop (seconds since the last one) }
  let time = 0
  const wash = [new THREE.Color(), new THREE.Color()]
  const PALETTE = [0x2fd0c0, 0xe0398b, 0xf2b33a, 0x4f7bff, 0xc94bff, 0x49e06a]
  function render(dt, env = {}) {
    time += dt
    const beat = env.beat || 0
    const pulse = Math.max(0, 1 - (beat % 1) * 2.4) // sharp on the beat, gone by the off-beat
    const energy = env.energy ?? 0.5
    const low = env.low || 0

    // fire: flip the picture a few times a second, and let the light breathe with it
    for (const f of flames) {
      if (time > f.at) {
        f.at = time + 0.07 + Math.random() * 0.05
        f.frame = (f.frame + 1 + Math.floor(Math.random() * 2)) % 4
        f.pic.show('flame', [f.frame / 4, 0, (f.frame + 1) / 4, 1])
      }
    }
    const flick = 0.86 + 0.14 * Math.sin(time * 11.3) * Math.sin(time * 7.1) + 0.05 * Math.sin(time * 23)
    shared.uExposure.value = 0.95 + 0.05 * flick
    // firelight on him and the gear from either side (nearer than the braziers themselves, which stand at the corners)
    lights[0].pos.set(-3.4, 1.9, 2.3)
    lights[1].pos.set(3.4, 1.9, 2.3)
    lights[0].col.set(1.0, 0.52, 0.2).multiplyScalar(1.25 * flick)
    lights[1].col.set(1.0, 0.52, 0.2).multiplyScalar(1.25 * (1.72 - flick))
    lights[0].range = lights[1].range = 6.5
    // two washes of colour that change with the phrase and throb with the kick
    const phrase = Math.floor(beat / 32)
    wash[0].setHex(PALETTE[phrase % PALETTE.length])
    wash[1].setHex(PALETTE[(phrase + 2) % PALETTE.length])
    const throb = (0.25 + 0.75 * pulse) * (0.25 + energy * 0.95)
    lights[2].pos.set(-3.2 + Math.sin(time * 0.4) * 1.2, 4.2, -1.2)
    lights[3].pos.set(3.0 + Math.cos(time * 0.33) * 1.5, 3.6, 6.2)
    lights[2].col.set(wash[0].r, wash[0].g, wash[0].b).multiplyScalar(1.5 * throb)
    lights[3].col.set(wash[1].r, wash[1].g, wash[1].b).multiplyScalar(1.7 * throb)
    lights[2].range = 8
    lights[3].range = 9
    // the crystal
    crystal.rotation.y = time * 0.9
    crystal.position.y = crystalHome.y + Math.sin(time * 1.3) * 0.08
    const glow = 1 + 0.25 * Math.sin(time * 2.1)
    crystal.material.uniforms.uTint.value.setScalar(glow)
    lights[4].pos.copy(crystal.position)
    lights[4].col.set(0.42, 0.34, 1.0).multiplyScalar(0.9 * glow)
    lights[4].range = 4.2
    // a white flash when a drop lands
    const flash = env.drop != null ? Math.max(0, 1 - env.drop * 1.6) : 0
    lights[5].pos.set(0, 6.5, 2)
    lights[5].col.setScalar(1.6 * flash)
    lights[5].range = 16

    // woofers push out with the bass that is actually leaving the mixer
    for (const w of woofers) w.node.position.copy(w.home).addScaledVector(w.facing, Math.min(0.09, low * 0.11) * (0.4 + 0.6 * pulse))

    // the crowd bounces; more of them, higher, arms up, as the record builds
    for (const c of crowd) {
      const keen = Math.min(1, energy * (0.55 + c.keen))
      const ph = (beat + c.phase * 0.12) % 1
      const hop = Math.abs(Math.sin(ph * Math.PI)) * (0.05 + 0.3 * keen * keen)
      c.node.position.y = -0.5 + hop
      c.body.rotation.z = Math.sin((beat + c.phase) * Math.PI) * 0.07 * (0.4 + keen)
      c.body.rotation.x = Math.sin((beat * 2 + c.phase) * Math.PI) * 0.03
      const want = keen > 0.82 || flash > 0.1 ? 1 : keen > 0.6 && c.keen > 0.7 ? 0.5 : 0
      c.up += (want - c.up) * Math.min(1, dt * 5)
      c.arms.forEach((a, i) => {
        a.rotation.z = (i ? -1 : 1) * (0.35 + c.up * 2.5 + Math.sin(beat * Math.PI * 2 + i * 2 + c.phase * 9) * 0.14 * c.up)
        a.rotation.x = -0.2 * c.up
      })
      c.blob.scale.setScalar((0.6 - hop * 0.5) * c.node.scale.x)
    }
    // the medipack is a flat picture and turns to face whoever is looking
    sprite.rotation.y = Math.atan2(camera.position.x - sprite.position.x, camera.position.z - sprite.position.z)

    // light in the air comes on with the energy
    const show = Math.max(0, (energy - 0.55) / 0.45)
    cones.forEach((k, i) => {
      k.level += (show * (0.5 + 0.5 * pulse) - k.level) * Math.min(1, dt * 8)
      k.color.copy(wash[i])
      k.aim.set(k.side * (1.2 + Math.sin(time * 0.5 + i) * 2.2), -0.5, 5.6 + Math.cos(time * 0.37 + i * 2) * 2.4)
    })
    lasers.level += ((energy > 0.9 ? 0.5 : 0) - lasers.level) * Math.min(1, dt * 6)
    lasers.color.copy(wash[1])
    drawBeams(time)

    placeCamera(time)
    renderer.render(scene, camera)
  }

  // ── where things are on the screen ───────────────────────────────────────────
  const v = new THREE.Vector3()
  function toScreen(p, out = { x: 0, y: 0, z: 0 }) {
    v.copy(p).project(camera)
    out.x = (v.x * 0.5 + 0.5) * W
    out.y = (-v.y * 0.5 + 0.5) * H
    out.z = v.z
    return out
  }
  // the control nearest a point on the screen, if one is near enough to mean it
  const sp = { x: 0, y: 0, z: 0 }
  function pick(x, y) {
    let best = null
    let bestD = Infinity
    const metre = H / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) // pixels a metre covers, one metre away
    const test = (id, p, size) => {
      toScreen(p, sp)
      if (sp.z > 1 || sp.z < -1) return
      const reach = Math.max(14, (size * metre) / camera.position.distanceTo(p))
      const d = Math.hypot(sp.x - x, sp.y - y) / reach
      if (d < 1 && d < bestD) {
        bestD = d
        best = id
      }
    }
    for (const id in controls) test(id, controlPoint(id, a3), controls[id].kind === 'knob' ? 0.05 : 0.045)
    for (const d of ['A', 'B']) test(d + '.platter', decks[d].centre, 0.2)
    return best
  }

  return {
    renderer,
    scene,
    camera,
    nodes,
    controls,
    decks,
    crowd,
    carry,
    carryLabel,
    setControl,
    controlPoint,
    setMeter,
    setDeck,
    deckPoint,
    render,
    resize,
    toScreen,
    pick,
    setShot,
    orbit,
    dolly,
    aim: placeCamera,
    shots: Object.keys(SHOTS),
    // each camera as it is for a window of this shape
    get limits() {
      return Object.fromEntries(Object.keys(SHOTS).map((n) => [n, shotFor(n)]))
    },
    cam,
    material,
    get shot() {
      return shotName
    },
    get size() {
      return { W, H, pixel, bw, bh }
    },
  }
}
