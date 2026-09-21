// Zielbaum zum Auswählen (Taloan, 19.09.: „Auswahl nach Name??? echt?“): überall, wo ein Knoten gewählt wird — Export,
// JSON-Import, Jobs, Datenblatt —, derselbe aufklappbare Baum wie links: Gruppen, Produkte, wahlweise Varianten;
// Klick wählt, ▸/▾ klappt, Suchfeld filtert und klappt Treffer auf. Reines DOM, damit es Ansichten (Vue) und Plugins
// gleich benutzen können (ctx.treePicker).
import { tree, icon } from './tree.js'

/// mount(container, { value, roles: ['group','product'], onPick(row), height }) → { set(id), refresh() }
/// multi: true (Taloan: „mit selektierbaren Knoten“) — Haken je Knoten, ein Haken gilt für den Teilbaum; onChange(ids)
export function treePicker(container, { value = null, values = [], roles = ['group', 'product'], onPick = () => {}, onChange = () => {}, height = 240, allowRoot = false, multi = false } = {}) {
  const open = new Set()
  const picked = new Set(values)
  let cur = value, q = ''
  const above = id => { for (const a of tree.ancestors(id)) if (picked.has(a.id)) return true; return false }
  const box = document.createElement('div'); box.className = 'picker tp'; box.style.cssText = `max-height:${height}px;overflow:auto`
  const search = document.createElement('input'); search.type = 'search'; search.placeholder = '🔍 filtern'; search.style.cssText = 'width:100%;margin-bottom:4px'
  search.addEventListener('input', () => { q = search.value.trim().toLowerCase(); if (q) for (const r of tree.rows) if (matches(r)) for (const a of tree.ancestors(r.id)) open.add(a.id); draw() })
  const wrap = document.createElement('div'); wrap.append(search, box); container.append(wrap)
  const matches = r => q && (r.label.toLowerCase().includes(q) || tree.keyHit(r, q))
  const visible = r => !q || matches(r) || tree.rows.some(x => matches(x) && tree.ancestors(x.id).some(a => a.id === r.id))
  function reveal() { if (cur) for (const a of tree.ancestors(cur)) open.add(a.id); for (const r of tree.rows) if (!r.parent) open.add(r.id) }
  function draw() {
    box.innerHTML = ''
    if (allowRoot) { const row = document.createElement('div'); row.className = 'pick' + (cur === null ? ' on' : ''); row.textContent = '⌂ Wurzel (oberste Ebene)'; row.addEventListener('click', () => { cur = null; draw(); onPick(null) }); box.append(row) }
    const rec = (id, depth) => {
      for (const r of tree.kids(id)) {
        if (r.role === 'variant' && !roles.includes('variant')) continue
        if (!visible(r)) continue
        const kids = tree.kids(r.id).filter(k => k.role !== 'variant' || roles.includes('variant')).length
        const ok = roles.includes(r.role)
        const row = document.createElement('div'); row.className = 'pick' + ((multi ? picked.has(r.id) : cur === r.id) ? ' on' : '') + (ok ? '' : ' dim')
        row.style.paddingLeft = (8 + depth * 16) + 'px'; row.title = ok ? r.id : 'kein Ziel'
        const caret = document.createElement('span'); caret.className = 'muted caret'; caret.textContent = kids ? (open.has(r.id) ? '▾' : '▸') : ''
        caret.addEventListener('click', e => { e.stopPropagation(); open.has(r.id) ? open.delete(r.id) : open.add(r.id); draw() })
        if (multi && ok) {
          const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = picked.has(r.id) || above(r.id); cb.disabled = above(r.id); cb.title = above(r.id) ? 'im gewählten Teilbaum' : 'Teilbaum wählen'
          cb.addEventListener('click', e => { e.stopPropagation(); picked.has(r.id) ? picked.delete(r.id) : picked.add(r.id); draw(); onChange([...picked]) })
          row.append(caret, cb)
        } else row.append(caret)
        const label = document.createElement('span'); label.textContent = `${icon(r.role)} ${r.label}`
        row.append(label)
        if (r.keys) { const s = document.createElement('span'); s.className = 'mono muted'; s.style.cssText = 'margin-left:auto;font-size:11px'; s.textContent = tree.keyText(r); row.append(s) }
        row.addEventListener('click', () => { if (!ok) return; if (multi) { if (above(r.id)) return; picked.has(r.id) ? picked.delete(r.id) : picked.add(r.id); draw(); onChange([...picked]); return } cur = r.id; draw(); onPick(r) })
        box.append(row)
        if (open.has(r.id) || (q && kids)) rec(r.id, depth + 1)
      }
    }
    rec(null, 0)
    box.querySelector('.pick.on')?.scrollIntoView({ block: 'nearest' })
  }
  const start = async () => { if (!tree.loaded) await tree.load(); reveal(); draw() }
  start()
  return { set(id) { cur = id; reveal(); draw() }, setValues(ids) { picked.clear(); for (const i of ids) picked.add(i); draw() }, refresh: draw, get value() { return cur }, get values() { return [...picked] } }
}
