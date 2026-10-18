// Hilfe: der ?-Knopf in der Kopfzeile öffnet das Kapitel zur aktuellen Ansicht, die Übersicht aller Kapitel (/help,
// Inhalt aus help/<code>/) und die Links nach draussen — Website; Quelltext, Fragen und Fehlermeldungen auf GitHub
// (Organisation journalipim; kein eigenes Forum). journalipim.de und journalipim.com zeigen nur auf die Website.
// Das Docker-Image kommt, sobald der Bau-Workflow steht (ghcr.io/journalipim/journali).
// Eintrag: { label, icon, url, hint } — hint steht im Tooltip, label ist ein Name.
import { reactive } from 'vue'
import { t } from './i18n.js'
import { store } from './store.js'

/// Das Hilfefenster: offen und welches Kapitel. Es liegt über der Ansicht — wer nachliest, bleibt, wo er war.
/// abschnitt (18.10.2026): die Überschrift, zu der das Fenster springt — so öffnet der journali advisor einen Abschnitt
export const hilfe = reactive({ open: false, chapter: '', abschnitt: '' })
export function openHelp(chapter = '', abschnitt = '') { if (chapter) hilfe.chapter = chapter; hilfe.abschnitt = abschnitt; hilfe.open = true }
/// journali advisor (18.10.2026): der Assistent für die Bedienung — offen oder zu (components/JournaliAdvisor.vue)
export const advisor = reactive({ open: false })
export function openAdvisor() { advisor.open = true }
export function closeAdvisor() { advisor.open = false }
export function closeHelp() { hilfe.open = false }

export const HELP_LINKS = [
  { label: 'journali.de', icon: '⌂', url: 'https://journali.de', hint: 'Website: Produkt, Preise, Kontakt' },
  { label: 'GitHub', icon: '⌥', url: 'https://github.com/journalipim/journali', hint: 'Quelltext, Releases, README' },
  { label: 'Discussions', icon: '💬', url: 'https://github.com/journalipim/journali/discussions', hint: 'Fragen und Austausch' },
  { label: 'Issues', icon: '🐞', url: 'https://github.com/journalipim/journali/issues', hint: 'Fehler melden, Wünsche' },
]
// Impressum und Datenschutz (07.10.2026): im Hilfemenü, im Infofenster der Testversion und auf der Anmeldeseite der Demo
export const RECHTLICHES = [
  { get label() { return t('Impressum') }, icon: '§', url: 'https://journali.de/impressum/' },   // Bezeichnung in der Sprache der Oberfläche
  { get label() { return t('Datenschutz') }, icon: '§', url: 'https://journali.de/datenschutz/' },
]

/// Welches Kapitel zu welcher Ansicht gehört — der Pfad der Route, längster Treffer zuerst; sonst die Einführung
const CHAPTERS = [
  ['/tree', 'baum'], ['/table', 'werte-pflegen'], ['/pub', 'freigabe-und-publikation'], ['/model', 'modell'],
  ['/journal', 'was-journali-ist'], ['/import', 'import-und-export'], ['/export', 'import-und-export'],
  ['/p/table', 'import-und-export'], ['/p/json', 'import-und-export'], ['/p/ixp', 'import-und-export'], ['/p/solr', 'import-und-export'],
  ['/p/xport', 'import-und-export'], ['/p/configurator', 'konfigurator'], ['/media', 'medien'], ['/tasks', 'workflows'], ['/jobs', 'jobs'], ['/p/tasker', 'jobs'],
  ['/plugins', 'plugins'], ['/datasheet', 'plugins'], ['/analysis', 'plugins'], ['/translate', 'plugins'], ['/classification', 'plugins'],
  ['/tools', 'plugins'], ['/p/', 'plugins'], ['/settings', 'anwender-rollen-und-teams'], ['/login', 'erste-schritte'], ['/help', 'was-journali-ist'], ['/schnittstelle', 'schnittstelle'],
]
export function chapterFor(path) {
  const hit = CHAPTERS.filter(([p]) => (path ?? '').startsWith(p)).sort((a, b) => b[0].length - a[0].length)[0]
  return hit ? hit[1] : 'was-journali-ist'
}

/// Menüeinträge für menu.open(e, …): Kapitel zur Ansicht, alle Kapitel, dann die Links (neues Fenster, noopener).
/// Die Hilfe geht als Fenster auf, nicht als Ansicht — `zeig` nimmt den Kapitelnamen, leer heisst: das zuletzt gelesene.
export function helpItems(open = url => window.open(url, '_blank', 'noopener'), path = location.pathname, zeig = openHelp) {
  return [
    { label: t('? Hilfe zu dieser Ansicht'), icon: '?', action: () => zeig(chapterFor(path)) },
    // der Assistent (18.10.2026): Fragen zur Bedienung, beantwortet aus der Hilfe — im produktiven Betrieb nur hier, in der Demo auch oben
    { label: 'journali advisor', icon: '⌕', title: t('Fragen zur Bedienung, beantwortet aus der Hilfe'), action: () => openAdvisor() },
    { label: t('Alle Kapitel'), icon: '≡', action: () => zeig('') },
    // die Beschreibung der Schnittstelle, lesbar — nicht in der Demo (07.10.2026): dort ist sie gesperrt (Demo.Gesperrt)
    ...(store.demo ? [] : [{ label: t('{ } Schnittstelle (API)'), icon: '{}', action: () => open('/schnittstelle') }]),
    { sep: true },
    ...HELP_LINKS.map(l => ({ label: l.label, icon: l.icon, title: l.hint, action: () => open(l.url) })),
    { sep: true },
    ...RECHTLICHES.map(l => ({ label: l.label, icon: l.icon, action: () => open(l.url) })),
  ]
}
