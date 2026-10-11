// Two decks into a mixer. Works on a live AudioContext and on an offline one (scripts/listen.mjs
// renders the set to a file that way, so it can be measured without anybody having to listen).
import { Deck, makeIR } from './deck.js'
import { Mixer, curve } from './mixer.js'

export function createEngine(ctx) {
  const ir = makeIR(ctx)
  const decks = { A: new Deck(ctx, 'A', ir), B: new Deck(ctx, 'B', ir) }
  const mixer = new Mixer(ctx, decks, ir)
  const engine = {
    ctx,
    decks,
    mixer,
    lookahead: 0.14, // seconds of music kept scheduled ahead of the clock
    tick() {
      const now = ctx.currentTime
      decks.A.tick(now, now + engine.lookahead)
      decks.B.tick(now, now + engine.lookahead)
      const live = engine.live()
      if (live) mixer.setTempo(live.bpm, now)
    },
    // how much of a deck is reaching the room, going by where its fader and the crossfader are
    presence(name) {
      const d = decks[name]
      if (!d.playing) return 0
      const v = mixer.values
      const x = curve.xfade(v.xfader ?? 0.5)[name === 'A' ? 0 : 1]
      return curve.fader(v[`${name}.fader`] ?? 0) * x
    },
    // the deck the room is mostly hearing
    live() {
      const a = engine.presence('A')
      const b = engine.presence('B')
      if (a <= 0 && b <= 0) return decks.A.playing ? decks.A : decks.B.playing ? decks.B : null
      return a >= b ? decks.A : decks.B
    },
  }
  return engine
}

// every control on the desk, where it rests, and what it is called on the faceplate
export const CONTROLS = [
  ...['A', 'B'].flatMap((ch) => [
    { id: `${ch}.trim`, kind: 'knob', home: 0.5, label: 'TRIM' },
    { id: `${ch}.hi`, kind: 'knob', home: 0.5, label: 'HI' },
    { id: `${ch}.mid`, kind: 'knob', home: 0.5, label: 'MID' },
    { id: `${ch}.low`, kind: 'knob', home: 0.5, label: 'LOW' },
    { id: `${ch}.filter`, kind: 'knob', home: 0.5, label: 'FILTER' },
    { id: `${ch}.fader`, kind: 'fader', home: 0, label: 'FADER' },
    { id: `${ch}.cue`, kind: 'button', home: 0, label: 'CUE' },
  ]),
  { id: 'xfader', kind: 'xfader', home: 0.5, label: 'CROSSFADER' },
  { id: 'master', kind: 'knob', home: 0.75, label: 'MASTER' },
  { id: 'echo', kind: 'knob', home: 0, label: 'ECHO' },
  { id: 'reverb', kind: 'knob', home: 0, label: 'REVERB' },
  { id: 'fxsel', kind: 'switch', home: 0.5, label: 'FX ON' },
]
