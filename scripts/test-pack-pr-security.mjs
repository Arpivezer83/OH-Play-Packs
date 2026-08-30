#!/usr/bin/env node

// Adversarial regression tests for the pack-submission trust boundary
// (see .github/workflows/validate-community-packs.yml and
// scripts/enforce-pack-pr-boundary.mjs). Offline, dependency-free, and safe:
// nothing here ever executes a file it creates — every "malicious" fixture
// is only ever read as bytes or listed as a path, exactly like the real
// validator does.

import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, truncateSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { enforceSinglePackPrBoundary } from './enforce-pack-pr-boundary.mjs'
import { assetContentMatchesExtension, validateSubmissionFilePolicy } from './community-pack-submissions.mjs'
import { validatePackDirectory } from './community-pack-validator.mjs'

const kitRoot = fileURLToPath(new URL('..', import.meta.url))
let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    passed += 1
    console.log(`✓ ${name}`)
  } catch (error) {
    failed += 1
    console.error(`✗ ${name}`)
    console.error(`  ${error instanceof Error ? error.message : error}`)
  }
}

function diff(paths) {
  return paths.map((path) => ({ status: 'M', path }))
}

// ---------------------------------------------------------------------------
// Boundary check — pure, path-only, independent of any file the PR contains.
// ---------------------------------------------------------------------------

test('boundary: legitimate one-pack PR passes', () => {
  const result = enforceSinglePackPrBoundary(diff([
    'packs/game-cards/red-fox-facts/pack.json',
    'packs/game-cards/red-fox-facts/README.md',
    'packs/game-cards/red-fox-facts/assets/red-fox.webp',
  ]))
  assert.equal(result.ok, true)
  assert.equal(result.packId, 'red-fox-facts')
})

test('boundary: two unrelated packs in one PR is rejected', () => {
  const result = enforceSinglePackPrBoundary(diff([
    'packs/game-cards/red-fox-facts/pack.json',
    'packs/game-cards/second-pack/pack.json',
  ]))
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'MULTIPLE_PACKS_CHANGED')
})

test('boundary: pack + validator script change is rejected', () => {
  const result = enforceSinglePackPrBoundary(diff([
    'packs/game-cards/red-fox-facts/pack.json',
    'scripts/community-pack-validator.mjs',
  ]))
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'OUTSIDE_PACK_BOUNDARY')
})

test('boundary: pack + workflow change is rejected', () => {
  const result = enforceSinglePackPrBoundary(diff([
    'packs/game-cards/red-fox-facts/pack.json',
    '.github/workflows/validate-community-packs.yml',
  ]))
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'OUTSIDE_PACK_BOUNDARY')
})

test('boundary: pack + package.json change is rejected', () => {
  const result = enforceSinglePackPrBoundary(diff([
    'packs/game-cards/red-fox-facts/pack.json',
    'package.json',
  ]))
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'OUTSIDE_PACK_BOUNDARY')
})

test('boundary: workflow-only change (no pack touched) is rejected, not silently skipped', () => {
  const result = enforceSinglePackPrBoundary(diff(['schema/oh-play-pack.schema.json']))
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'OUTSIDE_PACK_BOUNDARY')
})

test('boundary: path-traversal-shaped pack id is rejected', () => {
  const result = enforceSinglePackPrBoundary(diff(['packs/game-cards/../../etc/passwd']))
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'UNSAFE_PACK_ID')
})

test('boundary: Unicode/uppercase pack id is rejected (only ASCII lower-kebab allowed)', () => {
  const result = enforceSinglePackPrBoundary(diff(['packs/game-cards/Red-Fox-Facts/pack.json']))
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'UNSAFE_PACK_ID')
})

test('boundary: pure function never touches the filesystem — fake, nonexistent paths behave identically', () => {
  // Same shape of input, no real files anywhere on disk. If this function
  // needed to read the PR's content to decide, this would throw or behave
  // differently; it does not, by construction.
  const result = enforceSinglePackPrBoundary(diff(['packs/game-cards/definitely-does-not-exist-anywhere/pack.json']))
  assert.equal(result.ok, true)
  assert.equal(result.packId, 'definitely-does-not-exist-anywhere')
})

// ---------------------------------------------------------------------------
// Content-level attacks — real files, real bytes, never executed.
// ---------------------------------------------------------------------------

function withTempPack(fn) {
  const root = mkdtempSync(join(tmpdir(), 'oh-play-pack-security-'))
  const packDirectory = join(root, 'attack-pack')
  mkdirSync(join(packDirectory, 'assets'), { recursive: true })
  try {
    fn(packDirectory)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test('content: executable content renamed .png is rejected (magic-byte mismatch)', () => {
  withTempPack((packDirectory) => {
    const target = join(packDirectory, 'assets', 'evil.png')
    writeFileSync(target, '#!/bin/sh\necho pwned\n')
    assert.equal(assetContentMatchesExtension(target, '.png'), false)
    const result = validateSubmissionFilePolicy(packDirectory)
    assert.equal(result.valid, false)
    assert.ok(result.issues.some((issue) => issue.code === 'ASSET_CONTENT_MISMATCH'))
  })
})

test('content: an ELF binary renamed .webp is rejected', () => {
  withTempPack((packDirectory) => {
    const target = join(packDirectory, 'assets', 'payload.webp')
    writeFileSync(target, Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0, 0, 0, 0]))
    assert.equal(assetContentMatchesExtension(target, '.webp'), false)
  })
})

