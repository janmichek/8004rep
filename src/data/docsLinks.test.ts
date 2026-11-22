import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { GLOSSARY_GROUPS } from './glossary'
import { METRIC_GROUPS } from './metricsGuide'
import { CHECK_DOCS, FLAG_DOCS, KIND_DOCS, LABEL_DOCS, WATERFALL_DOCS, docsAnchor } from './docsLinks'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function knownDocIds(): Set<string> {
  const ids = new Set<string>(['how', 'sybil', 'rules', 'metrics', 'limits', 'sources'])
  for (const group of [...GLOSSARY_GROUPS, ...METRIC_GROUPS]) {
    ids.add(group.id)
    const entries = 'entries' in group ? group.entries : group.metrics
    for (const entry of entries) ids.add(entry.id)
  }
  return ids
}

function vueFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...vueFiles(path))
    else if (name.endsWith('.vue')) out.push(path)
  }
  return out
}

/** Opening tags, including ones whose attributes contain `>`. */
function tags(source: string, name: string): string[] {
  const out: string[] = []
  const start = new RegExp(`<${name}\\b`, 'g')
  for (const match of source.matchAll(start)) {
    let i = match.index + match[0].length
    let quote = ''
    for (; i < source.length; i++) {
      const ch = source[i]
      if (quote) {
        if (ch === quote) quote = ''
        continue
      }
      if (ch === '"' || ch === "'") {
        quote = ch
        continue
      }
      if (ch === '>') break
    }
    out.push(source.slice(match.index, i + 1))
  }
  return out
}

describe('docsAnchor', () => {
  it('strips a hash and maps chip ids onto the real anchor', () => {
    expect(docsAnchor('#self')).toBe('self-review')
    expect(docsAnchor('out-of-range')).toBe('off-scale')
    expect(docsAnchor('#bulk')).toBe('bulk-writer')
    expect(docsAnchor('mass')).toBe('mass-reviewer')
    expect(docsAnchor('#filtered-score')).toBe('filtered-score')
    expect(docsAnchor('')).toBeUndefined()
    expect(docsAnchor(undefined)).toBeUndefined()
  })
})

describe('docs targets', () => {
  const ids = knownDocIds()

  it('points every flag, label, kind, waterfall step and tx check at a real section', () => {
    const targets = [
      ...Object.values(FLAG_DOCS),
      ...Object.values(LABEL_DOCS),
      ...Object.values(KIND_DOCS),
      ...Object.values(WATERFALL_DOCS),
      ...Object.values(CHECK_DOCS),
    ]
    expect(targets.length).toBeGreaterThan(0)
    for (const id of targets) expect(ids.has(id), id).toBe(true)
  })

  it('covers every waterfall step the report builds', () => {
    const report = readFileSync(join(ROOT, 'data/reputation/report.ts'), 'utf8')
    const steps = [...report.matchAll(/push\(\s*'([^']+)'/g)].map((match) => match[1])
    expect(steps.length).toBeGreaterThan(0)
    for (const step of steps) expect(WATERFALL_DOCS[step], step).toBeTruthy()
  })

  it('covers every tx-detail check id', () => {
    const source = readFileSync(join(ROOT, 'data/txChecks.ts'), 'utf8')
    const groups = new Set(['tx', 'file', 'payment', 'reviewer', 'agent'])
    const checkIds = [...source.matchAll(/id: '([^']+)'/g)].map((match) => match[1]).filter((id) => !groups.has(id))
    expect(checkIds.length).toBeGreaterThan(0)
    for (const id of checkIds) {
      expect(CHECK_DOCS[id], id).toBeTruthy()
      expect(ids.has(CHECK_DOCS[id]), id).toBe(true)
    }
  })

  it('gives every hint tooltip a docs target', () => {
    const hints = vueFiles(ROOT).flatMap((file) => tags(readFileSync(file, 'utf8'), 'Hint').map((tag) => ({ file, tag })))
    expect(hints.length).toBeGreaterThan(0)
    for (const { file, tag } of hints) expect(tag, file).toMatch(/\b:?docs=/)
  })

  it('gives every explained sort header a docs target', () => {
    const headers = vueFiles(ROOT).flatMap((file) =>
      tags(readFileSync(file, 'utf8'), 'SortHeader')
        .filter((tag) => /\btext=/.test(tag))
        .map((tag) => ({ file, tag })),
    )
    expect(headers.length).toBeGreaterThan(0)
    for (const { file, tag } of headers) expect(tag, file).toMatch(/\bdocs=/)
  })
})
