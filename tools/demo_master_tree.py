#!/usr/bin/env python3
"""
Demo-MasterTree für journali: eine erfundene Outdoor-Marke „Tannwald“ mit rund 200 Produkten
in Produktgruppen, Varianten nach Farbe × Grösse (bzw. Schuhgrösse, Füllmenge) und je Produkt
einem generierten Bild. Nichts davon sind Kundendaten — Namen, Beschreibungen, SKUs, EANs und
Bilder entstehen hier im Skript.

Schreibt ausschliesslich über /api (Catalog ist der einzige Schreibpfad, Regel 2):
  1. Modell ergänzen: Listen size, shoe_size, capacity; Attribute size, shoe_size, capacity,
     brand, material, price (PUT /api/model/…)
  2. Produktgruppen (POST /api/groups) unter g-mastertree, darunter Produkte (POST /api/products)
     mit Achsen, darunter Varianten (POST /api/variants)
  3. Werte je Knoten (POST /api/nodes/{id}/attributes), Status (POST /api/nodes/{id}/status)
  4. Bild je Produkt: PNG mit Pillow, POST /api/media, Relation image mit inherit=true

Aufruf: tools\\demo-daten.cmd (Windows, aus jedem Verzeichnis, ohne Parameter) oder python tools/demo_master_tree.py.
  Ohne Angaben fragt das Skript: Adresse (Vorgabe http://localhost:5000), Anwender und Passwort, wenn die Instanz eine Anmeldung
  verlangt. Alles lässt sich auch mitgeben: --url, --user, --password oder JOURNALI_DEMO_PASSWORD, --token jt_…

Jede Datenbank: das Skript legt nur an, was fehlt (Listen, Werte einer Liste, Attribute), und ändert nichts, was schon da ist. Ein
Wert, der in dieser Datenbank nicht gesetzt werden kann, wird übersprungen und am Ende gezählt; abgebrochen wird nur, wenn die
Anmeldung scheitert, das Kontingent aufgebraucht ist oder ein Knoten nicht angelegt werden kann. Ein zweiter Lauf knüpft an.

Liegt unter der Wurzel schon eine Gruppe „Tannwald Outdoor“ (ein abgebrochener Lauf), knüpft der Lauf daran an: Gruppen und
Produkte mit derselben Bezeichnung werden wiederverwendet, nicht doppelt angelegt. Gelten die Attributgruppen der Demo-Attribute
(etwa die von ean oder price) auf dem Pfad nicht, hängt das Skript sie an seine Demo-Gruppe.

Dazu zwei Beispiele für die Plugins (je übersprungen, wenn es sie schon gibt oder das Plugin fehlt, aus ist oder nicht zum Tarif gehört):
  5. Konfigurator: die Gruppe „Server-Konfigurator (Demo)“ mit Mainboards, Prozessoren, Arbeitsspeicher, Kühlpaste, Karten, einer
     Grafikkarte und einem Netzteil; Konfiguratorgruppen (group:…), die Zeilen der Teile (member:…) und der Konfigurator „server“
     (def:server) mit Regeln und einer Grenze — als Plugin-Daten von configurator. Am Ende fragt das Skript den Endpunkt einmal.
  6. Skript: „Konfiguratorgruppen: Mitglieder je Gruppe“ (scriptum), freigegeben für das Recht „read“.

  --nur-beispiele      nur 5 und 6 (der Tannwald-Teil läuft schon); legt das Modell nur an, was die Beispiele brauchen
  --ohne-beispiele     nur 1 bis 4
"""
from __future__ import annotations

import argparse
import hashlib
import io
import math
import os
import random
import sys
import time

try:
    import requests
    from PIL import Image, ImageDraw, ImageFont
except ImportError as e:
    sys.exit(f"Es fehlt ein Python-Paket ({e.name}): python -m pip install requests pillow — tools\\demo-daten.cmd erledigt das selbst.")
import getpass

ROOT = "g-mastertree"
BRAND = "Tannwald"
SEED = 20260924

# Farben der Saat-Werteliste color (Schlüssel → Hex nur fürs Bild)
COLOR_HEX = {
    "black": "#1f1f1f", "anthracite": "#3a3d40", "grey": "#9a9d9f", "navy": "#1d3557", "blue": "#2b6cb0",
    "turquoise": "#1c9aa6", "green": "#3b7a3b", "mint": "#5fc3a8", "red": "#c0392b", "orange": "#e67e22",
    "yellow": "#e6b422", "brown": "#7b4a2d", "beige": "#d6c3a1", "white": "#f2f2f2", "purple": "#6f3d8a",
}
PALETTE_TECH = ["black", "anthracite", "navy", "red", "orange", "green", "blue", "turquoise"]
PALETTE_NATURE = ["green", "brown", "beige", "anthracite", "navy", "orange"]
PALETTE_BRIGHT = ["red", "orange", "yellow", "turquoise", "mint", "purple", "blue"]

SIZES = [("xs", "XS"), ("s", "S"), ("m", "M"), ("l", "L"), ("xl", "XL"), ("xxl", "XXL")]
SHOE_SIZES = [(f"eu{n}", f"EU {n}") for n in range(38, 48)]
CAPACITIES = [("c050", "0,5 l", "0.5 l"), ("c075", "0,75 l", "0.75 l"), ("c100", "1,0 l", "1.0 l"), ("c150", "1,5 l", "1.5 l")]

# Erfundene Modellnamen (nordisch klingend, keine echten Produkte)
MODELS = [
    "Fjell", "Kvist", "Brenna", "Varde", "Skare", "Lunde", "Tyri", "Solvik", "Nordal", "Eira", "Hellik", "Grane",
    "Vidda", "Ravn", "Bjørk", "Frost", "Sildre", "Tindra", "Storm", "Aske", "Lyng", "Moss", "Rime", "Kilden",
    "Halvor", "Selje", "Ulve", "Torve", "Brede", "Odda", "Ravik", "Skjold", "Tuva", "Vaage", "Heia", "Nøkk",
]

