# Sicherung und Wiederherstellung

Eine Sicherung ist eine Vollsicherung in ein Verzeichnis auf dem Server: das Journal mit allen Einträgen, die Assets, die Dateien neben dem Journal und die Plugin-Verzeichnisse.

## Von Hand

⚙ Einstellungen → ⇅ B&R sichert auf Knopfdruck in ein gewähltes Verzeichnis und zeigt vorher, was dieses System hat und was im Verzeichnis liegt: Einträge, Assets, Dateien, Plugins. Assets aus der Datenbank gehen mit; liegen sie in einem Verzeichnis oder in S3, sichert das der Betrieb des Servers.

## Die Datenbank selbst sichern

Wer die Datenbank mit eigenen Mitteln sichert, findet ihre Verbindung unter ⚙ Einstellungen → ⇅ B&R → **⛁ Datenbank**:
Host, Port, Datenbank und Anmeldename. Das Passwort ist verdeckt; anzeigen fragt in einem eigenen Fenster nach dem eigenen
Anmeldepasswort, und nach einer Minute ist es wieder verdeckt. Den Abschnitt sieht, wer Anwender und Rollen verwaltet.

## Als Job

<!-- lizenz -->
Das Plugin Sicherung läuft als Job mit Zeitplan: je Lauf ein Ordner mit Zeitstempel, ältere werden nach der Aufbewahrung weggeräumt. Es gehört zum Tarif Pro.
<!-- /lizenz -->
<!-- startphase -->
Das Plugin Sicherung läuft als Job mit Zeitplan: je Lauf ein Ordner mit Zeitstempel, ältere werden nach der Aufbewahrung weggeräumt.
<!-- /startphase -->

## Was mitgeht

| Teil | Inhalt |
|---|---|
| Journal | alle Einträge, in der Reihenfolge ihrer Nummern |
| Assets | die Dateien nach Prüfsumme |
| Zugänge | Anmeldungen und Passwort-Hashes, Token, Speicher- und Mail-Einstellungen, Geheimnisse der Jobs |
| Plugins | die Verzeichnisse ohne Pakete |

<!-- lizenz -->
Nicht mit geht die Kennung der Instanz: eine wiederhergestellte Instanz bekommt eine neue, und eine Lizenz gilt nur für die Instanz, für die sie ausgestellt ist.
<!-- /lizenz -->
<!-- startphase -->
Nicht mit geht die Kennung der Instanz: eine wiederhergestellte Instanz bekommt eine neue.
<!-- /startphase -->

## Zurück

Eingespielt wird nur in ein **leeres** System, sonst kollidierten die Eintragsnummern. Der Server baut danach seine Abbilder aus dem Journal neu. Der erste Tag des Tests kommt aus dem Journal mit; ein wiederhergestelltes System fängt den Test nicht von vorn an.

Ein **Teilbaum** aus einem JSON-Export lässt sich auch in ein volles System einspielen: neu anlegen, angleichen, zurückholen, mit Modellteil.

## Spiegel und Schnappschuss

Zwei Kopien, die den Start schnell machen, beide nur Cache: der **Spiegel** hält die Journaleinträge als Datei neben dem Server, der **Schnappschuss** den Stand aller Abbilder. Beim Start kommt alles bis zum Spiegelstand von der Platte, nur der Rest aus der Datenbank; der letzte Eintrag wird gegen die Datenbank geprüft. Beide lassen sich unter ▨ Storage → Start ein- und ausschalten und jederzeit wegwerfen; beim nächsten Start wird neu gelesen.

## Test und Produktion

<!-- lizenz -->
Wer eine Testinstanz neben der Produktion betreibt, spielt eine Sicherung der Produktion in die leere Testinstanz ein. Die Testinstanz bekommt eine eigene Kennung und ihre eigene Lizenz.
<!-- /lizenz -->
<!-- startphase -->
Wer eine Testinstanz neben der Produktion betreibt, spielt eine Sicherung der Produktion in die leere Testinstanz ein. Die Testinstanz bekommt eine eigene Kennung.
<!-- /startphase -->
