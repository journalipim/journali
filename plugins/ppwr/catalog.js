// Katalog: Verpackungsverordnung (EU) 2025/40 (PPWR), gilt ab 12.08.2026. Datenpunkte je verpacktem Produkt bzw.
// je Verpackung (Verkaufs-, Um-, Transportverpackung) — was ein Inverkehrbringer belegen und beschriften muss:
// Art. 5 Stoffe (Pb+Cd+Hg+Cr(VI) ≤ 100 mg/kg; PFAS in Lebensmittelkontakt-Verpackung ab 12.08.2026), Art. 6 Recycling-
// fähigkeit (Leistungsklassen A ≥ 95 %, B ≥ 80 %, C ≥ 70 % ab 2030; unter C nicht mehr verkehrsfähig, ab 2038 mindestens B),
// Art. 7 Rezyklat in Kunststoff (2030: PET-kontaktsensitiv 30 %, andere kontaktsensitiv 10 %, Einweg-Getränkeflaschen 30 %,
// sonstige 35 %), Art. 10 Minimierung, Art. 11 wiederverwendbar, Art. 12 Kennzeichnung (harmonisiertes Materiallabel ab
// 12.08.2028, Wiederverwendbarkeits-Label, QR/Data Carrier), Art. 24 Leerraum ≤ 50 % bei Um-/Transport-/Versandverpackung
// (ab 2030), Art. 15/39/44 Konformitätserklärung, technische Unterlagen, Herstellerregister (EPR).
// Stand der Recherche 18.09.2026 — Quellen: EUR-Lex 2025/40; Gleiss Lutz „Key requirements from August 2026“; compliancegate.com.
const isPercent = v => { const n = Number(String(v).replace(',', '.')); return isNaN(n) || n < 0 || n > 100 ? 'Prozent 0–100 erwartet' : null }
const MATERIALS = ['PET', 'HDPE', 'PVC', 'LDPE', 'PP', 'PS', 'Kunststoff sonstig', 'Papier/Karton', 'Wellpappe', 'Glas', 'Aluminium', 'Weissblech/Stahl', 'Holz', 'Textil', 'Verbund']
const isYesNo = v => ['true', 'false', 'ja', 'nein', 'yes', 'no'].includes(String(v).trim().toLowerCase()) ? null : 'ja/nein erwartet'

