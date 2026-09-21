// Plugin xliff (Taloan, 21.09.2026, Blick in OpenDXP: „Übersetzungsmanagement ist etwas, was wir noch gar nicht haben“):
// ⇄ Übersetzung — je Sprachrichtung die Einheiten (Knoten × Textattribut × Kanal): fehlend, veraltet (⟳ Quelle neuer), fertig.
// 1 Sprachen und Umfang · 2 Teilbaum · 3 Einheiten (Tabelle, Ziel direkt eintragen, ✦ KI vorübersetzen, 💾 schreiben,
// ⇪ XLIFF 2.0 für Agentur/CAT) · 4 XLIFF zurück (Datei, Plan, schreiben — nur wo die Quelle unverändert ist).
// Der Server rechnet die Einheiten (TranslateApi.cs) und schreibt XLIFF; hier nur Bedienung. Als Job: Export in out/, Import aus in/.
function el(tag, attrs = {}, ...kids) { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v) } for (const k of kids) e.append(k); return e }
const ICON = { group: '▣', product: '▦', variant: '◆' }
const STATE = { missing: ['○', 'neg', 'fehlt'], stale: ['⟳', 'warn', 'veraltet — Quelle ist neuer'], done: ['✓', 'pos', 'fertig'] }
const download = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000) }
const strip = s => String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

