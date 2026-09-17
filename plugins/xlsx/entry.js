// Plugin xlsx: Excel-Arbeitsmappen im Browser lesen (SheetJS Community Edition, xlsx.mjs daneben, Apache-2.0).
// Jedes Blatt wird eine Tabelle { name, columns, rows }; die Ansicht lässt das Blatt wählen. Erste Zeile = Spaltennamen.
// Datumszellen kommen als ISO-Text (yyyy-mm-dd), Zahlen als Zahl, alles andere als Text.
let XLSX = null
async function lib(ctx) { if (!XLSX) XLSX = await import(ctx.plugin.base + 'xlsx.mjs'); return XLSX }

export default {
  importers: [{
    key: 'xlsx', label: 'Excel', accept: ['.xlsx', '.xlsm', '.xls', '.ods'],
    async parse(file, ctx) {
      const X = await lib(ctx)
      const wb = X.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
      const sheets = wb.SheetNames.map(name => {
        const aoa = X.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: true })
        const head = (aoa[0] ?? []).map((c, i) => String(c ?? '').trim() || `Spalte ${i + 1}`)
        const rows = aoa.slice(1).filter(r => r.some(v => v !== '' && v != null))
          .map(r => head.map((_, i) => { const v = r[i]; return v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? '' : v }))
        return { name, columns: head, rows }
      }).filter(s => s.columns.length)
      if (!sheets.length) throw new Error('Kein Blatt mit Inhalt')
      return { sheets }
    },
  }],
}
