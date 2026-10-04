// Vorschaubilder im Browser rechnen (04.10.2026): nur, wenn der Server keine hat (weder eigene noch eine Ableitung des Jobs derive), nur bei
// Bildern bis GROESSE Bytes und immer nur eins zur Zeit. Vorher dekodierte jede sichtbare Kachel ihr Original gleichzeitig — nach einem
// Massenimport 30 Bilder zu 50 Megapixeln, rund 6 GB.

export const GROESSE = 8 * 1024 * 1024

/// Darf der Browser die Vorschau dieses Mediums aus dem Original rechnen? medium = { mime, bytes } aus /api/media/{id}
export const darfRechnen = medium => !!medium && String(medium.mime ?? '').startsWith('image/') && Number(medium.bytes) > 0 && Number(medium.bytes) <= GROESSE

let kette = Promise.resolve()
/// Eins nach dem anderen: arbeit läuft erst, wenn die vorige fertig ist (auch wenn sie scheiterte)
export function einzeln(arbeit) {
  const lauf = kette.then(arbeit, arbeit)
  kette = lauf.catch(() => {})
  return lauf
}
