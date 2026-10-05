// Bezeichnung der Lizenz (05.10.2026): die Elastic License ist keine anerkannte Open-Source-Lizenz — „Open Source“ oder „quelloffen“ wäre
// irreführend. Was der Leser sieht (README, Hilfe, Beiträge, Doku, Oberfläche), nennt journali „Source Available“; erlaubt ist nur die Verneinung.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..', '..')
const dateien = dir => fs.readdirSync(path.join(root, dir), { recursive: true }).map(f => path.join(dir, String(f)))
  .filter(f => /\.(md|vue|js|json)$/.test(f) && !f.includes('node_modules') && fs.statSync(path.join(root, f)).isFile())

test('nirgends „Open Source“ als Bezeichnung von journali', () => {
  const treffer = []
  for (const f of ['README.md', 'CONTRIBUTING.md', ...dateien('help'), ...dateien('blog'), ...dateien('docs'), ...dateien('web/src'), 'web/public/lang/en.json'])
    fs.readFileSync(path.join(root, f), 'utf8').split('\n').forEach((z, i) => {
      if (/open[ -]?source|quelloffen/i.test(z) && !/keine Open-Source|not an open-source/i.test(z)) treffer.push(`${f}:${i + 1}`)
    })
  assert.deepEqual(treffer, [])
})
