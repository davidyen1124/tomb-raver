// A stage with no picture and a body with no shape: just enough for the hands and the brain to run
// against when the set is rendered offline (scripts/listen.mjs), or when there is no WebGL at all.
import * as THREE from 'three'
import LAY from './layout.json'

export function createGhost() {
  const M = LAY.mixer
  const top = LAY.table.y + M.h
  const at = {}
  const controls = {}
  const put = (id, kind, x, z, y = top) => {
    at[id] = new THREE.Vector3(x, y + 0.05, z)
    controls[id] = { id, kind, value: 0 }
  }
  for (const ch of ['A', 'B']) {
    const sx = LAY.strip[ch]
    for (const [row, z] of Object.entries(LAY.rows)) put(`${ch}.${row}`, 'knob', M.x + sx, M.z + z)
    put(`${ch}.fader`, 'fader', M.x + sx, M.z + (LAY.fader.z0 + LAY.fader.z1) / 2)
    put(`${ch}.cue`, 'button', M.x + Math.sign(sx) * LAY.cue.x, M.z + LAY.cue.z)
    const D = LAY.deck[ch]
    const dy = LAY.table.y + LAY.deck.h
    put(`${ch}.pitch`, 'fader', D.x + LAY.pitch.x, D.z + LAY.pitch.z, dy)
    put(`${ch}.play`, 'button', D.x + LAY.start.x, D.z + LAY.start.z, dy)
  }
  put('master', 'knob', M.x + LAY.master.x, M.z + LAY.master.z)
  put('echo', 'knob', M.x + LAY.echo.x, M.z + LAY.echo.z)
  put('reverb', 'knob', M.x + LAY.reverb.x, M.z + LAY.reverb.z)
  put('xfader', 'fader', M.x, M.z + LAY.xfader.z)
  put('fxsel', 'switch', M.x + LAY.fxsel.x, M.z + LAY.fxsel.z)
  const stage = {
    controls,
    setControl(id, v) {
      if (controls[id]) controls[id].value = v
    },
    controlPoint: (id, out = new THREE.Vector3()) => out.copy(at[id]),
    deckPoint(d, what, out = new THREE.Vector3()) {
      const D = LAY.deck[d]
      return out.set(D.x + LAY.platter.x, LAY.table.y + LAY.deck.h + 0.05, D.z + LAY.platter.z - (what === 'label' ? 0 : 0.19))
    },
  }
  const arm = (x) => ({ tip: new THREE.Vector3(x, 1.2, 0.6), goal: new THREE.Vector3(x, 1.2, 0.6), speed: 13, flat: 0 })
  const puppet = {
    arms: { l: arm(0.6), r: arm(-0.6) },
    update(dt) {
      for (const a of Object.values(puppet.arms)) a.tip.lerp(a.goal, 1 - Math.exp(-dt * a.speed))
    },
    onBody: (x, y, z, out = new THREE.Vector3()) => out.set(x, y, z),
  }
  return { stage, puppet }
}
