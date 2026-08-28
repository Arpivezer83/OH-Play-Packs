#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  COMMUNITY_PACKS_DIRECTORY,
  detectChangedCommunityPacks,
  parseGitDiffNameStatus,
  validateCommunityPackCollection,
  validateCommunityPackSubmissionDirectory,
} from './community-pack-submissions.mjs'

function printIssues(issues) {
  for (const validationIssue of issues) console.error(`[${validationIssue.code}] ${validationIssue.path || 'pack'} — ${validationIssue.message}`)
}

function printSummary(total, valid, invalid) {
  console.log(`${total} packs validated`)
  console.log(`${valid} valid`)
  console.log(`${invalid} invalid`)
}

const changedPathsFile = process.argv[2]
const collectionDirectory = new URL(`../${COMMUNITY_PACKS_DIRECTORY}`, import.meta.url)

console.log('OH Play Community Pack PR Validator')

if (!changedPathsFile) {
  console.error('Usage: node scripts/validate-changed-community-packs.mjs <git-name-status-file>')
  process.exitCode = 2
} else {
  try {
    const changes = parseGitDiffNameStatus(readFileSync(changedPathsFile, 'utf8'))
    const selection = detectChangedCommunityPacks(changes, { collectionDirectory: fileURLToPath(collectionDirectory) })
    for (const deletedPackRoot of selection.deletedPackRoots) console.log(`Skipping deleted pack: ${deletedPackRoot}`)
    if (selection.incompletePackRoots.length > 0) {
      for (const packRoot of selection.incompletePackRoots) {
        console.error('✗ INVALID')
        console.error(`[PACK_JSON_MISSING] ${packRoot} — Changed submission directories must contain pack.json.`)
      }
      printSummary(selection.incompletePackRoots.length, 0, selection.incompletePackRoots.length)
      process.exitCode = 1
    } else if (selection.changedPackDirectories.length > 0) {
      const results = selection.changedPackDirectories.map((directory) => ({ directory, ...validateCommunityPackSubmissionDirectory(directory) }))
      for (const pack of results) {
        console.log(`Validating: ${pack.packId}`)
        if (pack.valid) console.log('✓ VALID')
        else {
          console.error('✗ INVALID')
          printIssues(pack.issues)
        }
      }
      const invalid = results.filter((result) => !result.valid).length
      printSummary(results.length, results.length - invalid, invalid)
      if (invalid > 0) process.exitCode = 1
    } else if (selection.deletedPackRoots.length > 0) {
      printSummary(0, 0, 0)
    } else {
      console.log('No submitted pack paths changed; validating the current submitted catalogue because validator or schema tooling changed.')
      const result = validateCommunityPackCollection(fileURLToPath(collectionDirectory))
      for (const pack of result.results) {
        console.log(`Validating: ${pack.packId}`)
        if (pack.valid) console.log('✓ VALID')
        else {
          console.error('✗ INVALID')
          printIssues(pack.issues)
        }
      }
      if (!result.valid && result.results.length === 0) printIssues(result.issues)
      printSummary(result.total, result.validCount, result.invalidCount)
      if (!result.valid) process.exitCode = 1
    }
  } catch {
    console.error('INTERNAL ERROR — the changed-pack validator could not complete.')
    process.exitCode = 2
  }
}
