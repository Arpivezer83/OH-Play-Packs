#!/usr/bin/env node

// Security boundary for the public pack-submission CI (see
// publicPackKit/validate-community-packs.yml). A pack PR's own copy of the
// schema, the validator scripts, or the workflow itself must never be the
// authority that decides whether that same PR is valid — a malicious
// contributor could otherwise just rewrite the validator to always pass.
//
// This module is pure and git-independent: it takes already-parsed
// `git diff --name-status` entries and decides, from paths alone, whether a
// PR stayed inside the one boundary a normal contributor pack PR is allowed
// to touch. It never reads or executes any file the PR changed. The calling
// workflow is responsible for running this using the TRUSTED (base-branch)
// copy of this script — see the workflow file for how that separation is
// kept.

import { readFileSync } from 'node:fs'
import { parseGitDiffNameStatus } from './community-pack-submissions.mjs'

export const PACKS_ROOT = 'packs/game-cards'

// Deliberately narrow: lowercase ASCII letters, digits, and internal
// hyphens only — the same shape already used by every real pack id in this
// codebase (e.g. "csapd-le-csacsi"). This rejects path traversal ("..",
// "/"), absolute-path tricks, null bytes, and Unicode homoglyph/RTL-override
// tricks in one step, before the resulting id is ever interpolated into a
// shell command or filesystem path by the workflow.
const SAFE_PACK_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Decides whether a set of changed paths (as produced by
 * `parseGitDiffNameStatus`) stays inside a single pack submission.
 *
 * Policy (deliberately strict — see MISSION section 6 of the trust/security
 * hardening pass): a normal contributor pack PR may modify files only under
 * `packs/game-cards/<one-pack-id>/**`. Anything else — a second pack in the
 * same PR, or any file outside that one directory (workflows, schema,
 * scripts, package manifests, ...) — fails this boundary and must go
 * through a separate, human-reviewed maintainer path instead of the
 * automatic pack-validation route.
 */
export function enforceSinglePackPrBoundary(changes, { packsRoot = PACKS_ROOT } = {}) {
  const outsidePaths = []
  const packIds = new Set()
  for (const change of changes) {
    const path = typeof change === 'string' ? change : change.path
    if (typeof path !== 'string' || path.length === 0) continue
    const prefix = `${packsRoot}/`
    if (!path.startsWith(prefix)) {
      outsidePaths.push(path)
      continue
    }
    const rest = path.slice(prefix.length)
    const firstSegment = rest.split('/')[0]
    if (firstSegment) packIds.add(firstSegment)
  }
  if (outsidePaths.length > 0) {
    return {
      ok: false,
      reason: 'OUTSIDE_PACK_BOUNDARY',
      message: `This PR changes files outside ${packsRoot}/<pack-id>/. A normal pack submission may only add or change its own pack directory; infrastructure changes (workflows, schema, scripts, package manifests, and similar) need a separate, maintainer-reviewed PR.`,
      outsidePaths,
    }
  }
  if (packIds.size === 0) {
    return {
      ok: false,
      reason: 'NO_PACK_CHANGED',
      message: `No files under ${packsRoot}/<pack-id>/ were changed, so there is no pack for this workflow to validate.`,
    }
  }
  if (packIds.size > 1) {
    return {
      ok: false,
      reason: 'MULTIPLE_PACKS_CHANGED',
      message: 'This PR touches more than one pack directory. Please submit one pack per pull request.',
      packIds: [...packIds].sort(),
    }
  }
  const [packId] = packIds
  if (!SAFE_PACK_ID_PATTERN.test(packId)) {
    return {
      ok: false,
      reason: 'UNSAFE_PACK_ID',
      message: `Pack directory name "${packId}" is not a safe pack id. Use lowercase letters, digits, and hyphens only (for example "red-fox-facts").`,
      packId,
    }
  }
  return { ok: true, packId }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const changedPathsFile = process.argv[2]
  if (!changedPathsFile) {
    console.error('Usage: node scripts/enforce-pack-pr-boundary.mjs <git-name-status-file>')
    process.exitCode = 2
  } else {
    try {
      const changes = parseGitDiffNameStatus(readFileSync(changedPathsFile, 'utf8'))
      const result = enforceSinglePackPrBoundary(changes)
      if (result.ok) {
        console.log(`✓ Pack submission boundary OK — pack id: ${result.packId}`)
        console.log(`pack_id=${result.packId}`)
        const outputFile = process.env.GITHUB_OUTPUT
        if (outputFile) {
          const fs = await import('node:fs')
          fs.appendFileSync(outputFile, `pack_id=${result.packId}\n`)
        }
      } else {
        console.error(`✗ Pack submission boundary REJECTED — ${result.reason}`)
        console.error(result.message)
        if (result.outsidePaths) for (const path of result.outsidePaths) console.error(`  outside boundary: ${path}`)
        if (result.packIds) for (const id of result.packIds) console.error(`  pack directory: ${id}`)
        process.exitCode = 1
      }
    } catch (error) {
      console.error(`INTERNAL ERROR — the pack PR boundary check could not complete: ${error instanceof Error ? error.message : 'unknown error'}`)
      process.exitCode = 2
    }
  }
}
