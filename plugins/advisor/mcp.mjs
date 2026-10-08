// MCP-Server des Produktberaters (Streamable HTTP, docs/pflegestruktur.md 42). Drei Werkzeuge, alle nur lesend: Produkte suchen, ein Produkt
// lesen, Produkte vergleichen — dieselben Fragen, die das Chat-Fenster stellt, mit denselben Grenzen.
//
// Zwei Versionen der Spezifikation zugleich (08.10.2026):
//   2026-07-28 ohne Handshake — jede Anfrage nennt ihre Version im Kopf MCP-Protocol-Version und in params._meta, dazu Mcp-Method und
//              (bei tools/call) Mcp-Name; der Server prüft, dass Kopf und Rumpf übereinstimmen. server/discover sagt, was er kann.
//   2025-11-25 und älter mit initialize — der Server antwortet ohne Sitzung (kein Mcp-Session-Id), jede Anfrage steht für sich.
// Der Server hat keinen Zustand: keine Sitzung, kein Speicher der Fragen.

export const MODERN = ['2026-07-28']
export const LEGACY = ['2025-11-25', '2025-06-18', '2025-03-26']
export const SERVER_INFO = { name: 'journali-advisor', version: '1.0.0' }

const META = 'io.modelcontextprotocol/'

/// Die Werkzeuge mit ihrem Schema — die Beschreibungen lesen fremde Modelle, darum englisch
export const WERKZEUGE = [
  {
    name: 'search_products',
    title: 'Search products',
    description: 'Search the product catalogue of this shop. Returns the best matching products with key attributes, the total number of matches, and facets: attributes in which the matches differ, with their values and counts. Pass a facet value back in `filters` to narrow the result. An empty query lists all products.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What the customer is looking for, in their own words.', maxLength: 300 },
        filters: {
          type: 'array', maxItems: 10, description: 'Facet filters: attribute key and value; op "le" or "ge" for numeric limits (default: equals).',
          items: { type: 'object', properties: { attribute: { type: 'string' }, op: { type: 'string', enum: ['eq', 'le', 'ge'] }, value: { type: 'string' } }, required: ['attribute', 'value'] },
        },
        locale: { type: 'string', description: 'Language code such as "de" or "en".' },
        limit: { type: 'integer', minimum: 1, maximum: 20, description: 'Number of products to return (default 6).' },
      },
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'get_product',
    title: 'Get product',
    description: 'All published attributes of one product, its images and the variants that differ from each other. Use the id from search_products.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, locale: { type: 'string' } }, required: ['id'] },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'compare_products',
    title: 'Compare products',
    description: 'Two to four products side by side: one row per attribute, with a flag whether all values are the same.',
    inputSchema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 }, locale: { type: 'string' } }, required: ['ids'] },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
]

export const ANLEITUNG = 'Product advice for the products of one shop. Search first, then narrow by facets or compare. Answer only from the returned data; do not invent prices or availability.'

/// Ein Wert aus einem Kopf: Base64 in der Form =?base64?…?= wird entschlüsselt
export function kopfwert(v) {
  if (typeof v !== 'string') return v
  const m = /^=\?base64\?(.*)\?=$/.exec(v)
  return m ? Buffer.from(m[1], 'base64').toString('utf8') : v
}

const fehler = (id, code, message, data) => ({ jsonrpc: '2.0', ...(id === undefined ? {} : { id }), error: { code, message, ...(data === undefined ? {} : { data }) } })

/// Das Ergebnis eines Werkzeugs als Text — für Modelle, die structuredContent nicht lesen
export function alsText(name, r) {
  if (name === 'search_products') {
    const zeilen = [`${r.total} matching products.`]
    for (const [i, h] of (r.hits ?? []).entries()) {
      const keys = Object.values(h.keys ?? {}).join(', ')
      const werte = (h.values ?? []).map(v => `${v.label}: ${v.value}`).join('; ')
      zeilen.push(`${i + 1}. ${h.name}${keys ? ` (${keys})` : ''} [id ${h.id}]${werte ? ` — ${werte}` : ''}`)
    }
    if (r.facets?.length) {
      zeilen.push('Narrow by:')
      for (const f of r.facets)
        zeilen.push(f.type === 'range' ? `- ${f.label} [${f.key}]: ${f.min}–${f.max}${f.unit ? ' ' + f.unit : ''} (split at ${f.split})`
          : `- ${f.label} [${f.key}]: ${(f.values ?? []).map(v => `${v.label} = ${v.value} (${v.n})`).join(', ')}`)
    }
    return zeilen.join('\n')
  }
  if (name === 'get_product') {
    const zeilen = [`${r.name} [id ${r.id}]`, ...(r.values ?? []).map(v => `${v.label}: ${v.value}`)]
    if (r.variants?.length > 1) zeilen.push('Variants:', ...r.variants.map(v => `- ${v.name}: ${(v.values ?? []).map(x => `${x.label} ${x.value}`).join(', ')}`))
    return zeilen.join('\n')
  }
  const kopf = (r.products ?? []).map(p => p.name).join(' | ')
  return [kopf, ...(r.rows ?? []).map(z => `${z.label}: ${z.values.join(' | ')}${z.same ? ' (same)' : ''}`)].join('\n')
}

