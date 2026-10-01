// Plugin gpc: die GS1-Produktklassifikation (GPC), reine Funktionen ohne DOM — Browser und Prüfstand benutzen sie.
// Die Datei ist die JSON-Ausgabe der Veröffentlichung (oder das Zip, das sie enthält): ein Baum aus Segment, Family, Class und
// Brick; am Brick hängen Attribute, am Attribut die erlaubten Werte. Ein Brick ist die Klasse, die ein Produkt bekommt.
// Attribute und Werte haben in allen Bricks dieselben Codes und Titel, nur die Auswahl der Werte je Brick ist verschieden —
// darum steht im Journal jedes einmal (Wörterbuch) und am Brick nur die Codes.

export const LEVEL = { segment: 1, family: 2, class: 3, brick: 4, attribute: 5, value: 6 }

// ---- Zip: die Veröffentlichung kommt als Paket mit .xlsx, .xml und .json nebeneinander
/// Einträge eines Zip: Name, Grösse, Methode (0 = ungepackt, 8 = deflate) und die rohen Bytes. Entpackt wird draussen.
export function zipEntries(buf) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 70000); i--) if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  if (eocd < 0) throw new Error('kein Zip (Zentralverzeichnis fehlt)')
  const count = view.getUint16(eocd + 10, true); let p = view.getUint32(eocd + 16, true)
  const out = []
  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error('Zip: Eintrag beschädigt')
    const method = view.getUint16(p + 10, true), csize = view.getUint32(p + 20, true), usize = view.getUint32(p + 24, true)
    const nLen = view.getUint16(p + 28, true), eLen = view.getUint16(p + 30, true), cLen = view.getUint16(p + 32, true), lOff = view.getUint32(p + 42, true)
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nLen))
    const ln = view.getUint16(lOff + 26, true), le = view.getUint16(lOff + 28, true), start = lOff + 30 + ln + le
    out.push({ name, size: usize, method, data: buf.subarray(start, start + csize) })
    p += 46 + nLen + eLen + cLen
  }
  return out
}
export const isZip = buf => buf.length > 4 && new DataView(buf.buffer, buf.byteOffset, 4).getUint32(0, true) === 0x04034b50

/// Die Veröffentlichung im Zip: die grösste .json, die keine Änderungsliste (Delta) ist.
export function jsonInZip(buf) {
  const e = zipEntries(buf).filter(x => /\.json$/i.test(x.name) && !/^delta\b/i.test(x.name.split('/').pop())).sort((a, b) => b.size - a.size)[0]
  if (!e) throw new Error('Zip ohne .json der Veröffentlichung')
  return e
}

