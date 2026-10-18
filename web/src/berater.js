// „Produktberater starten“ (15.10.2026): das Chat-Fenster eines Beraters auf dieser Seite — geladen von seinem Dienst, so wie eine Website es
// einbindet (<script src="…/widget.js">). Der erste Aufruf lädt es und öffnet es gleich (data-open); jeder weitere öffnet dasselbe Fenster wieder,
// statt ein zweites zu laden. Die Adresse nennt in der Demo /api/health (store.berater), in ✆ Produktberatung die Definition des Beraters.
// Der Dienst lässt das Fenster nur zu, wenn diese Seite unter den Websites des Beraters steht.
// Ausserhalb der Demo (18.10.2026): jeder wirkende Berater mit Adresse seines Dienstes — lokal wie auf einem eigenen Server. Mehrere: eine Auswahl.
import { reactive, watch } from 'vue'
import { api } from './api.js'

/// Die Berater mit Adresse ihres Dienstes: [{ key, label, url }] — ohne Fehler in der Definition
export const chat = reactive({ dienste: [] })

export async function diensteLaden() {
  try {
    const liste = await api.get('/api/advisor')
    chat.dienste = (Array.isArray(liste) ? liste : []).filter(b => b.url && !(b.errors ?? []).length)
      .map(b => ({ key: b.key, label: b.label || b.key, url: String(b.url).replace(/\/+$/, '') }))
  } catch { chat.dienste = [] }
}

/// Neu laden, wenn das Plugin wirkt und jemand angemeldet ist — und nach einem neuen Journalstand, höchstens alle 30 Sekunden (eine geänderte
/// Adresse kommt so ohne Neuladen der Seite an). In der Demo nennt /api/health den Dienst.
export function beobachteDienste(store, plugins) {
  let zuletzt = 0
  const laden = () => {
    if (store.demo || !plugins.active('advisor') || (store.auth.enabled && !store.auth.user)) { chat.dienste = []; return }
    zuletzt = Date.now(); diensteLaden()
  }
  watch(() => [plugins.active('advisor'), store.auth.user, store.demo, plugins.rev], laden, { immediate: true })
  watch(() => store.head, () => { if (Date.now() - zuletzt > 30_000) laden() })
}

/// Liefert, was geschah: 'offen' (das Fenster war schon geladen), 'laedt' (es lädt noch) oder 'geladen' (das Skript ist eingefügt)
export function beraterStarten(url, locale = 'de') {
  const ziel = String(url ?? '').replace(/\/+$/, '')
  const da = document.querySelector('script[data-journali-advisor]')
  if (da && da.dataset.url && da.dataset.url !== ziel) {
    // ein anderer Dienst (18.10.2026): das Fenster des bisherigen weg, dann das neue laden
    da.remove(); document.querySelectorAll('[data-journali-advisor]').forEach(e => e.remove()); delete window.journaliAdvisor
  } else {
    const fenster = window.journaliAdvisor?.fenster
    if (fenster) { fenster.oeffnen(); return 'offen' }
    if (da) return 'laedt'
  }
  const s = document.createElement('script')
  s.src = ziel + '/widget.js'
  s.dataset.url = ziel
  s.async = true
  s.dataset.open = '1'
  s.dataset.locale = locale || (navigator.language ?? 'de').slice(0, 2)   // ohne eigene Wahl die Sprache des Browsers
  s.setAttribute('data-journali-advisor', '')
  document.body.append(s)
  return 'geladen'
}
