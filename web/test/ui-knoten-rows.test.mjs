// Ein Tabellenattribut (rows) in der Knotenansicht (29.09.2026): Die Ansicht stürzte ab, sobald eines gezeigt wurde —
// die Zeile las `viewLocales`, das es im Setup nicht gab (nur im store). Ohne Spalten steht die Tabelle leer da,
// aber sie steht.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { routerKey, routeLocationKey } from 'vue-router'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'
const NodeView = (await import('../src/views/NodeView.vue')).default
const MODELL = { masterLocale: 'de', locales: [{ code: 'de' }], channels: [], statuses: [], lists: [], views: [], families: [], units: [],
  attributes: [{ key: 'bestelldaten', label: { de: 'Bestelldaten' }, type: 'rows', group: 'look' }, { key: 'weight', label: { de: 'Gewicht' }, type: 'decimal', group: 'physical' }],
  groups: [{ key: 'physical', label: { de: 'Physisch' } }, { key: 'look', label: { de: 'Bestelldaten' } }], relationTypes: [] }
test('ein Tabellenattribut ohne Spalten stürzt die Ansicht nicht ab', async () => {
  store.actor='u1'; store.toasts=[]; store.model=MODELL; store.pendingDocTables=null; store.poll=async()=>{}; store.layout='tabs'
  globalThis.HTMLCanvasElement.prototype.getContext = () => ({ font:'', measureText: s => ({ width: String(s).length*7 }) })
  const p1={id:'p1',role:'product',label:'X',parent:null,axes:[]}
  tree.byId=new Map([['p1',p1]]); tree.rows=[p1]; tree.children=new Map([['',[p1]]]); tree.loaded=true; tree.load=async()=>{}
  const knoten={id:'p1',role:'product',label:{},values:[],status:'draft',children:0,axes:[],attachedGroups:['physical','look'],ancestors:[],rows:{},
    groups:[{key:'physical',from:'p1',fromLabel:'X',active:true,attributes:['weight']},{key:'look',from:'p1',fromLabel:'X',active:true,attributes:['bestelldaten']}]}
  globalThis.fetch=async url=>{const p=String(url);const a=/\/nodes\/p1$/.test(p)?knoten:/\/relations/.test(p)?{out:[],in:[],inherited:[]}:/\/api\/model/.test(p)?MODELL:/\/api\/plugins/.test(p)?[]:/\/api\/streams\//.test(p)||/\/workflow$/.test(p)?[]:{}
    return {ok:true,status:200,text:async()=>JSON.stringify(a),json:async()=>a}}
  const router={path:'/tree/p1',push(x){this.path=x},replace(x){this.path=x}}
  const route={path:'/tree/p1',query:{},params:{id:'p1'},name:'tree',hash:'',fullPath:'/tree/p1',matched:[],meta:{}}
  const w=mount(NodeView,{props:{id:'p1'},global:{provide:{[routerKey]:router,[routeLocationKey]:route},stubs:{RouterLink:true,'router-link':true,MediaThumb:true,EntryList:true,PluginBands:true,VersionsPanel:true,DocTables:true}}})
  await flushPromises()
  const reiter = w.findAll('.tabs .tabbtn')
  const b = reiter.find(x => /Bestelldaten/.test(x.text()))
  assert.ok(b, 'Reiter da: ' + reiter.map(x=>x.text()).join(', '))
  await b.trigger('click'); await flushPromises()
  assert.ok(w.text().includes('Bestelldaten'))
  assert.ok(w.findComponent({ name: 'RowsBlock' }).exists(), 'die Tabelle steht da — ohne Spalten, aber ohne Absturz')
  assert.equal(w.text().includes('abgestürzt'), false)
})
