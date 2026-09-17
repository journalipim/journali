<script setup>
// Skript-Editor für kombinierte Attribute (Taloan, 17.09.): Monospace, Syntaxfarben, ? mit allen
// Möglichkeiten (und den Attributen zum Einfügen), Syntaxprüfung beim Tippen über den Server.
// Übernehmen geht nur, wenn die Prüfung stimmt — ein halbes Skript darf nie ins Attribut.
// Wer unterbrochen wird, behält den Entwurf im Browser (localStorage) und macht später weiter.
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { api } from '../api.js'

// node/locale: der Knoten, an dem das Skript gerechnet wird — dann zeigt der Fuss das momentane Ergebnis statt einer Erklärung (Taloan, 17.09.)
const props = defineProps({ modelValue: String, title: String, draftKey: String, attributes: Array, type: String, node: String, locale: String })
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
  try { check.value = await api.post('/api/model/formula/check', { formula: text.value, node: props.node ?? null, locale: props.locale ?? null, type: props.type ?? null }) }
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
// Vorlage (Taloan): { tippen zeigt die Attribute, Enter fügt {schlüssel} ein — keine Funktionen, keine Schlüsselwörter
const isTemplate = computed(() => props.type === 'template')
// Funktionen mit Signatur — dieselbe Liste wie Formula.cs; ab zwei getippten Buchstaben vorgeschlagen
const SIGS = { round: 'round(x, n)', trunc: 'trunc(x)', floor: 'floor(x)', ceil: 'ceil(x)', abs: 'abs(x)', min: 'min(a, b)', max: 'max(a, b)', sqrt: 'sqrt(x)',
  len: 'len(s)', upper: 'upper(s)', lower: 'lower(s)', trim: 'trim(s)', left: 'left(s, n)', right: 'right(s, n)', contains: 'contains(s, t)', replace: 'replace(s, a, b)',
  split: 'split(s, sep, i)', pad: 'pad(s, n, "0")', number: 'number(x)', str: 'str(x)', format: 'format(x, n)', isblank: 'isblank(x)', coalesce: 'coalesce(a, b)',
  substr: 'substr(s, start, len)', indexof: 'indexof(s, t)', startswith: 'startswith(s, t)', endswith: 'endswith(s, t)', capitalize: 'capitalize(s)', title: 'title(s)',
  repeat: 'repeat(s, n)', padleft: 'padleft(s, n, " ")', padright: 'padright(s, n, " ")', trimstart: 'trimstart(s)', trimend: 'trimend(s)', squeeze: 'squeeze(s)',
  regextest: 'regextest(s, re)', regexmatch: 'regexmatch(s, re)', regexreplace: 'regexreplace(s, re, repl)', escapehtml: 'escapehtml(s)', striphtml: 'striphtml(s)',
  slug: 'slug(s)', nl2br: 'nl2br(s)', count: 'count(s, t)', reverse: 'reverse(s)' }
