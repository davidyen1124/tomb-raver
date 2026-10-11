// Art direction for TOMB RAVER. Every picture here is drawn by the image model in Codex CLI
// (scripts/gen.mjs), then cut down to console-sized textures by scripts/art.mjs.

const PALETTE = 'Palette: warm ochre sandstone (#b9935a) with umber shadows (#4a3320), and accents of lapis blue (#27479a), turquoise (#2fa39a), terracotta red (#a5452b) and dull gold (#d2a23f).'

// a flat surface that will be shrunk to 64 or 128 pixels and repeated across walls and floors
export const STYLE = `STYLE: A hand-painted texture for a 1996 PlayStation-era 3D adventure game set in an ancient tomb: the look of scanned photo-source textures retouched by hand, slightly soft, chunky brushwork, a limited earthy palette, soft shading baked in, no specular gloss. Strictly a flat-on, orthographic view of a flat surface, evenly lit, with no perspective and no shadows cast by anything outside the picture. The surface fills the whole canvas edge to edge. No border, no frame, no vignette, no text, no watermark. ${PALETTE}`
const TILE = 'It must tile seamlessly: the left edge continues into the right edge and the top edge into the bottom edge.'

// a record sleeve: read at 64 pixels in the corner of the screen and at 24 on a spinning label
const SLEEVE = `STYLE: Front cover artwork of a 12-inch dance single from a small mid-1990s record label: one bold, simple, graphic image, screen-printed inks with a little misregistration and paper grain, strong silhouette, three or four flat colours, readable as a thumbnail. Square, full bleed. Absolutely no text, no letters, no numbers, no logo, no border.`

export const CUTOUT = 'Isolated subject only on a fully transparent background: no backdrop, no floor, no shadow, no glow spreading into the background.'

const SQ = 'square, 1024x1024'
const LAND = 'landscape 3:2, 1536x1024'
const PORT = 'portrait 2:3, 1024x1536'

