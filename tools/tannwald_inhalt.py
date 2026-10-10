"""
Inhalte der Demo-Marke Tannwald (demo_master_tree.py): je Untergruppe die technischen Merkmale, Bausteine für Beschreibung und
Merkmalsliste (deutsch und englisch), Pflegehinweise und ein Dokument „Pflege, Reparatur und häufige Fragen“; je Obergruppe ein
Ratgeber; für die Marke „Garantie und Service“. Alles erfunden, keine echten Produkte, Firmen oder Personen.

Die Texte sind so geschrieben, wie sie in einem Onlineshop stehen würden, und sie sind die Grundlage für die Produktberatung: der Berater
findet in den Unterlagen, was in keinem Attribut steht (wie man einen Reißverschluss wieder gängig macht, wie warm ein Schlafsack hält).

Je Produkt zieht ein eigener Zufall (Saat = Produktname): ein zweiter Lauf schreibt dieselben Werte, unabhängig davon, welche Produkte es
schon gab.
"""
from __future__ import annotations

import random

# ---------------------------------------------------------------- Modell: Einheiten, Attributgruppen, Attribute

EINHEITEN = [
    # (Symbol, de, en, Grösse)
    ("°C", "Grad Celsius", "degree Celsius", "temperature"),
    ("h", "Stunde", "hour", "time"),
    ("min", "Minute", "minute", "time"),
    ("W", "Watt", "watt", "power"),
    ("lm", "Lumen", "lumen", "luminous flux"),
]

# Shopangaben: gelten für alle Tannwald-Produkte (an der Markengruppe)
SHOP_GRUPPE = ("tw_shop", "Shopangaben", "Shop details")
SHOP_ATTRS = [
    ("features", "Merkmale", "Features", "html", {"axes": ["locale"]}),
    ("use_case", "Einsatzbereich", "Intended use", "text", {"axes": ["locale"]}),
    ("care", "Pflegehinweise", "Care instructions", "html", {"axes": ["locale"]}),
    ("warranty_years", "Garantie (Jahre)", "Warranty (years)", "integer", {"inheritable": True}),
]

SICHT = ("onlineshop", "Onlineshop", "Online shop")


def ja(r: random.Random, p: float = 0.5) -> str:
    return "true" if r.random() < p else "false"


def zahl(x: float) -> str:
    """Zahl für die Anzeige im Text: deutsch mit Komma, ohne überflüssige Nachkommastellen."""
    s = f"{x:.2f}".rstrip("0").rstrip(".")
    return s.replace(".", ",")


def tausend(n: int) -> str:
    return f"{n:,}".replace(",", " ")


# ---------------------------------------------------------------- Untergruppen
# Je Untergruppe:
#   gruppe   (Schlüssel, de, en) der Attributgruppe mit den technischen Merkmalen
#   attrs    [(Schlüssel, de, en, Typ, weitere Angaben)]
#   werte    r → {Schlüssel: Wert} oder {Schlüssel: (de, en)} für Texte je Sprache
#   einsatz  [(de, en)] — das Einsatzgebiet, steht in der Beschreibung und im Attribut use_case
#   text     (r, ctx) → (Absätze de, Absätze en); ctx: name_de, name_en, material, werte, einsatz
#   merkmale [(de, en)] — daraus fünf bis sieben je Produkt
#   pflege   (de, en) — kurz, für das Attribut care
#   doc      [(Überschrift, [Absatz | ["Punkt", …]])] — „Pflege, Reparatur und häufige Fragen“

K: dict[str, dict] = {}

# ---- Jacken
K["Jacken"] = dict(
    stoff=("recyceltem Polyamid mit PFC-freier Imprägnierung", "recycled polyamide with a PFC-free water-repellent finish"),
    gruppe=("tw_jacken", "Jacken – Technik", "Jackets – technical"),
    attrs=[
        ("waterproof_mm", "Wassersäule", "Hydrostatic head", "integer", {"unit": "mm"}),
        ("breathability", "Atmungsaktivität (g/m²/24 h)", "Breathability (g/m²/24 h)", "integer", {}),
        ("helmet_hood", "Helmtaugliche Kapuze", "Helmet-compatible hood", "boolean", {}),
        ("pockets", "Anzahl Taschen", "Number of pockets", "integer", {}),
        ("fit", "Passform", "Fit", "text", {"axes": ["locale"]}),
        ("season", "Saison", "Season", "text", {"axes": ["locale"]}),
    ],
    werte=lambda r: {
        "waterproof_mm": r.choice([10000, 15000, 20000, 28000]),
        "breathability": r.choice([12000, 15000, 20000, 25000]),
        "helmet_hood": ja(r, 0.4),
        "pockets": r.randint(2, 5),
        "fit": r.choice([("Regular Fit", "Regular fit"), ("Athletic Fit", "Athletic fit"), ("Relaxed Fit", "Relaxed fit")]),
        "season": r.choice([("Ganzjährig", "All year"), ("Frühjahr bis Herbst", "Spring to autumn"), ("Herbst und Winter", "Autumn and winter")]),
    },
    einsatz=[("Wandern bei wechselhaftem Wetter", "hiking in changeable weather"), ("Trekking über mehrere Tage", "multi-day trekking"),
             ("Hochtouren und Skitouren", "alpine and ski touring"), ("Alltag in der Stadt und auf Reisen", "city use and travel")],
    text=lambda r, c: (
        [f"Die {c['name_de']} ist eine Wetterschutzjacke für {c['einsatz'][0]}. Sie hält Regen und Wind ab und lässt trotzdem "
         f"Feuchtigkeit vom Körper nach außen: {tausend(c['werte']['waterproof_mm'])} mm Wassersäule und eine Atmungsaktivität von "
         f"{tausend(c['werte']['breathability'])} g/m²/24 h.",
         f"Das Obermaterial besteht aus {c['stoff'][0]}. Alle Nähte sind verschweißt, der Frontreißverschluss ist mit "
         f"einer Abdeckleiste geschützt. {c['werte']['pockets']} Taschen mit Reißverschluss nehmen Karte, Telefon und Handschuhe auf; "
         + ("die Kapuze passt über einen Kletter- oder Skihelm und lässt sich mit einer Hand einstellen." if c['werte']['helmet_hood'] == "true"
            else "die Kapuze lässt sich mit einer Hand einstellen und im Kragen verstauen."),
         r.choice(["Unter den Armen öffnen zwei Belüftungsreißverschlüsse, wenn es beim Aufstieg warm wird. Bündchen mit Klett und ein "
                   "Saumzug halten die Wärme drinnen.",
                   "Die Ärmel sind vorgeformt, der Rücken etwas länger geschnitten — die Jacke rutscht auch mit Rucksack nicht hoch.",
                   "Die Jacke lässt sich klein in die eigene Brusttasche packen und wiegt nur "
                   f"{zahl(c['gewicht'])} kg."])],
        [f"The {c['name_en']} is a weatherproof jacket for {c['einsatz'][1]}. It keeps out rain and wind while letting moisture escape: "
         f"{c['werte']['waterproof_mm']:,} mm hydrostatic head and a breathability of {c['werte']['breathability']:,} g/m²/24 h.",
         f"The outer fabric is {c['stoff'][1]}. All seams are taped and the front zip sits behind a storm flap. "
         f"{c['werte']['pockets']} zipped pockets hold map, phone and gloves; "
         + ("the hood fits over a climbing or ski helmet and adjusts with one hand." if c['werte']['helmet_hood'] == "true"
            else "the hood adjusts with one hand and stows in the collar."),
         "Pit zips, hook-and-loop cuffs and a drawcord hem let you regulate warmth on the move."]),
    merkmale=[("Wasserdichte, atmungsaktive Membran", "Waterproof, breathable membrane"), ("Vollständig verschweißte Nähte", "Fully taped seams"),
              ("Belüftungsreißverschlüsse unter den Armen", "Pit zips"), ("Einhändig verstellbare Kapuze", "One-hand adjustable hood"),
              ("Abdeckleiste über dem Frontreißverschluss", "Storm flap over the front zip"), ("Klettverschluss an den Bündchen", "Hook-and-loop cuffs"),
              ("Saumzug mit Stopper", "Drawcord hem"), ("Brusttasche mit Kopfhörerdurchlass", "Chest pocket with headphone port"),
              ("PFC-freie Imprägnierung", "PFC-free water repellency"), ("Reflektierende Details", "Reflective details")],
    pflege=("Bei 30 °C im Schonwaschgang mit Flüssigwaschmittel für Funktionstextilien waschen, kein Weichspüler. Im Trockner bei niedriger "
            "Temperatur trocknen — die Wärme frischt die Imprägnierung auf.",
            "Machine wash at 30 °C on a gentle cycle with a technical detergent, no fabric softener. Tumble dry on low heat to reactivate the water repellency."),
    doc=[
        ("Waschen", ["Eine Funktionsjacke darf und soll gewaschen werden: Schweiß, Hautfett und Schmutz verstopfen die Membran und mindern die "
                     "Atmungsaktivität. Schließen Sie alle Reißverschlüsse und Klettverschlüsse, drehen Sie die Jacke auf links und waschen Sie sie "
                     "bei 30 °C im Schonwaschgang.",
                     ["Flüssigwaschmittel für Funktionstextilien verwenden", "keinen Weichspüler und kein Pulver — sie setzen sich in der Membran fest",
                      "zweimal spülen", "nicht chemisch reinigen"]]),
        ("Jacke neu imprägnieren", ["Wasser perlt nicht mehr ab, sondern zieht in das Obermaterial ein? Dann ist es Zeit für eine neue "
                     "Imprägnierung. Die Membran darunter ist meist noch dicht — aber ein vollgesogener Oberstoff lässt keinen Dampf mehr "
                     "durch, und die Jacke fühlt sich innen nass an.",
                     ["Jacke zuerst waschen: Schmutz und Hautfett verhindern, dass die Imprägnierung haftet",
                      "Sprühimprägnierung für Membranjacken auf die noch feuchte Jacke gleichmäßig aufsprühen, Abstand etwa 20 cm, im Freien",
                      "oder Einwaschimprägnierung im zweiten Waschgang zugeben (nur bei Jacken ohne Futter)",
                      "danach 20 Minuten in den Trockner bei niedriger Temperatur — die Wärme bindet die Imprägnierung",
                      "PFC-freie Mittel verwenden; sie wirken etwas kürzer, sind aber nicht schädlich für Gewässer"],
                     "Wie oft? Bei häufiger Nutzung zwei- bis dreimal im Jahr; oft genügt es, nach dem Waschen nur Wärme zu geben."]),
        ("Trocknen und Imprägnierung auffrischen", ["Trocknen Sie die Jacke im Trockner bei niedriger Temperatur oder hängend an der Luft und "
                     "bügeln Sie sie anschließend bei niedriger Stufe mit einem Tuch dazwischen. Die Wärme richtet die Imprägnierung wieder auf. "
                     "Perlt Wasser danach nicht mehr ab, sprühen Sie ein Imprägniermittel für Membranjacken auf die feuchte Jacke und "
                     "trocknen Sie sie erneut mit Wärme."]),
        ("Die Jacke wird innen nass", ["Feuchtigkeit innen ist meist Schweiß, kein Regen: bei hoher Anstrengung entsteht mehr Dampf, als "
                     "die Membran abgeben kann. Öffnen Sie die Belüftungsreißverschlüsse früh und tragen Sie darunter Wäsche aus Merino oder "
                     "Kunstfaser, keine Baumwolle. Ist das Obermaterial vollgesogen, weil die Imprägnierung nachgelassen hat, atmet die Jacke "
                     "nicht mehr — dann hilft Waschen und Imprägnieren."]),
        ("Reparatur: Reißverschluss", ["Klemmt der Reißverschluss, reiben Sie die Zähne mit Kerzenwachs oder Seife ein und bewegen Sie "
                     "den Schieber mehrmals hin und her. Geht er hinter dem Schieber wieder auf, ist der Schieber ausgeleiert: drücken Sie ihn "
                     "mit einer Flachzange an beiden Seiten vorsichtig etwas zusammen. Fehlen Zähne oder ist das Band gerissen, tauschen wir "
                     "den Reißverschluss in unserer Werkstatt aus."]),
        ("Reparatur: kleines Loch im Obermaterial", ["Ein Loch bis etwa 2 cm flicken Sie mit einem selbstklebenden Reparaturflicken für "
                     "Membranmaterial: Stelle reinigen, Flicken mit abgerundeten Ecken zuschneiden, aufkleben und mit dem Daumen eine Minute "
                     "andrücken. Größere Schäden und gelöste Nahtbänder reparieren wir."]),
        ("Häufige Fragen", ["Wie lagere ich die Jacke? Locker hängend und trocken, nicht lange zusammengedrückt im Packsack.",
                     "Kann ich Daunen unter der Jacke tragen? Ja — die Jacke ist so geschnitten, dass eine dünne Daunen- oder Fleecejacke darunter passt.",
                     "Welche Größe brauche ich? Messen Sie Brust- und Taillenumfang und vergleichen Sie mit der Größentabelle im Ratgeber Bekleidung."]),
    ],
)

