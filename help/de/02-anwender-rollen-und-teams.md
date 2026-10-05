# Anwender, Rollen und Teams

<!-- lizenz -->
Drei Begriffe, die zusammenwirken: der **Anwender** ist eine Person mit Anmeldung, die **Rolle** sagt, was sie darf, das **Team** sagt, wessen Kontingent und wessen KI-Schlüssel sie nutzt.
<!-- /lizenz -->
<!-- startphase -->
Drei Begriffe, die zusammenwirken: der **Anwender** ist eine Person mit Anmeldung, die **Rolle** sagt, was sie darf, das **Team** sagt, wessen KI-Schlüssel sie nutzt.
<!-- /startphase -->

## Anwender

Ein Anwender hat einen Anmeldenamen, einen Anzeigenamen, eine Rolle und ein Team. Der Anmeldename erscheint als Urheber in jedem Journaleintrag, den die Person schreibt. Passwörter liegen als Hash verschlüsselt in der Datenbank, nie im Journal; jeder Server auf derselben Datenbank kennt sie. Ein Anwender lässt sich sperren und wieder freischalten; der letzte Anwender mit dem Recht zur Anwenderverwaltung lässt sich weder sperren noch entfernen.

Unter ◐ Ich ändert jede Person ihr Passwort und legt **API-Token** an: für das Excel-Add-in, OnlyOffice und Skripte. Ein Token arbeitet mit den Rechten der Person; was damit geschrieben wird, ist ihrem Team zugeordnet. Der Token ist nur beim Anlegen sichtbar.

## Rollen und Rechte

Eine Rolle ist eine Menge von Rechten. Vorbelegt sind:

| Rolle | Rechte |
|---|---|
| Administrator | alle |
| PIM-Manager | lesen, pflegen, zurückziehen, freigeben, Modell, Jobs |
| PIM-Editor | lesen, pflegen, zurückziehen, freigeben |
| Team-Admin | lesen, pflegen, Team |
| Leser | lesen |

Die Rechte im Einzelnen:

| Recht | Erlaubt |
|---|---|
| lesen | Baum, Werte, Medien, Journal, Modell ansehen |
| pflegen | Knoten, Werte, Relationen, Medien, Stapel, Profile, Belege schreiben |
| zurückziehen | Knoten zurückziehen und wiederherstellen |
| freigeben | Freigaben und Versionen |
| Modell | Attribute, Gruppen, Listen, Sichten, Einheiten, Sprachen, Kanäle, Relationstypen ändern |
| Plugins | Plugins installieren, ein- und ausschalten, entfernen |
| Jobs | Jobs anlegen, starten, Protokolle lesen |
| Speicher | Assetspeicher einstellen und kopieren |
| Team | das eigene Team führen: Mitglieder und KI-Schlüssel |
| Anwender | Anwender und Rollen verwalten |

Eigene Rollen entstehen unter ◈ IAM. Eine Rolle mit Anwendern lässt sich nicht zurückziehen, und das Recht zur Anwenderverwaltung kann nicht aus der letzten Rolle verschwinden, die ein aktiver Anwender hat.

## Teams

<!-- lizenz -->
Ein Team ist eine Gruppe von Personen, die am Gesamtsystem mitarbeitet. Daran hängen das Kontingent an journali-Token, die KI-Schlüssel und das KI-Austauschvolumen. Jede Anlage bringt das **Init Team** mit: nicht löschbar, umbenennbar, Träger der Grenzen aus der Lizenz. Wer kein eigenes Team hat, arbeitet dort.
<!-- /lizenz -->
<!-- startphase -->
Ein Team ist eine Gruppe von Personen, die am Gesamtsystem mitarbeitet. Daran hängen die KI-Schlüssel und das KI-Austauschvolumen. Jede Anlage bringt das **Init Team** mit: nicht löschbar, umbenennbar. Wer kein eigenes Team hat, arbeitet dort.
<!-- /startphase -->

<!-- lizenz -->
Führen und dazugehören sind zweierlei: eine Person kann **Manager** mehrerer Teams sein, aber **Mitglied nur eines**. Ein Team kann über ein anderes abrechnen; die Kette darf keinen Kreis bilden. Die Balken in der Kopfzeile zeigen immer das Team der Mitgliedschaft am Ende dieser Kette.
<!-- /lizenz -->
<!-- startphase -->
Führen und dazugehören sind zweierlei: eine Person kann **Manager** mehrerer Teams sein, aber **Mitglied nur eines**. Ein Team kann die KI-Schlüssel eines anderen nutzen; die Kette darf keinen Kreis bilden.
<!-- /startphase -->

<!-- lizenz -->
## Was ohne Kontingent geschieht

Ein Team ohne Kontingent kann nicht pflegen: jeder Eintrag, der journali-Token kostet, wird abgewiesen. Modellieren, Strukturieren, Einrichten und Betrieb kosten nichts und gehen weiter. Was zählt und was nicht, steht im Kapitel Nutzungslimits und Lizenzierung.
<!-- /lizenz -->

## Jobs und das System

Jobs bekommen je Lauf ein Dienst-Token mit der Rolle PIM-Editor, das mit dem Lauf erlischt. Einträge des Systems selbst, etwa beim Start oder bei einer Sicherung, tragen den Urheber system.
