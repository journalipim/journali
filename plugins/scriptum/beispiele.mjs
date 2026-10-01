// Beispiel-Bibliothek für Skripte (29.09.2026, docs/pflegestruktur.md 37). Kuratierte Startpunkte, die mit journali
// ausgeliefert werden — kein Fremdcode aus einem Markt, sondern geprüfte Vorlagen. Der Autor lädt eines in den Editor
// (＋ Beispiel …) und passt es an. Jedes Beispiel ist ein vollständiges Skript: ein Kopf (export const meta) als
// Formular und eine Standardfunktion, die den Kontext bekommt (ctx.api, ctx.zugang, ctx.out, ctx.params, ctx.log).
//
// Regeln wie im übrigen Quelltext: kein Name, kein Zitat, kein fremdes Produkt; sachliches Deutsch in den Kommentaren.

export const beispiele = [
  {
    key: 'csv-export',
    title: 'CSV-Export',
    description: 'Knoten als CSV in das Fach out/ — ganzer Baum, oder aus dem Kontextmenü die selektierten Knoten samt Teilbaum.',
    source: `export const meta = {
  label: 'CSV-Export eines Teilbaums',
  nodes: true,
  params: [
    { key: 'nodes', label: 'Knoten (IDs; leer = ganzer Baum)', type: 'text', default: '' },
    { key: 'datei', label: 'Dateiname', type: 'text', default: 'export.csv' },
  ],
}

// Alle sichtbaren Knoten als CSV — oder, aus dem Kontextmenü aufgerufen (meta.nodes), die selektierten Knoten samt
// Teilbaum (ctx.params.nodes = ihre IDs). ctx.lib.csv baut die Tabelle mit richtiger Maskierung.
export default async (ctx) => {
  const alle = await ctx.api.get('/api/tree')
  const ids = String(ctx.params.nodes || '').split(',').map((x) => x.trim()).filter(Boolean)
  let zeilen = alle
  if (ids.length) {
    const gewaehlt = new Set(ids)   // die Gewaehlten und alles darunter
    let mehr = true
    while (mehr) {
      mehr = false
      for (const z of alle) if (z.parent && gewaehlt.has(z.parent) && !gewaehlt.has(z.id)) { gewaehlt.add(z.id); mehr = true }
    }
    zeilen = alle.filter((z) => gewaehlt.has(z.id))
  }
  if (!zeilen.length) return ctx.out.text('Keine Knoten.')
  return ctx.out.file(ctx.params.datei || 'export.csv', ctx.lib.csv(zeilen))
}
`,
  },
  {
    key: 'rest-lesen',
    title: 'Fremdsystem lesen',
    description: 'Eine REST-Schnittstelle über einen Zugang lesen — der Server hängt die Anmeldung an, das Geheimnis bleibt bei ihm.',
    source: `export const meta = {
  label: 'Fremdsystem über einen Zugang lesen',
  params: [
    { key: 'system', label: 'Zugang (HTTP/REST)', type: 'driver', default: '' },
    { key: 'pfad', label: 'Pfad hinter der Adresse', type: 'text', default: '/' },
  ],
}

// ctx.zugang(name) spricht das Fremdsystem über die Weiterleitung des Servers an: kein Token im Skript, kein direkter
// Aufruf. Die Antwort wird als Tabelle gezeigt; ist sie eine Liste von Objekten, sind die Spalten ihre Felder.
export default async (ctx) => {
  const zugang = ctx.zugang(ctx.params.system)
  const antwort = await zugang.get(ctx.params.pfad || '/')
  if (Array.isArray(antwort)) return antwort
  if (antwort && Array.isArray(antwort.items)) return antwort.items
  return [antwort]
}
`,
  },
  {
    key: 'rest-beschicken',
    title: 'Fremdsystem beschicken',
    description: 'journali-Knoten lesen und einzeln an eine REST-Schnittstelle senden (POST über einen Zugang).',
    source: `export const meta = {
  label: 'Knoten an ein Fremdsystem senden',
  params: [
    { key: 'system', label: 'Zugang (HTTP/REST)', type: 'driver', default: '' },
    { key: 'pfad', label: 'Pfad zum Beschicken', type: 'text', default: '/' },
    { key: 'grenze', label: 'Höchstens so viele', type: 'number', default: '20' },
  ],
}

// Am Job steht, wohin und wann — hier steht, was. Jeder Knoten geht einzeln an das Fremdsystem; das Geheimnis des
// Zugangs bleibt beim Server. Die Ausgabe ist eine Tabelle: was gesendet wurde und was zurückkam.
export default async (ctx) => {
  const zugang = ctx.zugang(ctx.params.system)
  const alle = await ctx.api.get('/api/tree')
  const grenze = Number(ctx.params.grenze) || 20
  const gesendet = []
  for (const knoten of alle.slice(0, grenze)) {
    const antwort = await zugang.post(ctx.params.pfad || '/', knoten)
    gesendet.push([knoten.id, antwort && antwort.id ? String(antwort.id) : 'ok'])
  }
  return ctx.out.table(['id', 'ergebnis'], gesendet)
}
`,
  },
  {
    key: 'sap-odata',
    title: 'ERP OData lesen',
    description: 'Ein ERP-Gateway-OData-Service (v2 oder v4) über einen Zugang lesen: $format=json, Blättern mit $skip/$top, das Ergebnis als Tabelle.',
    source: `export const meta = {
  label: 'ERP OData lesen',
  params: [
    { key: 'system', label: 'Zugang (HTTP/REST)', type: 'driver', default: '' },
    { key: 'service', label: 'OData-Service und Entität', type: 'text', default: '/sap/opu/odata/sap/ZMY_SRV/ProductSet' },
    { key: 'select', label: 'Felder ($select, leer = alle)', type: 'text', default: '' },
    { key: 'grenze', label: 'Höchstens so viele', type: 'number', default: '200' },
  ],
}

// ERP Gateway über einen Zugang lesen. Die Anmeldung (Basic oder Bearer) hängt der Server an — hier steht nur der Pfad
// hinter der Adresse. $format=json, weil ERP sonst XML liefert; geblättert wird mit $skip/$top. Die Antwort ist bei
// OData v2 { d: { results: [...] } }, bei v4 { value: [...] }. __metadata gehört nicht in die Tabelle.
export default async (ctx) => {
  const zugang = ctx.zugang(ctx.params.system)
  const service = ctx.params.service || '/'
  const select = String(ctx.params.select || '').trim()
  const grenze = Number(ctx.params.grenze) || 200
  const seite = 100
  const zeilen = []
  for (let skip = 0; skip < grenze; skip += seite) {
    const top = Math.min(seite, grenze - skip)
    let pfad = service + (service.indexOf('?') >= 0 ? '&' : '?') + '$format=json&$top=' + top + '&$skip=' + skip
    if (select) pfad = pfad + '&$select=' + encodeURIComponent(select)
    const antwort = await zugang.get(pfad)
    const d = antwort && antwort.d ? antwort.d : antwort
    const teil = d && Array.isArray(d.results) ? d.results
      : (antwort && Array.isArray(antwort.value) ? antwort.value : (Array.isArray(d) ? d : []))
    for (const e of teil) zeilen.push(e)
    if (teil.length < top) break
  }
  if (!zeilen.length) return ctx.out.text('Keine Datensätze.')
  const spalten = Object.keys(zeilen[0]).filter((k) => k !== '__metadata')
  const zelle = (w) => w == null ? '' : (typeof w === 'object' ? JSON.stringify(w) : String(w))
  return ctx.out.table(spalten, zeilen.map((e) => spalten.map((s) => zelle(e[s]))))
}
`,
  },
  {
    key: 'sap-odata-schreiben',
    title: 'ERP OData schreiben (CSRF)',
    description: 'Einen Datensatz nach ERP Gateway (OData v2) anlegen — mit dem CSRF-Token-Ablauf: erst Token und Sitzungskeks holen, dann schreiben.',
    source: `export const meta = {
  label: 'ERP OData schreiben (CSRF)',
  params: [
    { key: 'system', label: 'Zugang (HTTP/REST)', type: 'driver', default: '' },
    { key: 'service', label: 'OData-Service und Entität', type: 'text', default: '/sap/opu/odata/sap/ZMY_SRV/ProductSet' },
  ],
}

// Schreiben nach ERP Gateway (OData v2) braucht einen CSRF-Token, gebunden an die Sitzung:
// 1. GET mit X-CSRF-Token: Fetch — der Token steht in der Antwort-Kopfzeile, der Sitzungskeks in Set-Cookie.
// 2. POST mit demselben Token und demselben Keks. Beides reicht der Server durch; das Geheimnis des Zugangs bleibt bei ihm.
// roh() gibt die ganze Antwort (Status, Kopfzeilen, Rumpf); der Keks geht als x-relay-cookie zurueck.
export default async (ctx) => {
  const zugang = ctx.zugang(ctx.params.system)
  const service = ctx.params.service || '/'
  const trenner = service.indexOf('?') >= 0 ? '&' : '?'
  // 1. Token und Sitzungskeks holen
  const hol = await zugang.roh('GET', service + trenner + '$format=json&$top=0', { headers: { 'x-csrf-token': 'Fetch' } })
  const token = hol.headers && hol.headers['x-csrf-token']
  if (!token) return ctx.out.text('Kein CSRF-Token — Anmeldung oder Service pruefen (Status ' + hol.status + ').')
  const keks = ((hol.headers && hol.headers['set-cookie']) || []).map((c) => c.split(';')[0]).join('; ')
  // 2. Einen Datensatz anlegen — die Felder richten sich nach der Entitaet
  const satz = { Name: 'Beispiel', Description: 'ueber journali angelegt' }
  const res = await zugang.roh('POST', service, { body: satz, headers: { 'x-csrf-token': token, 'x-relay-cookie': keks } })
  if (res.status >= 200 && res.status < 300) return ctx.out.text('Angelegt (Status ' + res.status + ').')
  return ctx.out.text('Abgelehnt (Status ' + res.status + '): ' + String(res.body || '').slice(0, 400))
}
`,
  },
  {
    key: 'sap-sync',
    title: 'ERP-Sync über OData',
    description: 'Die heutige Version der ERP-Synchronisierung: Material oder Preise per OData holen, je ERP-Nummer den Knoten finden und Attribute im Stapel setzen. Als Zeitplan-Job.',
    source: `export const meta = {
  label: 'ERP-Sync über OData',
  params: [
    { key: 'system', label: 'Zugang (HTTP/REST)', type: 'driver', default: '' },
    { key: 'service', label: 'OData-Service und Entität', type: 'text', default: '/sap/opu/odata/sap/ZMATERIAL_SRV/MaterialSet' },
    { key: 'art', label: 'Auftragsart (material oder preis)', type: 'text', default: 'material' },
    { key: 'land', label: 'Land (für Preise, z. B. DE)', type: 'text', default: 'DE' },
    { key: 'grenze', label: 'Höchstens so viele', type: 'number', default: '500' },
  ],
}

// ERP-Sync über OData — die heutige Version der alten DB-Tabellen-Synchronisierung: kein Bus, kein Polling einer DB.
// Ein Zeitplan-Job holt periodisch, dieses Skript bildet ab. ERP reichert bestehende Artikel an; die Neuanlage bleibt
// manuell. ANPASSEN: die Zuordnung ERP-Feld -> journali-Attribut (MAP_MATERIAL) und der Preis-Attributname. Der
// Schlüssel, über den ein ERP-Datensatz seinen Knoten findet, ist hier die Fremd-Verknüpfung "sap" (external.link).
const MAP_MATERIAL = {
  Ean: 'ean',
  BaseUnit: 'basismengeneinheit',
  NetWeight: 'gewicht_ohne_verpackung',
  CommodityCode: 'warennummer',
  CountryOrigin: 'ursprungsland',
}
const preisAttribut = (land) => 'sap_preis_' + String(land || '').toLowerCase()

export default async (ctx) => {
  const zugang = ctx.zugang(ctx.params.system)
  const service = ctx.params.service || '/'
  const art = (ctx.params.art || 'material').toLowerCase()
  const land = ctx.params.land || ''
  const grenze = Number(ctx.params.grenze) || 500
  const seite = 100
  // 1. ERP lesen, mit Blättern
  const rows = []
  for (let skip = 0; skip < grenze; skip += seite) {
    const top = Math.min(seite, grenze - skip)
    const trenner = service.indexOf('?') >= 0 ? '&' : '?'
    const antwort = await zugang.get(service + trenner + '$format=json&$top=' + top + '&$skip=' + skip)
    const d = antwort && antwort.d ? antwort.d : antwort
    const teil = d && Array.isArray(d.results) ? d.results
      : (antwort && Array.isArray(antwort.value) ? antwort.value : (Array.isArray(d) ? d : []))
    for (const e of teil) rows.push(e)
    if (teil.length < top) break
  }
  // 2. je ERP-Datensatz den Knoten finden (Fremd-Verknüpfung sap) und Befehle sammeln
  const befehle = []
  let getroffen = 0, fehlend = 0
  for (const r of rows) {
    const nr = r.Material || r.MaterialNumber || r.ProductNumber || r.Matnr
    if (!nr) continue
    let knoten = null
    try { knoten = await ctx.api.get('/api/nodes/external/sap/' + encodeURIComponent(nr)) } catch (e) { knoten = null }
    if (!knoten || !knoten.id) { fehlend++; continue }
    getroffen++
    if (art === 'preis') {
      const wert = r.GrossPrice != null ? r.GrossPrice : r.Price
      if (wert != null) befehle.push({ op: 'attribute.set', args: { node: knoten.id, attribute: preisAttribut(land), value: String(wert) } })
    } else {
      for (const feld of Object.keys(MAP_MATERIAL)) {
        if (r[feld] != null && r[feld] !== '') befehle.push({ op: 'attribute.set', args: { node: knoten.id, attribute: MAP_MATERIAL[feld], value: String(r[feld]) } })
      }
    }
  }
  // 3. in einem Stapel schreiben — ein fehlgeschlagener Befehl wird übersprungen, der Rest läuft
  let geschrieben = 0, uebersprungen = 0
  if (befehle.length) {
    const antwort = await ctx.api.post('/api/batch?skipErrors=true', { commands: befehle })
    geschrieben = (antwort.results || []).length
    uebersprungen = (antwort.skipped || []).length
  }
  return ctx.out.table(['Kennzahl', 'Wert'], [
    ['ERP-Datensätze', rows.length], ['Knoten getroffen', getroffen], ['nicht gefunden', fehlend],
    ['Attribute geschrieben', geschrieben], ['übersprungen', uebersprungen],
  ])
}
`,
  },
  {
    key: 'schritte-helfer',
    title: 'Schritte, Snapshot und Helfer',
    description: 'Zeigt ctx.step (benannte Schritte mit Dauer, JSON-Schema-Prüfung und Snapshot ins Fach out/) und ctx.lib (kuratierte Helfer wie csv, get, chunk).',
    source: `export const meta = {
  label: 'Schritte, Snapshot und Helfer',
  params: [{ key: 'datei', label: 'Dateiname', type: 'text', default: 'knoten.csv' }],
}

// ctx.step gliedert ein Skript in benannte Teile: jeder steht mit Dauer im Log, kann gegen ein JSON-Schema geprüft und
// als Snapshot ins Fach out/ gelegt werden. ctx.lib bringt geprüfte Helfer mit — hier get und csv. Kein Pipeline-Motor.
export default async (ctx) => {
  const knoten = await ctx.step('laden', () => ctx.api.get('/api/tree'), { schema: { type: 'array' }, snapshot: true })
  const tabelle = await ctx.step('aufbereiten', () => knoten.map((n) => ({ id: n.id, name: String(ctx.lib.get(n, 'label', n.id) ?? '') })))
  const text = ctx.lib.csv(tabelle, { columns: ['id', 'name'] })
  return ctx.out.file(ctx.params.datei || 'knoten.csv', text)
}
`,
  },
  {
    key: 'promotion-skripte',
    title: 'Promotion test→prod: Skripte',
    description: 'Hebt scriptum-Skripte auf eine andere Instanz (test→prod): Diff über die Skriptliste, Trockenlauf als Standard, Anwenden per Schalter. Löscht auf dem Ziel nie.',
    source: `export const meta = {
  label: 'Promotion test→prod: Skripte',
  params: [
    { key: 'ziel', label: 'Ziel-Instanz (Zugang HTTP/REST auf ihre Basis-URL)', type: 'driver', default: '' },
    { key: 'anwenden', label: 'Anwenden (aus = nur Bericht)', type: 'boolean', default: 'false' },
  ],
}

// Hebt scriptum-Skripte von dieser Instanz auf eine andere (test→prod). Das Ziel ist ein http-Zugang auf die Basis-URL
// der Ziel-Instanz; sein Geheimnis ist ein API-Token dort mit dem Recht „Skripte schreiben". Standard ist Trockenlauf:
// nur ein Bericht (neu/geändert/gleich). Mit „Anwenden" werden neue und geänderte Skripte per PUT übertragen — auf dem
// Ziel wird nie etwas gelöscht. Das Modell hebt diese Version nicht (eigene Aufgabe).
export default async (ctx) => {
  const ziel = ctx.zugang(ctx.params.ziel)
  const anwenden = String(ctx.params.anwenden) === 'true'
  const lokal = await ctx.api.get('/api/scriptum/scripts')
  let liste
  try { liste = await ziel.get('/api/scriptum/scripts') } catch (e) { return ctx.out.text('Ziel nicht erreichbar: ' + (e && e.message ? e.message : e)) }
  const dort = {}
  for (const s of (liste || [])) dort[s.key] = true
  const zeilen = []
  for (const s of lokal) {
    const voll = await ctx.api.get('/api/scriptum/scripts/' + encodeURIComponent(s.key))
    let aktion = 'neu'
    if (dort[s.key]) {
      let d = null
      try { d = await ziel.get('/api/scriptum/scripts/' + encodeURIComponent(s.key)) } catch (e) { d = null }
      aktion = (d && d.source === voll.source && d.role === voll.role && d.run === voll.run) ? 'gleich' : 'geändert'
    }
    let ergebnis = aktion === 'gleich' ? '—' : (anwenden ? '?' : 'Trockenlauf')
    if (aktion !== 'gleich' && anwenden) {
      try {
        await ziel.put('/api/scriptum/scripts/' + encodeURIComponent(s.key), { label: voll.label, role: voll.role, run: voll.run, source: voll.source, params: voll.params, note: voll.note, limit: voll.limit })
        ergebnis = 'übertragen'
      } catch (e) { ergebnis = 'Fehler: ' + (e && e.message ? e.message : e) }
    }
    zeilen.push([s.key, aktion, ergebnis])
  }
  if (!zeilen.length) return ctx.out.text('Keine Skripte.')
  return ctx.out.table(['Skript', 'Unterschied', anwenden ? 'Ergebnis' : 'Bericht'], zeilen)
}
`,
  },
  {
    key: 'knoten-auflisten',
    title: 'Auf Auswahl: Knoten auflisten',
    description: 'Ein Knoten-Skript (meta.nodes) — erscheint im Kontextmenü des Baums und läuft auf den selektierten Knoten; hier listet es sie als Tabelle.',
    source: `export const meta = {
  label: 'Auf Auswahl: Knoten auflisten',
  nodes: true,
  params: [
    { key: 'nodes', label: 'Knoten (IDs, vom Kontextmenü gesetzt)', type: 'text', default: '' },
  ],
}

// Ein Knoten-Skript: meta.nodes = true lässt es im Kontextmenü des Baums erscheinen. Der Kontextmenü-Aufruf setzt den
// Parameter „nodes" auf die IDs der selektierten Knoten (Komma-getrennt) — ein Lauf für alle. Hier nur auflisten.
export default async (ctx) => {
  const ids = String(ctx.params.nodes || '').split(',').map((x) => x.trim()).filter(Boolean)
  if (!ids.length) return ctx.out.text('Keine Knoten ausgewählt.')
  const zeilen = []
  for (const id of ids) {
    try {
      const n = await ctx.api.get('/api/nodes/' + encodeURIComponent(id))
      zeilen.push([id, String(ctx.lib.get(n, 'label', id) ?? ''), n.role || ''])
    } catch (e) { zeilen.push([id, '(nicht gefunden)', '']) }
  }
  return ctx.out.table(['Knoten', 'Bezeichnung', 'Rolle'], zeilen)
}
`,
  },
  {
    key: 'bericht-zaehlen',
    title: 'Knoten je Wert zählen',
    description: 'Ein einfacher Bericht ohne Fremdsystem: wie viele Knoten je Wert eines Feldes (etwa status).',
    source: `export const meta = {
  label: 'Knoten je Wert zählen',
  params: [
    { key: 'feld', label: 'Feld', type: 'text', default: 'status' },
  ],
}

// Wie viele Knoten je Wert eines Feldes. Nur aus journali, als Tabelle.
export default async (ctx) => {
  const zeilen = await ctx.api.get('/api/tree')
  const feld = ctx.params.feld || 'status'
  const zaehler = {}
  for (const z of zeilen) {
    const wert = String(z[feld] == null ? '—' : z[feld])
    zaehler[wert] = (zaehler[wert] || 0) + 1
  }
  const rows = Object.keys(zaehler).sort().map((w) => [w, zaehler[w]])
  return ctx.out.table([feld, 'Anzahl'], rows)
}
`,
  },
]
