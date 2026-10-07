# Schnittstelle (API)

journali ist headless: Die Oberfläche ruft dieselbe HTTP-Schnittstelle, die auch ein anderes System ruft. Einen zweiten Weg zu den Daten gibt es nicht.

## Beschreibung

`GET /api/openapi.json` liefert die Beschreibung (OpenAPI 3.0). Sie wird aus den Endpunkten des laufenden Servers erzeugt und stimmt darum mit ihm überein: Pfad, Methode, Parameter, Körper und das Recht, das ein Aufruf braucht (`x-recht`). Die Antworten sind nicht beschrieben. Lesbar steht sie in der Oberfläche unter **?** → **Schnittstelle (API)**.

## Anmelden

- **Sitzung:** `POST /api/auth/login` mit `{ "user": …, "password": … }` setzt ein Cookie. So arbeitet die Oberfläche.
- **Token:** Unter ⚙ Einstellungen → ◐ Mein Account entsteht ein API-Token; er ist nur beim Anlegen sichtbar. Im Kopf jeder Anfrage: `Authorization: Bearer <token>`.
- **Verschlüsselung:** journali spricht selbst nur HTTP. Über ein Netz gehört TLS davor (ein Reverse-Proxy); sonst läuft das Passwort der Anmeldung unverschlüsselt. Das Cookie der Sitzung trägt das Merkmal `Secure`, sobald die Verbindung HTTPS ist.
- **Ohne Sitzung** gibt es nur `GET /api/health` (Version und Bau), die Aufrufe zum Anmelden (`/api/auth/login`, `state`, `setup`, `claim`) und die Dateien der Office-Add-ins. Alles andere antwortet `401`.
- **Ohne Anwender** in der Instanz ist alles offen; der Urheber eines Eintrags kommt dann aus dem Kopf `X-Actor`. Mit Anwendern kommt er aus der Sitzung oder dem Token.

## Rechte

Jeder Aufruf verlangt ein Recht (`x-recht` in der Beschreibung). Die Rolle des Anwenders oder des Tokens bestimmt, welche Rechte gelten. Fehlt eines, antwortet der Server `403`.

## Fehler

Eine Fehlerantwort ist JSON: `{ "error": …, "template": …, "args": […] }`. `error` ist der fertige Text. `template` mit `args` ist die Vorlage mit ihren Werten, aus der die Oberfläche übersetzt.

## Schreiben

<!-- lizenz -->
Ein schreibender Aufruf legt Einträge im Journal an; ein Aufruf, der mehrere anlegt, bildet einen Stapel. Einträge, die journali-Token kosten, weist der Server ab, wenn das Team kein Kontingent mehr hat.
<!-- /lizenz -->
<!-- startphase -->
Ein schreibender Aufruf legt Einträge im Journal an; ein Aufruf, der mehrere anlegt, bildet einen Stapel.
<!-- /startphase -->

## Beispiel

```
curl -H "Authorization: Bearer $TOKEN" https://<server>/api/tree
```
