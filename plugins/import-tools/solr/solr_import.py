#!/usr/bin/env python3
"""Import aus einem Solr-Kern (infolox/prodexa-Export) nach journali.

Läuft ausserhalb des Servers (plugins laufen nie im Server, CLAUDE.md) und
redet nur über die öffentliche API: GET /api/model, GET /api/tree,
GET /api/nodes/{id}, PUT /api/model/…, POST /api/batch. Nur die
Standardbibliothek — kein pip.

    python solr_import.py --solr <kern-url> list [--root MASTER_ID] [--depth N]
    python solr_import.py --solr <kern-url> import --root MASTER_ID [--target NODE] [--dry-run] [--limit N] [--since ISO]

Abbildung in README.md daneben. Zweiter Lauf = Update: der Knoten wird über die
externe Kennung (solr:<master_id>) gefunden, nur geänderte Werte werden geschrieben.
"""
import argparse
import json
import re
import sys
import urllib.parse
import urllib.request

# Windows-Konsole ist cp1252 — die Symbole ▣ ▦ ◆ brauchen UTF-8.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SYSTEM = "solr"                     # Schlüssel der externen Kennung am Knoten
ROLE = {"group": "group", "product": "product", "productvariant": "variant"}
USER_AGENT = "journali-solr-import"

# Solr-Typsuffix (property__<key>__<suffix>) → journali-Typ, mehrfach, Achse locale
TYPES = {
    "string": ("text", False, True), "multi_string": ("text", True, True),
    "text": ("text", False, True), "url": ("text", False, False),
    "xhtml": ("html", False, True), "multi_xhtml": ("html", True, True),
    "int": ("integer", False, False), "multi_int": ("integer", True, False),
    "long": ("integer", False, False), "multi_long": ("integer", True, False),
    "float": ("decimal", False, False), "multi_float": ("decimal", True, False),
    "double": ("decimal", False, False), "multi_double": ("decimal", True, False),
    "boolean": ("boolean", False, False),
    "date": ("date", False, False), "dateTime": ("date", False, False),
}
# Relationen, Medien, Geometrie: später (docs/pflegestruktur.md, 6)
SKIP_SUFFIX = ("_rel", "image", "file", "json", "loc", "cur", "coordinate")
DEFAULT_SKIP = ["*_finder", "technical_details", "group_title", "prodexa_classification"]


def slug(s):
    """journali-Schlüssel: [a-z][a-z0-9_]* — für immer."""
    k = re.sub(r"[^a-z0-9_]+", "_", s.lower()).strip("_")
    return k if re.match(r"[a-z]", k or "") else "p_" + k


def matches(key, patterns):
    return any(re.fullmatch(p.replace("*", ".*"), key) for p in patterns)


# ---------------------------------------------------------------- HTTP

def get_json(url, headers=None):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json", **(headers or {})})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)


class Solr:
    def __init__(self, core):
        self.core = core.rstrip("/")

    def select(self, q, fq=(), fl="*", rows=500, sort="id asc"):
        """Alle Treffer, seitenweise mit cursorMark (Solr ≥ 4.7)."""
        cursor = "*"
        while True:
            params = [("q", q), ("fl", fl), ("rows", rows), ("sort", sort), ("cursorMark", cursor), ("wt", "json")] + [("fq", f) for f in fq]
            d = get_json(f"{self.core}/select?" + urllib.parse.urlencode(params))
            for doc in d["response"]["docs"]:
                yield doc
            nxt = d.get("nextCursorMark")
            if not nxt or nxt == cursor:
                return
            cursor = nxt

    def one(self, q):
        return next(iter(self.select(q, rows=1)), None)


class Journali:
    def __init__(self, base, actor, dry):
        self.base = base.rstrip("/")
        self.actor = actor
        self.dry = dry
        self.written = 0

    def get(self, path):
        return get_json(self.base + path)

    def send(self, method, path, body):
        if self.dry:
            return None
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(self.base + path, data=data, method=method,
                                     headers={"User-Agent": USER_AGENT, "Content-Type": "application/json", "X-Actor": self.actor})
        try:
            with urllib.request.urlopen(req, timeout=600) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            raise SystemExit(f"journali {e.code} {method} {path}: {e.read().decode('utf-8', 'replace')[:500]}")

    def batch(self, commands):
        """POST /api/batch in Stücken unter der Obergrenze; hält beim ersten Fehler an."""
        for i in range(0, len(commands), 9000):
            chunk = commands[i:i + 9000]
            res = self.send("POST", "/api/batch", {"commands": chunk})
            self.written += len(chunk)
            if res and res.get("error"):
                e = res["error"]
                raise SystemExit(f"Stapel {res['batch']} hielt an bei #{e['index']} {e['op']}: {e['message']}")


