import type { NavigateFn } from '@tanstack/react-router';
import { chainById, isNestedControl, type ReviewerProfile } from '../../../shared/lib/explorer';

export function openReviewer(
  navigate: NavigateFn,
  slug: string,
  reviewer: ReviewerProfile,
  event?: { target: EventTarget | null }
): void {
  if (event && isNestedControl(event.target)) return;

  const chain = chainById(reviewer.chainIds[0] ?? 0);

  void navigate({
    to: '/reviewers/$slug/$address',
    params: { slug: chain?.slug ?? slug, address: reviewer.address },
  });
}
