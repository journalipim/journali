// Regel 5: dieses Repo wird veröffentlicht, der Lizenzserver bleibt privat. Was dort liegt — der private
// Ausstellerschlüssel, die Zugänge, die Shop-Varianten, die Verwaltung —, darf hier nicht auftauchen. Dazu die
// eigenen Adressen: ein Hostname aus dem Heimnetz oder eine private IP sagt einem Leser nichts und gehört
// niemandem ausser dem Betreiber; ein Beispiel heisst `localhost`, `<host>` oder `example.com`.
// Geprüft werden alle von Git verfolgten Dateien; was nicht verfolgt ist, wird auch nicht veröffentlicht.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const wurzel = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
// Diese Datei nennt, wonach sie sucht — sonst fände sie sich selbst
const SELBST = 'web/test/kein-lizenzserver.test.mjs'

// Nur Text lesen: Bilder, Schriften und gebaute Pakete enthalten kein Geheimnis, brauchen aber Speicher
const binaer = /\.(png|jpe?g|gif|webp|ico|svg|woff2?|ttf|eot|pdf|zip|xlsx?|exe|dll|pem|pfx)$/i
const dateien = execFileSync('git', ['ls-files', '-z'], { cwd: wurzel, encoding: 'utf8' })
  .split('\0').filter(p => p && p !== SELBST && !binaer.test(p))

const text = (p) => { try { return readFileSync(join(wurzel, p), 'utf8') } catch { return '' } }
// Einmal lesen, mehrfach prüfen — sonst dauert der Lauf unnötig lang
const bestand = dateien.map(p => [p, text(p)])

test('kein privater Schlüssel im Repo', () => {
  const treffer = bestand.filter(([, s]) => s.includes('PRIVATE KEY')).map(([p]) => p)
  assert.deepEqual(treffer, [], 'ein privater Schlüssel gehört nie in ein Repo, das veröffentlicht wird')
})

test('keine Datei des Lizenzservers wird hier genannt', () => {
  // Die Geheimnisse des Lizenzservers heissen dort so; steht einer der Namen hier, ist etwas herübergewandert
  const geheim = ['aussteller.pem', 'lizenz.env', 'strato.ppk']
  const treffer = bestand.flatMap(([p, s]) => geheim.filter(g => s.includes(g)).map(g => `${p}: ${g}`))
  assert.deepEqual(treffer, [], 'Dateien aus geheim/ des Lizenz-Repos gehören nicht hierher')
})

test('der eingebaute Ausstellerschlüssel ist ein öffentlicher', () => {
  const s = text('Journali.Core/Licensing/Vertrag.cs')
  assert.ok(s.length > 0, 'Vertrag.cs nicht gefunden')
  assert.ok(!s.includes('PRIVATE KEY') && !/EncryptedPrivateKey|ImportECPrivateKey|ImportPkcs8PrivateKey/.test(s),
    'journali prüft Signaturen, es stellt keine aus — hier steht nur der öffentliche Schlüssel')
})

test('keine private IP im Repo', () => {
  // RFC 1918: 192.168.x und 172.16–31.x — Netze, die nur der Betreiber kennt. 10.x/8 bleibt aussen vor: es
  // trifft jede Versions- und Abschnittsnummer mit vier Ebenen („Npgsql 10.0.3“, „Section 10.4.6.2“)
  const privat = /\b(?:192\.168|172\.(?:1[6-9]|2\d|3[01]))(?:\.\d{1,3}){2}(?![\d.])/
  const treffer = bestand.filter(([, s]) => privat.test(s)).map(([p]) => p)
  assert.deepEqual(treffer, [], 'eine private IP gehört nicht in ein Repo, das veröffentlicht wird')
})

// Seit die Lizenzadresse eine eigene Domain hat (25.09.2026), laesst sich das eine vom anderen unterscheiden:
// der Name des privaten Rechners darf nirgends stehen, die Lizenzadresse genau an der einen Stelle im Quelltext.
test('kein Name eines privaten Rechners im Repo', () => {
  const treffer = bestand.filter(([, s]) => /rossibox/i.test(s)).map(([p]) => p)
  assert.deepEqual(treffer, [], 'der eigene Rechner gehoert nicht in ein Repo, das veroeffentlicht wird')
})

test('die Adresse des Lizenzservers steht nur an einer Stelle im Quelltext', () => {
  const quelltext = /\.(cs|js|mjs|vue|json|ya?ml)$/i
  const treffer = bestand.filter(([p, s]) => quelltext.test(p) && /lizenz\.journali\.de/i.test(s)).map(([p]) => p)
  assert.deepEqual(treffer, ['Journali.Core/Licensing/Vertrag.cs'],
    'die Adresse gehoert zum eingebauten Schluessel — zweimal geschrieben heisst einmal vergessen')
})

test('Regel 5 steht in CLAUDE.md', () => {
  const s = text('CLAUDE.md')
  assert.match(s, /## Regel 5: Der Lizenzserver bleibt draussen/,
    'die Trennung beider Repos ist eine Regel, kein Gedächtnis')
})
