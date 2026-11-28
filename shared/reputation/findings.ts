import type { KindCounts } from './units';
import type { Classified } from './kinds';
import type { FeedbackInput } from './types';
import type { Burst } from './analysis';

export type Finding = {
  level: 'warn' | 'info';
  code: 'repeat' | 'template' | 'revocations' | 'review-bomb' | 'same-tx' | 'burst';
  text: string;
};

export type FindingInput = {
  feedback: readonly FeedbackInput[];
  classified: readonly Classified[];
  ratingIdx: readonly number[];
  counts: KindCounts;
  burst: Burst;
  sameTxShare: number | null;
};

function repeatFinding(input: FindingInput): Finding | null {
  const perClient = new Map<string, number>();

  for (const index of input.ratingIdx) {
    const client = input.feedback[index]?.client.toLowerCase();

    if (client) perClient.set(client, (perClient.get(client) ?? 0) + 1);
  }

  const maxRows = Math.max(0, ...perClient.values());
  const total = input.ratingIdx.length;

  if (total < 5 || maxRows / total < 0.5 || maxRows < 5) return null;
  const share = Math.round((maxRows / total) * 100);

  return {
    level: 'warn',
    code: 'repeat',
    text: `One wallet wrote ${maxRows} of the ${total} rating rows (${share}%); it still holds one vote.`,
  };
}

function templateFinding(input: FindingInput): Finding | null {
  const total = input.ratingIdx.length;

  const extremes = input.ratingIdx.filter((index) => {
    const rating = input.classified[index]?.r ?? 0.5;

    return rating >= 0.99 || rating <= 0.01;
  }).length;

  if (total < 5 || extremes / total < 0.7) return null;

  return {
    level: 'warn',
    code: 'template',
    text: `${extremes} of ${total} ratings sit at the very top or bottom of their scale; a locked template cannot tell good agents from great ones.`,
  };
}

function sameTxFinding(input: FindingInput): Finding | null {
  if (input.sameTxShare === null || input.ratingIdx.length < 5 || input.sameTxShare < 0.3) {
    return null;
  }

  return {
    level: 'warn',
    code: 'same-tx',
    text: `${Math.round(input.sameTxShare * 100)}% of rating rows share a transaction with another rating; one transaction cannot be an independent opinion.`,
  };
}

function burstFinding(input: FindingInput): Finding | null {
  const ratio = input.burst.ratio;

  if (ratio === null || ratio < 5) return null;
  const dated = input.burst.datedRows;

  return {
    level: 'warn',
    code: 'burst',
    text: `${input.burst.maxDayRows} of ${dated} dated ratings landed on one day (${ratio.toFixed(1)}× the active-day average); a burst is not steady demand.`,
  };
}

function reviewBombFinding(input: FindingInput): Finding | null {
  const total = input.ratingIdx.length;
  const lows = input.ratingIdx.filter((index) => (input.classified[index]?.r ?? 1) <= 0.2).length;

  if (lows < 3 || lows / total < 0.5) return null;

  return {
    level: 'warn',
    code: 'review-bomb',
    text: `${lows} of ${total} ratings sit at the bottom of their scale; check the Reviewers tab for a coordinated run.`,
  };
}

function revocationFinding(input: FindingInput): Finding | null {
  const total = Math.max(1, input.feedback.length);

  if (input.counts.revoked < 2 || input.counts.revoked / total < 0.2) return null;

  return {
    level: 'warn',
    code: 'revocations',
    text: `${input.counts.revoked} of ${input.feedback.length} rows were revoked; a revoked low followed by a high replacement is a common wash.`,
  };
}

/** Warning codes for patterns a single-agent view can see in its own rows. */
export function buildFindings(input: FindingInput): Finding[] {
  const candidates = [
    repeatFinding(input),
    templateFinding(input),
    sameTxFinding(input),
    burstFinding(input),
    reviewBombFinding(input),
    revocationFinding(input),
  ];

  return candidates.filter((finding): finding is Finding => finding !== null);
}
