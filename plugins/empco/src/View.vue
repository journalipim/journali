<script setup>
// ♻ EmpCo — Greenwashing: Texte eines Teilbaums gegen den Kriterienkatalog (Richtlinie (EU) 2024/825) prüfen und die Befunde beheben, ohne die Ansicht zu verlassen.
// Links die Liste (Filter nach Regel und Schwere, Befunde je Feld oder je Begriff), rechts die Arbeitsfläche zum gewählten Befund: Wert ändern, Strg+Enter speichert und
// geht zum nächsten, ein Begriff in vielen Feldern ersetzen, einen Fehlalarm als Ausnahme festhalten. Der Stand bleibt, auch wenn man einen Knoten in einem Tab öffnet.
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { api, store, tree, dialog, TreePicker, L, t } from 'journali'
import { catalog, checks } from './checks.js'
import { collect, findingKey, targetId, snippet, filter, byTerm, countsByRule, ignored, ignoreName, textHash } from './befunde.js'
import { memory, forget } from './memory.js'
import Workbench from './Workbench.vue'
import TermPanel from './TermPanel.vue'

const ICON = { group: '▣', product: '▦', variant: '◆' }
const SEV = { error: '✗', warn: '⚠', info: 'ℹ' }
const SEV_CLASS = s => s === 'error' ? 'neg' : s === 'warn' ? 'warn' : 'muted'
const LIMIT = 1000

const root = ref(localStorage.getItem('journali.empco.root') || tree.rows?.find(r => !r.parent)?.id || null)
const pickOpen = ref(false)
const busy = ref(false)
const status = ref('')
const listEl = ref(null)

const rootLabel = computed(() => root.value ? `${ICON[tree.byId?.get(root.value)?.role] ?? ''} ${tree.byId?.get(root.value)?.label ?? ''}`.trim() : '')
const findings = computed(() => memory.result?.findings ?? [])
const visible = computed(() => filter(findings.value, memory, memory.ignoredMap))
const rows = computed(() => visible.value.slice(0, LIMIT))
const terms = computed(() => byTerm(visible.value))
const ruleCounts = computed(() => countsByRule(filter(findings.value, { sev: memory.sev, text: memory.text, showIgnored: memory.showIgnored }, memory.ignoredMap)))
const sevCounts = computed(() => { const c = { error: 0, warn: 0, info: 0 }; for (const f of filter(findings.value, { rule: memory.rule, text: memory.text, showIgnored: memory.showIgnored }, memory.ignoredMap)) c[f.severity]++; return c })
const ignoredCount = computed(() => findings.value.filter(f => ignored(f, memory.ignoredMap)).length)
const current = computed(() => memory.mode === 'list' ? visible.value.find(f => findingKey(f) === memory.sel) ?? null : null)
const currentTerm = computed(() => memory.mode === 'terms' ? terms.value.find(g => g.key === memory.sel) ?? null : null)
const others = computed(() => current.value ? findings.value.filter(f => findingKey(f) !== findingKey(current.value) && targetId(f) === targetId(current.value) && f.attribute === current.value.attribute && f.locale === current.value.locale) : [])
const attributeLabel = key => { const a = store.model?.attributes?.find(x => x.key === key); return a ? (L(a.label) || a.key) : key }

onMounted(() => {
  if (memory.root !== root.value) forget()
  window.addEventListener('keydown', keys)
})
onBeforeUnmount(() => window.removeEventListener('keydown', keys))

function pick(id) { root.value = id; localStorage.setItem('journali.empco.root', id); pickOpen.value = false; forget(); memory.root = null; status.value = '' }

async function run() {
  if (!root.value || busy.value) return
  busy.value = true
  try {
    const locales = store.model.locales.map(l => l.code)
    status.value = t('lese {0} Sprachen …', [locales.length])
    // Sprachen parallel holen: der Server rechnet je Anfrage nur einen Teilbaum, das Netz wartet nicht auf sich selbst.
    const tables = await Promise.all(locales.map(l => api.get(`/api/nodes/${encodeURIComponent(root.value)}/table?deep=true&locale=${l}`)))
    const list = collect(tables, locales)
    memory.ignoredMap = await api.get('/api/plugins/empco/data?prefix=ignore%3A&values=true').catch(() => ({})) ?? {}
    memory.root = root.value
    memory.result = { findings: list, nodes: tables[0]?.rows.length ?? 0 }
    memory.sel = null
    status.value = ''
    await nextTick(); selectFirst()
  } catch (e) { status.value = '✗ ' + e.message }
  finally { busy.value = false }
}

