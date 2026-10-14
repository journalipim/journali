(function(){const s=document.createElement('style');s.textContent="\n/* Zuordnung als Zeilen: feste Mindestbreite, im schmalen Fenster nach rechts scrollen statt Felder quetschen */\n.section[data-v-f918c26d] { overflow-x: auto;\n}\ntable.map[data-v-f918c26d] { min-width: 960px;\n}\n/* Zuordnung als Spalten (wie Excel): erste Spalte klebt, jede Dateispalte 200 px */\n.colsWrap[data-v-f918c26d] { overflow-x: auto;\n}\ntable.cols[data-v-f918c26d] { border-collapse: separate; border-spacing: 0;\n}\ntable.cols th.stick[data-v-f918c26d] { position: sticky; left: 0; background: var(--pane); z-index: 1; width: 70px; min-width: 70px; border-right: 1px solid var(--line); box-shadow: 4px 0 6px -4px rgba(0,0,0,.5); text-align: left; color: var(--muted); font-weight: 600; font-size: 11px; vertical-align: top;\n}\ntable.cols td[data-v-f918c26d] { min-width: 200px; max-width: 200px; vertical-align: top; overflow: hidden; text-overflow: ellipsis;\n}\ntable.cols td.off[data-v-f918c26d] { opacity: .5;\n}\ntable.cols tr.sample td[data-v-f918c26d] { white-space: nowrap; font-size: 12px;\n}\n.layout button[data-v-f918c26d] { border: 1px solid var(--line); background: none; color: var(--muted); padding: 1px 8px; font-size: 11px; font-weight: 400;\n}\n.layout button.on[data-v-f918c26d] { background: var(--accent-soft); color: var(--text); border-color: var(--accent);\n}\n/* Umwandlung je Spalte (ƒ): Kette unter der Zeile */\n.steps-row td[data-v-f918c26d] { background: var(--bg); padding: 4px 8px 6px 30px;\n}\n.tsteps[data-v-f918c26d] { display: flex; flex-direction: column; gap: 3px;\n}\n.tstep[data-v-f918c26d] { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; font-size: 12px;\n}\n.tstep select[data-v-f918c26d], .tstep input[type=text][data-v-f918c26d] { font-size: 12px;\n}\n.fld[data-v-f918c26d] { display: inline-flex; gap: 4px; align-items: center; font-size: 11px;\n}\n/* Vorschau: Reiter neu / geändert / unverändert; Werte alt → neu */\n/* Reiter, die wie Reiter aussehen */\n.tabs[data-v-f918c26d] { display: inline-flex; gap: 0; margin-left: 8px;\n}\n.tabs button[data-v-f918c26d] { border: 1px solid var(--line); background: var(--bg); padding: 2px 12px; font-size: 12px; font-weight: 600; cursor: pointer; border-radius: 0;\n}\n.tabs button[data-v-f918c26d]:first-child { border-radius: 6px 0 0 6px;\n}\n.tabs button[data-v-f918c26d]:last-child { border-radius: 0 6px 6px 0;\n}\n.tabs button[data-v-f918c26d]:hover { background: var(--hover);\n}\n.tabs button.on[data-v-f918c26d] { background: var(--accent); color: #fff !important; border-color: var(--accent);\n}\ntable.diff td[data-v-f918c26d] { font-size: 12px; white-space: normal;\n}\ntable.diff td.old[data-v-f918c26d] { color: var(--muted); text-decoration: line-through; max-width: 300px;\n}\ntable.diff td.new[data-v-f918c26d] { color: var(--pos); max-width: 300px;\n}      /* neuer Wert (vorher keiner) */\ntable.diff td.chg[data-v-f918c26d] { color: var(--warn); max-width: 300px;\n}      /* geänderter Wert */\n/* ƒ leuchtet, wenn eine Umwandlung hinterlegt ist */\n.x.on[data-v-f918c26d] { background: var(--accent); color: #fff; font-weight: 700; border-radius: 4px; padding: 0 6px;\n}\n.section[data-v-f918c26d] { padding: 8px; border-bottom: 1px solid var(--line);\n}\n.section h2[data-v-f918c26d] { font-size: 12px; margin: 0 0 6px; font-weight: 600;\n}\n.section h2 .muted[data-v-f918c26d] { font-weight: 400;\n}\n.drop.over[data-v-f918c26d] { outline: 2px dashed var(--accent); outline-offset: -2px;\n}\n/* ohne Datei ein grosser Ablagebereich */\n.drop.empty[data-v-f918c26d] { min-height: 84px; border: 2px dashed var(--line); border-radius: 6px; margin: 4px 0; flex-wrap: wrap;\n}\n.recent[data-v-f918c26d] { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; white-space: normal;\n}\n.recent .chip[data-v-f918c26d] { cursor: pointer;\n}\n.recent .chip.dim[data-v-f918c26d] { opacity: .55; cursor: default;\n}\n.btn[data-v-f918c26d] { display: inline-block; padding: 2px 10px; border-radius: 6px; cursor: pointer;\n}\n.map td[data-v-f918c26d] { vertical-align: top; padding: 3px 4px;\n}\n.map tr.off td[data-v-f918c26d] { opacity: .5;\n}\n.samples[data-v-f918c26d] { font-size: 11px; white-space: normal; max-width: 260px;\n}\n.stats[data-v-f918c26d] { font-size: 13px;\n}\n.out[data-v-f918c26d] { font-size: 11px; max-height: 400px; overflow: auto; background: var(--bg); padding: 6px; border-radius: 6px;\n}\n.picker[data-v-f918c26d] { max-height: 240px; overflow: auto; border: 1px solid var(--line); border-radius: 6px; background: var(--pane); margin-top: 4px;\n}\n.pick[data-v-f918c26d] { display: flex; align-items: center; gap: 8px; height: 24px; padding: 0 8px; white-space: nowrap; cursor: pointer;\n}\n.pick[data-v-f918c26d]:hover { background: var(--hover);\n}\n\n.form[data-v-3902daf0] { width: 100%; border-bottom: 1px solid var(--line);\n}\n.form td[data-v-3902daf0] { height: 30px; vertical-align: middle; white-space: normal; padding: 2px 4px;\n}\n.form td.attr[data-v-3902daf0] { color: var(--muted); white-space: nowrap; padding-left: 8px;\n}\n.row[data-v-3902daf0] { display: flex; gap: 6px; align-items: center;\n}\n.row > input[data-v-3902daf0] { flex: 1; min-width: 0;\n}\n.tab[data-v-3902daf0] { padding: 2px 10px; border-radius: 4px; color: var(--muted); text-decoration: none; font-size: 13px;\n}\n.tab.on[data-v-3902daf0], .tab.router-link-active[data-v-3902daf0] { background: var(--accent-soft); color: var(--text);\n}\n";document.head.append(s)})();
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
const relationen = h.relationen;
const transform = h.transform;
const recentFiles = h.recentFiles;
const dialog = h.dialog;
const paneWidth = h.paneWidth;
const plugins = h.plugins;
const t = h.t;
const L$1 = h.L;
const Splitter = h.Splitter;
const ImportHead = h.ImportHead;
const ProfileBar = h.ProfileBar;
const TreePicker = h.TreePicker;
const _export_sfc = (sfc, props) => {
  const target = sfc.__vccOpts || sfc;
  for (const [key, val] of props) {
    target[key] = val;
  }
  return target;
};
const _hoisted_1$2 = { key: 0 };
const _hoisted_2$2 = { class: "attr" };
const _hoisted_3$2 = ["placeholder"];
const _hoisted_4$2 = {
  class: "row",
  style: { "margin-top": "4px" }
};
const _hoisted_5$2 = ["disabled"];
const _hoisted_6$2 = {
  key: 0,
  class: "chip"
};
const _hoisted_7$2 = { class: "muted" };
const _hoisted_8$2 = { key: 1 };
const _hoisted_9$2 = { class: "attr" };
const _hoisted_10$2 = ["title"];
const _hoisted_11$2 = ["title"];
const _hoisted_12$2 = ["title"];
const _hoisted_13$2 = { class: "muted" };
const _hoisted_14$2 = ["title"];
const _hoisted_15$2 = ["value", "title"];
const _hoisted_16$2 = ["value"];
const _hoisted_17$2 = {
  key: 3,
  class: "muted",
  style: { "font-size": "12px" }
};
const _hoisted_18$2 = { key: 2 };
const _hoisted_19$2 = {
  class: "attr muted",
  style: { "font-size": "11px" }
};
const _hoisted_20$2 = ["title"];
const _hoisted_21$2 = ["title", "onClick"];
const _hoisted_22$2 = ["onClick", "title"];
const _hoisted_23$2 = { class: "step" };
const _hoisted_24$2 = { colspan: "2" };
const _hoisted_25$2 = {
  class: "muted",
  style: { "font-weight": "400" }
};
const _hoisted_26$1 = { key: 3 };
const _hoisted_27$1 = { class: "attr" };
const _hoisted_28$1 = { class: "row" };
const _hoisted_29$1 = { class: "muted" };
const _hoisted_30$1 = ["title"];
const _hoisted_31$1 = { key: 4 };
const _hoisted_32$1 = { class: "attr" };
const _hoisted_33$1 = { class: "muted" };
const _hoisted_34$1 = { key: 5 };
const _hoisted_35$1 = {
  class: "warn",
  style: { "font-size": "12px" }
};
const _hoisted_36$1 = { key: 6 };
const _hoisted_37$1 = { class: "attr" };
const _hoisted_38$1 = {
  class: "row",
  style: { "margin-bottom": "4px" }
};
const _hoisted_39 = ["title"];
const _hoisted_40 = ["title"];
const _hoisted_41 = {
  key: 1,
  class: "muted"
};
const _hoisted_42 = { key: 7 };
const _hoisted_43 = { class: "attr" };
const _hoisted_44 = ["title"];
const _hoisted_45 = { value: "" };
const _hoisted_46 = { value: "group" };
const _hoisted_47 = { value: "product" };
const _hoisted_48 = { value: "variant" };
const _hoisted_49 = { key: 8 };
const _hoisted_50 = { class: "attr" };
const _hoisted_51 = ["placeholder"];
const _hoisted_52 = { class: "scroll" };
const _hoisted_53 = {
  key: 0,
  class: "muted",
  style: { "font-size": "12px", "padding": "6px 8px" }
};
const _hoisted_54 = {
  key: 1,
  class: "warn",
  style: { "font-size": "12px", "padding": "6px 8px" }
};
const _hoisted_55 = {
  key: 2,
  class: "warn",
  style: { "font-size": "12px", "padding": "6px 8px" }
};
const _hoisted_56 = {
  key: 3,
  class: "section"
};
const _hoisted_57 = {
  class: "step-band",
  style: { "margin": "0 -8px 6px" }
};
const _hoisted_58 = { class: "muted" };
const _hoisted_59 = ["title"];
const _hoisted_60 = ["title"];
const _hoisted_61 = { class: "layout" };
const _hoisted_62 = ["title"];
const _hoisted_63 = ["title"];
const _hoisted_64 = {
  key: 0,
  class: "colsWrap"
};
const _hoisted_65 = { class: "grid cols" };
const _hoisted_66 = { class: "stick" };
const _hoisted_67 = ["title"];
const _hoisted_68 = {
  class: "muted",
  style: { "font-size": "11px" }
};
const _hoisted_69 = { class: "stick" };
const _hoisted_70 = ["onUpdate:modelValue", "onChange"];
const _hoisted_71 = ["value"];
const _hoisted_72 = { class: "stick" };
const _hoisted_73 = ["onUpdate:modelValue", "onChange"];
const _hoisted_74 = ["value"];
const _hoisted_75 = {
  key: 1,
  style: { "display": "flex", "flex-direction": "column", "gap": "3px" }
};
const _hoisted_76 = ["onUpdate:modelValue", "placeholder"];
const _hoisted_77 = ["onUpdate:modelValue"];
const _hoisted_78 = ["value"];
const _hoisted_79 = ["onUpdate:modelValue", "title"];
const _hoisted_80 = { value: void 0 };
const _hoisted_81 = ["value"];
const _hoisted_82 = {
  key: 2,
  class: "muted"
};
const _hoisted_83 = { class: "stick" };
const _hoisted_84 = ["onUpdate:modelValue"];
const _hoisted_85 = ["value"];
const _hoisted_86 = {
  key: 1,
  class: "muted"
};
const _hoisted_87 = ["title", "onClick"];
const _hoisted_88 = {
  key: 0,
  class: "muted",
  style: { "font-size": "11px", "margin-left": "4px" }
};
const _hoisted_89 = { class: "stick" };
const _hoisted_90 = { class: "stick muted" };
const _hoisted_91 = ["title"];
const _hoisted_92 = {
  key: 1,
  class: "tsteps",
  style: { "margin-top": "6px", "padding": "6px 8px", "background": "var(--bg)", "border-radius": "6px" }
};
const _hoisted_93 = {
  class: "muted",
  style: { "font-size": "12px" }
};
const _hoisted_94 = {
  key: 0,
  class: "tstep",
  style: { "flex-wrap": "wrap", "gap": "4px 14px" }
};
const _hoisted_95 = {
  class: "muted",
  style: { "font-size": "12px", "width": "100%" }
};
const _hoisted_96 = { key: 0 };
const _hoisted_97 = ["value", "onChange"];
const _hoisted_98 = ["value"];
const _hoisted_99 = {
  class: "muted mono",
  style: { "width": "18px" }
};
const _hoisted_100 = ["onUpdate:modelValue", "title"];
const _hoisted_101 = ["value"];
const _hoisted_102 = ["title"];
const _hoisted_103 = ["onUpdate:modelValue"];
const _hoisted_104 = {
  key: 1,
  class: "fld"
};
const _hoisted_105 = { class: "muted" };
const _hoisted_106 = ["onUpdate:modelValue"];
const _hoisted_107 = { value: "empty" };
const _hoisted_108 = { value: "equals" };
const _hoisted_109 = { value: "contains" };
const _hoisted_110 = { value: "matches" };
const _hoisted_111 = {
  key: 2,
  class: "fld"
};
const _hoisted_112 = { class: "muted" };
const _hoisted_113 = ["onUpdate:modelValue"];
const _hoisted_114 = { value: void 0 };
const _hoisted_115 = { value: "," };
const _hoisted_116 = { value: "." };
const _hoisted_117 = {
  key: 3,
  class: "fld"
};
const _hoisted_118 = { class: "muted" };
const _hoisted_119 = ["onUpdate:modelValue"];
const _hoisted_120 = ["value"];
const _hoisted_121 = {
  key: 4,
  class: "fld"
};
const _hoisted_122 = { class: "muted" };
const _hoisted_123 = ["onUpdate:modelValue", "placeholder", "title"];
const _hoisted_124 = ["title", "onChange"];
const _hoisted_125 = { value: "" };
const _hoisted_126 = { value: "{}" };
const _hoisted_127 = ["value"];
const _hoisted_128 = ["onClick"];
const _hoisted_129 = ["onClick"];
const _hoisted_130 = ["onClick"];
const _hoisted_131 = { class: "tstep" };
const _hoisted_132 = ["onChange"];
const _hoisted_133 = { value: "" };
const _hoisted_134 = ["value", "title"];
const _hoisted_135 = {
  class: "muted",
  style: { "font-size": "11px" }
};
const _hoisted_136 = {
  key: 2,
  class: "grid map"
};
const _hoisted_137 = { style: { "width": "170px" } };
const _hoisted_138 = { style: { "width": "130px" } };
const _hoisted_139 = { style: { "width": "220px" } };
const _hoisted_140 = { style: { "width": "60px" } };
const _hoisted_141 = { style: { "width": "150px" } };
const _hoisted_142 = ["title"];
const _hoisted_143 = ["title"];
const _hoisted_144 = {
  class: "muted",
  style: { "font-size": "11px" }
};
const _hoisted_145 = { class: "muted samples" };
const _hoisted_146 = ["onUpdate:modelValue", "onChange"];
const _hoisted_147 = ["value"];
const _hoisted_148 = ["onUpdate:modelValue", "onChange"];
const _hoisted_149 = ["value"];
const _hoisted_150 = {
  key: 1,
  style: { "display": "flex", "gap": "4px", "flex-wrap": "wrap" }
};
const _hoisted_151 = ["onUpdate:modelValue", "placeholder"];
const _hoisted_152 = ["onUpdate:modelValue"];
const _hoisted_153 = ["value"];
const _hoisted_154 = ["onUpdate:modelValue", "title"];
const _hoisted_155 = { value: void 0 };
const _hoisted_156 = ["value"];
const _hoisted_157 = {
  key: 2,
  class: "muted"
};
const _hoisted_158 = ["onUpdate:modelValue"];
const _hoisted_159 = ["value"];
const _hoisted_160 = {
  class: "muted",
  style: { "font-size": "11px" }
};
const _hoisted_161 = ["title", "onClick"];
const _hoisted_162 = {
  key: 0,
  class: "steps-row"
};
const _hoisted_163 = { colspan: "7" };
const _hoisted_164 = { class: "tsteps" };
const _hoisted_165 = {
  key: 0,
  class: "tstep",
  style: { "flex-wrap": "wrap", "gap": "4px 14px" }
};
const _hoisted_166 = {
  class: "muted",
  style: { "font-size": "12px", "width": "100%" }
};
const _hoisted_167 = { key: 0 };
const _hoisted_168 = ["value", "onChange"];
const _hoisted_169 = ["value"];
const _hoisted_170 = {
  class: "muted mono",
  style: { "width": "18px" }
};
const _hoisted_171 = ["onUpdate:modelValue", "title"];
const _hoisted_172 = ["value"];
const _hoisted_173 = ["title"];
const _hoisted_174 = ["onUpdate:modelValue"];
const _hoisted_175 = {
  key: 1,
  class: "fld"
};
const _hoisted_176 = { class: "muted" };
const _hoisted_177 = ["onUpdate:modelValue"];
const _hoisted_178 = { value: "empty" };
const _hoisted_179 = { value: "equals" };
const _hoisted_180 = { value: "contains" };
const _hoisted_181 = { value: "matches" };
const _hoisted_182 = {
  key: 2,
  class: "fld"
};
const _hoisted_183 = { class: "muted" };
const _hoisted_184 = ["onUpdate:modelValue"];
const _hoisted_185 = { value: void 0 };
const _hoisted_186 = { value: "," };
const _hoisted_187 = { value: "." };
const _hoisted_188 = {
  key: 3,
  class: "fld"
};
const _hoisted_189 = { class: "muted" };
const _hoisted_190 = ["onUpdate:modelValue"];
const _hoisted_191 = ["value"];
const _hoisted_192 = {
  key: 4,
  class: "fld"
};
const _hoisted_193 = { class: "muted" };
const _hoisted_194 = ["onUpdate:modelValue", "placeholder", "title"];
const _hoisted_195 = ["title", "onChange"];
const _hoisted_196 = { value: "" };
const _hoisted_197 = { value: "{}" };
const _hoisted_198 = ["value"];
const _hoisted_199 = {
  class: "muted",
  style: { "font-size": "11px" }
};
const _hoisted_200 = ["onClick", "title"];
const _hoisted_201 = ["onClick", "title"];
const _hoisted_202 = ["onClick", "title"];
const _hoisted_203 = { class: "tstep" };
const _hoisted_204 = ["onChange"];
const _hoisted_205 = { value: "" };
const _hoisted_206 = ["value", "title"];
const _hoisted_207 = {
  class: "muted",
  style: { "font-size": "11px" }
};
const _hoisted_208 = {
  class: "pane",
  style: { "flex": "1" }
};
const _hoisted_209 = { class: "toolbar" };
const _hoisted_210 = ["disabled"];
const _hoisted_211 = ["disabled", "title"];
const _hoisted_212 = { class: "muted" };
const _hoisted_213 = {
  class: "scroll",
  style: { "padding": "8px" }
};
const _hoisted_214 = {
  key: 0,
  class: "stats"
};
const _hoisted_215 = { class: "muted" };
const _hoisted_216 = ["title"];
const _hoisted_217 = ["title"];
const _hoisted_218 = { key: 2 };
const _hoisted_219 = { class: "warn" };
const _hoisted_220 = {
  key: 3,
  class: "muted",
  style: { "margin-top": "6px", "white-space": "pre-wrap", "font-size": "12px" }
};
const _hoisted_221 = {
  key: 4,
  class: "neg",
  style: { "margin-top": "6px", "white-space": "pre-wrap" }
};
const _hoisted_222 = { key: 0 };
const _hoisted_223 = {
  key: 5,
  class: "warn",
  style: { "margin-top": "6px" }
};
const _hoisted_224 = {
  key: 6,
  class: "section",
  style: { "margin-top": "8px", "padding": "0" }
};
const _hoisted_225 = {
  class: "step-band",
  style: { "margin": "0 0 4px" }
};
const _hoisted_226 = { class: "muted" };
const _hoisted_227 = {
  class: "grid",
  style: { "width": "100%", "table-layout": "fixed" }
};
const _hoisted_228 = { style: { "width": "50px" } };
const _hoisted_229 = { style: { "width": "150px" } };
const _hoisted_230 = ["title"];
const _hoisted_231 = { style: { "width": "260px" } };
const _hoisted_232 = { class: "mono muted" };
const _hoisted_233 = ["title"];
const _hoisted_234 = ["title"];
const _hoisted_235 = { class: "muted" };
const _hoisted_236 = ["title"];
const _hoisted_237 = ["value", "title", "onChange"];
const _hoisted_238 = {
  key: 1,
  class: "muted"
};
const _hoisted_239 = {
  key: 7,
  class: "section",
  style: { "margin-top": "8px", "padding": "0" }
};
const _hoisted_240 = {
  class: "step-band",
  style: { "margin": "0 0 4px", "gap": "4px" }
};
const _hoisted_241 = { class: "tabs" };
const _hoisted_242 = {
  class: "grid",
  style: { "width": "100%" }
};
const _hoisted_243 = ["onClick"];
const _hoisted_244 = {
  style: { "width": "20px" },
  class: "muted"
};
const _hoisted_245 = {
  class: "mono muted",
  style: { "width": "50px" }
};
const _hoisted_246 = { key: 0 };
const _hoisted_247 = ["href", "title"];
const _hoisted_248 = { key: 1 };
const _hoisted_249 = {
  class: "muted",
  style: { "text-align": "right", "white-space": "nowrap" }
};
const _hoisted_250 = { key: 0 };
const _hoisted_251 = { colspan: "3" };
const _hoisted_252 = { class: "grid diff" };
const _hoisted_253 = { class: "attr muted" };
const _hoisted_254 = {
  key: 0,
  class: "muted"
};
const _hoisted_255 = ["title"];
const _hoisted_256 = {
  class: "muted",
  style: { "width": "20px" }
};
const _hoisted_257 = ["title"];
const _hoisted_258 = { key: 0 };
const _hoisted_259 = {
  colspan: "4",
  class: "muted",
  style: { "padding": "8px" }
};
const _hoisted_260 = { style: { "margin-top": "8px" } };
const _hoisted_261 = { class: "muted" };
const _hoisted_262 = { class: "out" };
const _hoisted_263 = {
  key: 1,
  class: "muted"
};
const _hoisted_264 = {
  key: 2,
  class: "empty"
};
const _hoisted_265 = {
  class: "muted",
  style: { "font-size": "12px" }
};
const _hoisted_266 = {
  key: 3,
  class: "pos",
  style: { "margin-top": "8px" }
};
const _hoisted_267 = {
  key: 4,
  class: "section"
};
const _hoisted_268 = {
  class: "mono",
  style: { "font-size": "12px", "white-space": "pre-wrap" }
};
const MAX_MB = 50;
const _sfc_main$2 = {
  __name: "ImportView",
  props: { nur: { type: Array, default: () => [] }, paste: { type: Boolean, default: false }, plugin: { type: String, default: "table" } },
  setup(__props, { expose: __expose }) {
    const { suggest, plan: makePlan, parseDelimited, childAttributes, childRoleOf } = mapper;
    const { trenne, bestandLaden, planRelationen } = relationen;
    const leftW = paneWidth("import.table", 720);
    const props = __props;
    const plugin = props.plugin;
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
        store.toast(t("Knoten {0} unbekannt", [id]));
        return;
      }
      const n = await api.get(`/api/nodes/${encodeURIComponent(id)}`);
      const childRole = childRoleOf(row, tree.kids(id));
      const allowed = new Set(childAttributes(model.value, n, childRole).map((a) => a.key));
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
        store.toast(r.handle ? t("{0}: nicht mehr lesbar — neu wählen", [r.name]) : t("{0}: war hineingezogen — bitte wieder ziehen oder wählen", [r.name]));
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
        const types = props.nur?.length ? [{ description: props.nur.join(" "), accept: { "application/octet-stream": [...props.nur] } }] : void 0;
        const [h2] = await window.showOpenFilePicker({ multiple: false, types });
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
          store.toast(t("{0}: neu gelesen", [source.value?.name]), "ok");
        } catch (err) {
          store.toast(err.message);
        }
      } else document.querySelector("#table-file-input")?.click();
    }
    async function takeFile(file, keepSheet = false) {
      if (file.size > MAX_MB * 1048576) {
        store.toast(t("{0}: {1} MB, im Browser höchstens {2} MB.", [file.name, (file.size / 1048576).toFixed(0), MAX_MB]));
        return;
      }
      if (/\.json$/i.test(file.name)) {
        try {
          const j = JSON.parse(await file.text());
          const n = j?.node ?? j;
          if (n && !Array.isArray(n) && n.id && n.role && Array.isArray(n.values)) {
            store.toast(t("Knotenbaum erkannt → JSON-Import"), "ok");
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
        let t$1;
        if (imp) t$1 = await imp.parse(file, plugins.ctx(imp.key));
        else if (/\.(csv|txt|tsv)$/i.test(file.name)) t$1 = parseDelimited(await file.text());
        else if (/\.json$/i.test(file.name)) {
          const { fromObjects } = mapper;
          const j = JSON.parse(await file.text());
          t$1 = fromObjects(Array.isArray(j) ? j : j.rows ?? j.items ?? j.data ?? []);
        } else throw new Error(t("Kein Importer für {0} — Plugin für dieses Format einschalten (⬡ Plugins)", [file.name]));
        setSource({ ...t$1, name: file.name, importer: imp?.key ?? null });
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
      setTimeout(() => window.dispatchEvent(new CustomEvent("journali:profile-applied")), 0);
    }
    function setSource(t$1) {
      if (t$1.sheets && !t$1.columns) {
        const { blaetter, relationen: rb } = trenne(t$1);
        if (rb && blaetter.length) {
          t$1.sheets = blaetter;
          t$1.relationenBlatt = rb;
        }
        t$1.sheet = t$1.sheets[0]?.name;
        const s = t$1.sheets[0];
        t$1.columns = s?.columns ?? [];
        t$1.rows = s?.rows ?? [];
      }
      source.value = t$1;
      mapping.value = strictify(suggest(t$1.columns, t$1.rows, model.value, { external: external.value || null }));
      applyProfile();
      planned.value = null;
      result.value = null;
      say(t("{0}: {1} Zeilen, {2} Spalten — {3} Spalten zugeordnet, {4} neu, {5} übergangen", [t$1.name, t$1.rows.length, t$1.columns.length, mapping.value.filter((m2) => m2.target === "attr").length, mapping.value.filter((m2) => m2.target === "new").length, mapping.value.filter((m2) => m2.target === "skip").length]));
    }
    function pickSheet(name) {
      const s = source.value.sheets.find((x) => x.name === name);
      if (!s) return;
      setSource({ ...source.value, sheet: name, columns: s.columns, rows: s.rows });
    }
    function takePaste() {
      const t$1 = parseDelimited(pasteText.value);
      if (!t$1.columns.length) return;
      setSource({ ...t$1, name: t("Zwischenablage") });
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
    function resuggest(keepProfile = false) {
      if (source.value) {
        mapping.value = strictify(suggest(source.value.columns, source.value.rows, model.value, { external: external.value || null }));
        if (keepProfile) applyProfile();
      }
      planned.value = null;
    }
    function strictify(m2) {
      if (!fixed.value) return m2;
      for (const x of m2) {
        if (x.target === "new") {
          x.target = "skip";
          x.why = t("unbekannt — nicht in der Vorlage dieses Knotens");
          x.unknown = true;
        } else if (x.target === "attr" && !fixed.value.allowed.has(x.attribute)) {
          x.target = "skip";
          x.why = t("{0} gilt hier nicht für {1}", [x.attribute, roleLabel[fixed.value.childRole]]);
          x.unknown = true;
        } else if (x.target === "parent" || x.target === "external") {
          x.target = "skip";
          x.why = t("im Knotenmodus ohne Bedeutung");
        }
      }
      return m2;
    }
    const roleLabel = { group: t("Gruppen"), product: t("Produkte"), variant: t("Varianten") };
    const unknown = computed(() => mapping.value.filter((m2) => m2.unknown).length);
    const TARGETS = [["attr", t("Attribut")], ["new", t("neues Attribut")], ["status", t("Status")], ["id", "journali-Id"], ["external", t("externe Kennung")], ["parent", t("Elternteil")], ["skip", t("übergehen")]];
    const sample = (i) => source.value.rows.slice(0, 200).map((r) => r[i]).filter((v) => String(v ?? "").trim() !== "").slice(0, 3).map((v) => String(v).slice(0, 30)).join(" · ");
    const stepsOpen = ref(null);
    const layout = ref(localStorage.getItem("journali.import.layout") || "rows");
    function setLayout(l) {
      layout.value = l;
      localStorage.setItem("journali.import.layout", l);
    }
    const OPS = transform.OPS;
    const { FIELDS, FIELD_LABEL, FIELD_HINT, opHint } = transform;
    function addColumn(step, col) {
      if (!col) return;
      const cur = String(step.columns ?? "").trim();
      step.columns = cur ? cur.replace(/,\s*$/, "") + "," + col : col;
      planned.value = null;
    }
    function addStep(m2, op) {
      if (!op) return;
      (m2.steps ??= []).push(op === "boolean" ? { op, yes: transform.YES_DEFAULT } : { op });
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
    const distinctValues = (m2) => {
      const i = source.value?.columns.indexOf(m2.column) ?? -1;
      const set = /* @__PURE__ */ new Set();
      if (i < 0) return [];
      for (const r of source.value.rows) {
        const v = String(r[i] ?? "").trim();
        if (v) set.add(v);
        if (set.size >= 60) break;
      }
      return [...set];
    };
    const mapStep = (m2) => {
      let s = (m2.steps ?? []).find((x) => x.op === "map");
      if (!s) (m2.steps ??= []).push(s = { op: "map", pairs: "", other: "" });
      return s;
    };
    const pairsOf = (s) => Object.fromEntries(String(s.pairs ?? "").split(";").map((p) => p.split("=")).filter((p) => p.length === 2).map(([a, b]) => [a.trim().toLowerCase(), b.trim()]));
    const statusFor = (m2, v) => pairsOf(mapStep(m2))[v.toLowerCase()] ?? (store.status(v) ? v : "");
    function setStatusFor(m2, v, key) {
      const s = mapStep(m2);
      const p = Object.fromEntries(String(s.pairs ?? "").split(";").map((x) => x.split("=")).filter((x) => x.length === 2).map(([a, b]) => [a.trim(), b.trim()]));
      for (const k of Object.keys(p)) if (k.toLowerCase() === v.toLowerCase()) delete p[k];
      if (key) p[v] = key;
      s.pairs = Object.entries(p).map(([a, b]) => `${a}=${b}`).join("; ");
      planned.value = null;
    }
    function onTarget(m2) {
      planned.value = null;
      if (m2.target === "status") {
        mapStep(m2);
        stepsOpen.value = m2.column;
      }
      if (m2.target === "attr" && !m2.attribute) m2.attribute = attrs.value[0]?.key ?? null;
      if (m2.target === "new" && !m2.newKey) m2.newKey = m2.column.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      syncLocale(m2);
    }
    function syncLocale(m2) {
      const a = attrs.value.find((x) => x.key === m2.attribute);
      if (m2.target === "attr" && a && !a.perLocale) m2.locale = null;
      if (m2.target === "attr" && a?.perLocale && !m2.locale) m2.locale = model.value?.masterLocale ?? locales.value[0];
    }
    const uniqueKeys = computed(() => new Set((model.value?.attributes ?? []).filter((a) => a.unique).map((a) => a.key)));
    const keyColumn = computed(() => mapping.value.find((m2) => ["id", "external"].includes(m2.target) || m2.target === "attr" && uniqueKeys.value.has(m2.attribute)));
    const rootOfNode = (id) => {
      const a = tree.ancestors(id);
      return a.length ? a[0].id : id;
    };
    const idOk = (row) => {
      const m2 = mapping.value.find((x) => x.target === "id");
      if (!m2) return false;
      const i = mapping.value.indexOf(m2);
      const id = String(row[i] ?? "").trim();
      if (!tree.byId.has(id)) return false;
      const ir = mapping.value.findIndex((x) => x.target === "root");
      const want = ir >= 0 ? String(row[ir] ?? "").trim() : m2.root ?? "";
      return !want || rootOfNode(id) === want;
    };
    const idLocked = computed(() => {
      if (!source.value || !mapping.value.some((x) => x.target === "id")) return false;
      return source.value.rows.slice(0, 200).some(idOk);
    });
    const unknownIds = computed(() => idLocked.value ? source.value.rows.filter((r) => !idOk(r)).length : 0);
    const foreignRoot = computed(() => {
      if (!source.value) return 0;
      const m2 = mapping.value.find((x) => x.target === "id");
      if (!m2) return 0;
      const i = mapping.value.indexOf(m2);
      if (!m2.root && !mapping.value.some((x) => x.target === "root")) return 0;
      return source.value.rows.filter((r) => tree.byId.has(String(r[i] ?? "").trim()) && !idOk(r)).length;
    });
    const visibleMapping = computed(() => idLocked.value ? mapping.value.filter((m2) => !m2.internal && m2.target !== "id" && m2.target !== "parent" && m2.target !== "root") : mapping.value.filter((m2) => m2.target !== "root"));
    const groups = computed(() => model.value?.groups ?? []);
    const blockers = computed(() => {
      const p = planned.value;
      if (!p) return [];
      const out = [];
      if (p.stats.invalid.length) out.push(fixed.value ? t("{0} Werte passen nicht zum Typ — Datei abgelehnt, in Excel korrigieren", [p.stats.invalid.length]) : t("{0} Werte passen nicht zum Typ — unten korrigieren", [p.stats.invalid.length]));
      if (p.stats.missingGroup.length) out.push(t("neue Attribute ohne Attributgruppe: {0}", [p.stats.missingGroup.join(", ")]));
      return out;
    });
    const changeTab = ref("update");
    const openRow = ref(null);
    watch(() => planned.value?.stats, (st) => {
      if (!st) return;
      changeTab.value = st.create ? "create" : st.update ? "update" : "unchanged";
      openRow.value = null;
    });
    const attrLabel = (key) => {
      const a = attrs.value.find((x) => x.key === key) ?? store.model?.attributes?.find((x) => x.key === key);
      return L$1(a?.label) || key;
    };
    function fixCell(inv, v) {
      source.value.rows[inv.row][inv.column] = v;
      planned.value = { ...planned.value, stale: true };
    }
    const TYPE_DE = { text: t("Text"), html: "HTML", integer: t("ganze Zahl"), decimal: t("Zahl"), boolean: "ja/nein", date: t("Datum"), enum: t("Listenwert") };
    function typeHint(inv) {
      const a = attrs.value.find((x) => x.key === inv.key) ?? store.model?.attributes?.find((x) => x.key === inv.key);
      return a ? t("Attribut {0} ist {1}{2}{3} — im Modell änderbar", [a.key, TYPE_DE[a.type] ?? a.type, a.multiple ? ", mehrfach" : "", a.list ? " " + t("(Liste") + " " + a.list + ")" : ""]) : t("Attribut {0}", [inv.key]);
    }
    async function analyse() {
      if (!source.value) return;
      const ohneZiel = !target.value && !mapping.value.some((m2) => m2.target === "parent");
      if (ohneZiel && idLocked.value && unknownIds.value > 0) {
        store.toast(t("Ziel wählen — {0} Zeilen haben Ids, die der Baum nicht kennt (neu)", [unknownIds.value]));
        return;
      }
      busy.value = t("vergleiche mit dem Bestand …");
      try {
        await tree.load(true);
        const keys = [...new Set(mapping.value.filter((m2) => m2.target === "attr").map((m2) => m2.attribute))];
        const locs = [...new Set(mapping.value.filter((m2) => m2.target === "attr").map((m2) => m2.locale ?? ""))];
        const existing = /* @__PURE__ */ new Map();
        const iId = mapping.value.findIndex((m2) => m2.target === "id"), iExt = mapping.value.findIndex((m2) => m2.target === "external");
        const keyCols = mapping.value.map((m2, i) => m2.target === "attr" && uniqueKeys.value.has(m2.attribute) && !m2.locale ? i : -1).filter((i) => i >= 0);
        const byKey = /* @__PURE__ */ new Map();
        for (const r of tree.rows) for (const [k, v] of Object.entries(r.keys ?? {})) byKey.set(k + "" + String(v).trim(), r);
        const byExt = new Map(external.value ? tree.rows.filter((r) => r.external?.[external.value]).map((r) => [String(r.external[external.value]), r]) : []);
        const gefunden = /* @__PURE__ */ new Set();
        let treffer = 0;
        for (const row of source.value.rows) {
          const id = String(row[iId] ?? "").trim(), ext = String(row[iExt] ?? "").trim();
          const viaKey = keyCols.map((i) => byKey.get(mapping.value[i].attribute + "" + String(row[i] ?? "").trim())).find(Boolean);
          const n = iId >= 0 && id && tree.byId.get(id) || iExt >= 0 && ext && byExt.get(ext) || viaKey || null;
          if (n) {
            gefunden.add(n.id);
            treffer++;
          }
        }
        const neu = source.value.rows.length - treffer;
        if (ohneZiel && !idLocked.value && neu > 0) {
          store.toast(treffer ? t("Ziel wählen — {0} Zeilen gibt es noch nicht", [neu]) : t("Ziel wählen (Gruppe oder Produkt) — oder eine Spalte „Elternteil“"));
          return;
        }
        const ids = [...gefunden], SEITE = 2e3;
        let done = 0;
        const runden = Math.ceil(ids.length / SEITE) * locs.length;
        if (keys.length) for (let i = 0; i < ids.length; i += SEITE) for (const loc of locs) {
          busy.value = t("vergleiche mit dem Bestand … {0}/{1}", [++done, runden]);
          const t$1 = await api.post(`/api/nodes/${encodeURIComponent(ids[i])}/table`, { attributes: keys, locale: loc || null, nodes: ids.slice(i, i + SEITE), sparse: true, take: SEITE });
          for (const r of t$1.rows ?? []) {
            const cur = existing.get(r.row.id) ?? {};
            for (const [k, v] of Object.entries(r.values)) if (v.value != null) {
              cur[`${k}|${loc}`] = v.value;
              cur[`${k}|${loc}#own`] = v.own;
            }
            existing.set(r.row.id, cur);
          }
        }
        planned.value = makePlan({ columns: source.value.columns, rows: source.value.rows, mapping: mapping.value.map((m2) => ({ ...m2 })), model: model.value, tree, target: target.value, role: role.value || null, existing, external: external.value || null });
        if (source.value.relationenBlatt) {
          const blatt = source.value.relationenBlatt;
          busy.value = t("vergleiche Relationen mit dem Bestand …");
          const bestand = await bestandLaden(api, blatt, planned.value.ids, tree);
          const rp = planRelationen({ blatt, model: model.value, tree, ids: planned.value.ids, bestand });
          planned.value.commands = [...planned.value.commands, ...rp.commands];
          planned.value.stats.relations = { create: rp.stats.create, update: rp.stats.update, unchanged: rp.stats.unchanged };
          planned.value.stats.problems = [...planned.value.stats.problems, ...rp.stats.problems, ...rp.stats.invalid.map((x) => t("Relationen, Zeile {0}: {1} {2}", [x.row + 2, x.key, x.message]))];
        }
        const s = planned.value.stats;
        const nlv = Object.entries(s.newListValues ?? {}).map(([l, v]) => `${l}: ${Object.values(v).join(", ")}`);
        say(t("Plan: {0} neu, {1} geändert, {2} unverändert, {3} Werte, {4} neue Attribute{5}{6}", [s.create, s.update, s.unchanged, s.values, planned.value.newAttributes.length, nlv.length ? t(", neue Listenwerte — {0}", [nlv.join("; ")]) : "", s.problems.length ? t(", {0} Probleme", [s.problems.length]) : ""]));
      } catch (e) {
        store.toast(e.message);
      } finally {
        busy.value = "";
      }
    }
    async function run() {
      if (!planned.value || !store.actor) {
        if (!store.actor) store.toast(t("👤 Name fehlt → Einstellungen"));
        return;
      }
      if (blockers.value.length || planned.value.stale) {
        store.toast(blockers.value[0] ?? t("erst neu analysieren"));
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
        if (nlv) say(t("{0} Listenwerte angelegt", [nlv]));
        if (p.newAttributes.length) {
          await store.poll(true);
          say(t("{0} Attribute angelegt: {1}", [p.newAttributes.length, p.newAttributes.map((a) => a.key + " → " + a.group).join(", ")]));
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
    __expose({ source, planned, setSource, pickTarget, analyse, run });
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
                plugin: unref(plugin),
                scope: "import",
                busy: busy.value,
                get: profileGet,
                set: profileSet
              }, {
                default: withCtx(() => [
                  __props.paste ? (openBlock(), createElementBlock("tr", _hoisted_1$2, [
                    createElementVNode(
                      "td",
                      _hoisted_2$2,
                      toDisplayString(_ctx.$t("Einfügen")),
                      1
                      /* TEXT */
                    ),
                    createElementVNode("td", null, [
                      withDirectives(createElementVNode("textarea", {
                        "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => pasteText.value = $event),
                        rows: "4",
                        style: { "width": "100%" },
                        placeholder: _ctx.$t("aus Excel kopieren und hier einfügen — erste Zeile sind die Spaltennamen"),
                        onPaste: _cache[1] || (_cache[1] = withModifiers(() => {
                        }, ["stop"]))
                      }, null, 40, _hoisted_3$2), [
                        [vModelText, pasteText.value]
                      ]),
                      createElementVNode("div", _hoisted_4$2, [
                        createElementVNode("button", {
                          class: "primary",
                          disabled: !pasteText.value.trim(),
                          onClick: takePaste
                        }, toDisplayString(_ctx.$t("⎘ Übernehmen")), 9, _hoisted_5$2),
                        source.value ? (openBlock(), createElementBlock("span", _hoisted_6$2, [
                          createTextVNode(
                            "📄 " + toDisplayString(source.value.name) + " ",
                            1
                            /* TEXT */
                          ),
                          createElementVNode(
                            "span",
                            _hoisted_7$2,
                            toDisplayString(source.value.rows.length),
                            1
                            /* TEXT */
                          )
                        ])) : createCommentVNode("v-if", true)
                      ])
                    ])
                  ])) : createCommentVNode("v-if", true),
                  !__props.paste ? (openBlock(), createElementBlock("tr", _hoisted_8$2, [
                    createElementVNode(
                      "td",
                      _hoisted_9$2,
                      toDisplayString(_ctx.$t("Datei")),
                      1
                      /* TEXT */
                    ),
                    createElementVNode("td", {
                      class: normalizeClass(["row drop", { over: dragOver.value, empty: !source.value }]),
                      title: source.value ? "" : _ctx.$t("Datei hierher ziehen — oder aus Excel kopieren und hier Strg+V (erste Zeile = Spaltennamen)"),
                      onDragover: _cache[4] || (_cache[4] = withModifiers(($event) => dragOver.value = true, ["prevent"])),
                      onDragleave: _cache[5] || (_cache[5] = ($event) => dragOver.value = false),
                      onDrop: withModifiers(onDrop, ["prevent"])
                    }, [
                      createElementVNode("label", {
                        class: "primary btn",
                        title: "CSV, TSV, JSON" + (unref(plugins).importers.length ? ", " + unref(plugins).importers.flatMap((i) => i.accept ?? []).join(", ") : "") + " " + _ctx.$t("— oder hierher ziehen"),
                        onClick: pickFile
                      }, [
                        createTextVNode(
                          toDisplayString(_ctx.$t("📂 wählen")),
                          1
                          /* TEXT */
                        ),
                        createElementVNode(
                          "input",
                          {
                            id: "table-file-input",
                            type: "file",
                            style: { "display": "none" },
                            onChange: _cache[2] || (_cache[2] = ($event) => {
                              fileHandle.value = null;
                              takeFile($event.target.files[0]);
                            })
                          },
                          null,
                          32
                          /* NEED_HYDRATION */
                        )
                      ], 8, _hoisted_11$2),
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
                          _hoisted_13$2,
                          toDisplayString(source.value.rows.length),
                          1
                          /* TEXT */
                        )
                      ], 8, _hoisted_12$2)) : createCommentVNode("v-if", true),
                      source.value ? (openBlock(), createElementBlock("button", {
                        key: 1,
                        class: "x",
                        onClick: reloadFile,
                        title: fileHandle.value ? _ctx.$t("Datei neu von der Platte lesen (zwischendurch in Excel geändert?)") : _ctx.$t("Datei neu wählen — dieser Browser kann Dateien nicht erneut lesen")
                      }, "↻", 8, _hoisted_14$2)) : createCommentVNode("v-if", true),
                      source.value?.sheets?.length > 1 ? (openBlock(), createElementBlock("select", {
                        key: 2,
                        value: source.value.sheet,
                        onChange: _cache[3] || (_cache[3] = ($event) => pickSheet($event.target.value)),
                        title: _ctx.$t("Blatt"),
                        style: { "width": "140px" }
                      }, [
                        (openBlock(true), createElementBlock(
                          Fragment,
                          null,
                          renderList(source.value.sheets, (s) => {
                            return openBlock(), createElementBlock("option", {
                              key: s.name,
                              value: s.name
                            }, toDisplayString(s.name) + " (" + toDisplayString(s.rows.length) + ")", 9, _hoisted_16$2);
                          }),
                          128
                          /* KEYED_FRAGMENT */
                        ))
                      ], 40, _hoisted_15$2)) : !source.value ? (openBlock(), createElementBlock(
                        "span",
                        _hoisted_17$2,
                        toDisplayString(_ctx.$t("oder hierher ziehen · oder aus Excel kopieren und Strg+V")),
                        1
                        /* TEXT */
                      )) : createCommentVNode("v-if", true),
                      _cache[42] || (_cache[42] = createElementVNode(
                        "span",
                        { class: "grow" },
                        null,
                        -1
                        /* CACHED */
                      ))
                    ], 42, _hoisted_10$2)
                  ])) : createCommentVNode("v-if", true),
                  recent.value.length ? (openBlock(), createElementBlock("tr", _hoisted_18$2, [
                    createElementVNode(
                      "td",
                      _hoisted_19$2,
                      toDisplayString(_ctx.$t("zuletzt")),
                      1
                      /* TEXT */
                    ),
                    createElementVNode("td", {
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
                            onClick: ($event) => openRecent(r)
                          }, [
                            createTextVNode(
                              toDisplayString(r.name),
                              1
                              /* TEXT */
                            ),
                            createElementVNode("button", {
                              onClick: withModifiers(($event) => unref(recentFiles).forget("table", r.name).then(loadRecent), ["stop"]),
                              title: _ctx.$t("aus der Liste")
                            }, "×", 8, _hoisted_22$2)
                          ], 10, _hoisted_21$2);
                        }),
                        128
                        /* KEYED_FRAGMENT */
                      ))
                    ], 8, _hoisted_20$2)
                  ])) : createCommentVNode("v-if", true),
                  createElementVNode("tr", _hoisted_23$2, [
                    createElementVNode("td", _hoisted_24$2, [
                      createTextVNode(
                        toDisplayString(_ctx.$t("2 · Ziel") + " "),
                        1
                        /* TEXT */
                      ),
                      createElementVNode(
                        "span",
                        _hoisted_25$2,
                        "· " + toDisplayString(fixed.value ? "fest: die Tabelle passt 1:1 zu diesem Knoten" : _ctx.$t("wohin neue Zeilen kommen; vorhandene werden über Id, SKU oder Kennung gefunden")),
                        1
                        /* TEXT */
                      )
                    ])
                  ]),
                  fixed.value ? (openBlock(), createElementBlock("tr", _hoisted_26$1, [
                    createElementVNode(
                      "td",
                      _hoisted_27$1,
                      toDisplayString(_ctx.$t("Knoten")),
                      1
                      /* TEXT */
                    ),
                    createElementVNode("td", _hoisted_28$1, [
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
                        _hoisted_29$1,
                        toDisplayString(_ctx.$t("→ {0} · {1} mögliche Spalten", [roleLabel[fixed.value.childRole], fixed.value.allowed.size])),
                        1
                        /* TEXT */
                      ),
                      _cache[43] || (_cache[43] = createElementVNode(
                        "span",
                        { class: "grow" },
                        null,
                        -1
                        /* CACHED */
                      )),
                      createElementVNode("button", {
                        class: "x",
                        onClick: _cache[6] || (_cache[6] = ($event) => unref(router).replace("/p/table/import")),
                        title: _ctx.$t("Knotenmodus verlassen — frei zuordnen")
                      }, "×", 8, _hoisted_30$1)
                    ])
                  ])) : createCommentVNode("v-if", true),
                  !fixed.value && idLocked.value && !unknownIds.value ? (openBlock(), createElementBlock("tr", _hoisted_31$1, [
                    createElementVNode(
                      "td",
                      _hoisted_32$1,
                      toDisplayString(_ctx.$t("Ziel")),
                      1
                      /* TEXT */
                    ),
                    createElementVNode(
                      "td",
                      _hoisted_33$1,
                      toDisplayString(_ctx.$t("🔒 aus der Datei — die Zeilen haben journali-Ids{0}, jede wird an ihrem Platz aktualisiert{1}", [mapping.value.some((m2) => m2.target === "root") ? " " + _ctx.$t("samt Wurzel") : "", mapping.value.some((m2) => m2.target === "parent") ? _ctx.$t("; Elternteil steht in der Datei") : ""])),
                      1
                      /* TEXT */
                    )
                  ])) : createCommentVNode("v-if", true),
                  !fixed.value && foreignRoot.value ? (openBlock(), createElementBlock("tr", _hoisted_34$1, [
                    _cache[44] || (_cache[44] = createElementVNode(
                      "td",
                      { class: "attr" },
                      null,
                      -1
                      /* CACHED */
                    )),
                    createElementVNode(
                      "td",
                      _hoisted_35$1,
                      toDisplayString(_ctx.$t("⚠ {0} Zeilen haben Ids, die es hier gibt — aber unter einer anderen Wurzel: fremde Datenbank, Zufallstreffer. Sie gelten als neu und kommen unter das Ziel.", [foreignRoot.value])),
                      1
                      /* TEXT */
                    )
                  ])) : createCommentVNode("v-if", true),
                  !fixed.value && !(idLocked.value && !unknownIds.value) ? (openBlock(), createElementBlock("tr", _hoisted_36$1, [
                    createElementVNode(
                      "td",
                      _hoisted_37$1,
                      toDisplayString(_ctx.$t("Ziel")),
                      1
                      /* TEXT */
                    ),
                    createElementVNode("td", null, [
                      createElementVNode("div", _hoisted_38$1, [
                        target.value ? (openBlock(), createElementBlock("span", {
                          key: 0,
                          class: "chip",
                          title: target.value.id + " " + _ctx.$t("— Klick: im Baum ändern"),
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
                            title: _ctx.$t("Ziel entfernen")
                          }, "×", 8, _hoisted_40)
                        ], 8, _hoisted_39)) : (openBlock(), createElementBlock(
                          "span",
                          _hoisted_41,
                          toDisplayString(_ctx.$t("Gruppe oder Produkt — wohin neue Zeilen kommen")),
                          1
                          /* TEXT */
                        ))
                      ]),
                      !target.value || targetPick.value ? (openBlock(), createBlock(unref(TreePicker), {
                        key: 0,
                        "model-value": target.value?.id ?? "",
                        height: 200,
                        onPick: pickTarget
                      }, null, 8, ["model-value"])) : createCommentVNode("v-if", true)
                    ])
                  ])) : createCommentVNode("v-if", true),
                  !fixed.value && !(idLocked.value && !unknownIds.value) ? (openBlock(), createElementBlock("tr", _hoisted_42, [
                    createElementVNode(
                      "td",
                      _hoisted_43,
                      toDisplayString(_ctx.$t("Neue als")),
                      1
                      /* TEXT */
                    ),
                    createElementVNode("td", null, [
                      withDirectives(createElementVNode("select", {
                        "onUpdate:modelValue": _cache[9] || (_cache[9] = ($event) => role.value = $event),
                        title: _ctx.$t("Rolle neuer Zeilen"),
                        onChange: _cache[10] || (_cache[10] = ($event) => planned.value = null),
                        style: { "width": "100%" }
                      }, [
                        createElementVNode(
                          "option",
                          _hoisted_45,
                          toDisplayString(_ctx.$t("automatisch (unter Gruppe → Produkt, unter Produkt → Variante)")),
                          1
                          /* TEXT */
                        ),
                        createElementVNode(
                          "option",
                          _hoisted_46,
                          toDisplayString(_ctx.$t("▣ Gruppen")),
                          1
                          /* TEXT */
                        ),
                        createElementVNode(
                          "option",
                          _hoisted_47,
                          toDisplayString(_ctx.$t("▦ Produkte")),
                          1
                          /* TEXT */
                        ),
                        createElementVNode(
                          "option",
                          _hoisted_48,
                          toDisplayString(_ctx.$t("◆ Varianten")),
                          1
                          /* TEXT */
                        )
                      ], 40, _hoisted_44), [
                        [vModelSelect, role.value]
                      ])
                    ])
                  ])) : createCommentVNode("v-if", true),
                  !fixed.value && !idLocked.value ? (openBlock(), createElementBlock("tr", _hoisted_49, [
                    createElementVNode(
                      "td",
                      _hoisted_50,
                      toDisplayString(_ctx.$t("Kennung")),
                      1
                      /* TEXT */
                    ),
                    createElementVNode("td", null, [
                      withDirectives(createElementVNode("input", {
                        "onUpdate:modelValue": _cache[11] || (_cache[11] = ($event) => external.value = $event),
                        type: "text",
                        placeholder: _ctx.$t("System der externen Kennung (z. B. erp) — findet vorhandene Knoten"),
                        onChange: _cache[12] || (_cache[12] = ($event) => resuggest(true))
                      }, null, 40, _hoisted_51), [
                        [vModelText, external.value]
                      ])
                    ])
                  ])) : createCommentVNode("v-if", true)
                ]),
                _: 1
                /* STABLE */
              }, 8, ["plugin", "busy"]),
              createElementVNode("div", _hoisted_52, [
                !keyColumn.value && source.value ? (openBlock(), createElementBlock(
                  "div",
                  _hoisted_53,
                  toDisplayString(_ctx.$t("⚠ Keine Schlüsselspalte (Id, SKU, Kennung) — jede Zeile wird neu angelegt.")),
                  1
                  /* TEXT */
                )) : createCommentVNode("v-if", true),
                createCommentVNode(" Lücke bei ausgeblendeten Spalten: sieht aus wie unser Export, aber die Id-Spalte fehlt — in Excel entfernt oder ohne die versteckten Spalten weitergegeben "),
                source.value && mapping.value.some((m2) => m2.internal) && !mapping.value.some((m2) => m2.target === "id") ? (openBlock(), createElementBlock("div", _hoisted_54, [
                  createTextVNode(
                    toDisplayString(_ctx.$t("⚠ Das ist ein journali-Export, aber die Spalte") + " "),
                    1
                    /* TEXT */
                  ),
                  _cache[45] || (_cache[45] = createElementVNode(
                    "code",
                    null,
                    "journali_id_…",
                    -1
                    /* CACHED */
                  )),
                  createTextVNode(
                    toDisplayString(" " + _ctx.$t("fehlt (ausgeblendete Spalten gelöscht oder nur die sichtbaren kopiert?). Ohne Ids werden Zeilen über SKU gefunden — oder neu angelegt, mit Dubletten.")),
                    1
                    /* TEXT */
                  )
                ])) : createCommentVNode("v-if", true),
                unknown.value ? (openBlock(), createElementBlock(
                  "div",
                  _hoisted_55,
                  toDisplayString(_ctx.$t("⚠ {0} Spalten passen nicht zu diesem Knoten und werden übergangen — Vorlage per Rechtsklick am Knoten exportieren, dann stimmen die Spalten.", [unknown.value])),
                  1
                  /* TEXT */
                )) : createCommentVNode("v-if", true),
                source.value ? (openBlock(), createElementBlock("div", _hoisted_56, [
                  createElementVNode("h2", _hoisted_57, [
                    createTextVNode(
                      toDisplayString(_ctx.$t("3 · Zuordnung") + " "),
                      1
                      /* TEXT */
                    ),
                    createElementVNode(
                      "span",
                      _hoisted_58,
                      toDisplayString(_ctx.$t("· {0} von {1} Spalten", [visibleMapping.value.filter((m2) => m2.target !== "skip").length, visibleMapping.value.length])),
                      1
                      /* TEXT */
                    ),
                    idLocked.value ? (openBlock(), createElementBlock("span", {
                      key: 0,
                      class: "chip",
                      title: _ctx.$t("eigene Spalten ({0}) kommen aus der Datei und sind fest — nicht in der Zuordnung", [mapping.value.filter((m2) => m2.internal || m2.target === "id" || m2.target === "parent").map((m2) => m2.column).join(", ")])
                    }, toDisplayString(_ctx.$t("🔒 {0} eigene Spalten", [mapping.value.filter((m2) => m2.internal || m2.target === "id" || m2.target === "parent").length])), 9, _hoisted_59)) : createCommentVNode("v-if", true),
                    createElementVNode("button", {
                      class: "x",
                      onClick: _cache[13] || (_cache[13] = ($event) => resuggest()),
                      title: _ctx.$t("Zuordnung neu vorschlagen — verwirft die Zuordnung des Profils (mit gewähltem Profil wird der neue Vorschlag gespeichert)")
                    }, toDisplayString(_ctx.$t("↻ neu vorschlagen")), 9, _hoisted_60),
                    _cache[46] || (_cache[46] = createElementVNode(
                      "span",
                      { class: "grow" },
                      null,
                      -1
                      /* CACHED */
                    )),
                    createElementVNode("span", _hoisted_61, [
                      createElementVNode("button", {
                        class: normalizeClass({ on: layout.value === "rows" }),
                        onClick: _cache[14] || (_cache[14] = ($event) => setLayout("rows")),
                        title: _ctx.$t("eine Zeile je Spalte — nach unten scrollen")
                      }, toDisplayString(_ctx.$t("≡ Zeilen")), 11, _hoisted_62),
                      createElementVNode("button", {
                        class: normalizeClass({ on: layout.value === "cols" }),
                        onClick: _cache[15] || (_cache[15] = ($event) => setLayout("cols")),
                        title: _ctx.$t("wie in Excel: eine Spalte je Spalte, Zuordnung in den Kopfzeilen — nach rechts scrollen")
                      }, toDisplayString(_ctx.$t("⫼ Spalten")), 11, _hoisted_63)
                    ])
                  ]),
                  createCommentVNode(" Spalten wie in Excel: Kopfzeilen = Zuordnung, darunter die ersten Zeilen der Datei; erste Spalte klebt "),
                  layout.value === "cols" ? (openBlock(), createElementBlock("div", _hoisted_64, [
                    createElementVNode("table", _hoisted_65, [
                      createElementVNode("tbody", null, [
                        createElementVNode("tr", null, [
                          createElementVNode(
                            "th",
                            _hoisted_66,
                            toDisplayString(_ctx.$t("Spalte")),
                            1
                            /* TEXT */
                          ),
                          (openBlock(true), createElementBlock(
                            Fragment,
                            null,
                            renderList(visibleMapping.value, (m2) => {
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
                                  _hoisted_68,
                                  toDisplayString(_ctx.$t("{0} · {1} versch.", [m2.sniff?.type, m2.sniff?.distinct])),
                                  1
                                  /* TEXT */
                                )
                              ], 10, _hoisted_67);
                            }),
                            128
                            /* KEYED_FRAGMENT */
                          ))
                        ]),
                        createElementVNode("tr", null, [
                          createElementVNode(
                            "th",
                            _hoisted_69,
                            toDisplayString(_ctx.$t("Ziel")),
                            1
                            /* TEXT */
                          ),
                          (openBlock(true), createElementBlock(
                            Fragment,
                            null,
                            renderList(visibleMapping.value, (m2) => {
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
                                      }, toDisplayString(l), 9, _hoisted_71);
                                    }),
                                    128
                                    /* KEYED_FRAGMENT */
                                  ))
                                ], 40, _hoisted_70), [
                                  [vModelSelect, m2.target]
                                ])
                              ]);
                            }),
                            128
                            /* KEYED_FRAGMENT */
                          ))
                        ]),
                        createElementVNode("tr", null, [
                          createElementVNode(
                            "th",
                            _hoisted_72,
                            toDisplayString(_ctx.$t("Attribut")),
                            1
                            /* TEXT */
                          ),
                          (openBlock(true), createElementBlock(
                            Fragment,
                            null,
                            renderList(visibleMapping.value, (m2) => {
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
                                      }, toDisplayString(_ctx.$L(a.label) || a.key) + " · " + toDisplayString(a.key), 9, _hoisted_74);
                                    }),
                                    128
                                    /* KEYED_FRAGMENT */
                                  ))
                                ], 40, _hoisted_73)), [
                                  [vModelSelect, m2.attribute]
                                ]) : m2.target === "new" ? (openBlock(), createElementBlock("span", _hoisted_75, [
                                  withDirectives(createElementVNode("input", {
                                    "onUpdate:modelValue": ($event) => m2.newKey = $event,
                                    type: "text",
                                    placeholder: _ctx.$t("schlüssel"),
                                    onChange: _cache[16] || (_cache[16] = ($event) => planned.value = null)
                                  }, null, 40, _hoisted_76), [
                                    [vModelText, m2.newKey]
                                  ]),
                                  withDirectives(createElementVNode("select", {
                                    "onUpdate:modelValue": ($event) => m2.newType = $event,
                                    onChange: _cache[17] || (_cache[17] = ($event) => planned.value = null)
                                  }, [
                                    (openBlock(), createElementBlock(
                                      Fragment,
                                      null,
                                      renderList(["text", "html", "integer", "decimal", "boolean", "date", "enum"], (t2) => {
                                        return createElementVNode("option", {
                                          key: t2,
                                          value: t2
                                        }, toDisplayString(t2), 9, _hoisted_78);
                                      }),
                                      64
                                      /* STABLE_FRAGMENT */
                                    ))
                                  ], 40, _hoisted_77), [
                                    [vModelSelect, m2.newType]
                                  ]),
                                  withDirectives(createElementVNode("select", {
                                    "onUpdate:modelValue": ($event) => m2.newGroup = $event,
                                    class: normalizeClass({ neg: !m2.newGroup }),
                                    title: _ctx.$t("Attributgruppe — Pflicht"),
                                    onChange: _cache[18] || (_cache[18] = ($event) => planned.value = null)
                                  }, [
                                    createElementVNode(
                                      "option",
                                      _hoisted_80,
                                      toDisplayString(_ctx.$t("● Gruppe wählen …")),
                                      1
                                      /* TEXT */
                                    ),
                                    (openBlock(true), createElementBlock(
                                      Fragment,
                                      null,
                                      renderList(groups.value, (g) => {
                                        return openBlock(), createElementBlock("option", {
                                          key: g.key,
                                          value: g.key
                                        }, "▤ " + toDisplayString(_ctx.$L(g.label) || g.key), 9, _hoisted_81);
                                      }),
                                      128
                                      /* KEYED_FRAGMENT */
                                    ))
                                  ], 42, _hoisted_79), [
                                    [vModelSelect, m2.newGroup]
                                  ])
                                ])) : (openBlock(), createElementBlock("span", _hoisted_82, "—"))
                              ]);
                            }),
                            128
                            /* KEYED_FRAGMENT */
                          ))
                        ]),
                        createElementVNode("tr", null, [
                          createElementVNode(
                            "th",
                            _hoisted_83,
                            toDisplayString(_ctx.$t("Sprache")),
                            1
                            /* TEXT */
                          ),
                          (openBlock(true), createElementBlock(
                            Fragment,
                            null,
                            renderList(visibleMapping.value, (m2) => {
                              return openBlock(), createElementBlock("td", {
                                key: m2.column
                              }, [
                                m2.target === "attr" && attrs.value.find((a) => a.key === m2.attribute)?.perLocale || m2.target === "new" ? withDirectives((openBlock(), createElementBlock("select", {
                                  key: 0,
                                  "onUpdate:modelValue": ($event) => m2.locale = $event,
                                  style: { "width": "100%" },
                                  onChange: _cache[19] || (_cache[19] = ($event) => planned.value = null)
                                }, [
                                  _cache[47] || (_cache[47] = createElementVNode(
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
                                      }, toDisplayString(l), 9, _hoisted_85);
                                    }),
                                    128
                                    /* KEYED_FRAGMENT */
                                  ))
                                ], 40, _hoisted_84)), [
                                  [vModelSelect, m2.locale]
                                ]) : (openBlock(), createElementBlock("span", _hoisted_86, "—"))
                              ]);
                            }),
                            128
                            /* KEYED_FRAGMENT */
                          ))
                        ]),
                        createElementVNode("tr", null, [
                          _cache[48] || (_cache[48] = createElementVNode(
                            "th",
                            { class: "stick" },
                            "ƒ",
                            -1
                            /* CACHED */
                          )),
                          (openBlock(true), createElementBlock(
                            Fragment,
                            null,
                            renderList(visibleMapping.value, (m2) => {
                              return openBlock(), createElementBlock("td", {
                                key: m2.column
                              }, [
                                createElementVNode("button", {
                                  class: normalizeClass(["x", { on: m2.steps?.length }]),
                                  title: m2.steps?.length ? stepsText(m2) + " — Klick: bearbeiten" : _ctx.$t("Umwandlung hinzufügen"),
                                  onClick: ($event) => stepsOpen.value = stepsOpen.value === m2.column ? null : m2.column
                                }, "ƒ" + toDisplayString(m2.steps?.length ? m2.steps.length : ""), 11, _hoisted_87),
                                m2.steps?.length ? (openBlock(), createElementBlock(
                                  "span",
                                  _hoisted_88,
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
                          createElementVNode(
                            "th",
                            _hoisted_89,
                            toDisplayString(_ctx.$t("Warum")),
                            1
                            /* TEXT */
                          ),
                          (openBlock(true), createElementBlock(
                            Fragment,
                            null,
                            renderList(visibleMapping.value, (m2) => {
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
                                _hoisted_90,
                                toDisplayString(_ctx.$t("Zeile {0}", [r + 1])),
                                1
                                /* TEXT */
                              ),
                              (openBlock(true), createElementBlock(
                                Fragment,
                                null,
                                renderList(visibleMapping.value, (m2) => {
                                  return openBlock(), createElementBlock("td", {
                                    key: m2.column,
                                    class: "muted",
                                    title: String(source.value.rows[r - 1]?.[mapping.value.indexOf(m2)] ?? "")
                                  }, toDisplayString(String(source.value.rows[r - 1]?.[mapping.value.indexOf(m2)] ?? "").slice(0, 40)), 9, _hoisted_91);
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
                  layout.value === "cols" && stepsOpen.value && mapping.value.find((m2) => m2.column === stepsOpen.value) ? (openBlock(), createElementBlock("div", _hoisted_92, [
                    createElementVNode("div", _hoisted_93, [
                      createTextVNode(
                        toDisplayString(_ctx.$t("ƒ Umwandlung für") + " "),
                        1
                        /* TEXT */
                      ),
                      createElementVNode(
                        "b",
                        null,
                        toDisplayString(stepsOpen.value),
                        1
                        /* TEXT */
                      ),
                      _cache[49] || (_cache[49] = createTextVNode()),
                      createElementVNode("button", {
                        class: "x",
                        onClick: _cache[20] || (_cache[20] = ($event) => stepsOpen.value = null)
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
                            m2.target === "status" ? (openBlock(), createElementBlock("div", _hoisted_94, [
                              createElementVNode("span", _hoisted_95, [
                                createTextVNode(
                                  toDisplayString(_ctx.$t("Quellwert → Status")),
                                  1
                                  /* TEXT */
                                ),
                                !distinctValues(m2).length ? (openBlock(), createElementBlock(
                                  "span",
                                  _hoisted_96,
                                  toDisplayString(" " + _ctx.$t("· diese Spalte hat keine Werte — die Zuordnung erscheint, sobald welche vorhanden sind")),
                                  1
                                  /* TEXT */
                                )) : createCommentVNode("v-if", true)
                              ]),
                              (openBlock(true), createElementBlock(
                                Fragment,
                                null,
                                renderList(distinctValues(m2), (v) => {
                                  return openBlock(), createElementBlock("span", {
                                    key: v,
                                    class: "fld"
                                  }, [
                                    createElementVNode(
                                      "code",
                                      null,
                                      toDisplayString(v),
                                      1
                                      /* TEXT */
                                    ),
                                    _cache[51] || (_cache[51] = createTextVNode(
                                      " → ",
                                      -1
                                      /* CACHED */
                                    )),
                                    createElementVNode("select", {
                                      value: statusFor(m2, v),
                                      onChange: ($event) => setStatusFor(m2, v, $event.target.value)
                                    }, [
                                      _cache[50] || (_cache[50] = createElementVNode(
                                        "option",
                                        { value: "" },
                                        "–",
                                        -1
                                        /* CACHED */
                                      )),
                                      (openBlock(true), createElementBlock(
                                        Fragment,
                                        null,
                                        renderList(model.value?.statuses ?? [], (s) => {
                                          return openBlock(), createElementBlock("option", {
                                            key: s.key,
                                            value: s.key
                                          }, toDisplayString(unref(store).statusText(s.key)), 9, _hoisted_98);
                                        }),
                                        128
                                        /* KEYED_FRAGMENT */
                                      ))
                                    ], 40, _hoisted_97)
                                  ]);
                                }),
                                128
                                /* KEYED_FRAGMENT */
                              ))
                            ])) : createCommentVNode("v-if", true),
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
                                    _hoisted_99,
                                    toDisplayString(si + 1),
                                    1
                                    /* TEXT */
                                  ),
                                  withDirectives(createElementVNode("select", {
                                    "onUpdate:modelValue": ($event) => s.op = $event,
                                    onChange: _cache[21] || (_cache[21] = ($event) => planned.value = null),
                                    title: unref(opHint)(s.op)
                                  }, [
                                    (openBlock(true), createElementBlock(
                                      Fragment,
                                      null,
                                      renderList(unref(OPS), (o) => {
                                        return openBlock(), createElementBlock("option", {
                                          key: o[0],
                                          value: o[0]
                                        }, toDisplayString(o[1]), 9, _hoisted_101);
                                      }),
                                      128
                                      /* KEYED_FRAGMENT */
                                    ))
                                  ], 40, _hoisted_100), [
                                    [vModelSelect, s.op]
                                  ]),
                                  (openBlock(true), createElementBlock(
                                    Fragment,
                                    null,
                                    renderList(unref(FIELDS)[s.op] ?? [], (f) => {
                                      return openBlock(), createElementBlock(
                                        Fragment,
                                        { key: f },
                                        [
                                          f === "regex" ? (openBlock(), createElementBlock("label", {
                                            key: 0,
                                            title: _ctx.$t("als regulärer Ausdruck (Flags gi)")
                                          }, [
                                            withDirectives(createElementVNode("input", {
                                              type: "checkbox",
                                              "onUpdate:modelValue": ($event) => s.regex = $event,
                                              onChange: _cache[22] || (_cache[22] = ($event) => planned.value = null)
                                            }, null, 40, _hoisted_103), [
                                              [vModelCheckbox, s.regex]
                                            ]),
                                            createTextVNode(
                                              toDisplayString(" " + _ctx.$t("regex")),
                                              1
                                              /* TEXT */
                                            )
                                          ], 8, _hoisted_102)) : f === "test" ? (openBlock(), createElementBlock("span", _hoisted_104, [
                                            createElementVNode(
                                              "span",
                                              _hoisted_105,
                                              toDisplayString(_ctx.$t("Quelle ist")),
                                              1
                                              /* TEXT */
                                            ),
                                            withDirectives(createElementVNode("select", {
                                              "onUpdate:modelValue": ($event) => s.test = $event,
                                              onChange: _cache[23] || (_cache[23] = ($event) => planned.value = null)
                                            }, [
                                              createElementVNode(
                                                "option",
                                                _hoisted_107,
                                                toDisplayString(_ctx.$t("leer")),
                                                1
                                                /* TEXT */
                                              ),
                                              createElementVNode(
                                                "option",
                                                _hoisted_108,
                                                toDisplayString(_ctx.$t("gleich")),
                                                1
                                                /* TEXT */
                                              ),
                                              createElementVNode(
                                                "option",
                                                _hoisted_109,
                                                toDisplayString(_ctx.$t("enthält")),
                                                1
                                                /* TEXT */
                                              ),
                                              createElementVNode(
                                                "option",
                                                _hoisted_110,
                                                toDisplayString(_ctx.$t("passt auf (regex)")),
                                                1
                                                /* TEXT */
                                              )
                                            ], 40, _hoisted_106), [
                                              [vModelSelect, s.test]
                                            ])
                                          ])) : f === "decimal" ? (openBlock(), createElementBlock("span", _hoisted_111, [
                                            createElementVNode(
                                              "span",
                                              _hoisted_112,
                                              toDisplayString(_ctx.$t("Dezimalzeichen")),
                                              1
                                              /* TEXT */
                                            ),
                                            withDirectives(createElementVNode("select", {
                                              "onUpdate:modelValue": ($event) => s.decimal = $event,
                                              onChange: _cache[24] || (_cache[24] = ($event) => planned.value = null)
                                            }, [
                                              createElementVNode(
                                                "option",
                                                _hoisted_114,
                                                toDisplayString(_ctx.$t("raten")),
                                                1
                                                /* TEXT */
                                              ),
                                              createElementVNode(
                                                "option",
                                                _hoisted_115,
                                                toDisplayString(_ctx.$t("Komma")),
                                                1
                                                /* TEXT */
                                              ),
                                              createElementVNode(
                                                "option",
                                                _hoisted_116,
                                                toDisplayString(_ctx.$t("Punkt")),
                                                1
                                                /* TEXT */
                                              )
                                            ], 40, _hoisted_113), [
                                              [vModelSelect, s.decimal]
                                            ])
                                          ])) : f === "format" ? (openBlock(), createElementBlock("span", _hoisted_117, [
                                            createElementVNode(
                                              "span",
                                              _hoisted_118,
                                              toDisplayString(_ctx.$t("Quelle im Format")),
                                              1
                                              /* TEXT */
                                            ),
                                            withDirectives(createElementVNode("select", {
                                              "onUpdate:modelValue": ($event) => s.format = $event,
                                              onChange: _cache[25] || (_cache[25] = ($event) => planned.value = null)
                                            }, [
                                              (openBlock(true), createElementBlock(
                                                Fragment,
                                                null,
                                                renderList(unref(transform).DATE_FORMATS, ([k, l]) => {
                                                  return openBlock(), createElementBlock("option", {
                                                    key: k,
                                                    value: k
                                                  }, toDisplayString(l), 9, _hoisted_120);
                                                }),
                                                128
                                                /* KEYED_FRAGMENT */
                                              ))
                                            ], 40, _hoisted_119), [
                                              [vModelSelect, s.format]
                                            ])
                                          ])) : (openBlock(), createElementBlock("span", _hoisted_121, [
                                            createElementVNode(
                                              "span",
                                              _hoisted_122,
                                              toDisplayString(unref(FIELD_LABEL)[f] ?? f),
                                              1
                                              /* TEXT */
                                            ),
                                            withDirectives(createElementVNode("input", {
                                              type: "text",
                                              "onUpdate:modelValue": ($event) => s[f] = $event,
                                              placeholder: unref(FIELD_HINT)[f] ?? f,
                                              title: (unref(FIELD_HINT)[f] ?? f) + " — " + unref(opHint)(s.op),
                                              onInput: _cache[26] || (_cache[26] = ($event) => planned.value = null),
                                              style: { "width": "200px" }
                                            }, null, 40, _hoisted_123), [
                                              [vModelText, s[f]]
                                            ])
                                          ])),
                                          f === "columns" ? (openBlock(), createElementBlock("select", {
                                            key: 5,
                                            value: "",
                                            title: _ctx.$t("Spalte anklicken statt tippen — wird mit Komma angehängt"),
                                            onChange: ($event) => {
                                              addColumn(s, $event.target.value);
                                              $event.target.value = "";
                                            }
                                          }, [
                                            createElementVNode(
                                              "option",
                                              _hoisted_125,
                                              toDisplayString(_ctx.$t("+ Spalte …")),
                                              1
                                              /* TEXT */
                                            ),
                                            createElementVNode(
                                              "option",
                                              _hoisted_126,
                                              toDisplayString(_ctx.$t("{} · diese Spalte")),
                                              1
                                              /* TEXT */
                                            ),
                                            (openBlock(true), createElementBlock(
                                              Fragment,
                                              null,
                                              renderList(source.value.columns, (c) => {
                                                return openBlock(), createElementBlock("option", {
                                                  key: c,
                                                  value: c
                                                }, toDisplayString(c), 9, _hoisted_127);
                                              }),
                                              128
                                              /* KEYED_FRAGMENT */
                                            ))
                                          ], 40, _hoisted_124)) : createCommentVNode("v-if", true)
                                        ],
                                        64
                                        /* STABLE_FRAGMENT */
                                      );
                                    }),
                                    128
                                    /* KEYED_FRAGMENT */
                                  )),
                                  _cache[52] || (_cache[52] = createElementVNode(
                                    "span",
                                    { class: "grow" },
                                    null,
                                    -1
                                    /* CACHED */
                                  )),
                                  createElementVNode("button", {
                                    class: "x",
                                    onClick: ($event) => moveStep(m2, si, -1)
                                  }, "↑", 8, _hoisted_128),
                                  createElementVNode("button", {
                                    class: "x",
                                    onClick: ($event) => moveStep(m2, si, 1)
                                  }, "↓", 8, _hoisted_129),
                                  createElementVNode("button", {
                                    class: "x",
                                    onClick: ($event) => delStep(m2, si)
                                  }, "×", 8, _hoisted_130)
                                ]);
                              }),
                              128
                              /* KEYED_FRAGMENT */
                            )),
                            createElementVNode("div", _hoisted_131, [
                              createElementVNode("select", {
                                value: "",
                                onChange: ($event) => {
                                  addStep(m2, $event.target.value);
                                  $event.target.value = "";
                                }
                              }, [
                                createElementVNode(
                                  "option",
                                  _hoisted_133,
                                  toDisplayString(_ctx.$t("+ Schritt …")),
                                  1
                                  /* TEXT */
                                ),
                                (openBlock(true), createElementBlock(
                                  Fragment,
                                  null,
                                  renderList(unref(OPS), (o) => {
                                    return openBlock(), createElementBlock("option", {
                                      key: o[0],
                                      value: o[0],
                                      title: o[2]
                                    }, toDisplayString(o[1]), 9, _hoisted_134);
                                  }),
                                  128
                                  /* KEYED_FRAGMENT */
                                ))
                              ], 40, _hoisted_132),
                              createElementVNode(
                                "span",
                                _hoisted_135,
                                toDisplayString(m2.steps?.length ? _ctx.$t("Vorschau:") + " " + preview(m2, mapping.value.indexOf(m2)) : _ctx.$t("Kette zwischen Quelle und Ziel")),
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
                  layout.value === "rows" ? (openBlock(), createElementBlock("table", _hoisted_136, [
                    createElementVNode("thead", null, [
                      createElementVNode("tr", null, [
                        createElementVNode(
                          "th",
                          _hoisted_137,
                          toDisplayString(_ctx.$t("Spalte")),
                          1
                          /* TEXT */
                        ),
                        createElementVNode(
                          "th",
                          null,
                          toDisplayString(_ctx.$t("Beispiele")),
                          1
                          /* TEXT */
                        ),
                        createElementVNode(
                          "th",
                          _hoisted_138,
                          toDisplayString(_ctx.$t("Ziel")),
                          1
                          /* TEXT */
                        ),
                        createElementVNode(
                          "th",
                          _hoisted_139,
                          toDisplayString(_ctx.$t("Attribut")),
                          1
                          /* TEXT */
                        ),
                        createElementVNode(
                          "th",
                          _hoisted_140,
                          toDisplayString(_ctx.$t("Sprache")),
                          1
                          /* TEXT */
                        ),
                        createElementVNode(
                          "th",
                          _hoisted_141,
                          toDisplayString(_ctx.$t("Warum")),
                          1
                          /* TEXT */
                        ),
                        createElementVNode("th", {
                          style: { "width": "34px" },
                          title: _ctx.$t("Umwandlung: Schritte zwischen Quelle und Ziel (Zahl, Ja/Nein, Datum, Ersetzen, Aufteilen, Verbinden, Bedingung …)")
                        }, "ƒ", 8, _hoisted_142)
                      ])
                    ]),
                    createElementVNode("tbody", null, [
                      (openBlock(true), createElementBlock(
                        Fragment,
                        null,
                        renderList(visibleMapping.value, (m2) => {
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
                                      _hoisted_144,
                                      toDisplayString(_ctx.$t("{0} · {1} versch.", [m2.sniff?.type, m2.sniff?.distinct])),
                                      1
                                      /* TEXT */
                                    )
                                  ], 8, _hoisted_143),
                                  createElementVNode(
                                    "td",
                                    _hoisted_145,
                                    toDisplayString(sample(mapping.value.indexOf(m2))),
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
                                          }, toDisplayString(l), 9, _hoisted_147);
                                        }),
                                        128
                                        /* KEYED_FRAGMENT */
                                      ))
                                    ], 40, _hoisted_146), [
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
                                          }, toDisplayString(_ctx.$L(a.label) || a.key) + " · " + toDisplayString(a.key), 9, _hoisted_149);
                                        }),
                                        128
                                        /* KEYED_FRAGMENT */
                                      ))
                                    ], 40, _hoisted_148)), [
                                      [vModelSelect, m2.attribute]
                                    ]) : m2.target === "new" ? (openBlock(), createElementBlock("span", _hoisted_150, [
                                      withDirectives(createElementVNode("input", {
                                        "onUpdate:modelValue": ($event) => m2.newKey = $event,
                                        type: "text",
                                        style: { "flex": "1", "min-width": "90px" },
                                        placeholder: _ctx.$t("schlüssel"),
                                        onChange: _cache[27] || (_cache[27] = ($event) => planned.value = null)
                                      }, null, 40, _hoisted_151), [
                                        [vModelText, m2.newKey]
                                      ]),
                                      withDirectives(createElementVNode("select", {
                                        "onUpdate:modelValue": ($event) => m2.newType = $event,
                                        style: { "width": "84px" },
                                        onChange: _cache[28] || (_cache[28] = ($event) => planned.value = null)
                                      }, [
                                        (openBlock(), createElementBlock(
                                          Fragment,
                                          null,
                                          renderList(["text", "html", "integer", "decimal", "boolean", "date"], (t2) => {
                                            return createElementVNode("option", {
                                              key: t2,
                                              value: t2
                                            }, toDisplayString(t2), 9, _hoisted_153);
                                          }),
                                          64
                                          /* STABLE_FRAGMENT */
                                        ))
                                      ], 40, _hoisted_152), [
                                        [vModelSelect, m2.newType]
                                      ]),
                                      withDirectives(createElementVNode("select", {
                                        "onUpdate:modelValue": ($event) => m2.newGroup = $event,
                                        style: { "width": "100%" },
                                        class: normalizeClass({ neg: !m2.newGroup }),
                                        title: _ctx.$t("Attributgruppe — Pflicht: ohne Gruppe gilt das Attribut nirgends"),
                                        onChange: _cache[29] || (_cache[29] = ($event) => planned.value = null)
                                      }, [
                                        createElementVNode(
                                          "option",
                                          _hoisted_155,
                                          toDisplayString(_ctx.$t("● Gruppe wählen …")),
                                          1
                                          /* TEXT */
                                        ),
                                        (openBlock(true), createElementBlock(
                                          Fragment,
                                          null,
                                          renderList(groups.value, (g) => {
                                            return openBlock(), createElementBlock("option", {
                                              key: g.key,
                                              value: g.key
                                            }, "▤ " + toDisplayString(_ctx.$L(g.label) || g.key), 9, _hoisted_156);
                                          }),
                                          128
                                          /* KEYED_FRAGMENT */
                                        ))
                                      ], 42, _hoisted_154), [
                                        [vModelSelect, m2.newGroup]
                                      ])
                                    ])) : (openBlock(), createElementBlock("span", _hoisted_157, "—"))
                                  ]),
                                  createElementVNode("td", null, [
                                    m2.target === "attr" && attrs.value.find((a) => a.key === m2.attribute)?.perLocale || m2.target === "new" ? withDirectives((openBlock(), createElementBlock("select", {
                                      key: 0,
                                      "onUpdate:modelValue": ($event) => m2.locale = $event,
                                      style: { "width": "100%" },
                                      onChange: _cache[30] || (_cache[30] = ($event) => planned.value = null)
                                    }, [
                                      _cache[53] || (_cache[53] = createElementVNode(
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
                                          }, toDisplayString(l), 9, _hoisted_159);
                                        }),
                                        128
                                        /* KEYED_FRAGMENT */
                                      ))
                                    ], 40, _hoisted_158)), [
                                      [vModelSelect, m2.locale]
                                    ]) : createCommentVNode("v-if", true)
                                  ]),
                                  createElementVNode(
                                    "td",
                                    _hoisted_160,
                                    toDisplayString(m2.why),
                                    1
                                    /* TEXT */
                                  ),
                                  createElementVNode("td", null, [
                                    createElementVNode("button", {
                                      class: normalizeClass(["x", { on: m2.steps?.length }]),
                                      title: m2.steps?.length ? stepsText(m2) + " — Klick: bearbeiten" : _ctx.$t("Umwandlung hinzufügen"),
                                      onClick: ($event) => stepsOpen.value = stepsOpen.value === m2.column ? null : m2.column
                                    }, "ƒ" + toDisplayString(m2.steps?.length ? m2.steps.length : ""), 11, _hoisted_161)
                                  ])
                                ],
                                2
                                /* CLASS */
                              ),
                              stepsOpen.value === m2.column ? (openBlock(), createElementBlock("tr", _hoisted_162, [
                                createElementVNode("td", _hoisted_163, [
                                  createElementVNode("div", _hoisted_164, [
                                    m2.target === "status" ? (openBlock(), createElementBlock("div", _hoisted_165, [
                                      createElementVNode("span", _hoisted_166, [
                                        createTextVNode(
                                          toDisplayString(_ctx.$t("Quellwert → Status")),
                                          1
                                          /* TEXT */
                                        ),
                                        !distinctValues(m2).length ? (openBlock(), createElementBlock(
                                          "span",
                                          _hoisted_167,
                                          toDisplayString(" " + _ctx.$t("· diese Spalte hat keine Werte — die Zuordnung erscheint, sobald welche vorhanden sind")),
                                          1
                                          /* TEXT */
                                        )) : createCommentVNode("v-if", true)
                                      ]),
                                      (openBlock(true), createElementBlock(
                                        Fragment,
                                        null,
                                        renderList(distinctValues(m2), (v) => {
                                          return openBlock(), createElementBlock("span", {
                                            key: v,
                                            class: "fld"
                                          }, [
                                            createElementVNode(
                                              "code",
                                              null,
                                              toDisplayString(v),
                                              1
                                              /* TEXT */
                                            ),
                                            _cache[55] || (_cache[55] = createTextVNode(
                                              " → ",
                                              -1
                                              /* CACHED */
                                            )),
                                            createElementVNode("select", {
                                              value: statusFor(m2, v),
                                              onChange: ($event) => setStatusFor(m2, v, $event.target.value)
                                            }, [
                                              _cache[54] || (_cache[54] = createElementVNode(
                                                "option",
                                                { value: "" },
                                                "–",
                                                -1
                                                /* CACHED */
                                              )),
                                              (openBlock(true), createElementBlock(
                                                Fragment,
                                                null,
                                                renderList(model.value?.statuses ?? [], (s) => {
                                                  return openBlock(), createElementBlock("option", {
                                                    key: s.key,
                                                    value: s.key
                                                  }, toDisplayString(unref(store).statusText(s.key)), 9, _hoisted_169);
                                                }),
                                                128
                                                /* KEYED_FRAGMENT */
                                              ))
                                            ], 40, _hoisted_168)
                                          ]);
                                        }),
                                        128
                                        /* KEYED_FRAGMENT */
                                      ))
                                    ])) : createCommentVNode("v-if", true),
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
                                            _hoisted_170,
                                            toDisplayString(si + 1),
                                            1
                                            /* TEXT */
                                          ),
                                          withDirectives(createElementVNode("select", {
                                            "onUpdate:modelValue": ($event) => s.op = $event,
                                            onChange: _cache[31] || (_cache[31] = ($event) => planned.value = null),
                                            title: unref(opHint)(s.op)
                                          }, [
                                            (openBlock(true), createElementBlock(
                                              Fragment,
                                              null,
                                              renderList(unref(OPS), (o) => {
                                                return openBlock(), createElementBlock("option", {
                                                  key: o[0],
                                                  value: o[0]
                                                }, toDisplayString(o[1]), 9, _hoisted_172);
                                              }),
                                              128
                                              /* KEYED_FRAGMENT */
                                            ))
                                          ], 40, _hoisted_171), [
                                            [vModelSelect, s.op]
                                          ]),
                                          (openBlock(true), createElementBlock(
                                            Fragment,
                                            null,
                                            renderList(unref(FIELDS)[s.op] ?? [], (f) => {
                                              return openBlock(), createElementBlock(
                                                Fragment,
                                                { key: f },
                                                [
                                                  f === "regex" ? (openBlock(), createElementBlock("label", {
                                                    key: 0,
                                                    title: _ctx.$t("als regulärer Ausdruck (Flags gi)")
                                                  }, [
                                                    withDirectives(createElementVNode("input", {
                                                      type: "checkbox",
                                                      "onUpdate:modelValue": ($event) => s.regex = $event,
                                                      onChange: _cache[32] || (_cache[32] = ($event) => planned.value = null)
                                                    }, null, 40, _hoisted_174), [
                                                      [vModelCheckbox, s.regex]
                                                    ]),
                                                    createTextVNode(
                                                      toDisplayString(" " + _ctx.$t("regex")),
                                                      1
                                                      /* TEXT */
                                                    )
                                                  ], 8, _hoisted_173)) : f === "test" ? (openBlock(), createElementBlock("span", _hoisted_175, [
                                                    createElementVNode(
                                                      "span",
                                                      _hoisted_176,
                                                      toDisplayString(_ctx.$t("Quelle ist")),
                                                      1
                                                      /* TEXT */
                                                    ),
                                                    withDirectives(createElementVNode("select", {
                                                      "onUpdate:modelValue": ($event) => s.test = $event,
                                                      onChange: _cache[33] || (_cache[33] = ($event) => planned.value = null)
                                                    }, [
                                                      createElementVNode(
                                                        "option",
                                                        _hoisted_178,
                                                        toDisplayString(_ctx.$t("leer")),
                                                        1
                                                        /* TEXT */
                                                      ),
                                                      createElementVNode(
                                                        "option",
                                                        _hoisted_179,
                                                        toDisplayString(_ctx.$t("gleich")),
                                                        1
                                                        /* TEXT */
                                                      ),
                                                      createElementVNode(
                                                        "option",
                                                        _hoisted_180,
                                                        toDisplayString(_ctx.$t("enthält")),
                                                        1
                                                        /* TEXT */
                                                      ),
                                                      createElementVNode(
                                                        "option",
                                                        _hoisted_181,
                                                        toDisplayString(_ctx.$t("passt auf (regex)")),
                                                        1
                                                        /* TEXT */
                                                      )
                                                    ], 40, _hoisted_177), [
                                                      [vModelSelect, s.test]
                                                    ])
                                                  ])) : f === "decimal" ? (openBlock(), createElementBlock("span", _hoisted_182, [
                                                    createElementVNode(
                                                      "span",
                                                      _hoisted_183,
                                                      toDisplayString(_ctx.$t("Dezimalzeichen")),
                                                      1
                                                      /* TEXT */
                                                    ),
                                                    withDirectives(createElementVNode("select", {
                                                      "onUpdate:modelValue": ($event) => s.decimal = $event,
                                                      onChange: _cache[34] || (_cache[34] = ($event) => planned.value = null)
                                                    }, [
                                                      createElementVNode(
                                                        "option",
                                                        _hoisted_185,
                                                        toDisplayString(_ctx.$t("raten")),
                                                        1
                                                        /* TEXT */
                                                      ),
                                                      createElementVNode(
                                                        "option",
                                                        _hoisted_186,
                                                        toDisplayString(_ctx.$t("Komma")),
                                                        1
                                                        /* TEXT */
                                                      ),
                                                      createElementVNode(
                                                        "option",
                                                        _hoisted_187,
                                                        toDisplayString(_ctx.$t("Punkt")),
                                                        1
                                                        /* TEXT */
                                                      )
                                                    ], 40, _hoisted_184), [
                                                      [vModelSelect, s.decimal]
                                                    ])
                                                  ])) : f === "format" ? (openBlock(), createElementBlock("span", _hoisted_188, [
                                                    createElementVNode(
                                                      "span",
                                                      _hoisted_189,
                                                      toDisplayString(_ctx.$t("Quelle im Format")),
                                                      1
                                                      /* TEXT */
                                                    ),
                                                    withDirectives(createElementVNode("select", {
                                                      "onUpdate:modelValue": ($event) => s.format = $event,
                                                      onChange: _cache[35] || (_cache[35] = ($event) => planned.value = null)
                                                    }, [
                                                      (openBlock(true), createElementBlock(
                                                        Fragment,
                                                        null,
                                                        renderList(unref(transform).DATE_FORMATS, ([k, l]) => {
                                                          return openBlock(), createElementBlock("option", {
                                                            key: k,
                                                            value: k
                                                          }, toDisplayString(l), 9, _hoisted_191);
                                                        }),
                                                        128
                                                        /* KEYED_FRAGMENT */
                                                      ))
                                                    ], 40, _hoisted_190), [
                                                      [vModelSelect, s.format]
                                                    ])
                                                  ])) : (openBlock(), createElementBlock("span", _hoisted_192, [
                                                    createElementVNode(
                                                      "span",
                                                      _hoisted_193,
                                                      toDisplayString(unref(FIELD_LABEL)[f] ?? f),
                                                      1
                                                      /* TEXT */
                                                    ),
                                                    withDirectives(createElementVNode("input", {
                                                      type: "text",
                                                      "onUpdate:modelValue": ($event) => s[f] = $event,
                                                      placeholder: unref(FIELD_HINT)[f] ?? f,
                                                      title: (unref(FIELD_HINT)[f] ?? f) + " — " + unref(opHint)(s.op),
                                                      onInput: _cache[36] || (_cache[36] = ($event) => planned.value = null),
                                                      style: normalizeStyle(f === "pairs" || f === "columns" || f === "index" || f === "then" || f === "else" || f === "yes" ? "width:250px" : "width:130px")
                                                    }, null, 44, _hoisted_194), [
                                                      [vModelText, s[f]]
                                                    ])
                                                  ])),
                                                  f === "columns" ? (openBlock(), createElementBlock("select", {
                                                    key: 5,
                                                    value: "",
                                                    title: _ctx.$t("Spalte anklicken statt tippen — wird mit Komma angehängt"),
                                                    onChange: ($event) => {
                                                      addColumn(s, $event.target.value);
                                                      $event.target.value = "";
                                                    }
                                                  }, [
                                                    createElementVNode(
                                                      "option",
                                                      _hoisted_196,
                                                      toDisplayString(_ctx.$t("+ Spalte …")),
                                                      1
                                                      /* TEXT */
                                                    ),
                                                    createElementVNode(
                                                      "option",
                                                      _hoisted_197,
                                                      toDisplayString(_ctx.$t("{} · diese Spalte")),
                                                      1
                                                      /* TEXT */
                                                    ),
                                                    (openBlock(true), createElementBlock(
                                                      Fragment,
                                                      null,
                                                      renderList(source.value.columns, (c) => {
                                                        return openBlock(), createElementBlock("option", {
                                                          key: c,
                                                          value: c
                                                        }, toDisplayString(c), 9, _hoisted_198);
                                                      }),
                                                      128
                                                      /* KEYED_FRAGMENT */
                                                    ))
                                                  ], 40, _hoisted_195)) : createCommentVNode("v-if", true)
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
                                            _hoisted_199,
                                            toDisplayString(unref(opHint)(s.op)),
                                            1
                                            /* TEXT */
                                          ),
                                          _cache[56] || (_cache[56] = createElementVNode(
                                            "span",
                                            { class: "grow" },
                                            null,
                                            -1
                                            /* CACHED */
                                          )),
                                          createElementVNode("button", {
                                            class: "x",
                                            onClick: ($event) => moveStep(m2, si, -1),
                                            title: _ctx.$t("nach oben")
                                          }, "↑", 8, _hoisted_200),
                                          createElementVNode("button", {
                                            class: "x",
                                            onClick: ($event) => moveStep(m2, si, 1),
                                            title: _ctx.$t("nach unten")
                                          }, "↓", 8, _hoisted_201),
                                          createElementVNode("button", {
                                            class: "x",
                                            onClick: ($event) => delStep(m2, si),
                                            title: _ctx.$t("Schritt entfernen")
                                          }, "×", 8, _hoisted_202)
                                        ]);
                                      }),
                                      128
                                      /* KEYED_FRAGMENT */
                                    )),
                                    createElementVNode("div", _hoisted_203, [
                                      createElementVNode("select", {
                                        value: "",
                                        onChange: ($event) => {
                                          addStep(m2, $event.target.value);
                                          $event.target.value = "";
                                        }
                                      }, [
                                        createElementVNode(
                                          "option",
                                          _hoisted_205,
                                          toDisplayString(_ctx.$t("+ Schritt …")),
                                          1
                                          /* TEXT */
                                        ),
                                        (openBlock(true), createElementBlock(
                                          Fragment,
                                          null,
                                          renderList(unref(OPS), (o) => {
                                            return openBlock(), createElementBlock("option", {
                                              key: o[0],
                                              value: o[0],
                                              title: o[2]
                                            }, toDisplayString(o[1]), 9, _hoisted_206);
                                          }),
                                          128
                                          /* KEYED_FRAGMENT */
                                        ))
                                      ], 40, _hoisted_204),
                                      createElementVNode(
                                        "span",
                                        _hoisted_207,
                                        toDisplayString(m2.steps?.length ? _ctx.$t("Vorschau:") + " " + preview(m2, mapping.value.indexOf(m2)) : _ctx.$t("Kette zwischen Quelle und Ziel — die Prüfung des Attributs läuft danach; steht im Profil")),
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
            "onUpdate:modelValue": _cache[37] || (_cache[37] = ($event) => isRef(leftW) ? leftW.value = $event : null),
            min: 480,
            max: 1400
          }, null, 8, ["modelValue"]),
          createElementVNode("div", _hoisted_208, [
            createElementVNode("div", _hoisted_209, [
              createElementVNode(
                "h1",
                null,
                toDisplayString(_ctx.$t("4 · Plan")),
                1
                /* TEXT */
              ),
              createElementVNode("button", {
                class: "primary",
                disabled: !source.value || !!busy.value,
                onClick: analyse
              }, toDisplayString(_ctx.$t("analysieren")), 9, _hoisted_210),
              createElementVNode("button", {
                class: "primary",
                "data-demo": "aus",
                disabled: !planned.value || !!busy.value || !planned.value.commands.length || blockers.value.length > 0 || planned.value.stale,
                onClick: run,
                title: !planned.value ? _ctx.$t("erst analysieren") : blockers.value[0] ?? (planned.value.stale ? _ctx.$t("erst erneut analysieren") : _ctx.$t("{0} Befehle schreiben", [planned.value.commands.length]))
              }, toDisplayString(_ctx.$t("▶ schreiben")), 9, _hoisted_211),
              _cache[57] || (_cache[57] = createElementVNode(
                "span",
                { class: "grow" },
                null,
                -1
                /* CACHED */
              )),
              createElementVNode(
                "span",
                _hoisted_212,
                toDisplayString(unref(store).actor ? "👤 " + unref(store).actor : _ctx.$t("👤 Name fehlt")),
                1
                /* TEXT */
              )
            ]),
            createElementVNode("div", _hoisted_213, [
              planned.value ? (openBlock(), createElementBlock("div", _hoisted_214, [
                createElementVNode(
                  "span",
                  _hoisted_215,
                  toDisplayString(_ctx.$t("{0} Werte · {1} Befehle", [planned.value.stats.values, planned.value.commands.length])),
                  1
                  /* TEXT */
                ),
                Object.keys(planned.value.stats.newListValues ?? {}).length ? (openBlock(), createElementBlock(
                  Fragment,
                  { key: 0 },
                  [
                    _cache[58] || (_cache[58] = createTextVNode(
                      " · ",
                      -1
                      /* CACHED */
                    )),
                    createElementVNode("span", {
                      class: "pos",
                      title: Object.entries(planned.value.stats.newListValues).map(([l, v]) => l + ": " + Object.values(v).join(", ")).join(" · ")
                    }, toDisplayString(_ctx.$t("+{0} Listenwerte", [Object.values(planned.value.stats.newListValues).reduce((n, v) => n + Object.keys(v).length, 0)])), 9, _hoisted_216)
                  ],
                  64
                  /* STABLE_FRAGMENT */
                )) : createCommentVNode("v-if", true),
                planned.value.stats.relations ? (openBlock(), createElementBlock("span", {
                  key: 1,
                  title: _ctx.$t("Relationen aus dem Blatt Relationen")
                }, " · " + toDisplayString(_ctx.$t("{0} Relationen neu · {1} geändert · {2} unverändert", [planned.value.stats.relations.create, planned.value.stats.relations.update, planned.value.stats.relations.unchanged])), 9, _hoisted_217)) : createCommentVNode("v-if", true),
                planned.value.newAttributes.length ? (openBlock(), createElementBlock("span", _hoisted_218, [
                  _cache[59] || (_cache[59] = createTextVNode(
                    " · ",
                    -1
                    /* CACHED */
                  )),
                  createElementVNode(
                    "span",
                    _hoisted_219,
                    toDisplayString(_ctx.$t("{0} neue Attribute:", [planned.value.newAttributes.length])),
                    1
                    /* TEXT */
                  ),
                  createTextVNode(
                    " " + toDisplayString(planned.value.newAttributes.map((a) => a.key + " (" + a.type + ")").join(", ")),
                    1
                    /* TEXT */
                  )
                ])) : createCommentVNode("v-if", true),
                planned.value.stats.notes?.length ? (openBlock(), createElementBlock(
                  "div",
                  _hoisted_220,
                  "ℹ " + toDisplayString(planned.value.stats.notes.slice(0, 30).join("\nℹ ")),
                  1
                  /* TEXT */
                )) : createCommentVNode("v-if", true),
                planned.value.stats.problems.length ? (openBlock(), createElementBlock("div", _hoisted_221, [
                  createTextVNode(
                    toDisplayString(planned.value.stats.problems.slice(0, 30).join("\n")),
                    1
                    /* TEXT */
                  ),
                  planned.value.stats.problems.length > 30 ? (openBlock(), createElementBlock(
                    "span",
                    _hoisted_222,
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
                planned.value.stale ? (openBlock(), createElementBlock("div", _hoisted_223, [
                  createTextVNode(
                    toDisplayString(_ctx.$t("✎ Zellen korrigiert —") + " "),
                    1
                    /* TEXT */
                  ),
                  createElementVNode(
                    "button",
                    {
                      class: "primary",
                      onClick: analyse
                    },
                    toDisplayString(_ctx.$t("erneut analysieren")),
                    1
                    /* TEXT */
                  )
                ])) : createCommentVNode("v-if", true),
                planned.value.stats.invalid.length ? (openBlock(), createElementBlock("div", _hoisted_224, [
                  createElementVNode("h2", _hoisted_225, [
                    createTextVNode(
                      toDisplayString(_ctx.$t("Werte prüfen") + " "),
                      1
                      /* TEXT */
                    ),
                    createElementVNode(
                      "span",
                      _hoisted_226,
                      toDisplayString(_ctx.$t("· {0} Zellen{1}", [planned.value.stats.invalid.length, fixed.value ? " " + _ctx.$t("— im Knotenmodus in Excel korrigieren und neu laden") : " " + _ctx.$t("— hier korrigieren, dann erneut analysieren")])),
                      1
                      /* TEXT */
                    )
                  ]),
                  createElementVNode("table", _hoisted_227, [
                    createElementVNode("thead", null, [
                      createElementVNode("tr", null, [
                        createElementVNode(
                          "th",
                          _hoisted_228,
                          toDisplayString(_ctx.$t("Zeile")),
                          1
                          /* TEXT */
                        ),
                        createElementVNode(
                          "th",
                          _hoisted_229,
                          toDisplayString(_ctx.$t("Spalte")),
                          1
                          /* TEXT */
                        ),
                        createElementVNode("th", {
                          style: { "width": "260px" },
                          title: _ctx.$t("warum der Wert abgelehnt wird — und was das Attribut erwartet")
                        }, toDisplayString(_ctx.$t("Grund")), 9, _hoisted_230),
                        createElementVNode(
                          "th",
                          null,
                          toDisplayString(_ctx.$t("Wert")),
                          1
                          /* TEXT */
                        ),
                        createElementVNode(
                          "th",
                          _hoisted_231,
                          toDisplayString(_ctx.$t("Korrektur")),
                          1
                          /* TEXT */
                        )
                      ])
                    ]),
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
                              _hoisted_232,
                              toDisplayString(inv.row + 2),
                              1
                              /* TEXT */
                            ),
                            createElementVNode("td", {
                              class: "mono",
                              style: { "overflow": "hidden", "text-overflow": "ellipsis" },
                              title: source.value.columns[inv.column]
                            }, toDisplayString(source.value.columns[inv.column]), 9, _hoisted_233),
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
                                _hoisted_235,
                                " · " + toDisplayString(typeHint(inv)),
                                1
                                /* TEXT */
                              )
                            ], 8, _hoisted_234),
                            createElementVNode("td", {
                              class: "muted",
                              style: { "overflow": "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" },
                              title: String(inv.value ?? "")
                            }, toDisplayString(inv.value), 9, _hoisted_236),
                            createElementVNode("td", null, [
                              !fixed.value ? (openBlock(), createElementBlock("input", {
                                key: 0,
                                type: "text",
                                value: inv.value,
                                style: { "width": "100%" },
                                title: _ctx.$t("korrigierter Wert — Enter, dann erneut analysieren"),
                                onChange: ($event) => fixCell(inv, $event.target.value)
                              }, null, 40, _hoisted_237)) : (openBlock(), createElementBlock(
                                "span",
                                _hoisted_238,
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
                createCommentVNode(" Was passiert, je Zeile: Reiter neu / geändert / unverändert, je Knoten die Werte alt → neu "),
                planned.value.stats.changes?.length ? (openBlock(), createElementBlock("div", _hoisted_239, [
                  createElementVNode("h2", _hoisted_240, [
                    createTextVNode(
                      toDisplayString(_ctx.$t("Vorschau") + " "),
                      1
                      /* TEXT */
                    ),
                    createElementVNode("span", _hoisted_241, [
                      createElementVNode(
                        "button",
                        {
                          class: normalizeClass([{ on: changeTab.value === "create" }, "pos"]),
                          onClick: _cache[38] || (_cache[38] = ($event) => changeTab.value = "create")
                        },
                        toDisplayString(_ctx.$t("+{0} neu", [planned.value.stats.create])),
                        3
                        /* TEXT, CLASS */
                      ),
                      createElementVNode(
                        "button",
                        {
                          class: normalizeClass([{ on: changeTab.value === "update" }, "warn"]),
                          onClick: _cache[39] || (_cache[39] = ($event) => changeTab.value = "update")
                        },
                        toDisplayString(_ctx.$t("{0} geändert", [planned.value.stats.update])),
                        3
                        /* TEXT, CLASS */
                      ),
                      createElementVNode(
                        "button",
                        {
                          class: normalizeClass([{ on: changeTab.value === "unchanged" }, "muted"]),
                          onClick: _cache[40] || (_cache[40] = ($event) => changeTab.value = "unchanged")
                        },
                        toDisplayString(_ctx.$t("{0} unverändert", [planned.value.stats.unchanged])),
                        3
                        /* TEXT, CLASS */
                      )
                    ])
                  ]),
                  createElementVNode("table", _hoisted_242, [
                    createElementVNode("tbody", null, [
                      (openBlock(true), createElementBlock(
                        Fragment,
                        null,
                        renderList(planned.value.stats.changes.filter((c) => c.kind === changeTab.value).slice(0, 300), (c) => {
                          return openBlock(), createElementBlock(
                            Fragment,
                            {
                              key: c.row
                            },
                            [
                              createElementVNode("tr", {
                                class: "row",
                                style: { "cursor": "pointer" },
                                onClick: ($event) => openRow.value = openRow.value === c.row ? null : c.row
                              }, [
                                createElementVNode(
                                  "td",
                                  _hoisted_244,
                                  toDisplayString(c.values.length && changeTab.value !== "unchanged" ? openRow.value === c.row ? "▾" : "▸" : ""),
                                  1
                                  /* TEXT */
                                ),
                                createElementVNode(
                                  "td",
                                  _hoisted_245,
                                  toDisplayString(c.row + 2),
                                  1
                                  /* TEXT */
                                ),
                                createElementVNode("td", null, [
                                  c.node ? (openBlock(), createElementBlock("span", _hoisted_246, [
                                    createTextVNode(
                                      toDisplayString(unref(icon)(c.role)) + " " + toDisplayString(c.label) + " ",
                                      1
                                      /* TEXT */
                                    ),
                                    createElementVNode("a", {
                                      href: `/tree/${c.node}`,
                                      target: "_blank",
                                      class: "muted",
                                      title: _ctx.$t("im Baum ansehen — neues Fenster, der Import bleibt"),
                                      onClick: _cache[41] || (_cache[41] = withModifiers(() => {
                                      }, ["stop"]))
                                    }, "↗", 8, _hoisted_247)
                                  ])) : (openBlock(), createElementBlock(
                                    "span",
                                    _hoisted_248,
                                    "+ " + toDisplayString(c.label),
                                    1
                                    /* TEXT */
                                  ))
                                ]),
                                createElementVNode(
                                  "td",
                                  _hoisted_249,
                                  toDisplayString(c.values.length ? c.values.length + " " + _ctx.$t("Werte") : ""),
                                  1
                                  /* TEXT */
                                )
                              ], 8, _hoisted_243),
                              openRow.value === c.row && c.values.length ? (openBlock(), createElementBlock("tr", _hoisted_250, [
                                _cache[60] || (_cache[60] = createElementVNode(
                                  "td",
                                  null,
                                  null,
                                  -1
                                  /* CACHED */
                                )),
                                createElementVNode("td", _hoisted_251, [
                                  createElementVNode("table", _hoisted_252, [
                                    createElementVNode("tbody", null, [
                                      (openBlock(true), createElementBlock(
                                        Fragment,
                                        null,
                                        renderList(c.values, (d) => {
                                          return openBlock(), createElementBlock("tr", {
                                            key: d.attribute + "|" + d.locale
                                          }, [
                                            createElementVNode("td", _hoisted_253, [
                                              createTextVNode(
                                                toDisplayString(attrLabel(d.attribute)),
                                                1
                                                /* TEXT */
                                              ),
                                              d.locale ? (openBlock(), createElementBlock(
                                                "span",
                                                _hoisted_254,
                                                " · " + toDisplayString(d.locale),
                                                1
                                                /* TEXT */
                                              )) : createCommentVNode("v-if", true)
                                            ]),
                                            createElementVNode("td", {
                                              class: "old",
                                              title: d.from ?? ""
                                            }, toDisplayString(d.from == null ? "" : String(d.from).slice(0, 80)), 9, _hoisted_255),
                                            createElementVNode(
                                              "td",
                                              _hoisted_256,
                                              toDisplayString(d.from == null ? "+" : "→"),
                                              1
                                              /* TEXT */
                                            ),
                                            createElementVNode("td", {
                                              class: normalizeClass(d.from == null ? "new" : "chg"),
                                              title: d.to ?? ""
                                            }, toDisplayString(d.to == null ? "— (leeren)" : String(d.to).slice(0, 80)), 11, _hoisted_257)
                                          ]);
                                        }),
                                        128
                                        /* KEYED_FRAGMENT */
                                      ))
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
                      )),
                      !planned.value.stats.changes.some((c) => c.kind === changeTab.value) ? (openBlock(), createElementBlock("tr", _hoisted_258, [
                        createElementVNode(
                          "td",
                          _hoisted_259,
                          toDisplayString(_ctx.$t("nichts")),
                          1
                          /* TEXT */
                        )
                      ])) : createCommentVNode("v-if", true)
                    ])
                  ])
                ])) : createCommentVNode("v-if", true),
                createElementVNode("details", _hoisted_260, [
                  createElementVNode(
                    "summary",
                    _hoisted_261,
                    toDisplayString(_ctx.$t("Befehle (erste 200)")),
                    1
                    /* TEXT */
                  ),
                  createElementVNode(
                    "pre",
                    _hoisted_262,
                    toDisplayString(planned.value.commands.slice(0, 200).map((c) => `${c.op} ${JSON.stringify(c.args)}`).join("\n")),
                    1
                    /* TEXT */
                  )
                ])
              ])) : source.value ? (openBlock(), createElementBlock(
                "div",
                _hoisted_263,
                toDisplayString(_ctx.$t("Zuordnung prüfen, Ziel wählen, dann analysieren. Nichts wird geschrieben, bevor Du „schreiben“ drückst.")),
                1
                /* TEXT */
              )) : (openBlock(), createElementBlock("div", _hoisted_264, [
                createTextVNode(
                  toDisplayString(_ctx.$t("Datei ablegen oder aus Excel einfügen.")),
                  1
                  /* TEXT */
                ),
                _cache[61] || (_cache[61] = createElementVNode(
                  "br",
                  null,
                  null,
                  -1
                  /* CACHED */
                )),
                createElementVNode(
                  "span",
                  _hoisted_265,
                  toDisplayString(_ctx.$t("Der Mapper erkennt Spalten an Schlüssel, Label, Synonymen (Artikelnummer → sku …), Sprache im Namen (name_en) und rät den Typ neuer Attribute aus den Werten.")),
                  1
                  /* TEXT */
                )
              ])),
              result.value ? (openBlock(), createElementBlock("div", _hoisted_266, [
                createTextVNode(
                  toDisplayString(_ctx.$t("✓ {0} Einträge geschrieben · Stapel {1} —", [result.value.written, result.value.batch]) + " "),
                  1
                  /* TEXT */
                ),
                createVNode(_component_router_link, {
                  to: { path: "/journal", query: { q: result.value.batch } }
                }, {
                  default: withCtx(() => [
                    createTextVNode(
                      toDisplayString(_ctx.$t("im Journal")),
                      1
                      /* TEXT */
                    )
                  ]),
                  _: 1
                  /* STABLE */
                }, 8, ["to"])
              ])) : createCommentVNode("v-if", true),
              log.value.length ? (openBlock(), createElementBlock("div", _hoisted_267, [
                createElementVNode(
                  "h2",
                  null,
                  toDisplayString(_ctx.$t("Protokoll")),
                  1
                  /* TEXT */
                ),
                createElementVNode("div", _hoisted_268, [
                  (openBlock(true), createElementBlock(
                    Fragment,
                    null,
                    renderList(log.value, (l, i) => {
                      return openBlock(), createElementBlock(
                        "div",
                        {
                          key: i,
                          class: normalizeClass(/^\S+ ✗/.test(l) ? "fehler" : "")
                        },
                        toDisplayString(l),
                        3
                        /* TEXT, CLASS */
                      );
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ])
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
const ImportView = /* @__PURE__ */ _export_sfc(_sfc_main$2, [["__scopeId", "data-v-f918c26d"]]);
async function build$1(env, { root, role = "", locales, ownOnly = false, viewKey = "", channel = "", only = null, extra = [], at = null, relations = false, say }) {
  const { api: api2, model } = env;
  const byLocale = /* @__PURE__ */ new Map();
  let cols = [], nodes = [];
  const v = model.views.find((x) => x.key === viewKey);
  const sichtAttr = v ? [.../* @__PURE__ */ new Set([...v.items.flatMap((it) => it.order ?? []), ...v.items.flatMap((it) => it.group ? model.groups.find((g) => g.key === it.group)?.attributes ?? [] : [])])] : [];
  for (const l of locales) {
    say?.(`lese ${l} …`);
    const url = `/api/nodes/${encodeURIComponent(root)}/table?deep=true&sparse=true&locale=${l}${channel ? "&channel=" + encodeURIComponent(channel) : ""}${role ? "&role=" + role : ""}${at ? "&at=" + at : ""}${sichtAttr.length && sichtAttr.length <= 300 ? "&attributes=" + encodeURIComponent(sichtAttr.join(",")) : ""}`;
    const werte = /* @__PURE__ */ new Map();
    const zeilen = [];
    let skip = 0;
    for (; ; ) {
      const t2 = await api2.get(`${url}&take=1000&skip=${skip}`);
      cols = t2.columns;
      for (const r of t2.rows) {
        if (only && !only.has(r.row.id)) continue;
        werte.set(r.row.id, r.values);
        zeilen.push(r);
      }
      if (t2.next == null || t2.next <= skip) break;
      skip = t2.next;
      say?.(`lese ${l} … ${skip}/${t2.total}`);
    }
    nodes = zeilen;
    byLocale.set(l, werte);
  }
  if (v) {
    const order = v.items.flatMap((it) => it.order ?? []);
    const groups = new Map(model.groups.map((g) => [g.key, g.attributes]));
    const wanted = /* @__PURE__ */ new Set([...order, ...v.items.flatMap((it) => it.group ? groups.get(it.group) ?? [] : [])]);
    cols = cols.filter((c) => wanted.has(c.key)).sort((a, b) => (order.indexOf(a.key) + 1 || 999) - (order.indexOf(b.key) + 1 || 999));
  }
  cols = cols.filter((c) => c.type !== "rows" && !c.computed);
  cols = [...cols.filter((c) => c.unique), ...cols.filter((c) => !c.unique)];
  const axes = [...new Set(nodes.flatMap((r) => Object.keys(r.row.axisValues ?? {})))];
  let rootId = root;
  try {
    const n = await api2.get(`/api/nodes/${encodeURIComponent(root)}`);
    const anc = n.ancestors ?? [];
    if (anc.length) rootId = anc[anc.length - 1].id;
  } catch {
  }
  const sysCol = (sys, note) => ({ key: `journali_${sys}_${rootId}`, sys, note, hidden: sys !== "id" && sys !== "label" });
  const columns = [
    sysCol("id", "journali-Id des Knotens — nicht ändern. Zeile kopiert? Dann diese Zelle leeren, sonst erkennt der Import die Kopie an den Werten"),
    sysCol("parent", "Elternteil (journali-Id) — nicht ändern"),
    sysCol("role", "Knotentyp — nur zum Lesen"),
    sysCol("status", "Status — nur zum Lesen"),
    sysCol("label", "Name im Baum — nur zum Lesen"),
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
    return c.sys === "label" ? r.row.label : c.sys === "parent" ? r.row.parent ?? "" : c.sys ? r.row[c.sys] ?? "" : r.row[c.key] ?? "";
  }));
  let rel = null;
  if (relations) {
    say?.("lese Relationen …");
    try {
      rel = await api2.get(`/api/nodes/${encodeURIComponent(root)}/relations/tree?deep=true`);
    } catch {
      rel = null;
    }
  }
  return { columns, rows, count: nodes.length, ...rel ? { relations: rel } : {} };
}
const RELATIONEN_SPALTEN = { von: "journali_von", vonName: "journali_von_name", typ: "journali_typ", nach: "journali_nach", nachName: "journali_nach_name" };
const EINHEIT = "_einheit";
function relationenTabelle(teile) {
  const R = RELATIONEN_SPALTEN;
  const gesehen = /* @__PURE__ */ new Set(), zeilen = [], attribute = /* @__PURE__ */ new Map();
  const text = (v) => Array.isArray(v) ? v.join(",") : v == null ? "" : v;
  for (const t2 of teile) {
    if (!t2.relations) continue;
    const idAt = t2.columns.findIndex((c) => c.sys === "id" || c.key === "id"), nameAt = t2.columns.findIndex((c) => c.sys === "label");
    const name = new Map(t2.rows.map((r) => [r[idAt], nameAt >= 0 ? r[nameAt] : ""]));
    for (const [von, liste] of Object.entries(t2.relations)) {
      if (!name.has(von)) continue;
      for (const r of liste) {
        if (r.direction !== "out") continue;
        const key = `${von}${r.type}${r.other.id}`;
        if (gesehen.has(key)) continue;
        gesehen.add(key);
        const werte = {};
        for (const [a, w] of Object.entries(r.values ?? {})) {
          const a_ = attribute.get(a) ?? { einheit: false, sprachen: /* @__PURE__ */ new Set() };
          attribute.set(a, a_);
          for (const e of Array.isArray(w) ? w : [w]) {
            if (e.channel) continue;
            const spalte = e.locale ? `${a}_${e.locale}` : a;
            if (e.locale) a_.sprachen.add(e.locale);
            werte[spalte] = text(e.value);
            if (e.unit) {
              a_.einheit = true;
              werte[a + EINHEIT] = e.unit;
            }
          }
        }
        zeilen.push({ von, vonName: name.get(von) ?? "", typ: r.type, nach: r.other.id, nachName: r.other.label ?? "", werte });
      }
    }
  }
  if (!zeilen.length) return null;
  const spalten = [R.von, R.vonName, R.typ, R.nach, R.nachName];
  for (const [a, x] of attribute) {
    if (x.sprachen.size) spalten.push(...[...x.sprachen].map((l) => `${a}_${l}`));
    else spalten.push(a);
    if (x.einheit) spalten.push(a + EINHEIT);
  }
  const rows = zeilen.map((z) => spalten.map((k) => k === R.von ? z.von : k === R.vonName ? z.vonName : k === R.typ ? z.typ : k === R.nach ? z.nach : k === R.nachName ? z.nachName : z.werte[k] ?? ""));
  return { columns: spalten.map((k) => ({ key: k })), rows };
}
function toCsv({ columns, rows }) {
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return "\uFEFF" + [columns.map((c) => c.key).join(";"), ...rows.map((r) => r.map(esc).join(";"))].join("\r\n");
}
function toJson({ columns, rows, relations }) {
  const idAt = columns.findIndex((c) => c.sys === "id" || c.key === "id");
  return JSON.stringify(rows.map((r) => {
    const o = Object.fromEntries(columns.map((c, i) => [c.key, r[i] === "" ? null : r[i]]));
    const rel = relations?.[r[idAt >= 0 ? idAt : 0]];
    if (rel?.length) o.relations = rel;
    return o;
  }), null, 1);
}
function toJsonTree({ columns, rows, relations }) {
  const byId = /* @__PURE__ */ new Map();
  for (const r of rows) {
    const o = { id: r[columns.findIndex((c) => c.sys === "id" || c.key === "id")] ?? r[0], role: "", parent: null, name: "", status: null, axes: {}, attributes: {}, children: [] };
    columns.forEach((c, i) => {
      const v = r[i] === "" ? null : r[i];
      if (c.attr) {
        if (c.locale && columns.some((x) => x.attr === c.attr && x.locale !== c.locale)) (o.attributes[c.attr] ??= {})[c.locale] = v;
        else o.attributes[c.attr] = v;
      } else if (c.key.startsWith("axis:")) {
        if (v != null) o.axes[c.key.slice(5)] = v;
      } else if (c.sys === "label") o.name = v;
      else if (c.sys === "parent") o.parent = v;
      else if (c.sys) o[c.sys] = v;
      else o[c.key] = v;
    });
    for (const k of Object.keys(o.attributes)) {
      const a = o.attributes[k];
      if (a && typeof a === "object" && Object.values(a).every((x) => x == null)) delete o.attributes[k];
      else if (a == null) delete o.attributes[k];
    }
    if (relations?.[o.id]?.length) o.relations = relations[o.id];
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
const ZellenGrenze = 32767;
function kuerzeZellen(rows) {
  let gekuerzt = 0;
  const raus = rows.map((r) => r.map((v) => {
    if (typeof v !== "string" || v.length <= ZellenGrenze) return v;
    gekuerzt++;
    return v.slice(0, ZellenGrenze - 1) + "…";
  }));
  return { rows: raus, gekuerzt };
}
function workbook(X, { columns, rows }, legendRows = null, sheet = "Daten", relationen2 = null) {
  const gek = kuerzeZellen(rows);
  rows = gek.rows;
  const ws = X.utils.aoa_to_sheet([columns.map((c) => c.key), ...rows]);
  ws["!cols"] = columns.map((c) => ({ wch: Math.min(40, Math.max(8, c.key.length + 2)), hidden: !!c.hidden }));
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
  wb.gekuerzt = gek.gekuerzt;
  if (legendRows) {
    const lg = X.utils.aoa_to_sheet(legendRows);
    lg["!cols"] = [{ wch: 8 }, { wch: 24 }, { wch: 28 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 60 }];
    lg["!autofilter"] = { ref: X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(1, legendRows.length - 1), c: legendRows[0].length - 1 } }) };
    X.utils.book_append_sheet(wb, lg, "Legende");
  }
  if (relationen2) {
    const rl = X.utils.aoa_to_sheet([relationen2.columns.map((c) => c.key), ...relationen2.rows]);
    rl["!cols"] = relationen2.columns.map((c) => ({ wch: Math.min(40, Math.max(10, c.key.length + 2)) }));
    rl["!autofilter"] = { ref: X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(1, relationen2.rows.length), c: relationen2.columns.length - 1 } }) };
    X.utils.book_append_sheet(wb, rl, "Relationen");
  }
  return wb;
}
const L = (l) => globalThis.journali?.L ? globalThis.journali.L(l) : l?.de ?? Object.values(l ?? {})[0] ?? "";
const t_ = (k, p) => globalThis.journali?.t ? globalThis.journali.t(k, p) : String(k).replace(/\{(\w+)\}/g, (m2, i) => p?.[i] ?? m2);
const download = (blob, name) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1e3);
};
const XLSX_URL = "/plugins/excel/xlsx.mjs";
const loadXlsx = () => import(
  /* @vite-ignore */
  XLSX_URL
);
const POLISH_URL = "/plugins/excel/polish.mjs";
async function polished(X, wb, columns, rowCount, tableName, legendRows = null, relationen2 = null) {
  const raw = X.write(wb, { type: "array", bookType: "xlsx" });
  try {
    const { polish } = await import(
      /* @vite-ignore */
      POLISH_URL
    );
    return await polish(raw, { columns, rowCount, tableName, legend: legendRows ? { columns: legendRows[0], rowCount: legendRows.length - 1 } : null, relationen: relationen2 ? { columns: relationen2.columns, rowCount: relationen2.rows.length } : null });
  } catch (e) {
    console.warn(t_("Excel ohne Politur:"), e.message);
    return new Blob([raw], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }
}
const build = (opts) => build$1({ api, model: store.model }, opts);
async function leseDatei(file) {
  const imp = plugins.importerFor(file.name);
  let t2;
  if (imp) t2 = await imp.parse(file, plugins.ctx(imp.key));
  else if (/\.(csv|txt|tsv)$/i.test(file.name)) t2 = mapper.parseDelimited(await file.text());
  else throw new Error(t_("Kein Importer für {0} — Plugin für dieses Format einschalten (⌿ Plugins)", [file.name]));
  const blatt = t2.sheets?.[0] ?? t2;
  return { kopf: blatt.columns ?? [], zeilen: blatt.rows ?? [] };
}
async function toXlsx(table, sheet = t_("Daten"), relationen2 = null) {
  const X = await loadXlsx();
  const wb = workbook(X, table, null, sheet, relationen2);
  const blob = await polished(X, wb, table.columns, table.rows.length, sheet, null, relationen2);
  blob.gekuerzt = wb.gekuerzt;
  return blob;
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
  const rows = [[t_("Pflicht"), t_("Spalte"), t_("Label"), "Typ", t_("Einheit"), t_("Sprache"), "Werte / Hinweis"]];
  for (const c of columns) {
    const d = c.def ?? (c.attr ? model.attributes.find((a) => a.key === c.attr) : null);
    const list = d?.list ? model.lists.find((l) => l.key === d.list) : null;
    const req = d?.required && (typeof d.required !== "object" || Object.keys(d.required).length) || c.key.startsWith("axis:");
    rows.push([req ? "ja" : "nein", c.key, L(d?.label) ?? "", d?.type ?? "", d?.unit ?? "", c.locale ?? "", c.note ?? (list ? list.values.map((v) => `${v.value} = ${L(v.label) ?? v.value}`).join(" · ") : "")]);
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
      const m2 = /* @__PURE__ */ new Map();
      const all = [];
      for (let skip = 0; skip != null; ) {
        const t2 = await api.get(`/api/nodes/${encodeURIComponent(nodeId)}/table?locale=${l}&role=${childRole}&take=1000&skip=${skip}`);
        for (const r of t2.rows) {
          all.push(r);
          m2.set(r.row.id, r.values);
        }
        skip = t2.next != null && t2.next > skip ? t2.next : null;
      }
      nodes = all;
      byLocale.set(l, m2);
    }
    data = nodes.map((r) => columns.map((c) => c.key === "id" ? r.row.id : c.key.startsWith("axis:") ? r.row.axisValues?.[c.attr] ?? "" : byLocale.get(c.locale ?? locales[0])?.get(r.row.id)?.[c.attr]?.value ?? ""));
  }
  const lg = legend(columns);
  const wb = workbook(X, { columns, rows: data }, lg);
  const name = `${row.label}-${childRole}${withData ? "" : "-vorlage"}`.replace(/[^\w.-]+/g, "_") + ".xlsx";
  download(await polished(X, wb, columns, data.length, childRole === "variant" ? t_("Varianten") : childRole === "product" ? t_("Produkte") : t_("Gruppen"), lg), name);
  store.toast(t_("⇪ {0}: {1} Spalten{2}", [name, columns.length, withData ? t_(", {0} Zeilen", [data.length]) : ""]));
}
const tableExport = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  build,
  download,
  leseDatei,
  loadXlsx,
  nodeWorkbook,
  relationenTabelle,
  toCsv,
  toJson,
  toJsonTree,
  toXlsx
}, Symbol.toStringTag, { value: "Module" }));
const _hoisted_1$1 = {
  class: "pane",
  style: { "flex": "1" }
};
const _hoisted_2$1 = { class: "toolbar" };
const _hoisted_3$1 = { class: "grid form" };
const _hoisted_4$1 = { class: "step" };
const _hoisted_5$1 = {
  colspan: "2",
  class: "step-band",
  style: { "display": "table-cell", "height": "24px" }
};
const _hoisted_6$1 = { class: "attr" };
const _hoisted_7$1 = { class: "attr" };
const _hoisted_8$1 = {
  class: "chips",
  style: { "margin": "2px 0 4px" }
};
const _hoisted_9$1 = {
  key: 0,
  class: "muted"
};
const _hoisted_10$1 = { class: "attr" };
const _hoisted_11$1 = { value: "" };
const _hoisted_12$1 = { value: "group" };
const _hoisted_13$1 = { value: "product" };
const _hoisted_14$1 = { value: "variant" };
const _hoisted_15$1 = { class: "attr" };
const _hoisted_16$1 = { class: "chips" };
const _hoisted_17$1 = ["onClick"];
const _hoisted_18$1 = { class: "attr" };
const _hoisted_19$1 = { value: "" };
const _hoisted_20$1 = ["value"];
const _hoisted_21$1 = { class: "attr" };
const _hoisted_22$1 = ["title"];
const _hoisted_23$1 = { class: "step" };
const _hoisted_24$1 = {
  colspan: "2",
  class: "step-band",
  style: { "display": "table-cell", "height": "24px" }
};
const _hoisted_25$1 = { key: 0 };
const _hoisted_26 = { class: "attr" };
const _hoisted_27 = { value: "excel" };
const _hoisted_28 = { value: "csv" };
const _hoisted_29 = { class: "row" };
const _hoisted_30 = ["onClick", "title"];
const _hoisted_31 = ["onClick", "title"];
const _hoisted_32 = { class: "step-band" };
const _hoisted_33 = { class: "muted" };
const _hoisted_34 = { class: "scroll" };
const _hoisted_35 = {
  key: 0,
  class: "grid",
  style: { "width": "auto" }
};
const _hoisted_36 = ["title"];
const _hoisted_37 = {
  key: 1,
  class: "muted",
  style: { "padding": "8px" }
};
const _hoisted_38 = {
  key: 2,
  class: "empty"
};
const _sfc_main$1 = {
  __name: "ExportView",
  props: { festesFormat: { type: String, default: "" }, plugin: { type: String, default: "table" } },
  setup(__props) {
    const route = useRoute();
    const saved = JSON.parse(localStorage.getItem("journali.export.table") || "{}");
    const roots = ref(route.query.node ? [route.query.node] : saved.roots ?? []);
    const role = ref(saved.role ?? "");
    const locales = ref(saved.locales ?? [store.model?.masterLocale ?? "de"]);
    const ownOnly = ref(saved.ownOnly ?? false);
    const relations = ref(saved.relations ?? false);
    const viewKey = ref(saved.viewKey ?? "");
    const props = __props;
    const plugin = props.plugin;
    const format = ref(props.festesFormat || saved.format || "excel");
    const rootRows = computed(() => roots.value.map((id) => tree.byId.get(id)).filter(Boolean));
    const profileGet = () => ({ roots: roots.value, role: role.value, locales: locales.value, ownOnly: ownOnly.value, relations: relations.value, viewKey: viewKey.value });
    function profileSet(p) {
      if (!p) return;
      roots.value = Array.isArray(p.roots) ? p.roots : p.roots ? [p.roots] : roots.value;
      role.value = p.role ?? "";
      if (Array.isArray(p.locales) && p.locales.length) locales.value = p.locales;
      ownOnly.value = !!p.ownOnly;
      relations.value = !!p.relations;
      viewKey.value = p.viewKey ?? "";
      table.value = null;
      persist();
    }
    const busy = ref("");
    const table = ref(null);
    const persist = () => localStorage.setItem("journali.export.table", JSON.stringify({ roots: roots.value, role: role.value, locales: locales.value, ownOnly: ownOnly.value, relations: relations.value, viewKey: viewKey.value, format: format.value }));
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
        store.toast(t("Teilbaum im Baum anhaken"));
        return;
      }
      if (!locales.value.length) {
        store.toast(t("mindestens eine Sprache"));
        return;
      }
      try {
        persist();
        const parts = [];
        for (const r of roots.value) parts.push(await build({ root: r, role: role.value, locales: locales.value, ownOnly: ownOnly.value, viewKey: viewKey.value, relations: relations.value && format.value === "excel", say: (m2) => {
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
        const t$1 = { columns, rows, count: rows.length };
        table.value = t$1;
        busy.value = `${t$1.count} Zeilen · ${t$1.columns.length} Spalten`;
        if (!downloadIt) return;
        const name = `${rootRows.value.map((r) => r.label).join("+") || "export"}-${role.value || "alle"}-${locales.value.join("-")}`.replace(/[^\w.-]+/g, "_").slice(0, 80);
        let gekuerzt = 0;
        if (format.value === "csv") download(new Blob([toCsv(t$1)], { type: "text/csv;charset=utf-8" }), name + ".csv");
        else {
          const b = await toXlsx(t$1, void 0, relationenTabelle(parts));
          gekuerzt = b.gekuerzt ?? 0;
          download(b, name + ".xlsx");
        }
        if (gekuerzt) store.toast(t("⇪ {0} Zeilen exportiert, {1} Zellen auf 32767 Zeichen gekürzt", [t$1.count, gekuerzt]));
        else store.toast(t("⇪ {0} Zeilen exportiert", [t$1.count]), "ok");
      } catch (e) {
        busy.value = "✗ " + e.message;
        store.toast(e.message);
      }
    }
    return (_ctx, _cache) => {
      const _component_router_link = resolveComponent("router-link");
      return openBlock(), createElementBlock("div", _hoisted_1$1, [
        createElementVNode("div", _hoisted_2$1, [
          createElementVNode(
            "h1",
            null,
            toDisplayString(_ctx.$t("⇪ Export")),
            1
            /* TEXT */
          ),
          createVNode(_component_router_link, {
            to: "/p/table/export",
            class: "tab on"
          }, {
            default: withCtx(() => [
              createTextVNode(
                toDisplayString(_ctx.$t("⊞ Tabelle")),
                1
                /* TEXT */
              )
            ]),
            _: 1
            /* STABLE */
          }),
          unref(plugins).enabled("json") ? (openBlock(), createBlock(_component_router_link, {
            key: 0,
            to: "/p/json/export",
            class: "tab"
          }, {
            default: withCtx(() => [
              createTextVNode(
                toDisplayString(_ctx.$t("{} JSON")),
                1
                /* TEXT */
              )
            ]),
            _: 1
            /* STABLE */
          })) : createCommentVNode("v-if", true),
          _cache[8] || (_cache[8] = createElementVNode(
            "span",
            { class: "grow" },
            null,
            -1
            /* CACHED */
          )),
          createElementVNode(
            "span",
            {
              class: normalizeClass(String(busy.value ?? "").startsWith("✗") ? "fehler" : "muted")
            },
            toDisplayString(busy.value),
            3
            /* TEXT, CLASS */
          )
        ]),
        createElementVNode("table", _hoisted_3$1, [
          _cache[10] || (_cache[10] = createElementVNode(
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
            createElementVNode("tr", _hoisted_4$1, [
              createElementVNode(
                "td",
                _hoisted_5$1,
                toDisplayString(_ctx.$t("1 · Was")),
                1
                /* TEXT */
              )
            ]),
            createElementVNode("tr", null, [
              createElementVNode(
                "td",
                _hoisted_6$1,
                toDisplayString(_ctx.$t("Profil")),
                1
                /* TEXT */
              ),
              createElementVNode("td", null, [
                (openBlock(), createBlock(unref(ProfileBar), {
                  key: unref(plugin) + "/export",
                  plugin: unref(plugin),
                  scope: "export",
                  get: profileGet,
                  set: profileSet
                }, null, 8, ["plugin"]))
              ])
            ]),
            createElementVNode("tr", null, [
              createElementVNode(
                "td",
                _hoisted_7$1,
                toDisplayString(_ctx.$t("Teilbaum")),
                1
                /* TEXT */
              ),
              createElementVNode("td", null, [
                createElementVNode("div", _hoisted_8$1, [
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
                  !rootRows.value.length ? (openBlock(), createElementBlock(
                    "span",
                    _hoisted_9$1,
                    toDisplayString(_ctx.$t("Teilbäume anhaken — ein Haken gilt für alles darunter")),
                    1
                    /* TEXT */
                  )) : createCommentVNode("v-if", true)
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
              createElementVNode(
                "td",
                _hoisted_10$1,
                toDisplayString(_ctx.$t("Knoten")),
                1
                /* TEXT */
              ),
              createElementVNode("td", null, [
                withDirectives(createElementVNode(
                  "select",
                  {
                    "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => role.value = $event),
                    onChange: persist,
                    style: { "width": "100%" }
                  },
                  [
                    createElementVNode(
                      "option",
                      _hoisted_11$1,
                      toDisplayString(_ctx.$t("alle Knoten darunter")),
                      1
                      /* TEXT */
                    ),
                    createElementVNode(
                      "option",
                      _hoisted_12$1,
                      toDisplayString(_ctx.$t("▣ nur Gruppen")),
                      1
                      /* TEXT */
                    ),
                    createElementVNode(
                      "option",
                      _hoisted_13$1,
                      toDisplayString(_ctx.$t("▦ nur Produkte")),
                      1
                      /* TEXT */
                    ),
                    createElementVNode(
                      "option",
                      _hoisted_14$1,
                      toDisplayString(_ctx.$t("◆ nur Varianten")),
                      1
                      /* TEXT */
                    )
                  ],
                  544
                  /* NEED_HYDRATION, NEED_PATCH */
                ), [
                  [vModelSelect, role.value]
                ])
              ])
            ]),
            createElementVNode("tr", null, [
              createElementVNode(
                "td",
                _hoisted_15$1,
                toDisplayString(_ctx.$t("Sprachen")),
                1
                /* TEXT */
              ),
              createElementVNode("td", null, [
                createElementVNode("div", _hoisted_16$1, [
                  (openBlock(true), createElementBlock(
                    Fragment,
                    null,
                    renderList(unref(store).model?.locales ?? [], (l) => {
                      return openBlock(), createElementBlock("span", {
                        key: l.code,
                        class: normalizeClass(["view-chip", { on: locales.value.includes(l.code) }]),
                        onClick: ($event) => toggleLocale(l.code)
                      }, toDisplayString(l.code), 11, _hoisted_17$1);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ])
              ])
            ]),
            createElementVNode("tr", null, [
              createElementVNode(
                "td",
                _hoisted_18$1,
                toDisplayString(_ctx.$t("Attribute")),
                1
                /* TEXT */
              ),
              createElementVNode("td", null, [
                withDirectives(createElementVNode(
                  "select",
                  {
                    "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => viewKey.value = $event),
                    onChange: persist,
                    style: { "width": "100%" }
                  },
                  [
                    createElementVNode(
                      "option",
                      _hoisted_19$1,
                      toDisplayString(_ctx.$t("◫ alle Attribute")),
                      1
                      /* TEXT */
                    ),
                    (openBlock(true), createElementBlock(
                      Fragment,
                      null,
                      renderList(unref(store).model?.views ?? [], (v) => {
                        return openBlock(), createElementBlock("option", {
                          key: v.key,
                          value: v.key
                        }, "◫ " + toDisplayString(_ctx.$L(v.label) || v.key) + " (" + toDisplayString(v.level) + ")", 9, _hoisted_20$1);
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
              createElementVNode(
                "td",
                _hoisted_21$1,
                toDisplayString(_ctx.$t("Werte")),
                1
                /* TEXT */
              ),
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
                  createTextVNode(
                    toDisplayString(" " + _ctx.$t("nur eigene Werte (geerbte leer lassen)")),
                    1
                    /* TEXT */
                  )
                ]),
                format.value === "excel" ? (openBlock(), createElementBlock("label", {
                  key: 0,
                  style: { "margin-left": "16px" },
                  title: _ctx.$t("Zweites Blatt: eine Zeile je Relation mit Von, Typ, Nach und den Werten der Relation")
                }, [
                  withDirectives(createElementVNode(
                    "input",
                    {
                      type: "checkbox",
                      "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => relations.value = $event),
                      onChange: persist
                    },
                    null,
                    544
                    /* NEED_HYDRATION, NEED_PATCH */
                  ), [
                    [vModelCheckbox, relations.value]
                  ]),
                  createTextVNode(
                    toDisplayString(" " + _ctx.$t("Relationen")),
                    1
                    /* TEXT */
                  )
                ], 8, _hoisted_22$1)) : createCommentVNode("v-if", true)
              ])
            ]),
            createElementVNode("tr", _hoisted_23$1, [
              createElementVNode(
                "td",
                _hoisted_24$1,
                toDisplayString(_ctx.$t("2 · Wie")),
                1
                /* TEXT */
              )
            ]),
            !__props.festesFormat ? (openBlock(), createElementBlock("tr", _hoisted_25$1, [
              createElementVNode(
                "td",
                _hoisted_26,
                toDisplayString(_ctx.$t("Format")),
                1
                /* TEXT */
              ),
              createElementVNode("td", null, [
                withDirectives(createElementVNode(
                  "select",
                  {
                    "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => format.value = $event),
                    onChange: persist,
                    style: { "width": "100%" }
                  },
                  [
                    createElementVNode(
                      "option",
                      _hoisted_27,
                      toDisplayString(_ctx.$t("Excel (.xlsx)")),
                      1
                      /* TEXT */
                    ),
                    createElementVNode(
                      "option",
                      _hoisted_28,
                      toDisplayString(_ctx.$t("CSV (; UTF-8, Excel-tauglich)")),
                      1
                      /* TEXT */
                    )
                  ],
                  544
                  /* NEED_HYDRATION, NEED_PATCH */
                ), [
                  [vModelSelect, format.value]
                ])
              ])
            ])) : createCommentVNode("v-if", true),
            createElementVNode("tr", null, [
              _cache[9] || (_cache[9] = createElementVNode(
                "td",
                { class: "attr" },
                null,
                -1
                /* CACHED */
              )),
              createElementVNode("td", null, [
                createElementVNode("div", _hoisted_29, [
                  createElementVNode(
                    "button",
                    {
                      onClick: _cache[6] || (_cache[6] = ($event) => run(false))
                    },
                    toDisplayString(_ctx.$t("Vorschau")),
                    1
                    /* TEXT */
                  ),
                  createElementVNode(
                    "button",
                    {
                      class: "primary",
                      onClick: _cache[7] || (_cache[7] = ($event) => run(true))
                    },
                    toDisplayString(_ctx.$t("⇪ herunterladen")),
                    1
                    /* TEXT */
                  ),
                  unref(plugins).enabled("tasker") ? (openBlock(), createBlock(_component_router_link, {
                    key: 0,
                    to: `/p/tasker/jobs?new=${format.value === "csv" ? "csv" : "excel"}&service=export`,
                    custom: ""
                  }, {
                    default: withCtx(({ navigate }) => [
                      createElementVNode("button", {
                        onClick: navigate,
                        title: _ctx.$t("denselben Export regelmäßig in ein Verzeichnis — Dienst „export“ des Format-Plugins")
                      }, toDisplayString(_ctx.$t("⏱ als Job")), 9, _hoisted_30)
                    ]),
                    _: 1
                    /* STABLE */
                  }, 8, ["to"])) : createCommentVNode("v-if", true),
                  unref(plugins).enabled("tasker") ? (openBlock(), createBlock(_component_router_link, {
                    key: 1,
                    to: "/p/tasker/jobs",
                    custom: ""
                  }, {
                    default: withCtx(({ navigate }) => [
                      createElementVNode("button", {
                        onClick: navigate,
                        title: _ctx.$t("die Jobs unter ⏱ Jobs — Zeitplan, Läufe, Logs")
                      }, toDisplayString(_ctx.$t("⏱ Jobs verwalten")), 9, _hoisted_31)
                    ]),
                    _: 1
                    /* STABLE */
                  })) : createCommentVNode("v-if", true)
                ])
              ])
            ])
          ])
        ]),
        createElementVNode("div", _hoisted_32, [
          createTextVNode(
            toDisplayString(_ctx.$t("3 · Vorschau") + " "),
            1
            /* TEXT */
          ),
          createElementVNode(
            "span",
            _hoisted_33,
            toDisplayString(_ctx.$t("· erste 200 Zeilen")),
            1
            /* TEXT */
          )
        ]),
        createElementVNode("div", _hoisted_34, [
          table.value ? (openBlock(), createElementBlock("table", _hoisted_35, [
            createElementVNode("thead", null, [
              createElementVNode("tr", null, [
                (openBlock(true), createElementBlock(
                  Fragment,
                  null,
                  renderList(table.value.columns, (c) => {
                    return openBlock(), createElementBlock("th", {
                      key: c.key,
                      title: c.attr ? `${c.attr} · ${c.locale}` : c.key
                    }, toDisplayString(c.key), 9, _hoisted_36);
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
            _hoisted_37,
            toDisplayString(_ctx.$t("… {0} weitere Zeilen in der Datei", [table.value.rows.length - 200])),
            1
            /* TEXT */
          )) : createCommentVNode("v-if", true),
          !table.value ? (openBlock(), createElementBlock(
            "div",
            _hoisted_38,
            toDisplayString(_ctx.$t("Teilbaum wählen, dann Vorschau oder herunterladen.")),
            1
            /* TEXT */
          )) : createCommentVNode("v-if", true)
        ])
      ]);
    };
  }
};
const ExportView = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["__scopeId", "data-v-3902daf0"]]);
const IdSpalte = "journali_id";
const ebeneSpalte = (n) => `Ebene ${n}`;
function pfadVon(byId, id, wurzel) {
  const pfad = [];
  for (let n = byId.get(id); n && n.id !== wurzel; n = n.parent ? byId.get(n.parent) : null) pfad.unshift(n);
  return pfad;
}
function zuTabelle(knoten, wurzel) {
  const byId = new Map(knoten.map((k) => [k.id, k]));
  const drunter = knoten.filter((k) => k.role === "group" && k.id !== wurzel && pfadVon(byId, k.id, wurzel).length > 0 && istUnter(byId, k.id, wurzel));
  const pfade = new Map(drunter.map((k) => [k.id, pfadVon(byId, k.id, wurzel)]));
  const tiefe = Math.max(0, ...[...pfade.values()].map((p) => p.length));
  const columns = [
    { key: IdSpalte, sys: "id", hidden: true, note: "journali-Id — nicht ändern. Leer lassen, dann entsteht ein neuer Knoten" },
    ...Array.from({ length: tiefe }, (_, i) => ({ key: ebeneSpalte(i + 1), ebene: i + 1 }))
  ];
  const sortiert = [...drunter].sort((a, b) => {
    const pa = pfade.get(a.id).map((n) => n.label ?? ""), pb = pfade.get(b.id).map((n) => n.label ?? "");
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (pa[i] ?? "").localeCompare(pb[i] ?? "", "de");
      if (d) return d;
    }
    return 0;
  });
  const rows = sortiert.map((k) => {
    const p = pfade.get(k.id);
    const zeile = [k.id, ...Array.from({ length: tiefe }, () => "")];
    zeile[p.length] = k.label ?? "";
    return zeile;
  });
  return { columns, rows, count: rows.length };
}
function istUnter(byId, id, wurzel) {
  for (let n = byId.get(id); n; n = n.parent ? byId.get(n.parent) : null) if (n.parent === wurzel || n.id === wurzel) return true;
  return false;
}
function plan(kopf, zeilen, knoten, wurzel) {
  const byId = new Map(knoten.map((k) => [k.id, k]));
  const idIdx = kopf.findIndex((k) => String(k).trim().toLowerCase().startsWith(IdSpalte));
  const ebenen = kopf.map((k, i) => ({ i, m: /^\s*ebene\s*(\d+)\s*$/i.exec(String(k)) })).filter((x) => x.m).map((x) => ({ i: x.i, ebene: Number(x.m[1]) })).sort((a, b) => a.ebene - b.ebene);
  if (!ebenen.length) return { fehler: ["Keine Spalte „Ebene 1“ — die Struktur steht in Spalten je Ebene."], anlegen: [], umbenennen: [], umhaengen: [], gleich: 0 };
  const anlegen = [], umbenennen = [], umhaengen = [], fehler = [];
  let gleich = 0;
  const offen = [];
  const nachPfad = /* @__PURE__ */ new Map();
  for (const k of knoten) {
    if (k.role !== "group") continue;
    const p = [];
    for (let n = k; n && n.id !== wurzel; n = n.parent ? byId.get(n.parent) : null) p.unshift(n.label ?? "");
    if (p.length) nachPfad.set(p.join("\0"), k.id);
  }
  zeilen.forEach((z, nr) => {
    const zeile = nr + 2;
    let tiefste = -1;
    for (const { i, ebene } of ebenen) {
      const v = String(z[i] ?? "").trim();
      if (v) {
        offen[ebene - 1] = v;
        offen.length = ebene;
        tiefste = ebene - 1;
      }
    }
    if (tiefste < 0) return;
    const name = offen[tiefste];
    const pfad = offen.slice(0, tiefste + 1);
    const elternPfad = pfad.slice(0, -1);
    const eltern = elternPfad.length ? nachPfad.get(elternPfad.join("\0")) : wurzel;
    if (!eltern) {
      fehler.push(`Zeile ${zeile}: „${elternPfad.join(" / ")}“ gibt es nicht.`);
      return;
    }
    const id = idIdx >= 0 ? String(z[idIdx] ?? "").trim() : "";
    if (id) {
      const da = byId.get(id);
      if (!da) {
        fehler.push(`Zeile ${zeile}: Id ${id} gibt es hier nicht.`);
        return;
      }
      if (da.role !== "group") {
        fehler.push(`Zeile ${zeile}: ${da.label ?? id} ist keine Gruppe.`);
        return;
      }
      let angefasst = false;
      if ((da.label ?? "") !== name) {
        umbenennen.push({ id, von: da.label ?? "", auf: name, zeile });
        angefasst = true;
      }
      if ((da.parent ?? "") !== eltern) {
        umhaengen.push({ id, name, unter: eltern, zeile });
        angefasst = true;
      }
      if (!angefasst) gleich++;
      nachPfad.set(pfad.join("\0"), id);
    } else {
      const schon = nachPfad.get(pfad.join("\0"));
      if (schon) {
        gleich++;
        return;
      }
      const neu = { name, unter: eltern, pfad: pfad.join(" / "), zeile, ref: "n" + (anlegen.length + 1) };
      anlegen.push(neu);
      nachPfad.set(pfad.join("\0"), neu);
    }
  });
  return { anlegen, umbenennen, umhaengen, gleich, fehler };
}
function befehle(p, masterLocale = "de") {
  const eltern = (u) => typeof u === "string" ? u : "@" + u.ref;
  return [
    ...p.anlegen.map((a) => ({ op: "group.create", ref: a.ref, args: { parent: eltern(a.unter), label: { [masterLocale]: a.name } } })),
    // group.rename setzt die Bezeichnung (GroupRenamed = Struktur, zaehlt nicht). node.rename waere NodeNamed
    // und damit Datenpflege, die Kontingent kostet — fuer ein Geruest waere das falsch
    ...p.umbenennen.map((u) => ({ op: "group.rename", args: { node: u.id, label: { [masterLocale]: u.auf } } })),
    ...p.umhaengen.map((h2) => ({ op: "node.move", args: { node: h2.id, parent: eltern(h2.unter) } }))
  ];
}
function planText(p, t2 = (s) => s) {
  const teile = [];
  if (p.anlegen.length) teile.push(`${p.anlegen.length} neu`);
  if (p.umbenennen.length) teile.push(`${p.umbenennen.length} umbenannt`);
  if (p.umhaengen.length) teile.push(`${p.umhaengen.length} umgehängt`);
  if (p.gleich) teile.push(`${p.gleich} unverändert`);
  if (!teile.length) teile.push(t2("nichts zu tun"));
  return teile.join(" · ");
}
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
const _hoisted_7 = {
  class: "chips",
  style: { "margin": "2px 0 4px" }
};
const _hoisted_8 = {
  key: 0,
  class: "chip"
};
const _hoisted_9 = {
  key: 1,
  class: "muted"
};
const _hoisted_10 = { class: "step" };
const _hoisted_11 = {
  colspan: "2",
  class: "step-band",
  style: { "display": "table-cell", "height": "24px" }
};
const _hoisted_12 = { class: "row" };
const _hoisted_13 = { class: "muted" };
const _hoisted_14 = { class: "step" };
const _hoisted_15 = {
  colspan: "2",
  class: "step-band",
  style: { "display": "table-cell", "height": "24px" }
};
const _hoisted_16 = { class: "attr" };
const _hoisted_17 = { class: "row" };
const _hoisted_18 = {
  key: 0,
  class: "mono muted"
};
const _hoisted_19 = { key: 0 };
const _hoisted_20 = { class: "attr" };
const _hoisted_21 = {
  key: 0,
  class: "fehler"
};
const _hoisted_22 = { class: "step-band" };
const _hoisted_23 = { class: "scroll" };
const _hoisted_24 = {
  key: 0,
  class: "grid",
  style: { "width": "auto" }
};
const _hoisted_25 = {
  key: 1,
  class: "empty"
};
const _sfc_main = {
  __name: "StrukturView",
  setup(__props, { expose: __expose }) {
    const route = useRoute();
    const wurzel = ref(route?.query?.node ? [route.query.node] : []);
    const busy = ref("");
    const tabelle = ref(null);
    const vorschau = ref(null);
    const dateiName = ref("");
    const wurzelZeile = computed(() => tree.byId.get(wurzel.value[0]));
    onMounted(async () => {
      if (!tree.loaded) await tree.load();
      if (!wurzel.value.length) wurzel.value = tree.rows.filter((r) => !r.parent).slice(0, 1).map((r) => r.id);
    });
    function bauen() {
      const id = wurzel.value[0];
      if (!id) {
        store.toast(t("Knoten wählen"));
        return null;
      }
      const t$1 = zuTabelle(tree.rows, id);
      tabelle.value = t$1;
      busy.value = t("{0} Gruppen · {1} Ebenen", [t$1.count, t$1.columns.length - 1]);
      return t$1;
    }
    async function herunterladen(format) {
      const t$1 = bauen();
      if (!t$1) return;
      const name = `${wurzelZeile.value?.label || "struktur"}-struktur`.replace(/[^\w.-]+/g, "_").slice(0, 80);
      if (format === "csv") download(new Blob([toCsv(t$1)], { type: "text/csv;charset=utf-8" }), name + ".csv");
      else download(await toXlsx(t$1, t("Struktur")), name + ".xlsx");
      store.toast(t("⇪ {0} Gruppen", [t$1.count]), "ok");
    }
    async function datei(ev) {
      const f = ev.target.files?.[0];
      if (!f) return;
      dateiName.value = f.name;
      vorschau.value = null;
      busy.value = t("lese …");
      try {
        const { kopf, zeilen } = await leseDatei(f);
        if (!tree.loaded) await tree.load();
        const p = plan(kopf, zeilen, tree.rows, wurzel.value[0]);
        vorschau.value = p;
        busy.value = p.fehler.length ? t("{0} Fehler", [p.fehler.length]) : planText(p, t);
      } catch (e) {
        busy.value = "✗ " + e.message;
        store.toast(e.message);
      } finally {
        ev.target.value = "";
      }
    }
    async function einspielen() {
      const p = vorschau.value;
      if (!p || p.fehler.length) return;
      const anzahl = p.anlegen.length + p.umbenennen.length + p.umhaengen.length;
      if (!anzahl) {
        store.toast(t("nichts zu tun"));
        return;
      }
      const ok = await dialog.confirm({
        title: t("Struktur einspielen"),
        text: t("{0} unter {1}. Gelöscht wird nichts.", [planText(p, t), wurzelZeile.value?.label ?? ""]),
        list: [...p.anlegen.slice(0, 20).map((a) => "+ " + a.pfad), ...p.umbenennen.slice(0, 20).map((u) => `${u.von} → ${u.auf}`)],
        ok: t("Einspielen")
      });
      if (!ok) return;
      busy.value = t("spiele ein …");
      try {
        const r = await api.batchChunked(befehle(p, store.model?.masterLocale ?? "de"), { label: t("Struktur") });
        if (r.error) throw new Error(r.error.message);
        await tree.load(true);
        vorschau.value = null;
        dateiName.value = "";
        busy.value = "";
        store.toast(t("⇩ {0} eingespielt", [planText(p, t)]), "ok");
      } catch (e) {
        busy.value = "✗ " + e.message;
        store.toast(e.message);
      }
    }
    __expose({ wurzel, tabelle, vorschau, bauen, einspielen });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createElementVNode("div", _hoisted_2, [
          createElementVNode(
            "h1",
            null,
            toDisplayString(_ctx.$t("⊞ Struktur")),
            1
            /* TEXT */
          ),
          _cache[3] || (_cache[3] = createElementVNode(
            "span",
            { class: "grow" },
            null,
            -1
            /* CACHED */
          )),
          createElementVNode(
            "span",
            {
              class: normalizeClass(String(busy.value ?? "").startsWith("✗") ? "fehler" : "muted")
            },
            toDisplayString(busy.value),
            3
            /* TEXT, CLASS */
          )
        ]),
        createElementVNode("table", _hoisted_3, [
          _cache[5] || (_cache[5] = createElementVNode(
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
            createElementVNode("tr", _hoisted_4, [
              createElementVNode(
                "td",
                _hoisted_5,
                toDisplayString(_ctx.$t("1 · Wo")),
                1
                /* TEXT */
              )
            ]),
            createElementVNode("tr", null, [
              createElementVNode(
                "td",
                _hoisted_6,
                toDisplayString(_ctx.$t("Knoten")),
                1
                /* TEXT */
              ),
              createElementVNode("td", null, [
                createElementVNode("div", _hoisted_7, [
                  wurzelZeile.value ? (openBlock(), createElementBlock(
                    "span",
                    _hoisted_8,
                    toDisplayString(unref(icon)(wurzelZeile.value.role)) + " " + toDisplayString(wurzelZeile.value.label),
                    1
                    /* TEXT */
                  )) : (openBlock(), createElementBlock(
                    "span",
                    _hoisted_9,
                    toDisplayString(_ctx.$t("Knoten anhaken — die Struktur darunter")),
                    1
                    /* TEXT */
                  ))
                ]),
                createVNode(unref(TreePicker), {
                  modelValue: wurzel.value,
                  "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => wurzel.value = $event),
                  height: 200
                }, null, 8, ["modelValue"])
              ])
            ]),
            createElementVNode("tr", _hoisted_10, [
              createElementVNode(
                "td",
                _hoisted_11,
                toDisplayString(_ctx.$t("2 · Heraus")),
                1
                /* TEXT */
              )
            ]),
            createElementVNode("tr", null, [
              _cache[4] || (_cache[4] = createElementVNode(
                "td",
                { class: "attr" },
                null,
                -1
                /* CACHED */
              )),
              createElementVNode("td", null, [
                createElementVNode("div", _hoisted_12, [
                  createElementVNode(
                    "button",
                    { onClick: bauen },
                    toDisplayString(_ctx.$t("Vorschau")),
                    1
                    /* TEXT */
                  ),
                  createElementVNode(
                    "button",
                    {
                      class: "primary",
                      onClick: _cache[1] || (_cache[1] = ($event) => herunterladen("excel"))
                    },
                    toDisplayString(_ctx.$t("⇪ Excel")),
                    1
                    /* TEXT */
                  ),
                  createElementVNode(
                    "button",
                    {
                      onClick: _cache[2] || (_cache[2] = ($event) => herunterladen("csv"))
                    },
                    toDisplayString(_ctx.$t("⇪ CSV")),
                    1
                    /* TEXT */
                  ),
                  createElementVNode(
                    "span",
                    _hoisted_13,
                    toDisplayString(_ctx.$t("eine Spalte je Ebene, eine Zeile je Gruppe")),
                    1
                    /* TEXT */
                  )
                ])
              ])
            ]),
            createElementVNode("tr", _hoisted_14, [
              createElementVNode(
                "td",
                _hoisted_15,
                toDisplayString(_ctx.$t("3 · Hinein")),
                1
                /* TEXT */
              )
            ]),
            createElementVNode("tr", null, [
              createElementVNode(
                "td",
                _hoisted_16,
                toDisplayString(_ctx.$t("Datei")),
                1
                /* TEXT */
              ),
              createElementVNode("td", null, [
                createElementVNode("div", _hoisted_17, [
                  createElementVNode(
                    "input",
                    {
                      type: "file",
                      accept: ".xlsx,.xlsm,.csv,.tsv,.txt",
                      onChange: datei
                    },
                    null,
                    32
                    /* NEED_HYDRATION */
                  ),
                  dateiName.value ? (openBlock(), createElementBlock(
                    "span",
                    _hoisted_18,
                    toDisplayString(dateiName.value),
                    1
                    /* TEXT */
                  )) : createCommentVNode("v-if", true)
                ])
              ])
            ]),
            vorschau.value ? (openBlock(), createElementBlock("tr", _hoisted_19, [
              createElementVNode(
                "td",
                _hoisted_20,
                toDisplayString(_ctx.$t("Plan")),
                1
                /* TEXT */
              ),
              createElementVNode("td", null, [
                vorschau.value.fehler.length ? (openBlock(), createElementBlock(
                  "p",
                  _hoisted_21,
                  toDisplayString(vorschau.value.fehler.slice(0, 5).join(" · ")),
                  1
                  /* TEXT */
                )) : (openBlock(), createElementBlock(
                  Fragment,
                  { key: 1 },
                  [
                    createElementVNode(
                      "p",
                      null,
                      toDisplayString(unref(planText)(vorschau.value, _ctx.$t)),
                      1
                      /* TEXT */
                    ),
                    createElementVNode(
                      "button",
                      {
                        class: "primary",
                        "data-demo": "aus",
                        onClick: einspielen
                      },
                      toDisplayString(_ctx.$t("⇩ Einspielen")),
                      1
                      /* TEXT */
                    )
                  ],
                  64
                  /* STABLE_FRAGMENT */
                ))
              ])
            ])) : createCommentVNode("v-if", true)
          ])
        ]),
        createElementVNode(
          "div",
          _hoisted_22,
          toDisplayString(_ctx.$t("4 · Vorschau")),
          1
          /* TEXT */
        ),
        createElementVNode("div", _hoisted_23, [
          tabelle.value ? (openBlock(), createElementBlock("table", _hoisted_24, [
            createElementVNode("thead", null, [
              createElementVNode("tr", null, [
                (openBlock(true), createElementBlock(
                  Fragment,
                  null,
                  renderList(tabelle.value.columns, (c) => {
                    return openBlock(), createElementBlock(
                      "th",
                      {
                        key: c.key
                      },
                      toDisplayString(c.key),
                      1
                      /* TEXT */
                    );
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
                renderList(tabelle.value.rows.slice(0, 200), (r, i) => {
                  return openBlock(), createElementBlock("tr", { key: i }, [
                    (openBlock(true), createElementBlock(
                      Fragment,
                      null,
                      renderList(r, (v, j) => {
                        return openBlock(), createElementBlock(
                          "td",
                          {
                            key: j,
                            class: normalizeClass({ muted: j === 0 })
                          },
                          toDisplayString(v),
                          3
                          /* TEXT, CLASS */
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
          !tabelle.value ? (openBlock(), createElementBlock(
            "div",
            _hoisted_25,
            toDisplayString(_ctx.$t("Knoten wählen, dann Vorschau oder herunterladen.")),
            1
            /* TEXT */
          )) : createCommentVNode("v-if", true)
        ])
      ]);
    };
  }
};
const roles = ["group", "product"];
const datenRoles = ["product"];
const entry = {
  views: [
    { path: "import", topic: "import", order: 10, needs: "csv", label: t("CSV-Import"), icon: "⊞", hint: t("CSV und TSV — mit Datenmapper"), component: ImportView, props: { nur: [".csv", ".tsv", ".txt"], plugin: "csv" } },
    { path: "import-xlsx", topic: "import", order: 11, needs: "excel", label: t("Excel-Import"), icon: "⊞", hint: t("Arbeitsmappen (.xlsx) — mit Datenmapper"), component: ImportView, props: { nur: [".xlsx", ".xlsm"], plugin: "excel" } },
    { path: "import-paste", topic: "import", order: 90, label: t("Zwischenablage"), icon: "⎘", hint: t("aus Excel kopieren und hier einfügen — erste Zeile sind die Spaltennamen"), component: ImportView, props: { paste: true } },
    { path: "export", topic: "export", order: 10, needs: "csv", label: t("CSV-Export"), icon: "⊞", hint: t("CSV (; UTF-8) — die Form, die der CSV-Import liest"), component: ExportView, props: { festesFormat: "csv", plugin: "csv" } },
    { path: "export-xlsx", topic: "export", order: 11, needs: "excel", label: t("Excel-Export"), icon: "⊞", hint: t("Arbeitsmappe (.xlsx) — die Form, die der Excel-Import liest"), component: ExportView, props: { festesFormat: "excel", plugin: "excel" } },
    { path: "struktur", topic: "export", order: 20, label: t("Struktur"), icon: "⑂", hint: t("den Baum als Tabelle heraus, in Excel entwerfen, in einem Zug hinein — ohne Inhalte"), component: _sfc_main }
  ],
  // Excel am Knoten
  nodeActions: [
    { topic: "export", roles: datenRoles, icon: "⇪", label: (r, below) => t("Excel: Vorlage für {0}", [below]), run: (id) => nodeWorkbook(id, false).catch((e) => store.toast(e.message)) },
    { topic: "export", roles: datenRoles, icon: "⇪", label: (r, below) => `Excel: ${below} exportieren`, run: (id) => nodeWorkbook(id, true).catch((e) => store.toast(e.message)) },
    { topic: "export", roles: ["group"], icon: "⑂", label: t("Struktur: Baum als Tabelle …"), run: (id, ctx) => ctx.go(`/p/table/struktur?node=${encodeURIComponent(id)}`) },
    // Je Format ein Eintrag: die Ansicht dahinter hat das Format fest, ein gemeinsamer Eintrag traf immer CSV
    // und liess Excel unerreichbar (28.09.2026). Der Eintrag erscheint nur, solange sein Format-Plugin wirkt
    { topic: "export", roles, icon: "⊞", label: () => plugins.enabled("excel") ? t("Excel: Teilbaum exportieren …") : null, run: (id, ctx) => {
      localStorage.setItem("journali.export.root", id);
      ctx.go(`/p/table/export-xlsx?node=${encodeURIComponent(id)}`);
    } },
    { topic: "export", roles, icon: "⊞", label: () => plugins.enabled("csv") ? t("CSV: Teilbaum exportieren …") : null, run: (id, ctx) => {
      localStorage.setItem("journali.export.root", id);
      ctx.go(`/p/table/export?node=${encodeURIComponent(id)}`);
    } },
    { topic: "import", roles: datenRoles, icon: "⇩", label: (r, below) => `Excel: ${below} importieren …`, run: (id, ctx) => ctx.go(`/p/table/import?node=${encodeURIComponent(id)}`) }
  ],
  tableExport
  // für andere Plugins: ctx.use('table').tableExport — build, toCsv, toJson, toJsonTree, toXlsx, download, nodeWorkbook
};
export {
  entry as default
};