# ---- Hosen
K["Hosen"] = dict(
    stoff=("elastischem Softshell", "stretch softshell"),
    gruppe=("tw_hosen", "Hosen – Technik", "Trousers – technical"),
    attrs=[
        ("fit", "Passform", "Fit", "text", {"axes": ["locale"]}),
        ("season", "Saison", "Season", "text", {"axes": ["locale"]}),
        ("stretch", "Stretchanteil (%)", "Stretch content (%)", "integer", {}),
        ("zip_off", "Abzippbare Beine", "Zip-off legs", "boolean", {}),
        ("pockets", "Anzahl Taschen", "Number of pockets", "integer", {}),
        ("inseam_cm", "Schrittlänge", "Inside leg", "integer", {"unit": "cm"}),
    ],
    werte=lambda r: {
        "fit": r.choice([("Regular Fit", "Regular fit"), ("Slim Fit", "Slim fit"), ("Relaxed Fit", "Relaxed fit")]),
        "season": r.choice([("Ganzjährig", "All year"), ("Frühjahr bis Herbst", "Spring to autumn"), ("Herbst und Winter", "Autumn and winter")]),
        "stretch": r.choice([6, 8, 10, 12]),
        "zip_off": ja(r, 0.3),
        "pockets": r.randint(4, 7),
        "inseam_cm": r.choice([78, 81, 84]),
    },
    einsatz=[("Wandern und Trekking", "hiking and trekking"), ("mehrtägige Trekkingtouren", "multi-day treks"),
             ("Klettersteige und alpine Wege", "via ferratas and alpine trails"), ("Reisen und Alltag", "travel and everyday use")],
    text=lambda r, c: (
        [f"Die {c['name_de']} ist eine Wanderhose für {c['einsatz'][0]}. Sie besteht aus {c['stoff'][0]} mit "
         f"{c['werte']['stretch']} % Elasthan — sie gibt bei hohen Schritten nach und behält trotzdem ihre Form. Die Knie sind verstärkt.",
         f"Der {c['werte']['fit'][0]} lässt Platz für Bewegung, ohne zu flattern. {c['werte']['pockets']} Taschen, davon zwei mit "
         "Reißverschluss, nehmen Telefon, Karte und Schlüssel sicher auf. "
         + ("Die Beine lassen sich am Knie abzippen; farbige Reißverschlüsse zeigen, welches Bein auf welche Seite gehört."
            if c['werte']['zip_off'] == "true" else "Am Saum hält ein Gummizug mit Haken die Hose über dem Schuh."),
         r.choice(["Das Material ist wasserabweisend ausgerüstet: ein kurzer Schauer perlt ab, und die Hose trocknet schnell.",
                   "Ein integrierter Gürtel und ein Bund mit Gummieinsatz machen einen zweiten Gürtel überflüssig.",
                   "Die verstärkten Partien an Knie und Gesäß halten auch Felskontakt und Rast auf rauem Untergrund aus."])],
        [f"The {c['name_en']} are hiking trousers for {c['einsatz'][1]}. They are made of {c['stoff'][1]} with "
         f"{c['werte']['stretch']} % elastane — they give on high steps and keep their shape.",
         f"The {c['werte']['fit'][1]} leaves room to move without flapping. {c['werte']['pockets']} pockets, two of them zipped, hold phone, "
         "map and keys. " + ("The legs zip off at the knee; colour-coded zips show which leg goes where." if c['werte']['zip_off'] == "true"
                             else "An elastic hem with a lace hook keeps the trousers over the boot."),
         "The fabric has a water-repellent finish: a short shower beads off and the trousers dry quickly."]),
    merkmale=[("Elastisches, wasserabweisendes Material", "Stretchy, water-repellent fabric"), ("Verstärkte Knie und Gesäß", "Reinforced knees and seat"),
              ("Vorgeformte Knie", "Pre-shaped knees"), ("Zwei Reißverschlusstaschen", "Two zipped pockets"), ("Integrierter Gürtel", "Integrated belt"),
              ("Beinabschluss mit Schuhhaken", "Hem with boot hook"), ("Schnell trocknend", "Quick drying"), ("Schadstoffgeprüfte Farbstoffe", "Dyes tested for harmful substances")],
    pflege=("Bei 30 °C mit Feinwaschmittel waschen, auf links gedreht, Reißverschlüsse geschlossen. Kein Weichspüler. Hängend trocknen.",
            "Wash at 30 °C with a mild detergent, inside out and with zips closed. No fabric softener. Line dry."),
    doc=[
        ("Waschen und Trocknen", ["Waschen Sie die Hose bei 30 °C im Schonwaschgang mit einem Feinwaschmittel. Schließen Sie vorher alle "
                     "Reißverschlüsse und drehen Sie die Hose auf links. Weichspüler verklebt die Fasern und hebt die wasserabweisende "
                     "Ausrüstung auf. Die Hose trocknet hängend in wenigen Stunden; im Trockner höchstens bei niedriger Temperatur.",
                     ["30 °C, Schonwaschgang", "Feinwaschmittel, kein Weichspüler", "auf links, Reißverschlüsse zu", "nicht bleichen, nicht chemisch reinigen"]]),
        ("Wasserabweisung erneuern", ["Perlt Wasser nicht mehr ab, waschen Sie die Hose und sprühen Sie ein Imprägniermittel auf das noch "
                     "feuchte Material. Danach 20 Minuten im Trockner bei niedriger Temperatur oder mit dem Bügeleisen auf niedriger Stufe — "
                     "die Wärme bindet die Imprägnierung."]),
        ("Reparatur: Reißverschluss", ["Ein kaputter Reißverschluss an der Hose lässt sich oft selbst reparieren, ohne ihn auszutauschen. "
                     "Was zu tun ist, hängt davon ab, was genau nicht stimmt:",
                     ["Der Reißverschluss geht von selbst wieder auf: der Schieber ist ausgeleiert. Drücken Sie ihn mit einer kleinen "
                      "Flachzange an beiden Seiten vorsichtig etwas zusammen und prüfen Sie nach jedem Schritt.",
                      "Der Schieber ist herausgerutscht: an der oberen Endklemme vorsichtig wieder auffädeln und eine neue Endklemme setzen; "
                      "Ersatzschieber und Endklemmen schicken wir kostenlos.",
                      "Die Zähne greifen nicht mehr ineinander oder fehlen: das Band muss getauscht werden — das übernimmt unsere Werkstatt.",
                      "Der Reißverschluss klemmt: Zähne mit Kerzenwachs, Seife oder einem Grafitstift einreiben und den Schieber mehrmals bewegen.",
                      "Nur die Zuglasche ist abgebrochen: ein kleiner Schlüsselring oder eine Schlaufe aus Reepschnur ersetzt sie."]]),
        ("Reparatur: Loch, Riss, Knopf und Saum", ["Ein kleines Loch oder einen Riss im Material flicken Sie mit einem aufbügelbaren "
                     "Flicken von innen: Stelle säubern, Flicken etwas größer als das Loch zuschneiden, mit dem Bügeleisen ohne Dampf andrücken. "
                     "Bei Löchern an Knie oder Gesäß hält ein aufgenähter Flicken länger. Einen losen Knopf nähen Sie mit doppeltem Polyestergarn "
                     "an. Ein gelöster Saum lässt sich mit einem Saumband aufbügeln. Größere Schäden reparieren wir in unserer Werkstatt."]),
        ("Häufige Fragen", ["Läuft die Hose beim Waschen ein? Nein, das Material ist vorgewaschen; bei 30 °C bleibt die Größe erhalten.",
                     "Welche Schrittlänge hat die Hose? Die Schrittlänge steht in den technischen Daten; Kurz- und Langgrößen fertigen wir auf Anfrage.",
                     "Ist die Hose wasserdicht? Nein, sie ist wasserabweisend. Bei Dauerregen gehört eine Regenhose darüber."]),
    ],
)

# ---- Shirts & Pullover
K["Shirts & Pullover"] = dict(
    gruppe=("tw_shirts", "Shirts & Pullover – Technik", "Shirts & sweaters – technical"),
    attrs=[
        ("fabric_weight", "Stoffgewicht (g/m²)", "Fabric weight (gsm)", "integer", {}),
        ("merino_share", "Merinoanteil (%)", "Merino content (%)", "integer", {}),
        ("fit", "Passform", "Fit", "text", {"axes": ["locale"]}),
        ("sleeve", "Ärmel", "Sleeve", "text", {"axes": ["locale"]}),
        ("odour_control", "Geruchshemmend", "Odour control", "boolean", {}),
    ],
    werte=lambda r: {
        "fabric_weight": r.choice([150, 180, 200, 250]),
        "merino_share": r.choice([60, 87, 100]),
        "fit": r.choice([("Regular Fit", "Regular fit"), ("Slim Fit", "Slim fit")]),
        "sleeve": r.choice([("Kurzarm", "Short sleeve"), ("Langarm", "Long sleeve"), ("Langarm mit Halfzip", "Long sleeve, half zip")]),
        "odour_control": "true",
    },
    einsatz=[("Wandern und Trekking", "hiking and trekking"), ("Reisen mit leichtem Gepäck", "travelling light"),
             ("Laufen und Radfahren", "running and cycling"), ("Skitouren als Basisschicht", "ski touring as a base layer")],
    text=lambda r, c: (
        [f"Das {c['name_de']} ist ein {c['werte']['sleeve'][0]}-Shirt für {c['einsatz'][0]}, aus {c['werte']['merino_share']} % Merinowolle "
         f"mit {c['werte']['fabric_weight']} g/m².",
         "Merino wärmt, wenn es kühl ist, und kühlt, wenn es warm ist; es nimmt Feuchtigkeit auf, ohne sich nass anzufühlen, und hemmt "
         "Geruch — das Shirt lässt sich mehrere Tage tragen, bevor es in die Wäsche muss.",
         r.choice(["Flache Nähte liegen unter dem Rucksack nicht auf, die Schulternähte sind nach vorn versetzt.",
                   "Der etwas längere Rücken bleibt beim Bücken in der Hose.",
                   "Die feine Wolle kratzt nicht und lässt sich direkt auf der Haut tragen."])],
        [f"The {c['name_en']} is a {c['werte']['sleeve'][1].lower()} shirt for {c['einsatz'][1]}, made of {c['werte']['merino_share']} % merino "
         f"wool at {c['werte']['fabric_weight']} gsm.",
         "Merino warms when it is cool and cools when it is warm; it absorbs moisture without feeling wet and resists odour — "
         "you can wear the shirt for several days before it needs washing.",
         "Flatlock seams sit comfortably under a pack and the shoulder seams are set forward."]),
    merkmale=[("Feine Merinowolle, kratzt nicht", "Fine, non-itch merino"), ("Geruchshemmend", "Odour resistant"), ("Flache Nähte", "Flatlock seams"),
              ("Nach vorn versetzte Schulternähte", "Forward shoulder seams"), ("Verlängerter Rücken", "Dropped back hem"),
              ("Temperaturausgleichend", "Temperature regulating"), ("Mulesing-freie Wolle", "Mulesing-free wool")],
    pflege=("Im Wollwaschgang bei 30 °C mit Wollwaschmittel waschen, liegend trocknen, nicht in den Trockner.",
            "Wash on a wool cycle at 30 °C with wool detergent, dry flat, do not tumble dry."),
    doc=[
        ("Waschen", ["Merino braucht selten Wäsche: oft genügt es, das Shirt über Nacht auszulüften. Wenn Sie waschen, dann im Wollwaschgang "
                     "bei 30 °C mit einem Wollwaschmittel, auf links gedreht. Normales Waschmittel enthält Enzyme, die die Wollfasern angreifen.",
                     ["Wollwaschgang, 30 °C", "Wollwaschmittel, kein Weichspüler", "liegend trocknen, nicht im Trockner", "nicht bleichen"]]),
        ("Das Shirt ist eingelaufen", ["Wolle läuft ein, wenn sie zu heiß gewaschen oder im Trockner getrocknet wird. Leicht eingelaufene "
                     "Shirts lassen sich retten: 15 Minuten in lauwarmem Wasser mit etwas Haarspülung einweichen, vorsichtig in Form ziehen "
                     "und liegend trocknen."]),
        ("Löcher in der Wolle", ["Kleine Löcher entstehen durch Reibung (Rucksackgurte) oder Motten. Stopfen Sie sie mit einem feinen "
                     "Wollgarn; Mottenschutz: Shirts sauber und trocken lagern, mit Zedernholz oder Lavendel. Pilling an Reibestellen ist "
                     "bei feiner Wolle normal und lässt sich mit einem Wollkamm entfernen."]),
        ("Häufige Fragen", ["Kratzt Merino? Nein: unsere Merinowolle ist feiner als 18,5 Mikrometer und lässt sich direkt auf der Haut tragen.",
                     "Wie lange hält ein Merinoshirt ohne Wäsche? Auf einer Tour drei bis fünf Tage — Merino nimmt Geruch kaum an.",
                     "Woher kommt die Wolle? Von Farmen, die ohne Mulesing arbeiten."]),
    ],
)

