import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const TIMEOUT_MS = 8_000
const MAX_BYTES = 512 * 1024
const MAX_HOPS = 4

/** Same policy as `api/fetch-json.ts`: only plainly public addresses pass. */
export function isPrivateIp(ip: string): boolean {
  if (ip.includes(':')) {
    const first = parseInt(ip.toLowerCase().split(':')[0] || '0', 16)
    if (Number.isNaN(first)) return true
    return first < 0x2000 || first > 0x3fff || first === 0x2002
  }
  const [a, b] = ip.split('.').map(Number)
  if (a === undefined || b === undefined || Number.isNaN(a) || Number.isNaN(b)) return true
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  )
}

async function assertPublic(url: URL): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const ips = isIP(host) ? [host] : (await lookup(host, { all: true })).map((entry) => entry.address)
  if (!ips.length) throw new Error('Host did not resolve')
  if (ips.some(isPrivateIp)) throw new Error('Blocked private address')
}

async function fetchPublic(url: URL): Promise<string> {
  let current = url
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    await assertPublic(current)
    const res = await fetch(current, {
      redirect: 'manual',
      headers: { accept: 'application/json, text/plain;q=0.9, */*;q=0.5', 'user-agent': '8004rep-indexer/0.1' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) throw new Error(`HTTP ${res.status} without location`)
      current = new URL(location, current)
      if (current.protocol !== 'https:' && current.protocol !== 'http:') throw new Error('Bad redirect scheme')
      continue
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const declared = Number(res.headers.get('content-length') ?? 0)
    if (declared > MAX_BYTES) throw new Error('Body too large')
    const text = await res.text()
    if (text.length > MAX_BYTES) throw new Error('Body too large')
    return text
  }
  throw new Error('Too many redirects')
}

const IPFS_GATEWAYS = [
  'https://ipfs.filebase.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
]

function decodeDataUri(uri: string): string {
  const match = /^data:([^,]*),(.*)$/is.exec(uri)
  if (!match) throw new Error('Malformed data: URI')
  const [, params, payload] = match
  return /;base64/i.test(params)
    ? Buffer.from(payload, 'base64').toString('utf8')
    : decodeURIComponent(payload)
}

/** Reads a `data:`, `ipfs://` or `http(s)://` document as text. Never reads a private host. */
export async function fetchText(uri: string): Promise<string> {
  const value = uri.trim()
  if (/^data:/i.test(value)) return decodeDataUri(value)
  if (value.startsWith('ipfs://')) {
    const path = value.slice('ipfs://'.length).replace(/^ipfs\//, '')
    let lastError: unknown
    for (const gateway of IPFS_GATEWAYS) {
      try {
        return await fetchPublic(new URL(gateway + path))
      } catch (error) {
        lastError = error
      }
    }
    throw lastError instanceof Error ? lastError : new Error('IPFS fetch failed')
  }
  if (/^https?:\/\//i.test(value)) return fetchPublic(new URL(value))
  throw new Error('Unsupported URI scheme')
}
