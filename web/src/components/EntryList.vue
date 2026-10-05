<script setup>
// Einträge als dichte Zeilen: Nummer, Zeit, Urheber, [Strom], Typ, Inhalt.
// Stapel: aufeinanderfolgende Einträge derselben Aktion (batch) stehen als EIN Block — eine Kopfzeile
// mit Anzahl, Urheber, Zeit, aufklappbar, mit ↶ Rückgängig für die ganze Aktion; Mouseover zeigt, was der Schritt täte.
import { reactive, ref, computed } from 'vue'
import { when, describe, api } from '../api.js'
import { store } from '../store.js'
import { tree } from '../tree.js'
import { restoreModel, canRestoreModel, mayRestore } from '../modelRestore.js'
import { t } from '../i18n.js'
const props = defineProps({ entries: Array, showStream: { type: Boolean, default: false } })
// Art des Eintrags: ein Symbol je Art, Tooltip nennt sie ausgeschrieben; „zählt“ ist Datenpflege und Ausleitung — in der Startphase zählt nichts,
// dann steht weder „· zählt“ da noch eine Hervorhebung (05.10.2026)
const KINDS = { model: ['◫', t('Datenmodellierung')], structure: ['▤', t('Struktur')], data: ['✎', t('Datenpflege · zählt')], publish: ['⇶', t('Ausleitung · zählt')], reference: ['⇩', t('Referenzdaten')], setup: ['⚙', t('Einrichtung')], ops: ['⏱', t('Betrieb')] }
const OHNE_ZAEHLEN = { data: t('Datenpflege'), publish: t('Ausleitung') }
const kindIcon = k => KINDS[k]?.[0] ?? '·'
const kindText = k => (store.startphase && OHNE_ZAEHLEN[k]) || (KINDS[k]?.[1] ?? (k ?? 'unbekannt'))
const counts = k => !store.startphase && (k === 'data' || k === 'publish')

const open = reactive({})   // batch → aufgeklappt
const rows = computed(() => {
  const out = []
  let i = 0
  while (i < props.entries.length) {
    const e = props.entries[i]
    if (!e.batch) { out.push({ kind: 'one', e }); i++; continue }
    let j = i
    while (j < props.entries.length && props.entries[j].batch === e.batch) j++
    const group = props.entries.slice(i, j)
    if (group.length === 1) out.push({ kind: 'one', e })
    else {
      const types = {}; for (const g of group) types[g.type] = (types[g.type] ?? 0) + 1
      out.push({ kind: 'head', batch: e.batch, group, first: group[group.length - 1], last: group[0], types })
      if (open[e.batch]) for (const g of group) out.push({ kind: 'one', e: g, inGroup: true })
    }
    i = j
  }
  return out
})
const typeText = types => Object.entries(types).map(([t, n]) => `${n} ${t}`).join(' · ')

// Mouseover: was würde Rückgängig tun? Vorschau je Stapel, einmal geladen
const previews = reactive({})
async function preview(batch, stream) {
  const k = batch ?? stream; if (previews[k]) return
  if (!batch) { previews[k] = t('stellt 1 Knoten wieder her: {0}', [stream]); return }
  try {
    const p = await api.get(`/api/batches/${encodeURIComponent(batch)}/preview?take=15`)   // der Tooltip zeigt 15 — der Server rechnet nur diese
    const lines = p.steps.slice(0, 15).map(s => `${s.kind === 'NodeRestored' ? '↩' : '←'} ${labelOf(s.stream)}: ${s.what}`)
    previews[k] = t('Rückgängig (Stapel {0}, {1}): {2} Schritte', [batch, p.actor, p.more ? `${p.steps.length}+ (${p.entries} Einträge)` : p.steps.length]) + (p.skipped.length ? t(', {0} nicht rückgängig-fähig', [p.skipped.length]) : '') + '\n' + lines.join('\n') + (p.steps.length > 15 ? `\n… und ${p.steps.length - 15} weitere` : '')
  } catch (err) { previews[k] = err.message }
}
const labelOf = id => tree.byId.get(id)?.label ?? id
// Modell-Zurückziehen rückgängig: gemeinsamer Code (modelRestore.js), auch im Modell-Listenkopf (↶)
async function restoreEntry(e) { try { const k = await restoreModel(e); store.toast(`↶ ${k} wiederhergestellt`, 'ok') } catch (err) { store.toast(err.message) } }
</script>

