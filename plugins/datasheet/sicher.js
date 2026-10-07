// Werte im Datenblatt (07.10.2026): Text wird maskiert, HTML-Werte bereinigt — ein Wert darf im Datenblatt nichts ausführen. Im Browser mit
// DOMParser (erlaubte Tags und Attribute, wie web/src/html-sicher.js), im Job ohne DOM über Ausdrücke: Skript-, Rahmen- und Objekt-Tags samt Inhalt,
// Ereignisattribute (on…) und javascript:-Adressen fallen weg. Der Server weist solches HTML schon beim Speichern ab (HtmlPruefung.cs).
const TAGS = new Set(['p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'sub', 'sup', 'small', 'mark', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'a', 'span', 'div', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'hr', 'code', 'pre', 'img', 'figure', 'figcaption'])
const WEG = 'script|style|iframe|frame|frameset|object|embed|applet|template|svg|math|noscript|form|input|button|textarea|select|link|meta|base|audio|video|canvas'
const ATTR = { a: ['href', 'title', 'target', 'rel'], img: ['src', 'alt', 'title', 'width', 'height'], td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan'] }
const SICHERE_ADRESSE = /^(https?:|mailto:|tel:|\/|#|\.{0,2}\/|data:image\/(png|jpe?g|gif|webp);)/i

export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function sicheresHtml(html) {
  if (html == null || html === '') return ''
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, 'text/html')
    const reinige = knoten => {
      for (const k of [...knoten.childNodes]) {
        if (k.nodeType === 3) continue
        if (k.nodeType !== 1) { k.remove(); continue }
        const tag = k.tagName.toLowerCase()
        if (new RegExp(`^(${WEG})$`).test(tag)) { k.remove(); continue }
        reinige(k)
        if (!TAGS.has(tag)) { k.replaceWith(...k.childNodes); continue }
        for (const a of [...k.attributes]) {
          const n = a.name.toLowerCase()
          if (!(n === 'class' || (ATTR[tag] ?? []).includes(n)) || ((n === 'href' || n === 'src') && !SICHERE_ADRESSE.test(a.value.trim()))) k.removeAttribute(a.name)
        }
      }
    }
    reinige(doc.body)
    return doc.body.innerHTML
  }
  // ohne DOM (Job, render.js)
  return String(html)
    .replace(new RegExp(`<\\s*(${WEG})\\b[\\s\\S]*?<\\s*/\\s*\\1\\s*>`, 'gi'), '')
    .replace(new RegExp(`<\\s*/?\\s*(${WEG})\\b[^>]*>`, 'gi'), '')
    .replace(/\s(on[a-z]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')?\s*(javascript|vbscript|data:text\/html)[^"'\s>]*\2?/gi, '$1="#"')
}
