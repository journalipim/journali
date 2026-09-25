# OnlyOffice-Plugin (Tabellen)

Seitenleiste in OnlyOffice Tabellen (Desktop Editors oder Docs), spricht mit
`/api` des eingetragenen Servers. Gleiche Bedienung wie das Excel-Add-in:
Knoten suchen, laden, in der Tabelle pflegen, „Geändertes speichern" schreibt
nur die Differenz zum Schnappschuss als einen Stapel. Der Schnappschuss liegt im
versteckten Blatt `_journali` — Datei speichern, später weiterpflegen, geht.

## Installieren (OnlyOffice Desktop Editors)

1. Paket holen: `http://localhost:5000/plugins/ooaddin/package.plugin`
   (der Server packt das Verzeichnis als ZIP im OnlyOffice-Format) und als
   `journali.plugin` speichern.
2. OnlyOffice: Tabelle öffnen → Reiter **Plugins** → **Plugin-Manager**
   (Einstellungen) → **Plugin hinzufügen** → `journali.plugin` wählen.
3. Im Reiter Plugins erscheint „journali"; die Leiste öffnet sich links.

Da das Plugin dann lokal aus dem Plugin-Ordner läuft, ruft es den Server per
`fetch` von einem anderen Origin auf — der Server erlaubt das im
Entwicklungsmodus (CORS offen); für den Betrieb auf einem Server muss der
Origin des Editors erlaubt sein.

## Bedienung

| | |
|---|---|
| Server | Basis-URL, gemerkt |
| 👤 Name | Urheber im Journal (`X-Actor`), gemerkt |
| 🔍 Knoten | Suche wie im Baum (auch Bedingungen wie `attr:function`) |
| Zeilen · Sprache · Sicht | Subitems / alle Varianten / alle Produkte darunter; eine Sprache je Blatt; Attributsicht des Knotentyps |
| ⇩ ins Blatt laden | Zeile 1 Schlüssel, Zeile 2 Namen, Spalte A Id, geerbt kursiv, alles Text |
| 💾 Geändertes speichern | nur geänderte Zellen, ein Stapel `oo-…`, danach neu laden |

## Grenzen (0.1)

Wie beim Excel-Add-in: keine neuen Zeilen, keine `rows`/Formel-Attribute,
eine Sprache je Blatt. Die Zellen-API des Document Builders ist bei
Bereichen je nach Version unterschiedlich — bei Problemen mit `SetValue`
auf Bereichen schreibt das Plugin Zelle für Zelle.
