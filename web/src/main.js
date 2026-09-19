import { createApp } from 'vue'
import './host.js'   // window.journali für gebaute Plugins (Basis-Plugins mit Vue-Ansichten)
import App from './App.vue'
import { router } from './router.js'
import { store } from './store.js'
import './style.css'

createApp(App).use(router).mount('#app')
store.start()
