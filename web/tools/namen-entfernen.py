"""Namen und Zitate aus Quelltext, Kommentaren und Dokumenten entfernen — das Projekt ist abstrakt.

Entfernt: „(Taloan, 23.09.2026: „…“)“ samt Varianten, Zitate mit Namen, Nennungen fremder Produkte als Massstab.
Behält: technische Namen angebundener Systeme (Solr, Excel, OnlyOffice, DeepL, ETIM, Postgres, Docker).
    python web/tools/namen-entfernen.py [--dry]
"""
import os, re, sys
sys.stdout.reconfigure(encoding='utf-8')

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DRY = '--dry' in sys.argv
EXT = ('.cs', '.js', '.mjs', '.vue', '.md', '.json', '.css', '.html')
SKIP_DIRS = {'node_modules', 'bin', 'obj', 'wwwroot', '.git', 'public', 'jobs', 'site'}   # site: Impressum nennt den Verantwortlichen, das muss es
SKIP_FILES = {'package-lock.json', 'namen-entfernen.py'}

# Reihenfolge ist wichtig — vom Speziellen zum Allgemeinen. Jede Regel: (Muster, Ersatz)
RULES = [
    # Klammer, die mit dem Namen beginnt: (Taloan, 24.09.2026: „…“) · (Taloan 21.09.) · (Taloan) · (Taloan, 23.09.2026, Teams)
    (re.compile(r'\s*\(\s*Taloan\b(?:[^()]|\([^()]*\))*\)'), ''),
    # Klammer, in der der Name nach einem Trenner kommt: (…, Taloan 17.09.) · (… — Taloan, 20.09.: …) · (?x=true, Taloan 21.09.: …)
    (re.compile(r'\s*[,;—–-]\s*Taloan\b(?:[^()]|\([^()]*\))*(?=\))'), ''),
    # Zitat mit Namen bis zum Zeilenende: — Taloan: „…“ / Taloan: „…“
    (re.compile(r'\s*[—–-]\s*Taloan\s*:[^\n]*'), ''),
    # Name mit Datum in Zeilen ohne Klammer: ", Taloan 21.09.)" wurde oben behandelt; hier "Taloan, 22.09.2026:" am Satzanfang
    (re.compile(r'\bTaloan,?[^\S\n]+\d\d\.\d\d\.(?:\d{4})?:?[^\S\n]*'), ''),   # nie über das Zeilenende hinaus
    (re.compile(r'\bTaloans\b'), 'die'),
    # Zitat als eigener Absatz oder Satz: Taloan: „…“ bis zum Zeilenende
    (re.compile(r'^\s*Taloan\s*:\s*[„"][^\n]*\n?', re.M), ''),
    (re.compile(r'\bTaloan\s*:\s*[„"][^\n]*'), ''),
    # Formulierungen um den Namen herum
    (re.compile(r'\*\*Entscheidung Taloan \(([^)]*)\):\*\*'), r'**Entscheidung (\1):**'),
    (re.compile(r'Entscheidungen von Taloan sind als solche markiert'), 'Entscheidungen sind als solche markiert'),
    (re.compile(r'Entscheidung(en)? von Taloan'), r'Entscheidung\1'),
    (re.compile(r',\s*Taloan\s*$', re.M), ''),
    (re.compile(r'"taloan"\);\s*// Taloan hat'), '"u1"); // u1 hat'),
    (re.compile(r'// Baum wie bei Taloan:'), '// Baum:'),
    (re.compile(r'// die Kennzahl oben: Wortlaut von Taloan \([^)]*\)'), '// die Kennzahl oben: fester Wortlaut'),
    (re.compile(r"\{ name: 'Taloan' \}\), 'Hallo Taloan'"), "{ name: 'Welt' }), 'Hallo Welt'"),
    (re.compile(r"user: 'taloan'"), "user: 'u1'"),
    (re.compile(r"key: 'taloan'"), "key: 'u1'"),
    (re.compile(r"name: 'Taloan'"), "name: 'U1'"),
    (re.compile(r"assert\.match\(t, /Taloan/"), "assert.match(t, /U1/"),
    (re.compile(r'eine Entscheidung von Taloan, nicht eine Bequemlichkeit'), 'eine Entscheidung, nicht eine Bequemlichkeit'),
    (re.compile(r'— Entscheidung Taloan;'), '—'),
    (re.compile(r'Taloan ist alleiniger Entwickler und schreibt deutsch\.'), 'Ein Entwickler, Projektsprache Deutsch.'),
    (re.compile(r'nicht Taloan klicken lassen'), 'nicht von Hand klicken lassen'),
    (re.compile(r', die Taloan aus einer [^\n]*?nachgereicht'), ', die nachgereicht wurden'),
    (re.compile(r'Hamsterrad, das Taloan beschreibt'), 'Hamsterrad'),
    (re.compile(r'Was Taloan schon geändert hat'), 'Was schon geändert wurde'),
    (re.compile(r'auch wenn Taloan es zurückgezogen hat'), 'auch wenn es zurückgezogen wurde'),
    (re.compile(r'den Fall, den Taloan beschrieben hat: [„"][^“"]*[“"]'), 'den Fall der Vervielfältigung'),
    (re.compile(r'das Leck, das Taloan selbst gesehen hat: [„"][^“"]*[“"]'), 'das Leck'),
    (re.compile(r'// Filter am Knoten; Namen von Taloan'), '// Filter am Knoten'),
    (re.compile(r'// Taloan \(17\.09\.\): '), '// '),
    (re.compile(r'Taloan: Binärdaten nicht in die Datenbank'), 'Binärdaten nicht in die Datenbank'),
    (re.compile(r'\bvon Taloan, bevor sie online gehen\.'), 'bevor sie online gehen.'),
    (re.compile(r'by:Taloan'), 'by:<name>'),
    (re.compile(r'Users\.Stream \+ "taloan"'), 'Users.Stream + "u1"'),
    (re.compile(r'new UserDefined\("Taloan"'), 'new UserDefined("U1"'),
    (re.compile(r'"solr_import", "taloan"\); // Taloan hat'), '"solr_import", "u1"); // u1 hat'),
    (re.compile(r'\("Taloan"\)'), '("u1")'),
    # Fremde Produkte als Massstab
    (re.compile(r'\s*\(aus dem OpenDXP-Vergleich[^)]*\)'), ''),
    (re.compile(r'\s*\(OpenDXP-Vergleich[^)]*\)'), ''),
    (re.compile(r'OpenDXP-Vergleich'), 'Vergleich mit anderen Systemen'),
    (re.compile(r'\bOpen ?DXP\b'), 'ein anderes PIM'),
    (re.compile(r'\((Vorbild|wie) (Pimcore|Akeneo|Ergonode|OpenPIM)[^)]*\)'), ''),
    (re.compile(r'\b(Pimcore|Akeneo|Ergonode|OpenPIM|viaMedici|Contentserv|Salsify)\b'), 'andere Systeme'),
    (re.compile(r'infolox/prodexa-Export'), 'Export eines anderen PIM'),
    (re.compile(r'\((infolox|prodexa)\)'), ''),
    (re.compile(r'\b(der|die|das) infolox IXP-API'), r'\1 IXP-API'),
    (re.compile(r'\binfolox IXP\b'), 'IXP'),
    (re.compile(r'\b(infolox|prodexa)\b[-/]?'), ''),
    (re.compile(r'\bSAP-Import\b'), 'ERP-Import'),
    (re.compile(r'\bSAP-Materialstatus\b'), 'Materialstatus des ERP'),
    (re.compile(r'\bSAP\b'), 'ERP'),
]
# Aufräumen nur an den Stellen, an denen etwas entfernt wurde — nie pauschal (leere Klammern und Einrückungen sind Code!)
CLEAN = [
    (re.compile(r'[^\S\n]+$', re.M), ''),   # Leerraum am Zeilenende, der durch das Entfernen entstand
]

