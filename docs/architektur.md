# Architektur

Stand 16.09.2026 — Ergebnis des ersten Gesprächs. Code dahinter: das
Grundgerüst in `Journali.Core` und der Server mit dem dauerhaften Journal
in PostgreSQL (`Journali.Server`, `docs/betrieb.md`).

## Das Prinzip in einem Satz

Das Journal ist die einzige Wahrheit. Alles andere — Pflege-Tabellen,
Suchindex, Datenstore je Kanal — ist eine Ableitung daraus und darf
jederzeit gelöscht und neu gebaut werden.

## Warum ein Journal

Was ein PIM teuer macht, sind nicht Bäume und Attribute, sondern:

| Anforderung | Klassisch | Mit Journal |
|---|---|---|
| Historie „wer hat wann was" | eigene Audit-Tabelle, jeder Schreibpfad muss sie pflegen | ist das Journal selbst |
| „Wie sah das Produkt am 1.9. aus?" | Versionstabellen | Einträge bis zum 1.9. abspielen |
| Freigabe / Vier-Augen | Statusfelder, Sperren, Entwurfskopien | Abbild „freigegeben" ignoriert Einträge ohne Freigabe |
| Delta-Export an Shop | „geändert seit"-Spalten, die jeder setzen muss | „alle Einträge nach #4711 für Kanal web" |
| Suchindex synchron halten | Trigger, Cronjob, hoffen | der Index ist ein Abbild und liest denselben Strom |
| Fehler im Datenmodell | Migration mit Risiko | neues Abbild schreiben, Journal neu abspielen |
| Rückgängig | selten sauber | kompensierender Eintrag |

## Die drei Schichten

```
Pflege-Client  ──Befehle──▶  Schreibmodell (normalisiert, synchron)
                                   │
                                   ▼ Einträge (Journal, append-only)
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
       Suchindex            Datenstore web       Datenstore print
                            (flach, de/en,       (XML für InDesign)
                             nur freigegeben)
              ▲                    ▲                    ▲
         Pflege-Client           Shop                Agentur
```

Keine Schicht spricht mit einer anderen ausser über die Pfeile. Shops und
externe Werkzeuge gehen nie auf die Pflege-Datenbank, sondern auf ihr
eigenes Abbild — dasselbe Muster wie SAP BW für Auswertungen, nur für
Ausgabe.

## Der Schreibpfad (pragmatische Mitte)

Nicht das volle Event-Sourcing mit asynchroner Pflege — für einen
Alleinentwickler zu teuer, und die Oberfläche würde unter der Verzögerung
leiden. Stattdessen:

