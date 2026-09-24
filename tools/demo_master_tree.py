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

Aufruf (gegen eine frische Demo-Instanz, nie gegen die Kundendatenbank):
  python tools/demo_master_tree.py --url http://localhost:5000 --user admin
  Passwort aus der Umgebung JOURNALI_DEMO_PASSWORD oder --password; alternativ --token jt_…
  Ohne Anwender (offene Instanz) reicht --actor.

Bricht ab, wenn unter der Wurzel schon eine Gruppe „Tannwald“ liegt — der Lauf ist einmalig.
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

import requests
from PIL import Image, ImageDraw, ImageFont

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

    def call(self, method: str, path: str, **kw):
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
        if r.status_code >= 400:
            sys.exit(f"{method} {path} → {r.status_code}: {r.text[:300]}")
        return r.json() if r.content else None

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
        self.post(f"/api/nodes/{node}/attributes", body)


# ---------------------------------------------------------------- Modell

def labels(de: str, en: str) -> dict:
    return {"de": de, "en": en}


def ensure_model(api: Api) -> None:
    model = api.get("/api/model")
    attrs = set((model.get("attributes") or {}).keys()) if isinstance(model.get("attributes"), dict) \
        else {a["key"] for a in model.get("attributes") or []}
    lists = set((model.get("lists") or {}).keys()) if isinstance(model.get("lists"), dict) \
        else {l["key"] for l in model.get("lists") or []}

    def list_(key: str, de: str, en: str, values: list[tuple[str, str, str]]) -> None:
        if key not in lists:
            api.put(f"/api/model/lists/{key}", {"key": key, "label": labels(de, en)})
        api.put(f"/api/model/lists/{key}/values",
                [{"value": v, "label": labels(lde, len_), "order": i + 1} for i, (v, lde, len_) in enumerate(values)])

    list_("size", "Grössen", "Sizes", [(k, l, l) for k, l in SIZES])
    list_("shoe_size", "Schuhgrössen", "Shoe sizes", [(k, l, l) for k, l in SHOE_SIZES])
    list_("capacity", "Füllmengen", "Capacities", CAPACITIES)

    def attr(key: str, de: str, en: str, type_: str, **more) -> None:
        if key in attrs:
            return
        api.put(f"/api/model/attributes/{key}", {"key": key, "label": labels(de, en), "type": type_, **more})

    attr("size", "Grösse", "Size", "enum", group="mastergroup", list="size")
    attr("shoe_size", "Schuhgrösse", "Shoe size", "enum", group="mastergroup", list="shoe_size")
    attr("capacity", "Füllmenge", "Capacity", "enum", group="mastergroup", list="capacity")
    attr("brand", "Marke", "Brand", "text", group="mastergroup", inheritable=True)
    attr("material", "Material", "Material", "text", group="mastergroup", axes=["locale"])
    attr("price", "Preis (EUR)", "Price (EUR)", "decimal", group="logistics")
    print("Modell: Listen size, shoe_size, capacity; Attribute size, shoe_size, capacity, brand, material, price")


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
    tree = api.get("/api/tree")
    for n in tree:
        if n.get("parent") == ROOT and n.get("role") == "group" and (n.get("label") or "").startswith(BRAND):
            sys.exit(f"Unter {ROOT} liegt schon „{n['label']}“ ({n['id']}) — der Demo-Lauf ist einmalig.")

    ensure_model(api)

    brand_group = api.created("/api/groups", {"parent": ROOT, "label": labels(f"{BRAND} Outdoor", f"{BRAND} Outdoor")})
    api.set_value(brand_group, "brand", BRAND)
    print(f"Gruppe {BRAND} Outdoor: {brand_group}")

    scale = want / sum(sg[3] for group in SUBGROUPS.values() for sg in group)
    counts = {"groups": 1, "products": 0, "variants": 0, "media": 0}
    model_i = 0
    sku_no = 1000

    for top_key, (top_de, top_en) in TOPGROUPS.items():
        top = api.created("/api/groups", {"parent": brand_group, "label": labels(top_de, top_en)})
        counts["groups"] += 1
        for (sg_de, sg_en, axes, n, type_de, type_en, palette, price_range, weight_range, material, shape) in SUBGROUPS[top_key]:
            sub = api.created("/api/groups", {"parent": top, "label": labels(sg_de, sg_en)})
            counts["groups"] += 1
            n = max(1, round(n * scale))
            prefix = "".join(w[0] for w in sg_en.split() if w[0].isalpha()).upper()[:3]
            for k in range(n):
                model = MODELS[model_i % len(MODELS)] + ("" if model_i < len(MODELS) else f" {model_i // len(MODELS) + 1}")
                model_i += 1
                name_de, name_en = f"{model} {type_de}", f"{model} {type_en}"
                product = api.created("/api/products", {"group": sub, "axes": axes or None})
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
                    api.post(f"/api/nodes/{product}/status", {"status": status})

                # Varianten: 1–3 Farben × 1–3 Grössen, höchstens 6
                colors = rnd.sample(palette, rnd.randint(1, 3)) if "color" in axes else [None]
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
                api.post(f"/api/media/{media_id}/attributes", {"attribute": "alt_text", "locale": "de", "value": f"{name_de} in {first_color}"})
                api.post(f"/api/media/{media_id}/attributes", {"attribute": "alt_text", "locale": "en", "value": f"{name_en} in {first_color}"})
                api.post(f"/api/media/{media_id}/attributes", {"attribute": "copyright", "value": f"{BRAND} Demo — generiert"})
                rel = api.created("/api/relations", {"type": "image", "from": product, "to": media_id})
                api.post(f"/api/relations/{rel}/attributes", {"attribute": "inherit", "value": "true"})
                api.post(f"/api/relations/{rel}/attributes", {"attribute": "position", "value": "1"})

                if counts["products"] % 10 == 0:
                    print(f"  {counts['products']} Produkte, {counts['variants']} Varianten, {api.calls} Aufrufe", flush=True)

    print(f"fertig: {counts['groups']} Gruppen, {counts['products']} Produkte, {counts['variants']} Varianten, "
          f"{counts['media']} Bilder, {api.calls} Aufrufe")
    health = api.get("/api/health")
    print(f"Journal-Kopf jetzt #{health.get('head')}, Knoten {health.get('nodes')}")


