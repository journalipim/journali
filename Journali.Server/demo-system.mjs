// Demo (07.10.2026): die Systemobjekte der Plugins als JSON — der Server der Demo legt sie beim Einrichten an. In der Demo richtet die
// Oberfläche keine Plugins ein: der Anwender demo darf das Modell nicht ändern, und jeder Besucher bekäme sonst die Rückfragen.
// Die Regeln sind dieselben wie beim Einschalten in der Oberfläche: compliance.js (setup, createAttributes, ensureUnit) für dpp und ppwr,
// install() von geo und gpc. Aufruf: node demo-system.mjs <plugins-Verzeichnis> → eine Zeile JSON auf stdout.
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const dir = process.argv[2]
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
    const k = (cat.prefix ?? '') + it.key.replace(/[^a-z0-9_]/g, '_')
    if (it.unit) units.push(einheit(it.unit))
    attributes.push({
      key: k, label: { de: it.label, en: it.labelEn ?? it.label }, type: berechneterTyp(it) ?? (it.type === 'enum' && !it.values ? 'text' : it.type),
      group: cat.groupKey, levels: it.roles?.length ? it.roles : null, unit: it.unit ?? null, axes: it.perLocale ? ['locale'] : [],
      inheritable: !!it.inheritable, required: it.level === 'must' && it.requiredChannels ? it.requiredChannels : null,
    })
    mapping[it.key] = { to: k, why: 'angelegt', sure: true }
  }
  out.push({ plugin: key, group: { key: cat.groupKey, label: { de: cat.groupLabel ?? cat.label, en: cat.groupLabel ?? cat.label } }, units, attributes, data: { mapping }, attach: false })
}
const geo = (await lade('geo/entry.js'))?.SYSTEM
if (geo) out.push({
  plugin: 'geo', group: { key: geo.group, label: geo.label }, units: [],
  attributes: geo.attributes.map(([, key, label]) => ({ key, label, type: 'text', group: geo.group, axes: ['locale'] })),
  data: { targets: geo.targets }, attach: true,
})
const gpc = await lade('gpc/core.mjs')
if (gpc?.systemSpec) out.push({ plugin: 'gpc', ensure: gpc.systemSpec({}), attach: true })
process.stdout.write(JSON.stringify(out) + '\n')
