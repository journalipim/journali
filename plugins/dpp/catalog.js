// Katalog: Digitaler Produktpass (DPP) nach der Ökodesign-Verordnung (EU) 2024/1781 (ESPR), Art. 7/9, Anhang III —
// plus Batteriepass (EU) 2023/1542 als eigene Gruppe. Stand der Recherche 18.09.2026; die genauen Datenpunkte je
// Produktgruppe legen delegierte Rechtsakte fest (erste: Textilien, Eisen/Stahl, Möbel, Reifen, Elektronik; Batterien
// ab 18.02.2027). Dieser Katalog ist die allgemeine ESPR-Ebene — Pflicht (●) = in Anhang III / Art. 7 genannt und in
// praktisch jedem delegierten Rechtsakt erwartet; empfohlen (◐) = produktgruppenabhängig; optional (○) = freiwillig.
// Quellen: EUR-Lex 2024/1781; empact.nu „What data should be in a DPP“; dpp-tool.com „DPP data requirements“.
const YES = ['ja', 'yes', 'true', '1', 'x']
const isCountry = v => /^[A-Z]{2}$/.test(String(v).trim()) ? null : 'ISO-3166-Ländercode erwartet (DE, FR …)'
const isPercent = v => { const n = Number(String(v).replace(',', '.')); return isNaN(n) || n < 0 || n > 100 ? 'Prozent 0–100 erwartet' : null }
const isGtin = v => { const s = String(v).replace(/\s/g, ''); if (!/^\d{8}$|^\d{12,14}$/.test(s)) return 'GTIN mit 8, 12, 13 oder 14 Ziffern'; const d = s.split('').map(Number); const chk = d.pop(); const sum = d.reverse().reduce((k, x, i) => k + x * (i % 2 === 0 ? 3 : 1), 0); return (10 - sum % 10) % 10 === chk ? null : 'GTIN-Prüfziffer stimmt nicht' }
const isUrl = v => /^https?:\/\/\S+$/.test(String(v).trim()) ? null : 'URL (https://…) erwartet'