export const ASSETS = [
  // ——— the tomb ———
  {
    name: 'wall-block',
    size: SQ,
    prompt: `A wall of large dressed sandstone blocks. Exactly two courses high: the top course is two blocks side by side, the bottom course is the same two blocks shifted sideways by half a block (running bond). Thin, dark, recessed mortar joints; chipped corners; faint tool marks; a few pale erosion streaks. ${TILE}`,
  },
  {
    name: 'wall-cracked',
    size: SQ,
    prompt: `A wall of large dressed sandstone blocks, the same masonry as a plain tomb wall (two courses high, two blocks per course, running bond, thin dark joints), but damaged: one long branching crack from top to bottom, a fist-sized chunk missing from one block showing rougher, darker stone, and a little sand caught in the joints. ${TILE}`,
  },
  {
    name: 'wall-glyph',
    size: SQ,
    prompt: `A sandstone wall panel densely carved with ancient-Egyptian-style hieroglyphs in sunk relief, with traces of faded blue, turquoise and red paint in the cuts. Four horizontal registers separated by thin ruled lines. Among the classic signs (birds, eyes, reeds, ankhs, scarabs, wavy water lines, seated figures) are a few signs from another trade: a turntable with a record on it, a pair of headphones, a loudspeaker, a round knob with a pointer, a vinyl disc, a zigzag sound wave. They are carved in exactly the same manner as the rest, so they only show on a second look. ${TILE}`,
  },
  {
    name: 'mural',
    size: LAND,
    prompt: `An ancient-Egyptian-style tomb wall painting on plastered sandstone, flat colours with black outlines, figures in profile in the composite view of that art. In the centre, a seated figure wearing headphones works two turntables on a low table, one hand on a record, one on a knob. Above the figure, a large sun disc drawn as a vinyl record with a gold label, with long rays that end in small open hands. On both sides, two rows of slim dancing figures in white kilts face the centre with their arms raised; behind them, stacks of loudspeakers drawn like shrines. A border of lotus flowers and a band of small hieroglyphs runs along the top and bottom. The paint is worn, with small losses and hairline cracks, but the scene is complete.`,
  },
  {
    name: 'floor',
    size: SQ,
    prompt: `A tomb floor of large square sandstone flagstones seen from directly above: exactly two slabs by two slabs across the canvas. Worn smooth towards the middle of each slab, fine sand drifted into the joints, scuffs, a hairline crack across one slab. ${TILE}`,
  },
  {
    name: 'sand',
    size: SQ,
    prompt: `Fine pale desert sand seen from directly above, with gentle wind ripples running diagonally, a few tiny pebbles and one or two half-buried chips of stone. ${TILE}`,
  },
  {
    name: 'pillar',
    size: PORT,
    prompt: `The painted shaft of an Egyptian temple column, unrolled flat. From the top down: a band of upright lotus petals in blue and green, a narrow band of gold, a wide field of ochre stone with three vertical columns of hieroglyphs in faded blue and red, a narrow band of gold, and at the bottom five horizontal stripes in lapis, turquoise and terracotta. The paint is worn and chipped. The left edge continues seamlessly into the right edge.`,
  },
  {
    name: 'sarcophagus',
    size: LAND,
    prompt: `The long side of a painted and gilded wooden sarcophagus, seen flat-on. Horizontal stripes of lapis blue and gold run its whole length; in the middle, a wide band with a winged scarab holding a disc, flanked by two columns of hieroglyphs; a row of small rosettes along the top edge and a chequered band along the bottom. Old gilding, worn through to red clay at the edges, fine cracks in the paint.`,
  },
  {
    name: 'gold',
    size: SQ,
    prompt: `A sheet of hammered, slightly tarnished gold, chased with a shallow pattern of overlapping feathers. Dull highlights only, darker in the hollows. ${TILE}`,
  },
  {
    name: 'crate',
    size: SQ,
    prompt: `One face of a sturdy wooden supply crate, seen flat-on and filling the canvas exactly: a frame of four thick boards around the edge, vertical planks inside it, one diagonal brace from corner to corner, iron nails, and dark iron brackets on the four corners. Weathered, sun-bleached wood with a few knocks.`,
  },
  {
    name: 'speaker',
    size: PORT,
    prompt: `The front of a tall, black club loudspeaker cabinet, seen exactly flat-on and filling the canvas: a plywood box covered in scuffed black carpet, a wide rectangular horn flare across the top quarter, and below it two large round woofer cones one above the other, each with a grey paper cone, a black dust cap, a rubber surround and a ring of eight screws. Steel protectors on the four corners. Dust in the corners, a strip of gaffer tape.`,
    plain: true,
    style: 'STYLE: A hand-painted texture for a 1996 PlayStation-era 3D game: slightly soft, chunky brushwork, limited palette, soft shading baked in. Strictly flat-on and orthographic, evenly lit. No text, no logo, no border.',
  },
  {
    name: 'door',
    size: PORT,
    prompt: `A massive sealed stone tomb door: two tall slabs meeting at a straight vertical seam down the middle, framed by a heavy lintel with a winged sun disc carved on it. Each slab carries a deep relief of a tall standing guardian figure in profile facing the seam, holding a staff. Traces of blue and gold paint; sand piled along the bottom edge.`,
  },
  {
    name: 'bandage',
    size: SQ,
    prompt: `Old linen mummy wrappings, close up: overlapping horizontal and slightly diagonal strips of yellowed bandage, frayed edges, a few darker stains and narrow dark gaps between strips. ${TILE}`,
  },
  {
    name: 'flyer',
    size: PORT,
    plain: true,
    prompt: `A photocopied and screen-printed rave flyer from 1994, portrait, slightly creased, with four bits of yellowed tape at the corners. Fluorescent pink and acid yellow ink on black. A pyramid with a vinyl record rising behind it like a sun, a row of little dancing stick figures, a turntable. Big chunky lettering, in this order from the top: "DJ MONOLITH" (largest), "TOMB RAVER", "ALL NIGHT LONG", and in small type at the bottom "BURIAL CHAMBER 2 · BRING WATER". Spell every word exactly as given; no other text. Flat-on view, the flyer fills the canvas.`,
  },

  // ——— the title screen ———
  {
    name: 'keyart',
    size: LAND,
    plain: true,
    refs: ['photo:pebble'],
    prompt: `The attached image shows the character: a smooth cornflower-blue, egg-shaped mascot with no mouth and no nose, two small black oval eyes with a white glint, short stubby arms with mitten hands and white low-top sneakers. Ignore everything else in that image (the magazine lettering, the captions, the tie, the cap, the belt, the other accessories).

Paint the cover illustration for a 1996 PlayStation action-adventure game: the pre-rendered, airbrushed 3D look of mid-90s game box art, dramatic and a little grainy. The blue egg mascot is a DJ in an ancient Egyptian burial chamber. It stands behind a stone sarcophagus that carries two silver turntables with black records and a mixer between them; one mitten hand rests on a record, the other is on a mixer knob. It wears big cream-and-gold headphones and small round dark sunglasses with gold rims, and a brown leather belt. Burning torches on the sandstone walls, hieroglyphs, two towering stacks of black loudspeakers left and right, shafts of turquoise and magenta light cutting through dusty air from behind, sand on the floor. Low camera, looking slightly up at the DJ, who is in the middle of the picture and fairly small in it, so that the top quarter (dark ceiling, light shafts) and the bottom fifth (dark floor) are calm enough to carry a title and a line of small type. No text, no letters, no logo, no watermark.`,
  },
  {
    name: 'logo',
    size: LAND,
    plain: true,
    transparent: true,
    prompt: `Game title lettering, two words on one line: "TOMB RAVER". Spell it exactly: T-O-M-B, space, R-A-V-E-R. Heavy, slightly condensed serif capitals that look chiselled out of sandstone and then gilded: bevelled faces of worn gold, sandstone showing at the chipped edges, a thin dark outline. The O of TOMB is a black vinyl record with a small gold label. Original lettering, not a copy of any existing game logo. The words span almost the full width of the canvas, centred, straight and level, with nothing else: no tagline, no ornament, no subtitle. ${CUTOUT}`,
  },

  // ——— the cursor: his own hand, in three states ———
  {
    name: 'cursor-open',
    size: SQ,
    plain: true,
    transparent: true,
    refs: ['photo:pebble'],
    prompt: `The attached image shows the character this hand belongs to: a smooth cornflower-blue, egg-shaped mascot with short stubby arms that end in round mitten hands (no separate fingers: one rounded mitten and one short thumb). Ignore everything else in that image.

Draw ONE thing: that character's hand, as the mouse pointer of a 1996 PlayStation-era adventure game. A chubby cornflower-blue mitten on a short piece of forearm, seen from the back of the hand. It reaches in from the bottom-right corner of the canvas and points diagonally up to the top-left, so that the rounded tip of the mitten is the top-left-most part of the drawing and sits close to the top-left corner. The hand is open and relaxed, with the short thumb sticking out to the lower left. A red sweatband goes round the wrist, where the forearm is cut off straight.

Chunky and simple, readable when shrunk to 32 pixels: flat cel shading in three tones of the blue (lightest on the upper left, darkest underneath), one small pale highlight, and a thick near-black outline all the way round. No glow, no drop shadow, no motion lines, no text. The hand fills most of the canvas.`,
  },
  {
    name: 'cursor-point',
    size: SQ,
    plain: true,
    transparent: true,
    refs: ['cursor-open'],
    prompt: `The attached image is a game's mouse pointer: a cornflower-blue mitten hand with a red sweatband, pointing to the top-left. Draw exactly the same hand again (same size, same angle, same place on the canvas, same colours, same thick near-black outline, same flat cel shading), changed in one way only: it is about to pinch something small. The short thumb has swung round to the front and the tip of the mitten has curled a little to meet it, leaving a small clear gap between thumb-tip and mitten-tip at the top-left, the way a hand looks just before it takes hold of a small round knob. The top-left-most point of the drawing stays where it was. No glow, no drop shadow, no knob, no text.`,
  },
  {
    name: 'cursor-grab',
    size: SQ,
    plain: true,
    transparent: true,
    // drawn from the hand about to pinch, not from the open one: it is the next moment of the same movement,
    // so the thumb is still the lower lobe when the hand closes
    refs: ['cursor-point'],
    prompt: `The attached image is a game's mouse pointer: a cornflower-blue mitten hand with a red sweatband, seen from the back of the hand and pointing to the top-left. It has two lobes with a gap between them. The big upper lobe is the mitten (all four fingers in one), with a pale highlight on top. The small lower lobe, on the lower-left side, is the thumb. In the attached image the hand is about to pinch something.

Draw exactly the same hand again (same size, same angle, same place on the canvas, same colours, same thick near-black outline, same flat cel shading, the same red sweatband and the same cut-off forearm in the same place), changed in one way only: the pinch has closed and the hand is holding on. The thumb has moved up a little and the tip of the mitten has curled down a little until the two press together, so the gap and the hole between them are gone, and one short dark crease line is all that is left where they meet. The thumb is still the small lower lobe on the lower-left side, tucked snug under the mitten. The mitten is still the big upper lobe, with its pale highlight on top. The closed hand is a little rounder and more compact than before, like a soft fist holding a small knob, but its top-left-most point stays where it was.

The thumb must NOT move to the top of the hand and must not lie across the middle or the back of the hand. The hand must not be flipped, mirrored or turned over. No glow, no drop shadow, no knob, no text.`,
  },

  // ——— the record box: one sleeve for each record ———
  { name: 'sleeve-medipack', size: SQ, plain: true, prompt: `A small first-aid pouch of worn canvas with one bold plain cross on its flap, seen from above, lying on sand, long evening shadow. Cream, brick red and deep teal.\n\n${SLEEVE}` },
  { name: 'sleeve-swandive', size: SQ, plain: true, prompt: `A tiny diver in mid-air, arms spread wide like wings, back arched, falling past a tall waterfall into a round turquoise pool far below. Big flat sunset behind: orange, hot pink, turquoise.\n\n${SLEEVE}` },
  { name: 'sleeve-tank', size: SQ, plain: true, prompt: `A stone tablet carved with one big plus-shaped directional pad, its four arrows worn smooth by thumbs, glowing acid yellow from the cracks. Acid yellow, black, stone grey.\n\n${SLEEVE}` },
  { name: 'sleeve-block', size: SQ, plain: true, prompt: `One huge stone cube standing alone on an empty floor of square tiles, throwing a very long shadow; a tiny figure leans against it with both hands, pushing. Violet, pale stone grey, black.\n\n${SLEEVE}` },
  { name: 'sleeve-crystal', size: SQ, plain: true, prompt: `A tall faceted blue crystal floating upright above a stone pedestal in a dark cave, turning, with a ring of small sparks around it. Electric blue, white, near-black indigo.\n\n${SLEEVE}` },
  { name: 'sleeve-butler', size: SQ, plain: true, prompt: `The heavy steel door of a walk-in freezer standing slightly open, frost on its edges, cold mist spilling out across a chequered kitchen floor; on the floor in front of it a silver tray with a teacup that is still rattling. Ice cyan, silver, black, one small spot of warm orange.\n\n${SLEEVE}` },
  { name: 'sleeve-secret', size: SQ, plain: true, prompt: `A small golden idol on a stone pedestal in a hidden alcove, hit by a single shaft of light from above, dust sparkling in the beam. Gold, warm white, deep brown.\n\n${SLEEVE}` },
  { name: 'sleeve-boulder', size: SQ, plain: true, prompt: `A gigantic round boulder thundering down a narrow sloping stone corridor straight towards the viewer, speed lines, dust; a tiny running figure in the foreground corner. Red, orange, black.\n\n${SLEEVE}` },
  { name: 'sleeve-valley', size: SQ, plain: true, prompt: `A misty green jungle valley between cliffs, with the huge silhouette of a tyrannosaurus skeleton striding through the mist, a waterfall behind it. Jungle green, pale mist, black.\n\n${SLEEVE}` },
  { name: 'sleeve-lever', size: SQ, plain: true, prompt: `A rusty iron lever switch set in a stone wall, halfway through being pulled down by a small mitten-shaped hand, a spark jumping from it. Magenta, black, rust orange.\n\n${SLEEVE}` },
]
