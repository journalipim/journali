// Plugin scriptum: ⌨ Skripte — die Ansicht (View.vue, gebaut mit web/build-plugins.mjs). Das Programm selbst läuft
// als Kindprozess (runner.mjs), nie im Serverprozess; die Skripte stehen im Journal.
import View from './View.vue'
import { t } from 'journali'
export default {
  views: [{ path: 'skripte', topic: 'tools', label: t('Skripte'), icon: '≡', hint: t('Auswertungen und Übergaben, die hier geschrieben werden: Tabelle, Text oder Datei — von Hand oder als Job'), component: View }],
}
