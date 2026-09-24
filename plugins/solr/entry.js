(function(){const s=document.createElement('style');s.textContent="\n.x[data-v-34165bad] { border: 0; background: none; color: var(--muted); padding: 0 4px;\n}\n.x[data-v-34165bad]:hover { color: var(--neg);\n}\n.sources[data-v-34165bad] { gap: 4px;\n}\n.form[data-v-34165bad] { padding: 6px 8px; border-bottom: 1px solid var(--line); display: flex; flex-direction: column; gap: 4px;\n}\n.row[data-v-34165bad] { display: flex; gap: 4px;\n}\n.src .node[data-v-34165bad] { display: flex; align-items: center; gap: 4px; height: 24px; white-space: nowrap; padding-right: 8px; outline: none;\n}\n.src .node.on[data-v-34165bad] { background: var(--accent-soft);\n}\n.src .node.current[data-v-34165bad], .src .node[data-v-34165bad]:focus { box-shadow: inset 2px 0 0 var(--accent);\n}\n.twisty[data-v-34165bad] { width: 12px; color: var(--muted); font-size: 11px; cursor: pointer;\n}\n.icon[data-v-34165bad] { width: 16px; text-align: center;\n}\n.node.group .icon[data-v-34165bad] { color: var(--muted);\n}\n.node.product .icon[data-v-34165bad] { color: var(--accent);\n}\n.node.variant .icon[data-v-34165bad] { color: var(--warn);\n}\n.label[data-v-34165bad] { overflow: hidden; text-overflow: ellipsis;\n}\n.count[data-v-34165bad] { margin-left: auto; font-size: 11px;\n}\n.form-grid[data-v-34165bad] { width: 100%;\n}\n.form-grid td[data-v-34165bad] { white-space: normal; vertical-align: middle; height: 30px; padding: 2px 4px;\n}\n.form-grid td[data-v-34165bad]:first-child { padding-left: 8px; white-space: nowrap;\n}\n.form-grid select[data-v-34165bad] { margin-right: 8px; min-width: 220px;\n}\n.val[data-v-34165bad] { max-width: 420px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;\n}\n.section[data-v-34165bad] { padding: 10px 8px; border-top: 1px solid var(--line);\n}\n.section h2[data-v-34165bad] { font-size: 12px; margin: 0 0 6px; color: var(--muted); font-weight: 600;\n}\n";document.head.append(s)})();
const m$1 = window.journali.vue;
const Fragment = m$1.Fragment;
const computed = m$1.computed;
const createBlock = m$1.createBlock;
const createCommentVNode = m$1.createCommentVNode;
const createElementBlock = m$1.createElementBlock;
const createElementVNode = m$1.createElementVNode;
const createTextVNode = m$1.createTextVNode;
const createVNode = m$1.createVNode;
const isRef = m$1.isRef;
const normalizeClass = m$1.normalizeClass;
const normalizeStyle = m$1.normalizeStyle;
const onMounted = m$1.onMounted;
const openBlock = m$1.openBlock;
const ref = m$1.ref;
const renderList = m$1.renderList;
const resolveComponent = m$1.resolveComponent;
const toDisplayString = m$1.toDisplayString;
const unref = m$1.unref;
const vModelText = m$1.vModelText;
const withCtx = m$1.withCtx;
const withDirectives = m$1.withDirectives;
const withKeys = m$1.withKeys;
const withModifiers = m$1.withModifiers;
const h = window.journali;
const api = h.api;
const store = h.store;
const tree = h.tree;
const icon = h.icon;
const paneWidth = h.paneWidth;
const t = h.t;
const Splitter = h.Splitter;
const ImportHead = h.ImportHead;
const TreePicker = h.TreePicker;
const m = window.journali.vueRouter;
const useRouter = m.useRouter;
const SYSTEM = "solr";
const ROLE = { group: "group", product: "product", productvariant: "variant" };
const roleOf = (d) => ROLE[(d.type || "").toLowerCase()];
const isNode = (d) => !!roleOf(d);
const TYPES = {
  string: ["text", false, true],
  multi_string: ["text", true, true],
  text: ["text", false, true],
  url: ["text", false, false],
  xhtml: ["html", false, true],
  multi_xhtml: ["html", true, true],
  int: ["integer", false, false],
  multi_int: ["integer", true, false],
  long: ["integer", false, false],
  multi_long: ["integer", true, false],
  float: ["decimal", false, false],
  multi_float: ["decimal", true, false],
  double: ["decimal", false, false],
  multi_double: ["decimal", true, false],
  boolean: ["boolean", false, false],
  date: ["date", false, false],
  dateTime: ["date", false, false]
};
const SKIP_SUFFIX = ["_rel", "image", "file", "json", "loc", "cur", "coordinate"];
const DEFAULT_SKIP = ["*_finder", "technical_details", "group_title", "prodexa_classification"];
const slug = (s) => {
  const k = s.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  return /^[a-z]/.test(k) ? k : "p_" + k;
};
const matches = (key, patterns) => patterns.some((p) => new RegExp("^" + p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$").test(key));
let seq = 0;
function jsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = "__solr" + ++seq;
    const tag = document.createElement("script");
    const done = () => {
      delete window[cb];
      tag.remove();
      clearTimeout(timer);
    };
    const timer = setTimeout(() => {
      done();
      reject(new Error("Solr: keine Antwort (60 s)"));
    }, 6e4);
    window[cb] = (data) => {
      done();
      resolve(data);
    };
    tag.onerror = () => {
      done();
      reject(new Error("Solr: Anfrage fehlgeschlagen — URL, Netz oder Kern?"));
    };
    tag.src = url + (url.includes("?") ? "&" : "?") + "wt=json&json.wrf=" + cb;
    document.head.appendChild(tag);
  });
}
function solr(core, holen = jsonp) {
  const base = core.replace(/\/+$/, "");
  const NODES = "(type:group OR type:product OR type:productVariant)";
  async function select(q, { fq = [], fl = "*", rows = 500, sort = "sort_nr asc,id asc", cursor = null } = {}) {
    const p = new URLSearchParams({ q, fl, rows, sort });
    for (const f of fq) p.append("fq", f);
    if (cursor) p.set("cursorMark", cursor);
    const d = await holen(`${base}/select?${p}`);
    if (d.error) throw new Error(`Solr: ${d.error.msg}`);
    return d;
  }
  async function all(q, opts = {}, onPage) {
    const out = [];
    let cursor = "*";
    for (; ; ) {
      const d = await select(q, { ...opts, cursor });
      out.push(...d.response.docs);
      onPage?.(out.length, d.response.numFound);
      const next = d.nextCursorMark;
      if (!next || next === cursor) return out;
      cursor = next;
    }
  }
  return {
    status: () => holen(`${base}/admin/ping`).catch(() => null),
    count: async () => (await select("*:*", { rows: 0 })).response.numFound,
    /// Wurzeln des Baums: Baumknoten ohne Eltern.
    roots: async () => (await select(NODES, { fq: ['main_parent_id:""'], rows: 200 })).response.docs.filter(isNode),
    children: async (id) => (await select(NODES, { fq: [`main_parent_id:"${id}"`], rows: 1e3 })).response.docs.filter(isNode),
    doc: async (id) => (await select(`id:"${id}"`, { rows: 1 })).response.docs[0] ?? null,
    /// Dokumente zu Ids, in Stücken (die URL hat Grenzen).
    byIds: async (ids, onPage) => {
      const out = [];
      for (let i = 0; i < ids.length; i += 80) {
        const chunk = ids.slice(i, i + 80);
        out.push(...(await select("*:*", { fq: [`id:(${chunk.map((x) => `"${x}"`).join(" OR ")})`], rows: chunk.length, sort: "id asc" })).response.docs);
        onPage?.(out.length, ids.length);
      }
      return out;
    },
    /// Ein Teilbaum vollständig (inklusive Wurzel) — main_path_id enthält die eigene Id.
    subtree: (rootId, onPage) => all(NODES, { fq: [`main_path_id:"${rootId}"`] }, onPage).then((ds) => ds.filter(isNode)),
    /// Die Attribut-Definitionen der Quelle: remote_id → { name, section, sectionName }.
    propertyDefs: async () => {
      const defs = {};
      for (const d of await all("type:property", { fl: "remote_id,name,control__section_id__string,control__section_name__string", rows: 1e3, sort: "id asc" }))
        if (d.remote_id) defs[d.remote_id] = { name: d.name, section: d.control__section_id__string, sectionName: d.control__section_name__string };
      return defs;
    }
  };
}
function ownValues(doc, skip = DEFAULT_SKIP) {
  const out = [];
  for (const [k, v] of Object.entries(doc)) {
    const m2 = /^property__(.+?)__(\w+)$/.exec(k);
    if (!m2) continue;
    const [, raw, suffix] = m2;
    if (matches(raw, skip) || SKIP_SUFFIX.some((s) => suffix.endsWith(s)) || !TYPES[suffix]) continue;
    if (v == null || v === "" || Array.isArray(v) && !v.some((x) => x !== "")) continue;
    out.push({ key: slug(raw), suffix, raw, value: v });
  }
  return out;
}
function asStrings(suffix, v) {
  const one = (x) => typeof x === "boolean" ? x ? "true" : "false" : suffix === "date" || suffix === "dateTime" ? String(x).slice(0, 10) : String(x);
  return Array.isArray(v) ? v.map(one) : one(v);
}
const DEPTH = { group: 0, product: 1, variant: 2 };
const ROLES = ["group", "product", "variant"];
function modelNeeds(docs, attrs, groups, pdefs, skip) {
  const newGroups = /* @__PURE__ */ new Map();
  const newAttrs = /* @__PURE__ */ new Map();
  const used = /* @__PURE__ */ new Set();
  const counts = /* @__PURE__ */ new Map();
  const top = /* @__PURE__ */ new Map();
  const seen = (gkey, role) => {
    const d = DEPTH[role] ?? 0;
    if (!top.has(gkey) || d < top.get(gkey)) top.set(gkey, d);
  };
  for (const d of docs) for (const { key, suffix, raw } of ownValues(d, skip)) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (attrs.has(key)) {
      used.add(attrs.get(key).group);
      seen(attrs.get(key).group, roleOf(d));
      continue;
    }
    const p = pdefs[raw];
    const gkey = newAttrs.get(key)?.group ?? slug(p?.section || "solr");
    seen(gkey, roleOf(d));
    if (newAttrs.has(key)) continue;
    if (!groups.has(gkey)) newGroups.set(gkey, { label: p?.sectionName || p?.section || "solr", activeFrom: null });
    used.add(gkey);
    const [type, multiple, perLocale] = TYPES[suffix];
    const label = p?.name || raw;
    newAttrs.set(key, { key, label: { de: label, en: label }, type, group: gkey, axes: perLocale ? ["locale"] : null, multiple });
  }
  for (const [gkey, g] of newGroups) {
    const t2 = top.get(gkey) ?? 0;
    g.activeFrom = t2 > 0 ? ROLES[t2] : null;
  }
  const raise = /* @__PURE__ */ new Map();
  for (const [gkey, t2] of top) {
    const g = groups.get(gkey);
    if (g?.activeFrom && DEPTH[g.activeFrom] > t2) raise.set(gkey, t2 > 0 ? ROLES[t2] : null);
  }
  for (const k of ["name", "description", "sku"]) if (attrs.has(k)) used.add(attrs.get(k).group);
  used.delete(void 0);
  used.delete(null);
  used.delete("");
  return { newGroups, newAttrs, raise, used: [...used].sort(), counts };
}
const REL_POINTER = "component_complex";
const REL_GROUP = "relation_component";
const stripLang = (id, lang) => lang && id.endsWith("_" + lang) ? id.slice(0, -(lang.length + 1)) : id;
function relFields(doc) {
  const out = [];
  for (const [k, v] of Object.entries(doc)) {
    const m2 = /^property__(.+?)__(multi_)?doc_rel$/.exec(k);
    if (!m2 || m2[1] === REL_POINTER) continue;
    const targets = (Array.isArray(v) ? v : [v]).filter(Boolean);
    if (targets.length) out.push({ type: slug(m2[1]), raw: m2[1], targets });
  }
  return out;
}
const complexIds = (doc) => {
  const v = doc[`property__${REL_POINTER}__multi_doc_rel`];
  return Array.isArray(v) ? v : v ? [v] : [];
};
function complexValues(cdoc, skip = DEFAULT_SKIP) {
  const out = [];
  for (const [k, v] of Object.entries(cdoc)) {
    let m2 = /^control__(quantity|quantity_min|quantity_max|quantity_step|direction)__(\w+)$/.exec(k);
    if (!m2) {
      m2 = /^property__(.+?)__(\w+)$/.exec(k);
      if (!m2 || m2[1] === "relation") continue;
    }
    const [, raw, suffix] = m2;
    if (matches(raw, skip) || !TYPES[suffix] || v == null || v === "") continue;
    out.push({ key: slug(raw), suffix, raw, value: v });
  }
  return out;
}
function relationNeeds(docs, byExt, complexById, existing, model) {
  const types = new Map((model.relationTypes ?? []).map((t2) => [t2.key, t2]));
  const attrs = new Map(model.attributes.map((a) => [a.key, a]));
  const groups = new Set((model.groups ?? []).map((g) => g.key));
  const newTypes = /* @__PURE__ */ new Map(), newAttrs = /* @__PURE__ */ new Map();
  const perNode = /* @__PURE__ */ new Map();
  const stats = /* @__PURE__ */ new Map();
  const st = (t2) => {
    if (!stats.has(t2)) stats.set(t2, { neu: 0, gleich: 0, geaendert: 0, zielFehlt: 0, selbst: 0 });
    return stats.get(t2);
  };
  let missingFrom = 0, refNo = 0;
  const needGroup = !groups.has(REL_GROUP);
  for (const d of docs) {
    const from = byExt.get(d.master_id);
    const fields = relFields(d);
    if (!fields.length) continue;
    if (!from) {
      missingFrom++;
      continue;
    }
    const cmds = perNode.get(from) ?? [];
    perNode.set(from, cmds);
    const valuesByTarget = /* @__PURE__ */ new Map(), extByTarget = /* @__PURE__ */ new Map();
    for (const cid of complexIds(d)) {
      const c = complexById.get(cid);
      if (!c) continue;
      const tgt = (c.property__relation__multi_doc_rel ?? [])[0];
      if (!tgt) continue;
      valuesByTarget.set(tgt, complexValues(c));
      extByTarget.set(tgt, c.master_id);
    }
    for (const f of fields) {
      if (!types.has(f.type) && !newTypes.has(f.type)) newTypes.set(f.type, { key: f.type, label: { de: f.raw, en: f.raw }, reverse: { de: f.raw + " von", en: f.raw + " of" }, group: f.type === "component" ? REL_GROUP : null });
      const s = st(f.type);
      for (const t2 of f.targets) {
        const toMaster = stripLang(t2, d.lang);
        if (toMaster === d.master_id) {
          s.selbst++;
          continue;
        }
        const to = byExt.get(toMaster);
        if (!to) {
          s.zielFehlt++;
          continue;
        }
        const vals = f.type === "component" ? valuesByTarget.get(t2) ?? [] : [];
        const ext = extByTarget.get(t2) ?? `${d.master_id}>${f.type}>${toMaster}`;
        for (const v of vals) if (!attrs.has(v.key) && !newAttrs.has(v.key)) {
          const [type, multiple] = TYPES[v.suffix];
          newAttrs.set(v.key, { key: v.key, label: { de: v.raw, en: v.raw }, type, group: REL_GROUP, multiple });
        }
        const have = existing.get(ext);
        const rel = have ? have.id : "@r" + ++refNo;
        if (!have) cmds.push({ op: "relation.create", ref: rel.slice(1), args: { type: f.type, from, to } }, { op: "relation.external.link", args: { relation: rel, system: SYSTEM, id: ext } });
        let changed = 0;
        for (const v of vals) {
          const def = attrs.get(v.key) ?? newAttrs.get(v.key);
          const value = asStrings(v.suffix, v.value);
          const args = { relation: rel, attribute: v.key, locale: null };
          if (def.multiple) args.values = Array.isArray(value) ? value : [value];
          else args.value = Array.isArray(value) ? value.join(", ") : value;
          const cur = have?.values.get(`${v.key}|`);
          if (have && JSON.stringify(cur) === JSON.stringify(args.values ?? args.value)) continue;
          cmds.push({ op: "relation.attribute.set", args });
          changed++;
        }
        if (!have) s.neu++;
        else if (changed) s.geaendert++;
        else s.gleich++;
      }
    }
  }
  return { newTypes, newAttrs, needGroup, perNode, stats, missingFrom };
}
const RANG = { group: 0, product: 1, variant: 2 };
const byRole = (liste) => liste.sort((a, b) => (RANG[roleOf(a)] ?? 9) - (RANG[roleOf(b)] ?? 9));
async function plane({ client, umgebung, wurzeln, eltern = /* @__PURE__ */ new Map(), skip = DEFAULT_SKIP, pdefs = {} }) {
  const { modell, baum, sag } = umgebung;
  const bekannt = new Map(baum.filter((r) => r.external?.[SYSTEM]).map((r) => [r.external[SYSTEM], r]));
  const attrs = new Map((modell?.attributes ?? []).map((a) => [a.key, a]));
  const gruppen = new Map((modell?.groups ?? []).map((g) => [g.key, g]));
  const items = [];
  for (const wurzel of wurzeln) {
    const docs = await client.subtree(wurzel, (n, of) => sag?.(`lade … ${n}/${of}`));
    const kinder = /* @__PURE__ */ new Map();
    for (const d of docs) {
      const k = d.main_parent_id || "";
      if (!kinder.has(k)) kinder.set(k, []);
      kinder.get(k).push(d);
    }
    for (const l of kinder.values()) byRole(l);
    const wurzelDoc = docs.find((d) => d.id === wurzel);
    if (!wurzelDoc) {
      sag?.(`✗ ${wurzel}: in der Quelle nicht gefunden`);
      continue;
    }
    const gehe = (d, parentId, top) => {
      const role = roleOf(d);
      items.push({ doc: d, parentId, role, top });
      const darunter = kinder.get(d.id) ?? [];
      const direkt = [];
      for (const k of darunter) {
        if (roleOf(k) === "variant" && role === "group") direkt.push(k);
        else gehe(k, d.id, false);
      }
      if (direkt.length) {
        const pseudo = { id: d.id + "#variants", master_id: d.master_id + "#variants", type: "product", name: d.name || d.master_id, lang: d.lang, main_parent_id: d.id, pseudo: true };
        items.push({ doc: pseudo, parentId: d.id, role: "product", top: false });
        for (const k of direkt) items.push({ doc: k, parentId: pseudo.id, role: "variant", top: false });
      }
    };
    gehe(wurzelDoc, eltern.get(wurzel) ?? null, true);
  }
  for (const it of items) it.existing = bekannt.get(it.doc.master_id) ?? null;
  const needs = modelNeeds(items.map((i) => i.doc), attrs, gruppen, pdefs, skip);
  sag?.(`analysiert: ${items.length} Knoten (${items.filter((i) => i.existing).length} vorhanden), ${needs.newAttrs.size} neue Attribute in ${needs.newGroups.size} neuen Gruppen`);
  return { items, needs, wurzeln: wurzeln.length };
}
async function planeRelationen({ client, umgebung, wurzeln }) {
  const { api: api2, modell, baum, sag } = umgebung;
  const docs = [];
  for (const wurzel of wurzeln) docs.push(...await client.subtree(wurzel, (n2, of) => sag?.(`lade … ${n2}/${of}`)));
  const mitKanten = docs.filter((d) => relFields(d).length);
  const byExt = new Map(baum.filter((r) => r.external?.[SYSTEM]).map((r) => [r.external[SYSTEM], r.id]));
  const vorhanden = /* @__PURE__ */ new Map();
  let n = 0;
  for (const d of mitKanten) {
    const from = byExt.get(d.master_id);
    if (!from) continue;
    sag?.(`vorhandene Relationen … ${++n}/${mitKanten.length}`);
    const rs = await api2.get(`/api/nodes/${encodeURIComponent(from)}/relations`);
    for (const r of rs.out) if (r.external?.[SYSTEM]) vorhanden.set(r.external[SYSTEM], { id: r.id, values: new Map(r.values.map((v) => [`${v.attribute}|${v.locale ?? ""}`, v.values ?? v.value])) });
  }
  const cids = [...new Set(mitKanten.flatMap(complexIds))];
  const complexById = new Map((await client.byIds(cids, (k, of) => sag?.(`Kanten mit Werten … ${k}/${of}`))).map((c) => [c.id, c]));
  const needs = relationNeeds(mitKanten, byExt, complexById, vorhanden, modell);
  const kanten = [...needs.stats.values()].reduce((a, s) => a + s.neu + s.gleich + s.geaendert + s.zielFehlt, 0);
  sag?.(`Relationen analysiert: ${mitKanten.length} Knoten mit Kanten, ${kanten} Kanten, ${needs.newTypes.size} neue Typen, ${needs.newAttrs.size} neue Attribute, ${needs.missingFrom} Quellen nicht importiert`);
  return { needs, docs: mitKanten.length, cmds: [...needs.perNode.values()].reduce((a, c) => a + c.length, 0), total: kanten };
}
async function schreibeRelationen({ plan, umgebung }) {
  const { api: api2, sag } = umgebung;
  const { needs } = plan;
  let geschrieben = 0, stapel = 0;
  if (needs.needGroup) await api2.post(`/api/model/groups/${REL_GROUP}`, { key: REL_GROUP, label: { de: "Bestandteil", en: "Component" } }, "PUT");
  for (const [k, d] of needs.newAttrs) await api2.post(`/api/model/attributes/${k}`, d, "PUT");
  for (const [k, t2] of needs.newTypes) {
    await api2.post(`/api/model/relations/${k}`, t2, "PUT");
    sag?.(`Relationstyp ${k} angelegt`);
  }
  if (needs.newAttrs.size) sag?.(`${needs.newAttrs.size} Attribute in ${REL_GROUP} angelegt`);
  let n = 0;
  for (const [, cmds] of needs.perNode) {
    await umgebung.halt?.();
    sag?.(`schreibe … ${++n}/${needs.perNode.size}`);
    const res = await api2.batchChunked(cmds, { size: 2e3, label: `Import (Solr): Relationen ${n}/${needs.perNode.size}` });
    geschrieben += res.results.length;
    stapel++;
    if (res.error) throw new Error(`Stapel ${res.batch} hielt an bei #${res.error.index} ${res.error.op}: ${res.error.message}`);
  }
  sag?.(geschrieben ? `Relationen fertig: ${geschrieben} Einträge in ${stapel} Stapeln` : "Relationen: nichts zu schreiben");
  return { geschrieben, stapel };
}
const _export_sfc = (sfc, props) => {
  const target = sfc.__vccOpts || sfc;
  for (const [key, val] of props) {
    target[key] = val;
  }
  return target;
};
const _hoisted_1 = ["title"];
const _hoisted_2 = { class: "attr" };
const _hoisted_3 = { class: "row" };
const _hoisted_4 = ["placeholder", "title"];
const _hoisted_5 = ["disabled"];
const _hoisted_6 = { class: "step-band" };
const _hoisted_7 = { class: "muted" };
const _hoisted_8 = { class: "muted" };
const _hoisted_9 = { class: "scroll src" };
const _hoisted_10 = ["title", "data-id", "onClick", "onKeydown"];
const _hoisted_11 = ["onClick"];
const _hoisted_12 = ["checked", "disabled", "onChange", "title"];
const _hoisted_13 = { class: "icon" };
const _hoisted_14 = { class: "label" };
const _hoisted_15 = ["title"];
const _hoisted_16 = {
  key: 1,
  class: "muted count"
};
const _hoisted_17 = {
  key: 0,
  class: "empty"
};
const _hoisted_18 = {
  class: "toolbar hint muted",
  style: { "border-top": "1px solid var(--line)", "border-bottom": "0", "font-size": "12px" }
};
const _hoisted_19 = {
  key: 0,
  class: "pane",
  style: { "flex": "1" }
};
const _hoisted_20 = { class: "toolbar" };
const _hoisted_21 = { class: "mono muted" };
const _hoisted_22 = ["title"];
const _hoisted_23 = { class: "scroll" };
const _hoisted_24 = { class: "toolbar meta muted" };
const _hoisted_25 = { key: 0 };
const _hoisted_26 = { key: 1 };
const _hoisted_27 = { key: 2 };
const _hoisted_28 = { key: 3 };
const _hoisted_29 = { class: "grid" };
const _hoisted_30 = ["title"];
const _hoisted_31 = { class: "muted" };
const _hoisted_32 = ["title"];
const _hoisted_33 = {
  key: 0,
  class: "muted"
};
const _hoisted_34 = ["title"];
const _hoisted_35 = {
  key: 0,
  class: "muted",
  style: { "padding": "0 8px", "font-size": "12px" }
};
const _hoisted_36 = {
  class: "pane",
  style: { "flex": "1" }
};
const _hoisted_37 = { class: "toolbar" };
const _hoisted_38 = ["disabled"];
const _hoisted_39 = ["disabled"];
const _hoisted_40 = { class: "scroll" };
const _hoisted_41 = { class: "grid form-grid" };
const _hoisted_42 = { class: "muted" };
const _hoisted_43 = {
  class: "muted",
  style: { "margin-bottom": "4px" }
};
const _hoisted_44 = { class: "muted" };
const _hoisted_45 = ["placeholder"];
const _hoisted_46 = { class: "muted" };
const _hoisted_47 = {
  class: "grid",
  style: { "width": "auto" }
};
const _hoisted_48 = { class: "num pos" };
const _hoisted_49 = { class: "num" };
const _hoisted_50 = { class: "num pos" };
const _hoisted_51 = { class: "num" };
const _hoisted_52 = {
  key: 0,
  class: "section"
};
const _hoisted_53 = {
  key: 0,
  class: "warn"
};
const _hoisted_54 = { class: "grid" };
const _hoisted_55 = ["title"];
const _hoisted_56 = { class: "mono muted" };
const _hoisted_57 = { class: "muted" };
const _hoisted_58 = ["title"];
const _hoisted_59 = {
  key: 0,
  class: "muted"
};
const _hoisted_60 = { class: "num" };
const _hoisted_61 = { class: "section" };
const _hoisted_62 = { class: "grid" };
const _hoisted_63 = ["title"];
const _hoisted_64 = {
  key: 0,
  class: "muted"
};
const _hoisted_65 = {
  key: 1,
  class: "pos"
};
const _hoisted_66 = { class: "section" };
const _hoisted_67 = { class: "muted" };
const _hoisted_68 = { class: "chips" };
const _hoisted_69 = ["disabled"];
const _hoisted_70 = ["disabled"];
const _hoisted_71 = {
  key: 0,
  class: "muted"
};
const _hoisted_72 = {
  key: 0,
  class: "warn"
};
const _hoisted_73 = {
  key: 0,
  class: "grid",
  style: { "width": "auto", "margin-top": "6px" }
};
const _hoisted_74 = { class: "num pos" };
const _hoisted_75 = { class: "num" };
const _hoisted_76 = { class: "num warn" };
const _hoisted_77 = { class: "num neg" };
const _hoisted_78 = { class: "num muted" };
const _hoisted_79 = {
  key: 0,
  class: "pos"
};
const _hoisted_80 = { class: "num pos" };
const _hoisted_81 = { class: "num" };
const _hoisted_82 = { class: "num warn" };
const _hoisted_83 = { class: "num neg" };
const _hoisted_84 = { class: "num muted" };
const _hoisted_85 = {
  key: 1,
  class: "muted",
  style: { "font-size": "12px" }
};
const _hoisted_86 = {
  key: 2,
  style: { "margin-top": "6px" }
};
const _hoisted_87 = {
  key: 0,
  class: "neg"
};
const _hoisted_88 = {
  key: 1,
  class: "pos"
};
const _hoisted_89 = {
  key: 2,
  class: "muted"
};
const _hoisted_90 = {
  key: 1,
  class: "section"
};
const _hoisted_91 = {
  key: 0,
  class: "neg"
};
const _hoisted_92 = {
  key: 1,
  class: "pos"
};
const _hoisted_93 = { class: "mono" };
const _hoisted_94 = {
  key: 2,
  class: "muted"
};
const _hoisted_95 = { class: "section" };
const JOB = "solr_import";
const _sfc_main = {
  __name: "View",
  setup(__props) {
    const srcW = paneWidth("import.src", 340);
    const router = useRouter();
    const saved = JSON.parse(localStorage.getItem("journali.import.solr") || "{}");
    const base = ref(saved.base || "");
    const target = ref(saved.target || "");
    const skipText = ref(saved.skip || "");
    const persist = () => localStorage.setItem("journali.import.solr", JSON.stringify({ base: base.value, target: target.value, skip: skipText.value, auto: connected.value }));
    let client = null;
    const connected = ref(false);
    const total = ref(0);
    const pdefs = ref({});
    const rows = ref([]);
    const expanded = ref(/* @__PURE__ */ new Set());
    const checked = ref(/* @__PURE__ */ new Set());
    const current = ref(null);
    const busy = ref("");
    const log = ref([]);
    const plan = ref(null);
    const result = ref(null);
    const relPlan = ref(null);
    const relResult = ref(null);
    const model = computed(() => store.model);
    computed(() => tree.rows.filter((r) => r.role === "group"));
    const attrs = computed(() => new Map((model.value?.attributes ?? []).map((a) => [a.key, a])));
    computed(() => new Map((model.value?.groups ?? []).map((g) => [g.key, g])));
    const skip = computed(() => [...DEFAULT_SKIP, ...skipText.value.split(/[,\s]+/).filter(Boolean)]);
    const known = computed(() => new Map(tree.rows.filter((r) => r.external?.[SYSTEM]).map((r) => [r.external[SYSTEM], r])));
    onMounted(() => {
      if (!tree.loaded) tree.load();
      if (saved.base && saved.auto) connect();
    });
    function say(text) {
      log.value.unshift(`${(/* @__PURE__ */ new Date()).toLocaleTimeString("de-DE")} ${text}`);
      if (log.value.length > 200) log.value.pop();
    }
    const umgebung = {
      api,
      sag: (t2) => {
        busy.value = t2;
        say(t2);
      },
      get modell() {
        return store.model;
      },
      get baum() {
        return tree.rows;
      },
      frisch: async () => {
        await store.poll(true);
        await tree.load();
      }
    };
    const profileGet = () => ({ base: base.value, target: target.value, skip: skipText.value, checked: [...checked.value], root: [...checked.value].join(",") });
    async function profileSet(p) {
      if (!p) {
        base.value = "";
        target.value = "";
        skipText.value = "";
        connected.value = false;
        rows.value = [];
        checked.value = /* @__PURE__ */ new Set();
        plan.value = null;
        result.value = null;
        current.value = null;
        persist();
        return;
      }
      base.value = p.base ?? "";
      target.value = p.target ?? "";
      skipText.value = p.skip ?? "";
      if (!base.value) return;
      await connect();
      for (const id of p.checked ?? []) {
        await reveal(id);
        checked.value.add(id);
      }
      checked.value = new Set(checked.value);
    }
    async function reveal(id) {
      let n = 0;
      while (!rows.value.some((r) => r.doc.id === id) && n < 60) {
        const next = rows.value.find((r) => !r.loaded && r.doc.hasChilds !== false && roleOf(r.doc) !== "variant");
        if (!next) return;
        await expand(next);
        n++;
      }
    }
    async function connect() {
      busy.value = "verbinde …";
      try {
        client = solr(base.value);
        total.value = await client.count();
        const roots = await client.roots();
        rows.value = roots.map((d) => ({ doc: d, depth: 0, parent: null, loaded: false, kids: null }));
        expanded.value = /* @__PURE__ */ new Set();
        checked.value = /* @__PURE__ */ new Set();
        plan.value = null;
        result.value = null;
        current.value = null;
        connected.value = true;
        persist();
        busy.value = t("lade Attribut-Definitionen …");
        pdefs.value = await client.propertyDefs();
        say(`verbunden: ${total.value} Dokumente, ${roots.length} Wurzeln, ${Object.keys(pdefs.value).length} Attribut-Definitionen`);
        for (const r of [...rows.value]) await expand(r);
      } catch (e) {
        store.toast(e.message);
        say(t("Fehler:") + " " + e.message);
        connected.value = false;
      } finally {
        busy.value = "";
      }
    }
    const ORDER = { group: 0, product: 1, variant: 2 };
    const byRole2 = (list) => list.sort((a, b) => ORDER[roleOf(a)] - ORDER[roleOf(b)] || (a.sort_nr ?? 0) - (b.sort_nr ?? 0) || (a.name ?? "").localeCompare(b.name ?? "", "de"));
    async function expand(row) {
      if (!row.loaded) {
        row.loaded = true;
        busy.value = "lade …";
        try {
          const kids = byRole2(await client.children(row.doc.id));
          row.kids = kids.length;
          const i = rows.value.indexOf(row);
          rows.value.splice(i + 1, 0, ...kids.map((d) => ({ doc: d, depth: row.depth + 1, parent: row, loaded: false, kids: d.hasChilds ? null : 0 })));
        } catch (e) {
          row.loaded = false;
          store.toast(e.message);
          return;
        } finally {
          busy.value = "";
        }
      }
      expanded.value.add(row.doc.id);
    }
    function collapse(row) {
      expanded.value.delete(row.doc.id);
    }
    async function toggle(row) {
      expanded.value.has(row.doc.id) ? collapse(row) : await expand(row);
    }
    const visible = computed(() => rows.value.filter((r) => {
      for (let p = r.parent; p; p = p.parent) if (!expanded.value.has(p.doc.id)) return false;
      return true;
    }));
    function check(row) {
      checked.value.has(row.doc.id) ? checked.value.delete(row.doc.id) : checked.value.add(row.doc.id);
    }
    function checkedAbove(row) {
      for (let p = row.parent; p; p = p.parent) if (checked.value.has(p.doc.id)) return true;
      return false;
    }
    async function show(row) {
      current.value = row.doc;
      if (row.doc.hasChilds !== false && !row.loaded && roleOf(row.doc) !== "variant") await expand(row);
    }
    function onKey(e, row) {
      const i = visible.value.indexOf(row);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const n = visible.value[i + 1];
        if (n) {
          show(n);
          focusRow(n);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const n = visible.value[i - 1];
        if (n) {
          show(n);
          focusRow(n);
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        expand(row);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (expanded.value.has(row.doc.id)) collapse(row);
        else if (row.parent) {
          show(row.parent);
          focusRow(row.parent);
        }
      } else if (e.key === " ") {
        e.preventDefault();
        if (!checkedAbove(row)) check(row);
      }
    }
    function focusRow(row) {
      requestAnimationFrame(() => document.querySelector(`[data-id="${CSS.escape(row.doc.id)}"]`)?.focus());
    }
    const currentValues = computed(() => {
      const d = current.value;
      if (!d) return [];
      const out = [];
      if (d.name) out.push({ key: "name", type: "text", value: d.name, attr: "name" });
      if (d.description) out.push({ key: "description", type: "html", value: d.description, attr: "description" });
      if (d.product_number) out.push({ key: "product_number", type: "text", value: d.product_number, attr: "sku" });
      for (const v of ownValues(d, skip.value)) {
        const p = pdefs.value[v.raw];
        out.push({ key: v.raw, label: p?.name, section: p?.section, type: TYPES[v.suffix][0] + (TYPES[v.suffix][1] ? " ≣" : ""), value: Array.isArray(v.value) ? v.value.join(", ") : String(v.value), attr: v.key });
      }
      return out;
    });
    const currentSkipped = computed(() => {
      if (!current.value) return [];
      const taken = new Set(ownValues(current.value, skip.value).map((v) => v.raw));
      return Object.keys(current.value).filter((k) => k.startsWith("property__")).map((k) => k.slice(10).replace(/__\w+$/, "")).filter((k) => !taken.has(k));
    });
    function gewaehlt() {
      const picked = rows.value.filter((r) => checked.value.has(r.doc.id) && !checkedAbove(r));
      return { wurzeln: picked.map((r) => r.doc.id), eltern: new Map(picked.map((r) => [r.doc.id, r.parent?.doc.id ?? null])), anzahl: picked.length };
    }
    async function analyse() {
      if (!checked.value.size) {
        store.toast(t("Nichts angehakt"));
        return;
      }
      busy.value = "lade …";
      plan.value = null;
      result.value = null;
      try {
        const { wurzeln, eltern, anzahl } = gewaehlt();
        const p = await plane({ client, umgebung, wurzeln, eltern, skip: skip.value, pdefs: pdefs.value });
        plan.value = { ...p, picked: anzahl };
      } catch (e) {
        store.toast(e.message);
        say(t("Fehler:") + " " + e.message);
      } finally {
        busy.value = "";
      }
    }
    const counts = computed(() => {
      const c = { group: [0, 0], product: [0, 0], variant: [0, 0] };
      for (const it of plan.value?.items ?? []) c[it.role][it.existing ? 1 : 0]++;
      return c;
    });
    async function analyseRelations() {
      if (!checked.value.size) {
        store.toast(t("Nichts angehakt"));
        return;
      }
      busy.value = "lade …";
      relPlan.value = null;
      relResult.value = null;
      try {
        relPlan.value = await planeRelationen({ client, umgebung, wurzeln: gewaehlt().wurzeln });
      } catch (e) {
        store.toast(e.message);
        say(t("Fehler:") + " " + e.message);
      } finally {
        busy.value = "";
      }
    }
    async function runRelations() {
      if (!store.actor) {
        store.toast(t("👤 Name fehlt → Einstellungen"));
        return;
      }
      if (!relPlan.value) return;
      busy.value = "schreibe …";
      relResult.value = null;
      let written = 0, batches = 0;
      try {
        const r = await schreibeRelationen({ plan: relPlan.value, umgebung });
        written = r.geschrieben;
        batches = r.stapel;
        relResult.value = { written, batches, error: null };
        await store.poll(true);
        relPlan.value = null;
      } catch (e) {
        relResult.value = { written, batches, error: e.message };
        store.toast(e.message);
        say(t("Fehler:") + " " + e.message);
      } finally {
        busy.value = "";
      }
    }
    async function run() {
      if (!store.actor) {
        store.toast(t("👤 Name fehlt → Einstellungen"));
        return;
      }
      if (!plan.value) return;
      busy.value = t("übergebe …");
      result.value = null;
      try {
        const { wurzeln } = gewaehlt();
        const r = await api.post(`/api/jobs/${JOB}/uebergabe`, {
          label: `Import (Solr) · ${wurzeln.length} Wurzel${wurzeln.length === 1 ? "" : "n"}`,
          service: "solr",
          params: {
            base: base.value,
            roots: wurzeln.join(","),
            target: target.value || "",
            skip: skipText.value || "",
            relations: "false",
            dry_run: "false"
          }
        });
        result.value = { job: r.job, run: r.run, error: null };
        say(t("an den Tasker übergeben · Lauf {0}", [r.run]));
        store.toast(t("▶ An den Tasker übergeben"), "ok", { label: t("⏱ Jobs"), title: t("Fortschritt, Abbrechen und das Protokoll"), run: () => router.push("/p/tasker/jobs") });
        plan.value = null;
      } catch (e) {
        result.value = { error: e.message };
        store.toast(e.message);
        say(t("Fehler:") + " " + e.message);
      } finally {
        busy.value = "";
      }
    }
    return (_ctx, _cache) => {
      const _component_router_link = resolveComponent("router-link");
      return openBlock(), createElementBlock(
        Fragment,
        null,
        [
          createElementVNode(
            "div",
            {
              class: "pane",
              style: normalizeStyle(`width:${unref(srcW)}px;flex:none`)
            },
            [
              createVNode(unref(ImportHead), {
                source: "solr",
                plugin: "solr",
                busy: busy.value,
                get: profileGet,
                set: profileSet
              }, {
                status: withCtx(() => [
                  connected.value ? (openBlock(), createElementBlock("span", {
                    key: 0,
                    class: "muted",
                    title: base.value
                  }, "☰ " + toDisplayString(total.value), 9, _hoisted_1)) : createCommentVNode("v-if", true)
                ]),
                default: withCtx(() => [
                  createElementVNode("tr", null, [
                    createElementVNode(
                      "td",
                      _hoisted_2,
                      toDisplayString(_ctx.$t("Quelle")),
                      1
                      /* TEXT */
                    ),
                    createElementVNode("td", _hoisted_3, [
                      withDirectives(createElementVNode("input", {
                        "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => base.value = $event),
                        type: "text",
                        placeholder: _ctx.$t("https://…/solr/<kern>"),
                        title: _ctx.$t("URL des Solr-Kerns"),
                        onKeydown: withKeys(connect, ["enter"])
                      }, null, 40, _hoisted_4), [
                        [vModelText, base.value]
                      ]),
                      createElementVNode("button", {
                        class: "primary",
                        onClick: connect,
                        disabled: !!busy.value
                      }, toDisplayString(_ctx.$t("Verbinden")), 9, _hoisted_5)
                    ])
                  ])
                ]),
                _: 1
                /* STABLE */
              }, 8, ["busy"]),
              createElementVNode("div", _hoisted_6, [
                createTextVNode(
                  toDisplayString(_ctx.$t("2 · Auswahl") + " "),
                  1
                  /* TEXT */
                ),
                createElementVNode(
                  "span",
                  _hoisted_7,
                  toDisplayString(_ctx.$t("· Haken = Teilbaum, Klick zeigt den Knoten")),
                  1
                  /* TEXT */
                ),
                _cache[6] || (_cache[6] = createElementVNode(
                  "span",
                  { class: "grow" },
                  null,
                  -1
                  /* CACHED */
                )),
                createElementVNode(
                  "span",
                  _hoisted_8,
                  toDisplayString(_ctx.$t("{0} gewählt", [checked.value.size])),
                  1
                  /* TEXT */
                )
              ]),
              createElementVNode("div", _hoisted_9, [
                (openBlock(true), createElementBlock(
                  Fragment,
                  null,
                  renderList(visible.value, (r) => {
                    return openBlock(), createElementBlock("div", {
                      key: r.doc.id,
                      class: normalizeClass(["node", [unref(roleOf)(r.doc), { on: checked.value.has(r.doc.id) || checkedAbove(r), current: current.value?.id === r.doc.id }]]),
                      style: normalizeStyle(`padding-left:${6 + r.depth * 14}px`),
                      title: r.doc.master_id,
                      tabindex: "0",
                      "data-id": r.doc.id,
                      onClick: ($event) => show(r),
                      onKeydown: ($event) => onKey($event, r)
                    }, [
                      createElementVNode("span", {
                        class: "twisty",
                        onClick: withModifiers(($event) => toggle(r), ["stop"])
                      }, toDisplayString(unref(roleOf)(r.doc) === "variant" || r.kids === 0 ? "" : expanded.value.has(r.doc.id) ? "▾" : "▸"), 9, _hoisted_11),
                      createElementVNode("input", {
                        type: "checkbox",
                        checked: checked.value.has(r.doc.id) || checkedAbove(r),
                        disabled: checkedAbove(r),
                        onClick: _cache[1] || (_cache[1] = withModifiers(() => {
                        }, ["stop"])),
                        onChange: ($event) => check(r),
                        title: _ctx.$t("Teilbaum importieren")
                      }, null, 40, _hoisted_12),
                      createElementVNode(
                        "span",
                        _hoisted_13,
                        toDisplayString(unref(icon)(unref(roleOf)(r.doc))),
                        1
                        /* TEXT */
                      ),
                      createElementVNode(
                        "span",
                        _hoisted_14,
                        toDisplayString(r.doc.name || r.doc.remote_id || r.doc.master_id),
                        1
                        /* TEXT */
                      ),
                      known.value.has(r.doc.master_id) ? (openBlock(), createElementBlock("span", {
                        key: 0,
                        class: "pos",
                        title: _ctx.$t("schon in journali")
                      }, "✓", 8, _hoisted_15)) : createCommentVNode("v-if", true),
                      r.kids ? (openBlock(), createElementBlock(
                        "span",
                        _hoisted_16,
                        toDisplayString(r.kids),
                        1
                        /* TEXT */
                      )) : createCommentVNode("v-if", true)
                    ], 46, _hoisted_10);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                )),
                !connected.value ? (openBlock(), createElementBlock(
                  "div",
                  _hoisted_17,
                  toDisplayString(_ctx.$t("Verbinden — Solr liest sich ohne Anmeldung.")),
                  1
                  /* TEXT */
                )) : createCommentVNode("v-if", true)
              ]),
              createElementVNode("div", _hoisted_18, [
                _cache[7] || (_cache[7] = createElementVNode(
                  "kbd",
                  null,
                  "↑",
                  -1
                  /* CACHED */
                )),
                _cache[8] || (_cache[8] = createElementVNode(
                  "kbd",
                  null,
                  "↓",
                  -1
                  /* CACHED */
                )),
                _cache[9] || (_cache[9] = createTextVNode(
                  " · ",
                  -1
                  /* CACHED */
                )),
                _cache[10] || (_cache[10] = createElementVNode(
                  "kbd",
                  null,
                  "→",
                  -1
                  /* CACHED */
                )),
                _cache[11] || (_cache[11] = createElementVNode(
                  "kbd",
                  null,
                  "←",
                  -1
                  /* CACHED */
                )),
                _cache[12] || (_cache[12] = createTextVNode(
                  " · ",
                  -1
                  /* CACHED */
                )),
                createElementVNode(
                  "kbd",
                  null,
                  toDisplayString(_ctx.$t("Leer")),
                  1
                  /* TEXT */
                ),
                createTextVNode(
                  toDisplayString(" " + _ctx.$t("Haken · Klick zeigt den Knoten · {0} gewählt", [checked.value.size])),
                  1
                  /* TEXT */
                )
              ])
            ],
            4
            /* STYLE */
          ),
          createVNode(unref(Splitter), {
            modelValue: unref(srcW),
            "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => isRef(srcW) ? srcW.value = $event : null),
            min: 240,
            max: 800
          }, null, 8, ["modelValue"]),
          createCommentVNode(" Der angeklickte Knoten: nur dann, sonst gehört der Platz dem Plan "),
          current.value ? (openBlock(), createElementBlock("div", _hoisted_19, [
            createElementVNode("div", _hoisted_20, [
              createElementVNode(
                "h1",
                null,
                toDisplayString(unref(icon)(unref(roleOf)(current.value)) + " " + (current.value.name || current.value.master_id)),
                1
                /* TEXT */
              ),
              createElementVNode(
                "span",
                _hoisted_21,
                toDisplayString(current.value.master_id),
                1
                /* TEXT */
              ),
              _cache[13] || (_cache[13] = createElementVNode(
                "span",
                { class: "grow" },
                null,
                -1
                /* CACHED */
              )),
              createElementVNode("button", {
                class: "x",
                onClick: _cache[3] || (_cache[3] = ($event) => current.value = null),
                title: _ctx.$t("zuklappen")
              }, "×", 8, _hoisted_22)
            ]),
            createElementVNode("div", _hoisted_23, [
              createCommentVNode(" kein nacktes <template> hier: Vue 3 rendert es als echtes <template>-Element, dessen Inhalt unsichtbar ist "),
              createElementVNode("div", _hoisted_24, [
                current.value.product_number ? (openBlock(), createElementBlock(
                  "span",
                  _hoisted_25,
                  toDisplayString(_ctx.$t("SKU {0}", [current.value.product_number])),
                  1
                  /* TEXT */
                )) : createCommentVNode("v-if", true),
                current.value.main_level != null ? (openBlock(), createElementBlock(
                  "span",
                  _hoisted_26,
                  toDisplayString(_ctx.$t("· Ebene {0}", [current.value.main_level])),
                  1
                  /* TEXT */
                )) : createCommentVNode("v-if", true),
                current.value.info__changedOn__dateTime ? (openBlock(), createElementBlock(
                  "span",
                  _hoisted_27,
                  toDisplayString(_ctx.$t("· geändert {0}", [current.value.info__changedOn__dateTime.slice(0, 10)])),
                  1
                  /* TEXT */
                )) : createCommentVNode("v-if", true),
                known.value.has(current.value.master_id) ? (openBlock(), createElementBlock("span", _hoisted_28, [
                  _cache[14] || (_cache[14] = createTextVNode(
                    "· ",
                    -1
                    /* CACHED */
                  )),
                  createVNode(_component_router_link, {
                    to: `/tree/${known.value.get(current.value.master_id).id}`,
                    class: "pos"
                  }, {
                    default: withCtx(() => [
                      createTextVNode(
                        toDisplayString(_ctx.$t("✓ in journali →")),
                        1
                        /* TEXT */
                      )
                    ]),
                    _: 1
                    /* STABLE */
                  }, 8, ["to"])
                ])) : createCommentVNode("v-if", true)
              ]),
              createElementVNode("table", _hoisted_29, [
                createElementVNode("thead", null, [
                  createElementVNode("tr", null, [
                    createElementVNode(
                      "th",
                      null,
                      toDisplayString(_ctx.$t("Solr")),
                      1
                      /* TEXT */
                    ),
                    createElementVNode(
                      "th",
                      null,
                      toDisplayString(_ctx.$t("Typ")),
                      1
                      /* TEXT */
                    ),
                    createElementVNode(
                      "th",
                      null,
                      toDisplayString(_ctx.$t("→ Attribut")),
                      1
                      /* TEXT */
                    ),
                    createElementVNode(
                      "th",
                      null,
                      toDisplayString(_ctx.$t("Wert")),
                      1
                      /* TEXT */
                    )
                  ])
                ]),
                createElementVNode("tbody", null, [
                  (openBlock(true), createElementBlock(
                    Fragment,
                    null,
                    renderList(currentValues.value, (v) => {
                      return openBlock(), createElementBlock("tr", {
                        key: v.key
                      }, [
                        createElementVNode("td", {
                          class: "mono",
                          title: v.section ? `${v.label ?? ""} · ${v.section}` : ""
                        }, toDisplayString(v.key), 9, _hoisted_30),
                        createElementVNode(
                          "td",
                          _hoisted_31,
                          toDisplayString(v.type),
                          1
                          /* TEXT */
                        ),
                        createElementVNode("td", {
                          class: normalizeClass(attrs.value.has(v.attr) ? "" : "warn"),
                          title: attrs.value.has(v.attr) ? _ctx.$t("Attribut vorhanden") : _ctx.$t("wird angelegt") + (v.section ? " in " + v.section : "")
                        }, [
                          createTextVNode(
                            toDisplayString(v.attr),
                            1
                            /* TEXT */
                          ),
                          !attrs.value.has(v.attr) ? (openBlock(), createElementBlock("span", _hoisted_33, " +")) : createCommentVNode("v-if", true)
                        ], 10, _hoisted_32),
                        createElementVNode("td", {
                          class: "val",
                          title: v.value
                        }, toDisplayString(v.value.replace(/<[^>]+>/g, " ").slice(0, 160)), 9, _hoisted_34)
                      ]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ])
              ]),
              currentSkipped.value.length ? (openBlock(), createElementBlock(
                "p",
                _hoisted_35,
                toDisplayString(_ctx.$t("übergangen: {0}", [currentSkipped.value.join(", ")])),
                1
                /* TEXT */
              )) : createCommentVNode("v-if", true)
            ])
          ])) : createCommentVNode("v-if", true),
          createElementVNode("div", _hoisted_36, [
            createElementVNode("div", _hoisted_37, [
              createElementVNode(
                "h1",
                null,
                toDisplayString(_ctx.$t("3 · Plan")),
                1
                /* TEXT */
              ),
              _cache[15] || (_cache[15] = createElementVNode(
                "span",
                { class: "grow" },
                null,
                -1
                /* CACHED */
              )),
              createElementVNode("button", {
                class: "primary",
                onClick: analyse,
                disabled: !connected.value || !checked.value.size || !!busy.value
              }, toDisplayString(_ctx.$t("Analysieren")), 9, _hoisted_38),
              createElementVNode("button", {
                class: "primary",
                onClick: run,
                disabled: !plan.value || !!busy.value
              }, toDisplayString(_ctx.$t("Schreiben")), 9, _hoisted_39)
            ]),
            createElementVNode("div", _hoisted_40, [
              createElementVNode("table", _hoisted_41, [
                _cache[16] || (_cache[16] = createElementVNode(
                  "colgroup",
                  null,
                  [
                    createElementVNode("col", { style: { "width": "84px" } }),
                    createElementVNode("col")
                  ],
                  -1
                  /* CACHED */
                )),
                createElementVNode("tbody", null, [
                  createElementVNode("tr", null, [
                    createElementVNode(
                      "td",
                      _hoisted_42,
                      toDisplayString(_ctx.$t("Ziel ▣")),
                      1
                      /* TEXT */
                    ),
                    createElementVNode("td", null, [
                      createElementVNode(
                        "div",
                        _hoisted_43,
                        toDisplayString(_ctx.$t("{0} · angehakte Wurzeln kommen hier unter; tiefere unter ihre importierten Eltern", [target.value ? "▣ " + (unref(tree).byId.get(target.value)?.label ?? target.value) : _ctx.$t("⌂ Wurzel")])),
                        1
                        /* TEXT */
                      ),
                      createVNode(unref(TreePicker), {
                        modelValue: target.value,
                        "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => target.value = $event),
                        roles: ["group"],
                        "allow-root": "",
                        height: 180,
                        onPick: persist
                      }, null, 8, ["modelValue"])
                    ])
                  ]),
                  createElementVNode("tr", null, [
                    createElementVNode(
                      "td",
                      _hoisted_44,
                      toDisplayString(_ctx.$t("Übergehen")),
                      1
                      /* TEXT */
                    ),
                    createElementVNode("td", null, [
                      withDirectives(createElementVNode("input", {
                        "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => skipText.value = $event),
                        type: "text",
                        placeholder: _ctx.$t("weitere Schlüssel, Muster mit *"),
                        style: { "width": "260px" },
                        onChange: persist
                      }, null, 40, _hoisted_45), [
                        [vModelText, skipText.value]
                      ]),
                      createElementVNode(
                        "span",
                        _hoisted_46,
                        toDisplayString(_ctx.$t("immer: {0}, Relationen, Medien", [unref(DEFAULT_SKIP).join(", ")])),
                        1
                        /* TEXT */
                      )
                    ])
                  ])
                ])
              ]),
              plan.value ? (openBlock(), createElementBlock(
                Fragment,
                { key: 0 },
                [
                  createElementVNode("table", _hoisted_47, [
                    createElementVNode("thead", null, [
                      createElementVNode("tr", null, [
                        _cache[17] || (_cache[17] = createElementVNode(
                          "th",
                          null,
                          null,
                          -1
                          /* CACHED */
                        )),
                        createElementVNode(
                          "th",
                          _hoisted_48,
                          toDisplayString(_ctx.$t("neu")),
                          1
                          /* TEXT */
                        ),
                        createElementVNode(
                          "th",
                          _hoisted_49,
                          toDisplayString(_ctx.$t("vorhanden")),
                          1
                          /* TEXT */
                        )
                      ])
                    ]),
                    createElementVNode("tbody", null, [
                      (openBlock(), createElementBlock(
                        Fragment,
                        null,
                        renderList(["group", "product", "variant"], (r) => {
                          return createElementVNode("tr", { key: r }, [
                            createElementVNode(
                              "td",
                              null,
                              toDisplayString(unref(icon)(r)) + " " + toDisplayString(r),
                              1
                              /* TEXT */
                            ),
                            createElementVNode(
                              "td",
                              _hoisted_50,
                              toDisplayString(counts.value[r][0]),
                              1
                              /* TEXT */
                            ),
                            createElementVNode(
                              "td",
                              _hoisted_51,
                              toDisplayString(counts.value[r][1]),
                              1
                              /* TEXT */
                            )
                          ]);
                        }),
                        64
                        /* STABLE_FRAGMENT */
                      ))
                    ])
                  ]),
                  plan.value.needs.newAttrs.size || plan.value.needs.newGroups.size ? (openBlock(), createElementBlock("div", _hoisted_52, [
                    createElementVNode("h2", null, [
                      createTextVNode(
                        toDisplayString(_ctx.$t("Neu im Modell: ▤ {0} · ⊞ {1}", [plan.value.needs.newGroups.size, plan.value.needs.newAttrs.size])),
                        1
                        /* TEXT */
                      ),
                      plan.value.needs.raise.size ? (openBlock(), createElementBlock(
                        "span",
                        _hoisted_53,
                        toDisplayString(" " + _ctx.$t("· {0} Gruppen „aktiv ab“ anheben: {1}", [plan.value.needs.raise.size, [...plan.value.needs.raise].map(([k, r]) => `${k} → ${r ?? "überall"}`).join(", ")])),
                        1
                        /* TEXT */
                      )) : createCommentVNode("v-if", true)
                    ]),
                    createElementVNode("table", _hoisted_54, [
                      createElementVNode("thead", null, [
                        createElementVNode("tr", null, [
                          createElementVNode(
                            "th",
                            null,
                            toDisplayString(_ctx.$t("Attribut")),
                            1
                            /* TEXT */
                          ),
                          createElementVNode(
                            "th",
                            null,
                            toDisplayString(_ctx.$t("Typ")),
                            1
                            /* TEXT */
                          ),
                          createElementVNode(
                            "th",
                            null,
                            toDisplayString(_ctx.$t("▤ Gruppe")),
                            1
                            /* TEXT */
                          ),
                          _cache[18] || (_cache[18] = createElementVNode(
                            "th",
                            { class: "num" },
                            "#",
                            -1
                            /* CACHED */
                          ))
                        ])
                      ]),
                      createElementVNode("tbody", null, [
                        (openBlock(true), createElementBlock(
                          Fragment,
                          null,
                          renderList(plan.value.needs.newAttrs, ([k, d]) => {
                            return openBlock(), createElementBlock("tr", { key: k }, [
                              createElementVNode("td", { title: k }, [
                                createTextVNode(
                                  toDisplayString(_ctx.$L(d.label)) + " ",
                                  1
                                  /* TEXT */
                                ),
                                createElementVNode(
                                  "span",
                                  _hoisted_56,
                                  toDisplayString(k),
                                  1
                                  /* TEXT */
                                )
                              ], 8, _hoisted_55),
                              createElementVNode(
                                "td",
                                _hoisted_57,
                                toDisplayString(d.type) + toDisplayString(d.multiple ? " ≣" : "") + toDisplayString(d.axes ? " 🗣" : ""),
                                1
                                /* TEXT */
                              ),
                              createElementVNode("td", {
                                class: normalizeClass({ pos: plan.value.needs.newGroups.has(d.group) }),
                                title: plan.value.needs.newGroups.get(d.group)?.label
                              }, [
                                createTextVNode(
                                  toDisplayString(d.group),
                                  1
                                  /* TEXT */
                                ),
                                plan.value.needs.newGroups.get(d.group)?.activeFrom ? (openBlock(), createElementBlock(
                                  "span",
                                  _hoisted_59,
                                  toDisplayString(" " + _ctx.$t("· ab {0}", [unref(icon)(plan.value.needs.newGroups.get(d.group).activeFrom)])),
                                  1
                                  /* TEXT */
                                )) : createCommentVNode("v-if", true)
                              ], 10, _hoisted_58),
                              createElementVNode(
                                "td",
                                _hoisted_60,
                                toDisplayString(plan.value.needs.counts.get(k)),
                                1
                                /* TEXT */
                              )
                            ]);
                          }),
                          128
                          /* KEYED_FRAGMENT */
                        ))
                      ])
                    ])
                  ])) : createCommentVNode("v-if", true),
                  createElementVNode("div", _hoisted_61, [
                    createElementVNode(
                      "h2",
                      null,
                      toDisplayString(_ctx.$t("Knoten")),
                      1
                      /* TEXT */
                    ),
                    createElementVNode("table", _hoisted_62, [
                      createElementVNode("tbody", null, [
                        (openBlock(true), createElementBlock(
                          Fragment,
                          null,
                          renderList(plan.value.items, (it) => {
                            return openBlock(), createElementBlock("tr", {
                              key: it.doc.id
                            }, [
                              createElementVNode("td", {
                                title: it.doc.master_id
                              }, [
                                createTextVNode(
                                  toDisplayString(unref(icon)(it.role)) + " " + toDisplayString(it.doc.name || it.doc.master_id),
                                  1
                                  /* TEXT */
                                ),
                                it.doc.pseudo ? (openBlock(), createElementBlock(
                                  "span",
                                  _hoisted_64,
                                  toDisplayString(" " + _ctx.$t("· Sammelprodukt")),
                                  1
                                  /* TEXT */
                                )) : createCommentVNode("v-if", true)
                              ], 8, _hoisted_63),
                              createElementVNode("td", null, [
                                it.existing ? (openBlock(), createBlock(_component_router_link, {
                                  key: 0,
                                  to: `/tree/${it.existing.id}`,
                                  class: "muted"
                                }, {
                                  default: withCtx(() => [
                                    createTextVNode(
                                      toDisplayString(_ctx.$t("vorhanden →")),
                                      1
                                      /* TEXT */
                                    )
                                  ]),
                                  _: 1
                                  /* STABLE */
                                }, 8, ["to"])) : (openBlock(), createElementBlock(
                                  "span",
                                  _hoisted_65,
                                  toDisplayString(_ctx.$t("neu")),
                                  1
                                  /* TEXT */
                                ))
                              ])
                            ]);
                          }),
                          128
                          /* KEYED_FRAGMENT */
                        ))
                      ])
                    ])
                  ])
                ],
                64
                /* STABLE_FRAGMENT */
              )) : createCommentVNode("v-if", true),
              createElementVNode("div", _hoisted_66, [
                createElementVNode("h2", null, [
                  createTextVNode(
                    toDisplayString(_ctx.$t("⇄ Relationen") + " "),
                    1
                    /* TEXT */
                  ),
                  createElementVNode(
                    "span",
                    _hoisted_67,
                    toDisplayString(_ctx.$t("· zweiter Lauf, wenn die Knoten drin sind (beide Enden müssen importiert sein)")),
                    1
                    /* TEXT */
                  )
                ]),
                createElementVNode("div", _hoisted_68, [
                  createElementVNode("button", {
                    class: "primary",
                    onClick: analyseRelations,
                    disabled: !connected.value || !checked.value.size || !!busy.value
                  }, toDisplayString(_ctx.$t("⇄ analysieren")), 9, _hoisted_69),
                  createElementVNode("button", {
                    class: "primary",
                    onClick: runRelations,
                    disabled: !relPlan.value || !!busy.value
                  }, toDisplayString(_ctx.$t("⇄ schreiben")), 9, _hoisted_70),
                  relPlan.value ? (openBlock(), createElementBlock("span", _hoisted_71, [
                    createTextVNode(
                      toDisplayString(_ctx.$t("{0} Knoten mit Kanten · {1} Befehle", [relPlan.value.docs, relPlan.value.cmds])),
                      1
                      /* TEXT */
                    ),
                    relPlan.value.needs.missingFrom ? (openBlock(), createElementBlock(
                      "span",
                      _hoisted_72,
                      toDisplayString(" " + _ctx.$t("· {0} Quellen nicht importiert", [relPlan.value.needs.missingFrom])),
                      1
                      /* TEXT */
                    )) : createCommentVNode("v-if", true)
                  ])) : createCommentVNode("v-if", true)
                ]),
                relPlan.value ? (openBlock(), createElementBlock("table", _hoisted_73, [
                  createElementVNode("thead", null, [
                    createElementVNode("tr", null, [
                      createElementVNode(
                        "th",
                        null,
                        toDisplayString(_ctx.$t("Typ")),
                        1
                        /* TEXT */
                      ),
                      createElementVNode(
                        "th",
                        _hoisted_74,
                        toDisplayString(_ctx.$t("neu")),
                        1
                        /* TEXT */
                      ),
                      createElementVNode(
                        "th",
                        _hoisted_75,
                        toDisplayString(_ctx.$t("vorhanden")),
                        1
                        /* TEXT */
                      ),
                      createElementVNode(
                        "th",
                        _hoisted_76,
                        toDisplayString(_ctx.$t("geändert")),
                        1
                        /* TEXT */
                      ),
                      createElementVNode(
                        "th",
                        _hoisted_77,
                        toDisplayString(_ctx.$t("Ziel fehlt")),
                        1
                        /* TEXT */
                      ),
                      createElementVNode(
                        "th",
                        _hoisted_78,
                        toDisplayString(_ctx.$t("auf sich selbst")),
                        1
                        /* TEXT */
                      )
                    ])
                  ]),
                  createElementVNode("tbody", null, [
                    (openBlock(true), createElementBlock(
                      Fragment,
                      null,
                      renderList(relPlan.value.needs.stats, ([t2, s]) => {
                        return openBlock(), createElementBlock("tr", { key: t2 }, [
                          createElementVNode("td", null, [
                            createTextVNode(
                              "⇄ " + toDisplayString(t2),
                              1
                              /* TEXT */
                            ),
                            relPlan.value.needs.newTypes.has(t2) ? (openBlock(), createElementBlock("span", _hoisted_79, " +")) : createCommentVNode("v-if", true)
                          ]),
                          createElementVNode(
                            "td",
                            _hoisted_80,
                            toDisplayString(s.neu),
                            1
                            /* TEXT */
                          ),
                          createElementVNode(
                            "td",
                            _hoisted_81,
                            toDisplayString(s.gleich),
                            1
                            /* TEXT */
                          ),
                          createElementVNode(
                            "td",
                            _hoisted_82,
                            toDisplayString(s.geaendert),
                            1
                            /* TEXT */
                          ),
                          createElementVNode(
                            "td",
                            _hoisted_83,
                            toDisplayString(s.zielFehlt),
                            1
                            /* TEXT */
                          ),
                          createElementVNode(
                            "td",
                            _hoisted_84,
                            toDisplayString(s.selbst),
                            1
                            /* TEXT */
                          )
                        ]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ])
                ])) : createCommentVNode("v-if", true),
                relPlan.value?.needs.newAttrs.size ? (openBlock(), createElementBlock(
                  "p",
                  _hoisted_85,
                  toDisplayString(_ctx.$t("Neu in ▤ {0}: {1}", [unref(REL_GROUP), [...relPlan.value.needs.newAttrs.keys()].join(", ")])),
                  1
                  /* TEXT */
                )) : createCommentVNode("v-if", true),
                relResult.value ? (openBlock(), createElementBlock("div", _hoisted_86, [
                  relResult.value.error ? (openBlock(), createElementBlock(
                    "div",
                    _hoisted_87,
                    toDisplayString(_ctx.$t("{0} — {1} Einträge davor geschrieben.", [relResult.value.error, relResult.value.written])),
                    1
                    /* TEXT */
                  )) : relResult.value.written ? (openBlock(), createElementBlock(
                    "div",
                    _hoisted_88,
                    toDisplayString(_ctx.$t("{0} Einträge in {1} Stapeln", [relResult.value.written, relResult.value.batches])),
                    1
                    /* TEXT */
                  )) : (openBlock(), createElementBlock(
                    "div",
                    _hoisted_89,
                    toDisplayString(_ctx.$t("Nichts zu schreiben.")),
                    1
                    /* TEXT */
                  ))
                ])) : createCommentVNode("v-if", true)
              ]),
              result.value ? (openBlock(), createElementBlock("div", _hoisted_90, [
                createElementVNode(
                  "h2",
                  null,
                  toDisplayString(_ctx.$t("Ergebnis")),
                  1
                  /* TEXT */
                ),
                result.value.error ? (openBlock(), createElementBlock(
                  "div",
                  _hoisted_91,
                  toDisplayString(result.value.error),
                  1
                  /* TEXT */
                )) : result.value.job ? (openBlock(), createElementBlock("div", _hoisted_92, [
                  createTextVNode(
                    toDisplayString(_ctx.$t("an den Tasker übergeben · Lauf") + " "),
                    1
                    /* TEXT */
                  ),
                  createElementVNode(
                    "span",
                    _hoisted_93,
                    toDisplayString(result.value.run),
                    1
                    /* TEXT */
                  ),
                  _cache[19] || (_cache[19] = createTextVNode(
                    " → ",
                    -1
                    /* CACHED */
                  )),
                  createVNode(_component_router_link, { to: "/p/tasker/jobs" }, {
                    default: withCtx(() => [
                      createTextVNode(
                        toDisplayString(_ctx.$t("⏱ Jobs")),
                        1
                        /* TEXT */
                      )
                    ]),
                    _: 1
                    /* STABLE */
                  })
                ])) : (openBlock(), createElementBlock(
                  "div",
                  _hoisted_94,
                  toDisplayString(_ctx.$t("Nichts zu schreiben.")),
                  1
                  /* TEXT */
                ))
              ])) : createCommentVNode("v-if", true),
              createElementVNode("div", _hoisted_95, [
                createElementVNode(
                  "h2",
                  null,
                  toDisplayString(_ctx.$t("Protokoll")),
                  1
                  /* TEXT */
                ),
                (openBlock(true), createElementBlock(
                  Fragment,
                  null,
                  renderList(log.value, (l, i) => {
                    return openBlock(), createElementBlock(
                      "div",
                      {
                        key: i,
                        class: "mono muted",
                        style: { "font-size": "11px" }
                      },
                      toDisplayString(l),
                      1
                      /* TEXT */
                    );
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ])
            ])
          ])
        ],
        64
        /* STABLE_FRAGMENT */
      );
    };
  }
};
const View = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-34165bad"]]);
const entry = {
  views: [{ path: "import", topic: "import", label: t("Solr"), icon: "⇩", component: View }]
};
export {
  entry as default
};