function acUpdate() {
  const el = ta.value; if (!el) { ac.value.open = false; return }
  const before = text.value.slice(0, el.selectionStart)
  let items = [], start
  const m = (isTemplate.value ? /\{([A-Za-z0-9_]*)$/ : /[$@]([A-Za-z0-9_]*)$/).exec(before)
  if (m && props.attributes?.length) {
    const q = m[1].toLowerCase()
    const wrap = k => isTemplate.value ? (text.value[el.selectionStart] === '}' ? '{' + k : '{' + k + '}') : '$' + k
    items = props.attributes.filter(a => a.key.includes(q) || (a.label?.de ?? '').toLowerCase().includes(q)).slice(0, 12).map(a => ({ kind: 'attr', insert: wrap(a.key), show: (isTemplate.value ? '{' : '$') + a.key + (isTemplate.value ? '}' : ''), note: `${a.label?.de || ''} · ${a.type}${a.perLocale ? ' 🗣' : ''}${a.unit ? ' · ' + a.unit : ''}` }))
    start = el.selectionStart - m[0].length
  } else if (isTemplate.value) {
    const f = /\|([a-z0-9]*)$/.exec(before)
    if (f) { items = [['unit', 'Einheit anhängen'], ['0', 'ganze Zahl'], ['1', '1 Nachkommastelle'], ['2', '2 Nachkommastellen'], ['upper', 'GROSS'], ['lower', 'klein'], ['capitalize', 'Erster gross'], ['plain', 'ohne HTML']].filter(([k]) => k.startsWith(f[1])).map(([k, n]) => ({ kind: 'fn', insert: k, show: '|' + k, note: n })); start = el.selectionStart - f[1].length }
  } else {
    const f = /(?:^|[^A-Za-z0-9_$.])([a-z][a-z0-9_]*)$/.exec(before)
    if (f && f[1].length >= 2) {
      items = Object.keys(SIGS).filter(k => k.startsWith(f[1])).map(k => ({ kind: 'fn', insert: k + '(', show: SIGS[k], note: '' }))
      for (const k of ['if', 'else', 'return', 'true', 'false', 'null']) if (k.startsWith(f[1]) && k !== f[1]) items.push({ kind: 'kw', insert: k + (k === 'if' ? ' (' : ' '), show: k, note: '' })
      start = el.selectionStart - f[1].length
    }
  }
  if (!items.length) { ac.value.open = false; return }
  const line = before.split('\n').length
  ac.value = { open: true, items, i: 0, start, top: 10 + line * 19.5 - el.scrollTop, left: 12 + Math.min(40, (before.length - before.lastIndexOf('\n') - 1)) * 7.8 - el.scrollLeft }
}
function acPick(a) {
  const el = ta.value; const s = a.insert
  const after = text.value.slice(el.selectionStart)
  // Funktion: Klammer gleich schliessen, Cursor hinein — ausser die Klammer ist schon da
  const close = a.kind === 'fn' && !isTemplate.value && !after.startsWith('(') && !after.startsWith(')') ? ')' : ''
  text.value = text.value.slice(0, ac.value.start) + s + close + after
  ac.value.open = false
  nextTick(() => { el.focus(); el.selectionStart = el.selectionEnd = ac.value.start + s.length })
}
// Klammern und Anführungszeichen schliessen sich von selbst; das schliessende Zeichen tippen springt darüber
const PAIRS = { '(': ')', '{': '}', '[': ']', '"': '"', "'": "'", '`': '`' }
function autoPair(e) {
  const el = ta.value; if (!el || e.ctrlKey || e.altKey || e.metaKey) return false
  const a = el.selectionStart, b = el.selectionEnd, next = text.value[a] ?? ''
  if (a === b && [')', '}', ']', '"', "'", '`'].includes(e.key) && next === e.key) { e.preventDefault(); el.selectionStart = el.selectionEnd = a + 1; return true }
  if (!(e.key in PAIRS)) return false
  const closeCh = PAIRS[e.key]
  const selected = text.value.slice(a, b)
  if (a === b && /[A-Za-z0-9_$]/.test(next)) return false   // vor einem Wort keine Klammer aufdrängen
  e.preventDefault()
  text.value = text.value.slice(0, a) + e.key + selected + closeCh + text.value.slice(b)
  nextTick(() => { el.selectionStart = a + 1; el.selectionEnd = a + 1 + selected.length })
  return true
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
  else if (e.target === ta.value && autoPair(e)) return
  else if (e.key === 'Enter' && e.target === ta.value) {
    // Zeilenumbruch übernimmt die Einrückung; zwischen { und } eine Stufe tiefer
    const el = ta.value, a = el.selectionStart
    const lineStart = text.value.lastIndexOf('\n', a - 1) + 1
    const indent = /^[ \t]*/.exec(text.value.slice(lineStart, a))[0]
    const between = text.value[a - 1] === '{' && text.value[a] === '}'
    e.preventDefault()
    const ins = '\n' + indent + (between ? '  \n' + indent : '')
    text.value = text.value.slice(0, a) + ins + text.value.slice(el.selectionEnd)
    nextTick(() => { el.selectionStart = el.selectionEnd = a + 1 + indent.length + (between ? 2 : 0) })
  }
}
function syncScroll() { if (pre.value && ta.value) { pre.value.scrollTop = ta.value.scrollTop; pre.value.scrollLeft = ta.value.scrollLeft } }

// ---- Syntaxfarben: derselbe Wortschatz wie Formula.cs
const FUNCS = Object.keys(SIGS)
const KEYWORDS = ['if', 'else', 'return', 'true', 'false', 'null']
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function highlight(src) {
  const re = /(\/\/[^\n]*)|(`(?:\\.|[^`])*`|"(?:\\.|[^"\n])*"|'(?:\\.|[^'\n])*')|(\$[A-Za-z_][A-Za-z0-9_]*)|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_][A-Za-z0-9_]*\b)/g
  let out = '', last = 0
  for (const m of src.matchAll(re)) {
    out += esc(src.slice(last, m.index))
    const [s, c, str, attr, num, word] = m
    if (c) out += `<span class="c">${esc(s)}</span>`
    else if (str) out += `<span class="s">${esc(s).replace(/\$\{[^}]*\}/g, x => `<span class="t">${x}</span>`)}</span>`
    else if (attr) out += `<span class="a">${esc(s)}</span>`
    else if (num) out += `<span class="n">${esc(s)}</span>`
    else if (word) out += KEYWORDS.includes(s) ? `<span class="k">${s}</span>` : FUNCS.includes(s) ? `<span class="f">${s}</span>` : s
    last = m.index + s.length
  }
  return out + esc(src.slice(last))
}
// Vorlage: {platzhalter|zusatz} und [ optionale Abschnitte ] färben
function highlightTemplate(src) {
  const re = /(\\.)|(\{[A-Za-z_][A-Za-z0-9_]*(?:\|[A-Za-z0-9]+)*\})|([\[\]])/g
  let out = '', last = 0
  for (const m of src.matchAll(re)) {
    out += esc(src.slice(last, m.index))
    const [s, e, ph, br] = m
    if (e) out += `<span class="c">${esc(s)}</span>`
    else if (ph) { const i = s.indexOf('|'); out += i < 0 ? `<span class="a">${esc(s)}</span>` : `<span class="a">${esc(s.slice(0, i))}</span><span class="f">${esc(s.slice(i, -1))}</span><span class="a">}</span>` }
    else if (br) out += `<span class="k">${s}</span>`
    last = m.index + s.length
  }
  return out + esc(src.slice(last))
}
const highlighted = computed(() => (isTemplate.value ? highlightTemplate(text.value) : highlight(text.value)) + '\n')
// Hilfe (Taloan, 17.09.): je Zeile ein Baustein mit Syntaxfarben, Klick fügt ihn ein; kein „·“ mehr
const HELP = [
  ['Attribut lesen', [['$key', 'Wert am Knoten — geerbt zählt, Text in der Sprache der Spalte. $ tippen zeigt die Liste']]],
  ['Werte', [['42', 'Zahl'], ['"Text"', 'Text'], ['`Vorlage ${$key}`', 'Vorlage mit Ausdrücken'], ['true', ''], ['false', ''], ['null', 'kein Wert']]],
  ['Rechnen', [['a + b', 'auch Text anhängen'], ['a - b', ''], ['a * b', ''], ['a / b', ''], ['a % b', 'Rest'], ['a ** b', 'Potenz']]],
  ['Vergleichen', [['a == b', ''], ['a != b', ''], ['a < b', 'auch <= > >= — mit null immer false']]],
  ['Logik', [['a && b', 'und'], ['a || b', 'oder'], ['!a', 'nicht'], ['c ? a : b', 'wenn c, dann a, sonst b'], ['a ?? b', 'b, wenn a leer ist']]],
  ['Anweisungen', [['x = $key', 'Variable'], ['if (c) {\n  \n} else {\n  \n}', 'Verzweigung'], ['return x', 'Ergebnis — sonst zählt die letzte Anweisung'], ['// Kommentar', '']]],
  ['Zahlen', [['round(x, 2)', 'runden'], ['trunc(x)', 'abschneiden'], ['floor(x)', ''], ['ceil(x)', ''], ['abs(x)', ''], ['min(a, b)', ''], ['max(a, b)', ''], ['sqrt(x)', ''], ['format(x, 2)', 'Zahl als Text in der Sprache der Spalte (de 1,39)']]],
  ['Text', [['len(s)', 'Länge'], ['upper(s)', ''], ['lower(s)', ''], ['capitalize(s)', 'erster Buchstabe gross'], ['title(s)', 'Jedes Wort Gross'], ['trim(s)', 'Leerraum an den Enden weg'], ['trimstart(s)', ''], ['trimend(s)', ''], ['squeeze(s)', 'mehrfachen Leerraum zu einem'],
    ['left(s, 3)', ''], ['right(s, 3)', ''], ['substr(s, 2, 5)', 'ab Position, so lang'], ['indexof(s, "x")', 'Position oder -1'], ['contains(s, "x")', ''], ['startswith(s, "x")', ''], ['endswith(s, "x")', ''], ['count(s, "x")', 'wie oft'],
    ['replace(s, "a", "b")', ''], ['split(s, "-", 1)', 'Teil i'], ['repeat(s, 3)', ''], ['reverse(s)', ''], ['padleft(s, 5, "0")', 'links auffüllen'], ['padright(s, 5, " ")', 'rechts auffüllen'],
    ['regextest(s, "^[0-9]+$")', 'passt?'], ['regexmatch(s, "([0-9]+)")', 'erster Treffer bzw. Gruppe 1'], ['regexreplace(s, "\\s+", " ")', ''],
    ['striphtml(s)', 'Tags weg'], ['escapehtml(s)', '< > & " maskieren'], ['nl2br(s)', 'Zeilenumbruch → <br>'], ['slug(s)', 'url-tauglich: kleinbuchstaben-mit-strichen'],
    ['str(x)', 'als Text'], ['number(x)', 'als Zahl']]],
  ['Leer', [['isblank(x)', 'fehlt oder leer'], ['coalesce(a, b)', 'das erste, das nicht leer ist']]],
]
const EXAMPLE_FORMULA = 'h = $height\nif (h >= 100) {\n  return `${format(h / 100, 2)} m`\n}\nreturn `${h} cm`'
const EXAMPLE_TEMPLATE = '{name} mit {cpu}[, {ram} GB RAM][, {ssd|unit} SSD][ · {weight|1|unit}]'
const EXAMPLE = computed(() => isTemplate.value ? EXAMPLE_TEMPLATE : EXAMPLE_FORMULA)
const HELP_TEMPLATE = [
  ['Platzhalter', [['{key}', 'Wert am Knoten — geerbt zählt, Text in der Sprache der Spalte, Werteliste als Label. { tippen zeigt die Liste']]],
  ['Zusätze', [['{weight|unit}', 'Einheit anhängen: 1,5 kg'], ['{price|2}', 'Nachkommastellen in der Sprache (de 1,50)'], ['{weight|1|unit}', 'verkettet'], ['{name|upper}', 'GROSS'], ['{name|lower}', 'klein'], ['{name|capitalize}', 'Erster gross'], ['{description|plain}', 'HTML-Tags weg']]],
  ['Optional', [['[, {ram} GB RAM]', 'fällt ganz weg, wenn ein Platzhalter darin leer ist'], ['[ · {a}[ / {b}]]', 'darf ineinander liegen']]],
  ['Zeichen', [['\\{', '{ selbst'], ['\\[', '[ selbst']]],
]
</script>

<template>
  <Teleport to="body">
    <div class="overlay" @mousedown.self="emit('close')" @keydown="onKey">
      <div class="editor">
        <div class="toolbar">
          <h1>{{ isTemplate ? '{}' : 'ƒ' }} {{ title }}</h1>
          <span v-if="check.ok" class="pos" title="Syntax stimmt">✓ {{ check.keys.length ? 'liest ' + check.keys.map(k => isTemplate ? '{' + k + '}' : '$' + k).join(', ') : 'ok' }}</span>
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
              <div v-for="(a, i) in ac.items" :key="a.show" class="acrow" :class="{ on: i === ac.i }" @mousedown.prevent="acPick(a)">
                <span :class="a.kind === 'attr' ? 'a' : a.kind === 'fn' ? 'f' : 'k'">{{ a.show }}</span><span class="muted">{{ a.note }}</span>
              </div>
            </div>
          </div>
          <div v-if="help" class="help">
            <div v-for="[h, items] in (isTemplate ? HELP_TEMPLATE : HELP)" :key="h" class="hrow"><b>{{ h }}</b>
              <div v-for="[code, note] in items" :key="code" class="hitem" @click="insert(code)" title="Klick fügt es ein"><code class="hs" v-html="isTemplate ? highlightTemplate(code) : highlight(code)"></code><span v-if="note" class="muted">{{ note }}</span></div>
            </div>
            <div class="hrow"><b>Beispiel</b><pre class="hs ex" @click="insert(EXAMPLE)" title="Klick fügt es ein" v-html="isTemplate ? highlightTemplate(EXAMPLE) : highlight(EXAMPLE)"></pre></div>
          </div>
        </div>
        <div class="toolbar" style="border-top:1px solid var(--line);border-bottom:0">
          <span v-if="check.runtime" class="neg" style="font-size:12px" :title="check.runtime">✗ {{ check.runtime }}</span>
          <span v-else-if="props.node && check.ok && text.trim()" class="result" :class="{ muted: check.value == null }" :title="check.value == null ? 'kein Ergebnis — ein gelesener Wert fehlt hier' : 'momentanes Ergebnis an diesem Knoten'">= {{ check.value ?? '—' }}</span>
          <span v-else class="muted" style="font-size:12px"><kbd>Ctrl+Enter</kbd> übernehmen · <kbd>Esc</kbd> schliessen (Entwurf bleibt)</span>
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
.result { font-family: var(--mono); font-size: 13px; white-space: pre-wrap; word-break: break-word; max-height: 4.5em; overflow: auto; }
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
.hitem { display: flex; gap: 10px; align-items: baseline; padding: 1px 4px; border-radius: 3px; cursor: pointer; }
.hitem:hover { background: var(--hover); }
.hitem code { font: 12px var(--mono); white-space: pre; }
.hitem .muted { font-size: 11px; }
.ex { margin: 0; padding: 6px; background: var(--cell); border-radius: 4px; cursor: pointer; font: 12px/1.5 var(--mono); }
.help :deep(.c) { color: var(--muted); font-style: italic; }
.help :deep(.s) { color: #9ccc65; } .help :deep(.t) { color: #ffd54f; } .help :deep(.a) { color: #64b5f6; font-weight: 600; } .help :deep(.n) { color: #ffb74d; } .help :deep(.k) { color: #ce93d8; font-weight: 600; } .help :deep(.f) { color: #4dd0e1; }
.acrow .f { font-family: var(--mono); color: #4dd0e1; }
.acrow .k { font-family: var(--mono); color: #ce93d8; font-weight: 600; }
.chips { display: flex; flex-wrap: wrap; gap: 4px; }
.chip { font: 11px var(--mono); padding: 1px 6px; }
</style>
