// Blog auf der WordPress-Seite (04.10.2026): tools/blog.mjs macht aus blog/*.md Blöcke des Editors und legt sie als Entwurf an — geprüft gegen einen
// nachgebauten WordPress-Server, nicht gegen die Seite.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { kopfLesen, kopfSetzen, inline, bloecke, seitenBlock, cssUnter, abschnitt, htmlBloecke, wp, entwurf, zugang, seite, hash, schlagwoerter, wpDatum,
  haeufigeFragen, quellen, strukturierteDaten, klartext, aktualisieren, datenSetzen, KI_HINWEIS, beschreibung, metaSetzen, seoFelder, META_BESCHREIBUNG,
  META_KEYPHRASE, MAX_BESCHREIBUNG } from '../../tools/blog.mjs'

test('Kopf lesen und setzen — der Rest der Datei bleibt', () => {
  const t = '---\r\ntitle: Multi-Server\r\ntags: [Betrieb, Lizenz]\r\n---\r\nText\r\n'
  const { kopf, rumpf } = kopfLesen(t)
  assert.deepEqual(kopf, { title: 'Multi-Server', tags: ['Betrieb', 'Lizenz'] })
  assert.equal(rumpf, 'Text\n')
  const neu = kopfSetzen(t, 'wp', 42)
  assert.equal(neu, '---\r\ntitle: Multi-Server\r\ntags: [Betrieb, Lizenz]\r\nwp: 42\r\n---\r\nText\r\n')
  assert.equal(kopfSetzen(neu, 'wp', 43).match(/wp: \d+/g).join(), 'wp: 43')
})

test('Inline: Code, fett, kursiv, Verweis — HTML wird maskiert', () => {
  assert.equal(inline('**Journal** ist *die* Wahrheit, `a<b` und [Doku](https://x.de/a?b=1&c=2)'),
    '<strong>Journal</strong> ist <em>die</em> Wahrheit, <code>a&lt;b</code> und <a href="https://x.de/a?b=1&amp;c=2">Doku</a>')
  assert.equal(inline('<script>'), '&lt;script&gt;')
  assert.equal(inline('snake_case_name bleibt'), 'snake_case_name bleibt')
})

test('Blöcke: Überschrift, Absatz, Liste, Code, Zitat, Trennlinie, Tabelle', () => {
  const html = bloecke('# Teil\n\nEin Absatz\nüber zwei Zeilen.\n\n- eins\n- zwei\n\n1. a\n2. b\n\n```\nx < y\n```\n\n> Zitat\n\n---\n\n| A | B |\n|---|---|\n| 1 | 2 |\n')
  assert.match(html, /<!-- wp:heading -->\n<h2 class="wp-block-heading">Teil<\/h2>/)
  assert.match(html, /<p>Ein Absatz über zwei Zeilen\.<\/p>/)
  assert.match(html, /<!-- wp:list -->\n<ul class="wp-block-list"><!-- wp:list-item -->\n<li>eins<\/li>/)
  assert.match(html, /<!-- wp:list \{"ordered":true\} -->\n<ol class="wp-block-list">/)
  assert.match(html, /<pre class="wp-block-code"><code>x &lt; y<\/code><\/pre>/)
  assert.match(html, /<blockquote class="wp-block-quote"><!-- wp:paragraph -->\n<p>Zitat<\/p>/)
  assert.match(html, /<!-- wp:separator -->/)
  assert.match(html, /<table><thead><tr><th>A<\/th><th>B<\/th><\/tr><\/thead><tbody><tr><td>1<\/td><td>2<\/td><\/tr><\/tbody><\/table>/)
  assert.match(bloecke('### Klein'), /<!-- wp:heading \{"level":3\} -->\n<h3 class="wp-block-heading">Klein<\/h3>/)
})

test('Screenshot ohne Adresse: ein leerer Bildblock zum Hochladen, darüber was hinein soll', () => {
  const html = bloecke('![Screenshot: Reiter Server mit zwei Servern]()')
  assert.match(html, /<em>Screenshot: Reiter Server mit zwei Servern<\/em>/)
  assert.match(html, /<!-- wp:image \/-->/)
  assert.match(bloecke('![Logo](https://x.de/l.png)'), /<img src="https:\/\/x\.de\/l\.png" alt="Logo"\/>/)
})

