// JSON-Import-Manager (Taloan, 18.09.2026: „wie der IXP-Import: JSON analysieren, zeigen, was drin ist — neue Attribute,
// neue Gruppen — anlegen oder auf Bestehendes mappen, nach Möglichkeit automatisch nach best guess, und sagen, wo die
// Struktur ansetzt“). Liest das Rohdaten-Format ({ model, node } aus dem Export) — ein Teilbaum aus einem anderen
// journali oder aus einem Fremdsystem, das dieses Format schreibt. Schritte: 1 Datei · 2 Modell zuordnen · 3 Ziel · 4 Einspielen.
// Der Server (POST /api/nodes/import mit map) schreibt die Zuordnung um und legt nur an, was auf „neu“ steht.

function el(tag, attrs = {}, ...kids) { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v) } for (const k of kids) e.append(k); return e }
const ICON = { group: '▣', product: '▦', variant: '◆' }
const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9äöüß]+/g, '')
const TYPE_SYM = { text: 'Aa', html: '‹›', integer: '12', decimal: '1.5', boolean: '☑', date: '📅', enum: '☰', rows: '≣', formula: 'ƒ', template: '{}' }

// Best guess: gleicher Key → sicher; gleiches Label (irgendeine Sprache) → sicher; Key ohne Präfix/Trenner gleich → Vorschlag; sonst neu
function guess(key, label, type, candidates) {
  const exact = candidates.find(c => c.key === key); if (exact) return { to: exact.key, why: 'gleicher Key', sure: true }
  const labels = Object.values(label ?? {}).map(norm).filter(Boolean)
  const byLabel = candidates.find(c => Object.values(c.label ?? {}).some(l => labels.includes(norm(l)))); if (byLabel) return { to: byLabel.key, why: 'gleiche Bezeichnung', sure: true }
  const nk = norm(key)
  const loose = candidates.find(c => norm(c.key) === nk || norm(c.key).endsWith(nk) || nk.endsWith(norm(c.key)))
  if (loose && (!type || !loose.type || loose.type === type)) return { to: loose.key, why: 'ähnlicher Key', sure: false }
  return { to: '', why: 'neu', sure: false }
}

