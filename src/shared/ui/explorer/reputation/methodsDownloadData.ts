import type { Feedback } from '../../../lib/explorer/data/types';
import type { ReputationReport } from '../../../lib/explorer/data/reputation/report';

export function downloadInputs(rep: ReputationReport, feedback: Feedback[]) {
  const inputs = {
    formulaVersion: rep.formulaVersion,
    params: rep.params,
    counts: rep.counts,
    funnel: rep.funnel,
    concentration: rep.concentration,
    rows: feedback.map((row, index) => ({
      index,
      client: row.client,
      value: row.value,
      tag1: row.tag1 ?? null,
      tag2: row.tag2 ?? null,
      createdAt: row.createdAt ?? null,
      revoked: row.revoked,
      kind: rep.layer.classified[index]?.kind ?? null,
      scale: rep.layer.classified[index]?.scale ?? null,
      rating: rep.layer.classified[index]?.r ?? null,
    })),
    units: rep.layer.units.map((unit) => ({
      client: unit.client,
      tag: unit.tag,
      window: unit.bucket,
      rating: unit.r,
      rows: unit.rows,
      weight: unit.time,
    })),
    wallets: rep.layer.wallets.map((wallet) => ({
      client: wallet.client,
      rating: wallet.r,
      weight: wallet.weight,
      units: wallet.units.length,
      rows: wallet.rows,
    })),
  };

  const blob = new Blob([JSON.stringify(inputs, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `reputation-inputs-${rep.formulaVersion}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
