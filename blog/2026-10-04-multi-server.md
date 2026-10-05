---
title: Multi-Server ist da – ein Journal, so viele Server, wie ihr braucht
excerpt: Ein Server war gestern. journali verteilt sich ab sofort auf mehrere Server – alle auf demselben Journal, alle nach wenigen Sekunden auf demselben Stand.
slug: multi-server
tags: [Betrieb, Architektur, PostgreSQL]
categories: [Entwicklung]
wp: 26
---
Ein Server war gestern. **journali läuft ab sofort auf mehreren Servern gleichzeitig** – alle auf derselben Datenbank, alle auf demselben Journal. Der große Import läuft in der Zentrale, das Team am anderen Standort arbeitet auf seinem eigenen Server vor Ort, und niemand bremst niemanden aus.

## Ein Journal, viele Server

Was ein Server ins Journal schreibt, haben alle anderen **nach wenigen Sekunden**. Keine Synchronisation von Hand, keine Exporte zwischen Standorten, kein „welcher Stand gilt denn jetzt?“. Das Journal bleibt die Single Source of Truth – jeder Server baut seine Sicht daraus, live.

## Der Hauptserver hat alles im Griff

Ein Server ist **Hauptserver**. Er rechnet die Vorschauen eurer Bilder, macht Dokumente durchsuchbar, erzeugt die Vektoren für die Suche nach Sinn und liest Bildabmessungen – genau einmal, nicht doppelt auf jedem Server.

Und zwei Hauptserver? **Gibt es nicht.** Eine Sperre direkt in PostgreSQL sorgt dafür. Fällt der Hauptserver weg, gibt die Datenbank die Sperre sofort frei.

## Jeder Server bringt seine Jobs mit

Ein Job gehört dem Server, auf dem ihr ihn anlegt – mit dessen Verzeichnissen, Fächern und Zugängen. Der Export landet also genau dort, wo das Team ihn braucht. **Starten, anhalten, abbrechen geht trotzdem von jedem Server aus.** Ein Klick, und der Auftrag läuft auf dem richtigen Rechner.

## Keine Ports, keine Tunnel, kein VPN

Die Server müssen einander nicht erreichen. **Sie verständigen sich ausschließlich über die Datenbank** – die erreichen sie ohnehin. Firewall, anderer Standort, Container hinter NAT: alles kein Thema.

## Alles im Blick: ⧉ Server

Unter Einstellungen → ⧉ Server seht ihr jeden Server auf einen Blick: Name, Rolle, Version und Build, Stand des Journals, letzter Puls, laufende Jobs, laufender Import. Hauptserver festlegen, Server benennen, sperren, aufräumen – alles mit einem Klick. Läuft irgendwo eine andere Version, seht ihr das sofort.

## Und jetzt?

journali ist noch in Entwicklung – Multi-Server steckt ab sofort drin. Hier entsteht etwas ganz Großes, und ihr könnt dabei sein: [Bleibt dran](/#kontakt).
