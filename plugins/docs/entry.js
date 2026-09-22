// Plugin docs — Ansicht „Dokumente durchsuchen" (Taloan, 22.09.2026: „Firmen haben Marketingdokumente, Vorteils-
// argumentationen, Datenblätter, Kataloge irgendwo rumliegen … man dropt sie an einen Knoten, sie werden im
// Hintergrund gelesen und stehen dann bereit"). Gesucht wird über den Volltextindex des Servers (/api/docs/search):
// Wörter, Zahlen, Normbezeichnungen. Jeder Treffer zeigt Dokument, Seite, Textstelle — und den Knoten, an dem es hängt.
// Gelesen wird von einem Job (job.mjs); diese Ansicht sagt auch, wie viel schon im Index steht und was noch fehlt.

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
  const st = { q: localStorage.getItem('journali.docs.q') ?? '', hits: [], busy: false, status: null, under: null, said: '' }

  const say = t => { st.said = t; draw() }
  async function loadStatus() {
    try { st.status = await api.get('/api/docs/status') } catch (e) { st.status = { ready: false, error: e.message } }
  }
  /// Gescheiterte wieder in den Stapel: nach einer Reparatur am Server soll der Job sie erneut versuchen
  async function freigeben() {
    try {
      const r = await api.post('/api/docs/retry', {})
      await loadStatus()
      say(r.freed ? `${r.freed} wieder freigegeben — beim nächsten Lauf des Jobs „Werkzeug: Dokumente lesen“` : 'nichts freizugeben')
    } catch (e) { say('✗ ' + e.message) }
  }

  async function search() {
    const q = st.q.trim()
    localStorage.setItem('journali.docs.q', q)
    if (!q) { st.hits = []; st.said = ''; draw(); return }
    st.busy = true; draw()
    try {
      const r = await api.get(`/api/docs/search?q=${encodeURIComponent(q)}&limit=60${st.under ? `&under=${encodeURIComponent(st.under)}` : ''}`)
      st.hits = r.hits ?? []
      st.said = r.ready === false ? '✗ Kein Dokumentindex — der Server läuft ohne Postgres' : `${st.hits.length} Treffer`
    } catch (e) { st.hits = []; st.said = '✗ ' + e.message }
    finally { st.busy = false; draw() }
  }

  function draw() {
    root.innerHTML = ''
    const input = el('input', {
      type: 'search', value: st.q, placeholder: 'suchen in Datenblättern, Anleitungen, Katalogen — Wörter, Zahlen, Normen',
      style: 'width:520px',
      oninput: e => { st.q = e.target.value },
      onkeydown: e => { if (e.key === 'Enter') search() },
    })
    const unterBaum = st.under ? tree.byId.get(st.under) : null
    root.append(
      el('div', { class: 'toolbar' },
        el('h1', {}, '⌕ Dokumente'),
        input,
        el('button', { class: 'primary', onclick: search, title: 'Im Text der Dokumente suchen' }, st.busy ? '…' : 'Suchen'),
        unterBaum
          ? el('span', { class: 'view-chip on', title: `nur Dokumente unter „${unterBaum.label}“ · Klick hebt es auf`, onclick: () => { st.under = null; search() } }, `${ICON[unterBaum.role] ?? ''} ${unterBaum.label} ×`)
          : null,
        el('span', { class: 'grow' }),
        el('span', { class: 'muted', style: 'font-size:12px' }, st.status?.ready === false ? '✗ kein Index' : `${(st.status?.media ?? 0).toLocaleString('de-DE')} Dokumente · ${(st.status?.chunks ?? 0).toLocaleString('de-DE')} Abschnitte`),
        // Scans haben keine Textebene — der Text steckt in Bildern und bräuchte OCR (Taloan, 22.09.2026)
        st.status?.scans ? el('span', { class: 'warn', style: 'font-size:12px', title: 'PDFs ohne Textebene: der Text steckt in Bildern und ist erst nach OCR durchsuchbar' }, `◌ ${st.status.scans} brauchen OCR`) : null,
        st.status?.errors ? el('button', {
          class: 'x neg', style: 'font-size:12px',
          title: 'Gescheiterte Dokumente freigeben (der Job liest sie beim nächsten Lauf erneut) — der Grund steht im Protokoll des Jobs',
          onclick: freigeben,
        }, `✗ ${st.status.errors}`) : null,
        el('button', { class: 'x', title: 'Stand neu lesen', onclick: async () => { await loadStatus(); draw() } }, '⟳'),
      ),
      el('div', { class: 'scroll' }, body()),
    )
    if (st.q) { input.focus(); input.setSelectionRange(st.q.length, st.q.length) }
  }

  function body() {
    if (st.said.startsWith('✗')) return el('div', { class: 'empty neg' }, st.said)
    if (!st.hits.length) {
      return el('div', { class: 'empty' }, st.q.trim()
        ? `Nichts zu „${st.q.trim()}“ — andere Wörter, oder das Dokument ist noch nicht gelesen (Job „Werkzeug: Dokumente lesen“).`
        : 'Suchwort eingeben. Gesucht wird im Text der Dokumente, die an den Knoten hängen.')
    }
    const list = el('div', { class: 'list' })
    for (const h of st.hits) {
      const knoten = (h.nodes ?? []).map(n => el('a', {
        class: 'link', title: `${n.id} im Baum öffnen`,
        onclick: () => ctx.go?.(`/tree/${encodeURIComponent(n.id)}`),
      }, `${ICON[n.role] ?? ''} ${n.label}`))
      list.append(el('div', { class: 'hit', style: 'padding:8px 10px;border-bottom:1px solid var(--line)' },
        el('div', { style: 'display:flex;gap:8px;align-items:baseline;min-width:0' },
          el('a', { class: 'link', href: `/api/media/${encodeURIComponent(h.media)}/file`, target: '_blank', rel: 'noopener', title: h.mime ?? '' }, h.name),
          h.page ? el('span', { class: 'muted', style: 'font-size:12px;flex:0 0 auto' }, `Seite ${h.page}`) : null,
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
  views: [{ path: 'search', label: 'Dokumente', icon: '⌕', topic: 'tools', hint: 'Im Text der Dokumente suchen — Datenblätter, Anleitungen, Kataloge; gelesen wird vom Job „Werkzeug: Dokumente lesen“', mount }],
  nodeActions: [{
    label: 'In Dokumenten suchen', icon: '⌕', topic: 'tools', roles: ['group', 'product', 'variant'],
    run(nodeId, ctx) { localStorage.setItem('journali.docs.under', nodeId); ctx.go?.('/p/docs/search') },
  }],
}
