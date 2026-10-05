<script setup>
// Einstellungen → ⧉ Server (pflegestruktur 41): welche Server auf diese Datenbank zugreifen. Einer ist Hauptserver und führt die Jobs aus,
// die anderen sind Arbeitsserver. Hauptserver festlegen und sperren schreibt ins Journal; die Liste selbst (Puls, Stand, laufende Jobs)
// kommt aus der Tabelle neben dem Journal und wird alle fünf Sekunden neu gelesen.
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { api, when } from '../api.js'
import { dialog } from '../dialog.js'
import { store } from '../store.js'
import { t } from '../i18n.js'
import { bauKurz, bauLang } from '../bau.js'

const d = ref(null)
const said = ref('')
const busy = ref(false)
let takt = null

async function laden() { try { d.value = await api.get('/api/server') } catch (e) { said.value = '✗ ' + e.message } }
onMounted(() => { laden(); takt = setInterval(laden, 5000) })
onUnmounted(() => clearInterval(takt))

const liste = computed(() => d.value?.server ?? [])
/// Der festgelegte Hauptserver, wenn er nicht erreichbar ist: dann laufen keine Jobs
const hauptWeg = computed(() => { const h = liste.value.find(s => s.haupt); return h && !h.erreichbar ? h : null })
const jobs = s => Array.isArray(s.jobs) ? s.jobs : []
const andereVersion = s => s.version && d.value?.version && s.version !== d.value.version
/// Ein anderer Bau (mehr als eine Minute auseinander): er kann Eintragstypen schreiben, die der andere nicht kennt
const andererBau = s => s.built && d.value?.built && Math.abs(new Date(s.built) - new Date(d.value.built)) > 60000
/// Wie der Server in Meldungen heisst: sein Name, sonst der Rechnername
const name = s => s.name || s.host

// Benennen in der Zelle: Klick öffnet das Feld, Enter oder Verlassen speichert, Esc verwirft. Leer = wieder der Rechnername
const bearbeite = ref(null)
const entwurf = ref('')
const feld = ref(null)
async function benennen(s) {
  bearbeite.value = s.id; entwurf.value = s.name ?? ''
  await nextTick(); (Array.isArray(feld.value) ? feld.value[0] : feld.value)?.focus()
}
async function speichern(s) {
  if (bearbeite.value !== s.id) return
  bearbeite.value = null
  const neu = entwurf.value.trim()
  if (neu === (s.name ?? '')) return
  await tun(() => api.post(`/api/server/${s.id}/name`, { name: neu }, 'PUT'))
}

async function tun(f, ok) {
  busy.value = true; said.value = ''
  try { await f(); said.value = ok ?? ''; await laden() } catch (e) { said.value = '✗ ' + e.message } finally { busy.value = false }
}
async function zumHaupt(s) {
  if (!(await dialog.confirm({ title: t('{0} zum Hauptserver machen', [name(s)]), text: t('Systemjobs und Zeitplan-Jobs laufen dann dort.'), ok: t('Hauptserver') }))) return
  await tun(() => api.post(`/api/server/${s.id}/haupt`, {}, 'PUT'), t('✓ {0} ist Hauptserver.', [name(s)]))
}
async function sperren(s, an) {
  if (an && !(await dialog.confirm({ title: t('{0} sperren', [name(s)]), text: t('Der Server beantwortet danach keine Anfrage mehr.'), ok: t('Sperren'), danger: true }))) return
  await tun(() => api.post(`/api/server/${s.id}/sperre`, { gesperrt: an }, 'PUT'), an ? t('✓ {0} gesperrt.', [name(s)]) : t('✓ {0} freigegeben.', [name(s)]))
}
const entfernen = s => tun(() => api.del(`/api/server/${s.id}`))
</script>

