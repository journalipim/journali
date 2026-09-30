(function(){const s=document.createElement('style');s.textContent="\n.form[data-v-af97dff8] { width: 100%; border-bottom: 1px solid var(--line);\n}\n.form td[data-v-af97dff8] { vertical-align: middle; white-space: normal; padding: 3px 4px;\n}\n.form td.attr[data-v-af97dff8] { color: var(--muted); white-space: nowrap; padding-left: 8px; vertical-align: top;\n}\n.drop[data-v-af97dff8] { display: inline-block; padding: 2px 10px; border: 1px dashed var(--line); border-radius: 6px; cursor: pointer;\n}\n.drop.over[data-v-af97dff8] { outline: 2px dashed var(--accent); outline-offset: -2px;\n}\n.pick[data-v-af97dff8] { cursor: pointer; padding: 1px 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;\n}\n.pick[data-v-af97dff8]:hover { background: var(--hover);\n}\n.pick.current[data-v-af97dff8] { background: var(--accent-soft);\n}\n";document.head.append(s)})();
const m$1 = window.journali.vue;
const Fragment = m$1.Fragment;
const computed = m$1.computed;
const createCommentVNode = m$1.createCommentVNode;
const createElementBlock = m$1.createElementBlock;
const createElementVNode = m$1.createElementVNode;
const createTextVNode = m$1.createTextVNode;
const createVNode = m$1.createVNode;
const normalizeClass = m$1.normalizeClass;
const onMounted = m$1.onMounted;
const openBlock = m$1.openBlock;
const ref = m$1.ref;
const renderList = m$1.renderList;
const toDisplayString = m$1.toDisplayString;
const unref = m$1.unref;
const vModelText = m$1.vModelText;
const withDirectives = m$1.withDirectives;
const withModifiers = m$1.withModifiers;
const m = window.journali.vueRouter;
const useRoute = m.useRoute;
const h = window.journali;
const api = h.api;
const store = h.store;
const tree = h.tree;
const icon = h.icon;
const t = h.t;
const TreePicker = h.TreePicker;
const LEVEL = { segment: 1, family: 2, class: 3, brick: 4 };
function zipEntries(buf) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 7e4); i--) if (view.getUint32(i, true) === 101010256) {
    eocd = i;
    break;
  }
  if (eocd < 0) throw new Error("kein Zip (Zentralverzeichnis fehlt)");
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const out = [];
  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== 33639248) throw new Error("Zip: Eintrag beschädigt");
    const method = view.getUint16(p + 10, true), csize = view.getUint32(p + 20, true), usize = view.getUint32(p + 24, true);
    const nLen = view.getUint16(p + 28, true), eLen = view.getUint16(p + 30, true), cLen = view.getUint16(p + 32, true), lOff = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nLen));
    const ln = view.getUint16(lOff + 26, true), le = view.getUint16(lOff + 28, true), start = lOff + 30 + ln + le;
    out.push({ name, size: usize, method, data: buf.subarray(start, start + csize) });
    p += 46 + nLen + eLen + cLen;
  }
  return out;
}
const isZip = (buf) => buf.length > 4 && new DataView(buf.buffer, buf.byteOffset, 4).getUint32(0, true) === 67324752;
function jsonInZip(buf) {
  const e = zipEntries(buf).filter((x) => /\.json$/i.test(x.name) && !/^delta\b/i.test(x.name.split("/").pop())).sort((a, b) => b.size - a.size)[0];
  if (!e) throw new Error("Zip ohne .json der Veröffentlichung");
  return e;
}
async function inflateInBrowser(entry2) {
  if (entry2.method === 0) return entry2.data;
  if (entry2.method !== 8) throw new Error(`Zip-Methode ${entry2.method} nicht unterstützt`);
  const buf = await new Response(new Blob([entry2.data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer();
  return new Uint8Array(buf);
}
const lang = (code) => String(code ?? "").slice(0, 2).toLowerCase();
function isoDate(text) {
  const m2 = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(text ?? "").trim());
  return m2 ? `${m2[3]}-${m2[2].padStart(2, "0")}-${m2[1].padStart(2, "0")}` : String(text ?? "");
}
function parseGpc(text) {
  const doc = JSON.parse(text.charCodeAt(0) === 65279 ? text.slice(1) : text);
  if (!Array.isArray(doc?.Schema)) throw new Error("keine GPC-Datei (Schema fehlt)");
  const l = lang(doc.LanguageCode) || "en";
  const bricks = [], attributes = {}, values = {}, hierarchy = {};
  const count = { segments: 0, families: 0, classes: 0, bricks: 0, attributes: 0, values: 0 };
  const walk = (n, path) => {
    const code = String(n.Code);
    if (n.Level === LEVEL.brick) {
      count.bricks++;
      const a = [];
      for (const at of n.Childs ?? []) {
        const ac = String(at.Code);
        attributes[ac] = { [l]: at.Title };
        const vs = [];
        for (const v of at.Childs ?? []) {
          const vc = String(v.Code);
          values[vc] = { [l]: v.Title };
          vs.push(vc);
          count.values++;
        }
        a.push([ac, vs]);
        count.attributes++;
      }
      bricks.push({ code, path, t: { [l]: [n.Title, n.Definition ?? "", n.DefinitionExcludes ?? ""] }, a, active: n.Active !== false });
      return;
    }
    if (n.Level === LEVEL.segment) count.segments++;
    else if (n.Level === LEVEL.family) count.families++;
    else if (n.Level === LEVEL.class) count.classes++;
    hierarchy[code] = { [l]: n.Title };
    for (const c of n.Childs ?? []) walk(c, [...path, code]);
  };
  for (const s of doc.Schema) walk(s, []);
  const date = isoDate(doc.DateUtc);
  return { meta: { language: l, date, version: date.slice(0, 7), counts: count }, bricks, attributes, values, hierarchy };
}
const titleOf = (names, locale) => names?.[locale] ?? names?.en ?? Object.values(names ?? {})[0] ?? "";
const brickText = (brick, locale) => brick.t?.[locale] ?? brick.t?.en ?? Object.values(brick.t ?? {})[0] ?? ["", "", ""];
const pathText = (brick, hierarchy, locale) => brick.path.map((c) => titleOf(hierarchy?.[c], locale)).join(" › ");
const mergeNames = (a = {}, b = {}) => ({ ...a, ...b });
function mergeDict(have, add) {
  const out = { attributes: { ...have?.attributes ?? {} }, values: { ...have?.values ?? {} }, hierarchy: { ...have?.hierarchy ?? {} } };
  for (const k of ["attributes", "values", "hierarchy"]) for (const [c, n] of Object.entries(add[k] ?? {})) out[k][c] = mergeNames(out[k][c], n);
  return out;
}
function mergeBricks(have, add) {
  const byCode = new Map((have ?? []).map((b) => [b.code, b]));
  return add.map((b) => {
    const o = byCode.get(b.code);
    return o ? { ...b, t: mergeNames(o.t, b.t) } : b;
  });
}
function toRecords(rel, have = {}) {
  const bySeg = /* @__PURE__ */ new Map();
  for (const b of rel.bricks) {
    const s = b.path[0];
    if (!bySeg.has(s)) bySeg.set(s, []);
    bySeg.get(s).push(b);
  }
  const items = {};
  for (const [seg, list] of bySeg) items[`bricks:${seg}`] = { segment: seg, bricks: mergeBricks(have.bricks?.get?.(seg), list) };
  items.dict = mergeDict(have.dict, rel);
  const languages = [.../* @__PURE__ */ new Set([...have.release?.languages ?? [], rel.meta.language])];
  items.release = { key: rel.meta.version, version: rel.meta.version, date: rel.meta.date, languages, counts: rel.meta.counts };
  return items;
}
const norm = (s) => String(s ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
function searchBricks(bricks, hierarchy, query, locale = "en", limit = 60) {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const out = [];
  for (const b of bricks) {
    const [title, def] = brickText(b, locale);
    const name = norm(title), path = norm(pathText(b, hierarchy, locale)), defn = norm(def), code = b.code;
    let score = 0;
    for (const w of words) {
      if (code.startsWith(w)) score += 6;
      else if (name.startsWith(w)) score += 5;
      else if (name.includes(w)) score += 4;
      else if (path.includes(w)) score += 2;
      else if (defn.includes(w)) score += 1;
      else {
        score = 0;
        break;
      }
    }
    if (score > 0 && b.active !== false) out.push({ brick: b, score });
  }
  return out.sort((a, b) => b.score - a.score || a.brick.code.localeCompare(b.brick.code)).slice(0, limit).map((x) => x.brick);
}
const classAttr = () => "gpc_class";
const GROUP = "gpc";
const attrKey = (code) => `gpc${code}`;
function systemSpec(settings = {}) {
  return {
    group: settings.group || GROUP,
    groupLabel: { de: "GPC", en: "GPC" },
    classAttr: settings.classAttr || classAttr(),
    classLabel: { de: "GPC-Klasse", en: "GPC class" },
    classAttrAlternatives: ["gpc_klasse", "gpc_class_std"],
    ownPattern: "^gpc\\d+$"
  };
}
function classSpec(brick, hierarchy, locale = "en") {
  const names = {};
  for (const [lng, t2] of Object.entries(brick.t ?? {})) names[lng] = t2[0];
  return { code: brick.code, name: names, section: pathText(brick, hierarchy, locale) };
}
function featureSpecs(brick, dict, classesOf = null) {
  return brick.a.map(([ac, vs]) => ({
    key: attrKey(ac),
    name: dict.attributes?.[ac] ?? { en: ac },
    type: "enum",
    classes: classesOf?.get(ac) ?? [brick.code],
    target: attrKey(ac),
    values: vs.map((v) => ({ code: v, name: dict.values?.[v] ?? { en: v } }))
  }));
}
function classesByAttribute(bricks) {
  const m2 = /* @__PURE__ */ new Map();
  for (const b of bricks) for (const [ac] of b.a) {
    if (!m2.has(ac)) m2.set(ac, []);
    m2.get(ac).push(b.code);
  }
  return m2;
}
const _export_sfc = (sfc, props) => {
  const target = sfc.__vccOpts || sfc;
  for (const [key, val] of props) {
    target[key] = val;
  }
  return target;
};
const _hoisted_1 = {
  class: "pane",
  style: { "flex": "1" }
};
const _hoisted_2 = { class: "toolbar" };
const _hoisted_3 = { class: "grid form" };
const _hoisted_4 = { class: "step" };
const _hoisted_5 = {
  colspan: "2",
  class: "step-band",
  style: { "display": "table-cell", "height": "24px" }
};
const _hoisted_6 = { class: "attr" };
const _hoisted_7 = ["title"];
const _hoisted_8 = {
  key: 1,
  class: "muted"
};
const _hoisted_9 = { key: 0 };
const _hoisted_10 = ["title"];
const _hoisted_11 = { key: 1 };
const _hoisted_12 = { class: "attr" };
const _hoisted_13 = ["title"];
const _hoisted_14 = {
  key: 0,
  style: { "margin-left": "8px" }
};
const _hoisted_15 = ["title"];
const _hoisted_16 = {
  key: 1,
  class: "pos"
};
const _hoisted_17 = ["disabled"];
const _hoisted_18 = { class: "step" };
const _hoisted_19 = {
  colspan: "2",
  class: "step-band",
  style: { "display": "table-cell", "height": "24px" }
};
const _hoisted_20 = { class: "attr" };
const _hoisted_21 = ["placeholder", "disabled"];
const _hoisted_22 = { key: 2 };
const _hoisted_23 = {
  class: "picker",
  style: { "max-height": "240px", "overflow": "auto" }
};
const _hoisted_24 = ["title", "onClick"];
const _hoisted_25 = { class: "mono muted" };
const _hoisted_26 = { class: "muted" };
const _hoisted_27 = { key: 3 };
const _hoisted_28 = { class: "attr" };
const _hoisted_29 = {
  class: "muted",
  style: { "font-size": "12px", "white-space": "normal" }
};
const _hoisted_30 = {
  key: 0,
  class: "muted",
  style: { "font-size": "12px", "white-space": "normal" }
};
const _hoisted_31 = {
  class: "chips",
  style: { "margin-top": "4px" }
};
const _hoisted_32 = ["title"];
const _hoisted_33 = {
  key: 0,
  class: "muted"
};
const _hoisted_34 = { class: "attr" };
const _hoisted_35 = {
  class: "chips",
  style: { "margin": "2px 0 4px" }
};
const _hoisted_36 = {
  key: 0,
  class: "chip"
};
const _hoisted_37 = {
  key: 1,
  class: "muted"
};
const _hoisted_38 = ["title"];
const _hoisted_39 = ["disabled", "title"];
const _sfc_main = {
  __name: "View",
  setup(__props, { expose: __expose }) {
    const route = useRoute();
    const locale = computed(() => store.model?.masterLocale ?? "de");
    const busy = ref("");
    const fehler = ref("");
    const dragOver = ref(false);
    const release = ref(null);
    const dict = ref({ attributes: {}, values: {}, hierarchy: {} });
    const bricks = ref([]);
    const settings = ref({});
    const gelesen = ref(null);
    const gespeichert = ref({});
    const vorhaben = ref(null);
    const dateiOffen = ref(false);
    const byAttr = computed(() => classesByAttribute(bricks.value));
    const hatDaten = computed(() => bricks.value.length > 0);
    async function laden() {
      busy.value = t("lese …");
      try {
        const all = await api.get("/api/plugins/gpc/data?values=true");
        gespeichert.value = all;
        release.value = all.release ?? null;
        settings.value = all.settings ?? {};
        dict.value = all.dict ?? { attributes: {}, values: {}, hierarchy: {} };
        bricks.value = Object.entries(all).filter(([k]) => k.startsWith("bricks:")).flatMap(([, v]) => v.bricks ?? []);
        fehler.value = "";
      } catch (e) {
        fehler.value = e.message;
      } finally {
        busy.value = "";
      }
    }
    async function datei(file) {
      fehler.value = "";
      gelesen.value = null;
      busy.value = t("lese {0} …", [file.name]);
      try {
        let buf = new Uint8Array(await file.arrayBuffer());
        if (isZip(buf)) buf = await inflateInBrowser(jsonInZip(buf));
        gelesen.value = parseGpc(new TextDecoder().decode(buf));
        vorhaben.value = vergleichen(gelesen.value);
      } catch (e) {
        fehler.value = e.message;
      } finally {
        busy.value = "";
      }
    }
    function gewaehlt(e) {
      const f = e.target.files?.[0];
      if (f) datei(f);
      e.target.value = "";
    }
    function abgelegt(e) {
      dragOver.value = false;
      const f = e.dataTransfer?.files?.[0];
      if (f) datei(f);
    }
    function vergleichen(rel) {
      const have = { bricks: /* @__PURE__ */ new Map(), dict: dict.value, release: release.value };
      for (const b of bricks.value) {
        const s = b.path[0];
        if (!have.bricks.has(s)) have.bricks.set(s, []);
        have.bricks.get(s).push(b);
      }
      const alle = Object.entries(toRecords(rel, have));
      return { alle: alle.length, neu: alle.filter(([name, value]) => JSON.stringify(value) !== JSON.stringify(gespeichert.value[name])) };
    }
    async function uebernehmen() {
      if (!gelesen.value || !vorhaben.value?.neu.length) return;
      const items = vorhaben.value.neu;
      busy.value = t("übernehme …");
      try {
        let chunk = {}, size = 0, done = 0;
        const flush = async () => {
          if (!Object.keys(chunk).length) return;
          await api.post("/api/plugins/gpc/data", chunk, "PUT");
          chunk = {};
          size = 0;
        };
        for (const [name, value] of items) {
          const n = JSON.stringify(value).length;
          if (size + n > 3e6) await flush();
          chunk[name] = value;
          size += n;
          busy.value = t("übernehme … {0}/{1}", [++done, items.length]);
        }
        await flush();
        gelesen.value = null;
        vorhaben.value = null;
        dateiOffen.value = false;
        await laden();
        store.toast(t("✓ {0} Bricks übernommen", [bricks.value.length]), "ok");
      } catch (e) {
        fehler.value = e.message;
        busy.value = "";
      }
    }
    const suche = ref("");
    const treffer = computed(() => searchBricks(bricks.value, dict.value.hierarchy, suche.value, locale.value));
    const gewaehlterBrick = ref(null);
    const ziel = ref(route.query.node ? String(route.query.node) : "");
    const zielZeile = computed(() => ziel.value ? tree.byId?.get(ziel.value) ?? null : null);
    const aktuell = ref(null);
    async function zielLesen() {
      aktuell.value = null;
      if (!ziel.value) return;
      try {
        const n = await api.get(`/api/nodes/${encodeURIComponent(ziel.value)}`);
        const key = settings.value.classAttr || systemSpec().classAttr;
        const eigen = n.values?.find((v) => v.attribute === key && !v.locale && !v.channel && !v.row)?.value;
        if (eigen) {
          aktuell.value = { code: String(eigen), geerbt: false };
          return;
        }
        for (const a of n.ancestors ?? []) {
          const v = a.values?.find((v2) => v2.attribute === key && !v2.locale && !v2.channel)?.value;
          if (v) {
            aktuell.value = { code: String(v), geerbt: true, von: a.label };
            return;
          }
        }
      } catch {
      }
    }
    function zielWahl(id) {
      ziel.value = id || "";
      zielLesen();
    }
    const brickTitel = (b) => brickText(b, locale.value)[0];
    const weg = (b) => pathText(b, dict.value.hierarchy, locale.value);
    const attributName = (ac) => titleOf(dict.value.attributes?.[ac], locale.value);
    const brickVon = (code) => bricks.value.find((b) => b.code === code);
    function klassenFuer(brick) {
      const key = settings.value.classAttr || systemSpec().classAttr;
      const list = (store.model?.lists ?? []).find((l) => l.key === key);
      const a = (store.model?.attributes ?? []).find((x) => x.key === key);
      const fremd = a && !(a.group === (settings.value.group || systemSpec().group) || a.type === "enum" && a.list === key);
      const have = !list || fremd || !(list.columns ?? []).includes("group") ? /* @__PURE__ */ new Set() : new Set((list.values ?? []).map((v) => v.value));
      const out = bricks.value.filter((b) => !have.has(b.code));
      if (!out.some((b) => b.code === brick.code)) out.push(brick);
      return out.map((b) => classSpec(b, dict.value.hierarchy, locale.value));
    }
    async function zuweisen() {
      const b = gewaehlterBrick.value;
      if (!b || !ziel.value) return;
      busy.value = t("weise {0} zu …", [b.code]);
      fehler.value = "";
      try {
        const r = await api.post("/api/classification/assign", {
          node: ziel.value,
          class: b.code,
          system: systemSpec(settings.value),
          classes: klassenFuer(b),
          features: featureSpecs(b, dict.value, byAttr.value)
        });
        if (r.groupRenamed || r.classAttrRenamed) {
          settings.value = { ...settings.value, group: r.group, classAttr: r.classAttr };
          await api.post("/api/plugins/gpc/data/settings", settings.value, "PUT");
        }
        await store.poll?.(true);
        await tree.load?.(true);
        const rd = r.readiness;
        store.toast(rd.ready ? t("✓ {0} an {1}", [b.code, zielZeile.value?.label ?? ziel.value]) : t("⚠ {0} an {1}: {2}", [b.code, zielZeile.value?.label ?? ziel.value, !rd.groupExists ? t("Gruppe fehlt") : !rd.groupOn ? t("Gruppe gilt hier nicht") : t("{0} ohne Attribut", [rd.missing.length])]), rd.ready ? "ok" : "error");
        await zielLesen();
      } catch (e) {
        fehler.value = e.message;
      } finally {
        busy.value = "";
      }
    }
    onMounted(async () => {
      if (!tree.loaded) await tree.load?.();
      await laden();
      await zielLesen();
    });
    __expose({ release, bricks, dict, gelesen, vorhaben, dateiOffen, suche, treffer, gewaehlterBrick, ziel, aktuell, datei, uebernehmen, zuweisen, laden, zielWahl });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createElementVNode("div", _hoisted_2, [
          createElementVNode(
            "h1",
            null,
            toDisplayString(_ctx.$t("⌗ GPC")),
            1
            /* TEXT */
          ),
          _cache[4] || (_cache[4] = createElementVNode(
            "span",
            { class: "grow" },
            null,
            -1
            /* CACHED */
          )),
          createElementVNode(
            "span",
            {
              class: normalizeClass(fehler.value ? "fehler" : "muted")
            },
            toDisplayString(fehler.value ? "✗ " + fehler.value : busy.value),
            3
            /* TEXT, CLASS */
          )
        ]),
        createElementVNode("table", _hoisted_3, [
          _cache[8] || (_cache[8] = createElementVNode(
            "colgroup",
            null,
            [
              createElementVNode("col", { style: { "width": "96px" } }),
              createElementVNode("col")
            ],
            -1
            /* CACHED */
          )),
          createElementVNode("tbody", null, [
            createElementVNode("tr", _hoisted_4, [
              createElementVNode(
                "td",
                _hoisted_5,
                toDisplayString(_ctx.$t("1 · Veröffentlichung")),
                1
                /* TEXT */
              )
            ]),
            createElementVNode("tr", null, [
              createElementVNode(
                "td",
                _hoisted_6,
                toDisplayString(_ctx.$t("Stand")),
                1
                /* TEXT */
              ),
              createElementVNode("td", null, [
                release.value ? (openBlock(), createElementBlock("span", {
                  key: 0,
                  title: _ctx.$t("Sprachen: {0}", [(release.value.languages ?? []).join(", ")])
                }, toDisplayString(release.value.version) + " · " + toDisplayString(release.value.date) + " · " + toDisplayString(_ctx.$t("{0} Bricks", [bricks.value.length])), 9, _hoisted_7)) : (openBlock(), createElementBlock(
                  "span",
                  _hoisted_8,
                  toDisplayString(_ctx.$t("nichts übernommen")),
                  1
                  /* TEXT */
                ))
              ])
            ]),
            release.value && !dateiOffen.value && !gelesen.value ? (openBlock(), createElementBlock("tr", _hoisted_9, [
              _cache[5] || (_cache[5] = createElementVNode(
                "td",
                { class: "attr" },
                null,
                -1
                /* CACHED */
              )),
              createElementVNode("td", null, [
                createElementVNode("button", {
                  title: _ctx.$t("Die Veröffentlichung ist übernommen; eine Datei braucht es nur für eine weitere Fassung oder Sprache"),
                  onClick: _cache[0] || (_cache[0] = ($event) => dateiOffen.value = true)
                }, toDisplayString(_ctx.$t("Weitere Fassung oder Sprache …")), 9, _hoisted_10)
              ])
            ])) : (openBlock(), createElementBlock("tr", _hoisted_11, [
              createElementVNode(
                "td",
                _hoisted_12,
                toDisplayString(_ctx.$t("Datei")),
                1
                /* TEXT */
              ),
              createElementVNode("td", null, [
                createElementVNode("label", {
                  class: normalizeClass(["drop", { over: dragOver.value }]),
                  onDragover: _cache[1] || (_cache[1] = withModifiers(($event) => dragOver.value = true, ["prevent"])),
                  onDragleave: _cache[2] || (_cache[2] = ($event) => dragOver.value = false),
                  onDrop: withModifiers(abgelegt, ["prevent"]),
                  title: _ctx.$t("GPC-Paket (.zip) oder die .json darin; holen unter gpc-browser.gs1.org")
                }, [
                  createElementVNode(
                    "input",
                    {
                      type: "file",
                      accept: ".zip,.json",
                      style: { "display": "none" },
                      onChange: gewaehlt
                    },
                    null,
                    32
                    /* NEED_HYDRATION */
                  ),
                  createTextVNode(
                    toDisplayString(_ctx.$t("Datei wählen oder hierher ziehen")),
                    1
                    /* TEXT */
                  )
                ], 42, _hoisted_13),
                gelesen.value ? (openBlock(), createElementBlock("span", _hoisted_14, [
                  createTextVNode(
                    toDisplayString(gelesen.value.meta.version) + " · " + toDisplayString(gelesen.value.meta.language.toUpperCase()) + " · " + toDisplayString(_ctx.$t("{0} Bricks", [gelesen.value.meta.counts.bricks])) + " ",
                    1
                    /* TEXT */
                  ),
                  vorhaben.value?.neu.length ? (openBlock(), createElementBlock("span", {
                    key: 0,
                    title: _ctx.$t("Nur Datensätze, die im Journal fehlen oder anders sind, werden geschrieben")
                  }, "· " + toDisplayString(_ctx.$t("{0} von {1} Datensätzen neu oder geändert", [vorhaben.value.neu.length, vorhaben.value.alle])), 9, _hoisted_15)) : (openBlock(), createElementBlock(
                    "span",
                    _hoisted_16,
                    "· " + toDisplayString(_ctx.$t("schon im Journal")),
                    1
                    /* TEXT */
                  )),
                  createElementVNode("button", {
                    class: "primary",
                    disabled: !!busy.value || !vorhaben.value?.neu.length,
                    onClick: uebernehmen
                  }, toDisplayString(_ctx.$t("übernehmen")), 9, _hoisted_17)
                ])) : createCommentVNode("v-if", true)
              ])
            ])),
            createElementVNode("tr", _hoisted_18, [
              createElementVNode(
                "td",
                _hoisted_19,
                toDisplayString(_ctx.$t("2 · Klasse zuweisen")),
                1
                /* TEXT */
              )
            ]),
            createElementVNode("tr", null, [
              createElementVNode(
                "td",
                _hoisted_20,
                toDisplayString(_ctx.$t("Suche")),
                1
                /* TEXT */
              ),
              createElementVNode("td", null, [
                withDirectives(createElementVNode("input", {
                  "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => suche.value = $event),
                  type: "text",
                  placeholder: _ctx.$t("Code, Titel oder Weg"),
                  disabled: !hatDaten.value,
                  style: { "width": "100%" }
                }, null, 8, _hoisted_21), [
                  [vModelText, suche.value]
                ])
              ])
            ]),
            treffer.value.length ? (openBlock(), createElementBlock("tr", _hoisted_22, [
              _cache[6] || (_cache[6] = createElementVNode(
                "td",
                { class: "attr" },
                null,
                -1
                /* CACHED */
              )),
              createElementVNode("td", null, [
                createElementVNode("div", _hoisted_23, [
                  (openBlock(true), createElementBlock(
                    Fragment,
                    null,
                    renderList(treffer.value, (b) => {
                      return openBlock(), createElementBlock("div", {
                        key: b.code,
                        class: normalizeClass(["pick", { current: gewaehlterBrick.value?.code === b.code }]),
                        title: weg(b),
                        onClick: ($event) => gewaehlterBrick.value = b
                      }, [
                        createElementVNode(
                          "span",
                          _hoisted_25,
                          toDisplayString(b.code),
                          1
                          /* TEXT */
                        ),
                        createTextVNode(
                          " " + toDisplayString(brickTitel(b)) + " ",
                          1
                          /* TEXT */
                        ),
                        createElementVNode(
                          "span",
                          _hoisted_26,
                          "· " + toDisplayString(weg(b)),
                          1
                          /* TEXT */
                        )
                      ], 10, _hoisted_24);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ])
              ])
            ])) : createCommentVNode("v-if", true),
            gewaehlterBrick.value ? (openBlock(), createElementBlock("tr", _hoisted_27, [
              createElementVNode(
                "td",
                _hoisted_28,
                toDisplayString(_ctx.$t("Brick")),
                1
                /* TEXT */
              ),
              createElementVNode("td", null, [
                createElementVNode(
                  "b",
                  null,
                  toDisplayString(gewaehlterBrick.value.code) + " " + toDisplayString(brickTitel(gewaehlterBrick.value)),
                  1
                  /* TEXT */
                ),
                createElementVNode(
                  "div",
                  _hoisted_29,
                  toDisplayString(unref(brickText)(gewaehlterBrick.value, locale.value)[1]),
                  1
                  /* TEXT */
                ),
                unref(brickText)(gewaehlterBrick.value, locale.value)[2] ? (openBlock(), createElementBlock(
                  "div",
                  _hoisted_30,
                  toDisplayString(unref(brickText)(gewaehlterBrick.value, locale.value)[2]),
                  1
                  /* TEXT */
                )) : createCommentVNode("v-if", true),
                createElementVNode("div", _hoisted_31, [
                  (openBlock(true), createElementBlock(
                    Fragment,
                    null,
                    renderList(gewaehlterBrick.value.a, ([ac, vs]) => {
                      return openBlock(), createElementBlock("span", {
                        key: ac,
                        class: "chip",
                        title: _ctx.$t("{0} Werte", [vs.length])
                      }, toDisplayString(attributName(ac)) + " · " + toDisplayString(vs.length), 9, _hoisted_32);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  )),
                  !gewaehlterBrick.value.a.length ? (openBlock(), createElementBlock(
                    "span",
                    _hoisted_33,
                    toDisplayString(_ctx.$t("keine Attribute")),
                    1
                    /* TEXT */
                  )) : createCommentVNode("v-if", true)
                ])
              ])
            ])) : createCommentVNode("v-if", true),
            createElementVNode("tr", null, [
              createElementVNode(
                "td",
                _hoisted_34,
                toDisplayString(_ctx.$t("Knoten")),
                1
                /* TEXT */
              ),
              createElementVNode("td", null, [
                createElementVNode("div", _hoisted_35, [
                  zielZeile.value ? (openBlock(), createElementBlock(
                    "span",
                    _hoisted_36,
                    toDisplayString(unref(icon)(zielZeile.value.role)) + " " + toDisplayString(zielZeile.value.label),
                    1
                    /* TEXT */
                  )) : (openBlock(), createElementBlock(
                    "span",
                    _hoisted_37,
                    toDisplayString(_ctx.$t("Knoten wählen")),
                    1
                    /* TEXT */
                  )),
                  aktuell.value ? (openBlock(), createElementBlock("span", {
                    key: 2,
                    class: "muted",
                    title: aktuell.value.geerbt ? _ctx.$t("geerbt von {0}", [aktuell.value.von]) : _ctx.$t("eigene Klasse")
                  }, toDisplayString(aktuell.value.code) + toDisplayString(brickVon(aktuell.value.code) ? " " + brickTitel(brickVon(aktuell.value.code)) : "") + toDisplayString(aktuell.value.geerbt ? " ↑" : ""), 9, _hoisted_38)) : createCommentVNode("v-if", true)
                ]),
                createVNode(unref(TreePicker), {
                  "model-value": ziel.value,
                  roles: ["group", "product", "variant"],
                  height: 200,
                  "onUpdate:modelValue": zielWahl
                }, null, 8, ["model-value"])
              ])
            ]),
            createElementVNode("tr", null, [
              _cache[7] || (_cache[7] = createElementVNode(
                "td",
                { class: "attr" },
                null,
                -1
                /* CACHED */
              )),
              createElementVNode("td", null, [
                createElementVNode("button", {
                  class: "primary",
                  disabled: !gewaehlterBrick.value || !ziel.value || !!busy.value,
                  title: _ctx.$t("Gruppe, Klassenattribut und Attribute anlegen, Klasse am Knoten setzen"),
                  onClick: zuweisen
                }, toDisplayString(_ctx.$t("✓ zuweisen")), 9, _hoisted_39)
              ])
            ])
          ])
        ])
      ]);
    };
  }
};
const View = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-af97dff8"]]);
async function install(ctx) {
  const { api: api2, store: store2, tree: tree2 } = ctx;
  if (!tree2.loaded) await tree2.load();
  const settings = await api2.get("/api/plugins/gpc/data/settings").catch(() => null) ?? {};
  const r = await api2.post("/api/classification/ensure", { system: systemSpec(settings), groupOnly: true });
  const group = r?.group ?? systemSpec(settings).group;
  if (r?.groupRenamed) await api2.post("/api/plugins/gpc/data/settings", { ...settings, group }, "PUT");
  await store2.poll?.(true);
  for (const root of tree2.rows.filter((row) => !row.parent && row.role !== "rubric")) {
    const have = (root.groups ?? "").split(",").filter(Boolean);
    if (!have.includes(group)) await api2.post(`/api/nodes/${encodeURIComponent(root.id)}/groups`, { groups: [...have, group] }, "PUT");
  }
  await store2.poll?.(true);
  await tree2.load?.(true);
}
const entry = {
  install,
  views: [{ path: "gpc", topic: "classification", label: "GPC", icon: "⌗", hint: t("GPC-Veröffentlichung einlesen, Brick suchen und einem Knoten zuweisen"), component: View }],
  nodeActions: [{
    label: t("GPC-Klasse (+)"),
    icon: "⌗",
    topic: "classification",
    roles: ["group", "product"],
    hint: t("Brick wählen und diesem Knoten zuweisen"),
    run: (id, ctx) => ctx.go(`/p/gpc/gpc?node=${encodeURIComponent(id)}`)
  }]
};
export {
  entry as default
};
