// Plugin configurator: ⚙ Werkzeuge → Konfigurator. Eine Ansicht, die die Regeln pflegt und Beispiele prüft; die Regeln stehen als Plugin-Daten
// im Journal, geprüft wird auf dem Server (/api/configurator/{key}/check) — dieselbe Prüfung, die ein Shop bekommt.
import View from './View.vue'
import { t } from 'journali'
export default {
  views: [{ path: 'regeln', topic: 'tools', label: t('Konfigurator'), icon: '⚙', hint: t('Regeln, die zu einer Auswahl von Produkten sagen, was zulässig ist und was fehlt — mit Beispielen und Testfällen'), component: View }],
}
