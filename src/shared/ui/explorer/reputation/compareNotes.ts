import { formatNumber } from '../../../lib/explorer';
import type { ScanScore } from '../../../lib/explorer/data/scan';
import type { Feedback } from '../../../lib/explorer/data/types';

function headlineNote(scan: ScanScore): string | undefined {
  const policy = scan.policy;

  if (!policy || !scan.band) return undefined;

  return `The headline is ${formatNumber(scan.band.floor)} + (${formatNumber(scan.band.ceiling)} − ${formatNumber(scan.band.floor)}) × merit / 100, and merit = ${formatNumber(policy.proofWeight * 100, 0)}% proof + ${formatNumber(policy.supportWeight * 100, 0)}% support. Here that is ${formatNumber(policy.proofScore)} and ${formatNumber(policy.supportScore)} → ${formatNumber(policy.merit)} merit → ${formatNumber(scan.total)}.`;
}

function feedbackNote(scan: ScanScore): string | undefined {
  if (!scan.feedback) return undefined;

  const volume =
    scan.feedback.weight !== undefined && scan.feedback.weight < 1
      ? `, counted at ${Math.round(scan.feedback.weight * 100)}% for volume`
      : '';

  return `Feedback enters through the support score, as the plain average ${formatNumber(scan.feedback.average)} of ${scan.feedback.count} feedback${volume}. No reviewer is discounted there: self-feedback, duplicates and bursts count in full, and more feedback pushes support up.`;
}

function rawGapNote(scan: ScanScore, raw: number | null): string | undefined {
  if (!scan.feedback || raw === null) return undefined;

  if (Math.abs(scan.feedback.average - raw) < 5) return undefined;

  return `Its feedback average ${formatNumber(scan.feedback.average)} differs from the on-chain mean ${formatNumber(raw)} here by ${formatNumber(Math.abs(scan.feedback.average - raw))}.`;
}

function proofNote(scan: ScanScore): string | undefined {
  const policy = scan.policy;

  if (policy?.proofScore === undefined) return undefined;

  return `Proof is capped at ${formatNumber(policy.proofScore)} here and does not fall when one wallet writes thousands of rows, which is why a single-wallet record can still read as ${policy.evidenceTier ?? 'strong'} evidence.`;
}

function bandNote(scan: ScanScore): string | undefined {
  if (!scan.band) return undefined;

  return `Final scores are squeezed into ${formatNumber(scan.band.floor)}–${formatNumber(scan.band.ceiling)}, so many agents tie.`;
}

function countNote(scan: ScanScore, feedback: Feedback[]): string | undefined {
  if (!scan.feedback || scan.feedback.count === feedback.length) return undefined;

  return `8004scan counts ${scan.feedback.count} feedback; this page read ${feedback.length} (indexer lag or scan window).`;
}

export function notesFor(
  scan: ScanScore | null | undefined,
  raw: number | null,
  feedback: Feedback[]
): string[] {
  if (!scan) return [];

  const legacy =
    'The dimensions listed below are its legacy breakdown (engagement, service, publisher, compliance, momentum). They no longer drive the headline; proof and support do.';

  return [
    headlineNote(scan),
    legacy,
    feedbackNote(scan),
    rawGapNote(scan, raw),
    proofNote(scan),
    bandNote(scan),
    countNote(scan, feedback),
  ].filter((note): note is string => Boolean(note));
}
