// Eine Zelle, die von aussen geändert wurde, blitzt kurz auf (26.09.2026): die Knotenansicht lädt bei einem neuen
// Journalstand nach und vergleicht die Eintragsnummern je Zelle — was gestiegen ist, bekommt für zwei Sekunden die
// Klasse „frisch“. Eigene Änderungen blitzen nicht; sie laden ohne diesen Vergleich nach.
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'

/// Dieselbe Rechnung wie in NodeView: welche Schlüssel sind neuer als vorher?
function neuere(vorher, nachher) {
  const neu = []
  for (const [k, nummer] of nachher) if ((vorher.get(k) ?? 0) < nummer) neu.push(k)
  return neu
}

test('nur was eine höhere Eintragsnummer hat, blitzt', () => {
  const vorher = new Map([['name|de|', 100], ['sku||', 90]])
  const nachher = new Map([['name|de|', 125135], ['sku||', 90], ['descr|de|', 125136]])
  assert.deepEqual(neuere(vorher, nachher).sort(), ['descr|de|', 'name|de|'], 'geänderte und neue Zellen')
})

test('ohne Änderung blitzt nichts', () => {
  const m = new Map([['name|de|', 100]])
  assert.deepEqual(neuere(m, new Map(m)), [])
})
