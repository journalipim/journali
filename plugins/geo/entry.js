// Plugin geo: aus den echten Produktdaten schlägt die KI
// Texte vor, die Suchmaschinen und KI-Antworten gern zitieren — ein Definitionssatz, eine Kurzbeschreibung, Fragen & Antworten,
// Suchbegriffe. Je Feld ein Zielattribut (gemerkt im Journal, Plugin-Daten „targets“); „übernehmen“ schreibt den Wert an den
// Knoten. Dazu Schema.org-Product-JSON-LD aus den Daten (ohne KI). Braucht einen KI-Schlüssel aus den Einstellungen.
const L = l => globalThis.journali?.L ? globalThis.journali.L(l) : (l?.de ?? Object.values(l ?? {})[0] ?? '')   // Bezeichnung in der Oberflächensprache
const t = (k, p) => globalThis.journali?.t ? globalThis.journali.t(k, p) : String(k).replace(/\{(\w+)\}/g, (m, i) => p?.[i] ?? m)   // Oberflächensprache: spät gebunden, im Test ohne Fenster ladbar
function el(tag, attrs = {}, ...kids) { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'class') e.className = v; else e.setAttribute(k, v) } for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : String(c)); return e }
const ICON = { group: '▣', product: '▦', variant: '◆' }
/// Die Systemobjekte des Plugins (wie bei dpp und ppwr): die Attributgruppe enrich_geo und je erzeugtem Text ein Attribut. Sie entstehen beim
/// Einschalten, nach einem Hinweis; die erzeugten Texte gehen standardmässig in diese Attribute.
const GROUP = 'enrich_geo'
const GROUP_LABEL = { de: 'GEO-Texte', en: 'GEO texts' }
const ATTRIBUTES = [
  ['definition', 'geo_definition', { de: 'Definitionssatz', en: 'Definition sentence' }],
  ['description', 'geo_description', { de: 'Kurzbeschreibung', en: 'Short description' }],
  ['faq', 'geo_faq', { de: 'Fragen & Antworten', en: 'Questions & answers' }],
  ['keywords', 'geo_keywords', { de: 'Suchbegriffe', en: 'Search terms' }],
  ['jsonld', 'geo_jsonld', { de: 'Schema.org Product (JSON-LD)', en: 'Schema.org Product (JSON-LD)' }],
]
const DEFAULT_TARGETS = Object.fromEntries(ATTRIBUTES.map(([field, key]) => [field, key]))
/// Zielattribut je Feld: das gemerkte, sonst das des Plugins — wenn es im Modell steht
const targetsOf = (stored, model) => {
  const out = {}
  for (const [field, key] of Object.entries(DEFAULT_TARGETS)) if ((model.attributes ?? []).some(a => a.key === key)) out[field] = key
  for (const [field, key] of Object.entries(stored ?? {})) if (key) out[field] = key
  return out
}

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
  // Schema.org (04.10.2026): die Einheit gehört in unitText, nicht in den Wert; inLanguage kennt Product nicht (nur CreativeWork)
  const props = f.rows.filter(r => !['sku', 'name'].includes(r.key)).slice(0, 40).map(r => ({ '@type': 'PropertyValue', name: r.label, value: r.value, ...(r.unit ? { unitText: r.unit } : {}) }))
  return { '@context': 'https://schema.org', '@type': t('Product'), name: f.name, sku: f.sku || undefined, category: f.path || undefined, additionalProperty: props }
}

