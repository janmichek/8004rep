import type { RegistrationFile, Service } from './types'

// Public gateways that send CORS headers. ipfs.io and dweb.link rate-limit hard (429), so they go last.
const IPFS_GATEWAYS = [
  'https://ipfs.filebase.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
]
const FETCH_TIMEOUT_MS = 8000
/** A list page resolves a file per row; more parallel requests than this get gateways to throttle us. */
const MAX_CONCURRENT_FETCHES = 6

/** `ipfs://<cid>/path` and `ipfs://ipfs/<cid>/path` → `<cid>/path`. */
function ipfsPath(uri: string): string {
  return uri.slice('ipfs://'.length).replace(/^ipfs\//, '')
}

/**
 * URL safe to put in `href`/`src`, or undefined. Registration files are
 * untrusted, so only http(s), ipfs (via gateway) and inline images pass.
 */
export function toDisplayUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const s = value.trim()
  if (s.startsWith('ipfs://')) return IPFS_GATEWAYS[0] + ipfsPath(s)
  if (/^data:image\//i.test(s)) return s
  try {
    const url = new URL(s)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined
  } catch {
    return undefined
  }
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function bool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Accepts current `services[]` entries and legacy `endpoints[]` ones (`type`/`value`/`meta.version`). */
function toService(item: unknown): Service | undefined {
  if (!isRecord(item)) return undefined
  const name = str(item.name) ?? str(item.type)
  const endpoint = str(item.endpoint) ?? str(item.value)
  if (!name || !endpoint) return undefined
  const version = str(item.version) ?? (isRecord(item.meta) ? str(item.meta.version) : undefined)
  return { name, endpoint, ...(version ? { version } : {}) }
}

/** Null when `json` is not a registration object; never throws. */
export function normalizeRegistrationFile(json: unknown): RegistrationFile | null {
  if (!isRecord(json)) return null
  const services = Array.isArray(json.services) ? json.services : json.endpoints
  const trust = Array.isArray(json.supportedTrust) ? json.supportedTrust : json.trustModels
  return {
    name: str(json.name),
    description: str(json.description),
    image: str(json.image),
    active: bool(json.active),
    x402Support: bool(json.x402Support) ?? bool(json.x402support),
    services: Array.isArray(services) ? services.flatMap((s) => toService(s) ?? []) : [],
    supportedTrust: Array.isArray(trust) ? trust.flatMap((t) => str(t) ?? []) : [],
    raw: json,
  }
}

function decodeDataUri(uri: string): unknown {
  const match = /^data:application\/json([^,]*),(.*)$/is.exec(uri)
  if (!match) return null
  const [, params, payload] = match
  const text = /;base64/i.test(params)
    ? new TextDecoder().decode(Uint8Array.from(atob(payload), (c) => c.charCodeAt(0)))
    : decodeURIComponent(payload)
  return JSON.parse(text)
}

let activeFetches = 0
const waitingFetches: (() => void)[] = []

/** Runs `task` once one of the {@link MAX_CONCURRENT_FETCHES} slots is free. */
async function limited<T>(task: () => Promise<T>): Promise<T> {
  // A finishing task hands its slot straight to the next waiter.
  if (activeFetches >= MAX_CONCURRENT_FETCHES) await new Promise<void>((resolve) => waitingFetches.push(resolve))
  else activeFetches++
  try {
    return await task()
  } finally {
    const next = waitingFetches.shift()
    if (next) next()
    else activeFetches--
  }
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return new Uint8Array(await res.arrayBuffer())
}

/** Index of the gateway that answered last; tried first next time. */
let preferredGateway = 0

/** Tries the gateways in turn, starting with the one that answered last. */
async function fetchIpfs<T>(uri: string, get: (url: string) => Promise<T>): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < IPFS_GATEWAYS.length; i++) {
    const index = (preferredGateway + i) % IPFS_GATEWAYS.length
    try {
      const body = await get(IPFS_GATEWAYS[index] + ipfsPath(uri))
      preferredGateway = index
      return body
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}

async function load(uri: string): Promise<unknown> {
  if (/^data:/i.test(uri)) return decodeDataUri(uri)
  if (uri.startsWith('ipfs://')) return limited(() => fetchIpfs(uri, fetchJson))
  if (/^https?:\/\//i.test(uri)) return limited(() => fetchJson(uri))
  return null
}

const jsonCache = new Map<string, Promise<unknown>>()

/**
 * Fetches the JSON behind a `data:` / `ipfs://` / `https://` URI, cached by
 * URI and shared across at most MAX_CONCURRENT_FETCHES requests. Rejects on
 * unreachable hosts, CORS failures and bad JSON; failures are not cached.
 */
export function fetchJsonUri(uri: string | null | undefined): Promise<unknown> {
  const key = uri?.trim()
  if (!key) return Promise.resolve(null)
  const cached = jsonCache.get(key)
  if (cached) return cached
  const pending = load(key)
  jsonCache.set(key, pending)
  // Failures may be transient (gateway timeout); only keep successes.
  void pending.then(
    () => {},
    () => jsonCache.delete(key),
  )
  return pending
}

/** Payload of any `data:` URI, base64 or percent-encoded. */
function dataUriBytes(uri: string): Uint8Array {
  const match = /^data:([^,]*),(.*)$/is.exec(uri)
  if (!match) throw new Error('Malformed data: URI')
  const [, params, payload] = match
  return /;base64/i.test(params)
    ? Uint8Array.from(atob(payload), (c) => c.charCodeAt(0))
    : new TextEncoder().encode(decodeURIComponent(payload))
}

/**
 * The exact bytes behind a `data:` / `ipfs://` / `https://` URI, for
 * hashing against a commitment. Not cached; rejects on unsupported
 * schemes, unreachable hosts and CORS failures.
 */
export async function fetchUriBytes(uri: string): Promise<Uint8Array> {
  const key = uri.trim()
  if (/^data:/i.test(key)) return dataUriBytes(key)
  if (key.startsWith('ipfs://')) return limited(() => fetchIpfs(key, fetchBytes))
  if (/^https?:\/\//i.test(key)) return limited(() => fetchBytes(key))
  throw new Error('Unsupported URI scheme')
}

const cache = new Map<string, Promise<RegistrationFile | null>>()

/**
 * Fetches and normalizes the registration file behind an agent URI.
 * Null when there is no URI, the scheme is unsupported, or it cannot be
 * fetched/parsed (unreachable host, CORS, bad JSON). Never rejects.
 */
export function resolveAgentURI(uri: string | null | undefined): Promise<RegistrationFile | null> {
  const key = uri?.trim()
  if (!key) return Promise.resolve(null)
  const cached = cache.get(key)
  if (cached) return cached
  const pending = fetchJsonUri(key).then(normalizeRegistrationFile, () => null)
  cache.set(key, pending)
  // Failures may be transient (gateway timeout); only keep successes.
  void pending.then((file) => {
    if (!file) cache.delete(key)
  })
  return pending
}

/**
 * Comment behind a feedback URI (`text` or legacy `comment` field).
 * Undefined when absent, not a string, or unreachable. Never rejects.
 */
export function resolveFeedbackText(uri: string | null | undefined): Promise<string | undefined> {
  return fetchJsonUri(uri).then(
    (json) => (isRecord(json) ? (str(json.text) ?? str(json.comment)) : undefined),
    () => undefined,
  )
}
