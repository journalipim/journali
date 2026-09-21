// DeepL als Anbieter (Taloan, 21.09.2026: „DeepL als eigener Anbieter neben der KI“) — als Job, nie im Browser: der Schlüssel liegt
// beim Server am Profil (🔒), nie im Journal. Holt die offenen Einheiten der Sprachrichtung aus dem Profil (/api/translate/units),
// übersetzt in Stapeln (HTML-Attribute mit tag_handling=html), schreibt über /api/translate/import zurück — mit dem Hash der
// Quelle, also nie über eine Quelle, die sich zwischendurch geändert hat. Das Wörterbuch (Terms) geht als Glossar-Kontext mit.
// Aufruf: node deepl.mjs <journali> <actor> <profile> <key> [scope] — der JobRunner setzt die Werte auch als JOURNALI_* in die Umgebung.
const [,, serverArg, actorArg, profileArg, keyArg, scopeArg] = process.argv
const E = process.env
const server = (serverArg || E.JOURNALI_JOURNALI || 'http://localhost:5000').replace(/\/$/, '')
const actor = actorArg || E.JOURNALI_ACTOR || 'job:deepl'
const profileName = profileArg || E.JOURNALI_PROFILE || ''
const key = keyArg || E.JOURNALI_KEY || ''
const scope = scopeArg || E.JOURNALI_SCOPE || 'missing'
const headers = { 'X-Actor': actor, 'Content-Type': 'application/json', ...(E.JOURNALI_TOKEN ? { Authorization: 'Bearer ' + E.JOURNALI_TOKEN } : {}) }
async function api(method, p, body) { const r = await fetch(server + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }); const t = await r.text(); let d = null; try { d = t ? JSON.parse(t) : null } catch {} if (!r.ok) throw new Error(`${p}: ${d?.error ?? r.status}`); return d }

// DeepL-Sprachcodes: Ziel EN-GB/EN-US/PT-BR …, sonst der Code gross; Quelle ohne Region
const deeplLang = (code, target) => { const [l, r] = String(code).split(/[-_]/); const L = l.toUpperCase(); if (!target) return L; if (L === 'EN') return r ? `EN-${r.toUpperCase()}` : 'EN-GB'; if (L === 'PT') return r ? `PT-${r.toUpperCase()}` : 'PT-PT'; if (L === 'ZH') return 'ZH'; return L }

let code = 0
try {
  if (!key) throw new Error('DeepL-Schlüssel fehlt — am Profil hinterlegen (⇄ Übersetzung → 🔒) oder als Parameter key')
  if (!profileName) throw new Error('Profil fehlt (⇄ Übersetzung → 💾)')
  const profile = await api('GET', `/api/plugins/xliff/data/${encodeURIComponent('profile:' + profileName)}`)
  if (!profile?.to) throw new Error(`Profil „${profileName}“: keine Zielsprache`)
  const endpoint = key.endsWith(':fx') ? 'https://api-free.deepl.com/v2/translate' : 'https://api.deepl.com/v2/translate'
  const qs = `root=${encodeURIComponent(profile.root ?? '')}&from=${profile.from ?? ''}&to=${profile.to}&channel=${encodeURIComponent(profile.channel ?? '')}&attributes=${encodeURIComponent(profile.attributes ?? '')}&scope=${scope}&limit=20000`
  const u = await api('GET', `/api/translate/units?${qs}`)
  console.log(`${u.count} Einheiten ${u.from} → ${u.to} (${scope}); DeepL ${endpoint.includes('free') ? 'Free' : 'Pro'}`)
  if (!u.count) { console.log('nichts zu übersetzen'); process.exit(0) }
  // Wörterbuch als Kontext: DeepL kennt „context“ (nicht übersetzt, hilft der Wahl der Begriffe)
  let context = ''
  try { const terms = await api('GET', '/api/model/terms'); const pairs = terms.filter(t => t.text?.[u.from] && t.text?.[u.to]).map(t => `${t.text[u.from]} = ${t.text[u.to]}`); if (pairs.length) context = 'Glossar: ' + pairs.slice(0, 200).join('; ') } catch {}
  let written = 0, skipped = 0, chars = 0
  for (const kind of ['text', 'html']) {
    const units = u.units.filter(x => x.type === kind)
    for (let i = 0; i < units.length; i += 40) {
      const batch = units.slice(i, i + 40)
      const body = { text: batch.map(x => x.source), source_lang: deeplLang(u.from, false), target_lang: deeplLang(u.to, true), ...(kind === 'html' ? { tag_handling: 'html' } : {}), ...(context ? { context } : {}) }
      const r = await fetch(endpoint, { method: 'POST', headers: { Authorization: 'DeepL-Auth-Key ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(`DeepL ${r.status}: ${d.message ?? ''}`)
      chars += batch.reduce((n, x) => n + x.source.length, 0)
      const res = await api('POST', '/api/translate/import', { from: u.from, to: u.to, units: batch.map((x, j) => ({ id: x.id, target: d.translations?.[j]?.text ?? '', sourceHash: x.sourceHash })) })
      written += res.written; skipped += res.skipped
      console.log(`${kind}: ${Math.min(i + 40, units.length)}/${units.length} · ${res.written} geschrieben${res.skipped ? `, ${res.skipped} übergangen` : ''}`)
    }
  }
  console.log(`✓ ${written} Zieltexte geschrieben, ${chars} Zeichen bei DeepL${skipped ? ` — ${skipped} übergangen (Quelle geändert)` : ''}`)
  if (skipped) code = 3
} catch (e) { console.error('✗ ' + e.message); code = 1 }
process.exit(code)
