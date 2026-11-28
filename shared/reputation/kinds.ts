import { kindOf, tagKey } from './tags';
import { inferScale, normalize, type TagScale } from './scales';
import type { Kind, Scale } from './spec';

export { KIND_INFO, type Kind, type Scale } from './spec';

export { kindOf, tagKey } from './tags';

export { inferScale, normalize, type TagScale } from './scales';

export type Classified = {
  kind: Kind;
  /** Normalised tag1 that groups the row. */
  tag: string;
  scale: Scale;
  span: number;
  /** Rating in [0,1]; null for other kinds and for ratings that fit no scale. */
  r: number | null;
};

export type TagProfile = {
  tag: string;
  /** tag1 as first seen, for display. */
  label: string;
  kind: Kind;
  /** Scale over every client's values. */
  scale: Scale;
  rows: number;
  clients: number;
  /** Clients whose own values sit on another scale than the tag's (with enough rows to tell). */
  mixedScale: boolean;
};

export type ScaleRow = { client: string; tag1?: string; value: number; revoked: boolean };

/** A reviewer needs this many values on a tag before its own scale overrides the tag's. */
const MIN_CLIENT_SCALE_ROWS = 5;

/**
 * Whether a client's values are strong enough evidence to overrule the tag's
 * scale. A client that only ever leaves low values must not be re-read as a
 * narrower scale and turned into a perfect score: its values need to cover a
 * meaningful part of that narrower scale. Callers already checked the row
 * count and ruled out an unbounded scale.
 */
function coversScale(values: readonly number[], scale: Scale, span: number): boolean {
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (scale === 'binary') return min === 0 && max === 1;

  return max - min >= span * 0.5;
}

/**
 * Tag scales inferred from the non-revoked rows given. Pass one agent's full
 * feedback here, then classify a reviewer's subset against the result: a
 * reviewer's few low values must not make a 0–100 tag look like 0–5.
 */
export function inferTagScales(rows: readonly ScaleRow[]): Map<string, TagScale> {
  const byTag = new Map<string, number[]>();

  for (const row of rows) {
    if (row.revoked) continue;
    const key = tagKey(row.tag1);
    const list = byTag.get(key);

    if (list) list.push(row.value);
    else byTag.set(key, [row.value]);
  }

  return new Map([...byTag.entries()].map(([key, values]) => [key, inferScale(values)]));
}

type TagGroup = { key: string; indexes: number[]; rows: ScaleRow[] };

function groupByTag(rows: readonly ScaleRow[]): TagGroup[] {
  const byTag = new Map<string, TagGroup>();
  rows.forEach((row, index) => {
    if (row.revoked) return;
    const key = tagKey(row.tag1);
    const group = byTag.get(key);

    if (group) {
      group.indexes.push(index);
      group.rows.push(row);
    } else {
      byTag.set(key, { key, indexes: [index], rows: [row] });
    }
  });

  return [...byTag.values()];
}

type ClientScales = { scales: Map<string, TagScale>; mixed: boolean };

/** Per-client scales that may overrule the tag's own scale. */
function inferClientScales(
  groupRows: readonly ScaleRow[],
  whole: TagScale,
  key: string
): ClientScales {
  const perClient = new Map<string, number[]>();

  for (const row of groupRows) {
    const client = row.client.toLowerCase();
    const list = perClient.get(client);

    if (list) list.push(row.value);
    else perClient.set(client, [row.value]);
  }

  const scales = new Map<string, TagScale>();
  let mixed = false;

  for (const [client, values] of perClient) {
    if (values.length < MIN_CLIENT_SCALE_ROWS) continue;
    const own = inferScale(values);

    if (own.scale === whole.scale || own.scale === 'unbounded') continue;

    if (!coversScale(values, own.scale, own.span)) continue;
    scales.set(`${key}|${client}`, own);
    mixed = true;
  }

  return { scales, mixed };
}

type TagResult = {
  profile: TagProfile;
  whole: TagScale;
  clientScales: Map<string, TagScale>;
};

function profileForGroup(group: TagGroup, supplied: TagScale | undefined): TagResult {
  const first = group.rows[0];
  const values = group.rows.map((row) => row.value);
  const whole = supplied ?? inferScale(values);

  const inferred = supplied
    ? { scales: new Map<string, TagScale>(), mixed: false }
    : inferClientScales(group.rows, whole, group.key);

  const clients = new Set(group.rows.map((row) => row.client.toLowerCase()));

  return {
    profile: {
      tag: group.key,
      label: first?.tag1?.trim() || '(no tag)',
      kind: kindOf(first?.tag1),
      scale: whole.scale,
      rows: group.indexes.length,
      clients: clients.size,
      mixedScale: inferred.mixed,
    },
    whole,
    clientScales: inferred.scales,
  };
}

function classifyRow(
  row: ScaleRow,
  tagScale: ReadonlyMap<string, TagScale>,
  clientScale: ReadonlyMap<string, TagScale>
): Classified {
  const key = tagKey(row.tag1);
  const kind = kindOf(row.tag1);
  const own = clientScale.get(`${key}|${row.client.toLowerCase()}`) ?? tagScale.get(key);
  const { scale, span } = own ?? inferScale([row.value]);

  return {
    kind,
    tag: key,
    scale,
    span,
    r: kind === 'rating' ? normalize(row.value, scale, span) : null,
  };
}

export type Classification = { rows: Classified[]; tags: TagProfile[] };

/**
 * Kind, scale and rating of each row. The scale is inferred per tag over all
 * rows given (one agent today; a whole chain once an indexer exists), and a
 * reviewer with enough values of its own is read on its own scale — the same
 * tag is used 0–5 by some reviewers and 0–100 by others.
 *
 * `opts.scales` makes the supplied tag scales authoritative: they are used
 * instead of inferring from `rows`, and the per-client override is skipped so
 * a subset cannot redefine the scale it is being read on.
 */
export function classify(
  rows: readonly ScaleRow[],
  opts: { scales?: ReadonlyMap<string, TagScale> } = {}
): Classification {
  const tagScale = new Map<string, TagScale>();
  const clientScale = new Map<string, TagScale>();
  const profiles: TagProfile[] = [];

  for (const group of groupByTag(rows)) {
    const result = profileForGroup(group, opts.scales?.get(group.key));
    tagScale.set(group.key, result.whole);

    for (const [key, scale] of result.clientScales) clientScale.set(key, scale);
    profiles.push(result.profile);
  }

  const classified = rows.map((row) => classifyRow(row, tagScale, clientScale));

  return { rows: classified, tags: profiles.toSorted((a, b) => b.rows - a.rows) };
}