export default {
  key: 'dpp', label: 'Digitaler Produktpass (ESPR)', icon: '◈',
  source: 'https://eur-lex.europa.eu/eli/reg/2024/1781/oj', sourceLabel: 'EUR-Lex 2024/1781 ↗',
  description: 'Datenpunkte des Produktpasses nach ESPR Art. 7/9 und Anhang III. Je Datenpunkt das Attribut im Modell wählen (Best Guess vorbelegt) — oder die fehlenden anlegen; dann einen Teilbaum prüfen. Die Vorschrift gilt je Produktgruppe erst mit ihrem delegierten Rechtsakt; die Tabelle zeigt, wie weit die Daten heute tragen.',
  groupKey: 'dpp', groupLabel: 'DPP (ESPR)', prefix: 'dpp_',
  groups: [
    { key: 'id', label: 'Identifikation', items: [
      { key: 'gtin', label: 'Eindeutige Produktkennung (GTIN)', level: 'must', type: 'text', synonyms: ['gtin', 'ean', 'ean13', 'barcode', 'upc', 'artikelnummer_ean'], hint: 'ISO/IEC 15459 bzw. GS1; Träger ist QR/Data-Matrix am Produkt', rule: isGtin, roles: ['product', 'variant'] },
      { key: 'model_number', label: 'Modell-/Typbezeichnung', level: 'must', type: 'text', synonyms: ['modell', 'model', 'typ', 'type', 'model_number', 'modellnummer', 'artikelnummer', 'sku'], derive: row => row.sku ?? null, deriveWhy: 'aus der SKU' },
      { key: 'trade_name', label: 'Handelsname', level: 'must', type: 'text', synonyms: ['name', 'bezeichnung', 'handelsname', 'trade_name', 'produktname', 'title'], perLocale: true, derive: row => row.label, deriveWhy: 'aus dem Namen im Baum' },
      { key: 'batch', label: 'Charge / Los', level: 'should', type: 'text', synonyms: ['charge', 'batch', 'lot', 'losnummer'], roles: ['variant'], hint: 'Passebene: Modell, Charge oder Einzelstück — legt der Rechtsakt fest' },
      { key: 'commodity_code', label: 'Zolltarifnummer (TARIC/HS)', level: 'should', type: 'text', synonyms: ['zolltarifnummer', 'taric', 'hs_code', 'commodity_code', 'warennummer', 'zolltarif'], rule: v => /^\d{6,10}$/.test(String(v).replace(/\s/g, '')) ? null : '6–10 Ziffern erwartet' },
      { key: 'facility_id', label: 'Kennung der Fertigungsstätte', level: 'should', type: 'text', synonyms: ['facility', 'werk', 'fertigungsstaette', 'plant', 'facility_id', 'ufi'], hint: 'Unique Facility Identifier' },
    ] },
    { key: 'operator', label: 'Wirtschaftsakteure', items: [
      { key: 'manufacturer', label: 'Hersteller (Name)', level: 'must', type: 'text', synonyms: ['hersteller', 'manufacturer', 'marke', 'brand', 'producer'], inheritable: true },
      { key: 'manufacturer_address', label: 'Hersteller (Anschrift)', level: 'must', type: 'text', synonyms: ['hersteller_adresse', 'manufacturer_address', 'anschrift_hersteller', 'address'], inheritable: true },
      { key: 'manufacturer_contact', label: 'Hersteller (elektronischer Kontakt)', level: 'must', type: 'text', synonyms: ['hersteller_kontakt', 'manufacturer_contact', 'email_hersteller', 'kontakt', 'contact'], inheritable: true, rule: v => /@|https?:\/\//.test(String(v)) ? null : 'E-Mail oder URL erwartet' },
      { key: 'operator_id', label: 'Kennung des Wirtschaftsakteurs (EORI/UOI)', level: 'should', type: 'text', synonyms: ['eori', 'uoi', 'operator_id', 'eori_nummer'], inheritable: true, rule: v => /^[A-Z]{2}[A-Z0-9]{1,15}$/.test(String(v).replace(/\s/g, '')) ? null : 'EORI: Ländercode + bis 15 Zeichen' },
      { key: 'importer', label: 'Importeur (Name, Anschrift, EORI)', level: 'should', type: 'text', synonyms: ['importeur', 'importer', 'einfuehrer'], inheritable: true, hint: 'nur bei Einfuhr in die EU' },
      { key: 'country_of_origin', label: 'Herstellungsland', level: 'must', type: 'text', synonyms: ['herstellungsland', 'ursprungsland', 'country_of_origin', 'made_in', 'origin', 'herkunftsland', 'land'], inheritable: true, rule: isCountry },
      { key: 'manufacture_date', label: 'Herstellungsdatum', level: 'should', type: 'date', synonyms: ['herstellungsdatum', 'manufacture_date', 'production_date', 'produktionsdatum', 'baujahr'], roles: ['variant'] },
    ] },
    { key: 'compliance', label: 'Konformität und Dokumente', items: [
      { key: 'doc_conformity', label: 'EU-Konformitätserklärung (Link/Dokument)', level: 'must', type: 'text', synonyms: ['konformitaetserklaerung', 'declaration_of_conformity', 'doc', 'ce_erklaerung', 'eu_doc'], rule: isUrl, hint: 'Link auf das Dokument oder Medium-Relation „document“' },
      { key: 'technical_doc', label: 'Technische Dokumentation', level: 'should', type: 'text', synonyms: ['technische_dokumentation', 'technical_documentation', 'datenblatt_url', 'datasheet'], rule: isUrl },
      { key: 'manual', label: 'Bedienungsanleitung (digital)', level: 'must', type: 'text', synonyms: ['bedienungsanleitung', 'anleitung', 'manual', 'user_manual', 'gebrauchsanweisung', 'handbuch'], rule: isUrl, perLocale: true },
      { key: 'safety', label: 'Sicherheitshinweise / Warnungen', level: 'must', type: 'html', synonyms: ['sicherheitshinweise', 'safety', 'warnhinweise', 'warnings', 'safety_information'], perLocale: true },
      { key: 'standards', label: 'Angewandte Normen', level: 'should', type: 'text', synonyms: ['normen', 'standards', 'harmonisierte_normen', 'applied_standards'] },
      { key: 'ecolabel', label: 'EU-Umweltzeichen', level: 'may', type: 'boolean', synonyms: ['umweltzeichen', 'ecolabel', 'eu_ecolabel', 'blauer_engel'] },
    ] },
    { key: 'material', label: 'Material und Stoffe', items: [
      { key: 'material_composition', label: 'Materialzusammensetzung (Anteile nach Gewicht)', level: 'must', type: 'text', synonyms: ['material', 'materialzusammensetzung', 'material_composition', 'werkstoff', 'werkstoffe', 'zusammensetzung', 'materials'], hint: 'z. B. „Aluminium 62 %, PA6 30 %, Stahl 8 %“' },
      { key: 'substances_of_concern', label: 'Besorgniserregende Stoffe (SVHC/REACH)', level: 'must', type: 'text', synonyms: ['svhc', 'reach', 'besorgniserregende_stoffe', 'substances_of_concern', 'scip', 'gefahrstoffe', 'schadstoffe'], hint: 'Stoff, CAS-Nr., Konzentration (> 0,1 % w/w) und Ort im Produkt; „keine“ ist eine gültige Angabe' },
      { key: 'recycled_content', label: 'Rezyklatanteil (%)', level: 'must', type: 'decimal', unit: '%', synonyms: ['rezyklatanteil', 'recycled_content', 'recyclinganteil', 'rezyklat', 'recycled'], rule: isPercent },
      { key: 'weight', label: 'Gewicht (kg)', level: 'should', type: 'decimal', unit: 'kg', synonyms: ['gewicht', 'weight', 'nettogewicht', 'masse', 'gewicht_netto', 'net_weight'], rule: v => Number(String(v).replace(',', '.')) > 0 ? null : 'Gewicht > 0 erwartet' },
    ] },
    { key: 'environment', label: 'Umwelt und Leistung', items: [
      { key: 'carbon_footprint', label: 'CO₂-Fußabdruck (kg CO₂e)', level: 'must', type: 'decimal', unit: 'kg CO2e', synonyms: ['co2', 'co2_fussabdruck', 'carbon_footprint', 'pcf', 'klimabilanz', 'treibhausgas', 'co2e'], hint: 'je funktionelle Einheit, Methode PEF/ISO 14067' },
      { key: 'energy_class', label: 'Energieeffizienzklasse', level: 'should', type: 'enum', values: ['A', 'B', 'C', 'D', 'E', 'F', 'G'], synonyms: ['energieeffizienzklasse', 'energy_class', 'energielabel', 'effizienzklasse', 'energy_efficiency_class'], rule: v => /^[A-G]$/.test(String(v).trim().toUpperCase()) ? null : 'A–G erwartet' },
      { key: 'energy_consumption', label: 'Energieverbrauch (kWh)', level: 'may', type: 'decimal', unit: 'kWh', synonyms: ['energieverbrauch', 'energy_consumption', 'stromverbrauch', 'leistungsaufnahme'] },
      { key: 'durability', label: 'Haltbarkeit / erwartete Lebensdauer', level: 'should', type: 'text', synonyms: ['lebensdauer', 'haltbarkeit', 'durability', 'lifetime', 'expected_lifetime', 'nutzungsdauer'] },
      { key: 'water_use', label: 'Wasserverbrauch', level: 'may', type: 'decimal', unit: 'l', synonyms: ['wasserverbrauch', 'water_use', 'water_consumption'] },
    ] },
    { key: 'circularity', label: 'Kreislauffähigkeit', items: [
      { key: 'repairability', label: 'Reparierbarkeitsindex', level: 'should', type: 'decimal', synonyms: ['reparierbarkeit', 'repairability', 'reparatur_index', 'repair_score', 'reparierbarkeitsindex'], rule: v => { const n = Number(String(v).replace(',', '.')); return n >= 0 && n <= 10 ? null : 'Index 0–10 erwartet' } },
      { key: 'spare_parts', label: 'Ersatzteile (Verfügbarkeit, Dauer)', level: 'should', type: 'text', synonyms: ['ersatzteile', 'spare_parts', 'ersatzteilverfuegbarkeit', 'spare_parts_availability'] },
      { key: 'disassembly', label: 'Demontageanleitung', level: 'should', type: 'text', synonyms: ['demontage', 'disassembly', 'zerlegung', 'disassembly_instructions'], rule: isUrl },
      { key: 'recyclability', label: 'Recyclingfähigkeit', level: 'should', type: 'text', synonyms: ['recyclingfaehigkeit', 'recyclability', 'recycelbar', 'recyclable'] },
      { key: 'end_of_life', label: 'Entsorgung / Rücknahme', level: 'must', type: 'html', synonyms: ['entsorgung', 'end_of_life', 'ruecknahme', 'take_back', 'disposal', 'weee', 'altgeraet'], perLocale: true, hint: 'Hinweise zur Entsorgung, Rücknahmestellen, WEEE-Reg.-Nr.' },
      { key: 'hazardous_components', label: 'Gefährliche Bauteile (Lage, Entnahme)', level: 'should', type: 'text', synonyms: ['gefaehrliche_bauteile', 'hazardous_components', 'batterie_entnahme'] },
    ] },
    { key: 'battery', label: 'Batteriepass (EU 2023/1542, ab 18.02.2027 — nur Batterien > 2 kWh, LMT, Industrie, E-Fahrzeug)', scope: { key: 'battery', label: 'Batteriepass', hint: 'nur Batterien > 2 kWh, LMT, Industrie, E-Fahrzeug (EU 2023/1542)' }, items: [
      { key: 'battery_chemistry', label: 'Batteriechemie', level: 'should', type: 'text', synonyms: ['batteriechemie', 'battery_chemistry', 'zellchemie', 'chemistry', 'akku_typ', 'akkutyp'], appliesIf: r => isBattery(r) },
      { key: 'battery_capacity', label: 'Nennkapazität (kWh)', level: 'should', type: 'decimal', unit: 'kWh', synonyms: ['nennkapazitaet', 'rated_capacity', 'kapazitaet', 'akku_kapazitaet', 'capacity', 'battery_capacity'], appliesIf: r => isBattery(r) },
      { key: 'battery_cycles', label: 'Zyklenfestigkeit', level: 'should', type: 'integer', synonyms: ['zyklen', 'cycle_life', 'ladezyklen', 'zyklenfestigkeit'], appliesIf: r => isBattery(r) },
      { key: 'battery_recycled', label: 'Rezyklat Co/Li/Ni/Pb (%)', level: 'may', type: 'text', synonyms: ['rezyklat_kobalt', 'recycled_cobalt', 'recycled_lithium', 'rezyklat_batterie'], appliesIf: r => isBattery(r), hint: 'Pflicht ab 08/2028; Mindestanteile ab 08/2031' },
      { key: 'battery_soh', label: 'Gesundheitszustand (SoH)', level: 'may', type: 'text', synonyms: ['soh', 'state_of_health', 'gesundheitszustand'], appliesIf: r => isBattery(r), hint: 'dynamischer Teil des Passes — kommt aus dem BMS, nicht aus dem PIM' },
    ] },
  ],
}
// Batterie-Datenpunkte nur, wo es um Batterien geht: Name/Gruppe deutet darauf hin oder ein Batterie-Attribut ist gefüllt
function isBattery(r) { const s = `${r.row.label} ${r.row.parent ?? ''}`.toLowerCase(); return /akku|batter|battery|zelle|cell|powerbank/.test(s) }