async function mount(root, ctx) {
  const { api, store, tree, ai } = ctx
  if (!tree.loaded) await tree.load()
  const st = { node: localStorage.getItem('journali.geo.node') || tree.rows.find(r => r.role === 'product')?.id, locale: store.model.masterLocale ?? 'de', result: null, targets: targetsOf(await ctx.data.get('targets'), store.model) }
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
  const textOf = k => k === 'faq' ? st.result.faq.map(x => `${x.q}\n${x.a}`).join('\n\n') : st.result[k]   // jsonld: gesetzt, sobald die Ansicht es zeichnet
  /// Einen Text an den Knoten schreiben: ins Zielattribut des Feldes (in der Sprache der Ansicht, wenn das Attribut je Sprache gilt)
  async function write(k) {
    const target = st.targets[k]
    const def = store.model.attributes.find(a => a.key === target)
    await api.post(`/api/nodes/${encodeURIComponent(st.node)}/attributes`, { attribute: target, locale: def?.perLocale ? st.locale : null, value: textOf(k) })
    return target
  }
  async function take(k) {
    if (!st.targets[k]) { store.toast(t('Zielattribut wählen')); return }
    try { store.toast(`✓ ${await write(k)} gesetzt`, 'ok'); store.poll(true) }
    catch (e) { store.toast(e.message) }
  }
  /// Alle Texte in ihre Zielattribute: was kein Ziel hat oder leer ist, bleibt liegen und wird gezählt
  async function takeAll() {
    const gesetzt = []; let uebrig = 0
    try {
      for (const k of ['definition', 'description', 'faq', 'keywords', 'jsonld']) {
        if (!st.targets[k] || !String(textOf(k) ?? '').trim()) { uebrig++; continue }
        gesetzt.push(await write(k))
      }
    } catch (e) { store.toast(e.message); return }
    finally { if (gesetzt.length) store.poll(true) }
    store.toast(t('✓ {0} Attribute gesetzt', [gesetzt.length]) + (uebrig ? ' · ' + t('{0} ohne Zielattribut oder leer', [uebrig]) : ''), gesetzt.length ? 'ok' : 'error')
  }
  function draw() {
    body.innerHTML = ''
    if (!st.result) { body.append(el('div', { class: 'empty' }, t('Knoten wählen, dann „Vorschlagen“ — die KI schreibt aus den echten Daten; nichts wird ohne „übernehmen“ gespeichert.'))); return }
    body.append(el('div', { class: 'row', style: 'display:flex;gap:6px;margin-bottom:6px' }, el('button', { class: 'primary', title: t('Alle Texte in ihre Zielattribute schreiben'), onclick: takeAll }, t('⇥ alle übernehmen'))))
    for (const [k, label, hint] of FIELDS) {
      const sel = el('select', { title: t('Zielattribut'), onchange: async e => { st.targets[k] = e.target.value; await ctx.data.set('targets', st.targets) } }, el('option', { value: '' }, t('Zielattribut …')), ...textAttrs.map(a => el('option', { value: a.key }, `${L(a.label) || a.key} (${a.key})`)))
      sel.value = st.targets[k] ?? ''
      const ta = el('textarea', { style: 'width:100%;min-height:72px;font:inherit', oninput: e => { if (k === 'faq') return; st.result[k] = e.target.value } }, textOf(k))
      if (k === 'faq') ta.addEventListener('input', e => { st.result.faq = e.target.value.split(/\n\s*\n/).map(b => { const [q, ...a] = b.split('\n'); return { q, a: a.join('\n') } }) })
      body.append(el('div', { class: 'section' }, el('h2', {}, label, ' ', el('span', { class: 'muted' }, '· ' + hint)), ta, el('div', { class: 'row', style: 'display:flex;gap:6px;margin-top:4px' }, sel, el('button', { class: 'primary', onclick: () => take(k) }, t('⇥ übernehmen')))))
    }
    const ld = JSON.stringify(jsonLd(st.result.facts, st.locale), null, 1)
    st.result.jsonld = ld
    const ldSel = el('select', { title: t('Zielattribut'), onchange: async e => { st.targets.jsonld = e.target.value; await ctx.data.set('targets', st.targets) } }, el('option', { value: '' }, t('Zielattribut …')), ...textAttrs.map(a => el('option', { value: a.key }, L(a.label) || a.key)))
    ldSel.value = st.targets.jsonld ?? ''
    body.append(el('div', { class: 'section' }, el('h2', {}, t('Schema.org Product (JSON-LD)') + ' ', el('span', { class: 'muted' }, t('· aus den Daten, ohne KI — für Shop oder Webseite'))), el('pre', { class: 'out', style: 'white-space:pre-wrap;font-size:11px;max-height:240px;overflow:auto' }, ld), el('div', { class: 'row', style: 'display:flex;gap:6px;margin-top:4px' }, ldSel, el('button', { class: 'primary', onclick: () => take('jsonld') }, t('⇥ übernehmen')), el('button', { class: 'x', onclick: () => navigator.clipboard.writeText(ld).then(() => store.toast('kopiert', 'ok')) }, '⧉ kopieren'))))
  }
  root.append(el('div', { class: 'toolbar' }, el('h1', {}, t('✎ GEO-Texte')), el('span', { style: 'position:relative' }, nodeBtn, pick), locSel, el('button', { class: 'primary ai', onclick: suggest }, t('✦ Vorschlagen')), el('span', { class: 'grow' }), status), body)
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
    run({ values, columns }) { return columns.filter(c => descriptive(c, values[c.key]?.value) && words(strip(values[c.key].value)) < 30).map(c => ({ attribute: c.key, message: t('{0} Wörter, weniger als 30', [words(strip(values[c.key].value))]) })) } },
  { key: 'definition', label: t('GEO: kein Definitionssatz'), severity: 'warn',
    run({ row, values, columns }) {
      const name = strip(row.label ?? row.name ?? '').toLowerCase()
      return columns.filter(c => descriptive(c, values[c.key]?.value)).filter(c => { const first = strip(values[c.key].value).split(/(?<=[.!?])\s/)[0].toLowerCase(); return !/\b(ist ein|ist eine|is a|is an|sind|are)\b/.test(first) && !(name && first.includes(name.slice(0, 12))) })
        .map(c => ({ attribute: c.key, message: t('erster Satz nennt weder das Produkt noch „… ist ein …“') })) } },
  { key: 'superlatives', label: t('GEO: Superlative statt Fakten'), severity: 'warn',
    run({ values, columns }) { return columns.filter(c => descriptive(c, values[c.key]?.value) && SUPER.test(strip(values[c.key].value))).map(c => ({ attribute: c.key, message: t('„{0}“ — Werbewort statt Angabe', [strip(values[c.key].value).match(SUPER)[0]]) })) } },
  { key: 'nofacts', label: t('GEO: keine konkreten Angaben'), severity: 'info',
    run({ values, columns }) { return columns.filter(c => descriptive(c, values[c.key]?.value) && !/\d/.test(strip(values[c.key].value))).map(c => ({ attribute: c.key, message: t('keine Zahl, kein Maß, keine Einheit im Text') })) } },
  { key: 'sameasname', label: 'GEO: Text = Name', severity: 'warn',
    run({ row, values, columns }) { const name = strip(row.label ?? row.name ?? '').toLowerCase(); return columns.filter(c => (c.type === 'text' || c.type === 'html') && values[c.key]?.value && strip(values[c.key].value).toLowerCase() === name && name.length > 0).map(c => ({ attribute: c.key, message: t('nur der Produktname — sagt nichts über das Produkt') })) } },
]

