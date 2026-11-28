import type { Kind } from './spec';

/** Tag spelling folded: case, separators and camel/snake case do not matter. */
export function tagKey(tag: string | undefined): string {
  return (tag ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:]/g, '');
}

type KnownKind = Exclude<Kind, 'unknown'>;

/** Curated tag → kind table. Entries are pairs so no type assertion is needed. */
const KIND_TAGS: readonly (readonly [KnownKind, readonly string[]])[] = [
  [
    'rating',
    [
      'starred',
      'star',
      'stars',
      'quality',
      'trust',
      'trusted',
      'satisfaction',
      'helpful',
      'review',
      'rating',
      'rate',
      'score',
      'personality',
      'feedback',
      'reliable',
      'reliability',
      'recommend',
      'recommendation',
      'experience',
      'csat',
      'accuracy',
      'usefulness',
      'useful',
    ],
  ],
  [
    'outcome',
    [
      'reachable',
      'ownerverified',
      'correctness',
      'verified',
      'pass',
      'passed',
      'acceptance',
      'accepted',
      'settled',
      'paid',
      'dispute',
      'disputed',
      'refund',
      'refunded',
      'completed',
      'completion',
      'jobcompletion',
      'success',
      'certificateissued',
      'compliance',
      'submission',
      'contribution',
      'delivered',
    ],
  ],
  [
    'telemetry',
    [
      'uptime',
      'successrate',
      'responsetime',
      'latency',
      'liveness',
      'availability',
      'errorrate',
      'efficiency',
      'performance',
      'health',
      'ping',
    ],
  ],
  [
    'metric',
    [
      'revenue',
      'revenues',
      'volume',
      'tradingyield',
      'yield',
      'pnl',
      'roi',
      'winrate',
      'matchcount',
      'elo',
      'glicko2mu',
      'glicko2',
      'mmr',
      'tvl',
      'calls',
      'requests',
      'count',
      'validatoraccuracy',
    ],
  ],
];

const KIND_OF = new Map<string, Kind>();

for (const [kind, tags] of KIND_TAGS) {
  for (const tag of tags) KIND_OF.set(tag, kind);
}

/**
 * Kind of a tag1 from the curated map. A namespaced tag (`review:submission`,
 * `gfh:contribution`) is matched whole, then by its last and first segments.
 */
export function kindOf(tag1: string | undefined): Kind {
  const key = tagKey(tag1);

  if (!key) return 'unknown';
  const whole = KIND_OF.get(key.replace(/:/g, ''));

  if (whole) return whole;
  const parts = key.split(':').filter(Boolean);

  return KIND_OF.get(parts.at(-1) ?? '') ?? KIND_OF.get(parts[0] ?? '') ?? 'unknown';
}