# ---------------------------------------------------------------- Solr lesen

def is_node(doc):
    return doc.get("type", "").lower() in ROLE


def subtree(solr, root_master_id, since=None):
    """Alle Baum-Dokumente (group, product, productVariant) unter der Wurzel — inklusive Wurzel."""
    root = solr.one(f"master_id:\"{root_master_id}\" AND (type:group OR type:product OR type:productVariant)")
    if root is None:
        raise SystemExit(f"Solr: kein Baum-Dokument mit master_id {root_master_id}")
    fq = [f"main_path_id:\"{root['id']}\"", "(type:group OR type:product OR type:productVariant)"]
    if since:
        fq.append(f"info__changedOn__dateTime:[{since} TO *]")
    return root, [d for d in solr.select("*:*", fq=fq) if is_node(d)]


def property_defs(solr):
    """Die Attribut-Definitionen der Quelle: type:property → Schlüssel, Label, Sektion (Attributgruppe)."""
    out = {}
    for d in solr.select("type:property", fl="remote_id,name,control__section_id__string,control__section_name__string,sort_nr"):
        key = d.get("remote_id")
        if key:
            out[key] = d
    return out


# ---------------------------------------------------------------- Abbildung

def own_values(doc, skip):
    """Aus einem Solr-Dokument die Werte für journali: (schlüssel, suffix, wert). Mehrfach als Liste."""
    for k, v in doc.items():
        m = re.fullmatch(r"property__(.+?)__(\w+)", k)
        if not m:
            continue
        key, suffix = m.group(1), m.group(2)
        if matches(key, skip) or suffix.endswith(SKIP_SUFFIX) or suffix not in TYPES:
            continue
        if v in (None, "", [], [""]):
            continue
        yield slug(key), suffix, key, v


def as_strings(suffix, v):
    """Wert(e) als String, wie sie im Journal stehen: Datum als JJJJ-MM-TT, bool als true/false."""
    def one(x):
        if isinstance(x, bool):
            return "true" if x else "false"
        if suffix in ("date", "dateTime"):
            return str(x)[:10]
        return str(x)
    return [one(x) for x in v] if isinstance(v, list) else one(v)


def node_commands(doc, node_ref, model, values_seen, skip):
    """attribute.set-Befehle für einen Knoten; values_seen: {(attr, locale)} eigene Werte, die schon so stehen."""
    lang = doc.get("lang") or "de"
    cmds = []

    def put(attr, value, multiple=False):
        d = model["attributes"].get(attr)
        if d is None:
            return
        locale = lang if d.get("perLocale") else None
        args = {"node": node_ref, "attribute": attr, "locale": locale}
        # Erst die Form, die im Journal stünde, dann vergleichen — sonst schreibt jeder Lauf alles neu.
        if multiple or d.get("multiple"):
            args["values"] = value if isinstance(value, list) else [value]
            if values_seen.get((attr, locale)) == args["values"]:
                return
        else:
            args["value"] = value if not isinstance(value, list) else ", ".join(value)
            if values_seen.get((attr, locale)) == args["value"]:
                return
        cmds.append({"op": "attribute.set", "args": args})

    if doc.get("name"):
        put("name", doc["name"])
    if doc.get("description"):
        put("description", doc["description"])
    if doc.get("type", "").lower() == "productvariant" and doc.get("product_number"):
        put("sku", doc["product_number"])
    for attr, suffix, _, v in own_values(doc, skip):
        put(attr, as_strings(suffix, v), multiple=isinstance(v, list))
    return cmds


DEPTH = {"group": 0, "product": 1, "variant": 2}
ROLES = ["group", "product", "variant"]


