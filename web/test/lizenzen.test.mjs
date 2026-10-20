// Lizenztexte im Image (05.10.2026): licenses/ liegt im Image, enthält die Texte, die LGPL-Angaben zu libvips und je direkter Abhängigkeit
// von Oberfläche und Server einen Ordner. Fehlt einer, ist ein Paket dazugekommen und `node tools/lizenzen.mjs` nicht gelaufen.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..', '..')
const lies = p => fs.readFileSync(path.join(root, p), 'utf8')
const ordner = name => name.replace(/^@/, '').replace(/\//g, '+')

test('das Image enthält licenses/', () => {
  assert.match(lies('Dockerfile'), /^COPY licenses\/ \.\/licenses\/$/m)
  assert.match(lies('.dockerignore'), /^!licenses\/\*\*$/m, '*.md ist ausgeschlossen — licenses/ braucht die Ausnahme')
})

test('die Lizenztexte und die Angaben zu libvips liegen bei', () => {
  for (const f of ['GPL-3.0.txt', 'LGPL-3.0.txt', 'Apache-2.0.txt', 'MIT.txt', 'MPL-1.1.txt', 'Npgsql-PostgreSQL.txt'])
    assert.ok(fs.statSync(path.join(root, 'licenses', 'texte', f)).size > 500, f)
  assert.match(lies('licenses/texte/LGPL-3.0.txt'), /GNU LESSER GENERAL PUBLIC LICENSE\s+Version 3/)
  const vips = lies('licenses/libvips.md')
  for (const s of ['github.com/libvips/libvips', 'github.com/lovell/sharp-libvips', 'versions.json', 'Reverse Engineering']) assert.ok(vips.includes(s), s)
  // seit 20.10.2026 AGPL-3.0: sie schränkt das Ändern und Untersuchen der LGPL-Bibliotheken nicht ein — vorher stand das als Zusatz in LICENSE
  assert.match(lies('LICENSE'), /^\s*GNU AFFERO GENERAL PUBLIC LICENSE/)
})

test('je direkte Abhängigkeit von Oberfläche und Server ein Ordner mit Lizenztext', () => {
  const web = Object.keys(JSON.parse(lies('web/package.json')).dependencies)
  for (const p of web) {
    const dir = path.join(root, 'licenses', 'oberflaeche', ordner(p))
    assert.ok(fs.existsSync(dir) && fs.readdirSync(dir).length, `licenses/oberflaeche/${ordner(p)} fehlt — node tools/lizenzen.mjs`)
  }
  const csproj = lies('Journali.Server/Journali.Server.csproj')
  for (const [, id] of csproj.matchAll(/<PackageReference Include="([^"]+)"/g)) {
    const dir = path.join(root, 'licenses', 'server', id)
    assert.ok(fs.existsSync(dir) && fs.readdirSync(dir).some(f => /^licen/i.test(f)), `licenses/server/${id} fehlt — node tools/lizenzen.mjs`)
  }
})
