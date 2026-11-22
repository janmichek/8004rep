import { describe, expect, it } from 'vitest'
import { fetchText, isPrivateIp } from './httpFetch'

const MAX_BYTES = 512 * 1024

describe('isPrivateIp', () => {
  it('accepts global unicast addresses', () => {
    expect(isPrivateIp('8.8.8.8')).toBe(false)
    expect(isPrivateIp('1.1.1.1')).toBe(false)
    expect(isPrivateIp('2606:4700:4700::1111')).toBe(false)
  })

  it('blocks loopback, link-local, RFC1918 and metadata', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true)
    expect(isPrivateIp('10.0.0.1')).toBe(true)
    expect(isPrivateIp('172.16.0.1')).toBe(true)
    expect(isPrivateIp('192.168.1.1')).toBe(true)
    expect(isPrivateIp('169.254.169.254')).toBe(true)
    expect(isPrivateIp('100.64.0.1')).toBe(true)
  })

  it('blocks IPv6 lookback, unique-local, link-local and IPv4-mapped', () => {
    expect(isPrivateIp('::1')).toBe(true)
    expect(isPrivateIp('fc00::1')).toBe(true)
    expect(isPrivateIp('fe80::1')).toBe(true)
    expect(isPrivateIp('::ffff:127.0.0.1')).toBe(true)
    expect(isPrivateIp('2002:7f00:1::')).toBe(true)
  })
})

describe('fetchText limits', () => {
  it('rejects a percent-encoded data URI above the byte cap', async () => {
    await expect(fetchText(`data:text/plain,${'a'.repeat(MAX_BYTES + 1)}`)).rejects.toThrow('Body too large')
  })

  it('rejects a base64 data URI whose decoded body is too large', async () => {
    const payload = Buffer.alloc(MAX_BYTES + 1, 0x61).toString('base64')
    await expect(fetchText(`data:text/plain;base64,${payload}`)).rejects.toThrow('Body too large')
  })

  it('still reads a small data URI', async () => {
    expect(await fetchText('data:text/plain,hello')).toBe('hello')
  })
})
