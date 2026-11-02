import type { IncomingMessage, ServerResponse } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const TIMEOUT_MS = 8_000
const MAX_BYTES = 256 * 1024
const MAX_HOPS = 5

/**
 * Blocks everything that is not plainly a public address. IPv6 is allowlisted
 * rather than denylisted: only global unicast (2000::/3) passes, minus 6to4
 * (2002::/16, which embeds an arbitrary IPv4), so loopback, unique-local,
 * link-local, NAT64 (64:ff9b::/96) and every spelling of an IPv4-mapped
 * address (`::ffff:127.0.0.1`, `0:0:0:0:0:ffff:7f00:1`) are refused without
 * having to enumerate them.
 */
export function isPrivateIp(ip: string): boolean {
  if (ip.includes(':')) {
    const first = parseInt(ip.toLowerCase().split(':')[0] || '0', 16)
    if (Number.isNaN(first)) return true
    return first < 0x2000 || first > 0x3fff || first === 0x2002
  }
  const [a, b] = ip.split('.').map(Number)
  if (a === undefined || b === undefined || Number.isNaN(a) || Number.isNaN(b)) return true
  return (
    a === 0 || // this host
    a === 10 ||
    a === 127 ||
    a >= 224 || // multicast and broadcast
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, incl. cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) // benchmarking
  )
}

function send(res: ServerResponse, status: number, body: string, type = 'text/plain') {
  res.statusCode = status
  res.setHeader('content-type', type)
  res.setHeader('cache-control', status === 200 ? 'public, s-maxage=3600, max-age=300' : 'no-store')
  // The body is third-party text: never let a browser sniff it into HTML.
  res.setHeader('x-content-type-options', 'nosniff')
  res.end(body)
}

type Hop = {
  status: number
  location?: string
  /** Null when the upstream sent more than MAX_BYTES. */
  text: string | null
}

/**
 * One request, pinned to `ip`. Resolving the host and then handing the *name*
 * to a fetch would re-resolve it, so an attacker's DNS could answer the check
 * with a public address and the connection with `169.254.169.254` (rebinding).
 * Connecting to the validated address, with `servername` and `Host` kept as the
 * real host so TLS and virtual hosting still work, closes that window.
 */
function hop(target: URL, ip: string): Promise<Hop> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      {
        host: ip,
        servername: target.hostname,
        port: target.port || 443,
        path: `${target.pathname}${target.search}`,
        method: 'GET',
        headers: { host: target.host, accept: 'application/json' },
        timeout: TIMEOUT_MS,
      },
      (upstream) => {
        const declared = Number(upstream.headers['content-length'] ?? 0)
        const status = upstream.statusCode ?? 502
        const location = upstream.headers.location
        if (declared > MAX_BYTES) {
          upstream.destroy()
          resolve({ status, ...(location ? { location } : {}), text: null })
          return
        }
        const chunks: Buffer[] = []
        let total = 0
        upstream.on('data', (chunk: Buffer) => {
          total += chunk.byteLength
          // Stop at the cap instead of buffering a huge body to reject it after.
          if (total > MAX_BYTES) {
            upstream.destroy()
            resolve({ status, ...(location ? { location } : {}), text: null })
            return
          }
          chunks.push(chunk)
        })
        upstream.on('end', () =>
          resolve({ status, ...(location ? { location } : {}), text: Buffer.concat(chunks).toString('utf8') }),
        )
        upstream.on('error', reject)
      },
    )
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.on('error', reject)
    req.end()
  })
}

/** Either the address to connect to, or why the host was turned away. */
type Resolved = { ip: string } | { refuse: 'Blocked host' | 'Host did not resolve' }

/** Resolves `url`'s host and refuses it unless every answer is a public address. */
async function publicIpOf(url: URL): Promise<Resolved> {
  const host = url.hostname.replace(/^\[|\]$/g, '')
  let ips: string[]
  try {
    ips = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address)
  } catch {
    return { refuse: 'Host did not resolve' }
  }
  // One private answer blocks the host, so a split-horizon name cannot be used
  // to reach an internal service.
  if (!ips.length || ips.some(isPrivateIp)) return { refuse: 'Blocked host' }
  return { ip: ips[0] }
}

/**
 * Relays JSON from a public https URL, for browsers that cannot read it
 * directly (no CORS header on the upstream). It is an unauthenticated relay by
 * necessity — the URLs come from on-chain registration and feedback files, so
 * no host allowlist is possible — and is kept cheap to abuse by the GET-only,
 * https-only, 8s, 256KB, JSON-only limits plus a CDN cache. Rate limiting
 * belongs at the platform edge, not here.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') return send(res, 405, 'GET only')
  const raw = new URL(req.url ?? '', 'http://local').searchParams.get('url')
  let current: URL
  try {
    current = new URL(raw ?? '')
  } catch {
    return send(res, 400, 'Bad url')
  }
  if (current.protocol !== 'https:') return send(res, 400, 'https only')

  // Redirects are followed by hand so every hop is resolved and validated.
  let last: Hop | null = null
  for (let step = 0; step < MAX_HOPS; step++) {
    const resolved = await publicIpOf(current)
    if ('refuse' in resolved) {
      return send(res, resolved.refuse === 'Blocked host' ? 400 : 502, resolved.refuse)
    }
    try {
      last = await hop(current, resolved.ip)
    } catch {
      return send(res, 502, 'Upstream unreachable')
    }
    if (last.status < 300 || last.status >= 400) break
    if (!last.location) break
    try {
      current = new URL(last.location, current)
    } catch {
      return send(res, 502, 'Bad redirect')
    }
    if (current.protocol !== 'https:') return send(res, 400, 'https only')
    last = null
  }
  if (!last) return send(res, 502, 'Too many redirects')
  if (last.status < 200 || last.status >= 300) return send(res, 502, `Upstream HTTP ${last.status}`)
  if (last.text === null) return send(res, 413, 'Too large')
  try {
    JSON.parse(last.text)
  } catch {
    return send(res, 502, 'Upstream did not return JSON')
  }
  send(res, 200, last.text, 'application/json')
}
