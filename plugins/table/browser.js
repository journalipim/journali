// Tabellen-Export im Browser (Basis-Plugin table): der Kern liegt in core.mjs (auch für den Job im Plugin export),
// hier das Browser-Drumherum — Herunterladen, SheetJS laden, Excel am Knoten (Vorlage / Export mit Legende).
import { api, store, tree, mapper, plugins } from 'journali'
import { build as coreBuild, toCsv, toJson, toJsonTree, workbook } from './core.mjs'
const L = l => globalThis.journali?.L ? globalThis.journali.L(l) : (l?.de ?? Object.values(l ?? {})[0] ?? '')   // Bezeichnung in der Oberflächensprache
const t_ = (k, p) => globalThis.journali?.t ? globalThis.journali.t(k, p) : String(k).replace(/\{(\w+)\}/g, (m, i) => p?.[i] ?? m)   // Oberflächensprache: spät gebunden, im Test ohne Fenster ladbar

export { toCsv, toJson, toJsonTree }
export const download = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000) }
// SheetJS kommt zur Laufzeit aus dem Plugin xlsx (nicht gebündelt) — der Pfad als Variable, damit Vite ihn nicht auflöst
const XLSX_URL = '/plugins/excel/xlsx.mjs'
export const loadXlsx = () => import(/* @vite-ignore */ XLSX_URL)
const POLISH_URL = '/plugins/excel/polish.mjs'
// Komfort-Excel: Kopf fett, Pflicht rot, Achsen blau, echte Tabelle mit Filter und Streifen, erste Zeile fest — nachträglich in die Datei
async function polished(X, wb, columns, rowCount, tableName, legendRows = null) {
  const raw = X.write(wb, { type: 'array', bookType: 'excel' })
  try { const { polish } = await import(/* @vite-ignore */ POLISH_URL); return await polish(raw, { columns, rowCount, tableName, legend: legendRows ? { columns: legendRows[0], rowCount: legendRows.length - 1 } : null }) }
  catch (e) { console.warn(t_('Excel ohne Politur:'), e.message); return new Blob([raw], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) }
}
export const build = opts => coreBuild({ api, model: store.model }, opts)

/// Eine Tabellendatei lesen (Excel über das Plugin xlsx, sonst CSV/TSV) — liefert Kopfzeile und Zeilen.
/// Für die Struktur reicht das erste Blatt: sie hat nur eines.
export async function leseDatei(file) {
  const imp = plugins.importerFor(file.name)
  let t
  if (imp) t = await imp.parse(file, plugins.ctx(imp.key))
  else if (/\.(csv|txt|tsv)$/i.test(file.name)) t = mapper.parseDelimited(await file.text())
  else throw new Error(t_('Kein Importer für {0} — Plugin für dieses Format einschalten (⌿ Plugins)', [file.name]))
  const blatt = t.sheets?.[0] ?? t
  return { kopf: blatt.columns ?? [], zeilen: blatt.rows ?? [] }
}
export async function toXlsx(table, sheet = t_('Daten')) {
  const X = await loadXlsx()
  const wb = workbook(X, table, null, sheet)
  const blob = await polished(X, wb, table.columns, table.rows.length, sheet)
  // Der Aufrufer sagt dem Anwender, wenn Excel etwas nicht aufnehmen konnte
  blob.gekuerzt = wb.gekuerzt
  return blob
}

// ---- Excel am Knoten:
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
  const rows = [[t_('Pflicht'), t_('Spalte'), t_('Label'), 'Typ', t_('Einheit'), t_('Sprache'), 'Werte / Hinweis']]
  for (const c of columns) {
    const d = c.def ?? (c.attr ? model.attributes.find(a => a.key === c.attr) : null)
    const list = d?.list ? model.lists.find(l => l.key === d.list) : null
    const req = d?.required && (typeof d.required !== 'object' || Object.keys(d.required).length) || c.key.startsWith('axis:')
    rows.push([req ? 'ja' : 'nein', c.key, L(d?.label) ?? '', d?.type ?? '', d?.unit ?? '', c.locale ?? '', c.note ?? (list ? list.values.map(v => `${v.value} = ${L(v.label) ?? v.value}`).join(' · ') : '')])
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
    data = nodes.map(r => columns.map(c => c.key === 'id' ? r.row.id : c.key.startsWith('axis:') ? r.row.axisValues?.[c.attr] ?? '' : (byLocale.get(c.locale ?? locales[0])?.get(r.row.id)?.[c.attr]?.value ?? '')))
  }
  const lg = legend(columns)
  const wb = workbook(X, { columns, rows: data }, lg)
  const name = `${row.label}-${childRole}${withData ? '' : '-vorlage'}`.replace(/[^\w.-]+/g, '_') + '.xlsx'
  download(await polished(X, wb, columns, data.length, childRole === 'variant' ? t_('Varianten') : childRole === 'product' ? t_('Produkte') : t_('Gruppen'), lg), name)
  store.toast(t_('⇪ {0}: {1} Spalten{2}', [name, columns.length, withData ? t_(', {0} Zeilen', [data.length]) : '']))
}
