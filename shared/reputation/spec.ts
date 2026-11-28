/** One published parameter set for `rep-1.0`. */
export const FORMULA_VERSION = 'rep-1.0' as const;

/** Canonical step order of the score waterfall. */
export const REPORT_STEPS = [
  {
    id: 'all',
    label: 'Every review',
    rule: 'Plain mean of all values, revoked included.',
  },
  {
    id: 'revoked',
    label: 'Drop revoked',
    rule: 'Reviews their author revoked count nowhere.',
  },
  {
    id: 'ratings',
    label: 'Ratings only',
    rule: 'Latency, uptime, revenue, pass flags and unknown tags are listed, never averaged into the score.',
  },
  {
    id: 'self',
    label: 'Drop self-reviews',
    rule: 'Feedback from the agent owner or agent wallet is listed, but never enters its score.',
  },
  {
    id: 'units',
    label: 'One unit per reviewer per tag per 30 days',
    rule: 'A burst of repeats collapses to its median, so volume is not a voice.',
  },
  {
    id: 'cap',
    label: 'Cap each wallet at one full vote',
    rule: 'A wallet is min(1, Σ 2^(−age/90d)); extra units of the same wallet add no more weight.',
  },
  {
    id: 'prior',
    label: 'Add a neutral prior',
    rule: 'Three unverified wallets at 50/100 pull a thin record toward the middle instead of the extremes.',
  },
] as const;

/** What a feedback tag means. Only `rating` enters the score. */
export type Kind = 'rating' | 'outcome' | 'telemetry' | 'metric' | 'unknown';

/** Scale a rating is read on; `unbounded` fits no rating scale. */
export type Scale = 'binary' | 'unit' | 'five' | 'ten' | 'hundred' | 'signed' | 'unbounded';

export const KIND_ORDER: readonly Kind[] = ['rating', 'outcome', 'telemetry', 'metric', 'unknown'];

export const KIND_INFO: Record<Kind, { label: string; rule: string }> = {
  rating: {
    label: 'rating',
    rule: 'A judgement of quality (starred, quality, trust, review…). Normalised to 0–1 and scored.',
  },
  outcome: {
    label: 'outcome',
    rule: 'Whether something happened (pass, accepted, paid, dispute…). Listed, not scored.',
  },
  telemetry: {
    label: 'telemetry',
    rule: 'A measurement of the service (uptime, success rate, response time…). Answers “is it up”, not “is it good”; never scored.',
  },
  metric: {
    label: 'metric',
    rule: 'A quantity (revenue, volume, yield, match count, rating points…). Shown raw, never averaged as a rating.',
  },
  unknown: {
    label: 'other',
    rule: 'A tag this explorer has no meaning for. Shown raw, never averaged.',
  },
};

/**
 * The published `rep-1.0` specification. It is served verbatim by
 * `GET /api/reputation/spec`, so the UI and external callers read one source.
 */
export const REP_SPEC = {
  formulaVersion: FORMULA_VERSION,
  params: {
    alpha0: 3,
    mu0: 0.5,
    unitWindowDays: 30,
    halfLifeDays: 90,
    fakeTarget: 0.9,
  },
  confidenceRules: {
    thinWeight: 3,
    thinWallets: 3,
    strongWeight: 10,
    strongNeff: 5,
    dominantShare: 0.3,
  },
  kinds: KIND_ORDER.map((kind) => ({
    kind,
    label: KIND_INFO[kind].label,
    rule: KIND_INFO[kind].rule,
  })),
  steps: REPORT_STEPS.map((step) => ({ ...step })),
  specUrl: 'https://github.com/janmichek/8004rep/blob/main/docs/reputation-spec-v1.md',
} as const;
