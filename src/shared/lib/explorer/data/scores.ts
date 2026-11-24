// @ts-nocheck
import type { Feedback } from './types';

export type ScoreOptions = {
  /** Prior mean for the Bayesian score. Default 0. */
  mu0?: number;
  /** Prior weight (pseudo-count) for the Bayesian score. Default 5. */
  m?: number;
  /** Half-life in days for the time-decayed score. Default 90. */
  halfLifeDays?: number;
  /** "Now" in unix seconds; defaults to max(createdAt) ?? Date.now(). */
  now?: number;
  /** Addresses that are the agent itself (owner, agent wallet); their rows weigh 0. */
  self?: readonly string[];
};

/** Why a row's authenticity weight is below 1. */
export type WeightReason =
  | 'revoked'
  | 'self'
  | 'duplicate'
  | 'burst'
  | 'monotonous'
  | 'hyperactive';

/** w = dup · burst · trust for rows that are neither revoked nor self. */
export type WeightFactors = { dup: number; burst: number; trust: number };

export type TagScore = { tag: string; count: number; average: number };

export type ScoreSet = {
  n: number;
  nValid: number;
  distinctClients: number;
  /** Sum of authenticity weights — the "effective" count. */
  effectiveCount: number;
  weights: number[];
  /** Per-row flags, for transparency. */
  flaggedDuplicates: number;
  flaggedBursty: number;
  flaggedMonotonous: number;
  flaggedSelf: number;
  raw: number | null;
  weighted: number | null;
  median: number | null;
  trimmed: number | null;
  bayes: number | null;
  /**
   * Conservative lower bound: weighted − 1.96·sd/√W, never below the lowest
   * value. Null under MIN_LCB_WEIGHT full votes, where the bound says nothing.
   */
  lcb: number | null;
  timeWeighted: number | null;
  /** Weighted variance around `weighted`. */
  variance: number | null;
  consensus: number | null;
  /** 0 = united, 1 = split into two camps. */
  polarization: number | null;
  /** Share of valid scores with x > 0. */
  posRate: number | null;
  /** W / n — 1.0 = clean, near 0 = farmed. */
  trustMass: number | null;
  /** exp(Shannon entropy over clients). 1.1 ≈ one-client farm. */
  clientsEff: number | null;
  /** raw − weighted; large positive = filtered manipulation. */
  gap: number | null;
  /** time-weighted(last 30d) − time-weighted(prior 90d). */
  momentum: number | null;
  withEndpoint: number;
  perTag: TagScore[];
};

const DAY = 86400;
/** Fewer full votes than this and a confidence bound is meaningless. */
const MIN_LCB_WEIGHT = 2;

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