export default {
  key: 'ppwr', label: 'Verpackung (PPWR)', icon: '📦',
  source: 'https://eur-lex.europa.eu/eli/reg/2025/40/oj', sourceLabel: 'EUR-Lex 2025/40 ↗',
  description: 'Verpackungsdaten nach PPWR — je Produkt: Materialien und Gewichte der Verpackungsbestandteile, Rezyklatanteil, Recyclingfähigkeitsklasse, Wiederverwendbarkeit, Leerraum, Stoffgrenzen, Kennzeichnung, Register. Attribute wählen oder anlegen, dann einen Teilbaum prüfen.',
  groupKey: 'ppwr', groupLabel: 'Verpackung (PPWR)', prefix: 'pack_',
  groups: [
    { key: 'unit', label: 'Verpackungseinheit', items: [
      { key: 'pack_id', label: 'Kennung der Verpackung (Typ/Charge/Serie)', level: 'must', type: 'text', synonyms: ['verpackungskennung', 'packaging_id', 'pack_id', 'verpackung_typ', 'packaging_type_number'], hint: 'Art. 12: Typ-, Chargen- oder Seriennummer an der Verpackung', roles: ['product', 'variant'] },
      { key: 'pack_kind', label: 'Verpackungsart', level: 'must', type: 'enum', values: ['Verkaufsverpackung', 'Umverpackung', 'Transportverpackung', 'Versandverpackung', 'Serviceverpackung'], synonyms: ['verpackungsart', 'packaging_kind', 'packaging_category', 'verpackungstyp'], roles: ['product', 'variant'] },
      { key: 'pack_weight', label: 'Verpackungsgewicht gesamt (g)', level: 'must', type: 'decimal', unit: 'g', synonyms: ['verpackungsgewicht', 'packaging_weight', 'gewicht_verpackung', 'tara', 'tare', 'pack_weight'], rule: v => Number(String(v).replace(',', '.')) > 0 ? null : 'Gewicht > 0 erwartet', roles: ['product', 'variant'] },
      { key: 'pack_dimensions', label: 'Verpackungsmaße (L×B×H mm)', level: 'should', type: 'text', synonyms: ['verpackungsmasse', 'packaging_dimensions', 'kartonmasse', 'abmessung_verpackung', 'pack_dimensions'] },
      { key: 'pack_count', label: 'Stück je Verpackungseinheit', level: 'should', type: 'integer', synonyms: ['ve', 'verpackungseinheit', 'stueck_je_ve', 'units_per_pack', 'pack_count', 'menge_je_ve'] },
    ] },
    { key: 'material', label: 'Material (Art. 6, 7, 12)', items: [
      { key: 'pack_material', label: 'Hauptmaterial', level: 'must', type: 'enum', values: MATERIALS, synonyms: ['verpackungsmaterial', 'packaging_material', 'material_verpackung', 'pack_material'], hint: 'Materialkategorie für Label und Recyclingfähigkeit; Kunststoffe nach Art (PET, HDPE …)' },
      { key: 'pack_components', label: 'Bestandteile (Material, Gewicht je Teil)', level: 'must', type: 'text', synonyms: ['verpackungsbestandteile', 'packaging_components', 'pack_components', 'verpackung_bestandteile'], hint: 'z. B. „Faltschachtel Wellpappe 120 g; Inlay PE-Schaum 18 g; Beutel LDPE 4 g“ — trennbare Teile einzeln' },
      { key: 'pack_recycled', label: 'Rezyklatanteil Kunststoff (%)', level: 'must', type: 'decimal', unit: '%', synonyms: ['rezyklatanteil_verpackung', 'packaging_recycled_content', 'pack_recycled', 'pcr'], rule: isPercent, appliesIf: r => isPlastic(r), hint: 'Art. 7, ab 2030: PET kontaktsensitiv 30 %, sonstige Kunststoffe 35 % (kontaktsensitiv 10 %), Getränkeflaschen 30 %' },
      { key: 'pack_recyclability', label: 'Recyclingfähigkeitsklasse', level: 'must', type: 'enum', values: ['A', 'B', 'C', 'nicht recyclingfähig'], synonyms: ['recyclingfaehigkeit_verpackung', 'packaging_recyclability', 'recyclability_grade', 'pack_recyclability', 'recyclingklasse'], rule: v => /^(A|B|C|nicht recyclingfähig)$/i.test(String(v).trim()) ? null : 'A, B, C oder „nicht recyclingfähig“', hint: 'Art. 6: A ≥ 95 %, B ≥ 80 %, C ≥ 70 % recyclingfähig (ab 2030); ab 2038 mindestens B' },
      { key: 'pack_recyclable_share', label: 'Recyclingfähiger Anteil (%)', level: 'should', type: 'decimal', unit: '%', synonyms: ['recyclingfaehiger_anteil', 'recyclable_share', 'pack_recyclable_share'], rule: isPercent, derive: (row, v) => v.pack_recyclability ? ({ A: 95, B: 80, C: 70 })[String(v.pack_recyclability).toUpperCase()] ?? null : null, deriveWhy: 'Untergrenze der Klasse' },
      { key: 'pack_compostable', label: 'Kompostierbar', level: 'may', type: 'boolean', synonyms: ['kompostierbar', 'compostable', 'biologisch_abbaubar'] },
    ] },
    { key: 'reuse', label: 'Wiederverwendung und Minimierung (Art. 10, 11, 24)', items: [
      { key: 'pack_reusable', label: 'Wiederverwendbar (Mehrweg)', level: 'must', type: 'boolean', synonyms: ['mehrweg', 'wiederverwendbar', 'reusable', 'pack_reusable'], rule: isYesNo, hint: 'Art. 11: mit Wiederverwendungssystem; Label ab 12.08.2028' },
      { key: 'pack_empty_space', label: 'Leerraumanteil (%)', level: 'should', type: 'decimal', unit: '%', synonyms: ['leerraum', 'empty_space', 'leerraumanteil', 'void_ratio', 'pack_empty_space'], rule: v => { const p = isPercent(v); if (p) return p; return Number(String(v).replace(',', '.')) > 50 ? 'über 50 % — Art. 24 (ab 2030) verletzt' : null }, appliesIf: r => isTransport(r), hint: 'Art. 24: Um-, Transport-, Versandverpackung höchstens 50 % Leerraum (ab 2030)' },
      { key: 'pack_minimised', label: 'Minimierung belegt (Anhang IV)', level: 'should', type: 'boolean', synonyms: ['minimierung', 'packaging_minimised', 'pack_minimised'], hint: 'Art. 10: Gewicht/Volumen auf das Nötige beschränkt, Nachweis in den technischen Unterlagen' },
    ] },
    { key: 'substances', label: 'Stoffe (Art. 5)', items: [
      { key: 'pack_heavy_metals', label: 'Pb+Cd+Hg+Cr(VI) (mg/kg)', level: 'must', type: 'decimal', unit: 'mg/kg', synonyms: ['schwermetalle', 'heavy_metals', 'pack_heavy_metals', 'blei_cadmium_quecksilber_chrom'], rule: v => Number(String(v).replace(',', '.')) <= 100 ? null : 'über 100 mg/kg — Art. 5 verletzt', hint: 'Summe höchstens 100 mg/kg' },
      { key: 'pack_pfas', label: 'PFAS-frei (Lebensmittelkontakt)', level: 'should', type: 'boolean', synonyms: ['pfas', 'pfas_frei', 'pfas_free', 'pack_pfas'], rule: isYesNo, hint: 'ab 12.08.2026 Grenzwerte für PFAS in Lebensmittelkontakt-Verpackung' },
      { key: 'pack_food_contact', label: 'Lebensmittelkontakt', level: 'should', type: 'boolean', synonyms: ['lebensmittelkontakt', 'food_contact', 'kontaktsensitiv', 'pack_food_contact'] },
    ] },
    { key: 'label', label: 'Kennzeichnung und Nachweise (Art. 12, 15, 39, 44)', items: [
      { key: 'pack_label', label: 'Materiallabel / Sortierhinweis vorhanden', level: 'should', type: 'boolean', synonyms: ['materiallabel', 'sortierhinweis', 'packaging_label', 'pack_label', 'kennzeichnung_verpackung'], hint: 'harmonisiertes Piktogramm ab 12.08.2028; bis dahin nationale Kennzeichnung (z. B. Triman)' },
      { key: 'pack_qr', label: 'QR/Data Carrier (Sortierung, EPR)', level: 'may', type: 'text', synonyms: ['qr', 'qr_code', 'data_carrier', 'pack_qr', 'digital_link'] },
      { key: 'pack_doc', label: 'Konformitätserklärung (Anhang VIII)', level: 'must', type: 'text', synonyms: ['konformitaetserklaerung_verpackung', 'packaging_doc', 'pack_doc', 'doc_verpackung'], hint: 'Link/Dokument; Aufbewahrung 5 Jahre (Einweg), 10 Jahre (Mehrweg)', inheritable: true },
      { key: 'pack_epr', label: 'Herstellerregister-Nr. (EPR, z. B. LUCID)', level: 'must', type: 'text', synonyms: ['lucid', 'epr', 'registrierungsnummer', 'herstellerregister', 'pack_epr', 'verpackungsregister'], inheritable: true, rule: v => String(v).trim().length >= 6 ? null : 'Registrierungsnummer erwartet (LUCID: DE + 13 Ziffern)' },
      { key: 'pack_producer', label: 'Inverkehrbringer (Name, Anschrift, Kontakt)', level: 'must', type: 'text', synonyms: ['inverkehrbringer', 'producer', 'hersteller', 'manufacturer', 'pack_producer'], inheritable: true },
    ] },
  ],
}
function isPlastic(r) { return true }   // ohne Materialangabe nicht entscheidbar — prüfen; leer bleibt „leer“, nicht „n/a“
function isTransport(r) { return true }
