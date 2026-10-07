// Hinweise zum Betrieb (05.10.2026): einmal je Instanz und Version zur Kenntnis nehmen — gefragt wird, wer die Instanz verwaltet (Recht users).
// Die Bestätigung steht mit Version und Wortlaut im Journal; „später“ fragt beim nächsten Laden wieder. Wie registrierung.js steht die Frage
// hier und nicht in App.vue, damit der Prüfstand sie ohne die ganze Leiste stellen kann.
import { dialog } from './dialog.js'
import { api } from './api.js'
import { store } from './store.js'
import { t as t_, L } from './i18n.js'

let gefragt = false

/// Einmal je Laden fragen, solange die geltende Version nicht bestätigt ist. Liefert true, wenn gefragt wurde.
export async function frageNachBetriebshinweis() {
  if (!store.auth.known || (store.auth.enabled && !store.auth.user)) return false   // nie vor der Anmeldung
  if (gefragt || !store.can('users')) return false
  gefragt = true
  let n
  try { n = await api.get('/api/notice') } catch { return false }
  if (!n || n.acknowledged === n.version) return false
  const ok = await dialog.confirm({
    title: L(n.title),
    text: t_('Gilt für diese Instanz; die Bestätigung steht im Journal.'),
    list: (n.points ?? []).map(p => L(p)),
    ok: t_('✓ zur Kenntnis genommen'),
    cancel: t_('später'),
  })
  if (!ok) return true
  try { await api.post(`/api/notice/acknowledge?version=${encodeURIComponent(n.version)}`) } catch (e) { store.toast(e.message) }
  return true
}

/// Testversion (07.10.2026): der Hinweis hinter dem roten Feld oben — vom Server, auch ohne Anmeldung.
export async function zeigeTesthinweis() {
  let n
  try { n = await api.get('/api/testversion') } catch (e) { store.toast(e.message); return false }
  await dialog.help({ title: L(n.title), rows: (n.points ?? []).map(p => ['•', L(p)]) })
  return true
}

/// Nur für den Prüfstand: die Frage steht wieder offen.
export function _wiederFragen() { gefragt = false }
