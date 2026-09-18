// Ein Dialog für die ganze Oberfläche statt window.confirm/prompt (Taloan, 18.09.: „hässlicher Browser-Dialog“).
// dialog.confirm({ title, text, ok, danger }) → true/false; dialog.prompt({ title, text, value, placeholder }) → Text oder null.
// Enter bestätigt, Esc bricht ab; der Rest der Oberfläche ist solange gesperrt. Eingehängt in App.vue (Dialog.vue).
import { reactive } from 'vue'

export const dialog = reactive({
  open: false,
  kind: 'confirm',        // confirm | prompt
  title: '', text: '', warn: '', list: [], ok: 'OK', cancel: 'Abbrechen', danger: false,
  value: '', placeholder: '',
  _resolve: null,

  // warn: das Wesentliche, gross und in Warnfarbe (was alles mit weg ist); list: Namen dazu
  confirm({ title, text = '', warn = '', list = [], ok = 'OK', cancel = 'Abbrechen', danger = false }) {
    return new Promise(resolve => { Object.assign(this, { open: true, kind: 'confirm', title, text, warn, list, ok, cancel, danger, _resolve: resolve }) })
  },
  prompt({ title, text = '', value = '', placeholder = '', ok = 'OK', cancel = 'Abbrechen' }) {
    return new Promise(resolve => { Object.assign(this, { open: true, kind: 'prompt', title, text, warn: '', list: [], value, placeholder, ok, cancel, danger: false, _resolve: resolve }) })
  },
  done(yes) {
    const r = this._resolve; this.open = false; this._resolve = null
    r?.(this.kind === 'prompt' ? (yes ? this.value : null) : yes)
  },
})
