// Das Chat-Fenster des Produktberaters (docs/pflegestruktur.md 42) — eingebunden mit einem Tag auf der Website:
//   <script src="https://advisor.example.com/widget.js" async></script>
// Wahlweise: data-locale="en" (sonst die des Browsers), data-target="#advisor" (in dieses Element statt schwebend), data-color="#0a6" (Akzent).
// Kein Paket, kein Framework; alles im Shadow DOM, damit die Seite und das Fenster sich nicht gegenseitig gestalten. Werte aus den Produktdaten
// kommen nur als Text in die Seite (textContent), nie als HTML. Gespeichert wird nichts — kein Cookie, kein Speicher im Browser.
// Ein Gespräch (08.10.2026): jede Eingabe ergänzt die bisherigen Angaben (Wörter und Filter, als Chips über den Treffern, einzeln zu entfernen).
// Seit 09.10.2026 (pflegestruktur 44) zeigt das Fenster nur noch an: es schickt die Eingabe oder den Klick mit einer zufälligen Kennung des
// Gesprächs, der Kern im Dienst (kern/gespraech.mjs) versteht, merkt sich das Gespräch und setzt die Sätze zusammen. Die Kennung trägt keine Person
// und lebt nur, solange die Seite offen ist. Das Merkmal, das die Treffer am besten teilt, steht als Rückfrage da.
// Wechselt das Thema (zusammen nichts, die neue Eingabe allein schon), fragt das Fenster, ob es stattdessen danach sucht.
// Passen Abschnitte aus den Unterlagen (Pflege, Reparatur, häufige Fragen) zur Frage, stehen sie zuerst — mit Quelle und „Dokument öffnen“.
// Die gesammelten Angaben und was sich lockern lässt, stehen in der Blase der Antwort; die Knöpfe älterer Antworten sind aus. Die letzte Frage
// des Beraters steht direkt über der Eingabe.
// Eine Variante lässt sich ganz öffnen; Produkte und Varianten kommen auf einen Merkzettel (☆ im Kopf) — beides nur im Arbeitsspeicher der Seite.
// Produkt, Variante, Merkzettel und Vergleich öffnen in einer Ansicht neben dem Gespräch. Schwebend ist sie ein eigenes Fenster links vom
// Gespräch — das Gespräch bleibt, wo es ist; reicht die Breite nicht, liegt sie über dem Gespräch. Eingebettet steht sie im selben Rahmen
// rechts. × schliesst sie.
(function () {
  'use strict'

  /// Die Kennung eines Gesprächs: zufällig, ohne Person, nur solange die Seite offen ist
  function kennung() {
    const a = new Uint8Array(16)
    const c = (typeof window !== 'undefined' && window.crypto) || (typeof crypto !== 'undefined' ? crypto : null)
    if (c && c.getRandomValues) c.getRandomValues(a); else for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256)
    return Array.from(a, x => x.toString(16).padStart(2, '0')).join('')
  }
  const TEXTE = {
    de: {
      oeffnen: 'Produktberatung', schliessen: 'Schliessen', frage: 'Wonach suchen Sie?', senden: 'Fragen',
      bis: 'bis', ab: 'ab', details: 'Details', vergleichen: 'Vergleichen', vergleich: n => `${n} vergleichen`,
      nochmal: 'Noch einmal fragen', unterlagen: 'Aus den Unterlagen:', weiterlesen: 'Weiterlesen', dokument: 'Dokument', dokumentLeer: 'Zu diesem Dokument gibt es keinen Text.', seite: n => `S. ${n}`,
      zurueck: 'Zurück', fehler: 'Der Berater antwortet gerade nicht.', zuviel: 'Zu viele Fragen in kurzer Zeit.', varianten: n => `${n} Ausführungen`, ki: 'Text von einer KI erstellt',
      filterWeg: 'Filter entfernen', merkmal: 'Merkmal', gleich: 'gleich',
      neu: 'Neue Suche', angabeWeg: 'Angabe entfernen', lockern: 'Mit weniger Angaben:', ohne: (l, n) => `${l} (${n})`, alle: 'alle Produkte',
      gross: 'Fenster vergrössern', klein: 'Fenster verkleinern',
      weitere: n => `${n} weitere zeigen`, nichtDas: 'Nicht das', nichtDasTitel: 'Dieses Produkt nicht mehr vorn zeigen', angesehen: 'angesehen',
      oeffnenVariante: 'Öffnen', merken: '☆ Merken', gemerkt: '★ Gemerkt', merkzettel: n => `☆ ${n}`, merkzettelTitel: 'Merkzettel', merkzettelLeer: 'Der Merkzettel ist leer.',
      ausMerkzettel: 'Vom Merkzettel nehmen', zumProdukt: 'Zum Produkt', variante: 'Variante',
      produkt: 'Produkt', vergleichTitel: 'Vergleich', werte: 'Werte', gesucht: 'Gesucht:', ansichtZu: 'Ansicht schliessen',
      stattJa: n => n === 1 ? 'Ja, 1 Produkt' : `Ja, ${n} Produkte`,
    },
    en: {
      oeffnen: 'Product advice', schliessen: 'Close', frage: 'What are you looking for?', senden: 'Ask',
      bis: 'up to', ab: 'from', details: 'Details', vergleichen: 'Compare', vergleich: n => `Compare ${n}`,
      nochmal: 'Ask again', unterlagen: 'From the documentation:', weiterlesen: 'Read more', dokument: 'Document', dokumentLeer: 'There is no text for this document.', seite: n => `p. ${n}`,
      zurueck: 'Back', fehler: 'The advisor is not answering right now.', zuviel: 'Too many questions in a short time.', varianten: n => `${n} versions`, ki: 'Text written by an AI',
      filterWeg: 'Remove filter', merkmal: 'Attribute', gleich: 'same',
      neu: 'New search', angabeWeg: 'Remove', lockern: 'With fewer criteria:', ohne: (l, n) => `${l} (${n})`, alle: 'all products',
      gross: 'Enlarge window', klein: 'Shrink window',
      weitere: n => `Show ${n} more`, nichtDas: 'Not this', nichtDasTitel: 'Stop showing this product first', angesehen: 'viewed',
      oeffnenVariante: 'Open', merken: '☆ Save', gemerkt: '★ Saved', merkzettel: n => `☆ ${n}`, merkzettelTitel: 'Saved items', merkzettelLeer: 'Nothing saved yet.',
      ausMerkzettel: 'Remove', zumProdukt: 'To the product', variante: 'Variant',
      produkt: 'Product', vergleichTitel: 'Comparison', werte: 'Details', gesucht: 'Searching for:', ansichtZu: 'Close view',
      stattJa: n => n === 1 ? 'Yes, 1 product' : `Yes, ${n} products`,
    },
  }

  const STIL = `
:host { all: initial; --breite: min(400px, calc(100vw - 32px)); --hoehe: min(620px, calc(100vh - 32px)); --akzent: #0b6e4f; --text: #1d1d1f; --leise: #6b6b70; --linie: #d9d9de; --flaeche: #ffffff; --blase: #f2f3f5; font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--text); }
@media (prefers-color-scheme: dark) { :host { --text: #ececf0; --leise: #a0a0a8; --linie: #3a3a40; --flaeche: #1c1c1f; --blase: #2a2a2e; } }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
button { font: inherit; cursor: pointer; }
.knopf { position: fixed; right: 16px; bottom: 16px; z-index: 2147483000; border: 0; border-radius: 22px; padding: 10px 16px; background: var(--akzent); color: #fff; box-shadow: 0 4px 16px rgba(0,0,0,.2); }
.fenster { display: flex; flex-direction: column; background: var(--flaeche); color: var(--text); border: 1px solid var(--linie); border-radius: 12px; overflow: hidden; }
.schwebend { position: fixed; right: 16px; bottom: 16px; z-index: 2147483000; width: var(--breite); height: var(--hoehe); box-shadow: 0 8px 32px rgba(0,0,0,.25); }
/* vergrössert (09.10.2026): fast die ganze Höhe und eine grössere Breite — die Ansicht daneben rückt mit */
:host(.gross) { --breite: min(720px, calc(100vw - 32px)); --hoehe: calc(100vh - 32px); }
.eingebettet { width: 100%; height: 100%; min-height: 420px; }
.kopf { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: var(--akzent); color: #fff; }
.kopf .titel { flex: 1; font-weight: 600; }
.kopf button { background: transparent; border: 0; color: #fff; font-size: 18px; line-height: 1; }
.verlauf { position: relative; flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 14px; }
.blase { max-width: 90%; padding: 8px 10px; border-radius: 10px; background: var(--blase); white-space: pre-wrap; }
.unterlagen { white-space: normal; display: flex; flex-direction: column; gap: 8px; }
.auszug { border-top: 1px solid var(--linie); padding-top: 8px; display: flex; flex-direction: column; gap: 4px; }
.auszug .titel { font-weight: 600; }
.auszug .quelle { font-size: 11px; color: var(--leise); }
.auszug .text { white-space: pre-wrap; }
.auszug .zeile { display: flex; gap: 10px; align-items: center; font-size: 12px; }
.auszug a { color: var(--akzent); }
.auszug .weiter { border: 0; background: transparent; color: var(--akzent); padding: 0; font-size: 12px; text-decoration: underline; }
.dokument .abschnitt { display: flex; flex-direction: column; gap: 2px; padding: 6px 0; border-bottom: 1px solid var(--linie); }
.dokument .abschnitt .titel { font-weight: 600; }
.dokument .abschnitt .quelle { font-size: 11px; color: var(--leise); }
.dokument .abschnitt .text { white-space: pre-wrap; }
.dokument .abschnitt.gefunden { border-left: 3px solid var(--akzent); padding-left: 8px; }
.blase.ich { align-self: flex-end; background: var(--akzent); color: #fff; }
.blase .hinweis { display: block; margin-top: 4px; font-size: 11px; color: var(--leise); }
.karten { display: flex; flex-direction: column; gap: 8px; }
/* was zu einer Antwort gehört, steht an einer Linie; Produkt, Variante, Merkzettel und Vergleich sind Tafeln mit Kopfzeile (08.10.2026) */
.antwort { border-left: 3px solid var(--akzent); padding-left: 10px; }
.koerper { flex: 1; display: flex; min-height: 0; }
.gespraech { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.ansicht { flex: 1.25; min-width: 0; overflow-y: auto; border-left: 1px solid var(--linie); padding: 12px; display: flex; flex-direction: column; gap: 10px; }
/* schwebend: die Ansicht ist ein eigenes Fenster links vom Gespräch, gleich hoch; das Gespräch bewegt sich nicht (08.10.2026) */
.ansicht.daneben { position: fixed; bottom: 16px; z-index: 2147483001; right: calc(16px + var(--breite) + 12px);
  width: min(480px, calc(100vw - var(--breite) - 44px)); height: var(--hoehe);
  background: var(--flaeche); color: var(--text); border: 1px solid var(--linie); border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,.25); }
@media (max-width: 760px) { .ansicht.daneben { right: 16px; width: var(--breite); } }
@media (max-width: 1240px) { :host(.gross) .ansicht.daneben { right: 16px; width: var(--breite); } }
.tafelkopf .zu { background: transparent; border: 0; color: var(--leise); font-size: 18px; line-height: 1; padding: 0 2px; }
.facette { border-style: dashed; }
.facette.offen { border-style: solid; border-color: var(--akzent); }
/* flex: none — sonst staucht die Ansicht (eine Flex-Spalte) die Tafel auf ihre Höhe, overflow: hidden schneidet den Rest ab, und es gibt
   nichts zu scrollen (08.10.2026: Tafel 477 px, Inhalt 1230 px, Ansicht 503 von 503 px) */
.tafel { flex: none; gap: 0; border: 1px solid var(--linie); border-radius: 10px; overflow: hidden; }
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
.karte .text { font-size: 13px; margin: 2px 0 4px; }
.karte .aktion { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 4px; font-size: 12px; }
/* die vier Bedienelemente einer Karte sehen gleich aus (09.10.2026): „Vergleichen“ ist ein Kästchen in einem Rahmen wie die Knöpfe,
   kein Text bricht um, und „★ Gemerkt“ bekommt seine Farbe auch hier — vorher galt die Regel für Knöpfe der Karte vor .merken.an */
.tat { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; line-height: 1.4; border: 1px solid var(--linie); background: transparent; color: var(--text); border-radius: 6px; padding: 2px 8px; font-size: 12px; cursor: pointer; }
.tat input { margin: 0; }
.tat.an, .tat:has(input:checked) { background: var(--akzent); border-color: var(--akzent); color: #fff; }
.tat:disabled { opacity: .5; cursor: default; }
button:focus-visible, .tat:focus-within { outline: 2px solid var(--akzent); outline-offset: 1px; }
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
.abschluss > .blase { display: flex; flex-direction: column; gap: 8px; white-space: normal; }
.abschluss .kopfzeile { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.statt .ja { background: var(--akzent); border-color: var(--akzent); color: #fff; }
form { display: flex; gap: 6px; padding: 10px; border-top: 1px solid var(--linie); }
input[type=text] { flex: 1; font: inherit; color: var(--text); background: var(--flaeche); border: 1px solid var(--linie); border-radius: 8px; padding: 8px 10px; min-width: 0; }
form button, .leiste button { border: 0; border-radius: 8px; padding: 8px 12px; background: var(--akzent); color: #fff; }
.leiste { padding: 0 10px 10px; display: flex; justify-content: flex-end; }
.ergebnis .chips { margin-top: 8px; white-space: normal; }
.chip:disabled { opacity: .5; cursor: default; }
table { border-collapse: collapse; width: 100%; font-size: 12px; }
th, td { text-align: left; vertical-align: top; padding: 4px 6px; border-bottom: 1px solid var(--linie); }
tr.gleich td { color: var(--leise); }
.galerie { display: flex; gap: 6px; overflow-x: auto; }
.absatz { white-space: pre-wrap; line-height: 1.5; }
/* eine Frage zu den gezeigten Produkten: je Produkt sein Name (öffnet es) und was in seinen Angaben dazu steht */
.sortiment .chips { margin-top: 8px; white-space: normal; }
.sortiment .nachsatz { margin-top: 8px; }
.stelle { display: flex; flex-direction: column; gap: 2px; margin-top: 8px; white-space: normal; }
.stelle .name { align-self: flex-start; border: 0; background: transparent; padding: 0; color: var(--akzent); font-weight: 600; text-align: left; }
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
    // das Gespräch führt der Kern im Dienst; hier stehen nur seine Kennung und — zum Anzeigen — die gesammelten Wörter und Filter der letzten Antwort
    // merkzettel: id → { id, name, art: 'produkt' | 'variante' } — in der Reihenfolge des Merkens; alles nur im Arbeitsspeicher der Seite
    const zustand = { gespraech: kennung(), woerter: [], filter: [], gruppe: null, auswahl: new Set(), merkzettel: new Map(), info: null, laeuft: false }

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
    // schwebend: vergrössern und wieder verkleinern — die Grösse hängt am Host, damit Gespräch und Ansicht daneben zusammenpassen
    const grossKnopf = el('button', 'groesse', '⤢'); grossKnopf.type = 'button'; grossKnopf.title = T.gross; grossKnopf.setAttribute('aria-label', T.gross)
    grossKnopf.addEventListener('click', () => {
      const gross = wirt.classList.toggle('gross')
      grossKnopf.textContent = gross ? '⤡' : '⤢'
      grossKnopf.title = gross ? T.klein : T.gross; grossKnopf.setAttribute('aria-label', grossKnopf.title)
    })
    kopf.append(titel, merkKnopf)
    if (!ziel) kopf.append(grossKnopf, zu)
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

    // Frühere Eingaben (10.10.2026): ein Klick auf die eigene Blase setzt ihren Text in die Eingabezeile; ↑ und ↓ in der Eingabezeile blättern
    // durch die Eingaben — nur im Arbeitsspeicher der Seite
    const eingaben = []
    let blaettern = -1
    function blase(text, ich, hinweis) {
      const b = el('div', 'blase' + (ich ? ' ich' : ''), text)
      if (ich) {
        if (eingaben.at(-1) !== text) eingaben.push(text)
        blaettern = -1
        b.title = T.nochmal
        b.addEventListener('click', () => { eingabe.value = text; eingabe.focus() })
      }
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
        if (zustand.merkzettel.has(id)) zustand.merkzettel.delete(id)
        else {
          zustand.merkzettel.set(id, { id, name, art })
          rufe('/api/event', { gespraech: zustand.gespraech, art: 'gemerkt', id, name }).catch(() => {})
        }
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

    /// Die Texte (Beschreibung) als Absätze unter dem Namen — die Bezeichnung steht im Tooltip
    function absaetze(inhalt, texte) {
      for (const x of texte || []) { const a = el('div', 'absatz', x.value); a.title = x.label; inhalt.append(a) }
    }
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
    /// Ein Dokument der Unterlagen als Text in der Ansicht (10.10.2026): alle Abschnitte mit Überschrift und Seite, der gefundene hervorgehoben und
    /// sichtbar — kein Download, keine Datei
    async function zeigeDokument(id, seq) {
      try {
        const d = await rufe(`/api/doc/${encodeURIComponent(id)}`)
        const { t: b, inhalt } = tafel('dokument', T.dokument, d.name)
        let ziel = null
        for (const s of d.sections || []) {
          const a = el('div', 'abschnitt')
          if (s.heading) a.append(el('div', 'titel', s.heading))
          if (s.page) a.append(el('div', 'quelle', T.seite(s.page)))
          a.append(el('div', 'text', s.text))
          if (seq && s.seq === seq) { a.classList.add('gefunden'); ziel = a }
          inhalt.append(a)
        }
        if (!(d.sections || []).length) inhalt.append(el('div', 'leise', T.dokumentLeer))
        zeige(b)
        if (ziel) ansicht.scrollTop = Math.max(0, ziel.offsetTop - 8)
      } catch (e) { blase(e.message) }
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
      if (h.text) inhalt.append(el('div', 'text', h.text))   // der Anfang der Beschreibung (10.10.2026)
      for (const v of h.values || []) inhalt.append(el('div', 'wert', `${v.label}: ${v.value}`))
      if (h.variants > 1) inhalt.append(el('div', 'wert', T.varianten(h.variants)))
      if (h.seen) inhalt.append(el('div', 'wert gesehen', T.angesehen))
      const aktion = el('div', 'aktion')
      const details = el('button', 'tat details', T.details); details.type = 'button'
      details.addEventListener('click', () => zeigeProdukt(h.id))
      const wahl = el('label', 'tat wahl')
      const box = el('input'); box.type = 'checkbox'; box.checked = zustand.auswahl.has(h.id)
      box.addEventListener('change', () => {
        if (box.checked && zustand.auswahl.size >= 4) { box.checked = false; return }
        box.checked ? zustand.auswahl.add(h.id) : zustand.auswahl.delete(h.id)
        aktualisiereLeiste()
      })
      wahl.append(box, document.createTextNode(T.vergleichen))
      const nicht = el('button', 'tat nicht', T.nichtDas); nicht.type = 'button'; nicht.title = T.nichtDasTitel
      nicht.addEventListener('click', () => schritt({ art: 'ablehnen', id: h.id, name: h.name }))
      const merken = merkenKnopf(h.id, h.name, 'produkt'); merken.classList.add('tat')
      aktion.append(details, merken, wahl, nicht)
      inhalt.append(aktion)
      k.append(bild(h.image), inhalt)
      return k
    }

    const filterText = f => `${f.label}: ${f.op === 'le' ? T.bis + ' ' : f.op === 'ge' ? T.ab + ' ' : ''}${f.valueLabel || f.value}`

    /// Die gesammelten Angaben als Chips: Wörter und Filter, jede einzeln zu entfernen — dazu „Neue Suche“
    /// „Neue Suche“ steht in der letzten Blase einer Antwort (09.10.2026): bei Treffern neben „Passt eines davon?“, ohne Treffer bei den Angaben
    function neueSuche() {
      const neu = el('button', 'chip neu', T.neu); neu.type = 'button'
      neu.addEventListener('click', () => schritt({ art: 'neu' }))
      return neu
    }

    function angabenChips(mitNeu) {
      if (!zustand.filter.length && !zustand.woerter.length && !zustand.gruppe) return null
      const c = el('div', 'chips angaben')
      c.append(el('span', 'leise', T.gesucht))
      if (zustand.gruppe) {
        const chip = el('button', 'chip an gruppe', `${zustand.gruppe.label} ×`); chip.type = 'button'; chip.title = T.angabeWeg
        chip.addEventListener('click', () => schritt({ art: 'weg', kind: 'gruppe' }))
        c.append(chip)
      }
      for (const w of zustand.woerter) {
        const chip = el('button', 'chip an wort', `${w} ×`); chip.type = 'button'; chip.title = T.angabeWeg
        chip.addEventListener('click', () => schritt({ art: 'weg', kind: 'word', word: w }))
        c.append(chip)
      }
      for (const f of zustand.filter) {
        const chip = el('button', 'chip an', `${filterText(f)} ×`)
        chip.type = 'button'; chip.title = T.filterWeg
        chip.addEventListener('click', () => schritt({ art: 'weg', kind: 'filter', attribute: f.attribute, op: f.op, value: f.value }))
        c.append(chip)
      }
      if (mitNeu) c.append(neueSuche())
      return c
    }

    /// Nichts gefunden: welche Angabe zu eng ist — ein Klick nimmt sie weg. Der Knopf nennt, was dann bleibt („hose (17)“), nicht, was
    /// wegfällt: „ohne pullover“ liest sich wie „mit pullover“ (08.10.2026)
    function lockernChips(lockern) {
      if (!lockern || !lockern.length) return null
      const c = el('div', 'chips lockern')
      c.append(el('span', 'leise', T.lockern))
      for (const l of lockern) {
        const bleibt = [
          ...zustand.woerter.filter(w => !(l.kind === 'word' && w === l.word)),
          ...zustand.filter.filter(f => !(l.kind !== 'word' && f.attribute === l.attribute && f.op === l.op && f.value === l.value)).map(filterText),
        ]
        const chip = el('button', 'chip', T.ohne(bleibt.length ? bleibt.join(' + ') : T.alle, l.n)); chip.type = 'button'
        chip.title = `${T.angabeWeg}: ${l.kind === 'word' ? l.word : filterText(l)}`
        chip.addEventListener('click', () => schritt(l.kind === 'word' ? { art: 'weg', kind: 'word', word: l.word } : { art: 'weg', kind: 'filter', attribute: l.attribute, op: l.op, value: l.value }))
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
      chip.addEventListener('click', () => schritt({ art: 'filter', attribute: f.key, op: opt.op, value: opt.value }))
      return chip
    }

    /// Abschnitte aus den Unterlagen: der erste ganz, die weiteren gekürzt mit „ganzer Abschnitt“ — je mit Überschrift, Quelle und dem Dokument
    function unterlagenBlase(docs) {
      if (!docs || !docs.length) return null
      const b = el('div', 'blase unterlagen')
      b.append(el('div', 'leise', T.unterlagen))
      docs.forEach((d, i) => {
        const a = el('div', 'auszug')
        a.append(el('div', 'titel', d.heading || d.name))
        a.append(el('div', 'quelle', [d.name, d.page ? T.seite(d.page) : null, d.node ? d.node.label : null].filter(Boolean).join(' · ')))
        const kurz = i > 0 && d.text.length > 240
        a.append(el('div', 'text', kurz ? d.text.slice(0, 240).replace(/\s+\S*$/, '') + ' …' : d.text))
        // kein Download (10.10.2026): „Weiterlesen“ zeigt das ganze Dokument als Text in der Ansicht, am gefundenen Abschnitt
        const zeile = el('div', 'zeile')
        const weiter = el('button', 'weiter', T.weiterlesen); weiter.type = 'button'
        weiter.addEventListener('click', () => zeigeDokument(d.media, d.seq))
        zeile.append(weiter)
        a.append(zeile)
        b.append(a)
      })
      return b
    }

    /// Das Thema hat gewechselt: zusammen mit dem Bisherigen passt nichts, die neue Eingabe allein schon — ja sucht nur noch danach
    function stattChips(s, frageText) {
      if (!s || !s.n) return null
      const r = el('div', 'rueckfrage statt')
      r.append(el('div', 'blase', frageText))
      const ja = el('button', 'chip ja', T.stattJa(s.n)); ja.type = 'button'
      ja.addEventListener('click', () => schritt({ art: 'statt' }))
      const c = el('div', 'chips'); c.append(ja); r.append(c)
      return r
    }

    /// Die Rückfrage: das Merkmal, das die Treffer am besten teilt, als Frage mit Knöpfen
    /// Der Abschluss einer Antwort (09.10.2026): nach den Karten die Frage des Beraters, direkt über der Eingabe — passt eines, oder nach dem
    /// Merkmal eingrenzen, das die Treffer am besten teilt; darunter seine Werte, die weiteren Merkmale und „weitere zeigen“
    /// Die Frage nennt die Merkmale, nach denen sich die Treffer unterscheiden (höchstens drei), und bietet sie in derselben Blase an —
    /// was sie nicht nennt, steht nicht da (09.10.2026)
    /// Kann eine Angabe mehreres meinen („bis minus 10 grad“: Komfort- oder Grenztemperatur), fragt der Kern danach (`wahl`, 14.10.2026): je
    /// Möglichkeit ein Knopf, der die Angabe setzt — statt der Merkmale
    function rueckfrage(facetten, frageText, auswahl) {
      const genannt = (facetten || []).slice(0, 3)
      const r = el('div', 'rueckfrage abschluss')
      const b = el('div', 'blase')
      const kopf = el('div', 'kopfzeile')
      kopf.append(el('span', 'frage', frageText || ''))
      if (zustand.woerter.length || zustand.filter.length) kopf.append(neueSuche())
      b.append(kopf)
      if (auswahl?.optionen?.length) {
        const c = el('div', 'chips werte wahl')
        for (const o of auswahl.optionen) {
          const chip = el('button', 'chip', o.text); chip.type = 'button'
          chip.addEventListener('click', () => schritt({ art: 'filter', attribute: o.attribute, op: o.op, value: o.value }))
          c.append(chip)
        }
        b.append(c); r.append(b)
        return r
      }
      const wahl = facettenWahl(genannt); if (wahl) b.append(wahl)
      r.append(b)
      return r
    }

    /// Die Merkmale der Frage: je eines ein Knopf („Farbe ▾“), das erste offen, seine Werte darunter; bei einem Merkmal nur seine Werte
    function facettenWahl(facetten) {
      if (!facetten.length) return null
      const block = el('div', 'eingrenzen')
      const werte = el('div', 'chips werte')
      const zeige = f => werte.replaceChildren(...optionen(f, false).map(opt => facettenChip(f, opt)))
      if (facetten.length > 1) {
        const c = el('div', 'chips merkmale')
        for (const f of facetten) {
          const k = el('button', 'chip facette', `${f.label} ▾`); k.type = 'button'
          k.addEventListener('click', () => { for (const x of c.querySelectorAll('.facette')) x.classList.toggle('offen', x === k); zeige(f) })
          c.append(k)
        }
        c.firstElementChild.classList.add('offen')
        block.append(c)
      }
      zeige(facetten[0])
      block.append(werte)
      return block
    }

    /// Die Antwort auf eine Frage zum Produkt im Blick (09.10.2026): die passenden Werte, darunter seine Unterlagen, zuletzt „alle Angaben?“
    /// Die Antwort auf eine Frage nach einem Problem oder zur Pflege (10.10.2026): die Unterlagen, zuletzt „Hilft Ihnen das weiter?“
    function antwortProblem(r) {
      const antwort = el('div', 'karten antwort')
      if (r.answer) { const k = el('div', 'blase ergebnis'); k.append(el('span', 'satz', r.answer), el('span', 'hinweis', T.ki)); antwort.append(k) }
      const ub = unterlagenBlase(r.docs); if (ub) antwort.append(ub)
      if (r.texte?.satz) antwort.append(el('div', 'blase ergebnis', r.texte.satz))
      const ab = el('div', 'rueckfrage abschluss'), bl = el('div', 'blase'), kopf = el('div', 'kopfzeile')
      kopf.append(el('span', 'frage', r.texte?.frage || ''), neueSuche())
      bl.append(kopf); ab.append(bl); antwort.append(ab)
      verlauf.append(antwort)
      verlauf.scrollTop = Math.max(0, antwort.offsetTop - 8)
    }

    function antwortZumProdukt(r) {
      const antwort = el('div', 'karten antwort')
      const b = el('div', 'blase ueber ergebnis')
      for (const h of r.texte?.hinweise || []) b.append(el('div', 'gelesen leise', h))
      b.append(el('div', 'leise', r.texte?.ueber || r.about.name))
      if (r.answer) { b.append(el('span', 'satz', r.answer)); b.append(el('span', 'hinweis', T.ki)) }
      if (r.about.values.length) {
        const t = el('table', 'werte'), tb = el('tbody')
        for (const v of r.about.values) { const tr = el('tr'); tr.append(el('th', '', v.label), el('td', '', v.value)); tb.append(tr) }
        t.append(tb); b.append(t)
      } else if (!r.answer && r.texte?.satz) b.append(el('span', 'satz', r.texte.satz))
      antwort.append(b)
      const ub = unterlagenBlase(r.docs); if (ub) antwort.append(ub)
      const ab = el('div', 'rueckfrage abschluss'), bl = el('div', 'blase'), kopf = el('div', 'kopfzeile')
      const det = el('button', 'chip', T.details); det.type = 'button'
      det.addEventListener('click', () => zeigeProdukt(r.about.id))
      const knoepfe = el('span', 'chips'); knoepfe.append(det, neueSuche())
      kopf.append(el('span', 'frage', r.texte?.frage || ''), knoepfe)
      bl.append(kopf); ab.append(bl); antwort.append(ab)
      verlauf.append(antwort)
      verlauf.scrollTop = Math.max(0, antwort.offsetTop - 8)
    }

    /// Das Sortiment (09.10.2026): die Gruppen des Publikationsbaums mit Anzahl — ein Klick zeigt die Produkte einer Gruppe
    function antwortSortiment(r) {
      const antwort = el('div', 'karten antwort')
      const b = el('div', 'blase sortiment')
      for (const h of r.texte?.hinweise || []) b.append(el('div', 'gelesen', h))
      b.append(el('span', 'satz', r.texte?.satz || ''))
      if (r.sortiment.length) {
        const c = el('div', 'chips')
        for (const g of r.sortiment) {
          const chip = el('button', 'chip', `${g.label} (${g.n})`); chip.type = 'button'
          chip.addEventListener('click', () => schritt({ art: 'gruppe', key: g.key, label: g.label }))
          c.append(chip)
        }
        b.append(c)
      }
      if (r.texte?.nachsatz) b.append(el('div', 'nachsatz', r.texte.nachsatz))
      antwort.append(b)
      verlauf.append(antwort)
      verlauf.scrollTop = Math.max(0, antwort.offsetTop - 8)
    }

    /// Die Antwort auf eine Frage zu den Produkten der letzten Antwort (09.10.2026): je Produkt, was in seinen Angaben dazu steht
    function antwortZuDenTreffern(r) {
      const antwort = el('div', 'karten antwort')
      const b = el('div', 'blase zu-den')
      for (const h of r.texte?.hinweise || []) b.append(el('div', 'gelesen leise', h))
      b.append(el('span', 'satz', r.texte?.satz || ''))
      if (r.answer) { b.append(el('div', 'satz', r.answer)); b.append(el('span', 'hinweis', T.ki)) }
      for (const a of r.antworten) {
        const s = el('div', 'stelle')
        const n = el('button', 'name', a.name); n.type = 'button'; n.title = T.details
        n.addEventListener('click', () => zeigeProdukt(a.id))
        s.append(n)
        if (a.values.length) {
          const t = el('table', 'werte'), tb = el('tbody')
          for (const v of a.values) { const tr = el('tr'); tr.append(el('th', '', v.label), el('td', '', v.value)); tb.append(tr) }
          t.append(tb); s.append(t)
        } else s.append(el('div', 'leise', r.texte?.nichts || ''))
        b.append(s)
      }
      antwort.append(b)
      verlauf.append(antwort)
      verlauf.scrollTop = Math.max(0, antwort.offsetTop - 8)
    }

    /// Eine Eingabe oder ein Klick an den Kern — mit der Kennung des Gesprächs; was gilt, sagt die Antwort
    const frage = (q, alsBlase) => anfrage({ q }, alsBlase ? q : null)
    const schritt = s => anfrage({ schritt: s }, null)

    async function anfrage(inhalt, ichText) {
      if (zustand.laeuft) return
      zustand.laeuft = true; senden.disabled = true
      if (ichText) blase(ichText, true)
      try {
        const r = await rufe('/api/ask', { gespraech: zustand.gespraech, locale: sprache, ...inhalt })
        // die Knöpfe älterer Antworten gelten nicht mehr
        for (const alt of verlauf.querySelectorAll('.ergebnis button, .abschluss .neu, .karte .nicht')) alt.disabled = true
        if (r.reset) { zustand.woerter = []; zustand.filter = []; zustand.gruppe = null; blase(r.texte?.satz || T.neu); eingabe.focus(); return }
        if (r.kurz) { blase(r.texte?.satz || ''); return }   // Gruss, Dank, Abschied
        if (r.about) { antwortZumProdukt(r); return }   // eine Frage zum Produkt im Blick: seine Werte, seine Unterlagen
        if (r.antworten) { antwortZuDenTreffern(r); return }   // eine Frage zu den gezeigten Produkten
        if (r.problem) { antwortProblem(r); return }   // eine Frage nach einem Problem oder zur Pflege: die Unterlagen
        if (r.sortiment) { antwortSortiment(r); return }   // eine Frage nach dem Sortiment
        // was jetzt gilt, sagt der Kern: die gesammelten Wörter und alle Filter, auch die aus dem Text erkannten — mit Bezeichnungen
        if (Array.isArray(r.words)) { zustand.woerter = r.words; zustand.gruppe = r.group ?? null }
        if (Array.isArray(r.filter)) zustand.filter = r.filter.map(f => ({ attribute: f.attribute, op: f.op, value: f.value, label: f.label, valueLabel: f.valueLabel }))
        const antwort = el('div', 'karten antwort')
        const ub = unterlagenBlase(r.docs); if (ub) antwort.append(ub)   // beantworten die Unterlagen die Frage, steht das zuerst
        const texte = r.texte || {}
        const text = r.answer ? r.answer : texte.satz
        // eine Blase: was der Berater gelesen, nicht gefunden oder übernommen hat, der Satz, was gesucht wird, ohne Treffer was sich lockern lässt
        const sb = el('div', 'blase ergebnis')
        for (const h of texte.hinweise || []) sb.append(el('div', 'gelesen leise', h))
        sb.append(el('span', 'satz', text))
        if (r.answer) sb.append(el('span', 'hinweis', T.ki))
        const ac = angabenChips(!(r.hits || []).length); if (ac) sb.append(ac)   // mit Treffern steht „Neue Suche“ im Abschluss
        const lo = r.total ? null : lockernChips(r.relax); if (lo) sb.append(lo)
        antwort.append(sb)
        const st = r.total ? null : stattChips(r.instead, texte.statt); if (st) antwort.append(st)   // die Frage zuletzt, direkt über der Eingabe
        const hits = r.hits || []
        for (const h of hits.slice(0, ZUERST)) antwort.append(karte(h))
        // „weitere zeigen“ gehört zur Liste: nach den Karten, vor der Frage; die weiteren Karten kommen an seine Stelle
        if (hits.length > ZUERST) {
          const mehr = el('button', 'mehr', T.weitere(hits.length - ZUERST)); mehr.type = 'button'
          mehr.addEventListener('click', () => { for (const h of hits.slice(ZUERST)) antwort.insertBefore(karte(h), mehr); mehr.remove() })
          antwort.append(mehr)
        }
        if (hits.length || r.wahl) antwort.append(rueckfrage(r.facets, texte.frage, r.wahl))
        verlauf.append(antwort)
        verlauf.scrollTop = Math.max(0, antwort.offsetTop - 8)   // an den Anfang der Antwort, nicht ans Ende der Karten
      } catch (e) { blase(e.message) }
      finally { zustand.laeuft = false; senden.disabled = false }
    }

    async function zeigeProdukt(id) {
      try {
        // das geöffnete Produkt ist im Blick — der Kern im Dienst merkt es sich zum Gespräch
        const p = await rufe(`/api/product/${encodeURIComponent(id)}?locale=${sprache}&gespraech=${zustand.gespraech}`)
        const { t: b, kopf, inhalt } = tafel('produkt', T.produkt, p.name)
        absaetze(inhalt, p.texts)
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
        absaetze(inhalt, v.texts)
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

    eingabe.addEventListener('keydown', ev => {
      if ((ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown') || !eingaben.length) return
      ev.preventDefault()
      blaettern = ev.key === 'ArrowUp' ? (blaettern < 0 ? eingaben.length - 1 : Math.max(0, blaettern - 1)) : (blaettern < 0 ? -1 : blaettern + 1)
      if (blaettern >= eingaben.length) blaettern = -1
      eingabe.value = blaettern < 0 ? '' : eingaben[blaettern]
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
