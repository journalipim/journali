// Der Dienst des Produktberaters (docs/pflegestruktur.md 42, 08.10.2026): das einzige Stück, das eine Website erreicht. Er hält keine Daten, nur das
// Token seines Beraters, und fragt journali über /api — ausgehend, nie umgekehrt. Nach aussen bietet er:
//   GET  /widget.js           das Chat-Fenster zum Einbinden (ein <script>-Tag)
//   GET  /api/info            Bezeichnung, Begrüssung, Sprachen
//   POST /api/ask             eine Eingabe oder ein Klick im Gespräch — der Kern (kern/gespraech.mjs) versteht, journali wählt aus (09.10.2026)
//   POST /api/event           ein Produkt gemerkt — für das Gedächtnis und das Lernen
//   GET  /api/product/{id}    ein Produkt (mit ?gespraech=: es ist im Blick)
//   GET  /api/variant/{id}    eine Variante ganz (08.10.2026)
//   GET  /api/vocabulary, POST /api/select, POST /api/docs   die Schnittstelle Version 2, durchgereicht (pflegestruktur 44)
//   POST /api/compare         zwei bis vier Produkte nebeneinander
//   GET  /api/image/{id}      ein Bild eines Produkts
//   GET  /api/doc/{id}        ein Dokument aus den Unterlagen des Beraters als Text (Abschnitte, 10.10.2026) — keine Datei
//   POST /mcp                 MCP (Streamable HTTP, mcp.mjs) mit denselben Fragen als Werkzeuge
//   GET  /health              ob journali antwortet
// Je Besucher (Adresse) zählt der Dienst Fragen je Minute und Tag; die Tagesgrenze des Beraters zählt journali. Websites, die das Chat-Fenster
// einbinden dürfen, nennt die Definition des Beraters (CORS); ein fremder Origin bekommt 403, auch am MCP-Endpunkt (Schutz vor DNS-Rebinding).
// Protokolliert wird kein Inhalt einer Frage.
import { createHash } from 'node:crypto'
import { verarbeite } from './mcp.mjs'
import { erstelleKern } from './kern/gespraech.mjs'

export const MAX_KOERPER = 16 * 1024
const VORGABE = { jeBesucherMinute: 20, jeBesucherTag: 300 }

/**
 * @param {{ journali: string, advisor: string, token: string, widget?: string, fetch?: typeof fetch, proxy?: boolean, jetzt?: () => number, infoDauer?: number,
 *           lernen?: { notiere: Function } | null }} o
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void>}
 */
