import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchJsonUri,
  fetchUriBytes,
  normalizeRegistrationFile,
  resolveAgentURI,
  resolveFeedbackText,
  toDisplayUrl,
} from './metadata'

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 500, json: async () => body } as Response
}

afterEach(() => vi.unstubAllGlobals())

describe('toDisplayUrl', () => {
  it('passes http(s) and inline images', () => {
    expect(toDisplayUrl('https://example.com/a.png')).toBe('https://example.com/a.png')
    expect(toDisplayUrl('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA')
  })

  it('maps ipfs to a gateway', () => {
    expect(toDisplayUrl('ipfs://bafy/logo.png')).toBe('https://ipfs.filebase.io/ipfs/bafy/logo.png')
    expect(toDisplayUrl('ipfs://ipfs/bafy')).toBe('https://ipfs.filebase.io/ipfs/bafy')
  })

  it('rejects script and other schemes', () => {
    expect(toDisplayUrl('javascript:alert(1)')).toBeUndefined()
    expect(toDisplayUrl(' JavaScript:alert(1)')).toBeUndefined()
    expect(toDisplayUrl('data:text/html,<script>1</script>')).toBeUndefined()
    expect(toDisplayUrl('not a url')).toBeUndefined()
    expect(toDisplayUrl(42)).toBeUndefined()
  })
})

describe('normalizeRegistrationFile', () => {
  it('reads the current services shape', () => {
    const file = normalizeRegistrationFile({
      name: 'Swap bot',
      description: 'Swaps',
      active: true,
      x402Support: true,
      services: [{ name: 'MCP', endpoint: 'https://a.example/mcp', version: '2025-06-18' }],
      supportedTrust: ['reputation'],
    })
    expect(file).toMatchObject({
      name: 'Swap bot',
      active: true,
      x402Support: true,
      services: [{ name: 'MCP', endpoint: 'https://a.example/mcp', version: '2025-06-18' }],
      supportedTrust: ['reputation'],
    })
  })

  it('reads the legacy endpoints shape', () => {
    const file = normalizeRegistrationFile({
      endpoints: [{ type: 'A2A', value: 'https://a.example/card.json', meta: { version: '0.3' } }],
      x402support: false,
      trustModels: ['reputation'],
    })
    expect(file?.services).toEqual([{ name: 'A2A', endpoint: 'https://a.example/card.json', version: '0.3' }])
    expect(file?.x402Support).toBe(false)
    expect(file?.supportedTrust).toEqual(['reputation'])
  })

  it('drops malformed fields instead of throwing', () => {
    const file = normalizeRegistrationFile({
      name: 7,
      active: 'yes',
      services: [null, 'x', { name: 'MCP' }, { name: 'web', endpoint: 'https://ok.example' }],
      supportedTrust: 'reputation',
    })
    expect(file).toMatchObject({ name: undefined, active: undefined, supportedTrust: [] })
    expect(file?.services).toEqual([{ name: 'web', endpoint: 'https://ok.example' }])
  })

  it('returns null for non-objects', () => {
    for (const value of [null, 'text', 3, []]) expect(normalizeRegistrationFile(value)).toBeNull()
  })
})

describe('resolveAgentURI', () => {
  it('decodes base64 data URIs without fetching, including UTF-8', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const json = JSON.stringify({ name: 'Agënt ✓' })
    const base64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)))
    const uri = `data:application/json;base64,${base64}`
    expect((await resolveAgentURI(uri))?.name).toBe('Agënt ✓')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('decodes percent-encoded data URIs', async () => {
    const uri = `data:application/json,${encodeURIComponent('{"name":"plain"}')}`
    expect((await resolveAgentURI(uri))?.name).toBe('plain')
  })

  it('falls back to the next ipfs gateway and starts there next time', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue(jsonResponse({ name: 'from second gateway' }))
    vi.stubGlobal('fetch', fetchMock)
    expect((await resolveAgentURI('ipfs://bafyfallback'))?.name).toBe('from second gateway')
    await resolveAgentURI('ipfs://bafyother')
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      'https://ipfs.filebase.io/ipfs/bafyfallback',
      'https://gateway.pinata.cloud/ipfs/bafyfallback',
      'https://gateway.pinata.cloud/ipfs/bafyother',
    ])
  })

  it('fetches at most six files at once', async () => {
    let running = 0
    let peak = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        peak = Math.max(peak, ++running)
        await new Promise((resolve) => setTimeout(resolve, 5))
        running--
        return jsonResponse({ name: 'x' })
      }),
    )
    const files = await Promise.all(
      Array.from({ length: 20 }, (_, i) => resolveAgentURI(`https://ok.example/many-${i}.json`)),
    )
    expect(files.every((f) => f?.name === 'x')).toBe(true)
    expect(peak).toBe(6)
  })

  it('resolves null when the file is unreachable, and retries next time', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonResponse({ name: 'back' }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await resolveAgentURI('https://down.example/agent.json')).toBeNull()
    expect((await resolveAgentURI('https://down.example/agent.json'))?.name).toBe('back')
  })

  it('caches successful lookups', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ name: 'cached' }))
    vi.stubGlobal('fetch', fetchMock)
    await resolveAgentURI('https://ok.example/cached.json')
    await resolveAgentURI('https://ok.example/cached.json')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('resolves null for missing, unsupported or broken URIs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, false)))
    expect(await resolveAgentURI(null)).toBeNull()
    expect(await resolveAgentURI('  ')).toBeNull()
    expect(await resolveAgentURI('ftp://example.com/a.json')).toBeNull()
    expect(await resolveAgentURI('data:application/json;base64,!!!notbase64')).toBeNull()
    expect(await resolveAgentURI('https://ok.example/500.json')).toBeNull()
  })
})

