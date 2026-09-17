// Zuletzt benutzte Werte eines Feldes (Quell-URLs im Import), im localStorage, neueste zuerst.
const KEY = 'journali.recent.'

export function recent(name) {
  try { return JSON.parse(localStorage.getItem(KEY + name) || '[]') } catch { return [] }
}

/// Wert nach vorn stellen, höchstens zehn behalten. Liefert die neue Liste.
export function remember(name, value) {
  const v = (value ?? '').trim()
  if (!v) return recent(name)
  const list = [v, ...recent(name).filter(x => x !== v)].slice(0, 10)
  localStorage.setItem(KEY + name, JSON.stringify(list))
  return list
}
