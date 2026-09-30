// Plugin empco: Prüfregeln in ✓ Datenqualität — jede Regel des Katalogs (catalog.js, Richtlinie (EU) 2024/825)
// prüft Text- und HTML-Attribute je Sprache; Befund nennt Attribut, Begriff und den Anker in der Richtlinie. Ohne KI.
// Die Ansicht zeigt den Katalog mit Quellen und lässt einen Teilbaum durchsehen. Später (Workflow-Designer): Befunde
// werden Beanstandungen am Feld und schicken den Knoten in die Überarbeitung.
import catalog from './catalog.js'
const t_ = (k, p) => globalThis.journali?.t ? globalThis.journali.t(k, p) : String(k).replace(/\{(\w+)\}/g, (m, i) => p?.[i] ?? m)   // Oberflächensprache: spät gebunden, im Test ohne Fenster ladbar

function el(tag, attrs = {}, ...kids) { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'class') e.className = v; else e.setAttribute(k, v) } for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : String(c)); return e }
const strip = v => String(v ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const rx = rule => new RegExp(rule.pattern ?? '\\b(' + rule.terms.map(esc).join('|') + ')(e|es|er|en|em|s)?\\b', 'i')   // Flexion: umweltfreundlich(es), nachhaltig(er)
const SEV = { error: '✗', warn: '⚠', info: 'ℹ' }

/// Alle Regeln als Prüfregeln für die Datenqualität (Basis-Plugin da)
const checks = catalog.rules.map(rule => ({
  key: rule.id, label: `${catalog.icon} ${rule.label}`, severity: rule.severity,
  run({ values, columns }) {
    const r = rx(rule); const out = []
    for (const c of columns) {
      if (c.type !== 'text' && c.type !== 'html') continue
      const text = strip(values[c.key]?.value); if (!text) continue
      const m = text.match(r); if (!m) continue
      out.push({ attribute: c.key, message: `„${m[0]}“ — ${rule.hint} (${rule.ref})` })
    }
    return out
  },
}))

/// Ansicht: Katalog mit Quellen, Teilbaum prüfen (nur diese Regeln), Befunde je Knoten und Feld
async function mount(root, ctx) {
  const { api, store, tree } = ctx
  if (!tree.loaded) await tree.load()
  const st = { root: localStorage.getItem('journali.empco.root') || tree.rows.find(r => !r.parent)?.id, result: null }
  root.style.cssText = 'display:flex;flex-direction:column;height:100%;padding:0'
  const status = el('span', { class: 'muted' }); const say = m => status.textContent = m
  const ICON = { group: '▣', product: '▦', variant: '◆' }
  const rootBtn = el('button', { class: 'x' }, st.root ? `${ICON[tree.byId.get(st.root)?.role] ?? ''} ${tree.byId.get(st.root)?.label ?? ''}` : t_('Teilbaum wählen'))
  const pick = el('div', { class: 'picker', style: 'position:absolute;left:0;top:28px;z-index:5;width:380px;display:none;padding:6px;background:var(--pane)' })
  ctx.treePicker(pick, { value: st.root, roles: ['group', 'product'], height: 300, onPick: r => { st.root = r.id; rootBtn.textContent = `${ICON[r.role]} ${r.label}`; pick.style.display = 'none'; localStorage.setItem('journali.empco.root', r.id) } })
  rootBtn.addEventListener('click', () => { pick.style.display = pick.style.display === 'none' ? 'block' : 'none' })
  const body = el('div', { class: 'scroll', style: 'flex:1;padding:8px' })

  async function run() {
    if (!st.root) return
    const model = store.model; const locales = model.locales.map(l => l.code)
    const findings = []; let nodes = 0
    say(t_('lese {0} Sprachen …', [locales.length]))
    // Sprachen parallel holen: der Server rechnet je Anfrage nur einen Teilbaum, das Netz wartet nicht auf sich selbst.
    const tables = await Promise.all(locales.map(l => api.get(`/api/nodes/${encodeURIComponent(st.root)}/table?deep=true&locale=${l}`)))
    for (let i = 0; i < locales.length; i++) {
      const l = locales[i]; const t = tables[i]
      nodes = t.rows.length
      for (const r of t.rows) for (const c of checks) for (const f of c.run({ values: r.values, columns: t.columns.filter(x => !(r.inactive ?? []).includes(x.key)) })) findings.push({ ...f, rule: c.key, severity: c.severity, locale: l, node: r.row })
    }
    st.result = { findings, nodes }; say(t_('{0} Befunde in {1} Knoten', [findings.length, nodes])); draw()
  }
  function draw() {
    body.innerHTML = ''
    body.append(el('div', { class: 'section' }, el('h2', {}, t_('{0} Kriterienkatalog', [catalog.icon]) + ' ', el('span', { class: 'muted' }, t_('· {0} Regeln · heuristisch, keine Rechtsberatung · Quellen:', [catalog.rules.length]) + ' ', ...catalog.sources.flatMap((s, i) => [i ? ', ' : '', el('a', { href: s.url, target: '_blank' }, s.label)]))),
      el('table', { class: 'grid', style: 'width:100%' }, el('thead', {}, el('tr', {}, el('th', { style: 'width:30px' }, ''), el('th', { style: 'width:260px' }, t_('Regel')), el('th', {}, t_('Was zu tun ist')), el('th', { style: 'width:200px' }, t_('Anker')))),
        el('tbody', {}, ...catalog.rules.map(r => el('tr', {}, el('td', { class: r.severity === 'error' ? 'neg' : r.severity === 'warn' ? 'warn' : 'muted' }, SEV[r.severity]), el('td', {}, r.label, el('div', { class: 'muted', style: 'font-size:11px' }, (r.terms ?? []).slice(0, 8).join(', ') + ((r.terms?.length ?? 0) > 8 ? ' …' : '') || t_('Muster'))), el('td', { class: 'muted', style: 'font-size:12px' }, r.hint), el('td', { class: 'mono muted', style: 'font-size:11px' }, r.ref)))))))
    if (!st.result) { body.append(el('div', { class: 'empty' }, t_('Teilbaum wählen und prüfen — dieselben Regeln laufen auch in ✓ Datenqualität mit allen anderen.'))); return }
    const f = st.result.findings
    const tbl = el('table', { class: 'grid', style: 'width:100%' }, el('thead', {}, el('tr', {}, el('th', { style: 'width:30px' }, ''), el('th', { style: 'width:280px' }, t_('Knoten')), el('th', { style: 'width:50px' }, ''), el('th', { style: 'width:160px' }, t_('Feld')), el('th', {}, t_('Befund')))))
    const tb = el('tbody'); tbl.append(tb)
    for (const x of f.slice(0, 1000)) tb.append(el('tr', {}, el('td', { class: x.severity === 'error' ? 'neg' : x.severity === 'warn' ? 'warn' : 'muted' }, SEV[x.severity]),
      el('td', {}, el('a', { href: `/tree/${x.node.id}`, onclick: e => { e.preventDefault(); ctx.go?.(`/tree/${x.node.id}`) } }, `${ICON[x.node.role] ?? ''} ${x.node.label}`)), el('td', { class: 'muted' }, x.locale), el('td', { class: 'mono' }, x.attribute), el('td', {}, x.message)))
    body.append(el('div', { class: 'section' }, el('h2', {}, t_('Befunde') + ' ', el('span', { class: 'muted' }, t_('· {0} in {1} Knoten · ✗ {2} · ⚠ {3} · ℹ {4}', [f.length, st.result.nodes, f.filter(x => x.severity === 'error').length, f.filter(x => x.severity === 'warn').length, f.filter(x => x.severity === 'info').length]))), f.length ? tbl : el('div', { class: 'empty' }, t_('✓ keine Befunde'))))
  }
  root.append(el('div', { class: 'toolbar' }, el('h1', {}, `${catalog.icon} ${catalog.label}`), el('span', { style: 'position:relative' }, rootBtn, pick), el('button', { class: 'primary', onclick: run }, t_('▶ prüfen')), el('span', { class: 'grow' }), status), body)
  draw()
  return () => {}
}

export default {
  views: [{ path: 'check', label: catalog.label, icon: catalog.icon, topic: 'analysis', hint: t_('Greenwashing-Kritikalität von Produkttexten nach Richtlinie (EU) 2024/825 — Kriterienkatalog, Prüfung je Teilbaum, Regeln in der Datenqualität'), mount }],
  nodeActions: [{ label: t_('EmpCo prüfen'), icon: catalog.icon, topic: 'analysis', roles: ['group', 'product'], run(id, ctx) { localStorage.setItem('journali.empco.root', id); ctx.go?.('/p/empco/check') } }],
  checks,
  catalog,
}
