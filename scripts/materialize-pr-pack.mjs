#!/usr/bin/env node

// Safe materialization of one pack directory out of an untrusted PR's HEAD
// commit, for the trusted validator to read.
//
// This deliberately never checks out the PR's head commit as a working
// tree and never runs `git archive | tar -x` (or any other extraction that
// creates filesystem entries straight from tar/archive semantics). Instead
// it uses `git ls-tree` to read Git's own metadata for every entry under
// packs/game-cards/<pack-id>/ BEFORE writing a single byte to disk: a
// symlink (mode 120000) or a submodule/gitlink (mode 160000, type commit)
// is rejected purely from that metadata, never created on disk and then
// noticed. Only after every entry is confirmed to be an ordinary
// regular-file blob, within size/count limits, does this stream the
// accepted blobs (`git cat-file blob <oid>`) into a fresh destination
// directory — one already-known-safe relative path at a time, never by
// letting an archive format decide the resulting directory structure.
//
// See .github/workflows/validate-community-packs.yml for how the calling
// workflow keeps this trusted: it always runs the BASE branch's copy of
// this file against the PR's head commit id (just a 40-character string —
// data, not code), never the PR's own copy.

import { execFileSync } from 'node:child_process'
import { dirname, relative, resolve } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { MAX_SUBMISSION_ASSET_BYTES, MAX_SUBMISSION_FILE_COUNT } from './community-pack-submissions.mjs'
import { PACKS_ROOT, SAFE_PACK_ID_PATTERN } from './enforce-pack-pr-boundary.mjs'

// Defense in depth beyond the per-file cap below: bound the *combined* size
// materialized for one pack, regardless of how the per-file and file-count
// caps interact (e.g. many files each just under the per-file limit).
export const MAX_MATERIALIZED_TOTAL_BYTES = 32 * 1024 * 1024

const REGULAR_FILE_MODES = new Set(['100644', '100755'])

/**
 * Parses the NUL-delimited output of
 * `git ls-tree -r -l -z <sha> -- <packsRoot>/<packId>`. Pure string
 * parsing — no filesystem or git access, and safe against exotic filenames
 * because `-z` disables Git's normal path quoting.
 */
export function parseLsTreeLong(output) {
  if (!output) return []
  return output
    .split('\0')
    .filter((record) => record.length > 0)
    .map((record) => {
      const tabIndex = record.indexOf('\t')
      if (tabIndex === -1) {
        throw new Error(`Malformed git ls-tree record (no path separator): ${JSON.stringify(record)}`)
      }
      const header = record.slice(0, tabIndex)
      const path = record.slice(tabIndex + 1)
      const parts = header.trim().split(/\s+/)
      if (parts.length !== 4) {
        throw new Error(`Malformed git ls-tree record (unexpected header shape): ${JSON.stringify(record)}`)
      }
      const [mode, type, oid, sizeRaw] = parts
      return { mode, type, oid, size: sizeRaw === '-' ? null : Number(sizeRaw), path }
    })
}

/**
 * Pure decision: given parsed tree entries already scoped to one pack
 * directory, decide whether they may be safely materialized and, if so,
 * exactly which (relative path, blob oid) pairs to write. Never touches the
 * filesystem or git — fully unit-testable with synthetic entries.
 */
