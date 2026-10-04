// Plugin enrich (30.09.2026): Fehlende Attributwerte finden und ergänzen.
// Ablauf: Knoten+Unterknoten laden → leere Attribute erkennen → Anwender wählt aus → Recherche (KI+Web, nur KI, manuell) → Ergebnis → Übernahme
const L = l => globalThis.journali?.L ? globalThis.journali.L(l) : (l?.de ?? Object.values(l ?? {})[0] ?? '')
const t = (k, p) => globalThis.journali?.t ? globalThis.journali.t(k, p) : String(k).replace(/\{(\w+)\}/g, (m, i) => p?.[i] ?? m)
const GRENZE = 2000   // so viele Knoten bearbeitet die Anreicherung auf einmal (je Knoten ein KI-Aufruf)
function el(tag, attrs = {}, ...kids) { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (v == null) continue; if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'class') e.className = v; else e.setAttribute(k, v) } for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : String(c)); return e }

async function mount(root, ctx) {
  const { api, store, tree, ai, dialog } = ctx
  if (!tree.loaded) await tree.load()
  const model = store.model
  const locale = model.masterLocale ?? 'de'
  const lbl = a => a.label?.[locale] || L(a.label) || a.key
  const glbl = g => model.groups?.find(x => x.key === g)?.label?.[locale] || g || t('ohne Gruppe')

  root.style.cssText = 'display:flex;flex-direction:column;height:100%;padding:0'
  const toolbar = el('div', { class: 'toolbar', style: 'flex:none' })
  const body = el('div', { class: 'scroll', style: 'flex:1;min-height:0;padding:8px' })
  const pickBox = el('div', { style: 'display:none;padding:4px 8px;border-bottom:1px solid var(--border)' })
  root.append(toolbar, pickBox, body)

  // Zustand
  const st = {
    rootId: localStorage.getItem('journali.cmp.enrich.root') || tree.rows[0]?.id || null,
    rows: [],             // [{ row, values }] aus /api/nodes/{id}/table
    columns: [],          // Spalteninfo
    leere: new Map(),     // attrKey → [nodeId, …] (Attribute, die irgendwo leer sind)
    gewaehlt: new Set(),  // vom Anwender angehakte Attribute
    modus: 'ki+web',     // 'ki+web' | 'ki' | 'manuell'
    ergebnis: [],         // [{ nodeId, nodeLabel, attrKey, attrLabel, value, confidence, why, url, source, sources }]
    laufend: false,
  }

  // 1. Toolbar: Knotenwähler, Modus, Laden-Knopf
  function drawToolbar() {
    toolbar.innerHTML = ''
    const knoten = tree.byId.get(st.rootId)
    toolbar.append(
      el('h1', {}, t('⌕ Anreicherung')),
      el('span', { class: 'muted', style: 'margin-left:8px;font-size:12px' }, knoten ? knoten.label : t('kein Knoten')),
      el('button', { class: 'x', style: 'margin-left:8px', title: t('Knoten wählen'), onclick: () => {
        if (pickBox.style.display !== 'none') { pickBox.style.display = 'none'; return }
        pickBox.innerHTML = ''; pickBox.style.display = 'block'
        ctx.treePicker(pickBox, { value: st.rootId, roles: ['group', 'product'], height: 300, onPick: r => {
          pickBox.style.display = 'none'; st.rootId = r.id; localStorage.setItem('journali.cmp.enrich.root', r.id); ladeTeilbaum()
        } })
      } }, '▤'),
      el('span', { style: 'flex:1' }),
      el('span', { class: 'muted', style: 'font-size:12px' }, st.rows.length ? t('{0} Knoten', [st.rows.length]) : '')
    )
  }

  // 2. Teilbaum laden und leere Attribute finden
  async function ladeTeilbaum() {
    body.innerHTML = ''; drawToolbar()
    if (!st.rootId) { body.append(el('div', { class: 'empty' }, t('Einen Knoten auswählen'))); return }
    body.append(el('div', { class: 'muted' }, t('Teilbaum wird geladen …')))
    try {
      // Seitenweise (04.10.2026); ein Teilbaum über GRENZE Knoten wird abgelehnt — angereichert wird je Knoten mit einem KI-Aufruf,
      // und die ganze Tabelle eines grossen Zweigs waren in einem Stück 1 GB JSON
      const url = `/api/nodes/${encodeURIComponent(st.rootId)}/table?deep=true&self=true&locale=${encodeURIComponent(locale)}`
      const erste = await api.get(`${url}&take=500&skip=0`)
      if ((erste.total ?? 0) > GRENZE) {
        st.rows = []; body.innerHTML = ''; drawToolbar()
        body.append(el('div', { class: 'neg' }, t('{0} Knoten im Teilbaum, höchstens {1}.', [erste.total, GRENZE])))
        return
      }
      st.columns = erste.columns || []
      st.rows = [...(erste.rows || [])]
      for (let skip = erste.next; skip != null;) {
        const seite = await api.get(`${url}&take=500&skip=${skip}`)
        st.rows.push(...(seite.rows || []))
        skip = seite.next != null && seite.next > skip ? seite.next : null
      }
      st.leere = new Map()
      st.gewaehlt = new Set()
      st.ergebnis = []
      // je Knoten: welche Attribute sind leer?
      for (const r of st.rows) {
        for (const col of st.columns) {
          if (['rows', 'formula', 'template'].includes(col.type)) continue
          const v = r.values?.[col.key]
          if (r.inactive?.includes(col.key)) continue
          const leer = !v || (v.value == null || v.value === '') && !v.own
          if (leer) {
            if (!st.leere.has(col.key)) st.leere.set(col.key, [])
            st.leere.get(col.key).push(r.row.id)
          }
        }
      }
      drawAuswahl()
    } catch (e) {
      body.innerHTML = ''; body.append(el('div', { class: 'neg' }, t('Fehler: {0}', [e.message])))
    }
  }

  // 3. Leere Attribute anzeigen, gruppiert, mit Häkchen
  function drawAuswahl() {
    body.innerHTML = ''
    if (!st.leere.size) { body.append(el('div', { class: 'empty' }, t('Keine leeren Attribute gefunden'))); return }
    const kopf = el('div', { style: 'margin-bottom:10px' },
      el('b', {}, t('{0} Attribute mit leeren Werten', [st.leere.size])),
      el('span', { class: 'muted', style: 'margin-left:8px;font-size:12px' }, t('Anhaken, was gesucht werden soll')))
    // nach Gruppen sortieren
    const gruppen = new Map()
    for (const [key] of st.leere) {
      const def = model.attributes.find(a => a.key === key)
      if (!def) continue
      const g = def.group || ''
      if (!gruppen.has(g)) gruppen.set(g, [])
      gruppen.get(g).push(def)
    }
    const liste = el('div', { style: 'margin-bottom:12px' })
    for (const [g, attrs] of gruppen) {
      const alle = attrs.every(a => st.gewaehlt.has(a.key))
      liste.append(el('div', { style: 'display:flex;margin:4px 0;gap:4px;align-items:baseline' },
        el('span', { class: 'muted', style: 'font-size:12px;min-width:140px;width:140px;flex-shrink:0;cursor:pointer', title: alle ? t('Gruppe abwählen') : t('ganze Gruppe wählen'), onclick: () => {
          if (alle) attrs.forEach(a => st.gewaehlt.delete(a.key)); else attrs.forEach(a => st.gewaehlt.add(a.key)); drawAuswahl()
        } }, `▤ ${glbl(g)}`),
        el('div', { class: 'chips', style: 'flex:1;min-width:0' },
        ...attrs.map(a => el('span', {
          class: 'view-chip' + (st.gewaehlt.has(a.key) ? ' on' : ''),
          title: `${a.key} · ${a.type} · ${t('{0} Knoten leer', [st.leere.get(a.key).length])}`,
          onclick: () => { st.gewaehlt.has(a.key) ? st.gewaehlt.delete(a.key) : st.gewaehlt.add(a.key); drawAuswahl() }
        }, lbl(a), el('span', { class: 'muted', style: 'margin-left:4px;font-size:10px' }, `${st.leere.get(a.key).length}`))))))
    }
    // Moduswahl
    const modi = el('div', { class: 'chips', style: 'margin:8px 0' },
      el('b', { style: 'font-size:12px' }, t('Suchmodus:')),
      ...['ki+web', 'ki', 'manuell'].map(m => el('span', {
        class: 'view-chip' + (st.modus === m ? ' on' : ''),
        title: m === 'ki+web' ? t('KI sucht im Internet (kostet KI-Token + Websuch-Gebühren)') : m === 'ki' ? t('KI schlägt aus ihrem Wissen vor (keine Websuche)') : t('Suchlinks zum Selbstrecherchieren'),
        onclick: () => { st.modus = m; drawAuswahl() }
      }, m === 'ki+web' ? t('✦ KI + Websuche') : m === 'ki' ? t('✦ nur KI') : t('⌕ manuell'))))
    // Zusammenfassung und Starten
    const arbeit = zuordnen()
    const zusammenfassung = el('div', { class: 'muted', style: 'font-size:12px;margin:4px 0' },
      st.gewaehlt.size ? t('{0} Attribute · {1} Knoten · {2} Suchen', [st.gewaehlt.size, new Set(arbeit.map(a => a.nodeId)).size, arbeit.length]) : t('Oben Attribute anhaken'))
    const kiReady = ai.available()
    const startBtn = el('button', {
      class: 'primary',
      disabled: !st.gewaehlt.size || (st.modus !== 'manuell' && !kiReady) ? 'disabled' : null,
      title: !kiReady && st.modus !== 'manuell' ? t('kein KI-Schlüssel — Einstellungen → KI') : '',
      onclick: () => recherchieren(arbeit)
    }, st.modus === 'manuell' ? t('⌕ Suchlinks zeigen') : t('✦ Suche starten'))
    body.append(kopf, liste, modi, zusammenfassung, startBtn)
    // Ergebnis, wenn vorhanden
    if (st.ergebnis.length) drawErgebnis()
  }

  // 4. Zuordnen: gewählte Attribute → konkrete Knoten, die den Wert brauchen
  function zuordnen() {
    const arbeit = []
    for (const key of st.gewaehlt) {
      const nodeIds = st.leere.get(key) || []
      const def = model.attributes.find(a => a.key === key)
      if (!def) continue
      for (const nodeId of nodeIds) {
        const r = st.rows.find(x => x.row.id === nodeId)
        if (!r) continue
        // Kontext: alle vorhandenen Werte dieses Knotens
        const kontext = []
        for (const col of st.columns) {
          const v = r.values?.[col.key]
          if (!v || v.value == null || v.value === '') continue
          const d = model.attributes.find(a => a.key === col.key)
          kontext.push({ key: col.key, label: d ? lbl(d) : col.key, value: String(v.values ? v.values.join(', ') : v.value).replace(/<[^>]+>/g, ' ').slice(0, 300) })
        }
        arbeit.push({ nodeId, nodeLabel: r.row.label, nodeRole: r.row.role, nodeKeys: r.row.keys, attrKey: key, attrLabel: lbl(def), attrDef: def, kontext })
      }
    }
    return arbeit
  }

  // 5. Recherchieren
  async function recherchieren(arbeit) {
    if (!arbeit.length) return
    st.laufend = true; st.ergebnis = []
    body.innerHTML = ''
    const fortschritt = el('div', { class: 'muted', style: 'padding:8px' })
    body.append(fortschritt)
    if (st.modus === 'manuell') {
      // Suchlinks bauen
      for (const a of arbeit) {
        const teile = a.kontext.filter(k => k.value).map(k => k.value).slice(0, 4)
        teile.push(a.attrLabel)
        const q = teile.join(' ')
        st.ergebnis.push({ nodeId: a.nodeId, nodeLabel: a.nodeLabel, attrKey: a.attrKey, attrLabel: a.attrLabel, value: '', confidence: null, why: '', url: `https://www.google.com/search?q=${encodeURIComponent(q)}`, source: 'manuell', sources: [], suchbegriff: q })
      }
      st.laufend = false; drawAuswahl()
      return
    }
    // KI: je Knoten alle fehlenden Attribute auf einmal fragen (effizienter als einzeln)
    const web = st.modus === 'ki+web'
    const nachKnoten = new Map()
    for (const a of arbeit) {
      if (!nachKnoten.has(a.nodeId)) nachKnoten.set(a.nodeId, { ...a, fehlend: [] })
      nachKnoten.get(a.nodeId).fehlend.push(a)
    }
    let fertig = 0
    for (const [nodeId, kn] of nachKnoten) {
      fertig++
      fortschritt.textContent = t('{0}/{1}: {2} …', [fertig, nachKnoten.size, kn.nodeLabel])
      const known = kn.kontext.map(k => `${k.label}: ${k.value}`).join('\n')
      const list = model.lists ? new Map(model.lists.map(l => [l.key, l])) : new Map()
      const ask = kn.fehlend.map(f => {
        const d = f.attrDef
        const lk = d.type === 'enum' && d.list ? list.get(d.list) : null
        return `- ${f.attrKey}: ${f.attrLabel}${d.type ? ` (${d.type}${d.unit ? ' ' + d.unit : ''})` : ''}${lk ? ` — erlaubt: ${lk.values.map(v => v.label?.[locale] || L(v.label) || v.value).join(' | ')}` : ''}`
      }).join('\n')
      const system = t('Du bist Datenpfleger in einem PIM. Du bekommst die vorhandenen Attributwerte eines Produkts und eine Liste fehlender Datenpunkte. Schlage nur vor, was sich aus den vorhandenen Werten belastbar ableiten oder als allgemein bekannt für dieses Produkt annehmen lässt; sonst lass den Datenpunkt weg. Antworte NUR mit JSON: { "<key>": { "value": "<Wert im geforderten Typ>", "confidence": 0.0-1.0, "why": "<ein Satz>" } }. Zahlen ohne Einheit, Datum als JJJJ-MM-TT, ja/nein als true/false.')
      const keys = kn.nodeKeys ? Object.entries(kn.nodeKeys).map(([k, v]) => `${k} ${v}`).join(', ') : ''
      const user = `Produkt: ${kn.nodeLabel} (${kn.nodeRole}${keys ? ', ' + keys : ''})\n\nVorhandene Werte:\n${known || '(keine)'}\n\nFehlende Datenpunkte:\n${ask}`
      const research = web ? `\n\nRecherchiere im Internet: Suche das Produkt über Hersteller, Typ-/Artikelnummer, EAN/GTIN und SKU (Herstellerseite, Datenblatt, Katalog, Händler). Nimm nur Werte, die du dort findest; nenne je Datenpunkt die Quelle (url) in "source". Was du nicht findest, lässt du weg. Antworte nur mit dem JSON-Objekt, ohne Text davor oder danach.` : ''
      try {
        // node.external aus der vollständigen Knotenansicht (nur bei Websuche)
        let ids = ''
        if (web) {
          try { const view = await api.get(`/api/nodes/${encodeURIComponent(nodeId)}`); ids = Object.entries(view.external ?? {}).map(([k, v]) => `${k}: ${v}`).join(', ') } catch { /* egal */ }
        }
        const j = await ai.ask({ system: system + research, user: user + (ids ? `\nKennungen: ${ids}` : ''), json: true, maxTokens: web ? 3000 : 1500, web, maxSearches: 6, purpose: t('Anreicherung') })
        const src = ai.lastSources
        for (const f of kn.fehlend) {
          const s = j?.[f.attrKey]
          if (s && s.value != null && s.value !== '') {
            st.ergebnis.push({ nodeId, nodeLabel: kn.nodeLabel, attrKey: f.attrKey, attrLabel: f.attrLabel, attrDef: f.attrDef, value: String(s.value), confidence: s.confidence ?? null, why: s.why ?? '', url: s.source ?? src[0]?.url ?? null, source: web ? 'web' : 'ai', sources: src })
          }
        }
      } catch (e) {
        st.ergebnis.push({ nodeId, nodeLabel: kn.nodeLabel, attrKey: '', attrLabel: '', value: '', confidence: null, why: '✗ ' + e.message, url: null, source: 'ai', error: true })
      }
    }
    st.laufend = false; drawAuswahl()
  }

  // 6. Ergebnistabelle
  function drawErgebnis() {
    const erg = el('div', { style: 'margin-top:16px' })
    erg.append(el('b', {}, t('{0} Ergebnisse', [st.ergebnis.filter(e => !e.error).length])))
    if (!st.ergebnis.length) { body.append(erg); return }
    // sortiert nach Konfidenz absteigend
    const sorted = [...st.ergebnis].sort((a, b) => (b.confidence ?? -1) - (a.confidence ?? -1))
    const tbl = el('table', { class: 'grid', style: 'width:100%;margin-top:6px' },
      el('thead', {}, el('tr', {},
        el('th', { style: 'width:28px' }, ''),
        el('th', { style: 'width:200px' }, t('Knoten')),
        el('th', { style: 'width:180px' }, t('Attribut')),
        el('th', { style: 'width:200px' }, t('Vorschlag')),
        el('th', { style: 'width:50px' }, ''),
        el('th', {}, t('Quelle')))))
    const tb = el('tbody'); tbl.append(tb)
    const take = new Set(sorted.filter(s => !s.error && (s.confidence == null || s.confidence >= 0.7)))
    for (const s of sorted) {
      const cb = el('input', { type: 'checkbox' }); cb.checked = take.has(s); cb.disabled = !!s.error; cb.addEventListener('change', () => { cb.checked ? take.add(s) : take.delete(s) })
      const val = s.error ? null : el('input', { type: 'text', value: s.value, style: 'width:100%' }); val?.addEventListener('input', () => { s.value = val.value })
      const quellText = s.source === 'web' ? `⌕ ${s.confidence != null ? Math.round(s.confidence * 100) + ' %' : ''}` : s.source === 'ai' ? `✦ ${s.confidence != null ? Math.round(s.confidence * 100) + ' %' : ''}` : s.source === 'manuell' ? '⌕' : ''
      tb.append(el('tr', { class: s.error ? 'neg' : '' },
        el('td', {}, cb),
        el('td', {}, s.nodeLabel),
        el('td', {}, s.attrLabel),
        el('td', {}, s.error ? '' : val),
        el('td', { class: s.source === 'manuell' ? 'muted' : 'ai', style: 'font-size:11px' }, quellText),
        el('td', { class: 'muted', style: 'font-size:12px;white-space:normal' },
          s.source === 'manuell' ? el('a', { href: s.url, target: '_blank', title: s.suchbegriff }, t('⌕ Suchen')) : s.why,
          s.url && s.source !== 'manuell' ? el('a', { href: s.url, target: '_blank', style: 'margin-left:6px', title: s.url }, t('↗ Quelle')) : null)))
    }
    erg.append(tbl)
    // Manuell: Eingabefelder stehen leer, der Anwender tippt nach der Recherche den Wert
    if (st.modus === 'manuell') {
      erg.append(el('div', { class: 'muted', style: 'font-size:12px;margin-top:4px' }, t('Suchlink öffnen, Wert finden, hier eintragen')))
    }
    // Übernehmen
    erg.append(el('div', { class: 'chips', style: 'margin-top:8px' }, el('button', { class: 'primary', onclick: async () => {
      const chosen = [...take].filter(s => s.value && !s.error)
      if (!chosen.length) return
      const ok = await dialog.confirm({ title: t('{0} Werte übernehmen?', [chosen.length]), warn: t('{0} Attributwerte als ein Stapel ins Journal', [chosen.length]), list: chosen.slice(0, 8).map(s => `${s.nodeLabel} · ${s.attrLabel} = ${s.value}`), ok: t('Übernehmen') })
      if (!ok) return
      await uebernehmen(chosen)
    } }, t('Angehakte übernehmen'))))
    body.append(erg)
  }

  // 7. Werte ins Journal schreiben
  async function uebernehmen(chosen) {
    const today = new Date().toISOString().slice(0, 10)
    const commands = chosen.flatMap(s => {
      const def = s.attrDef || model.attributes.find(a => a.key === s.attrKey)
      if (!def) return []
      const loc = def.perLocale ? locale : null
      const source = s.url ?? (s.source === 'ai' ? `KI (${ai.label()})` : s.source === 'web' ? t('Recherche ({0})', [ai.label()]) : t('manuell'))
      return [
        { op: 'attribute.set', args: { node: s.nodeId, attribute: def.key, locale: loc, value: s.value } },
        { op: 'value.source', args: { node: s.nodeId, attribute: def.key, locale: loc, source, title: s.url ? (s.why || null) : null, note: s.confidence != null ? t('Sicherheit {0} %', [Math.round(s.confidence * 100)]) : null, method: s.source === 'manuell' ? 'manual' : s.source === 'web' ? 'web' : 'ai', checkedAt: today } }
      ]
    })
    if (!commands.length) return
    try {
      const res = await api.post('/api/batch', { commands, batch: 'enrich-' + Date.now().toString(36) })
      store.toast(t('✓ {0} Werte geschrieben', [res?.results?.length ?? 0]))
      await store.poll(true)
      await ladeTeilbaum()
    } catch (e) { store.toast(e.message) }
  }

  drawToolbar()
  await ladeTeilbaum()
  // aus dem Knoten-Menü (?run=1)
  if (new URLSearchParams(location.search).get('run') === '1') { history.replaceState(null, '', location.pathname) }
  return () => {}
}

export default {
  views: [{ path: 'enrich', label: t('Anreicherung'), icon: '⌕', topic: 'analysis', hint: t('Fehlende Attributwerte finden — aus KI, Websuche oder manuell — und übernehmen'), mount }],
  nodeActions: [{ label: t('Anreichern'), icon: '⌕', topic: 'analysis', roles: ['group', 'product'], run(id, ctx) { localStorage.setItem('journali.cmp.enrich.root', id); ctx.go?.('/p/enrich/enrich?run=1') } }],
}