/// Im Browser entpacken (deflate-raw); ungepackte Einträge kommen unverändert zurück.
export async function inflateInBrowser(entry) {
  if (entry.method === 0) return entry.data
  if (entry.method !== 8) throw new Error(`Zip-Methode ${entry.method} nicht unterstützt`)
  const buf = await new Response(new Blob([entry.data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()
  return new Uint8Array(buf)
}

// ---- Die Veröffentlichung lesen
const lang = code => String(code ?? '').slice(0, 2).toLowerCase()
/// „20/5/2026“ → 2026-05-20
function isoDate(text) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(text ?? '').trim())
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : String(text ?? '')
}

/// Text der JSON-Datei → { meta, bricks, attributes, values, hierarchy }. Die Titel stehen je Sprache der Datei.
/// bricks: [{ code, path: [segment, family, class], t: { <sprache>: [titel, definition, ausschluss] }, a: [[attribut, [wert, …]], …] }]
export function parseGpc(text) {
  const doc = JSON.parse(text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text)
  if (!Array.isArray(doc?.Schema)) throw new Error('keine GPC-Datei (Schema fehlt)')
  const l = lang(doc.LanguageCode) || 'en'
  const bricks = [], attributes = {}, values = {}, hierarchy = {}
  const count = { segments: 0, families: 0, classes: 0, bricks: 0, attributes: 0, values: 0 }
  const walk = (n, path) => {
    const code = String(n.Code)
    if (n.Level === LEVEL.brick) {
      count.bricks++
      const a = []
      for (const at of n.Childs ?? []) {
        const ac = String(at.Code); attributes[ac] = { [l]: at.Title }
        const vs = []
        for (const v of at.Childs ?? []) { const vc = String(v.Code); values[vc] = { [l]: v.Title }; vs.push(vc); count.values++ }
        a.push([ac, vs]); count.attributes++
      }
      bricks.push({ code, path, t: { [l]: [n.Title, n.Definition ?? '', n.DefinitionExcludes ?? ''] }, a, active: n.Active !== false })
      return
    }
    if (n.Level === LEVEL.segment) count.segments++
    else if (n.Level === LEVEL.family) count.families++
    else if (n.Level === LEVEL.class) count.classes++
    hierarchy[code] = { [l]: n.Title }
    for (const c of n.Childs ?? []) walk(c, [...path, code])
  }
  for (const s of doc.Schema) walk(s, [])
  const date = isoDate(doc.DateUtc)
  return { meta: { language: l, date, version: date.slice(0, 7), counts: count }, bricks, attributes, values, hierarchy }
}

/// Die Titel einer Sprache: die gewünschte, sonst Englisch, sonst irgendeine.
export const titleOf = (names, locale) => names?.[locale] ?? names?.en ?? Object.values(names ?? {})[0] ?? ''
/// Der Name eines Bricks in einer Sprache; `t` hält je Sprache [titel, definition, ausschluss].
export const brickText = (brick, locale) => brick.t?.[locale] ?? brick.t?.en ?? Object.values(brick.t ?? {})[0] ?? ['', '', '']

/// Den Weg Segment › Family › Class als Text.
export const pathText = (brick, hierarchy, locale) => brick.path.map(c => titleOf(hierarchy?.[c], locale)).join(' › ')

// ---- Zusammenführen: eine weitere Sprache kommt zu den vorhandenen Titeln
const mergeNames = (a = {}, b = {}) => ({ ...a, ...b })
export function mergeDict(have, add) {
  const out = { attributes: { ...(have?.attributes ?? {}) }, values: { ...(have?.values ?? {}) }, hierarchy: { ...(have?.hierarchy ?? {}) } }
  for (const k of ['attributes', 'values', 'hierarchy']) for (const [c, n] of Object.entries(add[k] ?? {})) out[k][c] = mergeNames(out[k][c], n)
  return out
}
/// Die Bricks einer Veröffentlichung in die vorhandenen: Texte je Sprache dazu; Attribute und Werte bleiben die der neueren Version.
export function mergeBricks(have, add) {
  const byCode = new Map((have ?? []).map(b => [b.code, b]))
  return add.map(b => { const o = byCode.get(b.code); return o ? { ...b, t: mergeNames(o.t, b.t) } : b })
}

/// Die Veröffentlichung in Häppchen fürs Journal: je Segment ein Datensatz, dazu Wörterbuch und Kopf.
export function toRecords(rel, have = {}) {
  const bySeg = new Map()
  for (const b of rel.bricks) { const s = b.path[0]; if (!bySeg.has(s)) bySeg.set(s, []); bySeg.get(s).push(b) }
  const items = {}
  for (const [seg, list] of bySeg) items[`bricks:${seg}`] = { segment: seg, bricks: mergeBricks(have.bricks?.get?.(seg), list) }
  items.dict = mergeDict(have.dict, rel)
  const languages = [...new Set([...(have.release?.languages ?? []), rel.meta.language])]
  items.release = { key: rel.meta.version, version: rel.meta.version, date: rel.meta.date, languages, counts: rel.meta.counts }
  return items
}

// ---- Suche: Code, Titel und Weg
const norm = s => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
/// Bricks, die zu allen Wörtern der Eingabe passen (Code, Titel, Definition, Weg); die besten zuerst, höchstens `limit`.
export function searchBricks(bricks, hierarchy, query, locale = 'en', limit = 60) {
  const words = norm(query).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const out = []
  for (const b of bricks) {
    const [title, def] = brickText(b, locale)
    const name = norm(title), path = norm(pathText(b, hierarchy, locale)), defn = norm(def), code = b.code
    let score = 0
    for (const w of words) {
      if (code.startsWith(w)) score += 6
      else if (name.startsWith(w)) score += 5
      else if (name.includes(w)) score += 4
      else if (path.includes(w)) score += 2
      else if (defn.includes(w)) score += 1
      else { score = 0; break }
    }
    if (score > 0 && b.active !== false) out.push({ brick: b, score })
  }
  return out.sort((a, b) => b.score - a.score || a.brick.code.localeCompare(b.brick.code)).slice(0, limit).map(x => x.brick)
}

// ---- Für den Server (ClassificationApi): die neutrale Beschreibung
export const classAttr = () => 'class_gpc'
export const GROUP = 'class_gpc'   // die Gruppe des Systems; die einer Klasse heisst class_gpc_<brick>
/// Der Schlüssel des Attributs zu einem GPC-Attribut
export const attrKey = code => `gpc${code}`

export function systemSpec(settings = {}) {
  return {
    group: settings.group || GROUP, groupLabel: { de: 'GPC', en: 'GPC' }, classAttr: settings.classAttr || classAttr(),
    classLabel: { de: 'GPC-Klasse', en: 'GPC class' }, classAttrAlternatives: ['gpc_klasse', 'gpc_class_std'], ownPattern: '^gpc\\d+$', plugin: 'gpc',
  }
}
export function classSpec(brick, hierarchy, locale = 'en') {
  const names = {}
  for (const [lng, t] of Object.entries(brick.t ?? {})) names[lng] = t[0]
  return { code: brick.code, name: names, section: pathText(brick, hierarchy, locale) }
}
/// Die Attribute eines Bricks als Merkmale: jedes ein Listenattribut. `classesOf`: Attributcode → Codes aller Bricks, die es führen
/// (die Bedingung im Modell); ohne Angabe nur dieser Brick.
export function featureSpecs(brick, dict, classesOf = null) {
  return brick.a.map(([ac, vs]) => ({
    key: attrKey(ac), name: dict.attributes?.[ac] ?? { en: ac }, type: 'enum', classes: classesOf?.get(ac) ?? [brick.code], target: attrKey(ac),
    values: vs.map(v => ({ code: v, name: dict.values?.[v] ?? { en: v } })),
  }))
}
/// Attributcode → Codes der Bricks, die es führen
export function classesByAttribute(bricks) {
  const m = new Map()
  for (const b of bricks) for (const [ac] of b.a) { if (!m.has(ac)) m.set(ac, []); m.get(ac).push(b.code) }
  return m
}
