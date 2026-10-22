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

## Offen, in dieser Reihenfolge

1. **Pakete auf ghcr.io**: ältere Fassungen enthalten ixp. Das ganze Paket löschen — Organisation journalipim → Packages →
   journali → Zahnrad *Package settings* → *Delete this package*. Der nächste Bau legt es ohne ixp neu an.
2. **Repo öffentlich stellen** (GitHub → Settings → Change visibility → Public). Nicht rückgängig zu machen.
3. **Paket öffentlich stellen** (Package settings → Change visibility). Nicht rückgängig zu machen.
4. Ohne Anmeldung prüfen: `docker pull ghcr.io/journalipim/journali:latest`.
5. Selbst installieren, dann bei <https://ca.unraid.net/submit> einreichen (Validate, Scan, Submit).
6. Ob die CA-Moderation eine AGPL-App mit einer Marke und einem Tarifmodell aufnimmt, zeigt die Prüfung.

## Auf anderen Rechnern

Nach dem Umschreiben gilt dort einmal `git fetch` und `git reset --hard origin/master` (ungepushte Arbeit vorher sichern).
ixp zum Entwickeln: `git clone <gitea>/<besitzer>/journali-ixp.git plugins/ixp` (steht in `.gitignore`).