/// Ruft ein Werkzeug über die Fragen des Dienstes auf. `frage(pfad, body)` liefert { status, json } von journali.
async function werkzeug(name, args, frage) {
  const a = args && typeof args === 'object' ? args : {}
  let r
  if (name === 'search_products') r = await frage('ask', { q: String(a.query ?? ''), filter: Array.isArray(a.filters) ? a.filters : [], locale: a.locale, take: a.limit, ki: false })
  else if (name === 'get_product') { if (typeof a.id !== 'string' || !a.id) return { fehlt: 'id' }; r = await frage('product', { id: a.id, locale: a.locale }) }
  else if (name === 'compare_products') { if (!Array.isArray(a.ids)) return { fehlt: 'ids' }; r = await frage('compare', { ids: a.ids, locale: a.locale }) }
  else return { unbekannt: true }
  if (r.status !== 200) return { result: { content: [{ type: 'text', text: r.json?.error ?? `HTTP ${r.status}` }], isError: true } }
  return { result: { content: [{ type: 'text', text: alsText(name, r.json) }], structuredContent: r.json, isError: false } }
}

/**
 * Eine Nachricht an den MCP-Endpunkt. `kopf(name)` liest einen Kopf der Anfrage (klein geschrieben). Liefert { status, json } —
 * json fehlt bei 202 (Benachrichtigung).
 */
export async function verarbeite(nachricht, kopf, frage) {
  if (Array.isArray(nachricht) || !nachricht || typeof nachricht !== 'object' || nachricht.jsonrpc !== '2.0' || typeof nachricht.method !== 'string')
    return { status: 400, json: fehler(null, -32600, 'Invalid Request') }
  const { id, method } = nachricht
  const params = nachricht.params && typeof nachricht.params === 'object' ? nachricht.params : {}
  if (id === undefined || id === null) return { status: 202 }   // Benachrichtigung (initialized, cancelled): angenommen, keine Antwort

  const kopfVersion = kopf('mcp-protocol-version')
  const meta = params._meta ?? {}
  const metaVersion = meta[META + 'protocolVersion']
  const alle = [...MODERN, ...LEGACY]

  // Die ältere Form: initialize, danach Anfragen ohne _meta
  if (method === 'initialize') {
    const gewuenscht = params.protocolVersion
    return { status: 200, json: { jsonrpc: '2.0', id, result: {
      protocolVersion: LEGACY.includes(gewuenscht) ? gewuenscht : LEGACY[0],
      capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO, instructions: ANLEITUNG } } }
  }

  const modern = metaVersion !== undefined || MODERN.includes(kopfVersion)
  if (modern) {
    if (!kopfVersion) return { status: 400, json: fehler(id, -32020, 'Header mismatch: MCP-Protocol-Version header missing') }
    if (!alle.includes(kopfVersion)) return { status: 400, json: fehler(id, -32022, 'Unsupported protocol version', { supported: alle, requested: kopfVersion }) }
    if (metaVersion === undefined || meta[META + 'clientCapabilities'] === undefined)
      return { status: 400, json: fehler(id, -32602, 'Invalid params: _meta needs protocolVersion and clientCapabilities') }
    if (metaVersion !== kopfVersion) return { status: 400, json: fehler(id, -32020, `Header mismatch: MCP-Protocol-Version header value '${kopfVersion}' does not match body value '${metaVersion}'`) }
    if (kopf('mcp-method') !== method) return { status: 400, json: fehler(id, -32020, `Header mismatch: Mcp-Method header value '${kopf('mcp-method') ?? ''}' does not match body value '${method}'`) }
    if (method === 'tools/call' && kopfwert(kopf('mcp-name')) !== params.name)
      return { status: 400, json: fehler(id, -32020, `Header mismatch: Mcp-Name header does not match body value '${params.name}'`) }
  } else if (kopfVersion && !alle.includes(kopfVersion)) {
    return { status: 400, json: fehler(id, -32022, 'Unsupported protocol version', { supported: alle, requested: kopfVersion }) }
  }

  const ergebnis = r => ({ status: 200, json: { jsonrpc: '2.0', id, result: modern ? { resultType: 'complete', ...r, _meta: { [META + 'serverInfo']: SERVER_INFO } } : r } })
  switch (method) {
    case 'server/discover':
      if (!modern) break
      return ergebnis({ supportedVersions: alle, capabilities: { tools: {} }, instructions: ANLEITUNG })
    case 'ping':
      return ergebnis({})
    case 'tools/list':
      return ergebnis({ tools: WERKZEUGE })
    case 'tools/call': {
      const r = await werkzeug(params.name, params.arguments, frage)
      if (r.unbekannt) return { status: modern ? 400 : 200, json: fehler(id, -32602, `Unknown tool: ${params.name}`) }
      if (r.fehlt) return { status: modern ? 400 : 200, json: fehler(id, -32602, `Invalid params: ${r.fehlt} missing`) }
      return ergebnis(r.result)
    }
  }
  return { status: modern ? 404 : 200, json: fehler(id, -32601, `Method not found: ${method}`) }
}
