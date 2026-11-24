import { chainById, formatScore } from '../../../shared/lib/explorer';
import type { FeedbackEvent } from '../../../shared/lib/explorer';
import {
  ChainName,
  FeedbackTagsCell,
  FeedbackTextCell,
  FeedbackWhenCell,
} from '../../../shared/ui';
import { FeedbacksAgentCell } from './FeedbacksAgentCell';
import { FeedbacksReviewerCell } from './FeedbacksReviewerCell';

type Props = {
  row: FeedbackEvent;
  slug: string;
  all: boolean;
  onOpen: (row: FeedbackEvent, event?: { target: EventTarget | null }) => void;
};

export function FeedbacksTableRow({ row, slug, all, onOpen }: Props) {
  const chain = chainById(row.chainId ?? 0);

  return (
    <tr
      className={`row-link${row.revoked ? ' revoked' : ''}`}
      role="link"
      tabIndex={0}
      aria-label={`Open ${row.agentName ?? `Agent #${row.tokenId}`}`}
      onClick={(event) => onOpen(row, event)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(row);
        }
      }}
    >
      {all && chain ? (
        <td>
          <ChainName chainId={row.chainId} name={chain.name} />
        </td>
      ) : null}
      <FeedbacksAgentCell row={row} />
      <FeedbacksReviewerCell row={row} slug={slug} />
      <td className="num">
        <b>{formatScore(row.value)}</b>
      </td>
      <FeedbackTagsCell row={row} />
      <FeedbackTextCell row={row} />
      <FeedbackWhenCell createdAt={row.createdAt} />
    </tr>
  );
}
