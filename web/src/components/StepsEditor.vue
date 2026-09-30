<script setup>
// Editor fuer eine Transform-Kette (plugins/table/transform.mjs). Wiederverwendbar
// aus der Compliance-Ansicht und aus dem Import-Mapper. v-model = Array von Steps
// ({ op, ...felder }). attributes fuer Autocomplete in 'combine.columns' (Objekt-Keys).
import { computed } from 'vue'
import { OPS, FIELDS, FIELD_LABEL, FIELD_HINT, opHint, apply, DATE_FORMATS, YES_DEFAULT } from '../transform.js'
import { t as t_ } from '../i18n.js'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  attributes: { type: Array, default: () => [] },   // [{ key, label }] fuer combine
  values: { type: Object, default: () => ({}) },    // fuer Vorschau: { key: aktueller Wert }
})
const emit = defineEmits(['update:modelValue'])

const steps = computed(() => props.modelValue ?? [])

function set(newSteps) { emit('update:modelValue', newSteps) }
function addStep(op) {
  if (!op) return
  const s = op === 'boolean' ? { op, yes: YES_DEFAULT } : { op }
  set([...steps.value, s])
}
function delStep(i) { const n = [...steps.value]; n.splice(i, 1); set(n) }
function moveStep(i, d) { const j = i + d; if (j < 0 || j >= steps.value.length) return; const n = [...steps.value]; [n[i], n[j]] = [n[j], n[i]]; set(n) }
function updateField(i, f, v) { const n = [...steps.value]; n[i] = { ...n[i], [f]: v }; set(n) }
function addColumn(i, col) { if (!col) return; const cur = steps.value[i]?.columns ?? ''; updateField(i, 'columns', cur ? cur + ',' + col : col) }

const vorschau = computed(() => {
  if (!steps.value.length) return ''
  try {
    const r = apply(steps.value, '', { get: k => String(props.values?.[k] ?? '') })
    return String(r).slice(0, 80)
  } catch { return '' }
})
</script>

<template>
  <div class="steps-editor">
    <div v-for="(s, si) in steps" :key="si" class="tstep">
      <span class="muted mono" style="width:18px">{{ si + 1 }}</span>
      <select :value="s.op" @change="updateField(si, 'op', $event.target.value)" :title="opHint(s.op)">
        <option v-for="o in OPS" :key="o[0]" :value="o[0]">{{ o[1] }}</option>
      </select>
      <template v-for="f in (FIELDS[s.op] ?? [])" :key="f">
        <label v-if="f === 'regex'" :title="$t('als regulärer Ausdruck (Flags gi)')">
          <input type="checkbox" :checked="!!s.regex" @change="updateField(si, 'regex', $event.target.checked)" />{{ ' ' + $t("regex") }}
        </label>
        <span v-else-if="f === 'test'" class="fld"><span class="muted">{{ $t("Quelle ist") }}</span>
          <select :value="s.test ?? 'empty'" @change="updateField(si, 'test', $event.target.value)">
            <option value="empty">{{ $t("leer") }}</option>
            <option value="equals">{{ $t("gleich") }}</option>
            <option value="contains">{{ $t("enthält") }}</option>
            <option value="matches">{{ $t("passt auf (regex)") }}</option>
          </select>
        </span>
        <span v-else-if="f === 'decimal'" class="fld"><span class="muted">{{ $t("Dezimalzeichen") }}</span>
          <select :value="s.decimal ?? ''" @change="updateField(si, 'decimal', $event.target.value || undefined)">
            <option value="">{{ $t("raten") }}</option>
            <option value=",">{{ $t("Komma") }}</option>
            <option value=".">{{ $t("Punkt") }}</option>
          </select>
        </span>
        <span v-else-if="f === 'format'" class="fld"><span class="muted">{{ $t("Quelle im Format") }}</span>
          <select :value="s.format ?? 'auto'" @change="updateField(si, 'format', $event.target.value)">
            <option v-for="[k, l] in DATE_FORMATS" :key="k" :value="k">{{ l }}</option>
          </select>
        </span>
        <span v-else class="fld"><span class="muted">{{ FIELD_LABEL[f] ?? f }}</span>
          <input type="text" :value="s[f] ?? ''" @input="updateField(si, f, $event.target.value)"
            :placeholder="FIELD_HINT[f] ?? f"
            :title="(FIELD_HINT[f] ?? f) + ' — ' + opHint(s.op)" style="width:200px" />
        </span>
        <select v-if="f === 'columns'" :value="''" :title="$t('Attribut anklicken statt tippen — wird mit Komma angehängt')"
          @change="addColumn(si, $event.target.value); $event.target.value = ''">
          <option value="">{{ $t("+ Attribut …") }}</option>
          <option value="{}">{{ $t("{} · Ausgangswert") }}</option>
          <option v-for="a in attributes" :key="a.key" :value="a.key">{{ a.label || a.key }} ({{ a.key }})</option>
        </select>
      </template>
      <span class="grow" />
      <button class="x" :disabled="si === 0" @click="moveStep(si, -1)" title="↑">↑</button>
      <button class="x" :disabled="si === steps.length - 1" @click="moveStep(si, 1)" title="↓">↓</button>
      <button class="x" @click="delStep(si)" :title="$t('Schritt entfernen')">×</button>
    </div>
    <div class="tstep">
      <select :value="''" @change="addStep($event.target.value); $event.target.value = ''">
        <option value="">{{ $t("+ Schritt …") }}</option>
        <option v-for="o in OPS" :key="o[0]" :value="o[0]" :title="o[2]">{{ o[1] }}</option>
      </select>
      <span class="muted" style="font-size:11px">{{ steps.length ? $t('Vorschau: {0}', [vorschau]) : $t('Kette leer — ein Schritt nach dem anderen') }}</span>
    </div>
  </div>
</template>

<style scoped>
.steps-editor { display: flex; flex-direction: column; gap: 4px; padding: 6px 8px; background: var(--bg); border-radius: 6px; max-height: 60vh; overflow-y: auto; }
.tstep { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.tstep .fld { display: inline-flex; align-items: center; gap: 4px; }
.tstep .grow { flex: 1; }
.tstep button.x { min-width: 24px; }
</style>
