// Basis-Plugin tasker: ⏱ Jobs — Grundfunktion der Gruppe Jobs und zugleich ihr Container: Prozess-Plugins
// (backup, export, json, ixp, datasheet) laufen hier als Job (requires: ["tasker"]). Jobs laufen im Server, nicht im Browser;
// regelmässig (cron) oder von Hand;
// hier verwalten, überwachen, Logs lesen. Ein Job = ein Prozess-Plugin (process im Manifest) mit Parametern.
// API: /api/jobs (JobApi.cs), Läufe und Ausgang im Journal (job:<key>), Log als Datei beim Server.
/// Braucht dieser Prozess zwingend ein Profil? Steht „leer“ im Namen des Feldes („Profil — … (leer = Werte unten)“),
/// geht es auch ohne: dann stehen die Werte im Job selbst. Sonst kann der Job ohne Profil nicht laufen
///.
const L = l => globalThis.journali?.L ? globalThis.journali.L(l) : (l?.de ?? Object.values(l ?? {})[0] ?? '')   // Bezeichnung in der Oberflächensprache
const t = (k, p) => globalThis.journali?.t ? globalThis.journali.t(k, p) : String(k).replace(/\{(\w+)\}/g, (m, i) => p?.[i] ?? m)   // Oberflächensprache: spät gebunden, im Test ohne Fenster ladbar
/// Was mit einem Job noch geht: wirkt sein Plugin nicht (nicht installiert, aus, oder nicht im Tarif), bleibt nur
/// das Entfernen — starten, anhalten, ein/aus und bearbeiten sind gesperrt. Der Server lehnt sie ohnehin ab; hier
/// sieht man es, bevor man klickt. `aktiv` ist plugins.active aus der Oberfläche.
/// Die Systemjobs (probe, embed, derive) als Zeilen für den Balken oben im Tasker (27.09.2026): je Plugin mit
/// system im Manifest eine Zeile, der Fortschritt aus seinem progress-Endpunkt (gelesen, offen, total), der Job dazu,
/// wenn es einen gibt. Ein Plugin mit mehreren Diensten steht einmal.
export function systemRows(plugins, jobs, progress = {}) {
  const seen = new Set(); const rows = []
  for (const p of plugins ?? []) {
    if (!p.system || seen.has(p.key)) continue
    seen.add(p.key)
    const pr = progress?.[p.key] ?? null
    const total = Number(pr?.total ?? 0), gelesen = Number(pr?.gelesen ?? 0), offen = Number(pr?.offen ?? 0)
    const label = (globalThis.journali?.L ? globalThis.journali.L(p.label) : null) || p.label?.de || (typeof p.label === 'string' ? p.label : '') || p.key
    // Der Füllstand zeigt, was abgearbeitet ist (total − offen): was kein bekanntes Format hat, ist auch erledigt.
    const erledigt = Math.max(gelesen, total - offen)
    rows.push({ plugin: p.key, label, progress: pr, ready: pr ? pr.ready !== false : null, total, gelesen: erledigt, offen, pct: pr && pr.ready !== false && total > 0 ? Math.round(erledigt / total * 100) : null, job: (jobs ?? []).find(j => j.plugin === p.key) ?? null })
  }
  return rows
}

/// Der Block der Systemjobs: je Zeile Name, Balken (Füllstand: erledigt von gesamt), die Zahlen, ▶ zum Nachholen.
/// Kein Job dazu ist kein Hindernis — der Server legt ihn beim ersten ▶ an.
/// Die Systemjobs stehen oben als Kacheln — Name, Zahl, Balken und ihre Knöpfe in einer Fläche (28.09.2026). Als
/// Zeilen füllten sie die Liste, in der die Jobs des Anwenders stehen; dort haben sie nichts zu suchen.
/// Je Kachel: was erledigt ist, was offen ist, und starten / anhalten / weiter — dieselben Knöpfe wie bei einem Job.
export function systemBlock(rows, onRun, aktionen = {}) {
  const box = el('div', { class: 'sysjobs' })
  box.append(el('div', { class: 'muted sys-kopf', title: t('Systemjobs laufen in jedem Tarif. Eingeschaltet holen sie von selbst auf, was offen ist — ohne Zeitplan und ohne Knopfdruck.') }, t('⚙ Systemjobs')))
  const grid = el('div', { class: 'sys-grid' })
  for (const r of rows) {
    const j = r.job
    const laeuft = !!j?.running
    const zahl = r.ready === false ? el('span', { class: 'neg zahl', title: r.progress?.reason ?? r.progress?.pluginReason ?? '' }, t('nicht bereit'))
      : r.progress ? el('span', { class: 'mono zahl' }, `${r.gelesen.toLocaleString('de-DE')} / ${r.total.toLocaleString('de-DE')}`)
      : el('span', { class: 'muted zahl' }, '⋯')
    const offen = r.progress && r.ready !== false && r.offen
      ? el('span', { class: 'muted offen' }, t('{0} offen', [r.offen.toLocaleString('de-DE')]))
      : el('span', { class: 'muted offen' }, r.ready === false ? '' : r.progress ? t('nichts offen') : '')
    const bar = el('div', { class: 'sysbar' }, el('div', { class: 'fill', style: `width:${r.pct ?? 0}%` }))
    // Läuft er von selbst? Eingeschaltet wird ein Systemjob vom Server angestossen — nach dem Hochladen und solange
    // etwas offen ist, bis nichts mehr offen ist. Ausgeschaltet wartet er auf ▶ (28.09.2026).
    const schalter = j
      ? el('button', { class: 'x ' + (j.enabled ? 'pos' : 'muted'), title: j.enabled ? t('holt auf, was offen ist — ausschalten') : t('läuft nur auf Knopfdruck — einschalten'), onclick: ev => { ev.stopPropagation(); aktionen.toggle?.(j, ev) } }, j.enabled ? '●' : '○')
      : el('span', { class: 'x leer' })
    const knoepfe = el('div', { class: 'tun' },
      schalter,
      laeuft && j?.paused ? el('button', { class: 'x', title: t('weiter'), onclick: ev => { ev.stopPropagation(); aktionen.resume?.(j, ev) } }, '▶')
        : laeuft ? el('button', { class: 'x', title: t('anhalten (wartet beim nächsten Stapel)'), onclick: ev => { ev.stopPropagation(); aktionen.pause?.(j, ev) } }, '⏸')
        : el('button', { class: 'x', title: t('jetzt nachholen'), disabled: r.ready === false, onclick: ev => { ev.stopPropagation(); onRun?.(r.plugin, ev) } }, '▶'),
      laeuft ? el('button', { class: 'x', title: t('anhalten bis zum nächsten Start — die offenen Posten bleiben offen'), onclick: ev => { ev.stopPropagation(); aktionen.cancel?.(j, ev) } }, '⊘') : el('span', { class: 'x leer' }),
      j ? el('button', { class: 'x', title: t('Lauf und Protokoll ansehen'), onclick: ev => { ev.stopPropagation(); aktionen.open?.(j, ev) } }, '☰') : el('span', { class: 'x leer' }))
    grid.append(el('div', { class: 'sys-kachel' + (laeuft ? ' laeuft' : ''), 'data-plugin': r.plugin },
      el('div', { class: 'kopf' }, el('b', {}, r.label), el('span', { class: 'mono muted' }, r.plugin)),
      bar,
      el('div', { class: 'fuss' }, zahl, offen, el('span', { class: 'grow' }), knoepfe)))
  }
  box.append(grid)
  return box
}

/// Abbrechen heisst bei einem Systemjob nur anhalten (27.09.2026): die offenen Posten stehen im Journal und im Index,
/// der nächste Start findet dieselben. Der Knopf bleibt, der Text sagt, was er tut.
export function abbruchText(job, plugins) {
  const system = (plugins ?? []).some(p => p.key === job?.plugin && p.system)
  return system
    ? { title: t('anhalten bis zum nächsten Start — die offenen Posten bleiben offen'), toast: t('⊘ {0} angehalten — die offenen Posten bleiben offen', [job?.label ?? '']) }
    : { title: t('abbrechen'), toast: t('⊘ {0} abgebrochen', [job?.label ?? '']) }
}

