// Plugin tasker (Taloan, 19.09.2026): Jobs — laufen im Server, nicht im Browser; regelmässig (cron) oder von Hand;
// hier verwalten, überwachen, Logs lesen. Ein Job = ein Prozess-Plugin (process im Manifest) mit Parametern.
// API: /api/jobs (JobApi.cs), Läufe und Ausgang im Journal (job:<key>), Log als Datei beim Server.
function el(tag, attrs = {}, ...kids) { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v) } for (const k of kids) e.append(k); return e }
const when = iso => iso ? new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
const STATUS = { ok: ['✓', 'pos'], failed: ['✗', 'neg'], timeout: ['⏱✗', 'neg'], cancelled: ['⊘', 'muted'] }
const PRESETS = [['', 'nur von Hand'], ['*/15 * * * *', 'alle 15 min'], ['0 * * * *', 'stündlich'], ['0 2 * * *', 'täglich 02:00'], ['30 6 * * 1-5', 'Mo–Fr 06:30'], ['0 3 * * 0', 'sonntags 03:00'], ['0 4 1 * *', 'monatlich am 1. 04:00']]

async function mount(root, ctx) {
  const { api, store, tree, dialog } = ctx
  if (!tree.loaded) await tree.load()
  const st = { jobs: [], plugins: [], cur: null, detail: null, log: '', timer: null, edit: null }
  root.style.cssText = 'display:flex;flex-direction:column;height:100%;padding:0'
  const status = el('span', { class: 'muted' }); const say = m => status.textContent = m
  const list = el('div', { class: 'scroll', style: 'flex:0 0 auto;max-height:45%' })
  const detail = el('div', { class: 'scroll', style: 'flex:1;border-top:1px solid var(--line)' })
  root.append(el('div', { class: 'toolbar' }, el('h1', {}, '⏱ Jobs'), el('button', { class: 'primary', onclick: () => openEdit(null) }, '+ Job'), el('span', { class: 'grow' }), status), list, detail)

  async function load() {
    try { [st.jobs, st.plugins] = await Promise.all([api.get('/api/jobs'), api.get('/api/jobs/plugins')]) } catch (e) { say('✗ ' + e.message); return }
    drawList()
    if (st.cur) await loadDetail(st.cur)
    const running = st.jobs.filter(j => j.running).length
    say(`${st.jobs.length} Jobs · ${st.jobs.filter(j => j.enabled && j.schedule).length} geplant${running ? ` · ${running} laufen` : ''}`)
  }
  function drawList() {
    list.innerHTML = ''
    if (!st.jobs.length) { list.append(el('div', { class: 'empty' }, st.plugins.length ? 'Noch kein Job — „+ Job“ legt einen an (z. B. Sicherung jede Nacht).' : 'Kein Plugin mit Prozess installiert — Jobs brauchen eins (z. B. backup).')); return }
    const tbl = el('table', { class: 'grid', style: 'width:100%' })
    tbl.append(el('thead', {}, el('tr', {}, el('th', {}, ''), el('th', {}, 'Job'), el('th', {}, 'Plugin'), el('th', {}, 'Zeitplan'), el('th', {}, 'nächster Lauf'), el('th', {}, 'letzter Lauf'), el('th', {}, ''))))
    const tb = el('tbody')
    for (const j of st.jobs) {
      const [sym, cls] = j.running ? ['▶', 'warn'] : STATUS[j.last?.status] ?? ['·', 'muted']
      const tr = el('tr', { class: 'row' + (st.cur === j.key ? ' selected' : ''), style: 'cursor:default', onclick: () => { st.cur = j.key; drawList(); loadDetail(j.key) } },
        el('td', { class: cls, title: j.running ? 'läuft' : j.last?.status ?? 'noch nie gelaufen' }, sym),
        el('td', {}, el('b', {}, j.label), el('span', { class: 'mono muted', style: 'margin-left:6px;font-size:11px' }, j.key)),
        el('td', { class: 'muted' }, j.plugin),
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
    const isNew = !j
    const keyIn = el('input', { type: 'text', value: j?.key ?? '', placeholder: 'key (a-z, 0-9, _)', style: 'width:100%' }); if (!isNew) keyIn.disabled = true
    const labelIn = el('input', { type: 'text', value: j?.label ?? '', placeholder: 'Bezeichnung', style: 'width:100%' })
    const pluginSel = el('select', { style: 'width:100%' }, ...st.plugins.map(p => el('option', { value: p.key }, `${p.label?.de || p.key} — ${p.description ?? ''}`)))
    if (j) pluginSel.value = j.plugin
    const schedSel = el('select', { style: 'width:100%' }, ...PRESETS.map(([v, l]) => el('option', { value: v }, l)), el('option', { value: 'custom' }, 'eigener cron-Ausdruck …'))
    const schedIn = el('input', { type: 'text', value: j?.schedule ?? '', placeholder: 'm h tag monat wochentag — z. B. 0 2 * * *', style: 'width:100%;margin-top:4px' })
    const known = PRESETS.some(([v]) => v === (j?.schedule ?? '')); schedSel.value = known ? (j?.schedule ?? '') : 'custom'; schedIn.style.display = known ? 'none' : ''
    schedSel.addEventListener('change', () => { if (schedSel.value === 'custom') { schedIn.style.display = ''; schedIn.focus() } else { schedIn.style.display = 'none'; schedIn.value = schedSel.value } })
    const timeoutIn = el('input', { type: 'number', value: String(j?.timeoutMinutes ?? 60), min: '1', max: '1440', style: 'width:90px' })
    const paramsBox = el('div')
    const paramInputs = {}
    const drawParams = () => {
      paramsBox.innerHTML = ''
      const p = st.plugins.find(x => x.key === pluginSel.value); const defs = p?.params ?? []
      for (const d of defs) {
        const cur = j?.params?.[d.key] ?? d.default ?? ''
        let inp
        if (d.type === 'node') {
          inp = el('input', { type: 'search', value: cur, placeholder: '🔍 Knoten (leer = ' + (d.label.includes('leer') ? 'wie beschrieben' : 'keiner') + ')', style: 'width:100%' })
          const pick = el('div', { class: 'picker', style: 'display:none;max-height:160px' })
          inp.addEventListener('input', () => { const q = inp.value.trim().toLowerCase(); pick.innerHTML = ''; const hits = q && !q.startsWith('g-') && !q.startsWith('p-') ? tree.rows.filter(r => r.role !== 'variant' && r.label.toLowerCase().includes(q)).slice(0, 10) : []; for (const r of hits) pick.append(el('div', { class: 'pick', onmousedown: e => { e.preventDefault(); inp.value = r.id; inp.title = r.label; pick.style.display = 'none' } }, `${r.role === 'group' ? '▣' : '▦'} ${r.label}`, el('span', { class: 'mono muted', style: 'margin-left:auto;font-size:11px' }, r.id))); pick.style.display = hits.length ? 'block' : 'none' })
          paramsBox.append(el('label', { style: 'display:block;margin-top:8px;color:var(--muted)' }, d.label), inp, pick)
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
      const schedule = schedSel.value === 'custom' ? schedIn.value.trim() : schedSel.value
      try {
        await api.post(`/api/jobs/${key}`, { label: labelIn.value.trim() || key, plugin: pluginSel.value, params, schedule, enabled: j?.enabled ?? true, timeoutMinutes: Number(timeoutIn.value) || 60 }, 'PUT')
        store.toast(`Job „${labelIn.value || key}“ gespeichert`, 'ok'); box.remove(); st.cur = key; await load()
      } catch (e) { store.toast(e.message) }
    }
    dlg.append(el('div', { style: 'font-weight:600;font-size:14px' }, isNew ? '+ Job' : `✎ ${j.label}`),
      el('label', { style: 'display:block;margin-top:8px;color:var(--muted)' }, 'Key'), keyIn,
      el('label', { style: 'display:block;margin-top:8px;color:var(--muted)' }, 'Bezeichnung'), labelIn,
      el('label', { style: 'display:block;margin-top:8px;color:var(--muted)' }, 'Plugin (Prozess)'), pluginSel, paramsBox,
      el('label', { style: 'display:block;margin-top:8px;color:var(--muted)' }, 'Zeitplan'), schedSel, schedIn,
      el('label', { style: 'display:block;margin-top:8px;color:var(--muted)' }, 'Zeitgrenze (min)'), timeoutIn,
      el('div', { style: 'display:flex;justify-content:flex-end;gap:8px;margin-top:14px' }, el('button', { onclick: () => box.remove() }, 'Abbrechen'), el('button', { class: 'primary', onclick: save }, '💾 Speichern')))
    box.append(dlg); box.addEventListener('mousedown', e => { if (e.target === box) box.remove() })
    document.body.append(box); (isNew ? keyIn : labelIn).focus()
  }

  await load()
  const poll = setInterval(() => { if (st.jobs.some(j => j.running)) load() }, 5000)
  return () => { clearInterval(poll); clearTimeout(st.timer) }
}

export default {
  views: [{ path: 'jobs', label: 'Jobs', icon: '⏱', topic: 'jobs', mount }],
}
