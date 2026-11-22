/**
 * Error text safe for persistence and public health endpoints. RPC providers
 * commonly echo the request URL (including API keys) in transport errors, so
 * strip credentials, query secrets and any bare URL before the message leaves
 * the process.
 */
export function redactError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message
    .replace(/\bhttps?:\/\/[^\s"'`<>]+/gi, (raw) => {
      try {
        const url = new URL(raw)
        const secretQuery = [...url.searchParams.keys()].some((key) => /key|token|secret|auth|pass/i.test(key))
        if (url.username || url.password || secretQuery) return `${url.origin}/[redacted]`
        const path = url.pathname
          .split('/')
          .map((part) => (/^(?:key|token|secret)$/i.test(part) || /^[A-Za-z0-9_-]{24,}$/.test(part) ? '[redacted]' : part))
          .join('/')
        return `${url.origin}${path}`
      } catch {
        return '[url]'
      }
    })
    .replace(/\b(api[-_]?key|key|token|secret|access[-_]?token)=([^\s&]+)/gi, '$1=[redacted]')
    .replace(/\b(bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[redacted]')
    .replace(/\b(0x[0-9a-f]{64,})\b/gi, '[redacted]')
    .slice(0, 300)
}
