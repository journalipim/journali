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
eigenes Abbild — dasselbe Muster wie ERP BW für Auswertungen, nur für
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
  Suchindex als Abbild ist die übliche Antwort (andere Systeme macht es so).

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
  der Aufbau las vorher alles; bei ~25 000 Einträgen am Tag innerhalb eines Jahres nötig. Ausdünnen des Journals dagegen nicht:
  ein Eintrag ist für immer; höchstens nach Ablauf einer beschlossenen Frist Einzelschritte zwischen zwei Versionen
  zu einem Stand verdichten — mit eigenem Eintrag, nie aus Platzgründen (~5 MB je 25 000 Einträge)
- ~~Benutzer und Rollen~~ gebaut 19.09.2026 (`Auth.cs`, `docs/betrieb.md`); offen: SSO, Workflow-Rollen; ~~Rollen je Teilbaum~~ gebaut 27.09.2026 (`NodeRestricted`, `MediaFolderRestricted`, `Auth.Sichtbar`)
- Import/Export — in der Praxis die Hälfte des Systems
- **Status am Asset** (28.09.2026, offen). Ein Knoten kann aktiv sein und eines seiner Assets trotzdem
  überholt — heute lässt sich das nicht sagen. Ein Medium kennt nur *zurückgezogen* (`MediaRetired`, es
  verschwindet), *abgelöst* (`MediaSuperseded`, die Fassungskette) und einen Workflow-Zustand
  (`MediaWorkflowApi`, „was noch zu tun ist“). Was fehlt, ist der **Status aus demselben Vokabular wie am Knoten**
  (`StatusDefinition` im Modell, `StatusSet` am Strom) — dieselben Werte, dieselbe Anzeige, nur am Medium.
  *Entwurf:* `StatusSet` am Medienstrom, wie es `WorkflowStateSet` dort schon tut — kein neuer Eintragstyp; das
  Abbild `Media` nimmt ihn auf, der Zuordnungsdialog (`MediaPicker`, Drop auf den Baum) bietet ihn gleich mit an.
  *Zu klären:* was ein überholtes Asset für die Ausleitung bedeutet (geht es mit oder nicht?); ob der Status dem
  Medium gehört oder der Zuordnung — ein Bild hängt an mehreren Knoten, und „hier überholt“ ist etwas anderes als
  „überall überholt“.
- **Wertelisten übersetzen** (28.09.2026, offen). Sätze, die man je Produkt auswählt („Funkentstörung“), sind
  Werte einer Werteliste — Schlüssel und Text je Sprache, das Attribut `enum` mehrwertig; die Auswertung eines
  Dokuments ordnet je Satz dem vorhandenen Wert zu oder trägt ihn nach (`pflegestruktur.md` 9, 34 L). Was fehlt:
  ⇄ Übersetzung kennt die Texte der Wertelisten nicht — XLIFF, DeepL, KI und das Gedächtnis arbeiten nur über
  Attributwerte. Ein Satz, der einmal gepflegt ist, muss dort einmal übersetzt werden können.