def ensure_model(j, model, docs, pdefs, skip, verbose):
    """Fehlende Attributgruppen und Attribute anlegen; liefert die Gruppen, die am Wurzelknoten hängen müssen.

    „aktiv ab“ einer neuen Gruppe = die oberste Rolle, an der einer ihrer Werte vorkommt (nur
    Varianten → ab Variante). Eine vorhandene Gruppe, deren „aktiv ab“ tiefer liegt als eine
    Fundstelle, wird angehoben — sonst lehnte der Server den Wert ab."""
    groups_needed = {}   # key → label
    attrs_needed = {}    # key → definition
    top = {}             # Gruppe → oberste Rolle (Tiefe), an der ein Wert vorkommt
    for d in docs:
        role = ROLE[d["type"].lower()]
        for attr, suffix, raw, _ in own_values(d, skip):
            p = pdefs.get(raw)
            section = (p or {}).get("control__section_id__string") or "solr"
            gkey = model["attributes"][attr]["group"] if attr in model["attributes"] else attrs_needed[attr]["group"] if attr in attrs_needed else slug(section)
            top[gkey] = min(top.get(gkey, 9), DEPTH[role])
            if attr in model["attributes"] or attr in attrs_needed:
                continue
            groups_needed[gkey] = (p or {}).get("control__section_name__string") or section
            typ, multiple, per_locale = TYPES[suffix]
            attrs_needed[attr] = {
                "key": attr, "label": {"de": (p or {}).get("name") or raw, "en": (p or {}).get("name") or raw},
                "type": typ, "group": gkey, "axes": ["locale"] if per_locale else None, "multiple": multiple,
            }
    for gkey, label in groups_needed.items():
        if gkey in model["groups"]:
            continue
        active_from = ROLES[top[gkey]] if top.get(gkey, 0) > 0 else None
        if verbose:
            print(f"  + Attributgruppe {gkey} ({label}){' ab ' + active_from if active_from else ''}")
        j.send("PUT", f"/api/model/groups/{gkey}", {"key": gkey, "label": {"de": label, "en": label}, "activeFrom": active_from})
        model["groups"][gkey] = {"key": gkey, "activeFrom": active_from}
    for gkey, t in top.items():
        g = model["groups"].get(gkey)
        if g and g.get("activeFrom") and DEPTH.get(g["activeFrom"], 0) > t:
            active_from = ROLES[t] if t > 0 else None
            if verbose:
                print(f"  ~ Attributgruppe {gkey}: aktiv ab {active_from or 'überall'} (Werte kommen weiter oben vor)")
            j.send("PUT", f"/api/model/groups/{gkey}", {"key": gkey, "label": g.get("label") or {}, "activeFrom": active_from})
            g["activeFrom"] = active_from
    for attr, d in attrs_needed.items():
        if verbose:
            print(f"  + Attribut {attr}: {d['type']}{' ≣' if d['multiple'] else ''} in {d['group']}")
        j.send("PUT", f"/api/model/attributes/{attr}", d)
        model["attributes"][attr] = {"key": attr, "perLocale": bool(d["axes"]), "multiple": d["multiple"], "group": d["group"]}
    used = {model["attributes"][a]["group"] for d in docs for a, *_ in own_values(d, skip) if a in model["attributes"]}
    used |= {model["attributes"][a]["group"] for a in ("name", "description", "sku") if a in model["attributes"]}
    return sorted(g for g in used if g)


# ---------------------------------------------------------------- Relationen (docs/pflegestruktur.md, 18)

REL_POINTER = "component_complex"     # zeigt auf die complex_relation-Dokumente: die Werte der component-Kante
REL_GROUP = "relation_component"      # Gruppe der Werte an der Kante (Saatgut)
REL_CONTROLS = ("quantity", "quantity_min", "quantity_max", "quantity_step", "direction")


def strip_lang(doc_id, lang):
    return doc_id[:-(len(lang) + 1)] if lang and doc_id.endswith("_" + lang) else doc_id


def rel_fields(doc):
    """Kanten eines Dokuments: (typ, roh, [Solr-Ids]) aus property__<k>__(multi_)doc_rel — ohne den Zeiger."""
    out = []
    for k, v in doc.items():
        m = re.fullmatch(r"property__(.+?)__(?:multi_)?doc_rel", k)
        if not m or m.group(1) == REL_POINTER:
            continue
        targets = [t for t in (v if isinstance(v, list) else [v]) if t]
        if targets:
            out.append((slug(m.group(1)), m.group(1), targets))
    return out


