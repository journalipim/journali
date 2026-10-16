#!/usr/bin/env node
// Blog und Seiten auf der WordPress-Seite (04.10.2026): Beiträge aus blog/*.md und Seiten aus HTML als Entwurf anlegen. Veröffentlicht wird in WordPress,
// nicht hier — dort kommen Screenshots dazu. Die Ausgaben sind englisch wie die Konsole des Servers. Beschreibung: blog/README.md.
//
//   node tools/blog.mjs check                     Anmeldung prüfen
//   node tools/blog.mjs draft blog/<datei>.md     Beitrag als Entwurf anlegen; die Nummer des Beitrags steht danach in der Datei (wp: …)
//   node tools/blog.mjs draft <datei> --replace   einen Entwurf neu schreiben — was in WordPress daran geändert wurde, ist dann weg
//   node tools/blog.mjs update <datei>.md [--dry] [--from <rev>]
//                                                 einen veröffentlichten oder geplanten Beitrag neu schreiben (Titel, Auszug, Inhalt) — nur,
//                                                 wenn er in WordPress dem letzten Stand entspricht: dem Abgleich in blog/wp-beitraege.json,
//                                                 sonst der Datei in git (<rev>, sonst HEAD); --dry zeigt nur, was sich ändert
//   node tools/blog.mjs ld <datei>.md […] [--dry]  nur die strukturierten Daten (JSON-LD) eines Beitrags setzen — der übrige Inhalt bleibt, wie er in
//                                                 WordPress ist (auch eingefügte Bilder); Titel, Auszug und Datum kommen aus WordPress
//   node tools/blog.mjs page site/index.html      eine HTML-Seite als Entwurfsseite: der Inhalt von <main> in <div class="jx">, in einem Block
//                                                 „Individuelles HTML“ — ohne eigenes CSS, das steht einmal im CSS-Plugin
//   node tools/blog.mjs page <datei.html> --blocks [--section <id>] [--title <t>] [--slug <s>]
//                                                 als Blöcke des Editors (Überschriften, Absätze, Listen) — zum Ändern in WordPress; --section nimmt den
//                                                 Abschnitt ab der Überschrift 2 mit dieser id bis zur nächsten, ihr Text wird der Titel
//                                                 Ein zweiter Aufruf aktualisiert die Seite — nur, wenn sie in WordPress seit dem letzten Aufruf unverändert ist
//                                                 (Nummer und Hash je Datei und Abschnitt in wp-seiten.json neben der Datei)
//   node tools/blog.mjs css site/index.html       das CSS der Seite nach site/wordpress.css, jede Regel unter .jx — der Inhalt kommt einmal ins CSS-Plugin
//   node tools/blog.mjs tags blog/<datei>.md      nur Schlagwörter und Kategorien aus dem Kopf übernehmen — der Inhalt bleibt, auch veröffentlicht
//   node tools/blog.mjs drafts                    die Entwürfe auflisten
//
// Zugang: ein Anwendungspasswort aus WordPress (Benutzer → Profil → Anwendungspasswörter), nie im Repo. Er steht in
// %USERPROFILE%\.journali\wordpress.json — { "url": "https://…", "user": "…", "password": "xxxx xxxx …" } — oder in den Umgebungsvariablen
// JOURNALI_WP_URL, JOURNALI_WP_USER, JOURNALI_WP_PASSWORD (sie gehen vor).
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

// ---------------------------------------------------------------- Kopf der Datei (front matter)

