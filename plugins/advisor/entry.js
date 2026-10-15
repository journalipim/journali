(function(){const s=document.createElement('style');s.textContent="\n.seiten[data-v-7d8dd5ab] { display: flex; gap: 0; flex: 1; min-height: 0;\n}\n.liste[data-v-7d8dd5ab] { width: 260px; border-right: 1px solid var(--line); overflow-y: auto;\n}\n.rechts[data-v-7d8dd5ab] { flex: 1; overflow-y: auto; min-width: 0;\n}\n.kopf[data-v-7d8dd5ab] { display: flex; gap: 6px; align-items: center; padding: 6px 8px;\n}\n.kopf .bez[data-v-7d8dd5ab] { flex: 1;\n}\n.neu[data-v-7d8dd5ab] { display: flex; gap: 4px; padding: 6px 8px;\n}\n.neu input[data-v-7d8dd5ab] { flex: 1; min-width: 0;\n}\n.form[data-v-7d8dd5ab] { width: 100%;\n}\n.felder[data-v-7d8dd5ab] { border: 0; padding: 0; margin: 0; min-width: 0;\n}\n.form td[data-v-7d8dd5ab] { height: 30px; vertical-align: middle; white-space: normal; padding: 2px 4px;\n}\n.form td.attr[data-v-7d8dd5ab] { color: var(--muted); white-space: nowrap; padding-left: 8px;\n}\n.row[data-v-7d8dd5ab] { display: flex; gap: 8px; align-items: center; flex-wrap: wrap;\n}\n.zahl[data-v-7d8dd5ab] { width: 70px;\n}\n.code[data-v-7d8dd5ab] { margin: 2px 0 8px; padding: 6px 8px; background: var(--bg2, rgba(127,127,127,.08)); border-radius: 4px; white-space: pre-wrap; word-break: break-all; font-size: 12px;\n}\n.neues-token[data-v-7d8dd5ab] { user-select: all; word-break: break-all;\n}\n.fehler[data-v-7d8dd5ab] { margin: 4px 8px; padding-left: 16px;\n}\n.treffer[data-v-7d8dd5ab] { margin: 4px 0; padding-left: 20px;\n}\n";document.head.append(s)})();
const m = window.journali.vue;
const Fragment = m.Fragment;
const computed = m.computed;
const createCommentVNode = m.createCommentVNode;
const createElementBlock = m.createElementBlock;
const createElementVNode = m.createElementVNode;
const createTextVNode = m.createTextVNode;
const normalizeClass = m.normalizeClass;
const onMounted = m.onMounted;
const openBlock = m.openBlock;
const ref = m.ref;
const renderList = m.renderList;
const toDisplayString = m.toDisplayString;
const unref = m.unref;
const vModelCheckbox = m.vModelCheckbox;
const vModelSelect = m.vModelSelect;
const vModelText = m.vModelText;
const withDirectives = m.withDirectives;
const withModifiers = m.withModifiers;
const h = window.journali;
const api = h.api;
const store = h.store;
const dialog = h.dialog;
const t = h.t;
const L = h.L;
const beraterStarten = h.beraterStarten;
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
const _hoisted_3 = { class: "seiten" };
const _hoisted_4 = { class: "liste" };
const _hoisted_5 = { class: "step-band" };
const _hoisted_6 = { class: "grid" };
const _hoisted_7 = ["onClick"];
const _hoisted_8 = { class: "muted" };
const _hoisted_9 = ["title"];
const _hoisted_10 = ["placeholder", "title"];
const _hoisted_11 = ["disabled", "title"];
const _hoisted_12 = {
  key: 0,
  class: "rechts"
};
const _hoisted_13 = { class: "kopf" };
const _hoisted_14 = ["placeholder", "title"];
const _hoisted_15 = ["disabled"];
const _hoisted_16 = ["title"];
const _hoisted_17 = {
  key: 0,
  class: "fehler neg"
};
const _hoisted_18 = ["disabled"];
const _hoisted_19 = { class: "grid form" };
const _hoisted_20 = ["title"];
const _hoisted_21 = ["value"];
const _hoisted_22 = ["title"];
const _hoisted_23 = ["value"];
const _hoisted_24 = ["title"];
const _hoisted_25 = ["value"];
const _hoisted_26 = { class: "attr" };
const _hoisted_27 = { class: "chips" };
const _hoisted_28 = ["onClick"];
const _hoisted_29 = ["title"];
const _hoisted_30 = { class: "attr" };
const _hoisted_31 = ["onUpdate:modelValue", "title"];
const _hoisted_32 = { class: "attr" };
const _hoisted_33 = { class: "row" };
const _hoisted_34 = ["title"];
const _hoisted_35 = ["title"];
const _hoisted_36 = ["value"];
const _hoisted_37 = { class: "attr" };
const _hoisted_38 = ["title"];
const _hoisted_39 = ["title"];
const _hoisted_40 = ["title"];
const _hoisted_41 = ["title"];
const _hoisted_42 = { class: "row grenzen" };
const _hoisted_43 = ["title"];
const _hoisted_44 = ["title"];
const _hoisted_45 = ["title"];
const _hoisted_46 = ["title"];
const _hoisted_47 = { "data-demo": "aus" };
const _hoisted_48 = ["title"];
const _hoisted_49 = { class: "grid" };
const _hoisted_50 = { class: "muted" };
const _hoisted_51 = { class: "muted" };
const _hoisted_52 = { style: { "width": "24px" } };
const _hoisted_53 = ["title", "onClick"];
const _hoisted_54 = {
  class: "row",
  style: { "padding": "4px 8px" }
};
const _hoisted_55 = ["disabled", "title"];
const _hoisted_56 = ["title"];
const _hoisted_57 = ["title"];
const _hoisted_58 = ["placeholder"];
const _hoisted_59 = ["disabled", "title"];
const _hoisted_60 = ["title"];
const _hoisted_61 = ["title"];
const _hoisted_62 = {
  key: 1,
  class: "vorschau",
  style: { "padding": "0 8px 8px" }
};
const _hoisted_63 = {
  key: 0,
  class: "neg"
};
const _hoisted_64 = {
  key: 0,
  class: "satz"
};
const _hoisted_65 = {
  key: 1,
  class: "frage"
};
const _hoisted_66 = ["title"];
const _hoisted_67 = {
  key: 3,
  class: "grid about"
};
const _hoisted_68 = { class: "attr" };
const _hoisted_69 = ["title"];
const _hoisted_70 = {
  key: 4,
  class: "neg ki-fehler"
};
const _hoisted_71 = ["title"];
const _hoisted_72 = ["title"];
const _hoisted_73 = { class: "treffer" };
const _hoisted_74 = { class: "muted" };
const _hoisted_75 = {
  key: 6,
  class: "muted facetten"
};
const _hoisted_76 = ["title"];
const _hoisted_77 = {
  style: { "padding": "4px 8px" },
  class: "einbinden",
  "data-demo": "aus"
};
const _hoisted_78 = { class: "muted" };
const _hoisted_79 = { class: "code" };
const _hoisted_80 = { class: "muted" };
const _hoisted_81 = { class: "code" };
const _hoisted_82 = { class: "code" };
const _sfc_main = {
  __name: "View",
  setup(__props) {
    const KEY = /^[a-z][a-z0-9_-]{1,39}$/;
    const liste = ref([]);
    const cur = ref("");
    const def = ref(null);
    const basis = ref("");
    const meldung = ref("");
    const neuKey = ref("");
    const pubs = ref([]), rollen = ref([]), teams = ref([]);
    const tokens = ref([]), neuesToken = ref("");
    const vorschauFrage = ref(""), vorschau = ref(null), vorschauGespraech = ref("");
    const neueKennung = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, "0")).join("");
    const sichten = computed(() => (store.model?.views ?? []).map((v) => ({ key: v.key, label: L(v.label) || v.key })));
    const sprachen = computed(() => (store.model?.locales ?? []).map((l) => l.code));
    const leitsprache = computed(() => store.model?.masterLocale ?? sprachen.value[0] ?? "de");
    const keyOk = computed(() => KEY.test(neuKey.value) && !liste.value.some((b) => b.key === neuKey.value));
    const fehler = computed(() => liste.value.find((b) => b.key === cur.value)?.errors ?? []);
    const geaendert = computed(() => !!def.value && JSON.stringify(sauber(def.value)) !== basis.value);
    const websites = computed({
      get: () => (def.value?.origins ?? []).join("\n"),
      set: (v) => {
        def.value.origins = String(v).split(/[\s,]+/).map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean);
      }
    });
    function sauber(d) {
      const g = {};
      for (const k of ["jeBesucherMinute", "jeBesucherTag", "jeTag", "kiJeTag"]) {
        const n = Number(d.limits?.[k]);
        if (d.limits?.[k] !== "" && d.limits?.[k] != null && Number.isFinite(n) && n >= 0) g[k] = Math.floor(n);
      }
      const gruss = Object.fromEntries(Object.entries(d.greeting ?? {}).filter(([l, v]) => String(v ?? "").trim() && (d.locales ?? []).concat(leitsprache.value).includes(l)));
      return {
        label: String(d.label ?? "").trim() || null,
        pub: d.pub || null,
        role: d.role || null,
        view: d.view || null,
        locales: d.locales ?? [],
        greeting: gruss,
        ki: !!d.ki,
        team: d.ki ? d.team || null : null,
        mcp: d.mcp !== false,
        origins: d.origins ?? [],
        limits: g,
        url: String(d.url ?? "").trim().replace(/\/+$/, "") || null
      };
    }
    async function ladeListe() {
      try {
        liste.value = await api.get("/api/advisor") ?? [];
        meldung.value = "";
      } catch (e) {
        liste.value = [];
        meldung.value = "✗ " + e.message;
      }
      if (!cur.value && liste.value.length === 1) await oeffne(liste.value[0].key);
    }
    async function ladeAuswahl() {
      const sicher = async (p) => {
        try {
          return await api.get(p) ?? [];
        } catch {
          return [];
        }
      };
      [pubs.value, rollen.value, teams.value] = await Promise.all([sicher("/api/pub"), sicher("/api/auth/roles"), sicher("/api/teams")]);
    }
    onMounted(() => {
      ladeListe();
      ladeAuswahl();
    });
    async function oeffne(key) {
      try {
        const d = await api.get("/api/plugins/advisor/data/" + encodeURIComponent("def:" + key)) ?? {};
        def.value = { label: "", pub: "", role: "", view: "", locales: [], greeting: {}, ki: false, team: "", mcp: true, origins: [], limits: {}, url: "", ...JSON.parse(JSON.stringify(d)) };
        def.value.limits ??= {};
        def.value.greeting ??= {};
        def.value.locales ??= [];
        basis.value = JSON.stringify(sauber(def.value));
        cur.value = key;
        neuesToken.value = "";
        vorschau.value = null;
        vorschauGespraech.value = neueKennung();
        await ladeTokens();
      } catch (e) {
        store.toast(e.message);
      }
    }
    async function schreibe(key, d) {
      await api.post("/api/plugins/advisor/data/" + encodeURIComponent("def:" + key), sauber(d), "PUT");
    }
    async function anlegen() {
      if (!keyOk.value) return;
      const key = neuKey.value;
      const d = { label: key, pub: pubs.value[0]?.id ?? "", role: rollen.value.some((r) => r.key === "reader") ? "reader" : "", view: sichten.value.some((v) => v.key === "sellable") ? "sellable" : "", locales: [], greeting: {}, mcp: true, origins: [], limits: {} };
      try {
        await schreibe(key, d);
        neuKey.value = "";
        await ladeListe();
        await oeffne(key);
      } catch (e) {
        store.toast(e.message);
      }
    }
    async function speichern() {
      try {
        await schreibe(cur.value, def.value);
        await ladeListe();
        await oeffne(cur.value);
        store.toast(t("Gespeichert"), "ok");
      } catch (e) {
        store.toast(e.message);
      }
    }
    async function entfernen() {
      const key = cur.value;
      const ok = await dialog.confirm({ title: t("Berater entfernen"), text: t("{0} — sein Dienst antwortet danach nicht mehr.", [def.value?.label || key]), ok: t("Entfernen"), danger: true });
      if (!ok) return;
      try {
        for (const tk of tokens.value) await api.del(`/api/advisor/${encodeURIComponent(key)}/tokens/${encodeURIComponent(tk.id)}`);
        await api.del("/api/plugins/advisor/data/" + encodeURIComponent("def:" + key));
        cur.value = "";
        def.value = null;
        tokens.value = [];
        await ladeListe();
      } catch (e) {
        store.toast(e.message);
      }
    }
    function sprache(c) {
      const s = new Set(def.value.locales);
      s.has(c) ? s.delete(c) : s.add(c);
      def.value.locales = sprachen.value.filter((x) => s.has(x));
    }
    const grussSprachen = computed(() => def.value?.locales?.length ? def.value.locales : [leitsprache.value]);
    async function ladeTokens() {
      try {
        tokens.value = await api.get(`/api/advisor/${encodeURIComponent(cur.value)}/tokens`) ?? [];
      } catch {
        tokens.value = [];
      }
    }
    async function tokenAusgeben() {
      try {
        const r = await api.post(`/api/advisor/${encodeURIComponent(cur.value)}/tokens`, { label: t("Dienst") });
        neuesToken.value = r.token;
        await ladeTokens();
      } catch (e) {
        store.toast(e.message);
      }
    }
    async function tokenWiderrufen(id) {
      const ok = await dialog.confirm({ title: t("Token widerrufen"), text: t("Der Dienst mit diesem Token bekommt danach keine Antwort mehr."), ok: t("Widerrufen"), danger: true });
      if (!ok) return;
      try {
        await api.del(`/api/advisor/${encodeURIComponent(cur.value)}/tokens/${encodeURIComponent(id)}`);
        await ladeTokens();
      } catch (e) {
        store.toast(e.message);
      }
    }
    async function fragen() {
      try {
        vorschau.value = await api.post(`/api/advisor/${encodeURIComponent(cur.value)}/preview`, { gespraech: vorschauGespraech.value, q: vorschauFrage.value, locale: grussSprachen.value[0], ki: !!def.value.ki });
      } catch (e) {
        vorschau.value = { error: e.message };
      }
    }
    const angabe = (f) => f.label + ": " + (f.op === "le" ? t("bis") + " " : f.op === "ge" ? t("ab") + " " : "") + (f.valueLabel ?? f.value);
    function neuesGespraech() {
      vorschauGespraech.value = neueKennung();
      vorschau.value = null;
      vorschauFrage.value = "";
    }
    const dienst = computed(() => (def.value?.url || "").replace(/\/+$/, "") || "https://advisor.example.com");
    const einbinden = computed(() => `<script src="${dienst.value}/widget.js" async><\/script>`);
    function chatOeffnen() {
      beraterStarten(dienst.value, grussSprachen.value[0]);
    }
    const compose = computed(() => [
      `  advisor-${cur.value}:`,
      "    image: node:22-alpine",
      '    command: ["node", "/advisor/serve.mjs"]',
      `    volumes: ["./plugins/advisor:/advisor:ro", "advisor-${cur.value}-daten:/daten"]`,
      "    environment:",
      "      JOURNALI: http://server:8080",
      `      JOURNALI_ADVISOR: ${cur.value}`,
      "      JOURNALI_ADVISOR_TOKEN: ${JOURNALI_ADVISOR_TOKEN}",
      "      JOURNALI_ADVISOR_DATA: /daten",
      '    ports: ["127.0.0.1:8090:8090"]'
    ].join("\n"));
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createElementVNode("div", _hoisted_2, [
          createElementVNode(
            "h1",
            null,
            toDisplayString(_ctx.$t("✆ Produktberatung")),
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
          createElementVNode(
            "span",
            {
              class: normalizeClass(String(meldung.value).startsWith("✗") ? "fehler" : "muted")
            },
            toDisplayString(meldung.value),
            3
            /* TEXT, CLASS */
          )
        ]),
        createElementVNode("div", _hoisted_3, [
          createElementVNode("div", _hoisted_4, [
            createElementVNode(
              "div",
              _hoisted_5,
              toDisplayString(_ctx.$t("Berater")) + " · " + toDisplayString(liste.value.length),
              1
              /* TEXT */
            ),
            createElementVNode("table", _hoisted_6, [
              createElementVNode("tbody", null, [
                (openBlock(true), createElementBlock(
                  Fragment,
                  null,
                  renderList(liste.value, (b) => {
                    return openBlock(), createElementBlock("tr", {
                      key: b.key,
                      class: normalizeClass(["berater", { current: cur.value === b.key }]),
                      style: { "cursor": "pointer" },
                      onClick: ($event) => oeffne(b.key)
                    }, [
                      createElementVNode("td", null, [
                        createTextVNode(
                          toDisplayString(b.label || b.key) + " ",
                          1
                          /* TEXT */
                        ),
                        createElementVNode(
                          "span",
                          _hoisted_8,
                          toDisplayString(b.key),
                          1
                          /* TEXT */
                        )
                      ]),
                      createElementVNode("td", {
                        style: { "width": "24px" },
                        class: normalizeClass(b.errors.length ? "neg" : "pos"),
                        title: b.errors.join(" · ")
                      }, toDisplayString(b.errors.length ? "✗" : "✓"), 11, _hoisted_9)
                    ], 10, _hoisted_7);
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
                "data-demo": "aus",
                onSubmit: withModifiers(anlegen, ["prevent"])
              },
              [
                withDirectives(createElementVNode("input", {
                  "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => neuKey.value = $event),
                  class: "neu-key",
                  placeholder: _ctx.$t("Schlüssel, z. B. shop"),
                  title: _ctx.$t("a–z, 0–9, _ und -, beginnt mit einem Buchstaben")
                }, null, 8, _hoisted_10), [
                  [vModelText, neuKey.value]
                ]),
                createElementVNode("button", {
                  type: "submit",
                  disabled: !keyOk.value,
                  title: _ctx.$t("Berater anlegen")
                }, "＋", 8, _hoisted_11)
              ],
              32
              /* NEED_HYDRATION */
            )
          ]),
          def.value ? (openBlock(), createElementBlock("div", _hoisted_12, [
            createElementVNode("div", _hoisted_13, [
              withDirectives(createElementVNode("input", {
                "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => def.value.label = $event),
                class: "bez",
                placeholder: _ctx.$t("Bezeichnung"),
                title: _ctx.$t("steht im Kopf des Chat-Fensters")
              }, null, 8, _hoisted_14), [
                [vModelText, def.value.label]
              ]),
              createElementVNode("button", {
                type: "button",
                class: "primary speichern",
                "data-demo": "aus",
                disabled: !geaendert.value,
                onClick: speichern
              }, toDisplayString(_ctx.$t("Speichern")), 9, _hoisted_15),
              createElementVNode("button", {
                type: "button",
                class: "entfernen",
                "data-demo": "aus",
                title: _ctx.$t("Berater entfernen"),
                onClick: entfernen
              }, "✕", 8, _hoisted_16)
            ]),
            fehler.value.length ? (openBlock(), createElementBlock("ul", _hoisted_17, [
              (openBlock(true), createElementBlock(
                Fragment,
                null,
                renderList(fehler.value, (e, i) => {
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
            createCommentVNode(" in der Demo nur ansehen: speichern geht dort nicht, und ungespeichert sperrte die Vorschau "),
            createElementVNode("fieldset", {
              class: "felder",
              disabled: !!unref(store).demo
            }, [
              createElementVNode("table", _hoisted_19, [
                _cache[20] || (_cache[20] = createElementVNode(
                  "colgroup",
                  null,
                  [
                    createElementVNode("col", { style: { "width": "120px" } }),
                    createElementVNode("col")
                  ],
                  -1
                  /* CACHED */
                )),
                createElementVNode("tbody", null, [
                  createElementVNode("tr", null, [
                    createElementVNode("td", {
                      class: "attr",
                      title: _ctx.$t("welche Produkte der Berater kennt: was dieser Baum für seinen Kanal ausleitet")
                    }, toDisplayString(_ctx.$t("Publikationsbaum")), 9, _hoisted_20),
                    createElementVNode("td", null, [
                      withDirectives(createElementVNode(
                        "select",
                        {
                          "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => def.value.pub = $event),
                          class: "pub"
                        },
                        [
                          _cache[16] || (_cache[16] = createElementVNode(
                            "option",
                            { value: "" },
                            "—",
                            -1
                            /* CACHED */
                          )),
                          (openBlock(true), createElementBlock(
                            Fragment,
                            null,
                            renderList(pubs.value, (p) => {
                              return openBlock(), createElementBlock("option", {
                                key: p.id,
                                value: p.id
                              }, toDisplayString(p.label) + " · " + toDisplayString(p.channel) + toDisplayString(p.market ? " · " + p.market : ""), 9, _hoisted_21);
                            }),
                            128
                            /* KEYED_FRAGMENT */
                          ))
                        ],
                        512
                        /* NEED_PATCH */
                      ), [
                        [vModelSelect, def.value.pub]
                      ])
                    ])
                  ]),
                  createElementVNode("tr", null, [
                    createElementVNode("td", {
                      class: "attr",
                      title: _ctx.$t("der Berater sieht, was diese Rolle sieht — eingeschränkte Knoten und Ordner bleiben aussen vor")
                    }, toDisplayString(_ctx.$t("Rolle")), 9, _hoisted_22),
                    createElementVNode("td", null, [
                      withDirectives(createElementVNode(
                        "select",
                        {
                          "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => def.value.role = $event),
                          class: "rolle"
                        },
                        [
                          _cache[17] || (_cache[17] = createElementVNode(
                            "option",
                            { value: "" },
                            "—",
                            -1
                            /* CACHED */
                          )),
                          (openBlock(true), createElementBlock(
                            Fragment,
                            null,
                            renderList(rollen.value, (r) => {
                              return openBlock(), createElementBlock("option", {
                                key: r.key,
                                value: r.key
                              }, toDisplayString(r.label || r.key), 9, _hoisted_23);
                            }),
                            128
                            /* KEYED_FRAGMENT */
                          ))
                        ],
                        512
                        /* NEED_PATCH */
                      ), [
                        [vModelSelect, def.value.role]
                      ])
                    ])
                  ]),
                  createElementVNode("tr", null, [
                    createElementVNode("td", {
                      class: "attr",
                      title: _ctx.$t("nur die Attribute dieser Sicht erscheinen am Produkt, in den Facetten und im Vergleich")
                    }, toDisplayString(_ctx.$t("Sicht")), 9, _hoisted_24),
                    createElementVNode("td", null, [
                      withDirectives(createElementVNode(
                        "select",
                        {
                          "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => def.value.view = $event),
                          class: "sicht"
                        },
                        [
                          _cache[18] || (_cache[18] = createElementVNode(
                            "option",
                            { value: "" },
                            "—",
                            -1
                            /* CACHED */
                          )),
                          (openBlock(true), createElementBlock(
                            Fragment,
                            null,
                            renderList(sichten.value, (v) => {
                              return openBlock(), createElementBlock("option", {
                                key: v.key,
                                value: v.key
                              }, toDisplayString(v.label), 9, _hoisted_25);
                            }),
                            128
                            /* KEYED_FRAGMENT */
                          ))
                        ],
                        512
                        /* NEED_PATCH */
                      ), [
                        [vModelSelect, def.value.view]
                      ])
                    ])
                  ]),
                  createElementVNode("tr", null, [
                    createElementVNode(
                      "td",
                      _hoisted_26,
                      toDisplayString(_ctx.$t("Sprachen")),
                      1
                      /* TEXT */
                    ),
                    createElementVNode("td", null, [
                      createElementVNode("div", _hoisted_27, [
                        (openBlock(true), createElementBlock(
                          Fragment,
                          null,
                          renderList(sprachen.value, (c) => {
                            return openBlock(), createElementBlock("span", {
                              key: c,
                              class: normalizeClass(["view-chip sprache", { on: def.value.locales.includes(c) }]),
                              onClick: ($event) => sprache(c)
                            }, toDisplayString(c), 11, _hoisted_28);
                          }),
                          128
                          /* KEYED_FRAGMENT */
                        )),
                        !def.value.locales.length ? (openBlock(), createElementBlock("span", {
                          key: 0,
                          class: "muted",
                          title: _ctx.$t("ohne Auswahl gilt die Leitsprache")
                        }, toDisplayString(" " + _ctx.$t("· Leitsprache {0}", [leitsprache.value])), 9, _hoisted_29)) : createCommentVNode("v-if", true)
                      ])
                    ])
                  ]),
                  (openBlock(true), createElementBlock(
                    Fragment,
                    null,
                    renderList(grussSprachen.value, (l) => {
                      return openBlock(), createElementBlock("tr", {
                        key: "g" + l
                      }, [
                        createElementVNode(
                          "td",
                          _hoisted_30,
                          toDisplayString(_ctx.$t("Begrüssung {0}", [l])),
                          1
                          /* TEXT */
                        ),
                        createElementVNode("td", null, [
                          withDirectives(createElementVNode("input", {
                            "onUpdate:modelValue": ($event) => def.value.greeting[l] = $event,
                            class: "gruss",
                            style: { "width": "100%" },
                            title: _ctx.$t("der erste Satz im Chat-Fenster")
                          }, null, 8, _hoisted_31), [
                            [vModelText, def.value.greeting[l]]
                          ])
                        ])
                      ]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  )),
                  createElementVNode("tr", null, [
                    createElementVNode(
                      "td",
                      _hoisted_32,
                      toDisplayString(_ctx.$t("KI")),
                      1
                      /* TEXT */
                    ),
                    createElementVNode("td", null, [
                      createElementVNode("div", _hoisted_33, [
                        createElementVNode("label", {
                          title: _ctx.$t("die KI des gewählten Teams schreibt zu den Treffern einen kurzen Text — sonst antwortet der Berater ohne KI")
                        }, [
                          withDirectives(createElementVNode(
                            "input",
                            {
                              type: "checkbox",
                              "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => def.value.ki = $event),
                              class: "ki"
                            },
                            null,
                            512
                            /* NEED_PATCH */
                          ), [
                            [vModelCheckbox, def.value.ki]
                          ]),
                          createTextVNode(
                            toDisplayString(" " + _ctx.$t("Text zu den Treffern")),
                            1
                            /* TEXT */
                          )
                        ], 8, _hoisted_34),
                        def.value.ki ? withDirectives((openBlock(), createElementBlock("select", {
                          key: 0,
                          "onUpdate:modelValue": _cache[6] || (_cache[6] = ($event) => def.value.team = $event),
                          class: "team",
                          title: _ctx.$t("mit dessen KI-Schlüssel, gezählt bei diesem Team")
                        }, [
                          _cache[19] || (_cache[19] = createElementVNode(
                            "option",
                            { value: "" },
                            "—",
                            -1
                            /* CACHED */
                          )),
                          (openBlock(true), createElementBlock(
                            Fragment,
                            null,
                            renderList(teams.value, (tm) => {
                              return openBlock(), createElementBlock("option", {
                                key: tm.key,
                                value: tm.key
                              }, toDisplayString(tm.label || tm.key), 9, _hoisted_36);
                            }),
                            128
                            /* KEYED_FRAGMENT */
                          ))
                        ], 8, _hoisted_35)), [
                          [vModelSelect, def.value.team]
                        ]) : createCommentVNode("v-if", true)
                      ])
                    ])
                  ]),
                  createElementVNode("tr", null, [
                    createElementVNode(
                      "td",
                      _hoisted_37,
                      toDisplayString(_ctx.$t("MCP")),
                      1
                      /* TEXT */
                    ),
                    createElementVNode("td", null, [
                      createElementVNode("label", {
                        title: _ctx.$t("fremde KI-Agenten fragen den Dienst unter /mcp mit denselben Grenzen")
                      }, [
                        withDirectives(createElementVNode(
                          "input",
                          {
                            type: "checkbox",
                            "onUpdate:modelValue": _cache[7] || (_cache[7] = ($event) => def.value.mcp = $event),
                            class: "mcp"
                          },
                          null,
                          512
                          /* NEED_PATCH */
                        ), [
                          [vModelCheckbox, def.value.mcp]
                        ]),
                        createTextVNode(
                          toDisplayString(" " + _ctx.$t("Werkzeuge für KI-Agenten")),
                          1
                          /* TEXT */
                        )
                      ], 8, _hoisted_38)
                    ])
                  ]),
                  createElementVNode("tr", null, [
                    createElementVNode("td", {
                      class: "attr",
                      title: _ctx.$t("wo der Dienst des Beraters erreichbar ist — für den Code zum Einbinden und das Chat-Fenster hier")
                    }, toDisplayString(_ctx.$t("Dienst")), 9, _hoisted_39),
                    createElementVNode("td", null, [
                      withDirectives(createElementVNode(
                        "input",
                        {
                          "onUpdate:modelValue": _cache[8] || (_cache[8] = ($event) => def.value.url = $event),
                          class: "dienst-url",
                          style: { "width": "100%" },
                          placeholder: "https://advisor.example.com"
                        },
                        null,
                        512
                        /* NEED_PATCH */
                      ), [
                        [vModelText, def.value.url]
                      ])
                    ])
                  ]),
                  createElementVNode("tr", null, [
                    createElementVNode("td", {
                      class: "attr",
                      title: _ctx.$t("je Zeile eine Adresse, etwa https://www.example.com — nur diese Websites dürfen das Chat-Fenster einbinden")
                    }, toDisplayString(_ctx.$t("Websites")), 9, _hoisted_40),
                    createElementVNode("td", null, [
                      withDirectives(createElementVNode(
                        "textarea",
                        {
                          "onUpdate:modelValue": _cache[9] || (_cache[9] = ($event) => websites.value = $event),
                          class: "websites",
                          rows: "2",
                          style: { "width": "100%" },
                          placeholder: "https://www.example.com"
                        },
                        null,
                        512
                        /* NEED_PATCH */
                      ), [
                        [
                          vModelText,
                          websites.value,
                          void 0,
                          { lazy: true }
                        ]
                      ])
                    ])
                  ]),
                  createElementVNode("tr", null, [
                    createElementVNode("td", {
                      class: "attr",
                      title: _ctx.$t("je Besucher zählt der Dienst, je Tag zählt journali; leer heisst Vorgabe")
                    }, toDisplayString(_ctx.$t("Grenzen")), 9, _hoisted_41),
                    createElementVNode("td", null, [
                      createElementVNode("div", _hoisted_42, [
                        createElementVNode("label", {
                          title: _ctx.$t("Fragen je Besucher und Minute (Vorgabe 20)")
                        }, [
                          createTextVNode(
                            toDisplayString(_ctx.$t("Besucher/min")) + " ",
                            1
                            /* TEXT */
                          ),
                          withDirectives(createElementVNode(
                            "input",
                            {
                              type: "number",
                              min: "0",
                              "onUpdate:modelValue": _cache[10] || (_cache[10] = ($event) => def.value.limits.jeBesucherMinute = $event),
                              class: "zahl"
                            },
                            null,
                            512
                            /* NEED_PATCH */
                          ), [
                            [vModelText, def.value.limits.jeBesucherMinute]
                          ])
                        ], 8, _hoisted_43),
                        createElementVNode("label", {
                          title: _ctx.$t("Fragen je Besucher und Tag (Vorgabe 300)")
                        }, [
                          createTextVNode(
                            toDisplayString(_ctx.$t("Besucher/Tag")) + " ",
                            1
                            /* TEXT */
                          ),
                          withDirectives(createElementVNode(
                            "input",
                            {
                              type: "number",
                              min: "0",
                              "onUpdate:modelValue": _cache[11] || (_cache[11] = ($event) => def.value.limits.jeBesucherTag = $event),
                              class: "zahl"
                            },
                            null,
                            512
                            /* NEED_PATCH */
                          ), [
                            [vModelText, def.value.limits.jeBesucherTag]
                          ])
                        ], 8, _hoisted_44),
                        createElementVNode("label", {
                          title: _ctx.$t("Fragen aller Besucher je Tag (leer: ohne Grenze)")
                        }, [
                          createTextVNode(
                            toDisplayString(_ctx.$t("gesamt/Tag")) + " ",
                            1
                            /* TEXT */
                          ),
                          withDirectives(createElementVNode(
                            "input",
                            {
                              type: "number",
                              min: "0",
                              "onUpdate:modelValue": _cache[12] || (_cache[12] = ($event) => def.value.limits.jeTag = $event),
                              class: "zahl je-tag"
                            },
                            null,
                            512
                            /* NEED_PATCH */
                          ), [
                            [vModelText, def.value.limits.jeTag]
                          ])
                        ], 8, _hoisted_45),
                        createElementVNode("label", {
                          title: _ctx.$t("Texte der KI je Tag (leer: ohne Grenze)")
                        }, [
                          createTextVNode(
                            toDisplayString(_ctx.$t("KI/Tag")) + " ",
                            1
                            /* TEXT */
                          ),
                          withDirectives(createElementVNode(
                            "input",
                            {
                              type: "number",
                              min: "0",
                              "onUpdate:modelValue": _cache[13] || (_cache[13] = ($event) => def.value.limits.kiJeTag = $event),
                              class: "zahl"
                            },
                            null,
                            512
                            /* NEED_PATCH */
                          ), [
                            [vModelText, def.value.limits.kiJeTag]
                          ])
                        ], 8, _hoisted_46)
                      ])
                    ])
                  ])
                ])
              ])
            ], 8, _hoisted_18),
            createElementVNode("div", _hoisted_47, [
              createElementVNode("div", {
                class: "step-band",
                title: _ctx.$t("der Dienst meldet sich mit einem Token an; es gilt nur für die Fragen an diesen Berater")
              }, toDisplayString(_ctx.$t("Token")) + " · " + toDisplayString(tokens.value.length), 9, _hoisted_48),
              createElementVNode("table", _hoisted_49, [
                createElementVNode("tbody", null, [
                  (openBlock(true), createElementBlock(
                    Fragment,
                    null,
                    renderList(tokens.value, (tk) => {
                      return openBlock(), createElementBlock("tr", {
                        key: tk.id,
                        class: "token"
                      }, [
                        createElementVNode("td", null, [
                          createTextVNode(
                            toDisplayString(tk.label) + " ",
                            1
                            /* TEXT */
                          ),
                          createElementVNode(
                            "span",
                            _hoisted_50,
                            toDisplayString(tk.id) + "…",
                            1
                            /* TEXT */
                          )
                        ]),
                        createElementVNode(
                          "td",
                          _hoisted_51,
                          toDisplayString(new Date(tk.at).toLocaleString()),
                          1
                          /* TEXT */
                        ),
                        createElementVNode("td", _hoisted_52, [
                          createElementVNode("button", {
                            type: "button",
                            class: "x widerrufen",
                            title: _ctx.$t("Token widerrufen"),
                            onClick: ($event) => tokenWiderrufen(tk.id)
                          }, "✕", 8, _hoisted_53)
                        ])
                      ]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ])
              ]),
              createElementVNode("div", _hoisted_54, [
                createElementVNode("button", {
                  type: "button",
                  class: "token-neu",
                  disabled: geaendert.value,
                  title: geaendert.value ? _ctx.$t("ungespeicherte Änderungen") : _ctx.$t("ein neues Token für den Dienst"),
                  onClick: tokenAusgeben
                }, toDisplayString(_ctx.$t("＋ Token")), 9, _hoisted_55),
                neuesToken.value ? (openBlock(), createElementBlock("code", {
                  key: 0,
                  class: "neues-token",
                  title: _ctx.$t("nur jetzt sichtbar — als JOURNALI_ADVISOR_TOKEN des Dienstes")
                }, toDisplayString(neuesToken.value), 9, _hoisted_56)) : createCommentVNode("v-if", true)
              ])
            ]),
            createElementVNode("div", {
              class: "step-band",
              title: _ctx.$t("dieselbe Frage, die ein Besucher stellt — mit Text der KI, wenn der Berater sie nutzt")
            }, toDisplayString(_ctx.$t("Vorschau")), 9, _hoisted_57),
            createElementVNode(
              "form",
              {
                class: "row",
                style: { "padding": "4px 8px" },
                onSubmit: withModifiers(fragen, ["prevent"])
              },
              [
                withDirectives(createElementVNode("input", {
                  "onUpdate:modelValue": _cache[14] || (_cache[14] = ($event) => vorschauFrage.value = $event),
                  class: "vorschau-frage",
                  style: { "flex": "1" },
                  placeholder: _ctx.$t("Frage eines Besuchers")
                }, null, 8, _hoisted_58), [
                  [vModelText, vorschauFrage.value]
                ]),
                createElementVNode("button", {
                  type: "submit",
                  class: "vorschau-los",
                  disabled: geaendert.value,
                  title: geaendert.value ? _ctx.$t("ungespeicherte Änderungen") : ""
                }, toDisplayString(_ctx.$t("Fragen")), 9, _hoisted_59),
                createElementVNode("button", {
                  type: "button",
                  class: "vorschau-neu",
                  title: _ctx.$t("ein neues Gespräch: die gesammelten Angaben fallen weg"),
                  onClick: neuesGespraech
                }, "↺", 8, _hoisted_60),
                def.value.url && !geaendert.value ? (openBlock(), createElementBlock("button", {
                  key: 0,
                  type: "button",
                  class: "chat-oeffnen",
                  title: _ctx.$t("das Chat-Fenster des Dienstes auf dieser Seite, wie auf einer Website"),
                  onClick: chatOeffnen
                }, toDisplayString(_ctx.$t("✆ Chat-Fenster")), 9, _hoisted_61)) : createCommentVNode("v-if", true)
              ],
              32
              /* NEED_HYDRATION */
            ),
            vorschau.value ? (openBlock(), createElementBlock("div", _hoisted_62, [
              vorschau.value.error ? (openBlock(), createElementBlock(
                "div",
                _hoisted_63,
                "✗ " + toDisplayString(vorschau.value.error),
                1
                /* TEXT */
              )) : (openBlock(), createElementBlock(
                Fragment,
                { key: 1 },
                [
                  vorschau.value.texte?.satz || vorschau.value.texte?.ueber ? (openBlock(), createElementBlock(
                    "div",
                    _hoisted_64,
                    toDisplayString(vorschau.value.texte.ueber ? vorschau.value.texte.ueber + " " : "") + toDisplayString(vorschau.value.texte.satz),
                    1
                    /* TEXT */
                  )) : createCommentVNode("v-if", true),
                  (openBlock(true), createElementBlock(
                    Fragment,
                    null,
                    renderList(vorschau.value.texte?.hinweise ?? [], (h2, i) => {
                      return openBlock(), createElementBlock(
                        "div",
                        {
                          key: "h" + i,
                          class: "muted hinweis"
                        },
                        toDisplayString(h2),
                        1
                        /* TEXT */
                      );
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  )),
                  createCommentVNode(" die Frage des Beraters gehört zur Antwort, wie im Chat-Fenster (14.10.2026: die Vorschau liess sie weg) "),
                  vorschau.value.texte?.statt || vorschau.value.texte?.frage ? (openBlock(), createElementBlock(
                    "div",
                    _hoisted_65,
                    toDisplayString([vorschau.value.texte.statt, vorschau.value.texte.frage].filter(Boolean).join(" ")),
                    1
                    /* TEXT */
                  )) : createCommentVNode("v-if", true),
                  vorschau.value.filter?.length || vorschau.value.words?.length ? (openBlock(), createElementBlock("div", {
                    key: 2,
                    class: "muted gesammelt",
                    title: _ctx.$t("was der Kern aus dem Gespräch gesammelt hat")
                  }, toDisplayString([...vorschau.value.words ?? [], ...(vorschau.value.filter ?? []).map(angabe)].join(" · ")), 9, _hoisted_66)) : createCommentVNode("v-if", true),
                  vorschau.value.about?.values?.length ? (openBlock(), createElementBlock("table", _hoisted_67, [
                    createElementVNode("tbody", null, [
                      (openBlock(true), createElementBlock(
                        Fragment,
                        null,
                        renderList(vorschau.value.about.values, (v) => {
                          return openBlock(), createElementBlock("tr", {
                            key: v.key
                          }, [
                            createElementVNode(
                              "td",
                              _hoisted_68,
                              toDisplayString(v.label),
                              1
                              /* TEXT */
                            ),
                            createElementVNode(
                              "td",
                              null,
                              toDisplayString(v.value),
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
                  createElementVNode("div", {
                    class: "muted",
                    title: vorschau.value.warning || ""
                  }, toDisplayString(_ctx.$t("{0} Treffer", [vorschau.value.total])) + toDisplayString(vorschau.value.warning && !vorschau.value.warning.startsWith("KI") ? " · " + _ctx.$t("nur Wortsuche") : ""), 9, _hoisted_69),
                  vorschau.value.warning?.startsWith("KI") ? (openBlock(), createElementBlock(
                    "div",
                    _hoisted_70,
                    "✗ " + toDisplayString(vorschau.value.warning),
                    1
                    /* TEXT */
                  )) : createCommentVNode("v-if", true),
                  vorschau.value.answer ? (openBlock(), createElementBlock("div", {
                    key: 5,
                    class: "ki-text",
                    title: _ctx.$t("Text von einer KI erstellt")
                  }, "✧ " + toDisplayString(vorschau.value.answer), 9, _hoisted_71)) : createCommentVNode("v-if", true),
                  (openBlock(true), createElementBlock(
                    Fragment,
                    null,
                    renderList(vorschau.value.docs ?? [], (u) => {
                      return openBlock(), createElementBlock("div", {
                        key: u.n,
                        class: "unterlage muted",
                        title: u.text
                      }, "⎘ U" + toDisplayString(u.n) + " " + toDisplayString(u.heading || u.name) + " · " + toDisplayString(u.name), 9, _hoisted_72);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  )),
                  createElementVNode("ol", _hoisted_73, [
                    (openBlock(true), createElementBlock(
                      Fragment,
                      null,
                      renderList(vorschau.value.hits, (h2) => {
                        return openBlock(), createElementBlock("li", {
                          key: h2.id
                        }, [
                          createTextVNode(
                            toDisplayString(h2.name) + " ",
                            1
                            /* TEXT */
                          ),
                          createElementVNode(
                            "span",
                            _hoisted_74,
                            toDisplayString((h2.values ?? []).map((v) => v.label + ": " + v.value).join(" · ")),
                            1
                            /* TEXT */
                          )
                        ]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ]),
                  vorschau.value.facets?.length ? (openBlock(), createElementBlock(
                    "div",
                    _hoisted_75,
                    toDisplayString(_ctx.$t("Facetten")) + ": " + toDisplayString(vorschau.value.facets.map((f) => f.label).join(", ")),
                    1
                    /* TEXT */
                  )) : createCommentVNode("v-if", true)
                ],
                64
                /* STABLE_FRAGMENT */
              ))
            ])) : createCommentVNode("v-if", true),
            createElementVNode("div", {
              class: "step-band",
              "data-demo": "aus",
              title: _ctx.$t("der Dienst läuft im eigenen Container und spricht nur über /api mit journali — docs/betrieb.md")
            }, toDisplayString(_ctx.$t("Einbinden")), 9, _hoisted_76),
            createElementVNode("div", _hoisted_77, [
              createElementVNode(
                "div",
                _hoisted_78,
                toDisplayString(_ctx.$t("Website")),
                1
                /* TEXT */
              ),
              createElementVNode(
                "pre",
                _hoisted_79,
                toDisplayString(einbinden.value),
                1
                /* TEXT */
              ),
              createElementVNode(
                "div",
                _hoisted_80,
                toDisplayString(_ctx.$t("MCP")),
                1
                /* TEXT */
              ),
              createElementVNode(
                "pre",
                _hoisted_81,
                toDisplayString(dienst.value) + "/mcp",
                1
                /* TEXT */
              ),
              _cache[21] || (_cache[21] = createElementVNode(
                "div",
                { class: "muted" },
                "compose.yaml",
                -1
                /* CACHED */
              )),
              createElementVNode(
                "pre",
                _hoisted_82,
                toDisplayString(compose.value),
                1
                /* TEXT */
              )
            ])
          ])) : createCommentVNode("v-if", true)
        ])
      ]);
    };
  }
};
const View = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-7d8dd5ab"]]);
const entry = {
  views: [{ path: "advisor", topic: "export", order: 50, label: t("Produktberatung"), icon: "✆", hint: t("Fragen von Besuchern einer Website an die Produkte eines Publikationsbaums — als Chat-Fenster und für KI-Agenten"), component: View }]
};
export {
  entry as default
};