export function erstelle(o) {
  const holen = o.fetch ?? globalThis.fetch
  const jetzt = o.jetzt ?? Date.now
  const basis = o.journali.replace(/\/+$/, '') + '/api/advisor/' + encodeURIComponent(o.advisor) + '/'
  const kopf = { authorization: 'Bearer ' + o.token }
  let info = null, infoAm = 0
  const besucher = new Map()   // Adresse → { minute, nMinute, tag, nTag }

  const widgetTag = '"' + createHash('sha256').update(o.widget ?? '').digest('hex').slice(0, 16) + '"'
  async function journali(pfad, body, extra = {}) {
    const r = await holen(basis + pfad, { method: body === undefined ? 'GET' : 'POST', headers: { ...kopf, ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...extra }, body: body === undefined ? undefined : JSON.stringify(body) })
    const text = await r.text()
    let json = null; try { json = text ? JSON.parse(text) : null } catch { json = { error: text.slice(0, 200) } }
    return { status: r.status, json }
  }
  // der Kern: versteht die Eingabe, hält das Gespräch (Arbeitsspeicher, 30 Minuten) und fragt journali über dieselbe Funktion
  const kern = erstelleKern({ journali, jetzt, lernen: o.lernen ?? null })
  const kennung = x => typeof x === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(x) ? x : null

  async function holeInfo() {
    if (info && jetzt() - infoAm < (o.infoDauer ?? 60_000)) return info
    const r = await journali('info')
    if (r.status !== 200) throw Object.assign(new Error(r.json?.error ?? `journali: HTTP ${r.status}`), { status: r.status === 401 || r.status === 403 ? 502 : r.status })
    info = r.json; infoAm = jetzt()
    return info
  }

  /// Darf dieser Besucher noch fragen? Zählt mit.
  function zaehle(adresse, grenzen) {
    const t = jetzt(), minute = Math.floor(t / 60_000), tag = Math.floor(t / 86_400_000)
    let b = besucher.get(adresse)
    if (!b || b.tag !== tag) { b = { minute, nMinute: 0, tag, nTag: 0 }; besucher.set(adresse, b) }
    if (b.minute !== minute) { b.minute = minute; b.nMinute = 0 }
    const proMinute = grenzen?.jeBesucherMinute ?? VORGABE.jeBesucherMinute, proTag = grenzen?.jeBesucherTag ?? VORGABE.jeBesucherTag
    if (b.nMinute >= proMinute) return 60 - Math.floor((t / 1000) % 60)
    if (b.nTag >= proTag) return Math.ceil((86_400_000 - (t % 86_400_000)) / 1000)
    b.nMinute++; b.nTag++
    if (besucher.size > 50_000) for (const [k, v] of besucher) if (v.tag !== tag) besucher.delete(k)
    return 0
  }

  function adresse(req) {
    if (o.proxy) { const f = String(req.headers['x-forwarded-for'] ?? '').split(',').map(s => s.trim()).filter(Boolean); if (f.length) return f[f.length - 1] }
    return req.socket?.remoteAddress ?? '?'
  }

  function sende(res, status, json, extra = {}) {
    const body = json === undefined ? '' : JSON.stringify(json)
    res.writeHead(status, { ...(json === undefined ? {} : { 'content-type': 'application/json; charset=utf-8' }), 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extra })
    res.end(body)
  }

  async function koerper(req) {
    let n = 0; const teile = []
    for await (const t of req) { n += t.length; if (n > MAX_KOERPER) throw Object.assign(new Error('Anfrage zu gross.'), { status: 413 }); teile.push(t) }
    const text = Buffer.concat(teile).toString('utf8')
    try { return text ? JSON.parse(text) : {} } catch { throw Object.assign(new Error('Kein JSON.'), { status: 400 }) }
  }

  const normal = s => String(s ?? '').trim().replace(/\/+$/, '').toLowerCase()

  return async function handler(req, res) {
    const url = new URL(req.url ?? '/', 'http://dienst')
    const pfad = url.pathname
    try {
      if (req.method === 'GET' && pfad === '/health') {
        try { const i = await holeInfo(); return sende(res, 200, { ok: true, advisor: i.key, products: i.products }) }
        catch (e) { return sende(res, 503, { ok: false, error: e.message }) }
      }
      // Das Fenster mit dem Fingerabdruck seines Inhalts: der Browser fragt bei jedem Laden nach (no-cache) und bekommt 304, solange es dasselbe ist —
      // nach einem Update sofort das neue (08.10.2026; vorher eine Stunde lang das alte)
      if (req.method === 'GET' && pfad === '/widget.js') {
        const kopf = { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-cache', etag: widgetTag, 'x-content-type-options': 'nosniff', 'access-control-allow-origin': '*' }
        if (req.headers['if-none-match'] === widgetTag) { res.writeHead(304, kopf); return res.end() }
        res.writeHead(200, kopf)
        return res.end(o.widget ?? '')
      }
      const istApi = pfad.startsWith('/api/'), istMcp = pfad === '/mcp'
      if (!istApi && !istMcp) return sende(res, 404, { error: 'Nicht gefunden.' })

      const i = await holeInfo()
      // Herkunft: eine Website darf, wenn der Berater sie nennt; ohne Origin (Server, MCP-Client) gilt die Anfrage
      const origin = req.headers.origin
      const erlaubt = !origin || (i.origins ?? []).map(normal).includes(normal(origin))
      const cors = origin && erlaubt ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}
      if (!erlaubt) return sende(res, 403, istMcp ? { jsonrpc: '2.0', error: { code: -32600, message: 'Origin not allowed' } } : { error: 'Diese Website darf den Berater nicht einbinden.' })
      if (req.method === 'OPTIONS') return sende(res, 204, undefined, { ...cors, 'access-control-allow-methods': 'GET, POST', 'access-control-allow-headers': 'content-type, mcp-protocol-version, mcp-method, mcp-name', 'access-control-max-age': '600' })

      if (istMcp) {
        if (!i.mcp) return sende(res, 404, { error: 'MCP ist für diesen Berater aus.' })
        if (req.method !== 'POST') return sende(res, 405, undefined, { allow: 'POST' })
        const warten = zaehle(adresse(req), i.limits)
        if (warten) return sende(res, 429, { jsonrpc: '2.0', error: { code: -32000, message: 'Too many requests' } }, { 'retry-after': String(warten) })
        const nachricht = await koerper(req)
        // search_products über den Kern ohne Gespräch: ein Agent bringt sein Gedächtnis selbst mit
        const frage = async (art, a) => art === 'ask' ? { status: 200, json: await kern.suche({ q: a.q, filter: a.filter, locale: a.locale, limit: a.take }) }
          : art === 'product' ? journali('product/' + encodeURIComponent(a.id) + (a.locale ? '?locale=' + encodeURIComponent(a.locale) : '')) : journali(art, a)
        const r = await verarbeite(nachricht, name => req.headers[name], frage)
        return sende(res, r.status, r.json, cors)
      }

      // Chat-Fenster
      if (req.method === 'GET' && pfad === '/api/info')
        return sende(res, 200, { label: i.label, greeting: i.greeting, locales: i.locales, locale: i.locale, ki: i.ki, products: i.products }, cors)
      const bild = /^\/api\/image\/([^/]+)$/.exec(pfad)
      if (req.method === 'GET' && bild) {
        const r = await holen(basis + 'image/' + encodeURIComponent(decodeURIComponent(bild[1])) + (url.searchParams.get('gross') ? '?gross=true' : ''), { headers: kopf })
        if (r.status !== 200) return sende(res, r.status === 404 ? 404 : 502, { error: 'Bild nicht verfügbar.' }, cors)
        res.writeHead(200, { 'content-type': r.headers.get('content-type') ?? 'application/octet-stream', 'cache-control': 'public, max-age=86400', 'x-content-type-options': 'nosniff', ...cors })
        return res.end(Buffer.from(await r.arrayBuffer()))
      }
      const dok = /^\/api\/doc\/([^/]+)$/.exec(pfad)
      if (req.method === 'GET' && dok) {
        const r = await journali('doc/' + encodeURIComponent(decodeURIComponent(dok[1])))
        return sende(res, r.status, r.json, cors)
      }
      const produkt = /^\/api\/(product|variant)\/([^/]+)$/.exec(pfad)
      const wege = { '/api/ask': 'POST', '/api/compare': 'POST', '/api/event': 'POST', '/api/select': 'POST', '/api/docs': 'POST', '/api/vocabulary': 'GET' }
      if (!(req.method === 'GET' && produkt) && wege[pfad] !== req.method) return sende(res, 404, { error: 'Nicht gefunden.' }, cors)
      if (pfad === '/api/vocabulary') {
        const loc = url.searchParams.get('locale')
        const r = await journali('vocabulary' + (loc ? '?locale=' + encodeURIComponent(loc) : ''))
        return sende(res, r.status, r.json, cors)
      }
      const warten = zaehle(adresse(req), i.limits)
      if (warten) return sende(res, 429, { error: 'Zu viele Fragen in kurzer Zeit.' }, { ...cors, 'retry-after': String(warten) })
      if (produkt) {
        const loc = url.searchParams.get('locale')
        const r = await journali(produkt[1] + '/' + encodeURIComponent(decodeURIComponent(produkt[2])) + (loc ? '?locale=' + encodeURIComponent(loc) : ''))
        // geöffnet: das Produkt ist im Blick des Gesprächs — eine Frage danach („ist es wasserdicht?“) gilt ihm
        if (r.status === 200 && kennung(url.searchParams.get('gespraech'))) kern.merke(url.searchParams.get('gespraech'), { id: r.json?.id ?? decodeURIComponent(produkt[2]), name: r.json?.name ?? null })
        return sende(res, r.status, r.json, cors)
      }
      const b = await koerper(req)
      if (pfad === '/api/ask') {
        const schritt = b.schritt && typeof b.schritt === 'object' && !Array.isArray(b.schritt) ? b.schritt : null
        const antwort = await kern.antworte({ gespraech: kennung(b.gespraech), q: String(b.q ?? '').slice(0, 300), schritt, locale: typeof b.locale === 'string' ? b.locale.slice(0, 10) : null })
        return sende(res, 200, antwort, cors)
      }
      if (pfad === '/api/event') {
        if (kennung(b.gespraech) && typeof b.id === 'string' && b.id.length <= 80 && ['gemerkt'].includes(b.art)) kern.merke(b.gespraech, { id: b.id, name: typeof b.name === 'string' ? b.name.slice(0, 200) : null, art: b.art })
        return sende(res, 204, undefined, cors)
      }
      // die Schnittstelle Version 2, durchgereicht — ohne KI (sie kostet), die nur der Kern fragt
      const r = pfad === '/api/select' ? await journali('select', b)
        : pfad === '/api/docs' ? await journali('docs', b)
        : await journali('compare', { ids: Array.isArray(b.ids) ? b.ids.slice(0, 4) : [], locale: b.locale })
      return sende(res, r.status, r.json, cors)
    } catch (e) {
      if (e.status && e.status < 500 && e.json) return sende(res, e.status, e.json)   // eine Antwort von journali (Tagesgrenze, Fehler am Berater) geht durch
      const status = e.status ?? 502
      if (status >= 500) console.error(`advisor: ${req.method} ${pfad}: ${e.message}`)
      return sende(res, status, { error: status >= 500 ? 'journali ist nicht erreichbar.' : e.message })
    }
  }
}
