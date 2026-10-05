<!-- nur-mit-lizenz -->
# Nutzungslimits und Lizenzierung

journali zählt Pflege, nicht Nutzer und nicht Produkte. Die Einheit ist der **journali-Token**: ein Eintrag im Journal, der Pflege oder Ausleitung ist.

## Was zählt

| Zählt | Zählt nicht |
|---|---|
| Benennen, jeden Wert setzen, Status, Kennung, Reihenfolge | Modell: Attribute, Gruppen, Listen, Sichten, Sprachen, Kanäle |
| Anlegen und Zurückziehen von Knoten, Zeilen, Assets, Relationen | Struktur: Publikationsbäume, Rubriken |
| Freigeben und Zurücknehmen, Versionen | Einrichtung: Anwender, Rollen, Teams, Plugins, Workflows |
| Übersetzungsaufträge, Workflow-Schritte | Betrieb: Jobläufe, Sicherung, Protokolle |
| Import und Kopieren, ein Eintrag je geändertem Wert | Lesen und Exportieren |

Der Verbrauch lässt sich nicht zurücksetzen, er ist das Journal. Eine Lizenz kann einen **Zählbeginn** setzen: was davor liegt, bleibt stehen und zählt nicht mehr, etwa nach einer Migration.

## Grenzen je Woche und Monat

Die Grenzen hängen am Team, am Ende der Zahlerkette. Die Kopfzeile zeigt zwei Balken: was in dieser Woche und in diesem Monat genutzt ist; ⚙ Einstellungen → ◍ Team zeigt, was verfügbar ist, mit Verlauf. Ist eine Grenze erreicht, weist der Server jeden Eintrag ab, der zählt; alles andere geht weiter. Die Woche beginnt montags, der Monat am Ersten.

## Tarife

| Tarif | Woche / Monat | Publikationsbäume | Plugins |
|---|---|---|---|
| Kostenlos | 10 000 / 50 000 | 1 | Tabelle, Excel-Add-in, OnlyOffice, Vorschauen, Export |
| Pro | 50 000 / 250 000 | 5 | dazu Datenblatt, Übersetzung, Vorlagen-Export, ETIM, Datenanalyse, Sicherung als Job |
| Pro+ | 50 000 / 250 000 | 5 | alle |
| Enterprise | 200 000 / 1 000 000 | ohne Grenze | alle |
| Unlimited | ohne Grenze | ohne Grenze | alle |

Grenzen gelten je Team; Plugins und Publikationsbäume gelten für die ganze Instanz nach ihrem höchsten Tarif. Die Preise stehen im Shop.

## Test und Kostenlos

Jede neue Instanz hat drei Monate Enterprise ab dem ersten Journaleintrag. Danach, und nach Ablauf jeder Lizenz, gilt Kostenlos. Eine wiederhergestellte Instanz beginnt den Test nicht von vorn; der erste Tag kommt aus dem Journal.

## Lizenz und Schlüssel

Eine Lizenz ist auf die **Instanz** ausgestellt, deren Kennung unter ◍ Team steht, und gehört zu einem Team. Sie kommt als Text und wird in das Feld unter ⚿ journali Lizenz eingefügt. Zwei Wege:

- **Abo**: der Schlüssel aus dem Shop wird eingefügt; die Instanz bestätigt ihn täglich beim Lizenzserver. Ohne Verbindung gilt der letzte bestätigte Stand sieben Tage, danach der Testbetrieb. Ein Tarifwechsel wirkt sofort, eine Kündigung zum Ende der bezahlten Periode.
- **Ohne Internet**: die Instanz erzeugt eine signierte Anforderung, die per Kopie eingereicht wird; zurück kommt ein Schlüssel mit fester Laufzeit für dasselbe Feld.

Ein **Reset-Schlüssel** setzt das Kontingent eines Teams in der laufenden Periode neu, getrennt für Pro und Enterprise. Er wird beim Team eingelöst, das sein Kontingent selbst trägt.

## Mehrere Teams

Das Init Team trägt die Grenzen der Lizenz. Jedes weitere Team hat, was die Lizenz ihm namentlich zuschreibt, sonst nichts; dann rechnet es über ein anderes Team ab. Wer zentral abrechnen will, legt das Abo aufs Init Team.
