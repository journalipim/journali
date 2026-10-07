// Demo (07.10.2026): GPC an den Gruppen des Beispielkatalogs. Ein Auszug der GS1-Produktklassifikation im Format der Veröffentlichung (JSON,
// englische Titel), gelesen mit den Funktionen des Plugins gpc — dieselben Datensätze und Merkmale, als hätte jemand die Datei übernommen
// und die Klasse zugewiesen. Die Nutzung der GPC ist kostenfrei (GS1 Germany, gs1-germany.de/standards/produktklassifikation-gpc).
// Codes und Titel aus dem GPC-Browser (gpc-browser.gs1.org, „GPC as of May 2026“), nur die Bricks und Werte, die der Katalog braucht.
// Aufruf: node demo-gpc.mjs <plugins-Verzeichnis> → eine Zeile JSON auf stdout.
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const gpc = await import(pathToFileURL(path.join(process.argv[2], 'gpc', 'core.mjs')).href)

const wert = (Code, Title) => ({ Level: 6, Code, Title, Active: true })
const merkmal = (Code, Title, werte) => ({ Level: 5, Code, Title, Active: true, Childs: werte.map(([c, t]) => wert(c, t)) })
const brick = (Code, Title, merkmale = []) => ({ Level: 4, Code, Title, Definition: null, DefinitionExcludes: null, Active: true, Childs: merkmale })
const JA_NEIN = [[30002654, 'YES'], [30002960, 'NO']]

const VEROEFFENTLICHUNG = {
  LanguageCode: 'EN', DateUtc: '5/20/2026',
  Schema: [
    { Level: 1, Code: 14000000, Title: 'Lighting', Active: true, Childs: [
      { Level: 2, Code: 14010000, Title: 'Lighting', Active: true, Childs: [
        { Level: 3, Code: 14010100, Title: 'Lamps/Light Bulbs/Lighting', Active: true, Childs: [
          brick(10000552, 'Light Bulbs/Tubes/Light-Emitting Diodes', [
            merkmal(20000697, 'Illumination Type', [[30016052, 'LIGHT-EMITTING DIODE (LED)'], [30005067, 'HALOGEN'], [30005066, 'FLUORESCENT'], [30006867, 'INCANDESCENT']]),
            merkmal(20000698, 'Type of Light Bulb/Tube', [[30006070, 'LIGHT BULB'], [30006071, 'FLUORESCENT TUBE']]),
            merkmal(20001709, 'Target Use/Application', [[30006074, 'MULTIPURPOSE/ROOM ILLUMINATION'], [30006073, 'DECORATIVE'], [30006072, 'APPLIANCE SPECIFIC']]),
            merkmal(20000771, 'If Energy Saving', JA_NEIN),
            merkmal(20000499, 'If Coloured', JA_NEIN),
          ]),
          brick(10008403, 'Mounted Lighting', [
            merkmal(20001353, 'Installation Type', [[30009772, 'CEILING MOUNTED'], [30010061, 'WALL MOUNTED']]),
            merkmal(20002571, 'Type of Lighting Fitting', [[30012864, 'PENDANT'], [30012865, 'CHANDELIER'], [30012858, 'RECESSED'], [30012962, 'SURFACE FITTING']]),
          ]),
          brick(10008404, 'Hanging Lighting'),
          brick(10005641, 'Freestanding Lighting', [
            merkmal(20002500, 'Type of Lamp', [[30006839, 'TABLE'], [30004668, 'FLOOR'], [30012587, 'DESK']]),
            merkmal(20000787, 'Power Source', [[30009416, 'MAINS ELECTRICITY'], [30000289, 'BATTERY']]),
          ]),
        ] },
      ] },
    ] },
    { Level: 1, Code: 91000000, Title: 'Safety/Security/Surveillance', Active: true, Childs: [
      { Level: 2, Code: 91030000, Title: 'Home/Business Safety/Security/Surveillance', Active: true, Childs: [
        { Level: 3, Code: 91030400, Title: 'Home/Business Surveillance Equipment', Active: true, Childs: [
          brick(10005413, 'Security Lights', [merkmal(20002343, 'Type of Security Light', [[30012096, 'FLOODLIGHT']])]),
        ] },
      ] },
    ] },
  ],
}

// Gruppe des Beispielkatalogs (deutsche Bezeichnung) → Brick und Werte an der Gruppe (Merkmal → Wert); Wegeleuchten haben keinen eigenen Brick
const ZUORDNUNG = [
  ['LED-Lampen', 10000552, { 20000697: 30016052, 20000698: 30006070, 20001709: 30006074, 20000771: 30002654, 20000499: 30002960 }],
  ['Deckenleuchten', 10008403, { 20001353: 30009772, 20002571: 30012962 }],
  ['Wandleuchten', 10008403, { 20001353: 30010061, 20002571: 30012962 }],
  ['Pendelleuchten', 10008404, {}],
  ['Tischleuchten', 10005641, { 20002500: 30006839, 20000787: 30009416 }],
  ['Strahler', 10005413, { 20002343: 30012096 }],
]

const rel = gpc.parseGpc(JSON.stringify(VEROEFFENTLICHUNG))
const records = gpc.toRecords(rel)
const dict = records.dict
const nachAttribut = gpc.classesByAttribute(rel.bricks)
const klassen = rel.bricks.map(b => gpc.classSpec(b, dict.hierarchy, 'en'))
const zuweisungen = ZUORDNUNG.map(([gruppe, code, werte]) => {
  const b = rel.bricks.find(x => x.code === String(code))
  return {
    gruppe, brick: b.code, classes: klassen, features: gpc.featureSpecs(b, dict, nachAttribut),
    werte: Object.fromEntries(Object.entries(werte).map(([a, v]) => [gpc.attrKey(a), String(v)])),
  }
})
process.stdout.write(JSON.stringify({ system: gpc.systemSpec({}), records, zuweisungen }) + '\n')
