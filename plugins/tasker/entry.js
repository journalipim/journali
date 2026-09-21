// Basis-Plugin tasker (Taloan, 19.09.2026): ⏱ Jobs — Grundfunktion der Gruppe Jobs und zugleich ihr Container: Prozess-Plugins
// (backup, export, json, ixp, datasheet) laufen hier als Job (requires: ["tasker"]). Jobs laufen im Server, nicht im Browser;
// regelmässig (cron) oder von Hand;
// hier verwalten, überwachen, Logs lesen. Ein Job = ein Prozess-Plugin (process im Manifest) mit Parametern.
// API: /api/jobs (JobApi.cs), Läufe und Ausgang im Journal (job:<key>), Log als Datei beim Server.
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
    if (!jobs.length) { list.append(el('div', { class: 'empty' }, st.plugin ? `Noch kein Job mit Plugin ${st.plugin} — „+ Job“ legt einen an.` : st.plugins.length ? 'Noch kein Job — „+ Job“ legt einen an (z. B. Sicherung jede Nacht).' : 'Kein Plugin mit Prozess installiert — Jobs brauchen eins (z. B. backup).')); return }
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
    detail.append(head, el('div', { style: 'display:flex;flex:1;min-height:0' }, runs, logBox))
    detail.style.display = 'flex'; detail.style.flexDirection = 'column'
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
    const pluginSel = el('select', { style: 'width:100%' }, ...st.plugins.map(p => el('option', { value: svcId(p), title: p.description ?? '' }, (typeof p.label === 'string' ? p.label : p.label?.de) || p.key)))   // nur der Name (Taloan: zu viel Text)
    const pluginHint = el('div', { class: 'muted', style: 'font-size:12px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' })
    if (j) pluginSel.value = `${j.plugin}|${j.service ?? ''}`
    else if (preset) { pluginSel.value = preset; if (pluginSel.value !== preset) pluginSel.value = st.plugins.find(p => svcId(p).startsWith(preset.split('|')[0] + '|')) ? svcId(st.plugins.find(p => svcId(p).startsWith(preset.split('|')[0] + '|'))) : pluginSel.value }
    const sched = scheduleAssistant(j?.schedule ?? '', () => {})   // Zeitplan-Assistent (Taloan) statt Vorgaben-Liste
    const timeoutIn = el('input', { type: 'number', value: String(j?.timeoutMinutes ?? 60), min: '1', max: '1440', style: 'width:90px' })
    const paramsBox = el('div')
    const paramInputs = {}
    const drawParams = () => {
      paramsBox.innerHTML = ''
      const p = st.plugins.find(x => svcId(x) === pluginSel.value); const defs = p?.params ?? []
      pluginHint.textContent = p?.description ?? ''; pluginHint.title = pluginHint.textContent
      for (const d of defs) {
        const cur = j?.params?.[d.key] ?? d.default ?? ''
        let inp
        if (d.type === 'node') {
          // Auswahlbaum (Taloan): Wert ist die Knoten-Id, sichtbar der Name; „leer“ wählbar (⌂)
          inp = { value: cur }
          const shown = el('span', { class: 'muted' }, cur ? tree.byId.get(cur)?.label ?? cur : '(leer)')
          const box = el('div')
          ctx.treePicker(box, { value: cur || null, roles: ['group', 'product'], height: 180, allowRoot: true, onPick: r => { inp.value = r?.id ?? ''; shown.textContent = r ? r.label : '(leer)' } })
          paramsBox.append(el('label', { style: 'display:block;margin-top:8px;color:var(--muted)' }, d.label, ' · ', shown), box)
        } else if (d.type === 'pub') {
          // Publikationsbaum (Taloan, 21.09.: Export-Job an der Ausleitung): Dropdown der Bäume, leer = keiner
          inp = el('select', {}, el('option', { value: '' }, '(keiner — Teilbaum unten)'), ...(tree.pubTrees ?? []).map(r => el('option', { value: r.id }, `${r.label} · ${r.channel}${r.market ? '/' + r.market : ''}`)))
          inp.value = cur
          paramsBox.append(el('label', { style: 'display:block;margin-top:8px;color:var(--muted)' }, d.label), inp)
        } else if (d.type === 'boolean') {
          inp = el('input', { type: 'checkbox' }); inp.checked = String(cur) === 'true'
          Object.defineProperty(inp, 'value', { get() { return this.checked ? 'true' : 'false' }, configurable: true })
          paramsBox.append(el('label', { style: 'display:flex;gap:6px;align-items:center;margin-top:8px' }, inp, d.label))
        } else {
          inp = el('input', { type: d.secret ? 'password' : d.type === 'number' ? 'number' : 'text', value: d.secret ? '' : cur, placeholder: d.secret ? (j?.secrets?.includes(d.key) ? '•••••• (gesetzt — leer lassen = behalten)' : 'geheim — bleibt beim Server') : '', style: 'width:100%' })
          paramsBox.append(el('label', { style: 'display:block;margin-top:8px;color:var(--muted)' }, d.label + (d.secret ? ' 🔒' : '')), inp)
        }
        paramInputs[d.key] = inp
      }
      if (!defs.length) paramsBox.append(el('div', { class: 'muted', style: 'margin-top:8px' }, 'Dieses Plugin hat keine Parameter.'))
    }
    pluginSel.addEventListener('change', drawParams); drawParams()
    const save = async () => {
      const key = (isNew ? keyIn.value : j.key).trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
      if (!key) { store.toast('key fehlt'); return }
      const params = {}
      for (const [k, inp] of Object.entries(paramInputs)) if (inp.value !== '' || inp.type !== 'password') params[k] = inp.value
      const schedule = sched.value()
      try {
        await api.post(`/api/jobs/${key}`, { label: labelIn.value.trim() || key, plugin: pluginSel.value.split('|')[0], service: pluginSel.value.split('|')[1] || '', params, schedule, enabled: j?.enabled ?? true, timeoutMinutes: Number(timeoutIn.value) || 60 }, 'PUT')
        store.toast(`Job „${labelIn.value || key}“ gespeichert`, 'ok'); box.remove(); st.cur = key; await load()
      } catch (e) { store.toast(e.message) }
    }
    dlg.append(el('div', { style: 'font-weight:600;font-size:14px' }, isNew ? '+ Job' : `✎ ${j.label}`),
      el('label', { style: 'display:block;margin-top:8px;color:var(--muted)' }, 'Key'), keyIn,
      el('label', { style: 'display:block;margin-top:8px;color:var(--muted)' }, 'Bezeichnung'), labelIn,
      el('label', { style: 'display:block;margin-top:8px;color:var(--muted)' }, 'Plugin (Prozess)'), pluginSel, pluginHint, paramsBox,
      el('label', { style: 'display:block;margin-top:8px;color:var(--muted)' }, 'Zeitplan'), sched.el,
      el('label', { style: 'display:block;margin-top:8px;color:var(--muted)' }, 'Zeitgrenze (min)'), timeoutIn,
      el('div', { style: 'display:flex;justify-content:flex-end;gap:8px;margin-top:14px' }, el('button', { onclick: () => box.remove() }, 'Abbrechen'), el('button', { class: 'primary', onclick: save }, '💾 Speichern')))
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
