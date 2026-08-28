#!/usr/bin/env node

// Offline smoke test for this standalone kit. It deliberately transforms the
// illustrative template into a temporary two-card Battle fixture; it neither
// creates a real submission nor claims the template placeholders are facts.

import { cpSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const kitRoot = fileURLToPath(new URL('..', import.meta.url))
const temporaryRoot = mkdtempSync(join(tmpdir(), 'oh-play-packs-smoke-'))
const fixtureDirectory = join(temporaryRoot, 'test-pack')

try {
  cpSync(join(kitRoot, 'examples', 'template'), fixtureDirectory, { recursive: true })
  const manifestPath = join(fixtureDirectory, 'pack.json')
  const pack = JSON.parse(readFileSync(manifestPath, 'utf8'))
  pack.id = 'test-pack'
  pack.content.world.id = 'test-pack'
  pack.content.world.cardOrder = ['red-fox', 'test-fox']
  const secondCard = structuredClone(pack.content.cards[0])
  secondCard.id = 'test-fox'
  pack.content.cards.push(secondCard)
  for (const card of pack.content.cards) card.image.path = 'assets/template-smoke.webp'
  unlinkSync(join(fixtureDirectory, 'assets', 'red-fox-template.svg'))
  writeFileSync(join(fixtureDirectory, 'assets', 'template-smoke.webp'), '')
  writeFileSync(manifestPath, `${JSON.stringify(pack, null, 2)}\n`)

  const validation = spawnSync(process.execPath, [join(kitRoot, 'scripts', 'validate-community-pack.mjs'), fixtureDirectory], { encoding: 'utf8' })
  if (validation.error || validation.status !== 0 || !validation.stdout.includes('VALID')) {
    process.stderr.write(validation.stderr || validation.error?.message || 'Starter-kit smoke validation failed.\n')
    process.exitCode = 1
  } else {
    console.log('PASS: public starter-kit smoke pack validates.')
  }
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true })
}