// ---- Auswahl und Tastatur
const order = computed(() => memory.mode === 'list' ? rows.value.map(findingKey) : terms.value.map(g => g.key))
function selectFirst() { if (memory.sel === null || !order.value.includes(memory.sel)) memory.sel = order.value[0] ?? null }
function move(d) {
  const i = order.value.indexOf(memory.sel)
  const next = order.value[Math.min(order.value.length - 1, Math.max(0, i + d))]
  if (next !== undefined) { memory.sel = next; nextTick(() => listEl.value?.querySelector('tr.cur')?.scrollIntoView?.({ block: 'nearest' })) }
}
function keys(e) {
  if (!memory.result || e.ctrlKey || e.metaKey || e.altKey) return
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName ?? '')) return
  if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); move(1) }
  else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); move(-1) }
}
function mode(m) { memory.mode = m; memory.sel = null; nextTick(selectFirst) }
const toggleSev = s => { memory.sev = memory.sev.includes(s) ? memory.sev.filter(x => x !== s) : [...memory.sev, s]; nextTick(selectFirst) }
const setRule = id => { memory.rule = memory.rule === id ? '' : id; nextTick(selectFirst) }

// ---- Speichern: Wert schreiben, danach alle Befunde an diesem Feld neu bewerten
function refresh(f, value) {
  const def = store.model.attributes.find(a => a.key === f.attribute)
  const perLocale = !!def?.perLocale
  const same = y => targetId(y) === targetId(f) && y.attribute === f.attribute && (!perLocale || y.locale === f.locale)
  const old = memory.result.findings.filter(same)
  const next = memory.result.findings.filter(y => !same(y))
  const done = new Set()
  for (const y of old) {
    if (done.has(y.locale)) continue; done.add(y.locale)
    for (const c of checks) for (const g of c.run({ values: { [y.attribute]: { value } }, columns: [{ key: y.attribute, type: y.type }] })) next.push({ ...y, ...g, rule: c.key, severity: c.severity, raw: value })
  }
  memory.result = { ...memory.result, findings: next }
}
async function writeValue(f, value) {
  const def = store.model.attributes.find(a => a.key === f.attribute)
  await api.post(`/api/nodes/${encodeURIComponent(targetId(f))}/attributes`, { attribute: f.attribute, locale: def?.perLocale ? f.locale : null, channel: null, value, row: null })
}
async function save(value) {
  const f = current.value; if (!f) return
  const i = order.value.indexOf(memory.sel)
  try { await writeValue(f, value) } catch (e) { store.toast(e.message); return }
  refresh(f, value)
  store.toast(t('✓ gespeichert'), 'ok'); store.poll(true)
  await nextTick()
  // weiter: derselbe Platz in der Liste (der Befund ist weg) oder, wenn er blieb, der nächste
  const still = order.value.indexOf(memory.sel)
  memory.sel = order.value[still >= 0 ? Math.min(still + 1, order.value.length - 1) : Math.min(i, order.value.length - 1)] ?? null
}

// ---- Ausnahmen (Plugin-Daten im Journal)
async function setIgnore(reason) {
  const f = current.value; if (!f) return
  const name = ignoreName(f), entry = { term: f.term, reason: (reason ?? '').trim(), hash: textHash(f.raw) }
  try { await api.post(`/api/plugins/empco/data/${encodeURIComponent(name)}`, entry, 'PUT') } catch (e) { store.toast(e.message); return }
  memory.ignoredMap = { ...memory.ignoredMap, [name]: entry }
  store.toast(t('Als Ausnahme gemerkt'), 'ok')
  await nextTick(); selectFirst(); if (!order.value.includes(memory.sel)) memory.sel = order.value[0] ?? null
}
async function unIgnore() {
  const f = current.value; if (!f) return
  const name = ignoreName(f)
  try { await api.del(`/api/plugins/empco/data/${encodeURIComponent(name)}`) } catch (e) { store.toast(e.message); return }
  const { [name]: _, ...rest } = memory.ignoredMap; memory.ignoredMap = rest
}

