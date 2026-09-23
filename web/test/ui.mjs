// Prüfstand für Oberflächenteile (Taloan, 22.09.2026: „bau dir Prüfroutinen, dass ich nicht jeden Mist selbst testen muss“).
// Gilt für alle Dialoge und Fenster, die wir anfassen: hier steht der Rahmen, die Prüfungen je Bauteil stehen in ui-*.test.mjs.
// Ein echtes DOM (happy-dom) und die Vue-Testwerkzeuge — die Bauteile werden wirklich gezeichnet und bedient.
import { Window } from 'happy-dom'

const win = new Window({ url: 'http://localhost:5000/' })
for (const k of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'SVGElement', 'CustomEvent', 'Event', 'KeyboardEvent', 'MouseEvent', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'DOMParser', 'location'])
  if (globalThis[k] === undefined) globalThis[k] = win[k]
const store = () => ({ _d: new Map(), getItem(k) { return this._d.get(k) ?? null }, setItem(k, v) { this._d.set(k, String(v)) }, removeItem(k) { this._d.delete(k) }, clear() { this._d.clear() } })
globalThis.localStorage ??= store()
globalThis.sessionStorage ??= store()
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
globalThis.fetch ??= async () => ({ ok: false, status: 0, json: async () => null, text: async () => '' })
if (!document.execCommand) document.execCommand = (cmd, _ui, arg) => { const el = document.activeElement; if (cmd === 'insertHTML' && el) el.innerHTML += arg; return true }

export { win }
export const { mount, flushPromises } = await import('@vue/test-utils')

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
