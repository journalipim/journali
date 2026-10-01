// Hilfe: der ?-Knopf in der Kopfzeile öffnet das Kapitel zur aktuellen Ansicht, die Übersicht aller Kapitel (/help,
// Inhalt aus help/<code>/) und die Links nach draussen — Website; Quelltext, Fragen und Fehlermeldungen auf GitHub
// (Organisation journalipim; kein eigenes Forum). journalipim.de und journalipim.com zeigen nur auf die Website.
// Das Docker-Image kommt, sobald der Bau-Workflow steht (ghcr.io/journalipim/journali).
// Eintrag: { label, icon, url, hint } — hint steht im Tooltip, label ist ein Name.
import { reactive } from 'vue'
import { t } from './i18n.js'

/// Das Hilfefenster: offen und welches Kapitel. Es liegt über der Ansicht — wer nachliest, bleibt, wo er war.
export const hilfe = reactive({ open: false, chapter: '' })
export function openHelp(chapter = '') { if (chapter) hilfe.chapter = chapter; hilfe.open = true }
export function closeHelp() { hilfe.open = false }

export const HELP_LINKS = [
  { label: 'journali.de', icon: '⌂', url: 'https://journali.de', hint: 'Website: Produkt, Preise, Kontakt' },
  { label: 'GitHub', icon: '⌥', url: 'https://github.com/journalipim/journali', hint: 'Quelltext, Releases, README' },
  { label: 'Discussions', icon: '💬', url: 'https://github.com/journalipim/journali/discussions', hint: 'Fragen und Austausch' },
  { label: 'Issues', icon: '🐞', url: 'https://github.com/journalipim/journali/issues', hint: 'Fehler melden, Wünsche' },
]

/// Welches Kapitel zu welcher Ansicht gehört — der Pfad der Route, längster Treffer zuerst; sonst die Einführung
const CHAPTERS = [
  ['/tree', 'baum'], ['/table', 'werte-pflegen'], ['/pub', 'freigabe-und-publikation'], ['/model', 'modell'],
  ['/journal', 'was-journali-ist'], ['/import', 'import-und-export'], ['/export', 'import-und-export'],
  ['/p/table', 'import-und-export'], ['/p/json', 'import-und-export'], ['/p/ixp', 'import-und-export'], ['/p/solr', 'import-und-export'],
  ['/p/xport', 'import-und-export'], ['/media', 'medien'], ['/tasks', 'workflows'], ['/jobs', 'jobs'], ['/p/tasker', 'jobs'],
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
    { label: t('Alle Kapitel'), icon: '≡', action: () => zeig('') },
    { label: t('{ } Schnittstelle (API)'), icon: '{}', action: () => open('/schnittstelle') },   // die Beschreibung der Schnittstelle, lesbar
    { sep: true },
    ...HELP_LINKS.map(l => ({ label: l.label, icon: l.icon, title: l.hint, action: () => open(l.url) })),
  ]
}
