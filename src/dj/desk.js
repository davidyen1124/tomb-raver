// The desk: one number from 0 to 1 for every control, and the only door through which a number reaches
// the sound and the picture. hands.js is the only caller, and only with a fingertip on the control.
import { CONTROLS } from '../audio/engine.js'

export function createDesk(engine, stage) {
  const value = {}
  let touches = 0
  const desk = {
    value,
    get touches() {
      return touches
    },
    set(id, v, pressed = 0) {
      v = Math.max(0, Math.min(1, v))
      if (value[id] !== undefined && Math.abs(v - value[id]) > 1e-4) touches++
      value[id] = v
      const what = id.split('.').pop()
      // pitch belongs to the deck: eight per cent either way. The start button's lamp just shows what the deck is doing.
      if (what === 'pitch') engine.decks[id[0]].setPitch((v - 0.5) * 0.16)
      else if (what !== 'play') engine.mixer.set(id, v)
      stage.setControl(id, v, pressed)
    },
  }
  for (const c of CONTROLS) desk.set(c.id, c.home)
  for (const d of ['A', 'B']) {
    desk.set(`${d}.pitch`, 0.5)
    desk.set(`${d}.play`, 0)
  }
  touches = 0
  return desk
}
