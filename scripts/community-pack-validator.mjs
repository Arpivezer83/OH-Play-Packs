// Dependency-free C2 validator for the C1 OH Play Pack schema. The checked-in
// JSON Schema remains the structural source of truth; this module adds only
// cross-field, provenance, capability, and filesystem checks it cannot express.

import { existsSync, lstatSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

// The private app is canonical. The same dependency-free validator is exported
// verbatim to the public starter kit, where the checked-in schema lives at
// ../schema instead of ../src/communityPacks.
const privateSchemaPath = fileURLToPath(new URL('../src/communityPacks/oh-play-pack.schema.json', import.meta.url))
const publicKitSchemaPath = fileURLToPath(new URL('../schema/oh-play-pack.schema.json', import.meta.url))
const schemaPath = existsSync(privateSchemaPath) ? privateSchemaPath : publicKitSchemaPath
export const COMMUNITY_PACK_SCHEMA = JSON.parse(readFileSync(schemaPath, 'utf8'))

export const VALIDATOR_TITLE = 'OH Play Community Pack Validator'

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function issue(code, path, message) {
  return { code, severity: 'error', path, message }
}

function propertyPath(path, property) {
  return path ? `${path}.${property}` : property
}

function arrayPath(path, index) {
  return `${path}[${index}]`
}

function isJsonEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function isValidUri(value) {
  try {
    return Boolean(new URL(value).protocol)
  } catch {
    return false
  }
}

function resolveSchemaRef(ref) {
  if (!ref.startsWith('#/')) return undefined
  return ref.slice(2).split('/').reduce((current, part) => current?.[part], COMMUNITY_PACK_SCHEMA)
}

/** Validates the C1 JSON Schema subset actually used by the checked-in schema.
 * It is intentionally generic enough that the schema, rather than a second
 * handwritten structural contract, decides required fields and enum values. */
function validateSchemaValue(value, schema, path, issues) {
  if (!isRecord(schema)) return
  if (typeof schema.$ref === 'string') {
    const resolved = resolveSchemaRef(schema.$ref)
    if (resolved) validateSchemaValue(value, resolved, path, issues)
    return
  }
  if (Array.isArray(schema.allOf)) {
    for (const child of schema.allOf) validateSchemaValue(value, child, path, issues)
  }
  if (Object.hasOwn(schema, 'const') && !isJsonEqual(value, schema.const)) {
    issues.push(issue('SCHEMA_CONST', path, `Must equal ${JSON.stringify(schema.const)}.`))
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((candidate) => isJsonEqual(value, candidate))) {
    issues.push(issue('SCHEMA_ENUM', path, `Must be one of: ${schema.enum.map((candidate) => JSON.stringify(candidate)).join(', ')}.`))
  }

  if (typeof schema.type === 'string') {
    const typeMatches = {
      object: isRecord(value),
      array: Array.isArray(value),
      string: typeof value === 'string',
      number: typeof value === 'number',
      integer: typeof value === 'number' && Number.isInteger(value),
      boolean: typeof value === 'boolean',
    }[schema.type]
    if (!typeMatches) {
      issues.push(issue('SCHEMA_TYPE', path, `Must be a ${schema.type}.`))
      return
    }
  }

  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
      issues.push(issue('SCHEMA_MIN_LENGTH', path, `Must contain at least ${schema.minLength} character${schema.minLength === 1 ? '' : 's'}.`))
    }
    if (typeof schema.pattern === 'string' && !(new RegExp(schema.pattern).test(value))) {
      issues.push(issue('SCHEMA_PATTERN', path, 'Does not match the required format.'))
    }
    if (schema.format === 'date' && !isValidIsoDate(value)) {
      issues.push(issue('SCHEMA_FORMAT', path, 'Must be a real ISO date (YYYY-MM-DD).'))
    }
    if (schema.format === 'uri' && !isValidUri(value)) {
      issues.push(issue('SCHEMA_FORMAT', path, 'Must be a valid URI.'))
    }
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
      issues.push(issue('SCHEMA_MIN_ITEMS', path, `Must contain at least ${schema.minItems} item${schema.minItems === 1 ? '' : 's'}.`))
    }
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) {
      issues.push(issue('SCHEMA_MAX_ITEMS', path, `Must contain no more than ${schema.maxItems} items.`))
    }
    if (schema.uniqueItems === true) {
      const seen = new Set()
      value.forEach((item, index) => {
        const key = JSON.stringify(item)
        if (seen.has(key)) issues.push(issue('SCHEMA_UNIQUE_ITEMS', arrayPath(path, index), 'Must not duplicate an earlier item.'))
        seen.add(key)
      })
    }
    if (isRecord(schema.items)) value.forEach((item, index) => validateSchemaValue(item, schema.items, arrayPath(path, index), issues))
    if (isRecord(schema.contains) && !value.some((item) => {
      const nestedIssues = []
      validateSchemaValue(item, schema.contains, path, nestedIssues)
      return nestedIssues.length === 0
    })) {
      issues.push(issue('SCHEMA_CONTAINS', path, 'Does not contain a required item.'))
    }
  }

  if (isRecord(value)) {
    if (typeof schema.minProperties === 'number' && Object.keys(value).length < schema.minProperties) {
      issues.push(issue('SCHEMA_MIN_PROPERTIES', path, `Must contain at least ${schema.minProperties} property.`))
    }
    if (Array.isArray(schema.required)) {
      for (const required of schema.required) {
        if (!Object.hasOwn(value, required)) issues.push(issue('SCHEMA_REQUIRED', propertyPath(path, required), 'Required field is missing.'))
      }
    }
    const properties = isRecord(schema.properties) ? schema.properties : {}
    for (const [key, childValue] of Object.entries(value)) {
      const childPath = propertyPath(path, key)
      if (Object.hasOwn(properties, key)) {
        validateSchemaValue(childValue, properties[key], childPath, issues)
      } else if (schema.additionalProperties === false) {
        issues.push(issue('SCHEMA_ADDITIONAL_PROPERTY', childPath, 'Field is not allowed by the C1 schema.'))
      } else if (isRecord(schema.additionalProperties)) {
        validateSchemaValue(childValue, schema.additionalProperties, childPath, issues)
      }
      if (isRecord(schema.propertyNames)) validateSchemaValue(key, schema.propertyNames, childPath, issues)
    }
  }
}

