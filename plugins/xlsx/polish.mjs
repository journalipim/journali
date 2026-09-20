// Komfort-Excel (Taloan, 20.09.2026: „Pflicht sichtbar, Autofilter, als Tabelle formatiert“): die freie SheetJS-Fassung schreibt weder
// Farben noch Tabellen. Also nachträglich in die fertige .xlsx (ein Zip aus XML): Kopfzeile fett, Pflichtspalten rot, Achsen blau,
// eine echte Excel-Tabelle (ListObject mit Streifen und Filter) über den Bereich, erste Zeile eingefroren. Ohne Bibliothek —
// das Zip lesen wir selbst (SheetJS legt die Teile unkomprimiert ab; komprimierte nimmt DecompressionStream) und schreiben es neu.
const enc = new TextEncoder(), dec = new TextDecoder()

// ---- Zip lesen/schreiben (nur, was Excel-Dateien brauchen: lokale Köpfe, zentrales Verzeichnis, Ablage ohne Kompression)
async function unzip(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf); const files = new Map(); let p = 0
  while (p + 30 <= u8.length && dv.getUint32(p, true) === 0x04034b50) {
    const method = dv.getUint16(p + 8, true), csz = dv.getUint32(p + 18, true), nl = dv.getUint16(p + 26, true), el = dv.getUint16(p + 28, true)
    const name = dec.decode(u8.subarray(p + 30, p + 30 + nl)); const data = u8.slice(p + 30 + nl + el, p + 30 + nl + el + csz)
    files.set(name, method === 8 ? new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()) : data)
    p += 30 + nl + el + csz
  }
  if (!files.size) throw new Error('kein Zip')
  return files
}
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } return t })()
const crc32 = d => { let c = 0xFFFFFFFF; for (let i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0 }
function zip(files) {
  const parts = [], central = []; let off = 0
  const dos = (() => { const d = new Date(); return { t: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), d: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() } })()
  for (const [name, data] of files) {
    const n = enc.encode(name), crc = crc32(data)
    const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, dos.t, true); h.setUint16(12, dos.d, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, n.length, true); h.setUint16(28, 0, true)
    const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, dos.t, true); c.setUint16(14, dos.d, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, n.length, true); c.setUint32(42, off, true)
    parts.push(new Uint8Array(h.buffer), n, data); central.push(new Uint8Array(c.buffer), n)
    off += 30 + n.length + data.length
  }
  const cdSize = central.reduce((k, x) => k + x.length, 0)
  const e = new DataView(new ArrayBuffer(22)); e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.size, true); e.setUint16(10, files.size, true); e.setUint32(12, cdSize, true); e.setUint32(16, off, true)
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

