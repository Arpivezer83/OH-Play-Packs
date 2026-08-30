#!/usr/bin/env node

// Adversarial regression tests for the pack-submission trust boundary
// (see .github/workflows/validate-community-packs.yml and
// scripts/enforce-pack-pr-boundary.mjs). Offline, dependency-free, and safe:
// nothing here ever executes a file it creates — every "malicious" fixture
// is only ever read as bytes or listed as a path, exactly like the real
// validator does.

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, truncateSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { enforceSinglePackPrBoundary } from './enforce-pack-pr-boundary.mjs'
import { assetContentMatchesExtension, MAX_SUBMISSION_ASSET_BYTES, MAX_SUBMISSION_FILE_COUNT, validateSubmissionFilePolicy } from './community-pack-submissions.mjs'
import { validatePackDirectory } from './community-pack-validator.mjs'
import { materializePack, MAX_MATERIALIZED_TOTAL_BYTES, parseLsTreeLong, planPackMaterialization } from './materialize-pr-pack.mjs'

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

// ---------------------------------------------------------------------------
// Safe materialization — Git-plumbing extraction of one pack directory from
// an untrusted PR head, never via `git archive | tar -x` and never by
// checking out the PR head as a working tree.
// ---------------------------------------------------------------------------

test('materialize: parses real `git ls-tree -r -l -z` output, including symlink and gitlink entries', () => {
  const record = [
    '100644 blob ce013625030ba8dba906f756967f9e9ca394464a       6\tpacks/game-cards/demo-pack/assets/a.png',
    '120000 blob 3594e94c04db171e2767224db355f514b13715c5      11\tpacks/game-cards/demo-pack/assets/evil-symlink',
    '160000 commit e69de29bb2d1d6434b8b29ae775ad8c2e48c5391       -\tpacks/game-cards/demo-pack/assets/fake-submodule',
  ].join('\0') + '\0'
  const entries = parseLsTreeLong(record)
  assert.equal(entries.length, 3)
  assert.equal(entries[0].mode, '100644')
  assert.equal(entries[1].mode, '120000')
  assert.equal(entries[2].mode, '160000')
  assert.equal(entries[2].type, 'commit')
})

test('materialize: plan rejects a symlink tree entry without ever writing it to disk', () => {
  const result = planPackMaterialization(
    [{ mode: '120000', type: 'blob', oid: 'a'.repeat(40), size: 5, path: 'packs/game-cards/demo-pack/assets/evil' }],
    { packId: 'demo-pack' },
  )
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'UNSAFE_TREE_ENTRY')
})

test('materialize: plan rejects a submodule/gitlink tree entry', () => {
  const result = planPackMaterialization(
    [{ mode: '160000', type: 'commit', oid: 'a'.repeat(40), size: null, path: 'packs/game-cards/demo-pack/assets/sub' }],
    { packId: 'demo-pack' },
  )
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'UNSAFE_TREE_ENTRY')
})

test('materialize: plan rejects a combined total over the total-size cap, even though every file is under the per-file and count caps', () => {
  const perFile = 7 * 1024 * 1024
  assert.ok(perFile < MAX_SUBMISSION_ASSET_BYTES)
  const entries = Array.from({ length: 5 }, (_, i) => ({
    mode: '100644',
    type: 'blob',
    oid: 'a'.repeat(40),
    size: perFile,
    path: `packs/game-cards/demo-pack/assets/f${i}.png`,
  }))
  assert.ok(entries.length < MAX_SUBMISSION_FILE_COUNT)
  assert.ok(entries.length * perFile > MAX_MATERIALIZED_TOTAL_BYTES)
  const result = planPackMaterialization(entries, { packId: 'demo-pack' })
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'TOTAL_TOO_LARGE')
})

function withScratchGitRepo(fn) {
  const repoDir = mkdtempSync(join(tmpdir(), 'oh-play-materialize-repo-'))
  try {
    const git = (...args) => execFileSync('git', args, { cwd: repoDir, encoding: 'utf8' })
    git('init', '-q')
    git('config', 'user.email', 'test@example.com')
    git('config', 'user.name', 'Test')
    fn({ repoDir, git })
  } finally {
    rmSync(repoDir, { recursive: true, force: true })
  }
}

test('materialize: real git plumbing extracts only ordinary files, byte-for-byte', () => {
  withScratchGitRepo(({ repoDir, git }) => {
    mkdirSync(join(repoDir, 'packs/game-cards/demo-pack/assets'), { recursive: true })
    writeFileSync(join(repoDir, 'packs/game-cards/demo-pack/pack.json'), '{"id":"demo-pack"}')
    writeFileSync(join(repoDir, 'packs/game-cards/demo-pack/assets/a.png'), 'not-a-real-png-but-bytes')
    git('add', '-A')
    git('commit', '-q', '-m', 'init')
    const headSha = git('rev-parse', 'HEAD').trim()
    const destDir = mkdtempSync(join(tmpdir(), 'oh-play-materialize-dest-'))
    try {
      const result = materializePack({ headSha, packId: 'demo-pack', destDir, cwd: repoDir })
      assert.equal(result.ok, true)
      assert.equal(result.hasPack, true)
      assert.equal(readFileSync(join(destDir, 'pack.json'), 'utf8'), '{"id":"demo-pack"}')
      assert.equal(readFileSync(join(destDir, 'assets/a.png'), 'utf8'), 'not-a-real-png-but-bytes')
    } finally {
      rmSync(destDir, { recursive: true, force: true })
    }
  })
})

test('materialize: a real symlink committed inside the pack directory is rejected by Git metadata, never created on disk at the destination', () => {
  withScratchGitRepo(({ repoDir, git }) => {
    mkdirSync(join(repoDir, 'packs/game-cards/demo-pack/assets'), { recursive: true })
    writeFileSync(join(repoDir, 'packs/game-cards/demo-pack/pack.json'), '{"id":"demo-pack"}')
    symlinkSync('/etc/passwd', join(repoDir, 'packs/game-cards/demo-pack/assets/evil-symlink'))
    git('add', '-A')
    git('commit', '-q', '-m', 'init with symlink')
    const headSha = git('rev-parse', 'HEAD').trim()
    const destDir = mkdtempSync(join(tmpdir(), 'oh-play-materialize-dest-'))
    try {
      const result = materializePack({ headSha, packId: 'demo-pack', destDir, cwd: repoDir })
      assert.equal(result.ok, false)
      assert.equal(result.reason, 'UNSAFE_TREE_ENTRY')
    } finally {
      rmSync(destDir, { recursive: true, force: true })
    }
  })
})

test('materialize: a deleted pack directory at head materializes cleanly as "no pack", not an error', () => {
  withScratchGitRepo(({ repoDir, git }) => {
    mkdirSync(join(repoDir, 'packs/game-cards/other-pack'), { recursive: true })
    writeFileSync(join(repoDir, 'packs/game-cards/other-pack/pack.json'), '{"id":"other-pack"}')
    git('add', '-A')
    git('commit', '-q', '-m', 'unrelated pack only')
    const headSha = git('rev-parse', 'HEAD').trim()
    const destDir = mkdtempSync(join(tmpdir(), 'oh-play-materialize-dest-'))
    try {
      const result = materializePack({ headSha, packId: 'demo-pack', destDir, cwd: repoDir })
      assert.equal(result.ok, true)
      assert.equal(result.hasPack, false)
      assert.deepEqual(result.files, [])
    } finally {
      rmSync(destDir, { recursive: true, force: true })
    }
  })
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exitCode = 1
