// Dateibrowser des Servers (Taloan, 21.09.2026: „Gibt's hier wohl auch nen Browser?“ — und „die beiden Verzeichnisbrowser
// zusammenlegen“): ein Fenster für alles, was ein Pfad auf dem Server ist — Verzeichnis des Medienspeichers, Quelle eines
// Imports, Ziel eines Exports. Blättert über /api/files (FileApi.cs): Wurzeln (Datenverzeichnis, Programm, Laufwerke),
// hoch, hinein, Dateien neueste zuerst. Reines DOM wie treePicker, damit Ansichten (Vue) und Plugins (ctx.filePicker) es
// gleich benutzen. dirOnly: nur Verzeichnisse wählbar (Exportziel, Medienspeicher), sonst Datei oder Verzeichnis.
import { api } from './api.js'

const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v) } for (const k of kids) e.append(k); return e }
const when = iso => iso ? new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
const size = n => n < 1024 ? n + 'b' : n < 1048576 ? (n / 1024).toFixed(0) + 'kb' : (n / 1048576).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + 'mb'

/// filePicker({ value, dirOnly, title, onPick(path) }) — öffnet das Fenster; onPick bekommt den gewählten Pfad
export function filePicker({ value = '', dirOnly = false, title = null, onPick = () => {} } = {}) {
  const box = el('div', { style: 'position:fixed;inset:0;background:rgba(0,0,0,.45);display:grid;place-items:center;z-index:50' })
  const dlg = el('div', { style: 'width:min(640px,96vw);height:min(520px,90vh);background:var(--pane);border:1px solid var(--line);border-radius:8px;padding:12px 14px;font-size:13px;display:flex;flex-direction:column;gap:6px' })
  const pathIn = el('input', { type: 'text', style: 'flex:1', onkeydown: e => { if (e.key === 'Enter') go(pathIn.value) } })
  const rootsSel = el('select', { style: 'width:180px', onchange: () => go(rootsSel.value) })
  const list = el('div', { style: 'flex:1;overflow:auto;border:1px solid var(--line);border-radius:4px' })
  const status = el('div', { class: 'muted', style: 'font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' })
  let cur = null, chosen = null
  const close = () => { box.remove(); window.removeEventListener('keydown', onKey) }
  const done = v => { onPick(v); close() }
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close() } }
  const mark = (tbl, tr, path) => { chosen = path; for (const t of tbl.querySelectorAll('tr.selected')) t.classList.remove('selected'); tr.classList.add('selected') }
  const go = async p => {
    try {
      const d = await api.get('/api/files' + (p ? '?path=' + encodeURIComponent(p) : ''))
      cur = d; chosen = null; pathIn.value = d.path
      status.textContent = `${d.dirs.length} Ordner · ${d.files.length} Dateien (neueste zuerst)` + (d.blobs ? ` · sieht nach einem Medienspeicher aus (${d.blobs} Hash-Ordner)` : '')
      rootsSel.innerHTML = ''; for (const r of d.roots) rootsSel.append(el('option', { value: r.path }, r.label))
      const root = d.roots.find(r => d.path.toLowerCase().startsWith(r.path.toLowerCase())); rootsSel.value = root ? root.path : ''
      list.innerHTML = ''
      const tbl = el('table', { class: 'grid', style: 'width:100%' })
      const row = (sym, name, right, onclick, ondbl, title) => { const tr = el('tr', { class: 'row', style: 'cursor:default', title, onclick, ondblclick: ondbl }, el('td', { style: 'width:22px' }, sym), el('td', {}, name), el('td', { class: 'muted', style: 'text-align:right;white-space:nowrap' }, right)); tbl.append(tr); return tr }
      if (d.parent) row('↑', '..', '', () => go(d.parent), () => go(d.parent), d.parent)
      for (const x of d.dirs) row('📁', x.name, '', e => mark(tbl, e.currentTarget, x.path), () => go(x.path), x.path)
      for (const x of d.files) row('▤', x.name, `${size(x.size)} · ${when(x.at)}`, e => { if (!dirOnly) mark(tbl, e.currentTarget, x.path) }, () => { if (!dirOnly) done(x.path) }, x.path).style.opacity = dirOnly ? '.45' : ''
      if (!d.dirs.length && !d.files.length) tbl.append(el('tr', {}, el('td', { class: 'muted', style: 'padding:8px' }, 'leer')))
      list.append(tbl)
    } catch (e) { status.textContent = e.message }
  }
  dlg.append(el('div', { style: 'font-weight:600;font-size:14px' }, title ?? (dirOnly ? '📁 Verzeichnis auf dem Server' : '📁 Datei oder Verzeichnis auf dem Server')),
    el('div', { style: 'display:flex;gap:6px' }, rootsSel, pathIn, el('button', { type: 'button', title: 'zu diesem Pfad', onclick: () => go(pathIn.value) }, '→')),
    list, status,
    el('div', { style: 'display:flex;justify-content:flex-end;gap:8px' }, el('button', { type: 'button', onclick: close }, 'Abbrechen'),
      el('button', { type: 'button', class: 'primary', title: dirOnly ? 'markierten oder den angezeigten Ordner nehmen' : 'markierte Datei bzw. markierten oder angezeigten Ordner nehmen', onclick: () => cur && done(chosen ?? cur.path) }, '✓ Übernehmen')))
  box.append(dlg); box.addEventListener('mousedown', e => { if (e.target === box) close() })
  document.body.append(box); window.addEventListener('keydown', onKey)
  const s = (value ?? '').trim(); go(/^https?:\/\//i.test(s) ? '' : s)
}
