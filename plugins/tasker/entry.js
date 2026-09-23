// Basis-Plugin tasker (Taloan, 19.09.2026): ⏱ Jobs — Grundfunktion der Gruppe Jobs und zugleich ihr Container: Prozess-Plugins
// (backup, export, json, ixp, datasheet) laufen hier als Job (requires: ["tasker"]). Jobs laufen im Server, nicht im Browser;
// regelmässig (cron) oder von Hand;
// hier verwalten, überwachen, Logs lesen. Ein Job = ein Prozess-Plugin (process im Manifest) mit Parametern.
// API: /api/jobs (JobApi.cs), Läufe und Ausgang im Journal (job:<key>), Log als Datei beim Server.
/// Braucht dieser Prozess zwingend ein Profil? Steht „leer“ im Namen des Feldes („Profil — … (leer = Werte unten)“),
/// geht es auch ohne: dann stehen die Werte im Job selbst. Sonst kann der Job ohne Profil nicht laufen
/// (Taloan, 23.09.2026: die Sicherung liess sich ohne Profil nicht speichern, obwohl das Feld „(leer)“ anbietet).
export function profilPflicht(profileDef) {
  return !!profileDef && !/leer/.test(profileDef.label ?? '')
}

/// Nächste Seite des Assistenten in dieser Richtung, die etwas zeigt — oder null, wenn keine mehr kommt.
/// `voll` sagt je Seite, ob sie Inhalt hat: ohne Fächer gibt es keine Ablage, ohne Parameter kein „Womit“
/// (Taloan, 23.09.2026: „erst nach Aussuchen von Plugin/Profil steht ja fest, was ich als Nächstes anzeige“).
export function naechsteSeite(voll, schritt, richtung) {
  for (let i = schritt + richtung; i >= 0 && i < voll.length; i += richtung) if (voll[i]) return i
  return null
}

/// Gehört dieser Parameter in den Dialog? Das Profil selbst immer, ebenso Pfade und Schalter — das stellt man je Job
/// ein. Alles Inhaltliche (Teilbaum, Format, Sprachen, Aufbewahrung) kommt aus dem Profil und wird dort gepflegt;
/// ohne gewähltes Profil sind diese Felder die einzige Quelle und stehen im Dialog (Taloan, 23.09.2026).
/// Ausnahme: `"perJob": true` am Parameter im Manifest — dann steht er immer da. Für das, was wirklich am Job hängt
/// und nicht am Profil, etwa das Ziel eines Exports in eine fremde Datenbank (Taloan, 23.09.2026).
export function stelle(def, profilGewaehlt) {
  if (def.perJob) return 'oben'
  if (!profilGewaehlt) return 'oben'
  if (def.type === 'profile' || def.key === 'profile') return 'oben'
  return def.type === 'boolean' || def.type === 'path' || def.type === 'dir' ? 'oben' : 'aus'
}

/// Welche Fächer ein Job benutzt: liest er Dateien, gibt es in/, done/ und failed/; schreibt er, gibt es out/.
/// (Taloan, 23.09.2026: ein Sicherungsjob legt nur ab — dann von in/ und failed/ zu sprechen, führt in die Irre.)
export function fachNames(files) {
  const out = []
  if (files?.in) out.push('in/', 'done/', 'failed/')
  if (files?.out) out.push('out/')
  return out
}

