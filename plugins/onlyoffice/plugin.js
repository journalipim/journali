// journali OnlyOffice-Plugin (Tabellen): Seitenleiste, spricht mit /api des eingetragenen Servers.
// Zellen schreibt/liest der Editor über Asc.plugin.callCommand (läuft im Editor mit der Api des Document Builder).
// Laden: Zeile 1 Schlüssel, Zeile 2 Namen, ab Zeile 3 Daten, Spalte A Id; Schnappschuss als JSON im versteckten Blatt _journali.
/* global Asc, window */
const $ = id => document.getElementById(id)
let model = null, picked = null, snapshot = null

function log(text, cls) { const d = document.createElement('div'); d.textContent = text; if (cls) d.className = cls; $('log').prepend(d) }
const server = () => $('server').value.trim().replace(/\/+$/, '') || (location.protocol.startsWith('http') ? location.origin : 'http://localhost:5000')
async function api(path, opts = {}) {
  const res = await fetch(server() + path, { ...opts, headers: { 'Content-Type': 'application/json', 'X-Actor': $('actor').value.trim(), ...(opts.headers || {}) } })
  const text = await res.text(); const data = text ? JSON.parse(text) : null
  if (!res.ok) throw new Error(data?.error || `${res.status} ${res.statusText}`)
  return data
}
// Befehl im Editor ausführen; Asc.scope trägt die Daten hinüber, das Ergebnis kommt per Callback zurück
function command(fn, data) {
  return new Promise(resolve => { Asc.scope.data = data ?? null; Asc.plugin.callCommand(fn, false, true, resolve) })
}

window.Asc.plugin.init = async function () {
  $('server').value = localStorage.getItem('journali.server') || server()
  $('actor').value = localStorage.getItem('journali.actor') || ''
  $('server').addEventListener('change', () => { localStorage.setItem('journali.server', $('server').value.trim()); connect() })
  $('actor').addEventListener('change', () => localStorage.setItem('journali.actor', $('actor').value.trim()))
  await connect()
  // Schnappschuss aus dem versteckten Blatt holen (Datei wurde schon einmal von uns beschrieben)
  const stored = await command(function () {
    var ws = Api.GetSheet('_journali'); if (!ws) return null
    return ws.GetRange('A1').GetValue()
  })
  if (stored) { try { snapshot = JSON.parse(stored); picked = snapshot.picked; $('picked').textContent = `⇩ geladen: ${picked.label} · ${Object.keys(snapshot.rows).length} Zeilen`; $('save').disabled = false; $('reload').disabled = false; $('load').disabled = false } catch { /* kein gültiger Schnappschuss */ } }
}
window.Asc.plugin.button = function () { this.executeCommand('close', '') }

