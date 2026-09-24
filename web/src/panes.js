// Breiten der Fenster je Ansicht, gemerkt im localStorage.
import { ref, watch } from 'vue'

export function paneWidth(key, fallback) {
  const k = 'journali.pane.' + key
  let v = fallback
  try { const s = localStorage.getItem(k); if (s) v = Number(s) || fallback } catch {}
  const r = ref(v)
  watch(r, n => { try { localStorage.setItem(k, String(n)) } catch {} })
  return r
}