// GEO-Reife (01.10.2026): taugt ein Produkt als Quelle für KI-Antworten? Vier Kriterien zu je 25 Punkten, aus den Daten gerechnet, ohne KI. Die Schwellen sind Konstanten.
const FAKTEN_GUT = 8     // so viele konkrete Werte (Zahl, Einheit, Liste, Ja/Nein) gelten als gut belegt
const FRAGEN_GUT = 3     // so viele Frage-Antwort-Paare
const MENGE = /verbrauch|ergiebigkeit|consumption|yield|coverage/i   // Schlüssel oder Bezeichnung eines Mengenattributs
const JE = /\/\s*(m|cm|mm|l|kg|m2|m²|m3|m³|stk|st)(?![a-z0-9])/i             // Einheit „… je …“: kg/m², l/m, g/m²
const eigeneAttribute = c => !/^(geo_|name$|sku$)/.test(c.key)

/// Die Kriterien eines Produkts: { fakten, fragen, entscheidung, berechnung } mit den Rohwerten und den Punkten (je 0–25)
function reifeVon({ row, values, columns, relations }) {
  const belegt = columns.filter(c => eigeneAttribute(c) && String(values[c.key]?.value ?? '').trim() !== '')
  const fakten = belegt.filter(c => ['integer', 'decimal', 'boolean', 'enum'].includes(c.type) || (c.unit && c.type !== 'html')).length
  const faq = columns.find(c => c.key === 'geo_faq') ?? columns.find(c => /faq|frage/i.test(c.key))
  const fragen = String(values[faq?.key]?.value ?? '').split(/\n\s*\n/).filter(b => b.includes('?')).length
  const verbunden = (relations?.[row.id] ?? []).some(r => r.other?.id && r.other.id !== row.id)
  const menge = belegt.some(c => (MENGE.test(c.key) || MENGE.test(c.label?.de ?? '')) && (['integer', 'decimal'].includes(c.type) || !isNaN(Number(String(values[c.key].value).replace(',', '.')))) && (c.unit ? true : JE.test(String(values[c.key].value))))
  return {
    fakten, fragen, verbunden, menge,
    punkte: { fakten: Math.round(25 * Math.min(fakten, FAKTEN_GUT) / FAKTEN_GUT), fragen: Math.round(25 * Math.min(fragen, FRAGEN_GUT) / FRAGEN_GUT), entscheidung: verbunden ? 25 : 0, berechnung: menge ? 25 : 0 },
  }
}
const nurProdukt = ctx => ctx.row.role === 'product'

