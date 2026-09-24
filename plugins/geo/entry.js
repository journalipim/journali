// Plugin geo: aus den echten Produktdaten schlägt die KI
// Texte vor, die Suchmaschinen und KI-Antworten gern zitieren — ein Definitionssatz, eine Kurzbeschreibung, Fragen & Antworten,
// Suchbegriffe. Je Feld ein Zielattribut (gemerkt im Journal, Plugin-Daten „targets“); „übernehmen“ schreibt den Wert an den
// Knoten. Dazu Schema.org-Product-JSON-LD aus den Daten (ohne KI). Braucht einen KI-Schlüssel aus den Einstellungen.
const L = l => globalThis.journali?.L ? globalThis.journali.L(l) : (l?.de ?? Object.values(l ?? {})[0] ?? '')   // Bezeichnung in der Oberflächensprache
const t = (k, p) => globalThis.journali?.t ? globalThis.journali.t(k, p) : String(k).replace(/\{(\w+)\}/g, (m, i) => p?.[i] ?? m)   // Oberflächensprache: spät gebunden, im Test ohne Fenster ladbar
function el(tag, attrs = {}, ...kids) { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'class') e.className = v; else e.setAttribute(k, v) } for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : String(c)); return e }
const ICON = { group: '▣', product: '▦', variant: '◆' }
const FIELDS = [
  ['definition', t('Definitionssatz'), t('Ein Satz, der das Produkt so beschreibt, dass eine KI-Antwort ihn wörtlich übernehmen kann („X ist ein …, das …“).')],
  ['description', t('Kurzbeschreibung'), t('Zwei bis drei Sätze: Zweck, wichtigste Eigenschaften mit Zahlen, Einsatz.')],
  ['faq', 'Fragen & Antworten', t('Drei Frage-Antwort-Paare, wie Käufer sie stellen; Antworten mit konkreten Werten.')],
  ['keywords', t('Suchbegriffe'), t('Fünf bis acht Begriffe und Wortgruppen, kommagetrennt.')],
]

/// Fakten eines Knotens: Name, Pfad, SKU, Attribute mit Label und Wert (eigen oder geerbt) in einer Sprache
async function facts(ctx, id, locale) {
  const { api, store, tree } = ctx; const model = store.model
  const n = await api.get(`/api/nodes/${encodeURIComponent(id)}`)
  const defs = new Map(model.attributes.map(a => [a.key, a]))
  const key = v => `${v.attribute}|${v.locale ?? ''}|${v.channel ?? ''}`
  const own = new Map(n.values.map(v => [key(v), v.values ? v.values.join(', ') : v.value]))
  const anc = n.ancestors.map(a => new Map(a.values.map(v => [key(v), v.values ? v.values.join(', ') : v.value])))
  const look = (m, k, loc) => m.get(`${k}|${loc}|`) ?? (loc ? m.get(`${k}||`) : null) ?? null
  const rows = []
  for (const d of model.attributes) {
    if (['html', 'rows', 'template', 'formula'].includes(d.type) && d.type !== 'formula') continue
    const loc = d.perLocale ? locale : ''
    let v = d.type === 'formula' ? n.computed.find(c => c.attribute === d.key)?.value ?? null : look(own, d.key, loc)
    if (v == null && d.inheritable) for (const m of anc) { v = look(m, d.key, loc); if (v != null) break }
    if (v == null || v === '') continue
    if (d.type === 'enum') { const list = model.lists.find(x => x.key === d.list); v = String(v).split(',').map(x => list?.values.find(y => y.value === x.trim())?.label?.[locale] ?? x.trim()).join(', ') }
    rows.push({ key: d.key, label: d.label?.[locale] || L(d.label) || d.key, value: String(v), unit: d.unit ?? '' })
  }
  const row = tree.byId.get(id)
  const path = tree.ancestors(id).map(a => a.label).reverse().join(' › ')
  return { id, role: n.role, name: row?.label ?? n.name ?? id, sku: row?.sku ?? '', path, rows, axes: n.axisValues ?? {} }
}

function jsonLd(f, locale) {
  const props = f.rows.filter(r => !['sku', 'name'].includes(r.key)).slice(0, 40).map(r => ({ '@type': 'PropertyValue', name: r.label, value: r.value + (r.unit ? ' ' + r.unit : '') }))
  return { '@context': 'https://schema.org', '@type': t('Product'), name: f.name, sku: f.sku || undefined, category: f.path || undefined, inLanguage: locale, additionalProperty: props }
}