1. Der Schreibpfad geht **ausschliesslich** über Befehle („setze Attribut",
   „hänge in Kategorie"), nie über generisches „speichere Objekt".
2. Jeder Befehl erzeugt genau einen Eintrag, der **zuerst** ins Journal
   geschrieben wird.
3. In **derselben Transaktion** wird die Pflege-Tabelle aktualisiert. Sie
   ist damit ein Abbild, aber ein synchrones — kein eventual-consistency
   in der Oberfläche.
4. Suche, Vollständigkeit, Exporte lesen das Journal asynchron ab Nummer N.

Wenn die Pflege-Tabelle irgendwann als Original stört, wird sie zum
asynchronen Abbild — das Journal war von Anfang an die Wahrheit.

## Die Achsen

Ein Attributwert ist nicht „Produkt × Attribut", sondern

```
Produkt × Attribut × Sprache × Kanal × Variantenebene
```

Welche Achsen ein Attribut hat, ist pro Attribut konfigurierbar (Gewicht:
keine; Name: Sprache; Beschreibung: Sprache und Kanal). Vererbung läuft
über die Variantenebene: Produktmodell → Variante Farbe → Variante Grösse,
jede Ebene kann überschreiben.

**Wer die Achsen im Eintrag richtig hat, hat sie überall richtig.** Der
Eintrag `AttributeSet` trägt deshalb `attribute`, `locale`, `channel`
(und später `level`) in den Nutzdaten; `stream` ist das Produkt.

## Ein Eintrag

| Feld | Bedeutung |
|---|---|
| `Number` | laufend, lückenlos ab 1 — Abnehmer merken sich „zuletzt gelesen" |
| `At` | Zeitpunkt |
| `Actor` | Nutzer, Import, System |
| `Stream` | wozu der Eintrag gehört — ein Strom je Produkt |
| `Type` | `AttributeSet`, `CategoryAssigned`, `ReleaseGranted`, … |
| `Payload` | JSON, Form hängt vom Typ ab |

Das Vokabular der Typen ist die eigentliche Entwurfsarbeit: Ein Eintrag
ist für immer, ein schlecht geschnittener (`ProductChanged` mit dem ganzen
Objekt) lässt sich nur umdeuten, nie reparieren.

## Schnappschüsse und Verdichten

Abspielen wird lang: 100.000 Produkte × 200 Einträge = 20 Mio. Deshalb
Schnappschüsse alle N Einträge je Strom — selbst ein Eintrag, der den
Zustand bis dahin vollständig enthält.

Alter Teil des Journals wird nicht gelöscht, sondern **verdichtet**:
Schnappschuss davor, Einträge dahinter als komprimierte Datei archiviert.
Kriterien: Alter, Anzahl je Strom, Eintragstyp (Preisänderungen sind
Rauschen, `ReleaseGranted` bleibt). Zwei Fallen:

- Der Schnitt muss hinter allen Lesern liegen (kleinstes „zuletzt
  gelesen" aller Abnehmer), sonst hat ein Abnehmer ein Loch.
- Der Schnappschuss ist codeabhängig und muss bei Modelländerungen
  migriert werden — derselbe Zwang wie bei einer klassischen Tabelle,
  nur auf den Schnappschuss beschränkt.

## Was weh tut (damit es nicht zu schön klingt)

- Eindeutigkeit über Ströme hinweg („SKU nur einmal") braucht eine kleine
  synchrone Prüf-Projektion.
- DSGVO beisst sich mit „nie löschen" — für Produkte selten, für Nutzer
  im `Actor`-Feld schon.
- Suche über freie Attribute: EAV in MySQL ist quälend; JSON-Spalte plus
  Suchindex als Abbild ist die übliche Antwort (Akeneo macht es so).

## Offen

- ~~Datenbank für das dauerhafte Journal~~ PostgreSQL 18, Tabelle `journal`
  mit JSONB — entschieden 16.09.2026, `docs/betrieb.md`
- ~~Server-API~~ ASP.NET Core Minimal API unter `/api`, Befehle je Eintragstyp
- ~~Fat Client oder Browser~~ Browser (Vue 3, `web/`), soll sich wie ein
  Fat Client anfühlen — entschieden 16.09.2026; ein WPF-Client könnte später
  auf dieselbe API
- ~~Vokabular der Eintragstypen~~ erste fünf in `docs/eintraege.md`; wächst
- Vollständigkeitsregeln je Familie × Kanal × Sprache
- ~~Schnappschüsse der Abbilder~~ gebaut 21.09.2026 (`Snapshot.cs`, `docs/betrieb.md`) — dazu der lokale Spiegel des Journals;
  der Aufbau las vorher alles; bei ~25 000 Einträgen am Tag innerhalb eines Jahres nötig. Ausdünnen des Journals dagegen nicht (Taloan, 19.09.2026):
  ein Eintrag ist für immer; höchstens nach Ablauf einer beschlossenen Frist Einzelschritte zwischen zwei Versionen
  zu einem Stand verdichten — mit eigenem Eintrag, nie aus Platzgründen (~5 MB je 25 000 Einträge)
- ~~Benutzer und Rollen~~ gebaut 19.09.2026 (`Auth.cs`, `docs/betrieb.md`); offen: SSO, Rollen je Teilbaum, Workflow-Rollen
- Import/Export — in der Praxis die Hälfte des Systems
- **Tarife als Abo über Lemon Squeezy** (Taloan, 23.09.2026: „später wird kein Text mehr zum Kopieren sein … wer das
  System nutzen will, will eine automatische Verlängerung — man stellt einen Modus ein wie bei Claude, und wenn man
  nicht mehr will, muss man aktiv werden“). Heute: Anforderung und Schlüssel werden kopiert (`KeyRequests.cs`,
  `LicenceKeys.cs`, `docs/betrieb.md` → Schlüssel).

  *Was Lemon Squeezy übernimmt* (Dokumentation gelesen am 23.09.2026): Abo-Ablauf mit `status`
  (`on_trial`, `active`, `paused`, `past_due`, `unpaid`, `cancelled`, `expired`; gekündigt gilt bis Periodenende),
  Tarifwechsel mit oder ohne anteilige Verrechnung (`variant_id`), Kundenportal zum Kündigen
  (`urls.customer_portal`), Webhooks je Schritt (`subscription_created`, `_updated`, `_cancelled`, `_expired`,
  `subscription_payment_success`/`_failed` …, signiert HMAC-SHA256 im Header `X-Signature`), Lizenzschlüssel am Abo
  („aktiv, solange das Abo aktiv ist, läuft ab, wenn das Abo abläuft“) mit `activation_limit` und `instance_name`,
  Zusatzdaten im Checkout (`checkout[custom][…]` → `meta.custom_data`).

  *Was es nicht übernimmt — darum bleibt ein eigener Lizenzserver:*
  1. die Antwort von `validate` ist laut Dokumentation nicht signiert, das Beispiel kommt ohne API-Schlüssel aus —
     eine Instanz, die selbst fragt, lässt sich vom Betreiber mit einer nachgebauten Antwort täuschen. Die Instanz
     glaubt nur, was der Lizenzserver mit dem Lizenzschlüssel signiert (`Signatur`);
  2. Lemon Squeezy kennt nur die Variante, nicht die Grenzen (Pro = so viele Token je Woche und Monat);
  3. Instanzen ohne Internet;
  4. Rate Limit der Lizenz-API: 60 Anfragen je Minute.

  *Vorgeschlagener Ablauf:* der Einkauf kauft im Shop und bekommt einen Lizenzschlüssel per Mail → die IT fügt ihn
  in journali ins eine Feld ein → die Instanz schickt ihn mit ihrer signierten Anforderung an den Lizenzserver →
  der prüft die Signatur der Instanz, ruft `activate` mit `instance_name` = Instanz-Kennung (`activation_limit` 1:
  derselbe Schlüssel nicht auf zwei Instanzen) → antwortet signiert „Tarif X, bezahlt bis …“ → danach fragt die
  Instanz täglich nach; Verlängerung, Wechsel und Kündigung kommen per Webhook zum Lizenzserver. Kauf und Instanz
  verbindet der Schlüssel; Checkout-Zusatzdaten braucht es nicht. Ein Journal-Eintrag je Tarif, der in Kraft tritt
  oder endet (wie `KeyRedeemed`). Reset bleibt Einzelkauf. Die Umrechnung nach Restvolumen entfällt beim Abo —
  den Geldausgleich beim Wechsel macht Lemon Squeezy.

  *Lizenzserver:* Strato-vServer mit einer kleinen ASP.NET-Anwendung — dieselben Prüfungen (`Signatur.Pruefe`,
  `SignedRequest.Pruefe`, Signatur r‖s) wie in journali, keine zweite Umsetzung. Möglich wäre auch der Managed
  Server mit PHP/MySQL; PHP signiert ECDSA im DER-Format, journali erwartet r‖s — umwandeln oder die .NET-Seite
  umstellen.

  *Zu entscheiden:* Abo je Instanz oder je Team (die Limits hängen am Team) · wie lange der letzte Stand ohne
  Verbindung gilt (Kulanz) · ob Anforderung und Schlüssel zum Kopieren als Weg für Instanzen ohne Internet bleiben.
  *Zu prüfen im Testmodus* (`test_mode`): ob der Lizenzschlüssel beim Tarifwechsel derselbe bleibt; die genaue
  Antwort von `activate`.
