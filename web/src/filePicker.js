// Dateibrowser des Servers: ein Fenster für alles, was ein Pfad auf dem Server ist — Verzeichnis des Medienspeichers, Quelle eines
// Imports, Ziel eines Exports. Blättert über /api/files (FileApi.cs): Wurzeln (Datenverzeichnis, Programm, Laufwerke),
// hoch, hinein, Dateien neueste zuerst. Reines DOM wie treePicker, damit Ansichten (Vue) und Plugins (ctx.filePicker) es
// gleich benutzen. dirOnly: nur Verzeichnisse wählbar (Exportziel, Medienspeicher), sonst Datei oder Verzeichnis.
import { api } from './api.js'
import { t as t_ } from './i18n.js'

const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v) } for (const k of kids) e.append(k); return e }
const when = iso => iso ? new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
const size = n => n < 1024 ? n + 'b' : n < 1048576 ? (n / 1024).toFixed(0) + 'kb' : (n / 1048576).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + 'mb'

/// Ein Verzeichnisname, wie ihn der Server annimmt — sonst null
export function ordnerName(s) {
  const n = (s ?? '').trim()
  if (!n || n.length > 120 || n === '.' || n === '..') return null
  return /[\\/:*?"<>|]/.test(n) ? null : n
}

/// filePicker({ value, dirOnly, title, zugang, onPick(path) }) — öffnet das Fenster; onPick bekommt den gewählten Pfad.
/// zugang: der Zugang, über den geblaettert wird (DriverApi) — ohne Angabe das Dateisystem dieses Servers.
export function filePicker({ value = '', dirOnly = false, title = null, zugang = '', onPick = () => {} } = {}) {
  // Ohne Zugang der kurze Weg zum Dateisystem dieses Servers; mit Zugang über den Treiber (DriverApi)
  const basis = zugang ? `/api/drivers/${encodeURIComponent(zugang)}/files` : '/api/files'
  const dirWeg = zugang ? `/api/drivers/${encodeURIComponent(zugang)}/dir` : '/api/files/dir'
  const box = el('div', { style: 'position:fixed;inset:0;background:rgba(0,0,0,.45);display:grid;place-items:center;z-index:50' })
  const dlg = el('div', { style: 'width:min(860px,96vw);height:min(560px,90vh);background:var(--pane);border:1px solid var(--line);border-radius:8px;padding:12px 14px;font-size:13px;display:flex;flex-direction:column;gap:6px' })
  const pathIn = el('input', { type: 'text', class: 'pfad', onkeydown: e => { if (e.key === 'Enter') go(pathIn.value) } })
  const rootsSel = el('select', { style: 'width:180px', onchange: () => go(rootsSel.value) })
  const list = el('div', { style: 'flex:1;overflow:auto;border:1px solid var(--line);border-radius:4px' })
  const status = el('div', { class: 'muted', style: 'font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' })
  let cur = null, chosen = null
  const close = () => { box.remove(); window.removeEventListener('keydown', onKey) }
  const done = v => { onPick(v); close() }
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close() } }
  const mark = (tbl, tr, path) => { chosen = path; for (const t of tbl.querySelectorAll('tr.selected')) t.classList.remove('selected'); tr.classList.add('selected') }
  // Ordner anlegen und umbenennen — mehr fasst der Browser nicht an
  const neu = async () => {
    const { dialog } = await import('./dialog.js')
    const name = ordnerName(await dialog.prompt({ title: t_('Neuer Ordner'), text: cur?.path ?? '', placeholder: t_('Name') }))
    if (!name) return
    try { const r = await api.post(dirWeg, { path: cur.path, name }); await go(r.path) }
    catch (e) { status.textContent = e.message }
  }
  const umbenennen = async () => {
    const ziel = chosen && cur.dirs.some(d => d.path === chosen) ? chosen : cur?.path
    if (!ziel) return
    const { dialog } = await import('./dialog.js')
    const alt = ziel.split(/[\\/]/).filter(Boolean).pop() ?? ''
    const name = ordnerName(await dialog.prompt({ title: t_('Ordner umbenennen'), text: ziel, value: alt, placeholder: t_('Name') }))
    if (!name || name === alt) return
    try { const r = await api.post(dirWeg, { path: ziel, name }, 'PUT'); await go(chosen ? cur.path : r.path) }
    catch (e) { status.textContent = e.message }
  }
  const go = async p => {
    try {
      const d = await api.get(basis + (p ? '?path=' + encodeURIComponent(p) : ''))
      cur = d; chosen = null; pathIn.value = d.path
      status.textContent = t_('{0} Ordner · {1} Dateien (neueste zuerst)', [d.dirs.length, d.files.length]) + (d.blobs ? ' ' + t_('· sieht nach einem Medienspeicher aus ({0} Hash-Ordner)', [d.blobs]) : '')
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
  dlg.append(el('div', { style: 'font-weight:600;font-size:14px' }, title ?? (dirOnly ? t_('📁 Verzeichnis auf dem Server') : t_('📁 Datei oder Verzeichnis auf dem Server'))),
    el('div', { style: 'display:flex;gap:6px' }, rootsSel, pathIn, el('button', { type: 'button', title: t_('zu diesem Pfad'), onclick: () => go(pathIn.value) }, '→'),
      el('button', { type: 'button', class: 'neu', title: t_('Ordner im angezeigten Verzeichnis anlegen'), onclick: neu }, '＋'),
      el('button', { type: 'button', class: 'ren', title: t_('markierten Ordner umbenennen — ohne Markierung den angezeigten'), onclick: umbenennen }, '✎')),
    list, status,
    el('div', { style: 'display:flex;justify-content:flex-end;gap:8px' }, el('button', { type: 'button', onclick: close }, t_('Abbrechen')),
      el('button', { type: 'button', class: 'primary', title: dirOnly ? t_('markierten oder den angezeigten Ordner nehmen') : t_('markierte Datei bzw. markierten oder angezeigten Ordner nehmen'), onclick: () => cur && done(chosen ?? cur.path) }, t_('✓ Übernehmen'))))
  box.append(dlg); box.addEventListener('mousedown', e => { if (e.target === box) close() })
  document.body.append(box); window.addEventListener('keydown', onKey)
  const s = (value ?? '').trim(); go(/^https?:\/\//i.test(s) ? '' : s)
}
