// Gebaute Plugins: jedes plugins/<key>/src/entry.js wird mit Vite zu plugins/<key>/entry.js —
// Vue-Einzeldateikomponenten (.vue) inklusive, Stile eingebettet. Die Importe `vue`, `vue-router` und `journali`
// werden nicht gebündelt, sondern auf window.journali (web/src/host.js) umgebogen: Plugin und Oberfläche teilen
// dieselben Instanzen. Aufruf: `npm run build:plugins` (auch Teil von `npm run build`), `node build-plugins.mjs <key>`
// für eines. Das Ergebnis entry.js liegt im Repo — auf dem Server braucht es kein Node zum Austauschen.
import { build } from 'vite'
import vue from '@vitejs/plugin-vue'
import { existsSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const pluginsDir = resolve(here, '..', 'plugins')
// muss zu web/src/host.js passen
const HOST_NAMES = ['api', 'store', 'tree', 'icon', 'mapper', 'transform', 'recentFiles', 'dialog', 'treePicker', 'filePicker', 'paneWidth', 'plugins', 'menu', 'orphans', 'compliance', 'ai', 'i18n', 't', 'L', 'setLang', 'LANGS', 'Splitter', 'ImportHead', 'ProfileBar', 'TreePicker']
const WINDOW = { vue: 'vue', 'vue-router': 'vueRouter' }

/// vue, vue-router, journali → window.journali.*
function shims() {
  return {
    name: 'journali-shims',
    enforce: 'pre',
    resolveId(id) { if (id === 'vue' || id === 'vue-router' || id === 'journali') return { id: '\0shim:' + id, moduleSideEffects: false } },   // ungenutzte Namen fallen weg
    async load(id) {
      if (!id.startsWith('\0shim:')) return
      const name = id.slice(6)
      if (name === 'journali') return `const h = window.journali;\n` + HOST_NAMES.map(n => `export const ${n} = h.${n};`).join('\n') + '\nexport default h;\n'
      const names = Object.keys(await import(name)).filter(k => k !== 'default' && /^[A-Za-z_$][\w$]*$/.test(k))
      return `const m = window.journali.${WINDOW[name]};\n` + names.map(k => `export const ${k} = m.${k};`).join('\n') + '\n'
    },
  }
}

/// Stile in die JS-Datei — ein Plugin ist eine Datei
function inlineCss() {
  return {
    name: 'journali-inline-css',
    enforce: 'post',   // nach vite:css-post, das die CSS-Datei anlegt
    generateBundle(_, bundle) {
      const css = Object.values(bundle).filter(f => f.type === 'asset' && f.fileName.endsWith('.css'))
      const entry = Object.values(bundle).find(f => f.type === 'chunk' && f.isEntry)
      if (!css.length || !entry) return
      const text = css.map(c => c.source).join('\n')
      entry.code = `(function(){const s=document.createElement('style');s.textContent=${JSON.stringify(text)};document.head.append(s)})();\n` + entry.code
      for (const c of css) delete bundle[c.fileName]
    },
  }
}

async function one(key) {
  const entry = resolve(pluginsDir, key, 'src', 'entry.js')
  if (!existsSync(entry)) return false
  await build({
    configFile: false, logLevel: 'warn', root: here, publicDir: false,   // sonst landet web/public (Logo) in jedem Plugin
    plugins: [vue(), shims(), inlineCss()],
    build: {
      lib: { entry, formats: ['es'], fileName: () => 'entry.js', cssFileName: 'style' },
      outDir: resolve(pluginsDir, key), emptyOutDir: false, minify: false, cssCodeSplit: false, target: 'es2022',
      rollupOptions: { output: { inlineDynamicImports: true }, treeshake: { propertyReadSideEffects: false } },
    },
  })
  console.log(`plugins/${key}/entry.js`)
  return true
}

const wanted = process.argv.slice(2)
const keys = wanted.length ? wanted : readdirSync(pluginsDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)
let n = 0
for (const k of keys) if (await one(k)) n++
console.log(`${n} Plugin(s) gebaut`)
