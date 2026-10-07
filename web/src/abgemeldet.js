// Abgemeldet (01.10.2026): auf der Anmeldeseite und überall, wo ein Benutzer fehlt, obwohl es Benutzer gibt, zeigt die Oberfläche nichts von der Instanz —
// keine Leiste mit den Plugins, keine Kennzahlen, keinen Namen, keine Lesezeichen. Sie stammten sonst vom Zustand davor (gemerkter Name, letzte Zählung).
// Ohne Benutzer in der Instanz (auth.enabled false) bleibt alles offen wie bisher.
export const istAbgemeldet = (path, auth) => path === '/login' || (!!auth?.enabled && !auth?.user)
