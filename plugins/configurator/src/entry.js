// Plugin configurator: ⚙ Werkzeuge → Konfigurator. Eine Ansicht, die die Regeln pflegt und Beispiele prüft; die Regeln stehen als Plugin-Daten
// im Journal, geprüft wird auf dem Server (/api/configurator/{key}/check) — dieselbe Prüfung, die ein Shop bekommt.
import { createApp, h } from 'vue'
import View from './View.vue'
import Band from './Band.vue'
import { t } from 'journali'

/// Das Band am Knoten (Beitragspunkt nodeBands): die Zeilen des Teils in Konfiguratorgruppen, am Produkt bearbeitet. Der Kopf bekommt die kurze Zusammenfassung.
async function bandMount({ head, body }, nodeId) {
  const app = createApp({ render: () => h(Band, { nodeId, onKopf: text => { head.textContent = text } }) })
  app.config.globalProperties.$t = t
  app.mount(body)
  return () => app.unmount()
}
export default {
  views: [{ path: 'regeln', topic: 'tools', label: t('Konfigurator'), icon: '⚙', hint: t('Regeln, die zu einer Auswahl von Produkten sagen, was zulässig ist und was fehlt — mit Beispielen und Testfällen'), component: View }],
  nodeBands: [{ key: 'gruppen', label: t('Konfiguratorgruppen'), icon: '⚙', roles: ['group', 'product', 'variant'], mount: bandMount }],
}
