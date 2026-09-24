// Hilfe-Links für den ?-Knopf in der Kopfzeile (Taloan, 24.09.2026: „wenn man in die Top-Zeile einen Hilfe-Button einbaut,
// wäre das schon mal was — dort kann man dann auch verschiedene URLs hinterlegen“). Website; Quelltext, Fragen und
// Fehlermeldungen auf GitHub (Organisation journalipim, seit 24.09.2026 — kein eigenes Forum: keine Nutzungsbedingungen,
// keine Moderation). journalipim.de und journalipim.com zeigen nur auf die Website. Das Docker-Image kommt, sobald der
// Bau-Workflow steht (ghcr.io/journalipim/journali).
// Eintrag: { label, icon, url, hint } — hint steht im Tooltip, label ist ein Name, kein Satz.
export const HELP_LINKS = [
  { label: 'journali.de', icon: '⌂', url: 'https://journali.de', hint: 'Website: Produkt, Preise, Kontakt' },
  { label: 'GitHub', icon: '⌥', url: 'https://github.com/journalipim/journali', hint: 'Quelltext, Releases, README' },
  { label: 'Discussions', icon: '💬', url: 'https://github.com/journalipim/journali/discussions', hint: 'Fragen und Austausch' },
  { label: 'Issues', icon: '🐞', url: 'https://github.com/journalipim/journali/issues', hint: 'Fehler melden, Wünsche' },
]

/// Menüeinträge für menu.open(e, …): jeder Link öffnet ein neues Fenster ohne Rückgriff auf unseres (noopener)
export function helpItems(open = url => window.open(url, '_blank', 'noopener')) {
  return HELP_LINKS.map(l => ({ label: l.label, icon: l.icon, title: l.hint, action: () => open(l.url) }))
}
