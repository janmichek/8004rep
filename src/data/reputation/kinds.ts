// What a feedback value means. ERC-8004 types `value` as a bare int128, so the
// same registry carries star ratings, pass flags, latencies in ms and revenue
// in USD. Only ratings may be averaged into a quality score.

/** Only `rating` enters the score; the rest is shown, never averaged with it. */
export type Kind = 'rating' | 'outcome' | 'telemetry' | 'metric' | 'unknown'

/** Scale a rating is read on; `unbounded` fits no rating scale. */
export type Scale = 'binary' | 'unit' | 'five' | 'ten' | 'hundred' | 'signed' | 'unbounded'

export const KIND_INFO: Record<Kind, { label: string; rule: string }> = {
  rating: { label: 'rating', rule: 'A judgement of quality (starred, quality, trust, review…). Normalised to 0–1 and scored.' },
  outcome: { label: 'outcome', rule: 'Whether something happened (pass, accepted, paid, dispute…). Listed, not scored.' },
  telemetry: { label: 'telemetry', rule: 'A measurement of the service (uptime, success rate, response time…). Answers “is it up”, not “is it good”; never scored.' },
  metric: { label: 'metric', rule: 'A quantity (revenue, volume, yield, match count, rating points…). Shown raw, never averaged as a rating.' },
  unknown: { label: 'other', rule: 'A tag this explorer has no meaning for. Shown raw, never averaged.' },
}

export const SCALE_LABEL: Record<Scale, string> = {
  binary: '0/1',
  unit: '0–1',
  five: '0–5',
  ten: '0–10',
  hundred: '0–100',
  signed: '±',
  unbounded: 'no scale',
}

/** Tag spelling folded: case, separators and camel/snake case do not matter. */
export function tagKey(tag: string | undefined): string {
  return (tag ?? '').trim().toLowerCase().replace(/[^a-z0-9:]/g, '')
}

const KINDS: Record<Exclude<Kind, 'unknown'>, string[]> = {
  rating: [
    'starred', 'star', 'stars', 'quality', 'trust', 'trusted', 'satisfaction', 'helpful', 'review', 'rating', 'rate',
    'score', 'personality', 'feedback', 'reliable', 'reliability', 'recommend', 'recommendation', 'experience', 'csat',
    'accuracy', 'usefulness', 'useful',
  ],
  outcome: [
    'reachable', 'ownerverified', 'correctness', 'verified', 'pass', 'passed', 'acceptance', 'accepted', 'settled', 'paid',
    'dispute', 'disputed', 'refund', 'refunded', 'completed', 'completion', 'jobcompletion', 'success', 'certificateissued',
    'compliance', 'submission', 'contribution', 'delivered',
  ],
  telemetry: [
    'uptime', 'successrate', 'responsetime', 'latency', 'liveness', 'availability', 'errorrate', 'efficiency',
    'performance', 'health', 'ping',
  ],
  metric: [
    'revenue', 'revenues', 'volume', 'tradingyield', 'yield', 'pnl', 'roi', 'winrate', 'matchcount', 'elo', 'glicko2mu',
    'glicko2', 'mmr', 'tvl', 'calls', 'requests', 'count', 'validatoraccuracy',
  ],
}
const KIND_OF = new Map<string, Kind>(
  (Object.entries(KINDS) as [Kind, string[]][]).flatMap(([kind, tags]) => tags.map((tag) => [tag, kind] as const)),
)

/**
 * Kind of a tag1 from the curated map. A namespaced tag (`review:submission`,
 * `gfh:contribution`) is matched whole, then by its last and first segments.
 */
export function kindOf(tag1: string | undefined): Kind {
  const key = tagKey(tag1)
  if (!key) return 'unknown'
  const whole = KIND_OF.get(key.replace(/:/g, ''))
  if (whole) return whole
  const parts = key.split(':').filter(Boolean)
  return KIND_OF.get(parts.at(-1) ?? '') ?? KIND_OF.get(parts[0] ?? '') ?? 'unknown'
}

const SIGNED_SPANS = [1, 5, 10, 100]

/**
 * Scale from the observed values: {0,1} is a pass/fail, negatives make a
 * signed scale (±1, ±5, ±10 or ±100), else the narrowest of 0–1, 0–5, 0–10,
 * 0–100 that holds them. Anything wider is no rating scale.
 */