export function jobGesperrt(job, aktiv) {
  return !(typeof aktiv === 'function' ? aktiv(job?.plugin) : true)
}

export function profilPflicht(profileDef) {
  return !!profileDef && !/leer/.test(profileDef.label ?? '')
}

/// Nächste Seite des Assistenten in dieser Richtung, die etwas zeigt — oder null, wenn keine mehr kommt.
/// `voll` sagt je Seite, ob sie Inhalt hat: ohne Fächer gibt es keine Ablage, ohne Parameter kein „Womit“
///.
/// Was in der Liste steht, solange kein Job da ist: erst der Hinweis, dass geholt wird — vorher stand das Fenster leer
/// da und sah aus, als gäbe es nichts zu tun (27.09.2026 gemeldet: „ich fühle mich genötigt, auf + Job zu klicken,
/// obwohl ich nur warten muss“). Danach der Grund: kein Prozess-Plugin, kein Job zum Filter, gar kein Job.
export function leerText(st) {
  if (!st.geladen) return 'laedt'
  if (st.plugin) return 'kein-job-fuer-plugin'
  return st.plugins.length ? 'kein-job' : 'kein-prozess-plugin'
}

/// Die Bühne auf diese Seite stellen — und zwar nur, wenn dort eine andere steht. Sonst nimmt das Neueinhängen dem
/// Eingabefeld den Fokus, und beim Tippen sprang der Cursor nach jedem Buchstaben weg (27.09.2026 gemeldet): jedes
/// `input` im Dialog ruft die Prüfung, und die zeigt die Seite neu.
export function seiteZeigen(buehne, box) {
  if (buehne.firstChild === box) return false
  buehne.innerHTML = ''
  buehne.append(box)
  return true
}

export function naechsteSeite(voll, schritt, richtung) {
  for (let i = schritt + richtung; i >= 0 && i < voll.length; i += richtung) if (voll[i]) return i
  return null
}

/// Gehört dieser Parameter in den Job-Dialog? Das sagt das Plugin selbst, im Manifest, mit `"perJob"` am Parameter:
/// `true` = am Job einzustellen (steht immer da), `false` = gehört ins Profil (steht nur da, solange kein Profil
/// gewählt ist — dann gibt es keine andere Quelle). Der Tasker fragt, er rät nicht.
/// Sagt ein Manifest nichts, steht der Parameter da: der Tasker versteckt nichts, was er nicht versteht — ein
/// verborgenes Pflichtfeld, das niemand setzen kann, wäre der schlimmere Fehler.
export function stelle(def, profilGewaehlt) {
  return def.perJob === false && profilGewaehlt ? 'aus' : 'oben'
}

/// Welche Fächer ein Job benutzt: liest er Dateien, gibt es in/, done/ und failed/; schreibt er, gibt es out/.
///
/// Welche Fächer an einem Zugang liegen können (28.09.2026): der Eingang, wenn der Job Dateien frisst, die Ausgabe,
/// wenn er schreibt — jeweils nur, solange der Tasker das Fach führt (der Parameter leer bleibt).
export function fachZugaenge(files, params = {}) {
  return { in: nutztFach(files?.in, params), out: nutztFach(files?.out, params) }
}

export function fachNames(files, params = {}) {
  const out = []
  if (nutztFach(files?.in, params)) out.push('in/', 'done/', 'failed/')
  if (nutztFach(files?.out, params)) out.push('out/')
  return out
}

/// Benutzt der Job dieses Fach? Nur, wenn er den Parameter leer lässt — sonst liest oder schreibt er selbst, und der
/// Tasker sieht die Dateien nie (JobFach.cs: er füllt den Parameter nur, wenn der Job ihn leer lässt).
export function nutztFach(spec, params = {}) {
  if (!spec) return false
  const p = spec.param
  return !p || !String(params[p] ?? '').trim()
}

function el(tag, attrs = {}, ...kids) { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else if (v === false || v == null) continue; else e.setAttribute(k, v) } for (const k of kids) e.append(k); return e }
const when = iso => iso ? new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
const STATUS = { ok: ['✓', 'pos'], warn: ['⚠', 'warn'], failed: ['✗', 'neg'], timeout: ['⏱✗', 'neg'], cancelled: ['⊘', 'muted'] }
// Zeitplan-Assistent. Intern ist es immer cron: fünf Felder, dazu ein sechstes dN:Datum / wN:Datum für „alle N Tage/Wochen ab“
// (JobRunner.cs, Cron). Tag und Wochentag gelten zusammen: „15-21 * 0“ = 3. Sonntag im Monat.
const DAYS = [['1', 'Mo'], ['2', 'Di'], ['3', 'Mi'], ['4', 'Do'], ['5', 'Fr'], ['6', 'Sa'], ['0', 'So']]
const NTH = [['*', 'jeden'], ['1-7', '1.'], ['8-14', '2.'], ['15-21', '3.'], ['22-28', '4.']]
const MODES = [['manual', t('nur von Hand')], ['minutes', 'alle … Minuten'], ['hourly', t('stündlich')], ['daily', t('täglich')], ['weekly', t('wöchentlich')], ['monthly', 'monatlich'], ['cron', 'cron-Ausdruck']]
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
/// Baut den Assistenten; onChange(cron) bei jeder Änderung; value() = aktueller Ausdruck.
/// Ohne den Tarif für Zeitpläne steht nur „nur von Hand" zur Wahl — der Server nähme einen Zeitplan ohnehin nicht an.
function scheduleAssistant(initial, onChange, zeitplaene = true) {
  const f = zeitplaene ? fromCron(initial) : { ...fromCron(''), mode: 'manual' }
  const box = el('div', { class: 'sched' })
  const moden = zeitplaene ? MODES : MODES.filter(([v]) => v === 'manual')
  const modeSel = el('select', { style: 'width:100%', title: zeitplaene ? '' : t('Ein Zeitplan gehört zum Tarif Pro. Von Hand läuft der Job in jedem Tarif.') }, ...moden.map(([v, l]) => el('option', { value: v }, l))); modeSel.value = f.mode
  const num = (key, min, max, w = 56) => { const i = el('input', { type: 'number', value: String(f[key]), min: String(min), max: String(max), style: `width:${w}px` }); i.addEventListener('input', () => { f[key] = i.value; emit() }); return i }
  const time = () => el('span', { style: 'display:inline-flex;align-items:center;gap:4px' }, 'um ', num('hour', 0, 23), ':', num('minute', 0, 59))
  const cronIn = el('input', { type: 'text', value: f.cron, placeholder: t('m h tag monat wochentag [dN:datum | wN:datum]'), style: 'width:100%' }); cronIn.addEventListener('input', () => { f.cron = cronIn.value; emit() })
  const shown = el('div', { class: 'mono muted', style: 'font-size:11px;margin-top:4px' })
  const body = el('div', { style: 'margin-top:6px;display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;font-size:13px' })
  function draw() {
    body.innerHTML = ''
    switch (f.mode) {
      case 'minutes': body.append('alle ', num('every', 1, 59), ' ' + t('Minuten')); break
      case 'hourly': body.append('alle ', num('every', 1, 23), ' ' + t('Stunden, zur Minute') + ' ', num('minute', 0, 59)); break
      case 'daily': body.append('alle ', num('every', 1, 365), ' ' + t('Tage') + ' ', time()); break
      case 'weekly': {
        const nthSel = el('select', {}, ...NTH.map(([v, l]) => el('option', { value: v }, l))); nthSel.value = f.nth; nthSel.addEventListener('change', () => { f.nth = nthSel.value; draw(); emit() })
        body.append(nthSel)
        for (const [v, l] of DAYS) { const cb = el('input', { type: 'checkbox' }); cb.checked = f.days.has(v); cb.addEventListener('change', () => { cb.checked ? f.days.add(v) : f.days.delete(v); emit() }); body.append(el('label', { class: 'chip', style: 'cursor:pointer' }, cb, ' ' + l)) }
        if (f.nth === '*') body.append(el('span', {}, ', alle '), num('every', 1, 52), ' ' + t('Wochen') + ' ')
        else body.append(el('span', { class: 'muted' }, t('im Monat') + ' '))
        body.append(time()); break
      }
      case 'monthly': body.append('am ', num('dom', 1, 31), '. alle ', num('every', 1, 12), ' ' + t('Monate') + ' ', time()); break
      case 'cron': body.append(cronIn); break
    }
    emit(false)
  }
  function emit(fire = true) { const c = toCron(f); shown.textContent = c ? `cron: ${c}` : ''; if (fire) onChange(c) }
  modeSel.addEventListener('change', () => { f.mode = modeSel.value; if (f.mode === 'cron' && !f.cron) f.cron = toCron({ ...f, mode: 'daily', every: 1 }); cronIn.value = f.cron; draw(); emit() })
  box.append(modeSel, body, shown); draw()
  return { el: box, value: () => toCron(f) }
}
const PRESETS = [['', t('nur von Hand')], ['*/15 * * * *', 'alle 15 min'], ['0 * * * *', t('stündlich')], ['0 2 * * *', t('täglich 02:00')], ['30 6 * * 1-5', 'Mo–Fr 06:30'], ['0 3 * * 0', 'sonntags 03:00'], ['0 4 1 * *', t('monatlich am 1. 04:00')]]

