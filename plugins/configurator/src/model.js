// Konfigurator: die Definition (Regeln) als Daten, ohne Oberfläche — erzeugen, aufräumen, vergleichen.
// Die Namen sind die des Servers (Journali.Core/Configurator/Definition.cs); sie stehen im Journal.

export const COMPARISONS = ['=', '!=', '>', '>=', '<', '<=']
export const CONDITION_KINDS = ['has', 'count', 'sum', 'balance', 'and', 'or', 'not']
export const EFFECT_KINDS = ['forbids', 'limits', 'requires']
export const KEY_PATTERN = /^[a-z][a-z0-9_-]{0,39}$/

export const emptyDefinition = (label = '') => ({ label, rules: [] })

/// Eine neue Bedingung der Art kind — mit den Feldern, die diese Art braucht
export function newCondition(kind) {
  switch (kind) {
    case 'has': return { kind, selector: {}, value: 1 }
    case 'count': return { kind, selector: {}, comparison: '>=', value: 1 }
    case 'sum': return { kind, selector: {}, attribute: '', comparison: '>', value: 0 }
    case 'balance': return { kind, resource: '', comparison: '<=', value: 0 }
    case 'and': case 'or': case 'not': return { kind, parts: [newCondition('has')] }
    default: return { kind: 'has', selector: {}, value: 1 }
  }
}

export function newEffect(kind) {
  switch (kind) {
    case 'limits': return { kind, selector: {}, max: 1 }
    case 'requires': return { kind, selector: {}, min: 1 }
    default: return { kind: 'forbids', selector: {} }
  }
}

/// r1, r2 … — die erste Kennung, die noch frei ist
export function nextRuleId(rules) {
  const used = new Set((rules ?? []).map(r => r.id))
  for (let i = 1; ; i++) if (!used.has('r' + i)) return 'r' + i
}

const blank = v => v === undefined || v === null || (typeof v === 'string' && v.trim() === '')
const number = v => { if (blank(v)) return undefined; const n = Number(v); return Number.isFinite(n) ? n : undefined }

export function cleanSelector(s) {
  const o = {}
  if (!blank(s?.node)) o.node = String(s.node)
  if (!blank(s?.attribute)) {
    o.attribute = String(s.attribute).trim()
    if (!blank(s.comparison)) o.comparison = s.comparison
    if (!blank(s.value)) o.value = String(s.value)
  }
  return o
}

export function cleanCondition(c) {
  const o = { kind: c.kind }
  if (c.selector) o.selector = cleanSelector(c.selector)
  if (!blank(c.attribute)) o.attribute = String(c.attribute).trim()
  if (!blank(c.resource)) o.resource = String(c.resource).trim()
  if (!blank(c.comparison)) o.comparison = c.comparison
  if (number(c.value) !== undefined) o.value = number(c.value)
  if (c.parts) o.parts = c.parts.map(cleanCondition)
  return o
}

// ---- Konfiguratorgruppen (docs/pflegestruktur.md 40): die Zeilen eines Teils und die Grenzen eines Konfigurators

const has = v => !blank(v)
const text = v => Array.isArray(v) ? v.join(', ') : String(v ?? '')
/// Die erlaubten Werte als Liste: aus der Eingabe „8, 32“ oder aus einer Liste
export const valuesOf = v => (Array.isArray(v) ? v : String(v ?? '').split(',')).map(x => String(x).trim()).filter(Boolean)
/// Die erlaubten Werte als Eingabetext (die Eingabe geht vor, solange sie getippt wird)
export const valuesText = x => x?.valuesText !== undefined ? x.valuesText : text(x?.values)

/// Mitglied (stellt bereit, verbraucht, Wert) oder Vorgabe (Mindest-, Höchstmenge, erlaubte Werte) — wie der Server sie unterscheidet
export const ROW_KINDS = ['member', 'limit']
export const isLimit = r => has(r?.min) || has(r?.max) || valuesOf(r?.values).length > 0 || valuesOf(r?.valuesText).length > 0
export const rowKind = r => r?.art ?? (isLimit(r) ? 'limit' : 'member')
export const newRow = (art = 'member', group = '') => ({ art, group })

/// Eine Zeile, wie sie gespeichert wird: ohne leere Felder, Zahlen als Zahlen, nur die Felder ihrer Art
export function cleanRow(r) {
  const o = { group: String(r?.group ?? '').trim() }
  if (r?.when) o.when = cleanCondition(r.when)
  if (rowKind(r) === 'limit') {
    if (number(r.min) !== undefined) o.min = number(r.min)
    if (number(r.max) !== undefined) o.max = number(r.max)
    const values = valuesOf(r.valuesText !== undefined ? r.valuesText : r.values)
    if (values.length) o.values = values
  } else {
    if (number(r.provides) !== undefined) o.provides = number(r.provides)
    if (number(r.consumes) !== undefined) o.consumes = number(r.consumes)
    if (has(r.value)) o.value = String(r.value).trim()
  }
  return o
}
export const cleanRows = rows => (rows ?? []).map(cleanRow)

