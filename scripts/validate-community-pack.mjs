#!/usr/bin/env node

import { VALIDATOR_TITLE, validatePackDirectory } from './community-pack-validator.mjs'

function printIssue(issue) {
  console.error(`[${issue.code}]`)
  console.error(issue.path || 'pack')
  console.error(issue.message)
  console.error('')
}

const inputDirectory = process.argv[2]
console.log(VALIDATOR_TITLE)

if (!inputDirectory) {
  console.error('Usage: npm run validate:community-pack -- <path-to-pack-directory>')
  process.exitCode = 2
} else {
  try {
    const result = validatePackDirectory(inputDirectory)
    if (!result.valid) {
      console.error(`INVALID — ${result.issues.length} error${result.issues.length === 1 ? '' : 's'}`)
      console.error('')
      result.issues.forEach(printIssue)
      process.exitCode = 1
    } else {
      console.log('✓ pack.json parsed')
      console.log('✓ schema version 1 supported')
      console.log(`✓ ${result.summary.cards} cards`)
      console.log(`✓ ${result.summary.assets} local assets present`)
      console.log('✓ provenance complete')
      console.log('✓ licensing metadata complete')
      console.log('')
      console.log('VALID')
    }
  } catch {
    console.error('INTERNAL ERROR — the validator could not complete. Please report this with the pack directory path.')
    process.exitCode = 2
  }
}
