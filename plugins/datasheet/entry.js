// Plugin datasheet (Taloan, 17.09.2026): Datenblatt für Produkte und Varianten. Seit 18.09. WYSIWYG-Designer (designer.js:
// Seite, Drag & Drop, Abschnitte mit Spalten, Attributgruppen ab einem Knoten inkl. Kinder); der HTML-Vorlagen-Editor
// hier bleibt als zweiter Weg („HTML-Vorlage“) — alte Vorlagen gehen weiter.
import { mountDesigner as mountWysiwyg, layoutFor, renderSheet, preloadCompare } from './designer.js'
// Vorlagen sind HTML mit Platzhaltern (unten), liegen im Journal (ctx.data, „template:<name>“), je Rolle eine
// Zuordnung („settings“). Der Designer: links Vorlage (Text), rechts die Vorschau an einem gewählten Knoten;
// „Datenblatt“ im Kontextmenü des Baums öffnet das fertige Blatt in einem neuen Fenster (drucken → PDF).
//
// Platzhalter (Mustache-artig, {{…}} entwertet HTML, {{{…}}} nicht):
//   {{name}} {{sku}} {{id}} {{role}} {{status}} {{today}}          Kopfdaten
//   {{attr.key}} {{attr.key@en}}                                    Attributwert (aufgelöst, geerbt zählt; Sprache wählbar)
//   {{label.key}} {{unit.key}}                                      Label und Einheit eines Attributs
//   {{image}}  {{#each images}}<img src="{{url}}">{{/each}}          erstes / alle Bilder (Relation image)
//   {{#each groups}} {{label}} {{#each attributes}} {{label}} {{value}} {{unit}} {{/each}} {{/each}}   gefüllte Attribute nach Gruppen
//   {{#each variants}} … wie oben je Variante … {{/each}}           die Varianten eines Produkts (mit axes)
//   {{#each axes}}{{label}}: {{value}}{{/each}}                     Achsenwerte einer Variante
//   {{#if attr.key}}…{{else}}…{{/if}}                               Bedingung (leer/false = nein)
//   {{../name}}                                                     eine Ebene hinauf (Produkt aus der Variante)

const DEFAULT_TEMPLATE = `<!doctype html>
<html><head><meta charset="utf-8"><title>{{name}}</title>
<style>
  @page { size: A4; margin: 16mm; }
  body { font: 11pt/1.4 system-ui, "Segoe UI", Arial, sans-serif; color: #1f2328; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #2563eb; padding-bottom: 6px; margin-bottom: 12px; }
  h1 { font-size: 20pt; margin: 0; } .sku { color: #6b7280; font-family: ui-monospace, Consolas, monospace; }
  .hero { display: flex; gap: 16px; margin-bottom: 12px; } .hero img { max-width: 220px; max-height: 220px; object-fit: contain; border: 1px solid #ddd; }
  .desc { flex: 1; }
  h2 { font-size: 11pt; margin: 12px 0 4px; color: #2563eb; border-bottom: 1px solid #dbeafe; }
  table { border-collapse: collapse; width: 100%; } td { padding: 2px 6px; border-bottom: 1px solid #eee; vertical-align: top; }
  td:first-child { width: 38%; color: #6b7280; }
  .variants td { border-bottom: 1px solid #eee; } .variants th { text-align: left; padding: 2px 6px; background: #eef2f7; }
  footer { margin-top: 16px; font-size: 8pt; color: #6b7280; border-top: 1px solid #ddd; padding-top: 4px; }
</style></head>
<body>
<header><div><h1>{{name}}</h1><div class="sku">{{sku}}</div></div><div>{{today}}</div></header>
<div class="hero">{{#if image}}<img src="{{image}}">{{/if}}<div class="desc">{{{attr.description}}}</div></div>
{{#each groups}}
<h2>{{label}}</h2>
<table>{{#each attributes}}<tr><td>{{label}}</td><td>{{value}} {{unit}}</td></tr>{{/each}}</table>
{{/each}}
{{#if variants}}
<h2>Varianten</h2>
<table class="variants"><tr><th>SKU</th><th>Name</th><th>Achsen</th></tr>
{{#each variants}}<tr><td>{{sku}}</td><td>{{name}}</td><td>{{#each axes}}{{label}}: {{value}} {{/each}}</td></tr>{{/each}}
</table>
{{/if}}
<footer>journali · {{id}} · Stand {{today}}</footer>
</body></html>`

