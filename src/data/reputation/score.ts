import type { WalletRating } from './units'

/** Prior strength in wallet units: three independent, unverified wallets. */
export const ALPHA0 = 3
/** Neutral prior mean. */
export const MU0 = 0.5
/** Full votes and wallets needed before a score is more than thin. */
export const THIN_WEIGHT = 3
export const THIN_WALLETS = 3
/** Below this the evidence cannot be called high confidence. */
export const STRONG_WEIGHT = 10
export const STRONG_NEFF = 5
export const DOMINANT_SHARE = 0.3
/** Target a faker aims for when pricing a fake (90/100). */
export const FAKE_TARGET = 0.9

export type Confidence = 'low' | 'medium' | 'high'

export type RobustScore = {
  /** In [0,1]; null when no rating units exist. */
  value: number | null
  /** 80% interval from the Beta posterior, in [0,1]. */
  interval: [number, number] | null
  confidence: Confidence
  unrated: boolean
  /** Posterior parameters. */
  alpha: number
  beta: number
  /** Σ wallet weights. */
  totalWeight: number
  /** 1 / HHI over wallet weights. */
  neff: number
  top1: number
  /** Largest single wallet's share of (prior + weights). */
  maxInfluence: number
  /** Fresh unlinked wallets needed to reach FAKE_TARGET; null when already there. */
  cost: number | null
}

/** Natural log of the gamma function (Lanczos, g = 7). */
function logGamma(z: number): number {
  const coef = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ]
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z)
  const x = z - 1
  let a = coef[0]
  for (let i = 1; i < coef.length; i++) a += coef[i] / (x + i)
  const t = x + 7.5
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
}

/** Continued fraction for the incomplete beta (Numerical Recipes 6.4). */
function betaFraction(a: number, b: number, x: number): number {
  const TINY = 1e-30
  let c = 1
  let d = 1 - ((a + b) * x) / (a + 1)
  if (Math.abs(d) < TINY) d = TINY
  d = 1 / d
  let h = d
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < TINY) d = TINY
    c = 1 + aa / c
    if (Math.abs(c) < TINY) c = TINY
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1))
    d = 1 + aa * d
    if (Math.abs(d) < TINY) d = TINY
    c = 1 + aa / c
    if (Math.abs(c) < TINY) c = TINY
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 1e-12) break
  }
  return h
}

/** Regularized incomplete beta I_x(a,b). */
export function betaCdf(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  return x < (a + 1) / (a + b + 2) ? (front * betaFraction(a, b, x)) / a : 1 - (front * betaFraction(b, a, 1 - x)) / b
}

/** Quantile of Beta(a,b); bisection, which is stable for the ranges used here. */
export function betaQuantile(p: number, a: number, b: number): number {
  let lo = 0
  let hi = 1
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if (betaCdf(mid, a, b) < p) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Robust score with a Beta interval, confidence, and the cost of forcing it up. */
export function robustScore(
  wallets: readonly WalletRating[],
  opts: { alpha0?: number; mu0?: number; target?: number } = {},
): RobustScore {
  const alpha0 = opts.alpha0 ?? ALPHA0
  const mu0 = opts.mu0 ?? MU0
  const target = opts.target ?? FAKE_TARGET
  const totalWeight = wallets.reduce((a, w) => a + w.weight, 0)
  const A = alpha0 * mu0 + wallets.reduce((a, w) => a + w.weight * w.r, 0)
  const B = alpha0 * (1 - mu0) + wallets.reduce((a, w) => a + w.weight * (1 - w.r), 0)
  const unrated = wallets.length === 0
  const value = unrated ? null : A / (A + B)

  let neff = 0
  let top1 = 0
  if (totalWeight > 0) {
    let hhi = 0
    for (const w of wallets) {
      const p = w.weight / totalWeight
      hhi += p * p
      if (p > top1) top1 = p
    }
    neff = hhi > 0 ? 1 / hhi : 0
  }
  const maxInfluence = totalWeight > 0 ? Math.max(...wallets.map((w) => w.weight)) / (alpha0 + totalWeight) : 0

  const confidence: Confidence = unrated
    ? 'low'
    : totalWeight < THIN_WEIGHT || wallets.length < THIN_WALLETS
      ? 'low'
      : totalWeight >= STRONG_WEIGHT && neff >= STRONG_NEFF && top1 < DOMINANT_SHARE
        ? 'high'
        : 'medium'

  const interval: [number, number] | null = unrated ? null : [betaQuantile(0.1, A, B), betaQuantile(0.9, A, B)]
  const cost =
    value === null || value >= target ? null : Math.ceil(((alpha0 + totalWeight) * (target - value)) / (1 - target))

  return { value, interval, confidence, unrated, alpha: A, beta: B, totalWeight, neff, top1, maxInfluence, cost }
}
