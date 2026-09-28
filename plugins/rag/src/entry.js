// Plugin rag: ⇪ Export → KI-Wissensbasis — die Ansicht legt die Profile des Jobs an (View.vue, gebaut mit
// web/build-plugins.mjs); der Lauf selbst ist der Prozess job.mjs unter ⏱ Jobs.
import View from './View.vue'
import { t } from 'journali'
export default {
  views: [{ path: 'profile', topic: 'export', order: 40, needs: 'tasker', label: t('KI-Wissensbasis'), icon: '✧', hint: t('je Knoten ein Dokument für Vektor-Stores — als Job'), component: View }],
}