/// Eine Grenze am Konfigurator: Gruppe, Mindest-, Höchstmenge, erlaubte Werte
export function cleanLimit(l) {
  const o = { group: String(l?.group ?? '').trim() }
  if (number(l.min) !== undefined) o.min = number(l.min)
  if (number(l.max) !== undefined) o.max = number(l.max)
  const values = valuesOf(l.valuesText !== undefined ? l.valuesText : l.values)
  if (values.length) o.values = values
  return o
}
export const cleanLimits = limits => (limits ?? []).map(cleanLimit)

/// Was gespeichert wird: ohne leere Felder, Zahlen als Zahlen
export function cleanDefinition(def) {
  const out = {}
  if (!blank(def?.label)) out.label = String(def.label).trim()
  if (!blank(def?.root)) out.root = def.root
  if (!blank(def?.resources)) out.resources = String(def.resources).trim()
  out.rules = (def?.rules ?? []).map(r => {
    const rule = { id: String(r.id ?? '').trim() }
    if (!blank(r.text)) rule.text = String(r.text).trim()
    if (r.if) rule.if = cleanCondition(r.if)
    if (r.then) {
      const e = { kind: r.then.kind, selector: cleanSelector(r.then.selector) }
      if (number(r.then.min) !== undefined) e.min = number(r.then.min)
      if (number(r.then.max) !== undefined) e.max = number(r.then.max)
      rule.then = e
    }
    return rule
  })
  const limits = cleanLimits(def?.limits)
  if (limits.length) out.limits = limits
  return out
}

/// Der Schlüssel eines Verstosses: Regel, oder Art und Gruppe (balance:paste, max:ram). Bei Testfällen von vorher steht „balance:<ressource>“ — dasselbe.
export const violationKey = v => v.group ? v.kind + ':' + v.group : 'rule:' + v.rule

/// Was ein Testfall von einem Ergebnis erwartet
export const expectFrom = r => ({
  valid: !!r.valid, complete: !!r.complete,
  violations: (r.violations ?? []).map(violationKey).sort(),
  missing: (r.missing ?? []).map(violationKey).sort(),
})

/// Stimmt das Ergebnis mit der Erwartung überein? differences nennt, was abweicht (für die Anzeige)
export function compareCase(expect, result) {
  const actual = expectFrom(result)
  const diff = []
  if (expect.valid !== actual.valid) diff.push({ what: 'valid', expected: expect.valid, actual: actual.valid })
  if (expect.complete !== actual.complete) diff.push({ what: 'complete', expected: expect.complete, actual: actual.complete })
  for (const list of ['violations', 'missing']) {
    const want = new Set(expect[list] ?? []), have = new Set(actual[list])
    for (const k of want) if (!have.has(k)) diff.push({ what: list, expected: k, actual: null })
    for (const k of have) if (!want.has(k)) diff.push({ what: list, expected: null, actual: k })
  }
  return { ok: diff.length === 0, differences: diff }
}

/// Die einfachen Formen einer Regel — was die meisten Regeln sind. excludes: A und B passen nicht zusammen · needs: A braucht B · max: höchstens n von A · min: mindestens n von A
export const TEMPLATES = ['excludes', 'needs', 'max', 'min']

export function templateRule(id, kind) {
  switch (kind) {
    case 'excludes': return { id, text: '', if: { kind: 'has', selector: {}, value: 1 }, then: { kind: 'forbids', selector: {} } }
    case 'needs': return { id, text: '', if: { kind: 'has', selector: {}, value: 1 }, then: { kind: 'requires', selector: {}, min: 1 } }
    case 'max': return { id, text: '', then: { kind: 'limits', selector: {}, max: 1 } }
    case 'min': return { id, text: '', then: { kind: 'requires', selector: {}, min: 1 } }
    default: return { id, text: '', then: newEffect('forbids') }
  }
}

/// Welche einfache Form hat diese Regel? null = keine, sie braucht den technischen Editor (Summe, Bilanz, und/oder/nicht, mehrere Teile …)
export function templateOf(r) {
  const einfach = !r.if || (r.if.kind === 'has' && (r.if.value ?? 1) <= 1)
  if (!einfach) return null
  if (r.if && r.then?.kind === 'forbids') return 'excludes'
  if (r.if && r.then?.kind === 'requires') return 'needs'
  if (!r.if && r.then?.kind === 'limits') return 'max'
  if (!r.if && r.then?.kind === 'requires') return 'min'
  return null
}
