import type { ReviewerProfile, SortColumn } from '../../../shared/lib/explorer';
import { PageHeader } from '../../../shared/ui';

type PageFact = NonNullable<Parameters<typeof PageHeader>[0]['facts']>[number];

export const REVIEWERS_NOTE =
  'Built from the newest feedback rows. Flags use the same rules as Network health; a flag is a prompt to look closer, not a verdict.';

export const REVIEWER_COLUMNS: SortColumn<ReviewerProfile>[] = [
  { key: 'reviewer', value: (reviewer) => reviewer.address.toLowerCase() },
  { key: 'reviews', value: (reviewer) => reviewer.rows, numeric: true },
  { key: 'agents', value: (reviewer) => reviewer.agents, numeric: true },
  { key: 'average', value: (reviewer) => reviewer.ratingAverage, numeric: true },
  { key: 'flags', value: (reviewer) => reviewer.labels.length, numeric: true },
];

export function reviewerFacts(reviewers: ReviewerProfile[], rowCount: number): PageFact[] {
  const flagged = reviewers.filter((reviewer) => reviewer.labels.length).length;

  const facts: PageFact[] = [
    { value: reviewers.length.toLocaleString(), label: 'reviewers' },
    { value: rowCount.toLocaleString(), label: 'feedback rows' },
  ];

  if (flagged) facts.push({ value: flagged.toLocaleString(), label: 'flagged', tone: 'warn' });

  return facts;
}
