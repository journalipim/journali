# enrich — Anreicherung

Stand 30.09.2026. Braucht `da`. Ansicht: ✓ Datenanalyse → ⌕ Anreicherung; Knoten-Menü „Anreichern".

Fehlende Attributwerte finden und ergänzen — für Handelsware, deren Daten beim
Hersteller liegen: Vorschläge von der KI aus den vorhandenen Werten, mit Recherche
im Internet (Hersteller, Typ, EAN → Datenblatt, Katalog), oder manuell mit Suchlinks.

## Ablauf

1. **Teilbaum laden** — der Anwender wählt einen Knoten; das Plugin lädt ihn mit
   allen Unterknoten und ihren Attributwerten (`/api/nodes/{id}/table?deep=true&self=true`).
2. **Leere Attribute erkennen** — das Plugin sammelt je Attribut, welche Knoten keinen
   Wert haben. Das Ergebnis ist eine Mischliste (gruppiert nach Attributgruppe), jedes
   Attribut mit der Zahl der leeren Knoten.
3. **Anwender wählt** — Häkchen an den Attributen, die gesucht werden sollen. Nicht
   gewählte werden übersprungen.
4. **Zuordnen** — die gewählten Attribute werden den konkreten Knoten zugeordnet: nur
   dort, wo der Wert wirklich fehlt. Knoten, deren leere Attribute nicht in der Auswahl
   stehen, fallen weg.
5. **Recherchieren** — drei Modi:
   - **KI + Websuche**: die KI sucht im Internet (Hersteller, Typ, EAN → Datenblatt)
     und nennt je Wert Sicherheit und Quelle. Kostet KI-Token und Websuch-Gebühren.
   - **Nur KI**: die KI schlägt aus ihrem Wissen vor (keine Websuche). Günstiger, für
     spezifische Produkte weniger treffsicher.
   - **Manuell**: das Plugin baut Suchbegriffe aus den vorhandenen Werten und zeigt
     Google-Links. Der Anwender sucht selbst und trägt den Wert in die Ergebnistabelle
     ein. Keine KI-Kosten.
6. **Ergebnis** — Tabelle: Knoten × Attribut × Vorschlag (absteigend nach Konfidenz),
   je Wert mit Quelle. Der Anwender hakt an und ändert, was nötig ist.
7. **Übernehmen** — angehakte Werte als ein Stapel ins Journal (`/api/batch`,
   `attribute.set` und `value.source` mit Quelle, Weg und Prüfdatum).

## Kontext je Knoten

Für jeden Knoten, dem ein gesuchtes Attribut fehlt, werden alle vorhandenen Werte als
Kontext an die KI geschickt — Name, Rolle, Artikelnummer, EAN, Beschreibung und jedes
andere Attribut, das einen Wert hat. Je mehr vorhanden ist, desto besser die Treffer.

## Kosten und Grenzen

- KI + Web: bis 6 Suchen je Knoten beim Anbieter; die Kosten wachsen mit der Zahl der
  Knoten × Attribute.
- Nur KI: ein Aufruf je Knoten, günstiger, aber begrenzt auf das Wissen des Modells.
- Manuell: keine KI-Kosten; der Anwender recherchiert selbst.

Eigener KI-Schlüssel (Einstellungen → KI); journali bietet keine KI an.
