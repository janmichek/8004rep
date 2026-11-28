import type { Classified } from './kinds';
import type { FeedbackInput } from './types';
import { median } from './units';

export type TelemetrySummary = {
  tag: string;
  label: string;
  rows: number;
  clients: number;
  latest: number | null;
  median: number | null;
};

type Entry = {
  label: string;
  rows: number;
  clients: Set<string>;
  values: { value: number; at?: number }[];
};

/** Non-rating telemetry rows grouped by tag, the telemetry panel. */
export function telemetryOf(
  feedback: readonly FeedbackInput[],
  classified: readonly Classified[]
): TelemetrySummary[] {
  const entries = new Map<string, Entry>();
  classified.forEach((row, index) => {
    const source = feedback[index];

    if (!source || source.revoked || row.kind !== 'telemetry') return;
    let entry = entries.get(row.tag);

    if (!entry) {
      entry = { label: source.tag1?.trim() || '(no tag)', rows: 0, clients: new Set(), values: [] };
      entries.set(row.tag, entry);
    }

    entry.rows++;
    entry.clients.add(source.client.toLowerCase());

    if (source.createdAt === undefined) entry.values.push({ value: source.value });
    else entry.values.push({ value: source.value, at: source.createdAt });
  });

  return [...entries.entries()]
    .map(([tag, entry]) => {
      const timed = entry.values
        .flatMap((value) => (value.at === undefined ? [] : [{ value: value.value, at: value.at }]))
        .toSorted((a, b) => b.at - a.at);

      return {
        tag,
        label: entry.label,
        rows: entry.rows,
        clients: entry.clients.size,
        latest: timed[0]?.value ?? entry.values.at(-1)?.value ?? null,
        median: median(entry.values.map((value) => value.value)),
      };
    })
    .toSorted((a, b) => b.rows - a.rows);
}
