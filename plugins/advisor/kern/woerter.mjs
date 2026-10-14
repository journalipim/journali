// Wörter einer Eingabe (docs/pflegestruktur.md 42/44): zerlegen, Füllwörter weg, gebeugte Formen, Tippfehler. Dieselben Regeln wie im Server
// (AdvisorApi.Woerter, Formen) — der Server braucht sie zum Ordnen, der Kern zum Verstehen.

const WORT = /\d+(?:[.,]\d+)?|\p{L}[\p{L}\p{N}-]*/gu
const BUCHSTABE_ZIFFER = /[\p{L}\p{N}]/u

export const FUELLWOERTER = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer', 'und', 'oder', 'mit', 'für', 'fuer', 'von', 'zu', 'zum', 'zur',
  'im', 'in', 'an', 'am', 'auf', 'aus', 'bei', 'ist', 'sind', 'ich', 'wir', 'sie', 'es', 'suche', 'brauche', 'welche', 'welcher', 'welches', 'was', 'wie',
  'gibt', 'habt', 'haben', 'hat', 'nicht', 'kein', 'keine', 'the', 'a', 'an', 'and', 'or', 'with', 'for', 'of', 'to', 'in', 'on', 'is', 'are', 'i', 'we',
  'need', 'looking', 'which', 'what', 'do', 'you', 'have', 'any', 'some', 'bis', 'ab', 'unter', 'über', 'ueber', 'mehr', 'als', 'auch', 'noch', 'mir', 'mich',
  // Fragen nach einem Problem: „mein zelt ist nicht mehr wasserdicht“ — wem es gehört und wie gefragt wird, sucht kein Produkt
  'mein', 'meine', 'meinen', 'meinem', 'meiner', 'meins', 'dein', 'deine', 'unser', 'unsere', 'unseren', 'euer', 'eure', 'sein', 'seine', 'ihr', 'ihre',
  'bin', 'bist', 'war', 'waren', 'wird', 'werden', 'wurde', 'habe', 'hab', 'hast', 'geht', 'gehen', 'kann', 'können', 'koennen', 'soll', 'sollte', 'muss',
  'warum', 'wieso', 'weshalb', 'wo', 'wann', 'wer', 'so', 'sehr', 'schon', 'immer', 'wieder', 'jetzt', 'mal', 'bitte', 'danke', 'hallo', 'man', 'einfach',
  'my', 'our', 'your', 'it', 'its', 'not', 'no', 'anymore', 'why', 'how', 'can', 'does', 'did', 'was', 'were', 'has', 'had', 'me', 'please',
  // Antworten auf eine Rückfrage (14.10.2026): „ja, mit trinksystem“, „eins, das schnell aufgebaut ist“ — sie suchen nichts
  'ja', 'jo', 'gern', 'gerne', 'ok', 'okay', 'eins', 'eines', 'yes', 'yeah', 'sure', 'one',
])

/// Die Suchwörter einer Eingabe: klein, ohne Füllwörter, Zahlen bleiben
export function woerter(q) {
  const aus = []
  for (const m of String(q ?? '').toLowerCase().matchAll(WORT)) {
    const w = m[0].replace(/^-+|-+$/g, '')
    if (((w.length >= 2 && !FUELLWOERTER.has(w)) || /^\d/.test(w)) && !aus.includes(w)) aus.push(w)
  }
  return aus
}

/// Das Wort und seine Grundformen ohne die häufigsten Endungen (-e, -n, -en, -er, -s) — nur, wenn mindestens vier Zeichen bleiben
export function formen(w) {
  const aus = [w]
  for (const e of ['en', 'er', 'e', 'n', 's']) if (w.endsWith(e) && w.length - e.length >= 4) aus.push(w.slice(0, -e.length))
  return [...new Set(aus)]
}

/// Zwei Wörter sind dieselben, wenn sie eine Grundform teilen („zelte“ und „zelt“)
export const gleichesWort = (a, b) => a === b || formen(a).some(f => formen(b).includes(f))

/// Editierabstand (Einfügen, Löschen, Ersetzen, zwei Nachbarn vertauscht); über max hinaus nur „zu weit“
export function abstand(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const k = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + k)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  return d[a.length][b.length]
}

/// Ein Tippfehler: das Wort aus den Produktnamen, das eine Änderung entfernt liegt (ab acht Zeichen zwei) — „zeit“ → „zelt“. Nur, wenn genau eines
/// am nächsten liegt; ein Wort, das selbst (oder gebeugt) in einem Namen steht, ist kein Tippfehler
export function korrektur(w, namen) {
  if (w.length < 4 || /^\d+$/.test(w) || formen(w).some(f => namen.has(f))) return null
  const grenze = w.length >= 8 ? 2 : 1
  const nah = []
  for (const n of namen) { const d = abstand(w, n, grenze); if (d <= grenze) nah.push([n, d]) }
  if (!nah.length) return null
  const min = Math.min(...nah.map(x => x[1]))
  const beste = nah.filter(x => x[1] === min)
  return beste.length === 1 ? beste[0][0] : null
}

/// Wo `was` als ganzes Wort (oder Wortfolge) in `text` steht — Gross und klein egal; -1, wenn nicht
export function ganz(text, was) {
  if (!was) return -1
  const t = text.toLowerCase(), w = was.toLowerCase()
  for (let i = t.indexOf(w); i >= 0; i = t.indexOf(w, i + 1)) {
    const vorn = i === 0 || !BUCHSTABE_ZIFFER.test(t[i - 1])
    const hinten = i + w.length >= t.length || !BUCHSTABE_ZIFFER.test(t[i + w.length])
    if (vorn && hinten) return i
  }
  return -1
}

/// Ein Stück aus dem Text nehmen (ein Leerzeichen bleibt, damit Wörter nicht zusammenwachsen)
export const weg = (text, start, laenge) => text.slice(0, start) + ' ' + text.slice(start + laenge)