<template>
  <div class="section" v-if="d">
    <h2 :title="$t('Server, die auf diese Datenbank zugreifen. Der Hauptserver führt die Jobs aus, die Arbeitsserver bedienen Oberfläche und Schnittstelle.')">{{ $t("⧉ Server") + ' ' }}<span class="muted" :title="$t('erreichbar und erlaubt · {0} erlaubt', [d.erlaubt >= 2147483647 ? '∞' : d.erlaubt ?? 1])">· {{ liste.length }}</span></h2>
    <div v-if="hauptWeg" class="neg haupt-weg" :title="$t('Systemjobs und Zeitplan-Jobs laufen erst wieder, wenn er erreichbar ist oder ein anderer Server Hauptserver wird.')">{{ $t("✗ Der Hauptserver {0} ist nicht erreichbar.", [name(hauptWeg)]) }}</div>
    <table class="grid server">
      <thead><tr>
        <th></th><th>{{ $t("Name") }}</th><th>{{ $t("Rechner") }}</th><th>{{ $t("Rolle") }}</th><th :title="$t('Version und Build wie in der Kopfleiste (TTMM.hhmm)')">{{ $t("Version") }}</th><th :title="$t('Stand des Journals auf diesem Server')">#</th>
        <th :title="$t('letzter Puls')">{{ $t("Puls") }}</th><th :title="$t('laufende Jobs')">{{ $t("Jobs") }}</th><th></th>
      </tr></thead>
      <tbody>
        <tr v-for="s in liste" :key="s.id" :class="{ selbst: s.selbst, aus: !s.erreichbar }">
          <td :title="s.erreichbar ? $t('erreichbar') : $t('nicht erreichbar')"><span :class="s.erreichbar ? 'pos' : 'muted'">{{ s.erreichbar ? '●' : '○' }}</span></td>
          <td class="name">
            <input v-if="bearbeite === s.id" ref="feld" v-model="entwurf" :placeholder="s.host" maxlength="60" @keydown.enter.prevent="speichern(s)" @keydown.esc.prevent="bearbeite = null" @blur="speichern(s)" />
            <span v-else class="benennen" :class="{ muted: !s.name }" @click="benennen(s)" :title="$t('Name ändern (leer = Rechnername)')">{{ s.name || '✎' }}</span>
            <span v-if="s.selbst" class="muted" :title="$t('Diese Oberfläche kommt von diesem Server.')"> · {{ $t("dieser") }}</span>
          </td>
          <td class="mono muted" :title="s.id">{{ s.host }}</td>
          <td class="rolle">
            <span v-if="s.gesperrt" class="neg" :title="$t('Beantwortet keine Anfrage unter /api.')">⊘ {{ $t("gesperrt") }}</span>
            <span v-else-if="s.lizenziert === false && store.startphase" class="neg ohne-lizenz" :title="$t('Auf einer Datenbank arbeitet ein Server; dieser beantwortet keine Anfrage unter /api.')">⊘ {{ $t("zweiter Server") }}</span>
            <span v-else-if="s.lizenziert === false" class="neg ohne-lizenz" :title="$t('Mehr Server, als die Lizenz erlaubt ({0}); dieser beantwortet keine Anfrage unter /api. Der Hauptserver hat Vorfahrt.', [d.erlaubt ?? 1])">⊘ {{ $t("ohne Lizenz") }}</span>
            <span v-else-if="s.haupt" :title="$t('Führt Systemjobs, Zeitplan-Jobs und Jobs von Hand aus.')">◆ {{ $t("Hauptserver") }}</span>
            <span v-else class="muted" :title="$t('Bedient Oberfläche und Schnittstelle; Jobs gehen an den Hauptserver.')">◇ {{ $t("Arbeitsserver") }}</span>
            <span v-if="s.import" class="warn" :title="$t('Ein Import läuft; die Systemjobs warten.')"> ⇵</span>
          </td>
          <td class="mono version"><span :class="{ warn: andereVersion(s) || andererBau(s) }"
            :title="[s.built ? $t('gebaut {0}', [bauLang(s.built)]) : '', andereVersion(s) ? $t('Andere Version als dieser Server.') : andererBau(s) ? $t('Anderer Build als dieser Server.') : ''].filter(Boolean).join(' · ')">{{ s.version ?? '—' }}<template v-if="s.built"> ·{{ bauKurz(s.built) }}</template></span></td>
          <td class="mono">{{ s.head ? '#' + s.head : '—' }}</td>
          <td class="mono muted" :title="s.started ? $t('läuft seit {0}', [when(s.started)]) : ''">{{ s.puls ? when(s.puls) : '—' }}</td>
          <td class="mono" :title="jobs(s).map(j => j.key + (j.reason ? ' (' + j.reason + ')' : '')).join(', ')">{{ jobs(s).length || '' }}</td>
          <td class="aktionen">
            <button v-if="!s.haupt && !s.gesperrt && s.erreichbar" :disabled="busy" @click="zumHaupt(s)" :title="$t('Hauptserver festlegen (Systemjobs und Zeitplan-Jobs laufen dann dort)')">◆</button>
            <button v-if="!s.gesperrt && !s.haupt && !s.selbst" :disabled="busy" @click="sperren(s, true)" :title="$t('Server sperren (beantwortet keine Anfrage mehr)')">⊘</button>
            <button v-if="s.gesperrt" :disabled="busy" @click="sperren(s, false)" :title="$t('Server freigeben')">○</button>
            <button v-if="!s.erreichbar && !s.haupt" class="x" :disabled="busy" @click="entfernen(s)" :title="$t('Server aus der Liste entfernen (eine Sperre bleibt)')">✕</button>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-if="said" class="said" :class="said.startsWith('✗') ? 'neg' : 'pos'">{{ said }}</div>
  </div>
  <div v-else-if="said" class="section neg">{{ said }}</div>
</template>

<style scoped>
.server td { vertical-align: middle; }
.server tr.selbst td { font-weight: 600; }
.server tr.aus td { opacity: .7; }
.aktionen { white-space: nowrap; text-align: right; }
.aktionen button { margin-left: 4px; }
.haupt-weg { margin: 4px 0 8px; }
.benennen { cursor: text; }
.name input { width: 14em; }
.said { margin-top: 8px; }
</style>
