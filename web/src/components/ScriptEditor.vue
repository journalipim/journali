<script setup>
// Skript-Editor für kombinierte Attribute (Taloan, 17.09.): Monospace, Syntaxfarben, ? mit allen
// Möglichkeiten (und den Attributen zum Einfügen), Syntaxprüfung beim Tippen über den Server.
// Übernehmen geht nur, wenn die Prüfung stimmt — ein halbes Skript darf nie ins Attribut.
// Wer unterbrochen wird, behält den Entwurf im Browser (localStorage) und macht später weiter.
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { api } from '../api.js'

const props = defineProps({ modelValue: String, title: String, draftKey: String, attributes: Array, type: String })
const emit = defineEmits(['save', 'close'])

const text = ref(props.modelValue ?? '')
const check = ref({ ok: true, error: null, keys: [] })
const help = ref(false)
const ta = ref(null), pre = ref(null)
const draftAt = ref(null)
const DRAFT = 'journali.formula.draft.' + (props.draftKey ?? '')

onMounted(async () => {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT) || 'null')
    if (d && d.text !== (props.modelValue ?? '')) { text.value = d.text; draftAt.value = d.at }
  } catch {}
  await nextTick(); ta.value?.focus(); run()
})

let timer = null
watch(text, () => { clearTimeout(timer); timer = setTimeout(run, 250); keepDraft() })
async function run() {
  if (!text.value.trim()) { check.value = { ok: true, error: null, keys: [] }; return }
  try { check.value = await api.post('/api/model/formula/check', { formula: text.value }) }
  catch (e) { check.value = { ok: false, error: e.message, keys: [] } }
}
function keepDraft() {
  try {
    if (text.value === (props.modelValue ?? '')) { localStorage.removeItem(DRAFT); draftAt.value = null }
    else { draftAt.value = new Date().toISOString(); localStorage.setItem(DRAFT, JSON.stringify({ text: text.value, at: draftAt.value })) }
  } catch {}
}
function save() { if (!check.value.ok) return; try { localStorage.removeItem(DRAFT) } catch {}; emit('save', text.value.trim()) }
function discardDraft() { text.value = props.modelValue ?? ''; try { localStorage.removeItem(DRAFT) } catch {}; draftAt.value = null }
function insert(s) {
  const el = ta.value; if (!el) return
  const a = el.selectionStart, b = el.selectionEnd
  text.value = text.value.slice(0, a) + s + text.value.slice(b)
  nextTick(() => { el.focus(); el.selectionStart = el.selectionEnd = a + s.length })
}
// ---- Vorschläge (Taloan, 17.09.): $ oder @ tippen zeigt die Attribute, Buchstaben filtern, ↑↓ wählen,
// Enter/Tab fügt $schlüssel ein (ein getipptes @ wird dabei zu $ — @ ist keine Syntax, nur der Griff).
const ac = ref({ open: false, items: [], i: 0, start: 0, top: 0, left: 0 })
function acUpdate() {
  const el = ta.value; if (!el) { ac.value.open = false; return }
  const before = text.value.slice(0, el.selectionStart)
  const m = /[$@]([A-Za-z0-9_]*)$/.exec(before)
  if (!m || !props.attributes?.length) { ac.value.open = false; return }
  const q = m[1].toLowerCase()
  const items = props.attributes.filter(a => a.key.includes(q) || (a.label?.de ?? '').toLowerCase().includes(q)).slice(0, 12)
  if (!items.length) { ac.value.open = false; return }
  const line = before.split('\n').length
  ac.value = { open: true, items, i: 0, start: el.selectionStart - m[0].length, top: 10 + line * 19.5 - el.scrollTop, left: 12 + Math.min(40, (before.length - before.lastIndexOf('\n') - 1)) * 7.8 - el.scrollLeft }
}
function acPick(a) {
  const el = ta.value; const s = '$' + a.key
  text.value = text.value.slice(0, ac.value.start) + s + text.value.slice(el.selectionStart)
  ac.value.open = false
  nextTick(() => { el.focus(); el.selectionStart = el.selectionEnd = ac.value.start + s.length })
}
function onKey(e) {
  if (ac.value.open && e.target === ta.value) {
    if (e.key === 'ArrowDown') { e.preventDefault(); ac.value.i = (ac.value.i + 1) % ac.value.items.length; return }
    if (e.key === 'ArrowUp') { e.preventDefault(); ac.value.i = (ac.value.i - 1 + ac.value.items.length) % ac.value.items.length; return }
    if (e.key === 'Enter' && !e.ctrlKey || e.key === 'Tab') { e.preventDefault(); acPick(ac.value.items[ac.value.i]); return }
    if (e.key === 'Escape') { e.preventDefault(); ac.value.open = false; return }
  }
  if (e.key === 'Escape') { e.preventDefault(); emit('close') }
  else if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); save() }
  else if (e.key === 'Tab' && e.target === ta.value) { e.preventDefault(); insert('  ') }
}
function syncScroll() { if (pre.value && ta.value) { pre.value.scrollTop = ta.value.scrollTop; pre.value.scrollLeft = ta.value.scrollLeft } }

