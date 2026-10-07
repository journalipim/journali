// HTML aus Werten bereinigen, bevor es in die Seite kommt (07.10.2026): erlaubt sind die Tags und Attribute eines Textes (Absätze, Listen,
// Tabellen, Hervorhebung, Links, Bilder); Skripte, Ereignisse (on…), Rahmen, Formulare, eingebettete Objekte und javascript:-Adressen fallen weg.
// Gelesen wird mit DOMParser — dort läuft nichts, auch kein onerror. Der Server weist solches HTML schon beim Speichern ab (HtmlPruefung.cs);
// das hier schützt vor Werten, die vorher hineinkamen.
const TAGS = new Set(['p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'sub', 'sup', 'small', 'mark', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'a', 'span', 'div', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'hr', 'code', 'pre', 'img', 'figure', 'figcaption'])
// Was mitsamt Inhalt wegfällt — der Text darin ist kein Text des Wertes
const WEG = new Set(['script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'template', 'svg', 'math', 'noscript', 'form',
  'input', 'button', 'textarea', 'select', 'option', 'link', 'meta', 'base', 'audio', 'video', 'source', 'track', 'canvas', 'dialog'])
const ATTR = { a: ['href', 'title', 'target', 'rel'], img: ['src', 'alt', 'title', 'width', 'height'], td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan'] }
const IMMER = ['class', 'lang', 'dir']
const SICHERE_ADRESSE = /^(https?:|mailto:|tel:|\/|#|\.{0,2}\/|data:image\/(png|jpe?g|gif|webp);)/i

export function sicheresHtml(html) {
  if (html == null || html === '') return ''
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, 'text/html')
  reinige(doc.body)
  return doc.body.innerHTML
}

function reinige(knoten) {
  for (const k of [...knoten.childNodes]) {
    if (k.nodeType === 3) continue                                   // Text
    if (k.nodeType !== 1) { k.remove(); continue }                   // Kommentare und anderes
    const tag = k.tagName.toLowerCase()
    if (WEG.has(tag)) { k.remove(); continue }
    reinige(k)
    if (!TAGS.has(tag)) { k.replaceWith(...k.childNodes); continue }  // unbekanntes Tag: der Inhalt bleibt
    for (const a of [...k.attributes]) {
      const n = a.name.toLowerCase()
      const erlaubt = IMMER.includes(n) || (ATTR[tag] ?? []).includes(n)
      if (!erlaubt || ((n === 'href' || n === 'src') && !SICHERE_ADRESSE.test(a.value.trim()))) k.removeAttribute(a.name)
    }
    if (tag === 'a' && k.getAttribute('target')) k.setAttribute('rel', 'noopener noreferrer')
  }
}