test('content: SVG disguised as raster (wrong signature) is rejected', () => {
  withTempPack((packDirectory) => {
    const target = join(packDirectory, 'assets', 'not-really.png')
    writeFileSync(target, '<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    assert.equal(assetContentMatchesExtension(target, '.png'), false)
  })
})

test('content: a genuine PNG signature is accepted', () => {
  withTempPack((packDirectory) => {
    const target = join(packDirectory, 'assets', 'real.png')
    writeFileSync(target, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))
    assert.equal(assetContentMatchesExtension(target, '.png'), true)
  })
})

test('content: a genuine WebP signature is accepted', () => {
  withTempPack((packDirectory) => {
    const target = join(packDirectory, 'assets', 'real.webp')
    const buffer = Buffer.alloc(16)
    buffer.write('RIFF', 0, 'ascii')
    buffer.write('WEBP', 8, 'ascii')
    writeFileSync(target, buffer)
    assert.equal(assetContentMatchesExtension(target, '.webp'), true)
  })
})

test('content: executable file extension is still rejected outright', () => {
  withTempPack((packDirectory) => {
    writeFileSync(join(packDirectory, 'assets', 'run.sh'), '#!/bin/sh\n')
    const result = validateSubmissionFilePolicy(packDirectory)
    assert.equal(result.valid, false)
    assert.ok(result.issues.some((issue) => issue.code === 'EXECUTABLE_PACK_FILE'))
  })
})

test('content: unsupported asset extension is rejected', () => {
  withTempPack((packDirectory) => {
    writeFileSync(join(packDirectory, 'assets', 'notes.txt'), 'hello')
    const result = validateSubmissionFilePolicy(packDirectory)
    assert.equal(result.valid, false)
    assert.ok(result.issues.some((issue) => issue.code === 'UNSUPPORTED_ASSET_FILE_TYPE'))
  })
})

test('content: an oversized asset is rejected', () => {
  withTempPack((packDirectory) => {
    const target = join(packDirectory, 'assets', 'huge.png')
    const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    writeFileSync(target, header)
    // Extend the file sparsely past the cap without holding the padding in
    // memory — this test only needs statSync's reported size to exceed it.
    truncateSync(target, 9 * 1024 * 1024)
    const result = validateSubmissionFilePolicy(packDirectory)
    assert.equal(result.valid, false)
    assert.ok(result.issues.some((issue) => issue.code === 'SUBMISSION_ASSET_TOO_LARGE'))
  })
})

test('content: a submission with far too many files is rejected', () => {
  withTempPack((packDirectory) => {
    for (let index = 0; index < 210; index += 1) {
      writeFileSync(join(packDirectory, 'assets', `f${index}.png`), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    }
    const result = validateSubmissionFilePolicy(packDirectory)
    assert.equal(result.valid, false)
    assert.ok(result.issues.some((issue) => issue.code === 'TOO_MANY_SUBMISSION_FILES'))
  })
})

test('content: a symlinked pack directory is rejected without following it', () => {
  withTempPack((packDirectory) => {
    const root = join(packDirectory, '..')
    const linkPath = join(root, 'attack-pack-link')
    symlinkSync(packDirectory, linkPath)
    try {
      const result = validateSubmissionFilePolicy(linkPath)
      assert.equal(result.valid, false)
      assert.ok(result.issues.some((issue) => issue.code === 'SUBMISSION_SYMLINK_NOT_ALLOWED'))
    } finally {
      rmSync(linkPath, { force: true })
    }
  })
})

test('content: a symlink inside assets/ is rejected without following it', () => {
  withTempPack((packDirectory) => {
    const outside = join(packDirectory, '..', 'outside.png')
    writeFileSync(outside, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    symlinkSync(outside, join(packDirectory, 'assets', 'linked.png'))
    const result = validateSubmissionFilePolicy(packDirectory)
    assert.equal(result.valid, false)
    assert.ok(result.issues.some((issue) => issue.code === 'SUBMISSION_SYMLINK_NOT_ALLOWED'))
  })
})

// ---------------------------------------------------------------------------
// Manifest-level URL scheme attacks.
// ---------------------------------------------------------------------------

function withMinimalManifest(imagePath, fn) {
  withTempPack((packDirectory) => {
    const pack = {
      id: 'attack-pack',
      schemaVersion: 1,
      content: {
        world: { id: 'attack-pack', title: { en: 'x', hu: 'x' }, cardOrder: ['c1'] },
        cards: [{ id: 'c1', title: { en: 'x', hu: 'x' }, image: { path: imagePath } }],
      },
    }
    writeFileSync(join(packDirectory, 'pack.json'), JSON.stringify(pack))
    fn(packDirectory)
  })
}

test('manifest: a javascript: URL asset path is rejected by name, not as a generic missing file', () => {
  withMinimalManifest('javascript:alert(1)', (packDirectory) => {
    const result = validatePackDirectory(packDirectory)
    assert.ok(result.issues.some((issue) => issue.code === 'UNSUPPORTED_ASSET_URL_SCHEME'))
  })
})

test('manifest: a data: URL asset path is rejected by name, not as a generic missing file', () => {
  withMinimalManifest('data:image/png;base64,AAAA', (packDirectory) => {
    const result = validatePackDirectory(packDirectory)
    assert.ok(result.issues.some((issue) => issue.code === 'UNSUPPORTED_ASSET_URL_SCHEME'))
  })
})

test('manifest: an http(s) URL asset path is still rejected as a remote asset', () => {
  withMinimalManifest('https://example.com/x.png', (packDirectory) => {
    const result = validatePackDirectory(packDirectory)
    assert.ok(result.issues.some((issue) => issue.code === 'REMOTE_RUNTIME_ASSET'))
  })
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exitCode = 1
