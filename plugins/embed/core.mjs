// Plugin embed — Kern ohne Modell und ohne Node-Abhängigkeiten (27.09.2026, pflegestruktur 35).
// Hier steht, wie ein Text für das Modell vorbereitet wird, wie Posten gestapelt werden und wie der Server mit dem
// vorgehaltenen Prozess spricht (JSON je Zeile). Das Modell selbst lädt model.mjs.

/// Die e5-Modelle verlangen eine Vorsilbe: eine Frage ist „query: …“, ein Abschnitt „passage: …“. Andere Modelle
/// bekommen den Text, wie er ist.
export function prepare(text, kind, model) {
  const s = trim(text)
  if (!/e5/i.test(String(model ?? ''))) return s
  return (kind === 'query' ? 'query: ' : 'passage: ') + s
}

/// Ein kleines Modell nimmt etwa 512 Wortstücke — ein längerer Abschnitt wird abgeschnitten, nicht verworfen.
export function trim(text, max = 2000) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim()
  return s.length > max ? s.slice(0, max) : s
}

/// Posten in Stapel für das Modell: mehrere Texte in einem Aufruf sind schneller als einer je Aufruf.
export function batches(list, n = 16) {
  const out = []
  for (let i = 0; i < list.length; i += Math.max(1, n)) out.push(list.slice(i, i + Math.max(1, n)))
  return out
}

/// Eine Anfrage des Servers: { text, kind } — sonst null
export function parseLine(line) {
  try {
    const o = JSON.parse(String(line ?? ''))
    if (!o || typeof o.text !== 'string') return null
    return { text: o.text, kind: o.kind === 'passage' ? 'passage' : 'query' }
  } catch { return null }
}

/// Die Antwort an den Server, eine Zeile: Modell, Dimension, Vektor — oder der Fehler
export const replyLine = (model, vector) => JSON.stringify({ model, dims: vector.length, vector })
export const errorLine = message => JSON.stringify({ error: String(message ?? 'Fehler') })

/// Zahlen mit wenigen Nachkommastellen: der Vektor geht als JSON über die Leitung, sieben Stellen reichen dem Abstand.
export const compact = vector => Array.from(vector, x => Math.round(x * 1e7) / 1e7)