# Untergruppen: (de, en, Achsen, Anzahl, Typbezeichnung de, en, Palette, Preisbereich, Gewicht kg, Material de/en, Shape)
SUBGROUPS = {
    "apparel": [
        ("Jacken", "Jackets", ["color", "size"], 24, "Jacke", "Jacket", PALETTE_TECH, (89, 349), (0.28, 0.95),
         ("Recyceltes Polyamid, PFC-freie Imprägnierung", "Recycled polyamide, PFC-free DWR"), "jacket"),
        ("Hosen", "Trousers", ["color", "size"], 18, "Hose", "Trousers", PALETTE_NATURE, (59, 169), (0.30, 0.62),
         ("Elastisches Softshell, Kniepartie verstärkt", "Stretch softshell, reinforced knees"), "trousers"),
        ("Shirts & Pullover", "Shirts & Sweaters", ["color", "size"], 24, "Shirt", "Shirt", PALETTE_BRIGHT, (29, 119), (0.12, 0.42),
         ("Merinowolle 150 g/m², flach vernäht", "150 gsm merino wool, flatlock seams"), "shirt"),
        ("Mützen & Handschuhe", "Hats & Gloves", ["color", "size"], 12, "Mütze", "Beanie", PALETTE_BRIGHT, (19, 59), (0.05, 0.14),
         ("Wolle-Acryl-Mischung, Fleecefutter", "Wool-acrylic blend, fleece lining"), "hat"),
    ],
    "footwear": [
        ("Wanderschuhe", "Hiking boots", ["color", "shoe_size"], 16, "Wanderschuh", "Hiking boot", PALETTE_NATURE, (119, 259), (0.48, 0.72),
         ("Nubukleder, wasserdichte Membran, Vibram-ähnliche Sohle", "Nubuck leather, waterproof membrane, lugged sole"), "boot"),
        ("Trailrunning", "Trail running", ["color", "shoe_size"], 12, "Trailschuh", "Trail shoe", PALETTE_BRIGHT, (99, 179), (0.26, 0.34),
         ("Mesh-Obermaterial, 4 mm Profil, Zehenschutz", "Mesh upper, 4 mm lugs, toe cap"), "boot"),
        ("Sandalen", "Sandals", ["color", "shoe_size"], 8, "Sandale", "Sandal", PALETTE_NATURE, (49, 99), (0.22, 0.31),
         ("Polyesterriemen, Korkfussbett", "Polyester straps, cork footbed"), "sandal"),
    ],
    "packs": [
        ("Tagesrucksäcke", "Daypacks", ["color"], 14, "Tagesrucksack", "Daypack", PALETTE_TECH, (49, 129), (0.55, 0.95),
         ("420D-Nylon, Rückennetz, Regenhülle", "420D nylon, mesh back panel, rain cover"), "pack"),
        ("Trekkingrucksäcke", "Trekking packs", ["color", "size"], 10, "Trekkingrucksack", "Trekking pack", PALETTE_TECH, (149, 299), (1.6, 2.4),
         ("Ripstop-Nylon, Aluminiumrahmen, verstellbare Rückenlänge", "Ripstop nylon, aluminium frame, adjustable torso"), "pack"),
        ("Taschen", "Bags", ["color"], 10, "Tasche", "Bag", PALETTE_NATURE, (29, 89), (0.20, 0.60),
         ("Gewachste Baumwolle, Lederriemen", "Waxed cotton, leather straps"), "bag"),
    ],
    "equipment": [
        ("Zelte", "Tents", ["color"], 10, "Zelt", "Tent", PALETTE_NATURE, (199, 599), (1.4, 3.8),
         ("Silikonbeschichtetes Nylon, Aluminiumgestänge, 3000 mm Wassersäule", "Silicone-coated nylon, aluminium poles, 3000 mm hydrostatic head"), "tent"),
        ("Schlafsäcke", "Sleeping bags", ["color", "size"], 10, "Schlafsack", "Sleeping bag", PALETTE_TECH, (89, 349), (0.7, 1.9),
         ("Daune 800 cuin, RDS-zertifiziert", "800 fill-power down, RDS certified"), "sleepingbag"),
        ("Isomatten", "Sleeping pads", ["color", "size"], 8, "Isomatte", "Sleeping pad", PALETTE_TECH, (49, 189), (0.35, 0.9),
         ("TPU-laminiertes Polyester, R-Wert 3,5", "TPU-laminated polyester, R-value 3.5"), "pad"),
        ("Kocher", "Stoves", [], 8, "Kocher", "Stove", PALETTE_TECH, (29, 129), (0.08, 0.35),
         ("Edelstahl und Titan, Piezozündung", "Stainless steel and titanium, piezo ignition"), "stove"),
    ],
    "accessories": [
        ("Trinkflaschen", "Bottles", ["color", "capacity"], 10, "Trinkflasche", "Bottle", PALETTE_BRIGHT, (14, 39), (0.09, 0.32),
         ("Edelstahl 18/8, doppelwandig", "18/8 stainless steel, double-walled"), "bottle"),
        ("Stirnlampen", "Headlamps", ["color"], 8, "Stirnlampe", "Headlamp", PALETTE_BRIGHT, (24, 89), (0.05, 0.12),
         ("400 lm, USB-C, IPX6", "400 lm, USB-C, IPX6"), "lamp"),
        ("Trekkingstöcke", "Trekking poles", ["color"], 6, "Trekkingstock", "Trekking pole", PALETTE_TECH, (39, 129), (0.18, 0.28),
         ("Carbon, Korkgriff, Faltsystem", "Carbon, cork grip, folding system"), "poles"),
    ],
}
TOPGROUPS = {
    "apparel": ("Bekleidung", "Apparel"),
    "footwear": ("Schuhe", "Footwear"),
    "packs": ("Rucksäcke & Taschen", "Packs & Bags"),
    "equipment": ("Ausrüstung", "Equipment"),
    "accessories": ("Zubehör", "Accessories"),
}

USES_DE = ["für Tagestouren im Mittelgebirge", "für mehrtägige Trekkingtouren", "für den Alltag und die Reise",
           "für Hochtouren bei Wind und Nässe", "für den Sommer am Wasser", "für die kalte Jahreszeit"]
USES_EN = ["for day hikes in the hills", "for multi-day treks", "for everyday use and travel",
           "for alpine tours in wind and rain", "for summer days at the water", "for the cold season"]


# ---------------------------------------------------------------- HTTP

