// Breiten der Fenster je Ansicht, gemerkt im localStorage.
import { reactive, ref, watch } from 'vue'

export function paneWidth(key, fallback) {
  const k = 'journali.pane.' + key
  let v = fallback
  try { const s = localStorage.getItem(k); if (s) v = Number(s) || fallback } catch {}
  const r = ref(v)
  watch(r, n => { try { localStorage.setItem(k, String(n)) } catch {} })
  return r
}

/// Spaltenbreiten einer Liste, gemerkt im localStorage: ein reaktives Objekt { spalte: px } und `zieh(spalte, event)`
/// für den Griff im Spaltenkopf. Die Vorgaben stehen beim Aufruf; was nicht gezogen wurde, bleibt dabei.
export function columnWidths(key, defaults, { min = 40, max = 480 } = {}) {
  const k = 'journali.cols.' + key
  let gemerkt = {}
  try { gemerkt = JSON.parse(localStorage.getItem(k) || '{}') } catch {}
  const w = reactive({ ...defaults })
  for (const [c, v] of Object.entries(gemerkt)) if (c in defaults && Number(v)) w[c] = Math.min(max, Math.max(min, Number(v)))
  const sichern = () => { try { localStorage.setItem(k, JSON.stringify({ ...w })) } catch {} }

  /// Ziehen am Griff: die Breite folgt der Maus, bis sie losgelassen wird.
  /// Sitzt der Griff am linken Rand der Spalte (rechtsbuendige Spalten), waechst sie nach links — das Vorzeichen
  /// dreht sich, sonst laeuft die Spalte der Maus entgegen (25.09.2026). Der Griff sagt es selbst: class="grip left".
  function zieh(spalte, e) {
    e.preventDefault(); e.stopPropagation()
    const links = e.currentTarget?.classList?.contains('left') ? -1 : 1
    const x0 = e.clientX, w0 = w[spalte]
    const move = ev => { w[spalte] = Math.min(max, Math.max(min, w0 + links * (ev.clientX - x0))) }
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); document.body.style.cursor = ''; sichern() }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
    document.body.style.cursor = 'col-resize'
  }
  /// Zurück auf die Vorgaben — Doppelklick auf einen Griff
  function zurueck() { Object.assign(w, defaults); sichern() }
  /// Als CSS-Variablen für den Container: --c-<spalte>
  const vars = () => Object.fromEntries(Object.entries(w).map(([c, v]) => [`--c-${c}`, v + 'px']))
  return { w, zieh, zurueck, vars }
}
