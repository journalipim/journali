---
title: Wer darf was – journali richtet sich nach den Menschen
excerpt: Anwender, Rollen mit Rechten und Teams – jede Person sieht und tut, was ihre Rolle erlaubt.
slug: wer-darf-was
tags: [Betrieb, Architektur, Journal]
categories: [Entwicklung]
date: 2026-10-16 06:00
wp: 155
---
Montagmorgen. Die Redaktion pflegt Produkttexte, der Übersetzungsdienst braucht nur seinen Teilbaum, das Marketing lädt Bilder herunter, die IT legt neue Kolleginnen und Kollegen an, und eine zweite Abteilung nutzt ihre eigenen KI-Schlüssel. In vielen Systemen heißt das: ein Konto für alle oder ein Berg von Sonderregeln. **In journali richtet ihr es einmal ein – und jede Person sieht und tut genau das, wofür sie da ist.**

## Jede Person hat ein Konto – und einen Namen im Journal

Ein **Anwender** hat Anmeldenamen, Anzeigenamen, eine Rolle und ein Team. Der Anmeldename steht als **Urheber in jedem Journaleintrag**, den die Person schreibt – er kommt aus der Sitzung, nicht vom Client. Wer was geändert hat, ist damit nachvollziehbar wie alles in journali.

Anwender und Rollen stehen selbst im Journal. Passwörter nicht: Sie liegen als Hash beim Server, und jeder Server auf derselben Datenbank kennt sie. Ein Anwender lässt sich sperren und wieder freischalten. **Den letzten Administrator könnt ihr nicht aus Versehen aussperren** – er lässt sich weder sperren noch entfernen.

## Rollen sind Mengen von Rechten

Eine Rolle ist eine Menge von Rechten, und es gibt dreizehn davon: lesen, pflegen, zurückziehen, freigeben, Modell ändern, Plugins verwalten, Jobs, Storage, Teammanager, Anwender und Rollen, herunterladen – und zwei für Skripte. Vorbelegt sind fünf Rollen:

- **Administrator** – alle Rechte
- **PIM-Manager** – lesen, pflegen, zurückziehen, freigeben, Modell, Jobs
- **PIM-Editor** – lesen, pflegen, zurückziehen, freigeben
- **Team-Admin** – lesen, pflegen, Team
- **Leser** – lesen

Das ist Saatgut für ein leeres Journal. Unter **◈ IAM** ändert ihr diese Rollen, ergänzt eigene oder entfernt, was ihr nicht braucht. Eine Rolle für den Übersetzungsdienst – lesen und pflegen, sonst nichts – ist schnell angelegt.

## Sehen ist nicht haben

Zwei Dinge sorgen dafür, dass niemand mehr sieht, als er soll.

**Herunterladen ist ein eigenes Recht.** Die Kacheln und Angaben eines Mediums sieht, wer lesen darf; das Original und seine Ableitungen lädt, wer das Recht zum Herunterladen hat. Wer pflegt, darf herunterladen.

**Teilbäume und Medienordner lassen sich auf Rollen beschränken.** Ein Knoten ist dann für die genannten Rollen sichtbar – ab dort abwärts, bis ein Nachfahre eigene Rollen nennt. Die Listen zeigen nur, was die Rolle sieht, und ein einzelnes Ding, das sie nicht sieht, ist für sie nicht da – auf jedem Weg, auch über die Schnittstelle. Administratoren sehen alles.

Auch die Einstellungen passen sich an: Es erscheinen nur die Reiter, die zu euren Rechten gehören. **◈ IAM** gibt es nur mit dem Recht zur Anwenderverwaltung, **▨ Storage** nur mit dem Recht für Storage. Was ihr nicht ändern dürft, seht ihr dort nicht.

## Teams: führen und dazugehören

Ein **Team** ist eine Gruppe von Personen, die am Gesamtsystem mitarbeitet. Daran hängen KI-Schlüssel und KI-Austauschvolumen. Jede Instanz bringt das **Init Team** mit – nicht löschbar, umbenennbar. Der erste Administrator gehört hinein und führt es. Wer kein eigenes Team hat, arbeitet dort.

Führen und dazugehören sind zweierlei: Eine Person kann **Manager mehrerer Teams** sein, aber **Mitglied nur eines**. So führt jemand aus der IT mehrere Standorte und sitzt trotzdem in genau einem Team. Teammanager tragen Mitglieder ein und aus und pflegen die Schlüssel ihres Teams; neue Teams legt, wer Anwender verwaltet.

## API-Token: Skripte arbeiten mit euren Rechten

Unter **◐ Mein Account** legt jede Person eigene **API-Token** an – für das Excel-Add-in, OnlyOffice und Skripte. Ein Token arbeitet **mit den Rechten der Person**: Ein Leser mit Token bleibt Leser. Was damit geschrieben wird, ist dem Team der Person zugeordnet. Sichtbar ist der Token nur beim Anlegen, danach liegt von ihm nur der Hash vor, und ihr widerruft ihn mit einem Klick. Auch Jobs bekommen je Lauf ein eigenes Dienst-Token, das mit dem Lauf erlischt.

## Und jetzt?

journali ist noch in Entwicklung – Anwender, Rollen und Teams stecken schon drin. Hier entsteht etwas ganz Großes, und ihr könnt dabei sein: [Bleibt dran](/#kontakt).
