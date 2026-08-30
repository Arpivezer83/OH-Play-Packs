// C3 submission helpers deliberately build on the C2 validator. They add
// repository-directory policy and changed-pack selection; they never execute
// code from a contributed pack.

import { closeSync, existsSync, lstatSync, openSync, readdirSync, readFileSync, readSync, statSync } from 'node:fs'
import { extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validatePackDirectory } from './community-pack-validator.mjs'

// C3 is the private ingestion layout. C4A exports this exact helper to the
// standalone public kit, whose submission root is packs/game-cards.
const publicKitSchemaPath = fileURLToPath(new URL('../schema/oh-play-pack.schema.json', import.meta.url))
const isPublicPackKit = existsSync(publicKitSchemaPath)
export const COMMUNITY_PACKS_DIRECTORY = isPublicPackKit ? 'packs/game-cards' : 'community-packs/game-cards'
export const COMMUNITY_PACKS_REPOSITORY_PATH = isPublicPackKit ? 'packs/game-cards' : 'apps/cestlavie/apps/oh-play/community-packs/game-cards'
export const ALLOWED_SUBMISSION_ASSET_EXTENSIONS = new Set(['.avif', '.jpeg', '.jpg', '.png', '.webp'])
export const EXECUTABLE_FILE_EXTENSIONS = new Set(['.cjs', '.js', '.mjs', '.sh', '.ts', '.tsx'])
const ALLOWED_ROOT_FILES = new Set(['pack.json', 'README.md', 'README.txt'])

// Hostile-submission ceilings (security hardening pass): a card pack is a
// handful of small card portraits, never a bulk asset drop. These bound the
// work a reviewer's machine and CI runner do on a single submission, so a
// pathological pack (one huge file, or thousands of tiny ones) fails fast
// with a clear reason instead of degrading validation for everyone.
export const MAX_SUBMISSION_ASSET_BYTES = 8 * 1024 * 1024 // 8 MB per asset file
export const MAX_SUBMISSION_FILE_COUNT = 200 // total files anywhere under the pack directory

// Magic-byte signatures for the four allowed raster formats. A file's
// extension is a claim the contributor makes; this checks the bytes agree
// with it, so an executable, script, or disguised SVG renamed to ".png"
// cannot pass as a legitimate asset just because of its file name.
function matchesPngSignature(buffer) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  return signature.every((byte, index) => buffer[index] === byte)
}
function matchesJpegSignature(buffer) {
  return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
}
function matchesWebpSignature(buffer) {
  return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'
}
function matchesAvifSignature(buffer) {
  if (buffer.toString('ascii', 4, 8) !== 'ftyp') return false
  const brand = buffer.toString('ascii', 8, 12)
  return brand === 'avif' || brand === 'avis' || brand === 'mif1' || brand === 'msf1'
}
const IMAGE_SIGNATURE_CHECKS = new Map([
  ['.png', matchesPngSignature],
  ['.jpg', matchesJpegSignature],
  ['.jpeg', matchesJpegSignature],
  ['.webp', matchesWebpSignature],
  ['.avif', matchesAvifSignature],
])

/** Reads only the first 16 bytes of a file — enough to identify any of the
 * four allowed raster signatures — regardless of how large the file is, so
 * checking a maliciously huge file costs a handful of bytes, not a full read. */
export function readFileSignature(path, length = 16) {
  const buffer = Buffer.alloc(length)
  const fd = openSync(path, 'r')
  try {
    const bytesRead = readSync(fd, buffer, 0, length, 0)
    return buffer.subarray(0, bytesRead)
  } finally {
    closeSync(fd)
  }
}

/** True only if `path`'s actual leading bytes match the raster format its
 * extension claims. An unrecognized extension is not this function's
 * concern — the caller already rejects those separately. */
export function assetContentMatchesExtension(path, extension) {
  const check = IMAGE_SIGNATURE_CHECKS.get(extension)
  if (!check) return true
  try {
    return check(readFileSignature(path))
  } catch {
    return false
  }
}

function issue(code, path, message) {
  return { code, severity: 'error', path, message }
}

