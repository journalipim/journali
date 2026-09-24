(function(){const s=document.createElement('style');s.textContent="\n/* Zuordnung als Zeilen: feste Mindestbreite, im schmalen Fenster nach rechts scrollen statt Felder quetschen */\n.section[data-v-19509d11] { overflow-x: auto;\n}\ntable.map[data-v-19509d11] { min-width: 960px;\n}\n/* Zuordnung als Spalten (wie Excel): erste Spalte klebt, jede Dateispalte 200 px */\n.colsWrap[data-v-19509d11] { overflow-x: auto;\n}\ntable.cols[data-v-19509d11] { border-collapse: separate; border-spacing: 0;\n}\ntable.cols th.stick[data-v-19509d11] { position: sticky; left: 0; background: var(--pane); z-index: 1; width: 70px; min-width: 70px; border-right: 1px solid var(--line); box-shadow: 4px 0 6px -4px rgba(0,0,0,.5); text-align: left; color: var(--muted); font-weight: 600; font-size: 11px; vertical-align: top;\n}\ntable.cols td[data-v-19509d11] { min-width: 200px; max-width: 200px; vertical-align: top; overflow: hidden; text-overflow: ellipsis;\n}\ntable.cols td.off[data-v-19509d11] { opacity: .5;\n}\ntable.cols tr.sample td[data-v-19509d11] { white-space: nowrap; font-size: 12px;\n}\n.layout button[data-v-19509d11] { border: 1px solid var(--line); background: none; color: var(--muted); padding: 1px 8px; font-size: 11px; font-weight: 400;\n}\n.layout button.on[data-v-19509d11] { background: var(--accent-soft); color: var(--text); border-color: var(--accent);\n}\n/* Umwandlung je Spalte (ƒ): Kette unter der Zeile */\n.steps-row td[data-v-19509d11] { background: var(--bg); padding: 4px 8px 6px 30px;\n}\n.tsteps[data-v-19509d11] { display: flex; flex-direction: column; gap: 3px;\n}\n.tstep[data-v-19509d11] { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; font-size: 12px;\n}\n.tstep select[data-v-19509d11], .tstep input[type=text][data-v-19509d11] { font-size: 12px;\n}\n.fld[data-v-19509d11] { display: inline-flex; gap: 4px; align-items: center; font-size: 11px;\n}\n/* Vorschau: Reiter neu / geändert / unverändert; Werte alt → neu */\n/* Reiter, die wie Reiter aussehen */\n.tabs[data-v-19509d11] { display: inline-flex; gap: 0; margin-left: 8px;\n}\n.tabs button[data-v-19509d11] { border: 1px solid var(--line); background: var(--bg); padding: 2px 12px; font-size: 12px; font-weight: 600; cursor: pointer; border-radius: 0;\n}\n.tabs button[data-v-19509d11]:first-child { border-radius: 6px 0 0 6px;\n}\n.tabs button[data-v-19509d11]:last-child { border-radius: 0 6px 6px 0;\n}\n.tabs button[data-v-19509d11]:hover { background: var(--hover);\n}\n.tabs button.on[data-v-19509d11] { background: var(--accent); color: #fff !important; border-color: var(--accent);\n}\ntable.diff td[data-v-19509d11] { font-size: 12px; white-space: normal;\n}\ntable.diff td.old[data-v-19509d11] { color: var(--muted); text-decoration: line-through; max-width: 300px;\n}\ntable.diff td.new[data-v-19509d11] { color: var(--pos); max-width: 300px;\n}      /* neuer Wert (vorher keiner) */\ntable.diff td.chg[data-v-19509d11] { color: var(--warn); max-width: 300px;\n}      /* geänderter Wert */\n/* ƒ leuchtet, wenn eine Umwandlung hinterlegt ist */\n.x.on[data-v-19509d11] { background: var(--accent); color: #fff; font-weight: 700; border-radius: 4px; padding: 0 6px;\n}\n.section[data-v-19509d11] { padding: 8px; border-bottom: 1px solid var(--line);\n}\n.section h2[data-v-19509d11] { font-size: 12px; margin: 0 0 6px; font-weight: 600;\n}\n.section h2 .muted[data-v-19509d11] { font-weight: 400;\n}\n.drop.over[data-v-19509d11] { outline: 2px dashed var(--accent); outline-offset: -2px;\n}\n/* ohne Datei ein grosser Ablagebereich */\n.drop.empty[data-v-19509d11] { min-height: 84px; border: 2px dashed var(--line); border-radius: 6px; margin: 4px 0; flex-wrap: wrap;\n}\n.recent[data-v-19509d11] { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; white-space: normal;\n}\n.recent .chip[data-v-19509d11] { cursor: pointer;\n}\n.recent .chip.dim[data-v-19509d11] { opacity: .55; cursor: default;\n}\n.btn[data-v-19509d11] { display: inline-block; padding: 2px 10px; border-radius: 6px; cursor: pointer;\n}\n.map td[data-v-19509d11] { vertical-align: top; padding: 3px 4px;\n}\n.map tr.off td[data-v-19509d11] { opacity: .5;\n}\n.samples[data-v-19509d11] { font-size: 11px; white-space: normal; max-width: 260px;\n}\n.stats[data-v-19509d11] { font-size: 13px;\n}\n.out[data-v-19509d11] { font-size: 11px; max-height: 400px; overflow: auto; background: var(--bg); padding: 6px; border-radius: 6px;\n}\n.picker[data-v-19509d11] { max-height: 240px; overflow: auto; border: 1px solid var(--line); border-radius: 6px; background: var(--pane); margin-top: 4px;\n}\n.pick[data-v-19509d11] { display: flex; align-items: center; gap: 8px; height: 24px; padding: 0 8px; white-space: nowrap; cursor: pointer;\n}\n.pick[data-v-19509d11]:hover { background: var(--hover);\n}\n\n.form[data-v-5d82639d] { width: 100%; border-bottom: 1px solid var(--line);\n}\n.form td[data-v-5d82639d] { height: 30px; vertical-align: middle; white-space: normal; padding: 2px 4px;\n}\n.form td.attr[data-v-5d82639d] { color: var(--muted); white-space: nowrap; padding-left: 8px;\n}\n.row[data-v-5d82639d] { display: flex; gap: 6px; align-items: center;\n}\n.row > input[data-v-5d82639d] { flex: 1; min-width: 0;\n}\n.tab[data-v-5d82639d] { padding: 2px 10px; border-radius: 4px; color: var(--muted); text-decoration: none; font-size: 13px;\n}\n.tab.on[data-v-5d82639d], .tab.router-link-active[data-v-5d82639d] { background: var(--accent-soft); color: var(--text);\n}\n";document.head.append(s)})();
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
const t = h.t;
const L$1 = h.L;
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
const _hoisted_1$1 = { class: "attr" };
const _hoisted_2$1 = ["title"];
const _hoisted_3$1 = ["title"];
const _hoisted_4$1 = ["title"];
const _hoisted_5$1 = { class: "muted" };
const _hoisted_6$1 = ["title"];
const _hoisted_7$1 = ["value", "title"];
const _hoisted_8$1 = ["value"];
const _hoisted_9$1 = {
  key: 3,
  class: "muted",
  style: { "font-size": "12px" }
};
const _hoisted_10$1 = { key: 0 };
const _hoisted_11$1 = {
  class: "attr muted",
  style: { "font-size": "11px" }
};
const _hoisted_12$1 = ["title"];
const _hoisted_13$1 = ["title", "onClick"];
const _hoisted_14$1 = ["onClick", "title"];
const _hoisted_15$1 = { class: "step" };
const _hoisted_16$1 = { colspan: "2" };
const _hoisted_17$1 = {
  class: "muted",
  style: { "font-weight": "400" }
};
const _hoisted_18$1 = { key: 1 };
const _hoisted_19$1 = { class: "attr" };
const _hoisted_20$1 = { class: "row" };
const _hoisted_21$1 = { class: "muted" };
const _hoisted_22$1 = ["title"];
const _hoisted_23$1 = { key: 2 };
const _hoisted_24$1 = { class: "attr" };
const _hoisted_25$1 = { class: "muted" };
const _hoisted_26$1 = { key: 3 };
const _hoisted_27$1 = {
  class: "warn",
  style: { "font-size": "12px" }
};
const _hoisted_28$1 = { key: 4 };
const _hoisted_29$1 = { class: "attr" };
const _hoisted_30$1 = {
  class: "row",
  style: { "margin-bottom": "4px" }
};
const _hoisted_31$1 = ["title"];
const _hoisted_32$1 = ["title"];
const _hoisted_33$1 = {
  key: 1,
  class: "muted"
};
const _hoisted_34$1 = { key: 5 };
const _hoisted_35$1 = { class: "attr" };
const _hoisted_36 = ["title"];
const _hoisted_37 = { value: "" };
const _hoisted_38 = { value: "group" };
const _hoisted_39 = { value: "product" };
const _hoisted_40 = { value: "variant" };
const _hoisted_41 = { key: 6 };
const _hoisted_42 = { class: "attr" };
const _hoisted_43 = ["placeholder"];
const _hoisted_44 = { class: "scroll" };
const _hoisted_45 = {
  key: 0,
  class: "muted",
  style: { "font-size": "12px", "padding": "6px 8px" }
};
const _hoisted_46 = {
  key: 1,
  class: "warn",
  style: { "font-size": "12px", "padding": "6px 8px" }
};
const _hoisted_47 = {
  key: 2,
  class: "warn",
  style: { "font-size": "12px", "padding": "6px 8px" }
};
const _hoisted_48 = {
  key: 3,
  class: "section"
};
const _hoisted_49 = {
  class: "step-band",
  style: { "margin": "0 -8px 6px" }
};
const _hoisted_50 = { class: "muted" };
const _hoisted_51 = ["title"];
const _hoisted_52 = ["title"];
const _hoisted_53 = { class: "layout" };
const _hoisted_54 = ["title"];
const _hoisted_55 = ["title"];
const _hoisted_56 = {
  key: 0,
  class: "colsWrap"
};
const _hoisted_57 = { class: "grid cols" };
const _hoisted_58 = { class: "stick" };
const _hoisted_59 = ["title"];
const _hoisted_60 = {
  class: "muted",
  style: { "font-size": "11px" }
};
const _hoisted_61 = { class: "stick" };
const _hoisted_62 = ["onUpdate:modelValue", "onChange"];
const _hoisted_63 = ["value"];
const _hoisted_64 = { class: "stick" };
const _hoisted_65 = ["onUpdate:modelValue", "onChange"];
const _hoisted_66 = ["value"];
const _hoisted_67 = {
  key: 1,
  style: { "display": "flex", "flex-direction": "column", "gap": "3px" }
};
const _hoisted_68 = ["onUpdate:modelValue", "placeholder"];
const _hoisted_69 = ["onUpdate:modelValue"];
const _hoisted_70 = ["value"];
const _hoisted_71 = ["onUpdate:modelValue", "title"];
const _hoisted_72 = { value: void 0 };
const _hoisted_73 = ["value"];
const _hoisted_74 = {
  key: 2,
  class: "muted"
};
const _hoisted_75 = { class: "stick" };
const _hoisted_76 = ["onUpdate:modelValue"];
const _hoisted_77 = ["value"];
const _hoisted_78 = {
  key: 1,
  class: "muted"
};
const _hoisted_79 = ["title", "onClick"];
const _hoisted_80 = {
  key: 0,
  class: "muted",
  style: { "font-size": "11px", "margin-left": "4px" }
};
const _hoisted_81 = { class: "stick" };
const _hoisted_82 = { class: "stick muted" };
const _hoisted_83 = ["title"];
const _hoisted_84 = {
  key: 1,
  class: "tsteps",
  style: { "margin-top": "6px", "padding": "6px 8px", "background": "var(--bg)", "border-radius": "6px" }
};
const _hoisted_85 = {
  class: "muted",
  style: { "font-size": "12px" }
};
const _hoisted_86 = {
  key: 0,
  class: "tstep",
  style: { "flex-wrap": "wrap", "gap": "4px 14px" }
};
const _hoisted_87 = {
  class: "muted",
  style: { "font-size": "12px", "width": "100%" }
};
const _hoisted_88 = { key: 0 };
const _hoisted_89 = ["value", "onChange"];
const _hoisted_90 = ["value"];
const _hoisted_91 = {
  class: "muted mono",
  style: { "width": "18px" }
};
const _hoisted_92 = ["onUpdate:modelValue", "title"];
const _hoisted_93 = ["value"];
const _hoisted_94 = ["title"];
const _hoisted_95 = ["onUpdate:modelValue"];
const _hoisted_96 = {
  key: 1,
  class: "fld"
};
const _hoisted_97 = { class: "muted" };
const _hoisted_98 = ["onUpdate:modelValue"];
const _hoisted_99 = { value: "empty" };
const _hoisted_100 = { value: "equals" };
const _hoisted_101 = { value: "contains" };
const _hoisted_102 = { value: "matches" };
const _hoisted_103 = {
  key: 2,
  class: "fld"
};
const _hoisted_104 = { class: "muted" };
const _hoisted_105 = ["onUpdate:modelValue"];
const _hoisted_106 = { value: void 0 };
const _hoisted_107 = { value: "," };
const _hoisted_108 = { value: "." };
const _hoisted_109 = {
  key: 3,
  class: "fld"
};
const _hoisted_110 = { class: "muted" };
const _hoisted_111 = ["onUpdate:modelValue"];
const _hoisted_112 = ["value"];
const _hoisted_113 = {
  key: 4,
  class: "fld"
};
const _hoisted_114 = { class: "muted" };
const _hoisted_115 = ["onUpdate:modelValue", "placeholder", "title"];
const _hoisted_116 = ["title", "onChange"];
const _hoisted_117 = { value: "" };
const _hoisted_118 = { value: "{}" };
const _hoisted_119 = ["value"];
const _hoisted_120 = ["onClick"];
const _hoisted_121 = ["onClick"];
const _hoisted_122 = ["onClick"];
const _hoisted_123 = { class: "tstep" };
const _hoisted_124 = ["onChange"];
const _hoisted_125 = { value: "" };
const _hoisted_126 = ["value", "title"];
const _hoisted_127 = {
  class: "muted",
  style: { "font-size": "11px" }
};
const _hoisted_128 = {
  key: 2,
  class: "grid map"
};
const _hoisted_129 = { style: { "width": "170px" } };
const _hoisted_130 = { style: { "width": "130px" } };
const _hoisted_131 = { style: { "width": "220px" } };
const _hoisted_132 = { style: { "width": "60px" } };
const _hoisted_133 = { style: { "width": "150px" } };
const _hoisted_134 = ["title"];
const _hoisted_135 = ["title"];
const _hoisted_136 = {
  class: "muted",
  style: { "font-size": "11px" }
};
const _hoisted_137 = { class: "muted samples" };
const _hoisted_138 = ["onUpdate:modelValue", "onChange"];
const _hoisted_139 = ["value"];
const _hoisted_140 = ["onUpdate:modelValue", "onChange"];
const _hoisted_141 = ["value"];
const _hoisted_142 = {
  key: 1,
  style: { "display": "flex", "gap": "4px", "flex-wrap": "wrap" }
};
const _hoisted_143 = ["onUpdate:modelValue", "placeholder"];
const _hoisted_144 = ["onUpdate:modelValue"];
const _hoisted_145 = ["value"];
const _hoisted_146 = ["onUpdate:modelValue", "title"];
const _hoisted_147 = { value: void 0 };
const _hoisted_148 = ["value"];
const _hoisted_149 = {
  key: 2,
  class: "muted"
};
const _hoisted_150 = ["onUpdate:modelValue"];
const _hoisted_151 = ["value"];
const _hoisted_152 = {
  class: "muted",
  style: { "font-size": "11px" }
};
const _hoisted_153 = ["title", "onClick"];
const _hoisted_154 = {
  key: 0,
  class: "steps-row"
};
const _hoisted_155 = { colspan: "7" };
const _hoisted_156 = { class: "tsteps" };
const _hoisted_157 = {
  key: 0,
  class: "tstep",
  style: { "flex-wrap": "wrap", "gap": "4px 14px" }
};
const _hoisted_158 = {
  class: "muted",
  style: { "font-size": "12px", "width": "100%" }
};
const _hoisted_159 = { key: 0 };
const _hoisted_160 = ["value", "onChange"];
const _hoisted_161 = ["value"];
const _hoisted_162 = {
  class: "muted mono",
  style: { "width": "18px" }
};
const _hoisted_163 = ["onUpdate:modelValue", "title"];
const _hoisted_164 = ["value"];
const _hoisted_165 = ["title"];
const _hoisted_166 = ["onUpdate:modelValue"];
const _hoisted_167 = {
  key: 1,
  class: "fld"
};
const _hoisted_168 = { class: "muted" };
const _hoisted_169 = ["onUpdate:modelValue"];
const _hoisted_170 = { value: "empty" };
const _hoisted_171 = { value: "equals" };
const _hoisted_172 = { value: "contains" };
const _hoisted_173 = { value: "matches" };
const _hoisted_174 = {
  key: 2,
  class: "fld"
};
const _hoisted_175 = { class: "muted" };
const _hoisted_176 = ["onUpdate:modelValue"];
const _hoisted_177 = { value: void 0 };
const _hoisted_178 = { value: "," };
const _hoisted_179 = { value: "." };
const _hoisted_180 = {
  key: 3,
  class: "fld"
};
const _hoisted_181 = { class: "muted" };
const _hoisted_182 = ["onUpdate:modelValue"];
const _hoisted_183 = ["value"];
const _hoisted_184 = {
  key: 4,
  class: "fld"
};
const _hoisted_185 = { class: "muted" };
const _hoisted_186 = ["onUpdate:modelValue", "placeholder", "title"];
const _hoisted_187 = ["title", "onChange"];
const _hoisted_188 = { value: "" };
const _hoisted_189 = { value: "{}" };
const _hoisted_190 = ["value"];
const _hoisted_191 = {
  class: "muted",
  style: { "font-size": "11px" }
};
const _hoisted_192 = ["onClick", "title"];
const _hoisted_193 = ["onClick", "title"];
const _hoisted_194 = ["onClick", "title"];
const _hoisted_195 = { class: "tstep" };
const _hoisted_196 = ["onChange"];
const _hoisted_197 = { value: "" };
const _hoisted_198 = ["value", "title"];
const _hoisted_199 = {
  class: "muted",
  style: { "font-size": "11px" }
};
const _hoisted_200 = {
  class: "pane",
  style: { "flex": "1" }
};
const _hoisted_201 = { class: "toolbar" };
const _hoisted_202 = ["disabled"];
const _hoisted_203 = ["disabled", "title"];
const _hoisted_204 = { class: "muted" };
const _hoisted_205 = {
  class: "scroll",
  style: { "padding": "8px" }
};
const _hoisted_206 = {
  key: 0,
  class: "stats"
};
const _hoisted_207 = { class: "muted" };
const _hoisted_208 = ["title"];
const _hoisted_209 = { key: 1 };
const _hoisted_210 = { class: "warn" };
const _hoisted_211 = {
  key: 2,
  class: "muted",
  style: { "margin-top": "6px", "white-space": "pre-wrap", "font-size": "12px" }
};
const _hoisted_212 = {
  key: 3,
  class: "neg",
  style: { "margin-top": "6px", "white-space": "pre-wrap" }
};
const _hoisted_213 = { key: 0 };
const _hoisted_214 = {
  key: 4,
  class: "warn",
  style: { "margin-top": "6px" }
};
const _hoisted_215 = {
  key: 5,
  class: "section",
  style: { "margin-top": "8px", "padding": "0" }
};
const _hoisted_216 = {
  class: "step-band",
  style: { "margin": "0 0 4px" }
};
const _hoisted_217 = { class: "muted" };
const _hoisted_218 = {
  class: "grid",
  style: { "width": "100%", "table-layout": "fixed" }
};
const _hoisted_219 = { style: { "width": "50px" } };
const _hoisted_220 = { style: { "width": "150px" } };
const _hoisted_221 = ["title"];
const _hoisted_222 = { style: { "width": "260px" } };
const _hoisted_223 = { class: "mono muted" };
const _hoisted_224 = ["title"];
const _hoisted_225 = ["title"];
const _hoisted_226 = { class: "muted" };
const _hoisted_227 = ["title"];
const _hoisted_228 = ["value", "title", "onChange"];
const _hoisted_229 = {
  key: 1,
  class: "muted"
};
const _hoisted_230 = {
  key: 6,
  class: "section",
  style: { "margin-top": "8px", "padding": "0" }
};
const _hoisted_231 = {
  class: "step-band",
  style: { "margin": "0 0 4px", "gap": "4px" }
};
const _hoisted_232 = { class: "tabs" };
const _hoisted_233 = {
  class: "grid",
  style: { "width": "100%" }
};
const _hoisted_234 = ["onClick"];
const _hoisted_235 = {
  style: { "width": "20px" },
  class: "muted"
};
const _hoisted_236 = {
  class: "mono muted",
  style: { "width": "50px" }
};
const _hoisted_237 = { key: 0 };
const _hoisted_238 = ["href", "title"];
const _hoisted_239 = { key: 1 };
const _hoisted_240 = {
  class: "muted",
  style: { "text-align": "right", "white-space": "nowrap" }
};
const _hoisted_241 = { key: 0 };
const _hoisted_242 = { colspan: "3" };
const _hoisted_243 = { class: "grid diff" };
const _hoisted_244 = { class: "attr muted" };
const _hoisted_245 = {
  key: 0,
  class: "muted"
};
const _hoisted_246 = ["title"];
const _hoisted_247 = {
  class: "muted",
  style: { "width": "20px" }
};
const _hoisted_248 = ["title"];
const _hoisted_249 = { key: 0 };
const _hoisted_250 = {
  colspan: "4",
  class: "muted",
  style: { "padding": "8px" }
};
const _hoisted_251 = { style: { "margin-top": "8px" } };
const _hoisted_252 = { class: "muted" };
const _hoisted_253 = { class: "out" };
const _hoisted_254 = {
  key: 1,
  class: "muted"
};
const _hoisted_255 = {
  key: 2,
  class: "empty"
};
const _hoisted_256 = {
  class: "muted",
  style: { "font-size": "12px" }
};
const _hoisted_257 = {
  key: 3,
  class: "pos",
  style: { "margin-top": "8px" }
};
const _hoisted_258 = {
  key: 4,
  class: "section"
};
const _hoisted_259 = {
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
          store.toast(t("{0}: neu gelesen", [source.value?.name]), "ok");
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
        } else throw new Error(t("Kein Importer für {0} — Plugin für dieses Format einschalten (⌁ Plugins)", [file.name]));
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
      if (!target.value && !mapping.value.some((m2) => m2.target === "parent") && !(idLocked.value && unknownIds.value === 0)) {
        store.toast(idLocked.value ? t("Ziel wählen — {0} Zeilen haben Ids, die der Baum nicht kennt (neu)", [unknownIds.value]) : t("Ziel wählen (Gruppe oder Produkt) — oder eine Spalte „Elternteil“"));
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
        const parents = /* @__PURE__ */ new Map();
        for (const row of source.value.rows) {
          const id = String(row[iId] ?? "").trim(), ext = String(row[iExt] ?? "").trim();
          const viaKey = keyCols.map((i) => byKey.get(mapping.value[i].attribute + "" + String(row[i] ?? "").trim())).find(Boolean);
          const n = iId >= 0 && id && tree.byId.get(id) || iExt >= 0 && ext && byExt.get(ext) || viaKey || null;
          if (n) {
            const key = n.parent ?? "#root";
            if (!parents.has(key)) parents.set(key, /* @__PURE__ */ new Set());
            parents.get(key).add(n.id);
          }
        }
        let done = 0;
        for (const [pid, ids] of parents) for (const loc of locs) {
          busy.value = t("vergleiche mit dem Bestand … {0}/{1}", [++done, parents.size * locs.length]);
          const url = pid === "#root" ? null : `/api/nodes/${encodeURIComponent(pid)}/table?attributes=${encodeURIComponent(keys.join(","))}${loc ? "&locale=" + loc : ""}`;
          const t$1 = url ? await api.get(url) : { rows: [] };
          for (const r of t$1.rows) {
            if (!ids.has(r.row.id)) continue;
            const cur = existing.get(r.row.id) ?? {};
            for (const [k, v] of Object.entries(r.values)) if (v.value != null) {
              cur[`${k}|${loc}`] = v.value;
              cur[`${k}|${loc}#own`] = v.own;
            }
            existing.set(r.row.id, cur);
          }
          if (pid === "#root") for (const id of ids) {
            const t2 = await api.get(`/api/nodes/${encodeURIComponent(id)}/table?self=true&attributes=${encodeURIComponent(keys.join(","))}${loc ? "&locale=" + loc : ""}`);
            for (const r of t2.rows) {
              if (r.row.id !== id) continue;
              const cur = existing.get(id) ?? {};
              for (const [k, v] of Object.entries(r.values)) if (v.value != null) {
                cur[`${k}|${loc}`] = v.value;
                cur[`${k}|${loc}#own`] = v.own;
              }
              ;
              existing.set(id, cur);
            }
          }
        }
        planned.value = makePlan({ columns: source.value.columns, rows: source.value.rows, mapping: mapping.value.map((m2) => ({ ...m2 })), model: model.value, tree, target: target.value, role: role.value || null, existing, external: external.value || null });
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
                    createElementVNode(
                      "td",
                      _hoisted_1$1,
                      toDisplayString(_ctx.$t("Datei")),
                      1
                      /* TEXT */
                    ),
                    createElementVNode("td", {
                      class: normalizeClass(["row drop", { over: dragOver.value, empty: !source.value }]),
                      title: source.value ? "" : _ctx.$t("Datei hierher ziehen — oder aus Excel kopieren und hier Strg+V (erste Zeile = Spaltennamen)"),
                      onDragover: _cache[2] || (_cache[2] = withModifiers(($event) => dragOver.value = true, ["prevent"])),
                      onDragleave: _cache[3] || (_cache[3] = ($event) => dragOver.value = false),
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
                            onChange: _cache[0] || (_cache[0] = ($event) => {
                              fileHandle.value = null;
                              takeFile($event.target.files[0]);
                            })
                          },
                          null,
                          32
                          /* NEED_HYDRATION */
                        )
                      ], 8, _hoisted_3$1),
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
                          _hoisted_5$1,
                          toDisplayString(source.value.rows.length),
                          1
                          /* TEXT */
                        )
                      ], 8, _hoisted_4$1)) : createCommentVNode("v-if", true),
                      source.value ? (openBlock(), createElementBlock("button", {
                        key: 1,
                        class: "x",
                        onClick: reloadFile,
                        title: fileHandle.value ? _ctx.$t("Datei neu von der Platte lesen (zwischendurch in Excel geändert?)") : _ctx.$t("Datei neu wählen — dieser Browser kann Dateien nicht erneut lesen")
                      }, "↻", 8, _hoisted_6$1)) : createCommentVNode("v-if", true),
                      source.value?.sheets?.length > 1 ? (openBlock(), createElementBlock("select", {
                        key: 2,
                        value: source.value.sheet,
                        onChange: _cache[1] || (_cache[1] = ($event) => pickSheet($event.target.value)),
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
                            }, toDisplayString(s.name) + " (" + toDisplayString(s.rows.length) + ")", 9, _hoisted_8$1);
                          }),
                          128
                          /* KEYED_FRAGMENT */
                        ))
                      ], 40, _hoisted_7$1)) : !source.value ? (openBlock(), createElementBlock(
                        "span",
                        _hoisted_9$1,
                        toDisplayString(_ctx.$t("oder hierher ziehen · oder aus Excel kopieren und Strg+V")),
                        1
                        /* TEXT */
                      )) : createCommentVNode("v-if", true),
                      _cache[40] || (_cache[40] = createElementVNode(
                        "span",
                        { class: "grow" },
                        null,
                        -1
                        /* CACHED */
                      ))
                    ], 42, _hoisted_2$1)
                  ]),
                  recent.value.length ? (openBlock(), createElementBlock("tr", _hoisted_10$1, [
                    createElementVNode(
                      "td",
                      _hoisted_11$1,
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
                            }, "×", 8, _hoisted_14$1)
                          ], 10, _hoisted_13$1);
                        }),
                        128
                        /* KEYED_FRAGMENT */
                      ))
                    ], 8, _hoisted_12$1)
                  ])) : createCommentVNode("v-if", true),
                  createElementVNode("tr", _hoisted_15$1, [
                    createElementVNode("td", _hoisted_16$1, [
                      createTextVNode(
                        toDisplayString(_ctx.$t("2 · Ziel") + " "),
                        1
                        /* TEXT */
                      ),
                      createElementVNode(
                        "span",
                        _hoisted_17$1,
                        "· " + toDisplayString(fixed.value ? "fest: die Tabelle passt 1:1 zu diesem Knoten" : _ctx.$t("wohin neue Zeilen kommen; vorhandene werden über Id, SKU oder Kennung gefunden")),
                        1
                        /* TEXT */
                      )
                    ])
                  ]),
                  fixed.value ? (openBlock(), createElementBlock("tr", _hoisted_18$1, [
                    createElementVNode(
                      "td",
                      _hoisted_19$1,
                      toDisplayString(_ctx.$t("Knoten")),
                      1
                      /* TEXT */
                    ),
                    createElementVNode("td", _hoisted_20$1, [
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
                        _hoisted_21$1,
                        toDisplayString(_ctx.$t("→ {0} · {1} mögliche Spalten", [roleLabel[fixed.value.childRole], fixed.value.allowed.size])),
                        1
                        /* TEXT */
                      ),
                      _cache[41] || (_cache[41] = createElementVNode(
                        "span",
                        { class: "grow" },
                        null,
                        -1
                        /* CACHED */
                      )),
                      createElementVNode("button", {
                        class: "x",
                        onClick: _cache[4] || (_cache[4] = ($event) => unref(router).replace("/p/table/import")),
                        title: _ctx.$t("Knotenmodus verlassen — frei zuordnen")
                      }, "×", 8, _hoisted_22$1)
                    ])
                  ])) : createCommentVNode("v-if", true),
                  !fixed.value && idLocked.value && !unknownIds.value ? (openBlock(), createElementBlock("tr", _hoisted_23$1, [
                    createElementVNode(
                      "td",
                      _hoisted_24$1,
                      toDisplayString(_ctx.$t("Ziel")),
                      1
                      /* TEXT */
                    ),
                    createElementVNode(
                      "td",
                      _hoisted_25$1,
                      toDisplayString(_ctx.$t("🔒 aus der Datei — die Zeilen haben journali-Ids{0}, jede wird an ihrem Platz aktualisiert{1}", [mapping.value.some((m2) => m2.target === "root") ? " " + _ctx.$t("samt Wurzel") : "", mapping.value.some((m2) => m2.target === "parent") ? _ctx.$t("; Elternteil steht in der Datei") : ""])),
                      1
                      /* TEXT */
                    )
                  ])) : createCommentVNode("v-if", true),
                  !fixed.value && foreignRoot.value ? (openBlock(), createElementBlock("tr", _hoisted_26$1, [
                    _cache[42] || (_cache[42] = createElementVNode(
                      "td",
                      { class: "attr" },
                      null,
                      -1
                      /* CACHED */
                    )),
                    createElementVNode(
                      "td",
                      _hoisted_27$1,
                      toDisplayString(_ctx.$t("⚠ {0} Zeilen haben Ids, die es hier gibt — aber unter einer anderen Wurzel: fremde Datenbank, Zufallstreffer. Sie gelten als neu und kommen unter das Ziel.", [foreignRoot.value])),
                      1
                      /* TEXT */
                    )
                  ])) : createCommentVNode("v-if", true),
                  !fixed.value && !(idLocked.value && !unknownIds.value) ? (openBlock(), createElementBlock("tr", _hoisted_28$1, [
                    createElementVNode(
                      "td",
                      _hoisted_29$1,
                      toDisplayString(_ctx.$t("Ziel")),
                      1
                      /* TEXT */
                    ),
                    createElementVNode("td", null, [
                      createElementVNode("div", _hoisted_30$1, [
                        target.value ? (openBlock(), createElementBlock("span", {
                          key: 0,
                          class: "chip",
                          title: target.value.id + " " + _ctx.$t("— Klick: im Baum ändern"),
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
                            title: _ctx.$t("Ziel entfernen")
                          }, "×", 8, _hoisted_32$1)
                        ], 8, _hoisted_31$1)) : (openBlock(), createElementBlock(
                          "span",
                          _hoisted_33$1,
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
                  !fixed.value && !(idLocked.value && !unknownIds.value) ? (openBlock(), createElementBlock("tr", _hoisted_34$1, [
                    createElementVNode(
                      "td",
                      _hoisted_35$1,
                      toDisplayString(_ctx.$t("Neue als")),
                      1
                      /* TEXT */
                    ),
                    createElementVNode("td", null, [
                      withDirectives(createElementVNode("select", {
                        "onUpdate:modelValue": _cache[7] || (_cache[7] = ($event) => role.value = $event),
                        title: _ctx.$t("Rolle neuer Zeilen"),
                        onChange: _cache[8] || (_cache[8] = ($event) => planned.value = null),
                        style: { "width": "100%" }
                      }, [
                        createElementVNode(
                          "option",
                          _hoisted_37,
                          toDisplayString(_ctx.$t("automatisch (unter Gruppe → Produkt, unter Produkt → Variante)")),
                          1
                          /* TEXT */
                        ),
                        createElementVNode(
                          "option",
                          _hoisted_38,
                          toDisplayString(_ctx.$t("▣ Gruppen")),
                          1
                          /* TEXT */
                        ),
                        createElementVNode(
                          "option",
                          _hoisted_39,
                          toDisplayString(_ctx.$t("▦ Produkte")),
                          1
                          /* TEXT */
                        ),
                        createElementVNode(
                          "option",
                          _hoisted_40,
                          toDisplayString(_ctx.$t("◆ Varianten")),
                          1
                          /* TEXT */
                        )
                      ], 40, _hoisted_36), [
                        [vModelSelect, role.value]
                      ])
                    ])
                  ])) : createCommentVNode("v-if", true),
                  !fixed.value && !idLocked.value ? (openBlock(), createElementBlock("tr", _hoisted_41, [
                    createElementVNode(
                      "td",
                      _hoisted_42,
                      toDisplayString(_ctx.$t("Kennung")),
                      1
                      /* TEXT */
                    ),
                    createElementVNode("td", null, [
                      withDirectives(createElementVNode("input", {
                        "onUpdate:modelValue": _cache[9] || (_cache[9] = ($event) => external.value = $event),
                        type: "text",
                        placeholder: _ctx.$t("System der externen Kennung (z. B. erp) — findet vorhandene Knoten"),
                        onChange: _cache[10] || (_cache[10] = ($event) => resuggest(true))
                      }, null, 40, _hoisted_43), [
                        [vModelText, external.value]
                      ])
                    ])
                  ])) : createCommentVNode("v-if", true)
                ]),
                _: 1
                /* STABLE */
              }, 8, ["busy"]),
              createElementVNode("div", _hoisted_44, [
                !keyColumn.value && source.value ? (openBlock(), createElementBlock(
                  "div",
                  _hoisted_45,
                  toDisplayString(_ctx.$t("⚠ Keine Schlüsselspalte (Id, SKU, Kennung) — jede Zeile wird neu angelegt.")),
                  1
                  /* TEXT */
                )) : createCommentVNode("v-if", true),
                createCommentVNode(" Lücke bei ausgeblendeten Spalten: sieht aus wie unser Export, aber die Id-Spalte fehlt — in Excel entfernt oder ohne die versteckten Spalten weitergegeben "),
                source.value && mapping.value.some((m2) => m2.internal) && !mapping.value.some((m2) => m2.target === "id") ? (openBlock(), createElementBlock("div", _hoisted_46, [
                  createTextVNode(
                    toDisplayString(_ctx.$t("⚠ Das ist ein journali-Export, aber die Spalte") + " "),
                    1
                    /* TEXT */
                  ),
                  _cache[43] || (_cache[43] = createElementVNode(
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
                  _hoisted_47,
                  toDisplayString(_ctx.$t("⚠ {0} Spalten passen nicht zu diesem Knoten und werden übergangen — Vorlage per Rechtsklick am Knoten exportieren, dann stimmen die Spalten.", [unknown.value])),
                  1
                  /* TEXT */
                )) : createCommentVNode("v-if", true),
                source.value ? (openBlock(), createElementBlock("div", _hoisted_48, [
                  createElementVNode("h2", _hoisted_49, [
                    createTextVNode(
                      toDisplayString(_ctx.$t("3 · Zuordnung") + " "),
                      1
                      /* TEXT */
                    ),
                    createElementVNode(
                      "span",
                      _hoisted_50,
                      toDisplayString(_ctx.$t("· {0} von {1} Spalten", [visibleMapping.value.filter((m2) => m2.target !== "skip").length, visibleMapping.value.length])),
                      1
                      /* TEXT */
                    ),
                    idLocked.value ? (openBlock(), createElementBlock("span", {
                      key: 0,
                      class: "chip",
                      title: _ctx.$t("eigene Spalten ({0}) kommen aus der Datei und sind fest — nicht in der Zuordnung", [mapping.value.filter((m2) => m2.internal || m2.target === "id" || m2.target === "parent").map((m2) => m2.column).join(", ")])
                    }, toDisplayString(_ctx.$t("🔒 {0} eigene Spalten", [mapping.value.filter((m2) => m2.internal || m2.target === "id" || m2.target === "parent").length])), 9, _hoisted_51)) : createCommentVNode("v-if", true),
                    createElementVNode("button", {
                      class: "x",
                      onClick: _cache[11] || (_cache[11] = ($event) => resuggest()),
                      title: _ctx.$t("Zuordnung neu vorschlagen — verwirft die Zuordnung des Profils (mit gewähltem Profil wird der neue Vorschlag gespeichert)")
                    }, toDisplayString(_ctx.$t("↻ neu vorschlagen")), 9, _hoisted_52),
                    _cache[44] || (_cache[44] = createElementVNode(
                      "span",
                      { class: "grow" },
                      null,
                      -1
                      /* CACHED */
                    )),
                    createElementVNode("span", _hoisted_53, [
                      createElementVNode("button", {
                        class: normalizeClass({ on: layout.value === "rows" }),
                        onClick: _cache[12] || (_cache[12] = ($event) => setLayout("rows")),
                        title: _ctx.$t("eine Zeile je Spalte — nach unten scrollen")
                      }, toDisplayString(_ctx.$t("≡ Zeilen")), 11, _hoisted_54),
                      createElementVNode("button", {
                        class: normalizeClass({ on: layout.value === "cols" }),
                        onClick: _cache[13] || (_cache[13] = ($event) => setLayout("cols")),
                        title: _ctx.$t("wie in Excel: eine Spalte je Spalte, Zuordnung in den Kopfzeilen — nach rechts scrollen")
                      }, toDisplayString(_ctx.$t("⫼ Spalten")), 11, _hoisted_55)
                    ])
                  ]),
                  createCommentVNode(" Spalten wie in Excel: Kopfzeilen = Zuordnung, darunter die ersten Zeilen der Datei; erste Spalte klebt "),
                  layout.value === "cols" ? (openBlock(), createElementBlock("div", _hoisted_56, [
                    createElementVNode("table", _hoisted_57, [
                      createElementVNode("tbody", null, [
                        createElementVNode("tr", null, [
                          createElementVNode(
                            "th",
                            _hoisted_58,
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
                                  _hoisted_60,
                                  toDisplayString(_ctx.$t("{0} · {1} versch.", [m2.sniff?.type, m2.sniff?.distinct])),
                                  1
                                  /* TEXT */
                                )
                              ], 10, _hoisted_59);
                            }),
                            128
                            /* KEYED_FRAGMENT */
                          ))
                        ]),
                        createElementVNode("tr", null, [
                          createElementVNode(
                            "th",
                            _hoisted_61,
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
                                      }, toDisplayString(l), 9, _hoisted_63);
                                    }),
                                    128
                                    /* KEYED_FRAGMENT */
                                  ))
                                ], 40, _hoisted_62), [
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
                            _hoisted_64,
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
                                      }, toDisplayString(_ctx.$L(a.label) || a.key) + " · " + toDisplayString(a.key), 9, _hoisted_66);
                                    }),
                                    128
                                    /* KEYED_FRAGMENT */
                                  ))
                                ], 40, _hoisted_65)), [
                                  [vModelSelect, m2.attribute]
                                ]) : m2.target === "new" ? (openBlock(), createElementBlock("span", _hoisted_67, [
                                  withDirectives(createElementVNode("input", {
                                    "onUpdate:modelValue": ($event) => m2.newKey = $event,
                                    type: "text",
                                    placeholder: _ctx.$t("schlüssel"),
                                    onChange: _cache[14] || (_cache[14] = ($event) => planned.value = null)
                                  }, null, 40, _hoisted_68), [
                                    [vModelText, m2.newKey]
                                  ]),
                                  withDirectives(createElementVNode("select", {
                                    "onUpdate:modelValue": ($event) => m2.newType = $event,
                                    onChange: _cache[15] || (_cache[15] = ($event) => planned.value = null)
                                  }, [
                                    (openBlock(), createElementBlock(
                                      Fragment,
                                      null,
                                      renderList(["text", "html", "integer", "decimal", "boolean", "date", "enum"], (t2) => {
                                        return createElementVNode("option", {
                                          key: t2,
                                          value: t2
                                        }, toDisplayString(t2), 9, _hoisted_70);
                                      }),
                                      64
                                      /* STABLE_FRAGMENT */
                                    ))
                                  ], 40, _hoisted_69), [
                                    [vModelSelect, m2.newType]
                                  ]),
                                  withDirectives(createElementVNode("select", {
                                    "onUpdate:modelValue": ($event) => m2.newGroup = $event,
                                    class: normalizeClass({ neg: !m2.newGroup }),
                                    title: _ctx.$t("Attributgruppe — Pflicht"),
                                    onChange: _cache[16] || (_cache[16] = ($event) => planned.value = null)
                                  }, [
                                    createElementVNode(
                                      "option",
                                      _hoisted_72,
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
                                        }, "▤ " + toDisplayString(_ctx.$L(g.label) || g.key), 9, _hoisted_73);
                                      }),
                                      128
                                      /* KEYED_FRAGMENT */
                                    ))
                                  ], 42, _hoisted_71), [
                                    [vModelSelect, m2.newGroup]
                                  ])
                                ])) : (openBlock(), createElementBlock("span", _hoisted_74, "—"))
                              ]);
                            }),
                            128
                            /* KEYED_FRAGMENT */
                          ))
                        ]),
                        createElementVNode("tr", null, [
                          createElementVNode(
                            "th",
                            _hoisted_75,
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
                                  onChange: _cache[17] || (_cache[17] = ($event) => planned.value = null)
                                }, [
                                  _cache[45] || (_cache[45] = createElementVNode(
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
                                      }, toDisplayString(l), 9, _hoisted_77);
                                    }),
                                    128
                                    /* KEYED_FRAGMENT */
                                  ))
                                ], 40, _hoisted_76)), [
                                  [vModelSelect, m2.locale]
                                ]) : (openBlock(), createElementBlock("span", _hoisted_78, "—"))
                              ]);
                            }),
                            128
                            /* KEYED_FRAGMENT */
                          ))
                        ]),
                        createElementVNode("tr", null, [
                          _cache[46] || (_cache[46] = createElementVNode(
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
                                }, "ƒ" + toDisplayString(m2.steps?.length ? m2.steps.length : ""), 11, _hoisted_79),
                                m2.steps?.length ? (openBlock(), createElementBlock(
                                  "span",
                                  _hoisted_80,
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
                            _hoisted_81,
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
                                _hoisted_82,
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
                                  }, toDisplayString(String(source.value.rows[r - 1]?.[mapping.value.indexOf(m2)] ?? "").slice(0, 40)), 9, _hoisted_83);
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
                  layout.value === "cols" && stepsOpen.value && mapping.value.find((m2) => m2.column === stepsOpen.value) ? (openBlock(), createElementBlock("div", _hoisted_84, [
                    createElementVNode("div", _hoisted_85, [
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
                      _cache[47] || (_cache[47] = createTextVNode()),
                      createElementVNode("button", {
                        class: "x",
                        onClick: _cache[18] || (_cache[18] = ($event) => stepsOpen.value = null)
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
                            m2.target === "status" ? (openBlock(), createElementBlock("div", _hoisted_86, [
                              createElementVNode("span", _hoisted_87, [
                                createTextVNode(
                                  toDisplayString(_ctx.$t("Quellwert → Status")),
                                  1
                                  /* TEXT */
                                ),
                                !distinctValues(m2).length ? (openBlock(), createElementBlock(
                                  "span",
                                  _hoisted_88,
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
                                    _cache[49] || (_cache[49] = createTextVNode(
                                      " → ",
                                      -1
                                      /* CACHED */
                                    )),
                                    createElementVNode("select", {
                                      value: statusFor(m2, v),
                                      onChange: ($event) => setStatusFor(m2, v, $event.target.value)
                                    }, [
                                      _cache[48] || (_cache[48] = createElementVNode(
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
                                          }, toDisplayString(unref(store).statusText(s.key)), 9, _hoisted_90);
                                        }),
                                        128
                                        /* KEYED_FRAGMENT */
                                      ))
                                    ], 40, _hoisted_89)
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
                                    _hoisted_91,
                                    toDisplayString(si + 1),
                                    1
                                    /* TEXT */
                                  ),
                                  withDirectives(createElementVNode("select", {
                                    "onUpdate:modelValue": ($event) => s.op = $event,
                                    onChange: _cache[19] || (_cache[19] = ($event) => planned.value = null),
                                    title: unref(opHint)(s.op)
                                  }, [
                                    (openBlock(true), createElementBlock(
                                      Fragment,
                                      null,
                                      renderList(unref(OPS), (o) => {
                                        return openBlock(), createElementBlock("option", {
                                          key: o[0],
                                          value: o[0]
                                        }, toDisplayString(o[1]), 9, _hoisted_93);
                                      }),
                                      128
                                      /* KEYED_FRAGMENT */
                                    ))
                                  ], 40, _hoisted_92), [
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
                                              onChange: _cache[20] || (_cache[20] = ($event) => planned.value = null)
                                            }, null, 40, _hoisted_95), [
                                              [vModelCheckbox, s.regex]
                                            ]),
                                            createTextVNode(
                                              toDisplayString(" " + _ctx.$t("regex")),
                                              1
                                              /* TEXT */
                                            )
                                          ], 8, _hoisted_94)) : f === "test" ? (openBlock(), createElementBlock("span", _hoisted_96, [
                                            createElementVNode(
                                              "span",
                                              _hoisted_97,
                                              toDisplayString(_ctx.$t("Quelle ist")),
                                              1
                                              /* TEXT */
                                            ),
                                            withDirectives(createElementVNode("select", {
                                              "onUpdate:modelValue": ($event) => s.test = $event,
                                              onChange: _cache[21] || (_cache[21] = ($event) => planned.value = null)
                                            }, [
                                              createElementVNode(
                                                "option",
                                                _hoisted_99,
                                                toDisplayString(_ctx.$t("leer")),
                                                1
                                                /* TEXT */
                                              ),
                                              createElementVNode(
                                                "option",
                                                _hoisted_100,
                                                toDisplayString(_ctx.$t("gleich")),
                                                1
                                                /* TEXT */
                                              ),
                                              createElementVNode(
                                                "option",
                                                _hoisted_101,
                                                toDisplayString(_ctx.$t("enthält")),
                                                1
                                                /* TEXT */
                                              ),
                                              createElementVNode(
                                                "option",
                                                _hoisted_102,
                                                toDisplayString(_ctx.$t("passt auf (regex)")),
                                                1
                                                /* TEXT */
                                              )
                                            ], 40, _hoisted_98), [
                                              [vModelSelect, s.test]
                                            ])
                                          ])) : f === "decimal" ? (openBlock(), createElementBlock("span", _hoisted_103, [
                                            createElementVNode(
                                              "span",
                                              _hoisted_104,
                                              toDisplayString(_ctx.$t("Dezimalzeichen")),
                                              1
                                              /* TEXT */
                                            ),
                                            withDirectives(createElementVNode("select", {
                                              "onUpdate:modelValue": ($event) => s.decimal = $event,
                                              onChange: _cache[22] || (_cache[22] = ($event) => planned.value = null)
                                            }, [
                                              createElementVNode(
                                                "option",
                                                _hoisted_106,
                                                toDisplayString(_ctx.$t("raten")),
                                                1
                                                /* TEXT */
                                              ),
                                              createElementVNode(
                                                "option",
                                                _hoisted_107,
                                                toDisplayString(_ctx.$t("Komma")),
                                                1
                                                /* TEXT */
                                              ),
                                              createElementVNode(
                                                "option",
                                                _hoisted_108,
                                                toDisplayString(_ctx.$t("Punkt")),
                                                1
                                                /* TEXT */
                                              )
                                            ], 40, _hoisted_105), [
                                              [vModelSelect, s.decimal]
                                            ])
                                          ])) : f === "format" ? (openBlock(), createElementBlock("span", _hoisted_109, [
                                            createElementVNode(
                                              "span",
                                              _hoisted_110,
                                              toDisplayString(_ctx.$t("Quelle im Format")),
                                              1
                                              /* TEXT */
                                            ),
                                            withDirectives(createElementVNode("select", {
                                              "onUpdate:modelValue": ($event) => s.format = $event,
                                              onChange: _cache[23] || (_cache[23] = ($event) => planned.value = null)
                                            }, [
                                              (openBlock(true), createElementBlock(
                                                Fragment,
                                                null,
                                                renderList(unref(transform).DATE_FORMATS, ([k, l]) => {
                                                  return openBlock(), createElementBlock("option", {
                                                    key: k,
                                                    value: k
                                                  }, toDisplayString(l), 9, _hoisted_112);
                                                }),
                                                128
                                                /* KEYED_FRAGMENT */
                                              ))
                                            ], 40, _hoisted_111), [
                                              [vModelSelect, s.format]
                                            ])
                                          ])) : (openBlock(), createElementBlock("span", _hoisted_113, [
                                            createElementVNode(
                                              "span",
                                              _hoisted_114,
                                              toDisplayString(unref(FIELD_LABEL)[f] ?? f),
                                              1
                                              /* TEXT */
                                            ),
                                            withDirectives(createElementVNode("input", {
                                              type: "text",
                                              "onUpdate:modelValue": ($event) => s[f] = $event,
                                              placeholder: unref(FIELD_HINT)[f] ?? f,
                                              title: (unref(FIELD_HINT)[f] ?? f) + " — " + unref(opHint)(s.op),
                                              onInput: _cache[24] || (_cache[24] = ($event) => planned.value = null),
                                              style: { "width": "200px" }
                                            }, null, 40, _hoisted_115), [
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
                                              _hoisted_117,
                                              toDisplayString(_ctx.$t("+ Spalte …")),
                                              1
                                              /* TEXT */
                                            ),
                                            createElementVNode(
                                              "option",
                                              _hoisted_118,
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
                                                }, toDisplayString(c), 9, _hoisted_119);
                                              }),
                                              128
                                              /* KEYED_FRAGMENT */
                                            ))
                                          ], 40, _hoisted_116)) : createCommentVNode("v-if", true)
                                        ],
                                        64
                                        /* STABLE_FRAGMENT */
                                      );
                                    }),
                                    128
                                    /* KEYED_FRAGMENT */
                                  )),
                                  _cache[50] || (_cache[50] = createElementVNode(
                                    "span",
                                    { class: "grow" },
                                    null,
                                    -1
                                    /* CACHED */
                                  )),
                                  createElementVNode("button", {
                                    class: "x",
                                    onClick: ($event) => moveStep(m2, si, -1)
                                  }, "↑", 8, _hoisted_120),
                                  createElementVNode("button", {
                                    class: "x",
                                    onClick: ($event) => moveStep(m2, si, 1)
                                  }, "↓", 8, _hoisted_121),
                                  createElementVNode("button", {
                                    class: "x",
                                    onClick: ($event) => delStep(m2, si)
                                  }, "×", 8, _hoisted_122)
                                ]);
                              }),
                              128
                              /* KEYED_FRAGMENT */
                            )),
                            createElementVNode("div", _hoisted_123, [
                              createElementVNode("select", {
                                value: "",
                                onChange: ($event) => {
                                  addStep(m2, $event.target.value);
                                  $event.target.value = "";
                                }
                              }, [
                                createElementVNode(
                                  "option",
                                  _hoisted_125,
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
                                    }, toDisplayString(o[1]), 9, _hoisted_126);
                                  }),
                                  128
                                  /* KEYED_FRAGMENT */
                                ))
                              ], 40, _hoisted_124),
                              createElementVNode(
                                "span",
                                _hoisted_127,
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
                  layout.value === "rows" ? (openBlock(), createElementBlock("table", _hoisted_128, [
                    createElementVNode("thead", null, [
                      createElementVNode("tr", null, [
                        createElementVNode(
                          "th",
                          _hoisted_129,
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
                          _hoisted_130,
                          toDisplayString(_ctx.$t("Ziel")),
                          1
                          /* TEXT */
                        ),
                        createElementVNode(
                          "th",
                          _hoisted_131,
                          toDisplayString(_ctx.$t("Attribut")),
                          1
                          /* TEXT */
                        ),
                        createElementVNode(
                          "th",
                          _hoisted_132,
                          toDisplayString(_ctx.$t("Sprache")),
                          1
                          /* TEXT */
                        ),
                        createElementVNode(
                          "th",
                          _hoisted_133,
                          toDisplayString(_ctx.$t("Warum")),
                          1
                          /* TEXT */
                        ),
                        createElementVNode("th", {
                          style: { "width": "34px" },
                          title: _ctx.$t("Umwandlung: Schritte zwischen Quelle und Ziel (Zahl, Ja/Nein, Datum, Ersetzen, Aufteilen, Verbinden, Bedingung …)")
                        }, "ƒ", 8, _hoisted_134)
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
                                      _hoisted_136,
                                      toDisplayString(_ctx.$t("{0} · {1} versch.", [m2.sniff?.type, m2.sniff?.distinct])),
                                      1
                                      /* TEXT */
                                    )
                                  ], 8, _hoisted_135),
                                  createElementVNode(
                                    "td",
                                    _hoisted_137,
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
                                          }, toDisplayString(l), 9, _hoisted_139);
                                        }),
                                        128
                                        /* KEYED_FRAGMENT */
                                      ))
                                    ], 40, _hoisted_138), [
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
                                          }, toDisplayString(_ctx.$L(a.label) || a.key) + " · " + toDisplayString(a.key), 9, _hoisted_141);
                                        }),
                                        128
                                        /* KEYED_FRAGMENT */
                                      ))
                                    ], 40, _hoisted_140)), [
                                      [vModelSelect, m2.attribute]
                                    ]) : m2.target === "new" ? (openBlock(), createElementBlock("span", _hoisted_142, [
                                      withDirectives(createElementVNode("input", {
                                        "onUpdate:modelValue": ($event) => m2.newKey = $event,
                                        type: "text",
                                        style: { "flex": "1", "min-width": "90px" },
                                        placeholder: _ctx.$t("schlüssel"),
                                        onChange: _cache[25] || (_cache[25] = ($event) => planned.value = null)
                                      }, null, 40, _hoisted_143), [
                                        [vModelText, m2.newKey]
                                      ]),
                                      withDirectives(createElementVNode("select", {
                                        "onUpdate:modelValue": ($event) => m2.newType = $event,
                                        style: { "width": "84px" },
                                        onChange: _cache[26] || (_cache[26] = ($event) => planned.value = null)
                                      }, [
                                        (openBlock(), createElementBlock(
                                          Fragment,
                                          null,
                                          renderList(["text", "html", "integer", "decimal", "boolean", "date"], (t2) => {
                                            return createElementVNode("option", {
                                              key: t2,
                                              value: t2
                                            }, toDisplayString(t2), 9, _hoisted_145);
                                          }),
                                          64
                                          /* STABLE_FRAGMENT */
                                        ))
                                      ], 40, _hoisted_144), [
                                        [vModelSelect, m2.newType]
                                      ]),
                                      withDirectives(createElementVNode("select", {
                                        "onUpdate:modelValue": ($event) => m2.newGroup = $event,
                                        style: { "width": "100%" },
                                        class: normalizeClass({ neg: !m2.newGroup }),
                                        title: _ctx.$t("Attributgruppe — Pflicht: ohne Gruppe gilt das Attribut nirgends"),
                                        onChange: _cache[27] || (_cache[27] = ($event) => planned.value = null)
                                      }, [
                                        createElementVNode(
                                          "option",
                                          _hoisted_147,
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
                                            }, "▤ " + toDisplayString(_ctx.$L(g.label) || g.key), 9, _hoisted_148);
                                          }),
                                          128
                                          /* KEYED_FRAGMENT */
                                        ))
                                      ], 42, _hoisted_146), [
                                        [vModelSelect, m2.newGroup]
                                      ])
                                    ])) : (openBlock(), createElementBlock("span", _hoisted_149, "—"))
                                  ]),
                                  createElementVNode("td", null, [
                                    m2.target === "attr" && attrs.value.find((a) => a.key === m2.attribute)?.perLocale || m2.target === "new" ? withDirectives((openBlock(), createElementBlock("select", {
                                      key: 0,
                                      "onUpdate:modelValue": ($event) => m2.locale = $event,
                                      style: { "width": "100%" },
                                      onChange: _cache[28] || (_cache[28] = ($event) => planned.value = null)
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
                                          }, toDisplayString(l), 9, _hoisted_151);
                                        }),
                                        128
                                        /* KEYED_FRAGMENT */
                                      ))
                                    ], 40, _hoisted_150)), [
                                      [vModelSelect, m2.locale]
                                    ]) : createCommentVNode("v-if", true)
                                  ]),
                                  createElementVNode(
                                    "td",
                                    _hoisted_152,
                                    toDisplayString(m2.why),
                                    1
                                    /* TEXT */
                                  ),
                                  createElementVNode("td", null, [
                                    createElementVNode("button", {
                                      class: normalizeClass(["x", { on: m2.steps?.length }]),
                                      title: m2.steps?.length ? stepsText(m2) + " — Klick: bearbeiten" : _ctx.$t("Umwandlung hinzufügen"),
                                      onClick: ($event) => stepsOpen.value = stepsOpen.value === m2.column ? null : m2.column
                                    }, "ƒ" + toDisplayString(m2.steps?.length ? m2.steps.length : ""), 11, _hoisted_153)
                                  ])
                                ],
                                2
                                /* CLASS */
                              ),
                              stepsOpen.value === m2.column ? (openBlock(), createElementBlock("tr", _hoisted_154, [
                                createElementVNode("td", _hoisted_155, [
                                  createElementVNode("div", _hoisted_156, [
                                    m2.target === "status" ? (openBlock(), createElementBlock("div", _hoisted_157, [
                                      createElementVNode("span", _hoisted_158, [
                                        createTextVNode(
                                          toDisplayString(_ctx.$t("Quellwert → Status")),
                                          1
                                          /* TEXT */
                                        ),
                                        !distinctValues(m2).length ? (openBlock(), createElementBlock(
                                          "span",
                                          _hoisted_159,
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
                                            _cache[53] || (_cache[53] = createTextVNode(
                                              " → ",
                                              -1
                                              /* CACHED */
                                            )),
                                            createElementVNode("select", {
                                              value: statusFor(m2, v),
                                              onChange: ($event) => setStatusFor(m2, v, $event.target.value)
                                            }, [
                                              _cache[52] || (_cache[52] = createElementVNode(
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
                                                  }, toDisplayString(unref(store).statusText(s.key)), 9, _hoisted_161);
                                                }),
                                                128
                                                /* KEYED_FRAGMENT */
                                              ))
                                            ], 40, _hoisted_160)
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
                                            _hoisted_162,
                                            toDisplayString(si + 1),
                                            1
                                            /* TEXT */
                                          ),
                                          withDirectives(createElementVNode("select", {
                                            "onUpdate:modelValue": ($event) => s.op = $event,
                                            onChange: _cache[29] || (_cache[29] = ($event) => planned.value = null),
                                            title: unref(opHint)(s.op)
                                          }, [
                                            (openBlock(true), createElementBlock(
                                              Fragment,
                                              null,
                                              renderList(unref(OPS), (o) => {
                                                return openBlock(), createElementBlock("option", {
                                                  key: o[0],
                                                  value: o[0]
                                                }, toDisplayString(o[1]), 9, _hoisted_164);
                                              }),
                                              128
                                              /* KEYED_FRAGMENT */
                                            ))
                                          ], 40, _hoisted_163), [
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
                                                      onChange: _cache[30] || (_cache[30] = ($event) => planned.value = null)
                                                    }, null, 40, _hoisted_166), [
                                                      [vModelCheckbox, s.regex]
                                                    ]),
                                                    createTextVNode(
                                                      toDisplayString(" " + _ctx.$t("regex")),
                                                      1
                                                      /* TEXT */
                                                    )
                                                  ], 8, _hoisted_165)) : f === "test" ? (openBlock(), createElementBlock("span", _hoisted_167, [
                                                    createElementVNode(
                                                      "span",
                                                      _hoisted_168,
                                                      toDisplayString(_ctx.$t("Quelle ist")),
                                                      1
                                                      /* TEXT */
                                                    ),
                                                    withDirectives(createElementVNode("select", {
                                                      "onUpdate:modelValue": ($event) => s.test = $event,
                                                      onChange: _cache[31] || (_cache[31] = ($event) => planned.value = null)
                                                    }, [
                                                      createElementVNode(
                                                        "option",
                                                        _hoisted_170,
                                                        toDisplayString(_ctx.$t("leer")),
                                                        1
                                                        /* TEXT */
                                                      ),
                                                      createElementVNode(
                                                        "option",
                                                        _hoisted_171,
                                                        toDisplayString(_ctx.$t("gleich")),
                                                        1
                                                        /* TEXT */
                                                      ),
                                                      createElementVNode(
                                                        "option",
                                                        _hoisted_172,
                                                        toDisplayString(_ctx.$t("enthält")),
                                                        1
                                                        /* TEXT */
                                                      ),
                                                      createElementVNode(
                                                        "option",
                                                        _hoisted_173,
                                                        toDisplayString(_ctx.$t("passt auf (regex)")),
                                                        1
                                                        /* TEXT */
                                                      )
                                                    ], 40, _hoisted_169), [
                                                      [vModelSelect, s.test]
                                                    ])
                                                  ])) : f === "decimal" ? (openBlock(), createElementBlock("span", _hoisted_174, [
                                                    createElementVNode(
                                                      "span",
                                                      _hoisted_175,
                                                      toDisplayString(_ctx.$t("Dezimalzeichen")),
                                                      1
                                                      /* TEXT */
                                                    ),
                                                    withDirectives(createElementVNode("select", {
                                                      "onUpdate:modelValue": ($event) => s.decimal = $event,
                                                      onChange: _cache[32] || (_cache[32] = ($event) => planned.value = null)
                                                    }, [
                                                      createElementVNode(
                                                        "option",
                                                        _hoisted_177,
                                                        toDisplayString(_ctx.$t("raten")),
                                                        1
                                                        /* TEXT */
                                                      ),
                                                      createElementVNode(
                                                        "option",
                                                        _hoisted_178,
                                                        toDisplayString(_ctx.$t("Komma")),
                                                        1
                                                        /* TEXT */
                                                      ),
                                                      createElementVNode(
                                                        "option",
                                                        _hoisted_179,
                                                        toDisplayString(_ctx.$t("Punkt")),
                                                        1
                                                        /* TEXT */
                                                      )
                                                    ], 40, _hoisted_176), [
                                                      [vModelSelect, s.decimal]
                                                    ])
                                                  ])) : f === "format" ? (openBlock(), createElementBlock("span", _hoisted_180, [
                                                    createElementVNode(
                                                      "span",
                                                      _hoisted_181,
                                                      toDisplayString(_ctx.$t("Quelle im Format")),
                                                      1
                                                      /* TEXT */
                                                    ),
                                                    withDirectives(createElementVNode("select", {
                                                      "onUpdate:modelValue": ($event) => s.format = $event,
                                                      onChange: _cache[33] || (_cache[33] = ($event) => planned.value = null)
                                                    }, [
                                                      (openBlock(true), createElementBlock(
                                                        Fragment,
                                                        null,
                                                        renderList(unref(transform).DATE_FORMATS, ([k, l]) => {
                                                          return openBlock(), createElementBlock("option", {
                                                            key: k,
                                                            value: k
                                                          }, toDisplayString(l), 9, _hoisted_183);
                                                        }),
                                                        128
                                                        /* KEYED_FRAGMENT */
                                                      ))
                                                    ], 40, _hoisted_182), [
                                                      [vModelSelect, s.format]
                                                    ])
                                                  ])) : (openBlock(), createElementBlock("span", _hoisted_184, [
                                                    createElementVNode(
                                                      "span",
                                                      _hoisted_185,
                                                      toDisplayString(unref(FIELD_LABEL)[f] ?? f),
                                                      1
                                                      /* TEXT */
                                                    ),
                                                    withDirectives(createElementVNode("input", {
                                                      type: "text",
                                                      "onUpdate:modelValue": ($event) => s[f] = $event,
                                                      placeholder: unref(FIELD_HINT)[f] ?? f,
                                                      title: (unref(FIELD_HINT)[f] ?? f) + " — " + unref(opHint)(s.op),
                                                      onInput: _cache[34] || (_cache[34] = ($event) => planned.value = null),
                                                      style: normalizeStyle(f === "pairs" || f === "columns" || f === "index" || f === "then" || f === "else" || f === "yes" ? "width:250px" : "width:130px")
                                                    }, null, 44, _hoisted_186), [
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
                                                      _hoisted_188,
                                                      toDisplayString(_ctx.$t("+ Spalte …")),
                                                      1
                                                      /* TEXT */
                                                    ),
                                                    createElementVNode(
                                                      "option",
                                                      _hoisted_189,
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
                                                        }, toDisplayString(c), 9, _hoisted_190);
                                                      }),
                                                      128
                                                      /* KEYED_FRAGMENT */
                                                    ))
                                                  ], 40, _hoisted_187)) : createCommentVNode("v-if", true)
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
                                            _hoisted_191,
                                            toDisplayString(unref(opHint)(s.op)),
                                            1
                                            /* TEXT */
                                          ),
                                          _cache[54] || (_cache[54] = createElementVNode(
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
                                          }, "↑", 8, _hoisted_192),
                                          createElementVNode("button", {
                                            class: "x",
                                            onClick: ($event) => moveStep(m2, si, 1),
                                            title: _ctx.$t("nach unten")
                                          }, "↓", 8, _hoisted_193),
                                          createElementVNode("button", {
                                            class: "x",
                                            onClick: ($event) => delStep(m2, si),
                                            title: _ctx.$t("Schritt entfernen")
                                          }, "×", 8, _hoisted_194)
                                        ]);
                                      }),
                                      128
                                      /* KEYED_FRAGMENT */
                                    )),
                                    createElementVNode("div", _hoisted_195, [
                                      createElementVNode("select", {
                                        value: "",
                                        onChange: ($event) => {
                                          addStep(m2, $event.target.value);
                                          $event.target.value = "";
                                        }
                                      }, [
                                        createElementVNode(
                                          "option",
                                          _hoisted_197,
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
                                            }, toDisplayString(o[1]), 9, _hoisted_198);
                                          }),
                                          128
                                          /* KEYED_FRAGMENT */
                                        ))
                                      ], 40, _hoisted_196),
                                      createElementVNode(
                                        "span",
                                        _hoisted_199,
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
            "onUpdate:modelValue": _cache[35] || (_cache[35] = ($event) => isRef(leftW) ? leftW.value = $event : null),
            min: 480,
            max: 1400
          }, null, 8, ["modelValue"]),
          createElementVNode("div", _hoisted_200, [
            createElementVNode("div", _hoisted_201, [
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
              }, toDisplayString(_ctx.$t("analysieren")), 9, _hoisted_202),
              createElementVNode("button", {
                class: "primary",
                disabled: !planned.value || !!busy.value || !planned.value.commands.length || blockers.value.length > 0 || planned.value.stale,
                onClick: run,
                title: !planned.value ? _ctx.$t("erst analysieren") : blockers.value[0] ?? (planned.value.stale ? _ctx.$t("erst erneut analysieren") : _ctx.$t("{0} Befehle schreiben", [planned.value.commands.length]))
              }, toDisplayString(_ctx.$t("▶ schreiben")), 9, _hoisted_203),
              _cache[55] || (_cache[55] = createElementVNode(
                "span",
                { class: "grow" },
                null,
                -1
                /* CACHED */
              )),
              createElementVNode(
                "span",
                _hoisted_204,
                toDisplayString(unref(store).actor ? "👤 " + unref(store).actor : _ctx.$t("👤 Name fehlt")),
                1
                /* TEXT */
              )
            ]),
            createElementVNode("div", _hoisted_205, [
              planned.value ? (openBlock(), createElementBlock("div", _hoisted_206, [
                createElementVNode(
                  "span",
                  _hoisted_207,
                  toDisplayString(_ctx.$t("{0} Werte · {1} Befehle", [planned.value.stats.values, planned.value.commands.length])),
                  1
                  /* TEXT */
                ),
                Object.keys(planned.value.stats.newListValues ?? {}).length ? (openBlock(), createElementBlock(
                  Fragment,
                  { key: 0 },
                  [
                    _cache[56] || (_cache[56] = createTextVNode(
                      " · ",
                      -1
                      /* CACHED */
                    )),
                    createElementVNode("span", {
                      class: "pos",
                      title: Object.entries(planned.value.stats.newListValues).map(([l, v]) => l + ": " + Object.values(v).join(", ")).join(" · ")
                    }, toDisplayString(_ctx.$t("+{0} Listenwerte", [Object.values(planned.value.stats.newListValues).reduce((n, v) => n + Object.keys(v).length, 0)])), 9, _hoisted_208)
                  ],
                  64
                  /* STABLE_FRAGMENT */
                )) : createCommentVNode("v-if", true),
                planned.value.newAttributes.length ? (openBlock(), createElementBlock("span", _hoisted_209, [
                  _cache[57] || (_cache[57] = createTextVNode(
                    " · ",
                    -1
                    /* CACHED */
                  )),
                  createElementVNode(
                    "span",
                    _hoisted_210,
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
                  _hoisted_211,
                  "ℹ " + toDisplayString(planned.value.stats.notes.slice(0, 30).join("\nℹ ")),
                  1
                  /* TEXT */
                )) : createCommentVNode("v-if", true),
                planned.value.stats.problems.length ? (openBlock(), createElementBlock("div", _hoisted_212, [
                  createTextVNode(
                    toDisplayString(planned.value.stats.problems.slice(0, 30).join("\n")),
                    1
                    /* TEXT */
                  ),
                  planned.value.stats.problems.length > 30 ? (openBlock(), createElementBlock(
                    "span",
                    _hoisted_213,
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
                planned.value.stale ? (openBlock(), createElementBlock("div", _hoisted_214, [
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
                planned.value.stats.invalid.length ? (openBlock(), createElementBlock("div", _hoisted_215, [
                  createElementVNode("h2", _hoisted_216, [
                    createTextVNode(
                      toDisplayString(_ctx.$t("Werte prüfen") + " "),
                      1
                      /* TEXT */
                    ),
                    createElementVNode(
                      "span",
                      _hoisted_217,
                      toDisplayString(_ctx.$t("· {0} Zellen{1}", [planned.value.stats.invalid.length, fixed.value ? " " + _ctx.$t("— im Knotenmodus in Excel korrigieren und neu laden") : " " + _ctx.$t("— hier korrigieren, dann erneut analysieren")])),
                      1
                      /* TEXT */
                    )
                  ]),
                  createElementVNode("table", _hoisted_218, [
                    createElementVNode("thead", null, [
                      createElementVNode("tr", null, [
                        createElementVNode(
                          "th",
                          _hoisted_219,
                          toDisplayString(_ctx.$t("Zeile")),
                          1
                          /* TEXT */
                        ),
                        createElementVNode(
                          "th",
                          _hoisted_220,
                          toDisplayString(_ctx.$t("Spalte")),
                          1
                          /* TEXT */
                        ),
                        createElementVNode("th", {
                          style: { "width": "260px" },
                          title: _ctx.$t("warum der Wert abgelehnt wird — und was das Attribut erwartet")
                        }, toDisplayString(_ctx.$t("Grund")), 9, _hoisted_221),
                        createElementVNode(
                          "th",
                          null,
                          toDisplayString(_ctx.$t("Wert")),
                          1
                          /* TEXT */
                        ),
                        createElementVNode(
                          "th",
                          _hoisted_222,
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
                              _hoisted_223,
                              toDisplayString(inv.row + 2),
                              1
                              /* TEXT */
                            ),
                            createElementVNode("td", {
                              class: "mono",
                              style: { "overflow": "hidden", "text-overflow": "ellipsis" },
                              title: source.value.columns[inv.column]
                            }, toDisplayString(source.value.columns[inv.column]), 9, _hoisted_224),
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
                                _hoisted_226,
                                " · " + toDisplayString(typeHint(inv)),
                                1
                                /* TEXT */
                              )
                            ], 8, _hoisted_225),
                            createElementVNode("td", {
                              class: "muted",
                              style: { "overflow": "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" },
                              title: String(inv.value ?? "")
                            }, toDisplayString(inv.value), 9, _hoisted_227),
                            createElementVNode("td", null, [
                              !fixed.value ? (openBlock(), createElementBlock("input", {
                                key: 0,
                                type: "text",
                                value: inv.value,
                                style: { "width": "100%" },
                                title: _ctx.$t("korrigierter Wert — Enter, dann erneut analysieren"),
                                onChange: ($event) => fixCell(inv, $event.target.value)
                              }, null, 40, _hoisted_228)) : (openBlock(), createElementBlock(
                                "span",
                                _hoisted_229,
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
                planned.value.stats.changes?.length ? (openBlock(), createElementBlock("div", _hoisted_230, [
                  createElementVNode("h2", _hoisted_231, [
                    createTextVNode(
                      toDisplayString(_ctx.$t("Vorschau") + " "),
                      1
                      /* TEXT */
                    ),
                    createElementVNode("span", _hoisted_232, [
                      createElementVNode(
                        "button",
                        {
                          class: normalizeClass([{ on: changeTab.value === "create" }, "pos"]),
                          onClick: _cache[36] || (_cache[36] = ($event) => changeTab.value = "create")
                        },
                        toDisplayString(_ctx.$t("+{0} neu", [planned.value.stats.create])),
                        3
                        /* TEXT, CLASS */
                      ),
                      createElementVNode(
                        "button",
                        {
                          class: normalizeClass([{ on: changeTab.value === "update" }, "warn"]),
                          onClick: _cache[37] || (_cache[37] = ($event) => changeTab.value = "update")
                        },
                        toDisplayString(_ctx.$t("{0} geändert", [planned.value.stats.update])),
                        3
                        /* TEXT, CLASS */
                      ),
                      createElementVNode(
                        "button",
                        {
                          class: normalizeClass([{ on: changeTab.value === "unchanged" }, "muted"]),
                          onClick: _cache[38] || (_cache[38] = ($event) => changeTab.value = "unchanged")
                        },
                        toDisplayString(_ctx.$t("{0} unverändert", [planned.value.stats.unchanged])),
                        3
                        /* TEXT, CLASS */
                      )
                    ])
                  ]),
                  createElementVNode("table", _hoisted_233, [
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
                                  _hoisted_235,
                                  toDisplayString(c.values.length && changeTab.value !== "unchanged" ? openRow.value === c.row ? "▾" : "▸" : ""),
                                  1
                                  /* TEXT */
                                ),
                                createElementVNode(
                                  "td",
                                  _hoisted_236,
                                  toDisplayString(c.row + 2),
                                  1
                                  /* TEXT */
                                ),
                                createElementVNode("td", null, [
                                  c.node ? (openBlock(), createElementBlock("span", _hoisted_237, [
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
                                      onClick: _cache[39] || (_cache[39] = withModifiers(() => {
                                      }, ["stop"]))
                                    }, "↗", 8, _hoisted_238)
                                  ])) : (openBlock(), createElementBlock(
                                    "span",
                                    _hoisted_239,
                                    "+ " + toDisplayString(c.label),
                                    1
                                    /* TEXT */
                                  ))
                                ]),
                                createElementVNode(
                                  "td",
                                  _hoisted_240,
                                  toDisplayString(c.values.length ? c.values.length + " " + _ctx.$t("Werte") : ""),
                                  1
                                  /* TEXT */
                                )
                              ], 8, _hoisted_234),
                              openRow.value === c.row && c.values.length ? (openBlock(), createElementBlock("tr", _hoisted_241, [
                                _cache[58] || (_cache[58] = createElementVNode(
                                  "td",
                                  null,
                                  null,
                                  -1
                                  /* CACHED */
                                )),
                                createElementVNode("td", _hoisted_242, [
                                  createElementVNode("table", _hoisted_243, [
                                    createElementVNode("tbody", null, [
                                      (openBlock(true), createElementBlock(
                                        Fragment,
                                        null,
                                        renderList(c.values, (d) => {
                                          return openBlock(), createElementBlock("tr", {
                                            key: d.attribute + "|" + d.locale
                                          }, [
                                            createElementVNode("td", _hoisted_244, [
                                              createTextVNode(
                                                toDisplayString(attrLabel(d.attribute)),
                                                1
                                                /* TEXT */
                                              ),
                                              d.locale ? (openBlock(), createElementBlock(
                                                "span",
                                                _hoisted_245,
                                                " · " + toDisplayString(d.locale),
                                                1
                                                /* TEXT */
                                              )) : createCommentVNode("v-if", true)
                                            ]),
                                            createElementVNode("td", {
                                              class: "old",
                                              title: d.from ?? ""
                                            }, toDisplayString(d.from == null ? "" : String(d.from).slice(0, 80)), 9, _hoisted_246),
                                            createElementVNode(
                                              "td",
                                              _hoisted_247,
                                              toDisplayString(d.from == null ? "+" : "→"),
                                              1
                                              /* TEXT */
                                            ),
                                            createElementVNode("td", {
                                              class: normalizeClass(d.from == null ? "new" : "chg"),
                                              title: d.to ?? ""
                                            }, toDisplayString(d.to == null ? "— (leeren)" : String(d.to).slice(0, 80)), 11, _hoisted_248)
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
                      !planned.value.stats.changes.some((c) => c.kind === changeTab.value) ? (openBlock(), createElementBlock("tr", _hoisted_249, [
                        createElementVNode(
                          "td",
                          _hoisted_250,
                          toDisplayString(_ctx.$t("nichts")),
                          1
                          /* TEXT */
                        )
                      ])) : createCommentVNode("v-if", true)
                    ])
                  ])
                ])) : createCommentVNode("v-if", true),
                createElementVNode("details", _hoisted_251, [
                  createElementVNode(
                    "summary",
                    _hoisted_252,
                    toDisplayString(_ctx.$t("Befehle (erste 200)")),
                    1
                    /* TEXT */
                  ),
                  createElementVNode(
                    "pre",
                    _hoisted_253,
                    toDisplayString(planned.value.commands.slice(0, 200).map((c) => `${c.op} ${JSON.stringify(c.args)}`).join("\n")),
                    1
                    /* TEXT */
                  )
                ])
              ])) : source.value ? (openBlock(), createElementBlock(
                "div",
                _hoisted_254,
                toDisplayString(_ctx.$t("Zuordnung prüfen, Ziel wählen, dann analysieren. Nichts wird geschrieben, bevor Du „schreiben“ drückst.")),
                1
                /* TEXT */
              )) : (openBlock(), createElementBlock("div", _hoisted_255, [
                createTextVNode(
                  toDisplayString(_ctx.$t("Datei ablegen oder aus Excel einfügen.")),
                  1
                  /* TEXT */
                ),
                _cache[59] || (_cache[59] = createElementVNode(
                  "br",
                  null,
                  null,
                  -1
                  /* CACHED */
                )),
                createElementVNode(
                  "span",
                  _hoisted_256,
                  toDisplayString(_ctx.$t("Der Mapper erkennt Spalten an Schlüssel, Label, Synonymen (Artikelnummer → sku …), Sprache im Namen (name_en) und rät den Typ neuer Attribute aus den Werten.")),
                  1
                  /* TEXT */
                )
              ])),
              result.value ? (openBlock(), createElementBlock("div", _hoisted_257, [
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
              log.value.length ? (openBlock(), createElementBlock("div", _hoisted_258, [
                createElementVNode(
                  "h2",
                  null,
                  toDisplayString(_ctx.$t("Protokoll")),
                  1
                  /* TEXT */
                ),
                createElementVNode("div", _hoisted_259, [
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
const ImportView = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["__scopeId", "data-v-19509d11"]]);
async function build$1(env, { root, role = "", locales, ownOnly = false, viewKey = "", channel = "", only = null, extra = [], at = null, say }) {
  const { api: api2, model } = env;
  const byLocale = /* @__PURE__ */ new Map();
  let cols = [], nodes = [];
  for (const l of locales) {
    say?.(`lese ${l} …`);
    const t2 = await api2.get(`/api/nodes/${encodeURIComponent(root)}/table?deep=true&locale=${l}${channel ? "&channel=" + encodeURIComponent(channel) : ""}${role ? "&role=" + role : ""}${at ? "&at=" + at : ""}`);
    cols = t2.columns;
    nodes = only ? t2.rows.filter((r) => only.has(r.row.id)) : t2.rows;
    byLocale.set(l, new Map(t2.rows.map((r) => [r.row.id, r.values])));
  }
  const v = model.views.find((x) => x.key === viewKey);
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
    const all = await api2.get("/api/tree");
    const byId = new Map((Array.isArray(all) ? all : all.rows ?? []).map((r) => [r.id, r]));
    for (let p = byId.get(root)?.parent; p; p = byId.get(p)?.parent) rootId = p;
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
  if (legendRows) {
    const lg = X.utils.aoa_to_sheet(legendRows);
    lg["!cols"] = [{ wch: 8 }, { wch: 24 }, { wch: 28 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 60 }];
    lg["!autofilter"] = { ref: X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(1, legendRows.length - 1), c: legendRows[0].length - 1 } }) };
    X.utils.book_append_sheet(wb, lg, "Legende");
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
    console.warn(t_("Excel ohne Politur:"), e.message);
    return new Blob([raw], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }
}
const build = (opts) => build$1({ api, model: store.model }, opts);
async function toXlsx(table, sheet = t_("Daten")) {
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
      const t2 = await api.get(`/api/nodes/${encodeURIComponent(nodeId)}/table?locale=${l}&role=${childRole}`);
      nodes = t2.rows;
      byLocale.set(l, new Map(t2.rows.map((r) => [r.row.id, r.values])));
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
  class: "muted"
};
const _hoisted_9 = { class: "attr" };
const _hoisted_10 = { value: "" };
const _hoisted_11 = { value: "group" };
const _hoisted_12 = { value: "product" };
const _hoisted_13 = { value: "variant" };
const _hoisted_14 = { class: "attr" };
const _hoisted_15 = { class: "chips" };
const _hoisted_16 = ["onClick"];
const _hoisted_17 = { class: "attr" };
const _hoisted_18 = { value: "" };
const _hoisted_19 = ["value"];
const _hoisted_20 = { class: "attr" };
const _hoisted_21 = { class: "step" };
const _hoisted_22 = {
  colspan: "2",
  class: "step-band",
  style: { "display": "table-cell", "height": "24px" }
};
const _hoisted_23 = { class: "attr" };
const _hoisted_24 = { value: "xlsx" };
const _hoisted_25 = { value: "csv" };
const _hoisted_26 = { class: "row" };
const _hoisted_27 = ["onClick", "title"];
const _hoisted_28 = ["onClick", "title"];
const _hoisted_29 = { class: "step-band" };
const _hoisted_30 = { class: "muted" };
const _hoisted_31 = { class: "scroll" };
const _hoisted_32 = {
  key: 0,
  class: "grid",
  style: { "width": "auto" }
};
const _hoisted_33 = ["title"];
const _hoisted_34 = {
  key: 1,
  class: "muted",
  style: { "padding": "8px" }
};
const _hoisted_35 = {
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
        const t$1 = { columns, rows, count: rows.length };
        table.value = t$1;
        busy.value = `${t$1.count} Zeilen · ${t$1.columns.length} Spalten`;
        if (!downloadIt) return;
        const name = `${rootRows.value.map((r) => r.label).join("+") || "export"}-${role.value || "alle"}-${locales.value.join("-")}`.replace(/[^\w.-]+/g, "_").slice(0, 80);
        if (format.value === "csv") download(new Blob([toCsv(t$1)], { type: "text/csv;charset=utf-8" }), name + ".csv");
        else download(await toXlsx(t$1), name + ".xlsx");
        store.toast(t("⇪ {0} Zeilen exportiert", [t$1.count]), "ok");
      } catch (e) {
        busy.value = "✗ " + e.message;
        store.toast(e.message);
      }
    }
    return (_ctx, _cache) => {
      const _component_router_link = resolveComponent("router-link");
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createElementVNode("div", _hoisted_2, [
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
              class: normalizeClass(String(busy.value ?? "").startsWith("✗") ? "fehler" : "muted")
            },
            toDisplayString(busy.value),
            3
            /* TEXT, CLASS */
          )
        ]),
        createElementVNode("table", _hoisted_3, [
          _cache[9] || (_cache[9] = createElementVNode(
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
                toDisplayString(_ctx.$t("1 · Was")),
                1
                /* TEXT */
              )
            ]),
            createElementVNode("tr", null, [
              createElementVNode(
                "td",
                _hoisted_6,
                toDisplayString(_ctx.$t("Teilbaum")),
                1
                /* TEXT */
              ),
              createElementVNode("td", null, [
                createElementVNode("div", _hoisted_7, [
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
                    _hoisted_8,
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
                _hoisted_9,
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
                      _hoisted_10,
                      toDisplayString(_ctx.$t("alle Knoten darunter")),
                      1
                      /* TEXT */
                    ),
                    createElementVNode(
                      "option",
                      _hoisted_11,
                      toDisplayString(_ctx.$t("▣ nur Gruppen")),
                      1
                      /* TEXT */
                    ),
                    createElementVNode(
                      "option",
                      _hoisted_12,
                      toDisplayString(_ctx.$t("▦ nur Produkte")),
                      1
                      /* TEXT */
                    ),
                    createElementVNode(
                      "option",
                      _hoisted_13,
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
                _hoisted_14,
                toDisplayString(_ctx.$t("Sprachen")),
                1
                /* TEXT */
              ),
              createElementVNode("td", null, [
                createElementVNode("div", _hoisted_15, [
                  (openBlock(true), createElementBlock(
                    Fragment,
                    null,
                    renderList(unref(store).model?.locales ?? [], (l) => {
                      return openBlock(), createElementBlock("span", {
                        key: l.code,
                        class: normalizeClass(["view-chip", { on: locales.value.includes(l.code) }]),
                        onClick: ($event) => toggleLocale(l.code)
                      }, toDisplayString(l.code), 11, _hoisted_16);
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
                _hoisted_17,
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
                      _hoisted_18,
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
                        }, "◫ " + toDisplayString(_ctx.$L(v.label) || v.key) + " (" + toDisplayString(v.level) + ")", 9, _hoisted_19);
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
                _hoisted_20,
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
                ])
              ])
            ]),
            createElementVNode("tr", _hoisted_21, [
              createElementVNode(
                "td",
                _hoisted_22,
                toDisplayString(_ctx.$t("2 · Wie")),
                1
                /* TEXT */
              )
            ]),
            createElementVNode("tr", null, [
              createElementVNode(
                "td",
                _hoisted_23,
                toDisplayString(_ctx.$t("Format")),
                1
                /* TEXT */
              ),
              createElementVNode("td", null, [
                withDirectives(createElementVNode(
                  "select",
                  {
                    "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => format.value = $event),
                    onChange: persist,
                    style: { "width": "100%" }
                  },
                  [
                    createElementVNode(
                      "option",
                      _hoisted_24,
                      toDisplayString(_ctx.$t("Excel (.xlsx)")),
                      1
                      /* TEXT */
                    ),
                    createElementVNode(
                      "option",
                      _hoisted_25,
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
            ]),
            createElementVNode("tr", null, [
              _cache[8] || (_cache[8] = createElementVNode(
                "td",
                { class: "attr" },
                null,
                -1
                /* CACHED */
              )),
              createElementVNode("td", null, [
                createElementVNode("div", _hoisted_26, [
                  createElementVNode(
                    "button",
                    {
                      onClick: _cache[5] || (_cache[5] = ($event) => run(false))
                    },
                    toDisplayString(_ctx.$t("Vorschau")),
                    1
                    /* TEXT */
                  ),
                  createElementVNode(
                    "button",
                    {
                      class: "primary",
                      onClick: _cache[6] || (_cache[6] = ($event) => run(true))
                    },
                    toDisplayString(_ctx.$t("⇪ herunterladen")),
                    1
                    /* TEXT */
                  ),
                  unref(plugins).enabled("export") ? (openBlock(), createBlock(_component_router_link, {
                    key: 0,
                    to: "/p/tasker/jobs?new=export",
                    custom: ""
                  }, {
                    default: withCtx(({ navigate }) => [
                      createElementVNode("button", {
                        onClick: navigate,
                        title: _ctx.$t("denselben Export regelmäßig als Datei in ein Verzeichnis — Plugin export (Prozess)")
                      }, toDisplayString(_ctx.$t("⏱ als Job")), 9, _hoisted_27)
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
                        title: _ctx.$t("die Export-Jobs unter ⏱ Jobs — Zeitplan, Läufe, Logs")
                      }, toDisplayString(_ctx.$t("⏱ Jobs verwalten")), 9, _hoisted_28)
                    ]),
                    _: 1
                    /* STABLE */
                  })) : createCommentVNode("v-if", true)
                ])
              ])
            ])
          ])
        ]),
        createElementVNode("div", _hoisted_29, [
          createTextVNode(
            toDisplayString(_ctx.$t("3 · Vorschau") + " "),
            1
            /* TEXT */
          ),
          createElementVNode(
            "span",
            _hoisted_30,
            toDisplayString(_ctx.$t("· erste 200 Zeilen")),
            1
            /* TEXT */
          )
        ]),
        createElementVNode("div", _hoisted_31, [
          table.value ? (openBlock(), createElementBlock("table", _hoisted_32, [
            createElementVNode("thead", null, [
              createElementVNode("tr", null, [
                (openBlock(true), createElementBlock(
                  Fragment,
                  null,
                  renderList(table.value.columns, (c) => {
                    return openBlock(), createElementBlock("th", {
                      key: c.key,
                      title: c.attr ? `${c.attr} · ${c.locale}` : c.key
                    }, toDisplayString(c.key), 9, _hoisted_33);
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
            _hoisted_34,
            toDisplayString(_ctx.$t("… {0} weitere Zeilen in der Datei", [table.value.rows.length - 200])),
            1
            /* TEXT */
          )) : createCommentVNode("v-if", true),
          !table.value ? (openBlock(), createElementBlock(
            "div",
            _hoisted_35,
            toDisplayString(_ctx.$t("Teilbaum wählen, dann Vorschau oder herunterladen.")),
            1
            /* TEXT */
          )) : createCommentVNode("v-if", true)
        ])
      ]);
    };
  }
};
const ExportView = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-5d82639d"]]);
const roles = ["group", "product"];
const entry = {
  views: [
    { path: "import", topic: "import", label: t("Tabellen-Import"), icon: "⊞", hint: t("CSV, Excel, JSON, Zwischenablage — mit Datenmapper"), component: ImportView },
    { path: "export", topic: "export", label: t("Tabellen-Export"), icon: "⊞", hint: t("Excel, CSV — die Form, die der Tabellenimport liest"), component: ExportView }
  ],
  // Excel am Knoten
  nodeActions: [
    { topic: "export", roles, icon: "⇪", label: (r, below) => t("Excel: Vorlage für {0}", [below]), run: (id) => nodeWorkbook(id, false).catch((e) => store.toast(e.message)) },
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
