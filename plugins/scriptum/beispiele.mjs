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
    description: 'Alle sichtbaren Knoten als CSV in das Fach out/ des Laufs.',
    source: `export const meta = {
  label: 'CSV-Export eines Teilbaums',
  params: [
    { key: 'datei', label: 'Dateiname', type: 'text', default: 'export.csv' },
  ],
}

// Alle sichtbaren Knoten als CSV. Die Spalten sind die Felder einer Knotenzeile; passe die Auswahl an, was du brauchst.
export default async (ctx) => {
  const zeilen = await ctx.api.get('/api/tree')
  if (!zeilen.length) return ctx.out.text('Keine Knoten.')
  const NL = String.fromCharCode(10)
  const spalten = Object.keys(zeilen[0])
  const feld = (w) => {
    const s = String(w == null ? '' : w)
    return (s.indexOf(';') >= 0 || s.indexOf('"') >= 0 || s.indexOf(NL) >= 0) ? '"' + s.split('"').join('""') + '"' : s
  }
  const kopf = spalten.join(';')
  const leib = zeilen.map((z) => spalten.map((s) => feld(z[s])).join(';')).join(NL)
  return ctx.out.file(ctx.params.datei || 'export.csv', kopf + NL + leib)
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
    title: 'SAP OData lesen',
    description: 'Ein SAP-Gateway-OData-Service (v2 oder v4) über einen Zugang lesen: $format=json, Blättern mit $skip/$top, das Ergebnis als Tabelle.',
    source: `export const meta = {
  label: 'SAP OData lesen',
  params: [
    { key: 'system', label: 'Zugang (HTTP/REST)', type: 'driver', default: '' },
    { key: 'service', label: 'OData-Service und Entität', type: 'text', default: '/sap/opu/odata/sap/ZMY_SRV/ProductSet' },
    { key: 'select', label: 'Felder ($select, leer = alle)', type: 'text', default: '' },
    { key: 'grenze', label: 'Höchstens so viele', type: 'number', default: '200' },
  ],
}

// SAP Gateway über einen Zugang lesen. Die Anmeldung (Basic oder Bearer) hängt der Server an — hier steht nur der Pfad
// hinter der Adresse. $format=json, weil SAP sonst XML liefert; geblättert wird mit $skip/$top. Die Antwort ist bei
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
