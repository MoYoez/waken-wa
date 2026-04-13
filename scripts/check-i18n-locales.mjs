import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const rootDir = process.cwd()
const localesRoot = path.join(rootDir, 'public', 'locales')
const baseLocale = 'zh-CN'
const compareLocale = 'en'
const sourceRoots = ['app', 'components', 'hooks', 'lib', 'proxy.ts']
const sourceFileExtensions = new Set(['.ts', '.tsx', '.js', '.jsx'])

async function walkJsonFiles(dir, prefix = '') {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walkJsonFiles(fullPath, relative)))
      continue
    }
    if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(relative)
    }
  }

  return files.sort()
}

async function walkSourceFiles(entryPath) {
  const fullPath = path.join(rootDir, entryPath)
  const entries = await readdir(fullPath, { withFileTypes: true }).catch(async () => null)
  if (!entries) {
    return sourceFileExtensions.has(path.extname(entryPath)) ? [entryPath] : []
  }

  const files = []
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue

    const relativePath = path.join(entryPath, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walkSourceFiles(relativePath)))
      continue
    }
    if (entry.isFile() && sourceFileExtensions.has(path.extname(entry.name))) {
      files.push(relativePath)
    }
  }
  return files.sort()
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function collectLeafKeys(value, prefix = '') {
  if (!isPlainObject(value)) {
    return prefix ? [prefix] : []
  }

  const keys = []
  for (const [key, nestedValue] of Object.entries(value)) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key
    if (isPlainObject(nestedValue)) {
      keys.push(...collectLeafKeys(nestedValue, nextPrefix))
      continue
    }
    keys.push(nextPrefix)
  }
  return keys.sort()
}

function diffItems(left, right) {
  const rightSet = new Set(right)
  return left.filter((item) => !rightSet.has(item))
}

function collectSourceTranslationKeys(source) {
  const keys = []
  const translationCallPattern = /\bt\(\s*(['"])([^'"]+)\1/g
  for (const match of source.matchAll(translationCallPattern)) {
    keys.push(match[2])
  }
  return keys
}

async function readJson(filePath) {
  const raw = await readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

async function main() {
  const baseDir = path.join(localesRoot, baseLocale)
  const compareDir = path.join(localesRoot, compareLocale)

  const baseFiles = await walkJsonFiles(baseDir)
  const compareFiles = await walkJsonFiles(compareDir)

  const missingCompareFiles = diffItems(baseFiles, compareFiles)
  const missingBaseFiles = diffItems(compareFiles, baseFiles)
  const keyIssues = []
  const namespaceKeysByLocale = new Map()

  for (const relativeFile of baseFiles.filter((file) => compareFiles.includes(file))) {
    const baseJson = await readJson(path.join(baseDir, relativeFile))
    const compareJson = await readJson(path.join(compareDir, relativeFile))
    const baseKeys = collectLeafKeys(baseJson)
    const compareKeys = collectLeafKeys(compareJson)
    const namespace = relativeFile.replace(/\.json$/, '')

    for (const [locale, keys] of [
      [baseLocale, baseKeys],
      [compareLocale, compareKeys],
    ]) {
      if (!namespaceKeysByLocale.has(locale)) {
        namespaceKeysByLocale.set(locale, new Set())
      }
      const localeKeys = namespaceKeysByLocale.get(locale)
      for (const key of keys) {
        localeKeys.add(`${namespace}:${key}`)
        localeKeys.add(key)
      }
    }

    const missingCompareKeys = diffItems(baseKeys, compareKeys)
    const missingBaseKeys = diffItems(compareKeys, baseKeys)

    if (missingCompareKeys.length > 0 || missingBaseKeys.length > 0) {
      keyIssues.push({
        file: relativeFile,
        missingCompareKeys,
        missingBaseKeys,
      })
    }
  }

  const sourceFiles = (await Promise.all(sourceRoots.map((entry) => walkSourceFiles(entry)))).flat()
  const missingSourceKeys = []
  for (const relativeFile of sourceFiles) {
    const source = await readFile(path.join(rootDir, relativeFile), 'utf8')
    for (const key of collectSourceTranslationKeys(source)) {
      const missingLocales = [baseLocale, compareLocale].filter(
        (locale) => !namespaceKeysByLocale.get(locale)?.has(key),
      )
      if (missingLocales.length > 0) {
        missingSourceKeys.push({ file: relativeFile, key, missingLocales })
      }
    }
  }

  if (
    missingCompareFiles.length === 0 &&
    missingBaseFiles.length === 0 &&
    keyIssues.length === 0 &&
    missingSourceKeys.length === 0
  ) {
    console.log(
      `i18n locale check passed: ${baseLocale} and ${compareLocale} are in sync, and source keys resolve.`,
    )
    return
  }

  if (missingCompareFiles.length > 0) {
    console.error(`Missing files in ${compareLocale}:`)
    for (const file of missingCompareFiles) console.error(`  - ${file}`)
  }

  if (missingBaseFiles.length > 0) {
    console.error(`Missing files in ${baseLocale}:`)
    for (const file of missingBaseFiles) console.error(`  - ${file}`)
  }

  for (const issue of keyIssues) {
    console.error(`Key mismatch in ${issue.file}:`)
    if (issue.missingCompareKeys.length > 0) {
      console.error(`  Missing in ${compareLocale}:`)
      for (const key of issue.missingCompareKeys) console.error(`    - ${key}`)
    }
    if (issue.missingBaseKeys.length > 0) {
      console.error(`  Missing in ${baseLocale}:`)
      for (const key of issue.missingBaseKeys) console.error(`    - ${key}`)
    }
  }

  if (missingSourceKeys.length > 0) {
    console.error('Missing source translation keys:')
    for (const issue of missingSourceKeys) {
      console.error(
        `  - ${issue.key} in ${issue.file} (missing in ${issue.missingLocales.join(', ')})`,
      )
    }
  }

  process.exitCode = 1
}

await main()
