// Der Klassendialog als Fenster über der Oberfläche: Band und Kontextmenü öffnen ihn, ohne die Seite zu verlassen.
import { createApp, h } from 'vue'
import { t } from 'journali'
import Klasse from './Klasse.vue'

/// Öffnet den Dialog für einen Knoten. `onDone(code)` läuft, nachdem eine Klasse zugewiesen wurde. Liefert die Funktion zum Schliessen.
export function oeffneKlasse(nodeId, { onDone = null } = {}) {
  const overlay = document.createElement('div')
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);display:grid;place-items:center;z-index:40'
  document.body.append(overlay)
  let zu = false
  const app = createApp({ render: () => h(Klasse, { node: nodeId, modal: true, onClose: schliessen, onDone: code => onDone?.(code) }) })
  app.config.globalProperties.$t = t
  function schliessen() { if (zu) return; zu = true; app.unmount(); overlay.remove() }
  overlay.addEventListener('mousedown', e => { if (e.target === overlay) schliessen() })
  app.mount(overlay)
  return schliessen
}
