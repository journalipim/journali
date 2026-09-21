<script setup>
// ⇶ Publikation (Taloan, 20.09.2026): links die Publikationsbäume — je Kanal (× Markt) die Maximalstruktur aus Rubriken, darin
// Produktgruppen und Produkte per Verweis (↗); rechts der gewählte Knoten (Rubrik mit ihren Texten, oder der verwiesene
// Pflegeknoten). Ableiten aus dem Pflegebaum als Start, danach frei umbauen: ziehen = Rubrik oder Verweis umhängen,
// Rechtsklick = Rubrik/Verweis/Ableiten/Entfernen (nur aus dem Publikationsbaum — der Pflegebaum bleibt). „nicht einsortiert“ zählt die Produkte, die in diesem Baum nirgends hängen.
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api.js'
import { store } from '../store.js'
import { dialog } from '../dialog.js'
import { tree, icon } from '../tree.js'
import { menu } from '../menu.js'
import NodeView from './NodeView.vue'
import Splitter from '../components/Splitter.vue'
import TreePicker from '../components/TreePicker.vue'
import { paneWidth } from '../panes.js'
const pubW = paneWidth('pub', 340)
const srcW = paneWidth('pubsrc', 300)
// Pflegebaum links einklappbar (Taloan, 21.09.) — Stand gemerkt
const srcOpen = ref(localStorage.getItem('journali.pubsrc.open') !== '0')
watch(srcOpen, v => localStorage.setItem('journali.pubsrc.open', v ? '1' : '0'))
const props = defineProps({ id: String })
const router = useRouter()

const trees = computed(() => tree.pubTrees)
const treeKey = ref(localStorage.getItem('journali.pubtree') || '')
const current = computed(() => trees.value.find(t => t.id === treeKey.value) ?? trees.value[0] ?? null)
watch(current, t => { if (t) { treeKey.value = t.id; localStorage.setItem('journali.pubtree', t.id) } }, { immediate: true })
const expanded = ref(new Set(JSON.parse(localStorage.getItem('journali.pubexpanded') || '[]')))
function toggle(id) { expanded.value.has(id) ? expanded.value.delete(id) : expanded.value.add(id); expanded.value = new Set(expanded.value); localStorage.setItem('journali.pubexpanded', JSON.stringify([...expanded.value])) }