class Api:
    def __init__(self, url: str, actor: str, token: str | None):
        self.url = url.rstrip("/")
        self.s = requests.Session()
        self.s.headers["X-Actor"] = actor
        if token:
            self.s.headers["Authorization"] = "Bearer " + token
        self.calls = 0

    def login(self, user: str, password: str) -> None:
        r = self.s.post(self.url + "/api/auth/login", json={"user": user, "password": password}, timeout=30)
        if r.status_code != 200:
            sys.exit(f"Anmeldung fehlgeschlagen ({r.status_code}): {r.text[:200]}")
        print(f"angemeldet als {r.json().get('user')} ({r.json().get('role')})")

    log = None   # Datei für --log: jede Anfrage mit Antwortcode

    fehler: dict = {}   # weich übersprungene Anfragen: Meldung → Anzahl

    def call(self, method: str, path: str, soft: bool = False, **kw):
        self.calls += 1
        if self.log:
            self.log.write(f"{method} {path} {str(kw.get('json'))[:200]}\n"); self.log.flush()
        for attempt in range(3):
            r = self.s.request(method, self.url + path, timeout=120, **kw)
            if self.log:
                self.log.write(f"  -> {r.status_code} {r.text[:300]}\n"); self.log.flush()
            if r.status_code < 500:
                break
            time.sleep(1 + attempt)
        if r.status_code == 403 and "ontingent" in r.text:
            sys.exit(f"Kein Kontingent mehr für Pflege im Team dieses Anwenders ({r.text[:200]}). Bis hier ist alles geschrieben; ein neuer Lauf knüpft an.")
        if r.status_code in (401,):
            sys.exit(f"Nicht angemeldet oder Anmeldung abgelaufen ({method} {path}).")
        if r.status_code >= 400:
            if soft:
                try:
                    msg = (r.json() or {}).get("template") or (r.json() or {}).get("error") or r.text[:120]
                except ValueError:
                    msg = r.text[:120]
                self.fehler[msg] = self.fehler.get(msg, 0) + 1
                return None
            sys.exit(f"{method} {path} → {r.status_code}: {r.text[:300]}")
        return r.json() if r.content else None

    def probe(self, method: str, path: str, **kw):
        """Wie call, aber ohne Abbruch: (Statuscode, Antwort). Für Fragen, deren Nein eine Antwort ist."""
        self.calls += 1
        r = self.s.request(method, self.url + path, timeout=120, **kw)
        if self.log:
            self.log.write(f"{method} {path} {str(kw.get('json'))[:200]}\n  -> {r.status_code} {r.text[:300]}\n"); self.log.flush()
        try:
            return r.status_code, (r.json() if r.content else None)
        except ValueError:
            return r.status_code, r.text

    def get(self, path: str):
        return self.call("GET", path)

    def put(self, path: str, body):
        return self.call("PUT", path, json=body)

    def post(self, path: str, body=None, **kw):
        return self.call("POST", path, json=body, **kw)

    # Schreibbefehle antworten mit dem Eintrag; stream ist die Id des Knotens/der Relation
    def created(self, path: str, body) -> str:
        return self.post(path, body)["stream"]

    def set_value(self, node: str, attribute: str, value: str | None = None, locale: str | None = None,
                  channel: str | None = None, values: list[str] | None = None) -> None:
        body: dict = {"attribute": attribute}
        if locale: body["locale"] = locale
        if channel: body["channel"] = channel
        if values is not None: body["values"] = values
        else: body["value"] = value
        self.call("POST", f"/api/nodes/{node}/attributes", soft=True, json=body)

    def soft_post(self, path: str, body) -> None:
        self.call("POST", path, soft=True, json=body)


# ---------------------------------------------------------------- Modell

def labels(de: str, en: str) -> dict:
    return {"de": de, "en": en}


COLORS = dict(COLOR_HEX)   # die Farben, die es in der Liste des Attributs color gibt (nach ensure_model)


def ensure_model(api: Api) -> None:
    """Legt an, was die Demo braucht und fehlt: Listen, fehlende Werte einer Liste, Attribute. Was es schon gibt, bleibt, wie es ist."""
    model = api.get("/api/model")
    as_list = lambda x: x if isinstance(x, list) else list((x or {}).values())
    attrs = {a["key"]: a for a in as_list(model.get("attributes"))}
    lists = {l["key"]: {str(v.get("value")) for v in (l.get("values") or []) if isinstance(v, dict)} for l in as_list(model.get("lists"))}
    groups = [g["key"] for g in as_list(model.get("groups")) if isinstance(g, dict) and g.get("key")]
    home = "mastergroup" if "mastergroup" in groups or not groups else groups[0]

    def list_(key: str, de: str, en: str, values: list[tuple[str, str, str]]) -> None:
        if key not in lists:
            api.put(f"/api/model/lists/{key}", {"key": key, "label": labels(de, en)})
            lists[key] = set()
        fehlt = [{"value": v, "label": labels(lde, len_), "order": i + 1} for i, (v, lde, len_) in enumerate(values) if v not in lists[key]]
        if fehlt:
            api.call("PUT", f"/api/model/lists/{key}/values", soft=True, json=fehlt)
            lists[key].update(x["value"] for x in fehlt)

    def attr(key: str, de: str, en: str, type_: str, **more) -> None:
        if key in attrs:
            return
        api.put(f"/api/model/attributes/{key}", {"key": key, "label": labels(de, en), "type": type_, "group": home, **more})
        attrs[key] = {"key": key, "type": type_, **more}

    list_("size", "Grössen", "Sizes", [(k, l, l) for k, l in SIZES])
    list_("shoe_size", "Schuhgrössen", "Shoe sizes", [(k, l, l) for k, l in SHOE_SIZES])
    list_("capacity", "Füllmengen", "Capacities", CAPACITIES)
    attr("name", "Name", "Name", "text", axes=["locale"])
    attr("description", "Beschreibung", "Description", "html", axes=["locale", "channel"])
    attr("material", "Material", "Material", "text", axes=["locale"])
    attr("weight", "Gewicht (kg)", "Weight (kg)", "decimal")
    attr("brand", "Marke", "Brand", "text", inheritable=True)
    attr("sku", "SKU", "SKU", "text")
    attr("ean", "EAN", "EAN", "text")
    attr("price", "Preis (EUR)", "Price (EUR)", "decimal")
    attr("size", "Grösse", "Size", "enum", list="size")
    attr("shoe_size", "Schuhgrösse", "Shoe size", "enum", list="shoe_size")
    attr("capacity", "Füllmenge", "Capacity", "enum", list="capacity")

    # Farbe: die Liste des Attributs color; fehlt das Attribut, entsteht es mit einer Liste color. Die Demo nimmt nur Farben, die die
    # Liste kennt — fremde Listen bekommen keine Werte dazu. Kennt sie keine, kommen die Demo-Farben in die Liste.
    if "color" not in attrs:
        list_("color", "Farben", "Colours", [(k, k, k) for k in COLOR_HEX])
        attr("color", "Farbe", "Colour", "enum", list="color")
    farbliste = attrs["color"].get("list") or "color"
    bekannt = lists.get(farbliste, set())
    if not bekannt & set(COLOR_HEX):
        list_(farbliste, "Farben", "Colours", [(k, k, k) for k in COLOR_HEX])
        bekannt = lists.get(farbliste, set())
    COLORS.clear()
    COLORS.update({k: v for k, v in COLOR_HEX.items() if k in bekannt})
    print(f"Modell: vorhanden oder ergänzt (Farben aus der Liste {farbliste}: {len(COLORS)})")


