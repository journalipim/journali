// Plugin berater: ⇪ Export → Produktberatung — die Ansicht legt Berater an (Publikationsbaum, Rolle, Sicht, Grenzen) und gibt ihrem Dienst ein
// Token (View.vue, gebaut mit web/build-plugins.mjs). Der Dienst selbst ist serve.mjs im eigenen Container; die Fragen beantwortet der Server
// (BeraterApi.cs).
import View from './View.vue'
import { t } from 'journali'
export default {
  views: [{ path: 'berater', topic: 'export', order: 50, label: t('Produktberatung'), icon: '✆', hint: t('Fragen von Besuchern einer Website an die Produkte eines Publikationsbaums — als Chat-Fenster und für KI-Agenten'), component: View }],
}