// Zeilen: Rubriken (Kinder im Baum) und darunter ihre Verweise; ein Verweis zeigt den Pflegeknoten, dessen Kinder bleiben zu
const rows = computed(() => {
  const out = []
  const walk = (r, depth) => {
    const isOpen = expanded.value.has(r.id)
    const placed = (r.placed ?? []).map(id => tree.byId.get(id)).filter(Boolean).sort((a, b) => a.label.localeCompare(b.label, 'de'))   // wie im Pflegebaum: nach Name
    const has = tree.kids(r.id).length + placed.length > 0
    out.push({ r, depth, isOpen, has, kind: 'rubric', n: placed.length })
    if (!isOpen) return
    for (const k of tree.kids(r.id)) walk(k, depth + 1)
    // Anzeige (Taloan, 21.09.: 20 Verweise „Ersatzteile“): Anzeigename, sonst Pflegename — und wo Geschwister gleich heissen, der Vater dazu
    const dup = new Set(placed.map(p => p.label).filter((l, i, a) => a.indexOf(l) !== i))
    // Regel-Verweise (Taloan, 21.09.): je Regel eine ⚙-Zeile; aufgeklappt die Gliederungen und Treffer, wie der Server sie auflöst (Rules.cs)
    for (const rule of r.rules ?? []) {
      const ex = expanded.value.has(r.id + '/' + rule.id); const res = ruleResults.value[r.id]?.find(x => x.rule.id === rule.id)?.result
      out.push({ r: { id: r.id + '/' + rule.id, label: ruleLabel(rule) }, depth: depth + 1, kind: 'rule', rubric: r.id, rule, isOpen: ex, has: true, n: res ? res.products : null })
      if (!ex || !res) continue
      for (const g of res.items) {
        const d = g.key ? depth + 2 : depth + 1
        if (g.key) out.push({ r: { id: r.id + '/' + rule.id + '/' + g.key, label: g.label, role: g.node ? 'group' : 'value' }, depth: depth + 2, kind: 'vgroup', rubric: r.id, node: g.node })
        for (const m of g.matches) out.push({ r: { ...tree.byId.get(m.id), id: m.id, label: m.label, role: m.role }, depth: d + 1, kind: 'ruled', rubric: r.id, products: m.products })
      }
    }
    for (const p of placed) out.push({ r: p, depth: depth + 1, kind: 'placed', rubric: r.id, shown: r.placedNames?.[p.id] ?? (dup.has(p.label) && p.parent ? `${p.label} · ${tree.byId.get(p.parent)?.label ?? ''}` : p.label), work: r.placedNames?.[p.id] ?? null })
  }
  if (current.value) walk(current.value, 0)
  return out
})
// nicht einsortiert: Produkte, die weder selbst noch über einen Vorfahren in diesem Baum hängen
const placedSet = computed(() => { const s = new Set(); const walk = r => { for (const p of r.placed ?? []) s.add(p); for (const k of tree.kids(r.id)) walk(k) }; if (current.value) walk(current.value); for (const list of Object.values(ruleResults.value)) for (const x of list) for (const g of x.result.items) for (const m of g.matches) s.add(m.id); return s })
const unplaced = computed(() => {
  if (!current.value) return []
  const inTree = id => { for (let x = tree.byId.get(id); x; x = tree.byId.get(x.parent)) if (placedSet.value.has(x.id)) return true; return false }
  return tree.rows.filter(r => r.role === 'product' && !inTree(r.id))
})
const showUnplaced = ref(false)
// Auflösung der Regeln je Rubrik (Server, im Baum des Stands); neu nach jedem Laden des Baums
const ruleResults = ref({})
async function loadRules() {
  const out = {}
  const walk = async r => { if (r.rules?.length) { try { out[r.id] = await api.get(`/api/rubrics/${encodeURIComponent(r.id)}/rules/expand`) } catch { } } for (const k of tree.kids(r.id)) await walk(k) }
  if (current.value) await walk(current.value)
  ruleResults.value = out
}
watch([current, () => tree.rows], loadRules, { immediate: true })
const attrLabel = k => store.model?.attributes?.find(a => a.key === k)?.label?.de || k
function ruleLabel(rule) {
  const under = rule.under ? tree.byId.get(rule.under)?.label ?? rule.under : 'überall'
  const what = rule.kind === 'name' ? `${rule.role === 'product' ? 'Produkte' : 'Gruppen'} „${rule.name}“` : `Produkte mit ${attrLabel(rule.attribute)} = ${rule.value}`
  const by = rule.groupBy === 'parent' ? ' · nach Produktgruppe darüber' : rule.groupBy?.startsWith('attr:') ? ` · nach ${attrLabel(rule.groupBy.slice(5))}` : ''
  return rule.label || `${what} unter ${under}${by}`
}
// Regel anlegen oder ändern: Formular mit Vorschau (trifft n Gruppen, m Produkte), gespeichert erst mit „speichern“
const ruleBox = ref(null)   // { rubric, rule: { id, kind, under, role, name, attribute, value, groupBy }, preview }
function editRule(rubric, rule = null) {
  ruleBox.value = { rubric, rule: rule ? { ...rule } : { id: '', kind: 'name', under: tree.rows.find(r => !r.parent && r.role === 'group')?.id ?? '', role: 'group', name: '', attribute: '', value: '', groupBy: 'parent' }, preview: null }
}
let previewTimer = null
watch(() => JSON.stringify(ruleBox.value?.rule), () => {
  clearTimeout(previewTimer); const b = ruleBox.value; if (!b) return
  previewTimer = setTimeout(async () => {
    const r = b.rule; const ok = r.kind === 'name' ? r.name.trim() : (r.attribute && r.value.trim())
    if (!ok) { b.preview = null; return }
    const q = new URLSearchParams({ kind: r.kind, under: r.under ?? '', role: r.role ?? '', name: r.name ?? '', attribute: r.attribute ?? '', value: r.value ?? '', groupBy: r.groupBy ?? 'none' })
    try { b.preview = await api.get(`/api/rubrics/${encodeURIComponent(b.rubric.id)}/rules/preview?${q}`) } catch (e) { b.preview = { error: e.message } }
  }, 250)
})
async function saveRule() {
  const b = ruleBox.value; if (!b) return
  await run(() => post(`/api/rubrics/${encodeURIComponent(b.rubric.id)}/rules`, b.rule, 'PUT'))
  expanded.value.add(b.rubric.id); ruleBox.value = null
}
async function removeRule(rubricId, rule) {
  if (!await dialog.confirm({ title: 'Regel entfernen?', text: ruleLabel(rule) + ' — die Treffer verschwinden aus dieser Rubrik; im Pflegebaum ändert sich nichts.', ok: '✕ Entfernen', danger: true })) return
  await run(() => api.del(`/api/rubrics/${encodeURIComponent(rubricId)}/rules/${encodeURIComponent(rule.id)}`))
}
// Ausleitung (Taloan, 21.09.): je Produkt im Baum ausgeleitet oder zurückgehalten, mit Grund — Freigabe für den Kanal, Markt in den Verkaufsländern (Server: Publication.cs)
const exp = ref(null); const showExport = ref(false); const expOnly = ref('out')
async function loadExport() { if (!current.value) { exp.value = null; return } try { exp.value = await api.get(`/api/pub/${encodeURIComponent(current.value.id)}/export`) } catch (e) { exp.value = null } }
watch([current, () => tree.rows], loadExport, { immediate: true })
const expRows = computed(() => !exp.value ? [] : exp.value.rows.filter(r => expOnly.value === 'all' || (expOnly.value === 'in') === r.in))
// Links der Pflegebaum (Taloan, 21.09.: „links mein Pflegebaum, rechts der Publikationsbaum, und ich ziehe die Äste rüber, wie ich sie brauche“):
// Gruppen und Produkte, aufklappbar, ziehbar; ✓ = in diesem Publikationsbaum schon enthalten (selbst oder über einen Vorfahren als Verweis)
const srcExpanded = ref(new Set(JSON.parse(localStorage.getItem('journali.pubsrc.expanded') || '[]')))
function srcToggle(id) { srcExpanded.value.has(id) ? srcExpanded.value.delete(id) : srcExpanded.value.add(id); srcExpanded.value = new Set(srcExpanded.value); localStorage.setItem('journali.pubsrc.expanded', JSON.stringify([...srcExpanded.value])) }
const srcFilter = ref('')
const inTree = id => { for (let x = tree.byId.get(id); x; x = tree.byId.get(x.parent)) if (placedSet.value.has(x.id)) return true; return false }
const srcRows = computed(() => {
  const ok = r => r.role === 'group' || r.role === 'product'
  const q = srcFilter.value.trim().toLowerCase()
  if (q) return tree.rows.filter(r => ok(r) && r.label.toLowerCase().includes(q)).slice(0, 200).map(r => ({ r, depth: 0, has: false, isOpen: false, path: tree.ancestors(r.id).map(a => a.label).join(' › ') }))
  const out = []
  const walk = (n, depth) => { const kids = tree.kids(n.id).filter(ok); const isOpen = srcExpanded.value.has(n.id); out.push({ r: n, depth, has: kids.length > 0, isOpen }); if (isOpen) for (const k of kids) walk(k, depth + 1) }
  for (const r of tree.rows.filter(r => !r.parent && r.role === 'group')) walk(r, 0)
  return out
})
// Was ein gezogener Ast im Publikationsbaum wird: Gruppe → Rubrik mit ihrem Aufbau (umbaubar) oder → Verweis (folgt dem Pflegebaum); Produkt → immer Verweis
const dropMode = ref(localStorage.getItem('journali.pubsrc.mode') || 'copy')
watch(dropMode, m => localStorage.setItem('journali.pubsrc.mode', m))
const selRubric = computed(() => { const r = tree.byId.get(props.id); return r?.role === 'rubric' ? r : null })