// ---- Ersetzen in vielen Feldern: ein Stapel
async function apply(items, replacement) {
  const g = currentTerm.value; if (!g || !items.length) return
  const ok = await dialog.confirm({
    title: t('„{0}“ in {1} Feldern ersetzen?', [g.term, items.length]), warn: t('{0} Attributwerte als ein Stapel ins Journal — als Ganzes rückgängig zu machen', [items.length]),
    list: items.slice(0, 8).map(i => `${i.f.node.label} · ${attributeLabel(i.f.attribute)} → ${snippet(i.value, replacement, 24).before.slice(-24)}${replacement}`), ok: t('Ersetzen'),
  })
  if (!ok) return
  const cmds = items.map(({ f, value }) => {
    const def = store.model.attributes.find(a => a.key === f.attribute)
    return { op: 'attribute.set', args: { node: targetId(f), attribute: f.attribute, locale: def?.perLocale ? f.locale : null, value } }
  })
  try {
    const res = await api.batchChunked(cmds, { label: t('EmpCo: „{0}“ ersetzen', [g.term]) })
    if (res.error) throw new Error(res.error.message)
    for (const { f, value } of items) refresh(f, value)
    store.toast(t('✓ {0} Werte geschrieben', [res.results.length]), 'ok'); store.poll(true)
    await nextTick(); if (!order.value.includes(memory.sel)) memory.sel = order.value[0] ?? null
  } catch (e) { store.toast(e.message) }
}
</script>

<template>
  <div class="pane empco" style="flex:1">
    <div class="toolbar">
      <h1>{{ catalog.icon }} {{ catalog.label }}</h1>
      <span class="wurzel">
        <button type="button" class="knoten" :title="$t('Teilbaum, dessen Texte geprüft werden')" @click="pickOpen = !pickOpen">{{ rootLabel || $t('Teilbaum wählen') }}</button>
        <div v-if="pickOpen" class="picker"><TreePicker :model-value="root" :roles="['group', 'product']" :height="300" @pick="r => pick(r.id)" /></div>
      </span>
      <button type="button" class="primary" :disabled="busy || !root" @click="run">{{ $t('▶ prüfen') }}</button>
      <span class="grow" />
      <span :class="status.startsWith('✗') ? 'neg' : 'muted'">{{ status }}</span>
      <span v-if="memory.result" class="muted" :title="$t('Befunde in geprüften Knoten')">{{ $t('{0} Befunde in {1} Knoten', [findings.length, memory.result.nodes]) }}</span>
    </div>

    <details class="katalog">
      <summary class="muted">{{ catalog.icon }} {{ $t('Kriterienkatalog') }} · {{ $t('{0} Regeln', [catalog.rules.length]) }} · {{ $t('heuristisch, keine Rechtsberatung') }}</summary>
      <div class="quellen muted">{{ $t('Quellen:') }} <a v-for="s in catalog.sources" :key="s.url" :href="s.url" target="_blank" rel="noopener">{{ s.label }}</a></div>
      <table class="grid"><thead><tr><th style="width:30px" /><th style="width:260px">{{ $t('Regel') }}</th><th>{{ $t('Was zu tun ist') }}</th><th style="width:220px">{{ $t('Anker') }}</th></tr></thead><tbody>
        <tr v-for="r in catalog.rules" :key="r.id">
          <td :class="SEV_CLASS(r.severity)">{{ SEV[r.severity] }}</td>
          <td>{{ r.label }}<div class="muted klein">{{ (r.terms ?? []).slice(0, 8).join(', ') }}<template v-if="(r.terms ?? []).length > 8"> …</template></div></td>
          <td class="muted">{{ r.hint }}</td><td class="muted klein">{{ r.ref }}</td>
        </tr>
      </tbody></table>
    </details>

    <template v-if="memory.result">
      <div class="leiste">
        <button v-for="r in catalog.rules" v-show="ruleCounts[r.id] || memory.rule === r.id" :key="r.id" type="button" class="chip" :class="{ on: memory.rule === r.id }" :title="r.hint + ' — ' + r.ref" @click="setRule(r.id)">
          <span :class="SEV_CLASS(r.severity)">{{ SEV[r.severity] }}</span> {{ r.label }} · {{ ruleCounts[r.id] ?? 0 }}
        </button>
        <span class="grow" />
        <button v-for="s in ['error', 'warn', 'info']" :key="s" type="button" class="chip sev" :class="[{ on: memory.sev.includes(s) }, SEV_CLASS(s)]" :title="$t('Nur diese Schwere')" @click="toggleSev(s)">{{ SEV[s] }} {{ sevCounts[s] }}</button>
        <input v-model="memory.text" class="suche" :placeholder="$t('Knoten, Feld, Begriff')" />
        <button type="button" class="chip" :class="{ on: memory.mode === 'list' }" :title="$t('Jeder Befund einzeln')" @click="mode('list')">{{ $t('Liste') }}</button>
        <button type="button" class="chip" :class="{ on: memory.mode === 'terms' }" :title="$t('Gleiche Begriffe zusammen — ersetzen in vielen Feldern')" @click="mode('terms')">{{ $t('Begriffe') }}</button>
        <label v-if="ignoredCount" class="muted"><input v-model="memory.showIgnored" type="checkbox" /> {{ $t('Ausnahmen ({0})', [ignoredCount]) }}</label>
      </div>

      <div v-if="!visible.length" class="empty pos">{{ findings.length ? $t('Kein Befund passt zum Filter') : $t('✓ keine Befunde in {0} Knoten', [memory.result.nodes]) }}</div>
      <div v-else class="arbeit">
        <div ref="listEl" class="liste scroll">
          <table class="grid"><tbody>
            <template v-if="memory.mode === 'list'">
              <tr v-for="f in rows" :key="findingKey(f)" :class="{ cur: findingKey(f) === memory.sel, aus: ignored(f, memory.ignoredMap) }" @click="memory.sel = findingKey(f)">
                <td :class="SEV_CLASS(f.severity)" style="width:22px">{{ SEV[f.severity] }}</td>
                <td class="kn"><span class="muted">{{ ICON[f.node.role] }}</span> {{ f.node.label }}<span v-if="f.heirs.length" class="muted" :title="f.heirs.map(h => h.label).join(', ')"> +{{ f.heirs.length }}</span></td>
                <td class="muted klein feld">{{ attributeLabel(f.attribute) }} · {{ f.locale }}</td>
                <td class="snip"><span>{{ snippet(f.raw, f.term, 36).before }}</span><mark>{{ snippet(f.raw, f.term, 36).term }}</mark><span>{{ snippet(f.raw, f.term, 36).after }}</span></td>
              </tr>
            </template>
            <template v-else>
              <tr v-for="g in terms" :key="g.key" :class="{ cur: g.key === memory.sel }" @click="memory.sel = g.key">
                <td :class="SEV_CLASS(g.severity)" style="width:22px">{{ SEV[g.severity] }}</td>
                <td><mark>{{ g.term }}</mark></td>
                <td class="muted klein">{{ catalog.rules.find(r => r.id === g.rule)?.label }}</td>
                <td class="muted" style="text-align:right">{{ g.findings.length }}</td>
              </tr>
            </template>
          </tbody></table>
          <div v-if="memory.mode === 'list' && visible.length > LIMIT" class="muted klein hinweis">{{ $t('{0} von {1} Befunden — der Filter grenzt ein', [LIMIT, visible.length]) }}</div>
        </div>
        <div class="flaeche scroll">
          <Workbench v-if="current" :finding="current" :ignored-map="memory.ignoredMap" :others="others" @save="save" @skip="move(1)" @ignore="setIgnore" @unignore="unIgnore" @pick="o => (memory.sel = findingKey(o))" />
          <TermPanel v-else-if="currentTerm" :group="currentTerm" @apply="apply" />
          <div v-else class="empty muted">{{ $t('Einen Befund wählen — Pfeil nach oben und unten wechselt, Strg+Enter speichert') }}</div>
        </div>
      </div>
    </template>
    <div v-else class="empty muted">{{ $t('Teilbaum wählen und prüfen — dieselben Regeln laufen auch in ✓ Datenqualität mit allen anderen.') }}</div>
  </div>
