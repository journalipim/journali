// Sicherung als Prozess (Plugin backup): ruft POST /api/backup — der Server schreibt Journal, Medien, die Dateien
// neben dem Journal (auth.json, media.json, jobs/secrets.json) und die Plugin-Verzeichnisse in ein Verzeichnis.
// Das geht in ein leeres System zurück (Einstellungen → Sicherung): neuer Container, Sicherung rein, System steht.
// Ein pg_dump kann das nicht — Plugins und Zugänge liegen im Dateisystem, nicht in der Datenbank.
// Aufruf: node backup.js <journali> <actor> [dir] [keep] [media] [config] [plugins]
//   dir     Zielverzeichnis; darunter entsteht je Lauf ein Ordner <zeitstempel>
//   keep    so viele Stände behalten (Vorgabe 14)
// Der JobRunner setzt die Werte auch als JOURNALI_* in die Umgebung.
const fs = require('fs'); const path = require('path')
const [,, server, actor, dirArg, keepArg, mediaArg, configArg, pluginsArg] = process.argv
const ja = (v, vorgabe = true) => v === undefined || v === '' ? vorgabe : !['false', '0', 'off', 'nein'].includes(String(v).toLowerCase())
if (!server) { console.error('journali-Adresse fehlt'); process.exit(2) }
const basis = path.resolve(dirArg || process.env.JOURNALI_DIR || 'backup')
const keep = Math.max(1, parseInt(keepArg || '14', 10) || 14)
const headers = { 'X-Actor': actor || 'job:backup', 'Content-Type': 'application/json', ...(process.env.JOURNALI_TOKEN ? { Authorization: 'Bearer ' + process.env.JOURNALI_TOKEN } : {}) }

;(async () => {
  const { zuLoeschen } = await import('./core.mjs')
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
  const ziel = path.join(basis, stamp)

  const res = await fetch(server + '/api/backup', {
    method: 'POST', headers,
    body: JSON.stringify({ dir: ziel, media: ja(mediaArg), config: ja(configArg), plugins: ja(pluginsArg) }),
  })
  const text = await res.text()
  if (!res.ok) { console.error(`✗ ${res.status} ${text.slice(0, 300)}`); process.exit(1) }
  const m = JSON.parse(text)
  const mb = (m.bytes / 1048576).toFixed(1)
  console.log(`${ziel}: ${m.entries} Einträge, ${m.media} Medien (${mb} MB), ${m.config} Dateien, ${m.plugins} Plugins`)

  // alte Stände wegräumen — die Verzeichnisse tragen den Zeitstempel im Namen
  const alle = fs.readdirSync(basis, { withFileTypes: true }).filter(d => d.isDirectory() && /^\d{4}-\d{2}-\d{2}/.test(d.name)).map(d => d.name)
  for (const name of zuLoeschen(alle, keep)) {
    fs.rmSync(path.join(basis, name), { recursive: true, force: true })
    console.log(`alt entfernt: ${name}`)
  }
  console.log(JSON.stringify({ entries: m.entries, media: m.media, config: m.config, plugins: m.plugins, dir: ziel }))
})().catch(e => { console.error('✗ ' + e.message); process.exit(1) })
