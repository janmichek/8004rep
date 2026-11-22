import { describe, expect, it } from 'vitest'
import { isPrivateIp } from './httpFetch'

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
