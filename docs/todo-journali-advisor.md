# journali advisor — der Assistent für die Bedienung (Stand 18.10.2026)

Ein Thema in Arbeit; die nächste Sitzung liest hier weiter, gleich an welchem Rechner. Arbeitsregeln wie immer: CLAUDE.md.

## Worum es geht

Zwei Berater mit derselben Technik, für zwei Leser:

| | journali advisor | product advisor |
|---|---|---|
| fragt | wer journali bedient (Anwender) | wer einen Shop besucht |
| weiss | Hilfe, Blog- und Wissensartikel, die Oberfläche, die Daten der Instanz | die Produkte eines Publikationsbaums |
| läuft | in journali, für Angemeldete | als eigener Dienst an einer Website (Plugin `advisor`) |
| Farbe | blau (Akzent von journali) | grün |
| erreichbar | Produktiv: nur im Hilfemenü „?“. Demo: dazu ein blauer Knopf oben, neben dem grünen | grüner Knopf oben, wenn ein Berater die Adresse seines Dienstes trägt |

Die häufigsten Fragen beim Bedienen eines PIM sind „Wie mache ich …?“, „Wo finde ich …?“ und „Warum ist …?“. Jede Art braucht ihre eigene
Quelle:

1. **Wie** — aus der Hilfe (22 Kapitel unter `help/<sprache>/`, gebaut nach `web/public/help/`), später aus Blog- und Wissensartikeln
   (`blog/*.md`). Ohne KI: die passenden Abschnitte, ein Klick springt im Kapitel an die Stelle. Mit der KI des Teams: eine kurze Antwort
   aus diesen Abschnitten, mit Verweis [H1] auf jeden.
2. **Wo** — aus der Oberfläche selbst: Ansichten, Reiter, Menüs (`topics.js`, Router, Reiter der Einstellungen). Die Antwort ist ein
   Link („⚙ Einstellungen › ◈ IAM › Rollen“), ein Klick bringt hin. Was die Rolle nicht sehen darf, nennt der Assistent nicht.
3. **Warum** — aus dem Zustand der Daten: warum ein Knoten nicht ausgeleitet wird (Pflichtfelder je Kanal und Sprache, Freigabe), warum
   eine Prüfung rot ist, warum Speichern abgewiesen wird (Recht, Kontingent, Regel), warum ein Wert geerbt ist und von wo. Die Gründe kennt
   journali schon; der Assistent sagt sie für den Knoten, an dem man steht, mit einem Sprung dorthin, wo man es behebt. Ohne KI; die KI
   formuliert höchstens aus.

**Lernen**: Fragen ohne Treffer werden gezählt (wie beim product advisor, `kern/lernen.mjs`) — sie zeigen, wo die Hilfe fehlt oder die
Oberfläche unklar ist. In der Demo sammelt sich das über alle Besucher.

Reihenfolge: Wie → Wo → Warum, jeweils erst ohne KI.

## Entscheidungen

- 18.10.2026: Namen „journali advisor“ und „product advisor“ — so heissen die Knöpfe.
- 18.10.2026: der journali advisor ist blau, der product advisor grün.
- 18.10.2026: im produktiven Betrieb nur über das Hilfemenü „?“; in der Demo zusätzlich ein blauer Knopf oben.
- 18.10.2026: Quellen sind Hilfe und die Artikel der eigenen Website (Blog und Wissen).
- 18.10.2026: kein eigener Dienst — er läuft in der Oberfläche von journali; die KI fragt er wie „✦ KI“ im Editor über `/api/ai/ask`
  mit dem Schlüssel des Teams.

## Offen

- **Artikel**: welche Beiträge veröffentlicht sind, steht nicht im Repo (`blog/*.md` hat kein Feld dafür; fünf Entwürfe tragen ein
  vergangenes Datum). Entweder ein Feld `status:` im Kopf, das `tools/blog.mjs` aus WordPress nachträgt, oder die Artikel stehen in journali
  selbst zum Lesen da und verweisen nicht auf die Website.
- **Suche nach Sinn** für die Hilfe: mit dem Plugin `embed` auf dem Server — dann findet „wie lege ich ein Attribut an“ auch Abschnitte
  ohne diese Wörter. Zuerst die Wortsuche im Browser.
- **Demo**: der grüne Knopf heisst „product advisor“, die Begrüssung des Demo-Beraters nennt den Beispielshop („Ich berate zu den Produkten
  des Beispielshops Tannwald Outdoor …“), damit niemand ihn für die Hilfe zu journali hält.

## Stand

- Konzept: dieses Dokument.
- **Wie** (18.10.2026, gebaut): `web/src/journaliAdvisor.js` (Abschnitte, Wortsuche, KI), `web/src/components/JournaliAdvisor.vue` (Fenster
  unten rechts, blau), Eintrag im Hilfemenü (`help.js`), blauer Knopf in der Demo, das Hilfefenster springt zum Abschnitt (`hilfe.abschnitt`).
  Die Suche gewichtet jeden Begriff nach seiner Seltenheit in der Hilfe; ein Verb, das nur mit seiner Vorsilbe trifft („lege … an“), zählt
  halb; ein Treffer als Teil eines längeren Worts zählt halb; Nachbarwörter (`NACHBARN`: „löschen“ → „zurückziehen“, „Bild“ → „Medien“ …).
  Prüfstand: `web/test/journali-advisor.test.mjs` an den echten Kapiteln.
- Aufgefallen: die Hilfe sagt nicht, **wie** man ein Attribut anlegt (Kapitel Modell beschreibt nur, was ein Attribut hat) — genau das
  soll das Lernen sichtbar machen.

## Nächste Schritte

1. **Wo**: eine Karte der Oberfläche (Ansichten, Reiter, Menüs mit Recht) — „wo finde ich die Rollen?“ antwortet mit einem Link.
2. **Warum**: Gründe aus den Daten für den Knoten, an dem man steht (Ausleitung, Prüfungen, Rechte, Kontingent, Vererbung).
3. **Artikel**: Blog und Wissen dazu, sobald geklärt ist, woran man veröffentlichte Beiträge erkennt.
4. **Lernen**: Fragen ohne Treffer zählen (im Journal? eher nicht — Betrieb; wie `lernen.json` beim product advisor).
5. Die Hilfe selbst: ein Abschnitt über den journali advisor, und „Attribut anlegen“ im Kapitel Modell.
