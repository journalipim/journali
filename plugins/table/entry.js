(function(){const s=document.createElement('style');s.textContent="\r\n/* Zuordnung als Zeilen: feste Mindestbreite, im schmalen Fenster nach rechts scrollen statt Felder quetschen (Taloan, 21.09.) */\n.section[data-v-53556624] { overflow-x: auto;\n}\ntable.map[data-v-53556624] { min-width: 960px;\n}\r\n/* Zuordnung als Spalten (wie Excel): erste Spalte klebt, jede Dateispalte 200 px */\n.colsWrap[data-v-53556624] { overflow-x: auto;\n}\ntable.cols[data-v-53556624] { border-collapse: separate; border-spacing: 0;\n}\ntable.cols th.stick[data-v-53556624] { position: sticky; left: 0; background: var(--pane); z-index: 1; width: 70px; min-width: 70px; border-right: 1px solid var(--line); box-shadow: 4px 0 6px -4px rgba(0,0,0,.5); text-align: left; color: var(--muted); font-weight: 600; font-size: 11px; vertical-align: top;\n}\ntable.cols td[data-v-53556624] { min-width: 200px; max-width: 200px; vertical-align: top; overflow: hidden; text-overflow: ellipsis;\n}\ntable.cols td.off[data-v-53556624] { opacity: .5;\n}\ntable.cols tr.sample td[data-v-53556624] { white-space: nowrap; font-size: 12px;\n}\n.layout button[data-v-53556624] { border: 1px solid var(--line); background: none; color: var(--muted); padding: 1px 8px; font-size: 11px; font-weight: 400;\n}\n.layout button.on[data-v-53556624] { background: var(--accent-soft); color: var(--text); border-color: var(--accent);\n}\r\n/* Umwandlung je Spalte (ƒ): Kette unter der Zeile */\n.steps-row td[data-v-53556624] { background: var(--bg); padding: 4px 8px 6px 30px;\n}\n.tsteps[data-v-53556624] { display: flex; flex-direction: column; gap: 3px;\n}\n.tstep[data-v-53556624] { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; font-size: 12px;\n}\n.tstep select[data-v-53556624], .tstep input[type=text][data-v-53556624] { font-size: 12px;\n}\n.fld[data-v-53556624] { display: inline-flex; gap: 4px; align-items: center; font-size: 11px;\n}\r\n/* ƒ leuchtet, wenn eine Umwandlung hinterlegt ist (Taloan, 21.09.) */\n.x.on[data-v-53556624] { background: var(--accent); color: #fff; font-weight: 700; border-radius: 4px; padding: 0 6px;\n}\n.section[data-v-53556624] { padding: 8px; border-bottom: 1px solid var(--line);\n}\n.section h2[data-v-53556624] { font-size: 12px; margin: 0 0 6px; font-weight: 600;\n}\n.section h2 .muted[data-v-53556624] { font-weight: 400;\n}\n.drop.over[data-v-53556624] { outline: 2px dashed var(--accent); outline-offset: -2px;\n}\r\n/* ohne Datei ein grosser Ablagebereich (Taloan, 21.09.: „höher“) */\n.drop.empty[data-v-53556624] { min-height: 84px; border: 2px dashed var(--line); border-radius: 6px; margin: 4px 0; flex-wrap: wrap;\n}\n.recent[data-v-53556624] { display: flex; gap: 4px; align-items: center; flex-wrap: wrap;\n}\n.recent .chip[data-v-53556624] { cursor: pointer;\n}\n.recent .chip.dim[data-v-53556624] { opacity: .55; cursor: default;\n}\n.btn[data-v-53556624] { display: inline-block; padding: 2px 10px; border-radius: 6px; cursor: pointer;\n}\n.map td[data-v-53556624] { vertical-align: top; padding: 3px 4px;\n}\n.map tr.off td[data-v-53556624] { opacity: .5;\n}\n.samples[data-v-53556624] { font-size: 11px; white-space: normal; max-width: 260px;\n}\n.stats[data-v-53556624] { font-size: 13px;\n}\n.out[data-v-53556624] { font-size: 11px; max-height: 400px; overflow: auto; background: var(--bg); padding: 6px; border-radius: 6px;\n}\n.picker[data-v-53556624] { max-height: 240px; overflow: auto; border: 1px solid var(--line); border-radius: 6px; background: var(--pane); margin-top: 4px;\n}\n.pick[data-v-53556624] { display: flex; align-items: center; gap: 8px; height: 24px; padding: 0 8px; white-space: nowrap; cursor: pointer;\n}\n.pick[data-v-53556624]:hover { background: var(--hover);\n}\r\n\n.form[data-v-d83b81d4] { width: 100%; border-bottom: 1px solid var(--line);\n}\n.form td[data-v-d83b81d4] { height: 30px; vertical-align: middle; white-space: normal; padding: 2px 4px;\n}\n.form td.attr[data-v-d83b81d4] { color: var(--muted); white-space: nowrap; padding-left: 8px;\n}\n.row[data-v-d83b81d4] { display: flex; gap: 6px; align-items: center;\n}\n.row > input[data-v-d83b81d4] { flex: 1; min-width: 0;\n}\n.tab[data-v-d83b81d4] { padding: 2px 10px; border-radius: 4px; color: var(--muted); text-decoration: none; font-size: 13px;\n}\n.tab.on[data-v-d83b81d4], .tab.router-link-active[data-v-d83b81d4] { background: var(--accent-soft); color: var(--text);\n}\r\n";document.head.append(s)})();
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
const onUnmounted = m$1.onUnmounted;
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
const transform = h.transform;
const recentFiles = h.recentFiles;
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
const _hoisted_3$1 = ["title"];
const _hoisted_4$1 = { class: "muted" };
const _hoisted_5$1 = ["title"];
const _hoisted_6$1 = ["value"];
const _hoisted_7$1 = ["value"];
const _hoisted_8$1 = {
  key: 3,
  class: "muted",
  style: { "font-size": "12px" }
};
const _hoisted_9$1 = {
  key: 4,
  class: "recent",
  title: "zuletzt gewählt — Klick öffnet wieder (Chrome/Edge fragt einmal nach Leserecht)"
};
const _hoisted_10$1 = ["title", "onClick"];
const _hoisted_11$1 = ["onClick"];
const _hoisted_12$1 = { class: "step" };
const _hoisted_13$1 = { colspan: "2" };
const _hoisted_14$1 = {
  class: "muted",
  style: { "font-weight": "400" }
};
const _hoisted_15$1 = { key: 0 };
const _hoisted_16$1 = { class: "row" };
const _hoisted_17$1 = { class: "muted" };
const _hoisted_18 = { key: 1 };
const _hoisted_19 = {
  class: "row",
  style: { "margin-bottom": "4px" }
};
const _hoisted_20 = ["title"];
const _hoisted_21 = {
  key: 1,
  class: "muted"
};
const _hoisted_22 = { key: 2 };
const _hoisted_23 = { key: 3 };
const _hoisted_24 = { class: "scroll" };
const _hoisted_25 = {
  key: 0,
  class: "muted",
  style: { "font-size": "12px", "padding": "6px 8px" }
};
const _hoisted_26 = {
  key: 1,
  class: "warn",
  style: { "font-size": "12px", "padding": "6px 8px" }
};
const _hoisted_27 = {
  key: 2,
  class: "section"
};
const _hoisted_28 = {
  class: "step-band",
  style: { "margin": "0 -8px 6px" }
};
const _hoisted_29 = { class: "muted" };
const _hoisted_30 = { class: "layout" };
const _hoisted_31 = {
  key: 0,
  class: "colsWrap"
};
const _hoisted_32 = { class: "grid cols" };
const _hoisted_33 = ["title"];
const _hoisted_34 = {
  class: "muted",
  style: { "font-size": "11px" }
};
const _hoisted_35 = ["onUpdate:modelValue", "onChange"];
const _hoisted_36 = ["value"];
const _hoisted_37 = ["onUpdate:modelValue", "onChange"];
const _hoisted_38 = ["value"];
const _hoisted_39 = {
  key: 1,
  style: { "display": "flex", "flex-direction": "column", "gap": "3px" }
};
const _hoisted_40 = ["onUpdate:modelValue"];
const _hoisted_41 = ["onUpdate:modelValue"];
const _hoisted_42 = ["value"];
const _hoisted_43 = ["onUpdate:modelValue"];
const _hoisted_44 = ["value"];
const _hoisted_45 = {
  key: 2,
  class: "muted"
};
const _hoisted_46 = ["onUpdate:modelValue"];
const _hoisted_47 = ["value"];
const _hoisted_48 = {
  key: 1,
  class: "muted"
};
const _hoisted_49 = ["title", "onClick"];
const _hoisted_50 = {
  key: 0,
  class: "muted",
  style: { "font-size": "11px", "margin-left": "4px" }
};
const _hoisted_51 = { class: "stick muted" };
const _hoisted_52 = ["title"];
const _hoisted_53 = {
  key: 1,
  class: "tsteps",
  style: { "margin-top": "6px", "padding": "6px 8px", "background": "var(--bg)", "border-radius": "6px" }
};
const _hoisted_54 = {
  class: "muted",
  style: { "font-size": "12px" }
};
const _hoisted_55 = {
  class: "muted mono",
  style: { "width": "18px" }
};
const _hoisted_56 = ["onUpdate:modelValue", "title"];
const _hoisted_57 = ["value"];
const _hoisted_58 = {
  key: 0,
  title: "als regulärer Ausdruck (Flags gi)"
};
const _hoisted_59 = ["onUpdate:modelValue"];
const _hoisted_60 = {
  key: 1,
  class: "fld"
};
const _hoisted_61 = ["onUpdate:modelValue"];
const _hoisted_62 = {
  key: 2,
  class: "fld"
};
const _hoisted_63 = ["onUpdate:modelValue"];
const _hoisted_64 = {
  key: 3,
  class: "fld"
};
const _hoisted_65 = ["onUpdate:modelValue"];
const _hoisted_66 = {
  key: 4,
  class: "fld"
};
const _hoisted_67 = { class: "muted" };
const _hoisted_68 = ["onUpdate:modelValue", "placeholder", "title"];
const _hoisted_69 = ["onChange"];
const _hoisted_70 = ["value"];
const _hoisted_71 = ["onClick"];
const _hoisted_72 = ["onClick"];
const _hoisted_73 = ["onClick"];
const _hoisted_74 = { class: "tstep" };
const _hoisted_75 = ["onChange"];
const _hoisted_76 = ["value", "title"];
const _hoisted_77 = {
  class: "muted",
  style: { "font-size": "11px" }
};
const _hoisted_78 = {
  key: 2,
  class: "grid map"
};
const _hoisted_79 = ["title"];
const _hoisted_80 = {
  class: "muted",
  style: { "font-size": "11px" }
};
const _hoisted_81 = { class: "muted samples" };
const _hoisted_82 = ["onUpdate:modelValue", "onChange"];
const _hoisted_83 = ["value"];
const _hoisted_84 = ["onUpdate:modelValue", "onChange"];
const _hoisted_85 = ["value"];
const _hoisted_86 = {
  key: 1,
  style: { "display": "flex", "gap": "4px", "flex-wrap": "wrap" }
};
const _hoisted_87 = ["onUpdate:modelValue"];
const _hoisted_88 = ["onUpdate:modelValue"];
const _hoisted_89 = ["value"];
const _hoisted_90 = ["onUpdate:modelValue"];
const _hoisted_91 = ["value"];
const _hoisted_92 = {
  key: 2,
  class: "muted"
};
const _hoisted_93 = ["onUpdate:modelValue"];
const _hoisted_94 = ["value"];
const _hoisted_95 = {
  class: "muted",
  style: { "font-size": "11px" }
};
const _hoisted_96 = ["title", "onClick"];
const _hoisted_97 = {
  key: 0,
  class: "steps-row"
};
const _hoisted_98 = { colspan: "7" };
const _hoisted_99 = { class: "tsteps" };
const _hoisted_100 = {
  class: "muted mono",
  style: { "width": "18px" }
};
const _hoisted_101 = ["onUpdate:modelValue", "title"];
const _hoisted_102 = ["value"];
const _hoisted_103 = {
  key: 0,
  title: "als regulärer Ausdruck (Flags gi)"
};
const _hoisted_104 = ["onUpdate:modelValue"];
const _hoisted_105 = {
  key: 1,
  class: "fld"
};
const _hoisted_106 = ["onUpdate:modelValue"];
const _hoisted_107 = {
  key: 2,
  class: "fld"
};
const _hoisted_108 = ["onUpdate:modelValue"];
const _hoisted_109 = {
  key: 3,
  class: "fld"
};
const _hoisted_110 = ["onUpdate:modelValue"];
const _hoisted_111 = {
  key: 4,
  class: "fld"
};
const _hoisted_112 = { class: "muted" };
const _hoisted_113 = ["onUpdate:modelValue", "placeholder", "title"];
const _hoisted_114 = ["onChange"];
const _hoisted_115 = ["value"];
const _hoisted_116 = {
  class: "muted",
  style: { "font-size": "11px" }
};
const _hoisted_117 = ["onClick"];
const _hoisted_118 = ["onClick"];
const _hoisted_119 = ["onClick"];
const _hoisted_120 = { class: "tstep" };
const _hoisted_121 = ["onChange"];
const _hoisted_122 = ["value", "title"];
const _hoisted_123 = {
  class: "muted",
  style: { "font-size": "11px" }
};
const _hoisted_124 = {
  class: "pane",
  style: { "flex": "1" }
};
const _hoisted_125 = { class: "toolbar" };
const _hoisted_126 = ["disabled"];
const _hoisted_127 = ["disabled", "title"];
const _hoisted_128 = { class: "muted" };
const _hoisted_129 = {
  class: "scroll",
  style: { "padding": "8px" }
};
const _hoisted_130 = {
  key: 0,
  class: "stats"
};
const _hoisted_131 = { class: "pos" };
const _hoisted_132 = { class: "muted" };
const _hoisted_133 = ["title"];
const _hoisted_134 = { key: 1 };
const _hoisted_135 = { class: "warn" };
const _hoisted_136 = {
  key: 2,
  class: "neg",
  style: { "margin-top": "6px", "white-space": "pre-wrap" }
};
const _hoisted_137 = { key: 0 };
const _hoisted_138 = {
  key: 3,
  class: "warn",
  style: { "margin-top": "6px" }
};
const _hoisted_139 = {
  key: 4,
  class: "section",
  style: { "margin-top": "8px", "padding": "0" }
};
const _hoisted_140 = {
  class: "step-band",
  style: { "margin": "0 0 4px" }
};
const _hoisted_141 = { class: "muted" };
const _hoisted_142 = {
  class: "grid",
  style: { "width": "100%", "table-layout": "fixed" }
};
const _hoisted_143 = { class: "mono muted" };
const _hoisted_144 = ["title"];
const _hoisted_145 = ["title"];
const _hoisted_146 = { class: "muted" };
const _hoisted_147 = ["title"];
const _hoisted_148 = ["value", "onChange"];
const _hoisted_149 = {
  key: 1,
  class: "muted"
};
const _hoisted_150 = { style: { "margin-top": "8px" } };
const _hoisted_151 = { class: "out" };
const _hoisted_152 = {
  key: 1,
  class: "muted"
};
const _hoisted_153 = {
  key: 2,
  class: "empty"
};
const _hoisted_154 = {
  key: 3,
  class: "pos",
  style: { "margin-top": "8px" }
};
const _hoisted_155 = {
  key: 4,
  class: "section"
};
const _hoisted_156 = {
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
    const recent = ref([]);
    async function loadRecent() {
      recent.value = await recentFiles.list("table");
    }
    async function remember(name, handle) {
      await recentFiles.remember("table", name, handle);
      await loadRecent();
    }
    async function openRecent(r) {
      const f = await recentFiles.reopen(r);
      if (!f) {
        store.toast(r.handle ? `${r.name}: nicht mehr lesbar — neu wählen` : `${r.name}: war hineingezogen — bitte wieder ziehen oder wählen`);
        return;
      }
      fileHandle.value = r.handle;
      await takeFile(f);
      remember(f.name, r.handle);
    }
    async function pickFile(e) {
      if (!canPick) return;
      e.preventDefault();
      try {
        const [h2] = await window.showOpenFilePicker({ multiple: false });
        fileHandle.value = h2;
        const f = await h2.getFile();
        await takeFile(f);
        remember(f.name, h2);
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
    let profileMapping = null;
    function applyProfile() {
      if (!profileMapping) return;
      for (const m2 of mapping.value) {
        const s = profileMapping[m2.column];
        if (s) Object.assign(m2, JSON.parse(JSON.stringify(s)));
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
      applyProfile();
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
    function onPasteAnywhere(e) {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) || e.target.isContentEditable) return;
      const text = e.clipboardData?.getData("text/plain") ?? "";
      if (!text.includes("\n") && !text.includes("	")) return;
      pasteText.value = text;
      takePaste();
      e.preventDefault();
    }
    async function onDrop(e) {
      dragOver.value = false;
      const f = e.dataTransfer.files?.[0];
      if (!f) return;
      const item = e.dataTransfer.items?.[0];
      const handleP = item?.getAsFileSystemHandle ? item.getAsFileSystemHandle().catch(() => null) : Promise.resolve(null);
      let h2 = null;
      try {
        const x = await handleP;
        if (x?.kind === "file") h2 = x;
      } catch {
      }
      fileHandle.value = h2;
      await takeFile(f);
      remember(f.name, h2);
    }
    function resuggest() {
      if (source.value) {
        mapping.value = strictify(suggest(source.value.columns, source.value.rows, model.value, { external: external.value || null }));
        applyProfile();
      }
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
    const stepsOpen = ref(null);
    const layout = ref(localStorage.getItem("journali.import.layout") || "rows");
    function setLayout(l) {
      layout.value = l;
      localStorage.setItem("journali.import.layout", l);
    }
    const OPS = transform.OPS;
    const FIELDS = { replace: ["find", "with", "regex"], prefix: ["text"], suffix: ["text"], static: ["text"], default: ["text"], combine: ["columns", "sep"], split: ["sep", "index"], number: ["decimal"], boolean: ["yes"], date: ["format"], map: ["pairs", "other"], when: ["test", "value", "then", "else"] };
    const FIELD_LABEL = { find: "suche", with: "ersetze durch", text: "Text", columns: "Spalten", sep: "Trenner", index: "Teil", yes: "weitere „ja“-Wörter", pairs: "alt=neu", other: "sonst", value: "Wert", then: "dann", else: "sonst", decimal: "Dezimal", format: "Format", test: "Prüfung" };
    const opHint = (op) => OPS.find((o) => o[0] === op)?.[2] ?? "";
    const FIELD_HINT = { find: "suchen nach", with: "ersetzen durch (leer = entfernen)", text: "Text", columns: "mit Komma — {} = diese Spalte", sep: "z. B. , oder ; oder -", index: "Zahl: 0 = erster, 1 = zweiter, -1 = letzter — leer = alle mit Komma", yes: "zusätzlich zu ja, yes, true, 1, x, wahr, y, t, j — meist leer lassen", pairs: "alt=neu; alt2=neu2", other: "leer = Wert bleibt", value: "Vergleichswert", then: "{} = Quelle", else: "{} = Quelle" };
    function addColumn(step, col) {
      if (!col) return;
      const cur = String(step.columns ?? "").trim();
      step.columns = cur ? cur.replace(/,\s*$/, "") + "," + col : col;
      planned.value = null;
    }
    function addStep(m2, op) {
      if (!op) return;
      (m2.steps ??= []).push({ op });
      planned.value = null;
    }
    function delStep(m2, i) {
      m2.steps.splice(i, 1);
      if (!m2.steps.length) delete m2.steps;
      planned.value = null;
    }
    function moveStep(m2, i, d) {
      const j = i + d;
      if (j < 0 || j >= m2.steps.length) return;
      [m2.steps[i], m2.steps[j]] = [m2.steps[j], m2.steps[i]];
      planned.value = null;
    }
    const preview = (m2, i) => {
      const rows = source.value.rows.slice(0, 200).filter((r) => String(r[i] ?? "").trim() !== "").slice(0, 3);
      const cols = source.value.columns;
      return rows.map((r) => String(transform.apply(m2.steps, r[i], { get: (c) => {
        const j = cols.indexOf(c);
        return j < 0 ? "" : r[j];
      } })).slice(0, 30)).join(" · ");
    };
    const stepsText = (m2) => m2.steps?.length ? transform.describe(m2.steps) : "";
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
    const TYPE_DE = { text: "Text", html: "HTML", integer: "ganze Zahl", decimal: "Zahl", boolean: "ja/nein", date: "Datum", enum: "Listenwert" };
    function typeHint(inv) {
      const a = attrs.value.find((x) => x.key === inv.key) ?? store.model?.attributes?.find((x) => x.key === inv.key);
      return a ? `Attribut ${a.key} ist ${TYPE_DE[a.type] ?? a.type}${a.multiple ? ", mehrfach" : ""}${a.list ? " (Liste " + a.list + ")" : ""} — im Modell änderbar` : `Attribut ${inv.key}`;
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
    const profileGet = () => ({ target: target.value?.id ?? null, role: role.value, external: external.value, mapping: Object.fromEntries(mapping.value.map((m2) => [m2.column, { target: m2.target, attribute: m2.attribute, locale: m2.locale, newKey: m2.newKey, newType: m2.newType, newGroup: m2.newGroup, steps: m2.steps?.length ? m2.steps : void 0 }])) });
    function profileSet(p) {
      if (!p) {
        profileMapping = null;
        target.value = null;
        role.value = "";
        external.value = "";
        planned.value = null;
        return;
      }
      role.value = p.role ?? "";
      external.value = p.external ?? "";
      if (p.target && tree.byId.get(p.target)) pickTarget(tree.byId.get(p.target));
      profileMapping = p.mapping ?? null;
      if (source.value) applyProfile();
      planned.value = null;
    }
    onUnmounted(() => window.removeEventListener("paste", onPasteAnywhere));
    onMounted(async () => {
      window.addEventListener("paste", onPasteAnywhere);
      loadRecent();
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
                    _cache[37] || (_cache[37] = createElementVNode(
                      "td",
                      { class: "attr" },
                      "Datei",
                      -1
                      /* CACHED */
                    )),
                    createElementVNode("td", {
                      class: normalizeClass(["row drop", { over: dragOver.value, empty: !source.value }]),
                      title: source.value ? "" : "Datei hierher ziehen — oder aus Excel kopieren und hier Strg+V (erste Zeile = Spaltennamen)",
                      onDragover: _cache[2] || (_cache[2] = withModifiers(($event) => dragOver.value = true, ["prevent"])),
                      onDragleave: _cache[3] || (_cache[3] = ($event) => dragOver.value = false),
                      onDrop: withModifiers(onDrop, ["prevent"])
                    }, [
                      createElementVNode("label", {
                        class: "primary btn",
                        title: "CSV, TSV, JSON" + (unref(plugins).importers.length ? ", " + unref(plugins).importers.flatMap((i) => i.accept ?? []).join(", ") : "") + " — oder hierher ziehen",
                        onClick: pickFile
                      }, [
                        _cache[34] || (_cache[34] = createTextVNode(
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
                      ], 8, _hoisted_2$1),
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
                          _hoisted_4$1,
                          toDisplayString(source.value.rows.length),
                          1
                          /* TEXT */
                        )
                      ], 8, _hoisted_3$1)) : createCommentVNode("v-if", true),
                      source.value ? (openBlock(), createElementBlock("button", {
                        key: 1,
                        class: "x",
                        onClick: reloadFile,
                        title: fileHandle.value ? "Datei neu von der Platte lesen (zwischendurch in Excel geändert?)" : "Datei neu wählen — dieser Browser kann Dateien nicht erneut lesen"
                      }, "↻", 8, _hoisted_5$1)) : createCommentVNode("v-if", true),
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
                            }, toDisplayString(s.name) + " (" + toDisplayString(s.rows.length) + ")", 9, _hoisted_7$1);
                          }),
                          128
                          /* KEYED_FRAGMENT */
                        ))
                      ], 40, _hoisted_6$1)) : !source.value ? (openBlock(), createElementBlock("span", _hoisted_8$1, "oder hierher ziehen · oder aus Excel kopieren und Strg+V")) : createCommentVNode("v-if", true),
                      _cache[36] || (_cache[36] = createElementVNode(
                        "span",
                        { class: "grow" },
                        null,
                        -1
                        /* CACHED */
                      )),
                      recent.value.length ? (openBlock(), createElementBlock("span", _hoisted_9$1, [
                        _cache[35] || (_cache[35] = createElementVNode(
                          "span",
                          {
                            class: "muted",
                            style: { "font-size": "11px" }
                          },
                          "zuletzt:",
                          -1
                          /* CACHED */
                        )),
                        (openBlock(true), createElementBlock(
                          Fragment,
                          null,
                          renderList(recent.value, (r) => {
                            return openBlock(), createElementBlock("span", {
                              key: r.name,
                              class: normalizeClass(["chip", { dim: !r.handle }]),
                              title: r.handle ? `${r.name} — wieder öffnen` : `${r.name} — war hineingezogen, kein Zugriff: wieder ziehen`,
                              onClick: ($event) => openRecent(r)
                            }, [
                              createTextVNode(
                                toDisplayString(r.name),
                                1
                                /* TEXT */
                              ),
                              createElementVNode("button", {
                                onClick: withModifiers(($event) => unref(recentFiles).forget("table", r.name).then(loadRecent), ["stop"]),
                                title: "aus der Liste"
                              }, "×", 8, _hoisted_11$1)
                            ], 10, _hoisted_10$1);
                          }),
                          128
                          /* KEYED_FRAGMENT */
                        ))
                      ])) : createCommentVNode("v-if", true),
                      source.value ? (openBlock(), createElementBlock("button", {
                        key: 5,
                        class: "x",
                        onClick: resuggest,
                        title: "Zuordnung neu vorschlagen"
                      }, "↻")) : createCommentVNode("v-if", true)
                    ], 42, _hoisted_1$1)
                  ]),
                  createElementVNode("tr", _hoisted_12$1, [
                    createElementVNode("td", _hoisted_13$1, [
                      _cache[38] || (_cache[38] = createTextVNode(
                        "2 · Ziel ",
                        -1
                        /* CACHED */
                      )),
                      createElementVNode(
                        "span",
                        _hoisted_14$1,
                        "· " + toDisplayString(fixed.value ? "fest: die Tabelle passt 1:1 zu diesem Knoten" : "wohin neue Zeilen kommen; vorhandene werden über Id, SKU oder Kennung gefunden"),
                        1
                        /* TEXT */
                      )
                    ])
                  ]),
                  fixed.value ? (openBlock(), createElementBlock("tr", _hoisted_15$1, [
                    _cache[40] || (_cache[40] = createElementVNode(
                      "td",
                      { class: "attr" },
                      "Knoten",
                      -1
                      /* CACHED */
                    )),
                    createElementVNode("td", _hoisted_16$1, [
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
                        _hoisted_17$1,
                        "→ " + toDisplayString(roleLabel[fixed.value.childRole]) + " · " + toDisplayString(fixed.value.allowed.size) + " mögliche Spalten",
                        1
                        /* TEXT */
                      ),
                      _cache[39] || (_cache[39] = createElementVNode(
                        "span",
                        { class: "grow" },
                        null,
                        -1
                        /* CACHED */
                      )),
                      createElementVNode("button", {
                        class: "x",
                        onClick: _cache[4] || (_cache[4] = ($event) => unref(router).replace("/p/table/import")),
                        title: "Knotenmodus verlassen — frei zuordnen"
                      }, "×")
                    ])
                  ])) : createCommentVNode("v-if", true),
                  !fixed.value ? (openBlock(), createElementBlock("tr", _hoisted_18, [
                    _cache[41] || (_cache[41] = createElementVNode(
                      "td",
                      { class: "attr" },
                      "Ziel",
                      -1
                      /* CACHED */
                    )),
                    createElementVNode("td", null, [
                      createElementVNode("div", _hoisted_19, [
                        target.value ? (openBlock(), createElementBlock("span", {
                          key: 0,
                          class: "chip",
                          title: target.value.id + " — Klick: im Baum ändern",
                          style: { "cursor": "pointer" },
                          onClick: _cache[6] || (_cache[6] = ($event) => targetPick.value = !targetPick.value)
                        }, [
                          createTextVNode(
                            toDisplayString(unref(icon)(target.value.role)) + " " + toDisplayString(target.value.label) + " ",
                            1
                            /* TEXT */
                          ),
                          createElementVNode("button", {
                            onClick: _cache[5] || (_cache[5] = withModifiers(($event) => {
                              target.value = null;
                              planned.value = null;
                            }, ["stop"])),
                            title: "Ziel weg"
                          }, "×")
                        ], 8, _hoisted_20)) : (openBlock(), createElementBlock("span", _hoisted_21, "Gruppe oder Produkt — wohin neue Zeilen kommen"))
                      ]),
                      !target.value || targetPick.value ? (openBlock(), createBlock(unref(TreePicker), {
                        key: 0,
                        "model-value": target.value?.id ?? "",
                        height: 200,
                        onPick: pickTarget
                      }, null, 8, ["model-value"])) : createCommentVNode("v-if", true)
                    ])
                  ])) : createCommentVNode("v-if", true),
                  !fixed.value ? (openBlock(), createElementBlock("tr", _hoisted_22, [
                    _cache[43] || (_cache[43] = createElementVNode(
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
                          "onUpdate:modelValue": _cache[7] || (_cache[7] = ($event) => role.value = $event),
                          title: "Rolle neuer Zeilen",
                          onChange: _cache[8] || (_cache[8] = ($event) => planned.value = null),
                          style: { "width": "100%" }
                        },
                        [..._cache[42] || (_cache[42] = [
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
                  !fixed.value ? (openBlock(), createElementBlock("tr", _hoisted_23, [
                    _cache[44] || (_cache[44] = createElementVNode(
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
                          "onUpdate:modelValue": _cache[9] || (_cache[9] = ($event) => external.value = $event),
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
              createElementVNode("div", _hoisted_24, [
                !keyColumn.value && source.value ? (openBlock(), createElementBlock("div", _hoisted_25, "⚠ Keine Schlüsselspalte (Id, SKU, Kennung) — jede Zeile wird neu angelegt.")) : createCommentVNode("v-if", true),
                unknown.value ? (openBlock(), createElementBlock(
                  "div",
                  _hoisted_26,
                  "⚠ " + toDisplayString(unknown.value) + " Spalten passen nicht zu diesem Knoten und werden übergangen — Vorlage per Rechtsklick am Knoten exportieren, dann stimmen die Spalten.",
                  1
                  /* TEXT */
                )) : createCommentVNode("v-if", true),
                source.value ? (openBlock(), createElementBlock("div", _hoisted_27, [
                  createElementVNode("h2", _hoisted_28, [
                    _cache[45] || (_cache[45] = createTextVNode(
                      "3 · Zuordnung ",
                      -1
                      /* CACHED */
                    )),
                    createElementVNode(
                      "span",
                      _hoisted_29,
                      "· " + toDisplayString(mapping.value.filter((m2) => m2.target !== "skip").length) + " von " + toDisplayString(mapping.value.length) + " Spalten",
                      1
                      /* TEXT */
                    ),
                    _cache[46] || (_cache[46] = createElementVNode(
                      "span",
                      { class: "grow" },
                      null,
                      -1
                      /* CACHED */
                    )),
                    createElementVNode("span", _hoisted_30, [
                      createElementVNode(
                        "button",
                        {
                          class: normalizeClass({ on: layout.value === "rows" }),
                          onClick: _cache[10] || (_cache[10] = ($event) => setLayout("rows")),
                          title: "eine Zeile je Spalte — nach unten scrollen"
                        },
                        "≡ Zeilen",
                        2
                        /* CLASS */
                      ),
                      createElementVNode(
                        "button",
                        {
                          class: normalizeClass({ on: layout.value === "cols" }),
                          onClick: _cache[11] || (_cache[11] = ($event) => setLayout("cols")),
                          title: "wie in Excel: eine Spalte je Spalte, Zuordnung in den Kopfzeilen — nach rechts scrollen"
                        },
                        "⫼ Spalten",
                        2
                        /* CLASS */
                      )
                    ])
                  ]),
                  createCommentVNode(" Spalten wie in Excel: Kopfzeilen = Zuordnung, darunter die ersten Zeilen der Datei; erste Spalte klebt "),
                  layout.value === "cols" ? (openBlock(), createElementBlock("div", _hoisted_31, [
                    createElementVNode("table", _hoisted_32, [
                      createElementVNode("tbody", null, [
                        createElementVNode("tr", null, [
                          _cache[47] || (_cache[47] = createElementVNode(
                            "th",
                            { class: "stick" },
                            "Spalte",
                            -1
                            /* CACHED */
                          )),
                          (openBlock(true), createElementBlock(
                            Fragment,
                            null,
                            renderList(mapping.value, (m2) => {
                              return openBlock(), createElementBlock("td", {
                                key: m2.column,
                                class: normalizeClass({ off: m2.target === "skip" }),
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
                                  _hoisted_34,
                                  toDisplayString(m2.sniff?.type) + " · " + toDisplayString(m2.sniff?.distinct) + " versch.",
                                  1
                                  /* TEXT */
                                )
                              ], 10, _hoisted_33);
                            }),
                            128
                            /* KEYED_FRAGMENT */
                          ))
                        ]),
                        createElementVNode("tr", null, [
                          _cache[48] || (_cache[48] = createElementVNode(
                            "th",
                            { class: "stick" },
                            "Ziel",
                            -1
                            /* CACHED */
                          )),
                          (openBlock(true), createElementBlock(
                            Fragment,
                            null,
                            renderList(mapping.value, (m2) => {
                              return openBlock(), createElementBlock("td", {
                                key: m2.column
                              }, [
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
                                      }, toDisplayString(l), 9, _hoisted_36);
                                    }),
                                    128
                                    /* KEYED_FRAGMENT */
                                  ))
                                ], 40, _hoisted_35), [
                                  [vModelSelect, m2.target]
                                ])
                              ]);
                            }),
                            128
                            /* KEYED_FRAGMENT */
                          ))
                        ]),
                        createElementVNode("tr", null, [
                          _cache[50] || (_cache[50] = createElementVNode(
                            "th",
                            { class: "stick" },
                            "Attribut",
                            -1
                            /* CACHED */
                          )),
                          (openBlock(true), createElementBlock(
                            Fragment,
                            null,
                            renderList(mapping.value, (m2) => {
                              return openBlock(), createElementBlock("td", {
                                key: m2.column
                              }, [
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
                                      }, toDisplayString(a.label?.de || a.key) + " · " + toDisplayString(a.key), 9, _hoisted_38);
                                    }),
                                    128
                                    /* KEYED_FRAGMENT */
                                  ))
                                ], 40, _hoisted_37)), [
                                  [vModelSelect, m2.attribute]
                                ]) : m2.target === "new" ? (openBlock(), createElementBlock("span", _hoisted_39, [
                                  withDirectives(createElementVNode("input", {
                                    "onUpdate:modelValue": ($event) => m2.newKey = $event,
                                    type: "text",
                                    placeholder: "schlüssel",
                                    onChange: _cache[12] || (_cache[12] = ($event) => planned.value = null)
                                  }, null, 40, _hoisted_40), [
                                    [vModelText, m2.newKey]
                                  ]),
                                  withDirectives(createElementVNode("select", {
                                    "onUpdate:modelValue": ($event) => m2.newType = $event,
                                    onChange: _cache[13] || (_cache[13] = ($event) => planned.value = null)
                                  }, [
                                    (openBlock(), createElementBlock(
                                      Fragment,
                                      null,
                                      renderList(["text", "html", "integer", "decimal", "boolean", "date", "enum"], (t) => {
                                        return createElementVNode("option", {
                                          key: t,
                                          value: t
                                        }, toDisplayString(t), 9, _hoisted_42);
                                      }),
                                      64
                                      /* STABLE_FRAGMENT */
                                    ))
                                  ], 40, _hoisted_41), [
                                    [vModelSelect, m2.newType]
                                  ]),
                                  withDirectives(createElementVNode("select", {
                                    "onUpdate:modelValue": ($event) => m2.newGroup = $event,
                                    class: normalizeClass({ neg: !m2.newGroup }),
                                    title: "Attributgruppe — Pflicht",
                                    onChange: _cache[14] || (_cache[14] = ($event) => planned.value = null)
                                  }, [
                                    _cache[49] || (_cache[49] = createElementVNode(
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
                                        }, "▤ " + toDisplayString(g.label?.de || g.key), 9, _hoisted_44);
                                      }),
                                      128
                                      /* KEYED_FRAGMENT */
                                    ))
                                  ], 42, _hoisted_43), [
                                    [vModelSelect, m2.newGroup]
                                  ])
                                ])) : (openBlock(), createElementBlock("span", _hoisted_45, "—"))
                              ]);
                            }),
                            128
                            /* KEYED_FRAGMENT */
                          ))
                        ]),
                        createElementVNode("tr", null, [
                          _cache[52] || (_cache[52] = createElementVNode(
                            "th",
                            { class: "stick" },
                            "Sprache",
                            -1
                            /* CACHED */
                          )),
                          (openBlock(true), createElementBlock(
                            Fragment,
                            null,
                            renderList(mapping.value, (m2) => {
                              return openBlock(), createElementBlock("td", {
                                key: m2.column
                              }, [
                                m2.target === "attr" && attrs.value.find((a) => a.key === m2.attribute)?.perLocale || m2.target === "new" ? withDirectives((openBlock(), createElementBlock("select", {
                                  key: 0,
                                  "onUpdate:modelValue": ($event) => m2.locale = $event,
                                  style: { "width": "100%" },
                                  onChange: _cache[15] || (_cache[15] = ($event) => planned.value = null)
                                }, [
                                  _cache[51] || (_cache[51] = createElementVNode(
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
                                      }, toDisplayString(l), 9, _hoisted_47);
                                    }),
                                    128
                                    /* KEYED_FRAGMENT */
                                  ))
                                ], 40, _hoisted_46)), [
                                  [vModelSelect, m2.locale]
                                ]) : (openBlock(), createElementBlock("span", _hoisted_48, "—"))
                              ]);
                            }),
                            128
                            /* KEYED_FRAGMENT */
                          ))
                        ]),
                        createElementVNode("tr", null, [
                          _cache[53] || (_cache[53] = createElementVNode(
                            "th",
                            { class: "stick" },
                            "ƒ",
                            -1
                            /* CACHED */
                          )),
                          (openBlock(true), createElementBlock(
                            Fragment,
                            null,
                            renderList(mapping.value, (m2) => {
                              return openBlock(), createElementBlock("td", {
                                key: m2.column
                              }, [
                                createElementVNode("button", {
                                  class: normalizeClass(["x", { on: m2.steps?.length }]),
                                  title: m2.steps?.length ? stepsText(m2) + " — Klick: bearbeiten" : "Umwandlung hinzufügen",
                                  onClick: ($event) => stepsOpen.value = stepsOpen.value === m2.column ? null : m2.column
                                }, "ƒ" + toDisplayString(m2.steps?.length ? m2.steps.length : ""), 11, _hoisted_49),
                                m2.steps?.length ? (openBlock(), createElementBlock(
                                  "span",
                                  _hoisted_50,
                                  toDisplayString(stepsText(m2)),
                                  1
                                  /* TEXT */
                                )) : createCommentVNode("v-if", true)
                              ]);
                            }),
                            128
                            /* KEYED_FRAGMENT */
                          ))
                        ]),
                        createElementVNode("tr", null, [
                          _cache[54] || (_cache[54] = createElementVNode(
                            "th",
                            { class: "stick" },
                            "Warum",
                            -1
                            /* CACHED */
                          )),
                          (openBlock(true), createElementBlock(
                            Fragment,
                            null,
                            renderList(mapping.value, (m2) => {
                              return openBlock(), createElementBlock(
                                "td",
                                {
                                  key: m2.column,
                                  class: "muted",
                                  style: { "font-size": "11px", "white-space": "normal" }
                                },
                                toDisplayString(m2.why),
                                1
                                /* TEXT */
                              );
                            }),
                            128
                            /* KEYED_FRAGMENT */
                          ))
                        ]),
                        (openBlock(), createElementBlock(
                          Fragment,
                          null,
                          renderList(3, (r) => {
                            return createElementVNode("tr", {
                              key: r,
                              class: "sample"
                            }, [
                              createElementVNode(
                                "th",
                                _hoisted_51,
                                "Zeile " + toDisplayString(r + 1),
                                1
                                /* TEXT */
                              ),
                              (openBlock(true), createElementBlock(
                                Fragment,
                                null,
                                renderList(mapping.value, (m2, i) => {
                                  return openBlock(), createElementBlock("td", {
                                    key: m2.column,
                                    class: "muted",
                                    title: String(source.value.rows[r - 1]?.[i] ?? "")
                                  }, toDisplayString(String(source.value.rows[r - 1]?.[i] ?? "").slice(0, 40)), 9, _hoisted_52);
                                }),
                                128
                                /* KEYED_FRAGMENT */
                              ))
                            ]);
                          }),
                          64
                          /* STABLE_FRAGMENT */
                        ))
                      ])
                    ])
                  ])) : createCommentVNode("v-if", true),
                  layout.value === "cols" && stepsOpen.value && mapping.value.find((m2) => m2.column === stepsOpen.value) ? (openBlock(), createElementBlock("div", _hoisted_53, [
                    createElementVNode("div", _hoisted_54, [
                      _cache[55] || (_cache[55] = createTextVNode(
                        "ƒ Umwandlung für ",
                        -1
                        /* CACHED */
                      )),
                      createElementVNode(
                        "b",
                        null,
                        toDisplayString(stepsOpen.value),
                        1
                        /* TEXT */
                      ),
                      _cache[56] || (_cache[56] = createTextVNode()),
                      createElementVNode("button", {
                        class: "x",
                        onClick: _cache[16] || (_cache[16] = ($event) => stepsOpen.value = null)
                      }, "×")
                    ]),
                    (openBlock(true), createElementBlock(
                      Fragment,
                      null,
                      renderList([mapping.value.find((m2) => m2.column === stepsOpen.value)], (m2) => {
                        return openBlock(), createElementBlock(
                          Fragment,
                          {
                            key: m2.column
                          },
                          [
                            (openBlock(true), createElementBlock(
                              Fragment,
                              null,
                              renderList(m2.steps ?? [], (s, si) => {
                                return openBlock(), createElementBlock("div", {
                                  key: si,
                                  class: "tstep"
                                }, [
                                  createElementVNode(
                                    "span",
                                    _hoisted_55,
                                    toDisplayString(si + 1),
                                    1
                                    /* TEXT */
                                  ),
                                  withDirectives(createElementVNode("select", {
                                    "onUpdate:modelValue": ($event) => s.op = $event,
                                    onChange: _cache[17] || (_cache[17] = ($event) => planned.value = null),
                                    title: opHint(s.op)
                                  }, [
                                    (openBlock(true), createElementBlock(
                                      Fragment,
                                      null,
                                      renderList(unref(OPS), (o) => {
                                        return openBlock(), createElementBlock("option", {
                                          key: o[0],
                                          value: o[0]
                                        }, toDisplayString(o[1]), 9, _hoisted_57);
                                      }),
                                      128
                                      /* KEYED_FRAGMENT */
                                    ))
                                  ], 40, _hoisted_56), [
                                    [vModelSelect, s.op]
                                  ]),
                                  (openBlock(true), createElementBlock(
                                    Fragment,
                                    null,
                                    renderList(FIELDS[s.op] ?? [], (f) => {
                                      return openBlock(), createElementBlock(
                                        Fragment,
                                        { key: f },
                                        [
                                          f === "regex" ? (openBlock(), createElementBlock("label", _hoisted_58, [
                                            withDirectives(createElementVNode("input", {
                                              type: "checkbox",
                                              "onUpdate:modelValue": ($event) => s.regex = $event,
                                              onChange: _cache[18] || (_cache[18] = ($event) => planned.value = null)
                                            }, null, 40, _hoisted_59), [
                                              [vModelCheckbox, s.regex]
                                            ]),
                                            _cache[57] || (_cache[57] = createTextVNode(
                                              " regex",
                                              -1
                                              /* CACHED */
                                            ))
                                          ])) : f === "test" ? (openBlock(), createElementBlock("span", _hoisted_60, [
                                            _cache[59] || (_cache[59] = createElementVNode(
                                              "span",
                                              { class: "muted" },
                                              "Quelle ist",
                                              -1
                                              /* CACHED */
                                            )),
                                            withDirectives(createElementVNode("select", {
                                              "onUpdate:modelValue": ($event) => s.test = $event,
                                              onChange: _cache[19] || (_cache[19] = ($event) => planned.value = null)
                                            }, [..._cache[58] || (_cache[58] = [
                                              createElementVNode(
                                                "option",
                                                { value: "empty" },
                                                "leer",
                                                -1
                                                /* CACHED */
                                              ),
                                              createElementVNode(
                                                "option",
                                                { value: "equals" },
                                                "gleich",
                                                -1
                                                /* CACHED */
                                              ),
                                              createElementVNode(
                                                "option",
                                                { value: "contains" },
                                                "enthält",
                                                -1
                                                /* CACHED */
                                              ),
                                              createElementVNode(
                                                "option",
                                                { value: "matches" },
                                                "passt auf (regex)",
                                                -1
                                                /* CACHED */
                                              )
                                            ])], 40, _hoisted_61), [
                                              [vModelSelect, s.test]
                                            ])
                                          ])) : f === "decimal" ? (openBlock(), createElementBlock("span", _hoisted_62, [
                                            _cache[61] || (_cache[61] = createElementVNode(
                                              "span",
                                              { class: "muted" },
                                              "Dezimalzeichen",
                                              -1
                                              /* CACHED */
                                            )),
                                            withDirectives(createElementVNode("select", {
                                              "onUpdate:modelValue": ($event) => s.decimal = $event,
                                              onChange: _cache[20] || (_cache[20] = ($event) => planned.value = null)
                                            }, [..._cache[60] || (_cache[60] = [
                                              createElementVNode(
                                                "option",
                                                { value: void 0 },
                                                "raten",
                                                -1
                                                /* CACHED */
                                              ),
                                              createElementVNode(
                                                "option",
                                                { value: "," },
                                                "Komma",
                                                -1
                                                /* CACHED */
                                              ),
                                              createElementVNode(
                                                "option",
                                                { value: "." },
                                                "Punkt",
                                                -1
                                                /* CACHED */
                                              )
                                            ])], 40, _hoisted_63), [
                                              [vModelSelect, s.decimal]
                                            ])
                                          ])) : f === "format" ? (openBlock(), createElementBlock("span", _hoisted_64, [
                                            _cache[63] || (_cache[63] = createElementVNode(
                                              "span",
                                              { class: "muted" },
                                              "Quelle im Format",
                                              -1
                                              /* CACHED */
                                            )),
                                            withDirectives(createElementVNode("select", {
                                              "onUpdate:modelValue": ($event) => s.format = $event,
                                              onChange: _cache[21] || (_cache[21] = ($event) => planned.value = null)
                                            }, [..._cache[62] || (_cache[62] = [
                                              createElementVNode(
                                                "option",
                                                { value: "dd.MM.yyyy" },
                                                "dd.MM.yyyy",
                                                -1
                                                /* CACHED */
                                              ),
                                              createElementVNode(
                                                "option",
                                                { value: "MM/dd/yyyy" },
                                                "MM/dd/yyyy",
                                                -1
                                                /* CACHED */
                                              ),
                                              createElementVNode(
                                                "option",
                                                { value: "yyyyMMdd" },
                                                "yyyyMMdd",
                                                -1
                                                /* CACHED */
                                              )
                                            ])], 40, _hoisted_65), [
                                              [vModelSelect, s.format]
                                            ])
                                          ])) : (openBlock(), createElementBlock("span", _hoisted_66, [
                                            createElementVNode(
                                              "span",
                                              _hoisted_67,
                                              toDisplayString(FIELD_LABEL[f] ?? f),
                                              1
                                              /* TEXT */
                                            ),
                                            withDirectives(createElementVNode("input", {
                                              type: "text",
                                              "onUpdate:modelValue": ($event) => s[f] = $event,
                                              placeholder: FIELD_HINT[f] ?? f,
                                              title: (FIELD_HINT[f] ?? f) + " — " + opHint(s.op),
                                              onInput: _cache[22] || (_cache[22] = ($event) => planned.value = null),
                                              style: { "width": "200px" }
                                            }, null, 40, _hoisted_68), [
                                              [vModelText, s[f]]
                                            ])
                                          ])),
                                          f === "columns" ? (openBlock(), createElementBlock("select", {
                                            key: 5,
                                            value: "",
                                            title: "Spalte anklicken statt tippen — wird mit Komma angehängt",
                                            onChange: ($event) => {
                                              addColumn(s, $event.target.value);
                                              $event.target.value = "";
                                            }
                                          }, [
                                            _cache[64] || (_cache[64] = createElementVNode(
                                              "option",
                                              { value: "" },
                                              "+ Spalte …",
                                              -1
                                              /* CACHED */
                                            )),
                                            _cache[65] || (_cache[65] = createElementVNode(
                                              "option",
                                              { value: "{}" },
                                              "{} · diese Spalte",
                                              -1
                                              /* CACHED */
                                            )),
                                            (openBlock(true), createElementBlock(
                                              Fragment,
                                              null,
                                              renderList(source.value.columns, (c) => {
                                                return openBlock(), createElementBlock("option", {
                                                  key: c,
                                                  value: c
                                                }, toDisplayString(c), 9, _hoisted_70);
                                              }),
                                              128
                                              /* KEYED_FRAGMENT */
                                            ))
                                          ], 40, _hoisted_69)) : createCommentVNode("v-if", true)
                                        ],
                                        64
                                        /* STABLE_FRAGMENT */
                                      );
                                    }),
                                    128
                                    /* KEYED_FRAGMENT */
                                  )),
                                  _cache[66] || (_cache[66] = createElementVNode(
                                    "span",
                                    { class: "grow" },
                                    null,
                                    -1
                                    /* CACHED */
                                  )),
                                  createElementVNode("button", {
                                    class: "x",
                                    onClick: ($event) => moveStep(m2, si, -1)
                                  }, "↑", 8, _hoisted_71),
                                  createElementVNode("button", {
                                    class: "x",
                                    onClick: ($event) => moveStep(m2, si, 1)
                                  }, "↓", 8, _hoisted_72),
                                  createElementVNode("button", {
                                    class: "x",
                                    onClick: ($event) => delStep(m2, si)
                                  }, "×", 8, _hoisted_73)
                                ]);
                              }),
                              128
                              /* KEYED_FRAGMENT */
                            )),
                            createElementVNode("div", _hoisted_74, [
                              createElementVNode("select", {
                                value: "",
                                onChange: ($event) => {
                                  addStep(m2, $event.target.value);
                                  $event.target.value = "";
                                }
                              }, [
                                _cache[67] || (_cache[67] = createElementVNode(
                                  "option",
                                  { value: "" },
                                  "+ Schritt …",
                                  -1
                                  /* CACHED */
                                )),
                                (openBlock(true), createElementBlock(
                                  Fragment,
                                  null,
                                  renderList(unref(OPS), (o) => {
                                    return openBlock(), createElementBlock("option", {
                                      key: o[0],
                                      value: o[0],
                                      title: o[2]
                                    }, toDisplayString(o[1]), 9, _hoisted_76);
                                  }),
                                  128
                                  /* KEYED_FRAGMENT */
                                ))
                              ], 40, _hoisted_75),
                              createElementVNode(
                                "span",
                                _hoisted_77,
                                toDisplayString(m2.steps?.length ? "Vorschau: " + preview(m2, mapping.value.indexOf(m2)) : "Kette zwischen Quelle und Ziel"),
                                1
                                /* TEXT */
                              )
                            ])
                          ],
                          64
                          /* STABLE_FRAGMENT */
                        );
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ])) : createCommentVNode("v-if", true),
                  layout.value === "rows" ? (openBlock(), createElementBlock("table", _hoisted_78, [
                    _cache[81] || (_cache[81] = createElementVNode(
                      "thead",
                      null,
                      [
                        createElementVNode("tr", null, [
                          createElementVNode("th", { style: { "width": "170px" } }, "Spalte"),
                          createElementVNode("th", null, "Beispiele"),
                          createElementVNode("th", { style: { "width": "130px" } }, "Ziel"),
                          createElementVNode("th", { style: { "width": "220px" } }, "Attribut"),
                          createElementVNode("th", { style: { "width": "60px" } }, "Sprache"),
                          createElementVNode("th", { style: { "width": "150px" } }, "Warum"),
                          createElementVNode("th", {
                            style: { "width": "34px" },
                            title: "Umwandlung: Kette von Schritten zwischen Quelle und Ziel (Zahl aus „22 mm“, Ja/Nein, Datum, Ersetzen, Aufteilen, Spalten verbinden, Bedingung …)"
                          }, "ƒ")
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
                            Fragment,
                            {
                              key: m2.column
                            },
                            [
                              createElementVNode(
                                "tr",
                                {
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
                                      _hoisted_80,
                                      toDisplayString(m2.sniff?.type) + " · " + toDisplayString(m2.sniff?.distinct) + " versch.",
                                      1
                                      /* TEXT */
                                    )
                                  ], 8, _hoisted_79),
                                  createElementVNode(
                                    "td",
                                    _hoisted_81,
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
                                          }, toDisplayString(l), 9, _hoisted_83);
                                        }),
                                        128
                                        /* KEYED_FRAGMENT */
                                      ))
                                    ], 40, _hoisted_82), [
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
                                          }, toDisplayString(a.label?.de || a.key) + " · " + toDisplayString(a.key), 9, _hoisted_85);
                                        }),
                                        128
                                        /* KEYED_FRAGMENT */
                                      ))
                                    ], 40, _hoisted_84)), [
                                      [vModelSelect, m2.attribute]
                                    ]) : m2.target === "new" ? (openBlock(), createElementBlock("span", _hoisted_86, [
                                      withDirectives(createElementVNode("input", {
                                        "onUpdate:modelValue": ($event) => m2.newKey = $event,
                                        type: "text",
                                        style: { "flex": "1", "min-width": "90px" },
                                        placeholder: "schlüssel",
                                        onChange: _cache[23] || (_cache[23] = ($event) => planned.value = null)
                                      }, null, 40, _hoisted_87), [
                                        [vModelText, m2.newKey]
                                      ]),
                                      withDirectives(createElementVNode("select", {
                                        "onUpdate:modelValue": ($event) => m2.newType = $event,
                                        style: { "width": "84px" },
                                        onChange: _cache[24] || (_cache[24] = ($event) => planned.value = null)
                                      }, [
                                        (openBlock(), createElementBlock(
                                          Fragment,
                                          null,
                                          renderList(["text", "html", "integer", "decimal", "boolean", "date"], (t) => {
                                            return createElementVNode("option", {
                                              key: t,
                                              value: t
                                            }, toDisplayString(t), 9, _hoisted_89);
                                          }),
                                          64
                                          /* STABLE_FRAGMENT */
                                        ))
                                      ], 40, _hoisted_88), [
                                        [vModelSelect, m2.newType]
                                      ]),
                                      withDirectives(createElementVNode("select", {
                                        "onUpdate:modelValue": ($event) => m2.newGroup = $event,
                                        style: { "width": "100%" },
                                        class: normalizeClass({ neg: !m2.newGroup }),
                                        title: "Attributgruppe — Pflicht: ohne Gruppe gilt das Attribut nirgends",
                                        onChange: _cache[25] || (_cache[25] = ($event) => planned.value = null)
                                      }, [
                                        _cache[68] || (_cache[68] = createElementVNode(
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
                                            }, "▤ " + toDisplayString(g.label?.de || g.key), 9, _hoisted_91);
                                          }),
                                          128
                                          /* KEYED_FRAGMENT */
                                        ))
                                      ], 42, _hoisted_90), [
                                        [vModelSelect, m2.newGroup]
                                      ])
                                    ])) : (openBlock(), createElementBlock("span", _hoisted_92, "—"))
                                  ]),
                                  createElementVNode("td", null, [
                                    m2.target === "attr" && attrs.value.find((a) => a.key === m2.attribute)?.perLocale || m2.target === "new" ? withDirectives((openBlock(), createElementBlock("select", {
                                      key: 0,
                                      "onUpdate:modelValue": ($event) => m2.locale = $event,
                                      style: { "width": "100%" },
                                      onChange: _cache[26] || (_cache[26] = ($event) => planned.value = null)
                                    }, [
                                      _cache[69] || (_cache[69] = createElementVNode(
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
                                          }, toDisplayString(l), 9, _hoisted_94);
                                        }),
                                        128
                                        /* KEYED_FRAGMENT */
                                      ))
                                    ], 40, _hoisted_93)), [
                                      [vModelSelect, m2.locale]
                                    ]) : createCommentVNode("v-if", true)
                                  ]),
                                  createElementVNode(
                                    "td",
                                    _hoisted_95,
                                    toDisplayString(m2.why),
                                    1
                                    /* TEXT */
                                  ),
                                  createElementVNode("td", null, [
                                    createElementVNode("button", {
                                      class: normalizeClass(["x", { on: m2.steps?.length }]),
                                      title: m2.steps?.length ? stepsText(m2) + " — Klick: bearbeiten" : "Umwandlung hinzufügen",
                                      onClick: ($event) => stepsOpen.value = stepsOpen.value === m2.column ? null : m2.column
                                    }, "ƒ" + toDisplayString(m2.steps?.length ? m2.steps.length : ""), 11, _hoisted_96)
                                  ])
                                ],
                                2
                                /* CLASS */
                              ),
                              stepsOpen.value === m2.column ? (openBlock(), createElementBlock("tr", _hoisted_97, [
                                createElementVNode("td", _hoisted_98, [
                                  createElementVNode("div", _hoisted_99, [
                                    (openBlock(true), createElementBlock(
                                      Fragment,
                                      null,
                                      renderList(m2.steps ?? [], (s, si) => {
                                        return openBlock(), createElementBlock("div", {
                                          key: si,
                                          class: "tstep"
                                        }, [
                                          createElementVNode(
                                            "span",
                                            _hoisted_100,
                                            toDisplayString(si + 1),
                                            1
                                            /* TEXT */
                                          ),
                                          withDirectives(createElementVNode("select", {
                                            "onUpdate:modelValue": ($event) => s.op = $event,
                                            onChange: _cache[27] || (_cache[27] = ($event) => planned.value = null),
                                            title: opHint(s.op)
                                          }, [
                                            (openBlock(true), createElementBlock(
                                              Fragment,
                                              null,
                                              renderList(unref(OPS), (o) => {
                                                return openBlock(), createElementBlock("option", {
                                                  key: o[0],
                                                  value: o[0]
                                                }, toDisplayString(o[1]), 9, _hoisted_102);
                                              }),
                                              128
                                              /* KEYED_FRAGMENT */
                                            ))
                                          ], 40, _hoisted_101), [
                                            [vModelSelect, s.op]
                                          ]),
                                          (openBlock(true), createElementBlock(
                                            Fragment,
                                            null,
                                            renderList(FIELDS[s.op] ?? [], (f) => {
                                              return openBlock(), createElementBlock(
                                                Fragment,
                                                { key: f },
                                                [
                                                  f === "regex" ? (openBlock(), createElementBlock("label", _hoisted_103, [
                                                    withDirectives(createElementVNode("input", {
                                                      type: "checkbox",
                                                      "onUpdate:modelValue": ($event) => s.regex = $event,
                                                      onChange: _cache[28] || (_cache[28] = ($event) => planned.value = null)
                                                    }, null, 40, _hoisted_104), [
                                                      [vModelCheckbox, s.regex]
                                                    ]),
                                                    _cache[70] || (_cache[70] = createTextVNode(
                                                      " regex",
                                                      -1
                                                      /* CACHED */
                                                    ))
                                                  ])) : f === "test" ? (openBlock(), createElementBlock("span", _hoisted_105, [
                                                    _cache[72] || (_cache[72] = createElementVNode(
                                                      "span",
                                                      { class: "muted" },
                                                      "Quelle ist",
                                                      -1
                                                      /* CACHED */
                                                    )),
                                                    withDirectives(createElementVNode("select", {
                                                      "onUpdate:modelValue": ($event) => s.test = $event,
                                                      onChange: _cache[29] || (_cache[29] = ($event) => planned.value = null)
                                                    }, [..._cache[71] || (_cache[71] = [
                                                      createElementVNode(
                                                        "option",
                                                        { value: "empty" },
                                                        "leer",
                                                        -1
                                                        /* CACHED */
                                                      ),
                                                      createElementVNode(
                                                        "option",
                                                        { value: "equals" },
                                                        "gleich",
                                                        -1
                                                        /* CACHED */
                                                      ),
                                                      createElementVNode(
                                                        "option",
                                                        { value: "contains" },
                                                        "enthält",
                                                        -1
                                                        /* CACHED */
                                                      ),
                                                      createElementVNode(
                                                        "option",
                                                        { value: "matches" },
                                                        "passt auf (regex)",
                                                        -1
                                                        /* CACHED */
                                                      )
                                                    ])], 40, _hoisted_106), [
                                                      [vModelSelect, s.test]
                                                    ])
                                                  ])) : f === "decimal" ? (openBlock(), createElementBlock("span", _hoisted_107, [
                                                    _cache[74] || (_cache[74] = createElementVNode(
                                                      "span",
                                                      { class: "muted" },
                                                      "Dezimalzeichen",
                                                      -1
                                                      /* CACHED */
                                                    )),
                                                    withDirectives(createElementVNode("select", {
                                                      "onUpdate:modelValue": ($event) => s.decimal = $event,
                                                      onChange: _cache[30] || (_cache[30] = ($event) => planned.value = null)
                                                    }, [..._cache[73] || (_cache[73] = [
                                                      createElementVNode(
                                                        "option",
                                                        { value: void 0 },
                                                        "raten",
                                                        -1
                                                        /* CACHED */
                                                      ),
                                                      createElementVNode(
                                                        "option",
                                                        { value: "," },
                                                        "Komma",
                                                        -1
                                                        /* CACHED */
                                                      ),
                                                      createElementVNode(
                                                        "option",
                                                        { value: "." },
                                                        "Punkt",
                                                        -1
                                                        /* CACHED */
                                                      )
                                                    ])], 40, _hoisted_108), [
                                                      [vModelSelect, s.decimal]
                                                    ])
                                                  ])) : f === "format" ? (openBlock(), createElementBlock("span", _hoisted_109, [
                                                    _cache[76] || (_cache[76] = createElementVNode(
                                                      "span",
                                                      { class: "muted" },
                                                      "Quelle im Format",
                                                      -1
                                                      /* CACHED */
                                                    )),
                                                    withDirectives(createElementVNode("select", {
                                                      "onUpdate:modelValue": ($event) => s.format = $event,
                                                      onChange: _cache[31] || (_cache[31] = ($event) => planned.value = null)
                                                    }, [..._cache[75] || (_cache[75] = [
                                                      createElementVNode(
                                                        "option",
                                                        { value: "dd.MM.yyyy" },
                                                        "dd.MM.yyyy",
                                                        -1
                                                        /* CACHED */
                                                      ),
                                                      createElementVNode(
                                                        "option",
                                                        { value: "MM/dd/yyyy" },
                                                        "MM/dd/yyyy",
                                                        -1
                                                        /* CACHED */
                                                      ),
                                                      createElementVNode(
                                                        "option",
                                                        { value: "yyyyMMdd" },
                                                        "yyyyMMdd",
                                                        -1
                                                        /* CACHED */
                                                      )
                                                    ])], 40, _hoisted_110), [
                                                      [vModelSelect, s.format]
                                                    ])
                                                  ])) : (openBlock(), createElementBlock("span", _hoisted_111, [
                                                    createElementVNode(
                                                      "span",
                                                      _hoisted_112,
                                                      toDisplayString(FIELD_LABEL[f] ?? f),
                                                      1
                                                      /* TEXT */
                                                    ),
                                                    withDirectives(createElementVNode("input", {
                                                      type: "text",
                                                      "onUpdate:modelValue": ($event) => s[f] = $event,
                                                      placeholder: FIELD_HINT[f] ?? f,
                                                      title: (FIELD_HINT[f] ?? f) + " — " + opHint(s.op),
                                                      onInput: _cache[32] || (_cache[32] = ($event) => planned.value = null),
                                                      style: normalizeStyle(f === "pairs" || f === "columns" || f === "index" || f === "then" || f === "else" || f === "yes" ? "width:250px" : "width:130px")
                                                    }, null, 44, _hoisted_113), [
                                                      [vModelText, s[f]]
                                                    ])
                                                  ])),
                                                  f === "columns" ? (openBlock(), createElementBlock("select", {
                                                    key: 5,
                                                    value: "",
                                                    title: "Spalte anklicken statt tippen (Taloan, 21.09.) — wird mit Komma angehängt",
                                                    onChange: ($event) => {
                                                      addColumn(s, $event.target.value);
                                                      $event.target.value = "";
                                                    }
                                                  }, [
                                                    _cache[77] || (_cache[77] = createElementVNode(
                                                      "option",
                                                      { value: "" },
                                                      "+ Spalte …",
                                                      -1
                                                      /* CACHED */
                                                    )),
                                                    _cache[78] || (_cache[78] = createElementVNode(
                                                      "option",
                                                      { value: "{}" },
                                                      "{} · diese Spalte",
                                                      -1
                                                      /* CACHED */
                                                    )),
                                                    (openBlock(true), createElementBlock(
                                                      Fragment,
                                                      null,
                                                      renderList(source.value.columns, (c) => {
                                                        return openBlock(), createElementBlock("option", {
                                                          key: c,
                                                          value: c
                                                        }, toDisplayString(c), 9, _hoisted_115);
                                                      }),
                                                      128
                                                      /* KEYED_FRAGMENT */
                                                    ))
                                                  ], 40, _hoisted_114)) : createCommentVNode("v-if", true)
                                                ],
                                                64
                                                /* STABLE_FRAGMENT */
                                              );
                                            }),
                                            128
                                            /* KEYED_FRAGMENT */
                                          )),
                                          createElementVNode(
                                            "span",
                                            _hoisted_116,
                                            toDisplayString(opHint(s.op)),
                                            1
                                            /* TEXT */
                                          ),
                                          _cache[79] || (_cache[79] = createElementVNode(
                                            "span",
                                            { class: "grow" },
                                            null,
                                            -1
                                            /* CACHED */
                                          )),
                                          createElementVNode("button", {
                                            class: "x",
                                            onClick: ($event) => moveStep(m2, si, -1),
                                            title: "nach oben"
                                          }, "↑", 8, _hoisted_117),
                                          createElementVNode("button", {
                                            class: "x",
                                            onClick: ($event) => moveStep(m2, si, 1),
                                            title: "nach unten"
                                          }, "↓", 8, _hoisted_118),
                                          createElementVNode("button", {
                                            class: "x",
                                            onClick: ($event) => delStep(m2, si),
                                            title: "Schritt entfernen"
                                          }, "×", 8, _hoisted_119)
                                        ]);
                                      }),
                                      128
                                      /* KEYED_FRAGMENT */
                                    )),
                                    createElementVNode("div", _hoisted_120, [
                                      createElementVNode("select", {
                                        value: "",
                                        onChange: ($event) => {
                                          addStep(m2, $event.target.value);
                                          $event.target.value = "";
                                        }
                                      }, [
                                        _cache[80] || (_cache[80] = createElementVNode(
                                          "option",
                                          { value: "" },
                                          "+ Schritt …",
                                          -1
                                          /* CACHED */
                                        )),
                                        (openBlock(true), createElementBlock(
                                          Fragment,
                                          null,
                                          renderList(unref(OPS), (o) => {
                                            return openBlock(), createElementBlock("option", {
                                              key: o[0],
                                              value: o[0],
                                              title: o[2]
                                            }, toDisplayString(o[1]), 9, _hoisted_122);
                                          }),
                                          128
                                          /* KEYED_FRAGMENT */
                                        ))
                                      ], 40, _hoisted_121),
                                      createElementVNode(
                                        "span",
                                        _hoisted_123,
                                        toDisplayString(m2.steps?.length ? "Vorschau: " + preview(m2, i) : "Kette zwischen Quelle und Ziel — die Prüfung des Attributs läuft danach; steht im Profil"),
                                        1
                                        /* TEXT */
                                      )
                                    ])
                                  ])
                                ])
                              ])) : createCommentVNode("v-if", true)
                            ],
                            64
                            /* STABLE_FRAGMENT */
                          );
                        }),
                        128
                        /* KEYED_FRAGMENT */
                      ))
                    ])
                  ])) : createCommentVNode("v-if", true)
                ])) : createCommentVNode("v-if", true)
              ])
            ],
            4
            /* STYLE */
          ),
          createVNode(unref(Splitter), {
            modelValue: unref(leftW),
            "onUpdate:modelValue": _cache[33] || (_cache[33] = ($event) => isRef(leftW) ? leftW.value = $event : null),
            min: 480,
            max: 1400
          }, null, 8, ["modelValue"]),
          createElementVNode("div", _hoisted_124, [
            createElementVNode("div", _hoisted_125, [
              _cache[82] || (_cache[82] = createElementVNode(
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
              }, "analysieren", 8, _hoisted_126),
              createElementVNode("button", {
                class: "primary",
                disabled: !planned.value || !!busy.value || !planned.value.commands.length || blockers.value.length > 0 || planned.value.stale,
                onClick: run,
                title: !planned.value ? "erst analysieren" : blockers.value[0] ?? (planned.value.stale ? "erst erneut analysieren" : `${planned.value.commands.length} Befehle schreiben`)
              }, "▶ schreiben", 8, _hoisted_127),
              _cache[83] || (_cache[83] = createElementVNode(
                "span",
                { class: "grow" },
                null,
                -1
                /* CACHED */
              )),
              createElementVNode(
                "span",
                _hoisted_128,
                toDisplayString(unref(store).actor ? "👤 " + unref(store).actor : "👤 Name fehlt"),
                1
                /* TEXT */
              )
            ]),
            createElementVNode("div", _hoisted_129, [
              planned.value ? (openBlock(), createElementBlock("div", _hoisted_130, [
                createElementVNode(
                  "span",
                  _hoisted_131,
                  "+" + toDisplayString(planned.value.stats.create) + " neu",
                  1
                  /* TEXT */
                ),
                _cache[90] || (_cache[90] = createTextVNode(
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
                _cache[91] || (_cache[91] = createTextVNode(
                  " · ",
                  -1
                  /* CACHED */
                )),
                createElementVNode(
                  "span",
                  _hoisted_132,
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
                    _cache[84] || (_cache[84] = createTextVNode(
                      " · ",
                      -1
                      /* CACHED */
                    )),
                    createElementVNode("span", {
                      class: "pos",
                      title: Object.entries(planned.value.stats.newListValues).map(([l, v]) => l + ": " + Object.values(v).join(", ")).join(" · ")
                    }, "+" + toDisplayString(Object.values(planned.value.stats.newListValues).reduce((n, v) => n + Object.keys(v).length, 0)) + " Listenwerte", 9, _hoisted_133)
                  ],
                  64
                  /* STABLE_FRAGMENT */
                )) : createCommentVNode("v-if", true),
                planned.value.newAttributes.length ? (openBlock(), createElementBlock("span", _hoisted_134, [
                  _cache[85] || (_cache[85] = createTextVNode(
                    " · ",
                    -1
                    /* CACHED */
                  )),
                  createElementVNode(
                    "span",
                    _hoisted_135,
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
                planned.value.stats.problems.length ? (openBlock(), createElementBlock("div", _hoisted_136, [
                  createTextVNode(
                    toDisplayString(planned.value.stats.problems.slice(0, 30).join("\n")),
                    1
                    /* TEXT */
                  ),
                  planned.value.stats.problems.length > 30 ? (openBlock(), createElementBlock(
                    "span",
                    _hoisted_137,
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
                planned.value.stale ? (openBlock(), createElementBlock("div", _hoisted_138, [
                  _cache[86] || (_cache[86] = createTextVNode(
                    "✎ Zellen korrigiert — ",
                    -1
                    /* CACHED */
                  )),
                  createElementVNode("button", {
                    class: "primary",
                    onClick: analyse
                  }, "erneut analysieren")
                ])) : createCommentVNode("v-if", true),
                planned.value.stats.invalid.length ? (openBlock(), createElementBlock("div", _hoisted_139, [
                  createElementVNode("h2", _hoisted_140, [
                    _cache[87] || (_cache[87] = createTextVNode(
                      "Werte prüfen ",
                      -1
                      /* CACHED */
                    )),
                    createElementVNode(
                      "span",
                      _hoisted_141,
                      "· " + toDisplayString(planned.value.stats.invalid.length) + " Zellen" + toDisplayString(fixed.value ? " — im Knotenmodus in Excel korrigieren und neu laden" : " — hier korrigieren, dann erneut analysieren"),
                      1
                      /* TEXT */
                    )
                  ]),
                  createElementVNode("table", _hoisted_142, [
                    _cache[88] || (_cache[88] = createElementVNode(
                      "thead",
                      null,
                      [
                        createElementVNode("tr", null, [
                          createElementVNode("th", { style: { "width": "50px" } }, "Zeile"),
                          createElementVNode("th", { style: { "width": "150px" } }, "Spalte"),
                          createElementVNode("th", {
                            style: { "width": "260px" },
                            title: "warum der Wert abgelehnt wird — und was das Attribut erwartet"
                          }, "Grund"),
                          createElementVNode("th", null, "Wert"),
                          createElementVNode("th", { style: { "width": "260px" } }, "Korrektur")
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
                              _hoisted_143,
                              toDisplayString(inv.row + 2),
                              1
                              /* TEXT */
                            ),
                            createElementVNode("td", {
                              class: "mono",
                              style: { "overflow": "hidden", "text-overflow": "ellipsis" },
                              title: source.value.columns[inv.column]
                            }, toDisplayString(source.value.columns[inv.column]), 9, _hoisted_144),
                            createElementVNode("td", {
                              class: "neg",
                              style: { "white-space": "normal" },
                              title: typeHint(inv)
                            }, [
                              createTextVNode(
                                toDisplayString(inv.message),
                                1
                                /* TEXT */
                              ),
                              createElementVNode(
                                "span",
                                _hoisted_146,
                                " · " + toDisplayString(typeHint(inv)),
                                1
                                /* TEXT */
                              )
                            ], 8, _hoisted_145),
                            createElementVNode("td", {
                              class: "muted",
                              style: { "overflow": "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" },
                              title: String(inv.value ?? "")
                            }, toDisplayString(inv.value), 9, _hoisted_147),
                            createElementVNode("td", null, [
                              !fixed.value ? (openBlock(), createElementBlock("input", {
                                key: 0,
                                type: "text",
                                value: inv.value,
                                style: { "width": "100%" },
                                title: "korrigierter Wert — Enter, dann erneut analysieren",
                                onChange: ($event) => fixCell(inv, $event.target.value)
                              }, null, 40, _hoisted_148)) : (openBlock(), createElementBlock(
                                "span",
                                _hoisted_149,
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
                createElementVNode("details", _hoisted_150, [
                  _cache[89] || (_cache[89] = createElementVNode(
                    "summary",
                    { class: "muted" },
                    "Befehle (erste 200)",
                    -1
                    /* CACHED */
                  )),
                  createElementVNode(
                    "pre",
                    _hoisted_151,
                    toDisplayString(planned.value.commands.slice(0, 200).map((c) => `${c.op} ${JSON.stringify(c.args)}`).join("\n")),
                    1
                    /* TEXT */
                  )
                ])
              ])) : source.value ? (openBlock(), createElementBlock("div", _hoisted_152, "Zuordnung prüfen, Ziel wählen, dann analysieren. Nichts wird geschrieben, bevor Du „schreiben“ drückst.")) : (openBlock(), createElementBlock("div", _hoisted_153, [..._cache[92] || (_cache[92] = [
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
              result.value ? (openBlock(), createElementBlock("div", _hoisted_154, [
                createTextVNode(
                  "✓ " + toDisplayString(result.value.written) + " Einträge geschrieben · Stapel " + toDisplayString(result.value.batch) + " — ",
                  1
                  /* TEXT */
                ),
                createVNode(_component_router_link, {
                  to: { path: "/journal", query: { q: result.value.batch } }
                }, {
                  default: withCtx(() => [..._cache[93] || (_cache[93] = [
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
              log.value.length ? (openBlock(), createElementBlock("div", _hoisted_155, [
                _cache[94] || (_cache[94] = createElementVNode(
                  "h2",
                  null,
                  "Protokoll",
                  -1
                  /* CACHED */
                )),
                createElementVNode(
                  "div",
                  _hoisted_156,
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
const ImportView = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["__scopeId", "data-v-53556624"]]);
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
