# Produktberatung

Ein Berater beantwortet Fragen von Besuchern einer Website zu Produkten: Der Besucher schreibt, was er sucht, und bekommt die passenden Produkte, die Merkmale, nach denen sie sich unterscheiden, und auf Wunsch einen Vergleich. Fremde KI-Agenten stellen dieselben Fragen über MCP. Berater legt man unter ⇪ Export → Produktberatung an; das Plugin gehört ab Pro+ zum Tarif.

## Was ein Berater zeigt

Drei Angaben bestimmen, was ein Berater zeigt, und jede schränkt ein:

| Angabe | bestimmt |
|---|---|
| Publikationsbaum | welche Produkte: was der Baum für seinen Kanal ausleitet, mit den freigegebenen Varianten |
| Rolle | was davon sichtbar ist: eingeschränkte Knoten und Ordner fallen weg |
| Sicht | welche Attribute am Produkt, in den Facetten und im Vergleich erscheinen |

Ein Attribut, das nicht in der Sicht steht, erscheint nirgends, auch nicht als Filter. Bilder erscheinen, wenn sie heute gelten und freigegeben sind.

## Wie der Berater antwortet

Ohne KI: Er sucht die Wörter der Frage in den Produkten und ihren Varianten. Mit dem Plugin embed sucht er zusätzlich nach dem Sinn, sodass „hält Hitze aus“ ein Produkt mit „temperaturbeständig bis 120 °C“ findet. Unter den Treffern stehen Facetten: Merkmale der Sicht, nach denen sich die Treffer unterscheiden, etwa „Farbe: Rot (3)“ oder „Leistung bis 550 W“. Ein Klick grenzt ein. Zwei bis vier Produkte lassen sich nebeneinander vergleichen.

Mit KI: Ist „Text zu den Treffern“ eingeschaltet, schreibt die KI des gewählten Teams zwei bis vier Sätze zu den ersten Treffern. Sie bekommt nur diese Treffer mit den Werten der Sicht. Das Fenster kennzeichnet den Text als von einer KI erstellt. Der Verbrauch zählt beim gewählten Team.

## Anlegen und einrichten

1. ⇪ Export → Produktberatung, Schlüssel eingeben (etwa `shop`), ＋.
2. Publikationsbaum, Rolle und Sicht wählen, die Sprachen und eine Begrüssung je Sprache eintragen.
3. Unter Websites die Adressen der Seiten eintragen, die das Fenster einbinden, je Zeile eine (`https://www.example.com`).
4. Speichern. Die Vorschau stellt dieselbe Frage wie ein Besucher.
5. ＋ Token: Das Token ist nur jetzt sichtbar und gehört in die Umgebung des Dienstes (`JOURNALI_ADVISOR_TOKEN`).

Fehlt eine Angabe, steht ✗ in der Liste und der Grund darunter; der Berater antwortet dann nicht.

## Der Dienst und die Website

Besucher erreichen nicht journali, sondern den Dienst des Beraters, einen eigenen Container, der nur über die Schnittstelle mit journali spricht. Die Einrichtung steht in `docs/betrieb.md` unter „Produktberater“. Auf der Website genügt ein Tag:

```html
<script src="https://advisor.example.com/widget.js" async></script>
```

KI-Agenten erreichen denselben Dienst unter `https://advisor.example.com/mcp`, mit den Werkzeugen `search_products`, `get_product` und `compare_products`. Alle drei lesen nur.

## Grenzen

| Grenze | Vorgabe | zählt |
|---|---|---|
| Besucher/min | 20 | der Dienst, je Adresse |
| Besucher/Tag | 300 | der Dienst, je Adresse |
| gesamt/Tag | ohne | journali, alle Fragen des Beraters |
| KI/Tag | ohne | journali, Texte der KI |

## Was öffentlich ist

Was ein Berater zeigt, kann jeder Besucher der Website und jeder KI-Agent lesen. Vor dem Einschalten fragt ⬡ Plugins das ab. Die Wahl von Baum, Rolle und Sicht und die Angaben auf der Website, etwa zum Datenschutz, verantwortet der Betreiber. Der Dienst speichert nichts auf Platte; die Zahl der Fragen je Besucheradresse hält er im Arbeitsspeicher, bis der Tag vorbei ist.
