// Ein Kontextmenü für die ganze Oberfläche: wer eines braucht, ruft
// menu.open(event, items). Einträge: { label, icon?, key?, action, disabled?, danger?, end? }, { sep: true }
// oder ein Untermenü { label, icon?, items: [...] } (Plugins je Plugin).
// end: { icon, title, action } — ein Zeichen am Zeilenende (✕ zum Entfernen), das für sich anklickbar ist. Liefert action eine neue Liste von Einträgen,
// bleibt das Menü offen und zeigt sie; sonst schliesst es.
import { reactive } from 'vue'

export const menu = reactive({
  visible: false,
  x: 0, y: 0,
  items: [],

  open(e, items) {
    e.preventDefault()
    this.items = items.filter(Boolean)
    this.x = e.clientX; this.y = e.clientY
    this.visible = true
  },
  close() { this.visible = false },
})
