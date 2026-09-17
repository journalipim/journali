// Plugin csv: Textdateien mit Trennzeichen als Tabelle. Der Mapper (ctx.mapper.parseDelimited) erkennt das
// Trennzeichen aus der ersten Zeile; hier kommt nur der Zeichensatz dazu: UTF-8, sonst Windows-1252 (Excel-Export).
export default {
  importers: [{
    key: 'csv', label: 'CSV / TSV', accept: ['.csv', '.tsv', '.txt'],
    async parse(file, ctx) {
      const buf = await file.arrayBuffer()
      let text
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf) }
      catch { text = new TextDecoder('windows-1252').decode(buf) }
      return ctx.mapper.parseDelimited(text)
    },
  }],
}
