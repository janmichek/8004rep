import { lookup } from 'node:dns/promises'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { isIP } from 'node:net'
import { checkServerIdentity } from 'node:tls'
import { brotliDecompressSync, gunzipSync, inflateSync } from 'node:zlib'

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

type Resolved = { address: string; family: 4 | 6 }

/**
 * Resolve the host once, reject any private answer, and return the address the
 * request must connect to. Pinning this address closes the DNS-rebinding gap:
 * the HTTP client never resolves the name a second time.
 */
async function resolvePublic(url: URL): Promise<Resolved[]> {
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const version = isIP(host)
  const entries = version
    ? [{ address: host, family: version }]
    : (await lookup(host, { all: true })).map((entry) => ({ address: entry.address, family: entry.family }))
  if (!entries.length) throw new Error('Host did not resolve')
  if (entries.some((entry) => isPrivateIp(entry.address))) throw new Error('Blocked private address')
  return entries.map((entry) => ({ address: entry.address, family: entry.family === 6 ? 6 : 4 }))
}

type RawResponse = { status: number; location: string | null; body: string }

/** One GET to an already-validated IP, preserving the original Host and TLS name. */
function requestPinned(url: URL, pinned: Resolved): Promise<RawResponse> {
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  const hostHeader = url.hostname
  const secure = url.protocol === 'https:'
  const servername = isIP(hostname) ? undefined : hostname
  const port = url.port ? Number(url.port) : secure ? 443 : 80
  const defaultPort = secure ? 443 : 80
  return new Promise((resolve, reject) => {
    const request = secure ? httpsRequest : httpRequest
    const req = request(
      {
        host: pinned.address,
        family: pinned.family,
        port,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        ...(secure
          ? {
              ...(servername ? { servername } : {}),
              // Verify the certificate against the name the caller asked for,
              // not the IP we connected to.
              checkServerIdentity: (_host, cert) => checkServerIdentity(hostname, cert),
            }
          : {}),
        headers: {
          host: port === defaultPort ? hostHeader : `${hostHeader}:${port}`,
          accept: 'application/json, text/plain;q=0.9, */*;q=0.5',
          'accept-encoding': 'identity',
          'user-agent': '8004rep-indexer/0.1',
        },
      },
      (res) => {
        const status = res.statusCode ?? 0
        const location = (res.headers.location as string | undefined) ?? null
        if (status < 200 || status >= 300) {
          res.resume()
          resolve({ status, location, body: '' })
          return
        }
        const declared = Number(res.headers['content-length'] ?? 0)
        if (declared > MAX_BYTES) {
          res.destroy()
          reject(new Error('Body too large'))
          return
        }
        const encoding = String(res.headers['content-encoding'] ?? '').toLowerCase()
        let total = 0
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => {
          total += chunk.length
          if (total > MAX_BYTES) {
            res.destroy()
            reject(new Error('Body too large'))
            return
          }
          chunks.push(chunk)
        })
        res.on('end', () => {
          try {
            let body = Buffer.concat(chunks)
            if (encoding.includes('gzip')) body = gunzipSync(body, { maxOutputLength: MAX_BYTES })
            else if (encoding.includes('deflate')) body = inflateSync(body, { maxOutputLength: MAX_BYTES })
            else if (encoding.includes('br')) body = brotliDecompressSync(body, { maxOutputLength: MAX_BYTES })
            if (body.length > MAX_BYTES) throw new Error('Body too large')
            resolve({ status, location, body: body.toString('utf8') })
          } catch (error) {
            reject(error)
          }
        })
        res.on('error', reject)
      },
    )
    const timer = setTimeout(() => req.destroy(new Error('Request timed out')), TIMEOUT_MS)
    req.on('close', () => clearTimeout(timer))
    req.on('error', reject)
    req.end()
  })
}

async function fetchPublic(url: URL): Promise<string> {
  let current = url
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    let res: RawResponse | undefined
    let lastError: unknown
    for (const pinned of await resolvePublic(current)) {
      try {
        res = await requestPinned(current, pinned)
        break
      } catch (error) {
        lastError = error
      }
    }
    if (!res) throw lastError instanceof Error ? lastError : new Error('Request failed')
    if (res.status >= 300 && res.status < 400) {
      if (!res.location) throw new Error(`HTTP ${res.status} without location`)
      current = new URL(res.location, current)
      if (current.protocol !== 'https:' && current.protocol !== 'http:') throw new Error('Bad redirect scheme')
      continue
    }
    if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`)
    return res.body
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
  const [, params = '', payload = ''] = match
  // A data URI is already in memory, but reject it before decoding so a huge
  // payload cannot allocate a second, larger copy.
  if (payload.length > MAX_BYTES * 4) throw new Error('Body too large')
  const base64 = /;base64/i.test(params)
  const decoded = base64 ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload), 'utf8')
  if (decoded.length > MAX_BYTES) throw new Error('Body too large')
  return decoded.toString('utf8')
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