checks.push(
  { key: 'facts', label: t('GEO: Faktenbasis dünn'), severity: 'info',
    run(c) { if (!nurProdukt(c)) return []; const r = reifeVon(c); return r.fakten >= FAKTEN_GUT ? [] : [{ severity: r.fakten < 4 ? 'warn' : 'info', message: t('{0} konkrete Werte — ab {1} gilt ein Produkt als gut belegt', [r.fakten, FAKTEN_GUT]) }] } },
  { key: 'answers', label: t('GEO: keine Fragen & Antworten'), severity: 'info',
    run(c) { if (!nurProdukt(c)) return []; const r = reifeVon(c); return r.fragen >= FRAGEN_GUT ? [] : [{ attribute: 'geo_faq', severity: r.fragen === 0 ? 'warn' : 'info', message: t('{0} von {1} Fragen mit Antwort', [r.fragen, FRAGEN_GUT]) }] } },
  { key: 'decision', label: t('GEO: keine Entscheidungshilfe'), severity: 'info', needs: ['relations'],
    run(c) { if (!nurProdukt(c)) return []; return reifeVon(c).verbunden ? [] : [{ message: t('keine Relation zu einem anderen Produkt — Alternativen und Systemprodukte fehlen') }] } },
  { key: 'calc', label: t('GEO: Mengenfragen offen'), severity: 'info',
    run(c) { if (!nurProdukt(c)) return []; return reifeVon(c).menge ? [] : [{ message: t('kein Verbrauch oder Ergiebigkeit als Zahl mit Einheit') }] } },
  { key: 'score', label: t('GEO: Reife je Produkt'), severity: 'info', needs: ['relations'],
    run(c) {
      if (!nurProdukt(c)) return []
      const p = reifeVon(c).punkte; const summe = p.fakten + p.fragen + p.entscheidung + p.berechnung
      return [{ message: t('GEO-Reife {0}/100 · Fakten {1} · Antworten {2} · Entscheidung {3} · Berechnung {4}', [summe, p.fakten, p.fragen, p.entscheidung, p.berechnung]) }]
    } },
)

// ---- Analyse (Beitrag zur Datenanalyse, ctx.analyses der Datenqualität): die KI bewertet den dort gewählten Knoten aus seinen Daten — wie gut er als Quelle für
// KI-Antworten taugt, welche Fragen offen bleiben und was zu tun ist. Sie kennt nur diese Daten: keine Websuche, keine Annahmen über andere Seiten.
// Die Punkte der GEO-Reife (ohne KI, aus den Daten gerechnet) gehen als Zahlen mit.
const CLUSTER = { problem: t('Problem'), anwendung: t('Anwendung'), eigenschaft: t('Eigenschaft'), entscheidung: t('Entscheidung') }