export function medianOf(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function trimmedMean(xs: number[], frac = 0.1): number | null {
  if (!xs.length) return null;
  if (xs.length < 4) return mean(xs);
  const s = [...xs].sort((a, b) => a - b);
  const k = Math.floor(s.length * frac);
  return mean(s.slice(k, s.length - k || s.length));
}

/**
 * Normalized duplicate key from what is available on-chain (no text yet). The
 * client is part of it: two reviewers giving the same value agree, they do
 * not duplicate each other.
 */
function dupKey(f: Feedback): string {
  return [
    f.client.toLowerCase(),
    String(f.value),
    (f.tag1 ?? '').toLowerCase().trim(),
    (f.tag2 ?? '').toLowerCase().trim(),
    (f.endpoint ?? '').toLowerCase().trim(),
  ].join('|');
}

/**
 * Authenticity weights from on-chain signals only.
 * w = valid · w_self · w_dup · w_burst · w_trust, each in [0,1].
 * - w_self: rows from one of the `self` addresses → 0.
 * - w_dup: second+ exact (value,tags,endpoint) repeat by the same client → 0.
 * - w_burst: exp(−max(0,N−2)) where N = same-client rows within 24h.
 * - w_trust: 0.4 when a client left ≥3 identical scores, 0.7 when
 *   hyperactive (>5 rows), else 1. Revoked → 0.
 */
export function computeWeights(
  feedback: Feedback[],
  self: readonly string[] = []
): {
  weights: number[];
  /** Per row, every reason its weight is below 1. */
  reasons: WeightReason[][];
  /** Per row, the factors behind `weights` (revoked and self rows keep 1s; they are dropped before). */
  factors: WeightFactors[];
  flaggedSelf: number;
  flaggedDuplicates: number;
  flaggedBursty: number;
  flaggedMonotonous: number;
} {
  const weights = new Array<number>(feedback.length).fill(1);
  const reasons: WeightReason[][] = feedback.map(() => []);
  const factors: WeightFactors[] = feedback.map(() => ({ dup: 1, burst: 1, trust: 1 }));
  const selves = new Set(self.map((a) => a.toLowerCase()));
  let flaggedDuplicates = 0;
  let flaggedSelf = 0;

  // Revoked rows must not make a live row look bursty, monotonous or
  // hyperactive: they were withdrawn, so they no longer say anything.
  const byClient = new Map<string, number[]>();
  feedback.forEach((f, i) => {
    if (f.revoked) return;
    const c = f.client.toLowerCase();
    if (!byClient.has(c)) byClient.set(c, []);
    byClient.get(c)!.push(i);
  });
  const monotonousClients = new Set<string>();
  for (const [c, idxs] of byClient) {
    const vals = new Set(idxs.map((i) => feedback[i].value));
    if (idxs.length >= 3 && vals.size === 1) monotonousClients.add(c);
  }

  // Feeds arrive newest-first, so the first occurrence is usually the newer
  // repeat. Keep the newest row and mark the older originals as duplicates;
  // without dates, keep the first row seen.
  const dupGroups = new Map<string, number[]>();
  feedback.forEach((f, i) => {
    if (f.revoked || selves.has(f.client.toLowerCase())) return;
    const key = dupKey(f);
    const group = dupGroups.get(key);
    if (group) group.push(i);
    else dupGroups.set(key, [i]);
  });
  const duplicateKeep = new Set<number>();
  for (const group of dupGroups.values()) {
    let keep = group[0];
    for (const i of group) {
      const t = feedback[i].createdAt;
      const kept = feedback[keep].createdAt;
      const idx = feedback[i].index;
      const keptIdx = feedback[keep].index;
      // Feeds arrive newest-first, so an undated first row stays the keeper
      // unless a later row has a date that proves it is newer. Dates that tie
      // (or are both missing) fall back to the per-client feedback index.
      if (t !== undefined && kept !== undefined) {
        if (
          t > kept ||
          (t === kept && idx !== undefined && (keptIdx === undefined || idx > keptIdx))
        )
          keep = i;
      } else if (
        t === undefined &&
        kept === undefined &&
        idx !== undefined &&
        (keptIdx === undefined || idx > keptIdx)
      ) {
        keep = i;
      }
    }
    duplicateKeep.add(keep);
  }

  feedback.forEach((f, i) => {
    if (f.revoked) {
      weights[i] = 0;
      reasons[i].push('revoked');
      return;
    }
    if (selves.has(f.client.toLowerCase())) {
      weights[i] = 0;
      reasons[i].push('self');
      flaggedSelf++;
      return;
    }
    let wDup = 1;
    if (!duplicateKeep.has(i)) {
      wDup = 0;
      flaggedDuplicates++;
      reasons[i].push('duplicate');
    }
    // Burst: same-client live rows within ±24h of this row.
    let wBurst = 1;
    if (f.createdAt !== undefined) {
      const c = f.client.toLowerCase();
      const n = byClient.get(c)!.filter((j) => {
        const t = feedback[j].createdAt;
        return t !== undefined && Math.abs(t - (f.createdAt as number)) <= DAY;
      }).length;
      wBurst = Math.exp(-Math.max(0, n - 2));
      if (n > 2) reasons[i].push('burst');
    }
    const c = f.client.toLowerCase();
    const count = byClient.get(c)!.length;
    const wTrust = monotonousClients.has(c) ? 0.4 : count > 5 ? 0.7 : 1;
    if (wTrust < 1) reasons[i].push(monotonousClients.has(c) ? 'monotonous' : 'hyperactive');
    factors[i] = { dup: wDup, burst: wBurst, trust: wTrust };
    weights[i] = wDup * wBurst * wTrust;
  });

  // `burst` is a specific flag; a monotonous 0.4 weight is not a burst.
  const flaggedBursty = reasons.filter((r) => r.includes('burst')).length;
  const flaggedMonotonous = feedback.filter(
    (f) =>
      !f.revoked &&
      !selves.has(f.client.toLowerCase()) &&
      monotonousClients.has(f.client.toLowerCase())
  ).length;
  return {
    weights,
    reasons,
    factors,
    flaggedSelf,
    flaggedDuplicates,
    flaggedBursty,
    flaggedMonotonous,
  };
}

export function computeScores(feedback: Feedback[], opts: ScoreOptions = {}): ScoreSet {
  const { mu0 = 0, m = 5, halfLifeDays = 90, now, self } = opts;
  const n = feedback.length;
  const { weights, flaggedSelf, flaggedDuplicates, flaggedBursty, flaggedMonotonous } =
    computeWeights(feedback, self);

  const validIdx = feedback.map((f, i) => ({ f, i })).filter(({ f }) => !f.revoked);
  const nValid = validIdx.length;
  // Shape statistics use rows that can actually move the score. A self row
  // weighs 0 and must not widen the range, shift the median or count as a
  // positive score.
  const scoredIdx = validIdx.filter(({ i }) => weights[i] > 0);
  const xs = scoredIdx.map(({ f }) => f.value);
  const ws = scoredIdx.map(({ i }) => weights[i]);
  const W = ws.reduce((a, b) => a + b, 0);

  const clients = new Set(validIdx.map(({ f }) => f.client.toLowerCase()));
  const distinctClients = clients.size;

  const raw = mean(validIdx.map(({ f }) => f.value));
  const weighted = W > 0 ? ws.reduce((a, w, k) => a + w * xs[k], 0) / W : null;
  const median = medianOf(xs);
  const trimmed = trimmedMean(xs);

  const variance =
    weighted === null || W === 0
      ? null
      : ws.reduce((a, w, k) => a + w * (xs[k] - (weighted as number)) ** 2, 0) / W;

  const sd = variance === null ? null : Math.sqrt(variance);
  const lcb =
    weighted === null || sd === null || W < MIN_LCB_WEIGHT
      ? null
      : Math.max(Math.min(...xs), weighted - (1.96 * sd) / Math.sqrt(W));
  const bayes = weighted === null ? null : (W * weighted + m * mu0) / (W + m);

  // Time-decayed.
  const tNow =
    now ??
    (xs.length && validIdx.some(({ f }) => f.createdAt !== undefined)
      ? Math.max(
          ...validIdx
            .filter(({ f }) => f.createdAt !== undefined)
            .map(({ f }) => f.createdAt as number)
        )
      : Math.floor(Date.now() / 1000));
  const lambda = Math.LN2 / (halfLifeDays * DAY);
  const dated = validIdx.filter(({ f }) => f.createdAt !== undefined);
  let timeWeighted: number | null = null;
  if (dated.length && W > 0) {
    let num = 0;
    let den = 0;
    for (const { f, i } of dated) {
      const u = weights[i] * Math.exp(-lambda * Math.max(0, tNow - (f.createdAt as number)));
      num += u * f.value;
      den += u;
    }
    // Undated rows keep their plain weight so they still count.
    for (const { f, i } of validIdx.filter(({ f }) => f.createdAt === undefined)) {
      num += weights[i] * f.value;
      den += weights[i];
    }
    timeWeighted = den > 0 ? num / den : null;
  } else {
    timeWeighted = weighted;
  }

  // Momentum: last 30d vs prior 30–120d (time-weighted means).
  let momentum: number | null = null;
  if (dated.length >= 2) {
    const meanIn = (from: number, to: number): number | null => {
      let num = 0;
      let den = 0;
      for (const { f, i } of dated) {
        const age = tNow - (f.createdAt as number);
        if (age >= from && age < to) {
          const u = weights[i] * Math.exp(-lambda * Math.max(0, age));
          num += u * f.value;
          den += u;
        }
      }
      return den > 0 ? num / den : null;
    };
    const recent = meanIn(0, 30 * DAY);
    const prior = meanIn(30 * DAY, 120 * DAY);
    if (recent !== null && prior !== null) momentum = recent - prior;
  }

  // Shape.
  let consensus: number | null = null;
  let polarization: number | null = null;
  if (xs.length >= 2 && variance !== null) {
    const min = Math.min(...xs);
    const max = Math.max(...xs);
    const range = max - min;
    if (range > 0) {
      const varMax = (range / 2) ** 2;
      consensus = Math.max(0, Math.min(1, 1 - variance / varMax));
      const med = median ?? 0;
      const hi = xs.filter((x) => x >= med + range * 0.25).length / xs.length;
      const lo = xs.filter((x) => x <= med - range * 0.25).length / xs.length;
      polarization = 4 * hi * lo;
    } else {
      consensus = 1;
      polarization = 0;
    }
  } else if (xs.length === 1) {
    consensus = 1;
    polarization = 0;
  }
  const posRate = scoredIdx.length
    ? scoredIdx.filter(({ f }) => f.value > 0).length / scoredIdx.length
    : null;
  const trustMass = n ? W / n : null;

  // Client diversity.
  let clientsEff: number | null = null;
  if (W > 0) {
    const perClient = new Map<string, number>();
    for (const { f, i } of validIdx) {
      const c = f.client.toLowerCase();
      perClient.set(c, (perClient.get(c) ?? 0) + weights[i]);
    }
    let h = 0;
    for (const wc of perClient.values()) {
      const p = wc / W;
      if (p > 0) h -= p * Math.log(p);
    }
    clientsEff = Math.exp(h);
  }

  const gap = raw !== null && weighted !== null ? raw - weighted : null;
  const withEndpoint = validIdx.filter(({ f }) => f.endpoint).length;

  const tagGroups = new Map<string, { xs: number[]; ws: number[] }>();
  scoredIdx.forEach(({ f, i }) => {
    const tag = f.tag1 || '(no tag)';
    if (!tagGroups.has(tag)) tagGroups.set(tag, { xs: [], ws: [] });
    tagGroups.get(tag)!.xs.push(f.value);
    tagGroups.get(tag)!.ws.push(weights[i]);
  });
  const perTag: TagScore[] = [...tagGroups.entries()]
    .map(([tag, g]) => {
      const wSum = g.ws.reduce((a, b) => a + b, 0);
      return {
        tag,
        count: g.xs.length,
        average: wSum > 0 ? g.xs.reduce((a, x, k) => a + x * g.ws[k], 0) / wSum : (mean(g.xs) ?? 0),
      };
    })
    .sort((a, b) => b.count - a.count);

  return {
    n,
    nValid,
    distinctClients,
    effectiveCount: W,
    weights,
    flaggedDuplicates,
    flaggedBursty,
    flaggedMonotonous,
    flaggedSelf,
    raw,
    weighted,
    median,
    trimmed,
    bayes,
    lcb,
    timeWeighted,
    variance,
    consensus,
    polarization,
    posRate,
    trustMass,
    clientsEff,
    gap,
    momentum,
    withEndpoint,
    perTag,
  };
}