# ---- Mützen & Handschuhe
K["Mützen & Handschuhe"] = dict(
    stoff=("einer Mischung aus Wolle und Acryl", "a wool-acrylic blend"),
    gruppe=("tw_muetzen", "Mützen & Handschuhe – Technik", "Hats & gloves – technical"),
    attrs=[
        ("lining", "Futter", "Lining", "text", {"axes": ["locale"]}),
        ("windproof", "Winddicht", "Windproof", "boolean", {}),
        ("touchscreen", "Touchscreen-fähig", "Touchscreen compatible", "boolean", {}),
    ],
    werte=lambda r: {
        "lining": r.choice([("Fleece", "Fleece"), ("Merino", "Merino"), ("ohne Futter", "unlined")]),
        "windproof": ja(r, 0.5), "touchscreen": ja(r, 0.4),
    },
    einsatz=[("kalte Tage in den Bergen", "cold days in the mountains"), ("Winterwandern", "winter hiking"),
             ("den Alltag im Winter", "everyday winter use"), ("Skitouren und Langlauf", "ski touring and cross-country skiing")],
    text=lambda r, c: (
        [f"Die {c['name_de']} ist eine Mütze für {c['einsatz'][0]}. Sie besteht aus {c['stoff'][0]}"
         + (f", innen mit {c['werte']['lining'][0]}-Futter" if c['werte']['lining'][0] != "ohne Futter" else "") + ".",
         ("Eine winddichte Zwischenlage hält auch bei Sturm die Ohren warm. " if c['werte']['windproof'] == "true" else "")
         + "Der Strick ist dicht und trotzdem elastisch; die Mütze sitzt fest, ohne zu drücken, und passt unter eine Kapuze."],
        [f"The {c['name_en']} is a beanie for {c['einsatz'][1]}. It is made of {c['stoff'][1]}"
         + (f" with a {c['werte']['lining'][1].lower()} lining" if c['werte']['lining'][1] != "unlined" else "") + ".",
         ("A windproof inner layer keeps your ears warm in a gale. " if c['werte']['windproof'] == "true" else "")
         + "The dense, stretchy knit stays put without pinching and fits under a hood."]),
    merkmale=[("Dichter, elastischer Strick", "Dense, stretchy knit"), ("Weiches Futter", "Soft lining"), ("Passt unter eine Kapuze", "Fits under a hood"),
              ("Winddichte Zwischenlage", "Windproof inner layer"), ("Reflektierendes Logo", "Reflective logo")],
    pflege=("Handwäsche bei 30 °C mit Wollwaschmittel, liegend trocknen.", "Hand wash at 30 °C with wool detergent, dry flat."),
    doc=[
        ("Waschen", ["Mützen und Handschuhe aus Wolle waschen Sie von Hand bei 30 °C mit Wollwaschmittel. Nicht reiben und nicht auswringen: "
                     "das Wasser in einem Handtuch ausdrücken und liegend trocknen, nicht auf der Heizung."]),
        ("Pilling und Form", ["Knötchen an Reibestellen sind bei Strick normal und lassen sich mit einem Wollkamm entfernen. Hat sich die Mütze "
                     "ausgeweitet, waschen Sie sie lauwarm und lassen sie über einer Schüssel in Form trocknen."]),
        ("Häufige Fragen", ["Welche Größe passt? Kopfumfang in Stirnhöhe messen: S 54–55 cm, M 56–57 cm, L 58–59 cm, XL 60–61 cm.",
                     "Funktioniert der Touchscreen mit Handschuhen? Bei Modellen mit Touchscreen-Fingerkuppen an Daumen und Zeigefinger ja."]),
    ],
)

# ---- Wanderschuhe
SCHAFT = {"Hoch": "hohem", "Mittelhoch": "mittelhohem", "Niedrig": "niedrigem"}
K["Wanderschuhe"] = dict(
    gruppe=("tw_wanderschuhe", "Wanderschuhe – Technik", "Hiking boots – technical"),
    attrs=[
        ("shaft", "Schafthöhe", "Shaft height", "text", {"axes": ["locale"]}),
        ("membrane", "Wasserdichte Membran", "Waterproof membrane", "boolean", {}),
        ("drop_mm", "Sprengung", "Heel-to-toe drop", "integer", {"unit": "mm"}),
        ("sole", "Sohle", "Sole", "text", {"axes": ["locale"]}),
        ("crampon", "Steigeisenfest", "Crampon compatible", "text", {"axes": ["locale"]}),
    ],
    werte=lambda r: {
        "shaft": r.choice([("Hoch", "High"), ("Mittelhoch", "Mid"), ("Niedrig", "Low")]),
        "membrane": ja(r, 0.75), "drop_mm": r.choice([8, 10, 12]),
        "sole": r.choice([("Profilsohle aus Gummi, 5 mm Stollen", "Rubber lug sole, 5 mm lugs"), ("Profilsohle mit Kletterzone", "Lug sole with climbing zone")]),
        "crampon": r.choice([("nein", "no"), ("bedingt (Kategorie B)", "semi-automatic (B)")]),
    },
    einsatz=[("Tagestouren im Mittelgebirge", "day hikes in the hills"), ("Trekking mit Gepäck", "trekking with a pack"),
             ("alpine Wege und Geröll", "alpine trails and scree"), ("Weitwanderwege", "long-distance trails")],
    text=lambda r, c: (
        [f"Der {c['name_de']} ist ein Wanderschuh mit {SCHAFT[c['werte']['shaft'][0]]} Schaft für {c['einsatz'][0]}. Obermaterial: {c['material'][0]}.",
         ("Eine wasserdichte Membran hält die Füße trocken und lässt Feuchtigkeit nach außen. " if c['werte']['membrane'] == "true"
          else "Ohne Membran ist der Schuh besonders luftig — gut für Sommertouren. ")
         + f"Die {c['werte']['sole'][0]} greift auf nassem Fels und lockerem Boden; die Sprengung von {c['werte']['drop_mm']} mm "
         "entlastet die Achillessehne beim Bergabgehen.",
         r.choice(["Ein Gummirand schützt Zehen und Leder vor Steinen.", "Die Schnürung reicht bis in die Zehen und lässt sich in zwei Zonen "
                   "unterschiedlich fest ziehen.", "Die Zwischensohle aus EVA dämpft, ein Kunststoffeinsatz gibt Halt auf Kanten."])],
        [f"The {c['name_en']} is a {c['werte']['shaft'][1].lower()}-cut hiking boot for {c['einsatz'][1]}. Upper: {c['material'][1]}.",
         ("A waterproof membrane keeps feet dry and lets moisture out. " if c['werte']['membrane'] == "true"
          else "Without a membrane the boot is especially airy — ideal for summer. ")
         + f"The {c['werte']['sole'][1].lower()} grips wet rock and loose ground; the {c['werte']['drop_mm']} mm drop eases the Achilles tendon on descents.",
         "A rubber rand protects toes and leather from rocks."]),
    merkmale=[("Profilsohle mit tiefen Stollen", "Deep-lug sole"), ("Gummirand als Zehenschutz", "Rubber toe rand"), ("Zwei-Zonen-Schnürung", "Two-zone lacing"),
              ("Dämpfende EVA-Zwischensohle", "Cushioning EVA midsole"), ("Herausnehmbares Fußbett", "Removable footbed"), ("Gepolsterte Zunge", "Padded tongue"),
              ("Leder aus zertifizierter Gerberei", "Leather from a certified tannery")],
    pflege=("Nach jeder Tour Schmutz mit Bürste und Wasser entfernen, bei Raumtemperatur trocknen, nicht an der Heizung. Leder regelmäßig pflegen und imprägnieren.",
            "Brush off dirt after each hike, dry at room temperature away from heaters. Treat and waterproof the leather regularly."),
    doc=[
        ("Einlaufen", ["Neue Wanderschuhe tragen Sie zuerst ein paar Tage im Alltag und auf kurzen Wegen, bevor es auf eine lange Tour geht. "
                     "Leder passt sich dabei an den Fuß an. Druckstellen zeigen sich früh — dann die Schnürung anders führen oder das "
                     "Fußbett tauschen."]),
        ("Reinigen und Trocknen", ["Entfernen Sie Schmutz nach jeder Tour mit einer Bürste und lauwarmem Wasser, nehmen Sie das Fußbett heraus "
                     "und stopfen Sie die Schuhe mit Zeitungspapier aus. Trocknen Sie sie bei Raumtemperatur — Hitze von Heizung, Ofen oder "
                     "Föhn lässt das Leder hart und rissig werden und löst die Sohle."]),
        ("Leder pflegen und imprägnieren", ["Nubukleder pflegen Sie mit einem Pflegespray für Rauleder, Glattleder mit Lederwachs. Tragen "
                     "Sie die Pflege auf das saubere, noch leicht feuchte Leder auf. Ein Schuh mit Membran bleibt nur trocken, wenn das "
                     "Obermaterial imprägniert ist — sonst saugt es sich voll und der Fuß wird kalt."]),
        ("Der Schnürsenkel ist gerissen", ["Unterwegs hilft ein Knoten: die beiden Enden mit einem Weberknoten verbinden und die Schnürung "
                     "an der Rissstelle eine Öse tiefer führen. Ein Stück Reepschnur oder Paracord aus dem Rucksack ersetzt den Senkel bis zum "
                     "Tourende. Ersatzsenkel in der richtigen Länge schicken wir kostenlos; die Länge steht im Datenblatt.",
                     ["Senkel scheuern meist an scharfkantigen Haken: Haken auf Grat prüfen und mit feinem Schleifpapier glätten",
                      "runde Senkel halten länger als flache, gewachste länger als ungewachste",
                      "Senkel vor langen Touren tauschen, wenn der Mantel aufgeraut ist"]]),
        ("Reparatur: Sohle", ["Löst sich die Sohle vorne, kleben Sie sie mit einem Schuhkleber und klemmen sie über Nacht. Ist das Profil abgelaufen, "
                     "können wir die Schuhe neu besohlen — das lohnt sich bei Lederschuhen fast immer."]),
        ("Die Schuhe sind innen nass", ["Meist ist es Schweiß: eine Membran gibt Feuchtigkeit nur ab, wenn außen trocken ist. Wechseln Sie "
                     "die Socken in der Pause, verwenden Sie Socken aus Merino oder Kunstfaser. Dringt Wasser an einer Stelle ein, prüfen wir "
                     "die Membran im Rahmen der Garantie."]),
        ("Häufige Fragen", ["Welche Größe brauche ich? Messen Sie die Fußlänge am Nachmittag und rechnen Sie 1 bis 1,5 cm dazu; die Tabelle "
                     "steht im Ratgeber Schuhe.",
                     "Sind die Schuhe steigeisenfest? Das steht in den technischen Daten: Kategorie B passt für Kipphebel-Steigeisen mit Riemen vorn."]),
    ],
)

# ---- Trailrunning
K["Trailrunning"] = dict(
    stoff=("atmungsaktivem Mesh", "breathable mesh"),
    gruppe=("tw_trailrunning", "Trailrunning – Technik", "Trail running – technical"),
    attrs=[
        ("drop_mm", "Sprengung", "Heel-to-toe drop", "integer", {"unit": "mm"}),
        ("stack_mm", "Sohlenhöhe Ferse", "Heel stack height", "integer", {"unit": "mm"}),
        ("lug_mm", "Profiltiefe", "Lug depth", "integer", {"unit": "mm"}),
        ("membrane", "Wasserdichte Membran", "Waterproof membrane", "boolean", {}),
        ("rock_plate", "Steinschutzplatte", "Rock plate", "boolean", {}),
    ],
    werte=lambda r: {"drop_mm": r.choice([4, 6, 8]), "stack_mm": r.choice([24, 28, 32]), "lug_mm": r.choice([4, 5, 6]),
                     "membrane": ja(r, 0.3), "rock_plate": ja(r, 0.6)},
    einsatz=[("schnelle Läufe auf Waldwegen", "fast runs on forest trails"), ("technische Bergläufe", "technical mountain runs"),
             ("Ultradistanzen", "ultra distances"), ("Läufe bei Nässe und Schlamm", "runs in wet and muddy conditions")],
    text=lambda r, c: (
        [f"Der {c['name_de']} ist ein Trailrunningschuh für {c['einsatz'][0]}. Das Obermaterial aus {c['stoff'][0]} ist leicht und "
         "luftig und trocknet nach einer Bachquerung schnell.",
         f"Die Sohle hat {c['werte']['lug_mm']} mm tiefe Stollen, {c['werte']['stack_mm']} mm Dämpfung unter der Ferse und {c['werte']['drop_mm']} mm "
         "Sprengung. " + ("Eine Steinschutzplatte schützt die Fußsohle vor spitzen Steinen." if c['werte']['rock_plate'] == "true"
                          else "Ohne Steinschutzplatte bleibt der Schuh flexibel und gibt viel Gefühl für den Untergrund.")],
        [f"The {c['name_en']} is a trail running shoe for {c['einsatz'][1]}. The {c['stoff'][1]} upper is light, airy and dries fast.",
         f"The outsole has {c['werte']['lug_mm']} mm lugs, {c['werte']['stack_mm']} mm heel stack and a {c['werte']['drop_mm']} mm drop. "
         + ("A rock plate protects against sharp stones." if c['werte']['rock_plate'] == "true" else "Without a rock plate the shoe stays flexible and gives plenty of ground feel.")]),
    merkmale=[("Griffige Stollensohle", "Grippy lugged outsole"), ("Zehenschutzkappe", "Toe cap"), ("Schnellschnürung mit Lasche", "Quick lace with garage"),
              ("Atmungsaktives Mesh", "Breathable mesh"), ("Gamaschenhaken", "Gaiter attachment")],
    pflege=("Schmutz mit Wasser abspülen, bei Raumtemperatur trocknen, nicht in der Waschmaschine.", "Rinse off dirt, dry at room temperature, do not machine wash."),
    doc=[
        ("Reinigen", ["Spülen Sie Schlamm nach dem Lauf mit lauwarmem Wasser ab, solange er feucht ist. Die Waschmaschine löst Klebstellen und "
                     "beschädigt die Dämpfung. Zum Trocknen das Fußbett herausnehmen und die Schuhe mit Papier ausstopfen."]),
        ("Lebensdauer", ["Die Dämpfung eines Trailschuhs lässt nach 600 bis 900 km nach — auch wenn die Sohle noch gut aussieht. Spüren Sie "
                     "Steine stärker als am Anfang oder schmerzen Knie und Schienbein, ist es Zeit für ein neues Paar."]),
        ("Häufige Fragen", ["Fällt der Schuh normal aus? Ja; wer bergab oft an die Zehen stößt, nimmt eine halbe Größe mehr.",
                     "Kann ich den Schuh auch auf Asphalt laufen? Ja, aber die Stollen nutzen sich dort schneller ab."]),
    ],
)

