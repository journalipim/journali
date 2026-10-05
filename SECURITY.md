# Sicherheit

## Eine Schwachstelle melden

Eine Schwachstelle gehört nicht in ein öffentliches Issue. Gemeldet wird sie vertraulich über GitHub: im Repository unter
**Security → Report a vulnerability**. Die Meldung sehen nur der Melder und journali.

Hilfreich sind: betroffene Version (oben in der Leiste der Oberfläche), was sich wie ausnutzen lässt, und ob es schon ausgenutzt wird.

## Was dann geschieht

1. journali bestätigt den Eingang und prüft die Meldung.
2. Die Schwachstelle wird eingestuft und behoben; die Korrektur kommt mit einer neuen Version.
3. Die Release Notes nennen die behobene Schwachstelle; bei Bedarf gibt es eine Kennung (CVE) und eine Sicherheitsmeldung im Repository.
4. Eine aktiv ausgenutzte Schwachstelle meldet journali als Hersteller, soweit der Cyber Resilience Act (EU 2024/2847) das verlangt.

## Welche Versionen Korrekturen bekommen

Sicherheitskorrekturen gibt es für die jeweils neueste veröffentlichte Version. Sie sind kostenlos — auch dann, wenn spätere
Versionen Grenzen gegen Geld einführen.

## Bekannte Fehler

Schwere Fehler, besonders solche mit Gefahr von Datenverlust, stehen in [BEKANNTE-FEHLER.md](BEKANNTE-FEHLER.md) und in den
Release Notes der Version, die sie behebt.
