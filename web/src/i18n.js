// Oberflächensprache (Taloan, 24.09.2026: „zumindest Englisch müssen wir anbieten“ — Sprachdateien nicht im Quelltext,
// sondern ausgelagert, damit die Community übersetzen kann). Entscheidungen (Taloan, 24.09.2026): der deutsche Text ist
// der Schlüssel, vue-i18n als Paket, Servermeldungen bleiben vorerst deutsch.
//
// Wie es läuft: t('Knoten wählen — oder oben anlegen.') liefert in `de` den Text selbst (es gibt keine de.json — der
// Schlüssel ist die Referenz), in jeder anderen Sprache den Wert aus wwwroot/lang/<code>.json (Quelle: web/public/lang/);
// fehlt er, den deutschen. Platzhalter: {0} {1} aus einer Liste, {name} aus einem Objekt — unser eigener, kleiner
// Nachrichten-Übersetzer, damit weder Schlüssel noch Übersetzung wegen `{`, `|` oder `@` maskiert werden müssen (das
// eingebaute Format von vue-i18n liest die als Steuerzeichen). Der flache Auflöser lässt Punkte im Schlüssel zu.
import { createI18n } from 'vue-i18n'

/// Die Sprachen der Oberfläche — eine Datei web/public/lang/<code>.json je Sprache ausser de. Nicht die Sprachen des Modells.
export const LANGS = [['de', 'Deutsch'], ['en', 'English']]
export const DEFAULT_LANG = 'de'

const compile = message => ctx => String(message).replace(/\{(\w+)\}/g, (m, k) => {
  const v = /^\d+$/.test(k) ? ctx.list(Number(k)) : ctx.named(k)
  return v == null ? m : String(v)
})

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,          // $t in jeder Vorlage
  locale: DEFAULT_LANG,
  fallbackLocale: DEFAULT_LANG,
  messages: { [DEFAULT_LANG]: {} },
  // Fehlt der Schlüssel, ist der Schlüssel die Nachricht (er ist ja der deutsche Text) — so werden auch dann die
  // Platzhalter gefüllt; ein fehlender Schlüssel, der nur zurückgegeben würde, bliebe mit {0} stehen.
  messageResolver: (obj, path) => (obj && Object.prototype.hasOwnProperty.call(obj, path) ? obj[path] : path),
  messageCompiler: compile,
  missingWarn: false, fallbackWarn: false,
  warnHtmlMessage: false,
})

/// Übersetzen ausserhalb von Vorlagen (Store, Dialoge, Plugins): t('…'), t('… {0} …', [x]), t('… {n} …', { n })
export const t = (key, params) => i18n.global.t(key, params ?? {})

const loaded = new Set([DEFAULT_LANG])
// Plugins bringen ihre Sprachdateien mit: plugins/<key>/lang/<code>.json — der Server liefert sie wie das Modul
// (GET /plugins/{key}/{path}). Registriert beim Laden des Plugins; beim Sprachwechsel werden alle nachgeladen.
const pluginKeys = new Set()
const pluginLoaded = new Set()   // `${key}/${code}`
async function ladePlugin(key, code) {
  const id = `${key}/${code}`
  if (code === DEFAULT_LANG || pluginLoaded.has(id)) return
  pluginLoaded.add(id)
  try {
    const r = await fetch(`/plugins/${encodeURIComponent(key)}/lang/${code}.json`)
    if (r.ok) i18n.global.mergeLocaleMessage(code, await r.json())
  } catch { /* ohne Datei bleibt es beim Schlüssel */ }
}
/// Ein Plugin anmelden: seine Sprachdatei für die aktuelle Sprache kommt jetzt, die anderen beim Wechsel
export async function registerPluginLang(key) {
  pluginKeys.add(key)
  await ladePlugin(key, i18n.global.locale.value)
}

/// Sprache umschalten; die Datei kommt einmal vom Server. Unbekannter Code → Vorgabe.
export async function setLang(code) {
  code = LANGS.some(([c]) => c === code) ? code : DEFAULT_LANG
  if (!loaded.has(code)) {
    try {
      const r = await fetch(`/lang/${code}.json`)
      if (r.ok) i18n.global.setLocaleMessage(code, await r.json())
    } catch { /* ohne Datei bleibt es beim Schlüssel, also deutsch */ }
    loaded.add(code)
  }
  await Promise.all([...pluginKeys].map(k => ladePlugin(k, code)))
  i18n.global.locale.value = code
  document.documentElement.lang = code
  return code
}

/// Die Sprache des Browsers, wenn jemand noch keine gewählt hat (Anmeldeseite, erster Start)
export const browserLang = () => LANGS.map(([c]) => c).find(c => (navigator.language || '').toLowerCase().startsWith(c)) ?? DEFAULT_LANG
