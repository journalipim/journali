# Entwurf: Abschnitt „Benachrichtigung über neue Beiträge“ für die Datenschutzerklärung

Einzufügen in die Seite „Datenschutzerklärung“ hinter „Kontaktformular“. Keine Rechtsberatung — vor dem Veröffentlichen prüfen,
ob die Angaben zu den Einstellungen in MailPoet passen. Zwei Stellen haben Varianten: **[A]/[B] Versand** und **[C]/[D] Auswertung**.

**Eingesetzt am 04.10.2026** in die Seite „Datenschutzerklärung“ mit **[A]** (Versand über den Hoster) und **[C]** (ohne Auswertung); unbestätigte Anmeldungen löscht MailPoet nach 30 Tagen (so eingestellt).

---

### Benachrichtigung über neue Beiträge (Newsletter)

Auf unserer Website können Sie sich mit Ihrer E-Mail-Adresse eintragen, um per E-Mail über neue Beiträge informiert zu werden. Die Anmeldung ist freiwillig.

**Welche Daten wir verarbeiten.** Für den Versand benötigen wir nur Ihre E-Mail-Adresse. Freiwillig können Sie Ihren Namen angeben, damit wir Sie persönlich ansprechen können. Außerdem speichern wir den Zeitpunkt der Anmeldung und der Bestätigung sowie die IP-Adresse, von der aus Sie sich angemeldet und bestätigt haben.

**Bestätigung Ihrer Anmeldung (Double-Opt-in).** Nach der Anmeldung erhalten Sie eine E-Mail mit einem Bestätigungslink. Erst wenn Sie diesen Link aufrufen, nehmen wir Ihre Adresse in den Verteiler auf. So stellen wir sicher, dass sich niemand mit einer fremden E-Mail-Adresse anmelden kann. Den Zeitpunkt und die IP-Adresse von Anmeldung und Bestätigung speichern wir, um Ihre Einwilligung nachweisen zu können.

**Rechtsgrundlage.** Der Versand erfolgt auf Grundlage Ihrer Einwilligung (Art. 6 Abs. 1 lit. a DSGVO). Die Protokollierung der Anmeldung beruht auf unserem berechtigten Interesse, die Einwilligung nachweisen zu können (Art. 6 Abs. 1 lit. f DSGVO).

**Wo Ihre Daten gespeichert werden.** Die Anmeldedaten speichern wir in der Datenbank dieser Website, die bei unserem Hosting-Anbieter in Deutschland betrieben wird. Für die Verwaltung der Anmeldungen und den Versand nutzen wir das WordPress-Plugin MailPoet.

> **[A] — Versand über den Mailserver des Hosters**
> Die E-Mails werden über den Mailserver unseres Hosting-Anbieters versendet. Ihre Daten werden dafür nicht an weitere Dienste übermittelt.

> **[B] — Versand über den Versanddienst von MailPoet**
> Für den Versand nutzen wir den Versanddienst von MailPoet. Dabei werden Ihre E-Mail-Adresse und der Inhalt der E-Mail an den Anbieter dieses Dienstes übermittelt: *[Name des Anbieters, Sitz, ggf. Grundlage der Übermittlung in ein Drittland — aus dem Vertrag zur Auftragsverarbeitung bzw. den Angaben von MailPoet übernehmen]*. Mit dem Anbieter besteht ein Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO.

> **[C] — ohne Auswertung**
> Wir werten nicht aus, ob Sie eine E-Mail öffnen oder Links darin anklicken.

> **[D] — mit Auswertung**
> Unsere E-Mails enthalten technische Mittel, mit denen wir feststellen, ob eine E-Mail geöffnet und welche Links darin angeklickt wurden. Diese Auswertung dient dazu, unser Angebot zu verbessern, und beruht ebenfalls auf Ihrer Einwilligung. Sie können ihr jederzeit widersprechen, indem Sie sich abmelden.

**Abmeldung und Widerruf.** Sie können Ihre Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen. Jede E-Mail enthält dafür einen Link zur Abmeldung; alternativ genügt eine Nachricht an info@journali.de. Die Rechtmäßigkeit der bis dahin erfolgten Verarbeitung bleibt davon unberührt.

**Speicherdauer.** Ihre Daten speichern wir, bis Sie sich abmelden. Danach löschen wir Ihre E-Mail-Adresse aus dem Verteiler. Den Nachweis Ihrer früheren Einwilligung (Zeitpunkt und IP-Adresse) bewahren wir höchstens drei Jahre auf, um auf mögliche Ansprüche reagieren zu können; anschließend wird er gelöscht. Wird eine Anmeldung nicht bestätigt, löschen wir die Angaben nach spätestens 30 Tagen.

---

## Vor dem Einfügen in MailPoet prüfen

- **Versand:** MailPoet → Einstellungen → Versenden mit. Eigener SMTP-Server bzw. Hoster → **[A]**; MailPoet-Versanddienst → **[B]**, dann Anbieter und Grundlage aus dem Vertrag zur Auftragsverarbeitung eintragen.
- **Auswertung:** MailPoet → Einstellungen → Erweitert → Tracking. Abgeschaltet → **[C]**, sonst **[D]**. Empfehlung: abschalten, dann bleibt der Abschnitt kurz.
- **Double-Opt-in:** MailPoet → Einstellungen → Anmeldebestätigung muss eingeschaltet sein.
- **Unbestätigte Anmeldungen löschen:** prüfen, ob MailPoet sie nach einer Frist entfernt — sonst den Satz mit den 30 Tagen anpassen oder streichen.
- **Standort des Hosters:** „in Deutschland“ nur stehen lassen, wenn das Rechenzentrum des Hosters dort liegt (Vertrag zur Auftragsverarbeitung mit dem Hoster).
- **Speicherdauer des Nachweises:** Die drei Jahre sind ein üblicher Wert (regelmäßige Verjährungsfrist); ein anderer Wert ist möglich.
