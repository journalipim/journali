// Plugin docs — Ansicht „Dokumente durchsuchen". Gesucht wird über den Volltextindex des Servers (/api/docs/search):
// Wörter, Zahlen, Normbezeichnungen — und seit den Vektoren (35) nach Sinn oder beides verschnitten (mode). Dazu die
// Frage an die Dokumente (/api/docs/ask): die besten Abschnitte gehen an die KI des Teams, die Antwort nennt ihre
// Quellen. Jeder Treffer zeigt Dokument, Seite, Textstelle — und den Knoten, an dem es hängt.
// Gelesen wird von einem Job (job.mjs); diese Ansicht sagt auch, wie viel schon im Index steht und was noch fehlt.

const t_ = (k, p) => globalThis.journali?.t ? globalThis.journali.t(k, p) : String(k).replace(/\{(\w+)\}/g, (m, i) => p?.[i] ?? m)   // Oberflächensprache: spät gebunden, im Test ohne Fenster ladbar
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue
    if (k === 'style') e.style.cssText = v
    else if (k === 'html') e.innerHTML = v
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v)
    else e.setAttribute(k, v === true ? '' : v)
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) e.append(kid.nodeType ? kid : document.createTextNode(String(kid)))
  return e
}

const ICON = { group: '▣', product: '▦', variant: '◆', rubric: '▥' }
/// Der Ausschnitt kommt mit « » um die Fundstellen — daraus wird eine Hervorhebung, ohne fremdes HTML zu übernehmen
function snippet(text) {
  const out = el('span')
  for (const teil of String(text ?? '').split(/(«[^»]*»)/)) {
    if (!teil) continue
    if (teil.startsWith('«')) out.append(el('mark', {}, teil.slice(1, -1)))
    else out.append(document.createTextNode(teil))
  }
  return out
}

