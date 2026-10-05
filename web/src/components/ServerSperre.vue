<script setup>
// Ein Server ohne Lizenz oder ein gesperrter Server (04.10.2026): er beantwortet unter /api nur /api/health. Die Oberfläche zeigt dann nur diesen
// Zustand — kein Anmelden, keine Ansicht, keine Meldung je abgewiesener Anfrage. Erlaubt die Lizenz ihn wieder, geht es ohne Neuladen weiter (store.poll).
import { store } from '../store.js'
</script>

<template>
  <div class="server-sperre">
    <img src="/logo-128.png" :alt="$t('journali PIM')" onerror="this.style.display='none'" />
    <!-- Startphase: ein Server je Datenbank (05.10.2026) -->
    <div v-if="store.serverSperre === 'lizenz' && store.startphase" class="neg satz"
      :title="$t('Auf einer Datenbank arbeitet ein Server. Dieser führt keine Jobs aus und beantwortet unter /api nur /api/health.')">
      {{ $t("Auf dieser Datenbank arbeitet schon ein Server.") }}</div>
    <div v-else-if="store.serverSperre === 'lizenz'" class="neg satz"
      :title="$t('Auf dieser Datenbank dürfen {0} Server laufen. Dieser Server führt keine Jobs aus und arbeitet wieder, sobald die Lizenz einen weiteren erlaubt.', [store.erlaubteServer ?? 1])">
      {{ $t("Für einen weiteren Server fehlt die Lizenz.") }}</div>
    <div v-else class="neg satz" :title="$t('Die Sperre gilt, bis ein Administrator sie unter Einstellungen → Server aufhebt.')">{{ $t("Dieser Server ist gesperrt.") }}</div>
    <div class="mono muted">{{ store.version }}<span v-if="store.build"> ·{{ store.build }}</span></div>
  </div>
</template>

<style scoped>
.server-sperre { height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; background: var(--bg); }
.server-sperre img { width: 64px; height: 64px; }
.satz { font-size: 16px; font-weight: 600; }
</style>
