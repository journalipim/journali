// Ein Dialog für die ganze Oberfläche statt window.confirm/prompt.
// dialog.confirm({ title, text, ok, danger }) → true/false; dialog.prompt({ title, text, value, placeholder, secret }) → Text oder null.
// secret: true macht ein Passwortfeld — die Eingabe steht dann nicht lesbar auf dem Schirm.
// Enter bestätigt, Esc bricht ab; der Rest der Oberfläche ist solange gesperrt. Eingehängt in App.vue (Dialog.vue).
import { reactive } from 'vue'
import { t } from './i18n.js'

export const dialog = reactive({
  open: false,
  kind: 'confirm',        // confirm | prompt
  title: '', text: '', warn: '', list: [], ok: 'OK', cancel: t('Abbrechen'), danger: false,
  option: null,           // { label, checked } — ein Schalter im Dialog (z. B. „fehlende Gruppen anhängen“); Stand nach dem Dialog in dialog.option.checked
  extra: null,            // { label, type, value } — ein zweites Feld (Status ab Datum); Wert nach dem Dialog in dialog.extra.value
  value: '', placeholder: '',
  _resolve: null,

  // warn: das Wesentliche, gross und in Warnfarbe (was alles mit weg ist); list: Namen dazu
  confirm({ title, text = '', warn = '', list = [], ok = 'OK', cancel = t('Abbrechen'), danger = false, option = null }) {
    return new Promise(resolve => { Object.assign(this, { open: true, kind: 'confirm', title, text, warn, list, ok, cancel, danger, option: option ? { ...option } : null, extra: null, _resolve: resolve }) })
  },
  // help: Tabelle Taste/Geste → Wirkung, nur ein Schliessen-Knopf (das ? in einer Leiste)
  // lange Fehlermeldung als Fenster: erster Satz als Kopf, die Teile nach „ · “ als Zeilen (store.toast leitet hierher)
  error(text) { const s = String(text); const lines = s.includes('\n') ? s.split('\n') : null; const head = lines ? lines[0] : s.split(' — ')[0]; const parts = lines ? lines.slice(1) : (s.split(' — ').slice(1).join(' — ') || '').split(' · ').filter(Boolean); return this.help({ title: '✗ ' + head, rows: parts.map(p => ['•', p.replace(/^•\s*/, '')]) }) },
  help({ title, rows = [], text = '' }) {
    return new Promise(resolve => { Object.assign(this, { open: true, kind: 'help', title, text, warn: '', list: rows, ok: t('Schliessen'), cancel: '', danger: false, option: null, extra: null, _resolve: resolve }) })
  },
  // choices: [{ value, label }] → Auswahl statt Eingabe; extra: { label, type, value } → ein zweites Feld darunter
  prompt({ title, text = '', value = '', placeholder = '', ok = 'OK', cancel = t('Abbrechen'), warn = '', danger = false, choices = null, secret = false, extra = null }) {
    return new Promise(resolve => { Object.assign(this, { open: true, kind: 'prompt', title, text, warn, list: [], value, placeholder, ok, cancel, danger, option: null, extra: extra ? { type: 'text', value: '', ...extra } : null, choices, secret, _resolve: resolve }) })
  },
  // Transform-Kette bearbeiten (StepsEditor). value: Array [{ op, ... }], attributes: [{ key, label }],
  // values: { key: aktueller Wert } fuer Vorschau. Rueckgabe: das neue Steps-Array oder null (Abbruch).
  steps({ title, text = '', value = [], attributes = [], values = {}, ok = 'OK', cancel = t('Abbrechen') }) {
    return new Promise(resolve => { Object.assign(this, { open: true, kind: 'steps', title, text, warn: '', list: [], value: Array.isArray(value) ? [...value] : [], ok, cancel, danger: false, option: null, extra: null, attributes, sourceValues: values, _resolve: resolve }) })
  },
  done(yes) {
    const r = this._resolve; this.open = false; this._resolve = null
    r?.(this.kind === 'prompt' ? (yes ? this.value : null)
      : this.kind === 'steps' ? (yes ? this.value : null)
      : yes)
  },
})
