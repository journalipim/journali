# enrich — Anreicherung

Stand 20.09.2026. Braucht `da`. Ansicht: ✓ Datenanalyse → ⌕ Anreicherung; Knoten-Menü „Anreichern“.

Taloan, 20.09.2026: „Im Gegensatz zu DPP und PPWR geht es um Produktdaten von Produkten, die nicht
meine Produkte sind, die ich aber handle“ — die Daten liegen beim Hersteller (Webseite,
Datenblatt, Katalog), nicht im eigenen Bestand. Werkzeuge wie onedot füllen solche Lücken per
KI und Internetrecherche; hier macht das Claude mit dem eigenen Schlüssel (Einstellungen → KI),
journali bietet keine KI an.

## Ablauf

1. **Attribute wählen** (oben, nach Gruppen; gemerkt als `attributes` in den Plugin-Daten) —
   das ist der Katalog: jedes gewählte Attribut ein Pflicht-Datenpunkt, Zuordnung auf sich selbst.
2. **Teilbaum prüfen** — die Prüfmaschine der Oberfläche (`web/src/compliance.js`, dieselbe wie
   DPP/PPWR/ETIM) zeigt je Knoten erfüllt/leer/fraglich und die Trefferquote.
3. **Vorschläge** — ⚙ aus Regeln (Ableitungen), ✦ von Claude aus den vorhandenen Werten des Knotens,
   ⌕ **Recherche im Internet**: Claude bekommt Name, SKU, Hersteller, Typ, EAN und die externen
   Kennungen des Knotens, sucht mit dem Werkzeug `web_search` (bis 6 Suchen je Knoten) und
   nennt je Wert Sicherheit und Quelle (`↗ Quelle`). Ohne Haken: die ersten 5 Knoten mit Lücken.
4. **Übernehmen** — nur angehakte Werte (ab 70 % vorangehakt, jeder Wert änderbar), ein Stapel ins
   Journal (`/api/batch`, `attribute.set`); Listenwerte werden über die Bezeichnung aufgelöst.

## Kosten und Grenzen

Jede Suche kostet beim Anbieter extra (Websuche wird je Aufruf berechnet); der Schlüssel bleibt im
Browser. Die KI erfindet nichts, was sie nicht findet — findet sie nichts, bleibt der Wert leer.
Was übernommen wird, entscheidet der Mensch; die Quelle steht am Vorschlag, nicht am Wert
(ein Beleg am Wert wäre ein eigener Eintragstyp — offen).
