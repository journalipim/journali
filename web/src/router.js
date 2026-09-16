import { createRouter, createWebHistory } from 'vue-router'
import TreeView from './views/TreeView.vue'
import JournalView from './views/JournalView.vue'
import ModelView from './views/ModelView.vue'
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
    { path: '/settings', component: SettingsView },
  ],
})
