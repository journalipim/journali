import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Entwicklung: `npm run dev` auf :5173, /api geht an den lokalen Server (:5000).
// Bau: `npm run build` schreibt nach Journali.Server/wwwroot, der Server liefert es aus.
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    fs: { allow: ['..'] },   // plugins/ixp/core.mjs liegt ausserhalb von web/ (ein Kern für Browser und Job)
    proxy: { '/api': 'http://localhost:5000' },
  },
  build: {
    outDir: '../Journali.Server/wwwroot',
    emptyOutDir: true,
  },
})
