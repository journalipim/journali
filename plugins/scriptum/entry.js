(function(){const s=document.createElement('style');s.textContent="\n.zeile[data-v-f65bc931] { display: flex; align-items: center; gap: 6px; height: 26px; padding: 0 8px; cursor: pointer; white-space: nowrap;\n}\n.zeile.on[data-v-f65bc931] { background: var(--accent-soft);\n}\n.zeile .lbl[data-v-f65bc931] { overflow: hidden; text-overflow: ellipsis; flex: 1;\n}\n.form[data-v-f65bc931] { width: 100%; border-bottom: 1px solid var(--line);\n}\n.form td[data-v-f65bc931] { height: 30px; vertical-align: middle; white-space: normal; padding: 2px 4px;\n}\n.form td.attr[data-v-f65bc931] { color: var(--muted); white-space: nowrap; padding-left: 8px;\n}\n.section[data-v-f65bc931] { padding: 10px 8px; border-top: 1px solid var(--line);\n}\n.section h2[data-v-f65bc931] { font-size: 12px; margin: 0 0 6px; color: var(--muted); font-weight: 600; display: flex; align-items: center; gap: 6px;\n}\n.tabelle[data-v-f65bc931] { width: auto;\n}\n.text[data-v-f65bc931], .log[data-v-f65bc931] { font-family: ui-monospace, Consolas, monospace; font-size: 12px; white-space: pre-wrap; margin: 4px 0 0;\n}\n.log[data-v-f65bc931] { color: var(--muted); border-top: 1px solid var(--line); padding-top: 6px; margin-top: 8px;\n}\n.datei[data-v-f65bc931] { display: flex; gap: 6px; align-items: center;\n}\n";document.head.append(s)})();
const m = window.journali.vue;
const Fragment = m.Fragment;
const computed = m.computed;
const createBlock = m.createBlock;
const createCommentVNode = m.createCommentVNode;
const createElementBlock = m.createElementBlock;
const createElementVNode = m.createElementVNode;
const createTextVNode = m.createTextVNode;
const createVNode = m.createVNode;
const isRef = m.isRef;
const normalizeClass = m.normalizeClass;
const normalizeStyle = m.normalizeStyle;
const onMounted = m.onMounted;
const onUnmounted = m.onUnmounted;
const openBlock = m.openBlock;
const ref = m.ref;
const renderList = m.renderList;
const toDisplayString = m.toDisplayString;
const unref = m.unref;
const vModelDynamic = m.vModelDynamic;
const vModelSelect = m.vModelSelect;
const vModelText = m.vModelText;
const withDirectives = m.withDirectives;
const withKeys = m.withKeys;
const abstand = (seit, jetzt = Date.now()) => {
  const t2 = jetzt - (seit ?? jetzt);
  return t2 < 15e3 ? 700 : t2 < 6e4 ? 2e3 : 5e3;
};
const h = window.journali;
const api = h.api;
const store = h.store;
const paneWidth = h.paneWidth;
const plugins = h.plugins;
const t = h.t;
const Splitter = h.Splitter;
const ScriptEditor = h.ScriptEditor;
function kopfLesen(quelle) {
  const m2 = /export\s+(?:const|let|var)\s+meta\s*=\s*\{/.exec(quelle ?? "");
  if (!m2) return null;
  const start = m2.index + m2[0].length - 1;
  const ende = zuKlammer(quelle, start);
  if (ende < 0) return null;
  try {
    const wert = new Function("return (" + quelle.slice(start, ende + 1) + ")")();
    return wert && typeof wert === "object" && !Array.isArray(wert) ? wert : null;
  } catch {
    return null;
  }
}
function zuKlammer(s, start) {
  let tiefe = 0;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (c === '"' || c === "'" || c === "`") {
      i = zuEnde(s, i, c);
      if (i < 0) return -1;
      continue;
    }
    if (c === "/" && s[i + 1] === "/") {
      i = s.indexOf("\n", i);
      if (i < 0) return -1;
      continue;
    }
    if (c === "/" && s[i + 1] === "*") {
      i = s.indexOf("*/", i + 2);
      if (i < 0) return -1;
      i++;
      continue;
    }
    if (c === "{") tiefe++;
    else if (c === "}" && --tiefe === 0) return i;
  }
  return -1;
}
function zuEnde(s, start, zeichen) {
  for (let i = start + 1; i < s.length; i++) {
    if (s[i] === "\\") {
      i++;
      continue;
    }
    if (s[i] === zeichen) return i;
  }
  return -1;
}
function paramsAus(kopf) {
  return (kopf?.params ?? []).filter((p) => p && p.key).map((p) => ({
    key: String(p.key),
    label: p.label == null ? null : String(p.label),
    type: p.type == null ? null : String(p.type),
    default: p.default == null ? null : String(p.default)
  }));
}
let liste = [];
async function refresh() {
  try {
    liste = (await api.get("/api/scriptum/scripts")).filter((s) => s && s.nodes);
  } catch {
    liste = [];
  }
  return liste;
}
async function laufAufKnoten(s, ids, ctx) {
  const knoten = ids || [];
  const r = await api.post(`/api/scriptum/scripts/${encodeURIComponent(s.key)}/run`, { params: { nodes: knoten.join(",") } });
  try {
    localStorage.setItem("journali.scriptum.run", JSON.stringify({ key: s.key, job: r.job, run: r.run }));
  } catch {
  }
  store.toast(t("≡ {0}: läuft … ({1} Knoten) — Ergebnis in ⌨ Skripte", [s.label || s.key, knoten.length]));
  if (ctx && ctx.go) ctx.go("/p/scriptum/skripte");
  return r;
}
const beispiele = [
  {
    key: "csv-export",
    title: "CSV-Export",
    description: "Knoten als CSV in das Fach out/ — ganzer Baum, oder aus dem Kontextmenü die selektierten Knoten samt Teilbaum.",
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
`
  },
  {
    key: "rest-lesen",
    title: "Fremdsystem lesen",
    description: "Eine REST-Schnittstelle über einen Zugang lesen — der Server hängt die Anmeldung an, das Geheimnis bleibt bei ihm.",
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
`
  },
  {
    key: "rest-beschicken",
    title: "Fremdsystem beschicken",
    description: "journali-Knoten lesen und einzeln an eine REST-Schnittstelle senden (POST über einen Zugang).",
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
`
  },
  {
    key: "sap-odata",
    title: "ERP OData lesen",
    description: "Ein ERP-Gateway-OData-Service (v2 oder v4) über einen Zugang lesen: $format=json, Blättern mit $skip/$top, das Ergebnis als Tabelle.",
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
`
  },
  {
    key: "sap-odata-schreiben",
    title: "ERP OData schreiben (CSRF)",
    description: "Einen Datensatz nach ERP Gateway (OData v2) anlegen — mit dem CSRF-Token-Ablauf: erst Token und Sitzungskeks holen, dann schreiben.",
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
`
  },
  {
    key: "sap-sync",
    title: "ERP-Sync über OData",
    description: "Die heutige Version der ERP-Synchronisierung: Material oder Preise per OData holen, je ERP-Nummer den Knoten finden und Attribute im Stapel setzen. Als Zeitplan-Job.",
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
`
  },
  {
    key: "schritte-helfer",
    title: "Schritte, Snapshot und Helfer",
    description: "Zeigt ctx.step (benannte Schritte mit Dauer, JSON-Schema-Prüfung und Snapshot ins Fach out/) und ctx.lib (kuratierte Helfer wie csv, get, chunk).",
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
`
  },
  {
    key: "promotion-skripte",
    title: "Promotion test→prod: Skripte",
    description: "Hebt scriptum-Skripte auf eine andere Instanz (test→prod): Diff über die Skriptliste, Trockenlauf als Standard, Anwenden per Schalter. Löscht auf dem Ziel nie.",
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
`
  },
  {
    key: "knoten-auflisten",
    title: "Auf Auswahl: Knoten auflisten",
    description: "Ein Knoten-Skript (meta.nodes) — erscheint im Kontextmenü des Baums und läuft auf den selektierten Knoten; hier listet es sie als Tabelle.",
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
`
  },
  {
    key: "bericht-zaehlen",
    title: "Knoten je Wert zählen",
    description: "Ein einfacher Bericht ohne Fremdsystem: wie viele Knoten je Wert eines Feldes (etwa status).",
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
`
  }
];
const _export_sfc = (sfc, props) => {
  const target = sfc.__vccOpts || sfc;
  for (const [key, val] of props) {
    target[key] = val;
  }
  return target;
};
const _hoisted_1 = { class: "toolbar" };
const _hoisted_2 = { class: "muted" };
const _hoisted_3 = {
  key: 0,
  class: "toolbar",
  style: { "border-bottom": "1px solid var(--line)" }
};
const _hoisted_4 = ["placeholder"];
const _hoisted_5 = ["disabled"];
const _hoisted_6 = { class: "scroll" };
const _hoisted_7 = ["onClick", "title"];
const _hoisted_8 = { class: "lbl" };
const _hoisted_9 = ["title"];
const _hoisted_10 = ["title"];
const _hoisted_11 = {
  key: 0,
  class: "empty"
};
const _hoisted_12 = {
  class: "pane",
  style: { "flex": "1" }
};
const _hoisted_13 = { class: "toolbar" };
const _hoisted_14 = { class: "mono muted" };
const _hoisted_15 = {
  key: 0,
  class: "muted"
};
const _hoisted_16 = ["title"];
const _hoisted_17 = ["title"];
const _hoisted_18 = ["disabled", "title"];
const _hoisted_19 = { class: "scroll" };
const _hoisted_20 = {
  key: 0,
  class: "grid form"
};
const _hoisted_21 = { class: "attr" };
const _hoisted_22 = { class: "muted" };
const _hoisted_23 = {
  class: "muted",
  style: { "font-size": "11px" }
};
const _hoisted_24 = ["title"];
const _hoisted_25 = ["value"];
const _hoisted_26 = { value: "" };
const _hoisted_27 = ["value"];
const _hoisted_28 = ["title"];
const _hoisted_29 = ["value"];
const _hoisted_30 = { value: "" };
const _hoisted_31 = ["value"];
const _hoisted_32 = ["title"];
const _hoisted_33 = ["value"];
const _hoisted_34 = { class: "section" };
const _hoisted_35 = { class: "muted" };
const _hoisted_36 = {
  key: 0,
  class: "grid form"
};
const _hoisted_37 = ["title"];
const _hoisted_38 = ["data-key", "onUpdate:modelValue", "title"];
const _hoisted_39 = { value: "" };
const _hoisted_40 = ["value"];
const _hoisted_41 = ["data-key", "type", "onUpdate:modelValue"];
const _hoisted_42 = ["data-key", "checked", "onChange"];
const _hoisted_43 = {
  key: 1,
  class: "muted"
};
const _hoisted_44 = {
  key: 1,
  class: "section ergebnis"
};
const _hoisted_45 = { class: "muted" };
const _hoisted_46 = ["href", "title"];
const _hoisted_47 = {
  key: 0,
  class: "grid tabelle"
};
const _hoisted_48 = {
  key: 1,
  class: "warn"
};
const _hoisted_49 = {
  key: 2,
  class: "text"
};
const _hoisted_50 = {
  key: 3,
  class: "datei"
};
const _hoisted_51 = ["href", "download"];
const _hoisted_52 = { class: "muted" };
const _hoisted_53 = {
  key: 4,
  class: "neg"
};
const _hoisted_54 = {
  key: 5,
  class: "muted"
};
const _hoisted_55 = {
  key: 6,
  class: "log"
};
const _hoisted_56 = {
  key: 1,
  class: "empty"
};
const _sfc_main = {
  __name: "View",
  setup(__props) {
    const listW = paneWidth("scriptum.list", 280);
    const liste2 = ref([]);
    const cur = ref(null);
    const busy = ref("");
    const editor = ref(false);
    const neu = ref("");
    const werte = ref({});
    const lauf = ref(null);
    const zugaenge = ref([]);
    const darfSchreiben = computed(() => store.can("scriptum.write"));
    const rollen = ref([]);
    const RECHTE = ref([]);
    let poll = null;
    onMounted(async () => {
      await laden();
      try {
        zugaenge.value = await api.get("/api/drivers");
      } catch {
        zugaenge.value = [];
      }
      if (darfSchreiben.value) {
        try {
          rollen.value = await api.get("/api/auth/roles");
        } catch {
          rollen.value = [];
        }
        try {
          RECHTE.value = await api.get("/api/auth/rights");
        } catch {
          RECHTE.value = [];
        }
      }
      try {
        const roh = localStorage.getItem("journali.scriptum.run");
        if (roh) {
          localStorage.removeItem("journali.scriptum.run");
          const { key, job, run } = JSON.parse(roh);
          const s = liste2.value.find((x) => x.key === key);
          if (s && job && run) {
            await waehlen(s);
            lauf.value = { job, run, laeuft: true };
            busy.value = t("läuft …");
            frage();
          }
        }
      } catch {
      }
    });
    onUnmounted(() => clearTimeout(poll));
    async function laden(key = cur.value?.key) {
      try {
        liste2.value = await api.get("/api/scriptum/scripts");
      } catch (e) {
        store.toast(e.message);
        return;
      }
      if (key) await waehlen(liste2.value.find((s) => s.key === key) ?? null);
      else if (!cur.value && liste2.value.length) await waehlen(liste2.value[0]);
    }
    async function waehlen(s) {
      lauf.value = null;
      clearTimeout(poll);
      if (!s) {
        cur.value = null;
        return;
      }
      if (darfSchreiben.value) {
        try {
          cur.value = await api.get(`/api/scriptum/scripts/${encodeURIComponent(s.key)}`);
        } catch (e) {
          store.toast(e.message);
          cur.value = s;
        }
      } else cur.value = s;
      werte.value = Object.fromEntries((cur.value.params ?? []).map((p) => [p.key, p.default ?? ""]));
    }
    async function speichern(quelle) {
      const kopf = kopfLesen(quelle);
      const params = kopf ? paramsAus(kopf) : cur.value.params ?? [];
      const leib = { source: quelle, params };
      if (kopf?.label) leib.label = String(kopf.label);
      if (kopf?.role) leib.role = String(kopf.role);
      if (kopf) leib.nodes = !!kopf.nodes;
      try {
        await api.post(`/api/scriptum/scripts/${encodeURIComponent(cur.value.key)}`, leib, "PUT");
        editor.value = false;
        store.toast(kopf ? t("✓ Gespeichert · {0} Parameter aus dem Kopf", [params.length]) : t("✓ Gespeichert — ohne Kopf (export const meta) hat das Skript kein Formular"), kopf ? "ok" : "error");
        await laden(cur.value.key);
        refresh();
      } catch (e) {
        store.toast(e.message);
      }
    }
    async function feldSetzen(feld, wert) {
      try {
        await api.post(`/api/scriptum/scripts/${encodeURIComponent(cur.value.key)}`, { [feld]: wert }, "PUT");
        await laden(cur.value.key);
      } catch (e) {
        store.toast(e.message);
      }
    }
    async function anlegen() {
      const key = neu.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
      if (!key) return;
      try {
        await api.post(`/api/scriptum/scripts/${encodeURIComponent(key)}`, { label: key, source: "" }, "PUT");
        neu.value = "";
        await laden(key);
        editor.value = true;
      } catch (e) {
        store.toast(e.message);
      }
    }
    async function entfernen() {
      if (!cur.value) return;
      try {
        await api.del(`/api/scriptum/scripts/${encodeURIComponent(cur.value.key)}`);
        cur.value = null;
        await laden(null);
        refresh();
      } catch (e) {
        store.toast(e.message);
      }
    }
    async function ausfuehren() {
      if (!cur.value || busy.value) return;
      busy.value = t("startet …");
      lauf.value = null;
      try {
        const r = await api.post(`/api/scriptum/scripts/${encodeURIComponent(cur.value.key)}/run`, { params: Object.fromEntries(Object.entries(werte.value).map(([k, v]) => [k, String(v ?? "")])) });
        lauf.value = { job: r.job, run: r.run, laeuft: true, seit: Date.now() };
        busy.value = t("läuft …");
        frage();
      } catch (e) {
        busy.value = "";
        store.toast(e.message);
      }
    }
    function frage() {
      clearTimeout(poll);
      poll = setTimeout(async () => {
        if (!lauf.value) return;
        try {
          const r = await api.get(`/api/scriptum/runs/${lauf.value.job}/${lauf.value.run}`);
          lauf.value = { ...lauf.value, ...r };
          if (r.laeuft) return frage();
          busy.value = "";
        } catch (e) {
          busy.value = "";
          store.toast(e.message);
        }
      }, abstand(lauf.value?.seit));
    }
    const ergebnis = computed(() => lauf.value?.ergebnis ?? null);
    const dateiLink = computed(() => ergebnis.value?.file ? `${store.server}/api/scriptum/runs/${lauf.value.job}/${lauf.value.run}/file?name=${encodeURIComponent(ergebnis.value.file)}` : null);
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock(
        Fragment,
        null,
        [
          createElementVNode(
            "div",
            {
              class: "pane",
              style: normalizeStyle(`width:${unref(listW)}px;flex:none`)
            },
            [
              createElementVNode("div", _hoisted_1, [
                createElementVNode(
                  "h1",
                  null,
                  toDisplayString(_ctx.$t("⌨ Skripte")),
                  1
                  /* TEXT */
                ),
                _cache[7] || (_cache[7] = createElementVNode(
                  "span",
                  { class: "grow" },
                  null,
                  -1
                  /* CACHED */
                )),
                createElementVNode(
                  "span",
                  _hoisted_2,
                  toDisplayString(liste2.value.length),
                  1
                  /* TEXT */
                )
              ]),
              darfSchreiben.value ? (openBlock(), createElementBlock("div", _hoisted_3, [
                withDirectives(createElementVNode("input", {
                  "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => neu.value = $event),
                  type: "text",
                  placeholder: _ctx.$t("neues Skript (key)"),
                  style: { "flex": "1" },
                  onKeydown: withKeys(anlegen, ["enter"])
                }, null, 40, _hoisted_4), [
                  [vModelText, neu.value]
                ]),
                createElementVNode("button", {
                  class: "primary",
                  disabled: !neu.value.trim(),
                  onClick: anlegen
                }, "+", 8, _hoisted_5)
              ])) : createCommentVNode("v-if", true),
              createElementVNode("div", _hoisted_6, [
                (openBlock(true), createElementBlock(
                  Fragment,
                  null,
                  renderList(liste2.value, (s) => {
                    return openBlock(), createElementBlock("div", {
                      key: s.key,
                      class: normalizeClass(["zeile", { on: cur.value?.key === s.key }]),
                      onClick: ($event) => waehlen(s),
                      title: s.key
                    }, [
                      createElementVNode(
                        "span",
                        _hoisted_8,
                        toDisplayString(s.label || s.key),
                        1
                        /* TEXT */
                      ),
                      s.released ? (openBlock(), createElementBlock("span", {
                        key: 0,
                        class: "pos",
                        title: _ctx.$t("freigegeben: sein Lauf braucht das Recht {0}", [s.run])
                      }, "●", 8, _hoisted_9)) : (openBlock(), createElementBlock("span", {
                        key: 1,
                        class: "muted",
                        title: _ctx.$t("nicht freigegeben — nur wer Skripte schreiben darf, kann es anstossen")
                      }, "○", 8, _hoisted_10))
                    ], 10, _hoisted_7);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                )),
                !liste2.value.length ? (openBlock(), createElementBlock(
                  "div",
                  _hoisted_11,
                  toDisplayString(darfSchreiben.value ? _ctx.$t("Noch kein Skript.") : _ctx.$t("Kein Skript freigegeben.")),
                  1
                  /* TEXT */
                )) : createCommentVNode("v-if", true)
              ])
            ],
            4
            /* STYLE */
          ),
          createVNode(unref(Splitter), {
            modelValue: unref(listW),
            "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => isRef(listW) ? listW.value = $event : null),
            min: 200,
            max: 520
          }, null, 8, ["modelValue"]),
          createElementVNode("div", _hoisted_12, [
            cur.value ? (openBlock(), createElementBlock(
              Fragment,
              { key: 0 },
              [
                createElementVNode("div", _hoisted_13, [
                  createElementVNode(
                    "h1",
                    null,
                    "⌨ " + toDisplayString(cur.value.label || cur.value.key),
                    1
                    /* TEXT */
                  ),
                  createElementVNode(
                    "span",
                    _hoisted_14,
                    toDisplayString(cur.value.key),
                    1
                    /* TEXT */
                  ),
                  _cache[8] || (_cache[8] = createElementVNode(
                    "span",
                    { class: "grow" },
                    null,
                    -1
                    /* CACHED */
                  )),
                  busy.value ? (openBlock(), createElementBlock(
                    "span",
                    _hoisted_15,
                    toDisplayString(busy.value),
                    1
                    /* TEXT */
                  )) : createCommentVNode("v-if", true),
                  darfSchreiben.value ? (openBlock(), createElementBlock("button", {
                    key: 1,
                    class: "editor",
                    onClick: _cache[2] || (_cache[2] = ($event) => editor.value = true),
                    title: _ctx.$t("Quelltext bearbeiten — der Kopf ist das Formular")
                  }, toDisplayString(_ctx.$t("⌨ Quelltext")), 9, _hoisted_16)) : createCommentVNode("v-if", true),
                  darfSchreiben.value ? (openBlock(), createElementBlock("button", {
                    key: 2,
                    class: "x",
                    onClick: entfernen,
                    title: _ctx.$t("Skript entfernen — die Läufe bleiben im Journal")
                  }, "✕", 8, _hoisted_17)) : createCommentVNode("v-if", true),
                  createElementVNode("button", {
                    class: "primary start",
                    disabled: !!busy.value,
                    onClick: ausfuehren,
                    title: _ctx.$t("Als Lauf anstossen — Log und Ergebnis stehen danach hier")
                  }, toDisplayString(_ctx.$t("▶ Ausführen")), 9, _hoisted_18)
                ]),
                createElementVNode("div", _hoisted_19, [
                  darfSchreiben.value ? (openBlock(), createElementBlock("table", _hoisted_20, [
                    _cache[9] || (_cache[9] = createElementVNode(
                      "colgroup",
                      null,
                      [
                        createElementVNode("col", { style: { "width": "150px" } }),
                        createElementVNode("col")
                      ],
                      -1
                      /* CACHED */
                    )),
                    createElementVNode("tbody", null, [
                      createElementVNode("tr", null, [
                        createElementVNode(
                          "td",
                          _hoisted_21,
                          toDisplayString(_ctx.$t("Bezeichnung")),
                          1
                          /* TEXT */
                        ),
                        createElementVNode("td", _hoisted_22, [
                          createTextVNode(
                            toDisplayString(cur.value.label) + " ",
                            1
                            /* TEXT */
                          ),
                          createElementVNode(
                            "span",
                            _hoisted_23,
                            toDisplayString(_ctx.$t("· aus dem Kopf des Skripts")),
                            1
                            /* TEXT */
                          )
                        ])
                      ]),
                      createElementVNode("tr", null, [
                        createElementVNode("td", {
                          class: "attr",
                          title: _ctx.$t("Mit dieser Rolle arbeitet der Lauf — er darf nie mehr als ein Anwender mit ihr")
                        }, toDisplayString(_ctx.$t("Rolle des Laufs")), 9, _hoisted_24),
                        createElementVNode("td", null, [
                          createElementVNode("select", {
                            class: "rolle",
                            value: cur.value.role ?? "",
                            onChange: _cache[3] || (_cache[3] = (e) => feldSetzen("role", e.target.value))
                          }, [
                            createElementVNode(
                              "option",
                              _hoisted_26,
                              toDisplayString(_ctx.$t("— editor —")),
                              1
                              /* TEXT */
                            ),
                            (openBlock(true), createElementBlock(
                              Fragment,
                              null,
                              renderList(rollen.value, (r) => {
                                return openBlock(), createElementBlock("option", {
                                  key: r.key,
                                  value: r.key
                                }, toDisplayString(r.label || r.key), 9, _hoisted_27);
                              }),
                              128
                              /* KEYED_FRAGMENT */
                            ))
                          ], 40, _hoisted_25)
                        ])
                      ]),
                      createElementVNode("tr", null, [
                        createElementVNode("td", {
                          class: "attr",
                          title: _ctx.$t("Mit welchem Recht andere es anstossen dürfen; ohne Recht kann es nur, wer Skripte schreibt")
                        }, toDisplayString(_ctx.$t("Freigabe")), 9, _hoisted_28),
                        createElementVNode("td", null, [
                          createElementVNode("select", {
                            class: "freigabe",
                            value: cur.value.run ?? "",
                            onChange: _cache[4] || (_cache[4] = (e) => feldSetzen("run", e.target.value))
                          }, [
                            createElementVNode(
                              "option",
                              _hoisted_30,
                              toDisplayString(_ctx.$t("— nicht freigegeben —")),
                              1
                              /* TEXT */
                            ),
                            (openBlock(true), createElementBlock(
                              Fragment,
                              null,
                              renderList(RECHTE.value, (r) => {
                                return openBlock(), createElementBlock("option", {
                                  key: r.key,
                                  value: r.key
                                }, toDisplayString(r.label), 9, _hoisted_31);
                              }),
                              128
                              /* KEYED_FRAGMENT */
                            ))
                          ], 40, _hoisted_29)
                        ])
                      ]),
                      createElementVNode("tr", null, [
                        createElementVNode("td", {
                          class: "attr",
                          title: _ctx.$t("Der Lauf wird abgebrochen, wenn er länger braucht")
                        }, toDisplayString(_ctx.$t("Zeitgrenze (s)")), 9, _hoisted_32),
                        createElementVNode("td", null, [
                          createElementVNode("input", {
                            class: "limit",
                            type: "number",
                            min: "5",
                            max: "3600",
                            value: cur.value.limit,
                            onChange: _cache[5] || (_cache[5] = (e) => feldSetzen("limit", Number(e.target.value) || 60)),
                            style: { "width": "90px" }
                          }, null, 40, _hoisted_33)
                        ])
                      ])
                    ])
                  ])) : createCommentVNode("v-if", true),
                  createElementVNode("div", _hoisted_34, [
                    createElementVNode("h2", null, [
                      createTextVNode(
                        toDisplayString(_ctx.$t("Parameter") + " "),
                        1
                        /* TEXT */
                      ),
                      createElementVNode(
                        "span",
                        _hoisted_35,
                        toDisplayString(_ctx.$t("· aus dem Kopf des Skripts")),
                        1
                        /* TEXT */
                      )
                    ]),
                    (cur.value.params ?? []).length ? (openBlock(), createElementBlock("table", _hoisted_36, [
                      _cache[10] || (_cache[10] = createElementVNode(
                        "colgroup",
                        null,
                        [
                          createElementVNode("col", { style: { "width": "150px" } }),
                          createElementVNode("col")
                        ],
                        -1
                        /* CACHED */
                      )),
                      createElementVNode("tbody", null, [
                        (openBlock(true), createElementBlock(
                          Fragment,
                          null,
                          renderList(cur.value.params, (p) => {
                            return openBlock(), createElementBlock("tr", {
                              key: p.key
                            }, [
                              createElementVNode("td", {
                                class: "attr",
                                title: p.key
                              }, toDisplayString(p.label || p.key), 9, _hoisted_37),
                              createElementVNode("td", null, [
                                p.type === "driver" ? withDirectives((openBlock(), createElementBlock("select", {
                                  key: 0,
                                  class: "param",
                                  "data-key": p.key,
                                  "onUpdate:modelValue": ($event) => werte.value[p.key] = $event,
                                  style: { "width": "100%" },
                                  title: _ctx.$t("ein eingerichteter Zugang — der Server hängt die Anmeldung an")
                                }, [
                                  createElementVNode(
                                    "option",
                                    _hoisted_39,
                                    toDisplayString(_ctx.$t("— Zugang wählen —")),
                                    1
                                    /* TEXT */
                                  ),
                                  (openBlock(true), createElementBlock(
                                    Fragment,
                                    null,
                                    renderList(zugaenge.value, (z) => {
                                      return openBlock(), createElementBlock("option", {
                                        key: z.key,
                                        value: z.key
                                      }, toDisplayString(z.label || z.key), 9, _hoisted_40);
                                    }),
                                    128
                                    /* KEYED_FRAGMENT */
                                  ))
                                ], 8, _hoisted_38)), [
                                  [vModelSelect, werte.value[p.key]]
                                ]) : p.type !== "boolean" ? withDirectives((openBlock(), createElementBlock("input", {
                                  key: 1,
                                  class: "param",
                                  "data-key": p.key,
                                  type: p.type === "number" ? "number" : "text",
                                  "onUpdate:modelValue": ($event) => werte.value[p.key] = $event,
                                  style: { "width": "100%" }
                                }, null, 8, _hoisted_41)), [
                                  [vModelDynamic, werte.value[p.key]]
                                ]) : (openBlock(), createElementBlock("input", {
                                  key: 2,
                                  class: "param",
                                  "data-key": p.key,
                                  type: "checkbox",
                                  checked: String(werte.value[p.key]) === "true",
                                  onChange: (e) => werte.value[p.key] = String(e.target.checked)
                                }, null, 40, _hoisted_42))
                              ])
                            ]);
                          }),
                          128
                          /* KEYED_FRAGMENT */
                        ))
                      ])
                    ])) : (openBlock(), createElementBlock(
                      "div",
                      _hoisted_43,
                      toDisplayString(_ctx.$t("Dieses Skript hat keine Parameter.")),
                      1
                      /* TEXT */
                    ))
                  ]),
                  lauf.value ? (openBlock(), createElementBlock("div", _hoisted_44, [
                    createElementVNode("h2", null, [
                      createTextVNode(
                        toDisplayString(_ctx.$t("Ergebnis") + " "),
                        1
                        /* TEXT */
                      ),
                      createElementVNode(
                        "span",
                        _hoisted_45,
                        toDisplayString(lauf.value.laeuft ? _ctx.$t("· läuft") : _ctx.$t("· {0}", [lauf.value.status ?? "—"])),
                        1
                        /* TEXT */
                      ),
                      _cache[11] || (_cache[11] = createElementVNode(
                        "span",
                        { class: "grow" },
                        null,
                        -1
                        /* CACHED */
                      )),
                      unref(plugins).enabled("tasker") ? (openBlock(), createElementBlock("a", {
                        key: 0,
                        href: `#/p/tasker/jobs?job=${lauf.value.job}`,
                        class: "muted",
                        title: _ctx.$t("Der Lauf steht als Job unter ⏱ Jobs — mit seinem Log")
                      }, toDisplayString(_ctx.$t("⏱ Lauf")), 9, _hoisted_46)) : createCommentVNode("v-if", true)
                    ]),
                    ergebnis.value?.table ? (openBlock(), createElementBlock("table", _hoisted_47, [
                      createElementVNode("thead", null, [
                        createElementVNode("tr", null, [
                          (openBlock(true), createElementBlock(
                            Fragment,
                            null,
                            renderList(ergebnis.value.table.columns, (c) => {
                              return openBlock(), createElementBlock(
                                "th",
                                { key: c },
                                toDisplayString(c),
                                1
                                /* TEXT */
                              );
                            }),
                            128
                            /* KEYED_FRAGMENT */
                          ))
                        ])
                      ]),
                      createElementVNode("tbody", null, [
                        (openBlock(true), createElementBlock(
                          Fragment,
                          null,
                          renderList(ergebnis.value.table.rows, (r, i) => {
                            return openBlock(), createElementBlock("tr", { key: i }, [
                              (openBlock(true), createElementBlock(
                                Fragment,
                                null,
                                renderList(r, (z, j) => {
                                  return openBlock(), createElementBlock(
                                    "td",
                                    { key: j },
                                    toDisplayString(z),
                                    1
                                    /* TEXT */
                                  );
                                }),
                                128
                                /* KEYED_FRAGMENT */
                              ))
                            ]);
                          }),
                          128
                          /* KEYED_FRAGMENT */
                        ))
                      ])
                    ])) : createCommentVNode("v-if", true),
                    ergebnis.value?.gekuerzt ? (openBlock(), createElementBlock(
                      "div",
                      _hoisted_48,
                      toDisplayString(_ctx.$t("{0} Zeilen — gezeigt werden die ersten {1}", [ergebnis.value.gekuerzt, ergebnis.value.table.rows.length])),
                      1
                      /* TEXT */
                    )) : createCommentVNode("v-if", true),
                    ergebnis.value?.text ? (openBlock(), createElementBlock(
                      "pre",
                      _hoisted_49,
                      toDisplayString(ergebnis.value.text),
                      1
                      /* TEXT */
                    )) : createCommentVNode("v-if", true),
                    ergebnis.value?.file ? (openBlock(), createElementBlock("div", _hoisted_50, [
                      createElementVNode("a", {
                        href: dateiLink.value,
                        download: ergebnis.value.file,
                        class: "download"
                      }, toDisplayString(_ctx.$t("⤓ {0}", [ergebnis.value.file])), 9, _hoisted_51),
                      createElementVNode(
                        "span",
                        _hoisted_52,
                        toDisplayString(_ctx.$t("· im Fach out/ des Laufs")),
                        1
                        /* TEXT */
                      )
                    ])) : createCommentVNode("v-if", true),
                    ergebnis.value?.fehler ? (openBlock(), createElementBlock(
                      "div",
                      _hoisted_53,
                      toDisplayString(ergebnis.value.fehler),
                      1
                      /* TEXT */
                    )) : createCommentVNode("v-if", true),
                    !ergebnis.value && !lauf.value.laeuft ? (openBlock(), createElementBlock(
                      "div",
                      _hoisted_54,
                      toDisplayString(_ctx.$t("Der Lauf hat nichts gemeldet.")),
                      1
                      /* TEXT */
                    )) : createCommentVNode("v-if", true),
                    lauf.value.log ? (openBlock(), createElementBlock(
                      "pre",
                      _hoisted_55,
                      toDisplayString(lauf.value.log),
                      1
                      /* TEXT */
                    )) : createCommentVNode("v-if", true)
                  ])) : createCommentVNode("v-if", true)
                ])
              ],
              64
              /* STABLE_FRAGMENT */
            )) : (openBlock(), createElementBlock(
              "div",
              _hoisted_56,
              toDisplayString(_ctx.$t("Links ein Skript wählen.")),
              1
              /* TEXT */
            )),
            editor.value && cur.value ? (openBlock(), createBlock(unref(ScriptEditor), {
              key: 2,
              lang: "js",
              "model-value": cur.value.source ?? "",
              title: cur.value.label || cur.value.key,
              templates: unref(beispiele),
              "draft-key": "scriptum." + cur.value.key,
              onSave: speichern,
              onClose: _cache[6] || (_cache[6] = ($event) => editor.value = false)
            }, null, 8, ["model-value", "title", "templates", "draft-key"])) : createCommentVNode("v-if", true)
          ])
        ],
        64
        /* STABLE_FRAGMENT */
      );
    };
  }
};
const View = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-f65bc931"]]);
refresh();
const entry = {
  views: [{ path: "skripte", topic: "tools", label: t("Skripte"), icon: "λ", hint: t("Auswertungen und Übergaben, die hier geschrieben werden: Tabelle, Text oder Datei — von Hand oder als Job"), component: View }],
  // Skripte mit meta.nodes:true erscheinen im Knoten-Kontextmenü und laufen auf den selektierten Knoten (IDs als Parameter „nodes")
  nodeActions: [{ multi: true, items: (row, below, sel) => liste.map((s) => ({ label: s.label || s.key, run: (ctx) => laufAufKnoten(s, sel && sel.length ? sel.map((x) => x.id) : [row.id], ctx) })) }]
};
export {
  entry as default
};
