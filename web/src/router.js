import { createRouter, createWebHistory } from 'vue-router'
import TreeView from './views/TreeView.vue'
import JournalView from './views/JournalView.vue'
import ModelView from './views/ModelView.vue'
import ImportView from './views/ImportView.vue'
import JobsView from './views/JobsView.vue'
import DqView from './views/DqView.vue'
import HubView from './views/HubView.vue'
import TableExportView from './views/TableExportView.vue'
import SolrView from './views/SolrView.vue'
import TableImportView from './views/TableImportView.vue'
import TableEditView from './views/TableEditView.vue'
import MediaView from './views/MediaView.vue'
import PluginsView from './views/PluginsView.vue'
import PluginHost from './views/PluginHost.vue'
import SettingsView from './views/SettingsView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/tree' },
    { path: '/products', redirect: '/tree' },
    { path: '/tree', component: TreeView },
    { path: '/tree/:id', component: TreeView, props: true },
    { path: '/table/:id', component: TableEditView, props: r => ({ id: r.params.id, role: r.query.role, deep: r.query.deep }) },
    { path: '/journal', component: JournalView },
    { path: '/model', component: ModelView },
    // Themen (Taloan, 18.09.): erst das Thema, dann das Plugin — /import ist die Übersicht, die Quellen liegen darunter
    { path: '/import', component: HubView, props: { topic: 'import' } },
    { path: '/import/ixp', component: ImportView },
    { path: '/export', component: HubView, props: { topic: 'export' } },
    { path: '/datasheet', component: HubView, props: { topic: 'datasheet' } },
    { path: '/analysis', component: HubView, props: { topic: 'analysis' } },
    { path: '/analysis/dq', component: DqView },   // fest eingebaut (Taloan, 19.09.): Grundfunktion der Datenanalyse
    { path: '/tools', component: HubView, props: { topic: 'tools' } },
    { path: '/jobs', component: JobsView },   // fest eingebaut (Taloan, 19.09.): Grundfunktion, direkt — kein Hub
    { path: '/import/solr', component: SolrView },
    { path: '/import/table', component: TableImportView },
    { path: '/export/table', component: TableExportView },   // fest eingebaut wie der Tabellenimport (Taloan, 19.09.)
    { path: '/media', component: MediaView },
    { path: '/plugins', component: PluginsView },
    { path: '/p/:key/:path', component: PluginHost },
    { path: '/settings', component: SettingsView },
  ],
})
