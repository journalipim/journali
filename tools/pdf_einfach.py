"""
Ein einfaches PDF ohne Paket: A4, die Standardschrift Helvetica (normal und fett, WinAnsi), Überschriften, Absätze, Aufzählungen und
zweispaltige Tabellen, Kopf- und Fusszeile je Seite. Für die Unterlagen der Demo-Daten (demo_master_tree.py) — der Job docs liest daraus
Abschnitte mit Seite und Überschrift, wie aus jedem anderen PDF mit Textebene.

Kein Zeitstempel im Dokument: dieselben Angaben ergeben dieselben Bytes, also denselben Hash — ein zweiter Lauf lädt nichts doppelt hoch.
"""
from __future__ import annotations

# Breiten der Helvetica in 1/1000 em (Standardwerte der Schrift); fehlende Zeichen rechnen mit 556
_W = {" ": 278, "!": 278, '"': 355, "#": 556, "$": 556, "%": 889, "&": 667, "'": 191, "(": 333, ")": 333, "*": 389, "+": 584,
      ",": 278, "-": 333, ".": 278, "/": 278, ":": 278, ";": 278, "<": 584, "=": 584, ">": 584, "?": 556, "@": 1015,
      "A": 667, "B": 667, "C": 722, "D": 722, "E": 667, "F": 611, "G": 778, "H": 722, "I": 278, "J": 500, "K": 667, "L": 556,
      "M": 833, "N": 722, "O": 778, "P": 667, "Q": 778, "R": 722, "S": 667, "T": 611, "U": 722, "V": 667, "W": 944, "X": 667,
      "Y": 667, "Z": 611, "[": 278, "\\": 278, "]": 278, "_": 556, "a": 556, "b": 556, "c": 500, "d": 556, "e": 556, "f": 278,
      "g": 556, "h": 556, "i": 222, "j": 222, "k": 500, "l": 222, "m": 833, "n": 556, "o": 556, "p": 556, "q": 556, "r": 333,
      "s": 500, "t": 278, "u": 556, "v": 500, "w": 722, "x": 500, "y": 500, "z": 500, "ä": 556, "ö": 556, "ü": 556, "Ä": 667,
      "Ö": 778, "Ü": 722, "ß": 611, "–": 556, "—": 1000, "„": 333, "“": 333, "”": 333, "•": 350, "°": 400, "²": 333, "×": 584,
      "€": 556, "…": 1000, "’": 222, "‘": 222, "|": 260}
_WIN = {"€": 0x80, "‚": 0x82, "„": 0x84, "…": 0x85, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "™": 0x99}

A4 = (595.0, 842.0)
LINKS, RECHTS, OBEN, UNTEN = 56.0, 56.0, 64.0, 64.0
BREITE = A4[0] - LINKS - RECHTS


def breite(text: str, groesse: float, fett: bool = False) -> float:
    return sum(_W.get(ch, 556) for ch in text) * groesse / 1000 * (1.06 if fett else 1.0)


def _bytes(text: str) -> bytes:
    out = bytearray()
    for ch in text:
        b = _WIN.get(ch)
        if b is None:
            b = ord(ch) if ord(ch) < 256 else ord("?")
        if b in (0x28, 0x29, 0x5C):   # ( ) \ maskieren
            out.append(0x5C)
        out.append(b)
    return bytes(out)


def umbrechen(text: str, groesse: float, max_breite: float, fett: bool = False) -> list[str]:
    zeilen, zeile = [], ""
    for wort in text.split():
        probe = (zeile + " " + wort).strip()
        if breite(probe, groesse, fett) <= max_breite or not zeile:
            zeile = probe
        else:
            zeilen.append(zeile)
            zeile = wort
    if zeile:
        zeilen.append(zeile)
    return zeilen