async function mount(root, ctx) {
  const { api, store, tree, ai } = ctx
  if (!tree.loaded) await tree.load()
  const st = { node: localStorage.getItem('journali.geo.node') || tree.rows.find(r => r.role === 'product')?.id, locale: store.model.masterLocale ?? 'de', result: null, targets: (await ctx.data.get('targets')) ?? {} }
  root.style.cssText = 'display:flex;flex-direction:column;height:100%;padding:0'
  const status = el('span', { class: 'muted' }); const say = m => status.textContent = m
  const textAttrs = store.model.attributes.filter(a => a.type === 'text' || a.type === 'html')
  const nodeBtn = el('button', { class: 'x' }, st.node ? `${ICON[tree.byId.get(st.node)?.role] ?? ''} ${tree.byId.get(st.node)?.label ?? ''}` : t('Knoten wählen'))
  const pick = el('div', { class: 'picker', style: 'position:absolute;left:0;top:28px;z-index:5;width:380px;display:none;padding:6px;background:var(--pane)' })
  ctx.treePicker(pick, { value: st.node, roles: ['group', 'product', 'variant'], height: 300, onPick: r => { st.node = r.id; nodeBtn.textContent = `${ICON[r.role]} ${r.label}`; pick.style.display = 'none'; localStorage.setItem('journali.geo.node', r.id) } })
  nodeBtn.addEventListener('click', () => { pick.style.display = pick.style.display === 'none' ? 'block' : 'none' })
  const locSel = el('select', { onchange: e => { st.locale = e.target.value } }, ...store.model.locales.map(l => el('option', { value: l.code }, l.code))); locSel.value = st.locale
  const body = el('div', { class: 'scroll', style: 'flex:1;padding:8px' })

  async function suggest() {
    if (!st.node) return
    if (!ai?.available?.() && !ai?.key) { store.toast(t('Kein KI-Schlüssel — Einstellungen → KI')); return }
    say(t('lese Daten …'))
    try {
      const f = await facts(ctx, st.node, st.locale)
      say(`frage ${ai.label()} …`)
      const system = t('Du schreibst Produkttexte für Suchmaschinen und KI-Antworten (GEO). Sprache: {0}. Nur Fakten aus den Daten, keine Erfindungen, keine Superlative. Antworte als JSON: { "definition": string, "description": string, "faq": [{ "q": string, "a": string }] (genau 3), "keywords": string[] (5–8) }.', [st.locale])
      const user = `Produkt: ${f.name}\nPfad: ${f.path}\nSKU: ${f.sku}\nEigenschaften:\n` + f.rows.map(r => `- ${r.label}: ${r.value}${r.unit ? ' ' + r.unit : ''}`).join('\n')
      const j = await ai.ask({ system, user, json: true, maxTokens: 1500, purpose: t('Geodaten') })
      st.result = { facts: f, definition: j.definition ?? '', description: j.description ?? '', faq: Array.isArray(j.faq) ? j.faq : [], keywords: Array.isArray(j.keywords) ? j.keywords.join(', ') : String(j.keywords ?? '') }
      say(t('{0} Eigenschaften · Vorschlag von {1}', [f.rows.length, ai.label()])); draw()
    } catch (e) { say('✗ ' + e.message); store.toast(e.message) }
  }
  const textOf = k => k === 'faq' ? st.result.faq.map(x => `${x.q}\n${x.a}`).join('\n\n') : st.result[k]
  async function take(k) {
    const target = st.targets[k]; if (!target) { store.toast(t('Zielattribut wählen')); return }
    const def = store.model.attributes.find(a => a.key === target)
    try { await api.post(`/api/nodes/${encodeURIComponent(st.node)}/attributes`, { attribute: target, locale: def?.perLocale ? st.locale : null, value: textOf(k) }); store.toast(`✓ ${target} gesetzt`, 'ok'); store.poll(true) }
    catch (e) { store.toast(e.message) }
  }
  function draw() {
    body.innerHTML = ''
    if (!st.result) { body.append(el('div', { class: 'empty' }, t('Knoten wählen, dann „Vorschlagen“ — die KI schreibt aus den echten Daten; nichts wird ohne „übernehmen“ gespeichert.'))); return }
    for (const [k, label, hint] of FIELDS) {
      const sel = el('select', { title: t('Zielattribut'), onchange: async e => { st.targets[k] = e.target.value; await ctx.data.set('targets', st.targets) } }, el('option', { value: '' }, t('Zielattribut …')), ...textAttrs.map(a => el('option', { value: a.key }, `${L(a.label) || a.key} (${a.key})`)))
      sel.value = st.targets[k] ?? ''
      const ta = el('textarea', { style: 'width:100%;min-height:72px;font:inherit', oninput: e => { if (k === 'faq') return; st.result[k] = e.target.value } }, textOf(k))
      if (k === 'faq') ta.addEventListener('input', e => { st.result.faq = e.target.value.split(/\n\s*\n/).map(b => { const [q, ...a] = b.split('\n'); return { q, a: a.join('\n') } }) })
      body.append(el('div', { class: 'section' }, el('h2', {}, label, ' ', el('span', { class: 'muted' }, '· ' + hint)), ta, el('div', { class: 'row', style: 'display:flex;gap:6px;margin-top:4px' }, sel, el('button', { class: 'primary', onclick: () => take(k) }, t('⇥ übernehmen')))))
    }
    const ld = JSON.stringify(jsonLd(st.result.facts, st.locale), null, 1)
    body.append(el('div', { class: 'section' }, el('h2', {}, t('Schema.org Product (JSON-LD)') + ' ', el('span', { class: 'muted' }, t('· aus den Daten, ohne KI — für Shop oder Webseite'))), el('pre', { class: 'out', style: 'white-space:pre-wrap;font-size:11px;max-height:240px;overflow:auto' }, ld), el('button', { class: 'x', onclick: () => navigator.clipboard.writeText(ld).then(() => store.toast('kopiert', 'ok')) }, '⧉ kopieren')))
  }
  root.append(el('div', { class: 'toolbar' }, el('h1', {}, t('✎ GEO-Texte')), el('span', { style: 'position:relative' }, nodeBtn, pick), locSel, el('button', { class: 'primary', onclick: suggest }, t('✦ Vorschlagen')), el('span', { class: 'grow' }), status), body)
  draw()
  return () => {}
}

