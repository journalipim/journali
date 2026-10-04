(function(){const s=document.createElement('style');s.textContent="\n.bench[data-v-15658930] { padding: 10px 12px;\n}\n.pfad[data-v-15658930] { font-size: 12px; display: flex; flex-wrap: wrap; gap: 4px;\n}\n.knoten[data-v-15658930] { margin: 4px 0; font-size: 15px; display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap;\n}\n.knoten a[data-v-15658930] { color: var(--text); text-decoration: none;\n}\n.knoten a[data-v-15658930]:hover { color: var(--accent);\n}\n.feld[data-v-15658930] { font-size: 12px; font-weight: 400;\n}\n.erben[data-v-15658930] { font-size: 12px; margin: 0 0 6px;\n}\n.regel[data-v-15658930] { margin: 6px 0;\n}\n.hint[data-v-15658930] { font-size: 12px; color: var(--muted);\n}\n.wert[data-v-15658930] { background: var(--pane); border: 1px solid var(--line); border-radius: 4px; padding: 6px 8px; margin: 8px 0 6px; font-size: 13px; white-space: pre-wrap; max-height: 120px; overflow: auto;\n}\n.feldtext[data-v-15658930] { width: 100%; font-family: inherit;\n}\n.knoepfe[data-v-15658930] { display: flex; gap: 6px; margin: 6px 0;\n}\n.ausnahme[data-v-15658930] { display: flex; gap: 6px; align-items: center; margin: 10px 0;\n}\n.grund[data-v-15658930] { flex: 1; min-width: 120px;\n}\n.weitere[data-v-15658930] { display: flex; flex-wrap: wrap; gap: 4px; align-items: center;\n}\n.chip[data-v-15658930] { border: 1px solid var(--line); background: var(--pane); border-radius: 10px; padding: 0 8px; cursor: pointer; color: var(--text);\n}\n.x[data-v-15658930] { border: 0; background: none; color: var(--muted); cursor: pointer;\n}\n.x[data-v-15658930]:hover { color: var(--accent);\n}\n\n.term[data-v-bf2351b5] { padding: 10px 12px;\n}\n.term h3[data-v-bf2351b5] { margin: 0 0 4px; font-size: 15px;\n}\n.regel[data-v-bf2351b5] { font-size: 12px; margin: 0 0 8px;\n}\n.ersatz[data-v-bf2351b5] { display: flex; gap: 6px; margin: 0 0 8px;\n}\n.ersatz input[data-v-bf2351b5] { flex: 1;\n}\n.vorschau td[data-v-bf2351b5] { vertical-align: top;\n}\n.snip[data-v-bf2351b5] { font-size: 12px;\n}\n.feld[data-v-bf2351b5] { font-size: 11px;\n}\n.aus[data-v-bf2351b5] { opacity: .45;\n}\nmark.neu[data-v-bf2351b5] { background: color-mix(in srgb, var(--pos) 35%, transparent);\n}\n\n.empco[data-v-f153f32f] { display: flex; flex-direction: column; min-height: 0;\n}\n.wurzel[data-v-f153f32f] { position: relative;\n}\n.knoten[data-v-f153f32f] { border: 1px solid var(--line); background: var(--pane); color: var(--text); padding: 2px 8px; border-radius: 3px; cursor: pointer;\n}\n.picker[data-v-f153f32f] { position: absolute; left: 0; top: 30px; z-index: 6; width: 380px; padding: 6px; background: var(--pane); border: 1px solid var(--line);\n}\n.katalog[data-v-f153f32f] { padding: 4px 12px; border-bottom: 1px solid var(--line);\n}\n.katalog summary[data-v-f153f32f] { cursor: pointer;\n}\n.quellen[data-v-f153f32f] { font-size: 12px; margin: 4px 0; display: flex; gap: 10px;\n}\n.klein[data-v-f153f32f] { font-size: 11px;\n}\n.leiste[data-v-f153f32f] { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; padding: 6px 12px; border-bottom: 1px solid var(--line);\n}\n.chip[data-v-f153f32f] { border: 1px solid var(--line); background: var(--pane); color: var(--text); border-radius: 12px; padding: 1px 10px; cursor: pointer; font-size: 12px;\n}\n.chip.on[data-v-f153f32f] { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 18%, var(--pane));\n}\n.suche[data-v-f153f32f] { width: 180px;\n}\n.arbeit[data-v-f153f32f] { display: flex; flex: 1; min-height: 0;\n}\n.liste[data-v-f153f32f] { width: 48%; min-width: 360px; overflow: auto; border-right: 1px solid var(--line);\n}\n.flaeche[data-v-f153f32f] { flex: 1; overflow: auto;\n}\ntr[data-v-f153f32f] { cursor: pointer;\n}\ntr.cur[data-v-f153f32f] { background: color-mix(in srgb, var(--accent) 16%, transparent);\n}\ntr.aus[data-v-f153f32f] { opacity: .5;\n}\n.kn[data-v-f153f32f] { white-space: nowrap; max-width: 220px; overflow: hidden; text-overflow: ellipsis;\n}\n.feld[data-v-f153f32f] { white-space: nowrap;\n}\n.snip[data-v-f153f32f] { font-size: 12px;\n}\n.hinweis[data-v-f153f32f] { padding: 6px 12px;\n}\n.empty[data-v-f153f32f] { padding: 24px;\n}\n";document.head.append(s)})();
const m = window.journali.vue;
const Fragment = m.Fragment;
const computed = m.computed;
const createBlock = m.createBlock;
const createCommentVNode = m.createCommentVNode;
const createElementBlock = m.createElementBlock;
const createElementVNode = m.createElementVNode;
const createTextVNode = m.createTextVNode;
const createVNode = m.createVNode;
const nextTick = m.nextTick;
const normalizeClass = m.normalizeClass;
const onBeforeUnmount = m.onBeforeUnmount;
const onMounted = m.onMounted;
const openBlock = m.openBlock;
const reactive = m.reactive;
const ref = m.ref;
const renderList = m.renderList;
const toDisplayString = m.toDisplayString;
const unref = m.unref;
const vModelCheckbox = m.vModelCheckbox;
const vModelText = m.vModelText;
const vShow = m.vShow;
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
const catalog = {
  key: "empco",
  label: "EmpCo — Greenwashing (EU 2024/825)",
  icon: "♻",
  sources: [
    { label: "Richtlinie (EU) 2024/825 (EUR-Lex)", url: "https://eur-lex.europa.eu/eli/dir/2024/825/oj" },
    { label: "UGP-Richtlinie 2005/29/EG, Anhang I (konsolidiert)", url: "https://eur-lex.europa.eu/eli/dir/2005/29/oj" }
  ],
  // Begriffe je Sprache — Wortgrenzen, Gross/Klein egal
  rules: [
    {
      id: "generic",
      severity: "error",
      ref: "Anhang I Nr. 4a",
      label: "Allgemeine Umweltaussage ohne Beleg",
      hint: "Pauschale Umweltaussagen sind verboten, wenn keine anerkannte hervorragende Umweltleistung nachgewiesen wird. Konkret machen: was, wie viel, womit belegt.",
      terms: ["umweltfreundlich", "umweltschonend", "umweltverträglich", "ökologisch", "öko", "grün", "naturfreundlich", "klimafreundlich", "klimaschonend", "nachhaltig", "natürlich", "sanft zur umwelt", "eco-friendly", "environmentally friendly", "green", "eco", "sustainable", "natural", "climate-friendly", "gentle on the environment"]
    },
    {
      id: "neutral",
      severity: "error",
      ref: "Anhang I Nr. 4c",
      label: "Klimaneutral / CO₂-Ausgleich",
      hint: "Aussagen, ein Produkt habe eine neutrale, reduzierte oder positive Klimawirkung aufgrund von Kompensation, sind verboten. Nur echte Reduktion mit Nachweis nennen.",
      terms: ["klimaneutral", "co2-neutral", "co₂-neutral", "co2 neutral", "klimapositiv", "kohlenstoffneutral", "netto-null", "net zero", "carbon neutral", "climate neutral", "climate positive", "carbon negative", "co2-kompensiert", "klimakompensiert", "offset"]
    },
    {
      id: "future",
      severity: "warn",
      ref: "Art. 6 Abs. 2 Buchst. d",
      label: "Zukünftige Umweltleistung ohne Plan",
      hint: "Versprechen künftiger Umweltleistung („bis 2030 klimaneutral“) nur mit klaren, veröffentlichten, überprüfbaren Verpflichtungen und unabhängiger Überwachung.",
      pattern: "\\b(bis|ab|until|by)\\s+20[2-5]\\d\\b.{0,60}\\b(klima|co2|co₂|emission|carbon|neutral|net zero|nachhaltig|sustainab)"
    },
    {
      id: "label",
      severity: "warn",
      ref: "Anhang I Nr. 2a / Art. 2 Buchst. q, r",
      label: "Nachhaltigkeitssiegel ohne Zertifizierung",
      hint: "Nachhaltigkeitssiegel nur, wenn sie auf einem Zertifizierungssystem beruhen oder von Behörden stammen. Herkunft des Siegels prüfen und nennen.",
      terms: ["siegel", "zertifiziert nachhaltig", "geprüft nachhaltig", "eco-label", "öko-label", "umweltzeichen", "green label", "sustainability label", "award"]
    },
    {
      id: "partial",
      severity: "warn",
      ref: "Anhang I Nr. 4b",
      label: "Aussage über das ganze Produkt, die nur einen Teil betrifft",
      hint: "Eine Umweltaussage über das gesamte Produkt oder Unternehmen, die nur einen Aspekt betrifft, ist verboten — Bezug klar machen (Verpackung? Anteil?).",
      terms: ["100 % recycelt", "100% recycelt", "100 % recycled", "100% recycled", "vollständig recycelbar", "fully recyclable", "komplett nachhaltig", "rundum nachhaltig"]
    },
    {
      id: "recyclable",
      severity: "info",
      ref: "Art. 6 Abs. 1 lit. b (Irreführung über Beschaffenheit)",
      label: "Recycelbar / biologisch abbaubar — Bedingungen nennen",
      hint: "Recycelbarkeit und Abbaubarkeit gelten nur unter Bedingungen (Sammelsystem, Industriekompost). Ohne Angabe irreführend — Bedingung und Anteil ergänzen.",
      terms: ["recycelbar", "recyclingfähig", "wiederverwertbar", "biologisch abbaubar", "kompostierbar", "recyclable", "biodegradable", "compostable"]
    },
    {
      id: "durability",
      severity: "warn",
      ref: "Anhang I Nr. 23g (UWG Anhang Nr. 23d Buchst. d)",
      label: "Haltbarkeitsaussage ohne Nachweis",
      hint: "Aussagen zur Haltbarkeit („langlebig“, „hält ewig“) brauchen Belege; gewerbliche Haltbarkeitsgarantien müssen Bedingungen nennen.",
      terms: ["langlebig", "hält ewig", "unverwüstlich", "lebenslang", "für die ewigkeit", "long-lasting", "lasts forever", "indestructible", "lifetime"]
    },
    {
      id: "comparative",
      severity: "warn",
      ref: "Art. 6 Abs. 1 / Anhang I Nr. 4a",
      label: "Vergleichende Umweltaussage ohne Bezug",
      hint: "„umweltfreundlicher“, „grüner als“ braucht den Vergleichsgegenstand, die Methode und den Zeitraum.",
      pattern: "\\b(umweltfreundlicher|grüner|nachhaltiger|klimafreundlicher|sauberer|greener|more sustainable|cleaner|more eco)\\b"
    }
  ]
};
const strip = (v) => String(v ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const rx = (rule) => rule.pattern ? new RegExp(rule.pattern, "i") : new RegExp("(?<![\\p{L}\\p{N}_])(" + rule.terms.map(esc).join("|") + ")(e|es|er|en|em|s)?(?![\\p{L}\\p{N}_])", "iu");
const checks = catalog.rules.map((rule) => ({
  key: rule.id,
  label: `${catalog.icon} ${rule.label}`,
  severity: rule.severity,
  run({ values, columns }) {
    const r = rx(rule);
    const out = [];
    for (const c of columns) {
      if (c.type !== "text" && c.type !== "html") continue;
      const text = strip(values[c.key]?.value);
      if (!text) continue;
      const m2 = text.match(r);
      if (!m2) continue;
      out.push({ attribute: c.key, type: c.type, term: m2[0], base: m2[1] ?? m2[0], message: `„${m2[0]}“ — ${rule.hint} (${rule.ref})` });
    }
    return out;
  }
}));
const hash = (s) => {
  let h2 = 5381;
  for (let i = 0; i < s.length; i++) h2 = (h2 << 5) + h2 + s.charCodeAt(i) | 0;
  return (h2 >>> 0).toString(36);
};
const textHash = (raw) => hash(strip(raw));
const findingKey = (f) => [f.node.id, f.attribute, f.locale, f.rule, f.term.toLowerCase()].join("|");
function collect(tables, locales) {
  const findings = [];
  for (let i = 0; i < locales.length; i++) {
    const t2 = tables[i];
    for (const r of t2.rows) {
      const columns = t2.columns.filter((x) => !(r.inactive ?? []).includes(x.key));
      for (const c of checks) for (const f of c.run({ values: r.values, columns })) {
        const v = r.values[f.attribute];
        findings.push({ ...f, rule: c.key, severity: c.severity, locale: locales[i], node: r.row, raw: v?.value ?? "", from: v?.from ?? null, heirs: [] });
      }
    }
  }
  const byKey = new Map(findings.filter((f) => !f.from).map((f) => [findingKey(f), f]));
  const out = [];
  for (const f of findings) {
    const origin = f.from ? byKey.get([f.from, f.attribute, f.locale, f.rule, f.term.toLowerCase()].join("|")) : null;
    if (origin) origin.heirs.push(f.node);
    else out.push(f);
  }
  return out;
}
const targetId = (f) => f.from ?? f.node.id;
function snippet(raw, term, around = 48) {
  const s = strip(raw);
  const i = term ? s.toLowerCase().indexOf(term.toLowerCase()) : -1;
  if (i < 0) return { before: s.length > around * 2 ? s.slice(0, around * 2) + "…" : s, term: "", after: "" };
  const a = Math.max(0, i - around), b = Math.min(s.length, i + term.length + around);
  return { before: (a > 0 ? "…" : "") + s.slice(a, i), term: s.slice(i, i + term.length), after: s.slice(i + term.length, b) + (b < s.length ? "…" : "") };
}
function replace(raw, ruleId, term, replacement) {
  const rule = catalog.rules.find((r2) => r2.id === ruleId);
  const r = rule ? rx(rule) : new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  return String(raw ?? "").replace(new RegExp(r.source, r.flags.replace("g", "") + "g"), (m2, base, ending) => typeof base === "string" ? replacement + (typeof ending === "string" ? ending : "") : replacement);
}
function byTerm(findings) {
  const groups = /* @__PURE__ */ new Map();
  for (const f of findings) {
    const base = f.base ?? f.term;
    const k = f.rule + "|" + base.toLowerCase();
    if (!groups.has(k)) groups.set(k, { key: k, rule: f.rule, severity: f.severity, term: base, findings: [] });
    groups.get(k).findings.push(f);
  }
  return [...groups.values()].sort((a, b) => b.findings.length - a.findings.length || a.term.localeCompare(b.term, "de"));
}
const ignoreName = (f) => `ignore:${f.node.id}:${f.attribute}:${f.locale}:${f.rule}:${hash(f.term.toLowerCase())}`;
const ignored = (f, map) => {
  const e = map?.[ignoreName(f)];
  return !!e && e.hash === textHash(f.raw);
};
function filter(findings, { rule = "", sev = [], text = "", showIgnored = false } = {}, ignoredMap = {}) {
  const q = text.trim().toLowerCase();
  return findings.filter((f) => (!rule || f.rule === rule) && (!sev.length || sev.includes(f.severity)) && (showIgnored || !ignored(f, ignoredMap)) && (!q || f.node.label.toLowerCase().includes(q) || f.attribute.toLowerCase().includes(q) || f.term.toLowerCase().includes(q)));
}
function countsByRule(findings) {
  const c = {};
  for (const f of findings) c[f.rule] = (c[f.rule] ?? 0) + 1;
  return c;
}
const memory = reactive({
  root: null,
  // der Teilbaum, für den das Ergebnis gilt
  result: null,
  // { findings, nodes } oder null
  ignoredMap: {},
  // Name in den Plugin-Daten → { term, reason, hash }
  rule: "",
  sev: [],
  text: "",
  showIgnored: false,
  mode: "list",
  // list | terms
  sel: null
  // Schlüssel des gewählten Befunds (list) oder der gewählten Begriffsgruppe (terms)
});
function forget() {
  Object.assign(memory, { result: null, rule: "", sev: [], text: "", showIgnored: false, sel: null });
}
const _export_sfc = (sfc, props) => {
  const target = sfc.__vccOpts || sfc;
  for (const [key, val] of props) {
    target[key] = val;
  }
  return target;
};
const _hoisted_1$2 = { class: "bench" };
const _hoisted_2$2 = { class: "pfad muted" };
const _hoisted_3$2 = { key: 0 };
const _hoisted_4$2 = { class: "knoten" };
const _hoisted_5$2 = { class: "muted" };
const _hoisted_6$2 = ["href", "title"];
const _hoisted_7$2 = { class: "muted feld" };
const _hoisted_8$2 = ["title"];
const _hoisted_9$2 = {
  key: 1,
  class: "erben muted"
};
const _hoisted_10$2 = { class: "muted" };
const _hoisted_11$2 = { class: "hint" };
const _hoisted_12$2 = { class: "wert" };
const _hoisted_13$2 = { key: 0 };
const _hoisted_14$2 = { class: "knoepfe" };
const _hoisted_15$2 = ["disabled", "title"];
const _hoisted_16$2 = ["disabled", "title"];
const _hoisted_17$1 = ["title"];
const _hoisted_18$1 = { class: "ausnahme" };
const _hoisted_19$1 = { class: "pos" };
const _hoisted_20$1 = {
  key: 0,
  class: "muted"
};
const _hoisted_21$1 = ["title"];
const _hoisted_22$1 = ["placeholder"];
const _hoisted_23$1 = ["title"];
const _hoisted_24$1 = {
  key: 2,
  class: "weitere"
};
const _hoisted_25$1 = { class: "muted" };
const _hoisted_26$1 = ["title", "onClick"];
const _sfc_main$2 = {
  __name: "Workbench",
  props: { finding: { type: Object, required: true }, ignoredMap: { type: Object, default: () => ({}) }, others: { type: Array, default: () => [] } },
  emits: ["save", "skip", "ignore", "unignore", "pick"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const ICON = { group: "▣", product: "▦", variant: "◆" };
    const value = ref(props.finding.raw ?? "");
    const reason = ref("");
    const area = ref(null);
    watch(() => findingKey(props.finding) + "|" + props.finding.raw, () => {
      value.value = props.finding.raw ?? "";
      reason.value = "";
    });
    watch(() => findingKey(props.finding), () => nextTick(() => area.value?.focus({ preventScroll: true })));
    const rule = computed(() => catalog.rules.find((r) => r.id === props.finding.rule));
    const origin = computed(() => tree.byId?.get(targetId(props.finding)) ?? props.finding.node);
    const path = computed(() => {
      const out = [];
      for (let n = tree.byId?.get(origin.value.id); n; n = n.parent ? tree.byId?.get(n.parent) : null) out.unshift(n);
      return out;
    });
    const attribute = computed(() => {
      const a = store.model?.attributes?.find((x) => x.key === props.finding.attribute);
      return a ? L(a.label) || a.key : props.finding.attribute;
    });
    const marked = computed(() => snippet(value.value, props.finding.term, 400));
    const changed = computed(() => value.value !== (props.finding.raw ?? ""));
    const isIgnored = computed(() => ignored(props.finding, props.ignoredMap));
    const entry2 = computed(() => props.ignoredMap?.[ignoreName(props.finding)]);
    function key(e) {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        emit("save", value.value);
      } else if (e.key === "Escape") {
        e.stopPropagation();
        e.target.blur();
      }
    }
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$2, [
        createElementVNode("div", _hoisted_2$2, [
          (openBlock(true), createElementBlock(
            Fragment,
            null,
            renderList(path.value, (n, i) => {
              return openBlock(), createElementBlock(
                Fragment,
                {
                  key: n.id
                },
                [
                  i ? (openBlock(), createElementBlock("span", _hoisted_3$2, "›")) : createCommentVNode("v-if", true),
                  createElementVNode(
                    "span",
                    null,
                    toDisplayString(n.label),
                    1
                    /* TEXT */
                  )
                ],
                64
                /* STABLE_FRAGMENT */
              );
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ]),
        createElementVNode("h3", _hoisted_4$2, [
          createElementVNode(
            "span",
            _hoisted_5$2,
            toDisplayString(ICON[origin.value.role]),
            1
            /* TEXT */
          ),
          createElementVNode("a", {
            href: "/tree/" + origin.value.id,
            target: "_blank",
            rel: "noopener",
            title: _ctx.$t("Knoten in einem neuen Tab öffnen — die Prüfung bleibt hier")
          }, toDisplayString(origin.value.label) + " ↗", 9, _hoisted_6$2),
          createElementVNode(
            "span",
            _hoisted_7$2,
            toDisplayString(attribute.value) + " · " + toDisplayString(__props.finding.locale),
            1
            /* TEXT */
          )
        ]),
        __props.finding.heirs.length ? (openBlock(), createElementBlock("div", {
          key: 0,
          class: "erben muted",
          title: __props.finding.heirs.map((h2) => h2.label).join(", ")
        }, [
          createTextVNode(
            toDisplayString(_ctx.$t("{0} Knoten erben den Wert", [__props.finding.heirs.length])) + ": " + toDisplayString(__props.finding.heirs.slice(0, 4).map((h2) => h2.label).join(", ")),
            1
            /* TEXT */
          ),
          __props.finding.heirs.length > 4 ? (openBlock(), createElementBlock(
            Fragment,
            { key: 0 },
            [
              createTextVNode(" …")
            ],
            64
            /* STABLE_FRAGMENT */
          )) : createCommentVNode("v-if", true)
        ], 8, _hoisted_8$2)) : __props.finding.from ? (openBlock(), createElementBlock(
          "div",
          _hoisted_9$2,
          toDisplayString(_ctx.$t("Der Wert kommt von {0} und wird dort geändert.", [origin.value.label])),
          1
          /* TEXT */
        )) : createCommentVNode("v-if", true),
        createElementVNode(
          "div",
          {
            class: normalizeClass(["regel", __props.finding.severity === "error" ? "neg" : __props.finding.severity === "warn" ? "warn" : "muted"])
          },
          [
            createElementVNode(
              "b",
              null,
              toDisplayString(rule.value?.label),
              1
              /* TEXT */
            ),
            _cache[8] || (_cache[8] = createTextVNode()),
            createElementVNode(
              "span",
              _hoisted_10$2,
              toDisplayString(rule.value?.ref),
              1
              /* TEXT */
            ),
            createElementVNode(
              "div",
              _hoisted_11$2,
              toDisplayString(rule.value?.hint),
              1
              /* TEXT */
            )
          ],
          2
          /* CLASS */
        ),
        createElementVNode("div", _hoisted_12$2, [
          createElementVNode(
            "span",
            null,
            toDisplayString(marked.value.before),
            1
            /* TEXT */
          ),
          marked.value.term ? (openBlock(), createElementBlock(
            "mark",
            _hoisted_13$2,
            toDisplayString(marked.value.term),
            1
            /* TEXT */
          )) : createCommentVNode("v-if", true),
          createElementVNode(
            "span",
            null,
            toDisplayString(marked.value.after),
            1
            /* TEXT */
          )
        ]),
        withDirectives(createElementVNode(
          "textarea",
          {
            ref_key: "area",
            ref: area,
            "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => value.value = $event),
            rows: "6",
            class: "cell-input feldtext",
            onKeydown: key
          },
          null,
          544
          /* NEED_HYDRATION, NEED_PATCH */
        ), [
          [vModelText, value.value]
        ]),
        createElementVNode("div", _hoisted_14$2, [
          createElementVNode("button", {
            type: "button",
            class: "primary",
            disabled: !changed.value,
            title: _ctx.$t("Speichern und zum nächsten Befund — Strg+Enter"),
            onClick: _cache[1] || (_cache[1] = ($event) => emit("save", value.value))
          }, toDisplayString(_ctx.$t("Speichern")) + " ⏎", 9, _hoisted_15$2),
          createElementVNode("button", {
            type: "button",
            disabled: !changed.value,
            title: _ctx.$t("Änderung verwerfen"),
            onClick: _cache[2] || (_cache[2] = ($event) => value.value = __props.finding.raw ?? "")
          }, toDisplayString(_ctx.$t("Zurücksetzen")), 9, _hoisted_16$2),
          createElementVNode("button", {
            type: "button",
            title: _ctx.$t("Zum nächsten Befund, ohne etwas zu ändern — Pfeil nach unten"),
            onClick: _cache[3] || (_cache[3] = ($event) => emit("skip"))
          }, toDisplayString(_ctx.$t("Überspringen")) + " ↓", 9, _hoisted_17$1)
        ]),
        createElementVNode("div", _hoisted_18$1, [
          isIgnored.value ? (openBlock(), createElementBlock(
            Fragment,
            { key: 0 },
            [
              createElementVNode(
                "span",
                _hoisted_19$1,
                toDisplayString(_ctx.$t("Ausnahme")),
                1
                /* TEXT */
              ),
              entry2.value?.reason ? (openBlock(), createElementBlock(
                "span",
                _hoisted_20$1,
                " · " + toDisplayString(entry2.value.reason),
                1
                /* TEXT */
              )) : createCommentVNode("v-if", true),
              createElementVNode("button", {
                type: "button",
                class: "x",
                title: _ctx.$t("Der Befund gilt wieder"),
                onClick: _cache[4] || (_cache[4] = ($event) => emit("unignore"))
              }, toDisplayString(_ctx.$t("aufheben")), 9, _hoisted_21$1)
            ],
            64
            /* STABLE_FRAGMENT */
          )) : (openBlock(), createElementBlock(
            Fragment,
            { key: 1 },
            [
              withDirectives(createElementVNode("input", {
                "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => reason.value = $event),
                class: "grund",
                placeholder: _ctx.$t("Begründung (optional)"),
                onKeydown: _cache[6] || (_cache[6] = withKeys(withModifiers(($event) => emit("ignore", reason.value), ["prevent"]), ["enter"]))
              }, null, 40, _hoisted_22$1), [
                [vModelText, reason.value]
              ]),
              createElementVNode("button", {
                type: "button",
                title: _ctx.$t("Kein Fehlalarm: der Befund bleibt aus der Liste, solange der Text so bleibt"),
                onClick: _cache[7] || (_cache[7] = ($event) => emit("ignore", reason.value))
              }, toDisplayString(_ctx.$t("Ausnahme")), 9, _hoisted_23$1)
            ],
            64
            /* STABLE_FRAGMENT */
          ))
        ]),
        __props.others.length ? (openBlock(), createElementBlock("div", _hoisted_24$1, [
          createElementVNode(
            "span",
            _hoisted_25$1,
            toDisplayString(_ctx.$t("Weitere Befunde im Feld")),
            1
            /* TEXT */
          ),
          (openBlock(true), createElementBlock(
            Fragment,
            null,
            renderList(__props.others, (o) => {
              return openBlock(), createElementBlock("button", {
                key: unref(findingKey)(o),
                type: "button",
                class: "chip",
                title: o.message,
                onClick: ($event) => emit("pick", o)
              }, toDisplayString(o.term), 9, _hoisted_26$1);
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ])) : createCommentVNode("v-if", true)
      ]);
    };
  }
};
const Workbench = /* @__PURE__ */ _export_sfc(_sfc_main$2, [["__scopeId", "data-v-15658930"]]);
const _hoisted_1$1 = { class: "term" };
const _hoisted_2$1 = { class: "muted" };
const _hoisted_3$1 = { class: "regel muted" };
const _hoisted_4$1 = { class: "ersatz" };
const _hoisted_5$1 = ["placeholder"];
const _hoisted_6$1 = ["disabled", "title"];
const _hoisted_7$1 = { class: "grid vorschau" };
const _hoisted_8$1 = { style: { "width": "26px" } };
const _hoisted_9$1 = ["title"];
const _hoisted_10$1 = ["checked", "onChange"];
const _hoisted_11$1 = ["title"];
const _hoisted_12$1 = { class: "muted feld" };
const _hoisted_13$1 = { class: "snip" };
const _hoisted_14$1 = { class: "snip" };
const _hoisted_15$1 = { class: "neu" };
const _hoisted_16$1 = {
  key: 1,
  class: "muted"
};
const _sfc_main$1 = {
  __name: "TermPanel",
  props: { group: { type: Object, required: true } },
  emits: ["apply"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const replacement = ref("");
    const picked = ref(new Set(props.group.findings.map(findingKey)));
    watch(() => props.group.key, () => {
      replacement.value = "";
      picked.value = new Set(props.group.findings.map(findingKey));
    });
    watch(() => props.group.findings.length, () => {
      const have = new Set(props.group.findings.map(findingKey));
      picked.value = new Set([...picked.value].filter((k) => have.has(k)));
    });
    const rule = computed(() => catalog.rules.find((r) => r.id === props.group.rule));
    const attribute = (key) => {
      const a = store.model?.attributes?.find((x) => x.key === key);
      return a ? L(a.label) || a.key : key;
    };
    const rows = computed(() => props.group.findings.map((f) => {
      const after = replace(f.raw, f.rule, f.term, replacement.value);
      return { f, key: findingKey(f), before: snippet(f.raw, f.term, 36), after: snippet(after, replacement.value, 36), changed: after !== f.raw };
    }));
    const chosen = computed(() => rows.value.filter((r) => picked.value.has(r.key) && r.changed));
    const toggle = (r) => {
      const s = new Set(picked.value);
      s.has(r.key) ? s.delete(r.key) : s.add(r.key);
      picked.value = s;
    };
    const all = computed({ get: () => picked.value.size === rows.value.length, set: (v) => {
      picked.value = v ? new Set(rows.value.map((r) => r.key)) : /* @__PURE__ */ new Set();
    } });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$1, [
        createElementVNode("h3", null, [
          createElementVNode(
            "mark",
            null,
            toDisplayString(__props.group.term),
            1
            /* TEXT */
          ),
          _cache[4] || (_cache[4] = createTextVNode()),
          createElementVNode(
            "span",
            _hoisted_2$1,
            "· " + toDisplayString(_ctx.$t("{0} Felder", [__props.group.findings.length])),
            1
            /* TEXT */
          )
        ]),
        createElementVNode("div", _hoisted_3$1, [
          createElementVNode(
            "b",
            null,
            toDisplayString(rule.value?.label),
            1
            /* TEXT */
          ),
          createTextVNode(
            " — " + toDisplayString(rule.value?.hint),
            1
            /* TEXT */
          )
        ]),
        createElementVNode("div", _hoisted_4$1, [
          withDirectives(createElementVNode("input", {
            "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => replacement.value = $event),
            placeholder: _ctx.$t("Ersatztext für „{0}“", [__props.group.term]),
            onKeydown: _cache[1] || (_cache[1] = withKeys(withModifiers(($event) => chosen.value.length && replacement.value.trim() && emit("apply", chosen.value.map((r) => ({ f: r.f, value: unref(replace)(r.f.raw, r.f.rule, r.f.term, replacement.value) })), replacement.value), ["prevent"]), ["enter"]))
          }, null, 40, _hoisted_5$1), [
            [vModelText, replacement.value]
          ]),
          createElementVNode("button", {
            type: "button",
            class: "primary",
            disabled: !chosen.value.length || !replacement.value.trim(),
            title: _ctx.$t("Den Begriff in den angehakten Feldern ersetzen — ein Stapel, im Journal rückgängig zu machen"),
            onClick: _cache[2] || (_cache[2] = ($event) => emit("apply", chosen.value.map((r) => ({ f: r.f, value: unref(replace)(r.f.raw, r.f.rule, r.f.term, replacement.value) })), replacement.value))
          }, toDisplayString(_ctx.$t("In {0} Feldern ersetzen", [chosen.value.length])), 9, _hoisted_6$1)
        ]),
        createElementVNode("table", _hoisted_7$1, [
          createElementVNode("thead", null, [
            createElementVNode("tr", null, [
              createElementVNode("th", _hoisted_8$1, [
                withDirectives(createElementVNode("input", {
                  "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => all.value = $event),
                  type: "checkbox",
                  title: _ctx.$t("alle")
                }, null, 8, _hoisted_9$1), [
                  [vModelCheckbox, all.value]
                ])
              ]),
              createElementVNode(
                "th",
                null,
                toDisplayString(_ctx.$t("Knoten")),
                1
                /* TEXT */
              ),
              createElementVNode(
                "th",
                null,
                toDisplayString(_ctx.$t("Vorher")),
                1
                /* TEXT */
              ),
              createElementVNode(
                "th",
                null,
                toDisplayString(_ctx.$t("Nachher")),
                1
                /* TEXT */
              )
            ])
          ]),
          createElementVNode("tbody", null, [
            (openBlock(true), createElementBlock(
              Fragment,
              null,
              renderList(rows.value, (r) => {
                return openBlock(), createElementBlock(
                  "tr",
                  {
                    key: r.key,
                    class: normalizeClass({ aus: !picked.value.has(r.key) })
                  },
                  [
                    createElementVNode("td", null, [
                      createElementVNode("input", {
                        type: "checkbox",
                        checked: picked.value.has(r.key),
                        onChange: ($event) => toggle(r)
                      }, null, 40, _hoisted_10$1)
                    ]),
                    createElementVNode("td", null, [
                      createTextVNode(
                        toDisplayString(r.f.node.label),
                        1
                        /* TEXT */
                      ),
                      r.f.heirs.length ? (openBlock(), createElementBlock("span", {
                        key: 0,
                        class: "muted",
                        title: r.f.heirs.map((h2) => h2.label).join(", ")
                      }, " +" + toDisplayString(r.f.heirs.length), 9, _hoisted_11$1)) : createCommentVNode("v-if", true),
                      createElementVNode(
                        "div",
                        _hoisted_12$1,
                        toDisplayString(attribute(r.f.attribute)) + " · " + toDisplayString(r.f.locale),
                        1
                        /* TEXT */
                      )
                    ]),
                    createElementVNode("td", _hoisted_13$1, [
                      createElementVNode(
                        "span",
                        null,
                        toDisplayString(r.before.before),
                        1
                        /* TEXT */
                      ),
                      createElementVNode(
                        "mark",
                        null,
                        toDisplayString(r.before.term),
                        1
                        /* TEXT */
                      ),
                      createElementVNode(
                        "span",
                        null,
                        toDisplayString(r.before.after),
                        1
                        /* TEXT */
                      )
                    ]),
                    createElementVNode("td", _hoisted_14$1, [
                      replacement.value.trim() ? (openBlock(), createElementBlock(
                        Fragment,
                        { key: 0 },
                        [
                          createElementVNode(
                            "span",
                            null,
                            toDisplayString(r.after.before),
                            1
                            /* TEXT */
                          ),
                          createElementVNode(
                            "mark",
                            _hoisted_15$1,
                            toDisplayString(r.after.term),
                            1
                            /* TEXT */
                          ),
                          createElementVNode(
                            "span",
                            null,
                            toDisplayString(r.after.after),
                            1
                            /* TEXT */
                          )
                        ],
                        64
                        /* STABLE_FRAGMENT */
                      )) : (openBlock(), createElementBlock("span", _hoisted_16$1, "—"))
                    ])
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
      ]);
    };
  }
};
const TermPanel = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["__scopeId", "data-v-bf2351b5"]]);
const _hoisted_1 = {
  class: "pane empco",
  style: { "flex": "1" }
};
const _hoisted_2 = { class: "toolbar" };
const _hoisted_3 = { class: "wurzel" };
const _hoisted_4 = ["title"];
const _hoisted_5 = {
  key: 0,
  class: "picker"
};
const _hoisted_6 = ["disabled"];
const _hoisted_7 = ["title"];
const _hoisted_8 = { class: "katalog" };
const _hoisted_9 = { class: "muted" };
const _hoisted_10 = { class: "quellen muted" };
const _hoisted_11 = ["href"];
const _hoisted_12 = { class: "grid" };
const _hoisted_13 = { style: { "width": "260px" } };
const _hoisted_14 = { style: { "width": "220px" } };
const _hoisted_15 = { class: "muted klein" };
const _hoisted_16 = { class: "muted" };
const _hoisted_17 = { class: "muted klein" };
const _hoisted_18 = { class: "leiste" };
const _hoisted_19 = ["title", "onClick"];
const _hoisted_20 = ["title", "onClick"];
const _hoisted_21 = ["placeholder"];
const _hoisted_22 = ["title"];
const _hoisted_23 = ["title"];
const _hoisted_24 = {
  key: 0,
  class: "muted"
};
const _hoisted_25 = {
  key: 0,
  class: "empty pos"
};
const _hoisted_26 = {
  key: 1,
  class: "arbeit"
};
const _hoisted_27 = { class: "grid" };
const _hoisted_28 = ["onClick"];
const _hoisted_29 = { class: "kn" };
const _hoisted_30 = { class: "muted" };
const _hoisted_31 = ["title"];
const _hoisted_32 = { class: "muted klein feld" };
const _hoisted_33 = { class: "snip" };
const _hoisted_34 = ["onClick"];
const _hoisted_35 = { class: "muted klein" };
const _hoisted_36 = {
  class: "muted",
  style: { "text-align": "right" }
};
const _hoisted_37 = {
  key: 0,
  class: "muted klein hinweis"
};
const _hoisted_38 = { class: "flaeche scroll" };
const _hoisted_39 = {
  key: 2,
  class: "empty muted"
};
const _hoisted_40 = {
  key: 1,
  class: "empty muted"
};
const LIMIT = 1e3;
const _sfc_main = {
  __name: "View",
  setup(__props) {
    const ICON = { group: "▣", product: "▦", variant: "◆" };
    const SEV = { error: "✗", warn: "⚠", info: "ℹ" };
    const SEV_CLASS = (s) => s === "error" ? "neg" : s === "warn" ? "warn" : "muted";
    const root = ref(localStorage.getItem("journali.empco.root") || tree.rows?.find((r) => !r.parent)?.id || null);
    const pickOpen = ref(false);
    const busy = ref(false);
    const status = ref("");
    const listEl = ref(null);
    const rootLabel = computed(() => root.value ? `${ICON[tree.byId?.get(root.value)?.role] ?? ""} ${tree.byId?.get(root.value)?.label ?? ""}`.trim() : "");
    const findings = computed(() => memory.result?.findings ?? []);
    const visible = computed(() => filter(findings.value, memory, memory.ignoredMap));
    const rows = computed(() => visible.value.slice(0, LIMIT));
    const terms = computed(() => byTerm(visible.value));
    const ruleCounts = computed(() => countsByRule(filter(findings.value, { sev: memory.sev, text: memory.text, showIgnored: memory.showIgnored }, memory.ignoredMap)));
    const sevCounts = computed(() => {
      const c = { error: 0, warn: 0, info: 0 };
      for (const f of filter(findings.value, { rule: memory.rule, text: memory.text, showIgnored: memory.showIgnored }, memory.ignoredMap)) c[f.severity]++;
      return c;
    });
    const ignoredCount = computed(() => findings.value.filter((f) => ignored(f, memory.ignoredMap)).length);
    const current = computed(() => memory.mode === "list" ? visible.value.find((f) => findingKey(f) === memory.sel) ?? null : null);
    const currentTerm = computed(() => memory.mode === "terms" ? terms.value.find((g) => g.key === memory.sel) ?? null : null);
    const others = computed(() => current.value ? findings.value.filter((f) => findingKey(f) !== findingKey(current.value) && targetId(f) === targetId(current.value) && f.attribute === current.value.attribute && f.locale === current.value.locale) : []);
    const attributeLabel = (key) => {
      const a = store.model?.attributes?.find((x) => x.key === key);
      return a ? L(a.label) || a.key : key;
    };
    onMounted(() => {
      if (memory.root !== root.value) forget();
      window.addEventListener("keydown", keys);
    });
    onBeforeUnmount(() => window.removeEventListener("keydown", keys));
    function pick(id) {
      root.value = id;
      localStorage.setItem("journali.empco.root", id);
      pickOpen.value = false;
      forget();
      memory.root = null;
      status.value = "";
    }
    async function run() {
      if (!root.value || busy.value) return;
      busy.value = true;
      try {
        const locales = store.model.locales.map((l) => l.code);
        status.value = t("lese {0} Sprachen …", [locales.length]);
        const tables = await Promise.all(locales.map((l) => api.get(`/api/nodes/${encodeURIComponent(root.value)}/table?deep=true&locale=${l}`)));
        const list = collect(tables, locales);
        memory.ignoredMap = await api.get("/api/plugins/empco/data?prefix=ignore%3A&values=true").catch(() => ({})) ?? {};
        memory.root = root.value;
        memory.result = { findings: list, nodes: tables[0]?.rows.length ?? 0 };
        memory.sel = null;
        status.value = "";
        await nextTick();
        selectFirst();
      } catch (e) {
        status.value = "✗ " + e.message;
      } finally {
        busy.value = false;
      }
    }
    const order = computed(() => memory.mode === "list" ? rows.value.map(findingKey) : terms.value.map((g) => g.key));
    function selectFirst() {
      if (memory.sel === null || !order.value.includes(memory.sel)) memory.sel = order.value[0] ?? null;
    }
    function move(d) {
      const i = order.value.indexOf(memory.sel);
      const next = order.value[Math.min(order.value.length - 1, Math.max(0, i + d))];
      if (next !== void 0) {
        memory.sel = next;
        nextTick(() => listEl.value?.querySelector("tr.cur")?.scrollIntoView?.({ block: "nearest" }));
      }
    }
    function keys(e) {
      if (!memory.result || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName ?? "")) return;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        move(1);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        move(-1);
      }
    }
    function mode(m2) {
      memory.mode = m2;
      memory.sel = null;
      nextTick(selectFirst);
    }
    const toggleSev = (s) => {
      memory.sev = memory.sev.includes(s) ? memory.sev.filter((x) => x !== s) : [...memory.sev, s];
      nextTick(selectFirst);
    };
    const setRule = (id) => {
      memory.rule = memory.rule === id ? "" : id;
      nextTick(selectFirst);
    };
    function refresh(f, value) {
      const def = store.model.attributes.find((a) => a.key === f.attribute);
      const perLocale = !!def?.perLocale;
      const same = (y) => targetId(y) === targetId(f) && y.attribute === f.attribute && (!perLocale || y.locale === f.locale);
      const old = memory.result.findings.filter(same);
      const next = memory.result.findings.filter((y) => !same(y));
      const done = /* @__PURE__ */ new Set();
      for (const y of old) {
        if (done.has(y.locale)) continue;
        done.add(y.locale);
        for (const c of checks) for (const g of c.run({ values: { [y.attribute]: { value } }, columns: [{ key: y.attribute, type: y.type }] })) next.push({ ...y, ...g, rule: c.key, severity: c.severity, raw: value });
      }
      memory.result = { ...memory.result, findings: next };
    }
    async function writeValue(f, value) {
      const def = store.model.attributes.find((a) => a.key === f.attribute);
      await api.post(`/api/nodes/${encodeURIComponent(targetId(f))}/attributes`, { attribute: f.attribute, locale: def?.perLocale ? f.locale : null, channel: null, value, row: null });
    }
    async function save(value) {
      const f = current.value;
      if (!f) return;
      const i = order.value.indexOf(memory.sel);
      try {
        await writeValue(f, value);
      } catch (e) {
        store.toast(e.message);
        return;
      }
      refresh(f, value);
      store.toast(t("✓ gespeichert"), "ok");
      store.poll(true);
      await nextTick();
      const still = order.value.indexOf(memory.sel);
      memory.sel = order.value[still >= 0 ? Math.min(still + 1, order.value.length - 1) : Math.min(i, order.value.length - 1)] ?? null;
    }
    async function setIgnore(reason) {
      const f = current.value;
      if (!f) return;
      const name = ignoreName(f), entry2 = { term: f.term, reason: (reason ?? "").trim(), hash: textHash(f.raw) };
      try {
        await api.post(`/api/plugins/empco/data/${encodeURIComponent(name)}`, entry2, "PUT");
      } catch (e) {
        store.toast(e.message);
        return;
      }
      memory.ignoredMap = { ...memory.ignoredMap, [name]: entry2 };
      store.toast(t("Als Ausnahme gemerkt"), "ok");
      await nextTick();
      selectFirst();
      if (!order.value.includes(memory.sel)) memory.sel = order.value[0] ?? null;
    }
    async function unIgnore() {
      const f = current.value;
      if (!f) return;
      const name = ignoreName(f);
      try {
        await api.del(`/api/plugins/empco/data/${encodeURIComponent(name)}`);
      } catch (e) {
        store.toast(e.message);
        return;
      }
      const { [name]: _, ...rest } = memory.ignoredMap;
      memory.ignoredMap = rest;
    }
    async function apply(items, replacement) {
      const g = currentTerm.value;
      if (!g || !items.length) return;
      const ok = await dialog.confirm({
        title: t("„{0}“ in {1} Feldern ersetzen?", [g.term, items.length]),
        warn: t("{0} Attributwerte als ein Stapel ins Journal — als Ganzes rückgängig zu machen", [items.length]),
        list: items.slice(0, 8).map((i) => `${i.f.node.label} · ${attributeLabel(i.f.attribute)} → ${snippet(i.value, replacement, 24).before.slice(-24)}${replacement}`),
        ok: t("Ersetzen")
      });
      if (!ok) return;
      const cmds = items.map(({ f, value }) => {
        const def = store.model.attributes.find((a) => a.key === f.attribute);
        return { op: "attribute.set", args: { node: targetId(f), attribute: f.attribute, locale: def?.perLocale ? f.locale : null, value } };
      });
      try {
        const res = await api.batchChunked(cmds, { label: t("EmpCo: „{0}“ ersetzen", [g.term]) });
        if (res.error) throw new Error(res.error.message);
        for (const { f, value } of items) refresh(f, value);
        store.toast(t("✓ {0} Werte geschrieben", [res.results.length]), "ok");
        store.poll(true);
        await nextTick();
        if (!order.value.includes(memory.sel)) memory.sel = order.value[0] ?? null;
      } catch (e) {
        store.toast(e.message);
      }
    }
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createElementVNode("div", _hoisted_2, [
          createElementVNode(
            "h1",
            null,
            toDisplayString(unref(catalog).icon) + " " + toDisplayString(unref(catalog).label),
            1
            /* TEXT */
          ),
          createElementVNode("span", _hoisted_3, [
            createElementVNode("button", {
              type: "button",
              class: "knoten",
              title: _ctx.$t("Teilbaum, dessen Texte geprüft werden"),
              onClick: _cache[0] || (_cache[0] = ($event) => pickOpen.value = !pickOpen.value)
            }, toDisplayString(rootLabel.value || _ctx.$t("Teilbaum wählen")), 9, _hoisted_4),
            pickOpen.value ? (openBlock(), createElementBlock("div", _hoisted_5, [
              createVNode(unref(TreePicker), {
                "model-value": root.value,
                roles: ["group", "product"],
                height: 300,
                onPick: _cache[1] || (_cache[1] = (r) => pick(r.id))
              }, null, 8, ["model-value"])
            ])) : createCommentVNode("v-if", true)
          ]),
          createElementVNode("button", {
            type: "button",
            class: "primary",
            disabled: busy.value || !root.value,
            onClick: run
          }, toDisplayString(_ctx.$t("▶ prüfen")), 9, _hoisted_6),
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
              class: normalizeClass(status.value.startsWith("✗") ? "neg" : "muted")
            },
            toDisplayString(status.value),
            3
            /* TEXT, CLASS */
          ),
          unref(memory).result ? (openBlock(), createElementBlock("span", {
            key: 0,
            class: "muted",
            title: _ctx.$t("Befunde in geprüften Knoten")
          }, toDisplayString(_ctx.$t("{0} Befunde in {1} Knoten", [findings.value.length, unref(memory).result.nodes])), 9, _hoisted_7)) : createCommentVNode("v-if", true)
        ]),
        createElementVNode("details", _hoisted_8, [
          createElementVNode(
            "summary",
            _hoisted_9,
            toDisplayString(unref(catalog).icon) + " " + toDisplayString(_ctx.$t("Kriterienkatalog")) + " · " + toDisplayString(_ctx.$t("{0} Regeln", [unref(catalog).rules.length])) + " · " + toDisplayString(_ctx.$t("heuristisch, keine Rechtsberatung")),
            1
            /* TEXT */
          ),
          createElementVNode("div", _hoisted_10, [
            createTextVNode(
              toDisplayString(_ctx.$t("Quellen:")) + " ",
              1
              /* TEXT */
            ),
            (openBlock(true), createElementBlock(
              Fragment,
              null,
              renderList(unref(catalog).sources, (s) => {
                return openBlock(), createElementBlock("a", {
                  key: s.url,
                  href: s.url,
                  target: "_blank",
                  rel: "noopener"
                }, toDisplayString(s.label), 9, _hoisted_11);
              }),
              128
              /* KEYED_FRAGMENT */
            ))
          ]),
          createElementVNode("table", _hoisted_12, [
            createElementVNode("thead", null, [
              createElementVNode("tr", null, [
                _cache[9] || (_cache[9] = createElementVNode(
                  "th",
                  { style: { "width": "30px" } },
                  null,
                  -1
                  /* CACHED */
                )),
                createElementVNode(
                  "th",
                  _hoisted_13,
                  toDisplayString(_ctx.$t("Regel")),
                  1
                  /* TEXT */
                ),
                createElementVNode(
                  "th",
                  null,
                  toDisplayString(_ctx.$t("Was zu tun ist")),
                  1
                  /* TEXT */
                ),
                createElementVNode(
                  "th",
                  _hoisted_14,
                  toDisplayString(_ctx.$t("Anker")),
                  1
                  /* TEXT */
                )
              ])
            ]),
            createElementVNode("tbody", null, [
              (openBlock(true), createElementBlock(
                Fragment,
                null,
                renderList(unref(catalog).rules, (r) => {
                  return openBlock(), createElementBlock("tr", {
                    key: r.id
                  }, [
                    createElementVNode(
                      "td",
                      {
                        class: normalizeClass(SEV_CLASS(r.severity))
                      },
                      toDisplayString(SEV[r.severity]),
                      3
                      /* TEXT, CLASS */
                    ),
                    createElementVNode("td", null, [
                      createTextVNode(
                        toDisplayString(r.label),
                        1
                        /* TEXT */
                      ),
                      createElementVNode("div", _hoisted_15, [
                        createTextVNode(
                          toDisplayString((r.terms ?? []).slice(0, 8).join(", ")),
                          1
                          /* TEXT */
                        ),
                        (r.terms ?? []).length > 8 ? (openBlock(), createElementBlock(
                          Fragment,
                          { key: 0 },
                          [
                            createTextVNode(" …")
                          ],
                          64
                          /* STABLE_FRAGMENT */
                        )) : createCommentVNode("v-if", true)
                      ])
                    ]),
                    createElementVNode(
                      "td",
                      _hoisted_16,
                      toDisplayString(r.hint),
                      1
                      /* TEXT */
                    ),
                    createElementVNode(
                      "td",
                      _hoisted_17,
                      toDisplayString(r.ref),
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
        ]),
        unref(memory).result ? (openBlock(), createElementBlock(
          Fragment,
          { key: 0 },
          [
            createElementVNode("div", _hoisted_18, [
              (openBlock(true), createElementBlock(
                Fragment,
                null,
                renderList(unref(catalog).rules, (r) => {
                  return withDirectives((openBlock(), createElementBlock("button", {
                    key: r.id,
                    type: "button",
                    class: normalizeClass(["chip", { on: unref(memory).rule === r.id }]),
                    title: r.hint + " — " + r.ref,
                    onClick: ($event) => setRule(r.id)
                  }, [
                    createElementVNode(
                      "span",
                      {
                        class: normalizeClass(SEV_CLASS(r.severity))
                      },
                      toDisplayString(SEV[r.severity]),
                      3
                      /* TEXT, CLASS */
                    ),
                    createTextVNode(
                      " " + toDisplayString(r.label) + " · " + toDisplayString(ruleCounts.value[r.id] ?? 0),
                      1
                      /* TEXT */
                    )
                  ], 10, _hoisted_19)), [
                    [vShow, ruleCounts.value[r.id] || unref(memory).rule === r.id]
                  ]);
                }),
                128
                /* KEYED_FRAGMENT */
              )),
              _cache[10] || (_cache[10] = createElementVNode(
                "span",
                { class: "grow" },
                null,
                -1
                /* CACHED */
              )),
              (openBlock(), createElementBlock(
                Fragment,
                null,
                renderList(["error", "warn", "info"], (s) => {
                  return createElementVNode("button", {
                    key: s,
                    type: "button",
                    class: normalizeClass(["chip sev", [{ on: unref(memory).sev.includes(s) }, SEV_CLASS(s)]]),
                    title: _ctx.$t("Nur diese Schwere"),
                    onClick: ($event) => toggleSev(s)
                  }, toDisplayString(SEV[s]) + " " + toDisplayString(sevCounts.value[s]), 11, _hoisted_20);
                }),
                64
                /* STABLE_FRAGMENT */
              )),
              withDirectives(createElementVNode("input", {
                "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => unref(memory).text = $event),
                class: "suche",
                placeholder: _ctx.$t("Knoten, Feld, Begriff")
              }, null, 8, _hoisted_21), [
                [vModelText, unref(memory).text]
              ]),
              createElementVNode("button", {
                type: "button",
                class: normalizeClass(["chip", { on: unref(memory).mode === "list" }]),
                title: _ctx.$t("Jeder Befund einzeln"),
                onClick: _cache[3] || (_cache[3] = ($event) => mode("list"))
              }, toDisplayString(_ctx.$t("Liste")), 11, _hoisted_22),
              createElementVNode("button", {
                type: "button",
                class: normalizeClass(["chip", { on: unref(memory).mode === "terms" }]),
                title: _ctx.$t("Gleiche Begriffe zusammen — ersetzen in vielen Feldern"),
                onClick: _cache[4] || (_cache[4] = ($event) => mode("terms"))
              }, toDisplayString(_ctx.$t("Begriffe")), 11, _hoisted_23),
              ignoredCount.value ? (openBlock(), createElementBlock("label", _hoisted_24, [
                withDirectives(createElementVNode(
                  "input",
                  {
                    "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => unref(memory).showIgnored = $event),
                    type: "checkbox"
                  },
                  null,
                  512
                  /* NEED_PATCH */
                ), [
                  [vModelCheckbox, unref(memory).showIgnored]
                ]),
                createTextVNode(
                  " " + toDisplayString(_ctx.$t("Ausnahmen ({0})", [ignoredCount.value])),
                  1
                  /* TEXT */
                )
              ])) : createCommentVNode("v-if", true)
            ]),
            !visible.value.length ? (openBlock(), createElementBlock(
              "div",
              _hoisted_25,
              toDisplayString(findings.value.length ? _ctx.$t("Kein Befund passt zum Filter") : _ctx.$t("✓ keine Befunde in {0} Knoten", [unref(memory).result.nodes])),
              1
              /* TEXT */
            )) : (openBlock(), createElementBlock("div", _hoisted_26, [
              createElementVNode(
                "div",
                {
                  ref_key: "listEl",
                  ref: listEl,
                  class: "liste scroll"
                },
                [
                  createElementVNode("table", _hoisted_27, [
                    createElementVNode("tbody", null, [
                      unref(memory).mode === "list" ? (openBlock(true), createElementBlock(
                        Fragment,
                        { key: 0 },
                        renderList(rows.value, (f) => {
                          return openBlock(), createElementBlock("tr", {
                            key: unref(findingKey)(f),
                            class: normalizeClass({ cur: unref(findingKey)(f) === unref(memory).sel, aus: unref(ignored)(f, unref(memory).ignoredMap) }),
                            onClick: ($event) => unref(memory).sel = unref(findingKey)(f)
                          }, [
                            createElementVNode(
                              "td",
                              {
                                class: normalizeClass(SEV_CLASS(f.severity)),
                                style: { "width": "22px" }
                              },
                              toDisplayString(SEV[f.severity]),
                              3
                              /* TEXT, CLASS */
                            ),
                            createElementVNode("td", _hoisted_29, [
                              createElementVNode(
                                "span",
                                _hoisted_30,
                                toDisplayString(ICON[f.node.role]),
                                1
                                /* TEXT */
                              ),
                              createTextVNode(
                                " " + toDisplayString(f.node.label),
                                1
                                /* TEXT */
                              ),
                              f.heirs.length ? (openBlock(), createElementBlock("span", {
                                key: 0,
                                class: "muted",
                                title: f.heirs.map((h2) => h2.label).join(", ")
                              }, " +" + toDisplayString(f.heirs.length), 9, _hoisted_31)) : createCommentVNode("v-if", true)
                            ]),
                            createElementVNode(
                              "td",
                              _hoisted_32,
                              toDisplayString(attributeLabel(f.attribute)) + " · " + toDisplayString(f.locale),
                              1
                              /* TEXT */
                            ),
                            createElementVNode("td", _hoisted_33, [
                              createElementVNode(
                                "span",
                                null,
                                toDisplayString(unref(snippet)(f.raw, f.term, 36).before),
                                1
                                /* TEXT */
                              ),
                              createElementVNode(
                                "mark",
                                null,
                                toDisplayString(unref(snippet)(f.raw, f.term, 36).term),
                                1
                                /* TEXT */
                              ),
                              createElementVNode(
                                "span",
                                null,
                                toDisplayString(unref(snippet)(f.raw, f.term, 36).after),
                                1
                                /* TEXT */
                              )
                            ])
                          ], 10, _hoisted_28);
                        }),
                        128
                        /* KEYED_FRAGMENT */
                      )) : (openBlock(true), createElementBlock(
                        Fragment,
                        { key: 1 },
                        renderList(terms.value, (g) => {
                          return openBlock(), createElementBlock("tr", {
                            key: g.key,
                            class: normalizeClass({ cur: g.key === unref(memory).sel }),
                            onClick: ($event) => unref(memory).sel = g.key
                          }, [
                            createElementVNode(
                              "td",
                              {
                                class: normalizeClass(SEV_CLASS(g.severity)),
                                style: { "width": "22px" }
                              },
                              toDisplayString(SEV[g.severity]),
                              3
                              /* TEXT, CLASS */
                            ),
                            createElementVNode("td", null, [
                              createElementVNode(
                                "mark",
                                null,
                                toDisplayString(g.term),
                                1
                                /* TEXT */
                              )
                            ]),
                            createElementVNode(
                              "td",
                              _hoisted_35,
                              toDisplayString(unref(catalog).rules.find((r) => r.id === g.rule)?.label),
                              1
                              /* TEXT */
                            ),
                            createElementVNode(
                              "td",
                              _hoisted_36,
                              toDisplayString(g.findings.length),
                              1
                              /* TEXT */
                            )
                          ], 10, _hoisted_34);
                        }),
                        128
                        /* KEYED_FRAGMENT */
                      ))
                    ])
                  ]),
                  unref(memory).mode === "list" && visible.value.length > LIMIT ? (openBlock(), createElementBlock(
                    "div",
                    _hoisted_37,
                    toDisplayString(_ctx.$t("{0} von {1} Befunden — der Filter grenzt ein", [LIMIT, visible.value.length])),
                    1
                    /* TEXT */
                  )) : createCommentVNode("v-if", true)
                ],
                512
                /* NEED_PATCH */
              ),
              createElementVNode("div", _hoisted_38, [
                current.value ? (openBlock(), createBlock(Workbench, {
                  key: 0,
                  finding: current.value,
                  "ignored-map": unref(memory).ignoredMap,
                  others: others.value,
                  onSave: save,
                  onSkip: _cache[6] || (_cache[6] = ($event) => move(1)),
                  onIgnore: setIgnore,
                  onUnignore: unIgnore,
                  onPick: _cache[7] || (_cache[7] = (o) => unref(memory).sel = unref(findingKey)(o))
                }, null, 8, ["finding", "ignored-map", "others"])) : currentTerm.value ? (openBlock(), createBlock(TermPanel, {
                  key: 1,
                  group: currentTerm.value,
                  onApply: apply
                }, null, 8, ["group"])) : (openBlock(), createElementBlock(
                  "div",
                  _hoisted_39,
                  toDisplayString(_ctx.$t("Einen Befund wählen — Pfeil nach oben und unten wechselt, Strg+Enter speichert")),
                  1
                  /* TEXT */
                ))
              ])
            ]))
          ],
          64
          /* STABLE_FRAGMENT */
        )) : (openBlock(), createElementBlock(
          "div",
          _hoisted_40,
          toDisplayString(_ctx.$t("Teilbaum wählen und prüfen — dieselben Regeln laufen auch in ✓ Datenqualität mit allen anderen.")),
          1
          /* TEXT */
        ))
      ]);
    };
  }
};
const View = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-f153f32f"]]);
const entry = {
  views: [{ path: "check", label: catalog.label, icon: catalog.icon, topic: "analysis", hint: t("Greenwashing-Kritikalität von Produkttexten nach Richtlinie (EU) 2024/825 — Kriterienkatalog, Prüfung je Teilbaum, Regeln in der Datenqualität"), component: View }],
  nodeActions: [{ label: t("EmpCo prüfen"), icon: catalog.icon, topic: "analysis", roles: ["group", "product"], run(id, ctx) {
    localStorage.setItem("journali.empco.root", id);
    ctx.go?.("/p/empco/check");
  } }],
  checks,
  catalog
};
export {
  entry as default
};