async function run(fn) { try { await fn(); await store.poll(true); await tree.load() } catch (e) { store.toast(e.message) } }
const post = (url, body, m) => api.post(url, body, m)

async function newTree() {
  const channels = store.model?.channels ?? []
  const name = await dialog.prompt({ title: 'Neuer Publikationsbaum', value: '', placeholder: 'Name — z. B. Web Schweiz', ok: '+ Baum' })
  if (!name) return
  const channel = channels.length === 1 ? channels[0].key : await dialog.prompt({ title: 'Kanal', text: channels.map(c => c.key).join(' · '), value: store.model?.masterChannel ?? channels[0]?.key ?? '', ok: 'OK' })
  if (!channel) return
  const market = await dialog.prompt({ title: 'Markt (leer = alle Märkte)', text: 'Schlüssel aus der Werteliste „Märkte“ (Modell) — der Baum leitet dann nur aus, was in diesem Markt verkauft wird (Verkaufsländer am Produkt).', value: '', placeholder: 'z. B. ch', ok: 'OK' })
  if (market == null) return
  await run(async () => { const e = await post('/api/rubrics', { parent: null, label: {}, name, channel, market: market || null }); treeKey.value = e.stream })
}
async function newRubric(parent) {
  const name = await dialog.prompt({ title: 'Neue Rubrik', text: `unter ${parent.label}`, value: '', ok: '+ Rubrik' })
  if (!name) return
  await run(async () => { await post('/api/rubrics', { parent: parent.id, label: {}, name }); expanded.value.add(parent.id); toggle(parent.id); toggle(parent.id) })
}
async function rename(r) {
  const name = await dialog.prompt({ title: 'Rubrik umbenennen', value: r.name ?? r.label, ok: '✎ Umbenennen' })
  if (name) await run(() => post(`/api/nodes/${encodeURIComponent(r.id)}/name`, { name }, 'PUT'))
}
async function retire(r) {
  const n = tree.kids(r.id).length; const p = (r.placed ?? []).length
  const below = (() => { let rub = 0, ref = 0; const walk = x => { for (const k of tree.kids(x.id)) { rub++; walk(k) } ref += (x.placed ?? []).length }; walk(r); return { rub, ref } })()
  if (!await dialog.confirm({ title: `Rubrik „${r.label}“ aus „${current.value?.label ?? ''}“ entfernen?`, text: `${below.rub ? `${below.rub} ${below.rub === 1 ? 'Unterrubrik' : 'Unterrubriken'} und ` : ''}${below.ref} ${below.ref === 1 ? 'Verweis verschwindet' : 'Verweise verschwinden'} aus diesem Publikationsbaum. Die Produkte und Gruppen bleiben im Pflegebaum unverändert; sie gelten hier danach als „noch nicht einsortiert“.`, ok: '✕ Entfernen', danger: true })) return
  if (props.id === r.id || tree.ancestors(props.id ?? '').some(a => a.id === r.id)) router.push(`/pub/${r.parent}`)   // erst weg von der Rubrik, sonst 404 → Sprung
  await run(() => api.del(`/api/nodes/${encodeURIComponent(r.id)}?recursive=true`))
}
async function namePlace(row) {
  const name = await dialog.prompt({ title: 'Anzeigename des Verweises', text: `Pflegename: ${row.r.label} — leer = Pflegename`, value: row.work ?? '', ok: '✎ OK' })
  if (name == null) return
  await run(() => post(`/api/rubrics/${encodeURIComponent(row.rubric)}/place/${encodeURIComponent(row.r.id)}/name`, { name }, 'PUT'))
}
async function unplace(rubricId, nodeId) { await run(() => api.del(`/api/rubrics/${encodeURIComponent(rubricId)}/place/${encodeURIComponent(nodeId)}`)) }
async function placeUnplaced(ids) {
  if (!selRubric.value) { store.toast('erst eine Rubrik wählen (links anklicken)'); return }
  await run(async () => { for (const id of ids) await post(`/api/rubrics/${encodeURIComponent(selRubric.value.id)}/place`, { node: id }) })
}

