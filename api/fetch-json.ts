import type { IncomingMessage, ServerResponse } from 'node:http'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const TIMEOUT_MS = 8_000
const MAX_BYTES = 256 * 1024

function isPrivateIp(ip: string): boolean {
  if (ip.includes(':')) {
    const v = ip.toLowerCase()
    return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:')
  }
  const [a, b] = ip.split('.').map(Number)
  return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)
}

function send(res: ServerResponse, status: number, body: string, type = 'text/plain') {
  res.statusCode = status
  res.setHeader('content-type', type)
  res.setHeader('cache-control', status === 200 ? 'public, s-maxage=3600, max-age=300' : 'no-store')
  res.end(body)
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const raw = new URL(req.url ?? '', 'http://local').searchParams.get('url')
  let target: URL
  try {
    target = new URL(raw ?? '')
  } catch {
    return send(res, 400, 'Bad url')
  }
  if (target.protocol !== 'https:') return send(res, 400, 'https only')

  // Follow redirects manually so every hop is validated against the private-IP block.
  let current = target
  let upstream: Response | null = null
  for (let hop = 0; hop < 5; hop++) {
    const host = current.hostname.replace(/^\[|\]$/g, '')
    const ips = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address)
    if (!ips.length || ips.some(isPrivateIp)) return send(res, 400, 'Blocked host')
    upstream = await fetch(current, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (upstream.status >= 300 && upstream.status < 400) {
      const loc = upstream.headers.get('location')
      if (!loc) break
      try { current = new URL(loc, current) } catch { return send(res, 502, 'Bad redirect') }
      if (current.protocol !== 'https:') return send(res, 400, 'https only')
      continue
    }
    break
  }
  if (!upstream || (upstream.status >= 300 && upstream.status < 400)) return send(res, 502, 'Too many redirects')
  if (!upstream.ok) return send(res, 502, `Upstream HTTP ${upstream.status}`)
  const buf = new Uint8Array(await upstream.arrayBuffer())
  if (buf.byteLength > MAX_BYTES) return send(res, 413, 'Too large')
  const text = new TextDecoder().decode(buf)
  JSON.parse(text)
  send(res, 200, text, 'application/json')
}