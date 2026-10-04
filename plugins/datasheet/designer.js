// Datenblatt-Designer, WYSIWYG: Seite wie gedruckt, Bausteine per Drag & Drop —
// Abschnitte mit 1–4 Spalten, darin Attributgruppen (als Wertetabelle), einzelne Attribute, Bild, Text,
// Variantentabelle, Seitenumbruch. Die Palette zeigt die Attributgruppen und Attribute AB EINEM KNOTEN,
// einschliesslich allem, was an seinen Kindern vorkommt (Server: /table?deep=true). Das Layout ist JSON im
// Journal (ctx.data „layout:<name>“), je Rolle zugeordnet; das fertige Blatt ist dieselbe Wiedergabe ohne Griffe.
import { dataOf, el } from './entry.js'

// ---- Layout-Modell ----------------------------------------------------------------------------
let seq = 1
const nid = () => 'b' + (seq++) + Date.now().toString(36).slice(-3)
export const DEFAULT_LAYOUT = () => ({
  page: { size: 'A4', landscape: false, margin: 14, font: 10 },
  blocks: [
    { id: nid(), kind: 'header', title: '{name}', sub: '{sku}', right: '{today}' },
    { id: nid(), kind: 'section', title: '', columns: 2, cells: [[{ id: nid(), kind: 'image', which: 'first', height: 60 }], [{ id: nid(), kind: 'attr', attr: 'description', label: false }]] },
    { id: nid(), kind: 'section', title: 'Technische Daten', columns: 2, cells: [[], []] },
    { id: nid(), kind: 'variants', attrs: [] },
    { id: nid(), kind: 'footer', text: 'Stand {today} · Angaben ohne Gewähr' },
  ],
})
const PALETTE = [
  { kind: 'section', columns: 1, label: '▭ Abschnitt, 1 Spalte' }, { kind: 'section', columns: 2, label: '▯▯ Abschnitt, 2 Spalten' },
  { kind: 'section', columns: 3, label: '▯▯▯ Abschnitt, 3 Spalten' }, { kind: 'section', columns: 4, label: '▯▯▯▯ Abschnitt, 4 Spalten' },
  { kind: 'text', label: '¶ Text' }, { kind: 'list', label: '⁝ Aufzählung' }, { kind: 'image', label: '▨ Bild' }, { kind: 'variants', label: '⊞ Datentabelle (Subitems)' }, { kind: 'compare', label: '⊟ Vergleichstabelle' }, { kind: 'pagebreak', label: '⤓ Seitenumbruch' },
]
const newItem = t => t.kind === 'section' ? { id: nid(), kind: 'section', title: '', columns: t.columns, cells: Array.from({ length: t.columns }, () => []) }
  : t.kind === 'text' ? { id: nid(), kind: 'text', html: 'Text …' }
  : t.kind === 'list' ? { id: nid(), kind: 'list', attr: t.attr ?? '', label: false, marker: 'disc', columns: 1 }
  : t.kind === 'image' ? { id: nid(), kind: 'image', which: 'first', height: 50 }
  : t.kind === 'variants' ? { id: nid(), kind: 'variants', attrs: [], group: '' }
  : t.kind === 'compare' ? { id: nid(), kind: 'compare', source: 'variants', nodes: [], group: '', attrs: [], diff: false, empty: false }
  : t.kind === 'group' ? { id: nid(), kind: 'group', group: t.group, title: true, empty: false }
  : t.kind === 'attr' ? { id: nid(), kind: 'attr', attr: t.attr, label: true }
  : { id: nid(), kind: t.kind }

