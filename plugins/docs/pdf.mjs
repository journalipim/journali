// PDF lesen mit pdfjs: je Seite die Textstücke mit Lage, Grösse und Schriftname — die Eingabe des Typografie-Lesers
// (layout.mjs). Der Schriftname steht erst nach getOperatorList in commonObjs; ohne ihn bleibt die Kennung (g_d0_f3),
// die innerhalb eines Dokuments ebenso den Schnitt unterscheidet.
export async function pdfPages(bytes) {
  let pdfjs
  try { pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs') }
  catch (e) { throw new Error('pdfjs-dist fehlt — im Plugin-Verzeichnis einmal „npm install“ ausführen (' + e.message + ')') }
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, isEvalSupported: false, verbosity: 0 }).promise
  const pages = []
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    try { await page.getOperatorList() } catch { /* ohne Schriftnamen geht es mit den Kennungen weiter */ }
    const content = await page.getTextContent()
    const fontName = id => { try { return (page.commonObjs.has(id) ? page.commonObjs.get(id)?.name : null) ?? id } catch { return id } }
    // gedreht: hochkante Spaltenköpfe und Wasserzeichen stehen quer im Text. Sie behalten ihre Lage, tragen aber ein
    // Kennzeichen — der Leser hält sie aus dem Zeilenfluss heraus (29.09.2026)
    const items = content.items.filter(i => i.str != null).map(i => ({ str: i.str, x: i.transform?.[4] ?? 0, y: i.transform?.[5] ?? 0, w: i.width ?? 0, h: i.height ?? 0,
      font: fontName(i.fontName), rot: Math.abs(i.transform?.[1] ?? 0) > 0.01 || Math.abs(i.transform?.[2] ?? 0) > 0.01 }))
    pages.push({ page: n, items, width: page.view?.[2] ?? null, height: page.view?.[3] ?? null })
    page.cleanup()
  }
  await doc.destroy()
  return pages
}
