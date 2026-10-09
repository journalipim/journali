// Das Grundwissen des Beraters (09.10.2026): was jeder Chat beantwortet, ohne KI und ohne Daten des Shops — Gruss, Dank und Abschied, wer
// er ist, was er kann, wie es ihm geht, eine Bestätigung; Fragen zum Shop statt zu Produkten (Versand, Bezahlung, Rückgabe). Für alles
// andere gilt die Rückführung: der Berater nennt, wobei er hilft (die Gruppen des Sortiments), und dass er zu anderen Fragen keine
// Auskunft gibt. Die Sätze stehen in texte.mjs unter demselben Schlüssel. Ein Eintrag gilt nur, wenn die Eingabe sonst nichts enthält.
import { woerter } from './woerter.mjs'

const ENDE = '(?![\\p{L}])'
const re = s => new RegExp('^(' + s + ')' + ENDE, 'iu')

/// sortiment: nach dem Satz stehen die Gruppen des Sortiments zum Anklicken
export const WISSEN = [
  { key: 'gruss', muster: re('hallo|hi|hey|moin|servus|guten (morgen|tag|abend)|grüß gott|gruess gott|hello|good (morning|afternoon|evening)') },
  { key: 'dank', muster: re('danke( schön| sehr)?|dankeschön|vielen dank|thanks|thank you|thx') },
  { key: 'tschuess', muster: re('tschüss|tschuess|tschau|ciao|auf wiedersehen|bye|goodbye') },
  { key: 'wer', muster: re('(wer|was) bist du|(wer|was) sind sie|(bist du|sind sie) (ein |eine )?(mensch|ki|bot|roboter|computer|programm|echt)|who are you|what are you|are you (a |an )?(human|bot|robot|ai|real|person)') },
  { key: 'koennen', sortiment: true, muster: re('was kannst du|was können sie|was koennen sie|wie funktioniert (das|es|der berater)|wie geht das|hilfe|help|what can you do|how does (this|it) work') },
  { key: 'befinden', muster: re('wie geht(\'s| es)( dir| ihnen)?|wie gehts|how are you') },
  { key: 'ok', muster: re('ok|okay|alles klar|verstanden|super|prima|toll|gut|cool|fine|great') },
]

/// Wörter, die nach dem Shop fragen, nicht nach einem Produkt
export const SERVICE = new Set(['versand', 'versandkosten', 'versenden', 'lieferung', 'lieferzeit', 'lieferkosten', 'liefern', 'liefert', 'zustellung',
  'rücksendung', 'ruecksendung', 'rückgabe', 'rueckgabe', 'retoure', 'umtausch', 'umtauschen', 'widerruf', 'bezahlen', 'bezahlung', 'zahlung',
  'zahlungsarten', 'rechnung', 'öffnungszeiten', 'oeffnungszeiten', 'geöffnet', 'geoeffnet', 'filiale', 'adresse', 'telefon', 'telefonnummer', 'kontakt',
  'hotline', 'gutschein', 'rabatt', 'bestellung', 'bestellen', 'shipping', 'delivery', 'deliver', 'return', 'returns', 'refund', 'exchange', 'payment',
  'pay', 'invoice', 'opening', 'hours', 'contact', 'phone', 'voucher', 'discount', 'order'])

/// Der Eintrag des Grundwissens zu einer Eingabe, oder null
export function grundwissen(eingabe) {
  const t = String(eingabe ?? '').trim()
  for (const w of WISSEN) {
    const m = w.muster.exec(t)
    if (m && !woerter(t.slice(m[0].length)).length) return w
  }
  return null
}

/// Fragt die Eingabe nach dem Shop (und nennt keine Art)?
export const fragtShop = (ws, istArt) => ws.some(w => SERVICE.has(w)) && !ws.some(istArt)