async function analyse({ ctx, node, locale, box, say }) {
  const { api, store, ai } = ctx
  if (!node) return
  if (!ai?.available?.() && !ai?.key) { store.toast(t('Kein KI-Schlüssel — Einstellungen → KI')); return }
  say(t('lese Daten …'))
  const f = await facts(ctx, node, locale)
  const rel = await api.get(`/api/nodes/${encodeURIComponent(node)}/relations/tree?deep=false`).catch(() => ({}))
  const verbunden = (rel?.[node] ?? []).filter(r => r.other?.label)
  const columns = f.rows.map(r => store.model.attributes.find(a => a.key === r.key)).filter(Boolean)
  const values = Object.fromEntries(f.rows.map(r => [r.key, { value: r.value }]))
  const reife = reifeVon({ row: { id: node, role: f.role }, values, columns, relations: { [node]: verbunden } })
  say(`frage ${ai.label()} …`)
  const system = t('Du bewertest, wie gut ein Produkt als Quelle für KI-Antworten taugt (GEO). Sprache: {0}. Du kennst nur die gelieferten Daten: keine Websuche, keine Annahmen über andere Seiten, nichts erfinden. Antworte als JSON: { "bewertung": [{ "kriterium": string, "punkte": Zahl 0–10, "begruendung": string }] (Entitätserkennung, Faktenbasis, Abdeckung typischer Fragen, Entscheidungshilfe, Strukturdaten), "fragen": [{ "cluster": "problem" | "anwendung" | "eigenschaft" | "entscheidung", "frage": string }] (je Cluster drei Fragen, wie Käufer sie einem KI-Assistenten stellen), "entscheidung": string (ein bis zwei Sätze: wann dieses Produkt, wann eine Alternative — nur aus den genannten Relationen), "empfehlungen": string[] (höchstens vier, je ein kurzer Satz) }. Jede Begründung ist ein kurzer Satz. Antworte knapp: die Länge der Antwort bestimmt die Wartezeit.', [locale])
  const user = `Produkt: ${f.name}\nPfad: ${f.path}\nSKU: ${f.sku}\nEigenschaften:\n` + f.rows.map(r => `- ${r.label}: ${r.value}${r.unit ? ' ' + r.unit : ''}`).join('\n')
    + `\nRelationen: ${verbunden.length ? verbunden.map(r => `${r.label}: ${r.other.label}`).join('; ') : 'keine'}`
    + `\nGEO-Reife (aus den Daten gerechnet): Fakten ${reife.punkte.fakten}/25 (${reife.fakten} Werte), Fragen & Antworten ${reife.punkte.fragen}/25, Entscheidung ${reife.punkte.entscheidung}/25, Berechnung ${reife.punkte.berechnung}/25`
  const j = await ai.ask({ system, user, json: true, maxTokens: 1500, purpose: t('GEO-Analyse') })
  const a = {
    node: f.name, reife,
    bewertung: Array.isArray(j.bewertung) ? j.bewertung : [], fragen: Array.isArray(j.fragen) ? j.fragen : [],
    entscheidung: String(j.entscheidung ?? ''), empfehlungen: Array.isArray(j.empfehlungen) ? j.empfehlungen : [],
  }
  zeigeAnalyse(box, a, ctx)
  say(t('Analyse von {0}', [ai.label()]))
}

function zeigeAnalyse(box, a, ctx) {
  box.innerHTML = ''
  const p = a.reife.punkte; const summe = p.fakten + p.fragen + p.entscheidung + p.berechnung
  const abschnitt = (titel, ...inhalt) => box.append(el('div', { class: 'section' }, el('h2', {}, titel), ...inhalt))
  abschnitt(t('GEO-Analyse · {0}', [a.node]) + ' ', el('div', { class: 'muted', style: 'padding:4px 8px' }, t('GEO-Reife {0}/100 · Fakten {1} · Antworten {2} · Entscheidung {3} · Berechnung {4}', [summe, p.fakten, p.fragen, p.entscheidung, p.berechnung])))
  if (a.bewertung.length) abschnitt(t('Bewertung'), el('table', { class: 'grid', style: 'width:100%' }, el('tbody', {}, ...a.bewertung.map(b => el('tr', {}, el('td', { style: 'width:220px' }, String(b.kriterium ?? '')), el('td', { class: 'mono', style: 'width:60px' }, `${b.punkte ?? '?'}/10`), el('td', {}, String(b.begruendung ?? '')))))))
  if (a.fragen.length) {
    const nach = Object.keys(CLUSTER).map(k => [k, a.fragen.filter(x => x.cluster === k)]).filter(([, l]) => l.length)
    abschnitt(t('Offene Fragen · {0}', [a.fragen.length]), ...nach.map(([k, l]) => el('div', { style: 'padding:2px 8px' }, el('b', {}, CLUSTER[k]), el('ul', { style: 'margin:2px 0 6px 18px' }, ...l.map(x => el('li', {}, String(x.frage ?? '')))))),
      el('div', { class: 'row', style: 'display:flex;gap:6px;padding:4px 8px' }, el('button', { class: 'x', onclick: () => navigator.clipboard.writeText(a.fragen.map(x => x.frage).join('\n')).then(() => ctx.store.toast(t('kopiert'), 'ok')) }, t('⧉ Fragen kopieren'))))
  }
  if (a.entscheidung.trim()) abschnitt(t('Entscheidungshilfe'), el('div', { style: 'padding:4px 8px;white-space:pre-wrap' }, a.entscheidung))
  if (a.empfehlungen.length) abschnitt(t('Empfehlungen'), el('ul', { style: 'margin:4px 8px 4px 26px' }, ...a.empfehlungen.map(x => el('li', {}, String(x)))))
}

