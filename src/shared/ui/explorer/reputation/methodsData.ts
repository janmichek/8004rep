import type { ReputationReport } from '../../../lib/explorer/data/reputation/report';
import { formatNumber, formatPercent, formatSigned } from '../../../lib/explorer';
import type { Tile } from '../tileTypes';

export function alternativesFor(rep: ReputationReport): Tile[] {
  return [
    {
      label: 'Filtered score',
      value: rep.unrated ? 'Unrated' : formatNumber(rep.score),
      hint: rep.interval
        ? `80% interval ${formatNumber(rep.interval[0])}–${formatNumber(rep.interval[1])}`
        : 'no rating units',
      title: '(α0·μ0 + Σ W_c·r̄_c) / (α0 + Σ W_c) — one independent wallet is one vote',
      tone: 'main',
      word: rep.unrated,
      meter: rep.unrated ? undefined : { kind: 'gauge', value: rep.score, band: rep.interval },
    },
    {
      label: 'Effective voices',
      value: formatNumber(rep.funnel.walletsAfterCap ? rep.concentration.neff : 0),
      hint: `${rep.funnel.wallets} wallets after cap`,
      title: '1 / HHI over wallet weights: how many equally-weighted voices the result is worth',
    },
    {
      label: 'Inflation gap',
      value: formatSigned(rep.inflation),
      hint: 'raw rating mean − filtered',
      title: 'Large and positive = the rules removed reviews the raw mean counts in full.',
    },
    {
      label: 'Cost to fake',
      value: rep.cost === null ? '—' : String(rep.cost),
      hint: 'fresh unlinked wallets',
      title: `Wallets at the target of ${Math.round(rep.params.fakeTarget * 100)}/100, assuming they cannot be linked. Each also costs its feedback fee and a funding path.`,
    },
  ];
}

export function concentrationMetrics(rep: ReputationReport) {
  return [
    {
      label: 'Top wallet',
      value: formatPercent(rep.concentration.top1),
      rule: 'Largest share of the weight after the per-wallet cap.',
    },
    {
      label: 'Top three',
      value: formatPercent(rep.concentration.top3),
      rule: 'Share of the weight held by the three largest wallets.',
    },
    {
      label: 'Effective voices',
      value: formatNumber(rep.concentration.neff),
      rule: '1 / HHI over wallet weights; 1 = one wallet holds it all.',
    },
    {
      label: 'Largest influence',
      value: formatPercent(rep.concentration.maxInfluence),
      rule: 'Largest wallet share of (prior + weights); one full wallet against a prior of 3 holds 1/(3+1) = 25%.',
    },
    {
      label: 'Rows scored',
      value: formatPercent(rep.funnel.feedback ? rep.funnel.ratedRows / rep.funnel.feedback : null),
      rule: 'Rating rows inside their scale, out of every row read.',
    },
  ];
}

export function funnelRows(rep: ReputationReport) {
  return [
    { label: 'Rows read', n: rep.funnel.feedback },
    { label: 'Rating rows', n: rep.funnel.ratedRows },
    { label: 'Rating units', n: rep.funnel.units, hint: 'one per wallet, tag and 30-day window' },
    { label: 'Wallets', n: rep.funnel.wallets },
  ];
}
