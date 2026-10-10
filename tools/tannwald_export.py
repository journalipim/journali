#!/usr/bin/env python3
"""
Tannwald für die Demo (10.10.2026): lässt den Tannwald-Teil von demo_master_tree.py gegen eine Instanz laufen, die nur mitschreibt,
und legt das Ergebnis als Journali.Server/demo-tannwald.json ab. Der Server der Demo (JOURNALI_DEMO=1) liest die Datei beim Start und
schreibt sie über denselben Weg wie jede Pflege (Demo.Tannwald: Modell, Stapelbefehle wie /api/batch, Bilder und Unterlagen).

Die Inhalte bleiben an einer Stelle: tannwald_inhalt.py, tannwald_faq.md und demo_master_tree.py. Nach einer Änderung dort:

  python tools/tannwald_export.py           schreibt die Datei neu
  python tools/tannwald_export.py --check   prüft, ob die Datei zum Generator passt (Rückgabe 1, wenn nicht)

Bilder und PDFs stehen in der Datei nicht als Bytes, sondern als Beschreibung: das Bild als Form, Farbe und Name (gezeichnet von
DemoBilder.Tannwald), das PDF als Folge der Bausteine von pdf_einfach.py (gesetzt von PdfEinfach.cs, Zeile für Zeile wie hier).

Die Ersatz-Instanz beginnt mit dem Modell eines leeren Journals (Model.Seeds) und den GEO-Attributen des Plugins geo; was es in der
Demo schon gibt, überspringt der Server beim Abspielen — wie der Generator gegen eine Instanz, die es schon kennt.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from urllib.parse import unquote

HIER = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HIER)
import demo_master_tree as G   # noqa: E402

ZIEL = os.path.join(HIER, "..", "Journali.Server", "demo-tannwald.json")

# Das Modell eines leeren Journals, soweit der Generator es abfragt (Model.Seeds in Journali.Core), dazu die GEO-Attribute (Plugin geo)
SAAT_GRUPPEN = ["mastergroup", "logistics", "physical", "doc", "relation_component", "media", "relation_media"]
SAAT_ATTRIBUTE = [
    {"key": "name", "type": "text", "group": "mastergroup"},
    {"key": "description", "type": "html", "group": "mastergroup"},
    {"key": "color", "type": "enum", "group": "mastergroup", "list": "color"},
    {"key": "sku", "type": "text", "group": "logistics"},
    {"key": "ean", "type": "text", "group": "logistics"},
    {"key": "weight", "type": "decimal", "group": "physical", "unit": "kg"},
] + [{"key": k, "type": "text", "group": "geo"} for k in ("geo_definition", "geo_description", "geo_faq", "geo_keywords")]
SAAT_FARBEN = ["white", "black", "red", "blue", "green", "yellow", "orange", "grey", "anthracite", "brown", "beige", "ivory", "purple", "pink",
               "magenta", "turquoise", "mint", "navy", "silver", "gold"]
WURZEL_GRUPPEN = ["mastergroup", "logistics", "physical"]


class Mitschrift(G.Api):
    """Eine Instanz, die nur mitschreibt: jede schreibende Anfrage wird ein Schritt, neue Knoten, Medien und Relationen heissen @n1, @m1, @r1."""

    def __init__(self):
        self.calls = 0
        self.log = None
        self.fehler = {}
        self.schritte: list[dict] = []
        self.zaehler = {"n": 0, "m": 0, "r": 0}
        self.medien: dict[str, str] = {}          # Hash des Inhalts → @m (gleicher Inhalt, ein Medium — wie der Medienspeicher)
        self.einheiten: set[str] = set()
        self.gruppen: dict[str, dict] = {g: {"key": g, "defined": True} for g in SAAT_GRUPPEN + ["geo"]}
        self.attribute: dict[str, dict] = {a["key"]: dict(a) for a in SAAT_ATTRIBUTE}
        self.listen: dict[str, set] = {"color": set(SAAT_FARBEN)}
        self.sichten: dict[str, dict] = {}
        self.baum: list[dict] = [{"id": G.ROOT, "parent": None, "role": "group", "label": "MasterTree", "groups": ",".join(WURZEL_GRUPPEN)}]
        self.relationen: dict[str, list] = {}

    # ---- Hilfen
    def neu(self, art: str) -> str:
        self.zaehler[art] += 1
        return f"{art}{self.zaehler[art]}"

    def schritt(self, op: str, ref: str | None = None, **args) -> None:
        s = {"op": op}
        if ref:
            s["ref"] = ref
        s["args"] = {k: v for k, v in args.items() if v is not None}
        self.schritte.append(s)

    def knoten(self, id_: str) -> dict | None:
        return next((n for n in self.baum if n["id"] == id_), None)

    def geltende_gruppen(self, id_: str) -> list[str]:
        aus, n = [], self.knoten(id_)
        while n:
            aus += [g for g in (n.get("groups") or "").split(",") if g and g not in aus]
            n = self.knoten(n["parent"]) if n.get("parent") else None
        return aus

    # ---- die Anfragen des Generators
    def call(self, method: str, path: str, soft: bool = False, **kw):
        self.calls += 1
        body = kw.get("json")
        p = path.split("?")[0]
        if method == "GET":
            return self.lesen(p)
        if method == "PUT" and (m := re.fullmatch(r"/api/model/(units|groups|attributes|lists|views)/([^/]+)", p)):
            return self.modell(m.group(1), unquote(m.group(2)), body)
        if method == "PUT" and (m := re.fullmatch(r"/api/model/lists/([^/]+)/values", p)):
            self.schritt("model.listValues", key=m.group(1), values=body)
            self.listen.setdefault(m.group(1), set()).update(v["value"] for v in body)
            return {}
        if method == "POST" and p == "/api/groups":
            ref = self.neu("n")
            self.schritt("group.create", ref, parent=body["parent"], label=body["label"])
            self.baum.append({"id": "@" + ref, "parent": body["parent"], "role": "group", "label": body["label"]["de"]})
            return {"stream": "@" + ref}
        if method == "POST" and p == "/api/products":
            ref = self.neu("n")
            self.schritt("product.create", ref, group=body["group"], axes=body.get("axes"))
            return {"stream": "@" + ref}
        if method == "POST" and p == "/api/variants":
            ref = self.neu("n")
            self.schritt("variant.create", ref, product=body["product"], axisValues=body["axisValues"])
            return {"stream": "@" + ref}
        if method == "POST" and (m := re.fullmatch(r"/api/nodes/([^/]+)/attributes", p)):
            self.schritt("attribute.set", node=m.group(1), attribute=body["attribute"], locale=body.get("locale"), channel=body.get("channel"),
                         value=body.get("value"), values=body.get("values"))
            return {}
        if method == "POST" and (m := re.fullmatch(r"/api/nodes/([^/]+)/status", p)):
            self.schritt("status.set", node=m.group(1), status=body["status"])
            return {}
        if method == "PUT" and (m := re.fullmatch(r"/api/nodes/([^/]+)/groups", p)):
            self.schritt("groups.attach", node=m.group(1), groups=body["groups"])
            if (n := self.knoten(m.group(1))):
                n["groups"] = ",".join(body["groups"])
            return {}
        if method == "POST" and p == "/api/media":
            name, inhalt, mime = kw["files"]["file"]
            sha = hashlib.sha256(inhalt).hexdigest()
            if sha not in self.medien:
                ref = self.neu("m")
                self.medien[sha] = "@" + ref
                self.schritt("media.create", ref, name=name, mime=mime, **json.loads(inhalt))
            return {"id": self.medien[sha]}
        if method == "POST" and (m := re.fullmatch(r"/api/media/([^/]+)/attributes", p)):
            self.schritt("media.attribute.set", media=m.group(1), attribute=body["attribute"], locale=body.get("locale"), value=body.get("value"))
            return {}
        if method == "POST" and p == "/api/relations":
            ref = self.neu("r")
            self.schritt("relation.create", ref, type=body["type"], **{"from": body["from"], "to": body["to"]})
            self.relationen.setdefault(body["from"], []).append({"id": "@" + ref, "type": body["type"], "to": body["to"]})
            return {"stream": "@" + ref}
        if method == "POST" and (m := re.fullmatch(r"/api/relations/([^/]+)/attributes", p)):
            self.schritt("relation.attribute.set", relation=m.group(1), attribute=body["attribute"], value=body.get("value"))
            return {}
        raise SystemExit(f"Mitschrift: {method} {path} ist nicht vorgesehen.")

    def lesen(self, p: str):
        if p == "/api/model":
            return {"units": [{"key": u} for u in self.einheiten], "groups": list(self.gruppen.values()),
                    "attributes": list(self.attribute.values()),
                    "lists": [{"key": k, "values": [{"value": v} for v in vs]} for k, vs in self.listen.items()],
                    "views": list(self.sichten.values()), "relationTypes": [{"key": "image"}, {"key": "document"}]}
        if p == "/api/tree":
            return [dict(n) for n in self.baum]
        if (m := re.fullmatch(r"/api/nodes/([^/]+)", p)):
            return {"id": m.group(1), "groups": [{"key": g} for g in self.geltende_gruppen(m.group(1))]}
        if (m := re.fullmatch(r"/api/nodes/([^/]+)/relations", p)):
            return {"out": self.relationen.get(m.group(1), [])}
        if p == "/api/health":
            return {"head": None, "nodes": None}
        raise SystemExit(f"Mitschrift: GET {p} ist nicht vorgesehen.")

    def modell(self, art: str, key: str, body: dict):
        self.schritt("model." + {"units": "unit", "groups": "group", "attributes": "attribute", "lists": "list", "views": "view"}[art], key=key, body=body)
        if art == "units":
            self.einheiten.add(key)
        elif art == "groups":
            self.gruppen[key] = {"key": key, "defined": True}
        elif art == "attributes":
            self.attribute[key] = {**self.attribute.get(key, {}), **body, "key": key}
        elif art == "lists":
            self.listen.setdefault(key, set())
        elif art == "views":
            self.sichten[key] = {**body, "key": key}
        return {}


class PdfMitschrift:
    """Statt pdf_einfach.Pdf: schreibt die Bausteine mit; bytes() gibt sie als JSON — PdfEinfach.cs setzt daraus das PDF."""

    def __init__(self, titel: str, kopf: str):
        self.titel, self.kopf, self.teile = titel, kopf, []

    def h1(self, text): self.teile.append(["h1", text])
    def h2(self, text): self.teile.append(["h2", text])
    def p(self, text, groesse=10.5, fett=False): self.teile.append(["p", text])
    def punkte(self, eintraege, groesse=10.5): self.teile.append(["punkte", list(eintraege)])
    def tabelle(self, zeilen, links_breite=170, groesse=10): self.teile.append(["tabelle", [list(z) for z in zeilen]])

    def bytes(self) -> bytes:
        return json.dumps({"pdf": {"titel": self.titel, "kopf": self.kopf, "teile": self.teile}}, ensure_ascii=False, sort_keys=True).encode()


def bild(shape: str, color_key: str, name_de: str, sku: str) -> bytes:
    return json.dumps({"bild": {"form": shape, "farbe": G.COLOR_HEX.get(color_key, "#888888"), "name": name_de, "sku": sku}},
                      ensure_ascii=False, sort_keys=True).encode()


def mitschreiben() -> dict:
    api = Mitschrift()
    G.API = api
    G.Pdf = PdfMitschrift
    G.make_image = bild
    ausgabe = sys.stdout
    sys.stdout = open(os.devnull, "w", encoding="utf-8")   # die Meldungen des Generators gehören zu einem echten Lauf
    try:
        G.build(api, None, 200)
    finally:
        sys.stdout.close()
        sys.stdout = ausgabe
    if api.fehler:
        raise SystemExit(f"Mitschrift: übersprungen {api.fehler}")
    return {"quelle": "tools/tannwald_export.py aus demo_master_tree.py, tannwald_inhalt.py und tannwald_faq.md — nicht von Hand ändern",
            "schritte": api.schritte}


def als_text(daten: dict) -> str:
    # ein Schritt je Zeile: kleine Änderungen am Generator bleiben kleine Änderungen an der Datei
    zeilen = [json.dumps(s, ensure_ascii=False, sort_keys=True) for s in daten["schritte"]]
    return '{"quelle": ' + json.dumps(daten["quelle"], ensure_ascii=False) + ',\n"schritte": [\n' + ",\n".join(zeilen) + "\n]}\n"


def main() -> None:
    for strom in (sys.stdout, sys.stderr):
        try:
            strom.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass
    text = als_text(mitschreiben())
    if "--check" in sys.argv:
        alt = open(ZIEL, encoding="utf-8").read() if os.path.exists(ZIEL) else ""
        if alt != text:
            print(f"{os.path.normpath(ZIEL)} passt nicht zum Generator — python tools/tannwald_export.py schreibt sie neu.")
            sys.exit(1)
        print("passt")
        return
    with open(ZIEL, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    daten = json.loads(text)
    arten = {}
    for s in daten["schritte"]:
        arten[s["op"]] = arten.get(s["op"], 0) + 1
    print(f"{os.path.normpath(ZIEL)}: {len(text) // 1024} KB, {len(daten['schritte'])} Schritte")
    for k, v in sorted(arten.items(), key=lambda x: -x[1]):
        print(f"  {v:6} {k}")


if __name__ == "__main__":
    main()
