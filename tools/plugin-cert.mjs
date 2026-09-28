#!/usr/bin/env node
// Zertifizierung von Plugins: ein signiertes certificate.json je Plugin-Verzeichnis.
//
//   node tools/plugin-cert.mjs keys                      Schlüsselpaar erzeugen (privat als PEM-Datei, öffentlich als Base64 auf stdout)
//   node tools/plugin-cert.mjs sign <key…> [--ignore p]  certificate.json schreiben; ohne <key>: alle Plugins, die schon eines haben
//   node tools/plugin-cert.mjs verify [<key…>]           Siegel prüfen (Rückgabe 1, wenn eines gebrochen ist)
//   node tools/plugin-cert.mjs catalog <ziel>            catalog.json und ein Zip je zertifiziertem Plugin nach <ziel> schreiben
//
// Privater Schlüssel: JOURNALI_PLUGIN_SIGNING_KEY (Pfad zur PEM-Datei), sonst ~/.journali/plugin-signing.pem.
// Öffentlicher Schlüssel zum Prüfen: JOURNALI_PLUGIN_KEY (Base64 SubjectPublicKeyInfo), sonst der eingebaute in PluginSeal.cs.
//
// Was gehasht wird (identisch mit Journali.Server/PluginSeal.cs): alle Dateien unter plugins/<key>/, ausser node_modules, .cache,
// __pycache__, .git, certificate.json und den Pfaden unter `ignore`; Pfade mit / getrennt, ordinal sortiert;
// je Datei `pfad\0sha256hex\n` in einen SHA-256. Signiert wird `key\nversion\nhash\nissued\nissuer\nignore,…`
// mit ECDSA P-256 / SHA-256, Signatur als IEEE P1363 (r||s) in Base64 — das Format, das .NET VerifyData erwartet.
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PLUGINS = join(ROOT, 'plugins')
// .cache: was ein Plugin zur Laufzeit holt (embed sein Modell) — sonst bricht es sein eigenes Siegel (28.09.2026)
const SKIP_DIRS = new Set(['node_modules', '__pycache__', '.git', '.cache'])
const CERT = 'certificate.json'
const ISSUER = 'journali'

/// Der eingebaute öffentliche Schlüssel — derselbe wie in PluginSeal.cs
export function builtinPublicKey() {
  const src = readFileSync(join(ROOT, 'Journali.Server', 'PluginSeal.cs'), 'utf8')
  const m = src.match(/DefaultKey\s*=\s*"([A-Za-z0-9+/=]+)"/)
  if (!m) throw new Error('DefaultKey fehlt in PluginSeal.cs')
  return m[1]
}

/// Alle Dateien eines Plugins, relativ, mit /, ordinal sortiert
export function files(dir, ignore = []) {
  const out = []
  const walk = d => {
    for (const name of readdirSync(d)) {
      const p = join(d, name)
      const rel = relative(dir, p).split('\\').join('/')
      if (statSync(p).isDirectory()) { if (!SKIP_DIRS.has(name) && !ignored(rel, ignore)) walk(p); continue }
      if (rel === CERT || ignored(rel, ignore)) continue
      out.push(rel)
    }
  }
  walk(dir)
  return out.sort()
}
const ignored = (rel, ignore) => ignore.some(i => rel === i || rel.startsWith(i.replace(/\/$/, '') + '/'))

export function hashOf(dir, ignore = []) {
  const h = createHash('sha256')
  for (const rel of files(dir, ignore)) {
    const fh = createHash('sha256').update(readFileSync(join(dir, rel))).digest('hex')
    h.update(rel + '\0' + fh + '\n')
  }
  return h.digest('hex')
}

export const body = c => [c.key, c.version, c.hash, c.issued, c.issuer, (c.ignore ?? []).join(',')].join('\n')

function privateKey() {
  const p = process.env.JOURNALI_PLUGIN_SIGNING_KEY || join(homedir(), '.journali', 'plugin-signing.pem')
  if (!existsSync(p)) throw new Error(`privater Schlüssel fehlt: ${p} (node tools/plugin-cert.mjs keys)`)
  return createPrivateKey(readFileSync(p, 'utf8'))
}
function publicKey() {
  const b64 = process.env.JOURNALI_PLUGIN_KEY || builtinPublicKey()
  return createPublicKey({ key: Buffer.from(b64, 'base64'), format: 'der', type: 'spki' })
}

export function signPlugin(key, ignore = []) {
  const dir = join(PLUGINS, key)
  const manifest = JSON.parse(readFileSync(join(dir, 'plugin.json'), 'utf8'))
  if (manifest.key !== key) throw new Error(`${key}: Manifest nennt ${manifest.key}`)
  const c = { key, version: String(manifest.version ?? '0'), hash: hashOf(dir, ignore), issued: new Date().toISOString().slice(0, 10), issuer: ISSUER }
  if (ignore.length) c.ignore = ignore
  c.sig = sign('sha256', Buffer.from(body(c), 'utf8'), { key: privateKey(), dsaEncoding: 'ieee-p1363' }).toString('base64')
  writeFileSync(join(dir, CERT), JSON.stringify(c, null, 1) + '\n')
  return c
}

