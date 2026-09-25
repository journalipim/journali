// Lädt .vue-Dateien im Test. Node kennt .vue nicht — dieser Haken
// übersetzt eine Einzeldatei-Komponente mit @vue/compiler-sfc, genau wie der Bau es tut: Skript und Vorlage zusammen,
// Stile bleiben draussen (sie werden nicht geprüft), scoped-Kennzeichen bleibt erhalten.
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { parse, compileScript, rewriteDefault } from '@vue/compiler-sfc'

// Eine Plugin-Ansicht importiert `vue`, `vue-router` und `journali` — im Bau werden diese auf window.journali
// umgebogen (web/build-plugins.mjs), damit Plugin und Oberfläche dieselben Instanzen teilen. Im Test liegt das
// Plugin ausserhalb von web/ und findet die Pakete sonst nicht; hier zeigen dieselben drei Namen auf die Oberfläche.
const WEB = new URL('../', import.meta.url).href
const AUF_DIE_OBERFLAECHE = {
  vue: WEB + 'node_modules/vue/index.mjs',
  'vue-router': WEB + 'node_modules/vue-router/dist/vue-router.mjs',
  journali: new URL('./journali-shim.mjs', import.meta.url).href,
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const ziel = AUF_DIE_OBERFLAECHE[specifier]
    // nur für Dateien ausserhalb von web/ — innerhalb löst Node selbst richtig auf
    if (ziel && context.parentURL && !context.parentURL.startsWith(WEB)) return { url: ziel, format: 'module', shortCircuit: true }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (!url.endsWith('.vue')) return nextLoad(url, context)
    const filename = fileURLToPath(url)
    const source = readFileSync(filename, 'utf8')
    const id = createHash('sha1').update(filename).digest('hex').slice(0, 8)
    const { descriptor, errors } = parse(source, { filename })
    if (errors.length) throw new Error(`${filename}: ${errors[0].message}`)
    const script = compileScript(descriptor, { id, inlineTemplate: true, templateOptions: { compilerOptions: { whitespace: 'condense' } } })
    const code = rewriteDefault(script.content, '__sfc__')
      + `\n__sfc__.__file = ${JSON.stringify(filename)};\n__sfc__.__scopeId = ${JSON.stringify('data-v-' + id)};\nexport default __sfc__;\n`
    return { format: 'module', shortCircuit: true, source: code }
  },
})
