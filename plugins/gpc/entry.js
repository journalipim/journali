(function(){const s=document.createElement('style');s.textContent="\n.klasse[data-v-09f8f74a] { display: flex; flex-direction: column; flex: 1; min-height: 0; font-size: 13px;\n}\n.klasse.modal[data-v-09f8f74a] { width: min(820px, 94vw); max-height: 88vh; background: var(--pane); border: 1px solid var(--line); border-radius: 8px; box-shadow: 0 12px 32px rgba(0,0,0,.4);\n}\n.kopf[data-v-09f8f74a], .fuss[data-v-09f8f74a] { padding: 8px 12px;\n}\n.fuss[data-v-09f8f74a] { border-top: 1px solid var(--line);\n}\n.koerper[data-v-09f8f74a] { padding: 8px 12px; flex: 1;\n}\n.zeile[data-v-09f8f74a] { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding: 3px 0;\n}\n.attr[data-v-09f8f74a] { color: var(--muted); min-width: 64px;\n}\n.kl[data-v-09f8f74a] { font-size: 12px; padding: 2px 0;\n}\n.drop[data-v-09f8f74a] { display: inline-block; padding: 2px 10px; border: 1px dashed var(--line); border-radius: 6px; cursor: pointer;\n}\n.drop.over[data-v-09f8f74a] { outline: 2px dashed var(--accent); outline-offset: -2px;\n}\n.recent[data-v-09f8f74a] { display: inline-flex; gap: 4px; flex-wrap: wrap;\n}\n.recent .chip[data-v-09f8f74a] { cursor: pointer;\n}\n.recent .chip.dim[data-v-09f8f74a] { opacity: .55; cursor: default;\n}\nbutton.on[data-v-09f8f74a] { background: var(--accent-soft);\n}\n.suche[data-v-09f8f74a] { width: 100%; margin: 6px 0; box-sizing: border-box;\n}\n.liste[data-v-09f8f74a] { max-height: 300px; overflow: auto; border: 1px solid var(--line); border-radius: 6px;\n}\n.pick[data-v-09f8f74a] { cursor: pointer; padding: 1px 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;\n}\n.pick[data-v-09f8f74a]:hover { background: var(--hover);\n}\n.pick.current[data-v-09f8f74a] { background: var(--accent-soft);\n}\n.ein[data-v-09f8f74a] { padding-left: 16px;\n}\n.caret[data-v-09f8f74a] { display: inline-block; width: 14px; color: var(--muted);\n}\n.brick[data-v-09f8f74a] { margin-top: 8px; padding: 6px 8px; border: 1px solid var(--accent); border-radius: 6px;\n}\n";document.head.append(s)})();
const m$1 = window.journali.vue;
const Fragment = m$1.Fragment;
const computed = m$1.computed;
const createApp = m$1.createApp;
const createBlock = m$1.createBlock;
const createCommentVNode = m$1.createCommentVNode;
const createElementBlock = m$1.createElementBlock;
const createElementVNode = m$1.createElementVNode;
const createTextVNode = m$1.createTextVNode;
const h$1 = m$1.h;
const normalizeClass = m$1.normalizeClass;
const onMounted = m$1.onMounted;
const onUnmounted = m$1.onUnmounted;
const openBlock = m$1.openBlock;
const ref = m$1.ref;
const renderList = m$1.renderList;
const toDisplayString = m$1.toDisplayString;
const unref = m$1.unref;
const vModelText = m$1.vModelText;
const watch = m$1.watch;
const withDirectives = m$1.withDirectives;
const withModifiers = m$1.withModifiers;
const h = window.journali;
const api = h.api;
const store = h.store;
const tree = h.tree;
const icon = h.icon;
const recentFiles = h.recentFiles;
const dialog = h.dialog;
const ai = h.ai;
const t = h.t;
const TreePicker = h.TreePicker;
const m = window.journali.vueRouter;
const useRoute = m.useRoute;
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
const classAttr = () => "class_gpc";
const GROUP = "class_gpc";
const attrKey = (code) => `gpc${code}`;
function systemSpec(settings = {}) {
  return {
    group: settings.group || GROUP,
    groupLabel: { de: "GPC", en: "GPC" },
    classAttr: settings.classAttr || classAttr(),
    classLabel: { de: "GPC-Klasse", en: "GPC class" },
    classAttrAlternatives: ["gpc_klasse", "gpc_class_std"],
    ownPattern: "^gpc\\d+$",
    plugin: "gpc"
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
const schluessel = (settings) => {
  const s = systemSpec(settings ?? {});
  return { group: s.group, classAttr: s.classAttr };
};
const klassenGruppe = (group, code) => `${group}_${String(code ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}`;
async function klasseAm(api2, nodeId, classAttr2) {
  const n = await api2.get(`/api/nodes/${encodeURIComponent(nodeId)}`);
  const eigen = n.values?.find((v) => v.attribute === classAttr2 && !v.locale && !v.channel && !v.row)?.value;
  if (eigen) return { node: n, code: String(eigen), geerbt: false };
  for (const a of n.ancestors ?? []) {
    const v = a.values?.find((v2) => v2.attribute === classAttr2 && !v2.locale && !v2.channel)?.value;
    if (v) return { node: n, code: String(v), geerbt: true, von: a.label, vonId: a.id };
  }
  return { node: n, code: null, geerbt: false };
}
const gruppeGilt = (node, group) => (node?.groups ?? []).some((g) => g.key === group && g.active !== false);
const _export_sfc = (sfc, props) => {
  const target = sfc.__vccOpts || sfc;
  for (const [key, val] of props) {
    target[key] = val;
  }
  return target;
};
const _hoisted_1$2 = { class: "toolbar kopf" };
const _hoisted_2$1 = {
  class: "muted",
  style: { "font-size": "12px" }
};
const _hoisted_3$1 = ["title"];
const _hoisted_4$1 = { class: "scroll koerper" };
const _hoisted_5$1 = { class: "zeile" };
const _hoisted_6$1 = { class: "attr" };
const _hoisted_7$1 = ["title"];
const _hoisted_8$1 = {
  key: 1,
  class: "muted"
};
const _hoisted_9$1 = ["title"];
const _hoisted_10 = {
  key: 0,
  class: "zeile"
};
const _hoisted_11 = ["title"];
const _hoisted_12 = ["disabled"];
const _hoisted_13 = {
  key: 1,
  class: "zeile quelle"
};
const _hoisted_14 = { class: "attr" };
const _hoisted_15 = ["title"];
const _hoisted_16 = ["title", "onClick"];
const _hoisted_17 = ["title"];
const _hoisted_18 = { key: 1 };
const _hoisted_19 = ["title"];
const _hoisted_20 = {
  key: 1,
  class: "pos"
};
const _hoisted_21 = ["disabled"];
const _hoisted_22 = { class: "zeile" };
const _hoisted_23 = { class: "attr" };
const _hoisted_24 = {
  key: 0,
  class: "chip"
};
const _hoisted_25 = {
  key: 1,
  class: "muted"
};
const _hoisted_26 = ["title"];
const _hoisted_27 = {
  key: 4,
  class: "muted"
};
const _hoisted_28 = { class: "step-band" };
const _hoisted_29 = ["disabled", "title"];
const _hoisted_30 = ["title", "onClick"];
const _hoisted_31 = { class: "mono muted" };
const _hoisted_32 = { class: "muted" };
const _hoisted_33 = {
  key: 0,
  class: "muted kl"
};
const _hoisted_34 = {
  key: 1,
  class: "ai kl"
};
const _hoisted_35 = {
  key: 2,
  class: "ai kl"
};
const _hoisted_36 = { key: 0 };
const _hoisted_37 = ["onClick"];
const _hoisted_38 = { class: "mono muted" };
const _hoisted_39 = { class: "muted" };
const _hoisted_40 = {
  key: 3,
  class: "muted kl"
};
const _hoisted_41 = ["placeholder"];
const _hoisted_42 = {
  key: 4,
  class: "liste"
};
const _hoisted_43 = ["title", "onClick"];
const _hoisted_44 = { class: "mono muted" };
const _hoisted_45 = { class: "muted" };
const _hoisted_46 = {
  key: 0,
  class: "muted kl"
};
const _hoisted_47 = {
  key: 5,
  class: "liste baum"
};
const _hoisted_48 = ["onClick"];
const _hoisted_49 = { class: "caret" };
const _hoisted_50 = { class: "muted" };
const _hoisted_51 = {
  key: 0,
  class: "ein"
};
const _hoisted_52 = ["onClick"];
const _hoisted_53 = { class: "caret" };
const _hoisted_54 = { class: "muted" };
const _hoisted_55 = {
  key: 0,
  class: "ein"
};
const _hoisted_56 = ["onClick"];
const _hoisted_57 = { class: "caret" };
const _hoisted_58 = { class: "muted" };
const _hoisted_59 = {
  key: 0,
  class: "ein"
};
const _hoisted_60 = ["onClick"];
const _hoisted_61 = { class: "mono muted" };
const _hoisted_62 = {
  key: 4,
  class: "brick"
};
const _hoisted_63 = {
  class: "muted",
  style: { "font-size": "12px" }
};
const _hoisted_64 = {
  class: "muted",
  style: { "font-size": "12px", "white-space": "normal" }
};
const _hoisted_65 = {
  key: 0,
  class: "muted",
  style: { "font-size": "12px", "white-space": "normal" }
};
const _hoisted_66 = {
  class: "chips",
  style: { "margin-top": "4px" }
};
const _hoisted_67 = ["title"];
const _hoisted_68 = {
  key: 0,
  class: "muted"
};
const _hoisted_69 = { class: "toolbar fuss" };
const _hoisted_70 = {
  class: "muted",
  style: { "font-size": "12px" }
};
const _hoisted_71 = ["disabled", "title"];
const RECENT = "gpc";
const _sfc_main$2 = {
  __name: "Klasse",
  props: { node: { type: String, default: "" }, modal: Boolean },
  emits: ["close", "done"],
  setup(__props, { expose: __expose, emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const locale = computed(() => store.model?.masterLocale ?? "de");
    const busy = ref("");
    const fehler = ref("");
    const dragOver = ref(false);
    const release = ref(null);
    const dict = ref({ attributes: {}, values: {}, hierarchy: {} });
    const bricks = ref([]);
    const settings = ref({});
    const gespeichert = ref({});
    const gelesen = ref(null);
    const vorhaben = ref(null);
    const quelleOffen = ref(false);
    const recent = ref([]);
    const byAttr = computed(() => classesByAttribute(bricks.value));
    const hatDaten = computed(() => bricks.value.length > 0);
    const schl = computed(() => schluessel(settings.value));
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
    async function merken() {
      try {
        recent.value = await recentFiles.list(RECENT);
      } catch {
        recent.value = [];
      }
    }
    async function datei(file, handle = null) {
      fehler.value = "";
      gelesen.value = null;
      busy.value = t("lese {0} …", [file.name]);
      try {
        let buf = new Uint8Array(await file.arrayBuffer());
        if (isZip(buf)) buf = await inflateInBrowser(jsonInZip(buf));
        gelesen.value = parseGpc(new TextDecoder().decode(buf));
        vorhaben.value = vergleichen(gelesen.value);
        recentFiles.remember(RECENT, file.name, handle).then(merken).catch(() => {
        });
      } catch (e) {
        fehler.value = e.message;
      } finally {
        busy.value = "";
      }
    }
    const canPick = typeof window !== "undefined" && typeof window.showOpenFilePicker === "function";
    async function waehlen(e) {
      if (!canPick) return;
      e.preventDefault();
      try {
        const [h2] = await window.showOpenFilePicker({ multiple: false, types: [{ description: "GPC", accept: { "application/octet-stream": [".zip", ".json"] } }] });
        await datei(await h2.getFile(), h2);
      } catch (err) {
        if (err?.name !== "AbortError") fehler.value = err.message;
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
    async function wiederOeffnen(r) {
      const f = await recentFiles.reopen(r);
      if (!f) {
        store.toast(r.handle ? t("{0}: nicht mehr lesbar — neu wählen", [r.name]) : t("{0}: war hineingezogen — wieder ziehen oder wählen", [r.name]));
        return;
      }
      await datei(f, r.handle);
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
        quelleOffen.value = false;
        await laden();
        store.toast(t("✓ {0} Bricks übernommen", [bricks.value.length]), "ok");
      } catch (e) {
        fehler.value = e.message;
        busy.value = "";
      }
    }
    const ziel = ref(props.node || "");
    const zielWahlOffen = ref(!props.node && !props.modal);
    const zielZeile = computed(() => ziel.value ? tree.byId?.get(ziel.value) ?? null : null);
    const weg = computed(() => zielZeile.value ? (tree.ancestors?.(zielZeile.value.id) ?? []).map((a) => a.label) : []);
    const aktuell = ref(null);
    async function zielLesen() {
      aktuell.value = null;
      if (!ziel.value) return;
      try {
        const k = await klasseAm(api, ziel.value, schl.value.classAttr);
        if (k.code) aktuell.value = { code: k.code, geerbt: k.geerbt, von: k.von };
      } catch {
      }
    }
    function zielWahl(id) {
      ziel.value = id || "";
      zielWahlOffen.value = false;
      zielLesen();
      umfeldLesen();
      ki.value = null;
    }
    const brickTitel = (b) => brickText(b, locale.value)[0];
    const wegText = (b) => pathText(b, dict.value.hierarchy, locale.value);
    const attributName = (ac) => titleOf(dict.value.attributes?.[ac], locale.value);
    const brickVon = (code) => bricks.value.find((b) => b.code === code);
    const brickZeile = (code) => {
      const b = brickVon(code);
      return b ? `${code} ${brickTitel(b)}` : code;
    };
    const umfeld = ref([]);
    async function umfeldLesen() {
      umfeld.value = [];
      const row = zielZeile.value;
      if (!row || !hatDaten.value) return;
      const key = schl.value.classAttr, zaehle = /* @__PURE__ */ new Map();
      const lies = async (url) => {
        try {
          const t2 = await api.get(url);
          for (const r of t2.rows ?? []) {
            const c = String(r.values?.[key]?.value ?? "").trim();
            if (c && r.row?.id !== row.id) zaehle.set(c, (zaehle.get(c) ?? 0) + 1);
          }
        } catch {
        }
      };
      if (row.parent) await lies(`/api/nodes/${encodeURIComponent(row.parent)}/table?attributes=${encodeURIComponent(key)}`);
      await lies(`/api/nodes/${encodeURIComponent(row.id)}/table?deep=true&attributes=${encodeURIComponent(key)}`);
      umfeld.value = [...zaehle].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([code, n]) => ({ code, n }));
    }
    const kiBereit = computed(() => !!ai?.available?.());
    const ki = ref(null);
    async function kiFragen() {
      const row = zielZeile.value;
      if (!row || !hatDaten.value) return;
      ki.value = { busy: true, liste: [] };
      try {
        const h2 = dict.value.hierarchy;
        const famText = (b) => `${titleOf(h2[b.path[0]], "en")} › ${titleOf(h2[b.path[1]], "en")}`;
        const familien = [...new Set(bricks.value.map(famText))].sort();
        const produkt = `Produkt: ${row.label}
Pfad: ${weg.value.join(" › ")}`;
        const g = await ai.ask({
          system: t('Du ordnest Produkte GPC-Familien zu. Antworte nur als JSON {"familien":["…","…"]} mit 1 bis 3 Namen exakt aus der Liste.'),
          user: `${produkt}
Familien:
${familien.join("\n")}`,
          json: true,
          maxTokens: 200,
          purpose: t("Klassifikation")
        });
        const gewaehlt2 = (g.familien ?? []).filter((x) => familien.includes(x));
        if (!gewaehlt2.length) throw new Error(t("keine Familie erkannt"));
        const kand = bricks.value.filter((b) => gewaehlt2.includes(famText(b)) && b.active !== false);
        const liste = kand.map((b) => `${b.code} ${brickText(b, "en")[0]}`).join("\n");
        const j = await ai.ask({
          system: t('Du ordnest ein Produkt genau einem GPC-Brick zu. Antworte nur als JSON {"vorschlaege":[{"code":"…","warum":"…"}]} mit 1 bis 3 Vorschlägen, Codes exakt aus der Liste, bester zuerst, warum in einem kurzen Satz auf Deutsch.'),
          user: `${produkt}
Bricks:
${liste}`,
          json: true,
          maxTokens: 400,
          purpose: t("Klassifikation")
        });
        const aus = (j.vorschlaege ?? []).map((s) => ({ code: String(s.code), warum: s.warum ?? "" })).filter((s) => kand.some((b) => b.code === s.code));
        ki.value = { busy: false, familien: gewaehlt2, liste: aus };
      } catch (e) {
        ki.value = { busy: false, liste: [], fehler: e.message };
      }
    }
    const suche = ref("");
    const treffer = computed(() => searchBricks(bricks.value, dict.value.hierarchy, suche.value, locale.value));
    const gewaehlterBrick = ref(null);
    const offen = ref({});
    const umschalten = (code) => {
      offen.value = { ...offen.value, [code]: !offen.value[code] };
    };
    const titel = (code) => titleOf(dict.value.hierarchy?.[code], locale.value);
    const baum = computed(() => {
      const segs = /* @__PURE__ */ new Map();
      for (const b of bricks.value) {
        if (b.active === false) continue;
        const [s, f, c] = b.path;
        const S = segs.get(s) ?? segs.set(s, { code: s, count: 0, fam: /* @__PURE__ */ new Map() }).get(s);
        const F = S.fam.get(f) ?? S.fam.set(f, { code: f, count: 0, cls: /* @__PURE__ */ new Map() }).get(f);
        const C = F.cls.get(c) ?? F.cls.set(c, { code: c, count: 0, bricks: [] }).get(c);
        S.count++;
        F.count++;
        C.count++;
        C.bricks.push(b);
      }
      const sort = (arr, name) => arr.sort((a, b) => name(a).localeCompare(name(b)));
      return sort([...segs.values()], (x) => titel(x.code)).map((S) => ({
        ...S,
        fam: sort([...S.fam.values()], (x) => titel(x.code)).map((F) => ({
          ...F,
          cls: sort([...F.cls.values()], (x) => titel(x.code)).map((C) => ({ ...C, bricks: sort(C.bricks, brickTitel) }))
        }))
      }));
    });
    const umstellung = ref(null);
    async function umstellungPruefen() {
      try {
        const r = await api.post("/api/classification/migrate", { system: systemSpec(settings.value), dryRun: true });
        umstellung.value = r?.attributes || r?.nodes ? r : null;
      } catch {
        umstellung.value = null;
      }
    }
    async function umstellen() {
      busy.value = t("stelle um …");
      fehler.value = "";
      try {
        const r = await api.post("/api/classification/migrate", { system: systemSpec(settings.value), dryRun: false });
        await store.poll?.(true);
        await tree.load?.(true);
        store.toast(t("✓ {0} Gruppen, {1} Attribute, {2} Knoten umgestellt", [r.groups, r.attributes, r.nodes]), "ok");
        umstellung.value = null;
        await zielLesen();
      } catch (e) {
        fehler.value = e.message;
      } finally {
        busy.value = "";
      }
    }
    function klassenFuer(brick) {
      const key = schl.value.classAttr;
      const list = (store.model?.lists ?? []).find((l) => l.key === key);
      const a = (store.model?.attributes ?? []).find((x) => x.key === key);
      const fremd = a && !(a.group === schl.value.group || a.type === "enum" && a.list === key);
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
        const rd = r.readiness, name = zielZeile.value?.label ?? ziel.value;
        store.toast(rd.ready ? t("✓ {0} an {1}", [b.code, name]) : t("⚠ {0} an {1}: {2}", [b.code, name, !rd.groupExists ? t("Gruppe fehlt") : !rd.groupOn ? t("Gruppe gilt hier nicht") : t("{0} ohne Attribut", [rd.missing.length])]), rd.ready ? "ok" : "error");
        await zielLesen();
        emit("done", b.code);
        if (props.modal) emit("close");
      } catch (e) {
        fehler.value = e.message;
      } finally {
        busy.value = "";
      }
    }
    watch(hatDaten, (v) => {
      if (v) umfeldLesen();
    });
    const onKey = (e) => {
      if (props.modal && e.key === "Escape") {
        e.stopPropagation();
        emit("close");
      }
    };
    onMounted(async () => {
      document.addEventListener("keydown", onKey, true);
      if (!tree.loaded) await tree.load?.();
      await Promise.all([laden(), merken()]);
      quelleOffen.value = !hatDaten.value;
      await zielLesen();
      await umfeldLesen();
      await umstellungPruefen();
    });
    onUnmounted(() => document.removeEventListener("keydown", onKey, true));
    __expose({ umstellung, umstellen, release, bricks, dict, gelesen, vorhaben, quelleOffen, suche, treffer, gewaehlterBrick, ziel, aktuell, umfeld, ki, baum, recent, datei, uebernehmen, zuweisen, laden, zielWahl, kiFragen, umschalten, wiederOeffnen });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock(
        "div",
        {
          class: normalizeClass(["klasse", { modal: __props.modal }])
        },
        [
          createElementVNode("div", _hoisted_1$2, [
            createElementVNode("b", null, [
              createTextVNode(
                toDisplayString(_ctx.$t("⌗ GPC-Klasse")),
                1
                /* TEXT */
              ),
              zielZeile.value ? (openBlock(), createElementBlock(
                Fragment,
                { key: 0 },
                [
                  createTextVNode(
                    " · " + toDisplayString(unref(icon)(zielZeile.value.role)) + " " + toDisplayString(zielZeile.value.label),
                    1
                    /* TEXT */
                  )
                ],
                64
                /* STABLE_FRAGMENT */
              )) : createCommentVNode("v-if", true)
            ]),
            createElementVNode(
              "span",
              _hoisted_2$1,
              toDisplayString(weg.value.join(" › ")),
              1
              /* TEXT */
            ),
            _cache[7] || (_cache[7] = createElementVNode(
              "span",
              { class: "grow" },
              null,
              -1
              /* CACHED */
            )),
            createElementVNode(
              "span",
              {
                class: normalizeClass(fehler.value ? "fehler" : "muted"),
                style: { "font-size": "12px" }
              },
              toDisplayString(fehler.value ? "✗ " + fehler.value : busy.value),
              3
              /* TEXT, CLASS */
            ),
            __props.modal ? (openBlock(), createElementBlock("button", {
              key: 0,
              class: "x",
              title: _ctx.$t("schliessen (Esc)"),
              onClick: _cache[0] || (_cache[0] = ($event) => emit("close"))
            }, "✕", 8, _hoisted_3$1)) : createCommentVNode("v-if", true)
          ]),
          createElementVNode("div", _hoisted_4$1, [
            createElementVNode("div", _hoisted_5$1, [
              createElementVNode(
                "span",
                _hoisted_6$1,
                toDisplayString(_ctx.$t("Version")),
                1
                /* TEXT */
              ),
              release.value ? (openBlock(), createElementBlock("select", {
                key: 0,
                title: _ctx.$t("Sprachen: {0}", [(release.value.languages ?? []).join(", ")])
              }, [
                createElementVNode(
                  "option",
                  null,
                  toDisplayString(release.value.version) + " · " + toDisplayString(release.value.date) + " · " + toDisplayString(_ctx.$t("{0} Bricks", [bricks.value.length])),
                  1
                  /* TEXT */
                )
              ], 8, _hoisted_7$1)) : (openBlock(), createElementBlock(
                "span",
                _hoisted_8$1,
                toDisplayString(_ctx.$t("nichts übernommen")),
                1
                /* TEXT */
              )),
              createElementVNode("button", {
                class: normalizeClass({ on: quelleOffen.value }),
                title: _ctx.$t("Die Veröffentlichung ist übernommen; eine Datei braucht es nur für eine weitere Version oder Sprache"),
                onClick: _cache[1] || (_cache[1] = ($event) => quelleOffen.value = !quelleOffen.value)
              }, "⌗ GPC …", 10, _hoisted_9$1)
            ]),
            umstellung.value ? (openBlock(), createElementBlock("div", _hoisted_10, [
              _cache[8] || (_cache[8] = createElementVNode(
                "span",
                { class: "attr" },
                null,
                -1
                /* CACHED */
              )),
              createElementVNode("span", {
                class: "warn",
                title: _ctx.$t("Die Attribute kommen in die Gruppen ihrer Klassen, die Bedingung entfällt, und jeder Knoten mit einer Klasse bekommt deren Gruppe")
              }, "⚠ " + toDisplayString(_ctx.$t("{0} Attribute und {1} Knoten in der früheren Bauart", [umstellung.value.attributes, umstellung.value.nodes])), 9, _hoisted_11),
              createElementVNode("button", {
                class: "primary",
                disabled: !!busy.value,
                onClick: umstellen
              }, toDisplayString(_ctx.$t("auf Klassengruppen umstellen")), 9, _hoisted_12)
            ])) : createCommentVNode("v-if", true),
            quelleOffen.value ? (openBlock(), createElementBlock("div", _hoisted_13, [
              createElementVNode(
                "span",
                _hoisted_14,
                toDisplayString(_ctx.$t("Datei")),
                1
                /* TEXT */
              ),
              recent.value.length ? (openBlock(), createElementBlock("span", {
                key: 0,
                class: "recent",
                title: _ctx.$t("zuletzt gewählt — Klick öffnet wieder (Chrome/Edge fragt einmal nach Leserecht)")
              }, [
                (openBlock(true), createElementBlock(
                  Fragment,
                  null,
                  renderList(recent.value, (r) => {
                    return openBlock(), createElementBlock("span", {
                      key: r.name,
                      class: normalizeClass(["chip", { dim: !r.handle }]),
                      title: r.handle ? _ctx.$t("{0} — wieder öffnen", [r.name]) : _ctx.$t("{0} — war hineingezogen, kein Zugriff: wieder ziehen", [r.name]),
                      onClick: ($event) => wiederOeffnen(r)
                    }, toDisplayString(r.name), 11, _hoisted_16);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ], 8, _hoisted_15)) : createCommentVNode("v-if", true),
              createElementVNode("label", {
                class: normalizeClass(["drop", { over: dragOver.value }]),
                onDragover: _cache[2] || (_cache[2] = withModifiers(($event) => dragOver.value = true, ["prevent"])),
                onDragleave: _cache[3] || (_cache[3] = ($event) => dragOver.value = false),
                onDrop: withModifiers(abgelegt, ["prevent"]),
                onClick: waehlen,
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
              ], 42, _hoisted_17),
              gelesen.value ? (openBlock(), createElementBlock("span", _hoisted_18, [
                createTextVNode(
                  toDisplayString(gelesen.value.meta.version) + " · " + toDisplayString(gelesen.value.meta.language.toUpperCase()) + " · " + toDisplayString(_ctx.$t("{0} Bricks", [gelesen.value.meta.counts.bricks])) + " ",
                  1
                  /* TEXT */
                ),
                vorhaben.value?.neu.length ? (openBlock(), createElementBlock("span", {
                  key: 0,
                  title: _ctx.$t("Nur Datensätze, die im Journal fehlen oder anders sind, werden geschrieben")
                }, "· " + toDisplayString(_ctx.$t("{0} von {1} Datensätzen neu oder geändert", [vorhaben.value.neu.length, vorhaben.value.alle])), 9, _hoisted_19)) : (openBlock(), createElementBlock(
                  "span",
                  _hoisted_20,
                  "· " + toDisplayString(_ctx.$t("schon im Journal")),
                  1
                  /* TEXT */
                )),
                createElementVNode("button", {
                  class: "primary",
                  disabled: !!busy.value || !vorhaben.value?.neu.length,
                  onClick: uebernehmen
                }, toDisplayString(_ctx.$t("übernehmen")), 9, _hoisted_21)
              ])) : createCommentVNode("v-if", true)
            ])) : createCommentVNode("v-if", true),
            createElementVNode("div", _hoisted_22, [
              createElementVNode(
                "span",
                _hoisted_23,
                toDisplayString(_ctx.$t("Knoten")),
                1
                /* TEXT */
              ),
              zielZeile.value ? (openBlock(), createElementBlock(
                "span",
                _hoisted_24,
                toDisplayString(unref(icon)(zielZeile.value.role)) + " " + toDisplayString(zielZeile.value.label),
                1
                /* TEXT */
              )) : (openBlock(), createElementBlock(
                "span",
                _hoisted_25,
                toDisplayString(_ctx.$t("Knoten wählen")),
                1
                /* TEXT */
              )),
              !__props.modal ? (openBlock(), createElementBlock(
                "button",
                {
                  key: 2,
                  class: "x",
                  onClick: _cache[4] || (_cache[4] = ($event) => zielWahlOffen.value = !zielWahlOffen.value)
                },
                toDisplayString(_ctx.$t("ändern")),
                1
                /* TEXT */
              )) : createCommentVNode("v-if", true),
              aktuell.value ? (openBlock(), createElementBlock("span", {
                key: 3,
                class: "muted",
                title: aktuell.value.geerbt ? _ctx.$t("geerbt von {0}", [aktuell.value.von]) : _ctx.$t("eigene Klasse")
              }, toDisplayString(_ctx.$t("gilt hier")) + ": " + toDisplayString(brickZeile(aktuell.value.code)) + toDisplayString(aktuell.value.geerbt ? " ↑" : ""), 9, _hoisted_26)) : zielZeile.value ? (openBlock(), createElementBlock(
                "span",
                _hoisted_27,
                toDisplayString(_ctx.$t("hier gilt noch keine Klasse")),
                1
                /* TEXT */
              )) : createCommentVNode("v-if", true)
            ]),
            zielWahlOffen.value ? (openBlock(), createBlock(unref(TreePicker), {
              key: 2,
              "model-value": ziel.value,
              roles: ["group", "product", "variant"],
              height: 200,
              "onUpdate:modelValue": zielWahl
            }, null, 8, ["model-value"])) : createCommentVNode("v-if", true),
            hatDaten.value ? (openBlock(), createElementBlock(
              Fragment,
              { key: 3 },
              [
                createElementVNode("div", _hoisted_28, [
                  createTextVNode(
                    toDisplayString(_ctx.$t("Empfehlung")),
                    1
                    /* TEXT */
                  ),
                  _cache[9] || (_cache[9] = createElementVNode(
                    "span",
                    { class: "grow" },
                    null,
                    -1
                    /* CACHED */
                  )),
                  kiBereit.value ? (openBlock(), createElementBlock("button", {
                    key: 0,
                    class: "x ai",
                    disabled: !zielZeile.value || ki.value?.busy,
                    title: _ctx.$t("die KI nach passenden Bricks fragen ({0}) — kostet Token", [unref(ai).label?.()]),
                    onClick: kiFragen
                  }, toDisplayString(_ctx.$t("✦ KI fragen")), 9, _hoisted_29)) : createCommentVNode("v-if", true)
                ]),
                (openBlock(true), createElementBlock(
                  Fragment,
                  null,
                  renderList(umfeld.value, (u) => {
                    return openBlock(), createElementBlock("div", {
                      key: u.code,
                      class: "pick",
                      title: _ctx.$t("{0} Knoten in der Nähe haben diese Klasse", [u.n]),
                      onClick: ($event) => gewaehlterBrick.value = brickVon(u.code) ?? gewaehlterBrick.value
                    }, [
                      createElementVNode(
                        "span",
                        _hoisted_31,
                        toDisplayString(u.code),
                        1
                        /* TEXT */
                      ),
                      createTextVNode(
                        " " + toDisplayString(brickVon(u.code) ? brickTitel(brickVon(u.code)) : "") + " ",
                        1
                        /* TEXT */
                      ),
                      createElementVNode(
                        "span",
                        _hoisted_32,
                        "· " + toDisplayString(_ctx.$t("{0} im Umfeld", [u.n])),
                        1
                        /* TEXT */
                      )
                    ], 8, _hoisted_30);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                )),
                !umfeld.value.length && zielZeile.value ? (openBlock(), createElementBlock(
                  "div",
                  _hoisted_33,
                  toDisplayString(_ctx.$t("Im Umfeld ist noch keine Klasse gesetzt.")),
                  1
                  /* TEXT */
                )) : createCommentVNode("v-if", true),
                ki.value?.busy ? (openBlock(), createElementBlock("div", _hoisted_34, "✦ …")) : createCommentVNode("v-if", true),
                ki.value && !ki.value.busy ? (openBlock(), createElementBlock("div", _hoisted_35, [
                  createTextVNode(
                    "✦ KI (" + toDisplayString(unref(ai).label?.()) + ")" + toDisplayString(ki.value.familien ? " — " + ki.value.familien.join(", ") : ""),
                    1
                    /* TEXT */
                  ),
                  ki.value.fehler ? (openBlock(), createElementBlock(
                    "span",
                    _hoisted_36,
                    " · ✗ " + toDisplayString(ki.value.fehler),
                    1
                    /* TEXT */
                  )) : createCommentVNode("v-if", true)
                ])) : createCommentVNode("v-if", true),
                (openBlock(true), createElementBlock(
                  Fragment,
                  null,
                  renderList(ki.value?.liste ?? [], (s) => {
                    return openBlock(), createElementBlock("div", {
                      key: s.code,
                      class: "pick ai",
                      onClick: ($event) => gewaehlterBrick.value = brickVon(s.code)
                    }, [
                      createElementVNode(
                        "span",
                        _hoisted_38,
                        toDisplayString(s.code),
                        1
                        /* TEXT */
                      ),
                      createTextVNode(
                        " " + toDisplayString(brickVon(s.code) ? brickTitel(brickVon(s.code)) : "") + " ",
                        1
                        /* TEXT */
                      ),
                      createElementVNode(
                        "span",
                        _hoisted_39,
                        "· " + toDisplayString(s.warum),
                        1
                        /* TEXT */
                      )
                    ], 8, _hoisted_37);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                )),
                ki.value && !ki.value.busy && !ki.value.fehler && !ki.value.liste.length ? (openBlock(), createElementBlock(
                  "div",
                  _hoisted_40,
                  toDisplayString(_ctx.$t("kein Vorschlag")),
                  1
                  /* TEXT */
                )) : createCommentVNode("v-if", true),
                withDirectives(createElementVNode("input", {
                  "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => suche.value = $event),
                  type: "text",
                  class: "suche",
                  placeholder: _ctx.$t("suchen in {0} Bricks — Code, Name, Weg", [bricks.value.length])
                }, null, 8, _hoisted_41), [
                  [vModelText, suche.value]
                ]),
                suche.value.trim() ? (openBlock(), createElementBlock("div", _hoisted_42, [
                  (openBlock(true), createElementBlock(
                    Fragment,
                    null,
                    renderList(treffer.value, (b) => {
                      return openBlock(), createElementBlock("div", {
                        key: b.code,
                        class: normalizeClass(["pick", { current: gewaehlterBrick.value?.code === b.code }]),
                        title: wegText(b),
                        onClick: ($event) => gewaehlterBrick.value = b
                      }, [
                        createElementVNode(
                          "span",
                          _hoisted_44,
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
                          _hoisted_45,
                          "· " + toDisplayString(wegText(b)),
                          1
                          /* TEXT */
                        )
                      ], 10, _hoisted_43);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  )),
                  !treffer.value.length ? (openBlock(), createElementBlock(
                    "div",
                    _hoisted_46,
                    toDisplayString(_ctx.$t("nichts gefunden")),
                    1
                    /* TEXT */
                  )) : createCommentVNode("v-if", true)
                ])) : (openBlock(), createElementBlock("div", _hoisted_47, [
                  (openBlock(true), createElementBlock(
                    Fragment,
                    null,
                    renderList(baum.value, (s) => {
                      return openBlock(), createElementBlock("div", {
                        key: s.code
                      }, [
                        createElementVNode("div", {
                          class: "pick",
                          onClick: ($event) => umschalten(s.code)
                        }, [
                          createElementVNode(
                            "span",
                            _hoisted_49,
                            toDisplayString(offen.value[s.code] ? "▾" : "▸"),
                            1
                            /* TEXT */
                          ),
                          createTextVNode(
                            " " + toDisplayString(titel(s.code)) + " ",
                            1
                            /* TEXT */
                          ),
                          createElementVNode(
                            "span",
                            _hoisted_50,
                            toDisplayString(s.count),
                            1
                            /* TEXT */
                          )
                        ], 8, _hoisted_48),
                        offen.value[s.code] ? (openBlock(), createElementBlock("div", _hoisted_51, [
                          (openBlock(true), createElementBlock(
                            Fragment,
                            null,
                            renderList(s.fam, (f) => {
                              return openBlock(), createElementBlock("div", {
                                key: f.code
                              }, [
                                createElementVNode("div", {
                                  class: "pick",
                                  onClick: ($event) => umschalten(f.code)
                                }, [
                                  createElementVNode(
                                    "span",
                                    _hoisted_53,
                                    toDisplayString(offen.value[f.code] ? "▾" : "▸"),
                                    1
                                    /* TEXT */
                                  ),
                                  createTextVNode(
                                    " " + toDisplayString(titel(f.code)) + " ",
                                    1
                                    /* TEXT */
                                  ),
                                  createElementVNode(
                                    "span",
                                    _hoisted_54,
                                    toDisplayString(f.count),
                                    1
                                    /* TEXT */
                                  )
                                ], 8, _hoisted_52),
                                offen.value[f.code] ? (openBlock(), createElementBlock("div", _hoisted_55, [
                                  (openBlock(true), createElementBlock(
                                    Fragment,
                                    null,
                                    renderList(f.cls, (c) => {
                                      return openBlock(), createElementBlock("div", {
                                        key: c.code
                                      }, [
                                        createElementVNode("div", {
                                          class: "pick",
                                          onClick: ($event) => umschalten(c.code)
                                        }, [
                                          createElementVNode(
                                            "span",
                                            _hoisted_57,
                                            toDisplayString(offen.value[c.code] ? "▾" : "▸"),
                                            1
                                            /* TEXT */
                                          ),
                                          createTextVNode(
                                            " " + toDisplayString(titel(c.code)) + " ",
                                            1
                                            /* TEXT */
                                          ),
                                          createElementVNode(
                                            "span",
                                            _hoisted_58,
                                            toDisplayString(c.count),
                                            1
                                            /* TEXT */
                                          )
                                        ], 8, _hoisted_56),
                                        offen.value[c.code] ? (openBlock(), createElementBlock("div", _hoisted_59, [
                                          (openBlock(true), createElementBlock(
                                            Fragment,
                                            null,
                                            renderList(c.bricks, (b) => {
                                              return openBlock(), createElementBlock("div", {
                                                key: b.code,
                                                class: normalizeClass(["pick", { current: gewaehlterBrick.value?.code === b.code }]),
                                                onClick: ($event) => gewaehlterBrick.value = b
                                              }, [
                                                createElementVNode(
                                                  "span",
                                                  _hoisted_61,
                                                  toDisplayString(b.code),
                                                  1
                                                  /* TEXT */
                                                ),
                                                createTextVNode(
                                                  " " + toDisplayString(brickTitel(b)),
                                                  1
                                                  /* TEXT */
                                                )
                                              ], 10, _hoisted_60);
                                            }),
                                            128
                                            /* KEYED_FRAGMENT */
                                          ))
                                        ])) : createCommentVNode("v-if", true)
                                      ]);
                                    }),
                                    128
                                    /* KEYED_FRAGMENT */
                                  ))
                                ])) : createCommentVNode("v-if", true)
                              ]);
                            }),
                            128
                            /* KEYED_FRAGMENT */
                          ))
                        ])) : createCommentVNode("v-if", true)
                      ]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ]))
              ],
              64
              /* STABLE_FRAGMENT */
            )) : createCommentVNode("v-if", true),
            gewaehlterBrick.value ? (openBlock(), createElementBlock("div", _hoisted_62, [
              createElementVNode(
                "b",
                null,
                toDisplayString(gewaehlterBrick.value.code) + " " + toDisplayString(brickTitel(gewaehlterBrick.value)),
                1
                /* TEXT */
              ),
              createElementVNode(
                "span",
                _hoisted_63,
                " · " + toDisplayString(wegText(gewaehlterBrick.value)),
                1
                /* TEXT */
              ),
              createElementVNode(
                "div",
                _hoisted_64,
                toDisplayString(unref(brickText)(gewaehlterBrick.value, locale.value)[1]),
                1
                /* TEXT */
              ),
              unref(brickText)(gewaehlterBrick.value, locale.value)[2] ? (openBlock(), createElementBlock(
                "div",
                _hoisted_65,
                toDisplayString(unref(brickText)(gewaehlterBrick.value, locale.value)[2]),
                1
                /* TEXT */
              )) : createCommentVNode("v-if", true),
              createElementVNode("div", _hoisted_66, [
                (openBlock(true), createElementBlock(
                  Fragment,
                  null,
                  renderList(gewaehlterBrick.value.a, ([ac, vs]) => {
                    return openBlock(), createElementBlock("span", {
                      key: ac,
                      class: "chip",
                      title: _ctx.$t("{0} Werte", [vs.length])
                    }, toDisplayString(attributName(ac)) + " · " + toDisplayString(vs.length), 9, _hoisted_67);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                )),
                !gewaehlterBrick.value.a.length ? (openBlock(), createElementBlock(
                  "span",
                  _hoisted_68,
                  toDisplayString(_ctx.$t("keine Attribute")),
                  1
                  /* TEXT */
                )) : createCommentVNode("v-if", true)
              ])
            ])) : createCommentVNode("v-if", true)
          ]),
          createElementVNode("div", _hoisted_69, [
            createElementVNode(
              "span",
              _hoisted_70,
              toDisplayString(gewaehlterBrick.value ? _ctx.$t("{0} an {1}", [gewaehlterBrick.value.code, zielZeile.value?.label ?? "—"]) : _ctx.$t("Brick wählen")),
              1
              /* TEXT */
            ),
            _cache[10] || (_cache[10] = createElementVNode(
              "span",
              { class: "grow" },
              null,
              -1
              /* CACHED */
            )),
            __props.modal ? (openBlock(), createElementBlock(
              "button",
              {
                key: 0,
                onClick: _cache[6] || (_cache[6] = ($event) => emit("close"))
              },
              toDisplayString(_ctx.$t("abbrechen")),
              1
              /* TEXT */
            )) : createCommentVNode("v-if", true),
            createElementVNode("button", {
              class: "primary",
              disabled: !gewaehlterBrick.value || !ziel.value || !!busy.value,
              title: _ctx.$t("Gruppe, Klassenattribut und Attribute anlegen, Klasse am Knoten setzen"),
              onClick: zuweisen
            }, toDisplayString(_ctx.$t("✓ zuweisen")), 9, _hoisted_71)
          ])
        ],
        2
        /* CLASS */
      );
    };
  }
};
const Klasse = /* @__PURE__ */ _export_sfc(_sfc_main$2, [["__scopeId", "data-v-09f8f74a"]]);
const _hoisted_1$1 = {
  class: "pane",
  style: { "flex": "1" }
};
const _sfc_main$1 = {
  __name: "View",
  setup(__props) {
    const route = useRoute();
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$1, [
        (openBlock(), createBlock(Klasse, {
          key: String(unref(route).query.node ?? ""),
          node: String(unref(route).query.node ?? "")
        }, null, 8, ["node"]))
      ]);
    };
  }
};
function oeffneKlasse(nodeId, { onDone = null } = {}) {
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.45);display:grid;place-items:center;z-index:40";
  document.body.append(overlay);
  let zu = false;
  const app = createApp({ render: () => h$1(Klasse, { node: nodeId, modal: true, onClose: schliessen, onDone: (code) => onDone?.(code) }) });
  app.config.globalProperties.$t = t;
  function schliessen() {
    if (zu) return;
    zu = true;
    app.unmount();
    overlay.remove();
  }
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) schliessen();
  });
  app.mount(overlay);
  return schliessen;
}
const _hoisted_1 = {
  key: 0,
  class: "row"
};
const _hoisted_2 = ["title"];
const _hoisted_3 = ["title"];
const _hoisted_4 = {
  key: 1,
  class: "muted"
};
const _hoisted_5 = ["title"];
const _hoisted_6 = ["title"];
const _hoisted_7 = ["title"];
const _hoisted_8 = ["title"];
const _hoisted_9 = {
  key: 1,
  class: "fehler"
};
const _sfc_main = {
  __name: "Band",
  props: { nodeId: String, settings: Object },
  emits: ["kopf", "geaendert"],
  setup(__props, { expose: __expose, emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const zustand = ref(null);
    const fehler = ref("");
    const schl = computed(() => schluessel(props.settings));
    const locale = computed(() => store.model?.masterLocale ?? "de");
    const gruppeDerKlasse = computed(() => zustand.value?.code ? klassenGruppe(schl.value.group, zustand.value.code) : null);
    const klassenName = (code) => {
      const l = (store.model?.lists ?? []).find((x) => x.key === schl.value.classAttr);
      const v = (l?.values ?? []).find((x) => x.value === code);
      const name = v?.label?.[locale.value] ?? v?.label?.en ?? Object.values(v?.label ?? {})[0] ?? "";
      return `${code} ${name}`.trim();
    };
    const anzahl = computed(() => (store.model?.groups ?? []).find((g) => g.key === gruppeDerKlasse.value)?.attributes?.length ?? 0);
    async function lesen() {
      fehler.value = "";
      try {
        const k = await klasseAm(api, props.nodeId, schl.value.classAttr);
        const cg = k.code ? klassenGruppe(schl.value.group, k.code) : null;
        const gruppen = store.model?.groups ?? [];
        zustand.value = {
          ...k,
          systemGilt: gruppeGilt(k.node, schl.value.group),
          systemExistiert: gruppen.some((g) => g.key === schl.value.group),
          klasseGilt: cg ? gruppeGilt(k.node, cg) : true,
          klasseExistiert: cg ? gruppen.some((g) => g.key === cg) : false
        };
        emit("kopf", k.code ? "· " + klassenName(k.code) + (k.geerbt ? " ↑" : "") : "· " + t("keine Klasse"));
      } catch (e) {
        fehler.value = e.message;
        emit("kopf", "· ✗ " + e.message);
      }
    }
    onMounted(lesen);
    watch(() => props.nodeId, lesen);
    function waehlen() {
      oeffneKlasse(props.nodeId, { onDone: async () => {
        await lesen();
        emit("geaendert");
      } });
    }
    async function entfernen() {
      const z = zustand.value;
      const ok = await dialog.confirm({
        title: t("GPC-Klasse {0} entfernen?", [z.code]),
        text: t("Ihre Gruppe geht mit. Danach gilt die Klasse von oben, sonst hat dieser Knoten keine."),
        ok: t("✕ Entfernen")
      });
      if (!ok) return;
      try {
        await api.post("/api/classification/clear", { node: props.nodeId, system: { group: schl.value.group, classAttr: schl.value.classAttr } });
        await store.poll?.(true);
        await tree.load?.(true);
        store.toast(t("✓ Klasse entfernt"), "ok");
        await lesen();
        emit("geaendert");
      } catch (e) {
        store.toast(e.message);
      }
    }
    async function anhaengen(gruppe) {
      try {
        const row = tree.byId.get(props.nodeId);
        const have = (row?.groups ?? "").split(",").filter(Boolean);
        await api.post(`/api/nodes/${encodeURIComponent(props.nodeId)}/groups`, { groups: [.../* @__PURE__ */ new Set([...have, gruppe])] }, "PUT");
        const darunter = [];
        const gehe = (id) => {
          for (const k of tree.kids(id)) {
            if ((k.groups ?? "").split(",").includes(gruppe)) darunter.push(k);
            gehe(k.id);
          }
        };
        gehe(props.nodeId);
        for (const k of darunter) await api.post(`/api/nodes/${encodeURIComponent(k.id)}/groups`, { groups: (k.groups ?? "").split(",").filter((x) => x && x !== gruppe) }, "PUT");
        await store.poll?.(true);
        await tree.load?.(true);
        store.toast(t("✓ {0} ab {1}", [gruppe, row?.label ?? props.nodeId]), "ok");
        await lesen();
        emit("geaendert");
      } catch (e) {
        store.toast(e.message);
      }
    }
    async function systemAnlegen() {
      await api.post("/api/classification/ensure", { system: systemSpec(props.settings) });
      await store.poll?.(true);
      await anhaengen(schl.value.group);
    }
    __expose({ zustand, lesen, anzahl, waehlen, entfernen, anhaengen, gruppeDerKlasse });
    return (_ctx, _cache) => {
      return zustand.value ? (openBlock(), createElementBlock("div", _hoisted_1, [
        zustand.value.code ? (openBlock(), createElementBlock(
          Fragment,
          { key: 0 },
          [
            createElementVNode("span", {
              class: "chip",
              title: zustand.value.geerbt ? _ctx.$t("geerbt von {0}", [zustand.value.von]) : _ctx.$t("eigene Klasse")
            }, toDisplayString(klassenName(zustand.value.code)) + toDisplayString(zustand.value.geerbt ? " ↑ " + zustand.value.von : ""), 9, _hoisted_2),
            createElementVNode("span", {
              class: "chip",
              title: _ctx.$t("Attribute der Gruppe {0}", [gruppeDerKlasse.value])
            }, toDisplayString(_ctx.$t("{0} Attribute", [anzahl.value])), 9, _hoisted_3)
          ],
          64
          /* STABLE_FRAGMENT */
        )) : (openBlock(), createElementBlock(
          "span",
          _hoisted_4,
          toDisplayString(_ctx.$t("keine Klasse")),
          1
          /* TEXT */
        )),
        createElementVNode("button", {
          class: normalizeClass(zustand.value.code && zustand.value.klasseExistiert ? "x" : "primary"),
          title: _ctx.$t("Brick wählen: Umfeld, KI-Vorschlag, Suche und Durchsehen"),
          onClick: waehlen
        }, toDisplayString(zustand.value.code ? _ctx.$t("⌗ andere Klasse …") : _ctx.$t("⌗ Klasse zuweisen …")), 11, _hoisted_5),
        zustand.value.code && !zustand.value.geerbt ? (openBlock(), createElementBlock("button", {
          key: 2,
          class: "x",
          title: _ctx.$t("Klasse an diesem Knoten entfernen — mit ihrer Gruppe; danach gilt die geerbte Klasse, sonst keine"),
          onClick: entfernen
        }, toDisplayString(_ctx.$t("✕ Klasse")), 9, _hoisted_6)) : createCommentVNode("v-if", true),
        zustand.value.code && zustand.value.klasseExistiert && !zustand.value.klasseGilt ? (openBlock(), createElementBlock("button", {
          key: 3,
          class: "primary",
          title: _ctx.$t("Attributgruppe {0} an diesem Knoten anhängen — erst dann gelten die Attribute der Klasse hier und darunter", [gruppeDerKlasse.value]),
          onClick: _cache[0] || (_cache[0] = ($event) => anhaengen(gruppeDerKlasse.value))
        }, toDisplayString(_ctx.$t("⌗ Gruppe {0} anhängen", [gruppeDerKlasse.value])), 9, _hoisted_7)) : createCommentVNode("v-if", true),
        !zustand.value.systemGilt ? (openBlock(), createElementBlock("button", {
          key: 4,
          class: "primary",
          title: zustand.value.systemExistiert ? _ctx.$t("Attributgruppe {0} an diesem Knoten anhängen — sie trägt das Klassenattribut", [schl.value.group]) : _ctx.$t("Attributgruppe {0} gibt es im Modell nicht — anlegen und anhängen", [schl.value.group]),
          onClick: _cache[1] || (_cache[1] = ($event) => zustand.value.systemExistiert ? anhaengen(schl.value.group) : systemAnlegen())
        }, toDisplayString(zustand.value.systemExistiert ? _ctx.$t("⌗ Gruppe {0} anhängen", [schl.value.group]) : _ctx.$t("⌗ Gruppe {0} anlegen und anhängen", [schl.value.group])), 9, _hoisted_8)) : createCommentVNode("v-if", true)
      ])) : fehler.value ? (openBlock(), createElementBlock(
        "div",
        _hoisted_9,
        "✗ " + toDisplayString(fehler.value),
        1
        /* TEXT */
      )) : createCommentVNode("v-if", true);
    };
  }
};
const cache = { settings: {}, loaded: null };
async function loadSettings() {
  try {
    const r = await fetch("/api/plugins/gpc/data/settings");
    cache.settings = r.ok ? await r.json() : {};
  } catch {
    cache.settings = {};
  }
}
cache.loaded = loadSettings();
async function install(ctx) {
  const { api: api2, store: store2, tree: tree2 } = ctx;
  if (!tree2.loaded) await tree2.load();
  const settings = await api2.get("/api/plugins/gpc/data/settings").catch(() => null) ?? {};
  const m2 = store2.model;
  let veraltet = false;
  if (settings.group && !(m2?.groups ?? []).some((g) => g.key === settings.group)) {
    delete settings.group;
    veraltet = true;
  }
  if (settings.classAttr && !(m2?.attributes ?? []).some((a) => a.key === settings.classAttr)) {
    delete settings.classAttr;
    veraltet = true;
  }
  if (veraltet) await api2.post("/api/plugins/gpc/data/settings", settings, "PUT");
  const sys = systemSpec(settings);
  const fehlt = !(store2.model?.groups ?? []).some((g) => g.key === sys.group) || !(store2.model?.attributes ?? []).some((a) => a.key === sys.classAttr);
  if (fehlt && !(await ctx.system?.ankuendigen?.({ label: "GPC", text: t("Das Plugin legt die Attributgruppe {0} mit dem Attribut {1} an und hängt die Gruppe an die Wurzeln. Ohne sie arbeitet es nicht, und solange es an ist, lassen sie sich nicht zurückziehen.", [sys.group, sys.classAttr]) }) ?? true)) return false;
  const r = await api2.post("/api/classification/ensure", { system: sys });
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
let angemeldet = false;
async function bandMount({ head, body }, nodeId, ctx) {
  await cache.loaded;
  if (!angemeldet) {
    angemeldet = true;
    ctx?.api?.post?.("/api/classification/register", { system: systemSpec(cache.settings) })?.catch?.(() => {
    });
  }
  const app = createApp({ render: () => h$1(_sfc_main, { nodeId, settings: cache.settings, onKopf: (text) => {
    head.textContent = text;
  } }) });
  app.config.globalProperties.$t = t;
  app.mount(body);
  return () => app.unmount();
}
const entry = {
  install,
  views: [{ path: "gpc", topic: "classification", label: "GPC", icon: "⌗", hint: t("GPC: Veröffentlichung einlesen, Brick suchen und einem Knoten zuweisen — bedient wird am Knoten (Band ⌗ GPC)"), component: _sfc_main$1 }],
  nodeBands: [{ key: "gpc", label: "GPC", icon: "⌗", roles: ["group", "product", "variant"], mount: bandMount }],
  nodeActions: [{
    label: t("GPC-Klasse (+)"),
    icon: "⌗",
    topic: "classification",
    roles: ["group", "product"],
    hint: t("Brick wählen und diesem Knoten zuweisen"),
    run: async (id) => {
      await cache.loaded;
      oeffneKlasse(id);
    }
  }]
};
export {
  entry as default
};
