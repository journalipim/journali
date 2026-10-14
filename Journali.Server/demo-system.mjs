// Demo (07.10.2026): die Systemobjekte der Plugins als JSON — der Server der Demo legt sie beim Einrichten an. In der Demo richtet die
// Oberfläche keine Plugins ein: der Anwender demo darf das Modell nicht ändern, und jeder Besucher bekäme sonst die Rückfragen.
// Die Regeln sind dieselben wie beim Einschalten in der Oberfläche: compliance.js (setup, createAttributes, ensureUnit) für dpp und ppwr,
// install() von geo und gpc. Aufruf: node demo-system.mjs <plugins-Verzeichnis> [<Attribute des Modells als JSON-Datei>] → eine Zeile JSON auf stdout.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const dir = process.argv[2]
// die Attribute, die es schon gibt: [{ key, label, type }] — ein Datenpunkt mit gleichem Namen nimmt das vorhandene Attribut, wie setup() in compliance.js
const vorhanden = process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3], 'utf8')) : []
const lade = async datei => { try { return await import(pathToFileURL(path.join(dir, datei)).href) } catch { return null } }

// wie compliance-core.js: Text → Vorlage, Zahl → Formel; Datum, Ja/Nein und Liste bleiben typisiert
const berechneterTyp = item => (item.type ?? 'text') === 'text' ? 'template' : item.type === 'decimal' || item.type === 'integer' ? 'formula' : null
// wie compliance.js (ensureUnit): bekannte Einheiten mit Grösse und Faktor, sonst die Einheit als eigene Grösse
const BEKANNT = {
  '°C': ['temperature', 1, 0], '°F': ['temperature', 5 / 9, -160 / 9], 'K': ['temperature', 1, -273.15],
  '%': ['percent', 1], 'kg': ['mass', 1], 'g': ['mass', 0.001], 'mg': ['mass', 0.000001], 't': ['mass', 1000],
  'mm': ['length', 0.001], 'cm': ['length', 0.01], 'm': ['length', 1], 'l': ['volume', 1], 'ml': ['volume', 0.001],
  'kWh': ['energy', 1], 'Wh': ['energy', 0.001], 'W': ['power', 1], 'V': ['voltage', 1], 'A': ['current', 1],
  'mg/kg': ['concentration', 1], 'ppm': ['concentration', 1], 'kg CO₂e': ['ghg', 1],
  'h': ['time', 1], 'a': ['time', 8766], 'Jahre': ['time', 8766],
}
// wie mapper.js (norm) und compliance.js (sameKind)
const norm = s => String(s ?? '').toLowerCase().trim().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
const sameKind = (want, have) => want === have || (want === 'decimal' && have === 'integer') || (want === 'text' && ['text', 'html', 'enum'].includes(have)) || (want === 'enum' && have === 'text')
// Das vorhandene Attribut zu einem Datenpunkt: Schlüssel oder Synonym gleich dem Schlüssel oder einer Bezeichnung, und die Art passt. Nur gleiche
// Namen — die Oberfläche nimmt auch ähnliche ab 80 %, aber die bestätigt dort ein Anwender; hier sieht es niemand (14.10.2026: vorher legte die
// Demo für jeden Datenpunkt ein eigenes Attribut an, und Gewicht (kg) zeigte auf eine Formel ohne Ausdruck, obwohl weight in kg gepflegt war).
const gleichNamig = it => {
  const gesucht = new Set([it.key, ...(it.synonyms ?? [])].map(norm))
  return vorhanden.find(a => [a.key, ...Object.values(a.label ?? {})].map(norm).some(n => gesucht.has(n)) && sameKind(it.type ?? 'text', a.type))
}
const einheit = sym => {
  const key = sym.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '').slice(0, 8) || 'x'
  const [quantity, factor, offset = 0] = BEKANNT[sym] ?? [sym, 1]
  return { symbol: sym, key, label: { de: sym, en: sym }, quantity, factor, offset }
}

const out = []
for (const key of ['dpp', 'ppwr']) {
  const cat = (await lade(`${key}/catalog.js`))?.default
  if (!cat) continue
  const attributes = [], units = [], mapping = {}
  for (const it of cat.groups.flatMap(g => g.items)) {
    const da = it.to === undefined ? gleichNamig(it) : null
    if (da) { mapping[it.key] = { to: da.key, why: 'gleicher Name', sure: true }; continue }
    const k = (cat.prefix ?? '') + it.key.replace(/[^a-z0-9_]/g, '_')
    if (it.unit) units.push(einheit(it.unit))
    attributes.push({
      key: k, label: { de: it.label, en: it.labelEn ?? it.label }, type: berechneterTyp(it) ?? (it.type === 'enum' && !it.values ? 'text' : it.type),
      group: cat.groupKey, levels: it.roles?.length ? it.roles : null, unit: it.unit ?? null, axes: it.perLocale ? ['locale'] : [],
      inheritable: it.inheritable !== false, required: it.level === 'must' && it.requiredChannels ? it.requiredChannels : null,
    })
    mapping[it.key] = { to: k, why: 'angelegt', sure: true }
  }
  out.push({ plugin: key, group: { key: cat.groupKey, label: { de: cat.groupLabel ?? cat.label, en: cat.groupLabel ?? cat.label } }, units, attributes, data: { mapping }, attach: false })
}
const geo = (await lade('geo/entry.js'))?.SYSTEM
if (geo) out.push({
  plugin: 'geo', group: { key: geo.group, label: geo.label }, units: [],
  // vererbbar wie in install() von geo: die Texte stehen am Produkt (Demo.GeoTexte) und gelten für seine Varianten
  attributes: geo.attributes.map(([, key, label]) => ({ key, label, type: 'text', group: geo.group, axes: ['locale'], inheritable: true })),
  data: { targets: geo.targets }, attach: true,
})
const gpc = await lade('gpc/core.mjs')
if (gpc?.systemSpec) out.push({ plugin: 'gpc', ensure: gpc.systemSpec({}), attach: true })
process.stdout.write(JSON.stringify(out) + '\n')