/// Beim Einschalten: Attributgruppe und Attribute anlegen (nach einem Hinweis), an die Wurzeln hängen, Zielattribute vorbelegen, anmelden.
/// Was es schon gibt, bleibt; fehlt nichts, kommt kein Hinweis. Lehnt der Anwender ab, ist das Plugin wieder aus (false).
async function install(ctx) {
  const { api, store, tree } = ctx
  if (!tree.loaded) await tree.load()
  const model = store.model
  const hatGruppe = (model.groups ?? []).some(g => g.key === GROUP)
  const fehlen = ATTRIBUTES.filter(([, key]) => !(model.attributes ?? []).some(a => a.key === key))
  if (!hatGruppe || fehlen.length) {
    const ok = await ctx.system?.ankuendigen?.({
      label: t('GEO-Texte'),
      text: t('Das Plugin legt die Attributgruppe {0} mit {1} Attributen an. Ohne sie arbeitet es nicht, und solange es an ist, lassen sie sich nicht zurückziehen.', [GROUP, fehlen.length]),
    }) ?? true
    if (!ok) return false
    if (!hatGruppe) await api.post(`/api/model/groups/${GROUP}`, { key: GROUP, label: GROUP_LABEL, activeFrom: null }, 'PUT')
    // vererbbar (07.10.2026): die Texte stehen am Produkt oder an der Gruppe und gelten nach unten
    for (const [, key, label] of fehlen) await api.post(`/api/model/attributes/${key}`, { key, label, type: 'text', group: GROUP, axes: ['locale'], inheritable: true }, 'PUT')
    await store.poll(true)
  }
  // an die Wurzeln des Baums, damit die Attribute überall gelten
  if (!tree.loaded) await tree.load()
  for (const rootRow of tree.rows.filter(r => !r.parent && r.role !== 'rubric')) {
    const have = (rootRow.groups ?? '').split(',').filter(Boolean)
    if (!have.includes(GROUP)) await api.post(`/api/nodes/${encodeURIComponent(rootRow.id)}/groups`, { groups: [...have, GROUP] }, 'PUT')
  }
  // die erzeugten Texte gehen standardmässig in die Attribute des Plugins; ein gemerktes Ziel bleibt
  const stored = (await ctx.data.get('targets').catch(() => null)) ?? {}
  const targets = { ...DEFAULT_TARGETS, ...Object.fromEntries(Object.entries(stored).filter(([, key]) => key)) }   // die Attribute gibt es jetzt
  if (JSON.stringify(targets) !== JSON.stringify(stored)) await ctx.data.set('targets', targets)
  await ctx.system?.melden?.([GROUP], ATTRIBUTES.map(([, key]) => key))
  return true
}

export { reifeVon }
/// Die Systemobjekte als Daten — der Server der Demo legt sie damit an (Journali.Server/demo-system.mjs)
export const SYSTEM = { group: GROUP, label: GROUP_LABEL, attributes: ATTRIBUTES, targets: DEFAULT_TARGETS }

export default {
  install,
  views: [{ path: 'texts', label: 'GEO-Texte', icon: '✎', topic: 'analysis', hint: t('KI-Vorschläge für Suchmaschinen und KI-Antworten aus den Produktdaten; Schema.org JSON-LD; Prüfregeln in der Datenqualität'), mount }],
  nodeActions: [{ label: t('GEO-Texte vorschlagen'), icon: '✎', topic: 'analysis', roles: ['product', 'variant', 'group'], run(id, ctx) { localStorage.setItem('journali.geo.node', id); ctx.go?.('/p/geo/texts') } }],
  checks,
  analyses: [{ key: 'ki', label: t('GEO-Analyse'), title: t('Knoten bewerten, offene Fragen und Empfehlungen nennen (die KI kennt nur die Daten dieses Knotens)'), run: analyse }],
}
