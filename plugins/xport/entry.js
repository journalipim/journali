// Plugin xport (Taloan, 19.09.2026: BMEcat/ETIM — „viele gehen nach Standard, verschiedene Versionen, und Kunden haben eigene
// Definitionen“): Export mit Vorlage. Die Vorlage ist Daten (Text mit {feldern}, Schleifen, [optional]) und steht mit
// Zuordnung, Kopfwerten, ETIM-Attributen, Teilbaum und Sprache in einem Profil (profile:<name> im Journal). Die Ansicht macht
// die Vorschau (erste Produkte) und lädt herunter; der Job (job.mjs) schreibt dasselbe Profil regelmäßig in ein Verzeichnis.
// Startvorlagen unter templates/: BMEcat 2005 mit ETIM-Attributen, Google Merchant, JSON. Der Kern (core.mjs) ist DOM-frei.
import { render, build, needs } from './core.mjs'
const L = l => globalThis.journali?.L ? globalThis.journali.L(l) : (l?.de ?? Object.values(l ?? {})[0] ?? '')   // Bezeichnung in der Oberflächensprache
const t_ = (k, p) => globalThis.journali?.t ? globalThis.journali.t(k, p) : String(k).replace(/\{(\w+)\}/g, (m, i) => p?.[i] ?? m)   // Oberflächensprache: spät gebunden, im Test ohne Fenster ladbar

function el(tag, attrs = {}, ...kids) { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'class') e.className = v; else e.setAttribute(k, v) } for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : String(c)); return e }
const download = (text, name, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000) }
const ICON = { group: '▣', product: '▦', variant: '◆' }
const MIME = { xml: 'application/xml', json: 'application/json', csv: 'text/csv', text: 'text/plain' }
const STARTERS = [
  { key: 'bmecat-etim5', label: t_('ETIM BMEcat 5.0 (Guideline, XSD-konform)'), file: 'bmecat-etim5.xml', mode: 'xml', fileName: 'bmecat-etim-{date}.xml' },
  { key: 'bmecat2005', label: t_('BMEcat 2005 mit Gruppen + ETIM'), file: 'bmecat2005.xml', mode: 'xml', fileName: 'bmecat-{date}.xml' },
  { key: 'google', label: t_('Google Merchant (RSS)'), file: 'google-merchant.xml', mode: 'xml', fileName: 'merchant-{locale}.xml' },
  { key: 'json', label: 'JSON-Liste', file: 'products.json', mode: 'json', fileName: 'products-{locale}.json' },
]
// beste Vermutung für die Zuordnung: Feldname der Vorlage → Attribut (Schlüssel oder Bezeichnung)
const GUESS = {   // Felder (f.*) → Attribut, Schlüssel oder Bezeichnung; $sku/$name/$id sind Knotenfelder

  sku: ['$sku'], name: ['$name'], title: ['$name', 'title', 'titel', 'name'], short: ['short', 'kurz', 'description_short', 'kurztext'], long: ['long', 'lang', 'description_long', 'beschreibung', 'description', 'langtext'],
  description: ['description', 'beschreibung', 'long', 'langtext'], keywords: ['keyword', 'schlagw', 'stichw', 'tags'], manufacturer: ['manufacturer', 'hersteller', 'brand', 'marke'], brand: ['brand', 'marke', 'manufacturer', 'hersteller'],
  manufacturerPid: ['manufacturer_pid', 'herstellernummer', 'mpn', 'hersteller_nr'], mpn: ['mpn', 'manufacturer_pid', 'herstellernummer'], ean: ['ean', 'gtin'], gtin: ['gtin', 'ean'], price: ['price', 'preis'], vat: ['vat', 'mwst', 'tax', 'steuer'],
  orderUnit: ['order_unit', 'bestelleinheit', 'einheit', 'unit'], contentUnit: ['content_unit', 'inhaltseinheit'], etimClass: ['etim', 'klasse', 'class'], availability: ['availability', 'verfuegbar', t_('verfügbar'), 'lieferbar'], condition: ['condition', 'zustand'], link: ['url', 'link'], image: ['bild', 'image'],
}

