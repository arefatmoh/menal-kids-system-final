import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(process.cwd(), 'lib', 'i18n')

function listDomainFiles(langDir) {
  return fs.readdirSync(langDir)
    .filter(f => f.endsWith('.ts') && f !== 'index.ts')
    .map(f => path.join(langDir, f))
}

function extractKeysFromDefaultObject(filePath) {
  const src = fs.readFileSync(filePath, 'utf8')
  const start = src.indexOf('export default {')
  if (start === -1) return []
  const body = src.slice(start + 'export default {'.length)
  const end = body.lastIndexOf('}')
  const objectText = end !== -1 ? body.slice(0, end) : body
  const keys = new Set()
  const lines = objectText.split('\n')
  const keyLine = /^\s*([a-zA-Z0-9_]+)\s*:\s*([`"'])/ // key: " or ' or `
  for (const line of lines) {
    const m = line.match(keyLine)
    if (m) keys.add(m[1])
  }
  return [...keys]
}

function collectKeys(lang) {
  const dir = path.join(root, lang)
  const files = listDomainFiles(dir)
  const aggregate = new Set()
  files.forEach(fp => {
    extractKeysFromDefaultObject(fp).forEach(k => aggregate.add(k))
  })
  return aggregate
}

try {
  const enKeys = collectKeys('en')
  const amKeys = collectKeys('am')

  const missingInAm = [...enKeys].filter(k => !amKeys.has(k))
  const extraInAm = [...amKeys].filter(k => !enKeys.has(k))

  if (missingInAm.length === 0 && extraInAm.length === 0) {
    console.log('i18n parity OK: am matches en keys')
    process.exit(0)
  }

  if (missingInAm.length > 0) {
    console.error('Missing in am:', missingInAm.join(', '))
  }
  if (extraInAm.length > 0) {
    console.error('Extra in am (not in en):', extraInAm.join(', '))
  }
  process.exit(1)
} catch (e) {
  console.error('i18n check failed:', e.message)
  process.exit(2)
}


