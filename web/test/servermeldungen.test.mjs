// Was der Server dem Anwender sagt (Taloan, 23.09.2026: „wer sind die Menschen, mit denen wir hier reden? Wenn du den
// Teller nicht leer gegessen hast, darfst du abends nicht fernsehen?“). Eine Meldung sagt, **was ist** — nicht, was
// der Anwender zu tun hat: kein „bitte“, kein „erst …“, kein Ratschlag. Und höchstens ein Satz; wer mehr erklären
// will, schreibt es in die Dokumentation.
// Geprüft wird, was wirklich in der Oberfläche landet: Bad("…") und error = "…" aus Journali.Server.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const server = new URL('../../Journali.Server/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const dateien = fs.readdirSync(server).filter(f => f.endsWith('.cs')).map(f => path.join(server, f))

/// Aufforderungen und Ratschläge — beides gehört nicht in eine Fehlermeldung
const BEVORMUNDUNG = /(^|[\s„])(bitte|erst)\s|sollte[nst]?\s|am besten|muss man|müssen Sie|lassen Sie|kannst du|darfst du/i
/// Abkürzungen, die mitten im Satz stehen — sie beenden ihn nicht
const ABK = /\b(z\. ?B|u\. ?a|d\. ?h|o\. ?ä|ggf|bzw|evtl|usw|etc|vgl|Nr|Abs|Art|ca)\./gi

/// Alle Meldungstexte einer Datei — Bad("…"), Bad($"…"), error = "…"
function meldungen(quelle) {
  const out = []
  for (const m of quelle.matchAll(/(?:Bad|Outcome\.Bad)\(\$?"((?:[^"\\]|\\.)*)"/g)) out.push(m[1])
  for (const m of quelle.matchAll(/error = \$?"((?:[^"\\]|\\.)*)"/g)) out.push(m[1])
  return out
}

test('keine Meldung sagt dem Anwender, was er zu tun hat', () => {
  const misses = []
  for (const f of dateien) {
    for (const t of meldungen(fs.readFileSync(f, 'utf8')))
      if (BEVORMUNDUNG.test(t)) misses.push(`${path.basename(f)}: „${t.slice(0, 70)}“`)
  }
  assert.deepEqual(misses, [], 'Aufforderung in einer Meldung — sie sagt, was ist, nicht was zu tun wäre')
})

test('eine Meldung ist höchstens ein Satz', () => {
  const misses = []
  for (const f of dateien) {
    for (const t of meldungen(fs.readFileSync(f, 'utf8'))) {
      // Platzhalter und Abkürzungen raus, dann zählt nur ein Satzende vor einem neuen Satz
      const rein = t.replace(/\{[^}]*\}/g, '#').replace(ABK, '#').replace(/[a-z0-9_]+\. ?,/gi, '#')
      const sätze = rein.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ„])/).filter(x => x.trim())
      if (sätze.length > 1) misses.push(`${path.basename(f)}: „${t.slice(0, 70)}“`)
    }
  }
  assert.deepEqual(misses, [], 'zwei Sätze in einer Meldung — was erklärt werden muss, steht in der Dokumentation')
})

test('und sie ist nicht länger als die Grenze', () => {
  const GRENZE = 140
  const misses = []
  for (const f of dateien) {
    for (const t of meldungen(fs.readFileSync(f, 'utf8')))
      if (t.replace(/\{[^}]*\}/g, '#').length > GRENZE) misses.push(`${path.basename(f)}: „${t.slice(0, 70)}…“`)
  }
  assert.deepEqual(misses, [], `Meldung länger als ${GRENZE} Zeichen`)
})
