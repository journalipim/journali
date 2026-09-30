<script setup>
// Das Band „GPC“ in der Knotenansicht, wie das von ETIM: die Klasse, die hier gilt (eigen oder geerbt), ihre Attribute, und die Knöpfe —
// Klasse wählen, Klasse entfernen, die Gruppen anhängen, wo sie nicht gelten. Bedient wird am Knoten, nicht in einer eigenen Ansicht.
// Jede Klasse hat ihre Attributgruppe (sie heisst wie die Klasse); die Gruppe des Systems trägt nur das Klassenattribut.
import { ref, computed, onMounted, watch } from 'vue'
import { api, store, tree, dialog, t as t_ } from 'journali'
import { klasseAm, gruppeGilt, schluessel, klassenGruppe } from './klasse.js'
import { oeffneKlasse } from './modal.js'

const props = defineProps({ nodeId: String, settings: Object })
const emit = defineEmits(['kopf', 'geaendert'])
const zustand = ref(null)   // { code, geerbt, von, node, systemGilt, klasseGilt, klasseExistiert }
const fehler = ref('')
const schl = computed(() => schluessel(props.settings))
const locale = computed(() => store.model?.masterLocale ?? 'de')
const gruppeDerKlasse = computed(() => zustand.value?.code ? klassenGruppe(schl.value.group, zustand.value.code) : null)

/// Bezeichnung der Klasse aus der Werteliste des Modells — das Band braucht die Veröffentlichung dafür nicht
const klassenName = code => {
  const l = (store.model?.lists ?? []).find(x => x.key === schl.value.classAttr)
  const v = (l?.values ?? []).find(x => x.value === code)
  const name = v?.label?.[locale.value] ?? v?.label?.en ?? Object.values(v?.label ?? {})[0] ?? ''
  return `${code} ${name}`.trim()
}
/// Wie viele Attribute die Gruppe der Klasse trägt
const anzahl = computed(() => (store.model?.groups ?? []).find(g => g.key === gruppeDerKlasse.value)?.attributes?.length ?? 0)

async function lesen() {
  fehler.value = ''
  try {
    const k = await klasseAm(api, props.nodeId, schl.value.classAttr)
    const cg = k.code ? klassenGruppe(schl.value.group, k.code) : null
    const gruppen = store.model?.groups ?? []
    zustand.value = {
      ...k, systemGilt: gruppeGilt(k.node, schl.value.group), systemExistiert: gruppen.some(g => g.key === schl.value.group),
      klasseGilt: cg ? gruppeGilt(k.node, cg) : true, klasseExistiert: cg ? gruppen.some(g => g.key === cg) : false,
    }
    emit('kopf', k.code ? '· ' + klassenName(k.code) + (k.geerbt ? ' ↑' : '') : '· ' + t_('keine Klasse'))
  } catch (e) { fehler.value = e.message; emit('kopf', '· ✗ ' + e.message) }
}
onMounted(lesen)
watch(() => props.nodeId, lesen)

function waehlen() { oeffneKlasse(props.nodeId, { onDone: async () => { await lesen(); emit('geaendert') } }) }

async function entfernen() {
  const z = zustand.value
  const ok = await dialog.confirm({
    title: t_('GPC-Klasse {0} entfernen?', [z.code]),
    text: t_('Ihre Gruppe geht mit. Danach gilt die Klasse von oben, sonst hat dieser Knoten keine.'),
    ok: t_('✕ Entfernen'),
  })
  if (!ok) return
  try {
    await api.post('/api/classification/clear', { node: props.nodeId, system: { group: schl.value.group, classAttr: schl.value.classAttr } })
    await store.poll?.(true); await tree.load?.(true)
    store.toast(t_('✓ Klasse entfernt'), 'ok'); await lesen(); emit('geaendert')
  } catch (e) { store.toast(e.message) }
}