async function mount(root, ctx) {
  const { api, store, tree } = ctx
  if (!tree.loaded) await tree.load()
  const st = { q: localStorage.getItem('journali.docs.q') ?? '', hits: [], busy: false, status: null, under: null, said: '',
    mode: localStorage.getItem('journali.docs.mode') || 'text', frage: '', antwort: null, askBusy: false, embed: null, warning: null }

  const say = t => { st.said = t; draw() }
  async function loadStatus() {
    try { st.status = await api.get('/api/docs/status') } catch (e) { st.status = { ready: false, error: e.message } }
    try { st.embed = await api.get('/api/docs/embed') } catch { st.embed = null }
  }
  function setMode(m) { st.mode = m; localStorage.setItem('journali.docs.mode', m); search() }

  /// Die Frage an die Dokumente: der Server sucht die Abschnitte (Wörter und Sinn) und fragt die KI des Teams
  async function ask() {
    const q = st.frage.trim(); if (!q) return
    st.askBusy = true; draw()
    try {
      const r = await api.post('/api/docs/ask', { q, under: st.under, k: 6 })
      st.antwort = r.empty ? { text: t_('Nichts in den Dokumenten dazu'), sources: [], warning: r.warning ?? null } : { text: r.answer, sources: r.sources ?? [], warning: r.warning ?? null, model: r.model }
    } catch (e) { st.antwort = { text: '✗ ' + e.message, sources: [], warning: null } }
    finally { st.askBusy = false; draw() }
  }
  /// Gescheiterte wieder in den Stapel: nach einer Reparatur am Server soll der Job sie erneut versuchen
  async function freigeben() {
    try {
      const r = await api.post('/api/docs/retry', {})
      await loadStatus()
      say(r.freed ? t_('{0} wieder freigegeben — beim nächsten Lauf des Jobs „Dokumente lesen“', [r.freed]) : t_('nichts freizugeben'))
    } catch (e) { say('✗ ' + e.message) }
  }

  async function search() {
    const q = st.q.trim()
    localStorage.setItem('journali.docs.q', q)
    if (!q) { st.hits = []; st.said = ''; draw(); return }
    st.busy = true; draw()
    try {
      const r = await api.get(`/api/docs/search?q=${encodeURIComponent(q)}&limit=60&mode=${st.mode}${st.under ? `&under=${encodeURIComponent(st.under)}` : ''}`)
      st.hits = r.hits ?? []
      st.said = r.ready === false ? t_('✗ Kein Dokumentindex — der Server läuft ohne Postgres') : t_('{0} Treffer', [st.hits.length])
      st.warning = r.warning ?? null   // der Sinn ging nicht (Erweiterung, Plugin, Prozess) — die Wörter kamen trotzdem
    } catch (e) { st.hits = []; st.said = '✗ ' + e.message; st.warning = null }
    finally { st.busy = false; draw() }
  }

  function draw() {
    root.innerHTML = ''
    const input = el('input', {
      type: 'search', value: st.q, placeholder: t_('suchen in Datenblättern, Anleitungen, Katalogen — Wörter, Zahlen, Normen'),
      style: 'width:520px',
      oninput: e => { st.q = e.target.value },
      onkeydown: e => { if (e.key === 'Enter') search() },
    })
    const unterBaum = st.under ? tree.byId.get(st.under) : null
    root.append(
      el('div', { class: 'toolbar' },
        el('h1', {}, t_('⌕ Dokumente')),
        input,
        el('button', { class: 'primary', onclick: search, title: t_('Im Text der Dokumente suchen') }, st.busy ? '…' : t_('Suchen')),
        // Wie gesucht wird: Wörter (Volltext), Sinn (Vektoren), beides verschnitten
        el('span', { class: 'view-chip' + (st.mode === 'text' ? ' on' : ''), title: t_('Wörter, Zahlen, Normen — der Volltext'), onclick: () => setMode('text') }, t_('Wörter')),
        el('span', { class: 'view-chip' + (st.mode === 'semantic' ? ' on' : ''), title: t_('nach Sinn — über die Vektoren des Plugins „Einbettungen“'), onclick: () => setMode('semantic') }, t_('Sinn')),
        el('span', { class: 'view-chip' + (st.mode === 'hybrid' ? ' on' : ''), title: t_('Wörter und Sinn, verschnitten'), onclick: () => setMode('hybrid') }, t_('Beides')),
        unterBaum
          ? el('span', { class: 'view-chip on', title: t_('nur Dokumente unter „{0}“ · Klick hebt es auf', [unterBaum.label]), onclick: () => { st.under = null; search() } }, `${ICON[unterBaum.role] ?? ''} ${unterBaum.label} ×`)
          : null,
        el('span', { class: 'grow' }),
        el('span', { class: 'muted', style: 'font-size:12px' }, st.status?.ready === false ? t_('✗ kein Index') : `${(st.status?.media ?? 0).toLocaleString('de-DE')} Dokumente · ${(st.status?.chunks ?? 0).toLocaleString('de-DE')} Abschnitte`),
        st.embed ? el('span', { class: 'muted', style: 'font-size:12px', title: st.embed.ready === false ? (st.embed.reason ?? '') : (st.embed.plugin === false ? (st.embed.pluginReason ?? '') : t_('Vektoren für die Suche nach Sinn — Job „Einbettungen“')) },
          st.embed.ready === false ? t_('◌ ohne Vektoren') : t_('· {0} von {1} Abschnitten mit Vektor', [(st.embed.embedded ?? 0).toLocaleString('de-DE'), (st.embed.chunks ?? 0).toLocaleString('de-DE')])) : null,
        st.warning ? el('span', { class: 'warn', style: 'font-size:12px', title: t_('Die Suche nach Sinn ging nicht — gefunden wurde über die Wörter') }, '◌ ' + st.warning) : null,
        // Scans haben keine Textebene — der Text steckt in Bildern und bräuchte OCR
        st.status?.scans ? el('span', { class: 'warn', style: 'font-size:12px', title: t_('PDFs ohne Textebene: der Text steckt in Bildern und ist erst nach OCR durchsuchbar') }, t_('◌ {0} brauchen OCR', [st.status.scans])) : null,
        st.status?.errors ? el('button', {
          class: 'x neg', style: 'font-size:12px',
          title: t_('Gescheiterte Dokumente freigeben (der Job liest sie beim nächsten Lauf erneut) — der Grund steht im Protokoll des Jobs'),
          onclick: freigeben,
        }, `✗ ${st.status.errors}`) : null,
        el('button', { class: 'x', title: t_('Stand neu lesen'), onclick: async () => { await loadStatus(); draw() } }, '⟳'),
      ),
      el('div', { class: 'toolbar ask', style: 'gap:8px' },
        el('input', {
          type: 'text', value: st.frage, placeholder: t_('Frage an die Dokumente — die Antwort nennt ihre Quellen'), style: 'width:520px',
          oninput: e => { st.frage = e.target.value }, onkeydown: e => { if (e.key === 'Enter') ask() },
        }),
        el('button', { onclick: ask, title: t_('Die besten Abschnitte gehen an die KI des Teams; die Antwort trägt je Aussage die Nummer ihrer Quelle') }, st.askBusy ? '…' : t_('Fragen')),
        st.antwort ? el('button', { class: 'x', onclick: () => { st.antwort = null; draw() }, title: t_('Antwort schliessen') }, '×') : null,
      ),
      el('div', { class: 'scroll' }, body()),
    )
    if (st.q) { input.focus(); input.setSelectionRange(st.q.length, st.q.length) }
  }

  function body() {
    const wrap = el('div')
    if (st.antwort) wrap.append(antwort())
    wrap.append(treffer())
    return wrap
  }

  /// Die Antwort mit ihren Quellen: [n] Dokument, Seite, die Knoten, an denen es hängt
  function antwort() {
    const a = st.antwort
    const box = el('div', { class: 'answer', style: 'padding:10px 12px;border-bottom:1px solid var(--line);background:var(--accent-soft)' })
    box.append(el('div', { class: 'answer-text', style: 'white-space:pre-wrap;font-size:13px' }, a.text))
    if (a.sources.length) {
      const list = el('div', { class: 'sources muted', style: 'font-size:12px;margin-top:6px' })
      for (const s of a.sources) {
        list.append(el('div', { class: 'source' }, `[${s.n}] `,
          el('a', { class: 'link', href: `/api/media/${encodeURIComponent(s.media)}/file`, target: '_blank', rel: 'noopener' }, s.name),
          s.page ? ` · ${t_('Seite {0}', [s.page])}` : '',
          ...(s.nodes ?? []).map(n => el('a', { class: 'link', style: 'margin-left:8px', onclick: () => ctx.go?.(`/tree/${encodeURIComponent(n.id)}`) }, `${ICON[n.role] ?? ''} ${n.label}`))))
      }
      box.append(list)
    }
    if (a.warning) box.append(el('div', { class: 'muted', style: 'font-size:11px;margin-top:4px' }, a.warning))
    return box
  }

  function treffer() {
    if (st.said.startsWith('✗')) return el('div', { class: 'empty neg' }, st.said)
    if (!st.hits.length) {
      return el('div', { class: 'empty' }, st.q.trim()
        ? t_('Nichts zu „{0}“ — andere Wörter, oder das Dokument ist noch nicht gelesen (Job „Dokumente lesen“).', [st.q.trim()])
        : t_('Suchwort eingeben. Gesucht wird im Text der Dokumente, die an den Knoten hängen.'))
    }
    const list = el('div', { class: 'list' })
    for (const h of st.hits) {
      const knoten = (h.nodes ?? []).map(n => el('a', {
        class: 'link', title: t_('{0} im Baum öffnen', [n.id]),
        onclick: () => ctx.go?.(`/tree/${encodeURIComponent(n.id)}`),
      }, `${ICON[n.role] ?? ''} ${n.label}`))
      list.append(el('div', { class: 'hit', style: 'padding:8px 10px;border-bottom:1px solid var(--line)' },
        el('div', { style: 'display:flex;gap:8px;align-items:baseline;min-width:0' },
          el('a', { class: 'link', href: `/api/media/${encodeURIComponent(h.media)}/file`, target: '_blank', rel: 'noopener', title: h.mime ?? '' }, h.name),
          h.score != null ? el('span', { class: 'chip score', style: 'font-size:11px;flex:0 0 auto', title: t_('Ähnlichkeit nach Sinn') }, `${Math.round(h.score * 100)} %`) : null,
          h.page ? el('span', { class: 'muted', style: 'font-size:12px;flex:0 0 auto' }, t_('Seite {0}', [h.page])) : null,
          h.heading ? el('span', { class: 'muted', style: 'font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, `· ${h.heading}`) : null,
          el('span', { class: 'grow' }),
          ...knoten,
        ),
        el('div', { style: 'font-size:13px;margin-top:2px' }, snippet(h.snippet)),
      ))
    }
    return list
  }

  // Ein Knoten als Ausgangspunkt (aus der Knoten-Aktion) — dann sucht die Ansicht nur in seinem Teilbaum
  const merk = localStorage.getItem('journali.docs.under')
  if (merk && tree.byId.get(merk)) { st.under = merk; localStorage.removeItem('journali.docs.under') }

  draw()
  await loadStatus()
  draw()
  if (st.q) await search()
}

export default {
  views: [{ path: 'search', label: t_('Dokumente'), icon: '⌕', topic: 'tools', hint: t_('Im Text der Dokumente suchen — Datenblätter, Anleitungen, Kataloge; gelesen wird vom Job „Dokumente lesen“'), mount }],
  nodeActions: [{
    label: t_('In Dokumenten suchen'), icon: '⌕', topic: 'tools', roles: ['group', 'product', 'variant'],
    run(nodeId, ctx) { localStorage.setItem('journali.docs.under', nodeId); ctx.go?.('/p/docs/search') },
  }],
}