async function mount(root, ctx) {
  const { api, store, tree, dialog } = ctx
  if (!tree.loaded) await tree.load()
  const st = { jobs: [], plugins: [], progress: {}, cur: null, detail: null, log: '', timer: null, edit: null, geladen: false, plugin: new URLSearchParams(location.search).get('plugin') || '' }   // plugin: Liste nur mit den Jobs dieses Plugins (aus „Jobs verwalten“)
  root.style.cssText = 'display:flex;flex-direction:column;height:100%;padding:0'
  const status = el('span', { class: 'muted' }); const say = m => status.textContent = m
  const list = el('div', { class: 'scroll', style: 'flex:0 0 auto;max-height:45%' })
  const detail = el('div', { class: 'scroll', style: 'flex:1;border-top:1px solid var(--line)' })
  const filterChip = el('span', { class: 'chip', title: t('nur Jobs dieses Plugins — × zeigt alle'), style: 'cursor:default' })
  const drawFilter = () => { filterChip.innerHTML = ''; filterChip.style.display = st.plugin ? '' : 'none'; if (st.plugin) filterChip.append(t('Plugin {0}', [st.plugin]) + ' ', el('button', { onclick: () => { st.plugin = ''; drawFilter(); drawList() } }, '×')) }
  drawFilter()
  root.append(el('div', { class: 'toolbar' }, el('h1', {}, t('⏱ Jobs')), el('button', { class: 'primary', onclick: () => openEdit(st.plugin ? { plugin: st.plugin, _new: true } : null) }, '+ Job'), filterChip, el('span', { class: 'grow' }), status), list, detail)

  async function load() {
    try { [st.jobs, st.plugins] = await Promise.all([api.get('/api/jobs'), api.get('/api/jobs/plugins')]) } catch (e) { say('✗ ' + e.message); return }
    st.geladen = true
    drawList()
    if (st.cur) await loadDetail(st.cur)
    const running = st.jobs.filter(j => j.running).length
    say(`${st.jobs.length} Jobs · ${st.jobs.filter(j => j.enabled && j.schedule).length} geplant${running ? ` · ${running} laufen` : ''}`)
    // Der Stand der Systemjobs kommt nach: je Plugin sein progress-Endpunkt, und einer davon rechnet eine offene
    // Postenliste aus. Darauf wartet niemand mehr — die Liste steht schon, die Balken füllen sich, sobald es da ist.
    // Jede Kachel für sich: mit Promise.all hielt die langsamste alle anderen auf, und vier Kacheln standen
    // zehn Sekunden auf „…“, obwohl drei längst da waren (28.09.2026)
    const sys = [...new Map(st.plugins.filter(p => p.system && p.progress).map(p => [p.key, p.progress])).entries()]
    for (const [key, url] of sys)
      api.get(url).catch(e => ({ ready: false, reason: e.message }))
        .then(wert => { st.progress = { ...st.progress, [key]: wert }; drawList() })
  }
  async function runSystem(plugin) {
    try { await api.post(`/api/jobs/system/${encodeURIComponent(plugin)}/run`); store.toast(t('▶ {0} holt nach', [plugin]), 'ok'); await load(); watch() } catch (e) { store.toast(e.message) }
  }
  function drawList() {
    list.innerHTML = ''
    const sys = systemRows(st.plugins, st.jobs, st.progress).filter(r => !st.plugin || r.plugin === st.plugin)
    if (sys.length) list.append(systemBlock(sys, (plugin, ev) => tut(ev, () => runSystem(plugin)), {
      pause: (j, ev) => tut(ev, () => pause(j)),
      resume: (j, ev) => tut(ev, () => resume(j)),
      cancel: (j, ev) => tut(ev, () => cancel(j)),
      toggle: (j, ev) => tut(ev, () => toggle(j)),
      open: j => { st.cur = j.key; drawList(); loadDetail(j.key) },
    }))
    // Die Systemjobs stehen oben in ihren Kacheln — in der Liste darunter stehen die Jobs des Anwenders
    const eigene = st.jobs.filter(j => !sys.some(r => r.plugin === j.plugin))
    const jobs = st.plugin ? eigene.filter(j => j.plugin === st.plugin) : eigene
    if (!jobs.length) {
      const was = leerText(st)
      list.append(el('div', { class: 'empty' },
        was === 'laedt' ? t('⋯ Jobs werden geholt')
        : was === 'kein-job-fuer-plugin' ? t('Noch kein Job mit Plugin {0} — „+ Job“ legt einen an.', [st.plugin])
        : was === 'kein-job' ? t('Noch kein Job — „+ Job“ legt einen an.')
        : t('Kein Plugin mit Prozess installiert — Jobs brauchen eins.')))
      return
    }
    const tbl = el('table', { class: 'grid', style: 'width:100%' })
    tbl.append(el('thead', {}, el('tr', {}, el('th', {}, ''), el('th', {}, 'Job'), el('th', {}, t('Plugin')), el('th', {}, t('Zeitplan')), el('th', {}, t('nächster Lauf')), el('th', {}, t('letzter Lauf')), el('th', {}, ''))))
    const tb = el('tbody')
    for (const j of jobs) {
      const [sym, cls] = j.running && j.paused ? ['⏸', 'warn'] : j.running ? ['▶', 'warn'] : STATUS[j.last?.status] ?? ['·', 'muted']
      const tr = el('tr', { class: 'row' + (st.cur === j.key ? ' selected' : ''), style: 'cursor:default', onclick: () => { st.cur = j.key; drawList(); loadDetail(j.key) } },
        el('td', { class: cls, title: j.running ? t('läuft') : j.last?.status ?? t('noch nie gelaufen') }, sym),
        el('td', {}, el('b', {}, j.label), el('span', { class: 'mono muted', style: 'margin-left:6px;font-size:11px' }, j.key)),
        el('td', { class: zu(j) ? 'warn' : 'muted', title: zu(j) ? grund(j) : '' }, j.plugin + (j.service ? '/' + j.service : '') + (zu(j) ? ' ◇' : '')),
        el('td', { title: j.schedule && store.tarif?.schedules === false ? t('Ein Zeitplan gehört zum Tarif Pro. Von Hand läuft der Job in jedem Tarif.') : j.schedule ?? '' },
          !j.enabled ? el('span', { class: 'muted' }, '○ aus')
            : j.schedule && store.tarif?.schedules === false ? el('span', { class: 'warn' }, j.scheduleText + ' ◇')
            : j.scheduleText),
        el('td', { class: 'muted' }, j.nextDue ? when(j.nextDue) : ''),
        el('td', { class: 'muted', title: j.last?.summary ?? '' }, j.last ? `${when(j.last.startedAt)} · ${j.last.seconds}s` : ''),
        // Fünf feste Plätze: starten/anhalten, abbrechen, an/aus, bearbeiten, entfernen. Fehlt einer, bleibt sein Platz
        // leer — sonst rücken die Symbole je Zustand hin und her (27.09.2026: „krumm und schief angeordnet“).
        el('td', { class: 'tun' },
          // Wirkt das Plugin nicht, bleibt nur 🗑 — der Server lehnt den Rest ohnehin ab
          zu(j) ? el('button', { class: 'x', title: grund(j), disabled: true }, '▶')
            : j.running && j.paused ? el('button', { class: 'x', title: `wartet (${j.pauseReason ?? 'von Hand'}) — weiter`, onclick: ev => { ev.stopPropagation(); tut(ev, () => resume(j)) } }, '▶')
            : j.running ? el('button', { class: 'x', title: t('anhalten (wartet beim nächsten Stapel)'), onclick: ev => { ev.stopPropagation(); tut(ev, () => pause(j)) } }, '⏸')
            : el('button', { class: 'x', title: t('jetzt starten'), onclick: ev => { ev.stopPropagation(); tut(ev, () => run(j)) } }, '▶'),
          j.running && !zu(j) ? el('button', { class: 'x', title: abbruchText(j, st.plugins).title, onclick: ev => { ev.stopPropagation(); tut(ev, () => cancel(j)) } }, '⊘') : el('span', { class: 'x leer' }),
          el('button', { class: 'x', title: zu(j) ? grund(j) : j.enabled ? t('ausschalten (Zeitplan ruht)') : 'einschalten', disabled: zu(j), onclick: ev => { ev.stopPropagation(); if (!zu(j)) tut(ev, () => toggle(j)) } }, j.enabled ? '●' : '○'),
          el('button', { class: 'x', title: zu(j) ? grund(j) : 'bearbeiten', disabled: zu(j), onclick: ev => { ev.stopPropagation(); if (!zu(j)) openEdit(j) } }, '✎'),
          el('button', { class: 'x', title: t('Job entfernen (Läufe bleiben im Journal)'), onclick: ev => { ev.stopPropagation(); remove(j) } }, '🗑')))
      tb.append(tr)
    }
    tbl.append(tb); list.append(tbl)
  }
  /// gesperrt, weil sein Plugin nicht wirkt — und warum: der Tarif enthält es nicht, oder es ist nicht aktiviert
  const zu = j => jobGesperrt(j, ctx.plugins?.active?.bind(ctx.plugins))
  const grund = j => (ctx.plugins?.list ?? []).find(p => p.key === j.plugin)?.allowed === false
    ? t('Dieses Plugin ist in deinem Tarif nicht verfügbar. Du kannst den Job löschen, aber nicht ausführen.')
    : t('Dieses Plugin ist nicht aktiviert. Du kannst den Job löschen, aber nicht ausführen.')
  // Ein Klick sagt sofort, dass er angekommen ist: der Knopf wird blind und trägt ⋯, bis die Antwort da ist. Ohne das
  // sah ein langsamer Server aus wie ein toter Knopf, und es wurde mehrfach geklickt (27.09.2026 gemeldet).
  async function tut(ev, f) {
    const b = ev?.currentTarget
    const alt = b?.textContent
    if (b) { b.disabled = true; b.textContent = '⋯' }
    try { await f() } finally { if (b) { b.disabled = false; b.textContent = alt } }
  }
  async function run(j) { try { await api.post(`/api/jobs/${j.key}/run`); store.toast(`▶ ${j.label} gestartet`, 'ok'); st.cur = j.key; await load(); watch() } catch (e) { store.toast(e.message) } }
  async function cancel(j) { try { await api.post(`/api/jobs/${j.key}/cancel`); store.toast(abbruchText(j, st.plugins).toast); await load() } catch (e) { store.toast(e.message) } }
  // Anhalten und weiter: der Lauf wartet beim nächsten Stapel, statt zu sterben
  async function pause(j) { try { await api.post(`/api/jobs/${j.key}/pause`); store.toast(t('⏸ {0} hält beim nächsten Stapel an', [j.label])); await load() } catch (e) { store.toast(e.message) } }
  async function resume(j) { try { await api.post(`/api/jobs/${j.key}/resume`); store.toast(t('▶ {0} läuft weiter', [j.label]), 'ok'); await load() } catch (e) { store.toast(e.message) } }
  async function toggle(j) { try { await api.post(`/api/jobs/${j.key}`, { enabled: !j.enabled }, 'PUT'); await load() } catch (e) { store.toast(e.message) } }
  async function remove(j) { if (!await dialog.confirm({ title: `Job „${j.label}“ entfernen?`, ok: t('🗑 Entfernen'), danger: true })) return; try { await api.del(`/api/jobs/${j.key}`); if (st.cur === j.key) { st.cur = null; detail.innerHTML = '' } await load() } catch (e) { store.toast(e.message) } }

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
    try { const r = await fetch(`${store.server}/api/jobs/${key}/runs/${run}/log?tail=400`); logBox.textContent = (await r.text()) || t('(noch keine Ausgabe)'); logBox.scrollTop = logBox.scrollHeight } catch { logBox.textContent = '' }
    for (const b of detail.querySelectorAll('.runrow')) b.classList.toggle('selected', b.dataset.run === run)
  }
  function drawDetail() {
    detail.innerHTML = ''
    const d = st.detail; if (!d) return
    const head = el('div', { class: 'toolbar', style: 'gap:10px' }, el('b', {}, d.label), el('span', { class: 'muted' }, t('{0} · {1} · Zeitgrenze {2} min{3}', [d.plugin, d.scheduleText, d.timeoutMinutes, d.role ? ' ' + t('· Rolle') + ' ' + d.role : ''])),
      // Nur, was das Plugin heute kennt: ein Parameter, den das Manifest nicht mehr nennt, steht als Altlast im
      // Job-Eintrag und wirkt nicht mehr — in der Kopfzeile sieht er aus, als täte er etwas (28.09.2026)
      el('span', { class: 'muted mono', style: 'font-size:11px' }, (() => {
        const kennt = new Set((st.plugins.find(p => p.key === d.plugin && (p.service ?? '') === (d.service ?? ''))?.params ?? []).map(x => x.key))
        return Object.entries(d.params).filter(([k]) => !kennt.size || kennt.has(k)).map(([k, v]) => `${k}=${v}`).join(' ')
      })()), d.secrets.length ? el('span', { class: 'chip', title: t('Geheimnisse liegen beim Server (jobs/secrets.json), nicht im Journal') }, `🔒 ${d.secrets.join(', ')}`) : '')
    const runs = el('div', { style: 'width:340px;border-right:1px solid var(--line);overflow:auto' })
    const tbl = el('table', { class: 'grid', style: 'width:100%' })
    for (const r of d.runs) {
      const [sym, cls] = r.status ? STATUS[r.status] ?? ['?', 'muted'] : ['▶', 'warn']
      tbl.append(el('tr', { class: 'row runrow' + (r.id === logRun ? ' selected' : ''), 'data-run': r.id, style: 'cursor:default', onclick: () => loadLog(d.key, r.id), title: r.summary ?? '' },
        el('td', { class: cls }, sym), el('td', { class: 'muted' }, when(r.startedAt)), el('td', { class: 'muted' }, r.trigger === 'schedule' ? '⏱' : '👤'), el('td', { class: 'muted' }, r.seconds != null ? r.seconds + 's' : '…'), el('td', { class: 'muted', style: 'max-width:140px;overflow:hidden;text-overflow:ellipsis' }, r.summary ?? '')))
    }
    if (!d.runs.length) tbl.append(el('tr', {}, el('td', { class: 'muted', style: 'padding:8px' }, t('noch kein Lauf — ▶ startet einen'))))
    runs.append(tbl)
    // Fächer: Eingang wartend, verarbeitet (✓ ✗, Duplikat grau), Ausgaben (★ latest) — aus /api/jobs/<key>/files
    const files = el('div', { style: 'border-top:1px solid var(--line);padding:6px 8px;font-size:12px;max-height:40%;overflow:auto;display:none' })
    if (d.files || d.waiting || d.consumed || d.written) {
      files.style.display = ''
      api.get(`/api/jobs/${d.key}/files`).then(f => {
        if (!f.uses.in && !f.uses.out) { files.style.display = 'none'; return }
        const size = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(0) + ' KB' : (n / 1048576).toFixed(1) + ' MB'
        const col = (title, rows, empty) => el('div', { style: 'flex:1;min-width:200px' }, el('div', { style: 'font-weight:600;margin-bottom:2px' }, title), rows.length ? el('table', { class: 'grid', style: 'width:100%' }, ...rows) : el('div', { class: 'muted' }, empty))
        const cols = []
        if (f.uses.in) {
          cols.push(col(`Eingang · ${f.waiting.length} wartend`, f.waiting.map(w => el('tr', { class: 'row', title: `${w.name} · ${size(w.bytes)} · ${when(w.at)}` }, el('td', {}, w.name), el('td', { class: 'muted', style: 'text-align:right' }, size(w.bytes)))), t('nichts in in/ — ▶ läuft dann nicht')),
            col(t('Verarbeitet · {0}', [f.consumed.length]), f.consumed.map(c => el('tr', { class: 'row' + (c.status === 'duplicate' ? ' muted' : ''), style: c.run ? 'cursor:pointer' : '', title: `${c.name} · ${size(c.bytes)} · ${when(c.at)} · ${c.status}${c.run ? ' · Lauf ' + c.run : ' · ohne Lauf'}${c.mediaId ? ' · archiviert ' + c.mediaId : ''}\nSHA-256 ${c.hash}`, onclick: () => { if (c.run) loadLog(d.key, c.run) } },
              el('td', { class: c.status === 'ok' ? 'pos' : c.status === 'failed' ? 'neg' : 'muted', style: 'width:18px' }, c.status === 'ok' ? '✓' : c.status === 'failed' ? '✗' : '≡'), el('td', {}, c.name), el('td', { class: 'muted', style: 'text-align:right;white-space:nowrap' }, when(c.at)))), t('noch nichts verarbeitet')))
        }
        if (f.uses.out) cols.push(col(t('Ausgaben · {0}{1}', [f.written.length, f.latest.length ? ' · ★ ' + f.latest.join(', ') : '']), f.written.map(o => el('tr', { class: 'row', style: 'cursor:pointer', title: `${o.name} · ${size(o.bytes)} · ${when(o.at)} · Lauf ${o.run}${o.latest ? ' · auch als latest' : ''}${o.mediaId ? ' · archiviert ' + o.mediaId : ''}\nSHA-256 ${o.hash}`, onclick: () => loadLog(d.key, o.run) },
          el('td', { style: 'width:18px' }, o.latest ? '★' : '·'), el('td', {}, o.name), el('td', { class: 'muted', style: 'text-align:right;white-space:nowrap' }, `${size(o.bytes)} · ${when(o.at)}`))), t('noch keine Ausgabe')))
        files.append(el('div', { class: 'muted', style: 'margin-bottom:4px' }, `📁 ${f.base}`, f.files?.keep ? ' ' + t('· Aufbewahrung {0}', [f.files.keep]) : ' · Aufbewahrung: alle', f.files?.latest ? ' · latest' : '', f.files?.archive ? ' ' + t('· Archiv') : ''), el('div', { style: 'display:flex;gap:16px;flex-wrap:wrap' }, ...cols))
      }).catch(() => { files.style.display = 'none' })
    }
    detail.append(head, el('div', { style: 'display:flex;flex:1;min-height:0' }, runs, logBox), files)
    detail.style.display = 'flex'; detail.style.flexDirection = 'column'
  }

  // ---- Anlegen / Bearbeiten: Plugin, Parameter aus dem Manifest, Zeitplan, Zeitgrenze
  async function openEdit(j) {
    const box = el('div', { class: 'overlay', style: 'position:fixed;inset:0;background:rgba(0,0,0,.45);display:grid;place-items:center;z-index:40' })
    const dlg = el('div', { style: 'width:560px;background:var(--pane);border:1px solid var(--line);border-radius:8px;padding:14px 16px;font-size:13px' })
    let preset = null
    if (j?._new) { preset = j.plugin + '|' + (j.service ?? ''); j = null }   // aus ⬡ Plugins: neuer Job mit diesem Plugin (und Dienst)
    const isNew = !j
    const keyIn = el('input', { type: 'text', value: j?.key ?? '', placeholder: 'key (a-z, 0-9, _)', style: 'width:100%' }); if (!isNew) keyIn.disabled = true
    const labelIn = el('input', { type: 'text', value: j?.label ?? '', placeholder: t('Bezeichnung'), style: 'width:100%' })
    // ein Eintrag je Dienst; Wert = plugin|service
    const svcId = p => `${p.key}|${p.service ?? ''}`
    const svcLabel = p => (typeof p.label === 'string' ? p.label : L(p.label)) || p.key
    const pluginSel = el('select', { style: 'width:100%' },
      ...[...st.plugins].sort((a, b) => svcLabel(a).localeCompare(svcLabel(b), 'de'))
        .map(p => el('option', { value: svcId(p), title: p.description ?? '' }, svcLabel(p))))   // nur der Name
    const pluginHint = el('div', { class: 'muted', style: 'font-size:12px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' })
    if (j) pluginSel.value = `${j.plugin}|${j.service ?? ''}`
    else if (preset) { pluginSel.value = preset; if (pluginSel.value !== preset) pluginSel.value = st.plugins.find(p => svcId(p).startsWith(preset.split('|')[0] + '|')) ? svcId(st.plugins.find(p => svcId(p).startsWith(preset.split('|')[0] + '|'))) : pluginSel.value }
    const sched = scheduleAssistant(j?.schedule ?? '', () => {}, store.tarif?.schedules !== false)   // Zeitplan-Assistent statt Vorgaben-Liste
    const timeoutIn = el('input', { type: 'number', value: String(j?.timeoutMinutes ?? 60), min: '1', max: '1440', style: 'width:90px' })
    // Mit welcher Rolle der Lauf arbeitet: davon hängen seine Rechte ab (eine Sicherung braucht „Anwender und Rollen“).
    // Sichtbar nur für die Rollenverwaltung — sonst wäre ein Job ein Weg zu fremden Rechten.
    const darfRolle = store.can('users')
    const rolleSel = el('select', { style: 'width:180px', title: t('Rechte des Laufs; leer = editor') }, el('option', { value: '' }, '— editor —'))
    if (darfRolle) api.get('/api/auth/roles').then(rs => {
      for (const r of rs) rolleSel.append(el('option', { value: r.key }, r.label || r.key))
      rolleSel.value = j?.role ?? ''
    }).catch(() => {})
    // Fächer (docs/tasker-dateien.md): Basis, Aufbewahrung, latest, Archiv — nur bei Prozessen mit files im Manifest
    const fBase = el('input', { type: 'text', value: j?.files?.base ?? '', placeholder: t('leer = jobs/<key> beim Server'), style: 'flex:1' })
    const fachLabelEl = el('label', { style: 'display:block;margin-top:8px;color:var(--muted)' }, t('Fächer · Basis'))
    const fBaseBtn = el('button', { type: 'button', title: t('Basis der Fächer auf dem Server wählen'), onclick: () => ctx.filePicker({ value: fBase.value, dirOnly: true, title: t('📁 Basis der Fächer (in/, done/, failed/, out/)'), onPick: v => { fBase.value = v } }) }, '📁')
    const fKeep = el('input', { type: 'text', value: j?.files?.keep ?? '', placeholder: 'alle', style: 'width:90px', title: t('Aufbewahrung: 10 = die letzten 10 Läufe, 30d = 30 Tage, leer = alle') })
    const fLatest = el('input', { type: 'checkbox' }); fLatest.checked = j?.files?.latest ?? true
    const fArchive = el('input', { type: 'checkbox' }); fArchive.checked = j?.files?.archive ?? false
    // Fächer an einem Zugang (driver): der Eingang wird vor dem Lauf von dort geholt, die Ausgabe danach dort abgelegt
    const zugangsListe = api.get('/api/drivers?dateien=true').then(l => (l ?? []).filter(z => z.art !== 'file')).catch(() => [])
    const zugangZeile = (text, zugang, pfad, titel) => {
      const sel = el('select', { style: 'width:180px' }, el('option', { value: '' }, t('— nur das Fach —')))
      const pfadIn = el('input', { type: 'text', value: pfad ?? '', placeholder: t('Pfad im Zugang, z. B. /eingang'), style: 'flex:1' })
      const pick = el('button', { type: 'button', title: t('Verzeichnis im Zugang wählen'), onclick: () => { if (sel.value) ctx.filePicker({ value: pfadIn.value, dirOnly: true, zugang: sel.value, onPick: v => { pfadIn.value = v } }) } }, '📁')
      const stand = () => { pfadIn.disabled = !sel.value; pick.disabled = !sel.value }
      sel.addEventListener('change', stand)
      zugangsListe.then(l => { for (const z of l) sel.append(el('option', { value: z.key }, z.label || z.key)); if (zugang && !l.some(z => z.key === zugang)) sel.append(el('option', { value: zugang }, zugang)); sel.value = zugang ?? ''; stand() })
      stand()
      const row = el('div', { class: 'zugang-zeile', style: 'display:flex;gap:4px;align-items:center;margin-top:6px', title: titel }, el('span', { class: 'muted', style: 'width:110px' }, text), sel, pfadIn, pick)
      return { row, sel, pfadIn, wert: () => row.style.display === 'none' || !sel.value ? { zugang: null, pfad: null } : { zugang: sel.value, pfad: pfadIn.value.trim() || '/' } }
    }
    const fIn = zugangZeile(t('Eingang von'), j?.files?.inZugang, j?.files?.inPfad, t('Vor jedem Lauf holt der Tasker, was dort liegt und aufs Muster passt, nach in/ und schiebt es dort nach abgeholt/'))
    const fOut = zugangZeile(t('Ausgabe nach'), j?.files?.outZugang, j?.files?.outPfad, t('Nach jedem gelungenen Lauf legt der Tasker die Ausgaben dort ab'))
    const fachBox = el('div', { style: 'display:none' },
      fachLabelEl, el('div', { style: 'display:flex;gap:4px' }, fBase, fBaseBtn), fIn.row, fOut.row,
      el('div', { style: 'display:flex;gap:14px;align-items:center;margin-top:6px;flex-wrap:wrap' },
        el('label', { style: 'display:flex;gap:6px;align-items:center' }, el('span', { class: 'muted' }, t('Aufbewahrung')), fKeep),
        el('label', { style: 'display:flex;gap:6px;align-items:center', title: t('nach jedem Lauf eine Kopie unter festem Namen: <key>-latest') }, fLatest, 'latest'),
        el('label', { style: 'display:flex;gap:6px;align-items:center', title: t('Eingänge und Ausgaben zusätzlich als Medium im Medienspeicher ablegen') }, fArchive, t('Archiv im Medienspeicher'))))
    const paramsBox = el('div')
    const paramInputs = {}
    let skripte = []   // die Skripte des Plugins scriptum, sobald sie da sind (Parameter vom Typ script)
    let profilWert = j?.params?.profile ?? ''   // welches Profil gewählt ist; ohne Profil stehen seine Werte im Dialog
    const drawParams = () => {
      paramsBox.innerHTML = ''
      const p = st.plugins.find(x => svcId(x) === pluginSel.value); const defs = p?.params ?? []
      pluginHint.textContent = p?.description ?? ''; pluginHint.title = pluginHint.textContent
      // Mit Profil:
      // im Dialog stehen dann nur Profil, Dateien/Verzeichnisse und Schalter. Ohne gewähltes Profil sind seine Felder
      // die einzige Quelle und stehen hier
      const profileDef = defs.find(d => d.type === 'profile' || d.key === 'profile')
      const hasProfile = !!profileDef && !!profilWert
      let secretNote = null
      profileSecrets = []
      const noteSecret = (profileName) => { if (!secretNote || !p) return; if (!profileName) { secretNote.textContent = ''; profileSecrets = []; check(); return } api.get(`/api/plugins/${p.key}/secrets/${encodeURIComponent(profileName)}`).then(r => { profileSecrets = r.keys; secretNote.textContent = r.keys.length ? t('🔒 am Profil hinterlegt: {0}', [r.keys.join(', ')]) : t('🔒 am Profil nichts hinterlegt — in der Ansicht des Plugins (🔒) oder unten setzen'); check() }).catch(() => { secretNote.textContent = ''; profileSecrets = []; check() }) }
      for (const d of defs) {
        const cur = j?.params?.[d.key] ?? d.default ?? ''
        // sichtbar bleiben: Profil, Dateien/Verzeichnisse, Schalter; Baum-Ziel/-Quelle, Texte, Geheimnisse: aus dem Profil
        // was im Profil steht, wird im Profil gepflegt — hier erscheint es gar nicht
        if (stelle(d, hasProfile) === 'aus') continue
        const append = (...nodes) => paramsBox.append(...nodes)
        let inp
        if (d.type === 'node') {
          // Auswahlbaum: Wert ist die Knoten-Id, sichtbar der Name; „leer“ wählbar (⌂)
          inp = { value: cur }
          const shown = el('span', { class: 'muted' }, cur ? tree.byId.get(cur)?.label ?? cur : '(leer)')
          const box = el('div')
          ctx.treePicker(box, { value: cur || null, roles: ['group', 'product'], height: 180, allowRoot: true, onPick: r => { inp.value = r?.id ?? ''; shown.textContent = r ? r.label : '(leer)' } })
          append(el('label', { style: 'display:block;margin-top:8px;color:var(--muted)' }, d.label, ' · ', shown), box)
        } else if (d.type === 'pub') {
          // Publikationsbaum: Dropdown der Bäume, leer = keiner
          inp = el('select', {}, el('option', { value: '' }, t('(keiner — Teilbaum unten)')), ...(tree.pubTrees ?? []).map(r => el('option', { value: r.id }, `${r.label} · ${r.channel}${r.market ? '/' + r.market : ''}`)))
          inp.value = cur
          append(el('label', { style: 'display:block;margin-top:8px;color:var(--muted)' }, d.label), inp)
        } else if (d.type === 'driver') {
          // Zugang (driver): eine Auswahl der eingerichteten Zugänge dieser Art — Adresse und Anmeldung bekommt der
          // Prozess vom Server (JOURNALI_<PARAM>_<FELD>), das Geheimnis sieht der Dialog nie
          inp = el('select', { style: 'width:100%' }, el('option', { value: '' }, t('— kein Zugang —')))
          if (cur) { inp.append(el('option', { value: cur }, cur)); inp.value = cur }
          api.get('/api/drivers' + (d.art ? '?art=' + encodeURIComponent(d.art) : '')).then(l => {
            for (const z of l ?? []) { const da = [...inp.options].find(o => o.value === z.key); if (da) da.textContent = z.label || z.key; else inp.append(el('option', { value: z.key }, z.label || z.key)) }
            if (!(l ?? []).length && !cur) inp.title = t('noch kein Zugang dieser Art — unter ⌁ Zugänge anlegen')
          }).catch(() => {})
          append(el('label', { style: 'display:block;margin-top:8px;color:var(--muted)' }, d.label), inp)
        } else if (d.type === 'script') {
          // Skript (scriptum): eine Auswahl der Skripte. Das Formular steht im Skript — seine Parameter erscheinen
          // darunter und gehen als arg_<key> an den Lauf (29.09.2026)
          inp = el('select', { style: 'width:100%' }, el('option', { value: '' }, t('— kein Skript —')))
          if (cur) { inp.append(el('option', { value: cur }, cur)); inp.value = cur }
          const formular = el('div')
          api.get('/api/scriptum/scripts').then(l => {
            skripte = l ?? []
            for (const s of skripte) { const da = [...inp.options].find(o => o.value === s.key); if (da) da.textContent = s.label || s.key; else inp.append(el('option', { value: s.key }, s.label || s.key)) }
            if (!skripte.length && !cur) inp.title = t('noch kein Skript — unter ⌨ Skripte anlegen')
            inp.value = cur ?? ''
            zeichneSkript(formular)
          }).catch(() => {})
          inp.addEventListener('change', () => { zeichneSkript(formular); check() })
          append(el('label', { style: 'display:block;margin-top:8px;color:var(--muted)' }, d.label), inp, formular)
        } else if (d.type === 'path' || d.type === 'dir') {
          // Pfad auf dem Server: Textfeld plus 📁 — der Dateibrowser der Oberfläche (ctx.filePicker, /api/files)
          inp = el('input', { type: 'text', value: cur, placeholder: d.type === 'dir' ? t('Verzeichnis auf dem Server') : t('Datei, Verzeichnis oder URL'), style: 'flex:1' })
          const pick = el('button', { type: 'button', title: d.type === 'dir' ? t('Verzeichnis auf dem Server wählen') : t('Datei oder Verzeichnis auf dem Server wählen'), onclick: () => ctx.filePicker({ value: inp.value, dirOnly: d.type === 'dir', onPick: v => { inp.value = v } }) }, '📁')
          append(el('label', { style: 'display:block;margin-top:8px;color:var(--muted)' }, d.label), el('div', { style: 'display:flex;gap:4px' }, inp, pick))
        } else if (d.type === 'profile' || d.key === 'profile') {
          // Profil des Plugins: jeder Parameter profile
          // wird ein Dropdown der gespeicherten Profile. Angelegt werden sie in der Ansicht des Plugins, nicht hier:
          // 180 Spalten mit Umwandlungen richtet niemand in einem Job-Dialog ein (25.09.2026)
          inp = el('select', { style: 'width:100%' }, el('option', { value: '' }, /leer/.test(d.label) ? '(leer)' : t('— Profil —')))
          if (profilWert) inp.append(el('option', { value: profilWert }, profilWert)); inp.value = profilWert
          api.get(`/api/plugins/${p.key}/data`).then(all => {
            // Nur die Profile DIESES Dienstes: sie heissen <dienst>:<name> (import, export) im Plugin-Strom.
            // Aeltere liegen unter profile: oder config: ohne Dienst — die zeigt ein Plugin mit nur einem Dienst
            const dienst = (p.service ?? '').trim()
            const eigen = dienst ? new RegExp('^' + dienst + ':') : /^(profile|config):/
            const names = [...new Set(all.filter(x => eigen.test(x)).map(x => x.replace(eigen, '')))].sort((a, b) => a.localeCompare(b, 'de'))
            for (const n of names) if (n !== cur) inp.append(el('option', { value: n }, n))
            if (!names.length && !cur) inp.title = t('noch kein Profil gespeichert — in der Ansicht des Plugins anlegen')
          }).catch(() => {})
          inp.addEventListener('change', () => { profilWert = inp.value; noteSecret(inp.value); drawParams(); check(); zeige(schritt) })
          secretNote = el('div', { class: 'muted', style: 'font-size:12px;margin-top:2px' })
          // Profile legt die Ansicht des Plugins an, nie dieser Dialog — der generische Profil-Editor ist weg, seit das
          // letzte Plugin mit Profil (rag) eine eigene Ansicht hat (28.09.2026)
          paramsBox.append(el('label', { style: 'display:block;margin-top:8px;color:var(--muted)' }, d.label), inp, secretNote)
          if (cur) noteSecret(cur)
        } else if (d.type === 'boolean') {
          inp = el('input', { type: 'checkbox' }); inp.checked = String(cur) === 'true'
          Object.defineProperty(inp, 'value', { get() { return this.checked ? 'true' : 'false' }, configurable: true })
          paramsBox.append(el('label', { style: 'display:flex;gap:6px;align-items:center;margin-top:8px' }, inp, d.label))
        } else {
          inp = el('input', { type: d.secret ? 'password' : d.type === 'number' ? 'number' : 'text', value: d.secret ? '' : cur, placeholder: d.secret ? (j?.secrets?.includes(d.key) ? t('•••••• (gesetzt — leer lassen = behalten)') : hasProfile ? t('leer = am Profil hinterlegt') : t('geheim — bleibt beim Server')) : '', style: 'width:100%' })
          append(el('label', { style: 'display:block;margin-top:8px;color:var(--muted)' }, d.label + (d.secret ? ' 🔒' : '')), inp)
        }
        paramInputs[d.key] = inp
      }


      // nur die Fächer nennen, die dieses Plugin wirklich benutzt: wer nur schreibt, hat kein in/ und kein failed/
      aktualisiereFaecher()
      if (!defs.length) paramsBox.append(el('div', { class: 'muted', style: 'margin-top:8px' }, t('Dieses Plugin hat keine Parameter.')))
    }
    /// Das Formular des gewählten Skripts: je Parameter ein Feld, sein Wert steht am Job als arg_<key>. So bleibt das
    /// Formular im Skript und der Job-Dialog muss nichts davon wissen.
    function zeichneSkript(box) {
      box.innerHTML = ''
      for (const k of Object.keys(paramInputs)) if (k.startsWith('arg_')) delete paramInputs[k]
      const s = skripte.find(x => x.key === (paramInputs.script?.value ?? ''))
      if (!s) return
      if (!(s.params ?? []).length) { box.append(el('div', { class: 'muted', style: 'font-size:12px;margin-top:4px' }, t('Dieses Skript hat keine Parameter.'))); return }
      for (const p of s.params) {
        const wert = j?.params?.['arg_' + p.key] ?? p.default ?? ''
        const inp = el('input', { type: p.type === 'number' ? 'number' : 'text', value: String(wert), style: 'width:100%' })
        box.append(el('label', { style: 'display:block;margin-top:8px;color:var(--muted)' }, p.label || p.key), inp)
        paramInputs['arg_' + p.key] = inp
      }
    }

    // Speichern nur, wenn der Job laufen kann:
    // key, Profil (wenn der Prozess eines hat), Dateien/Verzeichnisse, Geheimnis (am Job oder am Profil hinterlegt)
    let profileSecrets = []
    let markieren = null   // wird gesetzt, sobald die Schrittleiste steht (weiter unten)
    /// Welche Fächer der Job wirklich benutzt — hängt davon ab, ob seine Pfad-Parameter leer sind
    function aktualisiereFaecher() {
      const p = st.plugins.find(x => svcId(x) === pluginSel.value)
      const werte = Object.fromEntries(Object.entries(paramInputs).map(([k, i]) => [k, i?.value ?? '']))
      const namen = p?.files ? fachNames(p.files, werte) : []
      fachBox.style.display = namen.length ? '' : 'none'
      const zg = fachZugaenge(p?.files, werte)
      fIn.row.style.display = zg.in ? '' : 'none'; fOut.row.style.display = zg.out ? '' : 'none'
      if (namen.length) {
        fachLabelEl.textContent = t('Fächer · Basis ({0})', [namen.join(', ')])
        fBaseBtn.title = t('Basis der Fächer auf dem Server wählen ({0})', [namen.join(', ')])
      }
    }
    let schritt = 0        // welche Seite gerade sichtbar ist — check() zeigt nur deren Meldungen
    const saveBtn = el('button', { class: 'primary', onclick: () => save() }, t('💾 Speichern'))
    const why = el('span', { class: 'neg', style: 'font-size:12px;align-self:center;flex:1' })
    function check() {
      const p = st.plugins.find(x => svcId(x) === pluginSel.value); const defs = p?.params ?? []
      const reasons = []   // { text, seite } — die Seite, auf der es zu beheben ist
      const fehlt = (text, seite) => reasons.push({ text, seite })
      if (isNew && !keyIn.value.trim()) fehlt(t('Key fehlt'), 0)
      const profileDef = defs.find(d => d.type === 'profile' || d.key === 'profile')
      const profile = paramInputs.profile?.value ?? ''
      // „(leer = Werte unten)“ im Feldnamen heisst: ohne Profil geht es auch, dann stehen die Werte im Job
      if (!profile && profilPflicht(profileDef)) fehlt(t('Profil fehlt — in der Ansicht des Plugins speichern'), 1)
      for (const d of defs) {
        const v = paramInputs[d.key]?.value ?? ''
        // mit Fächern kommt die Datei aus in/ bzw. geht nach out/ — dann ist der Parameter nicht Pflicht
        if ((d.type === 'path' || d.type === 'dir') && !v && !(d.type === 'dir' ? p?.files?.out : p?.files?.in)) fehlt(`${d.type === 'dir' ? 'Verzeichnis' : 'Quelle'} fehlt`, 1)
        if (d.secret && !v && !j?.secrets?.includes(d.key) && !profileSecrets.includes(d.key)) fehlt(t('{0} fehlt — am Profil hinterlegen (🔒)', [d.label.split(' —')[0]]), 1)
      }
      saveBtn.disabled = reasons.length > 0; saveBtn.title = reasons.map(r => r.text).join(' · ')
      // unten steht nur, was auf dieser Seite zu beheben ist; die anderen Seiten bekommen ein ✗ in der Leiste
      const hier = reasons.find(r => r.seite === schritt)
      why.textContent = hier ? '✗ ' + hier.text : ''
      markieren?.(reasons)
      return reasons.length === 0
    }
    pluginSel.addEventListener('change', () => { drawParams(); check(); zeige(schritt); kopfSetzen() }); drawParams(); check()
    const auffrischen = () => { aktualisiereFaecher(); zeige(schritt) }   // zeige() ruft check()
    dlg.addEventListener('input', auffrischen); dlg.addEventListener('change', auffrischen)
    const save = async () => {
      if (!check()) return
      const key = (isNew ? keyIn.value : j.key).trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
      if (!key) { store.toast(t('key fehlt')); return }
      const params = {}
      for (const [k, inp] of Object.entries(paramInputs)) if (inp.value !== '' || inp.type !== 'password') params[k] = inp.value
      const schedule = sched.value()
      const alt = saveBtn.textContent
      saveBtn.disabled = true; saveBtn.textContent = t('⋯ speichert')
      try {
        const fi = fIn.wert(), fo = fOut.wert()
        const files = fachBox.style.display === 'none' ? null : { base: fBase.value.trim() || null, keep: fKeep.value.trim() || null, latest: fLatest.checked, archive: fArchive.checked, inZugang: fi.zugang, inPfad: fi.pfad, outZugang: fo.zugang, outPfad: fo.pfad }
        await api.post(`/api/jobs/${key}`, { label: labelIn.value.trim() || key, plugin: pluginSel.value.split('|')[0], service: pluginSel.value.split('|')[1] || '', params, schedule, enabled: j?.enabled ?? true, timeoutMinutes: Number(timeoutIn.value) || 60, files, ...(darfRolle ? { role: rolleSel.value } : {}) }, 'PUT')
        store.toast(`Job „${labelIn.value || key}“ gespeichert`, 'ok'); box.remove(); st.cur = key; await load()
      } catch (e) { store.toast(e.message); saveBtn.disabled = false; saveBtn.textContent = alt }
    }
    // ---- Assistent: vier Schritte statt einer Seite, die über den Bildschirm hinauswächst ----
    const lab = text => el('label', { style: 'display:block;margin-top:8px;color:var(--muted)' }, text)
    const seiten = [
      { name: '① Was', box: el('div', {}, lab('Key'), keyIn, lab(t('Bezeichnung')), labelIn, lab('Plugin (Prozess)'), pluginSel, pluginHint) },
      { name: t('② Womit'), box: el('div', {}, paramsBox), leer: () => !paramsBox.childElementCount },
      { name: t('③ Ablage'), box: el('div', {}, fachBox), leer: () => fachBox.style.display === 'none' },
      { name: t('④ Wann'), box: el('div', {}, lab(t('Zeitplan')), sched.el, lab('Zeitgrenze (min)'), timeoutIn, ...(darfRolle ? [lab(t('Rolle des Laufs')), rolleSel] : [])) },
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
    const zurück = el('button', { type: 'button', title: t('zurück'), onclick: () => blättern(-1) }, '←')
    const vor = el('button', { type: 'button', title: 'weiter', onclick: () => blättern(1) }, '→')
    /// hat diese Seite etwas zu zeigen? (ohne Fächer keine Ablage, ohne Parameter kein Womit)
    const voll = i => !seiten[i].leer?.()
    function zeige(i) {
      if (!voll(i)) { const ersatz = naechsteSeite(seiten.map((_, n) => voll(n)), i, -1) ?? naechsteSeite(seiten.map((_, n) => voll(n)), i, 1); if (ersatz === null) return; i = ersatz }
      schritt = i
      seiteZeigen(bühne, seiten[i].box)
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
        zurück, vor, el('span', { style: 'flex:1' }), why, el('button', { onclick: () => box.remove() }, t('Abbrechen')), saveBtn))
    kopfSetzen(); zeige(0)
    box.append(dlg); box.addEventListener('mousedown', e => { if (e.target === box) box.remove() })
    document.body.append(box); (isNew ? keyIn : labelIn).focus()
  }

  drawList(); say(t('⋯'))   // sofort etwas zeigen: das Holen dauert, und ein leeres Fenster sieht aus wie „nichts da“
  await load()
  // aus ⬡ Plugins „Als Job einrichten”: ?new=<plugin> öffnet den Dialog mit diesem Plugin
  const q = new URLSearchParams(location.search); const wanted = q.get('new')
  if (wanted && st.plugins.some(p => p.key === wanted)) { history.replaceState(null, '', location.pathname); openEdit({ plugin: wanted, service: q.get('service') ?? '', _new: true }) }
  else if (st.plugin) history.replaceState(null, '', location.pathname)
  // Während ein Job läuft, alle fünf Sekunden; sonst alle fünfzehn. Mit einer Minute im Leerlauf sah man einen
  // Lauf von zehn Sekunden nie — er begann und endete zwischen zwei Abfragen, und die Kachel blieb still
  // (28.09.2026). Offene Posten allein sind weiter kein Grund: sie bleiben offen, bis der Nachzieher startet.
  let runde = 0
  const poll = setInterval(() => {
    runde++
    if (st.jobs.some(j => j.running) || runde % 3 === 0) load()
  }, 5000)
  return () => { clearInterval(poll); clearTimeout(st.timer) }
}

export default {
  views: [{ path: 'jobs', topic: 'jobs', label: t('Jobs'), icon: '⏱', hint: t('im Server, Zeitplan, Läufe, Logs'), mount }],
}