</template>

<style scoped>
.empco { display: flex; flex-direction: column; min-height: 0; }
.wurzel { position: relative; }
.knoten { border: 1px solid var(--line); background: var(--pane); color: var(--text); padding: 2px 8px; border-radius: 3px; cursor: pointer; }
.picker { position: absolute; left: 0; top: 30px; z-index: 6; width: 380px; padding: 6px; background: var(--pane); border: 1px solid var(--line); }
.katalog { padding: 4px 12px; border-bottom: 1px solid var(--line); }
.katalog summary { cursor: pointer; }
.quellen { font-size: 12px; margin: 4px 0; display: flex; gap: 10px; }
.klein { font-size: 11px; }
.leiste { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; padding: 6px 12px; border-bottom: 1px solid var(--line); }
.chip { border: 1px solid var(--line); background: var(--pane); color: var(--text); border-radius: 12px; padding: 1px 10px; cursor: pointer; font-size: 12px; }
.chip.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 18%, var(--pane)); }
.suche { width: 180px; }
.arbeit { display: flex; flex: 1; min-height: 0; }
.liste { width: 48%; min-width: 360px; overflow: auto; border-right: 1px solid var(--line); }
.flaeche { flex: 1; overflow: auto; }
tr { cursor: pointer; }
tr.cur { background: color-mix(in srgb, var(--accent) 16%, transparent); }
tr.aus { opacity: .5; }
.kn { white-space: nowrap; max-width: 220px; overflow: hidden; text-overflow: ellipsis; }
.feld { white-space: nowrap; }
.snip { font-size: 12px; }
.hinweis { padding: 6px 12px; }
.empty { padding: 24px; }
</style>