test('Eine HTML-Seite wird ein Block: main in div.jx, JSON-LD bleibt — Kopf, Fuß, CSS und andere Skripte fallen weg, Adressen ab der Wurzel', () => {
  const { titel, inhalt } = seitenBlock('<html><head><title>journali PIM</title><style>h1{color:red}</style><script type="application/ld+json">{"a":1}</script></head>'
    + '<body><header>Kopf</header><main><h1>Hallo</h1><img src="logo.png"><a href="impressum.html">I</a><a href="#faq">F</a><a href="https://x.de">X</a><script>alert(1)</script></main><footer>Fuß</footer></body></html>')
  assert.equal(titel, 'journali PIM')
  assert.equal(inhalt, '<!-- wp:html -->\n<script type="application/ld+json">{"a":1}</script>\n<div class="jx"><div class="inhalt">\n'
    + '<h1>Hallo</h1><img src="/logo.png"><a href="/impressum.html">I</a><a href="#faq">F</a><a href="https://x.de">X</a>\n</div></div>\n<!-- /wp:html -->')
})

test('CSS unter .jx: :root und body werden der Rahmen, jeder Selektor bekommt ihn davor, @media bleibt, der dunkle Modus fällt weg', () => {
  assert.equal(cssUnter('main { max-width:1040px }'), '.jx .inhalt { max-width:1040px }', 'main wird .inhalt')
  const css = cssUnter(':root { --a:1 }\n@media (prefers-color-scheme: dark) { :root { --a:2 } }\nbody { margin:0 }\nh1, .grad { color:red }\n'
    + '@media (max-width:900px) { .two { display:block } header nav { display:none } }\n/* weg */ ol.steps li::before { content:"x" }')
  assert.equal(css, '.jx { --a:1 }\n.jx { margin:0 }\n.jx h1, .jx .grad { color:red }\n@media (max-width:900px) {\n  .jx .two { display:block }\n  .jx header nav { display:none }\n}\n.jx ol.steps li::before { content:"x" }')
})

test('Zugang aus der Umgebung oder der Datei — ohne beides eine Meldung, die sagt, was fehlt', () => {
  assert.deepEqual(zugang({ JOURNALI_WP_URL: 'https://x.de/', JOURNALI_WP_USER: 'u', JOURNALI_WP_PASSWORD: 'p' }, '/gibtsnicht'), { url: 'https://x.de', user: 'u', password: 'p' })
  assert.throws(() => zugang({}, '/gibtsnicht'), /no access/)
})