export function inferScale(values: number[]): { scale: Scale; span: number } {
  if (values.length === 0) return { scale: 'unbounded', span: 0 }
  if (values.every((v) => v === 0 || v === 1)) return { scale: 'binary', span: 1 }
  // A single wild value must not redefine the tag: read the scale off the bulk
  // of the values and let the rest fall out of range.
  const negatives = values.filter((v) => v < 0).length / values.length
  if (negatives > 0.2) {
    const abs = values.map(Math.abs).sort((a, b) => a - b)
    const reach = abs[Math.floor(abs.length * 0.8)]
    const span = SIGNED_SPANS.find((s) => reach <= s)
    return span ? { scale: 'signed', span } : { scale: 'unbounded', span: 0 }
  }
  // With only a handful of values there is no bulk to read: use the widest.
  if (values.length < 5) {
    const fitsAll = (span: number) => values.every((v) => v >= 0 && v <= span)
    if (fitsAll(1)) return { scale: 'unit', span: 1 }
    if (fitsAll(5)) return { scale: 'five', span: 5 }
    if (fitsAll(10)) return { scale: 'ten', span: 10 }
    if (fitsAll(100)) return { scale: 'hundred', span: 100 }
    return { scale: 'unbounded', span: 0 }
  }
  const allowed = Math.max(1, Math.floor(values.length * 0.2))
  const required = Math.max(1, values.length - allowed)
  const fits = (span: number) => values.filter((v) => v >= 0 && v <= span).length >= required
  if (fits(1)) return { scale: 'unit', span: 1 }
  if (fits(5)) return { scale: 'five', span: 5 }
  if (fits(10)) return { scale: 'ten', span: 10 }
  if (fits(100)) return { scale: 'hundred', span: 100 }
  return { scale: 'unbounded', span: 0 }
}

/** Value read on its scale, in [0,1]; null when it fits no rating scale. */
export function normalize(value: number, scale: Scale, span: number): number | null {
  switch (scale) {
    case 'binary':
    case 'unit':
      return value >= 0 && value <= 1 ? value : null
    case 'five':
    case 'ten':
    case 'hundred':
      return value >= 0 && value <= span ? value / span : null
    case 'signed':
      return Math.abs(value) <= span ? (value + span) / (2 * span) : null
    default:
      return null
  }
}

/** A reviewer needs this many values on a tag before its own scale overrides the tag's. */
export const MIN_CLIENT_SCALE_ROWS = 3

export type Classified = {
  kind: Kind
  /** Normalised tag1 that groups the row. */
  tag: string
  scale: Scale
  span: number
  /** Rating in [0,1]; null for other kinds and for ratings that fit no scale. */
  r: number | null
}

export type TagProfile = {
  tag: string
  /** tag1 as first seen, for display. */
  label: string
  kind: Kind
  /** Scale over every client's values. */
  scale: Scale
  rows: number
  clients: number
  /** Clients whose own values sit on another scale than the tag's (with enough rows to tell). */
  mixedScale: boolean
}

type Row = { client: string; tag1?: string; value: number; revoked: boolean }

/**
 * Kind, scale and rating of each row. The scale is inferred per tag over all
 * rows given (one agent today; a whole chain once an indexer exists), and a
 * reviewer with enough values of its own is read on its own scale — the same
 * tag is used 0–5 by some reviewers and 0–100 by others.
 */
export function classify(rows: readonly Row[]): { rows: Classified[]; tags: TagProfile[] } {
  const byTag = new Map<string, number[]>()
  rows.forEach((row, i) => {
    if (row.revoked) return
    const key = tagKey(row.tag1)
    const list = byTag.get(key)
    if (list) list.push(i)
    else byTag.set(key, [i])
  })

  const tagScale = new Map<string, { scale: Scale; span: number }>()
  const clientScale = new Map<string, { scale: Scale; span: number }>()
  const tags: TagProfile[] = []
  for (const [key, idxs] of byTag) {
    const kind = kindOf(rows[idxs[0]].tag1)
    const whole = inferScale(idxs.map((i) => rows[i].value))
    tagScale.set(key, whole)
    const perClient = new Map<string, number[]>()
    for (const i of idxs) {
      const c = rows[i].client.toLowerCase()
      const list = perClient.get(c)
      if (list) list.push(rows[i].value)
      else perClient.set(c, [rows[i].value])
    }
    let mixedScale = false
    for (const [c, values] of perClient) {
      if (values.length < MIN_CLIENT_SCALE_ROWS) continue
      const own = inferScale(values)
      if (own.scale !== whole.scale && own.scale !== 'unbounded') {
        clientScale.set(`${key}|${c}`, own)
        mixedScale = true
      }
    }
    tags.push({
      tag: key,
      label: rows[idxs[0]].tag1?.trim() || '(no tag)',
      kind,
      scale: whole.scale,
      rows: idxs.length,
      clients: perClient.size,
      mixedScale,
    })
  }

  const classified = rows.map((row): Classified => {
    const key = tagKey(row.tag1)
    const kind = kindOf(row.tag1)
    const { scale, span } = clientScale.get(`${key}|${row.client.toLowerCase()}`) ?? tagScale.get(key) ?? inferScale([row.value])
    return { kind, tag: key, scale, span, r: kind === 'rating' ? normalize(row.value, scale, span) : null }
  })
  tags.sort((a, b) => b.rows - a.rows)
  return { rows: classified, tags }
}
