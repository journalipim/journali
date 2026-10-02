// Plugin empco: Prüfregeln in ✓ Datenqualität — jede Regel des Katalogs (catalog.js, Richtlinie (EU) 2024/825) prüft Text- und HTML-Attribute je Sprache; Befund nennt
// Attribut, Begriff und den Anker in der Richtlinie. Ohne KI. Die Ansicht prüft einen Teilbaum und lässt die Befunde beheben: Liste und Arbeitsfläche nebeneinander, Wert
// ändern, einen Begriff in vielen Feldern ersetzen, Fehlalarme als Ausnahme festhalten (Plugin-Daten im Journal). Der Stand bleibt beim Öffnen eines Knotens.
import View from './View.vue'
import { checks, catalog } from './checks.js'
import { t } from 'journali'

export default {
  views: [{ path: 'check', label: catalog.label, icon: catalog.icon, topic: 'analysis', hint: t('Greenwashing-Kritikalität von Produkttexten nach Richtlinie (EU) 2024/825 — Kriterienkatalog, Prüfung je Teilbaum, Regeln in der Datenqualität'), component: View }],
  nodeActions: [{ label: t('EmpCo prüfen'), icon: catalog.icon, topic: 'analysis', roles: ['group', 'product'], run(id, ctx) { localStorage.setItem('journali.empco.root', id); ctx.go?.('/p/empco/check') } }],
  checks,
  catalog,
}
