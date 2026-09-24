// Plugin enrich:
// Man wählt die Attribute, die fehlen dürfen nicht, und einen Teilbaum — die Prüfmaschine der Oberfläche (ctx.compliance, dieselbe
// wie DPP/PPWR/ETIM) zeigt je Knoten, was leer ist, und holt Vorschläge: aus Regeln, von der KI aus den vorhandenen Werten,
// oder mit Recherche im Internet (Hersteller, Typ, EAN → Datenblatt) — jeder Wert mit Quelle, nichts wird ohne Haken geschrieben.
// Der Katalog ist hier kein Gesetz, sondern die Auswahl des Nutzers (ctx.data „attributes“).
const L = l => globalThis.journali?.L ? globalThis.journali.L(l) : (l?.de ?? Object.values(l ?? {})[0] ?? '')   // Bezeichnung in der Oberflächensprache
const t = (k, p) => globalThis.journali?.t ? globalThis.journali.t(k, p) : String(k).replace(/\{(\w+)\}/g, (m, i) => p?.[i] ?? m)   // Oberflächensprache: spät gebunden, im Test ohne Fenster ladbar
function el(tag, attrs = {}, ...kids) { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'class') e.className = v; else e.setAttribute(k, v) } for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : String(c)); return e }
const TYPE = { integer: 'decimal', decimal: 'decimal', boolean: 'boolean', date: 'date', enum: 'enum', text: 'text', html: 'text' }

/// Katalog aus gewählten Attributen: jedes Attribut ein Pflicht-Datenpunkt, Zuordnung auf sich selbst
function buildCatalog(model, keys, locale) {
  const lbl = a => a.label?.[locale] || L(a.label) || a.key
  const byGroup = new Map()
  for (const a of model.attributes.filter(a => keys.includes(a.key))) {
    const g = a.group || ''; if (!byGroup.has(g)) byGroup.set(g, [])
    const list = a.type === 'enum' && a.list ? model.lists.find(l => l.key === a.list) : null
    byGroup.get(g).push({
      key: a.key, label: lbl(a), level: 'must', type: TYPE[a.type] ?? 'text', unit: a.unit ?? null, perLocale: !!a.perLocale,
      values: list ? list.values.map(v => v.label?.[locale] || L(v.label) || v.value) : null,
      synonyms: [a.key, ...Object.values(a.label ?? {})],
      hint: a.pattern ? t('Muster: {0}', [a.patternHint || a.pattern]) : a.type === 'html' ? 'HTML-Text' : '',
    })
  }
  const groups = [...byGroup.entries()].map(([g, items]) => ({ key: g || 'none', label: model.groups?.find(x => x.key === g)?.label?.[locale] || g || t('ohne Gruppe'), items }))
  return {
    key: 'enrich', label: t('Anreicherung'), icon: '⌕', source: 'https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/web-search-tool', sourceLabel: t('Websuche ↗'),
    description: keys.length ? t('{0} Attribute gewählt. Fehlende Werte: aus Regeln ableiten, von der KI aus den vorhandenen Werten vorschlagen lassen — oder für Handelsware im Internet recherchieren (Herstellerseite, Datenblatt; je Wert die Quelle). Übernommen wird nur, was angehakt ist.', [keys.length]) : t('Oben Attribute wählen, die gefüllt sein sollen.'),
    groupKey: 'enrich', groupLabel: t('Anreicherung'), prefix: '',
    groups,
  }
}

async function mount(root, ctx) {
  const { store, tree } = ctx
  if (!tree.loaded) await tree.load()
  const model = store.model; const locale = model.masterLocale ?? 'de'
  const lbl = a => a.label?.[locale] || L(a.label) || a.key
  const st = { keys: (await ctx.data.get('attributes')) ?? [], q: '', open: false }
  root.style.cssText = 'display:flex;flex-direction:column;height:100%;padding:0'
  const head = el('div', { style: 'flex:none;border-bottom:1px solid var(--line);padding:6px 8px' })
  const sub = el('div', { style: 'flex:1;min-height:0;display:flex;flex-direction:column' })
  root.append(head, sub)
  let unmount = () => {}
  async function remount() { unmount?.(); sub.innerHTML = ''; unmount = await ctx.compliance.mount(sub, ctx, buildCatalog(model, st.keys, locale)) }
  const remember = () => ctx.data.set('attributes', st.keys).catch(() => {})
  function drawHead() {
    head.innerHTML = ''
    const chosen = model.attributes.filter(a => st.keys.includes(a.key))
    const bar = el('div', { class: 'chips' }, el('b', {}, t('{0} Attribute', [chosen.length])),
      ...chosen.map(a => el('span', { class: 'view-chip on', title: t('{0} — Klick entfernt', [a.key]), onclick: () => { st.keys = st.keys.filter(k => k !== a.key); remember(); drawHead(); remount() } }, lbl(a), ' ✕')),
      el('button', { class: 'x', title: t('Attribute wählen, die gefüllt sein sollen'), onclick: () => { st.open = !st.open; drawHead() } }, st.open ? '▴ fertig' : t('+ Attribute')))
    head.append(bar)
    if (!st.open) return
    const q = el('input', { type: 'search', placeholder: 'filtern', value: st.q, style: 'width:200px;margin:6px 0', oninput: e => { st.q = e.target.value; drawList() } })
    const list = el('div', { class: 'scroll', style: 'max-height:220px' })
    const drawList = () => {
      list.innerHTML = ''
      const s = st.q.trim().toLowerCase()
      const attrs = model.attributes.filter(a => !['rows', 'formula', 'template'].includes(a.type) && (!s || a.key.toLowerCase().includes(s) || lbl(a).toLowerCase().includes(s)))
      const groups = new Map(); for (const a of attrs) { const g = a.group || ''; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(a) }
      for (const [g, as] of groups) {
        const all = as.every(a => st.keys.includes(a.key))
        list.append(el('div', { class: 'chips', style: 'margin:3px 0' }, el('span', { class: 'muted', style: 'font-size:12px;width:140px;cursor:pointer', title: all ? t('Gruppe abwählen') : t('ganze Gruppe wählen'), onclick: () => { st.keys = all ? st.keys.filter(k => !as.some(a => a.key === k)) : [...new Set([...st.keys, ...as.map(a => a.key)])]; remember(); drawHead(); remount() } }, `▤ ${model.groups?.find(x => x.key === g)?.label?.[locale] || g || 'ohne Gruppe'}`),
          ...as.map(a => el('span', { class: 'view-chip' + (st.keys.includes(a.key) ? ' on' : ''), title: `${a.key} · ${a.type}`, onclick: () => { st.keys = st.keys.includes(a.key) ? st.keys.filter(k => k !== a.key) : [...st.keys, a.key]; remember(); drawHead(); remount() } }, lbl(a)))))
      }
    }
    drawList(); head.append(q, list)
  }
  drawHead(); await remount()
  return () => unmount?.()
}

export default {
  views: [{ path: 'enrich', label: t('Anreicherung'), icon: '⌕', topic: 'analysis', hint: t('Fehlende Werte gewählter Attribute finden und ergänzen — aus Regeln, KI oder Recherche im Internet (Handelsware: Herstellerdaten, Datenblätter), je Wert mit Quelle'), mount }],
  nodeActions: [{ label: t('Anreichern'), icon: '⌕', topic: 'analysis', roles: ['group', 'product'], run(id, ctx) { localStorage.setItem('journali.cmp.enrich.root', id); ctx.go?.('/p/enrich/enrich?run=1') } }],
}
