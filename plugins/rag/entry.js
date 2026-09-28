(function(){const s=document.createElement('style');s.textContent="\n.form[data-v-d793ace6] { width: 100%; border-bottom: 1px solid var(--line);\n}\n.form td[data-v-d793ace6] { height: 30px; vertical-align: middle; white-space: normal; padding: 2px 4px;\n}\n.form td.attr[data-v-d793ace6] { color: var(--muted); white-space: nowrap; padding-left: 8px;\n}\n.row[data-v-d793ace6] { display: flex; gap: 6px; align-items: center;\n}\n";document.head.append(s)})();
const m = window.journali.vue;
const Fragment = m.Fragment;
const computed = m.computed;
const createBlock = m.createBlock;
const createCommentVNode = m.createCommentVNode;
const createElementBlock = m.createElementBlock;
const createElementVNode = m.createElementVNode;
const createTextVNode = m.createTextVNode;
const createVNode = m.createVNode;
const normalizeClass = m.normalizeClass;
const onMounted = m.onMounted;
const openBlock = m.openBlock;
const ref = m.ref;
const renderList = m.renderList;
const resolveComponent = m.resolveComponent;
const toDisplayString = m.toDisplayString;
const unref = m.unref;
const vModelCheckbox = m.vModelCheckbox;
const vModelSelect = m.vModelSelect;
const withCtx = m.withCtx;
const withDirectives = m.withDirectives;
const h = window.journali;
const store = h.store;
const tree = h.tree;
const icon = h.icon;
const plugins = h.plugins;
const t = h.t;
const ProfileBar = h.ProfileBar;
const TreePicker = h.TreePicker;
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
const _hoisted_3 = ["title"];
const _hoisted_4 = { class: "grid form" };
const _hoisted_5 = { class: "attr" };
const _hoisted_6 = { class: "attr" };
const _hoisted_7 = {
  class: "muted",
  style: { "margin": "2px 0 4px" }
};
const _hoisted_8 = { class: "attr" };
const _hoisted_9 = ["value"];
const _hoisted_10 = { class: "attr" };
const _hoisted_11 = { class: "chips" };
const _hoisted_12 = ["onClick"];
const _hoisted_13 = ["title"];
const _hoisted_14 = { class: "attr" };
const _hoisted_15 = ["title"];
const _hoisted_16 = { class: "attr" };
const _hoisted_17 = ["title"];
const _hoisted_18 = { class: "row" };
const _hoisted_19 = ["onClick", "title"];
const _hoisted_20 = ["onClick", "title"];
const _sfc_main = {
  __name: "View",
  setup(__props) {
    const root = ref("");
    const role = ref("product");
    const locales = ref([]);
    const withVersions = ref(true);
    const withDocs = ref(true);
    const ROLLEN = ["product", "variant", "group", "all"];
    const rollenText = { product: t("▦ Produkte"), variant: t("◆ Varianten"), group: t("▣ Gruppen"), all: t("alle Knoten") };
    const alleSprachen = computed(() => (store.model?.locales ?? []).map((l) => l.code));
    const leitsprache = computed(() => store.model?.masterLocale ?? alleSprachen.value[0] ?? "de");
    const profileGet = () => ({ root: root.value, role: role.value, locales: [...locales.value], withVersions: withVersions.value, withDocs: withDocs.value });
    function profileSet(p) {
      root.value = p?.root ?? "";
      role.value = ROLLEN.includes(p?.role) ? p.role : "product";
      const l = p?.locales;
      locales.value = Array.isArray(l) ? [...l] : String(l ?? "").split(/[,\s]+/).filter(Boolean);
      withVersions.value = p?.withVersions == null ? true : String(p.withVersions) === "true";
      withDocs.value = p?.withDocs == null ? true : String(p.withDocs) === "true";
    }
    const knoten = computed(() => {
      const unter = (id) => {
        for (let p = tree.byId.get(id)?.parent; p; p = tree.byId.get(p)?.parent) if (p === root.value) return true;
        return false;
      };
      return tree.rows.filter((r) => (root.value ? r.id === root.value || unter(r.id) : true) && r.role !== "media" && (role.value === "all" || r.role === role.value)).length;
    });
    const sprachenText = computed(() => (locales.value.length ? locales.value : [leitsprache.value]).join(", "));
    const wurzel = computed(() => root.value ? tree.byId.get(root.value) : null);
    function sprache(c) {
      const s = new Set(locales.value);
      s.has(c) ? s.delete(c) : s.add(c);
      locales.value = alleSprachen.value.filter((x) => s.has(x));
    }
    onMounted(() => {
      if (!tree.loaded) tree.load();
    });
    return (_ctx, _cache) => {
      const _component_router_link = resolveComponent("router-link");
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createElementVNode("div", _hoisted_2, [
          createElementVNode(
            "h1",
            null,
            toDisplayString(_ctx.$t("✧ KI-Wissensbasis")),
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
          createElementVNode("span", {
            class: "muted anzahl",
            title: _ctx.$t("so viele Knoten leitet ein Lauf mit diesem Profil aus, je Sprache ein Dokument")
          }, toDisplayString(_ctx.$t("{0} Knoten · {1}", [knoten.value, sprachenText.value])), 9, _hoisted_3)
        ]),
        createElementVNode("table", _hoisted_4, [
          _cache[6] || (_cache[6] = createElementVNode(
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
            createElementVNode("tr", null, [
              createElementVNode(
                "td",
                _hoisted_5,
                toDisplayString(_ctx.$t("Profil")),
                1
                /* TEXT */
              ),
              createElementVNode("td", null, [
                createVNode(unref(ProfileBar), {
                  plugin: "rag",
                  scope: "profile",
                  get: profileGet,
                  set: profileSet
                })
              ])
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
                createElementVNode(
                  "div",
                  _hoisted_7,
                  toDisplayString(wurzel.value ? unref(icon)(wurzel.value.role) + " " + wurzel.value.label : _ctx.$t("⌂ alles")),
                  1
                  /* TEXT */
                ),
                createVNode(unref(TreePicker), {
                  modelValue: root.value,
                  "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => root.value = $event),
                  roles: ["group", "product"],
                  "allow-root": "",
                  height: 220
                }, null, 8, ["modelValue"])
              ])
            ]),
            createElementVNode("tr", null, [
              createElementVNode(
                "td",
                _hoisted_8,
                toDisplayString(_ctx.$t("Knoten")),
                1
                /* TEXT */
              ),
              createElementVNode("td", null, [
                withDirectives(createElementVNode(
                  "select",
                  {
                    "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => role.value = $event),
                    class: "rolle",
                    style: { "width": "100%" }
                  },
                  [
                    (openBlock(), createElementBlock(
                      Fragment,
                      null,
                      renderList(ROLLEN, (r) => {
                        return createElementVNode("option", {
                          key: r,
                          value: r
                        }, toDisplayString(rollenText[r]), 9, _hoisted_9);
                      }),
                      64
                      /* STABLE_FRAGMENT */
                    ))
                  ],
                  512
                  /* NEED_PATCH */
                ), [
                  [vModelSelect, role.value]
                ])
              ])
            ]),
            createElementVNode("tr", null, [
              createElementVNode(
                "td",
                _hoisted_10,
                toDisplayString(_ctx.$t("Sprachen")),
                1
                /* TEXT */
              ),
              createElementVNode("td", null, [
                createElementVNode("div", _hoisted_11, [
                  (openBlock(true), createElementBlock(
                    Fragment,
                    null,
                    renderList(alleSprachen.value, (c) => {
                      return openBlock(), createElementBlock("span", {
                        key: c,
                        class: normalizeClass(["view-chip sprache", { on: locales.value.includes(c) }]),
                        onClick: ($event) => sprache(c)
                      }, toDisplayString(c), 11, _hoisted_12);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  )),
                  !locales.value.length ? (openBlock(), createElementBlock("span", {
                    key: 0,
                    class: "muted",
                    title: _ctx.$t("ohne Auswahl gilt die Leitsprache")
                  }, toDisplayString(" " + _ctx.$t("· Leitsprache {0}", [leitsprache.value])), 9, _hoisted_13)) : createCommentVNode("v-if", true)
                ])
              ])
            ]),
            createElementVNode("tr", null, [
              createElementVNode(
                "td",
                _hoisted_14,
                toDisplayString(_ctx.$t("Version")),
                1
                /* TEXT */
              ),
              createElementVNode("td", null, [
                createElementVNode("label", {
                  title: _ctx.$t("die jüngste nicht zurückgezogene Version des Knotens mit ihren Belegen — die Zitierstelle")
                }, [
                  withDirectives(createElementVNode(
                    "input",
                    {
                      type: "checkbox",
                      "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => withVersions.value = $event),
                      class: "versionen"
                    },
                    null,
                    512
                    /* NEED_PATCH */
                  ), [
                    [vModelCheckbox, withVersions.value]
                  ]),
                  createTextVNode(
                    toDisplayString(" " + _ctx.$t("freigegebene Version und Belege mitgeben")),
                    1
                    /* TEXT */
                  )
                ], 8, _hoisted_15)
              ])
            ]),
            createElementVNode("tr", null, [
              createElementVNode(
                "td",
                _hoisted_16,
                toDisplayString(_ctx.$t("Dokumente")),
                1
                /* TEXT */
              ),
              createElementVNode("td", null, [
                createElementVNode("label", {
                  title: _ctx.$t("Text der gültigen und freigegebenen Dokumente am Knoten, aus dem Dokumentindex")
                }, [
                  withDirectives(createElementVNode(
                    "input",
                    {
                      type: "checkbox",
                      "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => withDocs.value = $event),
                      class: "dokumente"
                    },
                    null,
                    512
                    /* NEED_PATCH */
                  ), [
                    [vModelCheckbox, withDocs.value]
                  ]),
                  createTextVNode(
                    toDisplayString(" " + _ctx.$t("Text der Dokumente am Knoten mitgeben")),
                    1
                    /* TEXT */
                  )
                ], 8, _hoisted_17)
              ])
            ]),
            createElementVNode("tr", null, [
              _cache[5] || (_cache[5] = createElementVNode(
                "td",
                { class: "attr" },
                null,
                -1
                /* CACHED */
              )),
              createElementVNode("td", null, [
                createElementVNode("div", _hoisted_18, [
                  unref(plugins).enabled("tasker") ? (openBlock(), createBlock(_component_router_link, {
                    key: 0,
                    to: "/p/tasker/jobs?new=rag",
                    custom: ""
                  }, {
                    default: withCtx(({ navigate }) => [
                      createElementVNode("button", {
                        class: "primary",
                        onClick: navigate,
                        title: _ctx.$t("Verzeichnis und Zeitplan stehen am Job — dort dieses Profil wählen")
                      }, toDisplayString(_ctx.$t("⏱ als Job")), 9, _hoisted_19)
                    ]),
                    _: 1
                    /* STABLE */
                  })) : createCommentVNode("v-if", true),
                  unref(plugins).enabled("tasker") ? (openBlock(), createBlock(_component_router_link, {
                    key: 1,
                    to: "/p/tasker/jobs",
                    custom: ""
                  }, {
                    default: withCtx(({ navigate }) => [
                      createElementVNode("button", {
                        onClick: navigate,
                        title: _ctx.$t("die Jobs unter ⏱ Jobs — Zeitplan, Läufe, Logs")
                      }, toDisplayString(_ctx.$t("⏱ Jobs verwalten")), 9, _hoisted_20)
                    ]),
                    _: 1
                    /* STABLE */
                  })) : createCommentVNode("v-if", true)
                ])
              ])
            ])
          ])
        ])
      ]);
    };
  }
};
const View = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-d793ace6"]]);
const entry = {
  views: [{ path: "profile", topic: "export", order: 40, needs: "tasker", label: t("KI-Wissensbasis"), icon: "✧", hint: t("je Knoten ein Dokument für Vektor-Stores — als Job"), component: View }]
};
export {
  entry as default
};