<template>
  <table class="grid">
    <thead>
      <tr>
        <th class="num">#</th>
        <th>{{ $t("Zeit") }}</th>
        <th>👤</th>
        <th v-if="showStream">▦</th>
        <th :title="$t('Art der Arbeit')">◧</th>
        <th>{{ $t("Typ") }}</th>
        <th>{{ $t("Inhalt") }}</th>
        <th :title="$t('Stapel')">⧉</th>
      </tr>
    </thead>
    <tbody>
      <template v-for="r in rows" :key="r.kind === 'head' ? 'b' + r.batch : r.e.number">
        <tr v-if="r.kind === 'head'" class="row head" @click="open[r.batch] = !open[r.batch]" :title="$t('Stapel {0}: {1} Einträge aufklappen', [r.batch, r.group.length])">
          <td class="num mono muted">{{ r.first.number }}–{{ r.last.number }}</td>
          <td class="mono muted">{{ when(r.last.at) }}</td>
          <td>{{ r.last.actor }}</td>
          <td v-if="showStream" class="muted">{{ $t("{0} Ströme", [new Set(r.group.map(g => g.stream)).size]) }}</td>
          <td class="muted" :title="[...new Set(r.group.map(g => kindText(g.kind)))].join(' · ')">{{ [...new Set(r.group.map(g => kindIcon(g.kind)))].join('') }}</td>
          <td class="muted">{{ $t("{0} ⧉ Stapel", [open[r.batch] ? '▾' : '▸']) }}</td>
          <td><b>{{ $t("{0} Einträge", [r.group.length]) }}</b> <span class="muted">· {{ typeText(r.types) }}</span>
            <button class="x" style="margin-left:8px" @click.stop="undo(r.batch)" @mouseenter="preview(r.batch)" :title="previews[r.batch] ?? $t('lade Vorschau …')">{{ $t("↶ Rückgängig") }}</button>
          </td>
          <td class="mono muted" :title="$t('Stapel') + ' ' + r.batch">{{ r.batch.slice(2, 6) }}</td>
        </tr>
        <tr v-else class="row" :class="{ sub: r.inGroup }">
          <td class="num">{{ r.e.number }}</td>
          <td class="mono muted">{{ when(r.e.at) }}</td>
          <td>{{ r.e.actor }}</td>
          <td v-if="showStream"><router-link v-if="!r.e.stream.includes(':')" :to="`/tree/${r.e.stream}`" class="mono link">{{ r.e.stream }}</router-link><router-link v-else to="/model" class="mono link muted">{{ r.e.stream }}</router-link></td>
          <td class="kind" :class="{ counts: counts(r.e.kind) }" :title="kindText(r.e.kind)">{{ kindIcon(r.e.kind) }}</td>
          <td class="muted">{{ r.e.type }}</td>
          <td :class="{ pos: r.e.type.endsWith('Granted') || r.e.type.endsWith('Assigned') || r.e.type.endsWith('Created'), neg: r.e.type.endsWith('Revoked') || r.e.type.endsWith('Removed') || r.e.type.endsWith('Retired') }">
            {{ describe(r.e) }}
            <button v-if="r.e.type === 'NodeRetired' && !r.inGroup && !tree.byId.has(r.e.stream)" class="x" style="margin-left:8px" @click="undo(r.e.batch, r.e.stream)" @mouseenter="preview(r.e.batch, r.e.stream)" :title="previews[r.e.batch ?? r.e.stream] ?? $t('lade Vorschau …')">{{ $t("↶ Wiederherstellen") }}</button>
            <button v-else-if="!r.inGroup && canRestoreModel(r.e) && mayRestore(r.e)" class="x" style="margin-left:8px" @click="restoreEntry(r.e)" :title="$t('die letzte Definition vor dem Zurückziehen noch einmal schreiben')">{{ $t("↶ Wiederherstellen") }}</button>
          </td>
          <td class="mono muted" :title="r.e.batch ? $t('Stapel') + ' ' + r.e.batch : ''">{{ r.e.batch ? r.e.batch.slice(2, 6) : '' }}</td>
        </tr>
      </template>
    </tbody>
  </table>
  <div v-if="!entries.length" class="empty">{{ $t("Keine Einträge") }}</div>
</template>

<style scoped>
.kind { text-align: center; opacity: .5; }
.kind.counts { opacity: 1; color: var(--accent); }
.link:hover { color: var(--accent); text-decoration: underline; }
.row.head { background: var(--accent-soft); cursor: pointer; }
.row.sub td:first-child { padding-left: 18px; }
</style>
