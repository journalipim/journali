// Bezeichnung der Lizenz (20.10.2026): journali steht unter der AGPL-3.0, einer Open-Source-Lizenz. Was der Leser sieht (README, Hilfe,
// Beiträge, Blog, Website, Oberfläche), nennt sie so — die frühere Lizenz (Elastic License 2.0, „Source Available“) steht dort
// nicht mehr. Die Entscheidung und ihre Geschichte stehen in docs/HILFE_UND_SPRACHE_PLAN.md.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..', '..')
const dateien = dir => fs.readdirSync(path.join(root, dir), { recursive: true }).map(f => path.join(dir, String(f)))
  .filter(f => /\.(md|vue|js|json|html)$/.test(f) && !f.includes('node_modules') && fs.statSync(path.join(root, f)).isFile())

test('die frühere Lizenz steht nirgends mehr, wo ein Leser sie sieht', () => {
  const treffer = []
  for (const f of ['README.md', 'CONTRIBUTING.md', 'THIRD-PARTY-NOTICES.md', ...dateien('help'), ...dateien('blog'), ...dateien('site'), ...dateien('web/src'), 'web/public/lang/en.json'])
    fs.readFileSync(path.join(root, f), 'utf8').split('\n').forEach((z, i) => {
      if (/Elastic License|ELv2|source[ -]available/i.test(z)) treffer.push(`${f}:${i + 1}`)
    })
  assert.deepEqual(treffer, [])
})

test('LICENSE ist der Wortlaut der AGPL-3.0, und die Hilfe nennt sie', () => {
  const lizenz = fs.readFileSync(path.join(root, 'LICENSE'), 'utf8')
  assert.match(lizenz, /^\s*GNU AFFERO GENERAL PUBLIC LICENSE\s+Version 3, 19 November 2007/)
  for (const l of ['de', 'en']) assert.match(fs.readFileSync(path.join(root, 'help', l, '15-lizenz.md'), 'utf8'), /GNU Affero General Public License, [Vv]ersion 3/)
})
