---
title: journali auf Unraid – Server, Datenbank und Produktberater als App
excerpt: Drei Vorlagen für Unraid: journali, die Datenbank mit Vektoren und der Dienst eines Produktberaters – alle aus demselben öffentlichen Image.
slug: journali-auf-unraid
tags: [Unraid, Betrieb, Docker, PostgreSQL]
categories: [Entwicklung]
date: 2026-10-24 06:00
description: journali auf Unraid: Vorlagen für Server, Datenbank und Produktberater – in wenigen Schritten als App, mit dem öffentlichen Image.
keyphrase: journali auf Unraid
---
**journali läuft auf Unraid wie jede andere App.** Drei Vorlagen liegen im öffentlichen Repository: eine für den **Server**, eine für die **Datenbank** und eine für den **Dienst eines Produktberaters**. Das Image `ghcr.io/journalipim/journali` ist öffentlich, ihr braucht kein Konto dafür.

## Drei Vorlagen, drei Apps

| Vorlage | App | Was sie startet |
|---|---|---|
| `journali.xml` | journali | den Server, Port 8080, das Datenverzeichnis unter `appdata/journali` |
| `journali-db.xml` | journali-db | PostgreSQL 18 mit der Erweiterung `vector` (`pgvector/pgvector:pg18`) |
| `journali-advisor.xml` | journali-advisor | den Dienst eines Produktberaters, aus demselben Image wie journali |

Die Datenbank ist eine eigene App. Die Erweiterung `vector` legt journali beim ersten Start selbst an. Ohne sie läuft alles außer der Suche nach Sinn, der Frage an die Dokumente und dem Band „Ähnliche Knoten“ – eine vorhandene PostgreSQL-18-App tut es also auch, nur ohne diese drei.

## In wenigen Schritten

1. **Vorlagen kopieren.** Die Dateien aus dem Ordner `unraid/` des Repositories auf den USB-Stick des Servers legen, nach `config/plugins/dockerMan/templates-user/` (als `my-journali-db.xml` und `my-journali.xml`).
2. **Datenbank anlegen.** *Docker* → *Add Container* → *Template* → `journali-db`; ein Passwort für `postgres` setzen, der Port ist frei wählbar.
3. **journali anlegen.** Dieselbe Folge mit der Vorlage `journali`.
4. **Einrichten.** Die Web-Oberfläche öffnen: Der Einrichtungsdialog fragt die Datenbank ab (Host ist die Adresse des Unraid-Servers, dazu Port, Benutzer `postgres` und Passwort) und legt den ersten Administrator an.
5. **Vektoren.** Unter ⬡ Plugins das Plugin `embed` einschalten und im Tasker den Job starten. Der erste Lauf holt ein Modell von etwa 120 MB und dauert darum länger.

Ein neuer Stand kommt wie bei jeder App: Der Container wird mit dem neuen Image neu erstellt.

## Der Produktberater als dritte App

Der Dienst eines [Produktberaters](/?p=233) läuft **aus demselben Image wie journali** – es enthält `node` und das Plugin `advisor`, und ein Update hält beide auf demselben Stand. Die Vorlage `journali-advisor` startet statt des Servers den Dienst:

1. In journali den Berater anlegen und ein Token ausgeben (＋ Token, es ist nur in diesem Moment sichtbar).
2. Die Vorlage `journali-advisor` anlegen. **JOURNALI** ist die Adresse des Unraid-Servers mit dem Port von journali (aus dem Container heraus ist `localhost` der Container selbst), **JOURNALI_ADVISOR** der Schlüssel des Beraters, **JOURNALI_ADVISOR_TOKEN** das Token.
3. Die *WebUI* öffnet `/health`: Dort steht `ok`, wenn journali mit dem Token antwortet.
4. Einen Reverse Proxy mit TLS auf den Port des Dienstes (8090) richten. In der Vorlage steht `JOURNALI_PROXY` auf `1`; ohne Proxy stellt ihr es auf `0`.
5. Das Script-Tag aus der Ansicht des Beraters auf die Website setzen.

Ein zweiter Berater ist eine zweite App aus derselben Vorlage: anderer Name, anderer Port, anderer Schlüssel, eigenes Token.

## In den Community Applications

Die Vorlagen sind bei den **Community Applications** eingereicht; die Prüfung läuft. Sobald journali dort geführt wird, entfällt das Kopieren: Dann findet ihr die Apps unter *Apps* in Unraid.

## Und jetzt?

journali ist eine Testversion und steht als [Open Source](/2026/10/23/open-source-agpl/) unter der AGPL-3.0. Probiert die [Demo](https://journali.de/journali-testen/) aus oder startet journali auf eurem Server – hier entsteht etwas ganz Großes, und ihr könnt dabei sein: [Bleibt dran](/#kontakt).