# ---- Sandalen
K["Sandalen"] = dict(
    stoff=("Polyester", "polyester"),
    gruppe=("tw_sandalen", "Sandalen – Technik", "Sandals – technical"),
    attrs=[("straps", "Verstellbare Riemen", "Adjustable straps", "integer", {}), ("footbed", "Fußbett", "Footbed", "text", {"axes": ["locale"]})],
    werte=lambda r: {"straps": r.choice([2, 3]), "footbed": r.choice([("Kork, anatomisch geformt", "Cork, anatomically shaped"), ("EVA, antibakteriell", "EVA, antibacterial")])},
    einsatz=[("Sommerwanderungen", "summer hikes"), ("Reisen und Strand", "travel and beach"), ("Bachläufe und Canyons", "streams and canyons")],
    text=lambda r, c: (
        [f"Die {c['name_de']} ist eine Trekkingsandale für {c['einsatz'][0]}. {c['werte']['straps']} verstellbare Riemen aus {c['stoff'][0]} "
         f"halten den Fuß, das Fußbett aus {c['werte']['footbed'][0]} stützt das Gewölbe.",
         "Die Profilsohle greift auch auf nassen Steinen; die Sandale trocknet schnell und lässt sich ins Wasser mitnehmen."],
        [f"The {c['name_en']} is a trekking sandal for {c['einsatz'][1]}. {c['werte']['straps']} adjustable straps hold the foot, the "
         f"{c['werte']['footbed'][1].lower()} footbed supports the arch.",
         "The lugged sole grips wet rocks; the sandal dries quickly and can go into the water."]),
    merkmale=[("Drei Verstellpunkte", "Three adjustment points"), ("Anatomisches Fußbett", "Anatomical footbed"), ("Rutschfeste Sohle", "Non-slip sole"),
              ("Schnell trocknend", "Quick drying"), ("Gepolsterter Fersenriemen", "Padded heel strap")],
    pflege=("Mit Wasser und milder Seife reinigen, an der Luft trocknen. Korkfußbett nicht lange in der Sonne liegen lassen.",
            "Clean with water and mild soap, air dry. Do not leave the cork footbed in direct sun for long."),
    doc=[
        ("Reinigen", ["Riemen und Fußbett mit einer weichen Bürste, Wasser und milder Seife reinigen. Gegen Geruch hilft ein Bad in Wasser mit "
                     "etwas Essig oder Natron. Korkfußbetten nicht durchnässen und nicht in der Sonne trocknen — Kork wird sonst spröde."]),
        ("Häufige Fragen", ["Kann ich mit der Sandale ins Wasser? Ja, Riemen und Sohle vertragen Wasser; das Korkfußbett trocknet danach langsamer.",
                     "Welche Größe passt? Zwischen Zehen und Sohlenende sollten etwa 5 mm Platz sein."]),
    ],
)

# ---- Tagesrucksäcke
K["Tagesrucksäcke"] = dict(
    stoff=("420D-Nylon", "420D nylon"),
    gruppe=("tw_rucksaecke", "Rucksäcke – Technik", "Packs – technical"),
    attrs=[
        ("volume_l", "Volumen", "Volume", "integer", {"unit": "l"}),
        ("max_load_kg", "Empfohlene Zuladung", "Recommended load", "integer", {"unit": "kg"}),
        ("back_system", "Rückensystem", "Back system", "text", {"axes": ["locale"]}),
        ("rain_cover", "Regenhülle", "Rain cover", "boolean", {}),
        ("hydration", "Trinksystemvorbereitet", "Hydration compatible", "boolean", {}),
    ],
    werte=lambda r: {"volume_l": r.choice([18, 22, 26, 30]), "max_load_kg": r.choice([8, 10]),
                     "back_system": r.choice([("Netzrücken mit Abstand", "Suspended mesh back"), ("Gepolsterter Kontaktrücken", "Padded contact back")]),
                     "rain_cover": "true", "hydration": ja(r, 0.7)},
    einsatz=[("Tagestouren", "day hikes"), ("Radtouren und Pendeln", "cycling and commuting"), ("Klettersteige", "via ferratas"), ("Reisen", "travel")],
    text=lambda r, c: (
        [f"Der {c['name_de']} ist ein Rucksack mit {c['werte']['volume_l']} Litern für {c['einsatz'][0]}. Er besteht aus {c['stoff'][0]}.",
         f"Der {c['werte']['back_system'][0].lower()} sorgt für Luft am Rücken, gepolsterte Schultergurte und ein Hüftgurt verteilen bis zu "
         f"{c['werte']['max_load_kg']} kg Last. Die Regenhülle steckt in einem eigenen Fach im Boden."
         + (" Ein Fach für eine Trinkblase mit Schlauchdurchlass ist vorhanden." if c['werte']['hydration'] == "true" else ""),
         "Seitentaschen für Flaschen, ein Deckelfach für Kleinteile und eine Halterung für Stöcke machen ihn zum Begleiter für jeden Tag."],
        [f"The {c['name_en']} is a {c['werte']['volume_l']} litre pack for {c['einsatz'][1]}, made of {c['stoff'][1]}.",
         f"The {c['werte']['back_system'][1].lower()} keeps your back ventilated; padded shoulder straps and a hip belt carry up to "
         f"{c['werte']['max_load_kg']} kg. The rain cover stows in its own base pocket.",
         "Side bottle pockets, a lid pocket and a pole holder make it an everyday companion."]),
    merkmale=[("Netzrücken mit Abstand", "Suspended mesh back"), ("Regenhülle im Bodenfach", "Rain cover in base pocket"), ("Stockhalterung", "Pole holder"),
              ("Hüftgurt mit Taschen", "Hip belt with pockets"), ("Brustgurt mit Signalpfeife", "Sternum strap with whistle"), ("Reflektoren", "Reflectors")],
    pflege=("Von Hand mit lauwarmem Wasser und milder Seife reinigen, offen an der Luft trocknen. Nicht in die Waschmaschine.",
            "Hand clean with lukewarm water and mild soap, air dry open. Do not machine wash."),
    doc=[
        ("Richtig einstellen", ["Lockern Sie alle Gurte, setzen Sie den Rucksack mit etwa 5 kg Inhalt auf. Zuerst den Hüftgurt auf den "
                     "Beckenknochen schließen und festziehen, dann die Schultergurte, zuletzt die Lageverstellung oben an den Schultern "
                     "(etwa 45°) und den Brustgurt. Der Hüftgurt trägt den größten Teil der Last."]),
        ("Packen", ["Schweres gehört nah an den Rücken und auf Schulterblatthöhe, Leichtes nach unten und außen. Was Sie unterwegs brauchen — "
                     "Regenjacke, Karte, Snack —, kommt in das Deckelfach oder die Fronttasche."]),
        ("Reinigen und Reparatur", ["Rucksäcke nicht in der Waschmaschine waschen: die Beschichtung löst sich. Mit Schwamm, Wasser und milder "
                     "Seife reinigen und offen trocknen. Eine gebrochene Schnalle lässt sich ohne Nähen tauschen — Ersatzschnallen schicken wir "
                     "kostenlos. Klemmt ein Reißverschluss, hilft Wachs oder Seife auf den Zähnen."]),
        ("Häufige Fragen", ["Ist der Rucksack wasserdicht? Das Material ist wasserabweisend, die Nähte nicht verschweißt — bei Regen gehört "
                     "die Regenhülle darüber.", "Passt eine Trinkblase hinein? Bei Modellen mit Trinksystemvorbereitung bis 3 Liter."]),
    ],
)

# ---- Trekkingrucksäcke
K["Trekkingrucksäcke"] = dict(
    stoff=("Ripstop-Nylon", "ripstop nylon"),
    gruppe=("tw_rucksaecke", "Rucksäcke – Technik", "Packs – technical"),
    attrs=[
        ("volume_l", "Volumen", "Volume", "integer", {"unit": "l"}),
        ("max_load_kg", "Empfohlene Zuladung", "Recommended load", "integer", {"unit": "kg"}),
        ("back_system", "Rückensystem", "Back system", "text", {"axes": ["locale"]}),
        ("torso_cm", "Rückenlänge verstellbar", "Adjustable torso length", "text", {}),
        ("rain_cover", "Regenhülle", "Rain cover", "boolean", {}),
    ],
    werte=lambda r: {"volume_l": r.choice([45, 55, 65, 75]), "max_load_kg": r.choice([18, 22, 25]),
                     "back_system": r.choice([("Aluminiumrahmen mit Netzrücken", "Aluminium frame with mesh back"), ("Aluminiumrahmen mit Kontaktrücken", "Aluminium frame with contact back")]),
                     "torso_cm": r.choice(["42–52 cm", "45–55 cm"]), "rain_cover": "true"},
    einsatz=[("Trekking über mehrere Tage", "multi-day trekking"), ("Hüttentouren", "hut-to-hut tours"), ("Weitwanderwege mit Zelt", "long-distance trails with a tent")],
    text=lambda r, c: (
        [f"Der {c['name_de']} ist ein Trekkingrucksack mit {c['werte']['volume_l']} Litern für {c['einsatz'][0]}. Er besteht aus {c['stoff'][0]}.",
         f"Der {c['werte']['back_system'][0].lower()} überträgt die Last auf den Hüftgurt; die Rückenlänge lässt sich von {c['werte']['torso_cm']} "
         f"einstellen. Empfohlen sind bis zu {c['werte']['max_load_kg']} kg.",
         "Ein Bodenfach für den Schlafsack, ein Frontzugang zum Hauptfach und ein abnehmbarer Deckel als Hüfttasche machen das Packen einfach."],
        [f"The {c['name_en']} is a {c['werte']['volume_l']} litre trekking pack for {c['einsatz'][1]}, made of {c['stoff'][1]}.",
         f"The {c['werte']['back_system'][1].lower()} transfers the load to the hip belt; the torso length adjusts from {c['werte']['torso_cm']}. "
         f"Recommended load up to {c['werte']['max_load_kg']} kg.",
         "A sleeping bag compartment, front access to the main compartment and a removable lid that doubles as a hip pack make packing easy."]),
    merkmale=[("Verstellbare Rückenlänge", "Adjustable torso length"), ("Frontzugang zum Hauptfach", "Front access"), ("Bodenfach für den Schlafsack", "Sleeping bag compartment"),
              ("Abnehmbarer Deckel als Hüfttasche", "Removable lid as hip pack"), ("Regenhülle", "Rain cover"), ("Eisgerätehalterung", "Ice axe loops")],
    pflege=K["Tagesrucksäcke"]["pflege"],
    doc=K["Tagesrucksäcke"]["doc"],
)

# ---- Taschen
K["Taschen"] = dict(
    stoff=("gewachster Baumwolle mit Lederriemen", "waxed cotton with leather straps"),
    gruppe=("tw_taschen", "Taschen – Technik", "Bags – technical"),
    attrs=[("volume_l", "Volumen", "Volume", "integer", {"unit": "l"}), ("laptop", "Laptopfach", "Laptop sleeve", "text", {})],
    werte=lambda r: {"volume_l": r.choice([8, 12, 20, 30]), "laptop": r.choice(["13 Zoll", "15 Zoll", "—"])},
    einsatz=[("Alltag und Büro", "everyday and office use"), ("Wochenendreisen", "weekend trips"), ("Einkäufe und Markt", "shopping and markets")],
    text=lambda r, c: (
        [f"Die {c['name_de']} ist eine Tasche mit {c['werte']['volume_l']} Litern für {c['einsatz'][0]}, aus {c['stoff'][0]}.",
         "Gewachste Baumwolle bekommt mit der Zeit Patina und hält leichten Regen ab; die Lederriemen werden mit dem Gebrauch weicher."],
        [f"The {c['name_en']} is a {c['werte']['volume_l']} litre bag for {c['einsatz'][1]}, made of {c['stoff'][1]}.",
         "Waxed cotton develops a patina over time and sheds light rain; the leather straps soften with use."]),
    merkmale=[("Gewachste Baumwolle", "Waxed cotton"), ("Lederriemen", "Leather straps"), ("Innentasche mit Reißverschluss", "Zipped inner pocket"),
              ("Abnehmbarer Schultergurt", "Detachable shoulder strap")],
    pflege=("Nicht waschen. Mit einer weichen Bürste reinigen, bei Bedarf mit Wachs für Baumwolle nachwachsen.",
            "Do not wash. Brush clean and re-wax with cotton wax when needed."),
    doc=[
        ("Pflege der gewachsten Baumwolle", ["Gewachste Baumwolle wird nicht gewaschen: Wasser und Waschmittel lösen das Wachs. Trockenen Schmutz "
                     "bürsten Sie ab, Flecken mit kaltem Wasser und einem Schwamm. Lässt die Wasserabweisung nach, tragen Sie Wachs für "
                     "Baumwolle auf und verteilen es mit einem Föhn auf niedriger Stufe."]),
        ("Häufige Fragen", ["Färbt die Tasche ab? Neue gewachste Baumwolle kann in den ersten Wochen auf helle Kleidung abfärben.",
                     "Kann ich die Lederriemen pflegen? Ja, mit Lederbalsam, zweimal im Jahr."]),
    ],
)

