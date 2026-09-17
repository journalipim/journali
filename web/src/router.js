import { createRouter, createWebHistory } from 'vue-router'
import TreeView from './views/TreeView.vue'
import JournalView from './views/JournalView.vue'
import ModelView from './views/ModelView.vue'
import ImportView from './views/ImportView.vue'
import SolrView from './views/SolrView.vue'
import MediaView from './views/MediaView.vue'
import SettingsView from './views/SettingsView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/tree' },
    { path: '/products', redirect: '/tree' },
    { path: '/tree', component: TreeView },
    { path: '/tree/:id', component: TreeView, props: true },
    { path: '/journal', component: JournalView },
    { path: '/model', component: ModelView },
    { path: '/import', component: ImportView },
    { path: '/import/solr', component: SolrView },
    { path: '/media', component: MediaView },
    { path: '/settings', component: SettingsView },
  ],
})