// Prüfregeln — laufen in ✓ Datenqualität,
// ohne KI. Beschreibend = text/html-Attribut mit längerem Wert oder Schlüssel/Label wie description, beschreibung, text, merkmal, seo.
const DESC = /beschreib|description|text|merkmal|feature|seo|intro|teaser|content|inhalt/i
const SUPER = /\b(beste[rsn]?|einzigartig|revolutionär|perfekt|unschlagbar|weltklasse|premium-?qualität|best|unique|revolutionary|perfect|unbeatable|world-?class|ultimate)\b/i
const strip = v => String(v ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
const descriptive = (c, v) => (c.type === 'text' || c.type === 'html') && v && (DESC.test(c.key) || DESC.test(c.label ?? '') || strip(v).length > 80)
const words = s => s.split(/\s+/).filter(Boolean).length
const checks = [
  { key: 'short', label: t('GEO: Beschreibung zu kurz'), severity: 'info',
    run({ values, columns }) { return columns.filter(c => descriptive(c, values[c.key]?.value) && words(strip(values[c.key].value)) < 30).map(c => ({ attribute: c.key, message: t('{0} Wörter — KI-Antworten zitieren ab ~30 Wörtern mit Fakten', [words(strip(values[c.key].value))]) })) } },
  { key: 'definition', label: t('GEO: kein Definitionssatz'), severity: 'warn',
    run({ row, values, columns }) {
      const name = strip(row.label ?? row.name ?? '').toLowerCase()
      return columns.filter(c => descriptive(c, values[c.key]?.value)).filter(c => { const first = strip(values[c.key].value).split(/(?<=[.!?])\s/)[0].toLowerCase(); return !/\b(ist ein|ist eine|is a|is an|sind|are)\b/.test(first) && !(name && first.includes(name.slice(0, 12))) })
        .map(c => ({ attribute: c.key, message: t('erster Satz nennt weder das Produkt noch „… ist ein …“ — genau den zitieren KI-Antworten') })) } },
  { key: 'superlatives', label: t('GEO: Superlative statt Fakten'), severity: 'warn',
    run({ values, columns }) { return columns.filter(c => descriptive(c, values[c.key]?.value) && SUPER.test(strip(values[c.key].value))).map(c => ({ attribute: c.key, message: t('„{0}“ — Werbewörter werden nicht zitiert, Zahlen schon', [strip(values[c.key].value).match(SUPER)[0]]) })) } },
  { key: 'nofacts', label: t('GEO: keine konkreten Angaben'), severity: 'info',
    run({ values, columns }) { return columns.filter(c => descriptive(c, values[c.key]?.value) && !/\d/.test(strip(values[c.key].value))).map(c => ({ attribute: c.key, message: t('keine Zahl, kein Maß, keine Einheit im Text') })) } },
  { key: 'sameasname', label: 'GEO: Text = Name', severity: 'warn',
    run({ row, values, columns }) { const name = strip(row.label ?? row.name ?? '').toLowerCase(); return columns.filter(c => (c.type === 'text' || c.type === 'html') && values[c.key]?.value && strip(values[c.key].value).toLowerCase() === name && name.length > 0).map(c => ({ attribute: c.key, message: t('nur der Produktname — sagt nichts über das Produkt') })) } },
]

export default {
  views: [{ path: 'texts', label: 'GEO-Texte', icon: '✎', topic: 'analysis', hint: t('KI-Vorschläge für Suchmaschinen und KI-Antworten aus den Produktdaten; Schema.org JSON-LD; Prüfregeln in der Datenqualität'), mount }],
  nodeActions: [{ label: t('GEO-Texte vorschlagen'), icon: '✎', topic: 'analysis', roles: ['product', 'variant', 'group'], run(id, ctx) { localStorage.setItem('journali.geo.node', id); ctx.go?.('/p/geo/texts') } }],
  checks,
}