function validateLocalizedText(value, path, issues) {
  if (!isRecord(value)) return
  for (const language of ['en', 'hu']) {
    if (!isNonEmptyString(value[language])) {
      issues.push(issue('MISSING_LOCALIZATION', propertyPath(path, language), `Required ${language.toUpperCase()} text is missing or blank.`))
    }
  }
}

function validateStableId(value, path, issues) {
  const stableIdSchema = COMMUNITY_PACK_SCHEMA.$defs.stableId
  if (typeof value === 'string' && !(new RegExp(stableIdSchema.pattern).test(value))) {
    issues.push(issue('INVALID_STABLE_ID', path, 'Must be a lowercase kebab-case stable ID.'))
  }
}

function validateLicense(value, path, issues, code) {
  if (!isRecord(value) || !isNonEmptyString(value.id) || !isNonEmptyString(value.name)) {
    issues.push(issue(code, path, 'An explicit licence id and human-readable name are required.'))
  }
}

function addDuplicates(items, getId, path, code, noun, issues) {
  const firstIndex = new Map()
  items.forEach((item, index) => {
    const id = getId(item)
    if (typeof id !== 'string') return
    const previous = firstIndex.get(id)
    if (previous !== undefined) {
      issues.push(issue(code, arrayPath(path, index), `Duplicate ${noun} "${id}"; first declared at ${arrayPath(path, previous)}.`))
    } else {
      firstIndex.set(id, index)
    }
  })
}

function cardFieldExists(card, fieldPath) {
  if (fieldPath === 'name.secondaryName') return isRecord(card.name) && isNonEmptyString(card.name.secondaryName)
  if (fieldPath === 'summary') return isRecord(card.summary)
  if (fieldPath.startsWith('stats.')) return isRecord(card.stats) && Object.hasOwn(card.stats, fieldPath.slice('stats.'.length))
  if (fieldPath.startsWith('facts.')) {
    const factKey = fieldPath.slice('facts.'.length)
    return Array.isArray(card.facts) && card.facts.some((fact) => isRecord(fact) && fact.key === factKey)
  }
  return false
}

