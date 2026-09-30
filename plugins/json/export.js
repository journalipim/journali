// JSON-Export: ein Teilbaum als
// Rohdaten (wiederherstellbar, mit Modellteil — der JSON-Import und der Job lesen es), als ausgewerteter Baum
// (verschachtelt, Werte aufgelöst — für Abnehmer) oder als flache Liste (ausgewertet). Tabellen (xlsx, csv) macht das Plugin export.
function el(tag, attrs = {}, ...kids) { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v) } for (const k of kids) e.append(k); return e }
const download = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000) }
const ICON = { group: '▣', product: '▦', variant: '◆' }
const countNodes = n => { let c = 1; for (const k of n.children ?? []) c += countNodes(k); return c }

export async function rawOf(ctx, id) { return ctx.api.get(`/api/nodes/${encodeURIComponent(id)}/export?deep=true`) }
export function rawName(ctx, id) { return `${ctx.tree.byId.get(id)?.label ?? id}-rohdaten`.replace(/[^\w.-]+/g, '_') + '.json' }

export async function mountExport(root, ctx) {
  const { api, store, tree } = ctx
  if (!tree.loaded) await tree.load()
  const sett = (await ctx.data.get('export')) ?? {}
  const st = { root: localStorage.getItem('journali.export.root') || tree.rows.find(r => !r.parent)?.id, format: sett.format ?? 'raw', locales: sett.locales ?? [store.model.masterLocale ?? 'de'], ownOnly: sett.ownOnly ?? false, gzip: sett.gzip ?? false }
  const remember = () => ctx.data.set('export', { format: st.format, locales: st.locales, ownOnly: st.ownOnly, gzip: st.gzip }).catch(() => {})
  root.style.cssText = 'display:flex;flex-direction:column;height:100%;padding:0'
  const status = el('span', { class: 'muted' }); const say = m => status.textContent = m
  // Auswahlbaum statt Suche nach Name
  const chosen = el('div', { class: 'muted', style: 'margin:2px 0 4px' }, st.root ? `${ICON[tree.byId.get(st.root)?.role] ?? ''} ${tree.byId.get(st.root)?.label ?? ''}` : 'im Baum wählen')
  const treeBox = el('div')
  ctx.treePicker(treeBox, { value: st.root, roles: ['group', 'product', 'variant'], height: 220, onPick: r => { st.root = r.id; chosen.textContent = `${ICON[r.role]} ${r.label}`; localStorage.setItem('journali.export.root', r.id) } })
  const fmtSel = el('select', { style: 'width:100%', onchange: e => { st.format = e.target.value; remember(); drawOpts() } },
    el('option', { value: 'raw' }, 'Rohdaten — wiederherstellbar (eigene Werte, Skripte, Modellteil)'),
    el('option', { value: 'tree' }, 'ausgewertet, Baum — für Abnehmer (Werte aufgelöst, geerbt zählt)'),
    el('option', { value: 'flat' }, 'ausgewertet, flache Liste'))
  fmtSel.value = st.format
  const locBox = el('div', { class: 'chips' })
  for (const l of store.model.locales) { const chip = el('span', { class: 'view-chip' + (st.locales.includes(l.code) ? ' on' : ''), onclick: () => { const s = new Set(st.locales); s.has(l.code) ? s.delete(l.code) : s.add(l.code); st.locales = store.model.locales.map(x => x.code).filter(c => s.has(c)); chip.classList.toggle('on', s.has(l.code)); remember() } }, l.code); locBox.append(chip) }
  const ownCb = el('input', { type: 'checkbox' }); ownCb.checked = st.ownOnly; ownCb.addEventListener('change', () => { st.ownOnly = ownCb.checked; remember() })
  const gzCb = el('input', { type: 'checkbox' }); gzCb.checked = st.gzip; gzCb.addEventListener('change', () => { st.gzip = gzCb.checked; remember() })
  const preview = el('pre', { class: 'mono scroll', style: 'flex:1;margin:0;padding:8px;font-size:11px;white-space:pre-wrap' })
  const row = (label, ...kids) => el('tr', {}, el('td', { class: 'attr', style: 'color:var(--muted);white-space:nowrap;padding-left:8px;width:84px' }, label), el('td', { style: 'padding:2px 4px;position:relative' }, ...kids))
  const step = t => el('tr', { class: 'step' }, el('td', { colspan: '2', class: 'step-band', style: 'display:table-cell;height:24px' }, t))
  function optsRow2() { const r = st.format === 'raw' ? el('tr', { style: 'display:none' }) : row('Werte', el('span', { style: 'display:flex;gap:10px;align-items:center' }, locBox, el('label', {}, ownCb, ' nur eigene Werte'))); r.dataset.opts = '1'; return r }
  async function run(downloadIt) {
    if (!st.root) return
    try {
      const label = tree.byId.get(st.root)?.label ?? 'export'
      let text, name, count
      if (st.format === 'raw') {
        const raw = await rawOf(ctx, st.root); count = countNodes(raw.node); text = JSON.stringify(raw, null, 1); name = rawName(ctx, st.root)
        say(`${count} Knoten roh · Modell: ${raw.model.groups.length} Gruppen, ${raw.model.attributes.length} Attribute, ${raw.model.lists.length} Listen, ${raw.model.units.length} Einheiten`)
      } else {
        if (!st.locales.length) { store.toast('mindestens eine Sprache'); return }
        const ex = ctx.use('table')?.tableExport; if (!ex) throw new Error('Basis-Plugin table fehlt')
        const t = await ex.build({ root: st.root, role: '', locales: st.locales, ownOnly: st.ownOnly, viewKey: '', relations: true, say })
        count = t.count; text = st.format === 'tree' ? ex.toJsonTree(t, st.root) : ex.toJson(t); name = `${label}-${st.format === 'tree' ? 'baum' : 'liste'}-${st.locales.join('-')}`.replace(/[^\w.-]+/g, '_') + '.json'
        say(`${count} Knoten ausgewertet · ${t.columns.length} Spalten`)
      }
      preview.textContent = text.slice(0, 8000) + (text.length > 8000 ? '\n…' : '')
      if (!downloadIt) return
      if (st.gzip) { const gz = await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).blob(); download(gz, name + '.gz') }
      else download(new Blob([text], { type: 'application/json' }), name)
      store.toast(`⇪ ${count} Knoten als JSON`, 'ok')
    } catch (e) { say('✗ ' + e.message); store.toast(e.message) }
  }
  const table = el('table', { class: 'grid', style: 'width:100%;border-bottom:1px solid var(--line)' }, el('tbody', {},
    step('1 · Was'), row('Teilbaum', chosen, treeBox),
    step('2 · Wie'), row('Form', fmtSel), optsRow2(), row('Datei', el('label', {}, gzCb, ' gzip (.json.gz — Import und Job lesen es direkt)')),
    row('', el('span', { class: 'row', style: 'display:flex;gap:6px' }, el('button', { onclick: () => run(false) }, 'Vorschau'), el('button', { class: 'primary', onclick: () => run(true) }, '⇪ herunterladen')))))
  function drawOpts() { const cur = table.querySelector('tr[data-opts]'); cur?.replaceWith(optsRow2()) }
  root.append(el('div', { class: 'toolbar' }, el('h1', {}, '⇪ JSON-Export'), el('span', { class: 'grow' }), status), table, el('div', { class: 'step-band' }, '3 · Vorschau'), preview)
}
