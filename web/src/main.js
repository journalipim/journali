import { createApp } from 'vue'
import './host.js'   // window.journali für gebaute Plugins (Basis-Plugins mit Vue-Ansichten)
import App from './App.vue'
import { router } from './router.js'
import { store } from './store.js'
import { i18n, setLang, L } from './i18n.js'
import './style.css'

const app = createApp(App).use(router).use(i18n)
app.config.globalProperties.$L = L   // Bezeichnungen des Modells in der Oberflächensprache: {{ $L(a.label) }}
app.mount('#app')
setLang(store.lang)   // die Sprache der Person (oder des Browsers) — die Datei kommt einmal vom Server
store.start()
// lange Fehlermeldungen als Fenster statt Toast
import { store as _store } from './store.js'
import { dialog as _dialog } from './dialog.js'
_store.longError = text => _dialog.error(text)