function requiredCardFieldPaths(card, statKeys) {
  const fields = statKeys.map((key) => `stats.${key}`)
  if (isRecord(card.name) && isNonEmptyString(card.name.secondaryName)) fields.push('name.secondaryName')
  if (isRecord(card.summary)) fields.push('summary')
  if (Array.isArray(card.facts)) {
    for (const fact of card.facts) if (isRecord(fact) && typeof fact.key === 'string') fields.push(`facts.${fact.key}`)
  }
  return fields
}

function validateGameCardsWorldPack(pack, issues) {
  if (!isRecord(pack.content) || !isRecord(pack.content.world)) return
  const world = pack.content.world
  const cards = Array.isArray(pack.content.cards) ? pack.content.cards.filter(isRecord) : []
  const stats = Array.isArray(world.stats) ? world.stats.filter(isRecord) : []
  const statKeys = stats.map((stat) => stat.key).filter((key) => typeof key === 'string')
  const cardIds = cards.map((card) => card.id).filter((id) => typeof id === 'string')

  validateStableId(pack.id, 'id', issues)
  validateLocalizedText(pack.title, 'title', issues)
  validateLocalizedText(pack.description, 'description', issues)
  validateStableId(world.id, 'content.world.id', issues)
  validateLocalizedText(world.title, 'content.world.title', issues)
  validateLocalizedText(world.description, 'content.world.description', issues)
  addDuplicates(cards, (card) => card.id, 'content.cards', 'DUPLICATE_CARD_ID', 'card id', issues)
  addDuplicates(stats, (stat) => stat.key, 'content.world.stats', 'DUPLICATE_STAT_KEY', 'stat key', issues)

  for (let index = 0; index < stats.length; index += 1) {
    const stat = stats[index]
    const path = arrayPath('content.world.stats', index)
    validateStableId(stat.key, `${path}.key`, issues)
    validateLocalizedText(stat.label, `${path}.label`, issues)
    if (stat.unit !== undefined) validateLocalizedText(stat.unit, `${path}.unit`, issues)
    if (!['higher-wins', 'lower-wins'].includes(stat.direction)) {
      issues.push(issue('INVALID_STAT_DIRECTION', `${path}.direction`, 'Must be "higher-wins" or "lower-wins".'))
    }
  }

  const orderedIds = Array.isArray(world.cardOrder) ? world.cardOrder : []
  addDuplicates(orderedIds, (id) => id, 'content.world.cardOrder', 'DUPLICATE_CARD_ORDER_ID', 'card-order id', issues)
  const declaredCardIds = new Set(cardIds)
  const orderedIdSet = new Set(orderedIds)
  orderedIds.forEach((id, index) => {
    if (typeof id === 'string' && !declaredCardIds.has(id)) {
      issues.push(issue('UNKNOWN_CARD_ORDER_ID', arrayPath('content.world.cardOrder', index), `Card order references unknown card id "${id}".`))
    }
  })
  cardIds.forEach((id, index) => {
    if (!orderedIdSet.has(id)) {
      issues.push(issue('CARD_NOT_IN_ORDER', `${arrayPath('content.cards', index)}.id`, `Card id "${id}" is missing from content.world.cardOrder.`))
    }
  })

  for (let cardIndex = 0; cardIndex < cards.length; cardIndex += 1) {
    const card = cards[cardIndex]
    const path = arrayPath('content.cards', cardIndex)
    validateStableId(card.id, `${path}.id`, issues)
    if (isRecord(card.name)) validateLocalizedText(card.name.display, `${path}.name.display`, issues)
    if (card.summary !== undefined) validateLocalizedText(card.summary, `${path}.summary`, issues)
    if (Array.isArray(card.facts)) {
      addDuplicates(card.facts.filter(isRecord), (fact) => fact.key, `${path}.facts`, 'DUPLICATE_FACT_KEY', 'fact key', issues)
      card.facts.forEach((fact, factIndex) => {
        if (!isRecord(fact)) return
        validateStableId(fact.key, `${arrayPath(`${path}.facts`, factIndex)}.key`, issues)
        validateLocalizedText(fact.label, `${arrayPath(`${path}.facts`, factIndex)}.label`, issues)
        validateLocalizedText(fact.value, `${arrayPath(`${path}.facts`, factIndex)}.value`, issues)
      })
    }
    const cardStats = isRecord(card.stats) ? card.stats : {}
    for (const [statKey, value] of Object.entries(cardStats)) {
      const statPath = propertyPath(`${path}.stats`, statKey)
      if (!statKeys.includes(statKey)) issues.push(issue('UNKNOWN_STAT_KEY', statPath, `Card references undeclared stat key "${statKey}".`))
      if (!isRecord(value) || !Number.isFinite(value.value)) {
        issues.push(issue('INVALID_STAT_VALUE', `${statPath}.value`, 'Stat value must be a finite number.'))
      }
      if (isRecord(value?.reportedRange)) {
        const range = value.reportedRange
        if (!Number.isFinite(range.min) || !Number.isFinite(range.max) || range.min > range.max) {
          issues.push(issue('INVALID_STAT_RANGE', `${statPath}.reportedRange`, 'Reported range must contain finite min/max values with min less than or equal to max.'))
        }
      }
      if (isRecord(value) && value.basis !== undefined) validateLocalizedText(value.basis, `${statPath}.basis`, issues)
    }
    for (const statKey of statKeys) {
      if (!Object.hasOwn(cardStats, statKey)) {
        issues.push(issue('MISSING_STAT_VALUE', `${path}.stats.${statKey}`, `Card is missing a value for declared stat "${statKey}".`))
      }
    }

    const sources = Array.isArray(card.sources) ? card.sources.filter(isRecord) : []
    const coveredFields = new Set()
    sources.forEach((source, sourceIndex) => {
      const sourcePath = arrayPath(`${path}.sources`, sourceIndex)
      validateStableId(source.id, `${sourcePath}.id`, issues)
      if (!isNonEmptyString(source.label)) issues.push(issue('MISSING_SOURCE_LABEL', `${sourcePath}.label`, 'Source label is required.'))
      if (!isNonEmptyString(source.url)) issues.push(issue('MISSING_SOURCE_URL', `${sourcePath}.url`, 'Source URL is required.'))
      if (typeof source.accessedAt === 'string' && !isValidIsoDate(source.accessedAt)) {
        issues.push(issue('INVALID_ACCESS_DATE', `${sourcePath}.accessedAt`, 'Must be a real ISO date (YYYY-MM-DD).'))
      }
      if (Array.isArray(source.fields)) {
        source.fields.forEach((fieldPath, fieldIndex) => {
          const fieldLocation = arrayPath(`${sourcePath}.fields`, fieldIndex)
          if (typeof fieldPath !== 'string' || !cardFieldExists(card, fieldPath)) {
            issues.push(issue('INVALID_PROVENANCE_FIELD_PATH', fieldLocation, `Source field path "${String(fieldPath)}" does not exist on this card.`))
            return
          }
          coveredFields.add(fieldPath)
        })
      }
    })
    for (const fieldPath of requiredCardFieldPaths(card, statKeys)) {
      if (!coveredFields.has(fieldPath)) {
        issues.push(issue('MISSING_PROVENANCE', `${path}.sources`, `No source declares coverage for factual field "${fieldPath}".`))
      }
    }

    if (isRecord(card.image)) {
      validateLocalizedText(card.image.alt, `${path}.image.alt`, issues)
      const attribution = card.image.attribution
      if (!isRecord(attribution)) continue
      validateLicense(attribution.license, `${path}.image.attribution.license`, issues, 'MISSING_ASSET_LICENSE')
      if (!isNonEmptyString(attribution.creator)) {
        issues.push(issue('MISSING_ASSET_CREATOR', `${path}.image.attribution.creator`, 'Asset creator is required.'))
      }
      if (attribution.origin === 'third-party' && !isNonEmptyString(attribution.sourcePageUrl) && !isNonEmptyString(attribution.originalFileUrl)) {
        issues.push(issue('MISSING_THIRD_PARTY_ASSET_PROVENANCE', `${path}.image.attribution`, 'A third-party asset needs a source page URL or original file URL.'))
      }
    }
  }

  const thirdPartyAssetCount = cards.filter((card) => isRecord(card.image) && isRecord(card.image.attribution) && card.image.attribution.origin === 'third-party').length
  if (isRecord(pack.rights)) {
    validateLicense(pack.rights.contentLicense, 'rights.contentLicense', issues, 'MISSING_CONTENT_LICENSE')
    if (pack.rights.includesThirdPartyAssets === true && thirdPartyAssetCount === 0) {
      issues.push(issue('THIRD_PARTY_ASSET_FLAG_MISMATCH', 'rights.includesThirdPartyAssets', 'Claims third-party assets exist, but no image is marked third-party.'))
    }
    if (pack.rights.includesThirdPartyAssets === false && thirdPartyAssetCount > 0) {
      issues.push(issue('THIRD_PARTY_ASSET_FLAG_MISMATCH', 'rights.includesThirdPartyAssets', 'Claims no third-party assets, but at least one image is marked third-party.'))
    }
  }

  const capabilities = Array.isArray(pack.capabilities) ? pack.capabilities : []
  const supportedCapabilities = COMMUNITY_PACK_SCHEMA.properties.capabilities.items.enum
  capabilities.forEach((capability, index) => {
    if (!supportedCapabilities.includes(capability)) {
      issues.push(issue('UNSUPPORTED_CAPABILITY', arrayPath('capabilities', index), `Unsupported capability "${String(capability)}".`))
    }
  })
  if (capabilities.includes('battle') && (cards.length === 0 || cards.length % 2 !== 0)) {
    issues.push(issue('BATTLE_CARD_COUNT', 'content.cards', `Battle requires an even, non-zero number of cards; got ${cards.length}.`))
  }
  if (capabilities.includes('recognition')) {
    if (cards.length < 4) {
      issues.push(issue('RECOGNITION_CARD_COUNT', 'content.cards', `Recognition requires at least 4 cards for the current four-option model; got ${cards.length}.`))
    }
    cards.forEach((card, index) => {
      if (!isRecord(card.image) || !isNonEmptyString(card.image.path) || !isRecord(card.name) || !isRecord(card.name.display)) {
        issues.push(issue('RECOGNITION_CARD_IDENTITY', arrayPath('content.cards', index), 'Recognition needs each card to have a display name and local image reference.'))
      }
    })
  }
}

