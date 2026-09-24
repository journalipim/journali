// Prüfstand für Oberflächenteile (Taloan, 22.09.2026: „bau dir Prüfroutinen, dass ich nicht jeden Mist selbst testen muss“).
// Gilt für alle Dialoge und Fenster, die wir anfassen: hier steht der Rahmen, die Prüfungen je Bauteil stehen in ui-*.test.mjs.
// Ein echtes DOM (happy-dom) und die Vue-Testwerkzeuge — die Bauteile werden wirklich gezeichnet und bedient.
import { Window } from 'happy-dom'

const win = new Window({ url: 'http://localhost:5000/' })
// Alles, was ein Browser mitbringt, kommt aus happy-dom: die DOM-Klassen werden gebraucht, weil Vue in seinen Hooks
// dagegen prüft (fehlt eine, bricht das Zeichnen mitten im Update mit „X is not defined“ — und die Ansicht ist leer).
for (const k of ['window', 'document', 'navigator', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'location'])
  if (globalThis[k] === undefined) globalThis[k] = win[k]
for (const k of Object.getOwnPropertyNames(win))
  if (/^[A-Z]/.test(k) && globalThis[k] === undefined && typeof win[k] === 'function') globalThis[k] = win[k]
const store = () => ({ _d: new Map(), getItem(k) { return this._d.get(k) ?? null }, setItem(k, v) { this._d.set(k, String(v)) }, removeItem(k) { this._d.delete(k) }, clear() { this._d.clear() } })
globalThis.localStorage ??= store()
globalThis.sessionStorage ??= store()
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
globalThis.fetch ??= async () => ({ ok: false, status: 0, json: async () => null, text: async () => '' })
if (!document.execCommand) document.execCommand = (cmd, _ui, arg) => { const el = document.activeElement; if (cmd === 'insertHTML' && el) el.innerHTML += arg; return true }

export { win }
const vtu = await import('@vue/test-utils')
// Oberflächensprache (24.09.2026): $t in jeder Vorlage — im Test immer deutsch, der Schlüssel ist der Text
// vue-i18n warnt im Entwicklungsbau vor dem eigenen Nachrichten-Übersetzer — gewollt, also still (vor dem Laden!)
const warn = console.warn; console.warn = (...a) => { if (!String(a[0]).includes('Custom Message Compiler')) warn(...a) }
const { i18n, t, L } = await import('../src/i18n.js')
globalThis.journali = Object.assign(globalThis.journali ?? {}, { i18n, t, L })   // was Plugins im Browser aus window.journali bekommen
vtu.config.global.plugins = [...(vtu.config.global.plugins ?? []), i18n]
vtu.config.global.mocks = { ...(vtu.config.global.mocks ?? {}), $L: L }   // Bezeichnungen des Modells in der Oberflächensprache, wie $L in main.js
export const { mount, flushPromises } = vtu

/// Text eines Bauteils ohne Leerzeichenrauschen — zum Prüfen von Beschriftungen
export const textOf = w => w.text().replace(/\s+/g, ' ').trim()
/// Knopf mit dieser Beschriftung (Teiltext genügt); wirft, wenn es ihn nicht gibt
export const button = (w, label) => {
  const b = w.findAll('button').find(x => x.text().replace(/\s+/g, ' ').includes(label))
  if (!b) throw new Error(`Knopf „${label}“ fehlt — da sind: ${w.findAll('button').map(x => x.text().trim()).join(' | ')}`)
  return b
}
/// Knopf im ganzen Dokument (Dialoge und Editoren hängen per Teleport am body) — klickt ihn gleich an
export const domButton = label => {
  const all = [...document.querySelectorAll('button')]
  const b = all.find(x => (x.textContent ?? '').replace(/\s+/g, ' ').includes(label))
  if (!b) throw new Error(`Knopf „${label}“ fehlt — da sind: ${all.map(x => (x.textContent ?? '').trim()).filter(Boolean).join(' | ')}`)
  return { trigger: async () => { b.dispatchEvent(new win.MouseEvent('click', { bubbles: true })); await new Promise(r => setTimeout(r, 0)) }, el: b }
}
/// steht das Bauteil im Fluss (schiebt also Nachbarn) oder schwebt es darüber?
export const floats = el => { const s = win.getComputedStyle(el); return s.position === 'absolute' || s.position === 'fixed' }
/// Taste an ein Element (oder ans Fenster) schicken — so, wie der Browser es täte
export const press = (key, { target = document.body, ctrl = false } = {}) =>
  target.dispatchEvent(new win.KeyboardEvent('keydown', { key, ctrlKey: ctrl, bubbles: true, cancelable: true }))
