// Lizenztexte für das Image (05.10.2026): legt unter licenses/ ab, was die Bestandteile in ihrer Form im Image nicht selbst mitbringen.
//   - Die Oberfläche ist gebündelt: in wwwroot fehlen die LICENSE- und NOTICE-Dateien ihrer Pakete → licenses/oberflaeche/<paket>/
//   - Die .NET-Pakete liegen nur als DLL vor → licenses/server/<paket>/ (die Dateien aus dem NuGet-Paket, sonst Text mit Copyright aus dem nuspec)
// Die Plugins bringen ihre node_modules samt LICENSE- und NOTICE-Dateien ins Image; libvips beschreibt licenses/libvips.md.
// Die Lizenztexte selbst (licenses/texte/) stehen fest im Repo, wörtlich aus der SPDX-Liste bzw. vom Paket.
//
// Aufruf nach einem Paketwechsel in web/ oder Journali.Server (nach npm install und dotnet build):  node tools/lizenzen.mjs
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ziel = path.join(root, 'licenses')
const texte = path.join(ziel, 'texte')
const LIZENZDATEI = /^(licen[cs]e|notice|copying|third-party-notices)(\.|$)/i
const ordner = name => name.replace(/^@/, '').replace(/\//g, '+')
const warnungen = []

// Der Text der MIT-Lizenz mit einer Copyright-Zeile — für Pakete, die ihren Lizenztext nicht beilegen
const mit = wer => fs.readFileSync(path.join(texte, 'MIT.txt'), 'utf8')
  .replace('Copyright (c) <year> <copyright holders>', /^(copyright|©)/i.test(wer) ? wer : `Copyright (c) ${wer}`)
function neu(dir) { fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true }) }

// ---- Oberfläche: die Pakete ohne Entwicklungswerkzeuge, wie npm sie installiert hat
const oberflaeche = path.join(ziel, 'oberflaeche'); neu(oberflaeche)
const pfade = execSync('npm ls --omit=dev --all --parseable', { cwd: path.join(root, 'web'), encoding: 'utf8' })
  .split(/\r?\n/).map(s => s.trim()).filter(p => p.includes('node_modules'))
const liste = []
for (const dir of [...new Set(pfade)].sort()) {
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
  if (/-(win32|darwin|linux|android|freebsd)-/.test(pkg.name)) continue   // Binärdatei für eine Plattform: nicht im Browser-Paket
  const dateien = fs.readdirSync(dir).filter(f => LIZENZDATEI.test(f))
  const aus = path.join(oberflaeche, ordner(pkg.name)); fs.mkdirSync(aus, { recursive: true })
  for (const f of dateien) fs.copyFileSync(path.join(dir, f), path.join(aus, f))
  const autor = typeof pkg.author === 'string' ? pkg.author : pkg.author?.name
  if (!dateien.length && pkg.license === 'MIT' && autor) fs.writeFileSync(path.join(aus, 'LICENSE.txt'), mit(autor))
  else if (!dateien.length) warnungen.push(`oberflaeche: ${pkg.name} ${pkg.version} hat keine Lizenzdatei`)
  liste.push(`${pkg.name}\t${pkg.version}\t${pkg.license ?? '?'}`)
}
fs.writeFileSync(path.join(oberflaeche, 'PAKETE.txt'), liste.join('\n') + '\n')

// ---- Server: die NuGet-Pakete aus dem letzten Bau (project.assets.json), Dateien aus dem NuGet-Cache
const server = path.join(ziel, 'server'); neu(server)
const assets = JSON.parse(fs.readFileSync(path.join(root, 'Journali.Server', 'obj', 'project.assets.json'), 'utf8'))
const cache = process.env.NUGET_PACKAGES ?? path.join(os.homedir(), '.nuget', 'packages')
const sliste = []
for (const [schluessel, lib] of Object.entries(assets.libraries)) {
  if (lib.type !== 'package') continue
  const [id, version] = schluessel.split('/')
  const dir = path.join(cache, id.toLowerCase(), version)
  const nuspec = fs.readFileSync(path.join(dir, `${id.toLowerCase()}.nuspec`), 'utf8')
  const lizenz = nuspec.match(/<license type="expression">([^<]+)<\/license>/)?.[1] ?? '?'
  const copyright = nuspec.match(/<copyright>([^<]+)<\/copyright>/)?.[1]?.trim()
  const aus = path.join(server, id); fs.mkdirSync(aus, { recursive: true })
  const dateien = fs.readdirSync(dir).filter(f => LIZENZDATEI.test(f))
  for (const f of dateien) fs.copyFileSync(path.join(dir, f), path.join(aus, f))
  if (!dateien.some(f => /^licen/i.test(f))) {
    // Kein Lizenztext im Paket: der Text der Lizenz, mit dem Copyright aus dem nuspec
    const vorlage = path.join(texte, `${id}-${lizenz}.txt`)   // ein Paket mit eigenem Wortlaut (Npgsql)
    if (fs.existsSync(vorlage)) fs.copyFileSync(vorlage, path.join(aus, 'LICENSE.txt'))
    else if (lizenz === 'MIT' && copyright) fs.writeFileSync(path.join(aus, 'LICENSE.txt'), mit(copyright))
    else warnungen.push(`server: ${id} ${version} (${lizenz}) — kein Lizenztext`)
  }
  sliste.push(`${id}\t${version}\t${lizenz}`)
}
fs.writeFileSync(path.join(server, 'PAKETE.txt'), sliste.join('\n') + '\n')

console.log(`licenses/: ${liste.length} Pakete der Oberfläche, ${sliste.length} des Servers`)
for (const w of warnungen) console.log('! ' + w)
