// Plugin gpc: die GS1-Produktklassifikation (GPC). Bedient wird am Knoten wie bei ETIM: das Band „GPC“ zeigt die Klasse und führt in den
// Klassendialog (Umfeld, KI-Vorschlag, Suche, Durchsehen). Jede zugewiesene Klasse hat ihre Attributgruppe (sie heisst wie die Klasse),
// in der ihre Attribute stehen — dasselbe Vorgehen wie bei DPP und PPWR. Die Veröffentlichung liest der Anwender aus einer Datei ein, die
// er bei GS1 holt; das Modell dazu legt der Server an (/api/classification).
import { createApp, h } from 'vue'
import { t } from 'journali'
import View from './View.vue'
import Band from './Band.vue'
import { oeffneKlasse } from './modal.js'
import { systemSpec, einschalten } from '../core.mjs'

// Die Einstellungen (gemerkte Schlüssel nach einer Namenskollision) braucht das Band, bevor es zeichnet
const cache = { settings: {}, loaded: null }
async function loadSettings() {
  try { const r = await fetch('/api/plugins/gpc/data/settings'); cache.settings = r.ok ? await r.json() : {} } catch { cache.settings = {} }
}
cache.loaded = loadSettings()

/// Einmal beim Einschalten: die Systemobjekte entstehen — die Gruppe GPC mit dem Klassenattribut — und hängen an jeder Wurzel des Pflegebaums.
/// Der Server meldet sie an; solange das Plugin an ist, lassen sie sich nicht zurückziehen. Die Gruppe einer Klasse und ihre Attribute entstehen
/// erst mit dem ersten Brick, den jemand zuweist.
async function install(ctx) { return einschalten(ctx, t) }

/// Das Band am Knoten: ein Vue-Baustein im Körper, der Kopf bekommt die kurze Zusammenfassung
let angemeldet = false   // einmal je Sitzung: Bestand von früher meldet sich beim ersten Band an
async function bandMount({ head, body }, nodeId, ctx) {
  await cache.loaded
  if (!angemeldet) { angemeldet = true; ctx?.api?.post?.('/api/classification/register', { system: systemSpec(cache.settings) })?.catch?.(() => {}) }
  const app = createApp({ render: () => h(Band, { nodeId, settings: cache.settings, onKopf: text => { head.textContent = text } }) })
  app.config.globalProperties.$t = t
  app.mount(body)
  return () => app.unmount()
}

export default {
  install,
  views: [{ path: 'gpc', topic: 'classification', label: 'GPC', icon: '⌗', hint: t('GPC: Veröffentlichung einlesen, Brick suchen und einem Knoten zuweisen — bedient wird am Knoten (Band ⌗ GPC)'), component: View }],
  nodeBands: [{ key: 'gpc', label: 'GPC', icon: '⌗', roles: ['group', 'product', 'variant'], mount: bandMount }],
  nodeActions: [{
    label: t('GPC-Klasse (+)'), icon: '⌗', topic: 'classification', roles: ['group', 'product'], hint: t('Brick wählen und diesem Knoten zuweisen'),
    run: async id => { await cache.loaded; oeffneKlasse(id) },
  }],
}