# ---------------------------------------------------------------- Baum: wiederverwenden statt doppelt anlegen

def wurzel() -> None:
    """Die Wurzel des Pflegebaums (g-mastertree); gibt es sie nicht, die erste Gruppe ohne Vater."""
    global ROOT
    rows = API.get("/api/tree")
    if any(n["id"] == ROOT for n in rows):
        return
    andere = [n for n in rows if not n.get("parent") and n.get("role") == "group"]
    if not andere:
        sys.exit("Kein Pflegebaum in dieser Instanz: es gibt keine Gruppe ohne Vater.")
    ROOT = andere[0]["id"]
    print(f"Wurzel: {andere[0].get('label')} ({ROOT})")


API = None   # die Verbindung dieses Laufs (für wurzel)


class Baum:
    """Die Zeilen von /api/tree, ergänzt um das, was dieser Lauf anlegt."""
    def __init__(self, api: Api):
        self.api = api
        self.rows = api.get("/api/tree")

    def kind(self, parent: str, role: str, label: str) -> str | None:
        return next((n["id"] for n in self.rows if n.get("parent") == parent and n.get("role") == role and (n.get("label") or "") == label), None)

    def kinder(self, parent: str, role: str) -> list:
        return [n for n in self.rows if n.get("parent") == parent and n.get("role") == role]

    def gruppe(self, parent: str, de: str, en: str) -> str:
        if (da := self.kind(parent, "group", de)):
            return da
        neu = self.api.created("/api/groups", {"parent": parent, "label": labels(de, en)})
        self.rows.append({"id": neu, "parent": parent, "role": "group", "label": de})
        return neu

    def merke(self, id_: str, parent: str, role: str, label: str) -> None:
        self.rows.append({"id": id_, "parent": parent, "role": role, "label": label})


def gruppen_anhaengen(api: Api, node: str, attributes: list[str]) -> None:
    """Hängt an node die Attributgruppen, ohne die ein Demo-Attribut auf diesem Pfad nicht gälte (je Attribut seine erste Gruppe)."""
    model = api.get("/api/model")
    attrs = model["attributes"] if isinstance(model["attributes"], list) else list(model["attributes"].values())
    gruppen_von = {a["key"]: (a.get("groups") or [a.get("group")]) for a in attrs}
    gilt = {g["key"] for g in (api.get(f"/api/nodes/{node}").get("groups") or []) if isinstance(g, dict) and g.get("key")}
    eigen = [x for x in (next((n.get("groups") for n in api.get("/api/tree") if n["id"] == node), None) or "").split(",") if x]
    dazu = []
    for key in attributes:
        gs = [g for g in gruppen_von.get(key, []) if g]
        if gs and not any(g in gilt for g in gs) and gs[0] not in dazu:
            dazu.append(gs[0])
    if dazu:
        api.put(f"/api/nodes/{node}/groups", {"groups": eigen + dazu})
        print(f"  Attributgruppen angehängt: {', '.join(dazu)}")


TANNWALD_ATTRS = ["name", "description", "material", "weight", "brand", "sku", "ean", "price", "size", "shoe_size", "capacity", "color"]
SERVER_ATTRS = ["name", "sku", "ean", "price"]


# ---------------------------------------------------------------- Bilder

