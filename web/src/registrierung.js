// Registrierung beim Lizenzserver (26.09.2026). Registriert holt diese Anlage dort das Tarifblatt und kennt damit die
// Tarife und die Aktionen des Shops; ohne spricht sie nicht mit ihm, solange kein Team ein Abo hat. Gefragt wird einmal
// und nur, wer die Anlage verwaltet (Recht users); die Antwort steht im Journal, darum fragt kein zweiter Server noch
// einmal. Die Frage steht hier und nicht in App.vue, damit der Prüfstand sie ohne die ganze Leiste stellen kann.
import { dialog } from './dialog.js'
import { api } from './api.js'
import { store } from './store.js'
import { t as t_ } from './i18n.js'

let gefragt = false

/// Einmal fragen, wenn noch niemand geantwortet hat. Liefert true, wenn gefragt wurde. Solange der Server noch nichts
/// gesagt hat (undefined), wird nicht gefragt — sonst stünde die Frage bei jedem Laden da.
export async function frageNachRegistrierung() {
  // Nie vor der Anmeldung: store.can() sagt abgemeldet „ja“ (so ist es für Anlagen ohne Anwender gedacht), und die Anmeldeseite ist kein Ort für diese Frage;
  // solange der Zustand der Anmeldung nicht bekannt ist, ebenso nicht (01.10.2026)
  if (!store.auth.known || (store.auth.enabled && !store.auth.user)) return false
  if (gefragt || store.registriert !== null || !store.can('users')) return false
  gefragt = true
  const ja = await dialog.confirm({
    title: t_('Diese Anlage beim Lizenzserver registrieren?'),
    text: t_('Sie holt dort Tarife und Aktionen des Shops und nennt dabei ihre Kennung.'),
    ok: t_('Registrieren'),
    cancel: t_('Nicht registrieren'),
  })
  try {
    await api.post('/api/licence/registrierung', { ja })
    await store.poll(true)
  } catch (e) { store.toast(e.message) }
  return true
}

/// Nur für den Prüfstand: die Frage steht wieder offen.
export function _wiederFragen() { gefragt = false }
