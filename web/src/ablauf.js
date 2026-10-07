// Erinnerung vor dem Ablauf (07.10.2026): was in den nächsten 14 Tagen endet — Test, Lizenz, Schlüssel, ein Abo, das sich nicht von selbst
// verlängert. Der Server sagt es nur denen, die das Team führen, und der Verwaltung (/api/licence/ablauf, Ablaufhinweise.cs); in der Startphase
// und in der Demo gibt es nichts zu erinnern. Die Kopfzeile zeigt das Nächste, der Tooltip alles.
import { api } from './api.js'
import { store } from './store.js'
import { t } from './i18n.js'

export async function ladeAblauf() {
  if (store.startphase || store.demo || !store.auth.known || (store.auth.enabled && !store.auth.user)) { store.ablauf = []; return store.ablauf }
  try { const r = await api.get('/api/licence/ablauf'); store.ablauf = Array.isArray(r) ? r : [] } catch { store.ablauf = [] }
  return store.ablauf
}

const WAS = { test: () => t('Test'), lizenz: () => t('Lizenz'), abo: () => t('Abo'), schluessel: () => t('Schlüssel') }

/// „⏳ Abo Pro endet in 9 Tagen“ — kurz für die Kopfzeile
export function ablaufText(a) {
  const was = `${WAS[a.was]?.() ?? a.was}${a.tarif ? ' ' + a.tarif : ''}`
  return a.tage <= 0 ? t('⏳ {0} endet heute', [was]) : a.tage === 1 ? t('⏳ {0} endet morgen', [was]) : t('⏳ {0} endet in {1} Tagen', [was, a.tage])
}

/// Alles für den Tooltip: je Ende eine Zeile, mit Team und Datum
export function ablaufTitel(liste) {
  return liste.map(a => `${ablaufText(a).replace('⏳ ', '')}${a.teamLabel ? ' · ' + a.teamLabel : ''} (${a.am})`).join('\n')
    + '\n' + t('Für einen passenden Tarif und das rechtzeitige Verlängern sorgt der Betreiber.')
}
