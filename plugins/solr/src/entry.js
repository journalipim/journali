// Plugin solr: ⇩ Import → Solr — Ansicht im Browser (View.vue, gebaut mit web/build-plugins.mjs), Client in ../solr.js.
// Hängt an der Gruppe Import (Basis-Plugin table).
import View from './View.vue'
import { t } from 'journali'
export default {
  views: [{ path: 'import', topic: 'import', label: t('Solr'), icon: '⇩', component: View }],
}
