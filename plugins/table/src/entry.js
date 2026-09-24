// Basis-Plugin table: ⇩ Import → Tabelle und ⇪ Export → Tabelle — die Grundfunktion der Gruppen Import
// und Export und zugleich ihr Container: Quellen (csv, xlsx, json) und Ziele hängen sich hier an (requires: ["table"]).
// Gebaut mit web/build-plugins.mjs → ../entry.js (Vue-Ansichten, Stile eingebettet).
import ImportView from './ImportView.vue'
import ExportView from './ExportView.vue'
import * as tableExport from '../browser.js'
import { store } from 'journali'
import { t } from 'journali'

const roles = ['group', 'product']
export default {
  views: [
    { path: 'import', topic: 'import', label: t('Tabellen-Import'), icon: '⊞', hint: t('CSV, Excel, JSON, Zwischenablage — mit Datenmapper'), component: ImportView },
    { path: 'export', topic: 'export', label: t('Tabellen-Export'), icon: '⊞', hint: t('Excel, CSV — die Form, die der Tabellenimport liest'), component: ExportView },
  ],
  // Excel am Knoten
  nodeActions: [
    { topic: 'export', roles, icon: '⇪', label: (r, below) => t('Excel: Vorlage für {0}', [below]), run: id => tableExport.nodeWorkbook(id, false).catch(e => store.toast(e.message)) },
    { topic: 'export', roles, icon: '⇪', label: (r, below) => `Excel: ${below} exportieren`, run: id => tableExport.nodeWorkbook(id, true).catch(e => store.toast(e.message)) },
    { topic: 'export', roles, icon: '⊞', label: 'Exportieren … (Teilbaum)', run: (id, ctx) => { localStorage.setItem('journali.export.root', id); ctx.go(`/p/table/export?node=${encodeURIComponent(id)}`) } },
    { topic: 'import', roles, icon: '⇩', label: (r, below) => `Excel: ${below} importieren …`, run: (id, ctx) => ctx.go(`/p/table/import?node=${encodeURIComponent(id)}`) },
  ],
  tableExport,   // für andere Plugins: ctx.use('table').tableExport — build, toCsv, toJson, toJsonTree, toXlsx, download, nodeWorkbook
}
