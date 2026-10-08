// Das Chat-Fenster des Produktberaters (docs/pflegestruktur.md 42) — eingebunden mit einem Tag auf der Website:
//   <script src="https://advisor.example.com/widget.js" async></script>
// Wahlweise: data-locale="en" (sonst die des Browsers), data-target="#advisor" (in dieses Element statt schwebend), data-color="#0a6" (Akzent).
// Kein Paket, kein Framework; alles im Shadow DOM, damit die Seite und das Fenster sich nicht gegenseitig gestalten. Werte aus den Produktdaten
// kommen nur als Text in die Seite (textContent), nie als HTML. Gespeichert wird nichts — kein Cookie, kein Speicher im Browser.
(function () {
  'use strict'

  const TEXTE = {
    de: {
      oeffnen: 'Produktberatung', schliessen: 'Schliessen', frage: 'Wonach suchen Sie?', senden: 'Fragen', treffer: n => n === 1 ? '1 Produkt passt.' : `${n} Produkte passen.`,
      keine: 'Kein Produkt passt dazu.', eingrenzen: 'Eingrenzen:', bis: 'bis', ab: 'ab', details: 'Details', vergleichen: 'Vergleichen', vergleich: n => `${n} vergleichen`,
      zurueck: 'Zurück', fehler: 'Der Berater antwortet gerade nicht.', zuviel: 'Zu viele Fragen in kurzer Zeit.', varianten: n => `${n} Ausführungen`, ki: 'Text von einer KI erstellt',
      filterWeg: 'Filter entfernen', merkmal: 'Merkmal', gleich: 'gleich',
    },
    en: {
      oeffnen: 'Product advice', schliessen: 'Close', frage: 'What are you looking for?', senden: 'Ask', treffer: n => n === 1 ? '1 product matches.' : `${n} products match.`,
      keine: 'No product matches.', eingrenzen: 'Narrow down:', bis: 'up to', ab: 'from', details: 'Details', vergleichen: 'Compare', vergleich: n => `Compare ${n}`,
      zurueck: 'Back', fehler: 'The advisor is not answering right now.', zuviel: 'Too many questions in a short time.', varianten: n => `${n} versions`, ki: 'Text written by an AI',
      filterWeg: 'Remove filter', merkmal: 'Attribute', gleich: 'same',
    },
  }

  const STIL = `
:host { all: initial; --akzent: #0b6e4f; --text: #1d1d1f; --leise: #6b6b70; --linie: #d9d9de; --flaeche: #ffffff; --blase: #f2f3f5; font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--text); }
@media (prefers-color-scheme: dark) { :host { --text: #ececf0; --leise: #a0a0a8; --linie: #3a3a40; --flaeche: #1c1c1f; --blase: #2a2a2e; } }
* { box-sizing: border-box; }
button { font: inherit; cursor: pointer; }
.knopf { position: fixed; right: 16px; bottom: 16px; z-index: 2147483000; border: 0; border-radius: 22px; padding: 10px 16px; background: var(--akzent); color: #fff; box-shadow: 0 4px 16px rgba(0,0,0,.2); }
.fenster { display: flex; flex-direction: column; background: var(--flaeche); color: var(--text); border: 1px solid var(--linie); border-radius: 12px; overflow: hidden; }
.schwebend { position: fixed; right: 16px; bottom: 16px; z-index: 2147483000; width: min(400px, calc(100vw - 32px)); height: min(620px, calc(100vh - 32px)); box-shadow: 0 8px 32px rgba(0,0,0,.25); }
.eingebettet { width: 100%; height: 100%; min-height: 420px; }
.kopf { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: var(--akzent); color: #fff; }
.kopf .titel { flex: 1; font-weight: 600; }
.kopf button { background: transparent; border: 0; color: #fff; font-size: 18px; line-height: 1; }
.verlauf { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.blase { max-width: 90%; padding: 8px 10px; border-radius: 10px; background: var(--blase); white-space: pre-wrap; }
.blase.ich { align-self: flex-end; background: var(--akzent); color: #fff; }
.blase .hinweis { display: block; margin-top: 4px; font-size: 11px; color: var(--leise); }
.karten { display: flex; flex-direction: column; gap: 8px; }
.karte { display: flex; gap: 10px; padding: 8px; border: 1px solid var(--linie); border-radius: 10px; }
.karte img, .karte .ohne { width: 64px; height: 64px; object-fit: contain; border-radius: 6px; background: var(--blase); flex: none; }
.karte .inhalt { flex: 1; min-width: 0; }
.karte .name { font-weight: 600; }
.karte .wert { font-size: 12px; color: var(--leise); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.karte .aktion { display: flex; gap: 8px; align-items: center; margin-top: 4px; font-size: 12px; }
.karte .aktion button { border: 1px solid var(--linie); background: transparent; color: var(--text); border-radius: 6px; padding: 2px 8px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 12px; }
.chip { border: 1px solid var(--linie); background: transparent; color: var(--text); border-radius: 14px; padding: 3px 10px; }
.chip.an { background: var(--akzent); border-color: var(--akzent); color: #fff; }
.leise { color: var(--leise); font-size: 12px; }
form { display: flex; gap: 6px; padding: 10px; border-top: 1px solid var(--linie); }
input[type=text] { flex: 1; font: inherit; color: var(--text); background: var(--flaeche); border: 1px solid var(--linie); border-radius: 8px; padding: 8px 10px; min-width: 0; }
form button, .leiste button { border: 0; border-radius: 8px; padding: 8px 12px; background: var(--akzent); color: #fff; }
.leiste { padding: 0 10px 10px; display: flex; justify-content: flex-end; }
table { border-collapse: collapse; width: 100%; font-size: 12px; }
th, td { text-align: left; vertical-align: top; padding: 4px 6px; border-bottom: 1px solid var(--linie); }
tr.gleich td { color: var(--leise); }
.galerie { display: flex; gap: 6px; overflow-x: auto; }
.galerie img { height: 120px; border-radius: 6px; background: var(--blase); }
`

  /// Ein Element mit Klasse und Text — nie HTML aus Daten
  function el(tag, klasse, text) {
    const e = document.createElement(tag)
    if (klasse) e.className = klasse
    if (text !== undefined && text !== null) e.textContent = String(text)
    return e
  }

  function start(o) {
    const basis = o.base.replace(/\/+$/, '')
    const holen = o.fetch || window.fetch.bind(window)
    const sprache = (String(o.locale || navigator.language || 'de').slice(0, 2).toLowerCase() === 'de') ? 'de' : 'en'
    const T = TEXTE[sprache]
    const zustand = { q: '', filter: [], auswahl: new Set(), info: null, laeuft: false }

    const wirt = document.createElement('div')
    wirt.setAttribute('data-journali-advisor', '')
    const ziel = o.target ? document.querySelector(o.target) : null
    ;(ziel || document.body).appendChild(wirt)
    const schatten = wirt.attachShadow({ mode: 'open' })
    const stil = el('style'); stil.textContent = STIL + (o.color && /^#[0-9a-f]{3,8}$/i.test(o.color) ? `:host { --akzent: ${o.color}; }` : '')
    schatten.appendChild(stil)

    const knopf = el('button', 'knopf', T.oeffnen)
    knopf.type = 'button'
    const fenster = el('div', 'fenster ' + (ziel ? 'eingebettet' : 'schwebend'))
    fenster.setAttribute('role', 'dialog')
    const kopf = el('div', 'kopf')
    const titel = el('span', 'titel', T.oeffnen)
    const zu = el('button', '', '×'); zu.type = 'button'; zu.setAttribute('aria-label', T.schliessen)
    kopf.append(titel)
    if (!ziel) kopf.append(zu)
    const verlauf = el('div', 'verlauf'); verlauf.setAttribute('role', 'log'); verlauf.setAttribute('aria-live', 'polite')
    const leiste = el('div', 'leiste')
    const vergleichKnopf = el('button', 'vergleich'); vergleichKnopf.type = 'button'; leiste.append(vergleichKnopf); leiste.hidden = true
    const formular = el('form')
    const eingabe = el('input'); eingabe.type = 'text'; eingabe.maxLength = 300; eingabe.placeholder = T.frage; eingabe.setAttribute('aria-label', T.frage)
    const senden = el('button', '', T.senden); senden.type = 'submit'
    formular.append(eingabe, senden)
    fenster.append(kopf, verlauf, leiste, formular)

    if (ziel) schatten.append(fenster)
    else { schatten.append(knopf); fenster.hidden = true; schatten.append(fenster) }
    knopf.addEventListener('click', () => { fenster.hidden = false; knopf.hidden = true; eingabe.focus() })
    zu.addEventListener('click', () => { fenster.hidden = true; knopf.hidden = false })

    async function rufe(pfad, body) {
      const r = await holen(basis + pfad, body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      let j = null; try { j = await r.json() } catch { j = null }
      if (!r.ok) throw Object.assign(new Error(r.status === 429 ? T.zuviel : T.fehler), { status: r.status })
      return j
    }

    function blase(text, ich, hinweis) {
      const b = el('div', 'blase' + (ich ? ' ich' : ''), text)
      if (hinweis) b.append(el('span', 'hinweis', hinweis))
      verlauf.append(b); verlauf.scrollTop = verlauf.scrollHeight
      return b
    }

    function bild(id, gross) {
      if (!id) return el('div', 'ohne')
      const i = el('img'); i.alt = ''; i.loading = 'lazy'; i.src = `${basis}/api/image/${encodeURIComponent(id)}${gross ? '?gross=1' : ''}`
      return i
    }

    function aktualisiereLeiste() {
      leiste.hidden = zustand.auswahl.size < 2
      vergleichKnopf.textContent = T.vergleich(zustand.auswahl.size)
    }

    function karte(h) {
      const k = el('div', 'karte')
      const inhalt = el('div', 'inhalt')
      inhalt.append(el('div', 'name', h.name))
      for (const v of h.values || []) inhalt.append(el('div', 'wert', `${v.label}: ${v.value}`))
      if (h.variants > 1) inhalt.append(el('div', 'wert', T.varianten(h.variants)))
      const aktion = el('div', 'aktion')
      const details = el('button', 'details', T.details); details.type = 'button'
      details.addEventListener('click', () => zeigeProdukt(h.id))
      const wahl = el('label')
      const box = el('input'); box.type = 'checkbox'; box.checked = zustand.auswahl.has(h.id)
      box.addEventListener('change', () => {
        if (box.checked && zustand.auswahl.size >= 4) { box.checked = false; return }
        box.checked ? zustand.auswahl.add(h.id) : zustand.auswahl.delete(h.id)
        aktualisiereLeiste()
      })
      wahl.append(box, document.createTextNode(' ' + T.vergleichen))
      aktion.append(details, wahl)
      inhalt.append(aktion)
      k.append(bild(h.image), inhalt)
      return k
    }

    function filterChips() {
      if (!zustand.filter.length) return null
      const c = el('div', 'chips')
      for (const f of zustand.filter) {
        const chip = el('button', 'chip an', `${f.label}: ${f.op === 'le' ? T.bis + ' ' : f.op === 'ge' ? T.ab + ' ' : ''}${f.valueLabel || f.value} ×`)
        chip.type = 'button'; chip.title = T.filterWeg
        chip.addEventListener('click', () => { zustand.filter = zustand.filter.filter(x => x !== f); frage(zustand.q, false) })
        c.append(chip)
      }
      return c
    }

    function facettenChips(facetten) {
      if (!facetten || !facetten.length) return null
      const c = el('div', 'chips')
      c.append(el('span', 'leise', T.eingrenzen))
      for (const f of facetten) {
        const optionen = f.type === 'range'
          ? [{ op: 'le', value: String(f.split), text: `${f.label} ${T.bis} ${f.split}${f.unit ? ' ' + f.unit : ''}` }, { op: 'ge', value: String(f.split), text: `${f.label} ${T.ab} ${f.split}${f.unit ? ' ' + f.unit : ''}` }]
          : (f.values || []).map(v => ({ op: 'eq', value: v.value, valueLabel: v.label, text: `${f.label}: ${v.label} (${v.n})` }))
        for (const opt of optionen) {
          const chip = el('button', 'chip', opt.text); chip.type = 'button'
          chip.addEventListener('click', () => {
            zustand.filter.push({ attribute: f.key, op: opt.op, value: opt.value, label: f.label, valueLabel: opt.valueLabel || `${opt.value}${f.unit ? ' ' + f.unit : ''}` })
            frage(zustand.q, false)
          })
          c.append(chip)
        }
      }
      return c
    }

    async function frage(q, alsBlase) {
      if (zustand.laeuft) return
      zustand.laeuft = true; senden.disabled = true
      if (alsBlase && q) blase(q, true)
      try {
        const r = await rufe('/api/ask', { q, filter: zustand.filter.map(f => ({ attribute: f.attribute, op: f.op, value: f.value })), locale: sprache })
        zustand.q = q
        // die Bezeichnungen der Filter kommen vom Server zurück
        for (const e of r.filter || []) { const f = zustand.filter.find(x => x.attribute === e.attribute && x.value === e.value); if (f) { f.label = e.label; f.valueLabel = e.valueLabel } }
        const antwort = el('div', 'karten')
        const text = r.answer ? r.answer : (r.total ? T.treffer(r.total) : T.keine)
        antwort.append(r.answer ? (() => { const b = el('div', 'blase', text); b.append(el('span', 'hinweis', T.ki)); return b })() : el('div', 'blase', text))
        const fc = filterChips(); if (fc) antwort.append(fc)
        for (const h of r.hits || []) antwort.append(karte(h))
        const fa = facettenChips(r.facets); if (fa) antwort.append(fa)
        verlauf.append(antwort); verlauf.scrollTop = verlauf.scrollHeight
      } catch (e) { blase(e.message) }
      finally { zustand.laeuft = false; senden.disabled = false }
    }

    async function zeigeProdukt(id) {
      try {
        const p = await rufe(`/api/product/${encodeURIComponent(id)}?locale=${sprache}`)
        const b = el('div', 'karten produkt')
        b.append(el('div', 'name', p.name))
        if (p.images && p.images.length) { const g = el('div', 'galerie'); for (const i of p.images) g.append(bild(i, true)); b.append(g) }
        const t = el('table'), tb = el('tbody')
        for (const v of p.values || []) { const tr = el('tr'); tr.append(el('th', '', v.label), el('td', '', v.value)); tb.append(tr) }
        t.append(tb); b.append(t)
        if (p.variants && p.variants.length > 1) {
          const vt = el('table'), vb = el('tbody')
          for (const v of p.variants) { const tr = el('tr'); tr.append(el('th', '', v.name), el('td', '', (v.values || []).map(x => `${x.label}: ${x.value}`).join(', '))); vb.append(tr) }
          vt.append(vb); b.append(el('div', 'leise', T.varianten(p.variants.length)), vt)
        }
        verlauf.append(b); verlauf.scrollTop = verlauf.scrollHeight
      } catch (e) { blase(e.message) }
    }

    vergleichKnopf.addEventListener('click', async () => {
      try {
        const v = await rufe('/api/compare', { ids: [...zustand.auswahl], locale: sprache })
        const t = el('table', 'vergleich'), kopfzeile = el('tr'), tb = el('tbody')
        kopfzeile.append(el('th', '', T.merkmal))
        for (const p of v.products || []) kopfzeile.append(el('th', '', p.name))
        tb.append(kopfzeile)
        for (const z of v.rows || []) {
          const tr = el('tr', z.same ? 'gleich' : '')
          tr.append(el('th', '', z.label))
          for (const w of z.values) tr.append(el('td', '', w))
          if (z.same) tr.title = T.gleich
          tb.append(tr)
        }
        t.append(tb); verlauf.append(t); verlauf.scrollTop = verlauf.scrollHeight
      } catch (e) { blase(e.message) }
    })

    formular.addEventListener('submit', ev => {
      ev.preventDefault()
      const q = eingabe.value.trim()
      if (!q) return
      eingabe.value = ''
      zustand.filter = []
      frage(q, true)
    })

    // Begrüssung und Bezeichnung des Beraters
    rufe('/api/info').then(i => {
      zustand.info = i
      if (i && i.label) { titel.textContent = i.label; knopf.textContent = i.label }
      const gruss = i && i.greeting && (i.greeting[sprache] || i.greeting[i.locale])
      if (gruss) blase(gruss)
    }).catch(() => {})

    return { wirt, schatten, frage: q => frage(q, true), oeffnen: () => knopf.click() }
  }

  window.journaliAdvisor = { start, TEXTE }
  const skript = document.currentScript
  if (skript && skript.src) {
    const ds = skript.dataset || {}
    const go = () => start({ base: skript.src.replace(/\/widget\.js(\?.*)?$/, ''), locale: ds.locale, target: ds.target, color: ds.color })
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', go) : go()
  }
})()
