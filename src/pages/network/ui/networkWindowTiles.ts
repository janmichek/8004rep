import { formatNumber, formatPercent } from '../../../shared/lib/explorer';
import type { Tile } from '../../../shared/ui';
import type { NetworkStats } from '../../../shared/lib/explorer';

function dayLabel(time: number): string {
  return new Date(time * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function daySpan(from: number, to: number): string {
  return `${dayLabel(from)} – ${dayLabel(to)}`;
}

function severityLevel(count: number): number {
  if (count === 0) return 0;

  if (count > 20) return 3;

  if (count > 5) return 2;

  return 1;
}

export function networkWindowTiles(stats: NetworkStats | undefined): Tile[] {
  if (!stats) return [];

  return [
    {
      label: 'Feedback in window',
      value: String(stats.rows),
      hint: stats.from && stats.to ? daySpan(stats.from, stats.to) : '',
      tone: 'main',
    },
    { label: 'Agents rated', value: String(stats.agents) },
    {
      label: 'Reviewers',
      value: String(stats.reviewers),
      hint: `${formatNumber(stats.rows / Math.max(1, stats.reviewers))} feedback each`,
    },
    {
      label: 'Average rating',
      value: formatNumber(stats.average),
      hint: 'scored ratings only, normalised',
      meter: stats.average === null ? undefined : { kind: 'gauge', value: stats.average },
    },
    {
      label: 'Perfect 100s',
      value: formatPercent(stats.perfectShare),
      hint: 'of scored ratings at 99%+',
      tone: (stats.perfectShare ?? 0) > 0.7 ? 'warn' : undefined,
      title: 'A network where most feedback is 100 cannot tell good agents from great ones',
      meter:
        stats.perfectShare === null
          ? undefined
          : { kind: 'gauge', value: stats.perfectShare * 100 },
    },
    {
      label: 'Suspect reviewers',
      value: String(stats.suspects.length),
      hint: `${stats.lookalikes.length} lookalike groups`,
      tone: stats.suspects.length ? 'warn' : 'good',
      meter: { kind: 'severity', level: severityLevel(stats.suspects.length), max: 3 },
    },
  ];
}
