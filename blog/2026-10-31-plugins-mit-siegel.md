---
title: Plugins mit Siegel – journali wächst mit, und jeder sieht, was Original ist
excerpt: Ein Plugin ist ein Verzeichnis mit Manifest, läuft nie im Serverprozess und trägt ein Siegel, das der Server prüft – so bleibt journali erweiterbar und trotzdem geordnet.
slug: plugins-mit-siegel
tags: [Architektur, Betrieb]
categories: [Entwicklung]
date: 2026-10-31 06:00
wp: 160
---
Ihr tauscht auf dem Server ein Plugin aus – eine neue Version, ohne dass journali neu ausgeliefert wird. Am nächsten Tag fragt jemand im Team: Ist das noch das Original? **In ⬡ Plugins steht die Antwort neben dem Namen:** ein ❖, wenn alles stimmt, ein ⚠ mit Grund, wenn nicht. Niemand muss Dateien vergleichen.

## Ein Plugin ist ein Verzeichnis

Alles, was über den Kern hinausgeht, ist ein Plugin: Import und Export, Datenblatt, Übersetzung, Datenanalyse, Werkzeuge. Ein Plugin ist **ein Verzeichnis unter `plugins/` mit einer `plugin.json`** – Schlüssel, Version, Bezeichnung, Art, Einstieg oder Befehl, Parameter. Mehr braucht es nicht.

Im Container liegt `plugins/` als Bind-Mount. Ihr tauscht ein Plugin also aus, ohne ein neues Image zu bauen. Liegt auf der Platte eine neuere Version als die installierte, zeigt ⬡ Plugins ein **↑**, und mit einem Klick übernehmt ihr sie.

## Kein Plugin läuft im Serverprozess

Das ist die Regel, auf die es ankommt:

- **Browser-Plugins** sind ein ES-Modul, das die Oberfläche lädt.
- **Prozess-Plugins** startet der Server als Kindprozess. Der Befehl und seine Argumente stehen im Manifest.

Beide sprechen mit journali **nur über die Schnittstelle** unter `/api`. Ein Prozess-Plugin bekommt dafür für den Lauf ein Dienst-Token. Nach der Regel von journali greift ein Plugin nur über diese Schnittstelle auf journali zu. Seine Daten – Vorlagen, Profile, Regeln – legt es als benannte Datensätze im Journal ab, sichtbar für alle und nachvollziehbar.

## Das Siegel: Original von journali

Jedes mitgelieferte Plugin trägt neben dem Manifest ein `certificate.json`. Darin stehen Schlüssel, Version und der Hash über alle Dateien des Verzeichnisses, dazu eine Signatur. **Der Server prüft sie mit dem eingebauten öffentlichen Schlüssel**, jedes Mal, wenn er die Plugins von der Platte liest. In der Oberfläche heißt das nicht „zertifiziert“ – das klänge nach einer Prüfstelle, die es nicht gibt –, sondern **journali Core Plugin**: ein Original von journali.

Was ein Siegel bedeutet:

- Schlüssel und Version sind die, für die es ausgestellt wurde.
- **Seitdem wurde keine Datei verändert, hinzugefügt oder entfernt.**

Wird eine Datei geändert, steht ⚠ **Siegel gebrochen** mit dem Grund, etwa „Dateien verändert“. Das Plugin bleibt nutzbar, trägt aber kein Siegel mehr.

## Was ein Siegel nicht bedeutet

Hier lohnt Ehrlichkeit. **Ein Siegel sagt nichts über das Verhalten eines Plugins aus**, nur über seine Dateien. Es sagt auch nicht, ob ein Plugin gut ist, und bei einem gebrochenen Siegel nicht, wer etwas geändert hat. Ein Plugin ohne Siegel läuft genauso wie eines mit; es trägt nur kein Zeichen. Das Zeichen sagt, **woher** ein Plugin kommt.

Dazu gehört auch, was nicht zum Hash zählt: Pakete im Ordner `node_modules`, Zwischenspeicher, die ein Plugin zur Laufzeit füllt, und Ausgabeverzeichnisse, die ein Siegel ausdrücklich ausnimmt.

Und weil ein Siegel nur so viel wert ist wie sein Schlüssel: Wer eigene Plugins mit eigenem Schlüssel siegelt, trägt dessen öffentlichen Teil beim Server ein. Die Oberfläche nennt dann diesen Herausgeber namentlich.

## Ein Katalog, der nur Gesiegeltes annimmt

Neben der Liste zeigt ⬡ Plugins den **Katalog** des Herausgebers. Mit ⇩ holt der Server ein Plugin als Zip, entpackt es in ein Temporärverzeichnis und prüft das Siegel. **Nur mit gültigem Siegel kommt es nach `plugins/`.** Danach installiert und schaltet ihr es ein wie jedes andere. Ohne Verbindung ist der Katalog leer. Der Katalog enthält nur Plugins von journali, und nur sie tragen das Siegel von journali.

## Basis und Ergänzung

Ein **Basis-Plugin** bringt die Grundfunktion einer Gruppe der Leiste mit und nimmt Ergänzungen auf:

- **Tabelle** für Import und Export – dazu CSV, Excel, JSON und Solr,
- **Datenanalyse** für die Prüfungen – dazu Digitaler Produktpass, Verpackung (PPWR), Werbeaussagen (EmpCo) und ETIM,
- **Jobs** für die Prozesse – dazu etwa die Sicherung.

Eine Ergänzung nennt, was sie braucht. Fehlt die Basis, **lehnt der Server das Einschalten ab** und sagt, was zuerst an sein muss. Wird eine Basis ausgeschaltet, steht bei ihren Ergänzungen „◐ an, Basis aus“ – sie wirken dann nicht.

## Was ein Plugin beitragen kann

Ein Browser-Plugin meldet an, was es mitbringt:

- **Ansichten** – eine eigene Kachel in der Übersicht ihres Themas,
- **Knotenaktionen** im Kontextmenü des Baums,
- **Bänder** in der Knotenansicht,
- **Importer** für den Tabellenimport, nach Dateiendung gewählt,
- **Prüfregeln** für die Datenqualität.

Die Oberfläche sammelt diese Beiträge aller wirkenden Plugins ein. Schaltet ihr eines aus, sind auch seine Beiträge weg.

## Ein, aus und bereit

Unter ⬡ Plugins seht ihr zu jedem Plugin Version und **Zustand**: nicht installiert, aus, an, an mit ausgeschalteter Basis. Installieren nimmt das Plugin ins Journal auf, Einschalten macht es wirksam. Beim Einschalten legt ein Plugin an, was es zum Arbeiten braucht, etwa eine Attributgruppe – ein Plugin, das Gruppen oder Attribute anlegt, **fragt vorher nach**. Lehnt ihr ab, ist das Plugin wieder aus, und nichts wurde angelegt.

Manche Plugins brauchen etwas, das niemand in journali setzt: eine Erweiterung der Datenbank, ein Modell, einen erreichbaren Dienst. Solche Plugins nennen im Manifest einen Endpunkt, der Bereitschaft meldet. Steht etwas aus, zeigt die Liste **„◑ an, nicht bereit“**, und der Grund steht daneben. Ihr wartet also nicht auf einen Job, der nichts tun kann.

Was journali selbst trägt – etwa Jobs, Sicherung und Zugänge –, lässt sich ausschalten, aber nicht entfernen.

## Und jetzt?

journali ist noch in Entwicklung – Plugins, Siegel und Katalog stecken schon drin. Hier entsteht etwas ganz Großes, und ihr könnt dabei sein: [Bleibt dran](/#kontakt).