/** Pure structural and semantic validation. It never reads the filesystem or
 * fetches a network URL, which keeps it deterministic for tests and tooling. */
export function validateCommunityPack(pack) {
  const issues = []
  validateSchemaValue(pack, COMMUNITY_PACK_SCHEMA, '', issues)
  if (isRecord(pack)) validateGameCardsWorldPack(pack, issues)
  return { valid: issues.length === 0, issues }
}

function isInside(root, candidate) {
  const pathFromRoot = relative(root, candidate)
  return pathFromRoot === '' || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== '..' && !isAbsolute(pathFromRoot))
}

function validateAssetFile(packRoot, imagePath, path, issues) {
  if (typeof imagePath !== 'string') return
  if (/^https?:\/\//i.test(imagePath)) {
    issues.push(issue('REMOTE_RUNTIME_ASSET', path, 'Runtime image paths must be local files, not HTTP(S) URLs.'))
    return
  }
  if (isAbsolute(imagePath)) {
    issues.push(issue('ABSOLUTE_ASSET_PATH', path, 'Runtime image path must be relative to the pack directory.'))
    return
  }
  if (imagePath.split(/[\\/]/).includes('..')) {
    issues.push(issue('ASSET_PATH_TRAVERSAL', path, 'Runtime image path must not contain ".." traversal.'))
    return
  }
  const candidate = resolve(packRoot, imagePath)
  if (!isInside(packRoot, candidate)) {
    issues.push(issue('ASSET_PATH_ESCAPE', path, 'Runtime image path resolves outside the pack directory.'))
    return
  }
  let metadata
  try {
    metadata = lstatSync(candidate)
  } catch {
    issues.push(issue('MISSING_ASSET', path, `Local runtime image "${imagePath}" does not exist.`))
    return
  }
  if (metadata.isDirectory()) {
    issues.push(issue('ASSET_NOT_FILE', path, `Runtime image "${imagePath}" is a directory, not a file.`))
    return
  }
  try {
    const resolvedAsset = realpathSync(candidate)
    if (!isInside(packRoot, resolvedAsset)) {
      issues.push(issue('ASSET_SYMLINK_ESCAPE', path, `Runtime image "${imagePath}" resolves outside the pack directory through a symlink.`))
      return
    }
    if (statSync(resolvedAsset).isDirectory()) {
      issues.push(issue('ASSET_NOT_FILE', path, `Runtime image "${imagePath}" resolves to a directory, not a file.`))
    }
  } catch {
    issues.push(issue('MISSING_ASSET', path, `Local runtime image "${imagePath}" could not be resolved.`))
  }
}

