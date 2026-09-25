// Basis-Plugin table: die Grundfunktion der Gruppen Import und Export und zugleich ihr Container. Der Anwender wählt
// das Format, nicht „Tabelle": je Format eine Kachel (CSV, Excel — JSON bringt sein eigenes Plugin mit), dazu die
// Zwischenablage. Eine Format-Kachel erscheint nur, solange ihr Plugin wirkt (needs); die Ansicht dahinter ist
// dieselbe, nur mit vorgewähltem Format.
// Gebaut mit web/build-plugins.mjs → ../entry.js (Vue-Ansichten, Stile eingebettet).
import ImportView from './ImportView.vue'
import ExportView from './ExportView.vue'
import StrukturView from './StrukturView.vue'
import * as tableExport from '../browser.js'
import { store } from 'journali'
import { t } from 'journali'

const roles = ['group', 'product']
// Daten-Excel nur am Produkt: oberhalb stehen die Attribute vieler Zweige nebeneinander, von denen jeder nur
// wenige fuellt — die Tabelle wird breit und leer. Oberhalb gibt es stattdessen die Struktur (25.09.2026).
const datenRoles = ['product']
export default {
  views: [
    { path: 'import', topic: 'import', order: 10, needs: 'csv', label: t('CSV-Import'), icon: '⊞', hint: t('CSV und TSV — mit Datenmapper'), component: ImportView, props: { nur: ['.csv', '.tsv', '.txt'] } },
    { path: 'import-xlsx', topic: 'import', order: 11, needs: 'excel', label: t('Excel-Import'), icon: '⊞', hint: t('Arbeitsmappen (.xlsx) — mit Datenmapper'), component: ImportView, props: { nur: ['.xlsx', '.xlsm'] } },
    { path: 'import-paste', topic: 'import', order: 90, label: t('Zwischenablage'), icon: '⎘', hint: t('aus Excel kopieren und hier einfügen — erste Zeile sind die Spaltennamen'), component: ImportView, props: { paste: true } },
    { path: 'export', topic: 'export', order: 10, needs: 'csv', label: t('CSV-Export'), icon: '⊞', hint: t('CSV (; UTF-8) — die Form, die der CSV-Import liest'), component: ExportView, props: { festesFormat: 'csv' } },
    { path: 'export-xlsx', topic: 'export', order: 11, needs: 'excel', label: t('Excel-Export'), icon: '⊞', hint: t('Arbeitsmappe (.xlsx) — die Form, die der Excel-Import liest'), component: ExportView, props: { festesFormat: 'excel' } },
    { path: 'struktur', topic: 'export', order: 20, label: t('Struktur'), icon: '⑂', hint: t('den Baum als Tabelle heraus, in Excel entwerfen, in einem Zug hinein — ohne Inhalte'), component: StrukturView },
  ],
  // Excel am Knoten
  nodeActions: [
    { topic: 'export', roles: datenRoles, icon: '⇪', label: (r, below) => t('Excel: Vorlage für {0}', [below]), run: id => tableExport.nodeWorkbook(id, false).catch(e => store.toast(e.message)) },
    { topic: 'export', roles: datenRoles, icon: '⇪', label: (r, below) => `Excel: ${below} exportieren`, run: id => tableExport.nodeWorkbook(id, true).catch(e => store.toast(e.message)) },
    { topic: 'export', roles: ['group'], icon: '⑂', label: t('Struktur: Baum als Tabelle …'), run: (id, ctx) => ctx.go(`/p/table/struktur?node=${encodeURIComponent(id)}`) },
    { topic: 'export', roles, icon: '⊞', label: 'Exportieren … (Teilbaum)', run: (id, ctx) => { localStorage.setItem('journali.export.root', id); ctx.go(`/p/table/export?node=${encodeURIComponent(id)}`) } },
    { topic: 'import', roles: datenRoles, icon: '⇩', label: (r, below) => `Excel: ${below} importieren …`, run: (id, ctx) => ctx.go(`/p/table/import?node=${encodeURIComponent(id)}`) },
  ],
  tableExport,   // für andere Plugins: ctx.use('table').tableExport — build, toCsv, toJson, toJsonTree, toXlsx, download, nodeWorkbook
}