export function planPackMaterialization(entries, { packsRoot = PACKS_ROOT, packId } = {}) {
  if (typeof packId !== 'string' || !SAFE_PACK_ID_PATTERN.test(packId)) {
    return { ok: false, reason: 'UNSAFE_PACK_ID', message: `Refusing to materialize an unsafe pack id: ${JSON.stringify(packId)}` }
  }
  const prefix = `${packsRoot}/${packId}/`
  const files = []
  let totalBytes = 0
  for (const entry of entries) {
    if (!entry.path.startsWith(prefix)) {
      return { ok: false, reason: 'UNEXPECTED_PATH', message: `Tree entry outside the expected pack directory: ${entry.path}`, entry }
    }
    const relPath = entry.path.slice(prefix.length)
    if (relPath.length === 0 || relPath.startsWith('/') || relPath.split('/').includes('..')) {
      return { ok: false, reason: 'UNSAFE_ENTRY_PATH', message: `Unsafe entry path shape: ${entry.path}`, entry }
    }
    if (entry.type !== 'blob' || !REGULAR_FILE_MODES.has(entry.mode)) {
      return {
        ok: false,
        reason: 'UNSAFE_TREE_ENTRY',
        message: `Refusing to materialize a non-regular-file tree entry (mode ${entry.mode}, type ${entry.type}) at ${entry.path}. Symlinks and submodules/gitlinks are not permitted in a pack submission.`,
        entry,
      }
    }
    const size = entry.size ?? 0
    if (size > MAX_SUBMISSION_ASSET_BYTES) {
      return { ok: false, reason: 'ENTRY_TOO_LARGE', message: `${entry.path} is ${size} bytes, over the ${MAX_SUBMISSION_ASSET_BYTES}-byte per-file limit.`, entry }
    }
    totalBytes += size
    files.push({ path: relPath, oid: entry.oid, size })
  }
  if (files.length > MAX_SUBMISSION_FILE_COUNT) {
    return { ok: false, reason: 'TOO_MANY_FILES', message: `This pack has ${files.length} files, over the ${MAX_SUBMISSION_FILE_COUNT}-file limit.` }
  }
  if (totalBytes > MAX_MATERIALIZED_TOTAL_BYTES) {
    return { ok: false, reason: 'TOTAL_TOO_LARGE', message: `This pack totals ${totalBytes} bytes, over the ${MAX_MATERIALIZED_TOTAL_BYTES}-byte combined limit.` }
  }
  return { ok: true, files }
}

function isInside(root, candidate) {
  const rel = relative(root, candidate)
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${'/'}`) && !/^([A-Za-z]:)?[\\/]/.test(rel)
}

// --- git/filesystem orchestration below this line is intentionally NOT
//     pure, and is covered by a real-git integration test (which runs it
//     against a scratch git repository), rather than by unit tests of this
//     function directly. ---

export function materializePack({ headSha, packId, packsRoot = PACKS_ROOT, destDir, cwd = process.cwd() }) {
  const treeOutput = execFileSync(
    'git',
    ['ls-tree', '-r', '-l', '-z', headSha, '--', `${packsRoot}/${packId}`],
    { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
  const entries = parseLsTreeLong(treeOutput)
  const plan = planPackMaterialization(entries, { packsRoot, packId })
  if (!plan.ok) return plan
  const destRoot = resolve(destDir)
  mkdirSync(destRoot, { recursive: true })
  for (const file of plan.files) {
    const destPath = resolve(destRoot, file.path)
    if (!isInside(destRoot, destPath)) {
      return { ok: false, reason: 'UNSAFE_ENTRY_PATH', message: `Materialized path escaped the destination directory: ${file.path}` }
    }
    mkdirSync(dirname(destPath), { recursive: true })
    const content = execFileSync('git', ['cat-file', 'blob', file.oid], { cwd, maxBuffer: MAX_SUBMISSION_ASSET_BYTES + 4096 })
    writeFileSync(destPath, content)
  }
  return { ok: true, files: plan.files, hasPack: plan.files.some((file) => file.path === 'pack.json') }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const [headSha, packId, destDir] = process.argv.slice(2)
  if (!headSha || !packId || !destDir) {
    console.error('Usage: node scripts/materialize-pr-pack.mjs <head-sha> <pack-id> <dest-dir>')
    process.exitCode = 2
  } else {
    try {
      const result = materializePack({ headSha, packId, destDir })
      if (!result.ok) {
        console.error(`✗ Materialization REJECTED — ${result.reason}`)
        console.error(result.message)
        process.exitCode = 1
      } else {
        console.log(`✓ Materialized ${result.files.length} file(s) for pack "${packId}".`)
        console.log(`has_pack=${result.hasPack}`)
        const outputFile = process.env.GITHUB_OUTPUT
        if (outputFile) {
          const fs = await import('node:fs')
          fs.appendFileSync(outputFile, `has_pack=${result.hasPack}\n`)
        }
      }
    } catch (error) {
      console.error(`INTERNAL ERROR — materialization could not complete: ${error instanceof Error ? error.message : 'unknown error'}`)
      process.exitCode = 2
    }
  }
}