function isDirectory(path) {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

function isRealDirectory(path) {
  try {
    const metadata = lstatSync(path)
    return metadata.isDirectory() && !metadata.isSymbolicLink()
  } catch {
    return false
  }
}

function toPortablePath(path) {
  return path.split(sep).join('/')
}

/** Finds actual pack roots only: immediate directories with a pack.json.
 * Documentation files in the catalogue root never become validator input. */
export function discoverCommunityPackDirectories(collectionDirectory) {
  const root = resolve(collectionDirectory)
  if (!isDirectory(root)) return []
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
    .map((entry) => join(root, entry.name))
    .filter((directory) => existsSync(join(directory, 'pack.json')))
    .sort((a, b) => a.localeCompare(b))
}

function walkSubmissionDirectory(root, current, issues, state) {
  for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    state.fileCount += 1
    if (state.fileCount > MAX_SUBMISSION_FILE_COUNT) {
      if (!state.tooManyFilesReported) {
        state.tooManyFilesReported = true
        issues.push(issue('TOO_MANY_SUBMISSION_FILES', toPortablePath(relative(root, current)) || '.', `A submitted pack may contain at most ${MAX_SUBMISSION_FILE_COUNT} files in total.`))
      }
      return
    }
    const entryPath = join(current, entry.name)
    const path = toPortablePath(relative(root, entryPath))
    let metadata
    try {
      metadata = lstatSync(entryPath)
    } catch {
      issues.push(issue('UNREADABLE_PACK_ENTRY', path, 'Pack entry cannot be read.'))
      continue
    }
    if (metadata.isSymbolicLink()) {
      issues.push(issue('SUBMISSION_SYMLINK_NOT_ALLOWED', path, 'Submitted pack directories must not contain symlinks.'))
      continue
    }
    if (metadata.isDirectory()) {
      if (current === root && entry.name !== 'assets') {
        issues.push(issue('UNEXPECTED_PACK_DIRECTORY', path, 'Only the assets directory is allowed beside pack.json and an optional README.'))
        continue
      }
      walkSubmissionDirectory(root, entryPath, issues, state)
      if (state.tooManyFilesReported) return
      continue
    }
    if (!metadata.isFile()) {
      issues.push(issue('UNSUPPORTED_PACK_ENTRY', path, 'Pack entries must be regular files.'))
      continue
    }
    if (current === root) {
      if (!ALLOWED_ROOT_FILES.has(entry.name)) {
        const code = EXECUTABLE_FILE_EXTENSIONS.has(extname(entry.name).toLowerCase()) ? 'EXECUTABLE_PACK_FILE' : 'UNEXPECTED_PACK_FILE'
        issues.push(issue(code, path, 'Only pack.json and an optional README may be stored beside the assets directory.'))
      }
      continue
    }
    if (!path.startsWith('assets/')) {
      issues.push(issue('UNEXPECTED_PACK_FILE', path, 'Files may only live in the assets directory.'))
      continue
    }
    const extension = extname(entry.name).toLowerCase()
    if (EXECUTABLE_FILE_EXTENSIONS.has(extension)) {
      issues.push(issue('EXECUTABLE_PACK_FILE', path, 'Executable or source-code files are not allowed in submitted packs.'))
      continue
    }
    if (!ALLOWED_SUBMISSION_ASSET_EXTENSIONS.has(extension)) {
      issues.push(issue('UNSUPPORTED_ASSET_FILE_TYPE', path, `Asset type "${extension || '(no extension)'}" is not allowed. Use AVIF, JPEG, PNG, or WebP raster assets.`))
      continue
    }
    if (metadata.size > MAX_SUBMISSION_ASSET_BYTES) {
      issues.push(issue('SUBMISSION_ASSET_TOO_LARGE', path, `Asset is ${metadata.size} bytes; submitted assets may be at most ${MAX_SUBMISSION_ASSET_BYTES} bytes.`))
      continue
    }
    if (!assetContentMatchesExtension(entryPath, extension)) {
      issues.push(issue('ASSET_CONTENT_MISMATCH', path, `File content does not match its "${extension}" extension — the actual file signature was not recognized as that format.`))
    }
  }
}

/** C3 file policy for the real submission catalogue. SVG remains acceptable in
 * C1/C2 examples but is deliberately excluded here because it is active-capable
 * content. C2 is still responsible for checking manifest image references. */
export function validateSubmissionFilePolicy(packDirectory) {
  const root = resolve(packDirectory)
  try {
    if (lstatSync(root).isSymbolicLink()) {
      return { valid: false, issues: [issue('SUBMISSION_SYMLINK_NOT_ALLOWED', 'path', 'Submitted pack directories must not be symlinks.')] }
    }
  } catch {
    return { valid: false, issues: [issue('PACK_DIRECTORY_NOT_FOUND', 'path', 'Pack directory was not found or cannot be read.')] }
  }
  const issues = []
  if (!isDirectory(root)) {
    return { valid: false, issues: [issue('PACK_DIRECTORY_NOT_FOUND', 'path', 'Pack directory was not found or cannot be read.')] }
  }
  walkSubmissionDirectory(root, root, issues, { fileCount: 0, tooManyFilesReported: false })
  return { valid: issues.length === 0, issues }
}

function readPackId(packDirectory) {
  try {
    const pack = JSON.parse(readFileSync(join(packDirectory, 'pack.json'), 'utf8'))
    return typeof pack.id === 'string' ? pack.id : undefined
  } catch {
    return undefined
  }
}

/** Validates one actual submission pack without duplicating C2 pack logic. */
export function validateCommunityPackSubmissionDirectory(packDirectory) {
  const packValidation = validatePackDirectory(packDirectory)
  const filePolicy = validateSubmissionFilePolicy(packDirectory)
  const directoryName = toPortablePath(relative(resolve(packDirectory, '..'), resolve(packDirectory)))
  const packId = readPackId(packDirectory)
  const issues = [...packValidation.issues, ...filePolicy.issues]
  if (packId && directoryName !== packId) {
    issues.push(issue('PACK_DIRECTORY_ID_MISMATCH', 'path', `Submission directory "${directoryName}" must match pack id "${packId}".`))
  }
  return {
    valid: issues.length === 0,
    issues,
    summary: packValidation.summary,
    packId: packId ?? directoryName,
  }
}

