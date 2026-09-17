import { createRouter, createWebHistory } from 'vue-router'
import TreeView from './views/TreeView.vue'
import JournalView from './views/JournalView.vue'
import ModelView from './views/ModelView.vue'
import ImportView from './views/ImportView.vue'
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
    { path: '/import', component: ImportView },
    { path: '/import/solr', component: SolrView },
    { path: '/import/table', component: TableImportView },
    { path: '/media', component: MediaView },
    { path: '/plugins', component: PluginsView },
    { path: '/p/:key/:path', component: PluginHost },
    { path: '/settings', component: SettingsView },
  ],
})
