// Tannwald in der Demo (10.10.2026): Journali.Server/demo-tannwald.json ist die Aufzeichnung des Generators (tools/tannwald_export.py aus
// demo_master_tree.py, tannwald_inhalt.py und tannwald_faq.md). Ändert sich der Generator, passt die Datei nicht mehr — dann schreibt
// `python tools/tannwald_export.py` sie neu. Ohne Python auf diesem Rechner wird nicht geprüft.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const python = ['python', 'python3', 'py'].find(p => spawnSync(p, ['--version'], { encoding: 'utf8' }).status === 0)

test('demo-tannwald.json passt zum Generator', { skip: python ? false : 'kein Python' }, () => {
  const r = spawnSync(python, [path.join(repo, 'tools', 'tannwald_export.py'), '--check'], { encoding: 'utf8', cwd: repo })
  assert.equal(r.status, 0, (r.stdout || '') + (r.stderr || ''))
})
