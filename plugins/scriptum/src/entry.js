// Plugin scriptum: ⌨ Skripte — die Ansicht (View.vue, gebaut mit web/build-plugins.mjs). Das Programm selbst läuft
// als Kindprozess (runner.mjs), nie im Serverprozess; die Skripte stehen im Journal.
import View from './View.vue'
import { t } from 'journali'
import { liste as nodeScripts, refresh, laufAufKnoten } from './nodescripts.js'
refresh()
export default {
  views: [{ path: 'skripte', topic: 'tools', label: t('Skripte'), icon: 'λ', hint: t('Auswertungen und Übergaben, die hier geschrieben werden: Tabelle, Text oder Datei — von Hand oder als Job'), component: View }],
  // Skripte mit meta.nodes:true erscheinen im Knoten-Kontextmenü und laufen auf den selektierten Knoten (IDs als Parameter „nodes")
  nodeActions: [{ multi: true, items: (row, below, sel) => nodeScripts.map(s => ({ label: s.label || s.key, run: (ctx) => laufAufKnoten(s, (sel && sel.length ? sel.map(x => x.id) : [row.id]), ctx) })) }],
}
