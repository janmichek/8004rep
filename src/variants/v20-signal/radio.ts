/** The receiver's band, in MHz. */
export const BAND = { low: 88, high: 108 }

/** A stable carrier frequency for an agent, in the band. */
export function frequencyOf(tokenId: bigint | string): number {
  const n = Number(BigInt(tokenId) % 2000n)
  return BAND.low + (n / 2000) * (BAND.high - BAND.low)
}

export function freqText(freq: number): string {
  return `${freq.toFixed(2)} MHz`
}

/** S-meter reading for a 0–100 signal. */
export function sMeterOf(score: number | null | undefined): { s: number; label: string; bars: number } {
  if (score === null || score === undefined) return { s: 0, label: 'S0', bars: 0 }
  const bars = Math.max(0, Math.min(10, Math.round(score / 10)))
  const over = score >= 90 ? '+20' : score >= 80 ? '+10' : ''
  return { s: bars, label: `S${Math.min(9, bars)}${over ? ` ${over}` : ''}`, bars }
}

/** Emission mode named for the signal. */
export function modeOf(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'NO CARRIER'
  if (score >= 80) return 'FM STEREO'
  if (score >= 60) return 'FM MONO'
  if (score >= 40) return 'AM'
  if (score >= 20) return 'CW'
  return 'NOISE'
}

/** Signal-to-noise in dB: the trusted level above its own lower bound. */
export function snrOf(trusted: number | null | undefined, lcb: number | null | undefined): number | null {
  if (trusted === null || trusted === undefined || lcb === null || lcb === undefined) return null
  return Math.max(0, trusted - lcb)
}

/** Occupied bandwidth in kHz, wider with more independent evidence. */
export function bandwidthOf(effectiveCount: number | null | undefined): number {
  return 2.4 + Math.sqrt(Math.max(0, effectiveCount ?? 0)) * 1.8
}

/** Map a frequency to an x position across a `w`-wide dial. */
export function dialX(freq: number, w: number, pad = 0): number {
  const t = (freq - BAND.low) / (BAND.high - BAND.low)
  return pad + Math.max(0, Math.min(1, t)) * (w - 2 * pad)
}