/// „---“-Kopf lesen: einfache Zeilen „schlüssel: wert“, Listen als [a, b]
export function kopfLesen(text) {
  const t = text.replace(/\r\n/g, '\n')
  const m = t.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!m) return { kopf: {}, rumpf: t }
  const kopf = {}
  for (const zeile of m[1].split('\n')) {
    const z = zeile.match(/^([A-Za-z_][\w-]*):\s*(.*)$/)
    if (!z) continue
    let v = z[2].trim()
    if (/^\[.*\]$/.test(v)) v = v.slice(1, -1).split(',').map(x => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
    else v = v.replace(/^["']|["']$/g, '')
    kopf[z[1]] = v
  }
  return { kopf, rumpf: t.slice(m[0].length) }
}

/// Einen Schlüssel im Kopf setzen (oder anhängen) — der Rest der Datei bleibt, wie er ist
export function kopfSetzen(text, schluessel, wert) {
  const crlf = text.includes('\r\n')
  let t = text.replace(/\r\n/g, '\n')
  const m = t.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!m) t = `---\n${schluessel}: ${wert}\n---\n` + t
  else {
    const zeilen = m[1].split('\n')
    const i = zeilen.findIndex(z => z.startsWith(schluessel + ':'))
    if (i >= 0) zeilen[i] = `${schluessel}: ${wert}`; else zeilen.push(`${schluessel}: ${wert}`)
    t = `---\n${zeilen.join('\n')}\n---\n` + t.slice(m[0].length)
  }
  return crlf ? t.replace(/\n/g, '\r\n') : t
}

// ---------------------------------------------------------------- Markdown → Blöcke des Editors

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const attr = s => esc(s).replace(/"/g, '&quot;')

/// Inline: `Code`, **fett**, *kursiv* / _kursiv_, [Text](Adresse)
export function inline(s) {
  const codes = []
  let t = s.replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`)
  t = esc(t)
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, txt, url) => `<a href="${url.replace(/"/g, '&quot;')}">${txt}</a>`)   // die Adresse ist schon maskiert
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  t = t.replace(/(^|[^\w*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>').replace(/(^|[^\w])_([^_\s][^_]*)_(?!\w)/g, '$1<em>$2</em>')
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[+i])}</code>`)
}

const absatz = html => `<!-- wp:paragraph -->\n<p>${html}</p>\n<!-- /wp:paragraph -->`
/// Der Hinweis unter einem Fachartikel steht in kleiner Schrift (README, 05.10.2026) — so, wie WordPress den Block schreibt
export const KI_HINWEIS = '*Erstellt mit Unterstützung von KI.*'
const KLEIN = '<!-- wp:paragraph {"fontSize":"small"} -->\n<p class="has-small-font-size">'
const klein = html => `${KLEIN}${html}</p>\n<!-- /wp:paragraph -->`

function ueberschrift(level, html) {
  const a = level === 2 ? '' : ` {"level":${level}}`
  return `<!-- wp:heading${a} -->\n<h${level} class="wp-block-heading">${html}</h${level}>\n<!-- /wp:heading -->`
}

function liste(punkte, nummeriert) {
  const tag = nummeriert ? 'ol' : 'ul'
  const li = punkte.map(p => `<!-- wp:list-item -->\n<li>${inline(p)}</li>\n<!-- /wp:list-item -->`).join('\n')
  return `<!-- wp:list${nummeriert ? ' {"ordered":true}' : ''} -->\n<${tag} class="wp-block-list">${li}</${tag}>\n<!-- /wp:list -->`
}

/// Ein Bild: mit Adresse ein Bildblock, ohne („![Screenshot: …]()“) ein leerer Bildblock zum Hochladen und darüber, was hinein soll
function bild(alt, url) {
  if (url) return `<!-- wp:image -->\n<figure class="wp-block-image"><img src="${attr(url)}" alt="${attr(alt)}"/></figure>\n<!-- /wp:image -->`
  return `<!-- wp:paragraph {"className":"screenshot-hinweis"} -->\n<p class="screenshot-hinweis"><em>${esc(alt)}</em></p>\n<!-- /wp:paragraph -->\n\n<!-- wp:image /-->`
}

function tabelle(zeilen) {
  const zellen = z => z.replace(/^\||\|$/g, '').split('|').map(x => x.trim())
  const kopf = zellen(zeilen[0]), rumpf = zeilen.slice(2).map(zellen)
  const th = kopf.map(k => `<th>${inline(k)}</th>`).join('')
  const tr = rumpf.map(r => `<tr>${r.map(x => `<td>${inline(x)}</td>`).join('')}</tr>`).join('')
  return `<!-- wp:table -->\n<figure class="wp-block-table"><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></figure>\n<!-- /wp:table -->`
}

/// Markdown in Blöcke: Überschriften, Absätze, Listen, Code, Zitate, Trennlinien, Bilder, Tabellen
export function bloecke(md) {
  const zeilen = md.replace(/\r\n/g, '\n').split('\n')
  const out = []
  let i = 0
  const leer = z => z.trim() === ''
  while (i < zeilen.length) {
    const z = zeilen[i]
    if (leer(z)) { i++; continue }
    let m
    if (/^```/.test(z)) {
      const code = []; i++
      while (i < zeilen.length && !/^```/.test(zeilen[i])) code.push(zeilen[i++])
      i++
      out.push(`<!-- wp:code -->\n<pre class="wp-block-code"><code>${esc(code.join('\n'))}</code></pre>\n<!-- /wp:code -->`)
    } else if ((m = z.match(/^(#{1,6})\s+(.*)$/))) {
      out.push(ueberschrift(Math.max(2, m[1].length), inline(m[2].trim()))); i++   // # wird h2: der Titel des Beitrags ist schon h1
    } else if (/^(-{3,}|\*{3,})\s*$/.test(z)) {
      out.push('<!-- wp:separator -->\n<hr class="wp-block-separator has-alpha-channel-opacity"/>\n<!-- /wp:separator -->'); i++
    } else if ((m = z.match(/^!\[([^\]]*)\]\(([^)]*)\)\s*$/))) {
      out.push(bild(m[1], m[2].trim())); i++
    } else if (/^\s*[-*+]\s+/.test(z) || /^\s*\d+[.)]\s+/.test(z)) {
      const nummeriert = /^\s*\d+[.)]\s+/.test(z)
      const muster = nummeriert ? /^\s*\d+[.)]\s+/ : /^\s*[-*+]\s+/
      const punkte = []
      while (i < zeilen.length && muster.test(zeilen[i])) punkte.push(zeilen[i++].replace(muster, ''))
      out.push(liste(punkte, nummeriert))
    } else if (/^>/.test(z)) {
      const teile = []
      while (i < zeilen.length && /^>/.test(zeilen[i])) teile.push(zeilen[i++].replace(/^>\s?/, ''))
      const absaetze = teile.join('\n').split(/\n\s*\n/).map(a => absatz(inline(a.replace(/\n/g, ' ').trim()))).join('\n\n')
      out.push(`<!-- wp:quote -->\n<blockquote class="wp-block-quote">${absaetze}</blockquote>\n<!-- /wp:quote -->`)
    } else if (/^\|.*\|\s*$/.test(z) && /^\|?\s*:?-{3,}/.test(zeilen[i + 1] ?? '')) {
      const t = []
      while (i < zeilen.length && /^\|.*\|\s*$/.test(zeilen[i])) t.push(zeilen[i++])
      out.push(tabelle(t))
    } else {
      const teile = []
      while (i < zeilen.length && !leer(zeilen[i]) && !/^(#{1,6}\s|```|>|\s*[-*+]\s|\s*\d+[.)]\s|!\[)/.test(zeilen[i])) teile.push(zeilen[i++].trim())
      if (teile.length === 0) teile.push(zeilen[i++].trim())
      const roh = teile.join(' ')
      out.push(roh === KI_HINWEIS ? klein(inline(roh)) : absatz(inline(roh)))
    }
  }
  return out.join('\n\n')
}

