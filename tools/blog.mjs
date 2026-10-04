#!/usr/bin/env node
// Blog und Seiten auf der WordPress-Seite (04.10.2026): Beiträge aus blog/*.md und Seiten aus HTML als Entwurf anlegen. Veröffentlicht wird in WordPress,
// nicht hier — dort kommen Screenshots dazu. Die Ausgaben sind englisch wie die Konsole des Servers. Beschreibung: blog/README.md.
//
//   node tools/blog.mjs check                     Anmeldung prüfen
//   node tools/blog.mjs draft blog/<datei>.md     Beitrag als Entwurf anlegen; die Nummer des Beitrags steht danach in der Datei (wp: …)
//   node tools/blog.mjs draft <datei> --replace   einen Entwurf neu schreiben — was in WordPress daran geändert wurde, ist dann weg
//   node tools/blog.mjs page site/index.html      eine HTML-Seite als Entwurfsseite: der Inhalt von <main> in <div class="jx">, in einem Block
//                                                 „Individuelles HTML“ — ohne eigenes CSS, das steht einmal im CSS-Plugin
//   node tools/blog.mjs page <datei.html> --blocks [--section <id>] [--title <t>] [--slug <s>]
//                                                 als Blöcke des Editors (Überschriften, Absätze, Listen) — zum Ändern in WordPress; --section nimmt den
//                                                 Abschnitt ab der Überschrift 2 mit dieser id bis zur nächsten, ihr Text wird der Titel
//   node tools/blog.mjs css site/index.html       das CSS der Seite nach site/wordpress.css, jede Regel unter .jx — der Inhalt kommt einmal ins CSS-Plugin
//   node tools/blog.mjs drafts                    die Entwürfe auflisten
//
// Zugang: ein Anwendungspasswort aus WordPress (Benutzer → Profil → Anwendungspasswörter), nie im Repo. Er steht in
// %USERPROFILE%\.journali\wordpress.json — { "url": "https://…", "user": "…", "password": "xxxx xxxx …" } — oder in den Umgebungsvariablen
// JOURNALI_WP_URL, JOURNALI_WP_USER, JOURNALI_WP_PASSWORD (sie gehen vor).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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
      out.push(absatz(inline(teile.join(' '))))
    }
  }
  return out.join('\n\n')
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
    const da = (await api('GET', `${art}?search=${encodeURIComponent(name)}&per_page=100`)).find(t => t.name.toLowerCase() === name.toLowerCase())
    ids.push(da ? da.id : (await api('POST', art, { name })).id)
  }
  return ids
}

/// Einen Beitrag als Entwurf anlegen — oder, mit ersetzen, einen Entwurf neu schreiben. Liefert { id, link, edit, text } (text: die Datei mit wp: im Kopf)
export async function entwurf(api, z, text, { ersetzen = false } = {}) {
  const { kopf, rumpf } = kopfLesen(text)
  if (!kopf.title) throw new Error('title missing in the front matter')
  const beitrag = {
    title: kopf.title, content: bloecke(rumpf), status: 'draft',
    ...(kopf.excerpt ? { excerpt: kopf.excerpt } : {}), ...(kopf.slug ? { slug: kopf.slug } : {}),
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
  if (!['check', 'draft', 'page', 'drafts'].includes(befehl) || (['draft', 'page'].includes(befehl) && !datei)) {
    console.log('usage: node tools/blog.mjs check | draft <file.md> [--replace] | page <file.html> [--blocks] [--section <id>] [--title <t>] [--slug <s>] | css <file.html> | drafts')
    process.exitCode = 2
    return
  }
  const z = zugang(); const api = wp(z)
  if (befehl === 'check') {
    const ich = await api('GET', 'users/me?context=edit')
    console.log(`ok: ${z.url} as ${ich.slug} (${(ich.roles ?? []).join(', ')})`)
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
    const p = await api('POST', 'pages', { title: opt('--title') ?? titel, content: inhalt, status: 'draft', ...(opt('--slug') ? { slug: opt('--slug') } : {}) })
    console.log(`page draft ${p.id}: ${z.url}/wp-admin/post.php?post=${p.id}&action=edit`)
  } else {
    for (const p of await api('GET', 'posts?status=draft&context=edit&per_page=50')) console.log(`${p.id}  ${p.modified}  ${p.title.raw}`)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch(e => { console.error('error: ' + e.message); process.exitCode = 1 })
