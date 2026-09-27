// Plugin embed — das Modell (27.09.2026). Ein ONNX-Modell über @huggingface/transformers, lokal im Prozess, ohne
// Schlüssel und ohne fremden Dienst. Beim ersten Lauf wird es geladen und bleibt im Verzeichnis .cache des Plugins;
// danach läuft es ohne Netz. Vorgabe: Xenova/multilingual-e5-small — 384 Dimensionen, mehrsprachig, etwa 120 MB quantisiert.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { prepare, compact } from './core.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
export const DEFAULT_MODEL = 'Xenova/multilingual-e5-small'
let pipe = null, loaded = null

/// Das Modell laden — einmal je Prozess; ein anderer Name lädt neu.
export async function load(model = DEFAULT_MODEL) {
  if (pipe && loaded === model) return pipe
  let tf
  try { tf = await import('@huggingface/transformers') }
  catch (e) { throw new Error('@huggingface/transformers fehlt — im Plugin-Verzeichnis einmal „npm install“ ausführen (' + e.message + ')') }
  tf.env.cacheDir = process.env.JOURNALI_EMBED_CACHE || path.join(here, '.cache')
  tf.env.allowLocalModels = true
  pipe = await tf.pipeline('feature-extraction', model, { dtype: 'q8' })
  loaded = model
  return pipe
}

/// Texte einbetten: je Text ein normierter Vektor (Kosinus = Skalarprodukt). kind: query | passage.
export async function embed(texts, kind, model = DEFAULT_MODEL) {
  if (!texts.length) return []
  const p = await load(model)
  const out = await p(texts.map(t => prepare(t, kind, model)), { pooling: 'mean', normalize: true })
  const list = out.tolist()
  return list.map(compact)
}
