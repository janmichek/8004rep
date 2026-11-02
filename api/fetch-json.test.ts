import { EventEmitter } from 'node:events'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const lookup = vi.fn<(host: string, options: unknown) => Promise<{ address: string }[]>>()
vi.mock('node:dns/promises', () => ({ lookup: (host: string, options: unknown) => lookup(host, options) }))

type Reply = { status: number; headers?: Record<string, string>; chunks?: string[]; fail?: boolean }
type Options = { host: string; servername: string; port: number | string; path: string; headers: Record<string, string> }

let replies: Reply[] = []
let options: Options[] = []

// A stand-in for one https request: the handler's own body reading, capping and
// redirect handling still run, only the socket is gone.
vi.mock('node:https', () => ({
  request: (opts: Options, onResponse: (res: unknown) => void) => {
    options.push(opts)
    const req = new EventEmitter() as EventEmitter & { end: () => void; destroy: () => void }
    req.destroy = () => {}
    req.end = () => {
      const reply = replies.shift()
      setImmediate(() => {
        if (!reply || reply.fail) return void req.emit('error', new Error('socket'))
        const res = new EventEmitter() as EventEmitter & {
          statusCode: number
          headers: Record<string, string>
          destroy: () => void
        }
        res.statusCode = reply.status
        res.headers = reply.headers ?? {}
        res.destroy = () => {}
        onResponse(res)
        setImmediate(() => {
          for (const chunk of reply.chunks ?? []) res.emit('data', Buffer.from(chunk))
          res.emit('end')
        })
      })
    }
    return req
  },
}))

const { default: handler, isPrivateIp } = await import('./fetch-json')

type Captured = { statusCode: number; headers: Record<string, string>; body: string }

async function call(url: string | null, method = 'GET'): Promise<Captured> {
  const req = {
    method,
    url: url === null ? '/api/fetch-json' : `/api/fetch-json?url=${encodeURIComponent(url)}`,
  } as IncomingMessage
  const out: Captured = { statusCode: 0, headers: {}, body: '' }
  const res = {
    set statusCode(value: number) {
      out.statusCode = value
    },
    setHeader: (key: string, value: string) => void (out.headers[key.toLowerCase()] = String(value)),
    end: (body: string) => void (out.body = body),
  } as unknown as ServerResponse
  await handler(req, res)
  return out
}

beforeEach(() => {
  replies = []
  options = []
  lookup.mockReset()
  lookup.mockResolvedValue([{ address: '93.184.216.34' }])
})

describe('isPrivateIp', () => {
  it.each([
    '0.0.0.0',
    '10.1.2.3',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '100.64.0.1',
    '100.127.0.1',
    '198.18.0.1',
    '198.19.0.1',
    '224.0.0.1',
    '255.255.255.255',
  ])('refuses the IPv4 address %s', (ip) => {
    expect(isPrivateIp(ip)).toBe(true)
  })

  it.each(['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.15.0.1', '172.32.0.1', '100.63.0.1', '100.128.0.1', '198.17.0.1'])(
    'allows the public IPv4 address %s',
    (ip) => {
      expect(isPrivateIp(ip)).toBe(false)
    },
  )

  it.each([
    '::1',
    '::',
    'fc00::1',
    'fd00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '0:0:0:0:0:ffff:7f00:1',
    '::ffff:7f00:1',
    '64:ff9b::7f00:1',
    '2002:7f00:1::1',
    '100::1',
    'ff02::1',
    'zz::1',
  ])('refuses the IPv6 address %s', (ip) => {
    expect(isPrivateIp(ip)).toBe(true)
  })

  it.each(['2606:4700:4700::1111', '2001:4860:4860::8888', '3fff::1', '2000::1'])(
    'allows the global unicast address %s',
    (ip) => {
      expect(isPrivateIp(ip)).toBe(false)
    },
  )
})