export async function mountManager(root, ctx) {
  const { store, tree, api } = ctx
  if (!tree.loaded) await tree.load()
  const model = store.model
  const st = { file: null, raw: null, node: null, count: 0, mapA: {}, mapG: {}, prefix: '', parent: null, existing: 0 }
  root.style.cssText = 'display:flex;flex-direction:column;height:100%;padding:0'
  const status = el('span', { class: 'muted' }); const say = m => status.textContent = m
  const body = el('div', { class: 'scroll', style: 'flex:1;padding:0 8px 12px' })
  root.append(el('div', { class: 'toolbar' }, el('h1', {}, '⇩ JSON-Import'), el('span', { class: 'grow' }), status), body)
  const band = t => el('div', { class: 'step-band', style: 'margin:10px -8px 6px' }, t)

  // ---- 1 Datei
  const fileIn = el('input', { type: 'file', accept: '.json,application/json', style: 'display:none' })
  fileIn.addEventListener('change', () => fileIn.files[0] && analyse(fileIn.files[0]))
  const drop = el('div', { class: 'empty', style: 'border:1px dashed var(--line);border-radius:6px;padding:18px;cursor:pointer' }, '📂 JSON wählen oder hierher ziehen — Rohdaten-Export ({ model, node }) oder ein Knotenbaum')
  drop.addEventListener('click', () => fileIn.click())
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.style.borderColor = 'var(--accent)' })
  drop.addEventListener('dragleave', () => drop.style.borderColor = 'var(--line)')
  drop.addEventListener('drop', e => { e.preventDefault(); drop.style.borderColor = 'var(--line)'; const f = e.dataTransfer.files[0]; if (f) analyse(f) })
  const s2 = el('div'), s3 = el('div'), s4 = el('div')
  body.append(band('1 · Datei'), drop, fileIn, s2, s3, s4)

  async function analyse(file) {
    let j; try { j = JSON.parse(await file.text()) } catch { store.toast('keine gültige JSON-Datei'); return }
    const node = j?.node ?? j, m = j?.model ?? { groups: [], attributes: [], lists: [], units: [] }
    if (!node?.id || !node?.role) { store.toast('Kein Knotenbaum: id und role fehlen. Für Tabellen (Listen von Objekten) gibt es ⇩ Import → Tabelle.'); return }
    st.file = file.name; st.raw = { model: m, node }
    // alles, was der Baum benutzt — auch Keys ohne Definition im Modellteil (Fremdsystem)
    const used = new Map()
    const walk = n => { for (const v of n.values ?? []) used.set(v.attribute, true); for (const k of Object.keys(n.rows ?? {})) used.set(k, true); for (const a of n.axes ?? []) used.set(a, true); if (n.labelAttribute) used.set(n.labelAttribute, true); for (const c of n.children ?? []) walk(c) }
    walk(node)
    let count = 0, existing = 0; const cnt = n => { count++; if (tree.byId.has(n.id)) existing++; for (const c of n.children ?? []) cnt(c) }; cnt(node)
    st.count = count; st.existing = existing
    const defs = new Map((m.attributes ?? []).map(a => [a.key, a]))
    for (const k of used.keys()) if (!defs.has(k)) defs.set(k, { key: k, label: {}, type: 'text', group: null, unknown: true })
    st.attrs = [...defs.values()].sort((a, b) => a.key.localeCompare(b.key))
    const groupKeys = new Set([...(m.groups ?? []).map(g => g.key), ...st.attrs.map(a => a.group).filter(Boolean)])
    const walkG = n => { for (const g of n.groups ?? []) groupKeys.add(g); for (const c of n.children ?? []) walkG(c) }; walkG(node)
    st.groups = [...groupKeys].map(k => (m.groups ?? []).find(g => g.key === k) ?? { key: k, label: {}, unknown: true }).sort((a, b) => a.key.localeCompare(b.key))
    // best guess
    st.mapA = {}; st.mapG = {}
    for (const a of st.attrs) st.mapA[a.key] = guess(a.key, a.label, a.type, model.attributes)
    for (const g of st.groups) st.mapG[g.key] = guess(g.key, g.label, null, model.groups)
    st.parent = node.parent && tree.byId.has(node.parent) ? node.parent : (tree.rows.find(r => !r.parent)?.id ?? null)
    say(`${file.name}: ${count} Knoten · ${st.attrs.length} Attribute · ${st.groups.length} Gruppen · ${(m.lists ?? []).length} Listen`)
    drawModel(); drawTarget(); drawRun()
  }

  // ---- 2 Modell zuordnen
  function drawModel() {
    s2.innerHTML = ''
    const newA = st.attrs.filter(a => !st.mapA[a.key].to).length, newG = st.groups.filter(g => !st.mapG[g.key].to).length
    s2.append(band(`2 · Modell zuordnen — ${st.attrs.length} Attribute (${newA} neu), ${st.groups.length} Gruppen (${newG} neu)`))
    const prefixIn = el('input', { type: 'text', value: st.prefix, placeholder: 'z. B. sap_', style: 'width:120px' })
    prefixIn.addEventListener('input', () => { st.prefix = prefixIn.value.trim(); drawRun() })
    s2.append(el('div', { class: 'row', style: 'display:flex;gap:8px;align-items:center;margin-bottom:6px;font-size:12px' },
      el('span', { class: 'muted' }, 'Präfix für Neues:'), prefixIn,
      el('button', { class: 'x', onclick: () => { for (const a of st.attrs) st.mapA[a.key] = { to: '', why: 'neu', sure: true }; for (const g of st.groups) st.mapG[g.key] = { to: '', why: 'neu', sure: true }; drawModel(); drawRun() }, title: 'alles neu anlegen (mit Präfix)' }, '◌ alle neu'),
      el('button', { class: 'x', onclick: () => { for (const a of st.attrs) st.mapA[a.key] = guess(a.key, a.label, a.type, model.attributes); for (const g of st.groups) st.mapG[g.key] = guess(g.key, g.label, null, model.groups); drawModel(); drawRun() }, title: 'Vorschläge wiederherstellen' }, '✨ best guess')))
    const tbl = el('table', { class: 'grid', style: 'width:100%' })
    tbl.append(el('thead', {}, el('tr', {}, el('th', {}, 'Gruppe (JSON)'), el('th', {}, 'Bezeichnung'), el('th', {}, '→ im System'), el('th', {}, ''))))
    const tbG = el('tbody')
    for (const g of st.groups) {
      const sel = el('select', { style: 'width:100%' }, el('option', { value: '' }, `◌ neu anlegen${st.prefix ? ` als ${st.prefix}${g.key}` : ''}`), ...model.groups.map(x => el('option', { value: x.key }, `▤ ${x.label?.de || x.key} ⟨${x.key}⟩`)))
      sel.value = st.mapG[g.key].to; sel.addEventListener('change', () => { st.mapG[g.key] = { to: sel.value, why: sel.value ? 'von Hand' : 'neu', sure: true }; drawRun() })
      tbG.append(el('tr', {}, el('td', { class: 'mono' }, g.key), el('td', {}, g.label?.de || g.label?.en || (g.unknown ? el('span', { class: 'muted' }, 'ohne Definition') : '')), el('td', {}, sel), el('td', { class: 'muted', style: 'font-size:11px' }, st.mapG[g.key].sure ? st.mapG[g.key].why : '? ' + st.mapG[g.key].why)))
    }
    tbl.append(tbG)
    const tbl2 = el('table', { class: 'grid', style: 'width:100%;margin-top:8px' })
    tbl2.append(el('thead', {}, el('tr', {}, el('th', {}, 'Attribut (JSON)'), el('th', {}, 'Bezeichnung'), el('th', {}, 'Typ'), el('th', {}, 'Gruppe'), el('th', {}, '→ im System'), el('th', {}, ''))))
    const tbA = el('tbody')
    for (const a of st.attrs) {
      const same = model.attributes.filter(x => !a.type || x.type === a.type), other = model.attributes.filter(x => a.type && x.type !== a.type)
      const sel = el('select', { style: 'width:100%' }, el('option', { value: '' }, `◌ neu anlegen${st.prefix ? ` als ${st.prefix}${a.key}` : ''}`),
        ...same.map(x => el('option', { value: x.key }, `${x.label?.de || x.key} ⟨${x.key}⟩`)),
        ...(other.length ? [el('optgroup', { label: 'anderer Typ' }, ...other.map(x => el('option', { value: x.key }, `${TYPE_SYM[x.type] ?? x.type} ${x.label?.de || x.key} ⟨${x.key}⟩`)))] : []))
      sel.value = st.mapA[a.key].to; sel.addEventListener('change', () => { st.mapA[a.key] = { to: sel.value, why: sel.value ? 'von Hand' : 'neu', sure: true }; drawRun() })
      const gTo = a.group ? (st.mapG[a.group]?.to || (st.prefix + a.group)) : '—'
      tbA.append(el('tr', { style: st.mapA[a.key].sure ? '' : 'background:var(--dirty)' }, el('td', { class: 'mono' }, a.key), el('td', {}, a.label?.de || a.label?.en || (a.unknown ? el('span', { class: 'muted' }, 'ohne Definition — wird Text') : '')),
        el('td', {}, `${TYPE_SYM[a.type] ?? ''} ${a.type ?? 'text'}${a.perLocale || a.axes?.includes('locale') ? ' 🗣' : ''}`), el('td', { class: 'mono muted' }, gTo), el('td', {}, sel), el('td', { class: 'muted', style: 'font-size:11px' }, st.mapA[a.key].sure ? st.mapA[a.key].why : '? ' + st.mapA[a.key].why)))
    }
    tbl2.append(tbA)
    s2.append(tbl, tbl2)
  }

  // ---- 3 Ziel
  function drawTarget() {
    s3.innerHTML = ''
    s3.append(band('3 · Ziel — wo die Struktur ansetzt'))
    const n = st.raw.node
    const inp = el('input', { type: 'search', placeholder: '🔍 Gruppe oder Produkt', style: 'width:320px', value: st.parent ? tree.byId.get(st.parent)?.label ?? '' : '(Wurzel)' })
    const pick = el('div', { class: 'picker', style: 'position:absolute;z-index:5;width:380px;display:none' })
    inp.addEventListener('input', () => { const q = inp.value.trim().toLowerCase(); pick.innerHTML = ''; const hits = q ? tree.rows.filter(r => r.role !== 'variant' && (r.label.toLowerCase().includes(q) || r.id.includes(q))).slice(0, 12) : []; for (const r of hits) pick.append(el('div', { class: 'pick', onmousedown: e => { e.preventDefault(); st.parent = r.id; inp.value = r.label; pick.style.display = 'none'; drawRun() } }, `${ICON[r.role]} ${r.label}`)); pick.style.display = hits.length ? 'block' : 'none' })
    inp.addEventListener('blur', () => setTimeout(() => pick.style.display = 'none', 150))
    const rootBtn = el('button', { class: 'x', onclick: () => { st.parent = null; inp.value = '(Wurzel)'; drawRun() }, title: 'als eigene Wurzel — nur für Produktgruppen' }, '⌂ Wurzel')
    s3.append(el('div', { style: 'display:flex;gap:8px;align-items:center;font-size:12px' }, el('span', {}, `${ICON[n.role]} ${n.name ?? n.id}${st.count > 1 ? ` mit ${st.count - 1} darunter` : ''} →`), el('span', { style: 'position:relative' }, inp, pick), n.role === 'group' ? rootBtn : ''))
    s3.append(el('div', { class: 'muted', style: 'font-size:12px;margin-top:6px' }, st.existing ? `${st.existing} der ${st.count} Knoten gibt es hier schon (gleiche Id) — sie werden angeglichen, nicht verdoppelt; zurückgezogene kommen zurück.` : 'Kein Knoten mit diesen Ids im System — alles wird neu angelegt (neue Ids).'))
  }

  // ---- 4 Einspielen
  function drawRun() {
    s4.innerHTML = ''
    const newA = st.attrs.filter(a => !st.mapA[a.key].to), newG = st.groups.filter(g => !st.mapG[g.key].to)
    const unsure = st.attrs.filter(a => !st.mapA[a.key].sure).length
    s4.append(band('4 · Einspielen'))
    s4.append(el('div', { class: 'muted', style: 'font-size:12px;line-height:1.6' },
      `${st.count} Knoten → ${st.parent ? tree.byId.get(st.parent)?.label : 'Wurzel'} · neu im Modell: ${newG.length} Gruppen, ${newA.length} Attribute${st.prefix ? ` (Präfix ${st.prefix})` : ''}${unsure ? ` · ${unsure} unsichere Zuordnungen (gelb) — bitte prüfen` : ''} · ein Stapel, rückgängig im Journal`))
    s4.append(el('button', { class: 'primary', style: 'margin-top:6px', onclick: run }, `⇩ ${st.count} Knoten einspielen`))
  }
  async function run() {
    const mapA = Object.fromEntries(Object.entries(st.mapA).map(([k, v]) => [k, v.to])), mapG = Object.fromEntries(Object.entries(st.mapG).map(([k, v]) => [k, v.to]))
    const ok = await ctx.dialog.confirm({ title: `${st.count} Knoten aus ${st.file} einspielen?`, warn: `${st.attrs.filter(a => !mapA[a.key]).length} neue Attribute, ${st.groups.filter(g => !mapG[g.key]).length} neue Gruppen im Modell`, ok: '⇩ Einspielen' })
    if (!ok) return
    try {
      say('spiele ein …')
      const r = await api.post('/api/nodes/import', { node: st.raw.node, model: st.raw.model, parent: st.parent, map: { attributes: mapA, groups: mapG, prefix: st.prefix } })
      say(`✓ ${r.created} neu · ${r.restored} zurückgeholt · ${r.updated} angeglichen · ${r.model} Modellteile · ${r.entries} Einträge (Stapel ${r.batch})${r.errors?.length ? ` · ${r.errors.length} Fehler: ${r.errors[0]}` : ''}`)
      store.toast(`⇩ ${r.entries} Einträge — ${r.created} neu, ${r.restored} zurückgeholt, ${r.updated} angeglichen`, r.errors?.length ? 'error' : 'ok')
      await store.poll(true); await tree.load()
      const first = r.idMap?.[st.raw.node.id] ?? st.raw.node.id
      if (tree.byId.has(first)) ctx.go?.(`/tree/${first}`)
    } catch (e) { say('✗ ' + e.message); store.toast(e.message) }
  }
}
