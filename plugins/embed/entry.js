// Plugin embed — das Band „≈ Ähnliche Knoten“ in der Knotenansicht (27.09.2026, pflegestruktur 35). Es liest
// /api/nodes/{id}/similar: die Knoten, deren Text dem dieses Knotens am nächsten steht — aus dem gespeicherten Vektor,
// ohne neue Einbettung. Ohne Erweiterung vector oder ohne Vektor zum Knoten sagt das Band das, kurz, im Tooltip warum.

const t_ = (k, p) => globalThis.journali?.t ? globalThis.journali.t(k, p) : String(k).replace(/\{(\w+)\}/g, (m, i) => p?.[i] ?? m)   // Oberflächensprache: spät gebunden, im Test ohne Fenster ladbar
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue
    if (k === 'style') e.style.cssText = v
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v)
    else e.setAttribute(k, v === true ? '' : v)
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) e.append(kid.nodeType ? kid : document.createTextNode(String(kid)))
  return e
}
const ICON = { group: '▣', product: '▦', variant: '◆' }
const prozent = score => `${Math.round(Math.max(0, Math.min(1, score)) * 100)} %`

async function bandMount({ head, body }, nodeId, ctx) {
  const { api } = ctx
  head.textContent = '· …'
  let r
  try { r = await api.get(`/api/nodes/${encodeURIComponent(nodeId)}/similar?limit=8`) }
  catch (e) { head.textContent = '· ✗ ' + e.message; return }
  if (r.ready === false) { head.textContent = '· ' + t_('kein Index'); head.title = r.reason ?? ''; return }
  if (!r.known) { head.textContent = '· ' + t_('noch nicht eingebettet'); head.title = t_('Der Job „Einbettungen“ nimmt diesen Knoten beim nächsten Lauf mit.'); return }
  const hits = r.hits ?? []
  head.textContent = '· ' + hits.length
  if (!hits.length) return
  const row = el('div', { class: 'row' })
  for (const h of hits) {
    row.append(el('a', {
      class: 'chip link', title: `${(h.path ?? []).join(' › ')} · ${t_('Ähnlichkeit {0}', [prozent(h.score)])}`,
      onclick: () => ctx.go?.(`/tree/${encodeURIComponent(h.id)}`),
    }, `${ICON[h.role] ?? ''} ${h.label} `, el('span', { class: 'muted', style: 'font-size:11px' }, prozent(h.score))))
  }
  body.append(row)
}

export default {
  nodeBands: [
    { key: 'similar', label: t_('Ähnliche Knoten'), icon: '≈', roles: ['group', 'product', 'variant'], mount: bandMount },
  ],
}
