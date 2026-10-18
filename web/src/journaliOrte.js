// journali advisor, „Wo finde ich …?“ (18.10.2026, docs/todo-journali-advisor.md): eine Karte der Oberfläche — die Ansichten der Leiste, die
// Reiter der Einstellungen, die Ansichten der Plugins —, je Ort die Wörter, mit denen Anwender danach fragen, und das Recht, ohne das er nicht
// da ist. Die Antwort ist ein Link: ein Klick bringt hin. Was die Rolle nicht sehen darf, nennt der Assistent nicht.
import { store } from './store.js'
import { plugins } from './plugins.js'
import { TOPICS, entries } from './topics.js'
import { t } from './i18n.js'
import { L } from './i18n.js'
import { begriffe, woerter, trifftWort } from './journaliAdvisor.js'

// je Ort: wohin, wie er heisst, die Wörter, mit denen man danach fragt, und das Recht (fehlt es, ist er nicht da)
const FEST = [
  { to: '/tree', icon: '▣', label: () => t('Baum'), woerter: 'baum pflegebaum knoten produkt produktgruppe gruppe variante varianten werte pflegen tree node product variant' },
  { to: '/pub', icon: '⇶', label: () => t('Publikation'), woerter: 'publikation publikationsbaum rubrik kanal ausleitung ausleiten shop onlineshop publication channel' },
  { to: '/model', icon: '⊞', label: () => t('Modell'), woerter: 'modell attribut attribute attributgruppe attributgruppen werteliste liste einheit einheiten sicht sichten sprache sprachen kanal kanäle status relationstyp formel vorlage typ model attribute unit view' },
  { to: '/media', icon: '▨', label: () => t('Medien'), woerter: 'medien medium bild bilder foto fotos dokument dokumente pdf asset assets hochladen datei media image upload' },
  { to: '/tasks', icon: '⚑', label: () => t('Aufgaben'), woerter: 'aufgabe aufgaben workflow schritt übergang freigabe tasks' },
  { to: '/journal', icon: '≡', label: () => t('Journal'), woerter: 'journal historie verlauf änderung änderungen eintrag einträge wer wann history log' },
  { to: '/plugins', icon: '⬡', label: () => t('Plugins'), woerter: 'plugin plugins erweiterung erweiterungen einschalten ausschalten zertifikat', recht: 'plugins', demo: false },
  { to: '/settings', icon: '⚙', label: () => t('Einstellungen') + ' › ' + t('◐ Mein Account'), woerter: 'einstellungen konto account passwort kennwort darstellung dunkel hell sprache oberfläche token api-token rechner password settings' },
  { to: '/settings#teams', icon: '⚙', label: () => t('Einstellungen') + ' › ' + t('◍ Team'), woerter: 'team mitglieder ki-schlüssel schlüssel lizenz limits kontingent verbrauch token team members licence', auth: true },
  { to: '/settings#users', icon: '⚙', label: () => t('Einstellungen') + ' › ' + t('◈ IAM'), woerter: 'anwender benutzer nutzer rolle rollen recht rechte konto konten iam users roles rights', recht: 'users' },
  { to: '/settings#workflows', icon: '⚙', label: () => t('Einstellungen') + ' › ' + t('⚑ Workflows'), woerter: 'workflow workflows zustand zustände übergang übergänge freigabeprozess', recht: 'model' },
  { to: '/settings#storage', icon: '⚙', label: () => t('Einstellungen') + ' › ' + t('▨ Storage'), woerter: 'storage speicher speicherort ablage s3 dateisystem object', recht: 'storage' },
  { to: '/settings#assets', icon: '⚙', label: () => t('Einstellungen') + ' › ' + t('▩ Assets'), woerter: 'vorschau vorschauen ableitung ableitungen preset presets thumbnail kachel', recht: ['model', 'storage'] },
  { to: '/settings#mail', icon: '⚙', label: () => t('Einstellungen') + ' › ' + t('✉ Mail'), woerter: 'mail e-mail email smtp mailserver', recht: 'users' },
  { to: '/settings#backup', icon: '⚙', label: () => t('Einstellungen') + ' › ⇅ B&R', woerter: 'sicherung sichern backup wiederherstellen wiederherstellung restore', recht: 'users' },
]
// die Themen der Leiste: Import, Export, Datenblatt … — mit Wörtern
const THEMEN = {
  import: 'import importieren einlesen hochladen csv excel json tabelle', export: 'export exportieren ausleiten csv excel bmecat json tabelle',
  datasheet: 'datenblatt datenblätter pdf druck', analysis: 'datenanalyse datenqualität qualität prüfung prüfungen prüfen analyse vollständigkeit fehler',
  translate: 'übersetzung übersetzungen übersetzen sprache sprachen xliff', classification: 'klassifikation klassifizieren etim gpc eclass klasse klassen',
  tools: 'werkzeuge werkzeug skript skripte', jobs: 'job jobs zeitplan automatisch regelmässig nachts',
}

/// Darf diese Rolle den Ort sehen? Ohne Anwender alles (store.can), Team nur mit Anwendern, in der Demo ohne ⬡ Plugins
function sichtbar(o) {
  if (o.demo === false && store.demo) return false
  if (o.auth && !store.auth?.enabled) return false
  const r = [].concat(o.recht ?? [])
  return !r.length || r.some(x => store.can(x))
}

/// Alle Orte, die diese Rolle sieht: { to, titel, woerter } — dazu die Themen der Leiste mit Einträgen und die Ansichten der Plugins
export function orte() {
  const aus = FEST.filter(sichtbar).map(o => ({ to: o.to, titel: `${o.icon} ${o.label()}`, woerter: o.woerter }))
  const e = entries.value ?? {}
  for (const th of TOPICS) {
    const drin = e[th.key] ?? []
    if (!drin.length) continue
    aus.push({ to: th.to, titel: `${th.icon} ${th.label}`, woerter: `${THEMEN[th.key] ?? ''} ${drin.map(x => x.label).join(' ')}` })
    for (const v of drin) aus.push({ to: v.to, titel: `${th.icon} ${th.label} › ${v.label}`, woerter: `${v.label} ${L(plugins.list.find(p => p.key === v.plugin)?.manifest?.label) ?? ''}` })
  }
  return aus
}

/// Die Orte zu einer Frage, die besten zuerst — höchstens zwei. Zählt nur, was das Wort selbst trifft (ein Verb, das nur mit seiner Vorsilbe
/// trifft, sagt nichts über den Ort: bei „Wie lege ich ein Attribut an?“ geht es um ⊞ Modell, nicht um ▣ Baum, wo man auch anlegt)
export function findeOrte(q, liste = orte(), n = 2) {
  const bs = begriffe(q)
  if (!bs.length) return []
  const bewertet = liste.map((o, i) => {
    const titel = woerter(o.titel), w = woerter(o.woerter)
    let punkte = 0
    for (const b of bs) punkte += titel.some(x => trifftWort(b, x)) ? 2 : w.some(x => trifftWort(b, x)) ? 1 : 0
    return { o, punkte, i }
  }).filter(x => x.punkte > 0)
  if (!bewertet.length) return []
  bewertet.sort((x, y) => y.punkte - x.punkte || x.i - y.i)
  return bewertet.filter(x => x.punkte >= bewertet[0].punkte).slice(0, n).map(x => x.o)
}
