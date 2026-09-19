import { createRouter, createWebHistory } from 'vue-router'
import TreeView from './views/TreeView.vue'
import JournalView from './views/JournalView.vue'
import ModelView from './views/ModelView.vue'
import HubView from './views/HubView.vue'
import LoginView from './views/LoginView.vue'
import { store } from './store.js'
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
    { path: '/export', component: HubView, props: { topic: 'export' } },
    { path: '/datasheet', component: HubView, props: { topic: 'datasheet' } },
    { path: '/analysis', component: HubView, props: { topic: 'analysis' } },
    { path: '/tools', component: HubView, props: { topic: 'tools' } },
    { path: '/jobs', component: HubView, props: { topic: 'jobs' } },
    // alte Pfade (bis 19.09.: fest eingebaut) → Basis-Plugins, Abfrage bleibt (?node=, ?new=, ?plugin=)
    ...Object.entries({ '/import/table': '/p/table/import', '/export/table': '/p/table/export', '/import/ixp': '/p/ixp/import', '/import/solr': '/p/solr/import', '/analysis/dq': '/p/da/check', '/jobs/list': '/p/tasker/jobs' })
      .map(([from, to]) => ({ path: from, redirect: r => ({ path: to, query: r.query }) })),
    { path: '/media', component: MediaView },
    { path: '/plugins', component: PluginsView },
    { path: '/p/:key/:path', component: PluginHost },
    { path: '/settings', component: SettingsView },
    { path: '/login', component: LoginView },
  ],
})

// Wache (Taloan, 19.09.): mit Benutzern ohne Sitzung → /login; ohne Benutzer bleibt alles offen
router.beforeEach(async to => {
  if (to.path === '/login') return true
  if (!store.auth.known) await store.loadAuth()
  if (store.auth.enabled && !store.auth.user) { sessionStorage.setItem('journali.after', to.fullPath); return '/login' }
  return true
})