# ---- Zelte
K["Zelte"] = dict(
    gruppe=("tw_zelte", "Zelte – Technik", "Tents – technical"),
    attrs=[
        ("persons", "Personen", "Persons", "integer", {}),
        ("waterproof_mm", "Wassersäule Außenzelt", "Hydrostatic head fly", "integer", {"unit": "mm"}),
        ("floor_mm", "Wassersäule Boden", "Hydrostatic head floor", "integer", {"unit": "mm"}),
        ("pitch_min", "Aufbauzeit", "Pitching time", "integer", {"unit": "min"}),
        ("packed_size", "Packmaß", "Packed size", "text", {}),
        ("vestibules", "Apsiden", "Vestibules", "integer", {}),
        ("tent_type", "Bauart", "Design", "text", {"axes": ["locale"]}),
    ],
    werte=lambda r: {"persons": r.choice([1, 2, 2, 3, 4]), "waterproof_mm": r.choice([3000, 4000, 5000]), "floor_mm": r.choice([5000, 8000, 10000]),
                     "pitch_min": r.choice([5, 8, 10, 15]), "packed_size": r.choice(["45 × 16 cm", "50 × 18 cm", "55 × 20 cm"]), "vestibules": r.choice([1, 2]),
                     "tent_type": r.choice([("Tunnelzelt", "Tunnel tent"), ("Kuppelzelt", "Dome tent"), ("Geodät", "Geodesic tent")])},
    einsatz=[("Trekking und Radreisen", "trekking and bike touring"), ("Camping im Sommer", "summer camping"), ("Touren über der Baumgrenze", "trips above the tree line")],
    text=lambda r, c: (
        [f"Das {c['name_de']} ist ein {c['werte']['tent_type'][0]} für {c['werte']['persons']} "
         f"{'Person' if c['werte']['persons'] == 1 else 'Personen'} und {c['einsatz'][0]}. Außenzelt aus silikonbeschichtetem Nylon mit "
         f"{tausend(c['werte']['waterproof_mm'])} mm Wassersäule, Boden mit {tausend(c['werte']['floor_mm'])} mm.",
         f"Außen- und Innenzelt bauen Sie gemeinsam in etwa {c['werte']['pitch_min']} Minuten auf, auch bei Regen bleibt das Innenzelt trocken. "
         f"{'Eine Apsis bietet' if c['werte']['vestibules'] == 1 else 'Zwei Apsiden bieten'} Platz für Rucksäcke und Schuhe; "
         "Lüftungsöffnungen oben und unten mindern Kondenswasser.",
         f"Gestänge aus Aluminium, Packmaß {c['werte']['packed_size']}, Gewicht {zahl(c['gewicht'])} kg."],
        [f"The {c['name_en']} is a {c['werte']['tent_type'][1].lower()} for {c['werte']['persons']} and {c['einsatz'][1]}. Silicone-coated nylon fly "
         f"with {c['werte']['waterproof_mm']:,} mm hydrostatic head, floor {c['werte']['floor_mm']:,} mm.",
         f"Fly and inner pitch together in about {c['werte']['pitch_min']} minutes, so the inner stays dry in rain. "
         f"{c['werte']['vestibules']} vestibule(s) hold packs and boots; high and low vents reduce condensation.",
         f"Aluminium poles, packed size {c['werte']['packed_size']}, weight {c['gewicht']:.2f} kg."]),
    merkmale=[("Außen- und Innenzelt gemeinsam aufbaubar", "Fly and inner pitch together"), ("Aluminiumgestänge", "Aluminium poles"),
              ("Lüftungsöffnungen oben und unten", "High and low vents"), ("Farbcodierte Gestängekanäle", "Colour-coded pole sleeves"),
              ("Innentaschen und Lampenhalter", "Inner pockets and lamp loop"), ("Abgeklebte Nähte", "Taped seams")],
    pflege=("Nur trocken und sauber einpacken. Feucht eingepackt mindestens 24 Stunden auslüften. Nicht waschen; mit Schwamm und Wasser reinigen.",
            "Only pack dry and clean. If packed wet, air for at least 24 hours. Do not wash; clean with a sponge and water."),
    doc=[
        ("Aufbau", ["Wählen Sie einen ebenen Platz ohne spitze Steine, legen Sie das Zelt mit dem Eingang auf die windabgewandte Seite. "
                    "Stecken Sie die Gestänge zusammen und führen Sie sie in die farbcodierten Kanäle. Spannen Sie zuerst die Ecken, dann "
                    "die Abspannleinen — ein straff gespanntes Außenzelt flattert nicht und leitet Regen ab.",
                    ["Gestänge vollständig zusammenstecken, bevor sie gebogen werden", "Heringe im 45°-Winkel vom Zelt weg einschlagen",
                     "Abspannleinen bei Wind immer nutzen", "Lüftungsöffnungen offen lassen"]]),
        ("Es kommt Wasser ins Zelt", ["Wasser im Zelt hat vier Ursachen, und jede hat eine eigene Abhilfe:",
                    ["Kondenswasser: Tropfen innen am Außenzelt sind meist kein Regen. Atemluft und feuchte Kleidung geben Wasser ab, das am "
                     "kalten Außenzelt niederschlägt. Lüftungen öffnen, nasse Sachen in die Apsis, Eingang einen Spalt offen lassen.",
                     "Das Innenzelt berührt das Außenzelt: an der Berührungsstelle zieht Wasser durch. Abspannleinen nachspannen, bis "
                     "überall Abstand ist — Nylon dehnt sich bei Nässe und muss abends nachgespannt werden.",
                     "Wasser kommt von unten: der Platz liegt in einer Senke, oder eine Unterlegplane steht über den Zeltrand hinaus und "
                     "fängt Regen auf. Plane unter das Zelt falten, nächstes Mal einen leicht erhöhten Platz wählen.",
                     "Eine Naht tropft: bei älteren Zelten löst sich das Nahtband oder die Silikonabdichtung. Naht trocknen und mit "
                     "Nahtdichter für silikonbeschichtetes Nylon von außen dünn bestreichen, 24 Stunden trocknen lassen."],
                    "Tropft es an einer Stelle im Außenzelt selbst, ist die Beschichtung beschädigt — dann prüfen wir das Zelt im Rahmen der Garantie."]),
        ("Reparatur: Gestänge gebrochen", ["Bricht ein Gestängesegment, schieben Sie die Reparaturhülse aus dem Lieferumfang über die "
                    "Bruchstelle und fixieren Sie sie mit Klebeband. So hält das Gestänge bis zum Ende der Tour. Ersatzsegmente schicken wir; "
                    "das Gummiseil im Gestänge lässt sich mit einem Stück Draht neu einziehen."]),
        ("Reparatur: Riss oder Loch", ["Kleine Löcher im Außenzelt flicken Sie mit selbstklebendem Reparaturband für silikonbeschichtetes "
                    "Nylon — normale Klebebänder halten darauf nicht. Für den Boden gibt es Flicken aus dem Reparaturset. Klemmt der "
                    "Reißverschluss am Eingang, reiben Sie die Zähne mit Wachs ein; geht er hinter dem Schieber wieder auf, drücken Sie den "
                    "Schieber mit einer Zange vorsichtig zusammen."]),
        ("Lagern", ["Lagern Sie das Zelt trocken und locker, nicht über Monate im engen Packsack. Ein feucht gelagertes Zelt bekommt "
                    "Stockflecken und die Beschichtung löst sich — darum nach jeder Tour vollständig trocknen lassen."]),
        ("Häufige Fragen", ["Ist das Zelt wintertauglich? Kuppelzelte und Geodäten halten Schneelast besser als Tunnelzelte; für Touren über "
                    "der Baumgrenze empfehlen wir eine Geodät.",
                    "Brauche ich eine Unterlegplane? Sie schützt den Boden vor Abrieb und verlängert seine Lebensdauer; passende Planen gibt es als Zubehör."]),
    ],
)

# ---- Schlafsäcke
K["Schlafsäcke"] = dict(
    stoff=("Daune aus zertifizierter Herkunft", "down from certified sources"),
    gruppe=("tw_schlafsaecke", "Schlafsäcke – Technik", "Sleeping bags – technical"),
    attrs=[
        ("comfort_c", "Komforttemperatur", "Comfort temperature", "integer", {"unit": "°C"}),
        ("limit_c", "Grenztemperatur", "Limit temperature", "integer", {"unit": "°C"}),
        ("extreme_c", "Extremtemperatur", "Extreme temperature", "integer", {"unit": "°C"}),
        ("fill_g", "Füllgewicht", "Fill weight", "integer", {"unit": "g"}),
        ("fill_power", "Bauschkraft (cuin)", "Fill power (cuin)", "integer", {}),
        ("packed_size", "Packmaß", "Packed size", "text", {}),
        ("bag_shape", "Form", "Shape", "text", {"axes": ["locale"]}),
    ],
    werte=lambda r: (lambda k: {"comfort_c": k, "limit_c": k - 6, "extreme_c": k - 20, "fill_g": {5: 350, 0: 550, -5: 750, -10: 950}[k],
                                "fill_power": r.choice([650, 750, 800]), "packed_size": r.choice(["16 × 28 cm", "18 × 32 cm", "21 × 36 cm"]),
                                "bag_shape": r.choice([("Mumienform", "Mummy"), ("Mumienform, breiter Schnitt", "Mummy, wide cut")])})(r.choice([5, 0, -5, -10])),
    einsatz=[("Sommer und Hütten", "summer and huts"), ("Trekking im Frühjahr und Herbst", "spring and autumn treks"), ("Wintercamping", "winter camping")],
    text=lambda r, c: (
        [f"Der {c['name_de']} ist ein Daunenschlafsack in {c['werte']['bag_shape'][0]} für {c['einsatz'][0]}. Komforttemperatur "
         f"{c['werte']['comfort_c']} °C, Grenztemperatur {c['werte']['limit_c']} °C (nach EN ISO 23537).",
         f"{c['werte']['fill_g']} g Daune mit {c['werte']['fill_power']} cuin Bauschkraft — {c['stoff'][0]}. Kammern mit Stegen "
         "verhindern Kältebrücken, ein Wärmekragen und eine Kapuze mit Kordelzug halten die Wärme am Oberkörper.",
         f"Packmaß {c['werte']['packed_size']}; ein Kompressionssack und ein luftiger Aufbewahrungssack gehören dazu."],
        [f"The {c['name_en']} is a {c['werte']['bag_shape'][1].lower()} down sleeping bag for {c['einsatz'][1]}. Comfort {c['werte']['comfort_c']} °C, "
         f"limit {c['werte']['limit_c']} °C (EN ISO 23537).",
         f"{c['werte']['fill_g']} g of {c['werte']['fill_power']} cuin down — {c['stoff'][1]}. Baffled chambers prevent cold spots; a draught "
         "collar and drawcord hood keep the warmth in.",
         f"Packed size {c['werte']['packed_size']}; compression sack and storage sack included."]),
    merkmale=[("Daune aus zertifizierter Herkunft", "Certified down"), ("Kammern mit Stegen", "Baffled chambers"), ("Wärmekragen", "Draught collar"),
              ("Zweiwege-Reißverschluss mit Klemmschutz", "Two-way zip with anti-snag guard"), ("Innentasche", "Inner pocket"), ("Kompressions- und Aufbewahrungssack", "Compression and storage sack")],
    pflege=("Locker im großen Aufbewahrungssack lagern, nie komprimiert. Selten waschen: Daunenwaschmittel, 30 °C, im Trockner mit Tennisbällen trocknen.",
            "Store loosely in the large storage sack, never compressed. Wash rarely: down detergent, 30 °C, tumble dry with tennis balls."),
    doc=[
        ("Temperaturangaben verstehen", ["Die Temperaturen folgen EN ISO 23537. Komfort: bis zu dieser Temperatur schläft eine Person mit "
                     "durchschnittlichem Kälteempfinden entspannt. Grenze: bis hierhin schläft eine Person in eingerollter Haltung, ohne zu "
                     "frieren. Extrem: nur als Notfallgrenze — Gefahr von Unterkühlung. Wählen Sie den Schlafsack nach der Komforttemperatur, "
                     "wenn Sie leicht frieren."]),
        ("Warm schlafen", ["Ein Schlafsack wärmt nicht, er hält die Wärme. Eine gute Isomatte ist genauso wichtig: auf kaltem Boden geht die "
                     "meiste Wärme nach unten verloren. Essen Sie vor dem Schlafen etwas Warmes, ziehen Sie trockene Kleidung an und eine Mütze auf."]),
        ("Waschen", ["Daune selten waschen — einmal im Jahr bei häufiger Nutzung genügt. Waschmaschine mit großer Trommel, Daunenwaschmittel, "
                     "30 °C, Schonwaschgang, zusätzlich spülen. Im Trockner bei niedriger Temperatur mit zwei Tennisbällen mehrere Stunden "
                     "trocknen, bis keine Klumpen mehr zu fühlen sind."]),
        ("Reparatur: Loch und Reißverschluss", ["Tritt Daune aus einem kleinen Loch, ziehen Sie sie nicht heraus, sondern von innen zurück und "
                     "kleben Sie das Loch mit einem Reparaturflicken ab. Klemmt der Reißverschluss im Stoff, ziehen Sie den Stoff vorsichtig "
                     "zurück, nicht den Schieber nach vorn. Geht er hinter dem Schieber auf, Schieber mit einer Zange leicht zusammendrücken."]),
        ("Lagern", ["Lagern Sie den Schlafsack locker im großen Aufbewahrungssack oder hängend. Monatelang komprimiert verliert die Daune "
                     "ihre Bauschkraft und der Schlafsack wärmt weniger."]),
        ("Häufige Fragen", ["Lassen sich zwei Schlafsäcke koppeln? Ja, wenn einer den Reißverschluss links und der andere rechts hat.",
                     "Welche Länge brauche ich? Größe M bis 180 cm Körpergröße, L bis 195 cm."]),
    ],
)

