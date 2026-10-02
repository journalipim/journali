// Konfigurator: eine Regel als Satz — für die Zeile unter dem Formular. t übersetzt, nodeName nennt einen Knoten.
const op = c => ({ '=': '=', '!=': '≠', '>': '>', '>=': '≥', '<': '<', '<=': '≤' })[c] ?? c

export function describeSelector(s, { t, nodeName, attributeName = k => k }) {
  const filter = s?.attribute ? `${attributeName(s.attribute)} ${op(s.comparison)} ${s.value ?? ''}`.trim() : ''
  if (s?.node && filter) return `${nodeName(s.node)} (${filter})`
  if (s?.node) return nodeName(s.node)
  return filter || t('jedes Teil')
}

export function describeCondition(c, ctx) {
  const { t } = ctx
  const sel = () => describeSelector(c.selector, ctx)
  switch (c.kind) {
    case 'has': return (c.value ?? 1) > 1 ? t('mindestens {0} × {1} gewählt', [c.value, sel()]) : t('{0} gewählt', [sel()])
    case 'count': return t('Anzahl {0} {1} {2}', [sel(), op(c.comparison), c.value ?? ''])
    case 'sum': return t('Summe {0} von {1} {2} {3}', [ctx.attributeName?.(c.attribute) ?? c.attribute ?? '', sel(), op(c.comparison), c.value ?? ''])
    case 'balance': return t('Bilanz {0} {1} {2}', [c.resource ?? '', op(c.comparison), c.value ?? ''])
    case 'and': return (c.parts ?? []).map(p => describeCondition(p, ctx)).join(t(' und '))
    case 'or': return (c.parts ?? []).map(p => describeCondition(p, ctx)).join(t(' oder '))
    case 'not': return t('nicht ({0})', [describeCondition(c.parts?.[0] ?? { kind: 'has', selector: {} }, ctx)])
    default: return ''
  }
}

export function describeEffect(e, ctx) {
  const { t } = ctx
  const sel = describeSelector(e?.selector, ctx)
  switch (e?.kind) {
    case 'forbids': return t('{0} verboten', [sel])
    case 'limits': return t('höchstens {0} von {1}', [e.max ?? 0, sel])
    case 'requires': return t('mindestens {0} von {1} verlangt', [e.min ?? 1, sel])
    default: return ''
  }
}

export function describeRule(r, ctx) {
  const then = describeEffect(r.then, ctx)
  return r.if ? ctx.t('Wenn {0}, dann {1}', [describeCondition(r.if, ctx), then]) : ctx.t('Immer: {0}', [then])
}