// ---- Syntaxfarben: derselbe Wortschatz wie Formula.cs
const FUNCS = ['round', 'trunc', 'floor', 'ceil', 'abs', 'min', 'max', 'sqrt', 'len', 'upper', 'lower', 'trim', 'left', 'right', 'contains', 'replace', 'split', 'pad', 'number', 'str', 'format', 'isblank', 'coalesce']
const KEYWORDS = ['if', 'else', 'return', 'true', 'false', 'null']
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const highlighted = computed(() => {
  const re = /(\/\/[^\n]*)|(`(?:\\.|[^`])*`|"(?:\\.|[^"\n])*"|'(?:\\.|[^'\n])*')|(\$[A-Za-z_][A-Za-z0-9_]*)|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_][A-Za-z0-9_]*\b)/g
  let out = '', last = 0
  for (const m of text.value.matchAll(re)) {
    out += esc(text.value.slice(last, m.index))
    const [s, c, str, attr, num, word] = m
    if (c) out += `<span class="c">${esc(s)}</span>`
    else if (str) out += `<span class="s">${esc(s).replace(/\$\{[^}]*\}/g, x => `<span class="t">${x}</span>`)}</span>`
    else if (attr) out += `<span class="a">${esc(s)}</span>`
    else if (num) out += `<span class="n">${esc(s)}</span>`
    else if (word) out += KEYWORDS.includes(s) ? `<span class="k">${s}</span>` : FUNCS.includes(s) ? `<span class="f">${s}</span>` : s
    last = m.index + s.length
  }
  return out + esc(text.value.slice(last)) + '\n'
})
const HELP = [
  ['Attribut lesen', '$schlüssel — der Wert am Knoten, geerbt zählt; Text in der Sprache der Spalte. $ oder @ tippen zeigt die Liste, ↑↓ Enter fügt ein'],
  ['Werte', 'Zahl · "Text" · `Vorlage ${ausdruck}` · true false null'],
  ['Rechnen', '+ - * / % **   (+ verkettet, wenn Text dabei ist)'],
  ['Vergleichen', '== != < <= > >=   · mit null immer false'],
  ['Logik', '&& || !   ·   bedingung ? a : b   ·   a ?? b (Ersatz, wenn a leer)'],
  ['Anweisungen', 'x = …  ·  if (…) { … } else { … }  ·  return …  ·  // Kommentar\nZeilenende oder ; trennt; die letzte Anweisung ist das Ergebnis'],
  ['Zahlen', 'round(x, n) trunc floor ceil abs min max sqrt · format(x, n) — in der Sprache der Spalte (de 1,39)'],
  ['Text', 'len upper lower trim left(s, n) right(s, n) contains(s, t) replace(s, a, b) split(s, sep, i) pad(s, n, "0") str(x) number(x)'],
  ['Leer', 'isblank(x) · coalesce(a, b, …) · fehlt ein Wert, ist das Ergebnis leer (—)'],
]
const EXAMPLE = 'h = $height\nif (h >= 100) {\n  return `${format(h / 100, 2)} m`\n}\nreturn `${h} cm`'
</script>

<template>
  <Teleport to="body">
    <div class="overlay" @mousedown.self="emit('close')" @keydown="onKey">
      <div class="editor">
        <div class="toolbar">
          <h1>ƒ {{ title }}</h1>
          <span v-if="check.ok" class="pos" title="Syntax stimmt">✓ {{ check.keys.length ? 'liest ' + check.keys.map(k => '$' + k).join(', ') : 'ok' }}</span>
          <span v-else class="neg" :title="check.error">✗ {{ check.error }}</span>
          <span class="grow" />
          <span v-if="draftAt" class="warn" title="Entwurf im Browser — noch nicht im Attribut">✎ Entwurf</span>
          <button :class="{ primary: help }" @click="help = !help" title="Was geht hier?">?</button>
        </div>
        <div class="body">
          <div class="code">
            <pre ref="pre" class="hl" aria-hidden="true" v-html="highlighted"></pre>
            <textarea ref="ta" v-model="text" spellcheck="false" wrap="off" @scroll="syncScroll(); acUpdate()" @input="acUpdate" @click="acUpdate" @keyup.left="acUpdate" @keyup.right="acUpdate" :placeholder="EXAMPLE"></textarea>
            <div v-if="ac.open" class="ac" :style="`top:${ac.top}px;left:${ac.left}px`">
              <div v-for="(a, i) in ac.items" :key="a.key" class="acrow" :class="{ on: i === ac.i }" @mousedown.prevent="acPick(a)">
                <span class="a">${{ a.key }}</span><span class="muted">{{ a.label?.de || '' }} · {{ a.type }}{{ a.perLocale ? ' 🗣' : '' }}</span>
              </div>
            </div>
          </div>
          <div v-if="help" class="help">
            <div v-for="[h, t] in HELP" :key="h" class="hrow"><b>{{ h }}</b><div class="mono">{{ t }}</div></div>
            <div class="hrow"><b>Beispiel</b><pre class="mono ex" @click="insert(EXAMPLE)" title="Klick fügt es ein">{{ EXAMPLE }}</pre></div>
            <div class="hrow" v-if="attributes?.length"><b>Attribute</b><div class="chips">
              <button v-for="a in attributes" :key="a.key" class="chip" @click="insert('$' + a.key)" :title="`${a.label?.de || a.key} · ${a.type}`">${{ a.key }}</button>
            </div></div>
          </div>
        </div>
        <div class="toolbar" style="border-top:1px solid var(--line);border-bottom:0">
          <span class="muted" style="font-size:12px">{{ type === 'text' ? 'Ergebnis: Text' : 'Ergebnis: Zahl' }} · <kbd>Ctrl+Enter</kbd> übernehmen · <kbd>Esc</kbd> schliessen (Entwurf bleibt)</span>
          <span class="grow" />
          <button v-if="draftAt" @click="discardDraft" title="zurück zum Stand im Attribut">Entwurf verwerfen</button>
          <button @click="emit('close')">Schliessen</button>
          <button class="primary" :disabled="!check.ok" @click="save" :title="check.ok ? 'ins Attribut übernehmen' : 'erst die Syntax richten'">Übernehmen</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: grid; place-items: center; z-index: 20; }
.editor { width: min(1100px, 94vw); height: min(680px, 88vh); background: var(--pane); border: 1px solid var(--line); border-radius: 6px; display: flex; flex-direction: column; box-shadow: 0 12px 40px rgba(0,0,0,.4); }
.body { flex: 1; display: flex; min-height: 0; }
.code { flex: 1; position: relative; min-width: 0; background: var(--cell); }
.hl, textarea { position: absolute; inset: 0; margin: 0; padding: 10px 12px; font: 13px/1.5 var(--mono); white-space: pre; overflow: auto; tab-size: 2; }
.hl { color: var(--text); pointer-events: none; }
textarea { background: transparent; color: transparent; caret-color: var(--text); border: 0; outline: none; resize: none; }
textarea::placeholder { color: var(--muted); opacity: .5; }
.hl :deep(.c) { color: var(--muted); font-style: italic; }
.hl :deep(.s) { color: #9ccc65; }
.hl :deep(.t) { color: #ffd54f; }
.hl :deep(.a) { color: #64b5f6; font-weight: 600; }
.hl :deep(.n) { color: #ffb74d; }
.hl :deep(.k) { color: #ce93d8; font-weight: 600; }
.hl :deep(.f) { color: #4dd0e1; }
.ac { position: absolute; z-index: 3; background: var(--pane); border: 1px solid var(--line); border-radius: 6px; box-shadow: 0 8px 24px rgba(0,0,0,.35); min-width: 260px; max-height: 260px; overflow: auto; font-size: 12px; }
.acrow { display: flex; gap: 8px; align-items: center; padding: 3px 8px; white-space: nowrap; cursor: pointer; }
.acrow.on, .acrow:hover { background: var(--accent-soft); }
.acrow .a { font-family: var(--mono); color: #64b5f6; font-weight: 600; }
.help { width: 380px; border-left: 1px solid var(--line); overflow: auto; padding: 8px 10px; font-size: 12px; }
.hrow { margin-bottom: 8px; }
.hrow b { display: block; color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
.hrow .mono { white-space: pre-wrap; }
.ex { margin: 0; padding: 6px; background: var(--cell); border-radius: 4px; cursor: pointer; }
.chips { display: flex; flex-wrap: wrap; gap: 4px; }
.chip { font: 11px var(--mono); padding: 1px 6px; }
</style>
