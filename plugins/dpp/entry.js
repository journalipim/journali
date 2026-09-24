// Plugin dpp: Prüfkatalog (catalog.js) auf der gemeinsamen Prüfmaschine der Oberfläche (ctx.compliance).
// Ansicht unter ✓ Datenanalyse; Knoten-Aktion prüft den Teilbaum des Knotens. Autark regelbasiert; mit KI-Schlüssel (Einstellungen) auch Vorschläge der KI.
import catalog from './catalog.js'
const t = (k, p) => globalThis.journali?.t ? globalThis.journali.t(k, p) : String(k).replace(/\{(\w+)\}/g, (m, i) => p?.[i] ?? m)   // Oberflächensprache: spät gebunden, im Test ohne Fenster ladbar
export default {
  views: [{ path: 'check', label: catalog.label, icon: catalog.icon, topic: 'analysis', mount: (root, ctx) => ctx.compliance.mount(root, ctx, catalog) }],
  nodeActions: [{ label: t('DPP prüfen'), icon: catalog.icon, topic: 'analysis', roles: ['group', 'product'], run(nodeId, ctx) { localStorage.setItem(`journali.cmp.${catalog.key}.root`, nodeId); ctx.go?.('/p/dpp/check?run=1') } }],
  catalog,
}
