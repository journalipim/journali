// Rechenteil der Sicherung — hier steht, was sich ohne Server prüfen lässt (wie bei docs/core.mjs).
// Anlass: „Cannot access 'count' before initialization". Die Zählung rief sich selbst auf, bevor
// ihr Name gebunden war; jede Sicherung eines Baums mit Kindern schlug fehl — also jede echte Sicherung.

/// Knoten eines Teilbaums zählen: der Knoten selbst und alles darunter, beliebig tief.
export function knoten(n) {
  return 1 + (n?.children ?? []).reduce((s, k) => s + knoten(k), 0)
}

/// Welche Dateien dieser Wurzel wegdürfen, damit nur `keep` Stände bleiben — die ältesten zuerst.
/// Sortiert wird nach dem Namen, in dem der Zeitstempel steckt (…-2026-09-23-08-23-53.json.gz).
export function zuLoeschen(dateien, keep) {
  const sortiert = [...dateien].sort()
  return sortiert.slice(0, Math.max(0, sortiert.length - Math.max(1, keep)))
}
