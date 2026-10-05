// Warnung vor dem Kontingent (03.10.2026): reicht, was das eigene Team noch schreiben darf, für so viele Einträge? Wenn nicht, fragt ein Dialog — starten
// lässt es sich trotzdem; ein Lauf hält dann an, wenn das Kontingent erschöpft ist. Für Plugins über `import { kontingent } from 'journali'`.
import { api } from './api.js'
import { store } from './store.js'
import { dialog } from './dialog.js'
import { t } from './i18n.js'

/// Unbegrenzt (int.MaxValue vom Server)
export const OHNE = 2147483647
const zahl = n => n >= OHNE ? '∞' : Number(n).toLocaleString('de-DE')

/// Die Rückfrage, wenn es nicht reicht — sonst null. `verfuegbar` wie vom Server ({ woche, monat }), `eintraege` die Schätzung.
export function frage({ label, eintraege, verfuegbar, hoechstens = false }) {
  if (!verfuegbar || eintraege == null) return null
  const rest = Math.min(verfuegbar.woche, verfuegbar.monat)
  if (rest >= OHNE || eintraege <= rest) return null
  return {
    title: t('{0} starten', [label]), danger: true, ok: t('▶ Trotzdem starten'),
    list: [t('Verfügbar · {0} / Woche · {1} / Monat', [zahl(verfuegbar.woche), zahl(verfuegbar.monat)]),
      hoechstens ? t('Nötig · höchstens {0} Einträge', [zahl(eintraege)]) : t('Nötig · etwa {0} Einträge', [zahl(eintraege)])],
    warn: t('Das Kontingent reicht nicht; der Lauf hält an, wenn es erschöpft ist.'),
  }
}

/// Reicht es — oder will der Anwender trotzdem? `job`: als Joblauf (ohne die 10 % Reserve für die Handarbeit). Ohne Auskunft des Servers: ja.
export async function reicht({ label, eintraege, job = true, hoechstens = false }) {
  if (store.startphase) return true   // Startphase: keine Grenze
  let verfuegbar = null
  try { verfuegbar = await api.get(`/api/jobs/verfuegbar?job=${job}`) } catch { return true }
  const f = frage({ label, eintraege, verfuegbar, hoechstens })
  return f ? dialog.confirm(f) : true
}