// ---------------------------------------------------------------- strukturierte Daten (16.10.2026)

/// Markdown als Klartext: Verweise werden ihr Text, Auszeichnung fällt weg
export const klartext = md => md.replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/(^|[^\w*])\*([^*\s][^*]*)\*/g, '$1$2')
  .replace(/`([^`]+)`/g, '$1').replace(/\s+/g, ' ').trim()

/// Die Zeilen eines Abschnitts: ab der Überschrift 2 mit diesem Text bis vor die nächste Überschrift 1 oder 2
function abschnittMd(md, titel) {
  const zeilen = md.replace(/\r\n/g, '\n').split('\n')
  const start = zeilen.findIndex(z => new RegExp(`^#{1,2}\\s+${titel}\\s*$`, 'i').test(z))
  if (start < 0) return []
  const rest = zeilen.slice(start + 1)
  const ende = rest.findIndex(z => /^#{1,2}\s/.test(z))
  return ende < 0 ? rest : rest.slice(0, ende)
}

/// Die häufigen Fragen eines Beitrags: im Abschnitt „## Häufige Fragen“ je „### Frage“ der Absatz darunter als Antwort
export function haeufigeFragen(md) {
  const aus = []
  const zeilen = abschnittMd(md, 'Häufige Fragen')
  for (let i = 0; i < zeilen.length; i++) {
    const m = zeilen[i].match(/^###\s+(.*)$/)
    if (!m) continue
    let j = i + 1
    while (j < zeilen.length && !zeilen[j].trim()) j++
    const absatzZeilen = []
    while (j < zeilen.length && zeilen[j].trim() && !/^#{1,6}\s/.test(zeilen[j])) absatzZeilen.push(zeilen[j++])
    if (absatzZeilen.length) aus.push({ frage: klartext(m[1]), antwort: klartext(absatzZeilen.join(' ')) })
  }
  return aus
}

/// Die Adressen im Abschnitt „## Quellen“
export const quellen = md => [...new Set(abschnittMd(md, 'Quellen').join('\n').match(/https?:\/\/[^\s)\]]+/g) ?? [])]

/// Ein Fachartikel (Kategorie Wissen) bekommt strukturierte Daten
export const istWissen = kopf => [].concat(kopf.categories ?? []).includes('Wissen')

/// Die strukturierten Daten eines Fachartikels als Block (JSON-LD): Article mit Titel, Beschreibung, Sprache, Daten, Herausgeber, Schlagwörtern
/// und Quellen; dazu FAQPage aus „Häufige Fragen“ — Suchmaschinen und KI lesen Frage und Antwort daraus, ohne die Seite deuten zu müssen
export function strukturierteDaten(kopf, rumpf, { url = null, veroeffentlicht = null, geaendert = null, site = 'https://journali.de' } = {}) {
  const rubrik = [].concat(kopf.categories ?? [])[0] ?? null
  const org = { '@type': 'Organization', name: 'journali', url: site.replace(/\/+$/, '') + '/' }
  const schlag = [].concat(kopf.tags ?? []), q = quellen(rumpf), fragen = haeufigeFragen(rumpf)
  const artikel = {
    '@type': istWissen(kopf) ? 'Article' : 'BlogPosting', headline: kopf.title, ...(kopf.excerpt ? { description: kopf.excerpt } : {}), inLanguage: 'de-DE',
    ...(veroeffentlicht ? { datePublished: veroeffentlicht } : {}), ...(geaendert ? { dateModified: geaendert } : {}),
    author: org, publisher: org, ...(url ? { url, mainEntityOfPage: url } : {}),
    ...(schlag.length ? { keywords: schlag.join(', ') } : {}), ...(rubrik ? { articleSection: rubrik } : {}), ...(q.length ? { citation: q } : {}),
  }
  const graph = [artikel]
  if (fragen.length) graph.push({ '@type': 'FAQPage', ...(url ? { url } : {}), mainEntity: fragen.map(f => ({ '@type': 'Question', name: f.frage, acceptedAnswer: { '@type': 'Answer', text: f.antwort } })) })
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')   // kein </script> im Text
  return `<!-- wp:html -->\n<script type="application/ld+json">${json}</script>\n<!-- /wp:html -->`
}