class Pdf:
    """Ein Dokument, das sich von oben nach unten füllt; eine neue Seite beginnt, wenn der Platz nicht reicht."""

    def __init__(self, titel: str, kopf: str):
        self.titel, self.kopf = titel, kopf
        self.seiten: list[list[bytes]] = []
        self.y = 0.0
        self._neue_seite()

    # ---- Seite und Zeichnen
    def _neue_seite(self) -> None:
        self.seiten.append([])
        self.y = A4[1] - OBEN
        n = len(self.seiten)
        self._text(LINKS, A4[1] - 36, self.kopf, 8, False, grau=True)
        self._text(LINKS, 36, f"{self.titel} · Seite {n}", 8, False, grau=True)
        self.seiten[-1].append(f"0.8 G 0.5 w {LINKS} {A4[1] - 44} m {A4[0] - RECHTS} {A4[1] - 44} l S\n".encode())

    def _text(self, x: float, y: float, text: str, groesse: float, fett: bool, grau: bool = False) -> None:
        farbe = b"0.45 g " if grau else b"0 g "
        self.seiten[-1].append(farbe + b"BT /" + (b"F2" if fett else b"F1") + f" {groesse} Tf {x:.1f} {y:.1f} Td (".encode()
                               + _bytes(text) + b") Tj ET\n")

    def _platz(self, hoehe: float) -> None:
        if self.y - hoehe < UNTEN:
            self._neue_seite()

    # ---- Bausteine
    def h1(self, text: str) -> None:
        zeilen = umbrechen(text, 20, BREITE, True)
        self._platz(len(zeilen) * 25 + 12)
        for z in zeilen:
            self.y -= 25
            self._text(LINKS, self.y, z, 20, True)
        self.y -= 14

    def h2(self, text: str) -> None:
        zeilen = umbrechen(text, 13.5, BREITE, True)
        self._platz(len(zeilen) * 18 + 40)   # eine Überschrift steht nie allein am Seitenende
        self.y -= 8
        for z in zeilen:
            self.y -= 18
            self._text(LINKS, self.y, z, 13.5, True)
        self.y -= 4

    def p(self, text: str, groesse: float = 10.5, fett: bool = False) -> None:
        for z in umbrechen(text, groesse, BREITE, fett):
            self._platz(groesse * 1.45)
            self.y -= groesse * 1.45
            self._text(LINKS, self.y, z, groesse, fett)
        self.y -= 6

    def punkte(self, eintraege: list[str], groesse: float = 10.5) -> None:
        for e in eintraege:
            zeilen = umbrechen(e, groesse, BREITE - 14)
            for i, z in enumerate(zeilen):
                self._platz(groesse * 1.45)
                self.y -= groesse * 1.45
                if i == 0:
                    self._text(LINKS + 2, self.y, "•", groesse, False)
                self._text(LINKS + 14, self.y, z, groesse, False)
        self.y -= 6

    def tabelle(self, zeilen: list[tuple[str, str]], links_breite: float = 170, groesse: float = 10) -> None:
        for k, v in zeilen:
            lz = umbrechen(k, groesse, links_breite - 8, True)
            rz = umbrechen(v, groesse, BREITE - links_breite)
            h = max(len(lz), len(rz)) * groesse * 1.4 + 5
            self._platz(h)
            y0 = self.y
            for i, z in enumerate(lz):
                self._text(LINKS, y0 - (i + 1) * groesse * 1.4, z, groesse, True)
            for i, z in enumerate(rz):
                self._text(LINKS + links_breite, y0 - (i + 1) * groesse * 1.4, z, groesse, False)
            self.y = y0 - h
            self.seiten[-1].append(f"0.85 G 0.4 w {LINKS} {self.y + 2:.1f} m {A4[0] - RECHTS} {self.y + 2:.1f} l S\n".encode())
        self.y -= 8

    # ---- Ausgabe
    def bytes(self) -> bytes:
        objekte: list[bytes] = []
        def neu(inhalt: bytes) -> int:
            objekte.append(inhalt)
            return len(objekte)
        katalog = neu(b"")   # 1: wird unten gesetzt
        seiten = neu(b"")    # 2
        f1 = neu(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
        f2 = neu(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")
        kids = []
        for s in self.seiten:
            strom = b"".join(s)
            inhalt = neu(b"<< /Length " + str(len(strom)).encode() + b" >>\nstream\n" + strom + b"endstream")
            kids.append(neu(f"<< /Type /Page /Parent {seiten} 0 R /MediaBox [0 0 {A4[0]:.0f} {A4[1]:.0f}] "
                            f"/Resources << /Font << /F1 {f1} 0 R /F2 {f2} 0 R >> >> /Contents {inhalt} 0 R >>".encode()))
        objekte[katalog - 1] = f"<< /Type /Catalog /Pages {seiten} 0 R >>".encode()
        objekte[seiten - 1] = f"<< /Type /Pages /Kids [{' '.join(f'{k} 0 R' for k in kids)}] /Count {len(kids)} >>".encode()
        info = neu(b"<< /Title (" + _bytes(self.titel) + b") /Producer (journali Demo-Daten) >>")
        out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
        lagen = []
        for i, o in enumerate(objekte, start=1):
            lagen.append(len(out))
            out += f"{i} 0 obj\n".encode() + o + b"\nendobj\n"
        xref = len(out)
        out += f"xref\n0 {len(objekte) + 1}\n0000000000 65535 f \n".encode()
        for l in lagen:
            out += f"{l:010d} 00000 n \n".encode()
        out += f"trailer\n<< /Size {len(objekte) + 1} /Root {katalog} 0 R /Info {info} 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
        return bytes(out)
