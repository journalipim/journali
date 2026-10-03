// Version und Bau so, wie die Kopfleiste sie zeigt: kurz „TTMM.hhmm“, lang mit Datum und Uhrzeit für den Tooltip.
// Dieselbe Schreibweise in der Kopfleiste und in Einstellungen → ⧉ Server, damit man beide vergleichen kann.
const zz = n => String(n).padStart(2, '0')

/// „0310.1115“ — Tag, Monat, Punkt, Stunde, Minute (Ortszeit)
export function bauKurz(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${zz(d.getDate())}${zz(d.getMonth() + 1)}.${zz(d.getHours())}${zz(d.getMinutes())}`
}

/// „03.10.2026, 11:15“
export function bauLang(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