function el(tag, attrs = {}, ...kids) { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v) } for (const k of kids) e.append(k); return e }
const when = iso => iso ? new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
const STATUS = { ok: ['✓', 'pos'], warn: ['⚠', 'warn'], failed: ['✗', 'neg'], timeout: ['⏱✗', 'neg'], cancelled: ['⊘', 'muted'] }
// Zeitplan-Assistent (Taloan, 19.09.: wie der Terminplaner in Outlook — Wochentage ankreuzen, „jeden zweiten“, „3. Sonntag“ —
// oder ein cron-Ausdruck). Intern ist es immer cron: fünf Felder, dazu ein sechstes dN:Datum / wN:Datum für „alle N Tage/Wochen ab“
// (JobRunner.cs, Cron). Tag und Wochentag gelten zusammen: „15-21 * 0“ = 3. Sonntag im Monat.
const DAYS = [['1', 'Mo'], ['2', 'Di'], ['3', 'Mi'], ['4', 'Do'], ['5', 'Fr'], ['6', 'Sa'], ['0', 'So']]
const NTH = [['*', 'jeden'], ['1-7', '1.'], ['8-14', '2.'], ['15-21', '3.'], ['22-28', '4.']]
const MODES = [['manual', 'nur von Hand'], ['minutes', 'alle … Minuten'], ['hourly', 'stündlich'], ['daily', 'täglich'], ['weekly', 'wöchentlich'], ['monthly', 'monatlich'], ['cron', 'cron-Ausdruck']]
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const monday = () => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d) }
function fromCron(s) {
  const f = { mode: 'manual', every: 1, minute: 0, hour: 2, days: new Set(['1']), nth: '*', dom: 1, cron: s ?? '' }
  if (!s) return f
  const p = s.trim().split(/\s+/); f.mode = 'cron'
  const six = p.length === 6 ? p[5].match(/^([dw])(\d+):(\d{4}-\d{2}-\d{2})$/) : null
  if (p.length !== 5 && !six) return f
  const [mi, h, dom, mon, dow] = p; const n = x => /^\d+$/.test(x) ? Number(x) : null
  if (/^\*\/\d+$/.test(mi) && h === '*' && dom === '*' && mon === '*' && dow === '*' && !six) return { ...f, mode: 'minutes', every: Number(mi.slice(2)) }
  if (n(mi) != null && (h === '*' || /^\*\/\d+$/.test(h)) && dom === '*' && mon === '*' && dow === '*' && !six) return { ...f, mode: 'hourly', minute: n(mi), every: h === '*' ? 1 : Number(h.slice(2)) }
  if (n(mi) != null && n(h) != null && dom === '*' && mon === '*' && dow === '*' && (!six || six[1] === 'd')) return { ...f, mode: 'daily', minute: n(mi), hour: n(h), every: six ? Number(six[2]) : 1 }
  if (n(mi) != null && n(h) != null && NTH.some(([v]) => v === dom) && mon === '*' && dow !== '*' && dow.split(',').every(x => /^[0-7]$/.test(x)) && (!six || six[1] === 'w'))
    return { ...f, mode: 'weekly', minute: n(mi), hour: n(h), nth: dom, days: new Set(dow.split(',').map(x => x === '7' ? '0' : x)), every: six ? Number(six[2]) : 1 }
  if (n(mi) != null && n(h) != null && n(dom) != null && (mon === '*' || /^\*\/\d+$/.test(mon)) && dow === '*' && !six) return { ...f, mode: 'monthly', minute: n(mi), hour: n(h), dom: n(dom), every: mon === '*' ? 1 : Number(mon.slice(2)) }
  return f
}
function toCron(f) {
  const e = Math.max(1, Number(f.every) || 1), mi = Math.min(59, Math.max(0, Number(f.minute) || 0)), h = Math.min(23, Math.max(0, Number(f.hour) || 0))
  switch (f.mode) {
    case 'manual': return ''
    case 'minutes': return `*/${e} * * * *`
    case 'hourly': return `${mi} ${e > 1 ? '*/' + e : '*'} * * *`
    case 'daily': return `${mi} ${h} * * *${e > 1 ? ` d${e}:${iso(new Date())}` : ''}`
    case 'weekly': { const d = [...f.days].sort().join(',') || '*'; return `${mi} ${h} ${f.nth} * ${d}${e > 1 && f.nth === '*' ? ` w${e}:${monday()}` : ''}` }
    case 'monthly': return `${mi} ${h} ${Math.min(31, Math.max(1, Number(f.dom) || 1))} ${e > 1 ? '*/' + e : '*'} *`
    default: return f.cron.trim()
  }
}
/// Baut den Assistenten; onChange(cron) bei jeder Änderung; value() = aktueller Ausdruck
function scheduleAssistant(initial, onChange) {
  const f = fromCron(initial)
  const box = el('div', { class: 'sched' })
  const modeSel = el('select', { style: 'width:100%' }, ...MODES.map(([v, l]) => el('option', { value: v }, l))); modeSel.value = f.mode
  const num = (key, min, max, w = 56) => { const i = el('input', { type: 'number', value: String(f[key]), min: String(min), max: String(max), style: `width:${w}px` }); i.addEventListener('input', () => { f[key] = i.value; emit() }); return i }
  const time = () => el('span', { style: 'display:inline-flex;align-items:center;gap:4px' }, 'um ', num('hour', 0, 23), ':', num('minute', 0, 59))
  const cronIn = el('input', { type: 'text', value: f.cron, placeholder: 'm h tag monat wochentag [dN:datum | wN:datum]', style: 'width:100%' }); cronIn.addEventListener('input', () => { f.cron = cronIn.value; emit() })
  const shown = el('div', { class: 'mono muted', style: 'font-size:11px;margin-top:4px' })
  const body = el('div', { style: 'margin-top:6px;display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;font-size:13px' })
  function draw() {
    body.innerHTML = ''
    switch (f.mode) {
      case 'minutes': body.append('alle ', num('every', 1, 59), ' Minuten'); break
      case 'hourly': body.append('alle ', num('every', 1, 23), ' Stunden, zur Minute ', num('minute', 0, 59)); break
      case 'daily': body.append('alle ', num('every', 1, 365), ' Tage ', time()); break
      case 'weekly': {
        const nthSel = el('select', {}, ...NTH.map(([v, l]) => el('option', { value: v }, l))); nthSel.value = f.nth; nthSel.addEventListener('change', () => { f.nth = nthSel.value; draw(); emit() })
        body.append(nthSel)
        for (const [v, l] of DAYS) { const cb = el('input', { type: 'checkbox' }); cb.checked = f.days.has(v); cb.addEventListener('change', () => { cb.checked ? f.days.add(v) : f.days.delete(v); emit() }); body.append(el('label', { class: 'chip', style: 'cursor:pointer' }, cb, ' ' + l)) }
        if (f.nth === '*') body.append(el('span', {}, ', alle '), num('every', 1, 52), ' Wochen ')
        else body.append(el('span', { class: 'muted' }, 'im Monat '))
        body.append(time()); break
      }
      case 'monthly': body.append('am ', num('dom', 1, 31), '. alle ', num('every', 1, 12), ' Monate ', time()); break
      case 'cron': body.append(cronIn); break
    }
    emit(false)
  }
  function emit(fire = true) { const c = toCron(f); shown.textContent = c ? `cron: ${c}` : ''; if (fire) onChange(c) }
  modeSel.addEventListener('change', () => { f.mode = modeSel.value; if (f.mode === 'cron' && !f.cron) f.cron = toCron({ ...f, mode: 'daily', every: 1 }); cronIn.value = f.cron; draw(); emit() })
  box.append(modeSel, body, shown); draw()
  return { el: box, value: () => toCron(f) }
}
const PRESETS = [['', 'nur von Hand'], ['*/15 * * * *', 'alle 15 min'], ['0 * * * *', 'stündlich'], ['0 2 * * *', 'täglich 02:00'], ['30 6 * * 1-5', 'Mo–Fr 06:30'], ['0 3 * * 0', 'sonntags 03:00'], ['0 4 1 * *', 'monatlich am 1. 04:00']]