/// Die Adresse eines Beitrags aus Datum und Slug (Permalinks /JJJJ/MM/TT/slug/)
const adresse = (site, datum, slug) => datum && slug ? `${site.replace(/\/+$/, '')}/${datum.slice(0, 4)}/${datum.slice(5, 7)}/${datum.slice(8, 10)}/${slug}/` : null

/// Der Inhalt eines Beitrags: Blöcke, bei einem Fachartikel dazu die strukturierten Daten
export function beitragsInhalt(kopf, rumpf, daten = {}) {
  const html = bloecke(rumpf)
  return istWissen(kopf) ? `${html}\n\n${strukturierteDaten(kopf, rumpf, daten)}` : html
}

/// Die strukturierten Daten am Ende eines Inhalts — der Block, den das Werkzeug anhängt
const DATEN_AM_ENDE = /\s*<!-- wp:html -->\n<script type="application\/ld\+json">[\s\S]*?<\/script>\n<!-- \/wp:html -->\s*$/

/// Vergleichbar machen: ohne die strukturierten Daten am Ende, kleine Schrift wie ein Absatz — beides setzt das Werkzeug selbst
const vergleichbar = s => s.replace(/\r\n/g, '\n').replace(DATEN_AM_ENDE, '')
  .split(KLEIN).join('<!-- wp:paragraph -->\n<p>').trimEnd()


/**
 * Nur die strukturierten Daten eines Beitrags setzen (16.10.2026): der Block am Ende wird angehängt oder ersetzt, alles andere bleibt Byte für
 * Byte, wie es in WordPress steht — auch dort eingefügte Bilder. Titel, Auszug, Datum und Adresse nimmt es aus WordPress, Schlagwörter,
 * Rubrik, häufige Fragen und Quellen aus der Datei.
 */
export async function datenSetzen(api, z, text, { probe = false, jetzt = new Date() } = {}) {
  const { kopf, rumpf } = kopfLesen(text)
  if (!kopf.wp) throw new Error('wp missing in the front matter — the post does not exist yet')
  const da = await api('GET', `posts/${kopf.wp}?context=edit`)
  const crlf = da.content.raw.includes('\r\n')
  const ohne = da.content.raw.replace(/\r\n/g, '\n').replace(DATEN_AM_ENDE, '')
  const url = da.status === 'publish' && da.link && !/\?p=\d+/.test(da.link) ? da.link : adresse(z.url, da.date, da.slug || da.generated_slug)
  const block = strukturierteDaten({ ...kopf, title: da.title.raw || kopf.title, excerpt: da.excerpt.raw || kopf.excerpt }, rumpf,
    { url, veroeffentlicht: da.status === 'draft' ? null : (da.date_gmt ? da.date_gmt + 'Z' : da.date), geaendert: jetzt.toISOString().slice(0, 19) + 'Z', site: z.url })
  let inhalt = `${ohne.trimEnd()}\n\n${block}`
  if (crlf) inhalt = inhalt.replace(/\n/g, '\r\n')
  const r = { id: +kopf.wp, status: da.status, url, vorher: DATEN_AM_ENDE.test(da.content.raw.replace(/\r\n/g, '\n')), fragen: haeufigeFragen(rumpf).length }
  if (probe) return { ...r, probe: true }
  await api('POST', `posts/${kopf.wp}`, { content: inhalt })
  return r
}

/**
 * Einen veröffentlichten oder geplanten Beitrag neu schreiben: Titel, Auszug, Inhalt — Status, Datum, Slug und Schlagwörter bleiben.
 * Nur, wenn er in WordPress dem letzten Stand entspricht: dem Hash aus dem Abgleich (stand), sonst dem Inhalt aus `vorher` (die Datei in git).
 * Liefert, was sich ändert, und den neuen Abgleich; mit probe schreibt es nichts.
 */
