// A contact sheet of assets-src/art/raw, for looking at everything the image model drew at once.
// usage: node scripts/sheet.mjs [prefix] [out.jpg] [cell=320]
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.resolve(import.meta.dirname, '..')
const prefix = process.argv[2] || ''
const out = process.argv[3] || path.join(ROOT, 'qa/art-sheet.jpg')
const cell = Number(process.argv[4] || 320)
const files = fs.readdirSync(path.join(ROOT, 'assets-src/art/raw')).filter((f) => f.endsWith('.png') && f.startsWith(prefix)).sort()
const cols = Math.min(files.length, Math.ceil(Math.sqrt(files.length * 1.4)))
const rows = Math.ceil(files.length / cols)
const tiles = await Promise.all(
  files.map(async (f, i) => ({
    input: await sharp(path.join(ROOT, 'assets-src/art/raw', f)).resize(cell, cell, { fit: 'contain', background: '#402030' }).flatten({ background: '#402030' }).png().toBuffer(),
    left: (i % cols) * cell,
    top: Math.floor(i / cols) * cell,
  })),
)
fs.mkdirSync(path.dirname(out), { recursive: true })
await sharp({ create: { width: cols * cell, height: rows * cell, channels: 3, background: '#000' } }).composite(tiles).jpeg({ quality: 86 }).toFile(out)
console.log(out, files.map((f, i) => `${i + 1}:${f.replace('.png', '')}`).join('  '))
