// journali Excel-Add-in (Office.js): Aufgabenbereich, spricht mit /api desselben Servers, der diese Seite liefert.
// Laden: GET /api/nodes/{id}/table → Blatt (Zeile 1 Schlüssel, Zeile 2 Namen, ab Zeile 3 Daten, Spalte A Id).
// Speichern: Blatt lesen, mit dem Schnappschuss beim Laden vergleichen, nur Geändertes als POST /api/batch.
/* global Office, Excel */
const $ = id => document.getElementById(id)
const base = location.origin
const settings = { actor: localStorage.getItem('journali.actor') || '' }
let model = null, picked = null, snapshot = null   // snapshot: { id, locale, mode, keys, rows: { [nodeId]: { [key]: value } } }

function log(text, cls) { const d = document.createElement('div'); d.textContent = text; if (cls) d.className = cls; $('log').prepend(d) }
async function api(path, opts = {}) {
  const res = await fetch(base + path, { ...opts, headers: { 'Content-Type': 'application/json', 'X-Actor': $('actor').value.trim(), ...($('token')?.value.trim() ? { Authorization: 'Bearer ' + $('token').value.trim() } : {}), ...(opts.headers || {}) } })
  const text = await res.text(); const data = text ? JSON.parse(text) : null
  if (!res.ok) throw new Error(data?.error || `${res.status} ${res.statusText}`)
  return data
}

Office.onReady(async () => {
  $('actor').value = settings.actor
  $('actor').addEventListener('change', () => localStorage.setItem('journali.actor', $('actor').value.trim()))
  $('token').value = localStorage.getItem('journali.token') || ''
  $('token').addEventListener('change', () => localStorage.setItem('journali.token', $('token').value.trim()))
  try {
    const h = await api('/api/health'); model = await api('/api/model')
    $('status').textContent = `· #${h.head} · ${h.nodes} Knoten`
    for (const l of model.locales) { const o = document.createElement('option'); o.value = l.code; o.textContent = l.code; $('locale').append(o) }
    fillViews()
    // Blatt schon von uns beschrieben? Dann Schnappschuss aus den Einstellungen des Blatts holen
    await Excel.run(async ctx => {
      const s = ctx.workbook.settings.getItemOrNullObject('journali'); s.load('value'); await ctx.sync()
      if (!s.isNullObject && s.value) { snapshot = JSON.parse(s.value); picked = snapshot.picked; $('picked').textContent = `⇩ geladen: ${picked.label} · ${Object.keys(snapshot.rows).length} Zeilen`; $('save').disabled = false; $('reload').disabled = false; $('load').disabled = false }
    })
  } catch (e) { log('Fehler: ' + e.message, 'neg') }
})
function fillViews() {
  const mode = $('mode').value
  const level = mode === 'variants' ? 'variant' : mode === 'products' ? 'product' : (picked?.role === 'product' ? 'variant' : 'product')
  const sel = $('view'); sel.innerHTML = '<option value="">◫ alle Attribute</option>'
  for (const v of (model?.views ?? []).filter(v => v.level === level)) { const o = document.createElement('option'); o.value = v.key; o.textContent = '◫ ' + (v.label?.de || v.key); sel.append(o) }
}
$('mode').addEventListener('change', fillViews)

// ---- Knoten suchen
let timer = null
$('q').addEventListener('input', () => {
  clearTimeout(timer); const q = $('q').value.trim()
  if (q.length < 2) { $('hits').hidden = true; return }
  timer = setTimeout(async () => {
    try {
      const hits = await api(`/api/search?q=${encodeURIComponent(q)}&limit=30`)
      const box = $('hits'); box.innerHTML = ''; box.hidden = false
      const icon = { group: '▣', product: '▦', variant: '◆' }
      for (const h of hits) {
        const d = document.createElement('div'); d.className = 'hit'; d.textContent = `${icon[h.row.role] ?? ''} ${h.row.label}${h.hit && h.hit !== h.row.label ? ' — ' + h.hit : ''}`
        d.onclick = () => { picked = h.row; $('picked').textContent = `${icon[h.row.role]} ${h.row.label} (${h.row.id})`; box.hidden = true; $('load').disabled = false; fillViews() }
        box.append(d)
      }
      if (!hits.length) box.innerHTML = '<div class="hit muted">nichts</div>'
    } catch (e) { log('Suche: ' + e.message, 'neg') }
  }, 250)
})

