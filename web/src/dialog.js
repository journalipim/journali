// Ein Dialog für die ganze Oberfläche statt window.confirm/prompt (Taloan, 18.09.: „hässlicher Browser-Dialog“).
// dialog.confirm({ title, text, ok, danger }) → true/false; dialog.prompt({ title, text, value, placeholder }) → Text oder null.
// Enter bestätigt, Esc bricht ab; der Rest der Oberfläche ist solange gesperrt. Eingehängt in App.vue (Dialog.vue).
import { reactive } from 'vue'

export const dialog = reactive({
  open: false,
  kind: 'confirm',        // confirm | prompt
  title: '', text: '', warn: '', list: [], ok: 'OK', cancel: 'Abbrechen', danger: false,
  option: null,           // { label, checked } — ein Schalter im Dialog (z. B. „fehlende Gruppen anhängen“); Stand nach dem Dialog in dialog.option.checked
  value: '', placeholder: '',
  _resolve: null,

  // warn: das Wesentliche, gross und in Warnfarbe (was alles mit weg ist); list: Namen dazu
  confirm({ title, text = '', warn = '', list = [], ok = 'OK', cancel = 'Abbrechen', danger = false, option = null }) {
    return new Promise(resolve => { Object.assign(this, { open: true, kind: 'confirm', title, text, warn, list, ok, cancel, danger, option: option ? { ...option } : null, _resolve: resolve }) })
  },
  // help: Tabelle Taste/Geste → Wirkung, nur ein Schliessen-Knopf (das ? in einer Leiste)
  help({ title, rows = [], text = '' }) {
    return new Promise(resolve => { Object.assign(this, { open: true, kind: 'help', title, text, warn: '', list: rows, ok: 'Schliessen', cancel: '', danger: false, option: null, _resolve: resolve }) })
  },
  prompt({ title, text = '', value = '', placeholder = '', ok = 'OK', cancel = 'Abbrechen', warn = '', danger = false, choices = null }) {   // choices: [{ value, label }] → Auswahl statt Eingabe
    return new Promise(resolve => { Object.assign(this, { open: true, kind: 'prompt', title, text, warn, list: [], value, placeholder, ok, cancel, danger, option: null, choices, _resolve: resolve }) })
  },
  done(yes) {
    const r = this._resolve; this.open = false; this._resolve = null
    r?.(this.kind === 'prompt' ? (yes ? this.value : null) : yes)
  },
})
