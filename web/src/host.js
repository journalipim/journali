// Der Rahmen für gebaute Plugins (Taloan, 19.09.2026: Basis-Plugins wie Tabelle, Datenanalyse, Jobs liegen in plugins/
// und werden ohne neues Image ausgetauscht — ihre Ansichten sind Vue-Komponenten). Ein gebautes Plugin importiert
// `vue`, `vue-router` und `journali`; der Bau (web/build-plugins.mjs) biegt diese Importe auf window.journali um,
// so dass Plugin und Oberfläche dieselben Instanzen teilen — ein Vue, ein Router, ein Baum, ein Store.
import * as vue from 'vue'
import * as vueRouter from 'vue-router'
import { api } from './api.js'
import { store } from './store.js'
import { tree, icon } from './tree.js'
import * as mapper from './mapper.js'
import * as transform from './transform.js'
import { recentFiles } from './recentFiles.js'
import { dialog } from './dialog.js'
import { treePicker } from './treePicker.js'
import { paneWidth } from './panes.js'
import { plugins } from './plugins.js'
import { menu } from './menu.js'
import * as orphans from './orphans.js'
import * as compliance from './compliance.js'
import { ai } from './ai.js'
import Splitter from './components/Splitter.vue'
import ImportHead from './components/ImportHead.vue'
import ProfileBar from './components/ProfileBar.vue'
import TreePicker from './components/TreePicker.vue'

/// Was ein Plugin mit `import { … } from 'journali'` bekommt — die Namen stehen auch in web/build-plugins.mjs (Shim)
export const host = { vue, vueRouter, api, store, tree, icon, mapper, transform, recentFiles, dialog, treePicker, paneWidth, plugins, menu, orphans, compliance, ai, Splitter, ImportHead, ProfileBar, TreePicker }
window.journali = host
