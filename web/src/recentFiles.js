// Zuletzt gewählte Dateien je Import (Taloan, 21.09.2026: „eine History der letzten 5 Dateien“). Über den Datei-Dialog gewählte
// Dateien (File System Access API, Chrome/Edge) werden als Handle in IndexedDB gemerkt und lassen sich wieder öffnen — der
// Browser fragt einmal nach Leserecht. Hineingezogene Dateien haben kein Handle: nur der Name bleibt, zum Wiedererkennen.
const DB = 'journali', STORE = 'recentFiles'
function open() {
  return new Promise((ok, no) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE) }
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error)
  })
}
async function read(key) { try { const db = await open(); return await new Promise((ok, no) => { const t = db.transaction(STORE, 'readonly').objectStore(STORE).get(key); t.onsuccess = () => ok(t.result ?? []); t.onerror = () => no(t.error) }) } catch { return [] } }
async function write(key, list) { try { const db = await open(); await new Promise((ok, no) => { const t = db.transaction(STORE, 'readwrite').objectStore(STORE).put(list, key); t.onsuccess = ok; t.onerror = () => no(t.error) }) } catch {} }

export const recentFiles = {
  /// die Liste (neueste zuerst): [{ name, at, handle? }]
  list: key => read(key),
  /// merken — Handle, wenn vorhanden; gleicher Name rückt nach vorn; höchstens 5
  async remember(key, name, handle = null) {
    const list = (await read(key)).filter(x => x.name !== name)
    list.unshift({ name, at: Date.now(), handle: handle ?? null })
    await write(key, list.slice(0, 5))
  },
  /// wieder öffnen: Leserecht erfragen, Datei liefern — null, wenn nicht möglich (kein Handle, verweigert, Datei weg)
  async reopen(entry) {
    if (!entry?.handle) return null
    try {
      if ((await entry.handle.queryPermission({ mode: 'read' })) !== 'granted' && (await entry.handle.requestPermission({ mode: 'read' })) !== 'granted') return null
      return await entry.handle.getFile()
    } catch { return null }
  },
  async forget(key, name) { await write(key, (await read(key)).filter(x => x.name !== name)) },
}
