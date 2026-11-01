/**
 * Stars for agents, owners and reviewers — localStorage only, no backend.
 *
 * Each star is tied to its chain, so mainnet and testnet never mix.
 * Agents are keyed by token id; owners and reviewers by lowercased address.
 */
import { computed, ref } from 'vue'

export type StarKind = 'agent' | 'owner' | 'reviewer'

export type Star = {
  kind: StarKind
  chainId: number
  /** Token id for agents, lowercased 0x address for owners and reviewers. */
  id: string
  /** Name captured when starred, so the starred list needs no fetch. */
  label: string
  /** Agent image captured when starred; the list falls back to a generated avatar. */
  image?: string
}

const KINDS: readonly StarKind[] = ['agent', 'owner', 'reviewer']
const KEY = '8004rep:stars'
/** Written by the earlier bookmarks feature; read once, then removed. */
const LEGACY_KEY = '8004rep:bookmarks'

function normalizeId(kind: StarKind, id: string | bigint): string {
  const value = id.toString()
  return kind === 'agent' ? value : value.toLowerCase()
}

export function starKey(kind: StarKind, chainId: number, id: string | bigint): string {
  return `${kind}:${chainId}:${normalizeId(kind, id)}`
}

function valid(value: unknown): value is Star {
  if (typeof value !== 'object' || value === null) return false
  const row = value as Partial<Star>
  return (
    KINDS.includes(row.kind as StarKind) &&
    Number.isInteger(row.chainId) &&
    typeof row.id === 'string' &&
    row.id !== '' &&
    typeof row.label === 'string' &&
    (row.image === undefined || typeof row.image === 'string')
  )
}

function loadStored(): Star[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const data: unknown = JSON.parse(raw)
    return Array.isArray(data) ? data.filter(valid) : []
  } catch {
    return []
  }
}

/** Old bookmarks ({ mainnet, testnet } of { chainId, tokenId }) become agent stars. */
function loadLegacy(): Star[] {
  let raw: string | null
  try {
    raw = localStorage.getItem(LEGACY_KEY)
    if (raw === null) return []
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    return []
  }
  try {
    const data = JSON.parse(raw) as { mainnet?: unknown; testnet?: unknown }
    const rows = [...(Array.isArray(data.mainnet) ? data.mainnet : []), ...(Array.isArray(data.testnet) ? data.testnet : [])]
    return rows.flatMap((row): Star[] => {
      const { chainId, tokenId } = (row ?? {}) as { chainId?: unknown; tokenId?: unknown }
      if (!Number.isInteger(chainId) || typeof tokenId !== 'string' || !/^\d+$/.test(tokenId)) return []
      return [{ kind: 'agent', chainId: chainId as number, id: tokenId, label: '' }]
    })
  } catch {
    return []
  }
}

function save(next: Star[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Private mode: the list still works for this session.
  }
}

function load(): Star[] {
  const stored = loadStored()
  const legacy = loadLegacy()
  if (legacy.length === 0) return stored
  const seen = new Set(stored.map((row) => starKey(row.kind, row.chainId, row.id)))
  const merged = [...stored, ...legacy.filter((row) => !seen.has(starKey(row.kind, row.chainId, row.id)))]
  save(merged)
  return merged
}

const store = ref<Star[]>(load())

/** Newest star first. */
export const starred = computed(() => store.value)
export const starCount = computed(() => store.value.length)

export function isStarred(kind: StarKind, chainId: number, id: string | bigint): boolean {
  const key = starKey(kind, chainId, id)
  return store.value.some((row) => starKey(row.kind, row.chainId, row.id) === key)
}

/** Adds the star if absent, removes it if present. */
export function toggleStar(entry: {
  kind: StarKind
  chainId: number
  id: string | bigint
  label: string
  image?: string
}): void {
  const key = starKey(entry.kind, entry.chainId, entry.id)
  const list = store.value
  const next = list.some((row) => starKey(row.kind, row.chainId, row.id) === key)
    ? list.filter((row) => starKey(row.kind, row.chainId, row.id) !== key)
    : [
        {
          kind: entry.kind,
          chainId: entry.chainId,
          id: normalizeId(entry.kind, entry.id),
          label: entry.label,
          ...(entry.image ? { image: entry.image } : {}),
        },
        ...list,
      ]
  store.value = next
  save(next)
}
