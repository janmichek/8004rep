import { formatScore, type ReputationSummary } from '../../../shared/lib/explorer';
import { StatTiles, type Tile } from '../../../shared/ui';

type Props = {
  owned: number;
  pageCount: number;
  scores: Map<bigint, ReputationSummary> | undefined;
  chainName: string;
};

type Scored = {
  rated: number;
  total: number;
  avg: number | null;
};

function summarize(scores: Map<bigint, ReputationSummary> | undefined): Scored | null {
  if (!scores) return null;

  let rated = 0;
  let total = 0;
  let sum = 0;

  for (const score of scores.values()) {
    if (score.count > 0) {
      rated += 1;
      sum += score.average;
      total += score.count;
    }
  }

  return { rated, total, avg: rated ? sum / rated : null };
}

function ownedTile(owned: number, chainName: string): Tile {
  return {
    label: 'Owned agents',
    value: String(owned),
    title: `Agents this address owns on ${chainName}`,
    tone: 'main',
  };
}

function feedbackTile(scored: Scored | null, pageCount: number): Tile {
  return {
    label: 'With feedback',
    value: scored ? String(scored.rated) : '—',
    hint: scored ? `of ${pageCount} on this page` : '',
    title:
      'Agents on this page that have at least one feedback. The header count is the portfolio total; this tile is page-scoped.',
    loading: scored === null,
  };
}

function averageHint(scored: Scored | null): string {
  if (!scored) return '';

  const ratedLabel = scored.rated === 1 ? 'agent' : 'agents';

  return `${scored.total} feedback across ${scored.rated} ${ratedLabel} on this page`;
}

function averageTone(avg: number | null): Tile['tone'] {
  if (avg === null || avg < 75) return undefined;

  return 'good';
}

function averageMeter(avg: number | null): Tile['meter'] {
  if (avg === null || avg <= 0) return undefined;

  return { kind: 'gauge', value: avg };
}

function averageTile(scored: Scored | null): Tile {
  const avg = scored?.avg ?? null;

  return {
    label: 'Page raw average',
    value: avg !== null ? formatScore(avg) : '—',
    hint: averageHint(scored),
    title:
      'Simple average of the raw on-chain means for agents on this page. It mixes ratings with telemetry; open an agent for its filtered score.',
    loading: scored === null,
    tone: averageTone(avg),
    meter: averageMeter(avg),
  };
}

export function OwnerTiles({ owned, pageCount, scores, chainName }: Props) {
  const scored = summarize(scores);

  const tiles: Tile[] = [
    ownedTile(owned, chainName),
    feedbackTile(scored, pageCount),
    averageTile(scored),
  ];

  return <StatTiles tiles={tiles} />;
}
