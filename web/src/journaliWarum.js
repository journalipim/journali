// journali advisor, „Warum ist …?“ (18.10.2026, docs/todo-journali-advisor.md): Gründe aus den Daten für den Knoten, an dem man steht —
// fehlende Pflichtwerte je Kanal und Sprache, Freigaben (eigen und über den Fallback-Kanal), die Ausleitung je Publikationsbaum mit dem Grund
// des Servers, der Status. Die Gründe kennt journali schon (NodeView, /api/pub/{id}/export); hier werden sie für eine Frage zusammengestellt.
// Ohne KI — die KI bekommt sie als Zustand des Knotens und formuliert höchstens aus.
import { api } from './api.js'
import { store } from './store.js'
import { tree } from './tree.js'
import { t, L } from './i18n.js'

/// Fragt die Eingabe nach einem Grund? „warum“, „wieso“, „weshalb“ — oder sie nennt, was nicht ist („nicht im Shop“, „fehlt“, „kein Bild“)
export const fragtWarum = q => /(^|[^\p{L}])(warum|wieso|weshalb|why|nicht|kein|keine|keinen|fehlt|fehlen|not|missing)([^\p{L}]|$)/iu.test(String(q ?? ''))

/// Der Knoten, an dem man steht: aus dem Pfad der Ansicht (/tree/<id>, /table/<id>)
export function knotenAusPfad(pfad) {
  const m = /^\/(?:tree|table)\/([^/?#]+)/.exec(String(pfad ?? ''))
  return m ? decodeURIComponent(m[1]) : null
}

const attrName = k => { const a = store.model?.attributes?.find(x => x.key === k); return a ? (L(a.label) || a.key) : k }
const kanal = (ch, loc) => loc ? `${ch}/${loc}` : ch

/**
 * Die Gründe am Knoten: [{ ok, text }] — ok: was gilt (grün), sonst, was fehlt oder nicht geht (rot). Null, wenn es den Knoten nicht gibt.
 * `holen` ist der Lesezugriff (api.get); die Ausleitung fragt jeden Publikationsbaum einmal.
 */
export async function gruende(id, { holen = p => api.get(p) } = {}) {
  const n = await holen(`/api/nodes/${encodeURIComponent(id)}`).catch(() => null)
  if (!n?.role) return null
  const label = tree.byId?.get(id)?.label ?? n.name ?? id
  const aus = []
  if (n.hasStatus !== false && n.status) aus.push({ ok: true, text: t('Status: {0}.', [store.statusLabel?.(n.status) ?? n.status]) })
  const fehlend = (n.completeness ?? []).filter(c => c.missing?.length)
  for (const c of fehlend) aus.push({ ok: false, text: t('{0}: es fehlen {1}.', [kanal(c.channel, c.locale), c.missing.map(attrName).join(', ')]) })
  if ((n.completeness ?? []).length && !fehlend.length) aus.push({ ok: true, text: t('Alle Pflichtwerte sind gepflegt.') })
  const eigen = (n.releases ?? []).map(r => kanal(r.channel, r.locale))
  const geerbt = (n.releasedVia ?? []).map(r => `${kanal(r.channel, r.locale)} ← ${r.via}`)
  if (eigen.length) aus.push({ ok: true, text: t('Freigegeben für {0}.', [eigen.join(', ')]) })
  if (geerbt.length) aus.push({ ok: true, text: t('Freigabe über den Fallback-Kanal: {0}.', [geerbt.join(', ')]) })
  if (!eigen.length && !geerbt.length && n.role !== 'group') aus.push({ ok: false, text: t('Keine Freigabe an diesem Knoten.') })
  // die Ausleitung je Publikationsbaum — Produkte und Varianten; eine Gruppe wird nicht ausgeleitet, nur was darunter steht
  if (n.role === 'product' || n.role === 'variant') {
    const baeume = await holen('/api/pub').catch(() => [])
    for (const b of Array.isArray(baeume) ? baeume : []) {
      const e = await holen(`/api/pub/${encodeURIComponent(b.id)}/export`).catch(() => null)
      const zeile = e?.rows?.find(r => r.product?.id === id || r.variants?.some(v => v.id === id))
      if (!zeile) { aus.push({ ok: false, text: t('„{0}“: nicht im Baum.', [b.label]) }); continue }
      const v = n.role === 'variant' ? zeile.variants.find(x => x.id === id) : null
      const drin = v ? v.in : zeile.in, warum = (v ? v.why : zeile.why) ?? []
      aus.push(drin ? { ok: true, text: t('„{0}“: wird ausgeleitet.', [b.label]) }
        : { ok: false, text: t('„{0}“: wird nicht ausgeleitet — {1}', [b.label, warum.join('; ') || '—']) })
    }
  }
  return { id, label, role: n.role, gruende: aus }
}