async function connect() {
  try {
    const h = await api('/api/health'); model = await api('/api/model')
    $('status').textContent = `· #${h.head} · ${h.nodes} Knoten`
    const sel = $('locale'); sel.innerHTML = ''
    for (const l of model.locales) { const o = document.createElement('option'); o.value = l.code; o.textContent = l.code; sel.append(o) }
    fillViews()
  } catch (e) { $('status').textContent = ''; log('Server: ' + e.message, 'neg') }
}
function fillViews() {
  const mode = $('mode').value
  const level = mode === 'variants' ? 'variant' : mode === 'products' ? 'product' : (picked?.role === 'product' ? 'variant' : 'product')
  const sel = $('view'); sel.innerHTML = '<option value="">◫ alle Attribute</option>'
  for (const v of (model?.views ?? []).filter(v => v.level === level)) { const o = document.createElement('option'); o.value = v.key; o.textContent = '◫ ' + (v.label?.de || v.key); sel.append(o) }
}
$('mode').addEventListener('change', fillViews)

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
    const t = await api(`/api/nodes/${picked.id}/table?${q}`)
    let cols = t.columns.filter(c => !['rows', 'formula'].includes(c.type))
    const view = (model.views ?? []).find(v => v.key === $('view').value)
    if (view) {
      const groupsOf = new Map((model.groups ?? []).map(g => [g.key, g.attributes]))
      const order = view.items.flatMap(it => it.order ?? [])
      const wanted = new Set([...order, ...view.items.flatMap(it => groupsOf.get(it.group) ?? [])])
      cols = cols.filter(c => wanted.has(c.key)).sort((a, b) => (order.indexOf(a.key) + 1 || 999) - (order.indexOf(b.key) + 1 || 999))
    }
    const keys = ['id', 'journali_label', 'sku', ...cols.map(c => c.key)]
    const labels = ['Id', 'Name', 'SKU', ...cols.map(c => (c.label?.de || c.key) + (c.perLocale ? ` (${locale})` : '') + (c.unit ? ` [${c.unit}]` : ''))]
    const rows = {}; const italic = []
    const values = t.rows.map((r, i) => {
      const own = {}; const line = [r.row.id, r.row.label, r.row.sku ?? '']
      cols.forEach((c, j) => { const v = r.values[c.key]; const text = v ? (Array.isArray(v.values) ? v.values.join(', ') : (v.value ?? '')) : ''; line.push(text); own[c.key] = { value: text, own: !!v?.own }; if (text && !v?.own) italic.push([i + 2, 3 + j]) })
      rows[r.row.id] = own
      return line
    })
    snapshot = { picked, locale, mode, keys, rows, cols: cols.map(c => ({ key: c.key, perLocale: !!c.perLocale, multiple: !!c.multiple, type: c.type })) }
    await command(function () {
      var d = Asc.scope.data
      var col = function (n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26 } return s }
      var ws = Api.GetActiveSheet()
      var all = [d.keys, d.labels].concat(d.values)
      var w = d.keys.length, last = col(w - 1)
      var used = ws.GetUsedRange(); if (used) used.Clear()
      var range = ws.GetRange('A1:' + last + all.length)
      range.SetNumberFormat('@')
      try { range.SetValue(all) }   // Bereich auf einmal (neuere Builder-Api) …
      catch (e) { for (var r = 0; r < all.length; r++) for (var c = 0; c < w; c++) ws.GetRangeByNumber(r, c).SetValue(all[r][c]) }   // … sonst Zelle für Zelle
      ws.GetRange('A1:' + last + '1').SetFontColor(Api.CreateColorFromRGB(136, 136, 136))
      ws.GetRange('A2:' + last + '2').SetBold(true)
      for (var i = 0; i < d.italic.length; i++) ws.GetRangeByNumber(d.italic[i][0], d.italic[i][1]).SetItalic(true)
      ws.GetRange('A1:' + last + '1').SetColumnWidth(14)
      var hidden = Api.GetSheet('_journali')
      if (!hidden) { Api.AddSheet('_journali'); hidden = Api.GetSheet('_journali'); hidden.SetVisible(false); ws.SetActive() }
      hidden.GetRange('A1').SetValue(d.snapshot)
      return all.length
    }, { keys, labels, values: values.map(row => row.map(v => v == null ? '' : String(v))), italic, snapshot: JSON.stringify(snapshot) })
    $('picked').textContent = `⇩ geladen: ${picked.label} · ${values.length} Zeilen · ${cols.length} Spalten`
    $('save').disabled = false; $('reload').disabled = false
    log(`geladen: ${values.length} Zeilen, ${cols.length} Attribute (${locale})`, 'pos')
  } catch (e) { log('Fehler: ' + e.message, 'neg') } finally { $('load').disabled = false }
}

$('save').addEventListener('click', async () => {
  if (!snapshot) return
  if (!$('actor').value.trim()) { log('👤 Name fehlt', 'neg'); return }
  try {
    $('save').disabled = true
    const sheetValues = await command(function () {
      var ws = Api.GetActiveSheet(); var r = ws.GetUsedRange(); if (!r) return []
      var v = r.GetValue(); return Array.isArray(v) && Array.isArray(v[0]) ? v : [[v]]
    })
    const header = (sheetValues[0] || []).map(String)
    if (header[0] !== 'id') throw new Error('Zeile 1 muss mit „id“ beginnen — das Blatt ist nicht von journali geladen')
    const colIndex = new Map(header.map((k, i) => [k, i]))
    const commands = []
    for (const line of sheetValues.slice(2)) {
      const id = String(line[0] ?? '').trim(); if (!id || !snapshot.rows[id]) continue
      for (const c of snapshot.cols) {
        const i = colIndex.get(c.key); if (i == null) continue
        const now = String(line[i] ?? '').trim(); const was = snapshot.rows[id][c.key]
        if (now === (was?.value ?? '')) continue
        if (!now && !was?.own) continue
        const args = { node: id, attribute: c.key, locale: c.perLocale ? snapshot.locale : null }
        if (c.multiple) args.values = now.split(/[,;]\s*/).map(s => s.trim()).filter(Boolean); else args.value = now
        commands.push({ op: 'attribute.set', args })
      }
    }
    if (!commands.length) { log('nichts geändert', 'pos'); return }
    log(`schreibe ${commands.length} Zellen …`)
    const res = await api('/api/batch', { method: 'POST', body: JSON.stringify({ commands, batch: 'oo-' + Date.now().toString(36) }) })
    if (res.error) log(`✗ Befehl ${res.error.index}: ${res.error.message} — ${res.results.length} davor geschrieben`, 'neg')
    else log(`✓ ${res.results.length} Werte geschrieben (Stapel ${res.batch})`, 'pos')
    await load()
  } catch (e) { log('Fehler: ' + e.message, 'neg') } finally { $('save').disabled = false }
})
