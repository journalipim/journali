// Der Produktberater auf dem PC (tools\berater.cmd, tools/berater-testseite.mjs): die Testseite bindet das Chat-Fenster des lokalen Dienstes ein
// wie eine Website, schwebend, eingebettet oder englisch; und das Startskript besteht nur aus ASCII — sonst bricht cmd die Datei ab.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { seite } from '../../tools/berater-testseite.mjs'

test('die Testseite bindet das Fenster des Dienstes ein — schwebend, eingebettet, englisch', () => {
  assert.match(seite('http://localhost:8090/'), /<script src="http:\/\/localhost:8090\/widget\.js" async><\/script>/)
  const e = seite('http://localhost:8090', { eingebettet: true, englisch: true })
  assert.match(e, /<div id="berater"><\/div>/)
  assert.match(e, /data-locale="en" data-target="#berater"/)
  assert.match(e, /<html lang="en">/)
})

test('tools\\berater.cmd besteht nur aus ASCII und kennt seine Befehle', () => {
  const text = fs.readFileSync(new URL('../../tools/berater.cmd', import.meta.url), 'latin1')
  assert.ok(![...text].some(ch => ch.charCodeAt(0) > 127), 'ein Zeichen ausserhalb von ASCII')
  for (const befehl of ['token', 'start', 'stop', 'status', 'pruefen']) assert.match(text, new RegExp(`:${befehl}\\r?\\n`))
  assert.match(text, /serve\.mjs/)
  assert.match(text, /JOURNALI_ADVISOR_TOKEN_FILE/, 'das Token aus der Datei, nicht auf der Befehlszeile des Dienstes')
})
