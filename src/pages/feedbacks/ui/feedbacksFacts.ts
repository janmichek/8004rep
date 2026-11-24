import type { FeedbackEvent } from '../../../shared/lib/explorer';
import { formatDate } from '../../../shared/lib/explorer';

export function feedbackFacts(items: FeedbackEvent[], loaded: boolean) {
  if (!loaded) return [];

  const agentCount = new Set(items.map((row) => `${row.chainId ?? 0}:${row.tokenId.toString()}`))
    .size;

  const reviewerCount = new Set(items.map((row) => row.client.toLowerCase())).size;

  return [
    { value: items.length.toLocaleString(), label: 'feedback rows' },
    { value: agentCount.toLocaleString(), label: 'agents rated' },
    { value: reviewerCount.toLocaleString(), label: 'reviewers' },
  ];
}

export function feedbackNote(since: number | undefined): string | undefined {
  return since ? `Newest rows since ${formatDate(since)}.` : undefined;
}

export function feedbackHeaders(all: boolean): string[] {
  return all
    ? ['Network', 'Agent', 'Reviewer', 'Value', 'Tags', 'Text', 'When']
    : ['Agent', 'Reviewer', 'Value', 'Tags', 'Text', 'When'];
}
