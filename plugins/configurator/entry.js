(function(){const s=document.createElement('style');s.textContent="\n.sel[data-v-fbf6a552] { display: inline-flex; flex-wrap: wrap; gap: 4px; align-items: center;\n}\n.wahl[data-v-fbf6a552] { display: inline-flex; align-items: center; gap: 2px;\n}\n.popover[data-v-fbf6a552] { position: fixed; z-index: 1000; width: 340px; overflow: auto; padding: 6px; background: var(--pane); border: 1px solid var(--line); border-radius: 6px; box-shadow: 0 6px 20px rgba(0,0,0,.35);\n}\n.knoten[data-v-fbf6a552] { border: 1px solid var(--line); background: var(--pane); color: var(--text); padding: 1px 8px; cursor: pointer; border-radius: 3px; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;\n}\n.knoten.leer[data-v-fbf6a552] { color: var(--accent); border-style: dashed;\n}\n.x[data-v-fbf6a552] { border: 0; background: none; color: var(--muted); padding: 0 4px; cursor: pointer;\n}\n.x[data-v-fbf6a552]:hover { color: var(--neg);\n}\n.filter[data-v-fbf6a552] { border: 0; background: none; color: var(--muted); cursor: pointer; font-size: 12px;\n}\n.filter[data-v-fbf6a552]:hover { color: var(--accent);\n}\n.attr[data-v-fbf6a552] { max-width: 160px;\n}\n.cmp[data-v-fbf6a552] { width: 52px;\n}\n.wert[data-v-fbf6a552] { width: 80px;\n}\n\n.cond[data-v-3168b8b5] { display: flex; flex-wrap: wrap; gap: 4px; align-items: center;\n}\n.teil[data-v-3168b8b5] { display: flex; align-items: flex-start; gap: 4px; width: 100%;\n}\n.kind[data-v-3168b8b5] { min-width: 84px;\n}\n.cmp[data-v-3168b8b5] { width: 52px;\n}\n.zahl[data-v-3168b8b5] { width: 64px;\n}\n.res[data-v-3168b8b5] { width: 110px;\n}\n.attr[data-v-3168b8b5] { max-width: 160px;\n}\n.mal[data-v-3168b8b5] { color: var(--muted);\n}\n.plus[data-v-3168b8b5], .x[data-v-3168b8b5] { border: 0; background: none; color: var(--muted); cursor: pointer; padding: 0 4px;\n}\n.plus[data-v-3168b8b5]:hover { color: var(--accent);\n}\n.x[data-v-3168b8b5]:hover { color: var(--neg);\n}\n\n.satz-regel[data-v-fd22fced] { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 14px;\n}\n.zahl[data-v-fd22fced] { width: 56px;\n}\n\n.hilfe[data-v-f8703721] { margin: 0 0 10px;\n}\n.hilfe ul[data-v-f8703721] { margin: 4px 0 0 18px; padding: 0; font-size: 13px; color: var(--muted);\n}\n.regel[data-v-f8703721] { border: 1px solid var(--line); border-radius: 6px; padding: 8px 10px; margin: 0 0 8px; background: var(--pane);\n}\n.kopf[data-v-f8703721], .zeile[data-v-f8703721] { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 0 0 6px;\n}\n.kennung[data-v-f8703721] { width: 70px;\n}\n.text[data-v-f8703721] { flex: 1; min-width: 200px;\n}\n.wenn[data-v-f8703721] { display: inline-flex; gap: 4px; align-items: center; width: 52px; color: var(--muted);\n}\n.dann[data-v-f8703721] { width: 52px; color: var(--muted);\n}\n.folge[data-v-f8703721] { min-width: 170px;\n}\n.zahl[data-v-f8703721] { width: 64px;\n}\n.fuss[data-v-f8703721] { display: flex; gap: 8px; align-items: center; margin-top: 4px;\n}\n.satz[data-v-f8703721] { font-size: 12px; flex: 1;\n}\n.x[data-v-f8703721] { border: 0; background: none; color: var(--muted); cursor: pointer; padding: 0 4px;\n}\n.x[data-v-f8703721]:hover:not(:disabled) { color: var(--accent);\n}\n.x[data-v-f8703721]:disabled { opacity: .3; cursor: default;\n}\n.neu[data-v-f8703721] { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 8px;\n}\n.vorlage[data-v-f8703721], .neue-regel[data-v-f8703721] { border: 1px dashed var(--line); background: none; color: var(--muted); padding: 5px 12px; cursor: pointer; border-radius: 6px;\n}\n.vorlage[data-v-f8703721]:hover, .neue-regel[data-v-f8703721]:hover { color: var(--accent); border-color: var(--accent);\n}\n\n.teil[data-v-69623a03] { border: 1px solid var(--line); border-radius: 6px; padding: 8px 10px; margin: 8px 0; background: var(--pane);\n}\n.kopf[data-v-69623a03] { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 0 0 8px;\n}\n.grow[data-v-69623a03] { flex: 1;\n}\n.zeile[data-v-69623a03] { margin: 0 0 8px; padding: 0 0 6px; border-bottom: 1px dashed var(--line);\n}\n.felder[data-v-69623a03] { display: flex; flex-wrap: wrap; gap: 6px; align-items: center;\n}\n.grp[data-v-69623a03] { width: 130px;\n}\n.art[data-v-69623a03] { min-width: 90px;\n}\n.zahl[data-v-69623a03] { width: 70px;\n}\n.wert[data-v-69623a03] { width: 110px;\n}\n.werte[data-v-69623a03] { width: 160px;\n}\n.wenn[data-v-69623a03] { display: inline-flex; gap: 4px; align-items: center; color: var(--muted);\n}\n.bedingung[data-v-69623a03] { margin: 6px 0 0 8px; padding-left: 8px; border-left: 2px solid var(--line);\n}\n.satz[data-v-69623a03] { font-size: 12px; margin-top: 4px;\n}\n.neu[data-v-69623a03] { display: flex; gap: 6px;\n}\n.neue-zeile[data-v-69623a03], .neue-vorgabe[data-v-69623a03] { border: 1px dashed var(--line); background: none; color: var(--muted); padding: 4px 12px; cursor: pointer; border-radius: 6px;\n}\n.neue-zeile[data-v-69623a03]:hover, .neue-vorgabe[data-v-69623a03]:hover { color: var(--accent); border-color: var(--accent);\n}\n.x[data-v-69623a03] { border: 0; background: none; color: var(--muted); cursor: pointer; padding: 0 4px;\n}\n.x[data-v-69623a03]:hover { color: var(--neg);\n}\n\n.gruppen[data-v-56b38a7c] { padding: 4px 0;\n}\n.spalten[data-v-56b38a7c] { display: flex; gap: 16px; align-items: flex-start;\n}\n.liste[data-v-56b38a7c] { width: 240px; flex: none;\n}\n.rechts[data-v-56b38a7c] { flex: 1; min-width: 0;\n}\n.neu[data-v-56b38a7c] { display: flex; gap: 6px; margin: 8px 0;\n}\n.neu input[data-v-56b38a7c] { flex: 1; min-width: 0;\n}\n.kopf[data-v-56b38a7c] { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 6px 0;\n}\n.bez[data-v-56b38a7c] { flex: 1; min-width: 160px;\n}\n.gleich[data-v-56b38a7c] { display: inline-flex; gap: 4px; align-items: center; color: var(--muted);\n}\n.fehler[data-v-56b38a7c] { list-style: none; padding-left: 0; margin: 0 0 8px;\n}\n.zusammen[data-v-56b38a7c] { max-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;\n}\n.leer[data-v-56b38a7c] { padding: 6px 0;\n}\n.grenzen[data-v-56b38a7c] { margin-top: 18px;\n}\n.grp[data-v-56b38a7c] { width: 130px;\n}\n.zahl[data-v-56b38a7c] { width: 70px;\n}\n.werte[data-v-56b38a7c] { width: 160px;\n}\n.satz[data-v-56b38a7c] { font-size: 12px;\n}\n.neues-teil[data-v-56b38a7c], .neue-grenze[data-v-56b38a7c] { border: 1px dashed var(--line); background: none; color: var(--muted); padding: 4px 12px; cursor: pointer; border-radius: 6px;\n}\n.neues-teil[data-v-56b38a7c]:hover, .neue-grenze[data-v-56b38a7c]:hover { color: var(--accent); border-color: var(--accent);\n}\n.x[data-v-56b38a7c] { border: 0; background: none; color: var(--muted); cursor: pointer; padding: 0 4px;\n}\n.x[data-v-56b38a7c]:hover { color: var(--neg);\n}\n\n.faelle[data-v-ebd18361] { margin-top: 14px;\n}\n.kopf[data-v-ebd18361] { display: flex; gap: 6px; align-items: center; margin: 4px 0;\n}\n.kopf input[data-v-ebd18361] { flex: 1; min-width: 120px;\n}\n.diff[data-v-ebd18361] { font-size: 12px;\n}\n.x[data-v-ebd18361] { border: 0; background: none; color: var(--muted); cursor: pointer; padding: 0 4px;\n}\n.x[data-v-ebd18361]:hover { color: var(--accent);\n}\n\n.pruef[data-v-d7115c5d] { padding: 8px 0;\n}\n.spalten[data-v-d7115c5d] { display: flex; gap: 16px; align-items: flex-start;\n}\n.links[data-v-d7115c5d] { flex: 1; min-width: 320px;\n}\n.waehlbar[data-v-d7115c5d] { flex: 1; min-width: 320px;\n}\n.eingabe[data-v-d7115c5d] { display: flex; gap: 6px; margin: 4px 0;\n}\n.eingabe input[data-v-d7115c5d] { flex: 1;\n}\n.zahl[data-v-d7115c5d] { width: 60px;\n}\n.status[data-v-d7115c5d] { display: flex; gap: 8px; margin: 10px 0 4px;\n}\n.chip[data-v-d7115c5d] { font-weight: 600;\n}\n.meldungen[data-v-d7115c5d] { margin: 4px 0; padding-left: 16px; list-style: none;\n}\n.hinweis[data-v-d7115c5d] { margin: 0 0 6px;\n}\n.leer[data-v-d7115c5d] { padding: 6px 0;\n}\n.filter[data-v-d7115c5d] { width: 100%; margin: 4px 0;\n}\ntr.gesperrt[data-v-d7115c5d] { opacity: .55; cursor: not-allowed;\n}\ntr[data-v-d7115c5d]:not(.gesperrt) { cursor: pointer;\n}\n.grund[data-v-d7115c5d] { font-size: 12px;\n}\n.bilanz[data-v-d7115c5d] { margin-top: 8px;\n}\n.x[data-v-d7115c5d] { border: 0; background: none; color: var(--muted); cursor: pointer;\n}\n.x[data-v-d7115c5d]:hover { color: var(--neg);\n}\n\n.seiten[data-v-0df34234] { display: flex; gap: 16px; align-items: flex-start; padding: 8px 12px; overflow: auto;\n}\n.liste[data-v-0df34234] { width: 240px; flex: none;\n}\n.rechts[data-v-0df34234] { flex: 1; min-width: 0;\n}\n.neu[data-v-0df34234] { display: flex; gap: 6px; margin: 8px 0;\n}\n.neu input[data-v-0df34234] { flex: 1; min-width: 0;\n}\n.kopf[data-v-0df34234] { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 0 0 8px;\n}\n.bez[data-v-0df34234] { flex: 1; min-width: 200px;\n}\n.res[data-v-0df34234] { width: 140px;\n}\n.knoten[data-v-0df34234] { border: 1px solid var(--line); background: var(--pane); color: var(--text); padding: 1px 8px; cursor: pointer; border-radius: 3px; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;\n}\n.x[data-v-0df34234] { border: 0; background: none; color: var(--muted); cursor: pointer; padding: 0 4px;\n}\n.x[data-v-0df34234]:hover { color: var(--neg);\n}\n.fehler[data-v-0df34234] { list-style: none; padding-left: 0; margin: 0 0 8px;\n}\n.tabs[data-v-0df34234] { display: flex; gap: 4px; margin: 8px 0; border-bottom: 1px solid var(--line);\n}\n.tabs button[data-v-0df34234] { border: 0; border-bottom: 2px solid transparent; background: none; color: var(--muted); padding: 4px 12px; cursor: pointer;\n}\n.tabs button.on[data-v-0df34234] { color: var(--text); border-bottom-color: var(--accent);\n}\n.leer[data-v-0df34234] { padding: 24px;\n}\n\n.konfband[data-v-05d59a55] { padding: 0 0 4px;\n}\n.saetze[data-v-05d59a55] { margin: 0 0 6px; padding-left: 16px;\n}\n.satz[data-v-05d59a55] { font-size: 13px;\n}\n.geerbt[data-v-05d59a55] { margin: 0 0 6px;\n}\n.leiste[data-v-05d59a55] { display: flex; gap: 6px;\n}\n.bearbeiten[data-v-05d59a55] { border: 1px dashed var(--line); background: none; color: var(--muted); padding: 4px 12px; cursor: pointer; border-radius: 6px;\n}\n.bearbeiten[data-v-05d59a55]:hover { color: var(--accent); border-color: var(--accent);\n}\n";document.head.append(s)})();
const m = window.journali.vue;
const Fragment = m.Fragment;
const Teleport = m.Teleport;
const computed = m.computed;
const createApp = m.createApp;
const createBlock = m.createBlock;
const createCommentVNode = m.createCommentVNode;
const createElementBlock = m.createElementBlock;
const createElementVNode = m.createElementVNode;
const createTextVNode = m.createTextVNode;
const createVNode = m.createVNode;
const h$1 = m.h;
const normalizeClass = m.normalizeClass;
const normalizeStyle = m.normalizeStyle;
const onBeforeUnmount = m.onBeforeUnmount;
const onMounted = m.onMounted;
const openBlock = m.openBlock;
const reactive = m.reactive;
const ref = m.ref;
const renderList = m.renderList;
const resolveComponent = m.resolveComponent;
const toDisplayString = m.toDisplayString;
const unref = m.unref;
const vModelCheckbox = m.vModelCheckbox;
const vModelSelect = m.vModelSelect;
const vModelText = m.vModelText;
const watch = m.watch;
const withDirectives = m.withDirectives;
const withKeys = m.withKeys;
const withModifiers = m.withModifiers;
const h = window.journali;
const api = h.api;
const store = h.store;
const tree = h.tree;
const dialog = h.dialog;
const t = h.t;
const L = h.L;
const TreePicker = h.TreePicker;
const COMPARISONS = ["=", "!=", ">", ">=", "<", "<="];
const CONDITION_KINDS = ["has", "count", "sum", "balance", "and", "or", "not"];
const EFFECT_KINDS = ["forbids", "limits", "requires"];
const KEY_PATTERN = /^[a-z][a-z0-9_-]{0,39}$/;
const emptyDefinition = (label = "") => ({ label, rules: [] });
function newCondition(kind) {
  switch (kind) {
    case "has":
      return { kind, selector: {}, value: 1 };
    case "count":
      return { kind, selector: {}, comparison: ">=", value: 1 };
    case "sum":
      return { kind, selector: {}, attribute: "", comparison: ">", value: 0 };
    case "balance":
      return { kind, resource: "", comparison: "<=", value: 0 };
    case "and":
    case "or":
    case "not":
      return { kind, parts: [newCondition("has")] };
    default:
      return { kind: "has", selector: {}, value: 1 };
  }
}
function newEffect(kind) {
  switch (kind) {
    case "limits":
      return { kind, selector: {}, max: 1 };
    case "requires":
      return { kind, selector: {}, min: 1 };
    default:
      return { kind: "forbids", selector: {} };
  }
}
function nextRuleId(rules) {
  const used = new Set((rules ?? []).map((r) => r.id));
  for (let i = 1; ; i++) if (!used.has("r" + i)) return "r" + i;
}
const blank = (v) => v === void 0 || v === null || typeof v === "string" && v.trim() === "";
const number = (v) => {
  if (blank(v)) return void 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : void 0;
};
function cleanSelector(s) {
  const o = {};
  if (!blank(s?.node)) o.node = String(s.node);
  if (!blank(s?.attribute)) {
    o.attribute = String(s.attribute).trim();
    if (!blank(s.comparison)) o.comparison = s.comparison;
    if (!blank(s.value)) o.value = String(s.value);
  }
  return o;
}
function cleanCondition(c) {
  const o = { kind: c.kind };
  if (c.selector) o.selector = cleanSelector(c.selector);
  if (!blank(c.attribute)) o.attribute = String(c.attribute).trim();
  if (!blank(c.resource)) o.resource = String(c.resource).trim();
  if (!blank(c.comparison)) o.comparison = c.comparison;
  if (number(c.value) !== void 0) o.value = number(c.value);
  if (c.parts) o.parts = c.parts.map(cleanCondition);
  return o;
}
const has = (v) => !blank(v);
const text = (v) => Array.isArray(v) ? v.join(", ") : String(v ?? "");
const valuesOf = (v) => (Array.isArray(v) ? v : String(v ?? "").split(",")).map((x) => String(x).trim()).filter(Boolean);
const valuesText = (x) => x?.valuesText !== void 0 ? x.valuesText : text(x?.values);
const isLimit = (r) => has(r?.min) || has(r?.max) || valuesOf(r?.values).length > 0 || valuesOf(r?.valuesText).length > 0;
const rowKind = (r) => r?.art ?? (isLimit(r) ? "limit" : "member");
const newRow = (art = "member", group = "") => ({ art, group });
function cleanRow(r) {
  const o = { group: String(r?.group ?? "").trim() };
  if (r?.when) o.when = cleanCondition(r.when);
  if (rowKind(r) === "limit") {
    if (number(r.min) !== void 0) o.min = number(r.min);
    if (number(r.max) !== void 0) o.max = number(r.max);
    const values = valuesOf(r.valuesText !== void 0 ? r.valuesText : r.values);
    if (values.length) o.values = values;
  } else {
    if (number(r.provides) !== void 0) o.provides = number(r.provides);
    if (number(r.consumes) !== void 0) o.consumes = number(r.consumes);
    if (has(r.value)) o.value = String(r.value).trim();
  }
  return o;
}
const cleanRows = (rows) => (rows ?? []).map(cleanRow);
function cleanLimit(l) {
  const o = { group: String(l?.group ?? "").trim() };
  if (number(l.min) !== void 0) o.min = number(l.min);
  if (number(l.max) !== void 0) o.max = number(l.max);
  const values = valuesOf(l.valuesText !== void 0 ? l.valuesText : l.values);
  if (values.length) o.values = values;
  return o;
}
const cleanLimits = (limits) => (limits ?? []).map(cleanLimit);
function cleanDefinition(def) {
  const out = {};
  if (!blank(def?.label)) out.label = String(def.label).trim();
  if (!blank(def?.root)) out.root = def.root;
  if (!blank(def?.resources)) out.resources = String(def.resources).trim();
  out.rules = (def?.rules ?? []).map((r) => {
    const rule = { id: String(r.id ?? "").trim() };
    if (!blank(r.text)) rule.text = String(r.text).trim();
    if (r.if) rule.if = cleanCondition(r.if);
    if (r.then) {
      const e = { kind: r.then.kind, selector: cleanSelector(r.then.selector) };
      if (number(r.then.min) !== void 0) e.min = number(r.then.min);
      if (number(r.then.max) !== void 0) e.max = number(r.then.max);
      rule.then = e;
    }
    return rule;
  });
  const limits = cleanLimits(def?.limits);
  if (limits.length) out.limits = limits;
  return out;
}
const violationKey = (v) => v.group ? v.kind + ":" + v.group : "rule:" + v.rule;
const expectFrom = (r) => ({
  valid: !!r.valid,
  complete: !!r.complete,
  violations: (r.violations ?? []).map(violationKey).sort(),
  missing: (r.missing ?? []).map(violationKey).sort()
});
function compareCase(expect, result) {
  const actual = expectFrom(result);
  const diff = [];
  if (expect.valid !== actual.valid) diff.push({ what: "valid", expected: expect.valid, actual: actual.valid });
  if (expect.complete !== actual.complete) diff.push({ what: "complete", expected: expect.complete, actual: actual.complete });
  for (const list of ["violations", "missing"]) {
    const want = new Set(expect[list] ?? []), have = new Set(actual[list]);
    for (const k of want) if (!have.has(k)) diff.push({ what: list, expected: k, actual: null });
    for (const k of have) if (!want.has(k)) diff.push({ what: list, expected: null, actual: k });
  }
  return { ok: diff.length === 0, differences: diff };
}
const TEMPLATES = ["excludes", "needs", "max", "min"];
function templateRule(id, kind) {
  switch (kind) {
    case "excludes":
      return { id, text: "", if: { kind: "has", selector: {}, value: 1 }, then: { kind: "forbids", selector: {} } };
    case "needs":
      return { id, text: "", if: { kind: "has", selector: {}, value: 1 }, then: { kind: "requires", selector: {}, min: 1 } };
    case "max":
      return { id, text: "", then: { kind: "limits", selector: {}, max: 1 } };
    case "min":
      return { id, text: "", then: { kind: "requires", selector: {}, min: 1 } };
    default:
      return { id, text: "", then: newEffect("forbids") };
  }
}
function templateOf(r) {
  const einfach = !r.if || r.if.kind === "has" && (r.if.value ?? 1) <= 1;
  if (!einfach) return null;
  if (r.if && r.then?.kind === "forbids") return "excludes";
  if (r.if && r.then?.kind === "requires") return "needs";
  if (!r.if && r.then?.kind === "limits") return "max";
  if (!r.if && r.then?.kind === "requires") return "min";
  return null;
}
const op = (c) => ({ "=": "=", "!=": "≠", ">": ">", ">=": "≥", "<": "<", "<=": "≤" })[c] ?? c;
function describeSelector(s, { t: t2, nodeName, attributeName = (k) => k }) {
  const filter = s?.attribute ? `${attributeName(s.attribute)} ${op(s.comparison)} ${s.value ?? ""}`.trim() : "";
  if (s?.node && filter) return `${nodeName(s.node)} (${filter})`;
  if (s?.node) return nodeName(s.node);
  return filter || t2("jedes Teil");
}
function describeCondition(c, ctx) {
  const { t: t2 } = ctx;
  const sel = () => describeSelector(c.selector, ctx);
  switch (c.kind) {
    case "has":
      return (c.value ?? 1) > 1 ? t2("mindestens {0} × {1} gewählt", [c.value, sel()]) : t2("{0} gewählt", [sel()]);
    case "count":
      return t2("Anzahl {0} {1} {2}", [sel(), op(c.comparison), c.value ?? ""]);
    case "sum":
      return t2("Summe {0} von {1} {2} {3}", [ctx.attributeName?.(c.attribute) ?? c.attribute ?? "", sel(), op(c.comparison), c.value ?? ""]);
    case "balance":
      return t2("Bilanz {0} {1} {2}", [c.resource ?? "", op(c.comparison), c.value ?? ""]);
    case "and":
      return (c.parts ?? []).map((p) => describeCondition(p, ctx)).join(t2(" und "));
    case "or":
      return (c.parts ?? []).map((p) => describeCondition(p, ctx)).join(t2(" oder "));
    case "not":
      return t2("nicht ({0})", [describeCondition(c.parts?.[0] ?? { kind: "has", selector: {} }, ctx)]);
    default:
      return "";
  }
}
function describeEffect(e, ctx) {
  const { t: t2 } = ctx;
  const sel = describeSelector(e?.selector, ctx);
  switch (e?.kind) {
    case "forbids":
      return t2("{0} verboten", [sel]);
    case "limits":
      return t2("höchstens {0} von {1}", [e.max ?? 0, sel]);
    case "requires":
      return t2("mindestens {0} von {1} verlangt", [e.min ?? 1, sel]);
    default:
      return "";
  }
}
function describeRule(r, ctx) {
  const then = describeEffect(r.then, ctx);
  return r.if ? ctx.t("Wenn {0}, dann {1}", [describeCondition(r.if, ctx), then]) : ctx.t("Immer: {0}", [then]);
}
function describeRow(r, ctx) {
  const { t: t2 } = ctx;
  const group = ctx.groupName?.(r.group) ?? r.group ?? "";
  const num = (v) => v !== void 0 && v !== null && v !== "";
  const values = (r.valuesText !== void 0 ? String(r.valuesText).split(",") : Array.isArray(r.values) ? r.values : String(r.values ?? "").split(",")).map((x) => String(x).trim()).filter(Boolean);
  const limit = num(r.min) || num(r.max) || values.length > 0;
  const parts = [];
  if (limit) {
    if (num(r.min) && num(r.max)) parts.push(Number(r.min) === Number(r.max) ? t2("genau {0} Teile", [r.max]) : t2("{0} bis {1} Teile", [r.min, r.max]));
    else if (num(r.min)) parts.push(t2("mindestens {0} Teile", [r.min]));
    else if (num(r.max)) parts.push(t2("höchstens {0} Teile", [r.max]));
    if (values.length) parts.push(t2("Werte {0}", [values.join(", ")]));
  } else {
    if (num(r.provides)) parts.push(t2("stellt {0} bereit", [r.provides]));
    if (num(r.consumes)) parts.push(t2("verbraucht {0}", [r.consumes]));
    if (num(r.value)) parts.push(t2("Wert {0}", [r.value]));
    if (!parts.length) parts.push(t2("Mitglied"));
  }
  const when = r.when ? t2(", wenn {0}", [describeCondition(r.when, ctx)]) : "";
  return `${group}: ${parts.join(", ")}${when}`;
}
const _export_sfc = (sfc, props) => {
  const target = sfc.__vccOpts || sfc;
  for (const [key, val] of props) {
    target[key] = val;
  }
  return target;
};
const _hoisted_1$9 = { class: "sel" };
const _hoisted_2$8 = { class: "wahl" };
const _hoisted_3$8 = ["title"];
const _hoisted_4$8 = ["title"];
const _hoisted_5$8 = ["title"];
const _hoisted_6$8 = ["title"];
const _hoisted_7$8 = { value: "" };
const _hoisted_8$7 = ["value"];
const _hoisted_9$7 = ["value"];
const _hoisted_10$7 = ["placeholder"];
const HOEHE = 300;
const _sfc_main$9 = {
  __name: "SelectorEditor",
  props: { sel: { type: Object, required: true }, attributes: { type: Array, default: () => [] }, compact: { type: Boolean, default: false } },
  setup(__props) {
    const props = __props;
    const open = ref(false);
    const knopf = ref(null);
    const lage = ref({});
    const popover = ref(null);
    function oeffnen() {
      if (open.value) return schliessen();
      const r = knopf.value?.getBoundingClientRect?.();
      const unten = r ? (window.innerHeight ?? 800) - r.bottom : HOEHE;
      lage.value = r ? { left: Math.max(4, Math.min(r.left, (window.innerWidth ?? 1200) - 360)) + "px", ...unten < HOEHE && r.top > unten ? { bottom: (window.innerHeight ?? 800) - r.top + 4 + "px", maxHeight: Math.max(160, r.top - 12) + "px" } : { top: r.bottom + 4 + "px", maxHeight: Math.max(160, unten - 12) + "px" } } : {};
      open.value = true;
      document.addEventListener("mousedown", ausserhalb, true);
      document.addEventListener("keydown", taste, true);
    }
    function schliessen() {
      open.value = false;
      document.removeEventListener("mousedown", ausserhalb, true);
      document.removeEventListener("keydown", taste, true);
    }
    const ausserhalb = (e) => {
      if (!popover.value?.contains(e.target) && !knopf.value?.contains(e.target)) schliessen();
    };
    const taste = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        schliessen();
      }
    };
    onBeforeUnmount(schliessen);
    const filterOpen = ref(!!props.sel.attribute);
    watch(() => props.sel.attribute, (attribute) => {
      if (attribute && !props.sel.comparison) props.sel.comparison = "=";
      if (attribute) filterOpen.value = true;
    }, { immediate: true });
    const nodeName = (id) => tree.byId?.get(id)?.label ?? id;
    const OP = { "=": "=", "!=": "≠", ">": ">", ">=": "≥", "<": "<", "<=": "≤" };
    const showFilter = () => !props.compact || filterOpen.value;
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("span", _hoisted_1$9, [
        createElementVNode("span", _hoisted_2$8, [
          createElementVNode("button", {
            ref_key: "knopf",
            ref: knopf,
            type: "button",
            class: normalizeClass(["knoten", { leer: !props.sel.node }]),
            title: _ctx.$t("Knoten wählen: ein Produkt, eine Variante oder eine Gruppe mit allem darunter"),
            onClick: oeffnen
          }, toDisplayString(props.sel.node ? nodeName(props.sel.node) : _ctx.$t("Teil wählen …")), 11, _hoisted_3$8),
          props.sel.node ? (openBlock(), createElementBlock("button", {
            key: 0,
            type: "button",
            class: "x",
            title: _ctx.$t("Knoten entfernen"),
            onClick: _cache[0] || (_cache[0] = ($event) => props.sel.node = "")
          }, "✕", 8, _hoisted_4$8)) : createCommentVNode("v-if", true),
          (openBlock(), createBlock(Teleport, { to: "body" }, [
            open.value ? (openBlock(), createElementBlock(
              "div",
              {
                key: 0,
                ref_key: "popover",
                ref: popover,
                class: "popover",
                style: normalizeStyle(lage.value)
              },
              [
                createVNode(unref(TreePicker), {
                  modelValue: props.sel.node,
                  "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => props.sel.node = $event),
                  roles: ["group", "product", "variant"],
                  height: 200,
                  onPick: schliessen
                }, null, 8, ["modelValue"])
              ],
              4
              /* STYLE */
            )) : createCommentVNode("v-if", true)
          ]))
        ]),
        __props.compact && !filterOpen.value ? (openBlock(), createElementBlock("button", {
          key: 0,
          type: "button",
          class: "filter",
          title: _ctx.$t("Nur Teile, deren Attribut einen bestimmten Wert hat — etwa Leistung ≥ 850"),
          onClick: _cache[2] || (_cache[2] = ($event) => filterOpen.value = true)
        }, "＋ " + toDisplayString(_ctx.$t("Filter")), 9, _hoisted_5$8)) : createCommentVNode("v-if", true),
        showFilter() ? (openBlock(), createElementBlock(
          Fragment,
          { key: 1 },
          [
            withDirectives(createElementVNode("select", {
              "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => props.sel.attribute = $event),
              class: "attr",
              title: _ctx.$t("Nur Teile, deren Attribut so ist")
            }, [
              createElementVNode(
                "option",
                _hoisted_7$8,
                toDisplayString(_ctx.$t("— kein Filter —")),
                1
                /* TEXT */
              ),
              (openBlock(true), createElementBlock(
                Fragment,
                null,
                renderList(props.attributes, (a) => {
                  return openBlock(), createElementBlock("option", {
                    key: a.key,
                    value: a.key
                  }, toDisplayString(a.label), 9, _hoisted_8$7);
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ], 8, _hoisted_6$8), [
              [vModelSelect, props.sel.attribute]
            ]),
            props.sel.attribute ? (openBlock(), createElementBlock(
              Fragment,
              { key: 0 },
              [
                withDirectives(createElementVNode(
                  "select",
                  {
                    "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => props.sel.comparison = $event),
                    class: "cmp"
                  },
                  [
                    (openBlock(true), createElementBlock(
                      Fragment,
                      null,
                      renderList(unref(COMPARISONS), (c) => {
                        return openBlock(), createElementBlock("option", {
                          key: c,
                          value: c
                        }, toDisplayString(OP[c]), 9, _hoisted_9$7);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ],
                  512
                  /* NEED_PATCH */
                ), [
                  [vModelSelect, props.sel.comparison]
                ]),
                withDirectives(createElementVNode("input", {
                  "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => props.sel.value = $event),
                  class: "wert",
                  placeholder: _ctx.$t("Wert")
                }, null, 8, _hoisted_10$7), [
                  [vModelText, props.sel.value]
                ])
              ],
              64
              /* STABLE_FRAGMENT */
            )) : createCommentVNode("v-if", true)
          ],
          64
          /* STABLE_FRAGMENT */
        )) : createCommentVNode("v-if", true)
      ]);
    };
  }
};
const SelectorEditor = /* @__PURE__ */ _export_sfc(_sfc_main$9, [["__scopeId", "data-v-fbf6a552"]]);
const _hoisted_1$8 = ["value", "title"];
const _hoisted_2$7 = ["value"];
const _hoisted_3$7 = ["title"];
const _hoisted_4$7 = ["value"];
const _hoisted_5$7 = ["title"];
const _hoisted_6$7 = { value: "" };
const _hoisted_7$7 = ["value"];
const _hoisted_8$6 = ["value"];
const _hoisted_9$6 = ["placeholder"];
const _hoisted_10$6 = ["value"];
const _hoisted_11$6 = ["title"];
const _hoisted_12$6 = ["title", "onClick"];
const _sfc_main$8 = {
  __name: "ConditionEditor",
  props: { cond: { type: Object, required: true }, attributes: { type: Array, default: () => [] }, depth: { type: Number, default: 1 }, kinds: { type: Array, default: () => CONDITION_KINDS } },
  setup(__props) {
    const props = __props;
    const OP = { "=": "=", "!=": "≠", ">": ">", ">=": "≥", "<": "<", "<=": "≤" };
    const KIND = {
      has: t("hat"),
      count: t("Anzahl"),
      sum: t("Summe"),
      balance: t("Bilanz"),
      and: t("alle von"),
      or: t("eine von"),
      not: t("keine von")
    };
    const TITLE = {
      has: t("Teile sind gewählt; der Wert ist die Mindestmenge"),
      count: t("Menge der gewählten Teile vergleichen"),
      sum: t("Menge × Zahlenwert eines Attributs, aufsummiert"),
      balance: t("Bereit minus verbraucht einer Gruppe vergleichen"),
      and: t("Alle Teilbedingungen treffen zu"),
      or: t("Mindestens eine Teilbedingung trifft zu"),
      not: t("Die Teilbedingung trifft nicht zu")
    };
    function kind(k) {
      if (k === props.cond.kind) return;
      for (const key of Object.keys(props.cond)) delete props.cond[key];
      Object.assign(props.cond, newCondition(k));
    }
    const addPart = () => props.cond.parts.push(newCondition("has"));
    const removePart = (i) => props.cond.parts.splice(i, 1);
    return (_ctx, _cache) => {
      const _component_ConditionEditor = resolveComponent("ConditionEditor", true);
      return openBlock(), createElementBlock(
        "div",
        {
          class: "cond",
          style: normalizeStyle({ marginLeft: __props.depth > 1 ? "14px" : 0 })
        },
        [
          createElementVNode("select", {
            value: __props.cond.kind,
            class: "kind",
            title: TITLE[__props.cond.kind],
            onChange: _cache[0] || (_cache[0] = ($event) => kind($event.target.value))
          }, [
            (openBlock(true), createElementBlock(
              Fragment,
              null,
              renderList(__props.kinds, (k) => {
                return openBlock(), createElementBlock("option", {
                  key: k,
                  value: k
                }, toDisplayString(KIND[k]), 9, _hoisted_2$7);
              }),
              128
              /* KEYED_FRAGMENT */
            ))
          ], 40, _hoisted_1$8),
          __props.cond.kind === "has" ? (openBlock(), createElementBlock(
            Fragment,
            { key: 0 },
            [
              createVNode(SelectorEditor, {
                sel: __props.cond.selector,
                attributes: __props.attributes
              }, null, 8, ["sel", "attributes"]),
              createElementVNode("label", {
                class: "mal",
                title: TITLE.has
              }, [
                _cache[10] || (_cache[10] = createTextVNode(
                  "≥ ",
                  -1
                  /* CACHED */
                )),
                withDirectives(createElementVNode(
                  "input",
                  {
                    "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => __props.cond.value = $event),
                    type: "number",
                    min: "1",
                    class: "zahl"
                  },
                  null,
                  512
                  /* NEED_PATCH */
                ), [
                  [
                    vModelText,
                    __props.cond.value,
                    void 0,
                    { number: true }
                  ]
                ])
              ], 8, _hoisted_3$7)
            ],
            64
            /* STABLE_FRAGMENT */
          )) : __props.cond.kind === "count" ? (openBlock(), createElementBlock(
            Fragment,
            { key: 1 },
            [
              createVNode(SelectorEditor, {
                sel: __props.cond.selector,
                attributes: __props.attributes
              }, null, 8, ["sel", "attributes"]),
              withDirectives(createElementVNode(
                "select",
                {
                  "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => __props.cond.comparison = $event),
                  class: "cmp"
                },
                [
                  (openBlock(true), createElementBlock(
                    Fragment,
                    null,
                    renderList(unref(COMPARISONS), (c) => {
                      return openBlock(), createElementBlock("option", {
                        key: c,
                        value: c
                      }, toDisplayString(OP[c]), 9, _hoisted_4$7);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ],
                512
                /* NEED_PATCH */
              ), [
                [vModelSelect, __props.cond.comparison]
              ]),
              withDirectives(createElementVNode(
                "input",
                {
                  "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => __props.cond.value = $event),
                  type: "number",
                  class: "zahl"
                },
                null,
                512
                /* NEED_PATCH */
              ), [
                [
                  vModelText,
                  __props.cond.value,
                  void 0,
                  { number: true }
                ]
              ])
            ],
            64
            /* STABLE_FRAGMENT */
          )) : __props.cond.kind === "sum" ? (openBlock(), createElementBlock(
            Fragment,
            { key: 2 },
            [
              withDirectives(createElementVNode("select", {
                "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => __props.cond.attribute = $event),
                class: "attr",
                title: _ctx.$t("Attribut, dessen Zahlenwerte summiert werden")
              }, [
                createElementVNode(
                  "option",
                  _hoisted_6$7,
                  toDisplayString(_ctx.$t("— Attribut —")),
                  1
                  /* TEXT */
                ),
                (openBlock(true), createElementBlock(
                  Fragment,
                  null,
                  renderList(__props.attributes, (a) => {
                    return openBlock(), createElementBlock("option", {
                      key: a.key,
                      value: a.key
                    }, toDisplayString(a.label), 9, _hoisted_7$7);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ], 8, _hoisted_5$7), [
                [vModelSelect, __props.cond.attribute]
              ]),
              createVNode(SelectorEditor, {
                sel: __props.cond.selector,
                attributes: __props.attributes
              }, null, 8, ["sel", "attributes"]),
              withDirectives(createElementVNode(
                "select",
                {
                  "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => __props.cond.comparison = $event),
                  class: "cmp"
                },
                [
                  (openBlock(true), createElementBlock(
                    Fragment,
                    null,
                    renderList(unref(COMPARISONS), (c) => {
                      return openBlock(), createElementBlock("option", {
                        key: c,
                        value: c
                      }, toDisplayString(OP[c]), 9, _hoisted_8$6);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ],
                512
                /* NEED_PATCH */
              ), [
                [vModelSelect, __props.cond.comparison]
              ]),
              withDirectives(createElementVNode(
                "input",
                {
                  "onUpdate:modelValue": _cache[6] || (_cache[6] = ($event) => __props.cond.value = $event),
                  type: "number",
                  class: "zahl"
                },
                null,
                512
                /* NEED_PATCH */
              ), [
                [
                  vModelText,
                  __props.cond.value,
                  void 0,
                  { number: true }
                ]
              ])
            ],
            64
            /* STABLE_FRAGMENT */
          )) : __props.cond.kind === "balance" ? (openBlock(), createElementBlock(
            Fragment,
            { key: 3 },
            [
              withDirectives(createElementVNode("input", {
                "onUpdate:modelValue": _cache[7] || (_cache[7] = ($event) => __props.cond.resource = $event),
                class: "res",
                placeholder: _ctx.$t("Gruppe")
              }, null, 8, _hoisted_9$6), [
                [vModelText, __props.cond.resource]
              ]),
              withDirectives(createElementVNode(
                "select",
                {
                  "onUpdate:modelValue": _cache[8] || (_cache[8] = ($event) => __props.cond.comparison = $event),
                  class: "cmp"
                },
                [
                  (openBlock(true), createElementBlock(
                    Fragment,
                    null,
                    renderList(unref(COMPARISONS), (c) => {
                      return openBlock(), createElementBlock("option", {
                        key: c,
                        value: c
                      }, toDisplayString(OP[c]), 9, _hoisted_10$6);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ],
                512
                /* NEED_PATCH */
              ), [
                [vModelSelect, __props.cond.comparison]
              ]),
              withDirectives(createElementVNode(
                "input",
                {
                  "onUpdate:modelValue": _cache[9] || (_cache[9] = ($event) => __props.cond.value = $event),
                  type: "number",
                  class: "zahl"
                },
                null,
                512
                /* NEED_PATCH */
              ), [
                [
                  vModelText,
                  __props.cond.value,
                  void 0,
                  { number: true }
                ]
              ])
            ],
            64
            /* STABLE_FRAGMENT */
          )) : (openBlock(), createElementBlock(
            Fragment,
            { key: 4 },
            [
              __props.cond.kind !== "not" ? (openBlock(), createElementBlock("button", {
                key: 0,
                type: "button",
                class: "plus",
                title: _ctx.$t("Teilbedingung hinzufügen"),
                onClick: addPart
              }, "＋", 8, _hoisted_11$6)) : createCommentVNode("v-if", true),
              (openBlock(true), createElementBlock(
                Fragment,
                null,
                renderList(__props.cond.parts, (p, i) => {
                  return openBlock(), createElementBlock("div", {
                    key: i,
                    class: "teil"
                  }, [
                    createVNode(_component_ConditionEditor, {
                      cond: p,
                      attributes: __props.attributes,
                      depth: __props.depth + 1,
                      kinds: __props.kinds
                    }, null, 8, ["cond", "attributes", "depth", "kinds"]),
                    __props.cond.parts.length > 1 ? (openBlock(), createElementBlock("button", {
                      key: 0,
                      type: "button",
                      class: "x",
                      title: _ctx.$t("Teilbedingung entfernen"),
                      onClick: ($event) => removePart(i)
                    }, "✕", 8, _hoisted_12$6)) : createCommentVNode("v-if", true)
                  ]);
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ],
            64
            /* STABLE_FRAGMENT */
          ))
        ],
        4
        /* STYLE */
      );
    };
  }
};
const ConditionEditor = /* @__PURE__ */ _export_sfc(_sfc_main$8, [["__scopeId", "data-v-3168b8b5"]]);
const _hoisted_1$7 = { class: "satz-regel" };
const _sfc_main$7 = {
  __name: "RuleSentence",
  props: { rule: { type: Object, required: true }, kind: { type: String, required: true }, attributes: { type: Array, default: () => [] } },
  setup(__props) {
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$7, [
        __props.kind === "excludes" ? (openBlock(), createElementBlock(
          Fragment,
          { key: 0 },
          [
            createElementVNode(
              "span",
              null,
              toDisplayString(_ctx.$t("Wenn")),
              1
              /* TEXT */
            ),
            createVNode(SelectorEditor, {
              sel: __props.rule.if.selector,
              attributes: __props.attributes,
              compact: ""
            }, null, 8, ["sel", "attributes"]),
            createElementVNode(
              "span",
              null,
              toDisplayString(_ctx.$t("gewählt ist, darf")),
              1
              /* TEXT */
            ),
            createVNode(SelectorEditor, {
              sel: __props.rule.then.selector,
              attributes: __props.attributes,
              compact: ""
            }, null, 8, ["sel", "attributes"]),
            createElementVNode(
              "span",
              null,
              toDisplayString(_ctx.$t("nicht gewählt sein.")),
              1
              /* TEXT */
            )
          ],
          64
          /* STABLE_FRAGMENT */
        )) : __props.kind === "needs" ? (openBlock(), createElementBlock(
          Fragment,
          { key: 1 },
          [
            createElementVNode(
              "span",
              null,
              toDisplayString(_ctx.$t("Wenn")),
              1
              /* TEXT */
            ),
            createVNode(SelectorEditor, {
              sel: __props.rule.if.selector,
              attributes: __props.attributes,
              compact: ""
            }, null, 8, ["sel", "attributes"]),
            createElementVNode(
              "span",
              null,
              toDisplayString(_ctx.$t("gewählt ist, müssen mindestens")),
              1
              /* TEXT */
            ),
            withDirectives(createElementVNode(
              "input",
              {
                "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => __props.rule.then.min = $event),
                type: "number",
                min: "1",
                class: "zahl"
              },
              null,
              512
              /* NEED_PATCH */
            ), [
              [
                vModelText,
                __props.rule.then.min,
                void 0,
                { number: true }
              ]
            ]),
            createElementVNode(
              "span",
              null,
              toDisplayString(_ctx.$t("von")),
              1
              /* TEXT */
            ),
            createVNode(SelectorEditor, {
              sel: __props.rule.then.selector,
              attributes: __props.attributes,
              compact: ""
            }, null, 8, ["sel", "attributes"]),
            createElementVNode(
              "span",
              null,
              toDisplayString(_ctx.$t("gewählt sein.")),
              1
              /* TEXT */
            )
          ],
          64
          /* STABLE_FRAGMENT */
        )) : __props.kind === "max" ? (openBlock(), createElementBlock(
          Fragment,
          { key: 2 },
          [
            createElementVNode(
              "span",
              null,
              toDisplayString(_ctx.$t("Von")),
              1
              /* TEXT */
            ),
            createVNode(SelectorEditor, {
              sel: __props.rule.then.selector,
              attributes: __props.attributes,
              compact: ""
            }, null, 8, ["sel", "attributes"]),
            createElementVNode(
              "span",
              null,
              toDisplayString(_ctx.$t("dürfen höchstens")),
              1
              /* TEXT */
            ),
            withDirectives(createElementVNode(
              "input",
              {
                "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => __props.rule.then.max = $event),
                type: "number",
                min: "0",
                class: "zahl"
              },
              null,
              512
              /* NEED_PATCH */
            ), [
              [
                vModelText,
                __props.rule.then.max,
                void 0,
                { number: true }
              ]
            ]),
            createElementVNode(
              "span",
              null,
              toDisplayString(_ctx.$t("gewählt sein.")),
              1
              /* TEXT */
            )
          ],
          64
          /* STABLE_FRAGMENT */
        )) : (openBlock(), createElementBlock(
          Fragment,
          { key: 3 },
          [
            createElementVNode(
              "span",
              null,
              toDisplayString(_ctx.$t("Von")),
              1
              /* TEXT */
            ),
            createVNode(SelectorEditor, {
              sel: __props.rule.then.selector,
              attributes: __props.attributes,
              compact: ""
            }, null, 8, ["sel", "attributes"]),
            createElementVNode(
              "span",
              null,
              toDisplayString(_ctx.$t("müssen mindestens")),
              1
              /* TEXT */
            ),
            withDirectives(createElementVNode(
              "input",
              {
                "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => __props.rule.then.min = $event),
                type: "number",
                min: "1",
                class: "zahl"
              },
              null,
              512
              /* NEED_PATCH */
            ), [
              [
                vModelText,
                __props.rule.then.min,
                void 0,
                { number: true }
              ]
            ]),
            createElementVNode(
              "span",
              null,
              toDisplayString(_ctx.$t("gewählt sein.")),
              1
              /* TEXT */
            )
          ],
          64
          /* STABLE_FRAGMENT */
        ))
      ]);
    };
  }
};
const RuleSentence = /* @__PURE__ */ _export_sfc(_sfc_main$7, [["__scopeId", "data-v-fd22fced"]]);
const _hoisted_1$6 = { class: "regeln" };
const _hoisted_2$6 = ["open"];
const _hoisted_3$6 = { class: "muted" };
const _hoisted_4$6 = { class: "kopf" };
const _hoisted_5$6 = ["onUpdate:modelValue", "title"];
const _hoisted_6$6 = ["onUpdate:modelValue", "placeholder", "title"];
const _hoisted_7$6 = ["title", "disabled", "onClick"];
const _hoisted_8$5 = ["title", "disabled", "onClick"];
const _hoisted_9$5 = ["title", "onClick"];
const _hoisted_10$5 = { class: "zeile" };
const _hoisted_11$5 = ["title"];
const _hoisted_12$5 = ["checked", "onChange"];
const _hoisted_13$4 = { class: "zeile" };
const _hoisted_14$4 = { class: "dann" };
const _hoisted_15$4 = ["value", "title", "onChange"];
const _hoisted_16$4 = ["value"];
const _hoisted_17$4 = ["onUpdate:modelValue"];
const _hoisted_18$4 = ["onUpdate:modelValue"];
const _hoisted_19$4 = { class: "fuss" };
const _hoisted_20$4 = { class: "satz muted" };
const _hoisted_21$4 = ["title", "onClick"];
const _hoisted_22$4 = { class: "neu" };
const _hoisted_23$4 = { class: "muted" };
const _hoisted_24$4 = ["title", "onClick"];
const _hoisted_25$4 = ["title"];
const _sfc_main$6 = {
  __name: "RuleEditor",
  props: { def: { type: Object, required: true }, attributes: { type: Array, default: () => [] } },
  setup(__props) {
    const props = __props;
    const technical = reactive({});
    const KIND = { forbids: t("darf nicht gewählt sein"), limits: t("höchstens"), requires: t("mindestens") };
    const TITLE = { forbids: t("Kein passendes Teil darf gewählt sein"), limits: t("Höchstens so viele passende Teile"), requires: t("Mindestens so viele passende Teile — fehlt es, ist die Auswahl unvollständig") };
    const NAME = { excludes: t("passt nicht zusammen"), needs: t("braucht"), max: t("höchstens"), min: t("mindestens") };
    const HINT = {
      excludes: t("Zwei Teile oder Gruppen dürfen nicht zusammen gewählt werden — etwa Kühler 1 und Grafikkarten-Kühler 2"),
      needs: t("Wer ein Teil wählt, braucht ein anderes dazu — etwa eine CPU einen Kühler"),
      max: t("Von einem Teil oder einer Gruppe höchstens so viele — etwa ein Mainboard"),
      min: t("Von einem Teil oder einer Gruppe mindestens so viele — sonst ist die Auswahl unvollständig")
    };
    const ctx = computed(() => ({
      t,
      nodeName: (id) => tree.byId?.get(id)?.label ?? id,
      attributeName: (k) => props.attributes.find((a) => a.key === k)?.label ?? k
    }));
    const sentence = (r) => describeRule(r, ctx.value);
    const form = (r) => technical[r.id] ? null : templateOf(r);
    const addFrom = (kind) => props.def.rules.push(templateRule(nextRuleId(props.def.rules), kind));
    const remove = (i) => props.def.rules.splice(i, 1);
    const move = (i, d) => {
      const j = i + d;
      if (j < 0 || j >= props.def.rules.length) return;
      const [r] = props.def.rules.splice(i, 1);
      props.def.rules.splice(j, 0, r);
    };
    const toggleIf = (r) => {
      r.if = r.if ? void 0 : newCondition("has");
    };
    function effectKind(r, k) {
      const keep = r.then?.selector ?? {};
      r.then = newEffect(k);
      r.then.selector = keep;
    }
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$6, [
        createElementVNode("details", {
          class: "hilfe",
          open: !__props.def.rules.length
        }, [
          createElementVNode(
            "summary",
            _hoisted_3$6,
            toDisplayString(_ctx.$t("So funktioniert es")),
            1
            /* TEXT */
          ),
          createElementVNode("ul", null, [
            createElementVNode(
              "li",
              null,
              toDisplayString(_ctx.$t("Eine Regel sagt, welche Teile zusammen gewählt werden dürfen — ein Teil ist ein Produkt, eine Variante oder eine Gruppe mit allem darunter.")),
              1
              /* TEXT */
            ),
            createElementVNode(
              "li",
              null,
              toDisplayString(_ctx.$t("Die meisten Regeln sind ein Satz, in dem nur die Teile zu wählen sind: passt nicht zusammen, braucht, höchstens, mindestens.")),
              1
              /* TEXT */
            ),
            createElementVNode(
              "li",
              null,
              toDisplayString(_ctx.$t("Steckplätze, Mengen und Werte brauchen keine Regel: Teile gehören mit Zeilen zu Gruppen (Reiter „Gruppen“), und der Konfigurator rechnet selbst.")),
              1
              /* TEXT */
            ),
            createElementVNode(
              "li",
              null,
              toDisplayString(_ctx.$t("Unter „Prüfen“ lässt sich eine Auswahl ausprobieren, und Testfälle halten fest, was herauskommen soll.")),
              1
              /* TEXT */
            )
          ])
        ], 8, _hoisted_2$6),
        (openBlock(true), createElementBlock(
          Fragment,
          null,
          renderList(__props.def.rules, (r, i) => {
            return openBlock(), createElementBlock("div", {
              key: i,
              class: "regel"
            }, [
              createElementVNode("div", _hoisted_4$6, [
                withDirectives(createElementVNode("input", {
                  "onUpdate:modelValue": ($event) => r.id = $event,
                  class: "kennung",
                  title: _ctx.$t("Kennung der Regel — je Konfigurator einmal")
                }, null, 8, _hoisted_5$6), [
                  [vModelText, r.id]
                ]),
                withDirectives(createElementVNode("input", {
                  "onUpdate:modelValue": ($event) => r.text = $event,
                  class: "text",
                  placeholder: sentence(r),
                  title: _ctx.$t("Meldung, wenn die Regel verletzt ist — leer: der Satz unten")
                }, null, 8, _hoisted_6$6), [
                  [vModelText, r.text]
                ]),
                createElementVNode("button", {
                  type: "button",
                  class: "x",
                  title: _ctx.$t("nach oben"),
                  disabled: i === 0,
                  onClick: ($event) => move(i, -1)
                }, "↑", 8, _hoisted_7$6),
                createElementVNode("button", {
                  type: "button",
                  class: "x",
                  title: _ctx.$t("nach unten"),
                  disabled: i === __props.def.rules.length - 1,
                  onClick: ($event) => move(i, 1)
                }, "↓", 8, _hoisted_8$5),
                createElementVNode("button", {
                  type: "button",
                  class: "x",
                  title: _ctx.$t("Regel entfernen"),
                  onClick: ($event) => remove(i)
                }, "✕", 8, _hoisted_9$5)
              ]),
              form(r) ? (openBlock(), createBlock(RuleSentence, {
                key: 0,
                rule: r,
                kind: form(r),
                attributes: __props.attributes
              }, null, 8, ["rule", "kind", "attributes"])) : (openBlock(), createElementBlock(
                Fragment,
                { key: 1 },
                [
                  createElementVNode("div", _hoisted_10$5, [
                    createElementVNode("label", {
                      class: "wenn",
                      title: _ctx.$t("Ohne Bedingung gilt die Regel immer")
                    }, [
                      createElementVNode("input", {
                        type: "checkbox",
                        checked: !!r.if,
                        onChange: ($event) => toggleIf(r)
                      }, null, 40, _hoisted_12$5),
                      createTextVNode(
                        " " + toDisplayString(_ctx.$t("wenn")),
                        1
                        /* TEXT */
                      )
                    ], 8, _hoisted_11$5),
                    r.if ? (openBlock(), createBlock(ConditionEditor, {
                      key: 0,
                      cond: r.if,
                      attributes: __props.attributes
                    }, null, 8, ["cond", "attributes"])) : createCommentVNode("v-if", true)
                  ]),
                  createElementVNode("div", _hoisted_13$4, [
                    createElementVNode(
                      "span",
                      _hoisted_14$4,
                      toDisplayString(_ctx.$t("dann")),
                      1
                      /* TEXT */
                    ),
                    r.then ? (openBlock(), createBlock(SelectorEditor, {
                      key: 0,
                      sel: r.then.selector,
                      attributes: __props.attributes
                    }, null, 8, ["sel", "attributes"])) : createCommentVNode("v-if", true),
                    createElementVNode("select", {
                      value: r.then?.kind,
                      class: "folge",
                      title: TITLE[r.then?.kind],
                      onChange: ($event) => effectKind(r, $event.target.value)
                    }, [
                      (openBlock(true), createElementBlock(
                        Fragment,
                        null,
                        renderList(unref(EFFECT_KINDS), (k) => {
                          return openBlock(), createElementBlock("option", {
                            key: k,
                            value: k
                          }, toDisplayString(KIND[k]), 9, _hoisted_16$4);
                        }),
                        128
                        /* KEYED_FRAGMENT */
                      ))
                    ], 40, _hoisted_15$4),
                    r.then?.kind === "limits" ? withDirectives((openBlock(), createElementBlock("input", {
                      key: 1,
                      "onUpdate:modelValue": ($event) => r.then.max = $event,
                      type: "number",
                      min: "0",
                      class: "zahl"
                    }, null, 8, _hoisted_17$4)), [
                      [
                        vModelText,
                        r.then.max,
                        void 0,
                        { number: true }
                      ]
                    ]) : createCommentVNode("v-if", true),
                    r.then?.kind === "requires" ? withDirectives((openBlock(), createElementBlock("input", {
                      key: 2,
                      "onUpdate:modelValue": ($event) => r.then.min = $event,
                      type: "number",
                      min: "1",
                      class: "zahl"
                    }, null, 8, _hoisted_18$4)), [
                      [
                        vModelText,
                        r.then.min,
                        void 0,
                        { number: true }
                      ]
                    ]) : createCommentVNode("v-if", true)
                  ])
                ],
                64
                /* STABLE_FRAGMENT */
              )),
              createElementVNode("div", _hoisted_19$4, [
                createElementVNode(
                  "span",
                  _hoisted_20$4,
                  toDisplayString(sentence(r)),
                  1
                  /* TEXT */
                ),
                unref(templateOf)(r) ? (openBlock(), createElementBlock("button", {
                  key: 0,
                  type: "button",
                  class: "x umschalten",
                  title: _ctx.$t("Dieselbe Regel mit allen Feldern: Bedingung, Folge, Mengen"),
                  onClick: ($event) => technical[r.id] = !technical[r.id]
                }, toDisplayString(technical[r.id] ? _ctx.$t("einfach") : _ctx.$t("technisch")), 9, _hoisted_21$4)) : createCommentVNode("v-if", true)
              ])
            ]);
          }),
          128
          /* KEYED_FRAGMENT */
        )),
        createElementVNode("div", _hoisted_22$4, [
          createElementVNode(
            "span",
            _hoisted_23$4,
            toDisplayString(_ctx.$t("Neue Regel:")),
            1
            /* TEXT */
          ),
          (openBlock(true), createElementBlock(
            Fragment,
            null,
            renderList(unref(TEMPLATES), (k) => {
              return openBlock(), createElementBlock("button", {
                key: k,
                type: "button",
                class: normalizeClass(["vorlage", "v-" + k]),
                title: HINT[k],
                onClick: ($event) => addFrom(k)
              }, "＋ " + toDisplayString(NAME[k]), 11, _hoisted_24$4);
            }),
            128
            /* KEYED_FRAGMENT */
          )),
          createElementVNode("button", {
            type: "button",
            class: "neue-regel",
            title: _ctx.$t("Mit allen Möglichkeiten: Summe eines Attributs, Bilanz einer Gruppe, und, oder, nicht"),
            onClick: _cache[0] || (_cache[0] = ($event) => addFrom("eigene"))
          }, "＋ " + toDisplayString(_ctx.$t("eigene Regel")), 9, _hoisted_25$4)
        ])
      ]);
    };
  }
};
const RuleEditor = /* @__PURE__ */ _export_sfc(_sfc_main$6, [["__scopeId", "data-v-f8703721"]]);
const _hoisted_1$5 = { class: "teil" };
const _hoisted_2$5 = { class: "kopf" };
const _hoisted_3$5 = { class: "name" };
const _hoisted_4$5 = {
  key: 0,
  class: "muted id"
};
const _hoisted_5$5 = ["disabled", "title"];
const _hoisted_6$5 = ["title"];
const _hoisted_7$5 = ["title"];
const _hoisted_8$4 = { class: "felder" };
const _hoisted_9$4 = ["onUpdate:modelValue", "placeholder", "title"];
const _hoisted_10$4 = ["value", "title", "onChange"];
const _hoisted_11$4 = { value: "member" };
const _hoisted_12$4 = { value: "limit" };
const _hoisted_13$3 = ["onUpdate:modelValue", "placeholder", "title"];
const _hoisted_14$3 = ["onUpdate:modelValue", "placeholder", "title"];
const _hoisted_15$3 = ["onUpdate:modelValue", "placeholder", "title"];
const _hoisted_16$3 = ["onUpdate:modelValue", "placeholder", "title"];
const _hoisted_17$3 = ["onUpdate:modelValue", "placeholder", "title"];
const _hoisted_18$3 = ["value", "placeholder", "title", "onInput"];
const _hoisted_19$3 = ["title"];
const _hoisted_20$3 = ["checked", "onChange"];
const _hoisted_21$3 = ["title", "onClick"];
const _hoisted_22$3 = {
  key: 0,
  class: "bedingung"
};
const _hoisted_23$3 = { class: "satz muted" };
const _hoisted_24$3 = { class: "neu" };
const _hoisted_25$3 = ["title"];
const _hoisted_26$2 = ["title"];
const _hoisted_27$2 = { id: "kg-gruppen" };
const _hoisted_28$2 = ["value"];
const _sfc_main$5 = {
  __name: "MemberEditor",
  props: {
    edit: { type: Object, required: true },
    // { node, rows }
    groups: { type: Array, default: () => [] },
    // [{ key, label }] — die Gruppen, die es gibt
    attributes: { type: Array, default: () => [] },
    dirty: { type: Boolean, default: false }
  },
  emits: ["save", "remove", "close"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const WHEN_KINDS = ["has", "count", "sum", "and", "or", "not"];
    const ctx = computed(() => ({
      t,
      nodeName: (id) => tree.byId?.get(id)?.label ?? id,
      attributeName: (k) => props.attributes.find((a) => a.key === k)?.label ?? k,
      groupName: (k) => props.groups.find((g) => g.key === k)?.label || k
    }));
    const sentence = (r) => describeRow(r, ctx.value);
    const name = computed(() => tree.byId?.get(props.edit.node)?.label ?? props.edit.node);
    const complete = computed(() => props.edit.rows.every((r) => KEY_PATTERN.test(String(r.group ?? "").trim())));
    const toggleWhen = (r) => {
      r.when = r.when ? void 0 : newCondition("has");
    };
    const setKind = (r, art) => {
      r.art = art;
    };
    const add = (art) => props.edit.rows.push(newRow(art, props.edit.rows.at(-1)?.group ?? ""));
    const remove = (i) => props.edit.rows.splice(i, 1);
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$5, [
        createElementVNode("div", _hoisted_2$5, [
          createElementVNode(
            "strong",
            _hoisted_3$5,
            toDisplayString(name.value),
            1
            /* TEXT */
          ),
          name.value !== __props.edit.node ? (openBlock(), createElementBlock(
            "span",
            _hoisted_4$5,
            toDisplayString(__props.edit.node),
            1
            /* TEXT */
          )) : createCommentVNode("v-if", true),
          _cache[5] || (_cache[5] = createElementVNode(
            "span",
            { class: "grow" },
            null,
            -1
            /* CACHED */
          )),
          createElementVNode("button", {
            type: "button",
            class: "primary speichern",
            disabled: !__props.dirty || !complete.value,
            title: complete.value ? "" : _ctx.$t("Jede Zeile braucht eine Gruppe (a–z, 0–9, _ und -)"),
            onClick: _cache[0] || (_cache[0] = ($event) => emit("save"))
          }, toDisplayString(_ctx.$t("Speichern")), 9, _hoisted_5$5),
          createElementVNode("button", {
            type: "button",
            class: "x entfernen",
            title: _ctx.$t("Alle Zeilen dieses Teils entfernen"),
            onClick: _cache[1] || (_cache[1] = ($event) => emit("remove"))
          }, "✕", 8, _hoisted_6$5),
          createElementVNode("button", {
            type: "button",
            class: "x schliessen",
            title: _ctx.$t("Schliessen"),
            onClick: _cache[2] || (_cache[2] = ($event) => emit("close"))
          }, "–", 8, _hoisted_7$5)
        ]),
        (openBlock(true), createElementBlock(
          Fragment,
          null,
          renderList(__props.edit.rows, (r, i) => {
            return openBlock(), createElementBlock("div", {
              key: i,
              class: "zeile"
            }, [
              createElementVNode("div", _hoisted_8$4, [
                withDirectives(createElementVNode("input", {
                  "onUpdate:modelValue": ($event) => r.group = $event,
                  list: "kg-gruppen",
                  class: "grp",
                  placeholder: _ctx.$t("Gruppe"),
                  title: _ctx.$t("Schlüssel der Gruppe — a–z, 0–9, _ und -")
                }, null, 8, _hoisted_9$4), [
                  [vModelText, r.group]
                ]),
                createElementVNode("select", {
                  value: unref(rowKind)(r),
                  class: "art",
                  title: _ctx.$t("Mitglied: das Teil zählt in der Gruppe und trägt Zahlen oder einen Wert. Vorgabe: das Teil bestimmt, wie viele Teile und welche Werte die Gruppe haben darf; es zählt dort nicht mit."),
                  onChange: ($event) => setKind(r, $event.target.value)
                }, [
                  createElementVNode(
                    "option",
                    _hoisted_11$4,
                    toDisplayString(_ctx.$t("Mitglied")),
                    1
                    /* TEXT */
                  ),
                  createElementVNode(
                    "option",
                    _hoisted_12$4,
                    toDisplayString(_ctx.$t("gibt vor")),
                    1
                    /* TEXT */
                  )
                ], 40, _hoisted_10$4),
                unref(rowKind)(r) === "member" ? (openBlock(), createElementBlock(
                  Fragment,
                  { key: 0 },
                  [
                    withDirectives(createElementVNode("input", {
                      "onUpdate:modelValue": ($event) => r.provides = $event,
                      type: "number",
                      min: "0",
                      class: "zahl bereit",
                      placeholder: _ctx.$t("bereit"),
                      title: _ctx.$t("Stellt so viel bereit")
                    }, null, 8, _hoisted_13$3), [
                      [
                        vModelText,
                        r.provides,
                        void 0,
                        { number: true }
                      ]
                    ]),
                    withDirectives(createElementVNode("input", {
                      "onUpdate:modelValue": ($event) => r.consumes = $event,
                      type: "number",
                      min: "0",
                      class: "zahl verbraucht",
                      placeholder: _ctx.$t("verbraucht"),
                      title: _ctx.$t("Verbraucht so viel")
                    }, null, 8, _hoisted_14$3), [
                      [
                        vModelText,
                        r.consumes,
                        void 0,
                        { number: true }
                      ]
                    ]),
                    withDirectives(createElementVNode("input", {
                      "onUpdate:modelValue": ($event) => r.value = $event,
                      class: "wert",
                      placeholder: _ctx.$t("Wert"),
                      title: _ctx.$t("Der Wert des Teils in dieser Gruppe — unabhängig von den Attributen des Produkts")
                    }, null, 8, _hoisted_15$3), [
                      [vModelText, r.value]
                    ])
                  ],
                  64
                  /* STABLE_FRAGMENT */
                )) : (openBlock(), createElementBlock(
                  Fragment,
                  { key: 1 },
                  [
                    withDirectives(createElementVNode("input", {
                      "onUpdate:modelValue": ($event) => r.min = $event,
                      type: "number",
                      min: "0",
                      class: "zahl min",
                      placeholder: _ctx.$t("min"),
                      title: _ctx.$t("Mindestens so viele Teile in der Gruppe — fehlt es, ist die Auswahl unvollständig")
                    }, null, 8, _hoisted_16$3), [
                      [
                        vModelText,
                        r.min,
                        void 0,
                        { number: true }
                      ]
                    ]),
                    withDirectives(createElementVNode("input", {
                      "onUpdate:modelValue": ($event) => r.max = $event,
                      type: "number",
                      min: "0",
                      class: "zahl max",
                      placeholder: _ctx.$t("max"),
                      title: _ctx.$t("Höchstens so viele Teile in der Gruppe")
                    }, null, 8, _hoisted_17$3), [
                      [
                        vModelText,
                        r.max,
                        void 0,
                        { number: true }
                      ]
                    ]),
                    createElementVNode("input", {
                      value: unref(valuesText)(r),
                      class: "werte",
                      placeholder: _ctx.$t("Werte, z. B. 8, 32"),
                      title: _ctx.$t("Erlaubte Werte der Mitglieder, mit Komma getrennt"),
                      onInput: ($event) => r.valuesText = $event.target.value
                    }, null, 40, _hoisted_18$3)
                  ],
                  64
                  /* STABLE_FRAGMENT */
                )),
                createElementVNode("label", {
                  class: "wenn",
                  title: _ctx.$t("Ohne Bedingung gilt die Zeile immer")
                }, [
                  createElementVNode("input", {
                    type: "checkbox",
                    checked: !!r.when,
                    onChange: ($event) => toggleWhen(r)
                  }, null, 40, _hoisted_20$3),
                  createTextVNode(
                    " " + toDisplayString(_ctx.$t("wenn")),
                    1
                    /* TEXT */
                  )
                ], 8, _hoisted_19$3),
                createElementVNode("button", {
                  type: "button",
                  class: "x",
                  title: _ctx.$t("Zeile entfernen"),
                  onClick: ($event) => remove(i)
                }, "✕", 8, _hoisted_21$3)
              ]),
              r.when ? (openBlock(), createElementBlock("div", _hoisted_22$3, [
                createVNode(ConditionEditor, {
                  cond: r.when,
                  attributes: __props.attributes,
                  kinds: WHEN_KINDS
                }, null, 8, ["cond", "attributes"])
              ])) : createCommentVNode("v-if", true),
              createElementVNode(
                "div",
                _hoisted_23$3,
                toDisplayString(sentence(r)),
                1
                /* TEXT */
              )
            ]);
          }),
          128
          /* KEYED_FRAGMENT */
        )),
        createElementVNode("div", _hoisted_24$3, [
          createElementVNode("button", {
            type: "button",
            class: "neue-zeile",
            title: _ctx.$t("Das Teil zählt in einer Gruppe: stellt bereit, verbraucht, hat einen Wert"),
            onClick: _cache[3] || (_cache[3] = ($event) => add("member"))
          }, "＋ " + toDisplayString(_ctx.$t("Mitglied")), 9, _hoisted_25$3),
          createElementVNode("button", {
            type: "button",
            class: "neue-vorgabe",
            title: _ctx.$t("Das Teil bestimmt Mengen und Werte einer Gruppe — ein Mainboard gibt dem Arbeitsspeicher vor, wie viele Bausteine und welche Größen"),
            onClick: _cache[4] || (_cache[4] = ($event) => add("limit"))
          }, "＋ " + toDisplayString(_ctx.$t("gibt vor")), 9, _hoisted_26$2)
        ]),
        createElementVNode("datalist", _hoisted_27$2, [
          (openBlock(true), createElementBlock(
            Fragment,
            null,
            renderList(__props.groups, (g) => {
              return openBlock(), createElementBlock("option", {
                key: g.key,
                value: g.key
              }, toDisplayString(g.label), 9, _hoisted_28$2);
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ])
      ]);
    };
  }
};
const MemberEditor = /* @__PURE__ */ _export_sfc(_sfc_main$5, [["__scopeId", "data-v-69623a03"]]);
const _hoisted_1$4 = { class: "gruppen" };
const _hoisted_2$4 = {
  key: 0,
  class: "neg fehler"
};
const _hoisted_3$4 = {
  key: 1,
  class: "fehler neg"
};
const _hoisted_4$4 = { class: "spalten" };
const _hoisted_5$4 = { class: "liste" };
const _hoisted_6$4 = { class: "step-band" };
const _hoisted_7$4 = { class: "grid" };
const _hoisted_8$3 = ["onClick"];
const _hoisted_9$3 = {
  key: 0,
  class: "muted"
};
const _hoisted_10$3 = ["title"];
const _hoisted_11$3 = ["title"];
const _hoisted_12$3 = ["placeholder", "title"];
const _hoisted_13$2 = ["disabled", "title"];
const _hoisted_14$2 = { class: "rechts" };
const _hoisted_15$2 = {
  key: 0,
  class: "kopf"
};
const _hoisted_16$2 = ["placeholder", "title"];
const _hoisted_17$2 = ["title"];
const _hoisted_18$2 = ["disabled"];
const _hoisted_19$2 = ["title"];
const _hoisted_20$2 = { class: "step-band" };
const _hoisted_21$2 = {
  key: 1,
  class: "grid teile"
};
const _hoisted_22$2 = ["onClick"];
const _hoisted_23$2 = { style: { "width": "220px" } };
const _hoisted_24$2 = ["title"];
const _hoisted_25$2 = {
  key: 2,
  class: "muted leer"
};
const _hoisted_26$1 = { class: "kopf" };
const _hoisted_27$1 = ["title"];
const _hoisted_28$1 = { class: "grenzen" };
const _hoisted_29$1 = { class: "step-band" };
const _hoisted_30$1 = {
  key: 0,
  class: "grid"
};
const _hoisted_31$1 = ["onUpdate:modelValue", "placeholder"];
const _hoisted_32$1 = ["onUpdate:modelValue", "title"];
const _hoisted_33$1 = ["onUpdate:modelValue", "title"];
const _hoisted_34$1 = ["value", "placeholder", "title", "onInput"];
const _hoisted_35$1 = { class: "muted satz" };
const _hoisted_36$1 = { style: { "width": "24px" } };
const _hoisted_37$1 = ["title", "onClick"];
const _hoisted_38 = { class: "kopf" };
const _hoisted_39 = ["title"];
const _hoisted_40 = { class: "muted" };
const _hoisted_41 = { id: "kg-gruppen-grenzen" };
const _hoisted_42 = ["value"];
const _sfc_main$4 = {
  __name: "Groups",
  props: { def: { type: Object, required: true }, attributes: { type: Array, default: () => [] } },
  setup(__props) {
    const props = __props;
    const groups = ref([]);
    const parts = ref([]);
    const errors = ref([]);
    const busy = ref("");
    const sel = ref("");
    const groupEdit = ref(null);
    const groupBase = ref("");
    const edit = ref(null);
    const editBase = ref("");
    const picking = ref(false);
    const picked = ref("");
    const newKey = ref("");
    const keyOk = computed(() => KEY_PATTERN.test(newKey.value) && !groups.value.some((g) => g.key === newKey.value));
    const cleanGroup = (g) => {
      const o = {};
      if (String(g?.label ?? "").trim()) o.label = String(g.label).trim();
      if (g?.equal) o.equal = true;
      return o;
    };
    const groupDirty = computed(() => !!groupEdit.value && JSON.stringify(cleanGroup(groupEdit.value)) !== groupBase.value);
    const editDirty = computed(() => !!edit.value && JSON.stringify(cleanRows(edit.value.rows)) !== editBase.value);
    const shown = computed(() => parts.value.filter((p) => !sel.value || p.rows.some((r) => r.group === sel.value)));
    const limits = computed(() => props.def.limits ?? []);
    const ctx = computed(() => ({
      t,
      nodeName: (id) => tree.byId?.get(id)?.label ?? id,
      attributeName: (k) => props.attributes.find((a) => a.key === k)?.label ?? k,
      groupName: (k) => groups.value.find((g) => g.key === k)?.label || k
    }));
    const nameOf = (id) => tree.byId?.get(id)?.label ?? id;
    const summary = (p) => p.rows.map((r) => describeRow(r, ctx.value)).join(" · ");
    const limitSentence = (l) => {
      const o = cleanLimit(l);
      return o.group && Object.keys(o).length > 1 ? describeRow(o, ctx.value) : "";
    };
    const data = (name) => `/api/plugins/configurator/data/${encodeURIComponent(name)}`;
    async function load() {
      try {
        const r = await api.get("/api/configurator-groups");
        groups.value = r?.groups ?? [];
        parts.value = r?.parts ?? [];
        errors.value = r?.errors ?? [];
        busy.value = "";
      } catch (e) {
        busy.value = "✗ " + e.message;
      }
    }
    onMounted(load);
    function pick(key) {
      sel.value = key;
      const g = groups.value.find((x) => x.key === key);
      groupEdit.value = { label: g?.label ?? "", equal: !!g?.equal };
      groupBase.value = JSON.stringify(cleanGroup(groupEdit.value));
    }
    async function createGroup() {
      if (!keyOk.value) return;
      const key = newKey.value;
      try {
        await api.post(data("group:" + key), {}, "PUT");
        newKey.value = "";
        await load();
        pick(key);
      } catch (e) {
        store.toast(e.message);
      }
    }
    async function saveGroup() {
      try {
        await api.post(data("group:" + sel.value), cleanGroup(groupEdit.value), "PUT");
        const key = sel.value;
        await load();
        pick(key);
        store.toast(t("Gespeichert"), "ok");
      } catch (e) {
        store.toast(e.message);
      }
    }
    async function removeGroup() {
      const g = groups.value.find((x) => x.key === sel.value);
      const ok = await dialog.confirm({ title: t("Gruppe entfernen"), text: t("{0} — die Zeilen der Teile in dieser Gruppe bleiben.", [g?.label || sel.value]), ok: t("Entfernen"), danger: true });
      if (!ok) return;
      try {
        await api.del(data("group:" + sel.value));
        sel.value = "";
        groupEdit.value = null;
        await load();
      } catch (e) {
        store.toast(e.message);
      }
    }
    function openPart(node) {
      const have = parts.value.find((p) => p.node === node);
      edit.value = { node, rows: have ? JSON.parse(JSON.stringify(have.rows)) : [newRow("member", sel.value)] };
      editBase.value = have ? JSON.stringify(cleanRows(edit.value.rows)) : "[]";
    }
    const onPick = (r) => {
      picking.value = false;
      if (r?.id) openPart(r.id);
    };
    async function savePart() {
      const rows = cleanRows(edit.value.rows), node = edit.value.node;
      try {
        if (rows.length) await api.post(data("member:" + node), { rows }, "PUT");
        else await api.del(data("member:" + node));
        await load();
        rows.length ? openPart(node) : edit.value = null;
        store.toast(t("Gespeichert"), "ok");
      } catch (e) {
        store.toast(e.message);
      }
    }
    async function removePart() {
      const node = edit.value.node;
      const ok = await dialog.confirm({ title: t("Zeilen entfernen"), text: t("{0} — alle Zeilen dieses Teils.", [nameOf(node)]), ok: t("Entfernen"), danger: true });
      if (!ok) return;
      try {
        await api.del(data("member:" + node));
        edit.value = null;
        await load();
      } catch (e) {
        store.toast(e.message);
      }
    }
    const addLimit = () => {
      if (!props.def.limits) props.def.limits = [];
      props.def.limits.push({ group: sel.value });
    };
    const removeLimit = (i) => props.def.limits.splice(i, 1);
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$4, [
        busy.value ? (openBlock(), createElementBlock(
          "div",
          _hoisted_2$4,
          toDisplayString(busy.value),
          1
          /* TEXT */
        )) : createCommentVNode("v-if", true),
        errors.value.length ? (openBlock(), createElementBlock("ul", _hoisted_3$4, [
          (openBlock(true), createElementBlock(
            Fragment,
            null,
            renderList(errors.value, (e, i) => {
              return openBlock(), createElementBlock(
                "li",
                { key: i },
                "✗ " + toDisplayString(e),
                1
                /* TEXT */
              );
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ])) : createCommentVNode("v-if", true),
        createElementVNode("div", _hoisted_4$4, [
          createElementVNode("div", _hoisted_5$4, [
            createElementVNode(
              "div",
              _hoisted_6$4,
              toDisplayString(_ctx.$t("Gruppen")) + " · " + toDisplayString(groups.value.length),
              1
              /* TEXT */
            ),
            createElementVNode("table", _hoisted_7$4, [
              createElementVNode("tbody", null, [
                (openBlock(true), createElementBlock(
                  Fragment,
                  null,
                  renderList(groups.value, (g) => {
                    return openBlock(), createElementBlock("tr", {
                      key: g.key,
                      class: normalizeClass({ current: sel.value === g.key }),
                      style: { "cursor": "pointer" },
                      onClick: ($event) => pick(g.key)
                    }, [
                      createElementVNode("td", null, [
                        createTextVNode(
                          toDisplayString(g.label || g.key) + " ",
                          1
                          /* TEXT */
                        ),
                        g.label ? (openBlock(), createElementBlock(
                          "span",
                          _hoisted_9$3,
                          toDisplayString(g.key),
                          1
                          /* TEXT */
                        )) : createCommentVNode("v-if", true)
                      ]),
                      createElementVNode("td", {
                        style: { "width": "24px" },
                        class: "muted",
                        title: _ctx.$t("Alle Werte der Mitglieder sind gleich")
                      }, toDisplayString(g.equal ? "＝" : ""), 9, _hoisted_10$3),
                      createElementVNode("td", {
                        style: { "width": "36px" },
                        class: "muted",
                        title: _ctx.$t("Mitglieder")
                      }, toDisplayString(g.members), 9, _hoisted_11$3)
                    ], 10, _hoisted_8$3);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ])
            ]),
            createElementVNode(
              "form",
              {
                class: "neu",
                onSubmit: withModifiers(createGroup, ["prevent"])
              },
              [
                withDirectives(createElementVNode("input", {
                  "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => newKey.value = $event),
                  class: "neue-gruppe",
                  placeholder: _ctx.$t("Schlüssel, z. B. ram"),
                  title: _ctx.$t("a–z, 0–9, _ und -, beginnt mit einem Buchstaben")
                }, null, 8, _hoisted_12$3), [
                  [vModelText, newKey.value]
                ]),
                createElementVNode("button", {
                  type: "submit",
                  disabled: !keyOk.value,
                  title: _ctx.$t("Gruppe anlegen")
                }, "＋", 8, _hoisted_13$2)
              ],
              32
              /* NEED_HYDRATION */
            )
          ]),
          createElementVNode("div", _hoisted_14$2, [
            groupEdit.value ? (openBlock(), createElementBlock("div", _hoisted_15$2, [
              withDirectives(createElementVNode("input", {
                "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => groupEdit.value.label = $event),
                class: "bez",
                placeholder: _ctx.$t("Bezeichnung"),
                title: _ctx.$t("Name der Gruppe in Meldungen — leer: der Schlüssel")
              }, null, 8, _hoisted_16$2), [
                [vModelText, groupEdit.value.label]
              ]),
              createElementVNode("label", {
                class: "gleich",
                title: _ctx.$t("Alle Mitglieder müssen denselben Wert haben — zwei verschiedene Werte machen die Auswahl ungültig")
              }, [
                withDirectives(createElementVNode(
                  "input",
                  {
                    "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => groupEdit.value.equal = $event),
                    type: "checkbox"
                  },
                  null,
                  512
                  /* NEED_PATCH */
                ), [
                  [vModelCheckbox, groupEdit.value.equal]
                ]),
                createTextVNode(
                  " " + toDisplayString(_ctx.$t("alle Werte gleich")),
                  1
                  /* TEXT */
                )
              ], 8, _hoisted_17$2),
              createElementVNode("button", {
                type: "button",
                class: "primary speichern-gruppe",
                disabled: !groupDirty.value,
                onClick: saveGroup
              }, toDisplayString(_ctx.$t("Speichern")), 9, _hoisted_18$2),
              createElementVNode("button", {
                type: "button",
                class: "x entfernen-gruppe",
                title: _ctx.$t("Gruppe entfernen"),
                onClick: removeGroup
              }, "✕", 8, _hoisted_19$2)
            ])) : createCommentVNode("v-if", true),
            createElementVNode(
              "div",
              _hoisted_20$2,
              toDisplayString(_ctx.$t("Teile")) + " · " + toDisplayString(shown.value.length),
              1
              /* TEXT */
            ),
            shown.value.length ? (openBlock(), createElementBlock("table", _hoisted_21$2, [
              createElementVNode("tbody", null, [
                (openBlock(true), createElementBlock(
                  Fragment,
                  null,
                  renderList(shown.value, (p) => {
                    return openBlock(), createElementBlock("tr", {
                      key: p.node,
                      class: normalizeClass({ current: edit.value?.node === p.node }),
                      style: { "cursor": "pointer" },
                      onClick: ($event) => openPart(p.node)
                    }, [
                      createElementVNode(
                        "td",
                        _hoisted_23$2,
                        toDisplayString(nameOf(p.node)),
                        1
                        /* TEXT */
                      ),
                      createElementVNode("td", {
                        class: "muted zusammen",
                        title: summary(p)
                      }, toDisplayString(summary(p)), 9, _hoisted_24$2)
                    ], 10, _hoisted_22$2);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ])
            ])) : (openBlock(), createElementBlock(
              "div",
              _hoisted_25$2,
              toDisplayString(_ctx.$t("Noch kein Teil mit Zeilen")),
              1
              /* TEXT */
            )),
            createElementVNode("div", _hoisted_26$1, [
              createElementVNode("button", {
                type: "button",
                class: "neues-teil",
                title: _ctx.$t("Ein Produkt, eine Variante oder eine Gruppe im Baum wählen — Zeilen an einer Gruppe gelten für alles darunter"),
                onClick: _cache[3] || (_cache[3] = ($event) => picking.value = !picking.value)
              }, "＋ " + toDisplayString(_ctx.$t("Teil")), 9, _hoisted_27$1)
            ]),
            picking.value ? (openBlock(), createBlock(unref(TreePicker), {
              key: 3,
              modelValue: picked.value,
              "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => picked.value = $event),
              roles: ["group", "product", "variant"],
              height: 200,
              onPick
            }, null, 8, ["modelValue"])) : createCommentVNode("v-if", true),
            edit.value ? (openBlock(), createBlock(MemberEditor, {
              key: 4,
              edit: edit.value,
              groups: groups.value,
              attributes: __props.attributes,
              dirty: editDirty.value,
              onSave: savePart,
              onRemove: removePart,
              onClose: _cache[5] || (_cache[5] = ($event) => edit.value = null)
            }, null, 8, ["edit", "groups", "attributes", "dirty"])) : createCommentVNode("v-if", true)
          ])
        ]),
        createElementVNode("div", _hoisted_28$1, [
          createElementVNode(
            "div",
            _hoisted_29$1,
            toDisplayString(_ctx.$t("Grenzen dieses Konfigurators")) + " · " + toDisplayString(limits.value.length),
            1
            /* TEXT */
          ),
          limits.value.length ? (openBlock(), createElementBlock("table", _hoisted_30$1, [
            createElementVNode("thead", null, [
              createElementVNode("tr", null, [
                createElementVNode(
                  "th",
                  null,
                  toDisplayString(_ctx.$t("Gruppe")),
                  1
                  /* TEXT */
                ),
                createElementVNode(
                  "th",
                  null,
                  toDisplayString(_ctx.$t("min")),
                  1
                  /* TEXT */
                ),
                createElementVNode(
                  "th",
                  null,
                  toDisplayString(_ctx.$t("max")),
                  1
                  /* TEXT */
                ),
                createElementVNode(
                  "th",
                  null,
                  toDisplayString(_ctx.$t("Werte")),
                  1
                  /* TEXT */
                ),
                _cache[6] || (_cache[6] = createElementVNode(
                  "th",
                  null,
                  null,
                  -1
                  /* CACHED */
                ))
              ])
            ]),
            createElementVNode("tbody", null, [
              (openBlock(true), createElementBlock(
                Fragment,
                null,
                renderList(limits.value, (l, i) => {
                  return openBlock(), createElementBlock("tr", { key: i }, [
                    createElementVNode("td", null, [
                      withDirectives(createElementVNode("input", {
                        "onUpdate:modelValue": ($event) => l.group = $event,
                        list: "kg-gruppen-grenzen",
                        class: "grp",
                        placeholder: _ctx.$t("Gruppe")
                      }, null, 8, _hoisted_31$1), [
                        [vModelText, l.group]
                      ])
                    ]),
                    createElementVNode("td", null, [
                      withDirectives(createElementVNode("input", {
                        "onUpdate:modelValue": ($event) => l.min = $event,
                        type: "number",
                        min: "0",
                        class: "zahl",
                        title: _ctx.$t("Mindestens so viele Teile in der Gruppe — fehlt es, ist die Auswahl unvollständig")
                      }, null, 8, _hoisted_32$1), [
                        [
                          vModelText,
                          l.min,
                          void 0,
                          { number: true }
                        ]
                      ])
                    ]),
                    createElementVNode("td", null, [
                      withDirectives(createElementVNode("input", {
                        "onUpdate:modelValue": ($event) => l.max = $event,
                        type: "number",
                        min: "0",
                        class: "zahl",
                        title: _ctx.$t("Höchstens so viele Teile in der Gruppe")
                      }, null, 8, _hoisted_33$1), [
                        [
                          vModelText,
                          l.max,
                          void 0,
                          { number: true }
                        ]
                      ])
                    ]),
                    createElementVNode("td", null, [
                      createElementVNode("input", {
                        value: unref(valuesText)(l),
                        class: "werte",
                        placeholder: _ctx.$t("z. B. 8, 32"),
                        title: _ctx.$t("Erlaubte Werte der Mitglieder, mit Komma getrennt"),
                        onInput: ($event) => l.valuesText = $event.target.value
                      }, null, 40, _hoisted_34$1)
                    ]),
                    createElementVNode(
                      "td",
                      _hoisted_35$1,
                      toDisplayString(limitSentence(l)),
                      1
                      /* TEXT */
                    ),
                    createElementVNode("td", _hoisted_36$1, [
                      createElementVNode("button", {
                        type: "button",
                        class: "x",
                        title: _ctx.$t("Grenze entfernen"),
                        onClick: ($event) => removeLimit(i)
                      }, "✕", 8, _hoisted_37$1)
                    ])
                  ]);
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ])
          ])) : createCommentVNode("v-if", true),
          createElementVNode("div", _hoisted_38, [
            createElementVNode("button", {
              type: "button",
              class: "neue-grenze",
              title: _ctx.$t("Mindest- und Höchstmenge und erlaubte Werte, die nur dieser Konfigurator setzt — Teile können sie zusätzlich vorgeben"),
              onClick: addLimit
            }, "＋ " + toDisplayString(_ctx.$t("Grenze")), 9, _hoisted_39),
            createElementVNode(
              "span",
              _hoisted_40,
              toDisplayString(_ctx.$t("Die Grenzen werden mit dem Konfigurator gespeichert.")),
              1
              /* TEXT */
            )
          ]),
          createElementVNode("datalist", _hoisted_41, [
            (openBlock(true), createElementBlock(
              Fragment,
              null,
              renderList(groups.value, (g) => {
                return openBlock(), createElementBlock("option", {
                  key: g.key,
                  value: g.key
                }, toDisplayString(g.label), 9, _hoisted_42);
              }),
              128
              /* KEYED_FRAGMENT */
            ))
          ])
        ])
      ]);
    };
  }
};
const Groups = /* @__PURE__ */ _export_sfc(_sfc_main$4, [["__scopeId", "data-v-56b38a7c"]]);
const _hoisted_1$3 = { class: "faelle" };
const _hoisted_2$3 = { class: "step-band" };
const _hoisted_3$3 = { class: "kopf" };
const _hoisted_4$3 = ["placeholder"];
const _hoisted_5$3 = ["disabled", "title"];
const _hoisted_6$3 = ["disabled", "title"];
const _hoisted_7$3 = {
  key: 0,
  class: "grid"
};
const _hoisted_8$2 = { class: "muted" };
const _hoisted_9$2 = {
  key: 0,
  class: "neg diff"
};
const _hoisted_10$2 = { style: { "width": "56px", "text-align": "right", "white-space": "nowrap" } };
const _hoisted_11$2 = ["title", "onClick"];
const _hoisted_12$2 = ["title", "onClick"];
const _sfc_main$3 = {
  __name: "Cases",
  props: { configurator: { type: String, required: true }, selection: { type: Array, default: () => [] }, result: { type: Object, default: null } },
  emits: ["load"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const cases = ref({});
    const outcome = ref({});
    const newName = ref("");
    const busy = ref(false);
    const prefix = computed(() => `case:${props.configurator}:`);
    const dataName = (label) => prefix.value + String(label).trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
    const rows = computed(() => Object.entries(cases.value).map(([key, c]) => ({ key, ...c })));
    const passed = computed(() => rows.value.filter((r) => outcome.value[r.key]?.ok).length);
    async function load() {
      try {
        cases.value = await api.get(`/api/plugins/configurator/data?prefix=${encodeURIComponent(prefix.value)}&values=true`) ?? {};
      } catch {
        cases.value = {};
      }
      outcome.value = {};
    }
    onMounted(load);
    watch(() => props.configurator, load);
    const canSave = computed(() => !!newName.value.trim() && !!props.result && dataName(newName.value) !== prefix.value);
    async function save() {
      if (!canSave.value) return;
      const key = dataName(newName.value);
      const body = { label: newName.value.trim(), selection: props.selection.map((s) => ({ id: s.id, amount: s.amount })), expect: expectFrom(props.result) };
      try {
        await api.post(`/api/plugins/configurator/data/${encodeURIComponent(key)}`, body, "PUT");
        newName.value = "";
        await load();
        store.toast(t("Testfall gespeichert"), "ok");
      } catch (e) {
        store.toast(e.message);
      }
    }
    async function remove(r) {
      const ok = await dialog.confirm({ title: t("Testfall entfernen"), text: r.label, ok: t("Entfernen"), danger: true });
      if (!ok) return;
      try {
        await api.del(`/api/plugins/configurator/data/${encodeURIComponent(r.key)}`);
        await load();
      } catch (e) {
        store.toast(e.message);
      }
    }
    async function runAll() {
      busy.value = true;
      const next = {};
      for (const r of rows.value) {
        try {
          const res = await api.post(`/api/configurator/${encodeURIComponent(props.configurator)}/check`, { selection: r.selection, selectable: false });
          next[r.key] = compareCase(r.expect ?? {}, res);
        } catch (e) {
          next[r.key] = { ok: false, error: e.message, differences: [] };
        }
      }
      outcome.value = next;
      busy.value = false;
    }
    const KIND = { valid: t("zulässig"), complete: t("vollständig"), violations: t("Verstoss"), missing: t("fehlt") };
    function difference(d) {
      const what = KIND[d.what] ?? d.what;
      if (d.what === "valid" || d.what === "complete") return t("{0}: erwartet {1}, ist {2}", [what, d.expected ? t("ja") : t("nein"), d.actual ? t("ja") : t("nein")]);
      return d.expected ? t("{0} {1} erwartet, aber nicht da", [what, d.expected]) : t("{0} {1} ist neu", [what, d.actual]);
    }
    const text2 = (key) => {
      const o = outcome.value[key];
      return !o ? "" : o.error ?? o.differences.map(difference).join(" · ");
    };
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$3, [
        createElementVNode(
          "div",
          _hoisted_2$3,
          toDisplayString(_ctx.$t("Testfälle")) + " · " + toDisplayString(rows.value.length),
          1
          /* TEXT */
        ),
        createElementVNode("div", _hoisted_3$3, [
          withDirectives(createElementVNode("input", {
            "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => newName.value = $event),
            placeholder: _ctx.$t("Name des Testfalls"),
            onKeydown: withKeys(save, ["enter"])
          }, null, 40, _hoisted_4$3), [
            [vModelText, newName.value]
          ]),
          createElementVNode("button", {
            type: "button",
            disabled: !canSave.value,
            title: _ctx.$t("Die Auswahl mit dem jetzigen Ergebnis als Testfall merken"),
            onClick: save
          }, toDisplayString(_ctx.$t("Speichern")), 9, _hoisted_5$3),
          _cache[1] || (_cache[1] = createElementVNode(
            "span",
            { class: "grow" },
            null,
            -1
            /* CACHED */
          )),
          createElementVNode("button", {
            type: "button",
            disabled: busy.value || !rows.value.length,
            title: _ctx.$t("Jede Auswahl gegen die Regeln prüfen und mit dem erwarteten Ergebnis vergleichen"),
            onClick: runAll
          }, [
            createTextVNode(
              "▶ " + toDisplayString(_ctx.$t("Alle prüfen")),
              1
              /* TEXT */
            ),
            Object.keys(outcome.value).length ? (openBlock(), createElementBlock(
              Fragment,
              { key: 0 },
              [
                createTextVNode(
                  " · " + toDisplayString(passed.value) + "/" + toDisplayString(rows.value.length),
                  1
                  /* TEXT */
                )
              ],
              64
              /* STABLE_FRAGMENT */
            )) : createCommentVNode("v-if", true)
          ], 8, _hoisted_6$3)
        ]),
        rows.value.length ? (openBlock(), createElementBlock("table", _hoisted_7$3, [
          createElementVNode("tbody", null, [
            (openBlock(true), createElementBlock(
              Fragment,
              null,
              renderList(rows.value, (r) => {
                return openBlock(), createElementBlock("tr", {
                  key: r.key
                }, [
                  createElementVNode(
                    "td",
                    {
                      style: { "width": "20px" },
                      class: normalizeClass(outcome.value[r.key] ? outcome.value[r.key].ok ? "pos" : "neg" : "muted")
                    },
                    toDisplayString(outcome.value[r.key] ? outcome.value[r.key].ok ? "✓" : "✗" : "·"),
                    3
                    /* TEXT, CLASS */
                  ),
                  createElementVNode("td", null, [
                    createTextVNode(
                      toDisplayString(r.label) + " ",
                      1
                      /* TEXT */
                    ),
                    createElementVNode(
                      "span",
                      _hoisted_8$2,
                      toDisplayString(r.selection.length),
                      1
                      /* TEXT */
                    ),
                    text2(r.key) ? (openBlock(), createElementBlock(
                      "div",
                      _hoisted_9$2,
                      toDisplayString(text2(r.key)),
                      1
                      /* TEXT */
                    )) : createCommentVNode("v-if", true)
                  ]),
                  createElementVNode("td", _hoisted_10$2, [
                    createElementVNode("button", {
                      type: "button",
                      class: "x",
                      title: _ctx.$t("Auswahl laden"),
                      onClick: ($event) => emit("load", r.selection)
                    }, "⤓", 8, _hoisted_11$2),
                    createElementVNode("button", {
                      type: "button",
                      class: "x",
                      title: _ctx.$t("entfernen"),
                      onClick: ($event) => remove(r)
                    }, "✕", 8, _hoisted_12$2)
                  ])
                ]);
              }),
              128
              /* KEYED_FRAGMENT */
            ))
          ])
        ])) : createCommentVNode("v-if", true)
      ]);
    };
  }
};
const Cases = /* @__PURE__ */ _export_sfc(_sfc_main$3, [["__scopeId", "data-v-ebd18361"]]);
const _hoisted_1$2 = { class: "pruef" };
const _hoisted_2$2 = {
  key: 0,
  class: "hinweis muted"
};
const _hoisted_3$2 = {
  key: 1,
  class: "neg fehler"
};
const _hoisted_4$2 = { class: "spalten" };
const _hoisted_5$2 = { class: "links" };
const _hoisted_6$2 = { class: "step-band" };
const _hoisted_7$2 = ["placeholder", "title"];
const _hoisted_8$1 = ["disabled"];
const _hoisted_9$1 = {
  key: 0,
  class: "grid auswahl"
};
const _hoisted_10$1 = {
  key: 0,
  class: "muted"
};
const _hoisted_11$1 = { style: { "width": "72px" } };
const _hoisted_12$1 = ["onUpdate:modelValue"];
const _hoisted_13$1 = { style: { "width": "24px" } };
const _hoisted_14$1 = ["title", "onClick"];
const _hoisted_15$1 = {
  key: 1,
  class: "muted leer"
};
const _hoisted_16$1 = { class: "status" };
const _hoisted_17$1 = ["title"];
const _hoisted_18$1 = ["title"];
const _hoisted_19$1 = {
  key: 0,
  class: "meldungen neg"
};
const _hoisted_20$1 = ["title"];
const _hoisted_21$1 = {
  key: 0,
  class: "muted"
};
const _hoisted_22$1 = {
  key: 1,
  class: "meldungen warn"
};
const _hoisted_23$1 = ["title"];
const _hoisted_24$1 = {
  key: 0,
  class: "muted"
};
const _hoisted_25$1 = {
  key: 2,
  class: "grid bilanz"
};
const _hoisted_26 = {
  key: 3,
  class: "grid bilanz gruppentabelle"
};
const _hoisted_27 = ["title"];
const _hoisted_28 = ["title"];
const _hoisted_29 = ["title"];
const _hoisted_30 = {
  key: 0,
  class: "muted"
};
const _hoisted_31 = { class: "waehlbar" };
const _hoisted_32 = { class: "step-band" };
const _hoisted_33 = ["placeholder"];
const _hoisted_34 = { class: "grid" };
const _hoisted_35 = ["title", "onClick"];
const _hoisted_36 = ["title"];
const _hoisted_37 = {
  key: 0,
  class: "muted grund"
};
const _sfc_main$2 = {
  __name: "CheckPanel",
  props: { configurator: { type: String, required: true }, unsaved: { type: Boolean, default: false } },
  setup(__props) {
    const props = __props;
    const selection = ref([]);
    const result = ref(null);
    const error = ref("");
    const input = ref("");
    const filter = ref("");
    let timer = null, ticket = 0;
    const names = computed(() => Object.fromEntries((result.value?.selection ?? []).map((s) => [s.ref, s.name])));
    const name = (ref2) => names.value[ref2] ?? ref2;
    const available = computed(() => (result.value?.selectable ?? []).filter((c) => !filter.value || (c.name ?? "").toLowerCase().includes(filter.value.toLowerCase()) || Object.values(c.keys ?? {}).some((k) => String(k).toLowerCase().includes(filter.value.toLowerCase()))));
    const balance = computed(() => Object.entries(result.value?.balance ?? {}));
    const groups = computed(() => Object.entries(result.value?.groups ?? {}).filter(([, g]) => g.min != null || g.max != null || g.allowed));
    const groupName = (k) => result.value?.groups?.[k]?.label || k;
    const limitText = (g) => g.min != null && g.max != null ? g.min === g.max ? String(g.min) : `${g.min}–${g.max}` : g.min != null ? `≥ ${g.min}` : g.max != null ? `≤ ${g.max}` : "";
    const liftsText = (c) => (c.lifts ?? []).map(groupName).join(", ");
    async function run() {
      const mine = ++ticket;
      try {
        const r = await api.post(`/api/configurator/${encodeURIComponent(props.configurator)}/check`, { selection: selection.value.map((s) => ({ id: s.id, amount: s.amount })), selectable: true });
        if (mine !== ticket) return;
        result.value = r;
        error.value = "";
      } catch (e) {
        if (mine !== ticket) return;
        result.value = null;
        error.value = e.message;
      }
    }
    function soon() {
      clearTimeout(timer);
      timer = setTimeout(run, 200);
    }
    watch(selection, soon, { deep: true });
    watch(() => props.configurator, () => {
      selection.value = [];
      run();
    }, { immediate: true });
    watch(() => props.unsaved, run);
    onBeforeUnmount(() => clearTimeout(timer));
    function add(id) {
      id = String(id ?? "").trim();
      if (!id) return;
      const have = selection.value.find((s) => s.id === id);
      if (have) have.amount += 1;
      else selection.value.push({ id, amount: 1 });
      input.value = "";
    }
    const remove = (i) => selection.value.splice(i, 1);
    const load = (sel) => {
      selection.value = sel.map((s) => ({ id: s.id, amount: s.amount ?? 1 }));
    };
    const num = (v) => Number.isInteger(v) ? v : Math.round(v * 100) / 100;
    const reasonText = (c) => (c.reasons ?? []).map((r) => r.text).join(" · ");
    const affects = (v) => (v.affects ?? []).map(name).join(", ");
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$2, [
        __props.unsaved ? (openBlock(), createElementBlock(
          "div",
          _hoisted_2$2,
          toDisplayString(_ctx.$t("Ungespeicherte Änderungen — geprüft wird der gespeicherte Stand")),
          1
          /* TEXT */
        )) : createCommentVNode("v-if", true),
        error.value ? (openBlock(), createElementBlock(
          "div",
          _hoisted_3$2,
          "✗ " + toDisplayString(error.value),
          1
          /* TEXT */
        )) : createCommentVNode("v-if", true),
        createElementVNode("div", _hoisted_4$2, [
          createElementVNode("div", _hoisted_5$2, [
            createElementVNode(
              "div",
              _hoisted_6$2,
              toDisplayString(_ctx.$t("Auswahl")) + " · " + toDisplayString(selection.value.reduce((n, s) => n + s.amount, 0)),
              1
              /* TEXT */
            ),
            createElementVNode(
              "form",
              {
                class: "eingabe",
                onSubmit: _cache[1] || (_cache[1] = withModifiers(($event) => add(input.value), ["prevent"]))
              },
              [
                withDirectives(createElementVNode("input", {
                  "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => input.value = $event),
                  placeholder: _ctx.$t("Id oder SKU"),
                  title: _ctx.$t("Id eines Knotens oder der eindeutige Wert eines Attributs, wie ein Shop ihn schickt")
                }, null, 8, _hoisted_7$2), [
                  [vModelText, input.value]
                ]),
                createElementVNode("button", {
                  type: "submit",
                  disabled: !input.value.trim()
                }, "＋", 8, _hoisted_8$1)
              ],
              32
              /* NEED_HYDRATION */
            ),
            selection.value.length ? (openBlock(), createElementBlock("table", _hoisted_9$1, [
              createElementVNode("tbody", null, [
                (openBlock(true), createElementBlock(
                  Fragment,
                  null,
                  renderList(selection.value, (s, i) => {
                    return openBlock(), createElementBlock("tr", {
                      key: s.id
                    }, [
                      createElementVNode("td", null, [
                        createTextVNode(
                          toDisplayString(name(s.id)) + " ",
                          1
                          /* TEXT */
                        ),
                        name(s.id) !== s.id ? (openBlock(), createElementBlock(
                          "span",
                          _hoisted_10$1,
                          toDisplayString(s.id),
                          1
                          /* TEXT */
                        )) : createCommentVNode("v-if", true)
                      ]),
                      createElementVNode("td", _hoisted_11$1, [
                        withDirectives(createElementVNode("input", {
                          "onUpdate:modelValue": ($event) => s.amount = $event,
                          type: "number",
                          min: "1",
                          class: "zahl"
                        }, null, 8, _hoisted_12$1), [
                          [
                            vModelText,
                            s.amount,
                            void 0,
                            { number: true }
                          ]
                        ])
                      ]),
                      createElementVNode("td", _hoisted_13$1, [
                        createElementVNode("button", {
                          type: "button",
                          class: "x",
                          title: _ctx.$t("entfernen"),
                          onClick: ($event) => remove(i)
                        }, "✕", 8, _hoisted_14$1)
                      ])
                    ]);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ])
            ])) : (openBlock(), createElementBlock(
              "div",
              _hoisted_15$1,
              toDisplayString(_ctx.$t("Noch nichts gewählt")),
              1
              /* TEXT */
            )),
            result.value ? (openBlock(), createElementBlock(
              Fragment,
              { key: 2 },
              [
                createElementVNode("div", _hoisted_16$1, [
                  createElementVNode("span", {
                    class: normalizeClass([result.value.valid ? "pos" : "neg", "chip"]),
                    title: _ctx.$t("Kein Verbot, keine Grenze, keine Gruppe im Minus oder mit falschen Werten")
                  }, toDisplayString(result.value.valid ? "✓ " + _ctx.$t("zulässig") : "✗ " + _ctx.$t("unzulässig")), 11, _hoisted_17$1),
                  createElementVNode("span", {
                    class: normalizeClass([result.value.complete ? "pos" : "warn", "chip"]),
                    title: _ctx.$t("Nichts verlangt, das fehlt")
                  }, toDisplayString(result.value.complete ? "✓ " + _ctx.$t("vollständig") : "◐ " + _ctx.$t("unvollständig")), 11, _hoisted_18$1)
                ]),
                result.value.violations.length ? (openBlock(), createElementBlock("ul", _hoisted_19$1, [
                  (openBlock(true), createElementBlock(
                    Fragment,
                    null,
                    renderList(result.value.violations, (v, i) => {
                      return openBlock(), createElementBlock("li", {
                        key: i,
                        title: affects(v)
                      }, [
                        createTextVNode(
                          "✗ " + toDisplayString(v.text),
                          1
                          /* TEXT */
                        ),
                        affects(v) ? (openBlock(), createElementBlock(
                          "span",
                          _hoisted_21$1,
                          " · " + toDisplayString(affects(v)),
                          1
                          /* TEXT */
                        )) : createCommentVNode("v-if", true)
                      ], 8, _hoisted_20$1);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ])) : createCommentVNode("v-if", true),
                result.value.missing.length ? (openBlock(), createElementBlock("ul", _hoisted_22$1, [
                  (openBlock(true), createElementBlock(
                    Fragment,
                    null,
                    renderList(result.value.missing, (v, i) => {
                      return openBlock(), createElementBlock("li", {
                        key: i,
                        title: affects(v)
                      }, [
                        createTextVNode(
                          "◐ " + toDisplayString(v.text),
                          1
                          /* TEXT */
                        ),
                        affects(v) ? (openBlock(), createElementBlock(
                          "span",
                          _hoisted_24$1,
                          " · " + toDisplayString(affects(v)),
                          1
                          /* TEXT */
                        )) : createCommentVNode("v-if", true)
                      ], 8, _hoisted_23$1);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ])) : createCommentVNode("v-if", true),
                balance.value.length ? (openBlock(), createElementBlock("table", _hoisted_25$1, [
                  createElementVNode("thead", null, [
                    createElementVNode("tr", null, [
                      createElementVNode(
                        "th",
                        null,
                        toDisplayString(_ctx.$t("Gruppe")),
                        1
                        /* TEXT */
                      ),
                      createElementVNode(
                        "th",
                        null,
                        toDisplayString(_ctx.$t("bereit")),
                        1
                        /* TEXT */
                      ),
                      createElementVNode(
                        "th",
                        null,
                        toDisplayString(_ctx.$t("verbraucht")),
                        1
                        /* TEXT */
                      ),
                      createElementVNode(
                        "th",
                        null,
                        toDisplayString(_ctx.$t("frei")),
                        1
                        /* TEXT */
                      )
                    ])
                  ]),
                  createElementVNode("tbody", null, [
                    (openBlock(true), createElementBlock(
                      Fragment,
                      null,
                      renderList(balance.value, ([res, b]) => {
                        return openBlock(), createElementBlock("tr", { key: res }, [
                          createElementVNode(
                            "td",
                            null,
                            toDisplayString(groupName(res)),
                            1
                            /* TEXT */
                          ),
                          createElementVNode(
                            "td",
                            null,
                            toDisplayString(num(b.provided)),
                            1
                            /* TEXT */
                          ),
                          createElementVNode(
                            "td",
                            null,
                            toDisplayString(num(b.consumed)),
                            1
                            /* TEXT */
                          ),
                          createElementVNode(
                            "td",
                            {
                              class: normalizeClass(b.free < 0 ? "neg" : "")
                            },
                            toDisplayString(num(b.free)),
                            3
                            /* TEXT, CLASS */
                          )
                        ]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ])
                ])) : createCommentVNode("v-if", true),
                groups.value.length ? (openBlock(), createElementBlock("table", _hoisted_26, [
                  createElementVNode("thead", null, [
                    createElementVNode("tr", null, [
                      createElementVNode(
                        "th",
                        null,
                        toDisplayString(_ctx.$t("Gruppe")),
                        1
                        /* TEXT */
                      ),
                      createElementVNode("th", {
                        title: _ctx.$t("Zahl der Teile in der Gruppe")
                      }, toDisplayString(_ctx.$t("Teile")), 9, _hoisted_27),
                      createElementVNode("th", {
                        title: _ctx.$t("Mindest- und Höchstmenge, die Teile oder der Konfigurator vorgeben")
                      }, toDisplayString(_ctx.$t("Vorgabe")), 9, _hoisted_28),
                      createElementVNode("th", {
                        title: _ctx.$t("Erlaubte Werte, danach die vorkommenden")
                      }, toDisplayString(_ctx.$t("Werte")), 9, _hoisted_29)
                    ])
                  ]),
                  createElementVNode("tbody", null, [
                    (openBlock(true), createElementBlock(
                      Fragment,
                      null,
                      renderList(groups.value, ([key, g]) => {
                        return openBlock(), createElementBlock("tr", { key }, [
                          createElementVNode(
                            "td",
                            null,
                            toDisplayString(g.label || key),
                            1
                            /* TEXT */
                          ),
                          createElementVNode(
                            "td",
                            null,
                            toDisplayString(g.count),
                            1
                            /* TEXT */
                          ),
                          createElementVNode(
                            "td",
                            null,
                            toDisplayString(limitText(g)),
                            1
                            /* TEXT */
                          ),
                          createElementVNode("td", null, [
                            createTextVNode(
                              toDisplayString((g.allowed ?? []).join(", ")),
                              1
                              /* TEXT */
                            ),
                            g.values?.length ? (openBlock(), createElementBlock(
                              "span",
                              _hoisted_30,
                              " → " + toDisplayString(g.values.join(", ")),
                              1
                              /* TEXT */
                            )) : createCommentVNode("v-if", true)
                          ])
                        ]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ])
                ])) : createCommentVNode("v-if", true)
              ],
              64
              /* STABLE_FRAGMENT */
            )) : createCommentVNode("v-if", true),
            createVNode(Cases, {
              configurator: __props.configurator,
              selection: selection.value,
              result: result.value,
              onLoad: load
            }, null, 8, ["configurator", "selection", "result"])
          ]),
          createElementVNode("div", _hoisted_31, [
            createElementVNode(
              "div",
              _hoisted_32,
              toDisplayString(_ctx.$t("Wählbar")) + " · " + toDisplayString(result.value?.selectable?.filter((c) => c.ok).length ?? 0) + "/" + toDisplayString(result.value?.selectable?.length ?? 0),
              1
              /* TEXT */
            ),
            withDirectives(createElementVNode("input", {
              "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => filter.value = $event),
              class: "filter",
              placeholder: _ctx.$t("filtern")
            }, null, 8, _hoisted_33), [
              [vModelText, filter.value]
            ]),
            createElementVNode("table", _hoisted_34, [
              createElementVNode("tbody", null, [
                (openBlock(true), createElementBlock(
                  Fragment,
                  null,
                  renderList(available.value, (c) => {
                    return openBlock(), createElementBlock("tr", {
                      key: c.id,
                      class: normalizeClass({ gesperrt: !c.ok }),
                      title: c.ok ? _ctx.$t("zur Auswahl hinzufügen") : reasonText(c),
                      onClick: ($event) => c.ok && add(c.id)
                    }, [
                      createElementVNode(
                        "td",
                        {
                          style: { "width": "20px" },
                          class: normalizeClass(c.ok ? "pos" : "neg")
                        },
                        toDisplayString(c.ok ? "✓" : "✗"),
                        3
                        /* TEXT, CLASS */
                      ),
                      createElementVNode("td", null, [
                        createTextVNode(
                          toDisplayString(c.name),
                          1
                          /* TEXT */
                        ),
                        (openBlock(true), createElementBlock(
                          Fragment,
                          null,
                          renderList(c.keys, (v, k) => {
                            return openBlock(), createElementBlock(
                              "span",
                              {
                                key: k,
                                class: "muted"
                              },
                              " · " + toDisplayString(v),
                              1
                              /* TEXT */
                            );
                          }),
                          128
                          /* KEYED_FRAGMENT */
                        )),
                        c.ok && c.lifts?.length ? (openBlock(), createElementBlock("span", {
                          key: 0,
                          class: "pos hebt",
                          title: _ctx.$t("Hebt die Summe einer Gruppe, die im Minus ist")
                        }, " ↑ " + toDisplayString(liftsText(c)), 9, _hoisted_36)) : createCommentVNode("v-if", true)
                      ]),
                      !c.ok ? (openBlock(), createElementBlock(
                        "td",
                        _hoisted_37,
                        toDisplayString(reasonText(c)),
                        1
                        /* TEXT */
                      )) : createCommentVNode("v-if", true)
                    ], 10, _hoisted_35);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ])
            ])
          ])
        ])
      ]);
    };
  }
};
const CheckPanel = /* @__PURE__ */ _export_sfc(_sfc_main$2, [["__scopeId", "data-v-d7115c5d"]]);
const _hoisted_1$1 = {
  class: "pane",
  style: { "flex": "1" }
};
const _hoisted_2$1 = { class: "toolbar" };
const _hoisted_3$1 = { class: "seiten" };
const _hoisted_4$1 = { class: "liste" };
const _hoisted_5$1 = { class: "step-band" };
const _hoisted_6$1 = { class: "grid" };
const _hoisted_7$1 = ["onClick"];
const _hoisted_8 = { class: "muted" };
const _hoisted_9 = ["title"];
const _hoisted_10 = ["title"];
const _hoisted_11 = ["placeholder", "title"];
const _hoisted_12 = ["disabled", "title"];
const _hoisted_13 = {
  key: 0,
  class: "rechts"
};
const _hoisted_14 = { class: "kopf" };
const _hoisted_15 = ["placeholder"];
const _hoisted_16 = ["disabled"];
const _hoisted_17 = ["title"];
const _hoisted_18 = { class: "kopf" };
const _hoisted_19 = ["title"];
const _hoisted_20 = ["title"];
const _hoisted_21 = ["title"];
const _hoisted_22 = {
  key: 1,
  class: "fehler neg"
};
const _hoisted_23 = { class: "tabs" };
const _hoisted_24 = ["title"];
const _hoisted_25 = {
  key: 1,
  class: "rechts muted leer"
};
const _sfc_main$1 = {
  __name: "View",
  setup(__props) {
    const list = ref([]);
    const cur = ref("");
    const def = ref(null);
    const errors = ref([]);
    const baseline = ref("");
    const dirty = computed(() => !!def.value && JSON.stringify(cleanDefinition(def.value)) !== baseline.value);
    const tab = ref("rules");
    const busy = ref("");
    const newKey = ref("");
    const rootOpen = ref(false);
    const attributes = computed(() => (store.model?.attributes ?? []).map((a) => ({ key: a.key, label: L(a.label) || a.key })).sort((a, b) => a.label.localeCompare(b.label)));
    const rootName = computed(() => def.value?.root ? tree.byId?.get(def.value.root)?.label ?? def.value.root : "");
    const keyOk = computed(() => KEY_PATTERN.test(newKey.value) && !list.value.some((c) => c.key === newKey.value));
    async function loadList() {
      try {
        list.value = await api.get("/api/configurator") ?? [];
        busy.value = "";
      } catch (e) {
        list.value = [];
        busy.value = "✗ " + e.message;
      }
    }
    onMounted(loadList);
    async function open(key) {
      try {
        const r = await api.get(`/api/configurator/${encodeURIComponent(key)}`);
        def.value = { label: "", rules: [], ...JSON.parse(JSON.stringify(r.definition ?? {})) };
        def.value.rules ??= [];
        def.value.limits ??= [];
        errors.value = r.errors ?? [];
        baseline.value = JSON.stringify(cleanDefinition(def.value));
        cur.value = key;
        busy.value = "";
      } catch (e) {
        busy.value = "✗ " + e.message;
      }
    }
    async function writeDef(key, d) {
      await api.post(`/api/plugins/configurator/data/${encodeURIComponent("def:" + key)}`, cleanDefinition(d), "PUT");
    }
    async function create() {
      if (!keyOk.value) return;
      const key = newKey.value;
      try {
        await writeDef(key, emptyDefinition(key));
        newKey.value = "";
        await loadList();
        await open(key);
      } catch (e) {
        store.toast(e.message);
      }
    }
    async function save() {
      const ctx = { t, nodeName: (id) => tree.byId?.get(id)?.label ?? id, attributeName: (k) => attributes.value.find((a) => a.key === k)?.label ?? k };
      for (const r of def.value.rules) if (!String(r.text ?? "").trim()) r.text = describeRule(r, ctx);
      try {
        await writeDef(cur.value, def.value);
        await loadList();
        await open(cur.value);
        store.toast(t("Gespeichert"), "ok");
      } catch (e) {
        store.toast(e.message);
      }
    }
    async function remove() {
      const key = cur.value;
      const ok = await dialog.confirm({ title: t("Konfigurator entfernen"), text: t("{0} — mit seinen Regeln und Testfällen.", [def.value?.label || key]), ok: t("Entfernen"), danger: true });
      if (!ok) return;
      try {
        const cases = await api.get(`/api/plugins/configurator/data?prefix=${encodeURIComponent("case:" + key + ":")}`) ?? [];
        for (const name of cases) await api.del(`/api/plugins/configurator/data/${encodeURIComponent(name)}`);
        await api.del(`/api/plugins/configurator/data/${encodeURIComponent("def:" + key)}`);
        cur.value = "";
        def.value = null;
        errors.value = [];
        await loadList();
      } catch (e) {
        store.toast(e.message);
      }
    }
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$1, [
        createElementVNode("div", _hoisted_2$1, [
          createElementVNode(
            "h1",
            null,
            toDisplayString(_ctx.$t("⚙ Konfigurator")),
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
          createElementVNode(
            "span",
            {
              class: normalizeClass(String(busy.value).startsWith("✗") ? "fehler" : "muted")
            },
            toDisplayString(busy.value),
            3
            /* TEXT, CLASS */
          )
        ]),
        createElementVNode("div", _hoisted_3$1, [
          createElementVNode("div", _hoisted_4$1, [
            createElementVNode(
              "div",
              _hoisted_5$1,
              toDisplayString(_ctx.$t("Konfiguratoren")) + " · " + toDisplayString(list.value.length),
              1
              /* TEXT */
            ),
            createElementVNode("table", _hoisted_6$1, [
              createElementVNode("tbody", null, [
                (openBlock(true), createElementBlock(
                  Fragment,
                  null,
                  renderList(list.value, (c) => {
                    return openBlock(), createElementBlock("tr", {
                      key: c.key,
                      class: normalizeClass({ current: cur.value === c.key }),
                      style: { "cursor": "pointer" },
                      onClick: ($event) => open(c.key)
                    }, [
                      createElementVNode("td", null, [
                        createTextVNode(
                          toDisplayString(c.label || c.key) + " ",
                          1
                          /* TEXT */
                        ),
                        createElementVNode(
                          "span",
                          _hoisted_8,
                          toDisplayString(c.key),
                          1
                          /* TEXT */
                        )
                      ]),
                      createElementVNode("td", {
                        class: "muted",
                        style: { "width": "40px" },
                        title: _ctx.$t("Regeln")
                      }, toDisplayString(c.rules), 9, _hoisted_9),
                      createElementVNode("td", {
                        style: { "width": "24px" },
                        class: normalizeClass(c.errors ? "neg" : ""),
                        title: c.errors ? _ctx.$t("Die Definition hat Fehler") : ""
                      }, toDisplayString(c.errors ? "✗" : ""), 11, _hoisted_10)
                    ], 10, _hoisted_7$1);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ])
            ]),
            createElementVNode(
              "form",
              {
                class: "neu",
                onSubmit: withModifiers(create, ["prevent"])
              },
              [
                withDirectives(createElementVNode("input", {
                  "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => newKey.value = $event),
                  placeholder: _ctx.$t("Schlüssel, z. B. server"),
                  title: _ctx.$t("a–z, 0–9, _ und -, beginnt mit einem Buchstaben")
                }, null, 8, _hoisted_11), [
                  [vModelText, newKey.value]
                ]),
                createElementVNode("button", {
                  type: "submit",
                  disabled: !keyOk.value,
                  title: _ctx.$t("Konfigurator anlegen")
                }, "＋", 8, _hoisted_12)
              ],
              32
              /* NEED_HYDRATION */
            )
          ]),
          def.value ? (openBlock(), createElementBlock("div", _hoisted_13, [
            createElementVNode("div", _hoisted_14, [
              withDirectives(createElementVNode("input", {
                "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => def.value.label = $event),
                class: "bez",
                placeholder: _ctx.$t("Bezeichnung")
              }, null, 8, _hoisted_15), [
                [vModelText, def.value.label]
              ]),
              createElementVNode("button", {
                type: "button",
                class: "primary",
                disabled: !dirty.value,
                onClick: save
              }, toDisplayString(_ctx.$t("Speichern")), 9, _hoisted_16),
              createElementVNode("button", {
                type: "button",
                title: _ctx.$t("Konfigurator entfernen"),
                onClick: remove
              }, "✕", 8, _hoisted_17)
            ]),
            createElementVNode("div", _hoisted_18, [
              createElementVNode("span", {
                class: "muted",
                title: _ctx.$t("Der Teilbaum, aus dem gewählt werden darf — leer: alles")
              }, toDisplayString(_ctx.$t("Wurzel")), 9, _hoisted_19),
              createElementVNode(
                "button",
                {
                  type: "button",
                  class: "knoten",
                  onClick: _cache[2] || (_cache[2] = ($event) => rootOpen.value = !rootOpen.value)
                },
                toDisplayString(rootName.value || _ctx.$t("alles")),
                1
                /* TEXT */
              ),
              def.value.root ? (openBlock(), createElementBlock("button", {
                key: 0,
                type: "button",
                class: "x",
                title: _ctx.$t("Wurzel entfernen"),
                onClick: _cache[3] || (_cache[3] = ($event) => def.value.root = "")
              }, "✕", 8, _hoisted_20)) : createCommentVNode("v-if", true),
              createElementVNode("span", {
                class: "muted",
                title: _ctx.$t("Das Zeilenattribut am Produkt mit den Spalten resource und amount")
              }, toDisplayString(_ctx.$t("Ressourcen")), 9, _hoisted_21),
              withDirectives(createElementVNode(
                "input",
                {
                  "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => def.value.resources = $event),
                  class: "res",
                  placeholder: "resources"
                },
                null,
                512
                /* NEED_PATCH */
              ), [
                [vModelText, def.value.resources]
              ])
            ]),
            rootOpen.value ? (openBlock(), createBlock(unref(TreePicker), {
              key: 0,
              modelValue: def.value.root,
              "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => def.value.root = $event),
              roles: ["group", "product"],
              "allow-root": "",
              height: 180,
              onPick: _cache[6] || (_cache[6] = ($event) => rootOpen.value = false)
            }, null, 8, ["modelValue"])) : createCommentVNode("v-if", true),
            errors.value.length ? (openBlock(), createElementBlock("ul", _hoisted_22, [
              (openBlock(true), createElementBlock(
                Fragment,
                null,
                renderList(errors.value, (e, i) => {
                  return openBlock(), createElementBlock(
                    "li",
                    { key: i },
                    "✗ " + toDisplayString(e),
                    1
                    /* TEXT */
                  );
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ])) : createCommentVNode("v-if", true),
            createElementVNode("div", _hoisted_23, [
              createElementVNode(
                "button",
                {
                  type: "button",
                  class: normalizeClass({ on: tab.value === "rules" }),
                  onClick: _cache[7] || (_cache[7] = ($event) => tab.value = "rules")
                },
                toDisplayString(_ctx.$t("Regeln")) + " · " + toDisplayString(def.value.rules.length),
                3
                /* TEXT, CLASS */
              ),
              createElementVNode("button", {
                type: "button",
                class: normalizeClass(["reiter-gruppen", { on: tab.value === "groups" }]),
                title: _ctx.$t("Konfiguratorgruppen: Teile gehören mit Zeilen zu Gruppen, die summieren, gleiche Werte verlangen oder Mengen und Werte vorgeben"),
                onClick: _cache[8] || (_cache[8] = ($event) => tab.value = "groups")
              }, toDisplayString(_ctx.$t("Gruppen")), 11, _hoisted_24),
              createElementVNode(
                "button",
                {
                  type: "button",
                  class: normalizeClass({ on: tab.value === "check" }),
                  onClick: _cache[9] || (_cache[9] = ($event) => tab.value = "check")
                },
                toDisplayString(_ctx.$t("Prüfen")),
                3
                /* TEXT, CLASS */
              )
            ]),
            tab.value === "rules" ? (openBlock(), createBlock(RuleEditor, {
              key: 2,
              def: def.value,
              attributes: attributes.value
            }, null, 8, ["def", "attributes"])) : tab.value === "groups" ? (openBlock(), createBlock(Groups, {
              key: 3,
              def: def.value,
              attributes: attributes.value
            }, null, 8, ["def", "attributes"])) : (openBlock(), createBlock(CheckPanel, {
              key: 4,
              configurator: cur.value,
              unsaved: dirty.value
            }, null, 8, ["configurator", "unsaved"]))
          ])) : (openBlock(), createElementBlock(
            "div",
            _hoisted_25,
            toDisplayString(_ctx.$t("Einen Konfigurator wählen oder anlegen")),
            1
            /* TEXT */
          ))
        ])
      ]);
    };
  }
};
const View = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["__scopeId", "data-v-0df34234"]]);
const _hoisted_1 = { class: "konfband" };
const _hoisted_2 = {
  key: 0,
  class: "neg"
};
const _hoisted_3 = {
  key: 0,
  class: "saetze"
};
const _hoisted_4 = {
  key: 1,
  class: "muted keine"
};
const _hoisted_5 = ["title"];
const _hoisted_6 = { class: "leiste" };
const _hoisted_7 = ["title"];
const _sfc_main = {
  __name: "Band",
  props: { nodeId: String },
  emits: ["kopf"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const own = ref(null);
    const inherited = ref(null);
    const groups = ref([]);
    const edit = ref(null);
    const base = ref("");
    const error = ref("");
    const attributes = computed(() => (store.model?.attributes ?? []).map((a) => ({ key: a.key, label: L(a.label) || a.key })));
    const nameOf = (id) => tree.byId?.get(id)?.label ?? id;
    const rows = computed(() => own.value ?? inherited.value?.rows ?? []);
    const dirty = computed(() => !!edit.value && JSON.stringify(cleanRows(edit.value.rows)) !== base.value);
    const ctx = computed(() => ({
      t,
      nodeName: nameOf,
      attributeName: (k) => attributes.value.find((a) => a.key === k)?.label ?? k,
      groupName: (k) => groups.value.find((g) => g.key === k)?.label || k
    }));
    const sentence = (r) => describeRow(r, ctx.value);
    const doc = (id) => `/api/plugins/configurator/data/${encodeURIComponent("member:" + id)}`;
    const clone = (x) => JSON.parse(JSON.stringify(x));
    async function read() {
      error.value = "";
      edit.value = null;
      try {
        const [names, defined] = await Promise.all([
          api.get("/api/plugins/configurator/data?prefix=" + encodeURIComponent("member:")),
          api.get("/api/plugins/configurator/data?prefix=" + encodeURIComponent("group:") + "&values=true")
        ]);
        const have = new Set((names ?? []).map((n) => n.slice("member:".length)));
        groups.value = Object.entries(defined ?? {}).map(([n, v]) => ({ key: n.slice("group:".length), label: v?.label ?? null }));
        own.value = have.has(props.nodeId) ? (await api.get(doc(props.nodeId)))?.rows ?? [] : null;
        inherited.value = null;
        if (own.value === null) {
          for (const a of [...tree.ancestors?.(props.nodeId) ?? []].reverse())
            if (have.has(a.id)) {
              inherited.value = { from: a.id, rows: (await api.get(doc(a.id)))?.rows ?? [] };
              break;
            }
        }
        emit("kopf", own.value ? "· " + t("{0} Zeilen", [own.value.length]) : inherited.value ? "· " + t("{0} Zeilen", [inherited.value.rows.length]) + " ↑ " + nameOf(inherited.value.from) : "· " + t("keine"));
      } catch (e) {
        error.value = e.message;
        emit("kopf", "· ✗ " + e.message);
      }
    }
    onMounted(read);
    watch(() => props.nodeId, read);
    function open() {
      const copy = clone(own.value ?? inherited.value?.rows ?? []);
      edit.value = { node: props.nodeId, rows: copy.length ? copy : [newRow("member")] };
      base.value = own.value ? JSON.stringify(cleanRows(copy)) : "[]";
    }
    async function save() {
      const list = cleanRows(edit.value.rows);
      try {
        if (list.length) await api.post(doc(props.nodeId), { rows: list }, "PUT");
        else await api.del(doc(props.nodeId));
        store.toast(t("Gespeichert"), "ok");
        await read();
      } catch (e) {
        store.toast(e.message);
      }
    }
    async function remove() {
      if (own.value === null) {
        edit.value = null;
        return;
      }
      const ok = await dialog.confirm({ title: t("Zeilen entfernen"), text: t("{0} — alle Zeilen dieses Teils.", [nameOf(props.nodeId)]), ok: t("Entfernen"), danger: true });
      if (!ok) return;
      try {
        await api.del(doc(props.nodeId));
        await read();
      } catch (e) {
        store.toast(e.message);
      }
    }
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        error.value ? (openBlock(), createElementBlock(
          "div",
          _hoisted_2,
          "✗ " + toDisplayString(error.value),
          1
          /* TEXT */
        )) : createCommentVNode("v-if", true),
        !edit.value ? (openBlock(), createElementBlock(
          Fragment,
          { key: 1 },
          [
            rows.value.length ? (openBlock(), createElementBlock("ul", _hoisted_3, [
              (openBlock(true), createElementBlock(
                Fragment,
                null,
                renderList(rows.value, (r, i) => {
                  return openBlock(), createElementBlock(
                    "li",
                    {
                      key: i,
                      class: "satz"
                    },
                    toDisplayString(sentence(r)),
                    1
                    /* TEXT */
                  );
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ])) : (openBlock(), createElementBlock(
              "div",
              _hoisted_4,
              toDisplayString(_ctx.$t("Keine Zeilen")),
              1
              /* TEXT */
            )),
            inherited.value ? (openBlock(), createElementBlock("div", {
              key: 2,
              class: "muted geerbt",
              title: _ctx.$t("Eigene Zeilen ersetzen die geerbten ganz")
            }, "↑ " + toDisplayString(_ctx.$t("geerbt von {0}", [nameOf(inherited.value.from)])), 9, _hoisted_5)) : createCommentVNode("v-if", true),
            createElementVNode("div", _hoisted_6, [
              createElementVNode("button", {
                type: "button",
                class: "bearbeiten",
                title: own.value ? _ctx.$t("Die Zeilen dieses Teils bearbeiten") : inherited.value ? _ctx.$t("Die geerbten Zeilen als eigene übernehmen und bearbeiten") : _ctx.$t("Dieses Teil gehört mit Zeilen zu Gruppen"),
                onClick: open
              }, toDisplayString(own.value ? "✎ " + _ctx.$t("Zeilen") : inherited.value ? "✎ " + _ctx.$t("Eigene Zeilen") : "＋ " + _ctx.$t("Zeile")), 9, _hoisted_7)
            ])
          ],
          64
          /* STABLE_FRAGMENT */
        )) : (openBlock(), createBlock(MemberEditor, {
          key: 2,
          edit: edit.value,
          groups: groups.value,
          attributes: attributes.value,
          dirty: dirty.value,
          onSave: save,
          onRemove: remove,
          onClose: _cache[0] || (_cache[0] = ($event) => edit.value = null)
        }, null, 8, ["edit", "groups", "attributes", "dirty"]))
      ]);
    };
  }
};
const Band = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-05d59a55"]]);
async function bandMount({ head, body }, nodeId) {
  const app = createApp({ render: () => h$1(Band, { nodeId, onKopf: (text2) => {
    head.textContent = text2;
  } }) });
  app.config.globalProperties.$t = t;
  app.mount(body);
  return () => app.unmount();
}
const entry = {
  views: [{ path: "regeln", topic: "tools", label: t("Konfigurator"), icon: "⚙", hint: t("Regeln, die zu einer Auswahl von Produkten sagen, was zulässig ist und was fehlt — mit Beispielen und Testfällen"), component: View }],
  nodeBands: [{ key: "gruppen", label: t("Konfiguratorgruppen"), icon: "⚙", roles: ["group", "product", "variant"], mount: bandMount }]
};
export {
  entry as default
};