def complex_values(cdoc, skip):
    """Werte einer attributierten Kante: control__quantity*/direction und property__* (ohne den Zeiger relation)."""
    for k, v in cdoc.items():
        m = re.fullmatch(r"control__(" + "|".join(REL_CONTROLS) + r")__(\w+)", k)
        if not m:
            m = re.fullmatch(r"property__(.+?)__(\w+)", k)
            if not m or m.group(1) == "relation":
                continue
        raw, suffix = m.group(1), m.group(2)
        if matches(raw, skip) or suffix not in TYPES or v in (None, ""):
            continue
        yield slug(raw), suffix, raw, v


def cmd_relations(solr, args):
    """Kanten der Knoten eines Teilbaums: *_doc_rel als einfache Relation (Typ = Schlüssel), component mit den
    Werten aus complex_relation. Beide Enden müssen importiert sein (Kennung solr:<master_id>)."""
    j = Journali(args.journali, args.actor, args.dry_run)
    skip = DEFAULT_SKIP + (args.skip or [])
    raw_model = j.get("/api/model")
    types = {t["key"]: t for t in raw_model.get("relationTypes", [])}
    attrs = {a["key"]: a for a in raw_model["attributes"]}
    groups = {g["key"] for g in raw_model.get("groups", [])}
    by_ext = {r["external"][SYSTEM]: r["id"] for r in j.get("/api/tree") if r.get("external", {}).get(SYSTEM)}

    root, docs = subtree(solr, args.root, args.since)
    with_rel = [d for d in docs if rel_fields(d)]
    print(f"Solr: {len(docs)} Dokumente unter {root['master_id']}, {len(with_rel)} mit Kanten; journali kennt {len(by_ext)} Knoten")

    # Werte der component-Kanten: die complex_relation-Dokumente, in Stücken
    cids = sorted({c for d in with_rel for c in (d.get(f"property__{REL_POINTER}__multi_doc_rel") or [])})
    complex_by_id = {}
    for i in range(0, len(cids), 100):
        chunk = cids[i:i + 100]
        for c in solr.select("*:*", fq=["id:(" + " OR ".join(f'"{x}"' for x in chunk) + ")"], rows=len(chunk)):
            complex_by_id[c["id"]] = c
    print(f"  {len(complex_by_id)} Kanten mit Werten (complex_relation)")

    # Modell: Typen und Attribute, die fehlen
    if REL_GROUP not in groups:
        j.send("PUT", f"/api/model/groups/{REL_GROUP}", {"key": REL_GROUP, "label": {"de": "Bestandteil", "en": "Component"}})
    new_attrs = {}
    stats = {}
    missing_from = 0
    per_node = {}
    for d in with_rel:
        src = by_ext.get(d["master_id"])
        if not src:
            missing_from += 1
            continue
        existing = {}
        if not args.dry_run or True:
            for r in j.get(f"/api/nodes/{urllib.parse.quote(src)}/relations")["out"]:
                ext = (r.get("external") or {}).get(SYSTEM)
                if ext:
                    existing[ext] = (r["id"], {(v["attribute"], v.get("locale")): (v["values"] if v.get("values") is not None else v.get("value")) for v in r["values"]})
        values_by_target, ext_by_target = {}, {}
        for cid in d.get(f"property__{REL_POINTER}__multi_doc_rel") or []:
            c = complex_by_id.get(cid)
            if not c or not c.get("property__relation__multi_doc_rel"):
                continue
            tgt = c["property__relation__multi_doc_rel"][0]
            values_by_target[tgt] = list(complex_values(c, skip))
            ext_by_target[tgt] = c["master_id"]
        cmds = per_node.setdefault(src, [])
        for typ, raw, targets in rel_fields(d):
            if typ not in types:
                t = {"key": typ, "label": {"de": raw, "en": raw}, "reverse": {"de": raw + " von", "en": raw + " of"}, "group": REL_GROUP if typ == "component" else None}
                if args.verbose:
                    print(f"  + Relationstyp {typ}")
                j.send("PUT", f"/api/model/relations/{typ}", t)
                types[typ] = t
            s = stats.setdefault(typ, {"neu": 0, "gleich": 0, "geaendert": 0, "zielFehlt": 0, "selbst": 0})
            for t in targets:
                to_master = strip_lang(t, d.get("lang"))
                if to_master == d["master_id"]:
                    s["selbst"] += 1
                    continue
                dst = by_ext.get(to_master)
                if not dst:
                    s["zielFehlt"] += 1
                    continue
                vals = values_by_target.get(t, []) if typ == "component" else []
                ext = ext_by_target.get(t) or f"{d['master_id']}>{typ}>{to_master}"
                for key, suffix, raw_key, _ in vals:
                    if key not in attrs and key not in new_attrs:
                        jt, multiple, _pl = TYPES[suffix]
                        new_attrs[key] = {"key": key, "label": {"de": raw_key, "en": raw_key}, "type": jt, "group": REL_GROUP, "multiple": multiple}
                        j.send("PUT", f"/api/model/attributes/{key}", new_attrs[key])
                        attrs[key] = {"key": key, "multiple": multiple, "group": REL_GROUP}
                have = existing.get(ext)
                ref = have[0] if have else f"@r{len(cmds)}"
                if not have:
                    cmds.append({"op": "relation.create", "ref": ref[1:], "args": {"type": typ, "from": src, "to": dst}})
                    cmds.append({"op": "relation.external.link", "args": {"relation": ref, "system": SYSTEM, "id": ext}})
                changed = 0
                for key, suffix, _, v in vals:
                    value = as_strings(suffix, v)
                    a = {"relation": ref, "attribute": key, "locale": None}
                    if attrs[key].get("multiple"):
                        a["values"] = value if isinstance(value, list) else [value]
                    else:
                        a["value"] = ", ".join(value) if isinstance(value, list) else value
                    if have and have[1].get((key, None)) == a.get("values", a.get("value")):
                        continue
                    cmds.append({"op": "relation.attribute.set", "args": a})
                    changed += 1
                if not have:
                    s["neu"] += 1
                elif changed:
                    s["geaendert"] += 1
                else:
                    s["gleich"] += 1
    total = 0
    for src, cmds in per_node.items():
        if cmds and not args.dry_run:
            j.batch(cmds)
        total += len(cmds)
    print(f"  {len(new_attrs)} neue Attribute in {REL_GROUP}: {', '.join(new_attrs) or '—'}")
    for typ, s in sorted(stats.items()):
        print(f"  ⇄ {typ}: neu {s['neu']}, vorhanden {s['gleich']}, geändert {s['geaendert']}, Ziel fehlt {s['zielFehlt']}, auf sich selbst {s['selbst']}")
    mode = "Trockenlauf — nichts geschrieben" if args.dry_run else f"{j.written} Befehle geschrieben"
    print(f"\n{mode}. {total} Befehle für {len(per_node)} Quellknoten; {missing_from} Quellen nicht importiert")


