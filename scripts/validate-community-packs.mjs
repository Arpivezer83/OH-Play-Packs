#!/usr/bin/env node

import { fileURLToPath } from 'node:url'
import { COMMUNITY_PACKS_DIRECTORY, validateCommunityPackCollection } from './community-pack-submissions.mjs'

function printIssues(issues) {
  for (const validationIssue of issues) console.error(`[${validationIssue.code}] ${validationIssue.path || 'pack'} — ${validationIssue.message}`)
}

const collectionDirectory = process.argv[2] ?? new URL(`../${COMMUNITY_PACKS_DIRECTORY}`, import.meta.url)
const input = collectionDirectory instanceof URL ? fileURLToPath(collectionDirectory) : collectionDirectory

console.log('OH Play Community Pack Collection Validator')

try {
  const result = validateCommunityPackCollection(input)
  if (result.total === 0 && result.valid) console.log('No submitted community packs found.')
  for (const pack of result.results) {
    console.log(`Validating: ${pack.packId}`)
    if (pack.valid) {
      console.log('✓ VALID')
    } else {
      console.error('✗ INVALID')
      printIssues(pack.issues)
    }
  }
  if (!result.valid && result.results.length === 0) printIssues(result.issues)
  console.log(`${result.total} packs validated`)
  console.log(`${result.validCount} valid`)
  console.log(`${result.invalidCount} invalid`)
  if (!result.valid) process.exitCode = 1
} catch {
  console.error('INTERNAL ERROR — the community-pack collection validator could not complete.')
  process.exitCode = 2
}
