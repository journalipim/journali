# Veröffentlichung auf GitHub und in die Community Applications (Stand 22.10.2026)

Ein Thema in Arbeit; die nächste Sitzung liest hier weiter, an welchem Rechner auch immer. Schritte und Begründungen:
`unraid/CA-ANMELDUNG.md`.

## Erledigt

- Lizenz AGPL-3.0, Git-Identität „Taloan <github@d-mx.de>“, englische README/CONTRIBUTING/SECURITY auf GitHub.
- Verlauf umgeschrieben (kein Name, keine eigene Adresse, keine Co-Authored-By-Zeilen); das Plugin ixp liegt in einem eigenen Repo
  auf der Gitea (`journali-ixp`) und ist aus dem Verlauf von `master` heraus. `origin` und `github` stehen auf demselben Stand.
- `ca_profile.xml` und drei Unraid-Vorlagen (journali, journali-db, journali-advisor) im Repo.
- Der Gitea-Bau holt ixp aus `journali-ixp` ins Image (Unraid des Betreibers behält es).
- Alte Stände nur auf der Gitea: Zweige `archiv/vor-umschreiben` und `archiv/vor-ixp-entfernen` (beide enthalten ixp).

## Veröffentlicht (22.10.2026)

- Pakete auf ghcr.io gelöscht und ohne ixp neu gebaut; Repo und Paket sind öffentlich (ohne Anmeldung geprüft: Repo, Vorlagen,
  Icon, `ca_profile.xml` und das Image antworten mit 200, `plugins/ixp` mit 404, auf GitHub nur der Zweig `master`).
- Die Organisation musste öffentliche Pakete erst erlauben (Organisation → Settings → Packages → Package creation → Public).

## Eingereicht (22.10.2026)

- Bei <https://ca.unraid.net/submit> eingereicht, Anzeigename „journali's Repository“ (der Name „Taloan's Repository“ war vergeben).
  Scan: 3 Docker-Apps (journali, journali-db, journali-advisor), alle Images abrufbar; zwei Hinweise, die nicht stoppen:
  `not_unraid_application: 5` (fünf XML-Dateien der Plugins, keine Vorlagen) und ein Duplikat (`journali-db` nutzt
  `pgvector/pgvector:pg18` wie eine vorhandene App — Moderation prüft).

## Offen

1. Auf die Moderation warten (einige Tage). Rückfragen kommen vom Unraid-Konto des Anwenders; bei geänderten Vorlagen danach im
   Submit-Bereich erneut Validate und Scan.
2. Selbst installieren aus dem öffentlichen Image (`unraid/journali-db.xml`, `unraid/journali.xml`) und prüfen, was ein fremder
   Anwender sieht — noch nicht gemacht.
3. Fragen zur Lizenz (AGPL-3.0), zur Marke „journali PIM“ und zum Duplikat: kurz und sachlich auf Englisch beantworten.

## Auf anderen Rechnern

Nach dem Umschreiben gilt dort einmal `git fetch` und `git reset --hard origin/master` (ungepushte Arbeit vorher sichern).
ixp zum Entwickeln: `git clone <gitea>/<besitzer>/journali-ixp.git plugins/ixp` (steht in `.gitignore`).