/// Eine Gruppe an diesen Knoten hängen — und im selben Zug unter ihm abnehmen, wo sie schon hing: sie gilt ab hier ohnehin nach unten
async function anhaengen(gruppe) {
  try {
    const row = tree.byId.get(props.nodeId)
    const have = (row?.groups ?? '').split(',').filter(Boolean)
    await api.post(`/api/nodes/${encodeURIComponent(props.nodeId)}/groups`, { groups: [...new Set([...have, gruppe])] }, 'PUT')
    const darunter = []; const gehe = id => { for (const k of tree.kids(id)) { if ((k.groups ?? '').split(',').includes(gruppe)) darunter.push(k); gehe(k.id) } }; gehe(props.nodeId)
    for (const k of darunter) await api.post(`/api/nodes/${encodeURIComponent(k.id)}/groups`, { groups: (k.groups ?? '').split(',').filter(x => x && x !== gruppe) }, 'PUT')
    await store.poll?.(true); await tree.load?.(true)
    store.toast(t_('✓ {0} ab {1}', [gruppe, row?.label ?? props.nodeId]), 'ok'); await lesen(); emit('geaendert')
  } catch (e) { store.toast(e.message) }
}
/// Die Gruppe des Systems gibt es nicht (gelöscht): der Server legt sie an
async function systemAnlegen() {
  await api.post('/api/classification/ensure', { system: { group: schl.value.group, classAttr: schl.value.classAttr, groupLabel: { de: 'GPC', en: 'GPC' } }, groupOnly: true })
  await store.poll?.(true)
  await anhaengen(schl.value.group)
}
defineExpose({ zustand, lesen, anzahl, waehlen, entfernen, anhaengen, gruppeDerKlasse })
</script>

<template>
  <div class="row" v-if="zustand">
    <template v-if="zustand.code">
      <span class="chip" :title="zustand.geerbt ? $t('geerbt von {0}', [zustand.von]) : $t('eigene Klasse')">{{ klassenName(zustand.code) }}{{ zustand.geerbt ? ' ↑ ' + zustand.von : '' }}</span>
      <span class="chip" :title="$t('Attribute der Gruppe {0}', [gruppeDerKlasse])">{{ $t("{0} Attribute", [anzahl]) }}</span>
    </template>
    <span v-else class="muted">{{ $t("keine Klasse") }}</span>
    <button :class="zustand.code && zustand.klasseExistiert ? 'x' : 'primary'" :title="$t('Brick wählen: Umfeld, KI-Vorschlag, Suche und Durchsehen')" @click="waehlen">{{ zustand.code ? $t("⌗ andere Klasse …") : $t("⌗ Klasse zuweisen …") }}</button>
    <button v-if="zustand.code && !zustand.geerbt" class="x" :title="$t('Klasse an diesem Knoten entfernen — mit ihrer Gruppe; danach gilt die geerbte Klasse, sonst keine')" @click="entfernen">{{ $t("✕ Klasse") }}</button>
    <button v-if="zustand.code && zustand.klasseExistiert && !zustand.klasseGilt" class="primary" :title="$t('Attributgruppe {0} an diesem Knoten anhängen — erst dann gelten die Attribute der Klasse hier und darunter', [gruppeDerKlasse])" @click="anhaengen(gruppeDerKlasse)">{{ $t("⌗ Gruppe {0} anhängen", [gruppeDerKlasse]) }}</button>
    <button v-if="!zustand.systemGilt" class="primary" :title="zustand.systemExistiert ? $t('Attributgruppe {0} an diesem Knoten anhängen — sie trägt das Klassenattribut', [schl.group]) : $t('Attributgruppe {0} gibt es im Modell nicht — anlegen und anhängen', [schl.group])" @click="zustand.systemExistiert ? anhaengen(schl.group) : systemAnlegen()">{{ zustand.systemExistiert ? $t("⌗ Gruppe {0} anhängen", [schl.group]) : $t("⌗ Gruppe {0} anlegen und anhängen", [schl.group]) }}</button>
  </div>
  <div v-else-if="fehler" class="fehler">✗ {{ fehler }}</div>
</template>