# ---- Isomatten
K["Isomatten"] = dict(
    gruppe=("tw_isomatten", "Isomatten – Technik", "Sleeping pads – technical"),
    attrs=[("r_value", "R-Wert", "R-value", "decimal", {}), ("thickness_cm", "Dicke", "Thickness", "decimal", {"unit": "cm"}),
           ("length_cm", "Länge", "Length", "integer", {"unit": "cm"}), ("valve", "Ventil", "Valve", "text", {"axes": ["locale"]})],
    werte=lambda r: {"r_value": r.choice([2.5, 3.5, 4.2, 5.4]), "thickness_cm": r.choice([5, 7, 8]), "length_cm": r.choice([183, 198]),
                     "valve": r.choice([("Flachventil mit Rückschlagklappe", "Flat valve with one-way flap"), ("Zweiwegeventil", "Two-way valve")])},
    einsatz=[("Trekking und Zelten", "trekking and camping"), ("Touren im Frühjahr und Herbst", "spring and autumn trips"), ("Wintercamping", "winter camping")],
    text=lambda r, c: (
        [f"Die {c['name_de']} ist eine aufblasbare Isomatte für {c['einsatz'][0]}: R-Wert {zahl(c['werte']['r_value'])}, "
         f"{zahl(c['werte']['thickness_cm'])} cm dick, {c['werte']['length_cm']} cm lang.",
         f"Kammern quer zur Liegerichtung halten Sie in der Mitte, das {c['werte']['valve'][0].lower()} lässt sich schnell füllen und "
         "fein nachregeln. Ein Pumpsack gehört dazu — Atemluft bringt Feuchtigkeit in die Matte.",
         f"Gewicht {zahl(c['gewicht'])} kg, Material {c['material'][0]}."],
        [f"The {c['name_en']} is an inflatable sleeping pad for {c['einsatz'][1]}: R-value {c['werte']['r_value']}, "
         f"{c['werte']['thickness_cm']} cm thick, {c['werte']['length_cm']} cm long.",
         f"Horizontal baffles keep you centred; the {c['werte']['valve'][1].lower()} inflates fast and fine-tunes pressure. A pump sack is included.",
         f"Weight {c['gewicht']:.2f} kg, material {c['material'][1]}."]),
    merkmale=[("Querkammern", "Horizontal baffles"), ("Pumpsack im Lieferumfang", "Pump sack included"), ("Reparaturset", "Repair kit"),
              ("Rutschhemmende Oberfläche", "Non-slip surface"), ("Leises Material", "Quiet fabric")],
    pflege=("Mit dem Pumpsack aufblasen, nicht mit dem Mund. Offen und entrollt lagern.", "Inflate with the pump sack, not by mouth. Store unrolled with the valve open."),
    doc=[
        ("R-Wert", ["Der R-Wert gibt an, wie gut die Matte gegen Kälte von unten isoliert — je höher, desto wärmer. Bis 2 für den Sommer, "
                    "3 bis 4 für Frühjahr und Herbst, ab 5 für Schnee. Zwei Matten übereinander addieren ihre R-Werte."]),
        ("Die Matte verliert Luft", ["Verliert die Matte über Nacht Luft, prüfen Sie zuerst das Ventil: Schmutz oder Sand in der Dichtung "
                    "mit Wasser ausspülen. Ein wenig Luftverlust in der ersten Stunde ist normal — kalte Nachtluft zieht sich zusammen. "
                    "Bleibt sie undicht, suchen Sie das Loch: Matte aufblasen und mit Seifenwasser abpinseln oder in die Badewanne legen; "
                    "wo Bläschen aufsteigen, ist das Loch."]),
        ("Reparatur: Loch flicken", ["Markieren Sie das Loch, lassen Sie die Luft ab und trocknen Sie die Stelle. Rauen Sie die Fläche leicht "
                    "an, tragen Sie Kleber aus dem Reparaturset dünn auf und drücken Sie einen rund geschnittenen Flicken an. 12 Stunden "
                    "aushärten lassen, bevor die Matte wieder aufgeblasen wird."]),
        ("Lagern", ["Lagern Sie die Matte entrollt mit offenem Ventil, etwa unter dem Bett. Monatelang aufgerollt kann sich der Schaum "
                    "nicht erholen, und Restfeuchte bildet Stockflecken."]),
    ],
)

# ---- Kocher
K["Kocher"] = dict(
    gruppe=("tw_kocher", "Kocher – Technik", "Stoves – technical"),
    attrs=[("power_w", "Leistung", "Output", "integer", {"unit": "W"}), ("boil_min", "Kochzeit 1 l Wasser", "Boil time 1 l", "decimal", {"unit": "min"}),
           ("fuel", "Brennstoff", "Fuel", "text", {"axes": ["locale"]}), ("piezo", "Piezozündung", "Piezo ignition", "boolean", {})],
    werte=lambda r: {"power_w": r.choice([2300, 2800, 3200]), "boil_min": r.choice([3.5, 4.0, 4.5]),
                     "fuel": r.choice([("Schraubkartusche (Butan/Propan)", "Screw-thread canister (butane/propane)"), ("Spiritus", "Methylated spirit")]),
                     "piezo": ja(r, 0.7)},
    einsatz=[("Trekking und Zelten", "trekking and camping"), ("Hüttentouren mit Selbstverpflegung", "self-catered hut tours"), ("Radreisen", "bike touring")],
    text=lambda r, c: (
        [f"Der {c['name_de']} ist ein Kocher für {c['einsatz'][0]}. Brennstoff: {c['werte']['fuel'][0]}; {c['werte']['power_w']} W Leistung bringen "
         f"einen Liter Wasser in etwa {zahl(c['werte']['boil_min'])} Minuten zum Kochen.",
         ("Die Piezozündung zündet ohne Feuerzeug. " if c['werte']['piezo'] == "true" else "")
         + "Ein Windschutz und eine fein regelbare Flamme machen auch langsames Köcheln möglich; die Topfauflage trägt Töpfe bis 20 cm.",
         f"Material: {c['material'][0]}. Der Kocher passt mit einer kleinen Kartusche in einen 1-Liter-Topf."],
        [f"The {c['name_en']} is a stove for {c['einsatz'][1]}. Fuel: {c['werte']['fuel'][1]}; {c['werte']['power_w']} W boils a litre of water in about "
         f"{c['werte']['boil_min']} minutes.",
         ("Piezo ignition lights without a lighter. " if c['werte']['piezo'] == "true" else "")
         + "A windshield and finely adjustable flame allow gentle simmering; the pot supports hold pots up to 20 cm.",
         f"Material: {c['material'][1]}. Stove and a small canister nest in a 1 litre pot."]),
    merkmale=[("Fein regelbare Flamme", "Finely adjustable flame"), ("Windschutz", "Windshield"), ("Klappbare Topfauflage", "Folding pot supports"),
              ("Piezozündung", "Piezo ignition"), ("Packsack", "Stuff sack")],
    pflege=("Nach dem Gebrauch abkühlen lassen, Kartusche abschrauben, Düse trocken und sauber halten.", "Let cool, remove the canister, keep the jet clean and dry."),
    doc=[
        ("Sicherheit", ["Betreiben Sie den Kocher nur im Freien oder in der Apsis bei offenem Eingang — nie im geschlossenen Zelt: es besteht "
                    "Brand- und Erstickungsgefahr durch Kohlenmonoxid. Stellen Sie ihn auf einen ebenen, festen Untergrund und lassen Sie ihn "
                    "nie unbeaufsichtigt.",
                    ["nur im Freien betreiben", "Kartusche nur bei geschlossenem Ventil wechseln", "Dichtung vor jedem Anschließen prüfen",
                     "Kartuschen nicht über 50 °C erwärmen"]]),
        ("Die Flamme ist schwach", ["Bei Kälte verdampft Butan schlecht: Kartusche vor dem Kochen in der Jacke oder im Schlafsack anwärmen und "
                    "Kartuschen mit Propananteil verwenden. Brennt die Flamme gelb und rußt, ist die Düse verschmutzt — mit der Reinigungsnadel "
                    "aus dem Lieferumfang vorsichtig säubern."]),
        ("Die Zündung funktioniert nicht", ["Prüfen Sie, ob der Zündfunke am Brennerkopf überspringt. Feuchtigkeit oder Ruß an der Elektrode "
                    "mit einem trockenen Tuch entfernen. Zündet die Piezozündung nicht mehr, können Sie den Kocher mit einem Feuerzeug weiter "
                    "nutzen; die Zündung tauschen wir im Rahmen der Garantie."]),
        ("Häufige Fragen", ["Darf der Kocher ins Flugzeug? Ohne Kartusche und gereinigt ja; Kartuschen dürfen nicht mit.",
                    "Welche Kartuschen passen? Alle Schraubkartuschen mit Gewinde nach EN 417."]),
    ],
)

# ---- Trinkflaschen
K["Trinkflaschen"] = dict(
    stoff=("doppelwandigem Edelstahl 18/8", "double-walled 18/8 stainless steel"),
    gruppe=("tw_flaschen", "Trinkflaschen – Technik", "Bottles – technical"),
    attrs=[("keeps_hot_h", "Hält warm", "Keeps hot", "integer", {"unit": "h"}), ("keeps_cold_h", "Hält kalt", "Keeps cold", "integer", {"unit": "h"}),
           ("dishwasher", "Spülmaschinenfest", "Dishwasher safe", "boolean", {}), ("bpa_free", "BPA-frei", "BPA free", "boolean", {})],
    werte=lambda r: {"keeps_hot_h": r.choice([6, 12, 18]), "keeps_cold_h": r.choice([12, 24]), "dishwasher": ja(r, 0.4), "bpa_free": "true"},
    einsatz=[("Wandern und Klettern", "hiking and climbing"), ("Büro und Alltag", "office and everyday use"), ("Wintertouren mit heißem Tee", "winter trips with hot tea")],
    text=lambda r, c: (
        [f"Die {c['name_de']} ist eine Trinkflasche aus {c['stoff'][0]} für {c['einsatz'][0]}. Sie hält Getränke "
         f"{c['werte']['keeps_hot_h']} Stunden warm und {c['werte']['keeps_cold_h']} Stunden kalt.",
         "Der Deckel ist dicht und lässt sich mit Handschuhen öffnen; Edelstahl nimmt keinen Geschmack an."],
        [f"The {c['name_en']} is a {c['stoff'][1]} bottle for {c['einsatz'][1]}. It keeps drinks hot for {c['werte']['keeps_hot_h']} hours "
         f"and cold for {c['werte']['keeps_cold_h']} hours.",
         "The leakproof lid opens with gloves on; stainless steel does not retain flavours."]),
    merkmale=[("Doppelwandig, vakuumisoliert", "Double-walled, vacuum insulated"), ("Auslaufsicherer Deckel", "Leakproof lid"),
              ("Geschmacksneutral", "Flavour neutral"), ("Pulverbeschichtung", "Powder coat")],
    pflege=("Mit warmem Wasser und Spülmittel reinigen, Deckel zerlegen und trocknen lassen.", "Clean with warm soapy water, disassemble the lid and let dry."),
    doc=[
        ("Reinigen", ["Spülen Sie die Flasche nach jedem Gebrauch mit warmem Wasser und Spülmittel und lassen Sie sie offen trocknen. Gegen "
                    "Kaffee- und Teeränder hilft ein Teelöffel Natron mit heißem Wasser über Nacht. Die Dichtung im Deckel lässt sich "
                    "herausnehmen."]),
        ("Die Flasche hält nicht mehr warm", ["Wird die Außenwand bei heißem Inhalt warm, ist das Vakuum zwischen den Wänden verloren — meist "
                    "nach einem Sturz. Das fällt unter die Garantie, wenn die Flasche nicht beschädigt aussieht."]),
        ("Häufige Fragen", ["Darf Kohlensäure hinein? Ja, aber nicht schütteln.", "Ist die Flasche spülmaschinenfest? Das steht in den technischen "
                    "Daten; die Beschichtung hält länger bei Handwäsche."]),
    ],
)

# ---- Stirnlampen
K["Stirnlampen"] = dict(
    gruppe=("tw_lampen", "Stirnlampen – Technik", "Headlamps – technical"),
    attrs=[("lumen", "Lichtstrom", "Luminous flux", "integer", {"unit": "lm"}), ("beam_m", "Leuchtweite", "Beam distance", "integer", {"unit": "m"}),
           ("runtime_h", "Leuchtdauer (niedrig)", "Runtime (low)", "integer", {"unit": "h"}), ("ip_rating", "Schutzart", "Ingress protection", "text", {}),
           ("red_light", "Rotlicht", "Red light", "boolean", {})],
    werte=lambda r: {"lumen": r.choice([250, 400, 600]), "beam_m": r.choice([70, 100, 130]), "runtime_h": r.choice([40, 60, 120]),
                     "ip_rating": r.choice(["IPX4", "IPX6", "IP67"]), "red_light": ja(r, 0.7)},
    einsatz=[("Wandern und Zelten", "hiking and camping"), ("Laufen in der Dämmerung", "running at dusk"), ("Hochtouren mit frühem Start", "alpine starts")],
    text=lambda r, c: (
        [f"Die {c['name_de']} ist eine Stirnlampe für {c['einsatz'][0]} mit {c['werte']['lumen']} Lumen und {c['werte']['beam_m']} m Leuchtweite.",
         f"Der Akku lädt über USB-C; auf niedriger Stufe leuchtet sie bis zu {c['werte']['runtime_h']} Stunden. Schutzart {c['werte']['ip_rating']}. "
         + ("Rotlicht schont die Nachtsicht und blendet niemanden im Zelt." if c['werte']['red_light'] == "true" else "")],
        [f"The {c['name_en']} is a headlamp for {c['einsatz'][1]} with {c['werte']['lumen']} lumens and a {c['werte']['beam_m']} m beam.",
         f"The battery charges via USB-C; on low it runs for up to {c['werte']['runtime_h']} hours. Rated {c['werte']['ip_rating']}. "
         + ("Red light preserves night vision." if c['werte']['red_light'] == "true" else "")]),
    merkmale=[("Akku mit USB-C", "USB-C rechargeable"), ("Sperrfunktion gegen Einschalten im Rucksack", "Lock mode"), ("Schwenkbarer Lampenkopf", "Tilting head"),
              ("Reflektierendes Kopfband", "Reflective headband"), ("Ladestandsanzeige", "Battery indicator")],
    pflege=("Akku alle drei Monate laden, Kontakte trocken halten. Kopfband von Hand waschen.", "Charge every three months, keep contacts dry. Hand wash the headband."),
    doc=[
        ("Bedienung", ["Ein kurzer Druck schaltet ein und wechselt die Stufen, langes Drücken schaltet aus. Doppelklick wählt Rotlicht. "
                    "Drei Sekunden gedrückt halten sperrt die Lampe — so geht sie im Rucksack nicht von selbst an."]),
        ("Akku", ["Laden Sie den Akku vor der ersten Nutzung voll. Bei langer Lagerung halb laden und alle drei Monate nachladen. Kälte "
                    "verkürzt die Leuchtdauer: im Winter die Lampe nachts im Schlafsack aufbewahren."]),
        ("Die Lampe geht nicht an", ["Prüfen Sie die Sperre (drei Sekunden drücken). Lädt die Lampe nicht, die USB-C-Buchse trocknen und von "
                    "Sand befreien. Nach Wasserkontakt die Ladeklappe öffnen und trocknen lassen, bevor Sie laden."]),
    ],
)

