// Lädt .vue-Dateien im Test (Taloan, 22.09.2026: Prüfroutinen statt Handproben). Node kennt .vue nicht — dieser Haken
// übersetzt eine Einzeldatei-Komponente mit @vue/compiler-sfc, genau wie der Bau es tut: Skript und Vorlage zusammen,
// Stile bleiben draussen (sie werden nicht geprüft), scoped-Kennzeichen bleibt erhalten.
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { parse, compileScript, rewriteDefault } from '@vue/compiler-sfc'

registerHooks({
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