export async function aktualisieren(api, z, text, { vorher = null, stand = null, probe = false, jetzt = new Date() } = {}) {
  const { kopf, rumpf } = kopfLesen(text)
  if (!kopf.wp) throw new Error('wp missing in the front matter — the post does not exist yet, use draft')
  const da = await api('GET', `posts/${kopf.wp}?context=edit`)
  if (da.status === 'draft') throw new Error(`post ${kopf.wp} is a draft — use draft --replace`)
  const live = vergleichbar(da.content.raw)
  const gleich = stand ? hash(live) === stand : vorher !== null && live === vergleichbar(bloecke(kopfLesen(vorher).rumpf))
  if (!gleich) throw new Error(`post ${kopf.wp} was changed in WordPress since the last version — not overwritten`)
  const url = da.status === 'publish' && da.link && !/\?p=\d+/.test(da.link) ? da.link : adresse(z.url, da.date, da.slug || da.generated_slug)
  const inhalt = beitragsInhalt(kopf, rumpf, { url, veroeffentlicht: da.date_gmt ? da.date_gmt + 'Z' : da.date, geaendert: jetzt.toISOString().slice(0, 19) + 'Z', site: z.url })
  const aenderung = {
    id: +kopf.wp, status: da.status, url, titel: da.title.raw === kopf.title ? null : [da.title.raw, kopf.title],
    auszug: (da.excerpt.raw ?? '') !== (kopf.excerpt ?? ''), fragen: haeufigeFragen(rumpf).length, zeichen: [da.content.raw.length, inhalt.length],
  }
  if (probe) return { ...aenderung, probe: true }
  const p = await api('POST', `posts/${kopf.wp}`, { title: kopf.title, content: inhalt, ...(kopf.excerpt ? { excerpt: kopf.excerpt } : {}) })
  return { ...aenderung, status: p.status, stand: hash(vergleichbar(p.content?.raw ?? inhalt)) }
}

// ---------------------------------------------------------------- Seiten und ihr CSS

/// Der Rahmen aller eigenen Seiten: ihre Regeln im CSS-Plugin gelten nur darin und berühren das Theme nicht
export const RAHMEN = 'jx'

/// Eine HTML-Seite als ein Block „Individuelles HTML“: der Inhalt von main (sonst body) in <div class="jx"><div class="inhalt"> — ein zweites <main> gehört
/// nicht in die Seite des Themes, die Regeln für main gelten darum für .inhalt —, dazu JSON-LD. Kopf und Fuß der Seite
/// fallen weg — die bringt das Theme —, ebenso eigenes CSS (steht im CSS-Plugin) und Skripte. Relative Adressen gelten ab der Wurzel der Seite.
/// Ein Abschnitt einer HTML-Datei: ab der Überschrift 2 mit dieser id bis vor die nächste Überschrift 2 — ohne die Überschrift selbst, ihr Text ist der Titel
export function abschnitt(html, id) {
  const start = html.search(new RegExp(`<h2[^>]*\\bid="${id}"[^>]*>`, 'i'))
  if (start < 0) throw new Error(`no <h2 id="${id}">`)
  const kopf = html.slice(start).match(/^<h2[^>]*>([\s\S]*?)<\/h2>/i)
  const rest = html.slice(start + kopf[0].length)
  const ende = rest.search(/<h2\b/i)
  return { titel: kopf[1].replace(/<[^>]+>/g, '').trim(), html: ende < 0 ? rest : rest.slice(0, ende) }
}

