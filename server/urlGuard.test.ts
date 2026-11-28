import { describe, expect, it } from 'vitest';
import { blockedHost, blockedUrl } from './urlGuard';

describe('blockedHost', () => {
  it('blocks local names and private IPv4 ranges', () => {
    for (const host of [
      'localhost',
      'app.local',
      '127.0.0.1',
      '10.1.2.3',
      '192.168.0.1',
      '169.254.1.1',
    ]) {
      expect(blockedHost(host)).toBe(true);
    }
  });

  it('blocks IPv6 and leaves public hosts alone', () => {
    expect(blockedHost('[::1]')).toBe(true);
    expect(blockedHost('example.com')).toBe(false);
    expect(blockedHost('8.8.8.8')).toBe(false);
  });
});

describe('blockedUrl', () => {
  it('defaults to https only for the relay', () => {
    expect(blockedUrl(new URL('http://example.com'))).toBe(true);
    expect(blockedUrl(new URL('https://example.com'))).toBe(false);
  });

  it('accepts http when the probe allows it', () => {
    expect(blockedUrl(new URL('http://example.com'), ['http:', 'https:'])).toBe(false);
    expect(blockedUrl(new URL('http://127.0.0.1'), ['http:', 'https:'])).toBe(true);
  });
});