def main() -> None:
    p = argparse.ArgumentParser(description="Demo-MasterTree für journali anlegen (erfundene Marke Tannwald).")
    p.add_argument("--url", default="http://localhost:5000")
    p.add_argument("--user", help="Anwender für die Anmeldung (Passwort aus JOURNALI_DEMO_PASSWORD oder --password)")
    p.add_argument("--password")
    p.add_argument("--token", help="API-Token jt_… statt Anmeldung")
    p.add_argument("--actor", default="demo", help="Kopf X-Actor (offene Instanz ohne Anwender)")
    p.add_argument("--products", type=int, default=200, help="ungefähre Anzahl Produkte (Vorgabe 200)")
    p.add_argument("--images-dir", help="generierte PNGs zusätzlich hier ablegen")
    p.add_argument("--log", help="jede Anfrage mit Antwort in diese Datei schreiben")
    a = p.parse_args()

    api = Api(a.url, a.actor, a.token)
    if a.log:
        api.log = open(a.log, "w", encoding="utf-8")
    if a.user:
        pw = a.password or os.environ.get("JOURNALI_DEMO_PASSWORD") or ""
        if not pw:
            sys.exit("Passwort fehlt: --password oder JOURNALI_DEMO_PASSWORD.")
        api.login(a.user, pw)
        api.s.headers["X-Actor"] = a.user
    health = api.get("/api/health")
    print(f"Instanz {a.url}: Version {health.get('version')}, Journal-Kopf #{health.get('head')}, Knoten {health.get('nodes')}")
    if (health.get("nodes") or 0) > 50:
        print("Achtung: diese Instanz hat schon viele Knoten — für die Demo ist eine leere Datenbank gedacht.")
    if a.images_dir:
        os.makedirs(a.images_dir, exist_ok=True)
    build(api, a.images_dir, a.products)


if __name__ == "__main__":
    main()