/** Filesystem layer for the CLI: resolves one pack directory safely, parses
 * its pack.json, then applies the pure validator and local-asset checks. */
export function validatePackDirectory(inputDirectory) {
  const issues = []
  const summary = { parsed: false, cards: 0, assets: 0 }
  if (!isNonEmptyString(inputDirectory)) {
    issues.push(issue('PACK_DIRECTORY_REQUIRED', 'path', 'Provide a pack directory containing pack.json.'))
    return { valid: false, issues, summary }
  }
  const requestedDirectory = resolve(inputDirectory)
  let packRoot
  try {
    if (!statSync(requestedDirectory).isDirectory()) {
      issues.push(issue('PACK_DIRECTORY_NOT_DIRECTORY', 'path', 'Pack input must be a directory containing pack.json.'))
      return { valid: false, issues, summary }
    }
    packRoot = realpathSync(requestedDirectory)
  } catch {
    issues.push(issue('PACK_DIRECTORY_NOT_FOUND', 'path', `Pack directory "${inputDirectory}" was not found or cannot be read.`))
    return { valid: false, issues, summary }
  }

  const manifestPath = join(packRoot, 'pack.json')
  let parsed
  try {
    const manifestRealPath = realpathSync(manifestPath)
    if (!isInside(packRoot, manifestRealPath)) {
      issues.push(issue('PACK_JSON_SYMLINK_ESCAPE', 'pack.json', 'pack.json resolves outside the pack directory through a symlink.'))
      return { valid: false, issues, summary }
    }
    if (!lstatSync(manifestPath).isFile() && !lstatSync(manifestPath).isSymbolicLink()) {
      issues.push(issue('PACK_JSON_NOT_FILE', 'pack.json', 'pack.json must be a file.'))
      return { valid: false, issues, summary }
    }
    const raw = readFileSync(manifestPath, 'utf8')
    parsed = JSON.parse(raw)
    summary.parsed = true
  } catch (error) {
    if (error instanceof SyntaxError) {
      issues.push(issue('PACK_JSON_INVALID', 'pack.json', 'pack.json is not valid JSON.'))
    } else {
      issues.push(issue('PACK_JSON_MISSING', 'pack.json', 'pack.json is missing or cannot be read.'))
    }
    return { valid: false, issues, summary }
  }

  const validation = validateCommunityPack(parsed)
  issues.push(...validation.issues)
  const cards = isRecord(parsed?.content) && Array.isArray(parsed.content.cards) ? parsed.content.cards.filter(isRecord) : []
  summary.cards = cards.length
  cards.forEach((card, index) => {
    if (!isRecord(card.image)) return
    if (typeof card.image.path === 'string') summary.assets += 1
    validateAssetFile(packRoot, card.image.path, `${arrayPath('content.cards', index)}.image.path`, issues)
  })
  return { valid: issues.length === 0, issues, summary }
}