/** Validates every actual pack directory in a collection in stable order. */
export function validateCommunityPackCollection(collectionDirectory) {
  const root = resolve(collectionDirectory)
  if (!isDirectory(root)) {
    const collectionIssue = issue('COMMUNITY_PACKS_DIRECTORY_NOT_FOUND', 'path', `Community pack directory "${collectionDirectory}" was not found or cannot be read.`)
    return { valid: false, issues: [collectionIssue], results: [], total: 0, validCount: 0, invalidCount: 0 }
  }
  const collectionIssues = []
  for (const entry of readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const entryPath = join(root, entry.name)
    if (entry.isSymbolicLink()) {
      collectionIssues.push(issue('SUBMISSION_SYMLINK_NOT_ALLOWED', entry.name, 'Submitted pack roots must not be symlinks.'))
    } else if (entry.isDirectory() && !existsSync(join(entryPath, 'pack.json'))) {
      collectionIssues.push(issue('UNEXPECTED_PACK_DIRECTORY', entry.name, 'Every directory in this collection must be one submitted pack with pack.json.'))
    } else if (!entry.isDirectory() && entry.name !== 'README.md') {
      collectionIssues.push(issue('UNEXPECTED_COLLECTION_FILE', entry.name, 'Only README.md and pack directories belong in this collection.'))
    }
  }
  const results = discoverCommunityPackDirectories(root).map((directory) => ({ directory, ...validateCommunityPackSubmissionDirectory(directory) }))
  const invalidCount = results.filter((result) => !result.valid).length + (collectionIssues.length > 0 ? 1 : 0)
  return {
    valid: invalidCount === 0,
    issues: [...collectionIssues, ...results.flatMap((result) => result.issues)],
    results,
    total: results.length,
    validCount: results.filter((result) => result.valid).length,
    invalidCount,
  }
}

function normalizeRepositoryPath(path) {
  return path.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/, '')
}

/** Parses `git diff --name-status` output. A rename contributes both its old
 * and new paths so that removals and newly introduced pack roots are explicit. */
export function parseGitDiffNameStatus(text) {
  return text.split(/\r?\n/).flatMap((line) => {
    if (!line.trim()) return []
    const [status, ...paths] = line.split('\t')
    if (!status || paths.length === 0) return []
    return paths.filter(Boolean).map((path) => ({ status: status[0], path: normalizeRepositoryPath(path) }))
  })
}

/** Maps diff paths nested under a submission pack to that immediate pack root.
 * A collection README or unrelated monorepo path does not become a pack. */
export function findChangedSubmissionPackRoots(changes, submissionRepositoryPath = COMMUNITY_PACKS_REPOSITORY_PATH) {
  const root = normalizeRepositoryPath(submissionRepositoryPath)
  const roots = new Map()
  for (const change of changes) {
    const path = normalizeRepositoryPath(typeof change === 'string' ? change : change.path)
    if (!path.startsWith(`${root}/`)) continue
    const segments = path.slice(root.length + 1).split('/').filter(Boolean)
    if (segments.length < 2) continue
    const packRoot = `${root}/${segments[0]}`
    const status = typeof change === 'string' ? 'M' : change.status
    const statuses = roots.get(packRoot) ?? []
    statuses.push(status)
    roots.set(packRoot, statuses)
  }
  return [...roots.entries()]
    .map(([path, statuses]) => ({ path, statuses }))
    .sort((a, b) => a.path.localeCompare(b.path))
}

/** Resolves selected diff roots against the local catalogue. A root that only
 * has deleted diff entries is deliberately reported as deleted; a new or
 * modified root without pack.json is an actionable incomplete submission. */
export function detectChangedCommunityPacks(changes, {
  collectionDirectory,
  submissionRepositoryPath = COMMUNITY_PACKS_REPOSITORY_PATH,
}) {
  const roots = findChangedSubmissionPackRoots(changes, submissionRepositoryPath)
  const changedPackDirectories = []
  const deletedPackRoots = []
  const incompletePackRoots = []
  for (const root of roots) {
    const directoryName = root.path.slice(normalizeRepositoryPath(submissionRepositoryPath).length + 1).split('/')[0]
    const directory = join(resolve(collectionDirectory), directoryName)
    if (existsSync(join(directory, 'pack.json')) && isRealDirectory(directory)) {
      changedPackDirectories.push(directory)
    } else if (root.statuses.every((status) => status === 'D')) {
      deletedPackRoots.push(root.path)
    } else {
      incompletePackRoots.push(root.path)
    }
  }
  return { changedPackDirectories, deletedPackRoots, incompletePackRoots }
}
