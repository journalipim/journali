// Die Sätze des Beraters in der Sprache des Besuchers (docs/pflegestruktur.md 44: der Berater setzt die Antwort zusammen). Vorher standen sie im
// Chat-Fenster; das Fenster zeigt jetzt nur noch an — Knöpfe und Überschriften bleiben dort.

const liste = (l, und) => l.length < 2 ? l.join('') : `${l.slice(0, -1).join(', ')} ${und} ${l.at(-1)}`

export const TEXTE = {
  de: {
    treffer: n => n === 1 ? '1 Produkt passt.' : `${n} Produkte passen.`,
    keine: 'Kein Produkt passt dazu.',
    aehnlich: n => n === 1 ? '1 ähnliches Produkt.' : `${n} ähnliche Produkte.`,
    unbekannt: w => `„${w.join('“, „')}“ steht in keinem Produkt.`,
    abschluss: l => l.length ? `Passt eines davon? Oder soll ich nach ${liste(l, 'oder')} eingrenzen?` : 'Passt eines davon?',
    gelesen: (von, zu) => `„${von}“ habe ich als „${zu}“ gelesen.`,
    ueber: n => `Zu „${n}“:`,
    ueberNichts: 'Dazu steht in den Angaben nichts.',
    alleAngaben: 'Alle Angaben zu diesem Produkt?',
    trefferVorn: (n, hart, weich) => hart ? `${n === 1 ? '1 Produkt passt' : `${n} Produkte passen`} zu „${hart}“; zuerst, was zu „${weich}“ passt.`
      : `${n === 1 ? '1 Produkt passt' : `${n} Produkte passen`} zu „${weich}“, die passendsten zuerst.`,
    trefferZu: (n, w) => n === 1 ? `1 Produkt passt zu „${w}“.` : `${n} Produkte passen zu „${w}“.`,
    statt: w => `Stattdessen nach „${w}“ suchen?`,
    uebernommen: l => `${liste(l, 'und')} habe ich übernommen.`,
    abgelehnt: n => `${n} zeige ich nicht mehr vorn.`,
    neu: 'Neue Suche',
    zuDen: (w, n) => n === 1 ? `Zu „${w}“ steht beim Produkt:` : `Zu „${w}“ steht bei den ${n} Produkten:`,
    zuDenNichts: w => `Zu „${w}“ steht bei diesen Produkten nichts in den Angaben.`,
    gruss: 'Hallo. Wonach suchen Sie?',
    dank: 'Gern geschehen.',
    tschuess: 'Auf Wiedersehen.',
  },
  en: {
    treffer: n => n === 1 ? '1 product matches.' : `${n} products match.`,
    keine: 'No product matches.',
    aehnlich: n => n === 1 ? '1 similar product.' : `${n} similar products.`,
    unbekannt: w => `"${w.join('", "')}" does not appear in any product.`,
    abschluss: l => l.length ? `Does one of these fit? Or shall I narrow it down by ${liste(l, 'or')}?` : 'Does one of these fit?',
    gelesen: (von, zu) => `I read "${von}" as "${zu}".`,
    ueber: n => `About "${n}":`,
    ueberNichts: 'The product details say nothing about this.',
    alleAngaben: 'See all details of this product?',
    trefferVorn: (n, hart, weich) => hart ? `${n === 1 ? '1 product matches' : `${n} products match`} "${hart}"; those matching "${weich}" first.`
      : `${n === 1 ? '1 product matches' : `${n} products match`} "${weich}", best matches first.`,
    trefferZu: (n, w) => n === 1 ? `1 product matches "${w}".` : `${n} products match "${w}".`,
    statt: w => `Search for "${w}" instead?`,
    uebernommen: l => `I kept ${liste(l, 'and')}.`,
    abgelehnt: n => `I no longer show ${n} first.`,
    neu: 'New search',
    zuDen: (w, n) => n === 1 ? `On "${w}", the product details say:` : `On "${w}", the details of the ${n} products say:`,
    zuDenNichts: w => `The details of these products say nothing about "${w}".`,
    gruss: 'Hello. What are you looking for?',
    dank: 'You are welcome.',
    tschuess: 'Goodbye.',
  },
}

export const texte = locale => String(locale ?? '').toLowerCase().startsWith('de') ? TEXTE.de : TEXTE.en

/// Eine Angabe als Text: „Farbe: Rot“, „Leistung: bis 900 W“, „leicht“
export function angabeText(a, locale) {
  const de = String(locale ?? '').toLowerCase().startsWith('de')
  if (a.op === 'low' || a.op === 'high') return a.valueLabel ?? a.value
  const vor = a.op === 'le' ? (de ? 'bis ' : 'up to ') : a.op === 'ge' ? (de ? 'ab ' : 'from ') : ''
  return `${a.label ?? a.attribute}: ${vor}${a.valueLabel ?? a.value}`
}