# ---- Trekkingstöcke
K["Trekkingstöcke"] = dict(
    stoff=("Carbon", "carbon"),
    gruppe=("tw_stoecke", "Trekkingstöcke – Technik", "Trekking poles – technical"),
    attrs=[("length_range", "Länge verstellbar", "Adjustable length", "text", {}), ("packed_cm", "Packmaß", "Packed length", "integer", {"unit": "cm"}),
           ("locking", "Verstellung", "Locking", "text", {"axes": ["locale"]})],
    werte=lambda r: {"length_range": r.choice(["105–125 cm", "110–130 cm", "115–135 cm"]), "packed_cm": r.choice([36, 40, 62]),
                     "locking": r.choice([("Klemmhebel", "Lever lock"), ("Faltsystem mit Druckknopf", "Folding with push button")])},
    einsatz=[("Wandern und Trekking", "hiking and trekking"), ("steile Abstiege", "steep descents"), ("Trailrunning", "trail running")],
    text=lambda r, c: (
        [f"Der {c['name_de']} ist ein Trekkingstock aus {c['stoff'][0]} für {c['einsatz'][0]}. Länge {c['werte']['length_range']}, "
         f"Packmaß {c['werte']['packed_cm']} cm, Verstellung über {c['werte']['locking'][0]}.",
         "Stöcke entlasten Knie und Hüfte beim Abstieg um bis zu einem Viertel und geben Halt auf losem Untergrund und in Bachläufen."],
        [f"The {c['name_en']} is a {c['stoff'][1]} trekking pole for {c['einsatz'][1]}. Length {c['werte']['length_range']}, packed "
         f"{c['werte']['packed_cm']} cm, {c['werte']['locking'][1].lower()}.",
         "Poles take load off knees and hips on descents and give support on loose ground and in streams."]),
    merkmale=[("Korkgriff mit Verlängerung", "Cork grip with extension"), ("Hartmetallspitze", "Carbide tip"), ("Wechselbare Teller", "Interchangeable baskets"),
              ("Gepolsterte Handschlaufe", "Padded strap")],
    pflege=("Nach Nässe auseinanderziehen und trocknen lassen. Klemmung nicht ölen.", "Pull apart and dry after wet use. Do not oil the locks."),
    doc=[
        ("Länge einstellen", ["Im Stand mit dem Stock senkrecht neben dem Fuß: der Unterarm liegt waagerecht. Bergauf 5 bis 10 cm kürzer, bergab "
                    "5 bis 10 cm länger einstellen."]),
        ("Die Klemmung hält nicht", ["Rutscht ein Segment, ziehen Sie die Schraube am Klemmhebel eine halbe Umdrehung fester. Fett oder Öl "
                    "gehört nicht an die Klemmung. Ist der Stock innen nass, auseinanderziehen und trocknen lassen."]),
        ("Ersatzteile", ["Spitzen, Teller und Klemmhebel gibt es einzeln; die Spitze wird mit heißem Wasser erwärmt und abgezogen."]),
    ],
)

# ---------------------------------------------------------------- Ratgeber je Obergruppe

RATGEBER = {
    "Bekleidung": ("Ratgeber Bekleidung: Lagenprinzip und Größen", [
        ("Das Lagenprinzip", ["Unterwegs ziehen Sie mehrere dünne Lagen statt einer dicken an — so lässt sich die Wärme regeln. Die erste "
                              "Lage (Merino oder Kunstfaser) leitet Schweiß von der Haut, die zweite (Fleece, leichte Daune) wärmt, die dritte "
                              "(Wetterschutzjacke, Regenhose) hält Wind und Regen ab. Baumwolle gehört nicht in die erste Lage: sie bleibt nass und kühlt aus."]),
        ("Größentabelle Oberteile", [["XS: Brust 84–88 cm, Taille 70–74 cm", "S: Brust 88–94 cm, Taille 74–80 cm", "M: Brust 94–100 cm, Taille 80–86 cm",
                                      "L: Brust 100–106 cm, Taille 86–92 cm", "XL: Brust 106–112 cm, Taille 92–98 cm", "XXL: Brust 112–118 cm, Taille 98–104 cm"]]),
        ("Größentabelle Hosen", [["XS: Bund 70–74 cm, Hüfte 86–90 cm", "S: Bund 74–80 cm, Hüfte 90–96 cm", "M: Bund 80–86 cm, Hüfte 96–102 cm",
                                  "L: Bund 86–92 cm, Hüfte 102–108 cm", "XL: Bund 92–98 cm, Hüfte 108–114 cm"],
                                 "Liegen Sie zwischen zwei Größen, nehmen Sie bei Jacken die größere (Platz für eine Zwischenlage), bei Hosen die kleinere."]),
        ("Wasserdicht oder wasserabweisend", ["Wasserdicht heißt: eine Membran oder Beschichtung mit mindestens 10 000 mm Wassersäule und "
                              "verschweißte Nähte. Wasserabweisend heißt: das Material ist imprägniert, Wasser perlt ab, bei Dauerregen dringt es "
                              "aber durch. Hosen und Softshells sind wasserabweisend, Regenjacken wasserdicht."]),
    ]),
    "Schuhe": ("Ratgeber Schuhe: die richtige Größe und der richtige Schuh", [
        ("Größe finden", ["Messen Sie die Fußlänge am Nachmittag, stehend, mit der Socke, die Sie beim Wandern tragen. Zur Fußlänge kommen 1 bis "
                          "1,5 cm Spielraum — bergab rutscht der Fuß nach vorn.",
                          ["EU 39: Fußlänge bis 24,8 cm", "EU 40: bis 25,4 cm", "EU 41: bis 26,1 cm", "EU 42: bis 26,8 cm", "EU 43: bis 27,4 cm",
                           "EU 44: bis 28,1 cm", "EU 45: bis 28,7 cm", "EU 46: bis 29,4 cm"]]),
        ("Welcher Schuh wofür", ["Niedrige Schuhe für Wege und leichtes Gelände, mittelhohe für Touren mit Gepäck, hohe für Geröll, Schnee und "
                          "alpine Wege. Trailrunningschuhe sind leicht und flexibel, schützen aber weniger. Sandalen für Sommer und Wasser."]),
        ("Membran oder nicht", ["Eine Membran hält Regen und nasses Gras draußen, macht den Schuh aber wärmer. Für heiße Sommertouren ist ein "
                          "Schuh ohne Membran oft angenehmer — er wird nass, trocknet aber schneller."]),
    ]),
    "Rucksäcke & Taschen": ("Ratgeber Rucksäcke: Volumen und Rückenlänge", [
        ("Welches Volumen", [["Tagestour: 18 bis 30 Liter", "Hüttentour über mehrere Tage: 30 bis 45 Liter", "Trekking mit Zelt: 55 bis 75 Liter"]]),
        ("Rückenlänge messen", ["Messen Sie vom siebten Halswirbel (der hervorstehende Knochen am Nacken) bis zur Höhe der Beckenknochen. Diese "
                          "Länge stellen Sie am Trekkingrucksack ein; Tagesrucksäcke gibt es in einer Länge."]),
        ("Rucksack richtig tragen", ["Die Last gehört auf die Hüfte: Hüftgurt auf die Beckenknochen, Schultergurte nur so fest, dass der "
                          "Rucksack nicht nach hinten kippt. Drückt es auf den Schultern, sitzt der Hüftgurt zu tief oder ist zu locker."]),
    ]),
    "Ausrüstung": ("Ratgeber Ausrüstung: Zelt, Schlafsack, Isomatte, Kocher", [
        ("Das Schlafsystem", ["Schlafsack und Isomatte gehören zusammen: der Schlafsack hält die Wärme nach oben, die Matte nach unten. Für "
                          "Nächte um 0 °C brauchen Sie einen Schlafsack mit Komforttemperatur um 0 °C und eine Matte mit R-Wert ab 3,5."]),
        ("Welches Zelt", ["Tunnelzelte sind leicht und geräumig, brauchen aber Heringe und Abspannung. Kuppelzelte stehen frei und lassen sich "
                          "versetzen. Geodäten sind am stabilsten bei Wind und Schnee. Für eine Person auf Trekkingtour genügt ein Zweipersonenzelt "
                          "mit wenig Gewicht — der Platz für das Gepäck ist es wert."]),
        ("Kochen unterwegs", ["Gaskocher sind sauber und schnell, frieren aber bei Kälte ein. Spirituskocher sind robust und leise, brauchen "
                          "aber länger. Kochen Sie nie im geschlossenen Zelt."]),
    ]),
    "Zubehör": ("Ratgeber Zubehör: Licht, Wasser, Stöcke", [
        ("Licht", ["Für Wege und das Zelt genügen 250 Lumen, für Läufe in der Dunkelheit und alpine Starts 400 Lumen und mehr. Rotlicht "
                   "schont die Nachtsicht."]),
        ("Wasser", ["Rechnen Sie bei Wanderungen mit einem halben Liter je Stunde, bei Hitze mehr. Eine isolierte Flasche hält im Winter Tee warm."]),
        ("Stöcke", ["Stöcke entlasten die Gelenke beim Abstieg. Faltstöcke passen in den Rucksack, Teleskopstöcke lassen sich feiner einstellen."]),
    ]),
}

# ---------------------------------------------------------------- Garantie und Service (die Marke)

GARANTIE = ("Garantie und Service", [
    ("Fünf Jahre Garantie", ["Auf alle Produkte geben wir fünf Jahre Garantie auf Material- und Verarbeitungsfehler, gerechnet ab dem Kaufdatum. "
                             "Die gesetzliche Gewährleistung bleibt davon unberührt. Ausgenommen sind normale Abnutzung (abgelaufene Sohlen, "
                             "Pilling), unsachgemäße Pflege und Schäden durch Unfall."]),
    ("Reparatur statt Neukauf", ["Was sich reparieren lässt, reparieren wir — auch nach Ablauf der Garantie, zum Selbstkostenpreis. Unsere "
                             "Werkstatt tauscht Reißverschlüsse, flickt Membranjacken und Zelte, besohlt Wanderschuhe und ersetzt Gestängesegmente.",
                             ["Ersatzteile wie Schieber, Endklemmen, Schnallen, Heringe und Ventile schicken wir kostenlos.",
                              "Reparaturaufträge melden Sie über das Kontaktformular im Shop an; Sie erhalten ein Versandetikett.",
                              "Eine Reparatur dauert in der Regel zwei bis drei Wochen."]]),
    ("Rücksendung", ["Ungetragene Ware können Sie innerhalb von 30 Tagen zurücksenden. Schuhe bitte nur in der Wohnung probieren, damit die "
                     "Sohle sauber bleibt."]),
    ("Kontakt", ["Fragen zu Größe, Pflege und Reparatur beantwortet unser Service über das Kontaktformular im Shop, werktags innerhalb eines Tages."]),
])


# ---------------------------------------------------------------- Häufige Fragen: die Wissensbasis (tannwald_faq.md) und je Produkt

import os
import re

FAQ_DATEI = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tannwald_faq.md")


def faq_lesen(pfad: str = FAQ_DATEI) -> dict[str, list[dict]]:
    """Die Wissensbasis als {Untergruppe: [{phase, nr, frage, antwort, empfehlung, prioritaet}]}. Phase A: vor dem Kauf, B: während der
    Benutzung. Der Abschnitt „Einsatz im Shop“ am Ende gehört nicht dazu."""
    if not os.path.exists(pfad):
        return {}
    aus: dict[str, list[dict]] = {}
    gruppe, eintrag = None, None
    for zeile in open(pfad, encoding="utf-8"):
        z = zeile.strip()
        if z.startswith("## ") and not z.startswith("### "):
            gruppe = None
            if re.match(r"## \d+\. Einsatz im Shop", z):
                break
            continue
        if (m := re.match(r"### \d+\.\d+ (.+)$", z)):
            gruppe = m.group(1).strip()
            aus.setdefault(gruppe, [])
            continue
        if not gruppe:
            continue
        if (m := re.match(r"\*\*([AB])(\d+)\. (.+?)\*\*$", z)):
            eintrag = {"phase": m.group(1), "nr": int(m.group(2)), "frage": m.group(3).strip(), "antwort": "", "empfehlung": "", "prioritaet": ""}
            aus[gruppe].append(eintrag)
        elif eintrag and z.startswith("**Antwort:**"):
            eintrag["antwort"] = z[len("**Antwort:**"):].strip()
        elif eintrag and z.startswith("**Empfehlung:**"):
            rest = z[len("**Empfehlung:**"):].strip()
            if (m := re.search(r"\*\*Priorität: (\w+)\.\*\*", rest)):
                eintrag["prioritaet"] = m.group(1)
                rest = rest[:m.start()].strip()
            eintrag["empfehlung"] = rest
    return aus


def faq_dokument(gruppe: str, eintraege: list[dict]) -> list:
    """Abschnitte für das PDF „Häufige Fragen – <Gruppe>“: je Frage eine Überschrift — der Dokumentindex schneidet daran, und ein Abschnitt
    ist dann genau eine Frage mit Antwort und Empfehlung."""
    abschnitte = [("Zu diesen Antworten", ["Die Antworten sind allgemeine Hinweise für alle Produkte dieser Gruppe. Maßgeblich sind die Angaben "
                                           "im Datenblatt des einzelnen Produkts und das Pflegeetikett."])]
    for phase, titel in (("A", "vor dem Kauf"), ("B", "während der Benutzung")):
        for e in (x for x in eintraege if x["phase"] == phase):
            abschnitte.append((e["frage"], [e["antwort"], f"Empfehlung ({titel}): {e['empfehlung']}"]))
    return abschnitte


