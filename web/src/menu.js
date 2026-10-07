// Ein Kontextmenü für die ganze Oberfläche: wer eines braucht, ruft
// menu.open(event, items). Einträge: { label, icon?, key?, action, disabled?, danger?, end? }, { sep: true }
// oder ein Untermenü { label, icon?, items: [...] } (Plugins je Plugin). demo: 'aus' — der Eintrag fällt in der Demo weg (07.10.2026).
// end: { icon, title, action } — ein Zeichen am Zeilenende (✕ zum Entfernen), das für sich anklickbar ist. Liefert action eine neue Liste von Einträgen,
// bleibt das Menü offen und zeigt sie; sonst schliesst es.
import { reactive } from 'vue'
import { store } from './store.js'

/// Demo: Einträge mit demo: 'aus' weg, leere Untermenüs auch; Trennlinien am Rand oder doppelt ebenso
export function ohneDemo(items) {
  if (!store.demo) return items
  const aus = items.filter(Boolean).filter(x => x.demo !== 'aus').map(x => x.items ? { ...x, items: ohneDemo(x.items) } : x).filter(x => !x.items || x.items.length)
  return aus.filter((x, i) => !x.sep || (i > 0 && i < aus.length - 1 && !aus[i + 1].sep))
}

export const menu = reactive({
  visible: false,
  x: 0, y: 0,
  items: [],

  open(e, items) {
    e.preventDefault()
    this.items = ohneDemo(items.filter(Boolean))
    this.x = e.clientX; this.y = e.clientY
    this.visible = true
  },
  close() { this.visible = false },
})
