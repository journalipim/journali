// Blog auf der WordPress-Seite (04.10.2026): tools/blog.mjs macht aus blog/*.md Blöcke des Editors und legt sie als Entwurf an — geprüft gegen einen
// nachgebauten WordPress-Server, nicht gegen die Seite.
import test from 'node:test'
import assert from 'node:assert/strict'
import { kopfLesen, kopfSetzen, inline, bloecke, seitenBlock, cssUnter, abschnitt, htmlBloecke, wp, entwurf, zugang, seite, hash, schlagwoerter } from '../../tools/blog.mjs'

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
  const posts = new Map(), tags = [], rufe = []
  let n = 100
  const f = async (url, o) => {
    const pfad = url.replace(/^https:\/\/blog\.test\/wp-json\/wp\/v2\//, '')
    const body = o.body ? JSON.parse(o.body) : null
    rufe.push({ methode: o.method, pfad, auth: o.headers.Authorization, body })
    const ok = j => ({ ok: true, status: 200, text: async () => JSON.stringify(j) })
    let m
    // wie WordPress: Namen maskiert gespeichert, gesucht wird im maskierten Namen, ein doppelter Name wird abgewiesen
    if (o.method === 'GET' && pfad.startsWith('tags?')) { const q = decodeURIComponent(pfad.match(/search=([^&]*)/)?.[1] ?? '').toLowerCase(); return ok(tags.filter(t => t.name.toLowerCase().includes(q))) }
    if (o.method === 'POST' && pfad === 'tags') {
      const name = body.name.replace(/&/g, '&amp;')
      if (tags.some(t => t.name === name)) return { ok: false, status: 400, text: async () => JSON.stringify({ message: 'term_exists' }) }
      const t = { id: ++n, name }; tags.push(t); return ok(t)
    }
    if (o.method === 'POST' && pfad === 'posts') { const p = { id: ++n, status: body.status, link: `https://blog.test/?p=${n}`, ...body }; posts.set(p.id, p); return ok(p) }
    if ((m = pfad.match(/^posts\/(\d+)/))) {
      const p = posts.get(+m[1])
      if (o.method === 'GET') return ok(p)
      Object.assign(p, body); return ok(p)
    }
    return { ok: false, status: 404, text: async () => JSON.stringify({ message: 'nicht nachgebaut: ' + pfad }) }
  }
  return { f, posts, tags, rufe }
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
