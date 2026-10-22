# journali in die Unraid Community Applications (CA) aufnehmen

Stand 20.10.2026. Regeln: <https://ca.unraid.net/submit/help> — das eingereichte Repository ist öffentlich, hat in der
Wurzel eine OSI-anerkannte `LICENSE` und eine `ca_profile.xml` mit nicht leerem `<Profile>`, dazu gültige Vorlagen.
Ein Thread im Unraid-Forum ist keine Pflicht. Die Schritte mit eigenen Konten (GitHub, Unraid) sind von Hand.

## Im Repo erledigt

- `LICENSE`: GNU Affero General Public License, Version 3 (seit 20.10.2026).
- `ca_profile.xml` in der Wurzel.
- Drei Vorlagen unter `unraid/`, je mit `<TemplateURL>` auf genau diese Datei (raw) und `<Icon>` auf `unraid/journali.png`:
  - `journali.xml` — der Server, Image `ghcr.io/journalipim/journali:latest`;
  - `journali-db.xml` — Postgres 18 mit der Erweiterung vector (`pgvector/pgvector:pg18`);
  - `journali-advisor.xml` — der Dienst eines Produktberaters, aus dem Image von journali.
- Das Image baut `.github/workflows/docker.yml` bei jedem Push auf `master`.

## Vor der Veröffentlichung

1. **Verlauf umschreiben** — Name und Adresse des Autors, eigene Adressen und die Zeilen „Co-Authored-By“ aus dem ganzen
   Verlauf; die Regeln dazu liegen ausserhalb des Repos (`%USERPROFILE%\.journali\veroeffentlichung\`), die Sicherung
   des alten Verlaufs daneben unter `sicherung\`. Ablauf: frische Kopie, `git filter-repo` mit den Regeln, Build und beide
   Testläufe, dann den alten Stand als Zweig `archiv/vor-umschreiben` auf die Gitea und den neuen mit `--force-with-lease`
   nach `origin` und `github`. Danach auf jedem Rechner einmal `git fetch` und `git reset --hard origin/master`, und in
   `journali-lizenz` das Submodul auf den neuen Stand.
2. **Plugin ixp** — liegt seit 22.10.2026 in einem eigenen Repo auf der Gitea, nicht mehr hier. Aus dem Verlauf kommt es im
   selben Umschreiben (`--path plugins/ixp --invert-paths`). Ältere Fassungen des Pakets auf ghcr.io enthalten es noch: vor dem
   Öffentlichstellen alle Fassungen bis einschliesslich der letzten mit ixp löschen (*Package settings* → *Manage versions*).
3. **Repo öffentlich** — GitHub → `journalipim/journali` → *Settings* → *Change visibility* → **Public**.
4. **Image öffentlich** — GitHub → Organisation → *Packages* → `journali` → *Package settings* → *Change visibility* →
   **Public**. Ein öffentliches Paket lässt sich nicht wieder auf privat stellen. Ohne Anmeldung prüfen:

   ```bash
   docker pull ghcr.io/journalipim/journali:latest
   ```

5. **Selbst installieren** — `unraid/journali-db.xml` und `unraid/journali.xml` nach
   `/boot/config/plugins/dockerMan/templates-user/` kopieren (als `my-journali-db.xml`, `my-journali.xml`), erst die
   Datenbank, dann journali anlegen, die Web-Oberfläche öffnen, Datenbank eintragen, Administrator anlegen.

## Einreichen

1. <https://ca.unraid.net/submit> öffnen (Anmeldung mit GitHub) → **Submit new**.
2. Repository-URL: `https://github.com/journalipim/journali`.
3. **Validate** — gemeldete Fehler in den XML-Dateien beheben, pushen, erneut prüfen.
4. **Scan** — erwartet sind drei Apps: `journali`, `journali-db`, `journali-advisor`.
5. Einreichen. Die Prüfung kann einige Tage dauern; danach steht journali in Unraid unter *Apps*.

## Danach

- Fragen in den GitHub-Issues beantworten (`<Support>` der Vorlagen); ein Forum-Thread kann später dazukommen —
  dann `<Support>` in den Vorlagen und `<Forum>` in `ca_profile.xml` darauf setzen.
- Das Image mit neuen Unraid-Versionen lauffähig halten.
- Bei Ende der Pflege die CA-Moderation informieren oder `<Deprecated>true</Deprecated>` in die Vorlagen.