// ---- Die Politur. columns: [{ key, def?, note? }] wie core.workbook; kind je Spalte: required | axis | info | plain
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const colRef = i => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26) } return s }
export async function polish(buf, { columns, rowCount = 0, sheet = 'xl/worksheets/sheet1.xml', tableName = 'Daten', legend = null }) {
  const files = await unzip(buf)
  await polishSheet(files, { columns, rowCount, sheet, tableName, tableId: 1 })
  // die Legende (Blatt 2) ebenfalls als Tabelle — Pflicht/Eindeutig ganz links zum Filtern (Taloan, 20.09.)
  if (legend && files.has('xl/worksheets/sheet2.xml')) await polishSheet(files, { columns: legend.columns.map(k => ({ key: k })), rowCount: legend.rowCount, sheet: 'xl/worksheets/sheet2.xml', tableName: 'Legende', tableId: 2 })
  return zip(files)
}
// Stile einmal je Datei: eigene Schrift (fett) und Füllungen an das von SheetJS geschriebene styles.xml anhängen — dessen Formate bleiben gültig
const STYLED = new WeakMap()
function styles(files) {
  if (STYLED.has(files)) return STYLED.get(files)
  let st = dec.decode(files.get('xl/styles.xml') ?? new Uint8Array())
  const count = tag => Number(st.match(new RegExp(`<${tag} count="(\\d+)"`))?.[1] ?? 0)
  const fontId = count('fonts'), fillId = count('fills'), xfId = count('cellXfs')
  const grow = (tag, add, n) => { st = st.replace(new RegExp(`<${tag} count="(\\d+)">([\\s\\S]*?)</${tag}>`), (_, c, inner) => `<${tag} count="${Number(c) + n}">${inner}${add}</${tag}>`) }
  if (!/<fonts /.test(st) || !/<fills /.test(st) || !/<cellXfs /.test(st)) throw new Error('styles.xml unerwartet')
  grow('fonts', '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>', 1)
  grow('fills', '<fill><patternFill patternType="solid"><fgColor rgb="FFC00000"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF595959"/><bgColor indexed="64"/></patternFill></fill>', 3)
  grow('cellXfs', `<xf numFmtId="0" fontId="${fontId}" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="${fontId}" fillId="${fillId}" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="${fontId}" fillId="${fillId + 1}" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="${fontId}" fillId="${fillId + 2}" borderId="0" xfId="0" applyFont="1" applyFill="1"/>`, 4)
  files.set('xl/styles.xml', enc.encode(st))
  const ids = { xfHead: xfId, xfReq: xfId + 1, xfAxis: xfId + 2, xfInfo: xfId + 3 }; STYLED.set(files, ids); return ids
}
async function polishSheet(files, { columns, rowCount, sheet, tableName, tableId }) {
  const text = n => dec.decode(files.get(n) ?? new Uint8Array()); const put = (n, s) => files.set(n, enc.encode(s))
  const { xfHead, xfReq, xfAxis, xfInfo } = styles(files)
  const kindOf = c => c.key.startsWith('axis:') ? 'axis' : (c.def?.required && (typeof c.def.required !== 'object' || Object.keys(c.def.required).length)) ? 'required' : c.key === 'id' || c.key === 'sku' ? 'info' : 'plain'
  // Kopfzeile einfärben, Filter durch die Tabelle ersetzen, erste Zeile einfrieren, Tabelle anmelden
  let ws = text(sheet)
  ws = ws.replace(/<row r="1"[^>]*>[\s\S]*?<\/row>/, row => row.replace(/<c r="([A-Z]+)1"/g, (m, col) => { const i = columns.findIndex((_, k) => colRef(k) === col); const kind = i >= 0 ? kindOf(columns[i]) : 'plain'; return kind === 'plain' ? m : `${m} s="${kind === 'required' ? xfReq : kind === 'axis' ? xfAxis : xfInfo}"` }))
  ws = ws.replace(/<autoFilter [^>]*\/>/, '')
  ws = ws.replace(/<sheetView workbookViewId="0"\/>/, '<sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView>')
  if (!/xmlns:r=/.test(ws)) ws = ws.replace('<worksheet ', '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ')
  ws = ws.replace('</worksheet>', `<tableParts count="1"><tablePart r:id="rIdTbl${tableId}"/></tableParts></worksheet>`)
  put(sheet, ws)
  // die Tabelle: Bereich Kopf + Daten (mindestens eine Datenzeile), Spalten wie die Köpfe, Streifen, Filter
  const ref = `A1:${colRef(columns.length - 1)}${Math.max(2, rowCount + 1)}`
  const name = tableName.replace(/[^A-Za-z0-9_]/g, '_')
  put(`xl/tables/table${tableId}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="${tableId}" name="${name}" displayName="${name}" ref="${ref}" totalsRowShown="0"><autoFilter ref="${ref}"/><tableColumns count="${columns.length}">${columns.map((c, i) => `<tableColumn id="${i + 1}" name="${esc(c.key)}"/>`).join('')}</tableColumns><tableStyleInfo name="TableStyleMedium2" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/></table>`)
  const relsName = sheet.replace(/worksheets\/(.*)$/, 'worksheets/_rels/$1.rels')
  const rel = `<Relationship Id="rIdTbl${tableId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table${tableId}.xml"/>`
  const rels = files.has(relsName) ? text(relsName).replace('</Relationships>', rel + '</Relationships>') : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel}</Relationships>`
  put(relsName, rels)
  put('[Content_Types].xml', text('[Content_Types].xml').replace('</Types>', `<Override PartName="/xl/tables/table${tableId}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/></Types>`))
}
