// Plugin json: Liste von Objekten als Tabelle; Objekte werden flach (a.b.c), Listen von Skalaren kommagetrennt.
// Dazu: der JSON-Import-Manager (manager.js) für Knotenbäume im Rohdaten-Format — analysieren, Modell zuordnen, Ziel, einspielen.
import { mountManager } from './manager.js'
import { mountExport, rawOf, rawName } from './export.js'
const t = (k, p) => globalThis.journali?.t ? globalThis.journali.t(k, p) : String(k).replace(/\{(\w+)\}/g, (m, i) => p?.[i] ?? m)   // Oberflächensprache: spät gebunden, im Test ohne Fenster ladbar
const download = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000) }
export default {
  views: [
    { path: 'import', label: 'JSON-Import', icon: '⇩', topic: 'import', mount: mountManager },
    { path: 'export', label: 'JSON-Export', icon: '⇪', topic: 'export', mount: mountExport },   // strukturiert — nicht Tabelle
  ],
  nodeActions: [
    { label: (r, below) => t('JSON: Rohdaten sichern (mit {0})', [below]), icon: '⇪', roles: ['group', 'product', 'variant'], async run(nodeId, ctx) { try { const raw = await rawOf(ctx, nodeId); download(new Blob([JSON.stringify(raw, null, 1)], { type: 'application/json' }), rawName(ctx, nodeId)) } catch (e) { ctx.store.toast(e.message) } } },
  ],
  importers: [{
    key: 'json', label: 'JSON', accept: ['.json', '.jsonl', '.ndjson'],
    async parse(file, ctx) {
      const text = await file.text()
      let list
      if (/\.(jsonl|ndjson)$/i.test(file.name)) list = text.split(/\r?\n/).filter(l => l.trim()).map(l => JSON.parse(l))
      else { const j = JSON.parse(text); list = Array.isArray(j) ? j : (j.rows ?? j.items ?? j.data ?? j.results ?? j.docs ?? []) }
      if (!Array.isArray(list)) throw new Error(t('JSON: Liste von Objekten erwartet (oder { rows: [...] })'))
      return ctx.mapper.fromObjects(list)
    },
  }],
}
