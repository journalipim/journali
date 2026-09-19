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
  const st = { file: null, raw: null, node: null, count: 0, mapA: {}, mapG: {}, prefix: '', parent: null, existing: 0, missing: [], attachMissing: true }
  // Zielgruppen wie der Server (TransferApi.Remap G()): zugeordnet → Ziel; im Modell → gleich; sonst Präfix + Key
  const G = k => st.mapG[k]?.to || (model.groups.some(g => g.key === k) ? k : st.prefix + k)
  // Welche Attributgruppen brauchen die Werte des Baums — und welche davon gelten am Ziel nicht? (Taloan, 18.09.: der Import
  // warnte nicht, danach waren etliche Werte verwaist.) Am Ziel gelten: die Gruppen am Zielknoten und seinem Pfad; dazu
  // die, die der importierte Wurzelknoten selbst mitbringt.
  async function findMissing() {
    st.missing = []
    if (!st.raw) return
    const used = new Set(); const walk = n => { for (const v of n.values ?? []) used.add(v.attribute); for (const k of Object.keys(n.rows ?? {})) used.add(k); for (const c of n.children ?? []) walk(c) }; walk(st.raw.node)
    const need = new Map()   // Zielgruppe → Attribute
    for (const a of used) {
      const to = st.mapA[a]?.to
      const rawG = to ? null : st.attrs.find(x => x.key === a)?.group ?? null
      const g = to ? model.attributes.find(x => x.key === to)?.group : (rawG ? G(rawG) : null)
      if (!g) continue
      if (!need.has(g)) need.set(g, { raw: rawG, attrs: [] }); need.get(g).attrs.push(to || st.prefix + a)
    }
    let have = new Set((st.raw.node.groups ?? []).map(G))
    if (st.parent) { try { const n = await api.get(`/api/nodes/${encodeURIComponent(st.parent)}`); for (const g of n.groups ?? []) have.add(g.key) } catch {} }
    st.missing = [...need].filter(([g]) => !have.has(g)).map(([g, x]) => ({ group: g, raw: x.raw, attrs: x.attrs }))
  }
  root.style.cssText = 'display:flex;flex-direction:column;height:100%;padding:0'
  const status = el('span', { class: 'muted' }); const say = m => status.textContent = m
  const body = el('div', { class: 'scroll', style: 'flex:1;padding:0 8px 12px' })
  // Profil (Taloan: „als Job einrichten“): Zuordnung, Präfix, Ziel unter profile:<name> im Journal — der Job (job.mjs) nimmt es
  const profSel = el('select', {}, el('option', { value: '' }, '— Profil —'))
  const profIn = el('input', { type: 'text', placeholder: 'Name', style: 'width:110px' })
  async function loadProfiles() { try { const names = (await ctx.data.list()).filter(n => n.startsWith('profile:')).map(n => n.slice(8)); profSel.innerHTML = ''; profSel.append(el('option', { value: '' }, '— Profil —'), ...names.map(n => el('option', { value: n }, n))) } catch {} }
  profSel.addEventListener('change', async () => { const n = profSel.value; if (!n) return; const p = await ctx.data.get('profile:' + n); if (!p) return; st.prefix = p.prefix ?? ''; if (p.parent && tree.byId.has(p.parent)) st.parent = p.parent; if (st.raw) { for (const [k, v] of Object.entries(p.mapA ?? {})) if (st.mapA[k]) st.mapA[k] = { to: v, why: 'Profil', sure: true }; for (const [k, v] of Object.entries(p.mapG ?? {})) if (st.mapG[k]) st.mapG[k] = { to: v, why: 'Profil', sure: true }; drawModel(); drawTarget(); drawRun() } profIn.value = n; store.toast(`Profil „${n}“ geladen`, 'ok') })
  async function saveProfile() {
    const n = (profIn.value || profSel.value).trim(); if (!n) { store.toast('Profilname fehlt'); return }
    const mapA = Object.fromEntries(Object.entries(st.mapA).map(([k, v]) => [k, v.to])), mapG = Object.fromEntries(Object.entries(st.mapG).map(([k, v]) => [k, v.to]))
    await ctx.data.set('profile:' + n, { mapA, mapG, prefix: st.prefix, parent: st.parent }); await loadProfiles(); profSel.value = n; store.toast(`Profil „${n}“ gespeichert — als Job: ⏱ Jobs → + Job → Import: JSON`, 'ok')
  }
  const jobBtn = el('button', { class: 'x', title: 'diesen Import als Job einrichten (Profil speichern, dann ⏱ Jobs → + Job mit Plugin Import: JSON)', onclick: async () => { if (!(profIn.value || profSel.value).trim()) { store.toast('erst ein Profil benennen und speichern'); return } await saveProfile(); ctx.go?.('/jobs?new=json') } }, '⏱ als Job einrichten')
  const manageBtn = el('button', { class: 'x', title: 'die JSON-Import-Jobs unter ⏱ Jobs — Zeitplan, Läufe, Logs', onclick: () => ctx.go?.('/jobs?plugin=json') }, '⏱ Jobs verwalten')
  root.append(el('div', { class: 'toolbar' }, el('h1', {}, '⇩ JSON-Import'), el('span', { class: 'sep' }, '·'), profSel, profIn, el('button', { class: 'x', title: 'Zuordnung, Präfix und Ziel als Profil speichern', onclick: saveProfile }, '💾'), jobBtn, manageBtn, el('span', { class: 'grow' }), status), body)
  loadProfiles()
  const band = t => el('div', { class: 'step-band', style: 'margin:10px -8px 6px' }, t)

  // ---- 1 Datei
  const fileIn = el('input', { type: 'file', accept: '.json,.gz,application/json,application/gzip', style: 'display:none' })
  fileIn.addEventListener('change', () => fileIn.files[0] && analyse(fileIn.files[0]))
  const drop = el('div', { class: 'empty', style: 'border:1px dashed var(--line);border-radius:6px;padding:18px;cursor:pointer' }, '📂 JSON wählen oder hierher ziehen — Rohdaten-Export ({ model, node }), auch .json.gz aus der Sicherung')
  drop.addEventListener('click', () => fileIn.click())
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.style.borderColor = 'var(--accent)' })
  drop.addEventListener('dragleave', () => drop.style.borderColor = 'var(--line)')
  drop.addEventListener('drop', e => { e.preventDefault(); drop.style.borderColor = 'var(--line)'; const f = e.dataTransfer.files[0]; if (f) analyse(f) })
  const s2 = el('div'), s3 = el('div'), s4 = el('div')
  body.append(band('1 · Datei'), drop, fileIn, s2, s3, s4)
  // vom Baum (Drop auf einen Knoten), aus dem Menü oder vom Tabellenimport übergeben: gleich analysieren, Ziel steht schon
  if (store.pendingImport?.file) { const p = store.pendingImport; store.pendingImport = null; await analyse(p.file, p.parent) }

  async function analyse(file, presetParent = null) {
    // .json.gz (Sicherung mit Kompression): im Browser entpacken
    let j; try { const text = /\.gz$/i.test(file.name) ? await new Response(file.stream().pipeThrough(new DecompressionStream('gzip'))).text() : await file.text(); j = JSON.parse(text) } catch { store.toast('keine gültige JSON-Datei (oder .gz nicht lesbar)'); return }
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
    st.parent = presetParent && tree.byId.has(presetParent) ? presetParent : node.parent && tree.byId.has(node.parent) ? node.parent : (tree.rows.find(r => !r.parent)?.id ?? null)
    say(`${file.name}: ${count} Knoten · ${st.attrs.length} Attribute · ${st.groups.length} Gruppen · ${(m.lists ?? []).length} Listen`)
    drawModel(); drawTarget(); await findMissing(); drawRun()
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
    // Zielbaum (Taloan: „wie kommt ein Anwender an die Id?“): Gruppen und Produkte als Baum, Klick wählt; Varianten sind kein Ziel
    const open = new Set((st.parent ? [...tree.ancestors(st.parent).map(a => a.id), st.parent] : []).concat(tree.rows.filter(r => !r.parent).map(r => r.id)))
    const box = el('div', { style: 'margin-top:4px;width:min(520px,100%)' })
    const roles = n.role === 'variant' ? ['product'] : ['group']
    const shownTarget = el('b', {}, st.parent ? tree.byId.get(st.parent)?.label ?? st.parent : 'Wurzel')
    ctx.treePicker(box, { value: st.parent, roles, height: 260, allowRoot: n.role === 'group', onPick: r => { st.parent = r?.id ?? null; shownTarget.textContent = r ? r.label : 'Wurzel'; drawRun() } })
    const rootBtn = el('button', { class: 'x', style: 'margin-top:4px', onclick: async () => { st.parent = null; drawTarget(); await findMissing(); drawRun() }, title: 'als eigene Wurzel — nur für Produktgruppen' }, '⌂ als Wurzel')
    s3.append(el('div', { style: 'font-size:12px' }, `${ICON[n.role]} ${n.name ?? n.id}${st.count > 1 ? ` mit ${st.count - 1} darunter` : ''} → `, shownTarget), box)
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
    // Verwaiste Werte: die Warnung samt Schalter steht im Dialog beim Einspielen (Taloan, 18.09.: wie beim Umhängen im Baum)
    s4.append(el('button', { class: 'primary', style: 'margin-top:6px', onclick: run }, `⇩ ${st.count} Knoten einspielen`))
  }
  async function run() {
    const mapA = Object.fromEntries(Object.entries(st.mapA).map(([k, v]) => [k, v.to])), mapG = Object.fromEntries(Object.entries(st.mapG).map(([k, v]) => [k, v.to]))
    const newA = st.attrs.filter(a => !mapA[a.key]).map(a => st.prefix + a.key), newG = st.groups.filter(g => !mapG[g.key]).map(g => st.prefix + g.key)
    const target = st.parent ? tree.byId.get(st.parent)?.label ?? st.parent : 'Wurzel'
    const list = []
    if (newA.length) list.push(`${newA.length} neue Attribute im Modell: ${newA.join(', ')}`)
    if (newG.length) list.push(`${newG.length} neue Gruppen im Modell: ${newG.join(', ')}`)
    // derselbe Dialog wie beim Umhängen im Baum (orphans.js): rot das Wesentliche, dann fehlende Gruppen mit Schalter „anhängen“
    const res = await ctx.orphans.confirmMove({
      title: `${st.count} Knoten aus ${st.file} → ${target}`,
      warn: `${st.count - st.existing} Knoten neu${st.existing ? `, ${st.existing} angeglichen` : ''} · ${newA.length} Attribute, ${newG.length} Gruppen neu im Modell`,
      text: list.join('\n') || 'Nichts Neues im Modell — nur Knoten und Werte.',
      missing: st.missing, rootLabel: `${ICON[st.raw.node.role]} ${st.raw.node.name ?? st.raw.node.id}`, ok: '⇩ Einspielen' })
    if (!res) return
    st.attachMissing = res.attach
    try {
      say('spiele ein …')
      // fehlende Gruppen an den importierten Wurzelknoten (Zielschlüssel; der Server lässt Modellschlüssel unverändert)
      const node = st.missing.length && st.attachMissing ? { ...st.raw.node, groups: [...new Set([...(st.raw.node.groups ?? []), ...st.missing.map(m => model.groups.some(x => x.key === m.group) ? m.group : (m.raw ?? m.group))])] } : st.raw.node
      const r = await api.post('/api/nodes/import', { node, model: st.raw.model, parent: st.parent, map: { attributes: mapA, groups: mapG, prefix: st.prefix } })
      say(`✓ ${r.created} neu · ${r.restored} zurückgeholt · ${r.updated} angeglichen · ${r.model} Modellteile · ${r.entries} Einträge (Stapel ${r.batch})${r.errors?.length ? ` · ${r.errors.length} Fehler: ${r.errors[0]}` : ''}`)
      store.toast(`⇩ ${r.entries} Einträge — ${r.created} neu, ${r.restored} zurückgeholt, ${r.updated} angeglichen`, r.errors?.length ? 'error' : 'ok')
      await store.poll(true); await tree.load()
      const first = r.idMap?.[st.raw.node.id] ?? st.raw.node.id
      if (tree.byId.has(first)) ctx.go?.(`/tree/${first}`)
    } catch (e) { say('✗ ' + e.message); store.toast(e.message) }
  }
}