// ---- Laden
$('load').addEventListener('click', load)
$('reload').addEventListener('click', load)
async function load() {
  if (!picked) return
  const mode = $('mode').value, locale = $('locale').value
  const q = new URLSearchParams({ locale })
  if (mode === 'variants') { q.set('role', 'variant'); q.set('deep', 'true') }
  if (mode === 'products') { q.set('role', 'product'); q.set('deep', 'true') }
  try {
    $('load').disabled = true; log('lade …')
    // seitenweise (04.10.2026): alle Varianten einer grossen Gruppe in einem Stück waren hunderte MB — der Server lehnt das jetzt ab
    const t = { rows: [], columns: [] }
    for (let skip = 0; skip != null;) { const s = await api(`/api/nodes/${picked.id}/table?${q}&take=1000&skip=${skip}`); t.columns = s.columns ?? t.columns; t.node = s.node; t.rows.push(...(s.rows ?? [])); log(`lade … ${t.rows.length}/${s.total ?? t.rows.length}`); skip = s.next != null && s.next > skip ? s.next : null }
    let cols = t.columns.filter(c => !['rows', 'formula', 'template'].includes(c.type))
    const view = (model.views ?? []).find(v => v.key === $('view').value)
    if (view) {
      const groupsOf = new Map((model.groups ?? []).map(g => [g.key, g.attributes]))
      const order = view.items.flatMap(it => it.order ?? [])
      const wanted = new Set([...order, ...view.items.flatMap(it => groupsOf.get(it.group) ?? [])])
      cols = cols.filter(c => wanted.has(c.key)).sort((a, b) => (order.indexOf(a.key) + 1 || 999) - (order.indexOf(b.key) + 1 || 999))
    }
    const keys = ['id', 'journali_label', 'sku', ...cols.map(c => c.key)]
    const labels = ['Id', 'Name', 'SKU', ...cols.map(c => (c.label?.de || c.key) + (c.perLocale ? ` (${locale})` : '') + (c.unit ? ` [${c.unit}]` : ''))]
    const rows = {}
    const values = t.rows.map(r => {
      const own = {}; const line = [r.row.id, r.row.label, r.row.sku ?? '']
      for (const c of cols) { const v = r.values[c.key]; const text = v ? (Array.isArray(v.values) ? v.values.join(', ') : (v.value ?? '')) : ''; line.push(text); own[c.key] = { value: text, own: !!v?.own } }
      rows[r.row.id] = own
      return line
    })
    await Excel.run(async ctx => {
      const sheet = ctx.workbook.worksheets.getActiveWorksheet()
      sheet.getUsedRangeOrNullObject().clear()
      const all = [keys, labels, ...values]
      const range = sheet.getRangeByIndexes(0, 0, all.length, keys.length)
      range.values = all
      range.numberFormat = all.map(row => row.map(() => '@'))   // alles Text — Excel soll keine SKU in eine Zahl verwandeln
      sheet.getRangeByIndexes(0, 0, 1, keys.length).format.font.color = '#888888'
      sheet.getRangeByIndexes(1, 0, 1, keys.length).format.font.bold = true
      sheet.getRangeByIndexes(0, 0, all.length, 1).format.font.color = '#888888'
      // geerbte Werte kursiv
      values.forEach((line, i) => cols.forEach((c, j) => { const cell = rows[line[0]][c.key]; if (cell.value && !cell.own) sheet.getCell(i + 2, 3 + j).format.font.italic = true }))
      sheet.freezePanes.freezeRows(2)
      sheet.getRangeByIndexes(0, 0, all.length, keys.length).format.autofitColumns()
      snapshot = { picked, locale, mode, keys, rows, cols: cols.map(c => ({ key: c.key, perLocale: !!c.perLocale, multiple: !!c.multiple, type: c.type })) }
      ctx.workbook.settings.add('journali', JSON.stringify(snapshot))
      await ctx.sync()
    })
    $('picked').textContent = `⇩ geladen: ${picked.label} · ${values.length} Zeilen · ${cols.length} Spalten`
    $('save').disabled = false; $('reload').disabled = false
    log(`geladen: ${values.length} Zeilen, ${cols.length} Attribute (${locale})`, 'pos')
  } catch (e) { log('Fehler: ' + e.message, 'neg') } finally { $('load').disabled = false }
}

// ---- Speichern: nur Zellen, die sich gegenüber dem Schnappschuss geändert haben
$('save').addEventListener('click', async () => {
  if (!snapshot) return
  if (!$('actor').value.trim()) { log('👤 Name fehlt', 'neg'); return }
  try {
    $('save').disabled = true
    let sheetValues
    await Excel.run(async ctx => { const r = ctx.workbook.worksheets.getActiveWorksheet().getUsedRange(); r.load('values'); await ctx.sync(); sheetValues = r.values })
    const header = sheetValues[0].map(String)
    if (header[0] !== 'id') throw new Error('Zeile 1 muss mit „id“ beginnen — das Blatt ist nicht von journali geladen')
    const colIndex = new Map(header.map((k, i) => [k, i]))
    const commands = []
    for (const line of sheetValues.slice(2)) {
      const id = String(line[0] ?? '').trim(); if (!id || !snapshot.rows[id]) continue
      for (const c of snapshot.cols) {
        const i = colIndex.get(c.key); if (i == null) continue
        const now = String(line[i] ?? '').trim(); const was = snapshot.rows[id][c.key]
        if (now === (was?.value ?? '')) continue
        if (!now && !was?.own) continue   // geerbt und leer gelassen: nichts zu tun
        const args = { node: id, attribute: c.key, locale: c.perLocale ? snapshot.locale : null }
        if (c.multiple) args.values = now.split(/[,;]\s*/).map(s => s.trim()).filter(Boolean); else args.value = now
        commands.push({ op: 'attribute.set', args })
      }
    }
    if (!commands.length) { log('nichts geändert', 'pos'); return }
    log(`schreibe ${commands.length} Zellen …`)
    const res = await api('/api/batch', { method: 'POST', body: JSON.stringify({ commands, batch: 'xl-' + Date.now().toString(36) }) })
    if (res.error) log(`✗ Befehl ${res.error.index}: ${res.error.message} — ${res.results.length} davor geschrieben`, 'neg')
    else log(`✓ ${res.results.length} Werte geschrieben (Stapel ${res.batch})`, 'pos')
    await load()   // Schnappschuss erneuern, damit der nächste Lauf nur Neues schreibt
  } catch (e) { log('Fehler: ' + e.message, 'neg') } finally { $('save').disabled = false }
})