# Je Untergruppe zwei Fragen, die die Werte des Produkts beantworten: (Frage de, Antwort de, Frage en, Antwort en)

FAQ_PRODUKT = {
    "Jacken": lambda c, w: [
        (f"Ist die {c['name_de']} wasserdicht?", f"Ja, mit {tausend(w['waterproof_mm'])} mm Wassersäule und verschweißten Nähten.",
         f"Is the {c['name_en']} waterproof?", f"Yes, with a {w['waterproof_mm']:,} mm hydrostatic head and taped seams."),
        ("Passt ein Helm unter die Kapuze?", "Ja, die Kapuze ist helmtauglich." if w["helmet_hood"] == "true" else "Nein, die Kapuze ist für den Kopf ohne Helm geschnitten.",
         "Does a helmet fit under the hood?", "Yes, the hood is helmet compatible." if w["helmet_hood"] == "true" else "No, the hood is cut for use without a helmet."),
    ],
    "Hosen": lambda c, w: [
        (f"Hat die {c['name_de']} abzippbare Beine?", "Ja, die Beine lassen sich am Knie abzippen." if w["zip_off"] == "true" else "Nein.",
         f"Do the {c['name_en']} have zip-off legs?", "Yes, the legs zip off at the knee." if w["zip_off"] == "true" else "No."),
        ("Ist die Hose wasserdicht?", "Nein, sie ist wasserabweisend; bei Dauerregen gehört eine Regenhose darüber.",
         "Are the trousers waterproof?", "No, they are water repellent; wear rain trousers in sustained rain."),
    ],
    "Shirts & Pullover": lambda c, w: [
        (f"Wie viel Merino steckt im {c['name_de']}?", f"{w['merino_share']} % Merinowolle, {w['fabric_weight']} g/m².",
         f"How much merino is in the {c['name_en']}?", f"{w['merino_share']} % merino wool, {w['fabric_weight']} gsm."),
        ("Kratzt das Shirt?", "Nein, die Wolle ist fein und lässt sich direkt auf der Haut tragen.", "Does the shirt itch?", "No, the fine wool can be worn next to skin."),
    ],
    "Mützen & Handschuhe": lambda c, w: [
        (f"Ist die {c['name_de']} winddicht?", "Ja, mit winddichter Zwischenlage." if w["windproof"] == "true" else "Nein, sie ist ein wärmender Strick ohne Windschutz.",
         f"Is the {c['name_en']} windproof?", "Yes, with a windproof inner layer." if w["windproof"] == "true" else "No, it is a warm knit without wind protection."),
        ("Passt die Mütze unter eine Kapuze?", "Ja.", "Does it fit under a hood?", "Yes."),
    ],
    "Wanderschuhe": lambda c, w: [
        (f"Hat der {c['name_de']} eine wasserdichte Membran?", "Ja." if w["membrane"] == "true" else "Nein, er ist ohne Membran und dadurch luftiger.",
         f"Does the {c['name_en']} have a waterproof membrane?", "Yes." if w["membrane"] == "true" else "No, it has no membrane and is more breathable."),
        ("Ist der Schuh steigeisenfest?", "Ja, bedingt (Kategorie B)." if "bedingt" in w["crampon"][0] else "Nein.",
         "Is the boot crampon compatible?", "Semi-automatic (B)." if "bedingt" in w["crampon"][0] else "No."),
    ],
    "Trailrunning": lambda c, w: [
        (f"Welche Sprengung hat der {c['name_de']}?", f"{w['drop_mm']} mm bei {w['stack_mm']} mm Sohlenhöhe an der Ferse.",
         f"What is the drop of the {c['name_en']}?", f"{w['drop_mm']} mm with a {w['stack_mm']} mm heel stack."),
        ("Hat der Schuh eine Steinschutzplatte?", "Ja." if w["rock_plate"] == "true" else "Nein.", "Does it have a rock plate?", "Yes." if w["rock_plate"] == "true" else "No."),
    ],
    "Sandalen": lambda c, w: [
        (f"Kann ich mit der {c['name_de']} ins Wasser?", "Ja, Riemen und Sohle vertragen Wasser.", f"Can I wear the {c['name_en']} in water?", "Yes, straps and sole are water friendly."),
        ("Wie viele Riemen lassen sich verstellen?", f"{w['straps']}.", "How many straps are adjustable?", f"{w['straps']}."),
    ],
    "Tagesrucksäcke": lambda c, w: [
        (f"Wie viel passt in den {c['name_de']}?", f"{w['volume_l']} Liter, empfohlen bis {w['max_load_kg']} kg.",
         f"How much fits in the {c['name_en']}?", f"{w['volume_l']} litres, recommended up to {w['max_load_kg']} kg."),
        ("Ist eine Regenhülle dabei?", "Ja, sie steckt im Bodenfach.", "Is a rain cover included?", "Yes, in the base pocket."),
    ],
    "Trekkingrucksäcke": lambda c, w: [
        (f"Wie viel passt in den {c['name_de']}?", f"{w['volume_l']} Liter, empfohlen bis {w['max_load_kg']} kg.",
         f"How much fits in the {c['name_en']}?", f"{w['volume_l']} litres, recommended up to {w['max_load_kg']} kg."),
        ("Lässt sich die Rückenlänge einstellen?", f"Ja, von {w['torso_cm']}.", "Is the torso length adjustable?", f"Yes, {w['torso_cm']}."),
    ],
    "Taschen": lambda c, w: [
        (f"Wie viel passt in die {c['name_de']}?", f"{w['volume_l']} Liter.", f"How much fits in the {c['name_en']}?", f"{w['volume_l']} litres."),
        ("Passt ein Laptop hinein?", f"Ja, bis {w['laptop']}." if w["laptop"] != "—" else "Nein, ein Laptopfach hat sie nicht.",
         "Does a laptop fit?", f"Yes, up to {w['laptop'].replace(' Zoll', ' inch')}." if w["laptop"] != "—" else "No, there is no laptop sleeve."),
    ],
    "Zelte": lambda c, w: [
        (f"Für wie viele Personen ist das {c['name_de']}?", f"{w['persons']}, mit {'einer Apsis' if w['vestibules'] == 1 else 'zwei Apsiden'} für das Gepäck.",
         f"How many people does the {c['name_en']} sleep?", f"{w['persons']}, with {w['vestibules']} vestibule(s) for gear."),
        ("Wie lange dauert der Aufbau?", f"Etwa {w['pitch_min']} Minuten; Außen- und Innenzelt werden gemeinsam aufgebaut.",
         "How long does pitching take?", f"About {w['pitch_min']} minutes; fly and inner pitch together."),
    ],
    "Schlafsäcke": lambda c, w: [
        (f"Bis zu welcher Temperatur hält der {c['name_de']} warm?", f"Komfort {w['comfort_c']} °C, Grenze {w['limit_c']} °C nach EN ISO 23537.",
         f"How warm is the {c['name_en']}?", f"Comfort {w['comfort_c']} °C, limit {w['limit_c']} °C (EN ISO 23537)."),
        ("Wie klein lässt er sich packen?", f"Auf {w['packed_size']} im Kompressionssack.", "How small does it pack?", f"To {w['packed_size']} in the compression sack."),
    ],
    "Isomatten": lambda c, w: [
        (f"Wie warm ist die {c['name_de']}?", f"R-Wert {zahl(w['r_value'])}.", f"How warm is the {c['name_en']}?", f"R-value {w['r_value']}."),
        ("Wie dick und wie lang ist sie?", f"{zahl(w['thickness_cm'])} cm dick, {w['length_cm']} cm lang.", "How thick and long is it?",
         f"{w['thickness_cm']} cm thick, {w['length_cm']} cm long."),
    ],
    "Kocher": lambda c, w: [
        (f"Welcher Brennstoff passt in den {c['name_de']}?", f"{w['fuel'][0]}.", f"Which fuel does the {c['name_en']} use?", f"{w['fuel'][1]}."),
        ("Wie schnell kocht er einen Liter Wasser?", f"In etwa {zahl(w['boil_min'])} Minuten bei Windstille.", "How fast does it boil a litre?",
         f"In about {w['boil_min']} minutes without wind."),
    ],
    "Trinkflaschen": lambda c, w: [
        (f"Wie lange hält die {c['name_de']} warm?", f"{w['keeps_hot_h']} Stunden warm, {w['keeps_cold_h']} Stunden kalt.",
         f"How long does the {c['name_en']} keep drinks hot?", f"{w['keeps_hot_h']} hours hot, {w['keeps_cold_h']} hours cold."),
        ("Ist sie spülmaschinenfest?", "Ja." if w["dishwasher"] == "true" else "Nein, bitte von Hand spülen.", "Is it dishwasher safe?",
         "Yes." if w["dishwasher"] == "true" else "No, hand wash only."),
    ],
    "Stirnlampen": lambda c, w: [
        (f"Wie hell ist die {c['name_de']}?", f"{w['lumen']} Lumen, {w['beam_m']} m Leuchtweite.", f"How bright is the {c['name_en']}?",
         f"{w['lumen']} lumens, {w['beam_m']} m beam."),
        ("Wie lange hält der Akku?", f"Bis zu {w['runtime_h']} Stunden auf niedriger Stufe; geladen wird über USB-C.", "How long does the battery last?",
         f"Up to {w['runtime_h']} hours on low; charges via USB-C."),
    ],
    "Trekkingstöcke": lambda c, w: [
        (f"Wie lang ist der {c['name_de']}?", f"{w['length_range']}, Packmaß {w['packed_cm']} cm.", f"How long is the {c['name_en']}?",
         f"{w['length_range']}, packed {w['packed_cm']} cm."),
        ("Wie wird die Länge verstellt?", f"{w['locking'][0]}.", "How is the length adjusted?", f"{w['locking'][1]}."),
    ],
}


def geo_texte(kategorie: str, info: dict, ctx: dict, wissen: dict[str, list[dict]]) -> dict[str, tuple[str, str]]:
    """Die GEO-Texte eines Produkts (Plugin geo): Definition, Beschreibung, häufige Fragen, Suchbegriffe. Die Fragen: zwei mit den Werten
    des Produkts, dazu drei allgemeine mit hoher Priorität aus der Wissensbasis (nur deutsch — sie gibt es nur deutsch)."""
    r = random.Random("tannwald-geo:" + ctx["name_de"])
    erster = lambda t: re.split(r"(?<=[.!?])\s", t, maxsplit=1)[0]
    eigen = FAQ_PRODUKT[kategorie](ctx, info["werte"]) if kategorie in FAQ_PRODUKT else []
    allgemein = [e for e in wissen.get(kategorie, []) if e["prioritaet"] == "Hoch"]
    allgemein = r.sample(allgemein, min(3, len(allgemein)))
    faq_de = [f"{q} {a}" for q, a, _, _ in eigen] + [f"{e['frage']} {e['antwort']} {e['empfehlung']}" for e in allgemein]
    faq_en = [f"{q} {a}" for _, _, q, a in eigen]
    merk_de = ", ".join(m[0] for m in info["merkmale"][:4])
    merk_en = ", ".join(m[1] for m in info["merkmale"][:4])
    return {
        "geo_definition": (erster(info["absaetze"][0][0]), erster(info["absaetze"][1][0])),
        "geo_description": (info["absaetze"][0][0], info["absaetze"][1][0]),
        "geo_faq": ("\n".join(faq_de), "\n".join(faq_en)),
        "geo_keywords": (f"{kategorie}, {ctx['einsatz'][0]}, {merk_de}", f"{ctx['einsatz'][1]}, {merk_en}"),
    }

# ---------------------------------------------------------------- Bausteine für ein Produkt

def produkt(kategorie: str, name_de: str, name_en: str, material: tuple[str, str], gewicht: float) -> dict | None:
    """Alles, was an einem Produkt dieser Untergruppe steht: Werte, Beschreibung (HTML), Merkmale (HTML), Einsatz, Pflege.
    Der Zufall hängt nur am Namen — derselbe Name ergibt dieselben Angaben."""
    k = K.get(kategorie)
    if not k:
        return None
    r = random.Random("tannwald:" + name_de)
    werte = k["werte"](r)
    einsatz = r.choice(k["einsatz"])
    ctx = {"name_de": name_de, "name_en": name_en, "material": material, "stoff": k.get("stoff", material), "werte": werte, "einsatz": einsatz,
           "gewicht": gewicht}
    de, en = k["text"](r, ctx)
    merk = r.sample(k["merkmale"], min(len(k["merkmale"]), r.randint(5, 7)))
    return {
        "werte": werte,
        "einsatz": einsatz,
        "beschreibung": ("".join(f"<p>{x}</p>" for x in de), "".join(f"<p>{x}</p>" for x in en)),
        "absaetze": (de, en),
        "merkmale": merk,
        "merkmale_html": ("<ul>" + "".join(f"<li>{m[0]}</li>" for m in merk) + "</ul>", "<ul>" + "".join(f"<li>{m[1]}</li>" for m in merk) + "</ul>"),
        "pflege": k["pflege"],
        "ctx": ctx,
    }


def wert_text(attr: tuple, v) -> str:
    """Ein Wert für das Datenblatt: Texte deutsch, ja/nein, Zahl mit Einheit."""
    key, de, en, typ, extra = attr
    if isinstance(v, tuple):
        v = v[0]
    if typ == "boolean":
        return "ja" if v == "true" else "nein"
    if typ in ("integer", "decimal"):
        s = tausend(v) if isinstance(v, int) and v >= 10000 else zahl(v) if isinstance(v, float) else str(v)
        return s + (" " + extra["unit"] if extra.get("unit") else "")
    return str(v)
