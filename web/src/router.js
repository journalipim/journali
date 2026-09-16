import { createRouter, createWebHistory } from 'vue-router'
import ProductsView from './views/ProductsView.vue'
import ProductView from './views/ProductView.vue'
import JournalView from './views/JournalView.vue'
import SettingsView from './views/SettingsView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/products' },
    { path: '/products', component: ProductsView },
    { path: '/products/:sku', component: ProductView, props: true },
    { path: '/journal', component: JournalView },
    { path: '/settings', component: SettingsView },
  ],
})