/// Ein nachgebauter WordPress-Server: Beiträge, Schlagwörter, Kategorien
function wordpress() {
  const posts = new Map(), seiten = new Map(), tags = [], kategorien = [], rufe = []
  let n = 100
  const f = async (url, o) => {
    const pfad = url.replace(/^https:\/\/blog\.test\/wp-json\/wp\/v2\//, '')
    const body = o.body ? JSON.parse(o.body) : null
    rufe.push({ methode: o.method, pfad, auth: o.headers.Authorization, body })
    const ok = j => ({ ok: true, status: 200, text: async () => JSON.stringify(j) })
    let m
    // wie WordPress: Namen maskiert gespeichert, gesucht wird im maskierten Namen, ein doppelter Name wird abgewiesen
    if (o.method === 'GET' && pfad.startsWith('tags?')) { const q = decodeURIComponent(pfad.match(/search=([^&]*)/)?.[1] ?? '').toLowerCase(); return ok(tags.filter(t => t.name.toLowerCase().includes(q))) }
    if (o.method === 'GET' && pfad.startsWith('categories?')) { const q = decodeURIComponent(pfad.match(/search=([^&]*)/)?.[1] ?? '').toLowerCase(); return ok(kategorien.filter(t => t.name.toLowerCase().includes(q))) }
    if (o.method === 'POST' && pfad === 'categories') { const t = { id: ++n, name: body.name }; kategorien.push(t); return ok(t) }
    if (o.method === 'POST' && pfad === 'tags') {
      const name = body.name.replace(/&/g, '&amp;')
      if (tags.some(t => t.name === name)) return { ok: false, status: 400, text: async () => JSON.stringify({ message: 'term_exists' }) }
      const t = { id: ++n, name }; tags.push(t); return ok(t)
    }
    if (o.method === 'POST' && pfad === 'posts') { const p = { id: ++n, status: body.status, link: `https://blog.test/?p=${n}`, ...body }; posts.set(p.id, p); return ok(p) }
    if ((m = pfad.match(/^(posts|pages)\/(\d+)/))) {
      const p = (m[1] === 'pages' ? seiten : posts).get(+m[2])
      if (o.method === 'GET') return ok(p)
      // wie WordPress: meta ergänzt die vorhandenen Felder, statt sie zu ersetzen
      const { meta, ...rest } = body
      Object.assign(p, rest); if (meta) p.meta = { ...p.meta, ...meta }
      return ok(p)
    }
    return { ok: false, status: 404, text: async () => JSON.stringify({ message: 'nicht nachgebaut: ' + pfad }) }
  }
  return { f, posts, seiten, tags, rufe }
}

test('Entwurf anlegen: Blöcke, Schlagwörter (fehlende neu), Nummer zurück in die Datei — ein zweites Mal legt keinen zweiten an', async () => {
  const w = wordpress(); const z = { url: 'https://blog.test', user: 'u', password: 'ab cd' }
  const api = wp(z, w.f)
  const datei = '---\ntitle: Multi-Server\ntags: [Betrieb]\nexcerpt: Zwei Server auf einer Datenbank.\n---\n# Was neu ist\n\nText.\n'
  const r = await entwurf(api, z, datei)
  const p = w.posts.get(r.id)
  assert.equal(p.status, 'draft')
  assert.equal(p.title, 'Multi-Server'); assert.equal(p.excerpt, 'Zwei Server auf einer Datenbank.')
  assert.match(p.content, /<h2 class="wp-block-heading">Was neu ist<\/h2>/)
  assert.deepEqual(p.tags, [w.tags[0].id]); assert.equal(w.tags[0].name, 'Betrieb')
  assert.equal(w.rufe[0].auth, 'Basic ' + Buffer.from('u:ab cd').toString('base64'))
  assert.match(r.text, /\nwp: \d+\n---/)
  assert.equal(r.edit, `https://blog.test/wp-admin/post.php?post=${r.id}&action=edit`)

  // dieselbe Datei noch einmal: kein zweiter Beitrag; ersetzen nur ausdrücklich und nur als Entwurf
  await assert.rejects(entwurf(api, z, r.text), /--replace/)
  assert.equal(w.posts.size, 1)
  await entwurf(api, z, r.text.replace('Text.', 'Neuer Text.'), { ersetzen: true })
  assert.match(w.posts.get(r.id).content, /Neuer Text\./)
  w.posts.get(r.id).status = 'publish'
  await assert.rejects(entwurf(api, z, r.text, { ersetzen: true }), /is publish — not changed/)
})

test('Veröffentlichungsdatum: aus dem Kopf als Zeit der Seite, ein Datum gilt für 09:00, ein Entwurf bleibt Entwurf', async () => {
  assert.equal(wpDatum('2026-10-07'), '2026-10-07T09:00:00')
  assert.equal(wpDatum('2026-10-07 14:30'), '2026-10-07T14:30:00')
  assert.equal(wpDatum(' 2026-12-31T23:59 '), '2026-12-31T23:59:00')
  for (const falsch of ['', 'morgen', '07.10.2026', '2026-02-30', '2026-13-01', '2026-10-07 25:00']) assert.throws(() => wpDatum(falsch), /date/, falsch)

  const w = wordpress(); const z = { url: 'https://blog.test', user: 'u', password: 'ab cd' }
  const api = wp(z, w.f)
  const r = await entwurf(api, z, '---\ntitle: Mit Datum\ndate: 2026-10-10\n---\nText.\n')
  const p = w.posts.get(r.id)
  assert.equal(p.status, 'draft'); assert.equal(p.date, '2026-10-10T09:00:00')
  assert.match(r.text, /\ndate: 2026-10-10\n/, 'das Datum bleibt in der Datei')
  const ohne = await entwurf(api, z, '---\ntitle: Ohne Datum\n---\nText.\n')
  assert.equal('date' in w.posts.get(ohne.id), false, 'ohne Datum schickt das Werkzeug keines: WordPress nimmt den Tag der Veröffentlichung')
  await assert.rejects(entwurf(api, z, '---\ntitle: Falsch\ndate: bald\n---\nText.\n'), /not a date/)
})

test('Ein Abschnitt als Blöcke: ab der Überschrift 2 mit der id bis vor die nächste, ihr Text wird der Titel', () => {
  const html = '<body><h1>Rechtliches</h1><h2 id="impressum">Impressum</h2><p>Angebot von</p><p>Kontakt: <a href="mailto:a@b.de">a@b.de</a></p><h3>Haftung</h3><p></p>'
    + '<ul><li>eins</li><li>zwei</li></ul><h2 id="datenschutz">Informationen zum Datenschutz</h2><p>Text</p><a class="back" href="index.html">zurück</a></body>'
  const a = abschnitt(html, 'impressum')
  assert.equal(a.titel, 'Impressum')
  const b = htmlBloecke(a.html)
  assert.equal(b, '<!-- wp:paragraph -->\n<p>Angebot von</p>\n<!-- /wp:paragraph -->\n\n<!-- wp:paragraph -->\n<p>Kontakt: <a href="mailto:a@b.de">a@b.de</a></p>\n<!-- /wp:paragraph -->\n\n'
    + '<!-- wp:heading {"level":3} -->\n<h3 class="wp-block-heading">Haftung</h3>\n<!-- /wp:heading -->\n\n'
    + '<!-- wp:list -->\n<ul class="wp-block-list"><!-- wp:list-item -->\n<li>eins</li>\n<!-- /wp:list-item -->\n<!-- wp:list-item -->\n<li>zwei</li>\n<!-- /wp:list-item --></ul>\n<!-- /wp:list -->')
  const d = abschnitt(html, 'datenschutz')
  assert.equal(d.titel, 'Informationen zum Datenschutz')
  assert.equal(htmlBloecke(d.html), '<!-- wp:paragraph -->\n<p>Text</p>\n<!-- /wp:paragraph -->', 'der Verweis zurück fällt weg')
  assert.throws(() => abschnitt(html, 'gibtsnicht'), /no <h2 id="gibtsnicht">/)
})

test('Seite aktualisieren nur, wenn sie in WordPress unverändert ist', async () => {
  const seiten = new Map(); let n = 0
  const api = async (methode, pfad, body) => {
    let m
    if (methode === 'POST' && pfad === 'pages') { const p = { id: ++n, content: { raw: body.content }, status: body.status }; seiten.set(p.id, p); return p }
    if ((m = pfad.match(/^pages\/(\d+)/))) { const p = seiten.get(+m[1]); if (methode === 'POST') p.content.raw = body.content; return p }
    throw new Error(pfad)
  }
  const a = await seite(api, undefined, { titel: 'Start', inhalt: 'eins' })
  assert.equal(a.neu, true); assert.equal(a.stand.hash, hash('eins'))
  const b = await seite(api, a.stand, { inhalt: 'zwei' })
  assert.equal(seiten.get(a.id).content.raw, 'zwei'); assert.equal(b.stand.hash, hash('zwei'))
  assert.equal((await seite(api, b.stand, { inhalt: 'zwei' })).unveraendert, true)
  seiten.get(a.id).content.raw = 'in WordPress bearbeitet'
  await assert.rejects(seite(api, b.stand, { inhalt: 'drei' }), /was changed in WordPress — not overwritten/)
  assert.equal(seiten.get(a.id).content.raw, 'in WordPress bearbeitet')
})

test('Schlagwörter setzen ändert nur Schlagwörter — auch an einem veröffentlichten Beitrag, der Inhalt bleibt', async () => {
  const w = wordpress(); const z = { url: 'https://blog.test', user: 'u', password: 'p' }
  const api = wp(z, w.f)
  const r = await entwurf(api, z, '---\ntitle: T\ntags: [Alt]\n---\nText.\n')
  const p = w.posts.get(r.id); p.status = 'publish'; p.content = 'in WordPress bearbeitet'
  await schlagwoerter(api, r.text.replace('tags: [Alt]', 'tags: [KI, Betrieb]'))
  assert.deepEqual(p.tags, w.tags.filter(t => ['KI', 'Betrieb'].includes(t.name)).map(t => t.id))
  assert.equal(p.content, 'in WordPress bearbeitet')
  assert.equal(p.status, 'publish')
  const letzter = w.rufe.at(-1)
  assert.deepEqual(Object.keys(letzter.body), ['tags'], 'nur die Schlagwörter gehen hinaus')
  await assert.rejects(schlagwoerter(api, '---\ntitle: T\ntags: [KI]\n---\n'), /wp missing/)
  // ein Name mit & findet den vorhandenen Begriff wieder, obwohl WordPress ihn maskiert speichert und im maskierten Namen sucht
  await schlagwoerter(api, r.text.replace('tags: [Alt]', 'tags: [Import & Export]'))
  await schlagwoerter(api, r.text.replace('tags: [Alt]', 'tags: [Import & Export]'))
  assert.equal(w.tags.filter(t => t.name === 'Import &amp; Export').length, 1)
})

// ---- Fachartikel für Suchmaschinen und KI (16.10.2026): strukturierte Daten, häufige Fragen, ein veröffentlichter Beitrag neu geschrieben

const FACH = `---
title: Digitaler Produktpass (DPP): Rechtsgrundlage, Pflichten und Daten
excerpt: Was der Digitale Produktpass enthält und ab wann er Pflicht ist.
slug: digitaler-produktpass-erklaert
tags: [Compliance, Digitaler Produktpass]
categories: [Wissen]
wp: 101
---
Der **Digitale Produktpass (DPP)** ist ein Datensatz.

## Häufige Fragen

### Ab wann ist der Batteriepass Pflicht?

Der Batteriepass ist ab dem **18. Februar 2027** Pflicht, nach [Art. 77](https://eur-lex.europa.eu/x).

### Was hat ein PIM-System damit zu tun?

Ein PIM-System hält die Daten
über die Lebensdauer.

*${'Erstellt mit Unterstützung von KI.'}*

## Quellen

- Verordnung (EU) 2024/1781: [https://eur-lex.europa.eu/eli/reg/2024/1781/oj](https://eur-lex.europa.eu/eli/reg/2024/1781/oj)
- Batterieverordnung: [https://eur-lex.europa.eu/b](https://eur-lex.europa.eu/b)
`

test('der KI-Hinweis steht in kleiner Schrift — so, wie WordPress den Block schreibt', () => {
  assert.equal(bloecke(KI_HINWEIS), '<!-- wp:paragraph {"fontSize":"small"} -->\n<p class="has-small-font-size"><em>Erstellt mit Unterstützung von KI.</em></p>\n<!-- /wp:paragraph -->')
  assert.match(bloecke('Ein Satz *Erstellt mit Unterstützung von KI.*'), /^<!-- wp:paragraph -->/, 'nur der Satz allein')
})

test('häufige Fragen: je Überschrift 3 der Absatz darunter, als Klartext; Quellen aus dem Abschnitt Quellen', () => {
  const { rumpf } = kopfLesen(FACH)
  assert.deepEqual(haeufigeFragen(rumpf), [
    { frage: 'Ab wann ist der Batteriepass Pflicht?', antwort: 'Der Batteriepass ist ab dem 18. Februar 2027 Pflicht, nach Art. 77.' },
    { frage: 'Was hat ein PIM-System damit zu tun?', antwort: 'Ein PIM-System hält die Daten über die Lebensdauer.' },
  ])
  assert.deepEqual(haeufigeFragen('## Anderes\n\n### Frage?\n\nText.'), [], 'nur im Abschnitt Häufige Fragen')
  assert.deepEqual(quellen(rumpf), ['https://eur-lex.europa.eu/eli/reg/2024/1781/oj', 'https://eur-lex.europa.eu/b'])
  assert.equal(klartext('**fett** und *kursiv*, [Text](https://x.de) und `code`'), 'fett und kursiv, Text und code')
})

test('strukturierte Daten eines Fachartikels: Article mit Quellen, FAQPage aus den häufigen Fragen — kein </script> im Text', () => {
  const { kopf, rumpf } = kopfLesen(FACH)
  const block = strukturierteDaten({ ...kopf, excerpt: 'a </script> b' }, rumpf, { url: 'https://x.de/a/', veroeffentlicht: '2026-09-06T07:00:00Z', geaendert: '2026-10-16T10:00:00Z', site: 'https://x.de' })
  assert.match(block, /^<!-- wp:html -->\n<script type="application\/ld\+json">/)
  assert.doesNotMatch(block.slice(0, -40), /<\/script>[\s\S]*<\/script>/, 'nur ein Ende des Skripts')
  const daten = JSON.parse(block.match(/<script type="application\/ld\+json">([\s\S]*)<\/script>/)[1])
  const [artikel, faq] = daten['@graph']
  assert.equal(daten['@context'], 'https://schema.org')
  assert.equal(artikel['@type'], 'Article'); assert.equal(artikel.headline, kopf.title); assert.equal(artikel.description, 'a </script> b')
  assert.deepEqual([artikel.inLanguage, artikel.datePublished, artikel.dateModified, artikel.url, artikel.mainEntityOfPage], ['de-DE', '2026-09-06T07:00:00Z', '2026-10-16T10:00:00Z', 'https://x.de/a/', 'https://x.de/a/'])
  assert.deepEqual(artikel.publisher, { '@type': 'Organization', name: 'journali', url: 'https://x.de/' })
  assert.equal(artikel.keywords, 'Compliance, Digitaler Produktpass')
  assert.deepEqual(artikel.citation, ['https://eur-lex.europa.eu/eli/reg/2024/1781/oj', 'https://eur-lex.europa.eu/b'])
  assert.equal(faq['@type'], 'FAQPage')
  assert.deepEqual(faq.mainEntity[0], { '@type': 'Question', name: 'Ab wann ist der Batteriepass Pflicht?', acceptedAnswer: { '@type': 'Answer', text: 'Der Batteriepass ist ab dem 18. Februar 2027 Pflicht, nach Art. 77.' } })
  // ohne häufige Fragen nur der Artikel
  assert.equal(JSON.parse(strukturierteDaten(kopf, 'Text.').match(/>(\{.*\})</)[1])['@graph'].length, 1)
})

test('ein Fachartikel als Entwurf bekommt die strukturierten Daten, ein anderer Beitrag nicht', async () => {
  const w = wordpress(); const z = { url: 'https://blog.test', user: 'u', password: 'p' }
  const api = wp(z, w.f)
  const r = await entwurf(api, z, FACH.replace('wp: 101\n', 'date: 2026-11-03\n'))
  const inhalt = w.posts.get(r.id).content
  assert.match(inhalt, /"@type":"FAQPage"/)
  assert.match(inhalt, /"url":"https:\/\/blog\.test\/2026\/11\/03\/digitaler-produktpass-erklaert\/"/, 'die Adresse aus Datum und Slug')
  const r2 = await entwurf(api, z, '---\ntitle: Werbung\ncategories: [Neuigkeiten]\n---\nText.\n')
  assert.doesNotMatch(w.posts.get(r2.id).content, /ld\+json/)
})

test('einen veröffentlichten Beitrag neu schreiben — nur, wenn er in WordPress dem letzten Stand entspricht', async () => {
  const w = wordpress(); const z = { url: 'https://blog.test', user: 'u', password: 'p' }
  const api = wp(z, w.f)
  const alt = FACH.replace('title: Digitaler Produktpass (DPP): Rechtsgrundlage, Pflichten und Daten', 'title: Der Digitale Produktpass').replace(/## Häufige Fragen[\s\S]*?(?=\*Erstellt)/, '')
  // in WordPress: der alte Stand, den KI-Hinweis von Hand in kleiner Schrift — wie auf journali.de
  const { rumpf: altRumpf } = kopfLesen(alt)
  w.posts.set(101, { id: 101, status: 'publish', link: 'https://blog.test/2026/09/06/digitaler-produktpass-erklaert/', date: '2026-09-06T09:00:00', date_gmt: '2026-09-06T07:00:00',
    slug: 'digitaler-produktpass-erklaert', title: { raw: 'Der Digitale Produktpass' }, excerpt: { raw: '' }, content: { raw: bloecke(altRumpf).replace(/\n/g, '\r\n') } })
  const probe = await aktualisieren(api, z, FACH, { vorher: alt, probe: true, jetzt: new Date('2026-10-16T10:00:00Z') })
  assert.equal(probe.probe, true); assert.deepEqual(probe.titel, ['Der Digitale Produktpass', 'Digitaler Produktpass (DPP): Rechtsgrundlage, Pflichten und Daten'])
  assert.equal(probe.fragen, 2); assert.equal(probe.auszug, true)
  assert.equal(w.rufe.filter(r => r.methode === 'POST').length, 0, 'die Probe schreibt nichts')
  const r = await aktualisieren(api, z, FACH, { vorher: alt, jetzt: new Date('2026-10-16T10:00:00Z') })
  const post = w.posts.get(101), letzter = w.rufe.at(-1)
  assert.deepEqual(Object.keys(letzter.body).sort(), ['content', 'excerpt', 'title'], 'Status, Datum, Slug und Schlagwörter gehen nicht hinaus')
  assert.equal(post.status, 'publish')
  assert.match(post.content, /"datePublished":"2026-09-06T07:00:00Z","dateModified":"2026-10-16T10:00:00Z"/)
  assert.match(post.content, /"url":"https:\/\/blog\.test\/2026\/09\/06\/digitaler-produktpass-erklaert\/"/)
  assert.ok(r.stand)
  // danach gilt der Abgleich: noch einmal geht — wurde in WordPress etwas geändert, nicht
  post.content = { raw: post.content }
  await aktualisieren(api, z, FACH, { stand: r.stand })
  post.content = { raw: post.content.raw === undefined ? post.content : post.content.raw }
  w.posts.get(101).content = { raw: 'in WordPress bearbeitet' }
  await assert.rejects(aktualisieren(api, z, FACH, { stand: r.stand }), /changed in WordPress since the last version — not overwritten/)
  await assert.rejects(aktualisieren(api, z, FACH, { vorher: FACH }), /changed in WordPress/)
  w.posts.get(101).status = 'draft'
  await assert.rejects(aktualisieren(api, z, FACH, { stand: r.stand }), /is a draft — use draft --replace/)
  await assert.rejects(aktualisieren(api, z, FACH.replace('wp: 101\n', '')), /wp missing/)
})

test('nur die strukturierten Daten setzen: der übrige Inhalt bleibt Byte für Byte — auch eingefügte Bilder; ein zweites Mal ersetzt den Block', async () => {
  const w = wordpress(); const z = { url: 'https://blog.test', user: 'u', password: 'p' }
  const api = wp(z, w.f)
  const live = '<!-- wp:paragraph -->\r\n<p>Text</p>\r\n<!-- /wp:paragraph -->\r\n\r\n<p><img class="wp-image-175" src="https://blog.test/b.png"></p>'
  w.posts.set(40, { id: 40, status: 'publish', link: 'https://blog.test/2026/10/04/digitaler-produktpass/', date: '2026-10-04T09:00:00', date_gmt: '2026-10-04T07:00:00',
    title: { raw: 'Digitaler Produktpass – journali zeigt euch, was noch fehlt' }, excerpt: { raw: 'Auszug aus WordPress.' }, content: { raw: live } })
  const datei = '---\ntitle: Alt\ntags: [Compliance]\ncategories: [Neuigkeiten]\nwp: 40\n---\nText\n'
  assert.equal((await datenSetzen(api, z, datei, { probe: true })).probe, true)
  assert.equal(w.rufe.filter(r => r.methode === 'POST').length, 0)
  await datenSetzen(api, z, datei, { jetzt: new Date('2026-10-16T10:00:00Z') })
  const neu = w.posts.get(40).content
  assert.ok(neu.startsWith(live), 'der Inhalt aus WordPress bleibt, wie er ist')
  assert.match(neu, /\r\n\r\n<!-- wp:html -->\r\n<script type="application\/ld\+json">/, 'mit den Zeilenenden aus WordPress')
  const daten = JSON.parse(neu.match(/ld\+json">(.*)<\/script>/)[1])['@graph'][0]
  assert.deepEqual([daten['@type'], daten.headline, daten.description, daten.articleSection, daten.url], ['BlogPosting', 'Digitaler Produktpass – journali zeigt euch, was noch fehlt', 'Auszug aus WordPress.', 'Neuigkeiten', 'https://blog.test/2026/10/04/digitaler-produktpass/'])
  assert.deepEqual(Object.keys(w.rufe.at(-1).body), ['content'], 'nur der Inhalt geht hinaus')
  // ein zweites Mal: der Block wird ersetzt, nicht ein zweiter angehängt
  w.posts.get(40).content = { raw: neu }
  const r = await datenSetzen(api, z, datei)
  assert.equal(r.vorher, true)
  assert.equal((w.posts.get(40).content.match(/ld\+json/g) ?? []).length, 1)
})

test('Meta-Beschreibung und Keyphrase (18.10.2026): aus dem Kopf; gesetzt wird nur, was fehlt — was in WordPress anders steht, bleibt', async () => {
  assert.equal(beschreibung({ description: 'Kurz.', excerpt: 'Auszug.' }), 'Kurz.')
  assert.equal(beschreibung({ excerpt: 'Auszug.' }), 'Auszug.')
  assert.equal(beschreibung({ excerpt: 'x'.repeat(MAX_BESCHREIBUNG + 1) }), null, 'ein langer Auszug ist keine Beschreibung')
  assert.throws(() => beschreibung({ description: 'x'.repeat(MAX_BESCHREIBUNG + 1) }), /at most 155/)
  assert.deepEqual(seoFelder({ excerpt: 'Auszug.', keyphrase: 'Auszug' }), { [META_BESCHREIBUNG]: 'Auszug.', [META_KEYPHRASE]: 'Auszug' })
  const w = wordpress(); const api = wp({ url: 'https://blog.test', user: 'u', password: 'p' }, w.f)
  w.posts.set(40, { id: 40, status: 'publish', content: { raw: 'Inhalt' }, meta: { [META_BESCHREIBUNG]: '', [META_KEYPHRASE]: '' } })
  w.seiten.set(7, { id: 7, status: 'publish', content: { raw: 'Seite' }, meta: { [META_BESCHREIBUNG]: 'in WordPress geschrieben', [META_KEYPHRASE]: '' } })
  const felder = { [META_BESCHREIBUNG]: 'Neu.', [META_KEYPHRASE]: 'Neu' }
  assert.equal((await metaSetzen(api, 'posts', 40, felder, { probe: true })).probe, true)
  assert.equal(w.rufe.filter(r => r.methode === 'POST').length, 0, 'die Probe schreibt nichts')
  const r = await metaSetzen(api, 'posts', 40, felder)
  assert.deepEqual([r.gesetzt, r.neu], [true, ['description', 'keyphrase']])
  assert.deepEqual(w.rufe.at(-1).body, { meta: felder }, 'nur die Felder des SEO-Plugins gehen hinaus')
  assert.equal(w.posts.get(40).content.raw, 'Inhalt')
  const nochmal = await metaSetzen(api, 'posts', 40, felder)
  assert.deepEqual([nochmal.gesetzt, nochmal.gleich], [false, ['description', 'keyphrase']], 'gleich: nichts zu tun')
  // eine Beschreibung aus WordPress bleibt, die fehlende Keyphrase kommt dazu — mit ersetzen auch die Beschreibung
  const seite = await metaSetzen(api, 'pages', 7, { [META_BESCHREIBUNG]: 'Aus der Datei.', [META_KEYPHRASE]: 'Datei' })
  assert.deepEqual([seite.neu, seite.behalten], [['keyphrase'], ['description']])
  assert.deepEqual(w.rufe.at(-1).body, { meta: { [META_KEYPHRASE]: 'Datei' } })
  assert.equal(w.seiten.get(7).meta[META_BESCHREIBUNG], 'in WordPress geschrieben')
  await metaSetzen(api, 'pages', 7, { [META_BESCHREIBUNG]: 'Aus der Datei.' }, { ersetzen: true })
  assert.equal(w.seiten.get(7).meta[META_BESCHREIBUNG], 'Aus der Datei.')
  await assert.rejects(metaSetzen(api, 'posts', 40, { [META_BESCHREIBUNG]: 'x'.repeat(156) }), /at most 155/)
  await assert.rejects(metaSetzen(api, 'posts', 40, {}), /nothing to set/)
  // ein Feld, das die REST-API dort nicht führt (die Keyphrase bei Seiten): gemeldet, nicht geschrieben
  w.seiten.set(8, { id: 8, status: 'publish', meta: { [META_BESCHREIBUNG]: '' } })
  const ohne = await metaSetzen(api, 'pages', 8, { [META_BESCHREIBUNG]: 'B.', [META_KEYPHRASE]: 'B' })
  assert.deepEqual([ohne.neu, ohne.fehlt], [['description'], ['keyphrase']])
  assert.deepEqual(w.rufe.at(-1).body, { meta: { [META_BESCHREIBUNG]: 'B.' } })
  // ein neuer Entwurf bringt beides mit
  const e = await entwurf(api, { url: 'https://blog.test', user: 'u', password: 'p' }, '---\ntitle: T\nexcerpt: Ein Auszug.\nkeyphrase: Auszug\n---\nText.\n')
  assert.deepEqual(w.posts.get(e.id).meta, { [META_BESCHREIBUNG]: 'Ein Auszug.', [META_KEYPHRASE]: 'Auszug' })
})

test('Meta-Beschreibung und Keyphrase: jeder Beitrag in blog/ und jede Seite hat beides — Beschreibung höchstens 155 Zeichen, Keyphrase wörtlich in Titel und Beschreibung, keine doppelt', () => {
  const woerter = k => k.toLowerCase().split(/[\s:,–]+/).filter(Boolean)
  const steht = (k, t) => woerter(k).every(x => String(t).toLowerCase().includes(x))
  const gesehen = new Map()
  const pruefe = (wer, kp, titel, d) => {
    assert.ok(d && d.length <= MAX_BESCHREIBUNG, `${wer}: Beschreibung fehlt oder ist länger als ${MAX_BESCHREIBUNG} Zeichen`)
    assert.ok(kp, `${wer}: keyphrase fehlt`)
    if (titel) assert.ok(steht(kp, titel), `${wer}: „${kp}“ steht nicht im Titel`)
    assert.ok(steht(kp, d), `${wer}: „${kp}“ steht nicht in der Beschreibung`)
    assert.ok(!gesehen.has(kp.toLowerCase()), `${wer}: „${kp}“ hat schon ${gesehen.get(kp.toLowerCase())}`)
    gesehen.set(kp.toLowerCase(), wer)
  }
  const blog = new URL('../../blog/', import.meta.url)
  for (const f of fs.readdirSync(blog).filter(f => /^\d{4}-.*\.md$/.test(f))) {
    const { kopf } = kopfLesen(fs.readFileSync(new URL(f, blog), 'utf8'))
    pruefe(f, kopf.keyphrase, kopf.title, beschreibung(kopf))
  }
  for (const [id, s] of Object.entries(JSON.parse(fs.readFileSync(new URL('../../site/seiten-beschreibungen.json', import.meta.url), 'utf8'))))
    pruefe(`Seite ${id}`, s.keyphrase, null, s.description)
})