- **Das wachsende Journal**. Nicht die Grösse ist das Problem, sondern die
  **Zahl** der Einträge: die Startzeit darf nicht von der Länge des Journals abhängen.

  *So startet der Server heute:* mit Schnappschuss (`Catalog.LoadSnapshot`) lädt er den Stand aller Abbilder bis #n
  und liest nur den Rest; ohne liest er das Journal **einmal** von vorn (`Projector.CatchUpAll`) und gibt jeden
  Eintrag an alle Abbilder, die den aktuellen Stand jeder Entität im Speicher halten. Der Schnappschuss fällt mit
  jedem Build — nach jedem Update also der volle Durchlauf. Teuer mit der Länge wird auch `Catalog.AsOf` (Stand bei
  #n für Versionen: von vorn bis #n).

  *Gemessen (24.09.2026, lokaler Spiegel, 125 096 Einträge vom 17.–23.09.):* 232 MB, gepackt 16,5 MB; Pflege
  (`AttributeSet`) 300 B je Eintrag, Referenzdaten (`PluginDataSet`, ETIM …) 88 % der Masse bei 7,2 KB je Eintrag.
  Der 23.09. hatte 50 191 Einträge, aber nur 16 MB — was beim Rechnerwechsel eine halbe Minute dauert, kostet je
  Eintrag, nicht je Byte:

  | Messung (Kopie des Spiegels) | Zeit |
  |---|---|
  | 50 000 anhängen, Datei je Eintrag auf und zu (`CachedJournal.AppendFile` heute) | 7 417 ms |
  | dieselben in einem offenen Strom | 87 ms |
  | Spiegel ganz lesen und jede Zeile entschlüsseln (`Validate` bei jedem Start, `ReadAfter` danach noch einmal) | 2 162 ms |
  | nur Zeilen lesen | 365 ms |

  Hochgerechnet auf zwei Jahre (etwa 25 Mio. Einträge, geschätzt aus 50 000 Pflege-Einträgen an 250 Tagen): Anwenden
  ~7,5 min (18 µs je Eintrag), Spiegel entschlüsseln ~7 min (heute doppelt) — eine Viertelstunde und mehr Stillstand
  bei **jedem** Update, und es wächst weiter.

  *Was gebaut wird, in dieser Reihenfolge:*
  1. ~~**Spiegel korrigieren**~~ gebaut 24.09.2026 (`CachedJournal.cs`; Start prüfen 2,2 s → 207 ms, 50 000
     nachholen 7,4 s → 127 ms, ohne das Lesen aus Postgres) — beim Nachholen die Datei einmal öffnen, nicht je Eintrag;
     beim Start nicht alles entschlüsseln: letzte Zeile vom Dateiende, Lückenprüfung über Zeilenzahl = letzte
     Nummer, Zeilen vor dem Schnappschuss überspringen, ohne sie zu entschlüsseln. Sofort spürbar bei jedem Start und
     jedem Rechnerwechsel.
  2. ~~**Ein Schnappschuss, der Updates überlebt**~~ gebaut 24.09.2026 (`Fingerabdruck.cs`, 122 ms je Start): der
     Stempel ist der Fingerabdruck der Kern-Logik statt der ModuleVersionId — in der steckte der Git-Commit, jeder Commit
     liess den Schnappschuss fallen. Gemessen an vier Bauten: anderer Commit und nur ein Kommentar → gleicher Stempel,
     eine Konstante geändert → anderer. Dazu stündlich geschrieben. Ursprünglicher Plan: stabiles Format mit eigener
     Formatnummer statt Build-Stempel; er
     fällt nur, wenn sich ein Abbild wirklich ändert. Geschrieben regelmässig (etwa stündlich) und beim Beenden. Ein
     Start = Stand laden + Einträge seit dem letzten Schnappschuss; die Dauer hängt am heutigen Datenbestand, nicht an
     der Geschichte.
  3. **Das Akkordeon** — die Obergrenze für den schlimmsten
     Fall:
     ```
     │◄──────── zugeklappt: je Monat ein Fach ────────►│◄──── offen: die letzten 12 Monate ────►│
       [2026-01][2026-02]…[2027-08]                      Einträge vollständig in der Datenbank
        └─ je Fach: die Einträge des Monats gepackt, mit Prüfsumme, im Archiv + Stand am Monatsende
     ```
     Zuklappen monatlich: ein Monat, der älter als 12 Monate ist, wandert gepackt ins Archiv, dazu ein Eintrag „Stand
     am Monatsende“ in stabilem Format. Der Start beginnt beim Stand des jüngsten zugeklappten Monats und spielt nur
     die offenen 12 Monate ab — nach zehn Jahren nicht langsamer als nach einem. Aufklappen: wer den Verlauf eines
     Knotens von vor zwei Jahren sehen will, holt das Fach aus dem Archiv. Verdichten heisst nicht löschen — das ist
     die Entscheidung vom 19.09.2026 (ein Eintrag ist für immer; verdichtet wird nach beschlossener Frist, mit eigenem
     Eintrag, nie aus Platzgründen) und das „Verdichten“ aus *Schnappschüsse und Verdichten* oben.
     *Zu entscheiden:* Versionen zeigen auf #n — liegt #n in einem zugeklappten Monat: jeden Monatsstand behalten
     (schnell, Platz), nur den jüngsten (langsam, selten), oder nur die Stände, auf die eine Version zeigt.
     *Zu beachten:* der Schnitt muss hinter allen Lesern liegen; der Monatsstand braucht ein stabiles Format wie (2).
  4. **Update ohne Stillstand** — die neue Fassung startet neben der alten, baut ihre Abbilder im Hintergrund auf und
     folgt dem Journal, während die alte weiterläuft; ist sie eingeholt, schaltet der Proxy um (Docker, NPMplus).
     Ein langer Aufbau heisst dann spätere Umschaltung, kein Ausfall.

  *Weitere Stufen, wenn es so weit ist:* Referenzdaten als Datei im Medienspeicher, im Journal nur ihr Hash (88 % der
  heutigen Masse); Postgres-Partitionen je Jahr; Sicherung ab einer Nummer statt jedes Mal alles; Personenbezogenes
  verschlüsselt mit einem Schlüssel je Person ausserhalb des Journals — löschen heisst: den Schlüssel vernichten
  (DSGVO, „crypto-shredding“).
- ~~Tarifmodell~~ entschieden und gebaut 24.09.2026 (`Tarife.cs`, `docs/betrieb.md` → Tarife): Kostenlos,
  Pro (+ Pro+), Enterprise, Unlimited; drei Monate Enterprise ab dem ersten Journaleintrag; Plugins und
  Publikationsbäume nach dem höchsten Tarif der Instanz; Reset getrennt für Pro und Enterprise; Sichern von Hand
  unter ⇅ B&R. Im Shop: Varianten Pro, Pro+, Enterprise, Unlimited (die Testvariante „Ultimate“ entfällt).
- ~~Lizenzserver~~ gebaut 24.09.2026 — eigenes, privates Repo `besitzer/journali-lizenz` (journali als Submodul, nur
  `Journali.Core`: `Licensing/Vertrag.cs`, `Tarife.cs`). In journali: `Abos.cs`, `EntitlementReceived`, das eine Feld
  erkennt den Shop-Schlüssel; Betrieb in `docs/betrieb.md` → *Abo über den Lizenzserver*.
  **Die Trennung ist beabsichtigt und gilt in eine Richtung** (Regel 5 in `CLAUDE.md`): journali wird veröffentlicht,
  der Lizenzserver nicht. Hier stehen das Format und der **öffentliche** Ausstellerschlüssel; der private Schlüssel,
  die Zugänge, die Shop-Varianten und die Verwaltung stehen dort und kommen nie hierher. Im Lizenz-Repo wird am
  Submodul `extern/journali` nicht gearbeitet — eine Änderung am Format entsteht hier und wird dort nachgezogen.
- ~~Tarife vom Lizenzserver, nur Signiertes zählt~~ entschieden und gebaut 25.09.2026. Stand vorher: nur die Grenzen
  eines Abos kamen signiert vom Lizenzserver; Plugins, Publikationsbäume, Lizenzgrenzen, Pakete, Kostenlos und der Test
  steckten in `Tarife.cs` — eine Änderung, auch eine Senkung zusammen mit dem Preis, hätte jede Instanz erst mit einem
  neuen Image erreicht. Und eine Lizenz ohne passende Signatur galt trotzdem („ungeprüft“), der Schlüssel zum Prüfen
  kam aus einer Umgebungsvariable, die man weglassen konnte.
  *Jetzt:*
  - Der öffentliche Schlüssel des Lizenzservers ist eingebaut (`Aussteller`). Lizenz, Schlüssel, Abo-Stand und
    Tarifblatt zählen nur mit seiner Signatur; die Testlizenz gilt nach der Regel. Wer die Prüfung entfernt, ändert
    den Quelltext — das verbietet die Lizenz von journali; technisch verhindern lässt es sich bei offenem Quelltext nicht.
  - Das **Tarifblatt** (`Tarifblatt`, `TarifeReceived`): alle Tarife mit Grenzen, Bäumen, Plugins und dem Test,
    signiert, mit Fassung; kommt mit jedem Abo-Stand und jedem Schlüssel. `Tarife.cs` ist nur noch das Saatgut.
  - **Senken ab der nächsten Verlängerung**, erhöhen sofort: der Lizenzserver merkt sich je Abo, was er für die
    laufende Periode zugesagt hat, und liefert bis zu ihrem Ende nicht weniger.
  - **Keine Lizenz der Instanz**: jede gehört einem Team — Abo oder Schlüssel zum Kopieren. Das Einspielen einer
    Lizenzdatei (`PUT /api/licence`) ist entfernt; übrig ist der Test des Init Teams, danach Kostenlos.
  - **Kontingent bestellen aus der Oberfläche** (26.09.2026): wer ein Team führt, öffnet im Abschnitt ⚿ journali Lizenz
    den Shop. Die Adresse steht im Tarifblatt (`TarifblattInhalt.Kauf`) — **eine** für alle Tarife, weil der Shop ein
    Produkt mit je Tarif und Laufzeit einer Variante führt und eine Variante keine eigene Adresse hat; den Tarif wählt
    der Anwender im Shop. Die Oberfläche hängt `checkout[custom][instanz]` und `checkout[custom][team]` daran. Der Shop meldet den neuen Schlüssel als
    `license_key_created` mit diesen Daten zurück — der Lizenzserver aktiviert ihn selbst und **behält** ihn
    (`Aktivierung.Key`). Die Instanz fragt darum **ohne Schlüssel** (`Abos.VerbindenAsync` mit leerem `key`), der
    Lizenzserver findet das Abo über Instanz und Team. Niemand fügt einen Schlüssel ein, und keiner liegt in der Instanz.
    Den Stand eines Teams holen darf, wer es führt (Recht `team`, `TeamApi.Fuehrt`); verbinden von Hand bleibt `users`.
  - **Aktionen des Shops** (26.09.2026): der Shop kennt keinen Streichpreis, nur Rabattcodes — die Dokumentation nennt
    `checkout[discount_code]` als einzigen Weg. Darum stehen die Aktionen im Tarifblatt (`RabattZeile`: Code, Wirkung,
    gültig bis) und die Oberfläche zeigt je Aktion einen grünen Kasten mit Code zum Kopieren und einem Knopf, der den
    Shop mit diesem Code öffnet. Abgelaufenes liefert der Server gar nicht erst aus.
  - **Registrierung beim Lizenzserver** (26.09.2026): eine Anlage ohne Abo sprach nie mit ihm und erfuhr darum nichts
    von Tarifen und Aktionen. Jetzt wird **einmal gefragt** (`registrierung.js`, Antwort als `RegistrationSet` im
    Journal, damit jeder Server der Anlage sie kennt); registriert holt sie das Blatt über `POST /v1/tarife` —
    signierte Anfrage mit Instanz und öffentlichem Schlüssel, sonst nichts. Wer ablehnt, schickt nichts hinaus; ein Team
    mit Abo spricht ohnehin mit dem Lizenzserver, dann kommt das Blatt mit.
  - **Der Weg von Hand ist freizugeben** (26.09.2026): Anforderung erzeugen und Schlüssel einfügen setzen einen Kontakt
    zum Support voraus, weil sie erklärungsbedürftig sind. Der Lizenzserver gibt sie je Instanz frei (Instanzseite,
    Einstellung `vonhand:<instanz>`); die Freigabe reist signiert mit der Tarifantwort (`TarifeAntwort`, `Freigabe` —
    gebunden an Instanz und Fingerabdruck der Anfrage) und gilt bis zum nächsten Abruf. Ohne Freigabe steht in der
    Oberfläche nicht einmal der Schalter; der Knopf darin heisst **Generieren**, denn er erzeugt die Anforderung.
    *Entschieden (26.09.2026):* die Instanz **fordert nichts mehr an**. Der Support kennt ihre Kennung aus dem Kontakt
    und stellt den Schlüssel in der Verwaltung direkt für sie aus (`AusstellenFuer`); die Oberfläche hat nur noch das
    Feld zum Einfügen und die Liste dessen, was eingelöst ist. Die Endpunkte `/api/licence/requests` und die Seite
    *Anforderung* im Lizenzserver haben damit keinen Erzeuger mehr.
    *Entschieden:* eine Anlage **ganz ohne Verbindung** bekommt diesen Weg nicht — sie müsste die Freigabe eingeben,
    und dafür müsste ein Feld dastehen, das es ohne Freigabe nicht gibt. Irgendwo ist Schluss.
  - **Eingriffe am Abo** in der Verwaltung des Lizenzservers: entziehen (Betrug), gültig bis von Hand verlängern,
    Tarif ändern (z. B. Pro bezahlt, Enterprise gewährt). Sie wirken beim nächsten Auffrischen der Instanz; ohne
    Verbindung gilt ihr letzter Stand höchstens bis zum Ende der Kulanz. Schlüssel zum Kopieren lassen sich nicht
    entziehen — sie haben eine feste Laufzeit.
- **Ausdrücklich leer** (27.09.2026): ein Wert kann hier absichtlich nichts sein, obwohl ein Vorfahr (oder die
  Mastersprache) etwas sagt. Bisher hiess leer immer „eigener Wert weg", und der geerbte kam zurück — in der Textzelle
  ging beim Leeren sogar gar nichts hinaus. Jetzt gibt es `AttributeCleared` (Strom des Knotens): das Abbild legt einen
  eigenen, leeren Wert an (`Values[axis] = ""`), der die Vererbung bricht wie jeder eigene Wert. `AttributeSet` mit
  leerem Wert bleibt der Rückweg — das ist, was das ↓ an der Attributzeile und „Eigenen Wert löschen" schicken.
  Die Oberfläche entscheidet danach, ob ohne den eigenen Wert noch etwas gälte (`gaelteOhneEigenen`): nur dann wird
  geleert statt gelöscht. Ein ausdrücklich leerer Wert zählt in der Vollständigkeit **nicht** als gefüllt.

- **Tarife als Abo über Lemon Squeezy**. Heute: Anforderung und Schlüssel werden kopiert (`KeyRequests.cs`,
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

  *Lizenzserver:* Strato-vServer mit einer kleinen ASP.NET-Anwendung als Container (Portainer-Stack) hinter NPMplus — dieselben Prüfungen (`Signatur.Pruefe`,
  `SignedRequest.Pruefe`, Signatur r‖s) wie in journali, keine zweite Umsetzung. Möglich wäre auch der Managed
  Server mit PHP/MySQL; PHP signiert ECDSA im DER-Format, journali erwartet r‖s — umwandeln oder die .NET-Seite
  umstellen.

  *Entschieden:* **Abo je Team** — wegen der Kostenstellen. Wer zentral abrechnen will, legt
  das Abo aufs Init Team; die anderen Teams rechnen über es ab (`keysFrom`, Zahlerkette). Damit gehört ein
  Lizenzschlüssel von Lemon Squeezy zu einem Team: aktiviert wird er für Instanz *und* Team (`instance_name` =
  Instanz-Kennung und Team), mit `activation_limit` 1 — derselbe Schlüssel nicht für ein zweites Team. Eingelöst
  wird wie heute beim Team, das sein Kontingent selbst trägt.

  *Entschieden:* ohne Verbindung zum Lizenzserver gilt der letzte signierte Stand noch
  **7 Tage**, danach der Testbetrieb.

  *Entschieden:* **der Weg zum Kopieren bleibt** — für Instanzen ohne Internet, neben dem Abo.
  Die IT erzeugt die signierte Anforderung, trägt sie hinaus, reicht sie im Shop ein und bekommt einen signierten
  Schlüssel mit fester Laufzeit zurück (im Voraus bezahlt, z. B. ein Jahr); eingefügt wird er ins selbe Feld.
  Gebaut ist dieser Weg (`KeyRequests.cs`, `LicenceKeys.cs`); beim Abo-Umbau bleibt er erhalten.

  *Vorbereitet (23.09.2026):* der Strato-vServer — Ubuntu 26.04 LTS, aktuell, automatische Sicherheitsupdates,
  Firewall des Kundenmenüs lässt nur 22, 80, 443 durch, SSH nur mit Schlüssel, NPMplus als Reverse Proxy (Verwaltung
  nur über SSH-Tunnel). Der Lizenzserver bekommt dort einen eigenen Proxy-Eintrag mit Certbot.
  *Sein Name (25.09.2026):* eine Subdomain der Produktdomain, per A-Record auf den vServer. Sie steht als Konstante
  im Kern (`Aussteller.Adresse`) und damit auf Dauer in jedem ausgelieferten Bau: der Name muss bleiben, solange
  eine Instanz läuft, der Server dahinter darf über DNS wechseln. Getrennt von jedem privaten Rechner — sonst kann
  kein Prüfstand unterscheiden, ob ein Name im Repo die Lizenzadresse ist oder ein Versehen (Regel 5).
  *Geprüft im Testmodus (23.09.2026, ein Abo-Produkt mit drei Varianten, zwei Testkäufe, Aufrufe per curl):*
  - `activate` und `validate` gehen **ohne API-Schlüssel**; die Antwort trägt **keine Signatur** (weder im Rumpf
    noch in den Kopfzeilen) — der Lizenzserver signiert selbst.
  - Die Antwort nennt `meta.variant_id` und `variant_name` (daraus die Grenzen), `license_key.status`,
    `activation_limit`/`activation_usage`, `instance.id` und `instance.name`; `expires_at` ist bei Abo-Schlüsseln
    `null`. Sie enthält auch `customer_email` — die geht nicht an die Instanz weiter.
  - Die Grenze greift: ein zweites `activate` mit demselben Schlüssel („test-instanz/italien“ nach
    „test-instanz/init“) → `"activated": false`, „This license key has reached the activation limit.“
  - **Tarifwechsel** im Kundenportal (PRO → ENTERPRISE): **derselbe Schlüssel**, `validate` meldet sofort die neue
    Variante. Der Wechsel muss im Kundenportal freigeschaltet sein (Design → Customer Portal, Produkte wählen).
  - **Achtung:** `activation_limit` sprang beim Wechsel von 1 auf 5 — die Grenze hängt an der Variante. Also bei
    allen Varianten 1 einstellen, und der Lizenzserver prüft „ein Schlüssel, ein Team“ selbst, statt sich darauf zu
    verlassen.
  - Rate Limit laut Kopfzeile `x-ratelimit-limit: 300` (die Dokumentation nennt 60 je Minute).
  - Im Kundenportal besser „Update subscription quantity“ aus: die Grenzen hängen am Tarif, nicht an einer Anzahl.
  - Tarifwechsel: **„Apply changes with proration and invoice immediately“** — journali gibt die neuen Grenzen
    sofort frei (`validate` meldet die neue Variante sofort), also wird auch sofort abgerechnet; beim Wechsel nach
    unten schreibt die Verrechnung den Rest gut. „Mit Verrechnung am Periodenende“ hiesse einen Monat auf Kredit,
    „ohne Verrechnung“ den Rest des Monats im höheren Tarif umsonst.

  *Preise und Laufzeiten:*
  - Zielgruppe sind Firmen, nicht Privatleute; nach drei Monaten Test soll klar sein, ob journali passt. Wer es
    ernsthaft einsetzt, soll bei **Enterprise oder Unlimited** landen; Pro und Pro+ sind die Stufen für den, der vor
    dem Preis zurückschreckt. Kostenlos ist das Auffangnetz nach dem Test, kein Privattarif.
  - Die Grenzen lenken stärker als der Preis: gezählt wird jeder Wert (ein ERP-Import mit 50 000 Zeilen × 200 Spalten
    wären 10 Millionen Einträge, `UsageTests.cs`). Wer alle Teams über das Init Team abrechnet, teilt **ein**
    Kontingent — zentral abrechnen führt damit zu Unlimited. Darum später Unlimited höher, etwa **399 €**, die übrigen
    Preise bleiben (Pro 29 €, Pro+ 29 + 29 €, Enterprise 99 €). Unlimited kostet journali nichts extra — es läuft auf
    dem Server des Kunden. Die Preise stehen nur im Shop, nie im Code (`Tarife.cs` kennt Grenzen, Plugins, Bäume).
  - **Monatlich und jährlich:** je Laufzeit eine eigene Variante („Repeat payment every 1 month“ / „1 year“), der
    Jahrespreis günstiger; im Checkout stehen beide nebeneinander. Die Bindung entsteht durch die Vorauszahlung —
    gekündigt läuft das Abo bis zum Ende der bezahlten Periode. Der Lizenzserver ordnet jede Variante einem Tarif zu
    (Pro monatlich und Pro jährlich → Pro).
  - **Einführungsangebot:** Unlimited 12 Monate für 99 €/Monat — als Jahresvariante zum vollen Preis mit einem
    wiederholten Rabatt auf die erste Jahreszahlung (Rabatte zählen in Monaten, auch beim Jahresabo: „12“ = die erste
    Jahreszahlung, „24“ = die ersten zwei); danach verlängert es sich zum vollen Preis. Eher als eigenes Produkt, damit
    es im Kundenportal nicht als Wechselziel erscheint.
  - **Wechseln ja, erstatten nein — Gutschrift**. Das ist
    das Verhalten von Lemon Squeezy: „If downgrading a subscription, we'll issue a credit which is then applied on the
    next invoice“ (API, Update a Subscription). Wer vom Einführungs-Jahr auf Enterprise monatlich wechselt, bekommt den
    unverbrauchten Rest als Guthaben, mit dem die folgenden Rechnungen verrechnet werden.
  - *Im Testmodus zu prüfen:* ob die Gutschrift aus dem gezahlten (rabattierten) Preis oder aus dem vollen Preis der
    Variante gerechnet wird; was mit einem Guthaben geschieht, das nie verbraucht wird (Kündigung nach dem Wechsel);
    ob sich ein Rabattcode auf eine Variante beschränken lässt; was mit laufenden Abos geschieht, wenn der Preis einer
    Variante geändert wird. Werkzeug: „Simulate event“ am Testabo.
