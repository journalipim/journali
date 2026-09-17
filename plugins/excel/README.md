# Excel-Add-in (Office.js)

Aufgabenbereich in Excel, der direkt mit `/api` spricht. Kein Code im Server;
die Dateien liegen unter `plugins/excel/` und werden wie jedes Plugin unter
`/plugins/excel/…` ausgeliefert. Das Manifest bekommt den Origin des Servers
beim Abruf eingesetzt (`{{ORIGIN}}` → `http://localhost:5000` oder die rossibox).

## Einrichten (Excel für Windows, einmalig)

1. Manifest holen: `http://localhost:5000/plugins/excel/manifest.xml` als
   Datei speichern (z. B. `C:\journali-addin\manifest.xml`).
2. Ordner freigeben und in Excel als Katalog eintragen: Datei → Optionen →
   Trust Center → Einstellungen → Vertrauenswürdige Add-In-Kataloge →
   Pfad `\\<PC>\journali-addin` hinzufügen, „Im Menü anzeigen“ anhaken, Excel neu starten.
3. Einfügen → Meine Add-Ins → Freigegebener Ordner → journali.

Excel im Web / neues Excel: Einfügen → Add-Ins → Mein Add-In hochladen → manifest.xml.
Office verlangt HTTPS — ausser für `localhost`. Auf der rossibox braucht der
Server also ein Zertifikat (Reverse Proxy), sonst lädt Excel den Bereich nicht.

## Bedienung

| Schritt | |
|---|---|
| 👤 Name | Urheber im Journal (`X-Actor`), bleibt im Excel-Speicher |
| 🔍 Knoten | Suche wie im Baum (Name, SKU, Id), Treffer anklicken |
| Zeilen | Subitems des Knotens, oder alle Varianten / Produkte darunter |
| Sprache, Sicht | welche Sprache die Spalten zeigen, welche Attribute (◫ Sicht des Knotentyps) |
| ⇩ ins Blatt laden | Zeile 1 Schlüssel (nicht ändern), Zeile 2 Namen, ab Zeile 3 Daten; Spalte A Id; geerbt kursiv; alles als Text |
| … pflegen | alles, was Excel kann: ausfüllen, Reihen, Formeln (Ergebnis wird Text), Suchen & Ersetzen |
| 💾 Geändertes speichern | vergleicht mit dem Schnappschuss vom Laden, schreibt nur geänderte Zellen als **einen** Stapel (`xl-…`), lädt danach neu |
| ↻ | Blatt neu laden — eigene Änderungen gehen verloren |

Der Schnappschuss liegt in den Einstellungen der Arbeitsmappe
(`workbook.settings["journali"]`): Mappe speichern, später öffnen, weiterpflegen,
speichern — geht.

## Grenzen (0.1)

- Zeilen anlegen oder löschen macht das Add-in nicht — dafür ⇩ Import → Tabelle.
- `rows` (vermehrbare Attribute) und Formel-Attribute werden nicht geladen.
- Sprachabhängige Attribute: eine Sprache je Blatt; zweite Sprache = zweites Blatt.
