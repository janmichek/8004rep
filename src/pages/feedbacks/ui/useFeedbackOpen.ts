import { useNavigate } from '@tanstack/react-router';
import { chainById, isNestedControl } from '../../../shared/lib/explorer';
import type { FeedbackEvent } from '../../../shared/lib/explorer';

export function useFeedbackOpen(slug: string) {
  const navigate = useNavigate();

  return (row: FeedbackEvent, event?: { target: EventTarget | null }) => {
    if (event && isNestedControl(event.target)) return;
    const chain = chainById(row.chainId ?? 0);
    void navigate({
      to: '/agents/$slug/$id',
      params: { slug: chain?.slug ?? slug, id: row.tokenId.toString() },
    });
  };
}