async function mount(root, ctx) {
  const { api, store, tree, ai } = ctx
  if (!tree.loaded) await tree.load()
  const model = store.model
  const master = model.masterLocale ?? model.locales[0]?.code
  const textAttrs = (model.attributes ?? []).filter(a => a.perLocale && (a.type === 'text' || a.type === 'html'))
  const st = { from: master, to: model.locales.find(l => l.code !== master)?.code ?? '', channel: '', scope: 'open', attrs: new Set(textAttrs.map(a => a.key)), root: null, units: [], edited: new Map(), plan: null }
  root.style.cssText = 'display:flex;flex-direction:column;height:100%;padding:0'
  const status = el('span', { class: 'muted' }); const say = m => { status.textContent = m }
  const body = el('div', { class: 'scroll', style: 'flex:1;padding:0 8px 12px' })
  const band = t => el('div', { class: 'step-band', style: 'margin:10px -8px 6px' }, t)

  // ---- Profil (alles Datenthematische im Profil — Taloan): Sprachen, Kanal, Umfang, Attribute, Teilbaum; der Job nimmt es
  const profSel = el('select', {}, el('option', { value: '' }, '— Profil —'))
  const profIn = el('input', { type: 'text', placeholder: 'Name', style: 'width:110px' })
  async function loadProfiles() { try { const names = (await ctx.data.list()).filter(n => n.startsWith('profile:')).map(n => n.slice(8)); profSel.innerHTML = ''; profSel.append(el('option', { value: '' }, '— Profil —'), ...names.map(n => el('option', { value: n }, n))) } catch {} }
  profSel.addEventListener('change', async () => { const n = profSel.value; if (!n) return; const p = await ctx.data.get('profile:' + n); if (!p) return; Object.assign(st, { from: p.from ?? st.from, to: p.to ?? st.to, channel: p.channel ?? '', scope: p.scope ?? 'open', root: p.root ?? null, attrs: new Set(p.attributes ? p.attributes.split(',') : textAttrs.map(a => a.key)) }); profIn.value = n; drawSettings(); say(`Profil „${n}“ geladen`) })
  async function saveProfile() {
    const n = (profIn.value || profSel.value).trim(); if (!n) { store.toast('Profilname fehlt'); return }
    await ctx.data.set('profile:' + n, { from: st.from, to: st.to, channel: st.channel, scope: st.scope, root: st.root, attributes: [...st.attrs].join(',') })
    await loadProfiles(); profSel.value = n; store.toast(`Profil „${n}“ gespeichert — als Job: ⏱ Jobs → + Job → XLIFF-Export / XLIFF-Import`, 'ok')
  }
  root.append(el('div', { class: 'toolbar' }, el('h1', {}, '⇄ Übersetzung'), el('span', { class: 'sep' }, '·'), profSel, profIn, el('button', { class: 'x', title: 'Sprachen, Umfang, Attribute und Teilbaum als Profil speichern (für Jobs)', onclick: saveProfile }, '💾'), el('span', { class: 'grow' }), status), body)
  loadProfiles()

  // ---- 1 Sprachen und Umfang
  const settings = el('div'); const overview = el('div', { style: 'margin-top:6px' })
  const q = () => `root=${encodeURIComponent(st.root ?? '')}&from=${st.from}&to=${st.to}&channel=${encodeURIComponent(st.channel)}&attributes=${encodeURIComponent(st.attrs.size === textAttrs.length ? '' : [...st.attrs].join(','))}&scope=${st.scope}`
  function drawSettings() {
    settings.innerHTML = ''
    const locSel = which => { const s = el('select', { onchange: e => { st[which] = e.target.value; drawOverview() } }, ...model.locales.map(l => el('option', { value: l.code }, `${l.code} · ${l.label ?? ''}`))); s.value = st[which]; return s }
    const chSel = el('select', { onchange: e => { st.channel = e.target.value } }, el('option', { value: '' }, 'alle Kanäle'), ...model.channels.map(c => el('option', { value: c.key }, c.label?.de || c.key))); chSel.value = st.channel
    const scSel = el('select', { onchange: e => { st.scope = e.target.value } }, el('option', { value: 'open' }, 'offen (fehlend + veraltet)'), el('option', { value: 'missing' }, 'nur fehlend'), el('option', { value: 'stale' }, 'nur veraltet'), el('option', { value: 'all' }, 'alles (auch fertig)')); scSel.value = st.scope
    const chips = el('div', { class: 'chips' }, ...textAttrs.map(a => { const c = el('span', { class: 'view-chip' + (st.attrs.has(a.key) ? ' on' : ''), title: a.key, onclick: () => { st.attrs.has(a.key) ? st.attrs.delete(a.key) : st.attrs.add(a.key); c.classList.toggle('on') } }, a.label?.de || a.key); return c }))
    settings.append(el('table', { class: 'grid form', style: 'width:auto' }, el('tbody', {},
      el('tr', {}, el('td', { class: 'attr' }, 'Quelle → Ziel'), el('td', { class: 'row', style: 'gap:6px' }, locSel('from'), '→', locSel('to'))),
      el('tr', {}, el('td', { class: 'attr' }, 'Kanal'), el('td', {}, chSel)),
      el('tr', {}, el('td', { class: 'attr' }, 'Umfang'), el('td', {}, scSel)),
      el('tr', {}, el('td', { class: 'attr' }, 'Attribute'), el('td', {}, chips)))))
    chosen.textContent = st.root ? `${ICON[tree.byId.get(st.root)?.role] ?? ''} ${tree.byId.get(st.root)?.label ?? ''}` : '⌂ alle Wurzeln'
    picker.set?.(st.root)
    drawOverview()
  }
  async function drawOverview() {
    try {
      const s = await api.get(`/api/translate/status?root=${encodeURIComponent(st.root ?? '')}`)
      overview.innerHTML = ''
      const tbl = el('table', { class: 'grid', style: 'width:auto' }, el('thead', {}, el('tr', {}, el('th', {}, 'Ziel'), el('th', { title: 'kein Zieltext' }, '○ fehlt'), el('th', { title: 'Zieltext da, Quelle seither geändert' }, '⟳ veraltet'), el('th', {}, '✓ fertig'), el('th', {}, 'von'))))
      for (const l of s.locales) tbl.append(el('tr', { class: 'row' + (l.locale === st.to ? ' selected' : ''), style: 'cursor:pointer', onclick: () => { st.to = l.locale; drawSettings() } }, el('td', {}, `${l.locale} · ${l.label ?? ''}`), el('td', { class: l.missing ? 'neg' : 'muted' }, l.missing), el('td', { class: l.stale ? 'warn' : 'muted' }, l.stale), el('td', { class: 'pos' }, l.done), el('td', { class: 'muted' }, l.total)))
      overview.append(el('div', { class: 'muted', style: 'font-size:12px;margin-bottom:4px' }, `Übersetzungsstand gegen ${s.from} (Master) — ${s.total} Quelltexte${st.root ? ' im Teilbaum' : ''}`), tbl)
    } catch (e) { overview.textContent = e.message }
  }

  // ---- 2 Teilbaum
  const chosen = el('div', { class: 'muted', style: 'margin:2px 0 4px' })
  const treeBox = el('div')
  const picker = ctx.treePicker(treeBox, { value: st.root, roles: ['group', 'product'], height: 200, allowRoot: true, onPick: r => { st.root = r?.id ?? null; chosen.textContent = r ? `${ICON[r.role]} ${r.label}` : '⌂ alle Wurzeln'; drawOverview() } })

  // ---- 3 Einheiten
  const unitsBox = el('div'); const count = el('span', { class: 'muted' })
  const loadBtn = el('button', { class: 'primary', onclick: loadUnits }, '⟳ Einheiten laden')
  const xliffBtn = el('button', { title: 'XLIFF 2.0 herunterladen — für Agentur oder CAT-Werkzeug (Trados, memoQ, Phrase); zurück über Schritt 4', onclick: async () => {
    try { const r = await fetch(`${store.server}/api/translate/xliff?${q()}`, { headers: { 'X-Actor': store.actor } }); if (!r.ok) throw new Error(await r.text()); download(await r.blob(), `journali-${st.from}-${st.to}.xlf`) } catch (e) { store.toast(e.message) } } }, '⇪ XLIFF exportieren')
  const aiBtn = el('button', { title: 'leere Ziele mit der KI vorübersetzen (Einstellungen → KI) — nur Vorschläge in der Tabelle, geschrieben wird erst mit 💾', onclick: preTranslate }, '✦ KI vorübersetzen')
  const writeBtn = el('button', { class: 'primary', title: 'die eingetragenen Ziele schreiben (AttributeSet je Einheit) — nur, wo die Quelle seit dem Laden unverändert ist', onclick: writeEdited }, '💾 Ziele schreiben')
  async function loadUnits() {
    say('lade …')
    try { const r = await api.get(`/api/translate/units?${q()}&limit=5000`); st.units = r.units; st.edited = new Map(); drawUnits(); say(`${r.count} Einheiten · ○ ${r.missing} · ⟳ ${r.stale} · ✓ ${r.done}`) } catch (e) { say(''); store.toast(e.message) }
  }
  function drawUnits() {
    unitsBox.innerHTML = ''
    count.textContent = st.units.length ? `${st.units.length} Einheiten · ${st.edited.size} geändert` : ''
    if (!st.units.length) { unitsBox.append(el('div', { class: 'muted', style: 'padding:6px 0' }, 'noch nichts geladen')); return }
    const tbl = el('table', { class: 'grid', style: 'width:100%' }, el('thead', {}, el('tr', {}, el('th', { style: 'width:20px' }), el('th', {}, 'Knoten'), el('th', {}, 'Attribut'), el('th', {}, 'Kanal'), el('th', {}, `Quelle (${st.from})`), el('th', {}, `Ziel (${st.to})`))))
    for (const u of st.units.slice(0, 1000)) {
      const [sym, cls, title] = STATE[u.state] ?? ['?', 'muted', u.state]
      const ta = el('textarea', { rows: '1', style: 'width:100%;min-height:24px;resize:vertical', placeholder: u.state === 'missing' ? '…' : '', title: 'Ziel — Änderung wird mit 💾 geschrieben' }); ta.value = st.edited.get(u.id) ?? u.target ?? ''
      ta.addEventListener('input', () => { if (ta.value !== (u.target ?? '')) st.edited.set(u.id, ta.value); else st.edited.delete(u.id); count.textContent = `${st.units.length} Einheiten · ${st.edited.size} geändert` })
      u._ta = ta
      tbl.append(el('tr', { class: 'row' }, el('td', { class: cls, title }, sym), el('td', { title: u.node }, `${ICON[u.role] ?? ''} ${u.label}`), el('td', { class: 'muted', title: u.attribute }, u.attributeLabel), el('td', { class: 'muted' }, u.channel ?? '*'),
        el('td', { title: strip(u.source), style: 'max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, strip(u.source)), el('td', { style: 'min-width:260px' }, ta)))
    }
    if (st.units.length > 1000) tbl.append(el('tr', {}, el('td', { colspan: '6', class: 'muted' }, `… ${st.units.length - 1000} weitere — XLIFF nimmt alle`)))
    unitsBox.append(tbl)
  }
  async function preTranslate() {
    if (!ai?.available?.()) { store.toast('Kein KI-Schlüssel — Einstellungen → KI'); return }
    const todo = st.units.filter(u => !(st.edited.get(u.id) ?? u.target)).slice(0, 400)
    if (!todo.length) { store.toast('keine leeren Ziele'); return }
    let n = 0
    for (let i = 0; i < todo.length; i += 20) {
      const batch = todo.slice(i, i + 20); say(`✦ übersetze ${i + batch.length}/${todo.length} …`)
      try {
        const out = await ai.ask({ system: `Du übersetzt Produktdaten von ${st.from} nach ${st.to}. Antworte nur mit JSON: ein Objekt {id: übersetzung}. HTML-Struktur beibehalten, Zahlen, Einheiten, Marken- und Produktnamen unverändert, keine Erklärungen.`, user: JSON.stringify(Object.fromEntries(batch.map(u => [u.id, u.source]))), json: true, maxTokens: 4000 })
        for (const u of batch) { const t = out?.[u.id]; if (typeof t === 'string' && t.trim()) { st.edited.set(u.id, t.trim()); if (u._ta) u._ta.value = t.trim(); n++ } }
      } catch (e) { store.toast(e.message); break }
    }
    count.textContent = `${st.units.length} Einheiten · ${st.edited.size} geändert`; say(`✦ ${n} Vorschläge — prüfen, dann 💾 schreiben`)
  }
  async function writeEdited() {
    if (!st.edited.size) { store.toast('nichts geändert'); return }
    const units = [...st.edited].map(([id, target]) => ({ id, target, sourceHash: st.units.find(u => u.id === id)?.sourceHash }))
    try { const r = await api.post('/api/translate/import', { from: st.from, to: st.to, units }); store.toast(`${r.written} geschrieben${r.skipped ? `, ${r.skipped} übergangen (Quelle geändert)` : ''}${r.unchanged ? `, ${r.unchanged} unverändert` : ''}`, r.skipped ? 'warn' : 'ok'); await store.poll(true); await loadUnits(); drawOverview() } catch (e) { store.toast(e.message) }
  }

  // ---- 4 XLIFF zurück
  const fileIn = el('input', { type: 'file', accept: '.xlf,.xliff,.xml' })
  const planBox = el('div', { style: 'margin-top:6px' })
  const forceCb = el('input', { type: 'checkbox' })
  let xml = ''
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files?.[0]; if (!f) return
    xml = await f.text()
    const m = xml.match(/srcLang="([^"]+)"[^>]*trgLang="([^"]+)"/) || xml.match(/source-language="([^"]+)"[^>]*target-language="([^"]+)"/)
    const n = (xml.match(/<unit\b/g) || xml.match(/<trans-unit\b/g) || []).length
    const filled = (xml.match(/<target>/g) || []).length
    planBox.innerHTML = ''; planBox.append(el('div', {}, `${f.name}: ${n} Einheiten, ${filled} mit Ziel${m ? ` · ${m[1]} → ${m[2]}` : ''}`),
      el('div', { class: 'row', style: 'gap:8px;margin-top:6px;align-items:center' }, el('button', { class: 'primary', onclick: importXliff }, `⇩ ${filled} Ziele schreiben`), el('label', { title: 'auch schreiben, wenn sich die Quelle seit dem Export geändert hat' }, forceCb, ' auch bei geänderter Quelle')))
  })
  async function importXliff() {
    try {
      const r = await fetch(`${store.server}/api/translate/xliff?to=${st.to}&force=${forceCb.checked}`, { method: 'POST', headers: { 'X-Actor': store.actor, 'Content-Type': 'application/xml' }, body: xml })
      const o = await r.json(); if (!r.ok) throw new Error(o.error || r.status)
      planBox.append(el('div', { class: o.skipped ? 'warn' : 'pos', style: 'margin-top:6px' }, `${o.written} geschrieben · ${o.unchanged} unverändert · ${o.skipped} übergangen · ${o.missing} unbekannt`), ...(o.errors ?? []).slice(0, 20).map(e => el('div', { class: 'muted', style: 'font-size:12px' }, e)))
      await store.poll(true); drawOverview(); if (st.units.length) loadUnits()
    } catch (e) { store.toast(e.message) }
  }

  body.append(band('1 · Sprachen und Umfang'), settings, overview,
    band('2 · Teilbaum'), chosen, treeBox,
    band('3 · Einheiten'), el('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:6px' }, loadBtn, xliffBtn, aiBtn, writeBtn, count), unitsBox,
    band('4 · XLIFF zurück'), el('div', { class: 'muted', style: 'font-size:12px;margin-bottom:4px' }, 'Übersetzte Datei der Agentur (XLIFF 2.0 oder 1.2). Geschrieben wird nur, wo die Quelle seit dem Export unverändert ist — der Hash steht in der Datei.'), fileIn, planBox)
  drawSettings(); drawUnits()
}

export default {
  views: [{ path: 'translate', label: 'Übersetzung', icon: '⇄', topic: 'translate', hint: 'fehlende und veraltete Texte je Sprache, XLIFF für Agenturen, KI-Vorübersetzung', mount }],
}
