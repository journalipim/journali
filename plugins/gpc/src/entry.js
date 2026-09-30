// Plugin gpc: die GS1-Produktklassifikation (GPC). Die Veröffentlichung liest der Anwender aus einer Datei ein, die er bei GS1
// holt; ein Brick wird einem Knoten zugewiesen, das Modell dazu legt der Server an (/api/classification).
import View from './View.vue'
import { t } from 'journali'
import { systemSpec } from '../core.mjs'

/// Einmal beim Einschalten: die Gruppe entsteht und hängt an jeder Wurzel des Pflegebaums. Die Attribute entstehen erst mit dem
/// ersten zugewiesenen Brick — die Gruppe allein kostet nichts, ihre Attribute tragen Bedingungen und gelten nur, wo ihr Brick gilt.
async function install(ctx) {
  const { api, store, tree } = ctx
  if (!tree.loaded) await tree.load()
  const settings = (await api.get('/api/plugins/gpc/data/settings').catch(() => null)) ?? {}
  const r = await api.post('/api/classification/ensure', { system: systemSpec(settings), groupOnly: true })
  const group = r?.group ?? systemSpec(settings).group
  if (r?.groupRenamed) await api.post('/api/plugins/gpc/data/settings', { ...settings, group }, 'PUT')
  await store.poll?.(true)
  for (const root of tree.rows.filter(row => !row.parent && row.role !== 'rubric')) {
    const have = (root.groups ?? '').split(',').filter(Boolean)
    if (!have.includes(group)) await api.post(`/api/nodes/${encodeURIComponent(root.id)}/groups`, { groups: [...have, group] }, 'PUT')
  }
  await store.poll?.(true); await tree.load?.(true)
}

export default {
  install,
  views: [{ path: 'gpc', topic: 'classification', label: 'GPC', icon: '⌗', hint: t('GPC-Veröffentlichung einlesen, Brick suchen und einem Knoten zuweisen'), component: View }],
  nodeActions: [{
    label: t('GPC-Klasse (+)'), icon: '⌗', topic: 'classification', roles: ['group', 'product'], hint: t('Brick wählen und diesem Knoten zuweisen'),
    run: (id, ctx) => ctx.go(`/p/gpc/gpc?node=${encodeURIComponent(id)}`),
  }],
}