function contextMenu(e, row) {
  const r = row.r
  if (row.kind === 'rule') { menu.open(e, [{ label: 'Regel bearbeiten …', icon: '⚙', action: () => editRule(tree.byId.get(row.rubric), row.rule) }, { label: 'Regel entfernen', icon: '✕', danger: true, action: () => removeRule(row.rubric, row.rule) }]); return }
  if (row.kind === 'vgroup') return
  if (row.kind === 'ruled') { menu.open(e, [{ label: 'im Pflegebaum zeigen', icon: '▣', action: () => router.push(`/tree/${r.id}`) }]); return }
  if (row.kind === 'placed') {
    menu.open(e, [
      { label: 'im Pflegebaum zeigen', icon: '▣', action: () => router.push(`/tree/${r.id}`) },
      { label: 'Anzeigename …', icon: '✎', hint: 'nur für den Überblick hier — die Ausgabe nimmt Attribute', action: () => namePlace(row) },
      { sep: true },
      { label: 'Verweis entfernen', icon: '✕', danger: true, hint: 'nur hier — das Produkt bleibt im Pflegebaum', action: () => unplace(row.rubric, r.id) },
    ]); return
  }
  if (sel.value.size > 1 && sel.value.has(r.id)) { menu.open(e, [{ label: `${sel.value.size} Rubriken entfernen`, icon: '✕', danger: true, hint: `nur aus „${current.value?.label ?? ''}“ — die Produkte bleiben`, action: () => retireMany([...sel.value]) }]); return }
  router.push(`/pub/${r.id}`)
  menu.open(e, [
    { label: 'Rubrik darunter …', icon: '+', action: () => newRubric(r) },
    { label: 'Regel …', icon: '⚙', hint: 'alles, worauf das zutrifft — Gruppen namens X oder Produkte mit Attribut = Wert, live', action: () => editRule(r) },
    { sep: true },
    ...(r.stand != null
      ? [{ label: `Stand #${r.stand} aktualisieren`, icon: '❄', hint: 'auf jetzt setzen', action: () => setStand(r, 'now') }, { label: 'Stand aufheben — live', icon: '○', action: () => setStand(r, 'live') }]
      : [{ label: 'Stand einfrieren (jetzt)', icon: '❄', hint: standOf(r) ? `erbt Stand #${standOf(r).stand} von „${standOf(r).from.label}“ — eigener Stand übersteuert` : 'ab hier nach unten die Pflege wie jetzt', action: () => setStand(r, 'now') }]),
    { sep: true },
    { sep: true },
    { label: 'Umbenennen', icon: '✎', action: () => rename(r) },
    ...(r.parent ? [{ label: 'Rubrik entfernen', icon: '✕', danger: true, hint: `nur aus „${current.value?.label ?? ''}“ — die Produkte bleiben im Pflegebaum`, action: () => retire(r) }]
      : [{ label: 'Kanal / Markt …', icon: '⇶', action: () => editTree(r) }, { sep: true },
         { label: 'Leeren', icon: '✕', danger: true, hint: 'alle Rubriken und Verweise raus, der Baum bleibt', action: () => clearTree(r) },
         { label: 'Publikationsbaum löschen', icon: '✕', danger: true, hint: 'der ganze Baum — die Produkte bleiben im Pflegebaum', action: () => deleteTree(r) }]),
  ])
}
async function editTree(r) {
  const channel = await dialog.prompt({ title: 'Kanal', text: (store.model?.channels ?? []).map(c => c.key).join(' · '), value: r.channel ?? '', ok: 'OK' }); if (!channel) return
  const market = await dialog.prompt({ title: 'Markt (leer = alle)', value: r.market ?? '', ok: 'OK' }); if (market == null) return
  await run(() => post(`/api/rubrics/${encodeURIComponent(r.id)}/tree`, { channel, market: market || null }, 'PUT'))
}
// Ziehen: Rubrik auf Rubrik = umhängen; Verweis auf Rubrik = Verweis umhängen
const drag = ref(null); const dropId = ref(null); const dropPos = ref('into')   // into · before · after — Einfügelinie zwischen den Zeilen (Taloan, 21.09.)
function onDragStart(e, row) { if (row.kind === 'rule' || row.kind === 'vgroup' || row.kind === 'ruled') { e.preventDefault(); return } drag.value = row; e.dataTransfer.effectAllowed = 'move' }
function onSrcDragStart(e, row) { drag.value = { kind: 'src', r: row.r }; e.dataTransfer.effectAllowed = 'copy' }
function onDragOver(e, row) {
  if (row.kind !== 'rubric' || !drag.value || drag.value.r.id === row.r.id) return
  e.preventDefault(); dropId.value = row.r.id
  // Rubrik auf Rubrik: oberes Drittel = davor, unteres = danach, Mitte = hinein; alles andere geht nur hinein
  if (drag.value.kind !== 'rubric' || !row.r.parent) { dropPos.value = 'into'; return }
  const box = e.currentTarget.getBoundingClientRect(); const y = (e.clientY - box.top) / box.height
  dropPos.value = y < 0.3 ? 'before' : y > 0.7 ? 'after' : 'into'
}
// Geschwister nach dem Ziel (für „danach“ = vor dem nächsten)
function nextSibling(row) { const sib = tree.kids(row.r.parent); const i = sib.findIndex(x => x.id === row.r.id); return sib[i + 1]?.id ?? null }
async function onDrop(row) {
  const d = drag.value; const pos = dropPos.value; drag.value = null; dropId.value = null; dropPos.value = 'into'
  if (!d || row.kind !== 'rubric') return
  if (d.kind === 'src') {
    // aus dem Pflegebaum: Gruppe → Rubrik mit Aufbau (copy) oder Verweis (ref); Produkt → Verweis
    if (d.r.role === 'group' && dropMode.value === 'copy') await run(async () => { await post(`/api/rubrics/${encodeURIComponent(row.r.id)}/derive`, { from: d.r.id, self: true }); expanded.value.add(row.r.id) })
    else await run(async () => { await post(`/api/rubrics/${encodeURIComponent(row.r.id)}/place`, { node: d.r.id }); expanded.value.add(row.r.id) })
    return
  }
  if (d.kind === 'rubric') await run(() => pos === 'into' ? post(`/api/nodes/${encodeURIComponent(d.r.id)}/move`, { parent: row.r.id }) : post(`/api/nodes/${encodeURIComponent(d.r.id)}/order`, { parent: row.r.parent, before: pos === 'before' ? row.r.id : nextSibling(row) }))
  else await run(async () => { await post(`/api/rubrics/${encodeURIComponent(row.r.id)}/place`, { node: d.r.id }); await api.del(`/api/rubrics/${encodeURIComponent(d.rubric)}/place/${encodeURIComponent(d.r.id)}`) })
}
const sel = ref(new Set())   // Mehrfachauswahl von Rubriken: Strg-Klick toggelt, Umschalt-Klick nimmt den Bereich bis zur zuletzt geöffneten
function open(row, e) {
  if (row.kind === 'rule') { toggle(row.r.id); return }
  if (row.kind === 'vgroup') return
  if (row.kind === 'ruled') { router.push({ path: `/pub/${row.r.id}`, query: { in: row.rubric } }); return }
  if (row.kind === 'rubric' && e && (e.ctrlKey || e.metaKey)) { sel.value.has(row.r.id) ? sel.value.delete(row.r.id) : sel.value.add(row.r.id); sel.value = new Set(sel.value); return }
  if (row.kind === 'rubric' && e && e.shiftKey && props.id) {
    const ids = rows.value.filter(x => x.kind === 'rubric').map(x => x.r.id); const a = ids.indexOf(props.id), b = ids.indexOf(row.r.id)
    if (a >= 0 && b >= 0) { for (const x of ids.slice(Math.min(a, b), Math.max(a, b) + 1)) sel.value.add(x); sel.value = new Set(sel.value); return }
  }
  sel.value = new Set(); router.push(row.kind === 'placed' ? { path: `/pub/${row.r.id}`, query: { in: row.rubric } } : `/pub/${row.r.id}`)
}
// Stand (Taloan, 21.09., „A“): Zeiger auf eine Journalnummer an Rubrik oder Wurzel — alles darunter liest die Pflege wie damals; live = kein Zeiger
function standOf(r) { for (let n = r; n; n = tree.byId.get(n.parent)) if (n.stand != null) return { stand: n.stand, from: n }; return null }
async function setStand(r, mode) {
  if (mode === 'live' && !await dialog.confirm({ title: `„${r.label}“ wieder live?`, text: `Stand #${r.stand} aufheben — ab hier nach unten gilt wieder der aktuelle Pflegestand.`, ok: 'live' })) return
  if (mode === 'now' && !await dialog.confirm({ title: r.stand != null ? `Stand von „${r.label}“ aktualisieren?` : `„${r.label}“ einfrieren?`, text: 'Ab hier nach unten liest die Publikation die Pflege wie jetzt — spätere Änderungen in der Pflege kommen nicht mehr durch, bis der Stand aktualisiert oder aufgehoben wird. Nichts wird kopiert: ein Zeiger ins Journal.', ok: r.stand != null ? '❄ aktualisieren' : '❄ einfrieren' })) return
  await run(() => post(`/api/rubrics/${encodeURIComponent(r.id)}/stand`, mode === 'now' ? { now: true } : {}, 'PUT'))
}
// mehrere Rubriken auf einmal entfernen (nur aus diesem Publikationsbaum); Wurzeln bleiben, verschachtelte nur einmal
async function retireMany(ids) {
  const list = ids.map(x => tree.byId.get(x)).filter(r => r && r.parent && !tree.ancestors(r.id).some(a => ids.includes(a.id)))
  if (!list.length) return
  if (!await dialog.confirm({ title: `${list.length} Rubriken aus „${current.value?.label ?? ''}“ entfernen?`, list: list.map(r => r.label), text: 'Mit allem darunter (Unterrubriken, Verweise). Die Produkte bleiben im Pflegebaum und gelten hier danach als „noch nicht einsortiert“.', ok: '✕ Entfernen', danger: true })) return
  if (list.some(r => r.id === props.id || tree.ancestors(props.id ?? '').some(a => a.id === r.id))) router.push(`/pub/${current.value.id}`)
  await run(async () => { for (const r of list) await api.del(`/api/nodes/${encodeURIComponent(r.id)}?recursive=true`) })
  sel.value = new Set()
}
// Baum leeren oder ganz löschen — die Wurzel ist der Publikationsbaum (Kanal × Markt)
async function clearTree(r) {
  const kids = tree.kids(r.id); const refs = (r.placed ?? []).length
  if (!kids.length && !refs) { store.toast('schon leer'); return }
  if (!await dialog.confirm({ title: `„${r.label}“ leeren?`, text: `${kids.length} Rubriken und ${refs} Verweise an der Wurzel verschwinden. Die Produkte bleiben im Pflegebaum. Der Baum selbst (Kanal ${r.channel ?? ''}${r.market ? ' · Markt ' + r.market : ''}) bleibt.`, ok: '✕ Leeren', danger: true })) return
  if (props.id && props.id !== r.id) router.push(`/pub/${r.id}`)
  await run(async () => { for (const k of kids) await api.del(`/api/nodes/${encodeURIComponent(k.id)}?recursive=true`); for (const p of r.placed ?? []) await api.del(`/api/rubrics/${encodeURIComponent(r.id)}/place/${encodeURIComponent(p)}`) })
}
async function deleteTree(r) {
  if (!await dialog.confirm({ title: `Publikationsbaum „${r.label}“ löschen?`, warn: `Kanal ${r.channel ?? ''}${r.market ? ' · Markt ' + r.market : ''}`, text: 'Mit allen Rubriken und Verweisen. Die Produkte bleiben im Pflegebaum. Wie alles im Journal: zurückholbar über den Papierkorb.', ok: '✕ Löschen', danger: true })) return
  router.push('/pub')
  await run(() => api.del(`/api/nodes/${encodeURIComponent(r.id)}?recursive=true`))
  treeKey.value = trees.value[0]?.id ?? ''
}
onMounted(() => { if (!tree.loaded) tree.load() })
</script>