def bereinige(text):
    out = text
    for rx, rep in RULES: out = rx.sub(rep, out)
    for rx, rep in CLEAN: out = rx.sub(rep, out)
    return out

def walk():
    for root, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in files:
            if f.endswith(EXT) and f not in SKIP_FILES:
                yield os.path.join(root, f)

geaendert = 0; rest = []
for fp in walk():
    raw = open(fp, 'rb').read()
    try: text = raw.decode('utf-8-sig')
    except UnicodeDecodeError: continue
    if not re.search(r'Taloan|OpenDXP|Open DXP|Pimcore|Akeneo|Ergonode|OpenPIM|viaMedici|infolox|prodexa|\bSAP\b', text): continue
    bom = raw.startswith(b'\xef\xbb\xbf')
    neu = bereinige(text)
    if neu != text:
        geaendert += 1
        if not DRY: open(fp, 'wb').write((b'\xef\xbb\xbf' if bom else b'') + neu.encode('utf-8'))
    for i, line in enumerate(neu.split('\n'), 1):
        if re.search(r'\bTaloan\b|OpenDXP|Pimcore|Akeneo|Ergonode|OpenPIM|viaMedici|infolox|prodexa|\bSAP\b', line):
            rest.append(f'{os.path.relpath(fp, ROOT)}:{i}: {line.strip()[:150]}')
print(f'{geaendert} Dateien{" (nur gezeigt)" if DRY else " geändert"}')
if rest:
    print(f'\nBleibt zur Durchsicht ({len(rest)}):')
    for r in rest: print('  ' + r)