# ---------------------------------------------------------------- Befehle

def cmd_list(solr, args):
    root, docs = subtree(solr, args.root)
    kids = {}
    for d in docs:
        kids.setdefault(d.get("main_parent_id", ""), []).append(d)
    for v in kids.values():
        v.sort(key=lambda d: (d.get("sort_nr", 0), d.get("name") or ""))
    icon = {"group": "▣", "product": "▦", "variant": "◆"}

    def walk(doc, depth):
        role = ROLE[doc["type"].lower()]
        below = kids.get(doc["id"], [])
        n_var = sum(1 for k in below if k["type"].lower() == "productvariant")
        tail = f"  ◆ {n_var}" if n_var else ""
        print(f"{'  ' * depth}{icon[role]} {doc.get('name') or doc['master_id']}  [{doc['master_id']}]{tail}")
        if depth < args.depth:
            for k in below:
                if k["type"].lower() != "productvariant" or args.variants:
                    walk(k, depth + 1)
    walk(root, 0)
    n = {r: sum(1 for d in docs if ROLE[d["type"].lower()] == r) for r in ("group", "product", "variant")}
    print(f"\n▣ {n['group']}  ▦ {n['product']}  ◆ {n['variant']}")


def cmd_import(solr, args):
    j = Journali(args.journali, args.actor, args.dry_run)
    skip = DEFAULT_SKIP + (args.skip or [])
    raw_model = j.get("/api/model")
    model = {"attributes": {a["key"]: a for a in raw_model["attributes"]}, "groups": {g["key"]: g for g in raw_model.get("groups", [])}}
    if not (args.target is None or any(r["id"] == args.target for r in j.get("/api/tree"))):
        raise SystemExit(f"journali: Ziel {args.target} gibt es nicht.")
    tree = j.get("/api/tree")
    by_ext = {r["external"].get(SYSTEM): r for r in tree if r.get("external", {}).get(SYSTEM)}

    root, docs = subtree(solr, args.root, args.since)
    if args.since and root["master_id"] not in {d["master_id"] for d in docs}:
        docs.insert(0, root)
    pdefs = property_defs(solr)
    kids = {}
    for d in docs:
        kids.setdefault(d.get("main_parent_id", ""), []).append(d)
    for v in kids.values():
        v.sort(key=lambda d: (d.get("sort_nr", 0), d.get("name") or ""))

    print(f"Solr: {len(docs)} Dokumente unter {root['master_id']}; journali: {len(by_ext)} Knoten mit Kennung {SYSTEM}")
    print("Modell:")
    groups = ensure_model(j, model, docs, pdefs, skip, verbose=True)

    stats = {"neu": 0, "update": 0, "gleich": 0, "werte": 0}
    products_done = 0

    def existing_values(node_id):
        n = j.get(f"/api/nodes/{urllib.parse.quote(node_id)}")
        return {(v["attribute"], v.get("locale")): (v["values"] if v.get("values") is not None else v.get("value")) for v in n["values"] if not v.get("row")}

    def emit(doc, parent_ref, cmds, refs):
        """Ein Knoten: anlegen oder finden, dann seine Werte. Liefert die Referenz (@ref oder Id) fürs Weitere."""
        role = ROLE[doc["type"].lower()]
        mid = doc["master_id"]
        have = by_ext.get(mid)
        if have:
            ref = have["id"]
            seen = existing_values(ref)
            vals = node_commands(doc, ref, model, seen, skip)
            stats["update" if vals else "gleich"] += 1
        else:
            ref = f"@{mid}"
            refs.add(mid)
            name = doc.get("name") or doc.get("remote_id") or mid
            if role == "group":
                cmds.append({"op": "group.create", "ref": mid, "args": {"parent": parent_ref, "name": name}})
            elif role == "product":
                cmds.append({"op": "product.create", "ref": mid, "args": {"group": parent_ref}})
            else:
                cmds.append({"op": "variant.create", "ref": mid, "args": {"product": parent_ref, "axisValues": {}}})
            cmds.append({"op": "external.link", "args": {"node": ref, "system": SYSTEM, "id": mid}})
            vals = node_commands(doc, ref, model, {}, skip)
            stats["neu"] += 1
        stats["werte"] += len(vals)
        cmds.extend(vals)
        return ref

    # Wurzel und Gruppen in einem Stapel, danach je Produkt ein Stapel (Produkt + Varianten).
    cmds, refs = [], set()
    root_ref = emit(root, args.target, cmds, refs)
    if root["master_id"] not in by_ext:
        cmds.append({"op": "groups.attach", "args": {"node": root_ref, "groups": groups}})
        cmds.append({"op": "label.set", "args": {"node": root_ref, "attribute": "name"}})
    else:
        have = by_ext[root["master_id"]]["groups"] or ""
        merged = sorted(set(have.split(",")) - {""} | set(groups))
        if merged != sorted(set(have.split(",")) - {""}):
            cmds.append({"op": "groups.attach", "args": {"node": root_ref, "groups": merged}})

    product_queue = []   # (doc, parent_ref)

    def walk_groups(doc, ref):
        direct = []
        for k in kids.get(doc["id"], []):
            role = ROLE[k["type"].lower()]
            if role == "group":
                walk_groups(k, emit(k, ref, cmds, refs))
            elif role == "product":
                product_queue.append((k, ref))
            else:
                direct.append(k)
        if direct:
            # Varianten direkt unter einer Gruppe gibt es in journali nicht (Variante hängt unter Produkt):
            # ein Sammelprodukt mit dem Namen der Gruppe, Kennung <gruppe>#variants — beim zweiten Lauf wiedergefunden.
            pseudo = {"id": doc["id"] + "#variants", "master_id": doc["master_id"] + "#variants", "type": "product",
                      "name": doc.get("name") or doc["master_id"], "lang": doc.get("lang"), "main_parent_id": doc["id"]}
            kids[pseudo["id"]] = direct
            product_queue.append((pseudo, ref))
            print(f"  ▦ {pseudo['name']}: Sammelprodukt für {len(direct)} Varianten direkt unter der Gruppe {doc['master_id']}")
    walk_groups(root, root_ref)
    if root["type"].lower() == "product":
        product_queue.insert(0, (root, None))
    print(f"Stapel Gruppen: {len(cmds)} Befehle")
    if cmds and not args.dry_run:
        j.batch(cmds)
        # Nach dem Stapel sind die neuen Gruppen echte Knoten: Kennungen nachladen, damit Produkte darauf zeigen können.
        by_ext.update({r["external"][SYSTEM]: r for r in j.get("/api/tree") if r.get("external", {}).get(SYSTEM)})

    for doc, parent_ref in product_queue:
        if args.limit and products_done >= args.limit:
            break
        pc, prefs = [], set()
        if parent_ref is None:
            pref = emit(doc, args.target, pc, prefs)
        else:
            parent_id = by_ext[parent_ref[1:]]["id"] if parent_ref.startswith("@") and parent_ref[1:] in by_ext else parent_ref
            if parent_id.startswith("@") and args.dry_run:
                parent_id = parent_ref   # im Trockenlauf gibt es die Gruppe noch nicht
            pref = emit(doc, parent_id, pc, prefs)
        for k in kids.get(doc["id"], []):
            if ROLE[k["type"].lower()] == "variant":
                emit(k, pref, pc, prefs)
        products_done += 1
        if pc:
            if not args.dry_run:
                j.batch(pc)
            if args.verbose:
                print(f"  ▦ {doc.get('name') or doc['master_id']}: {len(pc)} Befehle")

    mode = "Trockenlauf — nichts geschrieben" if args.dry_run else f"{j.written} Befehle geschrieben"
    print(f"\n{mode}. Knoten neu {stats['neu']}, geändert {stats['update']}, unverändert {stats['gleich']}; Werte {stats['werte']}; Produkte {products_done}")


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--solr", required=True, help="Kern-URL, z. B. https://host/solr/products")
    ap.add_argument("--journali", default="http://localhost:5000", help="journali-Server (Vorgabe localhost:5000)")
    ap.add_argument("--actor", default="solr-import", help="Kopf X-Actor")
    sub = ap.add_subparsers(dest="cmd", required=True)

    l = sub.add_parser("list", help="Baum der Quelle zeigen")
    l.add_argument("--root", default="node_group_root", help="master_id der Wurzel (Vorgabe node_group_root)")
    l.add_argument("--depth", type=int, default=3)
    l.add_argument("--variants", action="store_true", help="Varianten mit auflisten")

    i = sub.add_parser("import", help="Teilbaum nach journali (zweiter Lauf = Update)")
    i.add_argument("--root", required=True, help="master_id der Solr-Wurzel, die importiert wird (samt allem darunter)")
    i.add_argument("--target", default=None, help="journali-Gruppe, unter die die Wurzel kommt (leer = ganz oben)")
    i.add_argument("--dry-run", action="store_true", help="nur zählen, nichts schreiben")
    i.add_argument("--limit", type=int, default=0, help="höchstens N Produkte (zum Probieren)")
    i.add_argument("--since", help="nur Dokumente mit changedOn ab diesem Zeitpunkt (ISO, z. B. 2026-09-01T00:00:00Z)")
    i.add_argument("--skip", action="append", help="Property-Schlüssel übergehen (Muster mit *), zusätzlich zu " + ", ".join(DEFAULT_SKIP))
    i.add_argument("--verbose", action="store_true")

    r = sub.add_parser("relations", help="Kanten der Knoten eines Teilbaums (zweiter Lauf nach import; beide Enden müssen drin sein)")
    r.add_argument("--root", required=True, help="master_id der Solr-Wurzel")
    r.add_argument("--dry-run", action="store_true")
    r.add_argument("--since", help="nur Dokumente mit changedOn ab diesem Zeitpunkt (ISO)")
    r.add_argument("--skip", action="append", help="Werte-Schlüssel an der Kante übergehen (Muster mit *)")
    r.add_argument("--verbose", action="store_true")

    args = ap.parse_args()
    solr = Solr(args.solr)
    if args.cmd == "list":
        cmd_list(solr, args)
    elif args.cmd == "relations":
        cmd_relations(solr, args)
    else:
        cmd_import(solr, args)


if __name__ == "__main__":
    main()