describe('fetchJsonUri', () => {
  it('returns raw JSON for data URIs without fetching', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const uri = `data:application/json,${encodeURIComponent('{"a":1}')}`
    expect(await fetchJsonUri(uri)).toEqual({ a: 1 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects on unreachable hosts and retries next time', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonResponse({ a: 2 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchJsonUri('https://down.example/x.json')).rejects.toThrow('Failed to fetch')
    expect(await fetchJsonUri('https://down.example/x.json')).toEqual({ a: 2 })
  })
})

describe('resolveFeedbackText', () => {
  it('reads text, falling back to comment', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const text = `data:application/json,${encodeURIComponent('{"text":"great work"}')}`
    const comment = `data:application/json,${encodeURIComponent('{"comment":"ok but slow"}')}`
    expect(await resolveFeedbackText(text)).toBe('great work')
    expect(await resolveFeedbackText(comment)).toBe('ok but slow')
  })

  it('resolves undefined for non-objects, missing text, and unreachable URIs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    expect(await resolveFeedbackText(`data:application/json,${encodeURIComponent('[1,2]')}`)).toBeUndefined()
    expect(await resolveFeedbackText(`data:application/json,${encodeURIComponent('{"nocomment":1}')}`)).toBeUndefined()
    expect(await resolveFeedbackText(`data:application/json,${encodeURIComponent('{"text":42}')}`)).toBeUndefined()
    expect(await resolveFeedbackText(null)).toBeUndefined()
    expect(await resolveFeedbackText('https://down.example/f.json')).toBeUndefined()
  })
})

describe('fetchUriBytes', () => {
  const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes)

  it('decodes data: URIs of any media type without a request', async () => {
    vi.stubGlobal('fetch', vi.fn())
    expect(text(await fetchUriBytes(`data:application/json;base64,${btoa('{"a":1}')}`))).toBe('{"a":1}')
    expect(text(await fetchUriBytes('data:text/plain,%7B%22a%22%3A1%7D'))).toBe('{"a":1}')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns the served bytes untouched, falling back across IPFS gateways', async () => {
    const body = new TextEncoder().encode('{ "a": 1 }\n')
    const served = { ok: true, status: 200, arrayBuffer: async () => body.buffer } as Response
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(served)
    vi.stubGlobal('fetch', fetchMock)
    expect(text(await fetchUriBytes('ipfs://bafy-bytes/f.json'))).toBe('{ "a": 1 }\n')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('rejects unsupported schemes and HTTP errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response))
    await expect(fetchUriBytes('ar://abc')).rejects.toThrow('Unsupported URI scheme')
    await expect(fetchUriBytes('https://files.example/missing.json')).rejects.toThrow('HTTP 404')
  })
})
