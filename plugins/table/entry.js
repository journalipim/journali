(function(){const s=document.createElement('style');s.textContent="\n.section[data-v-445c3753] { padding: 8px; border-bottom: 1px solid var(--line);\n}\n.section h2[data-v-445c3753] { font-size: 12px; margin: 0 0 6px; font-weight: 600;\n}\n.section h2 .muted[data-v-445c3753] { font-weight: 400;\n}\n.drop.over[data-v-445c3753] { outline: 2px dashed var(--accent); outline-offset: -2px;\n}\n.btn[data-v-445c3753] { display: inline-block; padding: 2px 10px; border-radius: 6px; cursor: pointer;\n}\n.map td[data-v-445c3753] { vertical-align: top; padding: 3px 4px;\n}\n.map tr.off td[data-v-445c3753] { opacity: .5;\n}\n.samples[data-v-445c3753] { font-size: 11px; white-space: normal; max-width: 260px;\n}\n.stats[data-v-445c3753] { font-size: 13px;\n}\n.out[data-v-445c3753] { font-size: 11px; max-height: 400px; overflow: auto; background: var(--bg); padding: 6px; border-radius: 6px;\n}\n.picker[data-v-445c3753] { max-height: 240px; overflow: auto; border: 1px solid var(--line); border-radius: 6px; background: var(--pane); margin-top: 4px;\n}\n.pick[data-v-445c3753] { display: flex; align-items: center; gap: 8px; height: 24px; padding: 0 8px; white-space: nowrap; cursor: pointer;\n}\n.pick[data-v-445c3753]:hover { background: var(--hover);\n}\r\n\n.form[data-v-d83b81d4] { width: 100%; border-bottom: 1px solid var(--line);\n}\n.form td[data-v-d83b81d4] { height: 30px; vertical-align: middle; white-space: normal; padding: 2px 4px;\n}\n.form td.attr[data-v-d83b81d4] { color: var(--muted); white-space: nowrap; padding-left: 8px;\n}\n.row[data-v-d83b81d4] { display: flex; gap: 6px; align-items: center;\n}\n.row > input[data-v-d83b81d4] { flex: 1; min-width: 0;\n}\n.tab[data-v-d83b81d4] { padding: 2px 10px; border-radius: 4px; color: var(--muted); text-decoration: none; font-size: 13px;\n}\n.tab.on[data-v-d83b81d4], .tab.router-link-active[data-v-d83b81d4] { background: var(--accent-soft); color: var(--text);\n}\r\n";document.head.append(s)})();
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
const vModelCheckbox = m$1.vModelCheckbox;
const vModelSelect = m$1.vModelSelect;
const vModelText = m$1.vModelText;
const watch = m$1.watch;
const withCtx = m$1.withCtx;
const withDirectives = m$1.withDirectives;
const withModifiers = m$1.withModifiers;
const m = window.journali.vueRouter;
const useRoute = m.useRoute;
const useRouter = m.useRouter;
const h = window.journali;
const api = h.api;
const store = h.store;
const tree = h.tree;
const icon = h.icon;
const mapper = h.mapper;
const paneWidth = h.paneWidth;
const plugins = h.plugins;
const Splitter = h.Splitter;
const ImportHead = h.ImportHead;
const TreePicker = h.TreePicker;
const _export_sfc = (sfc, props) => {
  const target = sfc.__vccOpts || sfc;
  for (const [key, val] of props) {
    target[key] = val;
  }
  return target;
};
const _hoisted_1$1 = ["title"];
const _hoisted_2$1 = ["title"];
const _hoisted_3$1 = { class: "muted" };
const _hoisted_4$1 = ["title"];
const _hoisted_5$1 = ["value"];
const _hoisted_6$1 = ["value"];
const _hoisted_7$1 = {
  key: 3,
  class: "muted",
  style: { "font-size": "12px" }
};
const _hoisted_8$1 = { class: "step" };
const _hoisted_9$1 = { colspan: "2" };
const _hoisted_10$1 = {
  class: "muted",
  style: { "font-weight": "400" }
};
const _hoisted_11$1 = { key: 0 };
const _hoisted_12$1 = { class: "row" };
const _hoisted_13$1 = { class: "muted" };
const _hoisted_14$1 = { key: 1 };
const _hoisted_15$1 = {
  class: "row",
  style: { "margin-bottom": "4px" }
};
const _hoisted_16$1 = ["title"];
const _hoisted_17$1 = {
  key: 1,
  class: "muted"
};
const _hoisted_18 = { key: 2 };
const _hoisted_19 = { key: 3 };
const _hoisted_20 = { class: "scroll" };
const _hoisted_21 = {
  key: 0,
  class: "muted",
  style: { "font-size": "12px", "padding": "6px 8px" }
};
const _hoisted_22 = {
  key: 1,
  class: "warn",
  style: { "font-size": "12px", "padding": "6px 8px" }
};
const _hoisted_23 = {
  key: 2,
  class: "section"
};
const _hoisted_24 = {
  class: "step-band",
  style: { "margin": "0 -8px 6px" }
};
const _hoisted_25 = { class: "muted" };
const _hoisted_26 = { class: "grid map" };
const _hoisted_27 = ["title"];
const _hoisted_28 = {
  class: "muted",
  style: { "font-size": "11px" }
};
const _hoisted_29 = { class: "muted samples" };
const _hoisted_30 = ["onUpdate:modelValue", "onChange"];
const _hoisted_31 = ["value"];
const _hoisted_32 = ["onUpdate:modelValue", "onChange"];
const _hoisted_33 = ["value"];
const _hoisted_34 = {
  key: 1,
  style: { "display": "flex", "gap": "4px", "flex-wrap": "wrap" }
};
const _hoisted_35 = ["onUpdate:modelValue"];
const _hoisted_36 = ["onUpdate:modelValue"];
const _hoisted_37 = ["value"];
const _hoisted_38 = ["onUpdate:modelValue"];
const _hoisted_39 = ["value"];
const _hoisted_40 = {
  key: 2,
  class: "muted"
};
const _hoisted_41 = ["onUpdate:modelValue"];
const _hoisted_42 = ["value"];
const _hoisted_43 = {
  class: "muted",
  style: { "font-size": "11px" }
};
const _hoisted_44 = {
  class: "pane",
  style: { "flex": "1" }
};
const _hoisted_45 = { class: "toolbar" };
const _hoisted_46 = ["disabled"];
const _hoisted_47 = ["disabled", "title"];
const _hoisted_48 = { class: "muted" };
const _hoisted_49 = {
  class: "scroll",
  style: { "padding": "8px" }
};
const _hoisted_50 = {
  key: 0,
  class: "stats"
};
const _hoisted_51 = { class: "pos" };
const _hoisted_52 = { class: "muted" };
const _hoisted_53 = ["title"];
const _hoisted_54 = { key: 1 };
const _hoisted_55 = { class: "warn" };
const _hoisted_56 = {
  key: 2,
  class: "neg",
  style: { "margin-top": "6px", "white-space": "pre-wrap" }
};
const _hoisted_57 = { key: 0 };
const _hoisted_58 = {
  key: 3,
  class: "warn",
  style: { "margin-top": "6px" }
};
const _hoisted_59 = {
  key: 4,
  class: "section",
  style: { "margin-top": "8px", "padding": "0" }
};
const _hoisted_60 = {
  class: "step-band",
  style: { "margin": "0 0 4px" }
};
const _hoisted_61 = { class: "muted" };
const _hoisted_62 = {
  class: "grid",
  style: { "width": "100%" }
};
const _hoisted_63 = { class: "mono muted" };
const _hoisted_64 = { class: "mono" };
const _hoisted_65 = ["value", "onChange"];
const _hoisted_66 = {
  key: 1,
  class: "muted"
};
const _hoisted_67 = { style: { "margin-top": "8px" } };
const _hoisted_68 = { class: "out" };
const _hoisted_69 = {
  key: 1,
  class: "muted"
};
const _hoisted_70 = {
  key: 2,
  class: "empty"
};
const _hoisted_71 = {
  key: 3,
  class: "pos",
  style: { "margin-top": "8px" }
};
const _hoisted_72 = {
  key: 4,
  class: "section"
};
const _hoisted_73 = {
  class: "mono",
  style: { "font-size": "12px", "white-space": "pre-wrap" }
};
const _sfc_main$1 = {
  __name: "ImportView",
  setup(__props) {
    const { suggest, plan: makePlan, parseDelimited, childAttributes, childRoleOf } = mapper;
    const leftW = paneWidth("import.table", 720);
    const router = useRouter();
    const route = useRoute();
    const fixed = ref(null);
    async function fixNode(id) {
      if (!id) {
        fixed.value = null;
        return;
      }
      if (!tree.loaded) await tree.load();
      const row = tree.byId.get(id);
      if (!row) {
        store.toast(`Knoten ${id} unbekannt`);
        return;
      }
      const n = await api.get(`/api/nodes/${encodeURIComponent(id)}`);
      const childRole = childRoleOf(row, tree.kids(id));
      const allowed = new Set(childAttributes(model.value, n, childRole).map((a) => a.key));
      allowed.add("sku");
      for (const a of row.axes ?? []) allowed.add(a);
      fixed.value = { row, childRole, allowed };
      pickTarget(row);
      role.value = childRole;
      external.value = "";
      if (source.value) resuggest();
    }
    watch(() => route.query.node, (id) => fixNode(id), { immediate: true });
    const model = computed(() => store.model);
    const locales = computed(() => model.value?.locales.map((l) => l.code) ?? []);
    const source = ref(null);
    const mapping = ref([]);
    const target = ref(null);
    const role = ref("");
    const external = ref("");
    const busy = ref("");
    const planned = ref(null);
    const result = ref(null);
    const log = ref([]);
    const pasteText = ref("");
    const dragOver = ref(false);
    const say = (m2) => log.value.unshift(`${(/* @__PURE__ */ new Date()).toLocaleTimeString("de-DE")} ${m2}`);
    const attrs = computed(() => (model.value?.attributes ?? []).filter((a) => a.type !== "rows"));
    const targetPick = ref(false);
    function pickTarget(r) {
      target.value = r;
      targetPick.value = false;
      planned.value = null;
    }
    const fileHandle = ref(null);
    const canPick = typeof window.showOpenFilePicker === "function";
    async function pickFile(e) {
      if (!canPick) return;
      e.preventDefault();
      try {
        const [h2] = await window.showOpenFilePicker({ multiple: false });
        fileHandle.value = h2;
        await takeFile(await h2.getFile());
      } catch (err) {
        if (err?.name !== "AbortError") store.toast(err.message);
      }
    }
    async function reloadFile() {
      if (fileHandle.value) {
        try {
          await takeFile(await fileHandle.value.getFile(), true);
          store.toast(`${source.value?.name}: neu gelesen`, "ok");
        } catch (err) {
          store.toast(err.message);
        }
      } else document.querySelector("#table-file-input")?.click();
    }
    async function takeFile(file, keepSheet = false) {
      if (/\.json$/i.test(file.name)) {
        try {
          const j = JSON.parse(await file.text());
          const n = j?.node ?? j;
          if (n && !Array.isArray(n) && n.id && n.role && Array.isArray(n.values)) {
            store.toast("Knotenbaum erkannt → JSON-Import", "ok");
            store.pendingImport = { file, parent: target.value || null };
            router.push("/p/json/import");
            return;
          }
        } catch {
        }
      }
      const sheet = keepSheet ? source.value?.sheet : null;
      const imp = plugins.importerFor(file.name);
      busy.value = `lese ${file.name} …`;
      try {
        let t;
        if (imp) t = await imp.parse(file, plugins.ctx(imp.key));
        else if (/\.(csv|txt|tsv)$/i.test(file.name)) t = parseDelimited(await file.text());
        else if (/\.json$/i.test(file.name)) {
          const { fromObjects } = mapper;
          const j = JSON.parse(await file.text());
          t = fromObjects(Array.isArray(j) ? j : j.rows ?? j.items ?? j.data ?? []);
        } else throw new Error(`Kein Importer für ${file.name} — Plugin für dieses Format einschalten (⌁ Plugins)`);
        setSource({ ...t, name: file.name, importer: imp?.key ?? null });
        if (sheet && source.value?.sheets?.some((s) => s.name === sheet)) pickSheet(sheet);
      } catch (e) {
        store.toast(e.message);
      } finally {
        busy.value = "";
      }
    }
    function setSource(t) {
      if (t.sheets && !t.columns) {
        t.sheet = t.sheets[0]?.name;
        const s = t.sheets[0];
        t.columns = s?.columns ?? [];
        t.rows = s?.rows ?? [];
      }
      source.value = t;
      mapping.value = strictify(suggest(t.columns, t.rows, model.value, { external: external.value || null }));
      planned.value = null;
      result.value = null;
      say(`${t.name}: ${t.rows.length} Zeilen, ${t.columns.length} Spalten — ${mapping.value.filter((m2) => m2.target === "attr").length} Spalten zugeordnet, ${mapping.value.filter((m2) => m2.target === "new").length} neu, ${mapping.value.filter((m2) => m2.target === "skip").length} übergangen`);
    }
    function pickSheet(name) {
      const s = source.value.sheets.find((x) => x.name === name);
      if (!s) return;
      setSource({ ...source.value, sheet: name, columns: s.columns, rows: s.rows });
    }
    function takePaste() {
      const t = parseDelimited(pasteText.value);
      if (!t.columns.length) return;
      setSource({ ...t, name: "Zwischenablage" });
      pasteText.value = "";
    }
    function onDrop(e) {
      dragOver.value = false;
      const f = e.dataTransfer.files?.[0];
      if (f) takeFile(f);
    }
    function resuggest() {
      if (source.value) mapping.value = strictify(suggest(source.value.columns, source.value.rows, model.value, { external: external.value || null }));
      planned.value = null;
    }
    function strictify(m2) {
      if (!fixed.value) return m2;
      for (const x of m2) {
        if (x.target === "new") {
          x.target = "skip";
          x.why = "unbekannt — nicht in der Vorlage dieses Knotens";
          x.unknown = true;
        } else if (x.target === "attr" && !fixed.value.allowed.has(x.attribute)) {
          x.target = "skip";
          x.why = `${x.attribute} gilt hier nicht für ${roleLabel[fixed.value.childRole]}`;
          x.unknown = true;
        } else if (x.target === "parent" || x.target === "external") {
          x.target = "skip";
          x.why = "im Knotenmodus ohne Bedeutung";
        }
      }
      return m2;
    }
    const roleLabel = { group: "Gruppen", product: "Produkte", variant: "Varianten" };
    const unknown = computed(() => mapping.value.filter((m2) => m2.unknown).length);
    const TARGETS = [["attr", "Attribut"], ["new", "neues Attribut"], ["id", "journali-Id"], ["sku", "SKU (finden)"], ["external", "externe Kennung"], ["parent", "Elternteil"], ["skip", "übergehen"]];
    const sample = (i) => source.value.rows.slice(0, 200).map((r) => r[i]).filter((v) => String(v ?? "").trim() !== "").slice(0, 3).map((v) => String(v).slice(0, 30)).join(" · ");
    function onTarget(m2) {
      planned.value = null;
      if (m2.target === "attr" && !m2.attribute) m2.attribute = attrs.value[0]?.key ?? null;
      if (m2.target === "new" && !m2.newKey) m2.newKey = m2.column.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      syncLocale(m2);
    }
    function syncLocale(m2) {
      const a = attrs.value.find((x) => x.key === m2.attribute);
      if (m2.target === "attr" && a && !a.perLocale) m2.locale = null;
      if (m2.target === "attr" && a?.perLocale && !m2.locale) m2.locale = model.value?.masterLocale ?? locales.value[0];
    }
    const keyColumn = computed(() => mapping.value.find((m2) => ["id", "sku", "external"].includes(m2.target)));
    const groups = computed(() => model.value?.groups ?? []);
    const blockers = computed(() => {
      const p = planned.value;
      if (!p) return [];
      const out = [];
      if (p.stats.invalid.length) out.push(fixed.value ? `${p.stats.invalid.length} Werte passen nicht zum Typ — Datei abgelehnt, in Excel korrigieren` : `${p.stats.invalid.length} Werte passen nicht zum Typ — unten korrigieren`);
      if (p.stats.missingGroup.length) out.push(`neue Attribute ohne Attributgruppe: ${p.stats.missingGroup.join(", ")}`);
      return out;
    });
    function fixCell(inv, v) {
      source.value.rows[inv.row][inv.column] = v;
      planned.value = { ...planned.value, stale: true };
    }
    async function analyse() {
      if (!source.value) return;
      if (!target.value && !mapping.value.some((m2) => m2.target === "parent")) {
        store.toast("Ziel wählen (Gruppe oder Produkt) — oder eine Spalte „Elternteil“");
        return;
      }
      busy.value = "vergleiche mit dem Bestand …";
      try {
        await tree.load(true);
        const keys = [...new Set(mapping.value.filter((m2) => m2.target === "attr").map((m2) => m2.attribute))];
        const locs = [...new Set(mapping.value.filter((m2) => m2.target === "attr").map((m2) => m2.locale ?? ""))];
        const existing = /* @__PURE__ */ new Map();
        const roots = target.value ? [target.value.id] : tree.rows.filter((r) => !r.parent).map((r) => r.id);
        for (const rid of roots) for (const loc of locs) {
          const t = await api.get(`/api/nodes/${encodeURIComponent(rid)}/table?deep=true&attributes=${encodeURIComponent(keys.join(","))}${loc ? "&locale=" + loc : ""}`);
          for (const r of t.rows) {
            const cur = existing.get(r.row.id) ?? {};
            for (const [k, v] of Object.entries(r.values)) if (v.value != null) {
              cur[`${k}|${loc}`] = v.value;
              cur[`${k}|${loc}#own`] = v.own;
            }
            existing.set(r.row.id, cur);
          }
        }
        planned.value = makePlan({ columns: source.value.columns, rows: source.value.rows, mapping: mapping.value.map((m2) => ({ ...m2 })), model: model.value, tree, target: target.value, role: role.value || null, existing, external: external.value || null });
        const s = planned.value.stats;
        const nlv = Object.entries(s.newListValues ?? {}).map(([l, v]) => `${l}: ${Object.values(v).join(", ")}`);
        say(`Plan: ${s.create} neu, ${s.update} geändert, ${s.unchanged} unverändert, ${s.values} Werte, ${planned.value.newAttributes.length} neue Attribute${nlv.length ? `, neue Listenwerte — ${nlv.join("; ")}` : ""}${s.problems.length ? `, ${s.problems.length} Probleme` : ""}`);
      } catch (e) {
        store.toast(e.message);
      } finally {
        busy.value = "";
      }
    }
    async function run() {
      if (!planned.value || !store.actor) {
        if (!store.actor) store.toast("👤 Name fehlt → Einstellungen");
        return;
      }
      if (blockers.value.length || planned.value.stale) {
        store.toast(blockers.value[0] ?? "erst neu analysieren");
        return;
      }
      const p = planned.value;
      busy.value = "schreibe …";
      result.value = null;
      try {
        for (const a of p.newAttributes) await api.post(`/api/model/attributes/${a.key}`, a, "PUT");
        let nlv = 0;
        for (const [list, vals] of Object.entries(p.stats.newListValues ?? {})) for (const [key, label] of Object.entries(vals)) {
          await api.post(`/api/model/lists/${list}/values/${encodeURIComponent(key)}`, { value: key, label: Object.fromEntries(model.value.locales.map((l) => [l.code, label])) }, "PUT");
          nlv++;
        }
        if (nlv) say(`${nlv} Listenwerte angelegt`);
        if (p.newAttributes.length) {
          await store.poll(true);
          say(`${p.newAttributes.length} Attribute angelegt: ${p.newAttributes.map((a) => a.key + " → " + a.group).join(", ")}`);
        }
        const cmds = [...p.attach.map((x) => ({ op: "groups.attach", args: { node: x.node, groups: [...(tree.byId.get(x.node)?.groups ?? "").split(",").filter(Boolean), ...x.groups] } })), ...p.commands];
        const batch = "imp-" + Date.now().toString(36);
        const res = await api.batchChunked(cmds, { batch, size: 1e3, label: "Import (Tabelle): schreiben", onProgress: (p2) => {
          busy.value = `schreibe … ${p2.done}/${p2.total}`;
        } });
        const done = res.results.length;
        if (res.error) throw new Error(`Befehl ${res.error.index + 1} (${res.error.op}): ${res.error.message} — ${done} geschrieben`);
        result.value = { written: done, batch: res.batch };
        say(`fertig: ${done} Einträge, Stapel ${batch}`);
        await tree.load(true);
        await store.poll(true);
        planned.value = null;
      } catch (e) {
        store.toast(e.message);
        say("✗ " + e.message);
      } finally {
        busy.value = "";
      }
    }
    const profileGet = () => ({ target: target.value?.id ?? null, role: role.value, external: external.value, mapping: Object.fromEntries(mapping.value.map((m2) => [m2.column, { target: m2.target, attribute: m2.attribute, locale: m2.locale, newKey: m2.newKey, newType: m2.newType, newGroup: m2.newGroup }])) });
    function profileSet(p) {
      if (!p) {
        target.value = null;
        role.value = "";
        external.value = "";
        planned.value = null;
        return;
      }
      role.value = p.role ?? "";
      external.value = p.external ?? "";
      if (p.target && tree.byId.get(p.target)) pickTarget(tree.byId.get(p.target));
      if (p.mapping && source.value) for (const m2 of mapping.value) {
        const s = p.mapping[m2.column];
        if (s) Object.assign(m2, s);
      }
      planned.value = null;
    }
    onMounted(async () => {
      if (!tree.loaded) await tree.load();
      const p = store.pendingImport;
      if (p?.file && !/\.json(\.gz)?$/i.test(p.file.name)) {
        store.pendingImport = null;
        await takeFile(p.file);
        if (p.parent && tree.byId.get(p.parent)) pickTarget(tree.byId.get(p.parent));
        if (p.analyse && source.value && target.value) await analyse();
      }
    });
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
              style: normalizeStyle(`width:${unref(leftW)}px;flex:none`)
            },
            [
              createVNode(unref(ImportHead), {
                source: "table",
                plugin: "table",
                busy: busy.value,
                get: profileGet,
                set: profileSet
              }, {
                default: withCtx(() => [
                  createElementVNode("tr", null, [
                    _cache[19] || (_cache[19] = createElementVNode(
                      "td",
                      { class: "attr" },
                      "Datei",
                      -1
                      /* CACHED */
                    )),
                    createElementVNode(
                      "td",
                      {
                        class: normalizeClass(["row drop", { over: dragOver.value }]),
                        onDragover: _cache[2] || (_cache[2] = withModifiers(($event) => dragOver.value = true, ["prevent"])),
                        onDragleave: _cache[3] || (_cache[3] = ($event) => dragOver.value = false),
                        onDrop: withModifiers(onDrop, ["prevent"])
                      },
                      [
                        createElementVNode("label", {
                          class: "primary btn",
                          title: "CSV, TSV, JSON" + (unref(plugins).importers.length ? ", " + unref(plugins).importers.flatMap((i) => i.accept ?? []).join(", ") : "") + " — oder hierher ziehen",
                          onClick: pickFile
                        }, [
                          _cache[17] || (_cache[17] = createTextVNode(
                            "📂 wählen",
                            -1
                            /* CACHED */
                          )),
                          createElementVNode(
                            "input",
                            {
                              id: "table-file-input",
                              type: "file",
                              style: { "display": "none" },
                              onChange: _cache[0] || (_cache[0] = ($event) => {
                                fileHandle.value = null;
                                takeFile($event.target.files[0]);
                              })
                            },
                            null,
                            32
                            /* NEED_HYDRATION */
                          )
                        ], 8, _hoisted_1$1),
                        source.value ? (openBlock(), createElementBlock("span", {
                          key: 0,
                          class: "chip",
                          title: `${source.value.rows.length} Zeilen · ${source.value.columns.length} Spalten`
                        }, [
                          createTextVNode(
                            "📄 " + toDisplayString(source.value.name) + " ",
                            1
                            /* TEXT */
                          ),
                          createElementVNode(
                            "span",
                            _hoisted_3$1,
                            toDisplayString(source.value.rows.length),
                            1
                            /* TEXT */
                          )
                        ], 8, _hoisted_2$1)) : createCommentVNode("v-if", true),
                        source.value ? (openBlock(), createElementBlock("button", {
                          key: 1,
                          class: "x",
                          onClick: reloadFile,
                          title: fileHandle.value ? "Datei neu von der Platte lesen (zwischendurch in Excel geändert?)" : "Datei neu wählen — dieser Browser kann Dateien nicht erneut lesen"
                        }, "↻", 8, _hoisted_4$1)) : createCommentVNode("v-if", true),
                        source.value?.sheets?.length > 1 ? (openBlock(), createElementBlock("select", {
                          key: 2,
                          value: source.value.sheet,
                          onChange: _cache[1] || (_cache[1] = ($event) => pickSheet($event.target.value)),
                          title: "Blatt",
                          style: { "width": "140px" }
                        }, [
                          (openBlock(true), createElementBlock(
                            Fragment,
                            null,
                            renderList(source.value.sheets, (s) => {
                              return openBlock(), createElementBlock("option", {
                                key: s.name,
                                value: s.name
                              }, toDisplayString(s.name) + " (" + toDisplayString(s.rows.length) + ")", 9, _hoisted_6$1);
                            }),
                            128
                            /* KEYED_FRAGMENT */
                          ))
                        ], 40, _hoisted_5$1)) : !source.value ? (openBlock(), createElementBlock("span", _hoisted_7$1, "oder hierher ziehen")) : createCommentVNode("v-if", true),
                        _cache[18] || (_cache[18] = createElementVNode(
                          "span",
                          { class: "grow" },
                          null,
                          -1
                          /* CACHED */
                        )),
                        source.value ? (openBlock(), createElementBlock("button", {
                          key: 4,
                          class: "x",
                          onClick: resuggest,
                          title: "Zuordnung neu vorschlagen"
                        }, "↻")) : createCommentVNode("v-if", true)
                      ],
                      34
                      /* CLASS, NEED_HYDRATION */
                    )
                  ]),
                  createElementVNode("tr", null, [
                    _cache[20] || (_cache[20] = createElementVNode(
                      "td",
                      { class: "attr" },
                      "Einfügen",
                      -1
                      /* CACHED */
                    )),
                    createElementVNode("td", null, [
                      withDirectives(createElementVNode(
                        "input",
                        {
                          "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => pasteText.value = $event),
                          type: "text",
                          placeholder: "aus Excel kopieren, hier Strg+V (erste Zeile = Spaltennamen)",
                          onPaste: _cache[5] || (_cache[5] = ($event) => _ctx.setTimeout(takePaste, 0))
                        },
                        null,
                        544
                        /* NEED_HYDRATION, NEED_PATCH */
                      ), [
                        [vModelText, pasteText.value]
                      ])
                    ])
                  ]),
                  createElementVNode("tr", _hoisted_8$1, [
                    createElementVNode("td", _hoisted_9$1, [
                      _cache[21] || (_cache[21] = createTextVNode(
                        "2 · Ziel ",
                        -1
                        /* CACHED */
                      )),
                      createElementVNode(
                        "span",
                        _hoisted_10$1,
                        "· " + toDisplayString(fixed.value ? "fest: die Tabelle passt 1:1 zu diesem Knoten" : "wohin neue Zeilen kommen; vorhandene werden über Id, SKU oder Kennung gefunden"),
                        1
                        /* TEXT */
                      )
                    ])
                  ]),
                  fixed.value ? (openBlock(), createElementBlock("tr", _hoisted_11$1, [
                    _cache[23] || (_cache[23] = createElementVNode(
                      "td",
                      { class: "attr" },
                      "Knoten",
                      -1
                      /* CACHED */
                    )),
                    createElementVNode("td", _hoisted_12$1, [
                      createVNode(_component_router_link, {
                        to: `/tree/${fixed.value.row.id}`,
                        class: "chip",
                        title: fixed.value.row.id
                      }, {
                        default: withCtx(() => [
                          createTextVNode(
                            toDisplayString(unref(icon)(fixed.value.row.role)) + " " + toDisplayString(fixed.value.row.label),
                            1
                            /* TEXT */
                          )
                        ]),
                        _: 1
                        /* STABLE */
                      }, 8, ["to", "title"]),
                      createElementVNode(
                        "span",
                        _hoisted_13$1,
                        "→ " + toDisplayString(roleLabel[fixed.value.childRole]) + " · " + toDisplayString(fixed.value.allowed.size) + " mögliche Spalten",
                        1
                        /* TEXT */
                      ),
                      _cache[22] || (_cache[22] = createElementVNode(
                        "span",
                        { class: "grow" },
                        null,
                        -1
                        /* CACHED */
                      )),
                      createElementVNode("button", {
                        class: "x",
                        onClick: _cache[6] || (_cache[6] = ($event) => unref(router).replace("/p/table/import")),
                        title: "Knotenmodus verlassen — frei zuordnen"
                      }, "×")
                    ])
                  ])) : createCommentVNode("v-if", true),
                  !fixed.value ? (openBlock(), createElementBlock("tr", _hoisted_14$1, [
                    _cache[24] || (_cache[24] = createElementVNode(
                      "td",
                      { class: "attr" },
                      "Ziel",
                      -1
                      /* CACHED */
                    )),
                    createElementVNode("td", null, [
                      createElementVNode("div", _hoisted_15$1, [
                        target.value ? (openBlock(), createElementBlock("span", {
                          key: 0,
                          class: "chip",
                          title: target.value.id + " — Klick: im Baum ändern",
                          style: { "cursor": "pointer" },
                          onClick: _cache[8] || (_cache[8] = ($event) => targetPick.value = !targetPick.value)
                        }, [
                          createTextVNode(
                            toDisplayString(unref(icon)(target.value.role)) + " " + toDisplayString(target.value.label) + " ",
                            1
                            /* TEXT */
                          ),
                          createElementVNode("button", {
                            onClick: _cache[7] || (_cache[7] = withModifiers(($event) => {
                              target.value = null;
                              planned.value = null;
                            }, ["stop"])),
                            title: "Ziel weg"
                          }, "×")
                        ], 8, _hoisted_16$1)) : (openBlock(), createElementBlock("span", _hoisted_17$1, "Gruppe oder Produkt — wohin neue Zeilen kommen"))
                      ]),
                      !target.value || targetPick.value ? (openBlock(), createBlock(unref(TreePicker), {
                        key: 0,
                        "model-value": target.value?.id ?? "",
                        height: 200,
                        onPick: pickTarget
                      }, null, 8, ["model-value"])) : createCommentVNode("v-if", true)
                    ])
                  ])) : createCommentVNode("v-if", true),
                  !fixed.value ? (openBlock(), createElementBlock("tr", _hoisted_18, [
                    _cache[26] || (_cache[26] = createElementVNode(
                      "td",
                      { class: "attr" },
                      "Neue als",
                      -1
                      /* CACHED */
                    )),
                    createElementVNode("td", null, [
                      withDirectives(createElementVNode(
                        "select",
                        {
                          "onUpdate:modelValue": _cache[9] || (_cache[9] = ($event) => role.value = $event),
                          title: "Rolle neuer Zeilen",
                          onChange: _cache[10] || (_cache[10] = ($event) => planned.value = null),
                          style: { "width": "100%" }
                        },
                        [..._cache[25] || (_cache[25] = [
                          createElementVNode(
                            "option",
                            { value: "" },
                            "automatisch (unter Gruppe → Produkt, unter Produkt → Variante)",
                            -1
                            /* CACHED */
                          ),
                          createElementVNode(
                            "option",
                            { value: "group" },
                            "▣ Gruppen",
                            -1
                            /* CACHED */
                          ),
                          createElementVNode(
                            "option",
                            { value: "product" },
                            "▦ Produkte",
                            -1
                            /* CACHED */
                          ),
                          createElementVNode(
                            "option",
                            { value: "variant" },
                            "◆ Varianten",
                            -1
                            /* CACHED */
                          )
                        ])],
                        544
                        /* NEED_HYDRATION, NEED_PATCH */
                      ), [
                        [vModelSelect, role.value]
                      ])
                    ])
                  ])) : createCommentVNode("v-if", true),
                  !fixed.value ? (openBlock(), createElementBlock("tr", _hoisted_19, [
                    _cache[27] || (_cache[27] = createElementVNode(
                      "td",
                      { class: "attr" },
                      "Kennung",
                      -1
                      /* CACHED */
                    )),
                    createElementVNode("td", null, [
                      withDirectives(createElementVNode(
                        "input",
                        {
                          "onUpdate:modelValue": _cache[11] || (_cache[11] = ($event) => external.value = $event),
                          type: "text",
                          placeholder: "System der externen Kennung (z. B. erp) — findet vorhandene Knoten",
                          onChange: resuggest
                        },
                        null,
                        544
                        /* NEED_HYDRATION, NEED_PATCH */
                      ), [
                        [vModelText, external.value]
                      ])
                    ])
                  ])) : createCommentVNode("v-if", true)
                ]),
                _: 1
                /* STABLE */
              }, 8, ["busy"]),
              createElementVNode("div", _hoisted_20, [
                !keyColumn.value && source.value ? (openBlock(), createElementBlock("div", _hoisted_21, "⚠ Keine Schlüsselspalte (Id, SKU, Kennung) — jede Zeile wird neu angelegt.")) : createCommentVNode("v-if", true),
                unknown.value ? (openBlock(), createElementBlock(
                  "div",
                  _hoisted_22,
                  "⚠ " + toDisplayString(unknown.value) + " Spalten passen nicht zu diesem Knoten und werden übergangen — Vorlage per Rechtsklick am Knoten exportieren, dann stimmen die Spalten.",
                  1
                  /* TEXT */
                )) : createCommentVNode("v-if", true),
                source.value ? (openBlock(), createElementBlock("div", _hoisted_23, [
                  createElementVNode("h2", _hoisted_24, [
                    _cache[28] || (_cache[28] = createTextVNode(
                      "3 · Zuordnung ",
                      -1
                      /* CACHED */
                    )),
                    createElementVNode(
                      "span",
                      _hoisted_25,
                      "· " + toDisplayString(mapping.value.filter((m2) => m2.target !== "skip").length) + " von " + toDisplayString(mapping.value.length) + " Spalten",
                      1
                      /* TEXT */
                    )
                  ]),
                  createElementVNode("table", _hoisted_26, [
                    _cache[31] || (_cache[31] = createElementVNode(
                      "thead",
                      null,
                      [
                        createElementVNode("tr", null, [
                          createElementVNode("th", { style: { "width": "170px" } }, "Spalte"),
                          createElementVNode("th", null, "Beispiele"),
                          createElementVNode("th", { style: { "width": "130px" } }, "Ziel"),
                          createElementVNode("th", { style: { "width": "220px" } }, "Attribut"),
                          createElementVNode("th", { style: { "width": "60px" } }, "Sprache"),
                          createElementVNode("th", { style: { "width": "150px" } }, "Warum")
                        ])
                      ],
                      -1
                      /* CACHED */
                    )),
                    createElementVNode("tbody", null, [
                      (openBlock(true), createElementBlock(
                        Fragment,
                        null,
                        renderList(mapping.value, (m2, i) => {
                          return openBlock(), createElementBlock(
                            "tr",
                            {
                              key: m2.column,
                              class: normalizeClass({ off: m2.target === "skip" })
                            },
                            [
                              createElementVNode("td", {
                                class: "attr",
                                title: m2.column
                              }, [
                                createElementVNode(
                                  "b",
                                  null,
                                  toDisplayString(m2.column),
                                  1
                                  /* TEXT */
                                ),
                                createElementVNode(
                                  "div",
                                  _hoisted_28,
                                  toDisplayString(m2.sniff?.type) + " · " + toDisplayString(m2.sniff?.distinct) + " versch.",
                                  1
                                  /* TEXT */
                                )
                              ], 8, _hoisted_27),
                              createElementVNode(
                                "td",
                                _hoisted_29,
                                toDisplayString(sample(i)),
                                1
                                /* TEXT */
                              ),
                              createElementVNode("td", null, [
                                withDirectives(createElementVNode("select", {
                                  "onUpdate:modelValue": ($event) => m2.target = $event,
                                  onChange: ($event) => onTarget(m2),
                                  style: { "width": "100%" }
                                }, [
                                  (openBlock(true), createElementBlock(
                                    Fragment,
                                    null,
                                    renderList(TARGETS.filter(([k]) => !fixed.value || !["new", "parent", "external"].includes(k)), ([k, l]) => {
                                      return openBlock(), createElementBlock("option", {
                                        key: k,
                                        value: k
                                      }, toDisplayString(l), 9, _hoisted_31);
                                    }),
                                    128
                                    /* KEYED_FRAGMENT */
                                  ))
                                ], 40, _hoisted_30), [
                                  [vModelSelect, m2.target]
                                ])
                              ]),
                              createElementVNode("td", null, [
                                m2.target === "attr" ? withDirectives((openBlock(), createElementBlock("select", {
                                  key: 0,
                                  "onUpdate:modelValue": ($event) => m2.attribute = $event,
                                  onChange: ($event) => {
                                    syncLocale(m2);
                                    planned.value = null;
                                    m2.unknown = false;
                                  },
                                  style: { "width": "100%" }
                                }, [
                                  (openBlock(true), createElementBlock(
                                    Fragment,
                                    null,
                                    renderList(attrs.value.filter((a) => !fixed.value || fixed.value.allowed.has(a.key)), (a) => {
                                      return openBlock(), createElementBlock("option", {
                                        key: a.key,
                                        value: a.key
                                      }, toDisplayString(a.label?.de || a.key) + " · " + toDisplayString(a.key), 9, _hoisted_33);
                                    }),
                                    128
                                    /* KEYED_FRAGMENT */
                                  ))
                                ], 40, _hoisted_32)), [
                                  [vModelSelect, m2.attribute]
                                ]) : m2.target === "new" ? (openBlock(), createElementBlock("span", _hoisted_34, [
                                  withDirectives(createElementVNode("input", {
                                    "onUpdate:modelValue": ($event) => m2.newKey = $event,
                                    type: "text",
                                    style: { "flex": "1", "min-width": "90px" },
                                    placeholder: "schlüssel",
                                    onChange: _cache[12] || (_cache[12] = ($event) => planned.value = null)
                                  }, null, 40, _hoisted_35), [
                                    [vModelText, m2.newKey]
                                  ]),
                                  withDirectives(createElementVNode("select", {
                                    "onUpdate:modelValue": ($event) => m2.newType = $event,
                                    style: { "width": "84px" },
                                    onChange: _cache[13] || (_cache[13] = ($event) => planned.value = null)
                                  }, [
                                    (openBlock(), createElementBlock(
                                      Fragment,
                                      null,
                                      renderList(["text", "html", "integer", "decimal", "boolean", "date"], (t) => {
                                        return createElementVNode("option", {
                                          key: t,
                                          value: t
                                        }, toDisplayString(t), 9, _hoisted_37);
                                      }),
                                      64
                                      /* STABLE_FRAGMENT */
                                    ))
                                  ], 40, _hoisted_36), [
                                    [vModelSelect, m2.newType]
                                  ]),
                                  withDirectives(createElementVNode("select", {
                                    "onUpdate:modelValue": ($event) => m2.newGroup = $event,
                                    style: { "width": "100%" },
                                    class: normalizeClass({ neg: !m2.newGroup }),
                                    title: "Attributgruppe — Pflicht: ohne Gruppe gilt das Attribut nirgends",
                                    onChange: _cache[14] || (_cache[14] = ($event) => planned.value = null)
                                  }, [
                                    _cache[29] || (_cache[29] = createElementVNode(
                                      "option",
                                      { value: void 0 },
                                      "● Gruppe wählen …",
                                      -1
                                      /* CACHED */
                                    )),
                                    (openBlock(true), createElementBlock(
                                      Fragment,
                                      null,
                                      renderList(groups.value, (g) => {
                                        return openBlock(), createElementBlock("option", {
                                          key: g.key,
                                          value: g.key
                                        }, "▤ " + toDisplayString(g.label?.de || g.key), 9, _hoisted_39);
                                      }),
                                      128
                                      /* KEYED_FRAGMENT */
                                    ))
                                  ], 42, _hoisted_38), [
                                    [vModelSelect, m2.newGroup]
                                  ])
                                ])) : (openBlock(), createElementBlock("span", _hoisted_40, "—"))
                              ]),
                              createElementVNode("td", null, [
                                m2.target === "attr" && attrs.value.find((a) => a.key === m2.attribute)?.perLocale || m2.target === "new" ? withDirectives((openBlock(), createElementBlock("select", {
                                  key: 0,
                                  "onUpdate:modelValue": ($event) => m2.locale = $event,
                                  style: { "width": "100%" },
                                  onChange: _cache[15] || (_cache[15] = ($event) => planned.value = null)
                                }, [
                                  _cache[30] || (_cache[30] = createElementVNode(
                                    "option",
                                    { value: null },
                                    "*",
                                    -1
                                    /* CACHED */
                                  )),
                                  (openBlock(true), createElementBlock(
                                    Fragment,
                                    null,
                                    renderList(locales.value, (l) => {
                                      return openBlock(), createElementBlock("option", {
                                        key: l,
                                        value: l
                                      }, toDisplayString(l), 9, _hoisted_42);
                                    }),
                                    128
                                    /* KEYED_FRAGMENT */
                                  ))
                                ], 40, _hoisted_41)), [
                                  [vModelSelect, m2.locale]
                                ]) : createCommentVNode("v-if", true)
                              ]),
                              createElementVNode(
                                "td",
                                _hoisted_43,
                                toDisplayString(m2.why),
                                1
                                /* TEXT */
                              )
                            ],
                            2
                            /* CLASS */
                          );
                        }),
                        128
                        /* KEYED_FRAGMENT */
                      ))
                    ])
                  ])
                ])) : createCommentVNode("v-if", true)
              ])
            ],
            4
            /* STYLE */
          ),
          createVNode(unref(Splitter), {
            modelValue: unref(leftW),
            "onUpdate:modelValue": _cache[16] || (_cache[16] = ($event) => isRef(leftW) ? leftW.value = $event : null),
            min: 480,
            max: 1400
          }, null, 8, ["modelValue"]),
          createElementVNode("div", _hoisted_44, [
            createElementVNode("div", _hoisted_45, [
              _cache[32] || (_cache[32] = createElementVNode(
                "h1",
                null,
                "4 · Plan",
                -1
                /* CACHED */
              )),
              createElementVNode("button", {
                class: "primary",
                disabled: !source.value || !!busy.value,
                onClick: analyse
              }, "analysieren", 8, _hoisted_46),
              createElementVNode("button", {
                class: "primary",
                disabled: !planned.value || !!busy.value || !planned.value.commands.length || blockers.value.length > 0 || planned.value.stale,
                onClick: run,
                title: !planned.value ? "erst analysieren" : blockers.value[0] ?? (planned.value.stale ? "erst erneut analysieren" : `${planned.value.commands.length} Befehle schreiben`)
              }, "▶ schreiben", 8, _hoisted_47),
              _cache[33] || (_cache[33] = createElementVNode(
                "span",
                { class: "grow" },
                null,
                -1
                /* CACHED */
              )),
              createElementVNode(
                "span",
                _hoisted_48,
                toDisplayString(unref(store).actor ? "👤 " + unref(store).actor : "👤 Name fehlt"),
                1
                /* TEXT */
              )
            ]),
            createElementVNode("div", _hoisted_49, [
              planned.value ? (openBlock(), createElementBlock("div", _hoisted_50, [
                createElementVNode(
                  "span",
                  _hoisted_51,
                  "+" + toDisplayString(planned.value.stats.create) + " neu",
                  1
                  /* TEXT */
                ),
                _cache[40] || (_cache[40] = createTextVNode(
                  " · ",
                  -1
                  /* CACHED */
                )),
                createElementVNode(
                  "span",
                  null,
                  toDisplayString(planned.value.stats.update) + " geändert",
                  1
                  /* TEXT */
                ),
                _cache[41] || (_cache[41] = createTextVNode(
                  " · ",
                  -1
                  /* CACHED */
                )),
                createElementVNode(
                  "span",
                  _hoisted_52,
                  toDisplayString(planned.value.stats.unchanged) + " unverändert",
                  1
                  /* TEXT */
                ),
                createTextVNode(
                  " · " + toDisplayString(planned.value.stats.values) + " Werte · " + toDisplayString(planned.value.commands.length) + " Befehle",
                  1
                  /* TEXT */
                ),
                Object.keys(planned.value.stats.newListValues ?? {}).length ? (openBlock(), createElementBlock(
                  Fragment,
                  { key: 0 },
                  [
                    _cache[34] || (_cache[34] = createTextVNode(
                      " · ",
                      -1
                      /* CACHED */
                    )),
                    createElementVNode("span", {
                      class: "pos",
                      title: Object.entries(planned.value.stats.newListValues).map(([l, v]) => l + ": " + Object.values(v).join(", ")).join(" · ")
                    }, "+" + toDisplayString(Object.values(planned.value.stats.newListValues).reduce((n, v) => n + Object.keys(v).length, 0)) + " Listenwerte", 9, _hoisted_53)
                  ],
                  64
                  /* STABLE_FRAGMENT */
                )) : createCommentVNode("v-if", true),
                planned.value.newAttributes.length ? (openBlock(), createElementBlock("span", _hoisted_54, [
                  _cache[35] || (_cache[35] = createTextVNode(
                    " · ",
                    -1
                    /* CACHED */
                  )),
                  createElementVNode(
                    "span",
                    _hoisted_55,
                    toDisplayString(planned.value.newAttributes.length) + " neue Attribute:",
                    1
                    /* TEXT */
                  ),
                  createTextVNode(
                    " " + toDisplayString(planned.value.newAttributes.map((a) => a.key + " (" + a.type + ")").join(", ")),
                    1
                    /* TEXT */
                  )
                ])) : createCommentVNode("v-if", true),
                planned.value.stats.problems.length ? (openBlock(), createElementBlock("div", _hoisted_56, [
                  createTextVNode(
                    toDisplayString(planned.value.stats.problems.slice(0, 30).join("\n")),
                    1
                    /* TEXT */
                  ),
                  planned.value.stats.problems.length > 30 ? (openBlock(), createElementBlock(
                    "span",
                    _hoisted_57,
                    " … +" + toDisplayString(planned.value.stats.problems.length - 30),
                    1
                    /* TEXT */
                  )) : createCommentVNode("v-if", true)
                ])) : createCommentVNode("v-if", true),
                (openBlock(true), createElementBlock(
                  Fragment,
                  null,
                  renderList(blockers.value, (b) => {
                    return openBlock(), createElementBlock(
                      "div",
                      {
                        key: b,
                        class: "neg",
                        style: { "margin-top": "6px" }
                      },
                      "✗ " + toDisplayString(b),
                      1
                      /* TEXT */
                    );
                  }),
                  128
                  /* KEYED_FRAGMENT */
                )),
                planned.value.stale ? (openBlock(), createElementBlock("div", _hoisted_58, [
                  _cache[36] || (_cache[36] = createTextVNode(
                    "✎ Zellen korrigiert — ",
                    -1
                    /* CACHED */
                  )),
                  createElementVNode("button", {
                    class: "primary",
                    onClick: analyse
                  }, "erneut analysieren")
                ])) : createCommentVNode("v-if", true),
                planned.value.stats.invalid.length ? (openBlock(), createElementBlock("div", _hoisted_59, [
                  createElementVNode("h2", _hoisted_60, [
                    _cache[37] || (_cache[37] = createTextVNode(
                      "Werte prüfen ",
                      -1
                      /* CACHED */
                    )),
                    createElementVNode(
                      "span",
                      _hoisted_61,
                      "· " + toDisplayString(planned.value.stats.invalid.length) + " Zellen" + toDisplayString(fixed.value ? " — im Knotenmodus in Excel korrigieren und neu laden" : " — hier korrigieren, dann erneut analysieren"),
                      1
                      /* TEXT */
                    )
                  ]),
                  createElementVNode("table", _hoisted_62, [
                    _cache[38] || (_cache[38] = createElementVNode(
                      "thead",
                      null,
                      [
                        createElementVNode("tr", null, [
                          createElementVNode("th", { style: { "width": "60px" } }, "Zeile"),
                          createElementVNode("th", { style: { "width": "160px" } }, "Spalte"),
                          createElementVNode("th", null, "Grund"),
                          createElementVNode("th", { style: { "width": "220px" } }, "Korrektur")
                        ])
                      ],
                      -1
                      /* CACHED */
                    )),
                    createElementVNode("tbody", null, [
                      (openBlock(true), createElementBlock(
                        Fragment,
                        null,
                        renderList(planned.value.stats.invalid.slice(0, 200), (inv) => {
                          return openBlock(), createElementBlock("tr", {
                            key: inv.row + "|" + inv.column
                          }, [
                            createElementVNode(
                              "td",
                              _hoisted_63,
                              toDisplayString(inv.row + 2),
                              1
                              /* TEXT */
                            ),
                            createElementVNode(
                              "td",
                              _hoisted_64,
                              toDisplayString(source.value.columns[inv.column]),
                              1
                              /* TEXT */
                            ),
                            createElementVNode(
                              "td",
                              null,
                              toDisplayString(inv.message),
                              1
                              /* TEXT */
                            ),
                            createElementVNode("td", null, [
                              !fixed.value ? (openBlock(), createElementBlock("input", {
                                key: 0,
                                type: "text",
                                value: inv.value,
                                style: { "width": "100%" },
                                onChange: ($event) => fixCell(inv, $event.target.value)
                              }, null, 40, _hoisted_65)) : (openBlock(), createElementBlock(
                                "span",
                                _hoisted_66,
                                toDisplayString(inv.value),
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
                ])) : createCommentVNode("v-if", true),
                createElementVNode("details", _hoisted_67, [
                  _cache[39] || (_cache[39] = createElementVNode(
                    "summary",
                    { class: "muted" },
                    "Befehle (erste 200)",
                    -1
                    /* CACHED */
                  )),
                  createElementVNode(
                    "pre",
                    _hoisted_68,
                    toDisplayString(planned.value.commands.slice(0, 200).map((c) => `${c.op} ${JSON.stringify(c.args)}`).join("\n")),
                    1
                    /* TEXT */
                  )
                ])
              ])) : source.value ? (openBlock(), createElementBlock("div", _hoisted_69, "Zuordnung prüfen, Ziel wählen, dann analysieren. Nichts wird geschrieben, bevor Du „schreiben“ drückst.")) : (openBlock(), createElementBlock("div", _hoisted_70, [..._cache[42] || (_cache[42] = [
                createTextVNode(
                  "Datei ablegen oder aus Excel einfügen.",
                  -1
                  /* CACHED */
                ),
                createElementVNode(
                  "br",
                  null,
                  null,
                  -1
                  /* CACHED */
                ),
                createElementVNode(
                  "span",
                  {
                    class: "muted",
                    style: { "font-size": "12px" }
                  },
                  "Der Mapper erkennt Spalten an Schlüssel, Label, Synonymen (Artikelnummer → sku …), Sprache im Namen (name_en) und rät den Typ neuer Attribute aus den Werten.",
                  -1
                  /* CACHED */
                )
              ])])),
              result.value ? (openBlock(), createElementBlock("div", _hoisted_71, [
                createTextVNode(
                  "✓ " + toDisplayString(result.value.written) + " Einträge geschrieben · Stapel " + toDisplayString(result.value.batch) + " — ",
                  1
                  /* TEXT */
                ),
                createVNode(_component_router_link, {
                  to: { path: "/journal", query: { q: result.value.batch } }
                }, {
                  default: withCtx(() => [..._cache[43] || (_cache[43] = [
                    createTextVNode(
                      "im Journal",
                      -1
                      /* CACHED */
                    )
                  ])]),
                  _: 1
                  /* STABLE */
                }, 8, ["to"])
              ])) : createCommentVNode("v-if", true),
              log.value.length ? (openBlock(), createElementBlock("div", _hoisted_72, [
                _cache[44] || (_cache[44] = createElementVNode(
                  "h2",
                  null,
                  "Protokoll",
                  -1
                  /* CACHED */
                )),
                createElementVNode(
                  "div",
                  _hoisted_73,
                  toDisplayString(log.value.join("\n")),
                  1
                  /* TEXT */
                )
              ])) : createCommentVNode("v-if", true)
            ])
          ])
        ],
        64
        /* STABLE_FRAGMENT */
      );
    };
  }
};
const ImportView = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["__scopeId", "data-v-445c3753"]]);
async function build$1(env, { root, role = "", locales, ownOnly = false, viewKey = "", channel = "", only = null, extra = [], say }) {
  const { api: api2, model } = env;
  const byLocale = /* @__PURE__ */ new Map();
  let cols = [], nodes = [];
  for (const l of locales) {
    say?.(`lese ${l} …`);
    const t = await api2.get(`/api/nodes/${encodeURIComponent(root)}/table?deep=true&locale=${l}${channel ? "&channel=" + encodeURIComponent(channel) : ""}${role ? "&role=" + role : ""}`);
    cols = t.columns;
    nodes = only ? t.rows.filter((r) => only.has(r.row.id)) : t.rows;
    byLocale.set(l, new Map(t.rows.map((r) => [r.row.id, r.values])));
  }
  const v = model.views.find((x) => x.key === viewKey);
  if (v) {
    const order = v.items.flatMap((it) => it.order ?? []);
    const groups = new Map(model.groups.map((g) => [g.key, g.attributes]));
    const wanted = /* @__PURE__ */ new Set([...order, ...v.items.flatMap((it) => it.group ? groups.get(it.group) ?? [] : [])]);
    cols = cols.filter((c) => wanted.has(c.key)).sort((a, b) => (order.indexOf(a.key) + 1 || 999) - (order.indexOf(b.key) + 1 || 999));
  }
  cols = cols.filter((c) => c.type !== "rows" && !c.computed);
  const axes = [...new Set(nodes.flatMap((r) => Object.keys(r.row.axisValues ?? {})))];
  const columns = [
    { key: "id" },
    { key: "role" },
    { key: "parent" },
    { key: "sku" },
    { key: "journali_label" },
    { key: "status" },
    ...extra.map((x) => ({ key: x.key, of: x.of })),
    ...axes.map((a) => ({ key: "axis:" + a })),
    ...cols.flatMap((c) => c.perLocale ? locales.map((l) => ({ key: `${c.key}_${l}`, attr: c.key, locale: l })) : [{ key: c.key, attr: c.key, locale: locales[0] }])
  ];
  const rows = nodes.map((r) => columns.map((c) => {
    if (c.attr) {
      const x = byLocale.get(c.locale)?.get(r.row.id)?.[c.attr];
      return x == null || ownOnly && !x.own ? "" : x.value ?? "";
    }
    if (c.of) return c.of(r.row.id) ?? "";
    if (c.key.startsWith("axis:")) return r.row.axisValues?.[c.key.slice(5)] ?? "";
    return c.key === "journali_label" ? r.row.label : c.key === "parent" ? r.row.parent ?? "" : r.row[c.key] ?? "";
  }));
  return { columns, rows, count: nodes.length };
}
function toCsv({ columns, rows }) {
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return "\uFEFF" + [columns.map((c) => c.key).join(";"), ...rows.map((r) => r.map(esc).join(";"))].join("\r\n");
}
function toJson({ columns, rows }) {
  return JSON.stringify(rows.map((r) => Object.fromEntries(columns.map((c, i) => [c.key, r[i] === "" ? null : r[i]]))), null, 1);
}
function toJsonTree({ columns, rows }) {
  const byId = /* @__PURE__ */ new Map();
  for (const r of rows) {
    const o = { id: r[0], role: "", parent: null, name: "", sku: null, status: null, axes: {}, attributes: {}, children: [] };
    columns.forEach((c, i) => {
      const v = r[i] === "" ? null : r[i];
      if (c.attr) {
        if (c.locale && columns.some((x) => x.attr === c.attr && x.locale !== c.locale)) (o.attributes[c.attr] ??= {})[c.locale] = v;
        else o.attributes[c.attr] = v;
      } else if (c.key.startsWith("axis:")) {
        if (v != null) o.axes[c.key.slice(5)] = v;
      } else if (c.key === "journali_label") o.name = v;
      else if (c.key === "parent") o.parent = v;
      else o[c.key] = v;
    });
    for (const k of Object.keys(o.attributes)) {
      const a = o.attributes[k];
      if (a && typeof a === "object" && Object.values(a).every((x) => x == null)) delete o.attributes[k];
      else if (a == null) delete o.attributes[k];
    }
    byId.set(o.id, o);
  }
  const roots = [];
  for (const o of byId.values()) {
    const p = o.parent && byId.get(o.parent);
    if (p) p.children.push(o);
    else roots.push(o);
  }
  const strip = (o) => {
    delete o.parent;
    if (!o.children.length) delete o.children;
    else o.children.forEach(strip);
    if (!Object.keys(o.axes).length) delete o.axes;
    return o;
  };
  return JSON.stringify(roots.length === 1 ? strip(roots[0]) : roots.map(strip), null, 1);
}
function workbook(X, { columns, rows }, legendRows = null, sheet = "Daten") {
  const ws = X.utils.aoa_to_sheet([columns.map((c) => c.key), ...rows]);
  ws["!cols"] = columns.map((c) => ({ wch: Math.min(40, Math.max(8, c.key.length + 2)) }));
  columns.forEach((c, i) => {
    const req = c.def?.required;
    const note = c.note ?? (req && typeof req === "object" && Object.keys(req).length ? "Pflicht: " + Object.entries(req).map(([ch, l]) => `${ch} ${l.join(",")}`).join(" · ") : req ? "Pflicht" : null);
    if (!note) return;
    const ref2 = X.utils.encode_cell({ r: 0, c: i });
    ws[ref2] ??= { t: "s", v: c.key };
    ws[ref2].c = [{ a: "journali", t: note }];
    ws[ref2].c.hidden = true;
  });
  if (columns.length) ws["!autofilter"] = { ref: X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(1, rows.length), c: columns.length - 1 } }) };
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, ws, sheet);
  if (legendRows) {
    const lg = X.utils.aoa_to_sheet(legendRows);
    lg["!cols"] = [{ wch: 8 }, { wch: 24 }, { wch: 28 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 60 }];
    lg["!autofilter"] = { ref: X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(1, legendRows.length - 1), c: legendRows[0].length - 1 } }) };
    X.utils.book_append_sheet(wb, lg, "Legende");
  }
  return wb;
}
const download = (blob, name) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1e3);
};
const XLSX_URL = "/plugins/xlsx/xlsx.mjs";
const loadXlsx = () => import(
  /* @vite-ignore */
  XLSX_URL
);
const POLISH_URL = "/plugins/xlsx/polish.mjs";
async function polished(X, wb, columns, rowCount, tableName, legendRows = null) {
  const raw = X.write(wb, { type: "array", bookType: "xlsx" });
  try {
    const { polish } = await import(
      /* @vite-ignore */
      POLISH_URL
    );
    return await polish(raw, { columns, rowCount, tableName, legend: legendRows ? { columns: legendRows[0], rowCount: legendRows.length - 1 } : null });
  } catch (e) {
    console.warn("Excel ohne Politur:", e.message);
    return new Blob([raw], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }
}
const build = (opts) => build$1({ api, model: store.model }, opts);
async function toXlsx(table, sheet = "Daten") {
  const X = await loadXlsx();
  return polished(X, workbook(X, table, null, sheet), table.columns, table.rows.length, sheet);
}
async function nodeColumns(nodeId) {
  if (!tree.loaded) await tree.load();
  const row = tree.byId.get(nodeId);
  const n = await api.get(`/api/nodes/${encodeURIComponent(nodeId)}`);
  const childRole = mapper.childRoleOf(row, tree.kids(nodeId));
  const locales = store.model.locales.map((l) => l.code);
  return { row, childRole, columns: mapper.childColumns(store.model, n, childRole, row.axes ?? [], locales) };
}
function legend(columns) {
  const model = store.model;
  const rows = [["Pflicht", "Spalte", "Label", "Typ", "Einheit", "Sprache", "Werte / Hinweis"]];
  for (const c of columns) {
    const d = c.def ?? (c.attr ? model.attributes.find((a) => a.key === c.attr) : null);
    const list = d?.list ? model.lists.find((l) => l.key === d.list) : null;
    const req = d?.required && (typeof d.required !== "object" || Object.keys(d.required).length) || c.key.startsWith("axis:");
    rows.push([req ? "ja" : "nein", c.key, d?.label?.de ?? "", d?.type ?? "", d?.unit ?? "", c.locale ?? "", c.note ?? (list ? list.values.map((v) => `${v.value} = ${v.label?.de ?? v.value}`).join(" · ") : "")]);
  }
  return rows;
}
async function nodeWorkbook(nodeId, withData) {
  const X = await loadXlsx();
  const { row, childRole, columns } = await nodeColumns(nodeId);
  let data = [];
  if (withData) {
    const locales = store.model.locales.map((l) => l.code);
    const byLocale = /* @__PURE__ */ new Map();
    let nodes = [];
    for (const l of locales) {
      const t = await api.get(`/api/nodes/${encodeURIComponent(nodeId)}/table?locale=${l}&role=${childRole}`);
      nodes = t.rows;
      byLocale.set(l, new Map(t.rows.map((r) => [r.row.id, r.values])));
    }
    data = nodes.map((r) => columns.map((c) => c.key === "id" ? r.row.id : c.key === "sku" ? r.row.sku ?? "" : c.key.startsWith("axis:") ? r.row.axisValues?.[c.attr] ?? "" : byLocale.get(c.locale ?? locales[0])?.get(r.row.id)?.[c.attr]?.value ?? ""));
  }
  const lg = legend(columns);
  const wb = workbook(X, { columns, rows: data }, lg);
  const name = `${row.label}-${childRole}${withData ? "" : "-vorlage"}`.replace(/[^\w.-]+/g, "_") + ".xlsx";
  download(await polished(X, wb, columns, data.length, childRole === "variant" ? "Varianten" : childRole === "product" ? "Produkte" : "Gruppen", lg), name);
  store.toast(`⇪ ${name}: ${columns.length} Spalten${withData ? `, ${data.length} Zeilen` : ""}`);
}
const tableExport = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  build,
  download,
  loadXlsx,
  nodeWorkbook,
  toCsv,
  toJson,
  toJsonTree,
  toXlsx
}, Symbol.toStringTag, { value: "Module" }));
const _hoisted_1 = {
  class: "pane",
  style: { "flex": "1" }
};
const _hoisted_2 = { class: "toolbar" };
const _hoisted_3 = { class: "muted" };
const _hoisted_4 = { class: "grid form" };
const _hoisted_5 = {
  class: "chips",
  style: { "margin": "2px 0 4px" }
};
const _hoisted_6 = {
  key: 0,
  class: "muted"
};
const _hoisted_7 = { class: "chips" };
const _hoisted_8 = ["onClick"];
const _hoisted_9 = ["value"];
const _hoisted_10 = { class: "row" };
const _hoisted_11 = ["onClick"];
const _hoisted_12 = ["onClick"];
const _hoisted_13 = { class: "scroll" };
const _hoisted_14 = {
  key: 0,
  class: "grid",
  style: { "width": "auto" }
};
const _hoisted_15 = ["title"];
const _hoisted_16 = {
  key: 1,
  class: "muted",
  style: { "padding": "8px" }
};
const _hoisted_17 = {
  key: 2,
  class: "empty"
};
const _sfc_main = {
  __name: "ExportView",
  setup(__props) {
    const route = useRoute();
    const saved = JSON.parse(localStorage.getItem("journali.export.table") || "{}");
    const roots = ref(route.query.node ? [route.query.node] : saved.roots ?? []);
    const role = ref(saved.role ?? "");
    const locales = ref(saved.locales ?? [store.model?.masterLocale ?? "de"]);
    const ownOnly = ref(saved.ownOnly ?? false);
    const viewKey = ref(saved.viewKey ?? "");
    const format = ref(saved.format ?? "xlsx");
    const rootRows = computed(() => roots.value.map((id) => tree.byId.get(id)).filter(Boolean));
    const busy = ref("");
    const table = ref(null);
    const persist = () => localStorage.setItem("journali.export.table", JSON.stringify({ roots: roots.value, role: role.value, locales: locales.value, ownOnly: ownOnly.value, viewKey: viewKey.value, format: format.value }));
    onMounted(async () => {
      if (!tree.loaded) await tree.load();
      if (!roots.value.length) roots.value = tree.rows.filter((r) => !r.parent).slice(0, 1).map((r) => r.id);
    });
    function toggleLocale(c) {
      const s = new Set(locales.value);
      s.has(c) ? s.delete(c) : s.add(c);
      locales.value = store.model.locales.map((l) => l.code).filter((x) => s.has(x));
      persist();
    }
    async function run(downloadIt) {
      if (!roots.value.length) {
        store.toast("Teilbaum im Baum anhaken");
        return;
      }
      if (!locales.value.length) {
        store.toast("mindestens eine Sprache");
        return;
      }
      try {
        persist();
        const parts = [];
        for (const r of roots.value) parts.push(await build({ root: r, role: role.value, locales: locales.value, ownOnly: ownOnly.value, viewKey: viewKey.value, say: (m2) => {
          busy.value = m2;
        } }));
        const colKeys = [...new Set(parts.flatMap((p) => p.columns.map((c) => c.key)))];
        const columns = colKeys.map((k) => parts.flatMap((p) => p.columns).find((c) => c.key === k));
        const seen = /* @__PURE__ */ new Set();
        const rows = [];
        for (const p of parts) {
          const idx = p.columns.map((c) => colKeys.indexOf(c.key));
          for (const r of p.rows) {
            if (seen.has(r[0])) continue;
            seen.add(r[0]);
            const line = colKeys.map(() => "");
            r.forEach((v, i) => {
              line[idx[i]] = v;
            });
            rows.push(line);
          }
        }
        const t = { columns, rows, count: rows.length };
        table.value = t;
        busy.value = `${t.count} Zeilen · ${t.columns.length} Spalten`;
        if (!downloadIt) return;
        const name = `${rootRows.value.map((r) => r.label).join("+") || "export"}-${role.value || "alle"}-${locales.value.join("-")}`.replace(/[^\w.-]+/g, "_").slice(0, 80);
        if (format.value === "csv") download(new Blob([toCsv(t)], { type: "text/csv;charset=utf-8" }), name + ".csv");
        else download(await toXlsx(t), name + ".xlsx");
        store.toast(`⇪ ${t.count} Zeilen exportiert`, "ok");
      } catch (e) {
        busy.value = "✗ " + e.message;
        store.toast(e.message);
      }
    }
    return (_ctx, _cache) => {
      const _component_router_link = resolveComponent("router-link");
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createElementVNode("div", _hoisted_2, [
          _cache[9] || (_cache[9] = createElementVNode(
            "h1",
            null,
            "⇪ Export",
            -1
            /* CACHED */
          )),
          createVNode(_component_router_link, {
            to: "/p/table/export",
            class: "tab on"
          }, {
            default: withCtx(() => [..._cache[7] || (_cache[7] = [
              createTextVNode(
                "⊞ Tabelle",
                -1
                /* CACHED */
              )
            ])]),
            _: 1
            /* STABLE */
          }),
          unref(plugins).enabled("json") ? (openBlock(), createBlock(_component_router_link, {
            key: 0,
            to: "/p/json/export",
            class: "tab"
          }, {
            default: withCtx(() => [..._cache[8] || (_cache[8] = [
              createTextVNode(
                "{} JSON",
                -1
                /* CACHED */
              )
            ])]),
            _: 1
            /* STABLE */
          })) : createCommentVNode("v-if", true),
          _cache[10] || (_cache[10] = createElementVNode(
            "span",
            { class: "grow" },
            null,
            -1
            /* CACHED */
          )),
          createElementVNode(
            "span",
            _hoisted_3,
            toDisplayString(busy.value),
            1
            /* TEXT */
          )
        ]),
        createElementVNode("table", _hoisted_4, [
          _cache[24] || (_cache[24] = createElementVNode(
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
            _cache[22] || (_cache[22] = createElementVNode(
              "tr",
              { class: "step" },
              [
                createElementVNode("td", {
                  colspan: "2",
                  class: "step-band",
                  style: { "display": "table-cell", "height": "24px" }
                }, "1 · Was")
              ],
              -1
              /* CACHED */
            )),
            createElementVNode("tr", null, [
              _cache[11] || (_cache[11] = createElementVNode(
                "td",
                { class: "attr" },
                "Teilbaum",
                -1
                /* CACHED */
              )),
              createElementVNode("td", null, [
                createElementVNode("div", _hoisted_5, [
                  (openBlock(true), createElementBlock(
                    Fragment,
                    null,
                    renderList(rootRows.value, (r) => {
                      return openBlock(), createElementBlock(
                        "span",
                        {
                          key: r.id,
                          class: "chip"
                        },
                        toDisplayString(unref(icon)(r.role)) + " " + toDisplayString(r.label),
                        1
                        /* TEXT */
                      );
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  )),
                  !rootRows.value.length ? (openBlock(), createElementBlock("span", _hoisted_6, "Teilbäume anhaken — ein Haken gilt für alles darunter")) : createCommentVNode("v-if", true)
                ]),
                createVNode(unref(TreePicker), {
                  modelValue: roots.value,
                  "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => roots.value = $event),
                  multi: "",
                  height: 220
                }, null, 8, ["modelValue"])
              ])
            ]),
            createElementVNode("tr", null, [
              _cache[13] || (_cache[13] = createElementVNode(
                "td",
                { class: "attr" },
                "Knoten",
                -1
                /* CACHED */
              )),
              createElementVNode("td", null, [
                withDirectives(createElementVNode(
                  "select",
                  {
                    "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => role.value = $event),
                    onChange: persist,
                    style: { "width": "100%" }
                  },
                  [..._cache[12] || (_cache[12] = [
                    createElementVNode(
                      "option",
                      { value: "" },
                      "alle Knoten darunter",
                      -1
                      /* CACHED */
                    ),
                    createElementVNode(
                      "option",
                      { value: "group" },
                      "▣ nur Gruppen",
                      -1
                      /* CACHED */
                    ),
                    createElementVNode(
                      "option",
                      { value: "product" },
                      "▦ nur Produkte",
                      -1
                      /* CACHED */
                    ),
                    createElementVNode(
                      "option",
                      { value: "variant" },
                      "◆ nur Varianten",
                      -1
                      /* CACHED */
                    )
                  ])],
                  544
                  /* NEED_HYDRATION, NEED_PATCH */
                ), [
                  [vModelSelect, role.value]
                ])
              ])
            ]),
            createElementVNode("tr", null, [
              _cache[14] || (_cache[14] = createElementVNode(
                "td",
                { class: "attr" },
                "Sprachen",
                -1
                /* CACHED */
              )),
              createElementVNode("td", null, [
                createElementVNode("div", _hoisted_7, [
                  (openBlock(true), createElementBlock(
                    Fragment,
                    null,
                    renderList(unref(store).model?.locales ?? [], (l) => {
                      return openBlock(), createElementBlock("span", {
                        key: l.code,
                        class: normalizeClass(["view-chip", { on: locales.value.includes(l.code) }]),
                        onClick: ($event) => toggleLocale(l.code)
                      }, toDisplayString(l.code), 11, _hoisted_8);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ])
              ])
            ]),
            createElementVNode("tr", null, [
              _cache[16] || (_cache[16] = createElementVNode(
                "td",
                { class: "attr" },
                "Attribute",
                -1
                /* CACHED */
              )),
              createElementVNode("td", null, [
                withDirectives(createElementVNode(
                  "select",
                  {
                    "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => viewKey.value = $event),
                    onChange: persist,
                    style: { "width": "100%" }
                  },
                  [
                    _cache[15] || (_cache[15] = createElementVNode(
                      "option",
                      { value: "" },
                      "◫ alle Attribute",
                      -1
                      /* CACHED */
                    )),
                    (openBlock(true), createElementBlock(
                      Fragment,
                      null,
                      renderList(unref(store).model?.views ?? [], (v) => {
                        return openBlock(), createElementBlock("option", {
                          key: v.key,
                          value: v.key
                        }, "◫ " + toDisplayString(v.label?.de || v.key) + " (" + toDisplayString(v.level) + ")", 9, _hoisted_9);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ],
                  544
                  /* NEED_HYDRATION, NEED_PATCH */
                ), [
                  [vModelSelect, viewKey.value]
                ])
              ])
            ]),
            createElementVNode("tr", null, [
              _cache[18] || (_cache[18] = createElementVNode(
                "td",
                { class: "attr" },
                "Werte",
                -1
                /* CACHED */
              )),
              createElementVNode("td", null, [
                createElementVNode("label", null, [
                  withDirectives(createElementVNode(
                    "input",
                    {
                      type: "checkbox",
                      "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => ownOnly.value = $event),
                      onChange: persist
                    },
                    null,
                    544
                    /* NEED_HYDRATION, NEED_PATCH */
                  ), [
                    [vModelCheckbox, ownOnly.value]
                  ]),
                  _cache[17] || (_cache[17] = createTextVNode(
                    " nur eigene Werte (geerbte leer lassen)",
                    -1
                    /* CACHED */
                  ))
                ])
              ])
            ]),
            _cache[23] || (_cache[23] = createElementVNode(
              "tr",
              { class: "step" },
              [
                createElementVNode("td", {
                  colspan: "2",
                  class: "step-band",
                  style: { "display": "table-cell", "height": "24px" }
                }, "2 · Wie")
              ],
              -1
              /* CACHED */
            )),
            createElementVNode("tr", null, [
              _cache[20] || (_cache[20] = createElementVNode(
                "td",
                { class: "attr" },
                "Format",
                -1
                /* CACHED */
              )),
              createElementVNode("td", null, [
                withDirectives(createElementVNode(
                  "select",
                  {
                    "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => format.value = $event),
                    onChange: persist,
                    style: { "width": "100%" }
                  },
                  [..._cache[19] || (_cache[19] = [
                    createElementVNode(
                      "option",
                      { value: "xlsx" },
                      "Excel (.xlsx)",
                      -1
                      /* CACHED */
                    ),
                    createElementVNode(
                      "option",
                      { value: "csv" },
                      "CSV (; UTF-8, Excel-tauglich)",
                      -1
                      /* CACHED */
                    )
                  ])],
                  544
                  /* NEED_HYDRATION, NEED_PATCH */
                ), [
                  [vModelSelect, format.value]
                ])
              ])
            ]),
            createElementVNode("tr", null, [
              _cache[21] || (_cache[21] = createElementVNode(
                "td",
                { class: "attr" },
                null,
                -1
                /* CACHED */
              )),
              createElementVNode("td", null, [
                createElementVNode("div", _hoisted_10, [
                  createElementVNode("button", {
                    onClick: _cache[5] || (_cache[5] = ($event) => run(false))
                  }, "Vorschau"),
                  createElementVNode("button", {
                    class: "primary",
                    onClick: _cache[6] || (_cache[6] = ($event) => run(true))
                  }, "⇪ herunterladen"),
                  unref(plugins).enabled("export") ? (openBlock(), createBlock(_component_router_link, {
                    key: 0,
                    to: "/p/tasker/jobs?new=export",
                    custom: ""
                  }, {
                    default: withCtx(({ navigate }) => [
                      createElementVNode("button", {
                        onClick: navigate,
                        title: "denselben Export regelmäßig als Datei in ein Verzeichnis — Plugin export (Prozess)"
                      }, "⏱ als Job", 8, _hoisted_11)
                    ]),
                    _: 1
                    /* STABLE */
                  })) : createCommentVNode("v-if", true),
                  unref(plugins).enabled("export") ? (openBlock(), createBlock(_component_router_link, {
                    key: 1,
                    to: "/p/tasker/jobs?plugin=export",
                    custom: ""
                  }, {
                    default: withCtx(({ navigate }) => [
                      createElementVNode("button", {
                        onClick: navigate,
                        title: "die Export-Jobs unter ⏱ Jobs — Zeitplan, Läufe, Logs"
                      }, "⏱ Jobs verwalten", 8, _hoisted_12)
                    ]),
                    _: 1
                    /* STABLE */
                  })) : createCommentVNode("v-if", true)
                ])
              ])
            ])
          ])
        ]),
        _cache[25] || (_cache[25] = createElementVNode(
          "div",
          { class: "step-band" },
          [
            createTextVNode("3 · Vorschau "),
            createElementVNode("span", { class: "muted" }, "· erste 200 Zeilen")
          ],
          -1
          /* CACHED */
        )),
        createElementVNode("div", _hoisted_13, [
          table.value ? (openBlock(), createElementBlock("table", _hoisted_14, [
            createElementVNode("thead", null, [
              createElementVNode("tr", null, [
                (openBlock(true), createElementBlock(
                  Fragment,
                  null,
                  renderList(table.value.columns, (c) => {
                    return openBlock(), createElementBlock("th", {
                      key: c.key,
                      title: c.attr ? `${c.attr} · ${c.locale}` : c.key
                    }, toDisplayString(c.key), 9, _hoisted_15);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ])
            ]),
            createElementVNode("tbody", null, [
              (openBlock(true), createElementBlock(
                Fragment,
                null,
                renderList(table.value.rows.slice(0, 200), (r, i) => {
                  return openBlock(), createElementBlock("tr", { key: i }, [
                    (openBlock(true), createElementBlock(
                      Fragment,
                      null,
                      renderList(r, (v, j) => {
                        return openBlock(), createElementBlock(
                          "td",
                          {
                            key: j,
                            class: "muted",
                            style: { "max-width": "220px", "overflow": "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }
                          },
                          toDisplayString(v),
                          1
                          /* TEXT */
                        );
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ]);
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ])
          ])) : createCommentVNode("v-if", true),
          table.value && table.value.rows.length > 200 ? (openBlock(), createElementBlock(
            "div",
            _hoisted_16,
            "… " + toDisplayString(table.value.rows.length - 200) + " weitere Zeilen in der Datei",
            1
            /* TEXT */
          )) : createCommentVNode("v-if", true),
          !table.value ? (openBlock(), createElementBlock("div", _hoisted_17, "Teilbaum wählen, dann Vorschau oder herunterladen.")) : createCommentVNode("v-if", true)
        ])
      ]);
    };
  }
};
const ExportView = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-d83b81d4"]]);
const roles = ["group", "product"];
const entry = {
  views: [
    { path: "import", topic: "import", label: "Tabelle", icon: "⊞", hint: "CSV, Excel, JSON, Zwischenablage — mit Datenmapper", component: ImportView },
    { path: "export", topic: "export", label: "Tabelle", icon: "⊞", hint: "Excel, CSV — die Form, die der Tabellenimport liest", component: ExportView }
  ],
  // Excel am Knoten (Taloan, 17.09.: Rechtsklick auf Gruppe/Produkt → Vorlage, Subitems exportieren, Excel importieren)
  nodeActions: [
    { topic: "export", roles, icon: "⇪", label: (r, below) => `Excel: Vorlage für ${below}`, run: (id) => nodeWorkbook(id, false).catch((e) => store.toast(e.message)) },
    { topic: "export", roles, icon: "⇪", label: (r, below) => `Excel: ${below} exportieren`, run: (id) => nodeWorkbook(id, true).catch((e) => store.toast(e.message)) },
    { topic: "export", roles, icon: "⊞", label: "Exportieren … (Teilbaum)", run: (id, ctx) => {
      localStorage.setItem("journali.export.root", id);
      ctx.go(`/p/table/export?node=${encodeURIComponent(id)}`);
    } },
    { topic: "import", roles, icon: "⇩", label: (r, below) => `Excel: ${below} importieren …`, run: (id, ctx) => ctx.go(`/p/table/import?node=${encodeURIComponent(id)}`) }
  ],
  tableExport
  // für andere Plugins: ctx.use('table').tableExport — build, toCsv, toJson, toJsonTree, toXlsx, download, nodeWorkbook
};
export {
  entry as default
};