// ---- Mini-Mustache: {{path}} {{{path}}} {{#each path}} {{#if path}} {{else}} {{/each}} {{/if}} {{../path}}
function render(tpl, data) {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  const get = (stack, path) => {
    let s = stack.length - 1
    while (path.startsWith('../')) { path = path.slice(3); s = Math.max(0, s - 1) }
    if (path === '.' || path === 'this') return stack[s]
    let v = stack[s]
    for (const p of path.split('.')) { if (v == null) return null; v = v[p] }
    if (v === undefined) for (let i = s - 1; i >= 0 && v === undefined; i--) { let w = stack[i]; for (const p of path.split('.')) { if (w == null) { w = undefined; break } w = w[p] } v = w }
    return v ?? null
  }
  const truthy = v => Array.isArray(v) ? v.length > 0 : !!v && v !== 'false'
  function block(src, stack) {
    let out = '', i = 0
    while (i < src.length) {
      const o = src.indexOf('{{', i); if (o < 0) { out += src.slice(i); break }
      out += src.slice(i, o)
      const c = src.indexOf('}}', o); if (c < 0) { out += src.slice(o); break }
      let tag = src.slice(o + 2, c).trim(); let raw = false
      if (tag.startsWith('{') && src[c + 2] === '}') { tag = tag.slice(1).trim(); raw = true; i = c + 3 } else i = c + 2
      if (tag.startsWith('#each ') || tag.startsWith('#if ')) {
        const kind = tag.startsWith('#each') ? 'each' : 'if'; const path = tag.slice(kind === 'each' ? 6 : 4).trim()
        const end = findEnd(src, i, kind); const inner = src.slice(i, end.start); i = end.after
        const [yes, no] = splitElse(inner)
        const v = get(stack, path)
        if (kind === 'each') { const arr = Array.isArray(v) ? v : v && typeof v === 'object' ? Object.entries(v).map(([k, x]) => ({ key: k, value: x })) : []; out += arr.length ? arr.map((x, n) => block(yes, [...stack, typeof x === 'object' && x ? { ...x, index: n + 1 } : { value: x, index: n + 1 }])).join('') : block(no, stack) }
        else out += block(truthy(v) ? yes : no, stack)
        continue
      }
      const v = get(stack, tag)
      out += raw ? String(v ?? '') : esc(v)
    }
    return out
  }
  function findEnd(src, from, kind) {   // passendes {{/each}} bzw. {{/if}} bei Verschachtelung
    let depth = 1, i = from
    const re = /\{\{\s*(#each|#if|\/each|\/if)\b[^}]*\}\}/g; re.lastIndex = from
    let m
    while ((m = re.exec(src))) {
      const t = m[1]
      if (t === '#each' || t === '#if') depth++
      else if ((t === '/each' && kind === 'each') || (t === '/if' && kind === 'if')) { depth--; if (depth === 0) return { start: m.index, after: re.lastIndex } }
      else depth--
    }
    return { start: src.length, after: src.length }
  }
  function splitElse(inner) {   // {{else}} auf oberster Ebene
    let depth = 0; const re = /\{\{\s*(#each|#if|\/each|\/if|else)\b[^}]*\}\}/g; let m
    while ((m = re.exec(inner))) { if (m[1].startsWith('#')) depth++; else if (m[1].startsWith('/')) depth--; else if (depth === 0) return [inner.slice(0, m.index), inner.slice(re.lastIndex)] }
    return [inner, '']
  }
  return block(tpl, [data])
}

// ---- Daten eines Knotens fürs Blatt: aufgelöste Werte (eigen, sonst Vorfahren, wenn vererbbar), Formeln, Bilder, Gruppen, Varianten
export async function dataOf(ctx, id, locale, depth = 0) {
  const { api, store } = ctx
  const model = store.model
  const n = await api.get(`/api/nodes/${encodeURIComponent(id)}`)
  const defs = new Map(model.attributes.map(a => [a.key, a]))
  const own = new Map(n.values.map(v => [`${v.attribute}|${v.locale ?? ''}|${v.channel ?? ''}`, v.values ? v.values.join(', ') : v.value]))
  const anc = n.ancestors.map(a => new Map(a.values.map(v => [`${v.attribute}|${v.locale ?? ''}|${v.channel ?? ''}`, v.values ? v.values.join(', ') : v.value])))
  const lookup = (m, key, loc) => m.get(`${key}|${loc}|`) ?? (loc ? m.get(`${key}||`) : null) ?? null
  const value = (key, loc) => {
    const d = defs.get(key); if (!d) return null
    if (d.type === 'formula') return n.computed.find(c => c.attribute === key && (c.locale ?? null) === (d.perLocale ? loc : null))?.value ?? null
    const l = d.perLocale ? loc : ''
    let v = lookup(own, key, l)
    if (v == null && d.inheritable) for (const m of anc) { v = lookup(m, key, l); if (v != null) break }
    if (d.type === 'enum' && v != null) { const list = model.lists.find(x => x.key === d.list); v = v.split(',').map(x => list?.values.find(y => y.value === x.trim())?.label?.[loc] ?? list?.values.find(y => y.value === x.trim())?.label?.de ?? x).join(', ') }
    if (d.type === 'boolean') v = v === 'true' ? (loc === 'de' ? 'ja' : 'yes') : v === 'false' ? (loc === 'de' ? 'nein' : 'no') : v
    return v
  }
  const attr = {}, label = {}, unit = {}
  for (const d of model.attributes) { label[d.key] = d.label?.[locale] || d.label?.de || d.key; unit[d.key] = d.unit ?? ''; attr[d.key] = value(d.key, locale); for (const l of model.locales) if (d.perLocale) attr[`${d.key}@${l.code}`] = value(d.key, l.code) }
  const groups = n.groups.filter(g => g.active).map(g => {
    const gd = model.groups.find(x => x.key === g.key)
    return { key: g.key, label: gd?.label?.[locale] || gd?.label?.de || g.key, attributes: g.attributes.map(k => ({ key: k, label: label[k], unit: unit[k], value: attr[k], type: defs.get(k)?.type })).filter(a => a.value != null && a.value !== '' && a.type !== 'html' && a.type !== 'rows') }
  }).filter(g => g.attributes.length)
  let images = []
  try { const rels = await api.get(`/api/nodes/${encodeURIComponent(id)}/relations`); images = [...(rels.out ?? []).filter(r => !(r.values ?? []).some(v => v.attribute === 'stop' && v.value === 'true')), ...(rels.inherited ?? []).map(x => x.relation)].filter(r => r.type === 'image' || r.other?.isImage).map(r => ({ id: r.to, url: `${store.server}/api/media/${r.to}/file`, label: r.other?.label })) } catch {}
  const axes = Object.entries(n.axisValues ?? {}).map(([k, v]) => ({ key: k, label: label[k] ?? k, value: defs.get(k)?.type === 'enum' ? (model.lists.find(x => x.key === defs.get(k).list)?.values.find(y => y.value === v)?.label?.[locale] ?? v) : v }))
  const row = ctx.tree.byId.get(id)
  const out = { id, role: n.role, name: row?.label ?? n.name ?? id, sku: attr.sku ?? row?.sku ?? '', status: n.status, today: new Date().toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB'), attr, label, unit, groups, images, image: images[0]?.url ?? null, axes, variants: [] }
  // Subitems (Taloan): am Produkt die Varianten, an der Gruppe die Produkte — für Datentabelle und Vergleich; Varianten heissen weiter variants
  if (depth === 0) { const kids = ctx.tree.kids(id); out.children = await Promise.all(kids.map(k => dataOf(ctx, k.id, locale, 1))); out.variants = out.children.filter(c => c.role === 'variant') }
  return out
}

// ---- Vorlagen im Journal
const T = 'template:'
async function templates(ctx) { const names = await ctx.data.list().catch(() => []); return names.filter(n => n.startsWith(T)).map(n => n.slice(T.length)) }
async function settings(ctx) { return (await ctx.data.get('settings')) ?? { product: 'standard', variant: 'standard', group: 'standard', locale: null } }
async function templateFor(ctx, role) {
  const s = await settings(ctx); const name = s[role] ?? 'standard'
  const t = await ctx.data.get(T + name)
  return { name, html: t?.html ?? DEFAULT_TEMPLATE, locale: s.locale ?? ctx.store.model?.masterLocale ?? 'de' }
}
async function sheet(ctx, id, html, locale) { return render(html, await dataOf(ctx, id, locale)) }
function openSheet(html, title) {
  const w = window.open('', '_blank'); if (!w) return
  w.document.open(); w.document.write(html); w.document.close(); w.document.title = title
}

// ---- Designer
// el: im Browser echte Elemente; ohne DOM (Job, Node) ein Ersatz, der nur outerHTML kann — die Wiedergabe des Blatts braucht nicht mehr (Taloan, 19.09.: Datenblätter als Job)
const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const VOID = new Set(['img', 'br', 'hr', 'input', 'meta', 'link'])
function elText(tag, attrs = {}, ...kids) {
  const e = { tag, attrs: {}, kids: [], style: {}, classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, set contentEditable(v) {}, set innerHTML(v) { this.kids = [{ raw: v }] }, get innerHTML() { return this.kids.map(k => k?.raw ?? (typeof k === 'string' ? escHtml(k) : k?.outerHTML ?? '')).join('') },
    append(...ks) { for (const k of ks) if (k != null && k !== '') this.kids.push(k) },
    querySelector() { return null }, querySelectorAll() { return [] },
    get outerHTML() { const a = Object.entries(this.attrs).map(([k, v]) => ` ${k}="${escHtml(v)}"`).join(''); return VOID.has(this.tag) ? `<${this.tag}${a}>` : `<${this.tag}${a}>${this.innerHTML}</${this.tag}>` } }
  for (const [k, v] of Object.entries(attrs)) { if (k.startsWith('on')) continue; if (k === 'html') e.innerHTML = v; else e.attrs[k] = v }
  e.append(...kids); return e
}
export function el(tag, attrs = {}, ...kids) {
  if (typeof document === 'undefined') return elText(tag, attrs, ...kids)
  const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v) } for (const k of kids) e.append(k); return e
}

async function mountDesigner(root, ctx) {
  const { store, tree } = ctx
  if (!tree.loaded) await tree.load()
  const state = { name: 'standard', html: DEFAULT_TEMPLATE, node: null, locale: store.model?.masterLocale ?? 'de', dirty: false }
  const names = await templates(ctx); const sett = await settings(ctx)
  const last = localStorage.getItem('journali.datasheet.node'); if (last && tree.byId.get(last)) state.node = last
  root.style.cssText = 'display:flex;flex-direction:column;height:100%;padding:0'
  const nameSel = el('select', { title: 'Vorlage' }); const nameIn = el('input', { type: 'text', placeholder: 'Name', style: 'width:120px', title: 'Name zum Speichern' })
  const localeSel = el('select', { title: 'Sprache der Vorschau' }); for (const l of store.model?.locales ?? []) localeSel.append(el('option', { value: l.code }, l.code)); localeSel.value = state.locale
  const nodeIn = el('input', { type: 'search', placeholder: '🔍 Knoten für die Vorschau', style: 'width:260px' }); const pick = el('div', { class: 'picker', style: 'position:absolute;z-index:5;width:380px;display:none' })
  const status = el('span', { class: 'muted', style: 'font-size:12px' })
  const ta = el('textarea', { spellcheck: 'false', wrap: 'off', style: 'flex:1;width:100%;box-sizing:border-box;font:12px ui-monospace,Consolas,monospace;resize:none;border:0;padding:8px;background:var(--pane);color:var(--text)' })
  const frame = el('iframe', { style: 'flex:1;width:100%;border:0;background:#fff' })
  const roleSel = role => { const s = el('select', { title: `Vorlage für ${role}` }); for (const n of ['standard', ...names.filter(x => x !== 'standard')]) s.append(el('option', { value: n }, n)); s.value = sett[role] ?? 'standard'; s.addEventListener('change', async () => { sett[role] = s.value; await ctx.data.set('settings', sett); store.toast(`Datenblatt: ${role} → ${s.value}`) }); return s }
  function fillNames() { nameSel.innerHTML = ''; for (const n of ['standard', ...names.filter(x => x !== 'standard')]) nameSel.append(el('option', { value: n }, n)); nameSel.value = state.name }
  async function loadTemplate(name) { const t = await ctx.data.get(T + name); state.name = name; state.html = t?.html ?? DEFAULT_TEMPLATE; ta.value = state.html; nameIn.value = name; state.dirty = false; preview() }
  let timer = null
  async function preview() {
    if (!state.node) { frame.srcdoc = '<p style="font:13px system-ui;color:#6b7280;padding:16px">Knoten wählen → Vorschau</p>'; return }
    status.textContent = 'rendere …'
    try { const t0 = performance.now(); frame.srcdoc = await sheet(ctx, state.node, ta.value, localeSel.value); status.textContent = `${Math.round(performance.now() - t0)} ms` }
    catch (e) { frame.srcdoc = `<pre style="color:#b91c1c">${e.message}</pre>`; status.textContent = '✗' }
  }
  ta.addEventListener('input', () => { state.dirty = true; clearTimeout(timer); timer = setTimeout(preview, 400) })
  ta.addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText('  ', s, ta.selectionEnd, 'end') } if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save() } })
  async function save() {
    const name = (nameIn.value || state.name).trim() || 'standard'
    await ctx.data.set(T + name, { html: ta.value, at: new Date().toISOString(), by: store.actor })
    if (!names.includes(name)) { names.push(name); fillNames() }
    state.name = name; nameSel.value = name; state.dirty = false; store.toast(`💾 Vorlage „${name}“ gespeichert`)
  }
  async function remove() { if (state.name === 'standard' || !await ctx.dialog.confirm({ title: `Vorlage „${state.name}“ löschen?`, ok: '🗑 Löschen', danger: true })) return; await ctx.data.del(T + state.name); names.splice(names.indexOf(state.name), 1); fillNames(); loadTemplate('standard') }
  nodeIn.addEventListener('input', () => {
    const q = nodeIn.value.trim().toLowerCase(); pick.innerHTML = ''
    const hits = q ? tree.rows.filter(r => r.role !== 'group' && (r.label.toLowerCase().includes(q) || (r.sku ?? '').toLowerCase().includes(q) || r.id.includes(q))).slice(0, 12) : []
    for (const r of hits) pick.append(el('div', { class: 'pick', onmousedown: e => { e.preventDefault(); state.node = r.id; nodeIn.value = r.label; pick.style.display = 'none'; localStorage.setItem('journali.datasheet.node', r.id); preview() } }, `${r.role === 'product' ? '▦' : '◆'} ${r.label}`, el('span', { class: 'muted mono', style: 'margin-left:auto;font-size:11px' }, r.sku ?? r.id)))
    pick.style.display = hits.length ? 'block' : 'none'
  })
  nodeIn.addEventListener('blur', () => setTimeout(() => pick.style.display = 'none', 150))
  if (state.node) nodeIn.value = tree.byId.get(state.node)?.label ?? ''
  nameSel.addEventListener('change', () => loadTemplate(nameSel.value)); localeSel.addEventListener('change', preview)
  const help = el('details', { style: 'font-size:12px' }, el('summary', { class: 'muted' }, '? Platzhalter'),
    el('pre', { style: 'white-space:pre-wrap;margin:4px 0', html: '{{name}} {{sku}} {{id}} {{today}} · {{attr.key}} {{attr.key@en}} {{label.key}} {{unit.key}} · {{{attr.description}}} (HTML roh)\n{{#if image}}&lt;img src="{{image}}"&gt;{{/if}} · {{#each images}}{{url}}{{/each}}\n{{#each groups}}{{label}} {{#each attributes}}{{label}}: {{value}} {{unit}}{{/each}}{{/each}}\n{{#each variants}}{{sku}} {{name}} {{#each axes}}{{label}}: {{value}}{{/each}}{{/each}} · {{../name}} = Ebene hinauf · {{else}}' }),
    el('div', { class: 'chips' }, ...(store.model?.attributes ?? []).slice(0, 400).map(a => el('span', { class: 'chip', style: 'cursor:pointer', title: `${a.label?.de ?? ''} · ${a.type}`, onclick: () => { const s = ta.selectionStart; ta.setRangeText(a.type === 'html' ? `{{{attr.${a.key}}}}` : `{{attr.${a.key}}}`, s, ta.selectionEnd, 'end'); ta.focus(); ta.dispatchEvent(new Event('input')) } }, a.key))))
  root.append(
    el('div', { class: 'toolbar' }, el('h1', {}, '📄 Datenblatt-Designer'), nameSel, nameIn, el('button', { class: 'primary', onclick: save, title: 'Vorlage speichern (Strg+S) — im Journal, für alle' }, '💾'), el('button', { class: 'x', onclick: remove, title: 'Vorlage löschen' }, '✕'),
      el('span', { class: 'sep' }, '·'), el('span', { class: 'muted' }, 'Rolle → Vorlage:'), el('span', { class: 'muted' }, '▣'), roleSel('group'), el('span', { class: 'muted' }, '▦'), roleSel('product'), el('span', { class: 'muted' }, '◆'), roleSel('variant'),
      el('span', { class: 'grow' }), el('span', { style: 'position:relative' }, nodeIn, pick), localeSel, el('button', { onclick: () => { if (state.node) sheet(ctx, state.node, ta.value, localeSel.value).then(h => openSheet(h, 'Datenblatt')) }, title: 'im neuen Fenster öffnen → drucken / PDF' }, '⎙ öffnen'), status),
    el('div', { style: 'display:flex;flex:1;min-height:0' },
      el('div', { style: 'flex:1;display:flex;flex-direction:column;min-width:0;border-right:1px solid var(--line)' }, ta, el('div', { style: 'padding:4px 8px;border-top:1px solid var(--line);max-height:180px;overflow:auto' }, help)),
      el('div', { style: 'flex:1;display:flex;flex-direction:column;min-width:0' }, frame)))
  await loadTemplate(sett.product ?? 'standard')
  return () => clearTimeout(timer)
}

export default {
  views: [{ path: 'designer', label: 'Datenblatt-Designer', icon: '📄', mount: mountWysiwyg }, { path: 'html', label: 'Datenblatt: HTML-Vorlage', icon: '‹›', mount: mountDesigner }],
  nodeActions: [{
    // an jeder Rolle — auch die Gruppe hat ein Blatt (Datentabelle/Vergleich der Produkte darunter); Layout je Rolle (Taloan, 18.09.: „wo ist Datenblatt geblieben?“)
    label: 'Datenblatt erstellen', icon: '📄',
    async run(nodeId, ctx) {
      const row = ctx.tree.byId.get(nodeId); if (!row) return
      // Layout der Rolle (WYSIWYG); gibt es keins, aber eine HTML-Vorlage dieses Namens, die
      const l = await layoutFor(ctx, row.role)
      const hasLayout = (await ctx.data.get('layout:' + l.name)) != null, hasHtml = (await ctx.data.get(T + l.name)) != null
      if (!hasLayout && hasHtml) { const t = await templateFor(ctx, row.role); openSheet(await sheet(ctx, nodeId, t.html, t.locale), `Datenblatt ${row.label}`); return }
      const d = await dataOf(ctx, nodeId, l.locale); d.types = Object.fromEntries(ctx.store.model.attributes.map(a => [a.key, a.type])); d.locale = l.locale
      await preloadCompare(ctx, l.layout, d, l.locale)
      openSheet(renderSheet(l.layout, d, ctx.store.model), `Datenblatt ${row.label}`)
    },
  }, {
    // Designer mit diesem Knoten als Vorschau (Taloan, 18.09.: „erstellen und designen“)
    label: 'Datenblatt designen …', icon: '✎',
    run(nodeId, ctx) { localStorage.setItem('journali.datasheet.node', nodeId); ctx.go?.('/p/datasheet/designer') },
  }],
  // für andere Plugins (Export als PDF-Stapel o. ä.)
  render, dataOf, DEFAULT_TEMPLATE,
}
