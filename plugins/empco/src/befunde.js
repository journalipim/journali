// EmpCo, Befunde ohne Oberfläche: aus den Tabellen der Teilbäume die Befunde bilden, Geerbtes zusammenfassen, nach Begriff gruppieren,
// den Ausschnitt mit dem Begriff zeigen, ersetzen — und eine Ausnahme erkennen, solange der Text derselbe ist.
import { strip, rx, checks, catalog } from './checks.js'

const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) }
export const textHash = raw => hash(strip(raw))

/// Der Schlüssel eines Befunds: Knoten, Feld, Sprache, Regel, Begriff
export const findingKey = f => [f.node.id, f.attribute, f.locale, f.rule, f.term.toLowerCase()].join('|')

/// Alle Befunde aus den Tabellen (je Sprache eine). Ein Wert, der am Knoten nicht selbst steht (`from`), wird dem Knoten zugeschlagen, von dem er kommt —
/// ist der in der Prüfung, hat er den Befund; die erbenden Knoten stehen dort als `heirs`, nicht noch einmal als eigene Zeile.
export function collect(tables, locales) {
  const findings = []
  for (let i = 0; i < locales.length; i++) findings.push(...rawFindings(tables[i], locales[i]))
  return merge(findings)
}

/// Die Befunde einer Tabelle (oder einer Seite davon) in einer Sprache — noch nicht zusammengefasst
export function rawFindings(t, locale) {
  const findings = []
  for (const r of t.rows) {
    const columns = t.columns.filter(x => !(r.inactive ?? []).includes(x.key))
    for (const c of checks) for (const f of c.run({ values: r.values, columns })) {
      const v = r.values[f.attribute]
      findings.push({ ...f, rule: c.key, severity: c.severity, locale, node: r.row, raw: v?.value ?? '', from: v?.from ?? null, heirs: [] })
    }
  }
  return findings
}

/// Geerbtes zusammenfassen: ein Befund an einem geerbten Wert geht an den Knoten, von dem der Wert kommt (als heirs)
export function merge(findings) {
  const byKey = new Map(findings.filter(f => !f.from).map(f => [findingKey(f), f]))
  const out = []
  for (const f of findings) {
    const origin = f.from ? byKey.get([f.from, f.attribute, f.locale, f.rule, f.term.toLowerCase()].join('|')) : null
    if (origin) origin.heirs.push(f.node)
    else out.push(f)
  }
  return out
}

/// Der Knoten, an dem der Wert steht (und geändert wird): der eigene oder der, von dem er kommt
export const targetId = f => f.from ?? f.node.id

/// Ein Ausschnitt um den Begriff, ohne Markup: { before, term, after } — die Ränder mit … gekürzt
export function snippet(raw, term, around = 48) {
  const s = strip(raw); const i = term ? s.toLowerCase().indexOf(term.toLowerCase()) : -1
  if (i < 0) return { before: s.length > around * 2 ? s.slice(0, around * 2) + '…' : s, term: '', after: '' }
  const a = Math.max(0, i - around), b = Math.min(s.length, i + term.length + around)
  return { before: (a > 0 ? '…' : '') + s.slice(a, i), term: s.slice(i, i + term.length), after: s.slice(i + term.length, b) + (b < s.length ? '…' : '') }
}

/// Den Begriff in einem Wert ersetzen — im Wert selbst, auch mit Markup; alle Fundstellen, ohne Beachtung der Gross- und Kleinschreibung. Ersetzt wird die Grundform,
/// die Endung bleibt (umweltfreundliches → ressourcenschonendes), damit der Satz bleibt, wie er gebaut war.
export function replace(raw, ruleId, term, replacement) {
  const rule = catalog.rules.find(r => r.id === ruleId)
  const r = rule ? rx(rule) : new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
  return String(raw ?? '').replace(new RegExp(r.source, r.flags.replace('g', '') + 'g'), (m, base, ending) => (typeof base === 'string' ? replacement + (typeof ending === 'string' ? ending : '') : replacement))
}

/// Gleiche Begriffe zusammen: je Regel und Grundform (ohne Beachtung der Schreibweise und der Endung) eine Gruppe mit ihren Befunden
export function byTerm(findings) {
  const groups = new Map()
  for (const f of findings) {
    const base = f.base ?? f.term
    const k = f.rule + '|' + base.toLowerCase()
    if (!groups.has(k)) groups.set(k, { key: k, rule: f.rule, severity: f.severity, term: base, findings: [] })
    groups.get(k).findings.push(f)
  }
  return [...groups.values()].sort((a, b) => b.findings.length - a.findings.length || a.term.localeCompare(b.term, 'de'))
}

/// Der Name einer Ausnahme in den Plugin-Daten — ohne Zeichen, die dort nicht gehen
export const ignoreName = f => `ignore:${f.node.id}:${f.attribute}:${f.locale}:${f.rule}:${hash(f.term.toLowerCase())}`
/// Gilt eine Ausnahme noch? Nur solange der Text derselbe ist, für den sie gegeben wurde
export const ignored = (f, map) => { const e = map?.[ignoreName(f)]; return !!e && e.hash === textHash(f.raw) }

/// Die Filter der Liste: Regel, Schwere, Text, Ausnahmen
export function filter(findings, { rule = '', sev = [], text = '', showIgnored = false } = {}, ignoredMap = {}) {
  const q = text.trim().toLowerCase()
  return findings.filter(f =>
    (!rule || f.rule === rule) && (!sev.length || sev.includes(f.severity)) &&
    (showIgnored || !ignored(f, ignoredMap)) &&
    (!q || f.node.label.toLowerCase().includes(q) || f.attribute.toLowerCase().includes(q) || f.term.toLowerCase().includes(q)))
}

/// Befunde je Regel — für die Leiste der Regeln (ohne den Regelfilter selbst, damit die Zahlen die Menge zeigen, die ein Klick ergäbe)
export function countsByRule(findings) {
  const c = {}
  for (const f of findings) c[f.rule] = (c[f.rule] ?? 0) + 1
  return c
}
