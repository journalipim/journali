// Tabellen-Export im Browser (fest eingebaut, Taloan 19.09.): der Kern liegt in plugins/export/core.mjs (auch für den Job),
// hier das Browser-Drumherum — Herunterladen, SheetJS laden, Excel am Knoten (Vorlage / Export mit Legende).
import { api } from './api.js'
import { store } from './store.js'
import { tree } from './tree.js'
import * as mapper from './mapper.js'
import { build as coreBuild, toCsv, toJson, toJsonTree, workbook } from '../../plugins/export/core.mjs'

export { toCsv, toJson, toJsonTree }
export const download = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000) }
// SheetJS kommt zur Laufzeit aus dem Plugin xlsx (nicht gebündelt) — der Pfad als Variable, damit Vite ihn nicht auflöst
const XLSX_URL = '/plugins/xlsx/xlsx.mjs'
export const loadXlsx = () => import(/* @vite-ignore */ XLSX_URL)
export const build = opts => coreBuild({ api, model: store.model }, opts)
export async function toXlsx(table, sheet = 'Daten') {
  const X = await loadXlsx()
  return new Blob([X.write(workbook(X, table, null, sheet), { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

// ---- Excel am Knoten (Taloan, 17.09.: Rechtsklick auf Gruppe/Produkt → Vorlage, Varianten/Produkte exportieren, Excel importieren):
// dieselben Spalten in allen drei — id, sku, Achsen, dann die Attribute, die hier eine Ebene tiefer gelten (childColumns).
// Blatt „Legende“ erklärt jede Spalte (Label, Typ, Pflicht, Einheit, Listenwerte). Der Import am selben Knoten ist streng.
async function nodeColumns(nodeId) {
  if (!tree.loaded) await tree.load()
  const row = tree.byId.get(nodeId); const n = await api.get(`/api/nodes/${encodeURIComponent(nodeId)}`)
  const childRole = mapper.childRoleOf(row, tree.kids(nodeId))
  const locales = store.model.locales.map(l => l.code)
  return { row, childRole, columns: mapper.childColumns(store.model, n, childRole, row.axes ?? [], locales) }
}
function legend(columns) {
  const model = store.model
  const rows = [['Spalte', 'Label', 'Typ', 'Pflicht', 'Einheit', 'Sprache', 'Werte / Hinweis']]
  for (const c of columns) {
    const d = c.def ?? (c.attr ? model.attributes.find(a => a.key === c.attr) : null)
    const list = d?.list ? model.lists.find(l => l.key === d.list) : null
    rows.push([c.key, d?.label?.de ?? '', d?.type ?? '', d?.required && Object.keys(d.required).length ? 'ja' : '', d?.unit ?? '', c.locale ?? '', c.note ?? (list ? list.values.map(v => `${v.value} = ${v.label?.de ?? v.value}`).join(' · ') : '')])
  }
  return rows
}
export async function nodeWorkbook(nodeId, withData) {
  const X = await loadXlsx()
  const { row, childRole, columns } = await nodeColumns(nodeId)
  let data = []
  if (withData) {
    const locales = store.model.locales.map(l => l.code); const byLocale = new Map(); let nodes = []
    for (const l of locales) { const t = await api.get(`/api/nodes/${encodeURIComponent(nodeId)}/table?locale=${l}&role=${childRole}`); nodes = t.rows; byLocale.set(l, new Map(t.rows.map(r => [r.row.id, r.values]))) }
    data = nodes.map(r => columns.map(c => c.key === 'id' ? r.row.id : c.key === 'sku' ? r.row.sku ?? '' : c.key.startsWith('axis:') ? r.row.axisValues?.[c.attr] ?? '' : (byLocale.get(c.locale ?? locales[0])?.get(r.row.id)?.[c.attr]?.value ?? '')))
  }
  const wb = workbook(X, { columns, rows: data }, legend(columns))
  const name = `${row.label}-${childRole}${withData ? '' : '-vorlage'}`.replace(/[^\w.-]+/g, '_') + '.xlsx'
  download(new Blob([X.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name)
  store.toast(`⇪ ${name}: ${columns.length} Spalten${withData ? `, ${data.length} Zeilen` : ''}`)
}
