import { describe, expect, it } from 'vitest'
import { redactError } from './redact'

describe('redactError', () => {
  it('removes credentials, secret query values and long path keys from URLs', () => {
    const message = redactError(
      new Error(
        'request failed https://user:pass@rpc.example.com/v3/abcdefghijklmnopqrstuvwxyz012345?apiKey=supersecret and https://rpc.example.com/v3/anotherlongsecretkey1234567890',
      ),
    )
    expect(message).not.toContain('pass')
    expect(message).not.toContain('supersecret')
    expect(message).not.toContain('abcdefghijklmnopqrstuvwxyz012345')
    expect(message).not.toContain('anotherlongsecretkey1234567890')
    expect(message).toContain('[redacted]')
  })

  it('keeps ordinary messages and caps the length', () => {
    expect(redactError(new Error('HTTP 429'))).toBe('HTTP 429')
    expect(redactError(new Error('x'.repeat(500)))).toHaveLength(300)
  })
})