// ---- Wiedergabe: dieselbe für Designer (edit) und Blatt -------------------------------------
/// n:m (29.09.2026): ein Attribut gehoert zu einer Gruppe ueber seine Zuordnung oder eine Mitgliedschaft
const inGruppe = (a, key) => !!key && (a?.groups ?? (a?.group ? [a.group] : [])).includes(key)
const fill = (s, d) => String(s ?? '').replace(/\{(\w+)\}/g, (_, k) => d[k] ?? d.attr?.[k] ?? '')
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function valueCell(d, key) {
  const type = d.types?.[key]; const v = d.attr?.[key]
  if (v == null || v === '') return null
  return type === 'html' ? el('span', { html: v }) : el('span', {}, `${v}${d.unit?.[key] ? ' ' + d.unit[key] : ''}`)
}
function renderItem(it, d, model, edit, ctx) {
  const label = k => model.attributes.find(a => a.key === k)?.label?.[d.locale] || model.attributes.find(a => a.key === k)?.label?.de || k
  let e
  switch (it.kind) {
    case 'group': {
      const g = model.groups.find(x => x.key === it.group)
      const keys = model.attributes.filter(a => inGruppe(a, it.group) && !['rows', 'html'].includes(a.type)).map(a => a.key)
      const rows = keys.map(k => [k, valueCell(d, k)]).filter(([, v]) => it.empty || v)
      e = el('div', { class: 'ds-group' })
      if (it.title !== false) e.append(el('h3', {}, g?.label?.[d.locale] || g?.label?.de || it.group))
      const table = el('table', { class: 'ds-table' })
      for (const [k, v] of rows) table.append(el('tr', {}, el('td', { class: 'k' }, label(k)), el('td', {}, v ?? '—')))
      if (!rows.length) table.append(el('tr', {}, el('td', { class: 'k muted' }, edit ? `(${keys.length} Attribute, hier alle leer)` : '')))
      e.append(table); break
    }
    case 'attr': {
      e = el('div', { class: 'ds-attr' })
      if (it.label !== false) e.append(el('span', { class: 'k' }, label(it.attr) + ': '))
      e.append(valueCell(d, it.attr) ?? el('span', { class: 'muted' }, edit ? `{${it.attr}}` : '')); break
    }
    case 'list': {
      // Ein mehrwertiges Attribut als Aufzählung: je Wert eine Zeile. Der Wert kommt aus `listen`, nicht aus `attr` —
      // dort stehen die Werte als ein Satz mit Kommas, und ein Wert kann selbst eines tragen (29.09.2026)
      const werte = d.listen?.[it.attr] ?? (d.attr?.[it.attr] ? [String(d.attr[it.attr])] : [])
      e = el('div', { class: 'ds-list' })
      if (it.label) e.append(el('h3', {}, label(it.attr)))
      if (werte.length) {
        const ul = el('ul', { class: 'ds-ul', style: `list-style:${it.marker === 'none' ? 'none' : it.marker === 'dash' ? 'none' : it.marker}` + (it.columns > 1 ? `;column-count:${it.columns}` : '') })
        for (const w of werte) ul.append(el('li', {}, it.marker === 'dash' ? '– ' + w : w))
        e.append(ul)
      } else e.append(el('div', { class: 'muted' }, edit ? `{${it.attr || 'kein Attribut'}}` : ''))
      break
    }
    case 'image': {
      const imgs = it.which === 'all' ? d.images : d.images.slice(0, 1)
      e = el('div', { class: 'ds-images' }, ...imgs.map(i => el('img', { src: i.url, style: `max-height:${it.height ?? 50}mm` })))
      if (!imgs.length) e.append(el('div', { class: 'ds-noimg muted' }, edit ? '▨ kein Bild am Knoten' : '')); break
    }
    case 'text':
      e = el('div', { class: 'ds-text', html: fill(it.html, d) })
      if (edit) { e.contentEditable = 'true'; e.addEventListener('input', () => { it.html = e.innerHTML; ctx.dirty() }); e.addEventListener('mousedown', ev => ev.stopPropagation()) }
      break
    case 'variants': {
      // Datentabelle: eine Zeile je Subitem — Varianten am Produkt, Produkte an der Gruppe; Spalten aus einer Gruppe, einzeln oder die Achsen
      const vs = d.children ?? d.variants ?? []
      const axes = [...new Set(vs.flatMap(v => (v.axes ?? []).map(a => a.key)))]
      const cols = it.group ? model.attributes.filter(a => inGruppe(a, it.group) && !['rows', 'html'].includes(a.type)).map(a => a.key) : it.attrs?.length ? it.attrs : axes
      e = el('table', { class: 'ds-table ds-variants' })
      const first = vs.some(v => v.role === 'variant') ? 'SKU' : 'Name'
      e.append(el('tr', {}, el('th', {}, first), ...cols.map(k => el('th', {}, label(k)))))
      for (const v of vs) e.append(el('tr', {}, el('td', { class: first === 'SKU' ? 'mono' : '' }, first === 'SKU' ? v.sku : v.name), ...cols.map(k => el('td', {}, (v.axes ?? []).find(a => a.key === k)?.value ?? valueCell(v, k) ?? ''))))
      if (!vs.length) e.append(el('tr', {}, el('td', { class: 'muted', colspan: String(cols.length + 1) }, edit ? '(keine Subitems am gewählten Knoten)' : '')))
      break
    }
    case 'compare': {
      // Spalten: Knoten (Varianten, Subitems oder gewählte); Zeilen: Attribute einer Gruppe oder einzeln; Werte aus dem Cache je Knoten
      const ids = compareNodes(it, d, ctx?.tree)
      const keys = it.group ? model.attributes.filter(a => inGruppe(a, it.group) && !['rows', 'html'].includes(a.type)).map(a => a.key) : (it.attrs ?? [])
      const datas = ids.map(id => d.cache?.[id] ?? null)
      ids.forEach((id, i) => { if (!datas[i]) ctx?.need?.(id) })
      e = el('table', { class: 'ds-table ds-compare' })
      e.append(el('tr', {}, el('th', {}), ...ids.map((id, i) => el('th', {}, datas[i]?.name ?? (ctx?.tree?.byId.get(id)?.label ?? id)))))
      let rows = 0
      for (const k of keys) {
        const cells = datas.map(x => x ? valueCell(x, k) : null)
        const texts = datas.map(x => x?.attr?.[k] ?? '')
        if (!it.empty && texts.every(t => t === '' || t == null)) continue
        if (it.diff && new Set(texts).size < 2) continue
        e.append(el('tr', {}, el('td', { class: 'k' }, label(k)), ...cells.map(c => el('td', {}, c ?? '')))); rows++
      }
      if (!ids.length) e.append(el('tr', {}, el('td', { class: 'muted', colspan: '2' }, edit ? '(keine Knoten — Quelle rechts wählen)' : '')))
      else if (!keys.length) e.append(el('tr', {}, el('td', { class: 'muted', colspan: String(ids.length + 1) }, edit ? '(Zeilen: rechts Gruppe oder Attribute wählen)' : '')))
      else if (!rows) e.append(el('tr', {}, el('td', { class: 'muted', colspan: String(ids.length + 1) }, edit ? (datas.some(x => !x) ? 'lade …' : it.diff ? '(keine Unterschiede)' : '(alles leer)') : '')))
      break
    }
    default: e = el('div', {}, it.kind)
  }
  return e
}
/// Welche Knoten die Vergleichstabelle zeigt
export function compareNodes(it, d, tree) {
  if (it.source === 'pick') return it.nodes ?? []
  if (!d.id || !tree) return []
  const kids = tree.kids(d.id)   // Subitems: Varianten am Produkt, Produkte an der Gruppe
  return (it.source === 'children' ? kids : kids.filter(k => k.role === 'variant')).map(k => k.id)
}
/// Vor dem fertigen Blatt: die Daten aller Vergleichsknoten laden
export async function preloadCompare(ctx, layout, d, locale) {
  d.cache ??= {}
  const items = layout.blocks.flatMap(b => b.kind === 'section' ? b.cells.flat() : [b]).filter(x => x.kind === 'compare')
  const ids = [...new Set(items.flatMap(it => compareNodes(it, d, ctx.tree)))].filter(id => !d.cache[id])
  const types = Object.fromEntries(ctx.store.model.attributes.map(a => [a.key, a.type]))
  await Promise.all(ids.map(async id => { const x = await dataOf(ctx, id, locale, 1); x.types = types; x.locale = locale; d.cache[id] = x }))
}
function renderBlock(b, d, model, edit, ctx) {
  switch (b.kind) {
    case 'header': return el('header', { class: 'ds-header' }, el('div', {}, el('h1', {}, fill(b.title, d)), el('div', { class: 'ds-sub mono' }, fill(b.sub, d))), el('div', { class: 'muted' }, fill(b.right, d)))
    case 'footer': return el('footer', { class: 'ds-footer muted' }, fill(b.text, d))
    case 'pagebreak': return el('div', { class: 'ds-break' }, edit ? '⤓ Seitenumbruch' : '')
    case 'variants': case 'compare': return renderItem(b, d, model, edit, ctx)
    case 'text': case 'image': case 'list': return renderItem(b, d, model, edit, ctx)
    case 'section': {
      const s = el('section', { class: 'ds-section', style: `grid-template-columns: repeat(${b.columns}, 1fr)` })
      if (b.title) s.append(el('h2', { style: 'grid-column: 1 / -1' }, fill(b.title, d)))
      b.cells.forEach((cell, ci) => {
        const col = el('div', { class: 'ds-col' })
        cell.forEach((it, ii) => { const w = el('div', { class: 'ds-item' }, renderItem(it, d, model, edit, ctx)); if (edit) ctx.decorateItem(w, it, b, ci, ii); col.append(w) })
        if (edit) ctx.decorateCol(col, b, ci)
        s.append(col)
      })
      return s
    }
    default: return renderItem(b, d, model, edit, ctx)   // Gruppe/Attribut auf oberster Ebene (ältere Layouts) statt „undefined“
  }
}
const SHEET_CSS = `
  body { color: #1f2328; margin: 0; }
  .ds-page { background: #fff; color: #1f2328; box-sizing: border-box; }
  .ds-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #2563eb; padding-bottom: 4px; margin-bottom: 8px; }
  .ds-header h1 { font-size: 2em; margin: 0; } .ds-sub { color: #6b7280; }
  .ds-section { display: grid; gap: 6mm; margin: 0 0 5mm; align-items: start; }
  .ds-section h2 { font-size: 1.15em; margin: 2mm 0 1mm; color: #2563eb; border-bottom: 1px solid #dbeafe; }
  .ds-group h3 { font-size: 1em; margin: 0 0 1mm; }
  .ds-table { border-collapse: collapse; width: 100%; } .ds-table td, .ds-table th { padding: 0.6mm 1.5mm; border-bottom: 1px solid #eee; vertical-align: top; text-align: left; }
  .ds-table td.k { color: #6b7280; width: 42%; } .ds-variants th, .ds-compare th { background: #eef2f7; }
  .ds-compare td.k { width: auto; white-space: nowrap; }
  .ds-list ul { margin: 0; padding-left: 1.1em; } .ds-list ul[style*="list-style:none"] { padding-left: 0; }
  .ds-list li { margin: 0 0 1mm; break-inside: avoid; } .ds-list h3 { margin: 0 0 1mm; }
  .ds-attr .k { color: #6b7280; } .ds-images img { max-width: 100%; object-fit: contain; display: block; }
  .ds-footer { margin-top: 6mm; font-size: 0.8em; border-top: 1px solid #ddd; padding-top: 1mm; }
  .ds-break { break-after: page; height: 0; }
  .ds-page .muted { color: #6b7280; } .ds-page .mono { font-family: ui-monospace, Consolas, monospace; }
`
export function renderSheet(layout, d, model) {
  const p = layout.page
  const page = el('div', { class: 'ds-page', style: `font: ${p.font}pt/1.35 system-ui, "Segoe UI", Arial, sans-serif; padding: ${p.margin}mm` })
  for (const b of layout.blocks) page.append(renderBlock(b, d, model, false, null))
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(d.name)}</title><style>@page { size: ${p.size} ${p.landscape ? 'landscape' : 'portrait'}; margin: 0 } ${SHEET_CSS}</style></head><body>${page.outerHTML}</body></html>`
}

// ---- Vorlagen im Journal ---------------------------------------------------------------------
const L = 'layout:'
export async function layouts(ctx) { const names = await ctx.data.list().catch(() => []); return names.filter(n => n.startsWith(L)).map(n => n.slice(L.length)) }
export async function layoutFor(ctx, role) {
  const s = (await ctx.data.get('settings')) ?? {}
  const name = s[role] ?? 'standard'
  const l = await ctx.data.get(L + name)
  return { name, layout: l ?? DEFAULT_LAYOUT(), locale: s.locale ?? ctx.store.model?.masterLocale ?? 'de' }
}

// ---- Der Designer --------------------------------------------------------------------------------
const DESIGNER_CSS = `
  .dsd { display: flex; flex: 1; min-height: 0; }
  .dsd .pal { width: 250px; border-right: 1px solid var(--line); overflow: auto; padding: 6px; font-size: 12px; }
  .dsd .pal h4 { margin: 8px 0 4px; font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
  .dsd .pi { padding: 4px 8px; margin: 2px 0; border: 1px solid var(--line); border-radius: 4px; background: var(--cell); cursor: grab; display: flex; justify-content: space-between; gap: 6px; }
  .dsd .pi:hover { border-color: var(--accent); } .dsd .pi .muted { font-size: 11px; }
  .dsd .canvas { flex: 1; overflow: auto; background: #4b5563; padding: 20px; min-width: 0; }
  .dsd .ds-page { margin: 0 auto; box-shadow: 0 8px 30px rgba(0,0,0,.4); position: relative; }
  .dsd .props { width: 250px; border-left: 1px solid var(--line); overflow: auto; padding: 8px; font-size: 12px; }
  .dsd .props label { display: block; margin-top: 8px; color: var(--muted); }
  .dsd .props input[type=text], .dsd .props input[type=number], .dsd .props select { width: 100%; font-size: 12px; }
  .dsd .ds-col { min-height: 12mm; outline: 1px dashed rgba(37,99,235,.35); outline-offset: -1px; border-radius: 2px; }
  .dsd .ds-col.over { background: rgba(37,99,235,.12); }
  .dsd .ds-item { position: relative; border: 1px solid transparent; border-radius: 3px; cursor: grab; }
  .dsd .ds-item:hover { border-color: rgba(37,99,235,.5); } .dsd .ds-item.sel { border-color: #2563eb; box-shadow: 0 0 0 1px #2563eb; }
  .dsd .ds-item.over { border-top: 2px solid #2563eb; }
  .dsd .ds-x { position: absolute; top: -8px; right: -8px; width: 16px; height: 16px; border-radius: 8px; background: #b91c1c; color: #fff; font-size: 11px; line-height: 16px; text-align: center; cursor: pointer; display: none; }
  .dsd .ds-item:hover > .ds-x, .dsd .ds-blk:hover > .ds-x { display: block; }
  .dsd .ds-blk { position: relative; border: 1px solid transparent; border-radius: 3px; }
  .dsd .ds-blk:hover { border-color: rgba(37,99,235,.35); } .dsd .ds-blk.sel { border-color: #2563eb; } .dsd .ds-blk.over { border-top: 2px solid #2563eb; }
  /* Griff: er sass ausserhalb des Blocks und war nur bei
     Hover des Blocks da; auf dem Weg dorthin verliess die Maus den Block. Jetzt immer da (blass), kräftig bei Hover — und der
     Block reicht nach links bis unter den Griff, damit der Hover nicht abreisst. */
  .dsd .ds-blk { margin-left: -18px; padding-left: 18px; }
  .dsd .ds-grip { position: absolute; left: 2px; top: 0; color: #9ca3af; cursor: grab; font-size: 14px; opacity: .35; }
  .dsd .ds-blk:hover > .ds-grip, .dsd .ds-grip:hover { opacity: 1; color: #2563eb; }
  .dsd .ds-text[contenteditable] { outline: 1px dotted #9ca3af; min-height: 1.4em; padding: 1px 2px; }
`
export async function mountDesigner(root, ctx) {
  const { store, tree, api } = ctx
  if (!tree.loaded) await tree.load()
  const model = store.model
  if (!document.getElementById('dsd-css')) document.head.append(el('style', { id: 'dsd-css' }, DESIGNER_CSS + SHEET_CSS.replace(/body \{[^}]*\}/, '')))
  const st = { name: 'standard', layout: DEFAULT_LAYOUT(), node: localStorage.getItem('journali.datasheet.node') || null, locale: store.model?.masterLocale ?? 'de', data: null, avail: null, sel: null, dirty: false }
  const sett = (await ctx.data.get('settings')) ?? {}
  if (sett.locale) st.locale = sett.locale
  if (st.node && !tree.byId.get(st.node)) st.node = null
  root.style.cssText = 'display:flex;flex-direction:column;height:100%;padding:0'

  // -- Kopf: Vorlage, Rollen, Knoten, Sprache, Blatt
  const names = await layouts(ctx)
  const nameSel = el('select', {}, ...['standard', ...names.filter(n => n !== 'standard')].map(n => el('option', { value: n }, n)))
  const nameIn = el('input', { type: 'text', placeholder: 'neuer Name', style: 'width:110px' })
  const roleSel = role => { const s = el('select', { title: `Vorlage für ${role}` }, ...['standard', ...names.filter(n => n !== 'standard')].map(n => el('option', { value: n }, n))); s.value = sett[role] ?? 'standard'; s.addEventListener('change', async () => { sett[role] = s.value; await ctx.data.set('settings', sett); store.toast(`${role} → ${s.value}`, 'ok') }); return s }
  // Knoten per Auswahlbaum: Knopf zeigt den gewählten, Klick klappt den Baum darunter auf
  const nodeBtn = el('button', { class: 'x', title: 'Knoten für die Vorschau wählen' }, st.node ? `${{ group: '▣', product: '▦', variant: '◆' }[tree.byId.get(st.node)?.role] ?? ''} ${tree.byId.get(st.node)?.label ?? ''}` : '🔍 Knoten wählen')
  const pick = el('div', { class: 'picker', style: 'position:absolute;right:0;top:28px;z-index:5;width:380px;display:none;padding:6px;background:var(--pane)' })
  ctx.treePicker(pick, { value: st.node, roles: ['group', 'product', 'variant'], height: 300, onPick: r => { st.node = r.id; nodeBtn.textContent = `${{ group: '▣', product: '▦', variant: '◆' }[r.role]} ${r.label}`; pick.style.display = 'none'; localStorage.setItem('journali.datasheet.node', r.id); reload() } })
  nodeBtn.addEventListener('click', () => { pick.style.display = pick.style.display === 'none' ? 'block' : 'none' })
  const nodeIn = nodeBtn
  const localeSel = el('select', {}, ...(model?.locales ?? []).map(l => el('option', { value: l.code }, l.code))); localeSel.value = st.locale
  localeSel.addEventListener('change', () => { st.locale = localeSel.value; sett.locale = st.locale; ctx.data.set('settings', sett); reload() })
  const dirtyChip = el('span', { class: 'chip', style: 'display:none' }, '✎ ungespeichert')
  async function save() {
    const n = nameIn.value.trim() || nameSel.value
    await ctx.data.set(L + n, st.layout); st.name = n; st.dirty = false; dirtyChip.style.display = 'none'
    if (![...nameSel.options].some(o => o.value === n)) nameSel.append(el('option', { value: n }, n))
    nameSel.value = n; nameIn.value = ''; store.toast(`Layout „${n}“ gespeichert`, 'ok')
  }
  async function loadLayout(n) { const l = await ctx.data.get(L + n); st.layout = l ?? DEFAULT_LAYOUT(); st.name = n; st.sel = null; st.dirty = false; dirtyChip.style.display = 'none'; draw() }
  nameSel.addEventListener('change', () => loadLayout(nameSel.value))
  root.append(el('div', { class: 'toolbar' }, el('h1', {}, '▤ Datenblatt-Designer'), nameSel, nameIn,
    el('button', { class: 'primary', onclick: save, title: 'Layout speichern (Strg+S)' }, '💾'), dirtyChip,
    el('span', { class: 'sep' }, '·'), el('span', { class: 'muted' }, '▣'), roleSel('group'), el('span', { class: 'muted' }, '▦'), roleSel('product'), el('span', { class: 'muted' }, '◆'), roleSel('variant'),
    el('span', { class: 'grow' }), el('span', { style: 'position:relative' }, nodeIn, pick), localeSel,
    el('button', { onclick: () => { if (!st.node || !st.data) return; const w = window.open('', '_blank'); if (!w) return; w.document.open(); w.document.write(renderSheet(st.layout, st.data, model)); w.document.close() }, title: 'fertiges Blatt in neuem Fenster (drucken → PDF)' }, '⎙ Blatt')))

  // -- drei Bereiche
  const pal = el('div', { class: 'pal' }), canvas = el('div', { class: 'canvas' }), props = el('div', { class: 'props' })
  root.append(el('div', { class: 'dsd' }, pal, canvas, props))
  const loading = new Set()
  const dctx = { dirty() { st.dirty = true; dirtyChip.style.display = '' }, decorateItem, decorateCol, tree,
    // Vergleichstabelle braucht Daten anderer Knoten: nachladen, dann neu zeichnen
    need(id) { if (!st.data || st.data.cache?.[id] || loading.has(id)) return; loading.add(id); dataOf(ctx, id, st.locale, 1).then(x => { x.types = st.data.types; x.locale = st.locale; (st.data.cache ??= {})[id] = x; loading.delete(id); draw() }).catch(() => loading.delete(id)) } }

  // -- Palette: Bausteine + Gruppen/Attribute ab Knoten (inkl. Kinder)
  const search = el('input', { type: 'search', placeholder: '🔍 Attribut', style: 'width:100%;margin-top:4px' })
  search.addEventListener('input', drawPalette)
  function palItem(label, payload, note) { const e = el('div', { class: 'pi', draggable: 'true' }, el('span', {}, label), note ? el('span', { class: 'muted mono' }, note) : ''); e.addEventListener('dragstart', ev => { ev.dataTransfer.setData('application/x-ds', JSON.stringify({ new: payload })); ev.dataTransfer.effectAllowed = 'copy' }); return e }
  function drawPalette() {
    pal.innerHTML = ''
    pal.append(el('h4', {}, 'Bausteine'), ...PALETTE.map(p => palItem(p.label, p)))
    pal.append(el('h4', {}, st.node ? `Attributgruppen ab ${tree.byId.get(st.node)?.label ?? ''} — mit allem darunter` : 'Attributgruppen — erst Knoten wählen'))
    if (st.avail) {
      const q = search.value.trim().toLowerCase()
      const byGroup = new Map()
      for (const c of st.avail) { const g = model.attributes.find(a => a.key === c.key)?.group ?? '—'; if (!byGroup.has(g)) byGroup.set(g, []); byGroup.get(g).push(c) }
      for (const [g, cols] of byGroup) {
        const gd = model.groups.find(x => x.key === g)
        if (!q) pal.append(palItem(`▤ ${gd?.label?.de || g}`, { kind: 'group', group: g }, String(cols.length)))
      }
      pal.append(el('h4', {}, 'Einzelne Attribute'), search)
      for (const c of st.avail.filter(c => !q || c.key.includes(q) || (c.label?.de ?? '').toLowerCase().includes(q)).slice(0, q ? 60 : 25)) pal.append(palItem(c.label?.de || c.key, { kind: 'attr', attr: c.key }, c.key))
    }
  }

  // -- Zeichnen der Seite mit Griffen, Auswahl, Ablagezonen
  function decorateItem(w, it, block, ci, ii) {
    w.draggable = true
    w.addEventListener('dragstart', ev => { ev.stopPropagation(); ev.dataTransfer.setData('application/x-ds', JSON.stringify({ move: { block: block.id, ci, ii } })); ev.dataTransfer.effectAllowed = 'move' })
    w.addEventListener('click', ev => { ev.stopPropagation(); select(it, block) })
    w.addEventListener('dragover', ev => { ev.preventDefault(); ev.stopPropagation(); w.classList.add('over') })
    w.addEventListener('dragleave', () => w.classList.remove('over'))
    w.addEventListener('drop', ev => { ev.preventDefault(); ev.stopPropagation(); w.classList.remove('over'); dropInto(block, ci, ii, ev) })
    w.append(el('span', { class: 'ds-x', title: 'entfernen', onclick: ev => { ev.stopPropagation(); block.cells[ci].splice(ii, 1); st.sel = null; dctx.dirty(); draw() } }, '×'))
    if (st.sel?.id === it.id) w.classList.add('sel')
  }
  function decorateCol(col, block, ci) {
    col.addEventListener('dragover', ev => { ev.preventDefault(); col.classList.add('over') })
    col.addEventListener('dragleave', () => col.classList.remove('over'))
    col.addEventListener('drop', ev => { ev.preventDefault(); col.classList.remove('over'); dropInto(block, ci, block.cells[ci].length, ev) })
  }
  function payload(ev) { try { return JSON.parse(ev.dataTransfer.getData('application/x-ds')) } catch { return null } }
  function takeMoved(m) {
    if (m.block !== undefined && m.ci !== undefined) { const b = st.layout.blocks.find(x => x.id === m.block); const [it] = b.cells[m.ci].splice(m.ii, 1); return it }
    const i = st.layout.blocks.findIndex(x => x.id === m.blockOnly); return i >= 0 ? st.layout.blocks.splice(i, 1)[0] : null
  }
  function dropInto(block, ci, at, ev) {
    const p = payload(ev); if (!p) return
    let it
    if (p.new) { if (['section', 'pagebreak'].includes(p.new.kind)) { store.toast('Abschnitte und Seitenumbrüche gehören auf die Seite, nicht in eine Spalte'); return } it = newItem(p.new) }
    else if (p.move) { const same = p.move.block === block.id && p.move.ci === ci; it = takeMoved(p.move); if (!it) return; if (same && p.move.ii < at) at-- }
    else return
    block.cells[ci].splice(Math.min(at, block.cells[ci].length), 0, it); st.sel = it; dctx.dirty(); draw()
  }
  function dropBlock(at, ev) {
    const p = payload(ev); if (!p) return
    let b
    if (p.new) b = newItem(p.new)
    else if (p.move?.blockOnly) { const i = st.layout.blocks.findIndex(x => x.id === p.move.blockOnly); b = takeMoved(p.move); if (i >= 0 && i < at) at-- }
    else if (p.move) { const it = takeMoved(p.move); b = it.kind === 'group' || it.kind === 'attr' ? { id: nid(), kind: 'section', title: '', columns: 1, cells: [[it]] } : it }
    if (!b) return
    st.layout.blocks.splice(Math.min(at, st.layout.blocks.length), 0, b); st.sel = b; dctx.dirty(); draw()
  }
  function select(x, block) { st.sel = x; st.selBlock = block ?? null; draw() }
  function draw() {
    canvas.innerHTML = ''
    const p = st.layout.page
    const w = (p.size === 'A4' ? (p.landscape ? 297 : 210) : (p.landscape ? 279 : 216))
    const page = el('div', { class: 'ds-page', style: `width:${w}mm;min-height:${p.size === 'A4' ? (p.landscape ? 210 : 297) : (p.landscape ? 216 : 279)}mm;font:${p.font}pt/1.35 system-ui, "Segoe UI", Arial, sans-serif;padding:${p.margin}mm` })
    page.addEventListener('click', () => select(null))
    page.addEventListener('dragover', ev => ev.preventDefault())
    page.addEventListener('drop', ev => { ev.preventDefault(); dropBlock(st.layout.blocks.length, ev) })
    const d = st.data ?? { name: '(Knoten wählen)', sku: '', today: new Date().toLocaleDateString('de-DE'), attr: {}, unit: {}, types: {}, images: [], variants: [], locale: st.locale, cache: {} }
    st.layout.blocks.forEach((b, bi) => {
      const wrap = el('div', { class: 'ds-blk' + (st.sel?.id === b.id ? ' sel' : '') }, renderBlock(b, d, model, true, dctx))
      wrap.append(el('span', { class: 'ds-grip', draggable: 'true', title: 'Block verschieben' }, '⋮⋮'))
      wrap.querySelector('.ds-grip').addEventListener('dragstart', ev => { ev.stopPropagation(); ev.dataTransfer.setData('application/x-ds', JSON.stringify({ move: { blockOnly: b.id } })); ev.dataTransfer.effectAllowed = 'move' })
      if (b.kind !== 'header') wrap.append(el('span', { class: 'ds-x', title: 'Block entfernen', onclick: ev => { ev.stopPropagation(); st.layout.blocks.splice(bi, 1); st.sel = null; dctx.dirty(); draw() } }, '×'))
      wrap.addEventListener('click', ev => { ev.stopPropagation(); select(b) })
      wrap.addEventListener('dragover', ev => { if (b.kind === 'section' && ev.target.closest('.ds-col')) return; ev.preventDefault(); ev.stopPropagation(); wrap.classList.add('over') })
      wrap.addEventListener('dragleave', () => wrap.classList.remove('over'))
      wrap.addEventListener('drop', ev => { if (b.kind === 'section' && ev.target.closest('.ds-col')) return; ev.preventDefault(); ev.stopPropagation(); wrap.classList.remove('over'); dropBlock(bi, ev) })
      page.append(wrap)
    })
    canvas.append(page)
    drawProps()
  }
  /// Die Attribute, die hier zur Wahl stehen — dieselben wie in der Palette, mehrwertige zuerst
  function attrOptionen() {
    const quelle = st.avail?.length ? st.avail.map(c => model.attributes.find(a => a.key === c.key)).filter(Boolean) : (model.attributes ?? [])
    return quelle.map(a => ({ key: a.key, label: (a.label?.[st.locale] || a.label?.de || a.key) + (a.multiple ? ' ≣' : ''), multiple: !!a.multiple }))
      .sort((x, y) => (y.multiple ? 1 : 0) - (x.multiple ? 1 : 0) || x.label.localeCompare(y.label, 'de', { sensitivity: 'base' }))
  }
  function field(labelText, input) { return el('div', {}, el('label', {}, labelText), input) }
  function text(obj, key, after = draw) { const i = el('input', { type: 'text', value: obj[key] ?? '' }); i.addEventListener('input', () => { obj[key] = i.value; dctx.dirty(); after() }); return i }
  function num(obj, key, min, max) { const i = el('input', { type: 'number', value: obj[key] ?? '', min: String(min), max: String(max) }); i.addEventListener('input', () => { obj[key] = Number(i.value); dctx.dirty(); draw() }); return i }
  function check(obj, key, labelText) { const c = el('input', { type: 'checkbox' }); c.checked = obj[key] !== false && obj[key] !== undefined ? !!obj[key] : false; c.addEventListener('change', () => { obj[key] = c.checked; dctx.dirty(); draw() }); return el('label', { style: 'display:flex;gap:6px;align-items:center;color:var(--text)' }, c, labelText) }
  function drawProps() {
    props.innerHTML = ''
    const x = st.sel
    if (!x) {
      const p = st.layout.page
      props.append(el('b', {}, 'Seite'))
      const size = el('select', {}, el('option', { value: 'A4' }, 'A4'), el('option', { value: 'Letter' }, 'Letter')); size.value = p.size; size.addEventListener('change', () => { p.size = size.value; dctx.dirty(); draw() })
      props.append(field('Format', size), check(p, 'landscape', 'Querformat'), field('Rand (mm)', num(p, 'margin', 5, 40)), field('Schrift (pt)', num(p, 'font', 7, 14)))
      props.append(el('div', { class: 'muted', style: 'margin-top:14px;line-height:1.5' }, 'Bausteine links auf die Seite ziehen. Gruppen und Attribute in eine Spalte ziehen. Klick wählt, × entfernt, ⋮⋮ verschiebt Blöcke. Text direkt tippen; {name} {sku} {today} und {attributkey} werden ersetzt.'))
      return
    }
    props.append(el('b', {}, { header: 'Kopf', footer: 'Fuss', section: 'Abschnitt', group: 'Attributgruppe', attr: 'Attribut', image: 'Bild', text: 'Text', variants: 'Datentabelle', compare: 'Vergleichstabelle', pagebreak: 'Seitenumbruch' }[x.kind] ?? x.kind))
    switch (x.kind) {
      case 'header': props.append(field('Titel', text(x, 'title')), field('Untertitel', text(x, 'sub')), field('rechts', text(x, 'right'))); break
      case 'footer': props.append(field('Text', text(x, 'text'))); break
      case 'section': {
        props.append(field('Überschrift', text(x, 'title')))
        const cols = el('select', {}, ...[1, 2, 3, 4].map(n => el('option', { value: String(n) }, `${n} Spalte${n > 1 ? 'n' : ''}`))); cols.value = String(x.columns)
        cols.addEventListener('change', () => { const n = Number(cols.value); while (x.cells.length < n) x.cells.push([]); if (x.cells.length > n) { const rest = x.cells.splice(n).flat(); x.cells[n - 1].push(...rest) } x.columns = n; dctx.dirty(); draw() })
        props.append(field('Spalten', cols)); break
      }
      case 'group': props.append(el('div', { class: 'mono muted' }, x.group), check(x, 'title', 'Überschrift zeigen'), check(x, 'empty', 'auch leere Attribute')); break
      case 'attr': props.append(el('div', { class: 'mono muted' }, x.attr), check(x, 'label', 'Bezeichnung davor')); break
      case 'list': {
        const a = el('select', {}, el('option', { value: '' }, '— Attribut —'), ...attrOptionen().map(o => el('option', { value: o.key }, o.label)))
        a.value = x.attr ?? ''
        a.addEventListener('change', () => { x.attr = a.value; dctx.dirty(); draw() })
        const m = el('select', {}, el('option', { value: 'disc' }, '• Punkt'), el('option', { value: 'dash' }, '– Strich'), el('option', { value: 'decimal' }, '1. Zahl'), el('option', { value: 'none' }, 'ohne'))
        m.value = x.marker ?? 'disc'
        m.addEventListener('change', () => { x.marker = m.value; dctx.dirty(); draw() })
        props.append(field('Attribut', a), field('Zeichen', m), field('Spalten', num(x, 'columns', 1, 4)), check(x, 'label', 'Bezeichnung als Überschrift'))
        break
      }
      case 'image': { const w = el('select', {}, el('option', { value: 'first' }, 'erstes Bild'), el('option', { value: 'all' }, 'alle Bilder')); w.value = x.which; w.addEventListener('change', () => { x.which = w.value; dctx.dirty(); draw() }); props.append(field('Welche', w), field('Höhe (mm)', num(x, 'height', 10, 200))); break }
      case 'variants': {
        props.append(el('div', { class: 'muted' }, 'Zeilen: die Subitems des Knotens (Produkt → Varianten, Gruppe → Produkte). Spalten: Achsen, eine Gruppe oder eigene Attribute:'))
        const vg = el('select', {}, el('option', { value: '' }, '— Achsen / einzelne —'), ...model.groups.map(g => el('option', { value: g.key }, g.label?.de || g.key))); vg.value = x.group ?? ''
        vg.addEventListener('change', () => { x.group = vg.value; dctx.dirty(); draw() })
        props.append(field('Spalten aus Gruppe', vg))
        const chips = el('div', { class: 'chips', style: 'margin-top:4px' }, ...(x.attrs ?? []).map(k => el('span', { class: 'chip mono' }, k, el('button', { onclick: () => { x.attrs = x.attrs.filter(a => a !== k); dctx.dirty(); draw() } }, '×'))))
        const add = el('select', {}, el('option', { value: '' }, '+ Attribut'), ...(st.avail ?? []).map(c => el('option', { value: c.key }, c.label?.de || c.key)))
        add.addEventListener('change', () => { if (add.value) { x.attrs = [...(x.attrs ?? []), add.value]; dctx.dirty(); draw() } })
        props.append(chips, add); break
      }
      case 'text': props.append(el('div', { class: 'muted' }, 'Direkt auf der Seite tippen. Platzhalter: {name} {sku} {today} {attributkey}')); break
      case 'compare': {
        const src = el('select', {}, el('option', { value: 'variants' }, 'Varianten des Knotens'), el('option', { value: 'children' }, 'Subitems des Knotens'), el('option', { value: 'pick' }, 'gewählte Knoten')); src.value = x.source
        src.addEventListener('change', () => { x.source = src.value; dctx.dirty(); draw() })
        props.append(field('Spalten', src))
        if (x.source === 'pick') {
          const chips = el('div', { class: 'chips', style: 'margin-top:4px' }, ...(x.nodes ?? []).map(id => el('span', { class: 'chip' }, tree.byId.get(id)?.label ?? id, el('button', { onclick: () => { x.nodes = x.nodes.filter(n => n !== id); dctx.dirty(); draw() } }, '×'))))
          const find = el('input', { type: 'search', placeholder: '🔍 Knoten dazu', style: 'width:100%;margin-top:4px' })
          const hits = el('div', { class: 'picker', style: 'display:none' })
          find.addEventListener('input', () => { const q = find.value.trim().toLowerCase(); hits.innerHTML = ''; const hs = q ? tree.rows.filter(r => r.label.toLowerCase().includes(q) || (r.sku ?? '').toLowerCase().includes(q)).slice(0, 10) : []; for (const r of hs) hits.append(el('div', { class: 'pick', onmousedown: ev => { ev.preventDefault(); x.nodes = [...(x.nodes ?? []), r.id]; dctx.dirty(); draw() } }, `${{ group: '▣', product: '▦', variant: '◆' }[r.role]} ${r.label}`)); hits.style.display = hs.length ? 'block' : 'none' })
          props.append(chips, find, hits)
        }
        const grp = el('select', {}, el('option', { value: '' }, '— einzelne Attribute —'), ...model.groups.map(g => el('option', { value: g.key }, g.label?.de || g.key))); grp.value = x.group ?? ''
        grp.addEventListener('change', () => { x.group = grp.value; dctx.dirty(); draw() })
        props.append(field('Zeilen aus Gruppe', grp))
        if (!x.group) {
          props.append(el('div', { class: 'chips', style: 'margin-top:4px' }, ...(x.attrs ?? []).map(k => el('span', { class: 'chip mono' }, k, el('button', { onclick: () => { x.attrs = x.attrs.filter(a => a !== k); dctx.dirty(); draw() } }, '×')))))
          const add = el('select', {}, el('option', { value: '' }, '+ Attribut'), ...(st.avail ?? model.attributes).map(c => el('option', { value: c.key }, c.label?.de || c.key)))
          add.addEventListener('change', () => { if (add.value) { x.attrs = [...(x.attrs ?? []), add.value]; dctx.dirty(); draw() } })
          props.append(add)
        }
        props.append(check(x, 'diff', 'nur Unterschiede'), check(x, 'empty', 'auch leere Zeilen'))
        break
      }
    }
  }

  // -- Daten am Knoten: Werte für die Vorschau, Attribute (inkl. Kinder) für die Palette
  async function reload() {
    if (!st.node) { drawPalette(); draw(); return }
    try {
      const [d, t, n] = await Promise.all([dataOf(ctx, st.node, st.locale), api.get(`/api/nodes/${encodeURIComponent(st.node)}/table?deep=true&locale=${st.locale}&take=1`), api.get(`/api/nodes/${encodeURIComponent(st.node)}`)])
      d.types = Object.fromEntries(model.attributes.map(a => [a.key, a.type])); d.locale = st.locale; d.cache = {}
      // Palette: die Attribute, die AM KNOTEN gelten (seine aktiven Gruppen) — plus alles, was an den Nachfahren vorkommt (table?deep; take=1:
      // die Spalten gelten für alle Nachfahren, die Zeilen braucht die Palette nicht — die ganze Tabelle einer Gruppe waren hunderte MB)
      // Nur die Nachfahren zu nehmen liess an einer Variante (kein Kind) die Palette leer
      const own = (n.groups ?? []).filter(g => g.active).flatMap(g => g.attributes).map(k => model.attributes.find(a => a.key === k)).filter(Boolean)
      const seen = new Set(); const cols = []
      for (const c of [...own, ...t.columns]) if (!seen.has(c.key)) { seen.add(c.key); cols.push(c) }
      st.data = d; st.avail = cols.filter(c => !['rows', 'formula'].includes(c.type))
    } catch (e) { store.toast(e.message) }
    drawPalette(); draw()
  }
  const onKey = e => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save() } }
  document.addEventListener('keydown', onKey)
  await loadLayout(sett.product ?? 'standard')
  await reload()
  return () => document.removeEventListener('keydown', onKey)
}
