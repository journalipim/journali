// Das Chat-Fenster des Produktberaters (docs/pflegestruktur.md 42) — eingebunden mit einem Tag auf der Website:
//   <script src="https://advisor.example.com/widget.js" async></script>
// Wahlweise: data-locale="en" (sonst die des Browsers), data-target="#advisor" (in dieses Element statt schwebend), data-color="#0a6" (Akzent).
// Kein Paket, kein Framework; alles im Shadow DOM, damit die Seite und das Fenster sich nicht gegenseitig gestalten. Werte aus den Produktdaten
// kommen nur als Text in die Seite (textContent), nie als HTML. Gespeichert wird nichts — kein Cookie, kein Speicher im Browser.
// Ein Gespräch (08.10.2026): jede Eingabe ergänzt die bisherigen Angaben (Wörter und Filter, als Chips über den Treffern, einzeln zu entfernen);
// die Anfrage trägt sie mit, der Server merkt sich nichts. Das Merkmal, das die Treffer am besten teilt, steht als Rückfrage da.
// Wechselt das Thema (zusammen nichts, die neue Eingabe allein schon), fragt das Fenster, ob es stattdessen danach sucht.
// Eine Variante lässt sich ganz öffnen; Produkte und Varianten kommen auf einen Merkzettel (☆ im Kopf) — beides nur im Arbeitsspeicher der Seite.
// Produkt, Variante, Merkzettel und Vergleich öffnen in einer Ansicht neben dem Gespräch. Schwebend ist sie ein eigenes Fenster links vom
// Gespräch — das Gespräch bleibt, wo es ist; reicht die Breite nicht, liegt sie über dem Gespräch. Eingebettet steht sie im selben Rahmen
// rechts. × schliesst sie.
(function () {
  'use strict'

  const TEXTE = {
    de: {
      oeffnen: 'Produktberatung', schliessen: 'Schliessen', frage: 'Wonach suchen Sie?', senden: 'Fragen', treffer: n => n === 1 ? '1 Produkt passt.' : `${n} Produkte passen.`,
      keine: 'Kein Produkt passt dazu.', eingrenzen: 'Eingrenzen:', bis: 'bis', ab: 'ab', details: 'Details', vergleichen: 'Vergleichen', vergleich: n => `${n} vergleichen`,
      zurueck: 'Zurück', fehler: 'Der Berater antwortet gerade nicht.', zuviel: 'Zu viele Fragen in kurzer Zeit.', varianten: n => `${n} Ausführungen`, ki: 'Text von einer KI erstellt',
      filterWeg: 'Filter entfernen', merkmal: 'Merkmal', gleich: 'gleich',
      aehnlich: n => n === 1 ? '1 ähnliches Produkt.' : `${n} ähnliche Produkte.`, unbekannt: w => `„${w.join('“, „')}“ steht in keinem Produkt.`,
      neu: 'Neue Suche', angabeWeg: 'Angabe entfernen', lockern: 'Ohne diese Angabe:', ohne: (l, n) => `ohne ${l} (${n})`, rueckfrage: l => `${l}?`,
      trefferZu: (n, w) => n === 1 ? `1 Produkt passt zu „${w}“.` : `${n} Produkte passen zu „${w}“.`, weitere: n => `${n} weitere zeigen`,
      oeffnenVariante: 'Öffnen', merken: '☆ Merken', gemerkt: '★ Gemerkt', merkzettel: n => `☆ ${n}`, merkzettelTitel: 'Merkzettel', merkzettelLeer: 'Der Merkzettel ist leer.',
      ausMerkzettel: 'Vom Merkzettel nehmen', zumProdukt: 'Zum Produkt', variante: 'Variante',
      produkt: 'Produkt', vergleichTitel: 'Vergleich', werte: 'Werte', gesucht: 'Gesucht:', ansichtZu: 'Ansicht schliessen',
      statt: w => `Stattdessen nach „${w}“ suchen?`, stattJa: n => n === 1 ? 'Ja, 1 Produkt' : `Ja, ${n} Produkte`,
    },
    en: {
      oeffnen: 'Product advice', schliessen: 'Close', frage: 'What are you looking for?', senden: 'Ask', treffer: n => n === 1 ? '1 product matches.' : `${n} products match.`,
      keine: 'No product matches.', eingrenzen: 'Narrow down:', bis: 'up to', ab: 'from', details: 'Details', vergleichen: 'Compare', vergleich: n => `Compare ${n}`,
      zurueck: 'Back', fehler: 'The advisor is not answering right now.', zuviel: 'Too many questions in a short time.', varianten: n => `${n} versions`, ki: 'Text written by an AI',
      filterWeg: 'Remove filter', merkmal: 'Attribute', gleich: 'same',
      aehnlich: n => n === 1 ? '1 similar product.' : `${n} similar products.`, unbekannt: w => `"${w.join('", "')}" does not appear in any product.`,
      neu: 'New search', angabeWeg: 'Remove', lockern: 'Without:', ohne: (l, n) => `without ${l} (${n})`, rueckfrage: l => `${l}?`,
      trefferZu: (n, w) => n === 1 ? `1 product matches "${w}".` : `${n} products match "${w}".`, weitere: n => `Show ${n} more`,
      oeffnenVariante: 'Open', merken: '☆ Save', gemerkt: '★ Saved', merkzettel: n => `☆ ${n}`, merkzettelTitel: 'Saved items', merkzettelLeer: 'Nothing saved yet.',
      ausMerkzettel: 'Remove', zumProdukt: 'To the product', variante: 'Variant',
      produkt: 'Product', vergleichTitel: 'Comparison', werte: 'Details', gesucht: 'Searching for:', ansichtZu: 'Close view',
      statt: w => `Search for "${w}" instead?`, stattJa: n => n === 1 ? 'Yes, 1 product' : `Yes, ${n} products`,
    },
  }

  const STIL = `
:host { all: initial; --akzent: #0b6e4f; --text: #1d1d1f; --leise: #6b6b70; --linie: #d9d9de; --flaeche: #ffffff; --blase: #f2f3f5; font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--text); }
@media (prefers-color-scheme: dark) { :host { --text: #ececf0; --leise: #a0a0a8; --linie: #3a3a40; --flaeche: #1c1c1f; --blase: #2a2a2e; } }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
button { font: inherit; cursor: pointer; }
.knopf { position: fixed; right: 16px; bottom: 16px; z-index: 2147483000; border: 0; border-radius: 22px; padding: 10px 16px; background: var(--akzent); color: #fff; box-shadow: 0 4px 16px rgba(0,0,0,.2); }
.fenster { display: flex; flex-direction: column; background: var(--flaeche); color: var(--text); border: 1px solid var(--linie); border-radius: 12px; overflow: hidden; }
.schwebend { position: fixed; right: 16px; bottom: 16px; z-index: 2147483000; width: min(400px, calc(100vw - 32px)); height: min(620px, calc(100vh - 32px)); box-shadow: 0 8px 32px rgba(0,0,0,.25); }
.eingebettet { width: 100%; height: 100%; min-height: 420px; }
.kopf { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: var(--akzent); color: #fff; }
.kopf .titel { flex: 1; font-weight: 600; }
.kopf button { background: transparent; border: 0; color: #fff; font-size: 18px; line-height: 1; }
.verlauf { position: relative; flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 14px; }
.blase { max-width: 90%; padding: 8px 10px; border-radius: 10px; background: var(--blase); white-space: pre-wrap; }
.blase.ich { align-self: flex-end; background: var(--akzent); color: #fff; }
.blase .hinweis { display: block; margin-top: 4px; font-size: 11px; color: var(--leise); }
.karten { display: flex; flex-direction: column; gap: 8px; }
/* was zu einer Antwort gehört, steht an einer Linie; Produkt, Variante, Merkzettel und Vergleich sind Tafeln mit Kopfzeile (08.10.2026) */
.antwort { border-left: 3px solid var(--akzent); padding-left: 10px; }
.koerper { flex: 1; display: flex; min-height: 0; }
.gespraech { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.ansicht { flex: 1.25; min-width: 0; overflow-y: auto; border-left: 1px solid var(--linie); padding: 12px; display: flex; flex-direction: column; gap: 10px; }
/* schwebend: die Ansicht ist ein eigenes Fenster links vom Gespräch, gleich hoch; das Gespräch bewegt sich nicht (08.10.2026) */
.ansicht.daneben { position: fixed; bottom: 16px; z-index: 2147483001; right: calc(16px + min(400px, calc(100vw - 32px)) + 12px);
  width: min(480px, calc(100vw - min(400px, calc(100vw - 32px)) - 44px)); height: min(620px, calc(100vh - 32px));
  background: var(--flaeche); color: var(--text); border: 1px solid var(--linie); border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,.25); }
@media (max-width: 760px) { .ansicht.daneben { right: 16px; width: min(400px, calc(100vw - 32px)); } }
.tafelkopf .zu { background: transparent; border: 0; color: var(--leise); font-size: 18px; line-height: 1; padding: 0 2px; }
.facette { border-style: dashed; }
.facette.offen { border-style: solid; border-color: var(--akzent); }
.tafel { gap: 0; border: 1px solid var(--linie); border-radius: 10px; overflow: hidden; }
.tafelkopf { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: var(--blase); border-bottom: 1px solid var(--linie); }
.tafelkopf .art { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--leise); flex: none; }
.tafelkopf .name { flex: 1; min-width: 0; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tafelinhalt { padding: 8px 10px; display: flex; flex-direction: column; gap: 8px; }
.zwischen { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--leise); margin-top: 4px; }
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
.chip.wort { border-style: dashed; }
.kopf .merk { font-size: 13px; border: 1px solid rgba(255,255,255,.6); border-radius: 12px; padding: 1px 8px; }
.merken { border: 1px solid var(--linie); background: transparent; color: var(--text); border-radius: 6px; padding: 2px 8px; font-size: 12px; }
.merken.an { background: var(--akzent); border-color: var(--akzent); color: #fff; }
td.aktion { white-space: nowrap; text-align: right; }
td.aktion button { border: 1px solid var(--linie); background: transparent; color: var(--text); border-radius: 6px; padding: 1px 6px; font-size: 12px; }
.mehr { align-self: flex-start; border: 1px solid var(--linie); background: transparent; color: var(--text); border-radius: 8px; padding: 4px 10px; font-size: 12px; }
.chip.neu { margin-left: auto; }
.rueckfrage { display: flex; flex-direction: column; gap: 6px; }
.statt .ja { background: var(--akzent); border-color: var(--akzent); color: #fff; }
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

  /// So viele Karten zeigt eine Antwort zuerst — darüber steht die Rückfrage, die eingrenzt
  const ZUERST = 3

  function start(o) {
    const basis = o.base.replace(/\/+$/, '')
    const holen = o.fetch || window.fetch.bind(window)
    const sprache = (String(o.locale || navigator.language || 'de').slice(0, 2).toLowerCase() === 'de') ? 'de' : 'en'
    const T = TEXTE[sprache]
    // das Gespräch: gesammelte Wörter und Filter, die früheren Eingaben — nur im Arbeitsspeicher der Seite
    // merkzettel: id → { id, name, art: 'produkt' | 'variante' } — in der Reihenfolge des Merkens
    const zustand = { woerter: [], filter: [], verlauf: [], auswahl: new Set(), merkzettel: new Map(), info: null, laeuft: false }

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
    const zu = el('button', 'zu', '×'); zu.type = 'button'; zu.setAttribute('aria-label', T.schliessen)
    const merkKnopf = el('button', 'merk', T.merkzettel(0)); merkKnopf.type = 'button'; merkKnopf.title = T.merkzettelTitel; merkKnopf.hidden = true
    kopf.append(titel, merkKnopf)
    if (!ziel) kopf.append(zu)
    const verlauf = el('div', 'verlauf'); verlauf.setAttribute('role', 'log'); verlauf.setAttribute('aria-live', 'polite')
    const leiste = el('div', 'leiste')
    const vergleichKnopf = el('button', 'vergleich'); vergleichKnopf.type = 'button'; leiste.append(vergleichKnopf); leiste.hidden = true
    const formular = el('form')
    const eingabe = el('input'); eingabe.type = 'text'; eingabe.maxLength = 300; eingabe.placeholder = T.frage; eingabe.setAttribute('aria-label', T.frage)
    const senden = el('button', '', T.senden); senden.type = 'submit'
    formular.append(eingabe, senden)
    const koerper = el('div', 'koerper'), gespraech = el('div', 'gespraech'), ansicht = el('div', 'ansicht')
    ansicht.hidden = true
    gespraech.append(verlauf, leiste, formular)
    koerper.append(gespraech)
    fenster.append(kopf, koerper)
    if (ziel) koerper.append(ansicht); else ansicht.classList.add('daneben')

    if (ziel) schatten.append(fenster)
    else { schatten.append(knopf); fenster.hidden = true; schatten.append(ansicht, fenster) }
    knopf.addEventListener('click', () => { fenster.hidden = false; knopf.hidden = true; eingabe.focus() })
    zu.addEventListener('click', () => { fenster.hidden = true; knopf.hidden = false; schliesseAnsicht() })

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

    /// Der Knopf „Merken“ für ein Produkt oder eine Variante — zeigt, ob es schon auf dem Merkzettel steht
    function merkenKnopf(id, name, art) {
      const k = el('button', 'merken'); k.type = 'button'
      const zeige = () => { const an = zustand.merkzettel.has(id); k.textContent = an ? T.gemerkt : T.merken; k.classList.toggle('an', an) }
      k.addEventListener('click', () => {
        zustand.merkzettel.has(id) ? zustand.merkzettel.delete(id) : zustand.merkzettel.set(id, { id, name, art })
        zeige(); aktualisiereMerkzettel()
      })
      zeige()
      return k
    }

    function aktualisiereMerkzettel() {
      merkKnopf.hidden = zustand.merkzettel.size === 0
      merkKnopf.textContent = T.merkzettel(zustand.merkzettel.size)
    }

    /// Der Merkzettel: jeder Eintrag zum Öffnen und zum Wegnehmen; angehakt lassen sie sich vergleichen
    merkKnopf.addEventListener('click', () => {
      const { t: b, inhalt } = tafel('merkzettel', T.merkzettelTitel, String(zustand.merkzettel.size))
      if (!zustand.merkzettel.size) inhalt.append(el('div', 'leise', T.merkzettelLeer))
      const t = el('table'), tb = el('tbody')
      for (const m of zustand.merkzettel.values()) {
        const tr = el('tr'), name = el('td', '', m.name), aktion = el('td', 'aktion')
        const auf = el('button', '', T.oeffnenVariante); auf.type = 'button'
        auf.addEventListener('click', () => m.art === 'variante' ? zeigeVariante(m.id) : zeigeProdukt(m.id))
        const weg = el('button', '', '×'); weg.type = 'button'; weg.title = T.ausMerkzettel
        weg.addEventListener('click', () => { zustand.merkzettel.delete(m.id); tr.remove(); aktualisiereMerkzettel() })
        const wahl = el('input'); wahl.type = 'checkbox'; wahl.title = T.vergleichen; wahl.checked = zustand.auswahl.has(m.id)
        wahl.addEventListener('change', () => {
          if (wahl.checked && zustand.auswahl.size >= 4) { wahl.checked = false; return }
          wahl.checked ? zustand.auswahl.add(m.id) : zustand.auswahl.delete(m.id)
          aktualisiereLeiste()
        })
        aktion.append(wahl, auf, weg)
        tr.append(name, aktion); tb.append(tr)
      }
      t.append(tb); inhalt.append(t)
      zeige(b)
    })

    /// Eine Tafel: Rahmen, Kopfzeile mit Art und Name, darunter der Inhalt — Produkt, Variante, Merkzettel, Vergleich
    function tafel(klasse, art, name) {
      const t = el('div', 'karten tafel ' + klasse)
      const kopf = el('div', 'tafelkopf')
      kopf.append(el('span', 'art', art))
      if (name !== undefined) kopf.append(el('span', 'name', name))
      const inhalt = el('div', 'tafelinhalt')
      t.append(kopf, inhalt)
      return { t, kopf, inhalt }
    }
    /// Eine Tafel in der Ansicht neben dem Gespräch; eine neue ersetzt die vorige
    function zeige(block) {
      const zu = el('button', 'zu', '×'); zu.type = 'button'; zu.title = T.ansichtZu; zu.setAttribute('aria-label', T.ansichtZu)
      zu.addEventListener('click', schliesseAnsicht)
      block.querySelector('.tafelkopf')?.append(zu)
      ansicht.replaceChildren(block)
      ansicht.hidden = false
      ansicht.scrollTop = 0
    }
    function schliesseAnsicht() {
      ansicht.hidden = true; ansicht.replaceChildren()
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
      aktion.append(details, merkenKnopf(h.id, h.name, 'produkt'), wahl)
      inhalt.append(aktion)
      k.append(bild(h.image), inhalt)
      return k
    }

    const filterText = f => `${f.label}: ${f.op === 'le' ? T.bis + ' ' : f.op === 'ge' ? T.ab + ' ' : ''}${f.valueLabel || f.value}`

    /// Die gesammelten Angaben als Chips: Wörter und Filter, jede einzeln zu entfernen — dazu „Neue Suche“
    function angabenChips() {
      if (!zustand.filter.length && !zustand.woerter.length) return null
      const c = el('div', 'chips angaben')
      c.append(el('span', 'leise', T.gesucht))
      for (const w of zustand.woerter) {
        const chip = el('button', 'chip an wort', `${w} ×`); chip.type = 'button'; chip.title = T.angabeWeg
        chip.addEventListener('click', () => { zustand.woerter = zustand.woerter.filter(x => x !== w); frage('', false) })
        c.append(chip)
      }
      for (const f of zustand.filter) {
        const chip = el('button', 'chip an', `${filterText(f)} ×`)
        chip.type = 'button'; chip.title = T.filterWeg
        chip.addEventListener('click', () => { zustand.filter = zustand.filter.filter(x => x !== f); frage('', false) })
        c.append(chip)
      }
      const neu = el('button', 'chip neu', T.neu); neu.type = 'button'
      neu.addEventListener('click', () => { zustand.woerter = []; zustand.filter = []; zustand.verlauf = []; blase(T.neu); eingabe.focus() })
      c.append(neu)
      return c
    }

    /// Nichts gefunden: welche Angabe zu eng ist — ein Klick nimmt sie weg
    function lockernChips(lockern) {
      if (!lockern || !lockern.length) return null
      const c = el('div', 'chips lockern')
      c.append(el('span', 'leise', T.lockern))
      for (const l of lockern) {
        const text = l.kind === 'word' ? l.word : filterText(l)
        const chip = el('button', 'chip', T.ohne(text, l.n)); chip.type = 'button'
        chip.addEventListener('click', () => {
          if (l.kind === 'word') zustand.woerter = zustand.woerter.filter(x => x !== l.word)
          else zustand.filter = zustand.filter.filter(x => !(x.attribute === l.attribute && x.op === l.op && x.value === l.value))
          frage('', false)
        })
        c.append(chip)
      }
      return c
    }

    /// Die Optionen einer Facette: bei Zahlen bis und ab der Mitte, sonst ihre Werte mit Anzahl
    const optionen = (f, mitName) => f.type === 'range'
      ? [{ op: 'le', value: String(f.split), text: `${mitName ? f.label + ' ' : ''}${T.bis} ${f.split}${f.unit ? ' ' + f.unit : ''}` }, { op: 'ge', value: String(f.split), text: `${mitName ? f.label + ' ' : ''}${T.ab} ${f.split}${f.unit ? ' ' + f.unit : ''}` }]
      : (f.values || []).map(v => ({ op: 'eq', value: v.value, valueLabel: v.label, text: `${mitName ? f.label + ': ' : ''}${v.label} (${v.n})` }))

    function facettenChip(f, opt) {
      const chip = el('button', 'chip', opt.text); chip.type = 'button'
      chip.addEventListener('click', () => {
        zustand.filter.push({ attribute: f.key, op: opt.op, value: opt.value, label: f.label, valueLabel: opt.valueLabel || `${opt.value}${f.unit ? ' ' + f.unit : ''}` })
        frage('', false)
      })
      return chip
    }

    /// Das Thema hat gewechselt: zusammen mit dem Bisherigen passt nichts, die neue Eingabe allein schon — ja sucht nur noch danach
    function stattChips(s) {
      if (!s || !s.n) return null
      const r = el('div', 'rueckfrage statt')
      r.append(el('div', 'blase', T.statt([...(s.words || []), ...(s.filter || []).map(filterText)].join(', '))))
      const ja = el('button', 'chip ja', T.stattJa(s.n)); ja.type = 'button'
      ja.addEventListener('click', () => {
        zustand.woerter = [...(s.words || [])]
        zustand.filter = (s.filter || []).map(f => ({ attribute: f.attribute, op: f.op, value: f.value, label: f.label, valueLabel: f.valueLabel }))
        zustand.verlauf = zustand.verlauf.slice(-1)   // nur die Eingabe, die das neue Thema gebracht hat
        frage('', false)
      })
      const c = el('div', 'chips'); c.append(ja); r.append(c)
      return r
    }

    /// Die Rückfrage: das Merkmal, das die Treffer am besten teilt, als Frage mit Knöpfen
    function rueckfrage(f) {
      const r = el('div', 'rueckfrage')
      r.append(el('div', 'blase', T.rueckfrage(f.label)))
      const c = el('div', 'chips')
      for (const opt of optionen(f, false)) c.append(facettenChip(f, opt))
      r.append(c)
      return r
    }

    /// Die weiteren Merkmale zum Eingrenzen: je Merkmal ein Knopf („Farbe ▾“), seine Werte erst auf Klick — sonst stünden alle Werte aller Merkmale da
    function facettenChips(facetten) {
      if (!facetten || !facetten.length) return null
      const block = el('div', 'eingrenzen')
      const c = el('div', 'chips')
      c.append(el('span', 'leise', T.eingrenzen))
      const werte = el('div', 'chips werte'); werte.hidden = true
      for (const f of facetten) {
        const k = el('button', 'chip facette', `${f.label} ▾`); k.type = 'button'
        k.addEventListener('click', () => {
          const offen = k.classList.contains('offen')
          for (const x of c.querySelectorAll('.facette')) x.classList.remove('offen')
          werte.replaceChildren(); werte.hidden = offen
          if (offen) return
          k.classList.add('offen')
          for (const opt of optionen(f, false)) werte.append(facettenChip(f, opt))
        })
        c.append(k)
      }
      block.append(c, werte)
      return block
    }

    async function frage(q, alsBlase) {
      if (zustand.laeuft) return
      zustand.laeuft = true; senden.disabled = true
      if (alsBlase && q) blase(q, true)
      try {
        const r = await rufe('/api/ask', {
          q, woerter: zustand.woerter, verlauf: zustand.verlauf.slice(-6), locale: sprache,
          filter: zustand.filter.map(f => ({ attribute: f.attribute, op: f.op, value: f.value })),
        })
        // was jetzt gilt, sagt der Server: die gesammelten Wörter und alle Filter, auch die aus dem Text erkannten — mit Bezeichnungen
        if (Array.isArray(r.words)) zustand.woerter = r.words
        if (Array.isArray(r.filter)) zustand.filter = r.filter.map(f => ({ attribute: f.attribute, op: f.op, value: f.value, label: f.label, valueLabel: f.valueLabel }))
        if (q) zustand.verlauf.push(q)
        const antwort = el('div', 'karten antwort')
        if (r.unknown && r.unknown.length) antwort.append(el('div', 'blase', T.unbekannt(r.unknown)))
        // die Antwort nennt die Suche; gleich darunter die Rückfrage — erst dann die Karten, die ersten drei, der Rest auf Wunsch
        const wort = zustand.woerter.join(' ')
        const text = r.answer ? r.answer : (r.total ? (r.similar ? T.aehnlich(r.total) : wort ? T.trefferZu(r.total, wort) : T.treffer(r.total)) : T.keine)
        antwort.append(r.answer ? (() => { const b = el('div', 'blase', text); b.append(el('span', 'hinweis', T.ki)); return b })() : el('div', 'blase', text))
        const st = r.total ? null : stattChips(r.instead); if (st) antwort.append(st)
        const ac = angabenChips(); if (ac) antwort.append(ac)
        const lo = r.total ? null : lockernChips(r.relax); if (lo) antwort.append(lo)
        const [erste, ...weitere] = r.facets || []
        if (erste) antwort.append(rueckfrage(erste))
        const hits = r.hits || []
        for (const h of hits.slice(0, ZUERST)) antwort.append(karte(h))
        if (hits.length > ZUERST) {
          const rest = hits.slice(ZUERST)
          const mehr = el('button', 'mehr', T.weitere(rest.length)); mehr.type = 'button'
          mehr.addEventListener('click', () => { const k = rest.map(karte); mehr.replaceWith(...k) })
          antwort.append(mehr)
        }
        const fa = facettenChips(weitere); if (fa) antwort.append(fa)
        verlauf.append(antwort)
        verlauf.scrollTop = Math.max(0, antwort.offsetTop - 8)   // an den Anfang der Antwort, nicht ans Ende der Karten
      } catch (e) { blase(e.message) }
      finally { zustand.laeuft = false; senden.disabled = false }
    }

    async function zeigeProdukt(id) {
      try {
        const p = await rufe(`/api/product/${encodeURIComponent(id)}?locale=${sprache}`)
        const { t: b, kopf, inhalt } = tafel('produkt', T.produkt, p.name)
        kopf.append(merkenKnopf(p.id, p.name, 'produkt'))
        if (p.images && p.images.length) { const g = el('div', 'galerie'); for (const i of p.images) g.append(bild(i, true)); inhalt.append(g) }
        const t = el('table'), tb = el('tbody')
        for (const v of p.values || []) { const tr = el('tr'); tr.append(el('th', '', v.label), el('td', '', v.value)); tb.append(tr) }
        t.append(tb); inhalt.append(el('div', 'zwischen', T.werte), t)
        if (p.variants && p.variants.length > 1) {
          const vt = el('table'), vb = el('tbody')
          for (const v of p.variants) {
            const tr = el('tr'), aktion = el('td', 'aktion')
            const auf = el('button', '', T.oeffnenVariante); auf.type = 'button'
            auf.addEventListener('click', () => zeigeVariante(v.id))
            aktion.append(auf)
            tr.append(el('th', '', v.name), el('td', '', (v.values || []).map(x => `${x.label}: ${x.value}`).join(', ')), aktion); vb.append(tr)
          }
          vt.append(vb); inhalt.append(el('div', 'zwischen', T.varianten(p.variants.length)), vt)
        }
        zeige(b)
      } catch (e) { blase(e.message) }
    }

    /// Eine Variante ganz: Name mit den Achsen, Kennungen, alle Werte, Bilder — zum Merken und zurück zum Produkt
    async function zeigeVariante(id) {
      try {
        const v = await rufe(`/api/variant/${encodeURIComponent(id)}?locale=${sprache}`)
        const { t: b, inhalt } = tafel('variante', T.variante, v.name)
        const knoepfe = el('div', 'chips')
        const zurueck = el('button', 'chip', T.zumProdukt); zurueck.type = 'button'
        zurueck.addEventListener('click', () => zeigeProdukt(v.product.id))
        knoepfe.append(merkenKnopf(v.id, v.name, 'variante'), zurueck)
        inhalt.append(knoepfe)
        if (v.images && v.images.length) { const g = el('div', 'galerie'); for (const i of v.images) g.append(bild(i, true)); inhalt.append(g) }
        const t = el('table'), tb = el('tbody')
        for (const k of Object.entries(v.keys || {})) { const tr = el('tr'); tr.append(el('th', '', k[0].toUpperCase()), el('td', '', k[1])); tb.append(tr) }
        for (const x of v.values || []) { const tr = el('tr'); tr.append(el('th', '', x.label), el('td', '', x.value)); tb.append(tr) }
        t.append(tb); inhalt.append(el('div', 'zwischen', T.werte), t)
        zeige(b)
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
        const { t: rahmen, inhalt } = tafel('vergleichtafel', T.vergleichTitel, String((v.products || []).length))
        t.append(tb); inhalt.append(t)
        zeige(rahmen)
      } catch (e) { blase(e.message) }
    })

    formular.addEventListener('submit', ev => {
      ev.preventDefault()
      const q = eingabe.value.trim()
      if (!q) return
      eingabe.value = ''
      frage(q, true)   // ergänzt die bisherigen Angaben — „Neue Suche“ fängt von vorn an
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
