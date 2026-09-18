// Plugin json: Liste von Objekten als Tabelle; Objekte werden flach (a.b.c), Listen von Skalaren kommagetrennt.
// Dazu (Taloan, 18.09.): der JSON-Import-Manager (manager.js) für Knotenbäume im Rohdaten-Format — analysieren, Modell zuordnen, Ziel, einspielen.
import { mountManager } from './manager.js'
export default {
  views: [{ path: 'import', label: 'JSON-Import', icon: '⇩', mount: mountManager }],
  importers: [{
    key: 'json', label: 'JSON', accept: ['.json', '.jsonl', '.ndjson'],
    async parse(file, ctx) {
      const text = await file.text()
      let list
      if (/\.(jsonl|ndjson)$/i.test(file.name)) list = text.split(/\r?\n/).filter(l => l.trim()).map(l => JSON.parse(l))
      else { const j = JSON.parse(text); list = Array.isArray(j) ? j : (j.rows ?? j.items ?? j.data ?? j.results ?? j.docs ?? []) }
      if (!Array.isArray(list)) throw new Error('JSON: Liste von Objekten erwartet (oder { rows: [...] })')
      return ctx.mapper.fromObjects(list)
    },
  }],
}