<template>
  <div class="pub-theme">
  <div v-if="!srcOpen" class="pane" style="width:30px;flex:none;align-items:center;padding-top:6px;cursor:pointer" title="Klick: Pflegebaum aufklappen" @click="srcOpen = true">
    <span class="muted">▸</span><span class="muted" style="writing-mode:vertical-rl;margin-top:8px;font-size:12px">▣ Pflegebaum</span>
  </div>
  <div v-else class="pane" :style="`width:${srcW}px;flex:none`">
    <div class="toolbar">
      <button class="x" title="Pflegebaum einklappen" @click="srcOpen = false">◂</button>
      <h1>▣ Pflegebaum</h1>
      <span class="grow" />
      <span class="view-chip" :class="{ on: dropMode === 'copy' }" @click="dropMode = 'copy'" title="Gruppe → Rubrik mit Aufbau (umbaubar)">⇊ kopieren</span>
      <span class="view-chip" :class="{ on: dropMode === 'ref' }" @click="dropMode = 'ref'" title="Gruppe → Verweis (folgt dem Pflegebaum)">↗ verweisen</span>
    </div>
    <div class="toolbar" style="border-bottom:1px solid var(--line)"><input v-model="srcFilter" placeholder="filtern" style="width:100%" /></div>
    <div class="scroll tree">
      <div v-for="row in srcRows" :key="row.r.id" class="node" :style="`padding-left:${8 + row.depth * 16}px`" draggable="true" @dragstart="onSrcDragStart($event, row)" :title="row.path ?? row.r.id" @dblclick="router.push(`/tree/${row.r.id}`)">
        <span class="twisty" :class="{ leaf: !row.has }" @click.stop="srcToggle(row.r.id)">{{ row.has ? (row.isOpen ? '▾' : '▸') : '' }}</span>
        <span class="icon">{{ icon(row.r.role) }}</span>
        <span class="label">{{ row.r.label }}</span>
        <span v-if="row.r.role === 'group'" class="muted count" :title="`${tree.below(row.r.id).summary} darunter`">{{ tree.below(row.r.id).total }}</span>
        <span v-if="current && inTree(row.r.id)" class="pos count" :title="`in „${current.label}“ als Verweis enthalten`">✓</span>
      </div>
    </div>
    <div class="toolbar hint muted" style="border-top:1px solid var(--line);border-bottom:0;font-size:12px">Ast nach rechts auf eine Rubrik ziehen · Doppelklick öffnet</div>
  </div>
  <Splitter v-if="srcOpen" v-model="srcW" :min="200" :max="600" />
  <div class="pane" :style="`width:${pubW}px;flex:none`">
    <div class="toolbar">
      <h1>⇶ Publikation</h1>
      <select v-if="trees.length" v-model="treeKey" title="Publikationsbaum — je Kanal (× Markt) die Maximalstruktur">
        <option v-for="t in trees" :key="t.id" :value="t.id">{{ t.label }} · {{ t.channel }}{{ t.market ? '/' + t.market : '' }} · {{ tree.below(t.id).total }} Rubriken</option>
      </select>
      <button class="x" @click="newTree" title="neuer Publikationsbaum">+</button>
      <span class="grow" />
      <button v-if="exp" :class="{ primary: showExport }" @click="showExport = !showExport; showUnplaced = false" :title="`${exp.in} ausgeleitet · ${exp.out} zurückgehalten · Klick: Liste`"><span class="pos">{{ exp.in }}</span> <span :class="exp.out ? 'neg' : 'muted'">{{ exp.out }}</span></button>
      <button v-if="current && unplaced.length" :class="{ primary: showUnplaced }" @click="showUnplaced = !showUnplaced; showExport = false" :title="`${unplaced.length} nicht einsortiert · Klick: Liste`">⚠ {{ unplaced.length }}</button>
    </div>
    <div v-if="showExport && exp" class="unplaced">
      <div class="toolbar" style="white-space:nowrap" title="Ausgeleitet wird ein Produkt, wenn eine Variante für den Kanal freigegeben ist und der Markt des Baums in ihren Verkaufsländern steht (leer = überall; Markt-Fallback zählt).">
        <span class="view-chip pos" :class="{ on: expOnly === 'in' }" @click="expOnly = 'in'" title="wird ausgeleitet">ausgeleitet <b class="pos">{{ exp.in }}</b></span>
        <span class="view-chip" :class="{ on: expOnly === 'out', neg: exp.out > 0 }" @click="expOnly = 'out'" title="wird nicht ausgeleitet — mit Grund">zurückgehalten <b :class="exp.out ? 'neg' : 'muted'">{{ exp.out }}</b></span>
        <span class="view-chip" :class="{ on: expOnly === 'all' }" @click="expOnly = 'all'">alle <b class="muted">{{ exp.in + exp.out }}</b></span></div>
      <div class="scroll" style="max-height:240px">
        <div v-for="r in expRows" :key="r.path.map(x => x.id).join('/') + r.product.id" class="node" :title="r.path.map(x => x.label).join(' › ') + (r.why.length ? '\n' + r.why.join('\n') : '')" @click="router.push(`/pub/${r.product.id}`)">
          <span :class="r.in ? 'pos' : 'neg'" style="width:14px;text-align:center">{{ r.in ? '✓' : '✗' }}</span>
          <span class="icon">▦</span><span class="label">{{ r.product.label }}</span>
          <span class="muted" style="font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-left:6px">{{ r.in ? r.path.slice(1).map(x => x.label).join(' › ') : r.why.join(' · ') }}</span>
          <button class="x" style="margin-left:auto" title="im Pflegebaum öffnen (freigeben, pflegen); ⇶ bringt dich zurück" @click.stop="store.pubBack = { path: $route.fullPath, label: current.label }; router.push(`/tree/${r.product.id}`)">▣</button>
        </div>
        <div v-if="!expRows.length" class="empty" style="padding:10px">{{ expOnly === 'out' ? 'nichts zurückgehalten — alles im Baum wird ausgeleitet' : 'nichts' }}</div>
      </div>
    </div>
    <div v-if="ruleBox" class="picker-box" style="padding:8px">
      <div class="toolbar" style="padding:0 0 6px"><b>⚙ Regel in „{{ ruleBox.rubric.label }}“</b><span class="grow" /><button class="x" @click="ruleBox = null">✕</button></div>
      <div class="chips" style="margin-bottom:6px">
        <span class="view-chip" :class="{ on: ruleBox.rule.kind === 'name' }" @click="ruleBox.rule.kind = 'name'" title="Name gleich · Gruppe mit allem darunter">nach Name</span>
        <span class="view-chip" :class="{ on: ruleBox.rule.kind === 'attribute' }" @click="ruleBox.rule.kind = 'attribute'; ruleBox.rule.role = 'product'" title="Produkte, deren Wert (geerbt zählt) passt">nach Wert</span>
      </div>
      <div v-if="ruleBox.rule.kind === 'name'" class="chips" style="margin-bottom:6px">
        <select v-model="ruleBox.rule.role"><option value="group">Gruppen</option><option value="product">Produkte</option></select>
        <input v-model="ruleBox.rule.name" placeholder="Name, z. B. Ersatzteile" style="flex:1" />
      </div>
      <div v-else class="chips" style="margin-bottom:6px">
        <select v-model="ruleBox.rule.attribute" style="max-width:200px"><option value="">Attribut …</option><option v-for="a in (store.model?.attributes ?? []).filter(a => !['rows', 'formula', 'template'].includes(a.type))" :key="a.key" :value="a.key">{{ a.label?.de || a.key }}</option></select>
        <span class="muted">=</span><input v-model="ruleBox.rule.value" placeholder="Wert" style="flex:1" />
      </div>
      <div class="muted" style="font-size:12px;margin-bottom:2px">unter</div>
      <TreePicker v-model="ruleBox.rule.under" :roles="['group']" :height="160" />
      <div class="chips" style="margin-top:6px">
        <span class="muted" style="font-size:12px">gliedern</span>
        <select v-model="ruleBox.rule.groupBy"><option value="none">flach</option><option value="parent">nach Produktgruppe darüber</option><option v-for="a in (store.model?.attributes ?? []).filter(a => ['text', 'enum'].includes(a.type))" :key="a.key" :value="'attr:' + a.key">nach {{ a.label?.de || a.key }}</option></select>
      </div>
      <div class="toolbar" style="border-top:1px solid var(--line);border-bottom:0;margin-top:8px;padding:6px 0 0">
        <span v-if="ruleBox.preview?.error" class="neg" style="font-size:12px">{{ ruleBox.preview.error }}</span>
        <span v-else-if="ruleBox.preview" :class="ruleBox.preview.hits ? 'pos' : 'warn'" style="font-size:12px">trifft {{ ruleBox.preview.hits }} {{ ruleBox.rule.kind === 'name' && ruleBox.rule.role === 'group' ? 'Gruppen' : 'Produkte' }}{{ ruleBox.preview.groups ? ` in ${ruleBox.preview.groups} Gliederungen` : '' }} · {{ ruleBox.preview.products }} Produkte</span>
        <span v-else class="muted" style="font-size:12px">…</span>
        <span class="grow" /><button class="primary" :disabled="!ruleBox.preview || ruleBox.preview.error" @click="saveRule">⚙ speichern</button>
      </div>
    </div>
    <div v-if="showUnplaced" class="unplaced">
      <div class="toolbar"><span class="muted">{{ unplaced.length }} Produkte noch nicht einsortiert</span><span class="grow" /><button class="x" :disabled="!selRubric" @click="placeUnplaced(unplaced.map(r => r.id))" :title="selRubric ? `Klick: alle ${unplaced.length} nach „${selRubric.label}“` : 'erst Rubrik anklicken'">alle in {{ selRubric ? '„' + selRubric.label + '“' : 'Rubrik …' }}</button></div>
      <div class="scroll" style="max-height:200px">
        <div v-for="r in unplaced" :key="r.id" class="node" :title="tree.ancestors(r.id).map(a => a.label).join(' › ')">
          <span class="icon">{{ icon(r.role) }}</span><span class="label">{{ r.label }}</span><span class="grow" />
          <button class="x" :disabled="!selRubric" @click="placeUnplaced([r.id])" :title="selRubric ? `in ${selRubric.label} hängen` : 'links eine Rubrik wählen'">↗</button>
        </div>
      </div>
    </div>
    <div class="scroll tree">
      <div v-for="row in rows" :key="row.kind + row.r.id + (row.rubric ?? '')" class="node" :class="[row.kind, { selected: row.r.id === id || sel.has(row.r.id), drop: dropId === row.r.id && dropPos === 'into', 'drop-before': dropId === row.r.id && dropPos === 'before', 'drop-after': dropId === row.r.id && dropPos === 'after' }]"
        :style="`padding-left:${8 + row.depth * 16}px`" @click="open(row, $event)" @contextmenu.prevent="contextMenu($event, row)" :title="row.r.id"
        draggable="true" @dragstart="onDragStart($event, row)" @dragover="onDragOver($event, row)" @dragleave="dropId === row.r.id && (dropId = null)" @drop.prevent="onDrop(row)" @dragend="drag = null; dropId = null">
        <span v-if="row.kind === 'rubric' || row.kind === 'rule'" class="twisty" :class="{ leaf: !row.has }" @click.stop="toggle(row.r.id)">{{ row.has ? (row.isOpen ? '▾' : '▸') : '' }}</span>
        <span v-else-if="row.kind === 'vgroup'" class="twisty muted"></span>
        <span v-else class="twisty muted">↗</span>
        <span class="icon">{{ row.kind === 'rubric' ? '▥' : row.kind === 'rule' ? '⚙' : row.kind === 'vgroup' ? (row.r.role === 'value' ? '≡' : '▣') : icon(row.r.role) }}</span>
        <span class="label" :class="{ work: row.work }" :title="row.work ? `Anzeigename (nur hier) — Pflegename: ${row.r.label}` : ''">{{ row.shown ?? row.r.label }}</span>
        <span v-if="row.kind === 'rubric' && row.r.stand != null" class="count" style="margin-left:4px" :title="`Stand #${row.r.stand}`">❄</span>
        <span v-if="row.kind === 'rubric' && row.n" class="muted count" :title="`${row.n} Verweise`">{{ row.n }}</span>
        <span v-if="row.kind === 'rule' && row.n != null" class="muted count" :title="`${row.n} Produkte über diese Regel`">{{ row.n }}</span>
        <span v-if="row.kind === 'ruled' && row.r.role === 'group'" class="muted count">{{ row.products }}</span>
        <span v-if="row.kind === 'placed' && row.r.role === 'group'" class="muted count" :title="`Produktgruppe mit ${tree.below(row.r.id).total} darunter`">{{ tree.below(row.r.id).total }}</span>
      </div>
      <div v-if="!trees.length" class="empty">Kein Publikationsbaum.<div class="chips" style="justify-content:center;margin-top:8px"><button class="primary" @click="newTree">+ Publikationsbaum</button></div><div class="muted" style="margin-top:6px;font-size:12px">Name, Kanal, optional Markt — danach Äste aus dem Pflegebaum links rüberziehen.</div></div>
      <div v-else-if="rows.length === 1" class="empty">Noch leer — einen Ast aus dem Pflegebaum links auf „{{ current.label }}“ ziehen.<div class="chips" style="justify-content:center;margin-top:8px"><button class="x" @click="newRubric(current)" title="eine leere Rubrik anlegen, z. B. für eigene Gliederung">+ Rubrik</button></div></div>
    </div>
    <div class="toolbar hint muted" style="border-top:1px solid var(--line);border-bottom:0;font-size:12px">▥ Rubrik · ↗ Verweis · von links ziehen = übernehmen · hier ziehen = umhängen, an den Rand einer Zeile = Reihenfolge · Strg-Klick = mehrere · Rechtsklick</div>
  </div>
  <Splitter v-model="pubW" :min="220" :max="800" />
  <NodeView v-if="id" :id="id" :key="id" :pub="current?.id ?? null" :pub-rubric="$route.query.in ?? null" />
  <div v-else class="pane" style="flex:1"><div class="empty">Rubrik wählen — ihre Texte und Bilder stehen hier wie an jedem Knoten.</div></div>
  </div>
</template>

<style scoped>
.node { display: flex; align-items: center; gap: 4px; height: 24px; cursor: default; white-space: nowrap; padding-right: 8px; }
.node:hover { background: var(--hover); }
.node.selected { background: var(--accent-soft); }
.node.drop { outline: 1px dashed var(--accent); outline-offset: -1px; background: var(--accent-soft); }
.node.drop-before { box-shadow: inset 0 2px 0 var(--accent); }
.node.drop-after { box-shadow: inset 0 -2px 0 var(--accent); }
.node.placed .label { color: var(--muted); }
.node.rule .label { color: var(--accent); }
.node.vgroup .label { color: var(--muted); font-style: italic; }
.node.ruled .label { color: var(--muted); }
.node.placed .label.work { color: var(--text); font-style: italic; }   /* Anzeigename: eigener, interner Name */
.twisty { width: 14px; color: var(--muted); font-size: 11px; text-align: center; cursor: pointer; }
.count { font-size: 11px; margin-left: auto; }
.unplaced, .picker-box { border-bottom: 1px solid var(--line); background: var(--pane); }
.picker-box { padding-bottom: 4px; }
</style>