/// Prüfung wie der Server: { ok, reason, cert }
export function verifyPlugin(key, pub = publicKey()) {
  const dir = join(PLUGINS, key)
  const cp = join(dir, CERT)
  if (!existsSync(cp)) return { ok: false, reason: 'kein Zertifikat' }
  let c
  try { c = JSON.parse(readFileSync(cp, 'utf8')) } catch (e) { return { ok: false, reason: 'Zertifikat nicht lesbar: ' + e.message } }
  if (c.key !== key) return { ok: false, reason: `Zertifikat für ${c.key}`, cert: c }
  const manifest = JSON.parse(readFileSync(join(dir, 'plugin.json'), 'utf8'))
  if (String(manifest.version ?? '0') !== c.version) return { ok: false, reason: `Zertifikat für Fassung ${c.version}, Manifest ${manifest.version}`, cert: c }
  if (!verify('sha256', Buffer.from(body(c), 'utf8'), { key: pub, dsaEncoding: 'ieee-p1363' }, Buffer.from(c.sig ?? '', 'base64'))) return { ok: false, reason: 'Signatur passt nicht', cert: c }
  if (hashOf(dir, c.ignore ?? []) !== c.hash) return { ok: false, reason: 'Dateien verändert', cert: c }
  return { ok: true, cert: c }
}

const certified = () => readdirSync(PLUGINS).filter(k => existsSync(join(PLUGINS, k, CERT)))

function main(argv) {
  const [cmd, ...rest] = argv
  const ignore = []; const keys = []
  for (let i = 0; i < rest.length; i++) { if (rest[i] === '--ignore') ignore.push(rest[++i]); else keys.push(rest[i]) }
  if (cmd === 'keys') {
    const p = process.env.JOURNALI_PLUGIN_SIGNING_KEY || join(homedir(), '.journali', 'plugin-signing.pem')
    if (existsSync(p)) throw new Error(`${p} gibt es schon`)
    const { privateKey: priv, publicKey: pub } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
    mkdirSync(dirname(p), { recursive: true })
    writeFileSync(p, priv.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 })
    console.log(`privat: ${p}\nöffentlich (DefaultKey in PluginSeal.cs, JOURNALI_PLUGIN_KEY):\n${pub.export({ type: 'spki', format: 'der' }).toString('base64')}`)
    return 0
  }
  if (cmd === 'sign') {
    for (const k of keys.length ? keys : certified()) { const c = signPlugin(k, ignore); console.log(`${k} ${c.version} ${c.hash.slice(0, 12)}… signiert`) }
    return 0
  }
  if (cmd === 'verify') {
    let broken = 0
    for (const k of keys.length ? keys : certified()) { const r = verifyPlugin(k); console.log(`${r.ok ? '✓' : '✗'} ${k}${r.cert ? ' ' + r.cert.version : ''}${r.ok ? '' : ' — ' + r.reason}`); if (!r.ok) broken++ }
    return broken ? 1 : 0
  }
  if (cmd === 'catalog') {
    const target = keys[0]; if (!target) throw new Error('Ziel fehlt')
    mkdirSync(target, { recursive: true })
    const list = []
    for (const k of certified()) {
      const r = verifyPlugin(k); if (!r.ok) { console.log(`✗ ${k} — ${r.reason}, nicht im Katalog`); continue }
      const m = JSON.parse(readFileSync(join(PLUGINS, k, 'plugin.json'), 'utf8'))
      const zip = `${k}-${r.cert.version}.zip`
      // Zip mit dem Verzeichnis als Wurzel — der Server prüft das Siegel im entpackten Verzeichnis
      const entries = [...files(join(PLUGINS, k), r.cert.ignore ?? []), CERT].map(f => `${k}/${f}`)
      execFileSync('tar', ['-a', '-c', '-f', join(target, zip), '-C', PLUGINS, ...entries])
      list.push({ key: k, version: r.cert.version, label: m.label, description: m.description, kind: m.kind, runs: m.runs, requires: m.requires ?? [], issued: r.cert.issued, file: zip })
      console.log(`✓ ${k} ${r.cert.version} → ${zip}`)
    }
    writeFileSync(join(target, 'catalog.json'), JSON.stringify({ issuer: ISSUER, updated: new Date().toISOString().slice(0, 10), plugins: list }, null, 1) + '\n')
    return 0
  }
  console.log('keys | sign <key…> [--ignore pfad] | verify [key…] | catalog <ziel>')
  return 2
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exit(main(process.argv.slice(2))) } catch (e) { console.error(e.message); process.exit(1) }
}
