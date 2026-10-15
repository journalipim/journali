// „Produktberater starten“ (15.10.2026): das Chat-Fenster eines Beraters auf dieser Seite — geladen von seinem Dienst, so wie eine Website es
// einbindet (<script src="…/widget.js">). Der erste Aufruf lädt es und öffnet es gleich (data-open); jeder weitere öffnet dasselbe Fenster wieder,
// statt ein zweites zu laden. Die Adresse nennt in der Demo /api/health (store.berater), in ✆ Produktberatung die Definition des Beraters.
// Der Dienst lässt das Fenster nur zu, wenn diese Seite unter den Websites des Beraters steht.

/// Liefert, was geschah: 'offen' (das Fenster war schon geladen), 'laedt' (es lädt noch) oder 'geladen' (das Skript ist eingefügt)
export function beraterStarten(url, locale = 'de') {
  const fenster = window.journaliAdvisor?.fenster
  if (fenster) { fenster.oeffnen(); return 'offen' }
  if (document.querySelector('script[data-journali-advisor]')) return 'laedt'
  const s = document.createElement('script')
  s.src = String(url ?? '').replace(/\/+$/, '') + '/widget.js'
  s.async = true
  s.dataset.open = '1'
  s.dataset.locale = locale || (navigator.language ?? 'de').slice(0, 2)   // ohne eigene Wahl die Sprache des Browsers
  s.setAttribute('data-journali-advisor', '')
  document.body.append(s)
  return 'geladen'
}