def font(size: int):
    for name in ("segoeui.ttf", "arial.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def draw_shape(d: ImageDraw.ImageDraw, shape: str, fill: str, W: int) -> None:
    """Eine schlichte Silhouette je Produktart — erkennbar, aber bewusst kein Foto."""
    line = "#2a2a2a"
    c = W // 2
    if shape == "jacket":
        d.polygon([(c - 150, 180), (c - 60, 140), (c, 175), (c + 60, 140), (c + 150, 180), (c + 200, 320),
                   (c + 140, 340), (c + 130, 560), (c - 130, 560), (c - 140, 340), (c - 200, 320)], fill=fill, outline=line, width=4)
        d.line([(c, 175), (c, 560)], fill=line, width=4)
    elif shape == "trousers":
        d.polygon([(c - 120, 150), (c + 120, 150), (c + 130, 600), (c + 25, 600), (c, 300), (c - 25, 600), (c - 130, 600)], fill=fill, outline=line, width=4)
    elif shape == "shirt":
        d.polygon([(c - 130, 170), (c - 50, 140), (c, 165), (c + 50, 140), (c + 130, 170), (c + 190, 260),
                   (c + 130, 300), (c + 115, 560), (c - 115, 560), (c - 130, 300), (c - 190, 260)], fill=fill, outline=line, width=4)
    elif shape == "hat":
        d.pieslice([c - 170, 200, c + 170, 540], 180, 360, fill=fill, outline=line, width=4)
        d.rectangle([c - 175, 360, c + 175, 430], fill=fill, outline=line, width=4)
        d.ellipse([c - 30, 150, c + 30, 210], fill=fill, outline=line, width=4)
    elif shape == "boot":
        d.polygon([(c - 60, 160), (c + 90, 160), (c + 110, 380), (c + 220, 470), (c + 230, 560), (c - 200, 560), (c - 200, 480), (c - 80, 400)], fill=fill, outline=line, width=4)
        d.rectangle([c - 200, 520, c + 230, 560], fill="#2a2a2a")
    elif shape == "sandal":
        d.rounded_rectangle([c - 110, 150, c + 110, 600], radius=100, fill="#d9c8a6", outline=line, width=4)
        d.line([(c - 100, 300), (c + 100, 380)], fill=fill, width=26)
        d.line([(c - 100, 420), (c + 100, 340)], fill=fill, width=26)
    elif shape == "pack":
        d.rounded_rectangle([c - 150, 170, c + 150, 600], radius=70, fill=fill, outline=line, width=4)
        d.rounded_rectangle([c - 110, 400, c + 110, 580], radius=40, fill="#00000030", outline=line, width=3)
        d.arc([c - 60, 120, c + 60, 220], 180, 360, fill=line, width=10)
    elif shape == "bag":
        d.rounded_rectangle([c - 200, 300, c + 200, 580], radius=30, fill=fill, outline=line, width=4)
        d.arc([c - 110, 190, c + 110, 400], 180, 360, fill=line, width=12)
    elif shape == "tent":
        d.polygon([(c, 170), (c + 300, 560), (c - 300, 560)], fill=fill, outline=line, width=4)
        d.polygon([(c, 170), (c + 80, 560), (c - 80, 560)], fill="#00000035", outline=line, width=3)
    elif shape == "sleepingbag":
        d.rounded_rectangle([c - 120, 140, c + 120, 620], radius=110, fill=fill, outline=line, width=4)
        d.ellipse([c - 70, 170, c + 70, 300], fill="#ffffff70", outline=line, width=3)
    elif shape == "pad":
        d.rounded_rectangle([c - 90, 140, c + 90, 620], radius=30, fill=fill, outline=line, width=4)
        for y in range(190, 600, 60):
            d.line([(c - 85, y), (c + 85, y)], fill=line, width=3)
    elif shape == "stove":
        d.rectangle([c - 40, 380, c + 40, 560], fill="#8a8f94", outline=line, width=4)
        d.ellipse([c - 120, 300, c + 120, 400], fill=fill, outline=line, width=4)
        for i in range(6):
            a = i * math.pi / 3
            d.line([(c, 350), (c + int(90 * math.cos(a)), 350 + int(35 * math.sin(a)))], fill="#e6b422", width=6)
    elif shape == "bottle":
        d.rounded_rectangle([c - 90, 220, c + 90, 620], radius=45, fill=fill, outline=line, width=4)
        d.rectangle([c - 45, 150, c + 45, 230], fill="#3a3d40", outline=line, width=4)
    elif shape == "lamp":
        d.ellipse([c - 230, 200, c + 230, 560], outline=fill, width=34)
        d.rounded_rectangle([c - 90, 160, c + 90, 300], radius=25, fill="#3a3d40", outline=line, width=4)
        d.ellipse([c - 45, 185, c + 45, 275], fill="#fff4b0", outline=line, width=3)
    elif shape == "poles":
        for x in (c - 60, c + 60):
            d.line([(x, 150), (x, 610)], fill=fill, width=14)
            d.rounded_rectangle([x - 22, 130, x + 22, 220], radius=12, fill="#b58b5a", outline=line, width=3)
            d.ellipse([x - 30, 520, x + 30, 560], outline=line, width=4)


def make_image(shape: str, color_key: str, name_de: str, sku: str) -> bytes:
    W = 800
    img = Image.new("RGB", (W, W), "#f5f3ee")
    d = ImageDraw.Draw(img, "RGBA")
    d.rectangle([0, 0, W, 90], fill="#2f4f3e")
    d.text((30, 26), BRAND.upper(), fill="#f5f3ee", font=font(34))
    d.text((W - 260, 34), "DEMO · KEIN ECHTES PRODUKT", fill="#c9d6cf", font=font(18))
    draw_shape(d, shape, COLOR_HEX.get(color_key, "#888888"), W)
    d.text((30, 690), name_de, fill="#2a2a2a", font=font(36))
    d.text((30, 740), sku, fill="#6b6b6b", font=font(24))
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    return buf.getvalue()


# ---------------------------------------------------------------- Daten

def ean13(seed: str) -> str:
    """EAN mit Präfix 20 (interner Bereich, nie eine echte Vergabe) und gültiger Prüfziffer."""
    digits = "20" + str(int(hashlib.sha1(seed.encode()).hexdigest(), 16) % 10**10).zfill(10)
    s = sum(int(d) * (1 if i % 2 == 0 else 3) for i, d in enumerate(digits))
    return digits + str((10 - s % 10) % 10)


def description(de_type: str, en_type: str, model: str, mat: tuple[str, str], rnd: random.Random) -> tuple[str, str]:
    i = rnd.randrange(len(USES_DE))
    de = (f"<p>Die {de_type} <b>{model}</b> ist gemacht {USES_DE[i]}. {mat[0]}. "
          f"Geprüft nach den Standards der Tannwald-Werkstatt, mit fünf Jahren Garantie.</p>")
    en = (f"<p>The {model} {en_type.lower()} is made {USES_EN[i]}. {mat[1]}. "
          f"Tested to Tannwald workshop standards and covered by a five-year warranty.</p>")
    return de, en


def build(api: Api, out_dir: str | None, want: int) -> None:
    rnd = random.Random(SEED)
    ensure_model(api)
    baum = Baum(api)
    wurzel()
    da = baum.kind(ROOT, "group", f"{BRAND} Outdoor")
    brand_group = baum.gruppe(ROOT, f"{BRAND} Outdoor", f"{BRAND} Outdoor")
    print(f"Gruppe {BRAND} Outdoor: {brand_group}" + (" (vorhanden, der Lauf knüpft an)" if da else ""))
    gruppen_anhaengen(api, brand_group, TANNWALD_ATTRS)
    api.set_value(brand_group, "brand", BRAND)
    skipped = 0

    scale = want / sum(sg[3] for group in SUBGROUPS.values() for sg in group)
    counts = {"groups": 1, "products": 0, "variants": 0, "media": 0}
    model_i = 0
    sku_no = 1000

    for top_key, (top_de, top_en) in TOPGROUPS.items():
        top = baum.gruppe(brand_group, top_de, top_en)
        counts["groups"] += 1
        for (sg_de, sg_en, axes, n, type_de, type_en, palette, price_range, weight_range, material, shape) in SUBGROUPS[top_key]:
            sub = baum.gruppe(top, sg_de, sg_en)
            counts["groups"] += 1
            n = max(1, round(n * scale))
            prefix = "".join(w[0] for w in sg_en.split() if w[0].isalpha()).upper()[:3]
            for k in range(n):
                model = MODELS[model_i % len(MODELS)] + ("" if model_i < len(MODELS) else f" {model_i // len(MODELS) + 1}")
                model_i += 1
                name_de, name_en = f"{model} {type_de}", f"{model} {type_en}"
                # dieselben Zufallszahlen wie im ersten Lauf: auch ein übersprungenes Produkt zieht seine Beschreibung
                if baum.kind(sub, "product", name_de):
                    description(type_de, type_en, model, material, rnd)
                    skipped += 1
                    continue
                achsen = [x for x in axes if x != "color" or colors != [None]]
                product = api.created("/api/products", {"group": sub, "axes": achsen or None})
                baum.merke(product, sub, "product", name_de)
                counts["products"] += 1
                api.set_value(product, "name", name_de, locale="de")
                api.set_value(product, "name", name_en, locale="en")
                de, en = description(type_de, type_en, model, material, rnd)
                api.set_value(product, "description", de, locale="de", channel="web")
                api.set_value(product, "description", en, locale="en", channel="web")
                api.set_value(product, "material", material[0], locale="de")
                api.set_value(product, "material", material[1], locale="en")
                api.set_value(product, "weight", f"{rnd.uniform(*weight_range):.2f}")
                status = rnd.choices(["active", "draft", "discontinued"], weights=[85, 10, 5])[0]
                if status != "draft":
                    api.soft_post(f"/api/nodes/{product}/status", {"status": status})

                # Varianten: 1–3 Farben × 1–3 Grössen, höchstens 6
                pal = [x for x in palette if x in COLORS] or list(COLORS)[:3]
                colors = rnd.sample(pal, min(len(pal), rnd.randint(1, 3))) if "color" in axes and pal else [None]
                if "size" in axes:
                    seconds = [k for k, _ in rnd.sample(SIZES[1:5], rnd.randint(1, 3))]
                elif "shoe_size" in axes:
                    seconds = [k for k, _ in rnd.sample(SHOE_SIZES[2:8], rnd.randint(2, 3))]
                elif "capacity" in axes:
                    seconds = [k for k, _, _ in rnd.sample(CAPACITIES, rnd.randint(1, 2))]
                else:
                    seconds = [None]
                second_axis = next((a for a in axes if a != "color"), None)
                base_price = round(rnd.uniform(*price_range)) - 0.05
                combos = [(c, s) for c in colors for s in seconds][:6]
                for color, second in combos:
                    axis_values = {}
                    if color: axis_values["color"] = color
                    if second_axis and second: axis_values[second_axis] = second
                    variant = api.created("/api/variants", {"product": product, "axisValues": axis_values})
                    counts["variants"] += 1
                    sku_no += 1
                    sku = f"TW-{prefix}-{sku_no}" + (f"-{color[:3].upper()}" if color else "") + (f"-{second.upper()}" if second else "")
                    api.set_value(variant, "sku", sku)
                    api.set_value(variant, "ean", ean13(sku))
                    surcharge = 0 if second in (None, "xs", "s", "m", "c050", "c075") else 5
                    api.set_value(variant, "price", f"{base_price + surcharge:.2f}")

                # Bild je Produkt in der ersten Farbe, an die Varianten vererbt
                first_color = colors[0] or "anthracite"
                png = make_image(shape, first_color, name_de, f"TW-{prefix}-{sku_no}")
                if out_dir:
                    with open(os.path.join(out_dir, f"{product}.png"), "wb") as f:
                        f.write(png)
                media = api.post("/api/media", files={"file": (f"{model.lower().replace(' ', '-')}-{shape}.png", png, "image/png")})
                media_id = media["id"]
                counts["media"] += 1
                api.soft_post(f"/api/media/{media_id}/attributes", {"attribute": "alt_text", "locale": "de", "value": f"{name_de} in {first_color}"})
                api.soft_post(f"/api/media/{media_id}/attributes", {"attribute": "alt_text", "locale": "en", "value": f"{name_en} in {first_color}"})
                api.soft_post(f"/api/media/{media_id}/attributes", {"attribute": "copyright", "value": f"{BRAND} Demo — generiert"})
                rel = api.call("POST", "/api/relations", soft=True, json={"type": "image", "from": product, "to": media_id})
                if rel:
                    api.soft_post(f"/api/relations/{rel['stream']}/attributes", {"attribute": "inherit", "value": "true"})
                    api.soft_post(f"/api/relations/{rel['stream']}/attributes", {"attribute": "position", "value": "1"})

                if counts["products"] % 10 == 0:
                    print(f"  {counts['products']} Produkte, {counts['variants']} Varianten, {api.calls} Aufrufe", flush=True)

    print(f"fertig: {counts['groups']} Gruppen, {counts['products']} Produkte, {counts['variants']} Varianten, "
          f"{counts['media']} Bilder, {api.calls} Aufrufe" + (f"; {skipped} Produkte gab es schon" if skipped else ""))
    health = api.get("/api/health")
    print(f"Journal-Kopf jetzt #{health.get('head')}, Knoten {health.get('nodes')}")


# ---------------------------------------------------------------- Beispiel: Konfigurator

SERVER_GROUP = "Server-Konfigurator (Demo)"
SERVER_SUBGROUPS = [
    ("mainboards", "Mainboards", "Mainboards"), ("cpus", "Prozessoren", "Processors"), ("ram", "Arbeitsspeicher", "Memory"),
    ("cooling", "Kühlung", "Cooling"), ("cards", "Erweiterungskarten", "Expansion cards"), ("gpus", "Grafikkarten", "Graphics cards"),
    ("psus", "Netzteile", "Power supplies"),
]
# Die Konfiguratorgruppen: Schlüssel → (Bezeichnung, alle Werte gleich)
SERVER_GROUPS = {
    "cpu_sockel": ("CPU-Sockel", False),
    "pci": ("PCI-Steckplätze", False),
    "kuehlpaste": ("Kühlpaste", False),
    "cpu_typ": ("Nur ein CPU-Typ", True),
    "ram": ("RAM-Kapazität (GB)", False),
}


def server_parts() -> list:
    """(Schlüssel, Untergruppe, Name de, Name en, SKU, Preis, Zeilen als Funktion der Ids) — erfundene Teile, keine echten Produkte."""
    def cpu(typ: str, mit_basis: bool):
        def rows(ids):
            r = [{"group": "cpu_sockel", "consumes": 1}, {"group": "kuehlpaste", "consumes": 1}, {"group": "cpu_typ", "value": typ}]
            if mit_basis:   # mit diesem Mainboard stellt die CPU zwei PCI-Steckplätze bereit
                r.append({"group": "pci", "provides": 2, "when": {"kind": "has", "selector": {"node": ids["mb_basis"]}, "value": 1}})
            return r
        return rows

    parts = [
        ("mb_basis", "mainboards", "Basis 2S Mainboard", "Basis 2S mainboard", "SRV-MB-BASIS2S", 389,
         lambda ids: [{"group": "cpu_sockel", "provides": 2}, {"group": "pci", "provides": 4},
                      {"group": "ram", "min": 2, "max": 2, "values": ["8", "32"]}]),
        ("mb_maxi", "mainboards", "Maxi 4S Mainboard", "Maxi 4S mainboard", "SRV-MB-MAXI4S", 899,
         lambda ids: [{"group": "cpu_sockel", "provides": 4}, {"group": "pci", "provides": 6},
                      {"group": "ram", "min": 4, "max": 8, "values": ["16", "32", "64"]}]),
        ("cpu_silber", "cpus", "Nordkern Silber 16 Prozessor", "Nordkern Silver 16 processor", "SRV-CPU-S16", 420, cpu("silber-cpu", True)),
        ("cpu_gold", "cpus", "Nordkern Gold 32 Prozessor", "Nordkern Gold 32 processor", "SRV-CPU-G32", 1190, cpu("gold-cpu", False)),
    ]
    for gb, preis in ((2, 19), (4, 29), (8, 45), (16, 79), (32, 149), (64, 289)):
        parts.append((f"ram_{gb}", "ram", f"RAM-Baustein {gb} GB", f"RAM module {gb} GB", f"SRV-RAM-{gb}", preis,
                      lambda ids, gb=gb: [{"group": "ram", "value": str(gb)}]))
    parts += [
        ("paste", "cooling", "Wärmeleitpaste, 4er-Set", "Thermal paste, set of 4", "SRV-PASTE-4", 12,
         lambda ids: [{"group": "kuehlpaste", "provides": 4}]),
        ("karte_exp", "cards", "PCIe-Erweiterung", "PCIe expansion", "SRV-PCI-EXP", 89,
         lambda ids: [{"group": "pci", "consumes": 1, "provides": 3}]),   # braucht einen Steckplatz, stellt drei bereit
        ("karte_net", "cards", "Netzwerkkarte 10G", "Network card 10G", "SRV-NIC-10G", 149,
         lambda ids: [{"group": "pci", "consumes": 1}]),
        ("gpu", "gpus", "Compute-Karte 24 GB", "Compute card 24 GB", "SRV-GPU-24", 1790,
         lambda ids: [{"group": "pci", "consumes": 1}]),
        ("psu", "psus", "Netzteil 1200 W", "Power supply 1200 W", "SRV-PSU-1200", 239, lambda ids: []),
    ]
    return parts


def plugin_data(api: Api, name: str, body) -> None:
    api.put(f"/api/plugins/configurator/data/{name}", body)


def build_konfigurator(api: Api) -> None:
    code, antwort = api.probe("GET", "/api/configurator")
    if code != 200:
        print(f"Konfigurator übersprungen: das Plugin ist nicht da, aus oder nicht im Tarif ({code}: {antwort.get('error') if isinstance(antwort, dict) else antwort}).")
        return
    wurzel()
    baum = Baum(api)
    da = baum.kind(ROOT, "group", SERVER_GROUP)
    top = baum.gruppe(ROOT, SERVER_GROUP, "Server configurator (demo)")
    print(f"Gruppe {SERVER_GROUP}: {top}" + (" (vorhanden, der Lauf knüpft an)" if da else ""))
    gruppen_anhaengen(api, top, SERVER_ATTRS)
    subs = {}
    for key, de, en in SERVER_SUBGROUPS:
        subs[key] = baum.gruppe(top, de, en)

    ids: dict = {}
    parts = server_parts()
    for key, sub, de, en, sku, price, _rows in parts:
        product = baum.kind(subs[sub], "product", de)
        if not product:
            product = api.created("/api/products", {"group": subs[sub], "axes": None})
            baum.merke(product, subs[sub], "product", de)
        ids[key] = product
        api.set_value(product, "name", de, locale="de")
        api.set_value(product, "name", en, locale="en")
        varianten = baum.kinder(product, "variant")
        variant = varianten[0]["id"] if varianten else api.created("/api/variants", {"product": product, "axisValues": {}})   # gewählt wird die Variante, ihre SKU nennt der Shop
        api.set_value(variant, "sku", sku)
        api.set_value(variant, "ean", ean13(sku))
        api.set_value(variant, "price", f"{price:.2f}")
    print(f"  {len(parts)} Teile")

    for key, (label, equal) in SERVER_GROUPS.items():
        body: dict = {"label": label}
        if equal:
            body["equal"] = True
        plugin_data(api, f"group:{key}", body)
    for key, _sub, _de, _en, _sku, _price, rows in parts:
        zeilen = rows(ids)
        if zeilen:
            plugin_data(api, f"member:{ids[key]}", {"rows": zeilen})   # am Produkt: die Variante nimmt die Zeilen ihres Produkts

    definition = {
        "label": "Server", "root": top,
        "rules": [
            {"id": "mb-max", "text": "Höchstens ein Mainboard", "then": {"kind": "limits", "selector": {"node": subs["mainboards"]}, "max": 1}},
            {"id": "gpu-psu", "text": "Eine Compute-Karte braucht ein Netzteil",
             "if": {"kind": "has", "selector": {"node": subs["gpus"]}, "value": 1},
             "then": {"kind": "requires", "selector": {"node": subs["psus"]}, "min": 1}},
        ],
        "limits": [{"group": "ram", "max": 8}],
    }
    plugin_data(api, "def:server", definition)
    print("  Konfigurator „server“ mit 2 Regeln, 1 Grenze und 5 Gruppen")

    # Probe: Mainboard Basis, eine Silber-CPU, Kühlpaste, zwei Bausteine mit 8 GB — das muss gehen
    auswahl = [{"id": "SRV-MB-BASIS2S"}, {"id": "SRV-CPU-S16"}, {"id": "SRV-PASTE-4"}, {"id": "SRV-RAM-8", "amount": 2}]
    code, r = api.probe("POST", "/api/configurator/server/check", json={"selection": auswahl})
    if code == 200:
        print(f"  Probe: zulässig {r.get('valid')}, vollständig {r.get('complete')}")
        if not (r.get("valid") and r.get("complete")):
            print(f"  Achtung, die Probe geht nicht auf: {r.get('violations')} {r.get('missing')}")
    else:
        print(f"  Probe nicht möglich ({code}): {r}")


# ---------------------------------------------------------------- Beispiel: Skript

SCRIPT_KEY = "konfiguratorgruppen"
SCRIPT_SOURCE = """export const meta = {
  label: 'Konfiguratorgruppen: Mitglieder je Gruppe',
  params: [
    { key: 'filter', label: 'Teil des Gruppenschlüssels', type: 'text', default: '' },
    { key: 'mindestens', label: 'Mindestens so viele Mitglieder', type: 'number', default: '0' },
  ],
}

// Liest die Konfiguratorgruppen und zählt je Gruppe die Mitglieder und die Teile, die ihr eine Vorgabe machen.
export default async (ctx) => {
  const antwort = await ctx.api.get('/api/configurator-groups')
  const filter = String(ctx.params.filter || '').toLowerCase()
  const mindestens = Number(ctx.params.mindestens) || 0
  const gibtVor = {}
  for (const teil of antwort.parts || [])
    for (const z of teil.rows || [])
      if (z.min != null || z.max != null || (z.values || []).length) gibtVor[z.group] = (gibtVor[z.group] || 0) + 1
  const zeilen = (antwort.groups || [])
    .filter((g) => g.key.toLowerCase().includes(filter) && g.members >= mindestens)
    .map((g) => [g.key, g.label || '', g.equal ? 'ja' : 'nein', g.members, gibtVor[g.key] || 0])
  if (!zeilen.length) return ctx.out.text('Keine Gruppe gefunden.')
  return ctx.out.table(['Gruppe', 'Bezeichnung', 'Gleiche Werte', 'Mitglieder', 'Vorgaben'], zeilen)
}
"""


def build_skript(api: Api) -> None:
    code, liste = api.probe("GET", "/api/scriptum/scripts")
    if code != 200:
        print(f"Skript übersprungen: das Plugin ist nicht da, aus oder nicht im Tarif ({code}).")
        return
    if any(x.get("key") == SCRIPT_KEY for x in liste or []):
        print(f"Skript übersprungen: „{SCRIPT_KEY}“ gibt es schon.")
        return
    body = {
        "label": "Konfiguratorgruppen: Mitglieder je Gruppe", "role": "reader", "run": "read", "source": SCRIPT_SOURCE,
        "note": "Beispiel: liest die Konfiguratorgruppen über die Schnittstelle und zeigt sie als Tabelle.",
        "params": [
            {"key": "filter", "label": "Teil des Gruppenschlüssels", "type": "text", "default": ""},
            {"key": "mindestens", "label": "Mindestens so viele Mitglieder", "type": "number", "default": "0"},
        ],
    }
    code, antwort = api.probe("PUT", f"/api/scriptum/scripts/{SCRIPT_KEY}", json=body)
    if code == 400 and "Rolle" in str(antwort):   # die Rolle „reader“ gibt es in dieser Instanz nicht: das Skript läuft dann mit der Vorgabe
        body.pop("role")
        code, antwort = api.probe("PUT", f"/api/scriptum/scripts/{SCRIPT_KEY}", json=body)
    if code != 200:
        print(f"Skript nicht angelegt ({code}): {antwort}")
        return
    print(f"Skript „{SCRIPT_KEY}“ angelegt (freigegeben für das Recht „read“); ausführen unter Werkzeuge → Skripte")


def main() -> None:
    # Die Konsole unter Windows schreibt sonst in cp1252 und bricht an Zeichen wie „→“ ab
    for strom in (sys.stdout, sys.stderr):
        try:
            strom.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass
    p = argparse.ArgumentParser(description="Demo-MasterTree für journali anlegen (erfundene Marke Tannwald).")
    p.add_argument("--url", default="http://localhost:5000")
    p.add_argument("--user", help="Anwender für die Anmeldung (Passwort aus JOURNALI_DEMO_PASSWORD oder --password)")
    p.add_argument("--password")
    p.add_argument("--token", help="API-Token jt_… statt Anmeldung")
    p.add_argument("--actor", default="demo", help="Kopf X-Actor (offene Instanz ohne Anwender)")
    p.add_argument("--products", type=int, default=200, help="ungefähre Anzahl Produkte (Vorgabe 200)")
    p.add_argument("--images-dir", help="generierte PNGs zusätzlich hier ablegen")
    p.add_argument("--log", help="jede Anfrage mit Antwort in diese Datei schreiben")
    p.add_argument("--nur-beispiele", action="store_true", help="nur das Konfigurator-Beispiel und das Beispielskript (der Tannwald-Teil läuft schon)")
    p.add_argument("--ohne-beispiele", action="store_true", help="nur den Tannwald-Teil")
    a = p.parse_args()
    if a.nur_beispiele and a.ohne_beispiele:
        sys.exit("--nur-beispiele und --ohne-beispiele schliessen sich aus.")

    global API
    url = a.url
    while True:
        try:
            requests.get(url.rstrip("/") + "/api/health", timeout=10)
            break
        except requests.RequestException:
            neu = input(f"{url} antwortet nicht. Adresse der Instanz (leer = abbrechen): ").strip()
            if not neu:
                sys.exit("Abgebrochen.")
            url = neu if neu.startswith("http") else "http://" + neu
    api = Api(url, a.actor, a.token)
    API = api
    if a.log:
        api.log = open(a.log, "w", encoding="utf-8")
    user = a.user
    if not user and not a.token:
        code, _ = api.probe("GET", "/api/tree")
        if code == 401:
            user = input("Anwender: ").strip()
    if user:
        pw = a.password or os.environ.get("JOURNALI_DEMO_PASSWORD") or getpass.getpass(f"Passwort für {user}: ")
        api.login(user, pw)
        api.s.headers["X-Actor"] = user
    health = api.get("/api/health")
    print(f"Instanz {url}: Version {health.get('version')}, Journal-Kopf #{health.get('head')}, Knoten {health.get('nodes')}")
    if a.images_dir:
        os.makedirs(a.images_dir, exist_ok=True)
    if a.nur_beispiele:
        ensure_model(api)   # die Beispiele brauchen price (und die Listen daneben)
    else:
        build(api, a.images_dir, a.products)
    if not a.ohne_beispiele:
        build_konfigurator(api)
        build_skript(api)
    if api.fehler:
        print(f"Übersprungen, weil es in dieser Datenbank nicht passt ({sum(api.fehler.values())}):")
        for msg, n in sorted(api.fehler.items(), key=lambda x: -x[1])[:15]:
            print(f"  {n} × {msg}")
    print("Fertig. Ein weiterer Lauf knüpft an und legt nichts doppelt an.")


if __name__ == "__main__":
    main()