async function mount(root, ctx) {
  const { api, store, tree } = ctx
  if (!tree.loaded) await tree.load()
  const model = store.model
  const attrs = model.attributes.filter(a => a.type !== 'rows')
  const lbl = a => a.label?.[model.masterLocale] || L(a.label) || a.key
  // pub: Publikationsbaum als Quelle (Taloan, 22.09.: „der BMEcat-Export setzt auf einen Publikationsbaum auf“) — dann zählt root nicht;
  // rules: Regeln der Ausleitung für ETIM (unbekannt, Klasse Pflicht, Vollständigkeit, streng) — im Profil, nicht im ETIM-Plugin
  const RULES = { unknownAs: 'UN', requireClass: false, minCompleteness: 0, strict: false }
  const st = { name: '', template: '', mode: 'xml', fileName: 'export-{date}.xml', etim: true, root: localStorage.getItem('journali.xport.root') || tree.rows.find(r => !r.parent)?.id, pub: localStorage.getItem('journali.xport.pub') || '', role: 'product', locale: model.masterLocale ?? 'de', mapping: {}, vars: {}, features: [], starter: '', rules: { ...RULES } }
  let pubTrees = []; try { pubTrees = await api.get('/api/pub') } catch { }
  root.style.cssText = 'display:flex;flex-direction:column;height:100%;padding:0'
  const status = el('span', { class: 'muted' }); const say = m => status.textContent = m

  // Profile (Taloan: als Job einrichten → Profil speichern, der Job nimmt den Namen)
  const profSel = el('select', { title: t_('gespeichertes Profil laden') }); const profIn = el('input', { placeholder: t_('Profil'), style: 'width:130px', title: t_('Name des Profils — der Job (⏱ Jobs → Export: Vorlage) nimmt ihn') })
  async function loadProfiles(keep) { const names = (await ctx.data.list().catch(() => [])).filter(n => n.startsWith('profile:')).map(n => n.slice(8)); profSel.innerHTML = ''; profSel.append(el('option', { value: '' }, names.length ? t_('— Profil —') : t_('— kein Profil —'))); for (const n of names) profSel.append(el('option', { value: n }, n)); if (keep) profSel.value = keep }
  profSel.addEventListener('change', async () => { const n = profSel.value; if (!n) return; const p = await ctx.data.get('profile:' + n); if (!p) return; Object.assign(st, { name: n, template: p.template ?? '', mode: p.mode ?? 'xml', fileName: p.fileName ?? st.fileName, root: p.root || st.root, pub: p.pub ?? '', role: p.role ?? 'product', locale: p.locale ?? st.locale, mapping: p.mapping ?? {}, vars: p.vars ?? {}, features: p.features ?? [], starter: p.starter ?? '', etim: p.etim !== false, rules: { ...RULES, ...(p.rules ?? {}) } }); profIn.value = n; tplBox.value = st.template; picker.set(st.root); drawSettings(); say(`Profil „${n}“ geladen`) })
  async function saveProfile() {
    const n = (profIn.value || profSel.value).trim(); if (!n) { store.toast(t_('Profil benennen')); return null }
    st.name = n; st.template = tplBox.value
    await ctx.data.set('profile:' + n, { template: st.template, mode: st.mode, fileName: st.fileName, root: st.root, pub: st.pub || null, role: st.role, locale: st.locale, mapping: st.mapping, vars: st.vars, features: st.features, starter: st.starter, etim: st.etim, rules: st.rules })
    await loadProfiles(n); say(`Profil „${n}“ gespeichert`); return n
  }
  const saveBtn = el('button', { class: 'x', title: t_('Vorlage, Zuordnung, Kopfwerte, Teilbaum und Sprache als Profil speichern'), onclick: saveProfile }, '⎘ speichern')
  const delBtn = el('button', { class: 'x', title: t_('dieses Profil entfernen'), onclick: async () => { const n = profSel.value; if (!n || !(await ctx.dialog.confirm({ title: `Profil „${n}“ entfernen?`, ok: 'entfernen', danger: true }))) return; await ctx.data.del('profile:' + n); profIn.value = ''; await loadProfiles(); say(`Profil „${n}“ entfernt`) } }, '✕')
  const jobBtn = el('button', { class: 'x', title: t_('diesen Export als Job einrichten — Profil speichern, dann der Assistent unter ⏱ Jobs'), onclick: async () => { const n = await saveProfile(); if (n) ctx.go?.('/p/tasker/jobs?new=xport&service=export') } }, t_('⏱ als Job'))
  const manageBtn = el('button', { class: 'x', title: t_('die Vorlagen-Export-Jobs unter ⏱ Jobs — Zeitplan, Läufe, Logs'), onclick: () => ctx.go?.('/p/tasker/jobs?plugin=xport') }, t_('⏱ Jobs verwalten'))

  // Vorlage: Textfeld rechts oben, Vorschau darunter
  const tplBox = el('textarea', { class: 'mono', spellcheck: 'false', style: 'flex:1;min-height:120px;margin:0;padding:8px;font-size:11px;border:0;border-bottom:1px solid var(--line);resize:none;background:var(--pane);color:var(--text);white-space:pre;overflow:auto', placeholder: 'Vorlage — {feld}, {f.zuordnung|plain}, [ optional ], {#products} … {/products}, {#media} … {/media}, {#features} … {/features}, {#rows.attribut} … {/rows.attribut}' })
  tplBox.addEventListener('input', () => { st.template = tplBox.value; drawNeeds() })
  const preview = el('pre', { class: 'mono scroll', style: 'flex:1;margin:0;padding:8px;font-size:11px;white-space:pre-wrap;border-top:1px solid var(--line)' }, '')
  const starterSel = el('select', { style: 'width:100%', title: t_('eine Startvorlage laden — sie ersetzt den Text der Vorlage') }, el('option', { value: '' }, t_('— Startvorlage —')), ...STARTERS.map(s => el('option', { value: s.key }, s.label)))
  starterSel.addEventListener('change', async () => {
    const s = STARTERS.find(x => x.key === starterSel.value); if (!s) return
    if (tplBox.value.trim() && !(await ctx.dialog.confirm({ title: t_('Vorlage ersetzen?'), text: t_('Der Text der Vorlage wird durch die Startvorlage ersetzt.'), ok: 'ersetzen' }))) { starterSel.value = st.starter; return }
    const r = await fetch(`${ctx.plugin.base}templates/${s.file}`); st.template = await r.text(); tplBox.value = st.template; st.starter = s.key; st.mode = s.mode; st.fileName = s.fileName
    guessMapping(); drawSettings()
  })
  function guessMapping() {
    const { fields } = needs(st.template)
    for (const f of fields) {
      if (st.mapping[f]) continue
      for (const g of GUESS[f] ?? [f.toLowerCase()]) {
        if (g.startsWith('$')) { st.mapping[f] = g; break }
        const a = attrs.find(a => a.key.toLowerCase() === g) ?? attrs.find(a => a.key.toLowerCase().includes(g) || lbl(a).toLowerCase().includes(g))
        if (a) { st.mapping[f] = a.key; break }
      }
    }
  }

  // linke Spalte: Einstellungen
  const side = el('div', { class: 'scroll', style: 'width:400px;flex:none;border-right:1px solid var(--line);padding:0 0 8px' })
  const row = (label, ...kids) => el('tr', {}, el('td', { class: 'attr', style: 'color:var(--muted);white-space:nowrap;padding:2px 4px 2px 8px;width:84px;vertical-align:top' }, label), el('td', { style: 'padding:2px 4px;position:relative' }, ...kids))
  const step = (t, hint) => el('tr', { class: 'step' }, el('td', { colspan: '2', class: 'step-band', style: 'display:table-cell;height:24px' }, t, hint ? el('span', { class: 'muted' }, ' · ' + hint) : null))
  const needsBody = el('tbody')
  const treeBox = el('div'); const chosen = el('div', { class: 'muted', style: 'margin:2px 0 4px' })
  const picker = ctx.treePicker(treeBox, { value: st.root, roles: ['group', 'product', 'variant'], height: 200, onPick: r => { st.root = r.id; chosen.textContent = `${ICON[r.role]} ${r.label}`; localStorage.setItem('journali.xport.root', r.id) } })
  const attrSel = (cur, onchange) => { const s = el('select', { style: 'width:100%', onchange: e => onchange(e.target.value) }, el('option', { value: '' }, '—'), el('option', { value: '$sku' }, 'SKU'), el('option', { value: '$name' }, t_('Name')), el('option', { value: '$id' }, 'Id'), ...attrs.map(a => el('option', { value: a.key }, `${lbl(a)} (${a.key})`))); s.value = cur ?? ''; return s }
  function drawNeeds() {
    const { fields, vars } = needs(st.template)
    needsBody.innerHTML = ''
    needsBody.append(step(t_('Kopfwerte'), vars.length ? `${vars.length}` : 'keine'))
    for (const v of vars) needsBody.append(row(v, el('input', { value: st.vars[v] ?? '', style: 'width:100%', oninput: e => { st.vars[v] = e.target.value } })))
    needsBody.append(step(t_('Zuordnung'), fields.length ? t_('{0} Felder der Vorlage', [fields.length]) : t_('keine f.* in der Vorlage')))
    for (const f of fields) needsBody.append(row('f.' + f, attrSel(st.mapping[f], v => { st.mapping[f] = v })))
    if (/\{#features\}/.test(st.template)) {
      needsBody.append(step('ETIM-Attribute', 'Code → Attribut (ETIM & Co.)'))
      if (ctx.plugins.active('etim')) {
        // Regeln der Ausleitung (Taloan, 22.09.): hier im Profil, nicht im ETIM-Plugin — die Klassifikation weiss nichts von Empfängern
        const unk = el('select', { style: 'width:100%', onchange: e => { st.rules.unknownAs = e.target.value } }, el('option', { value: 'UN' }, t_('„-“ + UN unbekannt (Guideline)')), el('option', { value: 'NA' }, t_('„-“ + NA nicht anwendbar')), el('option', { value: 'skip' }, 'weglassen')); unk.value = st.rules.unknownAs ?? 'UN'
        const req = el('input', { type: 'checkbox' }); req.checked = !!st.rules.requireClass; req.addEventListener('change', () => { st.rules.requireClass = req.checked })
        const strict = el('input', { type: 'checkbox' }); strict.checked = !!st.rules.strict; strict.addEventListener('change', () => { st.rules.strict = strict.checked })
        const min = el('input', { type: 'number', min: '0', max: '100', step: '5', value: String(st.rules.minCompleteness ?? 0), style: 'width:70px', oninput: e => { st.rules.minCompleteness = Math.max(0, Math.min(100, Number(e.target.value) || 0)) } })
        needsBody.append(row('leer', unk), row(t_('Sperren'), el('div', { class: 'chips', style: 'flex-direction:column;align-items:flex-start;gap:2px' },
          el('label', { title: t_('ohne ETIM-Klasse wird das Produkt nicht ausgeleitet (sonst geht es ohne ETIM-Attribute hinaus)') }, req, ' ' + t_('Klasse ist Pflicht')),
          el('label', { title: t_('ein Wert, der nicht zum ETIM-Attribut passt, sperrt das Produkt (sonst geht er als „-“/UN hinaus und wird gezählt)') }, strict, ' ' + t_('Werte müssen passen')),
          el('label', { title: t_('Mindestanteil gefüllter ETIM-Attribute je Produkt — die Empfänger (Datenpools, Grosshandel) rechnen genau das; 0 = keine Schwelle') }, t_('Vollständigkeit ≥') + ' ', min, ' %'))))
      }
      if (ctx.plugins.active('etim')) { const cb = el('input', { type: 'checkbox' }); cb.checked = st.etim !== false; cb.addEventListener('change', () => { st.etim = cb.checked }); needsBody.append(row('ETIM', el('label', { title: t_('ETIM-Attribute aus der ETIM-Klasse am Knoten (Plugin etim) — dazu die Liste unten') }, cb, ' ' + t_('aus der Klasse am Knoten')))) }
      const featBody = el('tbody'); const featTbl = el('table', { style: 'width:100%;border-collapse:collapse' }, featBody)
      const drawFeat = () => { featBody.innerHTML = ''; for (const [i, fe] of st.features.entries()) featBody.append(el('tr', {}, el('td', { style: 'width:80px;padding:1px' }, el('input', { value: fe.code ?? '', placeholder: 'EF000001', class: 'mono', style: 'width:100%', oninput: e => { fe.code = e.target.value } })), el('td', { style: 'padding:1px' }, attrSel(fe.attr, v => { fe.attr = v })), el('td', { style: 'width:44px;padding:1px' }, el('input', { value: fe.unit ?? '', placeholder: 'EU…', style: 'width:100%', title: t_('Einheit (leer = die des Attributs)'), oninput: e => { fe.unit = e.target.value } })), el('td', { style: 'width:22px' }, el('button', { class: 'x', title: t_('ETIM-Attribut entfernen'), onclick: () => { st.features.splice(i, 1); drawFeat() } }, '✕')))) }
      drawFeat()
      needsBody.append(el('tr', {}, el('td', { colspan: '2', style: 'padding:2px 4px 2px 8px' }, featTbl, el('button', { class: 'x', style: 'margin-top:4px', title: t_('ETIM-Attribut hinzufügen'), onclick: () => { st.features.push({ code: '', attr: '', unit: '' }); drawFeat() } }, t_('+ ETIM-Attribut')))))
    }
  }
  const settingsBody = el('tbody')
  function drawSettings() {
    chosen.textContent = st.root ? `${ICON[tree.byId.get(st.root)?.role] ?? ''} ${tree.byId.get(st.root)?.label ?? ''}` : t_('im Baum wählen')
    starterSel.value = st.starter
    const modeSel = el('select', { style: 'width:100%', onchange: e => { st.mode = e.target.value } }, ...['xml', 'json', 'csv', 'text'].map(m => el('option', { value: m }, m))); modeSel.value = st.mode
    const roleSel = el('select', { style: 'width:100%', onchange: e => { st.role = e.target.value } }, el('option', { value: 'product' }, t_('▦ Produkte')), el('option', { value: 'variant' }, t_('◆ Varianten')), el('option', { value: 'group' }, t_('▣ Gruppen')), el('option', { value: 'all' }, t_('alle Knoten'))); roleSel.value = st.role
    const locBox = el('div', { class: 'chips' }); for (const l of model.locales) { const chip = el('span', { class: 'view-chip' + (st.locale === l.code ? ' on' : ''), onclick: () => { st.locale = l.code; for (const c of locBox.children) c.classList.toggle('on', c.textContent === l.code) } }, l.code); locBox.append(chip) }
    settingsBody.innerHTML = ''
    // Quelle (Taloan, 22.09.): ein Publikationsbaum — nur Ausgeleitetes, Rubriken als Kataloggruppen — oder ein Teilbaum des Pflegebaums
    const pubSel = el('select', { style: 'width:100%', title: t_('Publikationsbaum: es gehen nur ausgeleitete Produkte hinaus (Freigabe, Markt, Stand), die Rubriken werden die Kataloggruppen'), onchange: e => { st.pub = e.target.value; localStorage.setItem('journali.xport.pub', st.pub); treeBox.style.display = st.pub ? 'none' : ''; chosen.style.display = st.pub ? 'none' : '' } },
      el('option', { value: '' }, pubTrees.length ? t_('— Teilbaum des Pflegebaums —') : t_('— keine Publikationsbäume —')), ...pubTrees.map(t => el('option', { value: t.id }, `${t.label}${t.channel ? ' · ' + t.channel : ''}${t.market ? ' · ' + t.market : ''} · ${t.placed ?? 0}`)))
    pubSel.value = pubTrees.some(t => t.id === st.pub) ? st.pub : ''; if (!pubSel.value) st.pub = ''
    treeBox.style.display = st.pub ? 'none' : ''; chosen.style.display = st.pub ? 'none' : ''
    settingsBody.append(step(t_('Vorlage')), row(t_('Start'), starterSel), row(t_('Ausgabe'), modeSel, el('span', { class: 'muted', style: 'font-size:11px' }, ' ' + t_('entkommt Werte je Art'))), row(t_('Datei'), el('input', { value: st.fileName, style: 'width:100%', title: t_('{date} und {locale} werden ersetzt'), oninput: e => { st.fileName = e.target.value } })),
      step(t_('Quelle'), t_('Publikationsbaum (Ausleitung) oder Teilbaum')), row(t_('Publikation'), pubSel), row(t_('Teilbaum'), chosen, treeBox), row(t_('Rolle'), roleSel), row(t_('Sprache'), locBox))
    drawNeeds()
  }
  side.append(el('table', { style: 'width:100%;border-collapse:collapse' }, settingsBody, needsBody))

  // Vorschau (erste 3 Produkte) und Herunterladen (alle) — beide über denselben Kern wie der Job
  let busy = false
  async function run(all) {
    if (busy) return; if (!st.root && !st.pub) { store.toast(t_('Publikationsbaum oder Teilbaum wählen')); return }
    st.template = tplBox.value; if (!st.template.trim()) { store.toast(t_('Vorlage fehlt')); return }
    busy = true
    try {
      const env = { api, model, tree: { rows: tree.rows, byId: tree.byId, kids: id => tree.rows.filter(r => (r.parent ?? '') === (id ?? '')) }, server: location.origin }
      const etim = st.etim !== false && ctx.plugins.active('etim') ? ctx.use('etim') : null   // ETIM-Attribute aus der ETIM-Klasse am Knoten
      if (etim?.featuresOf) env.featuresOf = pctx => etim.featuresOf(pctx, st.rules)   // Regeln der Ausleitung aus dem Profil (Taloan, 22.09.)
      if (etim?.gate && /\{#features\}/.test(st.template)) env.gate = pctx => etim.gate(pctx, st.rules)   // Vorlage braucht ETIM-Attribute → Analyse muss bestehen
      const t0 = performance.now()
      const cx = await build(env, { root: st.root, pub: st.pub || null, role: st.role, locale: st.locale, mapping: st.mapping, vars: st.vars, features: st.features, limit: all ? 0 : 3, say: m => say(m) })
      const out = render(st.template, cx, st.mode, st.locale)
      const ms = Math.round(performance.now() - t0)
      const gaps = cx.stats ? `${cx.stats.classified ? ` · ETIM Ø ${cx.stats.completeness} % (${cx.stats.classified} klassifiziert)` : ''}${cx.stats.held ? ` · ${cx.stats.held} zurückgehalten` : ''}${cx.stats.unknown ? ` · ${cx.stats.unknown} ETIM-Attribute leer (UN)` : ''}${cx.stats.bad ? ` · ⚠ ${cx.stats.bad} Werte passen nicht (als UN)` : ''}` : ''
      if (all) { const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19); download(out, st.fileName.replace('{date}', stamp).replace('{locale}', st.locale), MIME[st.mode] ?? 'text/plain'); say(`⇓ ${cx.count} Produkte, ${(out.length / 1024).toFixed(0)} KB, ${ms} ms${gaps}`) }
      else { preview.textContent = out.length > 200000 ? out.slice(0, 200000) + '\n…' : out; say(t_('Vorschau: {0} von {1} Knoten, {2} ms{3}', [cx.count, env.tree.rows.filter(r => r.role === st.role || st.role === 'all').length, ms, gaps])) }
    } catch (e) { say('✗ ' + e.message.split('\n')[0]); preview.textContent = e.message; store.toast(e.message.split('\n')[0]) } finally { busy = false }
  }

  root.append(
    el('div', { class: 'toolbar' }, el('h1', {}, '‹› Vorlagen-Export'), profSel, profIn, saveBtn, delBtn, el('span', { class: 'grow' }), el('button', { class: 'x', title: t_('die ersten 3 Produkte durch die Vorlage — zum Prüfen'), onclick: () => run(false) }, t_('▷ Vorschau')), el('button', { class: 'primary', title: t_('alle Knoten des Teilbaums durch die Vorlage und als Datei herunterladen'), onclick: () => run(true) }, t_('⇓ Herunterladen')), jobBtn, manageBtn, status),
    el('div', { style: 'display:flex;flex:1;min-height:0' }, side, el('div', { style: 'display:flex;flex-direction:column;flex:1;min-width:0' }, tplBox, preview)))
  await loadProfiles()
  drawSettings()
  return () => {}
}

export default {
  views: [{ path: 'export', label: 'Vorlagen-Export', icon: '‹›', topic: 'export', hint: t_('Export nach Vorlage — BMEcat/ETIM, Google Merchant, JSON oder eigene Definition; Vorschau, Herunterladen, als Job'), mount }],
  nodeActions: [{ label: 'Vorlagen-Export', icon: '‹›', topic: 'export', roles: ['group', 'product'], run(id, ctx) { localStorage.setItem('journali.xport.root', id); ctx.go?.('/p/xport/export') } }],
}