async function mount(root, ctx) {
  const { api, store, tree, dialog } = ctx
  if (!tree.loaded) await tree.load()
  const st = { jobs: [], plugins: [], cur: null, detail: null, log: '', timer: null, edit: null, plugin: new URLSearchParams(location.search).get('plugin') || '' }   // plugin: Liste nur mit den Jobs dieses Plugins (aus „Jobs verwalten“, Taloan)
  root.style.cssText = 'display:flex;flex-direction:column;height:100%;padding:0'
  const status = el('span', { class: 'muted' }); const say = m => status.textContent = m
  const list = el('div', { class: 'scroll', style: 'flex:0 0 auto;max-height:45%' })
  const detail = el('div', { class: 'scroll', style: 'flex:1;border-top:1px solid var(--line)' })
  const filterChip = el('span', { class: 'chip', title: 'nur Jobs dieses Plugins — × zeigt alle', style: 'cursor:default' })
  const drawFilter = () => { filterChip.innerHTML = ''; filterChip.style.display = st.plugin ? '' : 'none'; if (st.plugin) filterChip.append(`Plugin ${st.plugin} `, el('button', { onclick: () => { st.plugin = ''; drawFilter(); drawList() } }, '×')) }
  drawFilter()
  root.append(el('div', { class: 'toolbar' }, el('h1', {}, '⏱ Jobs'), el('button', { class: 'primary', onclick: () => openEdit(st.plugin ? { plugin: st.plugin, _new: true } : null) }, '+ Job'), filterChip, el('span', { class: 'grow' }), status), list, detail)

  async function load() {
    try { [st.jobs, st.plugins] = await Promise.all([api.get('/api/jobs'), api.get('/api/jobs/plugins')]) } catch (e) { say('✗ ' + e.message); return }
    drawList()
    if (st.cur) await loadDetail(st.cur)
    const running = st.jobs.filter(j => j.running).length
    say(`${st.jobs.length} Jobs · ${st.jobs.filter(j => j.enabled && j.schedule).length} geplant${running ? ` · ${running} laufen` : ''}`)
  }
  function drawList() {
    list.innerHTML = ''
    const jobs = st.plugin ? st.jobs.filter(j => j.plugin === st.plugin) : st.jobs
    if (!jobs.length) { list.append(el('div', { class: 'empty' }, st.plugin ? `Noch kein Job mit Plugin ${st.plugin} — „+ Job“ legt einen an.` : st.plugins.length ? 'Noch kein Job — „+ Job“ legt einen an.' : 'Kein Plugin mit Prozess installiert — Jobs brauchen eins.')); return }
    const tbl = el('table', { class: 'grid', style: 'width:100%' })
    tbl.append(el('thead', {}, el('tr', {}, el('th', {}, ''), el('th', {}, 'Job'), el('th', {}, 'Plugin'), el('th', {}, 'Zeitplan'), el('th', {}, 'nächster Lauf'), el('th', {}, 'letzter Lauf'), el('th', {}, ''))))
    const tb = el('tbody')
    for (const j of jobs) {
      const [sym, cls] = j.running ? ['▶', 'warn'] : STATUS[j.last?.status] ?? ['·', 'muted']
      const tr = el('tr', { class: 'row' + (st.cur === j.key ? ' selected' : ''), style: 'cursor:default', onclick: () => { st.cur = j.key; drawList(); loadDetail(j.key) } },
        el('td', { class: cls, title: j.running ? 'läuft' : j.last?.status ?? 'noch nie gelaufen' }, sym),
        el('td', {}, el('b', {}, j.label), el('span', { class: 'mono muted', style: 'margin-left:6px;font-size:11px' }, j.key)),
        el('td', { class: 'muted' }, j.plugin + (j.service ? '/' + j.service : '')),
        el('td', { title: j.schedule ?? '' }, j.enabled ? j.scheduleText : el('span', { class: 'muted' }, '○ aus')),
        el('td', { class: 'muted' }, j.nextDue ? when(j.nextDue) : ''),
        el('td', { class: 'muted', title: j.last?.summary ?? '' }, j.last ? `${when(j.last.startedAt)} · ${j.last.seconds}s` : ''),
        el('td', { style: 'white-space:nowrap' },
          j.running ? el('button', { class: 'x', title: 'abbrechen', onclick: ev => { ev.stopPropagation(); cancel(j) } }, '⊘') : el('button', { class: 'x', title: 'jetzt starten', onclick: ev => { ev.stopPropagation(); run(j) } }, '▶'),
          el('button', { class: 'x', title: j.enabled ? 'ausschalten (Zeitplan ruht)' : 'einschalten', onclick: ev => { ev.stopPropagation(); toggle(j) } }, j.enabled ? '●' : '○'),
          el('button', { class: 'x', title: 'bearbeiten', onclick: ev => { ev.stopPropagation(); openEdit(j) } }, '✎'),
          el('button', { class: 'x', title: 'Job entfernen (Läufe bleiben im Journal)', onclick: ev => { ev.stopPropagation(); remove(j) } }, '🗑')))
      tb.append(tr)
    }
    tbl.append(tb); list.append(tbl)
  }
  async function run(j) { try { await api.post(`/api/jobs/${j.key}/run`); store.toast(`▶ ${j.label} gestartet`, 'ok'); st.cur = j.key; await load(); watch() } catch (e) { store.toast(e.message) } }
  async function cancel(j) { try { await api.post(`/api/jobs/${j.key}/cancel`); store.toast(`⊘ ${j.label} abgebrochen`); await load() } catch (e) { store.toast(e.message) } }
  async function toggle(j) { try { await api.post(`/api/jobs/${j.key}`, { enabled: !j.enabled }, 'PUT'); await load() } catch (e) { store.toast(e.message) } }
  async function remove(j) { if (!await dialog.confirm({ title: `Job „${j.label}“ entfernen?`, ok: '🗑 Entfernen', danger: true })) return; try { await api.del(`/api/jobs/${j.key}`); if (st.cur === j.key) { st.cur = null; detail.innerHTML = '' } await load() } catch (e) { store.toast(e.message) } }

  // ---- Detail: Läufe und Log
  async function loadDetail(key) {
    try { st.detail = await api.get(`/api/jobs/${key}`) } catch (e) { store.toast(e.message); return }
    drawDetail()
    const r = st.detail.running ?? st.detail.runs[0]?.id
    if (r) await loadLog(key, r)
    if (st.detail.running) watch()
  }
  function watch() { clearTimeout(st.timer); st.timer = setTimeout(async () => { if (!st.cur) return; await load(); if (st.detail?.running) watch() }, 2000) }
  const logBox = el('pre', { class: 'mono', style: 'margin:0;padding:8px;font-size:11px;white-space:pre-wrap;flex:1;overflow:auto;background:var(--cell)' })
  let logRun = null
  async function loadLog(key, run) {
    logRun = run
    try { const r = await fetch(`${store.server}/api/jobs/${key}/runs/${run}/log?tail=400`); logBox.textContent = (await r.text()) || '(noch keine Ausgabe)'; logBox.scrollTop = logBox.scrollHeight } catch { logBox.textContent = '' }
    for (const b of detail.querySelectorAll('.runrow')) b.classList.toggle('selected', b.dataset.run === run)
  }
  function drawDetail() {
    detail.innerHTML = ''
    const d = st.detail; if (!d) return
    const head = el('div', { class: 'toolbar', style: 'gap:10px' }, el('b', {}, d.label), el('span', { class: 'muted' }, `${d.plugin} · ${d.scheduleText} · Zeitgrenze ${d.timeoutMinutes} min`),
      el('span', { class: 'muted mono', style: 'font-size:11px' }, Object.entries(d.params).map(([k, v]) => `${k}=${v}`).join(' ')), d.secrets.length ? el('span', { class: 'chip', title: 'Geheimnisse liegen beim Server (jobs/secrets.json), nicht im Journal' }, `🔒 ${d.secrets.join(', ')}`) : '')
    const runs = el('div', { style: 'width:340px;border-right:1px solid var(--line);overflow:auto' })
    const tbl = el('table', { class: 'grid', style: 'width:100%' })
    for (const r of d.runs) {
      const [sym, cls] = r.status ? STATUS[r.status] ?? ['?', 'muted'] : ['▶', 'warn']
      tbl.append(el('tr', { class: 'row runrow' + (r.id === logRun ? ' selected' : ''), 'data-run': r.id, style: 'cursor:default', onclick: () => loadLog(d.key, r.id), title: r.summary ?? '' },
        el('td', { class: cls }, sym), el('td', { class: 'muted' }, when(r.startedAt)), el('td', { class: 'muted' }, r.trigger === 'schedule' ? '⏱' : '👤'), el('td', { class: 'muted' }, r.seconds != null ? r.seconds + 's' : '…'), el('td', { class: 'muted', style: 'max-width:140px;overflow:hidden;text-overflow:ellipsis' }, r.summary ?? '')))
    }
    if (!d.runs.length) tbl.append(el('tr', {}, el('td', { class: 'muted', style: 'padding:8px' }, 'noch kein Lauf — ▶ startet einen')))
    runs.append(tbl)
    // Fächer (Taloan, 21.09.): Eingang wartend, verarbeitet (✓ ✗, Duplikat grau), Ausgaben (★ latest) — aus /api/jobs/<key>/files
    const files = el('div', { style: 'border-top:1px solid var(--line);padding:6px 8px;font-size:12px;max-height:40%;overflow:auto;display:none' })
    if (d.files || d.waiting || d.consumed || d.written) {
      files.style.display = ''
      api.get(`/api/jobs/${d.key}/files`).then(f => {
        if (!f.uses.in && !f.uses.out) { files.style.display = 'none'; return }
        const size = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(0) + ' KB' : (n / 1048576).toFixed(1) + ' MB'
        const col = (title, rows, empty) => el('div', { style: 'flex:1;min-width:200px' }, el('div', { style: 'font-weight:600;margin-bottom:2px' }, title), rows.length ? el('table', { class: 'grid', style: 'width:100%' }, ...rows) : el('div', { class: 'muted' }, empty))
        const cols = []
        if (f.uses.in) {
          cols.push(col(`Eingang · ${f.waiting.length} wartend`, f.waiting.map(w => el('tr', { class: 'row', title: `${w.name} · ${size(w.bytes)} · ${when(w.at)}` }, el('td', {}, w.name), el('td', { class: 'muted', style: 'text-align:right' }, size(w.bytes)))), 'nichts in in/ — ▶ läuft dann nicht'),
            col(`Verarbeitet · ${f.consumed.length}`, f.consumed.map(c => el('tr', { class: 'row' + (c.status === 'duplicate' ? ' muted' : ''), style: c.run ? 'cursor:pointer' : '', title: `${c.name} · ${size(c.bytes)} · ${when(c.at)} · ${c.status}${c.run ? ' · Lauf ' + c.run : ' · ohne Lauf'}${c.mediaId ? ' · archiviert ' + c.mediaId : ''}\nSHA-256 ${c.hash}`, onclick: () => { if (c.run) loadLog(d.key, c.run) } },
              el('td', { class: c.status === 'ok' ? 'pos' : c.status === 'failed' ? 'neg' : 'muted', style: 'width:18px' }, c.status === 'ok' ? '✓' : c.status === 'failed' ? '✗' : '≡'), el('td', {}, c.name), el('td', { class: 'muted', style: 'text-align:right;white-space:nowrap' }, when(c.at)))), 'noch nichts verarbeitet'))
        }
        if (f.uses.out) cols.push(col(`Ausgaben · ${f.written.length}${f.latest.length ? ' · ★ ' + f.latest.join(', ') : ''}`, f.written.map(o => el('tr', { class: 'row', style: 'cursor:pointer', title: `${o.name} · ${size(o.bytes)} · ${when(o.at)} · Lauf ${o.run}${o.latest ? ' · auch als latest' : ''}${o.mediaId ? ' · archiviert ' + o.mediaId : ''}\nSHA-256 ${o.hash}`, onclick: () => loadLog(d.key, o.run) },
          el('td', { style: 'width:18px' }, o.latest ? '★' : '·'), el('td', {}, o.name), el('td', { class: 'muted', style: 'text-align:right;white-space:nowrap' }, `${size(o.bytes)} · ${when(o.at)}`))), 'noch keine Ausgabe'))
        files.append(el('div', { class: 'muted', style: 'margin-bottom:4px' }, `📁 ${f.base}`, f.files?.keep ? ` · Aufbewahrung ${f.files.keep}` : ' · Aufbewahrung: alle', f.files?.latest ? ' · latest' : '', f.files?.archive ? ' · Archiv' : ''), el('div', { style: 'display:flex;gap:16px;flex-wrap:wrap' }, ...cols))
      }).catch(() => { files.style.display = 'none' })
    }
    detail.append(head, el('div', { style: 'display:flex;flex:1;min-height:0' }, runs, logBox), files)
    detail.style.display = 'flex'; detail.style.flexDirection = 'column'
  }

  // ---- Generischer Profil-Editor (Taloan, 21.09.: „alle Infos müssen im Profil vorliegen — entsprechend muss die GUI der Plugins ausgebaut werden“):
  // für Prozesse ohne eigene Ansicht ("profile": "generic" im Manifest). Formular aus den Parametern — ohne profile, Dateien/Verzeichnisse
  // (Sache des Taskers) und Geheimnisse (am Profil beim Server, 🔒). Gespeichert als profile:<name> in den Daten des Plugins (Journal).
  function profileEditor(p, defs, current, onDone) {
    const fields = defs.filter(d => !(d.type === 'profile' || d.key === 'profile' || d.type === 'path' || d.type === 'dir'))
    const box = el('div', { style: 'position:fixed;inset:0;background:rgba(0,0,0,.45);display:grid;place-items:center;z-index:50' })
    const dlg = el('div', { style: 'width:560px;max-height:90vh;overflow:auto;background:var(--pane);border:1px solid var(--line);border-radius:8px;padding:14px 16px;font-size:13px' })
    const sel = el('select', { style: 'flex:1' }, el('option', { value: '' }, '— neues Profil —'))
    const nameIn = el('input', { type: 'text', placeholder: 'Name des Profils', style: 'flex:1' })
    const form = el('div'); const inputs = {}; let secretKeys = []
    const status = el('span', { class: 'muted', style: 'font-size:12px' })
    const close = () => box.remove()
    const draw = (data = {}) => {
      form.innerHTML = ''
      for (const d of fields) {
        const cur = data[d.key] ?? d.default ?? ''
        let inp
        if (d.secret) {
          inp = el('input', { type: 'password', placeholder: secretKeys.includes(d.key) ? '•••••• (hinterlegt — leer lassen = behalten)' : 'geheim — bleibt beim Server, am Profil', style: 'width:100%' })
          form.append(el('label', { style: 'display:block;margin-top:8px;color:var(--muted)' }, d.label + ' 🔒'), inp)
        } else if (d.type === 'node') {
          inp = { value: cur }
          const shown = el('span', { class: 'muted' }, cur ? tree.byId.get(cur)?.label ?? cur : '(leer)')
          const tb = el('div'); ctx.treePicker(tb, { value: cur || null, roles: ['group', 'product'], height: 160, allowRoot: true, onPick: r => { inp.value = r?.id ?? ''; shown.textContent = r ? r.label : '(leer)' } })
          form.append(el('label', { style: 'display:block;margin-top:8px;color:var(--muted)' }, d.label, ' · ', shown), tb)
        } else if (d.type === 'pub') {
          inp = el('select', { style: 'width:100%' }, el('option', { value: '' }, '(keiner)'), ...(tree.pubTrees ?? []).map(r => el('option', { value: r.id }, `${r.label} · ${r.channel}${r.market ? '/' + r.market : ''}`))); inp.value = cur
          form.append(el('label', { style: 'display:block;margin-top:8px;color:var(--muted)' }, d.label), inp)
        } else if (d.type === 'boolean') {
          inp = el('input', { type: 'checkbox' }); inp.checked = String(cur) === 'true'
          Object.defineProperty(inp, 'value', { get() { return this.checked ? 'true' : 'false' }, configurable: true })
          form.append(el('label', { style: 'display:flex;gap:6px;align-items:center;margin-top:8px' }, inp, d.label))
        } else {
          inp = el('input', { type: d.type === 'number' ? 'number' : 'text', value: String(cur), style: 'width:100%' })
          form.append(el('label', { style: 'display:block;margin-top:8px;color:var(--muted)' }, d.label), inp)
        }
        inputs[d.key] = inp
      }
    }
    const loadNames = async keep => { const names = (await api.get(`/api/plugins/${p.key}/data?prefix=profile:`).catch(() => [])).map(n => n.slice(8)); sel.innerHTML = ''; sel.append(el('option', { value: '' }, '— neues Profil —'), ...names.map(n => el('option', { value: n }, n))); sel.value = keep && names.includes(keep) ? keep : '' }
    const loadOne = async n => {
      nameIn.value = n
      if (!n) { secretKeys = []; draw({}); return }
      const data = (await api.get(`/api/plugins/${p.key}/data/${encodeURIComponent('profile:' + n)}`).catch(() => null)) ?? {}
      secretKeys = (await api.get(`/api/plugins/${p.key}/secrets/${encodeURIComponent(n)}`).catch(() => ({ keys: [] }))).keys
      draw(data)
    }
    sel.addEventListener('change', () => loadOne(sel.value))
    const save = async () => {
      const n = nameIn.value.trim(); if (!n || n.includes(':')) { store.toast('Name fehlt (ohne Doppelpunkt)'); return }
      const data = {}, secrets = {}
      for (const d of fields) { const v = inputs[d.key]?.value ?? ''; if (d.secret) { if (v) secrets[d.key] = v } else if (v !== '') data[d.key] = d.type === 'boolean' ? v === 'true' : v }
      try {
        await api.post(`/api/plugins/${p.key}/data/${encodeURIComponent('profile:' + n)}`, data, 'PUT')
        if (Object.keys(secrets).length) await api.post(`/api/plugins/${p.key}/secrets/${encodeURIComponent(n)}`, { values: secrets }, 'PUT')
        store.toast(`Profil „${n}“ gespeichert`, 'ok'); close(); onDone?.(n)
      } catch (e) { store.toast(e.message) }
    }
    const del = async () => {
      const n = sel.value; if (!n) return
      if (!await dialog.confirm({ title: `Profil „${n}“ löschen?`, text: 'Jobs, die es nennen, laufen dann ohne diese Werte.', ok: '🗑 Löschen', danger: true })) return
      try { await api.del(`/api/plugins/${p.key}/data/${encodeURIComponent('profile:' + n)}`); await api.del(`/api/plugins/${p.key}/secrets/${encodeURIComponent(n)}`).catch(() => {}); await loadNames(''); await loadOne(''); onDone?.('') } catch (e) { store.toast(e.message) }
    }
    dlg.append(el('div', { style: 'font-weight:600;font-size:14px' }, `✎ Profile · ${(typeof p.label === 'string' ? p.label : p.label?.de) || p.key}`),
      el('div', { style: 'display:flex;gap:6px' }, sel, nameIn, el('button', { type: 'button', class: 'x', title: 'Profil löschen', onclick: del }, '🗑')),
      form,
      el('div', { style: 'display:flex;justify-content:flex-end;gap:8px;margin-top:14px;align-items:center' }, status, el('span', { class: 'grow' }), el('button', { type: 'button', onclick: close }, 'Abbrechen'), el('button', { type: 'button', class: 'primary', onclick: save }, '💾 Speichern')))
    box.append(dlg); box.addEventListener('mousedown', e => { if (e.target === box) close() })
    document.body.append(box)
    loadNames(current).then(() => loadOne(current || ''))
  }

  // ---- Anlegen / Bearbeiten: Plugin, Parameter aus dem Manifest, Zeitplan, Zeitgrenze
  async function openEdit(j) {
    const box = el('div', { class: 'overlay', style: 'position:fixed;inset:0;background:rgba(0,0,0,.45);display:grid;place-items:center;z-index:40' })
    const dlg = el('div', { style: 'width:560px;background:var(--pane);border:1px solid var(--line);border-radius:8px;padding:14px 16px;font-size:13px' })
    let preset = null
    if (j?._new) { preset = j.plugin + '|' + (j.service ?? ''); j = null }   // aus ⌁ Plugins: neuer Job mit diesem Plugin (und Dienst)
    const isNew = !j
    const keyIn = el('input', { type: 'text', value: j?.key ?? '', placeholder: 'key (a-z, 0-9, _)', style: 'width:100%' }); if (!isNew) keyIn.disabled = true
    const labelIn = el('input', { type: 'text', value: j?.label ?? '', placeholder: 'Bezeichnung', style: 'width:100%' })
    // ein Eintrag je Dienst (Taloan: mehrere Dienste je Plugin); Wert = plugin|service
    const svcId = p => `${p.key}|${p.service ?? ''}`
    const svcLabel = p => (typeof p.label === 'string' ? p.label : p.label?.de) || p.key
    const pluginSel = el('select', { style: 'width:100%' },
      ...[...st.plugins].sort((a, b) => svcLabel(a).localeCompare(svcLabel(b), 'de'))
        .map(p => el('option', { value: svcId(p), title: p.description ?? '' }, svcLabel(p))))   // nur der Name (Taloan: zu viel Text)
    const pluginHint = el('div', { class: 'muted', style: 'font-size:12px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' })
    if (j) pluginSel.value = `${j.plugin}|${j.service ?? ''}`
    else if (preset) { pluginSel.value = preset; if (pluginSel.value !== preset) pluginSel.value = st.plugins.find(p => svcId(p).startsWith(preset.split('|')[0] + '|')) ? svcId(st.plugins.find(p => svcId(p).startsWith(preset.split('|')[0] + '|'))) : pluginSel.value }
    const sched = scheduleAssistant(j?.schedule ?? '', () => {})   // Zeitplan-Assistent (Taloan) statt Vorgaben-Liste
    const timeoutIn = el('input', { type: 'number', value: String(j?.timeoutMinutes ?? 60), min: '1', max: '1440', style: 'width:90px' })
    // Fächer (docs/tasker-dateien.md, Taloan: der Tasker besitzt die Ablage): Basis, Aufbewahrung, latest, Archiv — nur bei Prozessen mit files im Manifest
    const fBase = el('input', { type: 'text', value: j?.files?.base ?? '', placeholder: 'leer = jobs/<key> beim Server', style: 'flex:1' })
    const fachLabelEl = el('label', { style: 'display:block;margin-top:8px;color:var(--muted)' }, 'Fächer · Basis')
    const fBaseBtn = el('button', { type: 'button', title: 'Basis der Fächer auf dem Server wählen', onclick: () => ctx.filePicker({ value: fBase.value, dirOnly: true, title: '📁 Basis der Fächer (in/, done/, failed/, out/)', onPick: v => { fBase.value = v } }) }, '📁')
    const fKeep = el('input', { type: 'text', value: j?.files?.keep ?? '', placeholder: 'alle', style: 'width:90px', title: 'Aufbewahrung: 10 = die letzten 10 Läufe, 30d = 30 Tage, leer = alle' })
    const fLatest = el('input', { type: 'checkbox' }); fLatest.checked = j?.files?.latest ?? true
    const fArchive = el('input', { type: 'checkbox' }); fArchive.checked = j?.files?.archive ?? false
    const fachBox = el('div', { style: 'display:none' },
      fachLabelEl, el('div', { style: 'display:flex;gap:4px' }, fBase, fBaseBtn),
      el('div', { style: 'display:flex;gap:14px;align-items:center;margin-top:6px;flex-wrap:wrap' },
        el('label', { style: 'display:flex;gap:6px;align-items:center' }, el('span', { class: 'muted' }, 'Aufbewahrung'), fKeep),
        el('label', { style: 'display:flex;gap:6px;align-items:center', title: 'nach jedem Lauf eine Kopie unter festem Namen: <key>-latest' }, fLatest, 'latest'),
        el('label', { style: 'display:flex;gap:6px;align-items:center', title: 'Eingänge und Ausgaben zusätzlich als Medium im Medienspeicher ablegen' }, fArchive, 'Archiv im Medienspeicher')))
    const paramsBox = el('div')
    const paramInputs = {}
    let profilWert = j?.params?.profile ?? ''   // welches Profil gewählt ist; ohne Profil stehen seine Werte im Dialog
    const drawParams = () => {
      paramsBox.innerHTML = ''
      const p = st.plugins.find(x => svcId(x) === pluginSel.value); const defs = p?.params ?? []
      pluginHint.textContent = p?.description ?? ''; pluginHint.title = pluginHint.textContent
      // Mit Profil (Taloan, 21.09.: „alle Infos müssen im Profil vorliegen — Ziel im Baum beim Import, Quelle vom Baum beim Export“):
      // im Dialog stehen dann nur Profil, Dateien/Verzeichnisse und Schalter. Ohne gewähltes Profil sind seine Felder
      // die einzige Quelle und stehen hier (Taloan, 23.09.)
      const profileDef = defs.find(d => d.type === 'profile' || d.key === 'profile')
      const hasProfile = !!profileDef && !!profilWert
      let secretNote = null
      profileSecrets = []
      const noteSecret = (profileName) => { if (!secretNote || !p) return; if (!profileName) { secretNote.textContent = ''; profileSecrets = []; check(); return } api.get(`/api/plugins/${p.key}/secrets/${encodeURIComponent(profileName)}`).then(r => { profileSecrets = r.keys; secretNote.textContent = r.keys.length ? `🔒 am Profil hinterlegt: ${r.keys.join(', ')}` : '🔒 am Profil nichts hinterlegt — in der Ansicht des Plugins (🔒) oder unten setzen'; check() }).catch(() => { secretNote.textContent = ''; profileSecrets = []; check() }) }
      for (const d of defs) {
        const cur = j?.params?.[d.key] ?? d.default ?? ''
        // sichtbar bleiben: Profil, Dateien/Verzeichnisse (Taloan: „das Einzige, was der Tasker können muss“), Schalter; Baum-Ziel/-Quelle, Texte, Geheimnisse: aus dem Profil
        // was im Profil steht, wird im Profil gepflegt — hier erscheint es gar nicht
        if (stelle(d, hasProfile) === 'aus') continue
        const append = (...nodes) => paramsBox.append(...nodes)
        let inp
        if (d.type === 'node') {
          // Auswahlbaum (Taloan): Wert ist die Knoten-Id, sichtbar der Name; „leer“ wählbar (⌂)
          inp = { value: cur }
          const shown = el('span', { class: 'muted' }, cur ? tree.byId.get(cur)?.label ?? cur : '(leer)')
          const box = el('div')
          ctx.treePicker(box, { value: cur || null, roles: ['group', 'product'], height: 180, allowRoot: true, onPick: r => { inp.value = r?.id ?? ''; shown.textContent = r ? r.label : '(leer)' } })
          append(el('label', { style: 'display:block;margin-top:8px;color:var(--muted)' }, d.label, ' · ', shown), box)
        } else if (d.type === 'pub') {
          // Publikationsbaum (Taloan, 21.09.: Export-Job an der Ausleitung): Dropdown der Bäume, leer = keiner
          inp = el('select', {}, el('option', { value: '' }, '(keiner — Teilbaum unten)'), ...(tree.pubTrees ?? []).map(r => el('option', { value: r.id }, `${r.label} · ${r.channel}${r.market ? '/' + r.market : ''}`)))
          inp.value = cur
          append(el('label', { style: 'display:block;margin-top:8px;color:var(--muted)' }, d.label), inp)
        } else if (d.type === 'path' || d.type === 'dir') {
          // Pfad auf dem Server (Taloan, 21.09.: „Gibt's hier wohl auch nen Browser?“): Textfeld plus 📁 — der Dateibrowser der Oberfläche (ctx.filePicker, /api/files)
          inp = el('input', { type: 'text', value: cur, placeholder: d.type === 'dir' ? 'Verzeichnis auf dem Server' : 'Datei, Verzeichnis oder URL', style: 'flex:1' })
          const pick = el('button', { type: 'button', title: d.type === 'dir' ? 'Verzeichnis auf dem Server wählen' : 'Datei oder Verzeichnis auf dem Server wählen', onclick: () => ctx.filePicker({ value: inp.value, dirOnly: d.type === 'dir', onPick: v => { inp.value = v } }) }, '📁')
          append(el('label', { style: 'display:block;margin-top:8px;color:var(--muted)' }, d.label), el('div', { style: 'display:flex;gap:4px' }, inp, pick))
        } else if (d.type === 'profile' || d.key === 'profile') {
          // Profil des Plugins (Taloan, 21.09.: „was muss man hier eingeben?“ / „muss ich jedes einzeln aufzählen?“): jeder Parameter profile
          // wird ein Dropdown der gespeicherten Profile — profile:<name> (json, xport) und config:<name> (ProfileBar: ixp, solr) im Plugin-Strom
          inp = el('select', { style: 'width:100%' }, el('option', { value: '' }, /leer/.test(d.label) ? '(leer)' : '— Profil —'))
          if (profilWert) inp.append(el('option', { value: profilWert }, profilWert)); inp.value = profilWert
          api.get(`/api/plugins/${p.key}/data`).then(all => {
            const names = [...new Set(all.filter(x => /^(profile|config):/.test(x)).map(x => x.replace(/^(profile|config):/, '')))].sort((a, b) => a.localeCompare(b, 'de'))
            for (const n of names) if (n !== cur) inp.append(el('option', { value: n }, n))
            if (!names.length && !cur) inp.title = 'noch kein Profil gespeichert — in der Ansicht des Plugins anlegen'
          }).catch(() => {})
          inp.addEventListener('change', () => { profilWert = inp.value; noteSecret(inp.value); drawParams(); check(); zeige(schritt) })
          secretNote = el('div', { class: 'muted', style: 'font-size:12px;margin-top:2px' })
          // Prozess ohne eigene Ansicht (export, backup, rag, Datenblatt-Job, JSON-Export): Profile hier anlegen — ein Formular aus den Parametern des Manifests
          const editBtn = p?.profile === 'generic' ? el('button', { type: 'button', class: 'x', title: 'Profile dieses Prozesses anlegen und ändern', onclick: () => profileEditor(p, defs, inp.value, n => { drawParams(); const sel = paramInputs.profile; if (sel && n) { if (![...sel.options].some(o => o.value === n)) sel.append(el('option', { value: n }, n)); sel.value = n; noteSecret(n) } }) }, '✎') : ''
          paramsBox.append(el('label', { style: 'display:block;margin-top:8px;color:var(--muted)' }, d.label), el('div', { style: 'display:flex;gap:4px' }, inp, editBtn), secretNote)
          if (cur) noteSecret(cur)
        } else if (d.type === 'boolean') {
          inp = el('input', { type: 'checkbox' }); inp.checked = String(cur) === 'true'
          Object.defineProperty(inp, 'value', { get() { return this.checked ? 'true' : 'false' }, configurable: true })
          paramsBox.append(el('label', { style: 'display:flex;gap:6px;align-items:center;margin-top:8px' }, inp, d.label))
        } else {
          inp = el('input', { type: d.secret ? 'password' : d.type === 'number' ? 'number' : 'text', value: d.secret ? '' : cur, placeholder: d.secret ? (j?.secrets?.includes(d.key) ? '•••••• (gesetzt — leer lassen = behalten)' : hasProfile ? 'leer = am Profil hinterlegt' : 'geheim — bleibt beim Server') : '', style: 'width:100%' })
          append(el('label', { style: 'display:block;margin-top:8px;color:var(--muted)' }, d.label + (d.secret ? ' 🔒' : '')), inp)
        }
        paramInputs[d.key] = inp
      }

      fachBox.style.display = p?.files ? '' : 'none'
      // nur die Fächer nennen, die dieses Plugin wirklich benutzt: wer nur schreibt, hat kein in/ und kein failed/
      if (p?.files) { fachLabelEl.textContent = `Fächer · Basis (${fachNames(p.files).join(', ')})`; fBaseBtn.title = `Basis der Fächer auf dem Server wählen (${fachNames(p.files).join(', ')})` }
      if (!defs.length) paramsBox.append(el('div', { class: 'muted', style: 'margin-top:8px' }, 'Dieses Plugin hat keine Parameter.'))
    }
    // Speichern nur, wenn der Job laufen kann (Taloan, 21.09.: „speichern deaktiviert, solange ein Profil nicht ausführbar ist“):
    // key, Profil (wenn der Prozess eines hat), Dateien/Verzeichnisse, Geheimnis (am Job oder am Profil hinterlegt)
    let profileSecrets = []
    let markieren = null   // wird gesetzt, sobald die Schrittleiste steht (weiter unten)
    let schritt = 0        // welche Seite gerade sichtbar ist — check() zeigt nur deren Meldungen
    const saveBtn = el('button', { class: 'primary', onclick: () => save() }, '💾 Speichern')
    const why = el('span', { class: 'neg', style: 'font-size:12px;align-self:center;flex:1' })
    function check() {
      const p = st.plugins.find(x => svcId(x) === pluginSel.value); const defs = p?.params ?? []
      const reasons = []   // { text, seite } — die Seite, auf der es zu beheben ist
      const fehlt = (text, seite) => reasons.push({ text, seite })
      if (isNew && !keyIn.value.trim()) fehlt('Key fehlt', 0)
      const profileDef = defs.find(d => d.type === 'profile' || d.key === 'profile')
      const profile = paramInputs.profile?.value ?? ''
      // „(leer = Werte unten)“ im Feldnamen heisst: ohne Profil geht es auch, dann stehen die Werte im Job
      if (!profile && profilPflicht(profileDef)) fehlt('Profil fehlt — in der Ansicht des Plugins speichern' + (p?.profile === 'generic' ? ' oder ✎' : ''), 1)
      for (const d of defs) {
        const v = paramInputs[d.key]?.value ?? ''
        // mit Fächern kommt die Datei aus in/ bzw. geht nach out/ — dann ist der Parameter nicht Pflicht
        if ((d.type === 'path' || d.type === 'dir') && !v && !(d.type === 'dir' ? p?.files?.out : p?.files?.in)) fehlt(`${d.type === 'dir' ? 'Verzeichnis' : 'Quelle'} fehlt`, 1)
        if (d.secret && !v && !j?.secrets?.includes(d.key) && !profileSecrets.includes(d.key)) fehlt(`${d.label.split(' —')[0]} fehlt — am Profil hinterlegen (🔒)`, 1)
      }
      saveBtn.disabled = reasons.length > 0; saveBtn.title = reasons.map(r => r.text).join(' · ')
      // unten steht nur, was auf dieser Seite zu beheben ist; die anderen Seiten bekommen ein ✗ in der Leiste
      const hier = reasons.find(r => r.seite === schritt)
      why.textContent = hier ? '✗ ' + hier.text : ''
      markieren?.(reasons)
      return reasons.length === 0
    }
    pluginSel.addEventListener('change', () => { drawParams(); check(); zeige(schritt); kopfSetzen() }); drawParams(); check()
    dlg.addEventListener('input', check); dlg.addEventListener('change', check)
    const save = async () => {
      if (!check()) return
      const key = (isNew ? keyIn.value : j.key).trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
      if (!key) { store.toast('key fehlt'); return }
      const params = {}
      for (const [k, inp] of Object.entries(paramInputs)) if (inp.value !== '' || inp.type !== 'password') params[k] = inp.value
      const schedule = sched.value()
      try {
        const files = fachBox.style.display === 'none' ? null : { base: fBase.value.trim() || null, keep: fKeep.value.trim() || null, latest: fLatest.checked, archive: fArchive.checked }
        await api.post(`/api/jobs/${key}`, { label: labelIn.value.trim() || key, plugin: pluginSel.value.split('|')[0], service: pluginSel.value.split('|')[1] || '', params, schedule, enabled: j?.enabled ?? true, timeoutMinutes: Number(timeoutIn.value) || 60, files }, 'PUT')
        store.toast(`Job „${labelIn.value || key}“ gespeichert`, 'ok'); box.remove(); st.cur = key; await load()
      } catch (e) { store.toast(e.message) }
    }
    // ---- Assistent: vier Schritte statt einer Seite, die über den Bildschirm hinauswächst ----
    const lab = text => el('label', { style: 'display:block;margin-top:8px;color:var(--muted)' }, text)
    const seiten = [
      { name: '① Was', box: el('div', {}, lab('Key'), keyIn, lab('Bezeichnung'), labelIn, lab('Plugin (Prozess)'), pluginSel, pluginHint) },
      { name: '② Womit', box: el('div', {}, paramsBox), leer: () => !paramsBox.childElementCount },
      { name: '③ Ablage', box: el('div', {}, fachBox), leer: () => fachBox.style.display === 'none' },
      { name: '④ Wann', box: el('div', {}, lab('Zeitplan'), sched.el, lab('Zeitgrenze (min)'), timeoutIn) },
    ]
    const chips = seiten.map((s, i) => el('span', { class: 'view-chip', style: 'cursor:pointer', title: s.name.slice(2), onclick: () => zeige(i) }, s.name))
    /// Seiten mit offenen Punkten tragen ein ✗ und sagen im Tooltip, was fehlt — anklickbar, dort steht es dann unten
    markieren = reasons => chips.forEach((c, i) => {
      const offen = reasons.filter(r => r.seite === i)
      c.classList.toggle('neg', offen.length > 0)
      c.textContent = seiten[i].name + (offen.length ? ' ✗' : '')
      c.title = offen.length ? offen.map(r => r.text).join(' · ') : seiten[i].name.slice(2)
    })
    const bühne = el('div', { style: 'min-height:240px;max-height:min(56vh,520px);overflow:auto;padding-right:4px' })
    const zurück = el('button', { type: 'button', title: 'zurück', onclick: () => blättern(-1) }, '←')
    const vor = el('button', { type: 'button', title: 'weiter', onclick: () => blättern(1) }, '→')
    /// hat diese Seite etwas zu zeigen? (ohne Fächer keine Ablage, ohne Parameter kein Womit)
    const voll = i => !seiten[i].leer?.()
    function zeige(i) {
      if (!voll(i)) return
      schritt = i
      bühne.innerHTML = ''
      bühne.append(seiten[i].box)
      seiten.forEach((s, n) => { chips[n].style.display = voll(n) ? '' : 'none'; chips[n].classList.toggle('on', n === i) })
      check()   // die Meldung unten gilt der Seite, die man gerade sieht
      const sichtbar = seiten.map((_, n) => voll(n))
      zurück.disabled = naechsteSeite(sichtbar, i, -1) === null
      vor.disabled = naechsteSeite(sichtbar, i, 1) === null
    }
    /// zur nächsten Seite, die etwas zeigt
    function blättern(richtung) {
      const i = naechsteSeite(seiten.map((_, n) => voll(n)), schritt, richtung)
      if (i !== null) zeige(i)
    }
    const kopf = el('div', { style: 'font-weight:600;font-size:14px' })
    const kopfSetzen = () => {
      const p = st.plugins.find(x => svcId(x) === pluginSel.value)
      kopf.innerHTML = ''
      kopf.append(isNew ? '+ Job' : `✎ ${j.label}`, el('span', { class: 'muted', style: 'font-weight:400;margin-left:6px' }, p ? '· ' + svcLabel(p) : ''))
    }
    dlg.append(kopf,
      el('div', { style: 'display:flex;gap:4px;margin:8px 0;flex-wrap:wrap' }, ...chips),
      bühne,
      el('div', { style: 'display:flex;align-items:center;gap:8px;margin-top:14px' },
        zurück, vor, el('span', { style: 'flex:1' }), why, el('button', { onclick: () => box.remove() }, 'Abbrechen'), saveBtn))
    kopfSetzen(); zeige(0)
    box.append(dlg); box.addEventListener('mousedown', e => { if (e.target === box) box.remove() })
    document.body.append(box); (isNew ? keyIn : labelIn).focus()
  }

  await load()
  // aus ⌁ Plugins „Als Job einrichten“: ?new=<plugin> öffnet den Dialog mit diesem Plugin
  const q = new URLSearchParams(location.search); const wanted = q.get('new')
  if (wanted && st.plugins.some(p => p.key === wanted)) { history.replaceState(null, '', location.pathname); openEdit({ plugin: wanted, service: q.get('service') ?? '', _new: true }) }
  else if (st.plugin) history.replaceState(null, '', location.pathname)
  const poll = setInterval(() => { if (st.jobs.some(j => j.running)) load() }, 5000)
  return () => { clearInterval(poll); clearTimeout(st.timer) }
}

export default {
  views: [{ path: 'jobs', topic: 'jobs', label: 'Jobs', icon: '⏱', hint: 'im Server, Zeitplan, Läufe, Logs', mount }],
}
