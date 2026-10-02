// EmpCo: der Stand der Ansicht, ausserhalb der Komponente — wer einen Knoten öffnet und zurückkommt, steht wieder an derselben Stelle
// (Ergebnis, Auswahl, Filter), statt neu zu prüfen. Er lebt, solange die Seite offen ist.
import { reactive } from 'vue'

export const memory = reactive({
  root: null,          // der Teilbaum, für den das Ergebnis gilt
  result: null,        // { findings, nodes } oder null
  ignoredMap: {},      // Name in den Plugin-Daten → { term, reason, hash }
  rule: '', sev: [], text: '', showIgnored: false,
  mode: 'list',        // list | terms
  sel: null,           // Schlüssel des gewählten Befunds (list) oder der gewählten Begriffsgruppe (terms)
})

export function forget() {
  Object.assign(memory, { result: null, rule: '', sev: [], text: '', showIgnored: false, sel: null })
}
