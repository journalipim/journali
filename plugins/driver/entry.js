(function(){const s=document.createElement('style');s.textContent="\n.x[data-v-040eedb9] { border: 0; background: none; color: var(--muted); padding: 0 4px; cursor: pointer;\n}\n.x[data-v-040eedb9]:hover { color: var(--accent);\n}\n.form td.attr[data-v-040eedb9] { white-space: nowrap; color: var(--muted);\n}\n";document.head.append(s)})();
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
const vModelSelect = m.vModelSelect;
const vModelText = m.vModelText;
const withDirectives = m.withDirectives;
const h = window.journali;
const api = h.api;
const store = h.store;
const dialog = h.dialog;
const filePicker = h.filePicker;
const t = h.t;
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
const _hoisted_3 = { class: "grid" };
const _hoisted_4 = { class: "muted" };
const _hoisted_5 = ["title"];
const _hoisted_6 = { class: "muted" };
const _hoisted_7 = { class: "muted" };
const _hoisted_8 = ["title"];
const _hoisted_9 = { style: { "text-align": "right", "white-space": "nowrap" } };
const _hoisted_10 = ["title", "onClick"];
const _hoisted_11 = ["title", "onClick"];
const _hoisted_12 = ["title", "onClick"];
const _hoisted_13 = ["title", "onClick"];
const _hoisted_14 = { class: "step-band" };
const _hoisted_15 = {
  key: 0,
  class: "empty"
};
const _hoisted_16 = {
  key: 1,
  class: "grid form"
};
const _hoisted_17 = { class: "attr" };
const _hoisted_18 = ["readonly", "placeholder"];
const _hoisted_19 = { class: "attr" };
const _hoisted_20 = ["placeholder"];
const _hoisted_21 = { class: "attr" };
const _hoisted_22 = ["disabled"];
const _hoisted_23 = ["value"];
const _hoisted_24 = {
  key: 0,
  class: "muted"
};
const _hoisted_25 = { class: "attr" };
const _hoisted_26 = ["onUpdate:modelValue"];
const _hoisted_27 = { value: "" };
const _hoisted_28 = { value: "ja" };
const _hoisted_29 = ["onUpdate:modelValue"];
const _hoisted_30 = { value: "" };
const _hoisted_31 = { value: "bearer" };
const _hoisted_32 = { value: "basic" };
const _hoisted_33 = { value: "header" };
const _hoisted_34 = ["onUpdate:modelValue", "placeholder", "title"];
const _hoisted_35 = { class: "attr" };
const _hoisted_36 = ["onUpdate:modelValue", "placeholder"];
const _hoisted_37 = { class: "muted" };
const _hoisted_38 = { class: "row" };
const _sfc_main = {
  __name: "View",
  setup(__props) {
    const arten = ref([]);
    const zugaenge = ref([]);
    const busy = ref("");
    const form = ref({ key: "", art: "ftp", label: "", felder: {}, geheim: {} });
    const bearbeitet = ref("");
    const art = computed(() => arten.value.find((a) => a.key === form.value.art) ?? null);
    const ARTNAME = { file: t("Dateisystem des Servers"), webdav: "WebDAV", ftp: "FTP", ixp: t("IXP (Anmeldung)"), solr: t("Solr (Anmeldung)"), http: "HTTP/REST" };
    const FELD = { url: t("Adresse"), user: t("Anwendername"), password: t("Passwort"), host: t("Rechner"), port: t("Port"), pfad: t("Startverzeichnis"), tls: t("TLS"), token: t("Token"), auth: t("Anmeldung"), header: t("Kopf"), secret: t("Geheimnis") };
    const HILFE = {
      url: t("https://… — bei WebDAV das Verzeichnis, bei IXP die Basis der API, bei Solr der Kern, bei HTTP die Basis der Schnittstelle"),
      host: t("nur der Name, ohne ftp:// und ohne Pfad"),
      port: t("leer = 21"),
      pfad: t("leer = das Verzeichnis nach der Anmeldung"),
      header: t("Name des Kopfs, in dem das Geheimnis steht — z. B. X-API-Key"),
      secret: t("Token, Schlüssel oder Passwort — bleibt beim Server")
    };
    const artName = (a) => ARTNAME[a?.key ?? a] ?? a?.label ?? a;
    const feldName = (f) => FELD[f] ?? f;
    const pruefung = ref({});
    async function pruefen(z) {
      pruefung.value = { ...pruefung.value, [z.key]: { text: "…" } };
      try {
        const r = await api.post(`/api/drivers/${encodeURIComponent(z.key)}/test`, {});
        pruefung.value = { ...pruefung.value, [z.key]: { ok: r.ok, text: r.ok ? t("erreichbar") : t("nicht erreichbar"), title: r.text } };
      } catch (e) {
        pruefung.value = { ...pruefung.value, [z.key]: { ok: false, text: t("nicht erreichbar"), title: e.message } };
      }
    }
    const anlegbar = computed(() => arten.value.filter((a) => a.key !== "file"));
    async function laden() {
      try {
        arten.value = await api.get("/api/drivers/arten");
        zugaenge.value = await api.get("/api/drivers");
        busy.value = "";
      } catch (e) {
        busy.value = "✗ " + e.message;
      }
    }
    onMounted(laden);
    function neu() {
      bearbeitet.value = "";
      form.value = { key: "", art: anlegbar.value[0]?.key ?? "", label: "", felder: {}, geheim: {} };
    }
    function bearbeiten(z) {
      bearbeitet.value = z.key;
      form.value = { key: z.key, art: z.art, label: z.label, felder: { ...z.felder ?? {} }, geheim: {} };
    }
    async function speichern() {
      const f = form.value;
      if (!f.key.trim()) {
        store.toast(t("Name des Zugangs fehlt"));
        return;
      }
      busy.value = t("speichere …");
      try {
        await api.post(`/api/drivers/${encodeURIComponent(f.key.trim())}`, { art: f.art, label: f.label, felder: f.felder, geheim: f.geheim }, "PUT");
        await laden();
        neu();
        store.toast(t("Zugang gespeichert"), "ok");
      } catch (e) {
        busy.value = "✗ " + e.message;
        store.toast(e.message);
      }
    }
    async function entfernen(z) {
      const ok = await dialog.confirm({ title: t("Zugang entfernen"), text: t("{0} — Jobs und Profile, die ihn nennen, finden ihn danach nicht mehr.", [z.label || z.key]), ok: t("Entfernen"), danger: true });
      if (!ok) return;
      try {
        await api.del(`/api/drivers/${encodeURIComponent(z.key)}`);
        await laden();
        if (bearbeitet.value === z.key) neu();
      } catch (e) {
        store.toast(e.message);
      }
    }
    function browsen(z) {
      filePicker({ dirOnly: true, title: t("📁 {0}", [z.label || z.key]), zugang: z.key, onPick: () => {
      } });
    }
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createElementVNode("div", _hoisted_2, [
          createElementVNode(
            "h1",
            null,
            toDisplayString(_ctx.$t("⌁ Zugänge")),
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
          createElementVNode("thead", null, [
            createElementVNode("tr", null, [
              createElementVNode(
                "th",
                null,
                toDisplayString(_ctx.$t("Zugang")),
                1
                /* TEXT */
              ),
              createElementVNode(
                "th",
                null,
                toDisplayString(_ctx.$t("Art")),
                1
                /* TEXT */
              ),
              createElementVNode(
                "th",
                null,
                toDisplayString(_ctx.$t("Adresse")),
                1
                /* TEXT */
              ),
              createElementVNode(
                "th",
                null,
                toDisplayString(_ctx.$t("Geheimnis")),
                1
                /* TEXT */
              ),
              _cache[4] || (_cache[4] = createElementVNode(
                "th",
                null,
                null,
                -1
                /* CACHED */
              )),
              _cache[5] || (_cache[5] = createElementVNode(
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
              renderList(zugaenge.value, (z) => {
                return openBlock(), createElementBlock(
                  "tr",
                  {
                    key: z.key,
                    class: normalizeClass({ current: bearbeitet.value === z.key })
                  },
                  [
                    createElementVNode("td", null, [
                      createTextVNode(
                        toDisplayString(z.label || z.key) + " ",
                        1
                        /* TEXT */
                      ),
                      createElementVNode(
                        "span",
                        _hoisted_4,
                        toDisplayString(z.key),
                        1
                        /* TEXT */
                      )
                    ]),
                    createElementVNode("td", null, [
                      createElementVNode("span", {
                        title: z.dateien ? _ctx.$t("liefert Dateien — mit Browser") : _ctx.$t("nur Anmeldung — keine Verzeichnisse")
                      }, toDisplayString(z.dateien ? "📁" : "⚿") + " " + toDisplayString(artName(z.art)), 9, _hoisted_5)
                    ]),
                    createElementVNode(
                      "td",
                      _hoisted_6,
                      toDisplayString(z.felder?.host || z.felder?.url || (z.key === "lokal" ? _ctx.$t("dieser Server") : "")),
                      1
                      /* TEXT */
                    ),
                    createElementVNode(
                      "td",
                      _hoisted_7,
                      toDisplayString((z.geheim ?? []).map(feldName).join(", ") || "—"),
                      1
                      /* TEXT */
                    ),
                    createElementVNode("td", {
                      class: normalizeClass(["pruef", pruefung.value[z.key]?.ok === true ? "pos" : pruefung.value[z.key]?.ok === false ? "neg" : "muted"]),
                      title: pruefung.value[z.key]?.title ?? ""
                    }, toDisplayString(pruefung.value[z.key]?.text ?? ""), 11, _hoisted_8),
                    createElementVNode("td", _hoisted_9, [
                      z.key !== "lokal" ? (openBlock(), createElementBlock("button", {
                        key: 0,
                        class: "x",
                        title: _ctx.$t("prüfen, ob der Zugang ankommt"),
                        onClick: ($event) => pruefen(z)
                      }, "⟳", 8, _hoisted_10)) : createCommentVNode("v-if", true),
                      z.dateien ? (openBlock(), createElementBlock("button", {
                        key: 1,
                        class: "x",
                        title: _ctx.$t("Verzeichnisse ansehen"),
                        onClick: ($event) => browsen(z)
                      }, "📁", 8, _hoisted_11)) : createCommentVNode("v-if", true),
                      z.key !== "lokal" ? (openBlock(), createElementBlock("button", {
                        key: 2,
                        class: "x",
                        title: _ctx.$t("ändern"),
                        onClick: ($event) => bearbeiten(z)
                      }, "✎", 8, _hoisted_12)) : createCommentVNode("v-if", true),
                      z.key !== "lokal" ? (openBlock(), createElementBlock("button", {
                        key: 3,
                        class: "x",
                        title: _ctx.$t("entfernen"),
                        onClick: ($event) => entfernen(z)
                      }, "✕", 8, _hoisted_13)) : createCommentVNode("v-if", true)
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
        ]),
        createElementVNode(
          "div",
          _hoisted_14,
          toDisplayString(bearbeitet.value ? _ctx.$t("Zugang ändern") : _ctx.$t("Neuer Zugang")),
          1
          /* TEXT */
        ),
        !anlegbar.value.length ? (openBlock(), createElementBlock(
          "div",
          _hoisted_15,
          toDisplayString(_ctx.$t("Nur das Dateisystem dieses Servers — weitere Arten kommen, sobald ihr Treiber steht.")),
          1
          /* TEXT */
        )) : (openBlock(), createElementBlock("table", _hoisted_16, [
          _cache[7] || (_cache[7] = createElementVNode(
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
              createElementVNode(
                "td",
                _hoisted_17,
                toDisplayString(_ctx.$t("Name")),
                1
                /* TEXT */
              ),
              createElementVNode("td", null, [
                withDirectives(createElementVNode("input", {
                  "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => form.value.key = $event),
                  readonly: !!bearbeitet.value,
                  placeholder: _ctx.$t("kurz, ohne Leerzeichen — z. B. archiv-ftp"),
                  style: { "width": "240px" }
                }, null, 8, _hoisted_18), [
                  [vModelText, form.value.key]
                ])
              ])
            ]),
            createElementVNode("tr", null, [
              createElementVNode(
                "td",
                _hoisted_19,
                toDisplayString(_ctx.$t("Anzeigename (optional)")),
                1
                /* TEXT */
              ),
              createElementVNode("td", null, [
                withDirectives(createElementVNode("input", {
                  "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => form.value.label = $event),
                  placeholder: _ctx.$t("wie es in der Auswahl steht"),
                  style: { "width": "240px" }
                }, null, 8, _hoisted_20), [
                  [vModelText, form.value.label]
                ])
              ])
            ]),
            createElementVNode("tr", null, [
              createElementVNode(
                "td",
                _hoisted_21,
                toDisplayString(_ctx.$t("Art")),
                1
                /* TEXT */
              ),
              createElementVNode("td", null, [
                withDirectives(createElementVNode("select", {
                  "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => form.value.art = $event),
                  disabled: !!bearbeitet.value,
                  style: { "width": "240px" }
                }, [
                  (openBlock(true), createElementBlock(
                    Fragment,
                    null,
                    renderList(anlegbar.value, (a) => {
                      return openBlock(), createElementBlock("option", {
                        key: a.key,
                        value: a.key
                      }, toDisplayString(artName(a)), 9, _hoisted_23);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ], 8, _hoisted_22), [
                  [vModelSelect, form.value.art]
                ]),
                art.value ? (openBlock(), createElementBlock(
                  "span",
                  _hoisted_24,
                  toDisplayString(" " + (art.value.dateien ? _ctx.$t("liefert Dateien") : _ctx.$t("nur Anmeldung"))),
                  1
                  /* TEXT */
                )) : createCommentVNode("v-if", true)
              ])
            ]),
            (openBlock(true), createElementBlock(
              Fragment,
              null,
              renderList(art.value?.felder ?? [], (f) => {
                return openBlock(), createElementBlock("tr", { key: f }, [
                  createElementVNode(
                    "td",
                    _hoisted_25,
                    toDisplayString(feldName(f)),
                    1
                    /* TEXT */
                  ),
                  createElementVNode("td", null, [
                    f === "tls" ? withDirectives((openBlock(), createElementBlock("select", {
                      key: 0,
                      "onUpdate:modelValue": ($event) => form.value.felder[f] = $event,
                      style: { "width": "240px" }
                    }, [
                      createElementVNode(
                        "option",
                        _hoisted_27,
                        toDisplayString(_ctx.$t("nein")),
                        1
                        /* TEXT */
                      ),
                      createElementVNode(
                        "option",
                        _hoisted_28,
                        toDisplayString(_ctx.$t("ja — explizites TLS")),
                        1
                        /* TEXT */
                      )
                    ], 8, _hoisted_26)), [
                      [vModelSelect, form.value.felder[f]]
                    ]) : f === "auth" ? withDirectives((openBlock(), createElementBlock("select", {
                      key: 1,
                      "onUpdate:modelValue": ($event) => form.value.felder[f] = $event,
                      style: { "width": "240px" }
                    }, [
                      createElementVNode(
                        "option",
                        _hoisted_30,
                        toDisplayString(_ctx.$t("ohne")),
                        1
                        /* TEXT */
                      ),
                      createElementVNode(
                        "option",
                        _hoisted_31,
                        toDisplayString(_ctx.$t("Bearer-Token")),
                        1
                        /* TEXT */
                      ),
                      createElementVNode(
                        "option",
                        _hoisted_32,
                        toDisplayString(_ctx.$t("Basic (Anwender und Geheimnis)")),
                        1
                        /* TEXT */
                      ),
                      createElementVNode(
                        "option",
                        _hoisted_33,
                        toDisplayString(_ctx.$t("eigener Kopf")),
                        1
                        /* TEXT */
                      )
                    ], 8, _hoisted_29)), [
                      [vModelSelect, form.value.felder[f]]
                    ]) : withDirectives((openBlock(), createElementBlock("input", {
                      key: 2,
                      "onUpdate:modelValue": ($event) => form.value.felder[f] = $event,
                      style: { "width": "240px" },
                      autocomplete: "off",
                      placeholder: HILFE[f] ?? "",
                      title: HILFE[f] ?? ""
                    }, null, 8, _hoisted_34)), [
                      [vModelText, form.value.felder[f]]
                    ])
                  ])
                ]);
              }),
              128
              /* KEYED_FRAGMENT */
            )),
            (openBlock(true), createElementBlock(
              Fragment,
              null,
              renderList(art.value?.geheim ?? [], (g) => {
                return openBlock(), createElementBlock("tr", { key: g }, [
                  createElementVNode(
                    "td",
                    _hoisted_35,
                    toDisplayString(feldName(g)),
                    1
                    /* TEXT */
                  ),
                  createElementVNode("td", null, [
                    withDirectives(createElementVNode("input", {
                      "onUpdate:modelValue": ($event) => form.value.geheim[g] = $event,
                      type: "password",
                      autocomplete: "new-password",
                      style: { "width": "240px" },
                      placeholder: bearbeitet.value ? _ctx.$t("hinterlegt — leer lassen, um es zu behalten") : ""
                    }, null, 8, _hoisted_36), [
                      [vModelText, form.value.geheim[g]]
                    ]),
                    createElementVNode(
                      "span",
                      _hoisted_37,
                      toDisplayString(" " + _ctx.$t("bleibt beim Server, nie im Journal")),
                      1
                      /* TEXT */
                    )
                  ])
                ]);
              }),
              128
              /* KEYED_FRAGMENT */
            )),
            createElementVNode("tr", null, [
              _cache[6] || (_cache[6] = createElementVNode(
                "td",
                { class: "attr" },
                null,
                -1
                /* CACHED */
              )),
              createElementVNode("td", null, [
                createElementVNode("div", _hoisted_38, [
                  createElementVNode(
                    "button",
                    {
                      class: "primary",
                      onClick: speichern
                    },
                    toDisplayString(bearbeitet.value ? _ctx.$t("Ändern") : _ctx.$t("Anlegen")),
                    1
                    /* TEXT */
                  ),
                  bearbeitet.value ? (openBlock(), createElementBlock(
                    "button",
                    {
                      key: 0,
                      onClick: neu
                    },
                    toDisplayString(_ctx.$t("Abbrechen")),
                    1
                    /* TEXT */
                  )) : createCommentVNode("v-if", true)
                ])
              ])
            ])
          ])
        ]))
      ]);
    };
  }
};
const View = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-040eedb9"]]);
const entry = {
  views: [{ path: "zugaenge", topic: "tools", label: t("Zugänge"), icon: "⌁", hint: t("Dateisystem, FTP, WebDAV, Anmeldungen an MySQL, Solr, IXP — einmal einrichten, von jedem Plugin nutzbar"), component: View }]
};
export {
  entry as default
};