/// Einfaches HTML in Blöcke des Editors: Überschriften, Absätze, Listen. Inline-HTML (Verweise, fett) bleibt, wie es ist; anderes (Skripte, Verweis
/// „zurück“ außerhalb eines Absatzes) fällt weg.
export function htmlBloecke(html) {
  const out = []
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html
  for (const m of body.matchAll(/<(h[1-6]|p|ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const tag = m[1].toLowerCase(), innen = m[2].trim()
    if (tag[0] === 'h') out.push(ueberschrift(Math.max(2, +tag[1]), innen))
    else if (tag === 'p') { if (innen) out.push(absatz(innen)) }
    else {
      const li = [...innen.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(x => `<!-- wp:list-item -->\n<li>${x[1].trim()}</li>\n<!-- /wp:list-item -->`).join('\n')
      out.push(`<!-- wp:list${tag === 'ol' ? ' {"ordered":true}' : ''} -->\n<${tag} class="wp-block-list">${li}</${tag}>\n<!-- /wp:list -->`)
    }
  }
  return out.join('\n\n')
}

export function seitenBlock(html) {
  const titel = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? 'Seite'
  const ld = [...html.matchAll(/<script type="application\/ld\+json">[\s\S]*?<\/script>/gi)].map(m => m[0]).join('\n')
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html
  let inhalt = (body.match(/<main[^>]*>([\s\S]*)<\/main>/i)?.[1] ?? body)
    .replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').trim()
  inhalt = inhalt.replace(/\b(src|href)="(?![a-z][\w+.-]*:|\/|#)([^"]+)"/gi, '$1="/$2"')
  return { titel, inhalt: `<!-- wp:html -->\n${[ld, `<div class="${RAHMEN}"><div class="inhalt">\n${inhalt}\n</div></div>`].filter(Boolean).join('\n')}\n<!-- /wp:html -->` }
}

/// Das CSS einer Seite unter .jx: :root, html und body werden .jx, main wird .inhalt (siehe seitenBlock), jeder andere Selektor bekommt .jx davor. Der dunkle Modus fällt weg — hell oder dunkel
/// entscheidet das Theme, sonst stünde eine dunkle Seite in einem hellen Rahmen.
export function cssUnter(css, rahmen = '.' + RAHMEN) {
  const sel = s => s.split(',').map(x => x.trim()).filter(Boolean).map(x => {
    if (/^(:root|html|body)$/.test(x)) return rahmen
    if (/^(html|body)\s+/.test(x)) return x.replace(/^(html|body)\s+/, rahmen + ' ')
    return `${rahmen} ${x.replace(/^main\b/, '.inhalt')}`
  }).join(', ')
  css = css.replace(/\/\*[\s\S]*?\*\//g, '')
  let out = '', i = 0
  while (i < css.length) {
    const auf = css.indexOf('{', i)
    if (auf < 0) break
    const kopf = css.slice(i, auf).trim()
    let tiefe = 1, j = auf + 1   // den passenden Schluss finden, auch verschachtelt (@media)
    while (j < css.length && tiefe > 0) { if (css[j] === '{') tiefe++; else if (css[j] === '}') tiefe--; j++ }
    const innen = css.slice(auf + 1, j - 1)
    if (/^@media[^{]*prefers-color-scheme:\s*dark/i.test(kopf)) { /* weg */ }
    else if (/^@media/i.test(kopf)) out += `${kopf} {\n${cssUnter(innen, rahmen).replace(/^/gm, '  ')}\n}\n`
    else if (/^@/.test(kopf)) out += `${kopf} {${innen}}\n`
    else out += `${sel(kopf)} {${innen}}\n`
    i = j
  }
  return out.trim()
}

// ---------------------------------------------------------------- Stand der Seiten: welche Seite aus welcher Datei, mit welchem Inhalt

export const hash = s => crypto.createHash('sha256').update(s.replace(/\r\n/g, '\n')).digest('hex').slice(0, 16)

/// Eine Seite anlegen oder aktualisieren. Aktualisiert wird nur, wenn ihr Inhalt in WordPress noch der ist, den das Werkzeug zuletzt geschrieben hat —
/// sonst wurde sie dort bearbeitet, und das Werkzeug überschriebe es. Liefert { id, neu, stand } (stand: der neue Eintrag für wp-seiten.json).
export async function seite(api, eintrag, { titel, inhalt, slug }) {
  if (eintrag?.id) {
    const da = await api('GET', `pages/${eintrag.id}?context=edit`)
    if (hash(da.content.raw) !== eintrag.hash) throw new Error(`page ${eintrag.id} was changed in WordPress — not overwritten`)
    if (hash(inhalt) === eintrag.hash) return { id: eintrag.id, neu: false, unveraendert: true, stand: eintrag }
    const p = await api('POST', `pages/${eintrag.id}`, { content: inhalt })
    return { id: p.id, neu: false, stand: { id: p.id, hash: hash(p.content?.raw ?? inhalt) } }
  }
  const p = await api('POST', 'pages', { title: titel, content: inhalt, status: 'draft', ...(slug ? { slug } : {}) })
  return { id: p.id, neu: true, stand: { id: p.id, hash: hash(p.content?.raw ?? inhalt) } }
}

// ---------------------------------------------------------------- WordPress

export function zugang(env = process.env, home = os.homedir()) {
  let datei = {}
  const pfad = path.join(home, '.journali', 'wordpress.json')
  try { datei = JSON.parse(fs.readFileSync(pfad, 'utf8')) } catch { }
  const z = { url: env.JOURNALI_WP_URL ?? datei.url, user: env.JOURNALI_WP_USER ?? datei.user, password: env.JOURNALI_WP_PASSWORD ?? datei.password }
  if (!z.url || !z.user || !z.password) throw new Error(`no access: ${pfad} with url, user and password (an application password from WordPress), or JOURNALI_WP_URL/_USER/_PASSWORD`)
  z.url = z.url.replace(/\/+$/, '')
  return z
}

export function wp(z, f = globalThis.fetch) {
  const auth = 'Basic ' + Buffer.from(`${z.user}:${z.password}`).toString('base64')
  return async (methode, pfad, body) => {
    const res = await f(`${z.url}/wp-json/wp/v2/${pfad}`, {
      method: methode, headers: { Authorization: auth, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await res.text()
    let json; try { json = JSON.parse(text) } catch { json = null }
    if (!res.ok) throw new Error(`${methode} ${pfad}: ${res.status} ${json?.message ?? text.slice(0, 200)}`)
    return json
  }
}

/// Schlagwörter oder Kategorien nach Namen — was fehlt, wird angelegt
async function begriffe(api, art, namen) {
  const ids = []
  for (const name of [].concat(namen ?? []).filter(Boolean)) {
    // WordPress liefert Namen maskiert („Import &amp; Export“) — verglichen wird der Klartext
    const klar = n => n.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").toLowerCase()
    const da = (await api('GET', `${art}?search=${encodeURIComponent(name.split(/[&<>"']/)[0].trim() || name)}&per_page=100`)).find(t => klar(t.name) === klar(name))   // gesucht wird ohne Sonderzeichen: WordPress sucht im maskierten Namen
    ids.push(da ? da.id : (await api('POST', art, { name })).id)
  }
  return ids
}

/// Das Veröffentlichungsdatum aus dem Kopf (`date: 2026-10-07` oder `date: 2026-10-07 14:30`) als Zeit der Seite, wie WordPress sie nimmt (ohne Zone):
/// ein Datum ohne Uhrzeit gilt für 09:00. Ein Entwurf mit Datum bleibt Entwurf; wer ihn in WordPress veröffentlicht, veröffentlicht ihn zu diesem Datum
/// (liegt es in der Zukunft, wird er geplant). Etwas anderes als ein Datum ist ein Fehler.
export function wpDatum(wert) {
  const m = String(wert ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/)
  if (!m) throw new Error(`date "${wert}" is not a date (YYYY-MM-DD or YYYY-MM-DD HH:MM)`)
  const [, j, mo, t, h = '09', mi = '00'] = m
  const d = new Date(Date.UTC(+j, +mo - 1, +t, +h, +mi))
  if (d.getUTCFullYear() !== +j || d.getUTCMonth() !== +mo - 1 || d.getUTCDate() !== +t || +h > 23 || +mi > 59) throw new Error(`date "${wert}" does not exist`)
  return `${j}-${mo}-${t}T${h}:${mi}:00`
}

/// Einen Beitrag als Entwurf anlegen — oder, mit ersetzen, einen Entwurf neu schreiben. Liefert { id, link, edit, text } (text: die Datei mit wp: im Kopf)
export async function entwurf(api, z, text, { ersetzen = false } = {}) {
  const { kopf, rumpf } = kopfLesen(text)
  if (!kopf.title) throw new Error('title missing in the front matter')
  const beitrag = {
    title: kopf.title, content: beitragsInhalt(kopf, rumpf, { veroeffentlicht: kopf.date ? wpDatum(kopf.date) : null, url: adresse(z.url, kopf.date ? wpDatum(kopf.date) : null, kopf.slug), site: z.url }), status: 'draft',
    ...(kopf.excerpt ? { excerpt: kopf.excerpt } : {}), ...(kopf.slug ? { slug: kopf.slug } : {}), ...(kopf.date ? { date: wpDatum(kopf.date) } : {}),
    tags: await begriffe(api, 'tags', kopf.tags), categories: await begriffe(api, 'categories', kopf.categories),
  }
  if (!beitrag.categories.length) delete beitrag.categories
  let p
  if (kopf.wp) {
    const da = await api('GET', `posts/${kopf.wp}?context=edit`)
    if (da.status !== 'draft') throw new Error(`post ${kopf.wp} is ${da.status} — not changed`)
    if (!ersetzen) throw new Error(`post ${kopf.wp} exists as a draft — --replace overwrites what was changed there`)
    p = await api('POST', `posts/${kopf.wp}`, beitrag)
  } else p = await api('POST', 'posts', beitrag)
  return { id: p.id, link: p.link, edit: `${z.url}/wp-admin/post.php?post=${p.id}&action=edit`, text: kopf.wp ? text : kopfSetzen(text, 'wp', p.id) }
}

/// Nur Schlagwörter und Kategorien eines Beitrags setzen (04.10.2026) — der Inhalt bleibt, wie er in WordPress ist, auch bei einem veröffentlichten Beitrag
export async function schlagwoerter(api, text) {
  const { kopf } = kopfLesen(text)
  if (!kopf.wp) throw new Error('wp missing in the front matter — the post does not exist yet')
  const felder = { tags: await begriffe(api, 'tags', kopf.tags), categories: await begriffe(api, 'categories', kopf.categories) }
  if (!felder.categories.length) delete felder.categories
  const p = await api('POST', `posts/${kopf.wp}`, felder)
  return { id: p.id, tags: felder.tags }
}

async function main(argv) {
  const [befehl, datei, ...rest] = argv
  if (befehl === 'css' && datei) {   // braucht keinen Zugang
    const html = fs.readFileSync(datei, 'utf8')
    const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n')
    const ziel = path.join(path.dirname(datei), 'wordpress.css')
    fs.writeFileSync(ziel, `/* journali: Regeln der eigenen Seiten, nur unter .${RAHMEN} — erzeugt mit node tools/blog.mjs css ${datei.replace(/\\/g, '/')} */\n` + cssUnter(css) + '\n')
    console.log(`written: ${ziel} — its content goes into the CSS plugin once`)
    return
  }
  if (!['check', 'draft', 'page', 'drafts', 'tags', 'update', 'ld'].includes(befehl) || (['draft', 'page', 'tags', 'update', 'ld'].includes(befehl) && !datei)) {
    console.log('usage: node tools/blog.mjs check | draft <file.md> [--replace] | update <file.md> [--dry] [--from <rev>] | ld <file.md> [...] [--dry] | tags <file.md> | page <file.html> [--blocks] [--section <id>] [--title <t>] [--slug <s>] [--id <n>] | css <file.html> | drafts')
    process.exitCode = 2
    return
  }
  const z = zugang(); const api = wp(z)
  if (befehl === 'check') {
    const ich = await api('GET', 'users/me?context=edit')
    console.log(`ok: ${z.url} as ${ich.slug} (${(ich.roles ?? []).join(', ')})`)
  } else if (befehl === 'tags') {
    const r = await schlagwoerter(api, fs.readFileSync(datei, 'utf8'))
    console.log(`tags ${r.id}: ${r.tags.length}`)
  } else if (befehl === 'ld') {
    for (const d of [datei, ...rest.filter(x => !x.startsWith('--'))]) {
      const r = await datenSetzen(api, z, fs.readFileSync(d, 'utf8'), { probe: rest.includes('--dry') })
      console.log(`${r.probe ? 'would set' : 'set'} structured data ${r.vorher ? '(replaced)' : '(new)'} post ${r.id} (${r.status}), ${r.fragen} questions: ${r.url ?? ''}`)
    }
  } else if (befehl === 'update') {
    const text = fs.readFileSync(datei, 'utf8')
    const standDatei = path.join(path.dirname(datei), 'wp-beitraege.json')
    let staende = {}; try { staende = JSON.parse(fs.readFileSync(standDatei, 'utf8')) } catch { }
    const { kopf } = kopfLesen(text)
    const ri = rest.indexOf('--from'), rev = ri >= 0 ? rest[ri + 1] : 'HEAD'
    let vorher = null
    if (!staende[kopf.wp]) try { vorher = execFileSync('git', ['show', `${rev}:./${datei.replace(/\\/g, '/')}`], { encoding: 'utf8' }) } catch { }
    const r = await aktualisieren(api, z, text, { vorher, stand: staende[kopf.wp]?.hash ?? null, probe: rest.includes('--dry') })
    console.log(`${r.probe ? 'would update' : 'updated'} post ${r.id} (${r.status}) ${r.url ?? ''}`)
    if (r.titel) console.log(`  title: ${r.titel[0]} -> ${r.titel[1]}`)
    console.log(`  excerpt ${r.auszug ? 'changed' : 'unchanged'}, ${r.fragen} questions, content ${r.zeichen[0]} -> ${r.zeichen[1]} chars`)
    if (!r.probe) { staende[kopf.wp] = { datei: path.basename(datei), hash: r.stand }; fs.writeFileSync(standDatei, JSON.stringify(staende, null, 2) + '\n') }
  } else if (befehl === 'draft') {
    const text = fs.readFileSync(datei, 'utf8')
    const r = await entwurf(api, z, text, { ersetzen: rest.includes('--replace') })
    if (r.text !== text) fs.writeFileSync(datei, r.text)
    console.log(`draft ${r.id}: ${r.edit}`)
  } else if (befehl === 'page') {
    const opt = n => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : undefined }
    const html = fs.readFileSync(datei, 'utf8')
    let titel, inhalt
    if (rest.includes('--blocks')) {
      const teil = opt('--section') ? abschnitt(html, opt('--section')) : { titel: html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? 'Seite', html }
      titel = teil.titel; inhalt = htmlBloecke(teil.html)
    } else ({ titel, inhalt } = seitenBlock(html))
    const standDatei = path.join(path.dirname(datei), 'wp-seiten.json')
    let stand = {}; try { stand = JSON.parse(fs.readFileSync(standDatei, 'utf8')) } catch { }
    const schluessel = path.basename(datei) + (opt('--section') ? '#' + opt('--section') : '')
    // eine Seite von davor übernehmen — nur, wenn sie der Datei entspricht: sonst überschriebe das Werkzeug, was in WordPress an ihr geändert wurde
    if (rest.includes('--id')) {
      const roh = (await api('GET', `pages/${opt('--id')}?context=edit`)).content.raw
      if (hash(roh) !== hash(inhalt)) throw new Error(`page ${opt('--id')} differs from ${schluessel} — not taken over, nothing written`)
      stand[schluessel] = { id: +opt('--id'), hash: hash(roh) }
    }
    const r = await seite(api, stand[schluessel], { titel: opt('--title') ?? titel, inhalt, slug: opt('--slug') })
    stand[schluessel] = r.stand
    fs.writeFileSync(standDatei, JSON.stringify(stand, null, 2) + '\n')
    console.log(`${r.neu ? 'page draft' : r.unveraendert ? 'page unchanged' : 'page updated'} ${r.id}: ${z.url}/wp-admin/post.php?post=${r.id}&action=edit`)
  } else {
    for (const p of await api('GET', 'posts?status=draft&context=edit&per_page=50')) console.log(`${p.id}  ${p.modified}  ${p.title.raw}`)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch(e => { console.error('error: ' + e.message); process.exitCode = 1 })
