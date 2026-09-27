// Ein Asset an einen Knoten: anlegen und zuordnen.
//
// Dieselbe Regel gilt im Baum (Datei auf eine Zeile ziehen) und in der Knotenansicht (Datei in das Medienband
// ziehen) — darum steht sie hier und nicht zweimal. Angelegt wird das Medium über POST /api/media; die Masse
// liest danach der Job probe, die Vorschauen rechnet derive. Beides wartet nicht auf den Anwender.
//
// Zugeordnet wird als Relation (18): der Typ kommt aus dem Modell, nicht aus dem Code — ein Bild wird „image“,
// alles andere „document“, sofern es diese Typen gibt.
import { api } from './api.js'
import { t as t_ } from './i18n.js'

/// Die Relationstypen, die auf ein Medium zeigen und von diesem Knotentyp ausgehen dürfen.
export function mediaTypesFor(model, role) {
  return (model?.relationTypes ?? []).filter(t => (t.to ?? []).includes('media') && (!t.from || t.from.includes(role)))
}

/// Ist das eine Datei, die als Asset gemeint ist? Bilder und Dokumente ja; Tabellen und JSON gehen in ihren Import.
const BILD = /\.(jpe?g|png|gif|webp|avif|bmp|tiff?|svg)$/i
/// Und was insgesamt als Asset gemeint ist: Bilder und Dokumente. Ein Asset geht nie in einen
/// Tabellen-Import, auch wenn ein Plugin die Endung kennt.
export const IST_ASSET = /\.(jpe?g|png|gif|webp|avif|bmp|tiff?|svg|pdf)$/i
/// Ein Dokument, dessen Tabellen der Leser (Plugin docs) finden kann — mit Strg abgelegt, werden sie ausgewertet (34 L).
export const IST_DOKUMENT = /\.(pdf|txt|html?|md|xml)$/i

/// Welcher Typ für dieses Bild oder Dokument: ein Bild wird ein Bild, alles andere ein Dokument.
function typeFor(bild, types) {
  if (bild && types.some(t => t.key === 'image')) return 'image'
  return (types.find(t => t.key === 'document') ?? types[0])?.key ?? null
}

/// Für eine Datei, die noch nicht im Speicher liegt — Mime, sonst die Endung.
export const typeForFile = (file, types) => typeFor((file.type || '').startsWith('image/') || BILD.test(file.name || ''), types)

/// Für ein Medium, das es schon gibt — die Bibliothek weiss, ob es ein Bild ist.
export const typeForMedium = (m, types) => typeFor(m.isImage === true || (m.mime || '').startsWith('image/'), types)

/**
 * Medien, die es schon gibt, einem Knoten zuordnen — eine Relation je Medium.
 *
 * „Gibt es schon“ ist kein Fehler: dann hängt das Medium eben schon dort. Gibt zurück, wie viele neu
 * zugeordnet wurden, und je Medium eine Meldung, wo es nicht ging.
 */
export async function attachMedia(medien, nodeId, types) {
  const ergebnis = { zugeordnet: 0, fehler: [] }
  for (const m of medien) {
    const type = typeForMedium(m, types)
    if (!type) { ergebnis.fehler.push(t_('Kein Relationstyp zu Medien für diesen Knotentyp')); break }
    try {
      await api.post('/api/relations', { type, from: nodeId, to: m.id })
      ergebnis.zugeordnet++
    } catch (e) { if (!e.message.includes('schon')) ergebnis.fehler.push(`${m.name ?? m.id}: ${e.message}`) }
  }
  return ergebnis
}

/**
 * Dateien als Assets anlegen und dem Knoten zuordnen.
 *
 * Gibt zurück, was geschah: `neu` (angelegt), `bekannt` (dieselbe Datei lag schon im Speicher — derselbe Hash
 * ist dasselbe Medium), `zugeordnet`, `fehler` (je Datei eine Meldung) und `medien` (Id und Name je angelegter
 * Datei — wer danach mehr mit ihnen tut, braucht die Ids). Eine Zuordnung, die es schon gibt,
 * ist kein Fehler: dann hängt das Medium eben schon dort.
 */
export async function attachFiles(files, nodeId, types) {
  const ergebnis = { neu: 0, bekannt: 0, zugeordnet: 0, fehler: [], medien: [] }
  for (const f of files) {
    const type = typeForFile(f, types)
    if (!type) { ergebnis.fehler.push(t_('Kein Relationstyp zu Medien für diesen Knotentyp')); break }
    try {
      const m = await api.upload('/api/media', f)
      m.existed ? ergebnis.bekannt++ : ergebnis.neu++
      ergebnis.medien.push({ id: m.id, name: f.name, existed: !!m.existed })
      try {
        await api.post('/api/relations', { type, from: nodeId, to: m.id })
        ergebnis.zugeordnet++
      } catch (e) { if (!e.message.includes('schon')) ergebnis.fehler.push(`${f.name}: ${e.message}`) }
    } catch (e) { ergebnis.fehler.push(`${f.name}: ${e.message}`) }
  }
  return ergebnis
}

/// Ein Satz für die Meldung: was angelegt und was zugeordnet wurde.
export function meldung(e) {
  const teile = []
  if (e.neu) teile.push(t_('{0} angelegt', [e.neu]))
  if (e.bekannt) teile.push(t_('{0} lagen schon im Speicher', [e.bekannt]))
  if (e.zugeordnet) teile.push(t_('{0} zugeordnet', [e.zugeordnet]))
  return teile.join(', ')
}