describe('the relay', () => {
  it('answers GET and nothing else', async () => {
    for (const method of ['POST', 'DELETE', 'HEAD', 'OPTIONS']) {
      expect(await call('https://example.com/a.json', method), method).toMatchObject({ statusCode: 405 })
    }
  })

  it('refuses a missing or unparseable url', async () => {
    expect(await call(null)).toMatchObject({ statusCode: 400, body: 'Bad url' })
    expect(await call('not a url')).toMatchObject({ statusCode: 400, body: 'Bad url' })
  })

  it('refuses any scheme but https', async () => {
    expect(await call('http://example.com/a.json')).toMatchObject({ statusCode: 400, body: 'https only' })
    expect(await call('file:///etc/passwd')).toMatchObject({ statusCode: 400, body: 'https only' })
  })

  it('blocks a host that resolves to a private address, and never opens the socket', async () => {
    lookup.mockResolvedValue([{ address: '169.254.169.254' }])
    expect(await call('https://metadata.example/latest')).toMatchObject({ statusCode: 400, body: 'Blocked host' })
    expect(options).toHaveLength(0)
  })

  it('blocks a host where only one of several answers is private', async () => {
    lookup.mockResolvedValue([{ address: '93.184.216.34' }, { address: '127.0.0.1' }])
    expect(await call('https://split.example/a.json')).toMatchObject({ statusCode: 400, body: 'Blocked host' })
  })

  it('blocks a host that resolves to nothing', async () => {
    lookup.mockResolvedValue([])
    expect(await call('https://empty.example/a.json')).toMatchObject({ statusCode: 400, body: 'Blocked host' })
  })

  it('reports a host that does not resolve', async () => {
    lookup.mockRejectedValue(new Error('ENOTFOUND'))
    expect(await call('https://nope.invalid/a.json')).toMatchObject({ statusCode: 502, body: 'Host did not resolve' })
  })

  it('takes an address literal without asking DNS, and still checks it', async () => {
    replies = [{ status: 200, chunks: ['{"ok":true}'] }]
    expect(await call('https://93.184.216.34/a.json')).toMatchObject({ statusCode: 200 })
    expect(lookup).not.toHaveBeenCalled()

    expect(await call('https://127.0.0.1/a.json')).toMatchObject({ statusCode: 400, body: 'Blocked host' })
    expect(await call('https://[::1]/a.json')).toMatchObject({ statusCode: 400, body: 'Blocked host' })
  })

  it('relays the body as JSON, with headers that stop a browser sniffing it', async () => {
    replies = [{ status: 200, chunks: ['{"name":', '"agent"}'] }]
    const res = await call('https://example.com/a.json')
    expect(res).toMatchObject({ statusCode: 200, body: '{"name":"agent"}' })
    expect(res.headers['content-type']).toBe('application/json')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['cache-control']).toContain('s-maxage=3600')
  })

  it('pins the connection to the address it validated, keeping the real host for TLS', async () => {
    lookup.mockResolvedValue([{ address: '93.184.216.34' }])
    replies = [{ status: 200, chunks: ['{}'] }]
    await call('https://example.com/dir/a.json?v=2')
    expect(options[0]).toMatchObject({
      host: '93.184.216.34',
      servername: 'example.com',
      path: '/dir/a.json?v=2',
      headers: { host: 'example.com' },
    })
  })

  it('keeps a non-default port', async () => {
    replies = [{ status: 200, chunks: ['{}'] }]
    await call('https://example.com:8443/a.json')
    expect(options[0]).toMatchObject({ port: '8443', headers: { host: 'example.com:8443' } })
  })

  it('reports an upstream that fails or answers an error status', async () => {
    replies = [{ status: 404 }]
    expect(await call('https://example.com/a.json')).toMatchObject({ statusCode: 502, body: 'Upstream HTTP 404' })

    replies = [{ fail: true, status: 0 }]
    expect(await call('https://example.com/a.json')).toMatchObject({ statusCode: 502, body: 'Upstream unreachable' })
  })

  it('refuses a body that is not JSON', async () => {
    replies = [{ status: 200, chunks: ['<html>nope</html>'] }]
    expect(await call('https://example.com/a.json')).toMatchObject({
      statusCode: 502,
      body: 'Upstream did not return JSON',
    })
  })

  it('refuses an empty body, which no JSON document can be', async () => {
    replies = [{ status: 204 }]
    expect(await call('https://example.com/a.json')).toMatchObject({
      statusCode: 502,
      body: 'Upstream did not return JSON',
    })
  })

  it('refuses a body larger than the cap, whether declared or streamed', async () => {
    replies = [{ status: 200, headers: { 'content-length': String(300 * 1024) } }]
    expect(await call('https://example.com/big.json')).toMatchObject({ statusCode: 413, body: 'Too large' })

    replies = [{ status: 200, chunks: ['x'.repeat(200 * 1024), 'x'.repeat(200 * 1024)] }]
    expect(await call('https://example.com/big.json')).toMatchObject({ statusCode: 413, body: 'Too large' })
  })

  it('follows a redirect, validating the new host on its own', async () => {
    lookup.mockResolvedValueOnce([{ address: '93.184.216.34' }]).mockResolvedValueOnce([{ address: '8.8.8.8' }])
    replies = [
      { status: 302, headers: { location: 'https://cdn.example/b.json' } },
      { status: 200, chunks: ['{"hop":2}'] },
    ]
    expect(await call('https://example.com/a.json')).toMatchObject({ statusCode: 200, body: '{"hop":2}' })
    expect(options.map((o) => o.host)).toEqual(['93.184.216.34', '8.8.8.8'])
  })

  it('blocks a redirect that leaves https, or lands on a private address', async () => {
    replies = [{ status: 301, headers: { location: 'http://example.com/b.json' } }]
    expect(await call('https://example.com/a.json')).toMatchObject({ statusCode: 400, body: 'https only' })

    lookup.mockResolvedValueOnce([{ address: '93.184.216.34' }]).mockResolvedValueOnce([{ address: '127.0.0.1' }])
    replies = [{ status: 302, headers: { location: 'https://inside.example/b.json' } }]
    expect(await call('https://example.com/a.json')).toMatchObject({ statusCode: 400, body: 'Blocked host' })
  })

  it('refuses a redirect to an unparseable location', async () => {
    replies = [{ status: 302, headers: { location: 'http://[bad' } }]
    expect(await call('https://example.com/a.json')).toMatchObject({ statusCode: 502, body: 'Bad redirect' })
  })

  it('treats a redirect without a location as the error status it is', async () => {
    replies = [{ status: 302 }]
    expect(await call('https://example.com/a.json')).toMatchObject({ statusCode: 502, body: 'Upstream HTTP 302' })
  })

  it('gives up on a redirect chain that never lands', async () => {
    replies = Array.from({ length: 6 }, () => ({
      status: 302 as const,
      headers: { location: 'https://example.com/next' },
    }))
    expect(await call('https://example.com/a.json')).toMatchObject({ statusCode: 502, body: 'Too many redirects' })
    expect(options).toHaveLength(5)
  })
})
